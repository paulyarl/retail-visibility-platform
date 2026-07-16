/**
 * Tenant Capabilities API Routes (Authenticated)
 *
 * Authenticated endpoints under /api/tenants that return detailed tenant
 * capability information. All routes here require a valid tenant token and
 * tenant access. Public-facing capability lookup has moved to
 * public-tenant-capabilities.ts under /api/public/tenants per
 * docs/AUTH_SCOPE_ISOLATION_SPEC.md.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { buildExpiredCapabilitiesResponse } from './public-tenant-capabilities';

const router = Router({ mergeParams: true });

/**
 * GET /api/tenants/capabilities/tiers-by-capability?capabilityTypeKey=...
 *
 * Returns all tiers that have a given capability type enabled.
 * Accessible with tenant auth (for upgrade messaging in tenant UI).
 *
 * Response: [{ tier_key, tier_name, tier_description, capability_enabled, features: [...] }]
 */

router.get('/capabilities/tiers-by-capability', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { capabilityTypeKey } = req.query;
    if (!capabilityTypeKey || typeof capabilityTypeKey !== 'string') {
      return res.status(400).json({ error: 'capabilityTypeKey required' });
    }

    const capType = await prisma.capability_type_list.findUnique({ where: { key: capabilityTypeKey } });
    if (!capType) return res.status(404).json({ error: 'capability_type_not_found' });

    const tierFeatures = await prisma.tier_features_list.findMany({
      where: { capability_type_id: capType.id, is_enabled: true },
      include: {
        subscription_tiers_list: { select: { tier_key: true, name: true, description: true } },
      },
      orderBy: { tier_id: 'asc' },
    });

    // Group by tier
    const tierMap = new Map<string, {
      tier_key: string;
      tier_name: string;
      tier_description: string;
      capability_enabled: boolean;
      features: { feature_key: string; feature_name: string; is_enabled: boolean }[];
    }>();

    for (const tf of tierFeatures) {
      const tierKey = tf.subscription_tiers_list?.tier_key;
      if (!tierKey) continue;

      if (!tierMap.has(tierKey)) {
        tierMap.set(tierKey, {
          tier_key: tierKey,
          tier_name: tf.subscription_tiers_list?.name || tierKey,
          tier_description: tf.subscription_tiers_list?.description || '',
          capability_enabled: true,
          features: [],
        });
      }
      tierMap.get(tierKey)!.features.push({
        feature_key: tf.feature_key,
        feature_name: tf.feature_name,
        is_enabled: tf.is_enabled,
      });
    }

    res.json(Array.from(tierMap.values()));
  } catch (error) {
    console.error('[GET /api/tenants/capabilities/tiers-by-capability] Error:', error);
    res.status(500).json({ error: 'failed_to_list_tiers_by_capability' });
  }
});

/**
 * GET /api/tenants/:tenantId/effective-capabilities
 *
 * Unified capabilities endpoint — returns a flat "effective capability manifest"
 * with tier hard-gates + merchant soft-gates already resolved server-side.
 *
 * Query params:
 *   ?detail=full  — includes raw `gates` section for settings/debug pages
 */
router.get('/:tenantId/effective-capabilities', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const detail = req.query.detail === 'full' ? 'full' : 'summary';

    const result = await resolveEffectiveCapabilities(tenantId, { detail });

    if (!result) {
      // Tenant not resolved by the service — check if it exists but has no resolvable
      // capabilities (e.g. expired subscription with no tier data).
      // Try ID first, then slug fallback.
      const tenantData = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { id: true, subscription_status: true, subscription_tier: true, trial_ends_at: true, subscription_ends_at: true },
      }) ?? await prisma.tenants.findFirst({
        where: { slug: tenantId },
        select: { id: true, subscription_status: true, subscription_tier: true, trial_ends_at: true, subscription_ends_at: true },
      });

      if (tenantData) {
        return res.status(200).json({
          success: true,
          data: buildExpiredCapabilitiesResponse(tenantData),
        });
      }

      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.setHeader('Vary', 'Accept-Encoding, Accept-Language');
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[GET /effective-capabilities] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve effective capabilities',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/system-status
 *
 * Returns a capability-aware system status summary.
 * All detection logic runs server-side via EffectiveCapabilityResolver
 * + business state queries in a single round-trip.
 */
router.get('/:tenantId/system-status', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const { resolveSystemStatus } = await import('../services/SystemStatusService');
    const result = await resolveSystemStatus(tenantId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    res.setHeader('Cache-Control', 'private, max-age=30, s-maxage=30');
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[GET /system-status] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve system status',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/next-steps
 *
 * Returns a tier-and-capability-aware onboarding task list.
 * All detection logic runs server-side in a single round-trip.
 */
router.get('/:tenantId/next-steps', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const { resolveNextSteps } = await import('../services/NextStepsService');
    const tasks = await resolveNextSteps(tenantId);

    if (tasks === null) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    res.setHeader('Cache-Control', 'private, max-age=30, s-maxage=30');
    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error('[GET /next-steps] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve next steps',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/growth-tips
 *
 * Returns tier-and-capability-aware growth tips.
 * Multi-dimensional: tier level, capabilities, usage, subscription status,
 * location status, visibility status, and growth path.
 *
 * Query params:
 *   ?limit=N  — max tips to return (default 5)
 */
router.get('/:tenantId/growth-tips', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);

    const { resolveGrowthTips } = await import('../services/GrowthTipService');
    const tips = await resolveGrowthTips(tenantId, limit);

    if (tips === null) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    res.setHeader('Cache-Control', 'private, max-age=30, s-maxage=30');
    res.json({
      success: true,
      data: tips,
    });
  } catch (error) {
    console.error('[GET /growth-tips] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve growth tips',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/quick-links
 *
 * Returns a tier-and-capability-aware quick links list for the dashboard.
 * All detection logic runs server-side via EffectiveCapabilityResolver
 * + business state queries in a single round-trip.
 */
router.get('/:tenantId/quick-links', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const { resolveQuickLinks } = await import('../services/QuickLinksService');
    const links = await resolveQuickLinks(tenantId);

    if (links === null) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    res.setHeader('Cache-Control', 'private, max-age=30, s-maxage=30');
    res.json({
      success: true,
      data: links,
    });
  } catch (error) {
    console.error('[GET /quick-links] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve quick links',
    });
  }
});

export default router;
