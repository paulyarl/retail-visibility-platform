/**
 * Signal Taxonomy — canonical signal codes, families, and predicates
 *
 * The single contract between audit ingestion, the triage engine, the
 * playbook catalog, and the UI's "Triggered Signals" display.
 *
 * Registry-backed: at runtime, the active signals are loaded from
 * `mkt_signal_registry` (with a short-lived cache + invalidation on registry
 * writes) so new codes registered by admins are live without a deploy. The TS
 * union + fallback constants below seed/validate the 24 known codes; the DB
 * registry is the runtime source of truth.
 *
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md
 * Sprint 2A §2A.1 — Canonical Signal Taxonomy
 */

// ─── Signal families ─────────────────────────────────────────────────────

export const SIGNAL_FAMILIES = ['RA', 'DS', 'WC', 'CP', 'VP', 'OX'] as const;
export type SignalFamily = (typeof SIGNAL_FAMILIES)[number];

export const FAMILY_LABELS: Record<SignalFamily, string> = {
  RA: 'Reputation & Administrative',
  DS: 'Digital Surface & Profile',
  WC: 'Website & Conversion',
  CP: 'Cross-Platform Consistency',
  VP: 'Content & Visual Proof',
  OX: 'Outreach Execution',
};

// ─── Canonical 31 signal codes (TS fallback / validation set) ────────────
//
// The DB registry (`mkt_signal_registry`) is the runtime source of truth.
// This union exists so the extractor, engine, and tests have compile-time
// safety for the 24 known codes. Unknown codes (registered by admins at
// runtime) are valid `SignalCode` strings too — the engine ignores unknown
// codes in rules with a warning log (forward-compatible).

export const KNOWN_SIGNAL_CODES = [
  // Reputation & Administrative (RA)
  'RA_BBB_GRADE_SUPPRESSION',
  'RA_UNANSWERED_COMPLAINTS',
  'RA_REVIEW_DROUGHT',
  'RA_LOW_REVIEW_VOLUME',
  'RA_UNADDRESSED_NEGATIVE_BACKLOG',
  'RA_UNADDRESSED_POSITIVE_BACKLOG',
  // Digital Surface & Profile (DS)
  'DS_CLAIMED_STATUS',
  'DS_MISSING_PROFILE',
  'DS_BROKEN_PROFILE_LINK',
  'DS_MISSING_SERVICE_MENU',
  'DS_MISSING_PRODUCT_CATALOG',
  'DS_OUTDATED_HOURS',
  'DS_OUTDATED_HOLIDAY_HOURS',
  'DS_PHOTO_DEFICIT',
  // Website & Conversion (WC)
  'WC_MISSING_WEBSITE',
  'WC_BROKEN_WEBSITE',
  'WC_URL_MISMATCH',
  'WC_MISSING_CTA',
  'WC_MISSING_SERVICE_PAGES',
  'WC_MISSING_PRODUCT_BROWSING',
  'WC_MISSING_AVAILABILITY_INQUIRY',
  'WC_MISSING_PICKUP_DELIVERY',
  'WC_MOBILE_FRICTION',
  // Cross-Platform Consistency (CP)
  'CP_NAP_NAME_DRIFT',
  'CP_NAP_ADDRESS_DRIFT',
  'CP_NAP_PHONE_DRIFT',
  'CP_MISSING_CONTACT_INFO',
  // Content & Visual Proof (VP)
  'VP_MISSING_PROJECT_PHOTOS',
  'VP_STALE_SOCIAL_ACTIVITY',
  'VP_MISSING_STOREFRONT_PHOTOS',
  'VP_MISSING_PRODUCT_PHOTOS',
  // Outreach Execution (OX) — derived from outreach tables, display-only
  'OX_OPENER_SENT',
  'OX_FOLLOWUP_SENT',
  'OX_PITCH_ASSEMBLED',
  'OX_NO_REPLY_AFTER_OPENER',
  'OX_NO_REPLY_AFTER_FOLLOWUP_N',
  'OX_CONTACT_LOGGED',
] as const;

/**
 * SignalCode is a branded string. The 24 known codes are in the union for
 * compile-time safety; unknown admin-registered codes are valid too (the
 * `string` fallback). Use `isKnownSignalCode()` to distinguish.
 */
export type SignalCode = (typeof KNOWN_SIGNAL_CODES)[number] | (string & {});

