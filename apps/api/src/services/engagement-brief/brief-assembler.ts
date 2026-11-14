/**
 * Engagement Brief assembler — the deterministic consolidation layer (Pass 2
 * Layers A+B: assemble + reconcile).
 *
 * Spec: docs/LocalBiz/ENGAGEMENT_BRIEF_SPINE_SPRINT_PLAN.md (D1–D5, D8)
 *
 * The Pass-1 audit already emits every fragment a spine needs. This module
 * folds those fragments into the persisted brief shape WITHOUT a model call:
 *
 *   pains              <- gap_analysis.gaps + outreach_problems
 *                         (+ negative_review_themes folded in as backing /
 *                          standalone pains when no review pain exists)
 *   assets             <- observed_assets
 *   capability_fits    <- market_opportunities + recommended_services
 *                         + recommended_attributes (not_observed only)
 *   verification_gates <- data_quality.unavailable_fields/conflicts
 *                         + recommended_attributes (verify_with_owner /
 *                          unverifiable) + claim-state signals
 *   do_not_claim       <- mechanical guardrails from data_quality
 *
 * Reconcile = one stable ordering produced by rank rules, never a model pick:
 *   non_negotiable-severity pains > negative-theme-backed pains >
 *   recommended-severity pains > the rest; outreach_problems index is the
 *   within-tier tie-breaker (it is the audit's own ranked judgment).
 *
 * Every row carries `source_fragment` — the audit field path it came from —
 * and cites evidence_index keys (`src_*`), so provenance is the join record.
 * Layer C (model synthesis) fills consequence/framing gaps later; this layer
 * must stand alone when it never runs (D7).
 */

import { createHash } from 'crypto';

// ─── BRIEF_INPUT_FIELDS — the canonical read manifest (G13) ─────────────
// The assembler reads ONLY these audit_data fields; the fingerprint hashes
// exactly this set so a stale check and an assemble consume one manifest.

export const BRIEF_INPUT_FIELDS = [
  'gap_analysis',
  'observed_assets',
  'combined_review_metrics',
  'detected_signals',
  'outreach_problems',
  'alignment_scoring',
  'data_quality',
  'negative_review_themes',
  'market_opportunities',
  'benefits',
  'digital_opportunity_score',
  'recommended_services',
  'recommended_attributes',
  'high_attention',
  'channels_scanned',
] as const;

// ─── Domain classifier ──────────────────────────────────────────────────
// Pains/assets/fits are bucketed into a signal-adjacent domain so (a) the
// Phase-3 archetype overlay can reorder by domain and (b) capability fits
// and gates can resolve `addresses_ref`/`blocks` deterministically.

export type PainDomain =
  | 'review'
  | 'website'
  | 'directory'
  | 'catalog'
  | 'hours'
  | 'nap'
  | 'photos'
  | 'attributes'
  | 'other';

const DOMAIN_PATTERNS: Array<[PainDomain, RegExp]> = [
  ['review', /review|rating|stars?|respond|response|complaint|unanswered/gi],
  ['website', /website|web_?site|domain|url|landing|\bsite\b|web_?page|cta|mobile/gi],
  ['directory', /directory|listing|yelp|bing|apple|bbb|profile|claim|duplicate|suspend/gi],
  ['catalog', /catalog|product|menu|brows|inventory|service_menu/gi],
  ['hours', /hours|opening|schedule|holiday/gi],
  ['nap', /\bname\b|\baddress\b|\bphone\b|\bnap\b|contact/gi],
  ['photos', /photo|image|logo|picture|visual/gi],
  ['attributes', /attribute|amenity|chip/gi],
];

/**
 * Score-based domain classification — each domain scores its match count and
 * the highest wins (earlier patterns win ties). Single-keyword-first would
 * misclassify e.g. "two Yelp listings splitting the review record" as review
 * on the word 'review'; match-count scoring lets 'yelp'+'listing' win.
 */
export function classifyDomain(text: string | null | undefined): PainDomain {
  if (!text) return 'other';
  let best: PainDomain = 'other';
  let bestScore = 0;
  for (const [domain, pattern] of DOMAIN_PATTERNS) {
    const score = text.match(pattern)?.length ?? 0;
    if (score > bestScore) {
      best = domain;
      bestScore = score;
    }
  }
  return best;
}

