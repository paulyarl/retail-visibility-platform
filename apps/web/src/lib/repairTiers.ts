/**
 * REPAIR_TIER_CATALOG — web mirror of apps/api/src/lib/repair-tiers.ts.
 * Keep in sync — the API is the source of truth for validation; this copy
 * exists for display (labels, SLA hints, scope chips) only.
 *
 * Spec: docs/LocalBiz/PROFILE_REPAIR_PRODUCT_SPEC.md §4,
 * docs/LocalBiz/PROFILE_REPAIR_FULFILLMENT_SPRINT.md W2/W7.
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
  platforms: RepairPlatform[];
  slaHours: number;
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
    diyPriceCents: null,
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

export const REPAIR_STATUS_LABELS: Record<RepairPlatformStatus, string> = {
  awaiting_access: 'Awaiting access',
  access_granted: 'Access granted',
  in_progress: 'In progress',
  verified: 'Verified',
  done: 'Done',
  blocked: 'Blocked',
  not_applicable: 'Not applicable',
  customer_pending: 'Customer pending',
  customer_reported: 'Customer reported',
  escalated: 'Escalated (Track B)',
};

/** Statuses whose row exposes the "Escalate to Track B" affordance (W7c). */
export const ESCALATABLE_STATUSES: ReadonlySet<RepairPlatformStatus> = new Set([
  'blocked',
  'awaiting_access',
  'customer_reported',
]);

/** Track B issue vocabulary for the escalation modal (spec §3f). */
export const TRACK_B_ISSUE_TYPES = [
  { value: 'suspension', label: 'Profile Suspension' },
  { value: 'duplicate_listing', label: 'Duplicate Listing' },
  { value: 'hijacked_listing', label: 'Hijacked Listing' },
  { value: 'ownership_dispute', label: 'Ownership Dispute' },
  { value: 'address_verification_block', label: 'Address Verification Block' },
] as const;
