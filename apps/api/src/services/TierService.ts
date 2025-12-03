/**
 * Tier Service
 * 
 * Centralized service for tier-related operations.
 * Integrates database-driven tiers with existing middleware.
 * 
 * This service provides a single source of truth for tier data,
 * replacing hardcoded tier definitions with database queries.
 */

import { prisma } from '../prisma';

interface TierWithFeatures {
  id: string;
  tier_key: string;
  name: string;
  display_name: string;
  price_monthly: number;
  max_skus: number | null;
  max_locations: number | null;
  tier_type: string;
  is_active: boolean;
  sort_order: number;
  features: Array<{
    id: string;
    feature_key: string;
    feature_name: string;
    is_enabled: boolean;
    is_inherited: boolean;
  }>;
}

// Cache for tier data (refresh every 5 minutes)
let tierCache: Map<string, TierWithFeatures> | null = null;
let tierCacheExpiry: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load all tiers from database with caching
 */
async function loadTiers(): Promise<Map<string, TierWithFeatures>> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (tierCache && now < tierCacheExpiry) {
    return tierCache;
  }

  // Load from database
  const tiers = await prisma.subscription_tiers_list.findMany({
    where: { is_active: true },
    include: {
      tier_features_list: {
        where: { is_enabled: true },
      },
    },
  });

  // Build cache map
  const cache = new Map<string, TierWithFeatures>();
  for (const tier of tiers) {
    cache.set(tier.tier_key, tier as unknown as TierWithFeatures);
  }

  tierCache = cache;
  tierCacheExpiry = now + CACHE_TTL;

  return cache;
}

/**
 * Get a tier by key
 */
export async function getTierByKey(tierKey: string): Promise<TierWithFeatures | null> {
  const tiers = await loadTiers();
  return tiers.get(tierKey) || null;
}

/**
 * Get all active tiers
 */
export async function getAllTiers(): Promise<TierWithFeatures[]> {
  const tiers = await loadTiers();
  return Array.from(tiers.values()).sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Check if a tier has access to a feature
 */
export async function checkTierFeatureAccess(tierKey: string, featureKey: string): Promise<boolean> {
  const tier = await getTierByKey(tierKey);
  if (!tier) return false;

  // Check if feature exists in tier's features
  return tier.features.some(f => f.feature_key === featureKey && f.is_enabled);
}

/**
 * Get all features for a tier (including inherited)
 */
export async function getTierFeatures(tierKey: string): Promise<string[]> {
  const tier = await getTierByKey(tierKey);
  if (!tier) return [];

  return tier.features
    .filter(f => f.is_enabled)
    .map(f => f.feature_key);
}

/**
 * Get SKU limit for a tier
 */
export async function getTierSKULimit(tierKey: string): Promise<number> {
  const tier = await getTierByKey(tierKey);
  if (!tier) return 500; // Default to starter limit
  
  return tier.max_skus ?? Infinity;
}

/**
 * Get tier pricing
 */
export async function getTierPrice(tierKey: string): Promise<number> {
  const tier = await getTierByKey(tierKey);
  if (!tier) return 0;
  
  return tier.price_monthly / 100; // Convert cents to dollars
}

/**
 * Get tier display name
 */
export async function getTierDisplayName(tierKey: string): Promise<string> {
  const tier = await getTierByKey(tierKey);
  return tier?.display_name || tierKey;
}

/**
 * Find minimum tier required for a feature
 */
export async function getMinimumTierForFeature(featureKey: string): Promise<string | null> {
  const tiers = await getAllTiers();
  
  // Find the lowest-priced tier that has this feature
  let minTier: TierWithFeatures | null = null;
  let minPrice = Infinity;

  for (const tier of tiers) {
    const hasFeature = tier.features.some(f => f.feature_key === featureKey && f.is_enabled);
    if (hasFeature && tier.price_monthly < minPrice) {
      minTier = tier;
      minPrice = tier.price_monthly;
    }
  }

  return minTier?.tier_key || null;
}

/**
 * Validate if a tier key exists and is active
 */
export async function isValidTier(tierKey: string): Promise<boolean> {
  const tier = await getTierByKey(tierKey);
  return tier !== null && tier.is_active;
}

/**
 * Get all valid tier keys
 */
export async function getValidTierKeys(): Promise<string[]> {
  const tiers = await getAllTiers();
  return tiers.map(t => t.tier_key);
}

/**
 * Clear tier cache (call this after tier updates)
 */
export function clearTierCache(): void {
  tierCache = null;
  tierCacheExpiry = 0;
  console.log('[TierService] Cache cleared');
}

/**
 * Check if tenant has access to a feature (including overrides)
 */
export async function checkTenantFeatureAccess(
  tenantId: string,
  featureKey: string
): Promise<{ hasAccess: boolean; source: 'tier' | 'override' | 'none'; override?: any }> {
  try {
    // Get tenant with tier and overrides
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { 
        subscription_tier: true,
        tenant_feature_overrides_list: {
          where: {
            feature: featureKey,
            OR: [
              { expires_at: null },
              { expires_at: { gt: new Date() } },
            ],
          },
        },
      },
    });

    if (!tenant) {
      return { hasAccess: false, source: 'none' };
    }

    // 1. Check for active override first (highest priority)
    const override = tenant.tenant_feature_overrides_list[0];
    if (override) {
      return {
        hasAccess: override.granted,
        source: 'override',
        override: {
          id: override.id,
          reason: override.reason,
          expires_at: override.expires_at,
          granted_by: override.granted_by,
        },
      };
    }

    // 2. Fall back to tier-based access
    const tierKey = tenant.subscription_tier || 'starter';
    const tierAccess = await checkTierFeatureAccess(tierKey, featureKey);

    return {
      hasAccess: tierAccess,
      source: tierAccess ? 'tier' : 'none',
    };
  } catch (error) {
    console.error('[checkTenantFeatureAccess] Error:', error);
    return { hasAccess: false, source: 'none' };
  }
}

export default {
  getTierByKey,
  getAllTiers,
  checkTierFeatureAccess,
  getTierFeatures,
  getTierSKULimit,
  getTierPrice,
  getTierDisplayName,
  getMinimumTierForFeature,
  isValidTier,
  getValidTierKeys,
  clearTierCache,
  checkTenantFeatureAccess,
};
