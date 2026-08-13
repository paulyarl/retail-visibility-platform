/**
 * HeaderService — Outreach pitch header (subject line) variants
 *
 * Mirrors OutreachOpenerService's dual execution path:
 *   - Path 1 (execute): deterministic archetype selection + LLM + quality gate
 *   - Path 2 (import):  quality gate on externally-pasted subject line
 *
 * The header prompt reuses the same archetype selection + extracted fields
 * as the opener (from outreach-openers), so the subject line can name the
 * same audit signal the opener leads with.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §5.1
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { generateOutreachHeaderId } from '../../lib/id-generator';
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
import { buildHeaderPromptForArchetype } from './prompts';
import { runHeaderQualityGate, type QualityGateResult } from './quality-gates';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ExecuteHeaderInput {
  campaignId: string;
  executedBy?: string;
}

export interface ImportHeaderInput {
  campaignId: string;
  headerText: string;
  executedBy?: string;
}

export interface HeaderResult {
  header: any;
  selection: ArchetypeSelection;
  extractedFields: ArchetypeFields;
  qualityGate: QualityGateResult;
  resolvedPrompt: string;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class HeaderService extends BaseService {
  private static instance: HeaderService;

  private constructor() {
    super();
  }

  static getInstance(): HeaderService {
    if (!HeaderService.instance) {
      HeaderService.instance = new HeaderService();
    }
    return HeaderService.instance;
  }

  // ====================
  // AUDIT DATA RETRIEVAL (mirrors OutreachOpenerService)
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

  // ====================
  // RESOLVE (no AI call — for Path 2 prompt display)
  // ====================

  async resolveHeader(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<{
    selection: ArchetypeSelection;
    extractedFields: ArchetypeFields;
    resolvedPrompt: string;
  }> {
    const auditResult = await this.getLatestBusinessAnalysisAudit(campaignId, ctx);
    if (!auditResult) {
      throw new Error(
        `Campaign ${campaignId} has no business_analysis audit. Run a seek-stage business analysis first.`,
      );
    }

    const campaign = await MarketingCampaignService.getCampaign(campaignId, ctx);
    const common = this.buildCommonFields(campaign);

    // Sprint 2 (§5.6): Use the shared archetype resolver so the header
    // matches the operator-accepted triage result (honors overrides).
    let selection: ArchetypeSelection;
    let resolvedArchetype: string;
    try {
      const resolved = await resolveCampaignArchetype(campaignId, ctx);
      resolvedArchetype = resolved.archetype;
      // For A2, we still need a theme — re-run selectArchetype to get it.
      // For other archetypes, the theme is optional.
      const autoSel = selectArchetype(auditResult.auditData);
      selection = resolved.archetype === 'A2'
        ? { archetype: 'A2', reason: resolved.reason, theme: autoSel.theme }
        : { archetype: resolved.archetype as ArchetypeSelection['archetype'], reason: resolved.reason };
    } catch {
      // Fallback to deterministic selection if resolver fails
      selection = selectArchetype(auditResult.auditData);
      resolvedArchetype = selection.archetype;
    }

    const extractedFields = extractFields(
      selection.archetype,
      auditResult.auditData,
      common,
      selection.theme,
    );

    const resolvedPrompt = buildHeaderPromptForArchetype(
      resolvedArchetype,
      JSON.stringify(extractedFields, null, 2),
    );

    return { selection, extractedFields, resolvedPrompt };
  }

  // ====================
  // EXECUTE (Path 1 — AI generation)
  // ====================

  async executeHeader(input: ExecuteHeaderInput, ctx?: RequestCtx): Promise<HeaderResult> {
    const { selection, extractedFields, resolvedPrompt } = await this.resolveHeader(
      input.campaignId,
      ctx,
    );

    logger.info('Executing outreach header', ctx, {
      campaignId: input.campaignId,
      archetype: selection.archetype,
    });

    const result = await aiProviderFactory.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a marketing assistant writing a cold first-touch outreach subject line for a local business prospect. Follow the prompt instructions precisely. Output only the subject line — no preamble, no quotes, no explanation.',
        },
        { role: 'user', content: resolvedPrompt },
      ],
      maxTokens: 100, // Subject lines are short; 100 tokens is generous
      temperature: 0.7,
    });

    const headerText = result.content.trim();
    const qualityGate = runHeaderQualityGate(headerText, selection.archetype);
    const tokensUsed = result.usage?.totalTokens || 0;
    const costCents = this.estimateCostCents(tokensUsed);

    const header = await this.prisma.mkt_outreach_headers_list.create({
      data: {
        id: generateOutreachHeaderId(),
        campaign_id: input.campaignId,
        header_text: headerText,
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

    logger.info('Outreach header executed', ctx, {
      headerId: header.id,
      campaignId: input.campaignId,
      qualityGatePassed: qualityGate.passed,
      issuesCount: qualityGate.issues.length,
      tokensUsed,
      costCents,
      model: result.model,
    });

    return { header, selection, extractedFields, qualityGate, resolvedPrompt };
  }

  // ====================
  // IMPORT (Path 2 — external paste)
  // ====================

  async importHeader(input: ImportHeaderInput, ctx?: RequestCtx): Promise<HeaderResult> {
    const { selection, extractedFields, resolvedPrompt } = await this.resolveHeader(
      input.campaignId,
      ctx,
    );

    const headerText = input.headerText.trim();
    if (!headerText) {
      throw new Error('Header text cannot be empty');
    }

    const qualityGate = runHeaderQualityGate(headerText, selection.archetype);

    const header = await this.prisma.mkt_outreach_headers_list.create({
      data: {
        id: generateOutreachHeaderId(),
        campaign_id: input.campaignId,
        header_text: headerText,
        quality_gate_passed: qualityGate.passed,
        quality_gate_issues: qualityGate.issues,
        source: 'external',
        extracted_fields: extractedFields as any,
        executed_by: input.executedBy || null,
      },
    });

    logger.info('Outreach header imported', ctx, {
      headerId: header.id,
      campaignId: input.campaignId,
      qualityGatePassed: qualityGate.passed,
      issuesCount: qualityGate.issues.length,
    });

    return { header, selection, extractedFields, qualityGate, resolvedPrompt };
  }

  // ====================
  // READ
  // ====================

  async listHeaders(campaignId?: string, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (campaignId) where.campaign_id = campaignId;
    try {
      return await this.prisma.mkt_outreach_headers_list.findMany({
        where,
        orderBy: { executed_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list outreach headers', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async getHeader(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_outreach_headers_list.findUnique({ where: { id } });
    } catch (error) {
      logger.error('Failed to get outreach header', ctx, {
        error: (error as Error).message,
        headerId: id,
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

export default HeaderService.getInstance();
