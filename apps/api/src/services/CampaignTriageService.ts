/**
 * CampaignTriageService — per-campaign triage evaluate / accept / override
 *
 * Wraps the pure TriageEngineService with DB persistence:
 *   - evaluateTriageForCampaign: load campaign + latest audit, run the
 *     cascade, upsert mkt_campaign_triage_results with the recommendation.
 *   - acceptTriage: mark the result accepted and re-categorize the campaign
 *     to the playbook's category (roadmap Risk 4). Applies the FITD fee.
 *   - overrideTriage: operator picks a different playbook; records the
 *     override + re-categorizes to the override playbook's category.
 *   - getTriageResult: read the latest stored recommendation for a campaign.
 *
 * Pattern: singleton extends BaseService.
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md §6
 * Sprint 3 — Admin API.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';
import { generateCampaignTriageId } from '../lib/id-generator';
import MarketingPlaybookCatalogService from './MarketingPlaybookCatalogService';
import { extractSignals, evaluateTriage, fallbackRecommendation, evaluateAllMatchingPlaybooks } from './triage';
import type {
  TriageRecommendation,
  DetectedSignal,
  PlaybookCode,
  PlaybookCatalogRow,
  SignalExtractorInput,
  MatchingRules,
  MultiArchetypeTriageResult,
} from './triage/types';
import type { SignalCode } from './triage/signal-taxonomy';

// ─── Inputs ──────────────────────────────────────────────────────────────

export interface TriageEvaluateInput {
  campaignId: string;
  bbb?: {
    bbbGrade?: string;
    unansweredBbbComplaints?: number;
  };
  /**
   * Operator-enriched signals to ADD to the AI-extracted set.
   * Use case: the scan missed a signal the operator verified manually
   * (e.g. BBB grade, NAP drift visible on Google Maps but not in audit).
   * These are merged AFTER extraction, BEFORE the engine evaluates.
   */
  operatorAddedSignals?: string[];
  /**
   * Operator-removed signals to SUBTRACT from the AI-extracted set.
   * Use case: the scan flagged a false positive (e.g. WC_URL_MISMATCH
   * because of a www vs non-www difference that's actually a redirect).
   * These are removed AFTER extraction, BEFORE the engine evaluates.
   */
  operatorRemovedSignals?: string[];
}

export interface TriageAcceptInput {
  campaignId: string;
}

export interface TriageOverrideInput {
  campaignId: string;
  playbookCode: PlaybookCode;
  reason?: string;
}

// ─── Stored result shape (returned to the API) ───────────────────────────

export interface TriageSourceAudit {
  id: string;
  platform: string;
  createdAt: Date;
}

