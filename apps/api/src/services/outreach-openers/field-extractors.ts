/**
 * Outreach Opener — Per-Archetype Field Extraction
 *
 * Each archetype extracts only the fields its prompt needs from audit_data,
 * producing a focused JSON payload for the LLM. The runner pre-extracts
 * before calling the archetype prompt, so the LLM gets a minimal context.
 *
 * See: docs/LocalBiz/marketing_ops_outreach_opener_sprint_plan.md §5
 */

import type {
  BusinessAnalysisAuditData,
  NegativeReviewTheme,
  ArchetypeCode,
} from './archetype-selection';
import {
  type SignalSeverity,
  type TriggeredSignalEntry,
  type TriggeredSignalContext,
  computePrimarySignalSeverity,
  buildTriggeredSignalContext,
  getStrongestCoOccurringSignal,
  hasMaterialDrift,
} from './signal-magnitude';
import type { SignalCode } from '../triage/signal-taxonomy';

// ─── Types ──────────────────────────────────────────────────────────────

export interface CommonFields {
  business_name: string;
  contact_name: string | null;
  tone: string;
  // NAP context — gives the AI agent enough identifying info to match
  // this business against publicly available data (GBP, Yelp, etc.) when
  // crafting a hyper-specific opener. All optional since prospecting
  // campaigns may have partial data.
  city: string | null;
  state: string | null;
  phone: string | null;
  website_url: string | null;
  // ── Signal magnitude context (generalized severity fix) ──
  // All triggered signals ranked by severity, so every prompt knows what
  // else is going on and can lead with the strongest signal when its
  // primary is weak. Populated by the caller (OutreachOpenerService) from
  // the signal extractor + audit data.
  triggered_signals: TriggeredSignalEntry[];
  // The severity of this archetype's primary signal — determines which
  // preamble variant the prompt builder uses. Computed per-archetype by
  // computePrimarySignalSeverity.
  primary_signal_severity: SignalSeverity;
  // The strongest co-occurring signal that is more severe than the
  // archetype's primary signal. When non-null, the prompt should
  // acknowledge/lead with this signal instead of its default hook.
  // Null when the primary signal is already the strongest (or tied).
  strongest_co_occurring: TriggeredSignalEntry | null;
}

export interface A1Fields extends CommonFields {
  unanswered_total: number;
  unanswered_negatives: number;
  unanswered_rate_percent: number;
  platforms: string[];
  newest_unanswered_date: string | null;
}

export interface A2Fields extends CommonFields {
  theme: string;
  theme_summary: string;
  theme_review_count: number;
  secondary_theme: string | null;
  secondary_theme_review_count: number | null;
  unanswered_negatives: number;
  example_complaint: string | null;
  example_platform: string | null;
  example_date: string | null;
}

export interface A3Fields extends CommonFields {
  canonical_name: string | null;
  name_variations: string[];
  address_variations: string[];
  phone_variations: string[];
  platforms_with_listings: string[];
  overall_status: string;
  /**
   * True when at least one NAP variation type has genuinely different
   * normalized values (not just formatting/cosmetic differences like
   * "Rd" vs "Road" or "(317) 297-7036" vs "317-297-7036").
   *
   * When false, the A3 prompt uses a soft "consistency" framing instead
   * of the crisis "wrong location / dead numbers" framing — because the
   * audit's own `overall_status` is "consistent" and the variations are
   * cosmetic. Asserting a crisis that the data contradicts destroys the
   * opener's credibility.
   */
  material_drift: boolean;
  /**
   * True when the website audit reports a dead/timeout/dns_error/redirect_loop
   * status. PB-01 (Profile Repair & Listing Drift) fires for WC_BROKEN_WEBSITE,
   * and a broken website is a harder, more provable hook than cosmetic NAP
   * formatting. When true AND material_drift is false, the A3 prompt leads
   * with the broken website instead of the NAP variations.
   */
  website_broken: boolean;
  /**
   * True when the website has no detectable CTA (no call-to-action, no
   * click-to-call, no booking). Surfaces WC_MISSING_CTA context so the
   * prompt can fold it into the consequence line when relevant.
   */
  website_missing_cta: boolean;
}

export interface A4Fields extends CommonFields {
  missing_cta: string;
  website_url: string | null;
  conversion_opportunities: string[];
}

export type ArchetypeFields = A1Fields | A2Fields | A3Fields | A4Fields | A5Fields | A6Fields;

/**
 * A5: Dual-Signal Footprint Triage. Combines repair (NAP/URL) and review-gap
 * context without stacking stats. Populated by Sprint 6; the field shape is
 * defined here so the dispatcher is exhaustive and the triage engine can
 * reference it.
 */
export interface A5Fields extends CommonFields {
  repair_signals: string[];              // ['nap_inconsistent', 'dead_url', 'url_mismatch']
  days_since_last_review: number;
  unaddressed_review_count: number;
  platforms_with_listings: string[];
}

