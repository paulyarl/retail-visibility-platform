/**
 * Intelligence Discovery Output Schema
 *
 * Validates the output of Intelligence-scope discovery audits (spec §O1).
 * This is a discovery-only schema — it produces discovered businesses with
 * discovery signals (INT_* family), NOT business audit signals (RA/DS/WC/CP/VP).
 *
 * Key structural guarantees (§31):
 *   - No Business-Audit signal fields present (structural separation)
 *   - discovery_signals use INT_* codes only
 *   - outside_market candidates are excluded from the final qualifying set
 *   - identity_confidence conflict → business_seek_priority = 'hold'
 *   - category_fit = 'insufficient' → business_seek_priority = 'hold' or
 *     business_seek_recommended = false
 *   - .passthrough() allows forward-compatible fields
 *
 * Used by:
 *   - The external-import endpoint (validates pasted JSON)
 *   - The prompt suffix (appended to exported prompt text)
 *   - The queue ingestion service (maps candidates to queue rows)
 */

import { z } from 'zod';
import { suggestedReasonSchema } from './bronze-standard-scan.schema';

export const INTELLIGENCE_DISCOVERY_SCHEMA_NAME = 'intelligence_discovery';

// ─── Enum preprocessors (tolerant — mirror city-category-opportunity.schema.ts) ───

const locationStatusEnum = z.enum(['inside_city', 'adjacent_city', 'metro_area', 'outside_market']);
const categoryFitEnum = z.enum(['verified', 'probable', 'insufficient']);
const identityConfidenceEnum = z.enum(['high', 'medium', 'low']);
const businessSeekPriorityEnum = z.enum(['high', 'medium', 'low', 'hold']);
const ownershipTypeEnum = z.enum([
  'independent',
  'local_chain',
  'franchise',
  'national_chain',
  'national_franchise',
  'regional_chain',
  'unknown',
]);

// ─── Discovery Provenance ────────────────────────────────────────────────

// Exported (Migration 253 — GAP-E3): reused by discoveryContextSchema below
// for the per-campaign discovery context handoff. Previously file-local.
export const discoveryProvenanceSchema = z.object({
  source: z.string(),
  role: z.string(),
  evidence_types: z.array(z.string()).optional(),
  // url/accessed_at are nullable (not just optional) to match the tolerance
  // for `null` emissions on the parent business fields (address/phone/website/
  // gbp_url). Models emit `null` when a source has no clean URL (e.g. a
  // Facebook page discovered via social-first search without a canonical URL).
  url: z.string().nullable().optional(),
  accessed_at: z.string().nullable().optional(),
}).passthrough();

// ─── Discovered Business Candidate ───────────────────────────────────────

const discoveredBusinessSchema = z.object({
  business_name: z.string(),
  category: z.string(),
  city: z.string(),
  state: z.string().optional(),
  // address/phone are nullable (not just optional) to match website/gbp_url:
  // models reasonably emit `null` for "unknown" rather than omitting the key.
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  gbp_url: z.string().nullable().optional(),

  // Geographic classification (§G2)
  location_status: locationStatusEnum,

  // Ownership classification (§G2 — chain/franchise exclusion)
  ownership_type: ownershipTypeEnum,

  // Discovery assessment
  category_fit: categoryFitEnum,
  identity_confidence: identityConfidenceEnum,

  // Discovery signals (INT_* family only — §S1)
  discovery_signals: z.array(z.string()),

  // Discovery provenance (§E2)
  discovery_provenance: z.array(discoveryProvenanceSchema),

  // Business Seek routing
  business_seek_recommended: z.boolean(),
  business_seek_priority: businessSeekPriorityEnum,

  // Rating/reviews (optional — may not be available for thin-footprint businesses)
  rating: z.number().nullable().optional(),
  review_count: z.number().nullable().optional(),

  // Gold standard rating (optional — present only when a gold-standard
  // discovery benchmark block was injected into the prompt). Forward-compatible:
  // legacy payloads without these fields import cleanly via .passthrough().
  gold_standard_match: z.boolean().nullable().optional(),
  gold_standard_gate_results: z.array(
    z.object({
      gate: z.string(),
      passed: z.boolean(),
      platform: z.string().optional(),
    }).passthrough(),
  ).nullable().optional(),

  // Sourced attribute chips observed on the prospect's platform profiles
  // (payments accepted, accessibility, ownership, service options). Each
  // entry carries its own evidence (source_url + as_of) — never inferred
  // from category labels. Optional + forward-compatible; feeds the directory
  // seed attribute picker when the prospect becomes a seed.
  observed_attributes: z.array(
    z.object({
      platform: z.string(),
      key: z.string().nullable().optional(),
      label: z.string(),
      source_url: z.string().nullable().optional(),
      as_of: z.string().nullable().optional(),
    }).passthrough(),
  ).nullable().optional(),

  // Bronze reason attribution (Bronze Standard System, spec §7.4) — present
  // only when a "BRONZE STANDARD — MARKET CALIBRATION" block was injected
  // into the prompt AND a catalog reason was directly responsible for the
  // find (its expected_vectors surfaced the business, or its signal
  // vocabulary is what qualifies the business as category-fit-but-invisible).
  // A candidate mainstream discovery would have found anyway carries no
  // attribution. Optional + nullable; legacy payloads import cleanly.
  bronze_attribution: z.array(
    z.object({
      reason_key: z.string().min(1),
      // One-line causal basis — which vector or signal produced the find.
      basis: z.string().nullable().optional(),
    }).passthrough(),
  ).nullable().optional(),

  // Competitive weakness attribution
  // (COMPETITIVE_WEAKNESS_ATTRIBUTION_SPEC §6) — present only under
  // focus 'competitive'. Leaders are selected on strength; weaknesses
  // are documented during selection and become the pitch wedge — the
  // named pain that converts "leader observed" into "we see you". A
  // leader with no observable weakness is a benchmark, not a prospect
  // (§3). Optional + nullable; legacy payloads import cleanly.
  competitive_weaknesses: z.array(
    z.object({
      weakness_key: z.string().min(1),
      // One-line basis — the observation that names the exposure.
      basis: z.string().nullable().optional(),
    }).passthrough(),
  ).nullable().optional(),

  // Optional marker (§3): candidate observed as a reference point, not a
  // prospect. Scan/card-display only — not carried downstream.
  benchmark_only: z.boolean().nullable().optional(),

  // Run-local key aliases (Discovery Scan Contract v1.3) — alternate names for
  // the same business (the Tawakal / Al-Hallal / Darsalaam one-address case).
  // Each alias is slugged with the candidate's city and counts as the same
  // candidate_key for INV-1/INV-7 provenance and reconciliation checks.
  candidate_key_aliases: z.array(z.string()).nullable().optional(),
}).passthrough();

// ─── Scan contract (Discovery Scan Contract Spec §3) ─────────────────────
//
// The contract is coverage bookkeeping: which sweep units were opened, what
// each returned, and what the run admits it skipped. Shape only is enforced
// here — the coverage invariants (INV-1…INV-8) are report-mode and live in
// collectDiscoveryContractViolations below, invoked at the import seam.

export const DISCOVERY_SCAN_CONTRACT_VERSION = 'discovery-scan-contract-v1';

