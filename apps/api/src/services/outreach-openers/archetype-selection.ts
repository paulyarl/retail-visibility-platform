/**
 * Outreach Opener — Archetype Selection (deterministic, no LLM)
 *
 * Pure function over a campaign's latest `business_analysis` audit_data.
 * Selects one of 4 archetypes based on the strongest signal:
 *   A2 > A1 > A3 > A4
 *
 * Specificity + urgency wins. A recurring-theme negative beats a raw volume
 * gap; volume beats listing drift; listing drift beats a soft conversion gap.
 *
 * A5_DUAL_TRIAGE is NOT produced by selectArchetype — it is only emitted by
 * the TriageEngineService (services/triage) for PB-05 multi-signal footprint
 * triage. A5 is included in ArchetypeCode so the prompt builder and field
 * extractor can be exhaustive; selectArchetype itself never returns A5.
 *
 * See: docs/LocalBiz/marketing_ops_outreach_opener_sprint_plan.md §4
 *      docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md §6
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type ArchetypeCode = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';

export interface NegativeReviewTheme {
  theme: string;
  summary: string;
  observed_frequency?: string;
  supporting_review_count: number;
}

export interface CombinedReviewMetrics {
  observable_total_reviews?: number;
  observable_unanswered_reviews: number;
  observable_unanswered_rate_percent: number;
  observable_unanswered_negative_reviews: number;
  observable_unanswered_positive_reviews?: number;
  newest_observable_unanswered_review?: string;
  oldest_observable_unanswered_review?: string;
}

export interface NapConsistency {
  canonical_name?: string;
  overall_status: string;
  canonical_phone?: string;
  canonical_address?: string;
  name_variations?: string[];
  phone_variations?: string[];
  address_variations?: string[];
  material_issues?: any[];
}

export interface WebsiteAudit {
  url?: string;
  https?: string;
  status?: string;
  mobile_friendly?: string;
  call_to_action_present?: string;
  click_to_call_available?: string;
  has_booking?: boolean;
  contact_information_visible?: string;
  conversion_opportunities?: string[];
  // Product-visibility fields (Sprint 1 — Universal Recalibration)
  has_product_browsing?: boolean | null;
  has_availability_inquiry?: boolean | null;
  has_pickup_ordering?: boolean | null;
  has_delivery_option?: boolean | null;
  product_categories_visible?: string[];
}

export interface PlatformAudit {
  rating?: number;
  data_status?: string;
  total_reviews?: number;
  displayed_name?: string;
  profile_status?: string;
  displayed_phone?: string;
  displayed_address?: string;
  displayed_website?: string;
  observable_unanswered_reviews?: number;
  observable_response_rate_percent?: number;
  observable_unanswered_negative_reviews?: number;
  observable_unanswered_positive_reviews?: number;
  // Product-visibility fields (Sprint 1 — Universal Recalibration)
  photo_count?: number | null;
  photo_types?: string[];
  special_hours_present?: boolean | null;
}

export interface BusinessAnalysisAuditData {
  summary?: string;
  sources?: any[];
  platforms?: {
    google?: PlatformAudit;
    yelp?: PlatformAudit;
    facebook?: PlatformAudit;
    [key: string]: PlatformAudit | undefined;
  };
  combined_review_metrics: CombinedReviewMetrics;
  website?: WebsiteAudit;
  nap_consistency?: NapConsistency;
  negative_review_themes?: NegativeReviewTheme[];
  unanswered_negative_review_examples?: any[];
  digital_opportunity_score?: any;
  high_attention?: boolean;
  recommended_tier?: string;
  recommended_services?: string[];
  estimated_monthly_service_fee?: { minimum: number; maximum: number; currency: string };
  data_quality?: any;
  audit_metadata?: any;
  // Product-visibility fields (Sprint 1 — Universal Recalibration)
  business_type?: 'service' | 'product' | 'hybrid' | 'unable_to_verify' | null;
}

export interface ArchetypeSelection {
  archetype: ArchetypeCode;
  reason: string;
  theme?: NegativeReviewTheme;
}

// ─── Selection ──────────────────────────────────────────────────────────

/**
 * Deterministically select the best opener archetype from audit data.
 * No LLM, no async, no side effects — pure function.
 *
 * Priority: A2 > A1 > A6 > A3 > A4
 *
 * A6 (Product Visibility Gap) fires for product/hybrid businesses with no
 * product browsing. It sits above A3/A4 because product invisibility is more
 * urgent than listing drift or CTA gap for inventory businesses. A2/A1 still
 * win when reviews are the dominant pain — a grocery store with a cluster of
 * negative reviews should still get A2.
 */
export function selectArchetype(auditData: BusinessAnalysisAuditData): ArchetypeSelection {
  const metrics = auditData.combined_review_metrics;
  const themes = auditData.negative_review_themes ?? [];
  const nap = auditData.nap_consistency;
  const website = auditData.website;

  // A2: recurring-theme negatives (highest priority — specificity + urgency)
  if (
    themes.length > 0 &&
    metrics.observable_unanswered_negative_reviews > 0 &&
    themes.some((t) => t.supporting_review_count >= 3)
  ) {
    return {
      archetype: 'A2',
      reason: `recurring-theme negatives: "${themes[0].theme}" (${themes[0].supporting_review_count} reviews)`,
      theme: themes[0],
    };
  }

  // A1: review response gap
  if (
    metrics.observable_unanswered_rate_percent >= 15 ||
    metrics.observable_unanswered_reviews > 15
  ) {
    return {
      archetype: 'A1',
      reason: `review response gap: ${metrics.observable_unanswered_reviews} unanswered (${metrics.observable_unanswered_rate_percent}%)`,
    };
  }

  // A6: product visibility gap (product/hybrid business with no product browsing)
  // Fires when business_type is product/hybrid AND either:
  //   - has_product_browsing === false (website exists but no product browsing), OR
  //   - no website detected (WC_MISSING_WEBSITE would fire, but for a product
  //     business the lack of any online product presence is the dominant gap)
  const businessType = auditData.business_type;
  if (businessType === 'product' || businessType === 'hybrid') {
    const hasWebsite = !!website?.url || website?.status === 'working';
    const noProductBrowsing = website?.has_product_browsing === false;
    if (!hasWebsite || noProductBrowsing) {
      return {
        archetype: 'A6',
        reason: `product visibility gap: ${businessType} business with ${!hasWebsite ? 'no website' : 'no product browsing'}`,
      };
    }
  }

  // A3: listing inconsistency
  if (
    nap &&
    nap.overall_status !== 'consistent' &&
    ((nap.name_variations?.length ?? 0) > 0 ||
      (nap.address_variations?.length ?? 0) > 1 ||
      (nap.phone_variations?.length ?? 0) > 1)
  ) {
    return {
      archetype: 'A3',
      reason: `listing inconsistency: ${nap.overall_status}`,
    };
  }

  // A4: conversion / CTA gap
  if (
    website &&
    (website.call_to_action_present === 'no' ||
      website.click_to_call_available === 'no' ||
      website.has_booking === false)
  ) {
    const missingCta = website.has_booking === false
      ? 'online booking'
      : website.call_to_action_present === 'no'
        ? 'call-to-action'
        : 'click-to-call';
    return {
      archetype: 'A4',
      reason: `conversion/CTA gap: missing ${missingCta}`,
    };
  }

  // Fallback: A1 with raw unanswered count
  return {
    archetype: 'A1',
    reason: `fallback: ${metrics?.observable_unanswered_reviews ?? 0} unanswered reviews`,
  };
}
