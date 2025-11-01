/**
 * Feature Flag System
 * 
 * Implements feature flag controls for gradual rollout and A/B testing
 * Supports tenant-level and user-level flags
 */

export type FeatureFlag = 
  | 'FF_MAP_CARD'
  | 'FF_SWIS_PREVIEW'
  | 'FF_BUSINESS_PROFILE'
  | 'FF_DARK_MODE'
  | 'FF_GOOGLE_CONNECT_SUITE'
  | 'FF_APP_SHELL_NAV'
  | 'FF_TENANT_URLS'
  | 'FF_CATEGORY_MANAGEMENT_PAGE'
  | 'FF_CATEGORY_QUICK_ACTIONS'
  | 'FF_ITEMS_V2_GRID';

export type RolloutStrategy = 
  | 'off'           // Feature disabled for all
  | 'pilot'         // Enabled for pilot cohort only
  | 'percentage'    // Enabled for percentage of users
  | 'on';           // Enabled for all

export interface FeatureFlagConfig {
  flag: FeatureFlag;
  strategy: RolloutStrategy;
  percentage?: number;        // For percentage strategy (0-100)
  pilotTenants?: string[];    // For pilot strategy
  pilotRegions?: string[];    // For regional pilot
  enabledAt?: string;         // ISO timestamp when enabled
  disabledAt?: string;        // ISO timestamp when disabled
}

/**
 * Feature flag configurations
 * In production, this would be fetched from a config service or database
 */
let FEATURE_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  FF_MAP_CARD: {
    flag: 'FF_MAP_CARD',
    strategy: 'off', // Start disabled
    percentage: 0,
    pilotTenants: [],
    pilotRegions: [],
  },
  FF_SWIS_PREVIEW: {
    flag: 'FF_SWIS_PREVIEW',
    strategy: 'off', // Start disabled
    percentage: 0,
    pilotTenants: [],
    pilotRegions: [],
  },
  FF_BUSINESS_PROFILE: {
    flag: 'FF_BUSINESS_PROFILE',
    strategy: 'on', // Already deployed
    percentage: 100,
  },
  FF_DARK_MODE: {
    flag: 'FF_DARK_MODE',
    strategy: 'off', // Future feature
    percentage: 0,
  },
  FF_GOOGLE_CONNECT_SUITE: {
    flag: 'FF_GOOGLE_CONNECT_SUITE',
    strategy: 'pilot', // ENH-2026-043/044 - Start with pilot tenants
    percentage: 0,
    pilotTenants: [], // Will be populated with pilot merchant IDs
    pilotRegions: ['us-east-1'], // Start with US East region
  },
  FF_APP_SHELL_NAV: {
    flag: 'FF_APP_SHELL_NAV',
    strategy: 'off',
    percentage: 0,
  },
  FF_TENANT_URLS: {
    flag: 'FF_TENANT_URLS',
    strategy: 'off',
    percentage: 0,
  },
  FF_CATEGORY_MANAGEMENT_PAGE: {
    flag: 'FF_CATEGORY_MANAGEMENT_PAGE',
    strategy: 'on',
    percentage: 100,
  },
  FF_CATEGORY_QUICK_ACTIONS: {
    flag: 'FF_CATEGORY_QUICK_ACTIONS',
    strategy: 'off',
    percentage: 0,
  },
  FF_ITEMS_V2_GRID: {
    flag: 'FF_ITEMS_V2_GRID',
    strategy: 'off',
    percentage: 0,
  },
};

// Load persisted flag states from localStorage (if present)
try {
  if (typeof window !== 'undefined') {
    const raw = window.localStorage.getItem('feature_flags');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<FeatureFlag, FeatureFlagConfig>>;
      FEATURE_FLAGS = { ...FEATURE_FLAGS, ...parsed };
    }
  }
} catch (_e) {
  // ignore
}

/**
 * Check if a feature flag is enabled for a tenant
 * 
 * @param flag - Feature flag to check
 * @param tenantId - Tenant ID
 * @param region - Tenant region (optional)
 * @returns True if feature is enabled
 */
export function isFeatureEnabled(
  flag: FeatureFlag,
  tenantId?: string,
  region?: string
): boolean {
  const config = FEATURE_FLAGS[flag];

  if (!config) {
    console.warn(`Unknown feature flag: ${flag}`);
    return false;
  }

  switch (config.strategy) {
    case 'off':
      return false;

    case 'on':
      return true;

    case 'pilot':
      // Check if tenant is in pilot cohort
      if (tenantId && config.pilotTenants?.includes(tenantId)) {
        return true;
      }
      // Check if region is in pilot
      if (region && config.pilotRegions?.includes(region)) {
        return true;
      }
      return false;

    case 'percentage':
      // Use consistent hashing for percentage rollout
      if (!tenantId) return false;
      const percentage = config.percentage || 0;
      return hashTenantId(tenantId) < percentage;

    default:
      return false;
  }
}

/**
 * Hash tenant ID to percentage (0-100)
 * Ensures consistent rollout for same tenant
 * 
 * @param tenantId - Tenant ID
 * @returns Percentage value (0-100)
 */
function hashTenantId(tenantId: string): number {
  let hash = 0;
  for (let i = 0; i < tenantId.length; i++) {
    const char = tenantId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash % 100);
}

/**
 * Get feature flag configuration
 * 
 * @param flag - Feature flag
 * @returns Feature flag configuration
 */
