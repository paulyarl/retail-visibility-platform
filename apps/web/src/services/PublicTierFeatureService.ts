/**
 * Public Tier Feature Service
 *
 * Fetches tier-feature configuration from /api/public/tier-config (no auth).
 * Used by public pages like /features that don't have an authenticated session.
 * Falls back to hardcoded tier-features.ts data when API is unavailable.
 */

import PublicApiSingleton from '@/providers/base/PublicApiSingleton';
import {
  TIER_FEATURES,
  TIER_HIERARCHY,
  FEATURE_TIER_MAP,
  TIER_DISPLAY_NAMES,
  FEATURE_DISPLAY_NAMES,
  TIER_PRICING,
  TIER_FEATURE_LIMITS,
} from '@/lib/tiers/tier-features';
import type { TierConfigData, TierConfigTier, TierConfigFeature } from './TierFeatureService';

class PublicTierFeatureService extends PublicApiSingleton {
  private config: TierConfigData | null = null;
  private loading = false;
  private loadPromise: Promise<TierConfigData> | null = null;

  constructor() {
    super('public-tier-feature-service', { ttl: 15 * 60 * 1000 });
  }

  getServiceCachePatterns(): string[] {
    return ['public-tier-config'];
  }

  async invalidateServiceCaches(): Promise<void> {
    this.config = null;
    await this.invalidateCachePattern('public-tier-config');
  }

  async loadConfig(): Promise<TierConfigData> {
    if (this.config) return this.config;
    if (this.loadPromise) return this.loadPromise;

    this.loading = true;
    this.loadPromise = this._fetchConfig().finally(() => {
      this.loading = false;
      this.loadPromise = null;
    });

    return this.loadPromise;
  }

  private async _fetchConfig(): Promise<TierConfigData> {
    try {
      const result = await this.makeDefaultRequest<TierConfigData>(
        '/api/public/tier-config',
        {},
        'public-tier-config',
        this.cacheTTL,
      );
      if (result.success && result.data) {
        this.config = result.data;
        return this.config;
      }
    } catch (error) {
      console.warn('[PublicTierFeatureService] Failed to load config from API, using fallback:', error);
    }

    return this._buildFallback();
  }

  private _buildFallback(): TierConfigData {
    const tiers: TierConfigTier[] = Object.entries(TIER_FEATURES).map(([key, features]) => ({
      tierKey: key,
      name: TIER_DISPLAY_NAMES[key] || key,
      displayName: TIER_DISPLAY_NAMES[key] || key,
      description: '',
      priceMonthly: TIER_PRICING[key] || 0,
      maxSkus: null,
      maxLocations: null,
      tierType: key.startsWith('chain_') ? 'chain' : 'individual',
      sortOrder: 0,
      features: [...(features as readonly string[])],
    }));

    const features: TierConfigFeature[] = Object.entries(FEATURE_DISPLAY_NAMES).map(([key, name]) => ({
      featureKey: key,
      featureName: name,
      displayName: name,
      description: '',
      category: '',
      iconName: null,
      sortOrder: 0,
    }));

    return {
      tiers,
      features,
      hierarchy: { ...TIER_HIERARCHY },
      featureTierMap: { ...FEATURE_TIER_MAP },
      limits: { ...TIER_FEATURE_LIMITS },
    };
  }

  async getTierFeatures(tier: string): Promise<string[]> {
    const config = await this.loadConfig();
    const features = new Set<string>();
    const tierData = config.tiers.find(t => t.tierKey === tier);
    if (tierData) tierData.features.forEach(f => features.add(f));
    const inherited = config.hierarchy[tier] || [];
    for (const parentTier of inherited) {
      const parentData = config.tiers.find(t => t.tierKey === parentTier);
      if (parentData) parentData.features.forEach(f => features.add(f));
    }
    return Array.from(features);
  }

  async getConfig(): Promise<TierConfigData> {
    return this.loadConfig();
  }

  isLoaded(): boolean {
    return this.config !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }
}

export const publicTierFeatureService = new PublicTierFeatureService();
export default publicTierFeatureService;
