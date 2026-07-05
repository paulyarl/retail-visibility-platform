/**
 * Promotion Routes — Directory Promotion lifecycle
 *
 * Tenant endpoints:
 *   GET    /api/tenants/:tenantId/promotion/status       — current promotion status
 *   GET    /api/tenants/:tenantId/promotion/plans         — list available plans
 *   POST   /api/tenants/:tenantId/promotion/purchase      — create Stripe checkout session
 *   POST   /api/tenants/:tenantId/promotion/renew         — renew existing promotion
 *   POST   /api/tenants/:tenantId/promotion/cancel        — cancel (lets current period expire)
 *   GET    /api/tenants/:tenantId/promotion/purchases      — list purchase history
 *   GET    /api/tenants/:tenantId/promotion/analytics      — analytics with CTR
 *   POST   /api/tenants/:tenantId/promotion/track-impression
 *   POST   /api/tenants/:tenantId/promotion/track-click
 *
 * Admin endpoints:
 *   GET    /api/admin/promotion/catalog                    — list all plans
 *   POST   /api/admin/promotion/catalog                    — create plan
 *   PUT    /api/admin/promotion/catalog/:planKey           — update plan
 *   DELETE /api/admin/promotion/catalog/:planKey           — deactivate plan
 *   GET    /api/admin/promotion/levels                     — list available promotion levels from capability features
 *   GET    /api/admin/promotion/purchases                   — list all purchases
 *   GET    /api/admin/promotion/revenue                     — revenue summary
 *   POST   /api/admin/promotion/grant-complimentary         — grant free promotion to tenant
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';
import DirectoryPromotionService from '../services/DirectoryPromotionService';
import { trackBadgeEvent } from '../services/BadgeAnalyticsService';

const router = Router();
const pool = getDirectPool();

// ====================
// TENANT ENDPOINTS
// ====================

/**
 * GET /api/tenants/:tenantId/promotion/status
 */
