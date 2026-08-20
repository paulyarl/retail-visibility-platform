/**
 * OutreachOpenerService — Personalized first-touch opener generation
 *
 * Generates outreach openers from a campaign's latest business_analysis
 * audit data via a dual execution path:
 *   - Path 1 (execute): deterministic archetype selection + LLM + quality gate
 *   - Path 2 (import):  quality gate on externally-pasted opener text
 *
 * Mirrors MarketingPromptService + MarketingExecutionService patterns.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_outreach_opener_sprint_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { generateOutreachOpenerId } from '../lib/id-generator';
import MarketingCampaignService from './MarketingCampaignService';
import CampaignTriageService from './CampaignTriageService';
import BusinessContextService from './deliverable/BusinessContextService';
import aiProviderFactory from './ai-providers';
import {
  selectArchetype,
  extractFields,
  buildArchetypePrompt,
  runQualityGate,
  DEFAULT_CLOSE_VARIANT,
  type BusinessAnalysisAuditData,
  type ArchetypeSelection,
  type ArchetypeFields,
  type CommonFields,
  type QualityGateResult,
  type CloseVariant,
} from './outreach-openers';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ExecuteOpenerInput {
  campaignId: string;
  closeVariant?: CloseVariant;
  executedBy?: string;
  // Operator name to substitute for "[your name]" in the signoff. When
  // provided, the resolved prompt and persisted opener text end with
  // "— <operatorName>" instead of the literal placeholder. When omitted,
  // the placeholder is left in place (legacy behavior).
  operatorName?: string;
}

export interface ImportOpenerInput {
  campaignId: string;
  openerText: string;
  closeVariant?: CloseVariant;
  executedBy?: string;
  // Operator name to record on the imported opener row for provenance.
  // The imported text is operator-authored (pasted from an external
  // agent), so we do NOT rewrite it — but we DO persist the operator
  // name on the row so the campaign knows who handled it. If the pasted
  // text still contains the literal "[your name]" placeholder and an
  // operatorName is provided, the placeholder is substituted so the
  // stored text is ready to send.
  operatorName?: string;
  // Hook angle attribution (Sprint 2 — Light-Score Hook Library).
  // When the opener is imported from the hook suggestion picker, this
  // records which angle was used so getSplitTestStats() can rank angles.
  // Validated against HOOK_LIBRARY keys at the route layer. null/omitted
  // for legacy imports and AI-generated openers.
  hookAngle?: string | null;
}

export interface OpenerResult {
  opener: any;
  selection: ArchetypeSelection;
  extractedFields: ArchetypeFields;
  qualityGate: QualityGateResult;
  resolvedPrompt: string;
}

// ─── Shared Archetype Resolver (Sprint 2 §5.5) ──────────────────────────
//
// The campaign has no persisted archetype column. Today every consumer
// (opener, header, closer, deliverable sections, render service) recomputes
// selectArchetype(auditData) independently, which diverges from the
// operator-accepted triage result. This shared helper centralizes the
// resolution: (1) read the accepted/overridden triage result's playbook →
// its archetype column; (2) fall back to selectArchetype(latestAuditData).
//
// Used by: DeliverableSectionService.generateAllSections,
//          DeliverableRenderService, HeaderService, CloserService.
//          OutreachOpenerService.executeOpener uses the same logic inline
//          (it needs the theme for A2, which the shared helper does not
//          return — but the helper covers the archetype-only consumers).

export interface ResolvedArchetype {
  archetype: ArchetypeSelection['archetype'];
  source: 'triage' | 'fallback';
  reason: string;
}

/**
 * Resolve the effective archetype for a campaign.
 *
 * Precedence:
 *   1. Operator-accepted triage result's playbook archetype (honors overrides)
 *   2. selectArchetype(latestAuditData) fallback
 *
 * Returns { archetype, source, reason }. Throws if no audit exists.
 */
export async function resolveCampaignArchetype(
  campaignId: string,
  ctx?: RequestCtx,
): Promise<ResolvedArchetype> {
  // 1. Check for an operator-accepted triage result
  let triageArchetype: string | null = null;
  try {
    const triage = await CampaignTriageService.getTriageResult(campaignId, ctx);
    if (triage?.isOperatorAccepted === true) {
      // Use overridden playbook if present, otherwise recommended
      const pb = triage.overriddenPlaybook ?? triage.recommendedPlaybook;
      if (pb?.archetype) {
        triageArchetype = pb.archetype;
      }
    }
  } catch {
    // Triage not found or not accepted — fall through to selectArchetype
  }

  if (
    triageArchetype &&
    ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].includes(triageArchetype)
  ) {
    return {
      archetype: triageArchetype as ArchetypeSelection['archetype'],
      source: 'triage',
      reason: `triage-accepted: ${triageArchetype} (playbook recommendation)`,
    };
  }

  // 2. Fallback: recompute from latest audit data
  const auditResult = await BusinessContextService.getLatestAuditData(campaignId, ctx);
  if (!auditResult) {
    throw new Error(
      `Campaign ${campaignId} has no business_analysis audit. Run a seek-stage business analysis first.`,
    );
  }

  const selection = selectArchetype(auditResult.auditData);
  return {
    archetype: selection.archetype,
    source: 'fallback',
    reason: selection.reason,
  };
}

