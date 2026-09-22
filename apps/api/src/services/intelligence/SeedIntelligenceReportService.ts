/**
 * SeedIntelligenceReportService — Versioned Report Builder (Phase 4)
 *
 * Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md
 *   §9     Report DTO assembly
 *   §5     Report lifecycle, versioning, status, re-engagement
 *   §12.2  mkt_seed_intelligence_reports table
 *   §16    Phase 4 — Versioned report builder and renderer
 *
 * Consumes normalized evidence from SeedReportEvidenceService (Phase 3) and
 * the current resolved state from the existing substrate to assemble the
 * immutable SeedIntelligenceReport DTO. Runs lint checks (Phase 1) before
 * publishing. Persists immutable report versions to
 * mkt_seed_intelligence_reports.
 *
 * The builder reads the current canonical identity and claim state from
 * directory_presence_seeds, NOT from raw prompt observations (§9). Raw
 * observations and directory_field_provenance explain how the seed was
 * built; the seed row represents the current resolved record.
 *
 * Pattern: singleton extends BaseService (mirrors SeedReportEvidenceService).
 */

import { createHash } from 'crypto';
import { BaseService } from '../BaseService';
import { audit } from '../../audit';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { generateSeedIntelligenceReportId } from '../../lib/id-generator';
import { SeedReportEvidenceService } from './SeedReportEvidenceService';
import type {
  NormalizedEvidence,
  ResolvedSeedState,
  ProvenanceRow,
  NapVerificationRow,
  SeedTouchRow,
} from './SeedReportEvidenceService';
import {
  type SeedIntelligenceReport,
  type SeedReportStatus,
  type SeedReportMode,
  type ReportFact,
  type BusinessIdentitySection,
  type SourceSummarySection,
  type IdentityReconciliationSection,
  type MarketClassificationSection,
  type PlatformPresenceSection,
  type CategoryFitSection,
  type IntelligenceSignalSection,
  type VerificationActivitySection,
  type ClaimSummarySection,
  type NextActionSection,
  type ReportGenerationMetadata,
  evaluateClaimHookEligibility,
  computeDeltaSummary,
} from '../../validators/seed-report-dto.schema';
import {
  type ReportEvidenceOutput,
  type ReportObservation,
  type ReportSignal,
  type IdentityCandidate,
  type EvidenceState,
  type EvidenceConfidence,
} from '../../validators/seed-report-evidence.schema';
import {
  lintReport,
  type LintResult,
  type LintFinding,
} from '../../validators/seed-report-lint';

// ─── Types ────────────────────────────────────────────────────────────────

export interface BuildReportInput {
  seedId: string;
  normalizedEvidence: NormalizedEvidence;
  /** Prompt template IDs/versions used to produce the evidence (§5.5). */
  promptTemplates: Array<{ template_id: string; template_version: number }>;
  /** Source snapshot IDs from the discovery run (§5.5). */
  sourceSnapshotIds: string[];
  /**
   * Idempotency hash over report-visible inputs (§22.3). Stored in
   * generated_from so a refresh retry with unchanged inputs can reuse the
   * latest version instead of minting a duplicate.
   */
  evidenceSnapshotHash?: string;
  /** Optional operator context for logging. */
  ctx?: RequestCtx;
}

