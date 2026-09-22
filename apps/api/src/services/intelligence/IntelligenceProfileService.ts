/**
 * IntelligenceProfileService — Category Intelligence Profile store + resolver
 *
 * Manages reusable, versioned, per-category discovery knowledge (spec §9–§13).
 * Profiles describe how a category can be discovered (Intelligence scope) AND
 * what evidence ecosystems matter when auditing a business in that category
 * (Business scope — vision §1B).
 *
 * Key design properties:
 *   - Immutable version rows (unlike prompt templates today). A new version
 *     is a new row; the old row is never mutated. Historical runs reference
 *     the exact version used (§43).
 *   - One active version per profile; one profile per category key (enforced
 *     via partial unique index on category_key WHERE status = 'active').
 *   - status: 'draft' | 'active' | 'retired' — draft-by-default with human
 *     activation (GAP-P8 normative rule 1). The resolver only returns active
 *     profiles, so both consumers (business audit resolution, intelligence
 *     discovery) pick up newly activated profiles for free.
 *
 * Category alignment rule (normative, §1B):
 *   - resolve() performs a normalized exact match (case/whitespace-insensitive)
 *     on category_key. No fuzzy/nearest-neighbor matching. No cross-category
 *     application, ever. A mismatched profile is actively harmful.
 *   - Miss → null → generic resolution, intelligence_mode: 'none'.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { generateIntelligenceProfileId } from '../../lib/id-generator';
import { BRONZE_SCOPE_SEMANTICS, formatBronzeReasonScope } from './bronze-scope';
import { isNationalSentinel } from './geography-grid';

// ─── Types ───────────────────────────────────────────────────────────────

export type IntelligenceProfileStatus = 'draft' | 'active' | 'retired';

/**
 * Intelligence focus type — defined here (not in PromptComposerService) to
 * avoid a circular import. PromptComposerService imports from this module,
 * so the type must originate here. PromptComposerService re-exports it for
 * backward compatibility.
 *
 * 'emerging' — discover low-visibility, hard-to-find businesses
 * 'competitive' — benchmark established, mainstream-visible market leaders
 * 'gold_standards' — establish/discover category-platform benchmark profiles
 *   (Gold Standard System — Sprint 0). Gold-standard profiles are
 *   city-agnostic and platform-focused; they sit at the top of the flow
 *   and are consumed by both intelligence establishment/discovery and the
 *   business audit as a benchmark.
 */
// 'proving_ground' is included for coverage-map slot tagging only — a proving
// ground is a city-scope operator workspace (not an intelligence profile), but
// the coverage UI treats gold_standards / emerging / competitive / proving_ground
// as parallel slot dimensions. It is never written to mkt_intelligence_profiles.
// 'bronze_standards' — Bronze Standard system (docs/LocalBiz/BRONZE_STANDARD_SPEC.md):
// slots typed by discovery-blind-spot reason rather than platform. Participates in
// the profile identity tuple like the other focuses, so bronze and gold profiles
// coexist without retiring each other (spec §10.2, Option A).
export type IntelligenceFocus = 'emerging' | 'competitive' | 'gold_standards' | 'proving_ground' | 'bronze_standards';

/**
 * Role for gold-standard injection into prompts.
 *   - 'benchmark' → audit/seek prompt: compare the business against the gold standard
 *   - 'target' → fulfill prompt: produce fixes that move toward the gold standard
 *   - 'discovery' → gold-standard discovery scan: evaluate new candidates against
 *     the already-established expected fields and quality gates (do NOT re-derive)
 *   - 'discovery_benchmark' → emerging/competitive discovery scan: rate each
 *     discovered candidate against the established gold standard per-platform,
 *     aggregate gate failures, and produce platform-aware outreach
 *     recommendations. Introduces platform awareness into focus discovery scans
 *     (which were previously platform-agnostic). The gold standard is resolved
 *     via resolveGoldStandard(category, platform) so a campaign with
 *     intelligence_platform = 'google' rates candidates against google-specific
 *     expected fields.
 */
export type GoldStandardRole = 'benchmark' | 'target' | 'discovery' | 'discovery_benchmark' | 'market_reference';

/**
 * Role for bronze-standard injection into prompts (BRONZE_STANDARD_SPEC §10.3).
 *   - 'establishment_reference' → stage-2 city bronze scan: the resolved
 *     bronze profile (city → national cascade) injected as the hunt list
 *     (full catalog snapshot + proof state) the city scan must cover.
 *   - 'discovery' → stage-3 emerging discovery scan: the city bronze profile
 *     injected as CALIBRATION framing (§7.1) — exemplars + empty-slot report +
 *     vector execution log. Framing, not a candidate filter.
 *   - 'national_proof' → cascading-profile supplement: when a market-scoped
 *     (city/state) profile resolves, the nationwide profile is injected
 *     ALONGSIDE it as a compact proof record — which reasons have ever
 *     produced a qualifying exemplar at national scope. Grounds the
 *     empty_proven_elsewhere classification and exemplar evidence depth that
 *     a thin market profile cannot supply. Never injected alone.
 */
export type BronzeStandardRole = 'establishment_reference' | 'discovery' | 'national_proof';

/**
 * Maximum number of pattern exemplars emitted PER PLATFORM when injecting a
 * gold-standard profile into benchmark/discovery prompts.
 *
 * Saturated niches can fill all 4 slots on every platform (e.g. African
 * Grocery Store: 4 candidates × 6 platforms = 24 gold-standard evaluations).
 * Emitting all of them bloats the prompt with marginal exemplars — the top
 * exemplar per platform already establishes the bar, and a second provides a
 * comparison point without over-reinforcing. Exemplars 3 and 4 per platform
 * add token cost without changing the analyst's rating behavior.
 *
 * The 'target' (fulfill) role is exempt — fix instructions benefit from the
 * full exemplar pool as adaptation sources, and fulfill prompts run one
 * business at a time so the token cost is bounded by the niche saturation
 * rather than by the candidate count of a discovery scan.
 */
const MAX_EXEMPLARS_PER_PLATFORM = 2;

/**
 * Maximum exemplar slots emitted PER REASON when injecting a bronze-standard
 * profile (spec §5.3 — mirrors MAX_EXEMPLARS_PER_PLATFORM). Two exemplars per
 * reason calibrate; more is token cost without marginal signal.
 */
const MAX_SLOTS_PER_REASON = 2;

/** Provenance values that survive a re-scan (§7.3 merge rule). */
const BRONZE_EXTERNAL_PROVENANCE = new Set(['operator_self_discovery', 'business_audit']);

/**
 * §7.3/§7.4 — a bronze fill written OUTSIDE the scan's own import path.
 * `emerging_scan`/`competitive_scan` provenance marks consumer write-back
 * (confirmatory — drops on re-scan unless re-found); the other two are
 * ground truth that survives re-scans via mergeBronzeCoverage.
 */
export interface BronzeExternalFillSlot {
  business_name: string;
  address?: string | null;
  observed_city?: string | null;
  observed_state?: string | null;
  observed_platform?: string | null;
  category_fit_evidence?: string;
  operational_evidence?: string;
  operational_status?: string | null;
  discovered_by: 'operator_self_discovery' | 'business_audit' | 'emerging_scan' | 'competitive_scan';
  discovered_via?: string | null;
  evidence_urls?: string[];
  digital_quality?: 'low' | 'very_low';
  platform_presence?: Record<string, string>;
}

export interface IntelligenceProfile {
  id: string;
  category_key: string;
  category_name: string;
  version: number;
  intelligence_focus: IntelligenceFocus;
  reference_city: string | null;
  reference_state: string | null;
  reference_platform: string | null;
  configuration_json: any;
  status: IntelligenceProfileStatus;
  created_at: Date;
  updated_at: Date;
}

export interface IntelligenceProfileConfiguration {
  terminology?: Record<string, string>;
  synonyms?: string[];
  subcategories?: string[];
  specialized_sources?: SpecializedSource[];
  // Discovery substrate — category-independent enumeration primitives authored
  // by the establishment scan (from the campaign-derived geography grid).
  geography_grid?: GeographyGridConfig;
  generic_label_set?: GenericLabelSetEntry[];
  label_independent_sweeps?: LabelIndependentSweep[];
  discovery_patterns?: Record<string, any>;
  category_evidence_rules?: Record<string, any>;
  prohibited_inferences?: string[];
  category_signals?: string[];
  [key: string]: any;
}

export interface GeographyGridConfig {
  city?: string;
  state?: string;
  zips?: string[];
  corridors?: string[];
  adjacent_municipalities?: string[];
  radius_miles?: number;
}

export interface GenericLabelSetEntry {
  platform: string;
  labels: string[];
}

export interface LabelIndependentSweep {
  dataset: string;
  url?: string;
  sweep_key?: string;
  filter?: string;
  post_filter?: string;
  note?: string;
}

export interface SpecializedSource {
  name: string;
  type: string;
  priority?: number;
  capabilities?: string[];
  limitations?: string[];
}

