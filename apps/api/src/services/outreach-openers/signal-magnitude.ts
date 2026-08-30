/**
 * Signal Magnitude — severity tiers + triggered signal context
 *
 * Generalizes the A3 "material vs cosmetic drift" fix to ALL archetypes.
 *
 * The core problem this solves: every archetype prompt used to hardcode a
 * preamble that assumed a specific severity (crisis framing like "customers
 * are being sent to the wrong location"). When the actual data was milder
 * than the preamble assumed — or when a stronger co-occurring signal existed
 * that the archetype didn't lead with — the opener lost credibility.
 *
 * This module provides:
 *   1. SignalSeverity tiers (crisis > material > cosmetic > borderline)
 *   2. Per-signal severity computation from audit data (not just presence)
 *   3. TriggeredSignalContext — all fired signals ranked by severity, so
 *      every prompt knows what else is going on and can lead with the
 *      strongest signal when its primary is weak
 *   4. Per-archetype primary signal severity computation
 *
 * The prompt builder uses this to:
 *   - Branch the preamble on the primary signal's actual severity
 *   - Instruct the LLM to acknowledge stronger co-occurring signals
 *   - Never assert a crisis the data doesn't support
 */

import type { BusinessAnalysisAuditData } from './archetype-selection';
import type { ArchetypeCode } from './archetype-selection';
import { signalLabel, type SignalCode } from '../triage/signal-taxonomy';

// ─── Severity tiers ──────────────────────────────────────────────────────

export type SignalSeverity = 'crisis' | 'material' | 'cosmetic' | 'borderline';

export const SEVERITY_RANK: Record<SignalSeverity, number> = {
  crisis: 4,
  material: 3,
  cosmetic: 2,
  borderline: 1,
};

export function severityRank(s: SignalSeverity): number {
  return SEVERITY_RANK[s] ?? 0;
}

export function isStronger(a: SignalSeverity, b: SignalSeverity): boolean {
  return severityRank(a) > severityRank(b);
}

// ─── Triggered signal context ────────────────────────────────────────────

export interface TriggeredSignalEntry {
  code: SignalCode;
  label: string;
  severity: SignalSeverity;
}

export interface TriggeredSignalContext {
  signals: TriggeredSignalEntry[];
  strongest: TriggeredSignalEntry | null;
}

// ─── Per-signal severity computation ─────────────────────────────────────
//
// Maps each signal code to a severity tier based on the ACTUAL data, not just
// presence/absence. A signal's severity can shift based on magnitude:
//   - CP_NAP_PHONE_DRIFT is "material" when the phone numbers are genuinely
//     different, but "cosmetic" when they're just formatting variants
//   - RA_UNADDRESSED_NEGATIVE_BACKLOG is "material" at 3-4 negatives but
//     "crisis" at 10+
//   - WC_MISSING_WEBSITE is "crisis" for any business (no online presence)
//
// For signals where the audit data doesn't provide magnitude nuance, the
// default severity is used.

const DEFAULT_SEVERITY: Record<string, SignalSeverity> = {
  // Crisis — customers actively lost or can't reach the business
  RA_BBB_GRADE_SUPPRESSION: 'crisis',
  RA_UNANSWERED_COMPLAINTS: 'crisis',
  WC_BROKEN_WEBSITE: 'crisis',
  WC_MISSING_WEBSITE: 'crisis',
  DS_BROKEN_PROFILE_LINK: 'crisis',
  DS_MISSING_PROFILE: 'crisis',

  // Material — real, felt problem (lost opportunity or ranking impact)
  RA_UNADDRESSED_NEGATIVE_BACKLOG: 'material',
  RA_REVIEW_DROUGHT: 'material',
  WC_MISSING_CTA: 'material',
  DS_CLAIMED_STATUS: 'material',
  DS_MISSING_PRODUCT_CATALOG: 'material',
  WC_MISSING_PRODUCT_BROWSING: 'material',
  DS_MISSING_SERVICE_MENU: 'material',
  WC_MISSING_SERVICE_PAGES: 'material',
  WC_URL_MISMATCH: 'material',
  VP_MISSING_PROJECT_PHOTOS: 'material',
  VP_MISSING_PRODUCT_PHOTOS: 'material',
  VP_MISSING_STOREFRONT_PHOTOS: 'material',
  CP_MISSING_CONTACT_INFO: 'material',

  // Cosmetic / Borderline — formatting, minor gaps, less urgent
  RA_LOW_REVIEW_VOLUME: 'borderline',
  RA_UNADDRESSED_POSITIVE_BACKLOG: 'borderline',
  DS_PHOTO_DEFICIT: 'borderline',
  WC_MOBILE_FRICTION: 'borderline',
  DS_OUTDATED_HOURS: 'borderline',
  DS_OUTDATED_HOLIDAY_HOURS: 'borderline',
  VP_STALE_SOCIAL_ACTIVITY: 'borderline',
  WC_MISSING_AVAILABILITY_INQUIRY: 'borderline',
  WC_MISSING_PICKUP_DELIVERY: 'borderline',
  // CP_NAP_*_DRIFT defaults to cosmetic; upgraded to material when
  // material_drift=true (computed in computeSignalSeverity)
  CP_NAP_NAME_DRIFT: 'cosmetic',
  CP_NAP_ADDRESS_DRIFT: 'cosmetic',
  CP_NAP_PHONE_DRIFT: 'cosmetic',
};