const sweepLedgerRowSchema = z.object({
  unit_id: z.string().min(1),
  unit_type: z.enum(['zip_label_matrix', 'corridor', 'dataset_geography']),
  unit: z.string().optional(),
  platforms_swept: z.array(z.string()).optional(),
  labels_swept: z.array(z.string()).optional(),
  status: z.enum(['executed_with_findings', 'executed_empty', 'not_executed', 'blocked']),
  findings_count: z.number().int().nullable().optional(),
  candidate_keys: z.array(z.string()).optional(),
  executed_at: z.string().optional(),
  blocked_reason: z.string().nullable().optional(),
}).passthrough();

const coverageAttestationSchema = z.object({
  units_total: z.number().int().optional(),
  units_executed: z.number().int().optional(),
  units_executed_empty: z.number().int().optional(),
  units_not_executed: z.number().int().optional(),
  units_blocked: z.number().int().optional(),
  vectors_total: z.number().int().optional(),
  vectors_executed: z.number().int().optional(),
  vectors_not_executed: z.number().int().optional(),
  coverage_ratio: z.number().optional(),
  completeness_claim: z.enum(['verified_full', 'verified_partial', 'unverified']).optional(),
  uncovered_municipalities: z.array(z.string()).optional(),
  unexecuted_vector_list: z.array(
    z.object({
      vector: z.string().min(1),
      reason: z.string().optional(),
    }).passthrough(),
  ).optional(),
  attestation_basis: z.string().optional(),
}).passthrough();

const municipalityCoverageRowSchema = z.object({
  municipality: z.string().min(1),
  shared_zip: z.string().optional(),
  platform_zip_rows: z.array(z.string()).optional(),
  label_independent_datasets: z.array(z.string()).optional(),
  status: z.enum(['covered', 'platform_only', 'uncovered']).optional(),
}).passthrough();

const reconciliationSchema = z.object({
  // v1.3: operator-supplied members are an import-time input injected by the
  // gate; model-emitted blocks are merged, not trusted blindly.
  operator_supplied_members: z.array(z.string()).optional(),
  matched_to_candidates: z.array(z.string()).optional(),
  added_this_pass: z.array(z.string()).optional(),
  unmatched: z.array(z.string()).optional(),
  excluded_with_reason: z.array(
    z.object({
      member: z.string().min(1),
      reason: z.string().optional(),
    }).passthrough(),
  ).optional(),
}).passthrough();

// ─── Suggested discovery signal (uncataloged INT_* pattern) ──────────────
//
// Mirror of the bronze suggested_reasons contract for the signal registry:
// when a candidate exhibits a discovery-relevant pattern no registered INT_*
// code captures, the analyst proposes it here rather than emitting a
// non-registry code inside discovery_signals. Proposals land on the resolved
// bronze profile's suggested_signals for operator review; promotion writes a
// real mkt_signal_registry row — a suggestion never evaluates in triage.

const suggestedSignalSchema = z.object({
  /** Proposed registry code — INT_* family only (§S1 lane separation). */
  code: z.string().regex(/^INT_[A-Z0-9_]+$/),
  proposed_label: z.string().min(1),
  proposed_definition: z.string().min(1),
  /** Business names exhibiting the pattern — review exemplars. */
  exemplar_leads: z.array(z.string()).optional(),
  /**
   * Proposed triage wiring (playbook codes from the TRIAGE PLAYBOOK ROSTER
   * block): primary = the signal joins that playbook's evidence pool on
   * registration; secondary = declared fallback route when no playbook's
   * rules match. Advisory — the promoting operator confirms in the modal.
   */
  primary_playbook: z.string().optional(),
  secondary_playbook: z.string().optional(),
}).passthrough();

// Suggestions are advisory — a malformed entry must never fail the import.
// Per-element .catch(undefined) drops the bad row and keeps the rest.
const dropMalformed = <T extends z.ZodTypeAny>(s: T) =>
  z.array(s.optional().catch(undefined)).transform(
    (a) => a.filter((e): e is z.infer<T> => e !== undefined),
  );

export const scanContractSchema = z.object({
  contract_version: z.string().optional(),
  sweep_ledger: z.array(sweepLedgerRowSchema).optional(),
  coverage_attestation: coverageAttestationSchema.optional(),
  municipality_coverage: z.array(municipalityCoverageRowSchema).optional(),
  reconciliation: reconciliationSchema.nullable().optional(),
}).passthrough();

// ─── Top-level schema ────────────────────────────────────────────────────

export const intelligenceDiscoverySchema = z.object({
  intelligence_mode: z.enum(['profile', 'generic_fallback']),
  category: z.string(),
  city: z.string(),
  state: z.string().optional(),
  focus: z.enum(['emerging', 'competitive']),

  // The full candidate list as discovered (includes outside_market)
  discovered_businesses: z.array(discoveredBusinessSchema),

  // The qualifying set (outside_market + national_chain + national_franchise +
  // regional_chain excluded — these are filtered out before qualifying)
  qualifying_businesses: z.array(discoveredBusinessSchema),

  // Summary counts
  candidate_count: z.number(),
  qualifying_count: z.number(),
  hold_count: z.number(),

  // Category-level context
  category_definition: z.string().optional(),
  geographic_classification_notes: z.string().optional(),
  ownership_exclusion_notes: z.string().optional(),

  // Provenance
  profile_id: z.string().nullable().optional(),
  profile_version: z.number().nullable().optional(),

  // Platform-aware analysis (optional — present only when a gold-standard
  // discovery benchmark block was injected). Introduces platform awareness
  // into emerging/competitive discovery scans for the first time. When absent
  // (no gold standard), this section is omitted entirely.
  platform_analysis: z.object({
    // Gold standard reference for traceability
    gold_standard_profile_id: z.string().nullable(),
    gold_standard_profile_version: z.number().nullable(),
    gold_standard_platform: z.string().nullable(),

    // Per-platform presence + benchmarking
    platform_breakdown: z.array(
      z.object({
        platform: z.string(),
        present_count: z.number(),
        absent_count: z.number(),
        meets_gold_standard_count: z.number(),
        common_gate_failures: z.array(
          z.object({
            gate: z.string(),
            failed_count: z.number(),
          }).passthrough(),
        ).optional(),
      }).passthrough(),
    ).optional(),

    // Category-level benchmarking summary
    candidates_meeting_all_gates: z.number(),
    most_common_gate_failures: z.array(
      z.object({
        gate: z.string(),
        failed_count: z.number(),
        severity: z.enum(['non_negotiable', 'recommended']).optional(),
      }).passthrough(),
    ).optional(),

    // Platform-aware outreach recommendations
    outreach_recommendation: z.object({
      primary_platform: z.string(),
      platform_rationale: z.string(),
      platform_specific_opportunities: z.array(
        z.object({
          platform: z.string(),
          opportunity: z.string(),
          evidence_summary: z.string(),
        }).passthrough(),
      ).optional(),
      recommended_platform_focus: z.string(),
      primary_angle: z.string(),
      suggested_call_to_action: z.string(),
    }).passthrough(),
  }).passthrough().optional(),

  // Discovery Scan Contract (spec §3) — per-unit sweep ledger + derived
  // coverage attestation. Optional so pre-contract payloads still validate;
  // the normalizer synthesizes an "unverified" block when absent.
  scan_contract: scanContractSchema.optional(),

  // Uncataloged blind spots detected during the scan — same contract as
  // bronze_standard_scan.suggested_reasons: a candidate surfaced by a
  // discovery mechanism NOT covered by any reason in the BRONZE STANDARD
  // block is proposed here, never force-fit into bronze_attribution with an
  // invented reason_key.
  suggested_reasons: dropMalformed(suggestedReasonSchema).optional(),

  // Uncataloged discovery-signal patterns — a recurring observation no
  // registered INT_* code captures is proposed here, never emitted as a
  // non-registry code inside discovery_signals.
  suggested_signals: dropMalformed(suggestedSignalSchema).optional(),
}).passthrough();