/** Signal prefix → domain. RA_*=review, WC_*=website, DS_*=directory,
 *  VP_*=photos, CP_*=nap — the same vocabulary project-phase predicates use. */
const SIGNAL_PREFIX_DOMAIN: Record<string, PainDomain> = {
  RA: 'review',
  WC: 'website',
  DS: 'directory',
  VP: 'photos',
  CP: 'nap',
};

function signalDomains(detectedSignals: string[]): Set<PainDomain> {
  const set = new Set<PainDomain>();
  for (const s of detectedSignals ?? []) {
    const prefix = String(s).split('_')[0];
    const domain = SIGNAL_PREFIX_DOMAIN[prefix];
    if (domain) set.add(domain);
  }
  return set;
}

// ─── Fingerprint ────────────────────────────────────────────────────────

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

/**
 * sha256 over the canonical serialization of the fields the assembler reads.
 * Two audits produce the same fingerprint iff the assembler would produce the
 * same spine inputs — the dirty-check that gates Layer-C spend (D4/D7).
 */
export function computeEvidenceFingerprint(auditData: any): string | null {
  if (!auditData || typeof auditData !== 'object') return null;
  const slice: Record<string, unknown> = {};
  for (const field of BRIEF_INPUT_FIELDS) {
    if (auditData[field] !== undefined) slice[field] = auditData[field];
  }
  return createHash('sha256').update(stableStringify(slice)).digest('hex');
}

// ─── Path resolution (ref integrity, D5) ────────────────────────────────

/**
 * Resolve an audit field path like `gap_analysis.gaps[2]` or
 * `platforms.google.observable_unanswered_negative_reviews` against audit_data.
 * Returns the resolved value or undefined when any segment is missing.
 */
export function resolveAuditPath(auditData: any, path: string): unknown {
  if (!auditData || typeof path !== 'string' || !path.trim()) return undefined;
  const segments = path.split('.');
  let node: any = auditData;
  for (const segment of segments) {
    if (node === null || node === undefined) return undefined;
    const match = /^([^[\]]+)((\[\d+\])*)$/.exec(segment);
    if (!match) return undefined;
    node = node[match[1]];
    const indexes = (match[2].match(/\d+/g) ?? []).map(Number);
    for (const idx of indexes) {
      if (!Array.isArray(node) || idx >= node.length) return undefined;
      node = node[idx];
    }
  }
  return node;
}

// ─── Severity mapping ───────────────────────────────────────────────────

type BriefSeverity = 'high' | 'medium' | 'low';

function gapSeverityRank(severity: string | undefined): number {
  return severity === 'non_negotiable' ? 0 : 2;
}

const severityFromRank = (rank: number): BriefSeverity =>
  rank <= 1 ? 'high' : rank === 2 ? 'medium' : 'low';

// ─── Types ──────────────────────────────────────────────────────────────

export interface AssembledPain {
  ref_id: string;
  severity: BriefSeverity;
  business_consequence: string;
  evidence_ref: string;
  supporting_refs?: string[];
  confidence: 'verified_on_surface' | 'inferred' | 'verify_with_owner';
  visibility: 'internal' | 'client_safe' | 'public_safe';
  source_fragment: string;
  domain: PainDomain;
  /** Spoken lines carried verbatim from outreach_problems — the operator's
   *  cold-call copy, preserved through consolidation (not model-authored). */
  regular?: string;
  hook?: string;
  fix?: string;
  /** The audit's evidence citation text (outreach_problems.evidence). */
  evidence?: string;
  outreach_use?: string;
  reconciliation_notes?: string[];
}

export interface AssembledAsset {
  ref_id: string;
  asset: string;
  underexposure: boolean;
  how_to_use: string;
  evidence_ref: string;
  supporting_refs?: string[];
  confidence: 'verified_on_surface' | 'inferred' | 'verify_with_owner';
  visibility: 'internal' | 'client_safe' | 'public_safe';
  source_fragment: string;
  domain: PainDomain;
}

