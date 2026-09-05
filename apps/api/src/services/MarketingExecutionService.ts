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
import { PromptComposerService, type IntelligenceFocus } from './intelligence/PromptComposerService';
import { resolveOutputSchema } from '../validators/market-analysis.schema';
import { discoveryContextSchema, type DiscoveryContext } from '../validators/intelligence-discovery.schema';

// ─── INT signal labels (Migration 253 — GAP-E3, spec §8.4) ───────────────
// Hardcoded label map for the INT_* discovery signal family. The intelligence
// sprint's proposed registry seed (migration 199, GAP-S1) was never delivered:
// no INT_* rows exist in mkt_signal_registry. INT_* is a closed, spec-defined
// 11-code family, so a static map avoids a DB dependency in the prompt-render
// path. If the INT family is ever registered in mkt_signal_registry, this map
// can be retired in favor of registry lookup.
const INT_SIGNAL_LABELS: Record<string, string> = {
  INT_LOW_VISIBILITY: 'Low Visibility',
  INT_WEAK_MAINSTREAM_INDEXING: 'Weak Mainstream Indexing',
  INT_SINGLE_SOURCE: 'Single Source Only',
  INT_HIDDEN_TRUST: 'Strong Hidden Trust',
  INT_RECENT_BUSINESS_EVIDENCE: 'Recently Established',
  INT_POSSIBLE_CATEGORY_MISALIGNMENT: 'Possible Category Misalignment',
  INT_VERTICAL_SOURCE_DISCOVERY: 'Vertical Source Discovery',
  INT_MULTISOURCE_IDENTITY: 'Multisource Identity',
  INT_ACTIVE_OPERATIONAL_EVIDENCE: 'Active Operational Evidence',
  INT_CATEGORY_SPECIALIZATION: 'Category Specialization',
  INT_UNDEREXPOSED_CREDENTIAL: 'Underexposed Credential',
};

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

      // Category-guard (mirrors renderPrompt): a business-scope campaign
      // without a category cannot run prompts that require `category`.
      const execTemplateVars = Array.isArray(template.variables) ? template.variables : [];
      const execCampaignCategory = (campaign.category ?? '').trim();
      if (
        execTemplateVars.includes('category')
        && (campaign.scope ?? 'business').toLowerCase() === 'business'
        && !execCampaignCategory
      ) {
        throw new Error(
          `Template "${template.name}" requires a category input, but this campaign has no category. Run the Category Identification prompt first, then spawn a campaign with the identified category.`,
        );
      }

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
          errorMessage: (aiError as Error).message || 'AI call failed',
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
    // Category-guard: a business-scope campaign without a category (i.e., a
    // category-identification campaign) cannot run prompts that declare
    // `category` as a required variable. Those prompts (business audit,
    // category analysis, etc.) would render with an empty category and
    // produce broken/meaningless output. The spawned child campaigns have
    // a category and can run these prompts.
    const templateVars = Array.isArray(template.variables) ? template.variables : [];
    const campaignCategory = (campaign.category ?? '').trim();
    if (
      templateVars.includes('category')
      && (campaign.scope ?? 'business').toLowerCase() === 'business'
      && !campaignCategory
    ) {
      throw new Error(
        `Template "${template.name}" requires a category input, but this campaign has no category. Run the Category Identification prompt first, then spawn a campaign with the identified category.`,
      );
    }
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
    const promptType = (input.template.prompt_type || '').toLowerCase();
    const campaignScope = (input.campaign.scope || 'business').toLowerCase();
    const category = input.campaign.category || '';
    const isProfileRepair = (input.template.category || '').toLowerCase() === 'profile_repair';

    // Auto-source domain-specific variables if missing/empty in caller variables
    let effectiveVariables = { ...(input.variables || {}) };
    if (input.campaign && campaignScope === 'business') {
      try {
        let audit = input.campaign.audits?.[0] || input.campaign.mkt_audits_list?.[0];
        if (!audit && input.campaign.id) {
          audit = await this.prisma.mkt_audits_list.findFirst({
            where: { campaign_id: input.campaign.id },
            orderBy: { created_at: 'desc' },
          });
        }

        // 1. Profile Repair templates
        if (isProfileRepair) {
          const { default: repairService } = await import('./ProfileRepairPromptService');

          if (promptType === 'seek') {
            const seekDefaults = repairService.buildSeekVariables(input.campaign, audit);
            if (!effectiveVariables.audit_signals || !String(effectiveVariables.audit_signals).trim()) {
              effectiveVariables.audit_signals = seekDefaults.audit_signals;
            }
            if (!effectiveVariables.issue_type || !String(effectiveVariables.issue_type).trim()) {
              effectiveVariables.issue_type = seekDefaults.issue_type;
            }
            // Triage template uses audit_results as a primary input for scope
            // assessment (broken platforms, drift details, missing assets).
            if (!effectiveVariables.audit_results || !String(effectiveVariables.audit_results).trim()) {
              effectiveVariables.audit_results = seekDefaults.audit_results;
            }
          } else if (promptType === 'fulfill') {
            const fulfillDefaults = repairService.buildFulfillVariables(input.campaign, audit);
            if (!effectiveVariables.audit_results || !String(effectiveVariables.audit_results).trim()) {
              effectiveVariables.audit_results = fulfillDefaults.audit_results;
            }
          } else if (promptType === 'recovery_resolution') {
            let intake = input.campaign.mkt_dispute_intake?.[0];
            if (!intake && input.campaign.id) {
              intake = await this.prisma.mkt_dispute_intake.findFirst({
                where: { campaign_id: input.campaign.id, intake_kind: 'profile_repair' },
                include: { mkt_dispute_attachments: true },
                orderBy: { created_at: 'desc' },
              });
            }
            const resDefaults = repairService.buildResolutionVariables(input.campaign, intake);
            if (!effectiveVariables.evidencePayload || !String(effectiveVariables.evidencePayload).trim()) {
              effectiveVariables = { ...resDefaults, ...effectiveVariables };
            }
          }
        }
        // 2. Generic Recovery Resolution template
        else if (promptType === 'recovery_resolution' || input.template.id === 'mpt-recovery-resolution-default') {
          let intake = input.campaign.mkt_dispute_intake?.find((i: any) => i.intake_kind === 'dispute') || input.campaign.mkt_dispute_intake?.[0];
          if (!intake && input.campaign.id) {
            intake = await this.prisma.mkt_dispute_intake.findFirst({
              where: { campaign_id: input.campaign.id, intake_kind: 'dispute' },
              include: { mkt_dispute_attachments: true },
              orderBy: { created_at: 'desc' },
            });
          }

          if (!effectiveVariables.complaintText || !String(effectiveVariables.complaintText).trim()) {
            effectiveVariables.complaintText = input.campaign.notes || '(No complaint text recorded — see audit data)';
          }
          if (!effectiveVariables.intakePayload || !String(effectiveVariables.intakePayload).trim()) {
            effectiveVariables.intakePayload = JSON.stringify({
              ownerStatement: intake?.owner_statement ?? '',
              proposedResolution: intake?.proposed_resolution ?? '',
              serviceDate: intake?.service_date ?? '',
              statusFlag: intake?.status_flag ?? '',
            });
          }
          if (!effectiveVariables.attachmentMeta || !String(effectiveVariables.attachmentMeta).trim()) {
            effectiveVariables.attachmentMeta = JSON.stringify(
              (intake?.mkt_dispute_attachments || []).map((a: any) => ({
                fileName: a.file_name,
                fileType: a.file_type,
              })),
            );
          }
        }
        // 3. Fulfill templates (Review responses, Service menus, GBP optimizations)
        else if (promptType === 'fulfill') {
          if (!effectiveVariables.voice || !String(effectiveVariables.voice).trim()) {
            effectiveVariables.voice = input.campaign.tone || 'professional, empathetic, and solution-oriented';
          }
          if (!effectiveVariables.services || !String(effectiveVariables.services).trim()) {
            const recommended = (audit?.audit_data as any)?.recommended_services;
            if (Array.isArray(recommended) && recommended.length > 0) {
              effectiveVariables.services = recommended.join(', ');
            } else if (input.campaign.service_category) {
              effectiveVariables.services = input.campaign.service_category;
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to auto-source domain variables', ctx, {
          campaignId: input.campaign.id,
          templateId: input.template.id,
          error: (err as Error).message,
        });
      }
    }

    // 1. Base render — always happens first, using the existing renderTemplate().
    const baseRendered = this.renderTemplate(input.template.body, effectiveVariables, input.campaign);

    // 2. Check amplification gates
    const isSeek = promptType === 'seek';
    const hasCategory = category.length > 0;

    // Resolve the output schema's prompt suffix (e.g. JSON format instructions
    // for intelligence_profile / intelligence_discovery / profile_repair_*).
    // This is appended to the final rendered prompt so the external AI knows
    // the expected output format.
    //
    // IMPORTANT: Legacy audit schemas (business_analysis, city_category_opportunity,
    // regional_city_opportunity, market_analysis) never had their prompt suffix
    // appended. Preserving this keeps their rendered prompts byte-identical to
    // the pre-amplification baseline (no-profile regression guard). All other
    // registered schemas — intelligence, profile_repair, recovery_resolution,
    // citation_repair_package, raw_json — get their suffix appended as a safety
    // net so the external AI always receives the expected output shape.
    const outputSchemaName = input.template.output_schema?.name || input.template.outputSchema?.name || '';
    const LEGACY_NO_SUFFIX_SCHEMAS = new Set([
      'business_analysis',
      'city_category_opportunity',
      'regional_city_opportunity',
      'market_analysis',
    ]);
    const schemaEntry =
      outputSchemaName && !LEGACY_NO_SUFFIX_SCHEMAS.has(outputSchemaName)
        ? resolveOutputSchema(outputSchemaName)
        : null;
    const promptSuffix = schemaEntry?.promptSuffix ?? '';

    // ─── Intelligence-scope composition path (Sprint 3) ───────────────────
    // When the campaign is intelligence-scope and the template is a seek prompt,
    // delegate to PromptComposerService which assembles base + extension +
    // profile block + focus from the seeded fragments.
    //
    // EXCLUSION: The Intelligence Profile Establishment template has its own
    // body (it instructs the AI to produce a §10 profile JSON) and must NOT
    // be composed. We detect it by checking the output_schema name — if it's
    // 'intelligence_profile', render the template body as-is.
    const isProfileEstablishment = outputSchemaName === 'intelligence_profile';
    // Gold-standard scans have their own self-contained template body
    // (migration 235 seeds mpt-gold-standard-scan) and must NOT be routed
    // through the fragment composer — the composer assembles base +
    // extension + focus fragments for emerging/competitive intelligence
    // discovery, which is a different prompt shape. Gold-standard focus
    // is excluded from the composer path; the template body is rendered
    // as-is (like the intelligence_profile establishment template).
    const isGoldStandardFocus = (input.campaign.intelligence_focus || '') === 'gold_standards';

    // ─── Gold-standard discovery scan: inject the activated profile ──────
    // Discovery scans consume the already-established gold-standard profile
    // (created by a prior establishment scan) as evaluation criteria. The
    // serialized block tells the analyst to evaluate candidates against the
    // established expected_fields/quality_gates instead of deriving them.
    // Without this injection, the discovery prompt is identical to the
    // establishment prompt — the analyst has no benchmark to evaluate
    // against and re-derives expected_fields from scratch.
    //
    // Establishment scans skip this branch — they ARE the derivation step.
    if (isGoldStandardFocus && isSeek && campaignScope === 'intelligence' && hasCategory) {
      const campaignKind = (input.campaign.intelligence_campaign_kind || 'discovery') as 'discovery' | 'establishment';
      if (campaignKind === 'discovery') {
        const profileService = IntelligenceProfileService.getInstance();
        // Pass the campaign's platform so the resolver prefers a
        // platform-specific gold-standard profile, falling back to
        // cross-platform (reference_platform = NULL).
        // Pass the campaign's city/state so the resolver prefers a
        // scoped gold-standard profile (city/state-specific) when the
        // discovery scan is region-narrowed, falling back to nationwide.
        const campaignPlatform = (input.campaign as any).intelligence_platform || null;
        const campaignCity = (input.campaign as any).city || null;
        const campaignState = (input.campaign as any).state || null;
        const goldStandard = await profileService.resolveGoldStandard(category, campaignPlatform, campaignCity, campaignState, ctx);
        if (!goldStandard) {
          // No active gold-standard profile — return base render with a
          // degraded-mode warning so the analyst knows to run an
          // establishment scan first.
          const warning = '\n\n=== DEGRADED MODE — NO ACTIVE GOLD STANDARD PROFILE ===\n'
            + `No active gold-standard profile exists for category "${category}". `
            + 'Run an Establishment campaign first to create the gold-standard profile. '
            + 'This discovery scan will run in degraded mode — evaluate candidates against '
            + 'your own best judgment of what "excellent" looks like for this category, '
            + 'and derive expected_fields from the top candidates as a fallback.\n';
          logger.warn('Gold standard discovery scan resolved without active profile (degraded)', ctx, {
            campaignId: input.campaign.id,
            category,
            campaignKind,
          });
          const degradedDirective = this.renderGoldStandardRegionDirective(
            campaignCity, campaignState, null,
          );
          return {
            renderedPrompt: this.appendPromptSuffix(baseRendered + warning, promptSuffix) + '\n' + degradedDirective,
            resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
          };
        }
        const discoveryBlock = profileService.serializeGoldStandard(goldStandard, 'discovery');
        if (!discoveryBlock) {
          const emptyDirective = this.renderGoldStandardRegionDirective(
            campaignCity, campaignState,
            { reference_city: goldStandard.reference_city, reference_state: goldStandard.reference_state },
          );
          return {
            renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix) + '\n' + emptyDirective,
            resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
          };
        }
        // ─── Search scope directive ────────────────────────────────────
        // The template body and suffix are geographically neutral. This
        // directive is the single source of truth for the candidate search
        // scope. It is appended AFTER the suffix so it is the final word.
        // Emits NATIONWIDE scope when no city/state, REGION-NARROWED when
        // present. For regional discovery, also notes when the resolved
        // profile came from a broader scope (nationwide fallback).
        const regionDirective = this.renderGoldStandardRegionDirective(
          campaignCity,
          campaignState,
          { reference_city: goldStandard.reference_city, reference_state: goldStandard.reference_state },
        );
        const withSuffix = this.appendPromptSuffix(baseRendered + '\n' + discoveryBlock, promptSuffix);
        logger.info('Gold standard discovery profile injected', ctx, {
          campaignId: input.campaign.id,
          category,
          goldStandardProfileId: goldStandard.id,
          goldStandardProfileVersion: goldStandard.version,
          regionScope: campaignCity || campaignState ? `${campaignCity || ''}${campaignCity && campaignState ? ', ' : ''}${campaignState || ''}` : 'nationwide',
          profileScope: goldStandard.reference_city || goldStandard.reference_state
            ? `${goldStandard.reference_city || ''}${goldStandard.reference_city && goldStandard.reference_state ? ', ' : ''}${goldStandard.reference_state || ''}`
            : 'nationwide',
        });
        return {
          renderedPrompt: withSuffix + '\n' + regionDirective,
          resolution: {
            profile_id: goldStandard.id,
            profile_version: goldStandard.version,
            intelligence_mode: 'profile',
          },
        };
      }
      // Establishment kind — fall through to the base render (the template
      // body instructs the analyst to derive expected_fields from scratch).
      // Inject the search scope directive (nationwide or region-narrowed)
      // after the suffix so it is the final word. For regional campaigns,
      // the resulting profile will be region-scoped (reference_city/state
      // set at import time) and later resolve for regional discovery
      // campaigns at Layer 1/2 instead of falling back to nationwide.
      const estCampaignCity = (input.campaign as any).city || null;
      const estCampaignState = (input.campaign as any).state || null;
      const estRegionDirective = this.renderGoldStandardRegionDirective(
        estCampaignCity,
        estCampaignState,
        null, // no resolved profile for establishment — search scope only
      );
      logger.info('Gold standard establishment scan scope injected', ctx, {
        campaignId: input.campaign.id,
        category,
        regionScope: estCampaignCity || estCampaignState
          ? `${estCampaignCity || ''}${estCampaignCity && estCampaignState ? ', ' : ''}${estCampaignState || ''}`
          : 'nationwide',
      });
      const withSuffix = this.appendPromptSuffix(baseRendered, promptSuffix);
      return {
        renderedPrompt: withSuffix + '\n' + estRegionDirective,
        resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
      };
    }

    if (isSeek && campaignScope === 'intelligence' && hasCategory && !isProfileEstablishment && !isGoldStandardFocus) {
      const composer = PromptComposerService.getInstance();
      const profileService = IntelligenceProfileService.getInstance();
      const focus = (input.campaign.intelligence_focus || 'emerging') as IntelligenceFocus;
      // Pass the campaign's city so the composer resolves a city-scoped
      // profile (Migration 205) and emits a city retargeting directive
      // when the resolved profile's reference city differs.
      // Pass the campaign's platform so the composer resolves a platform-
      // scoped profile (Migration 236) — a Google-targeted discovery campaign
      // resolves to the Google-specific intelligence profile first, falling
      // back to cross-platform. Without this, platform-specific establishment
      // profiles would never resolve and discovery would always use the
      // cross-platform profile.
      const city = input.campaign.city || null;
      const campaignPlatform = (input.campaign as any).intelligence_platform || null;
      const composed = await composer.composeIntelligencePrompt({ category, focus, city, platform: campaignPlatform }, ctx);

      // Apply variable substitution on the composed body (zip_codes, radius, etc.)
      // Also strip any unresolved {{#if}}...{{/if}} Handlebars-style conditionals
      // since renderTemplate() only supports simple {{variable}} replacement.
      const cleanedBody = this.stripHandlebarsConditionals(composed.body, input.variables);
      let rendered = this.renderTemplate(cleanedBody, input.variables, input.campaign);

      // ─── Platform discovery focus injection ────────────────────────
      // When the campaign has a specific platform set (e.g. 'google'), the
      // platform acts as a FOCUS AMPLIFIER — it sharpens what "emerging" and
      // "competitive" mean for this scan:
      //   - Emerging + platform → find businesses MISSING from the target
      //     platform (they exist elsewhere but not on the target). These are
      //     high-value prospects who need a presence on the target platform.
      //   - Competitive + platform → find businesses PRESENT on the target
      //     platform. These are the benchmarks to rate against the platform's
      //     gold standard.
      // The directive is focus-aware so the same platform produces opposite
      // discovery populations depending on the focus. When no platform is set,
      // this block is skipped (broad cross-platform discovery).
      // (campaignPlatform was already declared above for the composer call.)
      if (campaignPlatform) {
        const platformDirective = this.renderPlatformDiscoveryDirective(campaignPlatform, focus);
        if (platformDirective) {
          rendered = rendered + '\n' + platformDirective;
          logger.info('Platform discovery focus injected', ctx, {
            campaignId: input.campaign.id,
            category,
            focus,
            platform: campaignPlatform,
          });
        }
      }

      // ─── Gold standard discovery benchmark injection ───────────────
      // Emerging/competitive discovery scans now resolve the category's
      // gold-standard profile (platform-aware via campaign.intelligence_platform)
      // and inject it as a discovery_benchmark block. This gives the discovery
      // scan a category-top benchmark to rate candidates against — without it,
      // discovery has no benchmark. The block instructs the analyst to rate
      // each candidate per-platform, aggregate gate failures, and produce
      // platform-aware outreach recommendations (platform_analysis section).
      // When no gold standard exists, a soft degraded-mode note is appended so
      // the operator knows benchmarking is absent and should run an
      // establishment scan first.
      const campaignCity = (input.campaign as any).city || null;
      const campaignState = (input.campaign as any).state || null;
      const goldStandard = await profileService.resolveGoldStandard(category, campaignPlatform, campaignCity, campaignState, ctx);
      let goldStandardProfileId: string | null = null;
      let goldStandardProfileVersion: number | null = null;
      if (goldStandard) {
        const gsBlock = profileService.serializeGoldStandard(goldStandard, 'discovery_benchmark');
        if (gsBlock) {
          rendered = rendered + '\n' + gsBlock;
          goldStandardProfileId = goldStandard.id;
          goldStandardProfileVersion = goldStandard.version;
          logger.info('Gold standard discovery benchmark injected into emerging/competitive scan', ctx, {
            campaignId: input.campaign.id,
            category,
            focus,
            goldStandardProfileId: goldStandard.id,
            goldStandardProfileVersion: goldStandard.version,
            goldStandardPlatform: goldStandard.reference_platform ?? 'cross-platform',
          });
        }
      } else {
        const degradedNote = '\n\n=== NO GOLD STANDARD PROFILE — BENCHMARKING ABSENT ===\n'
          + `No active gold-standard profile exists for category "${category}"`
          + (campaignPlatform ? ` on platform "${campaignPlatform}"` : '')
          + '. This discovery scan will run without a category-top benchmark. '
          + 'Rate candidates on category-general heuristics only. '
          + 'To enable gold-standard benchmarking, run a Gold Standard Establishment campaign first.';
        rendered = rendered + degradedNote;
        logger.info('Gold standard absent for emerging/competitive scan — degraded mode', ctx, {
          campaignId: input.campaign.id,
          category,
          focus,
          platform: campaignPlatform ?? 'none',
        });
      }

      logger.info('Intelligence-scope prompt composed', ctx, {
        campaignId: input.campaign.id,
        category,
        focus,
        profileId: composed.resolution.profile_id,
        intelligenceMode: composed.resolution.intelligence_mode,
        goldStandardProfileId,
        goldStandardProfileVersion,
      });

      return {
        renderedPrompt: this.appendPromptSuffix(rendered, promptSuffix),
        resolution: {
          ...composed.resolution,
          gold_standard_profile_id: goldStandardProfileId,
          gold_standard_profile_version: goldStandardProfileVersion,
        },
      };
    }

    // ─── Intelligence Profile Establishment path (campaign-aware focus) ───
    // The establishment template has its own body (it instructs the AI to
    // produce a §10 profile JSON) and is excluded from the composer above.
    // But the profile it produces is consumed downstream by Intelligence-scope
    // seeks that are themselves focus-specific (emerging vs competitive), and
    // the campaign is now coupled to its intelligence type. Append a focus
    // context block so the AI tailors the profile to the campaign's focus.
    if (isProfileEstablishment && isSeek && campaignScope === 'intelligence') {
      const focus = (input.campaign.intelligence_focus || 'emerging') as IntelligenceFocus;
      const campaignPlatform = (input.campaign as any).intelligence_platform || null;
      const focusBlock = this.renderEstablishmentFocusBlock(focus, campaignPlatform);
      const withFocus = focusBlock ? baseRendered + '\n' + focusBlock : baseRendered;

      logger.info('Intelligence Profile Establishment prompt resolved with focus', ctx, {
        campaignId: input.campaign.id,
        category,
        focus,
        platform: campaignPlatform ?? 'none',
      });

      return {
        renderedPrompt: this.appendPromptSuffix(withFocus, promptSuffix),
        resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
      };
    }

    // ─── Business-scope §1B amplification path ────────────────────────────
    const isBusinessScope = campaignScope === 'business';
    const isFulfill = promptType === 'fulfill';

    const promptRole: 'category_audit' | 'signal_triage' | 'fulfill_target' | 'none' =
      !isBusinessScope
        ? 'none'
        : isFulfill
        ? 'fulfill_target'
        : !isSeek
        ? 'none'
        : isProfileRepair
        ? 'signal_triage'
        : 'category_audit';

    if (promptRole === 'none' || !hasCategory) {
      // No amplification — return byte-identical base render (plus suffix).
      return {
        renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix),
        resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
      };
    }

    // ─── Gold-standard target injection for fulfill prompts ──────────────
    // Fulfill prompts get the gold-standard profile as a TARGET — the fix
    // instructions should move the business toward the gold-standard expected
    // fields and pattern exemplars. This is a separate injection from the
    // intelligence profile block (which is seek-only).
    if (promptRole === 'fulfill_target') {
      const profileService = IntelligenceProfileService.getInstance();
      const campaignPlatform = (input.campaign as any).intelligence_platform || null;
      const campaignCity = (input.campaign as any).city || null;
      const campaignState = (input.campaign as any).state || null;
      const goldStandard = await profileService.resolveGoldStandard(category, campaignPlatform, campaignCity, campaignState, ctx);
      if (!goldStandard) {
        // No active gold standard — return base render (degraded but functional).
        return {
          renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix),
          resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
        };
      }
      const goldStandardBlock = profileService.serializeGoldStandard(goldStandard, 'target');
      if (!goldStandardBlock) {
        return {
          renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix),
          resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
        };
      }
      const amplified = baseRendered + '\n' + goldStandardBlock;
      logger.info('Gold standard target injected into fulfill prompt', ctx, {
        campaignId: input.campaign.id,
        category,
        goldStandardProfileId: goldStandard.id,
        goldStandardProfileVersion: goldStandard.version,
      });
      return {
        renderedPrompt: this.appendPromptSuffix(amplified, promptSuffix),
        resolution: {
          profile_id: goldStandard.id,
          profile_version: goldStandard.version,
          intelligence_mode: 'profile',
        },
      };
    }

    // 3. Resolve active profile for the campaign's (category, city).
    //    Business-scope §1B path — no focus (category-only match). Business
    //    audits are category-aware, not focus-aware. City is honored
    //    (Migration 205) so a business audit in Zionsville does not load an
    //    Indianapolis-biased profile block.
    const profileService = IntelligenceProfileService.getInstance();
    const businessCity = input.campaign.city || null;
    const businessState = (input.campaign as any).state || null;

    // For signal-driven triage/audit templates (profile_repair):
    // Only append if audit_signals variable is populated, with framing directive.
    if (promptRole === 'signal_triage') {
      const auditSignals = effectiveVariables?.audit_signals ?? '';
      if (!auditSignals || !String(auditSignals).trim()) {
        // No signals -> suppress category block (fixes distractor-block bug)
        return {
          renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix),
          resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
        };
      }

      const profile = await profileService.resolve(category, undefined, businessCity, undefined, ctx);
      if (!profile) {
        return {
          renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix),
          resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
        };
      }

      const profileBlock = profileService.renderBusinessProfileBlock(
        profile,
        businessCity,
        'CATEGORY INTELLIGENCE (SUPPLEMENTARY — REPAIR SIGNALS ARE PRIMARY)',
        'Use the category intelligence below for category-fit signals and prohibited inferences only. ' +
          'The repair signals in the Audit Signals section above are the primary input for this triage.',
      );
      let amplified = baseRendered + '\n' + profileBlock;

      // Gold-standard benchmark injection (Sprint 0). Append the gold-
      // standard benchmark block so the triage can compare the business
      // against category-platform exemplars. Best-effort — if no active
      // gold standard exists, skip silently (degraded but functional).
      const triagePlatform = (input.campaign as any).intelligence_platform || null;
      const goldStandard = await profileService.resolveGoldStandard(category, triagePlatform, businessCity, businessState, ctx);
      if (goldStandard) {
        const gsBlock = profileService.serializeGoldStandard(goldStandard, 'benchmark');
        if (gsBlock) {
          amplified = amplified + '\n' + gsBlock;
          logger.info('Gold standard benchmark injected into signal triage', ctx, {
            campaignId: input.campaign.id,
            category,
            goldStandardProfileId: goldStandard.id,
          });
        }
      }

      logger.info('Profile-aware signal triage prompt resolved', ctx, {
        campaignId: input.campaign.id,
        category,
        city: businessCity ?? 'none',
        profileId: profile.id,
        profileVersion: profile.version,
        intelligenceMode: 'profile',
      });

      return {
        renderedPrompt: this.appendPromptSuffix(amplified, promptSuffix),
        resolution: {
          profile_id: profile.id,
          profile_version: profile.version,
          intelligence_mode: 'profile',
        },
      };
    }

    // 4. Category audit path (generic audits — unconditional append)
    const profile = await profileService.resolve(category, undefined, businessCity, undefined, ctx);

    if (!profile) {
      // No active intelligence profile — but there may still be a gold
      // standard benchmark to inject. Check for it before returning the
      // base render. This ensures the audit gets the gold-standard
      // comparison even when no category intelligence profile exists.
      const auditPlatform = (input.campaign as any).intelligence_platform || null;
      const goldStandardOnly = await profileService.resolveGoldStandard(category, auditPlatform, businessCity, businessState, ctx);
      if (goldStandardOnly) {
        const gsBlock = profileService.serializeGoldStandard(goldStandardOnly, 'benchmark');
        if (gsBlock) {
          let gsAmplified = baseRendered + '\n' + gsBlock;
          // Migration 253 — GAP-E3: inject discovery leads block (spec §8.4).
          const leadsBlock = this.renderDiscoveryLeadsBlock(input.campaign);
          if (leadsBlock) {
            gsAmplified = gsAmplified + '\n' + leadsBlock;
          }
          logger.info('Gold standard benchmark injected (no intelligence profile)', ctx, {
            campaignId: input.campaign.id,
            category,
            goldStandardProfileId: goldStandardOnly.id,
            discoveryLeadsInjected: !!leadsBlock,
          });
          return {
            renderedPrompt: this.appendPromptSuffix(gsAmplified, promptSuffix),
            resolution: {
              profile_id: goldStandardOnly.id,
              profile_version: goldStandardOnly.version,
              intelligence_mode: 'profile',
              discovery_leads_injected: !!leadsBlock,
            },
          };
        }
      }
      // No active profile and no gold standard — inject discovery leads block
      // if present (independent of profile amplification), then return.
      const leadsBlockNoProfile = this.renderDiscoveryLeadsBlock(input.campaign);
      const noProfileAmplified = leadsBlockNoProfile
        ? baseRendered + '\n' + leadsBlockNoProfile
        : baseRendered;
      return {
        renderedPrompt: this.appendPromptSuffix(noProfileAmplified, promptSuffix),
        resolution: {
          profile_id: null,
          profile_version: null,
          intelligence_mode: 'none',
          discovery_leads_injected: !!leadsBlockNoProfile,
        },
      };
    }

    // Append the business profile block (§1B amplification). Pass the
    // campaign's city so the block can emit a retargeting directive when
    // the profile's reference city differs.
    const profileBlock = profileService.renderBusinessProfileBlock(profile, businessCity);
    let amplified = baseRendered + '\n' + profileBlock;

    // Gold-standard benchmark injection (Sprint 0). Append the gold-
    // standard benchmark block so the audit can compare the business
    // against category-platform exemplars. Best-effort — if no active
    // gold standard exists, skip silently (degraded but functional).
    const auditPlatform2 = (input.campaign as any).intelligence_platform || null;
    const goldStandard = await profileService.resolveGoldStandard(category, auditPlatform2, businessCity, businessState, ctx);
    if (goldStandard) {
      const gsBlock = profileService.serializeGoldStandard(goldStandard, 'benchmark');
      if (gsBlock) {
        amplified = amplified + '\n' + gsBlock;
        logger.info('Gold standard benchmark injected into category audit', ctx, {
          campaignId: input.campaign.id,
          category,
          goldStandardProfileId: goldStandard.id,
        });
      }
    }

    // Migration 253 — GAP-E3: inject discovery leads block (spec §8.4).
    // After the gold-standard benchmark injection and before appendPromptSuffix.
    const leadsBlock = this.renderDiscoveryLeadsBlock(input.campaign);
    if (leadsBlock) {
      amplified = amplified + '\n' + leadsBlock;
    }

    logger.info('Profile-aware prompt resolved (§1B)', ctx, {
      campaignId: input.campaign.id,
      category,
      city: businessCity ?? 'none',
      profileId: profile.id,
      profileVersion: profile.version,
      profileReferenceCity: (profile as any).reference_city ?? null,
      intelligenceMode: 'profile',
      discoveryLeadsInjected: !!leadsBlock,
    });

    return {
      renderedPrompt: this.appendPromptSuffix(amplified, promptSuffix),
      resolution: {
        profile_id: profile.id,
        profile_version: profile.version,
        intelligence_mode: 'profile',
        discovery_leads_injected: !!leadsBlock,
      },
    };
  }

  /**
   * Append a prompt suffix (e.g. JSON output format instructions from the
   * output_schema registry) to the rendered prompt. Returns the prompt
   * unchanged if no suffix is defined.
   */
  private appendPromptSuffix(rendered: string, suffix: string): string {
    if (!suffix || !suffix.trim()) return rendered;
    return rendered + '\n' + suffix;
  }

  /**
   * Render the "Discovery Leads" block for a campaign (Migration 253 — GAP-E3,
   * spec §8.4/§8.5). Returns '' when the campaign has no discovery_context
   * (byte-identical render — campaigns without context are unaffected).
   *
   * The block is framed as verification HYPOTHESES, never as findings — this
   * preserves the §S1 guardrail (INT_* codes never enter detected_signals /
   * triage / playbook evaluation). The audit treats each lead as a hypothesis
   * to verify; confirmed leads become audit-family signals the audit emits
   * itself; refuted leads are discarded.
   *
   * Validation: the primary validation boundary is at handoff time
   * (createCampaignFromQueue → validateDiscoveryContext). The render-time
   * try/catch here is cheap defense against hand-mutated DB rows — it is NOT
   * a second validation boundary (spec §6).
   *
   * Provenance is capped at 6 sources (`… +N more`).
   */
  private renderDiscoveryLeadsBlock(campaign: any): string {
    const rawContext = campaign?.discovery_context;
    if (!rawContext || (typeof rawContext !== 'object')) return '';

    let ctx: DiscoveryContext;
    try {
      ctx = discoveryContextSchema.parse(rawContext);
    } catch {
      // Hand-mutated or corrupted row — drop silently (spec §8.4).
      return '';
    }

    // Drop if no signals AND no provenance AND no priority/fit/identity meta
    // (nothing to render as leads).
    const signals = Array.isArray(ctx.discovery_signals) ? ctx.discovery_signals : [];
    const provenance = Array.isArray(ctx.discovery_provenance) ? ctx.discovery_provenance : [];
    const hasMeta = ctx.business_seek_priority || ctx.category_fit || ctx.identity_confidence;
    if (signals.length === 0 && provenance.length === 0 && !hasMeta) return '';

    // ─── Focus parenthetical ───────────────────────────────────────────
    const focusLabel =
      ctx.focus === 'emerging' ? 'emerging focus'
      : ctx.focus === 'competitive' ? 'competitive focus'
      : 'focus not recorded';

    // ─── Discovered-at date ────────────────────────────────────────────
    let discoveredAtStr = 'unknown date';
    if (ctx.discovered_at) {
      try {
        discoveredAtStr = new Date(ctx.discovered_at).toISOString().slice(0, 10);
      } catch {
        discoveredAtStr = String(ctx.discovered_at);
      }
    }

    // ─── Build the block (spec §8.5 normative text) ───────────────────
    const lines: string[] = [
      '=== DISCOVERY LEADS (VERIFY — NOT FINDINGS) ===',
      `This business was surfaced by an intelligence discovery scan`,
      `(${focusLabel})`,
      `on ${discoveredAtStr}. The observations below are scan-time HYPOTHESES, not audit`,
      `findings. For each lead: independently verify against current evidence.`,
      `A lead you confirm becomes an audit signal in your own output contract; a`,
      `lead you refute is discarded. Do not copy these codes into detected_signals —`,
      `emit only your own audit-family signals (RA/DS/WC/CP/VP). Do not treat an`,
      `unconfirmed lead as evidence of activity, inactivity, or quality.`,
      '',
    ];

    // Seek priority / category fit / identity confidence line
    const metaParts: string[] = [];
    if (ctx.business_seek_priority) metaParts.push(`Seek priority at discovery: ${ctx.business_seek_priority}`);
    if (ctx.category_fit) metaParts.push(`Category fit: ${ctx.category_fit}`);
    if (ctx.identity_confidence) metaParts.push(`Identity confidence: ${ctx.identity_confidence}`);
    if (metaParts.length > 0) {
      lines.push(metaParts.join(' · '));
      lines.push('');
    }

    // Discovery signals (labeled)
    if (signals.length > 0) {
      lines.push('Discovery signals (hypotheses):');
      for (const code of signals) {
        const label = INT_SIGNAL_LABELS[code] ?? code;
        lines.push(`- ${code} — ${label}`);
      }
      lines.push('');
    }

    // Discovery provenance (capped at 6)
    if (provenance.length > 0) {
      lines.push('Discovery provenance (where the scan found this business):');
      const cap = 6;
      for (let i = 0; i < Math.min(provenance.length, cap); i++) {
        const p = provenance[i];
        const evidence = Array.isArray(p.evidence_types) && p.evidence_types.length > 0
          ? ` — evidence: ${p.evidence_types.join(', ')}`
          : '';
        lines.push(`- ${p.source ?? 'Unknown source'} (${p.role ?? 'unknown'})${evidence}`);
      }
      if (provenance.length > cap) {
        lines.push(`… +${provenance.length - cap} more`);
      }
      lines.push('');
    }

    // Absence rules paragraph (mandatory — spec §8.5)
    lines.push('Absence rules: "not found on a platform during discovery" is a discovery');
    lines.push('signal, not proof of absence. Re-verify platform absence yourself before');
    lines.push('emitting DS_MISSING_PROFILE or similar.');

    return lines.join('\n');
  }

  /**
   * Render the intelligence-focus context block appended to the Intelligence
   * Profile Establishment prompt. The establishment template produces a
   * category-agnostic §10 profile, but the campaign is coupled to an
   * intelligence type (emerging or competitive). This block instructs the AI
   * to bias the profile toward the campaign's focus so the downstream
   * Intelligence-scope seek (which loads this profile via the composer) is
   * tuned for the right discovery posture.
   *
   * When a platform is specified (non-empty, non-'all'), a platform bias
   * section is appended so the analyst produces platform-specific discovery
   * patterns — e.g., platform category taxonomy quirks, platform-specific
   * longtail search strategies, and platform-specific absence-handling rules.
   * This mirrors the gold standard's platform awareness: the gold standard
   * captures what "excellent on Google" looks like; the intelligence profile
   * captures how to find businesses on Google that mainstream search misses.
   *
   * Returns an empty string for an unrecognized focus value (defensive — the
   * campaign column defaults to 'emerging' and is constrained to the
   * IntelligenceFocus union, but we never want to corrupt the establishment
   * prompt with a malformed focus label).
   */
  private renderEstablishmentFocusBlock(focus: IntelligenceFocus, platform?: string | null): string {
    const focusBlock = this.renderFocusBlockCore(focus);
    if (!focusBlock) return '';
    const platformBlock = this.renderEstablishmentPlatformBlock(platform);
    return platformBlock ? focusBlock + '\n' + platformBlock : focusBlock;
  }

  /**
   * Core focus block — emerging or competitive bias instructions.
   */
  private renderFocusBlockCore(focus: IntelligenceFocus): string {
    if (focus === 'emerging') {
      return `=== INTELLIGENCE FOCUS: EMERGING ===
This profile will be used to power EMERGING discovery for this category — finding
thin-footprint, hidden-trust, single-platform, recently-established, and
possibly-misaligned businesses that are invisible to mainstream search.

When building the profile, bias toward emerging discovery:
- SPECIALIZED SOURCES: prioritize vertical directories, community sources, niche
  platforms, and supplier/marketplace sources that surface businesses ABSENT
  from mainstream indexes. Mainstream sources remain in scope but as
  corroboration, not as the primary discovery path.
- DISCOVERY PATTERNS: favor long-tail, vertical, and community search paths that
  go beyond the first page of Google. Name the concrete niche search strategies
  that find businesses mainstream search misses.
- CATEGORY EVIDENCE RULES: include absence-handling rules that distinguish "not
  found during discovery" from "does not exist" — emerging discovery must NEVER
  convert absence of evidence into a negative signal.
- PROHIBITED INFERENCE: explicitly prohibit inferring inactivity, low customer
  volume, or poor quality from a thin digital footprint.
- CATEGORY SIGNALS: emphasize the emerging-discovery INT_* codes —
  INT_LOW_VISIBILITY, INT_WEAK_MAINSTREAM_INDEXING, INT_SINGLE_SOURCE,
  INT_HIDDEN_TRUST, INT_RECENT_BUSINESS_EVIDENCE,
  INT_POSSIBLE_CATEGORY_MISALIGNMENT, INT_VERTICAL_SOURCE_DISCOVERY.

The profile's specialized_sources and discovery_patterns are the PRIMARY
mechanism set for emerging work. Do NOT bias the profile toward competitive
benchmarking, review-velocity comparisons, or market-leaderboard metrics —
those are competitive-focus work.`;
    }

    if (focus === 'competitive') {
      return `=== INTELLIGENCE FOCUS: COMPETITIVE ===
This profile will be used to power COMPETITIVE benchmarking for this category —
identifying the established, mainstream-visible market leaders that set the
standard for digital presence in this category and market.

When building the profile, bias toward competitive benchmarking:
- SPECIALIZED SOURCES: mainstream sources (Google, GBP, Yelp, Facebook) are the
  PRIMARY discovery path for competitive work — competitive benchmarks are by
  definition mainstream-visible. The profile's vertical/community sources remain
  available but as SECONDARY corroboration to confirm category_fit and
  specialization, not to discover hidden leaders.
- CATEGORY EVIDENCE RULES: define what "category-qualified leader" means for
  THIS category — a high-visibility business only counts as a competitive
  benchmark if it meets the profile's category_fit and specialization criteria,
  not merely "has high reviews."
- TERMINOLOGY / SYNONYMS: capture the full competitive set, including name
  variants and nationality-specific labels that mainstream search may miss. A
  competitive scan that misses those variants is incomplete.
- PROHIBITED INFERENCE: explicitly prohibit inferring revenue, customer volume,
  or business quality from review count, store size, or marketplace presence.
  Competitive positioning describes digital presence and engagement patterns,
  not business health.
- CATEGORY SIGNALS: emphasize the established-presence INT_* codes —
  INT_MULTISOURCE_IDENTITY, INT_ACTIVE_OPERATIONAL_EVIDENCE,
  INT_CATEGORY_SPECIALIZATION, INT_UNDEREXPOSED_CREDENTIAL.

The profile's evidence rules govern whether a high-visibility business actually
qualifies as a category benchmark versus a generic high-visibility business that
does not meet the profile's specialization bar. Do NOT bias the profile toward
emerging discovery, thin-footprint, or hidden-trust work — those are
emerging-focus work.`;
    }

    return '';
  }

  /**
   * Platform bias block for the establishment focus section. When a specific
   * platform is named (not 'all' or empty), appends a section instructing the
   * analyst to produce platform-specific discovery patterns. Returns empty
   * string for 'all' / null / empty so cross-platform establishment prompts
   * are unaffected.
   */
  private renderEstablishmentPlatformBlock(platform?: string | null): string {
    const p = platform ? platform.trim().toLowerCase() : '';
    if (!p || p === 'all') return '';

    const cap = p.charAt(0).toUpperCase() + p.slice(1);
    return `=== PLATFORM BIAS: ${cap} ===
This profile is scoped to ${cap}. The discovery patterns and specialized sources
you produce should include ${cap}-specific search strategies that surface
businesses on ${cap} that mainstream search misses:

- ${cap} CATEGORY TAXONOMY: identify the category labels ${cap} uses for this
  business type, including generic/misleading labels that obscure specialization
  (e.g., "Grocery Store" or "International Grocery" instead of a category-specific
  label). Name the specific ${cap} categories and the miscategorization patterns.
- ${cap} LONGTAIL SEARCH: include ${cap}-specific longtail search queries that
  find businesses invisible to broad category searches (e.g., product-specific
  queries, neighborhood-specific queries, community-specific queries on ${cap}).
- ${cap} DIRECTORY FEATURES: identify ${cap}-specific directory or listing
  features that can surface businesses (e.g., ${cap} Maps street view for
  unmarked storefronts, ${cap} review ecosystems for hidden trust, ${cap}
  category filters for miscategorized businesses).
- ${cap} ABSENCE HANDLING: include an evidence rule distinguishing "not found
  on ${cap} during discovery" from "does not exist on ${cap}" — a business may
  be active on other platforms but absent from ${cap}, and that absence is a
  discovery signal (INT_WEAK_MAINSTREAM_INDEXING or INT_SINGLE_SOURCE), not a
  negative quality signal.

The platform-specific discovery patterns are the PRIMARY mechanism set for
platform-targeted discovery. The category's vertical and community sources
remain in scope but should be evaluated through the lens of ${cap} presence —
a business found via a community source that is absent from ${cap} is a
high-value platform-gap prospect.`;
  }

  /**
   * Render a platform discovery focus directive block. The platform acts as
   * a FOCUS AMPLIFIER — it sharpens what "emerging" and "competitive" mean
   * for this scan:
   *
   *   - Emerging + platform → find businesses MISSING from the target platform.
   *     They exist on other platforms (Yelp, Facebook, etc.) but not on the
   *     target. These are high-value prospects who need a presence on the
   *     target platform.
   *
   *   - Competitive + platform → find businesses PRESENT on the target platform.
   *     These are the benchmarks to rate against the platform's gold standard.
   *
   * The directive is focus-aware so the same platform produces opposite
   * discovery populations depending on the focus. Returns empty string for
   * unknown focus values (defensive — should not happen in practice).
   */
  private renderPlatformDiscoveryDirective(platform: string, focus: IntelligenceFocus): string {
    const cap = (v: string) => v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
    const platformLabel = cap(platform);

    if (focus === 'emerging') {
      return `=== PLATFORM DISCOVERY FOCUS: ${platformLabel} ===
This discovery scan is platform-targeted. The platform amplifies the emerging
focus: prioritize finding businesses with GAPS on ${platformLabel}.

TARGET POPULATION — GAPS ON ${platformLabel}:
"Missing" is a spectrum, not a binary. A business is an emerging prospect for
this scan if it has ANY of the following gaps on ${platformLabel}:
1. COMPLETELY ABSENT: no ${platformLabel} presence at all — the business exists
   on other platforms (Yelp, Facebook, niche directories) but is invisible on
   ${platformLabel}. Highest-value prospect: they need a full presence built.
2. UNCLAIMED: has a ${platformLabel} listing but the owner has not claimed it —
   no control over content, no response to reviews, no posts. High-value: they
   need claim + optimization.
3. NAP DRIFT: claimed or unclaimed listing with name/address/phone inconsistencies
   vs. the business's canonical identity. Medium-value: they need NAP correction.
4. SPARSE/INCOMPLETE: has a presence but missing key elements — few or no photos,
   wrong primary category, no description, missing attributes, no posts. The
   gold standard's expected_fields define what "complete" means for this category.
5. POORLY RATED: has a presence but with low rating or few reviews relative to
   the category benchmark — the profile exists but underperforms.

All five are emerging opportunities. The gold standard benchmark block (when
present) defines the exact gates that distinguish each gap type.

DISCOVERY STRATEGY:
- Search BOTH other platforms AND ${platformLabel} itself. A business found on
  Yelp but absent from ${platformLabel} is a gap type #1 prospect. A business
  found on ${platformLabel} with an unclaimed profile is a gap type #2 prospect.
- Use INT_SINGLE_SOURCE when a business is found on only one non-${platformLabel}
  platform. Use INT_LOW_VISIBILITY when a business has no ${platformLabel} listing
  or a sparse/incomplete one. Use INT_WEAK_MAINSTREAM_INDEXING when a business
  has a ${platformLabel} presence but it is poorly indexed or incomplete.
- Note each candidate's ${platformLabel} status explicitly in discovery_provenance
  (absent, unclaimed, claimed-incomplete, claimed-drift, claimed-sparse) — the
  platform breakdown in platform_analysis depends on it.
- Do NOT exclude businesses just because they have SOME presence on ${platformLabel}
  — an unclaimed or incomplete presence is still an emerging opportunity.

RATING: When a gold standard benchmark block follows, rate each candidate
against the ${platformLabel} gold standard. Completely absent businesses will
fail all platform gates. Unclaimed/incomplete businesses will fail specific
gates (claim status, photo count, category accuracy, etc.). Record the specific
gate failures in gold_standard_gate_results — the specific gaps ARE the outreach
opportunities. gold_standard_match = false for all gap types; the value is in
knowing WHICH gates failed.`;
    }

    if (focus === 'competitive') {
      return `=== PLATFORM DISCOVERY FOCUS: ${platformLabel} ===
This discovery scan is platform-targeted. The platform amplifies the competitive
focus: prioritize finding businesses that are PRESENT on ${platformLabel}.

TARGET POPULATION — PRESENT ON ${platformLabel}:
These are your competitive benchmarks. A business with an established ${platformLabel}
presence (claimed profile, photos, reviews, posts) is a candidate for the
competitive leaderboard on that platform. The gold standard for ${platformLabel}
defines what "excellent" looks like — rate each candidate against it.

DISCOVERY STRATEGY:
- Search ${platformLabel} directly as the PRIMARY discovery source — competitive
  benchmarks are by definition present on the target platform.
- For each candidate found on ${platformLabel}, note their profile completeness:
  claimed status, primary category accuracy, photo count, review velocity,
  description quality, posting frequency.
- Use ${platformLabel}-specific evidence to assess competitive positioning —
  review count, rating, response patterns, photo quality.
- Other platforms (Yelp, Facebook) remain available as SECONDARY corroboration
  for category_fit and identity, but the competitive leaderboard is ${platformLabel}-scoped.
- Note each candidate's ${platformLabel} profile URL in gbp_url or
  discovery_provenance — the platform breakdown in platform_analysis depends on it.

RATING: When a gold standard benchmark block follows, rate each candidate
against the ${platformLabel} gold standard. Businesses with strong ${platformLabel}
profiles that pass all non_negotiable gates are gold_standard_match = true —
they are the category leaders on this platform. Businesses that fail gates are
competitive also-rans with identifiable gaps.`;
    }

    return '';
  }

  /**
   * Render the geographic search scope directive for gold-standard scans.
   *
   * The template body and output-schema suffix are geographically neutral —
   * they do not mention "nationwide" or prescribe a geographic spread. This
   * directive is the SINGLE source of truth for the candidate search scope.
   * It is appended AFTER the suffix so it is the final word the analyst reads.
   *
   * Two modes:
   *   - Nationwide (no city/state): emits a NATIONWIDE scope block instructing
   *     the analyst to search across at least 3 distinct states/regions.
   *   - Regional (city and/or state): emits a REGION-NARROWED scope block
   *     instructing the analyst to search within the region first, expanding
   *     outward incrementally if the pool is thin.
   *
   * For discovery scans, the directive also notes when the resolved gold-
   * standard profile came from a BROADER scope than the campaign (e.g.
   * campaign is city-scoped but the profile fell back to nationwide). In that
   * case the benchmark is nationwide-grade but the candidate search is still
   * region-narrowed.
   *
   * For establishment scans, `profile` is null (no resolved profile — the
   * establishment scan IS the derivation step). The directive narrows the
   * candidate search only; no scope-mismatch note is emitted.
   */
  private renderGoldStandardRegionDirective(
    city: string | null,
    state: string | null,
    profile: { reference_city: string | null; reference_state: string | null } | null,
  ): string {
    const isEstablishment = profile === null;
    const scanTypeLabel = isEstablishment ? 'establishment scan' : 'discovery scan';
    const searchVerb = isEstablishment ? 'candidate businesses' : 'ADDITIONAL candidate businesses';

    // ── Nationwide mode ──────────────────────────────────────────────
    if (!city && !state) {
      return `=== SEARCH SCOPE — NATIONWIDE ===
This ${scanTypeLabel} searches NATIONWIDE. Aim for geographic diversity —
span at least 3 distinct states/regions when possible to avoid coastal/metro
clustering.
=== END SEARCH SCOPE ===`;
    }

    // ── Regional mode ────────────────────────────────────────────────
    const scopeLabel = city && state
      ? `${city}, ${state}`
      : state
      ? state
      : city as string;

    // Detect scope mismatch (discovery only): campaign is region-scoped but
    // the resolved profile is broader (nationwide or state-only when city
    // was requested).
    const profileCity = profile?.reference_city ?? null;
    const profileState = profile?.reference_state ?? null;
    const profileIsNationwide = !isEstablishment && !profileCity && !profileState;
    const profileIsBroader = !isEstablishment && (
      profileIsNationwide
      || (city && !profileCity)
      || (state && !profileState && !profileCity)
    );

    const scopeNote = isEstablishment
      ? '\nThis is an ESTABLISHMENT scan — you are DERIVING the gold-standard\nprofile for this region. The candidates you find here become the regional\nbenchmark. Derive expected_fields and quality_gates from the top regional\ncandidates (do not lower the bar — the regional bar should reflect what an\nexcellent independent operator in this region can realistically achieve).'
      : profileIsBroader
      ? profileIsNationwide
        ? `\nNOTE: The gold-standard profile below was resolved from the NATIONWIDE\npool (no ${city ? 'city' : 'state'}-scoped profile exists yet for this category).\nThe benchmark bar is nationwide-grade — evaluate regional candidates\nagainst it without lowering the bar. The candidate SEARCH is region-narrowed\neven though the benchmark is nationwide.`
        : `\nNOTE: The gold-standard profile below was resolved from a BROADER scope\nthan this campaign's search region. The benchmark bar remains the established\nstandard — evaluate regional candidates against it without lowering the bar.`
      : '';

    return `=== SEARCH SCOPE — REGION-NARROWED ===
This ${scanTypeLabel} is REGION-NARROWED to ${scopeLabel}.

CANDIDATE SEARCH BOUNDARY:
- Search for ${searchVerb} PRIMARILY within ${scopeLabel}.
- If the regional pool is thin (fewer than 3 strong independent candidates in
  ${scopeLabel}), expand outward incrementally: first to the surrounding
  metro area / county, then to adjacent regions within the same state. Do NOT
  jump straight to nationwide — prefer regional depth over geographic breadth.
- Geographic diversity WITHIN the region is preferred (different neighborhoods,
  suburbs, or adjacent cities) but is secondary to finding strong candidates.
- Candidates found outside ${scopeLabel} may be included only as overflow when
  the regional pool is exhausted, and must be flagged in scan_metadata with
  out_of_scope: true and a rationale.
${scopeNote}
=== END SEARCH SCOPE ===`;
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
  /**
   * Strip unresolved {{#if variable}}...{{/if}} Handlebars-style conditional
   * blocks from the composed prompt body. When the variable is provided and
   * non-empty, the inner content is kept. When the variable is absent or empty,
   * the entire block (including the inner content) is removed.
   *
   * This is needed because the intelligence fragment seeds use {{#if}} syntax
   * for optional fields (zip_codes, search_radius_miles), but renderTemplate()
   * only supports simple {{variable}} replacement.
   */
  private stripHandlebarsConditionals(body: string, variables: Record<string, any> | undefined): string {
    return body.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_match, varName: string, inner: string) => {
        const value = variables?.[varName];
        return value && String(value).trim().length > 0 ? inner : '';
      },
    );
  }

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
      business_origin: [campaign.business_origin_country, campaign.business_origin_region]
        .filter(Boolean).join(', '),
      platform: campaign.intelligence_platform || '',
      business_address: [
        campaign.address_line1,
        campaign.address_city,
        campaign.address_state,
        campaign.address_zip,
      ].filter(Boolean).join(', ') || '',
      business_phone: campaign.phone || campaign.contact_info || '',
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