// ─── Detection source ────────────────────────────────────────────────────

export const DETECTION_SOURCES = ['model_emitted', 'derived', 'operator_input'] as const;
export type DetectionSource = (typeof DETECTION_SOURCES)[number];

// ─── Family predicates ───────────────────────────────────────────────────
//
// Operate on the code prefix. These are used by the engine's reasoning
// builder and the UI's signal grouping. The registry's `family` column is
// the authoritative source at runtime; these predicates are a fast
// prefix-based fallback for the 24 known codes.

export function signalFamily(code: SignalCode): SignalFamily | null {
  const prefix = code.split('_')[0];
  if (SIGNAL_FAMILIES.includes(prefix as SignalFamily)) {
    return prefix as SignalFamily;
  }
  return null;
}

export function isRepairSignal(code: SignalCode): boolean {
  // Repair signals: CP_* (NAP drift), WC_URL_MISMATCH, WC_BROKEN_WEBSITE,
  // DS_BROKEN_PROFILE_LINK, DS_OUTDATED_HOLIDAY_HOURS (hours drift is
  // repair-class — a missing special-hours schedule is a listing defect).
  // These are the "groupA" signals for PB-05 dual.
  if (code.startsWith('CP_')) return true;
  return (
    code === 'WC_URL_MISMATCH' ||
    code === 'WC_BROKEN_WEBSITE' ||
    code === 'DS_BROKEN_PROFILE_LINK' ||
    code === 'DS_OUTDATED_HOLIDAY_HOURS'
  );
}

export function isReviewSignal(code: SignalCode): boolean {
  // Review signals: RA_REVIEW_DROUGHT, RA_LOW_REVIEW_VOLUME,
  // RA_UNADDRESSED_NEGATIVE_BACKLOG, RA_UNADDRESSED_POSITIVE_BACKLOG.
  // These are the "groupB" signals for PB-05 dual. BBB crisis signals
  // (RA_BBB_GRADE_SUPPRESSION, RA_UNANSWERED_COMPLAINTS) are NOT review
  // signals — they are crisis signals (higher priority).
  return (
    code === 'RA_REVIEW_DROUGHT' ||
    code === 'RA_LOW_REVIEW_VOLUME' ||
    code === 'RA_UNADDRESSED_NEGATIVE_BACKLOG' ||
    code === 'RA_UNADDRESSED_POSITIVE_BACKLOG'
  );
}

export function isCrisisSignal(code: SignalCode): boolean {
  // Crisis signals: BBB grade suppression + unanswered complaints. These
  // trigger PB-04 (highest priority) and act as the `none` guard for PB-05.
  return code === 'RA_BBB_GRADE_SUPPRESSION' || code === 'RA_UNANSWERED_COMPLAINTS';
}

export function isVisualSignal(code: SignalCode): boolean {
  // Visual signals: VP_*, DS_PHOTO_DEFICIT. These trigger PB-06.
  if (code.startsWith('VP_')) return true;
  return code === 'DS_PHOTO_DEFICIT';
}

/**
 * Outreach-state signals: OX_*. These are derived from outreach execution
 * tables (openers, follow-ups, pitches, contact logs) — NOT from the audit
 * LLM. They are DISPLAY-ONLY in the triage card's "Triggered Signals"
 * section and do NOT feed playbook rule evaluation. The triage engine
 * skips them when evaluating rules (see TriageEngineService).
 */
export function isOutreachStateSignal(code: SignalCode): boolean {
  return code.startsWith('OX_');
}

// ─── Known-code validation ───────────────────────────────────────────────

export function isKnownSignalCode(code: string): code is (typeof KNOWN_SIGNAL_CODES)[number] {
  return (KNOWN_SIGNAL_CODES as readonly string[]).includes(code);
}

// ─── Registry row shape (DB) ─────────────────────────────────────────────

export interface SignalRegistryRow {
  id: string;
  code: string;
  family: string;
  label: string;
  description: string | null;
  detectionSource: DetectionSource;
  derivedRule: { field: string; op: string; threshold: number | boolean } | null;
  isActive: boolean;
}

// ─── Registry cache (in-process, short-lived) ────────────────────────────
//
// The cache holds the active signal registry rows so the extractor and
// engine don't re-query on every evaluation. Invalidated by
// `invalidateSignalRegistryCache()` — called by the signal registry CRUD
// service on any write.

