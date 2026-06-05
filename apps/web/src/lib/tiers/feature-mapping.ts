/**
 * Feature Mapping: Marketing Benefits ↔ Admin Features
 * Aligns /features page benefits with /settings/offerings technical features
 */

export interface FeatureMapping {
  marketingBenefit: string;
  adminFeatures: string[];
  tier: 'discovery' | 'storefront' | 'commitment' | 'professional' | 'enterprise';
  category: 'clover-inventory' | 'google-visibility' | 'platform-presence' | 'commerce-conversion' | 'management-growth';
}

export const FEATURE_MAPPING: FeatureMapping[] = [
  // CLOVER & INVENTORY
  {
    marketingBenefit: 'Clover POS Integration & Real-Time Sync',
    adminFeatures: [
      'clover_pos_integration',
      'real_time_inventory_sync',
      'automatic_product_sync',
      'single_source_of_truth'
    ],
    tier: 'discovery',
    category: 'clover-inventory'
  },
  {
    marketingBenefit: 'Real-Time Inventory Management',
    adminFeatures: [
      'real_time_inventory_tracking',
      'multi_location_support',
      'low_stock_alerts',
      'stock_availability_indicators'
    ],
    tier: 'discovery',
    category: 'clover-inventory'
  },
  {
    marketingBenefit: 'SKU Scanning + Inventory Intelligence',
    adminFeatures: [
      'barcode_scanning',
      'product_data_capture',
      'nutrition_facts_scanning',
      'allergen_detection',
      'real_time_analytics',
      'data_quality_tracking',
      'product_preview_tool'
    ],
    tier: 'professional',
    category: 'clover-inventory'
  },
  {
    marketingBenefit: 'Quick Start Wizard',
    adminFeatures: [
      'quick_start_generation',
      'auto_categorization',
      'realistic_pricing',
      'product_templates'
    ],
    tier: 'professional',
    category: 'clover-inventory'
  },

  // GOOGLE VISIBILITY
  {
    marketingBenefit: 'Full Google Business Profile Integration',
    adminFeatures: [
      'gmb_category_sync',
      'business_hours_automation',
      'product_feed_generation',
      'swis_integration',
      'local_inventory_ads',
      'out_of_sync_detection'
    ],
    tier: 'discovery',
    category: 'google-visibility'
  },
  {
    marketingBenefit: 'Google Search & Shopping Optimization',
    adminFeatures: [
      'seo_optimized_pages',
      'google_search_indexing',
      'google_shopping_visibility',
      'mobile_optimized_pages',
      'automatic_schema_markup'
    ],
    tier: 'discovery',
    category: 'google-visibility'
  },
  {
    marketingBenefit: 'Google Maps & SWIS (See What\'s In Store)',
    adminFeatures: [
      'live_inventory_maps',
      'swis_integration',
      'mobile_optimized_display',
      'real_time_stock_status',
      'in_store_pickup_indicators'
    ],
    tier: 'discovery',
    category: 'google-visibility'
  },

  // PLATFORM PRESENCE
  {
    marketingBenefit: 'Branded Public Storefront',
    adminFeatures: [
      'custom_branding',
      'logo_upload',
      'store_profile',
      'product_catalog_display',
      'mobile_optimized_design',
      'seo_friendly_urls'
    ],
    tier: 'storefront',
    category: 'platform-presence'
  },
  {
    marketingBenefit: 'Smart Product Categories',
    adminFeatures: [
      'google_taxonomy_integration',
      'auto_categorization',
      'platform_category_management',
      'customer_friendly_navigation',
      'search_optimization'
    ],
    tier: 'storefront',
    category: 'platform-presence'
  },
  {
    marketingBenefit: 'Smart Business Hours',
    adminFeatures: [
      'real_time_status',
      'multiple_periods',
      'split_shifts',
      'emergency_updates',
      'custom_customer_notes'
    ],
    tier: 'storefront',
    category: 'platform-presence'
  },
  {
    marketingBenefit: 'Platform Directory & Discovery',
    adminFeatures: [
      'directory_listing',
      'enhanced_discovery',
      'category_browsing',
      'location_search',
      'shopper_inquiry_system'
    ],
    tier: 'discovery',
    category: 'platform-presence'
  },
  {
    marketingBenefit: 'QR Code Marketing & Sharing',
    adminFeatures: [
      'product_qr_codes',
      'storefront_qr_codes',
      'directory_qr_codes',
      'high_resolution_print',
      'trackable_campaigns',
      'mobile_sharing'
    ],
    tier: 'discovery',
    category: 'platform-presence'
  },

  // COMMERCE & CONVERSION
  {
    marketingBenefit: 'Add to Cart & Checkout Flow',
    adminFeatures: [
      'add_to_cart_functionality',
      'shopping_cart_management',
      'guest_checkout',
      'mobile_optimized_checkout',
      'order_confirmation'
    ],
    tier: 'commitment',
    category: 'commerce-conversion'
  },
  {
    marketingBenefit: 'Commitment Commerce - Holding Deposits',
    adminFeatures: [
      'holding_fee_collection',
      'inventory_reservation',
      'shopper_commitment',
      'forfeiture_protection',
      'no_show_reduction'
    ],
    tier: 'commitment',
    category: 'commerce-conversion'
  },
  {
    marketingBenefit: 'Click & Collect / BOPIS',
    adminFeatures: [
      'buy_online_pickup_store',
      'real_time_inventory_check',
      'pickup_scheduling',
      'store_fulfillment',
      'customer_notifications'
    ],
    tier: 'commitment',
    category: 'commerce-conversion'
  },
  {
    marketingBenefit: 'Full Online Payment Collection',
    adminFeatures: [
      'full_payment_processing',
      'multiple_payment_methods',
      'automatic_order_processing',
      'payment_security',
      'refund_management'
    ],
    tier: 'professional',
    category: 'commerce-conversion'
  },

  // MANAGEMENT & GROWTH
  {
    marketingBenefit: 'Analytics & Conversion Reporting',
    adminFeatures: [
      'conversion_analytics',
      'inventory_reports',
      'performance_metrics',
      'abandonment_tracking',
      'export_reports'
    ],
    tier: 'commitment',
    category: 'management-growth'
  },
  {
    marketingBenefit: 'Multi-Location Management',
    adminFeatures: [
      'product_propagation',
      'user_role_propagation',
      'hours_sync',
      'profile_sync',
      'category_sync',
      'one_click_distribution',
      'hero_location_testing'
    ],
    tier: 'enterprise',
    category: 'management-growth'
  },
  {
    marketingBenefit: 'API Access & Custom Integrations',
    adminFeatures: [
      'restful_api',
      'webhook_support',
      'custom_integration_tools',
      'developer_documentation',
      'technical_support'
    ],
    tier: 'professional',
    category: 'management-growth'
  },
  {
    marketingBenefit: 'Enterprise Security & Compliance',
    adminFeatures: [
      'role_based_access',
      'audit_logging',
      'data_encryption',
      'soc2_compliance',
      'dedicated_support'
    ],
    tier: 'enterprise',
    category: 'management-growth'
  }
];

