/**
 * Subscription tier definitions and limits
 * Centralized tier configuration for the platform
 */

export type SubscriptionTier = 'trial' | 'starter' | 'professional' | 'enterprise';

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
      'Basic landing pages',
      'Product descriptions',
      'Multi-language support',
    ],
    color: 'bg-neutral-100 text-neutral-900',
  },
  starter: {
    name: 'Starter',
    price: '$49/month',
    pricePerMonth: 49,
    maxSKUs: 500,
    description: 'Perfect for small stores getting started',
    features: [
      '500 SKUs',
      'Google Shopping integration',
      '512px QR codes',
      'Basic landing pages',
      'Product descriptions',
      'Multi-language support',
      'Email support',
    ],
    color: 'bg-blue-100 text-blue-900',
  },
  professional: {
    name: 'Professional',
    price: '$149/month',
    pricePerMonth: 149,
    maxSKUs: 5000,
    description: 'Enhanced features for growing businesses',
    features: [
      '5,000 SKUs',
      'Google Shopping integration',
      '1024px QR codes',
      'Enhanced landing pages',
      'Business logo display',
      'Custom marketing copy',
      'Image galleries (5 photos)',
      'Custom CTAs & social links',
      'Multi-language support',
      'Priority email support',
    ],
    color: 'bg-purple-100 text-purple-900',
  },
  enterprise: {
    name: 'Enterprise',
    price: '$499/month',
    pricePerMonth: 499,
    maxSKUs: Infinity,
    description: 'Full customization and white-label options',
    features: [
      'Unlimited SKUs',
      'Google Shopping integration',
      '2048px QR codes',
      'Fully custom landing pages',
      'Custom branding & colors',
      'Remove platform branding',
      'Image galleries (10 photos)',
      'Custom sections & themes',
      'Multi-language support',
      'Dedicated account manager',
      'SLA guarantee',
      'API access',
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
  if (skuCount <= 500) return 'starter';
  if (skuCount <= 5000) return 'professional';
  return 'enterprise';
}
