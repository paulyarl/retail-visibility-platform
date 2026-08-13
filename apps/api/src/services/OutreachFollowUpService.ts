/**
 * OutreachFollowUpService — Follow-up message generation for non-responders
 *
 * Generates follow-up messages for prospects who didn't reply to the
 * opener. Two execution paths (mirroring the opener service):
 *   - Path 1 (execute): fresh-snapshot diff → branch selection → LLM → quality gate
 *   - Path 2 (import):  quality gate on externally-pasted follow-up text
 *
 * The follow-up is stored in the same table as the opener
 * (mkt_outreach_openers_list) with message_type='follow_up'. The
 * opener's close_variant is inherited so the cohort is consistent
 * across the full message sequence.
 *
 * Branch selection (doing vs telling) is automatic:
 *   - Re-pull fresh audit data via MarketingOutreachService.buildFreshSnapshot
 *   - Diff against the opener's stored data_snapshot
 *   - If review_count or unaddressed_reviews changed → 'doing'
 *   - Otherwise → 'telling'
 *
 * Pattern: singleton extends BaseService (mirrors OutreachOpenerService)
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import type { RequestCtx } from '../context';
import { generateOutreachOpenerId } from '../lib/id-generator';
import MarketingCampaignService from './MarketingCampaignService';
import { MarketingOutreachService } from './MarketingOutreachService';
import aiProviderFactory from './ai-providers';
import {
  selectArchetype,
  extractFields,
  type ArchetypeSelection,
  type ArchetypeFields,
  type BusinessAnalysisAuditData,
  type CommonFields,
  type CloseVariant,
  DEFAULT_CLOSE_VARIANT,
} from './outreach-openers';
import {
  buildFollowUpPrompt,
  runFollowUpQualityGate,
  type FollowUpType,
  type FollowUpDataDiff,
  type FollowUpQualityGateResult,
} from './outreach-followups';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ResolveFollowUpInput {
  campaignId: string;
  closeVariant?: CloseVariant;
  operatorName?: string;
}

export interface ExecuteFollowUpInput {
  campaignId: string;
  closeVariant?: CloseVariant;
  executedBy?: string;
  operatorName?: string;
}

export interface ImportFollowUpInput {
  campaignId: string;
  followUpText: string;
  closeVariant?: CloseVariant;
  followUpType?: FollowUpType;
  executedBy?: string;
  operatorName?: string;
}

export interface FollowUpResolution {
  opener: any;
  selection: ArchetypeSelection;
  extractedFields: ArchetypeFields;
  followUpType: FollowUpType;
  dataDiff: FollowUpDataDiff | null;
  freshSnapshot: any;
  resolvedPrompt: string;
  closeVariant: CloseVariant;
  followUpNumber: number;
}

export interface FollowUpResult {
  followUp: any;
  opener: any;
  selection: ArchetypeSelection;
  extractedFields: ArchetypeFields;
  followUpType: FollowUpType;
  qualityGate: FollowUpQualityGateResult;
  resolvedPrompt: string;
}

// ─── Service ────────────────────────────────────────────────────────────

export class OutreachFollowUpService extends BaseService {
  private static instance: OutreachFollowUpService;

  private constructor() {
    super();
  }

  static getInstance(): OutreachFollowUpService {
    if (!OutreachFollowUpService.instance) {
      OutreachFollowUpService.instance = new OutreachFollowUpService();
    }
    return OutreachFollowUpService.instance;
  }

  // ====================
  // RESOLVE (no LLM call)
  // ====================

  /**
   * Resolve the follow-up for a campaign WITHOUT calling the LLM.
   *
   * 1. Find the campaign's opener (message_type IS NULL, latest executed_at)
   * 2. Re-pull fresh audit data (buildFreshSnapshot)
   * 3. Diff against the opener's stored data_snapshot
   * 4. Auto-select branch: 'doing' if data changed, 'telling' if not
   * 5. Build the follow-up prompt with the diff + close variant
   *
   * Returns the resolved prompt for preview + the branch selection +
   * the data diff (for transparency).
   */
  async resolveFollowUp(input: ResolveFollowUpInput, ctx?: RequestCtx): Promise<FollowUpResolution> {
    // 1. Find the campaign's opener.
    const opener = await this.prisma.mkt_outreach_openers_list.findFirst({
      where: {
        campaign_id: input.campaignId,
        // Openers have message_type = NULL. `{ not: 'follow_up' }` alone
        // excludes NULL rows (SQL three-valued logic), so the opener lookup
        // would fail and block follow-up creation. Include NULL via OR.
        OR: [{ message_type: null }, { message_type: { not: 'follow_up' } }],
      },
      orderBy: { executed_at: 'desc' },
    });

    if (!opener) {
      // This is a campaign-state precondition, not a backend bug.
      // 409 Conflict — the campaign exists but isn't in a state that
      // permits follow-up generation yet (no opener to follow up on).
      throw new ConflictError('No opener found for this campaign. Generate an opener first.');
    }

    // 2. Get the campaign's audit data for archetype selection + field extraction.
    const campaign = await MarketingCampaignService.getCampaign(input.campaignId, ctx);
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    // Find the latest business_analysis audit (same pattern as opener service).
    const audits = campaign.audits ?? [];
    const businessAudits = audits
      .filter((a: any) => a.platform === 'business_analysis')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (businessAudits.length === 0) {
      throw new NotFoundError('No business_analysis audit found for this campaign');
    }

    const auditData = businessAudits[0].audit_data as BusinessAnalysisAuditData;

    // 3. Deterministic archetype selection + field extraction (same as opener).
    const selection = selectArchetype(auditData);
    const common = this.buildCommonFields(campaign);
    const extractedFields = extractFields(
      selection.archetype,
      auditData,
      common,
      selection.theme,
    );

    // 4. Re-pull fresh snapshot and diff against the opener's stored snapshot.
    const outreachService = MarketingOutreachService.getInstance();
    const freshSnapshot = await outreachService.buildFreshSnapshot(input.campaignId, ctx);

    const openerSnapshot = (opener as any).extracted_fields ?? null;
    const dataDiff = this.computeDiff(openerSnapshot, freshSnapshot.dataSnapshot);

    // 5. Auto-select branch based on whether data changed.
    const followUpType: FollowUpType = dataDiff?.new_review_count ? 'doing' : 'telling';

    // 6. Determine the follow-up number (count existing follow-ups + 1).
    const existingFollowUps = await this.prisma.mkt_outreach_openers_list.count({
      where: {
        campaign_id: input.campaignId,
        message_type: 'follow_up',
      },
    });
    const followUpNumber = existingFollowUps + 1;

    // 7. Inherit the opener's close variant (or use the provided override).
    const closeVariant = input.closeVariant ?? (opener.close_variant as CloseVariant) ?? DEFAULT_CLOSE_VARIANT;

    // 8. Build the resolved prompt.
    let resolvedPrompt = buildFollowUpPrompt(
      selection.archetype,
      followUpType,
      JSON.stringify(extractedFields, null, 2),
      dataDiff,
      closeVariant,
    );

    // Substitute operator name in the signoff if provided.
    if (input.operatorName && input.operatorName.trim()) {
      resolvedPrompt = this.substituteSignoff(resolvedPrompt, input.operatorName);
    }

    return {
      opener,
      selection,
      extractedFields,
      followUpType,
      dataDiff,
      freshSnapshot: freshSnapshot.dataSnapshot,
      resolvedPrompt,
      closeVariant,
      followUpNumber,
    };
  }

  // ====================
  // EXECUTE (Path 1 — AI generation)
  // ====================

  /**
   * Execute the follow-up: resolve → LLM call → quality gate → persist.
   */
  async executeFollowUp(input: ExecuteFollowUpInput, ctx?: RequestCtx): Promise<FollowUpResult> {
    const { opener, selection, extractedFields, followUpType, dataDiff, resolvedPrompt, closeVariant, followUpNumber } =
      await this.resolveFollowUp(
        {
          campaignId: input.campaignId,
          closeVariant: input.closeVariant,
          operatorName: input.operatorName,
        },
        ctx,
      );

    logger.info('Executing outreach follow-up', ctx, {
      campaignId: input.campaignId,
      archetype: selection.archetype,
      followUpType,
      followUpNumber,
      closeVariant,
      operatorName: input.operatorName ?? null,
    });

    // Call the AI provider.
    const result = await aiProviderFactory.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a marketing assistant writing a follow-up outreach message for a local business prospect who did not reply to the first touch. Follow the prompt instructions precisely. Output only the follow-up text — no preamble, no explanation.',
        },
        { role: 'user', content: resolvedPrompt },
      ],
      maxTokens: 400, // Follow-ups are shorter than openers
      temperature: 0.7,
    });

    // Substitute operator name on the output (same as opener service).
    let followUpText = result.content.trim();
    if (input.operatorName && input.operatorName.trim()) {
      followUpText = this.substituteSignoff(followUpText, input.operatorName);
    }

    const qualityGate = runFollowUpQualityGate(followUpText, followUpType);
    const tokensUsed = result.usage?.totalTokens || 0;
    const costCents = this.estimateCostCents(tokensUsed);

    const followUp = await this.prisma.mkt_outreach_openers_list.create({
      data: {
        id: generateOutreachOpenerId(),
        campaign_id: input.campaignId,
        archetype: selection.archetype,
        opener_text: followUpText, // reused column — holds the follow-up text
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
        close_variant: closeVariant,
        message_type: 'follow_up',
        followup_type: followUpType,
        followup_number: followUpNumber,
        opener_id: opener.id,
        data_diff: dataDiff as any,
      },
    });

    logger.info('Outreach follow-up executed', ctx, {
      followUpId: followUp.id,
      campaignId: input.campaignId,
      archetype: selection.archetype,
      followUpType,
      followUpNumber,
      closeVariant,
      qualityGatePassed: qualityGate.passed,
      issuesCount: qualityGate.issues.length,
      tokensUsed,
      costCents,
      model: result.model,
    });

    // Fire-and-forget: auto-complete checklist outreach steps
    this.fireBridgeAutoComplete(input.campaignId, 'follow_up', input.executedBy ?? 'system', ctx);

    return {
      followUp,
      opener,
      selection,
      extractedFields,
      followUpType,
      qualityGate,
      resolvedPrompt,
    };
  }

  // ====================
  // IMPORT (Path 2 — external paste)
  // ====================

  /**
   * Import an externally-generated follow-up (e.g. from ChatGPT/Claude).
   * The archetype + branch are known from deterministic resolution —
   * the external agent doesn't need to declare them.
   */
  async importFollowUp(input: ImportFollowUpInput, ctx?: RequestCtx): Promise<FollowUpResult> {
    const { opener, selection, extractedFields, followUpType: resolvedType, dataDiff, resolvedPrompt, closeVariant, followUpNumber } =
      await this.resolveFollowUp(
        {
          campaignId: input.campaignId,
          closeVariant: input.closeVariant,
          operatorName: input.operatorName,
        },
        ctx,
      );

    let followUpText = input.followUpText.trim();
    if (!followUpText) {
      throw new ValidationError('Follow-up text cannot be empty');
    }
    if (input.operatorName && input.operatorName.trim()) {
      followUpText = this.substituteSignoff(followUpText, input.operatorName);
    }

    // Use the provided followUpType or fall back to the resolved one.
    const followUpType = input.followUpType ?? resolvedType;
    const qualityGate = runFollowUpQualityGate(followUpText, followUpType);

    const followUp = await this.prisma.mkt_outreach_openers_list.create({
      data: {
        id: generateOutreachOpenerId(),
        campaign_id: input.campaignId,
        archetype: selection.archetype,
        opener_text: followUpText,
        quality_gate_passed: qualityGate.passed,
        quality_gate_issues: qualityGate.issues,
        source: 'external',
        extracted_fields: extractedFields as any,
        executed_by: input.executedBy || null,
        operator_name: input.operatorName?.trim() || null,
        close_variant: closeVariant,
        message_type: 'follow_up',
        followup_type: followUpType,
        followup_number: followUpNumber,
        opener_id: opener.id,
        data_diff: dataDiff as any,
      },
    });

    logger.info('Outreach follow-up imported', ctx, {
      followUpId: followUp.id,
      campaignId: input.campaignId,
      archetype: selection.archetype,
      followUpType,
      followUpNumber,
      closeVariant,
      qualityGatePassed: qualityGate.passed,
      issuesCount: qualityGate.issues.length,
    });

    // Fire-and-forget: auto-complete checklist outreach steps
    this.fireBridgeAutoComplete(input.campaignId, 'follow_up', input.executedBy ?? 'system', ctx);

    return {
      followUp,
      opener,
      selection,
      extractedFields,
      followUpType,
      qualityGate,
      resolvedPrompt,
    };
  }

  // ====================
  // BRIDGE (fire-and-forget checklist auto-complete)
  // ====================

  /**
   * Fire-and-forget call to OutreachChecklistBridgeService to auto-complete
   * any outreach checklist steps matching the artifact kind. Errors are
   * swallowed (logged) — checklist auto-completion must never break the
   * follow-up flow.
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

  async listFollowUps(campaignId?: string, ctx?: RequestCtx): Promise<any[]> {
    const where: any = { message_type: 'follow_up' };
    if (campaignId) where.campaign_id = campaignId;
    try {
      return await this.prisma.mkt_outreach_openers_list.findMany({
        where,
        orderBy: [{ campaign_id: 'asc' }, { followup_number: 'asc' }],
      });
    } catch (error) {
      logger.error('Failed to list outreach follow-ups', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // HELPERS
  // ====================

  /**
   * Build the common fields from a campaign. Same implementation as
   * OutreachOpenerService.buildCommonFields — kept duplicated rather
   * than shared to avoid coupling the two services.
   */
  private buildCommonFields(campaign: any): CommonFields {
    return {
      business_name: campaign.business_name ?? 'your business',
      contact_name: campaign.contact_info ?? null,
      tone: campaign.tone || 'short informal',
      city: campaign.city ?? null,
      state: campaign.state ?? null,
      phone: campaign.phone ?? null,
      website_url: campaign.website_url ?? null,
    };
  }

  /**
   * Compute the diff between the opener's stored snapshot and the fresh
   * snapshot. Returns null if nothing changed (→ telling branch).
   *
   * The diff compares review_count and unaddressed_reviews — the two
   * metrics most likely to change in a 3-7 day window. If either
   * increased, the branch is 'doing'.
   */
  private computeDiff(
    openerSnapshot: any,
    freshSnapshot: any,
  ): FollowUpDataDiff | null {
    if (!openerSnapshot || !freshSnapshot) {
      return null;
    }

    const openerReviewCount = openerSnapshot.review_count ?? 0;
    const freshReviewCount = freshSnapshot.review_count ?? 0;
    const openerUnaddressed = openerSnapshot.unaddressed_reviews ?? 0;
    const freshUnaddressed = freshSnapshot.unaddressed_reviews ?? 0;

    const newReviewCount = freshReviewCount - openerReviewCount;
    const newUnaddressed = freshUnaddressed - openerUnaddressed;

    if (newReviewCount <= 0 && newUnaddressed <= 0) {
      // Nothing changed → telling branch
      return null;
    }

    return {
      new_review_count: Math.max(newReviewCount, 0),
      new_negative_count: Math.max(newUnaddressed - newReviewCount, 0),
      new_themes: [], // themes not available in snapshot; would need full audit diff
      new_platforms: [], // platforms not available in snapshot
      opener_theme: openerSnapshot.theme ?? undefined,
      opener_archetype: openerSnapshot.archetype ?? undefined,
    };
  }

  /**
   * Substitute the literal "[your name]" placeholder with the operator's
   * real name. Idempotent. Same implementation as OutreachOpenerService.
   */
  private substituteSignoff(text: string, operatorName: string): string {
    const name = operatorName.trim().replace(/\s+/g, ' ');
    if (!name) return text;
    return text.replace(/—\s*\[your name\]/g, `— ${name}`);
  }

  private estimateCostCents(tokens: number): number {
    return Math.ceil((tokens / 1000) * 0.2);
  }
}
