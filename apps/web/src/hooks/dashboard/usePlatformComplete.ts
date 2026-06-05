import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { platformDashboardService } from '@/services/PlatformDashboardSingletonService';
import { publicPlatformDashboardService } from '@/services/PublicPlatformDashboardService';
import { PlatformDashboardData, PlatformStats, TenantMetrics, PlatformActivity } from '@/services/interfaces/PlatformDashboardInterfaces';

export interface UsePlatformCompleteProps {
  isAuthenticated: boolean;
  /** Load secondary data (topTenants, recentActivity) - set false to defer loading */
  loadSecondary?: boolean;
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
 * - Supports deferred loading of secondary data (topTenants, recentActivity)
 * 
 * Usage:
 * ```typescript
 * // Load everything immediately (default)
 * const { data, loading, error, metrics } = usePlatformComplete({ isAuthenticated });
 * 
 * // Defer secondary data loading for better initial performance
 * const { data, loading, error } = usePlatformComplete({ isAuthenticated, loadSecondary: false });
 * ```
 */
export function usePlatformComplete({ isAuthenticated, loadSecondary = true }: UsePlatformCompleteProps): UsePlatformCompleteReturn {
  // Primary query - stats only (fast, critical data)
  const { data: statsData, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['platform', 'stats', isAuthenticated ? 'authenticated' : 'public'],
    queryFn: async (): Promise<PlatformStats> => {
      try {
        const data = isAuthenticated 
          ? await platformDashboardService.getPlatformStats()
          : await publicPlatformDashboardService.getPublicPlatformStats();
        
        if (!data) {
          throw new Error('Failed to fetch platform stats');
        }
        return data;
      } catch (error) {
        console.warn('[usePlatformComplete] Stats fetch failed:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1, // Reduced from 2 to fail faster
    retryDelay: 1000, // Fixed delay instead of exponential
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Return empty stats on error to prevent cascading failures
    throwOnError: false,
  });

  // Secondary query - topTenants (deferred, only when loadSecondary is true)
  const { data: topTenantsData, isLoading: topTenantsLoading } = useQuery({
    queryKey: ['platform', 'top-tenants'],
    queryFn: async (): Promise<TenantMetrics[]> => {
      try {
        const data = await platformDashboardService.getTopTenants();
        if (!data) return []; // Return empty instead of throwing
        return data;
      } catch (error) {
        console.warn('[usePlatformComplete] TopTenants fetch failed, returning empty:', error);
        return []; // Return empty on error to prevent cascading
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0, // No retry for secondary data
    enabled: loadSecondary && isAuthenticated && !!statsData, // Only run if primary succeeded
    refetchOnWindowFocus: false,
    throwOnError: false,
  });

  // Secondary query - recentActivity (deferred, only when loadSecondary is true)
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['platform', 'recent-activity'],
    queryFn: async (): Promise<PlatformActivity[]> => {
      try {
        const data = await platformDashboardService.getRecentActivity();
        if (!data) return []; // Return empty instead of throwing
        return data;
      } catch (error) {
        console.warn('[usePlatformComplete] Activity fetch failed, returning empty:', error);
        return []; // Return empty on error to prevent cascading
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 0, // No retry for secondary data
    enabled: loadSecondary && isAuthenticated && !!statsData, // Only run if primary succeeded
    refetchOnWindowFocus: false,
    throwOnError: false,
  });

  // Combine data into expected format
  const dashboardData: PlatformDashboardData | null = statsData ? {
    stats: statsData,
    topTenants: topTenantsData || [],
    recentActivity: activityData || [],
  } : null;

  const loading = statsLoading || (loadSecondary && (topTenantsLoading || activityLoading));
  const queryError = statsError ? (statsError instanceof Error ? statsError.message : String(statsError)) : null;

  return {
    data: dashboardData,
    loading,
    error: queryError,
    refresh: async () => { 
      await refetchStats(); 
    },
    metrics: null
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
