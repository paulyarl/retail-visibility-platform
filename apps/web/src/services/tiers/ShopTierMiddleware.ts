/**
 * Shop Feature Tiers and Validation Middleware
 */

export interface ShopFeatures {
  basic: ['listing', 'basic_analytics'];
  premium: ['listing', 'analytics', 'branding', 'featured_placement'];
  enterprise: ['listing', 'analytics', 'branding', 'featured_placement', 'api_access'];
}

export type ShopTier = 'basic' | 'premium' | 'enterprise';
export type ShopFeature = 'listing' | 'basic_analytics' | 'analytics' | 'branding' | 'featured_placement' | 'api_access';

export interface ShopTierConfig {
  tier: ShopTier;
  features: ShopFeature[];
  limits: {
    maxProducts: number;
    maxImages: number;
    maxCategories: number;
    apiCallsPerMonth: number;
    storageGB: number;
  };
  pricing: {
    monthly: number;
    yearly: number;
  };
  benefits: string[];
}

export interface ShopTierMiddleware {
  validateShopFeature(shopId: string, feature: ShopFeature): Promise<boolean>;
  getShopTier(shopId: string): Promise<ShopTier>;
  upgradeShopTier(shopId: string, targetTier: ShopTier): Promise<void>;
  checkFeatureLimits(shopId: string, feature: ShopFeature): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    canUpgrade: boolean;
  }>;
}

export interface FeatureValidationResult {
  isValid: boolean;
  tier: ShopTier;
  feature: ShopFeature;
  allowed: boolean;
  reason?: string;
  upgradeOptions?: {
    currentTier: ShopTier;
    requiredTier: ShopTier;
    upgradeUrl: string;
  };
}

export interface ShopFeatureUsage {
  shopId: string;
  feature: ShopFeature;
  usage: {
    current: number;
    limit: number;
    resetDate: string;
  };
  period: 'monthly' | 'yearly';
}

// Tier configurations
export const SHOP_TIER_CONFIGS: Record<ShopTier, ShopTierConfig> = {
  basic: {
    tier: 'basic',
    features: ['listing', 'basic_analytics'],
    limits: {
      maxProducts: 50,
      maxImages: 5,
      maxCategories: 3,
      apiCallsPerMonth: 1000,
      storageGB: 1
    },
    pricing: {
      monthly: 29,
      yearly: 290
    },
    benefits: [
      'Basic shop listing',
      'Simple analytics dashboard',
      'Up to 50 products',
      'Email support'
    ]
  },
  premium: {
    tier: 'premium',
    features: ['listing', 'analytics', 'branding', 'featured_placement'],
    limits: {
      maxProducts: 500,
      maxImages: 20,
      maxCategories: 10,
      apiCallsPerMonth: 10000,
      storageGB: 10
    },
    pricing: {
      monthly: 99,
      yearly: 990
    },
    benefits: [
      'Advanced analytics',
      'Custom branding',
      'Featured placement',
      'Up to 500 products',
      'Priority support'
    ]
  },
  enterprise: {
    tier: 'enterprise',
    features: ['listing', 'analytics', 'branding', 'featured_placement', 'api_access'],
    limits: {
      maxProducts: -1, // Unlimited
      maxImages: -1, // Unlimited
      maxCategories: -1, // Unlimited
      apiCallsPerMonth: 100000,
      storageGB: 100
    },
    pricing: {
      monthly: 299,
      yearly: 2990
    },
    benefits: [
      'Unlimited products',
      'Full API access',
      'Custom integrations',
      'Dedicated support',
      'White-label options'
    ]
  }
};

// Feature hierarchy for upgrades
export const FEATURE_HIERARCHY: Record<ShopFeature, ShopTier> = {
  listing: 'basic',
  basic_analytics: 'basic',
  analytics: 'premium',
  branding: 'premium',
  featured_placement: 'premium',
  api_access: 'enterprise'
};

// Implementation of ShopTierMiddleware
class ShopTierMiddlewareService implements ShopTierMiddleware {
  private static instance: ShopTierMiddlewareService;
  private shopTiers: Map<string, ShopTier> = new Map();
  private featureUsage: Map<string, ShopFeatureUsage[]> = new Map();

  private constructor() {
    this.loadShopTiers();
  }

  static getInstance(): ShopTierMiddlewareService {
    if (!ShopTierMiddlewareService.instance) {
      ShopTierMiddlewareService.instance = new ShopTierMiddlewareService();
    }
    return ShopTierMiddlewareService.instance;
  }

  private loadShopTiers(): void {
    // In a real implementation, this would load from database
    // For now, we'll use mock data
    this.shopTiers.set('shop-1', 'basic');
    this.shopTiers.set('shop-2', 'premium');
    this.shopTiers.set('shop-3', 'enterprise');
  }

  async validateShopFeature(shopId: string, feature: ShopFeature): Promise<boolean> {
    const tier = await this.getShopTier(shopId);
    const tierConfig = SHOP_TIER_CONFIGS[tier];
    
    return tierConfig.features.includes(feature);
  }

  async getShopTier(shopId: string): Promise<ShopTier> {
    return this.shopTiers.get(shopId) || 'basic';
  }

  async upgradeShopTier(shopId: string, targetTier: ShopTier): Promise<void> {
    // In a real implementation, this would:
    // 1. Validate the upgrade request
    // 2. Process payment
    // 3. Update database
    // 4. Send confirmation
    
    this.shopTiers.set(shopId, targetTier);
    
    // Log the upgrade
    console.log(`Shop ${shopId} upgraded to ${targetTier} tier`);
  }

