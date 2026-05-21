/**
 * Legacy Feature Mappings
 * 
 * Maps old/legacy feature keys to canonical feature keys.
 * Ensures backward compatibility during migration.
 */

// Legacy feature keys and their canonical equivalents
export const LEGACY_FEATURE_MAP: Record<string, string> = {
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
  'basic_search': 'product_management',
  'product_search': 'product_management',
  
  // Gallery consolidation
  'image_gallery_5': 'image_gallery',
  'image_gallery_10': 'image_gallery',
  
  // Analytics consolidation
  'performance_analytics': 'analytics',
  'advanced_analytics': 'advanced_analytics',
  
  // Commerce consolidation
  'commerce_full_payment': 'commerce',
  'commerce_enabled': 'commerce',
  'commerce_deposit_only': 'commerce',
  'commerce_both_options': 'commerce',
  
  // Product pages
  'basic_product_pages': 'storefront',
  
  // Keep unmapped features for now (will be handled individually)
  'manual_entry': 'product_management',
  'manual_barcode': 'barcode_scanning',
  'bulk_import': 'bulk_import',
  'categories': 'categories',
  'square_sync': 'square_sync',
  'clover_sync': 'clover_sync',
  'google_sync': 'google_merchant_center',
  'gbp_integration': 'google_shopping',
  'interactive_maps': 'interactive_maps',
  'privacy_mode': 'privacy_mode',
  'payment_client_credentials': 'payment_client_credentials',
  'api_access': 'api_access',
  'white_label': 'white_label',
  'custom_domain': 'custom_domain',
  'unlimited_skus': 'product_management',
  'multi_location_25': 'product_management',
  'unlimited_locations': 'product_management',
  'dedicated_account_manager': 'advanced_analytics',
  'sla_guarantee': 'advanced_analytics',
  'custom_integrations': 'api_access',
  'priority_support': 'advanced_analytics',
  'storefront': 'storefront',
  'propagation_products': 'product_management',
  'all_products_visibility': 'storefront',
  'google_shopping': 'google_shopping',
  'google_merchant_center': 'google_merchant_center',
  'mobile_responsive': 'mobile_responsive',
  'enhanced_seo': 'enhanced_seo',
  'conversion_tracking': 'conversion_tracking',
  'delivery_options': 'delivery_options',
  'custom_colors': 'branding_suite',
  'custom_fonts': 'white_label',
  'custom_footer': 'white_label',
  'custom_emails': 'white_label',
  'platform_branding': 'white_label'
};

// Reverse mapping for validation
export const REVERSE_LEGACY_MAP: Record<string, string[]> = {};
Object.entries(LEGACY_FEATURE_MAP).forEach(([legacy, canonical]) => {
  if (!REVERSE_LEGACY_MAP[canonical]) {
    REVERSE_LEGACY_MAP[canonical] = [];
  }
  REVERSE_LEGACY_MAP[canonical].push(legacy);
});

// Migration groups for batch processing
export const MIGRATION_GROUPS: Record<string, string[]> = {
  'qr_codes': ['qr_codes_512', 'qr_codes_1024', 'qr_codes_2048'],
  'barcode_scanning': ['barcode_scan', 'product_scanning', 'barcode_scanning'],
  'quick_setup': ['quick_start_wizard', 'quick_start_wizard_full', 'category_quick_start'],
  'branding_suite': ['business_logo', 'custom_branding', 'custom_marketing_copy'],
  'image_gallery': ['image_gallery_5', 'image_gallery_10'],
  'analytics': ['performance_analytics'],
  'commerce': ['commerce_full_payment', 'commerce_enabled', 'commerce_deposit_only', 'commerce_both_options']
};

// Validation helper
export function validateLegacyMapping(legacyKey: string): {
  isValid: boolean;
  canonical?: string;
  isConsolidated: boolean;
  group?: string;
} {
  const canonical = LEGACY_FEATURE_MAP[legacyKey];
  
  if (!canonical) {
    return { isValid: false, isConsolidated: false };
  }
  
  // Check if this is part of a consolidation group
  const group = Object.entries(MIGRATION_GROUPS).find(([_, keys]) => 
    keys.includes(legacyKey)
  )?.[0];
  
  return {
    isValid: true,
    canonical,
    isConsolidated: !!group,
    group
  };
}

// Get all legacy keys for a canonical feature
export function getLegacyKeys(canonicalKey: string): string[] {
  return REVERSE_LEGACY_MAP[canonicalKey] || [];
}

// Check if key is legacy
export function isLegacyKey(key: string): boolean {
  return LEGACY_FEATURE_MAP.hasOwnProperty(key);
}

// Check if canonical key has legacy mappings
export function hasLegacyMappings(canonicalKey: string): boolean {
  return REVERSE_LEGACY_MAP.hasOwnProperty(canonicalKey);
}
