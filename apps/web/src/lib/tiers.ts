/**
 * Subscription tier definitions and limits
 * Centralized tier configuration for the platform
 */

export type SubscriptionTier = 'trial' | 'google_only' | 'starter' | 'professional' | 'enterprise' | 'organization';

export interface TierLimits {
  name: string;
  price: string;
  pricePerMonth: number;
  maxSKUs: number;
  maxLocations: number;
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
    maxLocations: 1,
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
    price: '$49/month',
    pricePerMonth: 49,
    maxSKUs: 500,
    maxLocations: 3,
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
    price: '$499/month',
    pricePerMonth: 499,
    maxSKUs: 5000,
    maxLocations: 10,
    description: 'For established retail businesses',
    features: [
      '5,000 SKUs (10x Starter)',
      'Everything in Starter',
      'Google Business Profile integration',
      '1024px QR codes (print-ready)',
      'Custom branding & logo',
      'Custom marketing copy',
      'Image galleries (5 photos)',
      'Interactive store location maps',
      'Privacy mode for location display',
      'Custom CTAs & social links',
      'Saves $2,400/mo in labor costs',
      'Priority support',
    ],
    color: 'bg-purple-100 text-purple-900',
  },
  enterprise: {
    name: 'Enterprise',
    price: '$999/month',
    pricePerMonth: 999,
    maxSKUs: Infinity,
    maxLocations: 25,
    description: 'For large single-location operations',
    features: [
      'Unlimited SKUs',
      'Everything in Professional',
      'Complete white-label storefront',
      '2048px QR codes (billboard-ready)',
      'Image galleries (10 photos)',
      'Advanced analytics',
      'Custom domain support',
      'API access for integrations',
      'Dedicated account manager',
      'SLA guarantee',
      '50% cheaper than Shopify Plus',
    ],
    color: 'bg-amber-100 text-amber-900',
  },
  organization: {
    name: 'Organization',
    price: '$999/month',
    pricePerMonth: 999,
    maxSKUs: 10000, // Shared pool across all locations
    maxLocations: Infinity,
    description: 'For franchise chains & multi-location businesses',
    features: [
      '10,000 shared SKUs across all locations',
      'Unlimited locations (80% savings vs per-location)',
      '8 propagation types (chain-wide control)',
      'Organization dashboard with analytics',
      'Hero location management',
      'GBP category sync (test on 1 or sync to all)',
      'Centralized business hours & profile',
      'Feature flags & user roles',
      'Brand asset distribution',
      'Chain-wide reporting',
      'API access',
      'Priority support',
      '95% cheaper than Shopify Plus for chains',
    ],
    color: 'bg-gradient-to-br from-purple-500 to-pink-600 text-white',
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
