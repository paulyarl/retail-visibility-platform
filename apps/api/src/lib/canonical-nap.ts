/**
 * canonical-nap — the single answer to "what is this campaign's NAP".
 *
 * NAP is the load-bearing identity record: it feeds the seed gate, the
 * Identity Packet, call/manual scripts, prompt merge fields, postal mailers,
 * and the verify-record write path. Before this module existed, every
 * consumer re-implemented its own partial fallback chain, which is how the
 * Verify Record modal could show empty City/State while Overview composed
 * the same values into its address string — the packet never implemented
 * the resolution at all.
 *
 * Two consumption modes:
 *
 *   resolveCampaignNap(campaign, auditData?, opts?) → ResolvedNap
 *     Per-field precedence — the campaign's structured columns win (operator
 *     truth), then the audit's canonical NAP, then audit_metadata
 *     matched/requested business, then components parsed out of a combined
 *     canonical_address string via addressParser. The campaign's market
 *     scope (city/state) is a LAST resort and gated behind
 *     `marketScopeFallback` — display/prefill callers want the hint, the
 *     seed gate's incomplete_nap check does not (a guessed city must not
 *     silently seed).
 *
 *   formatNapAddress(resolved | parts, opts?) → "street, city, state, zip"
 *     Single-line composition for call scripts, merge fields, and payloads.
 *     Replaces the three identical formatAddress copies in
 *     OutreachIntelligenceService / CallScriptService /
 *     ManualOutreachScriptService.
 *
 * Matching surfaces that deliberately do NOT use this: NAP-match confidence
 * (DirectorySeedCampaignLinkService) compares stored identity fields — a
 * guessed city would inflate the match — and seed→campaign spawn paths read
 * from the listing, not the campaign.
 */

import { addressParser } from './address-parser';

/** The mkt_campaigns_list subset the resolver reads. */
export interface CampaignNapSource {
  business_name?: string | null;
  phone?: string | null;
  website_url?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  /** Market scope — consulted only when `marketScopeFallback` is on. */
  city?: string | null;
  state?: string | null;
}

/** The audit_data subset the resolver reads (loose — audits are JSONB). */
export interface NapAuditData {
  audit_metadata?: {
    matched_business?: {
      business_name?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      phone?: string | null;
      website?: string | null;
    } | null;
    requested_business?: {
      business_name?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  nap_consistency?: {
    canonical_name?: string | null;
    canonical_address?: string | null;
    canonical_phone?: string | null;
    canonical_city?: string | null;
    canonical_state?: string | null;
    canonical_zip?: string | null;
  } | null;
  website?: { url?: string | null } | null;
}

export interface ResolvedNap {
  name: string | null;
  /**
   * Street line only. When the only address source is a combined string
   * (canonical_address / matched.address / requested.address), the street
   * component is extracted via addressParser — falling back to the first
   * comma segment when the string isn't parseable.
   */
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  /** The combined source the street was extracted from; null when a structured column supplied it. */
  combinedAddress: string | null;
}

export interface ResolveNapOptions {
  /**
   * Allow the campaign's market scope (city/state) to fill business city/state
   * when nothing else knows them. Default false — the market is a hint, not a
   * fact about the business (the business may sit in a neighboring town).
   */
  marketScopeFallback?: boolean;
}

const clean = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

export function resolveCampaignNap(
  campaign: CampaignNapSource | null | undefined,
  auditData?: NapAuditData | null,
  opts?: ResolveNapOptions,
): ResolvedNap {
  const c = campaign ?? {};
  const meta = auditData?.audit_metadata ?? {};
  const nap = auditData?.nap_consistency ?? {};
  const matched = meta.matched_business ?? {};
  const requested = meta.requested_business ?? {};

  // The audit's combined address strings, in authority order. Parsed once;
  // its components are a fallback tier for street/city/state/zip.
  const combinedAddress =
    clean(nap.canonical_address) ?? clean(matched.address) ?? clean(requested.address);
  const parsed =
    combinedAddress && addressParser.canParse(combinedAddress)
      ? addressParser.parse(combinedAddress)
      : null;
  // Unparseable combined strings still carry the street before the first
  // comma (same heuristic the seed path used before this module existed).
  const streetFromCombined = combinedAddress
    ? clean(parsed?.address_line1) ?? clean(combinedAddress.split(',')[0])
    : null;

  const scopeCity = opts?.marketScopeFallback ? clean(c.city) : null;
  const scopeState = opts?.marketScopeFallback ? clean(c.state) : null;

  return {
    name:
      clean(c.business_name) ??
      clean(nap.canonical_name) ??
      clean(matched.business_name) ??
      clean(requested.business_name),
    address: clean(c.address_line1) ?? streetFromCombined,
    address2: clean(c.address_line2) ?? clean(parsed?.address_line2),
    city:
      clean(c.address_city) ??
      clean(nap.canonical_city) ??
      clean(matched.city) ??
      clean(parsed?.city) ??
      clean(requested.city) ??
      scopeCity,
    state:
      clean(c.address_state) ??
      clean(nap.canonical_state) ??
      clean(matched.state) ??
      clean(parsed?.state) ??
      clean(requested.state) ??
      scopeState,
    zip: clean(c.address_zip) ?? clean(nap.canonical_zip) ?? clean(parsed?.postal_code),
    phone:
      clean(c.phone) ??
      clean(nap.canonical_phone) ??
      clean(matched.phone) ??
      clean(requested.phone),
    website:
      clean(c.website_url) ?? clean(auditData?.website?.url) ?? clean(matched.website),
    combinedAddress: clean(c.address_line1) ? null : combinedAddress,
  };
}

/** Single-line NAP composition — "street, city, state" (+ ", zip" when asked). */
export function formatNapAddress(
  nap: {
    address?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  },
  opts?: { includeZip?: boolean },
): string | null {
  const line1 = clean(nap.address);
  const line2 = clean(nap.address2);
  const street = line1 && line2 ? `${line1}, ${line2}` : line1;
  const parts = [
    street,
    clean(nap.city),
    clean(nap.state),
    ...(opts?.includeZip ? [clean(nap.zip)] : []),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Display address for a campaign row — resolves through the campaign columns
 * with market-scope fallback (a rendered script is better with a hint city
 * than with none). Pass auditData when the caller has it loaded.
 */
export function formatCampaignAddress(
  campaign: CampaignNapSource | null | undefined,
  auditData?: NapAuditData | null,
  opts?: { includeZip?: boolean },
): string | null {
  return formatNapAddress(
    resolveCampaignNap(campaign, auditData, { marketScopeFallback: true }),
    opts,
  );
}
