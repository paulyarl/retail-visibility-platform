/**
 * Intelligence Profile Schema (GAP-P8)
 *
 * Validates the §10 profile structure for the establishment import path.
 * When an operator imports an externally-generated profile via
 * /executions/external, the result is validated against this schema before
 * being persisted as a DRAFT profile by IntelligenceProfileService.importAsDraft().
 *
 * Key structural requirements:
 *   - terminology: map of term → definition
 *   - specialized_sources: array with name, type, capabilities[], limitations[]
 *   - prohibited_inferences: array of strings (inferences the AI must NOT make)
 *   - category_signals: array of INT_* signal codes
 *   - .passthrough() allows forward-compatible fields
 *
 * Used by:
 *   - The external-import endpoint (validates pasted JSON)
 *   - The prompt suffix (appended to the establishment template's exported prompt)
 *   - The post-import hook in importExternalResult()
 */

import { z } from 'zod';

export const INTELLIGENCE_PROFILE_SCHEMA_NAME = 'intelligence_profile';

// ─── Specialized Source ──────────────────────────────────────────────────

const specializedSourceSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  // URL of the source's homepage, landing page, or directory index. Optional
  // so legacy imports without URLs still validate, but the establishment
  // prompt instructs the agent to capture it for any source that has a
  // canonical web address — vertical directories and community organizations
  // especially, where the URL is the operator-actionable entry point.
  //
  // Models frequently emit `"url": null` (rather than omitting the key) for
  // sources with no canonical web address (e.g. "storefront corridor
  // observation", "supplier sourcing-road network"). Coerce null → undefined
  // so downstream consumers always see `url` as either a valid URL string or
  // undefined, and so external imports don't fail validation on null URLs.
  url: z.preprocess(
    (v) => (v === null ? undefined : v),
    z.string().url().optional(),
  ),
  priority: z.number().int().optional(),
  capabilities: z.array(z.string()).min(1),
  limitations: z.array(z.string()).min(1),
}).passthrough();

// ─── Discovery Substrate (category-independent enumeration) ──────────────
//
// The substrate is what makes discovery category-independent. It is the
// enumeration floor that surfaces businesses whose names do NOT self-identify
// with the category (e.g. "Universal Tropical Market" for an African grocery,
// "A-1 Market" for an Asian grocery, "Sunny Beauty" for a beauty-supply store).
// A profile whose only discovery paths are keyed on the category's own tokens
// is incomplete — the substrate fields are what the discovery scan executes to
// avoid that failure mode. All three are optional in the schema so legacy
// profiles still validate, but the establishment template + prompt suffix
// require every NEW profile to carry them.

const geographyGridSchema = z.object({
  // Reference market the grid was derived from (normally the campaign's city/state).
  city: z.string().optional(),
  state: z.string().optional(),
  // Exhaustive ZIP sweep units. Every ZIP must be swept independently; a ZIP
  // with zero findings is an executed-empty result, never a silent skip.
  zips: z.array(z.string()).optional(),
  // Arterial commercial stretches, derived from address evidence where possible.
  corridors: z.array(z.string()).optional(),
  // Separately-incorporated suburbs / contiguous commercial municipalities in
  // the catchment — the "shared-ZIP suburb" class (e.g. Gladstone, MO sharing
  // 64118 with Kansas City). Explicit so the retail catchment is sweepable, not
  // implied by the principal city's administrative boundary.
  adjacent_municipalities: z.array(z.string()).optional(),
  // Municipalities in the catchment the substrate HONESTLY cannot reach — no
  // label-independent dataset covers them (Discovery Scan Contract Spec §6.2:
  // "accept `uncovered` and let INV-4/INV-5 cap the claim. Either is
  // acceptable; silence is not."). An entry here satisfies SUB-1 for that
  // municipality.
  uncovered_municipalities: z.array(z.string()).optional(),
  // Corridor → ZIP resolution map (§6.3): every corridor node must resolve to
  // at least one ZIP sweep unit so a named corridor can't drift away from the
  // dataset/ZIP set (the N Oak / Gladstone failure). Keys are the corridor
  // strings in `corridors`; values are the grid ZIPs each corridor spans.
  corridor_zips: z.record(z.string(), z.array(z.string())).optional(),
  // Optional radius scope from the campaign.
  radius_miles: z.number().optional(),
}).passthrough();

