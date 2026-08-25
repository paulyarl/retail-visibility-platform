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
import { generateUserId, generateUserTenantId, generateTenantKey, generateDirectoryClaimRequestId } from '../lib/id-generator';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import { authService } from '../auth/auth.service';
import { user_role } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/** Audit context for claim operations */
interface ClaimAuditCtx {
  actorType?: 'user' | 'system' | 'integration' | 'customer';
  actorId?: string;
  ip?: string;
  userAgent?: string;
  /** Customer email (for operator-approval request display) */
  customerEmail?: string;
  /** Customer display name (for operator-approval request display) */
  customerName?: string;
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

export interface InitiateClaimResult {
  verificationRequired: boolean;
  sentTo?: string;
  operatorApprovalRequired?: boolean;
  requestId?: string;
  error?: string;
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
   * Initiate a claim. If the token is bound to an email/phone and
   * verification_required is true, an OTP is generated and sent.
   * If the token is unbound and operator_approval_required is true,
   * the claim will be held for operator manual approval.
   *
   * Returns verification requirements so the frontend can show the
   * appropriate UI (OTP entry or pending approval message).
   */
  async initiateClaim(
    token: string,
    ctx?: ClaimAuditCtx,
  ): Promise<InitiateClaimResult> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dct.id AS token_id,
        dct.bound_email,
        dct.bound_phone,
        dct.verification_required,
        dct.operator_approval_required,
        dct.expires_at,
        dct.consumed_at,
        dct.single_use,
        dps.status AS seed_status,
        dps.id AS seed_id,
        dps.tenant_id
      FROM directory_claim_tokens dct
      JOIN directory_presence_seeds dps ON dps.id = dct.seed_id
      WHERE dct.token = ${token}
      LIMIT 1
    `;

    if (!rows[0]) {
      return { verificationRequired: false, error: 'invalid_token' };
    }

    const r = rows[0];
    const now = new Date();
    const expiresAt = new Date(r.expires_at);

    if (r.consumed_at && r.single_use) {
      return { verificationRequired: false, error: 'already_claimed' };
    }
    if (now > expiresAt) {
      return { verificationRequired: false, error: 'token_expired' };
    }
    if (r.seed_status === 'claimed') {
      return { verificationRequired: false, error: 'already_claimed' };
    }

    // If verification required, generate + send OTP
    if (r.verification_required && (r.bound_email || r.bound_phone)) {
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const codeHash = await bcrypt.hash(otpCode, 10);
      const otpId = `dco-${generateTenantKey(r.tenant_id)}-${crypto.randomBytes(6).toString('hex')}`;
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate any previous active OTPs for this token
      await prisma.$executeRaw`
        UPDATE directory_claim_otps
        SET consumed_at = now()
        WHERE token_id = ${r.token_id} AND consumed_at IS NULL
      `;

      // Insert new OTP
      const deliveryMethod = r.bound_email ? 'email' : 'sms';
      const deliveryTarget = r.bound_email || r.bound_phone;

      await prisma.$executeRaw`
        INSERT INTO directory_claim_otps (
          id, token_id, code_hash, delivery_method, delivery_target,
          expires_at, consumed_at, attempts, created_at
        ) VALUES (
          ${otpId},
          ${r.token_id},
          ${codeHash},
          ${deliveryMethod},
          ${deliveryTarget},
          ${otpExpiresAt},
          NULL,
          0,
          now()
        )
      `;

      // Send OTP via email (SMS not yet integrated — log for now)
      if (deliveryMethod === 'email') {
        try {
          const { emailService } = await import('../services/email-service.js');
          await emailService.sendEmail({
            to: deliveryTarget,
            subject: 'Your Directory Claim Verification Code',
            text: `Your verification code is: ${otpCode}. It expires in 10 minutes.`,
            html: `<p>Your verification code is: <strong>${otpCode}</strong></p><p>It expires in 10 minutes.</p>`,
          } as any);
        } catch (err) {
          logger.error('DirectoryClaimService.initiateClaim — email send failed', undefined, {
            error: (err as Error).message,
          });
          // Don't fail the initiation — the OTP is stored, operator can resend
        }
      } else {
        // SMS not yet integrated — log the code for development
        logger.info('DirectoryClaimService.initiateClaim — SMS OTP (not yet integrated)', undefined, {
          seedId: r.seed_id,
          deliveryTarget: this.maskTarget(deliveryTarget),
        });
      }

      audit({
        actor: ctx?.actorId,
        actorType: ctx?.actorType,
        action: 'directory_claim.initiate_otp',
        payload: { seedId: r.seed_id, tenantId: r.tenant_id, tokenId: r.token_id, deliveryMethod },
      });

      return {
        verificationRequired: true,
        sentTo: this.maskTarget(deliveryTarget),
      };
    }

    // No verification required — check if operator approval is needed
    if (r.operator_approval_required) {
      // Persist a pending claim request so operators can review it.
      // Idempotent: if a pending request already exists for this token,
      // return the existing one rather than creating a duplicate.
      const existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM directory_claim_requests
        WHERE token_id = ${r.token_id} AND status = 'pending'
        LIMIT 1
      `;

