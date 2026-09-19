/**
 * SeedReportEvidenceService — Evidence Normalization Layer (Phase 3)
 *
 * Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md
 *   §8    Evidence normalization
 *   §16    Phase 3 — Normalization
 *   §3.4   Existing substrate integration rules
 *
 * Sits between prompt execution and report generation. Validates per-candidate
 * prompt output, assigns stable observation IDs, normalizes source references,
 * resolves identity candidates, validates INT_* signals against mkt_signal_registry,
 * and reads the current resolved state from the existing substrate:
 *
 *   - directory_field_provenance  → resolved field values + evidence_state
 *   - directory_presence_seeds    → current identity + claim state
 *   - directory_seed_nap_verifications → owner correction history
 *   - directory_seed_outreach_touches  → seed-level outreach history
 *   - mkt_signal_registry        → INT_* signal allowlist + metadata
 *
 * Does NOT create a duplicate observation store (§3.4 rule 1, §12.1). The
 * report builder (Phase 4) consumes the normalized evidence references
 * produced here and assembles the SeedIntelligenceReport DTO.
 *
 * Pattern: singleton extends BaseService (mirrors MarketingSignalRegistryService).
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { NotFoundError } from '../../middleware/errorHandler';
import {
  validateCandidateReportEvidence,
  validateReportEvidenceOutput,
  type CandidateReportEvidence,
  type ReportEvidenceOutput,
  type ReportObservation,
  type ReportSignal,
  type EvidenceState,
  type EvidenceConfidence,
} from '../../validators/seed-report-evidence.schema';
import {
  getSignalRegistryCache,
  setSignalRegistryCache,
  type SignalRegistryRow,
} from '../triage/signal-taxonomy';

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * The result of normalizing a single candidate's evidence. Carries the
 * validated evidence, resolved signal metadata, and references to the
 * existing substrate rows used to build it.
 */
export interface NormalizedEvidence {
  candidate_key: string;
  seed_id: string | null;
  evidence: ReportEvidenceOutput;
  /** Observations with stable IDs assigned by the normalizer. */
  observations_with_ids: ReportObservation[];
  /** Signals enriched with registry metadata (label, id). Invalid signals quarantined. */
  validated_signals: ValidatedSignal[];
  /** Signals that failed registry validation — kept for diagnostics, excluded from report. */
  quarantined_signals: QuarantinedSignal[];
  /** Provenance row IDs from directory_field_provenance used as evidence sources. */
  provenance_refs: string[];
  /** Whether the evidence passed validation. */
  valid: boolean;
  /** Validation errors if invalid. */
  errors: string[];
}

export interface ValidatedSignal {
  code: string;
  family: 'INT';
  label: string;
  basis: string;
  source_observation_ids: string[];
  registry_signal_id: string;
  registry_active: boolean;
}

export interface QuarantinedSignal {
  code: string;
  reason: string;
  basis: string;
  source_observation_ids: string[];
}

/**
 * Resolved seed state read from the existing substrate. The report builder
 * uses this instead of re-deriving identity from raw observations (§9, §3.4 rule 6).
 */
export interface ResolvedSeedState {
  seed_id: string;
  identity_confidence: string;
  category_fit: string;
  category: string;
  city: string;
  state: string;
  name_variants: string[];
  nap_owner_corrected: boolean;
  nap_verified_at: string | null;
  owner_verified_at: string | null;
  owner_verification: any;
  contact_status: string;
  outreach_state: string;
  claimed_at: string | null;
  status: string;
}

/**
 * Provenance row from directory_field_provenance, enriched with the new
 * evidence_state column from migration 271.
 */
export interface ProvenanceRow {
  id: string;
  field_key: string;
  value: string | null;
  source_name: string | null;
  source_url: string | null;
  accessed_at: string | null;
  confidence: string;
  evidence_state: string | null;
  notes: string | null;
  override_by: string | null;
  override_at: string | null;
}

