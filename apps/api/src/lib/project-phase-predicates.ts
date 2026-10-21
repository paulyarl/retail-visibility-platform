/**
 * project-phase-predicates — the v1 predicate seed data.
 *
 * Marketing Ops project-phase spec §5/§13: phase selection predicates are
 * versioned DATA in `mkt_project_phase_predicates`, not hardcoded per
 * archetype or prospect. The §5 trigger table is transcribed verbatim here
 * (the spec is the source of truth — edit the spec, then bump the version).
 *
 * This module is pure data + types — shared by the seed script
 * (`scripts/seed-project-phase-predicates.ts`), the coverage-invariant test
 * (spec 3.3: every KNOWN_SIGNAL_CODES entry is in a predicate or the
 * unmapped list), and the evaluator's test fixtures in Phase 4.
 *
 * Seed v1 notes (D10, spec §16.8): NO min_severity floors — every any_of
 * signal triggers its phase. Floors are a seed bump, not a code change.
 */

export const PROJECT_PHASE_PREDICATES_VERSION = 2;
export const PROJECT_PHASE_PREDICATES_SEED_MARKER =
  'project-phase-predicates-v2-presence-integrity';

export type ProjectPhaseKey =
  | 'foundation'
  | 'claim'
  | 'findability'
  | 'trust'
  | 'expansion';

/** Catalog order is dependency order (spec §6). */
export const PROJECT_PHASE_CATALOG_ORDER: readonly ProjectPhaseKey[] = [
  'foundation',
  'claim',
  'findability',
  'trust',
  'expansion',
];

export interface ProjectPhasePredicateSeed {
  phaseKey: ProjectPhaseKey;
  /** `any_of` trigger set — a matching signal includes the phase. */
  signals: string[];
  /** Per-signal severity floors — null in v1 (D10). */
  minSeverity: Record<string, string> | null;
  /**
   * INT_* discovery codes that may raise this phase's cap rank when an
   * audit-derived signal for the same gap is present (spec §5). Discovery
   * codes never trigger a phase.
   */
  intRankModifiers: string[];
  /** Copy keys — convention `project_phase.<phase_key>.<slot>` (spec §13). */
  copyKeys: Record<'name' | 'goal' | 'evidence' | 'actions' | 'exit_criterion', string>;
}

const copyKeys = (phaseKey: ProjectPhaseKey): ProjectPhasePredicateSeed['copyKeys'] => ({
  name: `project_phase.${phaseKey}.name`,
  goal: `project_phase.${phaseKey}.goal`,
  evidence: `project_phase.${phaseKey}.evidence`,
  actions: `project_phase.${phaseKey}.actions`,
  exit_criterion: `project_phase.${phaseKey}.exit_criterion`,
});

export const PROJECT_PHASE_PREDICATES_V1: readonly ProjectPhasePredicateSeed[] = [
  {
    phaseKey: 'foundation',
    signals: [
      'CP_NAP_NAME_DRIFT',
      'CP_NAP_ADDRESS_DRIFT',
      'CP_NAP_PHONE_DRIFT',
      'CP_MISSING_CONTACT_INFO',
      'DS_OUTDATED_HOURS',
      'DS_OUTDATED_HOLIDAY_HOURS',
      'DS_BROKEN_PROFILE_LINK',
    ],
    minSeverity: null,
    intRankModifiers: ['INT_SINGLE_SOURCE'],
    copyKeys: copyKeys('foundation'),
  },
  {
    phaseKey: 'claim',
    signals: ['DS_CLAIMED_STATUS'],
    minSeverity: null,
    intRankModifiers: [],
    copyKeys: copyKeys('claim'),
  },
  {
    phaseKey: 'findability',
    signals: [
      'WC_MISSING_WEBSITE',
      'WC_THIRD_PARTY_DOMAIN',
      'WC_BUILDER_SUBDOMAIN',
      'WC_PARKED_DOMAIN',
      'WC_DOMAIN_HIJACKED',
      'WC_UNFINISHED_SITE',
      'WC_BROKEN_WEBSITE',
      'WC_URL_MISMATCH',
      'WC_MISSING_PRODUCT_BROWSING',
      'DS_MISSING_PRODUCT_CATALOG',
      'DS_MISSING_PROFILE',
      'DS_MISSING_SERVICE_MENU',
      'DS_PHOTO_DEFICIT',
      'VP_MISSING_PRODUCT_PHOTOS',
      'VP_MISSING_STOREFRONT_PHOTOS',
      'VP_MISSING_PROJECT_PHOTOS',
    ],
    minSeverity: null,
    intRankModifiers: [
      'INT_LOW_VISIBILITY',
      'INT_WEAK_MAINSTREAM_INDEXING',
      'INT_POSSIBLE_CATEGORY_MISALIGNMENT',
      'INT_VERTICAL_SOURCE_DISCOVERY',
    ],
    copyKeys: copyKeys('findability'),
  },
  {
    phaseKey: 'trust',
    signals: [
      'RA_UNADDRESSED_NEGATIVE_BACKLOG',
      'RA_BBB_GRADE_SUPPRESSION',
      'RA_UNANSWERED_COMPLAINTS',
      'RA_REVIEW_DROUGHT',
      'RA_LOW_REVIEW_VOLUME',
    ],
    minSeverity: null,
    intRankModifiers: ['INT_HIDDEN_TRUST', 'INT_UNDEREXPOSED_CREDENTIAL'],
    copyKeys: copyKeys('trust'),
  },
  {
    phaseKey: 'expansion',
    // Spec §5 Expansion row — signal triggers only. The owner-requested
    // domain trigger is `operatorInputs.domainRequested` (input contract),
    // evaluated by the selector as an OR alongside this set.
    signals: [
      'WC_MISSING_CTA',
      'WC_MISSING_AVAILABILITY_INQUIRY',
      'WC_MISSING_PICKUP_DELIVERY',
      'WC_MISSING_SERVICE_PAGES',
      'WC_MOBILE_FRICTION',
      'WC_UNSECURED_WEBSITE',
      'WC_LEGACY_BUILDER_SITE',
      'WC_STALE_WEBSITE',
      'WC_POOR_SITE_QUALITY',
      'WC_CATEGORY_MISMATCH',
    ],
    minSeverity: null,
    intRankModifiers: [],
    copyKeys: copyKeys('expansion'),
  },
];