// ─── Scan contract — key derivation, claim derivation, invariant collector ───
//
// candidate_key rule (spec v1.3): slug(business_name)--slug(city state). The
// slugger lowercases, drops legal suffixes, strips punctuation, and
// hyphen-joins, so "Universal African Market LLC" in Gladstone keys as
// "universal-african-market--gladstone-mo". candidate_key_aliases are alternate
// names slugged the same way — INV-1/INV-7 accept any of them.

const LEGAL_SUFFIXES = new Set([
  'llc', 'inc', 'ltd', 'co', 'corp', 'corporation', 'company', 'lp', 'llp', 'plc', 'dba',
]);

export function slugifyCandidatePart(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 0 && !LEGAL_SUFFIXES.has(t))
    .join('-');
}

/**
 * Display form of a candidate_key: `name-slug--city-state-slug` — e.g.
 * `universal-african-market--gladstone-mo`. State rides with city so the same
 * name in Springfield, IL vs Springfield, MO keys differently; both optional.
 */
export function deriveCandidateKey(businessName: unknown, city: unknown, state?: unknown): string {
  const n = slugifyCandidatePart(businessName);
  if (!n) return '';
  const c = slugifyCandidatePart([city, state].filter(Boolean).join(' '));
  return c ? `${n}--${c}` : n;
}

/**
 * Canonical comparison form — separators removed entirely, so
 * "universal-african-market--gladstone-mo", "Universal African Market
 * (Gladstone, MO)", and "universal african market gladstone mo" all compare
 * equal. Separator/casing drift must never produce false INV-1/INV-7 misses.
 */
export function canonicalCandidateKey(key: unknown): string {
  return slugifyCandidatePart(key).replace(/-/g, '');
}

/**
 * All canonical keys a candidate may match on: primary name+city, name alone
 * (tolerance for name-only ledger keys), and the same pair per alias.
 */
export function candidateKeySet(biz: any): Set<string> {
  const keys = new Set<string>();
  const add = (name: unknown, city: unknown, state: unknown) => {
    const full = canonicalCandidateKey(deriveCandidateKey(name, city, state));
    if (full) keys.add(full);
    const nameOnly = canonicalCandidateKey(name);
    if (nameOnly) keys.add(nameOnly);
  };
  add(biz?.business_name, biz?.city, biz?.state);
  for (const alias of Array.isArray(biz?.candidate_key_aliases) ? biz.candidate_key_aliases : []) {
    add(alias, biz?.city, biz?.state);
  }
  return keys;
}

/** The §3.1 claim ladder, computed from the attestation — never trusted from the model. */
export function deriveCompletenessClaim(att: any): 'verified_full' | 'verified_partial' | 'unverified' {
  if (!att || typeof att !== 'object') return 'unverified';
  const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  if (num(att.units_executed) === 0) return 'unverified';
  const full = num(att.units_not_executed) === 0
    && num(att.vectors_not_executed) === 0
    && (Array.isArray(att.uncovered_municipalities) ? att.uncovered_municipalities.length : 0) === 0;
  return full ? 'verified_full' : 'verified_partial';
}

/** Minimal block synthesized when a payload omits scan_contract entirely (§4 degraded mode). */
export function synthesizeMissingScanContract(): any {
  return {
    contract_version: DISCOVERY_SCAN_CONTRACT_VERSION,
    sweep_ledger: [],
    coverage_attestation: {
      units_total: 0,
      units_executed: 0,
      units_executed_empty: 0,
      units_not_executed: 0,
      units_blocked: 0,
      vectors_total: 0,
      vectors_executed: 0,
      vectors_not_executed: 0,
      coverage_ratio: 0,
      completeness_claim: 'unverified',
      uncovered_municipalities: [],
      unexecuted_vector_list: [],
      attestation_basis: 'No scan_contract emitted by the run — synthesized on import; coverage is unverified.',
    },
    municipality_coverage: [],
    reconciliation: null,
  };
}

export interface DiscoveryContractViolation {
  invariant: 'INV-1' | 'INV-2' | 'INV-3' | 'INV-4' | 'INV-5' | 'INV-6' | 'INV-7' | 'INV-8';
  path?: string;
  message: string;
}

function extractLedgerZip(row: any): string | null {
  const id = String(row?.unit_id ?? '').trim();
  const m = /^zip:(\d{5})/.exec(id);
  if (m) return m[1];
  if (/^\d{5}$/.test(id)) return id;
  return null;
}

