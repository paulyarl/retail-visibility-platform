'use client';

import { useState, useEffect } from 'react';
import { TierSystemService, TierFeature } from '@/services/TierSystemService';
import { clientLogger } from '@/lib/client-logger';

export interface TierWithHighlights {
  tierKey: string;
  displayName: string;
  description?: string;
  priceMonthly: number;
  maxSkus: number | null;
  maxLocations: number | null;
  highlightedFeatures: Array<{
    featureKey: string;
    featureName: string;
    marketingName: string | null;
    highlightDescription: string | null;
    highlightOrder: number;
  }>;
  allFeatures: string[];
}

interface UseTierHighlightsResult {
  tiers: TierWithHighlights[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTierHighlights(tierType: 'individual' | 'organization' = 'individual'): UseTierHighlightsResult {
  const [tiers, setTiers] = useState<TierWithHighlights[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTiers = async () => {
    try {
      setLoading(true);
      setError(null);

      const service = TierSystemService.getInstance();
      const allTiers = await service.getTierSystemTiers();

      if (!allTiers) {
        setError('Failed to fetch tiers');
        return;
      }

      // Filter by tier type and transform
      const tiersArray = tierType === 'individual' 
        ? (allTiers as any).individual || []
        : (allTiers as any).organization || [];

      const transformedTiers: TierWithHighlights[] = tiersArray
        .filter((tier: any) => tier.isActive)
        .map((tier: any) => {
          // Extract features array - handle both formats
          const features = tier.features || [];
          
          // Get highlighted features
          const highlighted = features
            .filter((f: any) => f.isHighlighted && f.isEnabled !== false)
            .sort((a: any, b: any) => (a.highlightOrder || 0) - (b.highlightOrder || 0))
            .map((f: any) => ({
              featureKey: f.featureKey || f.feature_key,
              featureName: f.featureName || f.feature_name,
              marketingName: f.marketingName || f.marketing_name || null,
              highlightDescription: f.highlightDescription || f.highlight_description || null,
              highlightOrder: f.highlightOrder || f.highlight_order || 0,
            }));

          // Get all feature keys
          const allFeatureKeys = features
            .filter((f: any) => f.isEnabled !== false)
            .map((f: any) => f.featureKey || f.feature_key);

          return {
            tierKey: tier.tierKey || tier.tier_key,
            displayName: tier.displayName || tier.display_name,
            description: tier.description,
            priceMonthly: typeof tier.priceMonthly === 'string' 
              ? parseFloat(tier.priceMonthly) 
              : (tier.priceMonthly || tier.price_monthly || 0),
            maxSkus: tier.maxSkus || tier.max_skus,
            maxLocations: tier.maxLocations || tier.max_locations,
            highlightedFeatures: highlighted,
            allFeatures: allFeatureKeys,
          };
        });

      setTiers(transformedTiers);
    } catch (err) {
      clientLogger.error('[useTierHighlights] Error:', { detail: err });
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, [tierType]);

  return {
    tiers,
    loading,
    error,
    refetch: fetchTiers,
  };
}

/**
 * Get highlighted features for a specific tier
 */
export function useSingleTierHighlights(tierKey: string): {
  tier: TierWithHighlights | null;
  loading: boolean;
  error: string | null;
} {
  const { tiers, loading, error } = useTierHighlights();
  
  const tier = tiers.find(t => t.tierKey === tierKey) || null;
  
  return { tier, loading, error };
}