/**
 * NAP verification event from directory_seed_nap_verifications.
 */
export interface NapVerificationRow {
  id: string;
  source: string;
  changed_fields: any;
  owner_corrected: boolean;
  created_at: string;
}

/**
 * Seed outreach touch from directory_seed_outreach_touches.
 */
export interface SeedTouchRow {
  id: string;
  channel: string;
  outcome: string | null;
  notes: string | null;
  operator_id: string | null;
  occurred_at: string;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class SeedReportEvidenceService extends BaseService {
  private static instance: SeedReportEvidenceService;

  private constructor() {
    super();
  }

  static getInstance(): SeedReportEvidenceService {
    if (!SeedReportEvidenceService.instance) {
      SeedReportEvidenceService.instance = new SeedReportEvidenceService();
    }
    return SeedReportEvidenceService.instance;
  }

  // ─── Main entry: normalize a candidate's evidence ──────────────────────

  /**
   * Validate, enrich, and normalize a single candidate's report_evidence
   * output from a prompt run.
   *
   * Steps (§16 Phase 3):
   *   1. Parse and validate per-candidate output (Zod).
   *   2. Assign stable observation IDs to observations that lack them.
   *   3. Normalize source references (trim, lowercase source_type).
   *   4. Validate signals against mkt_signal_registry (INT family, active).
   *   5. Quarantine invalid signals (not in registry, inactive, wrong family).
   *   6. Return normalized evidence with provenance refs for the report builder.
   *
   * Does NOT write to the database. The report builder (Phase 4) persists
   * the report version; this service is a pure transform.
   */
  async normalizeCandidateEvidence(
    rawCandidateEvidence: unknown,
    ctx?: RequestCtx,
  ): Promise<NormalizedEvidence> {
    const errors: string[] = [];

    // 1. Validate per-candidate output (§6.0, §6.2)
    let candidate: CandidateReportEvidence;
    try {
      candidate = validateCandidateReportEvidence(rawCandidateEvidence);
    } catch (err: any) {
      logger.error('SeedReportEvidenceService: candidate evidence validation failed', ctx, {
        error: err.message,
        candidate_key: rawCandidateEvidence && typeof rawCandidateEvidence === 'object'
          ? (rawCandidateEvidence as any).candidate_key
          : null,
      });
      return {
        candidate_key: 'unknown',
        seed_id: null,
        evidence: emptyEvidence(),
        observations_with_ids: [],
        validated_signals: [],
        quarantined_signals: [],
        provenance_refs: [],
        valid: false,
        errors: [`Validation failed: ${err.message}`],
      };
    }

    const evidence = candidate.report_evidence;

    // 2. Assign stable observation IDs (§6.3: "normalizer assigns a stable
    //    observation ID if the prompt does not supply one")
    const observationsWithIds = evidence.observations.map((obs, idx) => ({
      ...obs,
      observation_id: obs.observation_id ?? this.generateObservationId(candidate.candidate_key, idx),
    }));

    // 3. Normalize source references
    const normalizedObservations = observationsWithIds.map((obs) => ({
      ...obs,
      source_type: obs.source_type?.trim().toLowerCase() || 'unknown',
      source_name: obs.source_name?.trim() || 'Unknown source',
    }));

    // 4. Validate signals against mkt_signal_registry
    const { validated, quarantined } = await this.validateSignals(evidence.signals, ctx);

    // 5. Resolve seed_id from candidate identity if possible
    const seedId = await this.resolveSeedId(candidate, ctx);

    // 6. Load provenance refs if we have a seed_id
    const provenanceRefs = seedId ? await this.loadProvenanceRefs(seedId, ctx) : [];

    return {
      candidate_key: candidate.candidate_key,
      seed_id: seedId,
      evidence: {
        ...evidence,
        observations: normalizedObservations,
        signals: validated.map((v) => ({
          code: v.code,
          family: 'INT' as const,
          label: v.label,
          basis: v.basis,
          source_observation_ids: v.source_observation_ids,
          registry_signal_id: v.registry_signal_id,
        })),
      },
      observations_with_ids: normalizedObservations,
      validated_signals: validated,
      quarantined_signals: quarantined,
      provenance_refs: provenanceRefs,
      valid: errors.length === 0,
      errors,
    };
  }

  // ─── Substrate-only evidence build (legacy seeds, §18 regression) ──────

  /**
   * Build a NormalizedEvidence snapshot entirely from the existing
   * substrate — no prompt output required. This is the path that lets a
   * legacy seed (created before report_evidence existed) still produce a
   * provisional report rather than failing (§18 regression requirement).
   *
   * Mapping:
   *   - directory_field_provenance rows → ReportObservation[] with stable
   *     deterministic IDs (obs-sub-{seed}-{idx}); evidence_state and
   *     confidence carried straight through (migration 271 backfill).
   *   - directory_presence_seeds → a single IdentityCandidate built from
   *     provenance identity fields + the resolved city/state/confidence.
   *   - Geographic assessment: a seed exists in the directory for its city,
   *     so a set city maps to 'inside_city' with that basis; unset →
   *     'outside_market' (which correctly fails claim-hook eligibility).
   *   - Category assessment: resolved category + category_fit from the seed.
   *   - No signals, platform observations, or unresolved questions — the
   *     substrate does not carry them.
   */
  async buildSubstrateEvidence(seedId: string, ctx?: RequestCtx): Promise<NormalizedEvidence> {
    const [seedState, provenanceRows, provenanceRefs] = await Promise.all([
      this.getResolvedSeedState(seedId, ctx),
      this.getProvenanceRows(seedId, ctx),
      this.loadProvenanceRefs(seedId, ctx),
    ]);

    if (!seedState) {
      throw new NotFoundError(`Seed not found: ${seedId}`);
    }

    const safeKey = seedId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    const observations: ReportObservation[] = provenanceRows.map((p, idx) => ({
      observation_id: `obs-sub-${safeKey}-${String(idx).padStart(3, '0')}`,
      subject: 'seed',
      field: p.field_key,
      value: p.value,
      state: (p.evidence_state as EvidenceState)
        ?? (p.override_by ? 'owner_confirmed' : 'observed'),
      confidence: (p.confidence as EvidenceConfidence) ?? 'medium',
      source_name: p.source_name ?? 'directory',
      source_type: 'directory',
      source_url: p.source_url,
      observed_at: p.accessed_at,
      notes: p.notes,
    }));

    const provValue = (key: string) =>
      provenanceRows.find((p) => p.field_key === key)?.value ?? null;
    const provObsIds = (keys: string[]) =>
      observations.filter((o) => keys.includes(o.field)).map((o) => o.observation_id!);

    const identityCandidate = {
      business_name: provValue('business_name') ?? seedState.name_variants[0] ?? null,
      address: provValue('address'),
      phone: provValue('phone'),
      website: provValue('website'),
      city: seedState.city,
      state: seedState.state,
      identity_confidence: (seedState.identity_confidence as 'high' | 'medium' | 'low') ?? 'low',
      basis: ['resolved seed record', 'directory_field_provenance'],
      source_observation_ids: provObsIds(['business_name', 'address', 'phone', 'website', 'city', 'state']),
    };

    const geographicAssessment = seedState.city
      ? {
          location_status: 'inside_city' as const,
          basis: [`seed is listed in the ${seedState.city} directory surface`],
          source_observation_ids: provObsIds(['city']),
        }
      : {
          location_status: 'outside_market' as const,
          basis: ['no resolved city on the seed record'],
          source_observation_ids: [],
        };

    const categoryAssessment = seedState.category
      ? {
          category: seedState.category,
          subcategory: null,
          category_fit: (seedState.category_fit as 'verified' | 'probable' | 'insufficient') ?? 'probable',
          basis: ['resolved seed category'],
          source_observation_ids: [],
        }
      : null;

    // Phase 7 — platform_signal_divergence (INT_*, display-only, spec §5).
    // A confidence-gated local estimate that diverges from the national one
    // is itself an observation: a market where a nationally-quiet platform
    // over-indexes is a market characteristic. Emitted through the same
    // registry validation as model-emitted signals — an unseeded code lands
    // in quarantine, not in the report.
    const divergenceSignals: ReportSignal[] = [];
    try {
      if (seedState.category) {
        const { IntelligenceProfileService } = await import('./IntelligenceProfileService');
        const divergent = await IntelligenceProfileService.getInstance().resolveSignalDivergences(
          { category: seedState.category, city: seedState.city, state: seedState.state },
          ctx,
        );
        divergent.forEach((w, i) => {
          const obsId = `obs-div-${safeKey}-${String(i).padStart(2, '0')}`;
          observations.push({
            observation_id: obsId,
            subject: 'seed',
            field: `platform_signal_weight:${w.platform}`,
            value: `${w.weight} (${w.scope})`,
            state: 'observed',
            confidence:
              (w.confidence ?? 0) >= 0.8 ? 'high' : (w.confidence ?? 0) >= 0.5 ? 'medium' : 'low',
            source_name: `intelligence-profile:${w.profileId}@v${w.profileVersion}`,
            source_type: 'intelligence_profile',
            source_url: null,
            observed_at: null,
            notes: w.basis ?? null,
          });
          divergenceSignals.push({
            code: 'INT_PLATFORM_SIGNAL_DIVERGENCE',
            family: 'INT',
            basis: `${w.platform}: ${w.scope} signal weight ${w.weight} diverges from the national estimate (Δ ${
              (w.divergence ?? 0) > 0 ? '+' : ''
            }${w.divergence}) — local market diverges from the category norm`,
            source_observation_ids: [obsId],
          });
        });
      }
    } catch (divErr) {
      logger.warn('SeedReportEvidenceService: divergence signal emission failed (non-fatal)', ctx, {
        error: (divErr as Error).message,
        seedId,
      });
    }

    const { validated: divergenceValidated, quarantined: divergenceQuarantined } =
      await this.validateSignals(divergenceSignals, ctx);

    const evidence: ReportEvidenceOutput = {
      observations,
      identity_candidates: [identityCandidate],
      category_assessment: categoryAssessment,
      geographic_assessment: geographicAssessment,
      signals: divergenceValidated.map((v) => ({
        code: v.code,
        family: 'INT' as const,
        label: v.label,
        basis: v.basis,
        source_observation_ids: v.source_observation_ids,
        registry_signal_id: v.registry_signal_id,
      })),
      unresolved_questions: [],
      platform_observations: [],
    };

    return {
      candidate_key: `substrate-${seedId}`,
      seed_id: seedId,
      evidence,
      observations_with_ids: observations,
      validated_signals: divergenceValidated,
      quarantined_signals: divergenceQuarantined,
      provenance_refs: provenanceRefs,
      valid: true,
      errors: [],
    };
  }

  // ─── Signal validation against mkt_signal_registry (§6.7) ──────────────

  /**
   * Validate prompt-emitted signals against the active mkt_signal_registry.
   *
   * Rules (§6.7):
   *   - must be present in mkt_signal_registry
   *   - must be active (is_active = true)
   *   - must belong to the INT family
   *   - must have an evidence basis
   *   - must have source observation IDs when the signal claims to be evidence-backed
   *
   * Invalid signals are quarantined (not dropped) so diagnostics are available.
   */
  async validateSignals(
    signals: ReportSignal[],
    ctx?: RequestCtx,
  ): Promise<{ validated: ValidatedSignal[]; quarantined: QuarantinedSignal[] }> {
    const registryRows = await this.loadSignalRegistry(ctx);
    const registryByCode = new Map<string, SignalRegistryRow>();
    for (const row of registryRows) {
      registryByCode.set(row.code, row);
    }

    const validated: ValidatedSignal[] = [];
    const quarantined: QuarantinedSignal[] = [];

    for (const signal of signals) {
      const reasons: string[] = [];

      // Check family — must be INT
      if (signal.family !== 'INT') {
        reasons.push(`family "${signal.family}" is not "INT" — business-audit signals must not mix into discovery output (§6.7)`);
      }

      // Check registry presence
      const registryRow = registryByCode.get(signal.code);
      if (!registryRow) {
        reasons.push(`code "${signal.code}" not found in mkt_signal_registry`);
      } else {
        // Check active state
        if (!registryRow.isActive) {
          reasons.push(`code "${signal.code}" is inactive in mkt_signal_registry`);
        }
        // Check family match in registry
        if (registryRow.family !== 'INT') {
          reasons.push(`code "${signal.code}" has family "${registryRow.family}" in registry — must be "INT"`);
        }
      }

      // Check evidence basis
      if (!signal.basis || signal.basis.trim().length === 0) {
        reasons.push('signal has no evidence basis');
      }

      // Check source observation IDs
      if (!signal.source_observation_ids || signal.source_observation_ids.length === 0) {
        reasons.push('signal has no source_observation_ids');
      }

      if (reasons.length > 0) {
        quarantined.push({
          code: signal.code,
          reason: reasons.join('; '),
          basis: signal.basis,
          source_observation_ids: signal.source_observation_ids || [],
        });
        logger.warn('SeedReportEvidenceService: signal quarantined', ctx, {
          code: signal.code,
          reasons,
        });
      } else {
        validated.push({
          code: signal.code,
          family: 'INT',
          label: registryRow!.label,
          basis: signal.basis,
          source_observation_ids: signal.source_observation_ids,
          registry_signal_id: registryRow!.id,
          registry_active: true,
        });
      }
    }

    return { validated, quarantined };
  }

  // ─── Signal registry loader (with cache) ───────────────────────────────

  /**
   * Load active INT-family signals from mkt_signal_registry. Uses the
   * in-process cache from signal-taxonomy.ts (30s TTL, invalidated on
   * registry writes).
   */
  private async loadSignalRegistry(ctx?: RequestCtx): Promise<SignalRegistryRow[]> {
    // Check cache first
    const cached = getSignalRegistryCache();
    if (cached) {
      // Filter to INT family only
      return cached.filter((r) => r.family === 'INT' && r.isActive);
    }

    // Cache miss — fetch from DB
    try {
      const rows = await this.prisma.mkt_signal_registry.findMany({
        where: { is_active: true },
        orderBy: [{ family: 'asc' }, { code: 'asc' }],
      });

      const mapped: SignalRegistryRow[] = rows.map((r: any) => ({
        id: r.id,
        code: r.code,
        family: r.family,
        label: r.label,
        description: r.description,
        detectionSource: r.detection_source as any,
        derivedRule: r.derived_rule ?? null,
        isActive: r.is_active,
      }));

      // Populate the shared cache (all families, not just INT)
      setSignalRegistryCache(mapped);

      return mapped.filter((r) => r.family === 'INT' && r.isActive);
    } catch (err: any) {
      logger.error('SeedReportEvidenceService: failed to load signal registry', ctx, {
        error: err.message,
      });
      // Best-effort: return empty so validation quarantines all signals
      // rather than crashing the report generation.
      return [];
    }
  }

  // ─── Observation ID generation ─────────────────────────────────────────

  /**
   * Generate a stable observation ID for an observation that lacks one.
   * Format: obs-{candidateKey}-{index} — deterministic so re-normalization
   * of the same prompt output produces the same IDs.
   */
  private generateObservationId(candidateKey: string, index: number): string {
    // Sanitize candidate key for ID safety
    const safeKey = candidateKey.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    return `obs-${safeKey}-${String(index).padStart(3, '0')}`;
  }

  // ─── Seed resolution ───────────────────────────────────────────────────

  /**
   * Attempt to resolve a candidate to an existing directory_presence_seeds
   * row by business name + city. Returns null if no match — the report
   * builder will create a new seed through the existing seed-creation flow.
   */
  private async resolveSeedId(
    candidate: CandidateReportEvidence,
    ctx?: RequestCtx,
  ): Promise<string | null> {
    if (!candidate.business_name || !candidate.city) return null;

    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT id FROM directory_presence_seeds
        WHERE category IS NOT NULL
          AND city = ${candidate.city}
          AND listing_id IN (
            SELECT id FROM directory_listings_list
            WHERE business_name = ${candidate.business_name}
          )
        LIMIT 1
      `;

      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0].id;
      }

      // Fallback: match by name_variants array
      const variantRows = await this.prisma.$queryRaw<any[]>`
        SELECT id FROM directory_presence_seeds
        WHERE city = ${candidate.city}
          AND ${candidate.business_name} = ANY(name_variants)
        LIMIT 1
      `;

      if (Array.isArray(variantRows) && variantRows.length > 0) {
        return variantRows[0].id;
      }

      return null;
    } catch (err: any) {
      logger.error('SeedReportEvidenceService: seed resolution failed', ctx, {
        error: err.message,
        business_name: candidate.business_name,
        city: candidate.city,
      });
      // Best-effort: return null so the report builder can create a new seed
      return null;
    }
  }

  // ─── Provenance refs loader ────────────────────────────────────────────

  /**
   * Load provenance row IDs from directory_field_provenance for a seed.
   * These are references the report builder stores in evidence_refs —
   * NOT a duplicate observation store (§3.4 rule 1, §12.1).
   */
  private async loadProvenanceRefs(seedId: string, ctx?: RequestCtx): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT id FROM directory_field_provenance
        WHERE seed_id = ${seedId}
        ORDER BY field_key
      `;
      return Array.isArray(rows) ? rows.map((r) => r.id) : [];
    } catch (err: any) {
      logger.error('SeedReportEvidenceService: provenance ref load failed', ctx, {
        error: err.message,
        seedId,
      });
      return [];
    }
  }

