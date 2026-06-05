import { useQuery } from '@tanstack/react-query';
import { securitySingletonService } from '@/services/SecuritySingletonService';
import { useAuth } from '@/contexts/AuthContext';

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

export interface UseAdminSecurityDataReturn {
  securitySessions: AdminSecuritySessions | null;
  securityStats: AdminSecurityStats | null;
  securityAlerts: AdminSecurityAlerts | null;
  securityAlertStats: AdminSecurityAlertStats | null;
  failedLogins: AdminFailedLogins | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for admin security data - only fetches security-related data
 * Used by /settings/admin/security page
 */
export function useAdminSecurityData(): UseAdminSecurityDataReturn {
  const { user } = useAuth();
  
  // Check if user is authenticated and has admin privileges
  const isAdmin = user && (user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN' || user.role === 'PLATFORM_SUPPORT');
  
  // Use React Query for admin security data fetching
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'security-data'],
    queryFn: async () => {
      // Only fetch what security page needs: security data only
      const [securitySessionsData, securityStatsData, securityAlertsData, securityAlertStatsData, failedLoginsData] = await Promise.allSettled([
        securitySingletonService.getAdminSecuritySessions(),
        securitySingletonService.getAdminSecuritySessionsStats(),
        securitySingletonService.getAdminSecurityAlerts(),
        securitySingletonService.getAdminSecurityAlertsStats(),
        securitySingletonService.getAdminFailedLogins()
      ]);

      return {
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
    },
    staleTime: 1 * 60 * 1000, // 1 minute - security data changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    enabled: !!isAdmin,
    retry: isAdmin ? 3 : 0,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  return {
    securitySessions: data?.securitySessions || null,
    securityStats: data?.securityStats || null,
    securityAlerts: data?.securityAlerts || null,
    securityAlertStats: data?.securityAlertStats || null,
    failedLogins: data?.failedLogins || null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh: async () => { await refetch(); }
  };
}
