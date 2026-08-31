/**
 * SignalExtractor — emits the canonical SignalCode[] array
 *
 * Consumes both mkt_campaigns_list columns and the latest business_analysis
 * audit_data JSON, plus operator-supplied BBB pre-flight inputs, and emits
 * the standardized SignalCode[] array that the triage engine evaluates.
 *
 * Extraction precedence (per Sprint 2A task 2):
 *   1. model_emitted — if audit_data.detected_signals[] is present (new audit
 *      prompt contract), use it directly as the canonical set.
 *   2. derived — for legacy audits without detected_signals[], derive codes
 *      from raw fields + thresholds (the bulk of this file).
 *   3. operator_input — BBB codes (RA_BBB_GRADE_SUPPRESSION,
 *      RA_UNANSWERED_COMPLAINTS) are only emitted when the operator supplies
 *      bbb grade / unanswered complaint count via the triage pre-flight form.
 *
 * Pure function — no DB access, no side effects. The registry cache is read
 * only to label detected signals for the recommendation; code emission is
 * deterministic from the inputs.
 *
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md
 * Sprint 2A — Platform Signal Taxonomy & Signal-Code Pipeline
 */

import type {
  BusinessAnalysisAuditData,
  WebsiteAudit,
  NapConsistency,
  PlatformAudit,
} from '../outreach-openers/archetype-selection';
import type { SignalExtractorInput } from './types';
import { isKnownSignalCode, signalLabel, type SignalCode } from './signal-taxonomy';

// ─── Thresholds (Sprint 2A §2A.1 + registry derived_rule defaults) ───────
//
// Centralized so the extractor and tests share one definition. These match
// the derived_rule JSON seeded in migration 158_mkt_signal_registry.sql.

const REVIEW_DROUGHT_DAYS = 180;        // RA_REVIEW_DROUGHT
const LOW_REVIEW_VOLUME_THRESHOLD = 15; // RA_LOW_REVIEW_VOLUME
const NEGATIVE_BACKLOG_THRESHOLD = 3;   // RA_UNADDRESSED_NEGATIVE_BACKLOG
const POSITIVE_BACKLOG_THRESHOLD = 5;   // RA_UNADDRESSED_POSITIVE_BACKLOG
const PHOTO_DEFICIT_THRESHOLD_SERVICE = 5;  // DS_PHOTO_DEFICIT (service businesses)
const PHOTO_DEFICIT_THRESHOLD_PRODUCT = 10; // DS_PHOTO_DEFICIT (product/inventory businesses)

// ─── Helpers ─────────────────────────────────────────────────────────────

function daysSince(date: Date | null | undefined, now: Date = new Date()): number {
  if (!date) return -1;
  const ms = now.getTime() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function isDeadUrl(website: WebsiteAudit | undefined): boolean {
  const status = website?.status?.toLowerCase();
  return status === 'dead' || status === 'timeout' || status === 'dns_error' || status === 'redirect_loop';
}

function isUrlMismatch(
  website: WebsiteAudit | undefined,
  campaignWebsiteUrl: string | null | undefined,
): boolean {
  if (!website?.url || !campaignWebsiteUrl) return false;
  return normalizeUrl(website.url) !== normalizeUrl(campaignWebsiteUrl);
}

function isYesLike(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    return v === 'yes' || v === 'true' || v === 'present' || v === '1';
  }
  return false;
}

function isNoLike(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    return v === 'no' || v === 'false' || v === 'absent' || v === 'missing' || v === '0';
  }
  return false;
}

function isCrisisBbbGrade(grade: string | undefined): boolean {
  if (!grade) return false;
  const g = grade.toUpperCase().trim();
  // C, D, F trigger RA_BBB_GRADE_SUPPRESSION. B/B+/B- are acceptable.
  return g === 'C' || g === 'C-' || g === 'C+' || g === 'D' || g === 'D-' || g === 'D+' || g === 'F';
}

// ─── Combined review metrics ─────────────────────────────────────────────

function combinedReviewCount(auditData: BusinessAnalysisAuditData | null | undefined): number {
  if (!auditData?.combined_review_metrics) return 0;
  const m = auditData.combined_review_metrics;
  // Prefer the explicit total if present; otherwise sum platform totals.
  if (typeof (m as any).total_reviews === 'number') return (m as any).total_reviews;
  const platforms = auditData.platforms ?? {};
  const google = platforms.google?.total_reviews ?? 0;
  const yelp = platforms.yelp?.total_reviews ?? 0;
  const facebook = platforms.facebook?.total_reviews ?? 0;
  return google + yelp + facebook;
}

