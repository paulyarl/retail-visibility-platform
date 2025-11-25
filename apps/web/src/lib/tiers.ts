/**
 * Subscription tier definitions and limits
 * Centralized tier configuration for the platform
 *
 * NOTE: Trial is a STATUS, not a tier. This type only models actual tiers.
 */

export type SubscriptionTier = 'google_only' | 'starter' | 'professional' | 'enterprise' | 'organization';

export interface TierLimits {
  name: string;
  price: string;
  pricePerMonth: number;
  maxSkus: number;
  maxLocations: number;
  description: string;
  features: string[];
  color: string;
}

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
