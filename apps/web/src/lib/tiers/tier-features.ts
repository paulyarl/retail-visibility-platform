/**
 * Tier Feature Definitions
 * 
 * Defines which features are available at each subscription tier.
 * Features are cumulative - higher tiers inherit lower tier features.
 * 
 * MUST stay in sync with backend: apps/api/src/middleware/tier-access.ts
 */

export const TIER_FEATURES = {
  google_only: [
    'google_shopping',
    'google_merchant_center',
    'basic_product_pages',
    'qr_codes_512',
    'performance_analytics',
    // NOTE: No 'storefront' or quick starts - google_only is maintenance mode
  ],
  starter: [
    'storefront',
    'product_search',
    'mobile_responsive',
    'enhanced_seo',
    'basic_categories',
    'category_quick_start',      // Generate starter categories (Starter+)
  ],
  professional: [
    // ⚠️ CRITICAL REVENUE-PROTECTING FEATURES
    'quick_start_wizard',       // Saves 400+ hours, worth $10K+
    'product_scanning',          // Worth $375/mo in labor
    'gbp_integration',           // Worth $200-300/mo
    'custom_branding',
    'business_logo',
    'qr_codes_1024',
    'image_gallery_5',
    'interactive_maps',
    'privacy_mode',
    'custom_marketing_copy',
    'priority_support',
  ],
  enterprise: [
    'unlimited_skus',
    'white_label',
    'custom_domain',
    'qr_codes_2048',
    'image_gallery_10',
    'api_access',
    'advanced_analytics',
    'dedicated_account_manager',
    'sla_guarantee',
    'custom_integrations',
  ],
  organization: [
    // Organization-specific features (franchise model)
    'propagation_products',
    'propagation_categories',
    'propagation_gbp_sync',
    'propagation_hours',
    'propagation_profile',
    'propagation_flags',
    'propagation_roles',
    'propagation_brand',
    'organization_dashboard',
    'hero_location',
    'strategic_testing',
    'unlimited_locations',
    'shared_sku_pool',
    'centralized_control',
    'api_access',
  ],
  // Chain tiers (similar to individual but multi-location)
  chain_starter: [
    'storefront',
    'product_search',
    'mobile_responsive',
    'enhanced_seo',
    'multi_location_5',
  ],
  chain_professional: [
    'quick_start_wizard',
    'product_scanning',
    'gbp_integration',
    'custom_branding',
    'qr_codes_1024',
    'image_gallery_5',
    'multi_location_25',
    'basic_propagation',
  ],
  chain_enterprise: [
    'unlimited_skus',
    'white_label',
    'custom_domain',
    'qr_codes_2048',
    'image_gallery_10',
    'api_access',
    'unlimited_locations',
    'advanced_propagation',
    'dedicated_account_manager',
  ],
} as const;

// Tier hierarchy for inheritance (lower tiers inherit from higher)
// NOTE: 'trial' is not a tier - it's a time-limited status that can apply to any tier
export const TIER_HIERARCHY: Record<string, string[]> = {
  google_only: [],
  starter: ['google_only'],
  professional: ['starter', 'google_only'],
  enterprise: ['professional', 'starter', 'google_only'],
  organization: ['professional', 'starter', 'google_only'],
  chain_starter: ['starter', 'google_only'],
  chain_professional: ['professional', 'starter', 'google_only'],
  chain_enterprise: ['enterprise', 'professional', 'starter', 'google_only'],
};

// Feature to minimum required tier mapping
export const FEATURE_TIER_MAP: Record<string, string> = {
  // Starter tier features
  storefront: 'starter',
  product_search: 'starter',
  mobile_responsive: 'starter',
  enhanced_seo: 'starter',
  category_quick_start: 'starter',
  
  // Professional tier features (CRITICAL)
  quick_start_wizard: 'professional',
  product_scanning: 'professional',
  gbp_integration: 'professional',
  custom_branding: 'professional',
  qr_codes_1024: 'professional',
  image_gallery_5: 'professional',
  
  // Enterprise tier features
  white_label: 'enterprise',
  custom_domain: 'enterprise',
  qr_codes_2048: 'enterprise',
  image_gallery_10: 'enterprise',
  api_access: 'enterprise',
  
  // Starter tier propagation (limited)
  propagation_products: 'starter',
  propagation_user_roles: 'starter',
  
  // Professional tier propagation (full operational suite)
  propagation_hours: 'professional',
  propagation_profile: 'professional',
  propagation_categories: 'professional',
  propagation_gbp_sync: 'professional',
  propagation_feature_flags: 'professional',
  
  // Organization tier features
  propagation_brand_assets: 'organization',
  propagation_selective: 'organization',
  propagation_scheduling: 'organization',
  propagation_rollback: 'organization',
  organization_dashboard: 'organization',
  hero_location: 'organization',
  strategic_testing: 'organization',
};

