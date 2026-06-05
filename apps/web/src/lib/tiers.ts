/**
 * Subscription tier definitions and limits
 * Centralized tier configuration for the platform
 *
 * Trial wrappers (trial_*) provide full tier benefits during 14-day trial period.
 * expired_trial is a virtual tier for tenants who didn't convert after trial+grace period.
 */

export type SubscriptionTier =
  | 'google_only' | 'starter' | 'discovery' | 'commitment' | 'ecommerce' | 'omnichannel' | 'professional' | 'storefront' | 'enterprise' | 'organization' | 'chain_starter'
  | 'trial_google_only' | 'trial_starter' | 'trial_discovery'| 'trial_storefront' | 'trial_chain_starter' | 'trial_commitment' | 'trial_professional' | 'trial_storefront' | 'trial_ecommerce' | 'trial_omnichannel'
  | 'expired_trial';

export interface TierLimits {
  name: string;
  price: string;
  pricePerMonth: number;
  maxSkus: number;
  maxLocations: number;
  description: string;
  features: string[];
  color: string;
  isTrial?: boolean;
  isExpired?: boolean;
  trialTarget?: string;
}

// Trial-eligible tiers (can be wrapped in trial_*)
export const TRIAL_ELIGIBLE_TIERS = ['google_only', 'starter', 'discovery', 'commitment', 'storefront', 'chain_starter'] as const;
export type TrialEligibleTier = typeof TRIAL_ELIGIBLE_TIERS[number];

