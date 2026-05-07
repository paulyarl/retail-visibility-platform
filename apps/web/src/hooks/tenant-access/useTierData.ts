/**
 * Tier Data Hook
 *
 * Focused hook for fetching and managing tenant tier information.
 * Part of the new modular architecture replacing monolithic useTenantTier.
 * Now uses consolidated useTenantComplete data instead of separate API calls.
 */

import { useMemo } from 'react';
import { useTenantComplete } from '../dashboard/useTenantComplete';
import type { TierDataResult, ResolvedTier } from './types';

/**
 * Hook for fetching tenant tier data
 * Now uses consolidated data from useTenantComplete instead of separate API calls
 *
 * @param tenantId - The tenant ID to fetch tier data for
 * @returns Tier data with loading state and refresh function
 */
export function useTierData(tenantId: string | null): TierDataResult {
  // Use consolidated data instead of separate API calls
  const { tier: consolidatedTier, loading, error, refresh } = useTenantComplete(tenantId);

  // Transform consolidated tier data to expected format
  const tierData: TierDataResult = useMemo(() => {
    return {
      tier: consolidatedTier,
      organization: consolidatedTier?.organization || undefined,
      tenant: consolidatedTier?.effective || undefined,
      isChain: consolidatedTier?.isChain || false,
      loading,
      error,
      refresh
    };
  }, [consolidatedTier, loading, error, refresh]);

  return tierData;
}
