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
  generateDirectoryEnrichmentTokenId,
  generateDirectoryEnrichmentTokenString,
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
      primaryCategory?: string | null;
      secondaryCategories?: string[];
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string | null;
      latitude?: number | null;
      longitude?: number | null;
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
      setClauses.push('business_hours = $' + (params.length + 1) + '::jsonb');
      params.push(JSON.stringify(fields.businessHours));
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

    params.push(listingId);
    await prisma.$executeRawUnsafe(
      `UPDATE directory_listings_list SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      ...params
    );

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
}

export default new DirectoryPresenceSeedService();
