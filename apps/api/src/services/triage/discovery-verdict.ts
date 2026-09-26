/**
 * Discovery Verdict — the "partial" triage lane (Category Discovery scan)
 *
 * Two-lane triage model:
 *   - Business audit scan  → "full" verdict   (real business_analysis audit)
 *   - Category Discovery   → "partial" verdict (emerging + competitive scans)
 *
 * A discovery scan emits INT_* signals, competitive_weaknesses, and
 * bronze_attribution — none of which are audit-family codes. The §S1
 * guardrail keeps INT_* out of `detected_signals`, so this module is the
 * deliberate, deterministic bridge: it translates named discovery evidence
 * (weakness keys, bronze reason keys, observed field absences, and the small
 * set of INT_* codes with a clean audit-family equivalent) into canonical
 * RA/DS/WC/CP/VP codes. The emitted codes are ordinary SignalCode values —
 * INT_* codes themselves are never produced here.
 *
 * The derived set seeds a stub `business_analysis` audit
 * (audit_metadata.source = 'discovery_scan') so the existing playbook DSL
 * produces a partial verdict at campaign-creation time. A later real
 * business_analysis audit supersedes it — `selectAuditForTriage` prefers
 * non-stub audits, and `refreshUndecidedVerdict` re-evaluates on import.
 *
 * `computeSeedConfidence` scores how confident a discovery prospect is a
 * real, distinct, in-market, category-fit business worth seeding into the
 * directory — the "confidence meter toward a seed". It consumes identity
 * corroboration signals (INT_*), fit/location assessments, provenance depth,
 * and NAP completeness — NOT the defect signals above (a business with many
 * defects is a great prospect AND a fine seed; defects don't lower seed
 * confidence, identity doubt does).
 *
 * Pure module — no DB access. Used by MarketingCampaignService
 * (deriveBusinessCampaign), MarketingProspectQueueService (list decoration),
 * and the discovery stub-audit seam.
 */

import type { SignalCode } from './signal-taxonomy';
import { isSocialPlatformHost, isBuilderSubdomainHost } from './website-host-classification';

/** audit_metadata.source value stamped on discovery-derived stub audits. */
export const DISCOVERY_STUB_AUDIT_SOURCE = 'discovery_scan';

// ─── Inputs ──────────────────────────────────────────────────────────────

export interface DiscoveryAttribution {
  reason_key: string;
  basis?: string | null;
}

export interface DiscoveryWeakness {
  weakness_key: string;
  basis?: string | null;
}

export interface DiscoveryVerdictInput {
  /** INT_* codes from the discovery candidate (never copied through). */
  discoverySignals?: string[] | null;
  /** Competitive weaknesses — the incumbent's named exposures (pitch wedge). */
  competitiveWeaknesses?: DiscoveryWeakness[] | null;
  /** Bronze reason attribution — the catalog blind spot(s) that surfaced it. */
  bronzeAttribution?: DiscoveryAttribution[] | null;
  /** Candidate scalar fields (queue entry / derive payload / snapshot). */
  website?: string | null;
  phone?: string | null;
  gbpUrl?: string | null;
  reviewCount?: number | null;
}

// ─── Signal mapping tables ───────────────────────────────────────────────
//
// Each entry maps a named discovery finding to the canonical audit-family
// codes a business audit would emit for the same observation. Conservative:
// identity/context INT_* codes (INT_MULTISOURCE_IDENTITY, INT_HIDDEN_TRUST,
// INT_RECENT_BUSINESS_EVIDENCE, ...) and hunt-mechanism reasons
// (trade_manifest_only, wholesale_or_hybrid_role, ...) have no defect
// equivalent and deliberately map to nothing — they feed the seed-confidence
// meter instead.

/** INT_* discovery signal → audit-family codes. */
const INT_SIGNAL_MAP: Record<string, SignalCode[]> = {
  // "no mainstream listing or a sparse/incomplete one" — the canonical
  // business-audit expression of that observation is DS_MISSING_PROFILE.
  INT_LOW_VISIBILITY: ['DS_MISSING_PROFILE'],
  INT_WEAK_MAINSTREAM_INDEXING: ['DS_MISSING_PROFILE'],
  INT_MISSING_WEBSITE: ['WC_MISSING_WEBSITE'],
};

