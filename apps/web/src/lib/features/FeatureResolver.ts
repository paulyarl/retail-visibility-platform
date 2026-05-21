/**
 * Feature Resolver - Centralized feature management and migration utility
 * 
 * This middleware handles:
 * - Feature key consolidation and aliases
 * - Legacy feature mapping for backward compatibility
 * - Feature grouping and capability resolution
 * - Tier-based feature access control
 */

// ==================== FEATURE DEFINITIONS ====================

export interface FeatureCapability {
  key: string;
  name: string;
  description: string;
  category: string;
  metadata?: Record<string, any>;
}

interface FeatureGroup {
  id: string;
  name: string;
  description: string;
  features: string[];
  capabilities?: Record<string, any>;
}

// Canonical feature definitions (consolidated)
const CANONICAL_FEATURES: Record<string, FeatureCapability> = {
  // QR Codes - Consolidated from 3 separate features
  'qr_codes': {
    key: 'qr_codes',
    name: 'QR Codes',
    description: 'Generate QR codes for products and storefront',
    category: 'marketing',
    metadata: {
      supportedResolutions: ['512', '1024', '2048'],
      defaultResolution: '512'
    }
  },

  // Barcode Scanning - Consolidated from multiple variants
  'barcode_scanning': {
    key: 'barcode_scanning',
    name: 'Barcode Scanning',
    description: 'Scan barcodes to automatically add products',
    category: 'inventory',
    metadata: {
      autoFill: true,
      imageRecognition: true
    }
  },

  // Quick Start - Consolidated wizard variants
  'quick_setup': {
    key: 'quick_setup',
    name: 'Quick Setup',
    description: 'Guided setup for products and categories',
    category: 'onboarding',
    metadata: {
      fullAccess: true,
      categorySetup: true
    }
  },

  // Branding Suite - Group related branding features
  'branding_suite': {
    key: 'branding_suite',
    name: 'Branding Suite',
    description: 'Complete branding customization',
    category: 'branding',
    metadata: {
      logo: true,
      customColors: true,
      customFonts: false,
      marketingCopy: true
    }
  },

  // Search - Consolidated search variants
  'product_search': {
    key: 'product_search',
    name: 'Product Search',
    description: 'Search products by name, code, or attributes',
    category: 'discovery',
    metadata: {
      type: 'basic',
      filters: ['name', 'code', 'category']
    }
  },

  // Image Gallery - Consolidated gallery variants
  'image_gallery': {
    key: 'image_gallery',
    name: 'Image Gallery',
    description: 'Multiple product images',
    category: 'media',
    metadata: {
      maxImages: 5,
      supportedFormats: ['jpg', 'png', 'webp']
    }
  },

  // Analytics - Consolidated analytics variants
  'analytics': {
    key: 'analytics',
    name: 'Performance Analytics',
    description: 'Track product and storefront performance',
    category: 'analytics',
    metadata: {
      level: 'basic',
      reports: ['views', 'clicks', 'conversions']
    }
  },

  // Commerce - Consolidated commerce features
  'commerce': {
    key: 'commerce',
    name: 'E-commerce',
    description: 'Complete online selling capabilities',
    category: 'commerce',
    metadata: {
      fullPayment: true,
      checkout: true,
      inventory: true
    }
  },

  // Keep individual features that don't need consolidation
  'google_shopping': {
    key: 'google_shopping',
    name: 'Google Shopping',
    description: 'List products on Google Shopping',
    category: 'marketing'
  },
  'google_merchant_center': {
    key: 'google_merchant_center',
    name: 'Google Merchant Center',
    description: 'Sync inventory to Google Merchant Center',
    category: 'marketing'
  },
  'clover_sync': {
    key: 'clover_sync',
    name: 'Clover POS Integration',
    description: 'Real-time sync with Clover POS',
    category: 'inventory'
  },
  'square_sync': {
    key: 'square_sync',
    name: 'Square POS Integration',
    description: 'Real-time sync with Square POS',
    category: 'inventory'
  }
};

