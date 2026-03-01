/**
 * Tenant Context Hook
 * 
 * React hook for managing tenant context in components
 * Automatically sets tenant context from URL on mount
 * Provides tenant context state and utilities
 */

import { useEffect, useState } from 'react';
import { 
  clientTenantContextManager, 
  getCurrentTenantId, 
  setTenantContext, 
  isInTenantContext,
  getTenantAwareCacheKey,
  type TenantContextInfo,
  type TenantContextSource 
} from '@/lib/clientTenantContext';

/**
 * Hook for managing tenant context in React components
 * Automatically detects and sets tenant context from URL
 */
export function useTenantContext() {
  const [context, setContext] = useState<TenantContextInfo>(() => {
    // Provide default context during SSR
    if (typeof window === 'undefined') {
      return {
        tenantId: null,
        source: 'none',
        isAutoSet: false,
        lastUpdated: new Date().toISOString()
      };
    }
    return clientTenantContextManager.getTenantContext();
  });
  
  // Auto-detect and set tenant context from URL
  useEffect(() => {
    const wasSet = clientTenantContextManager.autoSetFromUrl();
    if (wasSet) {
      setContext(clientTenantContextManager.getTenantContext());
    }
  }, []);
  
  // Listen for storage changes (for cross-tab synchronization)
  useEffect(() => {
    // Only add storage listener on client side
    if (typeof window === 'undefined') return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'currentTenantId' || e.key === 'tenantContext') {
        setContext(clientTenantContextManager.getTenantContext());
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  return {
    // Current state
    tenantId: context.tenantId,
    source: context.source,
    url: context.url,
    isInTenantContext: context.tenantId !== null,
    
    // Actions
    setTenantContext: (tenantId: string, source?: TenantContextSource) => {
      clientTenantContextManager.setTenantContext(tenantId, source);
      setContext(clientTenantContextManager.getTenantContext());
    },
    
    clearTenantContext: () => {
      clientTenantContextManager.clearTenantContext();
      setContext(clientTenantContextManager.getTenantContext());
    },
    
    // Utilities
    getTenantAwareCacheKey: (baseKey: string, tenantId?: string) => 
      getTenantAwareCacheKey(baseKey, tenantId),
    
    // Refresh context
    refresh: () => {
      setContext(clientTenantContextManager.getTenantContext());
    }
  };
}

/**
 * Hook for tenant-aware caching
 * Provides cache key generation with tenant context
 */
export function useTenantAwareCache() {
  const { tenantId } = useTenantContext();
  
  return {
    getCacheKey: (baseKey: string, customTenantId?: string) => 
      getTenantAwareCacheKey(baseKey, customTenantId || tenantId || undefined),
    
    tenantId,
    isInTenantContext: tenantId !== null
  };
}

/**
 * Hook for public pages that automatically sets tenant context
 * Ideal for use in page components
 */
export function usePublicPageTenantContext() {
  const { tenantId, isInTenantContext, source } = useTenantContext();
  
  useEffect(() => {
    // Only auto-set if we're not already in a tenant context
    if (!isInTenantContext) {
      clientTenantContextManager.autoSetFromUrl();
    }
  }, [isInTenantContext]);
  
  return {
    tenantId,
    isInTenantContext,
    source,
    isFromUrl: source === 'url',
    isFromStorage: ['localStorage', 'sessionStorage', 'cookie'].includes(source)
  };
}
