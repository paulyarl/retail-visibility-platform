/**
 * identityScoring — pure, deterministic identity-packet scoring for directory
 * presence seeds.
 *
 * No LLM, no network, no Prisma. Input is an explicit evidence model (one
 * entry per source, with the fields it corroborates and whether it agrees with
 * the resolved consensus value). Output is per-field scores, an aggregate
 * identity score, a SEPARATE operational-recency score, hard vetoes, QC
 * signals, and a Push/Wait recommendation band.
 *
 * Design guardrails:
 *   1. Identity and operational recency are scored on separate axes. They
 *      answer different questions (who/where vs. alive now) and the seed gate
 *      requires both — collapsing them lets one failure hide behind the other.
 *   2. Sources are weighted by authority tier, then de-duplicated within an
 *      independence group, so aggregator echo (Manta/Yelp/BBB cross-copying)
 *      cannot inflate the score.
 *   3. Required fields aggregate by WEAKEST LINK, not mean — a strong name
 *      must not hide a bad address.
 *   4. Hard vetoes outrank any score. A threshold triggers the action; it
 *      never overrides a veto.
 *   5. The recommendation is advisory. The operator decides Push vs. Wait.
 */

import {
  AUTHORITY_CLASS_DIMENSION,
  EVIDENCE_DIMENSIONS,
  FIELD_DIMENSIONS,
  inferAuthorityClass,
  type AuthorityClass,
  type EvidenceDimension,
} from './evidenceDimensions';

// ─── Types ───────────────────────────────────────────────────────────────

/**
 * Source authority tier. Mirrors the source ledger vocabulary.
 *   - authoritative       SNAP retailer list, Secretary of State registration,
 *                         federal (SAM.gov), permits, owner-confirmed on a call
 *   - first_party         owner website / owner-supplied on a call
 *   - major_aggregator    Google Business Profile, Apple Maps
 *   - secondary_aggregator Yelp, BBB, Facebook, Manta
 *   - inferred            category-based inference (never counts for SNAP)
 */
export type IdentitySourceTier =
  | 'authoritative'
  | 'first_party'
  | 'major_aggregator'
  | 'secondary_aggregator'
  | 'inferred';

/** Identity field keys carried on the packet. */
export type IdentityFieldKey =
  | 'name'
  | 'address'
  | 'phone'
  | 'website'
  | 'hours'
  | 'primary_category'
  | 'snap_ebt'
  | 'attributes';

/** The 9-state evidence taxonomy (migration 271). */
export type IdentityEvidenceState =
  | 'confirmed'
  | 'observed'
  | 'probable'
  | 'conflicting'
  | 'not_found_during_discovery'
  | 'not_checked'
  | 'owner_confirmed'
  | 'owner_corrected'
  | 'owner_disputed';

/**
 * Runtime value sets for the three identity enums. These are the single source
 * of truth for route validation (zod) and for the CHECK constraints on
 * mkt_identity_evidence (migration 297) — the parity test in
 * __tests__/IdentityEvidenceService.test.ts parses the effective CHECK sets
 * from database/migrations and asserts they match these arrays.
 */
export const IDENTITY_SOURCE_TIERS: readonly IdentitySourceTier[] = [
  'authoritative',
  'first_party',
  'major_aggregator',
  'secondary_aggregator',
  'inferred',
];

export const IDENTITY_EVIDENCE_STATES: readonly IdentityEvidenceState[] = [
  'confirmed',
  'observed',
  'probable',
  'conflicting',
  'not_found_during_discovery',
  'not_checked',
  'owner_confirmed',
  'owner_corrected',
  'owner_disputed',
];

export const IDENTITY_FIELD_KEYS: readonly IdentityFieldKey[] = [
  'name',
  'address',
  'phone',
  'website',
  'hours',
  'primary_category',
  'snap_ebt',
  'attributes',
];

export function isIdentitySourceTier(value: unknown): value is IdentitySourceTier {
  return IDENTITY_SOURCE_TIERS.includes(value as IdentitySourceTier);
}

export function isIdentityEvidenceState(value: unknown): value is IdentityEvidenceState {
  return IDENTITY_EVIDENCE_STATES.includes(value as IdentityEvidenceState);
}

