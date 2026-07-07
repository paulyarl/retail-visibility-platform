/**
 * useTierConfig Hook
 *
 * React hook that wraps TierFeatureService to provide DB-driven tier-feature
 * configuration with synchronous access (loads once, then cached).
 *
 * Drop-in replacement for direct imports from tier-features.ts.
 * Falls back to hardcoded data while loading or on error.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { tierFeatureService, TierConfigData } from '@/services/TierFeatureService';
import { publicTierFeatureService } from '@/services/PublicTierFeatureService';
import {
  checkTierFeature as checkTierFeatureFallback,
  getRequiredTier as getRequiredTierFallback,
  getTierDisplayName as getTierDisplayNameFallback,
  getTierPricing as getTierPricingFallback,
  getTierFeatures as getTierFeaturesFallback,
  getFeatureLimits as getFeatureLimitsFallback,
  calculateUpgradeRequirements as calculateUpgradeRequirementsFallback,
  FEATURE_DISPLAY_NAMES,
  TIER_DISPLAY_NAMES,
} from '@/lib/tiers/tier-features';

export interface TierConfigResult {
  /** Whether config is loading from API */
  loading: boolean;

  /** Error if config load failed */
  error: string | null;

  /** The raw config data (null until loaded) */
  config: TierConfigData | null;

  /** Check if a tier has access to a feature (sync, uses cached data) */
  checkTierFeature: (tier: string, feature: string) => boolean;

  /** Get minimum required tier for a feature (sync) */
  getRequiredTier: (feature: string) => string;

  /** Get tier display name (sync) */
  getTierDisplayName: (tier: string) => string;

  /** Get tier pricing (sync) */
  getTierPricing: (tier: string) => number;

  /** Get all features for a tier including inherited (sync) */
  getTierFeatures: (tier: string) => string[];

  /** Get feature display name (sync) */
  getFeatureDisplayName: (featureKey: string) => string;

  /** Get feature limits for a tier+feature (sync) */
  getFeatureLimits: (tier: string, feature: string) => any | null;

  /** Calculate upgrade requirements (sync) */
  calculateUpgradeRequirements: (currentTier: string, feature: string) => {
    required: boolean;
    targetTier?: string;
    targetTierDisplay?: string;
    targetPrice?: number;
    currentPrice?: number;
    upgradeCost?: number;
  };

  /** Force reload config from API */
  refresh: () => Promise<void>;
}

export function useTierConfig(options?: { enabled?: boolean; publicMode?: boolean }): TierConfigResult {
  const enabled = options?.enabled !== false;
  const publicMode = options?.publicMode === true;
  const service = publicMode ? publicTierFeatureService : tierFeatureService;
  const [config, setConfig] = useState<TierConfigData | null>(
    service.isLoaded() ? null : null
  );
  const [loading, setLoading] = useState(!service.isLoaded());
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await service.getConfig();
      setConfig(data);
      setError(null);
    } catch (err) {
      console.warn('[useTierConfig] Failed to load, using fallback:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tier config');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (!enabled) return;
    loadConfig();
  }, [loadConfig, enabled]);

  const refresh = useCallback(async () => {
    await service.invalidateServiceCaches();
    await loadConfig();
  }, [loadConfig, service]);

  // Sync functions that use cached config or fall back to hardcoded
  return useMemo(() => {
    const c = config;

    const checkTierFeature = (tier: string, feature: string): boolean => {
      if (!c) return checkTierFeatureFallback(tier, feature);
      const tierData = c.tiers.find(t => t.tierKey === tier);
      if (tierData?.features.includes(feature)) return true;
      const inherited = c.hierarchy[tier] || [];
      for (const parent of inherited) {
        const parentData = c.tiers.find(t => t.tierKey === parent);
        if (parentData?.features.includes(feature)) return true;
      }
      return false;
    };

    const getRequiredTier = (feature: string): string => {
      if (!c) return getRequiredTierFallback(feature);
      return c.featureTierMap[feature] || 'professional';
    };

    const getTierDisplayName = (tier: string): string => {
      if (!c) return getTierDisplayNameFallback(tier);
      return c.tiers.find(t => t.tierKey === tier)?.displayName || tier;
    };

    const getTierPricing = (tier: string): number => {
      if (!c) return getTierPricingFallback(tier);
      return c.tiers.find(t => t.tierKey === tier)?.priceMonthly || 0;
    };

    const getTierFeatures = (tier: string): string[] => {
      if (!c) return getTierFeaturesFallback(tier);
      const features = new Set<string>();
      const tierData = c.tiers.find(t => t.tierKey === tier);
      if (tierData) tierData.features.forEach(f => features.add(f));
      const inherited = c.hierarchy[tier] || [];
      for (const parent of inherited) {
        const parentData = c.tiers.find(t => t.tierKey === parent);
        if (parentData) parentData.features.forEach(f => features.add(f));
      }
      return Array.from(features);
    };

    const getFeatureDisplayName = (featureKey: string): string => {
      if (!c) return FEATURE_DISPLAY_NAMES[featureKey] || featureKey;
      return c.features.find(f => f.featureKey === featureKey)?.displayName || featureKey;
    };

    const getFeatureLimits = (tier: string, feature: string): any | null => {
      if (!c) return getFeatureLimitsFallback(tier, feature);
      return c.limits[tier]?.[feature] || null;
    };

    const calculateUpgradeRequirements = (currentTier: string, feature: string) => {
      const hasAccess = checkTierFeature(currentTier, feature);
      if (hasAccess) return { required: false };

      const targetTier = getRequiredTier(feature);
      const targetTierDisplay = getTierDisplayName(targetTier);
      const targetPrice = getTierPricing(targetTier);
      const currentPrice = getTierPricing(currentTier);

      return {
        required: true,
        targetTier,
        targetTierDisplay,
        targetPrice,
        currentPrice,
        upgradeCost: targetPrice - currentPrice,
      };
    };

    return {
      loading,
      error,
      config,
      checkTierFeature,
      getRequiredTier,
      getTierDisplayName,
      getTierPricing,
      getTierFeatures,
      getFeatureDisplayName,
      getFeatureLimits,
      calculateUpgradeRequirements,
      refresh,
    };
  }, [config, loading, error]);
}

export default useTierConfig;
