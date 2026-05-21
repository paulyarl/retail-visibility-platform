'use client';

/**
 * useTierSystem Hook
 * 
 * Provides dynamic tier data from the API instead of static TIER_LIMITS
 * Handles both individual and organization/chain tier types
 */

import { useState, useEffect, useCallback } from 'react';
import { tenantTierService, DbTier, Tier } from '@/services/TenantTierService';
import { TIER_LIMITS, TierLimits, SubscriptionTier } from '@/lib/tiers';
import { CHAIN_TIERS, ChainTier, ChainTierLimits } from '@/lib/chain-tiers';

// Cache for tier data
let _tierCache: {
  individual: Tier[];
  organization: Tier[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface UseTierSystemResult {
  // Raw tier data from API
  individualTiers: Tier[];
  organizationTiers: Tier[];
  
  // Transformed for display
  allTiers: Tier[];
  
  // Lookup helpers
  getTierById: (id: string) => Tier | undefined;
  getTierByKey: (key: string) => Tier | undefined;
  getTierInfo: (tierKey: string) => TierLimits | ChainTierLimits;
  
  // State
  loading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => void;
}

/**
 * Transform DbTier to Tier format
 */
function transformDbTier(dbTier: DbTier): Tier {
  return {
    id: dbTier.id,
    tierKey: dbTier.id,
    name: dbTier.name,
    displayName: dbTier.displayName,
    description: dbTier.description,
    priceMonthly: dbTier.price,
    maxSkus: dbTier.maxSkus,
    maxLocations: dbTier.maxLocations,
    tierType: dbTier.type,
    isActive: true,
    sortOrder: dbTier.sortOrder,
    features: dbTier.features || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get fallback tier info from static TIER_LIMITS or CHAIN_TIERS
 */
function getFallbackTierInfo(tierKey: string): TierLimits | ChainTierLimits {
  // Check if it's a chain tier
  if (tierKey.startsWith('chain_')) {
    return CHAIN_TIERS[tierKey as ChainTier] || CHAIN_TIERS.chain_starter;
  }
  
  // Check if it's an individual tier
  const staticTier = TIER_LIMITS[tierKey as SubscriptionTier];
  if (staticTier) {
    return staticTier;
  }
  
  // Default fallback
  return TIER_LIMITS.starter;
}

/**
 * Convert API Tier to TierLimits format for compatibility
 */
function tierToLimits(tier: Tier): TierLimits {
  // Convert features from objects to strings for backward compatibility
  const features = (tier.features || []).map((feature: any) => 
    typeof feature === 'object' ? feature.featureName || feature.featureKey : feature
  );
  
  return {
    name: tier.displayName,
    price: tier.priceMonthly === 0 ? 'Free / 14-day' : `$${tier.priceMonthly}/month`,
    pricePerMonth: tier.priceMonthly,
    maxSkus: tier.maxSkus || Infinity,
    maxLocations: tier.maxLocations || 1,
    description: tier.description || '',
    features: features,
    color: getTierColor(tier.tierType, tier.tierKey),
  };
}

/**
 * Get tier color based on type
 */
function getTierColor(tierType: string, tierKey: string): string {
  if (tierType === 'organization') return 'bg-emerald-100 text-emerald-900';
  
  const colors: Record<string, string> = {
    google_only: 'bg-green-100 text-green-900',
    discovery: 'bg-green-100 text-green-900',
    commitment: 'bg-blue-100 text-blue-900',
    storefront: 'bg-blue-100 text-blue-900',
    starter: 'bg-blue-100 text-blue-900',
    professional: 'bg-purple-100 text-purple-900',
    enterprise: 'bg-amber-100 text-amber-900',
  };
  return colors[tierKey] || 'bg-neutral-100 text-neutral-900';
}

export function useTierSystem(): UseTierSystemResult {
  const [individualTiers, setIndividualTiers] = useState<Tier[]>([]);
  const [organizationTiers, setOrganizationTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(!_tierCache);
  const [error, setError] = useState<string | null>(null);

  const loadTiers = useCallback(async () => {
    // Check cache
    if (_tierCache && Date.now() - _tierCache.timestamp < CACHE_TTL) {
      setIndividualTiers(_tierCache.individual);
      setOrganizationTiers(_tierCache.organization);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const dbTiers = await tenantTierService.getAdminTiers();
      
      if (!dbTiers || dbTiers.length === 0) {
        // Use static fallback if API fails
        console.warn('[useTierSystem] No tiers from API, using static fallback');
        return;
      }

      // Separate individual and organization tiers
      const individual: Tier[] = [];
      const organization: Tier[] = [];

      for (const dbTier of dbTiers) {
        const tier = transformDbTier(dbTier);
        if (tier.tierType === 'organization' || tier.tierType === 'chain') {
          organization.push(tier);
        } else {
          individual.push(tier);
        }
      }

      // Sort by sortOrder
      individual.sort((a, b) => a.sortOrder - b.sortOrder);
      organization.sort((a, b) => a.sortOrder - b.sortOrder);

      setIndividualTiers(individual);
      setOrganizationTiers(organization);

      // Update cache
      _tierCache = {
        individual,
        organization,
        timestamp: Date.now(),
      };
    } catch (err) {
      console.error('[useTierSystem] Failed to load tiers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tiers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTiers();
  }, [loadTiers]);

  const allTiers = [...individualTiers, ...organizationTiers];

  const getTierById = useCallback((id: string) => {
    return allTiers.find(t => t.id === id);
  }, [allTiers]);

  const getTierByKey = useCallback((key: string) => {
    return allTiers.find(t => t.tierKey === key || t.name === key);
  }, [allTiers]);

  const getTierInfo = useCallback((tierKey: string): TierLimits | ChainTierLimits => {
    // First try to find in dynamic tiers
    const tier = getTierByKey(tierKey);
    if (tier) {
      return tierToLimits(tier);
    }
    
    // Fallback to static
    return getFallbackTierInfo(tierKey);
  }, [getTierByKey]);

  const refresh = useCallback(() => {
    _tierCache = null;
    loadTiers();
  }, [loadTiers]);

  return {
    individualTiers,
    organizationTiers,
    allTiers,
    getTierById,
    getTierByKey,
    getTierInfo,
    loading,
    error,
    refresh,
  };
}

/**
 * Invalidate tier cache (call after tier updates)
 */
export function invalidateTierCache() {
  _tierCache = null;
}

/**
 * Hook for getting just the tier info helper (lighter weight)
 */
export function useTierInfo() {
  const { getTierInfo, loading } = useTierSystem();
  return { getTierInfo, loading };
}