// ─── NAP normalization (shared with field-extractors) ────────────────────

const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  rd: 'road', st: 'street', ave: 'avenue', blvd: 'boulevard',
  dr: 'drive', ln: 'lane', ct: 'court', pl: 'place',
  pkwy: 'parkway', hwy: 'highway', ste: 'suite', apt: 'apartment',
  fl: 'floor', rm: 'room', n: 'north', s: 'south', e: 'east', w: 'west',
  nw: 'northwest', ne: 'northeast', sw: 'southwest', se: 'southeast',
};

const NAME_LEGAL_SUFFIXES = ['llc', 'inc', 'corp', 'ltd', 'co', 'llp', 'plc', 'lp'];

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/\.+/g, ' ')
    .replace(/[,#]/g, ' ')
    .split(/\s+/)
    .map((tok) => ADDRESS_ABBREVIATIONS[tok] ?? tok)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(name: string): string {
  const lower = name.toLowerCase().replace(/[.,]/g, ' ').trim();
  return lower
    .split(/\s+/)
    .filter((tok) => !NAME_LEGAL_SUFFIXES.includes(tok))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true if any NAP variation type has more than one distinct
 * normalized value — i.e., the variations are not just formatting/cosmetic
 * differences of the same underlying data.
 */
export function hasMaterialDrift(
  nap: NonNullable<BusinessAnalysisAuditData['nap_consistency']>,
): boolean {
  const phones = nap.phone_variations ?? [];
  const addresses = nap.address_variations ?? [];
  const names = nap.name_variations ?? [];

  const distinctPhones = new Set(phones.map(normalizePhone)).size;
  const distinctAddresses = new Set(addresses.map(normalizeAddress)).size;
  const distinctNames = new Set(names.map(normalizeName)).size;

  return distinctPhones > 1 || distinctAddresses > 1 || distinctNames > 1;
}

// ─── Per-signal severity ─────────────────────────────────────────────────

/**
 * Compute the severity of a single signal code based on the actual audit data.
 *
 * For most signals, the default severity is used. For signals where the
 * magnitude matters (NAP drift, negative backlog, review drought), the
 * severity is upgraded or downgraded based on the data.
 */
export function computeSignalSeverity(
  code: SignalCode,
  auditData: BusinessAnalysisAuditData,
): SignalSeverity {
  // CP_NAP_*_DRIFT — upgrade to "material" when the variations are genuinely
  // different (not just formatting). Downgrade to "cosmetic" when they're
  // formatting-only.
  if (code === 'CP_NAP_NAME_DRIFT' || code === 'CP_NAP_ADDRESS_DRIFT' || code === 'CP_NAP_PHONE_DRIFT') {
    const nap = auditData.nap_consistency;
    if (!nap) return 'cosmetic';
    return hasMaterialDrift(nap) ? 'material' : 'cosmetic';
  }

  // RA_UNADDRESSED_NEGATIVE_BACKLOG — crisis at 10+, material at 3-9
  if (code === 'RA_UNADDRESSED_NEGATIVE_BACKLOG') {
    const count = auditData.combined_review_metrics?.observable_unanswered_negative_reviews ?? 0;
    return count >= 10 ? 'crisis' : 'material';
  }

  // RA_REVIEW_DROUGHT — crisis at 365+ days, material at 180-364
  if (code === 'RA_REVIEW_DROUGHT') {
    // The drought duration is computed by the signal extractor from
    // campaign.last_review_date, which isn't available here. Default to
    // material; the extractor can upgrade if needed.
    return 'material';
  }

  // WC_MISSING_CTA — material (no CTA is a real conversion gap)
  // No magnitude nuance — if the signal fired, it's material.

  return DEFAULT_SEVERITY[code] ?? 'borderline';
}

// ─── Triggered signal context builder ────────────────────────────────────

/**
 * Build a ranked TriggeredSignalContext from a set of signal codes + audit data.
 *
 * Each signal is labeled and assigned a severity. The list is sorted by
 * severity (descending) so the strongest signal is first. The `strongest`
 * field is a convenience accessor for the top entry.
 */
export function buildTriggeredSignalContext(
  signalCodes: SignalCode[],
  auditData: BusinessAnalysisAuditData,
): TriggeredSignalContext {
  const signals: TriggeredSignalEntry[] = signalCodes.map((code) => ({
    code,
    label: signalLabel(code),
    severity: computeSignalSeverity(code, auditData),
  }));

  signals.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return {
    signals,
    strongest: signals[0] ?? null,
  };
}

/**
 * Get all signals with severity strictly stronger than the given threshold.
 * Used by prompt builders to find co-occurring signals that should lead
 * the hook instead of the archetype's primary signal.
 */
export function signalsStrongerThan(
  context: TriggeredSignalContext,
  threshold: SignalSeverity,
): TriggeredSignalEntry[] {
  return context.signals.filter((s) => isStronger(s.severity, threshold));
}

// ─── Per-archetype primary signal severity ───────────────────────────────
//
// Each archetype's "primary signal" is the one it owns and leads with. The
// severity of that signal determines which preamble variant the prompt
// builder uses. When the primary signal is weaker than a co-occurring signal,
// the prompt should acknowledge the stronger signal.

/**
 * Compute the severity of an archetype's primary signal from the audit data.
 *
 * This is the severity that the prompt builder uses to select the preamble
 * variant. It's computed from the actual data, not hardcoded.
 */
export function computePrimarySignalSeverity(
  archetype: ArchetypeCode,
  auditData: BusinessAnalysisAuditData,
): SignalSeverity {
  switch (archetype) {
    case 'A1': {
      // Review response gap — severity based on unanswered rate/count
      const m = auditData.combined_review_metrics;
      const rate = m?.observable_unanswered_rate_percent ?? 0;
      const count = m?.observable_unanswered_reviews ?? 0;
      if (rate >= 50 || count >= 30) return 'crisis';
      if (rate >= 25 || count >= 10) return 'material';
      return 'borderline';
    }

    case 'A2': {
      // Negative review recovery — severity based on theme cluster size
      const themes = auditData.negative_review_themes ?? [];
      const topTheme = themes[0];
      const count = topTheme?.supporting_review_count ?? 0;
      if (count >= 5) return 'crisis';
      return 'material';
    }

    case 'A3': {
      // Listing drift — severity based on material_drift
      const nap = auditData.nap_consistency;
      if (!nap) return 'cosmetic';
      return hasMaterialDrift(nap) ? 'material' : 'cosmetic';
    }

    case 'A4': {
      // CTA gap — material (no CTA is a real conversion gap)
      // Could be upgraded to crisis if WC_BROKEN_WEBSITE co-occurs, but
      // that's handled by the triggered signal context, not here.
      return 'material';
    }

    case 'A5': {
      // Dual-signal footprint — severity is the max of repair + review
      // components. The prompt already combines them; this gives the
      // prompt builder the overall magnitude.
      const nap = auditData.nap_consistency;
      const napSeverity = nap && hasMaterialDrift(nap) ? 'material' : 'cosmetic';
      const m = auditData.combined_review_metrics;
      const unaddressed = m?.observable_unanswered_reviews ?? 0;
      const reviewSeverity = unaddressed >= 10 ? 'material' : 'borderline';
      return severityRank(napSeverity) >= severityRank(reviewSeverity) ? napSeverity : reviewSeverity;
    }

    case 'A6': {
      // Product visibility gap — crisis if no website, material if website
      // exists but no product browsing
      const hasWebsite = !!auditData.website?.url || auditData.website?.status === 'working';
      return hasWebsite ? 'material' : 'crisis';
    }
  }
}

// ─── Prompt-facing helpers ───────────────────────────────────────────────

/**
 * Format the triggered signal context as a human-readable list for the LLM
 * prompt. Only includes signals with severity >= the archetype's primary,
 * plus the primary itself — weaker signals are noise.
 */
export function formatSignalContextForPrompt(
  context: TriggeredSignalContext,
  primarySeverity: SignalSeverity,
): string {
  const relevant = context.signals.filter(
    (s) => severityRank(s.severity) >= severityRank(primarySeverity),
  );
  if (relevant.length === 0) return '(none detected)';
  return relevant
    .map((s) => `- ${s.label} [${s.severity}]`)
    .join('\n');
}

/**
 * Get the strongest co-occurring signal that is NOT the archetype's primary
 * signal domain. Returns null if no stronger signal exists.
 *
 * This is what the prompt uses to decide whether to lead with a different
 * signal than its archetype normally would.
 */
export function getStrongestCoOccurringSignal(
  context: TriggeredSignalContext,
  primarySeverity: SignalSeverity,
): TriggeredSignalEntry | null {
  const stronger = signalsStrongerThan(context, primarySeverity);
  return stronger[0] ?? null;
}