/**
 * Seed v2 — the PB-09 presence/integrity family joins the phases they belong
 * to (spec §5, revised). Migrations 334/336 registered seven codes that v1
 * never placed; the §3.3 coverage invariant caught it, exactly as designed
 * ("Any future admin-registered signal code is unmapped until added to the
 * predicate seed with a version bump").
 *
 *   foundation   DS_DUPLICATE_LISTING
 *                one business, two listings at one address — an identity /
 *                NAP-consistency defect, the phase's own subject.
 *   claim        DS_HIJACKED_LISTING, DS_OWNERSHIP_DISPUTE,
 *                DS_ADDRESS_VERIFICATION_BLOCK
 *                all three are about who controls (or can prove they control)
 *                the profile — the claim phase's subject.
 *   findability  DS_ZERO_INDEXED_PRESENCE, DS_PROFILE_NOT_PUBLIC,
 *                DS_PROFILE_SUSPENDED
 *                the profile is absent, hidden, or not surfacing — the same
 *                discovery loss `DS_MISSING_PROFILE` already carries here.
 *
 * v1 stays exported: a plan's `predicateSeedVersion` is reproducible
 * provenance, and the DB keeps the v1 rows.
 */
const V2_ADDITIONS: Partial<Record<ProjectPhaseKey, string[]>> = {
  foundation: ['DS_DUPLICATE_LISTING'],
  claim: [
    'DS_HIJACKED_LISTING',
    'DS_OWNERSHIP_DISPUTE',
    'DS_ADDRESS_VERIFICATION_BLOCK',
  ],
  findability: [
    'DS_ZERO_INDEXED_PRESENCE',
    'DS_PROFILE_NOT_PUBLIC',
    'DS_PROFILE_SUSPENDED',
  ],
};

export const PROJECT_PHASE_PREDICATES_V2: readonly ProjectPhasePredicateSeed[] =
  PROJECT_PHASE_PREDICATES_V1.map((row) => ({
    ...row,
    signals: [...row.signals, ...(V2_ADDITIONS[row.phaseKey] ?? [])],
  }));

/** The version currently in force — what an unseeded environment falls back to. */
export const PROJECT_PHASE_PREDICATES_CURRENT = PROJECT_PHASE_PREDICATES_V2;

/**
 * Explicitly unmapped codes — never trigger a phase (spec §5):
 *   - `OX_*` outreach-state codes are stripped before selection.
 *   - `VP_STALE_SOCIAL_ACTIVITY` — social cadence is retainer-marketing, not
 *     a project phase.
 *   - `RA_UNADDRESSED_POSITIVE_BACKLOG` — positive-only backlog is review
 *     hygiene, not a reputation-repair project (Trust excludes it).
 * Any future admin-registered code is unmapped until a predicate version
 * adds it — the coverage invariant (3.3) is the tripwire.
 */
export const PHASE_PREDICATE_UNMAPPED_SIGNALS: readonly string[] = [
  'OX_OPENER_SENT',
  'OX_FOLLOWUP_SENT',
  'OX_PITCH_ASSEMBLED',
  'OX_NO_REPLY_AFTER_OPENER',
  'OX_NO_REPLY_AFTER_FOLLOWUP_N',
  'OX_CONTACT_LOGGED',
  'OX_QR_SCANNED',
  'OX_QR_NO_SCAN_AFTER_MAIL',
  'VP_STALE_SOCIAL_ACTIVITY',
  'RA_UNADDRESSED_POSITIVE_BACKLOG',
];