const genericLabelSetEntrySchema = z.object({
  platform: z.string().min(1),
  // The generic buckets that SWALLOW this category — the labels a mislabeled
  // business sits under (HIDE labels: they drive enumeration). Category-
  // specific in content, universal in class.
  labels: z.array(z.string()).min(1),
  // The CORRECT / gold-standard labels for this category on this platform
  // (REVEAL labels: they drive qualification, not enumeration). A label can
  // be both — "African goods store" hides mislabeled businesses AND is the
  // correct label — so it lives in both lists and the discovery prompt uses
  // each list for its own purpose (spec §5.1 item 3).
  reveal_labels: z.array(z.string()).optional(),
}).passthrough();

const labelIndependentSweepSchema = z.object({
  dataset: z.string().min(1),
  url: z.preprocess(
    (v) => (v === null ? undefined : v),
    z.string().url().optional(),
  ),
  // MUST be "geography": the dataset is enumerated by ZIP/address, never by a
  // category name token. Token-keying a label-independent dataset makes it
  // label-dependent and defeats its purpose.
  sweep_key: z.string().optional(),
  // Municipalities in the catchment this dataset's geography enumeration
  // reaches (§6.2 authoring invariant: every adjacent_municipalities entry
  // maps to ≥1 dataset or is flagged uncovered in geography_grid). Use ["*"]
  // for a dataset whose coverage spans the whole catchment (e.g. a statewide
  // registry). Absent = unattested — the substrate check treats the dataset
  // as covering only the principal city.
  covers_municipalities: z.array(z.string()).optional(),
  filter: z.string().optional(),
  post_filter: z.string().optional(),
  note: z.string().optional(),
}).passthrough();

// ─── Platform signal weights (signal-weight spec) ────────────────────────
//
// signal_weight(category, platform) ∈ [0,1] — the single source of truth for
// how much a platform's signal should move a score for this category. A
// gold-standard (national) establishment derives it from coast-to-coast
// samples; a market establishment derives it locally with the same estimator,
// and a confidence factor decides whether the local weight outranks the
// national one.

const platformSignalWeightSchema = z.object({
  platform: z.string().min(1),
  // How much this platform's signal should move a score for this category.
  weight: z.number().min(0).max(1),
  // The observed prevalence × depth behind the estimate — auditable, not a
  // bare number (e.g. "8/10 category businesses carry active profiles with
  // recent reviews").
  basis: z.string().optional(),
  // Derivation confidence ∈ [0,1] — the local-precedence gate reads this.
  confidence: z.number().min(0).max(1).optional(),
  // Sample size behind the estimate (category businesses observed).
  observations: z.number().int().optional(),
}).passthrough();

// ─── Profile Configuration (§10 structure) ───────────────────────────────

export const intelligenceProfileSchema = z.object({
  // Category identification
  category_key: z.string().min(1),
  category_name: z.string().min(1),

  // Terminology — map of term → definition
  terminology: z.record(z.string(), z.string()).optional(),

  // Synonyms — alternative names for the category
  synonyms: z.array(z.string()).optional(),

  // Subcategories — with descriptions
  subcategories: z.array(z.string()).optional(),

  // Specialized sources — with capabilities and limitations
  specialized_sources: z.array(specializedSourceSchema).min(1),

  // Discovery substrate — category-independent enumeration primitives. Optional
  // in the schema for backward compatibility, but REQUIRED by the establishment
  // template + prompt suffix for every new profile.
  geography_grid: geographyGridSchema.optional(),
  generic_label_set: z.array(genericLabelSetEntrySchema).optional(),
  label_independent_sweeps: z.array(labelIndependentSweepSchema).optional(),

  // Platform signal weights — signal_weight(category, platform) ∈ [0,1].
  // Optional so legacy profiles still validate; the establishment template +
  // prompt suffix require it for every NEW profile.
  platform_signal_weights: z.array(platformSignalWeightSchema).optional(),
  // Local-vs-national divergence per platform (local.weight − national.weight)
  // — recorded by market establishments that observed both layers.
  platform_signal_divergence: z.record(z.string(), z.number()).optional(),

  // Discovery patterns — how to find businesses in this category
  discovery_patterns: z.record(z.string(), z.any()).optional(),

  // Category evidence rules — what evidence matters for this category
  category_evidence_rules: z.record(z.string(), z.any()).optional(),

  // Prohibited inferences — inferences the AI must NOT make
  prohibited_inferences: z.array(z.string()).min(1),

  // Category signals — INT_* signal codes relevant to this category
  category_signals: z.array(z.string()).min(1),
}).passthrough();