export interface BuildReportResult {
  report: SeedIntelligenceReport;
  lint: LintResult;
  persisted: boolean;
  reportId: string;
  version: number;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class SeedIntelligenceReportService extends BaseService {
  private static instance: SeedIntelligenceReportService;
  private evidenceService: SeedReportEvidenceService;

  private constructor() {
    super();
    this.evidenceService = SeedReportEvidenceService.getInstance();
  }

  static getInstance(): SeedIntelligenceReportService {
    if (!SeedIntelligenceReportService.instance) {
      SeedIntelligenceReportService.instance = new SeedIntelligenceReportService();
    }
    return SeedIntelligenceReportService.instance;
  }

  // ─── Main entry: build and persist a report version ────────────────────

  /**
   * Assemble a SeedIntelligenceReport DTO from normalized evidence + the
   * current resolved seed state, run lint checks, and persist an immutable
   * version to mkt_seed_intelligence_reports.
   *
   * Steps (§16 Phase 4):
   *   1. Load resolved seed state from directory_presence_seeds.
   *   2. Load provenance rows from directory_field_provenance.
   *   3. Load NAP verifications from directory_seed_nap_verifications.
   *   4. Load seed outreach touches from directory_seed_outreach_touches.
   *   5. Assemble report sections from evidence + substrate.
   *   6. Evaluate report status (§5.3).
   *   7. Evaluate claim-hook eligibility (§5.2).
   *   8. Run lint checks (§17) — block publication on error-severity findings.
   *   9. Determine the next version number.
   *  10. Persist the immutable report version.
   *
   * If lint fails, the report is still persisted with status unchanged but
   * published_at remains null (unpublished). The operator can review the
   * lint findings and fix the evidence before re-generating.
   */
  async buildReport(input: BuildReportInput): Promise<BuildReportResult> {
    const { seedId, normalizedEvidence, promptTemplates, sourceSnapshotIds, ctx } = input;

    this.logOperation('SeedIntelligenceReportService.buildReport', { seedId });

    // 1-4. Load substrate state
    const [seedState, provenanceRows, napVerifications, outreachTouches] = await Promise.all([
      this.evidenceService.getResolvedSeedState(seedId, ctx),
      this.evidenceService.getProvenanceRows(seedId, ctx),
      this.evidenceService.getNapVerifications(seedId, ctx),
      this.evidenceService.getSeedOutreachTouches(seedId, ctx),
    ]);

    if (!seedState) {
      throw new Error(`Seed not found: ${seedId}`);
    }

    // 5. Assemble report sections
    const evidence = normalizedEvidence.evidence;
    const reportId = generateSeedIntelligenceReportId();
    const generatedAt = new Date().toISOString();

    const businessIdentity = this.assembleBusinessIdentity(seedState, provenanceRows, evidence);
    const sourceSummary = this.assembleSourceSummary(evidence, provenanceRows);
    const identityReconciliation = this.assembleIdentityReconciliation(seedState, evidence);
    const marketClassification = this.assembleMarketClassification(seedState, evidence);
    const platformPresence = this.assemblePlatformPresence(evidence);
    const categoryFit = this.assembleCategoryFit(seedState, evidence);
    const intelligenceSignals = this.assembleIntelligenceSignals(normalizedEvidence);
    const verificationActivity = this.assembleVerificationActivity(outreachTouches, napVerifications);
    const claimSummary = this.assembleClaimSummary(seedState, napVerifications);
    const nextActions = this.assembleNextActions(seedState, evidence);

    // 6. Evaluate report status (§5.3)
    const status = this.evaluateReportStatus(seedState, evidence, normalizedEvidence);

    // 7. Evaluate claim-hook eligibility (§5.2)
    const eligibility = evaluateClaimHookEligibility({
      status,
      identityConfidence: seedState.identity_confidence as 'high' | 'medium' | 'low',
      locationStatus: evidence.geographic_assessment?.location_status ?? 'outside_market',
      sourceObservationCount: evidence.observations.length,
      hasUnresolvedIdentityConflict: identityReconciliation.conflicts.some(
        (c) => c.resolution === 'unresolved',
      ),
    });

    // Adjust next_actions based on eligibility
    if (!eligibility.eligible) {
      nextActions.cta_eligible = false;
      nextActions.cta_disabled_reason = eligibility.reasons.join('; ');
      nextActions.primary_cta = null;
    }

    // 8. Determine report mode (§12.2, §14)
    const reportMode: SeedReportMode = seedState.claimed_at ? 'claimed' : 'free';

    // 9. Assemble the full DTO
    const report: SeedIntelligenceReport = {
      report_id: reportId,
      seed_id: seedId,
      version: 0, // Will be set after version number resolution
      status,
      report_mode: reportMode,
      generated_at: generatedAt,
      generated_from: {
        prompt_templates: promptTemplates,
        source_snapshot_ids: sourceSnapshotIds,
        evidence_ids: normalizedEvidence.observations_with_ids.map((o) => o.observation_id!).filter(Boolean),
        ...(input.evidenceSnapshotHash ? { evidence_snapshot_hash: input.evidenceSnapshotHash } : {}),
      },
      evidence_count: evidence.observations.length,
      unresolved_count: evidence.unresolved_questions.length,
      owner_verification_count: napVerifications.filter((v) => v.owner_corrected).length,
      business_identity: businessIdentity,
      source_summary: sourceSummary,
      identity_reconciliation: identityReconciliation,
      market_classification: marketClassification,
      platform_presence: platformPresence,
      category_fit: categoryFit,
      intelligence_signals: intelligenceSignals,
      verification_activity: verificationActivity,
      claim_summary: claimSummary,
      next_actions: nextActions,
    };

    // 10. Run lint checks (§17)
    const lint = lintReport(report, evidence);

    if (!lint.passed) {
      logger.warn('SeedIntelligenceReportService: lint failed, report will be persisted but not published', ctx, {
        seedId,
        findings: lint.findings.map((f) => ({ rule: f.rule, message: f.message })),
      });
    }

    // 11. Determine next version number + compute the delta vs the prior
    //     version (§5.4) so re-engagement can lead with what changed.
    const nextVersion = await this.getNextVersion(seedId, ctx);
    report.version = nextVersion;

    try {
      const priorRows = await this.prisma.$queryRaw<any[]>`
        SELECT report_data FROM mkt_seed_intelligence_reports
        WHERE seed_id = ${seedId}
        ORDER BY version DESC
        LIMIT 1
      `;
      report.delta_summary = computeDeltaSummary(
        (priorRows?.[0]?.report_data as SeedIntelligenceReport | undefined) ?? null,
        report,
      );
    } catch (err: any) {
      logger.warn('SeedIntelligenceReportService: delta computation failed (non-blocking)', ctx, {
        seedId,
        error: err?.message,
      });
    }

    // 12. Persist the immutable report version
    const persisted = await this.persistReport(report, normalizedEvidence, lint, ctx);

    // 13. Claim handoff (§13.5): a CTA-eligible unclaimed seed needs a live
    //     claim token for the report CTA/QR. Mint one when none is active so
    //     the published report always carries a working claim path. Minting
    //     flips the seed to 'invited' (claim invited state). Best-effort —
    //     a mint failure must not fail report generation.
    if (eligibility.eligible && !seedState.claimed_at) {
      try {
        const activeTokens = await this.prisma.$queryRaw<any[]>`
          SELECT 1 FROM directory_claim_tokens
          WHERE seed_id = ${seedId}
            AND consumed_at IS NULL
            AND (expires_at IS NULL OR expires_at > now())
          LIMIT 1
        `;
        if (!activeTokens[0]) {
          const { default: seedService } = await import('../DirectoryPresenceSeedService.js');
          await seedService.inviteSeed(seedId, 90, {
            actorType: 'system',
            actorId: ctx?.userId ?? 'system',
          });
        }
      } catch (err: any) {
        logger.warn('SeedIntelligenceReportService: claim token mint failed (non-blocking)', ctx, {
          seedId,
          error: err?.message,
        });
      }
    }

    return {
      report,
      lint,
      persisted,
      reportId,
      version: nextVersion,
    };
  }

  // ─── Operator refresh (§5.1 trigger, §22.3 idempotency) ───────────────

  /**
   * Build a report version from the existing substrate only (no prompt
   * output required). This is the operator-initiated refresh path and the
   * trigger target for §5.1 events (claim, owner correction, verification
   * event) — it also lets legacy seeds produce a provisional report.
   *
   * Idempotency (§22.3): hashes the report-visible inputs
   * (seed identity, provenance, NAP verifications, outreach touches) into
   * an evidence_snapshot_hash. When the latest stored version carries the
   * same hash, that version is returned instead of creating a duplicate.
   */
  async refreshReport(
    seedId: string,
    ctx?: RequestCtx,
  ): Promise<BuildReportResult & { reused: boolean }> {
    this.logOperation('SeedIntelligenceReportService.refreshReport', { seedId });

    const [seedState, normalizedEvidence, napVerifications, outreachTouches] = await Promise.all([
      this.evidenceService.getResolvedSeedState(seedId, ctx),
      this.evidenceService.buildSubstrateEvidence(seedId, ctx),
      this.evidenceService.getNapVerifications(seedId, ctx),
      this.evidenceService.getSeedOutreachTouches(seedId, ctx),
    ]);

    if (!seedState) {
      throw new Error(`Seed not found: ${seedId}`);
    }

    const snapshotHash = createHash('sha256')
      .update(JSON.stringify({
        seed_state: {
          identity_confidence: seedState.identity_confidence,
          category_fit: seedState.category_fit,
          category: seedState.category,
          city: seedState.city,
          state: seedState.state,
          name_variants: seedState.name_variants,
          claimed_at: seedState.claimed_at,
          status: seedState.status,
          outreach_state: seedState.outreach_state,
          nap_verified_at: seedState.nap_verified_at,
        },
        evidence: normalizedEvidence.evidence,
        provenance_refs: normalizedEvidence.provenance_refs,
        nap_verification_ids: napVerifications.map((v) => v.id),
        outreach_touch_ids: outreachTouches.map((t) => t.id),
        substrate_template: 'substrate-1',
      }))
      .digest('hex');

    // Reuse the latest version when the inputs are unchanged (§22.3).
    const latestRows = await this.prisma.$queryRaw<any[]>`
      SELECT version, report_data,
             source_snapshot->>'evidence_snapshot_hash' AS snapshot_hash
      FROM mkt_seed_intelligence_reports
      WHERE seed_id = ${seedId}
      ORDER BY version DESC
      LIMIT 1
    `;
    const latest = latestRows?.[0];
    if (latest?.snapshot_hash && latest.snapshot_hash === snapshotHash) {
      await audit({
        actorType: ctx?.userId ? 'user' : 'system',
        actor: ctx?.userId,
        action: 'seed_intelligence_report.refresh',
        payload: { seedId, reused: true, version: latest.version },
      });
      return {
        report: latest.report_data as SeedIntelligenceReport,
        lint: { passed: true, findings: [] },
        persisted: false,
        reportId: (latest.report_data as SeedIntelligenceReport).report_id,
        version: latest.version,
        reused: true,
      };
    }

    const result = await this.buildReport({
      seedId,
      normalizedEvidence,
      promptTemplates: [{ template_id: 'substrate', template_version: 1 }],
      sourceSnapshotIds: [`substrate-${snapshotHash.slice(0, 12)}`],
      evidenceSnapshotHash: snapshotHash,
      ctx,
    });

    await audit({
      actorType: ctx?.userId ? 'user' : 'system',
      actor: ctx?.userId,
      action: 'seed_intelligence_report.refresh',
      payload: { seedId, reused: false, version: result.version, reportId: result.reportId },
    });

    return { ...result, reused: false };
  }

  // ─── Re-engagement suggestion (§5.4) ───────────────────────────────────

  /**
   * Evaluate whether a refreshed report justifies re-contacting the seed.
   * All conditions from §5.4 must hold:
   *   - the prior report was delivered (report_delivered touch exists)
   *   - the seed remains unclaimed
   *   - the prior report was not viewed or produced no response
   *   - the latest version carries a meaningful delta (delta_summary)
   *   - the courtesy/follow-up policy allows another contact (no recent
   *     touch, no declined/opt-out outcome)
   */
  async getReEngagementSuggestion(
    seedId: string,
    ctx?: RequestCtx,
  ): Promise<{
    suggested: boolean;
    reasons: string[];
    delta: SeedIntelligenceReport['delta_summary'] | null;
    priorVersion: number | null;
    currentVersion: number | null;
    lastDeliveryAt: string | null;
    priorViewed: boolean;
    seedClaimed: boolean;
  }> {
    const reasons: string[] = [];

    const [versions, seedRows, deliveryRows, scanRows, responseRows] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT version, report_data FROM mkt_seed_intelligence_reports
        WHERE seed_id = ${seedId}
        ORDER BY version DESC
        LIMIT 2
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT claimed_at, status FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT occurred_at FROM directory_seed_outreach_touches
        WHERE seed_id = ${seedId} AND outcome = 'report_delivered'
        ORDER BY occurred_at DESC
        LIMIT 1
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT created_at FROM qr_scan_events
        WHERE product_id = ${seedId} AND surface LIKE 'report_delivery%'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT outcome, occurred_at FROM directory_seed_outreach_touches
        WHERE seed_id = ${seedId}
          AND outcome NOT IN ('report_delivered', 'not_attempted')
        ORDER BY occurred_at DESC
        LIMIT 5
      `,
    ]);

    const latest = versions?.[0];
    const prior = versions?.[1];
    const latestReport = latest?.report_data as SeedIntelligenceReport | undefined;
    const delta = latestReport?.delta_summary ?? null;

    const seedClaimed = !!seedRows?.[0]?.claimed_at || seedRows?.[0]?.status === 'claimed';
    const lastDeliveryAt = deliveryRows?.[0]?.occurred_at
      ? new Date(deliveryRows[0].occurred_at).toISOString()
      : null;
    const lastScanAt = scanRows?.[0]?.created_at ? new Date(scanRows[0].created_at) : null;
    const priorViewed = !!(lastScanAt && lastDeliveryAt && lastScanAt >= new Date(lastDeliveryAt));

    // §5.4 conditions
    if (!lastDeliveryAt) reasons.push('prior report was never delivered');
    if (seedClaimed) reasons.push('seed is already claimed');
    if (!latest) reasons.push('no report versions exist');
    if (!prior) reasons.push('no prior version to diff — first report is not a re-engagement event');
    if (latest && !delta?.meaningful) reasons.push('latest version has no meaningful delta');

    // Response check: any non-delivery touch after the last delivery counts
    // as a response (contact made, claim response, etc.)
    const responded = (responseRows ?? []).some(
      (r) => lastDeliveryAt && new Date(r.occurred_at) > new Date(lastDeliveryAt),
    );
    if (priorViewed || responded) reasons.push('prior report was viewed or produced a response');

    // Courtesy/follow-up policy: declined/opt-out outcomes block contact;
    // require a quiet window since the last touch.
    const RE_ENGAGEMENT_QUIET_DAYS = 7;
    const lastTouch = responseRows?.[0];
    if (lastTouch && ['declined', 'opt_out', 'do_not_contact'].includes(lastTouch.outcome)) {
      reasons.push(`prior outcome "${lastTouch.outcome}" blocks further contact`);
    }
    const lastActivity = lastTouch?.occurred_at ?? lastDeliveryAt;
    if (lastActivity) {
      const quietUntil = new Date(lastActivity);
      quietUntil.setDate(quietUntil.getDate() + RE_ENGAGEMENT_QUIET_DAYS);
      if (new Date() < quietUntil) {
        reasons.push(`quiet window until ${quietUntil.toISOString().slice(0, 10)}`);
      }
    }

    return {
      suggested: reasons.length === 0,
      reasons,
      delta,
      priorVersion: prior?.version ?? null,
      currentVersion: latest?.version ?? null,
      lastDeliveryAt,
      priorViewed,
      seedClaimed,
    };
  }

  // ─── Report version persistence ────────────────────────────────────────

  /**
   * Persist an immutable report version to mkt_seed_intelligence_reports.
   * The report is published (published_at set) only if lint passes.
   */
  private async persistReport(
    report: SeedIntelligenceReport,
    normalizedEvidence: NormalizedEvidence,
    lint: LintResult,
    ctx?: RequestCtx,
  ): Promise<boolean> {
    try {
      const publishedAt = lint.passed ? new Date().toISOString() : null;

      await this.prisma.$executeRaw`
        INSERT INTO mkt_seed_intelligence_reports (
          id, seed_id, version, status, report_mode,
          report_data, source_snapshot, evidence_refs, lint_findings,
          generated_at, published_at, created_at
        ) VALUES (
          ${report.report_id},
          ${report.seed_id},
          ${report.version},
          ${report.status},
          ${report.report_mode},
          ${JSON.stringify(report)}::jsonb,
          ${JSON.stringify(report.generated_from)}::jsonb,
          ${JSON.stringify(normalizedEvidence.provenance_refs)}::jsonb,
          ${JSON.stringify(lint.findings)}::jsonb,
          ${report.generated_at}::timestamptz,
          ${publishedAt}::timestamptz,
          now()
        )
        ON CONFLICT (seed_id, version) DO NOTHING
      `;

      this.logOperation('SeedIntelligenceReportService.persistReport', {
        reportId: report.report_id,
        seedId: report.seed_id,
        version: report.version,
        published: lint.passed,
      });

      // §23.4 auditability — report generation + publication
      await audit({
        actorType: ctx?.userId ? 'user' : 'system',
        actor: ctx?.userId,
        action: 'seed_intelligence_report.generate',
        payload: {
          reportId: report.report_id,
          seedId: report.seed_id,
          version: report.version,
          status: report.status,
          reportMode: report.report_mode,
          evidenceCount: report.evidence_count,
          lintPassed: lint.passed,
        },
      });
      if (lint.passed) {
        await audit({
          actorType: ctx?.userId ? 'user' : 'system',
          actor: ctx?.userId,
          action: 'seed_intelligence_report.publish',
          payload: {
            reportId: report.report_id,
            seedId: report.seed_id,
            version: report.version,
          },
        });
      }

      return true;
    } catch (err: any) {
      logger.error('SeedIntelligenceReportService: persistReport failed', ctx, {
        error: err.message,
        reportId: report.report_id,
        seedId: report.seed_id,
      });
      return false;
    }
  }

  /**
   * Get the next version number for a seed (max existing version + 1).
   * Returns 1 if no prior versions exist.
   */
  private async getNextVersion(seedId: string, ctx?: RequestCtx): Promise<number> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT COALESCE(MAX(version), 0) AS max_version
        FROM mkt_seed_intelligence_reports
        WHERE seed_id = ${seedId}
      `;
      const maxVersion = Array.isArray(rows) && rows.length > 0 ? Number(rows[0].max_version) : 0;
      return maxVersion + 1;
    } catch (err: any) {
      logger.error('SeedIntelligenceReportService: getNextVersion failed', ctx, {
        error: err.message,
        seedId,
      });
      // Best-effort: start at version 1
      return 1;
    }
  }

