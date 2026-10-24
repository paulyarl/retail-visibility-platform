/**
 * DirectoryClaimService — public-facing claim flow for directory presence seeds.
 *
 * Flow:
 *   1. GET /api/public/directory/claim/:token — token summary (no auth)
 *   2. POST /api/public/directory/claim/:token/accept — bind owner (requires auth)
 *
 * Claim converts org_standing_mode from 'directory_seed' to 'independent'
 * and listing_origin from 'directory_seed' to 'claimed' so the public URL
 * moves from /place/{slug} to /directory/{slug}. The tenant keeps its
 * directory_presence tier until the owner upgrades; claimed-only
 * capabilities arrive as seed_claim promo grants (tenant_feature_purchases),
 * never as tier keys — see applySeedClaimGrants.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import { generateUserId, generateUserTenantId, generateTenantKey, generateDirectoryClaimRequestId, generateDirectoryClaimRequestVerificationId } from '../lib/id-generator';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import { authService } from '../auth/auth.service';
import { user_role } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import CrmTicketService from './CrmTicketService';
import CrmTicketMessageService from './CrmTicketMessageService';
import { buildTenantUpgradeOptions, UpgradeOptionsPayload } from './DirectoryPresenceUpgradeOptionsService';
import { MarketIntelAccessService } from './MarketIntelAccessService';
import { invalidateEffectiveCapabilities } from './EffectiveCapabilityResolver';
import { slugifyAttributeKey, type DirectoryListingAttribute } from './directory/listingAttributes';

/**
 * Seed-claim promo grants — capability features unlocked by the claim event
 * itself (not by tier, so they never reach unclaimed `directory_presence`
 * seeds). Written as `tenant_feature_purchases` rows (source `seed_claim`)
 * so the effective-capability merge treats them exactly like a manual
 * complimentary grant. Extend this list to add future claim promos.
 */
const SEED_CLAIM_PROMO_GRANTS: readonly string[] = [
  // Flyer — directory + place surfaces only; flyer_flexible is the upsell.
  'flyer_on',
  'flyer_directory_on',
  'flyer_place_on',
  'flyer_items_5',
  // Storefront QR — classic renderer, directory-entry target, 512px only.
  // Deliberately NOT storefront_qr_on (it sweeps every content type +
  // resolution): storefront_qr_flexible is the upsell for styled renderer,
  // logo, custom colors/gradients, hi-res, analytics.
  'storefront_qr_classic_on',
  'storefront_qr_directory',
  'storefront_qr_resolution_512',
];

/** Claim promo duration — one year from claim. */
const SEED_CLAIM_PROMO_DAYS = 365;

/** Sources that represent money attached — a claim promo never overwrites them. */
const PAID_PURCHASE_SOURCES = ['bsaas', 'bsaas_bundle', 'addon', 'tier_overage'];

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
  /** Claimant's first name (verification worksheet) */
  claimantFirstName?: string;
  /** Claimant's middle name */
  claimantMiddleName?: string;
  /** Claimant's last name */
  claimantLastName?: string;
  /** Claimant's phone number (for operator verification call/text) */
  claimantPhone?: string;
  /** Claimant's stated business address (optional, for cross-reference) */
  claimantBusinessAddress?: string;
  /** True only for identity already proven elsewhere: platform (Auth0)
   *  users, or customers whose email is verified (OAuth — password
   *  customers register with email_verified=false). Anything else —
   *  unverified customers, body/header-supplied identity, anonymous —
   *  must confirm their email before a claim request is filed
   *  (migration 358). */
  claimantEmailVerified?: boolean;
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
  zipCode: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  /** Listing logo — shown on the claim page and offered for owner upload. */
  logoUrl: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryCategory: string | null;
  secondaryCategories: string[];
  businessHours: any;
  snapEbtReported: boolean;
  snapEbtAsOf: Date | null;
  snapEbtSource: string | null;
  snapEbtSourceName: string | null;
  /** Sourced attribute chips on the listing (migration 267) — shown on the
   *  claim page's verify step so the owner can accept or reject each one. */
  attributes: DirectoryListingAttribute[];
  /** Stamp of the owner's claim-time consent (migration 274). */
  ownerVerifiedAt: Date | null;
  /** Owner-typed category labels awaiting operator acceptance (abuse gate —
   *  only 'pending' entries are surfaced to the claim page). */
  ownerProposedCategories: OwnerProposedCategory[];
  isExpired: boolean;
  isConsumed: boolean;
  expiresAt: Date;
  consumedAt: Date | null;
  /** Latest operator-review state for this token's claim request. 'rejected'
   *  lets the claim page show an honest "not approved" state instead of the
   *  misleading Already Claimed screen; 'pending' restores the review screen
   *  for a claimant revisiting their link. */
  claimRequestStatus: 'pending' | 'approved' | 'rejected' | null;
  /** A live claimant email verification exists for this token (migration
   *  358) — the claim page restores the "check your email" screen on
   *  revisit instead of the submit form. */
  claimEmailVerificationPending: boolean;
  /** Masked email the live verification was sent to (e.g. j***@gmail.com). */
  claimVerificationSentTo: string | null;
  /** Wedge-fidelity verdict (project-phase spec §4/§6). 'misaligned' tells the
   *  claim landing page to render the inquiry path instead of the claim form —
   *  a stale link degrades safely rather than inviting a claim on bad data. */
  seedFidelity: 'aligned' | 'thin' | 'misaligned' | 'unknown';
}

/** An owner-typed category label held for operator acceptance (migration 274). */
export interface OwnerProposedCategory {
  label: string;
  role: 'primary' | 'secondary';
  status: 'pending' | 'accepted' | 'rejected';
  proposedAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
}

/**
 * Claim-time verification payload (migration 274). The claim page requires
 * the owner to confirm categories + attributes before submit — the
 * confirmation is a contract of consent minted on the seed.
 *
 * Categories the owner types that are NOT in the platform/vocab set are
 * held as owner_proposed_categories (operator acceptance required) rather
 * than written to the listing — this is the abuse gate.
 */
export interface OwnerClaimVerification {
  /** Owner-confirmed primary category (must be a known vocab/platform label). */
  primaryCategory: string;
  /** Owner-accepted secondary labels. Unknown labels are diverted to
   *  owner_proposed_categories instead of the listing. */
  secondaryCategories: string[];
  /** Owner-typed new labels (role: secondary). Belt-and-suspenders alongside
   *  server-side vocab validation — anything not in vocab lands here. */
  proposedCategories?: string[];
  /** Final desired attribute set — owner is authoritative. Sourced chips the
   *  owner left off are removed; entries not previously on the listing are
   *  minted with sourcePlatform 'owner_confirmed'. */
  attributes: Array<{ key?: string; label: string }>;
  /** Explicit consent flag — must be true. */
  confirmed: boolean;
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
  /** Gateway upgrade preview (claim handoff spec) — embedded so the success screen can render Entry Presence mode cards without a platform (Auth0) session */
  currentTier?: UpgradeOptionsPayload['currentTier'];
  isGatewayUpgrade?: boolean;
  upgradeOptions?: UpgradeOptionsPayload['upgradeOptions'];
  /** Feature keys unlocked by the claim promo grant (source 'seed_claim'). */
  claimGrants?: string[];
}

export interface InitiateClaimResult {
  verificationRequired: boolean;
  sentTo?: string;
  operatorApprovalRequired?: boolean;
  /** True when the claim request is held until the claimant clicks the
   *  email confirmation link — proof-of-inbox before the request reaches
   *  the operator queue (migration 358). `sentTo` carries the masked
   *  target. */
  claimantVerificationRequired?: boolean;
  requestId?: string;
  /** True when the claim cannot proceed because the owner has not yet
   *  submitted the required business-info verification (categories +
   *  attributes consent gate, migration 274). */
  ownerVerificationRequired?: boolean;
  /** Labels diverted to operator review (owner-typed categories not in the
   *  platform/vocab set). Returned so the UI can tell the owner these are
   *  pending rather than live. */
  proposedCategories?: string[];
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
        dps.notes,
        dps.seed_fidelity,
        dl.slug,
        dl.business_name,
        dl.address,
        dl.zip_code,
        dl.phone,
        dl.website,
        dl.email,
        dl.logo_url,
        dl.latitude,
        dl.longitude,
        dl.primary_category,
        dl.secondary_categories,
        dl.business_hours,
        dl.snap_ebt_reported,
        dl.snap_ebt_as_of,
        dl.snap_ebt_source,
        dl.snap_ebt_source_name,
        dl.attributes,
        dps.owner_verified_at,
        dps.owner_proposed_categories
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

    // Latest operator-review state for this token — a rejected request leaves
    // the token consumed (revoked), which is indistinguishable from a real
    // claim without this status.
    const requestRows = await prisma.$queryRaw<any[]>`
      SELECT status FROM directory_claim_requests
      WHERE token_id = ${r.token_id}
      ORDER BY submitted_at DESC
      LIMIT 1
    `;
    const claimRequestStatus = ['pending', 'approved', 'rejected'].includes(requestRows[0]?.status)
      ? (requestRows[0].status as 'pending' | 'approved' | 'rejected')
      : null;

