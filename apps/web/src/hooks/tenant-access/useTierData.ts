/**
 * Tier Data Hook
 * 
 * Focused hook for fetching and managing tenant tier information.
 * Part of the new modular architecture replacing monolithic useTenantTier.
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { resolveTier } from '@/lib/tiers/tier-resolver';
import type { TierDataResult, TierInfo, ResolvedTier } from './types';

/**
 * Hook for fetching tenant tier data
 * 
 * @param tenantId - The tenant ID to fetch tier data for
 * @returns Tier data with loading state and refresh function
 */
export function useTierData(tenantId: string | null): TierDataResult {
  const [tier, setTier] = useState<ResolvedTier | null>(null);
  const [organization, setOrganization] = useState<TierInfo | undefined>(undefined);
  const [tenant, setTenant] = useState<TierInfo | undefined>(undefined);
  const [isChain, setIsChain] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTierData = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch tenant and organization tier data
      const response = await api.get(`/api/tenants/${tenantId}/tier`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tier data: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract tier information
      const organizationTier: TierInfo | null = data.organizationTierData || null;
      const tenantTier: TierInfo | null = data.tenantTier || null;
      const chainStatus = data.isChain || false;

      // Resolve effective tier using existing middleware
      const resolvedTier = resolveTier(organizationTier, tenantTier, chainStatus);

      // Update state
      setTier(resolvedTier);
      setOrganization(organizationTier || undefined);
      setTenant(tenantTier || undefined);
      setIsChain(chainStatus);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tier data';
      setError(errorMessage);
      console.error('[useTierData] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when tenantId changes
  useEffect(() => {
    fetchTierData();
  }, [tenantId]);

  return {
    tier,
    organization,
    tenant,
    isChain,
    loading,
    error,
    refresh: fetchTierData
  };
}
