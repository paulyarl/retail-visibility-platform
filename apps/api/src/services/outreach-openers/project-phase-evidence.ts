/**
 * project-phase-evidence — Phase 5.2 evidence extractor.
 *
 * Maps each triggering signal to a concrete audit/campaign field and emits
 * `{ campaignId, field, value, signalCode?, isQuote? }` rows for the plan's
 * `evidence` list. Reuses the audit shapes the common field-extractors read
 * (`nap_consistency`, `combined_review_metrics`, `platforms`, `website`,
 * `negative_review_themes`, `unanswered_negative_review_examples`).
 *
 * Verbatim review quotes pass through attributed and unedited — they carry
 * `isQuote: true` so the quality gate exempts them from forbidden-term
 * scanning (spec §9 scoping note).
 *
 * Values are plain language — the same rows feed the operator cockpit and
 * (after projection) the owner view, which strips `signalCode` but keeps
 * `field`/`value`.
 */

import type { SignalCode } from '../triage/signal-taxonomy';
import type { BusinessAnalysisAuditData } from './archetype-selection';

export interface PhaseEvidenceRow {
  campaignId: string;
  field: string;
  value: string;
  signalCode?: SignalCode;
  /** Verbatim review quote — attributed and unedited; the owner-facing
   *  gate exempts quote rows from the forbidden-term scan (spec §9). */
  isQuote?: boolean;
  attribution?: string;
}

function fmtList(values: (string | null | undefined)[]): string {
  return values.filter((v): v is string => !!v && v.trim().length > 0).join('", "');
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null;
}

/**
 * Evidence for one signal against the audit. Returns [] when the audit
 * doesn't carry the field — a verified phase must have full-lane evidence,
 * and absent fields simply yield no row rather than a fabricated one.
 */
function evidenceForSignal(
  code: SignalCode,
  audit: BusinessAnalysisAuditData | null,
  campaignId: string,
  campaignFacts: { website_url?: string | null; unaddressed_reviews?: number | null },
): PhaseEvidenceRow[] {
  const a = audit as any;
  const nap = a?.nap_consistency;
  const metrics = a?.combined_review_metrics;
  const website = a?.website;
  const google = a?.platforms?.google;
  const row = (field: string, value: string): PhaseEvidenceRow => ({
    campaignId,
    field,
    value,
    signalCode: code,
  });

  switch (code) {
    case 'CP_NAP_NAME_DRIFT':
      return nap?.name_variations?.length
        ? [row('name_variations', `Name appears as "${fmtList(nap.name_variations)}"`)]
        : [];
    case 'CP_NAP_ADDRESS_DRIFT':
      return nap?.address_variations?.length
        ? [row('address_variations', `Address appears as "${fmtList(nap.address_variations)}"`)]
        : [];
    case 'CP_NAP_PHONE_DRIFT':
      return nap?.phone_variations?.length
        ? [row('phone_variations', `Phone appears as "${fmtList(nap.phone_variations)}"`)]
        : [];
    case 'CP_MISSING_CONTACT_INFO':
      return [row('contact_info', 'Public listings are missing contact details')];
    case 'DS_OUTDATED_HOURS':
      return [row('hours', 'Listed hours look out of date')];
    case 'DS_OUTDATED_HOLIDAY_HOURS':
      return [row('holiday_hours', 'Holiday hours are missing or out of date')];
    case 'DS_BROKEN_PROFILE_LINK':
      return [row('profile_link', 'A public profile link is broken')];
    case 'DS_CLAIMED_STATUS':
      return [
        row(
          'profile_status',
          google?.profile_status && google.profile_status !== 'unable_to_verify'
            ? `Business profile status: ${google.profile_status}`
            : 'Business profile is not claimed',
        ),
      ];
    case 'WC_MISSING_WEBSITE':
      return [row('website', 'No website was found')];
    case 'WC_THIRD_PARTY_DOMAIN':
      return website?.url
        ? [row('website', `Online presence lives on a third-party page: ${website.url}`)]
        : [row('website', 'Online presence lives on a third-party page')];
    case 'WC_BUILDER_SUBDOMAIN':
      return website?.url
        ? [row('website', `Site sits on a builder subdomain: ${website.url}`)]
        : [row('website', 'Site sits on a builder subdomain')];
    case 'WC_PARKED_DOMAIN':
      return website?.url
        ? [row('website', `Domain is parked: ${website.url}`)]
        : [row('website', 'Domain is parked')];
    case 'WC_UNFINISHED_SITE':
      return [row('website', 'Website looks unfinished')];
    case 'WC_BROKEN_WEBSITE':
      return [
        row(
          'website',
          website?.url
            ? `Website is unreachable (${website.status ?? 'down'}): ${website.url}`
            : 'Website is unreachable',
        ),
      ];
    case 'WC_URL_MISMATCH':
      return [
        row(
          'website',
          website?.url && campaignFacts.website_url
            ? `Audit found ${website.url} but records list ${campaignFacts.website_url}`
            : 'The website on record does not match what is live',
        ),
      ];
    case 'WC_MISSING_PRODUCT_BROWSING':
      return [row('product_browsing', 'No product browsing on the site')];
    case 'DS_MISSING_PRODUCT_CATALOG':
      return [row('product_catalog', 'No product catalog is visible on public profiles')];
    case 'DS_MISSING_PROFILE':
      return [row('profiles', 'Expected business profile is missing')];
    case 'DS_MISSING_SERVICE_MENU':
      return [row('service_menu', 'No service menu on public profiles')];
    case 'DS_PHOTO_DEFICIT': {
      const count = google?.photo_count;
      return [
        row(
          'photos',
          typeof count === 'number' ? `Only ${count} photos on the public profile` : 'Public profile is light on photos',
        ),
      ];
    }
    case 'VP_MISSING_PRODUCT_PHOTOS':
      return [row('photos', 'Products are not shown with photos')];
    case 'VP_MISSING_STOREFRONT_PHOTOS':
      return [row('photos', 'Storefront has no photos on the public profile')];
    case 'VP_MISSING_PROJECT_PHOTOS':
      return [row('photos', 'No project/work photos on the public profile')];
    case 'RA_UNADDRESSED_NEGATIVE_BACKLOG': {
      const n = metrics?.observable_unanswered_negative_reviews;
      return [
        row(
          'unanswered_negative_reviews',
          typeof n === 'number'
            ? `${n} unanswered negative review${n === 1 ? '' : 's'}`
            : 'Negative reviews are unanswered',
        ),
      ];
    }
    case 'RA_BBB_GRADE_SUPPRESSION':
      return [row('bbb_grade', 'BBB rating is suppressed (operator-recorded)')];
    case 'RA_UNANSWERED_COMPLAINTS':
      return [row('bbb_complaints', 'Unanswered complaints on record (operator-recorded)')];
    case 'RA_REVIEW_DROUGHT': {
      const days = daysSince(metrics?.newest_observable_unanswered_review);
      return [
        row(
          'last_review',
          days != null && days > 0 ? `Most recent review is ${days} days old` : 'No recent reviews',
        ),
      ];
    }
    case 'RA_LOW_REVIEW_VOLUME': {
      const total = metrics?.observable_total_reviews;
      return [
        row(
          'review_count',
          typeof total === 'number' ? `Only ${total} total reviews visible` : 'Very few reviews visible',
        ),
      ];
    }
    case 'WC_MISSING_CTA':
      return [row('call_to_action', 'Site has no clear call to action')];
    case 'WC_MISSING_AVAILABILITY_INQUIRY':
      return [row('availability_inquiry', 'No way to ask about availability')];
    case 'WC_MISSING_PICKUP_DELIVERY':
      return [row('pickup_delivery', 'No pickup or delivery option is shown')];
    case 'WC_MISSING_SERVICE_PAGES':
      return [row('service_pages', 'Services are not listed on the site')];
    case 'WC_MOBILE_FRICTION':
      return [row('mobile', 'Site is hard to use on a phone')];
    case 'WC_UNSECURED_WEBSITE':
      return [row('security', 'Site is not served over a secure connection')];
    case 'WC_LEGACY_BUILDER_SITE':
      return [row('website', 'Site runs on an outdated builder')];
    case 'WC_STALE_WEBSITE':
      return [row('website', 'Website has not been updated in a while')];
    case 'WC_POOR_SITE_QUALITY':
      return [row('website', 'Website quality is hurting the first impression')];
    case 'WC_CATEGORY_MISMATCH':
      return [row('website', 'Site content does not match the listed category')];
    default:
      return [];
  }
}

