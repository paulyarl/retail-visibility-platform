/**
 * REPAIR_TIER_CATALOG — single source of truth for Track A profile-repair
 * package tiers: platform scope, SLA default, and display/reference pricing.
 *
 * Spec: docs/LocalBiz/PROFILE_REPAIR_PRODUCT_SPEC.md §4 (pricing),
 * docs/LocalBiz/PROFILE_REPAIR_FULFILLMENT_SPRINT.md W2.
 *
 * Mirrored on the web at apps/web/src/lib/repairTiers.ts — keep in sync.
 * Pricing is display/reference only: the operator sets package_price_cents
 * per campaign; the catalog guides that choice and (later) the pay page.
 *
 * Platform keys match the platform_access intake field keys and the
 * platform_status keys on repair_fulfillment.
 */

export type RepairTier = 'standard' | 'plus' | 'premium';
export type RepairMode = 'diy' | 'dfy';
export type RepairPlatform =
  | 'google'
  | 'facebook'
  | 'yelp'
  | 'bbb'
  | 'apple_maps'
  | 'bing_places';

export interface RepairTierSpec {
  tier: RepairTier;
  label: string;
  /** Platforms this tier may cover — platforms[] ⊆ scope. */
  platforms: RepairPlatform[];
  /** Default turnaround hours. Premium is the 24h tier. */
  slaHours: number;
  /** Reference pricing from the product spec §4 (operator-adjustable). */
  diyPriceCents: number | null;
  dfyPriceCents: number;
}

const CORE_PLATFORMS: RepairPlatform[] = ['google', 'facebook', 'yelp', 'bbb'];

export const REPAIR_TIER_CATALOG: Record<RepairTier, RepairTierSpec> = {
  standard: {
    tier: 'standard',
    label: 'Standard',
    platforms: CORE_PLATFORMS,
    slaHours: 48,
    diyPriceCents: 14900,
    dfyPriceCents: 29900,
  },
  plus: {
    tier: 'plus',
    label: 'Plus',
    platforms: CORE_PLATFORMS,
    slaHours: 48,
    diyPriceCents: 24900,
    dfyPriceCents: 39900,
  },
  premium: {
    tier: 'premium',
    label: 'Premium',
    platforms: [...CORE_PLATFORMS, 'apple_maps', 'bing_places'],
    slaHours: 24,
    diyPriceCents: null, // no DIY at premium — full sweep, 24h SLA
    dfyPriceCents: 59900,
  },
};

export const REPAIR_PLATFORM_LABELS: Record<RepairPlatform, string> = {
  google: 'Google Business Profile',
  facebook: 'Facebook',
  yelp: 'Yelp',
  bbb: 'BBB',
  apple_maps: 'Apple Maps',
  bing_places: 'Bing Places',
};

/** Per-platform verification states on repair_fulfillment.platform_status. */
export const REPAIR_PLATFORM_STATUSES = [
  'awaiting_access',
  'access_granted',
  'in_progress',
  'verified',
  'done',
  'blocked',
  'not_applicable',
  'customer_pending',
  'customer_reported',
  'escalated',
] as const;
export type RepairPlatformStatus = (typeof REPAIR_PLATFORM_STATUSES)[number];

/** platform_access intake answer keys → the platform_status platform keys. */
export const ACCESS_FIELD_TO_PLATFORM: Record<string, RepairPlatform> = {
  google_gbp: 'google',
  facebook_page: 'facebook',
  yelp: 'yelp',
  bbb: 'bbb',
  apple_maps: 'apple_maps',
  bing_places: 'bing_places',
};

/** Intake answer → initial platform_status. */
export const ACCESS_ANSWER_TO_STATUS: Record<string, RepairPlatformStatus> = {
  granted: 'access_granted',
  pending: 'awaiting_access',
  cannot_grant: 'blocked',
  not_applicable: 'not_applicable',
};

export function isRepairTier(t: unknown): t is RepairTier {
  return t === 'standard' || t === 'plus' || t === 'premium';
}

export function isRepairMode(m: unknown): m is RepairMode {
  return m === 'diy' || m === 'dfy';
}

/**
 * Validate a platform list against a tier's scope. Returns the out-of-scope
 * entries (empty array = valid).
 */
export function outOfScopePlatforms(tier: RepairTier, platforms: string[]): string[] {
  const scope = new Set<string>(REPAIR_TIER_CATALOG[tier].platforms);
  return platforms.filter((p) => !scope.has(p));
}