// Feature groupings
const FEATURE_GROUPS: Record<string, FeatureGroup> = {
  'marketing_tools': {
    id: 'marketing_tools',
    name: 'Marketing Tools',
    description: 'Tools to promote and market your products',
    features: ['qr_codes', 'google_shopping', 'google_merchant_center']
  },
  'branding_package': {
    id: 'branding_package',
    name: 'Branding Package',
    description: 'Complete customization of your storefront',
    features: ['branding_suite', 'custom_domain', 'white_label']
  },
  'pos_integrations': {
    id: 'pos_integrations',
    name: 'POS Integrations',
    description: 'Connect with popular POS systems',
    features: ['clover_sync', 'square_sync']
  }
};

// ==================== LEGACY MAPPING ====================

// Legacy feature keys and their canonical equivalents
const LEGACY_FEATURE_MAP: Record<string, string> = {
  // QR Codes consolidation
  'qr_codes_512': 'qr_codes',
  'qr_codes_1024': 'qr_codes',
  'qr_codes_2048': 'qr_codes',

  // Barcode scanning consolidation
  'barcode_scan': 'barcode_scanning',
  'product_scanning': 'barcode_scanning',
  'barcode_scanning': 'barcode_scanning',

  // Quick start consolidation
  'quick_start_wizard': 'quick_setup',
  'quick_start_wizard_full': 'quick_setup',
  'category_quick_start': 'quick_setup',

  // Branding consolidation
  'business_logo': 'branding_suite',
  'custom_branding': 'branding_suite',
  'custom_marketing_copy': 'branding_suite',

  // Search consolidation
  'basic_search': 'product_search',

  // Gallery consolidation
  'image_gallery_5': 'image_gallery',
  'image_gallery_10': 'image_gallery',

  // Analytics consolidation
  'performance_analytics': 'analytics',
  'advanced_analytics': 'analytics',

  // Commerce consolidation
  'commerce_full_payment': 'commerce',
  'commerce_enabled': 'commerce',

  // Keep unmapped features for now (will be handled individually)
  'basic_product_pages': 'basic_product_pages',
  'mobile_responsive': 'mobile_responsive',
  'enhanced_seo': 'enhanced_seo',
  'basic_categories': 'basic_categories',
  'bulk_import': 'bulk_import',
  'categories': 'categories',
  'manual_entry': 'manual_entry',
  'manual_barcode': 'manual_barcode',
  'google_sync': 'google_sync',
  'gbp_integration': 'gbp_integration',
  'interactive_maps': 'interactive_maps',
  'privacy_mode': 'privacy_mode',
  'payment_client_credentials': 'payment_client_credentials',
  'api_access': 'api_access',
  'white_label': 'white_label',
  'custom_domain': 'custom_domain',
  'unlimited_skus': 'unlimited_skus',
  'multi_location_25': 'multi_location_25',
  'unlimited_locations': 'unlimited_locations',
  'dedicated_account_manager': 'dedicated_account_manager',
  'sla_guarantee': 'sla_guarantee',
  'custom_integrations': 'custom_integrations',
  'priority_support': 'priority_support',
  'storefront': 'storefront',
  'propagation_products': 'propagation_products',
  'all_products_visibility': 'all_products_visibility'
};

// ==================== RESOLVER CLASS ====================

export class FeatureResolver {
  private static instance: FeatureResolver;
  private cache = new Map<string, any>();

  static getInstance(): FeatureResolver {
    if (!FeatureResolver.instance) {
      FeatureResolver.instance = new FeatureResolver();
    }
    return FeatureResolver.instance;
  }

  /**
   * Resolve a feature key to its canonical form
   */
  resolveFeature(featureKey: string): string {
    // Check cache first
    if (this.cache.has(featureKey)) {
      return this.cache.get(featureKey);
    }

    // Check if it's already a canonical feature
    if (CANONICAL_FEATURES[featureKey]) {
      this.cache.set(featureKey, featureKey);
      return featureKey;
    }

    // Check legacy mapping
    const canonical = LEGACY_FEATURE_MAP[featureKey];
    if (canonical) {
      this.cache.set(featureKey, canonical);
      return canonical;
    }

    // Return as-is if no mapping found
    this.cache.set(featureKey, featureKey);
    return featureKey;
  }