// Tier display names
// NOTE: 'trial' is not a tier - it's a subscription status (trial, active, past_due, canceled)
export const TIER_DISPLAY_NAMES: Record<string, string> = {
  google_only: 'Google-Only',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  organization: 'Organization',
  chain_starter: 'Chain Starter',
  chain_professional: 'Chain Professional',
  chain_enterprise: 'Chain Enterprise',
};

/**
 * Human-readable feature names for display in UI
 */
export const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  // Core features
  'storefront': 'Public Storefront',
  'quick_start_wizard': 'Product Quick Start',
  'quick_start_wizard_limited': 'Product Quick Start (Limited)',
  'quick_start_wizard_full': 'Product Quick Start (Full Access)',
  'category_quick_start': 'Category Quick Start',
  'product_scanning': 'Product Scanning',
  'gbp_integration': 'Google Business Profile Integration',
  'api_access': 'API Access',
  'white_label': 'White Label Branding',
  'custom_domain': 'Custom Domain',
  'advanced_analytics': 'Advanced Analytics',
  
  // Product features
  'product_search': 'Product Search',
  'basic_product_pages': 'Basic Product Pages',
  'image_gallery_5': '5-Image Gallery',
  'image_gallery_10': '10-Image Gallery',
  
  // Branding
  'custom_branding': 'Custom Branding',
  'business_logo': 'Business Logo',
  'custom_marketing_copy': 'Custom Marketing Copy',
  
  // Categories
  'basic_categories': 'Basic Categories',
  
  // QR Codes
  'qr_codes_512': 'QR Codes (512px)',
  'qr_codes_1024': 'QR Codes (1024px)',
  'qr_codes_2048': 'QR Codes (2048px)',
  
  // Google features
  'google_shopping': 'Google Shopping Feed',
  'google_merchant_center': 'Google Merchant Center',
  
  // UI features
  'mobile_responsive': 'Mobile-Responsive Design',
  'enhanced_seo': 'Enhanced SEO',
  'interactive_maps': 'Interactive Maps',
  'privacy_mode': 'Privacy Mode',
  
  // Support
  'priority_support': 'Priority Support',
  'dedicated_account_manager': 'Dedicated Account Manager',
  'sla_guarantee': 'SLA Guarantee',
  
  // Analytics
  'performance_analytics': 'Performance Analytics',
  
  // SKU limits
  'unlimited_skus': 'Unlimited SKUs',
  
  // Integrations
  'custom_integrations': 'Custom Integrations',
  
  // Multi-location
  'multi_location_5': '5 Locations',
  'multi_location_25': '25 Locations',
  'unlimited_locations': 'Unlimited Locations',
  
  // Organization features
  'propagation_products': 'Product Propagation',
  'propagation_categories': 'Category Propagation',
  'propagation_gbp_sync': 'GBP Sync Propagation',
  'propagation_hours': 'Hours Propagation',
  'propagation_profile': 'Profile Propagation',
  'propagation_flags': 'Flag Propagation',
  'propagation_roles': 'Role Propagation',
  'propagation_brand': 'Brand Propagation',
  'organization_dashboard': 'Organization Dashboard',
  'hero_location': 'Hero Location',
  'strategic_testing': 'Strategic Testing',
  'shared_sku_pool': 'Shared SKU Pool',
  'centralized_control': 'Centralized Control',
  'basic_propagation': 'Basic Propagation',
};

// Tier pricing (monthly)
// NOTE: All tiers can be trialed for 14 days before payment is required
export const TIER_PRICING: Record<string, number> = {
  google_only: 29,
  starter: 49,
  professional: 499,
  enterprise: 999,
  organization: 999,
  chain_starter: 199,
  chain_professional: 1999,
  chain_enterprise: 4999,
};