/** competitive_weaknesses[].weakness_key → audit-family codes. */
const WEAKNESS_SIGNAL_MAP: Record<string, SignalCode[]> = {
  // §4.1 Asymmetry
  social_dominant_directory_weak: ['DS_MISSING_PROFILE'],
  directory_dominant_social_weak: ['VP_STALE_SOCIAL_ACTIVITY'],
  single_platform_concentration: ['DS_MISSING_PROFILE'],
  // §4.2 Drift
  stale_content_surface: ['VP_STALE_SOCIAL_ACTIVITY'],
  nap_drift: ['CP_NAP_NAME_DRIFT'],
  reputation_fragility: ['RA_UNADDRESSED_NEGATIVE_BACKLOG'],
  review_velocity_decline: ['RA_REVIEW_DROUGHT'],
  category_drift: ['WC_CATEGORY_MISMATCH'],
  // §4.3 Absence
  unclaimed_secondary_profiles: ['DS_CLAIMED_STATUS'],
  website_gap: ['WC_MISSING_WEBSITE'],
  no_conversion_path: ['WC_MISSING_CTA'],
  review_response_absent: ['RA_UNADDRESSED_POSITIVE_BACKLOG'],
  // §4.4 Thinness
  thin_service_surface: ['DS_MISSING_SERVICE_MENU'],
  thin_media_surface: ['DS_PHOTO_DEFICIT'],
};

/** bronze_attribution[].reason_key → audit-family codes. */
const BRONZE_REASON_SIGNAL_MAP: Record<string, SignalCode[]> = {
  unclaimed_profile: ['DS_CLAIMED_STATUS'],
  absent_from_platform: ['DS_MISSING_PROFILE'],
  no_mainstream_profile: ['DS_MISSING_PROFILE'],
  corridor_absent_from_guides: ['DS_MISSING_PROFILE'],
  stale_or_missing_hours: ['DS_OUTDATED_HOURS'],
  no_website_or_contact: ['WC_MISSING_WEBSITE', 'CP_MISSING_CONTACT_INFO'],
  zero_or_floor_reviews: ['RA_LOW_REVIEW_VOLUME'],
  community_only_no_reviews: ['RA_LOW_REVIEW_VOLUME'],
  thin_photo_surface: ['DS_PHOTO_DEFICIT'],
  misaligned_platform_category: ['WC_CATEGORY_MISMATCH'],
  alternate_identity: ['CP_NAP_NAME_DRIFT'],
  hosted_storefront_only: ['WC_THIRD_PARTY_DOMAIN'],
  // Hunt-mechanism reasons with no audit-family defect equivalent:
  //   trade_manifest_only, wholesale_or_hybrid_role, non_english_signage_only,
  //   no_category_token_in_name, low_rating_floor — left unmapped on purpose.
};

/**
 * Aliases for reason keys discovery scans emit that are NOT in
 * mkt_bronze_reason_catalog — the model periodically improvises descriptive
 * keys instead of citing the catalog (observed in a real emerging scan:
 * 'rename_residue_splits_the_discovery_trace' etc.). Each alias points at the
 * semantically matching catalog key so the invented attribution still yields
 * its defect signal. Keys with no catalog equivalent are deliberately absent
 * — they map to nothing, same as any unknown key.
 *
 * Note: aliasing only affects verdict-signal derivation. The bronze profile
 * write-back (recordBronzeExternalFills) is catalog-gated and still drops
 * non-board keys — invented keys never reach the slot board.
 */
const BRONZE_REASON_ALIASES: Record<string, string> = {
  // ≈ alternate_identity — rename residue splits the discovery trace.
  rename_residue_splits_the_discovery_trace: 'alternate_identity',
  // ≈ no_mainstream_profile — community/niche directories carry the only
  // real presence.
  community_directory_only_presence: 'no_mainstream_profile',
  aggregator_shadow_presence_only: 'no_mainstream_profile',
  // ≈ trade_manifest_only — reachable only via permit/registry records.
  // (Hunt-mechanism reason; aliases to a key with no signal mapping — kept
  // here so the equivalence is documented in one place.)
  permit_or_trade_manifest_trace_only: 'trade_manifest_only',
  // 'unofficial_third_party_site_shadows_the_business' is left unmapped — a
  // shadow domain outranking the business has no clean canonical reason.
};

