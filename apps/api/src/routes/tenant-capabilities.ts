/**
 * Tenant Capabilities API Routes
 * 
 * Public-facing endpoint that returns a tenant's tier capabilities
 * grouped by capability type. Used by storefront, checkout, and
 * tenant dashboard to make capability-aware decisions.
 * 
 * Unlike /api/admin/tier-capabilities (admin-only), this endpoint
 * is tenant-scoped and accessible with tenant or no auth.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';

const router = Router({ mergeParams: true });

/**
 * Capability type feature prefix mapping
 * Used to determine which capability type a feature belongs to
 */
const CAPABILITY_TYPE_PREFIXES: Record<string, string> = {
  commerce_types: 'commerce_',
  payment_gateway_options: 'payment_gateway_',
  storefront_types: 'storefront_',
};

/**
 * GET /api/tenants/:tenantId/capabilities
 * 
 * Returns the tenant's tier capabilities grouped by capability type.
 * Accessible with tenant auth (for dashboard) or public (for storefront).
 * 
 * Response format:
 * {
 *   tier_key: "professional",
 *   capabilities: {
 *     commerce_types: {
 *       capability_enabled: true,
 *       is_flexible: true,
 *       features: { commerce_enabled: true, commerce_both_options: true, ... }
 *     },
 *     ...
 *   },
 *   uncategorized_features: ["business_logo", ...]
 * }
 */
router.get('/:tenantId/capabilities', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    // Look up tenant and their tier
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        subscription_tier: true,
        subscription_status: true,
        organization_id: true,
        organizations_list: {
          select: { subscription_tier: true },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Determine effective tier (org tier overrides for chain members)
    const effectiveTierKey = tenant.organizations_list?.subscription_tier || tenant.subscription_tier || 'starter';

    // Look up the tier
    const tier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: effectiveTierKey },
    });

    if (!tier) {
      return res.json({
        tier_key: effectiveTierKey,
        capabilities: {},
        uncategorized_features: [],
      });
    }

    // Fetch all enabled tier features with their capability type info
    const tierFeatures = await prisma.tier_features_list.findMany({
      where: { tier_id: tier.id, is_enabled: true },
      include: {
        capability_type_list: { select: { key: true, name: true, category: true } },
      },
      orderBy: { capability_type_id: 'asc' },
    });

    // Group features by capability type
    const capabilities: Record<string, {
      capability_enabled: boolean;
      is_highlighted: boolean;
      features: Record<string, boolean>;
    }> = {};

    const uncategorizedFeatures: string[] = [];

    for (const tf of tierFeatures) {
      const capKey = tf.capability_type_list?.key;

      if (capKey && tf.capability_type_list?.category) {
        // This feature belongs to a capability type
        if (!capabilities[capKey]) {
          capabilities[capKey] = {
            capability_enabled: true,
            is_highlighted: tf.is_highlighted ?? false,
            features: {},
          };
        }
        capabilities[capKey].features[tf.feature_key] = tf.is_enabled;
        // Update is_highlighted if any feature in this capability is highlighted
        if (tf.is_highlighted) {
          capabilities[capKey].is_highlighted = true;
        }
      } else {
        // Uncategorized feature (no capability type or empty key)
        uncategorizedFeatures.push(tf.feature_key);
      }
    }

    res.json({
      tier_key: effectiveTierKey,
      capabilities,
      uncategorized_features: uncategorizedFeatures,
    });
  } catch (error) {
    console.error('[GET /api/tenants/:tenantId/capabilities] Error:', error);
    res.status(500).json({ error: 'failed_to_get_tenant_capabilities' });
  }
});

export default router;
