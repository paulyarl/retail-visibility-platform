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
}

export interface ImportOpenerInput {
  campaignId: string;
  openerText: string;
  closeVariant?: CloseVariant;
  executedBy?: string;
}

export interface OpenerResult {
  opener: any;
  selection: ArchetypeSelection;
  extractedFields: ArchetypeFields;
  qualityGate: QualityGateResult;
  resolvedPrompt: string;
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
   */
  async resolveOpener(
    campaignId: string,
    closeVariant: CloseVariant = DEFAULT_CLOSE_VARIANT,
    ctx?: RequestCtx,
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

    const selection = selectArchetype(auditResult.auditData);
    const extractedFields = extractFields(
      selection.archetype,
      auditResult.auditData,
      common,
      selection.theme,
    );

    const resolvedPrompt = buildArchetypePrompt(
      selection.archetype,
      JSON.stringify(extractedFields, null, 2),
      closeVariant,
    );

    return { selection, extractedFields, resolvedPrompt, closeVariant };
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
    );

    logger.info('Executing outreach opener', ctx, {
      campaignId: input.campaignId,
      archetype: selection.archetype,
      reason: selection.reason,
      closeVariant,
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

    const openerText = result.content.trim();
    const qualityGate = runQualityGate(openerText);
    const tokensUsed = result.usage?.totalTokens || 0;
    const costCents = this.estimateCostCents(tokensUsed);

    const opener = await this.prisma.mkt_outreach_openers_list.create({
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
    });

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
    );

    const openerText = input.openerText.trim();
    if (!openerText) {
      throw new Error('Opener text cannot be empty');
    }

    const qualityGate = runQualityGate(openerText);

    const opener = await this.prisma.mkt_outreach_openers_list.create({
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
      },
    });

    logger.info('Outreach opener imported', ctx, {
      openerId: opener.id,
      campaignId: input.campaignId,
      archetype: selection.archetype,
      closeVariant,
      qualityGatePassed: qualityGate.passed,
      issuesCount: qualityGate.issues.length,
    });

    return { opener, selection, extractedFields, qualityGate, resolvedPrompt };
  }

  // ====================
  // READ
  // ====================

  async listOpeners(campaignId?: string, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
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
  // HELPERS
  // ====================

  private estimateCostCents(tokens: number): number {
    // Rough estimate: $0.002 per 1K tokens = 0.2 cents per 1K tokens
    return Math.ceil((tokens / 1000) * 0.2);
  }
}
