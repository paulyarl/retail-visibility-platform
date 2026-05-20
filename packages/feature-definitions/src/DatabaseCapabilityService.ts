/**
 * Database Capability Service
 * 
 * Moved to feature-definitions package to avoid circular dependencies
 * Provides database-driven capability checking for tier-specific architecture
 */

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

export interface TierCapabilities {
  tier_id: string;
  tier_key: string;
  name: string;
  display_name: string;
  description?: string;
  price_monthly: number;
  max_skus?: number;
  max_locations?: number;
  tier_type: string;
  is_active: boolean;
  sort_order: number;
  capabilities: any[];
}

/**
 * Service for fetching capabilities from tier-specific capability architecture
 */
export class DatabaseCapabilityService {
  /**
   * Get product types for a specific tier using capability_type as starting point
   * This is the common method all tiers will use to retrieve their product types
   */
  static async getProductTypesForTier(tierKey: string): Promise<FeatureWithRestrictions[]> {
    // Query using tier-specific capability view:
    // SELECT features FROM tier_capabilities_view 
    // WHERE tier_key = ? AND capability_category = 'product_types'
    
    // TODO: Replace with actual database query
    // For now, return mock data that matches the database structure
    return this.getTierSpecificFeatures(tierKey);
  }

  /**
   * Check if a specific product type is available for a tier
   */
  static async isProductTypeAvailable(tierKey: string, productTypeKey: string): Promise<boolean> {
    const productTypes = await this.getProductTypesForTier(tierKey);
    return productTypes.some(feature => feature.key === productTypeKey && feature.is_enabled);
  }

  /**
   * Get tier-specific restrictions based on tier key
   */
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

  /**
   * Get tier-specific features based on tier
   */
  private static getTierSpecificFeatures(tierKey: string): FeatureWithRestrictions[] {
    const baseFeatures = [
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

    // Add enterprise-only features
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
          base_restrictions: { requires_scheduling: true } as any,
          is_enabled: true,
          tier_restrictions: this.getTierSpecificRestrictions(tierKey),
          effective_restrictions: { requires_scheduling: true, max_items: null as null } as any
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
          base_restrictions: { requires_recurring: true } as any,
          is_enabled: true,
          tier_restrictions: this.getTierSpecificRestrictions(tierKey),
          effective_restrictions: { requires_recurring: true, max_items: null } as any
        }
      );
    }

    return baseFeatures;
  }
}