export interface StoredTriageResult {
  id: string;
  campaignId: string;
  recommendedPlaybook: PlaybookCatalogRow;
  overriddenPlaybook: PlaybookCatalogRow | null;
  confidenceScore: number;
  triageReasoning: string;
  detectedSignals: DetectedSignal[];
  isOperatorAccepted: boolean | null;
  evaluatedAt: Date;
  /**
   * The audit whose audit_data fed the signal extractor. NULL when no audit
   * was used (signals derived from campaign columns only). Surfaced in the UI
   * so operators know the lineage of the recommendation.
   */
  sourceAudit: TriageSourceAudit | null;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class CampaignTriageService extends BaseService {
  private static instance: CampaignTriageService;

  private constructor() {
    super();
  }

  static getInstance(): CampaignTriageService {
    if (!CampaignTriageService.instance) {
      CampaignTriageService.instance = new CampaignTriageService();
    }
    return CampaignTriageService.instance;
  }

  // ─── Evaluate ──────────────────────────────────────────────────────────

  /**
   * Run the triage cascade for a campaign and upsert the result row.
   * Loads the campaign + its latest business_analysis audit, normalizes
   * signals, runs the engine, resolves the recommendation to a playbook
   * catalog row, and persists to mkt_campaign_triage_results.
   *
   * Does NOT mutate the campaign — accept/override is a separate step.
   * Re-evaluating overwrites the previous result (one row per campaign).
   */
  async evaluateTriageForCampaign(input: TriageEvaluateInput, ctx?: RequestCtx): Promise<StoredTriageResult> {
    const { campaignId } = input;

    // 1. Load signals + playbooks (shared with evaluateAllForCampaign)
    const { signals, playbooks, sourceAuditId } = await this.loadSignalsAndPlaybooks(input, ctx);

    // 2. Run the generic DSL evaluator over the SignalCode[] set.
    let recommendation: TriageRecommendation | null = evaluateTriage(signals, playbooks);
    let playbook: PlaybookCatalogRow;
    if (recommendation) {
      playbook = playbooks.find((p) => p.code === recommendation!.playbookCode)!;
    } else {
      // No rule matched — fall back to PB-03 (the seeded fallback playbook).
      const fallback = playbooks.find((p) => p.code === 'PB-03') ?? playbooks[playbooks.length - 1];
      if (!fallback) throw new NotFoundError('No active playbooks configured for triage');
      recommendation = fallbackRecommendation(signals, fallback);
      playbook = fallback;
      logger.warn('Triage fallback: no playbook rule matched', ctx, { campaignId, signals });
    }

    // 3. Upsert the triage result row (one row per campaign, re-evaluated in place)
    const id = generateCampaignTriageId();
    const row = await this.prisma.mkt_campaign_triage_results.upsert({
      where: { campaign_id: campaignId },
      create: {
        id,
        campaign_id: campaignId,
        recommended_playbook_id: playbook.id,
        confidence_score: recommendation.confidence,
        triage_reasoning: recommendation.reasoning,
        detected_signals: recommendation.detectedSignals as any,
        is_operator_accepted: null,
        overridden_playbook_id: null,
        source_audit_id: sourceAuditId,
        evaluated_at: new Date(),
      },
      update: {
        recommended_playbook_id: playbook.id,
        confidence_score: recommendation.confidence,
        triage_reasoning: recommendation.reasoning,
        detected_signals: recommendation.detectedSignals as any,
        // Re-evaluation resets the operator decision — they must re-accept.
        is_operator_accepted: null,
        overridden_playbook_id: null,
        source_audit_id: sourceAuditId,
        evaluated_at: new Date(),
      },
    });

    logger.info('Triage evaluated', ctx, {
      campaignId,
      playbookCode: recommendation.playbookCode,
      confidence: recommendation.confidence,
      sourceAuditId: sourceAuditId,
    });

    const sourceAudit = sourceAuditId
      ? await this.resolveSourceAudit(sourceAuditId)
      : null;
    return this.toStoredResult(row, playbook, null, sourceAudit);
  }

  /**
   * Extract the signal-loading + playbook-loading logic from evaluateTriageForCampaign
   * into a reusable helper. No behavior change — used by both evaluateTriageForCampaign
   * and evaluateAllForCampaign.
   */
  private async loadSignalsAndPlaybooks(
    input: TriageEvaluateInput,
    ctx?: RequestCtx,
  ): Promise<{ signals: SignalCode[]; playbooks: PlaybookCatalogRow[]; sourceAuditId: string | null }> {
    const { campaignId, bbb, operatorAddedSignals, operatorRemovedSignals } = input;

    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundError('Campaign not found');

    const allAudits = await this.prisma.mkt_audits_list.findMany({
      where: { campaign_id: campaignId },
      orderBy: { created_at: 'desc' },
    });
    const selectedAudit = this.selectAuditForTriage(allAudits);
    const auditData = (selectedAudit?.audit_data as SignalExtractorInput['auditData']) ?? null;
    const sourceAuditId = selectedAudit?.id ?? null;

    const extractorInput: SignalExtractorInput = {
      campaign: {
        last_review_date: campaign.last_review_date,
        unaddressed_reviews: campaign.unaddressed_reviews ?? 0,
        nap_consistent: campaign.nap_consistent,
        has_website: campaign.has_website,
        website_url: campaign.website_url,
        gbp_claimed: (campaign as any).gbp_claimed ?? null,
      },
      auditData,
      bbb,
    };
    let signals: SignalCode[] = extractSignals(extractorInput);

    if (operatorAddedSignals?.length) {
      const existing = new Set(signals);
      for (const code of operatorAddedSignals) {
        if (typeof code === 'string' && code.length > 0) {
          existing.add(code as SignalCode);
        }
      }
      signals = Array.from(existing);
    }
    if (operatorRemovedSignals?.length) {
      const removeSet = new Set(operatorRemovedSignals);
      signals = signals.filter((s) => !removeSet.has(s));
    }

    const playbooks = await MarketingPlaybookCatalogService.listActivePlaybooksOrdered(ctx);
    return { signals, playbooks, sourceAuditId };
  }

  /**
   * Evaluate all matching playbooks for a campaign (winner + alternatives).
   * The winner is stored via evaluateTriageForCampaign (same as today).
   * The alternatives are returned for the UI to present as sibling-creation
   * suggestions. Each alternative includes its detectedSignals.
   */
  async evaluateAllForCampaign(input: TriageEvaluateInput, ctx?: RequestCtx): Promise<MultiArchetypeTriageResult> {
    // 1. Run the normal evaluation (stores the winner, same as today)
    const winner = await this.evaluateTriageForCampaign(input, ctx);
    // 2. Re-load signals + playbooks (the helper is idempotent — no side effects)
    const { signals, playbooks } = await this.loadSignalsAndPlaybooks(input, ctx);
    // 3. Run the engine in "all matches" mode
    const allMatches = evaluateAllMatchingPlaybooks(signals, playbooks);
    // 4. Alternatives = all matches except the winner
    const alternatives = allMatches.filter(
      (m) => m.playbookCode !== winner.recommendedPlaybook.code,
    );
    return { winner, alternatives };
  }

  // ─── Accept ────────────────────────────────────────────────────────────

  /**
   * Operator accepts the recommended playbook. Re-categorizes the campaign
   * to the playbook's category and applies the FITD fee. The campaign stays
   * in its current stage (typically 'seek') — the operator drives the next
   * stage transition manually.
   *
   * Idempotent: re-accepting the same recommendation is a no-op.
   */
  async acceptTriage(input: TriageAcceptInput, ctx?: RequestCtx): Promise<StoredTriageResult> {
    const { campaignId } = input;

    const result = await this.prisma.mkt_campaign_triage_results.findUnique({
      where: { campaign_id: campaignId },
      include: { playbook: true, overridden_playbook: true },
    });
    if (!result) throw new NotFoundError('No triage result found — evaluate first');

    if (result.is_operator_accepted === true && !result.overridden_playbook_id) {
      // Already accepted — return as-is (idempotent).
      const sourceAudit = await this.resolveSourceAudit(result.source_audit_id);
      return this.toStoredResult(result, this.toRow(result.playbook), null, sourceAudit);
    }

    const playbook = this.toRow(result.playbook);

    // Re-categorize the campaign + apply FITD fee.
    // For profile_repair playbooks, set repair_track to 'standard' (review pipeline).
    // For non-profile_repair playbooks, clear repair_track (not applicable).
    await this.prisma.mkt_campaigns_list.update({
      where: { id: campaignId },
      data: {
        campaign_category: playbook.category,
        estimated_fee_cents: playbook.fitdDefaultFeeCents,
        repair_track: playbook.category === 'profile_repair' ? 'standard' : null,
      },
    });

    const updated = await this.prisma.mkt_campaign_triage_results.update({
      where: { campaign_id: campaignId },
      data: {
        is_operator_accepted: true,
        overridden_playbook_id: null,
      },
      include: { playbook: true, overridden_playbook: true },
    });

    logger.info('Triage accepted', ctx, {
      campaignId,
      playbookCode: playbook.code,
      newCategory: playbook.category,
      fitdFeeCents: playbook.fitdDefaultFeeCents,
    });

    const sourceAudit = await this.resolveSourceAudit(updated.source_audit_id);
    return this.toStoredResult(updated, this.toRow(updated.playbook), null, sourceAudit);
  }

  // ─── Override ──────────────────────────────────────────────────────────

  /**
   * Operator overrides the recommendation with a different playbook.
   * Records the override + re-categorizes the campaign to the override
   * playbook's category + applies that playbook's FITD fee.
   *
   * The original recommendation is preserved on recommended_playbook_id;
   * the override is recorded on overridden_playbook_id.
   */
  async overrideTriage(input: TriageOverrideInput, ctx?: RequestCtx): Promise<StoredTriageResult> {
    const { campaignId, playbookCode, reason } = input;

    const result = await this.prisma.mkt_campaign_triage_results.findUnique({
      where: { campaign_id: campaignId },
      include: { playbook: true, overridden_playbook: true },
    });
    if (!result) throw new NotFoundError('No triage result found — evaluate first');

    const overridePlaybook = await MarketingPlaybookCatalogService.getPlaybookByCode(playbookCode, ctx);

    if (overridePlaybook.id === result.recommended_playbook_id) {
      throw new ConflictError('Override playbook is the same as the recommendation — use accept instead');
    }

    // Re-categorize to the override playbook's category + apply its FITD fee.
    // For profile_repair playbooks, set repair_track to 'standard' (review pipeline).
    // For non-profile_repair playbooks, clear repair_track (not applicable).
    await this.prisma.mkt_campaigns_list.update({
      where: { id: campaignId },
      data: {
        campaign_category: overridePlaybook.category,
        estimated_fee_cents: overridePlaybook.fitdDefaultFeeCents,
        repair_track: overridePlaybook.category === 'profile_repair' ? 'standard' : null,
      },
    });

    const updated = await this.prisma.mkt_campaign_triage_results.update({
      where: { campaign_id: campaignId },
      data: {
        is_operator_accepted: true, // override counts as an operator decision
        overridden_playbook_id: overridePlaybook.id,
        triage_reasoning: reason
          ? `${result.triage_reasoning ?? ''} [OVERRIDE: ${reason}]`.trim()
          : result.triage_reasoning,
      },
      include: { playbook: true, overridden_playbook: true },
    });

    logger.info('Triage overridden', ctx, {
      campaignId,
      recommendedCode: this.toRow(updated.playbook).code,
      overrideCode: overridePlaybook.code,
      newCategory: overridePlaybook.category,
      reason,
    });

    const sourceAudit = await this.resolveSourceAudit(updated.source_audit_id);
    return this.toStoredResult(updated, this.toRow(updated.playbook), overridePlaybook, sourceAudit);
  }

  // ─── Read ──────────────────────────────────────────────────────────────

  async getTriageResult(campaignId: string, ctx?: RequestCtx): Promise<StoredTriageResult | null> {
    const result = await this.prisma.mkt_campaign_triage_results.findUnique({
      where: { campaign_id: campaignId },
      include: { playbook: true, overridden_playbook: true },
    });
    if (!result) return null;
    const overridden = result.overridden_playbook ? this.toRow(result.overridden_playbook) : null;
    const sourceAudit = await this.resolveSourceAudit(result.source_audit_id);
    return this.toStoredResult(result, this.toRow(result.playbook), overridden, sourceAudit);
  }

  // ─── Mapper ────────────────────────────────────────────────────────────

  private toRow(r: any): PlaybookCatalogRow {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      archetype: r.archetype,
      archetypeLabel: r.archetype_label,
      description: r.description,
      matchingRules: (r.matching_rules ?? {
        any: [],
        all: [],
        none: [],
        dual: null,
        confidence: 0,
      }) as MatchingRules,
      priorityRank: r.priority_rank ?? 99,
      fitdOfferTitle: r.fitd_offer_title,
      fitdDefaultFeeCents: r.fitd_default_fee_cents,
      retainerPitchTitle: r.retainer_pitch_title,
      retainerFeeCents: r.retainer_fee_cents,
      openerPromptTemplateId: r.opener_prompt_template_id,
      previewDeliverableType: r.preview_deliverable_type,
      isActive: r.is_active,
    };
  }

