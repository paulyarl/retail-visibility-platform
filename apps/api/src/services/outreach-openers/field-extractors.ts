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
}

export interface A4Fields extends CommonFields {
  missing_cta: string;
  website_url: string | null;
  conversion_opportunities: string[];
}

export type ArchetypeFields = A1Fields | A2Fields | A3Fields | A4Fields | A5Fields;

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
  return {
    ...common,
    canonical_name: nap?.canonical_name ?? null,
    name_variations: nap?.name_variations ?? [],
    address_variations: nap?.address_variations ?? [],
    phone_variations: nap?.phone_variations ?? [],
    platforms_with_listings: platformLabels(auditData),
    overall_status: nap?.overall_status ?? 'unknown',
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

// ─── Dispatcher ─────────────────────────────────────────────────────────

export function extractFields(
  archetype: ArchetypeCode,
  auditData: BusinessAnalysisAuditData,
  common: CommonFields,
  theme?: NegativeReviewTheme,
): ArchetypeFields {
  switch (archetype) {
    case 'A1':
      return extractA1Fields(auditData, common);
    case 'A2':
      if (!theme) throw new Error('A2 requires a theme — selection function must provide one');
      return extractA2Fields(auditData, common, theme);
    case 'A3':
      return extractA3Fields(auditData, common);
    case 'A4':
      return extractA4Fields(auditData, common);
    case 'A5':
      return extractA5Fields(auditData, common);
  }
}
