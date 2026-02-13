import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { platformDashboardService, PlatformDashboardData, PlatformStats, TenantMetrics, PlatformActivity } from '@/services/PlatformDashboardSingletonService';

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
 * using the new PlatformDashboardSingletonService for optimal performance.
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
 * const { data, loading, error, metrics } = usePlatformComplete();
 * ```
 */
export function usePlatformComplete(): UsePlatformCompleteReturn {
  // Single consolidated query - replaces multiple separate API calls
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ['platform', 'dashboard', 'complete'],
    queryFn: async (): Promise<PlatformDashboardData> => {
//      console.log('[usePlatformComplete] Fetching consolidated platform dashboard data');

      const data = await platformDashboardService.getPlatformDashboard();
      
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
export function usePlatformStats(): {
  data: PlatformStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform', 'stats'],
    queryFn: async (): Promise<PlatformStats> => {
      console.log('[usePlatformStats] Fetching platform statistics');
      
      const data = await platformDashboardService.getPlatformStats();
      
      if (!data) {
        throw new Error('Failed to fetch platform stats');
      }
      
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
    retry: 2,
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
 * Hook for top performing tenants
 * Use when you only need tenant performance data
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
      
      const data = await platformDashboardService.getTopTenants();
      
      if (!data) {
        throw new Error('Failed to fetch top tenants');
      }
      
      return data;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000,
    retry: 2,
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
 * Hook for recent platform activity
 * Use when you only need activity feed data
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
