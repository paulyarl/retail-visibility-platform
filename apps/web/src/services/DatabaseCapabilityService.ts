/**
 * Database-Driven Capability Service
 * 
 * Works with enhanced capability-tier architecture:
 * - capability_types (categories like 'product_creation', 'marketing', 'commerce')
 * - features_list (central repository for ALL features)
 * - capability_features (groups features into capability types)
 * - tier_capabilities_list (tier-specific CAPABILITIES, not individual features)
 * - tier_feature_overrides (optional fine-grained feature overrides)
 */

export interface Feature {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  capability_type_id?: string;
  is_active: boolean;
  sort_order: number;
  marketing_name?: string;
  marketing_description?: string;
  icon_name?: string;
}

export interface CapabilityType {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string; // 'core', 'marketing', 'commerce', 'private', 'analytics'
  is_active: boolean;
  sort_order: number;
}

export interface CapabilityFeature {
  id: string;
  capability_type_id: string;
  feature_id: string;
  restrictions?: {
    base_max_items?: number;
    requires_inventory?: boolean;
    requires_delivery?: boolean;
    requires_custom_attributes?: boolean;
    requires_scheduling?: boolean;
    requires_recurring?: boolean;
    transaction_fee?: number;
    requires_compliance?: boolean;
    data_retention_days?: number;
    real_time?: boolean;
    [key: string]: any;
  };
  is_active: boolean;
  sort_order: number;
}

