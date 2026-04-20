/**
 * Tier Limits Utility
 * 
 * Centralized tier limit definitions for the API
 * Must match frontend definitions in apps/web/src/lib/tiers.ts
 * 
 * NOTE: Trial tiers are wrappers that proxy to their base tiers for limits.
 */

export type SubscriptionTier = 'google_only'| 'discovery'|'storefront'|'commitment' | 'starter' | 'professional' | 'enterprise' | 'organization';

/**
 * Map trial tiers to their base tiers for limit proxying
 */
function getBaseTierForTrial(tier: string): SubscriptionTier {
  const trialToBaseMap: Record<string, SubscriptionTier> = {
    'trial_google_only': 'google_only',
    'trial_discovery': 'discovery',
    'trial_storefront': 'storefront',
    'trial_commitment': 'commitment',
    'trial_starter': 'starter',
    'trial_professional': 'professional',
    'trial_chain_starter': 'starter', // Use starter as base for chain trial
    'trial_chain_professional': 'professional',
    'trial_chain_enterprise': 'enterprise',
    'expired_trial': 'starter', // Fallback to starter for expired trials
  };
  
  return trialToBaseMap[tier] || 'discovery';
}

export interface TierLimits {
  maxSkus: number;
  name: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  google_only: {
    name: 'Google-Only',
    maxSkus: 250,
  },
  discovery: {
    name: 'Discovery',
    maxSkus: 1000,
  },
  storefront: {
    name: 'Storefront',
    maxSkus: 5000,
  },
  commitment: {
    name: 'Commitment',
    maxSkus: 10000,
  },
  starter: {
    name: 'Starter',
    maxSkus: 500,
  },
  professional: {
    name: 'Professional',
    maxSkus: 5000, // Updated from 2000 to 5000
  },
  enterprise: {
    name: 'Enterprise',
    maxSkus: Infinity, // Unlimited SKUs
  },
  organization: {
    name: 'Organization',
    maxSkus: 10000, // Shared pool across all locations
  },
};

/**
 * Get SKU limit for a tier
 * Handles trial tiers as wrappers that proxy to their base tiers
 */
export function getSKULimit(tier: string | null | undefined): number {
  if (!tier) return TIER_LIMITS.starter.maxSkus;
  
  // Handle trial tiers as wrappers - proxy to base tier
  const baseTier = getBaseTierForTrial(tier.toLowerCase());
  return TIER_LIMITS[baseTier]?.maxSkus || TIER_LIMITS.starter.maxSkus;
}

/**
 * Check if a tier allows a certain number of SKUs
 */
export function canAddSKUs(tier: string | null | undefined, currentCount: number, toAdd: number = 1): boolean {
  const limit = getSKULimit(tier);
  return (currentCount + toAdd) <= limit;
}

/**
 * Get tier information
 * Handles trial tiers as wrappers that proxy to their base tiers
 */
export function getTierInfo(tier: string | null | undefined): TierLimits {
  if (!tier) return TIER_LIMITS.starter;
  
  // Handle trial tiers as wrappers - proxy to base tier
  const baseTier = getBaseTierForTrial(tier.toLowerCase());
  return TIER_LIMITS[baseTier] || TIER_LIMITS.starter;
}
