/**
 * Market Intel — customer routes for category + city surfaces (§12.4).
 *
 * Mounted at:
 *   /api/customer/directory/category  → category full/pdf/unlock
 *   /api/customer/directory/city       → city full/pdf/unlock
 *
 * Auth: requireCustomerAuth ONLY (no requirePlatformContext — §8.3).
 */
import { Router, Request, Response } from 'express';
import { MarketIntelService } from '../services/MarketIntelService';
import { MarketIntelAccessService } from '../services/MarketIntelAccessService';
import MarketingCampaignService from '../services/MarketingCampaignService';
import { MarketIntelReportPdfService } from '../services/marketing/MarketIntelReportPdfService';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';
import { CustomerTokenService } from '../services/CustomerTokenService';
import { logger } from '../logger';

const router = Router();
const service = MarketIntelService.getInstance();
const accessService = MarketIntelAccessService.getInstance();
const customerTokenService = CustomerTokenService.getInstance();

// Demo default — operator-overridable via platform_settings_list (unifiedConfig fallback).
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "kansas-city-mo" → { city: "Kansas City", state: "MO" }. */
function parseCitySlug(citySlug: string): { city: string; state: string } | null {
  const parts = decodeURIComponent(citySlug).split('-');
  if (parts.length < 2) return null;
  const state = parts.pop()!.toUpperCase();
  const city = parts.join(' ');
  return { city, state };
}

// ─── Category surface ─────────────────────────────────────────────────────

/**
 * GET /api/customer/directory/category/:categorySlug/market-intel/full
 * Query: city (required — "__all__" for national), state (required when city !== "__all__")
 */
