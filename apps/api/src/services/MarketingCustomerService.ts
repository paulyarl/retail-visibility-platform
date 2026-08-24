/**
 * MarketingCustomerService — backend service for the Marketing Ops Customer
 * Portal claim flow and portal queries.
 *
 * Per MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md §4.4, §6.1.
 *
 * Phase 1 scope:
 *   - claimAllEligible(): the ONE claim service backing all three paths
 *     (A: ptoken, B: email-awareness, C: registration sweep).
 *   - Issue/validate/complete claim tokens (Path B).
 *
 * Phase 2 will add the portal query methods (overview, purchases, campaigns,
 * receipts) — those require the context-signal computation (§4.2) which is
 * Phase 2 work.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import { generateCustomerClaimTokenId, generateClaimTokenSecret, generateStageHistoryId } from '../lib/id-generator';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import type { RequestCtx } from '../context';
import { CustomerGBPAccessService } from './CustomerGBPAccessService';

export type ClaimPath = 'A' | 'B' | 'C' | 'operator_invite';

export interface ClaimResult {
  campaignsLinked: number;
  campaignNames: string[];
  campaigns: Array<{ id: string; businessName: string; serviceCategory?: string }>;
}

export interface ClaimTokenSummary {
  token: string;
  email: string;
  campaignCount: number;
  businessInitials: string;
  totalSpentRange: string;
  expiresAt: Date;
  isExpired: boolean;
  isClaimed: boolean;
}

const CLAIM_TOKEN_TTL_HOURS = 24;

/**
 * The ONE claim service. Links every paid, unclaimed campaign matching the
 * verified email to the customer — multi-campaign by construction.
 *
 * For Path A (ptoken), also links the specific campaign from the ptoken
 * regardless of email match (the payer may have paid with a different email
 * than they register with).
 *
 * Idempotent: re-claiming an already-claimed campaign by the same customer
 * returns success; by a different customer returns 409 (thrown as an error
 * with code 'already_claimed_by_other').
 */
