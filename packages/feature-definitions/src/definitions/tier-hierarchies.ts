/**
 * Tier Hierarchies and Requirements
 * 
 * Defines tier levels and feature requirements for consistent validation.
 */

export type TierKey = 
  | 'discovery'
  | 'starter' 
  | 'storefront'
  | 'commitment'
  | 'ecommerce'
  | 'professional'
  | 'omnichannel'
  | 'enterprise';

export interface TierDefinition {
  key: TierKey;
  name: string;
  level: number;
  displayName: string;
  description: string;
  price: number;
  features: string[];
}

// Tier hierarchy (higher number = higher tier)
export const TIER_HIERARCHY: Record<TierKey, number> = {
  'discovery': 1,
  'starter': 2,
  'storefront': 3,
  'commitment': 4,
  'ecommerce': 4,      // Same level as commitment
  'professional': 5,
  'omnichannel': 5,    // Same level as professional
  'enterprise': 6
};

// Tier definitions base properties (without features)
interface TierDefinitionBase {
  key: TierKey;
  name: string;
  level: number;
  displayName: string;
  description: string;
  price: number;
}

const TIER_DEFINITIONS_BASE: Record<TierKey, TierDefinitionBase> = {
  'discovery': {
    key: 'discovery',
    name: 'Discovery',
    level: 1,
    displayName: 'Discovery',
    description: 'Try platform features with limited access',
    price: 0
  },
  
  'starter': {
    key: 'starter',
    name: 'Starter',
    level: 2,
    displayName: 'Starter',
    description: 'Basic features for small businesses',
    price: 29
  },
  
  'storefront': {
    key: 'storefront',
    name: 'Storefront',
    level: 3,
    displayName: 'Storefront',
    description: 'Enhanced storefront and marketing features',
    price: 59
  },
  
  'commitment': {
    key: 'commitment',
    name: 'Commitment',
    level: 4,
    displayName: 'Commitment',
    description: 'Advanced features with commitment pricing',
    price: 99
  },
  
  'ecommerce': {
    key: 'ecommerce',
    name: 'Ecommerce',
    level: 4,
    displayName: 'Ecommerce',
    description: 'Full e-commerce capabilities',
    price: 99
  },
  
  'professional': {
    key: 'professional',
    name: 'Professional',
    level: 5,
    displayName: 'Professional',
    description: 'Professional features for growing businesses',
    price: 199
  },
  
  'omnichannel': {
    key: 'omnichannel',
    name: 'Omnichannel',
    level: 5,
    displayName: 'Omnichannel',
    description: 'Multi-channel selling capabilities',
    price: 149
  },
  
  'enterprise': {
    key: 'enterprise',
    name: 'Enterprise',
    level: 6,
    displayName: 'Enterprise',
    description: 'Enterprise features with unlimited capabilities',
    price: 499
  }
};

// Define feature sets separately to avoid circular references
const DISCOVERY_FEATURES = ['mobile_responsive', 'basic_product_pages'];

const STARTER_FEATURES = [
  'product_management',
  'bulk_import',
  'categories',
  'storefront',
  'qr_codes',
  'quick_setup',
  'clover_sync',
  'square_sync',
  'google_shopping',
  'google_merchant_center',
  'mobile_responsive',
  'enhanced_seo'
];

const STOREFRONT_FEATURES = [
  ...STARTER_FEATURES,
  'featured_products',
  'branding_suite',
  'interactive_maps',
  'privacy_mode',
  'conversion_tracking'
];

const COMMITMENT_FEATURES = [
  ...STOREFRONT_FEATURES,
  'commerce',
  'delivery_options',
  'order_tracking',
  'analytics'
];

const PROFESSIONAL_FEATURES = [
  ...COMMITMENT_FEATURES,
  'barcode_scanning',
  'payment_client_credentials',
  'advanced_analytics',
  'api_access',
  'custom_domain',
  'featured_expiry_monitor',
  'image_gallery' // Higher limit
];

// Now build the complete definitions
export const TIER_DEFINITIONS: Record<TierKey, TierDefinition> = {
  'discovery': {
    ...TIER_DEFINITIONS_BASE.discovery,
    features: DISCOVERY_FEATURES
  },
  
  'starter': {
    ...TIER_DEFINITIONS_BASE.starter,
    features: STARTER_FEATURES
  },
  
  'storefront': {
    ...TIER_DEFINITIONS_BASE.storefront,
    features: STOREFRONT_FEATURES
  },
  
  'commitment': {
    ...TIER_DEFINITIONS_BASE.commitment,
    features: COMMITMENT_FEATURES
  },
  
  'ecommerce': {
    ...TIER_DEFINITIONS_BASE.ecommerce,
    features: COMMITMENT_FEATURES // Same as commitment but different pricing
  },
  
  'professional': {
    ...TIER_DEFINITIONS_BASE.professional,
    features: PROFESSIONAL_FEATURES
  },
  
  'omnichannel': {
    ...TIER_DEFINITIONS_BASE.omnichannel,
    features: PROFESSIONAL_FEATURES // Same as professional but different pricing
  },
  
  'enterprise': {
    ...TIER_DEFINITIONS_BASE.enterprise,
    features: [
      ...PROFESSIONAL_FEATURES,
      'white_label',
      'unlimited_skus',
      'unlimited_locations',
      'dedicated_account_manager',
      'sla_guarantee',
      'custom_integrations',
      'priority_support'
    ]
  }
};

