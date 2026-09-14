/**
 * Market Intel Customer Routes (Phase 2 + Phase 3)
 *
 * Authenticated customer routes for the seed page market-intel sidebar.
 *
 * Routes (mounted at /api/customer/place):
 *   GET  /:slug/market-intel/partial  — partial content for logged-in shoppers (§4.2)
 *   GET  /:slug/market-intel/full      — full content for paid/owner (§4.3)
 *   POST /:slug/market-intel/unlock    — checkout: create PI for single-report unlock (§6.2)
 *
 * Auth: `requireCustomerAuth` ONLY. Any logged-in customer qualifies for
 * /partial — do NOT apply `requirePlatformContext` (it 403s storefront-only
 * shoppers; /partial must work for any logged-in customer per spec §4.2).
 * /full and /unlock additionally require paid/owner access (checked inside).
 *
 * Spec: docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md (§4.2, §4.3, §6.2, §8.3)
 */
import { Router, Request, Response } from 'express';
import { MarketIntelService } from '../services/MarketIntelService';
import { MarketIntelAccessService, AccessTier } from '../services/MarketIntelAccessService';
import MarketingCampaignService from '../services/MarketingCampaignService';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';
import { CustomerTokenService } from '../services/CustomerTokenService';
import { MarketIntelReportPdfService } from '../services/marketing/MarketIntelReportPdfService';
import { logger } from '../logger';

const router = Router();
const service = MarketIntelService.getInstance();
const accessService = MarketIntelAccessService.getInstance();
const customerTokenService = CustomerTokenService.getInstance();

// Demo default price per spec §6.3 — $29 single-report, permanent, per business.
// Operator-overridable via platform_settings_list (unifiedConfig fallback).
const DEFAULT_UNLOCK_PRICE_CENTS = 2900;

// ── Auth middleware (requireCustomerAuth only — no requirePlatformContext) ─

const getCustomerId = (req: Request): string | null => {
  const token = CustomerTokenService.extractBearerToken(req);
  if (token) {
    const payload = customerTokenService.verifyAccessToken(token);
    if (payload) return payload.customerId;
  }
  if (req.cookies?.customer_session_id) {
    return req.cookies.customer_session_id;
  }
  return null;
};

const requireCustomerAuth = (req: Request, res: Response, next: Function) => {
  const customerId = getCustomerId(req);
  if (!customerId) {
    return res.status(401).json({ success: false, error: 'unauthorized', message: 'Not authenticated' });
  }
  (req as any).customerId = customerId;
  next();
};

/**
 * GET /api/customer/place/:slug/market-intel/partial
 * Returns partial content (top 2-3 items per card) for logged-in shoppers.
 */