  /**
   * Get feature definition for a key (handles legacy keys)
   */
  getFeature(featureKey: string): FeatureCapability | null {
    const canonical = this.resolveFeature(featureKey);
    return CANONICAL_FEATURES[canonical] || null;
  }

  /**
   * Resolve a list of features to canonical form
   */
  resolveFeatures(featureKeys: string[]): string[] {
    return featureKeys.map(key => this.resolveFeature(key));
  }

  /**
   * Get unique canonical features from a list (removes duplicates)
   */
  getUniqueFeatures(featureKeys: string[]): string[] {
    const resolved = this.resolveFeatures(featureKeys);
    return [...new Set(resolved)];
  }

  /**
   * Check if a feature exists in the canonical definitions
   */
  hasFeature(featureKey: string): boolean {
    const canonical = this.resolveFeature(featureKey);
    return !!CANONICAL_FEATURES[canonical];
  }

  /**
   * Get all features in a category
   */
  getFeaturesByCategory(category: string): FeatureCapability[] {
    return Object.values(CANONICAL_FEATURES).filter(
      feature => feature.category === category
    );
  }

  /**
   * Get feature group information
   */
  getFeatureGroup(groupId: string): FeatureGroup | null {
    return FEATURE_GROUPS[groupId] || null;
  }

  /**
   * Get all feature groups
   */
  getAllFeatureGroups(): FeatureGroup[] {
    return Object.values(FEATURE_GROUPS);
  }

  /**
   * Get consolidated feature list for a tier
   */
  getTierFeatures(tierFeatures: string[]): {
    canonical: string[];
    groups: string[];
    legacy: string[];
    consolidated: string[];
  } {
    const canonical = this.getUniqueFeatures(tierFeatures);
    const legacy = tierFeatures.filter(key => this.resolveFeature(key) !== key);
    
    // Determine which groups are fully covered
    const groups: string[] = [];
    Object.entries(FEATURE_GROUPS).forEach(([groupId, group]) => {
      const hasAllFeatures = group.features.every(feature => 
        canonical.includes(feature)
      );
      if (hasAllFeatures) {
        groups.push(groupId);
      }
    });

    // Create consolidated list (groups + individual features)
    const consolidated = [
      ...groups,
      ...canonical.filter(feature => 
        !groups.some(groupId => 
          FEATURE_GROUPS[groupId].features.includes(feature)
        )
      )
    ];

    return {
      canonical,
      groups,
      legacy,
      consolidated
    };
  }

  /**
   * Get feature metadata for tier-based resolution
   */
  getFeatureMetadata(featureKey: string, tierKey?: string): Record<string, any> {
    const feature = this.getFeature(featureKey);
    if (!feature) return {};

    const metadata = { ...feature.metadata };

    // Tier-specific metadata overrides
    if (tierKey) {
      switch (featureKey) {
        case 'qr_codes':
          if (tierKey.includes('enterprise')) {
            metadata.maxResolution = '2048';
          } else if (tierKey.includes('professional') || tierKey.includes('omnichannel')) {
            metadata.maxResolution = '1024';
          } else if (tierKey.includes('commitment') || tierKey.includes('ecommerce')) {
            metadata.maxResolution = '1024';
          } else {
            metadata.maxResolution = '512';
          }
          break;

        case 'image_gallery':
          if (tierKey.includes('enterprise') || tierKey.includes('professional')) {
            metadata.maxImages = 10;
          } else {
            metadata.maxImages = 5;
          }
          break;

        case 'analytics':
          if (tierKey.includes('enterprise')) {
            metadata.level = 'advanced';
            metadata.reports.push('custom', 'export');
          } else if (tierKey.includes('professional')) {
            metadata.level = 'enhanced';
            metadata.reports.push('trends');
          }
          break;
      }
    }

    return metadata;
  }

  /**
   * Clear cache (useful for testing or updates)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ==================== EXPORTS ====================

export const featureResolver = FeatureResolver.getInstance();

// Convenience functions for common operations
export const resolveFeature = (key: string) => featureResolver.resolveFeature(key);
export const getFeature = (key: string) => featureResolver.getFeature(key);
export const resolveFeatures = (keys: string[]) => featureResolver.resolveFeatures(keys);
export const getTierFeatures = (features: string[]) => featureResolver.getTierFeatures(features);