router.get('/tenants/:tenantId/promotion/status', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const result = await pool.query(
      `SELECT
        is_promoted,
        promotion_tier,
        promotion_started_at,
        promotion_expires_at,
        promotion_impressions,
        promotion_clicks
      FROM directory_listings_list
      WHERE tenant_id = $1
        AND (business_hours IS NULL OR business_hours::text != 'null')
      LIMIT 1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const listing = result.rows[0];

    const activePurchase = await DirectoryPromotionService.getInstance().getActivePurchase(tenantId);

    res.json({
      isPromoted: listing.is_promoted || false,
      promotionTier: listing.promotion_tier,
      promotionStartedAt: listing.promotion_started_at,
      promotionExpiresAt: listing.promotion_expires_at,
      promotionImpressions: listing.promotion_impressions || 0,
      promotionClicks: listing.promotion_clicks || 0,
      activePurchase: activePurchase || null,
    });
  } catch (error) {
    console.error('Error fetching promotion status:', error);
    res.status(500).json({ error: 'Failed to fetch promotion status' });
  }
});

/**
 * GET /api/tenants/:tenantId/promotion/plans
 */
router.get('/tenants/:tenantId/promotion/plans', async (req: Request, res: Response) => {
  try {
    const plans = await DirectoryPromotionService.getInstance().listCatalogPlans(false);
    res.json({ plans });
  } catch (error) {
    console.error('Error listing promotion plans:', error);
    res.status(500).json({ error: 'Failed to list promotion plans' });
  }
});

/**
 * POST /api/tenants/:tenantId/promotion/purchase
 */
router.post('/tenants/:tenantId/promotion/purchase', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { planKey, successUrl, cancelUrl } = req.body;

    if (!planKey || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'Missing required fields: planKey, successUrl, cancelUrl' });
    }

    const result = await DirectoryPromotionService.getInstance().createPurchase({
      tenantId,
      planKey,
      successUrl,
      cancelUrl,
    });

    res.json({
      purchaseId: result.purchaseId,
      checkoutUrl: result.checkoutUrl,
    });
  } catch (error) {
    const message = (error as Error).message;
    console.error('Error creating promotion purchase:', message);

    if (message === 'plan_not_found_or_inactive') {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }
    if (message === 'tenant_already_has_active_promotion') {
      return res.status(409).json({ error: 'Tenant already has an active promotion' });
    }
    if (message === 'tenant_has_no_directory_listing') {
      return res.status(404).json({ error: 'Tenant has no directory listing' });
    }
    if (message === 'stripe_not_configured') {
      return res.status(503).json({ error: 'Payment system not configured' });
    }

    res.status(500).json({ error: 'Failed to create promotion purchase' });
  }
});

/**
 * POST /api/tenants/:tenantId/promotion/renew
 */
router.post('/tenants/:tenantId/promotion/renew', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { purchaseId, successUrl, cancelUrl } = req.body;

    if (!purchaseId || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'Missing required fields: purchaseId, successUrl, cancelUrl' });
    }

    const result = await DirectoryPromotionService.getInstance().renewPurchase({
      purchaseId,
      successUrl,
      cancelUrl,
    });

    res.json({
      newPurchaseId: result.newPurchaseId,
      checkoutUrl: result.checkoutUrl,
    });
  } catch (error) {
    const message = (error as Error).message;
    console.error('Error renewing promotion:', message);

    if (message === 'purchase_not_found') {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    if (message === 'plan_not_found_or_inactive') {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }
    if (message === 'stripe_not_configured') {
      return res.status(503).json({ error: 'Payment system not configured' });
    }

    res.status(500).json({ error: 'Failed to renew promotion' });
  }
});

/**
 * POST /api/tenants/:tenantId/promotion/cancel
 */
router.post('/tenants/:tenantId/promotion/cancel', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    await DirectoryPromotionService.getInstance().cancelPromotion(tenantId);

    res.json({
      success: true,
      message: 'Promotion cancelled. It will remain active until the current period expires.',
    });
  } catch (error) {
    const message = (error as Error).message;
    console.error('Error cancelling promotion:', message);

    if (message === 'no_active_promotion') {
      return res.status(404).json({ error: 'No active promotion to cancel' });
    }

    res.status(500).json({ error: 'Failed to cancel promotion' });
  }
});

/**
 * GET /api/tenants/:tenantId/promotion/purchases
 */
router.get('/tenants/:tenantId/promotion/purchases', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const status = req.query.status as string | undefined;

    const purchases = await DirectoryPromotionService.getInstance().listTenantPurchases(tenantId, status ? { status } : {});
    res.json({ purchases });
  } catch (error) {
    console.error('Error listing promotion purchases:', error);
    res.status(500).json({ error: 'Failed to list promotion purchases' });
  }
});

/**
 * GET /api/tenants/:tenantId/promotion/analytics
 */
router.get('/tenants/:tenantId/promotion/analytics', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const result = await pool.query(
      `SELECT
        is_promoted,
        promotion_tier,
        promotion_started_at,
        promotion_expires_at,
        promotion_impressions,
        promotion_clicks,
        CASE
          WHEN promotion_impressions > 0
          THEN ROUND((promotion_clicks::numeric / promotion_impressions::numeric) * 100, 2)
          ELSE 0
        END as click_through_rate
      FROM directory_listings_list
      WHERE tenant_id = $1
        AND (business_hours IS NULL OR business_hours::text != 'null')
      LIMIT 1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const listing = result.rows[0];

    let daysActive = 0;
    if (listing.promotion_started_at) {
      const start = new Date(listing.promotion_started_at);
      const now = new Date();
      daysActive = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    const avgImpressionsPerDay = daysActive > 0 ? Math.round(listing.promotion_impressions / daysActive) : 0;
    const avgClicksPerDay = daysActive > 0 ? Math.round(listing.promotion_clicks / daysActive) : 0;

    res.json({
      isPromoted: listing.is_promoted || false,
      promotionTier: listing.promotion_tier,
      promotionStartedAt: listing.promotion_started_at,
      promotionExpiresAt: listing.promotion_expires_at,
      impressions: listing.promotion_impressions || 0,
      clicks: listing.promotion_clicks || 0,
      clickThroughRate: listing.click_through_rate || 0,
      daysActive,
      avgImpressionsPerDay,
      avgClicksPerDay,
    });
  } catch (error) {
    console.error('Error fetching promotion analytics:', error);
    res.status(500).json({ error: 'Failed to fetch promotion analytics' });
  }
});

