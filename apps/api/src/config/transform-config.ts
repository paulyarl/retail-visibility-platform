/**
 * Centralized configuration for case transformation strategy
 * Controls which endpoints use API vs frontend transforms
 */

export interface TransformStrategy {
  layer: 'api' | 'frontend' | 'none';
  reason: string;
  stability: 'stable' | 'evolving' | 'experimental' | 'legacy';
  activity: 'high' | 'medium' | 'low';
}

/**
 * Endpoint transformation strategies
 * Based on stability and activity patterns
 */
export const transformStrategies: Record<string, TransformStrategy> = {
  // STABLE ENDPOINTS - High frontend activity, stable API
  // Best candidates for API-side transformation
  '/api/tenants/:id/profile': {
    layer: 'api',
    reason: 'Stable endpoint, high frontend usage, mature schema',
    stability: 'stable',
    activity: 'high'
  },
  
  '/api/tenants/:id/business-profile': {
    layer: 'api', 
    reason: 'Core business data, stable structure, frequent UI updates',
    stability: 'stable',
    activity: 'high'
  },
  
  '/api/items': {
    layer: 'api',
    reason: 'Primary inventory endpoint, stable, heavy frontend usage',
    stability: 'stable', 
    activity: 'high'
  },
  
  '/api/tenants/:id/items': {
    layer: 'api',
    reason: 'Tenant-scoped items, stable pattern, dashboard usage',
    stability: 'stable',
    activity: 'high'
  },
  
  // EVOLVING ENDPOINTS - High API activity, changing schemas
  // Better suited for frontend transformation
  '/api/integrations/*': {
    layer: 'frontend',
    reason: 'Rapidly evolving integration schemas, frequent API changes',
    stability: 'evolving',
    activity: 'high'
  },
  
  '/api/clover/*': {
    layer: 'frontend',
    reason: 'New integration, schema still evolving, external API dependencies',
    stability: 'evolving', 
    activity: 'medium'
  },
  
  '/api/square/*': {
    layer: 'frontend',
    reason: 'Planned integration, schema not finalized',
    stability: 'experimental',
    activity: 'low'
  },
  
  // EXPERIMENTAL ENDPOINTS - Unstable, changing frequently
  // Frontend transform provides flexibility
  '/api/experimental/*': {
    layer: 'frontend',
    reason: 'Experimental features, rapid iteration, schema changes',
    stability: 'experimental',
    activity: 'high'
  },
  
  '/api/analytics/*': {
    layer: 'frontend',
    reason: 'Analytics data structure evolving, complex nested objects',
    stability: 'evolving',
    activity: 'medium'
  },
  
  // LEGACY ENDPOINTS - Maintain compatibility
  // No transformation to avoid breaking existing consumers
  '/api/legacy/*': {
    layer: 'none',
    reason: 'Legacy compatibility, existing consumers expect snake_case',
    stability: 'legacy',
    activity: 'low'
  },
  
  '/api/webhooks/*': {
    layer: 'none',
    reason: 'External webhook consumers, must maintain exact format',
    stability: 'stable',
    activity: 'low'
  },
  
  // ADMIN/INTERNAL ENDPOINTS - Low activity, stable
  // API transform for consistency
  '/api/admin/*': {
    layer: 'api',
    reason: 'Admin interfaces, stable usage patterns, low change frequency',
    stability: 'stable',
    activity: 'low'
  },
  
  '/api/platform/*': {
    layer: 'api',
    reason: 'Platform management, stable patterns, admin usage',
    stability: 'stable',
    activity: 'low'
  }
};

/**
 * Feature flags for gradual rollout
 */
export const transformFeatureFlags = {
  // Global enable/disable
  apiTransformEnabled: process.env.API_TRANSFORM_ENABLED === 'true',
  frontendTransformEnabled: true, // Always available as fallback
  
  // Gradual rollout flags
  enableProfileTransforms: process.env.ENABLE_PROFILE_TRANSFORMS !== 'false',
  enableItemsTransforms: process.env.ENABLE_ITEMS_TRANSFORMS !== 'false',
  enableAdminTransforms: process.env.ENABLE_ADMIN_TRANSFORMS !== 'false',
  
  // Debug and monitoring
  logTransformActivity: process.env.LOG_TRANSFORM_ACTIVITY === 'true',
  monitorPerformance: process.env.MONITOR_TRANSFORM_PERFORMANCE === 'true'
};

/**
 * Performance thresholds for monitoring
 */
export const performanceThresholds = {
  maxTransformTimeMs: 10, // Warn if transform takes longer than 10ms
  maxResponseSizeKb: 1024, // Warn if transforming responses larger than 1MB
  maxNestingDepth: 10 // Warn if object nesting exceeds 10 levels
};

/**
 * Get transform strategy for a given endpoint
 */
export const getTransformStrategy = (path: string): TransformStrategy | null => {
  // Direct match first
  if (transformStrategies[path]) {
    return transformStrategies[path];
  }
  
  // Pattern matching for wildcards
  for (const [pattern, strategy] of Object.entries(transformStrategies)) {
    if (pattern.includes('*')) {
      const basePattern = pattern.replace('/*', '');
      if (path.startsWith(basePattern)) {
        return strategy;
      }
    } else if (pattern.includes(':')) {
      // Parameter matching (simple implementation)
      const regexPattern = pattern.replace(/:[\w]+/g, '[^/]+');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(path)) {
        return strategy;
      }
    }
  }
  
  return null;
};

/**
 * Check if API transform should be applied
 */
export const shouldUseApiTransform = (path: string): boolean => {
  if (!transformFeatureFlags.apiTransformEnabled) return false;
  
  const strategy = getTransformStrategy(path);
  return strategy?.layer === 'api';
};

/**
 * Check if frontend transform should be available
 */
export const shouldUseFrontendTransform = (path: string): boolean => {
  if (!transformFeatureFlags.frontendTransformEnabled) return false;
  
  const strategy = getTransformStrategy(path);
  return strategy?.layer === 'frontend';
};

/**
 * Get recommended transform approach for new endpoints
 */
export const getRecommendedStrategy = (
  stability: TransformStrategy['stability'],
  activity: TransformStrategy['activity']
): TransformStrategy['layer'] => {
  // Decision matrix based on stability and activity
  if (stability === 'stable' && activity === 'high') return 'api';
  if (stability === 'stable' && activity === 'medium') return 'api';
  if (stability === 'stable' && activity === 'low') return 'api';
  
  if (stability === 'evolving' && activity === 'high') return 'frontend';
  if (stability === 'evolving' && activity === 'medium') return 'frontend';
  if (stability === 'evolving' && activity === 'low') return 'frontend';
  
  if (stability === 'experimental') return 'frontend';
  if (stability === 'legacy') return 'none';
  
  // Default to frontend for flexibility
  return 'frontend';
};

/**
 * Add new endpoint strategy
 */
export const addEndpointStrategy = (
  path: string,
  strategy: TransformStrategy
) => {
  transformStrategies[path] = strategy;
};

/**
 * Development utilities
 */
export const debugTransformConfig = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Transform Configuration:');
    console.log('Feature Flags:', transformFeatureFlags);
    console.log('Strategies:', Object.keys(transformStrategies).length, 'endpoints configured');
    
    const byLayer = Object.values(transformStrategies).reduce((acc, strategy) => {
      acc[strategy.layer] = (acc[strategy.layer] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Distribution:', byLayer);
  }
};
