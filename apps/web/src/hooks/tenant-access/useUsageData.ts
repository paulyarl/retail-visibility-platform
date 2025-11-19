/**
 * Usage Data Hook
 * 
 * Focused hook for fetching and managing tenant usage statistics.
 * Handles products, locations, users, and other usage metrics.
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { UsageDataResult, TenantUsage, UsageMetric } from './types';

/**
 * Hook for fetching tenant usage data
 * 
 * @param tenantId - The tenant ID to fetch usage data for
 * @returns Usage data with limit checking functions
 */
export function useUsageData(tenantId: string | null): UsageDataResult {
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageData = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch usage statistics
      const response = await api.get(`/api/tenants/${tenantId}/usage`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch usage data: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform API response to standardized usage format
      const usageData: TenantUsage = {
        products: createUsageMetric(data.currentItems || 0, data.monthlySkuQuota),
        locations: createUsageMetric(1, null), // TODO: Get actual location count and limit
        users: createUsageMetric(0, null), // TODO: Get actual user count and limit
        apiCalls: createUsageMetric(0, null), // TODO: Get actual API call count and limit
        storageGB: createUsageMetric(0, null) // TODO: Get actual storage usage and limit
      };

      setUsage(usageData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load usage data';
      setError(errorMessage);
      console.error('[useUsageData] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to create standardized usage metrics
  const createUsageMetric = (current: number, limit: number | null): UsageMetric => {
    const isUnlimited = limit === null || limit === undefined;
    const percent = isUnlimited ? 0 : Math.round((current / limit) * 100);
    
    return {
      current,
      limit,
      percent,
      isUnlimited
    };
  };

  // Check if a specific limit type is reached
  const isLimitReached = (limitType: keyof TenantUsage): boolean => {
    if (!usage) return false;
    const metric = usage[limitType];
    if (!metric) return false;
    return !metric.isUnlimited && metric.percent >= 100;
  };

  // Get usage percentage for a specific limit type
  const getUsagePercentage = (limitType: keyof TenantUsage): number => {
    if (!usage) return 0;
    const metric = usage[limitType];
    if (!metric) return 0;
    return metric.percent;
  };

  // Auto-fetch when tenantId changes
  useEffect(() => {
    fetchUsageData();
  }, [tenantId]);

  // Set up background refresh for usage data (every 30 seconds)
  useEffect(() => {
    if (!tenantId) return;

    const interval = setInterval(() => {
      fetchUsageData();
    }, 30 * 1000); // 30 seconds

    return () => clearInterval(interval);
  }, [tenantId]);

  return {
    usage,
    isLimitReached,
    getUsagePercentage,
    loading,
    error,
    refresh: fetchUsageData
  };
}
