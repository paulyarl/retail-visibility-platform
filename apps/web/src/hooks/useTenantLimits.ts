'use client';

/**
 * Hook for managing tenant (location) creation limits
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantLimitsService } from '@/services/TenantLimitsSingletonService';

export interface TenantLimitStatus {
  current: number;
  limit: any;
  remaining: any;
  tier: string;
  status: string;
  tierDisplayName: string;
  canCreate: boolean;
  upgradeMessage?: string;
  upgradeToTier?: string;
  tenant?: Array<{
    id: string;
    name: string;
    tier: string;
    status: string;
  }>;
  tenants?: Array<{
    id: string;
    name: string;
    tier: string;
    status: string;
  }>;
}

export interface TierInfo {
  tier: string;
  limit: number | 'unlimited';
  displayName: string;
  description: string;
  upgradeMessage: string;
  upgradeToTier?: string;
}

export function useTenantLimits() {
  const { data: status, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['tenant-limits', 'status'],
    queryFn: async (): Promise<TenantLimitStatus> => {
      const response = await tenantLimitsService.getTenantLimitsStatus();

      if (!response) {
        throw new Error('Failed to fetch tenant limit status');
      }

      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - limits change infrequently
    gcTime: 15 * 60 * 1000, // 15 minutes cache
  });

  const refresh = () => {
    refetch();
  };

  return {
    status,
    loading,
    error: error instanceof Error ? error.message : null,
    refresh,
    
    // Computed values
    canCreateTenant: status?.canCreate ?? false,
    isAtLimit: status ? (
      status.limit === 'unlimited' ? false : status.current >= status.limit
    ) : false,
    percentUsed: status && status.limit !== 'unlimited' ? 
      Math.round((status.current / (status.limit as number)) * 100) : 0,
  };
}

/**
 * Hook to fetch all tier information
 */
export function useTierInfo() {
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use TenantLimitsService for platform caching and proper error handling
      const tiersData = await tenantLimitsService.getTiers();
      setTiers(tiersData);
    } catch (err) {
      console.error('[useTierInfo] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return {
    tiers,
    loading,
    error,
  };
}
