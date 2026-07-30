/**
 * MarketingExecutionService — Batch prompt execution via AIProviderService
 *
 * Handles batch execution of prompts across multiple campaigns using the
 * existing AIProviderService and AiProviderFactory. Tracks costs, tokens,
 * and flags responses that fail quality checks.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { MarketingPromptService } from './MarketingPromptService';
import MarketingCampaignService from './MarketingCampaignService';
import aiProviderFactory from './ai-providers';

export interface BatchExecutionInput {
  campaignIds: string[];
  templateId: string;
  variables?: Record<string, any>;
  executedBy?: string;
}

export interface ExecutionResult {
  campaignId: string;
  executionId: string;
  success: boolean;
  error?: string;
}

export class MarketingExecutionService extends BaseService {
  private static instance: MarketingExecutionService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingExecutionService {
    if (!MarketingExecutionService.instance) {
      MarketingExecutionService.instance = new MarketingExecutionService();
    }
    return MarketingExecutionService.instance;
  }

  /**
   * Execute a prompt template against multiple campaigns in batch.
   * Uses AIProviderService for actual AI calls (injected in Sprint 2).
   * Sprint 1: creates execution records and returns them for later processing.
   */
  async executeBatch(input: BatchExecutionInput, ctx?: RequestCtx): Promise<ExecutionResult[]> {
    const promptService = MarketingPromptService.getInstance();
    const results: ExecutionResult[] = [];

    try {
      const template = await promptService.getTemplate(input.templateId, ctx);
      if (!template) {
        throw new Error(`Template ${input.templateId} not found`);
      }

      for (const campaignId of input.campaignIds) {
        try {
          const execution = await this.executeSingle({
            campaignId,
            templateId: input.templateId,
            variables: input.variables,
            executedBy: input.executedBy,
          }, ctx);

          results.push({
            campaignId,
            executionId: execution.id,
            success: true,
          });
        } catch (error) {
          results.push({
            campaignId,
            executionId: '',
            success: false,
            error: (error as Error).message,
          });
          logger.error('Batch execution failed for campaign', ctx, { error: (error as Error).message, campaignId });
        }
      }

      logger.info('Batch execution completed', ctx, {
        templateId: input.templateId,
        total: input.campaignIds.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });

      return results;
    } catch (error) {
      logger.error('Batch execution failed', ctx, { error: (error as Error).message, templateId: input.templateId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Execute a single prompt for one campaign via AIProviderService.
   * Creates execution record, calls AI, updates with results + token/cost tracking.
   */
  async executeSingle(input: {
    campaignId: string;
    templateId: string;
    variables?: Record<string, any>;
    executedBy?: string;
  }, ctx?: RequestCtx): Promise<any> {
    const promptService = MarketingPromptService.getInstance();
    try {
      const template = await promptService.getTemplate(input.templateId, ctx);
      if (!template) {
        throw new Error(`Template ${input.templateId} not found`);
      }

      const campaign = await MarketingCampaignService.getCampaign(input.campaignId, ctx);
      if (!campaign) {
        throw new Error(`Campaign ${input.campaignId} not found`);
      }

      const execution = await promptService.createExecution({
        campaignId: input.campaignId,
        templateId: input.templateId,
        variablesUsed: input.variables,
        executedBy: input.executedBy,
      }, ctx);

      try {
        const renderedPrompt = this.renderTemplate(template.body, input.variables, campaign);

        const result = await aiProviderFactory.generateChatCompletion({
          messages: [
            { role: 'system', content: 'You are a marketing assistant generating content for local business prospects. Follow the prompt instructions precisely.' },
            { role: 'user', content: renderedPrompt },
          ],
          maxTokens: 2000,
          temperature: 0.7,
        });

        const tokensUsed = result.usage?.totalTokens || 0;
        const costCents = this.estimateCostCents(tokensUsed);

        const updated = await promptService.updateExecution(execution.id, {
          rawOutput: result.content,
          filteredOutput: result.content,
          status: 'completed',
          aiProvider: result.model.split('-')[0] || 'unknown',
          aiModel: result.model,
          tokensUsed,
          costCents,
        }, ctx);

        logger.info('Single execution completed', ctx, {
          executionId: execution.id,
          campaignId: input.campaignId,
          tokensUsed,
          costCents,
          model: result.model,
        });

        return updated;
      } catch (aiError) {
        await promptService.updateExecution(execution.id, {
          status: 'failed',
        }, ctx);
        throw aiError;
      }
    } catch (error) {
      logger.error('Single execution failed', ctx, { error: (error as Error).message, campaignId: input.campaignId });
      throw this.handleError(error, ctx);
    }
  }

  private renderTemplate(body: string, variables: Record<string, any> | undefined, campaign: any): string {
    let rendered = body;

    const allVars: Record<string, string> = {
      business_name: campaign.business_name || '',
      category: campaign.category || '',
      city: campaign.city || '',
      neighborhood: campaign.neighborhood || '',
      contact_method: campaign.contact_method || '',
      contact_info: campaign.contact_info || '',
      unaddressed_reviews: String(campaign.unaddressed_reviews ?? ''),
      last_review_date: campaign.last_review_date ? new Date(campaign.last_review_date).toLocaleDateString() : '',
      gbp_claimed: campaign.gbp_claimed ? 'Yes' : 'No',
      has_website: campaign.has_website ? 'Yes' : 'No',
      nap_consistent: campaign.nap_consistent ? 'Yes' : 'No',
      pain_score: String(campaign.pain_score ?? ''),
      estimated_tier: campaign.estimated_tier || '',
      notes: campaign.notes || '',
      tone: campaign.tone || '',
      attributes: (campaign.attributes || []).join(', '),
      ...(variables || {}),
    };
    // retainer is intentionally not injected: it's a campaign filter-only field.

    for (const [key, value] of Object.entries(allVars)) {
      rendered = rendered.replace(new RegExp(`\{\{${key}\}\}`, 'g'), value);
    }

    return rendered;
  }

  private estimateCostCents(tokens: number): number {
    // Rough estimate: $0.002 per 1K tokens = 0.2 cents per 1K tokens
    return Math.ceil((tokens / 1000) * 0.2);
  }
}

export default MarketingExecutionService.getInstance();