  // ─── Report readers ────────────────────────────────────────────────────

  /**
   * Get the latest published report version for a seed.
   * Returns null if no published version exists.
   */
  async getLatestPublishedReport(seedId: string, ctx?: RequestCtx): Promise<SeedIntelligenceReport | null> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT report_data
        FROM mkt_seed_intelligence_reports
        WHERE seed_id = ${seedId}
          AND published_at IS NOT NULL
        ORDER BY version DESC
        LIMIT 1
      `;
      if (!Array.isArray(rows) || rows.length === 0) return null;
      return rows[0].report_data as SeedIntelligenceReport;
    } catch (err: any) {
      logger.error('SeedIntelligenceReportService: getLatestPublishedReport failed', ctx, {
        error: err.message,
        seedId,
      });
      throw this.handleError(err, ctx);
    }
  }

  /**
   * Get a specific report version by seed + version number.
   */
  async getReportVersion(seedId: string, version: number, ctx?: RequestCtx): Promise<SeedIntelligenceReport | null> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT report_data
        FROM mkt_seed_intelligence_reports
        WHERE seed_id = ${seedId} AND version = ${version}
        LIMIT 1
      `;
      if (!Array.isArray(rows) || rows.length === 0) return null;
      return rows[0].report_data as SeedIntelligenceReport;
    } catch (err: any) {
      logger.error('SeedIntelligenceReportService: getReportVersion failed', ctx, {
        error: err.message,
        seedId,
        version,
      });
      throw this.handleError(err, ctx);
    }
  }

  /**
   * List all report versions for a seed (for the operator version history view).
   */
  async listReportVersions(seedId: string, ctx?: RequestCtx): Promise<Array<{
    version: number;
    status: string;
    generated_at: string;
    published_at: string | null;
    evidence_count: number;
  }>> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT version, status, generated_at, published_at,
               (report_data->>'evidence_count')::int AS evidence_count
        FROM mkt_seed_intelligence_reports
        WHERE seed_id = ${seedId}
        ORDER BY version DESC
      `;
      if (!Array.isArray(rows)) return [];
      return rows.map((r) => ({
        version: r.version,
        status: r.status,
        generated_at: r.generated_at ? r.generated_at.toISOString() : null,
        published_at: r.published_at ? r.published_at.toISOString() : null,
        evidence_count: r.evidence_count ?? 0,
      }));
    } catch (err: any) {
      logger.error('SeedIntelligenceReportService: listReportVersions failed', ctx, {
        error: err.message,
        seedId,
      });
      throw this.handleError(err, ctx);
    }
  }

  // ─── Section assemblers ───────────────────────────────────────────────

  /**
   * Assemble the business identity section (§9.1).
   * Reads resolved values from directory_field_provenance, falling back
   * to the seed/listing row. Each field becomes a ReportFact with evidence
   * state, confidence, and source observation IDs.
   */
  private assembleBusinessIdentity(
    seedState: ResolvedSeedState,
    provenanceRows: ProvenanceRow[],
    evidence: ReportEvidenceOutput,
  ): BusinessIdentitySection {
    const provenanceByField = new Map<string, ProvenanceRow>();
    for (const p of provenanceRows) {
      provenanceByField.set(p.field_key, p);
    }

    // Provenance field-key aliases — the seed write paths (createFromCampaign,
    // manual form) record the name under 'name' while the report DTO uses
    // 'business_name' (§9.1). Match both so a provenance row under either key
    // resolves.
    const FIELD_KEY_ALIASES: Record<string, string[]> = {
      business_name: ['name'],
    };

    const buildFact = (
      fieldKey: string,
      value: unknown,
      fallbackConfidence: EvidenceConfidence = 'medium',
    ): ReportFact => {
      const keys = [fieldKey, ...(FIELD_KEY_ALIASES[fieldKey] ?? [])];
      const prov = keys.map((k) => provenanceByField.get(k)).find((p) => p != null);
      const evidenceState: EvidenceState = prov?.evidence_state as EvidenceState
        ?? (prov?.override_by ? 'owner_confirmed' : 'observed');
      const confidence: EvidenceConfidence = (prov?.confidence as EvidenceConfidence) ?? fallbackConfidence;
      const sourceObsIds = evidence.observations
        .filter((o) => keys.includes(o.field))
        .map((o) => o.observation_id!)
        .filter(Boolean);

      const resolvedValue = prov?.value ?? value;
      // §17.1: a fact with no source observations must carry an explicit
      // derived-value explanation — otherwise lint blocks publication.
      const displayNote = prov?.notes
        ?? (sourceObsIds.length === 0
          ? prov
            ? `Sourced from ${prov.source_name ?? 'directory provenance'}`
            : resolvedValue != null
              ? 'Resolved from the seed record'
              : 'Not observed — no sourced value on record'
          : null);

      return {
        field: fieldKey,
        value: resolvedValue,
        state: evidenceState,
        confidence,
        source_observation_ids: sourceObsIds,
        owner_verified_at: prov?.override_at ?? null,
        display_note: displayNote,
      };
    };

    return {
      business_name: buildFact('business_name', seedState.name_variants[0] ?? null, 'medium'),
      address: buildFact('address', null, 'medium'),
      phone: buildFact('phone', null, 'medium'),
      website: buildFact('website', null, 'low'),
      city: buildFact('city', seedState.city, 'high'),
      state: buildFact('state', seedState.state, 'high'),
      owner_name: buildFact('owner_name', null, 'low'),
      ownership_type: buildFact('ownership_type', null, 'low'),
    };
  }

  /**
   * Assemble the source summary section (§9.3).
   * Counts sources from observations and provenance rows.
   */
  private assembleSourceSummary(
    evidence: ReportEvidenceOutput,
    provenanceRows: ProvenanceRow[],
  ): SourceSummarySection {
    const sourceTypesMap = new Map<string, { source_type: string; source_name: string; role: string; observation_count: number }>();
    for (const obs of evidence.observations) {
      const key = `${obs.source_type}:${obs.source_name}`;
      const existing = sourceTypesMap.get(key);
      if (existing) {
        existing.observation_count++;
      } else {
        sourceTypesMap.set(key, {
          source_type: obs.source_type,
          source_name: obs.source_name,
          role: 'discovery',
          observation_count: 1,
        });
      }
    }

    // Count identity signals from observations that contributed to identity
    const identitySignalCount = evidence.identity_candidates.reduce(
      (sum, c) => sum + c.source_observation_ids.length,
      0,
    );

    // Count variants from identity candidates
    const nameSet = new Set<string>();
    const addressSet = new Set<string>();
    for (const c of evidence.identity_candidates) {
      if (c.business_name) nameSet.add(c.business_name);
      if (c.address) addressSet.add(c.address);
    }

    return {
      sources_checked_count: new Set(evidence.observations.map((o) => o.source_name)).size + provenanceRows.length,
      sources_with_evidence_count: new Set(
        evidence.observations.filter((o) => o.state !== 'not_found_during_discovery' && o.state !== 'not_checked').map((o) => o.source_name),
      ).size,
      source_types: Array.from(sourceTypesMap.values()),
      identity_signals_count: identitySignalCount,
      name_variants_count: nameSet.size,
      address_variants_count: addressSet.size,
      unresolved_count: evidence.unresolved_questions.length,
    };
  }

  /**
   * Assemble the identity reconciliation section (§9.4).
   * Uses the canonical candidate from evidence + seed state for confidence.
   */
  private assembleIdentityReconciliation(
    seedState: ResolvedSeedState,
    evidence: ReportEvidenceOutput,
  ): IdentityReconciliationSection {
    const canonical = evidence.identity_candidates[0] ?? null;

    // Collect alternate names/addresses/phones from all candidates
    const names = new Set<string>();
    const addresses = new Set<string>();
    const phones = new Set<string>();
    for (const c of evidence.identity_candidates) {
      if (c.business_name) names.add(c.business_name);
      if (c.address) addresses.add(c.address);
      if (c.phone) phones.add(c.phone);
    }
    // Remove the canonical values from alternates
    if (canonical?.business_name) names.delete(canonical.business_name);
    if (canonical?.address) addresses.delete(canonical.address);
    if (canonical?.phone) phones.delete(canonical.phone);

    // Detect conflicts from observations with different values for the same field
    const fieldValues = new Map<string, Array<{ value: string; source_observation_ids: string[] }>>();
    for (const obs of evidence.observations) {
      if (obs.state === 'conflicting' || obs.state === 'observed') {
        const existing = fieldValues.get(obs.field) ?? [];
        existing.push({
          value: String(obs.value ?? ''),
          source_observation_ids: obs.observation_id ? [obs.observation_id] : [],
        });
        fieldValues.set(obs.field, existing);
      }
    }
    const conflicts = Array.from(fieldValues.entries())
      .filter(([, values]) => {
        const uniqueValues = new Set(values.map((v) => v.value));
        return uniqueValues.size > 1;
      })
      .map(([field, values]) => ({
        field,
        values,
        resolution: 'unresolved' as const,
      }));

    return {
      canonical_candidate: canonical,
      alternate_names: Array.from(names),
      alternate_addresses: Array.from(addresses),
      alternate_phones: Array.from(phones),
      conflicts,
      identity_confidence: seedState.identity_confidence as 'high' | 'medium' | 'low',
    };
  }

  /**
   * Assemble the market classification section (§10.5).
   * Descriptive only — must not become an unsupported quality judgment.
   */
  private assembleMarketClassification(
    seedState: ResolvedSeedState,
    evidence: ReportEvidenceOutput,
  ): MarketClassificationSection {
    const geoAssessment = evidence.geographic_assessment;
    const catAssessment = evidence.category_assessment;

    return {
      category: catAssessment?.category ?? seedState.category,
      subcategory: catAssessment?.subcategory ?? null,
      category_fit: (catAssessment?.category_fit ?? seedState.category_fit) as 'verified' | 'probable' | 'insufficient',
      location_status: geoAssessment?.location_status ?? 'outside_market',
      ownership_type: null,
      category_profile_context: null,
      operational_signals: [],
    };
  }

  /**
   * Assemble the platform presence section (§10.6).
   */
  private assemblePlatformPresence(evidence: ReportEvidenceOutput): PlatformPresenceSection {
    return {
      platforms: evidence.platform_observations.map((p) => ({
        platform: p.platform,
        presence: p.presence,
        business_name: p.business_name,
        address: p.address,
        phone: p.phone,
        primary_category: p.primary_category,
        hours_present: p.hours_present,
        website_present: p.website_present,
        claimed_status: p.claimed_status,
        source_url: p.source_url,
        observed_at: p.observed_at,
      })),
    };
  }

  /**
   * Assemble the category fit section (§10.5).
   */
  private assembleCategoryFit(
    seedState: ResolvedSeedState,
    evidence: ReportEvidenceOutput,
  ): CategoryFitSection {
    const catAssessment = evidence.category_assessment;
    return {
      category: catAssessment?.category ?? seedState.category,
      subcategory: catAssessment?.subcategory ?? null,
      category_fit: (catAssessment?.category_fit ?? seedState.category_fit) as 'verified' | 'probable' | 'insufficient',
      basis: catAssessment?.basis ?? [],
      source_observation_ids: catAssessment?.source_observation_ids ?? [],
    };
  }

  /**
   * Assemble the intelligence signals section (§10.7).
   * Uses only validated signals from the normalizer (quarantined signals excluded).
   */
  private assembleIntelligenceSignals(
    normalizedEvidence: NormalizedEvidence,
  ): IntelligenceSignalSection {
    return {
      signals: normalizedEvidence.validated_signals.map((s) => ({
        code: s.code,
        label: s.label,
        basis: s.basis,
        source_observation_ids: s.source_observation_ids,
        registry_signal_id: s.registry_signal_id,
      })),
    };
  }

  /**
   * Assemble the verification activity section (§10.8).
   * Only populated when contact or owner-verification events exist.
   */
  private assembleVerificationActivity(
    outreachTouches: SeedTouchRow[],
    napVerifications: NapVerificationRow[],
  ): VerificationActivitySection {
    const events: VerificationActivitySection['events'] = [];

    // Map outreach touches to verification events
    for (const touch of outreachTouches) {
      events.push({
        date: touch.occurred_at ?? '',
        channel: touch.channel,
        purpose: 'outreach',
        contact_outcome: touch.outcome,
        facts_confirmed: [],
        facts_corrected: [],
        facts_disputed: [],
        owner_reported_pain: null,
        claim_response: null,
        next_action: null,
      });
    }

    // Map NAP verifications to correction events
    for (const nap of napVerifications) {
      const changedFields = nap.changed_fields;
      const changedFieldNames = changedFields && typeof changedFields === 'object'
        ? Object.keys(changedFields)
        : [];
      events.push({
        date: nap.created_at ?? '',
        channel: 'owner_claim',
        purpose: 'NAP verification',
        contact_outcome: nap.owner_corrected ? 'fact_corrected' : 'identity_confirmed',
        facts_confirmed: nap.owner_corrected ? [] : changedFieldNames,
        facts_corrected: nap.owner_corrected ? changedFieldNames : [],
        facts_disputed: [],
        owner_reported_pain: null,
        claim_response: null,
        next_action: null,
      });
    }

    // Sort by date descending
    events.sort((a, b) => (b.date > a.date ? 1 : -1));

    return { events };
  }

  /**
   * Assemble the claim summary section (§9.5).
   */
  private assembleClaimSummary(
    seedState: ResolvedSeedState,
    napVerifications: NapVerificationRow[],
  ): ClaimSummarySection {
    let claimStatus: ClaimSummarySection['claim_status'] = 'unclaimed';
    if (seedState.claimed_at) {
      claimStatus = 'claimed';
    } else if (seedState.outreach_state === 'invited') {
      claimStatus = 'claim_invited';
    } else if (seedState.outreach_state === 'pending') {
      claimStatus = 'claim_pending';
    }

    const ownerCorrectionCount = napVerifications.filter((v) => v.owner_corrected).length;
    const ownerConfirmationCount = napVerifications.filter((v) => !v.owner_corrected).length;

    return {
      claim_status: claimStatus,
      claim_url: null, // Set by the claim-handoff layer (Phase 5)
      claim_benefits: [
        'Confirm ownership',
        'Correct inaccurate information',
        'Add missing details',
        'Connect your preferred profiles',
        'Establish the verified starting record for future intelligence',
      ],
      owner_confirmation_count: ownerConfirmationCount,
      owner_correction_count: ownerCorrectionCount,
    };
  }

  /**
   * Assemble the next action section (§10.9).
   * The claim CTA is set here but may be disabled by the eligibility check.
   */
  private assembleNextActions(
    seedState: ResolvedSeedState,
    evidence: ReportEvidenceOutput,
  ): NextActionSection {
    const hasUnresolved = evidence.unresolved_questions.length > 0;
    const suggestedActions: NextActionSection['suggested_actions'] = [];

    if (hasUnresolved) {
      suggestedActions.push({
        action: 'review_unresolved_fields',
        description: `${evidence.unresolved_questions.length} field(s) need owner verification`,
        priority: 'medium',
      });
    }

    if (evidence.signals.length > 0) {
      suggestedActions.push({
        action: 'review_intelligence_signals',
        description: `${evidence.signals.length} intelligence signal(s) detected`,
        priority: 'low',
      });
    }

    return {
      primary_cta: 'Claim this free business seed',
      cta_eligible: true, // Will be overridden by eligibility check if needed
      cta_disabled_reason: null,
      suggested_actions: suggestedActions,
    };
  }

  // ─── Report status evaluation (§5.3) ──────────────────────────────────

  /**
   * Evaluate the report status based on seed state and evidence quality.
   *
   * Status rules (§5.3):
   *   - provisional: at least one source and a candidate identity exist, but
   *     required identity fields remain unresolved
   *   - complete: a qualifying identity and category/location classification
   *     are established from available evidence
   *   - requires_identity_review: conflicting identity records cannot be
   *     safely reconciled
   *   - insufficient_evidence: no reliable category-qualified identity can
   *     be established
   *   - claimed: the business completed verified claim
   */
  private evaluateReportStatus(
    seedState: ResolvedSeedState,
    evidence: ReportEvidenceOutput,
    normalizedEvidence: NormalizedEvidence,
  ): SeedReportStatus {
    // Claimed takes precedence
    if (seedState.claimed_at) return 'claimed';

    // Check for insufficient evidence
    if (
      evidence.observations.length === 0 ||
      evidence.identity_candidates.length === 0 ||
      seedState.identity_confidence === 'low'
    ) {
      // If there's literally no evidence at all
      if (evidence.observations.length === 0 && evidence.identity_candidates.length === 0) {
        return 'insufficient_evidence';
      }
      // Low confidence with conflicts → requires review
      const hasConflicts = evidence.observations.some((o) => o.state === 'conflicting');
      if (hasConflicts || seedState.identity_confidence === 'low') {
        return 'requires_identity_review';
      }
      return 'insufficient_evidence';
    }

    // Check for unresolved identity conflicts
    const hasUnresolvedConflicts = evidence.observations.some((o) => o.state === 'conflicting');
    if (hasUnresolvedConflicts && seedState.identity_confidence === 'low') {
      return 'requires_identity_review';
    }

    // Check if complete: qualifying identity + category + location established
    const hasCategoryAssessment = evidence.category_assessment !== null;
    const hasGeographicAssessment = evidence.geographic_assessment !== null;
    const hasQualifyingIdentity = seedState.identity_confidence === 'high' || seedState.identity_confidence === 'medium';

    if (hasCategoryAssessment && hasGeographicAssessment && hasQualifyingIdentity) {
      return 'complete';
    }

    // Default: provisional
    return 'provisional';
  }
}

export default SeedIntelligenceReportService.getInstance();