// Feature tier requirements
export const FEATURE_TIER_REQUIREMENTS: Record<string, number> = {
  // Product Management
  'product_management': 2,        // starter+
  'barcode_scanning': 5,         // professional+
  'bulk_import': 2,              // starter+
  'featured_products': 2,        // starter+
  'categories': 2,               // starter+
  
  // Commerce
  'commerce': 4,                 // commitment+
  'payment_client_credentials': 4, // commitment+
  'delivery_options': 5,         // professional+
  'order_tracking': 4,          // commitment+
  
  // Analytics
  'analytics': 4,                 // commitment+
  'advanced_analytics': 5,       // professional+
  'conversion_tracking': 4,       // commitment+
  
  // Branding
  'branding_suite': 5,           // professional+
  'custom_domain': 5,            // professional+
  'white_label': 6,              // enterprise+
  
  // Integration
  'clover_sync': 2,             // starter+
  'square_sync': 2,             // starter+
  'google_shopping': 2,         // starter+
  'google_merchant_center': 2,   // starter+
  'api_access': 5,              // professional+
  
  // UI/UX
  'qr_codes': 2,                // starter+
  'storefront': 2,              // starter+
  'quick_setup': 2,             // starter+
  'mobile_responsive': 1,       // discovery+
  'enhanced_seo': 2,            // starter+
  'privacy_mode': 3,             // storefront+
  'interactive_maps': 3,         // storefront+
  'image_gallery': 2,           // starter+ (tier-dependent limits)
  
  // Special features
  'unlimited_skus': 6,          // enterprise
  'unlimited_locations': 6,      // enterprise
  'dedicated_account_manager': 6, // enterprise
  'sla_guarantee': 6,           // enterprise
  'custom_integrations': 6,      // enterprise
  'priority_support': 5,        // professional+
};

// Permission types by tier
export type PermissionType = 'canView' | 'canEdit' | 'canManage' | 'canSupport' | 'canAdmin';

export const TIER_PERMISSIONS: Record<TierKey, PermissionType[]> = {
  'discovery': ['canView'],
  'starter': ['canView', 'canEdit'],
  'storefront': ['canView', 'canEdit'],
  'commitment': ['canView', 'canEdit'],
  'ecommerce': ['canView', 'canEdit'],
  'professional': ['canView', 'canEdit', 'canManage'],
  'omnichannel': ['canView', 'canEdit', 'canManage'],
  'enterprise': ['canView', 'canEdit', 'canManage', 'canSupport', 'canAdmin']
};

// Helper functions
export function getTierLevel(tierKey: TierKey): number {
  return TIER_HIERARCHY[tierKey] || 0;
}

export function getFeatureTierRequirement(featureKey: string): number {
  return FEATURE_TIER_REQUIREMENTS[featureKey] || 999;
}

export function hasFeatureTierAccess(tierKey: TierKey, featureKey: string): boolean {
  const tierLevel = getTierLevel(tierKey);
  const requiredLevel = getFeatureTierRequirement(featureKey);
  return tierLevel >= requiredLevel;
}

export function getTierPermissions(tierKey: TierKey): PermissionType[] {
  return TIER_PERMISSIONS[tierKey] || [];
}

export function hasPermission(tierKey: TierKey, permission: PermissionType): boolean {
  const permissions = getTierPermissions(tierKey);
  return permissions.includes(permission);
}

export function getUpgradePath(currentTier: TierKey, requiredFeature: string): TierKey | null {
  const requiredLevel = getFeatureTierRequirement(requiredFeature);
  const currentLevel = getTierLevel(currentTier);
  
  if (currentLevel >= requiredLevel) {
    return null; // Already has access
  }
  
  // Find the lowest tier that provides access
  const eligibleTiers = Object.entries(TIER_HIERARCHY)
    .filter(([_, level]) => level >= requiredLevel)
    .map(([key]) => key as TierKey)
    .sort((a, b) => getTierLevel(a) - getTierLevel(b));
  
  return eligibleTiers[0] || null;
}
