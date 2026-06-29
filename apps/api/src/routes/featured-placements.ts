/**
 * Featured Placement Routes
 *
 * Admin CRUD:   /api/admin/featured-placement/catalog
 * Tenant:       /api/tenants/:tenantId/featured-placements
 * Revenue:      /api/admin/featured-placement/revenue
 * Analytics:    /api/tenants/:tenantId/featured-placements/analytics
 *               /api/tenants/:tenantId/featured-placements/store-analytics
 *               /api/admin/featured-placements/analytics
 *               /api/admin/featured-placements/revenue-analytics
 *
 * Design doc: docs/FEATURED_VISIBILITY_CHANNELS_DESIGN.md (Phase 4 + Sprint 6)
 */

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import FeaturedPlacementService from '../services/FeaturedPlacementService';
import FeaturedPlacementAnalyticsService from '../services/FeaturedPlacementAnalyticsService';

const router = Router();
const service = FeaturedPlacementService.getInstance();
const analyticsService = FeaturedPlacementAnalyticsService;

// ====================
// ADMIN: CATALOG CRUD
// ====================

router.get('/admin/featured-placement/catalog', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const includeInactive = _req.query.includeInactive === 'true';
    const plans = await service.listCatalogPlans(includeInactive);
    res.json({ plans });
  } catch (error) {
    console.error('[featured-placement] Failed to list catalog:', error);
    res.status(500).json({ error: 'failed_to_list_catalog' });
  }
});

router.post('/admin/featured-placement/catalog', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { planKey, label, surface, durationDays, priceCents, currency, sortOrder } = req.body;
    if (!planKey || !label || !surface || !durationDays || !priceCents) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }
    const plan = await service.createCatalogPlan({ planKey, label, surface, durationDays, priceCents, currency, sortOrder });
    res.status(201).json({ plan });
  } catch (error) {
    console.error('[featured-placement] Failed to create catalog plan:', error);
    res.status(500).json({ error: 'failed_to_create_plan' });
  }
});

router.put('/admin/featured-placement/catalog/:planKey', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { planKey } = req.params;
    const updates = req.body;
    const plan = await service.updateCatalogPlan(planKey, updates);
    res.json({ plan });
  } catch (error) {
    console.error('[featured-placement] Failed to update catalog plan:', error);
    res.status(500).json({ error: 'failed_to_update_plan' });
  }
});

router.delete('/admin/featured-placement/catalog/:planKey', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { planKey } = req.params;
    await service.deleteCatalogPlan(planKey);
    res.json({ success: true });
  } catch (error) {
    console.error('[featured-placement] Failed to delete catalog plan:', error);
    res.status(500).json({ error: 'failed_to_delete_plan' });
  }
});

// ====================
// ADMIN: ALL PURCHASES
// ====================

router.get('/admin/featured-placement/purchases', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.surface) filters.surface = req.query.surface as string;
    if (req.query.tenantId) filters.tenantId = req.query.tenantId as string;
    const purchases = await service.listAllPurchases(filters);
    res.json({ purchases });
  } catch (error) {
    console.error('[featured-placement] Failed to list purchases:', error);
    res.status(500).json({ error: 'failed_to_list_purchases' });
  }
});

// ====================
// ADMIN: REVOKE
// ====================

router.post('/admin/featured-placement/purchases/:purchaseId/revoke', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { reason } = req.body;
    await service.revokePurchase(purchaseId, reason || 'Admin revoked');
    res.json({ success: true });
  } catch (error) {
    console.error('[featured-placement] Failed to revoke purchase:', error);
    const msg = (error as Error).message;
    if (msg === 'purchase_not_found') {
      return res.status(404).json({ error: msg });
    }
    res.status(500).json({ error: 'failed_to_revoke' });
  }
});

// ====================
// ADMIN: REVENUE
// ====================

router.get('/admin/featured-placement/revenue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const filters: any = {};
    if (req.query.surface) filters.surface = req.query.surface as string;
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    const summary = await service.getRevenueSummary(filters);
    res.json({ summary });
  } catch (error) {
    console.error('[featured-placement] Failed to get revenue:', error);
    res.status(500).json({ error: 'failed_to_get_revenue' });
  }
});

// ====================
// TENANT: LIST PURCHASES
// ====================

