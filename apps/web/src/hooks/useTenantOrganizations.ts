/**
 * React Hook for Tenant Organizations Singleton
 * 
 * Provides a clean React interface for the TenantOrganizationsSingleton.
 * Handles subscription management and provides memoized state values.
 * Follows the same pattern as useTenantFeaturedProducts.
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
import { 
  getTenantOrganizationsSingleton,
  destroyTenantOrganizationsSingleton,
  type OrganizationsState,
  type Organization,
  type Tenant,
  type CreateOrganizationData,
  type UpdateOrganizationData
} from '@/lib/singletons/TenantOrganizationsSingleton';

interface UseTenantOrganizationsOptions {
  autoInitialize?: boolean;
  autoDestroy?: boolean;
}

interface UseTenantOrganizationsReturn extends OrganizationsState {
  // Actions
  createOrganization: (data: CreateOrganizationData) => Promise<void>;
  updateOrganization: (orgId: string, data: UpdateOrganizationData) => Promise<void>;
  addTenantToOrganization: (orgId: string, tenantId: string) => Promise<void>;
  removeTenantFromOrganization: (orgId: string, tenantId: string) => Promise<void>;
  refresh: () => Promise<void>;
  refreshTenants: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
  
  // Computed values
  organizationCount: number;
  tenantCount: number;
  hasOrganizations: boolean;
  hasError: boolean;
  isProcessing: boolean;
}

export function useTenantOrganizations(
  tenantId: string,
  options: UseTenantOrganizationsOptions = {}
): UseTenantOrganizationsReturn {
  const { autoInitialize = true, autoDestroy = false } = options;
  
  // Local state to trigger re-renders
  const [state, setState] = useState<OrganizationsState>({
    organizations: [],
    availableTenants: [],
    loading: false,
    error: null,
    processing: false,
    lastUpdated: null,
  });

  // Get singleton instance
  const singleton = useMemo(() => {
    return getTenantOrganizationsSingleton(tenantId);
  }, [tenantId]);

  // Subscribe to singleton state changes
  useEffect(() => {
    const unsubscribe = singleton.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [singleton]);

  // Auto-initialize
  useEffect(() => {
    if (autoInitialize) {
      singleton.fetchOrganizations();
      singleton.fetchAvailableTenants();
    }
  }, [singleton, autoInitialize]);

  // Auto-cleanup
  useEffect(() => {
    return () => {
      if (autoDestroy) {
        destroyTenantOrganizationsSingleton(tenantId);
      }
    };
  }, [tenantId, autoDestroy]);

  // Actions
  const createOrganization = useCallback(async (data: CreateOrganizationData) => {
    await singleton.createOrganization(data);
  }, [singleton]);

  const updateOrganization = useCallback(async (orgId: string, data: UpdateOrganizationData) => {
    await singleton.updateOrganization(orgId, data);
  }, [singleton]);

  const addTenantToOrganization = useCallback(async (orgId: string, tenantId: string) => {
    await singleton.addTenantToOrganization(orgId, tenantId);
  }, [singleton]);

  const removeTenantFromOrganization = useCallback(async (orgId: string, tenantId: string) => {
    await singleton.removeTenantFromOrganization(orgId, tenantId);
  }, [singleton]);

  const refresh = useCallback(async () => {
    await singleton.fetchOrganizations();
  }, [singleton]);

  const refreshTenants = useCallback(async () => {
    await singleton.fetchAvailableTenants();
  }, [singleton]);

  const clearError = useCallback(() => {
    singleton.clearError();
  }, [singleton]);

  const reset = useCallback(() => {
    singleton.reset();
  }, [singleton]);

  // Computed values
  const organizationCount = useMemo(() => state.organizations.length, [state.organizations]);
  const tenantCount = useMemo(() => state.availableTenants.length, [state.availableTenants]);
  const hasOrganizations = useMemo(() => organizationCount > 0, [organizationCount]);
  const hasError = useMemo(() => !!state.error, [state.error]);
  const isProcessing = useMemo(() => state.processing, [state.processing]);

  return {
    // State
    ...state,
    
    // Actions
    createOrganization,
    updateOrganization,
    addTenantToOrganization,
    removeTenantFromOrganization,
    refresh,
    refreshTenants,
    clearError,
    reset,
    
    // Computed values
    organizationCount,
    tenantCount,
    hasOrganizations,
    hasError,
    isProcessing,
  };
}

export default useTenantOrganizations;