/**
 * A6: Product Visibility Gap. For product/inventory businesses (grocery
 * stores, bakeries, specialty markets) with no online product browsing.
 * Populated by Sprint 1 (Universal Recalibration); the field shape is
 * defined here so the dispatcher is exhaustive and A6 prompt can reference it.
 */
export interface A6Fields extends CommonFields {
  business_type: 'product' | 'hybrid';
  has_website: boolean;
  has_product_browsing: boolean;
  has_availability_inquiry: boolean;
  has_pickup_option: boolean;
  has_delivery_option: boolean;
  photo_count: number;
  photo_types: string[];
  missing_photo_types: string[];         // ['storefront','product'] — what's absent
  product_categories_sample: string[];   // from GBP or website, if visible
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Map internal platform keys to human-readable names for the prompt. */
const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
};

function platformLabels(auditData: BusinessAnalysisAuditData): string[] {
  const platforms = auditData.platforms ?? {};
  return Object.keys(platforms)
    .filter((k) => PLATFORM_LABELS[k])
    .map((k) => PLATFORM_LABELS[k]);
}

/** Pick the highest-impact missing CTA from the website audit. */
function pickMissingCta(website: NonNullable<BusinessAnalysisAuditData['website']>): string {
  if (website.has_booking === false) return 'online_booking';
  if (website.call_to_action_present === 'no') return 'call_to_action';
  if (website.click_to_call_available === 'no') return 'click_to_call';
  return 'online_booking';
}

// ─── NAP normalization (material vs cosmetic drift) ─────────────────────
//
// hasMaterialDrift is imported from signal-magnitude.ts (shared with the
// severity computation module). The local isDeadUrl/isMissingCta helpers
// remain here for the A3 field extractor's website_broken/website_missing_cta
// fields.

function isDeadUrl(website: BusinessAnalysisAuditData['website']): boolean {
  const status = website?.status?.toLowerCase();
  return status === 'dead' || status === 'timeout' || status === 'dns_error' || status === 'redirect_loop';
}

function isMissingCta(website: BusinessAnalysisAuditData['website']): boolean {
  if (!website) return false;
  const hasCta =
    website.call_to_action_present === 'yes' ||
    website.click_to_call_available === 'yes' ||
    website.has_booking === true;
  return !hasCta;
}

// ─── Extractors ─────────────────────────────────────────────────────────

export function extractA1Fields(
  auditData: BusinessAnalysisAuditData,
  common: CommonFields,
): A1Fields {
  const m = auditData.combined_review_metrics;
  return {
    ...common,
    unanswered_total: m.observable_unanswered_reviews,
    unanswered_negatives: m.observable_unanswered_negative_reviews,
    unanswered_rate_percent: m.observable_unanswered_rate_percent,
    platforms: platformLabels(auditData),
    newest_unanswered_date: m.newest_observable_unanswered_review ?? null,
  };
}

export function extractA2Fields(
  auditData: BusinessAnalysisAuditData,
  common: CommonFields,
  theme: NegativeReviewTheme,
): A2Fields {
  const m = auditData.combined_review_metrics;
  const themes = auditData.negative_review_themes ?? [];
  const secondary = themes[1];
  const examples = auditData.unanswered_negative_review_examples ?? [];
  const firstExample = examples[0];

  return {
    ...common,
    theme: theme.theme,
    theme_summary: theme.summary,
    theme_review_count: theme.supporting_review_count,
    secondary_theme:
      secondary && secondary.supporting_review_count >= 3 ? secondary.theme : null,
    secondary_theme_review_count:
      secondary && secondary.supporting_review_count >= 3
        ? secondary.supporting_review_count
        : null,
    unanswered_negatives: m.observable_unanswered_negative_reviews,
    example_complaint: firstExample?.complaint_summary ?? null,
    example_platform: firstExample?.platform ?? null,
    example_date: firstExample?.date ?? null,
  };
}

export function extractA3Fields(
  auditData: BusinessAnalysisAuditData,
  common: CommonFields,
): A3Fields {
  const nap = auditData.nap_consistency;
  const website = auditData.website;
  return {
    ...common,
    canonical_name: nap?.canonical_name ?? null,
    name_variations: nap?.name_variations ?? [],
    address_variations: nap?.address_variations ?? [],
    phone_variations: nap?.phone_variations ?? [],
    platforms_with_listings: platformLabels(auditData),
    overall_status: nap?.overall_status ?? 'unknown',
    material_drift: nap ? hasMaterialDrift(nap) : false,
    website_broken: isDeadUrl(website),
    website_missing_cta: isMissingCta(website),
  };
}

export function extractA4Fields(
  auditData: BusinessAnalysisAuditData,
  common: CommonFields,
): A4Fields {
  const website = auditData.website;
  return {
    ...common,
    missing_cta: website ? pickMissingCta(website) : 'online_booking',
    website_url: website?.url ?? null,
    conversion_opportunities: website?.conversion_opportunities ?? [],
  };
}