/**
 * POST /api/tenants/:tenantId/promotion/track-impression
 */
router.post('/tenants/:tenantId/promotion/track-impression', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    await pool.query(
      `UPDATE directory_listings_list
      SET promotion_impressions = promotion_impressions + 1
      WHERE tenant_id = $1 AND is_promoted = TRUE`,
      [tenantId]
    );

    // Track badge event for unified analytics
    trackBadgeEvent({
      tenantId,
      badgeKey: 'directory_promoted',
      inventoryItemId: 'store-level',
      eventType: 'view',
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking impression:', error);
    res.status(500).json({ error: 'Failed to track impression' });
  }
});

/**
 * POST /api/tenants/:tenantId/promotion/track-click
 */
router.post('/tenants/:tenantId/promotion/track-click', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    await pool.query(
      `UPDATE directory_listings_list
      SET promotion_clicks = promotion_clicks + 1
      WHERE tenant_id = $1 AND is_promoted = TRUE`,
      [tenantId]
    );

    // Track badge event for unified analytics
    trackBadgeEvent({
      tenantId,
      badgeKey: 'directory_promoted',
      inventoryItemId: 'store-level',
      eventType: 'click',
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// ====================
// ADMIN ENDPOINTS
// ====================

/**
 * GET /api/admin/promotion/levels — available promotion levels from capability features
 */
router.get('/admin/promotion/levels', async (req: Request, res: Response) => {
  try {
    const levels = await DirectoryPromotionService.getInstance().getAvailableLevels();
    res.json({ levels });
  } catch (error) {
    console.error('Error fetching promotion levels:', error);
    res.status(500).json({ error: 'Failed to fetch promotion levels' });
  }
});

/**
 * GET /api/admin/promotion/catalog
 */
router.get('/admin/promotion/catalog', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const plans = await DirectoryPromotionService.getInstance().listCatalogPlans(includeInactive);
    res.json({ plans });
  } catch (error) {
    console.error('Error listing promotion catalog:', error);
    res.status(500).json({ error: 'Failed to list promotion catalog' });
  }
});

/**
 * POST /api/admin/promotion/catalog
 */
router.post('/admin/promotion/catalog', async (req: Request, res: Response) => {
  try {
    const { label, tier, durationDays, priceCents, currency, sortOrder, planKey } = req.body;

    if (!label || !tier || !durationDays || !priceCents) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const plan = await DirectoryPromotionService.getInstance().createCatalogPlan({
      label,
      tier,
      durationDays,
      priceCents,
      currency,
      sortOrder,
      planKey,
    });

    res.json({ plan });
  } catch (error) {
    const message = (error as Error).message;
    console.error('Error creating promotion catalog plan:', message);

    if (message === 'invalid_level') {
      return res.status(400).json({ error: 'Invalid promotion level. Must be a registered directory_promotion_level_* feature key.' });
    }
    if (message === 'plan_key_exists') {
      return res.status(409).json({ error: 'A plan with this level and duration already exists' });
    }

    res.status(500).json({ error: 'Failed to create promotion catalog plan' });
  }
});

/**
 * PUT /api/admin/promotion/catalog/:planKey
 */
router.put('/admin/promotion/catalog/:planKey', async (req: Request, res: Response) => {
  try {
    const { planKey } = req.params;
    const { label, tier, durationDays, priceCents, currency, isActive, sortOrder } = req.body;

    const plan = await DirectoryPromotionService.getInstance().updateCatalogPlan(planKey, {
      label,
      tier,
      durationDays,
      priceCents,
      currency,
      isActive,
      sortOrder,
    });

    res.json({ plan });
  } catch (error) {
    console.error('Error updating promotion catalog plan:', error);
    res.status(500).json({ error: 'Failed to update promotion catalog plan' });
  }
});

/**
 * DELETE /api/admin/promotion/catalog/:planKey
 */
router.delete('/admin/promotion/catalog/:planKey', async (req: Request, res: Response) => {
  try {
    const { planKey } = req.params;

    await DirectoryPromotionService.getInstance().deleteCatalogPlan(planKey);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating promotion catalog plan:', error);
    res.status(500).json({ error: 'Failed to deactivate promotion catalog plan' });
  }
});

/**
 * GET /api/admin/promotion/purchases
 */
router.get('/admin/promotion/purchases', async (req: Request, res: Response) => {
  try {
    const filters: { status?: string; tier?: string; tenantId?: string } = {};
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.tier) filters.tier = req.query.tier as string;
    if (req.query.tenantId) filters.tenantId = req.query.tenantId as string;

    const purchases = await DirectoryPromotionService.getInstance().listAllPurchases(filters);
    res.json({ purchases });
  } catch (error) {
    console.error('Error listing all promotion purchases:', error);
    res.status(500).json({ error: 'Failed to list promotion purchases' });
  }
});

