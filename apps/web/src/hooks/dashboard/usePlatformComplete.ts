import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalItems: number;
  activeItems: number;
  totalUsers: number;
  activeUsers: number;
  totalOrganizations: number;
  systemHealth: {
    database: 'healthy' | 'degraded' | 'down';
    cache: 'healthy' | 'degraded' | 'down';
    api: 'healthy' | 'degraded' | 'down';
  };
  growthMetrics: {
    newTenantsThisMonth: number;
    newItemsThisMonth: number;
    newUsersThisMonth: number;
  };
}

export interface TenantMetrics {
  id: string;
  name: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  locationStatus: string;
  itemCount: number;
  userCount: number;
  lastActive: string;
  healthScore: number;
}

export interface PlatformActivity {
  type: 'tenant_created' | 'item_added' | 'user_registered';
  tenantId: string;
  tenantName: string;
  timestamp: string;
  details: string;
}

export interface PlatformDashboardData {
  stats: PlatformStats;
  topTenants: TenantMetrics[];
  recentActivity: PlatformActivity[];
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
      console.log('[usePlatformComplete] Fetching consolidated platform dashboard data');

      const response = await api.get('/api/platform/dashboard');

      if (!response.ok) {
        throw new Error(`Failed to fetch platform dashboard: ${response.status}`);
      }

      const data = await response.json();
      console.log('[usePlatformComplete] Received consolidated data:', {
        hasStats: !!data.data?.stats,
        hasTopTenants: !!data.data?.topTenants,
        hasActivity: !!data.data?.recentActivity,
        cacheMetrics: data._cache?.metrics
      });

      return data.data;
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
      
      const response = await api.get('/api/platform/metrics');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch platform metrics: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
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
      
      const response = await api.get('/api/platform/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch platform stats: ${response.status}`);
      }
      
      const data = await response.json();
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
    queryKey: ['platform', 'tenants', 'top'],
    queryFn: async (): Promise<TenantMetrics[]> => {
      console.log('[useTopTenants] Fetching top performing tenants');
      
      const response = await api.get('/api/platform/tenants/top');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch top tenants: ${response.status}`);
      }
      
      const data = await response.json();
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
export function usePlatformActivity(): {
  data: PlatformActivity[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform', 'activity'],
    queryFn: async (): Promise<PlatformActivity[]> => {
      console.log('[usePlatformActivity] Fetching recent platform activity');
      
      const response = await api.get('/api/platform/activity');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch platform activity: ${response.status}`);
      }
      
      const data = await response.json();
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
      
      const response = await api.delete('/api/platform/cache');
      
      if (!response.ok) {
        throw new Error(`Failed to clear cache: ${response.status}`);
      }
      
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
