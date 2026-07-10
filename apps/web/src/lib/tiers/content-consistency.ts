/**
 * Content Consistency Dictionary
 * Ensures consistent terminology between /features and /settings/offerings
 */

export interface ContentMapping {
  marketingTerm: string;
  adminTerm: string;
  description: string;
  category: string;
  tier: string[];
}

export const CONTENT_MAPPINGS: ContentMapping[] = [
  // CLOVER & INVENTORY
  {
    marketingTerm: 'Clover POS Integration & Real-Time Sync',
    adminTerm: 'Clover POS integration & real-time sync',
    description: 'Automatic inventory synchronization with Clover POS for single source of truth',
    category: 'clover-inventory',
    tier: ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Real-Time Inventory Management',
    adminTerm: 'Real-time inventory tracking',
    description: 'Centralized inventory tracking with live updates and stock availability indicators',
    category: 'clover-inventory',
    tier: ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'SKU Scanning + Inventory Intelligence',
    adminTerm: 'SKU scanning + inventory intelligence',
    description: 'Complete product data capture with nutrition facts, allergens, and analytics',
    category: 'clover-inventory',
    tier: ['ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Quick Start Wizard',
    adminTerm: 'Quick Start Wizard',
    description: 'Generate 50-100 realistic products in seconds with auto-categorization',
    category: 'clover-inventory',
    tier: ['ecommerce', 'omnichannel', 'organization', 'enterprise']
  },

  // GOOGLE VISIBILITY
  {
    marketingTerm: 'Full Google Business Profile Integration',
    adminTerm: 'Full Google Business Profile & Shopping suite',
    description: 'Complete GMB sync with categories, hours, photos, and products',
    category: 'google-visibility',
    tier: ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Google Search & Shopping Optimization',
    adminTerm: 'Google Search indexing',
    description: 'SEO-optimized pages that appear in Google Search and Shopping',
    category: 'google-visibility',
    tier: ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Google Maps & SWIS (See What\'s In Store)',
    adminTerm: 'Google Maps / SWIS',
    description: 'Live inventory shown on Google Maps mobile',
    category: 'google-visibility',
    tier: ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },

  // PLATFORM PRESENCE
  {
    marketingTerm: 'Branded Public Storefront',
    adminTerm: 'Branded storefront page',
    description: 'Complete branded store presence hosted on the platform',
    category: 'platform-presence',
    tier: ['storefront', 'commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Smart Product Categories',
    adminTerm: 'Smart Categories + GMB Sync',
    description: 'Google Product Taxonomy with 5,595 categories and auto-categorization',
    category: 'platform-presence',
    tier: ['storefront', 'commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Smart Business Hours',
    adminTerm: 'Business Hours Sync',
    description: 'Complex scheduling with multiple periods and real-time status',
    category: 'platform-presence',
    tier: ['storefront', 'commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Platform Directory & Discovery',
    adminTerm: 'Directory listing',
    description: 'Enhanced directory listings with shopper inquiry system',
    category: 'platform-presence',
    tier: ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'QR Code Marketing & Sharing',
    adminTerm: 'QR codes (product, storefront, directory)',
    description: 'High-res QR codes for products, storefront, and directory',
    category: 'platform-presence',
    tier: ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },

  // COMMERCE & CONVERSION
  {
    marketingTerm: 'Add to Cart & Checkout Flow',
    adminTerm: 'Add to cart',
    description: 'Complete shopping experience with cart management',
    category: 'commerce-conversion',
    tier: ['commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Commitment Commerce - Holding Deposits',
    adminTerm: 'Holding / commitment fee (10–15%)',
    description: '10-15% holding deposits to capture shopper intent',
    category: 'commerce-conversion',
    tier: ['commitment', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Click & Collect / BOPIS',
    adminTerm: 'Reserve / BOPIS / click & collect',
    description: 'Buy online, pick up in store with scheduling',
    category: 'commerce-conversion',
    tier: ['commitment', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Full Online Payment Collection',
    adminTerm: 'Full online payment collection',
    description: 'Complete e-commerce payments with multiple methods',
    category: 'commerce-conversion',
    tier: ['ecommerce', 'omnichannel', 'organization', 'enterprise']
  },

  // MANAGEMENT & GROWTH
  {
    marketingTerm: 'Analytics & Conversion Reporting',
    adminTerm: 'Conversion analytics & reporting',
    description: 'Track reservations, pickups, abandonment, and revenue',
    category: 'management-growth',
    tier: ['commitment', 'ecommerce', 'omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Multi-Location Management',
    adminTerm: 'Multi-location support',
    description: 'Manage all locations with propagation and testing',
    category: 'management-growth',
    tier: ['organization', 'enterprise']
  },
  {
    marketingTerm: 'API Access & Custom Integrations',
    adminTerm: 'API access & custom integrations',
    description: 'Advanced API access for custom integrations',
    category: 'management-growth',
    tier: ['omnichannel', 'organization', 'enterprise']
  },
  {
    marketingTerm: 'Enterprise Security & Compliance',
    adminTerm: 'Enterprise security & compliance',
    description: 'Bank-level security with role-based access and audit logs',
    category: 'management-growth',
    tier: ['organization', 'enterprise']
  }
];

// Tier progression consistency
export const TIER_PROGRESSIONS = {
  discovery: {
    identity: 'I exist online',
    realization: 'People are finding my products on Google',
    upgradeTrigger: 'Now I want them to find my whole store',
    tagline: 'Get Found on Google'
  },
  storefront: {
    identity: 'I have a store online',
    realization: 'Shoppers are browsing — but can\'t act on it',
    upgradeTrigger: 'I want shoppers to commit to buying',
    tagline: 'Own Your Platform Presence'
  },
  commitment: {
    identity: 'I drive foot traffic',
    realization: 'Shoppers reserve and show up — but some want to pay fully online',
    upgradeTrigger: 'I want to close the full sale online OR I\'m online-only',
    tagline: 'Capture Intent and Drive Foot Traffic'
  },
  ecommerce: {
    identity: 'I sell online',
    realization: 'I\'m selling online successfully — now I want to add physical pickup',
    upgradeTrigger: 'I have a physical store AND online sales',
    tagline: 'Sell Online — Fully & Simply'
  },
  omnichannel: {
    identity: 'I sell everywhere',
    realization: 'I have everything I need for all sales models',
    upgradeTrigger: 'I want advanced features and multi-location support',
    tagline: 'Physical + Online — Unified Commerce'
  },
  enterprise: {
    identity: 'I run a business empire',
    realization: 'I have enterprise-grade tools and support',
    upgradeTrigger: 'Growth, scale, and advanced business needs',
    tagline: 'Complete Business Solution'
  },
  organization: {
    identity: 'I manage a multi-location organization',
    realization: 'I have centralized control and propagation across all locations',
    upgradeTrigger: 'Scale to enterprise-grade tools and dedicated support',
    tagline: 'Franchise & Multi-Location Control'
  }
} as const;

// Category consistency
export const CATEGORY_DESCRIPTIONS = {
  'clover-inventory': 'Single source of truth for all your products',
  'google-visibility': 'Get discovered on Search, Shopping & Maps',
  'platform-presence': 'Your store inside the Visible Shelf marketplace',
  'commerce-conversion': 'From browsing to buying and fulfillment',
  'management-growth': 'Analytics, multi-location & advanced features'
} as const;

// Helper functions
export function getAdminTerm(marketingTerm: string): string {
  const mapping = CONTENT_MAPPINGS.find(m => m.marketingTerm === marketingTerm);
  return mapping?.adminTerm || marketingTerm;
}

export function getMarketingTerm(adminTerm: string): string {
  const mapping = CONTENT_MAPPINGS.find(m => m.adminTerm === adminTerm);
  return mapping?.marketingTerm || adminTerm;
}

export function getTierProgression(tier: string) {
  return TIER_PROGRESSIONS[tier as keyof typeof TIER_PROGRESSIONS] || null;
}

export function getCategoryDescription(category: string): string {
  return CATEGORY_DESCRIPTIONS[category as keyof typeof CATEGORY_DESCRIPTIONS] || '';
}

export function validateContentConsistency(marketingFeatures: string[], adminFeatures: string[]): {
  consistent: string[];
  inconsistent: { marketing: string; admin: string | null }[];
  missing: string[];
} {
  const consistent: string[] = [];
  const inconsistent: { marketing: string; admin: string | null }[] = [];
  const missing: string[] = [];

  marketingFeatures.forEach(marketing => {
    const admin = getAdminTerm(marketing);
    if (adminFeatures.includes(admin)) {
      consistent.push(marketing);
    } else {
      inconsistent.push({ marketing, admin: adminFeatures.find(f => f.includes(marketing.toLowerCase())) || null });
    }
  });

  adminFeatures.forEach(admin => {
    const marketing = getMarketingTerm(admin);
    if (!marketingFeatures.includes(marketing)) {
      missing.push(admin);
    }
  });

  return { consistent, inconsistent, missing };
}
