/**
 * Platform presence — THE single source of truth for "which platforms is this
 * business actually on", shared by every consumer of a business_analysis audit.
 *
 * Why this module exists: platform presence was derived independently in four
 * places, and they disagreed about the same audit —
 *
 *   - `ProspectReportService` (`PRESENT_STATUSES` / `platformLabel`) — the
 *     archetype fact slice and every owner-report chapter
 *   - `outreach-openers/field-extractors` (`platformLabels`) — the A3/A5
 *     "shows up differently across …" clause, and the A8 presence map
 *   - `outreach-openers/signal-magnitude` (`absentPlatformKeys`) — severity
 *   - `field-extractors`' local `label()` — the owner-facing platform names
 *
 * Every one of those copies produced a defect that shipped: a Yelp listing
 * asserted for a business with no Yelp listing, an absent Yelp and BBB reported
 * as platforms the business was ON (inverting A8's whole presence map), and
 * "Bbb" / "Apple maps" rendered straight into prompts where the writer could
 * echo them to an owner.
 *
 * This is a LEAF module — it imports nothing from the service layer, so both
 * the report service and the outreach layer can depend on it without a cycle.
 *
 * Data-driven only: it reads `platforms` and `render_controls`. A consumer that
 * layers its own signal-driven heuristic on top (A8 adds key platforms with no
 * status when a missing-profile signal fired) does so at its own seam.
 */

/** `profile_status` values that mean a profile EXISTS (claimed or not). */
export const PRESENT_STATUSES = new Set([
  'claimed',
  'likely_claimed',
  'unclaimed',
  'likely_unclaimed',
]);

const CLAIMED_STATUSES = new Set(['claimed', 'likely_claimed']);
const UNCLAIMED_STATUSES = new Set(['unclaimed', 'likely_unclaimed']);

/** `data_status` values that positively evidence a listing. */
const EVIDENCED_STATUSES = new Set(['complete', 'partial']);

/**
 * Owner-facing platform names.
 *
 * Explicit, because title-casing the raw key rendered `bbb` as "Bbb" and
 * `apple_maps` as "Apple maps" — both of which reached prompts and PDFs.
 */
const PLATFORM_DISPLAY: Record<string, string> = {
  google: 'Google Business Profile',
  yelp: 'Yelp',
  facebook: 'Facebook',
  bbb: 'BBB',
  apple_maps: 'Apple Maps',
  bing: 'Bing',
};

function humanize(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Display label for a platform key. */
export function platformLabel(key: string): string {
  return PLATFORM_DISPLAY[key] ?? humanize(key);
}

/** Display labels for a list of platform keys. */
export function platformLabels(keys: readonly string[]): string[] {
  return keys.map(platformLabel);
}

/**
 * Conversational label — the same platform inside a spoken sentence.
 *
 * The consolidation surfaced that the label is not one thing: a report or a
 * field list reads "Google Business Profile", but the opener's drift clause
 * ("shows up differently across …") wants "Google". Carrying one label for both
 * registers is what made the two layers diverge in the first place.
 */
const PLATFORM_SHORT: Record<string, string> = {
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
  bbb: 'BBB',
  apple_maps: 'Apple Maps',
  bing: 'Bing',
};

export function platformShortLabel(key: string): string {
  return PLATFORM_SHORT[key] ?? humanize(key);
}

export function platformShortLabels(keys: readonly string[]): string[] {
  return keys.map(platformShortLabel);
}

export interface PlatformPresence {
  /** Keys with a listing that exists — claimed or unclaimed. */
  presentKeys: string[];
  /** `present` ∩ claimed / likely_claimed. */
  claimedKeys: string[];
  /** `present` ∩ unclaimed / likely_unclaimed. */
  unclaimedKeys: string[];
  /**
   * Verified absent: `data_status: 'unavailable'`, or a `render_controls`
   * `business_specific_failure`, minus anything verified present or restricted.
   * A non-primary platform (apple_maps, bing) can appear here — it carries a
   * control attempt but no platform block.
   */
  missingKeys: string[];
  /** Exists, but the public cannot see it — a visibility defect, not absence. */
  restrictedKeys: string[];
  /** `data_status` is `complete` or `partial` — the block rendered. */
  evidencedKeys: string[];
}

interface AuditLike {
  platforms?: Record<string, unknown> | null;
  render_controls?: Array<{ platform?: string | null; determination?: string | null }> | null;
}

/**
 * Derive platform presence from an audit. Pure — no DB access, no signals.
 *
 * `present` requires a claim verdict (`profile_status`). `unable_to_verify` is
 * deliberately in NEITHER present nor missing: it is the absence of a finding,
 * and treating it as presence is what put Yelp and BBB on a presence map for a
 * business verified missing from both.
 */
export function platformPresence(auditData: unknown): PlatformPresence {
  const audit = (auditData ?? {}) as AuditLike;
  const platforms = (audit.platforms ?? {}) as Record<string, any>;

  const presentKeys: string[] = [];
  const claimedKeys: string[] = [];
  const unclaimedKeys: string[] = [];
  const restrictedKeys: string[] = [];
  const evidencedKeys: string[] = [];

  for (const [key, p] of Object.entries(platforms)) {
    if (!p || typeof p !== 'object') continue;

    if (p.data_status === 'restricted') {
      restrictedKeys.push(key);
      continue;
    }
    if (p.data_status === 'unavailable') continue;
    if (EVIDENCED_STATUSES.has(String(p.data_status ?? ''))) evidencedKeys.push(key);

    if (CLAIMED_STATUSES.has(p.profile_status)) {
      presentKeys.push(key);
      claimedKeys.push(key);
    } else if (UNCLAIMED_STATUSES.has(p.profile_status)) {
      presentKeys.push(key);
      unclaimedKeys.push(key);
    }
  }

  const presentSet = new Set(presentKeys);
  const restrictedSet = new Set(restrictedKeys);
  const missing = new Set<string>();

  for (const [key, p] of Object.entries(platforms)) {
    if (p && typeof p === 'object' && p.data_status === 'unavailable') missing.add(key);
  }
  for (const control of audit.render_controls ?? []) {
    if (control?.determination === 'business_specific_failure' && control.platform) {
      missing.add(String(control.platform).toLowerCase());
    }
  }
  for (const key of [...presentSet, ...restrictedSet]) missing.delete(key);

  return {
    presentKeys,
    claimedKeys,
    unclaimedKeys,
    missingKeys: [...missing],
    restrictedKeys,
    evidencedKeys,
  };
}