// ─── Service ────────────────────────────────────────────────────────────

export class OutreachOpenerService extends BaseService {
  private static instance: OutreachOpenerService;

  private constructor() {
    super();
  }

  static getInstance(): OutreachOpenerService {
    if (!OutreachOpenerService.instance) {
      OutreachOpenerService.instance = new OutreachOpenerService();
    }
    return OutreachOpenerService.instance;
  }

  // ====================
  // AUDIT DATA RETRIEVAL
  // ====================

  /**
   * Fetch the latest business_analysis audit_data for a campaign.
   * Returns null if the campaign has no business_analysis audit.
   */
  private async getLatestBusinessAnalysisAudit(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<{ auditData: BusinessAnalysisAuditData; auditId: string } | null> {
    const campaign = await MarketingCampaignService.getCampaign(campaignId, ctx);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const audits = campaign.audits ?? [];
    // Find the latest business_analysis audit (by created_at desc).
    const businessAudits = audits
      .filter((a: any) => a.platform === 'business_analysis')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (businessAudits.length === 0) {
      return null;
    }

    const latest = businessAudits[0];
    return {
      auditData: latest.audit_data as BusinessAnalysisAuditData,
      auditId: latest.id,
    };
  }

  /**
   * Build the common fields (business_name, contact_name, tone, NAP) from a campaign.
   * NAP (Name, Address, Phone) context lets the AI agent identify the business
   * and cross-reference publicly available data when crafting the opener.
   */
  private buildCommonFields(campaign: any): CommonFields {
    return {
      business_name: campaign.business_name ?? 'your business',
      contact_name: campaign.contact_info ?? null, // contact_info holds a name if available
      tone: campaign.tone || 'short informal',
      city: campaign.city ?? null,
      state: campaign.state ?? null,
      phone: campaign.phone ?? null,
      website_url: campaign.website_url ?? null,
    };
  }

  // ====================
  // RESOLVE (no AI call — for Path 2 prompt display)
  // ====================

  /**
   * Resolve the archetype + extracted fields + prompt for a campaign
   * WITHOUT calling the LLM. Used by:
   *   - Path 2 (Import External Opener) to show the resolved prompt
   *   - The workspace UI to display the detected archetype + fields
   *
   * If `operatorName` is provided, the literal "[your name]" placeholder
   * in the signoff is substituted with the operator's name in the
   * returned `resolvedPrompt`, so the operator sees the exact opener
   * the AI will produce before they execute.
   */
  async resolveOpener(
    campaignId: string,
    closeVariant: CloseVariant = DEFAULT_CLOSE_VARIANT,
    ctx?: RequestCtx,
    operatorName?: string,
  ): Promise<{
    selection: ArchetypeSelection;
    extractedFields: ArchetypeFields;
    resolvedPrompt: string;
    closeVariant: CloseVariant;
  }> {
    const auditResult = await this.getLatestBusinessAnalysisAudit(campaignId, ctx);
    if (!auditResult) {
      throw new Error(
        `Campaign ${campaignId} has no business_analysis audit. Run a seek-stage business analysis first.`,
      );
    }

    const campaign = await MarketingCampaignService.getCampaign(campaignId, ctx);
    const common = this.buildCommonFields(campaign);

    // Sprint 6: If the campaign has an accepted triage result, use the
    // triage-derived archetype (which may be A5 — the only archetype
    // selectArchetype never returns). This is the "triage → opener" flow:
    // the operator accepts a playbook recommendation, and the opener
    // generation respects that decision instead of re-running the
    // deterministic selector.
    let selection: ArchetypeSelection;
    let triageArchetype: string | null = null;
    try {
      const triage = await CampaignTriageService.getTriageResult(campaignId, ctx);
      if (triage?.isOperatorAccepted === true) {
        const pb = triage.recommendedPlaybook;
        if (pb?.archetype) {
          triageArchetype = pb.archetype;
        }
      }
    } catch {
      // Triage not found or not accepted — fall through to selectArchetype
    }

    if (triageArchetype && ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].includes(triageArchetype)) {
      // Use the triage-derived archetype. For A2, we still need a theme —
      // re-run selectArchetype to get the theme if the triage archetype is A2.
      // For A5, there is no theme (it's dual-signal, not theme-driven).
      if (triageArchetype === 'A2') {
        const autoSel = selectArchetype(auditResult.auditData);
        selection = {
          archetype: 'A2',
          reason: `triage-accepted: A2 (PB recommendation). Theme: ${autoSel.theme?.theme ?? 'recurring negatives'}`,
          theme: autoSel.theme,
        };
      } else {
        selection = {
          archetype: triageArchetype as ArchetypeSelection['archetype'],
          reason: `triage-accepted: ${triageArchetype} (playbook recommendation)`,
        };
      }
    } else {
      selection = selectArchetype(auditResult.auditData);
    }

    const extractedFields = extractFields(
      selection.archetype,
      auditResult.auditData,
      common,
      selection.theme,
    );

    // Sprint 6: A5 fields leave days_since_last_review = -1 for the caller
    // to fill from campaign.last_review_date. Compute it here so the prompt
    // gets the real drought duration.
    if (selection.archetype === 'A5' && (extractedFields as any).days_since_last_review === -1) {
      const lastReview = (campaign as any).last_review_date as Date | string | null;
      if (lastReview) {
        const last = lastReview instanceof Date ? lastReview : new Date(lastReview);
        const days = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
        (extractedFields as any).days_since_last_review = days;
      } else {
        // No last_review_date — use the unaddressed count as the signal
        (extractedFields as any).days_since_last_review = 0;
      }
    }

    let resolvedPrompt = buildArchetypePrompt(
      selection.archetype,
      JSON.stringify(extractedFields, null, 2),
      closeVariant,
    );
    if (operatorName && operatorName.trim()) {
      resolvedPrompt = this.substituteSignoff(resolvedPrompt, operatorName);
    }

    return { selection, extractedFields, resolvedPrompt, closeVariant };
  }