export function getFeatureFlagConfig(flag: FeatureFlag): FeatureFlagConfig {
  return FEATURE_FLAGS[flag];
}

/**
 * Update feature flag configuration
 * In production, this would call an API to update the config
 * 
 * @param flag - Feature flag
 * @param config - New configuration
 */
export function updateFeatureFlag(
  flag: FeatureFlag,
  config: Partial<FeatureFlagConfig>
): void {
  FEATURE_FLAGS[flag] = {
    ...FEATURE_FLAGS[flag],
    ...config,
  };

  // Log the change for audit trail
  console.log(`Feature flag updated: ${flag}`, config);

  // Persist to localStorage and notify listeners (for client-only apps)
  try {
    if (typeof window !== 'undefined') {
      const toPersist: Partial<Record<FeatureFlag, FeatureFlagConfig>> = {
        ...JSON.parse(window.localStorage.getItem('feature_flags') || '{}'),
        [flag]: FEATURE_FLAGS[flag],
      };
      window.localStorage.setItem('feature_flags', JSON.stringify(toPersist));
      window.dispatchEvent(new CustomEvent('feature_flags_updated', { detail: { flag, config: FEATURE_FLAGS[flag] } }));
    }
  } catch (_e) {
    // ignore persistence errors
  }
}

/**
 * Enable feature for pilot cohort
 * 
 * @param flag - Feature flag
 * @param tenantIds - Tenant IDs to include in pilot
 * @param regions - Regions to include in pilot
 */
export function enablePilot(
  flag: FeatureFlag,
  tenantIds: string[] = [],
  regions: string[] = []
): void {
  updateFeatureFlag(flag, {
    strategy: 'pilot',
    pilotTenants: tenantIds,
    pilotRegions: regions,
    enabledAt: new Date().toISOString(),
  });
}

/**
 * Enable feature for percentage of users
 * 
 * @param flag - Feature flag
 * @param percentage - Percentage to enable (0-100)
 */
export function enablePercentage(
  flag: FeatureFlag,
  percentage: number
): void {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }

  updateFeatureFlag(flag, {
    strategy: 'percentage',
    percentage,
    enabledAt: new Date().toISOString(),
  });
}

/**
 * Enable feature for all users
 * 
 * @param flag - Feature flag
 */
export function enableForAll(flag: FeatureFlag): void {
  updateFeatureFlag(flag, {
    strategy: 'on',
    percentage: 100,
    enabledAt: new Date().toISOString(),
  });
}

/**
 * Disable feature for all users
 * 
 * @param flag - Feature flag
 */
export function disableForAll(flag: FeatureFlag): void {
  updateFeatureFlag(flag, {
    strategy: 'off',
    percentage: 0,
    disabledAt: new Date().toISOString(),
  });
}

/**
 * Get all feature flags and their status
 * 
 * @returns Map of feature flags to their configurations
 */
export function getAllFeatureFlags(): Record<FeatureFlag, FeatureFlagConfig> {
  return { ...FEATURE_FLAGS };
}

/**
 * React hook for feature flags
 * 
 * @param flag - Feature flag to check
 * @param tenantId - Tenant ID
 * @param region - Region
 * @returns True if feature is enabled
 */
export function useFeatureFlag(
  flag: FeatureFlag,
  tenantId?: string,
  region?: string
): boolean {
  // In a real implementation, this would use React context or state management
  return isFeatureEnabled(flag, tenantId, region);
}

/**
 * Feature flag metrics for monitoring
 */
export interface FeatureFlagMetrics {
  flag: FeatureFlag;
  totalChecks: number;
  enabledChecks: number;
  disabledChecks: number;
  enablementRate: number;
}

/**
 * Track feature flag check for metrics
 * 
 * @param flag - Feature flag
 * @param enabled - Whether flag was enabled
 * @param tenantId - Tenant ID
 */
export function trackFeatureFlagCheck(
  flag: FeatureFlag,
  enabled: boolean,
  tenantId?: string
): void {
  // In production, this would send metrics to observability platform
  console.debug(`Feature flag check: ${flag} = ${enabled}`, { tenantId });
}

/**
 * Rollback plan: Disable feature and log reason
 * 
 * @param flag - Feature flag to rollback
 * @param reason - Reason for rollback
 */
export function rollbackFeature(flag: FeatureFlag, reason: string): void {
  console.error(`Rolling back feature: ${flag}`, { reason });
  
  disableForAll(flag);
  
  // In production, this would:
  // 1. Send alert to on-call team
  // 2. Log to incident management system
  // 3. Update status page
  // 4. Trigger automated rollback procedures
}

/**
 * Gradual rollout helper
 * Increases percentage over time
 * 
 * @param flag - Feature flag
 * @param targetPercentage - Target percentage
 * @param incrementPerDay - Percentage to increase per day
 */
export function gradualRollout(
  flag: FeatureFlag,
  targetPercentage: number,
  incrementPerDay: number = 20
): void {
  const config = getFeatureFlagConfig(flag);
  const currentPercentage = config.percentage || 0;
  
  if (currentPercentage >= targetPercentage) {
    console.log(`Feature ${flag} already at target: ${targetPercentage}%`);
    return;
  }

  const newPercentage = Math.min(
    currentPercentage + incrementPerDay,
    targetPercentage
  );

  console.log(`Increasing ${flag} from ${currentPercentage}% to ${newPercentage}%`);
  enablePercentage(flag, newPercentage);
}
