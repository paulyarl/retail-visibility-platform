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

import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import {
  generateDirectoryListingId,
  generateDirectoryPresenceSeedId,
  generateDirectoryFieldProvenanceId,
  generateDirectoryClaimTokenId,
  generateDirectoryClaimTokenString,
  generateTenantId,
} from '../lib/id-generator';
/** Audit context for seed/claim operations */
interface SeedAuditCtx {
  actorType?: 'user' | 'system' | 'integration' | 'customer';
  actorId?: string;
  ip?: string;
  userAgent?: string;
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
  seedBatch: string;
  identityConfidence: 'high' | 'medium';
  categoryFit: 'verified' | 'probable';
  notes?: string;
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
}

class DirectoryPresenceSeedService {
  /**
   * List all presence seeds, optionally filtered by seed_batch, status, city, or category.
   */
  async listSeeds(filters?: {
    seedBatch?: string;
    status?: string;
    city?: string;
    category?: string;
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
      conditions.push(`dps.city = $${paramIdx++}`);
      params.push(filters.city);
    }
    if (filters?.category) {
      conditions.push(`dps.category = $${paramIdx++}`);
      params.push(filters.category);
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
        (SELECT dct.expires_at FROM directory_claim_tokens dct WHERE dct.seed_id = dps.id AND dct.consumed_at IS NULL ORDER BY dct.created_at DESC LIMIT 1) AS claim_token_expires_at
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
      SELECT id, expires_at, consumed_at, consumed_by, created_at
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
        expiresAt: new Date(t.expires_at),
        consumedAt: t.consumed_at ? new Date(t.consumed_at) : null,
        consumedBy: t.consumed_by,
        createdAt: new Date(t.created_at),
      })),
    };
  }

  /**
   * Create a new presence seed: tenant + listing + seed record + provenance.
   * The tenant is created with org_standing_mode = 'directory_seed'.
   */
  async createSeed(input: CreateSeedInput, ctx?: SeedAuditCtx): Promise<SeedSummary> {
    const tenantId = generateTenantId();
    const listingId = generateDirectoryListingId(tenantId);
    const seedId = generateDirectoryPresenceSeedId(tenantId);

    // Create the tenant (unclaimed directory seed)
    await prisma.$executeRaw`
      INSERT INTO tenants (
        id, name, subscription_tier, subscription_status, org_standing_mode,
        directory_visible, service_level, location_status, created_at, updated_at
      ) VALUES (
        ${tenantId},
        ${input.businessName},
        'directory_presence',
        'trial',
        'directory_seed',
        true,
        'self_service',
        'active',
        now(), now()
      )
    `;

    // Create the directory listing
    const slug = input.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);

    await prisma.$executeRaw`
      INSERT INTO directory_listings_list (
        id, tenant_id, business_name, slug, address, city, state, zip_code,
        phone, website, primary_category, secondary_categories,
        latitude, longitude, is_published, listing_origin, public_disclaimer,
        snap_ebt_reported, snap_ebt_as_of, snap_ebt_source, snap_ebt_source_name,
        subscription_tier, product_count, created_at, updated_at
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
        false,
        'directory_seed',
        'Listed from public directories / SNAP / news. Not a claimed profile.',
        ${input.snapEbtReported || false},
        ${input.snapEbtAsOf || null},
        ${input.snapEbtSource || null},
        ${input.snapEbtSourceName || null},
        'directory_presence',
        0,
        now(), now()
      )
    `;

    // Create the seed record
    await prisma.$executeRaw`
      INSERT INTO directory_presence_seeds (
        id, tenant_id, listing_id, category, city, state,
        seed_batch, status, identity_confidence, category_fit, notes,
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
      payload: { seedId, tenantId, listingId, businessName: input.businessName },
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

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.publish',
      payload: { seedId, tenantId: seed[0].tenant_id },
    });
    logger.info('DirectoryPresenceSeedService.publishSeed', undefined, { seedId });
  }

  /**
   * Mint a claim token for a seed. Expires in 90 days by default.
   */
  async inviteSeed(seedId: string, expiresInDays: number = 90, ctx?: SeedAuditCtx): Promise<{ token: string; expiresAt: Date }> {
    const seed = await prisma.$queryRaw<any[]>`
      SELECT tenant_id, status FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');
    if (seed[0].status === 'claimed') throw new Error('seed_already_claimed');

    const tokenId = generateDirectoryClaimTokenId(seed[0].tenant_id);
    const token = generateDirectoryClaimTokenString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await prisma.$executeRaw`
      INSERT INTO directory_claim_tokens (
        id, seed_id, tenant_id, token, expires_at, single_use, created_at
      ) VALUES (
        ${tokenId},
        ${seedId},
        ${seed[0].tenant_id},
        ${token},
        ${expiresAt},
        true,
        now()
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
      payload: { seedId, tenantId: seed[0].tenant_id, tokenId },
    });
    logger.info('DirectoryPresenceSeedService.inviteSeed', undefined, { seedId, tokenId });

    return { token, expiresAt };
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
      phone?: string;
      website?: string;
      businessHours?: any;
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
      SELECT tenant_id, listing_id FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) throw new Error('seed_not_found');

    const listingId = seed[0].listing_id;
    const tenantId = seed[0].tenant_id;

    // Build dynamic UPDATE for listing
    const setClauses: string[] = ['updated_at = now()'];
    const params: any[] = [];
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
    if (fields.phone !== undefined) {
      setClauses.push('phone = $' + (params.length + 1));
      params.push(fields.phone);
    }
    if (fields.website !== undefined) {
      setClauses.push('website = $' + (params.length + 1));
      params.push(fields.website);
    }
    if (fields.businessHours !== undefined) {
      setClauses.push('business_hours = $' + (params.length + 1));
      params.push(JSON.stringify(fields.businessHours));
    }

    params.push(listingId);
    await prisma.$executeRawUnsafe(
      `UPDATE directory_listings_list SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      ...params
    );

    // Upsert provenance rows
    if (provenanceUpdates) {
      for (const p of provenanceUpdates) {
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
          ON CONFLICT (seed_id, field_key) DO UPDATE SET
            value = EXCLUDED.value,
            source_name = EXCLUDED.source_name,
            source_url = EXCLUDED.source_url,
            accessed_at = EXCLUDED.accessed_at,
            confidence = EXCLUDED.confidence,
            show_on_public = EXCLUDED.show_on_public,
            updated_at = now()
        `;
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.update_fields',
      payload: { seedId, tenantId, fields: Object.keys(fields) },
    });
    logger.info('DirectoryPresenceSeedService.updateFields', undefined, { seedId });
  }
}

export default new DirectoryPresenceSeedService();