router.get('/:slug/market-intel/partial', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const customerId = (req as any).customerId as string;
    if (!slug) return res.status(400).json({ success: false, error: 'slug_required' });

    const partial = await service.getPartialContent(slug, customerId);

    res.json({ success: true, data: partial });
  } catch (error) {
    logger.error('[GET /api/customer/place/:slug/market-intel/partial] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * GET /api/customer/place/:slug/market-intel/full
 * Returns full content for paid tenants or claimed owners.
 *
 * Access: a `market_intel_unlocks` row for (tenant, slug) OR claimed
 * ownership of this seed (§8.2). Returns 402 `unlock_required` when the
 * customer doesn't have access — the frontend shows the paywall.
 */
router.get('/:slug/market-intel/full', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const customerId = (req as any).customerId as string;
    if (!slug) return res.status(400).json({ success: false, error: 'slug_required' });

    const canAccess = await accessService.canAccessFull(customerId, 'place', slug);
    if (!canAccess) {
      return res.status(402).json({
        success: false,
        error: 'unlock_required',
        message: 'Unlock the full report to view this content.',
      });
    }

    const full = await service.getFullContent(slug);

    res.json({ success: true, data: full });
  } catch (error) {
    logger.error('[GET /api/customer/place/:slug/market-intel/full] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * GET /api/customer/place/:slug/market-intel/report.pdf
 * Downloads the PDF report for paid tenants or claimed owners.
 *
 * Access: same as /full — a `market_intel_unlocks` row OR claimed
 * ownership. Returns 402 JSON when the customer doesn't have access.
 *
 * Content-Type: application/pdf
 * Content-Disposition: inline; filename="market-intel-report-{slug}.pdf"
 */
router.get('/:slug/market-intel/report.pdf', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const customerId = (req as any).customerId as string;
    if (!slug) return res.status(400).json({ success: false, error: 'slug_required' });

    const canAccess = await accessService.canAccessFull(customerId, 'place', slug);
    if (!canAccess) {
      return res.status(402).json({
        success: false,
        error: 'unlock_required',
        message: 'Unlock the full report to download the PDF.',
      });
    }

    const fullContent = await service.getFullContent(slug);
    const { pdfBuffer, filename } = await MarketIntelReportPdfService.generate({
      businessSlug: slug,
      fullContent,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('[GET /api/customer/place/:slug/market-intel/report.pdf] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * POST /api/customer/place/:slug/market-intel/unlock
 * Checkout: creates a Stripe PaymentIntent for a single-report unlock.
 *
 * Paywall flow (§6.2):
 *   1. Customer must be logged in (requireCustomerAuth).
 *   2. If the customer owns this seed → 200 `already_owner` (free access).
 *   3. Resolve the customer's tenant. If null → 402 `tenant_required`
 *      (paywall step 1: tenant registration).
 *   4. Create a one-time PaymentIntent via SubscriptionBillingService.
 *   5. Return clientSecret — the frontend confirms with Stripe Elements.
 *
 * The actual unlock record + marketing_revenue row are written by a
 * separate confirm endpoint (or inline on confirmation) — this endpoint
 * only creates the PI. Keeping creation and confirmation separate mirrors
 * the marketing-ops-public pay flow and handles SCA fallback.
 */
router.post('/:slug/market-intel/unlock', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const customerId = (req as any).customerId as string;
    if (!slug) return res.status(400).json({ success: false, error: 'slug_required' });

    // Owner → free access, no purchase needed.
    const tier = await accessService.getAccessTier(customerId, 'place', slug);
    if (tier === AccessTier.Owner) {
      return res.json({
        success: true,
        data: { alreadyOwner: true, tier: AccessTier.Owner },
      });
    }

    // Already paid → no re-purchase needed.
    if (tier === AccessTier.Paid) {
      return res.json({
        success: true,
        data: { alreadyUnlocked: true, tier: AccessTier.Paid },
      });
    }

    // Resolve tenant for purchase. Null → paywall step 1.
    const tenantId = await accessService.resolveTenantForPurchase(customerId);
    if (!tenantId) {
      return res.status(402).json({
        success: false,
        error: 'tenant_required',
        message: 'A business (tenant) account is required to purchase a report.',
      });
    }

    const amountCents = DEFAULT_UNLOCK_PRICE_CENTS;
    const billingService = getSubscriptionBillingService();
    const piResult = await billingService.createOneTimePaymentIntent({
      amountCents,
      description: `Market Intel Report — ${slug}`,
      campaignId: `market-intel-${slug}`,
      metadata: {
        surface_type: 'place',
        surface_key: slug,
        tenant_id: tenantId,
        customer_id: customerId,
        unlock_type: 'single_report',
      },
    });

    if ('error' in piResult) {
      return res.status(400).json({ success: false, error: piResult.error });
    }

    res.json({
      success: true,
      data: {
        clientSecret: piResult.clientSecret,
        paymentIntentId: piResult.paymentIntentId,
        amountCents,
        tenantId,
      },
    });
  } catch (error) {
    logger.error('[POST /api/customer/place/:slug/market-intel/unlock] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * POST /api/customer/place/:slug/market-intel/unlock/confirm
 * Confirms a successful payment and records the unlock + revenue row.
 *
 * Called by the frontend after Stripe Elements confirmation succeeds.
 * Verifies the PI status with Stripe, then:
 *   1. recordUnlock (UPSERT on the unique key).
 *   2. recordMarketingRevenue with source='market_intel_unlock'.
 */
router.post('/:slug/market-intel/unlock/confirm', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const customerId = (req as any).customerId as string;
    const { paymentIntentId } = req.body ?? {};
    if (!slug || !paymentIntentId) {
      return res.status(400).json({ success: false, error: 'slug_and_paymentIntentId_required' });
    }

    // Verify the PI succeeded with Stripe.
    const billingService = getSubscriptionBillingService();
    const piStatus = await billingService.getPaymentIntentStatus(paymentIntentId);
    if ('error' in piStatus) {
      return res.status(400).json({ success: false, error: piStatus.error });
    }
    if (piStatus.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: `Payment not succeeded (status: ${piStatus.status})`,
      });
    }

    const charge = piStatus.charges?.[0];
    const gatewayTransactionId = charge?.id || paymentIntentId;

    // Resolve tenant (must exist — checked in /unlock).
    const tenantId = await accessService.resolveTenantForPurchase(customerId);
    if (!tenantId) {
      return res.status(402).json({
        success: false,
        error: 'tenant_required',
        message: 'A business (tenant) account is required to purchase a report.',
      });
    }

    // 1. Record the unlock (UPSERT).
    await accessService.recordUnlock({
      tenantId,
      customerId,
      surfaceType: 'place',
      surfaceKey: slug,
      unlockType: 'single_report',
      paymentIntentId,
    });

    // 2. Record the marketing_revenue row (source='market_intel_unlock').
    await MarketingCampaignService.recordMarketingRevenue({
      campaignId: `market-intel-${slug}`,
      amountCents: DEFAULT_UNLOCK_PRICE_CENTS,
      discountCents: 0,
      orderId: paymentIntentId,
      gatewayType: 'stripe',
      gatewayTransactionId,
      source: 'market_intel_unlock',
    });

    res.json({
      success: true,
      data: {
        unlocked: true,
        tier: AccessTier.Paid,
        gatewayTransactionId,
      },
    });
  } catch (error) {
    logger.error('[POST /api/customer/place/:slug/market-intel/unlock/confirm] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

export default router;