/**
 * Evidence states that assert a DISAGREEMENT with the resolved value rather
 * than corroboration. Operator evidence is not unconditionally agreeing — an
 * `owner_disputed` / `conflicting` row disputes the canonical, so it must count
 * as a disagreement (this is what replaces the old `agrees: true` hardcode).
 */
const DISPUTING_EVIDENCE_STATES: readonly IdentityEvidenceState[] = ['owner_disputed', 'conflicting'];

export function evidenceStateDisputes(state?: IdentityEvidenceState | null): boolean {
  return state != null && DISPUTING_EVIDENCE_STATES.includes(state);
}

export function isIdentityFieldKey(value: unknown): value is IdentityFieldKey {
  return IDENTITY_FIELD_KEYS.includes(value as IdentityFieldKey);
}

/**
 * Canonical independence groups for the platforms the business audit reads
 * directly (PLATFORM_SOURCES keys in IdentityPacketService). Mapping a source
 * NAME onto these keys is what makes a hand-entered "Google Business Profile"
 * discount against the audit's own Google block instead of double-counting the
 * same platform — the two must land in one group.
 */
const PLATFORM_GROUPS: Array<[RegExp, string]> = [
  [/\bgoogle\b|\bgmb\b|g\.page/, 'google'],
  [/\bapple\b|apple maps/, 'apple'],
  [/\byelp\b/, 'yelp'],
  [/\bfacebook\b|\bfb\b|\bmeta\b/, 'facebook'],
  [/\bbbb\b|better business bureau/, 'bbb'],
];

/**
 * Slug used to group a source name into its independence group, so two
 * spellings of the same platform ("Google" / "Google Business Profile")
 * discount against each other instead of double-counting.
 */