function unansweredNegativeReviews(auditData: BusinessAnalysisAuditData | null | undefined): number {
  if (!auditData?.combined_review_metrics) return 0;
  const m = auditData.combined_review_metrics as any;
  if (typeof m.observable_unanswered_negative_reviews === 'number') {
    return m.observable_unanswered_negative_reviews;
  }
  // Fallback: count from platform audits
  const platforms = auditData.platforms ?? {};
  return (
    (platforms.google?.observable_unanswered_negative_reviews ?? 0) +
    (platforms.yelp?.observable_unanswered_negative_reviews ?? 0) +
    (platforms.facebook?.observable_unanswered_negative_reviews ?? 0)
  );
}

function unansweredPositiveReviews(auditData: BusinessAnalysisAuditData | null | undefined): number {
  if (!auditData?.combined_review_metrics) return 0;
  const m = auditData.combined_review_metrics as any;
  if (typeof m.observable_unanswered_positive_reviews === 'number') {
    return m.observable_unanswered_positive_reviews;
  }
  const platforms = auditData.platforms ?? {};
  return (
    (platforms.google?.observable_unanswered_positive_reviews ?? 0) +
    (platforms.yelp?.observable_unanswered_positive_reviews ?? 0) +
    (platforms.facebook?.observable_unanswered_positive_reviews ?? 0)
  );
}

// ─── Main extractor ──────────────────────────────────────────────────────

/**
 * Extract the canonical SignalCode[] from campaign columns, audit_data, and
 * operator BBB inputs.
 *
 * Precedence: model_emitted detected_signals[] first (new audit contract);
 * derived codes from raw fields for legacy audits; operator_input BBB codes
 * always added when supplied.
 */