const normMunicipality = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Report-mode invariant check (spec §4, v1.3). Returns the violation list the
 * import gate stamps into audit_data.scan_contract_violations — nothing here
 * rejects the payload. INV-3/INV-4 are grid-parameterized: callers pass the
 * authoritative sweep units (cached grid > campaign zips) via opts; with no
 * expected units those invariants are skipped (a scan with no declared grid
 * can't be checked against one).
 */
export function collectDiscoveryContractViolations(
  data: any,
  opts?: { expectedZips?: string[]; expectedMunicipalities?: string[] },
): DiscoveryContractViolation[] {
  const violations: DiscoveryContractViolation[] = [];
  if (!data || typeof data !== 'object') return violations;
  const contract = data.scan_contract;
  if (!contract || typeof contract !== 'object') return violations; // absent → normalizer synthesizes unverified
  const ledger: any[] = Array.isArray(contract.sweep_ledger) ? contract.sweep_ledger : [];
  const att = contract.coverage_attestation ?? {};
  const discovered: any[] = Array.isArray(data.discovered_businesses) ? data.discovered_businesses : [];

  // INV-1 — provenance closure: every candidate appears in ≥1 ledger row.
  const ledgerKeys = new Set<string>();
  for (const row of ledger) {
    for (const k of Array.isArray(row?.candidate_keys) ? row.candidate_keys : []) {
      const c = canonicalCandidateKey(k);
      if (c) ledgerKeys.add(c);
    }
  }
  discovered.forEach((biz: any, i: number) => {
    if (!biz || typeof biz !== 'object') return;
    const keys = candidateKeySet(biz);
    if (keys.size === 0) return;
    if (![...keys].some((k) => ledgerKeys.has(k))) {
      violations.push({
        invariant: 'INV-1',
        path: `discovered_businesses[${i}].business_name`,
        message: `Candidate "${biz.business_name ?? '?'}" does not appear in any sweep_ledger row's candidate_keys`,
      });
    }
  });

  // INV-2 + INV-8 — per-row consistency; "executed" means queried.
  ledger.forEach((row: any, i: number) => {
    const status = row?.status;
    const path = `scan_contract.sweep_ledger[${i}]`;
    const label = row?.unit_id ?? `#${i}`;
    const cks = Array.isArray(row?.candidate_keys) ? row.candidate_keys : [];
    if (status === 'executed_with_findings') {
      if (!(typeof row?.findings_count === 'number' && row.findings_count >= 1) || cks.length === 0) {
        violations.push({ invariant: 'INV-2', path, message: `Row "${label}" claims executed_with_findings but findings_count/candidate_keys do not back it` });
      }
    } else if (status === 'executed_empty') {
      if (row?.findings_count !== 0 || cks.length !== 0) {
        violations.push({ invariant: 'INV-2', path, message: `Row "${label}" claims executed_empty but findings_count !== 0 or candidate_keys is non-empty` });
      }
    } else if (status === 'blocked') {
      if (typeof row?.blocked_reason !== 'string' || !row.blocked_reason.trim()) {
        violations.push({ invariant: 'INV-2', path, message: `Row "${label}" is blocked but carries no blocked_reason` });
      }
    }
    if ((status === 'executed_with_findings' || status === 'executed_empty')
      && (row?.unit_type === 'zip_label_matrix' || row?.unit_type === 'corridor')) {
      const ps = Array.isArray(row?.platforms_swept) ? row.platforms_swept : [];
      const ls = Array.isArray(row?.labels_swept) ? row.labels_swept : [];
      if (ps.length === 0 || ls.length === 0) {
        violations.push({ invariant: 'INV-8', path, message: `Row "${label}" claims "${status}" with empty platforms_swept/labels_swept — executed means queried, not visited` });
      }
    }
  });

  // INV-5 — claimed == derived (the gate also rewrites the stored claim).
  const claimed = att?.completeness_claim;
  const derived = deriveCompletenessClaim(att);
  if (!claimed) {
    violations.push({ invariant: 'INV-5', path: 'scan_contract.coverage_attestation.completeness_claim', message: `completeness_claim missing — derived claim is "${derived}"` });
  } else if (claimed !== derived) {
    violations.push({ invariant: 'INV-5', path: 'scan_contract.coverage_attestation.completeness_claim', message: `completeness_claim "${claimed}" disagrees with derived claim "${derived}"` });
  }

  // INV-6 — every unexecuted vector is named with a reason.
  const vecNot = typeof att?.vectors_not_executed === 'number' ? att.vectors_not_executed : 0;
  const unexecList = Array.isArray(att?.unexecuted_vector_list) ? att.unexecuted_vector_list : [];
  if (unexecList.length < vecNot) {
    violations.push({
      invariant: 'INV-6',
      path: 'scan_contract.coverage_attestation.unexecuted_vector_list',
      message: `${vecNot} vectors reported not executed but only ${unexecList.length} named in unexecuted_vector_list`,
    });
  }

  // INV-3 — every expected ZIP has exactly one zip_label_matrix row.
  const expectedZips = (opts?.expectedZips ?? []).map((z) => String(z).trim()).filter(Boolean);
  if (expectedZips.length > 0) {
    const zipRowCount = new Map<string, number>();
    for (const row of ledger) {
      if (row?.unit_type !== 'zip_label_matrix') continue;
      const zip = extractLedgerZip(row);
      if (!zip) continue;
      zipRowCount.set(zip, (zipRowCount.get(zip) ?? 0) + 1);
    }
    for (const zip of expectedZips) {
      const n = zipRowCount.get(zip) ?? 0;
      if (n === 0) {
        violations.push({ invariant: 'INV-3', path: 'scan_contract.sweep_ledger', message: `Expected ZIP ${zip} has no zip_label_matrix row — a mandated sweep unit never opened` });
      } else if (n > 1) {
        violations.push({ invariant: 'INV-3', path: 'scan_contract.sweep_ledger', message: `Expected ZIP ${zip} appears in ${n} zip_label_matrix rows — must be exactly one` });
      }
    }
  }

  // INV-4 — municipality coverage completeness.
  const muniRows: any[] = Array.isArray(contract.municipality_coverage) ? contract.municipality_coverage : [];
  const coveredMunis = new Set(muniRows.map((r) => normMunicipality(r?.municipality)));
  for (const m of (opts?.expectedMunicipalities ?? []).map((s) => String(s).trim()).filter(Boolean)) {
    if (!coveredMunis.has(normMunicipality(m))) {
      violations.push({ invariant: 'INV-4', path: 'scan_contract.municipality_coverage', message: `Expected municipality "${m}" has no municipality_coverage row` });
    }
  }
  const attUn = new Set((Array.isArray(att?.uncovered_municipalities) ? att.uncovered_municipalities : []).map(normMunicipality));
  muniRows.forEach((r: any, i: number) => {
    if (r?.status === 'uncovered' && !attUn.has(normMunicipality(r?.municipality))) {
      violations.push({ invariant: 'INV-4', path: `scan_contract.municipality_coverage[${i}]`, message: `Municipality "${r?.municipality}" marked uncovered but absent from coverage_attestation.uncovered_municipalities` });
    }
  });

  // INV-7 — every operator-supplied member resolves to a candidate or an
  // exclusion. A member in `unmatched` IS a violation (§7.1 G4: zero unmatched
  // members — the scan missed a real business), and a member absent from every
  // list is the silent-drop case. The import gate additionally injects and
  // diffs import-time members; this checks the (possibly merged) block.
  const recon = contract.reconciliation;
  if (recon && typeof recon === 'object') {
    const canonList = (arr: any): string[] => (Array.isArray(arr) ? arr : []).map(canonicalCandidateKey).filter(Boolean);
    const matchedCanons = [...canonList(recon.matched_to_candidates), ...canonList(recon.added_this_pass)];
    const unmatchedCanons = new Set(canonList(recon.unmatched));
    const excludedCanons = new Set(
      (Array.isArray(recon.excluded_with_reason) ? recon.excluded_with_reason : [])
        .map((e: any) => canonicalCandidateKey(e?.member)),
    );
    const candidateNames = new Set<string>();
    for (const biz of discovered) {
      if (!biz || typeof biz !== 'object') continue;
      for (const name of [biz.business_name, ...(Array.isArray(biz.candidate_key_aliases) ? biz.candidate_key_aliases : [])]) {
        const c = canonicalCandidateKey(name);
        if (c) candidateNames.add(c);
      }
    }
    const members: any[] = Array.isArray(recon.operator_supplied_members) ? recon.operator_supplied_members : [];
    members.forEach((m: any, i: number) => {
      const canon = canonicalCandidateKey(m);
      if (!canon) return;
      const path = `scan_contract.reconciliation.operator_supplied_members[${i}]`;
      // A member resolves to a candidate when its name canon equals a
      // candidate name canon, or prefixes a matched/added candidate_key canon
      // (keys carry a `--city-state` suffix the member name lacks). The ≥6
      // guard keeps short names from prefix-matching unrelated keys.
      const matched = candidateNames.has(canon)
        || (canon.length >= 6 && matchedCanons.some((k) => k === canon || k.startsWith(canon)));
      if (matched || excludedCanons.has(canon)) return;
      violations.push({
        invariant: 'INV-7',
        path,
        message: unmatchedCanons.has(canon)
          ? `Operator-supplied member "${m}" is unmatched — the scan missed a real business`
          : `Operator-supplied member "${m}" resolves to nothing — no candidate match, unmatched entry, or exclusion`,
      });
    });
  }

  return violations;
}

/**
 * The import-time coverage gate (Discovery Scan Contract v1.3) — applied in
 * MarketingPromptService.importExternalResult on the RAW parsed JSON, same
 * seam as applyRenderControlCoverageGate. Report-mode: the import always
 * succeeds; violations are stamped into `scan_contract_violations` and the
 * stored completeness_claim is overwritten with the derived value.
 *
 *   1. Injects import-time operator-supplied members into
 *      scan_contract.reconciliation and computes the diff against the
 *      candidate set (model-emitted blocks are merged, never trusted blindly).
 *   2. Collects INV-1…INV-8 violations (INV-3/4 via the caller-supplied
 *      authoritative grid).
 *   3. Overwrites completeness_claim with the derived claim on mismatch.
 *   4. Stamps the violation list at audit_data.scan_contract_violations.
 */
export function applyDiscoveryScanContractGate(
  data: any,
  opts: {
    expectedZips?: string[];
    expectedMunicipalities?: string[];
    operatorSuppliedMembers?: string[];
  } = {},
): any {
  if (!data || typeof data !== 'object') return data;
  const contract = data.scan_contract;
  if (!contract || typeof contract !== 'object') return data;

  // 1. Reconciliation — import-time members, computed not authored.
  const members = (opts.operatorSuppliedMembers ?? []).map((m) => String(m).trim()).filter(Boolean);
  if (members.length > 0) {
    const discovered: any[] = Array.isArray(data.discovered_businesses) ? data.discovered_businesses : [];
    const recon = (contract.reconciliation && typeof contract.reconciliation === 'object')
      ? contract.reconciliation
      : {};
    const supplied = new Set<string>(Array.isArray(recon.operator_supplied_members) ? recon.operator_supplied_members : []);
    const matched = new Set<string>(Array.isArray(recon.matched_to_candidates) ? recon.matched_to_candidates : []);
    const unmatched = new Set<string>(Array.isArray(recon.unmatched) ? recon.unmatched : []);
    for (const member of members) {
      supplied.add(member);
      const canon = canonicalCandidateKey(member);
      const hit = discovered.find((biz: any) => {
        if (!biz || typeof biz !== 'object') return false;
        return [biz.business_name, ...(Array.isArray(biz.candidate_key_aliases) ? biz.candidate_key_aliases : [])]
          .some((n) => canonicalCandidateKey(n) === canon);
      });
      if (hit) {
        matched.add(deriveCandidateKey(hit.business_name, hit.city, hit.state));
      } else {
        unmatched.add(member);
      }
    }
    contract.reconciliation = {
      ...recon,
      operator_supplied_members: [...supplied],
      matched_to_candidates: [...matched],
      unmatched: [...unmatched],
    };
  }

  // 2. Violations are collected BEFORE the claim overwrite so INV-5 records
  //    what the model claimed versus what the ledger derives.
  const violations = collectDiscoveryContractViolations(data, opts);

  // 3. Derived, not asserted — the stored claim is the computed one.
  const att = contract.coverage_attestation;
  if (att && typeof att === 'object') {
    const derived = deriveCompletenessClaim(att);
    if (att.completeness_claim !== derived) att.completeness_claim = derived;
  }

  // 4. Stamp (or clear, if re-applied on a clean payload).
  if (violations.length > 0) {
    data.scan_contract_violations = violations;
  } else {
    delete data.scan_contract_violations;
  }
  return data;
}

// ─── Payload normalization (reference-style + missing qualifying_businesses) ───
//
// Two model-emission quirks are normalized here so operators don't have to
// re-run discovery when the model gets the envelope shape slightly wrong:
//
// 1. Reference-style qualifying_businesses: some models emit
//    `qualifying_businesses` as entries that point back to
//    `discovered_businesses` rather than duplicating the full record, e.g.:
//      { "business_name": "His Grace African Grocery Store",
//        "note": "See discovered_businesses — identical record, qualifies" }
//    The schema requires full business objects, so this normalizer resolves
//    any reference-style entry by looking up its `business_name` in
//    `discovered_businesses` and substituting the full record. Extra fields on
//    the reference entry (e.g. `note`) are preserved via passthrough.
//
//    An entry is treated as reference-style when it has a `business_name` but
//    is missing the required `location_status` field (a required enum that a
//    full record always carries). Unmatched references are left untouched so
//    the validator surfaces a clear, field-level error.
//
// 2. Missing qualifying_businesses: some models emit only
//    `discovered_businesses` and omit `qualifying_businesses` entirely, even
//    though the prompt suffix requires it. Rather than reject the payload, we
//    derive `qualifying_businesses` from `discovered_businesses` by applying
//    the same exclusion rules the schema's refinements enforce (§31):
//    exclude `outside_market` and the chain/franchise ownership types
//    (`national_chain`, `national_franchise`, `regional_chain`). This mirrors
//    exactly what the prompt tells the model to do, so a model that lists only
//    qualifying candidates in `discovered_businesses` still imports cleanly.

const EXCLUDED_OWNERSHIP_TYPES = new Set([
  'national_chain',
  'national_franchise',
  'regional_chain',
]);

function isQualifyingCandidate(biz: any): boolean {
  if (!biz || typeof biz !== 'object') return false;
  if (biz.location_status === 'outside_market') return false;
  if (EXCLUDED_OWNERSHIP_TYPES.has(biz.ownership_type)) return false;
  return true;
}

export function normalizeIntelligenceDiscoveryPayload(parsed: any): any {
  if (!parsed || typeof parsed !== 'object') return parsed;

  // Degraded mode (Discovery Scan Contract §4): a payload with no scan_contract
  // imports as coverage-unverified rather than failing — the absent ledger is
  // itself the honest coverage statement.
  if (parsed.scan_contract === undefined || parsed.scan_contract === null) {
    parsed = { ...parsed, scan_contract: synthesizeMissingScanContract() };
  }

  const discovered: any[] = Array.isArray(parsed.discovered_businesses) ? parsed.discovered_businesses : [];
  if (discovered.length === 0) return parsed;

  // Case 2: qualifying_businesses missing entirely → derive from discovered.
  if (!Array.isArray(parsed.qualifying_businesses)) {
    return {
      ...parsed,
      qualifying_businesses: discovered.filter(isQualifyingCandidate),
    };
  }

  const qualifying: any[] = parsed.qualifying_businesses;

  const byName = new Map<string, any>();
  for (const d of discovered) {
    if (d && typeof d.business_name === 'string') {
      // First occurrence wins; duplicates are rare and would be ambiguous anyway.
      if (!byName.has(d.business_name)) byName.set(d.business_name, d);
    }
  }

  const resolved = qualifying.map((q) => {
    if (!q || typeof q !== 'object') return q;
    // Full records already carry location_status → leave as-is.
    if (q.location_status !== undefined) return q;
    const name = typeof q.business_name === 'string' ? q.business_name : undefined;
    if (!name) return q;
    const full = byName.get(name);
    if (!full) return q;
    // Merge: start from the full record, then overlay any extra keys from the
    // reference entry (e.g. `note`) so provenance of the reference is retained.
    return { ...full, ...q };
  });

  return { ...parsed, qualifying_businesses: resolved };
}

// ─── Operating posture (Discovery Scan Contract §5.0) ────────────────────
//
// Injected by PromptComposerService ahead of the focus fragment so the posture
// is set before the mechanism set is read. The contract exists because a fast
// pass reported coverage it did not perform (§1.1) — this block frames the run
// as enumeration work, and INV-8 makes the posture checkable.

export const DISCOVERY_OPERATING_POSTURE = `=== OPERATING POSTURE — DILIGENCE OVER SPEED ===
This is an enumeration task with a fixed floor and variable depth. The floor is
not optional and it is not a formality: every sweep unit named in the geography
grid must be opened and classified, and a unit you did not open is a blind spot
you must report.

Do not treat a fast pass as coverage. A scan that issues a handful of well-chosen
queries and then reports its vector log as complete has not swept the market — it
has swept the queries. The failure this contract exists to prevent is a run that
reports "executed" for work it did not perform.

Work the floor first, then deepen where the evidence points:

1. Enumerate before you interpret. Open every unit before reasoning about which
   units matter. Judgement about relevance comes after enumeration, never instead
   of it.
2. One query is not a sweep. A unit is swept when its labels and platforms have
   been queried and the results classified — not when one search came back empty.
3. Absence of results is a finding, not a reason to move on. Record
   executed_empty with the labels and platforms you actually issued.
4. Prefer a second angle over a faster answer. When a unit returns nothing under
   the obvious label, try the neighbouring labels, the token-free enumeration,
   and the attribute filters before marking it empty.
5. Never launder a skip as "blocked." blocked means attempted and failed, with
   the failure named. A unit you chose not to open is not_executed, and it caps
   your completeness claim.
6. Take the time the enumeration costs. This operation is sized for careful work.
   A rushed pass is a re-run, and a re-run costs more than the careful pass would
   have.
=== END OPERATING POSTURE ===`;

// ─── Cross-field refinements (hold conditions) ───────────────────────────

export const intelligenceDiscoverySchemaWithRefinements = intelligenceDiscoverySchema.superRefine((data, ctx) => {
  // outside_market candidates must NOT appear in qualifying_businesses
  for (let i = 0; i < data.qualifying_businesses.length; i++) {
    const biz = data.qualifying_businesses[i];
    if (biz.location_status === 'outside_market') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `qualifying_businesses[${i}] has location_status "outside_market" — must be excluded from the qualifying set`,
        path: ['qualifying_businesses', i, 'location_status'],
      });
    }
    // Chain/franchise exclusion
    if (biz.ownership_type === 'national_chain' || biz.ownership_type === 'national_franchise' || biz.ownership_type === 'regional_chain') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `qualifying_businesses[${i}] has ownership_type "${biz.ownership_type}" — must be excluded from the qualifying set`,
        path: ['qualifying_businesses', i, 'ownership_type'],
      });
    }
    // identity_confidence conflict → hold
    if (biz.identity_confidence === 'low' && biz.business_seek_priority !== 'hold') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `qualifying_businesses[${i}] has identity_confidence "low" — business_seek_priority must be "hold"`,
        path: ['qualifying_businesses', i, 'business_seek_priority'],
      });
    }
    // category_fit insufficient → hold or not recommended
    if (biz.category_fit === 'insufficient' && biz.business_seek_priority !== 'hold' && biz.business_seek_recommended !== false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `qualifying_businesses[${i}] has category_fit "insufficient" — business_seek_priority must be "hold" or business_seek_recommended must be false`,
        path: ['qualifying_businesses', i, 'category_fit'],
      });
    }
  }
});