export function sourceGroupSlug(name: string): string {
  const raw = String(name || '').toLowerCase();
  for (const [pattern, group] of PLATFORM_GROUPS) {
    if (pattern.test(raw)) return group;
  }
  return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Infer a source tier from its name. Defaults to secondary_aggregator so an
 * unrecognized source can never inflate the score.
 */
export function inferSourceTier(name: string): IdentitySourceTier {
  const s = String(name || '').toLowerCase();
  if (/secretary of state|\bsos\b|\bso?s\b|business registration|registry|sam\.gov|federal|usda|snap retailer|\bstate\b|license|permit/.test(s)) {
    return 'authoritative';
  }
  // The business's own site (audit slug `official_website`, or a human spelling)
  // is first-party evidence — it must not fall through to the aggregator
  // default, which understates the record and mislabels the ledger tier.
  if (/official[_\s]website|owner[_\s]website|first.?party|\bwebsite\b/.test(s)) return 'first_party';
  // Substring (not word-boundary) match: the audit emits `apple_maps`, where the
  // trailing underscore defeats `\bapple\b`.
  if (/google|gmb|g\.page|apple/.test(s)) return 'major_aggregator';
  return 'secondary_aggregator';
}

/** Operational status from the business audit. */
export type OperationalStatus = 'active' | 'likely_active' | 'inactive' | 'unable_to_verify';

/** Identity verdict from the business audit metadata. */
export type IdentityStatus = 'confirmed' | 'ambiguous' | 'mismatched';

/** One source's corroboration of a single field. */
export interface IdentitySourceRef {
  name: string;
  tier: IdentitySourceTier;
  /** Sources derived from one another share a group and are discounted. */
  independenceGroup: string;
  /** Whether this source agrees with the resolved consensus value. */
  agrees: boolean;
  evidenceState?: IdentityEvidenceState | null;
  url?: string | null;
  accessedAt?: string | null;
  /** True when an operator entered this source by hand (mkt_identity_evidence). */
  manual?: boolean;
  /**
   * Authority class — the eligibility axis. Decides which evidence dimension
   * this source may testify on (see evidenceDimensions.ts). Annotated by the
   * packet assembler; not yet consumed by scoring (sprint Phase 3).
   */
  authorityClass?: AuthorityClass | null;
  /** The dimension the class maps to; null for the owner axis. */
  dimension?: EvidenceDimension | null;
  /**
   * Signal weight — signal_weight(category, platform) ∈ [0,1] resolved from
   * the category's intelligence profile (sprint Phase 5). Scales this
   * source's contribution everywhere tier weight applies. Absent → treated
   * as 1, so an unweighted source (no profile, or no platform key) scores
   * exactly as before — legacy byte-identity.
   */
  signalWeight?: number | null;
}

/** All evidence for a single field, plus its resolved consensus value. */
export interface IdentityFieldEvidence {
  field: IdentityFieldKey;
  /** Resolved consensus value; null when no source produced one. */
  value: string | null;
  sources: IdentitySourceRef[];
}

export interface IdentityPacketInput {
  identityStatus: IdentityStatus;
  operationalStatus: OperationalStatus;
  /** Live call verdict on operating status (overrides the audit either way). */
  callConfirmed?: boolean | null;
  fields: IdentityFieldEvidence[];
  /** SNAP/EBT sourced from an allowed evidence source (never inferred). */
  snapSourced?: boolean;
}

export interface FieldScore {
  field: IdentityFieldKey;
  value: string | null;
  required: boolean;
  /** 0-100 */
  score: number;
  agreementWeight: number;
  /**
   * Weight of AUTHORITATIVE disagreement — a source whose dimension owns this
   * field (government/owner on a NAP field, trade on a category field)
   * disagreeing with the resolved value. Material: drives the veto.
   */
  conflictWeight: number;
  /**
   * Weight of CORROBORATOR disagreement — a NAP corroborator (directory/social)
   * disagreeing on a NAP field. NOT a conflict: a reportable, repairable signal
   * (NAP drift), never a veto. Excluded from the purity penalty.
   */
  driftWeight: number;
  /**
   * True when an operator-supplied AUTHORITY source (manual + owns this field's
   * dimension) agreed, so the field's authoritative disagreement was adjudicated
   * down to drift. The operator is a peer of the analyst: attributable evidence
   * unblocks (spec §2, "Operator judgment trust").
   */
  adjudicated: boolean;
  /** The operator source that adjudicated, when `adjudicated`. */
  adjudicatedBy: string | null;
  /** Independent corroborating sources (one per independence group). */
  independentSources: number;
  sources: IdentitySourceRef[];
}

export type RecommendationBand = 'ready' | 'review' | 'blocked';

export interface IdentityVeto {
  code: string;
  message: string;
}

export interface IdentityQcSignal {
  code: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
  field?: IdentityFieldKey;
}

export interface IdentityPacketScore {
  /** 0-100, weakest-link over required fields minus completeness penalty. */
  identityScore: number;
  /** 0-100, recency axis — kept separate from identityScore. */
  operationalScore: number;
  band: RecommendationBand;
  /** True only when the gate is not blocked. */
  pushRecommended: boolean;
  vetoes: IdentityVeto[];
  qcSignals: IdentityQcSignal[];
  fields: FieldScore[];
  /** The dimension gate — the seed decision (spec §2). */
  gate: SeedGate;
}

/** The seed gate verdict. */
export type SeedGateDecision = 'guaranteed' | 'earned' | 'rescued' | 'blocked';

export interface SeedGateDimension {
  dimension: EvidenceDimension;
  /** At least one agreeing source testifies on this dimension. */
  satisfied: boolean;
  /** Sum of distinct agreeing sources' tier weights on this dimension. */
  strength: number;
  /** Distinct agreeing sources (one per independence group). */
  sourceCount: number;
}

export interface SeedGate {
  dimensions: SeedGateDimension[];
  satisfiedCount: number;
  /** Sum of the four dimension strengths (presence + citations). */
  dimensionStrength: number;
  /**
   * Supporting-signal strength that is NOT a dimension — proven recent activity
   * (reviews / ratings / recent comments, via the operational recency axis).
   * Third-party sources may not be category-recognizable but are still signals.
   */
  supportingStrength: number;
  /** dimensionStrength + supportingStrength. */
  totalStrength: number;
  /** >= EARN_DIMENSION_COUNT dimensions satisfied. */
  earned: boolean;
  /** totalStrength >= GUARANTEE_STRENGTH_THRESHOLD — depth alone can seed. */
  guaranteed: boolean;
  /** An `owner_confirmed` capture is present and the gate is short of earning. */
  ownerOverRule: boolean;
  decision: SeedGateDecision;
  /** Machine-readable blockers (veto codes + prerequisites). */
  blockers: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────

const TIER_WEIGHT: Record<IdentitySourceTier, number> = {
  authoritative: 4,
  first_party: 3,
  major_aggregator: 2,
  secondary_aggregator: 1,
  inferred: 0.5,
};

/** Repeat members of an independence group count at this fraction. */
const INDEPENDENCE_DISCOUNT = 0.3;

/** Agreement weight at which a field reaches full magnitude. */
const MAGNITUDE_CAP = 4;

/** Hard-required fields — weakest-link drives the identity score. */
const REQUIRED_FIELDS: IdentityFieldKey[] = ['name', 'address'];

/** Important-but-not-required fields — missing ones penalize the score. */
const IMPORTANT_FIELDS: IdentityFieldKey[] = ['phone', 'website'];

/** NAP fields — a corroborator's disagreement on these is reportable drift. */
const NAP_FIELDS: IdentityFieldKey[] = ['name', 'address', 'phone', 'website'];

const MISSING_IMPORTANT_PENALTY = 10;

const READY_OPERATIONAL_THRESHOLD = 70;

/** Dimensions required to EARN a seed (spec §2). */
const EARN_DIMENSION_COUNT = 2;

/**
 * Total dimension strength required to GUARANTEE a seed. PROVISIONAL — this is
 * the single number to calibrate against a real sample (spec §10). Strength is
 * the sum of distinct agreeing sources' tier weights across the dimensions.
 *
 * At 2, a single major aggregator (Google / Apple = 2) or any authoritative
 * source (4) is enough to seed WITHOUT a second dimension — a strong single
 * signal must not be blocked for lack of breadth.
 */
const GUARANTEE_STRENGTH_THRESHOLD = 2;

// ─── Field scoring ───────────────────────────────────────────────────────

/**
 * A source's scoring weight: tier weight scaled by the resolved platform
 * signal weight. `signalWeight == null` → 1, so an unweighted source scores
 * exactly as it did before signal weight existed (legacy byte-identity).
 */
function sourceWeight(s: IdentitySourceRef): number {
  const w = s.signalWeight == null ? 1 : s.signalWeight;
  return (TIER_WEIGHT[s.tier] ?? 0.5) * w;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Whether a source is an AUTHORITY for a field — i.e. its evidence dimension
 * owns the field. Only an authority's disagreement is a conflict; every other
 * source is a NAP corroborator whose disagreement is drift (spec §2).
 *
 * The owner axis is always authoritative (it sits above the dimensions).
 * Unknown fields (no dimension entry) default to authoritative — conservative,
 * so an unrecognized field can still gate.
 */
function isFieldAuthority(s: IdentitySourceRef, fieldDims: readonly EvidenceDimension[]): boolean {
  if (fieldDims.length === 0) return true;
  const cls = s.authorityClass ?? inferAuthorityClass(s.name, s.tier);
  if (cls === 'owner') return true;
  const dim = AUTHORITY_CLASS_DIMENSION[cls];
  return dim != null && fieldDims.includes(dim);
}

/**
 * Score one field from its source evidence.
 *
 * effectiveWeight = tierWeight × (first-in-group ? 1 : INDEPENDENCE_DISCOUNT)
 * purity    = agreementWeight / (agreementWeight + conflictWeight)
 * magnitude = min(1, agreementWeight / MAGNITUDE_CAP)
 * score     = round(100 × purity × magnitude)
 *
 * A disagreement is bucketed by the source's standing on this field:
 *   - authority (owns the field's dimension) → conflictWeight (material)
 *   - corroborator (NAP corroborator)        → driftWeight   (signal, not veto)
 * Drift is deliberately excluded from purity: a stale aggregator value is a
 * repair opportunity, not a defect in the record we hold.
 */
export function scoreField(ev: IdentityFieldEvidence): FieldScore {
  const seenGroups = new Set<string>();
  let agreementWeight = 0;
  let conflictWeight = 0;
  let driftWeight = 0;
  let independentSources = 0;
  let adjudicated = false;

  const fieldDims = FIELD_DIMENSIONS[ev.field] ?? [];

  // An operator-supplied AUTHORITY on this field (manual + owns the dimension)
  // adjudicates the field's authoritative disagreement: attributable evidence
  // from a peer of the analyst resolves the discrepancy down to drift.
  const operatorAuthority = ev.sources.find(
    (s) => s.manual && s.agrees && isFieldAuthority(s, fieldDims),
  );

  for (const s of ev.sources) {
    const base = sourceWeight(s);
    const isFirst = !seenGroups.has(s.independenceGroup);
    if (isFirst) seenGroups.add(s.independenceGroup);
    const effective = base * (isFirst ? 1 : INDEPENDENCE_DISCOUNT);
    if (s.agrees) {
      agreementWeight += effective;
      if (isFirst) independentSources += 1;
    } else if (operatorAuthority) {
      driftWeight += effective;
      adjudicated = true;
    } else if (isFieldAuthority(s, fieldDims)) {
      conflictWeight += effective;
    } else {
      driftWeight += effective;
    }
  }

  const total = agreementWeight + conflictWeight;
  const purity = total > 0 ? agreementWeight / total : 0;
  const magnitude = Math.min(1, agreementWeight / MAGNITUDE_CAP);
  const hasValue = ev.value != null && String(ev.value).trim() !== '';
  const score = hasValue ? Math.round(100 * purity * magnitude) : 0;

  return {
    field: ev.field,
    value: ev.value,
    required: REQUIRED_FIELDS.includes(ev.field),
    score,
    agreementWeight: round2(agreementWeight),
    conflictWeight: round2(conflictWeight),
    driftWeight: round2(driftWeight),
    adjudicated,
    adjudicatedBy: adjudicated && operatorAuthority ? operatorAuthority.name : null,
    independentSources,
    sources: ev.sources,
  };
}

// ─── Operational recency ─────────────────────────────────────────────────

/**
 * Operational recency score, kept on its own axis.
 * A logged call verdict overrides the audit in either direction.
 */
export function scoreOperational(
  status: OperationalStatus,
  callConfirmed?: boolean | null,
): number {
  if (callConfirmed === true) return 100;
  if (callConfirmed === false) return 0;
  switch (status) {
    case 'active':
      return 100;
    case 'likely_active':
      return 70;
    case 'inactive':
    case 'unable_to_verify':
    default:
      return 0;
  }
}

// ─── Vetoes + QC signals ─────────────────────────────────────────────────

function collectVetoes(
  input: IdentityPacketInput,
  fields: FieldScore[],
): IdentityVeto[] {
  const vetoes: IdentityVeto[] = [];

  if (input.identityStatus === 'mismatched') {
    vetoes.push({
      code: 'identity_mismatch',
      message: 'Audit identity is mismatched — the record may describe a different business.',
    });
  }

  const byField = new Map(fields.map((f) => [f.field, f]));

  for (const key of REQUIRED_FIELDS) {
    const f = byField.get(key);
    if (!f || f.value == null || String(f.value).trim() === '') {
      vetoes.push({
        code: 'missing_required_field',
        message: `Required field "${key}" has no resolved value.`,
      });
    } else if (f.conflictWeight > 0 && f.conflictWeight >= f.agreementWeight) {
      // Signal-weight comparison, not an existence test (spec §2): an
      // authoritative disagreement vetoes only when its weighted influence
      // meets or beats the agreement — an outvoted conflict reports instead.
      vetoes.push({
        code: 'required_field_conflict',
        message: `Required field "${key}" has conflicting sources — resolve before seeding.`,
      });
    }
  }

  return vetoes;
}

function collectQcSignals(
  input: IdentityPacketInput,
  fields: FieldScore[],
  operationalScore: number,
): IdentityQcSignal[] {
  const signals: IdentityQcSignal[] = [];
  const byField = new Map(fields.map((f) => [f.field, f]));

  if (input.identityStatus === 'ambiguous') {
    signals.push({
      code: 'identity_ambiguous',
      severity: 'warn',
      message: 'Audit identity is ambiguous — verify NAP against a second source.',
    });
  }

  for (const key of IMPORTANT_FIELDS) {
    const f = byField.get(key);
    if (!f || f.value == null || String(f.value).trim() === '') {
      signals.push({
        code: `missing_${key}`,
        severity: 'warn',
        message: `No ${key} on record — consider capturing it on the next call.`,
        field: key,
      });
    }
  }

  const hours = byField.get('hours');
  if (!hours || hours.value == null || String(hours.value).trim() === '') {
    signals.push({
      code: 'missing_hours',
      severity: 'info',
      message: 'Hours unsourced — they will be omitted from the public listing.',
      field: 'hours',
    });
  }

  if (input.snapSourced === false && byField.get('snap_ebt')?.value) {
    signals.push({
      code: 'snap_unsourced',
      severity: 'info',
      message: 'SNAP/EBT present but not from an allowed evidence source — it will not render publicly.',
      field: 'snap_ebt',
    });
  }

  // NAP drift — a corroborating source (directory/social) disagrees with the
  // resolved NAP value. Reportable and repairable: a stale aggregator value is
  // a repair opportunity, not an identity conflict, so it never vetoes.
  for (const key of NAP_FIELDS) {
    const f = byField.get(key);
    if (f && f.driftWeight > 0) {
      signals.push({
        code: `nap_drift_${key}`,
        severity: 'info',
        message: `NAP drift on "${key}" — a corroborating source disagrees; reportable and repairable.`,
        field: key,
      });
    }
  }

  // Outvoted authoritative conflict — an authority disagreed on a required
  // field but its weighted influence fell below the agreement, so the veto
  // did not fire (spec §2). Reportable, not silent: the conflict still drags
  // the field score and stays visible for repair.
  for (const key of REQUIRED_FIELDS) {
    const f = byField.get(key);
    if (f && f.conflictWeight > 0 && f.conflictWeight < f.agreementWeight) {
      signals.push({
        code: `conflict_outvoted_${key}`,
        severity: 'info',
        message: `Authoritative disagreement on "${key}" was outvoted by stronger agreement — reportable, not blocking.`,
        field: key,
      });
    }
  }

  // Operator adjudication — an operator authority resolved an authoritative
  // disagreement on this field. Recorded with attribution, not silent.
  for (const key of NAP_FIELDS) {
    const f = byField.get(key);
    if (f && f.adjudicated) {
      signals.push({
        code: `conflict_adjudicated_${key}`,
        severity: 'info',
        message: `Conflict on "${key}" adjudicated by operator evidence${
          f.adjudicatedBy ? ` (${f.adjudicatedBy})` : ''
        }.`,
        field: key,
      });
    }
  }

  if (operationalScore < READY_OPERATIONAL_THRESHOLD) {
    signals.push({
      code: 'low_operational_recency',
      severity: 'warn',
      message: 'No recent activity evidence — consider a verification call before seeding.',
    });
  }

  const corroborating = fields.filter((f) => f.independentSources > 0);
  // Authority class is the standing axis — a government (registry) or owner
  // (first-party) source is what "authoritative" means here. Explicit classes
  // are honored; unlabeled sources infer (first_party→owner, authoritative→
  // government), which preserves the legacy tier semantics under inference.
  const hasAuthoritative = corroborating.some((f) =>
    f.sources.some((s) => {
      if (!s.agrees) return false;
      const cls = s.authorityClass ?? inferAuthorityClass(s.name, s.tier);
      return cls === 'government' || cls === 'owner';
    }),
  );
  if (corroborating.length > 0 && !hasAuthoritative) {
    signals.push({
      code: 'no_authoritative_source',
      severity: 'info',
      message: 'Only aggregator sources corroborate this record — no registry or first-party evidence.',
    });
  }

  return signals;
}

// ─── Dimension gate (spec §2) ────────────────────────────────────────────

/**
 * The dimension gate. A source testifies on its AUTHORITY CLASS dimension
 * (government → identity, directory/social → operational, trade → category,
 * community → location). The owner axis is NOT a dimension — an
 * `owner_confirmed` capture is the fifth axis that RESCUES a seed short of
 * earning.
 *
 *   earned      = >= 2 dimensions satisfied (breadth)
 *   guaranteed  = totalStrength >= GUARANTEE_STRENGTH_THRESHOLD (depth OR breadth
 *                 — a single high-signal platform presence is enough)
 *   rescued     = owner_confirmed AND not earned AND no veto
 *   blocked     = a veto, or none of the above
 *
 * Owner "rescues only what hasn't earned": it never overrides a hard veto or a
 * guaranteed seed.
 */
function scoreSeedGate(
  fields: FieldScore[],
  vetoes: IdentityVeto[],
  operationalScore: number,
): SeedGate {
  const strength: Record<EvidenceDimension, number> = {
    operational: 0,
    identity: 0,
    category: 0,
    location: 0,
  };
  const counts: Record<EvidenceDimension, number> = {
    operational: 0,
    identity: 0,
    category: 0,
    location: 0,
  };
  const seen: Record<EvidenceDimension, Set<string>> = {
    operational: new Set(),
    identity: new Set(),
    category: new Set(),
    location: new Set(),
  };
  let ownerConfirmed = false;

  for (const f of fields) {
    for (const s of f.sources) {
      if (!s.agrees) continue;
      const cls = s.authorityClass ?? inferAuthorityClass(s.name, s.tier);
      if (cls === 'owner') {
        // Owner is the fifth axis — rescue trigger, not a dimension.
        if (s.evidenceState === 'owner_confirmed') ownerConfirmed = true;
        continue;
      }
      const dim = s.dimension ?? AUTHORITY_CLASS_DIMENSION[cls];
      if (!dim) continue;
      if (seen[dim].has(s.independenceGroup)) continue;
      seen[dim].add(s.independenceGroup);
      strength[dim] += sourceWeight(s);
      counts[dim] += 1;
    }
  }

  const dimensions: SeedGateDimension[] = EVIDENCE_DIMENSIONS.map((dimension) => ({
    dimension,
    satisfied: counts[dimension] > 0,
    strength: round2(strength[dimension]),
    sourceCount: counts[dimension],
  }));

  const satisfiedCount = dimensions.filter((d) => d.satisfied).length;
  const dimensionStrength = round2(dimensions.reduce((sum, d) => sum + d.strength, 0));
  // Supporting signals that are not a dimension: proven recent activity
  // (reviews / ratings / recent comments feed the operational recency axis).
  // A third-party source may not be category-recognizable and still count.
  const supportingStrength = round2(operationalScore / 100);
  const totalStrength = round2(dimensionStrength + supportingStrength);

  const earned = satisfiedCount >= EARN_DIMENSION_COUNT;
  // Depth alone seeds — a single high-signal platform presence is enough,
  // regardless of activity (spec §2).
  const guaranteed = totalStrength >= GUARANTEE_STRENGTH_THRESHOLD;
  const vetoBlocked = vetoes.length > 0;
  const ownerOverRule = ownerConfirmed && !earned && !vetoBlocked && !guaranteed;

  const decision: SeedGateDecision = vetoBlocked
    ? 'blocked'
    : guaranteed
      ? 'guaranteed'
      : earned
        ? 'earned'
        : ownerOverRule
          ? 'rescued'
          : 'blocked';

  const blockers: string[] = vetoes.map((v) => v.code);
  if (decision === 'blocked' && satisfiedCount < EARN_DIMENSION_COUNT) {
    blockers.push('insufficient_dimensions');
  }

  return {
    dimensions,
    satisfiedCount,
    dimensionStrength,
    supportingStrength,
    totalStrength,
    earned,
    guaranteed,
    ownerOverRule,
    decision,
    blockers,
  };
}

// ─── Packet scoring ──────────────────────────────────────────────────────

/**
 * Score a full identity packet. Pure — same input always yields same output.
 */
export function scoreIdentityPacket(input: IdentityPacketInput): IdentityPacketScore {
  const fields = input.fields.map(scoreField);
  const byField = new Map(fields.map((f) => [f.field, f]));

  // Weakest-link over required fields, then a completeness penalty for
  // missing important fields. A missing required field scores 0 → identity 0.
  const requiredScores = REQUIRED_FIELDS.map((key) => byField.get(key)?.score ?? 0);
  const weakestRequired = requiredScores.length > 0 ? Math.min(...requiredScores) : 0;

  const missingImportant = IMPORTANT_FIELDS.filter((key) => {
    const f = byField.get(key);
    return !f || f.value == null || String(f.value).trim() === '';
  }).length;

  const identityScore = Math.max(
    0,
    Math.min(100, weakestRequired - missingImportant * MISSING_IMPORTANT_PENALTY),
  );

  const operationalScore = scoreOperational(input.operationalStatus, input.callConfirmed);

  const vetoes = collectVetoes(input, fields);
  const qcSignals = collectQcSignals(input, fields, operationalScore);
  const gate = scoreSeedGate(fields, vetoes, operationalScore);

  // The band is derived from the gate: guaranteed → ready, earned/rescued →
  // review (pushable, not guaranteed), blocked → blocked.
  const band: RecommendationBand =
    gate.decision === 'guaranteed' ? 'ready' : gate.decision === 'blocked' ? 'blocked' : 'review';

  return {
    identityScore,
    operationalScore,
    band,
    pushRecommended: gate.decision !== 'blocked',
    vetoes,
    qcSignals,
    fields,
    gate,
  };
}