  // ─── Substrate readers (for the report builder, Phase 4) ──────────────

  /**
   * Read the current resolved seed state from directory_presence_seeds.
   * The report builder uses this instead of re-deriving identity from
   * raw observations (§9, §3.4 rule 6).
   */
  async getResolvedSeedState(seedId: string, ctx?: RequestCtx): Promise<ResolvedSeedState | null> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT
          id,
          identity_confidence,
          category_fit,
          category,
          city,
          state,
          name_variants,
          nap_owner_corrected,
          nap_verified_at,
          owner_verified_at,
          owner_verification,
          contact_status,
          outreach_state,
          status,
          (SELECT claimed_at FROM directory_claim_tokens
           WHERE seed_id = ${seedId} AND consumed_at IS NOT NULL
           ORDER BY consumed_at DESC LIMIT 1) AS claimed_at
        FROM directory_presence_seeds
        WHERE id = ${seedId}
        LIMIT 1
      `;

      if (!Array.isArray(rows) || rows.length === 0) return null;

      const row = rows[0];
      return {
        seed_id: row.id,
        identity_confidence: row.identity_confidence,
        category_fit: row.category_fit,
        category: row.category,
        city: row.city,
        state: row.state,
        name_variants: Array.isArray(row.name_variants) ? row.name_variants : [],
        nap_owner_corrected: Boolean(row.nap_owner_corrected),
        nap_verified_at: row.nap_verified_at ? row.nap_verified_at.toISOString() : null,
        owner_verified_at: row.owner_verified_at ? row.owner_verified_at.toISOString() : null,
        owner_verification: row.owner_verification,
        contact_status: row.contact_status,
        outreach_state: row.outreach_state,
        claimed_at: row.claimed_at ? row.claimed_at.toISOString() : null,
        status: row.status,
      };
    } catch (err: any) {
      logger.error('SeedReportEvidenceService: getResolvedSeedState failed', ctx, {
        error: err.message,
        seedId,
      });
      throw this.handleError(err, ctx);
    }
  }

  /**
   * Read field provenance rows from directory_field_provenance for a seed.
   * Includes the new evidence_state column from migration 271.
   */
  async getProvenanceRows(seedId: string, ctx?: RequestCtx): Promise<ProvenanceRow[]> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT
          id,
          field_key,
          value,
          source_name,
          source_url,
          accessed_at,
          confidence,
          evidence_state,
          notes,
          override_by,
          override_at
        FROM directory_field_provenance
        WHERE seed_id = ${seedId}
        ORDER BY field_key
      `;

