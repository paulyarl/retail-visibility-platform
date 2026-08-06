/**
 * CloserService — Outreach pitch closer variants
 *
 * Mirrors HeaderService's dual execution path. The closer's `resolveCloser`
 * pre-fills the editable template with the computed remaining count:
 *   remaining = combined_review_metrics.observable_unanswered_reviews − 3
 * (the 3 shown in the preview). The operator can override the number and
 * wording per variant.
 *
 * AI generation is optional — the template is often enough; AI varies the
 * phrasing for split-testing.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §5.2, §3.2
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { generateOutreachCloserId } from '../../lib/id-generator';
import MarketingCampaignService from '../MarketingCampaignService';
import aiProviderFactory from '../ai-providers';
import {
  selectArchetype,
  extractFields,
  type BusinessAnalysisAuditData,
  type ArchetypeSelection,
  type ArchetypeFields,
  type CommonFields,
} from '../outreach-openers';
import { resolveCampaignArchetype } from '../OutreachOpenerService';
import { buildCloserPromptForArchetype } from './prompts';
import { runCloserQualityGate, type QualityGateResult } from './quality-gates';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ExecuteCloserInput {
  campaignId: string;
  executedBy?: string;
}

export interface ImportCloserInput {
  campaignId: string;
  closerText: string;
  executedBy?: string;
}

export interface CloserResult {
  closer: any;
  selection: ArchetypeSelection;
  extractedFields: ArchetypeFields;
  qualityGate: QualityGateResult;
  resolvedPrompt: string;
  remaining: number;
  defaultTemplate: string;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class CloserService extends BaseService {
  private static instance: CloserService;

  private constructor() {
    super();
  }

  static getInstance(): CloserService {
    if (!CloserService.instance) {
      CloserService.instance = new CloserService();
    }
    return CloserService.instance;
  }

  // ====================
  // AUDIT DATA RETRIEVAL (mirrors HeaderService)
  // ====================

  private async getLatestBusinessAnalysisAudit(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<{ auditData: BusinessAnalysisAuditData; auditId: string } | null> {
    const campaign = await MarketingCampaignService.getCampaign(campaignId, ctx);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const audits = campaign.audits ?? [];
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
   * Compute the remaining count for the closer template:
   *   remaining = observable_unanswered_reviews − 3 (the 3 shown in the preview)
   * Floors at 0.
   */
  private computeRemaining(auditData: BusinessAnalysisAuditData): number {
    const unanswered = auditData.combined_review_metrics?.observable_unanswered_reviews ?? 0;
    return Math.max(0, unanswered - 3);
  }

  /**
   * Build the default editable template string with the remaining count
   * substituted in.
   */
  buildDefaultTemplate(remaining: number): string {
    return `The remaining ${remaining} responses are written and ready to deliver today.`;
  }

  // ====================
  // RESOLVE (no AI call — for Path 2 prompt display + template pre-fill)
  // ====================

  async resolveCloser(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<{
    selection: ArchetypeSelection;
    extractedFields: ArchetypeFields;
    resolvedPrompt: string;
    remaining: number;
    defaultTemplate: string;
  }> {
    const auditResult = await this.getLatestBusinessAnalysisAudit(campaignId, ctx);
    if (!auditResult) {
      throw new Error(
        `Campaign ${campaignId} has no business_analysis audit. Run a seek-stage business analysis first.`,
      );
    }

    const campaign = await MarketingCampaignService.getCampaign(campaignId, ctx);
    const common = this.buildCommonFields(campaign);

    // Sprint 2 (§5.6): Use the shared archetype resolver so the closer
    // matches the operator-accepted triage result (honors overrides).
    let selection: ArchetypeSelection;
    let resolvedArchetype: string;
    try {
      const resolved = await resolveCampaignArchetype(campaignId, ctx);
      resolvedArchetype = resolved.archetype;
      const autoSel = selectArchetype(auditResult.auditData);
      selection = resolved.archetype === 'A2'
        ? { archetype: 'A2', reason: resolved.reason, theme: autoSel.theme }
        : { archetype: resolved.archetype as ArchetypeSelection['archetype'], reason: resolved.reason };
    } catch {
      selection = selectArchetype(auditResult.auditData);
      resolvedArchetype = selection.archetype;
    }

    const extractedFields = extractFields(
      selection.archetype,
      auditResult.auditData,
      common,
      selection.theme,
    );

    const remaining = this.computeRemaining(auditResult.auditData);
    const defaultTemplate = this.buildDefaultTemplate(remaining);
    const resolvedPrompt = buildCloserPromptForArchetype(
      resolvedArchetype,
      JSON.stringify(extractedFields, null, 2),
      remaining,
    );

    return { selection, extractedFields, resolvedPrompt, remaining, defaultTemplate };
  }

  // ====================
  // EXECUTE (Path 1 — AI generation)
  // ====================

  async executeCloser(input: ExecuteCloserInput, ctx?: RequestCtx): Promise<CloserResult> {
    const { selection, extractedFields, resolvedPrompt, remaining, defaultTemplate } =
      await this.resolveCloser(input.campaignId, ctx);

    logger.info('Executing outreach closer', ctx, {
      campaignId: input.campaignId,
      archetype: selection.archetype,
      remaining,
    });

    const result = await aiProviderFactory.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a marketing assistant writing the closer line for a cold first-touch outreach pitch to a local business prospect. Follow the prompt instructions precisely. Output only the closer line — no preamble, no signoff, no explanation.',
        },
        { role: 'user', content: resolvedPrompt },
      ],
      maxTokens: 100, // Closers are short (≤25 words); 100 tokens is generous
      temperature: 0.7,
    });

    const closerText = result.content.trim();
    const qualityGate = runCloserQualityGate(closerText);
    const tokensUsed = result.usage?.totalTokens || 0;
    const costCents = this.estimateCostCents(tokensUsed);

    const closer = await this.prisma.mkt_outreach_closers_list.create({
      data: {
        id: generateOutreachCloserId(),
        campaign_id: input.campaignId,
        closer_text: closerText,
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

    logger.info('Outreach closer executed', ctx, {
      closerId: closer.id,
      campaignId: input.campaignId,
      qualityGatePassed: qualityGate.passed,
      issuesCount: qualityGate.issues.length,
      tokensUsed,
      costCents,
      model: result.model,
    });

    return {
      closer,
      selection,
      extractedFields,
      qualityGate,
      resolvedPrompt,
      remaining,
      defaultTemplate,
    };
  }

  // ====================
  // IMPORT (Path 2 — external paste, or template-edited text)
  // ====================

  async importCloser(input: ImportCloserInput, ctx?: RequestCtx): Promise<CloserResult> {
    const { selection, extractedFields, resolvedPrompt, remaining, defaultTemplate } =
      await this.resolveCloser(input.campaignId, ctx);

    const closerText = input.closerText.trim();
    if (!closerText) {
      throw new Error('Closer text cannot be empty');
    }

    const qualityGate = runCloserQualityGate(closerText);

    const closer = await this.prisma.mkt_outreach_closers_list.create({
      data: {
        id: generateOutreachCloserId(),
        campaign_id: input.campaignId,
        closer_text: closerText,
        quality_gate_passed: qualityGate.passed,
        quality_gate_issues: qualityGate.issues,
        source: 'external',
        extracted_fields: extractedFields as any,
        executed_by: input.executedBy || null,
      },
    });

    logger.info('Outreach closer imported', ctx, {
      closerId: closer.id,
      campaignId: input.campaignId,
      qualityGatePassed: qualityGate.passed,
      issuesCount: qualityGate.issues.length,
    });

    return {
      closer,
      selection,
      extractedFields,
      qualityGate,
      resolvedPrompt,
      remaining,
      defaultTemplate,
    };
  }

  // ====================
  // READ
  // ====================

  async listClosers(campaignId?: string, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (campaignId) where.campaign_id = campaignId;
    try {
      return await this.prisma.mkt_outreach_closers_list.findMany({
        where,
        orderBy: { executed_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list outreach closers', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async getCloser(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_outreach_closers_list.findUnique({ where: { id } });
    } catch (error) {
      logger.error('Failed to get outreach closer', ctx, {
        error: (error as Error).message,
        closerId: id,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // HELPERS
  // ====================

  private estimateCostCents(tokens: number): number {
    return Math.ceil((tokens / 1000) * 0.2);
  }
}

export default CloserService.getInstance();
