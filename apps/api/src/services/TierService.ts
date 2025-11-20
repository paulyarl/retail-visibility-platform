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
  tierKey: string;
  name: string;
  display_name: string;
  priceMonthly: number;
  maxSKUs: number | null;
  maxLocations: number | null;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
  features: Array<{
    id: string;
    featureKey: string;
    featureName: string;
    isEnabled: boolean;
    isInherited: boolean;
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
  const tiers = await prisma.subscriptionTier.findMany({
    where: { isActive: true },
    include: {
      features: {
        where: { isEnabled: true },
      },
    },
  });

  // Build cache map
  const cache = new Map<string, TierWithFeatures>();
  for (const tier of tiers) {
    cache.set(tier.tierKey, tier as TierWithFeatures);
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
  return Array.from(tiers.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Check if a tier has access to a feature
 */
export async function checkTierFeatureAccess(tierKey: string, featureKey: string): Promise<boolean> {
  const tier = await getTierByKey(tierKey);
  if (!tier) return false;

  // Check if feature exists in tier's features
  return tier.features.some(f => f.featureKey === featureKey && f.isEnabled);
}

/**
 * Get all features for a tier (including inherited)
 */
export async function getTierFeatures(tierKey: string): Promise<string[]> {
  const tier = await getTierByKey(tierKey);
  if (!tier) return [];

  return tier.features
    .filter(f => f.isEnabled)
    .map(f => f.featureKey);
}

/**
 * Get SKU limit for a tier
 */
export async function getTierSKULimit(tierKey: string): Promise<number> {
  const tier = await getTierByKey(tierKey);
  if (!tier) return 500; // Default to starter limit
  
  return tier.maxSKUs ?? Infinity;
}

/**
 * Get tier pricing
 */
export async function getTierPrice(tierKey: string): Promise<number> {
  const tier = await getTierByKey(tierKey);
  if (!tier) return 0;
  
  return tier.priceMonthly / 100; // Convert cents to dollars
}

/**
 * Get tier display name
 */
export async function getTierDisplayName(tierKey: string): Promise<string> {
  const tier = await getTierByKey(tierKey);
  return tier?.displayName || tierKey;
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
    const hasFeature = tier.features.some(f => f.featureKey === featureKey && f.isEnabled);
    if (hasFeature && tier.priceMonthly < minPrice) {
      minTier = tier;
      minPrice = tier.priceMonthly;
    }
  }

  return minTier?.tierKey || null;
}

/**
 * Validate if a tier key exists and is active
 */
export async function isValidTier(tierKey: string): Promise<boolean> {
  const tier = await getTierByKey(tierKey);
  return tier !== null && tier.isActive;
}

/**
 * Get all valid tier keys
 */
export async function getValidTierKeys(): Promise<string[]> {
  const tiers = await getAllTiers();
  return tiers.map(t => t.tierKey);
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
  tenant_id: string,
  featureKey: string
): Promise<{ hasAccess: boolean; source: 'tier' | 'override' | 'none'; override?: any }> {
  try {
    // Get tenant with tier and overrides
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        tenant_feature_overrides: {
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
    const override = tenant.featureOverrides[0];
    if (override) {
      return {
        hasAccess: override.granted,
        source: 'override',
        override: {
          id: override.id,
          reason: override.reason,
          expires_at: override.expiresAt,
          grantedBy: override.grantedBy,
        },
      };
    }

    // 2. Fall back to tier-based access
    const tierKey = tenant.subscriptionTier || 'starter';
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
