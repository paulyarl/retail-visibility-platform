/**
 * DirectoryClaimService — public-facing claim flow for directory presence seeds.
 *
 * Flow:
 *   1. GET /api/public/directory/claim/:token — token summary (no auth)
 *   2. POST /api/public/directory/claim/:token/accept — bind owner (requires auth)
 *
 * Claim converts org_standing_mode from 'directory_seed' to 'independent'
 * without wiping the listing or tenant identity. The tenant keeps its
 * directory_presence tier until the owner upgrades.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
/** Audit context for claim operations */
interface ClaimAuditCtx {
  actorType?: 'user' | 'system' | 'integration' | 'customer';
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

export interface ClaimTokenSummary {
  seedId: string;
  tenantId: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
  address: string;
  phone: string | null;
  snapEbtReported: boolean;
  isExpired: boolean;
  isConsumed: boolean;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface ClaimResult {
  success: boolean;
  tenantId: string;
  seedId: string;
  message: string;
}

class DirectoryClaimService {
  /**
   * Get a public summary of a claim token. Does not require auth.
   * Returns only public-facing fields (no tenant ID, no internal state).
   */
  async getTokenSummary(token: string): Promise<ClaimTokenSummary | null> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dct.id AS token_id,
        dct.seed_id,
        dct.tenant_id,
        dct.expires_at,
        dct.consumed_at,
        dps.category,
        dps.city,
        dps.state,
        dl.business_name,
        dl.address,
        dl.phone,
        dl.snap_ebt_reported
      FROM directory_claim_tokens dct
      JOIN directory_presence_seeds dps ON dps.id = dct.seed_id
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dct.token = ${token}
      LIMIT 1
    `;

    if (!rows[0]) return null;

    const r = rows[0];
    const now = new Date();
    const expiresAt = new Date(r.expires_at);

    return {
      seedId: r.seed_id,
      tenantId: r.tenant_id,
      businessName: r.business_name,
      category: r.category,
      city: r.city,
      state: r.state,
      address: r.address,
      phone: r.phone,
      snapEbtReported: r.snap_ebt_reported ?? false,
      isExpired: now > expiresAt,
      isConsumed: !!r.consumed_at,
      expiresAt,
      consumedAt: r.consumed_at ? new Date(r.consumed_at) : null,
    };
  }

  /**
   * Accept a claim token. Binds the claiming user to the tenant.
   * Converts org_standing_mode from 'directory_seed' to 'independent'.
   *
   * The caller must provide the authenticated user ID (from customer auth
   * or platform auth, depending on the flow being used).
   */
  async acceptClaim(
    token: string,
    userId: string,
    ctx?: ClaimAuditCtx
  ): Promise<ClaimResult> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dct.id AS token_id,
        dct.seed_id,
        dct.tenant_id,
        dct.expires_at,
        dct.consumed_at,
        dct.single_use,
        dps.status AS seed_status
      FROM directory_claim_tokens dct
      JOIN directory_presence_seeds dps ON dps.id = dct.seed_id
      WHERE dct.token = ${token}
      FOR UPDATE
    `;

    if (!rows[0]) {
      return { success: false, tenantId: '', seedId: '', message: 'invalid_token' };
    }

    const r = rows[0];
    const now = new Date();
    const expiresAt = new Date(r.expires_at);

    if (r.consumed_at && r.single_use) {
      return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'already_claimed' };
    }

    if (now > expiresAt) {
      return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'token_expired' };
    }

    if (r.seed_status === 'claimed') {
      return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'already_claimed' };
    }

    // Consume the token
    await prisma.$executeRaw`
      UPDATE directory_claim_tokens
      SET consumed_at = now(), consumed_by = ${userId}
      WHERE id = ${r.token_id}
    `;

    // Convert tenant from directory_seed to independent
    await prisma.$executeRaw`
      UPDATE tenants
      SET org_standing_mode = 'independent', updated_at = now()
      WHERE id = ${r.tenant_id}
    `;

    // Update seed status
    await prisma.$executeRaw`
      UPDATE directory_presence_seeds
      SET status = 'claimed', claimed_at = now(), updated_at = now()
      WHERE id = ${r.seed_id}
    `;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_claim.accept',
      payload: { seedId: r.seed_id, tenantId: r.tenant_id, tokenId: r.token_id, userId },
    });

    logger.info('DirectoryClaimService.acceptClaim', undefined, {
      seedId: r.seed_id,
      tenantId: r.tenant_id,
      userId,
    });

    return {
      success: true,
      tenantId: r.tenant_id,
      seedId: r.seed_id,
      message: 'claimed',
    };
  }
}

export default new DirectoryClaimService();
