/**
 * DirectoryPresenceSeedService — admin-facing service for managing directory
 * presence seed records.
 *
 * Supports the seed/claim workflow:
 *   - List/view presence seeds
 *   - Create a seed (tenant + listing + provenance)
 *   - Publish a seed (set listing + seed to published)
 *   - Invite (mint a claim token)
 *   - Update sourced fields
 *
 * Seed tenants use org_standing_mode = 'directory_seed' and
 * subscription_tier = 'directory_presence'.
 */

import { randomUUID } from 'crypto';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import { emailService } from './email-service';
import DirectorySeedCampaignLinkService from './DirectorySeedCampaignLinkService';
import { SeedOutreachTriggerService } from './SeedOutreachTriggerService';
import { isReservedPlaceSlug } from '../utils/slug';
import {
  generateDirectoryListingId,
  generateDirectoryPresenceSeedId,
  generateDirectoryFieldProvenanceId,
  generateDirectoryClaimTokenId,
  generateDirectoryClaimTokenString,
  generateDirectoryEnrichmentTokenId,
  generateDirectoryEnrichmentTokenString,
  generateTenantId,
} from '../lib/id-generator';
import {
  buildSeedSeoPacket,
  buildSeoEnrichmentJson,
  DISCLOSURE_SENTENCE,
  type SeedSeoPacket,
} from './directory/SeedSeoComposer';
import {
  extractAttributesFromAuditData,
  extractAttributesFromAudits,
  type DirectoryListingAttribute,
} from './directory/listingAttributes';
import IntelligenceProfileService, {
  normalizeCategoryKey,
  normalizeReferenceCity,
  normalizeReferenceState,
} from './intelligence/IntelligenceProfileService';
import type { RequestCtx } from '../context';
/** Audit context for seed/claim operations */
interface SeedAuditCtx {
  actorType?: 'user' | 'system' | 'integration' | 'customer';
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * A single sourced attribute chip on a directory listing — canonical type
 * lives in ./directory/listingAttributes (shared by every attribute surface).
 */
export type { DirectoryListingAttribute } from './directory/listingAttributes';

/**
 * A predefined attribute chip offered by the seed editor's attribute picker
 * (migration 268). Universal definitions (applies_to_categories NULL) apply
 * to every category; category-specific definitions match on the category
 * name (case-insensitive) or its platform_categories slug.
 */
export interface DirectoryAttributeDefinition {
  attributeKey: string;
  label: string;
  groupKey: string;
  /** NULL = universal (applies to every category); otherwise category names. */
  appliesToCategories?: string[] | null;
  defaultSourcePlatform?: string | null;
  sortOrder: number;
}

export interface CreateSeedInput {
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  phone?: string;
  website?: string;
  primaryCategory: string;
  secondaryCategories?: string[];
  latitude?: number;
  longitude?: number;
  snapEbtReported?: boolean;
  snapEbtAsOf?: Date;
  snapEbtSource?: string;
  snapEbtSourceName?: string;
  /**
   * Sourced attribute chips (payments accepted, accessibility, ownership,
   * service options). Each entry carries its own evidence — never inferred
   * from category labels. SNAP/EBT stays in its dedicated snap_ebt_* columns.
   */
  attributes?: DirectoryListingAttribute[];
  seedBatch: string;
  identityConfidence: 'high' | 'medium';
  categoryFit: 'verified' | 'probable';
  notes?: string;
  slug?: string;
  businessHours?: any;
  /** Owner-submitted seeds can carry owner identity for faster claim handoff. */
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  /** Owner opted in to being contacted back (migration 275). */
  ownerContactConsent?: boolean;
  /** Override listing_origin and disclaimer for owner or campaign sources. */
  listingOrigin?: string;
  publicDisclaimer?: string;
  /** SEO enrichment fields (composed by SeedSeoComposer, spec §5.1). */
  description?: string;
  keywords?: string[];
  sameAs?: string[];
  /** Stored on the seed's seo_enrichment JSON, not the listing. */
  seoEnrichment?: any;
  provenance?: Array<{
    fieldKey: string;
    value?: string;
    sourceName?: string;
    sourceUrl?: string;
    accessedAt?: Date;
    confidence?: 'high' | 'medium' | 'low';
    showOnPublic?: boolean;
  }>;
}

export interface SeedSummary {
  id: string;
  tenantId: string;
  listingId: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
  status: string;
  identityConfidence: string;
  categoryFit: string;
  seedBatch: string;
  snapEbtReported: boolean;
  snapEbtAsOf: Date | null;
  snapEbtSource: string | null;
  snapEbtSourceName: string | null;
  hasClaimToken: boolean;
  claimTokenExpiresAt: Date | null;
  createdAt: Date;
  publishedAt: Date | null;
  invitedAt: Date | null;
  claimedAt: Date | null;
  outreachState?: string;
  outreachStateEnteredAt?: Date | null;
  outreachScheduledAt?: Date | null;
  /** Count of owner-proposed categories still awaiting operator review
   *  (migration 274 — abuse gate for owner-typed labels). */
  pendingOwnerProposals?: number;
}

class DirectoryPresenceSeedService {
  /**
   * List all presence seeds, optionally filtered by seed_batch, status, city,
   * state, category, identity_confidence, category_fit, or claim-token state.
   *
   * `hasClaimToken` accepts 'yes' (only seeds with an active, unconsumed token)
   * or 'no' (only seeds without one). Any other value is ignored.
   */
  async listSeeds(filters?: {
    seedBatch?: string;
    status?: string;
    city?: string;
    state?: string;
    category?: string;
    identityConfidence?: string;
    categoryFit?: string;
    hasClaimToken?: string;
    outreachState?: string;
  }): Promise<SeedSummary[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters?.seedBatch) {
      conditions.push(`dps.seed_batch = $${paramIdx++}`);
      params.push(filters.seedBatch);
    }
    if (filters?.status) {
      conditions.push(`dps.status = $${paramIdx++}`);
      params.push(filters.status);
    }
    if (filters?.city) {
      // Case-insensitive contains match so operators can type a partial city name.
      conditions.push(`dps.city ILIKE $${paramIdx++}`);
      params.push(`%${filters.city}%`);
    }
    if (filters?.state) {
      conditions.push(`dps.state ILIKE $${paramIdx++}`);
      params.push(`%${filters.state}%`);
    }
    if (filters?.category) {
      // Case-insensitive contains match so a partial category like "grocer" works.
      conditions.push(`dps.category ILIKE $${paramIdx++}`);
      params.push(`%${filters.category}%`);
    }
    if (filters?.identityConfidence) {
      conditions.push(`dps.identity_confidence = $${paramIdx++}`);
      params.push(filters.identityConfidence);
    }
    if (filters?.categoryFit) {
      conditions.push(`dps.category_fit = $${paramIdx++}`);
      params.push(filters.categoryFit);
    }
    if (filters?.hasClaimToken === 'yes') {
      conditions.push(
        `EXISTS (SELECT 1 FROM directory_claim_tokens dct WHERE dct.seed_id = dps.id AND dct.consumed_at IS NULL)`,
      );
    } else if (filters?.hasClaimToken === 'no') {
      conditions.push(
        `NOT EXISTS (SELECT 1 FROM directory_claim_tokens dct WHERE dct.seed_id = dps.id AND dct.consumed_at IS NULL)`,
      );
    }
    if (filters?.outreachState) {
      conditions.push(`dps.outreach_state = $${paramIdx++}`);
      params.push(filters.outreachState);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const seeds = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        dps.id,
        dps.tenant_id,
        dps.listing_id,
        dps.category,
        dps.city,
        dps.state,
        dps.status,
        dps.identity_confidence,
        dps.category_fit,
        dps.seed_batch,
        dps.created_at,
        dps.published_at,
        dps.invited_at,
        dps.claimed_at,
        dl.business_name,
        dl.snap_ebt_reported,
        dl.snap_ebt_as_of,
        dl.snap_ebt_source,
        dl.snap_ebt_source_name,
        (SELECT 1 FROM directory_claim_tokens dct WHERE dct.seed_id = dps.id AND dct.consumed_at IS NULL LIMIT 1) AS has_claim_token,
        (SELECT dct.expires_at FROM directory_claim_tokens dct WHERE dct.seed_id = dps.id AND dct.consumed_at IS NULL ORDER BY dct.created_at DESC LIMIT 1) AS claim_token_expires_at,
        dps.outreach_state,
        dps.outreach_state_entered_at,
        dps.outreach_scheduled_at,
        dps.owner_proposed_categories
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      ${whereClause}
      ORDER BY dps.created_at DESC
    `, ...params);

    return seeds.map((s) => ({
      id: s.id,
      tenantId: s.tenant_id,
      listingId: s.listing_id,
      businessName: s.business_name,
      category: s.category,
      city: s.city,
      state: s.state,
      status: s.status,
      identityConfidence: s.identity_confidence,
      categoryFit: s.category_fit,
      seedBatch: s.seed_batch,
      snapEbtReported: s.snap_ebt_reported ?? false,
      snapEbtAsOf: s.snap_ebt_as_of ? new Date(s.snap_ebt_as_of) : null,
      snapEbtSource: s.snap_ebt_source ?? null,
      snapEbtSourceName: s.snap_ebt_source_name ?? null,
      hasClaimToken: !!s.has_claim_token,
      claimTokenExpiresAt: s.claim_token_expires_at ? new Date(s.claim_token_expires_at) : null,
      createdAt: new Date(s.created_at),
      publishedAt: s.published_at ? new Date(s.published_at) : null,
      invitedAt: s.invited_at ? new Date(s.invited_at) : null,
      claimedAt: s.claimed_at ? new Date(s.claimed_at) : null,
      outreachState: s.outreach_state ?? 'not_started',
      outreachStateEnteredAt: s.outreach_state_entered_at ? new Date(s.outreach_state_entered_at) : null,
      outreachScheduledAt: s.outreach_scheduled_at ? new Date(s.outreach_scheduled_at) : null,
      pendingOwnerProposals: Array.isArray(s.owner_proposed_categories)
        ? s.owner_proposed_categories.filter((p: any) => p?.status === 'pending').length
        : 0,
    }));
  }

  /**
   * Get a single seed with full detail including provenance rows.
   */
  async getSeed(seedId: string) {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT * FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) return null;

    const listing = await prisma.$queryRaw<any[]>`
      SELECT * FROM directory_listings_list WHERE id = ${seed[0].listing_id} LIMIT 1
    `;
    const provenance = await prisma.$queryRaw<any[]>`
      SELECT * FROM directory_field_provenance WHERE seed_id = ${seedId} ORDER BY field_key
    `;
    const tokens = await prisma.$queryRaw<any[]>`
      SELECT id, token, expires_at, consumed_at, consumed_by, created_at
      FROM directory_claim_tokens WHERE seed_id = ${seedId} ORDER BY created_at DESC
    `;

    return {
      seed: seed[0],
      listing: listing[0],
      provenance: provenance.map((p) => ({
        id: p.id,
        fieldKey: p.field_key,
        value: p.value,
        sourceName: p.source_name,
        sourceUrl: p.source_url,
        accessedAt: p.accessed_at ? new Date(p.accessed_at) : null,
        confidence: p.confidence,
        showOnPublic: p.show_on_public,
      })),
      claimTokens: tokens.map((t) => ({
        id: t.id,
        token: t.token,
        expiresAt: new Date(t.expires_at),
        consumedAt: t.consumed_at ? new Date(t.consumed_at) : null,
        consumedBy: t.consumed_by,
        createdAt: new Date(t.created_at),
      })),
    };
  }

  /**
   * Normalize and de-duplicate a directory listing slug. If the requested slug
   * is already in use by another listing, appends an incrementing numeric suffix.
   * Reserved /place/ slugs (about, claim, search, category, city) are suffixed
   * to avoid collision with static Next.js routes.
   */
  private async ensureUniqueSlug(rawSlug: string, excludeListingId?: string): Promise<string> {
    let base = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);
    if (!base) base = 'listing';

    // Avoid collision with reserved /place/ static routes
    if (isReservedPlaceSlug(base)) {
      base = `${base}-listing`;
    }

    let candidate = base;
    let counter = 2;
    while (true) {
      const existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM directory_listings_list WHERE slug = ${candidate}
      `;
      if (
        existing.length === 0 ||
        (excludeListingId && existing.length === 1 && existing[0].id === excludeListingId)
      ) {
        return candidate;
      }
      candidate = `${base}-${counter++}`;
    }
  }

