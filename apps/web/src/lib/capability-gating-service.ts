export interface Feature {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  marketing_name?: string;
  marketing_description?: string;
  icon_name?: string;
}

export interface FeatureWithRestrictions extends Feature {
  base_restrictions?: {
    requires_inventory?: boolean;
    requires_delivery?: boolean;
    requires_custom_attributes?: boolean;
    requires_scheduling?: boolean;
    requires_recurring?: boolean;
    transaction_fee?: number;
    data_retention_days?: number;
    real_time?: boolean;
    max_emails_per_month?: number | null;
    [key: string]: any;
  };
  is_enabled: boolean;
  tier_restrictions?: {
    max_items?: number | null;
    allowed_types?: string[];
    transaction_fee?: number;
    data_retention_days?: number | null;
    real_time?: boolean;
    max_emails_per_month?: number | null;
    [key: string]: any;
  };
  effective_restrictions?: {
    requires_inventory?: boolean;
    requires_delivery?: boolean;
    requires_custom_attributes?: boolean;
    requires_scheduling?: boolean;
    requires_recurring?: boolean;
    max_items?: number | null;
    transaction_fee?: number;
    data_retention_days?: number | null;
    real_time?: boolean;
    max_emails_per_month?: number | null;
    [key: string]: any;
  };
}

class DatabaseCapabilityService {
  static async getProductTypesForTier(tierKey: string): Promise<FeatureWithRestrictions[]> {
    return this.getTierSpecificFeatures(tierKey);
  }

  static async isProductTypeAvailable(tierKey: string, productTypeKey: string): Promise<boolean> {
    const productTypes = await this.getProductTypesForTier(tierKey);
    return productTypes.some(feature => feature.key === productTypeKey && feature.is_enabled);
  }

  private static getTierSpecificRestrictions(tierKey: string): any {
    switch (tierKey) {
      case 'discovery':
        return { max_items: 10, allowed_types: ['physical_product'] };
      case 'starter':
        return { max_items: 50, allowed_types: ['physical_product'] };
      case 'storefront':
        return { max_items: 100, allowed_types: ['physical_product', 'digital_product'] };
      case 'professional':
        return { max_items: 1000, allowed_types: ['physical_product', 'digital_product', 'hybrid_product', 'custom_product'] };
      case 'enterprise':
        return { max_items: null, allowed_types: ['physical_product', 'digital_product', 'hybrid_product', 'custom_product', 'service_product', 'subscription_product'] };
      default:
        return { max_items: 10, allowed_types: ['physical_product'] };
    }
  }

  private static getTierSpecificFeatures(tierKey: string): FeatureWithRestrictions[] {
    const baseFeatures: FeatureWithRestrictions[] = [
      {
        id: 'physical_product_id',
        key: 'physical_product',
        name: 'Physical Product',
        description: 'Create tangible goods with inventory management',
        category: 'product_types',
        is_active: true,
        sort_order: 1,
        marketing_name: 'Physical Products',
        marketing_description: 'Sell physical items with inventory tracking',
        icon_name: 'package',
        base_restrictions: { requires_inventory: true },
        is_enabled: true,
        tier_restrictions: this.getTierSpecificRestrictions(tierKey),
        effective_restrictions: {
          requires_inventory: true,
          max_items: this.getTierSpecificRestrictions(tierKey).max_items
        }
      },
      {
        id: 'digital_product_id',
        key: 'digital_product',
        name: 'Digital Product',
        description: 'Create downloadable products and digital content',
        category: 'product_types',
        is_active: true,
        sort_order: 2,
        marketing_name: 'Digital Products',
        marketing_description: 'Sell digital downloads and online content',
        icon_name: 'download',
        base_restrictions: { requires_delivery: true },
        is_enabled: ['storefront', 'professional', 'enterprise'].includes(tierKey),
        tier_restrictions: ['storefront', 'professional', 'enterprise'].includes(tierKey) ?
          this.getTierSpecificRestrictions(tierKey) : undefined,
        effective_restrictions: ['storefront', 'professional', 'enterprise'].includes(tierKey) ?
          { requires_delivery: true, max_items: this.getTierSpecificRestrictions(tierKey).max_items } :
          undefined
      },
      {
        id: 'hybrid_product_id',
        key: 'hybrid_product',
        name: 'Hybrid Product',
        description: 'Create products with both physical and digital components',
        category: 'product_types',
        is_active: true,
        sort_order: 3,
        marketing_name: 'Hybrid Products',
        marketing_description: 'Products that combine physical items with digital content',
        icon_name: 'layers',
        base_restrictions: { requires_inventory: true, requires_delivery: true },
        is_enabled: ['professional', 'enterprise'].includes(tierKey),
        tier_restrictions: ['professional', 'enterprise'].includes(tierKey) ?
          this.getTierSpecificRestrictions(tierKey) : undefined,
        effective_restrictions: ['professional', 'enterprise'].includes(tierKey) ?
          { requires_inventory: true, requires_delivery: true, max_items: this.getTierSpecificRestrictions(tierKey).max_items } :
          undefined
      },
      {
        id: 'custom_product_id',
        key: 'custom_product',
        name: 'Custom Product',
        description: 'Create products with custom attributes and configurations',
        category: 'product_types',
        is_active: true,
        sort_order: 4,
        marketing_name: 'Custom Products',
        marketing_description: 'Products with customizable options and variants',
        icon_name: 'settings',
        base_restrictions: { requires_custom_attributes: true },
        is_enabled: ['professional', 'enterprise'].includes(tierKey),
        tier_restrictions: ['professional', 'enterprise'].includes(tierKey) ?
          this.getTierSpecificRestrictions(tierKey) : undefined,
        effective_restrictions: ['professional', 'enterprise'].includes(tierKey) ?
          { requires_custom_attributes: true, max_items: this.getTierSpecificRestrictions(tierKey).max_items } :
          undefined
      }
    ];

    if (tierKey === 'enterprise') {
      baseFeatures.push(
        {
          id: 'service_product_id',
          key: 'service_product',
          name: 'Service Product',
          description: 'Create service-based offerings and appointments',
          category: 'product_types',
          is_active: true,
          sort_order: 5,
          marketing_name: 'Service Products',
          marketing_description: 'Bookable services and appointments',
          icon_name: 'calendar',
          base_restrictions: { requires_scheduling: true },
          is_enabled: true,
          tier_restrictions: this.getTierSpecificRestrictions(tierKey),
          effective_restrictions: { requires_scheduling: true, max_items: null }
        },
        {
          id: 'subscription_product_id',
          key: 'subscription_product',
          name: 'Subscription Product',
          description: 'Create recurring subscription products',
          category: 'product_types',
          is_active: true,
          sort_order: 6,
          marketing_name: 'Subscription Products',
          marketing_description: 'Recurring billing and membership products',
          icon_name: 'repeat',
          base_restrictions: { requires_recurring: true },
          is_enabled: true,
          tier_restrictions: this.getTierSpecificRestrictions(tierKey),
          effective_restrictions: { requires_recurring: true, max_items: null }
        }
      );
    }

    return baseFeatures;
  }
}

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

