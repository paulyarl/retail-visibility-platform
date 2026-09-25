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
import { NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler';
import { generateCampaignTriageId } from '../lib/id-generator';
import { isStubBusinessAnalysisAudit, STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES } from '../lib/marketing-audits';
import MarketingPlaybookCatalogService from './MarketingPlaybookCatalogService';
import MarketingSignalRegistryService from './MarketingSignalRegistryService';
import {
  extractSignals,
  evaluateTriage,
  fallbackRecommendation,
  evaluateAllMatchingPlaybooks,
  buildSignalPlaybookPrefs,
  applySignalPlaybookPreferences,
  preferenceFallbackRecommendation,
  type SignalPlaybookPrefsMap,
} from './triage';
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
  /**
   * audit_data.audit_metadata.source for stub audits ('manual_queue',
   * 'queue_promotion', 'derived_from_parent', 'discovery_scan'); null for
   * real audits. Surfaced so the UI can name the evidence lane.
   */
  auditSource: string | null;
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
   * Two-lane verdict depth: 'full' when the recommendation was evaluated
   * from a real business_analysis audit; 'partial' when it ran off a stub
   * audit (discovery scan / queue promotion) or campaign fields only.
   * Derived at read time from the source audit — no column needed.
   */
  verdict: 'partial' | 'full';
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

    // Triage is a per-business funnel (re-categorize + FITD fee + playbook).
    // Category/city-scope campaigns are aggregate scans with no single
    // business to triage — reject before running the engine so a stray
    // evaluate call cannot persist a bogus recommendation + fees.
    await this.assertBusinessScope(campaignId, ctx);

    // 1. Load signals + playbooks (shared with evaluateAllForCampaign)
    const { signals, playbooks, sourceAuditId, sourceAuditSource, signalPrefs, wiredPrefs } =
      await this.loadSignalsAndPlaybooks(input, ctx);

    // 2. Run the generic DSL evaluator over the SignalCode[] set.
    let recommendation: TriageRecommendation | null = evaluateTriage(signals, playbooks);
    let playbook: PlaybookCatalogRow;
    if (recommendation) {
      playbook = playbooks.find((p) => p.code === recommendation!.playbookCode)!;
      // Disclose when a registry-wired signal (primary_playbook) is what
      // pulled this playbook into the match — preference-driven routing is
      // declared intent, not an authored matching_rules clause.
      const wiredSignals = wiredPrefs.get(recommendation.playbookCode);
      const wiredHits = wiredSignals
        ? recommendation.detectedSignals.filter((s) => s.contributedToRule && wiredSignals.has(s.code))
        : [];
      if (wiredHits.length > 0) {
        recommendation.reasoning +=
          `; registry-wired signal(s) ${wiredHits.map((s) => s.code).join(', ')} ` +
          `count toward ${recommendation.playbookCode} via primary_playbook preference`;
      }
    } else {
      // No rule matched — a detected signal's declared playbook preference
      // (secondary first, primary as heavier weight) beats the blind PB-03
      // fallback when its target is eligible (none-guard passes, no
      // all/dual conjunction a declared signal can't satisfy).
      const prefRecommendation = preferenceFallbackRecommendation(signals, playbooks, signalPrefs);
      if (prefRecommendation) {
        recommendation = prefRecommendation;
        playbook = playbooks.find((p) => p.code === prefRecommendation.playbookCode)!;
        logger.info('Triage preference route: no rule matched; signal playbook preference selected', ctx, {
          campaignId,
          playbookCode: prefRecommendation.playbookCode,
        });
      } else {
        // Fall back to PB-03 (the seeded fallback playbook).
        const fallback = playbooks.find((p) => p.code === 'PB-03') ?? playbooks[playbooks.length - 1];
        if (!fallback) throw new NotFoundError('No active playbooks configured for triage');
        recommendation = fallbackRecommendation(signals, fallback);
        playbook = fallback;
        logger.warn('Triage fallback: no playbook rule matched', ctx, { campaignId, signals });
      }
    }

    // 2b. Discovery-lane provenance: when the selected audit is a
    //     discovery_scan stub, stamp each detected signal so the UI can mark
    //     them as scan-derived (partial verdict evidence).
    if (sourceAuditSource === 'discovery_scan') {
      recommendation.detectedSignals = recommendation.detectedSignals.map((s) => ({
        ...s,
        origin: 'discovery_scan' as const,
      }));
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
  ): Promise<{
    signals: SignalCode[];
    playbooks: PlaybookCatalogRow[];
    sourceAuditId: string | null;
    sourceAuditSource: string | null;
    signalPrefs: SignalPlaybookPrefsMap;
    wiredPrefs: Map<string, Set<SignalCode>>;
  }> {
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
    // Stub-audit provenance (manual_queue / queue_promotion /
    // derived_from_parent / discovery_scan) — null for real audits.
    const sourceAuditSource =
      ((selectedAudit?.audit_data as any)?.audit_metadata?.source as string | undefined) ?? null;

    // Phase 6 — signal-aligned gap gate. Resolved platform weights decide
    // whether a render-control absence emits DS_MISSING_PROFILE; undefined
    // keeps the legacy primary-platform set (no profile → byte-identical).
    const { IntelligenceProfileService } = await import('./intelligence/IntelligenceProfileService');
    const platformSignalWeights = await IntelligenceProfileService.getInstance()
      .resolveSignalWeightMapForCampaign(campaign, auditData, ctx);

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
      platformSignalWeights,
    };
    let signals: SignalCode[] = extractSignals(extractorInput);

    // §6.2 — website-audit signal union. The website audit owns the WC_*
    // family; the business audit owns the rest. `selectAuditForTriage` reads
    // ONE audit (latest business_analysis preferred), so a website audit's
    // WC_* signals do not merge automatically — union them here. Runs before
    // the operator add/remove overrides so an operator's removal still wins.
    const websiteAudit = allAudits.find((a) => a.platform === 'website_positioning');
    const websiteSignals = (websiteAudit?.audit_data as any)?.detected_signals;
    if (Array.isArray(websiteSignals)) {
      const merged = new Set(signals);
      for (const code of websiteSignals) {
        if (typeof code === 'string' && code.startsWith('WC_')) {
          merged.add(code as SignalCode);
        }
      }
      signals = Array.from(merged);
    }

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

    // Migration 262 (spec §4.3) — 'proving_ground' playbooks (e.g. PG-01)
    // are aggregate-campaign checklists, not business triage candidates.
    // Excluding them here also removes them from evaluateAllForCampaign
    // (alternatives panel) since it flows through this loader.
    const [orderedPlaybooks, registryRows] = await Promise.all([
      MarketingPlaybookCatalogService.listActivePlaybooksOrdered(ctx),
      MarketingSignalRegistryService.listSignals({ isActive: true }, ctx),
    ]);
    const signalPrefs = buildSignalPlaybookPrefs(registryRows);
    // Migration 308 — registry-wired signals join their primary playbook's
    // `any` evidence pool (guards still apply); secondary prefs are the
    // declared no-match fallback (see preferenceFallbackRecommendation).
    const { playbooks, wired } = applySignalPlaybookPreferences(
      orderedPlaybooks.filter((p: any) => p.category !== 'proving_ground'),
      signals,
      signalPrefs,
    );
    return { signals, playbooks, sourceAuditId, sourceAuditSource, signalPrefs, wiredPrefs: wired };
  }

  /**
   * Evaluate all matching playbooks for a campaign (winner + alternatives).
   * The winner is stored via evaluateTriageForCampaign (same as today).
   * The alternatives are returned for the UI to present as sibling-creation
   * suggestions. Each alternative includes its detectedSignals.
   *
   * IMPORTANT: If the triage is already decided (accepted or overridden), the
   * stored result is used as-is — evaluateTriageForCampaign is NOT called. This
   * prevents the alternatives endpoint (a GET) from silently resetting the
   * operator's decision. This is critical for sibling campaigns, which have a
   * pre-accepted triage result from createSiblingCampaign; without this guard,
   * loading the IntelligentTriageCard on a sibling would overwrite the
   * pre-accepted PB-05 result with a fresh PB-01 evaluation + null decision.
   */
  async evaluateAllForCampaign(input: TriageEvaluateInput, ctx?: RequestCtx): Promise<MultiArchetypeTriageResult> {
    // Scope guard — see evaluateTriageForCampaign. Placed before the
    // isDecided short-circuit so stale triage rows on a category/city
    // campaign (e.g. from prior to this guard) are not surfaced either.
    await this.assertBusinessScope(input.campaignId, ctx);

    // 1. Check if the triage is already decided. If so, use the stored result
    //    as the winner — do NOT re-evaluate (which would reset the decision).
    const existing = await this.getTriageResult(input.campaignId, ctx);
    const isDecided = existing != null && (existing.isOperatorAccepted === true || existing.overriddenPlaybook != null);

    const winner: StoredTriageResult = isDecided
      ? existing!
      : await this.evaluateTriageForCampaign(input, ctx);

    // 2. Load signals + playbooks for the all-matches computation.
    //    When decided, use the stored detected_signals (not a fresh extraction)
    //    so alternatives reflect what the operator saw at decision time.
    const signals: SignalCode[] = isDecided
      ? (existing!.detectedSignals.map((s) => s.code) as SignalCode[])
      : (await this.loadSignalsAndPlaybooks(input, ctx)).signals;
    // Same proving_ground exclusion as loadSignalsAndPlaybooks — PG playbooks
    // are aggregate-campaign checklists, not business triage candidates. This
    // path loads playbooks directly (not via the loader), so the filter must
    // be applied here too. Without it, PG-01's empty matching_rules ({})
    // crash ruleMatches on `.length` — and once normalized would match every
    // signal set, polluting all alternatives lists.
    // Registry playbook preferences apply identically so an alternative
    // wired via primary_playbook surfaces in the alternatives list.
    const [orderedPlaybooks, registryRows] = await Promise.all([
      MarketingPlaybookCatalogService.listActivePlaybooksOrdered(ctx),
      MarketingSignalRegistryService.listSignals({ isActive: true }, ctx),
    ]);
    const { playbooks } = applySignalPlaybookPreferences(
      orderedPlaybooks.filter((p: any) => p.category !== 'proving_ground'),
      signals,
      buildSignalPlaybookPrefs(registryRows),
    );

    // 3. Run the engine in "all matches" mode
    const allMatches = evaluateAllMatchingPlaybooks(signals, playbooks);

    // 4. Alternatives = all matches except the winner's effective playbook
    const effectiveCode = winner.overriddenPlaybook?.code ?? winner.recommendedPlaybook.code;
    const alternatives = allMatches.filter(
      (m) => m.playbookCode !== effectiveCode,
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

    // Re-categorize the campaign + apply FITD fee + stamp the effective playbook.
    // For profile_repair playbooks, set repair_track to 'standard' (review pipeline).
    // For non-profile_repair playbooks, clear repair_track (not applicable).
    // PB-08 is profile_repair by category but is NOT a repair-track campaign —
    // it is a website acquisition/build motion. Assigning 'standard' would pull
    // it into RepairFulfillmentService's gates (profile_repair_access intake,
    // repair execution read model, escalation). Keep it null.
    const targetRepairTrack =
      playbook.category === 'profile_repair' && playbook.code !== 'PB-08' ? 'standard' : null;
    await this.assertNoSiblingPlaybookConflict(campaignId, playbook.code, ctx);

    await this.prisma.mkt_campaigns_list.update({
      where: { id: campaignId },
      data: {
        campaign_category: playbook.category,
        playbook_code: playbook.code,
        estimated_fee_cents: playbook.fitdDefaultFeeCents,
        repair_track: targetRepairTrack,
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

    // Re-categorize to the override playbook's category + apply its FITD fee
    // + stamp the effective playbook.
    // For profile_repair playbooks, set repair_track to 'standard' (review pipeline).
    // For non-profile_repair playbooks, clear repair_track (not applicable).
    // PB-08 excluded — website acquisition has no repair track (see accept path).
    const overrideRepairTrack =
      overridePlaybook.category === 'profile_repair' && overridePlaybook.code !== 'PB-08' ? 'standard' : null;
    await this.assertNoSiblingPlaybookConflict(campaignId, overridePlaybook.code, ctx);

    await this.prisma.mkt_campaigns_list.update({
      where: { id: campaignId },
      data: {
        campaign_category: overridePlaybook.category,
        playbook_code: overridePlaybook.code,
        estimated_fee_cents: overridePlaybook.fitdDefaultFeeCents,
        repair_track: overrideRepairTrack,
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

  async getTriageResult(
    campaignId: string,
    ctx?: RequestCtx,
    opts?: { businessScopeOnly?: boolean },
  ): Promise<StoredTriageResult | null> {
    // Read-path scope guard: triage rows only exist for business-scope
    // campaigns. Short-circuit to null (→ route 404) for any other scope
    // instead of querying the triage table. Internal callers (archetype
    // resolution, hook suggestions, call scripts) omit this opt — they run
    // against business campaigns or tolerate a null result.
    if (opts?.businessScopeOnly) {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { scope: true },
      }) as any;
      if (!campaign || campaign.scope !== 'business') return null;
    }
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

  /**
   * Guard against the prospect-sibling uniqueness index
   * (idx_mkt_campaigns_prospect_sibling_playbook_unique from migration 184):
   *   (business_prospect_id, playbook_code)
   *   WHERE business_prospect_id IS NOT NULL AND scope = 'business'
   *     AND playbook_code IS NOT NULL.
   *
   * acceptTriage / overrideTriage stamp the effective playbook on the campaign,
   * which can collide with another sibling in the same prospect group that
   * already has the same playbook. Without this guard the DB throws an opaque
   * unique-constraint error; we surface a clean 409 instead so the operator
   * understands the conflict and can pick a different playbook or operate on
   * the existing sibling directly.
   *
   * Mirrors the check in BusinessProspectService.createSiblingCampaign.
   * No-op for campaigns without a business_prospect_id, non-business scope, or
   * a null target playbook (the partial index does not apply to them).
   */
  /**
   * Guard against triage being run on non-business-scope campaigns.
   * Triage re-categorizes a single business, stamps a playbook, and applies
   * a FITD fee — none of which apply to category/city-scope aggregate scans.
   * Without this, a category campaign with no website trivially fires
   * WC_MISSING_WEBSITE → PB-03 fallback and surfaces a meaningless
   * "Accept Recommendation" prompt to the operator.
   *
   * Returns 400 validation_error so the caller can distinguish it from a
   * 404 (missing campaign) or 409 (sibling conflict).
   *
   * No-op for business-scope campaigns. Throws NotFoundError if the campaign
   * does not exist (so callers see a 404, not a misleading scope error).
   */
  private async assertBusinessScope(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<void> {
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: { scope: true },
    }) as any;
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }
    if (campaign.scope !== 'business') {
      throw new ValidationError(
        `Triage is only available for business-scope campaigns ` +
        `(this campaign is '${campaign.scope}' scope). ` +
        `Derive a business-scope child campaign from the scan first.`,
      );
    }
  }

  private async assertNoSiblingPlaybookConflict(
    campaignId: string,
    targetPlaybookCode: string,
    ctx?: RequestCtx,
  ): Promise<void> {
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: { business_prospect_id: true, scope: true },
    }) as any;
    if (!campaign) return; // let the downstream update raise NotFound
    const prospectId = campaign.business_prospect_id as string | null;
    if (!prospectId || campaign.scope !== 'business') return;

    const conflict = await this.prisma.mkt_campaigns_list.findFirst({
      where: {
        business_prospect_id: prospectId,
        scope: 'business',
        playbook_code: targetPlaybookCode,
        NOT: { id: campaignId },
      } as any,
      select: { id: true, playbook_code: true, business_name: true },
    }) as any;
    if (conflict) {
      throw new ConflictError(
        `Cannot assign playbook '${targetPlaybookCode}': another sibling in this prospect ` +
        `already uses that playbook` +
        (conflict.business_name ? ` (business: ${conflict.business_name})` : '') +
        `. Pick a different playbook, or operate on the existing sibling directly.`,
      );
    }
  }

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
    // Two-lane verdict: 'full' only when the evaluation ran off a real
    // business_analysis audit. Stub audits (queue promotion, derive,
    // discovery_scan) and campaign-columns-only evaluations are 'partial'.
    // auditSource must be a KNOWN stub source — a real audit's audit_metadata
    // may carry a `source` key of its own (e.g. the importing model), which
    // does not make it a stub.
    const isStubSource = !!sourceAudit?.auditSource
      && (STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES as readonly string[]).includes(sourceAudit.auditSource);
    const verdict: 'partial' | 'full' =
      sourceAudit?.platform === 'business_analysis' && !isStubSource
        ? 'full'
        : 'partial';
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
      verdict,
      sourceAudit: sourceAudit ?? null,
    };
  }

  /**
   * Resolve a TriageSourceAudit from a stored source_audit_id by looking up
   * the audit row. Returns null if the id is null or the audit was deleted.
   * `auditSource` carries audit_metadata.source — set on stub audits
   * (manual_queue / queue_promotion / derived_from_parent / discovery_scan),
   * absent on real audit imports.
   */
  private async resolveSourceAudit(sourceAuditId: string | null): Promise<TriageSourceAudit | null> {
    if (!sourceAuditId) return null;
    const audit = await this.prisma.mkt_audits_list.findUnique({
      where: { id: sourceAuditId },
      select: { id: true, platform: true, created_at: true, audit_data: true },
    });
    if (!audit) return null;
    const auditSource =
      ((audit.audit_data as any)?.audit_metadata?.source as string | undefined) ?? null;
    return { id: audit.id, platform: audit.platform, createdAt: audit.created_at, auditSource };
  }

  /**
   * Refresh an undecided verdict after new evidence lands (two-lane triage).
   *
   * Called best-effort when a real business_analysis audit is imported: if the
   * campaign has no triage row, evaluate — the audit produces a 'full' verdict
   * for free. If it has an UNDECIDED row (e.g. a discovery partial), re-
   * evaluate — selectAuditForTriage prefers the real audit, so the full
   * verdict supersedes the partial. A decided verdict (operator accepted or
   * overrode) is never silently reset — the operator can re-evaluate manually.
   *
   * Returns the stored result when a refresh ran, null when skipped.
   */
  async refreshUndecidedVerdict(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<StoredTriageResult | null> {
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: { scope: true },
    }) as any;
    if (!campaign || campaign.scope !== 'business') return null;

    const existing = await this.prisma.mkt_campaign_triage_results.findUnique({
      where: { campaign_id: campaignId },
      select: { is_operator_accepted: true, overridden_playbook_id: true },
    });
    if (existing && (existing.is_operator_accepted === true || existing.overridden_playbook_id)) {
      return null; // operator decided — the full audit does not flip it
    }

    const refreshed = await this.evaluateTriageForCampaign({ campaignId }, ctx);
    logger.info('Triage verdict refreshed from business audit import', ctx, {
      campaignId,
      verdict: refreshed.verdict,
      playbookCode: refreshed.recommendedPlaybook.code,
      hadPriorResult: !!existing,
    });
    return refreshed;
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

    // 1. Prefer latest business_analysis audit. Queue-promotion stubs
    //    (manual_queue / queue_promotion / derived_from_parent) are skipped —
    //    they are not business_analysis audits; step 2 still picks them up as
    //    generic detected_signals carriers when no real audit exists, which
    //    is their designed role.
    const businessAnalysis = audits.find(
      (a) => a.platform === 'business_analysis' && !isStubBusinessAnalysisAudit(a),
    );
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