const LOW_REVIEW_VOLUME_THRESHOLD = 15; // mirrors RA_LOW_REVIEW_VOLUME rule

// ─── Output ──────────────────────────────────────────────────────────────

/** Provenance of one derived signal — which discovery finding produced it. */
export interface DiscoverySignalContribution {
  code: SignalCode;
  via: 'int_signal' | 'weakness_key' | 'reason_key' | 'field';
  /** The key that produced the code: weakness_key, reason_key, INT_* code,
   *  or the field name ('website', 'review_count', ...). */
  ref: string;
  basis?: string | null;
}

export interface DerivedDiscoverySignals {
  /** Deduped canonical signal codes for the stub audit's detected_signals. */
  signals: SignalCode[];
  /** Per-code provenance — persisted on the stub audit as
   *  audit_data.discovery_signal_map so the partial verdict stays
   *  explainable. */
  contributions: DiscoverySignalContribution[];
}

/**
 * Translate discovery evidence into canonical audit-family signal codes.
 * Deterministic and conservative — only named findings with a clean
 * audit-family equivalent emit; unknown keys are skipped (forward-compatible
 * with vocabulary growth in the weakness/reason catalogs).
 */
export function deriveDiscoverySignals(input: DiscoveryVerdictInput): DerivedDiscoverySignals {
  const contributions: DiscoverySignalContribution[] = [];
  const seen = new Set<SignalCode>();
  const push = (code: SignalCode, via: DiscoverySignalContribution['via'], ref: string, basis?: string | null) => {
    contributions.push({ code, via, ref, basis: basis ?? null });
    seen.add(code);
  };

  for (const code of input.discoverySignals ?? []) {
    for (const mapped of INT_SIGNAL_MAP[code] ?? []) push(mapped, 'int_signal', code);
  }
  for (const w of input.competitiveWeaknesses ?? []) {
    for (const mapped of WEAKNESS_SIGNAL_MAP[w.weakness_key] ?? []) {
      push(mapped, 'weakness_key', w.weakness_key, w.basis);
    }
  }
  for (const r of input.bronzeAttribution ?? []) {
    // Resolve invented keys through the alias table; the contribution keeps
    // the ORIGINAL key as its ref so the stub audit's provenance records
    // what the scan actually said.
    const key = BRONZE_REASON_ALIASES[r.reason_key] ?? r.reason_key;
    for (const mapped of BRONZE_REASON_SIGNAL_MAP[key] ?? []) {
      push(mapped, 'reason_key', r.reason_key, r.basis);
    }
  }

  // Field-level observations. A discovery "not found" is a scan observation,
  // not proof of absence — the partial verdict owns that distinction (the
  // stub audit is marked source=discovery_scan, and a full audit supersedes).
  const website = typeof input.website === 'string' && input.website.trim() ? input.website.trim() : null;
  const phone = typeof input.phone === 'string' && input.phone.trim() ? input.phone.trim() : null;
  if (!website) {
    push('WC_MISSING_WEBSITE', 'field', 'website');
  } else if (isSocialPlatformHost(website)) {
    push('WC_THIRD_PARTY_DOMAIN', 'field', 'website');
  } else if (isBuilderSubdomainHost(website)) {
    push('WC_BUILDER_SUBDOMAIN', 'field', 'website');
  }
  if (!website && !phone) {
    push('CP_MISSING_CONTACT_INFO', 'field', 'contact');
  }
  if (input.reviewCount != null && input.reviewCount < LOW_REVIEW_VOLUME_THRESHOLD) {
    push('RA_LOW_REVIEW_VOLUME', 'field', 'review_count');
  }

  return { signals: Array.from(seen), contributions };
}

