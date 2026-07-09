/**
 * Tier Feature Service
 *
 * Fetches tier-feature configuration from the database via /api/tier-config.
 * Extends TenantApiSingleton for tenant-scoped, authenticated requests.
 * Provides the same function signatures as tier-features.ts but DB-driven.
 *
 * Falls back to hardcoded tier-features.ts data when DB is unavailable.
 */

import TenantApiSingleton from '@/providers/base/TenantApiSingleton';
import {
  TIER_FEATURES,
  TIER_HIERARCHY,
  FEATURE_TIER_MAP,
  TIER_DISPLAY_NAMES,
  FEATURE_DISPLAY_NAMES,
  TIER_PRICING,
  TIER_FEATURE_LIMITS,
  checkTierFeature as checkTierFeatureFallback,
  getRequiredTier as getRequiredTierFallback,
  getTierDisplayName as getTierDisplayNameFallback,
  getTierPricing as getTierPricingFallback,
  getTierFeatures as getTierFeaturesFallback,
  getFeatureLimits as getFeatureLimitsFallback,
  calculateUpgradeRequirements as calculateUpgradeRequirementsFallback,
} from '@/lib/tiers/tier-features';

// ---- Types ----

export interface TierConfigTier {
  tierKey: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  maxSkus: number | null;
  maxLocations: number | null;
  tierType: string;
  sortOrder: number;
  features: string[];
}

export interface TierConfigFeature {
  featureKey: string;
  featureName: string;
  displayName: string;
  description: string;
  category: string;
  iconName: string | null;
  sortOrder: number;
}

export interface TierConfigData {
  tiers: TierConfigTier[];
  features: TierConfigFeature[];
  hierarchy: Record<string, string[]>;
  featureTierMap: Record<string, string>;
  limits: Record<string, Record<string, any>>;
}

// ---- Service ----

class TierFeatureService extends TenantApiSingleton {
  private config: TierConfigData | null = null;
  private loading = false;
  private loadPromise: Promise<TierConfigData> | null = null;

  constructor() {
    super('tier-feature-service', { ttl: 15 * 60 * 1000 }); // 15 min cache
  }

  getServiceCachePatterns(): string[] {
    return ['tier-config'];
  }

  async invalidateServiceCaches(): Promise<void> {
    this.config = null;
    await this.invalidateCachePattern('tier-config');
  }

  /** Load config from API, cache in memory */
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
        '/api/tier-config',
        {},
        'tier-config',
        this.cacheTTL,
      );
      if (result.success && result.data) {
        this.config = result.data;
        return this.config;
      }
    } catch (error) {
      console.warn('[TierFeatureService] Failed to load config from API, using fallback:', error);
    }

    // Build fallback from hardcoded data
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
      tierType: key.startsWith('chain_') ? 'chain' : key === 'organization' ? 'organization' : 'individual',
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

  /** Check if a tier has access to a feature (including inheritance) */
  async checkTierFeature(tier: string, feature: string): Promise<boolean> {
    const config = await this.loadConfig();

    // Direct check
    const tierData = config.tiers.find(t => t.tierKey === tier);
    if (tierData?.features.includes(feature)) return true;

    // Inheritance check
    const inherited = config.hierarchy[tier] || [];
    for (const parentTier of inherited) {
      const parentData = config.tiers.find(t => t.tierKey === parentTier);
      if (parentData?.features.includes(feature)) return true;
    }

    return false;
  }

  /** Get the minimum required tier for a feature */
  async getRequiredTier(feature: string): Promise<string> {
    const config = await this.loadConfig();
    return config.featureTierMap[feature] || 'professional';
  }

  /** Get tier display name */
  async getTierDisplayName(tier: string): Promise<string> {
    const config = await this.loadConfig();
    const tierData = config.tiers.find(t => t.tierKey === tier);
    return tierData?.displayName || tier;
  }

  /** Get tier pricing */
  async getTierPricing(tier: string): Promise<number> {
    const config = await this.loadConfig();
    const tierData = config.tiers.find(t => t.tierKey === tier);
    return tierData?.priceMonthly || 0;
  }

  /** Get all features for a tier (including inherited) */
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

  /** Get feature display name */
  async getFeatureDisplayName(featureKey: string): Promise<string> {
    const config = await this.loadConfig();
    const feat = config.features.find(f => f.featureKey === featureKey);
    return feat?.displayName || feat?.featureName || featureKey;
  }

  /** Get feature limits for a tier+feature */
  async getFeatureLimits(tier: string, feature: string): Promise<any | null> {
    const config = await this.loadConfig();
    const tierLimits = config.limits[tier];
    if (!tierLimits) return null;
    return tierLimits[feature] || null;
  }

  /** Calculate upgrade requirements */
  async calculateUpgradeRequirements(currentTier: string, feature: string): Promise<{
    required: boolean;
    targetTier?: string;
    targetTierDisplay?: string;
    targetPrice?: number;
    currentPrice?: number;
    upgradeCost?: number;
  }> {
    const hasAccess = await this.checkTierFeature(currentTier, feature);
    if (hasAccess) return { required: false };

    const targetTier = await this.getRequiredTier(feature);
    const targetTierDisplay = await this.getTierDisplayName(targetTier);
    const targetPrice = await this.getTierPricing(targetTier);
    const currentPrice = await this.getTierPricing(currentTier);
    const upgradeCost = targetPrice - currentPrice;

    return { required: true, targetTier, targetTierDisplay, targetPrice, currentPrice, upgradeCost };
  }

  /** Get the full config (for hooks that need all data at once) */
  async getConfig(): Promise<TierConfigData> {
    return this.loadConfig();
  }

  /** Check if config is loaded */
  isLoaded(): boolean {
    return this.config !== null;
  }

  /** Check if currently loading */
  isLoading(): boolean {
    return this.loading;
  }
}

// Singleton export
export const tierFeatureService = new TierFeatureService();
export default tierFeatureService;