/**
 * GET /api/admin/promotion/revenue
 */
router.get('/admin/promotion/revenue', async (req: Request, res: Response) => {
  try {
    const filters: { tier?: string; startDate?: Date; endDate?: Date } = {};
    if (req.query.tier) filters.tier = req.query.tier as string;
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

    const summary = await DirectoryPromotionService.getInstance().getRevenueSummary(filters);
    res.json({ summary });
  } catch (error) {
    console.error('Error fetching promotion revenue summary:', error);
    res.status(500).json({ error: 'Failed to fetch promotion revenue summary' });
  }
});

/**
 * GET /api/admin/promotion/stats — dashboard stats for CRM widget
 */
router.get('/admin/promotion/stats', async (req: Request, res: Response) => {
  try {
    const stats = await DirectoryPromotionService.getInstance().getDashboardStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching promotion dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch promotion dashboard stats' });
  }
});

/**
 * GET /api/admin/promotion/tenant/:tenantId — tenant-specific promotion data for CRM tab
 */
router.get('/admin/promotion/tenant/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const service = DirectoryPromotionService.getInstance();
    const [activePurchase, purchases] = await Promise.all([
      service.getActivePurchase(tenantId),
      service.listTenantPurchases(tenantId),
    ]);
    res.json({ activePurchase, purchases });
  } catch (error) {
    console.error('Error fetching tenant promotion data:', error);
    res.status(500).json({ error: 'Failed to fetch tenant promotion data' });
  }
});

/**
 * POST /api/admin/promotion/grant-complimentary — grant a tenant free promotion access
 */
router.post('/admin/promotion/grant-complimentary', async (req: Request, res: Response) => {
  try {
    const { tenantId, planKey, reason } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ error: 'tenantId is required' });
    }
    if (!planKey || typeof planKey !== 'string') {
      return res.status(400).json({ error: 'planKey is required' });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const service = DirectoryPromotionService.getInstance();
    const result = await service.grantComplimentary({
      tenantId,
      planKey,
      reason: reason.trim(),
      grantedBy: (req as any).user?.userId || 'admin',
    });

    res.json({ success: true, purchaseId: result.purchaseId });
  } catch (error: any) {
    const message = error?.message || 'Failed to grant complimentary promotion';
    const status = ['plan_not_found_or_inactive', 'tenant_already_has_active_promotion', 'tenant_has_no_directory_listing'].includes(message)
      ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