export function extractSignals(input: SignalExtractorInput): SignalCode[] {
  const { campaign, auditData, bbb } = input;
  const signals = new Set<SignalCode>();

  // ── 1. model_emitted: detected_signals[] from the new audit prompt contract ──
  // The seek prompts (v1 + v2) emit a top-level `detected_signals` string
  // array constrained to the platform's signal codes. This is the canonical
  // path — derived codes below are the legacy fallback for audits that
  // predate the signal-aware prompt contract.
  //
  // §S1 guardrail: INT_* (Intelligence-scope discovery signals) are excluded
  // from triage evaluation. They are discovery signals, not audit signals,
  // and must never flow into playbook rule evaluation. The INT family is
  // kept strictly separate from Business-Audit signal families (RA/DS/WC/CP/VP).
  const modelEmitted = (auditData as any)?.detected_signals;
  if (Array.isArray(modelEmitted)) {
    for (const code of modelEmitted) {
      if (typeof code === 'string' && code.length > 0) {
        // §S1: filter out INT_* codes — they are discovery signals, not audit signals.
        if (code.startsWith('INT_')) continue;
        // Accept known + unknown codes (forward-compatible). Unknown codes
        // are validated against the registry at runtime by the engine.
        signals.add(code as SignalCode);
      }
    }
  }

  // ── 2. derived: compute codes from raw fields (legacy audit fallback) ─────
  //
  // Only derive codes that are NOT already model-emitted (avoid duplicates).
  // We still derive BBB codes below from operator input regardless.

  // RA_REVIEW_DROUGHT — last_review_date older than 180 days
  if (!signals.has('RA_REVIEW_DROUGHT')) {
    const days = daysSince(campaign.last_review_date);
    if (days >= REVIEW_DROUGHT_DAYS) {
      signals.add('RA_REVIEW_DROUGHT');
    }
  }

  // RA_LOW_REVIEW_VOLUME — combined review count < 15
  if (!signals.has('RA_LOW_REVIEW_VOLUME')) {
    const total = combinedReviewCount(auditData);
    if (total > 0 && total < LOW_REVIEW_VOLUME_THRESHOLD) {
      signals.add('RA_LOW_REVIEW_VOLUME');
    }
  }

  // RA_UNADDRESSED_NEGATIVE_BACKLOG — ≥3 unanswered negative reviews
  if (!signals.has('RA_UNADDRESSED_NEGATIVE_BACKLOG')) {
    const neg = unansweredNegativeReviews(auditData);
    if (neg >= NEGATIVE_BACKLOG_THRESHOLD) {
      signals.add('RA_UNADDRESSED_NEGATIVE_BACKLOG');
    }
  }

  // RA_UNADDRESSED_POSITIVE_BACKLOG — ≥5 unanswered positive reviews
  if (!signals.has('RA_UNADDRESSED_POSITIVE_BACKLOG')) {
    const pos = unansweredPositiveReviews(auditData);
    if (pos >= POSITIVE_BACKLOG_THRESHOLD) {
      signals.add('RA_UNADDRESSED_POSITIVE_BACKLOG');
    }
  }

  // DS_* — digital surface signals from audit_data
  if (auditData) {
    const platforms = auditData.platforms ?? {};
    const google = platforms.google;

    // DS_CLAIMED_STATUS — GBP not claimed
    if (!signals.has('DS_CLAIMED_STATUS')) {
      if (campaign.gbp_claimed === false) {
        signals.add('DS_CLAIMED_STATUS');
      } else if (google?.profile_status && isNoLike(google.profile_status)) {
        signals.add('DS_CLAIMED_STATUS');
      }
    }

    // DS_MISSING_PROFILE — business absent from a key platform
    if (!signals.has('DS_MISSING_PROFILE')) {
      const missingPlatform =
        !google || google.data_status === 'missing' || google.data_status === 'not_found';
      if (missingPlatform) {
        signals.add('DS_MISSING_PROFILE');
      }
    }

    // DS_BROKEN_PROFILE_LINK — profile URL returns dead status
    if (!signals.has('DS_BROKEN_PROFILE_LINK')) {
      const anyBroken = Object.values(platforms).some(
        (p) => p && isDeadUrl({ status: p.data_status } as any),
      );
      if (anyBroken) {
        signals.add('DS_BROKEN_PROFILE_LINK');
      }
    }

    // DS_MISSING_SERVICE_MENU — GBP service menu not populated
    if (!signals.has('DS_MISSING_SERVICE_MENU')) {
      const services = (auditData as any).recommended_services;
      if (Array.isArray(services) && services.length === 0) {
        signals.add('DS_MISSING_SERVICE_MENU');
      }
    }

    // DS_OUTDATED_HOURS — hours missing/inconsistent/outdated
    if (!signals.has('DS_OUTDATED_HOURS')) {
      const hours = (google as any)?.hours_status;
      if (hours && isNoLike(hours)) {
        signals.add('DS_OUTDATED_HOURS');
      }
    }

    // DS_PHOTO_DEFICIT — fewer than threshold photos on GBP (business-type-sensitive)
    if (!signals.has('DS_PHOTO_DEFICIT')) {
      const photoCount = (google as any)?.photo_count;
      if (typeof photoCount === 'number') {
        const businessType = (auditData as any).business_type;
        const threshold = businessType === 'product' || businessType === 'hybrid'
          ? PHOTO_DEFICIT_THRESHOLD_PRODUCT
          : PHOTO_DEFICIT_THRESHOLD_SERVICE;
        if (photoCount < threshold) {
          signals.add('DS_PHOTO_DEFICIT');
        }
      }
    }

    // DS_OUTDATED_HOLIDAY_HOURS — GBP special/holiday hours are absent
    if (!signals.has('DS_OUTDATED_HOLIDAY_HOURS')) {
      const specialHours = (google as any)?.special_hours_present;
      if (specialHours === false || specialHours === null) {
        // Only emit when the field is explicitly false (agent confirmed absence).
        // null/undefined means the agent didn't assess it — don't emit.
        if (specialHours === false) {
          signals.add('DS_OUTDATED_HOLIDAY_HOURS');
        }
      }
    }

    // VP_MISSING_STOREFRONT_PHOTOS — GBP photos lack storefront/exterior/interior
    if (!signals.has('VP_MISSING_STOREFRONT_PHOTOS')) {
      const photoTypes = (google as any)?.photo_types;
      if (Array.isArray(photoTypes) && photoTypes.length > 0) {
        const hasStorefront = photoTypes.some((t: string) =>
          t === 'storefront' || t === 'exterior' || t === 'interior');
        if (!hasStorefront) {
          signals.add('VP_MISSING_STOREFRONT_PHOTOS');
        }
      }
    }

    // VP_MISSING_PRODUCT_PHOTOS — GBP photos lack product close-ups
    if (!signals.has('VP_MISSING_PRODUCT_PHOTOS')) {
      const photoTypes = (google as any)?.photo_types;
      if (Array.isArray(photoTypes) && photoTypes.length > 0) {
        const hasProduct = photoTypes.some((t: string) => t === 'product');
        if (!hasProduct) {
          signals.add('VP_MISSING_PRODUCT_PHOTOS');
        }
      }
    }
  }

  // WC_* — website & conversion signals
  //
  // §W1: A website "exists" only when the audit confirms one — a url is
  // present OR status is working/broken/social_media_only. status
  // `none_found` or `unable_to_verify` means NO website was confirmed, so
  // the only valid WC_* signal in that case is WC_MISSING_WEBSITE. The
  // conversion-friction signals (WC_MISSING_CTA, WC_MISSING_SERVICE_PAGES,
  // WC_MOBILE_FRICTION, ...) describe defects ON an existing website and
  // must NOT fire for a non-existent website — "missing CTA on no website"
  // is noise that dilutes the headline WC_MISSING_WEBSITE signal.
  if (auditData?.website) {
    const website = auditData.website;
    const status = website.status?.toLowerCase();
    const websiteExists =
      !!website.url ||
      status === 'working' ||
      status === 'broken' ||
      status === 'social_media_only';
    // Explicit absence determination by the analyst. This is authoritative
    // and overrides a stale campaign.has_website='yes' that may have been
    // ingested from a directory listing which the audit later could not
    // verify (the Mwamba case: directory hinted a site, audit found none).
    const websiteAbsent = !website.url && (status === 'none_found' || status === 'unable_to_verify');

    // WC_MISSING_WEBSITE — no website detected
    if (!signals.has('WC_MISSING_WEBSITE')) {
      if (
        websiteAbsent ||
        (!websiteExists && (!campaign.has_website || campaign.has_website === 'no'))
      ) {
        signals.add('WC_MISSING_WEBSITE');
      }
    }

    // The remaining WC_* signals describe friction ON an existing website.
    // Skip them entirely when no website was confirmed.
    if (websiteExists) {
      // WC_BROKEN_WEBSITE — dead URL
      if (!signals.has('WC_BROKEN_WEBSITE')) {
        if (isDeadUrl(website)) {
          signals.add('WC_BROKEN_WEBSITE');
        }
      }

      // WC_URL_MISMATCH — audit URL differs from campaign URL
      if (!signals.has('WC_URL_MISMATCH')) {
        if (isUrlMismatch(website, campaign.website_url)) {
          signals.add('WC_URL_MISMATCH');
        }
      }

      // WC_MISSING_CTA — no call-to-action / click-to-call / booking
      if (!signals.has('WC_MISSING_CTA')) {
        const hasCta =
          isYesLike(website.call_to_action_present) ||
          isYesLike(website.click_to_call_available) ||
          website.has_booking === true;
        if (!hasCta) {
          signals.add('WC_MISSING_CTA');
        }
      }

      // WC_MISSING_SERVICE_PAGES — no dedicated service pages
      if (!signals.has('WC_MISSING_SERVICE_PAGES')) {
        const conv = website.conversion_opportunities ?? [];
        if (conv.length === 0) {
          signals.add('WC_MISSING_SERVICE_PAGES');
        }
      }

      // WC_MOBILE_FRICTION — not mobile-friendly
      if (!signals.has('WC_MOBILE_FRICTION')) {
        if (website.mobile_friendly && isNoLike(website.mobile_friendly)) {
          signals.add('WC_MOBILE_FRICTION');
        }
      }

      // WC_MISSING_PRODUCT_BROWSING — website exists but no product/category browsing
      if (!signals.has('WC_MISSING_PRODUCT_BROWSING')) {
        if (website.has_product_browsing === false) {
          signals.add('WC_MISSING_PRODUCT_BROWSING');
        }
      }

      // WC_MISSING_AVAILABILITY_INQUIRY — no way to check stock before visiting
      if (!signals.has('WC_MISSING_AVAILABILITY_INQUIRY')) {
        if (website.has_availability_inquiry === false) {
          signals.add('WC_MISSING_AVAILABILITY_INQUIRY');
        }
      }

      // WC_MISSING_PICKUP_DELIVERY — no pickup or delivery option surfaced online
      if (!signals.has('WC_MISSING_PICKUP_DELIVERY')) {
        if (website.has_pickup_ordering === false && website.has_delivery_option === false) {
          signals.add('WC_MISSING_PICKUP_DELIVERY');
        }
      }
    }
  } else if (!signals.has('WC_MISSING_WEBSITE')) {
    // No website audit at all + campaign says no website
    if (!campaign.has_website || campaign.has_website === 'no') {
      signals.add('WC_MISSING_WEBSITE');
    }
  }

  // DS_MISSING_PRODUCT_CATALOG — product/hybrid business with no website or
  // no product browsing. Distinct from WC_MISSING_WEBSITE (which fires for
  // any business with no website) and WC_MISSING_PRODUCT_BROWSING (which
  // fires when a website exists but has no product browsing). This code
  // captures the product-business-specific gap: customers can't see what
  // products are carried before visiting.
  if (!signals.has('DS_MISSING_PRODUCT_CATALOG')) {
    const businessType = (auditData as any)?.business_type;
    if (businessType === 'product' || businessType === 'hybrid') {
      const hasWebsite = !!auditData?.website?.url || auditData?.website?.status === 'working';
      const hasProductBrowsing = auditData?.website?.has_product_browsing === true;
      if (!hasWebsite || !hasProductBrowsing) {
        signals.add('DS_MISSING_PRODUCT_CATALOG');
      }
    }
  }

  // CP_* — cross-platform consistency (NAP drift)
  if (auditData?.nap_consistency) {
    const nap = auditData.nap_consistency;
    if (!signals.has('CP_NAP_NAME_DRIFT') && (nap.name_variations?.length ?? 0) > 0) {
      signals.add('CP_NAP_NAME_DRIFT');
    }
    if (!signals.has('CP_NAP_ADDRESS_DRIFT') && (nap.address_variations?.length ?? 0) > 0) {
      signals.add('CP_NAP_ADDRESS_DRIFT');
    }
    if (!signals.has('CP_NAP_PHONE_DRIFT') && (nap.phone_variations?.length ?? 0) > 0) {
      signals.add('CP_NAP_PHONE_DRIFT');
    }
    if (!signals.has('CP_MISSING_CONTACT_INFO')) {
      const missingContact =
        isNoLike((nap as any).contact_information_visible) ||
        (!nap.canonical_phone && !nap.canonical_address);
      if (missingContact) {
        signals.add('CP_MISSING_CONTACT_INFO');
      }
    }
  } else if (campaign.nap_consistent === false) {
    // Legacy: campaign column says NAP inconsistent but no audit detail.
    // Emit all three drift codes conservatively.
    if (!signals.has('CP_NAP_NAME_DRIFT')) signals.add('CP_NAP_NAME_DRIFT');
    if (!signals.has('CP_NAP_ADDRESS_DRIFT')) signals.add('CP_NAP_ADDRESS_DRIFT');
    if (!signals.has('CP_NAP_PHONE_DRIFT')) signals.add('CP_NAP_PHONE_DRIFT');
  }

  // VP_* — content & visual proof
  if (auditData) {
    const google = auditData.platforms?.google;

    // VP_MISSING_PROJECT_PHOTOS — no before/after or project portfolio photos
    if (!signals.has('VP_MISSING_PROJECT_PHOTOS')) {
      const projectPhotos = (google as any)?.project_photos_count;
      if (typeof projectPhotos === 'number' && projectPhotos === 0) {
        signals.add('VP_MISSING_PROJECT_PHOTOS');
      } else if (!auditData.platforms && !signals.has('VP_MISSING_PROJECT_PHOTOS')) {
        // No platform data at all — conservatively emit
        signals.add('VP_MISSING_PROJECT_PHOTOS');
      }
    }

    // VP_STALE_SOCIAL_ACTIVITY — no social posts in 60+ days
    if (!signals.has('VP_STALE_SOCIAL_ACTIVITY')) {
      const lastSocialPost = (auditData as any)?.social_activity?.last_post_date;
      if (lastSocialPost) {
        const days = daysSince(new Date(lastSocialPost));
        if (days >= 60) {
          signals.add('VP_STALE_SOCIAL_ACTIVITY');
        }
      }
    }
  }

  // ── 3. operator_input: BBB codes from pre-flight form ──────────────────
  if (bbb) {
    if (isCrisisBbbGrade(bbb.bbbGrade)) {
      signals.add('RA_BBB_GRADE_SUPPRESSION');
    }
    if (typeof bbb.unansweredBbbComplaints === 'number' && bbb.unansweredBbbComplaints > 0) {
      signals.add('RA_UNANSWERED_COMPLAINTS');
    }
  }

  return Array.from(signals);
}

// ─── Labeling helper (for DetectedSignal[] in the recommendation) ────────

/**
 * Build a DetectedSignal[] array from a SignalCode[] set, labeling each with
 * the registry label (or the code itself for unknown/admin-registered codes).
 */
export function labelSignals(codes: SignalCode[]): { code: SignalCode; label: string }[] {
  return codes.map((code) => ({ code, label: signalLabel(code) }));
}

// ─── Validation helper ───────────────────────────────────────────────────

/**
 * Filter a SignalCode[] to only known codes. Unknown codes are kept by the
 * engine (forward-compatible) but this helper is useful for diagnostics and
 * tests that want to assert only known codes were emitted.
 */
export function filterKnownSignals(codes: SignalCode[]): SignalCode[] {
  return codes.filter(isKnownSignalCode);
}