      if (!Array.isArray(rows)) return [];

      return rows.map((r) => ({
        id: r.id,
        field_key: r.field_key,
        value: r.value,
        source_name: r.source_name,
        source_url: r.source_url,
        accessed_at: r.accessed_at ? r.accessed_at.toISOString().split('T')[0] : null,
        confidence: r.confidence,
        evidence_state: r.evidence_state,
        notes: r.notes,
        override_by: r.override_by,
        override_at: r.override_at ? r.override_at.toISOString() : null,
      }));
    } catch (err: any) {
      logger.error('SeedReportEvidenceService: getProvenanceRows failed', ctx, {
        error: err.message,
        seedId,
      });
      throw this.handleError(err, ctx);
    }
  }

  /**
   * Read owner correction history from directory_seed_nap_verifications.
   * The report builder uses this for §4.5 versioned-fact tracking.
   */
  async getNapVerifications(seedId: string, ctx?: RequestCtx): Promise<NapVerificationRow[]> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT id, source, changed_fields, owner_corrected, created_at
        FROM directory_seed_nap_verifications
        WHERE seed_id = ${seedId}
        ORDER BY created_at DESC
      `;

      if (!Array.isArray(rows)) return [];

      return rows.map((r) => ({
        id: r.id,
        source: r.source,
        changed_fields: r.changed_fields,
        owner_corrected: Boolean(r.owner_corrected),
        created_at: r.created_at ? r.created_at.toISOString() : null,
      }));
    } catch (err: any) {
      logger.error('SeedReportEvidenceService: getNapVerifications failed', ctx, {
        error: err.message,
        seedId,
      });
      throw this.handleError(err, ctx);
    }
  }

  /**
   * Read seed-level outreach history from directory_seed_outreach_touches.
   * The report builder uses this for §10.8 verification activity.
   * ProvingGroundCadenceService also reads this table for cadence control.
   */
  async getSeedOutreachTouches(seedId: string, ctx?: RequestCtx): Promise<SeedTouchRow[]> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT id, channel, outcome, notes, operator_id, occurred_at
        FROM directory_seed_outreach_touches
        WHERE seed_id = ${seedId}
        ORDER BY occurred_at DESC
      `;

      if (!Array.isArray(rows)) return [];

      return rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        outcome: r.outcome,
        notes: r.notes,
        operator_id: r.operator_id,
        occurred_at: r.occurred_at ? r.occurred_at.toISOString() : null,
      }));
    } catch (err: any) {
      logger.error('SeedReportEvidenceService: getSeedOutreachTouches failed', ctx, {
        error: err.message,
        seedId,
      });
      throw this.handleError(err, ctx);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function emptyEvidence(): ReportEvidenceOutput {
  return {
    observations: [],
    identity_candidates: [],
    category_assessment: null,
    geographic_assessment: null,
    signals: [],
    unresolved_questions: [],
    platform_observations: [],
  };
}

export default SeedReportEvidenceService.getInstance();
