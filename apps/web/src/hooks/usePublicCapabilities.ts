/**
 * Public Capabilities Hook
 * 
 * For non-authenticated users or public-facing features
 * Pulls capabilities from database for public access patterns
 */

import { useMemo } from 'react';
import { useCapabilityGate } from './useCapabilityGate';

export interface PublicCapabilityResult {
  capabilities: string[];
  restrictions?: {
    maxItems?: number;
    allowedTypes?: string[];
    blockedOperations?: string[];
  };
  hasAccess: boolean;
}

/**
 * Hook for checking public (non-authenticated) capabilities
 * Used for public product catalogs, browsing, etc.
 */
export function usePublicCapability(capabilityType: string): PublicCapabilityResult {
  // For public scope, we use a special 'public' tier context
  const capabilityResult = useCapabilityGate(capabilityType);
  
  return useMemo(() => {
    // Public capabilities are typically more restricted
    // Could be fetched from a 'public_tier' or 'anonymous_tier' in database
    // Convert Record<string, Capability> to string[]
    const capabilities = capabilityResult.capabilities 
      ? Object.values(capabilityResult.capabilities).map(cap => cap.features || []).flat()
      : [];
    
    return {
      capabilities,
      restrictions: capabilityResult.restrictions,
      hasAccess: capabilityResult.hasAccess
    };
  }, [capabilityResult]);
}

/**
 * Hook for checking multiple public capabilities
 */
export function useMultiplePublicCapabilities(capabilityTypes: string[]): Record<string, PublicCapabilityResult> {
  const results: Record<string, PublicCapabilityResult> = {};
  
  for (const capabilityType of capabilityTypes) {
    results[capabilityType] = usePublicCapability(capabilityType);
  }
  
  return results;
}

/**
 * Hook specifically for public product type access
 */
export function usePublicProductTypes(): PublicCapabilityResult {
  return usePublicCapability('product_types');
}
