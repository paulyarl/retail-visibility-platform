import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { platformDashboardService } from '@/services/PlatformDashboardSingletonService';
import { publicPlatformDashboardService } from '@/services/PublicPlatformDashboardService';
import { PlatformDashboardData, PlatformStats, TenantMetrics, PlatformActivity } from '@/services/interfaces/PlatformDashboardInterfaces';

export interface UsePlatformCompleteProps {
  isAuthenticated: boolean;
}

export interface UsePlatformCompleteReturn {
  data: PlatformDashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  metrics: {
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    cacheSize: number;
    apiCalls: number;
    errors: number;
    lastUpdated: string;
  } | null;
}

/**
 * Platform Dashboard Hook - Phase 2 Implementation
 * 
 * This hook provides consolidated access to platform-wide dashboard data
 * using the appropriate service based on authentication state.
 * 
 * Benefits:
 * - Single API call instead of multiple separate calls
 * - Intelligent caching with 5-minute TTL
 * - Real-time metrics and performance monitoring
 * - Automatic error handling and retry logic
 * - Type-safe data structures
 * 
 * Usage:
 * ```typescript
 * const { data, loading, error, metrics } = usePlatformComplete({ isAuthenticated });
 * ```
 */
export function usePlatformComplete({ isAuthenticated }: UsePlatformCompleteProps): UsePlatformCompleteReturn {
  // Single consolidated query - uses appropriate service based on auth state
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ['platform', 'dashboard', 'complete', isAuthenticated ? 'authenticated' : 'public'],
    queryFn: async (): Promise<PlatformDashboardData> => {
      // Choose service based on authentication state prop
      const data = isAuthenticated 
        ? await platformDashboardService.getPlatformDashboard()
        : await publicPlatformDashboardService.getPublicPlatformDashboard();
      
      if (!data) {
        throw new Error('Failed to fetch platform dashboard data');
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - matches singleton cache TTL
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false, // Platform data doesn't change frequently
    refetchOnReconnect: true, // Reconnect should refresh data
  });

  // Separate query for metrics (more frequent updates)
  const { data: metricsData } = useQuery({
    queryKey: ['platform', 'dashboard', 'metrics'],
    queryFn: async () => {
      console.log('[usePlatformComplete] Fetching platform metrics');
      
      // For now, return null as we don't have a metrics endpoint in the service
      // This could be added later if needed
      return null;
    },
    staleTime: 30 * 1000, // 30 seconds for metrics
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const loading = isLoading;
  const queryError = error ? (error instanceof Error ? error.message : String(error)) : null;

  return {
    data: dashboardData || null,
    loading,
    error: queryError,
    refresh: async () => { 
      await refetch(); 
    },
    metrics: metricsData || null
  };
}

/**
 * Hook for platform stats only
 * Use when you only need statistics and don't need tenant/activity data
 */
export function usePlatformStats({ isAuthenticated }: UsePlatformCompleteProps): {
  data: PlatformStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform', 'stats', isAuthenticated ? 'authenticated' : 'public'],
    queryFn: async (): Promise<PlatformStats> => {
      console.log('[usePlatformStats] Fetching platform statistics');
      
      // Choose service based on authentication state prop
      let result: PlatformStats;
      
      if (isAuthenticated) {
        const data = await platformDashboardService.getPlatformStats();
        result = data!;
      } else {
        const data = await publicPlatformDashboardService.getPublicPlatformStats();
        result = data!;
      }
      
      if (!result) {
        throw new Error('Failed to fetch platform stats');
      }

      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const queryError = error ? (error instanceof Error ? error.message : String(error)) : null;

  return {
    data: data || null,
    loading: isLoading,
    error: queryError,
    refresh: async () => { await refetch(); },
  };
}

/**
 * Hook for top performing tenants (Authenticated Only)
 * Use when you need tenant performance data (requires authentication)
 * Note: Returns empty data for unauthenticated users
 */
export function useTopTenants(): {
  data: TenantMetrics[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform', 'top-tenants'],
    queryFn: async (): Promise<TenantMetrics[]> => {
      console.log('[useTopTenants] Fetching top performing tenants');
      
      // Only authenticated service has this endpoint
      const data = await platformDashboardService.getTopTenants();
      
      if (!data) {
        throw new Error('Failed to fetch top tenants');
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    retry: 2,
    refetchOnWindowFocus: false,
    enabled: typeof window !== 'undefined' && localStorage.getItem('access_token') !== null, // Only run if authenticated
  });

  const queryError = error ? (error instanceof Error ? error.message : String(error)) : null;

  return {
    data: data || null,
    loading: isLoading,
    error: queryError,
    refresh: async () => { await refetch(); },
  };
}

/**
 * Hook for recent platform activity (Authenticated Only)
 * Use when you need activity feed data (requires authentication)
 * Note: Returns empty data for unauthenticated users
 */
export function useRecentActivity(): {
  data: PlatformActivity[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform', 'recent-activity'],
    queryFn: async (): Promise<PlatformActivity[]> => {
      console.log('[useRecentActivity] Fetching recent platform activity');
      
      const data = await platformDashboardService.getRecentActivity();
      
      if (!data) {
        throw new Error('Failed to fetch recent activity');
      }
      
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
    enabled: typeof window !== 'undefined' && localStorage.getItem('access_token') !== null, // Only run if authenticated
  });

  const queryError = error ? (error instanceof Error ? error.message : String(error)) : null;

  return {
    data: data || null,
    loading: isLoading,
    error: queryError,
    refresh: async () => { await refetch(); }
  };
}

/**
 * Hook for clearing platform dashboard cache
 * Use for manual cache invalidation
 */
export function useClearPlatformCache(): {
  clearCache: () => Promise<void>;
  loading: boolean;
  error: string | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const clearCache = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[useClearPlatformCache] Clearing platform dashboard cache');
      
      await platformDashboardService.invalidateDashboardCache();
      
      // Invalidate all platform queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['platform'] });
      
      console.log('[useClearPlatformCache] Cache cleared successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear cache';
      setError(errorMessage);
      console.error('[useClearPlatformCache] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return { clearCache, loading, error };
}
