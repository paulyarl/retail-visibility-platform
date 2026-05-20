/**
 * Unified Feature Gate Hook
 * 
 * Single hook for all feature access checks across the platform.
 * Replaces fragmented feature checking patterns with consistent implementation.
 */

import { useMemo } from 'react';
import { useTenantTier } from './useTenantTier';
import { usePlatformUser } from '@/lib/auth/platform-admin';
import { 
  FeatureGateEngine, 
  type FeatureGateResult, 
  type FeatureGateContext,
  FEATURE_OPERATIONS 
} from '../lib/features/FeatureGateSystem';

export type FeatureOperation = keyof typeof FEATURE_OPERATIONS;

/**
 * Hook for checking feature access
 * 
 * @param operation - The feature operation to check
 * @returns Feature access result with gating information
 */
export function useFeatureGate(operation: FeatureOperation): FeatureGateResult {
  const { tier, userRole } = useTenantTier();
  const platformUser = usePlatformUser();
  
  const context: FeatureGateContext = useMemo(() => ({
    tier: tier ? {
      key: tier.key,
      name: tier.name
    } : undefined,
    userRole,
    platformUser: platformUser ? {
      canBypassAll: platformUser.canBypassTier || false,
      canBypassRole: platformUser.canBypassRole || false
    } : undefined
  }), [tier, userRole, platformUser]);
  
  return useMemo(() => {
    return FeatureGateEngine.checkAccess(operation, context);
  }, [operation, context]);
}

/**
 * Hook for checking multiple feature operations at once
 */
export function useMultipleFeatureGates(operations: FeatureOperation[]): Record<FeatureOperation, FeatureGateResult> {
  const { tier, userRole } = useTenantTier();
  const platformUser = usePlatformUser();
  
  const context: FeatureGateContext = useMemo(() => ({
    tier: tier ? {
      key: tier.key,
      name: tier.name
    } : undefined,
    userRole,
    platformUser: platformUser ? {
      canBypassAll: platformUser.canBypassTier || false,
      canBypassRole: platformUser.canBypassRole || false
    } : undefined
  }), [tier, userRole, platformUser]);
  
  return useMemo(() => {
    const results: Record<FeatureOperation, FeatureGateResult> = {} as any;
    
    operations.forEach(op => {
      results[op] = FeatureGateEngine.checkAccess(op, context);
    });
    
    return results;
  }, [operations, context]);
}

/**
 * Hook for checking if user can access any of the given operations
 */
export function useAnyFeatureGate(operations: FeatureOperation[]): {
  hasAccess: boolean;
  accessibleOperations: FeatureOperation[];
  deniedOperations: FeatureOperation[];
  results: Record<FeatureOperation, FeatureGateResult>;
} {
  const results = useMultipleFeatureGates(operations);
  
  return useMemo(() => {
    const accessibleOperations: FeatureOperation[] = [];
    const deniedOperations: FeatureOperation[] = [];
    let hasAccess = false;
    
    Object.entries(results).forEach(([op, result]) => {
      if (result.hasAccess) {
        accessibleOperations.push(op as FeatureOperation);
        hasAccess = true;
      } else {
        deniedOperations.push(op as FeatureOperation);
      }
    });
    
    return {
      hasAccess,
      accessibleOperations,
      deniedOperations,
      results
    };
  }, [results]);
}

/**
 * Hook for checking if user can access all of the given operations
 */
export function useAllFeatureGates(operations: FeatureOperation[]): {
  hasAccess: boolean;
  accessibleOperations: FeatureOperation[];
  deniedOperations: FeatureOperation[];
  results: Record<FeatureOperation, FeatureGateResult>;
} {
  const results = useMultipleFeatureGates(operations);
  
  return useMemo(() => {
    const accessibleOperations: FeatureOperation[] = [];
    const deniedOperations: FeatureOperation[] = [];
    let hasAccess = true;
    
    Object.entries(results).forEach(([op, result]) => {
      if (result.hasAccess) {
        accessibleOperations.push(op as FeatureOperation);
      } else {
        deniedOperations.push(op as FeatureOperation);
        hasAccess = false;
      }
    });
    
    return {
      hasAccess,
      accessibleOperations,
      deniedOperations,
      results
    };
  }, [results]);
}

/**
 * Hook for getting operations by category
 */
export function useFeatureGatesByCategory(category: string): Record<string, FeatureGateResult> {
  const operations = useMemo(() => {
    return Object.keys(FEATURE_OPERATIONS).filter(op => 
      FEATURE_OPERATIONS[op as FeatureOperation].category === category
    ) as FeatureOperation[];
  }, [category]);
  
  return useMultipleFeatureGates(operations);
}

/**
 * Hook for getting high-risk operations (for monitoring)
 */
export function useHighRiskFeatureGates(): Record<string, FeatureGateResult> {
  const operations = useMemo(() => {
    return Object.keys(FEATURE_OPERATIONS).filter(op => 
      FEATURE_OPERATIONS[op as FeatureOperation].riskLevel === 'high'
    ) as FeatureOperation[];
  }, []);
  
  return useMultipleFeatureGates(operations);
}

/**
 * Hook for debugging feature gate access
 */
export function useFeatureGateDebug(): {
  allOperations: Record<string, FeatureGateResult>;
  issues: string[];
  summary: {
    total: number;
    accessible: number;
    denied: number;
    byTier: Record<string, number>;
    byCategory: Record<string, number>;
    byRiskLevel: Record<string, number>;
  };
} {
  const allOperations = useMemo(() => {
    return Object.keys(FEATURE_OPERATIONS) as FeatureOperation[];
  }, []);
  
  const results = useMultipleFeatureGates(allOperations);
  const issues = useMemo(() => FeatureGateEngine.validateImplementation(), []);
  
  const summary = useMemo(() => {
    let accessible = 0;
    let denied = 0;
    const byTier: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};
    
    Object.entries(results).forEach(([op, result]) => {
      if (result.hasAccess) {
        accessible++;
      } else {
        denied++;
      }
      
      // Count by tier requirement
      const tier = result.operation.tierRequirement;
      byTier[tier] = (byTier[tier] || 0) + 1;
      
      // Count by category
      const category = result.operation.category;
      byCategory[category] = (byCategory[category] || 0) + 1;
      
      // Count by risk level
      const risk = result.operation.riskLevel;
      byRiskLevel[risk] = (byRiskLevel[risk] || 0) + 1;
    });
    
    return {
      total: allOperations.length,
      accessible,
      denied,
      byTier,
      byCategory,
      byRiskLevel
    };
  }, [results, allOperations.length]);
  
  return {
    allOperations: results,
    issues,
    summary
  };
}