// ─── Seed confidence meter ───────────────────────────────────────────────
//
// "Does this discovery prospect merit a directory seed?" — a composite of
// identity corroboration, category fit, market position, provenance depth,
// and NAP completeness. Distinct from triage rule confidence (which is the
// playbook's configured match strength) and from the partial/full verdict
// (which is evidence completeness). Defect signals deliberately do NOT
// subtract — a business with a broken web presence is exactly who we seed.

export type SeedConfidenceBand = 'high' | 'medium' | 'low' | 'insufficient';

export interface SeedConfidenceFactor {
  label: string;
  delta: number;
}

export interface SeedConfidence {
  score: number; // 0–100
  band: SeedConfidenceBand;
  factors: SeedConfidenceFactor[];
}

export interface SeedConfidenceInput {
  identityConfidence?: string | null;
  categoryFit?: string | null;
  locationStatus?: string | null;
  businessSeekPriority?: string | null;
  discoverySignals?: string[] | null;
  /** discovery_provenance row count — multi-source corroboration depth. */
  provenanceCount?: number | null;
  ownershipType?: string | null;
  /** NAP completeness from the queue entry / business snapshot. */
  hasAddress?: boolean | null;
  hasPhone?: boolean | null;
  hasWebsite?: boolean | null;
  /** Resolved verification outcome, when the entry was verified. */
  verificationOutcome?: string | null;
  /**
   * Registry playbook wiring for the detected codes (loadSignalSeedWiring).
   * A declared route overrides the canonical signal term below: visibility
   * tilts add, doubt tilts subtract, neutral suppresses. Absent → canonical
   * defaults only (queue/CI paths that never loaded the registry).
   */
  signalWiring?: SignalSeedWiring[] | null;
}

const CHAIN_OWNERSHIP = new Set(['national_chain', 'national_franchise', 'regional_chain']);
// Mirrors the queue's VerificationOutcome minus the clearing outcomes
// ('operational', 'relocated') — every other resolved outcome blocks
// graduation (MarketingProspectQueueService.CAMPAIGN_CLEARED_OUTCOMES).
const NEGATIVE_VERIFICATION_OUTCOMES = new Set([
  'closed', 'closed_temporarily', 'unreachable', 'wrong_business',
]);

