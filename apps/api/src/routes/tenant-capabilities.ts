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
import { getEffectiveTier } from '../utils/trial-tier-transparency';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

const router = Router({ mergeParams: true });

/**
 * Capability type feature prefix mapping
 * Used to determine which capability type a feature belongs to
 */
const CAPABILITY_TYPE_PREFIXES: Record<string, string> = {
  commerce_types: 'commerce_',
  payment_gateway_options: 'payment_gateway_',
  storefront_types: 'storefront_',
  storefront_options: 'storefront_opt_',
  featured_options: 'featured_',
  integration_options: 'integration_',
  quickstart_options: 'quickstart_',
  faq_options: 'faq_',
  chatbot_options: 'chatbot_',
};

/**
 * Resolve a slug or tenant ID to a tenant ID using the tenants table directly.
 * No dependency on directory_listings_list — works even if directory is unpublished.
 */
async function resolveTenantIdentifier(identifier: string): Promise<{ id: string; slug: string | null } | null> {
  // If it starts with 'tid-', it's already a tenant ID
  if (identifier.startsWith('tid-')) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: identifier },
      select: { id: true, slug: true },
    });
    return tenant;
  }

  // Otherwise, look up by slug in the tenants table
  const tenant = await prisma.tenants.findFirst({
    where: { slug: identifier },
    select: { id: true, slug: true },
  });
  return tenant;
}

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
/**
 * GET /api/tenants/resolve/:identifier
 * Resolve a slug or tenant ID to a tenant ID using the tenants table directly.
 * No dependency on directory_listings_list — works even if directory is unpublished.
 * Public access (no auth required) for storefront use.
 */
router.get('/resolve/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'identifier_required' });
    }

    const resolved = await resolveTenantIdentifier(identifier);

    if (!resolved) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }

    return res.json({
      success: true,
      data: {
        tenantId: resolved.id,
        slug: resolved.slug,
        identifierType: identifier.startsWith('tid-') ? 'tenant_id' : 'slug'
      }
    });
  } catch (error: any) {
    console.error('[GET /api/tenants/resolve/:identifier] Error:', error);
    return res.status(500).json({ success: false, error: 'failed_to_resolve_tenant' });
  }
});

/**
 * GET /api/tenants/:tenantId/capabilities
 *
 * Returns the tenant's tier capabilities grouped by capability type.
 * Accepts both tenant IDs (tid-...) and slugs as the :tenantId parameter.
 * Accessible with tenant auth (for dashboard) or public (for storefront).
 */
router.get('/:tenantId/capabilities', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    // Resolve identifier: could be a tenant ID or a slug
    const resolved = await resolveTenantIdentifier(tenantId);

    if (!resolved) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Look up tenant and their tier using the resolved ID
    const tenant = await prisma.tenants.findUnique({
      where: { id: resolved.id },
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

    const orgTierKey = tenant.organizations_list?.subscription_tier || null;
    const tenantTierKey = tenant.subscription_tier || null;

    // Proxy trial tiers to their base tiers for feature resolution
    // Trial tiers are pricing wrappers — real capabilities live on the base tier
    const resolvedOrgTierKey = orgTierKey ? getEffectiveTier(orgTierKey) : null;
    const resolvedTenantTierKey = tenantTierKey ? getEffectiveTier(tenantTierKey) : null;

    // Fetch features from both org tier and tenant tier, then merge (most-permissive-wins)
    const tierKeys = [resolvedOrgTierKey, resolvedTenantTierKey].filter((k): k is string => !!k);
    const tiers = await prisma.subscription_tiers_list.findMany({
      where: { tier_key: { in: tierKeys } },
    });

    // Build a map of tier_key -> tier record
    const tierMap = new Map(tiers.map(t => [t.tier_key, t]));

    // Collect features from all applicable tiers
    const allTierIds = tiers.map(t => t.id);

    let tierFeatures: any[] = [];
    if (allTierIds.length > 0) {
      tierFeatures = await prisma.tier_features_list.findMany({
        where: { tier_id: { in: allTierIds }, is_enabled: true },
        include: {
          capability_type_list: { select: { key: true, name: true, category: true } },
        },
        orderBy: { capability_type_id: 'asc' },
      });
    }

    // Merge features: tenant features override org features for same key (most-permissive-wins)
    // If a feature is enabled in ANY tier, it's enabled in the merged result
    const mergedFeatures = new Map<string, { feature_key: string; is_enabled: boolean; is_highlighted: boolean; capability_type_list: any }>();

    for (const tf of tierFeatures) {
      const existing = mergedFeatures.get(tf.feature_key);
      if (existing) {
        // Union: enabled if enabled in either tier, highlighted if highlighted in either
        existing.is_enabled = existing.is_enabled || tf.is_enabled;
        existing.is_highlighted = existing.is_highlighted || (tf.is_highlighted ?? false);
      } else {
        mergedFeatures.set(tf.feature_key, {
          feature_key: tf.feature_key,
          is_enabled: tf.is_enabled,
          is_highlighted: tf.is_highlighted ?? false,
          capability_type_list: tf.capability_type_list,
        });
      }
    }

    // Group merged features by capability type
    const capabilities: Record<string, {
      capability_enabled: boolean;
      is_highlighted: boolean;
      features: Record<string, boolean>;
    }> = {};

    const uncategorizedFeatures: string[] = [];

    for (const tf of mergedFeatures.values()) {
      const capKey = tf.capability_type_list?.key;

      if (capKey) {
        if (!capabilities[capKey]) {
          capabilities[capKey] = {
            capability_enabled: true,
            is_highlighted: false,
            features: {},
          };
        }
        capabilities[capKey].features[tf.feature_key] = tf.is_enabled;
        if (tf.is_highlighted) {
          capabilities[capKey].is_highlighted = true;
        }
      } else {
        uncategorizedFeatures.push(tf.feature_key);
      }
    }

    // Report the higher tier as the effective tier_key
    // Org tier overrides tenant tier (same logic as /tenants/:id/tier endpoint)
    // Use resolved keys so trial tiers report their base tier for capabilities
    const effectiveTierKey = resolvedOrgTierKey || resolvedTenantTierKey || 'starter';

    // Look up tier display metadata
    const effectiveTier = tierMap.get(effectiveTierKey);
    const tierName = effectiveTier?.name || effectiveTierKey;
    const tierDescription = effectiveTier?.description || '';

    res.json({
      tier_key: effectiveTierKey,
      tier_name: tierName,
      tier_description: tierDescription,
      capabilities,
      uncategorized_features: uncategorizedFeatures,
    });
  } catch (error) {
    console.error('[GET /api/tenants/:tenantId/capabilities] Error:', error);
    res.status(500).json({ error: 'failed_to_get_tenant_capabilities' });
  }
});

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
router.get('/:tenantId/effective-capabilities', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const detail = req.query.detail === 'full' ? 'full' : 'summary';

    const result = await resolveEffectiveCapabilities(tenantId, { detail });

    if (!result) {
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

export default router;