router.get('/tenants/:tenantId/featured-placements', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status as string;
    const purchases = await service.listTenantPurchases(tenantId, filters);
    res.json({ purchases });
  } catch (error) {
    console.error('[featured-placement] Failed to list tenant purchases:', error);
    res.status(500).json({ error: 'failed_to_list_purchases' });
  }
});

// ====================
// TENANT: CREATE PURCHASE (initiate checkout)
// ====================

router.post('/tenants/:tenantId/featured-placements', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { inventoryItemId, planKey, successUrl, cancelUrl } = req.body;
    if (!inventoryItemId || !planKey || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }
    const result = await service.createPurchase({ tenantId, inventoryItemId, planKey, successUrl, cancelUrl });
    res.status(201).json(result);
  } catch (error) {
    console.error('[featured-placement] Failed to create purchase:', error);
    const msg = (error as Error).message;
    if (msg.includes('not_found') || msg.includes('inactive') || msg.includes('already')) {
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'failed_to_create_purchase' });
  }
});

// ====================
// TENANT: RENEW PURCHASE
// ====================

router.post('/tenants/:tenantId/featured-placements/:purchaseId/renew', authenticateToken, async (req, res) => {
  try {
    const { tenantId, purchaseId } = req.params;
    const { successUrl, cancelUrl } = req.body;
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }
    const result = await service.renewPurchase({ purchaseId, successUrl, cancelUrl });
    res.status(201).json(result);
  } catch (error) {
    console.error('[featured-placement] Failed to renew purchase:', error);
    const msg = (error as Error).message;
    if (msg.includes('not_found') || msg.includes('inactive')) {
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'failed_to_renew' });
  }
});

// ====================
// TENANT: GET SINGLE PURCHASE
// ====================

router.get('/tenants/:tenantId/featured-placements/:purchaseId', authenticateToken, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const purchase = await service.getPurchase(purchaseId);
    if (!purchase) {
      return res.status(404).json({ error: 'purchase_not_found' });
    }
    res.json({ purchase });
  } catch (error) {
    console.error('[featured-placement] Failed to get purchase:', error);
    res.status(500).json({ error: 'failed_to_get_purchase' });
  }
});

// ====================
// TENANT: PLACEMENT ANALYTICS (per-placement ROI + lift)
// ====================

router.get('/tenants/:tenantId/featured-placements/analytics', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const status = req.query.status as string | undefined;
    const result = await analyticsService.getTenantPlacementAnalytics(tenantId, { status });
    res.json(result);
  } catch (error) {
    console.error('[featured-placement] Failed to get analytics:', error);
    res.status(500).json({ error: 'failed_to_get_analytics' });
  }
});

// ====================
// TENANT: STORE ANALYTICS (purchase history, spend, renewal)
// ====================

router.get('/tenants/:tenantId/featured-placements/store-analytics', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await analyticsService.getStoreAnalytics(tenantId);
    res.json(result);
  } catch (error) {
    console.error('[featured-placement] Failed to get store analytics:', error);
    res.status(500).json({ error: 'failed_to_get_store_analytics' });
  }
});

// ====================
// ADMIN: PLATFORM REVENUE ANALYTICS
// ====================

router.get('/admin/featured-placements/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const options: { startDate?: Date; endDate?: Date } = {};
    if (req.query.startDate) options.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) options.endDate = new Date(req.query.endDate as string);
    const result = await analyticsService.getPlatformRevenueAnalytics(options);
    res.json(result);
  } catch (error) {
    console.error('[featured-placement] Failed to get platform analytics:', error);
    res.status(500).json({ error: 'failed_to_get_platform_analytics' });
  }
});

// ====================
// ADMIN: REVENUE ANALYTICS (alias for revenue-analytics)
// ====================

router.get('/admin/featured-placements/revenue-analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const options: { startDate?: Date; endDate?: Date } = {};
    if (req.query.startDate) options.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) options.endDate = new Date(req.query.endDate as string);
    const result = await analyticsService.getPlatformRevenueAnalytics(options);
    res.json(result);
  } catch (error) {
    console.error('[featured-placement] Failed to get revenue analytics:', error);
    res.status(500).json({ error: 'failed_to_get_revenue_analytics' });
  }
});

export default router;