export class CapabilityGatingService {

  static async checkProductTypeCapability(tierKey: string): Promise<ProductTypeCapabilityResult> {
    try {
      const productTypes = await DatabaseCapabilityService.getProductTypesForTier(tierKey);

      const availableProductTypes = productTypes
        .filter(pt => pt.is_enabled)
        .map(pt => pt.key);

      const allProductTypes = productTypes.map(pt => pt.key);

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
    } catch {
      return {
        isAvailable: false,
        productTypes: [],
        availableProductTypes: [],
        reason: 'Failed to check product type capability'
      };
    }
  }

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
    } catch {
      return {
        isAvailable: false,
        reason: 'Failed to check product type availability'
      };
    }
  }

  static async checkPaymentMethodCapability(tierKey: string): Promise<PaymentMethodCapabilityResult> {
    try {
      const paymentFeatures = await this.getPaymentFeaturesForTier(tierKey);

      const availablePaymentMethods = paymentFeatures
        .filter(pm => pm.is_enabled)
        .map(pm => pm.key);

      const allPaymentMethods = paymentFeatures.map(pm => pm.key);

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
    } catch {
      return {
        isAvailable: false,
        paymentMethods: [],
        availablePaymentMethods: [],
        reason: 'Failed to check payment method capability'
      };
    }
  }

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
    } catch {
      return {
        isAvailable: false,
        reason: 'Failed to check payment method availability'
      };
    }
  }

  static async checkMarketingCapability(tierKey: string): Promise<MarketingCapabilityResult> {
    try {
      const marketingFeatures = await this.getMarketingFeaturesForTier(tierKey);

      const availableFeatures = marketingFeatures
        .filter(mf => mf.is_enabled)
        .map(mf => mf.key);

      const allFeatures = marketingFeatures.map(mf => mf.key);

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
    } catch {
      return {
        isAvailable: false,
        features: [],
        availableFeatures: [],
        reason: 'Failed to check marketing capability'
      };
    }
  }

  static async checkAnalyticsCapability(tierKey: string): Promise<AnalyticsCapabilityResult> {
    try {
      const analyticsFeatures = await this.getAnalyticsFeaturesForTier(tierKey);

      const availableFeatures = analyticsFeatures
        .filter(af => af.is_enabled)
        .map(af => af.key);

      const allFeatures = analyticsFeatures.map(af => af.key);

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
    } catch {
      return {
        isAvailable: false,
        features: [],
        availableFeatures: [],
        reason: 'Failed to check analytics capability'
      };
    }
  }

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

  private static async getPaymentFeaturesForTier(tierKey: string): Promise<FeatureWithRestrictions[]> {
    const basePaymentFeatures: FeatureWithRestrictions[] = [
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
    const baseMarketingFeatures: FeatureWithRestrictions[] = [
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
    const baseAnalyticsFeatures: FeatureWithRestrictions[] = [
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
