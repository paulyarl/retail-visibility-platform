/**
 * Unified Capability Gating Service
 * 
 * Shared between API and WEB for consistent capability checking
 * Each capability type has its own method for proper gating
 * 
 * Part of the existing feature-definitions package architecture
 */

import { DatabaseCapabilityService, FeatureWithRestrictions } from './DatabaseCapabilityService';

export interface CapabilityCheckResult {
  isAvailable: boolean;
  restrictions?: any;
  effectiveRestrictions?: any;
  marketingName?: string;
  reason?: string;
}

export interface ProductTypeCapabilityResult extends CapabilityCheckResult {
  productTypes: string[];
  availableProductTypes: string[];
  maxItems?: number | null;
}

export interface PaymentMethodCapabilityResult extends CapabilityCheckResult {
  paymentMethods: string[];
  availablePaymentMethods: string[];
  transactionFee?: number | null;
}

export interface MarketingCapabilityResult extends CapabilityCheckResult {
  features: string[];
  availableFeatures: string[];
  maxEmailsPerMonth?: number | null;
  maxCampaigns?: number | null;
}

export interface AnalyticsCapabilityResult extends CapabilityCheckResult {
  features: string[];
  availableFeatures: string[];
  dataRetentionDays?: number | null;
  realTime?: boolean;
}

/**
 * Unified Capability Gating Service
 * Shared between API and WEB for consistent capability checking
 */
export class CapabilityGatingService {
  
  /**
   * PRODUCT TYPES CAPABILITY
   * Check product type capabilities for a tier
   */
  static async checkProductTypeCapability(tierKey: string): Promise<ProductTypeCapabilityResult> {
    try {
      const productTypes = await DatabaseCapabilityService.getProductTypesForTier(tierKey);
      
      const availableProductTypes = productTypes
        .filter(pt => pt.is_enabled)
        .map(pt => pt.key);
      
      const allProductTypes = productTypes.map(pt => pt.key);
      
      // Get the most restrictive max_items from enabled features
      const maxItems = productTypes
        .filter((pt: FeatureWithRestrictions) => pt.is_enabled)
        .reduce((min: number, pt: FeatureWithRestrictions) => {
          const items = pt.effective_restrictions?.max_items;
          return items !== null && items !== undefined ? Math.min(min, items) : min;
        }, Infinity);
      
      return {
        isAvailable: availableProductTypes.length > 0,
        productTypes: allProductTypes,
        availableProductTypes,
        maxItems: maxItems === Infinity ? null : maxItems,
        marketingName: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Product Types`,
        restrictions: productTypes[0]?.tier_restrictions,
        effectiveRestrictions: productTypes[0]?.effective_restrictions
      };
    } catch (error) {
      return {
        isAvailable: false,
        productTypes: [],
        availableProductTypes: [],
        reason: 'Failed to check product type capability'
      };
    }
  }

  /**
   * Check if specific product type is available
   */
  static async isProductTypeAvailable(tierKey: string, productTypeKey: string): Promise<CapabilityCheckResult> {
    try {
      const productTypes = await DatabaseCapabilityService.getProductTypesForTier(tierKey);
      const productType = productTypes.find(pt => pt.key === productTypeKey);
      
      if (!productType) {
        return {
          isAvailable: false,
          reason: `Product type ${productTypeKey} not found`
        };
      }
      
      return {
        isAvailable: productType.is_enabled,
        restrictions: productType.tier_restrictions,
        effectiveRestrictions: productType.effective_restrictions,
        marketingName: productType.marketing_name
      };
    } catch (error) {
      return {
        isAvailable: false,
        reason: 'Failed to check product type availability'
      };
    }
  }

  /**
   * PAYMENT METHODS CAPABILITY
   * Check payment method capabilities for a tier
   */
  static async checkPaymentMethodCapability(tierKey: string): Promise<PaymentMethodCapabilityResult> {
    try {
      // Mock implementation - would query payment_methods capability type
      const paymentFeatures = await this.getPaymentFeaturesForTier(tierKey);
      
      const availablePaymentMethods = paymentFeatures
        .filter(pm => pm.is_enabled)
        .map(pm => pm.key);
      
      const allPaymentMethods = paymentFeatures.map(pm => pm.key);
      
      // Get transaction fee from enabled features
      const transactionFee = paymentFeatures
        .filter(pm => pm.is_enabled)
        .reduce((max, pm) => {
          const fee = pm.effective_restrictions?.transaction_fee;
          return fee !== undefined ? Math.max(max, fee) : max;
        }, 0);
      
      return {
        isAvailable: availablePaymentMethods.length > 0,
        paymentMethods: allPaymentMethods,
        availablePaymentMethods,
        transactionFee: transactionFee || 0,
        marketingName: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Payment Methods`
      };
    } catch (error) {
      return {
        isAvailable: false,
        paymentMethods: [],
        availablePaymentMethods: [],
        reason: 'Failed to check payment method capability'
      };
    }
  }