export interface AssembledCapabilityFit {
  capability: string;
  addresses_ref: string;
  why_it_fits: string;
  confidence: 'high' | 'medium' | 'low';
  visibility: 'internal' | 'client_safe' | 'public_safe';
  source_fragment: string;
  domain: PainDomain;
}

export interface AssembledGate {
  gate: string;
  blocks: string;
  who_can_answer: 'owner' | 'operator' | 'public_source';
  visibility: 'internal' | 'client_safe' | 'public_safe';
  source_fragment: string;
  status: 'pending' | 'answered' | 'needs_reconfirmation' | 'skipped';
  resolution_note?: string;
}

export interface AssembledBrief {
  assembly: 'deterministic' | 'hybrid' | 'model';
  staleness: 'current' | 'stale';
  evidence_fingerprint: string | null;
  business: { name?: string; category?: string; store_format?: string };
  evidence_index: Record<string, string>;
  pains: AssembledPain[];
  assets: AssembledAsset[];
  capability_fits: AssembledCapabilityFit[];
  verification_gates: AssembledGate[];
  engagement_shape: {
    primary_hook_ref: string | null;
    lead_with: 'pain' | 'asset';
    do_not_claim: string[];
  };
  /** The audit's benefits lines — the upside counterpart, folded verbatim so
   *  benefit consumers can read the spine instead of audit_data. */
  benefits: string[];
  /** Assembly diagnostics — what was folded, merged, or left uncovered.
   *  Not operator copy; provenance for the deterministic layer. */
  assembly_notes: {
    merged_outreach_problems: number;
    standalone_theme_pains: number;
    uncovered_slots: string[];
  };
}

// ─── Assembler ──────────────────────────────────────────────────────────

interface PainSeed {
  source: 'gap' | 'outreach_problem' | 'theme';
  sourceIndex: number;
  severityRank: number; // 0 non_negotiable, 1 theme-backed, 2 recommended, 3 other
  outreachIndex: number | null; // index into outreach_problems when merged/derived
  domain: PainDomain;
  consequence: string;
  fragment: string;
  supportingFragments: string[];
  confidence: AssembledPain['confidence'];
  regular?: string;
  hook?: string;
  fix?: string;
  evidence?: string;
  outreachUse?: string;
  notes: string[];
}

function overlapTokens(text: string): Set<string> {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

/** Token match with singular/plural tolerance — 'listing' matches
 *  'listings', 'review' matches 'reviews' (4+ char prefix in either
 *  direction). Guarded by length so 'nap' can't prefix-match 'name'. */
function tokensOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) {
    if (b.has(t)) return true;
    if (t.length < 4) continue;
    for (const u of b) {
      if (u.length >= 4 && (u.startsWith(t) || t.startsWith(u))) return true;
    }
  }
  return false;
}

/**
 * Fold a business_analysis audit_data payload into the spine. Pure and
 * deterministic — same audit in, same spine out. Re-runnable on every audit
 * import for free (D7 Layer A/B).
 */