  /**
   * Substitute the literal "[your name]" placeholder with the operator's
   * real name in an opener text or resolved prompt. Idempotent: a text
   * that already has a real name substituted is returned unchanged.
   * Trims and collapses internal whitespace in the name so " Alex "
   * becomes "Alex".
   */
  private substituteSignoff(text: string, operatorName: string): string {
    const name = operatorName.trim().replace(/\s+/g, ' ');
    if (!name) return text;
    return text.replace(/—\s*\[your name\]/g, `— ${name}`);
  }

  // ====================
  // EXECUTE (Path 1 — AI generation)
  // ====================

  /**
   * Execute opener generation via the AI provider.
   * 1. Resolve archetype + fields + prompt (deterministic)
   * 2. Call AI provider with the resolved prompt
   * 3. Run quality gate on the output
   * 4. Store the opener record
   */
  async executeOpener(input: ExecuteOpenerInput, ctx?: RequestCtx): Promise<OpenerResult> {
    const closeVariant = input.closeVariant ?? DEFAULT_CLOSE_VARIANT;
    const { selection, extractedFields, resolvedPrompt } = await this.resolveOpener(
      input.campaignId,
      closeVariant,
      ctx,
      input.operatorName,
    );

    logger.info('Executing outreach opener', ctx, {
      campaignId: input.campaignId,
      archetype: selection.archetype,
      reason: selection.reason,
      closeVariant,
      operatorName: input.operatorName ?? null,
    });

    // Call the AI provider (same factory as MarketingExecutionService).
    const result = await aiProviderFactory.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a marketing assistant writing a cold first-touch outreach opener for a local business prospect. Follow the prompt instructions precisely. Output only the opener text — no preamble, no explanation.',
        },
        { role: 'user', content: resolvedPrompt },
      ],
      maxTokens: 500, // Openers are short (~80 words); 500 tokens is generous
      temperature: 0.7,
    });

    // The AI may emit the literal "[your name]" placeholder even when the
    // resolved prompt substituted the operator's name. Substitute again
    // on the output so the persisted text is send-ready.
    let openerText = result.content.trim();
    if (input.operatorName && input.operatorName.trim()) {
      openerText = this.substituteSignoff(openerText, input.operatorName);
    }
    const qualityGate = runQualityGate(openerText);
    const tokensUsed = result.usage?.totalTokens || 0;
    const costCents = this.estimateCostCents(tokensUsed);

    // One opener per campaign is enforced by a partial unique index
    // (uq_mkt_outreach_openers_one_per_campaign WHERE message_type IS NULL).
    // Update the existing opener in place if one already exists, so
    // re-executing the AI opener doesn't 500 on the unique constraint.
    const existing = await this.prisma.mkt_outreach_openers_list.findFirst({
      where: {
        campaign_id: input.campaignId,
        OR: [{ message_type: null }, { message_type: { not: 'follow_up' } }],
      },
      orderBy: { executed_at: 'desc' },
    });

    const opener = existing
      ? await this.prisma.mkt_outreach_openers_list.update({
          where: { id: existing.id },
          data: {
            archetype: selection.archetype,
            close_variant: closeVariant,
            opener_text: openerText,
            quality_gate_passed: qualityGate.passed,
            quality_gate_issues: qualityGate.issues,
            source: 'ai',
            ai_provider: result.model.split('-')[0] || 'unknown',
            ai_model: result.model,
            tokens_used: tokensUsed,
            cost_cents: costCents,
            extracted_fields: extractedFields as any,
            executed_by: input.executedBy || null,
            operator_name: input.operatorName?.trim() || null,
          },
        })
      : await this.prisma.mkt_outreach_openers_list.create({
          data: {
            id: generateOutreachOpenerId(),
            campaign_id: input.campaignId,
            archetype: selection.archetype,
            close_variant: closeVariant,
            opener_text: openerText,
            quality_gate_passed: qualityGate.passed,
            quality_gate_issues: qualityGate.issues,
            source: 'ai',
            ai_provider: result.model.split('-')[0] || 'unknown',
            ai_model: result.model,
            tokens_used: tokensUsed,
            cost_cents: costCents,
            extracted_fields: extractedFields as any,
            executed_by: input.executedBy || null,
            operator_name: input.operatorName?.trim() || null,
          },
        });

    logger.info('Outreach opener executed', ctx, {
      openerId: opener.id,
      campaignId: input.campaignId,
      archetype: selection.archetype,
      closeVariant,
      qualityGatePassed: qualityGate.passed,
      issuesCount: qualityGate.issues.length,
      tokensUsed,
      costCents,
      model: result.model,
      replaced: !!existing,
    });

    // Fire-and-forget: auto-complete checklist outreach steps
    this.fireBridgeAutoComplete(input.campaignId, 'opener', input.executedBy ?? 'system', ctx);

    return { opener, selection, extractedFields, qualityGate, resolvedPrompt };
  }

  // ====================
  // IMPORT (Path 2 — external paste)
  // ====================

  /**
   * Import an externally-generated opener (e.g. from ChatGPT/Claude).
   * The archetype is already known from deterministic selection —
   * the external agent doesn't need to declare it.
   * 1. Resolve archetype + fields (deterministic, for provenance)
   * 2. Run quality gate on the pasted text
   * 3. Store the opener record with source='external'
   */
  async importOpener(input: ImportOpenerInput, ctx?: RequestCtx): Promise<OpenerResult> {
    const closeVariant = input.closeVariant ?? DEFAULT_CLOSE_VARIANT;
    const { selection, extractedFields, resolvedPrompt } = await this.resolveOpener(
      input.campaignId,
      closeVariant,
      ctx,
      input.operatorName,
    );

    let openerText = input.openerText.trim();
    if (!openerText) {
      throw new Error('Opener text cannot be empty');
    }
    // The operator may have pasted text that still contains the literal
    // "[your name]" placeholder (e.g. they ran the resolved prompt
    // without an operator name set). If an operatorName is provided,
    // substitute it so the stored text is send-ready. A real name already
    // present in the pasted text is left untouched (idempotent).
    if (input.operatorName && input.operatorName.trim()) {
      openerText = this.substituteSignoff(openerText, input.operatorName);
    }

    const qualityGate = runQualityGate(openerText);

    // One opener per campaign is enforced by a partial unique index
    // (uq_mkt_outreach_openers_one_per_campaign WHERE message_type IS NULL).
    // If an opener already exists for this campaign, update it in place
    // instead of inserting — otherwise the operator hits a 500 unique
    // constraint error when re-importing (e.g. because the previous import
    // was invisible due to the listOpeners NULL-filter bug).
    const existing = await this.prisma.mkt_outreach_openers_list.findFirst({
      where: {
        campaign_id: input.campaignId,
        OR: [{ message_type: null }, { message_type: { not: 'follow_up' } }],
      },
      orderBy: { executed_at: 'desc' },
    });

    const opener = existing
      ? await this.prisma.mkt_outreach_openers_list.update({
          where: { id: existing.id },
          data: {
            archetype: selection.archetype,
            close_variant: closeVariant,
            opener_text: openerText,
            quality_gate_passed: qualityGate.passed,
            quality_gate_issues: qualityGate.issues,
            source: 'external',
            extracted_fields: extractedFields as any,
            executed_by: input.executedBy || null,
            operator_name: input.operatorName?.trim() || null,
            hook_angle: input.hookAngle ?? null,
          },
        })
      : await this.prisma.mkt_outreach_openers_list.create({
          data: {
            id: generateOutreachOpenerId(),
            campaign_id: input.campaignId,
            archetype: selection.archetype,
            close_variant: closeVariant,
            opener_text: openerText,
            quality_gate_passed: qualityGate.passed,
            quality_gate_issues: qualityGate.issues,
            source: 'external',
            extracted_fields: extractedFields as any,
            executed_by: input.executedBy || null,
            operator_name: input.operatorName?.trim() || null,
            hook_angle: input.hookAngle ?? null,
          },
        });

    logger.info('Outreach opener imported', ctx, {
      openerId: opener.id,
      campaignId: input.campaignId,
      archetype: selection.archetype,
      closeVariant,
      qualityGatePassed: qualityGate.passed,
      issuesCount: qualityGate.issues.length,
      replaced: !!existing,
    });

    // Fire-and-forget: auto-complete checklist outreach steps
    this.fireBridgeAutoComplete(input.campaignId, 'opener', input.executedBy ?? 'system', ctx);

    return { opener, selection, extractedFields, qualityGate, resolvedPrompt };
  }

  // ====================
  // PATH 3: createFromBriefing (AI briefing → opener)
  // ====================

  /**
   * Create or update an opener from an AI briefing's opener_hook field.
   *
   * Thin variant of importOpener — same upsert + quality gate + bridge
   * autocomplete logic, but:
   *   - source = 'ai_briefing' (distinguishes from 'ai' and 'external')
   *   - hook_angle = null (the briefing's primary_angle is free-text and
   *     doesn't fit the VarChar(40) HOOK_ANGLE_KEYS-validated column)
   *   - extracted_fields includes { sourceBriefing, executionId, primaryAngle }
   *     for provenance
   *
   * Quality-gate failure does not block creation (mirrors importOpener): the
   * opener is stored with quality_gate_passed: false and the issues are
   * returned so the frontend can surface them.
   */
  async createFromBriefing(input: {
    campaignId: string;
    openerText: string;
    primaryAngle?: string | null;
    executedBy?: string;
    operatorName?: string;
    sourceBriefing: 'triage' | 'issue_audit';
    executionId?: string;
  }, ctx?: RequestCtx): Promise<OpenerResult> {
    const closeVariant = DEFAULT_CLOSE_VARIANT;
    const { selection, extractedFields, resolvedPrompt } = await this.resolveOpener(
      input.campaignId,
      closeVariant,
      ctx,
      input.operatorName,
    );

    let openerText = input.openerText.trim();
    if (!openerText) {
      throw new Error('Opener text cannot be empty');
    }
    if (input.operatorName && input.operatorName.trim()) {
      openerText = this.substituteSignoff(openerText, input.operatorName);
    }

    const qualityGate = runQualityGate(openerText);

    // Upsert — one opener per campaign (partial unique index).
    const existing = await this.prisma.mkt_outreach_openers_list.findFirst({
      where: {
        campaign_id: input.campaignId,
        OR: [{ message_type: null }, { message_type: { not: 'follow_up' } }],
      },
      orderBy: { executed_at: 'desc' },
    });

    const provenanceFields = {
      ...extractedFields,
      sourceBriefing: input.sourceBriefing,
      executionId: input.executionId ?? null,
      primaryAngle: input.primaryAngle ?? null,
    };

    const opener = existing
      ? await this.prisma.mkt_outreach_openers_list.update({
          where: { id: existing.id },
          data: {
            archetype: selection.archetype,
            close_variant: closeVariant,
            opener_text: openerText,
            quality_gate_passed: qualityGate.passed,
            quality_gate_issues: qualityGate.issues,
            source: 'ai_briefing',
            extracted_fields: provenanceFields as any,
            executed_by: input.executedBy || null,
            operator_name: input.operatorName?.trim() || null,
            hook_angle: null,
          },
        })
      : await this.prisma.mkt_outreach_openers_list.create({
          data: {
            id: generateOutreachOpenerId(),
            campaign_id: input.campaignId,
            archetype: selection.archetype,
            close_variant: closeVariant,
            opener_text: openerText,
            quality_gate_passed: qualityGate.passed,
            quality_gate_issues: qualityGate.issues,
            source: 'ai_briefing',
            extracted_fields: provenanceFields as any,
            executed_by: input.executedBy || null,
            operator_name: input.operatorName?.trim() || null,
            hook_angle: null,
          },
        });

    logger.info('Outreach opener created from briefing', ctx, {
      openerId: opener.id,
      campaignId: input.campaignId,
      archetype: selection.archetype,
      closeVariant,
      sourceBriefing: input.sourceBriefing,
      executionId: input.executionId,
      qualityGatePassed: qualityGate.passed,
      issuesCount: qualityGate.issues.length,
      replaced: !!existing,
    });

    // Fire-and-forget: auto-complete checklist outreach steps
    this.fireBridgeAutoComplete(input.campaignId, 'opener', input.executedBy ?? 'system', ctx);

    return { opener, selection, extractedFields, qualityGate, resolvedPrompt };
  }

  // ====================
  // BRIDGE (fire-and-forget checklist auto-complete)
  // ====================

  /**
   * Fire-and-forget call to OutreachChecklistBridgeService to auto-complete
   * any outreach checklist steps matching the artifact kind. Errors are
   * swallowed (logged) — checklist auto-completion must never break the
   * opener/follow-up flow.
   */
  private fireBridgeAutoComplete(
    campaignId: string,
    artifactKind: 'opener' | 'follow_up' | 'pitch' | 'contact_log',
    actor: string,
    ctx?: RequestCtx,
  ): void {
    import('./OutreachChecklistBridgeService')
      .then(({ default: bridge }) => bridge.onOutreachArtifactCreated(campaignId, artifactKind, actor, ctx))
      .catch((err) => {
        logger.warn('fireBridgeAutoComplete failed (swallowed)', ctx, {
          error: (err as Error).message,
          campaignId,
          artifactKind,
        });
      });
  }

  // ====================
  // READ
  // ====================

  async listOpeners(campaignId?: string, ctx?: RequestCtx): Promise<any[]> {
    // Openers have message_type = NULL; follow-ups have message_type = 'follow_up'.
    // Prisma's `{ not: 'follow_up' }` compiles to `!= 'follow_up'`, which excludes
    // NULL rows under SQL three-valued logic (NULL != 'follow_up' → NULL → row
    // dropped). That made imported/AI openers invisible to this query, so the
    // operator couldn't see the opener they just saved. The OR clause includes
    // NULL openers, matching the migration's documented
    // `message_type IS DISTINCT FROM 'follow_up'` filter.
    const where: any = { OR: [{ message_type: null }, { message_type: { not: 'follow_up' } }] };
    if (campaignId) where.campaign_id = campaignId;
    try {
      return await this.prisma.mkt_outreach_openers_list.findMany({
        where,
        orderBy: { executed_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list outreach openers', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async getOpener(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_outreach_openers_list.findUnique({ where: { id } });
    } catch (error) {
      logger.error('Failed to get outreach opener', ctx, {
        error: (error as Error).message,
        openerId: id,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // SPLIT-TEST ANALYTICS
  // ====================

  /**
   * Outcomes that count as a "reply" — any outcome where a human at the
   * prospect business responded (positively or negatively). Excludes
   * no_answer, left_message, and auto_follow_up_scheduled (no human
   * contact). This is the reply-rate numerator.
   *
   * Rationale: at this stage the messaging/opener strategy is unsettled,
   * so we log all human-contact signals up front. Stage advancement
   * (paid/delivered) is a downstream signal better suited to an
   * established flow.
   */
  private static readonly REPLY_OUTCOMES = new Set([
    'reached',
    'interested',
    'not_interested',
    'callback_scheduled',
  ]);

  /**
   * Aggregate split-test stats grouped by close_variant. For each cohort:
   *   - openers generated (total)
   *   - campaigns sent (stage >= 'shown' — the opener was actually used)
   *   - replies (campaigns with at least one outreach log entry whose
   *     outcome is in REPLY_OUTCOMES)
   *   - reply rate (replies / sent)
   *   - outcome breakdown (count per outcome type)
   *
   * Also returns per-cohort campaign drill-down with: business name,
   * stage, archetype, latest outreach outcome, reply status.
   *
   * Only openers with close_variant IS NOT NULL are included (legacy
   * NULL openers are excluded from the split-test view).
   */
  async getSplitTestStats(ctx?: RequestCtx): Promise<{
    cohorts: SplitTestCohort[];
    totals: { openers: number; sent: number; replies: number; replyRate: number };
    byHookAngle: HookAngleStats[];
    byChannel: ChannelStats[];
    byAngleChannel: AngleChannelStats[];
  }> {
    try {
      // Fetch all openers with a close_variant set, newest first.
      const openers = await this.prisma.mkt_outreach_openers_list.findMany({
        where: { close_variant: { not: null }, OR: [{ message_type: null }, { message_type: { not: 'follow_up' } }] },
        orderBy: { executed_at: 'desc' },
        select: {
          id: true,
          campaign_id: true,
          archetype: true,
          close_variant: true,
          source: true,
          quality_gate_passed: true,
          executed_at: true,
          hook_angle: true,
        },
      });

      if (openers.length === 0) {
        return { cohorts: [], totals: { openers: 0, sent: 0, replies: 0, replyRate: 0 }, byHookAngle: [], byChannel: [], byAngleChannel: [] };
      }

      // Collect unique campaign IDs and map opener → campaign.
      const campaignIds = [...new Set(openers.map((o) => o.campaign_id))];

      // Fetch campaigns for those IDs.
      const campaigns = await this.prisma.mkt_campaigns_list.findMany({
        where: { id: { in: campaignIds } },
        select: {
          id: true,
          business_name: true,
          stage: true,
          city: true,
          service_category: true,
          date_shown: true,
        },
      });
      const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

      // Fetch all outreach log entries for these campaigns.
      const logs = await this.prisma.mkt_outreach_log.findMany({
        where: { campaign_id: { in: campaignIds } },
        orderBy: { contact_date: 'desc' },
        select: {
          campaign_id: true,
          outcome: true,
          channel: true,
          contact_date: true,
        },
      });

      // Per-campaign: latest outcome + whether any reply outcome exists.
      const campaignOutcomes = new Map<string, { latest: string | null; replied: boolean; outcomes: Record<string, number> }>();
      for (const log of logs) {
        const existing = campaignOutcomes.get(log.campaign_id) ?? { latest: null, replied: false, outcomes: {} as Record<string, number> };
        // logs are ordered desc by contact_date, so the first entry we
        // encounter for a campaign is the latest.
        if (existing.latest === null) {
          existing.latest = log.outcome;
        }
        if (OutreachOpenerService.REPLY_OUTCOMES.has(log.outcome)) {
          existing.replied = true;
        }
        existing.outcomes[log.outcome] = (existing.outcomes[log.outcome] ?? 0) + 1;
        campaignOutcomes.set(log.campaign_id, existing);
      }

      // Group openers by close_variant. If a campaign has multiple
      // openers (e.g. one soft + one direct_paid), each opener is its
      // own row in the cohort — but for "sent" counting we dedupe by
      // campaign within each cohort (a campaign is sent once per
      // cohort it appears in, which should be once).
      const SENT_STAGES = new Set(['shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'tenant_onboarded']);

      const cohortMap = new Map<string, {
        variant: string;
        openers: number;
        sentCampaignIds: Set<string>;
        repliedCampaignIds: Set<string>;
        allCampaignIds: Set<string>;
        outcomeBreakdown: Record<string, number>;
        campaigns: SplitTestCampaignRow[];
      }>();

      for (const opener of openers) {
        const variant = opener.close_variant!;
        const cohort = cohortMap.get(variant) ?? {
          variant,
          openers: 0,
          sentCampaignIds: new Set<string>(),
          repliedCampaignIds: new Set<string>(),
          allCampaignIds: new Set<string>(),
          outcomeBreakdown: {} as Record<string, number>,
          campaigns: [] as SplitTestCampaignRow[],
        };

        cohort.openers++;
        cohort.allCampaignIds.add(opener.campaign_id);

        const campaign = campaignMap.get(opener.campaign_id);
        const outcomes = campaignOutcomes.get(opener.campaign_id);
        const isSent = campaign ? SENT_STAGES.has(campaign.stage) : false;
        const replied = outcomes?.replied ?? false;

        if (isSent) {
          cohort.sentCampaignIds.add(opener.campaign_id);
          if (replied) {
            cohort.repliedCampaignIds.add(opener.campaign_id);
          }
          // Merge outcome breakdown (only for sent campaigns — those are
          // the ones that matter for reply-rate measurement).
          if (outcomes) {
            for (const [outcome, count] of Object.entries(outcomes.outcomes)) {
              cohort.outcomeBreakdown[outcome] = (cohort.outcomeBreakdown[outcome] ?? 0) + count;
            }
          }
        }

        // Add to campaign drill-down (only one row per campaign per cohort).
        if (campaign && !cohort.campaigns.some((c) => c.campaign_id === opener.campaign_id)) {
          cohort.campaigns.push({
            campaign_id: opener.campaign_id,
            business_name: campaign.business_name ?? 'Unknown',
            stage: campaign.stage,
            city: campaign.city ?? null,
            service_category: campaign.service_category ?? null,
            archetype: opener.archetype,
            close_variant: variant,
            opener_source: opener.source,
            quality_gate_passed: opener.quality_gate_passed,
            sent: isSent,
            replied,
            latest_outcome: outcomes?.latest ?? null,
            date_shown: campaign.date_shown ?? null,
          });
        }

        cohortMap.set(variant, cohort);
      }

      // Build cohort results.
      const cohorts: SplitTestCohort[] = [...cohortMap.values()].map((c) => {
        const sent = c.sentCampaignIds.size;
        const replies = c.repliedCampaignIds.size;
        return {
          variant: c.variant,
          openers: c.openers,
          campaigns: c.allCampaignIds.size,
          sent,
          replies,
          replyRate: sent > 0 ? replies / sent : 0,
          outcomeBreakdown: c.outcomeBreakdown,
          campaignRows: c.campaigns.sort((a, b) => {
            // Sent + replied first, then sent, then unsent.
            if (a.sent !== b.sent) return a.sent ? -1 : 1;
            if (a.replied !== b.replied) return a.replied ? -1 : 1;
            return a.business_name.localeCompare(b.business_name);
          }),
        };
      });

      // Sort cohorts: direct_paid first, then soft (deterministic order).
      cohorts.sort((a, b) => a.variant.localeCompare(b.variant));

      const totalSent = cohorts.reduce((sum, c) => sum + c.sent, 0);
      const totalReplies = cohorts.reduce((sum, c) => sum + c.replies, 0);
      const totalOpeners = cohorts.reduce((sum, c) => sum + c.openers, 0);

      // ─── byHookAngle grouping (Sprint 2 — Light-Score Hook Library) ────
      // Group openers by hook_angle (only those with a non-null angle).
      // For each angle: count openers, sent campaigns, replies, reply rate.
      const angleMap = new Map<string, {
        angle: string;
        openers: number;
        sentCampaignIds: Set<string>;
        repliedCampaignIds: Set<string>;
      }>();

      for (const opener of openers) {
        const angle = opener.hook_angle;
        if (!angle) continue;

        const entry = angleMap.get(angle) ?? {
          angle,
          openers: 0,
          sentCampaignIds: new Set<string>(),
          repliedCampaignIds: new Set<string>(),
        };

        entry.openers++;
        const campaign = campaignMap.get(opener.campaign_id);
        const outcomes = campaignOutcomes.get(opener.campaign_id);
        const isSent = campaign ? SENT_STAGES.has(campaign.stage) : false;
        const replied = outcomes?.replied ?? false;

        if (isSent) {
          entry.sentCampaignIds.add(opener.campaign_id);
          if (replied) {
            entry.repliedCampaignIds.add(opener.campaign_id);
          }
        }

        angleMap.set(angle, entry);
      }

      const byHookAngle: HookAngleStats[] = [...angleMap.values()].map((a) => {
        const sent = a.sentCampaignIds.size;
        const replies = a.repliedCampaignIds.size;
        return {
          angle: a.angle,
          openers: a.openers,
          sent,
          replies,
          replyRate: sent > 0 ? replies / sent : 0,
        };
      }).sort((a, b) => {
        // Most sent first, then most replies, then alpha
        if (a.sent !== b.sent) return b.sent - a.sent;
        if (a.replies !== b.replies) return b.replies - a.replies;
        return a.angle.localeCompare(b.angle);
      });

      // ─── byChannel grouping (Sprint 2 — Phone Analytics) ──────────────
      // Group outreach logs by channel. For each channel: total contacts,
      // replies (outcome in REPLY_OUTCOMES), reply rate, outcome breakdown.
      // wrong_number and disconnected_number are excluded from reply-rate
      // calculations (they're data-quality outcomes, not human contact).
      const channelMap = new Map<string, {
        channel: string;
        contacts: number;
        replies: number;
        outcomes: Record<string, number>;
      }>();

      for (const log of logs) {
        const ch = log.channel ?? 'unknown';
        const entry = channelMap.get(ch) ?? {
          channel: ch,
          contacts: 0,
          replies: 0,
          outcomes: {} as Record<string, number>,
        };
        entry.contacts++;
        entry.outcomes[log.outcome] = (entry.outcomes[log.outcome] ?? 0) + 1;
        if (OutreachOpenerService.REPLY_OUTCOMES.has(log.outcome)) {
          entry.replies++;
        }
        channelMap.set(ch, entry);
      }

      const byChannel: ChannelStats[] = [...channelMap.values()].map((c) => ({
        channel: c.channel,
        contacts: c.contacts,
        replies: c.replies,
        replyRate: c.contacts > 0 ? c.replies / c.contacts : 0,
        outcomeBreakdown: c.outcomes,
      })).sort((a, b) => b.contacts - a.contacts);

      // ─── byAngleChannel matrix (Sprint 2 — Phone Analytics) ───────────
      // Cross-tabulate hook_angle × channel using opener→campaign→log join.
      // For each (angle, channel) pair: contacts, replies, reply rate.
      const angleChannelMap = new Map<string, {
        angle: string;
        channel: string;
        contacts: number;
        replies: number;
      }>();

      // Build a map from campaign_id → hook_angle (from openers)
      const campaignAngleMap = new Map<string, string>();
      for (const opener of openers) {
        if (opener.hook_angle && !campaignAngleMap.has(opener.campaign_id)) {
          campaignAngleMap.set(opener.campaign_id, opener.hook_angle);
        }
      }

      for (const log of logs) {
        const angle = campaignAngleMap.get(log.campaign_id);
        if (!angle) continue;
        const ch = log.channel ?? 'unknown';
        const key = `${angle}|${ch}`;
        const entry = angleChannelMap.get(key) ?? {
          angle,
          channel: ch,
          contacts: 0,
          replies: 0,
        };
        entry.contacts++;
        if (OutreachOpenerService.REPLY_OUTCOMES.has(log.outcome)) {
          entry.replies++;
        }
        angleChannelMap.set(key, entry);
      }

      const byAngleChannel: AngleChannelStats[] = [...angleChannelMap.values()].map((ac) => ({
        angle: ac.angle,
        channel: ac.channel,
        contacts: ac.contacts,
        replies: ac.replies,
        replyRate: ac.contacts > 0 ? ac.replies / ac.contacts : 0,
      })).sort((a, b) => {
        if (a.angle !== b.angle) return a.angle.localeCompare(b.angle);
        return a.channel.localeCompare(b.channel);
      });

      return {
        cohorts,
        totals: {
          openers: totalOpeners,
          sent: totalSent,
          replies: totalReplies,
          replyRate: totalSent > 0 ? totalReplies / totalSent : 0,
        },
        byHookAngle,
        byChannel,
        byAngleChannel,
      };
    } catch (error) {
      logger.error('Failed to get split-test stats', ctx, {
        error: (error as Error).message,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // HELPERS
  // ====================

  private estimateCostCents(tokens: number): number {
    // Rough estimate: $0.002 per 1K tokens = 0.2 cents per 1K tokens
    return Math.ceil((tokens / 1000) * 0.2);
  }
}

// ─── Split-test types (exported for route + web consumption) ────────────

export interface SplitTestCampaignRow {
  campaign_id: string;
  business_name: string;
  stage: string;
  city: string | null;
  service_category: string | null;
  archetype: string;
  close_variant: string;
  opener_source: string;
  quality_gate_passed: boolean;
  sent: boolean;
  replied: boolean;
  latest_outcome: string | null;
  date_shown: Date | null;
}

export interface SplitTestCohort {
  variant: string;
  openers: number;
  campaigns: number;
  sent: number;
  replies: number;
  replyRate: number;
  outcomeBreakdown: Record<string, number>;
  campaignRows: SplitTestCampaignRow[];
}

export interface HookAngleStats {
  angle: string;
  openers: number;
  sent: number;
  replies: number;
  replyRate: number;
}

export interface ChannelStats {
  channel: string;
  contacts: number;
  replies: number;
  replyRate: number;
  outcomeBreakdown: Record<string, number>;
}

export interface AngleChannelStats {
  angle: string;
  channel: string;
  contacts: number;
  replies: number;
  replyRate: number;
}
