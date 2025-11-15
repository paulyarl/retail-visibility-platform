/**
 * Tier Limits Utility
 * 
 * Centralized tier limit definitions for the API
 * Must match frontend definitions in apps/web/src/lib/tiers.ts
 * 
 * NOTE: Trial is a STATUS, not a tier. This utility only models actual tiers.
 */

export type SubscriptionTier = 'google_only' | 'starter' | 'professional' | 'enterprise' | 'organization';

export interface TierLimits {
  maxSKUs: number;
  name: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  google_only: {
    name: 'Google-Only',
    maxSKUs: 250,
  },
  starter: {
    name: 'Starter',
    maxSKUs: 500,
  },
  professional: {
    name: 'Professional',
    maxSKUs: 5000, // Updated from 2000 to 5000
  },
  enterprise: {
    name: 'Enterprise',
    maxSKUs: Infinity, // Unlimited SKUs
  },
  organization: {
    name: 'Organization',
    maxSKUs: 10000, // Shared pool across all locations
  },
};

/**
 * Get SKU limit for a tier
 */
export function getSKULimit(tier: string | null | undefined): number {
  const normalizedTier = (tier?.toLowerCase() || 'starter') as SubscriptionTier;
  return TIER_LIMITS[normalizedTier]?.maxSKUs || TIER_LIMITS.starter.maxSKUs;
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
 */
export function getTierInfo(tier: string | null | undefined): TierLimits {
  const normalizedTier = (tier?.toLowerCase() || 'starter') as SubscriptionTier;
  return TIER_LIMITS[normalizedTier] || TIER_LIMITS.starter;
}