export async function claimAllEligible(
  customerId: string,
  email: string,
  opts: { via: ClaimPath; specificCampaignId?: string; ctx?: RequestCtx },
): Promise<ClaimResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // Find all paid, unclaimed campaigns matching this email
  const eligibleCampaigns = await prisma.mkt_campaigns_list.findMany({
    where: {
      email: normalizedEmail,
      customer_id: null,
      date_paid: { not: null },
    },
    select: {
      id: true,
      business_name: true,
      service_category: true,
      customer_id: true,
      date_paid: true,
      tenant_id: true,
    },
  });

  // For Path A, include the specific campaign from the ptoken even if email
  // doesn't match (payer may have used a different email)
  let campaignIdsToLink = eligibleCampaigns.map((c) => c.id);
  if (opts.specificCampaignId && !campaignIdsToLink.includes(opts.specificCampaignId)) {
    const specificCampaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id: opts.specificCampaignId },
      select: { id: true, business_name: true, service_category: true, customer_id: true, date_paid: true, email: true, tenant_id: true },
    });
    if (specificCampaign && specificCampaign.date_paid) {
      // Check if already claimed by another customer
      if (specificCampaign.customer_id && specificCampaign.customer_id !== customerId) {
        throw Object.assign(new Error('Campaign already claimed by another customer'), { code: 'already_claimed_by_other' });
      }
      eligibleCampaigns.push(specificCampaign);
      campaignIdsToLink = eligibleCampaigns.map((c) => c.id);
    }
  }

  if (campaignIdsToLink.length === 0) {
    return { campaignsLinked: 0, campaignNames: [], campaigns: [] };
  }

  // Check for campaigns already claimed by a DIFFERENT customer (409 case)
  for (const campaign of eligibleCampaigns) {
    if (campaign.customer_id && campaign.customer_id !== customerId) {
      throw Object.assign(new Error(`Campaign ${campaign.id} already claimed by another customer`), { code: 'already_claimed_by_other' });
    }
  }

  // Link campaigns + their revenue records in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update all eligible campaigns
    await tx.mkt_campaigns_list.updateMany({
      where: { id: { in: campaignIdsToLink }, customer_id: null },
      data: { customer_id: customerId, updated_at: new Date() },
    });

    // Update all marketing_revenue rows for those campaigns
    const revenueUpdate = await tx.marketing_revenue.updateMany({
      where: { campaign_id: { in: campaignIdsToLink }, customer_id: null },
      data: { customer_id: customerId, updated_at: new Date() },
    });

    return { revenueRowsLinked: revenueUpdate.count };
  });

  // Write audit log + stage history for each linked campaign (outside the
  // transaction — audit failures must not roll back the claim)
  const linkedCampaigns = eligibleCampaigns.filter((c) => campaignIdsToLink.includes(c.id));
  for (const campaign of linkedCampaigns) {
    try {
      await audit({
        tenantId: PLATFORM_SCOPE,
        actor: customerId,
        actorType: 'customer',
        action: 'update',
        payload: {
          entity_type: 'other',
          id: campaign.id,
          claim_path: opts.via,
          customer_id: customerId,
          campaign_id: campaign.id,
          action_description: 'customer_claim',
        },
      });

      // Stage history note so operators see "Customer claimed account" in the timeline
      await prisma.mkt_stage_history_list.create({
        data: {
          id: generateStageHistoryId(),
          campaign_id: campaign.id,
          from_stage: null,
          to_stage: 'claimed',
          changed_by: customerId,
          notes: `Customer claimed account (via Path ${opts.via})`,
          trigger_type: 'customer_claim',
        },
      });
    } catch (e) {
      logger.error('[MarketingCustomerService] Audit/stage history write failed', undefined, {
        campaignId: campaign.id,
        error: (e as Error).message,
      });
    }
  }

  // Provision GBP identity bridge links for GBP-scoped campaigns.
  // A campaign is "GBP-scoped" if its service_category is gbp_optimization or
  // review_management (both involve Google Business Profile management).
  // The bridge links the customer to the campaign's tenant, enabling
  // CustomerGBPAccessService.resolveTenant() to work for the customer portal.
  // Idempotent: re-claiming an already-linked campaign is a no-op.
  const GBP_SCOPED_CATEGORIES = new Set(['gbp_optimization', 'review_management']);
  const gbpScopedCampaigns = linkedCampaigns.filter(
    (c) => c.tenant_id && c.service_category && GBP_SCOPED_CATEGORIES.has(c.service_category),
  );
  for (const campaign of gbpScopedCampaigns) {
    try {
      await CustomerGBPAccessService.getInstance().provisionLink(
        customerId,
        campaign.tenant_id!,
        campaign.id,
      );
    } catch (e) {
      // Non-fatal — bridge provisioning failure must not block the claim.
      // The customer can still access the portal; GBP features will show
      // "no connection" until the bridge is provisioned (e.g. by re-claiming
      // or by an admin manually creating the link).
      logger.error('[MarketingCustomerService] GBP bridge provisioning failed', undefined, {
        campaignId: campaign.id,
        tenantId: campaign.tenant_id,
        error: (e as Error).message,
      });
    }
  }

  logger.info('[MarketingCustomerService] Claim completed', undefined, {
    customerId,
    email: normalizedEmail,
    via: opts.via,
    campaignsLinked: linkedCampaigns.length,
    revenueRowsLinked: result.revenueRowsLinked,
  });

  return {
    campaignsLinked: linkedCampaigns.length,
    campaignNames: linkedCampaigns.map((c) => c.business_name || 'Unknown'),
    campaigns: linkedCampaigns.map((c) => ({
      id: c.id,
      businessName: c.business_name || 'Unknown',
      serviceCategory: c.service_category || undefined,
    })),
  };
}

/**
 * Path B: Issue a claim token for an email address.
 * Voids prior unclaimed tokens for that email (only one active token at a time).
 * Returns the token string (caller sends the email).
 */