// ─── Prompt suffix (appended to exported prompt text) ────────────────────

export const INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX = `
=== EXPECTED OUTPUT FORMAT ===
Return a single JSON object with this structure:
{
  "intelligence_mode": "profile" | "generic_fallback",
  "category": "<category name>",
  "city": "<city name>",
  "state": "<state>",
  "focus": "emerging" | "competitive",
  "discovered_businesses": [
    {
      "business_name": "<name>",
      "category": "<category>",
      "city": "<city>",
      "state": "<state>",
      "address": "<address if known>",
      "phone": "<phone if known>",
      "website": "<url or null>",
      "gbp_url": "<gbp url or null>",
      "location_status": "inside_city" | "adjacent_city" | "metro_area" | "outside_market",
      "ownership_type": "independent" | "local_chain" | "franchise" | "national_chain" | "national_franchise" | "regional_chain" | "unknown",
      "category_fit": "verified" | "probable" | "insufficient",
      "identity_confidence": "high" | "medium" | "low",
      "discovery_signals": ["INT_*", ...],
      "discovery_provenance": [
        { "source": "<source name>", "role": "<role>", "evidence_types": ["..."], "url": "<url>", "accessed_at": "<date>" }
      ],
      "business_seek_recommended": true | false,
      "business_seek_priority": "high" | "medium" | "low" | "hold",
      "rating": <number or null>,
      "review_count": <number or null>,
      "observed_attributes": [
        { "platform": "<platform>", "key": "<snake_case_key>", "label": "<display label>",
          "source_url": "<url or null>", "as_of": "<ISO date or null>" }
      ],
      "gold_standard_match": <true | false | null — ONLY when a GOLD STANDARD DISCOVERY BENCHMARK block is present in the prompt; null when no gold standard block>,
      "gold_standard_gate_results": [
        { "gate": "<gate name>", "passed": <true | false>, "platform": "<platform name, optional>" }
      ],
      "bronze_attribution": [
        { "reason_key": "<catalog reason key from the BRONZE STANDARD block>", "basis": "<one line — which vector or signal produced this find>" }
      ],
      "competitive_weaknesses": [
        { "weakness_key": "<weakness key from the COMPETITIVE FOCUS weakness vocabulary>", "basis": "<one line — the observation that names the exposure>" }
      ],
      "benchmark_only": <true | false — optional>,
    }
  ],
  "qualifying_businesses": [<FULL duplicate records — same structure as discovered_businesses, excludes outside_market, national_chain, national_franchise, regional_chain. Do NOT emit references like {"business_name": "...", "note": "see discovered_businesses"} — repeat the complete record for each qualifying business>],
  "candidate_count": <number>,
  "qualifying_count": <number>,
  "hold_count": <number>,
  "category_definition": "<text>",
  "geographic_classification_notes": "<text>",
  "ownership_exclusion_notes": "<text>",
  "profile_id": "<profile id or null>",
  "profile_version": <number or null>,
  "platform_analysis": {
    "gold_standard_profile_id": "<gold standard profile id or null>",
    "gold_standard_profile_version": <number or null>,
    "gold_standard_platform": "<platform name or null for cross-platform>",
    "platform_breakdown": [
      {
        "platform": "<google | yelp | facebook | bbb | apple_maps | bing | ...>",
        "present_count": <number of candidates with a presence on this platform>,
        "absent_count": <number of candidates with no presence on this platform>,
        "meets_gold_standard_count": <number of candidates that pass ALL non_negotiable gates on this platform>,
        "common_gate_failures": [
          { "gate": "<gate name>", "failed_count": <number> }
        ]
      }
    ],
    "candidates_meeting_all_gates": <number of candidates that pass ALL non_negotiable gates across all platforms where they have a presence>,
    "most_common_gate_failures": [
      { "gate": "<gate name>", "failed_count": <number>, "severity": "non_negotiable" | "recommended" }
    ],
    "outreach_recommendation": {
      "primary_platform": "<platform to lead outreach with — where the gold standard is deepest AND where candidates have the most fixable gaps>",
      "platform_rationale": "<why this platform leads for this category/city>",
      "platform_specific_opportunities": [
        { "platform": "<platform>", "opportunity": "<e.g. 12 candidates missing GBP primary category>", "evidence_summary": "<text>" }
      ],
      "recommended_platform_focus": "<platform that downstream business audits should target>",
      "primary_angle": "<outreach angle>",
      "suggested_call_to_action": "<CTA>"
    }
  },
  "scan_contract": {
    "contract_version": "discovery-scan-contract-v1",
    "sweep_ledger": [
      {
        "unit_id": "zip:<zip> — e.g. zip:64118 | corridor:<slug> | dataset:<slug>",
        "unit_type": "zip_label_matrix" | "corridor" | "dataset_geography",
        "unit": "<human label — e.g. 64118 (Kansas City, MO + Gladstone, MO)>",
        "platforms_swept": ["<platforms actually queried in this unit>"],
        "labels_swept": ["<labels actually queried in this unit>"],
        "status": "executed_with_findings" | "executed_empty" | "not_executed" | "blocked",
        "findings_count": <int — required for executed_*; 0 for executed_empty>,
        "candidate_keys": ["<slug(business_name)--slug(city state)>", ...],
        "executed_at": "<date>",
        "blocked_reason": "<required when status is blocked — the named failure>"
      }
    ],
    "coverage_attestation": {
      "units_total": <int>,
      "units_executed": <int>,
      "units_executed_empty": <int>,
      "units_not_executed": <int>,
      "units_blocked": <int>,
      "vectors_total": <int>,
      "vectors_executed": <int>,
      "vectors_not_executed": <int>,
      "coverage_ratio": <0-1>,
      "completeness_claim": "verified_full" | "verified_partial" | "unverified",
      "uncovered_municipalities": ["<municipality>", ...],
      "unexecuted_vector_list": [
        { "vector": "<mechanism-set vector not executed>", "reason": "<why>" }
      ]
    },
    "municipality_coverage": [
      {
        "municipality": "<adjacent municipality from the geography grid>",
        "shared_zip": "<shared ZIP, if any>",
        "platform_zip_rows": ["zip:<zip>", ...],
        "label_independent_datasets": ["<dataset>", ...],
        "status": "covered" | "platform_only" | "uncovered"
      }
    ],
    "reconciliation": {
      "operator_supplied_members": ["<member name>", ...],
      "matched_to_candidates": ["<candidate_key>", ...],
      "added_this_pass": ["<candidate_key>", ...],
      "unmatched": ["<member name>", ...],
      "excluded_with_reason": [{ "member": "<member name>", "reason": "<why excluded>" }]
    }
  },
  "suggested_reasons": [
    {
      "reason_key": "<proposed snake_case key — becomes the catalog key if accepted>",
      "proposed_label": "<short display label>",
      "proposed_definition": "<the discovery MECHANIC — why businesses under this pattern stay hidden>",
      "observed_signals": ["INT_*"],
      "expected_vectors": ["<source/vector that would systematically surface this pattern>"],
      "scope_level": "universal" | "category" | "category_family" | "location",
      "category_family_applicable": <true | false>,
      "suggested_category_scope": "<category or family the pattern generalizes to>",
      "suggested_scope_platform": "<platform or null>",
      "exemplar_lead": { "business_name": "<name>", "address": "<address>", "observed_platform": "<platform>", "discovery_vector": "<how it was found>", "notes": "<evidence>" }
    }
  ],
  "suggested_signals": [
    { "code": "INT_<UPPER_SNAKE>", "proposed_label": "<label>", "proposed_definition": "<what the observed pattern means>", "exemplar_leads": ["<business names exhibiting it>"], "primary_playbook": "<playbook code from the TRIAGE PLAYBOOK ROSTER, or omit>", "secondary_playbook": "<fallback playbook code, or omit>" }
  ]
}

Rules:
- discovered_businesses is the full set found; qualifying_businesses excludes outside_market, national_chain, national_franchise, and regional_chain.
- qualifying_businesses MUST contain full duplicate records (every field), NOT references or summaries. Each entry must be a complete business object identical in shape to its discovered_businesses counterpart.
- discovery_signals MUST use INT_* codes only. Do NOT use RA/DS/WC/CP/VP signal codes. Use only codes from the registered discovery-signal vocabulary (the Category Signals block / established INT_* codes). When a candidate exhibits a recurring discovery-relevant pattern that NO registered code captures, do NOT emit an invented code inside discovery_signals — propose it once in the top-level suggested_signals array (code INT_<UPPER_SNAKE>, proposed_label, proposed_definition, exemplar_leads naming the businesses). A proposed signal never evaluates in triage until an operator registers it.
- SUGGESTED SIGNAL TRIAGE ROUTING: each suggested_signals entry SHOULD name where the pattern belongs in triage once registered — primary_playbook is the playbook whose evidence pool it would join (the business this pattern describes is that playbook's pitch target), secondary_playbook is the fallback route when no playbook's rules match the business. Use ONLY playbook codes listed in the TRIAGE PLAYBOOK ROSTER block; omit both when none genuinely fits — never invent a code.
- If identity_confidence is "low", business_seek_priority MUST be "hold".
- If category_fit is "insufficient", business_seek_priority MUST be "hold" OR business_seek_recommended MUST be false.
- Do NOT infer a deficiency from absence of evidence. Record what you found and what you could not verify as separate observations.
- Do NOT infer a deficiency from absence of evidence. Record what you found and what you could not verify as separate observations.
- OBSERVED ATTRIBUTES: For each candidate, record the attribute chips its platform profiles actually display (payments accepted, accessibility, ownership, service options, certifications) in observed_attributes — one entry per attribute with the platform, a snake_case key, a display label, the profile URL where it was observed, and the date observed. Never infer attributes from the business's category, name, or neighborhood — record only what the profile itself shows. Omit the field entirely when no attribute chips are observed.
- GOLD STANDARD RATING: When a "=== GOLD STANDARD DISCOVERY BENCHMARK ===" block is present in the prompt, populate gold_standard_match and gold_standard_gate_results per candidate (rate each candidate per-platform against the established expected fields and quality gates), and populate the platform_analysis section with per-platform presence counts, gate-failure aggregation, and platform-aware outreach recommendations. The primary_platform should be where the gold standard is deepest AND where candidates have the most fixable gaps (highest-opportunity platform for outreach, not just the most-present platform). The recommended_platform_focus tells downstream business audits which platform to target.
- When NO gold standard block is present (degraded mode), OMIT gold_standard_match, gold_standard_gate_results, and platform_analysis entirely. Rate candidates on category-general heuristics only.
- BRONZE REASON ATTRIBUTION: When a "=== BRONZE STANDARD — MARKET CALIBRATION ===" block is present in the prompt, attribute each candidate to the catalog reason(s) DIRECTLY RESPONSIBLE for the find — the reason whose expected_vectors surfaced the business, or whose signal vocabulary is what identifies it as category-qualified-but-invisible. Emit one bronze_attribution entry per responsible reason with its reason_key exactly as given in the block and a one-line basis naming the vector or signal that produced the find. Attribution is causal, not resemblance: a candidate mainstream discovery would have found anyway gets NO attribution, and a candidate that merely looks like a bronze exemplar but was not reached through the reason's vector gets none either. When NO bronze calibration block is present, or no reason was responsible for a candidate, OMIT bronze_attribution entirely.
- UNCATALOGED REASON SUGGESTIONS: a bronze_attribution reason_key MUST be copied verbatim from the BRONZE STANDARD block — never invent or paraphrase a key there. If a candidate was surfaced by a discovery mechanism no catalog reason covers, propose it ONCE in the top-level suggested_reasons array instead: a proposed snake_case reason_key, label, definition of the discovery mechanic (why the pattern stays hidden — never a business attribute like size or age), the observed INT_* signals, the expected_vectors that would systematically surface it, scope_level + category_family_applicable + suggested_category_scope, and an exemplar_lead naming one representative business. A suggested reason is a proposal for catalog review — it does not attribute the candidate and does not fill a slot.
- COMPETITIVE WEAKNESS ATTRIBUTION: When focus is "competitive", leaders are selected for their strengths — weaknesses are documented during selection, not used as a selection filter. Attribute each qualifying candidate to the weakness(es) observed during evaluation — named exposures from the weakness vocabulary in the COMPETITIVE FOCUS block. Emit one competitive_weaknesses entry per weakness with its weakness_key exactly as given and a one-line basis naming the observation that identifies the exposure. A recommended qualifying candidate SHOULD carry at least one entry — the weakness is the pitch wedge (no pain, no pitch). A leader with no observable weakness is a benchmark, not a prospect: emit benchmark_only: true and no weaknesses. When focus is "emerging", OMIT competitive_weaknesses and benchmark_only entirely.
- SCAN CONTRACT (coverage proof — both focuses): scan_contract is your coverage ledger, not a formality. Emit ONE sweep_ledger row per geography-grid ZIP (unit_id "zip:<zip>"), one per corridor actually swept (unit_id "corridor:<slug>"), and one per dataset x geography unit (unit_id "dataset:<slug>"). Statuses: executed_with_findings (≥1 candidate), executed_empty (swept, zero findings — MUST be reported, never silently skipped), not_executed (admitted blind spot), blocked (attempted and failed — requires blocked_reason naming the failure). An executed_* row MUST carry the platforms_swept and labels_swept you actually issued — a row claiming executed with empty lists is not a sweep, it is a visit.
- CANDIDATE KEYS: every discovered business MUST appear in at least one ledger row's candidate_keys — key format slug(business_name)--slug(city state), e.g. universal-african-market--gladstone-mo. A business found in multiple units may appear in multiple rows. For a business operating under alternate names, list them in candidate_key_aliases so the ledger and the candidate record resolve to the same business.
- COVERAGE ATTESTATION IS DERIVED: units_total/units_executed/units_executed_empty/units_not_executed/units_blocked are counts computed from your ledger rows. completeness_claim follows the ladder: verified_full only when nothing is unexecuted and no municipality is uncovered; verified_partial when ≥1 unit executed with any gap; unverified when nothing executed. Every vector in the mechanism set you did not execute MUST appear in unexecuted_vector_list with a reason — unexecuted_vector_list.length must equal vectors_not_executed.
- MUNICIPALITY COVERAGE: emit one municipality_coverage row per adjacent municipality named in the geography grid. status "uncovered" must ALSO appear in coverage_attestation.uncovered_municipalities.
- COVERAGE SELF-TEST AS RUN-TIME ASSERTION: for each class in the profile's coverage_self_test, cite the unit_id(s) you actually executed and the result. A class that names a mechanism but cites no executed unit is uncovered — say so.
- RECONCILIATION: if the prompt carries operator-supplied category members, every member MUST resolve to a candidate_key (or candidate_key_aliases match), an unmatched entry, or an excluded_with_reason entry — never silently dropped.
`;

