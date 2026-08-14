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
import { ScopeMismatchError, assertScopeCompatible, SCOPE_VARIABLES } from './scope-utils';
import { MarketingHotProspectService } from './MarketingHotProspectService';
import { IntelligenceProfileService, type PromptResolution } from './intelligence/IntelligenceProfileService';

// Re-export for backward compatibility (tests + existing imports).
export { ScopeMismatchError, assertScopeCompatible };

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

      assertScopeCompatible(template, campaign);

      // Resolve the prompt with profile-aware amplification (§1B, GAP-P7).
      // For non-seek or non-business-scope prompts, this returns the base
      // render byte-identical (no amplification).
      const { renderedPrompt, resolution } = await this.resolvePrompt(
        { template, campaign, variables: input.variables },
        ctx,
      );

      const execution = await promptService.createExecution({
        campaignId: input.campaignId,
        templateId: input.templateId,
        variablesUsed: input.variables,
        executedBy: input.executedBy,
        resolution,
      }, ctx);

      try {
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

        // Sprint 3: best-effort City Pain Scan → hot-prospect sync hook.
        // Catches + logs errors so a sync failure never fails the execution.
        if (template.prompt_type === 'city_analysis') {
          try {
            const report = await MarketingHotProspectService.getInstance().syncFromExecution(execution.id, ctx);
            logger.info('City Pain Scan sync hook complete', ctx, {
              executionId: execution.id,
              matched: report.matched.length,
              unmatched: report.unmatched.length,
              hot: report.hotProspectsMarked,
              skippedChains: report.skippedChains,
            });
          } catch (syncErr) {
            logger.error('City Pain Scan sync hook failed (best-effort)', ctx, {
              error: (syncErr as Error).message,
              executionId: execution.id,
            });
          }
        }

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

  /**
   * Resolve a prompt template against a campaign without executing AI.
   * Returns the fully substituted prompt string for external use.
   *
   * Now routes through resolvePrompt() for profile-aware amplification (§1B).
   * When no active profile exists, the output is byte-identical to the
   * pre-amplification render.
   */
  async renderPrompt(input: {
    templateId: string;
    campaignId: string;
    variables?: Record<string, any>;
  }, ctx?: RequestCtx): Promise<string> {
    const promptService = MarketingPromptService.getInstance();
    const template = await promptService.getTemplate(input.templateId, ctx);
    if (!template) {
      throw new Error(`Template ${input.templateId} not found`);
    }
    const campaign = await MarketingCampaignService.getCampaign(input.campaignId, ctx);
    if (!campaign) {
      throw new Error(`Campaign ${input.campaignId} not found`);
    }
    assertScopeCompatible(template, campaign);
    const { renderedPrompt } = await this.resolvePrompt({ template, campaign, variables: input.variables }, ctx);
    return renderedPrompt;
  }

  /**
   * Resolve a prompt for a campaign with profile-aware amplification (§1B, GAP-P7).
   *
   * This is the shared resolution seam used by both renderPrompt() and
   * executeSingle(). It:
   *   1. Renders the existing template body using renderTemplate() (base render).
   *   2. If the prompt is a business-scope seek prompt AND the campaign's
   *      category has an active intelligence profile, appends a rendered
   *      business profile block (§1B amplification).
   *   3. Returns the original base render byte-identical when no profile is
   *      found (no amplification, intelligence_mode = 'none').
   *
   * Gates (all must be true for amplification):
   *   - template.prompt_type === 'seek'
   *   - campaign.scope === 'business' (case-insensitive)
   *   - campaign.category is non-empty
   *   - an active profile exists for campaign.category
   *
   * Returns { renderedPrompt, resolution } where resolution carries the
   * profile provenance for execution/import stamping.
   */
  async resolvePrompt(input: {
    template: any;
    campaign: any;
    variables?: Record<string, any>;
  }, ctx?: RequestCtx): Promise<{ renderedPrompt: string; resolution: PromptResolution }> {
    // 1. Base render — always happens first, using the existing renderTemplate().
    const baseRendered = this.renderTemplate(input.template.body, input.variables, input.campaign);

    // 2. Check amplification gates
    const promptType = (input.template.prompt_type || '').toLowerCase();
    const campaignScope = (input.campaign.scope || 'business').toLowerCase();
    const category = input.campaign.category || '';

    const isSeek = promptType === 'seek';
    const isBusinessScope = campaignScope === 'business';
    const hasCategory = category.length > 0;

    if (!isSeek || !isBusinessScope || !hasCategory) {
      // No amplification — return byte-identical base render.
      return {
        renderedPrompt: baseRendered,
        resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
      };
    }

    // 3. Resolve active profile for the campaign's category.
    const profileService = IntelligenceProfileService.getInstance();
    const profile = await profileService.resolve(category, ctx);

    if (!profile) {
      // No active profile — return byte-identical base render.
      return {
        renderedPrompt: baseRendered,
        resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
      };
    }

    // 4. Append the business profile block (§1B amplification).
    const profileBlock = profileService.renderBusinessProfileBlock(profile);
    const amplified = baseRendered + '\n' + profileBlock;

    logger.info('Profile-aware prompt resolved (§1B)', ctx, {
      campaignId: input.campaign.id,
      category,
      profileId: profile.id,
      profileVersion: profile.version,
      intelligenceMode: 'profile',
    });

    return {
      renderedPrompt: amplified,
      resolution: {
        profile_id: profile.id,
        profile_version: profile.version,
        intelligence_mode: 'profile',
      },
    };
  }

  /**
   * Render a prompt template body against a campaign, substituting only
   * scope-relevant variables. References to out-of-scope variables are
   * rejected (throw) to prevent silently producing broken prompts with
   * empty substitutions.
   *
   * Caller-supplied `variables` (e.g. from the workspace UI) are always
   * injected regardless of scope — they are explicit user overrides.
   */
  renderTemplate(body: string, variables: Record<string, any> | undefined, campaign: any): string {
    const scope = (campaign.scope ?? 'business').toLowerCase() as keyof typeof SCOPE_VARIABLES;
    const allowed = SCOPE_VARIABLES[scope] ?? SCOPE_VARIABLES.business;

    // Detect out-of-scope variable references in the template body.
    const referenced = new Set<string>();
    for (const m of body.matchAll(/\{\{(\w+)\}\}/g)) referenced.add(m[1]);
    const outOfScope = Array.from(referenced).filter((v) => !allowed.includes(v) && !(variables && v in variables));
    if (outOfScope.length > 0) {
      throw new Error(
        `Template references out-of-scope variables for scope "${scope}": ${outOfScope.join(', ')}. ` +
        `Allowed variables for this scope: ${allowed.join(', ')}.`,
      );
    }

    // Build the full set of candidate values, then filter to allowed + overrides.
    const candidate: Record<string, string> = {
      business_name: campaign.business_name || '',
      category: campaign.category || '',
      city: campaign.city || '',
      state: campaign.state || '',
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
    };

    const allVars: Record<string, string> = {};
    for (const key of allowed) {
      if (key in candidate) allVars[key] = candidate[key];
    }
    // Caller overrides always win, even if not in the scope's allowed list.
    if (variables) {
      for (const [k, v] of Object.entries(variables)) {
        allVars[k] = typeof v === 'string' ? v : String(v ?? '');
      }
    }
    // retainer is intentionally not injected: it's a campaign filter-only field.

    let rendered = body;
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