  async checkFeatureLimits(shopId: string, feature: ShopFeature): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    canUpgrade: boolean;
  }> {
    const tier = await this.getShopTier(shopId);
    const tierConfig = SHOP_TIER_CONFIGS[tier];
    
    const hasFeature = tierConfig.features.includes(feature);
    const limit = this.getFeatureLimit(tier, feature);
    const current = await this.getCurrentUsage(shopId, feature);
    
    return {
      allowed: hasFeature && current < limit,
      current,
      limit,
      canUpgrade: tier !== 'enterprise'
    };
  }

  async validateFeatureAccess(shopId: string, feature: ShopFeature): Promise<FeatureValidationResult> {
    const tier = await this.getShopTier(shopId);
    const tierConfig = SHOP_TIER_CONFIGS[tier];
    const hasFeature = tierConfig.features.includes(feature);
    
    if (hasFeature) {
      return {
        isValid: true,
        tier,
        feature,
        allowed: true
      };
    }

    const requiredTier = FEATURE_HIERARCHY[feature];
    const requiredConfig = SHOP_TIER_CONFIGS[requiredTier];
    
    return {
      isValid: false,
      tier,
      feature,
      allowed: false,
      reason: `Feature '${feature}' requires ${requiredTier} tier or higher`,
      upgradeOptions: {
        currentTier: tier,
        requiredTier,
        upgradeUrl: `/shops/${shopId}/upgrade?tier=${requiredTier}`
      }
    };
  }

  private getFeatureLimit(tier: ShopTier, feature: ShopFeature): number {
    const tierConfig = SHOP_TIER_CONFIGS[tier];
    
    switch (feature) {
      case 'listing':
        return tierConfig.limits.maxProducts;
      case 'api_access':
        return tierConfig.limits.apiCallsPerMonth;
      default:
        return 1000; // Default limit
    }
  }

  private async getCurrentUsage(shopId: string, feature: ShopFeature): Promise<number> {
    // In a real implementation, this would query the database
    // For now, return mock usage data
    const usageMap: Record<ShopFeature, number> = {
      listing: 25,
      basic_analytics: 100,
      analytics: 500,
      branding: 5,
      featured_placement: 2,
      api_access: 5000
    };
    
    return usageMap[feature] || 0;
  }

  // Utility methods
  async getAvailableFeatures(shopId: string): Promise<ShopFeature[]> {
    const tier = await this.getShopTier(shopId);
    return SHOP_TIER_CONFIGS[tier].features;
  }

  async getUpgradePath(currentTier: ShopTier, desiredFeature: ShopFeature): Promise<ShopTier[]> {
    const requiredTier = FEATURE_HIERARCHY[desiredFeature];
    const tierOrder: ShopTier[] = ['basic', 'premium', 'enterprise'];
    
    const currentIndex = tierOrder.indexOf(currentTier);
    const requiredIndex = tierOrder.indexOf(requiredTier);
    
    if (currentIndex >= requiredIndex) {
      return []; // No upgrade needed
    }
    
    return tierOrder.slice(currentIndex + 1, requiredIndex + 1);
  }

  async estimateUpgradeCost(shopId: string, targetTier: ShopTier): Promise<{
    monthly: number;
    yearly: number;
    savings: number;
  }> {
    const currentTier = await this.getShopTier(shopId);
    const currentConfig = SHOP_TIER_CONFIGS[currentTier];
    const targetConfig = SHOP_TIER_CONFIGS[targetTier];
    
    const monthlyDiff = targetConfig.pricing.monthly - currentConfig.pricing.monthly;
    const yearlyDiff = targetConfig.pricing.yearly - currentConfig.pricing.yearly;
    const savings = currentConfig.pricing.yearly - targetConfig.pricing.monthly * 12;
    
    return {
      monthly: monthlyDiff,
      yearly: yearlyDiff,
      savings: Math.max(0, savings)
    };
  }
}

// Export singleton instance
export const shopTierMiddleware = ShopTierMiddlewareService.getInstance();

// React hook for tier management
import { useState, useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';

export function useShopTier(shopId: string) {
  const [tier, setTier] = useState<ShopTier>('basic');
  const [features, setFeatures] = useState<ShopFeature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTierData = async () => {
      setLoading(true);
      try {
        const [currentTier, availableFeatures] = await Promise.all([
          shopTierMiddleware.getShopTier(shopId),
          shopTierMiddleware.getAvailableFeatures(shopId)
        ]);
        
        setTier(currentTier);
        setFeatures(availableFeatures);
      } catch (error) {
        clientLogger.error('Error loading tier data:', { detail: error });
      } finally {
        setLoading(false);
      }
    };

    loadTierData();
  }, [shopId]);

  const validateFeature = async (feature: ShopFeature): Promise<FeatureValidationResult> => {
    return await shopTierMiddleware.validateFeatureAccess(shopId, feature);
  };

  const upgradeTier = async (targetTier: ShopTier): Promise<void> => {
    await shopTierMiddleware.upgradeShopTier(shopId, targetTier);
    setTier(targetTier);
    const newFeatures = await shopTierMiddleware.getAvailableFeatures(shopId);
    setFeatures(newFeatures);
  };

  const checkLimits = async (feature: ShopFeature) => {
    return await shopTierMiddleware.checkFeatureLimits(shopId, feature);
  };

  return {
    tier,
    features,
    loading,
    config: SHOP_TIER_CONFIGS[tier],
    validateFeature,
    upgradeTier,
    checkLimits,
    canUpgrade: tier !== 'enterprise'
  };
}
