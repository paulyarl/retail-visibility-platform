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
  conflictWeight: number;
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
  /** True only in the 'ready' band. */
  pushRecommended: boolean;
  vetoes: IdentityVeto[];
  qcSignals: IdentityQcSignal[];
  fields: FieldScore[];
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

const MISSING_IMPORTANT_PENALTY = 10;

const READY_IDENTITY_THRESHOLD = 80;
const READY_OPERATIONAL_THRESHOLD = 70;
const REVIEW_IDENTITY_THRESHOLD = 50;

// ─── Field scoring ───────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Score one field from its source evidence.
 *
 * effectiveWeight = tierWeight × (first-in-group ? 1 : INDEPENDENCE_DISCOUNT)
 * purity    = agreementWeight / (agreementWeight + conflictWeight)
 * magnitude = min(1, agreementWeight / MAGNITUDE_CAP)
 * score     = round(100 × purity × magnitude)
 */
export function scoreField(ev: IdentityFieldEvidence): FieldScore {
  const seenGroups = new Set<string>();
  let agreementWeight = 0;
  let conflictWeight = 0;
  let independentSources = 0;

  for (const s of ev.sources) {
    const base = TIER_WEIGHT[s.tier] ?? 0.5;
    const isFirst = !seenGroups.has(s.independenceGroup);
    if (isFirst) seenGroups.add(s.independenceGroup);
    const effective = base * (isFirst ? 1 : INDEPENDENCE_DISCOUNT);
    if (s.agrees) {
      agreementWeight += effective;
      if (isFirst) independentSources += 1;
    } else {
      conflictWeight += effective;
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
    } else if (f.conflictWeight > 0) {
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

  if (operationalScore < READY_OPERATIONAL_THRESHOLD) {
    signals.push({
      code: 'low_operational_recency',
      severity: 'warn',
      message: 'No recent activity evidence — consider a verification call before seeding.',
    });
  }

  const corroborating = fields.filter((f) => f.independentSources > 0);
  const hasAuthoritative = corroborating.some((f) =>
    f.sources.some((s) => s.agrees && (s.tier === 'authoritative' || s.tier === 'first_party')),
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

  let band: RecommendationBand;
  if (vetoes.length > 0) {
    band = 'blocked';
  } else if (
    identityScore >= READY_IDENTITY_THRESHOLD &&
    operationalScore >= READY_OPERATIONAL_THRESHOLD
  ) {
    band = 'ready';
  } else if (identityScore >= REVIEW_IDENTITY_THRESHOLD) {
    band = 'review';
  } else {
    band = 'blocked';
  }

  return {
    identityScore,
    operationalScore,
    band,
    pushRecommended: band === 'ready',
    vetoes,
    qcSignals,
    fields,
  };
}