      let requestId: string;
      if (existing[0]) {
        requestId = existing[0].id;
      } else {
        requestId = generateDirectoryClaimRequestId(r.tenant_id);
        await prisma.$executeRaw`
          INSERT INTO directory_claim_requests (
            id, seed_id, tenant_id, token_id,
            customer_id, customer_email, customer_name,
            status, submitted_at
          ) VALUES (
            ${requestId},
            ${r.seed_id},
            ${r.tenant_id},
            ${r.token_id},
            ${ctx?.actorId || null},
            ${ctx?.customerEmail || null},
            ${ctx?.customerName || null},
            'pending',
            now()
          )
        `;

        // Fire a platform-scoped CRM alert so operators see it in their feed
        try {
          const { generateCrmAlertId } = await import('../lib/id-generator.js');
          await prisma.$executeRaw`
            INSERT INTO crm_alerts (
              id, tenant_id, type, title, body, icon, is_read, is_dismissed, metadata, created_at
            ) VALUES (
              ${generateCrmAlertId(PLATFORM_SCOPE)},
              ${PLATFORM_SCOPE},
              'directory_claim_pending',
              'Pending directory claim request',
              ${`A business owner has submitted a claim request for a directory listing. Review and approve at Settings → Directory → Presence Seeds.`},
              'clock',
              false,
              false,
              ${JSON.stringify({ requestId, seedId: r.seed_id, tenantId: r.tenant_id })}::jsonb,
              now()
            )
          `;
        } catch (alertErr) {
          logger.error('DirectoryClaimService.initiateClaim — CRM alert insert failed', undefined, {
            error: (alertErr as Error).message,
          });
          // Non-fatal — the request row is already persisted
        }

        audit({
          actor: ctx?.actorId,
          actorType: ctx?.actorType,
          action: 'directory_claim.submit_approval_request',
          payload: { seedId: r.seed_id, tenantId: r.tenant_id, tokenId: r.token_id, requestId },
        });
      }

      return {
        verificationRequired: false,
        operatorApprovalRequired: true,
        requestId,
      };
    }