  /**
   * Check if specific payment method is available
   */
  static async isPaymentMethodAvailable(tierKey: string, paymentMethodKey: string): Promise<CapabilityCheckResult> {
    try {
      const paymentFeatures = await this.getPaymentFeaturesForTier(tierKey);
      const paymentMethod = paymentFeatures.find(pm => pm.key === paymentMethodKey);
      
      if (!paymentMethod) {
        return {
          isAvailable: false,
          reason: `Payment method ${paymentMethodKey} not found`
        };
      }
      
      return {
        isAvailable: paymentMethod.is_enabled,
        restrictions: paymentMethod.tier_restrictions,
        effectiveRestrictions: paymentMethod.effective_restrictions,
        marketingName: paymentMethod.marketing_name
      };
    } catch (error) {
      return {
        isAvailable: false,
        reason: 'Failed to check payment method availability'
      };
    }
  }

  /**
   * MARKETING CAPABILITY
   * Check marketing capabilities for a tier
   */
  static async checkMarketingCapability(tierKey: string): Promise<MarketingCapabilityResult> {
    try {
      // Mock implementation - would query marketing_tools capability type
      const marketingFeatures = await this.getMarketingFeaturesForTier(tierKey);
      
      const availableFeatures = marketingFeatures
        .filter(mf => mf.is_enabled)
        .map(mf => mf.key);
      
      const allFeatures = marketingFeatures.map(mf => mf.key);
      
      // Get marketing limits
      const maxEmailsPerMonth = marketingFeatures
        .find(mf => mf.key === 'email_campaigns')?.effective_restrictions?.max_emails_per_month;
      
      const maxCampaigns = marketingFeatures
        .find(mf => mf.key === 'discount_codes')?.effective_restrictions?.max_active_coupons;
      
      return {
        isAvailable: availableFeatures.length > 0,
        features: allFeatures,
        availableFeatures,
        maxEmailsPerMonth,
        maxCampaigns,
        marketingName: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Marketing Tools`
      };
    } catch (error) {
      return {
        isAvailable: false,
        features: [],
        availableFeatures: [],
        reason: 'Failed to check marketing capability'
      };
    }
  }

  /**
   * ANALYTICS CAPABILITY
   * Check analytics capabilities for a tier
   */
  static async checkAnalyticsCapability(tierKey: string): Promise<AnalyticsCapabilityResult> {
    try {
      // Mock implementation - would query analytics capability type
      const analyticsFeatures = await this.getAnalyticsFeaturesForTier(tierKey);
      
      const availableFeatures = analyticsFeatures
        .filter(af => af.is_enabled)
        .map(af => af.key);
      
      const allFeatures = analyticsFeatures.map(af => af.key);
      
      // Get analytics settings
      const dataRetentionDays = analyticsFeatures
        .find(af => af.key === 'advanced_analytics')?.effective_restrictions?.data_retention_days;
      
      const realTime = analyticsFeatures
        .some(af => af.effective_restrictions?.real_time === true);
      
      return {
        isAvailable: availableFeatures.length > 0,
        features: allFeatures,
        availableFeatures,
        dataRetentionDays,
        realTime,
        marketingName: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Analytics`
      };
    } catch (error) {
      return {
        isAvailable: false,
        features: [],
        availableFeatures: [],
        reason: 'Failed to check analytics capability'
      };
    }
  }

  /**
   * COMPREHENSIVE CAPABILITY CHECK
   * Check all capabilities for a tier
   */
  static async checkAllCapabilities(tierKey: string): Promise<{
    productTypes: ProductTypeCapabilityResult;
    paymentMethods: PaymentMethodCapabilityResult;
    marketing: MarketingCapabilityResult;
    analytics: AnalyticsCapabilityResult;
  }> {
    const [productTypes, paymentMethods, marketing, analytics] = await Promise.all([
      this.checkProductTypeCapability(tierKey),
      this.checkPaymentMethodCapability(tierKey),
      this.checkMarketingCapability(tierKey),
      this.checkAnalyticsCapability(tierKey)
    ]);

    return {
      productTypes,
      paymentMethods,
      marketing,
      analytics
    };
  }

  /**
   * GATEKEEPING METHOD
   * Central method for gating access to features
   */
  static async gateFeatureAccess(
    tierKey: string,
    capabilityType: 'product_types' | 'payment_methods' | 'marketing' | 'analytics',
    featureKey?: string
  ): Promise<CapabilityCheckResult> {
    switch (capabilityType) {
      case 'product_types':
        if (featureKey) {
          return this.isProductTypeAvailable(tierKey, featureKey);
        }
        return this.checkProductTypeCapability(tierKey);
      
      case 'payment_methods':
        if (featureKey) {
          return this.isPaymentMethodAvailable(tierKey, featureKey);
        }
        return this.checkPaymentMethodCapability(tierKey);
      
      case 'marketing':
        return this.checkMarketingCapability(tierKey);
      
      case 'analytics':
        return this.checkAnalyticsCapability(tierKey);
      
      default:
        return {
          isAvailable: false,
          reason: `Unknown capability type: ${capabilityType}`
        };
    }
  }

