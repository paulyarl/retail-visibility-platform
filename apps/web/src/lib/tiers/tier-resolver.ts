/**
 * Tier Resolution Middleware
 * Handles complex tier scenarios for individuals and chains
 * Resolves effective tier from organization and tenant levels
 */

export interface TierFeature {
  id: string;
  name: string;
  description: string;
  category: 'inventory' | 'analytics' | 'integration' | 'support' | 'advanced';
  enabled: boolean;
  source: 'organization' | 'tenant' | 'override';
}

export interface TierLimits {
  maxProducts?: number;
  maxLocations?: number;
  maxUsers?: number;
  maxApiCalls?: number;
  storageGB?: number;
}

export interface TierInfo {
  id: string;
  name: string;
  level: 'starter' | 'growth' | 'pro' | 'enterprise' | 'custom';
  source: 'organization' | 'tenant';
  features: TierFeature[];
  limits: TierLimits;
}

export interface ResolvedTier {
  effective: TierInfo;
  organization?: TierInfo;
  tenant?: TierInfo;
  isChain: boolean;
  canUpgrade: boolean;
  upgradeOptions?: string[];
}

/**
 * Resolves the effective tier for a tenant
 * Handles inheritance and overrides from organization
 */
export function resolveTier(
  organizationTier: TierInfo | null,
  tenantTier: TierInfo | null,
  isChain: boolean
): ResolvedTier {
  // Helper function to map tier levels to resolver format
  const mapTierLevel = (tierId: string): TierInfo['level'] => {
    switch (tierId) {
      case 'google_only': return 'starter';
      case 'starter': return 'starter';
      case 'professional': return 'pro';
      case 'enterprise': return 'enterprise';
      case 'organization': return 'enterprise'; // Map organization to enterprise level
      case 'chain_starter': return 'starter';
      case 'chain_professional': return 'pro';
      case 'chain_enterprise': return 'enterprise';
      default: return 'starter';
    }
  };

  // For chains: organization tier is primary, tenant can have overrides
  if (isChain && organizationTier) {
    const effectiveTier = mergeTiers(organizationTier, tenantTier);
    effectiveTier.level = mapTierLevel(effectiveTier.id);
    
    return {
      effective: effectiveTier,
      organization: organizationTier,
      tenant: tenantTier || undefined,
      isChain: true,
      canUpgrade: true, // Chain admin can upgrade org tier
      upgradeOptions: getUpgradeOptions(effectiveTier.level)
    };
  }

  // For individual tenants: tenant tier is primary
  if (tenantTier) {
    tenantTier.level = mapTierLevel(tenantTier.id);
    return {
      effective: tenantTier,
      tenant: tenantTier,
      isChain: false,
      canUpgrade: true,
      upgradeOptions: getUpgradeOptions(tenantTier.level)
    };
  }

  // Fallback to organization tier if available
  if (organizationTier) {
    organizationTier.level = mapTierLevel(organizationTier.id);
    return {
      effective: organizationTier,
      organization: organizationTier,
      isChain: false,
      canUpgrade: false, // Can't upgrade org tier from tenant context
    };
  }

  // Default to starter tier
  return {
    effective: getDefaultTier(),
    isChain: false,
    canUpgrade: true,
    upgradeOptions: ['growth', 'pro']
  };
}

/**
 * Merges organization and tenant tiers
 * Tenant-specific features can override or extend org features
 */
function mergeTiers(orgTier: TierInfo, tenantTier: TierInfo | null): TierInfo {
  if (!tenantTier) {
    return orgTier;
  }

  // Start with org tier as base (with safety check)
  const mergedFeatures = orgTier.features ? [...orgTier.features] : [];
  
  // Add or override with tenant-specific features
  if (tenantTier.features) {
    tenantTier.features.forEach(tenantFeature => {
      const existingIndex = mergedFeatures.findIndex(f => f.id === tenantFeature.id);
      
      if (existingIndex >= 0) {
        // Override existing feature
        mergedFeatures[existingIndex] = {
          ...tenantFeature,
          source: 'override'
        };
      } else {
        // Add new tenant-specific feature
        mergedFeatures.push({
          ...tenantFeature,
          source: 'tenant'
        });
      }
    });
  }

  // Merge limits (take the higher limit) with safety checks
  const orgLimits = orgTier.limits || {};
  const tenantLimits = tenantTier.limits || {};
  
  const mergedLimits: TierLimits = {
    maxProducts: Math.max(
      orgLimits.maxProducts || 0,
      tenantLimits.maxProducts || 0
    ) || undefined,
    maxLocations: Math.max(
      orgLimits.maxLocations || 0,
      tenantLimits.maxLocations || 0
    ) || undefined,
    maxUsers: Math.max(
      orgLimits.maxUsers || 0,
      tenantLimits.maxUsers || 0
    ) || undefined,
    maxApiCalls: Math.max(
      orgLimits.maxApiCalls || 0,
      tenantLimits.maxApiCalls || 0
    ) || undefined,
    storageGB: Math.max(
      orgLimits.storageGB || 0,
      tenantLimits.storageGB || 0
    ) || undefined,
  };

  return {
    id: `merged_${orgTier.id}_${tenantTier.id}`,
    name: `${orgTier.name} (Enhanced)`,
    level: getHigherTierLevel(orgTier.level, tenantTier.level),
    source: 'organization',
    features: mergedFeatures,
    limits: mergedLimits
  };
}