  /**
   * Create a new presence seed: tenant + listing + seed record + provenance.
   * The tenant is created with org_standing_mode = 'directory_seed'.
   */
  async createSeed(input: CreateSeedInput, ctx?: SeedAuditCtx): Promise<SeedSummary> {
    const tenantId = generateTenantId();
    const listingId = generateDirectoryListingId(tenantId);
    const seedId = generateDirectoryPresenceSeedId(tenantId);

    // Create the tenant (unclaimed directory seed). Status is 'active', not
    // 'trial' — the gateway tier is free forever and must never enter the
    // paid-trial machinery (which stamps a 14-day clock and auto-expires).
    await prisma.$executeRaw`
      INSERT INTO tenants (
        id, name, subscription_tier, subscription_status, org_standing_mode,
        directory_visible, service_level, location_status, created_at, updated_at
      ) VALUES (
        ${tenantId},
        ${input.businessName},
        'directory_presence',
        'active',
        'directory_seed',
        true,
        'self_service',
        'active',
        now(), now()
      )
    `;

    // Create the directory listing
    const slug = await this.ensureUniqueSlug(input.slug || input.businessName);

    await prisma.$executeRaw`
      INSERT INTO directory_listings_list (
        id, tenant_id, business_name, slug, address, city, state, zip_code,
        phone, website, primary_category, secondary_categories,
        latitude, longitude, business_hours, is_published, listing_origin, public_disclaimer,
        snap_ebt_reported, snap_ebt_as_of, snap_ebt_source, snap_ebt_source_name,
        attributes,
        subscription_tier, product_count, description, keywords, same_as,
        created_at, updated_at
      ) VALUES (
        ${listingId},
        ${tenantId},
        ${input.businessName},
        ${slug},
        ${input.address},
        ${input.city},
        ${input.state},
        ${input.zipCode || null},
        ${input.phone || null},
        ${input.website || null},
        ${input.primaryCategory},
        ${input.secondaryCategories || []}::text[],
        ${input.latitude || null},
        ${input.longitude || null},
        ${input.businessHours ? JSON.stringify(input.businessHours) : null}::jsonb,
        false,
        ${input.listingOrigin || 'directory_seed'},
        ${input.publicDisclaimer || 'Listed from public directories / SNAP / news. Not a claimed profile.'},
        ${input.snapEbtReported || false},
        ${input.snapEbtAsOf || null},
        ${input.snapEbtSource || null},
        ${input.snapEbtSourceName || null},
        ${JSON.stringify(input.attributes || [])}::jsonb,
        'directory_presence',
        0,
        ${input.description || null},
        ${input.keywords || []}::text[],
        ${input.sameAs || []}::text[],
        now(), now()
      )
    `;

    // Make the directory listing options page work for unclaimed seeds by
    // seeding the two tables the page validates (business name / category).
    await prisma.$executeRaw`
      INSERT INTO directory_settings_list (
        id, tenant_id, is_published, primary_category, secondary_categories,
        seo_description, seo_keywords, slug, updated_at
      ) VALUES (
        ${tenantId},
        ${tenantId},
        false,
        ${input.primaryCategory},
        ${input.secondaryCategories || []}::text[],
        ${input.description || null},
        ${input.keywords || []}::text[],
        ${slug},
        now()
      )
      ON CONFLICT (id) DO NOTHING
    `;

    await prisma.$executeRaw`
      INSERT INTO tenant_business_profiles_list (
        tenant_id, business_name, address_line1, city, state, postal_code,
        country_code, phone_number, website, logo_url, business_description,
        hours, latitude, longitude, display_map, map_privacy_mode, updated_at
      ) VALUES (
        ${tenantId},
        ${input.businessName},
        ${input.address},
        ${input.city},
        ${input.state},
        ${input.zipCode || ''},
        'US',
        ${input.phone || null},
        ${input.website || null},
        null,
        ${input.description || null},
        ${input.businessHours ? JSON.stringify(input.businessHours) : null}::jsonb,
        ${input.latitude || null},
        ${input.longitude || null},
        false,
        'precise',
        now()
      )
      ON CONFLICT (tenant_id) DO NOTHING
    `;

    // Create the seed record. contact_status is derived at ingest per the
    // seed-funnel analytics spec (§7 gap 1): contactable when any outreach
    // route exists (listing phone or owner phone). Absence is recorded as
    // contact_unverified — never as unreachable.
    const contactStatus = input.phone || input.ownerPhone ? 'contactable' : 'contact_unverified';
    await prisma.$executeRaw`
      INSERT INTO directory_presence_seeds (
        id, tenant_id, listing_id, category, city, state,
        seed_batch, status, identity_confidence, category_fit, notes,
        owner_name, owner_email, owner_phone, owner_contact_consent, seo_enrichment,
        contact_status, contact_status_derived_at,
        name_variants,
        created_at, updated_at
      ) VALUES (
        ${seedId},
        ${tenantId},
        ${listingId},
        ${input.primaryCategory},
        ${input.city},
        ${input.state},
        ${input.seedBatch},
        'draft',
        ${input.identityConfidence},
        ${input.categoryFit},
        ${input.notes || null},
        ${input.ownerName || null},
        ${input.ownerEmail || null},
        ${input.ownerPhone || null},
        ${input.ownerContactConsent === true},
        ${input.seoEnrichment ? JSON.stringify(input.seoEnrichment) : null}::jsonb,
        ${contactStatus},
        now(),
        ARRAY[${input.businessName}]::text[],
        now(), now()
      )
    `;

    // Insert provenance rows
    if (input.provenance && input.provenance.length > 0) {
      for (const p of input.provenance) {
        const provenanceId = generateDirectoryFieldProvenanceId(tenantId);
        await prisma.$executeRaw`
          INSERT INTO directory_field_provenance (
            id, seed_id, tenant_id, field_key, value,
            source_name, source_url, accessed_at, confidence, show_on_public,
            created_at, updated_at
          ) VALUES (
            ${provenanceId},
            ${seedId},
            ${tenantId},
            ${p.fieldKey},
            ${p.value || null},
            ${p.sourceName || null},
            ${p.sourceUrl || null},
            ${p.accessedAt || null},
            ${p.confidence || 'medium'},
            ${p.showOnPublic || false},
            now(), now()
          )
        `;
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.create',
      payload: {
        seedId,
        tenantId,
        listingId,
        businessName: input.businessName,
        seoEnriched: !!input.seoEnrichment,
        composerVersion: input.seoEnrichment?.composer_version ?? null,
      },
    });

    logger.info('DirectoryPresenceSeedService.createSeed', undefined, { seedId, tenantId, listingId });

    // Return the summary
    const seeds = await this.listSeeds({ seedBatch: input.seedBatch });
    return seeds.find((s) => s.id === seedId)!;
  }