export interface PromptResolution {
  profile_id: string | null;
  profile_version: number | null;
  intelligence_mode: 'profile' | 'none';
  // Gold standard reference when a gold-standard block was injected into the
  // rendered prompt (discovery_benchmark role on emerging/competitive scans,
  // benchmark/target role on business audits, discovery role on gold-standard
  // discovery scans). Null when no gold standard was resolved.
  gold_standard_profile_id?: string | null;
  gold_standard_profile_version?: number | null;
  // Bronze standard reference when a bronze-standard calibration block was
  // injected into the rendered prompt (discovery role on emerging scans,
  // establishment_reference role on bronze city scans). Null when no bronze
  // standard was resolved.
  bronze_standard_profile_id?: string | null;
  bronze_standard_profile_version?: number | null;
  // Migration 253 — GAP-E3: true only when a "Discovery leads" block was
  // appended to the rendered prompt. Additive/optional — existing consumers
  // of resolution ignore unknown keys.
  discovery_leads_injected?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Normalize a category string for exact-match lookup against category_key.
 * Case/whitespace-insensitive. Also collapses underscores and hyphens to
 * spaces so that LLM-produced snake_case/kebab-case keys (e.g.
 * "beauty_supply") normalize to the same canonical form as the display
 * category (e.g. "Beauty Supply" → "beauty supply"). No fuzzy matching
 * (§1B normative rule).
 */
export function normalizeCategoryKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Normalize a city string for storage as reference_city and for exact-match
 * lookup. Title-cased (e.g. 'indianapolis' → 'Indianapolis', 'fort wayne'
 * → 'Fort Wayne') so stored values are legible in the UI without a display
 * transform. Whitespace-collapsed. Empty/whitespace input returns null so
 * the resolver treats it as "no city requested" (legacy/business-scope path).
 *
 * Note: title-casing is word-boundary based and will not preserve unusual
 * internal capitalization (e.g. 'McAllen' → 'Mcallen'). This is acceptable
 * for the set of reference cities in use; if a city with internal capitals
 * is added, store it directly via a raw query rather than through this helper.
 */
export function normalizeReferenceCity(s: string | null | undefined): string | null {
  if (!s) return null;
  const collapsed = s.trim().toLowerCase().replace(/\s+/g, ' ');
  if (collapsed.length === 0) return null;
  return collapsed.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Map of full US state/territory names → 2-letter postal codes. Used by
 * normalizeReferenceState to coerce full names (e.g. 'Indiana', 'indiana')
 * to the canonical 2-letter code ('IN'). Keys are lowercase for lookup.
 */
const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY',
};

/**
 * Normalize a US state for storage as reference_state. Returns the canonical
 * 2-letter uppercase postal code (e.g. 'in' → 'IN', 'Indiana' → 'IN',
 * 'indiana' → 'IN'). Empty/whitespace input returns null. Unrecognized
 * non-2-letter values are uppercased and returned as-is (preserves prior
 * behavior for unknown inputs — the caller is responsible for validity).
 */
export function normalizeReferenceState(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  // Already a 2-letter code — uppercase and return.
  if (/^[a-zA-Z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  // Full state name — map to 2-letter code.
  const code = STATE_NAME_TO_CODE[trimmed.toLowerCase()];
  if (code) return code;
  // Unknown format — uppercase and return (legacy passthrough).
  return trimmed.toUpperCase();
}

/**
 * Normalize a platform scope for storage as reference_platform. Returns the
 * lowercase platform key (e.g. 'Google' → 'google'), or NULL for the
 * cross-platform slot. 'all' (and empty input) normalize to NULL — NULL is
 * the canonical cross-platform representation (Migration 236): the resolver
 * fallback chain, the coverage dimension matcher, and the gold-standard
 * import path all treat reference_platform = NULL as the 'all' slot, so
 * storing the literal 'all' would split the scope-tuple identity (a re-import
 * of the same establishment would create a new profile id instead of
 * versioning the existing profile).
 */
export function normalizePlatformScope(s: string | null | undefined): string | null {
  const normalized = s ? s.trim().toLowerCase() || null : null;
  return normalized === 'all' ? null : normalized;
}

// ─── Platform signal weights (signal-weight spec) ────────────────────────
//
// signal_weight(category, platform) ∈ [0,1] — the single source of truth for
// how much a platform's signal should move a score. National gold-standard
// establishments derive it coast-to-coast; market establishments derive it
// locally with the same estimator, and a confidence gate decides whether the
// local weight outranks the national one. The divergence between the two is
// itself an intelligence observation.

export interface PlatformSignalWeight {
  platform: string;
  /** signal_weight ∈ [0,1]. */
  weight: number;
  /** Observed prevalence × depth behind the estimate. */
  basis?: string | null;
  /** Derivation confidence ∈ [0,1] — the local-precedence gate reads this. */
  confidence?: number | null;
  /** Sample size behind the estimate. */
  observations?: number | null;
}

export type SignalWeightScope = 'local' | 'regional' | 'national';

export interface ResolvedSignalWeight extends PlatformSignalWeight {
  /** Which geographic layer produced the winning estimate. */
  scope: SignalWeightScope;
  profileId: string;
  profileVersion: number;
  /** local.weight − national.weight, when both layers observed the platform. */
  divergence?: number | null;
  /**
   * True when the winner was chosen BECAUSE its confidence cleared
   * LOCAL_PRECEDENCE_CONFIDENCE — i.e. the §4 gate fired. False for
   * broadest-layer fallbacks (a thin local reading that wins only because
   * nothing broader exists). Divergence emission reads this flag: the same
   * confidence gates precedence and emission (spec §5).
   */
  precedenceViaConfidence: boolean;
}

/**
 * Minimum confidence for a local (or regional) weight to outrank the national
 * estimate. PROVISIONAL — calibrate against a real sample (spec §10).
 */
export const LOCAL_PRECEDENCE_CONFIDENCE = 0.6;

/**
 * Normalize a platform key for signal-weight lookup. Profile entries use the
 * audit platform vocabulary (google, yelp, facebook, apple, bbb, …); this
 * folds the common aliases onto those keys.
 */
export function normalizeSignalPlatformKey(s: string | null | undefined): string | null {
  if (!s) return null;
  const k = s.trim().toLowerCase().replace(/[\s_.-]+/g, '');
  if (!k) return null;
  const ALIASES: Record<string, string> = {
    googlemaps: 'google',
    googlebusinessprofile: 'google',
    gbp: 'google',
    applemaps: 'apple',
    betterbusinessbureau: 'bbb',
    meta: 'facebook',
  };
  return ALIASES[k] ?? k;
}

const clamp01 = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;

/** Extract the platform_signal_weights array from a profile configuration. */
function extractSignalWeightEntries(config: any): Map<string, PlatformSignalWeight> {
  const out = new Map<string, PlatformSignalWeight>();
  const arr = config?.platform_signal_weights;
  if (!Array.isArray(arr)) return out;
  for (const e of arr) {
    const platform = normalizeSignalPlatformKey(e?.platform);
    const weight = clamp01(e?.weight);
    if (!platform || weight == null) continue;
    out.set(platform, {
      platform,
      weight,
      basis: typeof e?.basis === 'string' ? e.basis : null,
      confidence: clamp01(e?.confidence),
      observations: Number.isInteger(e?.observations) ? e.observations : null,
    });
  }
  return out;
}

/**
 * Resolve signal_weight for a set of platforms from already-fetched active
 * profiles. Pure — the DB-free half of resolveSignalWeights, unit-testable.
 *
 * Precedence: a local (city-matched) or regional (state-matched) estimate
 * outranks the national one only when its confidence clears
 * LOCAL_PRECEDENCE_CONFIDENCE; otherwise the national estimate wins. When no
 * estimate clears the gate, the broadest available layer wins (national →
 * regional → local) — a low-confidence local reading is still reported, with
 * its confidence, rather than silently discarded.
 */
export function resolveSignalWeightsFromProfiles(
  profiles: Array<Pick<
    IntelligenceProfile,
    'id' | 'version' | 'reference_city' | 'reference_state' | 'reference_platform' | 'configuration_json'
  >>,
  input: { platforms: string[]; city?: string | null; state?: string | null },
): Map<string, ResolvedSignalWeight> {
  const out = new Map<string, ResolvedSignalWeight>();
  const city = normalizeReferenceCity(input.city);
  const state = normalizeReferenceState(input.state);

  const candidates = profiles.map((p) => ({
    profile: p,
    scope: (p.reference_city ? 'local' : p.reference_state ? 'regional' : 'national') as SignalWeightScope,
    entries: extractSignalWeightEntries(p.configuration_json),
  }));

  // Is this profile's scope relevant to the requested geography?
  const matches = (c: (typeof candidates)[number]): boolean => {
    if (c.scope === 'national') return true;
    if (c.scope === 'regional') {
      return state != null && c.profile.reference_state === state;
    }
    return (
      city != null &&
      c.profile.reference_city === city &&
      (state == null || c.profile.reference_state == null || c.profile.reference_state === state)
    );
  };

  for (const raw of input.platforms) {
    const platform = normalizeSignalPlatformKey(raw);
    if (!platform) continue;

    const pick = (scope: SignalWeightScope) => {
      let fallback: { profile: (typeof candidates)[number]['profile']; entry: PlatformSignalWeight } | null = null;
      for (const c of candidates) {
        if (c.scope !== scope || !matches(c)) continue;
        const entry = c.entries.get(platform);
        if (!entry) continue;
        // A platform-scoped profile is the better witness for its platform.
        if (normalizeSignalPlatformKey(c.profile.reference_platform) === platform) {
          return { profile: c.profile, entry };
        }
        if (!fallback) fallback = { profile: c.profile, entry };
      }
      return fallback;
    };

    const local = pick('local');
    const regional = pick('regional');
    const national = pick('national');

    const confident = (c: typeof local) =>
      c != null && (c.entry.confidence ?? 0) >= LOCAL_PRECEDENCE_CONFIDENCE;

    // precedenceViaConfidence marks whether the §4 gate actually drove the
    // choice — a local/regional scope can also win as a broadest-layer
    // fallback when nothing confident exists, and that is NOT a cleared gate.
    const winner: ({ scope: SignalWeightScope; precedenceViaConfidence: boolean } & NonNullable<typeof local>) | null =
      confident(local)
        ? { ...local!, scope: 'local', precedenceViaConfidence: true }
        : confident(regional)
          ? { ...regional!, scope: 'regional', precedenceViaConfidence: true }
          : national
            ? { ...national, scope: 'national', precedenceViaConfidence: false }
            : regional
              ? { ...regional, scope: 'regional', precedenceViaConfidence: false }
              : local
                ? { ...local, scope: 'local', precedenceViaConfidence: false }
                : null;

    if (!winner) continue;

    const divergence =
      local && national
        ? Math.round((local.entry.weight - national.entry.weight) * 1000) / 1000
        : null;

    out.set(platform, {
      ...winner.entry,
      scope: winner.scope,
      profileId: winner.profile.id,
      profileVersion: winner.profile.version,
      divergence,
      precedenceViaConfidence: winner.precedenceViaConfidence,
    });
  }

  return out;
}

// ─── Lead-platform selection (spec §2 "Reported, not applied") ───────────
//
// The pitch reads signal weight as the traffic fact — the "where" (which
// platform the category's customers are on). It never feeds back into
// scoring. Selection is the intersection of two facts, not weight alone:
//
//     lead_platform = argmax( signal_weight × gap_severity )
//
// — the platform that matters AND where the business is weak. Uses the
// confidence-gated effective weight, so a national premise is never
// asserted over a divergent local market.

/** Severity points per gap/gate entry. non_negotiable hurts twice as much. */
export const GAP_SEVERITY_POINTS = { non_negotiable: 1, recommended: 0.5 } as const;

export interface LeadPlatformSelection {
  /** Normalized platform key (google, yelp, …). */
  platform: string;
  /** signal_weight × gap_severity — the argmax score. */
  score: number;
  /** Confidence-gated effective weight — the traffic fact. */
  signalWeight: number;
  /** Accumulated gap severity — how weak the business is there. */
  gapSeverity: number;
  /** The profile's measured basis — grounds the "customers are here" premise. */
  basis: string | null;
  scope: SignalWeightScope | null;
  profileId: string | null;
}

/**
 * Accumulate gap severity per platform from the audit's gap_analysis and
 * quality_gate_results. Only failed gates count — a passed gate is not a
 * gap. Pure and DB-free for unit testing.
 */
export function platformGapSeverity(auditData: any): Map<string, number> {
  const severity = new Map<string, number>();
  const add = (platform: unknown, sev: unknown) => {
    const key = normalizeSignalPlatformKey(typeof platform === 'string' ? platform : null);
    if (!key) return;
    const points =
      sev === 'non_negotiable' ? GAP_SEVERITY_POINTS.non_negotiable
      : sev === 'recommended' ? GAP_SEVERITY_POINTS.recommended
      : 0;
    if (points > 0) severity.set(key, (severity.get(key) ?? 0) + points);
  };
  for (const g of auditData?.gap_analysis ?? []) {
    if (g && typeof g === 'object') add(g.platform, g.severity);
  }
  for (const q of auditData?.quality_gate_results ?? []) {
    if (q && typeof q === 'object' && q.passed === false) add(q.platform, q.severity);
  }
  return severity;
}

/**
 * Rank every platform that BOTH carries a resolved signal weight AND shows
 * at least one audit gap, by signal_weight × gap_severity (descending).
 * Generalizes the lead-platform formula — entry [0] IS the lead platform —
 * so outreach surfaces (hook ranking, call scripts, pitch ordering) can
 * order work across ALL weighted platforms, not just the argmax.
 */
export function rankPlatformPriorities(
  auditData: any,
  resolved: Map<string, ResolvedSignalWeight> | undefined,
): LeadPlatformSelection[] {
  if (!resolved || resolved.size === 0) return [];
  const severity = platformGapSeverity(auditData);
  const out: LeadPlatformSelection[] = [];
  for (const [platform, gapSeverity] of severity) {
    const w = resolved.get(platform);
    if (!w || w.weight == null) continue;
    out.push({
      platform,
      score: w.weight * gapSeverity,
      signalWeight: w.weight,
      gapSeverity,
      basis: w.basis ?? null,
      scope: w.scope ?? null,
      profileId: w.profileId ?? null,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/**
 * Select the lead platform for the pitch: argmax(signal_weight × gap_severity)
 * over platforms that BOTH carry a resolved signal weight AND show at least
 * one gap. Returns null when no platform qualifies — either nothing is weak
 * (no premise needed) or no weights resolved (no traffic fact to report).
 */
export function selectLeadPlatform(
  auditData: any,
  resolved: Map<string, ResolvedSignalWeight>,
): LeadPlatformSelection | null {
  return rankPlatformPriorities(auditData, resolved)[0] ?? null;
}

/**
 * Owner/operator-facing display name for a canonical signal platform key
 * (the audit platform vocabulary: google, yelp, facebook, apple, bbb, …).
 * Aliases fold via normalizeSignalPlatformKey; unknown keys pass through
 * capitalized so a new platform never renders as a raw snake_case slug.
 */
export function signalPlatformDisplayName(platform: string | null | undefined): string | null {
  const key = normalizeSignalPlatformKey(platform);
  if (!key) return null;
  const NAMES: Record<string, string> = {
    google: 'Google',
    yelp: 'Yelp',
    facebook: 'Facebook',
    apple: 'Apple Maps',
    bbb: 'BBB',
    bing: 'Bing Places',
    nextdoor: 'Nextdoor',
  };
  return NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Serialize the resolved signal weights as a prompt block for reported-use
 * consumers (the triage briefing and repair seeks). This is the "where the
 * category's customers are" context (spec §2 "Reported, not applied"): the
 * analyst reads it to weight severity and aim the pitch at the platforms
 * that carry this category's traffic. Read-only — the block never feeds
 * back into scoring. Returns '' when nothing resolved.
 */
export function serializeSignalWeightContextBlock(
  resolved: Map<string, ResolvedSignalWeight>,
  lead: LeadPlatformSelection | null,
): string {
  if (!resolved || resolved.size === 0) return '';
  const lines: string[] = [
    '',
    "=== PLATFORM SIGNAL WEIGHTS — WHERE THIS CATEGORY'S CUSTOMERS ARE ===",
    'Measured signal weight per platform for this category (0–1): how much of the',
    "category's customer attention, reviews, and profile depth each platform carries,",
    'derived from gold-standard exemplars. (scope) shows which geographic layer',
    'produced the estimate — a confident local reading outranks the national one.',
    '',
  ];
  const sorted = [...resolved.values()].sort((a, b) => b.weight - a.weight);
  for (const w of sorted) {
    const basis = w.basis ? ` — basis: ${w.basis}` : '';
    lines.push(`  ${w.platform}: ${w.weight} (${w.scope ?? 'national'})${basis}`);
  }
  if (lead) {
    lines.push('');
    lines.push(
      `LEAD PLATFORM: ${lead.platform} — the highest-weight platform where the audit ` +
        'also shows gaps. The "your customers are on this platform" premise lands here.',
    );
  }
  lines.push('');
  lines.push(
    'DIRECTIVE: Reported context, not a scoring input — use it to weight the briefing, ' +
      'never as a defect by itself. The same problem is a bigger pain on a high-weight ' +
      'platform than on a low-weight one, and an absence or unable_to_verify on a ' +
      'low-weight platform is noise, not a selling point. Rank outreach_problems and ' +
      "pitch.pain_points toward the platforms that carry this category's traffic, and " +
      'prefer the lead platform named above for primary_angle / opener_hook when it aligns with the ' +
      'confirmed issue. Never recite the raw weight number in owner-facing copy — the ' +
      "weight is your evidence, not the owner's vocabulary.",
  );
  lines.push('');
  return lines.join('\n');
}

// ─── Service ─────────────────────────────────────────────────────────────

export class IntelligenceProfileService extends BaseService {
  private static instance: IntelligenceProfileService;

  private constructor() {
    super();
  }

  static getInstance(): IntelligenceProfileService {
    if (!IntelligenceProfileService.instance) {
      IntelligenceProfileService.instance = new IntelligenceProfileService();
    }
    return IntelligenceProfileService.instance;
  }

  // ====================
  // RESOLUTION (used by both business audit + intelligence discovery)
  // ====================

  /**
   * Resolve the active profile for a category.
   *
   * City-aware resolution (Migration 205 — Profile City Scoping):
   *   - If `city` is provided, first try an exact
   *     (category_key, reference_city, focus) match. This is the primary
   *     path for intelligence-scope discovery: a Zionsville discovery
   *     campaign resolves to the Zionsville-established profile, not the
   *     Indianapolis one.
   *   - If no city-specific profile exists, fall back to a city-agnostic
   *     profile (reference_city IS NULL) for the same (category, focus).
   *     This preserves backward compatibility for categories that only have
   *     a city-agnostic profile, and for legacy profiles we could not
   *     backfill. The fallback is logged so operators can detect when a
   *     discovery campaign is running on a city-agnostic (possibly
   *     city-contaminated) profile.
   *   - If no city-agnostic profile exists either, fall back to a
   *     category+focus match ignoring city (legacy pre-Migration-205
   *     behavior) and log a warning. This is the last-resort path that
   *     surfaces cross-city contamination — it exists only so a missing
   *     city-scoped profile does not silently produce generic fallback
   *     when a category+focus profile exists.
   *
   * Focus-aware resolution (Migration 202 — Profile Type Alignment):
   *   - If `focus` is provided, the focus filter is applied at every layer.
   *   - If `focus` is omitted (business-scope §1B path), the focus filter
   *     is dropped — business audits are category-aware, not focus-aware.
   *     City is still honored when provided so a business audit in
   *     Zionsville does not load an Indianapolis-biased profile block.
   *
   * Normalized exact match on category_key + reference_city; active version
   * only. Returns null on miss → caller uses generic fallback
   * (intelligence_mode: 'none').
   */
  async resolve(
    category: string,
    focus?: IntelligenceFocus,
    city?: string | null,
    platform?: string | null,
    ctx?: RequestCtx,
  ): Promise<IntelligenceProfile | null> {
    const key = normalizeCategoryKey(category);
    const normalizedCity = normalizeReferenceCity(city);
    const normalizedPlatform = platform ? platform.trim().toLowerCase() || null : null;
    try {
      // Helper: build a where clause for the given (city, platform) combination.
      // focus is applied when provided.
      const buildWhere = (cityVal: string | null, platformVal: string | null) => {
        const w: any = {
          category_key: key,
          reference_city: cityVal,
          status: 'active',
        };
        if (focus) w.intelligence_focus = focus;
        if (platformVal) {
          w.reference_platform = platformVal;
        } else {
          w.reference_platform = null;
        }
        return w;
      };

      const tryFind = async (cityVal: string | null, platformVal: string | null): Promise<IntelligenceProfile | null> => {
        const found = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: buildWhere(cityVal, platformVal),
          orderBy: { version: 'desc' },
        });
        return found as IntelligenceProfile | null;
      };

      // ── Platform-aware resolution (Migration 236) ──────────────────────
      // The fallback chain narrows from most-specific to least-specific:
      //   1. (category, focus, city, platform)     — city + platform exact
      //   2. (category, focus, city, platform=null) — city exact, cross-platform
      //   3. (category, focus, city=null, platform) — city-agnostic, platform exact
      //   4. (category, focus, city=null, platform=null) — city-agnostic, cross-platform
      // After the platform-aware chain, fall through to the legacy
      // focus-only / category-only fallbacks (which ignore platform).
      if (normalizedPlatform) {
        // Step 1: city + platform exact
        if (normalizedCity) {
          const s1 = await tryFind(normalizedCity, normalizedPlatform);
          if (s1) return s1;
        }
        // Step 2: city exact, cross-platform
        if (normalizedCity) {
          const s2 = await tryFind(normalizedCity, null);
          if (s2) {
            // An 'all' request resolving the NULL cross-platform row is the
            // exact slot (NULL = cross-platform per Migration 236), not a
            // fallback — only a specific-platform request falling through
            // here is contamination worth warning about.
            if (normalizedPlatform !== 'all') {
              logger.warn('Gold standard profile resolved via city+cross-platform fallback', ctx, {
                categoryKey: key, requestedCity: normalizedCity, requestedPlatform: normalizedPlatform,
                resolvedPlatform: null, focus: focus ?? 'none', profileId: (s2 as any).id,
              });
            }
            return s2;
          }
        }
        // Step 3: city-agnostic, platform exact
        const s3 = await tryFind(null, normalizedPlatform);
        if (s3) {
          if (normalizedCity) {
            logger.warn('Gold standard profile resolved via platform-only fallback — city contamination possible', ctx, {
              categoryKey: key, requestedCity: normalizedCity, requestedPlatform: normalizedPlatform,
              resolvedCity: null, focus: focus ?? 'none', profileId: (s3 as any).id,
            });
          }
          return s3;
        }
        // Step 4: city-agnostic, cross-platform
        const s4 = await tryFind(null, null);
        if (s4) {
          logger.warn('Gold standard profile resolved via cross-platform fallback — platform contamination possible', ctx, {
            categoryKey: key, requestedPlatform: normalizedPlatform,
            resolvedPlatform: null, focus: focus ?? 'none', profileId: (s4 as any).id,
          });
          return s4;
        }
        // Fall through to legacy fallbacks below (which ignore platform).
      }

      // ── Legacy resolution (pre-Migration-236, still used when platform is
      //    not requested or when the platform-aware chain found nothing) ───

      // 1. City-specific exact match (primary intelligence-scope path)
      if (normalizedCity) {
        const cityWhere: any = {
          category_key: key,
          reference_city: normalizedCity,
          status: 'active',
        };
        if (focus) cityWhere.intelligence_focus = focus;
        const exact = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: cityWhere,
          orderBy: { version: 'desc' },
        });
        if (exact) return exact as IntelligenceProfile;

        // 2. City-agnostic fallback for the same (category, focus)
        const agnosticWhere: any = {
          category_key: key,
          reference_city: null,
          status: 'active',
        };
        if (focus) agnosticWhere.intelligence_focus = focus;
        const agnostic = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: agnosticWhere,
          orderBy: { version: 'desc' },
        });
        if (agnostic) {
          logger.warn(
            'Intelligence profile resolved via city-agnostic fallback — city contamination possible',
            ctx,
            {
              categoryKey: key,
              requestedCity: normalizedCity,
              resolvedCity: null,
              focus: focus ?? 'none',
              profileId: (agnostic as any).id,
            },
          );
          return agnostic as IntelligenceProfile;
        }
      }

      // 3. Focus-specific match ignoring city (legacy / pre-Migration-205
      //    behavior). Reached when city is omitted, or when no city-specific
      //    AND no city-agnostic profile exists for the requested (city, focus).
      if (focus) {
        const exact = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: {
            category_key: key,
            intelligence_focus: focus,
            status: 'active',
          },
          orderBy: { version: 'desc' },
        });
        if (exact) {
          // If a city was requested but we landed here, the resolved profile
          // may be scoped to a different city — surface the mismatch.
          if (normalizedCity && (exact as any).reference_city && (exact as any).reference_city !== normalizedCity) {
            logger.warn(
              'Intelligence profile resolved via category+focus fallback — cross-city contamination likely',
              ctx,
              {
                categoryKey: key,
                requestedCity: normalizedCity,
                resolvedCity: (exact as any).reference_city,
                focus,
                profileId: (exact as any).id,
              },
            );
          } else if (normalizedCity) {
            logger.warn(
              'Intelligence profile resolved via focus fallback — type mismatch possible',
              ctx,
              {
                categoryKey: key,
                requestedCity: normalizedCity,
                requestedFocus: focus,
                resolvedFocus: (exact as any).intelligence_focus,
                profileId: (exact as any).id,
              },
            );
          }
          return exact as IntelligenceProfile;
        }

        // 4. No focus-matched profile found. Do NOT fall back to a
        //    category-only match that ignores focus — that would return a
        //    profile of a different intelligence type (e.g. an 'emerging'
        //    profile masquerading as 'gold_standards'), which is a type
        //    contamination bug. When a focus is explicitly requested, a
        //    miss must return null so the caller falls back to
        //    intelligence_mode: 'none' rather than running on a profile of
        //    the wrong type. The category-only fallback for the no-focus
        //    (business-scope §1B) path is handled below at step 5.
        return null;
      }

      // 5. No focus requested (business-scope §1B path) — category-only match.
      //    If a city was requested, prefer a city-specific profile; otherwise
      //    any active profile for the category.
      if (normalizedCity) {
        const cityProfile = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: { category_key: key, reference_city: normalizedCity, status: 'active' },
          orderBy: { version: 'desc' },
        });
        if (cityProfile) return cityProfile as IntelligenceProfile;
      }
      const profile = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: { category_key: key, status: 'active' },
        orderBy: { version: 'desc' },
      });
      if (!profile) return null;
      return profile as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.resolve failed', ctx, {
        error: (error as Error).message,
        categoryKey: key,
        focus: focus ?? 'none',
        city: normalizedCity ?? 'none',
        platform: normalizedPlatform ?? 'none',
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Resolve the category-intelligence (CI) profile for a category/city.
   *
   * CI profiles live under the discovery focuses — 'competitive' (established
   * market) then 'emerging' (thin/emerging market) — i.e. the category
   * intelligence produced by a Proving Ground discovery run. Gold-standard rows
   * are deliberately excluded: they are a separate benchmark dimension with a
   * different configuration shape (expected_fields / candidates), so rendering
   * one as the CI block yields an empty shell while duplicating the gold-
   * standard block. Callers that want the benchmark must use
   * resolveGoldStandard.
   *
   * Returns null when neither focus exists — the common case for campaigns
   * created outside a Proving Ground context, which never ran category
   * intelligence. Callers then degrade to a base render (a gold standard, if
   * one exists, still injects independently).
   */
  async resolveCategoryIntelligence(
    category: string,
    city?: string | null,
    platform?: string | null,
    ctx?: RequestCtx,
  ): Promise<IntelligenceProfile | null> {
    const competitive = await this.resolve(category, 'competitive', city, platform, ctx);
    if (competitive) return competitive;
    return this.resolve(category, 'emerging', city, platform, ctx);
  }

  /**
   * Get a specific version of a profile (for historical fidelity, §43).
   * Immutable version rows — the exact version used by a historical run
   * is always retrievable.
   */
  async getVersion(profileId: string, version: number, ctx?: RequestCtx): Promise<IntelligenceProfile | null> {
    try {
      const profile = await this.prisma.mkt_intelligence_profiles.findUnique({
        where: {
          id_version: { id: profileId, version },
        },
      });
      return profile as IntelligenceProfile | null;
    } catch (error) {
      logger.error('IntelligenceProfileService.getVersion failed', ctx, {
        error: (error as Error).message,
        profileId,
        version,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // LISTING
  // ====================

  /**
   * List all active profiles (for admin UI).
   * Optional focus filter — e.g. 'gold_standards' to list only gold-standard profiles.
   */
  async listActive(focus?: IntelligenceFocus, ctx?: RequestCtx): Promise<IntelligenceProfile[]> {
    try {
      const profiles = await this.prisma.mkt_intelligence_profiles.findMany({
        where: { status: 'active', ...(focus ? { intelligence_focus: focus } : {}) },
        orderBy: [{ category_key: 'asc' }, { version: 'desc' }],
      });
      return profiles as IntelligenceProfile[];
    } catch (error) {
      logger.error('IntelligenceProfileService.listActive failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * List all draft profiles awaiting activation (GAP-P8 — for admin UI).
   * Optional focus filter — e.g. 'gold_standards' to list only gold-standard drafts.
   */
  async listDrafts(focus?: IntelligenceFocus, ctx?: RequestCtx): Promise<IntelligenceProfile[]> {
    try {
      const profiles = await this.prisma.mkt_intelligence_profiles.findMany({
        where: { status: 'draft', ...(focus ? { intelligence_focus: focus } : {}) },
        orderBy: [{ category_key: 'asc' }, { version: 'desc' }],
      });
      return profiles as IntelligenceProfile[];
    } catch (error) {
      logger.error('IntelligenceProfileService.listDrafts failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Get a profile with all its versions (for admin detail view).
   */
  async getProfileWithVersions(profileId: string, ctx?: RequestCtx): Promise<IntelligenceProfile[]> {
    try {
      const profiles = await this.prisma.mkt_intelligence_profiles.findMany({
        where: { id: profileId },
        orderBy: { version: 'desc' },
      });
      return profiles as IntelligenceProfile[];
    } catch (error) {
      logger.error('IntelligenceProfileService.getProfileWithVersions failed', ctx, {
        error: (error as Error).message,
        profileId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // CREATION + LIFECYCLE
  // ====================

  /**
   * Create a new profile (manual authoring path — version 1, status 'draft').
   * Used by the hand-seed script and the admin create route.
   */
  async createProfile(input: {
    id?: string;
    categoryKey: string;
    categoryName: string;
    configurationJson: IntelligenceProfileConfiguration;
    status?: IntelligenceProfileStatus;
    intelligenceFocus?: IntelligenceFocus;
    referenceCity?: string | null;
    referenceState?: string | null;
    referencePlatform?: string | null;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const id = input.id || generateIntelligenceProfileId();
    const categoryKey = normalizeCategoryKey(input.categoryKey);
    const status = input.status ?? 'draft';
    const intelligenceFocus = input.intelligenceFocus ?? 'emerging';
    const referenceCity = normalizeReferenceCity(input.referenceCity ?? null);
    const referenceState = normalizeReferenceState(input.referenceState ?? null);
    const referencePlatform = normalizePlatformScope(input.referencePlatform);
    try {
      const profile = await this.prisma.mkt_intelligence_profiles.create({
        data: {
          id,
          category_key: categoryKey,
          category_name: input.categoryName,
          version: 1,
          intelligence_focus: intelligenceFocus,
          reference_city: referenceCity,
          reference_state: referenceState,
          reference_platform: referencePlatform,
          configuration_json: input.configurationJson as any,
          status,
        },
      });
      logger.info('Intelligence profile created', ctx, {
        profileId: id,
        categoryKey,
        status,
        intelligenceFocus,
        referenceCity,
        referenceState,
        referencePlatform,
      });
      return profile as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.createProfile failed', ctx, {
        error: (error as Error).message,
        categoryKey,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Import a profile as DRAFT from an external AI result (GAP-P8).
   * Called by the post-import hook when an intelligence_profile schema result
   * is imported via importExternalResult. Persists as status = 'draft'.
   * Does NOT activate — operator must explicitly call activateDraft().
   *
   * If a profile with the same id already exists, creates a new version number.
   * If no profile with the category_key exists, creates a new profile (version 1).
   *
   * The intelligenceFocus is read from the establishment campaign at import
   * time (Migration 202 — Profile Type Alignment) so the draft is born with
   * the correct type lineage. All versions of a profile id share the same focus.
   */
  async importAsDraft(input: {
    categoryKey: string;
    categoryName: string;
    configurationJson: IntelligenceProfileConfiguration;
    existingProfileId?: string;
    intelligenceFocus?: IntelligenceFocus;
    referenceCity?: string | null;
    referenceState?: string | null;
    referencePlatform?: string | null;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const categoryKey = normalizeCategoryKey(input.categoryKey);
    const intelligenceFocus = input.intelligenceFocus ?? 'emerging';
    const referenceCity = normalizeReferenceCity(input.referenceCity ?? null);
    const referenceState = normalizeReferenceState(input.referenceState ?? null);
    const referencePlatform = normalizePlatformScope(input.referencePlatform);
    try {
      // Determine the profile id + next version number
      let profileId = input.existingProfileId;
      let nextVersion = 1;

      if (profileId) {
        // Existing profile — find the max version
        const existing = await this.prisma.mkt_intelligence_profiles.findMany({
          where: { id: profileId },
          orderBy: { version: 'desc' },
          take: 1,
        });
        if (existing.length > 0) {
          nextVersion = existing[0].version + 1;
        }
      } else {
        // Check if a profile with this (category_key, reference_city,
        // reference_state, focus, reference_platform) already exists. City,
        // state, AND platform are part of the identity tuple so a
        // cross-platform establishment, a google-specific establishment, a
        // state-scoped establishment, and a nationwide establishment for the
        // same (category, focus) all get distinct profile ids. Without state
        // in the tuple, a state-scoped import (city=null, state="TX") would
        // match the nationwide profile (reference_city=null) and reuse its
        // id — then activating the state profile would retire the nationwide
        // one via activateDraft's "flip previous active to retired" logic.
        const findWhere: any = {
          category_key: categoryKey,
          intelligence_focus: intelligenceFocus,
        };
        if (referenceCity) {
          findWhere.reference_city = referenceCity;
        } else {
          findWhere.reference_city = null;
        }
        if (referenceState) {
          findWhere.reference_state = referenceState;
        } else {
          findWhere.reference_state = null;
        }
        if (referencePlatform) {
          findWhere.reference_platform = referencePlatform;
        } else {
          findWhere.reference_platform = null;
        }
        const existingByKey = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: findWhere,
          orderBy: { version: 'desc' },
        });
        if (existingByKey) {
          profileId = existingByKey.id;
          nextVersion = existingByKey.version + 1;
        } else {
          profileId = generateIntelligenceProfileId();
        }
      }

      const profile = await this.prisma.mkt_intelligence_profiles.create({
        data: {
          id: profileId,
          category_key: categoryKey,
          category_name: input.categoryName,
          version: nextVersion,
          intelligence_focus: intelligenceFocus,
          reference_city: referenceCity,
          reference_state: referenceState,
          reference_platform: referencePlatform,
          configuration_json: input.configurationJson as any,
          status: 'draft',
        },
      });
      logger.info('Intelligence profile imported as draft', ctx, {
        profileId,
        categoryKey,
        version: nextVersion,
        intelligenceFocus,
        referenceCity,
        referenceState,
        referencePlatform,
      });
      return profile as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.importAsDraft failed', ctx, {
        error: (error as Error).message,
        categoryKey,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Activate a draft profile (GAP-P8 — operator-driven).
   * Flips draft → active; flips any previous active version to 'retired'.
   * Atomic transaction. After activation, the resolver picks up the profile
   * for free (no resolver code change).
   */
  async activateDraft(profileId: string, version: number, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Verify the draft exists
        const draft = await tx.mkt_intelligence_profiles.findUnique({
          where: {
            id_version: { id: profileId, version },
          },
        });
        if (!draft) {
          throw new Error(`Profile ${profileId} v${version} not found`);
        }
        if (draft.status !== 'draft') {
          throw new Error(`Profile ${profileId} v${version} is not a draft (status: ${draft.status})`);
        }

        // 2. Retire any existing active version for this
        //    (category_key, reference_city, reference_state, focus,
        //     reference_platform) scope tuple.
        //    Type-scoped (Migration 202): activating a competitive draft retires
        //    only the prior active competitive profile — the active emerging
        //    profile for the same category is untouched.
        //    City-scoped (Migration 205): activating a Zionsville draft retires
        //    only the prior active Zionsville profile — the active Indianapolis
        //    profile for the same (category, focus) is untouched. NULL
        //    reference_city is treated as a distinct scope (city-agnostic).
        //    State-scoped (Migration 229): reference_state is also matched so
        //    two profiles in the same city name across different states do
        //    not retire each other.
        //    Platform-scoped (Migration 236): reference_platform is also matched
        //    so activating a google-specific draft does not retire the
        //    cross-platform profile for the same (category, city, state, focus).
        //    This must match the partial unique index
        //    idx_mkt_intel_profiles_active_scope (Migration 249) which enforces
        //    one active profile per full scope tuple.
        const retireWhere: any = {
          category_key: draft.category_key,
          intelligence_focus: draft.intelligence_focus,
          status: 'active',
        };
        if (draft.reference_city) {
          retireWhere.reference_city = draft.reference_city;
        } else {
          retireWhere.reference_city = null;
        }
        if (draft.reference_state) {
          retireWhere.reference_state = draft.reference_state;
        } else {
          retireWhere.reference_state = null;
        }
        if (draft.reference_platform) {
          retireWhere.reference_platform = draft.reference_platform;
        } else {
          retireWhere.reference_platform = null;
        }
        await tx.mkt_intelligence_profiles.updateMany({
          where: retireWhere,
          data: { status: 'retired', updated_at: new Date() },
        });

        // 3. Activate the draft
        const activated = await tx.mkt_intelligence_profiles.update({
          where: {
            id_version: { id: profileId, version },
          },
          data: { status: 'active', updated_at: new Date() },
        });

        return activated;
      });
      logger.info('Intelligence profile activated', ctx, {
        profileId,
        version,
        categoryKey: result.category_key,
      });

      // Post-activation market enrichment (non-blocking). Fire only on
      // first activation of a city-scoped, non-gold-standard establishment
      // profile. See CATEGORY_MARKET_ENRICHMENT_SPEC §5.3.
      if (result.intelligence_focus !== 'gold_standards' && result.reference_city && result.reference_state) {
        try {
          const existing = await this.prisma.$queryRaw`SELECT 1 FROM directory_category_enrichment
            WHERE category_key = ${result.category_key}
              AND city = ${result.reference_city}
              AND state = ${result.reference_state}
            LIMIT 1` as any[];
          if (!existing[0]) {
            void (async () => {
              try {
                const CategoryMarketEnrichmentService = (await import('../CategoryMarketEnrichmentService')).default;
                await CategoryMarketEnrichmentService.getInstance().enrichMarket(
                  result.category_key,
                  result.reference_city!,
                  result.reference_state!,
                  { triggerSource: 'profile_activated', enrichedBy: ctx?.userId },
                  ctx,
                );
                logger.info('post-activation market enrichment fired', ctx, {
                  profileId,
                  categoryKey: result.category_key,
                  city: result.reference_city,
                  state: result.reference_state,
                });
              } catch (err) {
                logger.warn('post-activation market enrichment failed (non-blocking)', ctx, {
                  error: (err as Error).message,
                });
              }
            })();
          } else {
            logger.info('market enrichment skipped after activation', ctx, {
              profileId,
              categoryKey: result.category_key,
              city: result.reference_city,
              state: result.reference_state,
              reason: 'already_enriched',
            });
          }
        } catch (err) {
          logger.warn('post-activation market enrichment lookup failed (non-blocking)', ctx, {
            error: (err as Error).message,
          });
        }
      } else {
        logger.info('market enrichment skipped after activation', ctx, {
          profileId,
          focus: result.intelligence_focus,
          referenceCity: result.reference_city,
          referenceState: result.reference_state,
          reason: result.intelligence_focus === 'gold_standards' ? 'gold_standards' : 'out_of_scope',
        });
      }

      return result as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.activateDraft failed', ctx, {
        error: (error as Error).message,
        profileId,
        version,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Delete a draft profile version (GAP-P8 — operator-driven cleanup).
   *
   * Only drafts may be deleted. Active and retired versions are immutable
   * historical records (§43 — historical fidelity) and cannot be removed;
   * attempting to delete a non-draft version throws. Deleting the last
   * remaining version of a profile id effectively removes the profile from
   * the admin UI (no row left to list).
   *
   * Drafts are inert — they have never been referenced by a run, so there
   * are no downstream referential-integrity concerns.
   */
  async deleteDraft(profileId: string, version: number, ctx?: RequestCtx): Promise<{ id: string; version: number }> {
    try {
      const draft = await this.prisma.mkt_intelligence_profiles.findUnique({
        where: {
          id_version: { id: profileId, version },
        },
      });
      if (!draft) {
        throw new Error(`Profile ${profileId} v${version} not found`);
      }
      if (draft.status !== 'draft') {
        throw new Error(
          `Profile ${profileId} v${version} is not a draft (status: ${draft.status}) — only drafts can be deleted`,
        );
      }

      await this.prisma.mkt_intelligence_profiles.delete({
        where: {
          id_version: { id: profileId, version },
        },
      });

      logger.info('Intelligence profile draft deleted', ctx, {
        profileId,
        version,
        categoryKey: draft.category_key,
      });
      return { id: profileId, version };
    } catch (error) {
      logger.error('IntelligenceProfileService.deleteDraft failed', ctx, {
        error: (error as Error).message,
        profileId,
        version,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Update a draft profile's configuration_json in place.
   *
   * Allows operators to correct or supplement scan output (e.g. fix
   * hallucinated profile URLs, add missing information, adjust quality
   * gate results) before activating the draft. Only drafts can be
   * edited — active and retired versions are immutable history.
   *
   * Optionally updates category_name if provided (useful when the scan
   * produced a slightly wrong display name).
   */
  async updateDraftConfiguration(
    profileId: string,
    version: number,
    input: { configurationJson: Record<string, any>; categoryName?: string },
    ctx?: RequestCtx,
  ): Promise<IntelligenceProfile> {
    try {
      const draft = await this.prisma.mkt_intelligence_profiles.findUnique({
        where: {
          id_version: { id: profileId, version },
        },
      });
      if (!draft) {
        throw new Error(`Profile ${profileId} v${version} not found`);
      }
      if (draft.status !== 'draft') {
        throw new Error(
          `Profile ${profileId} v${version} is not a draft (status: ${draft.status}) — only drafts can be edited`,
        );
      }

      const data: any = {
        configuration_json: input.configurationJson as any,
        updated_at: new Date(),
      };
      if (input.categoryName) {
        data.category_name = input.categoryName;
      }

      const updated = await this.prisma.mkt_intelligence_profiles.update({
        where: {
          id_version: { id: profileId, version },
        },
        data,
      });

      logger.info('Intelligence profile draft updated', ctx, {
        profileId,
        version,
        categoryKey: draft.category_key,
      });
      return updated as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.updateDraftConfiguration failed', ctx, {
        error: (error as Error).message,
        profileId,
        version,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Publish a new version from operator-supplied JSON (manual authoring path).
   * Creates a new immutable version row, flips the previous active version to
   * 'retired', marks the new one 'active'. Atomic transaction.
   */
  async publishVersion(profileId: string, input: {
    categoryName?: string;
    configurationJson: IntelligenceProfileConfiguration;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Find the max version for this profile id
        const existing = await tx.mkt_intelligence_profiles.findMany({
          where: { id: profileId },
          orderBy: { version: 'desc' },
          take: 1,
        });
        if (existing.length === 0) {
          throw new Error(`Profile ${profileId} not found`);
        }
        const latest = existing[0];
        const nextVersion = latest.version + 1;

        // 2. Retire any existing active version
        await tx.mkt_intelligence_profiles.updateMany({
          where: {
            id: profileId,
            status: 'active',
          },
          data: { status: 'retired', updated_at: new Date() },
        });

        // 3. Create the new active version — carry the focus + reference_city +
        //    reference_state from the latest version so all versions of a
        //    profile id share the same focus and city/state scope.
        const created = await tx.mkt_intelligence_profiles.create({
          data: {
            id: profileId,
            category_key: latest.category_key,
            category_name: input.categoryName ?? latest.category_name,
            version: nextVersion,
            intelligence_focus: latest.intelligence_focus,
            reference_city: latest.reference_city,
            reference_state: latest.reference_state,
            configuration_json: input.configurationJson as any,
            status: 'active',
          },
        });

        return created;
      });
      logger.info('Intelligence profile version published', ctx, {
        profileId,
        version: result.version,
      });
      return result as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.publishVersion failed', ctx, {
        error: (error as Error).message,
        profileId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // GOLD STANDARD SLOT PROMOTION (per-platform candidate injection)
  // ====================

  /**
   * Create a city/state-scoped gold-standard profile from the nationwide
   * profile. Copies expected_fields + quality_gates (the bar) from the
   * nationwide profile, starts with empty candidates (no slots filled),
   * and sets reference_city/reference_state to the requested scope.
   *
   * The scoped profile coexists with the nationwide profile — both are
   * active, and resolveGoldStandard resolves the scoped one first when
   * the business's city/state matches.
   *
   * The profile gets a new id (suffixed from the nationwide profile's id)
   * so it doesn't collide with the nationwide profile's version chain.
   *
   * Called automatically by addGoldStandardCandidate when a scoped
   * promotion is requested but no scoped profile exists yet. Can also be
   * called explicitly by an operator to pre-create a scoped profile.
   */
  async createScopedGoldStandardProfile(input: {
    nationwideProfileId: string;
    city?: string | null;
    state?: string | null;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const normalizedCity = normalizeReferenceCity(input.city);
    const normalizedState = normalizeReferenceState(input.state);

    if (!normalizedCity && !normalizedState) {
      throw new Error('At least one of city or state is required to create a scoped profile');
    }

    try {
      // 1. Load the nationwide active profile (the bar source)
      const nationwide = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: {
          id: input.nationwideProfileId,
          status: 'active',
          intelligence_focus: 'gold_standards',
          reference_city: null,
          reference_state: null,
        },
      });
      if (!nationwide) {
        throw new Error(`Nationwide gold-standard profile ${input.nationwideProfileId} not found or not nationwide-scoped`);
      }

      // 2. Check if a scoped profile already exists for this (city, state)
      const existing = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: {
          category_key: nationwide.category_key,
          intelligence_focus: 'gold_standards',
          reference_city: normalizedCity,
          reference_state: normalizedState,
          status: 'active',
        },
      });
      if (existing) {
        // Idempotent — return the existing scoped profile
        logger.info('Scoped gold-standard profile already exists (idempotent)', ctx, {
          nationwideProfileId: input.nationwideProfileId,
          scopedProfileId: existing.id,
          city: normalizedCity,
          state: normalizedState,
        });
        return existing as IntelligenceProfile;
      }

      // 3. Build the scoped config: copy the bar (expected_fields +
      //    quality_gates) from nationwide, empty candidates (no slots yet)
      const nationwideConfig = nationwide.configuration_json as any;
      const scopedConfig: Record<string, any> = {
        ...nationwideConfig,
        candidates: [], // empty — slots filled by promotions
        scan_metadata: {
          ...nationwideConfig?.scan_metadata,
          scoped_from: nationwide.id,
          scoped_from_version: nationwide.version,
          scope_city: normalizedCity,
          scope_state: normalizedState,
        },
      };

      // 4. Generate a new profile id for the scoped profile
      const scopedId = generateIntelligenceProfileId();

      // 5. Create the scoped profile as active (version 1)
      const created = await this.prisma.mkt_intelligence_profiles.create({
        data: {
          id: scopedId,
          category_key: nationwide.category_key,
          category_name: nationwide.category_name,
          version: 1,
          intelligence_focus: 'gold_standards',
          reference_city: normalizedCity,
          reference_state: normalizedState,
          reference_platform: nationwide.reference_platform,
          configuration_json: scopedConfig as any,
          status: 'active',
        },
      });

      logger.info('Scoped gold-standard profile created', ctx, {
        scopedProfileId: scopedId,
        nationwideProfileId: input.nationwideProfileId,
        categoryKey: nationwide.category_key,
        city: normalizedCity,
        state: normalizedState,
      });
      return created as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.createScopedGoldStandardProfile failed', ctx, {
        error: (error as Error).message,
        nationwideProfileId: input.nationwideProfileId,
        city: normalizedCity,
        state: normalizedState,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Promote a discovered candidate into a specific platform's gold-standard
   * slot on the active gold-standard profile. This is the operator-facing
   * "Add to {platform} slot" action — it replaces the manual JSON-surgery
   * workflow via publishVersion.
   *
   * Per-platform independence (architecture doc §"The discovery →
   * establishment relationship"): a candidate can be added to Google's slot
   * without being added to Yelp's. The candidate row in configuration_json
   * is shared, but each platform_evaluation has its own is_gold_standard
   * flag. This method flips only the target platform's flag.
   *
   * Rules:
   *   - Only gold-standard profiles (focus = 'gold_standards') have slots.
   *   - Only candidates flagged is_gold_standard = true by the analyst on
   *     the target platform can be promoted (operator curates, does not
   *     override the analyst's assessment).
   *   - Up to 4 gold-standard candidates per platform (cap enforced).
   *   - Idempotent: if the candidate is already in the profile with the
   *     target platform flagged gold-standard, returns the current active
   *     version without creating a new one.
   *   - If the candidate exists in the profile but the target platform's
   *     flag is false/null, flips it to true (the per-platform promotion
   *     case — adds to Google's slot without affecting Yelp's).
   *   - If the candidate is new, appends the full candidate object
   *     (preserving all platform_evaluations from the scan) with only the
   *     target platform's is_gold_standard set to true.
   *   - Creates a new active version (immutable version pattern — old
   *     active retires, new active with modified config takes over).
   *
   * Candidate matching: by business_name (case-insensitive, trimmed).
   * Addresses can be formatted differently across scans; business name is
   * the most stable key.
   */
  async addGoldStandardCandidate(profileId: string, input: {
    candidate: Record<string, any>;
    platform: string;
    /**
     * Optional geographic scope for the promotion. When provided, the
     * candidate is promoted into a city/state-scoped profile (created
     * from the nationwide profile if it doesn't exist yet) instead of
     * the nationwide profile. The profileId param is the nationwide
     * profile id — the scoped profile is resolved or created from it.
     */
    scope?: { city?: string | null; state?: string | null };
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const platform = input.platform.trim().toLowerCase();
    const candidateName = (input.candidate.business_name || '').trim();

    if (!platform) {
      throw new Error('Platform is required');
    }
    if (!candidateName) {
      throw new Error('Candidate business_name is required');
    }

    // Determine the target profile: if scope is provided, resolve or create
    // a scoped profile from the nationwide one. Otherwise, use profileId
    // directly (nationwide promotion — backward compatible).
    //
    // Edge case: the caller may pass the id of an ALREADY-SCOPED profile
    // (e.g. the frontend resolved the active profile for a city/state
    // campaign and got back the scoped profile, not the nationwide one).
    // In that case the scope hint is redundant — use the scoped profile
    // directly instead of trying to derive a new scoped profile from it
    // (which would fail because the id is not a nationwide profile).
    let targetProfileId = profileId;
    if (input.scope && (input.scope.city || input.scope.state)) {
      const direct = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: { id: profileId, status: 'active', intelligence_focus: 'gold_standards' },
      });
      if (direct && (direct.reference_city || direct.reference_state)) {
        // profileId is already a scoped profile — use it directly.
        targetProfileId = profileId;
      } else {
        const scopedProfile = await this.createScopedGoldStandardProfile({
          nationwideProfileId: profileId,
          city: input.scope.city,
          state: input.scope.state,
        }, ctx);
        targetProfileId = scopedProfile.id;
      }
    }

    try {
      // 1. Load the active version of the target profile (nationwide or scoped)
      const active = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: { id: targetProfileId, status: 'active' },
      });
      if (!active) {
        throw new Error(`Active profile ${targetProfileId} not found`);
      }

      // 2. Validate this is a gold-standard profile
      if (active.intelligence_focus !== 'gold_standards') {
        throw new Error(
          `Profile ${targetProfileId} is not a gold-standard profile (focus: ${active.intelligence_focus}). Only gold-standard profiles have platform slots.`,
        );
      }

      // 3. Validate the candidate has an is_gold_standard evaluation on the target platform
      const inputEvaluations: any[] = Array.isArray(input.candidate.platform_evaluations) ? input.candidate.platform_evaluations : [];
      const targetEval = inputEvaluations.find(
        (pe) => (pe.platform || '').trim().toLowerCase() === platform && pe.is_gold_standard === true,
      );
      if (!targetEval) {
        throw new Error(
          `Candidate "${candidateName}" was not flagged gold-standard on ${platform} by the analyst. Only analyst-flagged candidates can be promoted.`,
        );
      }

      // 4. Deep-clone the config and upsert the candidate
      const config = JSON.parse(JSON.stringify(active.configuration_json ?? {})) as Record<string, any>;
      const candidates: any[] = Array.isArray(config.candidates) ? config.candidates : [];

      // Find existing candidate by business_name (case-insensitive)
      const existingIdx = candidates.findIndex(
        (c) => (c.business_name || '').trim().toLowerCase() === candidateName.toLowerCase(),
      );

      if (existingIdx >= 0) {
        // Candidate already in profile — check if the target platform is already flagged
        const existing = candidates[existingIdx];
        const existingEvals: any[] = Array.isArray(existing.platform_evaluations) ? existing.platform_evaluations : [];
        const existingTargetEval = existingEvals.find(
          (pe) => (pe.platform || '').trim().toLowerCase() === platform,
        );

        if (existingTargetEval && existingTargetEval.is_gold_standard === true) {
          // Idempotent — already in slot. Return current active without new version.
          logger.info('Gold standard candidate already in slot (idempotent)', ctx, {
            profileId: targetProfileId,
            candidateName,
            platform,
          });
          return active as IntelligenceProfile;
        }

        // Flip the target platform's flag to true (per-platform promotion).
        // If the platform_evaluation doesn't exist on the existing candidate,
        // append it from the input scan data.
        if (existingTargetEval) {
          existingTargetEval.is_gold_standard = true;
        } else {
          existingEvals.push({ ...targetEval });
          existing.platform_evaluations = existingEvals;
        }
      } else {
        // New candidate — append the full object from the scan, but ensure
        // only the target platform's is_gold_standard is true. Other
        // platform evaluations retain their scan-assigned flags (may be
        // false/null) so the operator can later promote to those platforms.
        const newCandidate = JSON.parse(JSON.stringify(input.candidate));
        const newEvals: any[] = Array.isArray(newCandidate.platform_evaluations) ? newCandidate.platform_evaluations : [];
        for (const pe of newEvals) {
          const pePlatform = (pe.platform || '').trim().toLowerCase();
          pe.is_gold_standard = pePlatform === platform ? true : (pe.is_gold_standard ?? false);
        }
        candidates.push(newCandidate);
      }

      config.candidates = candidates;

      // 5. Enforce the 4-per-platform cap (count after the upsert)
      const goldCountForPlatform = candidates.reduce((count, c) => {
        const evals: any[] = Array.isArray(c.platform_evaluations) ? c.platform_evaluations : [];
        return count + (evals.some((pe) =>
          (pe.platform || '').trim().toLowerCase() === platform && pe.is_gold_standard === true,
        ) ? 1 : 0);
      }, 0);

      if (goldCountForPlatform > 4) {
        throw new Error(
          `Platform ${platform} already has 4 gold-standard candidates. Remove one before adding another.`,
        );
      }

      // 6. Create a new active version with the modified config (immutable
      //    version pattern — same transaction as publishVersion).
      const result = await this.prisma.$transaction(async (tx) => {
        // Find the max version for this profile id
        const existing = await tx.mkt_intelligence_profiles.findMany({
          where: { id: targetProfileId },
          orderBy: { version: 'desc' },
          take: 1,
        });
        if (existing.length === 0) {
          throw new Error(`Profile ${targetProfileId} not found`);
        }
        const latest = existing[0];
        const nextVersion = latest.version + 1;

        // Retire any existing active version
        await tx.mkt_intelligence_profiles.updateMany({
          where: { id: targetProfileId, status: 'active' },
          data: { status: 'retired', updated_at: new Date() },
        });

        // Create the new active version — carry metadata from the latest
        const created = await tx.mkt_intelligence_profiles.create({
          data: {
            id: targetProfileId,
            category_key: latest.category_key,
            category_name: latest.category_name,
            version: nextVersion,
            intelligence_focus: latest.intelligence_focus,
            reference_city: latest.reference_city,
            reference_state: latest.reference_state,
            reference_platform: latest.reference_platform,
            configuration_json: config as any,
            status: 'active',
          },
        });

        return created;
      });

      logger.info('Gold standard candidate promoted to platform slot', ctx, {
        profileId: targetProfileId,
        nationwideProfileId: input.scope ? profileId : undefined,
        version: result.version,
        candidateName,
        platform,
      });
      return result as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.addGoldStandardCandidate failed', ctx, {
        error: (error as Error).message,
        profileId: targetProfileId,
        nationwideProfileId: input.scope ? profileId : undefined,
        candidateName,
        platform,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Remove a candidate from a specific platform's gold-standard slot on the
   * active gold-standard profile. Flips is_gold_standard to false on the
   * target platform's evaluation for the matching candidate (by business_name,
   * case-insensitive). Creates a new active version.
   *
   * This is the inverse of addGoldStandardCandidate — it frees up a slot so
   * a new discovery can be promoted. The candidate row itself is NOT removed
   * from configuration_json.candidates (it may still be gold-standard on
   * other platforms); only the target platform's flag is flipped to false.
   *
   * Idempotent: if the candidate is not in the target platform's slot (flag
   * is already false/null or candidate not found), returns the current active
   * version without creating a new one.
   */
  async removeGoldStandardCandidate(profileId: string, input: {
    businessName: string;
    platform: string;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const platform = input.platform.trim().toLowerCase();
    const businessName = (input.businessName || '').trim();

    if (!platform) {
      throw new Error('Platform is required');
    }
    if (!businessName) {
      throw new Error('businessName is required');
    }

    try {
      // 1. Load the active version
      const active = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: { id: profileId, status: 'active' },
      });
      if (!active) {
        throw new Error(`Active profile ${profileId} not found`);
      }

      // 2. Validate gold-standard profile
      if (active.intelligence_focus !== 'gold_standards') {
        throw new Error(
          `Profile ${profileId} is not a gold-standard profile (focus: ${active.intelligence_focus}).`,
        );
      }

      // 3. Deep-clone config and find the candidate
      const config = JSON.parse(JSON.stringify(active.configuration_json ?? {})) as Record<string, any>;
      const candidates: any[] = Array.isArray(config.candidates) ? config.candidates : [];

      const existingIdx = candidates.findIndex(
        (c) => (c.business_name || '').trim().toLowerCase() === businessName.toLowerCase(),
      );

      if (existingIdx < 0) {
        // Candidate not in profile at all — idempotent
        logger.info('Gold standard candidate not in profile (idempotent remove)', ctx, {
          profileId, businessName, platform,
        });
        return active as IntelligenceProfile;
      }

      const existing = candidates[existingIdx];
      const existingEvals: any[] = Array.isArray(existing.platform_evaluations) ? existing.platform_evaluations : [];
      const existingTargetEval = existingEvals.find(
        (pe) => (pe.platform || '').trim().toLowerCase() === platform,
      );

      if (!existingTargetEval || existingTargetEval.is_gold_standard !== true) {
        // Not in this platform's slot — idempotent
        logger.info('Gold standard candidate not in platform slot (idempotent remove)', ctx, {
          profileId, businessName, platform,
        });
        return active as IntelligenceProfile;
      }

      // 4. Flip the flag to false
      existingTargetEval.is_gold_standard = false;
      config.candidates = candidates;

      // 5. Create a new active version
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.mkt_intelligence_profiles.findMany({
          where: { id: profileId },
          orderBy: { version: 'desc' },
          take: 1,
        });
        if (existing.length === 0) {
          throw new Error(`Profile ${profileId} not found`);
        }
        const latest = existing[0];
        const nextVersion = latest.version + 1;

        await tx.mkt_intelligence_profiles.updateMany({
          where: { id: profileId, status: 'active' },
          data: { status: 'retired', updated_at: new Date() },
        });

        const created = await tx.mkt_intelligence_profiles.create({
          data: {
            id: profileId,
            category_key: latest.category_key,
            category_name: latest.category_name,
            version: nextVersion,
            intelligence_focus: latest.intelligence_focus,
            reference_city: latest.reference_city,
            reference_state: latest.reference_state,
            reference_platform: latest.reference_platform,
            configuration_json: config as any,
            status: 'active',
          },
        });

        return created;
      });

      logger.info('Gold standard candidate removed from platform slot', ctx, {
        profileId,
        version: result.version,
        businessName,
        platform,
      });
      return result as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.removeGoldStandardCandidate failed', ctx, {
        error: (error as Error).message,
        profileId,
        businessName,
        platform,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // PROMPT BLOCK RENDERING
  // ====================

  /**
   * Render the discovery-relevant slice of the profile into prompt text
   * for the Intelligence scope. Includes terminology, specialized sources
   * with capabilities/limitations, discovery patterns, category evidence
   * rules, prohibited inferences, and category signals.
   */
  renderProfileBlock(profile: IntelligenceProfile, targetCity?: string | null): string {
    const config = profile.configuration_json as IntelligenceProfileConfiguration;
    const lines: string[] = [];
    const normalizedTarget = normalizeReferenceCity(targetCity);
    const profileCity = normalizeReferenceCity(profile.reference_city);

    lines.push('');
    lines.push('=== CATEGORY INTELLIGENCE PROFILE ===');
    lines.push(`Category: ${profile.category_name}`);
    lines.push(`Profile: ${profile.id} v${profile.version}`);
    if (profileCity) {
      lines.push(`Reference city (profile established for): ${profileCity}`);
    } else {
      lines.push('Reference city: city-agnostic (no reference market recorded)');
    }
    if (normalizedTarget) {
      lines.push(`Target city (this discovery campaign): ${normalizedTarget}`);
      if (profileCity && profileCity !== normalizedTarget) {
        // Render-time city mismatch guard (Migration 205). The profile was
        // established for a different city than the one this discovery
        // campaign is targeting. The configuration_json may contain
        // reference-city-specific supplier names, business examples, and
        // discovery patterns that, if followed literally, would surface
        // businesses in the reference city rather than the target city.
        // Emit an explicit directive so the AI re-targets the profile's
        // concrete examples to the target city instead of copying them.
        lines.push('');
        lines.push('--- CITY RETARGETING DIRECTIVE ---');
        lines.push(`This profile was established for ${profileCity}, but this discovery`);
        lines.push(`campaign targets ${normalizedTarget}. The specialized sources,`);
        lines.push('discovery patterns, supplier names, business examples, and community');
        lines.push(`references below were drawn from the ${profileCity} market. Apply the`);
        lines.push(`profile's CATEGORY-LEVEL knowledge (terminology, evidence rules,`);
        lines.push('prohibited inferences, signal definitions, source TYPES and their');
        lines.push('capability/limitation contracts) to the target city, but do NOT');
        lines.push(`import ${profileCity}-specific business names, supplier retailer lists,`);
        lines.push(`or ${profileCity}-specific search strings as-is. Re-derive concrete`);
        lines.push(`discovery queries, supplier retailer lists, and community sources for`);
        lines.push(`${normalizedTarget}. Exclude businesses located in ${profileCity} from`);
        lines.push(`the qualifying set unless they also serve the ${normalizedTarget} market.`);
        lines.push('Classify every discovered business by location relative to the TARGET');
        lines.push(`city (${normalizedTarget}), not the profile's reference city.`);
      } else if (!profileCity) {
        // City-agnostic profile applied to a city-specific campaign. The
        // configuration_json may still contain incidental city references
        // from whatever market the establishment campaign happened to use.
        lines.push('');
        lines.push('--- CITY APPLICATION DIRECTIVE ---');
        lines.push('This profile is city-agnostic (no reference market recorded). Apply');
        lines.push(`its category-level knowledge to ${normalizedTarget}. If the profile`);
        lines.push('body contains any concrete city names, supplier retailer lists, or');
        lines.push('business examples, treat them as illustrative of the category, not as');
        lines.push(`discovery targets. Re-derive concrete discovery queries for ${normalizedTarget}.`);
      }
    }
    lines.push('');

    if (config.terminology && Object.keys(config.terminology).length > 0) {
      lines.push('--- Terminology ---');
      for (const [term, definition] of Object.entries(config.terminology)) {
        lines.push(`  ${term}: ${definition}`);
      }
      lines.push('');
    }

    if (config.synonyms && config.synonyms.length > 0) {
      lines.push(`--- Synonyms ---`);
      lines.push(`  ${config.synonyms.join(', ')}`);
      lines.push('');
    }

    if (config.specialized_sources && config.specialized_sources.length > 0) {
      lines.push('--- Specialized Sources ---');
      for (const src of config.specialized_sources) {
        lines.push(`  [${src.priority ?? '-'}] ${src.name} (${src.type})`);
        if (src.capabilities && src.capabilities.length > 0) {
          lines.push(`    Capabilities: ${src.capabilities.join('; ')}`);
        }
        if (src.limitations && src.limitations.length > 0) {
          lines.push(`    Limitations: ${src.limitations.join('; ')}`);
        }
      }
      lines.push('');
    }

    if (
      config.geography_grid
      || (config.generic_label_set && config.generic_label_set.length > 0)
      || (config.label_independent_sweeps && config.label_independent_sweeps.length > 0)
    ) {
      lines.push('--- DISCOVERY SUBSTRATE (EXECUTION MANDATE) ---');
      const grid = config.geography_grid;
      if (grid) {
        const market = [grid.city, grid.state].filter(Boolean).join(', ');
        if (market) lines.push(`  Market: ${market}`);
        if (grid.zips && grid.zips.length > 0) {
          lines.push(`  ZIP sweep units (authoritative): ${grid.zips.join(', ')}`);
        }
        if (grid.corridors && grid.corridors.length > 0) {
          lines.push(`  Corridors: ${grid.corridors.join('; ')}`);
        }
        if (grid.adjacent_municipalities && grid.adjacent_municipalities.length > 0) {
          lines.push(`  Adjacent municipalities (retail catchment — sweep these too): ${grid.adjacent_municipalities.join(', ')}`);
        }
        if (typeof grid.radius_miles === 'number') {
          lines.push(`  Search radius: ${grid.radius_miles} miles`);
        }
      }
      if (config.generic_label_set && config.generic_label_set.length > 0) {
        lines.push('  Generic labels that SWALLOW this category (sweep these, not the correct label):');
        for (const entry of config.generic_label_set) {
          lines.push(`    [${entry.platform}] ${(entry.labels || []).join(', ')}`);
        }
      }
      if (config.label_independent_sweeps && config.label_independent_sweeps.length > 0) {
        lines.push('  Label-independent datasets (sweep by GEOGRAPHY, no category-name filter):');
        for (const sweep of config.label_independent_sweeps) {
          const url = sweep.url ? ` — ${sweep.url}` : '';
          lines.push(`    ${sweep.dataset}${url}`);
        }
      }
      lines.push(
        '  MANDATE: The sweep scope is the RETAIL CATCHMENT (principal city +',
        '  contiguous suburbs), not the administrative city. Sweep every ZIP/corridor',
        '  above INDEPENDENTLY. A sweep unit with zero findings is an executed-empty',
        '  result to report, not a silent gap. Run the generic-label x geography',
        '  matrix and every label-independent sweep by GEOGRAPHY (ZIP/address), then',
        '  filter to category fit by assortment evidence. Do NOT key the',
        '  label-independent sweeps on the category name — token-keying makes them',
        '  label-dependent and hides every business whose name does not self-identify',
        '  with the category.',
      );
      lines.push('');
    }

    if (config.discovery_patterns && Object.keys(config.discovery_patterns).length > 0) {
      lines.push('--- Discovery Patterns ---');
      lines.push(JSON.stringify(config.discovery_patterns, null, 2));
      lines.push('');
    }

    if (config.category_evidence_rules && Object.keys(config.category_evidence_rules).length > 0) {
      lines.push('--- Category Evidence Rules ---');
      lines.push(JSON.stringify(config.category_evidence_rules, null, 2));
      lines.push('');
    }

    if (config.prohibited_inferences && config.prohibited_inferences.length > 0) {
      lines.push('--- PROHIBITED INFERENCES (do NOT make these) ---');
      for (const inf of config.prohibited_inferences) {
        lines.push(`  - ${inf}`);
      }
      lines.push('');
    }

    if (config.category_signals && config.category_signals.length > 0) {
      lines.push('--- Category Signals ---');
      lines.push(`  ${config.category_signals.join(', ')}`);
      lines.push('');
    }

    lines.push('=== END CATEGORY INTELLIGENCE PROFILE ===');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Render the audit-relevant slice of the profile into prompt text for
   * business-scope resolution (§1B). Shares section renderers with
   * renderProfileBlock but with different sections enabled — includes
   * terminology, specialized sources + capability/limitation contracts,
   * category evidence rules, prohibited inferences, and category signals.
   * Excludes discovery patterns (not relevant for business audits).
   */
  renderBusinessProfileBlock(
    profile: IntelligenceProfile,
    targetCity?: string | null,
    headerTitle?: string,
    headerDirective?: string | null,
  ): string {
    const config = profile.configuration_json as IntelligenceProfileConfiguration;
    const lines: string[] = [];
    const normalizedTarget = normalizeReferenceCity(targetCity);
    const profileCity = normalizeReferenceCity(profile.reference_city);

    lines.push('');
    lines.push(`=== ${headerTitle ?? 'CATEGORY INTELLIGENCE (BUSINESS AUDIT AMPLIFICATION)'} ===`);
    if (headerDirective) {
      lines.push(headerDirective);
      lines.push('');
    }
    lines.push(`Category: ${profile.category_name}`);
    lines.push(`Profile: ${profile.id} v${profile.version}`);
    if (profileCity) {
      lines.push(`Reference city (profile established for): ${profileCity}`);
    }
    if (normalizedTarget && profileCity && profileCity !== normalizedTarget) {
      lines.push(`Target city (this business audit): ${normalizedTarget}`);
      lines.push('');
      lines.push('--- CITY RETARGETING DIRECTIVE ---');
      lines.push(`This profile was established for ${profileCity}, but this business audit`);
      lines.push(`targets a business in ${normalizedTarget}. Apply the category-level`);
      lines.push('evidence rules, terminology, and signal definitions, but do NOT import');
      lines.push(`${profileCity}-specific supplier names or business examples as evidence`);
      lines.push(`about the ${normalizedTarget} business under audit.`);
    }
    lines.push('');

    if (config.terminology && Object.keys(config.terminology).length > 0) {
      lines.push('--- Terminology ---');
      for (const [term, definition] of Object.entries(config.terminology)) {
        lines.push(`  ${term}: ${definition}`);
      }
      lines.push('');
    }

    if (config.specialized_sources && config.specialized_sources.length > 0) {
      lines.push('--- Specialized Sources (use these for evidence corroboration) ---');
      for (const src of config.specialized_sources) {
        lines.push(`  [${src.priority ?? '-'}] ${src.name} (${src.type})`);
        if (src.capabilities && src.capabilities.length > 0) {
          lines.push(`    Capabilities: ${src.capabilities.join('; ')}`);
        }
        if (src.limitations && src.limitations.length > 0) {
          lines.push(`    Limitations: ${src.limitations.join('; ')}`);
        }
      }
      lines.push('');
    }

    if (config.category_evidence_rules && Object.keys(config.category_evidence_rules).length > 0) {
      lines.push('--- Category Evidence Rules ---');
      lines.push(JSON.stringify(config.category_evidence_rules, null, 2));
      lines.push('');
    }

    if (config.prohibited_inferences && config.prohibited_inferences.length > 0) {
      lines.push('--- PROHIBITED INFERENCES (do NOT make these inferences for this category) ---');
      for (const inf of config.prohibited_inferences) {
        lines.push(`  - ${inf}`);
      }
      lines.push('');
    }

    if (config.category_signals && config.category_signals.length > 0) {
      lines.push('--- Category Signals (discovery signals relevant to this category) ---');
      lines.push(`  ${config.category_signals.join(', ')}`);
      lines.push('');
    }

    lines.push('=== END CATEGORY INTELLIGENCE ===');
    lines.push('');

    return lines.join('\n');
  }

  // ====================
  // GOLD STANDARD SYSTEM (Sprint 0)
  // ====================

  /**
   * Resolve the active gold-standard profile for a category.
   *
   * City/state-aware resolution (scoped gold standards):
   *   - If `city` is provided, first try a city-specific profile
   *     (reference_city matches, reference_state matches).
   *   - If no city-specific profile exists but `state` is provided, try a
   *     state-specific profile (reference_city = NULL, reference_state
   *     matches).
   *   - If neither exists, fall back to the nationwide profile
   *     (reference_city = NULL, reference_state = NULL).
   *
   * Platform-aware resolution (Migration 236):
   *   At each geographic layer, platform-specific profiles are preferred
   *   over cross-platform profiles. The full fallback chain is:
   *     1. (city, state, platform)     — most specific
   *     2. (city, state, platform=null) — city+state, cross-platform
   *     3. (city=null, state, platform)  — state, platform-specific
   *     4. (city=null, state, platform=null) — state, cross-platform
   *     5. (city=null, state=null, platform)  — nationwide, platform-specific
   *     6. (city=null, state=null, platform=null) — nationwide, cross-platform
   *
   * Returns null on miss → caller uses degraded fallback (no benchmark).
   */
  async resolveGoldStandard(
    category: string,
    platform?: string | null,
    city?: string | null,
    state?: string | null,
    ctx?: RequestCtx,
  ): Promise<IntelligenceProfile | null> {
    const key = normalizeCategoryKey(category);
    const normalizedCity = normalizeReferenceCity(city);
    const normalizedState = normalizeReferenceState(state);
    const normalizedPlatform = platform ? platform.trim().toLowerCase() || null : null;

    try {
      const buildWhere = (cityVal: string | null, stateVal: string | null, platformVal: string | null) => {
        const w: any = {
          category_key: key,
          intelligence_focus: 'gold_standards' as const,
          reference_city: cityVal,
          reference_state: stateVal,
          status: 'active',
        };
        if (platformVal) {
          w.reference_platform = platformVal;
        } else {
          w.reference_platform = null;
        }
        return w;
      };

      const tryFind = async (cityVal: string | null, stateVal: string | null, platformVal: string | null): Promise<IntelligenceProfile | null> => {
        const found = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: buildWhere(cityVal, stateVal, platformVal),
          orderBy: { version: 'desc' },
        });
        return found as IntelligenceProfile | null;
      };

      // ── Layer 1: City-specific (reference_city + reference_state match) ──
      if (normalizedCity && normalizedState) {
        if (normalizedPlatform) {
          const s1 = await tryFind(normalizedCity, normalizedState, normalizedPlatform);
          if (s1) return s1;
        }
        const s2 = await tryFind(normalizedCity, normalizedState, null);
        if (s2) {
          if (normalizedPlatform) {
            logger.warn('Gold standard profile resolved via city+cross-platform fallback', ctx, {
              categoryKey: key, requestedCity: normalizedCity, requestedState: normalizedState,
              requestedPlatform: normalizedPlatform, profileId: (s2 as any).id,
            });
          }
          return s2;
        }
      }

      // ── Layer 2: State-specific (reference_city = NULL, reference_state match) ──
      if (normalizedState) {
        if (normalizedPlatform) {
          const s3 = await tryFind(null, normalizedState, normalizedPlatform);
          if (s3) {
            logger.info('Gold standard profile resolved via state-specific match', ctx, {
              categoryKey: key, requestedState: normalizedState,
              requestedPlatform: normalizedPlatform, profileId: (s3 as any).id,
            });
            return s3;
          }
        }
        const s4 = await tryFind(null, normalizedState, null);
        if (s4) {
          logger.info('Gold standard profile resolved via state-specific cross-platform fallback', ctx, {
            categoryKey: key, requestedState: normalizedState, profileId: (s4 as any).id,
          });
          return s4;
        }
      }

      // ── Layer 3: Nationwide (reference_city = NULL, reference_state = NULL) ──
      if (normalizedPlatform) {
        const s5 = await tryFind(null, null, normalizedPlatform);
        if (s5) {
          if (normalizedCity || normalizedState) {
            logger.info('Gold standard profile resolved via nationwide fallback (no scoped profile)', ctx, {
              categoryKey: key, requestedCity: normalizedCity, requestedState: normalizedState,
              requestedPlatform: normalizedPlatform, profileId: (s5 as any).id,
            });
          }
          return s5;
        }
      }
      const s6 = await tryFind(null, null, null);
      if (s6) {
        if (normalizedCity || normalizedState || normalizedPlatform) {
          logger.info('Gold standard profile resolved via nationwide cross-platform fallback', ctx, {
            categoryKey: key, requestedCity: normalizedCity, requestedState: normalizedState,
            requestedPlatform: normalizedPlatform, profileId: (s6 as any).id,
          });
        }
        return s6;
      }

      return null;
    } catch (error) {
      logger.error('IntelligenceProfileService.resolveGoldStandard failed', ctx, {
        error: (error as Error).message,
        categoryKey: key,
        requestedCity: normalizedCity,
        requestedState: normalizedState,
        requestedPlatform: normalizedPlatform,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Resolve signal_weight(category, platform) for a set of platforms.
   *
   * Scans every active profile for the category (any focus — gold-standard
   * establishments carry national weights, market establishments carry local
   * ones) and applies the confidence-gated local-over-national rule in
   * resolveSignalWeightsFromProfiles.
   *
   * Returns a Map keyed by normalized platform key. A platform with no
   * resolvable weight is simply absent — callers treat that as unweighted
   * legacy scoring (no profile → byte-identical behavior).
   */
  async resolveSignalWeights(
    input: {
      category: string;
      platforms: string[];
      city?: string | null;
      state?: string | null;
    },
    ctx?: RequestCtx,
  ): Promise<Map<string, ResolvedSignalWeight>> {
    const key = normalizeCategoryKey(input.category);
    if (!key || !Array.isArray(input.platforms) || input.platforms.length === 0) {
      return new Map();
    }
    try {
      const profiles = await this.prisma.mkt_intelligence_profiles.findMany({
        where: { category_key: key, status: 'active' },
        orderBy: { version: 'desc' },
      });
      return resolveSignalWeightsFromProfiles(profiles as IntelligenceProfile[], input);
    } catch (error) {
      logger.error('IntelligenceProfileService.resolveSignalWeights failed', ctx, {
        error: (error as Error).message,
        categoryKey: key,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Resolve the confidence-gated platform signal divergences for a
   * category/market — the platforms where a local (or regional) estimate
   * outranks the national one BECAUSE its confidence cleared the §4 gate,
   * and the measured delta is non-zero (spec §5).
   *
   * Unlike resolveSignalWeights this scans every platform the profiles
   * measured — a divergence report should not depend on the caller guessing
   * which platforms diverged. Returns [] when nothing diverges or no
   * profiles resolve; failures are non-fatal (warn + []).
   */
  async resolveSignalDivergences(
    input: { category: string; city?: string | null; state?: string | null },
    ctx?: RequestCtx,
  ): Promise<ResolvedSignalWeight[]> {
    const key = normalizeCategoryKey(input.category);
    if (!key) return [];
    try {
      const profiles = await this.prisma.mkt_intelligence_profiles.findMany({
        where: { category_key: key, status: 'active' },
        orderBy: { version: 'desc' },
      });
      const platforms = new Set<string>();
      for (const p of profiles) {
        for (const k of extractSignalWeightEntries(p.configuration_json).keys()) {
          platforms.add(k);
        }
      }
      if (platforms.size === 0) return [];
      const resolved = resolveSignalWeightsFromProfiles(
        profiles as IntelligenceProfile[],
        { platforms: [...platforms], city: input.city, state: input.state },
      );
      return [...resolved.values()].filter(
        (w) => w.precedenceViaConfidence && w.divergence != null && w.divergence !== 0,
      );
    } catch (error) {
      logger.warn('IntelligenceProfileService.resolveSignalDivergences failed (non-fatal)', ctx, {
        error: (error as Error).message,
        categoryKey: key,
      });
      return [];
    }
  }

  /**
   * Convenience resolver for signal-weight consumers that hold a campaign
   * row and an audit payload (Phase 6). Collects the platform keys the audit
   * touched (platforms.* + render_controls.* + the core directory set) and
   * returns a plain Record of normalized platform → signal_weight.
   *
   * Returns `undefined` when nothing resolved — no category, no profiles,
   * or an empty weight set — so callers can pass the result straight into
   * `platformSignalWeights` and get legacy behavior automatically. Failures
   * are non-fatal (warn + undefined): a weight lookup must never break the
   * consumer's primary path.
   */
  async resolveSignalWeightMapForCampaign(
    campaign: { category?: string | null; city?: string | null; state?: string | null } | null | undefined,
    auditData: any,
    ctx?: RequestCtx,
  ): Promise<Record<string, number> | undefined> {
    const resolved = await this.resolveSignalWeightsForCampaign(campaign, auditData, ctx);
    if (!resolved || resolved.size === 0) return undefined;
    const out: Record<string, number> = {};
    for (const [k, v] of resolved) out[k] = v.weight;
    return out;
  }

  /**
   * Full-resolution sibling of resolveSignalWeightMapForCampaign — returns
   * the ResolvedSignalWeight objects (weight + basis + confidence + scope +
   * divergence) instead of flattening to numbers. For consumers that need
   * the metadata, e.g. the pitch's lead-platform premise which grounds the
   * "customers are on this platform" claim in the measured `basis` (spec §2).
   *
   * Same non-fatal contract: `undefined` when nothing resolves.
   */
  async resolveSignalWeightsForCampaign(
    campaign: { category?: string | null; city?: string | null; state?: string | null } | null | undefined,
    auditData: any,
    ctx?: RequestCtx,
  ): Promise<Map<string, ResolvedSignalWeight> | undefined> {
    if (!campaign?.category) return undefined;
    try {
      const platforms = new Set<string>(['google', 'yelp', 'facebook', 'bbb']);
      for (const k of Object.keys(auditData?.platforms ?? {})) platforms.add(k);
      const controls = (auditData as any)?.render_controls;
      if (Array.isArray(controls)) {
        for (const rc of controls) {
          const p = normalizeSignalPlatformKey(rc?.platform);
          if (p) platforms.add(p);
        }
      }
      // Also scan gap_analysis / quality_gate_results — a platform the audit
      // flagged weak is a lead-platform candidate even if it has no render
      // control or platforms entry (spec §2: weight × gap_severity).
      for (const g of auditData?.gap_analysis ?? []) {
        const p = normalizeSignalPlatformKey(g?.platform);
        if (p) platforms.add(p);
      }
      for (const q of auditData?.quality_gate_results ?? []) {
        const p = normalizeSignalPlatformKey(q?.platform);
        if (p) platforms.add(p);
      }
      const resolved = await this.resolveSignalWeights(
        {
          category: campaign.category,
          platforms: [...platforms],
          city: campaign.city ?? null,
          state: campaign.state ?? null,
        },
        ctx,
      );
      return resolved.size === 0 ? undefined : resolved;
    } catch (error) {
      logger.warn('IntelligenceProfileService.resolveSignalWeightsForCampaign failed (non-fatal)', ctx, {
        error: (error as Error).message,
      });
      return undefined;
    }
  }

  /**
   * Serialize a resolved signal-weight set into the prompt block the triage
   * briefing / repair seeks consume (spec §2 "Reported, not applied").
   * Computes the lead platform (weight × gap severity) from the audit data.
   * Returns '' when no weights resolved — callers skip the block silently
   * (legacy render preserved).
   */
  serializeSignalWeightContext(
    resolved: Map<string, ResolvedSignalWeight> | undefined,
    auditData: any,
  ): string {
    if (!resolved || resolved.size === 0) return '';
    return serializeSignalWeightContextBlock(resolved, selectLeadPlatform(auditData, resolved));
  }

  /**
   * Build the scan variables for a gold-standard scan prompt.
   *
   * The gold-standard scan template references {category} and {platform}.
   * This method ensures the platform variable is populated from the
   * campaign's intelligence_platform field, falling back to 'all'.
   */
  buildGoldStandardScanVariables(campaign: {
    category?: string | null;
    intelligence_platform?: string | null;
  }): Record<string, string> {
    return {
      category: campaign.category || '',
      platform: campaign.intelligence_platform || 'all',
    };
  }

  /**
   * Serialize a gold-standard profile into a prompt text block for
   * injection into audit (benchmark) and fulfill (target) prompts.
   *
   * The block includes:
   *   - A role-specific directive (benchmark vs target)
   *   - Expected fields (universal + per-platform)
   *   - Quality gates (non_negotiable + recommended)
   *   - Pattern exemplars (business name, quality score, destination URL,
   *     platform config)
   *
   * Returns an empty string if the profile has no gold-standard data
   * (no expected_fields and no candidates) so the caller can skip
   * injection without producing an empty section.
   */
  /**
   * Select the top-N gold-standard platform evaluations per platform,
   * ranked by quality_score descending (null/undefined scores sort last).
   * Ties on quality_score break by business_name ascending for determinism.
   *
   * Returns a Set of `${platform}::${business_name}` keys identifying which
   * (candidate, platform) pairs survived the cap. Callers use the set to
   * filter platform_evaluations during exemplar emission.
   */
  private selectTopExemplarsPerPlatform(
    candidates: any[],
    cap: number,
  ): Set<string> {
    const all: Array<{ businessName: string; platform: string; qualityScore: number | null | undefined }> = [];
    for (const c of candidates) {
      if (!Array.isArray(c.platform_evaluations)) continue;
      for (const pe of c.platform_evaluations) {
        if (pe.is_gold_standard !== true) continue;
        all.push({
          businessName: c.business_name,
          platform: pe.platform,
          qualityScore: pe.quality_score,
        });
      }
    }
    const byPlatform = new Map<string, typeof all>();
    for (const e of all) {
      const arr = byPlatform.get(e.platform) ?? [];
      arr.push(e);
      byPlatform.set(e.platform, arr);
    }
    const selected = new Set<string>();
    for (const [, arr] of byPlatform) {
      arr.sort((a, b) => {
        const aq = a.qualityScore ?? -1;
        const bq = b.qualityScore ?? -1;
        if (bq !== aq) return bq - aq;
        return a.businessName.localeCompare(b.businessName);
      });
      for (const e of arr.slice(0, cap)) {
        selected.add(`${e.platform}::${e.businessName}`);
      }
    }
    return selected;
  }

  serializeGoldStandard(
    profile: IntelligenceProfile,
    role: GoldStandardRole,
  ): string {
    const config = profile.configuration_json as any;
    if (!config) return '';

    const expectedFields = config.expected_fields;
    const candidates = config.candidates;
    if (!expectedFields && !candidates) return '';

    const lines: string[] = [];
    const roleLabel = role === 'benchmark'
      ? 'BENCHMARK'
      : role === 'target'
      ? 'TARGET'
      : role === 'discovery_benchmark'
      ? 'DISCOVERY BENCHMARK'
      : role === 'market_reference'
      ? 'MARKET REFERENCE'
      : 'DISCOVERY CRITERIA';
    const roleAction = role === 'benchmark'
      ? 'Compare the business\'s actual profile against these expected fields and quality gates. Flag any field where the business\'s actual value differs from the expected value as a gap.'
      : role === 'target'
      ? 'Generate fix instructions that move the business\'s profile toward these expected field values. Use the pattern exemplar as the concrete adaptation source.'
      : role === 'discovery_benchmark'
      ? 'Rate each discovered candidate against these established expected fields and quality gates. For each candidate, evaluate per-platform: a candidate may meet the gold standard on one platform but fail on another. This evaluation is informational and must follow the surrounding focus directive. It must not determine prospect eligibility by itself: in EMERGING focus, gold-standard gaps are opportunity signals rather than disqualifiers, while in COMPETITIVE focus, established leaders remain in scope. Pattern Exemplars establish the high reference bar for comparison in both focuses; they are not automatically candidate-selection targets in this shared block. In EMERGING focus, lower quality means lower digital-profile quality or lower gold-standard fulfillment only, measured through observable online fields such as NAP consistency, category presentation, hours, website presence, photos, reviews, descriptions, social links, and platform coverage. Lower digital-profile quality does not mean poor business quality, poor products, poor service, low customer trust, low revenue, or low customer volume. Do not infer a gap where information was unavailable. The surrounding focus controls selection: COMPETITIVE selects candidates most similar to the gold-standard bar, while EMERGING selects category-qualified candidates with the largest observed, fixable digital-profile gaps. Populate gold_standard_gate_results per candidate with per-gate pass/fail (informational — does NOT filter gold_standard_match). Do NOT re-derive expected_fields — the ones below are the rating benchmark. Aggregate per-platform gate failures into platform_analysis.platform_breakdown, and recommend a primary_platform for outreach based on where the gold standard is deepest AND where candidates have the most fixable gaps (highest-opportunity platform, not just the most-present platform). Populate platform_analysis.outreach_recommendation with platform-specific opportunities and a recommended_platform_focus that downstream business audits should target.'
      : role === 'market_reference'
      ? 'This enrichment campaign was spawned from a Proving Ground campaign for this category and market. The profile below is the established Gold Standard for this category — the bar that top-tier local businesses in this category meet across their online presence (NAP consistency, category presentation, hours, website, photos, reviews, descriptions, social links, platform coverage). Use it as a market reference to inform your SEO copy: let the expected fields and pattern exemplars shape what you describe as the category\'s strengths, what shoppers should look for, and which related categories tend to co-occur with strong businesses in this market. Do NOT copy business names, ratings, or specific facts from the exemplars into your copy — the public page renders real aggregates separately. Do NOT mention "gold standard", "profile", or this directive in the visible body_copy. The profile is context that sharpens your copy, not content to surface.'
      : 'Evaluate each discovered candidate against these established expected fields and quality gates. Flag is_gold_standard = true for the TOP candidates per platform (up to 4), relative to the candidate pool and the existing benchmark exemplars. A candidate that is at least as strong as the existing benchmark on a platform qualifies — they do NOT need to pass every non_negotiable gate. The quality_score and quality_gates_passed/failed capture the absolute quality signal. Do NOT re-derive expected_fields — the ones below are already established. Return the same expected_fields in your output (echoed from this profile) so downstream audits stay consistent.';

    lines.push('');
    lines.push(`=== GOLD STANDARD ${roleLabel} ===`);
    lines.push(`Category: ${profile.category_name}`);
    lines.push(`Profile: ${profile.id} v${profile.version}`);
    if (role === 'discovery_benchmark') {
      const platformLabel = profile.reference_platform
        ? profile.reference_platform
        : 'cross-platform (all platforms)';
      lines.push(`Platform scope: ${platformLabel}`);
    }
    if (role === 'market_reference') {
      const scopeLabel = profile.reference_city || profile.reference_state
        ? `${profile.reference_city || ''}${profile.reference_city && profile.reference_state ? ', ' : ''}${profile.reference_state || ''}`
        : 'nationwide';
      lines.push(`Market scope: ${scopeLabel}`);
    }
    lines.push('');
    lines.push(`DIRECTIVE: This is your ${roleLabel} for this category. ${roleAction}`);
    lines.push('');

    // Universal expected fields
    if (expectedFields?.universal) {
      const u = expectedFields.universal;
      lines.push('--- Universal Expected Fields ---');
      if (u.canonical_name) lines.push(`  Canonical name: ${u.canonical_name}`);
      if (u.canonical_address) lines.push(`  Canonical address: ${u.canonical_address}`);
      if (u.canonical_phone) lines.push(`  Canonical phone: ${u.canonical_phone}`);
      if (u.hours_present !== undefined) lines.push(`  Hours present: ${u.hours_present}`);
      if (u.website_present !== undefined) lines.push(`  Website present: ${u.website_present}`);
      if (u.fields && Array.isArray(u.fields)) {
        for (const f of u.fields) {
          lines.push(`  ${f.field}: ${f.description}${f.severity ? ` (${f.severity})` : ''}`);
        }
      }
      if (u.quality_gates && Array.isArray(u.quality_gates)) {
        lines.push('  Quality Gates:');
        for (const g of u.quality_gates) {
          lines.push(`    [${g.severity}] ${g.field}: ${g.description}`);
        }
      }
      lines.push('');
    }

    // Platform-specific expected fields
    if (expectedFields?.platforms) {
      for (const [platformKey, platformFields] of Object.entries(expectedFields.platforms)) {
        const pf = platformFields as any;
        lines.push(`--- Platform: ${platformKey} ---`);
        if (pf.primary_category) lines.push(`  Primary category: ${pf.primary_category}`);
        if (pf.additional_categories) lines.push(`  Additional categories: ${pf.additional_categories.join(', ')}`);
        if (pf.required_attributes) lines.push(`  Required attributes: ${pf.required_attributes.join(', ')}`);
        if (pf.recommended_attributes) lines.push(`  Recommended attributes: ${pf.recommended_attributes.join(', ')}`);
        if (pf.description_requirements) lines.push(`  Description requirements: ${pf.description_requirements}`);
        if (pf.page_type) lines.push(`  Page type: ${pf.page_type}`);
        if (pf.expected_photo_count !== undefined) lines.push(`  Expected photo count: ${pf.expected_photo_count}`);
        if (pf.branding_expectations) {
          const be = pf.branding_expectations;
          lines.push('  Branding expectations:');
          if (be.has_logo !== undefined) lines.push(`    Has logo: ${be.has_logo}`);
          if (be.has_cover_photo !== undefined) lines.push(`    Has cover photo: ${be.has_cover_photo}`);
          if (be.has_profile_photo !== undefined) lines.push(`    Has profile photo: ${be.has_profile_photo}`);
          if (be.photo_count !== undefined) lines.push(`    Photo count: ${be.photo_count}`);
          if (be.photo_types) lines.push(`    Photo types: ${be.photo_types.join(', ')}`);
        }
        if (pf.fields && Array.isArray(pf.fields)) {
          lines.push('  Fields:');
          for (const f of pf.fields) {
            lines.push(`    ${f.field}: ${f.description}${f.severity ? ` (${f.severity})` : ''}`);
          }
        }
        if (pf.quality_gates && Array.isArray(pf.quality_gates)) {
          lines.push('  Quality Gates:');
          for (const g of pf.quality_gates) {
            lines.push(`    [${g.severity}] ${g.field}: ${g.description}`);
          }
        }
        lines.push('');
      }
    }

    // Pattern exemplars (candidates flagged as gold standard).
    //
    // For non-target roles (benchmark, discovery, discovery_benchmark) we cap
    // the emitted exemplars to the top MAX_EXEMPLARS_PER_PLATFORM per platform,
    // ranked by quality_score desc. The top exemplar per platform already
    // establishes the bar; a second provides a comparison point. Emitting all
    // 4 slots per platform on a saturated niche adds token cost without
    // changing the analyst's rating behavior.
    //
    // The 'target' (fulfill) role is exempt — fix instructions benefit from
    // the full exemplar pool as adaptation sources.
    if (candidates && Array.isArray(candidates)) {
      const exemplarCap = role === 'target' ? Infinity : MAX_EXEMPLARS_PER_PLATFORM;
      const selectedKeys = exemplarCap === Infinity
        ? null
        : this.selectTopExemplarsPerPlatform(candidates, exemplarCap);
      const exemplarsWithSelected = candidates
        .filter((c: any) => Array.isArray(c.platform_evaluations))
        .map((c: any) => ({
          candidate: c,
          selectedEvals: c.platform_evaluations.filter((pe: any) =>
            pe.is_gold_standard === true
            && (selectedKeys === null
              || selectedKeys.has(`${pe.platform}::${c.business_name}`)),
          ),
        }))
        .filter((x: any) => x.selectedEvals.length > 0);
      if (exemplarsWithSelected.length > 0) {
        lines.push('--- Pattern Exemplars ---');
        for (const { candidate: ex, selectedEvals } of exemplarsWithSelected) {
          lines.push(`  Business: ${ex.business_name}`);
          if (ex.city) lines.push(`    City: ${ex.city}`);
          if (ex.category_notes) lines.push(`    Notes: ${ex.category_notes}`);
          for (const pe of selectedEvals) {
            lines.push(`    Platform: ${pe.platform}`);
            if (pe.profile_url) lines.push(`      Destination URL: ${pe.profile_url}`);
            if (pe.quality_score !== undefined && pe.quality_score !== null) {
              lines.push(`      Quality score: ${pe.quality_score}/10`);
            }
            if (pe.quality_rationale) lines.push(`      Rationale: ${pe.quality_rationale}`);
            if (pe.branding_artifacts) {
              const ba = pe.branding_artifacts;
              if (ba.has_logo) lines.push(`      Has logo: yes`);
              if (ba.has_cover_photo) lines.push(`      Has cover photo: yes`);
              if (ba.photo_count !== undefined && ba.photo_count !== null) {
                lines.push(`      Photo count: ${ba.photo_count}`);
              }
            }
          }
        }
        lines.push('');
      }
    }

    lines.push('=== END GOLD STANDARD ===');
    lines.push('');

    return lines.join('\n');
  }

  // ─── Bronze Standard (BRONZE_STANDARD_SPEC) ───────────────────────────

  /**
   * Resolve the active bronze-standard profile for a category, cascading
   * city+state → state → nationwide with platform-exact → cross-platform at
   * each layer (mirrors resolveGoldStandard; spec §4/§3.6.5). A null platform
   * matches the cross-platform row only — a platform-scoped bronze profile
   * and the cross-platform profile for the same market are distinct rows.
   */
  async resolveBronzeStandard(
    category: string,
    platform?: string | null,
    city?: string | null,
    state?: string | null,
    ctx?: RequestCtx,
  ): Promise<IntelligenceProfile | null> {
    const key = normalizeCategoryKey(category);
    const normalizedCity = normalizeReferenceCity(city);
    const normalizedState = normalizeReferenceState(state);
    const normalizedPlatform = platform ? platform.trim().toLowerCase() || null : null;

    try {
      const buildWhere = (cityVal: string | null, stateVal: string | null, platformVal: string | null) => {
        const w: any = {
          category_key: key,
          intelligence_focus: 'bronze_standards' as const,
          reference_city: cityVal,
          reference_state: stateVal,
          status: 'active',
        };
        if (platformVal) {
          w.reference_platform = platformVal;
        } else {
          w.reference_platform = null;
        }
        return w;
      };

      const tryFind = async (cityVal: string | null, stateVal: string | null, platformVal: string | null): Promise<IntelligenceProfile | null> => {
        const found = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: buildWhere(cityVal, stateVal, platformVal),
          orderBy: { version: 'desc' },
        });
        return found as IntelligenceProfile | null;
      };

      // ── Layer 1: City-specific ──
      if (normalizedCity && normalizedState) {
        if (normalizedPlatform) {
          const s1 = await tryFind(normalizedCity, normalizedState, normalizedPlatform);
          if (s1) return s1;
        }
        const s2 = await tryFind(normalizedCity, normalizedState, null);
        if (s2) {
          if (normalizedPlatform) {
            logger.warn('Bronze standard profile resolved via city+cross-platform fallback', ctx, {
              categoryKey: key, requestedCity: normalizedCity, requestedState: normalizedState,
              requestedPlatform: normalizedPlatform, profileId: (s2 as any).id,
            });
          }
          return s2;
        }
      }

      // ── Layer 2: State-specific ──
      if (normalizedState) {
        if (normalizedPlatform) {
          const s3 = await tryFind(null, normalizedState, normalizedPlatform);
          if (s3) {
            logger.info('Bronze standard profile resolved via state-specific match', ctx, {
              categoryKey: key, requestedState: normalizedState,
              requestedPlatform: normalizedPlatform, profileId: (s3 as any).id,
            });
            return s3;
          }
        }
        const s4 = await tryFind(null, normalizedState, null);
        if (s4) {
          logger.info('Bronze standard profile resolved via state-specific cross-platform fallback', ctx, {
            categoryKey: key, requestedState: normalizedState, profileId: (s4 as any).id,
          });
          return s4;
        }
      }

      // ── Layer 3: Nationwide (the stage-1 profile) ──
      if (normalizedPlatform) {
        const s5 = await tryFind(null, null, normalizedPlatform);
        if (s5) {
          if (normalizedCity || normalizedState) {
            logger.info('Bronze standard profile resolved via nationwide fallback (no scoped profile)', ctx, {
              categoryKey: key, requestedCity: normalizedCity, requestedState: normalizedState,
              requestedPlatform: normalizedPlatform, profileId: (s5 as any).id,
            });
          }
          return s5;
        }
      }
      const s6 = await tryFind(null, null, null);
      if (s6) {
        if (normalizedCity || normalizedState || normalizedPlatform) {
          logger.info('Bronze standard profile resolved via nationwide cross-platform fallback', ctx, {
            categoryKey: key, requestedCity: normalizedCity, requestedState: normalizedState,
            requestedPlatform: normalizedPlatform, profileId: (s6 as any).id,
          });
        }
        return s6;
      }

      return null;
    } catch (error) {
      logger.error('IntelligenceProfileService.resolveBronzeStandard failed', ctx, {
        error: (error as Error).message,
        categoryKey: key,
        requestedCity: normalizedCity,
        requestedState: normalizedState,
        requestedPlatform: normalizedPlatform,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Serialize a bronze-standard profile for prompt injection.
   *
   *   establishment_reference (stage-2 city scan): the resolved profile
   *   (city → national cascade) as the hunt list — full reason set (catalog
   *   snapshot when present, reason_coverage otherwise) + proof state.
   *
   *   discovery (stage-3 emerging scan): the city profile as CALIBRATION
   *   framing (§7.1) — filled slots as exemplars, the empty-slot report, and
   *   the vector execution log. Explicitly framing, not a candidate filter.
   *
   * Emission per §5.3: filled slots capped at MAX_SLOTS_PER_REASON per
   * reason, a compact empty-slot report, not_applicable_reasons, scope_mix,
   * catalog_revision. When the profile's catalog_revision is behind the
   * current catalog revision, a BRONZE CATALOG DRIFT note + the uncovered
   * reason list is appended (warn-in-prompt, sprint plan D5).
   */
  async serializeBronzeStandard(
    profile: IntelligenceProfile,
    role: BronzeStandardRole,
    ctx?: RequestCtx,
  ): Promise<string> {
    const config = profile.configuration_json as any;
    if (!config) return '';

    const coverage: any[] = Array.isArray(config.reason_coverage) ? config.reason_coverage : [];
    const catalogSnapshot: any[] = Array.isArray(config.catalog_snapshot) ? config.catalog_snapshot : [];
    const notApplicable: string[] = Array.isArray(config.not_applicable_reasons) ? config.not_applicable_reasons : [];
    const vectorLog: any[] = Array.isArray(config.vector_execution_log) ? config.vector_execution_log : [];
    const scopeMix = config.scope_mix ?? null;
    const catalogRevision: number | null = typeof config.catalog_revision === 'number' ? config.catalog_revision : null;

    const lines: string[] = [];
    const scopeLabel = profile.reference_city || profile.reference_state
      ? `${profile.reference_city || ''}${profile.reference_city && profile.reference_state ? ', ' : ''}${profile.reference_state || ''}`
      : 'nationwide';
    const platformLabel = profile.reference_platform ?? 'cross-platform (all platforms)';

    if (role === 'national_proof') {
      // Cascading-profile supplement — a COMPACT proof record emitted
      // alongside a market-scoped profile (never standalone). One exemplar
      // name per proven reason is enough signal; the full slot detail stays
      // in the primary profile's block. No drift check here — the primary
      // block already carries catalog-drift context.
      lines.push('');
      lines.push('=== BRONZE STANDARD — NATIONAL PROOF REFERENCE ===');
      lines.push(`Category: ${profile.category_name}`);
      lines.push(`Profile: ${profile.id} v${profile.version}`);
      lines.push(`Profile scope: ${scopeLabel}`);
      lines.push(`Platform scope: ${platformLabel}`);
      if (catalogRevision !== null) lines.push(`Catalog revision: ${catalogRevision}`);
      lines.push('');
      lines.push(
        'DIRECTIVE: This is the NATIONAL proof record for this category — which catalog reasons have ever produced a qualifying exemplar at national scope. It is NOT the hunt list (the market-scoped profile and catalog above are) and NOT coverage to repeat. Use it to read proof state: a reason proven here but empty in your market is empty_proven_elsewhere; a reason never proven at any evaluable scope is empty_unproven — but it is still hunted. The exemplars show what qualifying evidence looks like — match their evidence depth, not their geography.',
      );
      lines.push('');

      const provenEntries = coverage.filter((e: any) => e.status === 'filled' && Array.isArray(e.slots) && e.slots.length > 0);
      const unprovenKeys = coverage.filter((e: any) => e.status !== 'filled').map((e: any) => e.reason_key);
      if (provenEntries.length > 0) {
        lines.push('--- Proven at national scope ---');
        for (const entry of provenEntries) {
          const s = entry.slots[0];
          const locale = s.observed_city || s.observed_state
            ? ` [${[s.observed_city, s.observed_state].filter(Boolean).join(', ')}]`
            : '';
          lines.push(`  [${entry.reason_key}] ${s.business_name}${locale}${s.observed_platform ? ` (observed on: ${s.observed_platform})` : ''}${s.digital_quality ? ` — digital quality: ${s.digital_quality}` : ''}${s.discovered_via ? ` — vector: ${s.discovered_via}` : ''}`);
        }
        lines.push('');
      }
      if (unprovenKeys.length > 0) {
        lines.push('--- Not yet proven at national scope ---');
        lines.push(`  ${unprovenKeys.join(', ')}`);
        lines.push('');
      }
      lines.push('=== END BRONZE NATIONAL PROOF ===');
      lines.push('');
      return lines.join('\n');
    }

    if (role === 'establishment_reference') {
      lines.push('');
      lines.push('=== BRONZE STANDARD — REFERENCE PROFILE ===');
      lines.push(`Category: ${profile.category_name}`);
      lines.push(`Profile: ${profile.id} v${profile.version}`);
      lines.push(`Profile scope: ${scopeLabel}`);
      lines.push(`Platform scope: ${platformLabel}`);
      if (catalogRevision !== null) lines.push(`Catalog revision: ${catalogRevision}`);
      lines.push('');
      lines.push(
        'DIRECTIVE: This is the established bronze-standard reference profile for this category — the map of what INVISIBLE looks like, typed by discovery-blind-spot reason. Your city scan MUST produce exactly one reason_coverage entry for each applicable reason below. Each reason is a discovery vector: execute its expected_vectors against the reference market, evaluate candidates against the three-part gate (category-qualified by assortment evidence, operationally verified — unable_to_verify never qualifies, low digital quality the reason explains), and record filled slots or the correct empty status with the execution outcome. Reasons proven in the reference profile but empty here are reported empty_proven_elsewhere; reasons with no exemplar at any evaluable scope are empty_unproven — but you still hunt them (the hunt is how they become proven).',
      );
      lines.push('');
      lines.push(BRONZE_SCOPE_SEMANTICS);
      lines.push('');

      // The catalog snapshot is the authoritative reason list when present;
      // otherwise derive it from reason_coverage keys.
      if (catalogSnapshot.length > 0) {
        lines.push('--- Reason Catalog (snapshot) ---');
        for (const r of catalogSnapshot) {
          lines.push(`  [${r.reason_key}]${r.priority ? ` (priority ${r.priority})` : ''} ${r.label ?? ''}`);
          lines.push(`    Scope: ${formatBronzeReasonScope(r)}`);
          if (r.definition) lines.push(`    ${r.definition}`);
          if (Array.isArray(r.signals) && r.signals.length) {
            lines.push('    Signals:');
            for (const s of r.signals) lines.push(`      - ${s}`);
          }
          if (Array.isArray(r.expected_vectors) && r.expected_vectors.length) {
            lines.push(`    Expected vectors: ${r.expected_vectors.join('; ')}`);
          }
          if (r.provenance === 'operator_authored') {
            lines.push('    (operator-authored — unproven until an exemplar is found; hunt it, report distinctly)');
          }
        }
        lines.push('');
      } else if (coverage.length > 0) {
        lines.push('--- Reasons Covered in Reference ---');
        for (const e of coverage) {
          lines.push(`  [${e.reason_key}] status: ${e.status}`);
        }
        lines.push('');
      }
    } else {
      // discovery — calibration framing for the emerging scan (§7.1).
      lines.push('');
      lines.push('=== BRONZE STANDARD — MARKET CALIBRATION ===');
      lines.push(`Category: ${profile.category_name}`);
      lines.push(`Profile: ${profile.id} v${profile.version}`);
      lines.push(`Profile scope: ${scopeLabel}`);
      lines.push(`Platform scope: ${platformLabel}`);
      if (catalogRevision !== null) lines.push(`Catalog revision: ${catalogRevision}`);
      lines.push('');
      lines.push(
        'DIRECTIVE: This is the bronze standard for this market — what a hard-to-find business looks like here, and which vectors reach it. Use it to FRAME your research, not to filter candidates: filled slots are concrete calibration exemplars (a hidden business in this market looks like this, and this vector reveals it); empty slots state what is not yet covered; the vector log shows which vectors are proven here and which have not been executed. Low digital quality describes observable online fields only — never infer low revenue, low customer volume, poor products, or sales readiness.',
      );
      lines.push('');
      lines.push(
        'ATTRIBUTION: When a candidate in your output exists in your result set BECAUSE of a reason below — its expected_vectors surfaced the business, or its signal vocabulary is what identifies the business as category-qualified-but-invisible — record that reason in the candidate\'s bronze_attribution array as { "reason_key": "<key>", "basis": "<which vector or signal produced the find>" }. Attribution is causal, not resemblance: a candidate mainstream discovery would have found anyway carries no bronze_attribution.',
      );
      lines.push('');
      lines.push(BRONZE_SCOPE_SEMANTICS);
      lines.push('');
    }

    // Per-reason scope, when the profile carries a catalog snapshot (national
    // profiles always do; a city profile may not). Reasons without a known
    // scope simply carry no annotation — never a guessed one.
    const scopeByReason = new Map<string, string>();
    for (const r of catalogSnapshot) {
      if (r?.reason_key) scopeByReason.set(r.reason_key, formatBronzeReasonScope(r));
    }
    const scopeSuffix = (reasonKey: string): string => {
      const s = scopeByReason.get(reasonKey);
      return s ? ` [scope: ${s}]` : '';
    };

    // ── Filled slots (capped per reason) + empty-slot report ──────────
    const filledEntries = coverage.filter((e: any) => e.status === 'filled' && Array.isArray(e.slots) && e.slots.length > 0);
    const emptyEntries = coverage.filter((e: any) => e.status !== 'filled');

    if (filledEntries.length > 0) {
      lines.push(role === 'discovery' ? '--- Calibration Exemplars ---' : '--- National Proof Slots ---');
      for (const entry of filledEntries) {
        const slots = (entry.slots as any[]).slice(0, MAX_SLOTS_PER_REASON);
        for (const s of slots) {
          const slotLocale = s.observed_city || s.observed_state
            ? ` [${[s.observed_city, s.observed_state].filter(Boolean).join(', ')}]`
            : '';
          lines.push(`  [${entry.reason_key}] ${s.business_name}${slotLocale}${s.observed_platform ? ` (observed on: ${s.observed_platform})` : ''}${scopeSuffix(entry.reason_key)}`);
          if (s.digital_quality) lines.push(`    Digital quality: ${s.digital_quality}`);
          if (s.category_fit_evidence) lines.push(`    Category fit: ${s.category_fit_evidence}`);
          if (s.operational_evidence) lines.push(`    Operational: ${s.operational_evidence}`);
          if (s.discovered_by) {
            lines.push(`    Discovered by: ${s.discovered_by}${s.discovered_via ? ` via ${s.discovered_via}` : ''}${BRONZE_EXTERNAL_PROVENANCE.has(s.discovered_by) ? ' (out-of-loop ground truth)' : ' (confirmatory)'}`);
          }
          if (Array.isArray(s.evidence_urls) && s.evidence_urls.length) {
            lines.push(`    Evidence: ${s.evidence_urls.slice(0, 3).join(', ')}`);
          }
          if (s.platform_presence && typeof s.platform_presence === 'object') {
            const pp = Object.entries(s.platform_presence)
              .map(([p, v]) => `${p}: ${v}`)
              .join('; ');
            lines.push(`    Platform presence: ${pp}`);
          }
        }
        if ((entry.slots as any[]).length > MAX_SLOTS_PER_REASON) {
          lines.push(`  [${entry.reason_key}] ... +${(entry.slots as any[]).length - MAX_SLOTS_PER_REASON} more slot(s) withheld (cap ${MAX_SLOTS_PER_REASON}/reason)`);
        }
      }
      lines.push('');
    }

    if (emptyEntries.length > 0) {
      lines.push('--- Empty-Slot Report ---');
      for (const e of emptyEntries) {
        lines.push(`  [${e.reason_key}] ${e.status}${e.empty_slot_note ? ` — ${e.empty_slot_note}` : ''}${scopeSuffix(e.reason_key)}`);
      }
      lines.push('');
    }

    if (notApplicable.length > 0) {
      lines.push(`--- Not Applicable Here ---`);
      lines.push(`  ${notApplicable.join(', ')}`);
      lines.push('');
    }

    if (vectorLog.length > 0) {
      lines.push('--- Vector Execution Log ---');
      for (const v of vectorLog) {
        lines.push(`  ${v.vector}: ${v.executed ? `executed, returned ${v.returned ?? '?'}` : 'NOT executed'}`);
      }
      lines.push('');
    }

    if (scopeMix) {
      lines.push(`Scope mix: universal=${scopeMix.universal ?? 0}, category=${scopeMix.category ?? 0}, location=${scopeMix.location ?? 0}, category+location=${scopeMix.category_location ?? 0}, platform-bound=${scopeMix.platform_bound ?? 0}`);
      lines.push('');
    }

    // ── Catalog drift note (sprint plan D5 — warn-in-prompt) ──────────
    if (catalogRevision !== null) {
      try {
        const meta = await this.prisma.mkt_bronze_catalog_meta.findUnique({
          where: { id: 'catalog' },
          select: { catalog_revision: true },
        });
        const current = meta?.catalog_revision ?? null;
        if (current !== null && catalogRevision < current) {
          lines.push('=== BRONZE CATALOG DRIFT ===');
          lines.push(
            `This profile was authored against catalog revision ${catalogRevision}; the catalog is now at revision ${current}. Reasons added or revised since are listed below — they are coverage this profile has never been asked for, or coverage authored against a stale definition. Treat them as known gaps, not as absence of such businesses.`,
          );
          // Inline the uncovered-reason list (§3.5.3 predicate, raw SQL to
          // avoid the service<->service import).
          const uncovered = await this.prisma.$queryRawUnsafe<Array<{ reason_key: string; label: string; gap_kind: string }>>(`
            SELECT reason_key, label,
                   CASE WHEN introduced_in_revision > $1
                        THEN 'never_covered'
                        ELSE 'revised_since_authored' END AS gap_kind
            FROM mkt_bronze_reason_catalog
            WHERE GREATEST(introduced_in_revision,
                           COALESCE(revised_in_revision, 0)) > $1
              AND deprecated_in_revision IS NULL
              AND (scope_category_key IS NULL OR scope_category_key = $2)
              AND (scope_city         IS NULL OR scope_city         = $3)
              AND (scope_state        IS NULL OR scope_state        = $4)
              AND (scope_platform     IS NULL OR $5::text IS NULL OR scope_platform = $5)
            ORDER BY priority, reason_key`,
            catalogRevision,
            profile.category_key,
            profile.reference_city,
            profile.reference_state,
            profile.reference_platform,
          );
          for (const u of uncovered) {
            lines.push(`  [${u.reason_key}] ${u.label} — ${u.gap_kind}`);
          }
          lines.push('');
        }
      } catch (driftErr) {
        // Best-effort — never fail a render on the drift check.
        logger.warn('Bronze catalog drift check failed (non-fatal)', ctx, {
          error: (driftErr as Error).message,
          profileId: profile.id,
        });
      }
    }

    lines.push('=== END BRONZE STANDARD ===');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * §7.3 — record an out-of-loop bronze fill (business audit / operator
   * self-discovery). Delegates to recordBronzeExternalFills — one slot,
   * one draft version.
   */
  async recordBronzeExternalFill(
    profileId: string,
    reasonKey: string,
    slot: BronzeExternalFillSlot,
    ctx?: RequestCtx,
  ): Promise<IntelligenceProfile | null> {
    return this.recordBronzeExternalFills(profileId, [{ reason_key: reasonKey, slot }], ctx);
  }

  /**
   * §7.3/§7.4 — record out-of-loop bronze fills as a NEW DRAFT VERSION
   * carrying the prior version's reason_coverage forward — never mutates
   * the active profile. One draft carries the whole batch: a discovery
   * scan attributing five candidates produces one version, not five.
   * Dedupes on business_name + address within each reason. Returns the
   * created draft, or null when no ACTIVE profile exists at profileId (a
   * bronze exemplar without a bronze profile is noted by the caller, not
   * written — a single fill must not fabricate coverage the scan never ran).
   *
   * Provenance contract: `emerging_scan`/`competitive_scan` slots are
   * CONFIRMATORY (§7.2) — they prove a reason's vector/signal surfaced a
   * business the establishment scan missed, and drop on re-scan unless
   * re-found. `operator_self_discovery`/`business_audit` are ground truth
   * and survive re-scans via mergeBronzeCoverage.
   */
  async recordBronzeExternalFills(
    profileId: string,
    fills: Array<{ reason_key: string; slot: BronzeExternalFillSlot }>,
    ctx?: RequestCtx,
  ): Promise<IntelligenceProfile | null> {
    try {
      if (fills.length === 0) return null;

      // Load the active version for this profile id.
      const active = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: { id: profileId, status: 'active' },
        orderBy: { version: 'desc' },
      });
      if (!active || active.intelligence_focus !== 'bronze_standards') {
        logger.info('recordBronzeExternalFills: no active bronze profile — fills not recorded', ctx, {
          profileId,
          fillCount: fills.length,
        });
        return null;
      }

      const priorConfig = (active.configuration_json as any) ?? {};
      const priorCoverage: any[] = Array.isArray(priorConfig.reason_coverage)
        ? priorConfig.reason_coverage.map((e: any) => ({ ...e, slots: Array.isArray(e.slots) ? [...e.slots] : [] }))
        : [];

      const dedupeKey = (s: any) =>
        `${(s.business_name || '').trim().toLowerCase()}|${(s.address || '').trim().toLowerCase()}`;

      for (const { reason_key, slot } of fills) {
        const newKey = dedupeKey(slot);
        let entry = priorCoverage.find((e: any) => e.reason_key === reason_key);
        if (!entry) {
          entry = { reason_key, status: 'filled', slots: [], empty_slot_note: null };
          priorCoverage.push(entry);
        }
        const existingIdx = (entry.slots as any[]).findIndex((s: any) => dedupeKey(s) === newKey);
        if (existingIdx >= 0) {
          // Re-audit of the same business — update the slot in place.
          entry.slots[existingIdx] = { ...entry.slots[existingIdx], ...slot };
        } else {
          entry.slots.push(slot);
        }
        entry.status = 'filled';
        entry.empty_slot_note = null;
      }

      const newConfig = { ...priorConfig, reason_coverage: priorCoverage };
      const maxVersion = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: { id: profileId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const draft = await this.prisma.mkt_intelligence_profiles.create({
        data: {
          id: profileId,
          category_key: active.category_key,
          category_name: active.category_name,
          version: (maxVersion?.version ?? active.version) + 1,
          intelligence_focus: 'bronze_standards',
          reference_city: active.reference_city,
          reference_state: active.reference_state,
          reference_platform: active.reference_platform,
          configuration_json: newConfig as any,
          status: 'draft',
        },
      });
      logger.info('Bronze external fills recorded as draft version', ctx, {
        profileId,
        fillCount: fills.length,
        reasonKeys: [...new Set(fills.map((f) => f.reason_key))],
        discoveredBy: [...new Set(fills.map((f) => f.slot.discovered_by))],
        newVersion: draft.version,
      });
      return draft as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.recordBronzeExternalFills failed', ctx, {
        error: (error as Error).message,
        profileId,
        fillCount: fills.length,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * §7.3 merge rule — carries external-provenance slots
   * (operator_self_discovery, business_audit) forward from the previously
   * active version's reason_coverage into a new scan import's coverage.
   * Scan-provenance slots are NOT carried: the scan found them again or
   * they drop. Pure function — unit-testable without DB.
   */
  mergeBronzeCoverage(priorCoverage: any[] | null | undefined, incomingCoverage: any[] | null | undefined): any[] {
    const dedupeKey = (s: any) =>
      `${(s.business_name || '').trim().toLowerCase()}|${(s.address || '').trim().toLowerCase()}`;

    const out = (incomingCoverage ?? []).map((e: any) => ({
      ...e,
      slots: Array.isArray(e.slots) ? [...e.slots] : [],
    }));
    const byReason = new Map<string, any>(out.map((e: any) => [e.reason_key, e]));

    for (const priorEntry of priorCoverage ?? []) {
      const keepSlots = (priorEntry.slots ?? []).filter((s: any) => BRONZE_EXTERNAL_PROVENANCE.has(s.discovered_by));
      if (keepSlots.length === 0) continue;
      const existing = byReason.get(priorEntry.reason_key);
      if (existing) {
        const have = new Set(existing.slots.map(dedupeKey));
        for (const s of keepSlots) {
          const k = dedupeKey(s);
          if (!have.has(k)) {
            existing.slots.push(s);
            have.add(k);
          }
        }
        // Carried external slots keep the entry filled — they persist until
        // an operator removes them.
        if (existing.slots.length > 0) {
          existing.status = 'filled';
          existing.empty_slot_note = null;
        }
      } else {
        out.push({
          ...priorEntry,
          status: 'filled',
          slots: [...keepSlots],
          empty_slot_note: null,
        });
      }
    }
    return out;
  }

  // ─── Coverage aggregation ─────────────────────────────────────────────
  // Returns a coverage map grouped by category with TWO orthogonal state
  // dimensions per slot position:
  //
  //   Establishment (profile production):
  //     'pending'   — nothing yet (no campaign, no profile)
  //     'inflight'  — establishment campaign underway, no profile yet
  //                   (profile_id holds the campaign id)
  //     'draft'     — draft profile exists (profile_id holds the profile id)
  //     'active'    — active profile exists (profile_id holds the profile id)
  //
  //   Discovery (candidate scan against an established position):
  //     'pending'   — no discovery campaign
  //     'inflight'  — discovery campaign underway, not yet executed
  //     'executed'  — discovery campaign has ≥1 completed execution or an
  //                   imported audit (discovery_campaign_id holds the id)
  //
  // Combined, the emerging/competitive operator flow has seven states:
  //   1. establishment pending    → create campaign
  //   2. establishment in-flight  → open campaign
  //   3. establishment draft      → activate profile
  //   4. establishment activated  → switch to next discovery
  //   5. discovery pending        → create campaign
  //   6. discovery in-flight      → open campaign
  //   7. discovery executed       → open audit
  //
  // Used by the Coverage admin page to show gaps the operator needs to fill
  // before discovery campaigns can run.
  //
  // Slot dimensions:
  //   gold_standards:   per platform (reference_platform), nationwide (city/state null)
  //   bronze_standards: national establishment at city/state null; the stage-2
  //                     city scan (discovery-kind) fills a CITY bronze profile
  //                     at reference_city. Platform is an optional scope on
  //                     either position (BRONZE_STANDARD_SPEC §3.6.5, §4, §6).
  //   emerging:         per city (reference_city)
  //   competitive:      per city (reference_city)
  //
  // Also returns the distinct cities seen across all intelligence-scope
  // campaigns (from mkt_campaigns_list) so the UI can show the city
  // dimension even for categories that have no profiles yet.

  async getCoverage(ctx?: RequestCtx): Promise<{
    categories: Array<{
      category_key: string;
      category_name: string;
      slots: Array<{
        focus: IntelligenceFocus;
        city: string | null;
        state: string | null;
        platform: string | null;
        // Establishment dimension (see block comment above).
        status: 'active' | 'draft' | 'inflight' | 'pending';
        profile_id: string;
        version: number;
        // Discovery dimension (see block comment above). A discovery
        // campaign never changes the establishment status — the two
        // dimensions are tracked independently so the UI can render the
        // full 7-state flow.
        discovery_status: 'pending' | 'inflight' | 'executed';
        discovery_campaign_id: string | null;
      }>;
    }>;
    cities: string[];
  }> {
    try {
      const [activeProfiles, draftProfiles, intelligenceCampaigns, provingGrounds, pgChildren, enrichmentCampaigns, enrichmentRows] = await Promise.all([
        this.prisma.mkt_intelligence_profiles.findMany({
          where: { status: 'active' },
          select: {
            id: true, version: true, category_key: true, category_name: true,
            intelligence_focus: true, reference_city: true, reference_state: true,
            reference_platform: true, status: true,
          },
        }),
        this.prisma.mkt_intelligence_profiles.findMany({
          where: { status: 'draft' },
          select: {
            id: true, version: true, category_key: true, category_name: true,
            intelligence_focus: true, reference_city: true, reference_state: true,
            reference_platform: true, status: true,
          },
        }),
        // All intelligence campaigns (any stage) — the city dimension list is
        // derived from every campaign, while non-terminal ones additionally
        // surface as 'inflight' slots below (campaign exists, profile not yet
        // imported).
        this.prisma.mkt_campaigns_list.findMany({
          where: { scope: 'intelligence' },
          select: {
            id: true, category: true, city: true, state: true, stage: true,
            intelligence_focus: true, intelligence_platform: true,
            intelligence_campaign_kind: true,
          },
          orderBy: { created_at: 'desc' },
        }),
        // Proving-ground campaigns (spec §4.1): scope='city',
        // campaign_category='proving_ground'. These are operator workspaces,
        // not intelligence profiles — surfaced on the coverage map so the
        // operator can see which markets already have a proving ground.
        this.prisma.mkt_campaigns_list.findMany({
          where: { scope: 'city', campaign_category: 'proving_ground' },
          select: {
            id: true, category: true, city: true, state: true, stage: true,
            title: true,
          },
        }),
        // Intelligence campaigns parented to a proving ground — used to
        // match an umbrella-category PG (e.g. "Grocery") back to the specific
        // intelligence categories it aggregates (e.g. "Indian Grocery").
        this.prisma.mkt_campaigns_list.findMany({
          where: { scope: 'intelligence', parent_campaign_id: { not: null } },
          select: { parent_campaign_id: true, category: true },
        }),
        // Directory-enrichment campaigns (campaign_category='directory_enrichment')
        // — scope='category' produces a category packet, scope='city' produces
        // the location narrative. Non-terminal ones surface as 'inflight'.
        this.prisma.mkt_campaigns_list.findMany({
          where: { campaign_category: 'directory_enrichment' },
          select: {
            id: true, category: true, city: true, state: true, stage: true,
            scope: true,
          },
          orderBy: { created_at: 'desc' },
        }),
        // Enrichment rows — ONE table carries both lanes: category packets at
        // (category_key, city, state) and the location narrative at the
        // ('__location__', city, state) sentinel row. National rows carry the
        // ('__all__', '__all__') market sentinel.
        this.prisma.directory_category_enrichment.findMany({
          select: {
            category_key: true, category_name: true, city: true, state: true,
            source_campaign_id: true, trigger_source: true, enriched_at: true,
          },
        }),
      ]);

      // Group profiles by category_key, merging active + draft into slots.
      const byCategory = new Map<string, { category_name: string; slots: any[] }>();
      const ensureCategory = (key: string, name: string) => {
        if (!byCategory.has(key)) byCategory.set(key, { category_name: name, slots: [] });
        return byCategory.get(key)!;
      };

      for (const p of [...activeProfiles, ...draftProfiles]) {
        const entry = ensureCategory(p.category_key, p.category_name);
        entry.slots.push({
          focus: p.intelligence_focus as IntelligenceFocus,
          city: p.reference_city,
          state: p.reference_state,
          platform: p.reference_platform,
          status: p.status as 'active' | 'draft',
          profile_id: p.id,
          version: p.version,
          discovery_status: 'pending',
          discovery_campaign_id: null,
        });
      }

      // In-flight intelligence campaigns (establishment or discovery) that have
      // not yet produced a draft/active profile — surfaced as 'inflight' slots
      // so the operator sees work already underway instead of a gray "create"
      // gap (creating would trip the structural-duplicate guardrail). Terminal
      // stages are excluded, mirroring INACTIVE_STAGES in MarketingCampaignService
      // (inlined here to avoid a circular import).
      const inactiveStages = new Set(['lost', 'dead', 'closed', 'resolved_and_closed']);

      // Discovery execution detection (all focuses): a discovery campaign is
      // 'executed' once it has at least one completed execution or one
      // imported audit (gold_standard_scan / intelligence_discovery imports
      // land in mkt_audits_list). This cannot be derived from stage: these
      // campaigns ride the review track and never reach a terminal stage, so
      // without this check an executed slot renders 'inflight' forever.
      // Gold-standards platform discovery never produces a platform profile
      // (the platform slot reuses the all-platforms establishment profile),
      // and emerging/competitive discovery campaigns produce audits and
      // queue candidates rather than profiles — so the establishment and
      // discovery dimensions must be tracked separately. Bronze city scans
      // (discovery-kind) DO produce a profile — the draft city bronze
      // profile — but via a completed execution, not an audit row.
      const discoveryCampaignIds = intelligenceCampaigns
        .filter((c) => !inactiveStages.has(c.stage) &&
          c.intelligence_campaign_kind === 'discovery' &&
          (c.intelligence_focus === 'emerging' ||
            c.intelligence_focus === 'competitive' ||
            c.intelligence_focus === 'gold_standards' ||
            c.intelligence_focus === 'bronze_standards'))
        .map((c) => c.id);
      const executedDiscoveryIds = new Set<string>();
      if (discoveryCampaignIds.length > 0) {
        const [doneExecutions, discoveryAudits] = await Promise.all([
          this.prisma.mkt_prompt_executions_list.findMany({
            where: { campaign_id: { in: discoveryCampaignIds }, status: 'completed' },
            select: { campaign_id: true },
          }),
          this.prisma.mkt_audits_list.findMany({
            where: { campaign_id: { in: discoveryCampaignIds } },
            select: { campaign_id: true },
          }),
        ]);
        for (const row of [...doneExecutions, ...discoveryAudits]) {
          executedDiscoveryIds.add(row.campaign_id);
        }
      }

      const entriesByName = new Map<string, { category_name: string; slots: any[] }>();
      for (const entry of byCategory.values()) {
        const nameKey = entry.category_name.trim().toLowerCase();
        if (!entriesByName.has(nameKey)) entriesByName.set(nameKey, entry);
      }
      for (const c of intelligenceCampaigns) {
        if (inactiveStages.has(c.stage)) continue;
        const focus = c.intelligence_focus as IntelligenceFocus | null;
        if (focus !== 'emerging' && focus !== 'competitive' && focus !== 'gold_standards' && focus !== 'bronze_standards') continue;
        const catName = (c.category ?? '').trim();
        if (!catName) continue;
        // National ('__all__') campaigns occupy the null-city position — the
        // same slot the national profile (reference_city NULL) lands in. Left
        // literal, a national campaign would never match its own profile and
        // would render a ghost '__all__' column in the city dimension.
        const cityNorm = isNationalSentinel(c.city) ? '' : (c.city ?? '').trim();
        const stateNorm = isNationalSentinel(c.state) ? '' : (c.state ?? '').trim();
        // Gold standards are platform-dimensioned (nationwide); emerging and
        // competitive are city-dimensioned, so their slots ignore platform.
        // Bronze matches on BOTH axes: the stage-1 establishment is
        // nationwide (city/state null) while the stage-2 scan is
        // city-scoped, and either may carry an optional platform scope.
        const isPlatformDimensioned = focus === 'gold_standards' || focus === 'bronze_standards';
        const platNorm = isPlatformDimensioned && c.intelligence_platform && c.intelligence_platform !== 'all'
          ? c.intelligence_platform
          : null;
        const nameKey = catName.toLowerCase();
        let entry = entriesByName.get(nameKey);
        if (!entry) {
          // Campaign for a category with no profiles yet — create the category
          // box so the in-flight work is visible. Key is a slug of the name;
          // once a profile exists, its own category_key takes over.
          const slug = nameKey.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || nameKey;
          entry = ensureCategory(slug, catName);
          entriesByName.set(nameKey, entry);
        }
        // Position matcher: city-scoped focuses match on city only — the
        // city chip ignores platform — while platform-dimensioned focuses
        // also require a platform match (gold: platform is THE dimension;
        // bronze: city AND platform, both null for the national position).
        const samePosition = (s: any) =>
          s.focus === focus &&
          (s.city ?? '') === cityNorm &&
          (!isPlatformDimensioned || (s.platform ?? '') === (platNorm ?? ''));

        if (c.intelligence_campaign_kind === 'establishment') {
          // Establishment campaign — surface as 'inflight' when the position
          // has no establishment slot yet (active/draft profile, or an
          // earlier in-flight establishment campaign). A 'pending' slot
          // created below to host discovery state does NOT count: the
          // establishment dimension is still empty, so upgrade it instead of
          // pushing a second slot.
          if (entry.slots.some((s) => samePosition(s) && s.status !== 'pending')) continue;
          const pendingSlot = entry.slots.find((s) => samePosition(s) && s.status === 'pending');
          if (pendingSlot) {
            pendingSlot.status = 'inflight';
            pendingSlot.profile_id = c.id;
          } else {
            entry.slots.push({
              focus,
              city: cityNorm || null,
              state: stateNorm || null,
              platform: platNorm,
              status: 'inflight',
              profile_id: c.id,
              version: 0,
              discovery_status: 'pending',
              discovery_campaign_id: null,
            });
          }
          continue;
        }

        // Discovery campaign — attach the discovery dimension to the slot
        // covering this position (any establishment status), creating a
        // 'pending' slot when none exists (e.g. a gold-standards platform
        // scan with no platform profile, or an orphaned emerging/competitive
        // run) so the work is still visible. Newest wins: campaigns arrive
        // created_at desc, so the first discovery campaign per position
        // claims the slot and older ones are ignored.
        const positionSlots = entry.slots.filter((s) => samePosition(s));
        const discoveryStatus = executedDiscoveryIds.has(c.id) ? 'executed' : 'inflight';
        if (positionSlots.length > 0) {
          if (!positionSlots.some((s) => s.discovery_campaign_id)) {
            positionSlots[0].discovery_status = discoveryStatus;
            positionSlots[0].discovery_campaign_id = c.id;
          }
        } else {
          entry.slots.push({
            focus,
            city: cityNorm || null,
            state: stateNorm || null,
            platform: platNorm,
            status: 'pending',
            profile_id: '',
            version: 0,
            discovery_status: discoveryStatus,
            discovery_campaign_id: c.id,
          });
        }
      }

      // Map each proving ground to the set of intelligence category names it
      // covers — primarily via its parented intelligence children (the
      // umbrella case), with a fallback to the PG's own category when it has
      // no children yet (standalone PG whose category already matches an
      // intelligence category by name).
      const pgCategoriesByParentId = new Map<string, Set<string>>();
      for (const child of pgChildren) {
        const pid = child.parent_campaign_id!;
        if (!pgCategoriesByParentId.has(pid)) pgCategoriesByParentId.set(pid, new Set());
        if (child.category) pgCategoriesByParentId.get(pid)!.add(child.category);
      }
      const pgCoversCategory = (pg: { id: string; category: string | null }, intelCategoryName: string): boolean => {
        const viaChildren = pgCategoriesByParentId.get(pg.id);
        if (viaChildren && viaChildren.size > 0) {
          return viaChildren.has(intelCategoryName);
        }
        // Fallback: standalone PG with no intelligence children — match by name.
        return (pg.category ?? '').trim().toLowerCase() === intelCategoryName.trim().toLowerCase();
      };

      // Add a proving_ground slot per (intelligence category, PG city) for
      // every PG that covers that category. PGs are workspaces (always
      // 'active' on the coverage map — there is no draft state for a campaign).
      for (const pg of provingGrounds) {
        const pgCity = (pg.city ?? '').trim();
        if (!pgCity) continue; // PG requires a city (spec §4.1); skip malformed rows.
        for (const [categoryKey, { category_name, slots }] of byCategory.entries()) {
          if (!pgCoversCategory(pg, category_name)) continue;
          slots.push({
            focus: 'proving_ground',
            city: pgCity,
            state: pg.state ?? null,
            platform: null,
            status: 'active',
            profile_id: pg.id,
            version: 0,
            discovery_status: 'pending',
            discovery_campaign_id: null,
          });
        }
      }

      // ─── Directory-enrichment slots (focus='enrichment') ────────────────
      // The enrichment pair per position: slot.status carries the CATEGORY
      // lane (scope='category' campaign → (category_key, city, state) row)
      // and slot.discovery_status carries the LOCATION lane (scope='city'
      // campaign → the ('__location__', city, state) row). Enrichment has no
      // draft state — a row exists or it doesn't — so 'active' (top chip)
      // and 'executed' (bottom chip) mark a produced packet. '__all__'
      // markets normalize to null city, landing in the Nationwide column.
      const ENRICH_LOCATION_SENTINEL = '__location__';
      const ensureEnrichSlot = (entry: { category_name: string; slots: any[] }, cityNorm: string, stateNorm: string) => {
        let s = entry.slots.find((x) => x.focus === 'enrichment' && (x.city ?? '') === cityNorm);
        if (!s) {
          s = {
            focus: 'enrichment',
            city: cityNorm || null,
            state: stateNorm || null,
            platform: null,
            status: 'pending',
            profile_id: '',
            version: 0,
            discovery_status: 'pending',
            discovery_campaign_id: null,
          };
          entry.slots.push(s);
        }
        return s;
      };
      const enrichEntryFor = (categoryKey: string, categoryName: string) => {
        const nameKey = categoryName.trim().toLowerCase();
        return byCategory.get(categoryKey)
          ?? entriesByName.get(nameKey)
          ?? (() => {
            const entry = ensureCategory(categoryKey, categoryName || categoryKey);
            entriesByName.set(nameKey, entry);
            return entry;
          })();
      };

      // Pass 1 — category lane: produced rows first ('active' wins over
      // 'inflight' so a re-enrich campaign never hides an existing packet),
      // then in-flight campaigns fill pending positions. This pass may create
      // category entries — it must complete before the location-lane fan-out.
      for (const row of enrichmentRows) {
        if (row.category_key === ENRICH_LOCATION_SENTINEL) continue;
        const cityNorm = isNationalSentinel(row.city) ? '' : (row.city ?? '').trim();
        const stateNorm = isNationalSentinel(row.state) ? '' : (row.state ?? '').trim();
        const entry = enrichEntryFor(row.category_key, row.category_name ?? row.category_key);
        const slot = ensureEnrichSlot(entry, cityNorm, stateNorm);
        slot.status = 'active';
        slot.enrichment_at = row.enriched_at?.toISOString?.() ?? null;
        slot.enrichment_trigger = row.trigger_source ?? null;
        if (row.source_campaign_id) slot.profile_id = row.source_campaign_id;
      }
      for (const c of enrichmentCampaigns) {
        if (c.scope !== 'category' || inactiveStages.has(c.stage)) continue;
        const catName = (c.category ?? '').trim();
        if (!catName || catName === ENRICH_LOCATION_SENTINEL) continue;
        const cityNorm = isNationalSentinel(c.city) ? '' : (c.city ?? '').trim();
        const stateNorm = isNationalSentinel(c.state) ? '' : (c.state ?? '').trim();
        const entry = enrichEntryFor(
          catName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
          catName,
        );
        const slot = ensureEnrichSlot(entry, cityNorm, stateNorm);
        if (slot.status === 'pending') {
          slot.status = 'inflight';
          slot.profile_id = c.id;
        }
      }

      // Pass 2 — location lane: the ('__location__', city, state) narrative
      // is market-level (not category-keyed) — it fills the bottom chip of
      // every category's slot at this market.
      for (const row of enrichmentRows) {
        if (row.category_key !== ENRICH_LOCATION_SENTINEL) continue;
        const cityNorm = isNationalSentinel(row.city) ? '' : (row.city ?? '').trim();
        const stateNorm = isNationalSentinel(row.state) ? '' : (row.state ?? '').trim();
        for (const entry of byCategory.values()) {
          const slot = ensureEnrichSlot(entry, cityNorm, stateNorm);
          slot.discovery_status = 'executed';
          slot.discovery_at = row.enriched_at?.toISOString?.() ?? null;
          slot.discovery_trigger = row.trigger_source ?? null;
          if (row.source_campaign_id) slot.discovery_campaign_id = row.source_campaign_id;
        }
      }
      for (const c of enrichmentCampaigns) {
        if (c.scope !== 'city' || inactiveStages.has(c.stage)) continue;
        const cityNorm = isNationalSentinel(c.city) ? '' : (c.city ?? '').trim();
        const stateNorm = isNationalSentinel(c.state) ? '' : (c.state ?? '').trim();
        for (const entry of byCategory.values()) {
          const slot = ensureEnrichSlot(entry, cityNorm, stateNorm);
          if (slot.discovery_status === 'pending') {
            slot.discovery_status = 'inflight';
            slot.discovery_campaign_id = c.id;
          }
        }
      }

      // Collect distinct cities (for the city dimension) from intelligence
      // campaigns AND enrichment geographies — a market touched only by
      // enrichment work still earns a column. The national sentinel is not a
      // market — '__all__' must not appear as a city column; national
      // coverage renders as the leading Nationwide position instead.
      const cities = [...new Set(
        [
          ...intelligenceCampaigns.map((c) => c.city),
          ...enrichmentCampaigns.map((c) => c.city),
          ...enrichmentRows.map((r) => r.city),
        ].filter((c) => c && !isNationalSentinel(c)),
      )].sort();

      const categories = Array.from(byCategory.entries())
        .map(([category_key, { category_name, slots }]) => ({
          category_key,
          category_name,
          slots: slots.sort((a, b) => {
            // Sort: gold_standards first, then bronze_standards, then
            // emerging, then competitive, then proving_ground; within each
            // focus, by city/platform name.
            const focusOrder = { gold_standards: 0, bronze_standards: 1, emerging: 2, competitive: 3, proving_ground: 4, enrichment: 5 };
            const fo = focusOrder[a.focus as keyof typeof focusOrder] ?? 4;
            const fob = focusOrder[b.focus as keyof typeof focusOrder] ?? 4;
            if (fo !== fob) return fo - fob;
            const aLoc = a.city ?? a.platform ?? '';
            const bLoc = b.city ?? b.platform ?? '';
            return aLoc.localeCompare(bLoc);
          }),
        }))
        .sort((a, b) => a.category_name.localeCompare(b.category_name));

      return { categories, cities };
    } catch (error) {
      logger.error('IntelligenceProfileService.getCoverage failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }
}

export default IntelligenceProfileService.getInstance();