router.get('/category/:categorySlug/market-intel/full', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    const city = (req.query.city as string) || '__all__';
    const state = (req.query.state as string) || null;
    const customerId = (req as any).customerId as string;
    if (!categorySlug) return res.status(400).json({ success: false, error: 'category_slug_required' });

    const surfaceKey = `${categorySlug}:${city}:${state ?? '__all__'}`;
    const canAccess = await accessService.canAccessFull(customerId, 'category', surfaceKey);
    if (!canAccess) {
      return res.status(402).json({
        success: false,
        error: 'unlock_required',
        message: 'Unlock the full category report to view this content.',
      });
    }

    const full = await service.getCategoryFullContent(categorySlug, city, state);
    res.json({ success: true, data: full });
  } catch (error) {
    logger.error('[GET /api/customer/directory/category/:categorySlug/market-intel/full] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * GET /api/customer/directory/category/:categorySlug/market-intel/report.pdf
 */
router.get('/category/:categorySlug/market-intel/report.pdf', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    const city = (req.query.city as string) || '__all__';
    const state = (req.query.state as string) || null;
    const customerId = (req as any).customerId as string;
    if (!categorySlug) return res.status(400).json({ success: false, error: 'category_slug_required' });

    const surfaceKey = `${categorySlug}:${city}:${state ?? '__all__'}`;
    const canAccess = await accessService.canAccessFull(customerId, 'category', surfaceKey);
    if (!canAccess) {
      return res.status(402).json({ success: false, error: 'unlock_required' });
    }

    const fullContent = await service.getCategoryFullContent(categorySlug, city, state);
    const { pdfBuffer, filename } = await MarketIntelReportPdfService.generateCategoryReport({
      categorySlug,
      city,
      state,
      fullContent,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('[GET /api/customer/directory/category/:categorySlug/market-intel/report.pdf] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * POST /api/customer/directory/category/:categorySlug/market-intel/unlock
 * Creates a Stripe PaymentIntent for the category report unlock.
 */
router.post('/category/:categorySlug/market-intel/unlock', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    const city = (req.query.city as string) || '__all__';
    const state = (req.query.state as string) || null;
    const customerId = (req as any).customerId as string;
    if (!categorySlug) return res.status(400).json({ success: false, error: 'category_slug_required' });

    const surfaceKey = `${categorySlug}:${city}:${state ?? '__all__'}`;

    // Admin bypass — no payment needed.
    const isPlatformAdmin = await accessService.isPlatformAdmin(customerId);
    if (isPlatformAdmin) {
      return res.json({ success: true, data: { alreadyUnlocked: true } });
    }

    // Resolve tenant for purchase.
    const tenantId = await accessService.resolveTenantForPurchase(customerId);
    if (!tenantId) {
      return res.status(402).json({
        success: false,
        error: 'tenant_required',
        message: 'A business account is required to purchase reports.',
      });
    }

    // Check if already unlocked.
    const alreadyUnlocked = await accessService.canAccessFull(customerId, 'category', surfaceKey);
    if (alreadyUnlocked) {
      return res.json({ success: true, data: { alreadyUnlocked: true } });
    }

    // Create Stripe PaymentIntent.
    const billingService = getSubscriptionBillingService();
    const piResult = await billingService.createOneTimePaymentIntent({
      amountCents: DEFAULT_UNLOCK_PRICE_CENTS,
      description: `Market Intel Category Report — ${categorySlug}`,
      campaignId: `market-intel-category-${surfaceKey}`,
      metadata: {
        surfaceType: 'category',
        surfaceKey,
        customerId,
        tenantId,
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
        amountCents: DEFAULT_UNLOCK_PRICE_CENTS,
        tenantId,
      },
    });
  } catch (error) {
    logger.error('[POST /api/customer/directory/category/:categorySlug/market-intel/unlock] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * POST /api/customer/directory/category/:categorySlug/market-intel/unlock/confirm
 * Confirms the Stripe payment and records the unlock.
 */
router.post('/category/:categorySlug/market-intel/unlock/confirm', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    const city = (req.query.city as string) || '__all__';
    const state = (req.query.state as string) || null;
    const customerId = (req as any).customerId as string;
    const { paymentIntentId } = req.body ?? {};
    if (!categorySlug || !paymentIntentId) {
      return res.status(400).json({ success: false, error: 'missing_params' });
    }

    const surfaceKey = `${categorySlug}:${city}:${state ?? '__all__'}`;

    // Verify the PI succeeded with Stripe.
    const billingService = getSubscriptionBillingService();
    const piStatus = await billingService.getPaymentIntentStatus(paymentIntentId);
    if ('error' in piStatus) {
      return res.status(400).json({ success: false, error: piStatus.error });
    }
    if (piStatus.status !== 'succeeded') {
      return res.status(402).json({ success: false, error: 'payment_not_succeeded', status: piStatus.status });
    }

    const charge = piStatus.charges?.[0];
    const gatewayTransactionId = charge?.id || paymentIntentId;

    // Resolve tenant (must exist — checked in /unlock).
    const tenantId = await accessService.resolveTenantForPurchase(customerId);
    if (!tenantId) {
      return res.status(402).json({ success: false, error: 'tenant_required' });
    }

    // 1. Record the unlock.
    await accessService.recordUnlock({
      tenantId,
      customerId,
      surfaceType: 'category',
      surfaceKey,
      unlockType: 'single_report',
      paymentIntentId,
    });

    // 2. Record the marketing_revenue row.
    await MarketingCampaignService.recordMarketingRevenue({
      campaignId: `market-intel-category-${surfaceKey}`,
      amountCents: DEFAULT_UNLOCK_PRICE_CENTS,
      discountCents: 0,
      orderId: paymentIntentId,
      gatewayType: 'stripe',
      gatewayTransactionId,
      source: 'market_intel_unlock',
    });

    res.json({ success: true, data: { unlocked: true } });
  } catch (error) {
    logger.error('[POST /api/customer/directory/category/:categorySlug/market-intel/unlock/confirm] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ─── City surface ──────────────────────────────────────────────────────────

/**
 * GET /api/customer/directory/city/:citySlug/market-intel/full
 */
router.get('/city/:citySlug/market-intel/full', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { citySlug } = req.params;
    const customerId = (req as any).customerId as string;
    if (!citySlug) return res.status(400).json({ success: false, error: 'city_slug_required' });

    const parsed = parseCitySlug(citySlug);
    if (!parsed) return res.status(400).json({ success: false, error: 'invalid_city_slug' });
    const { city, state } = parsed;
    const surfaceKey = `${city}:${state}`;

    const canAccess = await accessService.canAccessFull(customerId, 'city', surfaceKey);
    if (!canAccess) {
      return res.status(402).json({
        success: false,
        error: 'unlock_required',
        message: 'Unlock the full city report to view this content.',
      });
    }

    const full = await service.getCityFullContent(city, state);
    res.json({ success: true, data: full });
  } catch (error) {
    logger.error('[GET /api/customer/directory/city/:citySlug/market-intel/full] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * GET /api/customer/directory/city/:citySlug/market-intel/report.pdf
 */
router.get('/city/:citySlug/market-intel/report.pdf', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { citySlug } = req.params;
    const customerId = (req as any).customerId as string;
    if (!citySlug) return res.status(400).json({ success: false, error: 'city_slug_required' });

    const parsed = parseCitySlug(citySlug);
    if (!parsed) return res.status(400).json({ success: false, error: 'invalid_city_slug' });
    const { city, state } = parsed;
    const surfaceKey = `${city}:${state}`;

    const canAccess = await accessService.canAccessFull(customerId, 'city', surfaceKey);
    if (!canAccess) {
      return res.status(402).json({ success: false, error: 'unlock_required' });
    }

    const fullContent = await service.getCityFullContent(city, state);
    const { pdfBuffer, filename } = await MarketIntelReportPdfService.generateCityReport({
      city,
      state,
      fullContent,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('[GET /api/customer/directory/city/:citySlug/market-intel/report.pdf] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * POST /api/customer/directory/city/:citySlug/market-intel/unlock
 */
router.post('/city/:citySlug/market-intel/unlock', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { citySlug } = req.params;
    const customerId = (req as any).customerId as string;
    if (!citySlug) return res.status(400).json({ success: false, error: 'city_slug_required' });

    const parsed = parseCitySlug(citySlug);
    if (!parsed) return res.status(400).json({ success: false, error: 'invalid_city_slug' });
    const { city, state } = parsed;
    const surfaceKey = `${city}:${state}`;

    const isPlatformAdmin = await accessService.isPlatformAdmin(customerId);
    if (isPlatformAdmin) {
      return res.json({ success: true, data: { alreadyUnlocked: true } });
    }

    const tenantId = await accessService.resolveTenantForPurchase(customerId);
    if (!tenantId) {
      return res.status(402).json({ success: false, error: 'tenant_required' });
    }

    const alreadyUnlocked = await accessService.canAccessFull(customerId, 'city', surfaceKey);
    if (alreadyUnlocked) {
      return res.json({ success: true, data: { alreadyUnlocked: true } });
    }

    const billingService = getSubscriptionBillingService();
    const piResult = await billingService.createOneTimePaymentIntent({
      amountCents: DEFAULT_UNLOCK_PRICE_CENTS,
      description: `Market Intel City Report — ${city}, ${state}`,
      campaignId: `market-intel-city-${surfaceKey}`,
      metadata: { surfaceType: 'city', surfaceKey, customerId, tenantId },
    });

    if ('error' in piResult) {
      return res.status(400).json({ success: false, error: piResult.error });
    }

    res.json({
      success: true,
      data: {
        clientSecret: piResult.clientSecret,
        paymentIntentId: piResult.paymentIntentId,
        amountCents: DEFAULT_UNLOCK_PRICE_CENTS,
        tenantId,
      },
    });
  } catch (error) {
    logger.error('[POST /api/customer/directory/city/:citySlug/market-intel/unlock] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * POST /api/customer/directory/city/:citySlug/market-intel/unlock/confirm
 */
router.post('/city/:citySlug/market-intel/unlock/confirm', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { citySlug } = req.params;
    const customerId = (req as any).customerId as string;
    const { paymentIntentId } = req.body ?? {};
    if (!citySlug || !paymentIntentId) {
      return res.status(400).json({ success: false, error: 'missing_params' });
    }

    const parsed = parseCitySlug(citySlug);
    if (!parsed) return res.status(400).json({ success: false, error: 'invalid_city_slug' });
    const { city, state } = parsed;
    const surfaceKey = `${city}:${state}`;

    // Verify the PI succeeded with Stripe.
    const billingService = getSubscriptionBillingService();
    const piStatus = await billingService.getPaymentIntentStatus(paymentIntentId);
    if ('error' in piStatus) {
      return res.status(400).json({ success: false, error: piStatus.error });
    }
    if (piStatus.status !== 'succeeded') {
      return res.status(402).json({ success: false, error: 'payment_not_succeeded', status: piStatus.status });
    }

    const charge = piStatus.charges?.[0];
    const gatewayTransactionId = charge?.id || paymentIntentId;

    const tenantId = await accessService.resolveTenantForPurchase(customerId);
    if (!tenantId) {
      return res.status(402).json({ success: false, error: 'tenant_required' });
    }

    // 1. Record the unlock.
    await accessService.recordUnlock({
      tenantId,
      customerId,
      surfaceType: 'city',
      surfaceKey,
      unlockType: 'single_report',
      paymentIntentId,
    });

    // 2. Record the marketing_revenue row.
    await MarketingCampaignService.recordMarketingRevenue({
      campaignId: `market-intel-city-${surfaceKey}`,
      amountCents: DEFAULT_UNLOCK_PRICE_CENTS,
      discountCents: 0,
      orderId: paymentIntentId,
      gatewayType: 'stripe',
      gatewayTransactionId,
      source: 'market_intel_unlock',
    });

    res.json({ success: true, data: { unlocked: true } });
  } catch (error) {
    logger.error('[POST /api/customer/directory/city/:citySlug/market-intel/unlock/confirm] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

export default router;