// Helper functions for feature mapping
export function getFeaturesByBenefit(benefit: string): FeatureMapping | undefined {
  return FEATURE_MAPPING.find(mapping => mapping.marketingBenefit === benefit);
}

export function getFeaturesByTier(tier: string): FeatureMapping[] {
  return FEATURE_MAPPING.filter(mapping => mapping.tier === tier);
}

export function getFeaturesByCategory(category: string): FeatureMapping[] {
  return FEATURE_MAPPING.filter(mapping => mapping.category === category);
}

export function getAdminFeaturesForBenefit(benefit: string): string[] {
  const mapping = getFeaturesByBenefit(benefit);
  return mapping?.adminFeatures || [];
}

export function getMarketingBenefitsForTier(tier: string): string[] {
  return getFeaturesByTier(tier).map(mapping => mapping.marketingBenefit);
}

// Category colors for UI
export const CATEGORY_COLORS = {
  'clover-inventory': 'from-blue-500 to-purple-600',
  'google-visibility': 'from-green-500 to-emerald-600',
  'platform-presence': 'from-purple-500 to-indigo-600',
  'commerce-conversion': 'from-amber-500 to-red-600',
  'management-growth': 'from-cyan-500 to-blue-600'
} as const;

// Tier colors for UI
export const TIER_COLORS = {
  'discovery': 'blue',
  'storefront': 'purple',
  'commitment': 'green',
  'professional': 'amber',
  'enterprise': 'red'
} as const;
