/**
 * Tier Limits Utility
 * 
 * Centralized tier limit definitions for the API
 * Must match frontend definitions in apps/web/src/lib/tiers.ts
 * 
 * NOTE: Trial tiers are wrappers that proxy to their base tiers for limits.
 */

import { DEFAULT_TIER } from './tier-defaults';

export type SubscriptionTier = 'directory_presence'|'google_only'|'presence'| 'discovery'|'storefront'|'commitment' | 'ecommerce' | 'omnichannel' | 'starter' | 'professional' | 'enterprise' | 'organization' | 'seed_preview';

/**
 * Map trial tiers to their base tiers **for limit proxying**.
 *
 * Renamed from `getBaseTierForTrial` (2026-10-16): `trial-tier-transparency.ts`
 * has a same-named private function with a DIFFERENT map, and the two answer
 * different questions —
 *
 *   - here:  what SKU/location LIMIT does this trial tier proxy to?
 *   - there: how should this trial tier PRESENT to the frontend?
 *
 * They diverge on `expired_trial` on purpose. Here it proxies to `presence`
 * (whose `maxSkus` is legitimately 0 — directory mode, no catalog). There it is
 * deliberately absent, so an expired trial presents as ITSELF rather than as a
 * free tier. Neither is stale; treating either as a copy of the other would
 * "fix" a deliberate design. See `TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md` H2.
 *
 * Exported for the Phase 1.6 contract test: asserted against
 * `shared/tier-contract.json` → `trial_map`. The chain_* → display-twin
 * entries and `expired_trial` are the fixture's `site_exceptions.tier-limits`:
 * `TIER_LIMITS` has no chain_* rows, so a chain trial resolving to its chain
 * key would fall through to the 'discovery' 75-SKU default.
 */
export const LIMIT_TRIAL_BASE_TIERS: Record<string, SubscriptionTier> = {
  'trial_google_only': 'google_only',
  'trial_directory_presence': 'directory_presence',
  'trial_presence': 'presence',
  'trial_discovery': 'discovery',
  'trial_storefront': 'storefront',
  'trial_commitment': 'commitment',
  'trial_ecommerce': 'ecommerce',
  'trial_omnichannel': 'omnichannel',
  'trial_organization': 'organization',
  'trial_starter': 'starter',
  'trial_professional': 'professional',
  'trial_enterprise': 'enterprise',
  'trial_chain_starter': 'starter', // Use starter as base for chain trial
  'trial_chain_professional': 'professional',
  'trial_chain_enterprise': 'enterprise',
  'expired_trial': 'presence', // Deprecated — expired_trial now maps to presence (free baseline)
};

function resolveLimitBaseTier(tier: string): SubscriptionTier {
  if (LIMIT_TRIAL_BASE_TIERS[tier]) return LIMIT_TRIAL_BASE_TIERS[tier];
  // Non-trial tiers resolve to themselves — previously every real tier fell
  // through to 'discovery' here (e.g. omnichannel resolved to 75 SKUs).
  if (tier in TIER_LIMITS) return tier as SubscriptionTier;
  // Unknown/unlisted key (incl. chain_*, custom, junk): the shared default,
  // not a silent 'discovery' 75-SKU answer (sprint plan 1.7).
  return DEFAULT_TIER;
}

export interface TierLimits {
  maxSkus: number;
  name: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  directory_presence: {
    name: 'Directory Presence',
    maxSkus: 5,
  },
  google_only: {
    name: 'Google-Only',
    maxSkus: 250,
  },
  presence: {
    name: 'Storefront',
    maxSkus: 200, // Triad redesign: commerce surface, SKU parity across the triad
  },
  discovery: {
    name: 'SWIS',
    maxSkus: 200, // Triad redesign: SWIS mode, SKU parity across the triad
  },
  storefront: {
    name: 'Storefront+',
    maxSkus: 200,  // V2: Lower limit for storefront tier
  },
  commitment: {
    name: 'Commitment',
    maxSkus: 500,  // V2: Updated limit
  },
  ecommerce: {
    name: 'E-commerce',
    maxSkus: 1000, // V2: New tier
  },
  omnichannel: {
    name: 'Omnichannel',
    maxSkus: 2000, // V2: New tier
  },
  starter: {
    name: 'Starter',
    maxSkus: 500,
  },
  professional: {
    name: 'Professional',
    maxSkus: 2000, // V2: Updated limit
  },
  enterprise: {
    name: 'Enterprise',
    maxSkus: 10000, // V2: Updated limit (not unlimited)
  },
  organization: {
    name: 'Organization',
    maxSkus: 5000, // V2: Updated limit
  },
  // Demo-only tier for seed-preview storefronts — never sold, kept out of
  // tier pickers and price maps (spec §5f). maxSkus = demo catalog size.
  seed_preview: {
    name: 'Seed Preview',
    maxSkus: 20,
  },
};

/**
 * Get SKU limit for a tier
 * Handles trial tiers as wrappers that proxy to their base tiers
 */
export function getSKULimit(tier: string | null | undefined): number {
  if (!tier) return TIER_LIMITS[DEFAULT_TIER].maxSkus;
  
  // Handle trial tiers as wrappers - proxy to base tier
  const baseTier = resolveLimitBaseTier(tier.toLowerCase());
  // ?? not || — presence.maxSkus is legitimately 0 (directory-mode, no catalog)
  return TIER_LIMITS[baseTier]?.maxSkus ?? TIER_LIMITS[DEFAULT_TIER].maxSkus;
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
  if (!tier) return TIER_LIMITS[DEFAULT_TIER];
  
  // Handle trial tiers as wrappers - proxy to base tier
  const baseTier = resolveLimitBaseTier(tier.toLowerCase());
  return TIER_LIMITS[baseTier] || TIER_LIMITS[DEFAULT_TIER];
}
