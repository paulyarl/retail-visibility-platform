/**
 * Footprint Density Side Classifier (deterministic, no LLM)
 *
 * Pass 2 (Engagement Brief) support — spec:
 * docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md,
 * "The side: emerging vs competitive (prompt emits inputs, code stamps)".
 *
 * Pure function over a campaign's `business_analysis` audit_data — the same
 * call shape as selectArchetype. Consumes the Pass-1 evidence the channel
 * scan emits (channels_scanned[], platforms.{p}.*, combined_review_metrics,
 * website.status/url) and returns which side of the footprint-density axis
 * the business sits on:
 *
 *   emerging    — thin footprint; the focus is presence (build the surface,
 *                 capture what exists, invite the claim). DEFAULT.
 *   competitive — real surfaces exist; the focus is deficiency/optimization.
 *
 * Naming: this is the "side" on the footprint-density axis — deliberately
 * NOT an archetype (ArchetypeCode owns that), NOT a magnitude
 * (SignalSeverity), NOT a lane (PlanLane/SignalLane). See spec §"Naming".
 *
 * The score reads ACTIVITY, not just channel count (spec: a 9,320-follower
 * Instagram posting last week and a dormant Facebook page with 12 followers
 * are both "one social channel" — they must not classify identically).
 * last_activity recency and notable_activity presence each contribute.
 *
 * Never public: the side is a routing input. It must never reach
 * public_narrative or any owner-facing surface.
 */

import {
  isSocialPlatformHost,
  isBuilderSubdomainHost,
} from '../triage/website-host-classification';
import type { BusinessAnalysisAuditData } from '../outreach-openers/archetype-selection';

// Bump when the scoring weights or threshold change — persisted on every
// stamped brief so the boundary is auditable and reclassification is visible.
export const FOOTPRINT_SIDE_CLASSIFIER_VERSION = 1;

// The density boundary. Persisted density_score makes this tunable off real
// sweeps rather than guessed (spec OQ8).
export const COMPETITIVE_DENSITY_THRESHOLD = 10;

// "Recent" activity window — a channel whose last_activity falls inside this
// window counts as live; older reads as dormant.
export const RECENT_ACTIVITY_WINDOW_DAYS = 90;

export type FootprintSide = 'emerging' | 'competitive';

export interface FootprintSideResult {
  side: FootprintSide;
  density_score: number;
  /** The audit field paths (with per-input detail) that produced the score. */
  inputs_used: string[];
  classifier_version: number;
}

// ─── Scoring weights ─────────────────────────────────────────────────────
// Deliberately flat and documented so the boundary is explainable in
// review: each input contributes a visible, capped number of points.
//
//   owned usable website                      +4   (the anchor surface)
//   each rendered channels_scanned entry      +2   (cap +6)
//   rendered channel, last_activity <= 90d    +1   (cap +3)
//   rendered channel, notable_activity        +1   (cap +2)
//   claimed/likely_claimed primary platform   +1   (cap +2)
//   primary platform with a rating            +1   (cap +2)
//   observable_total_reviews                  +1 / +2 / +3  (>=1 / >=25 / >=100)
const POINTS_OWNED_SITE = 4;
const POINTS_RENDERED_CHANNEL = 2;
const CAP_RENDERED_CHANNELS = 6;
const POINTS_RECENT_CHANNEL = 1;
const CAP_RECENT_CHANNELS = 3;
const POINTS_NOTABLE_CHANNEL = 1;
const CAP_NOTABLE_CHANNELS = 2;
const POINTS_CLAIMED_PLATFORM = 1;
const CAP_CLAIMED_PLATFORMS = 2;
const POINTS_RATED_PLATFORM = 1;
const CAP_RATED_PLATFORMS = 2;

const PRIMARY_PLATFORMS = ['google', 'yelp', 'facebook', 'bbb'] as const;

/**
 * Deterministically classify footprint density from audit evidence.
 * No LLM, no async, no side effects — pure function.
 *
 * `asOf` is injectable for deterministic tests; defaults to now.
 *
 * Unclassifiable input (no channels, no website, no platform data, no
 * reviews) resolves to `emerging` with density_score 0 — the spec's
 * recommended default: in this market the thin case is the norm, and
 * instruments that presume surfaces cannot read it.
 */