export function computeSeedConfidence(input: SeedConfidenceInput): SeedConfidence {
  const factors: SeedConfidenceFactor[] = [];
  const add = (label: string, delta: number) => factors.push({ label, delta });
  const signals = new Set(input.discoverySignals ?? []);

  // Identity + category fit — the dominant terms.
  if (input.identityConfidence === 'high') add('identity_confidence: high', 30);
  else if (input.identityConfidence === 'medium') add('identity_confidence: medium', 15);
  else if (input.identityConfidence === 'low') add('identity_confidence: low', -10);

  if (input.categoryFit === 'verified') add('category_fit: verified', 25);
  else if (input.categoryFit === 'probable') add('category_fit: probable', 10);
  else if (input.categoryFit === 'insufficient') add('category_fit: insufficient', -20);

  // Market position — a seed outside the market is not ours to publish.
  if (input.locationStatus === 'inside_city') add('location: inside_city', 10);
  else if (input.locationStatus === 'adjacent_city') add('location: adjacent_city', 5);
  else if (input.locationStatus === 'metro_area') add('location: metro_area', 2);
  else if (input.locationStatus === 'outside_market') add('location: outside_market', -40);

  // Identity corroboration signals — canonical defaults; a code carrying a
  // declared registry preference is scored by its tilt instead (below).
  const wiring = new Map((input.signalWiring ?? []).map((w) => [w.code, w]));
  const unwired = (code: string) => seedTiltForSignal(wiring.get(code)) == null;

  const multisourceCodes = ['INT_MULTISOURCE_IDENTITY', 'INT_MULTI_SOURCE_CONFIRMED'];
  if (multisourceCodes.some((c) => signals.has(c) && unwired(c))) {
    add('multi-source identity', 10);
  }
  if (signals.has('INT_SINGLE_SOURCE') && unwired('INT_SINGLE_SOURCE')) {
    add('single source only', -10);
  }
  if (signals.has('INT_ACTIVE_OPERATIONAL_EVIDENCE') && unwired('INT_ACTIVE_OPERATIONAL_EVIDENCE')) {
    add('operational evidence', 10);
  }
  if (signals.has('INT_RECENT_BUSINESS_EVIDENCE') && unwired('INT_RECENT_BUSINESS_EVIDENCE')) {
    add('recent business evidence', 5);
  }

  // Declared playbook wiring (the migration-308 pattern applied to seed
  // qualification): the routed playbook's archetype sets the tilt —
  // visibility-gap routes corroborate the seed's purpose (+), listing-drift
  // routes express identity doubt (−), reputation routes are neutral and
  // suppress the canonical term.
  for (const code of signals) {
    const w = wiring.get(code);
    const tilt = seedTiltForSignal(w);
    if (!tilt) continue;
    const route = w!.primaryPlaybook ?? w!.secondaryPlaybook ?? 'registry';
    if (tilt === 'visibility') add(`${code} → ${route} (visibility gap)`, 5);
    else if (tilt === 'doubt') add(`${code} → ${route} (identity-drift route)`, -5);
    // 'neutral' — the declared route suppresses the canonical term, adds none.
  }

  // Provenance depth — independent corroborating sources.
  const provCount = input.provenanceCount ?? 0;
  if (provCount >= 3) add(`provenance: ${provCount} sources`, 10);
  else if (provCount === 2) add('provenance: 2 sources', 7);
  else if (provCount === 1) add('provenance: 1 source', 4);

  // NAP completeness — a seed listing needs publishable identity data.
  if (input.hasAddress) add('has address', 5);
  if (input.hasPhone) add('has phone', 5);
  if (input.hasWebsite) add('has website', 5);

  // Operator-facing scan verdict.
  if (input.businessSeekPriority === 'hold') add('seek priority: hold', -15);
  else if (input.businessSeekPriority === 'high') add('seek priority: high', 5);

  // Ownership exclusions — seeds target independents.
  if (input.ownershipType && CHAIN_OWNERSHIP.has(input.ownershipType)) {
    add(`ownership: ${input.ownershipType}`, -50);
  }

  // Human verification outcome overrides discovery heuristics.
  if (input.verificationOutcome === 'operational' || input.verificationOutcome === 'relocated') {
    add(`verified ${input.verificationOutcome}`, 15);
  } else if (input.verificationOutcome && NEGATIVE_VERIFICATION_OUTCOMES.has(input.verificationOutcome)) {
    add(`verified ${input.verificationOutcome}`, -60);
  }

  const score = Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.delta, 0)));
  const band: SeedConfidenceBand =
    score >= 70 ? 'high' : score >= 40 ? 'medium' : score > 0 ? 'low' : 'insufficient';
  return { score, band, factors };
}

// ─── Identity-packet bridge (partial qualification lane) ─────────────────
//
// Two-lane qualification mirrors two-lane triage: a campaign with no real
// business_analysis audit deliberates on the discovery context (partial lane);
// a full audit supersedes it. The helpers below translate the context into
// the packet's own vocabulary — the evidence model, tier weights, and
// dimension gate score it identically to audit evidence.

/**
 * Seed-confidence score at which discovery provenance testifies in the
 * identity packet — 'medium' or better. Below it the discovery evidence is
 * informational only (the packet falls through to the full-audit path).
 */
export const SEED_CONFIDENCE_TESTIMONY_BAR = 40;

/** INT_* codes that express identity/scope doubt rather than corroboration. */
const DOUBT_DISCOVERY_SIGNALS: Record<string, string> = {
  INT_POSSIBLE_CATEGORY_MISALIGNMENT: 'category_misalignment',
  INT_SINGLE_SOURCE: 'single_source',
};

/** Bronze reason keys (post-alias) that express identity doubt. */
const DOUBT_REASON_KEYS = new Set(['alternate_identity']);

/** Competitive weakness keys that express identity/scope doubt. */
const DOUBT_WEAKNESS_KEYS: Record<string, string> = {
  nap_drift: 'nap_drift',
  category_drift: 'category_drift',
};

