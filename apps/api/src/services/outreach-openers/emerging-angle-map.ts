/**
 * Emerging-Archetype → Hook Angle Map
 *
 * Code-defined, typed mapping from V3 Emerging-Discovery archetypes to
 * ordered hook angle lists. When a campaign's latest audit carries a V3
 * `emerging_archetype`, hooks in that archetype's list get a rank boost
 * (ordered by list position) applied **after** A-archetype affinity and
 * **before** signal-match tie-break.
 *
 * Also provides `deriveChannelHint()` — derives `phone_first` when
 * `growth_readiness` ∈ {`foundation_needed`, `insufficient_evidence`}
 * and the campaign has phone but no email/social.
 *
 * No DB access, no async, no side effects — pure data module.
 * Mirrors `hook-library.ts` pattern.
 *
 * See: docs/LocalBiz/marketing_ops_cold_call_channel_sprint_plan.md §13.1
 */

import type { HookAngle } from './hook-library';

// ─── Types ──────────────────────────────────────────────────────────────

export type EmergingArchetype =
  | 'SINGLE_PLATFORM'
  | 'DIRECTORY_GHOST'
  | 'MISCATEGORIZED_OR_MISLABELED'
  | 'INVISIBLE_ANCHOR'
  | 'INSUFFICIENT_EVIDENCE';

export type GrowthReadiness =
  | 'high_readiness'
  | 'moderate_readiness'
  | 'foundation_needed'
  | 'insufficient_evidence';

export type ChannelHint = 'phone_first' | null;

// ─── Map ────────────────────────────────────────────────────────────────

export const EMERGING_ANGLE_MAP: Record<EmergingArchetype, HookAngle[]> = {
  DIRECTORY_GHOST:              ['zero_footprint', 'gbp_verification', 'cross_platform_expansion'],
  INVISIBLE_ANCHOR:             ['local_seo', 'website_foundation', 'website_repair', 'zero_footprint'],
  SINGLE_PLATFORM:              ['cross_platform_expansion', 'photo_content_setup'],
  MISCATEGORIZED_OR_MISLABELED: ['nap_normalization', 'local_seo'],
  INSUFFICIENT_EVIDENCE:        ['zero_footprint'],
};

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Check whether a string is a valid EmergingArchetype.
 */
export function isValidEmergingArchetype(s: string): s is EmergingArchetype {
  return s in EMERGING_ANGLE_MAP;
}

/**
 * Get the ordered hook angle list for an emerging archetype.
 * Returns an empty array for unknown archetypes (no boost).
 */
export function getEmergingAngles(archetype: string): HookAngle[] {
  if (isValidEmergingArchetype(archetype)) {
    return EMERGING_ANGLE_MAP[archetype];
  }
  return [];
}

/**
 * Derive the channel hint from growth_readiness and campaign contact surface.
 *
 * `phone_first` when:
 *   - growth_readiness ∈ {foundation_needed, insufficient_evidence}
 *   - campaign has phone but no email and no social profiles
 *
 * This is a hint, not a gate — the operator always picks the channel.
 */
export function deriveChannelHint(
  growthReadiness: string | null | undefined,
  hasPhone: boolean,
  hasEmail: boolean,
  hasSocial: boolean,
): ChannelHint {
  if (!growthReadiness) return null;
  if (growthReadiness !== 'foundation_needed' && growthReadiness !== 'insufficient_evidence') {
    return null;
  }
  if (hasPhone && !hasEmail && !hasSocial) {
    return 'phone_first';
  }
  return null;
}

/**
 * Extract the emerging archetype from a V3 audit data payload.
 *
 * The V3 audit data contains `prospect_discovery.highest_opportunity_businesses[]`,
 * each with an `emerging_archetype` field. We pick the first business that
 * matches the campaign's business_name, or fall back to the first business
 * in the list.
 *
 * Returns null if no V3 data is present.
 */
export function extractEmergingArchetype(
  auditData: any,
  businessName?: string | null,
): EmergingArchetype | null {
  if (!auditData) return null;

  const prospectDiscovery = auditData.prospect_discovery ?? auditData;
  const businesses = prospectDiscovery.highest_opportunity_businesses;
  if (!Array.isArray(businesses) || businesses.length === 0) return null;

  // Try to match by business name first
  if (businessName) {
    const normalized = businessName.toLowerCase().trim();
    const match = businesses.find(
      (b: any) => typeof b.business_name === 'string' && b.business_name.toLowerCase().trim() === normalized,
    );
    if (match?.emerging_archetype && isValidEmergingArchetype(match.emerging_archetype)) {
      return match.emerging_archetype;
    }
  }

  // Fall back to the first business
  const first = businesses[0];
  if (first?.emerging_archetype && isValidEmergingArchetype(first.emerging_archetype)) {
    return first.emerging_archetype;
  }

  return null;
}

/**
 * Extract growth_readiness from a V3 audit data payload.
 * Same lookup strategy as extractEmergingArchetype.
 */
export function extractGrowthReadiness(
  auditData: any,
  businessName?: string | null,
): GrowthReadiness | null {
  if (!auditData) return null;

  const prospectDiscovery = auditData.prospect_discovery ?? auditData;
  const businesses = prospectDiscovery.highest_opportunity_businesses;
  if (!Array.isArray(businesses) || businesses.length === 0) return null;

  const validValues: GrowthReadiness[] = [
    'high_readiness', 'moderate_readiness', 'foundation_needed', 'insufficient_evidence',
  ];

  if (businessName) {
    const normalized = businessName.toLowerCase().trim();
    const match = businesses.find(
      (b: any) => typeof b.business_name === 'string' && b.business_name.toLowerCase().trim() === normalized,
    );
    if (match?.growth_readiness && validValues.includes(match.growth_readiness)) {
      return match.growth_readiness;
    }
  }

  const first = businesses[0];
  if (first?.growth_readiness && validValues.includes(first.growth_readiness)) {
    return first.growth_readiness;
  }

  return null;
}
