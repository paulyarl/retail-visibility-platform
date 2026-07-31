/**
 * MarketingPromptService — Prompt template CRUD + AI execution
 *
 * Manages versioned prompt templates and executes them via AIProviderService.
 * Quality filter flags are created for responses that fail validation checks.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { generatePromptTemplateId, generatePromptExecutionId, generateFilterFlagId, generateMarketingAuditId } from '../lib/id-generator';
import { resolveOutputSchema } from '../validators/market-analysis.schema';
import { assertScopeCompatible, ScopeMismatchError } from './scope-utils';
import MarketingCampaignService from './MarketingCampaignService';

export type PromptType = 'seek' | 'fulfill' | 'filter' | 'retainer' | 'category_analysis' | 'city_analysis';

export type PromptScope = 'business' | 'category' | 'city';

export interface PromptTemplateInput {
  name: string;
  promptType: PromptType;
  scope?: PromptScope;
  category?: string;
  tone?: string;
  body: string;
  variables?: any;
  outputSchema?: any;
  isDefault?: boolean;
  createdBy?: string;
}

export interface PromptExecutionInput {
  campaignId: string;
  templateId?: string;
  variablesUsed?: any;
  executedBy?: string;
}

export class MarketingPromptService extends BaseService {
  private static instance: MarketingPromptService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingPromptService {
    if (!MarketingPromptService.instance) {
      MarketingPromptService.instance = new MarketingPromptService();
    }
    return MarketingPromptService.instance;
  }

  // ====================
  // PROMPT TEMPLATES
  // ====================

  async createTemplate(input: PromptTemplateInput, ctx?: RequestCtx): Promise<any> {
    const id = generatePromptTemplateId();
    const scope = input.scope ?? (input.promptType === 'category_analysis' ? 'category' : input.promptType === 'city_analysis' ? 'city' : 'business');
    try {
      if (input.isDefault) {
        await this.clearDefaultForType(input.promptType, scope, input.category, input.tone);
      }
      const template = await this.prisma.mkt_prompt_templates_list.create({
        data: {
          id,
          name: input.name,
          prompt_type: input.promptType,
          scope,
          category: input.category || null,
          tone: input.tone || null,
          version: 1,
          body: input.body,
          variables: input.variables || null,
          output_schema: input.outputSchema ?? null,
          is_active: true,
          is_default: input.isDefault || false,
          created_by: input.createdBy || null,
        },
      });
      logger.info('Prompt template created', ctx, { templateId: id, name: input.name, type: input.promptType });
      return template;
    } catch (error) {
      logger.error('Failed to create prompt template', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async getTemplate(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_prompt_templates_list.findUnique({ where: { id } });
    } catch (error) {
      logger.error('Failed to get prompt template', ctx, { error: (error as Error).message, templateId: id });
      throw this.handleError(error, ctx);
    }
  }

  async listTemplates(filters: { promptType?: PromptType; scope?: PromptScope; category?: string; tone?: string; isActive?: boolean } = {}, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (filters.promptType) where.prompt_type = filters.promptType;
    if (filters.scope) where.scope = filters.scope;
    if (filters.category) where.category = filters.category;
    if (filters.tone) where.tone = filters.tone;
    if (filters.isActive !== undefined) where.is_active = filters.isActive;
    try {
      return await this.prisma.mkt_prompt_templates_list.findMany({
        where,
        orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
      });
    } catch (error) {
      logger.error('Failed to list prompt templates', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updateTemplate(id: string, input: Partial<PromptTemplateInput>, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.promptType !== undefined) data.prompt_type = input.promptType;
    if (input.scope !== undefined) data.scope = input.scope;
    if (input.category !== undefined) data.category = input.category;
    if (input.tone !== undefined) data.tone = input.tone;
    if (input.body !== undefined) data.body = input.body;
    if (input.variables !== undefined) data.variables = input.variables;
    if (input.outputSchema !== undefined) data.output_schema = input.outputSchema;
    if (input.isDefault !== undefined) {
      if (input.isDefault) {
        const current = await this.prisma.mkt_prompt_templates_list.findUnique({ where: { id } });
        if (current) {
          const targetScope = (input.scope ?? current.scope) as PromptScope;
          const targetPromptType = (input.promptType ?? current.prompt_type) as PromptType;
          await this.clearDefaultForType(targetPromptType, targetScope, input.category ?? current.category, input.tone ?? current.tone);
        }
      }
      data.is_default = input.isDefault;
    }

    try {
      return await this.prisma.mkt_prompt_templates_list.update({ where: { id }, data });
    } catch (error) {
      logger.error('Failed to update prompt template', ctx, { error: (error as Error).message, templateId: id });
      throw this.handleError(error, ctx);
    }
  }

  async deleteTemplate(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_prompt_templates_list.delete({ where: { id } });
      logger.info('Prompt template deleted', ctx, { templateId: id });
    } catch (error) {
      logger.error('Failed to delete prompt template', ctx, { error: (error as Error).message, templateId: id });
      throw this.handleError(error, ctx);
    }
  }

  async cloneTemplate(id: string, overrides: { name?: string; createdBy?: string } = {}, ctx?: RequestCtx): Promise<any> {
    const original = await this.getTemplate(id, ctx);
    if (!original) {
      throw new Error('Prompt template not found');
    }
    const cloneName = (overrides.name || `Copy of ${original.name}`).slice(0, 100);
    return this.createTemplate({
      name: cloneName,
      promptType: original.prompt_type as PromptType,
      scope: original.scope as PromptScope,
      category: original.category,
      tone: original.tone,
      body: original.body,
      variables: original.variables,
      outputSchema: original.output_schema,
      isDefault: false,
      createdBy: overrides.createdBy,
    }, ctx);
  }

  private async clearDefaultForType(promptType: string, scope: PromptScope, category: string | null | undefined, tone: string | null | undefined): Promise<void> {
    await this.prisma.mkt_prompt_templates_list.updateMany({
      where: {
        prompt_type: promptType,
        scope,
        is_default: true,
        ...(category ? { category } : {}),
        ...(tone ? { tone } : {}),
      },
      data: { is_default: false },
    });
  }

  // ====================
  // PROMPT EXECUTIONS
  // ====================

  async createExecution(input: PromptExecutionInput, ctx?: RequestCtx): Promise<any> {
    const id = generatePromptExecutionId();
    try {
      const execution = await this.prisma.mkt_prompt_executions_list.create({
        data: {
          id,
          campaign_id: input.campaignId,
          template_id: input.templateId || null,
          variables_used: input.variablesUsed || null,
          executed_by: input.executedBy || null,
          status: 'pending',
        },
      });
      logger.info('Prompt execution created', ctx, { executionId: id, campaignId: input.campaignId });
      return execution;
    } catch (error) {
      logger.error('Failed to create prompt execution', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updateExecution(id: string, input: {
    rawOutput?: string;
    filteredOutput?: string;
    passRate?: number;
    flaggedCount?: number;
    status?: string;
    aiProvider?: string;
    aiModel?: string;
    tokensUsed?: number;
    costCents?: number;
  }, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.rawOutput !== undefined) data.raw_output = input.rawOutput;
    if (input.filteredOutput !== undefined) data.filtered_output = input.filteredOutput;
    if (input.passRate !== undefined) data.pass_rate = input.passRate;
    if (input.flaggedCount !== undefined) data.flagged_count = input.flaggedCount;
    if (input.status !== undefined) data.status = input.status;
    if (input.aiProvider !== undefined) data.ai_provider = input.aiProvider;
    if (input.aiModel !== undefined) data.ai_model = input.aiModel;
    if (input.tokensUsed !== undefined) data.tokens_used = input.tokensUsed;
    if (input.costCents !== undefined) data.cost_cents = input.costCents;

    try {
      return await this.prisma.mkt_prompt_executions_list.update({ where: { id }, data });
    } catch (error) {
      logger.error('Failed to update prompt execution', ctx, { error: (error as Error).message, executionId: id });
      throw this.handleError(error, ctx);
    }
  }

  async getExecution(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_prompt_executions_list.findUnique({
        where: { id },
        include: {
          mkt_filter_flags_list: true,
          mkt_prompt_templates_list: true,
        },
      });
    } catch (error) {
      logger.error('Failed to get prompt execution', ctx, { error: (error as Error).message, executionId: id });
      throw this.handleError(error, ctx);
    }
  }

  async listExecutions(campaignId?: string, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (campaignId) where.campaign_id = campaignId;
    try {
      return await this.prisma.mkt_prompt_executions_list.findMany({
        where,
        orderBy: { executed_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list prompt executions', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // EXTERNAL RESULT IMPORT
  // ====================

  /**
   * Import an external agent's JSON result as a prompt execution + optional audit.
   *
   * Flow:
   *   1. Load template + campaign; assert scope compatibility (S0b).
   *   2. Parse raw_output as JSON; validate against the template's declared
   *      output_schema (via OUTPUT_SCHEMA_REGISTRY). Throws on invalid JSON
   *      or schema mismatch with field-level Zod issues.
   *   3. Transactionally create:
   *      a. mkt_prompt_executions_list record (status='completed', source='external')
   *      b. mkt_audits_list record IF the output_schema's auditPlatform is set
   *         (keyed off output_schema->>'name', NOT prompt_type — fixes G18).
   *
   * Returns { execution, audit }.
   */
  async importExternalResult(input: {
    campaignId: string;
    templateId: string;
    rawOutput: string;
    source?: string;
    costCents?: number;
    executedBy?: string;
  }, ctx?: RequestCtx): Promise<{ execution: any; audit: any | null }> {
    try {
      // 1. Load template + campaign
      const template = await this.getTemplate(input.templateId, ctx);
      if (!template) {
        throw new Error(`Template ${input.templateId} not found`);
      }
      const campaign = await MarketingCampaignService.getCampaign(input.campaignId, ctx);
      if (!campaign) {
        throw new Error(`Campaign ${input.campaignId} not found`);
      }

      // 2. Scope check (S0b)
      assertScopeCompatible(template, campaign);

      // 3. Parse + validate JSON against the template's output_schema
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(input.rawOutput);
      } catch (e) {
        throw new Error('raw_output is not valid JSON');
      }

      const schemaName = template.output_schema?.name ?? null;
      const resolved = resolveOutputSchema(schemaName);
      if (!resolved) {
        throw new Error(
          `Template "${template.name}" does not declare a recognized output_schema (got "${schemaName ?? 'none'}"). ` +
          `Cannot validate external result. Add an output_schema to the template first.`,
        );
      }

      const validationResult = resolved.validator.safeParse(parsedJson);
      if (!validationResult.success) {
        const issues = validationResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        throw new Error(`External result does not match the "${schemaName}" output schema: ${issues}`);
      }

      // 4. Transactionally create execution + audit
      const executionId = generatePromptExecutionId();
      const result = await this.prisma.$transaction(async (tx) => {
        const execution = await tx.mkt_prompt_executions_list.create({
          data: {
            id: executionId,
            campaign_id: input.campaignId,
            template_id: input.templateId,
            executed_by: input.executedBy || undefined,
            status: 'completed',
            raw_output: input.rawOutput,
            filtered_output: input.rawOutput,
            ai_provider: input.source || 'external',
            cost_cents: input.costCents ?? undefined,
          },
        });

        let audit: any = null;
        if (resolved.auditPlatform) {
          const auditId = generateMarketingAuditId();
          // Extract audit-relevant fields from the validated JSON.
          // market_analysis exposes GBP metrics at parsedJson.market_analysis;
          // regional_city_opportunity is a regional scan with no single
          // business-level rating, so we store the full payload in audit_data
          // and leave the scalar audit columns at their defaults.
          const ma = parsedJson.market_analysis;
          const hasMarketAnalysis = !!ma;
          audit = await tx.mkt_audits_list.create({
            data: {
              id: auditId,
              campaign_id: input.campaignId,
              platform: resolved.auditPlatform,
              review_count: hasMarketAnalysis ? (ma?.average_gbp_metrics?.average_review_count ?? 0) : 0,
              average_rating: hasMarketAnalysis ? (ma?.average_gbp_metrics?.average_rating ?? undefined) : undefined,
              unaddressed_reviews: 0,
              owner_response_rate: 0,
              photo_count: 0,
              mobile_friendly: undefined,
              audit_data: parsedJson,
            },
          });
        }

        return { execution, audit };
      });

      logger.info('External result imported', ctx, {
        executionId,
        campaignId: input.campaignId,
        templateId: input.templateId,
        schemaName,
        auditCreated: !!result.audit,
      });

      return result;
    } catch (error) {
      if (error instanceof ScopeMismatchError) {
        logger.warn('External import scope mismatch', ctx, { error: error.message });
      } else {
        logger.error('Failed to import external result', ctx, { error: (error as Error).message });
      }
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // FILTER FLAGS
  // ====================

  async createFilterFlag(input: {
    executionId: string;
    responseNumber?: number;
    failedChecks?: any;
    suggestedFix?: string;
  }, ctx?: RequestCtx): Promise<any> {
    const id = generateFilterFlagId();
    try {
      const flag = await this.prisma.mkt_filter_flags_list.create({
        data: {
          id,
          execution_id: input.executionId,
          response_number: input.responseNumber || null,
          failed_checks: input.failedChecks || null,
          suggested_fix: input.suggestedFix || null,
          status: 'pending',
        },
      });
      logger.info('Filter flag created', ctx, { flagId: id, executionId: input.executionId });
      return flag;
    } catch (error) {
      logger.error('Failed to create filter flag', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updateFilterFlag(id: string, input: {
    humanOverride?: string;
    reviewedBy?: string;
    status?: string;
  }, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.humanOverride !== undefined) data.human_override = input.humanOverride;
    if (input.reviewedBy !== undefined) data.reviewed_by = input.reviewedBy;
    if (input.status !== undefined) data.status = input.status;
    if (input.reviewedBy !== undefined || input.status !== undefined) data.reviewed_at = new Date();

    try {
      return await this.prisma.mkt_filter_flags_list.update({ where: { id }, data });
    } catch (error) {
      logger.error('Failed to update filter flag', ctx, { error: (error as Error).message, flagId: id });
      throw this.handleError(error, ctx);
    }
  }

  async listFilterFlags(executionId?: string, status?: string, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (executionId) where.execution_id = executionId;
    if (status) where.status = status;
    try {
      return await this.prisma.mkt_filter_flags_list.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list filter flags', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }
}

export default MarketingPromptService.getInstance();