/**
 * Named identity/scope doubt from a discovery context. Any marker present
 * caps a depth-qualified seed gate at 'earned' (band 'review') — the partial
 * lane still qualifies the seed, but 'guaranteed' is reserved for evidence
 * without named doubt. QC surfaces each marker as a warn signal.
 */
export function discoveryDoubtMarkers(input: {
  discoverySignals?: string[] | null;
  bronzeAttribution?: DiscoveryAttribution[] | null;
  competitiveWeaknesses?: DiscoveryWeakness[] | null;
  categoryFit?: string | null;
  locationStatus?: string | null;
  identityConfidence?: string | null;
  businessSeekPriority?: string | null;
  /**
   * Registry playbook wiring (loadSignalSeedWiring). A signal whose declared
   * route resolves to a listing-drift playbook adds a `route_<code>` marker —
   * the preference expresses identity doubt even when the code itself is
   * uncataloged. Visibility/neutral routes add none.
   */
  signalWiring?: SignalSeedWiring[] | null;
}): string[] {
  const markers = new Set<string>();
  if (input.identityConfidence === 'low') markers.add('identity_confidence_low');
  if (input.categoryFit === 'insufficient') markers.add('category_fit_insufficient');
  if (input.locationStatus === 'outside_market') markers.add('outside_market');
  if (input.businessSeekPriority === 'hold') markers.add('seek_priority_hold');
  for (const code of input.discoverySignals ?? []) {
    const marker = DOUBT_DISCOVERY_SIGNALS[code];
    if (marker) markers.add(marker);
  }
  const wiringByCode = new Map((input.signalWiring ?? []).map((w) => [w.code, w]));
  for (const code of input.discoverySignals ?? []) {
    if (seedTiltForSignal(wiringByCode.get(code)) === 'doubt') {
      markers.add(`route_${code.toLowerCase()}`);
    }
  }
  for (const r of input.bronzeAttribution ?? []) {
    const key = BRONZE_REASON_ALIASES[r.reason_key] ?? r.reason_key;
    if (DOUBT_REASON_KEYS.has(key)) markers.add(key);
  }
  for (const w of input.competitiveWeaknesses ?? []) {
    const marker = DOUBT_WEAKNESS_KEYS[w.weakness_key];
    if (marker) markers.add(marker);
  }
  return [...markers];
}

/**
 * Operational status contributed by the discovery scan: proven recent
 * activity → 'likely_active' (the 70 rung), else null. Only consulted in the
 * partial lane — a real audit's operational_status wins outright.
 */
export function discoveryOperationalStatus(
  signals?: string[] | null,
): 'likely_active' | null {
  const s = new Set(signals ?? []);
  return s.has('INT_ACTIVE_OPERATIONAL_EVIDENCE') || s.has('INT_RECENT_BUSINESS_EVIDENCE')
    ? 'likely_active'
    : null;
}

// ─── Registry playbook-preference wiring (migration 308 pattern) ─────────
//
// Mirror of triage's signal playbook preferences: a registered signal's
// declared route — primary_playbook / secondary_playbook — gives the seed
// gate a semantic without a deploy. The routed playbook's ARCHETYPE names
// the kind of problem the pattern describes:
//
//   visibility tilt (A7 website gap, A6 product-visibility, A4 CTA gap) —
//     the routed problem is a visibility gap, which is exactly what a seed
//     listing exists to fix. Positive seed-confidence influence — never
//     doubt: a website-tilted route is a visibility issue, not an
//     operational or identity one.
//   doubt tilt (A3 listing drift) — the routed problem is identity
//     inconsistency; that IS seed doubt (adds a doubt marker → gate cap).
//   neutral (A1 review gap, A2 negative recovery, A5 dual) — reputation
//     arcs; they neither qualify nor disqualify a seed listing.
//
// Canonical INT_* semantics stay the default; a declared preference
// OVERRIDES the canonical confidence term for that code — registry wiring
// is explicit operator intent. The exception is doubt: named evidence doubt
// is additive only. A visibility route can raise the score but can never
// un-flag a canonical doubt marker (single_source, category_misalignment),
// so the "cap only on doubt" invariant survives rewiring.

