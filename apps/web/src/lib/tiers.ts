/**
 * Subscription tier definitions and limits
 * Centralized tier configuration for the platform
 *
 * Trial wrappers (trial_*) provide full tier benefits during 14-day trial period.
 * expired_trial is a virtual tier for tenants who didn't convert after trial+grace period.
 */

export type SubscriptionTier =
  | 'google_only' | 'starter' | 'professional' | 'enterprise' | 'organization'
  | 'trial_google_only' | 'trial_starter' | 'trial_professional' | 'trial_chain_starter'
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
export const TRIAL_ELIGIBLE_TIERS = ['google_only', 'starter', 'professional', 'chain_starter'] as const;
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
  professional: {
    name: 'Professional',
    price: '$99/month',
    pricePerMonth: 99,
    maxSkus: 5000,
    maxLocations: 10,
    description: 'Connected & growing retailers (POS + intelligence)',
    features: [
      'Up to 10 locations',
      'Up to 5,000 SKUs per location',
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
  enterprise: {
    name: 'Enterprise',
    price: '$499/month',
    pricePerMonth: 499,
    maxSkus: Infinity,
    maxLocations: 25,
    description: 'Full connector + AI automation (up to ~25 locations)',
    features: [
      'Up to 25 locations',
      'Effectively unlimited SKUs for most SMBs',
      'Everything in Professional',
      'API access & custom integrations',
      'Advanced chain management with hero-location testing',
      'White-label storefront & custom branding',
      'AI-assisted product enrichment & copy',
      'Dedicated account manager',
      'SLA guarantees',
    ],
    color: 'bg-amber-100 text-amber-900',
  },
  organization: {
    name: 'Organization',
    price: 'Custom',
    pricePerMonth: 0,
    maxSkus: Infinity,
    maxLocations: Infinity,
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
    price: 'Free (14 days)',
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
    price: 'Free (14 days)',
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
  trial_professional: {
    name: 'Trial: Professional',
    price: 'Free (14 days)',
    pricePerMonth: 0,
    maxSkus: 5000,
    maxLocations: 10,
    description: '14-day trial of Professional tier',
    features: [
      'Up to 10 locations',
      'Up to 5,000 SKUs per location',
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
    price: 'Free (14 days)',
    pricePerMonth: 0,
    maxSkus: 2000,
    maxLocations: 5,
    description: '14-day trial of Chain Starter (organization)',
    features: [
      'Up to 5 locations',
      'Up to 2,000 SKUs',
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
  if (skuCount <= 500) return 'starter';
  if (skuCount <= 5000) return 'professional';
  if (skuCount <= 10000) return 'enterprise';
  return 'organization';
}