  // Helper methods (mock implementations - would use actual database queries)
  private static async getPaymentFeaturesForTier(tierKey: string): Promise<FeatureWithRestrictions[]> {
    // Mock implementation - would query payment_methods capability type
    const basePaymentFeatures = [
      {
        id: 'credit_card_id',
        key: 'credit_card',
        name: 'Credit Card',
        description: 'Accept credit and debit card payments',
        category: 'payment_methods',
        is_active: true,
        sort_order: 1,
        marketing_name: 'Credit Cards',
        icon_name: 'credit-card',
        base_restrictions: { transaction_fee: 2.9 },
        is_enabled: true,
        tier_restrictions: { transaction_fee: tierKey === 'enterprise' ? 2.2 : tierKey === 'professional' ? 2.5 : 2.9 },
        effective_restrictions: { transaction_fee: tierKey === 'enterprise' ? 2.2 : tierKey === 'professional' ? 2.5 : 2.9 }
      },
      {
        id: 'paypal_id',
        key: 'paypal',
        name: 'PayPal',
        description: 'Accept PayPal payments',
        category: 'payment_methods',
        is_active: true,
        sort_order: 2,
        marketing_name: 'PayPal',
        icon_name: 'dollar-sign',
        base_restrictions: { transaction_fee: 2.9 },
        is_enabled: ['storefront', 'professional', 'enterprise'].includes(tierKey),
        tier_restrictions: ['storefront', 'professional', 'enterprise'].includes(tierKey) ? 
          { transaction_fee: 2.9 } : undefined,
        effective_restrictions: ['storefront', 'professional', 'enterprise'].includes(tierKey) ? 
          { transaction_fee: 2.9 } : undefined
      }
    ];

    return basePaymentFeatures;
  }

  private static async getMarketingFeaturesForTier(tierKey: string): Promise<FeatureWithRestrictions[]> {
    // Mock implementation - would query marketing_tools capability type
    const baseMarketingFeatures = [
      {
        id: 'email_campaigns_id',
        key: 'email_campaigns',
        name: 'Email Campaigns',
        description: 'Create and send email marketing campaigns',
        category: 'marketing_tools',
        is_active: true,
        sort_order: 1,
        marketing_name: 'Email Campaigns',
        icon_name: 'mail',
        base_restrictions: { max_emails_per_month: 1000 },
        is_enabled: ['professional', 'enterprise'].includes(tierKey),
        tier_restrictions: ['professional', 'enterprise'].includes(tierKey) ? 
          { max_emails_per_month: tierKey === 'enterprise' ? null : 5000 } : undefined,
        effective_restrictions: ['professional', 'enterprise'].includes(tierKey) ? 
          { max_emails_per_month: tierKey === 'enterprise' ? null : 5000 } : undefined
      }
    ];

    return baseMarketingFeatures;
  }

  private static async getAnalyticsFeaturesForTier(tierKey: string): Promise<FeatureWithRestrictions[]> {
    // Mock implementation - would query analytics capability type
    const baseAnalyticsFeatures = [
      {
        id: 'basic_analytics_id',
        key: 'basic_analytics',
        name: 'Basic Analytics',
        description: 'View basic sales and traffic reports',
        category: 'analytics',
        is_active: true,
        sort_order: 1,
        marketing_name: 'Basic Analytics',
        icon_name: 'bar-chart',
        base_restrictions: { data_retention_days: 30 },
        is_enabled: true,
        tier_restrictions: { data_retention_days: 30 },
        effective_restrictions: { data_retention_days: 30 }
      },
      {
        id: 'advanced_analytics_id',
        key: 'advanced_analytics',
        name: 'Advanced Analytics',
        description: 'Advanced reporting with custom metrics',
        category: 'analytics',
        is_active: true,
        sort_order: 2,
        marketing_name: 'Advanced Analytics',
        icon_name: 'trending-up',
        base_restrictions: { data_retention_days: 365 },
        is_enabled: ['professional', 'enterprise'].includes(tierKey),
        tier_restrictions: ['professional', 'enterprise'].includes(tierKey) ? 
          { data_retention_days: tierKey === 'enterprise' ? null : 365, real_time: tierKey === 'enterprise' } : undefined,
        effective_restrictions: ['professional', 'enterprise'].includes(tierKey) ? 
          { data_retention_days: tierKey === 'enterprise' ? null : 365, real_time: tierKey === 'enterprise' } : undefined
      }
    ];

    return baseAnalyticsFeatures;
  }
}