export type SeedSignalTilt = 'visibility' | 'doubt' | 'neutral';

/** Routed-playbook archetype → seed tilt. */
const PLAYBOOK_ARCHETYPE_TILT: Record<string, SeedSignalTilt> = {
  A7: 'visibility',
  A6: 'visibility',
  A4: 'visibility',
  A3: 'doubt',
};

/**
 * Registry wiring for one detected discovery signal: the declared playbook
 * prefs plus the resolved archetypes of those playbooks (catalog lookup —
 * see loadSignalSeedWiring).
 */
export interface SignalSeedWiring {
  code: string;
  primaryPlaybook?: string | null;
  secondaryPlaybook?: string | null;
  primaryArchetype?: string | null;
  secondaryArchetype?: string | null;
}

/**
 * Resolve one signal's declared playbook preference to a seed tilt. The
 * primary route decides outright; a secondary-only route only contributes
 * doubt — a declared *fallback* to a visibility playbook doesn't corroborate
 * the seed (the signal didn't earn the pitch, it just named a landing spot),
 * but a fallback into listing-drift is still worth flagging.
 * Returns null when no declared tilt exists → callers fall back to the
 * canonical defaults.
 */
export function seedTiltForSignal(wiring: SignalSeedWiring | undefined): SeedSignalTilt | null {
  if (!wiring) return null;
  const primary = wiring.primaryArchetype
    ? (PLAYBOOK_ARCHETYPE_TILT[wiring.primaryArchetype] ?? 'neutral')
    : null;
  if (primary) return primary;
  const secondary = wiring.secondaryArchetype
    ? (PLAYBOOK_ARCHETYPE_TILT[wiring.secondaryArchetype] ?? 'neutral')
    : null;
  return secondary === 'doubt' ? 'doubt' : null;
}

/**
 * Resolve the registry wiring for a set of detected discovery signal codes —
 * two lookups: signal rows that declare a playbook preference, then the
 * catalog rows that resolve each pref's archetype. Signals with no declared
 * pref return no wiring row (callers treat them as canonical defaults).
 *
 * Takes the prisma client (or a compatible mock) rather than importing the
 * singleton so the pure-module boundary stays intact.
 */
export async function loadSignalSeedWiring(
  client: {
    mkt_signal_registry: { findMany: (arg: any) => Promise<any[]> };
    mkt_playbook_catalog: { findMany: (arg: any) => Promise<any[]> };
  },
  codes: string[],
): Promise<SignalSeedWiring[]> {
  const wanted = [...new Set(codes.filter((c) => typeof c === 'string' && c))];
  if (wanted.length === 0) return [];
  const rows = await client.mkt_signal_registry.findMany({
    where: { code: { in: wanted }, is_active: true },
    select: { code: true, primary_playbook: true, secondary_playbook: true },
  });
  const declared = (Array.isArray(rows) ? rows : []).filter(
    (r) => r.primary_playbook || r.secondary_playbook,
  );
  const prefCodes = [
    ...new Set(
      declared
        .flatMap((r) => [r.primary_playbook, r.secondary_playbook])
        .filter((c): c is string => typeof c === 'string' && !!c),
    ),
  ];
  const playbooks = prefCodes.length
    ? await client.mkt_playbook_catalog.findMany({
        where: { code: { in: prefCodes } },
        select: { code: true, archetype: true },
      })
    : [];
  const archetypeOf = new Map(
    (Array.isArray(playbooks) ? playbooks : []).map((p) => [p.code, p.archetype] as const),
  );
  return declared.map((r) => ({
    code: r.code,
    primaryPlaybook: r.primary_playbook ?? null,
    secondaryPlaybook: r.secondary_playbook ?? null,
    primaryArchetype: r.primary_playbook ? (archetypeOf.get(r.primary_playbook) ?? null) : null,
    secondaryArchetype: r.secondary_playbook ? (archetypeOf.get(r.secondary_playbook) ?? null) : null,
  }));
}