    // Live claimant email verification (migration 358) — restores the
    // "check your email" screen for a claimant revisiting their link.
    // Non-fatal: if migration 358 hasn't been applied in this env yet the
    // summary still resolves (claim links must not 500 on a missing table).
    let pendingVerification: { claimant_email: string } | null = null;
    try {
      const verificationRows = await prisma.$queryRaw<any[]>`
        SELECT claimant_email FROM directory_claim_request_verifications
        WHERE token_id = ${r.token_id}
          AND verified = FALSE
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      pendingVerification = verificationRows[0] ?? null;
    } catch (err) {
      logger.warn('DirectoryClaimService.getTokenSummary — verification lookup failed (migration 358 pending?)', undefined, {
        error: (err as Error).message,
      });
    }

    return {
      seedId: r.seed_id,
      tenantId: r.tenant_id,
      slug: r.slug,
      businessName: r.business_name,
      category: r.category,
      city: r.city,
      state: r.state,
      address: r.address,
      notes: r.notes,
      zipCode: r.zip_code,
      phone: r.phone,
      website: r.website,
      email: r.email,
      logoUrl: r.logo_url ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
      primaryCategory: r.primary_category,
      secondaryCategories: r.secondary_categories || [],
      businessHours: r.business_hours,
      snapEbtReported: r.snap_ebt_reported ?? false,
      snapEbtAsOf: r.snap_ebt_as_of ? new Date(r.snap_ebt_as_of) : null,
      snapEbtSource: r.snap_ebt_source,
      snapEbtSourceName: r.snap_ebt_source_name,
      attributes: Array.isArray(r.attributes) ? r.attributes : [],
      ownerVerifiedAt: r.owner_verified_at ? new Date(r.owner_verified_at) : null,
      ownerProposedCategories: (Array.isArray(r.owner_proposed_categories) ? r.owner_proposed_categories : [])
        .map((p: any) => ({
          label: String(p?.label ?? ''),
          role: p?.role === 'primary' ? 'primary' : 'secondary',
          status: ['pending', 'accepted', 'rejected'].includes(p?.status) ? p.status : 'pending',
          proposedAt: p?.proposed_at ?? null,
          decidedAt: p?.decided_at ?? null,
          decidedBy: p?.decided_by ?? null,
        }))
        .filter((p: OwnerProposedCategory) => p.label && p.status === 'pending'),
      isExpired: now > expiresAt,
      isConsumed: !!r.consumed_at,
      expiresAt,
      consumedAt: r.consumed_at ? new Date(r.consumed_at) : null,
      claimRequestStatus,
      claimEmailVerificationPending: !!pendingVerification,
      claimVerificationSentTo: pendingVerification ? this.maskTarget(pendingVerification.claimant_email) : null,
      seedFidelity: ['aligned', 'thin', 'misaligned', 'unknown'].includes(r.seed_fidelity)
        ? r.seed_fidelity
        : 'unknown',
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
    verification?: OwnerClaimVerification,
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
        dps.tenant_id,
        dps.listing_id,
        dps.owner_verified_at
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

    // ── Owner verification consent gate (migration 274) ────────────────
    // The owner must confirm categories + attributes before the claim can
    // be initiated. Once minted (owner_verified_at set) the gate is
    // satisfied — OTP resends and repeat initiates pass through without a
    // fresh payload.
    let proposedCategories: string[] | undefined;
    if (!r.owner_verified_at) {
      if (!verification) {
        return {
          verificationRequired: false,
          ownerVerificationRequired: true,
          error: 'verification_required',
        };
      }
      if (!verification.confirmed) {
        return { verificationRequired: false, error: 'verification_not_confirmed' };
      }
      const applied = await this.applyOwnerVerification(r, verification, ctx);
      if (applied.error) {
        return { verificationRequired: false, error: applied.error };
      }
      proposedCategories = applied.proposed;
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
          const { unifiedConfig } = await import('../config/unifiedConfig');
          await emailService.sendEmail({
            to: deliveryTarget,
            from: unifiedConfig.emailReplyTo,
            fromName: 'Claims',
            replyTo: unifiedConfig.emailReplyTo,
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
        proposedCategories,
      };
    }

    // No verification required — check if operator approval is needed
    if (r.operator_approval_required) {
      // Claimant email must be proven before a request enters the operator
      // queue (migration 358): platform users and customers with
      // email_verified=true are already proven; everyone else confirms
      // their inbox via a verification link — the pending request (and its
      // operator notifications) only exists after that click. Self-asserted
      // body/header identity is NOT proof — ctx.claimantEmailVerified is
      // only set for middleware- or JWT-verified identity.
      if (ctx?.claimantEmailVerified !== true) {
        const claimantEmail = ctx?.customerEmail?.trim().toLowerCase();
        if (!claimantEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claimantEmail)) {
          return {
            verificationRequired: false,
            error: 'claimant_email_required',
            proposedCategories,
          };
        }
        try {
          await this.createOrResendClaimVerification(r, claimantEmail, ctx);
        } catch (err) {
          logger.error('DirectoryClaimService.initiateClaim — claim verification email failed', undefined, {
            error: (err as Error).message,
          });
          return { verificationRequired: false, error: 'email_send_failed' };
        }
        return {
          verificationRequired: false,
          operatorApprovalRequired: true,
          claimantVerificationRequired: true,
          sentTo: this.maskTarget(claimantEmail),
          proposedCategories,
        };
      }

      const { requestId } = await this.findOrCreateClaimRequest(
        r,
        ctx,
        'Claimant email verified (account).',
        // Session proof rides onto the request's verification columns so the
        // operator queue can fast-lane it — Verified badge + notes render for
        // free on the pending-claims card.
        {
          method: 'claimant_session',
          note: `Claimant identity proven by authenticated session (${ctx?.customerEmail || 'unknown email'}).`,
        },
      );
      return {
        verificationRequired: false,
        operatorApprovalRequired: true,
        requestId,
        proposedCategories,
      };
    }

    // No verification, no approval — direct claim
    return { verificationRequired: false, proposedCategories };
  }

  /**
   * Persist a pending claim request for operator review and notify
   * operators (platform CRM alert + Requests-Hub ticket). Idempotent: an
   * existing pending request for the token is returned rather than
   * duplicated, and notifications only fire for a new request.
   *
   * Called from initiateClaim (already-verified claimants) and from
   * verifyClaimRequestEmail (post proof-of-inbox, migration 358).
   */
  private async findOrCreateClaimRequest(
    claim: { seed_id: string; tenant_id: string; token_id: string },
    ctx?: ClaimAuditCtx,
    verificationNote?: string,
    claimantProof?: { method: string; note: string },
  ): Promise<{ requestId: string; isNew: boolean }> {
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM directory_claim_requests
      WHERE token_id = ${claim.token_id} AND status = 'pending'
      LIMIT 1
    `;

    if (existing[0]) {
      return { requestId: existing[0].id, isNew: false };
    }

    const requestId = generateDirectoryClaimRequestId(claim.tenant_id);
    await prisma.$executeRaw`
      INSERT INTO directory_claim_requests (
        id, seed_id, tenant_id, token_id,
        customer_id, customer_email, customer_name,
        claimant_first_name, claimant_middle_name, claimant_last_name,
        claimant_phone, claimant_business_address,
        status, submitted_at,
        verification_method, verification_notes,
        verification_completed_at, verification_completed_by
      ) VALUES (
        ${requestId},
        ${claim.seed_id},
        ${claim.tenant_id},
        ${claim.token_id},
        ${ctx?.actorId || null},
        ${ctx?.customerEmail || null},
        ${ctx?.customerName || null},
        ${ctx?.claimantFirstName || null},
        ${ctx?.claimantMiddleName || null},
        ${ctx?.claimantLastName || null},
        ${ctx?.claimantPhone || null},
        ${ctx?.claimantBusinessAddress || null},
        'pending',
        now(),
        ${claimantProof?.method || null},
        ${claimantProof?.note || null},
        ${claimantProof ? new Date() : null},
        ${claimantProof ? 'system' : null}
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
          ${`A business owner has submitted a claim request for a directory listing.\n\nClaimant: ${[ctx?.claimantFirstName, ctx?.claimantLastName].filter(Boolean).join(' ') || '—'}\nEmail: ${ctx?.customerEmail || '—'}\nPhone: ${ctx?.claimantPhone || '—'}${verificationNote ? `\n${verificationNote}` : ''}\n\nReview and approve at Settings → Directory → Presence Seeds.`},
          'clock',
          false,
          false,
          ${JSON.stringify({ requestId, seedId: claim.seed_id, tenantId: claim.tenant_id, claimantEmail: ctx?.customerEmail, claimantPhone: ctx?.claimantPhone })}::jsonb,
          now()
        )
      `;
    } catch (alertErr) {
      logger.error('DirectoryClaimService.findOrCreateClaimRequest — CRM alert insert failed', undefined, {
        error: (alertErr as Error).message,
      });
      // Non-fatal — the request row is already persisted
    }

