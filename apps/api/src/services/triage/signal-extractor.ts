/**
 * SignalExtractor — normalizes raw audit signals into NormalizedSignals
 *
 * Consumes both mkt_campaigns_list columns and the latest business_analysis
 * audit_data JSON, merging them into the flat typed shape the triage cascade
 * switches on. Pure function — no DB access, no side effects.
 *
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md §4.1
 * Sprint 2 — Signal Extractor & Triage Engine.
 */

import type { BusinessAnalysisAuditData, WebsiteAudit, NapConsistency } from '../outreach-openers/archetype-selection';
import type { NormalizedSignals, SignalExtractorInput } from './types';

// ─── Thresholds ──────────────────────────────────────────────────────────
//
// Centralized so the engine and tests share one definition of "stale" /
// "friction". Tuned to match the existing archetype-selection thresholds
// (archetype-selection.ts uses 15% unanswered rate / 15 unanswered reviews
// for A1, and any non-consistent NAP with variations for A3).

const DAYS_SINCE_REVIEW_STALE = 90;        // PB-02/PB-05 review-gap threshold
const UNANSWERED_REVIEW_GAP = 5;           // minimum to count as a review gap

// ─── Helpers ─────────────────────────────────────────────────────────────

function daysSince(date: Date | null | undefined, now: Date = new Date()): number {
  if (!date) return -1;
  const ms = now.getTime() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Detect a dead URL from the website audit's status field. The audit uses
 * free-text status strings ('live', 'dead', 'timeout', 'redirect_loop', etc.)
 * — anything other than a positive 'live'/'ok' is treated as dead.
 */
function isDeadUrl(website: WebsiteAudit | undefined, campaignWebsiteUrl: string | null | undefined): boolean {
  if (!website && !campaignWebsiteUrl) return false;
  const status = website?.status?.toLowerCase();
  if (status === 'dead' || status === 'timeout' || status === 'dns_error' || status === 'redirect_loop') {
    return true;
  }
  // No website at all but the campaign row says has_website === 'no'
  return false;
}

/**
 * Detect a URL mismatch: the audit's website.url differs from the campaign's
 * website_url column, or the audit reports a different canonical URL than the
 * GBP-listed one.
 */
function isUrlMismatch(
  website: WebsiteAudit | undefined,
  campaignWebsiteUrl: string | null | undefined,
): boolean {
  if (!website?.url || !campaignWebsiteUrl) return false;
  return normalizeUrl(website.url) !== normalizeUrl(campaignWebsiteUrl);
}

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

/**
 * NAP inconsistency: combine the campaign's denormalized nap_consistent flag
 * with the audit's structured nap_consistency block. Either source can flip
 * this true — the audit's material_issues list is authoritative when present.
 */
function isNapInconsistent(
  campaignNapConsistent: boolean | null | undefined,
  nap: NapConsistency | undefined,
): boolean {
  if (nap) {
    if (nap.overall_status && nap.overall_status !== 'consistent') return true;
    if ((nap.material_issues?.length ?? 0) > 0) return true;
  }
  if (campaignNapConsistent === false) return true;
  return false;
}

/**
 * CTA friction: combine the website audit's three CTA booleans. True when any
 * high-impact conversion primitive is missing. Mirrors archetype-selection's
 * A4 trigger (call_to_action_present === 'no' || click_to_call_available ===
 * 'no' || has_booking === false).
 */
function hasCtaFriction(website: WebsiteAudit | undefined): boolean {
  if (!website) return false;
  return (
    website.call_to_action_present === 'no' ||
    website.click_to_call_available === 'no' ||
    website.has_booking === false
  );
}

// ─── Extractor ───────────────────────────────────────────────────────────

/**
 * Normalize raw signals from the campaign row + business_analysis audit_data
 * + optional operator-supplied BBB snapshot into NormalizedSignals.
 *
 * Pure function. Returns a NormalizedSignals object even when the audit is
 * missing — missing fields default to safe "no signal" values so the cascade
 * falls through to the PB-03 fallback rather than throwing.
 */
export function extractSignals(input: SignalExtractorInput, now: Date = new Date()): NormalizedSignals {
  const { campaign, auditData, bbb } = input;

  const website = auditData?.website;
  const nap = auditData?.nap_consistency;
  const googleRating = auditData?.platforms?.google?.rating;

  return {
    bbbGrade: bbb?.bbbGrade,
    googleRating,
    unansweredBbbComplaints: bbb?.unansweredBbbComplaints ?? 0,
    hasDeadUrl: isDeadUrl(website, campaign.website_url),
    urlMismatch: isUrlMismatch(website, campaign.website_url),
    napInconsistent: isNapInconsistent(campaign.nap_consistent, nap),
    daysSinceLastReview: daysSince(campaign.last_review_date, now),
    unaddressedReviewCount: campaign.unaddressed_reviews ?? 0,
    hasCtaFriction: hasCtaFriction(website),
  };
}

// ─── Signal predicates (exported for the engine + tests) ─────────────────

/**
 * A signal "fires" when it crosses the threshold that makes it actionable.
 * The cascade uses these predicates to decide which rule wins. Centralizing
 * them here keeps the engine's switch statement readable and the thresholds
 * testable in isolation.
 */
export const signalPredicates = {
  bbbEmergency: (s: NormalizedSignals): boolean =>
    (s.bbbGrade !== undefined && bbbGradeIsLow(s.bbbGrade)) || s.unansweredBbbComplaints > 0,

  hasRepairSignal: (s: NormalizedSignals): boolean =>
    s.napInconsistent || s.hasDeadUrl || s.urlMismatch,

  hasReviewGap: (s: NormalizedSignals): boolean =>
    s.daysSinceLastReview >= DAYS_SINCE_REVIEW_STALE || s.unaddressedReviewCount >= UNANSWERED_REVIEW_GAP,

  hasCtaFriction: (s: NormalizedSignals): boolean => s.hasCtaFriction,
};

function bbbGradeIsLow(grade: string): boolean {
  // 'C' or below is the recovery threshold (BBB grades: A+, A, B, C, D, F)
  const normalized = grade.toUpperCase().replace(/\+/g, '');
  return ['C', 'D', 'F'].includes(normalized.charAt(0));
}

export const SIGNAL_THRESHOLDS = {
  DAYS_SINCE_REVIEW_STALE,
  UNANSWERED_REVIEW_GAP,
} as const;
