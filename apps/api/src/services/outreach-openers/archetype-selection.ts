/**
 * Outreach Opener — Archetype Selection (deterministic, no LLM)
 *
 * Pure function over a campaign's latest `business_analysis` audit_data.
 * Selects one of the archetypes based on the strongest signal:
 *   A2 > A8 > A1 > A6 > A3 > A7 > A4
 *
 * Specificity + urgency wins. A recurring-theme negative beats a missing
 * profile footprint; missing profiles beat a raw volume gap; volume beats
 * product invisibility; product invisibility beats listing drift; listing
 * drift beats a website gap; a website gap beats a soft conversion gap.
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

import { isSocialPlatformHost, isBuilderSubdomainHost } from '../triage/website-host-classification';
import { hasMaterialNapVariance } from './signal-magnitude';

export type ArchetypeCode = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8';

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
  // Platform Availability Verification — render control records. Present
  // when the Platform Availability Verification directive ran (Gold Standard
  // block was injected). Used by the signal extractor to gate DS_MISSING_PROFILE
  // on control-confirmed absence rather than bare render failure.
  render_controls?: RenderControlEntry[];
  // Model-emitted triage signal codes (RA_*, DS_*, WC_*, CP_*, VP_*). The
  // signal extractor copies these verbatim; selectArchetype reads them for
  // the presence/integrity family (A8) — absence evidence the platform map
  // cannot express (the profile_status enum has no "absent" state).
  detected_signals?: string[];
}

export interface RenderControlEntry {
  platform: string;
  business_profile_url?: string | null;
  business_rendered?: boolean | null;
  control_business?: string | null;
  control_url?: string | null;
  control_rendered?: boolean | null;
  access_barrier?: string | null;
  determination: 'business_specific_failure' | 'platform_available' | 'unable_to_verify';
}

export interface ArchetypeSelection {
  archetype: ArchetypeCode;
  reason: string;
  theme?: NegativeReviewTheme;
}

// ─── A8 presence/integrity signal family (PB-09) ─────────────────────────
//
// The codes that mark a business as absent, unclaimed, invisible, or
// integrity-blocked on a platform. Kept as a Set for O(1) membership in
// selectArchetype; PB-09's matching_rules carry the same list (plus the
// registry's primary_playbook wiring).
export const PRESENCE_SIGNAL_CODES: ReadonlySet<string> = new Set([
  'DS_MISSING_PROFILE',
  'DS_CLAIMED_STATUS',
  'DS_ZERO_INDEXED_PRESENCE',
  'DS_PROFILE_SUSPENDED',
  'DS_DUPLICATE_LISTING',
  'DS_HIJACKED_LISTING',
  'DS_OWNERSHIP_DISPUTE',
  'DS_ADDRESS_VERIFICATION_BLOCK',
]);

// ─── Selection ──────────────────────────────────────────────────────────

/**
 * Deterministically select the best opener archetype from audit data.
 * No LLM, no async, no side effects — pure function.
 *
 * Priority: A2 > A8 > A1 > A6 > A3 > A7 > A4
 *
 * A8 (Profile Presence) fires when the business is missing or unclaimed on
 * the platforms customers check — absent listings, zero indexed presence, or
 * an integrity failure (suspended / duplicated / hijacked / disputed /
 * unverifiable profile). It sits just under A2 (a public complaint still
 * trumps invisibility) and above A1 — a business that lacks the platforms
 * customers search has a more fundamental gap than one with unanswered
 * reviews on the platforms it has. Matches the PB-09 cascade position
 * (rank 3, directly under PB-05's multi-signal dual).
 *
 * A6 (Product Visibility Gap) fires for product/hybrid businesses whose site
 * exists but has no product browsing. It sits above A3/A4 because product
 * invisibility is more urgent than listing drift or CTA gap for inventory
 * businesses. A2/A1 still win when reviews are the dominant pain — a grocery
 * store with a cluster of negative reviews should still get A2.
 *
 * A7 (Website Gap) fires when the business has no owned, usable website —
 * no site at all, a third-party/social page used as the website, a free
 * builder subdomain, or a dead URL. It sits below A3 (listing drift is a
 * sharper, more provable repair signal when both exist) and above A4 (a CTA
 * gap presumes a site to fix; a website gap is the more fundamental problem).
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

  // A8: profile presence — absent, unclaimed, or integrity-failed on a key
  // platform. The profile_status enum has no "absent" state, so the evidence
  // is the model-emitted signal + render-control-confirmed absences (the
  // same two sources the signal extractor turns into DS_MISSING_PROFILE).
  {
    const detected = auditData.detected_signals ?? [];
    const presenceHits = detected.filter((c) => PRESENCE_SIGNAL_CODES.has(c));
    const confirmedAbsent = (auditData.render_controls ?? []).filter(
      (r) => r.determination === 'business_specific_failure',
    );
    if (presenceHits.length > 0 || confirmedAbsent.length > 0) {
      const detail = confirmedAbsent.length > 0
        ? `absent from ${confirmedAbsent.map((r) => r.platform).join(', ')}`
        : presenceHits.includes('DS_CLAIMED_STATUS')
          ? 'unclaimed profile'
          : `signal: ${presenceHits[0]}`;
      return {
        archetype: 'A8',
        reason: `profile presence gap: ${detail}`,
      };
    }
  }

  // A1: review response gap — material on BOTH dimensions: a meaningful
  // unanswered rate (≥25%, so a 2-review business at 50% doesn't fire) AND a
  // meaningful unanswered count (≥5, so 5/200 at 2.5% doesn't fire).
  if (
    metrics.observable_unanswered_rate_percent >= 25 &&
    metrics.observable_unanswered_reviews >= 5
  ) {
    return {
      archetype: 'A1',
      reason: `review response gap: ${metrics.observable_unanswered_reviews} unanswered (${metrics.observable_unanswered_rate_percent}%)`,
    };
  }

  // A6: product visibility gap (product/hybrid business whose site exists but
  // has no product browsing). The "no website at all" half of the original A6
  // branch moved to A7 — a product business with no owned usable site is a
  // website gap, not a product-browsing gap (spec §7 G-3 ordering fix).
  const businessType = auditData.business_type;
  if (businessType === 'product' || businessType === 'hybrid') {
    const noProductBrowsing = website?.has_product_browsing === false;
    if (noProductBrowsing) {
      return {
        archetype: 'A6',
        reason: `product visibility gap: ${businessType} business with no product browsing`,
      };
    }
  }

  // A3: listing inconsistency — material variance only. Formatting-only name
  // differences (case, punctuation, legal suffixes) and unable_to_verify do
  // not fire; material_issues is analyst-authoritative when populated.
  if (hasMaterialNapVariance(nap)) {
    return {
      archetype: 'A3',
      reason: `listing inconsistency: ${nap!.overall_status}`,
    };
  }

  // A7: website gap — no owned, usable website. Fires when the business has
  // no site at all, uses a social/messaging page as its "website", sits on a
  // free builder subdomain, or has a dead URL. Sits after A3 (listing drift is
  // the sharper repair signal) and before A4 (a CTA gap presumes a site).
  {
    const websiteStatus = website?.status?.toLowerCase();
    const hasWebsite = !!website?.url || websiteStatus === 'working';
    const noOwnedUsableSite =
      !hasWebsite ||
      websiteStatus === 'none_found' ||
      websiteStatus === 'social_media_only' ||
      websiteStatus === 'broken' ||
      isSocialPlatformHost(website?.url) ||
      isBuilderSubdomainHost(website?.url);
    if (noOwnedUsableSite) {
      const detail = isSocialPlatformHost(website?.url)
        ? 'website field is a social page'
        : isBuilderSubdomainHost(website?.url)
          ? 'website is on a free builder subdomain'
          : websiteStatus === 'broken'
            ? 'website URL is dead'
            : 'no website found';
      return {
        archetype: 'A7',
        reason: `website gap: ${detail}`,
      };
    }
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
