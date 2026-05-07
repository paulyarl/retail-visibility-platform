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

/**
 * Map trial tiers to their base tiers for feature/limit proxying
 */
function getBaseTierForTrial(tierKey: string): string | null {
  const trialToBaseMap: Record<string, string> = {
    'trial_google_only': 'google_only',
    'trial_discovery': 'discovery',
    'trial_starter': 'starter',
    'trial_storefront': 'storefront',
    'trial_commitment': 'commitment',
    'trial_professional': 'professional',
    'trial_chain_starter': 'chain_starter',
    'trial_chain_professional': 'chain_professional',
    'trial_chain_enterprise': 'chain_enterprise',
    // expired_trial has no base tier - it's a terminal state
  };
  
  return trialToBaseMap[tierKey] || null;
}

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

  // Build cache map - map tier_features_list to features
  const cache = new Map<string, TierWithFeatures>();
  for (const tier of tiers) {
    const tierWithFeatures: TierWithFeatures = {
      id: tier.id,
      tier_key: tier.tier_key,
      name: tier.name,
      display_name: tier.display_name,
      price_monthly: Number(tier.price_monthly),
      max_skus: tier.max_skus,
      max_locations: tier.max_locations,
      tier_type: tier.tier_type,
      is_active: tier.is_active,
      sort_order: tier.sort_order,
      features: (tier.tier_features_list || []).map(f => ({
        id: f.id,
        feature_key: f.feature_key,
        feature_name: f.feature_name || f.feature_key,
        is_enabled: f.is_enabled,
        is_inherited: f.is_inherited || false,
      })),
    };
    cache.set(tier.tier_key, tierWithFeatures);
  }

  tierCache = cache;
  tierCacheExpiry = now + CACHE_TTL;

  return cache;
}

/**
 * Get a tier by key
 * For trial tiers, returns the base tier with proxy features
 */
export async function getTierByKey(tierKey: string): Promise<TierWithFeatures | null> {
  const tiers = await loadTiers();
  
  // First try to get the tier directly
  let tier = tiers.get(tierKey);
  
  // If it's a trial tier, proxy to base tier for features
  if (tier && tierKey.startsWith('trial_')) {
    const baseTierKey = getBaseTierForTrial(tierKey);
    if (baseTierKey) {
      const baseTier = tiers.get(baseTierKey);
      if (baseTier) {
        // Return trial tier metadata with base tier features
        tier = {
          ...tier,
          features: baseTier.features,
          max_skus: baseTier.max_skus, // Use base tier limits
          max_locations: baseTier.max_locations,
        };
      }
    }
  }
  
  return tier || null;
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
 * ALWAYS proxies trial tiers to base tiers, ignoring stored values
 */
export async function checkTierFeatureAccess(tierKey: string, featureKey: string): Promise<boolean> {
  // ALWAYS proxy trial tiers to base tiers - ignore stored values completely
  const baseTierKey = getBaseTierForTrial(tierKey);
  const effectiveTierKey = baseTierKey || tierKey;
  
  const tier = await getTierByKey(effectiveTierKey);
  if (!tier) return false;

  // Check if feature exists in tier's features (handle undefined features array)
  const features = tier.features || [];
  return features.some(f => f.feature_key === featureKey && f.is_enabled);
}

/**
 * Get all features for a tier (including inherited)
 * ALWAYS proxies trial tiers to base tiers, ignoring stored values
 */
export async function getTierFeatures(tierKey: string): Promise<string[]> {
  // ALWAYS proxy trial tiers to base tiers - ignore stored values completely
  const baseTierKey = getBaseTierForTrial(tierKey);
  const effectiveTierKey = baseTierKey || tierKey;
  
  const tier = await getTierByKey(effectiveTierKey);
  if (!tier) return [];

  const features = tier.features || [];
  return features
    .filter(f => f.is_enabled)
    .map(f => f.feature_key);
}

/**
 * Get SKU limit for a tier
 * ALWAYS proxies trial tiers to base tiers, ignoring stored values
 */
export async function getTierSKULimit(tierKey: string): Promise<number> {
  // ALWAYS proxy trial tiers to base tiers - ignore stored values completely
  const baseTierKey = getBaseTierForTrial(tierKey);
  const effectiveTierKey = baseTierKey || tierKey;
  
  const tier = await getTierByKey(effectiveTierKey);
  if (!tier) return 500; // Default to starter limit
  
  // Use base tier's actual limit (ignore trial tier's stored value)
  return tier.max_skus ?? 500;
}

/**
 * Get tier pricing
 */
export async function getTierPrice(tierKey: string): Promise<number> {
  const tier = await getTierByKey(tierKey);
  if (!tier) return 0;
  
  return tier.price_monthly; // Already stored as dollars (DECIMAL)
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
 * Now considers organization tier for chain tenants
 */
export async function checkTenantFeatureAccess(
  tenantId: string,
  featureKey: string
): Promise<{ hasAccess: boolean; source: 'tier' | 'override' | 'none'; override?: any }> {
  try {
    // Get tenant with tier, organization tier, and overrides
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { 
        subscription_tier: true,
        organization_id: true,
        organizations_list: {
          select: {
            subscription_tier: true,
          },
        },
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
      console.log(`[checkTenantFeatureAccess] Tenant ${tenantId} not found`);
      return { hasAccess: false, source: 'none' };
    }

    // console.log(`[checkTenantFeatureAccess] Tenant: ${tenantId}, Feature: ${featureKey}`);
    // console.log(`[checkTenantFeatureAccess] Tenant tier: ${tenant.subscription_tier}, Org tier: ${tenant.organizations_list?.subscription_tier}`);

    // 1. Check for active override first (highest priority)
    const override = tenant.tenant_feature_overrides_list[0];
    if (override) {
      console.log(`[checkTenantFeatureAccess] Override found: granted=${override.granted}`);
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
    // Check BOTH org tier and tenant tier - grant access if EITHER has the feature
    // This handles cases where tenant has a higher tier than org, or vice versa
    const orgTier = tenant.organizations_list?.subscription_tier;
    const tenantTier = tenant.subscription_tier || 'discovery';
    
    // console.log(`[checkTenantFeatureAccess] Org tier: ${orgTier}, Tenant tier: ${tenantTier}`);
    
    // Check org tier first if it exists
    let tierAccess = false;
    if (orgTier) {
      tierAccess = await checkTierFeatureAccess(orgTier, featureKey);
      // console.log(`[checkTenantFeatureAccess] Org tier (${orgTier}) access: ${tierAccess}`);
    }
    
    // If org tier doesn't grant access, check tenant tier
    if (!tierAccess) {
      tierAccess = await checkTierFeatureAccess(tenantTier, featureKey);
      // console.log(`[checkTenantFeatureAccess] Tenant tier (${tenantTier}) access: ${tierAccess}`);
    }

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
