/**
 * Usage Data Hook
 *
 * Focused hook for fetching and managing tenant usage statistics.
 * Handles products, locations, users, and other usage metrics.
 * Now uses consolidated useTenantComplete data instead of separate API calls.
 */

import { useMemo } from 'react';
import { useTenantComplete } from '../dashboard/useTenantComplete';
import type { UsageDataResult, TenantUsage, UsageMetric } from './types';

/**
 * Hook for fetching tenant usage data
 * Now uses consolidated data from useTenantComplete instead of separate API calls
 *
 * @param tenantId - The tenant ID to fetch usage data for
 * @returns Usage data with limit checking functions
 */
export function useUsageData(tenantId: string | null): UsageDataResult {
  // Use consolidated data instead of separate API calls
  const { usage: consolidatedUsage, loading, error, refresh } = useTenantComplete(tenantId);

  // Transform consolidated usage data to expected format
  const usage: TenantUsage | null = useMemo(() => {
    if (!consolidatedUsage) return null;

    return {
      products: createUsageMetric(consolidatedUsage.products, null), // TODO: Get limit from tier data
      locations: createUsageMetric(consolidatedUsage.locations, null), // TODO: Get limit from tier data
      users: createUsageMetric(consolidatedUsage.users, null), // TODO: Get limit from tier data
      apiCalls: createUsageMetric(consolidatedUsage.apiCalls, null), // TODO: Get limit from tier data
      storageGB: createUsageMetric(consolidatedUsage.storageGB, null) // TODO: Get limit from tier data
    };
  }, [consolidatedUsage]);

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

  return {
    usage,
    isLimitReached,
    getUsagePercentage,
    loading,
    error,
    refresh
  };
}