export async function issueClaimToken(email: string): Promise<{ token: string; campaignIds: string[] } | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Find paid, unclaimed campaigns matching this email
  const eligibleCampaigns = await prisma.mkt_campaigns_list.findMany({
    where: {
      email: normalizedEmail,
      customer_id: null,
      date_paid: { not: null },
    },
    select: { id: true },
  });

  if (eligibleCampaigns.length === 0) {
    return null; // no eligible campaigns — caller returns generic message
  }

  const campaignIds = eligibleCampaigns.map((c) => c.id);

  // Void prior unclaimed tokens for this email
  await prisma.mkt_customer_claim_tokens.updateMany({
    where: {
      email: normalizedEmail,
      claimed_at: null,
    },
    data: { claimed_at: new Date() }, // marking as claimed voids them (they can't be used)
  });

  // Issue a new token
  const tokenRow = await prisma.mkt_customer_claim_tokens.create({
    data: {
      id: generateCustomerClaimTokenId(),
      token: generateClaimTokenSecret(),
      email: normalizedEmail,
      campaign_ids: campaignIds,
      expires_at: new Date(Date.now() + CLAIM_TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  return { token: tokenRow.token, campaignIds };
}

/**
 * Path B: Validate a claim token and return a masked summary for the landing
 * page. Never returns full purchase details pre-auth.
 */
export async function getClaimTokenSummary(token: string): Promise<ClaimTokenSummary | null> {
  const tokenRow = await prisma.mkt_customer_claim_tokens.findUnique({
    where: { token },
  });

  if (!tokenRow) return null;

  const now = new Date();
  const isExpired = tokenRow.expires_at < now;
  const isClaimed = !!tokenRow.claimed_at;

  if (isExpired || isClaimed) {
    return {
      token: tokenRow.token,
      email: tokenRow.email,
      campaignCount: 0,
      businessInitials: '',
      totalSpentRange: '',
      expiresAt: tokenRow.expires_at,
      isExpired,
      isClaimed,
    };
  }

  // Re-derive eligible campaigns at lookup time (a campaign paid after the
  // email was sent is still claimable)
  const eligibleCampaigns = await prisma.mkt_campaigns_list.findMany({
    where: {
      email: tokenRow.email,
      customer_id: null,
      date_paid: { not: null },
    },
    select: { id: true, business_name: true },
  });

  // Get total spent across those campaigns
  const revenueRows = await prisma.marketing_revenue.findMany({
    where: { campaign_id: { in: eligibleCampaigns.map((c) => c.id) } },
    select: { amount_cents: true },
  });
  const totalSpentCents = revenueRows.reduce((sum, r) => sum + r.amount_cents, 0);

  // Mask: business initials only (e.g., "J's Plumbing" → "J's P…")
  const businessInitials = eligibleCampaigns.length > 0
    ? eligibleCampaigns[0].business_name?.slice(0, 3) + '…' || '?'
    : '';

  // Mask: total spent as a range (e.g., "$100-$500", "$500+")
  const totalSpentRange = maskTotalSpent(totalSpentCents);

  return {
    token: tokenRow.token,
    email: tokenRow.email,
    campaignCount: eligibleCampaigns.length,
    businessInitials,
    totalSpentRange,
    expiresAt: tokenRow.expires_at,
    isExpired: false,
    isClaimed: false,
  };
}

/**
 * Path B: Mark a claim token as consumed (called after successful register/login
 * + claimAllEligible).
 */
export async function consumeClaimToken(token: string): Promise<void> {
  await prisma.mkt_customer_claim_tokens.update({
    where: { token },
    data: { claimed_at: new Date() },
  });
}

/**
 * Path C: Registration claim sweep. Called after a customer registers or
 * verifies their email. Silently links any paid, unclaimed campaigns matching
 * the verified email. Mirrors CustomerAuthService.reconcileGuestOrders.
 *
 * Per §4.3 Path C: the sweep only executes for VERIFIED emails. The caller
 * must ensure email_verified is true before calling this.
 */
export async function registrationClaimSweep(customerId: string, email: string, ctx?: RequestCtx): Promise<ClaimResult> {
  return claimAllEligible(customerId, email, { via: 'C', ctx });
}

// ── Helpers ──────────────────────────────────────────────────────────────

function maskTotalSpent(cents: number): string {
  if (cents <= 0) return '';
  if (cents < 10000) return 'Under $100';
  if (cents < 50000) return '$100–$500';
  if (cents < 100000) return '$500–$1,000';
  if (cents < 500000) return '$1,000–$5,000';
  return '$5,000+';
}

export const MarketingCustomerService = {
  claimAllEligible,
  issueClaimToken,
  getClaimTokenSummary,
  consumeClaimToken,
  registrationClaimSweep,
};

export default MarketingCustomerService;