export function assembleEngagementBrief(auditData: any): AssembledBrief {
  const audit = auditData ?? {};
  const gaps: any[] = Array.isArray(audit.gap_analysis?.gaps) ? audit.gap_analysis.gaps : [];
  const outreachProblems: any[] = Array.isArray(audit.outreach_problems) ? audit.outreach_problems : [];
  const themes: any[] = Array.isArray(audit.negative_review_themes) ? audit.negative_review_themes : [];
  const observedAssets: any[] = Array.isArray(audit.observed_assets) ? audit.observed_assets : [];
  const opportunities: any[] = Array.isArray(audit.market_opportunities) ? audit.market_opportunities : [];
  const services: string[] = Array.isArray(audit.recommended_services) ? audit.recommended_services : [];
  const attributes: any[] = Array.isArray(audit.recommended_attributes) ? audit.recommended_attributes : [];
  const dataQuality = audit.data_quality ?? {};
  const unavailableFields: string[] = Array.isArray(dataQuality.unavailable_fields)
    ? dataQuality.unavailable_fields
    : [];
  const conflicts: string[] = Array.isArray(dataQuality.conflicts) ? dataQuality.conflicts : [];
  const limitations: string[] = Array.isArray(dataQuality.limitations) ? dataQuality.limitations : [];
  const detectedSignals: string[] = Array.isArray(audit.detected_signals) ? audit.detected_signals : [];

  const signalled = signalDomains(detectedSignals);
  const hasThemes = themes.length > 0;
  const evidenceIndex: Record<string, string> = {};
  const notes: string[] = [];
  const uncoveredSlots: string[] = [];

  // ── Pains: gaps + outreach_problems, merged on domain+token overlap ────

  const seeds: PainSeed[] = [];
  const gapSeeds: PainSeed[] = gaps.map((gap, i) => ({
    source: 'gap',
    sourceIndex: i,
    severityRank: gapSeverityRank(gap.severity),
    outreachIndex: null,
    domain: classifyDomain(`${gap.field ?? ''} ${gap.gap_description ?? ''} ${gap.platform ?? ''}`),
    consequence:
      gap.gap_description ||
      `${gap.field ?? 'field'} differs from the gold-standard expectation`,
    fragment: `gap_analysis.gaps[${i}]`,
    supportingFragments: [],
    confidence: gap.actual === null || gap.actual === undefined ? 'verify_with_owner' : 'verified_on_surface',
    notes: [],
  }));

  let mergedCount = 0;
  const usedGapIndexes = new Set<number>();

  for (let i = 0; i < outreachProblems.length; i++) {
    const op = outreachProblems[i];
    const opText = `${op.problem ?? ''} ${op.evidence ?? ''}`;
    const opDomain = classifyDomain(opText);
    const opTokens = overlapTokens(opText);

    // Merge into a gap seed when same domain AND the gap's field tokens
    // appear in the problem/evidence text (the two fragments describe the
    // same defect — one pain row, both provenance paths).
    let mergedInto: PainSeed | null = null;
    for (const gs of gapSeeds) {
      if (usedGapIndexes.has(gs.sourceIndex)) continue;
      if (gs.domain !== opDomain || opDomain === 'other') continue;
      const fieldTokens = overlapTokens(gaps[gs.sourceIndex]?.field ?? '');
      if (tokensOverlap(fieldTokens, opTokens)) {
        mergedInto = gs;
        break;
      }
    }

    if (mergedInto) {
      usedGapIndexes.add(mergedInto.sourceIndex);
      mergedInto.outreachIndex = i;
      mergedInto.supportingFragments.push(`outreach_problems[${i}]`);
      // The outreach problem's `problem` is the consequence phrased for a
      // human — prefer it over the gap's field-level description.
      mergedInto.consequence = op.problem ?? mergedInto.consequence;
      mergedInto.regular = op.regular;
      mergedInto.hook = op.hook;
      mergedInto.fix = op.solution;
      mergedInto.evidence = op.evidence;
      mergedInto.outreachUse = op.outreach_use;
      // outreach_problems[0] is the audit's declared top problem — the pain
      // it backs ranks with the non_negotiable tier regardless of the gap's
      // own severity (D2: the audit's ranked judgment anchors the ordering).
      if (i === 0 && mergedInto.severityRank > 0) {
        mergedInto.severityRank = 0;
        mergedInto.notes.push(
          `outreach_problems[0] (the audit's top-ranked problem) lifts this pain into the top tier`,
        );
      }
      mergedCount++;
    } else {
      seeds.push({
        source: 'outreach_problem',
        sourceIndex: i,
        // outreach_problems[0] is the audit's top-ranked problem — top tier;
        // the rest sit with recommended-severity items, still ordered by
        // the audit's own index.
        severityRank: i === 0 ? 0 : 2,
        outreachIndex: i,
        domain: opDomain,
        consequence: op.problem ?? 'unclassified problem',
        fragment: `outreach_problems[${i}]`,
        supportingFragments: [],
        confidence: 'verified_on_surface',
        regular: op.regular,
        hook: op.hook,
        fix: op.solution,
        evidence: op.evidence,
        outreachUse: op.outreach_use,
        notes: [],
      });
    }
  }

  // ALL gap seeds are pain rows — merged ones carry the outreach problem's
  // consequence/spoken lines plus both provenance paths; usedGapIndexes only
  // prevents a second outreach problem merging into the same gap.
  seeds.push(...gapSeeds);

  // Negative-review themes: fold into an existing review-domain pain as
  // backing; standalone theme pains only when no review pain exists (the
  // theme is then itself the customer-facing risk).
  let standaloneThemes = 0;
  const reviewPain = seeds.find((s) => s.domain === 'review');
  if (hasThemes && reviewPain) {
    themes.forEach((t, k) => {
      reviewPain.supportingFragments.push(`negative_review_themes[${k}]`);
    });
    if (reviewPain.severityRank > 1) reviewPain.severityRank = 1;
  } else {
    themes.forEach((theme, k) => {
      seeds.push({
        source: 'theme',
        sourceIndex: k,
        severityRank: 1, // negative-theme-backed tier
        outreachIndex: null,
        domain: 'review',
        consequence:
          theme.summary ||
          `recurring review theme: ${theme.theme ?? 'unspecified'}`,
        fragment: `negative_review_themes[${k}]`,
        supportingFragments: [],
        confidence: 'verified_on_surface',
        notes: [],
      });
      standaloneThemes++;
    });
  }

  // Reconcile: stable sort by [tier, outreach index, gap index, emission order].
  const orderedSeeds = seeds
    .map((seed, order) => ({ seed, order }))
    .sort(
      (a, b) =>
        a.seed.severityRank - b.seed.severityRank ||
        (a.seed.outreachIndex ?? Infinity) - (b.seed.outreachIndex ?? Infinity) ||
        (a.seed.source === 'gap' ? a.seed.sourceIndex : Infinity) -
          (b.seed.source === 'gap' ? b.seed.sourceIndex : Infinity) ||
        a.order - b.order,
    );

  const pains: AssembledPain[] = orderedSeeds.map(({ seed }, i) => {
    const refId = `p${i + 1}`;
    evidenceIndex[refId] = seed.fragment;
    const supportingRefs = seed.supportingFragments.map((frag, j) => {
      const sref = `${refId}s${j + 1}`;
      evidenceIndex[sref] = frag;
      return sref;
    });
    return {
      ref_id: refId,
      severity: severityFromRank(seed.severityRank),
      business_consequence: seed.consequence,
      evidence_ref: refId,
      supporting_refs: supportingRefs.length ? supportingRefs : undefined,
      confidence: seed.confidence,
      visibility: 'client_safe',
      source_fragment: seed.fragment,
      domain: seed.domain,
      regular: seed.regular,
      hook: seed.hook,
      fix: seed.fix,
      evidence: seed.evidence,
      outreach_use: seed.outreachUse,
      reconciliation_notes: seed.notes.length ? seed.notes : undefined,
    };
  });

  // ── Assets: observed_assets, verified first then underexposed ──────────

  const assetConfidenceRank = (c: string | undefined): number =>
    c === 'verified_on_surface' ? 0 : c === 'inferred' ? 1 : 2;
  const assets: AssembledAsset[] = observedAssets
    .map((asset, index) => ({ asset, index }))
    .sort(
      (a, b) =>
        assetConfidenceRank(a.asset.confidence) - assetConfidenceRank(b.asset.confidence) ||
        (b.asset.underexposed ? 1 : 0) - (a.asset.underexposed ? 1 : 0) ||
        a.index - b.index,
    )
    .map(({ asset }, i) => {
      const refId = `a${i + 1}`;
      const fragment = `observed_assets[${observedAssets.indexOf(asset)}]`;
      evidenceIndex[refId] = fragment;
      const confidence = (asset.confidence as AssembledAsset['confidence']) ?? 'inferred';
      return {
        ref_id: refId,
        asset: asset.asset ?? 'unnamed asset',
        underexposure: asset.underexposed === true,
        how_to_use:
          confidence !== 'verified_on_surface'
            ? 'leave alone until verified'
            : asset.underexposed
              ? 'leverage it'
              : 'lead with it',
        evidence_ref: refId,
        confidence,
        visibility: 'client_safe',
        source_fragment: fragment,
        domain: classifyDomain(`${asset.asset ?? ''} ${asset.evidence ?? ''} ${asset.observed_on ?? ''}`),
      };
    });

  // ── Capability fits: opportunities + services + enableable attributes ──

  const painDomainIndex = new Map<PainDomain, string>();
  for (const p of pains) if (!painDomainIndex.has(p.domain)) painDomainIndex.set(p.domain, p.ref_id);
  const addressesFor = (domain: PainDomain): string =>
    painDomainIndex.get(domain) ??
    pains[0]?.ref_id ??
    assets[0]?.ref_id ??
    'engagement_shape';

  const impactConfidence = (impact: string | undefined): AssembledCapabilityFit['confidence'] =>
    impact === 'HIGH' ? 'high' : impact === 'MEDIUM' ? 'medium' : 'low';

  const capabilityFits: AssembledCapabilityFit[] = [];
  opportunities.forEach((opp, i) => {
    const domain = classifyDomain(`${opp.title ?? ''} ${opp.description ?? ''}`);
    capabilityFits.push({
      capability: opp.title ?? 'unclassified opportunity',
      addresses_ref: addressesFor(domain),
      why_it_fits: opp.description ?? 'market opportunity identified in the source audit',
      confidence: impactConfidence(opp.impact),
      visibility: 'client_safe',
      source_fragment: `market_opportunities[${i}]`,
      domain,
    });
  });
  services.forEach((service, i) => {
    const domain = classifyDomain(service);
    capabilityFits.push({
      capability: service,
      addresses_ref: addressesFor(domain),
      why_it_fits: 'recommended service in the source audit',
      confidence: 'medium',
      visibility: 'client_safe',
      source_fragment: `recommended_services[${i}]`,
      domain,
    });
  });
  attributes.forEach((attr, i) => {
    if (attr.current_state !== 'not_observed') return; // verify_* states are gates
    const domain = classifyDomain(`${attr.label ?? ''} ${attr.platform ?? ''}`);
    capabilityFits.push({
      capability: `attribute: ${attr.label ?? attr.key ?? 'unnamed'}`,
      addresses_ref: addressesFor(domain),
      why_it_fits: attr.rationale ?? 'recommended attribute — enableable on the observed surface',
      confidence: 'medium',
      visibility: 'client_safe',
      source_fragment: `recommended_attributes[${i}]`,
      domain,
    });
  });
  capabilityFits.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return rank[a.confidence] - rank[b.confidence];
  });

  // ── Verification gates: unavailable fields, conflicts, verify_* attrs ──

  const gates: AssembledGate[] = [];
  const gateBlockFor = (domain: PainDomain): string => addressesFor(domain);
  attributes.forEach((attr, i) => {
    const domain = classifyDomain(`${attr.label ?? ''} ${attr.platform ?? ''}`);
    if (attr.current_state === 'verify_with_owner') {
      gates.push({
        gate: `Confirm ${attr.label ?? attr.key ?? 'attribute'} status${attr.platform ? ` on ${attr.platform}` : ''} — owner-confirmable fact, not publicly verifiable`,
        blocks: gateBlockFor(domain),
        who_can_answer: 'owner',
        visibility: 'internal',
        source_fragment: `recommended_attributes[${i}]`,
        status: 'pending',
      });
    } else if (attr.current_state === 'unverifiable') {
      gates.push({
        gate: `Re-check ${attr.label ?? attr.key ?? 'attribute'}${attr.platform ? ` on ${attr.platform}` : ''} — the surface could not be fully rendered`,
        blocks: gateBlockFor(domain),
        who_can_answer: 'public_source',
        visibility: 'internal',
        source_fragment: `recommended_attributes[${i}]`,
        status: 'pending',
      });
    }
  });
  unavailableFields.forEach((field, i) => {
    const domain = classifyDomain(field);
    gates.push({
      gate: `Measure ${field} — unavailable in the source audit`,
      blocks: gateBlockFor(domain),
      who_can_answer: 'operator',
      visibility: 'internal',
      source_fragment: `data_quality.unavailable_fields[${i}]`,
      status: 'pending',
    });
  });
  conflicts.forEach((conflict, i) => {
    const domain = classifyDomain(conflict);
    gates.push({
      gate: `Resolve conflicting evidence: ${conflict}`,
      blocks: gateBlockFor(domain),
      who_can_answer: 'owner',
      visibility: 'internal',
      source_fragment: `data_quality.conflicts[${i}]`,
      status: 'pending',
    });
  });
  if (detectedSignals.includes('DS_CLAIMED_STATUS')) {
    gates.push({
      gate: 'Confirm the Google Business Profile claim/management state — claim state is not publicly verifiable',
      blocks: pains[0]?.ref_id ?? 'engagement_shape',
      who_can_answer: 'owner',
      visibility: 'internal',
      source_fragment: 'detected_signals',
      status: 'pending',
    });
  }
  // Operator-clearable gates first — the owner call shouldn't burn questions
  // on things the operator can check on a public surface.
  const whoRank = { operator: 0, public_source: 1, owner: 2 } as const;
  gates.sort((a, b) => whoRank[a.who_can_answer] - whoRank[b.who_can_answer]);

  // ── do_not_claim — mechanical guardrails from data_quality ────────────
  // These are the seed rules code can defend; Layer C may refine phrasing.

  const doNotClaim: string[] = [];
  unavailableFields.forEach((field) => {
    doNotClaim.push(`Do not claim ${field} — it was not measured in the source audit.`);
  });
  conflicts.forEach((conflict) => {
    doNotClaim.push(`Do not state "${conflict}" as resolved — the audit records conflicting evidence.`);
  });
  if (hasThemes) {
    doNotClaim.push(
      'Do not state customer review allegations as established facts — represent them as review allegations.',
    );
  }
  if (audit.combined_review_metrics) {
    doNotClaim.push(
      'Do not generalize observable-sample review rates (latest-N corpus) to the business\u2019s full review history.',
    );
  }
  if (limitations.some((l) => /403|gated|syndicat|could not render|render/i.test(l))) {
    doNotClaim.push(
      'Do not present syndicated or gated-platform metrics as freshly rendered live data.',
    );
  }

  // ── Engagement shape + coverage notes ─────────────────────────────────

  if (pains.length === 0) uncoveredSlots.push('pains');
  if (capabilityFits.length === 0) uncoveredSlots.push('capability_fits');
  const consequenceThin = pains.filter(
    (p) => !p.regular && !p.hook && p.business_consequence.length < 30,
  );
  if (consequenceThin.length > 0) {
    uncoveredSlots.push(`business_consequence(${consequenceThin.map((p) => p.ref_id).join(',')})`);
  }

  return {
    assembly: 'deterministic',
    staleness: 'current',
    evidence_fingerprint: computeEvidenceFingerprint(audit),
    business: {
      name: audit.business?.name ?? audit.business_identity?.name,
      category: audit.business?.category ?? audit.business_identity?.category,
      store_format: audit.business?.store_format ?? audit.business_identity?.store_format,
    },
    evidence_index: evidenceIndex,
    pains,
    assets,
    capability_fits: capabilityFits,
    verification_gates: gates,
    engagement_shape: {
      primary_hook_ref: pains[0]?.ref_id ?? null,
      lead_with: pains.length > 0 ? 'pain' : 'asset',
      do_not_claim: doNotClaim,
    },
    benefits: Array.isArray(audit.benefits)
      ? audit.benefits.filter((b: any): b is string => typeof b === 'string' && !!b.trim())
      : [],
    assembly_notes: {
      merged_outreach_problems: mergedCount,
      standalone_theme_pains: standaloneThemes,
      uncovered_slots: uncoveredSlots,
    },
  };
}

/**
 * Layer-C spend gate (D7): model synthesis is reserved for slots the
 * deterministic fold could not cover AND only when the audit flags
 * high_attention (or the operator explicitly refreshes, which callers pass
 * as `operatorRequested`). Everything else is free — the fold re-runs.
 */
export function needsSynthesisOverlay(
  auditData: any,
  assembled: { assembly_notes?: { uncovered_slots?: string[] } },
  operatorRequested = false,
): boolean {
  const uncovered = assembled.assembly_notes?.uncovered_slots?.length ?? 0;
  return uncovered > 0 && (auditData?.high_attention === true || operatorRequested);
}
