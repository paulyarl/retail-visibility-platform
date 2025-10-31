/**
 * Subscription tier definitions and limits
 * Centralized tier configuration for the platform
 */

export type SubscriptionTier = 'trial' | 'google_only' | 'starter' | 'professional' | 'enterprise';

export interface TierLimits {
  name: string;
  price: string;
  pricePerMonth: number;
  maxSKUs: number;
  description: string;
  features: string[];
  color: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  trial: {
    name: 'Trial',
    price: 'Free',
    pricePerMonth: 0,
    maxSKUs: 500,
    description: 'Try the platform with basic features',
    features: [
      '500 SKUs',
      'Google Shopping integration',
      '512px QR codes',
      'Basic product pages',
      'Performance analytics',
    ],
    color: 'bg-neutral-100 text-neutral-900',
  },
  google_only: {
    name: 'Google-Only',
    price: '$29/month',
    pricePerMonth: 29,
    maxSKUs: 250,
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
    price: '$49/month',
    pricePerMonth: 49,
    maxSKUs: 500,
    description: 'Get started with the basics',
    features: [
      '500 SKUs',
      'Public storefront with product catalog',
      'Product search functionality',
      '512px QR codes',
      'Google Shopping feeds',
      'Basic product pages',
      'Platform branding',
    ],
    color: 'bg-blue-100 text-blue-900',
  },
  professional: {
    name: 'Professional',
    price: '$149/month',
    pricePerMonth: 149,
    maxSKUs: 2000,
    description: 'Everything you need to grow',
    features: [
      '2,000 SKUs',
      'Everything in Starter',
      '1024px QR codes (print-ready)',
      'Custom branding & logo',
      'Custom marketing copy',
      'Image galleries (5 photos)',
      'Interactive store location maps',
      'Privacy mode for location display',
      'Custom CTAs & social links',
      'Priority support',
    ],
    color: 'bg-purple-100 text-purple-900',
  },
  enterprise: {
    name: 'Enterprise',
    price: '$299/month',
    pricePerMonth: 299,
    maxSKUs: 10000,
    description: 'Maximum features and customization',
    features: [
      '10,000 SKUs',
      'Everything in Professional',
      '2048px QR codes (billboard-ready)',
      'Remove platform branding',
      'White-label storefront',
      'Image galleries (10 photos)',
      'Advanced analytics',
      'Custom domain support',
      'API access',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    color: 'bg-amber-100 text-amber-900',
  },
};

/**
 * Get tier information
 */
export function getTierInfo(tier: SubscriptionTier | string | null | undefined): TierLimits {
  const normalizedTier = (tier?.toLowerCase() || 'trial') as SubscriptionTier;
  return TIER_LIMITS[normalizedTier] || TIER_LIMITS.trial;
}

/**
 * Check if a tier allows a certain number of SKUs
 */
export function canAddSKUs(tier: SubscriptionTier | string | null | undefined, currentCount: number, toAdd: number = 1): boolean {
  const tierInfo = getTierInfo(tier);
  if (tierInfo.maxSKUs === Infinity) return true;
  return (currentCount + toAdd) <= tierInfo.maxSKUs;
}

/**
 * Get SKU limit for a tier
 */
export function getSKULimit(tier: SubscriptionTier | string | null | undefined): number {
  return getTierInfo(tier).maxSKUs;
}

/**
 * Check if upgrade is needed based on SKU count
 */
export function needsUpgrade(tier: SubscriptionTier | string | null | undefined, currentCount: number): boolean {
  const tierInfo = getTierInfo(tier);
  if (tierInfo.maxSKUs === Infinity) return false;
  return currentCount >= tierInfo.maxSKUs;
}

/**
 * Get recommended tier based on SKU count
 */
export function getRecommendedTier(skuCount: number): SubscriptionTier {
  if (skuCount <= 250) return 'google_only';
  if (skuCount <= 500) return 'starter';
  if (skuCount <= 2000) return 'professional';
  return 'enterprise';
}