// ─── Discovery Context (Migration 253 — GAP-E3) ──────────────────────────
//
// Stored on mkt_campaigns_list.discovery_context (JSONB, nullable). Carries
// the discovery context from the queue entry onto the child business campaign
// so the business analysis audit prompt can render a "Discovery leads" block
// as verification hypotheses (never findings — §S1 guardrail preserved).
//
// All fields optional/nullable — old campaigns and non-intelligence-derived
// children have null discovery_context and render audit prompts byte-identical
// to the pre-feature baseline.
//
// Validation boundary (spec §6): validation happens at handoff time
// (createCampaignFromQueue → deriveBusinessCampaign → createCampaign). Invalid
// context is logged and dropped, never blocking campaign creation, so invalid
// context is never persisted. The render-time check in renderDiscoveryLeadsBlock
// is cheap defense (try/catch), not a second validation boundary.

export const discoveryContextSchema = z.object({
  focus: z.enum(['emerging', 'competitive']).nullable().optional(),
  discovered_at: z.string().nullable().optional(),
  business_seek_priority: z.enum(['high', 'medium', 'low', 'hold']).nullable().optional(),
  category_fit: z.enum(['verified', 'probable', 'insufficient']).nullable().optional(),
  identity_confidence: z.enum(['high', 'medium', 'low']).nullable().optional(),
  location_status: z.string().nullable().optional(),
  seek_batch_id: z.string().nullable().optional(),
  // The discovery scan's own category context — carried so a campaign
  // spawned under a different (category-identified) category can frame the
  // find: "surfaced under X, audited as Y". Not rendered when it matches the
  // campaign's own category.
  source_category: z.string().nullable().optional(),
  discovery_signals: z.array(z.string().regex(/^INT_/)).optional(),
  discovery_provenance: z.array(discoveryProvenanceSchema).optional(),
  // Bronze Standard System (spec §7.4) — catalog reason(s) directly
  // responsible for the prospect's discovery, carried forward from the
  // scan's per-candidate bronze_attribution so the business audit's
  // Discovery Leads block can name the blind spot that surfaced it.
  bronze_attribution: z.array(
    z.object({
      reason_key: z.string().min(1),
      basis: z.string().nullable().optional(),
    }).passthrough(),
  ).optional(),
  // Competitive Weakness Attribution (COMPETITIVE_WEAKNESS_ATTRIBUTION_SPEC
  // §7) — the incumbent's named exposures, carried forward from the scan's
  // per-candidate competitive_weaknesses so downstream surfaces can frame
  // the pitch differential. Both attribution kinds may coexist on a merged
  // prospect (§8).
  competitive_weaknesses: z.array(
    z.object({
      weakness_key: z.string().min(1),
      basis: z.string().nullable().optional(),
    }).passthrough(),
  ).optional(),
  // Ownership classification carried for the identity packet's seed-confidence
  // meter (queue business_snapshot.ownership_type — chain/franchise exclusion).
  ownership_type: ownershipTypeEnum.nullable().optional(),
  // Resolved queue verification outcome at promotion time — the meter's
  // human-verification override ('operational' clears; negative outcomes sink).
  verification_outcome: z.string().nullable().optional(),
}).passthrough();