    // No verification, no approval — direct claim
    return { verificationRequired: false };
  }

  /**
   * Mask an email or phone for display in API responses.
   * Email: j***@gmail.com
   * Phone: ***-***-1234
   */
  private maskTarget(target: string): string {
    if (target.includes('@')) {
      const [local, domain] = target.split('@');
      return `${local[0]}***@${domain}`;
    }
    // Phone — show last 4 digits
    const digits = target.replace(/\D/g, '');
    return `***-***-${digits.slice(-4)}`;
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
    ctx?: ClaimAuditCtx,
    otpCode?: string,
  ): Promise<ClaimResult> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dct.id AS token_id,
        dct.seed_id,
        dct.tenant_id,
        dct.expires_at,
        dct.consumed_at,
        dct.single_use,
        dct.verification_required,
        dct.operator_approval_required,
        dct.bound_email,
        dct.bound_phone,
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

    // OTP verification (if verification_required)
    if (r.verification_required && (r.bound_email || r.bound_phone)) {
      if (!otpCode) {
        return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'otp_required' };
      }

      // Load the active OTP for this token
      const otpRows = await prisma.$queryRaw<any[]>`
        SELECT id, code_hash, expires_at, consumed_at, attempts
        FROM directory_claim_otps
        WHERE token_id = ${r.token_id} AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!otpRows[0]) {
        return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'otp_not_found' };
      }

      const otp = otpRows[0];
      const otpExpiresAt = new Date(otp.expires_at);

      if (now > otpExpiresAt) {
        return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'otp_expired' };
      }

      if (otp.attempts >= 3) {
        // Invalidate the OTP
        await prisma.$executeRaw`
          UPDATE directory_claim_otps SET consumed_at = now() WHERE id = ${otp.id}
        `;
        return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'otp_max_attempts' };
      }

      const codeMatches = await bcrypt.compare(otpCode, otp.code_hash);
      if (!codeMatches) {
        // Increment attempts
        await prisma.$executeRaw`
          UPDATE directory_claim_otps SET attempts = attempts + 1 WHERE id = ${otp.id}
        `;
        const remaining = 3 - (otp.attempts + 1);
        return {
          success: false,
          tenantId: r.tenant_id,
          seedId: r.seed_id,
          message: remaining > 0 ? 'invalid_otp' : 'otp_max_attempts',
        };
      }

      // OTP valid — consume it
      await prisma.$executeRaw`
        UPDATE directory_claim_otps SET consumed_at = now() WHERE id = ${otp.id}
      `;
    }

    // Operator approval required (unbound token)
    if (r.operator_approval_required && !r.verification_required) {
      // Create a pending claim record — the operator will approve/reject
      // For now, we return a pending state. The actual approval flow
      // will be handled by admin endpoints.
      return {
        success: false,
        tenantId: r.tenant_id,
        seedId: r.seed_id,
        message: 'pending_operator_approval',
      };
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

  // ─── Operator approval: list / approve / reject ──────────────────────

  /**
   * List claim requests for the admin review queue.
   * Optionally filtered by status (default: pending).
   */
  async listClaimRequests(filters?: { status?: string }): Promise<any[]> {
    const status = filters?.status || 'pending';
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dcr.id,
        dcr.seed_id,
        dcr.tenant_id,
        dcr.token_id,
        dcr.customer_id,
        dcr.customer_email,
        dcr.customer_name,
        dcr.status,
        dcr.rejection_reason,
        dcr.submitted_at,
        dcr.reviewed_at,
        dcr.reviewed_by,
        dps.category,
        dl.business_name,
        dl.address,
        dps.city,
        dps.state
      FROM directory_claim_requests dcr
      JOIN directory_presence_seeds dps ON dps.id = dcr.seed_id
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dcr.status = ${status}
      ORDER BY dcr.submitted_at DESC
    `;
    return rows.map((r) => ({
      id: r.id,
      seedId: r.seed_id,
      tenantId: r.tenant_id,
      tokenId: r.token_id,
      customerId: r.customer_id,
      customerEmail: r.customer_email,
      customerName: r.customer_name,
      status: r.status,
      rejectionReason: r.rejection_reason,
      submittedAt: r.submitted_at,
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by,
      businessName: r.business_name,
      category: r.category,
      address: r.address,
      city: r.city,
      state: r.state,
    }));
  }

  /**
   * Approve a pending claim request.
   * Consumes the token, flips org_standing_mode to 'independent', promotes
   * the customer to a platform user, and updates the request status.
   */
  async approveClaimRequest(
    requestId: string,
    adminUserId: string,
    ctx?: ClaimAuditCtx,
  ): Promise<ClaimResult> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dcr.id,
        dcr.seed_id,
        dcr.tenant_id,
        dcr.token_id,
        dcr.customer_id,
        dcr.status,
        dct.expires_at,
        dct.consumed_at,
        dct.single_use,
        dps.status AS seed_status
      FROM directory_claim_requests dcr
      JOIN directory_claim_tokens dct ON dct.id = dcr.token_id
      JOIN directory_presence_seeds dps ON dps.id = dcr.seed_id
      WHERE dcr.id = ${requestId}
      FOR UPDATE
    `;

    if (!rows[0]) {
      return { success: false, tenantId: '', seedId: '', message: 'request_not_found' };
    }

    const r = rows[0];

    if (r.status !== 'pending') {
      return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'request_already_reviewed' };
    }

    if (r.seed_status === 'claimed') {
      return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'already_claimed' };
    }

    const now = new Date();
    const expiresAt = new Date(r.expires_at);

    if (r.consumed_at && r.single_use) {
      return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'already_claimed' };
    }

    if (now > expiresAt) {
      return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'token_expired' };
    }

    // Consume the token
    await prisma.$executeRaw`
      UPDATE directory_claim_tokens
      SET consumed_at = now(), consumed_by = ${adminUserId}
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

    // Update request status
    await prisma.$executeRaw`
      UPDATE directory_claim_requests
      SET status = 'approved', reviewed_at = now(), reviewed_by = ${adminUserId}
      WHERE id = ${requestId}
    `;

    // Promote customer to platform user if we have a customer_id
    let platformUserId: string | undefined;
    let userTokens: { accessToken: string; refreshToken: string } | undefined;
    let requiresPasswordSetup = false;

    if (r.customer_id) {
      const promotion = await this.promoteCustomerToUser(r.customer_id, r.tenant_id, r.seed_id, ctx);
      platformUserId = promotion.platformUserId;
      userTokens = promotion.userTokens;
      requiresPasswordSetup = promotion.requiresPasswordSetup;
    }

    audit({
      actor: adminUserId,
      actorType: 'user',
      action: 'directory_claim.approve_request',
      payload: { requestId, seedId: r.seed_id, tenantId: r.tenant_id, customerId: r.customer_id, platformUserId },
    });

    logger.info('DirectoryClaimService.approveClaimRequest', undefined, {
      requestId, seedId: r.seed_id, tenantId: r.tenant_id, customerId: r.customer_id, platformUserId,
    });

    return {
      success: true,
      tenantId: r.tenant_id,
      seedId: r.seed_id,
      message: 'approved',
      userTokens,
      requiresPasswordSetup,
      platformUserId,
    };
  }

  /**
   * Reject a pending claim request.
   * Marks the token as consumed (revoked) and updates the request status.
   */
  async rejectClaimRequest(
    requestId: string,
    adminUserId: string,
    reason: string,
    ctx?: ClaimAuditCtx,
  ): Promise<{ success: boolean; message: string }> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, token_id, tenant_id, seed_id, status
      FROM directory_claim_requests
      WHERE id = ${requestId}
      FOR UPDATE
    `;

    if (!rows[0]) {
      return { success: false, message: 'request_not_found' };
    }

    const r = rows[0];

    if (r.status !== 'pending') {
      return { success: false, message: 'request_already_reviewed' };
    }

    // Revoke the token so it can't be used
    await prisma.$executeRaw`
      UPDATE directory_claim_tokens
      SET consumed_at = now(), consumed_by = ${`platform:rejected:${adminUserId}`}
      WHERE id = ${r.token_id}
    `;

    // Update request status
    await prisma.$executeRaw`
      UPDATE directory_claim_requests
      SET status = 'rejected', reviewed_at = now(), reviewed_by = ${adminUserId},
          rejection_reason = ${reason || null}
      WHERE id = ${requestId}
    `;

    audit({
      actor: adminUserId,
      actorType: 'user',
      action: 'directory_claim.reject_request',
      payload: { requestId, seedId: r.seed_id, tenantId: r.tenant_id, reason },
    });

    return { success: true, message: 'rejected' };
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
