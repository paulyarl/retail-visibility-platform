import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminCacheService, ConsolidatedAdminData } from '@/lib/cache/admin-cache-service';
import { useAuth } from '@/contexts/AuthContext';

export interface UseAdminDataReturn {
  adminData: ConsolidatedAdminData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  // Individual data accessors
  tenants: ConsolidatedAdminData['tenants'] | null;
  syncStats: ConsolidatedAdminData['syncStats'] | null;
  securitySessions: ConsolidatedAdminData['securitySessions'] | null;
  securityStats: ConsolidatedAdminData['securityStats'] | null;
  securityAlerts: ConsolidatedAdminData['securityAlerts'] | null;
  securityAlertStats: ConsolidatedAdminData['securityAlertStats'] | null;
  failedLogins: ConsolidatedAdminData['failedLogins'] | null;
}

/**
 * Centralized hook for admin data with local storage caching
 * Provides consolidated admin data fetching with performance optimizations
 */
export function useAdminData(): UseAdminDataReturn {
  const { user } = useAuth();
  // Use React Query for admin data fetching with caching
  const { data: adminData, isLoading: adminLoading, error: adminError, refetch } = useQuery({
    queryKey: ['admin', 'consolidated-data'],
    queryFn: async (): Promise<ConsolidatedAdminData> => {
      try {
        const data = await AdminCacheService.getConsolidatedAdminData(true, user?.id);
        return data;
      } catch (error) {
        console.error('[useAdminData] Failed to fetch admin data:', error);
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - admin data changes moderately frequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false, // Don't refetch on window focus for admin data
    refetchOnReconnect: true, // Refetch when connection is restored
  });

  const loading = adminLoading;
  const error = adminError ? (adminError instanceof Error ? adminError.message : String(adminError)) : null;

  return {
    adminData: adminData || null,
    loading,
    error,
    refresh: async () => { await refetch(); },

    // Individual data accessors for convenience
    tenants: adminData?.tenants || null,
    syncStats: adminData?.syncStats || null,
    securitySessions: adminData?.securitySessions || null,
    securityStats: adminData?.securityStats || null,
    securityAlerts: adminData?.securityAlerts || null,
    securityAlertStats: adminData?.securityAlertStats || null,
    failedLogins: adminData?.failedLogins || null,
  };
}

/**
 * Hook for specific admin data types (when you only need one type)
 */
export function useAdminTenants() {
  const { tenants, loading, error, refresh } = useAdminData();
  return { tenants, loading, error, refresh };
}

export function useAdminSyncStats() {
  const { syncStats, loading, error, refresh } = useAdminData();
  return { syncStats, loading, error, refresh };
}

export function useAdminSecurityData() {
  const { securitySessions, securityStats, securityAlerts, securityAlertStats, failedLogins, loading, error, refresh } = useAdminData();
  return {
    securitySessions,
    securityStats,
    securityAlerts,
    securityAlertStats,
    failedLogins,
    loading,
    error,
    refresh
  };
}