  private toStoredResult(
    r: any,
    playbook: PlaybookCatalogRow,
    overridden: PlaybookCatalogRow | null,
    sourceAudit?: TriageSourceAudit | null,
  ): StoredTriageResult {
    return {
      id: r.id,
      campaignId: r.campaign_id,
      recommendedPlaybook: playbook,
      overriddenPlaybook: overridden,
      confidenceScore: Number(r.confidence_score),
      triageReasoning: r.triage_reasoning ?? '',
      detectedSignals: (r.detected_signals as DetectedSignal[]) ?? [],
      isOperatorAccepted: r.is_operator_accepted,
      evaluatedAt: r.evaluated_at,
      sourceAudit: sourceAudit ?? null,
    };
  }

  /**
   * Resolve a TriageSourceAudit from a stored source_audit_id by looking up
   * the audit row. Returns null if the id is null or the audit was deleted.
   */
  private async resolveSourceAudit(sourceAuditId: string | null): Promise<TriageSourceAudit | null> {
    if (!sourceAuditId) return null;
    const audit = await this.prisma.mkt_audits_list.findUnique({
      where: { id: sourceAuditId },
      select: { id: true, platform: true, created_at: true },
    });
    if (!audit) return null;
    return { id: audit.id, platform: audit.platform, createdAt: audit.created_at };
  }

  /**
   * Select the best audit for triage from a campaign's audit list (ordered
   * newest first). Priority:
   *   1. Latest business_analysis audit (canonical signal-aware contract).
   *   2. Latest audit with a top-level detected_signals[] array
   *      (forward-compatible — any platform that emits signals).
   *   3. null — no suitable audit; signals will be derived from campaign columns.
   */
  private selectAuditForTriage(audits: any[]): any | null {
    if (audits.length === 0) return null;

    // 1. Prefer latest business_analysis audit
    const businessAnalysis = audits.find((a) => a.platform === 'business_analysis');
    if (businessAnalysis) return businessAnalysis;

    // 2. Fall back to latest audit with detected_signals[] in audit_data
    const withSignals = audits.find(
      (a) => a.audit_data && Array.isArray((a.audit_data as any).detected_signals),
    );
    if (withSignals) return withSignals;

    // 3. No suitable audit
    return null;
  }
}

export default CampaignTriageService.getInstance();
