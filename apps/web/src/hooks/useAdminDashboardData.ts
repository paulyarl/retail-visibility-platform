import { useQuery } from '@tanstack/react-query';
import { securitySingletonService } from '@/services/SecuritySingletonService';
import { useAuth } from '@/contexts/AuthContext';

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

export interface UseAdminDashboardDataReturn {
  tenants: AdminTenantsData | null;
  syncStats: AdminSyncStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for admin dashboard - only fetches tenants and sync stats
 * Used by /settings/admin page
 */
export function useAdminDashboardData(): UseAdminDashboardDataReturn {
  const { user } = useAuth();
  
  // Check if user is authenticated and has admin privileges
  const isAdmin = user && (user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN' || user.role === 'PLATFORM_SUPPORT');
  
  // Use React Query for admin dashboard data fetching
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'dashboard-data'],
    queryFn: async () => {
      // Only fetch what the dashboard needs: tenants and sync stats
      const [tenantsData, syncStatsData] = await Promise.allSettled([
        securitySingletonService.getAdminTenants(),
        securitySingletonService.getAdminSyncStats()
      ]);

      return {
        tenants: tenantsData.status === 'fulfilled' ? 
          { tenants: Array.isArray(tenantsData.value) ? tenantsData.value : [], total: Array.isArray(tenantsData.value) ? tenantsData.value.length : 0 } : 
          { tenants: [], total: 0 },
        syncStats: syncStatsData.status === 'fulfilled' ? syncStatsData.value : { totalRuns: 0, successRate: 0, outOfSyncCount: 0, failedRuns: 0 }
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    enabled: !!isAdmin,
    retry: isAdmin ? 3 : 0,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  return {
    tenants: data?.tenants || null,
    syncStats: data?.syncStats || null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh: async () => { await refetch(); }
  };
}