/**
 * Determines which tier level is higher
 */
function getHigherTierLevel(
  level1: TierInfo['level'],
  level2: TierInfo['level']
): TierInfo['level'] {
  const hierarchy: TierInfo['level'][] = ['starter', 'growth', 'pro', 'enterprise', 'custom'];
  const index1 = hierarchy.indexOf(level1);
  const index2 = hierarchy.indexOf(level2);
  return index1 > index2 ? level1 : level2;
}

/**
 * Gets available upgrade options for a tier level
 */
function getUpgradeOptions(currentLevel: TierInfo['level']): string[] {
  const allTiers: TierInfo['level'][] = ['starter', 'growth', 'pro', 'enterprise'];
  const currentIndex = allTiers.indexOf(currentLevel);
  return allTiers.slice(currentIndex + 1);
}

/**
 * Returns default starter tier
 */
function getDefaultTier(): TierInfo {
  return {
    id: 'starter',
    name: 'Starter',
    level: 'starter',
    source: 'tenant',
    features: [
      {
        id: 'basic_inventory',
        name: 'Basic Inventory',
        description: 'Manage your product catalog',
        category: 'inventory',
        enabled: true,
        source: 'tenant'
      },
      {
        id: 'single_location',
        name: 'Single Location',
        description: 'Manage one store location',
        category: 'inventory',
        enabled: true,
        source: 'tenant'
      }
    ],
    limits: {
      maxProducts: 100,
      maxLocations: 1,
      maxUsers: 2
    }
  };
}

/**
 * Checks if a specific feature is enabled in the resolved tier
 */
export function hasFeature(resolvedTier: ResolvedTier, featureId: string): boolean {
  // Safety check for undefined features
  if (!resolvedTier?.effective?.features) {
    // Fallback to static tier features if API doesn't provide features
    const { checkTierFeature } = require('./tier-features');
    const tierKey = resolvedTier?.effective?.id || 'starter';
    return checkTierFeature(tierKey, featureId);
  }

  // Check both id and featureKey/feature_key for compatibility with backend
  // If enabled is undefined, treat as true (feature exists = enabled)
  const hasApiFeature = resolvedTier.effective.features.some(
    f => (f.id === featureId || (f as any).featureKey === featureId || (f as any).feature_key === featureId) && (f.enabled !== false)
  );

  // If API features include this feature, use that result
  if (hasApiFeature) {
    return true;
  }

  // API features exist but don't include this feature - check static tier features
  // This handles cases where API doesn't include inherited features
  const { checkTierFeature } = require('./tier-features');
  const tierKey = resolvedTier?.effective?.id || 'starter';
  return checkTierFeature(tierKey, featureId);
}

/**
 * Gets all enabled features by category
 */
export function getFeaturesByCategory(
  resolvedTier: ResolvedTier,
  category: TierFeature['category']
): TierFeature[] {
  return resolvedTier.effective.features.filter(
    f => f.category === category && f.enabled
  );
}

/**
 * Checks if a limit has been reached
 */
export function isLimitReached(
  resolvedTier: ResolvedTier,
  limitType: keyof TierLimits,
  currentUsage: number
): boolean {
  const limit = resolvedTier.effective.limits[limitType];
  if (!limit) return false; // No limit means unlimited
  return currentUsage >= limit;
}

/**
 * Gets usage percentage for a limit
 */
export function getUsagePercentage(
  resolvedTier: ResolvedTier,
  limitType: keyof TierLimits,
  currentUsage: number
): number {
  const limit = resolvedTier.effective.limits[limitType];
  if (!limit) return 0; // No limit means 0% usage
  return Math.min(100, (currentUsage / limit) * 100);
}