// Trial duration constants
export const TRIAL_DURATION_DAYS = 14;
export const GRACE_DURATION_DAYS = 14;
export const TOTAL_TRIAL_DAYS = TRIAL_DURATION_DAYS + GRACE_DURATION_DAYS; // 30 days

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  google_only: {
    name: 'Google-Only',
    price: '$29/month',
    pricePerMonth: 29,
    maxSkus: 250,
    maxLocations: 1,
    description: 'Get discovered on Google',
    features: [
      '250 SKUs',
      'Google Shopping feeds',
      'Google Merchant Center sync',
      '512px QR codes',
      'Basic product pages',
      'Performance analytics',
      'No storefront',
    ],
    color: 'bg-green-100 text-green-900',
  },
  starter: {
    name: 'Starter',
    price: '$29/month',
    pricePerMonth: 29,
    maxSkus: 500,
    maxLocations: 3,
    description: 'Core visibility and storefront for small retailers',
    features: [
      'Up to 3 locations',
      'Up to 500 SKUs per location',
      'Storefront with product catalog & search',
      'Directory listing',
      'Google Shopping feeds & Merchant Center sync',
      'Basic barcode scanner + manual entry',
      'Basic product enrichment',
      'QR codes & basic analytics',
    ],
    color: 'bg-blue-100 text-blue-900',
  },
  discovery: {
    name: 'Discovery',
    price: '$29/month',
    pricePerMonth: 29,
    maxSkus: 100,
    maxLocations: 2,
    description: 'Discover new products and expand your catalog',
    features: [
      'Up to 2 locations',
      'Up to 100 SKUs per location',
      'Product discovery tools',
      'Advanced analytics',
      'Priority support',
    ],
    color: 'bg-purple-100 text-purple-900',
  },
  commitment: {
    name: 'Commitment',
    price: '$79/month',
    pricePerMonth: 79,
    maxSkus: 500,
    maxLocations: 2,
    description: 'Deposit-based commerce to drive foot traffic',
    features: [
      'Up to 2 locations',
      'Up to 500 SKUs per location',
      'Deposit-based checkout',
      'Store pickup & BOPIS',
      'Enhanced analytics',
      'Priority support',
    ],
    color: 'bg-green-100 text-green-900',
  },
  ecommerce: {
    name: 'E-commerce',
    price: '$99/month',
    pricePerMonth: 99,
    maxSkus: 1000,
    maxLocations: 3,
    description: 'Full online payment processing and delivery',
    features: [
      'Up to 3 locations',
      'Up to 1000 SKUs per location',
      'Full payment checkout',
      'Delivery & shipping',
      'Order management',
      'Enhanced analytics',
      'Priority support',
    ],
    color: 'bg-cyan-100 text-cyan-900',
  },
  omnichannel: {
    name: 'Omnichannel',
    price: '$149/month',
    pricePerMonth: 149,
    maxSkus: 2000,
    maxLocations: 10,
    description: 'Multi-channel retail with flexible payment options',
    features: [
      'Up to 10 locations',
      'Up to 2000 SKUs per location',
      'Flexible payment (deposit or full)',
      'Delivery & shipping',
      'Advanced analytics',
      'API access',
      'Priority support',
    ],
    color: 'bg-indigo-100 text-indigo-900',
  },
  storefront: {
    name: 'Storefront',
    price: '$59/month',
    pricePerMonth: 59,
    maxSkus: 250,
    maxLocations: 1,
    description: 'Connected & growing retailers (POS + intelligence)',
    features: [
      'Up to 1 location',
      'Up to 250 SKUs per location',
      'Quick Start Wizard (50–100 products in seconds)',
      'SKU scanning + inventory intelligence',
      'Full Google Business Profile & Shopping suite',
      'Clover + Square POS integration',
      'Advanced analytics & bulk operations',
      'CSV import/export & higher enrichment quotas',
      'Priority support',
    ],
    color: 'bg-purple-100 text-purple-900',
  },
  professional: {
    name: 'Professional',
    price: '$199/month',
    pricePerMonth: 199,
    maxSkus: 750,
    maxLocations: 15,
    description: 'Professional retailers with advanced needs',
    features: [
      'Up to 2 locations',
      'Up to 750 SKUs per location',
      'Advanced product discovery',
      'Enhanced analytics',
      'Priority support',
    ],
    color: 'bg-orange-100 text-orange-900',
  },
  chain_starter: {
    name: 'Chain Starter',
    price: '$329/month',
    pricePerMonth: 329,
    maxSkus: 1000,
    maxLocations: 1,
    description: 'Get discovered on Google',
    features: [
      '1000 SKUs',
      'Google Shopping feeds',
      'Google Merchant Center sync',
      '512px QR codes',
      'Basic product pages',
      'Performance analytics',
      'No storefront',
    ],
    color: 'bg-green-100 text-green-900',
  },
  enterprise: {
    name: 'Enterprise',
    price: '$499/month',
    pricePerMonth: 499,
    maxSkus: 1000,
    maxLocations: 2,
    description: 'Full connector + AI automation (up to ~25 locations)',
    features: [
      'Up to 2 locations',
      'Up to 1000 SKUs per location',
      'Everything in Professional',
      'API access & custom integrations',
      'Advanced chain management with hero-location testing',
    ],
    color: 'bg-amber-100 text-amber-900',
  },
  organization: {
    name: 'Organization',
    price: 'Custom',
    pricePerMonth: 0,
    maxSkus: 1000,
    maxLocations: 2,
    description: 'For chains & franchises with 25+ locations',
    features: [
      'Everything in Enterprise',
      'Unlimited locations & SKUs (within technical limits)',
      'Full chain management & multi-type propagation',
      'Hero location & brand asset distribution',
      'Organization-level dashboard & analytics',
      'Organization-level billing',
      'Custom contracts & pricing',
    ],
    color: 'bg-emerald-100 text-emerald-900',
  },

  // Trial wrapper tiers - provide full tier benefits during trial
  trial_google_only: {
    name: 'Trial: Google-Only',
    price: 'Free / 14-day',
    pricePerMonth: 0,
    maxSkus: 250,
    maxLocations: 1,
    description: '14-day trial of Google-Only tier',
    features: [
      '250 SKUs',
      'Google Shopping feeds',
      'Google Merchant Center sync',
      '512px QR codes',
      'Basic product pages',
      'Performance analytics',
      'No storefront',
    ],
    color: 'bg-green-100 text-green-900 border-2 border-green-500',
    isTrial: true,
    trialTarget: 'google_only',
  },
  trial_starter: {
    name: 'Trial: Starter',
    price: 'Free / 14-day',
    pricePerMonth: 0,
    maxSkus: 500,
    maxLocations: 3,
    description: '14-day trial of Starter tier',
    features: [
      'Up to 3 locations',
      'Up to 500 SKUs per location',
      'Storefront with product catalog & search',
      'Directory listing',
      'Google Shopping feeds & Merchant Center sync',
      'Basic barcode scanner + manual entry',
      'Basic product enrichment',
      'QR codes & basic analytics',
    ],
    color: 'bg-blue-100 text-blue-900 border-2 border-blue-500',
    isTrial: true,
    trialTarget: 'starter',
  },
  trial_discovery: {
    name: 'Trial: Discovery',
    price: 'Free / 14-day',
    pricePerMonth: 0,
    maxSkus: 500,
    maxLocations: 3,
    description: '14-day trial of Discovery tier',
    features: [
      'Up to 3 locations',
      'Up to 500 SKUs per location',
      'Storefront with product catalog & search',
      'Directory listing',
      'Google Shopping feeds & Merchant Center sync',
      'Basic barcode scanner + manual entry',
      'Basic product enrichment',
      'QR codes & basic analytics',
    ],
    color: 'bg-blue-100 text-blue-900 border-2 border-blue-500',
    isTrial: true,
    trialTarget: 'discovery',
  },
  trial_storefront: {
    name: 'Trial: Storefront',
    price: 'Free / 14-day',
    pricePerMonth: 0,
    maxSkus: 500,
    maxLocations: 3,
    description: '14-day trial of Storefront tier',
    features: [
      'Up to 3 locations',
      'Up to 500 SKUs per location',
      'Storefront with product catalog & search',
      'Directory listing',
      'Google Shopping feeds & Merchant Center sync',
      'Basic barcode scanner + manual entry',
      'Basic product enrichment',
      'QR codes & basic analytics',
    ],
    color: 'bg-blue-100 text-blue-900 border-2 border-blue-500',
    isTrial: true,
    trialTarget: 'storefront',
  },
  trial_commitment: {
    name: 'Trial: Commitment',
    price: 'Free / 14-day',
    pricePerMonth: 0,
    maxSkus: 500,
    maxLocations: 3,
    description: '14-day trial of Commitment tier',
    features: [
      'Up to 3 locations',
      'Up to 500 SKUs per location',
      'Storefront with product catalog & search',
      'Directory listing',
      'Google Shopping feeds & Merchant Center sync',
      'Basic barcode scanner + manual entry',
      'Basic product enrichment',
      'QR codes & basic analytics',
    ],
    color: 'bg-blue-100 text-blue-900 border-2 border-blue-500',
    isTrial: true,
    trialTarget: 'commitment',
  },
  trial_ecommerce: {
    name: 'Trial: E-commerce',
    price: 'Free / 14-day',
    pricePerMonth: 0,
    maxSkus: 1000,
    maxLocations: 3,
    description: '14-day trial of E-commerce tier',
    features: [
      'Up to 3 locations',
      'Up to 1000 SKUs per location',
      'Full payment checkout',
      'Delivery & shipping',
      'Order management',
      'Enhanced analytics',
      'Priority support',
    ],
    color: 'bg-cyan-100 text-cyan-900 border-2 border-cyan-500',
    isTrial: true,
    trialTarget: 'ecommerce',
  },
  trial_omnichannel: {
    name: 'Trial: Omnichannel',
    price: 'Free / 14-day',
    pricePerMonth: 0,
    maxSkus: 2000,
    maxLocations: 10,
    description: '14-day trial of Omnichannel tier',
    features: [
      'Up to 10 locations',
      'Up to 2000 SKUs per location',
      'Flexible payment (deposit or full)',
      'Delivery & shipping',
      'Advanced analytics',
      'API access',
      'Priority support',
    ],
    color: 'bg-indigo-100 text-indigo-900 border-2 border-indigo-500',
    isTrial: true,
    trialTarget: 'omnichannel',
  },
  
  trial_professional: {
    name: 'Trial: Professional',
    price: 'Free / 14-day',
    pricePerMonth: 0,
    maxSkus: 750,
    maxLocations: 15,
    description: '14-day trial of Professional tier',
    features: [
      'Up to 15 locations',
      'Up to 750 SKUs per location',
      'Quick Start Wizard (50-100 products in seconds)',
      'SKU scanning + inventory intelligence',
      'Full Google Business Profile & Shopping suite',
      'Clover + Square POS integration',
      'Advanced analytics & bulk operations',
      'CSV import/export & higher enrichment quotas',
      'Priority support',
    ],
    color: 'bg-purple-100 text-purple-900 border-2 border-purple-500',
    isTrial: true,
    trialTarget: 'professional',
  },
  trial_chain_starter: {
    name: 'Trial: Chain Starter',
    price: 'Free / 14-day',
    pricePerMonth: 0,
    maxSkus: 1000,
    maxLocations: 5,
    description: '14-day trial of Chain Starter (organization)',
    features: [
      'Up to 5 locations',
      'Up to 1000 SKUs',
      'Chain branding & management',
      'Master catalog distribution',
      'Propagation to all locations',
      'Chain analytics dashboard',
    ],
    color: 'bg-amber-100 text-amber-900 border-2 border-amber-500',
    isTrial: true,
    trialTarget: 'chain_starter',
  },

  // Expired trial - invisible on public pages
  expired_trial: {
    name: 'Trial Expired',
    price: '$0',
    pricePerMonth: 0,
    maxSkus: 0,
    maxLocations: 0,
    description: 'Trial period ended - subscription required',
    features: [],
    color: 'bg-gray-100 text-gray-500',
    isExpired: true,
  },
};