export interface TierCapability {
  id: string;
  tier_id: string;
  capability_type_id: string;
  is_enabled: boolean;
  is_inherited: boolean;
  is_highlighted: boolean;
  highlight_order?: number;
  highlight_description?: string;
  marketing_name?: string;
  tier_specific_restrictions?: {
    max_items?: number;
    allowed_types?: string[];
    blocked_operations?: string[];
    tier_requirement?: string;
    max_emails_per_month?: number;
    max_active_coupons?: number;
    max_social_accounts?: number;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface DatabaseCapability {
  tier_key: string;
  tier_name: string;
  capability_type_key: string;
  capability_type_name: string;
  capability_category: string;
  capability_enabled: boolean;
  capability_marketing_name?: string;
  tier_specific_restrictions?: any;
  features: FeatureWithRestrictions[];
  total_features: number;
  enabled_features: number;
}

export interface FeatureWithRestrictions extends Feature {
  base_restrictions?: any;
  is_enabled: boolean;
  tier_restrictions?: any;
  effective_restrictions?: any;
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
  capabilities: DatabaseCapability[];
}

/**
 * Service for fetching capabilities from tier-specific capability architecture
 */
export class DatabaseCapabilityService {
  /**
   * Get capabilities for a specific tenant tier using tier-specific capability types
   */
  static async getTenantCapabilities(tierKey: string): Promise<TierCapabilities> {
    // Query using tier-specific schema via view:
    // SELECT * FROM tier_capabilities_view 
    // WHERE tier_key = ? 
    // ORDER BY capability_type_key, highlight_order
    
    // Mock implementation using tier-specific capability architecture
    // Each tier gets their own capability type (e.g., discovery_product_type, storefront_product_type)
    const tierCapabilityKey = `${tierKey}_product_type`;
    
    return {
      tier_id: tierKey,
      tier_key: tierKey,
      name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
      display_name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
      description: `${tierKey} subscription tier`,
      price_monthly: 0,
      tier_type: 'individual',
      is_active: true,
      sort_order: 1,
      capabilities: [
        {
          tier_key: tierKey,
          tier_name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
          capability_type_key: tierCapabilityKey,
          capability_type_name: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Product Types`,
          capability_category: 'product_types',
          capability_enabled: true,
          capability_marketing_name: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Product Types`,
          tier_specific_restrictions: this.getTierSpecificRestrictions(tierKey),
          features: this.getTierSpecificFeatures(tierKey),
          total_features: this.getTotalFeaturesForTier(tierKey),
          enabled_features: this.getEnabledFeaturesForTier(tierKey)
        }
      ]
    };
  }

  /**
   * Get product types for a specific tier using capability_type as starting point
   * This is the common method all tiers will use to retrieve their product types
   */
  static async getProductTypesForTier(tierKey: string): Promise<FeatureWithRestrictions[]> {
    // Query using tier-specific capability:
    // SELECT fl.*, cfl.restrictions, tfl.tier_specific_restrictions
    // FROM tier_features_list tfl
    // JOIN capability_type_list ctl ON tfl.capability_type_id = ctl.id
    // JOIN capability_features_list cfl ON ctl.id = cfl.capability_type_id
    // JOIN features_list fl ON cfl.feature_id = fl.id
    // WHERE tfl.tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = ?)
    //   AND ctl.category = 'product_types'
    //   AND tfl.is_enabled = true
    //   AND fl.is_active = true
    //   AND cfl.is_active = true
    // ORDER BY fl.sort_order
    
    return this.getTierSpecificFeatures(tierKey);
  }

  /**
   * Check if a specific product type is available for a tier
   */
  static async isProductTypeAvailable(tierKey: string, productTypeKey: string): Promise<boolean> {
    // Query:
    // SELECT COUNT(*) as available
    // FROM tier_features_list tfl
    // JOIN capability_type_list ctl ON tfl.capability_type_id = ctl.id
    // JOIN capability_features_list cfl ON ctl.id = cfl.capability_type_id
    // JOIN features_list fl ON cfl.feature_id = fl.id
    // JOIN subscription_tiers_list stl ON tfl.tier_id = stl.id
    // WHERE stl.tier_key = ? 
    //   AND ctl.category = 'product_types'
    //   AND fl.key = ?
    //   AND tfl.is_enabled = true
    //   AND fl.is_active = true
    //   AND cfl.is_active = true
    
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
          effective_restrictions: { requires_scheduling: true, max_items: null } as any
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

  /**
   * Get total features for tier
   */
  private static getTotalFeaturesForTier(tierKey: string): number {
    switch (tierKey) {
      case 'discovery':
      case 'starter':
        return 1; // physical_product only
      case 'storefront':
        return 2; // physical_product + digital_product
      case 'professional':
        return 4; // physical_product + digital_product + hybrid_product + custom_product
      case 'enterprise':
        return 6; // all product types
      default:
        return 1;
    }
  }

  /**
   * Get enabled features for tier
   */
  private static getEnabledFeaturesForTier(tierKey: string): number {
    return this.getTotalFeaturesForTier(tierKey); // All available features are enabled for their tier
  }

  /**
   * Get capabilities for a specific tier filtered by capability type
   */
  static async getCapabilitiesByType(tierKey: string, capabilityTypeKey: string): Promise<DatabaseCapability[]> {
    // Query using tier-specific schema:
    // SELECT * FROM tier_capabilities_view 
    // WHERE tier_key = ? AND capability_type_key = ?
    // ORDER BY highlight_order
    
    const tierCapabilities = await this.getTenantCapabilities(tierKey);
    
    return tierCapabilities.capabilities.filter(
      capability => capability.capability_type_key === capabilityTypeKey
    );
  }

  /**
   * Get all capability types for a tier
   */
  static async getCapabilityTypesForTier(tierKey: string): Promise<CapabilityType[]> {
    // Query: 
    // SELECT ctl.* FROM capability_type_list ctl
    // JOIN tier_features_list tfl ON ctl.id = tfl.capability_type_id
    // JOIN subscription_tiers_list stl ON tfl.tier_id = stl.id
    // WHERE stl.tier_key = ? AND ctl.is_active = true AND tfl.is_enabled = true
    // ORDER BY ctl.sort_order
    
    return [
      {
        id: `${tierKey}_product_type_id`,
        key: `${tierKey}_product_type`,
        name: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Product Types`,
        description: `Product types for ${tierKey} tier`,
        category: 'product_types',
        is_active: true,
        sort_order: 1
      }
    ];
  }

  /**
   * Get all features for a tier-specific capability type
   */
  static async getFeaturesByCapabilityType(tierKey: string, capabilityCategory: string): Promise<Feature[]> {
    // Query using tier-specific capability:
    // SELECT fl.* FROM features_list fl
    // JOIN capability_features_list cfl ON fl.id = cfl.feature_id
    // JOIN capability_type_list ctl ON cfl.capability_type_id = ctl.id
    // JOIN tier_features_list tfl ON ctl.id = tfl.capability_type_id
    // JOIN subscription_tiers_list stl ON tfl.tier_id = stl.id
    // WHERE stl.tier_key = ? 
    //   AND ctl.category = ?
    //   AND fl.is_active = true 
    //   AND cfl.is_active = true
    //   AND tfl.is_enabled = true
    // ORDER BY fl.sort_order
    
    if (capabilityCategory === 'product_types') {
      return this.getTierSpecificFeatures(tierKey).map(feature => ({
        id: feature.id,
        key: feature.key,
        name: feature.name,
        description: feature.description,
        category: feature.category,
        is_active: feature.is_active,
        sort_order: feature.sort_order,
        marketing_name: feature.marketing_name,
        marketing_description: feature.marketing_description,
        icon_name: feature.icon_name
      }));
    }
    
    return [];
  }

  /**
   * Get feature by key for a specific tier
   */
  static async getFeatureByKeyForTier(tierKey: string, featureKey: string): Promise<FeatureWithRestrictions | null> {
    // Query: 
    // SELECT fl.*, cfl.restrictions, tfl.tier_specific_restrictions
    // FROM features_list fl
    // JOIN capability_features_list cfl ON fl.id = cfl.feature_id
    // JOIN capability_type_list ctl ON cfl.capability_type_id = ctl.id
    // JOIN tier_features_list tfl ON ctl.id = tfl.capability_type_id
    // JOIN subscription_tiers_list stl ON tfl.tier_id = stl.id
    // WHERE stl.tier_key = ? 
    //   AND fl.key = ?
    //   AND fl.is_active = true 
    //   AND cfl.is_active = true
    //   AND tfl.is_enabled = true
    
    const allFeatures = await this.getProductTypesForTier(tierKey);
    return allFeatures.find(f => f.key === featureKey) || null;
  }

  /**
   * Check if a specific feature is available for a tier
   */
  static async isFeatureAvailable(
    tierKey: string, 
    featureKey: string
  ): Promise<boolean> {
    /* Query using capability-tier schema:
    SELECT COUNT(*) as available
    FROM tier_capabilities_view tcv
    WHERE tcv.tier_key = ? 
      AND EXISTS (
        SELECT 1 FROM json_array_elements(tcv.features) f 
        WHERE f->>'feature_key' = ? AND f->>'is_enabled' = 'true'
      )
    */
    
    const tierCapabilities = await this.getTenantCapabilities(tierKey);
    
    // Check all capabilities and their features
    for (const capability of tierCapabilities.capabilities) {
      for (const feature of capability.features) {
        if (feature.key === featureKey && feature.is_enabled) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get all tiers with their capabilities for admin management
   */
  static async getAllTiersWithCapabilities(): Promise<TierCapabilities[]> {
    // Query using capability-tier schema:
    // SELECT * FROM tier_capabilities_view
    // ORDER BY tier_key, capability_type_key
    
    const tiers = ['discovery', 'starter', 'storefront', 'professional', 'enterprise'];
    const results: TierCapabilities[] = [];
    
    for (const tierKey of tiers) {
      results.push(await this.getTenantCapabilities(tierKey));
    }
    
    return results;
  }

  /**
   * Update or create tier capability
   */
  static async upsertTierCapability(
    tierId: string,
    capabilityTypeKey: string,
    capabilityData: Partial<TierCapability>
  ): Promise<void> {
    // UPSERT into tier_capabilities_list table
    // INSERT INTO tier_capabilities_list (...) VALUES (...)
    // ON CONFLICT (tier_id, capability_type_id) 
    // DO UPDATE SET ... = EXCLUDED....
    
    console.log(`Upsert capability ${capabilityTypeKey} for tier ${tierId}:`, capabilityData);
  }

  /**
   * Get highlighted capabilities for a tier (for marketing)
   */
  static async getHighlightedCapabilities(tierKey: string): Promise<DatabaseCapability[]> {
    // Query using capability-tier schema:
    // SELECT * FROM tier_capabilities_view
    // WHERE tier_key = ? 
    //   AND is_highlighted = true
    //   AND capability_enabled = true
    // ORDER BY highlight_order
    
    const tierCapabilities = await this.getTenantCapabilities(tierKey);
    
    return tierCapabilities.capabilities.filter(
      capability => capability.capability_enabled // Note: capability_enabled replaces is_highlighted
    );
  }
}

/**
 * Hook for database-driven capability checking
 */
export function useDatabaseCapability(tierKey: string) {
  // TODO: Implement React hook that calls DatabaseCapabilityService
  // with proper caching and error handling
  
  const [capabilities, setCapabilities] = useState<TierCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        setIsLoading(true);
        const result = await DatabaseCapabilityService.getTenantCapabilities(tierKey);
        setCapabilities(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load capabilities');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCapabilities();
  }, [tierKey]);
  
  return {
    capabilities,
    isLoading,
    error
  };
}

// Add missing React import
import { useState, useEffect } from 'react';