// ─── Substrate consistency check (Discovery Scan Contract Spec §6) ───────
//
// Report-mode authoring checks, run at profile-import time
// (MarketingPromptService.persistIntelligenceProfileDraft stamps
// configuration_json.substrate_violations). Nothing here rejects the profile —
// violations surface the two drifts that produced the Kansas City gap:
//   SUB-1  every adjacent_municipalities entry maps to ≥1 label-independent
//          sweep (covers_municipalities, "*" = whole catchment) or is flagged
//          in geography_grid.uncovered_municipalities (§6.2)
//   SUB-2  every geography_grid.corridors entry resolves to ≥1 ZIP sweep
//          unit — via corridor_zips[name] ∩ zips, or a ZIP token in the
//          corridor string itself (§6.3)
//   SUB-3  corridor_zips values must be grid ZIPs — a corridor mapped to a
//          ZIP outside zips means the grid is missing a sweep unit

export interface ProfileSubstrateViolation {
  invariant: 'SUB-1' | 'SUB-2' | 'SUB-3';
  path?: string;
  message: string;
}

function normMuni(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** City part of a "Name, ST" municipality string — tolerant match key. */
function muniCityPart(v: unknown): string {
  return normMuni(v).split(',')[0].trim();
}

function muniMatches(a: unknown, b: unknown): boolean {
  return normMuni(a) === normMuni(b) || muniCityPart(a) === muniCityPart(b);
}

function asStrArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
}

export function collectProfileSubstrateViolations(profile: any): ProfileSubstrateViolation[] {
  const violations: ProfileSubstrateViolation[] = [];
  if (!profile || typeof profile !== 'object') return violations;

  const grid = profile.geography_grid;
  const adjacent = asStrArray(grid?.adjacent_municipalities);
  const uncovered = asStrArray(grid?.uncovered_municipalities);
  const corridors = asStrArray(grid?.corridors);
  const zips = new Set(asStrArray(grid?.zips));
  const corridorZips: Record<string, unknown> =
    grid?.corridor_zips && typeof grid.corridor_zips === 'object' ? grid.corridor_zips : {};
  const sweeps: any[] = Array.isArray(profile.label_independent_sweeps)
    ? profile.label_independent_sweeps
    : [];

  // SUB-1 — municipality → dataset coverage (or explicit uncovered flag).
  for (const muni of adjacent) {
    if (uncovered.some((u) => muniMatches(u, muni))) continue;
    const covered = sweeps.some((s) =>
      asStrArray(s?.covers_municipalities).some((c) => c === '*' || muniMatches(c, muni)),
    );
    if (!covered) {
      violations.push({
        invariant: 'SUB-1',
        path: 'geography_grid.adjacent_municipalities',
        message: `Municipality "${muni}" maps to no label-independent sweep — add a dataset's covers_municipalities entry or flag it in geography_grid.uncovered_municipalities (silence is the Gladstone failure)`,
      });
    }
  }

  // SUB-2 — corridor → ZIP resolution. A corridor resolves when a
  // corridor_zips mapping intersects the grid ZIPs, or when the corridor
  // string itself names a grid ZIP (e.g. "N Oak Trafficway (64118)").
  for (const corridor of corridors) {
    const mapped = asStrArray(corridorZips[corridor]);
    const inlineZips = (corridor.match(/\b\d{5}\b/g) ?? []);
    const resolved = zips.size > 0
      ? mapped.some((z) => zips.has(z)) || inlineZips.some((z) => zips.has(z))
      : mapped.length > 0 || inlineZips.length > 0;
    if (!resolved) {
      violations.push({
        invariant: 'SUB-2',
        path: 'geography_grid.corridors',
        message: `Corridor "${corridor}" resolves to no ZIP sweep unit — map it in geography_grid.corridor_zips or name its ZIP(s) in the corridor string`,
      });
    }
  }

  // SUB-3 — corridor_zips must point at grid ZIPs. A mapping to a ZIP absent
  // from geography_grid.zips means the grid is missing that sweep unit.
  if (zips.size > 0) {
    for (const [corridor, mapped] of Object.entries(corridorZips)) {
      for (const z of asStrArray(mapped)) {
        if (!zips.has(z)) {
          violations.push({
            invariant: 'SUB-3',
            path: 'geography_grid.corridor_zips',
            message: `Corridor "${corridor}" maps to ZIP ${z} which is not in geography_grid.zips — add the ZIP as a sweep unit or fix the mapping`,
          });
        }
      }
    }
  }

  return violations;
}