export type DiscoveryContext = z.infer<typeof discoveryContextSchema>;

/**
 * Validate a discovery context payload at the handoff boundary (spec §6).
 * Returns the parsed context on success, or null on validation failure
 * (caller logs a warning and drops — never blocks campaign creation).
 */
export function validateDiscoveryContext(raw: unknown): DiscoveryContext | null {
  try {
    const parsed = discoveryContextSchema.parse(raw);
    // Drop empty context (no signals AND no provenance AND no priority/fit) —
    // nothing to render, so treat as absent to keep the campaign row clean.
    const hasSignals = Array.isArray(parsed.discovery_signals) && parsed.discovery_signals.length > 0;
    const hasProvenance = Array.isArray(parsed.discovery_provenance) && parsed.discovery_provenance.length > 0;
    const hasMeta = parsed.business_seek_priority || parsed.category_fit || parsed.identity_confidence;
    const hasBronzeAttribution = Array.isArray(parsed.bronze_attribution) && parsed.bronze_attribution.length > 0;
    const hasCompetitiveWeaknesses = Array.isArray(parsed.competitive_weaknesses) && parsed.competitive_weaknesses.length > 0;
    if (!hasSignals && !hasProvenance && !hasMeta && !hasBronzeAttribution && !hasCompetitiveWeaknesses) return null;
    return parsed;
  } catch {
    return null;
  }
}