export function classifyFootprintSide(
  auditData: BusinessAnalysisAuditData | null | undefined,
  asOf: Date = new Date(),
): FootprintSideResult {
  const inputs: string[] = [];
  let score = 0;
  const data: BusinessAnalysisAuditData =
    auditData ?? ({} as BusinessAnalysisAuditData);

  // ── 1. Owned usable website (+4) ──────────────────────────────────────
  // A working owned-site URL, or a rendered owned_site channel entry when
  // the website block is absent/thin. Social and builder hosts do not
  // count — they are borrowed surfaces, not owned ones (same rule as A7).
  const website = data.website;
  const websiteStatus = website?.status?.toLowerCase();
  const ownedSiteViaWebsite =
    !!website?.url &&
    websiteStatus === 'working' &&
    !isSocialPlatformHost(website.url) &&
    !isBuilderSubdomainHost(website.url);

  const channels = data.channels_scanned ?? [];
  // owned_site is one surface with the website block — it earns its anchor
  // points once, never a second time as a rendered channel.
  const renderedChannels = channels.filter(
    (c) => c.rendered === true && c.channel !== 'owned_site',
  );
  const ownedSiteChannel = channels.find(
    (c) => c.channel === 'owned_site' && c.rendered === true,
  );

  if (ownedSiteViaWebsite) {
    score += POINTS_OWNED_SITE;
    inputs.push(`website.status=${websiteStatus}`, `website.url`);
  } else if (ownedSiteChannel) {
    score += POINTS_OWNED_SITE;
    inputs.push('channels_scanned[owned_site].rendered');
  }

  // ── 2. Rendered channels (+2 each, cap +6) ────────────────────────────
  // not_attempted / non-rendered entries contribute nothing but the
  // attempt is already recorded upstream.
  const renderedPoints = Math.min(
    renderedChannels.length * POINTS_RENDERED_CHANNEL,
    CAP_RENDERED_CHANNELS,
  );
  if (renderedChannels.length > 0) {
    score += renderedPoints;
    inputs.push(
      ...renderedChannels.map((c) => `channels_scanned[${c.channel}].rendered`),
    );
  }

  // ── 3. Recent activity on rendered channels (+1 each, cap +3) ─────────
  const windowMs = RECENT_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentChannels = renderedChannels.filter((c) => {
    if (!c.last_activity) return false;
    const ts = Date.parse(c.last_activity);
    return !Number.isNaN(ts) && asOf.getTime() - ts <= windowMs && ts <= asOf.getTime() + windowMs;
  });
  if (recentChannels.length > 0) {
    score += Math.min(recentChannels.length * POINTS_RECENT_CHANNEL, CAP_RECENT_CHANNELS);
    inputs.push(
      ...recentChannels.map(
        (c) => `channels_scanned[${c.channel}].last_activity=${c.last_activity}`,
      ),
    );
  }

  // ── 4. Notable activity on rendered channels (+1 each, cap +2) ────────
  const notableChannels = renderedChannels.filter(
    (c) => Array.isArray(c.notable_activity) && c.notable_activity.length > 0,
  );
  if (notableChannels.length > 0) {
    score += Math.min(notableChannels.length * POINTS_NOTABLE_CHANNEL, CAP_NOTABLE_CHANNELS);
    inputs.push(
      ...notableChannels.map((c) => `channels_scanned[${c.channel}].notable_activity`),
    );
  }

  // ── 5. Claimed / rated primary platforms (+1 each, caps +2/+2) ────────
  const platforms = data.platforms ?? {};
  const claimed: string[] = [];
  const rated: string[] = [];
  for (const p of PRIMARY_PLATFORMS) {
    const pa = platforms[p];
    if (!pa) continue;
    if (pa.profile_status === 'claimed' || pa.profile_status === 'likely_claimed') {
      claimed.push(`platforms.${p}.profile_status=${pa.profile_status}`);
    }
    if (typeof pa.rating === 'number') {
      rated.push(`platforms.${p}.rating`);
    }
  }
  score += Math.min(claimed.length * POINTS_CLAIMED_PLATFORM, CAP_CLAIMED_PLATFORMS);
  score += Math.min(rated.length * POINTS_RATED_PLATFORM, CAP_RATED_PLATFORMS);
  inputs.push(...claimed, ...rated);

  // ── 6. Review volume (+1 / +2 / +3) ───────────────────────────────────
  const reviews = data.combined_review_metrics?.observable_total_reviews;
  if (typeof reviews === 'number' && reviews >= 1) {
    score += reviews >= 100 ? 3 : reviews >= 25 ? 2 : 1;
    inputs.push(`combined_review_metrics.observable_total_reviews=${reviews}`);
  }

  return {
    side: score >= COMPETITIVE_DENSITY_THRESHOLD ? 'competitive' : 'emerging',
    density_score: score,
    inputs_used: inputs,
    classifier_version: FOOTPRINT_SIDE_CLASSIFIER_VERSION,
  };
}