  /**
   * Publish a seed: set listing is_published = true and seed status = 'published'.
   */
  async publishSeed(seedId: string, ctx?: SeedAuditCtx): Promise<void> {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT tenant_id, listing_id, status FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');
    if (seed[0].status === 'claimed') throw new Error('seed_already_claimed');

    await prisma.$executeRaw`
      UPDATE directory_listings_list SET is_published = true, updated_at = now()
      WHERE id = ${seed[0].listing_id}
    `;
    await prisma.$executeRaw`
      UPDATE directory_presence_seeds SET status = 'published', published_at = now(), updated_at = now()
      WHERE id = ${seedId}
    `;

    // Keep the tenant directory settings in sync so the listing options page
    // shows the correct published state / category for the published seed.
    await prisma.$executeRaw`
      INSERT INTO directory_settings_list (
        id, tenant_id, is_published, primary_category, secondary_categories,
        seo_description, seo_keywords, slug, updated_at
      )
      SELECT
        ${seed[0].tenant_id},
        ${seed[0].tenant_id},
        true,
        dl.primary_category,
        dl.secondary_categories,
        dl.description,
        dl.keywords,
        dl.slug,
        now()
      FROM directory_listings_list dl
      WHERE dl.id = ${seed[0].listing_id}
      ON CONFLICT (id) DO UPDATE SET
        is_published = true,
        primary_category = EXCLUDED.primary_category,
        secondary_categories = EXCLUDED.secondary_categories,
        seo_description = EXCLUDED.seo_description,
        seo_keywords = EXCLUDED.seo_keywords,
        slug = EXCLUDED.slug,
        updated_at = now()
    `;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.publish',
      payload: { seedId, tenantId: seed[0].tenant_id },
    });
    await this.resolveIntakeTickets(seedId);
    logger.info('DirectoryPresenceSeedService.publishSeed', undefined, { seedId });
  }

  /**
   * Resolve any Requests-Hub ticket filed when this seed arrived via a
   * public intake surface (owner submission). Called from publish/delete —
   * the seed's deciding actions — so the operator inbox self-cleans.
   */
  private async resolveIntakeTickets(seedId: string): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE crm_support_tickets
        SET status = 'resolved', resolved_at = now(), updated_at = now()
        WHERE tenant_id = ${PLATFORM_SCOPE}
          AND inquiry_id = ${seedId}
          AND category = 'directory_owner_submission'
          AND status IN ('open', 'in_progress', 'waiting')
      `;
    } catch (err) {
      logger.error('DirectoryPresenceSeedService.resolveIntakeTickets', undefined, {
        error: (err as Error).message,
        seedId,
      });
    }
  }

  /**
   * Mint a claim token for a seed. Expires in 90 days by default.
   */
  async inviteSeed(seedId: string, expiresInDays: number = 90, ctx?: SeedAuditCtx): Promise<{ token: string; expiresAt: Date }> {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT tenant_id, status, owner_email, owner_phone FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');
    if (seed[0].status === 'claimed') throw new Error('seed_already_claimed');

    const tokenId = generateDirectoryClaimTokenId(seed[0].tenant_id);
    const token = generateDirectoryClaimTokenString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Bind token to owner contact info if available (Sprint 3 verification)
    const boundEmail = seed[0].owner_email || null;
    const boundPhone = seed[0].owner_phone || null;
    const verificationRequired = !!(boundEmail || boundPhone);
    const operatorApprovalRequired = !verificationRequired;

    await prisma.$executeRaw`
      INSERT INTO directory_claim_tokens (
        id, seed_id, tenant_id, token, expires_at, single_use, created_at,
        bound_email, bound_phone, verification_required, operator_approval_required
      ) VALUES (
        ${tokenId},
        ${seedId},
        ${seed[0].tenant_id},
        ${token},
        ${expiresAt},
        true,
        now(),
        ${boundEmail},
        ${boundPhone},
        ${verificationRequired},
        ${operatorApprovalRequired}
      )
    `;

    await prisma.$executeRaw`
      UPDATE directory_presence_seeds SET status = 'invited', invited_at = now(), updated_at = now()
      WHERE id = ${seedId}
    `;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.invite',
      payload: { seedId, tenantId: seed[0].tenant_id, tokenId, verificationRequired, operatorApprovalRequired },
    });
    logger.info('DirectoryPresenceSeedService.inviteSeed', undefined, { seedId, tokenId, verificationRequired });

    return { token, expiresAt };
  }

  /**
   * Approve a seed: publish it, mint a claim token, and email the owner/submitter
   * the claim link. Used for public suggestions and owner-submitted seeds.
   */
  async approveAndInvite(seedId: string, ctx?: SeedAuditCtx): Promise<{ token: string; expiresAt: Date; claimUrl: string }> {
    await this.publishSeed(seedId, ctx);
    const { token, expiresAt } = await this.inviteSeed(seedId, 90, ctx);

    const baseUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
    const claimUrl = `${baseUrl}/place/claim/${token}`;

    const seed = await prisma.$queryRaw<any[]>`
      SELECT
        dps.owner_email,
        dps.owner_name,
        dps.category,
        dps.city,
        dps.state,
        dl.business_name,
        dl.slug
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ${seedId}
      LIMIT 1
    `;

    if (seed[0]?.owner_email) {
      const html = `
        <h1>Your business listing is ready to claim</h1>
        <p><strong>${seed[0].business_name}</strong> in ${seed[0].city}, ${seed[0].state} has been added to the directory.</p>
        <p>Click the link below to claim and manage your listing:</p>
        <p><a href="${claimUrl}" style="padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; display: inline-block;">Claim my listing</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p><code>${claimUrl}</code></p>
        <p>This link expires in 90 days.</p>
        <p>If you did not request this, please ignore this email.</p>
      `;
      const text = `Claim your listing for ${seed[0].business_name}: ${claimUrl} (expires in 90 days)`;

      try {
        await emailService.sendEmail({
          to: seed[0].owner_email,
          subject: `Claim your ${seed[0].business_name} listing`,
          html,
          text,
        });
      } catch (error) {
        logger.error('[DirectoryPresenceSeedService.approveAndInvite] Failed to send claim invite:', undefined, {
          error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
          seedId,
          to: seed[0].owner_email,
        });
      }
    }

    return { token, expiresAt, claimUrl };
  }

  /**
   * Update sourced fields on the listing + provenance.
   */
  async updateFields(
    seedId: string,
    fields: {
      snapEbtReported?: boolean;
      snapEbtAsOf?: Date | null;
      snapEbtSource?: string | null;
      snapEbtSourceName?: string | null;
      attributes?: DirectoryListingAttribute[] | null;
      phone?: string;
      email?: string | null;
      website?: string;
      businessHours?: any;
      description?: string | null;
      primaryCategory?: string | null;
      secondaryCategories?: string[];
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      slug?: string;
    },
    provenanceUpdates?: Array<{
      fieldKey: string;
      value?: string;
      sourceName?: string;
      sourceUrl?: string;
      accessedAt?: Date;
      confidence?: 'high' | 'medium' | 'low';
      showOnPublic?: boolean;
    }>,
    ctx?: SeedAuditCtx
  ): Promise<void> {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT dps.tenant_id, dps.listing_id, dps.status AS seed_status,
             dl.phone, dl.address, dl.city, dl.state, dl.zip_code, dl.website
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');

    const listingId = seed[0].listing_id;
    const tenantId = seed[0].tenant_id;

    // Pre-update NAP snapshot for owner-correction detection (seed-funnel
    // analytics spec §7 gap 2): diffed against the submitted fields after the
    // listing UPDATE below.
    const napColumns = ['phone', 'address', 'city', 'state', 'zip_code', 'website'] as const;
    const napFieldKeys: Record<string, keyof typeof fields> = {
      phone: 'phone',
      address: 'address',
      city: 'city',
      state: 'state',
      zip_code: 'zipCode',
      website: 'website',
    };
    const changedNapFields: Record<string, { from: string | null; to: string | null }> = {};
    for (const column of napColumns) {
      const submitted = (fields as any)[napFieldKeys[column]];
      if (submitted === undefined) continue;
      const before = seed[0][column] == null ? null : String(seed[0][column]).trim();
      const after = submitted == null ? null : String(submitted).trim();
      if (before !== after) {
        changedNapFields[column] = { from: before, to: after };
      }
    }

    // Build dynamic UPDATE for listing
    const setClauses: string[] = ['updated_at = now()'];
    const params: any[] = [];
    if (fields.email !== undefined) {
      setClauses.push('email = $' + (params.length + 1));
      params.push(fields.email);
    }
    if (fields.snapEbtReported !== undefined) {
      setClauses.push('snap_ebt_reported = $' + (params.length + 1));
      params.push(fields.snapEbtReported);
    }
    if (fields.snapEbtAsOf !== undefined) {
      setClauses.push('snap_ebt_as_of = $' + (params.length + 1));
      params.push(fields.snapEbtAsOf);
    }
    if (fields.snapEbtSource !== undefined) {
      setClauses.push('snap_ebt_source = $' + (params.length + 1));
      params.push(fields.snapEbtSource);
    }
    if (fields.snapEbtSourceName !== undefined) {
      setClauses.push('snap_ebt_source_name = $' + (params.length + 1));
      params.push(fields.snapEbtSourceName);
    }
    if (fields.attributes !== undefined) {
      setClauses.push('attributes = $' + (params.length + 1) + '::jsonb');
      params.push(JSON.stringify(fields.attributes || []));
    }
    if (fields.phone !== undefined) {
      setClauses.push('phone = $' + (params.length + 1));
      params.push(fields.phone);
    }
    if (fields.website !== undefined) {
      setClauses.push('website = $' + (params.length + 1));
      params.push(fields.website);
    }
    if (fields.businessHours !== undefined) {
      setClauses.push('business_hours = $' + (params.length + 1) + '::jsonb');
      params.push(JSON.stringify(fields.businessHours));
    }
    if (fields.description !== undefined) {
      if (fields.description && fields.description.length > 500) {
        throw new Error('description_too_long');
      }
      const withDisclosure = fields.description && !fields.description.endsWith(DISCLOSURE_SENTENCE)
        ? fields.description + DISCLOSURE_SENTENCE
        : fields.description;
      setClauses.push('description = $' + (params.length + 1));
      params.push(withDisclosure);
    }
    if (fields.primaryCategory !== undefined) {
      setClauses.push('primary_category = $' + (params.length + 1));
      params.push(fields.primaryCategory || null);
    }
    if (fields.secondaryCategories !== undefined) {
      setClauses.push('secondary_categories = $' + (params.length + 1) + '::text[]');
      params.push(fields.secondaryCategories || []);
    }
    if (fields.address !== undefined) {
      setClauses.push('address = $' + (params.length + 1));
      params.push(fields.address);
    }
    if (fields.city !== undefined) {
      setClauses.push('city = $' + (params.length + 1));
      params.push(fields.city);
    }
    if (fields.state !== undefined) {
      setClauses.push('state = $' + (params.length + 1));
      params.push(fields.state);
    }
    if (fields.zipCode !== undefined) {
      setClauses.push('zip_code = $' + (params.length + 1));
      params.push(fields.zipCode);
    }
    if (fields.latitude !== undefined) {
      setClauses.push('latitude = $' + (params.length + 1));
      params.push(fields.latitude);
    }
    if (fields.longitude !== undefined) {
      setClauses.push('longitude = $' + (params.length + 1));
      params.push(fields.longitude);
    }
    if (fields.slug !== undefined) {
      const uniqueSlug = await this.ensureUniqueSlug(fields.slug, listingId);
      setClauses.push('slug = $' + (params.length + 1));
      params.push(uniqueSlug);
    }

    params.push(listingId);
    await prisma.$executeRawUnsafe(
      `UPDATE directory_listings_list SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      ...params
    );

    // Owner-correction capture: when a CLAIMED seed's NAP fields change,
    // persist the diff and flag the seed. The claim itself stamped
    // nap_verified_at (owner confirmed the filed NAP); this records every
    // later correction for the funnel's owner_corrected_nap signal.
    if (seed[0].seed_status === 'claimed' && Object.keys(changedNapFields).length > 0) {
      await prisma.$executeRaw`
        INSERT INTO directory_seed_nap_verifications (
          id, seed_id, tenant_id, source, changed_fields, owner_corrected, created_at
        ) VALUES (
          ${randomUUID()},
          ${seedId},
          ${tenantId},
          'owner_update',
          ${JSON.stringify(changedNapFields)}::jsonb,
          TRUE,
          now()
        )
      `;
      await prisma.$executeRaw`
        UPDATE directory_presence_seeds
        SET nap_owner_corrected = TRUE, nap_verified_at = COALESCE(nap_verified_at, now()), updated_at = now()
        WHERE id = ${seedId}
      `;
    }

    // Sync seed hours into the canonical business_hours_list so the public
    // business-hours and status endpoints (which read that table) reflect them.
    if (fields.businessHours && typeof fields.businessHours === 'object') {
      const tz = fields.businessHours.timezone || 'America/New_York';
      const periods: any[] = [];
      const dayOrder = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      for (const day of dayOrder) {
        const h = fields.businessHours[day];
        if (h && typeof h === 'object' && !h.closed && h.open && h.close) {
          periods.push({ day: day.toUpperCase(), open: h.open, close: h.close });
        }
      }

      await prisma.business_hours_list.upsert({
        where: { tenant_id: tenantId },
        update: { timezone: tz, periods: periods as any, updated_at: new Date() },
        create: {
          id: `${tenantId}_hours`,
          tenant_id: tenantId,
          timezone: tz,
          periods: periods as any,
          updated_at: new Date(),
        },
      });

      // Keep the legacy business profile hours in sync.
      const { updateBusinessProfileHours } = await import('../utils/business-hours-utils');
      await updateBusinessProfileHours(tenantId);
    }

    // If primary category changed, also update the seed's category column so
    // the /place browse pages and seed list reflect the new category.
    if (fields.primaryCategory !== undefined) {
      await prisma.$executeRaw`
        UPDATE directory_presence_seeds SET category = ${fields.primaryCategory || null}, updated_at = now()
        WHERE id = ${seedId}
      `;
    }

    // Keep seed city/state in sync with the listing.
    if (fields.city !== undefined || fields.state !== undefined) {
      await prisma.$executeRaw`
        UPDATE directory_presence_seeds
        SET city = ${fields.city || null}, state = ${fields.state || null}, updated_at = now()
        WHERE id = ${seedId}
      `;
    }

    // Upsert provenance rows
    if (provenanceUpdates) {
      for (const p of provenanceUpdates) {
        // operator_override and owner_claim both record WHO confirmed the
        // field value — the operator user id or the claiming customer id.
        const stampsOverride = p.sourceName === 'operator_override' || p.sourceName === 'owner_claim';
        const overrideBy = stampsOverride ? (ctx?.actorId || null) : null;
        const overrideAt = stampsOverride ? new Date() : null;
        const provenanceId = generateDirectoryFieldProvenanceId(tenantId);
        await prisma.$executeRaw`
          INSERT INTO directory_field_provenance (
            id, seed_id, tenant_id, field_key, value,
            source_name, source_url, accessed_at, confidence, show_on_public,
            override_by, override_at,
            created_at, updated_at
          ) VALUES (
            ${provenanceId},
            ${seedId},
            ${tenantId},
            ${p.fieldKey},
            ${p.value || null},
            ${p.sourceName || null},
            ${p.sourceUrl || null},
            ${p.accessedAt || null},
            ${p.confidence || 'medium'},
            ${p.showOnPublic || false},
            ${overrideBy},
            ${overrideAt},
            now(), now()
          )
          ON CONFLICT (seed_id, field_key) DO UPDATE SET
            value = EXCLUDED.value,
            source_name = EXCLUDED.source_name,
            source_url = EXCLUDED.source_url,
            accessed_at = EXCLUDED.accessed_at,
            confidence = EXCLUDED.confidence,
            show_on_public = EXCLUDED.show_on_public,
            override_by = EXCLUDED.override_by,
            override_at = EXCLUDED.override_at,
            updated_at = now()
        `;
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.update_fields',
      payload: {
        seedId,
        tenantId,
        fields: Object.keys(fields),
        napChanged: Object.keys(changedNapFields).length > 0,
      },
    });
    logger.info('DirectoryPresenceSeedService.updateFields', undefined, {
      seedId,
      napChanged: Object.keys(changedNapFields).length > 0,
    });
  }

  /**
   * Directly set a seed's status. Operators use this to correct a misclassified
   * seed (e.g. flip a published seed to suppressed, or reset an invited seed
   * back to published after revoking its token).
   *
   * Allowed transitions: any -> any of {draft, published, invited, claimed, suppressed}.
   * Setting status to 'claimed' is allowed but does NOT consume tokens or flip
   * org_standing_mode — that only happens via DirectoryClaimService.acceptClaim.
   */
  async updateStatus(seedId: string, newStatus: string, ctx?: SeedAuditCtx): Promise<void> {
    const allowed = ['draft', 'published', 'invited', 'claimed', 'suppressed'];
    if (!allowed.includes(newStatus)) {
      throw new Error('invalid_status');
    }

    const seed = await prisma.$queryRaw<any[]>`
      SELECT tenant_id, status FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');

    const prevStatus = seed[0].status;

    await prisma.$executeRaw`
      UPDATE directory_presence_seeds
      SET status = ${newStatus}, updated_at = now()
      WHERE id = ${seedId}
    `;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.update_status',
      payload: { seedId, tenantId: seed[0].tenant_id, prevStatus, newStatus },
    });
    logger.info('DirectoryPresenceSeedService.updateStatus', undefined, {
      seedId,
      prevStatus,
      newStatus,
    });
  }

  /**
   * Operator decision on an owner-proposed category (migration 274).
   *
   * Owners can type category labels that aren't in the platform/vocab set at
   * claim time; those are held on owner_proposed_categories with status
   * 'pending' (abuse gate — nothing flows to the listing or the vocab until
   * an operator accepts). On 'accepted' the label is registered into
   * mkt_service_categories_list (same vocab the category-identification act
   * flow writes) and minted onto the listing — primary_category when the
   * proposal role is 'primary', otherwise appended to secondary_categories
   * (deduped, capped at 9 like the selector). On 'rejected' only the
   * proposal status changes.
   */
  async decideProposedCategory(
    seedId: string,
    label: string,
    decision: 'accepted' | 'rejected',
    ctx?: SeedAuditCtx,
  ): Promise<{ label: string; role: string; status: string }> {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT id, tenant_id, listing_id, owner_proposed_categories
      FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');

    const proposals: any[] = Array.isArray(seed[0].owner_proposed_categories)
      ? [...seed[0].owner_proposed_categories]
      : [];
    const target = label.trim().toLowerCase();
    const idx = proposals.findIndex(
      (p) => String(p?.label ?? '').trim().toLowerCase() === target && p?.status === 'pending',
    );
    if (idx === -1) throw new Error('proposal_not_found');

    const proposal = proposals[idx];
    proposals[idx] = {
      ...proposal,
      status: decision,
      decided_at: new Date().toISOString(),
      decided_by: ctx?.actorId ?? null,
    };

    await prisma.$executeRaw`
      UPDATE directory_presence_seeds
      SET owner_proposed_categories = ${JSON.stringify(proposals)}::jsonb, updated_at = now()
      WHERE id = ${seedId}
    `;

    // When the last pending proposal is decided, resolve the Requests-Hub
    // ticket so the operator inbox reflects the work is done.
    if (!proposals.some((p) => p?.status === 'pending')) {
      try {
        await prisma.$executeRaw`
          UPDATE crm_support_tickets
          SET status = 'resolved', resolved_at = now(), updated_at = now()
          WHERE tenant_id = ${PLATFORM_SCOPE}
            AND inquiry_id = ${seedId}
            AND category = 'directory_claim'
            AND title LIKE 'Owner-proposed categories%'
            AND status IN ('open', 'in_progress', 'waiting')
        `;
      } catch (err) {
        logger.error('DirectoryPresenceSeedService.decideProposedCategory — ticket resolve failed', undefined, {
          error: (err as Error).message,
        });
      }
    }

    if (decision === 'accepted') {
      const acceptedLabel = String(proposal.label).trim().slice(0, 100);

      // Register into the service-category vocab so the accepted label
      // becomes a known category everywhere (same registration the
      // category-identification act flow performs).
      const { default: serviceCategoryService } = await import('./MarketingServiceCategoryService');
      const vocabValue =
        acceptedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || acceptedLabel;
      await serviceCategoryService.upsertCategory(
        { value: vocabValue, label: acceptedLabel, isActive: true },
        ctx as any,
      );

      const listingRows = await prisma.$queryRaw<any[]>`
        SELECT primary_category, secondary_categories
        FROM directory_listings_list WHERE id = ${seed[0].listing_id} LIMIT 1
      `;
      const listing = listingRows[0] || {};
      const currentSecondary: string[] = Array.isArray(listing.secondary_categories)
        ? listing.secondary_categories
        : [];

      const fields: { primaryCategory?: string | null; secondaryCategories?: string[] } = {};
      const provenanceUpdates: Array<{
        fieldKey: string; value?: string; sourceName?: string;
        accessedAt?: Date; confidence?: 'high' | 'medium' | 'low'; showOnPublic?: boolean;
      }> = [];

      if (proposal.role === 'primary') {
        fields.primaryCategory = acceptedLabel;
        provenanceUpdates.push({
          fieldKey: 'primary_category', value: acceptedLabel, sourceName: 'owner_claim',
          accessedAt: new Date(), confidence: 'high', showOnPublic: true,
        });
      } else {
        const exists = currentSecondary.some(
          (s) => String(s).trim().toLowerCase() === acceptedLabel.toLowerCase(),
        );
        if (!exists && currentSecondary.length < 9) {
          fields.secondaryCategories = [...currentSecondary, acceptedLabel];
          provenanceUpdates.push({
            fieldKey: 'secondary_categories', value: fields.secondaryCategories.join(', '),
            sourceName: 'owner_claim', accessedAt: new Date(), confidence: 'high', showOnPublic: true,
          });
        }
      }

      if (provenanceUpdates.length > 0) {
        await this.updateFields(seedId, fields, provenanceUpdates, ctx);
      }

      // Keep the tenant's directory settings row in sync with the listing.
      await prisma.$executeRaw`
        INSERT INTO directory_settings_list (
          id, tenant_id, is_published, primary_category, secondary_categories, updated_at
        ) VALUES (
          ${seed[0].tenant_id}, ${seed[0].tenant_id}, false,
          ${fields.primaryCategory !== undefined ? fields.primaryCategory : listing.primary_category ?? null},
          ${(fields.secondaryCategories ?? currentSecondary)}::text[], now()
        )
        ON CONFLICT (id) DO UPDATE SET
          primary_category = EXCLUDED.primary_category,
          secondary_categories = EXCLUDED.secondary_categories,
          updated_at = now()
      `;
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.proposed_category_decision',
      payload: {
        seedId,
        tenantId: seed[0].tenant_id,
        label: proposal.label,
        role: proposal.role,
        decision,
      },
    });
    logger.info('DirectoryPresenceSeedService.decideProposedCategory', undefined, {
      seedId,
      label: proposal.label,
      decision,
    });

    return { label: proposal.label, role: proposal.role, status: decision };
  }

  /**
   * Revoke a claim token. Marks the token as consumed (preserving audit trail)
   * with consumed_by = 'platform:revoked'. If the seed was in 'invited' status
   * and no other active tokens remain, flips the seed back to 'published' so
   * the operator doesn't have to manually reset the status.
   */
  async revokeToken(seedId: string, tokenId: string, ctx?: SeedAuditCtx): Promise<void> {
    const token = await prisma.$queryRaw<any[]>`
      SELECT id, seed_id, consumed_at
      FROM directory_claim_tokens
      WHERE id = ${tokenId} AND seed_id = ${seedId}
      LIMIT 1
    `;
    if (!token[0]) throw new Error('token_not_found');
    if (token[0].consumed_at) throw new Error('token_already_consumed');

    const revokedBy = ctx?.actorId ? `platform:revoked:${ctx.actorId}` : 'platform:revoked';

    await prisma.$executeRaw`
      UPDATE directory_claim_tokens
      SET consumed_at = now(), consumed_by = ${revokedBy}
      WHERE id = ${tokenId}
    `;

    // If the seed is 'invited' and no other active tokens remain, flip back to 'published'.
    const seed = await prisma.$queryRaw<any[]>`
      SELECT status FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (seed[0]?.status === 'invited') {
      const active = await prisma.$queryRaw<any[]>`
        SELECT 1 FROM directory_claim_tokens
        WHERE seed_id = ${seedId} AND consumed_at IS NULL
        LIMIT 1
      `;
      if (!active[0]) {
        await prisma.$executeRaw`
          UPDATE directory_presence_seeds
          SET status = 'published', updated_at = now()
          WHERE id = ${seedId}
        `;
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.revoke_token',
      payload: { seedId, tokenId, revokedBy },
    });
    logger.info('DirectoryPresenceSeedService.revokeToken', undefined, { seedId, tokenId });
  }

  /**
   * Permanently delete a seed and its tenant. Seeds are backed by a real
   * tenant row (org_standing_mode = 'directory_seed'), so deletion follows
   * the tenant-delete pattern: tear down seed-scoped children, the listing,
   * tenant-scoped rows, then the tenant itself.
   *
   * Refuses to delete a seed whose status is 'claimed' — a claimed seed has
   * been promoted to a real customer relationship and deleting it would
   * destroy customer data. Suppress or re-create unclaimed seeds instead.
   *
   * Returns { deleted: true } on success, or { deleted: false, reason } when
   * the seed is missing or claimed.
   */
  async deleteSeed(
    seedId: string,
    ctx?: SeedAuditCtx,
  ): Promise<{ deleted: boolean; reason?: string }> {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT tenant_id, listing_id, status FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) return { deleted: false, reason: 'seed_not_found' };
    if (seed[0].status === 'claimed') return { deleted: false, reason: 'seed_already_claimed' };

    const tenantId = seed[0].tenant_id;
    const listingId = seed[0].listing_id;

    // directory_presence_suggestions.seed_id has no ON DELETE cascade — null
    // it out so the suggestion rows survive (they keep their own identity).
    await prisma.$executeRaw`
      UPDATE directory_presence_suggestions SET seed_id = NULL, updated_at = now()
      WHERE seed_id = ${seedId}
    `;

    // Seed-scoped children (cascades exist on most, but delete explicitly for
    // safety — mirrors the DemoTenantService tenant-delete pattern).
    await prisma.$executeRaw`DELETE FROM directory_claim_tokens WHERE seed_id = ${seedId}`;
    await prisma.$executeRaw`DELETE FROM directory_enrichment_tokens WHERE seed_id = ${seedId}`;
    await prisma.$executeRaw`DELETE FROM directory_field_provenance WHERE seed_id = ${seedId}`;
    await prisma.$executeRaw`DELETE FROM directory_seed_campaign_links WHERE seed_id = ${seedId}`;
    // claim_requests cascade from seed (fk_dcr_seed) and from tokens
    // (fk_dcr_token); deleting the tokens above already cascades their
    // claim_requests, but delete explicitly in case a request references a
    // already-consumed token that was not removed.
    await prisma.$executeRaw`DELETE FROM directory_claim_requests WHERE seed_id = ${seedId}`;

    // Proving-ground stamp cleanup: any queue entry seeded from this seed
    // returns to unseeded so it can be promoted again — the cockpit's
    // promote panel keys on mkt_prospect_queue.seed_id.
    await prisma.$executeRaw`
      UPDATE mkt_prospect_queue SET seed_id = NULL, updated_at = now()
      WHERE seed_id = ${seedId}
    `;

    // Deleting an owner-submitted seed is a rejection decision — close its
    // intake ticket in the Requests Hub.
    await this.resolveIntakeTickets(seedId);

    // The seed row itself.
    await prisma.$executeRaw`DELETE FROM directory_presence_seeds WHERE id = ${seedId}`;

    // The listing — directory_listings_list has no tenant FK cascade in the
    // schema, so delete it directly. Cascades directory_photos.
    await prisma.$executeRaw`DELETE FROM directory_listings_list WHERE id = ${listingId}`;

    // Tenant-scoped rows (most cascade from tenants, but explicit for safety).
    await prisma.$executeRaw`DELETE FROM directory_settings_list WHERE tenant_id = ${tenantId}`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM tenant_business_profiles_list WHERE tenant_id = ${tenantId}`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM business_hours_list WHERE tenant_id = ${tenantId}`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM business_hours_special_list WHERE tenant_id = ${tenantId}`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM user_tenants WHERE tenant_id = ${tenantId}`.catch(() => {});

    // Finally, the tenant row. Cascades any remaining tenant-scoped tables.
    await prisma.$executeRaw`DELETE FROM tenants WHERE id = ${tenantId}`;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.delete',
      payload: { seedId, tenantId, listingId },
    });
    logger.info('DirectoryPresenceSeedService.deleteSeed', undefined, {
      seedId,
      tenantId,
      listingId,
    });

    return { deleted: true };
  }

  // ============================
  // Batch operations (Sprint 4)
  // ============================

  /**
   * Create seeds from multiple prospect queue entries in batch.
   * Each prospect is converted to a seed independently — one failure
   * doesn't block others. All seeds get the same seed_batch identifier.
   */
  async createSeedsFromBatch(
    queueEntryIds: string[],
    seedBatch: string,
    ctx?: SeedAuditCtx,
  ): Promise<{
    created: string[];
    skipped: Array<{ queueEntryId: string; reason: string }>;
    failed: Array<{ queueEntryId: string; error: string }>;
  }> {
    const created: string[] = [];
    const skipped: Array<{ queueEntryId: string; reason: string }> = [];
    const failed: Array<{ queueEntryId: string; error: string }> = [];

    // Load queue entries
    const entries = await prisma.$queryRaw<any[]>`
      SELECT * FROM mkt_prospect_queue WHERE id = ANY(${queueEntryIds}::text[])
    `;

    for (const entry of entries) {
      try {
        // Check if a seed already exists for this business (by tenant_id or listing)
        const existing = await prisma.$queryRaw<any[]>`
          SELECT id FROM directory_presence_seeds
          WHERE city = ${entry.city} AND category = ${entry.category}
          AND EXISTS (
            SELECT 1 FROM directory_listings_list dl
            WHERE dl.id = directory_presence_seeds.listing_id
            AND LOWER(dl.business_name) = LOWER(${entry.business_name || entry.title})
          )
          LIMIT 1
        `;

        if (existing[0]) {
          skipped.push({ queueEntryId: entry.id, reason: 'duplicate_seed' });
          continue;
        }

        const snapshot = entry.business_snapshot || {};
        const seedInput: CreateSeedInput = {
          businessName: entry.business_name || entry.title || 'Unknown Business',
          address: snapshot.address || 'Address not available',
          city: entry.city || 'Unknown City',
          state: entry.state || snapshot.state || 'IN',
          zipCode: snapshot.zip_code || null,
          phone: snapshot.phone || null,
          website: snapshot.website || null,
          primaryCategory: entry.category || 'Unknown Category',
          secondaryCategories: snapshot.secondary_categories || null,
          latitude: snapshot.latitude || null,
          longitude: snapshot.longitude || null,
          snapEbtReported: snapshot.snap_ebt_reported || false,
          snapEbtAsOf: snapshot.snap_ebt_as_of || null,
          snapEbtSource: snapshot.snap_ebt_source || null,
          snapEbtSourceName: snapshot.snap_ebt_source_name || null,
          seedBatch,
          identityConfidence: (entry.identity_confidence as 'high' | 'medium') || 'medium',
          categoryFit: (entry.category_fit as 'verified' | 'probable') || 'probable',
          notes: entry.note || null,
          provenance: entry.discovery_provenance || [],
        };

        const result = await this.createSeed(seedInput, ctx);

        // Link seed to seek batch if the queue entry has one
        if (entry.seek_batch_id) {
          await prisma.$executeRaw`
            UPDATE directory_presence_seeds
            SET seek_batch_id = ${entry.seek_batch_id}, updated_at = now()
            WHERE id = ${result.id}
          `;
        }

        // Update queue entry status
        await prisma.$executeRaw`
          UPDATE mkt_prospect_queue
          SET status = 'campaign_created', processed_at = now(), updated_at = now()
          WHERE id = ${entry.id}
        `;

        created.push(result.id);
      } catch (err) {
        failed.push({ queueEntryId: entry.id, error: (err as Error).message });
        logger.error('DirectoryPresenceSeedService.createSeedsFromBatch — entry failed', undefined, {
          queueEntryId: entry.id, error: (err as Error).message,
        });
      }
    }

    // Handle entries that weren't found
    const foundIds = new Set(entries.map((e) => e.id));
    for (const id of queueEntryIds) {
      if (!foundIds.has(id)) {
        failed.push({ queueEntryId: id, error: 'queue_entry_not_found' });
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.batch_create',
      payload: { seedBatch, created: created.length, skipped: skipped.length, failed: failed.length },
    });

    logger.info('DirectoryPresenceSeedService.createSeedsFromBatch', undefined, {
      seedBatch, created: created.length, skipped: skipped.length, failed: failed.length,
    });

    return { created, skipped, failed };
  }

  /**
   * Create seeds for proving-ground queue entries (Migration 262, spec §4.4).
   *
   * Sibling of createSeedsFromBatch with different lifecycle semantics: for
   * the proving ground, seeding is the *start* of outreach, not graduation.
   * Per entry it: creates + publishes the seed, links it to the entry's
   * source (intelligence) campaign via directory_seed_campaign_links so the
   * tree-filtered funnel sees it, mints a claim token (QR kits resolve
   * through directory_claim_tokens), and stamps mkt_prospect_queue.seed_id —
   * leaving status = 'queued' so the prospect stays on the worklist.
   *
   * Idempotent: entries with seed_id already set are skipped
   * ('already_seeded'), and the same-business duplicate check from
   * createSeedsFromBatch applies.
   */
  async createSeedsForProvingGround(
    queueEntryIds: string[],
    seedBatch: string,
    ctx?: SeedAuditCtx,
  ): Promise<{
    created: Array<{ queueEntryId: string; seedId: string; claimToken: string | null }>;
    skipped: Array<{ queueEntryId: string; reason: string }>;
    failed: Array<{ queueEntryId: string; error: string }>;
  }> {
    const created: Array<{ queueEntryId: string; seedId: string; claimToken: string | null }> = [];
    const skipped: Array<{ queueEntryId: string; reason: string }> = [];
    const failed: Array<{ queueEntryId: string; error: string }> = [];

    const entries = await prisma.$queryRaw<any[]>`
      SELECT * FROM mkt_prospect_queue WHERE id = ANY(${queueEntryIds}::text[])
    `;

    for (const entry of entries) {
      try {
        if (entry.seed_id) {
          skipped.push({ queueEntryId: entry.id, reason: 'already_seeded' });
          continue;
        }

        // Same-business duplicate guard (mirrors createSeedsFromBatch).
        const existing = await prisma.$queryRaw<any[]>`
          SELECT id FROM directory_presence_seeds
          WHERE city = ${entry.city} AND category = ${entry.category}
          AND EXISTS (
            SELECT 1 FROM directory_listings_list dl
            WHERE dl.id = directory_presence_seeds.listing_id
            AND LOWER(dl.business_name) = LOWER(${entry.business_name || entry.title})
          )
          LIMIT 1
        `;
        if (existing[0]) {
          skipped.push({ queueEntryId: entry.id, reason: 'duplicate_seed' });
          continue;
        }

        const snapshot = entry.business_snapshot || {};
        const seedInput: CreateSeedInput = {
          businessName: entry.business_name || entry.title || 'Unknown Business',
          address: snapshot.address || 'Address not available',
          city: entry.city || 'Unknown City',
          state: entry.state || snapshot.state || 'IN',
          zipCode: snapshot.zip_code || null,
          phone: snapshot.phone || null,
          website: snapshot.website || null,
          primaryCategory: entry.category || 'Unknown Category',
          secondaryCategories: snapshot.secondary_categories || null,
          latitude: snapshot.latitude || null,
          longitude: snapshot.longitude || null,
          snapEbtReported: snapshot.snap_ebt_reported || false,
          snapEbtAsOf: snapshot.snap_ebt_as_of || null,
          snapEbtSource: snapshot.snap_ebt_source || null,
          snapEbtSourceName: snapshot.snap_ebt_source_name || null,
          seedBatch,
          identityConfidence: (entry.identity_confidence as 'high' | 'medium') || 'medium',
          categoryFit: (entry.category_fit as 'verified' | 'probable') || 'probable',
          notes: entry.note || null,
          provenance: entry.discovery_provenance || [],
        };

        const result = await this.createSeed(seedInput, ctx);
        await this.publishSeed(result.id, ctx);

        // Link to the entry's source (intelligence) campaign so the funnel's
        // directory_seed_campaign_links join sees the seed for tree-filtered
        // cohorts (spec §4.4/§6).
        if (entry.source_campaign_id) {
          await DirectorySeedCampaignLinkService.linkCampaign(
            result.id, entry.source_campaign_id, 'primary', ctx,
          );
        }

        // Mint the claim token — QR kits resolve through
        // directory_claim_tokens (spec §3 row: ClaimInviteQrKitService).
        let claimToken: string | null = null;
        try {
          const invite = await this.inviteSeed(result.id, 90, ctx);
          claimToken = invite.token;
        } catch (err) {
          logger.warn('createSeedsForProvingGround: claim token mint failed', undefined, {
            queueEntryId: entry.id, seedId: result.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        if (entry.seek_batch_id) {
          await prisma.$executeRaw`
            UPDATE directory_presence_seeds
            SET seek_batch_id = ${entry.seek_batch_id}, updated_at = now()
            WHERE id = ${result.id}
          `;
        }

        // Stamp the keystone linkage; leave status='queued' — the prospect
        // remains on the outreach worklist until claim or campaign creation.
        await prisma.$executeRaw`
          UPDATE mkt_prospect_queue
          SET seed_id = ${result.id}, updated_at = now()
          WHERE id = ${entry.id}
        `;

        created.push({ queueEntryId: entry.id, seedId: result.id, claimToken });
      } catch (err) {
        failed.push({ queueEntryId: entry.id, error: (err as Error).message });
        logger.error('createSeedsForProvingGround — entry failed', undefined, {
          queueEntryId: entry.id, error: (err as Error).message,
        });
      }
    }

    const foundIds = new Set(entries.map((e) => e.id));
    for (const id of queueEntryIds) {
      if (!foundIds.has(id)) {
        failed.push({ queueEntryId: id, error: 'queue_entry_not_found' });
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.proving_ground_seed',
      payload: { seedBatch, created: created.length, skipped: skipped.length, failed: failed.length },
    });

    logger.info('DirectoryPresenceSeedService.createSeedsForProvingGround', undefined, {
      seedBatch, created: created.length, skipped: skipped.length, failed: failed.length,
    });

    return { created, skipped, failed };
  }

  /**
   * Publish multiple seeds in batch.
   */
  async publishBatch(
    seedIds: string[],
    ctx?: SeedAuditCtx,
  ): Promise<{
    published: string[];
    skipped: Array<{ seedId: string; reason: string }>;
    failed: Array<{ seedId: string; error: string }>;
  }> {
    const published: string[] = [];
    const skipped: Array<{ seedId: string; reason: string }> = [];
    const failed: Array<{ seedId: string; error: string }> = [];

    for (const seedId of seedIds) {
      try {
        // Check current status
        const seedRows = await prisma.$queryRaw<any[]>`
          SELECT status FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
        `;
        if (!seedRows[0]) {
          failed.push({ seedId, error: 'seed_not_found' });
          continue;
        }
        if (seedRows[0].status === 'published') {
          skipped.push({ seedId, reason: 'already_published' });
          continue;
        }
        if (seedRows[0].status === 'claimed') {
          skipped.push({ seedId, reason: 'already_claimed' });
          continue;
        }

        await this.publishSeed(seedId, ctx);
        published.push(seedId);
      } catch (err) {
        failed.push({ seedId, error: (err as Error).message });
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.batch_publish',
      payload: { published: published.length, skipped: skipped.length, failed: failed.length },
    });

    return { published, skipped, failed };
  }

  /**
   * Invite (mint claim tokens) for multiple seeds in batch.
   */
  async inviteBatch(
    seedIds: string[],
    expiresInDays: number = 90,
    ctx?: SeedAuditCtx,
  ): Promise<{
    invited: Array<{ seedId: string; token: string }>;
    skipped: Array<{ seedId: string; reason: string }>;
    failed: Array<{ seedId: string; error: string }>;
  }> {
    const invited: Array<{ seedId: string; token: string }> = [];
    const skipped: Array<{ seedId: string; reason: string }> = [];
    const failed: Array<{ seedId: string; error: string }> = [];

    for (const seedId of seedIds) {
      try {
        const result = await this.inviteSeed(seedId, expiresInDays, ctx);
        invited.push({ seedId, token: result.token });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === 'seed_already_claimed') {
          skipped.push({ seedId, reason: 'already_claimed' });
        } else {
          failed.push({ seedId, error: msg });
        }
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.batch_invite',
      payload: { invited: invited.length, skipped: skipped.length, failed: failed.length },
    });

    return { invited, skipped, failed };
  }

  // ============================
  // Enrichment tokens (Sprint 3)
  // ============================

  /**
   * The token is sent to the business owner via email/SMS so they can
   * self-serve enrich their listing without creating an account.
   *
   * 90-day expiry. Multi-use (single_use = false) so the owner can submit
   * multiple times as they gather photos/info.
   */
  async generateEnrichmentToken(
    seedId: string,
    ctx?: SeedAuditCtx,
  ): Promise<{ tokenId: string; token: string; expiresAt: Date } | { error: string }> {
    const seedRows = await prisma.$queryRaw<any[]>`
      SELECT tenant_id FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seedRows[0]) {
      return { error: 'seed_not_found' };
    }
    const tenantId = seedRows[0].tenant_id;
    const tokenId = generateDirectoryEnrichmentTokenId(tenantId);
    const token = generateDirectoryEnrichmentTokenString();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    await prisma.$executeRaw`
      INSERT INTO directory_enrichment_tokens (id, seed_id, tenant_id, token, expires_at, single_use, created_at)
      VALUES (${tokenId}, ${seedId}, ${tenantId}, ${token}, ${expiresAt}, false, now())
    `;

    // Update seed outreach status to enrichment_sent
    await prisma.$executeRaw`
      UPDATE directory_presence_seeds
      SET outreach_status = 'enrichment_sent', updated_at = now()
      WHERE id = ${seedId}
    `;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.generate_enrichment_token',
      payload: { seedId, tenantId, tokenId },
    });

    logger.info('DirectoryPresenceSeedService.generateEnrichmentToken', undefined, {
      seedId,
      tenantId,
      tokenId,
    });

    return { tokenId, token, expiresAt };
  }

  /**
   * Resolve an enrichment token to its seed context + intake definition.
   * Public, no auth — the token itself is the gate.
   */
  async resolveEnrichmentToken(
    token: string,
  ): Promise<{
    seedId: string;
    tenantId: string;
    slug: string;
    businessName: string;
    category: string;
    city: string;
    state: string;
    isExpired: boolean;
    verificationRequired: boolean;
    submissionReviewRequired: boolean;
    boundEmail: string | null;
    boundPhone: string | null;
  } | null> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        det.id AS token_id,
        det.seed_id,
        det.tenant_id,
        det.expires_at,
        det.consumed_at,
        det.verification_required,
        det.submission_review_required,
        det.bound_email,
        det.bound_phone,
        dps.category,
        dps.city,
        dps.state,
        dl.slug,
        dl.business_name
      FROM directory_enrichment_tokens det
      JOIN directory_presence_seeds dps ON dps.id = det.seed_id
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE det.token = ${token}
      LIMIT 1
    `;
    if (!rows[0]) return null;
    const r = rows[0];
    const now = new Date();
    const expiresAt = new Date(r.expires_at);
    return {
      seedId: r.seed_id,
      tenantId: r.tenant_id,
      slug: r.slug,
      businessName: r.business_name,
      category: r.category,
      city: r.city,
      state: r.state,
      isExpired: now > expiresAt,
      verificationRequired: !!r.verification_required,
      submissionReviewRequired: !!r.submission_review_required,
      boundEmail: r.bound_email || null,
      boundPhone: r.bound_phone || null,
    };
  }

  // ============================
  // Outreach status (Sprint 3)
  // ============================

  /**
   * Update the outreach status and optionally log an outreach attempt.
   * Also captures owner contact info if provided.
   */
  async updateOutreachStatus(
    seedId: string,
    input: {
      status: string;
      notes?: string | null;
      ownerName?: string | null;
      ownerEmail?: string | null;
      ownerPhone?: string | null;
    },
    ctx?: SeedAuditCtx,
  ): Promise<{ success: boolean; error?: string }> {
    const validStatuses = [
      'unverified',
      'outreach_attempted',
      'verified_by_call',
      'verified_by_email',
      'enrichment_sent',
      'enrichment_pending_review',
      'enriched',
    ];
    if (!validStatuses.includes(input.status)) {
      return { success: false, error: 'invalid_status' };
    }

    const seedRows = await prisma.$queryRaw<any[]>`
      SELECT 1 FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seedRows[0]) {
      return { success: false, error: 'seed_not_found' };
    }

    // Build dynamic update for outreach columns
    const sets: string[] = [`outreach_status = $1`, `updated_at = now()`];
    const params: any[] = [input.status];
    let paramIdx = 2;

    if (input.notes !== undefined) {
      sets.push(`outreach_notes = $${paramIdx++}`);
      params.push(input.notes);
    }
    if (input.ownerName !== undefined) {
      sets.push(`owner_name = $${paramIdx++}`);
      params.push(input.ownerName);
    }
    if (input.ownerEmail !== undefined) {
      sets.push(`owner_email = $${paramIdx++}`);
      params.push(input.ownerEmail);
    }
    if (input.ownerPhone !== undefined) {
      sets.push(`owner_phone = $${paramIdx++}`);
      params.push(input.ownerPhone);
    }

    params.push(seedId);
    const seedParamIdx = paramIdx++;

    await prisma.$executeRawUnsafe(
      `UPDATE directory_presence_seeds SET ${sets.join(', ')} WHERE id = $${seedParamIdx}`,
      ...params,
    );

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.update_outreach',
      payload: { seedId, status: input.status },
    });

    logger.info('DirectoryPresenceSeedService.updateOutreachStatus', undefined, {
      seedId,
      status: input.status,
    });

    return { success: true };
  }

  /**
   * Update the seed's outreach_state (courtesy-window state machine).
   * This is separate from outreach_status (verification/enrichment lifecycle).
   * See sprint plan §3.2 for the state machine and §7.2 for this method.
   */
  async setOutreachState(
    seedId: string,
    state: string,
    ctx?: SeedAuditCtx,
  ): Promise<void> {
    await prisma.$executeRaw`
      UPDATE directory_presence_seeds
      SET outreach_state = ${state},
          outreach_state_entered_at = now(),
          outreach_scheduled_at = CASE WHEN ${state} = 'outreach_scheduled' THEN now() ELSE outreach_scheduled_at END,
          updated_at = now()
      WHERE id = ${seedId}
    `;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.outreach_state_change',
      payload: { seedId, state },
    });

    logger.info('DirectoryPresenceSeedService.setOutreachState', undefined, {
      seedId,
      state,
    });
  }

  /**
   * Create, publish, and link a directory presence seed from the latest
   * business_analysis audit on a marketing campaign. Reuses createSeed,
   * publishSeed, and DirectorySeedCampaignLinkService for the campaign bond.
   *
   * Idempotent: if a primary seed link already exists for this campaign,
   * returns the existing seed without creating a new one.
   */
  async createFromCampaign(
    campaignId: string,
    opts: { publish?: boolean } = {},
    ctx?: SeedAuditCtx,
  ): Promise<{ seedId: string; listingId: string; tenantId: string; slug: string; publicUrl: string; created: boolean; seoEnriched: boolean }> {
    const campaign = await (prisma as any).mkt_campaigns_list.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new Error('campaign_not_found');

    const audit = await (prisma as any).mkt_audits_list.findFirst({
      where: { campaign_id: campaignId, platform: 'business_analysis' },
      orderBy: { created_at: 'desc' },
    });
    if (!audit) throw new Error('business_analysis_audit_not_found');

    const d = (audit.audit_data ?? {}) as any;
    const meta = d.audit_metadata ?? {};
    const nap = d.nap_consistency ?? {};
    const website = d.website ?? {};
    const google = d.platforms?.google ?? {};
    const dataQuality = d.data_quality ?? {};

    if (meta.identity_status === 'mismatched') {
      throw new Error('identity_mismatch');
    }

    const businessName =
      campaign.business_name ||
      meta.matched_business?.business_name ||
      meta.requested_business?.business_name;
    let address = campaign.address_line1 || nap.canonical_address;
    const city =
      campaign.address_city ||
      meta.matched_business?.city ||
      meta.requested_business?.city;
    const state =
      campaign.address_state ||
      meta.matched_business?.state ||
      meta.requested_business?.state;
    const zipCode = campaign.address_zip || nap.canonical_zip;
    const phone = campaign.phone || nap.canonical_phone;
    const websiteUrl = campaign.website_url || website.url;

    if (!businessName || !address || !city || !state) {
      throw new Error('incomplete_nap');
    }

    // If we only have the canonical full address, use the first line as the street address.
    if (!campaign.address_line1 && nap.canonical_address) {
      address = nap.canonical_address.split(',')[0].trim();
    }

    // Idempotency: return an existing primary-linked seed
    const existing = await prisma.$queryRaw<any[]>`
      SELECT dscl.seed_id, dps.listing_id, dps.tenant_id, dl.slug
      FROM directory_seed_campaign_links dscl
      JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dscl.campaign_id = ${campaignId} AND dscl.link_role = 'primary'
      LIMIT 1
    `;
    if (existing[0]) {
      return {
        seedId: existing[0].seed_id,
        listingId: existing[0].listing_id,
        tenantId: existing[0].tenant_id,
        slug: existing[0].slug,
        publicUrl: `/place/${existing[0].slug}`,
        created: false,
        seoEnriched: false,
      };
    }

    const rawConfidence = String(meta.identity_confidence || dataQuality.confidence || 'medium').toLowerCase();
    const identityConfidence: 'high' | 'medium' = ['high', 'medium'].includes(rawConfidence) ? (rawConfidence as 'high' | 'medium') : 'medium';
    const categoryFit: 'verified' | 'probable' = meta.identity_status === 'confirmed' ? 'verified' : 'probable';

    const accessedAt = audit.created_at ? new Date(audit.created_at) : new Date();
    const sourceName = 'business_analysis_audit';
    const sourceUrl = `/settings/admin/marketing-ops/campaigns/${campaignId}`;
    const provenanceConfidence = ['high', 'medium', 'low'].includes(dataQuality.confidence)
      ? (dataQuality.confidence as 'high' | 'medium' | 'low')
      : 'high';

    // ── SEO enrichment (spec §5.1, §4.2) ────────────────────────────────
    // Composed from the latest business_analysis audit + intelligence
    // profile + gold standard via the shared composer (also powers the
    // manual Create Seed form's seo-preview prefill).
    const { packet: seoPacket, enrichmentJson: seoEnrichmentJson } =
      await this.composeCampaignSeoPacket(campaign, d, audit.id, businessName);

    // ── Sourced attributes (migration 267) ───────────────────────────────
    // Mine every attribute-bearing audit on THIS campaign (gold-standard
    // scans, business audits, discovery scans, city scans) so the seed is
    // born with the analyst-recorded attribute chips and their evidence —
    // not just NAP. Newest audit wins per key; each attribute carries its
    // own provenance, and a provenance row is written for the set.
    const campaignAudits = await (prisma as any).mkt_audits_list.findMany({
      where: {
        campaign_id: campaignId,
        platform: { in: ['gold_standard_scan', 'business_analysis', 'intelligence_discovery', 'city_analysis'] },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
    const sourcedAttributes = extractAttributesFromAudits(
      (Array.isArray(campaignAudits) ? campaignAudits : []).map((a: any) => ({
        platform: String(a.platform),
        audit_data: a.audit_data,
        created_at: a.created_at,
      })),
      { cap: 40 },
    );

    const seedInput: CreateSeedInput = {
      businessName,
      address,
      city,
      state,
      zipCode: zipCode || undefined,
      phone: phone || undefined,
      website: websiteUrl || undefined,
      primaryCategory: campaign.category,
      secondaryCategories: seoPacket.secondaryCategories.length > 0
        ? seoPacket.secondaryCategories
        : (google.additional_categories || []),
      snapEbtReported: false,
      attributes: sourcedAttributes.length > 0 ? sourcedAttributes : undefined,
      seedBatch: `from-campaign-${campaign.display_id || campaignId}`,
      identityConfidence,
      categoryFit,
      notes: typeof d.summary === 'string' ? d.summary.substring(0, 1000) : undefined,
      businessHours: d.business_hours || undefined,
      description: seoPacket.description,
      keywords: seoPacket.keywords,
      sameAs: seoPacket.sameAs,
      seoEnrichment: seoEnrichmentJson,
      provenance: [
        { fieldKey: 'name', value: businessName, sourceName, sourceUrl, accessedAt, confidence: provenanceConfidence, showOnPublic: true },
        { fieldKey: 'address', value: address, sourceName, sourceUrl, accessedAt, confidence: provenanceConfidence, showOnPublic: true },
        { fieldKey: 'phone', value: phone || undefined, sourceName, sourceUrl, accessedAt, confidence: provenanceConfidence, showOnPublic: !!phone },
        { fieldKey: 'website', value: websiteUrl || undefined, sourceName, sourceUrl, accessedAt, confidence: provenanceConfidence, showOnPublic: !!websiteUrl },
        { fieldKey: 'primary_category', value: campaign.category, sourceName, sourceUrl, accessedAt, confidence: provenanceConfidence, showOnPublic: true },
        // SEO provenance rows (spec §4.4.6)
        { fieldKey: 'description', value: seoPacket.description, sourceName: 'seed_seo_composer', sourceUrl, accessedAt, confidence: provenanceConfidence, showOnPublic: true },
        { fieldKey: 'keywords', value: seoPacket.keywords.join(', '), sourceName: seoPacket.inputs.intelligenceProfileId ? 'intelligence_profile' : 'seed_seo_composer', sourceUrl, accessedAt, confidence: provenanceConfidence, showOnPublic: true },
        { fieldKey: 'same_as', value: seoPacket.sameAs.join(', '), sourceName: 'business_analysis_audit', sourceUrl, accessedAt, confidence: provenanceConfidence, showOnPublic: seoPacket.sameAs.length > 0 },
        { fieldKey: 'secondary_categories', value: seoPacket.secondaryCategories.join(', '), sourceName: seoPacket.inputs.intelligenceProfileId ? 'intelligence_profile' : 'business_analysis_audit', sourceUrl, accessedAt, confidence: provenanceConfidence, showOnPublic: seoPacket.secondaryCategories.length > 0 },
        // Sourced attributes — evidence lives on each attribute entry; the
        // provenance row records the audit lineage for the set.
        { fieldKey: 'attributes', value: sourcedAttributes.length > 0 ? 'sourced' : undefined, sourceName: sourcedAttributes[0]?.sourcePlatform || 'business_analysis_audit', sourceUrl: sourcedAttributes[0]?.sourceUrl || sourceUrl, accessedAt, confidence: provenanceConfidence, showOnPublic: sourcedAttributes.length > 0 },
      ].filter((p) => p.value != null && p.value !== '') as any,
    };

    const seed = await this.createSeed(seedInput, ctx);

    if (opts.publish !== false) {
      await this.publishSeed(seed.id, ctx);
    }

    await DirectorySeedCampaignLinkService.linkCampaign(seed.id, campaignId, 'primary', ctx);

    // ★ Seed Outreach Courtesy Window: trigger campaign-aware outreach
    // after the seed is created, published, and linked. Fire-and-forget —
    // outreach trigger failure must not roll back seed creation.
    try {
      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId,
        seedId: seed.id,
        ctx,
      });
    } catch (err) {
      logger.warn('SeedOutreachTriggerService.onSeedCreated failed', undefined, {
        campaignId,
        seedId: seed.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const listingRows = await prisma.$queryRaw<any[]>`
      SELECT slug FROM directory_listings_list WHERE id = ${seed.listingId} LIMIT 1
    `;
    const slug = listingRows[0]?.slug || '';

    return {
      seedId: seed.id,
      listingId: seed.listingId,
      tenantId: seed.tenantId,
      slug,
      publicUrl: `/place/${slug}`,
      created: true,
      seoEnriched: true,
    };
  }

  /**
   * Compose the SEO packet (spec §5.1) for a campaign from its latest
   * business_analysis audit + intelligence profile + gold standard. Shared by
   * createFromCampaign and previewCampaignSeo so the manual Create Seed form
   * prefills exactly what the automated path would write. Degrades to Tier A
   * campaign facts when the audit blob is empty.
   */
  private async composeCampaignSeoPacket(
    campaign: any,
    auditData: any,
    auditId: string,
    businessName: string,
  ): Promise<{
    packet: SeedSeoPacket;
    enrichmentJson: ReturnType<typeof buildSeoEnrichmentJson>;
  }> {
    const d = auditData ?? {};
    const meta = d.audit_metadata ?? {};
    const google = d.platforms?.google ?? {};

    const seoFocus = (campaign.intelligence_focus === 'gold_standards'
      ? 'competitive'
      : campaign.intelligence_focus || 'competitive') as 'emerging' | 'competitive';
    const profile = await IntelligenceProfileService.resolve(
      campaign.category,
      seoFocus,
      campaign.address_city ?? null,
      campaign.intelligence_platform ?? null,
    ).catch(() => null);

    const goldStandard = await IntelligenceProfileService.resolveGoldStandard(
      campaign.category,
      campaign.intelligence_platform ?? 'google',
      campaign.address_city ?? null,
      campaign.address_state ?? null,
    ).catch(() => null);

    // Build composer inputs from explicit fields only (never the raw blob)
    const platformsObj = d.platforms ?? {};
    const platformProfileUrls: Array<{ platform: string; url: string }> = [];
    for (const pkey of ['google', 'yelp', 'facebook', 'bbb']) {
      const pdata = (platformsObj as any)[pkey];
      if (pdata?.profile_url && typeof pdata.profile_url === 'string') {
        platformProfileUrls.push({ platform: pkey, url: pdata.profile_url });
      }
    }

    const packet = buildSeedSeoPacket({
      campaign: {
        businessName,
        category: campaign.category,
        addressCity: campaign.address_city ?? null,
        addressState: campaign.address_state ?? null,
        neighborhood: campaign.neighborhood ?? null,
        businessOriginCountry: campaign.business_origin_country ?? null,
        businessOriginRegion: campaign.business_origin_region ?? null,
        directoryProfiles: Array.isArray(campaign.directory_profiles)
          ? campaign.directory_profiles
          : null,
        socialProfiles: Array.isArray(campaign.social_profiles)
          ? campaign.social_profiles
          : null,
      },
      audit: {
        auditId,
        storeFormat: meta.matched_business?.store_format ?? null,
        googleAdditionalCategories: google.additional_categories ?? null,
        platformProfileUrls: platformProfileUrls.length > 0 ? platformProfileUrls : null,
        publicNarrative: d.public_narrative ?? null,
      },
      intelligenceProfile: profile
        ? {
            profileId: profile.id,
            synonyms: profile.configuration_json?.synonyms ?? undefined,
            subcategories: profile.configuration_json?.subcategories ?? undefined,
            prohibitedKeywords: profile.configuration_json?.prohibited_keywords ?? undefined,
            schemaOrgType: profile.configuration_json?.schema_org_type ?? null,
          }
        : null,
      goldStandard: goldStandard
        ? {
            profileId: goldStandard.id,
            expectedFieldNames: Array.isArray(goldStandard.configuration_json?.expected_fields)
              ? (goldStandard.configuration_json.expected_fields as any[]).map((f: any) =>
                  typeof f === 'string' ? f : f?.field || f?.name,
                ).filter(Boolean)
              : undefined,
          }
        : null,
    });

    return { packet, enrichmentJson: buildSeoEnrichmentJson(packet) };
  }

  /**
   * Preview the SEO packet a campaign would contribute to a seed (spec §5.1)
   * without creating anything — the manual Create Seed form prefills its SEO
   * enrichment section from this when the operator loads a campaign prospect.
   * Degrades to Tier A campaign facts when no business_analysis audit exists
   * (seoEnrichment null in that case — nothing to store).
   */
  async previewCampaignSeo(campaignId: string): Promise<{
    hasAudit: boolean;
    businessName: string;
    metaTitle: string;
    description: string;
    keywords: string[];
    secondaryCategories: string[];
    sameAs: string[];
    schemaTypeHint: string | null;
    seoEnrichment: ReturnType<typeof buildSeoEnrichmentJson> | null;
  } | null> {
    const campaign = await (prisma as any).mkt_campaigns_list.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) return null;

    const audit = await (prisma as any).mkt_audits_list.findFirst({
      where: { campaign_id: campaignId, platform: 'business_analysis' },
      orderBy: { created_at: 'desc' },
    });
    const d = (audit?.audit_data ?? {}) as any;
    const meta = d.audit_metadata ?? {};
    const businessName =
      campaign.business_name ||
      meta.matched_business?.business_name ||
      meta.requested_business?.business_name ||
      campaign.category ||
      'Business';

    const { packet, enrichmentJson } = await this.composeCampaignSeoPacket(
      campaign,
      d,
      audit?.id ?? 'preview',
      businessName,
    );

    return {
      hasAudit: !!audit,
      businessName,
      metaTitle: packet.metaTitle,
      description: packet.description,
      keywords: packet.keywords,
      secondaryCategories: packet.secondaryCategories,
      sameAs: packet.sameAs,
      schemaTypeHint: packet.schemaTypeHint,
      seoEnrichment: audit ? enrichmentJson : null,
    };
  }

  // ── Outreach touch log (spec §7 gap 4, sprint plan W1) ───────────────
  // The 257 outreach_state machine tracks *state*; this tracks individual
  // touches (call/email/sms/mail) with outcomes — the CAC numerator for G5.

  async addOutreachTouch(
    seedId: string,
    input: {
      // Migration 262 — 'form' + 'referral' added for the proving-ground
      // channel ladder (spec §4.8). Migration 273 — 'visit' added for
      // same-town walk-in touches (leave-behind QR cards).
      channel: 'call' | 'email' | 'sms' | 'mail' | 'form' | 'referral' | 'visit' | 'other';
      // Migration 262 — extended with the full cadence signal set
      // ('no_answer','no_reply','bounce','unread','read_no_reply',
      // 'form_submitted','referral_asked'); 'no_response' remains as the
      // legacy alias of 'no_answer'.
      outcome?: 'connected' | 'no_response' | 'no_answer' | 'no_reply' | 'voicemail'
        | 'bad_number' | 'bounce' | 'unread' | 'read_no_reply' | 'form_submitted'
        | 'referral_asked' | 'claimed' | 'not_interested';
      notes?: string;
      occurredAt?: Date;
    },
    ctx?: SeedAuditCtx,
  ): Promise<{ id: string }> {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT tenant_id FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');

    const touchId = randomUUID();
    const occurredAt = input.occurredAt ?? new Date();

    await prisma.$executeRaw`
      INSERT INTO directory_seed_outreach_touches (
        id, seed_id, tenant_id, channel, outcome, notes, operator_id, occurred_at, created_at
      ) VALUES (
        ${touchId}::uuid,
        ${seedId},
        ${seed[0].tenant_id},
        ${input.channel},
        ${input.outcome || null},
        ${input.notes || null},
        ${ctx?.actorId || null},
        ${occurredAt},
        now()
      )
    `;

    if (ctx) {
      await audit({
        actor: ctx.actorId,
        actorType: ctx.actorType,
        action: 'directory_presence_seed.touch_logged',
        payload: {
          seedId,
          tenantId: seed[0].tenant_id,
          touchId,
          channel: input.channel,
          outcome: input.outcome || null,
        },
      });
    }

    logger.info('DirectoryPresenceSeedService.addOutreachTouch', undefined, {
      seedId,
      touchId,
      channel: input.channel,
    });

    return { id: touchId };
  }

  async listOutreachTouches(seedId: string): Promise<any[]> {
    return prisma.$queryRaw<any[]>`
      SELECT id, seed_id, tenant_id, channel, outcome, notes, operator_id, occurred_at, created_at
      FROM directory_seed_outreach_touches
      WHERE seed_id = ${seedId}
      ORDER BY occurred_at DESC
    `;
  }

  /**
   * Spawn a business-scope marketing campaign from a directory presence seed,
   * pre-populated with the seed's NAP (name / address / phone / website /
   * category / geo), and immediately link it to the seed.
   *
   * This is the reverse of {@link createFromCampaign}: it lets an operator
   * leverage the marketing architecture (audit prompts, enrichment actions,
   * SEO/description composition, recovery playbooks) for a seed that has no
   * campaign yet.
   *
   * The campaign is created with `scope = 'business'` and starts at the
   * `seek` stage (standard triage entry). The operator can override the
   * category (directory categories and marketing niche categories don't
   * always match) and add notes. The link role defaults to `primary` but
   * can be set to `sibling` / `recovery`.
   *
   * The structural-duplicate guardrail in MarketingCampaignService still
   * applies — if an active campaign with the same business-scope signature
   * already exists, a ConflictError (409) is thrown and the operator should
   * link the existing campaign instead.
   */
  async createCampaignFromSeed(
    seedId: string,
    opts: {
      category?: string;
      notes?: string;
      linkRole?: 'primary' | 'sibling' | 'recovery';
    } = {},
    ctx?: SeedAuditCtx,
  ): Promise<{
    campaign: any;
    link: any;
    autoProjected: boolean;
    napMatch: any;
  }> {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT * FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');

    const listing = await prisma.$queryRaw<any[]>`
      SELECT * FROM directory_listings_list WHERE id = ${seed[0].listing_id} LIMIT 1
    `;
    if (!listing[0]) throw new Error('listing_not_found');

    const s = seed[0];
    const dl = listing[0];
    const businessName = dl.business_name;
    const category = (opts.category && opts.category.trim()) || s.category || '';
    const city = dl.city || s.city || '';
    const state = dl.state || s.state || null;
    const phone = dl.phone || null;
    const websiteUrl = dl.website || null;
    const addressLine1 = dl.address || null;
    const addressZip = dl.zip_code || null;

    if (!businessName) {
      throw new Error('incomplete_nap');
    }

    const defaultNotes =
      `Spawned from directory presence seed ${seedId} (batch: ${s.seed_batch || '—'}). ` +
      `Listing: ${dl.slug || dl.id}.`;
    const notes = opts.notes != null ? opts.notes : defaultNotes;

    // Dynamic import to avoid any module-load circular dependency with
    // MarketingCampaignService (which is a large service module).
    const { default: MarketingCampaignService } = await import('./MarketingCampaignService.js');

    const requestCtx: RequestCtx = {
      region: 'us-east-1',
      userId: ctx?.actorId,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    };

    const campaign = await MarketingCampaignService.createCampaign(
      {
        scope: 'business',
        businessName,
        category,
        city,
        state: state || undefined,
        phone: phone || undefined,
        websiteUrl: websiteUrl || undefined,
        addressLine1: addressLine1 || undefined,
        addressCity: city || undefined,
        addressState: state || undefined,
        addressZip: addressZip || undefined,
        addressCountry: 'US',
        hasWebsite: websiteUrl ? 'yes' : undefined,
        notes,
      },
      requestCtx,
    );

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.spawn_campaign',
      payload: {
        seedId,
        campaignId: campaign.id,
        businessName,
        category,
        city,
        state,
      },
    });

    logger.info('DirectoryPresenceSeedService.createCampaignFromSeed', undefined, {
      seedId,
      campaignId: campaign.id,
    });

    // Link the freshly created campaign back to the seed. Use the requested
    // role (default primary). linkCampaign enforces single-primary and will
    // throw primary_link_already_exists if one is already present — surface
    // that to the operator so they can choose a different role or unlink first.
    const linkRole = opts.linkRole || 'primary';
    const linkResult = await DirectorySeedCampaignLinkService.linkCampaign(
      seedId,
      campaign.id,
      linkRole,
      ctx,
    );

    return {
      campaign,
      link: linkResult.link,
      autoProjected: linkResult.autoProjected,
      napMatch: linkResult.napMatch,
    };
  }

  /**
   * Spawn a business-scope marketing campaign from a tenant's directory
   * listing (a claimed or non-seed tenant). This is the tenant-listing
   * counterpart to {@link createCampaignFromSeed} — it lets an operator
   * pull any directory-listed business into the marketing architecture
   * (audit prompts, enrichment, SEO composition, recovery playbooks)
   * without needing a directory_presence_seeds row.
   *
   * Unlike the seed variant, there is no seed-campaign link table to bond
   * (the tenant already has a real customer relationship). The campaign is
   * created with `scope = 'business'` and starts at the `seek` stage.
   *
   * The structural-duplicate guardrail in MarketingCampaignService still
   * applies — if an active campaign with the same business-scope signature
   * already exists, a ConflictError (409) is thrown.
   */
  async createCampaignFromTenantListing(
    tenantId: string,
    opts: {
      category?: string;
      notes?: string;
    } = {},
    ctx?: SeedAuditCtx,
  ): Promise<{ campaign: any }> {
    const listing = await prisma.$queryRaw<any[]>`
      SELECT * FROM directory_listings_list WHERE tenant_id = ${tenantId} LIMIT 1
    `;
    if (!listing[0]) throw new Error('listing_not_found');

    // Draft / directory-presence-tier seeds may not have projected their
    // category onto the directory listing yet. Use the seed category as a
    // fallback so the operator doesn't have to type it manually.
    const seed = await prisma.$queryRaw<any[]>`
      SELECT * FROM directory_presence_seeds WHERE tenant_id = ${tenantId} LIMIT 1
    `;
    const seedRow = seed[0];

    const dl = listing[0];
    const businessName = dl.business_name;
    const category = (opts.category && opts.category.trim()) || dl.primary_category || seedRow?.category || '';
    const city = dl.city || seedRow?.city || '';
    const state = dl.state || seedRow?.state || null;
    const phone = dl.phone || null;
    const websiteUrl = dl.website || null;
    const addressLine1 = dl.address || null;
    const addressZip = dl.zip_code || null;

    if (!businessName) {
      throw new Error('incomplete_nap');
    }

    const defaultNotes =
      `Spawned from tenant directory listing (tenant: ${tenantId}, slug: ${dl.slug || dl.id}).`;
    const notes = opts.notes != null ? opts.notes : defaultNotes;

    // Dynamic import to avoid any module-load circular dependency.
    const { default: MarketingCampaignService } = await import('./MarketingCampaignService.js');

    const requestCtx: RequestCtx = {
      region: 'us-east-1',
      userId: ctx?.actorId,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    };

    const campaign = await MarketingCampaignService.createCampaign(
      {
        scope: 'business',
        tenantId,
        businessName,
        category,
        city,
        state: state || undefined,
        phone: phone || undefined,
        websiteUrl: websiteUrl || undefined,
        addressLine1: addressLine1 || undefined,
        addressCity: city || undefined,
        addressState: state || undefined,
        addressZip: addressZip || undefined,
        addressCountry: 'US',
        hasWebsite: websiteUrl ? 'yes' : undefined,
        notes,
      },
      requestCtx,
    );

    // If this tenant is a directory presence seed, link the new campaign so
    // both the directory listings table and the seed panel show it.
    if (seedRow) {
      try {
        await DirectorySeedCampaignLinkService.linkCampaign(seedRow.id, campaign.id, 'primary', ctx);
      } catch (linkErr: any) {
        logger.warn(
          'DirectoryPresenceSeedService.createCampaignFromTenantListing — could not link seed campaign',
          undefined,
          {
            tenantId,
            seedId: seedRow.id,
            campaignId: campaign.id,
            error: linkErr?.message || String(linkErr),
          },
        );
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_listing.spawn_campaign',
      payload: {
        tenantId,
        campaignId: campaign.id,
        businessName,
        category,
        city,
        state,
      },
    });

    logger.info('DirectoryPresenceSeedService.createCampaignFromTenantListing', undefined, {
      tenantId,
      campaignId: campaign.id,
    });

    return { campaign };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Seed description override support (Phase 4)
  // ─────────────────────────────────────────────────────────────────────────

  private async resolveProfileForMarket(
    categoryKey: string,
    city: string | null,
    ctx?: RequestCtx,
  ): Promise<{ id: string; category_name: string; configuration_json: any } | null> {
    const service = IntelligenceProfileService;
    const competitive = await service.resolve(categoryKey, 'competitive', city, null, ctx);
    if (competitive) return competitive;
    const emerging = await service.resolve(categoryKey, 'emerging', city, null, ctx);
    return emerging ?? null;
  }

  private toIntelligenceProfileSeoFields(
    profile: { id: string; configuration_json: any } | null,
  ): any {
    if (!profile) return null;
    const cfg = profile.configuration_json || {};
    return {
      profileId: profile.id,
      synonyms: cfg.synonyms ?? undefined,
      subcategories: cfg.subcategories ?? undefined,
      prohibitedKeywords: cfg.prohibited_keywords ?? undefined,
      schemaOrgType: cfg.schema_org_type ?? null,
    };
  }

  private toGoldStandardSeoFields(
    gold: { id: string; configuration_json: any } | null,
  ): any {
    if (!gold) return null;
    const cfg = gold.configuration_json || {};
    const expected = Array.isArray(cfg.expected_fields)
      ? (cfg.expected_fields as any[])
          .map((f: any) => (typeof f === 'string' ? f : f?.field || f?.name))
          .filter(Boolean)
      : undefined;
    return { profileId: gold.id, expectedFieldNames: expected };
  }

  async getComposedEnrichment(seedId: string, ctx?: RequestCtx): Promise<any> {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT dps.*, dl.business_name, dl.primary_category, dl.city, dl.state, dl.description, dl.keywords
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ${seedId}
      LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');
    const row = seed[0];

    const category = row.primary_category || row.category || '';
    const city = row.city || '';
    const state = row.state || '';
    const profile = await this.resolveProfileForMarket(
      normalizeCategoryKey(category),
      normalizeReferenceCity(city),
      ctx,
    );
    const goldStandard = state
      ? await IntelligenceProfileService.resolveGoldStandard(
          normalizeCategoryKey(category),
          null,
          normalizeReferenceCity(city),
          normalizeReferenceState(state),
          ctx,
        )
      : null;

    const campaign: any = {
      businessName: row.business_name || 'Business',
      category,
      addressCity: city || null,
      addressState: state || null,
    };

    const packet = buildSeedSeoPacket({
      campaign,
      audit: null,
      intelligenceProfile: this.toIntelligenceProfileSeoFields(profile),
      goldStandard: this.toGoldStandardSeoFields(goldStandard),
    });

    const provenance = await prisma.directory_field_provenance.findFirst({
      where: { seed_id: seedId, field_key: 'description' },
      select: { source_name: true, updated_at: true, value: true },
    });

    const sourceName = packet.inputs.auditId
      ? 'linked_campaign'
      : packet.inputs.intelligenceProfileId
        ? 'market_enrichment'
        : 'none';

    return {
      seedId,
      packet,
      sourceName,
      composedAt: provenance?.source_name === sourceName ? provenance.updated_at : null,
      currentDescription: row.description || null,
      provenanceValue: provenance?.value || null,
    };
  }

  async resetEnrichment(seedId: string, ctx?: SeedAuditCtx): Promise<any> {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT dps.*, dl.id AS listing_id, dl.business_name, dl.primary_category, dl.city, dl.state
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ${seedId}
      LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');
    const row = seed[0];

    const composeCtx: RequestCtx = {
      region: 'us-east-1',
      userId: ctx?.actorId,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    };
    const composed = await this.getComposedEnrichment(seedId, composeCtx);
    const packet = composed.packet as SeedSeoPacket;
    const now = new Date();

    await prisma.$executeRaw`
      UPDATE directory_listings_list
      SET description = ${packet.description},
          keywords = ${packet.keywords}::text[],
          updated_at = now()
      WHERE id = ${row.listing_id}
    `;

    await prisma.$executeRaw`
      UPDATE directory_presence_seeds
      SET seo_enrichment = ${buildSeoEnrichmentJson(packet)}::jsonb,
          updated_at = now()
      WHERE id = ${seedId}
    `;

    const provenanceIdDesc = generateDirectoryFieldProvenanceId(row.tenant_id);
    await prisma.$executeRaw`
      INSERT INTO directory_field_provenance (
        id, seed_id, tenant_id, field_key, value,
        source_name, source_url, accessed_at, confidence, show_on_public,
        override_by, override_at,
        created_at, updated_at
      ) VALUES (
        ${provenanceIdDesc},
        ${seedId},
        ${row.tenant_id},
        'description',
        ${packet.description},
        'market_enrichment',
        null,
        null,
        'medium',
        true,
        null,
        null,
        now(), now()
      )
      ON CONFLICT (seed_id, field_key) DO UPDATE SET
        value = EXCLUDED.value,
        source_name = EXCLUDED.source_name,
        source_url = EXCLUDED.source_url,
        accessed_at = EXCLUDED.accessed_at,
        confidence = EXCLUDED.confidence,
        show_on_public = EXCLUDED.show_on_public,
        override_by = null,
        override_at = null,
        updated_at = now()
    `;

    const provenanceIdKw = generateDirectoryFieldProvenanceId(row.tenant_id);
    await prisma.$executeRaw`
      INSERT INTO directory_field_provenance (
        id, seed_id, tenant_id, field_key, value,
        source_name, source_url, accessed_at, confidence, show_on_public,
        override_by, override_at,
        created_at, updated_at
      ) VALUES (
        ${provenanceIdKw},
        ${seedId},
        ${row.tenant_id},
        'keywords',
        ${packet.keywords.join(', ')},
        'market_enrichment',
        null,
        null,
        'medium',
        true,
        null,
        null,
        now(), now()
      )
      ON CONFLICT (seed_id, field_key) DO UPDATE SET
        value = EXCLUDED.value,
        source_name = EXCLUDED.source_name,
        source_url = EXCLUDED.source_url,
        accessed_at = EXCLUDED.accessed_at,
        confidence = EXCLUDED.confidence,
        show_on_public = EXCLUDED.show_on_public,
        override_by = null,
        override_at = null,
        updated_at = now()
    `;

    audit({
      action: 'directory_enrichment.operator_reset',
      actor: ctx?.actorId,
      actorType: ctx?.actorType || 'user',
      payload: { seedId, listingId: row.listing_id, category: packet.inputs.intelligenceProfileId },
    });

    return composed;
  }

  /**
   * List active attribute definitions for the seed editor's attribute picker.
   *
   * When a category is provided, the category's platform_categories slug is
   * resolved and definitions match when their applies_to_categories array is
   * NULL (universal) or contains the category name (case-insensitive) or the
   * slug. Results are ordered by group then sort_order so the picker can
   * render stable sections.
   */
  async listAttributeDefinitions(
    category?: string | null,
  ): Promise<DirectoryAttributeDefinition[]> {
    const catName = (category ?? '').trim().toLowerCase();
    let catSlug = '';
    if (catName) {
      const catRows = await prisma.$queryRaw<any[]>`
        SELECT slug FROM platform_categories WHERE LOWER(name) = ${catName} LIMIT 1
      `;
      catSlug = (Array.isArray(catRows) && catRows[0]?.slug) || '';
    }
    const rows = await prisma.$queryRaw<any[]>`
      SELECT attribute_key, label, group_key, default_source_platform, sort_order
      FROM directory_attribute_definitions
      WHERE is_active = true
        AND (
          applies_to_categories IS NULL
          OR ${catName} = ANY(applies_to_categories)
          OR ${catSlug} = ANY(applies_to_categories)
        )
      ORDER BY group_key ASC, sort_order ASC, label ASC
    `;
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      attributeKey: row.attribute_key,
      label: row.label,
      groupKey: row.group_key || 'other',
      defaultSourcePlatform: row.default_source_platform ?? null,
      sortOrder: row.sort_order ?? 100,
    }));
  }

  /**
   * List ALL attribute definitions (including inactive, unfiltered by
   * category) for the operator's attribute-library management page.
   */
  async listAllAttributeDefinitions(): Promise<Array<DirectoryAttributeDefinition & {
    id: string;
    appliesToCategories: string[] | null;
    isActive: boolean;
  }>> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, attribute_key, label, group_key, applies_to_categories,
             default_source_platform, sort_order, is_active, created_at, updated_at
      FROM directory_attribute_definitions
      ORDER BY group_key ASC, sort_order ASC, label ASC
    `;
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      attributeKey: row.attribute_key,
      label: row.label,
      groupKey: row.group_key || 'other',
      appliesToCategories: Array.isArray(row.applies_to_categories) ? row.applies_to_categories : null,
      defaultSourcePlatform: row.default_source_platform ?? null,
      sortOrder: row.sort_order ?? 100,
      isActive: row.is_active !== false,
    }));
  }

  /**
   * Create (or reactivate) an attribute definition. Upsert on attribute_key:
   * re-adding an existing key reactivates it and applies the new fields.
   */
  async createAttributeDefinition(input: {
    attributeKey: string;
    label: string;
    groupKey: string;
    appliesToCategories?: string[] | null;
    defaultSourcePlatform?: string | null;
    sortOrder?: number;
  }, ctx?: SeedAuditCtx): Promise<DirectoryAttributeDefinition & { id: string }> {
    const key = input.attributeKey.trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(key)) {
      throw new Error('attribute_key must be lowercase letters, numbers, and underscores');
    }
    const applies = (input.appliesToCategories ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);
    const rows = await prisma.$queryRaw<any[]>`
      INSERT INTO directory_attribute_definitions
        (attribute_key, label, group_key, applies_to_categories, default_source_platform, sort_order)
      VALUES (
        ${key}, ${input.label.trim()}, ${input.groupKey || 'other'},
        ${applies.length > 0 ? applies : null}::text[],
        ${input.defaultSourcePlatform || null}, ${input.sortOrder ?? 100}
      )
      ON CONFLICT (attribute_key) DO UPDATE SET
        label = EXCLUDED.label,
        group_key = EXCLUDED.group_key,
        applies_to_categories = EXCLUDED.applies_to_categories,
        default_source_platform = EXCLUDED.default_source_platform,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = now()
      RETURNING id, attribute_key, label, group_key, default_source_platform, sort_order
    `;
    const row = (Array.isArray(rows) ? rows : [])[0];
    audit({
      action: 'directory_attribute_definition.created',
      actorType: 'user',
      payload: { attributeKey: input.attributeKey, groupKey: input.groupKey },
    });
    return {
      id: row.id,
      attributeKey: row.attribute_key,
      label: row.label,
      groupKey: row.group_key || 'other',
      appliesToCategories: input.appliesToCategories ?? null,
      defaultSourcePlatform: row.default_source_platform ?? null,
      sortOrder: row.sort_order ?? 100,
    };
  }

  /**
   * Update an attribute definition (label, group, category scoping, sort
   * order, active flag). Deactivation is soft — existing listings keep their
   * assigned attributes; the key just stops being offered to new edits.
   */
  async updateAttributeDefinition(
    id: string,
    fields: {
      label?: string;
      groupKey?: string;
      appliesToCategories?: string[] | null;
      defaultSourcePlatform?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [];
    const toPgArrayLiteral = (arr: string[] | null | undefined): string | null => {
      if (!arr || arr.length === 0) return null;
      return `{${arr.map((v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
    };
    if (fields.label !== undefined) {
      params.push(fields.label);
      setClauses.push(`label = $${params.length}`);
    }
    if (fields.groupKey !== undefined) {
      params.push(fields.groupKey);
      setClauses.push(`group_key = $${params.length}`);
    }
    if (fields.appliesToCategories !== undefined) {
      const applies = (fields.appliesToCategories ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);
      params.push(applies.length > 0 ? applies : null);
      setClauses.push(`applies_to_categories = $${params.length}::text[]`);
    }
    if (fields.defaultSourcePlatform !== undefined) {
      params.push(fields.defaultSourcePlatform);
      setClauses.push(`default_source_platform = $${params.length}`);
    }
    if (fields.sortOrder !== undefined) {
      params.push(fields.sortOrder);
      setClauses.push(`sort_order = $${params.length}`);
    }
    if (fields.isActive !== undefined) {
      params.push(fields.isActive);
      setClauses.push(`is_active = $${params.length}`);
    }
    if (setClauses.length === 0) return;
    await prisma.$executeRawUnsafe(
      `UPDATE directory_attribute_definitions SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${params.length + 1}`,
      ...params,
      id,
    );
    audit({
      action: 'directory_attribute_definition.updated',
      actorType: 'user',
      payload: { id, fields: Object.keys(fields) },
    });
  }

  /**
   * Delete an attribute definition. Listings keep their assigned attributes
   * (the JSONB on the listing is the source of truth for display) — only the
   * preset disappears from the picker.
   */
  async deleteAttributeDefinition(id: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM directory_attribute_definitions WHERE id = ${id}`;
    audit({
      action: 'directory_attribute_definition.deleted',
      actorType: 'user',
      payload: { id },
    });
  }

  /**
   * Sourced attribute suggestions for a seed — mined from intelligence audits
   * (gold-standard scans, business audits, intelligence discovery) that are
   * linked to the seed's campaigns or share its category. Each suggestion
   * carries the evidence the analyst recorded (source platform + URL + as_of)
   * so accepting one is a legitimate provenance event, never an inference.
   *
   * Suggestions already present on the listing are excluded; the remainder is
   * deduped by key (newest audit wins) and annotated with the predefined
   * definition they match, when one exists.
   */
  async listAttributeSuggestions(seedId: string): Promise<{
    suggestions: Array<{
      key: string;
      label: string;
      sourcePlatform?: string | null;
      sourceUrl?: string | null;
      asOf?: string | null;
      origin: string;
      matchedDefinitionKey: string | null;
    }>;
    recommendations: Array<{
      key: string;
      label: string;
      platform?: string | null;
      basis?: string | null;
      rationale?: string | null;
      currentState?: string | null;
      matchedDefinitionKey: string | null;
    }>;
  }> {
    const seedRows = await prisma.$queryRaw<any[]>`
      SELECT dps.category, dl.attributes
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ${seedId} LIMIT 1
    `;
    const seedRow = Array.isArray(seedRows) ? seedRows[0] : null;
    if (!seedRow) return { suggestions: [], recommendations: [] };

    const existingKeys = new Set<string>(
      (Array.isArray(seedRow.attributes) ? seedRow.attributes : [])
        .map((a: any) => String(a?.key ?? '').trim().toLowerCase())
        .filter(Boolean),
    );

    const auditRows = await prisma.$queryRaw<any[]>`
      SELECT a.id, a.campaign_id, a.platform, a.audit_data, a.created_at
      FROM mkt_audits_list a
      WHERE a.platform IN ('gold_standard_scan', 'business_analysis', 'intelligence_discovery', 'city_analysis')
        AND (
          a.campaign_id IN (SELECT campaign_id FROM directory_seed_campaign_links WHERE seed_id = ${seedId})
          OR EXISTS (
            SELECT 1 FROM mkt_campaigns_list c
            WHERE c.id = a.campaign_id AND LOWER(c.category) = LOWER(${String(seedRow.category ?? '')})
          )
        )
      ORDER BY a.created_at DESC
      LIMIT 30
    `;

    const definitions = await this.listAttributeDefinitions(seedRow.category ?? undefined);
    const defByKey = new Map<string, DirectoryAttributeDefinition>(
      definitions.map((d) => [d.attributeKey.toLowerCase(), d]),
    );

    // Shared extraction pipeline (directory/listingAttributes.ts) — one
    // normalize/extract/dedupe implementation for every attribute surface.
    // Audits arrive newest-first; first occurrence of a key wins.
    const originByKey = new Map<string, string>();
    const attrByKey = new Map<string, DirectoryListingAttribute>();
    for (const audit of Array.isArray(auditRows) ? auditRows : []) {
      const data = audit.audit_data;
      if (!data || typeof data !== 'object') continue;
      const origin = String(audit.platform);
      for (const a of extractAttributesFromAuditData(origin, data)) {
        const key = a.key.toLowerCase();
        if (!key || originByKey.has(key)) continue;
        originByKey.set(key, origin);
        attrByKey.set(key, a);
      }
      // Cap per-audit work — suggestions are best-effort, never a hot path.
      if (originByKey.size >= 120) break;
    }

    // Drop entries already on the listing and annotate the predefined
    // definition each suggestion matches (if any).
    const out: Array<{
      key: string;
      label: string;
      sourcePlatform?: string | null;
      sourceUrl?: string | null;
      asOf?: string | null;
      origin: string;
      matchedDefinitionKey: string | null;
    }> = [];
    for (const [key, a] of attrByKey) {
      if (existingKeys.has(key)) continue;
      const def = defByKey.get(key);
      out.push({
        key: def?.attributeKey ?? a.key,
        label: a.label,
        sourcePlatform: a.sourcePlatform ?? null,
        sourceUrl: a.sourceUrl ?? null,
        asOf: a.asOf ?? null,
        origin: originByKey.get(key) ?? 'unknown',
        matchedDefinitionKey: def?.attributeKey ?? null,
      });
      if (out.length >= 40) break;
    }

    // Advisory recommendations — business_analysis audits may emit a
    // top-level recommended_attributes array. These are NOT sourced
    // observations: no evidence URL, no as_of. They surface as a separate
    // group so the operator can see "the audit thinks this chip is worth
    // enabling/verifying" without it being confused with sourced chips.
    // Deduped against the listing AND against observed suggestions.
    const recByKey = new Map<string, any>();
    for (const audit of Array.isArray(auditRows) ? auditRows : []) {
      if (audit.platform !== 'business_analysis') continue;
      const data = audit.audit_data;
      if (!data || typeof data !== 'object') continue;
      for (const r of Array.isArray(data.recommended_attributes) ? data.recommended_attributes : []) {
        const key = String(r?.key ?? '').trim().toLowerCase();
        const label = String(r?.label ?? '').trim();
        if (!key || !label || existingKeys.has(key) || originByKey.has(key) || recByKey.has(key)) continue;
        recByKey.set(key, r);
        if (recByKey.size >= 40) break;
      }
    }
    const recommendations: Array<{
      key: string;
      label: string;
      platform?: string | null;
      basis?: string | null;
      rationale?: string | null;
      currentState?: string | null;
      matchedDefinitionKey: string | null;
    }> = [];
    for (const [key, r] of recByKey) {
      const def = defByKey.get(key);
      recommendations.push({
        key: def?.attributeKey ?? key,
        label: String(r.label),
        platform: r.platform ?? null,
        basis: r.basis ?? null,
        rationale: r.rationale ?? null,
        currentState: r.current_state ?? null,
        matchedDefinitionKey: def?.attributeKey ?? null,
      });
    }

    return { suggestions: out, recommendations };
  }
}

export default new DirectoryPresenceSeedService();
