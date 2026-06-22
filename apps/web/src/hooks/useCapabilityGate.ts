/**
 * Capability Gate Hook
 * 
 * React hook for checking capability-based feature access
 * Extends the feature gate system to handle sophisticated capability gating
 */

import { useMemo } from 'react';
import { useTenantTier } from './useTenantTier';
import { usePlatformUser } from '@/lib/auth/platform-admin';
import {
  CapabilityGateEngine,
  type CapabilityGateResult,
  type FeatureGateContext
} from '@/lib/capability-gate';

/**
 * Hook for checking capability access
 * 
 * @param capabilityType - The capability type to check (e.g., 'product_types', 'creation_methods')
 * @returns Capability access result with gating information
 */
export function useCapabilityGate(capabilityType: string): CapabilityGateResult {
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
    return CapabilityGateEngine.checkCapabilityAccess('add_products', capabilityType, context);
  }, [capabilityType, context]);
}

/**
 * Hook for checking multiple capability types at once
 */
export function useMultipleCapabilityGates(capabilityTypes: string[]): Record<string, CapabilityGateResult> {
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
    const results: Record<string, CapabilityGateResult> = {};
    
    for (const capabilityType of capabilityTypes) {
      results[capabilityType] = CapabilityGateEngine.checkCapabilityAccess('add_products', capabilityType, context);
    }
    
    return results;
  }, [capabilityTypes, context]);
}

/**
 * Hook for getting all capabilities for the current tier
 */
export function useAllCapabilities() {
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
    return CapabilityGateEngine.getAllCapabilities(context);
  }, [context]);
}

/**
 * Hook for checking if a specific capability feature is available
 */
export function useCapabilityFeature(capabilityType: string, feature: string): boolean {
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
    return CapabilityGateEngine.hasCapabilityFeature(capabilityType, feature, context);
  }, [capabilityType, feature, context]);
}

/**
 * Hook for getting upgrade path for a capability
 */
export function useCapabilityUpgradePath(capabilityType: string) {
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
    return CapabilityGateEngine.getUpgradePath(capabilityType, context);
  }, [capabilityType, context]);
}
