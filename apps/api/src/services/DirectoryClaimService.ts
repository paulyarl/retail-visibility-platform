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
import { generateUserId, generateUserTenantId, generateTenantKey } from '../lib/id-generator';
import { authService } from '../auth/auth.service';
import { user_role } from '@prisma/client';

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
  slug: string;
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
  /** Platform user tokens — set when a customer is promoted to a platform user */
  userTokens?: { accessToken: string; refreshToken: string };
  /** True when the promoted user has no password (OAuth-only customer) */
  requiresPasswordSetup?: boolean;
  /** The platform user ID that was created or linked */
  platformUserId?: string;
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
        dl.slug,
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
      slug: r.slug,
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
   * If the caller is a customer (not yet a platform user), they are promoted:
   *   - A platform `users` row is created (or existing one reused by email)
   *   - `customers.linked_user_id` is set
   *   - A `user_tenants` OWNER row is created
   *   - Platform JWT tokens are returned so the frontend can transition auth
   *
   * If the caller is already a platform user, only the `user_tenants` OWNER
   * row is created (idempotent — skips if one already exists).
   *
   * @param token     The claim token string
   * @param userId    The authenticated user's ID (customer or platform)
   * @param isCustomer  True if the caller authenticated via customer JWT
   * @param ctx       Audit context
   */
  async acceptClaim(
    token: string,
    userId: string,
    isCustomer: boolean,
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

    // --- Customer-to-user promotion bridge ---
    let platformUserId: string | undefined;
    let userTokens: { accessToken: string; refreshToken: string } | undefined;
    let requiresPasswordSetup = false;

    if (isCustomer) {
      const promotion = await this.promoteCustomerToUser(userId, r.tenant_id, r.seed_id, ctx);
      platformUserId = promotion.platformUserId;
      userTokens = promotion.userTokens;
      requiresPasswordSetup = promotion.requiresPasswordSetup;
    } else {
      // Already a platform user — just create the user_tenants OWNER row
      platformUserId = userId;
      await this.ensureOwnerMembership(userId, r.tenant_id);
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_claim.accept',
      payload: {
        seedId: r.seed_id,
        tenantId: r.tenant_id,
        tokenId: r.token_id,
        userId,
        platformUserId,
        promoted: isCustomer,
      },
    });

    logger.info('DirectoryClaimService.acceptClaim', undefined, {
      seedId: r.seed_id,
      tenantId: r.tenant_id,
      userId,
      platformUserId,
      promoted: isCustomer,
    });

    return {
      success: true,
      tenantId: r.tenant_id,
      seedId: r.seed_id,
      message: 'claimed',
      userTokens,
      requiresPasswordSetup,
      platformUserId,
    };
  }

  /**
   * Promote a customer to a platform user and create an OWNER membership.
   *
   * - If the customer already has `linked_user_id`, reuse that user.
   * - Else if a `users` row with the same email exists, link to it.
   * - Else create a new `users` row (copying password_hash so the same
   *   password works; if the customer is OAuth-only with no password_hash,
   *   sets `requiresPasswordSetup = true`).
   *
   * Always creates (or ensures) a `user_tenants` OWNER row for the tenant.
   * Returns platform JWT tokens so the frontend can transition to platform auth.
   */
  private async promoteCustomerToUser(
    customerId: string,
    tenantId: string,
    seedId: string,
    ctx?: ClaimAuditCtx
  ): Promise<{
    platformUserId: string;
    userTokens: { accessToken: string; refreshToken: string };
    requiresPasswordSetup: boolean;
  }> {
    // Load customer
    const customerRows = await prisma.$queryRaw<any[]>`
      SELECT id, email, first_name, last_name, password_hash, email_verified, linked_user_id
      FROM customers WHERE id = ${customerId} LIMIT 1
    `;
    if (!customerRows[0]) {
      throw new Error('customer_not_found');
    }
    const customer = customerRows[0];
    const emailLower = (customer.email as string).toLowerCase();

    let platformUserId: string;
    let requiresPasswordSetup = false;

    // 1. If customer already has linked_user_id, reuse it
    if (customer.linked_user_id) {
      platformUserId = customer.linked_user_id;
    } else {
      // 2. Check if a platform user with the same email already exists
      const existingUser = await prisma.$queryRaw<any[]>`
        SELECT id FROM users WHERE email = ${emailLower} LIMIT 1
      `;
      if (existingUser[0]) {
        platformUserId = existingUser[0].id;
        // Link the customer to the existing user
        await prisma.$executeRaw`
          UPDATE customers SET linked_user_id = ${platformUserId}, updated_at = now()
          WHERE id = ${customerId}
        `;
      } else {
        // 3. Create a new platform user
        platformUserId = generateUserId();
        const hasPassword = !!customer.password_hash;
        requiresPasswordSetup = !hasPassword;

        await prisma.$executeRaw`
          INSERT INTO users (
            id, email, password_hash, first_name, last_name,
            role, email_verified, is_active,
            onboarding_completed, onboarding_step, onboarding_data,
            created_at, updated_at
          ) VALUES (
            ${platformUserId},
            ${emailLower},
            ${customer.password_hash || ''},
            ${customer.first_name || null},
            ${customer.last_name || null},
            ${user_role.USER}::"user_role",
            ${customer.email_verified ?? false},
            true,
            false,
            'directory_claim_welcome',
            ${JSON.stringify({ claimedViaDirectory: true, seedId, tenantId })}::jsonb,
            now(), now()
          )
        `;

        // Link the customer to the new user
        await prisma.$executeRaw`
          UPDATE customers SET linked_user_id = ${platformUserId}, updated_at = now()
          WHERE id = ${customerId}
        `;

        audit({
          actor: ctx?.actorId,
          actorType: ctx?.actorType,
          action: 'directory_claim.promote_customer_to_user',
          payload: { customerId, platformUserId, tenantId, seedId, requiresPasswordSetup: !hasPassword },
        });
      }
    }

    // Create OWNER membership (idempotent)
    await this.ensureOwnerMembership(platformUserId, tenantId);

    // Generate platform JWT tokens
    const tenantIds = await this.getUserTenantIds(platformUserId);
    const payload = {
      id: platformUserId,
      userId: platformUserId,
      email: emailLower,
      role: user_role.USER,
      tenantIds,
      first_name: customer.first_name || null,
      last_name: customer.last_name || null,
    };

    const accessToken = authService.generateAccessToken(payload);
    const refreshToken = authService.generateRefreshToken(payload);

    return { platformUserId, userTokens: { accessToken, refreshToken }, requiresPasswordSetup };
  }

  /**
   * Create a user_tenants OWNER row if one doesn't already exist.
   * Idempotent — safe to call multiple times.
   */
  private async ensureOwnerMembership(userId: string, tenantId: string): Promise<void> {
    const existing = await prisma.$queryRaw<any[]>`
      SELECT 1 FROM user_tenants WHERE user_id = ${userId} AND tenant_id = ${tenantId} LIMIT 1
    `;
    if (existing[0]) return;

    const utid = generateUserTenantId(userId, tenantId);
    await prisma.$executeRaw`
      INSERT INTO user_tenants (id, user_id, tenant_id, role, created_at, updated_at)
      VALUES (${utid}, ${userId}, ${tenantId}, 'OWNER'::"user_tenant_role", now(), now())
      ON CONFLICT (user_id, tenant_id) DO NOTHING
    `;
  }

  /**
   * Get all tenant IDs for a platform user.
   */
  private async getUserTenantIds(userId: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT tenant_id FROM user_tenants WHERE user_id = ${userId}
    `;
    return rows.map((r) => r.tenant_id);
  }
}

export default new DirectoryClaimService();
