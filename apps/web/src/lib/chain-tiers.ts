/**
 * Chain/Organization pricing tiers
 * For multi-location businesses, franchises, and chains
 */

export type ChainTier = 'chain_starter' | 'chain_professional' | 'chain_enterprise';

export interface ChainTierLimits {
  name: string;
  price: string;
  pricePerMonth: number;
  maxLocations: number;
  maxTotalSKUs: number;
  features: string[];
  color: string;
}

export const CHAIN_TIERS: Record<ChainTier, ChainTierLimits> = {
  chain_starter: {
    name: 'Chain Starter',
    price: '$199/month',
    pricePerMonth: 199,
    maxLocations: 5,
    maxTotalSKUs: 2500,
    features: [
      '5 locations included',
      '2,500 SKUs shared across all locations',
      'Professional features for all locations',
      'Centralized billing',
      'Shared SKU pool',
      'Multi-location management',
    ],
    color: 'bg-blue-100 text-blue-800',
  },
  chain_professional: {
    name: 'Chain Professional',
    price: '$499/month',
    pricePerMonth: 499,
    maxLocations: 15,
    maxTotalSKUs: 25000,
    features: [
      '15 locations included',
      '25,000 SKUs shared across all locations',
      'Professional features for all locations',
      'Centralized billing',
      'Shared SKU pool',
      'Multi-location management',
      'Priority support',
      'Custom branding across all locations',
    ],
    color: 'bg-purple-100 text-purple-800',
  },
  chain_enterprise: {
    name: 'Chain Enterprise',
    price: '$899/month',
    pricePerMonth: 899,
    maxLocations: Infinity,
    maxTotalSKUs: Infinity,
    features: [
      'Unlimited locations',
      'Unlimited SKUs',
      'Enterprise features for all locations',
      'White-label across all locations',
      'Centralized billing',
      'Shared SKU pool',
      'Multi-location management',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    color: 'bg-amber-100 text-amber-800',
  },
};

/**
 * Get effective tier for a tenant
 * If tenant is part of an organization, use org tier
 * Otherwise use tenant's own tier
 */
export function getEffectiveTier(tenant: {
  subscriptionTier?: string;
  organization?: {
    subscriptionTier?: string;
  } | null;
}): string {
  if (tenant.organization?.subscriptionTier) {
    // Part of chain - use org tier
    return tenant.organization.subscriptionTier;
  }
  // Standalone - use own tier
  return tenant.subscriptionTier || 'trial';
}

/**
 * Check if a tier is a chain tier
 */
export function isChainTier(tier: string): tier is ChainTier {
  return tier.startsWith('chain_');
}

/**
 * Get chain tier limits
 */
export function getChainTierLimits(tier: ChainTier): ChainTierLimits {
  return CHAIN_TIERS[tier];
}

/**
 * Calculate total SKUs used across all locations in a chain
 */
export function calculateChainSKUUsage(locations: Array<{ _count: { items: number } }>): number {
  return locations.reduce((total, location) => total + location._count.items, 0);
}

/**
 * Pricing comparison: Individual vs Chain
 */
export function calculateSavings(numLocations: number, individualTier: 'starter' | 'professional' | 'enterprise'): {
  individualCost: number;
  chainCost: number;
  savings: number;
  savingsPercent: number;
  recommendedChainTier: ChainTier;
} {
  const individualPrices = {
    starter: 49,
    professional: 149,
    enterprise: 299, // updated price
  };

  const individualCost = numLocations * individualPrices[individualTier];

  // Recommend chain tier based on number of locations
  let recommendedChainTier: ChainTier;
  if (numLocations <= 5) {
    recommendedChainTier = 'chain_starter';
  } else if (numLocations <= 15) {
    recommendedChainTier = 'chain_professional';
  } else {
    recommendedChainTier = 'chain_enterprise';
  }

  const chainCost = CHAIN_TIERS[recommendedChainTier].pricePerMonth;
  const savings = individualCost - chainCost;
  const savingsPercent = Math.round((savings / individualCost) * 100);

  return {
    individualCost,
    chainCost,
    savings,
    savingsPercent,
    recommendedChainTier,
  };
}
