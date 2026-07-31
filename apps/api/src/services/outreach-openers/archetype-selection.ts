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
 * See: docs/LocalBiz/marketing_ops_outreach_opener_sprint_plan.md §4
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type ArchetypeCode = 'A1' | 'A2' | 'A3' | 'A4';

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
 * Priority: A2 > A1 > A3 > A4
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