// ─── Prompt suffix (appended to the establishment template's prompt) ─────

export const INTELLIGENCE_PROFILE_PROMPT_SUFFIX = `
=== EXPECTED OUTPUT FORMAT ===
Return a single JSON object with this structure (the Category Intelligence Profile):
{
  "category_key": "<normalized category key, lowercase, spaces collapsed>",
  "category_name": "<display name>",
  "terminology": {
    "<term>": "<definition>",
    ...
  },
  "synonyms": ["<alternative name>", ...],
  "subcategories": ["<subcategory: description>", ...],
  "specialized_sources": [
    {
      "name": "<source name>",
      "type": "<source type: service_history | certification | professional_network | mainstream_directory | vertical_directory | social_platform | other>",
      "url": "<source homepage or directory index URL, if the source has a canonical web address>",
      "priority": <number>,
      "capabilities": ["<what this source can do>", ...],
      "limitations": ["<what this source cannot do or what it does NOT measure>", ...]
    }
  ],
  "geography_grid": {
    "city": "<reference city>",
    "state": "<reference state>",
    "zips": ["<every ZIP the market's commercial addresses fall in>", ...],
    "corridors": ["<arterial commercial stretch, derived from address evidence>", ...],
    "adjacent_municipalities": ["<separately-incorporated suburb / contiguous commercial municipality in the catchment>", ...],
    "uncovered_municipalities": ["<adjacent municipality NO label-independent dataset reaches — the honest uncovered flag>", ...],
    "corridor_zips": { "<corridor name from corridors>": ["<grid ZIP(s) the corridor spans>", ...] },
    "radius_miles": <number, if a radius scope applies>
  },
  "generic_label_set": [
    {
      "platform": "<platform>",
      "labels": ["<generic label that SWALLOWS this category (hide label)>", ...],
      "reveal_labels": ["<the CORRECT / gold-standard label for this category on this platform>", ...]
    }
  ],
  "label_independent_sweeps": [
    {
      "dataset": "<address-indexed dataset name>",
      "url": "<dataset URL, if it has a canonical web address>",
      "sweep_key": "geography",
      "covers_municipalities": ["<catchment municipality this dataset reaches, or \"*\" for whole-catchment coverage>", ...],
      "filter": "none",
      "post_filter": "assortment",
      "note": "<optional>"
    }
  ],
  "platform_signal_weights": [
    {
      "platform": "<platform key: google | yelp | facebook | apple | bbb | instagram | ...>",
      "weight": <number 0-1>,
      "basis": "<observed prevalence x depth behind the estimate>",
      "confidence": <number 0-1>,
      "observations": <integer — category businesses observed>
    }
  ],
  "platform_signal_divergence": {
    "<platform>": <local weight - national weight, when both were observed>
  },
  "discovery_patterns": {
    "<pattern_name>": "<description or instructions>",
    ...
  },
  "category_evidence_rules": {
    "<rule_name>": "<description>",
    ...
  },
  "prohibited_inferences": [
    "<inference the AI must NOT make for this category>",
    ...
  ],
  "category_signals": ["INT_*", ...]
}

Rules:
- specialized_sources MUST have at least one entry with capabilities AND limitations.
- geography_grid, generic_label_set, and label_independent_sweeps are REQUIRED. They are the category-independent discovery substrate: geography_grid names the exhaustive sweep units (ZIPs + corridors), generic_label_set names the generic platform labels that swallow this category, and label_independent_sweeps names the address-indexed datasets that must be swept WITHOUT a category name token.
- label_independent_sweeps entries MUST set "sweep_key": "geography". These datasets are enumerated by ZIP/address and filtered to category fit by assortment evidence AFTER enumeration. Do NOT key them on the category name — token-keying a label-independent dataset makes it label-dependent and hides every business whose legal name carries no category token.
- geography_grid.zips MUST list every ZIP the market's commercial addresses fall in, not only the ZIPs where category businesses were already found. Every ZIP is swept independently; a ZIP with zero findings is an executed-empty result, not a silent skip.
- geography_grid scope is the RETAIL CATCHMENT, not the administrative city: the principal city PLUS its contiguous commercial suburbs. geography_grid.adjacent_municipalities MUST list the separately-incorporated municipalities in the catchment — including any that share a ZIP with the principal city (the shared-ZIP suburb class). A ZIP spanning the principal city and a suburb is ONE sweep unit.
- SUBSTRATE CONSISTENCY (checked at import): every adjacent_municipalities entry MUST map to at least one label-independent sweep — name it in that sweep's "covers_municipalities" (or "*" for whole-catchment datasets like statewide registries) — or be flagged in geography_grid.uncovered_municipalities. Silence is the failure this exists to catch: a municipality that no dataset reaches and nothing flags is an invisible coverage hole.
- SUBSTRATE CONSISTENCY (checked at import): every geography_grid.corridors entry MUST resolve to at least one ZIP sweep unit — name the ZIP(s) it spans in geography_grid.corridor_zips (or inline in the corridor string). A corridor with no ZIP resolution is a node the dataset set can drift away from.
- generic_label_set splits each platform's labels by ROLE: "labels" are the HIDE labels — the generic/misleading buckets that swallow this category and drive enumeration; "reveal_labels" are the CORRECT / gold-standard labels that drive qualification. A label can be both (e.g. a platform's correct category label is also where mislabeled businesses get filed) — put it in both lists. Do NOT put the correct label in "labels" alone, and never omit a hide label just because it happens to be the correct one too.
- platform_signal_weights is REQUIRED for every new profile. For each platform where this category's customers actually are (reviews, ratings, profiles, category traffic), estimate signal_weight = prevalence x depth — how much of the category's customer-facing activity happens on that platform — as a number in [0,1]. Each entry MUST carry "basis" (the observed evidence behind the number), "confidence" (how reliable the estimate is, in [0,1]), and "observations" (the sample size). A platform with high signal weight outranks a low-signal one in scoring; do not inflate weights for platforms the category barely uses.
- platform_signal_divergence is OPTIONAL — record it only when both a national and a local estimate were observed for the same platform (local weight - national weight).
- For each specialized_source that has a canonical web address (a homepage, directory index, organization page, or store locator), include its "url". Vertical directories, community organizations, professional networks, and official brand/chain websites should always carry a url — it is the operator's entry point to the source. Omit "url" only for sources that have no single canonical web address (e.g. "storefront photo evidence", "SNAP listings" as a class).
- limitations are critical — they describe what the source does NOT measure (e.g. "CARFAX service history is NOT a review system").
- prohibited_inferences MUST list at least one inference that must not be made (e.g. "Absence from CARFAX does NOT mean the business is inactive").
- category_signals MUST use INT_* codes only.
- category_key should be the normalized (lowercase, whitespace-collapsed) category name.
`;