interface SignalRegistryCache {
  rows: SignalRegistryRow[];
  expiresAt: number;
}

let registryCache: SignalRegistryCache | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Invalidate the in-process signal registry cache. Called by
 * MarketingSignalRegistryService on any write (create/update/delete/activate).
 */
export function invalidateSignalRegistryCache(): void {
  registryCache = null;
}

/**
 * Get the cached registry rows, or null if the cache is empty/expired.
 * The caller (extractor/engine) is responsible for fetching from the DB
 * when this returns null and populating the cache via `setSignalRegistryCache`.
 */
export function getSignalRegistryCache(): SignalRegistryRow[] | null {
  if (registryCache && registryCache.expiresAt > Date.now()) {
    return registryCache.rows;
  }
  registryCache = null;
  return null;
}

/**
 * Populate the signal registry cache. Called by the extractor after fetching
 * active signals from `mkt_signal_registry`.
 */
export function setSignalRegistryCache(rows: SignalRegistryRow[]): void {
  registryCache = { rows, expiresAt: Date.now() + CACHE_TTL_MS };
}

// ─── Label map (for UI "Triggered Signals" chips) ────────────────────────
//
// Falls back to the code itself when the code is not in the known set
// (admin-registered codes). At runtime, the UI should source labels from
// the registry via the API; this map is the compile-time fallback.

export const SIGNAL_LABELS: Record<string, string> = {
  RA_BBB_GRADE_SUPPRESSION: 'BBB Grade Suppression (C or below)',
  RA_UNANSWERED_COMPLAINTS: 'Unanswered BBB Complaints',
  RA_REVIEW_DROUGHT: 'Review Drought (>180 days)',
  RA_LOW_REVIEW_VOLUME: 'Low Review Volume (<15 total)',
  RA_UNADDRESSED_NEGATIVE_BACKLOG: 'Unaddressed Negative Review Backlog (≥3)',
  RA_UNADDRESSED_POSITIVE_BACKLOG: 'Unaddressed Positive Review Backlog (≥5)',
  DS_CLAIMED_STATUS: 'Unclaimed GBP Profile',
  DS_MISSING_PROFILE: 'Missing Platform Profile',
  DS_BROKEN_PROFILE_LINK: 'Broken Profile Link',
  DS_MISSING_SERVICE_MENU: 'Missing Service Menu',
  DS_MISSING_PRODUCT_CATALOG: 'Missing Product Catalog',
  DS_OUTDATED_HOURS: 'Outdated Hours of Operation',
  DS_OUTDATED_HOLIDAY_HOURS: 'Missing Holiday Hours',
  DS_PHOTO_DEFICIT: 'Photo Deficit (<5 photos)',
  WC_MISSING_WEBSITE: 'No Website Detected',
  WC_BROKEN_WEBSITE: 'Broken Website (dead URL)',
  WC_URL_MISMATCH: 'URL Mismatch (audit vs campaign)',
  WC_MISSING_CTA: 'Missing Call-to-Action',
  WC_MISSING_SERVICE_PAGES: 'Missing Service Pages',
  WC_MISSING_PRODUCT_BROWSING: 'Missing Product Browsing',
  WC_MISSING_AVAILABILITY_INQUIRY: 'Missing Availability Inquiry',
  WC_MISSING_PICKUP_DELIVERY: 'Missing Pickup/Delivery Pathway',
  WC_MOBILE_FRICTION: 'Mobile Friction',
  CP_NAP_NAME_DRIFT: 'NAP Name Drift',
  CP_NAP_ADDRESS_DRIFT: 'NAP Address Drift',
  CP_NAP_PHONE_DRIFT: 'NAP Phone Drift',
  CP_MISSING_CONTACT_INFO: 'Missing Contact Info',
  VP_MISSING_PROJECT_PHOTOS: 'Missing Project Photos',
  VP_STALE_SOCIAL_ACTIVITY: 'Stale Social Activity',
  VP_MISSING_STOREFRONT_PHOTOS: 'Missing Storefront Photos',
  VP_MISSING_PRODUCT_PHOTOS: 'Missing Product Photos',
};

export function signalLabel(code: SignalCode): string {
  return SIGNAL_LABELS[code] ?? code;
}
