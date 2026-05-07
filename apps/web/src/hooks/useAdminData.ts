import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { securitySingletonService } from '@/services/SecuritySingletonService';
import { useAuth } from '@/contexts/AuthContext';

// Define interfaces inline since AdminCacheService is removed
interface AdminTenantsData {
  tenants: any[];
  total: number;
}

interface AdminSyncStats {
  totalRuns: number;
  successRate: number;
  outOfSyncCount: number;
  failedRuns: number;
}

interface AdminSecuritySessions {
  data: any[];
  total: number;
}

interface AdminSecurityStats {
  activeSessions: number;
  activeUsers: number;
  sessionsLast24h: number;
  revokedSessions: number;
  deviceBreakdown: Array<{ type: string; count: number }>;
}

interface AdminSecurityAlerts {
  data: any[];
  total: number;
}

interface AdminSecurityAlertStats {
  totalAlerts: number;
  unreadAlerts: number;
  alertsLast24h: number;
  criticalAlerts: number;
  warningAlerts: number;
  typeBreakdown: Array<{ type: string; count: number }>;
}

interface AdminFailedLogins {
  data: any[];
}

interface ConsolidatedAdminData {
  tenants: AdminTenantsData;
  syncStats: AdminSyncStats;
  securitySessions: AdminSecuritySessions;
  securityStats: AdminSecurityStats;
  securityAlerts: AdminSecurityAlerts;
  securityAlertStats: AdminSecurityAlertStats;
  failedLogins: AdminFailedLogins;
}

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
  
  // Check if user is authenticated and has admin privileges
  const isAdmin = user && (user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN' || user.role === 'PLATFORM_SUPPORT');
  
  // Use React Query for admin data fetching with caching
  const { data: adminData, isLoading: adminLoading, error: adminError, refetch } = useQuery({
    queryKey: ['admin', 'consolidated-data'],
    queryFn: async (): Promise<ConsolidatedAdminData> => {
      try {
        // Fetch data directly from singleton services (they already cache)
        const [tenantsData, syncStatsData, securitySessionsData, securityStatsData, securityAlertsData, securityAlertStatsData, failedLoginsData] = await Promise.allSettled([
          securitySingletonService.getAdminTenants(),
          securitySingletonService.getAdminSyncStats(),
          securitySingletonService.getAdminSecuritySessions(),
          securitySingletonService.getAdminSecuritySessionsStats(),
          securitySingletonService.getAdminSecurityAlerts(),
          securitySingletonService.getAdminSecurityAlertsStats(),
          securitySingletonService.getAdminFailedLogins()
        ]);

        // Build consolidated data object
        const consolidatedData: ConsolidatedAdminData = {
          tenants: tenantsData.status === 'fulfilled' ? 
            { tenants: Array.isArray(tenantsData.value) ? tenantsData.value : [], total: Array.isArray(tenantsData.value) ? tenantsData.value.length : 0 } : 
            { tenants: [], total: 0 },
          syncStats: syncStatsData.status === 'fulfilled' ? syncStatsData.value : { totalRuns: 0, successRate: 0, outOfSyncCount: 0, failedRuns: 0 },
          securitySessions: securitySessionsData.status === 'fulfilled' ? securitySessionsData.value : { data: [], total: 0 },
          securityStats: securityStatsData.status === 'fulfilled' ? securityStatsData.value : { activeSessions: 0, activeUsers: 0, sessionsLast24h: 0, revokedSessions: 0, deviceBreakdown: [] },
          securityAlerts: securityAlertsData.status === 'fulfilled' ? 
            { data: Array.isArray(securityAlertsData.value) ? securityAlertsData.value : [], total: Array.isArray(securityAlertsData.value) ? securityAlertsData.value.length : 0 } : 
            { data: [], total: 0 },
          securityAlertStats: securityAlertStatsData.status === 'fulfilled' ? securityAlertStatsData.value : { totalAlerts: 0, unreadAlerts: 0, alertsLast24h: 0, criticalAlerts: 0, warningAlerts: 0, typeBreakdown: [] },
          failedLogins: failedLoginsData.status === 'fulfilled' ? 
            { data: Array.isArray(failedLoginsData.value) ? failedLoginsData.value : [] } : 
            { data: [] }
        };

        return consolidatedData;
      } catch (error) {
        console.error('[useAdminData] Failed to fetch admin data:', error);
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - admin data changes moderately frequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    enabled: !!isAdmin, // Only run query if user is admin
    retry: isAdmin ? 3 : 0, // Only retry if user is admin
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
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