/**
 * Verbatim negative-review examples — the quote exemption surface. Quotes
 * are emitted with attribution and `isQuote: true`; they render unedited.
 * Only attached to trust phases (backlog/complaints context).
 */
function quoteEvidence(
  audit: BusinessAnalysisAuditData | null,
  campaignId: string,
): PhaseEvidenceRow[] {
  const examples = (audit as any)?.unanswered_negative_review_examples;
  if (!Array.isArray(examples)) return [];
  const out: PhaseEvidenceRow[] = [];
  for (const ex of examples.slice(0, 3)) {
    const text = ex?.text ?? ex?.quote ?? ex?.excerpt;
    if (typeof text !== 'string' || !text.trim()) continue;
    const author = ex?.author ?? ex?.reviewer_name;
    const platform = ex?.platform;
    const attribution = [author, platform].filter(Boolean).join(' · ') || undefined;
    out.push({
      campaignId,
      field: 'review_quote',
      value: text,
      isQuote: true,
      attribution,
    });
  }
  return out;
}

const TRUST_SIGNALS: ReadonlySet<string> = new Set([
  'RA_UNADDRESSED_NEGATIVE_BACKLOG',
  'RA_BBB_GRADE_SUPPRESSION',
  'RA_UNANSWERED_COMPLAINTS',
  'RA_REVIEW_DROUGHT',
  'RA_LOW_REVIEW_VOLUME',
]);

/**
 * extractPhaseEvidence — all evidence rows for a phase's trigger signals.
 * `campaignId` should be the phase's primary contributing sibling (or the
 * primary campaign) — rows are attributed per campaignId.
 */
export function extractPhaseEvidence(args: {
  phaseKey: string;
  triggerSignals: SignalCode[];
  audit: BusinessAnalysisAuditData | null;
  campaignId: string;
  campaignFacts?: { website_url?: string | null; unaddressed_reviews?: number | null };
}): PhaseEvidenceRow[] {
  const { phaseKey, triggerSignals, audit, campaignId, campaignFacts = {} } = args;
  const rows: PhaseEvidenceRow[] = [];
  const seen = new Set<string>();
  for (const code of triggerSignals) {
    for (const row of evidenceForSignal(code, audit, campaignId, campaignFacts)) {
      const key = `${row.field}:${row.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  // Verbatim quotes only ride trust phases — a trust signal must be present.
  if (phaseKey === 'trust' && triggerSignals.some((c) => TRUST_SIGNALS.has(c))) {
    rows.push(...quoteEvidence(audit, campaignId));
  }
  return rows;
}
