/**
 * Badge Registry Routes
 *
 * Public endpoint: GET /api/public/badge-registry — system badges (for storefront rendering)
 * Tenant endpoint: GET /api/tenants/:tenantId/badge-registry — system + tenant custom badges
 * Admin endpoint: GET /api/admin/badge-registry — all system badges (admin view)
 */

import express from 'express';
import {
  getSystemBadges,
  getTenantBadges,
  getTenantCustomBadges,
  countTenantCustomBadges,
  createTenantBadge,
  updateTenantBadge,
  deleteTenantBadge,
  invalidateBadgeRegistryCache,
  getBadgesWithRules,
  getConflictPairs,
} from '../services/BadgeRegistryService';
import { evaluateBadgeRulesForTenant } from '../services/BadgeRuleEngine';
import { authenticateToken } from '../middleware/auth';
import FeaturedOptionsService from '../services/FeaturedOptionsService';

const router = express.Router();

/**
 * GET /api/public/badge-registry
 * Returns all active system badges (tenant_id IS NULL).
 * Public — no auth required. Used by storefront rendering.
 */
router.get('/public/badge-registry', async (_req, res) => {
  try {
    const badges = await getSystemBadges();
    res.json({ badges });
  } catch (error) {
    console.error('[badge-registry] Failed to get system badges:', error);
    res.status(500).json({ error: 'Failed to fetch badge registry' });
  }
});

/**
 * GET /api/tenants/:tenantId/badge-registry
 * Returns all active badges for a tenant (system + tenant custom).
 * Auth required — tenant context.
 */
router.get('/tenants/:tenantId/badge-registry', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const badges = await getTenantBadges(tenantId);
    res.json({ badges });
  } catch (error) {
    console.error('[badge-registry] Failed to get tenant badges:', error);
    res.status(500).json({ error: 'Failed to fetch tenant badge registry' });
  }
});

/**
 * GET /api/tenants/:tenantId/badge-registry/rules
 * Returns badges with auto-assign/remove rules and conflict pairs.
 * Auth required — tenant context.
 */
router.get('/tenants/:tenantId/badge-registry/rules', authenticateToken, async (_req, res) => {
  try {
    const [badgesWithRules, conflictPairs] = await Promise.all([
      getBadgesWithRules(),
      getConflictPairs(),
    ]);
    res.json({ badgesWithRules, conflictPairs });
  } catch (error) {
    console.error('[badge-registry] Failed to get badge rules:', error);
    res.status(500).json({ error: 'Failed to fetch badge rules' });
  }
});

/**
 * GET /api/tenants/:tenantId/badge-registry/validation
 * Evaluates badge rules for a tenant's products and returns warnings.
 * Used by FeaturedProductsManager UI to show validation warnings.
 * Auth required — tenant context.
 */
router.get('/tenants/:tenantId/badge-registry/validation', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const evaluation = await evaluateBadgeRulesForTenant(tenantId);
    res.json(evaluation);
  } catch (error) {
    console.error('[badge-registry] Failed to evaluate badge rules:', error);
    res.status(500).json({ error: 'Failed to evaluate badge rules' });
  }
});

/**
 * GET /api/tenants/:tenantId/badge-registry/custom
 * Returns all custom (non-system) badges for a tenant.
 * Auth required — tenant context.
 */
router.get('/tenants/:tenantId/badge-registry/custom', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const badges = await getTenantCustomBadges(tenantId);
    const usedSlots = badges.length;
    const featuredState = await FeaturedOptionsService.getInstance().resolveFeaturedOptionsState(tenantId);
    res.json({ badges, usedSlots, hasAccess: featuredState.customBadgeSlotsEnabled });
  } catch (error) {
    console.error('[badge-registry] Failed to get tenant custom badges:', error);
    res.status(500).json({ error: 'Failed to fetch custom badges' });
  }
});

/**
 * POST /api/tenants/:tenantId/badge-registry/custom
 * Create a custom badge for a tenant. Tier-gated: requires custom_badge_slots capability.
 * Auth required — tenant context.
 */
router.post('/tenants/:tenantId/badge-registry/custom', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { key, label, description, icon, color, priority, sortOrder } = req.body;

    if (!key || !label) {
      return res.status(400).json({ error: 'key and label are required' });
    }

    // Check tier access via featured_options capability
    const featuredState = await FeaturedOptionsService.getInstance().resolveFeaturedOptionsState(tenantId);
    if (!featuredState.customBadgeSlotsEnabled) {
      return res.status(403).json({ error: 'Your tier does not support custom badges' });
    }

    // Check slot limit (max 10 custom badges per tenant)
    const currentCount = await countTenantCustomBadges(tenantId);
    if (currentCount >= 10) {
      return res.status(403).json({ error: 'Custom badge limit reached (max 10). Delete an existing badge to create a new one.' });
    }

    const badge = await createTenantBadge({
      tenantId,
      key: key.toLowerCase().replace(/\s+/g, '_'),
      label,
      description: description ?? null,
      icon: icon ?? null,
      color: color ?? null,
      priority: priority ?? 50,
      sortOrder: sortOrder ?? 100,
    });

    res.status(201).json({ badge });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'A badge with this key already exists for your tenant' });
    }
    console.error('[badge-registry] Failed to create custom badge:', error);
    res.status(500).json({ error: 'Failed to create custom badge' });
  }
});

/**
 * PUT /api/tenants/:tenantId/badge-registry/custom/:badgeId
 * Update a custom badge for a tenant.
 * Auth required — tenant context.
 */
router.put('/tenants/:tenantId/badge-registry/custom/:badgeId', authenticateToken, async (req, res) => {
  try {
    const { tenantId, badgeId } = req.params;
    const { label, description, icon, color, priority, sortOrder, isActive } = req.body;

    const badge = await updateTenantBadge(tenantId, badgeId, {
      label,
      description,
      icon,
      color,
      priority,
      sortOrder,
      isActive,
    });

    if (!badge) {
      return res.status(404).json({ error: 'Custom badge not found or not owned by this tenant' });
    }

    res.json({ badge });
  } catch (error) {
    console.error('[badge-registry] Failed to update custom badge:', error);
    res.status(500).json({ error: 'Failed to update custom badge' });
  }
});

/**
 * DELETE /api/tenants/:tenantId/badge-registry/custom/:badgeId
 * Delete a custom badge for a tenant.
 * Auth required — tenant context.
 */
router.delete('/tenants/:tenantId/badge-registry/custom/:badgeId', authenticateToken, async (req, res) => {
  try {
    const { tenantId, badgeId } = req.params;
    const deleted = await deleteTenantBadge(tenantId, badgeId);

    if (!deleted) {
      return res.status(404).json({ error: 'Custom badge not found or not owned by this tenant' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[badge-registry] Failed to delete custom badge:', error);
    res.status(500).json({ error: 'Failed to delete custom badge' });
  }
});

/**
 * POST /api/admin/badge-registry/invalidate-cache
 * Invalidates the in-memory cache. Call after manual DB updates.
 * Admin auth required.
 */
router.post('/admin/badge-registry/invalidate-cache', authenticateToken, async (_req, res) => {
  try {
    invalidateBadgeRegistryCache();
    res.json({ success: true, message: 'Badge registry cache invalidated' });
  } catch (error) {
    console.error('[badge-registry] Failed to invalidate cache:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

export default router;