/**
 * Get tier information
 */
export function getTierInfo(tier: SubscriptionTier | string | null | undefined): TierLimits {
  const normalizedTier = (tier?.toLowerCase() || 'starter') as SubscriptionTier;
  return TIER_LIMITS[normalizedTier] || TIER_LIMITS.starter;
}

/**
 * Check if a tier allows a certain number of SKUs
 */
export function canAddSKUs(tier: SubscriptionTier | string | null | undefined, currentCount: number, toAdd: number = 1): boolean {
  const tierInfo = getTierInfo(tier);
  if (tierInfo.maxSkus === Infinity) return true;
  return (currentCount + toAdd) <= tierInfo.maxSkus;
}

/**
 * Get SKU limit for a tier
 */
export function getSKULimit(tier: SubscriptionTier | string | null | undefined): number {
  return getTierInfo(tier).maxSkus;
}

/**
 * Check if upgrade is needed based on SKU count
 */
export function needsUpgrade(tier: SubscriptionTier | string | null | undefined, currentCount: number): boolean {
  const tierInfo = getTierInfo(tier);
  if (tierInfo.maxSkus === Infinity) return false;
  return currentCount >= tierInfo.maxSkus;
}

/**
 * Get recommended tier based on SKU count
 */
export function getRecommendedTier(skuCount: number): SubscriptionTier {
  if (skuCount <= 250) return 'storefront';
  if (skuCount <= 500) return 'commitment';
  if (skuCount <= 750) return 'professional';
  if (skuCount <= 1000) return 'enterprise';
  return 'organization';
}