    // Also create a CRM support ticket so the claim appears in the
    // operator's Admin CRM dashboard (requests / tickets / dashboard stats).
    try {
      const listingRows = await prisma.$queryRaw<any[]>`
        SELECT dl.business_name FROM directory_presence_seeds dps
        JOIN directory_listings_list dl ON dl.id = dps.listing_id
        WHERE dps.id = ${claim.seed_id}
        LIMIT 1
      `;
      const businessName = listingRows[0]?.business_name || 'Unknown Business';

      const ticket = await CrmTicketService.getInstance().create({
        tenant_id: PLATFORM_SCOPE,
        title: `Directory listing claim request: ${businessName}`,
        description: `A business owner submitted a claim request for a directory listing.

Business: ${businessName}
Seed ID: ${claim.seed_id}
Tenant ID: ${claim.tenant_id}
Request ID: ${requestId}
Claimant: ${[ctx?.claimantFirstName, ctx?.claimantMiddleName, ctx?.claimantLastName].filter(Boolean).join(' ') || '—'}
Email: ${ctx?.customerEmail || '—'}
Phone: ${ctx?.claimantPhone || '—'}
Stated address: ${ctx?.claimantBusinessAddress || '—'}${verificationNote ? `\n${verificationNote}` : ''}

Review at Settings → Directory → Presence Seeds.`,
        priority: 'high',
        category: 'directory_claim',
        inquiry_id: requestId,
      });

      await CrmTicketMessageService.getInstance().create({
        ticket_id: ticket.id,
        author_id: 'system',
        author_type: 'platform',
        author_name: 'Directory Claims',
        content_blocks: {
          version: '1',
          blocks: [
            { type: 'paragraph', text: `A business owner submitted a claim request for ${businessName}.` },
            { type: 'paragraph', text: `Request ID: ${requestId} · Seed: ${claim.seed_id}` },
            { type: 'button', label: 'Review claim in Presence Seeds', url: '/settings/admin/directory/presence-seeds', variant: 'primary' },
          ],
        },
      });
    } catch (ticketErr) {
      logger.error('DirectoryClaimService.findOrCreateClaimRequest — CRM support ticket creation failed', undefined, {
        error: (ticketErr as Error).message,
      });
      // Non-fatal — the request row is already persisted
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_claim.submit_approval_request',
      payload: { seedId: claim.seed_id, tenantId: claim.tenant_id, tokenId: claim.token_id, requestId },
    });

    return { requestId, isNew: true };
  }

  /**
   * Create (or resend) a claimant-email verification for an
   * operator-approval claim (migration 358). The pending claim request is
   * only filed by verifyClaimRequestEmail after the claimant proves inbox
   * access — self-asserted contact info never reaches the operator queue.
   * Repeat initiates resend the live verification for the same
   * token + email rather than minting a fresh one.
   */
  private async createOrResendClaimVerification(
    claim: { token_id: string; seed_id: string; tenant_id: string },
    claimantEmail: string,
    ctx?: ClaimAuditCtx,
  ): Promise<void> {
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id, token FROM directory_claim_request_verifications
      WHERE token_id = ${claim.token_id}
        AND claimant_email = ${claimantEmail}
        AND verified = FALSE
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    let verifyToken: string;
    if (existing[0]) {
      verifyToken = existing[0].token;
    } else {
      verifyToken = crypto.randomBytes(32).toString('hex');
      const verificationId = generateDirectoryClaimRequestVerificationId(claim.tenant_id);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const payload = {
        customerId: ctx?.actorId ?? null,
        customerName: ctx?.customerName ?? null,
        claimantFirstName: ctx?.claimantFirstName ?? null,
        claimantMiddleName: ctx?.claimantMiddleName ?? null,
        claimantLastName: ctx?.claimantLastName ?? null,
        claimantPhone: ctx?.claimantPhone ?? null,
        claimantBusinessAddress: ctx?.claimantBusinessAddress ?? null,
      };

      await prisma.$executeRaw`
        INSERT INTO directory_claim_request_verifications (
          id, token, token_id, seed_id, tenant_id, claimant_email,
          payload, verified, expires_at, created_at, updated_at
        ) VALUES (
          ${verificationId},
          ${verifyToken},
          ${claim.token_id},
          ${claim.seed_id},
          ${claim.tenant_id},
          ${claimantEmail},
          ${JSON.stringify(payload)}::jsonb,
          FALSE,
          ${expiresAt},
          now(),
          now()
        )
      `;
    }

    const nameRows = await prisma.$queryRaw<any[]>`
      SELECT dl.business_name FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ${claim.seed_id}
      LIMIT 1
    `;
    const businessName = nameRows[0]?.business_name || 'your listing';

    await this.sendClaimVerificationEmail(claimantEmail, verifyToken, businessName);

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_claim.request_email_verification',
      payload: { seedId: claim.seed_id, tenantId: claim.tenant_id, tokenId: claim.token_id, claimantEmail: this.maskTarget(claimantEmail) },
    });
  }

  /**
   * Email the claimant a confirmation link for their pending claim
   * request. Mirrors DirectoryOwnerSubmissionService.sendVerificationEmail.
   * Throws on send failure — initiateClaim maps it to email_send_failed
   * (the verification row persists, so a resend retry reuses it).
   */
  private async sendClaimVerificationEmail(
    to: string,
    verifyToken: string,
    businessName: string,
  ): Promise<void> {
    const baseUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/directory/claim-verify?token=${encodeURIComponent(verifyToken)}`;

    const html = `
      <h1>Confirm your claim request</h1>
      <p>You requested to claim <strong>${businessName}</strong> on the directory.</p>
      <p>Click the link below to confirm your email and submit the claim for review:</p>
      <p><a href="${verifyUrl}" style="padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; display: inline-block;">Confirm my claim</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p><code>${verifyUrl}</code></p>
      <p>This link expires in 24 hours. If you didn't request this, you can ignore it.</p>
    `;

    const text = `Confirm your claim request for ${businessName}: ${verifyUrl} (expires in 24 hours)`;

    const { emailService } = await import('../services/email-service.js');
    const { unifiedConfig } = await import('../config/unifiedConfig');
    await emailService.sendEmail({
      to,
      from: unifiedConfig.emailReplyTo,
      fromName: 'Claims',
      replyTo: unifiedConfig.emailReplyTo,
      subject: 'Confirm your listing claim request',
      html,
      text,
    } as any);
  }

  /**
   * Confirm a claimant's email verification link and file the pending
   * claim request (migration 358). Mirrors
   * DirectoryOwnerSubmissionService.verifyToken — the request row and its
   * operator notifications only exist after proof-of-inbox.
   */
  async verifyClaimRequestEmail(
    verifyToken: string,
    ctx?: ClaimAuditCtx,
  ): Promise<{
    success: boolean;
    requestId?: string;
    claimToken?: string;
    businessName?: string;
    error?: string;
  }> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        v.id,
        v.token_id,
        v.seed_id,
        v.tenant_id,
        v.claimant_email,
        v.payload,
        v.verified,
        v.expires_at,
        dct.token AS claim_token,
        dct.consumed_at,
        dct.single_use,
        dct.expires_at AS claim_expires_at,
        dps.status AS seed_status,
        dl.business_name
      FROM directory_claim_request_verifications v
      JOIN directory_claim_tokens dct ON dct.id = v.token_id
      JOIN directory_presence_seeds dps ON dps.id = v.seed_id
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE v.token = ${verifyToken}
      LIMIT 1
    `;

    if (!rows[0]) {
      return { success: false, error: 'token_not_found' };
    }

    const v = rows[0];
    const now = new Date();

    if (v.verified) {
      return { success: false, error: 'token_already_verified', claimToken: v.claim_token, businessName: v.business_name };
    }
    if (now > new Date(v.expires_at)) {
      return { success: false, error: 'token_expired' };
    }
    if (v.seed_status === 'claimed' || (v.consumed_at && v.single_use)) {
      return { success: false, error: 'already_claimed' };
    }
    if (now > new Date(v.claim_expires_at)) {
      return { success: false, error: 'token_expired' };
    }

    await prisma.$executeRaw`
      UPDATE directory_claim_request_verifications
      SET verified = TRUE, verified_at = now(), updated_at = now()
      WHERE id = ${v.id}
    `;

    const payload = (v.payload ?? {}) as Record<string, any>;
    const { requestId } = await this.findOrCreateClaimRequest(
      { seed_id: v.seed_id, tenant_id: v.tenant_id, token_id: v.token_id },
      {
        actorType: 'customer',
        actorId: payload.customerId ?? undefined,
        customerEmail: v.claimant_email,
        customerName: payload.customerName ?? undefined,
        claimantFirstName: payload.claimantFirstName ?? undefined,
        claimantMiddleName: payload.claimantMiddleName ?? undefined,
        claimantLastName: payload.claimantLastName ?? undefined,
        claimantPhone: payload.claimantPhone ?? undefined,
        claimantBusinessAddress: payload.claimantBusinessAddress ?? undefined,
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      },
      'Claimant email verified via confirmation link.',
      {
        method: 'claimant_email',
        note: `Claimant inbox proof via confirmation link (${v.claimant_email}).`,
      },
    );

    audit({
      actor: payload.customerId ?? undefined,
      actorType: 'customer',
      action: 'directory_claim.verify_email',
      payload: { seedId: v.seed_id, tenantId: v.tenant_id, tokenId: v.token_id, requestId },
    });

    logger.info('DirectoryClaimService.verifyClaimRequestEmail — claimant email verified', undefined, {
      seedId: v.seed_id,
      requestId,
    });

    return {
      success: true,
      requestId,
      claimToken: v.claim_token,
      businessName: v.business_name,
    };
  }

  /**
   * Mint the owner's claim-time verification (migration 274).
   *
   * Called from initiateClaim before the OTP / operator-approval branching so
   * the mint happens at the moment of consent and is identical for every
   * claim path. Writes:
   *   - directory_listings_list primary_category / secondary_categories /
   *     attributes via DirectoryPresenceSeedService.updateFields
   *   - directory_settings_list category columns (keeps the tenant's
   *     directory options page in sync, same as publishSeed)
   *   - directory_field_provenance rows (primary_category,
   *     secondary_categories, attributes) with source_name='owner_claim',
   *     confidence 'high', show_on_public — the consent-of-record
   *   - directory_presence_seeds owner_verified_at + owner_verification
   *     (consent snapshot) + category_fit='verified'
   *
   * Abuse gate: labels the owner typed that are not in the known category
   * set (platform_categories ∪ mkt_service_categories_list, case-insensitive)
   * are NOT written to the listing. They are appended to
   * owner_proposed_categories with status 'pending' and surfaced to operators
   * via a platform CRM alert — acceptance happens on the seed detail page.
   */
  private async applyOwnerVerification(
    claim: { seed_id: string; tenant_id: string; listing_id: string },
    verification: OwnerClaimVerification,
    ctx?: ClaimAuditCtx,
  ): Promise<{ error?: string; proposed?: string[] }> {
    const { seed_id: seedId, tenant_id: tenantId, listing_id: listingId } = claim;

    const listingRows = await prisma.$queryRaw<any[]>`
      SELECT primary_category, secondary_categories, attributes, business_name
      FROM directory_listings_list WHERE id = ${listingId} LIMIT 1
    `;
    const listing = listingRows[0] || {};
    const seedRows = await prisma.$queryRaw<any[]>`
      SELECT owner_proposed_categories FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    const existingProposals: any[] = Array.isArray(seedRows[0]?.owner_proposed_categories)
      ? seedRows[0].owner_proposed_categories
      : [];

    // ── Known category set: platform_categories ∪ active vocab labels ──
    const knownRows = await prisma.$queryRaw<any[]>`
      SELECT LOWER(name) AS label FROM platform_categories WHERE name IS NOT NULL
      UNION
      SELECT LOWER(label) AS label FROM mkt_service_categories_list WHERE is_active = true
    `;
    const known = new Set<string>(knownRows.map((k) => String(k.label)));
    const isKnown = (label: string) => known.has(label.trim().toLowerCase());

    // ── Categories: mint known labels, divert unknown to proposals ──────
    const nowIso = new Date().toISOString();
    const proposals: OwnerProposedCategory[] = existingProposals.map((p: any) => ({
      label: String(p?.label ?? ''),
      role: p?.role === 'primary' ? 'primary' : 'secondary',
      status: ['pending', 'accepted', 'rejected'].includes(p?.status) ? p.status : 'pending',
      proposedAt: p?.proposed_at ?? nowIso,
      decidedAt: p?.decided_at ?? null,
      decidedBy: p?.decided_by ?? null,
    }));
    const proposalKeys = new Set(proposals.map((p) => p.label.trim().toLowerCase()));
    const newProposals: OwnerProposedCategory[] = [];
    const addProposal = (label: string, role: 'primary' | 'secondary') => {
      const trimmed = label.trim().slice(0, 100);
      if (!trimmed || isKnown(trimmed)) return;
      const key = trimmed.toLowerCase();
      if (proposalKeys.has(key)) return;
      proposalKeys.add(key);
      const entry: OwnerProposedCategory = {
        label: trimmed,
        role,
        status: 'pending',
        proposedAt: nowIso,
      };
      proposals.push(entry);
      newProposals.push(entry);
    };

    const submittedPrimary = (verification.primaryCategory || '').trim().slice(0, 100);
    let mintedPrimary: string | null = listing.primary_category ?? null;
    if (submittedPrimary) {
      if (isKnown(submittedPrimary)) {
        mintedPrimary = submittedPrimary;
      } else {
        // Unknown primary — keep the current primary live, hold the owner's
        // suggestion for operator acceptance (role 'primary').
        addProposal(submittedPrimary, 'primary');
      }
    }

    const primaryLower = (mintedPrimary || '').trim().toLowerCase();
    const acceptedSecondary: string[] = [];
    const seenSecondary = new Set<string>();
    for (const raw of verification.secondaryCategories || []) {
      const label = String(raw ?? '').trim().slice(0, 100);
      if (!label) continue;
      const key = label.toLowerCase();
      if (key === primaryLower || seenSecondary.has(key)) continue;
      seenSecondary.add(key);
      if (isKnown(label)) acceptedSecondary.push(label);
      else addProposal(label, 'secondary');
    }
    // Client-flagged proposals go through the same gate (deduped above).
    for (const raw of verification.proposedCategories || []) {
      addProposal(String(raw ?? ''), 'secondary');
    }

    // ── Attributes: owner-authoritative final set ──────────────────────
    // Submitted entries win; sourced chips the owner left off are dropped.
    // Confirmed sourced entries keep their evidence and gain an
    // owner_confirmed marker; owner-added entries mint with
    // sourcePlatform 'owner_confirmed'.
    const currentAttrs: DirectoryListingAttribute[] = Array.isArray(listing.attributes)
      ? listing.attributes
      : [];
    const currentByKey = new Map<string, DirectoryListingAttribute>(
      currentAttrs
        .map((a) => [String(a?.key ?? '').trim().toLowerCase(), a] as const)
        .filter(([k]) => k),
    );
    const today = nowIso.slice(0, 10);
    const mintedAttrs: DirectoryListingAttribute[] = [];
    const confirmedAttrKeys: string[] = [];
    const addedAttrKeys: string[] = [];
    const submittedKeys = new Set<string>();
    for (const raw of verification.attributes || []) {
      const label = String(raw?.label ?? '').trim().slice(0, 100);
      if (!label) continue;
      const key = (String(raw?.key ?? '').trim().toLowerCase() || slugifyAttributeKey(label)).slice(0, 64);
      if (!key || submittedKeys.has(key)) continue;
      // SNAP/EBT keeps its dedicated columns + stricter contract (migration
      // 207) — never mint it as a generic attribute.
      if (key.includes('snap') || key.includes('ebt')) continue;
      submittedKeys.add(key);
      const existing = currentByKey.get(key);
      if (existing) {
        mintedAttrs.push({ ...existing, ownerConfirmed: true } as DirectoryListingAttribute);
        confirmedAttrKeys.push(key);
      } else {
        mintedAttrs.push({
          key,
          label,
          sourcePlatform: 'owner_confirmed',
          asOf: today,
          ownerConfirmed: true,
        } as DirectoryListingAttribute);
        addedAttrKeys.push(key);
      }
    }
    const rejectedAttrKeys = [...currentByKey.keys()].filter((k) => !submittedKeys.has(k));

    // ── Persist: listing + settings + provenance ───────────────────────
    const { default: seedService } = await import('./DirectoryPresenceSeedService');
    const provenance = [
      { fieldKey: 'primary_category', value: mintedPrimary ?? '' },
      { fieldKey: 'secondary_categories', value: acceptedSecondary.join(', ') },
      { fieldKey: 'attributes', value: 'owner_confirmed' },
    ].map((p) => ({
      ...p,
      sourceName: 'owner_claim',
      confidence: 'high' as const,
      showOnPublic: true,
      accessedAt: new Date(),
    }));
    await seedService.updateFields(
      seedId,
      {
        primaryCategory: mintedPrimary,
        secondaryCategories: acceptedSecondary,
        attributes: mintedAttrs,
      },
      provenance,
      { actorType: ctx?.actorType, actorId: ctx?.actorId, ip: ctx?.ip, userAgent: ctx?.userAgent },
    );

    // Keep the tenant's directory settings row in sync (the post-claim
    // directory options page reads this table — same sync publishSeed does).
    await prisma.$executeRaw`
      INSERT INTO directory_settings_list (
        id, tenant_id, is_published, primary_category, secondary_categories, updated_at
      ) VALUES (
        ${tenantId}, ${tenantId}, false,
        ${mintedPrimary}, ${acceptedSecondary}::text[], now()
      )
      ON CONFLICT (id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category,
        secondary_categories = EXCLUDED.secondary_categories,
        updated_at = now()
    `;

    // ── Consent-of-record on the seed ──────────────────────────────────
    const verificationRecord = {
      version: 'owner_claim_v1',
      confirmedAt: nowIso,
      confirmedBy: ctx?.actorId ?? null,
      primaryCategory: mintedPrimary,
      secondaryCategories: acceptedSecondary,
      proposedCategories: newProposals.map((p) => ({ label: p.label, role: p.role })),
      attributes: {
        confirmed: confirmedAttrKeys,
        added: addedAttrKeys,
        rejected: rejectedAttrKeys,
      },
    };
    await prisma.$executeRaw`
      UPDATE directory_presence_seeds
      SET owner_verified_at = now(),
          owner_verification = ${JSON.stringify(verificationRecord)}::jsonb,
          owner_proposed_categories = ${JSON.stringify(proposals)}::jsonb,
          category_fit = 'verified',
          updated_at = now()
      WHERE id = ${seedId}
    `;

    // Surface pending proposals to operators — the claim itself may be
    // OTP-verified (no human in the loop), so proposals need their own
    // review surface.
    if (newProposals.length > 0) {
      const names = newProposals.map((p) => p.label).join(', ');
      try {
        const { generateCrmAlertId } = await import('../lib/id-generator.js');
        await prisma.$executeRaw`
          INSERT INTO crm_alerts (
            id, tenant_id, type, title, body, icon, is_read, is_dismissed, metadata, created_at
          ) VALUES (
            ${generateCrmAlertId(PLATFORM_SCOPE)},
            ${PLATFORM_SCOPE},
            'directory_category_proposal',
            'Owner-proposed categories need review',
            ${`A business owner proposed new categories while claiming their listing.\n\nProposed: ${names}\n\nReview and accept/reject at Settings → Directory → Presence Seeds.`},
            'tag',
            false,
            false,
            ${JSON.stringify({ seedId, tenantId, proposals: newProposals.map((p) => p.label) })}::jsonb,
            now()
          )
        `;
      } catch (alertErr) {
        logger.error('DirectoryClaimService.applyOwnerVerification — CRM alert insert failed', undefined, {
          error: (alertErr as Error).message,
        });
      }

      // Also file a CRM support ticket so the proposals land in the
      // operator's Requests Hub (Settings → Admin → CRM → Requests) — the
      // same inbox pattern the claim-request path uses. crm_alerts alone
      // only feeds the customer-facing marketing feed, not an operator
      // work queue.
      try {
        const businessName = listing.business_name || 'Unknown Business';
        const ticket = await CrmTicketService.getInstance().create({
          tenant_id: PLATFORM_SCOPE,
          title: `Owner-proposed categories need review: ${businessName}`,
          description: `A business owner proposed new categories while claiming their directory listing.

Business: ${businessName}
Seed ID: ${seedId}
Tenant ID: ${tenantId}
Proposed: ${names}

Accept or reject each proposal at the seed's Owner Verification section.`,
          priority: 'medium',
          category: 'directory_claim',
          inquiry_id: seedId,
        });

        await CrmTicketMessageService.getInstance().create({
          ticket_id: ticket.id,
          author_id: 'system',
          author_type: 'platform',
          author_name: 'Directory Claims',
          content_blocks: {
            version: '1',
            blocks: [
              { type: 'paragraph', text: `Owner-proposed categories awaiting review for ${businessName}: ${names}.` },
              { type: 'paragraph', text: `Seed: ${seedId} · Tenant: ${tenantId}` },
              { type: 'button', label: 'Review proposals on the seed', url: `/settings/admin/directory/presence-seeds/${seedId}`, variant: 'primary' },
            ],
          },
        });
      } catch (ticketErr) {
        logger.error('DirectoryClaimService.applyOwnerVerification — CRM ticket create failed', undefined, {
          error: (ticketErr as Error).message,
        });
        // Non-fatal — proposals are persisted on the seed regardless
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_claim.owner_verification',
      payload: {
        seedId,
        tenantId,
        primaryCategory: mintedPrimary,
        secondaryCategories: acceptedSecondary,
        proposedCount: newProposals.length,
        attributesConfirmed: confirmedAttrKeys.length,
        attributesAdded: addedAttrKeys.length,
        attributesRejected: rejectedAttrKeys.length,
      },
    });

    return { proposed: newProposals.map((p) => p.label) };
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

    // Convert tenant from directory_seed to independent. The gateway tier is
    // free forever — set status 'active' so the tenant never enters the
    // paid-trial machinery (which stamps a 14-day clock and auto-expires).
    await prisma.$executeRaw`
      UPDATE tenants
      SET org_standing_mode = 'independent',
          subscription_status = 'active',
          updated_at = now()
      WHERE id = ${r.tenant_id}
    `;

    // Populate the tenant business profile from the claimed directory listing
    // so the directory entry has proper initial data (same shape as the
    // Edit Business Profile modal produces via PATCH /api/tenant/profile).
    await this.populateTenantProfileFromListing(r.seed_id, r.tenant_id);

    // Update seed status. nap_verified_at is stamped here: the claim itself is
    // the owner's confirmation of the seed-filed NAP (OTP-verified when the
    // token is bound; operator-reviewed for approved claim requests). Later
    // owner corrections are tracked separately via
    // directory_seed_nap_verifications (seed-funnel analytics spec §7 gap 2).
    await prisma.$executeRaw`
      UPDATE directory_presence_seeds
      SET status = 'claimed', claimed_at = now(), nap_verified_at = now(), updated_at = now()
      WHERE id = ${r.seed_id}
    `;

    // §5.1: an owner claim is a report-version trigger — regenerate the seed
    // intelligence report so the claimed variant (report_mode='claimed') is
    // persisted. Best-effort: a refresh failure must not block the claim,
    // and the last published version is preserved regardless (§20.4.11).
    if (r.seed_id) {
      try {
        const { SeedIntelligenceReportService } = await import('./intelligence/SeedIntelligenceReportService.js');
        await SeedIntelligenceReportService.getInstance().refreshReport(r.seed_id);
      } catch (err: any) {
        logger.warn('DirectoryClaimService: post-claim report refresh failed', undefined, {
          seedId: r.seed_id,
          error: { name: err?.name || 'Error', message: err?.message || String(err) },
        });
      }

      // Spec §5.3.2 — terminal delivery lifecycle outcome (report_claimed).
      // Best-effort: never blocks the claim.
      try {
        const { default: reportDelivery } = await import('./intelligence/SeedReportDeliveryService.js');
        await reportDelivery.recordClaimed(r.seed_id);
      } catch (err: any) {
        logger.warn('DirectoryClaimService: post-claim report_claimed touch failed', undefined, {
          seedId: r.seed_id,
          error: { name: err?.name || 'Error', message: err?.message || String(err) },
        });
      }
    }

    await this.promoteListingToClaimed(r.tenant_id);
    await this.retireSeedPreviewStorefronts(r.tenant_id);
    const claimGrants = await this.applySeedClaimGrants(r.tenant_id, r.seed_id);

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

    // Provision the GBP identity bridge so the customer can manage their
    // Google Business Profile from the portal (Subsystem 0 §1).
    let gbpBridgeCustomerId: string | undefined;
    if (isCustomer) {
      gbpBridgeCustomerId = userId;
    } else {
      // Platform user — resolve the customer via linked_user_id
      const custRows = await prisma.$queryRaw<any[]>`
        SELECT id FROM customers WHERE linked_user_id = ${userId} LIMIT 1
      `;
      gbpBridgeCustomerId = custRows[0]?.id;
    }
    if (gbpBridgeCustomerId) {
      await this.provisionGbpBridge(gbpBridgeCustomerId, r.tenant_id);
    }

    // W1c — propagate the claim to every campaign linked to this seed:
    // tenant_id/customer_id backfill + repair_fulfillment.seed_claimed stamp.
    await this.propagateClaimToLinkedCampaigns(r.seed_id, r.tenant_id, platformUserId);

    // Post-claim notifications — operator Requests-Hub alert + owner
    // welcome email. Non-fatal: failures are logged inside the helper.
    await this.sendClaimSuccessNotifications({
      seedId: r.seed_id,
      tenantId: r.tenant_id,
      claimPath: 'self_serve',
      customerId: isCustomer ? userId : null,
      platformUserId,
      ownerEmail: ctx?.customerEmail,
      ownerName: ctx?.customerName,
    });

    // Embed the gateway upgrade preview so the claim success screen can
    // render the Entry Presence mode cards without a platform (Auth0)
    // session (claim handoff spec). A failure here must never fail the claim.
    let upgradePreview: UpgradeOptionsPayload | null = null;
    try {
      upgradePreview = await buildTenantUpgradeOptions(r.tenant_id);
    } catch (err: any) {
      logger.warn('DirectoryClaimService.acceptClaim — upgrade preview build failed', undefined, {
        tenantId: r.tenant_id,
        error: { name: err?.name || 'Error', message: err?.message || String(err) },
      });
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
      ...(upgradePreview ? {
        currentTier: upgradePreview.currentTier,
        isGatewayUpgrade: upgradePreview.isGatewayUpgrade,
        upgradeOptions: upgradePreview.upgradeOptions,
      } : {}),
      ...(claimGrants.length ? { claimGrants } : {}),
    };
  }

  /**
   * W1c — claim propagation to seed-linked campaigns (Profile Repair
   * Fulfillment Sprint). For every campaign in directory_seed_campaign_links
   * for this seed:
   *   - fill campaign.tenant_id only when currently null
   *   - resolve customers via linked_user_id and set campaign.customer_id
   *   - merge { seed_claimed: true, claimed_at } into repair_fulfillment
   *   - backfill tenant_id on unsubmitted intake rows
   *
   * Deliberately does NOT call MarketingCampaignService.linkTenant() — that
   * path can force a tenant_onboarded stage transition, which would yank an
   * in-flight repair campaign out of its pipeline.
   *
   * Best-effort: a propagation failure must never fail the claim — errors
   * are logged and the loop continues.
   */
  private async propagateClaimToLinkedCampaigns(
    seedId: string,
    tenantId: string,
    platformUserId?: string,
  ): Promise<void> {
    try {
      const links = await prisma.directory_seed_campaign_links.findMany({
        where: { seed_id: seedId },
        select: { campaign_id: true },
      });
      if (links.length === 0) return;

      // Resolve the customer row once via the claiming platform user.
      let customerId: string | null = null;
      if (platformUserId) {
        const custRows = await prisma.$queryRaw<any[]>`
          SELECT id FROM customers WHERE linked_user_id = ${platformUserId} LIMIT 1
        `;
        customerId = custRows[0]?.id ?? null;
      }

      const claimedAt = new Date().toISOString();
      for (const link of links) {
        try {
          const campaign = await prisma.mkt_campaigns_list.findUnique({
            where: { id: link.campaign_id },
            select: { id: true, tenant_id: true, customer_id: true, repair_fulfillment: true },
          });
          if (!campaign) continue;

          const rf = {
            ...((campaign.repair_fulfillment as Record<string, any> | null) ?? {}),
            seed_claimed: true,
            claimed_at: claimedAt,
          };

          await prisma.mkt_campaigns_list.update({
            where: { id: campaign.id },
            data: {
              repair_fulfillment: rf,
              ...(campaign.tenant_id ? {} : { tenant_id: tenantId }),
              ...(!campaign.customer_id && customerId ? { customer_id: customerId } : {}),
            },
          });

          // Backfill tenant_id on unsubmitted intake rows so write-behind
          // adapters + scan attribution resolve tenant context.
          await prisma.mkt_dispute_intake.updateMany({
            where: { campaign_id: campaign.id, tenant_id: null, submitted_at: null },
            data: { tenant_id: tenantId },
          });
        } catch (err) {
          logger.warn('DirectoryClaimService: claim propagation failed for linked campaign', undefined, {
            seedId,
            campaignId: link.campaign_id,
            error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err) },
          });
        }
      }
    } catch (err) {
      logger.error('DirectoryClaimService: claim propagation failed', undefined, {
        seedId,
        tenantId,
        error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err) },
      });
    }
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
        dcr.claimant_first_name,
        dcr.claimant_middle_name,
        dcr.claimant_last_name,
        dcr.claimant_phone,
        dcr.claimant_business_address,
        dcr.status,
        dcr.rejection_reason,
        dcr.submitted_at,
        dcr.reviewed_at,
        dcr.reviewed_by,
        dcr.verification_method,
        dcr.verification_notes,
        dcr.verification_completed_at,
        dcr.verification_completed_by,
        dps.category,
        dl.business_name,
        dl.address,
        dl.phone AS business_phone,
        dps.city,
        dps.state
      FROM directory_claim_requests dcr
      JOIN directory_presence_seeds dps ON dps.id = dcr.seed_id
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dcr.status = ${status}
      ORDER BY dcr.submitted_at DESC
    `;

    // Fetch attachment counts for each request (separate query to avoid
    // row multiplication from the join)
    const requestIds = rows.map((r) => r.id);
    let attachmentCounts: Record<string, number> = {};
    if (requestIds.length > 0) {
      const countRows = await prisma.$queryRaw<any[]>`
        SELECT claim_request_id, COUNT(*)::int AS cnt
        FROM directory_claim_attachments
        WHERE claim_request_id = ANY(${requestIds}::text[])
        GROUP BY claim_request_id
      `;
      for (const cr of countRows) {
        attachmentCounts[cr.claim_request_id] = cr.cnt;
      }
    }

    // Batch-load the claimant email-verification record per token
    // (migration 358) — the proof-of-inbox stamp operators see on the
    // request card / verification worksheet. Non-fatal: absent the table
    // (migration not applied in this env) the list still renders.
    let verificationsByToken: Record<
      string,
      { email: string; verifiedAt: Date | null; sentAt: Date }
    > = {};
    const tokenIds = [...new Set(rows.map((r) => r.token_id).filter(Boolean))];
    if (tokenIds.length > 0) {
      try {
        const vRows = await prisma.$queryRaw<any[]>`
          SELECT token_id, claimant_email, verified_at, created_at AS sent_at
          FROM directory_claim_request_verifications
          WHERE token_id = ANY(${tokenIds}::text[])
          ORDER BY created_at DESC
        `;
        for (const v of vRows) {
          if (!verificationsByToken[v.token_id]) {
            verificationsByToken[v.token_id] = {
              email: v.claimant_email,
              verifiedAt: v.verified_at ? new Date(v.verified_at) : null,
              sentAt: new Date(v.sent_at),
            };
          }
        }
      } catch (err) {
        logger.warn('DirectoryClaimService.listClaimRequests — verification lookup failed (migration 358 pending?)', undefined, {
          error: (err as Error).message,
        });
      }
    }

    return rows.map((r) => ({
      id: r.id,
      seedId: r.seed_id,
      tenantId: r.tenant_id,
      tokenId: r.token_id,
      customerId: r.customer_id,
      customerEmail: r.customer_email,
      customerName: r.customer_name,
      claimantFirstName: r.claimant_first_name,
      claimantMiddleName: r.claimant_middle_name,
      claimantLastName: r.claimant_last_name,
      claimantPhone: r.claimant_phone,
      claimantBusinessAddress: r.claimant_business_address,
      status: r.status,
      rejectionReason: r.rejection_reason,
      submittedAt: r.submitted_at,
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by,
      verificationMethod: r.verification_method,
      verificationNotes: r.verification_notes,
      verificationCompletedAt: r.verification_completed_at,
      verificationCompletedBy: r.verification_completed_by,
      businessName: r.business_name,
      category: r.category,
      address: r.address,
      businessPhone: r.business_phone,
      city: r.city,
      state: r.state,
      attachmentCount: attachmentCounts[r.id] || 0,
      // Claimant proof-of-inbox (migration 358). Null when the claimant's
      // email was already account-verified or the request predates the gate.
      claimantEmailVerifiedAt: verificationsByToken[r.token_id]?.verifiedAt ?? null,
      claimVerificationEmail: verificationsByToken[r.token_id]?.email ?? null,
      claimVerificationSentAt: verificationsByToken[r.token_id]?.sentAt ?? null,
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
        dcr.customer_email,
        dcr.customer_name,
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

    // Convert tenant from directory_seed to independent. The gateway tier is
    // free forever — set status 'active' so the tenant never enters the
    // paid-trial machinery (which stamps a 14-day clock and auto-expires).
    await prisma.$executeRaw`
      UPDATE tenants
      SET org_standing_mode = 'independent',
          subscription_status = 'active',
          updated_at = now()
      WHERE id = ${r.tenant_id}
    `;

    // Populate the tenant business profile from the claimed directory listing
    // so the directory entry has proper initial data (same shape as the
    // Edit Business Profile modal produces via PATCH /api/tenant/profile).
    await this.populateTenantProfileFromListing(r.seed_id, r.tenant_id);

    // Update seed status. nap_verified_at is stamped here: the claim itself is
    // the owner's confirmation of the seed-filed NAP (OTP-verified when the
    // token is bound; operator-reviewed for approved claim requests). Later
    // owner corrections are tracked separately via
    // directory_seed_nap_verifications (seed-funnel analytics spec §7 gap 2).
    await prisma.$executeRaw`
      UPDATE directory_presence_seeds
      SET status = 'claimed', claimed_at = now(), nap_verified_at = now(), updated_at = now()
      WHERE id = ${r.seed_id}
    `;

    // §5.1: an owner claim is a report-version trigger — regenerate the seed
    // intelligence report so the claimed variant (report_mode='claimed') is
    // persisted. Best-effort: a refresh failure must not block the claim,
    // and the last published version is preserved regardless (§20.4.11).
    if (r.seed_id) {
      try {
        const { SeedIntelligenceReportService } = await import('./intelligence/SeedIntelligenceReportService.js');
        await SeedIntelligenceReportService.getInstance().refreshReport(r.seed_id);
      } catch (err: any) {
        logger.warn('DirectoryClaimService: post-claim report refresh failed', undefined, {
          seedId: r.seed_id,
          error: { name: err?.name || 'Error', message: err?.message || String(err) },
        });
      }

      // Spec §5.3.2 — terminal delivery lifecycle outcome (report_claimed).
      try {
        const { default: reportDelivery } = await import('./intelligence/SeedReportDeliveryService.js');
        await reportDelivery.recordClaimed(r.seed_id);
      } catch (err: any) {
        logger.warn('DirectoryClaimService: post-claim report_claimed touch failed', undefined, {
          seedId: r.seed_id,
          error: { name: err?.name || 'Error', message: err?.message || String(err) },
        });
      }
    }

    await this.promoteListingToClaimed(r.tenant_id);
    await this.retireSeedPreviewStorefronts(r.tenant_id);
    const claimGrants = await this.applySeedClaimGrants(r.tenant_id, r.seed_id);

    // Update request status
    await prisma.$executeRaw`
      UPDATE directory_claim_requests
      SET status = 'approved', reviewed_at = now(), reviewed_by = ${adminUserId}
      WHERE id = ${requestId}
    `;

    // Close the linked CRM support ticket
    await this.closeClaimTicket(requestId, 'resolved');

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

    // Provision the GBP identity bridge (Subsystem 0 §1). Only when we have
    // a customer_id; if the request was approved without one, the bridge is
    // provisioned later by linkCustomerToClaimRequest.
    if (r.customer_id) {
      await this.provisionGbpBridge(r.customer_id, r.tenant_id);
    }

    // W1c — propagate the claim to every campaign linked to this seed
    // (tenant/customer backfill + repair_fulfillment.seed_claimed stamp).
    await this.propagateClaimToLinkedCampaigns(r.seed_id, r.tenant_id, platformUserId);

    // Grant the owner free Market Intel access (spec §13). Fire-and-forget
    // — a failure here must not roll back the claim. The unlock is keyed
    // on (tenant_id, 'place', slug, 'owner_claim') so it's idempotent.
    if (r.customer_id) {
      void this.grantOwnerMarketIntelUnlock(r.customer_id, r.tenant_id, r.seed_id)
        .catch((e) => {
          logger.warn('DirectoryClaimService.approveClaimRequest — Market Intel unlock failed', undefined, {
            error: (e as Error).message,
            seedId: r.seed_id,
            tenantId: r.tenant_id,
          });
        });
    }

    // Post-claim notifications — operator Requests-Hub alert + owner
    // welcome email. Non-fatal: failures are logged inside the helper.
    await this.sendClaimSuccessNotifications({
      seedId: r.seed_id,
      tenantId: r.tenant_id,
      claimPath: 'operator_approved',
      requestId,
      customerId: r.customer_id,
      platformUserId,
      ownerEmail: r.customer_email,
      ownerName: r.customer_name,
    });

    audit({
      actor: adminUserId,
      actorType: 'user',
      action: 'directory_claim.approve_request',
      payload: { requestId, seedId: r.seedId, tenantId: r.tenant_id, customerId: r.customer_id, platformUserId },
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
      ...(claimGrants.length ? { claimGrants } : {}),
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
      SELECT dcr.id, dcr.token_id, dcr.tenant_id, dcr.seed_id, dcr.status,
             dcr.customer_email, dcr.customer_name,
             dcr.claimant_first_name, dcr.claimant_last_name,
             dl.business_name, dps.city, dps.state
      FROM directory_claim_requests dcr
      JOIN directory_presence_seeds dps ON dps.id = dcr.seed_id
      LEFT JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dcr.id = ${requestId}
      FOR UPDATE OF dcr
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

    // Close the linked CRM support ticket
    await this.closeClaimTicket(requestId, 'closed');

    // Claimant notification — rejection was previously silent; the claimant's
    // only signal was the claim link dying. Non-fatal: a mail failure must
    // not roll back the rejection.
    if (r.customer_email) {
      try {
        const { getDirectoryClaimEmailService } = await import('./email/DirectoryClaimEmailService.js');
        const ownerName =
          r.customer_name ||
          [r.claimant_first_name, r.claimant_last_name].filter(Boolean).join(' ') ||
          null;
        const result = await getDirectoryClaimEmailService().sendClaimRejectedEmail({
          to: r.customer_email,
          ownerName,
          businessName: r.business_name || 'your listing',
          city: r.city,
          state: r.state,
          requestId,
        });
        logger.info('DirectoryClaimService.rejectClaimRequest — rejection email', undefined, {
          requestId,
          seedId: r.seed_id,
          sent: result.success,
        });
      } catch (emailErr) {
        logger.error('DirectoryClaimService.rejectClaimRequest — rejection email failed', undefined, {
          requestId,
          seedId: r.seed_id,
          error: (emailErr as Error).message,
        });
      }
    }

    audit({
      actor: adminUserId,
      actorType: 'user',
      action: 'directory_claim.reject_request',
      payload: { requestId, seedId: r.seed_id, tenantId: r.tenant_id, reason },
    });

    return { success: true, message: 'rejected' };
  }

  /**
   * Save operator verification worksheet data for a claim request.
   * The operator fills out a verification worksheet (method, notes) before
   * approving or rejecting. This records the verification step without
   * changing the request status — the operator still needs to approve or
   * reject separately.
   */
  async saveVerification(
    requestId: string,
    adminUserId: string,
    method: string,
    notes: string,
  ): Promise<{ success: boolean; message: string }> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, status FROM directory_claim_requests WHERE id = ${requestId} LIMIT 1
    `;
    if (!rows[0]) {
      return { success: false, message: 'request_not_found' };
    }

    await prisma.$executeRaw`
      UPDATE directory_claim_requests
      SET verification_method = ${method},
          verification_notes = ${notes || null},
          verification_completed_at = now(),
          verification_completed_by = ${adminUserId}
      WHERE id = ${requestId}
    `;

    audit({
      actor: adminUserId,
      actorType: 'user',
      action: 'directory_claim.save_verification',
      payload: { requestId, method, notesLength: notes?.length || 0 },
    });

    return { success: true, message: 'saved' };
  }

  /**
   * Link a customer to an already-approved claim request.
   *
   * Used to retroactively associate a customer with a claim that was approved
   * without a customer_id (because the /initiate route didn't have
   * optionalCustomerAuth at the time). Also runs promoteCustomerToUser so
   * the customer gets linked_user_id + user_tenants OWNER row, which
   * grants platform context for sidebar gating.
   */
  async linkCustomerToClaimRequest(
    requestId: string,
    customerId: string,
    adminUserId: string,
    ctx?: ClaimAuditCtx,
  ): Promise<ClaimResult> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dcr.id,
        dcr.seed_id,
        dcr.tenant_id,
        dcr.token_id,
        dcr.status,
        dcr.customer_id
      FROM directory_claim_requests dcr
      WHERE dcr.id = ${requestId}
      FOR UPDATE
    `;

    if (!rows[0]) {
      return { success: false, tenantId: '', seedId: '', message: 'request_not_found' };
    }

    const r = rows[0];

    if (r.status !== 'approved') {
      return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'request_not_approved' };
    }

    if (r.customer_id) {
      return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'request_already_linked' };
    }

    // Load customer by ID or email (accepts both for operator convenience)
    const customerRows = await prisma.$queryRaw<any[]>`
      SELECT id, email, first_name, last_name FROM customers
      WHERE id = ${customerId} OR email = ${customerId} OR email = LOWER(${customerId})
      LIMIT 1
    `;
    if (!customerRows[0]) {
      return { success: false, tenantId: r.tenant_id, seedId: r.seed_id, message: 'customer_not_found' };
    }
    const customer = customerRows[0];
    const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || null;

    // Update the request row with customer info
    await prisma.$executeRaw`
      UPDATE directory_claim_requests
      SET customer_id = ${customerId},
          customer_email = ${customer.email},
          customer_name = ${customerName}
      WHERE id = ${requestId}
    `;

    // Promote the customer to a platform user + create OWNER membership
    let platformUserId: string | undefined;
    let userTokens: { accessToken: string; refreshToken: string } | undefined;
    let requiresPasswordSetup = false;

    const promotion = await this.promoteCustomerToUser(customerId, r.tenant_id, r.seed_id, ctx);
    platformUserId = promotion.platformUserId;
    userTokens = promotion.userTokens;
    requiresPasswordSetup = promotion.requiresPasswordSetup;

    // Provision the GBP identity bridge (Subsystem 0 §1). This is the
    // catch-all path for claims approved without a customer_id.
    await this.provisionGbpBridge(customerId, r.tenant_id);

    // Grant the owner free Market Intel access (spec §13). Fire-and-forget
    // — a failure here must not roll back the link. The unlock is keyed
    // on (tenant_id, 'place', slug, 'owner_claim') so it's idempotent.
    void this.grantOwnerMarketIntelUnlock(customerId, r.tenant_id, r.seed_id)
      .catch((e) => {
        logger.warn('DirectoryClaimService.linkCustomerToClaimRequest — Market Intel unlock failed', undefined, {
          error: (e as Error).message,
          seedId: r.seed_id,
          tenantId: r.tenant_id,
        });
      });

    audit({
      actor: adminUserId,
      actorType: 'user',
      action: 'directory_claim.link_customer',
      payload: { requestId, seedId: r.seed_id, tenantId: r.tenant_id, customerId, platformUserId },
    });

    logger.info('DirectoryClaimService.linkCustomerToClaimRequest', undefined, {
      requestId, seedId: r.seed_id, tenantId: r.tenant_id, customerId, platformUserId,
    });

    return {
      success: true,
      tenantId: r.tenant_id,
      seedId: r.seed_id,
      message: 'linked',
      userTokens,
      requiresPasswordSetup,
      platformUserId,
    };
  }

  /**
   * Resolve or close the CRM support ticket linked to a claim request.
   * Tickets are linked via crm_support_tickets.inquiry_id = directory_claim_requests.id.
   */
  private async closeClaimTicket(requestId: string, status: 'resolved' | 'closed') {
    try {
      const updateData: any = { status, updated_at: new Date() };
      if (status === 'resolved') {
        updateData.resolved_at = new Date();
      }
      await prisma.crm_support_tickets.updateMany({
        where: { inquiry_id: requestId, status: { not: 'closed' } },
        data: updateData,
      });
    } catch (err) {
      logger.error('DirectoryClaimService.closeClaimTicket — failed to update linked CRM ticket', undefined, {
        error: (err as Error).message,
        requestId,
        status,
      });
    }
  }

  /**
   * Post-claim notifications — the backend actions that fire once a claim
   * has fully completed (both paths: self-serve accept + operator approval).
   *
   *   1. Operator alert — a platform-scope crm_alerts row + a CRM support
   *      ticket so the claim lands in the operator Requests Hub at
   *      /settings/admin/crm/requests (same inbox pattern the pending-claim
   *      and category-proposal paths use).
   *   2. Owner welcome email — a congratulations email to the claimant's
   *      email address when one is known.
   *
   * Owner contact resolution order: explicit params (route ctx / request
   * row) → the promoted platform user → the customer row.
   *
   * Fully non-fatal — every step is individually guarded so a notification
   * failure can never roll back a completed claim.
   */
  private async sendClaimSuccessNotifications(params: {
    seedId: string;
    tenantId: string;
    claimPath: 'self_serve' | 'operator_approved';
    requestId?: string;
    customerId?: string | null;
    platformUserId?: string;
    ownerEmail?: string | null;
    ownerName?: string | null;
  }): Promise<void> {
    const { seedId, tenantId, claimPath, requestId } = params;

    // Listing display info for the alert + email copy.
    let businessName = 'Unknown Business';
    let slug: string | null = null;
    let category: string | null = null;
    let city: string | null = null;
    let state: string | null = null;
    try {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT dl.business_name, dl.slug, dps.category, dps.city, dps.state
        FROM directory_presence_seeds dps
        JOIN directory_listings_list dl ON dl.id = dps.listing_id
        WHERE dps.id = ${seedId}
        LIMIT 1
      `;
      if (rows[0]) {
        businessName = rows[0].business_name || businessName;
        slug = rows[0].slug ?? null;
        category = rows[0].category ?? null;
        city = rows[0].city ?? null;
        state = rows[0].state ?? null;
      }
    } catch (err) {
      logger.warn('DirectoryClaimService.sendClaimSuccessNotifications — listing lookup failed', undefined, {
        seedId,
        error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err) },
      });
    }

    // Resolve the claimant's email + name (params → platform user → customer).
    let ownerEmail = params.ownerEmail || null;
    let ownerName = params.ownerName || null;
    try {
      if ((!ownerEmail || !ownerName) && params.platformUserId) {
        const rows = await prisma.$queryRaw<any[]>`
          SELECT email, first_name, last_name FROM users WHERE id = ${params.platformUserId} LIMIT 1
        `;
        if (rows[0]) {
          ownerEmail = ownerEmail || rows[0].email || null;
          ownerName = ownerName || [rows[0].first_name, rows[0].last_name].filter(Boolean).join(' ') || null;
        }
      }
      if ((!ownerEmail || !ownerName) && params.customerId) {
        const rows = await prisma.$queryRaw<any[]>`
          SELECT email, first_name, last_name FROM customers WHERE id = ${params.customerId} LIMIT 1
        `;
        if (rows[0]) {
          ownerEmail = ownerEmail || rows[0].email || null;
          ownerName = ownerName || [rows[0].first_name, rows[0].last_name].filter(Boolean).join(' ') || null;
        }
      }
    } catch (err) {
      logger.warn('DirectoryClaimService.sendClaimSuccessNotifications — contact lookup failed', undefined, {
        seedId,
        error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err) },
      });
    }

    // ── Operator alert: platform-scope crm_alerts row ──────────────────
    try {
      const { generateCrmAlertId } = await import('../lib/id-generator.js');
      await prisma.$executeRaw`
        INSERT INTO crm_alerts (
          id, tenant_id, type, title, body, icon, is_read, is_dismissed, metadata, created_at
        ) VALUES (
          ${generateCrmAlertId(PLATFORM_SCOPE)},
          ${PLATFORM_SCOPE},
          'directory_claim_completed',
          'Directory listing claimed',
          ${`A business owner claimed their directory listing.\n\nBusiness: ${businessName}\nOwner: ${ownerName || '—'}\nEmail: ${ownerEmail || '—'}\n\nView the seed at Settings → Directory → Presence Seeds.`},
          'check',
          false,
          false,
          ${JSON.stringify({ seedId, tenantId, requestId, claimPath, ownerEmail, ownerName })}::jsonb,
          now()
        )
      `;
    } catch (alertErr) {
      logger.error('DirectoryClaimService.sendClaimSuccessNotifications — CRM alert insert failed', undefined, {
        error: (alertErr as Error).message,
      });
    }

    // ── Operator alert: Requests-Hub work item ─────────────────────────
    try {
      const ticket = await CrmTicketService.getInstance().create({
        tenant_id: PLATFORM_SCOPE,
        title: `Directory listing claimed: ${businessName}`,
        description: `A business owner claimed their directory listing.

Business: ${businessName}
Seed ID: ${seedId}
Tenant ID: ${tenantId}
Claim path: ${claimPath === 'operator_approved' ? 'Operator approved' : 'Self-serve (owner accepted)'}
Owner: ${ownerName || '—'}
Email: ${ownerEmail || '—'}

View the seed at Settings → Directory → Presence Seeds.`,
        priority: 'medium',
        category: 'directory_claim',
        inquiry_id: requestId || seedId,
      });

      await CrmTicketMessageService.getInstance().create({
        ticket_id: ticket.id,
        author_id: 'system',
        author_type: 'platform',
        author_name: 'Directory Claims',
        content_blocks: {
          version: '1',
          blocks: [
            { type: 'paragraph', text: `${businessName} was claimed by ${ownerName || 'the business owner'}${ownerEmail ? ` (${ownerEmail})` : ''}.` },
            { type: 'paragraph', text: `Seed: ${seedId} · Tenant: ${tenantId}` },
            { type: 'button', label: 'View claimed seed', url: `/settings/admin/directory/presence-seeds/${seedId}`, variant: 'primary' },
          ],
        },
      });
    } catch (ticketErr) {
      logger.error('DirectoryClaimService.sendClaimSuccessNotifications — CRM ticket create failed', undefined, {
        error: (ticketErr as Error).message,
      });
    }

    // ── Owner welcome email ────────────────────────────────────────────
    if (ownerEmail) {
      try {
        const { getDirectoryClaimEmailService } = await import('./email/DirectoryClaimEmailService.js');
        const result = await getDirectoryClaimEmailService().sendClaimWelcomeEmail({
          to: ownerEmail,
          ownerName,
          businessName,
          category,
          city,
          state,
          slug,
          tenantId,
        });
        logger.info('DirectoryClaimService.sendClaimSuccessNotifications — welcome email', undefined, {
          seedId,
          tenantId,
          sent: result.success,
        });
      } catch (emailErr) {
        logger.error('DirectoryClaimService.sendClaimSuccessNotifications — welcome email failed', undefined, {
          error: (emailErr as Error).message,
          seedId,
          tenantId,
        });
      }
    } else {
      logger.info('DirectoryClaimService.sendClaimSuccessNotifications — no claimant email, welcome email skipped', undefined, {
        seedId,
        tenantId,
      });
    }
  }

  /**
   * Grant the claimed owner free Market Intel access (spec §13).
   *
   * Resolves the seed's listing slug, then records an `owner_claim`
   * unlock row. Idempotent — the unique constraint on
   * (tenant_id, surface_type, surface_key, unlock_type) means a re-claim
   * updates the row rather than failing.
   *
   * Fire-and-forget from the caller — a failure here is logged but does
   * not roll back the claim. The owner can still claim again later.
   */
  private async grantOwnerMarketIntelUnlock(
    customerId: string,
    tenantId: string,
    seedId: string,
  ): Promise<void> {
    // Resolve the listing slug from the seed.
    const seed = await prisma.directory_presence_seeds.findUnique({
      where: { id: seedId },
      select: { listing_id: true },
    });
    if (!seed?.listing_id) return;

    const listing = await prisma.directory_listings_list.findUnique({
      where: { id: seed.listing_id },
      select: { slug: true },
    });
    if (!listing?.slug) return;

    await MarketIntelAccessService.getInstance().recordUnlock({
      tenantId,
      customerId,
      surfaceType: 'place',
      surfaceKey: listing.slug,
      unlockType: 'owner_claim',
    });

    logger.info('DirectoryClaimService — granted owner Market Intel unlock', undefined, {
      seedId,
      tenantId,
      slug: listing.slug,
    });
  }

  /**
   * Seed-claim promo grants — write the claim-time capability grants as
   * `tenant_feature_purchases` rows (source 'seed_claim'), the same shape a
   * manual complimentary grant or redeemed grant token produces, so the
   * effective-capability merge resolves them without any tier change. A
   * live paid-source row is never demoted. Returns the granted feature
   * keys; non-fatal — a failure logs and returns [] so it never blocks
   * the claim.
   */
  private async applySeedClaimGrants(tenantId: string, seedId: string): Promise<string[]> {
    try {
      const expiresAt = new Date(Date.now() + SEED_CLAIM_PROMO_DAYS * 24 * 60 * 60 * 1000);
      const granted: string[] = [];

      for (const featureKey of SEED_CLAIM_PROMO_GRANTS) {
        const existing = await prisma.tenant_feature_purchases.findUnique({
          where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: featureKey } },
          select: { source: true, status: true },
        });

        // Never demote money — a live paid purchase keeps its source/attribution.
        if (existing && PAID_PURCHASE_SOURCES.includes(existing.source ?? '') &&
            ['active', 'past_due', 'trial'].includes(existing.status ?? '')) {
          continue;
        }

        const metadata = {
          trigger: 'seed_claim',
          seed_id: seedId,
          complimentary: true,
          granted_by: 'system:seed_claim',
          granted_at: new Date().toISOString(),
          reason: 'Seed claim promo — module taste granted at claim for one year (see SEED_CLAIM_PROMO_GRANTS)',
        };

        await prisma.tenant_feature_purchases.upsert({
          where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: featureKey } },
          update: { source: 'seed_claim', status: 'active', expires_at: expiresAt, metadata, updated_at: new Date() },
          create: {
            tenant_id: tenantId,
            feature_key: featureKey,
            source: 'seed_claim',
            status: 'active',
            expires_at: expiresAt,
            metadata,
          },
        });
        granted.push(featureKey);
      }

      if (granted.length > 0) {
        invalidateEffectiveCapabilities(tenantId);
        logger.info('DirectoryClaimService — seed-claim promo grants applied', undefined, {
          seedId,
          tenantId,
          grants: granted,
        });
      }
      return granted;
    } catch (err: any) {
      logger.warn('DirectoryClaimService — seed-claim promo grant failed', undefined, {
        seedId,
        tenantId,
        error: { name: err?.name || 'Error', message: err?.message || String(err) },
      });
      return [];
    }
  }

  /**
   * Move the public listing off /place onto /directory.
   * Routing is origin-based: listing_origin = 'directory_seed' stays on
   * /place/{slug}; anything else (default 'claimed') lives at /directory/{slug}.
   */
  private async promoteListingToClaimed(tenantId: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE directory_listings_list
      SET listing_origin = 'claimed',
          public_disclaimer = NULL,
          updated_at = now()
      WHERE tenant_id = ${tenantId}
        AND listing_origin = 'directory_seed'
    `;
  }

  /**
   * Retire any live seed-preview storefronts sourced from the claimed seed's
   * tenant (spec §5e) — once the owner controls the real tenant, no preview
   * may remain publicly visible. Best-effort: a retirement failure must not
   * block the claim.
   */
  private async retireSeedPreviewStorefronts(tenantId: string): Promise<void> {
    try {
      const { retireSeedPreviewsForSource } = await import('../lib/seed-preview');
      const retired = await retireSeedPreviewsForSource(tenantId);
      if (retired > 0) {
        logger.info('[DirectoryClaim] Retired seed-preview storefront(s) on claim', undefined, {
          tenantId,
          retired,
        });
      }
    } catch (err: any) {
      logger.warn('[DirectoryClaim] Seed-preview retirement failed', undefined, {
        tenantId,
        error: { name: err?.name || 'Error', message: err?.message || String(err) },
      });
    }
  }

  /**
   * Populate the tenant business profile from the claimed directory listing.
   *
   * Mirrors the shape produced by PATCH /api/tenant/profile (the Edit Business
   * Profile modal). If a profile row already exists, only fills in fields that
   * are empty so we don't overwrite operator/owner edits. If no profile row
   * exists, creates one with the listing data.
   *
   * Also updates `tenants.name` to match the listing business name (when the
   * tenant name is empty or still the default placeholder).
   *
   * Non-fatal: logs a warning on failure so claim approval still succeeds.
   */
  private async populateTenantProfileFromListing(seedId: string, tenantId: string): Promise<void> {
    try {
      // Fetch the directory listing details
      const listingRows = await prisma.$queryRaw<any[]>`
        SELECT
          dl.business_name,
          dl.address,
          dl.city,
          dl.state,
          dl.zip_code,
          dl.phone,
          dl.email,
          dl.website,
          dl.logo_url,
          dl.description,
          dl.business_hours,
          dl.latitude,
          dl.longitude
        FROM directory_presence_seeds dps
        JOIN directory_listings_list dl ON dl.id = dps.listing_id
        WHERE dps.id = ${seedId}
        LIMIT 1
      `;
      const listing = listingRows[0];
      if (!listing) {
        logger.warn('[DirectoryClaim] No listing found for seed — skipping profile population', undefined, { seedId });
        return;
      }

      // Check if a tenant business profile already exists
      const existingRows = await prisma.$queryRaw<any[]>`
        SELECT tenant_id FROM tenant_business_profiles_list WHERE tenant_id = ${tenantId}
      `;
      const exists = existingRows.length > 0;

      if (exists) {
        // Only fill in fields that are currently empty/null — don't overwrite
        // anything the operator or owner has already set.
        const currentRows = await prisma.$queryRaw<any[]>`
          SELECT
            business_name, address_line1, city, state, postal_code, country_code,
            phone_number, email, website, logo_url, business_description, hours,
            latitude, longitude
          FROM tenant_business_profiles_list
          WHERE tenant_id = ${tenantId}
        `;
        const current = currentRows[0] || {};

        const updates: string[] = [];
        const values: any[] = [];

        const maybeAdd = (col: string, val: any, currentVal: any) => {
          if (val && (currentVal === null || currentVal === undefined || currentVal === '')) {
            values.push(val);
            updates.push(`"${col}" = $${values.length}`);
          }
        };

        maybeAdd('business_name', listing.business_name, current.business_name);
        maybeAdd('address_line1', listing.address, current.address_line1);
        maybeAdd('city', listing.city, current.city);
        maybeAdd('state', listing.state, current.state);
        maybeAdd('postal_code', listing.zip_code, current.postal_code);
        maybeAdd('phone_number', listing.phone, current.phone_number);
        maybeAdd('email', listing.email, current.email);
        maybeAdd('website', listing.website, current.website);
        maybeAdd('logo_url', listing.logo_url, current.logo_url);
        maybeAdd('business_description', listing.description, current.business_description);
        if (listing.business_hours && (current.hours === null || current.hours === undefined)) {
          values.push(listing.business_hours);
          updates.push(`"hours" = $${values.length}::jsonb`);
        }
        if (listing.latitude !== null && listing.latitude !== undefined && (current.latitude === null || current.latitude === undefined)) {
          values.push(listing.latitude);
          updates.push(`"latitude" = $${values.length}`);
        }
        if (listing.longitude !== null && listing.longitude !== undefined && (current.longitude === null || current.longitude === undefined)) {
          values.push(listing.longitude);
          updates.push(`"longitude" = $${values.length}`);
        }

        if (updates.length > 0) {
          values.push(tenantId);
          const updateQuery = `
            UPDATE tenant_business_profiles_list
            SET ${updates.join(', ')}, updated_at = now()
            WHERE tenant_id = $${values.length}
          `;
          await prisma.$executeRawUnsafe(updateQuery, ...values);
        }
      } else {
        // Create a new profile row with the listing data
        const businessName = listing.business_name || 'Unknown Business';
        const addressLine1 = listing.address || '';
        const city = listing.city || '';
        const state = listing.state || null;
        const postalCode = listing.zip_code || '';
        const countryCode = 'US';

        await prisma.$executeRaw`
          INSERT INTO tenant_business_profiles_list (
            tenant_id, business_name, address_line1, city, state, postal_code, country_code,
            phone_number, email, website, logo_url, business_description, hours,
            latitude, longitude, display_map, map_privacy_mode, updated_at
          ) VALUES (
            ${tenantId},
            ${businessName},
            ${addressLine1},
            ${city},
            ${state},
            ${postalCode},
            ${countryCode},
            ${listing.phone || null},
            ${listing.email || null},
            ${listing.website || null},
            ${listing.logo_url || null},
            ${listing.description || null},
            ${listing.business_hours || null}::jsonb,
            ${listing.latitude || null},
            ${listing.longitude || null},
            false,
            'precise',
            now()
          )
          ON CONFLICT (tenant_id) DO NOTHING
        `;
      }

      // Update tenant name if it's empty or a placeholder
      const tenantRows = await prisma.$queryRaw<any[]>`
        SELECT name FROM tenants WHERE id = ${tenantId}
      `;
      const tenantName = tenantRows[0]?.name;
      if (listing.business_name && (!tenantName || tenantName === 'New Tenant' || tenantName.trim() === '')) {
        await prisma.$executeRaw`
          UPDATE tenants SET name = ${listing.business_name}, updated_at = now() WHERE id = ${tenantId}
        `;
      }

      logger.info('[DirectoryClaim] Tenant profile populated from listing', undefined, {
        tenantId, seedId, businessName: listing.business_name,
      });
    } catch (e) {
      logger.warn('[DirectoryClaim] Tenant profile population failed (non-fatal)', undefined, {
        tenantId, seedId, error: (e as Error).message,
      });
    }
  }

  /**
   * Provision the GBP identity bridge (mkt_customer_gbp_links) for a claimed
   * directory seed. The seed tenant is the lightweight tenant row reused per
   * GBP Authorized Management Suite Spec §4 Subsystem 0 §1. Without this
   * bridge, the customer gets platform context (sees the GBP nav link) but
   * 404s on every /api/customer/marketing/gbp/* endpoint because
   * CustomerGBPAccessService.resolveTenant() finds no link row.
   *
   * Non-fatal: a provisioning failure must not block the claim. The customer
   * can still access the portal; GBP features show "no connection" until the
   * bridge is provisioned (e.g. by re-claiming or by an admin manually
   * creating the link).
   */
  private async provisionGbpBridge(customerId: string, tenantId: string): Promise<void> {
    try {
      const { CustomerGBPAccessService } = await import('./CustomerGBPAccessService');
      await CustomerGBPAccessService.getInstance().provisionLink(customerId, tenantId);
    } catch (e) {
      logger.warn('[DirectoryClaim] GBP bridge provisioning failed (non-fatal)', undefined, {
        customerId, tenantId, error: (e as Error).message,
      });
    }
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

  // ─── Claim proof attachments ────────────────────────────────────────

  /**
   * Upload a proof-of-ownership attachment for a pending claim request.
   * The claimant provides the claim token (from the claim URL) — we resolve
   * it to the pending request and store the file in the Supabase DISPUTES
   * bucket (reused for proof documents).
   *
   * Returns the attachment metadata so the frontend can show the uploaded
   * file list.
   */
  async uploadProofAttachment(
    token: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  ): Promise<{ attachmentId: string; fileName: string; fileType: string; fileSize: number }> {
    // Resolve token → pending claim request
    const rows = await prisma.$queryRaw<any[]>`
      SELECT dcr.id, dcr.status, dct.expires_at, dct.consumed_at
      FROM directory_claim_requests dcr
      JOIN directory_claim_tokens dct ON dct.id = dcr.token_id
      WHERE dct.token = ${token} AND dcr.status = 'pending'
      LIMIT 1
    `;
    if (!rows[0]) {
      throw new Error('No pending claim request found for this token');
    }

    const r = rows[0];
    const now = new Date();
    if (r.consumed_at) {
      throw new Error('Claim token already consumed');
    }
    if (new Date(r.expires_at) < now) {
      throw new Error('Claim token has expired');
    }

    // Upload to Supabase DISPUTES bucket
    const { createClient } = await import('@supabase/supabase-js');
    const { unifiedConfig } = await import('../config/unifiedConfig');
    const { StorageBuckets } = await import('../storage-config');
    const { mimeToFileType } = await import('../validators/recovery-intake.schema');

    const supabaseUrl = unifiedConfig.supabaseUrl;
    const supabaseKey = unifiedConfig.supabaseServiceRoleKey;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Storage backend not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const fileType = mimeToFileType(file.mimetype);
    const pathKey = `claim-${r.id}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error: uploadError } = await supabase.storage
      .from(StorageBuckets.DISPUTES.name)
      .upload(pathKey, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const attachmentId = `dca-${crypto.randomBytes(8).toString('hex')}`;
    await prisma.$executeRaw`
      INSERT INTO directory_claim_attachments (
        id, claim_request_id, file_url, file_name, file_type, file_size, uploaded_at
      ) VALUES (
        ${attachmentId},
        ${r.id},
        ${pathKey},
        ${file.originalname},
        ${fileType},
        ${file.size},
        now()
      )
    `;

    logger.info('[DirectoryClaim] Proof attachment uploaded', undefined, {
      requestId: r.id, attachmentId, fileName: file.originalname,
    });

    return {
      attachmentId,
      fileName: file.originalname,
      fileType,
      fileSize: file.size,
    };
  }

  /**
   * Upload a proof attachment by request ID + customer ID (customer-authenticated).
   * Used by the account dashboard where the claimant doesn't have the claim
   * token handy. Verifies the customer owns the pending request before storing.
   */
  async uploadProofAttachmentByRequestId(
    requestId: string,
    customerId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  ): Promise<{ attachmentId: string; fileName: string; fileType: string; fileSize: number }> {
    // Resolve customer email for email-match fallback
    const custRows = await prisma.$queryRaw<any[]>`
      SELECT email FROM customers WHERE id = ${customerId} LIMIT 1
    `;
    const email = custRows[0]?.email || null;

    const rows = await prisma.$queryRaw<any[]>`
      SELECT dcr.id, dcr.status, dct.expires_at, dct.consumed_at
      FROM directory_claim_requests dcr
      JOIN directory_claim_tokens dct ON dct.id = dcr.token_id
      WHERE dcr.id = ${requestId}
        AND dcr.status = 'pending'
        AND (dcr.customer_id = ${customerId}
             OR (dcr.customer_email IS NOT NULL AND dcr.customer_email = ${email}))
      LIMIT 1
    `;
    if (!rows[0]) {
      throw new Error('No pending claim request found for this customer');
    }

    const r = rows[0];
    if (r.consumed_at) {
      throw new Error('Claim token already consumed');
    }
    if (new Date(r.expires_at) < new Date()) {
      throw new Error('Claim token has expired');
    }

    // Upload to Supabase DISPUTES bucket
    const { createClient } = await import('@supabase/supabase-js');
    const { unifiedConfig } = await import('../config/unifiedConfig');
    const { StorageBuckets } = await import('../storage-config');
    const { mimeToFileType } = await import('../validators/recovery-intake.schema');

    const supabaseUrl = unifiedConfig.supabaseUrl;
    const supabaseKey = unifiedConfig.supabaseServiceRoleKey;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Storage backend not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const fileType = mimeToFileType(file.mimetype);
    const pathKey = `claim-${r.id}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error: uploadError } = await supabase.storage
      .from(StorageBuckets.DISPUTES.name)
      .upload(pathKey, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const attachmentId = `dca-${crypto.randomBytes(8).toString('hex')}`;
    await prisma.$executeRaw`
      INSERT INTO directory_claim_attachments (
        id, claim_request_id, file_url, file_name, file_type, file_size, uploaded_at
      ) VALUES (
        ${attachmentId},
        ${r.id},
        ${pathKey},
        ${file.originalname},
        ${fileType},
        ${file.size},
        now()
      )
    `;

    logger.info('[DirectoryClaim] Proof attachment uploaded (by requestId)', undefined, {
      requestId: r.id, attachmentId, fileName: file.originalname, customerId,
    });

    return {
      attachmentId,
      fileName: file.originalname,
      fileType,
      fileSize: file.size,
    };
  }

  /**
   * List proof attachments for a claim request (admin view).
   */
  async listProofAttachments(requestId: string): Promise<any[]> {
    return prisma.$queryRaw<any[]>`
      SELECT id, file_url, file_name, file_type, file_size, uploaded_at
      FROM directory_claim_attachments
      WHERE claim_request_id = ${requestId}
      ORDER BY uploaded_at ASC
    `;
  }

  /**
   * Download a proof attachment (admin view). Returns the file buffer +
   * metadata so the route handler can stream it to the operator.
   */
  async downloadProofAttachment(
    attachmentId: string,
  ): Promise<{ buffer: Buffer; fileName: string; fileType: string } | null> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT file_url, file_name, file_type FROM directory_claim_attachments
      WHERE id = ${attachmentId} LIMIT 1
    `;
    if (!rows[0]) return null;

    const { unifiedConfig } = await import('../config/unifiedConfig');
    const { StorageBuckets } = await import('../storage-config');
    const { createClient } = await import('@supabase/supabase-js');

    const supabaseUrl = unifiedConfig.supabaseUrl;
    const supabaseKey = unifiedConfig.supabaseServiceRoleKey;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Storage backend not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error: downloadError } = await supabase.storage
      .from(StorageBuckets.DISPUTES.name)
      .download(rows[0].file_url);

    if (downloadError || !data) {
      throw new Error(`Storage download failed: ${downloadError?.message || 'no data'}`);
    }

    return {
      buffer: Buffer.from(await data.arrayBuffer()),
      fileName: rows[0].file_name,
      fileType: rows[0].file_type,
    };
  }
}

export default new DirectoryClaimService();