/**
* Feature-specific limits per tier
* Used to restrict "taste test" features for lower tiers
*/
export const TIER_FEATURE_LIMITS: Record<string, Record<string, any>> = {
starter: {
category_quick_start: {
maxCategories: 15,         // Up to 15 categories
rateLimitDays: 7,          // Once per 7 days
businessTypes: ['grocery', 'fashion', 'electronics', 'general'], // All types
},
},
professional: {
quick_start_wizard: {
maxProducts: 100,          // Full access: up to 100 products
rateLimitDays: 1,          // Once per day
scenarios: ['grocery', 'fashion', 'electronics', 'general'], // All scenarios
},
category_quick_start: {
maxCategories: 30,         // Up to 30 categories
rateLimitDays: 1,          // Once per day
businessTypes: ['grocery', 'fashion', 'electronics', 'general'], // All types
},
},
enterprise: {
quick_start_wizard: {
maxProducts: 100,
rateLimitDays: 1,
scenarios: ['grocery', 'fashion', 'electronics', 'general'],
},
category_quick_start: {
maxCategories: 30,
rateLimitDays: 1,
businessTypes: ['grocery', 'fashion', 'electronics', 'general'],
},
},
};

/**
* Check if a tier has access to a feature
*/
export function checkTierFeature(tier: string, feature: string): boolean {
  // Get features for this tier
  const tierFeatures = TIER_FEATURES[tier as keyof typeof TIER_FEATURES] || [];
  
  // Check if feature is in this tier
  if ((tierFeatures as readonly string[]).includes(feature)) {
    return true;
  }
  
  // Check inherited tiers
  const inheritedTiers = TIER_HIERARCHY[tier] || [];
  for (const inheritedTier of inheritedTiers) {
    const inheritedFeatures = TIER_FEATURES[inheritedTier as keyof typeof TIER_FEATURES] || [];
    if ((inheritedFeatures as readonly string[]).includes(feature)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the minimum required tier for a feature
 */
export function getRequiredTier(feature: string): string {
  return FEATURE_TIER_MAP[feature] || 'professional';
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: string): string {
  return TIER_DISPLAY_NAMES[tier] || tier;
}

/**
 * Get tier pricing
 */
export function getTierPricing(tier: string): number {
  return TIER_PRICING[tier] || 0;
}

/**
 * Get all available features for a tier (including inherited)
 */
export function getTierFeatures(tier: string): string[] {
  const features = new Set<string>();
  
  // Add tier's own features
  const tierFeatures = TIER_FEATURES[tier as keyof typeof TIER_FEATURES] || [];
  (tierFeatures as readonly string[]).forEach(f => features.add(f));
  
  // Add inherited features
  const inheritedTiers = TIER_HIERARCHY[tier] || [];
  for (const inheritedTier of inheritedTiers) {
    const inheritedFeatures = TIER_FEATURES[inheritedTier as keyof typeof TIER_FEATURES] || [];
    (inheritedFeatures as readonly string[]).forEach(f => features.add(f));
  }
  
  return Array.from(features);
}

/**
 * Get feature limits for a specific tier and feature
 * Returns null if no limits apply (full access)
 */
export function getFeatureLimits(tier: string, feature: string): any | null {
  const tierLimits = TIER_FEATURE_LIMITS[tier];
  if (!tierLimits) return null;
  
  return tierLimits[feature] || null;
}

/**
 * Calculate upgrade requirements for a feature
 */
export function calculateUpgradeRequirements(currentTier: string, feature: string): {
  required: boolean;
  targetTier?: string;
  targetTierDisplay?: string;
  targetPrice?: number;
  currentPrice?: number;
  upgradeCost?: number;
} {
  const hasAccess = checkTierFeature(currentTier, feature);
  
  if (hasAccess) {
    return { required: false };
  }
  
  const targetTier = getRequiredTier(feature);
  const targetTierDisplay = getTierDisplayName(targetTier);
  const targetPrice = getTierPricing(targetTier);
  const currentPrice = getTierPricing(currentTier);
  const upgradeCost = targetPrice - currentPrice;
  
  return {
    required: true,
    targetTier,
    targetTierDisplay,
    targetPrice,
    currentPrice,
    upgradeCost,
  };
}