/**
 * A5: Dual-Signal Footprint Triage. Combines repair-signal identifiers with
 * review-gap counts. Deliberately does NOT stack stats — the opener leads
 * with the combined footprint, not two numbers.
 *
 * Sprint 6 wires this into the A5 prompt; the extractor is defined now so
 * the dispatcher is exhaustive.
 */
export function extractA5Fields(
  auditData: BusinessAnalysisAuditData,
  common: CommonFields,
): A5Fields {
  const nap = auditData.nap_consistency;
  const website = auditData.website;
  const m = auditData.combined_review_metrics;

  const repairSignals: string[] = [];
  if (nap && nap.overall_status !== 'consistent') repairSignals.push('nap_inconsistent');
  if (website && ['dead', 'timeout', 'dns_error', 'redirect_loop'].includes(website.status?.toLowerCase() ?? '')) {
    repairSignals.push('dead_url');
  }

  return {
    ...common,
    repair_signals: repairSignals,
    days_since_last_review: -1, // filled by the caller from campaign.last_review_date
    unaddressed_review_count: m.observable_unanswered_reviews,
    platforms_with_listings: platformLabels(auditData),
  };
}

/**
 * A6: Product Visibility Gap. Extracts product-visibility fields from the
 * audit data for the A6 prompt. The business_type is resolved by the caller
 * (via MarketingBusinessTypeService) and passed through the auditData's
 * business_type field.
 */
export function extractA6Fields(
  auditData: BusinessAnalysisAuditData,
  common: CommonFields,
): A6Fields {
  const website = auditData.website;
  const google = auditData.platforms?.google;

  const hasWebsite = !!website?.url || website?.status === 'working';
  const hasProductBrowsing = website?.has_product_browsing === true;
  const hasAvailabilityInquiry = website?.has_availability_inquiry === true;
  const hasPickup = website?.has_pickup_ordering === true;
  const hasDelivery = website?.has_delivery_option === true;

  const photoCount = google?.photo_count ?? 0;
  const photoTypes = google?.photo_types ?? [];
  const knownPhotoTypes = ['storefront', 'exterior', 'interior', 'product', 'team', 'logo'];
  const missingPhotoTypes = knownPhotoTypes.filter((t) => !photoTypes.includes(t));

  const productCategories = website?.product_categories_visible ?? [];

  const businessType = auditData.business_type;
  const resolvedType: 'product' | 'hybrid' =
    businessType === 'service' ? 'product' : (businessType as 'product' | 'hybrid') ?? 'product';

  return {
    ...common,
    business_type: resolvedType,
    has_website: hasWebsite,
    has_product_browsing: hasProductBrowsing,
    has_availability_inquiry: hasAvailabilityInquiry,
    has_pickup_option: hasPickup,
    has_delivery_option: hasDelivery,
    photo_count: photoCount,
    photo_types: photoTypes,
    missing_photo_types: missingPhotoTypes,
    product_categories_sample: productCategories,
  };
}

// ─── Dispatcher ─────────────────────────────────────────────────────────

export function extractFields(
  archetype: ArchetypeCode,
  auditData: BusinessAnalysisAuditData,
  common: CommonFields,
  theme?: NegativeReviewTheme,
): ArchetypeFields {
  // Compute the archetype's primary signal severity + strongest co-occurring
  // signal, and merge them into the common fields so every archetype's
  // extracted fields carry the signal magnitude context. The prompt builder
  // uses these to branch the preamble and acknowledge stronger signals.
  const primarySeverity = computePrimarySignalSeverity(archetype, auditData);
  const triggeredSignals = common.triggered_signals ?? [];
  const strongestCoOccurring = triggeredSignals.length > 0
    ? getStrongestCoOccurringSignal(
        { signals: triggeredSignals, strongest: triggeredSignals[0] ?? null },
        primarySeverity,
      )
    : null;
  const commonWithSeverity: CommonFields = {
    ...common,
    primary_signal_severity: common.primary_signal_severity ?? primarySeverity,
    strongest_co_occurring: common.strongest_co_occurring ?? strongestCoOccurring,
  };

  switch (archetype) {
    case 'A1':
      return extractA1Fields(auditData, commonWithSeverity);
    case 'A2':
      if (!theme) throw new Error('A2 requires a theme — selection function must provide one');
      return extractA2Fields(auditData, commonWithSeverity, theme);
    case 'A3':
      return extractA3Fields(auditData, commonWithSeverity);
    case 'A4':
      return extractA4Fields(auditData, commonWithSeverity);
    case 'A5':
      return extractA5Fields(auditData, commonWithSeverity);
    case 'A6':
      return extractA6Fields(auditData, commonWithSeverity);
  }
}
