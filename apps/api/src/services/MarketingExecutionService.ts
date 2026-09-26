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
import { MarketingPromptService, extractJsonCandidates, stripLlmJsonArtifacts } from './MarketingPromptService';
import MarketingCampaignService from './MarketingCampaignService';
import { generateMarketingAuditId } from '../lib/id-generator';
import { formatCampaignAddress } from '../lib/canonical-nap';
import { CATEGORY_ENRICHMENT_SCHEMA_NAME, LOCATION_ENRICHMENT_SCHEMA_NAME, CATEGORY_SET_ENRICHMENT_SCHEMA_NAME } from '../validators/directory-enrichment.schema';
import aiProviderFactory from './ai-providers';
import { ScopeMismatchError, assertScopeCompatible, SCOPE_VARIABLES } from './scope-utils';
import { MarketingHotProspectService } from './MarketingHotProspectService';
import { IntelligenceProfileService, type IntelligenceProfile, type PromptResolution, type ResolvedSignalWeight } from './intelligence/IntelligenceProfileService';
import { PromptComposerService, type IntelligenceFocus } from './intelligence/PromptComposerService';
import { buildInteractiveVerificationPreamble, INTERACTIVE_VERIFICATION_DIRECTIVE_VERSION } from './interactive-verification-directive';
import { BronzeReasonCatalogService } from './intelligence/BronzeReasonCatalogService';
import MarketingPlaybookCatalogService from './MarketingPlaybookCatalogService';
import { MarketContextLoader } from './intelligence/MarketContextLoader';
import { buildGeographyGridDirective, buildGeographyGrid, parseZipCodes, isNationalSentinel, type GeographyGrid } from './intelligence/geography-grid';
import { GeographyGridService } from './intelligence/GeographyGridService';
import { formatEstablishmentMarketContext, formatDiscoveryMarketContext, formatCategoryIdentificationMarketContext, formatKnownCategoryVocabulary, formatEnrichmentCategoryVocabulary } from './intelligence/MarketContextBindingFormatters';
import { CategoryVocabularyService } from './CategoryVocabularyService';
import { resolveOutputSchema } from '../validators/market-analysis.schema';
import { WEBSITE_POSITIONING_SCHEMA_NAME } from '../validators/website-positioning.schema';
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
  INT_PLATFORM_SIGNAL_DIVERGENCE: 'Platform Signal Divergence',
};

// Re-export for backward compatibility (tests + existing imports).
export { ScopeMismatchError, assertScopeCompatible };

/**
 * National establishment template (sprint: national layer). A '__all__'
 * establishment campaign renders this city-agnostic §10 body instead of the
 * city-scoped establishment template — no geography grid, national signal
 * weights, no "what you observed in {{city}}" phrasing. Seeded by
 * seed-intelligence-profile-establishment-template.ts.
 */
export const NATIONAL_ESTABLISHMENT_TEMPLATE_ID = 'mpt-seed-intel-profile-establishment-national-001';
export const NATIONAL_LOCATION_ENRICHMENT_TEMPLATE_ID = 'mpt-location-enrichment-national';

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

        // Directory Enrichment lane — post-run hook for the two enrichment
        // output schemas. Parse + validate the raw output, persist an audit
        // row so the campaign's Audits tab renders a mapped card, then
        // auto-apply the packet to directory_category_enrichment with
        // campaign/execution lineage (trigger_source='campaign_run').
        // Best-effort: the execution stays 'completed' even if apply fails.
        const outputSchemaName = (template.output_schema as any)?.name;
        if (
          outputSchemaName === CATEGORY_ENRICHMENT_SCHEMA_NAME ||
          outputSchemaName === LOCATION_ENRICHMENT_SCHEMA_NAME ||
          outputSchemaName === CATEGORY_SET_ENRICHMENT_SCHEMA_NAME
        ) {
          try {
            await this.applyEnrichmentFromOutput({
              schemaName: outputSchemaName,
              campaign,
              rawOutput: result.content,
              executionId: execution.id,
              enrichedBy: input.executedBy ?? null,
            }, ctx);
          } catch (enrichErr) {
            logger.error('Enrichment apply failed (best-effort)', ctx, {
              error: (enrichErr as Error).message,
              executionId: execution.id,
              campaignId: input.campaignId,
              schemaName: outputSchemaName,
            });
          }
        }

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
   * Directory Enrichment lane — apply a completed internal execution's output.
   *
   * Mirrors the external-import path in
   * MarketingPromptService.importExternalResult(): parse the raw output with
   * the same candidate-extraction helpers, validate against the registered
   * output schema, persist an audit row (auditPlatform) so the campaign's
   * Audits tab renders a mapped card, then auto-apply the packet to
   * directory_category_enrichment via the campaign-scope-appropriate service.
   *
   * Throws on parse/validation/apply failure — the caller wraps this in a
   * best-effort try/catch.
   */
  private async applyEnrichmentFromOutput(input: {
    schemaName: string;
    campaign: any;
    rawOutput: string;
    executionId: string;
    enrichedBy: string | null;
  }, ctx?: RequestCtx): Promise<void> {
    const resolved = resolveOutputSchema(input.schemaName);
    if (!resolved) {
      throw new Error(`No registered output schema "${input.schemaName}"`);
    }

    let parsedJson: any | null = null;
    for (const candidate of extractJsonCandidates(input.rawOutput)) {
      try {
        const candidateJson = JSON.parse(stripLlmJsonArtifacts(candidate));
        if (resolved.validator.safeParse(candidateJson).success) {
          parsedJson = candidateJson;
          break;
        }
      } catch {
        continue;
      }
    }
    if (!parsedJson) {
      throw new Error(`Execution output does not match the "${input.schemaName}" output schema`);
    }

    // Audit row so the result is visible on the campaign Audits tab —
    // mirrors the audit creation in importExternalResult (scalar columns at
    // their defaults; full payload in audit_data).
    if (resolved.auditPlatform) {
      await this.prisma.mkt_audits_list.create({
        data: {
          id: generateMarketingAuditId(),
          campaign_id: input.campaign.id,
          platform: resolved.auditPlatform,
          review_count: 0,
          unaddressed_reviews: 0,
          owner_response_rate: 0,
          photo_count: 0,
          audit_data: parsedJson,
          import_metadata: {
            source: 'internal_run',
            execution_id: input.executionId,
          },
        },
      });
    }

    const campaignRef = {
      id: input.campaign.id,
      category: input.campaign.category ?? null,
      city: input.campaign.city ?? null,
      state: input.campaign.state ?? null,
    };

    if (input.schemaName === CATEGORY_SET_ENRICHMENT_SCHEMA_NAME) {
      // PG shelf sweep: one execution produces a packet per market. Apply
      // each entry under its OWN market coordinates — the parent campaign's
      // category/city/state only name the anchor market. Partial success is
      // allowed: every applied market is a real row; failures are collected
      // and only a zero-applied run throws.
      const { default: CategoryMarketEnrichmentService } = await import('./CategoryMarketEnrichmentService.js');
      const failures: string[] = [];
      let appliedCount = 0;
      for (const market of parsedJson.markets as any[]) {
        const marketRef = {
          id: input.campaign.id,
          category: market.category_name ?? market.category_key ?? null,
          city: market.city ?? null,
          state: market.state ?? null,
        };
        const applied = await CategoryMarketEnrichmentService.getInstance().applyEnrichmentPacket({
          campaign: marketRef,
          packet: market,
          executionId: input.executionId,
          enrichedBy: input.enrichedBy,
        }, ctx);
        if (applied?.categoryEnrichmentId) {
          appliedCount += 1;
        } else {
          failures.push(`${market.category_name ?? market.category_key ?? '?'} ${market.city ?? '?'},${market.state ?? '?'}: ${JSON.stringify(applied?.skipReasons ?? {})}`);
        }
      }
      if (appliedCount === 0) {
        throw new Error(`Set enrichment apply produced no rows (${failures.join('; ') || 'empty markets[]'})`);
      }
      if (failures.length > 0) {
        logger.warn('Set enrichment partially applied', ctx, {
          executionId: input.executionId,
          campaignId: input.campaign.id,
          applied: appliedCount,
          failed: failures,
        });
      }
    } else if (input.schemaName === CATEGORY_ENRICHMENT_SCHEMA_NAME) {
      const { default: CategoryMarketEnrichmentService } = await import('./CategoryMarketEnrichmentService.js');
      const applied = await CategoryMarketEnrichmentService.getInstance().applyEnrichmentPacket({
        campaign: campaignRef,
        packet: parsedJson,
        executionId: input.executionId,
        enrichedBy: input.enrichedBy,
      }, ctx);
      if (!applied?.categoryEnrichmentId) {
        throw new Error(`Enrichment apply produced no row (skipReasons: ${JSON.stringify(applied?.skipReasons ?? {})})`);
      }
    } else {
      const { default: LocationMarketEnrichmentService } = await import('./LocationMarketEnrichmentService.js');
      const applied = await LocationMarketEnrichmentService.applyEnrichmentPacket({
        campaign: campaignRef,
        packet: parsedJson,
        executionId: input.executionId,
        enrichedBy: input.enrichedBy,
      }, ctx);
      if (!applied) {
        throw new Error('Location enrichment apply produced no row (invalid campaign city/state)');
      }
    }

    logger.info('Enrichment packet applied from internal run', ctx, {
      executionId: input.executionId,
      campaignId: input.campaign.id,
      schemaName: input.schemaName,
    });
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
    const outputSchemaName = input.template.output_schema?.name || input.template.outputSchema?.name || '';

    // Auto-source domain-specific variables if missing/empty in caller variables
    let effectiveVariables = { ...(input.variables || {}) };

    // Hoisted for the signal_triage amplification path: the profile-repair
    // seek auto-source below resolves these once; the amplification path
    // reuses them for the platform signal-weight context block (no second
    // resolution — one interpretation of signal weight per render).
    let resolvedSignalWeights: Map<string, ResolvedSignalWeight> | undefined;
    let seekAuditData: any = null;

    // Category-set enrichment (PG shelf sweep): auto-source {{markets}} from
    // the sweep payload on discovery_context.shelf_sweep.markets so the
    // category-scope set template can enumerate the residual markets. Runs
    // outside the business-scope block — sweep campaigns are scope='category'.
    if (
      outputSchemaName === CATEGORY_SET_ENRICHMENT_SCHEMA_NAME
      && !(effectiveVariables.markets && String(effectiveVariables.markets).trim())
    ) {
      const sweepMarkets = (input.campaign.discovery_context as any)?.shelf_sweep?.markets;
      effectiveVariables.markets = Array.isArray(sweepMarkets) && sweepMarkets.length > 0
        ? sweepMarkets.map((m: any) => `- ${m.category} — ${m.city}, ${m.state}`).join('\n')
        : '(no sweep set on this campaign — enrich the single market below)';
    }

    if (input.campaign && campaignScope === 'business') {
      try {
        // G-2: platform-filtered. This reader feeds business-audit-shaped
        // consumers (profile repair seek/fulfill, fulfill services). An
        // unfiltered newest-audit read would let a website_positioning (or
        // any other) audit shadow business_analysis once it exists.
        let audit = (input.campaign.audits ?? []).find((a: any) => a.platform === 'business_analysis')
          || (input.campaign.mkt_audits_list ?? []).find((a: any) => a.platform === 'business_analysis');
        if (!audit && input.campaign.id) {
          audit = await this.prisma.mkt_audits_list.findFirst({
            where: { campaign_id: input.campaign.id, platform: 'business_analysis' },
            orderBy: { created_at: 'desc' },
          });
        }
        seekAuditData = audit?.audit_data ?? null;

        // 1. Profile Repair templates
        if (isProfileRepair) {
          const { default: repairService } = await import('./ProfileRepairPromptService');

          if (promptType === 'seek') {
            // Phase 6 — signal-aligned gap gate (undefined → legacy set).
            // Full resolution is retained on resolvedSignalWeights so the
            // signal_triage amplification path can append the platform
            // signal-weight context block without a second DB read.
            const { IntelligenceProfileService } = await import('./intelligence/IntelligenceProfileService');
            resolvedSignalWeights = await IntelligenceProfileService.getInstance()
              .resolveSignalWeightsForCampaign(input.campaign, audit?.audit_data, ctx);
            const platformSignalWeights = resolvedSignalWeights
              ? Object.fromEntries([...resolvedSignalWeights].map(([k, v]) => [k, v.weight]))
              : undefined;
            const seekDefaults = repairService.buildSeekVariables(input.campaign, audit, platformSignalWeights);
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
            const fulfillDefaults = await repairService.buildFulfillVariables(input.campaign, audit);
            for (const key of ['audit_results', 'seek_briefing', 'repair_tier', 'delivery_mode', 'repair_platforms'] as const) {
              if (!effectiveVariables[key] || !String(effectiveVariables[key]).trim()) {
                effectiveVariables[key] = fulfillDefaults[key];
              }
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
          // Claim-and-fix CTA — only for templates that declare it. Resolves
          // the campaign's claim link WITHOUT minting (this is a read/render
          // path; minting happens in DeliverableSourceService on generation).
          // Falls back to the link-less variant so no {{claim_url}} leaks.
          const declaredVars: string[] = Array.isArray(input.template.variables) ? input.template.variables : [];
          if (
            declaredVars.includes('claim_cta')
            && (!effectiveVariables.claim_cta || !String(effectiveVariables.claim_cta).trim())
          ) {
            const { resolveClaimUrlForCampaign } = await import('./outreach-openers/outreach-link-vars');
            const { buildClaimCta } = await import('./deliverable/deliverable-cta');
            const claimUrl = input.campaign.id
              ? await resolveClaimUrlForCampaign(input.campaign.id)
              : null;
            effectiveVariables.claim_cta = buildClaimCta(claimUrl);
          }
        }
        // 4. Website positioning audit (PB-08 / A7). Auto-source the
        // campaign's website URL and the prior business_analysis audit's
        // `website` block so the positioning pass consumes what the breadth
        // audit already found (spec §6.2).
        else if (outputSchemaName === WEBSITE_POSITIONING_SCHEMA_NAME) {
          if (!effectiveVariables.website_url || !String(effectiveVariables.website_url).trim()) {
            effectiveVariables.website_url = input.campaign.website_url ?? '';
          }
          if (!effectiveVariables.prior_website_findings || !String(effectiveVariables.prior_website_findings).trim()) {
            const businessAudit = (input.campaign.audits ?? []).find((a: any) => a.platform === 'business_analysis')
              || (input.campaign.mkt_audits_list ?? []).find((a: any) => a.platform === 'business_analysis')
              || (input.campaign.id
                ? await this.prisma.mkt_audits_list.findFirst({
                    where: { campaign_id: input.campaign.id, platform: 'business_analysis' },
                    orderBy: { created_at: 'desc' },
                  })
                : null);
            const websiteBlock = (businessAudit?.audit_data as any)?.website;
            effectiveVariables.prior_website_findings = websiteBlock
              ? JSON.stringify(websiteBlock, null, 2)
              : '(no prior business_analysis website findings — assess the site from scratch)';
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
    //
    // Interactive verification preamble (spec §12 — AUDIT_PLATFORM_AVAILABILITY_CONTROL_SPEC).
    // Caller-supplied opt-in: a truthy `interactive_verification` variable
    // prefixes the capability notice ahead of the body's role framing. The
    // variable is NEVER body-declared, so renderTemplate's out-of-scope check
    // never sees it — no SCOPE_VARIABLES whitelist is needed and the "off"
    // path is byte-identical to a run without the feature. One prefix here is
    // inherited by every body-rendered branch (business audits, profile
    // establishment, gold/bronze scans, repair); the composed intelligence
    // path below gets the same prefix at its own render site.
    const interactivePreamble = buildInteractiveVerificationPreamble(effectiveVariables);
    if (interactivePreamble) {
      logger.info('Interactive verification preamble emitted', ctx, {
        campaignId: input.campaign.id,
        templateId: input.template.id,
        interactiveVerificationDirectiveVersion: INTERACTIVE_VERIFICATION_DIRECTIVE_VERSION,
        hasOperatorObservations: Boolean(String(effectiveVariables.operator_observations ?? '').trim()),
      });
    }
    // National establishment (sprint: national layer) — a '__all__'
    // establishment campaign renders the national template variant: a
    // city-agnostic §10 body (no geography grid, national-scope signal
    // weights, no "what you observed in {{city}}" phrasing). Sentinel-keyed
    // so the operator can't render the city-scoped body with a literal
    // '__all__' market. Falls back to the selected template body when the
    // national seed hasn't run (degraded — CITY renders as '__all__').
    let templateBody = input.template.body;
    // National ('__all__') template variants — city-scoped seed bodies would
    // render the sentinel verbatim into CITY/MARKET lines and ask for
    // city-level copy. Sentinel-keyed so the operator can't render a
    // city-scoped body against a national campaign. Falls back to the
    // selected template body when the national seed hasn't run.
    const nationalTemplateId =
      outputSchemaName === 'intelligence_profile'
        ? NATIONAL_ESTABLISHMENT_TEMPLATE_ID
        : outputSchemaName === LOCATION_ENRICHMENT_SCHEMA_NAME
          ? NATIONAL_LOCATION_ENRICHMENT_TEMPLATE_ID
          : null;
    if (nationalTemplateId && isNationalSentinel(input.campaign.city)) {
      try {
        const nationalTemplate = await MarketingPromptService.getInstance()
          .getTemplate(nationalTemplateId, ctx);
        if (nationalTemplate?.body) {
          templateBody = nationalTemplate.body;
        } else {
          logger.warn('National template variant not seeded — rendering selected template body', ctx, {
            campaignId: input.campaign.id,
            templateId: input.template.id,
            nationalTemplateId,
          });
        }
      } catch (tplErr) {
        logger.warn('National template variant lookup failed — rendering selected template body', ctx, {
          campaignId: input.campaign.id,
          error: (tplErr as Error).message,
        });
      }
    }
    const baseRendered = interactivePreamble + this.renderTemplate(templateBody, effectiveVariables, input.campaign);

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
    // Bronze-standard scans have their own template bodies + a dedicated
    // render path below (catalog hunt list for stage-1 establishment,
    // national-profile reference for stage-2 discovery). Excluded from the
    // composer like gold — the composer assembles emerging/competitive
    // discovery framing, which would miscast a reason-axis calibration scan.
    const isBronzeStandardFocus = (input.campaign.intelligence_focus || '') === 'bronze_standards';

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
          // Market context injection (degraded gold-standard discovery).
          // Appended after the body, BEFORE the JSON schema suffix — the
          // region directive remains the final word after the suffix.
          let degradedMarketBlock = '';
          if (campaignCity && campaignState && category) {
            const marketCtx = await MarketContextLoader.getInstance().loadMarketContext(
              category, campaignCity, campaignState, ctx,
            );
            degradedMarketBlock = formatDiscoveryMarketContext(marketCtx, category, campaignCity, campaignState, 'gold_standards');
            if (degradedMarketBlock) {
              logger.info('Market context injected into degraded gold-standard discovery scan', ctx, {
                campaignId: input.campaign.id,
                category,
                city: campaignCity,
                state: campaignState,
              });
            }
          }
          return {
            renderedPrompt: this.appendPromptSuffix(
              baseRendered + warning + (degradedMarketBlock ? '\n' + degradedMarketBlock : ''),
              promptSuffix,
            ) + '\n' + degradedDirective,
            resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
          };
        }
        const discoveryBlock = profileService.serializeGoldStandard(goldStandard, 'discovery');
        if (!discoveryBlock) {
          const emptyDirective = this.renderGoldStandardRegionDirective(
            campaignCity, campaignState,
            { reference_city: goldStandard.reference_city, reference_state: goldStandard.reference_state },
          );
          // Market context injection (unserializable gold-standard profile —
          // same coverage as the other gold-standard discovery branches).
          let emptyGsMarketBlock = '';
          if (campaignCity && campaignState && category) {
            const marketCtx = await MarketContextLoader.getInstance().loadMarketContext(
              category, campaignCity, campaignState, ctx,
            );
            emptyGsMarketBlock = formatDiscoveryMarketContext(marketCtx, category, campaignCity, campaignState, 'gold_standards');
            if (emptyGsMarketBlock) {
              logger.info('Market context injected into gold-standard discovery scan (empty profile block)', ctx, {
                campaignId: input.campaign.id,
                category,
                city: campaignCity,
                state: campaignState,
              });
            }
          }
          return {
            renderedPrompt: this.appendPromptSuffix(
              baseRendered + (emptyGsMarketBlock ? '\n' + emptyGsMarketBlock : ''),
              promptSuffix,
            ) + '\n' + emptyDirective,
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
        // Market context injection (gold-standard discovery scan). Appended
        // after the body + discovery block, BEFORE the JSON schema suffix —
        // the region directive remains the final word after the suffix.
        let gsMarketBlock = '';
        if (campaignCity && campaignState && category) {
          const marketCtx = await MarketContextLoader.getInstance().loadMarketContext(
            category, campaignCity, campaignState, ctx,
          );
          gsMarketBlock = formatDiscoveryMarketContext(marketCtx, category, campaignCity, campaignState, 'gold_standards');
          if (gsMarketBlock) {
            logger.info('Market context injected into gold-standard discovery scan', ctx, {
              campaignId: input.campaign.id,
              category,
              city: campaignCity,
              state: campaignState,
            });
          }
        }
        const withSuffix = this.appendPromptSuffix(
          baseRendered + '\n' + discoveryBlock + (gsMarketBlock ? '\n' + gsMarketBlock : ''),
          promptSuffix,
        );
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
      // ─── Market context injection (establishment scan) ──────────────
      // The establishment scan discovers best-in-class businesses for a
      // category in a city. It benefits from category_profile (WHAT to
      // look for), city_profile (WHERE/HOW), category_signals (HOW to
      // evaluate), and market_density (expectation setting).
      // National campaigns (city = '__all__') load category intelligence
      // only — no city profile exists at national scope.
      // Appended after the body, BEFORE the JSON schema suffix — the
      // region directive remains the final word after the suffix.
      let estMarketBlock = '';
      if (estCampaignCity && estCampaignState && category) {
        const marketCtx = await MarketContextLoader.getInstance().loadMarketContext(
          category, estCampaignCity, estCampaignState, ctx,
        );
        estMarketBlock = formatEstablishmentMarketContext(marketCtx, category, estCampaignCity, estCampaignState);
        if (estMarketBlock) {
          logger.info('Market context injected into establishment scan', ctx, {
            campaignId: input.campaign.id,
            category,
            city: estCampaignCity,
            state: estCampaignState,
          });
        }
      }
      const withSuffix = this.appendPromptSuffix(
        baseRendered + (estMarketBlock ? '\n' + estMarketBlock : ''),
        promptSuffix,
      );

      return {
        renderedPrompt: withSuffix + '\n' + estRegionDirective,
        resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
      };
    }

    // ─── Bronze-standard scans (BRONZE_STANDARD_SPEC §10.3) ──────────────
    // Two stages share this path, keyed on intelligence_campaign_kind:
    //   establishment (stage 1, national): inject the scope-applicable REASON
    //     CATALOG as the hunt list (sprint plan D6 — the spec's §10.3 never
    //     injected the catalog into stage 1; the national profile cannot
    //     snapshot a catalog it never saw).
    //   discovery (stage 2, city): inject the resolved bronze-standard
    //     profile (city → state → nationwide cascade) as the ESTABLISHMENT
    //     REFERENCE — the established reason map the city scan must cover,
    //     plus location-scoped catalog rows the national profile never saw
    //     (§6.3 — a city-scoped reason lands in the catalog after the
    //     national profile was authored).
    if (isBronzeStandardFocus && isSeek && campaignScope === 'intelligence' && hasCategory) {
      const campaignKind = (input.campaign.intelligence_campaign_kind || 'discovery') as 'discovery' | 'establishment';
      const profileService = IntelligenceProfileService.getInstance();
      const catalogService = BronzeReasonCatalogService.getInstance();
      const campaignPlatform = (input.campaign as any).intelligence_platform || null;
      const campaignCity = (input.campaign as any).city || null;
      const campaignState = (input.campaign as any).state || null;

      if (campaignKind === 'establishment') {
        // Stage 1 — inject the applicable catalog rows + the revision the
        // output must stamp (§3.5.2). Location-scoped rows never match a
        // nationwide establishment scan by construction (they require a
        // city), so a national campaign receives universal + category rows;
        // a region-scoped establishment campaign additionally receives the
        // market's location-scoped rows.
        const [catalogRows, catalogRevision] = await Promise.all([
          catalogService.applicableReasons({
            categoryKey: category,
            city: campaignCity,
            state: campaignState,
            platform: campaignPlatform,
          }, ctx),
          catalogService.currentRevision(),
        ]);
        const catalogBlock = catalogService.serializeCatalogBlock(catalogRows, catalogRevision);
        if (!catalogBlock) {
          logger.warn('Bronze establishment scan resolved an EMPTY reason catalog', ctx, {
            campaignId: input.campaign.id,
            category,
          });
        }
        // Catchment footprint — the same retail-catchment geography grid the
        // stage-3 discovery scan sweeps. The campaign's city/state stays the
        // anchor (profile resolution key, catalog predicate key); the grid
        // widens the fill boundary to the catchment so a metro split by a
        // state line (e.g. Kansas City, MO/KS) scans as one market.
        const estCachedGrid = !campaignCity || !campaignState
          || isNationalSentinel(campaignCity) || isNationalSentinel(campaignState)
          ? null
          : await GeographyGridService.getInstance().getGrid(
              campaignCity,
              campaignState,
              parseZipCodes((input.campaign as any).intelligence_zip_codes),
              ctx,
            );
        const estGeoGridDirective = buildGeographyGridDirective(input.campaign, estCachedGrid);
        const estRegionDirective = this.renderBronzeRegionDirective(campaignCity, campaignState, null, { catchment: !!estGeoGridDirective });
        logger.info('Bronze standard establishment scan catalog injected', ctx, {
          campaignId: input.campaign.id,
          category,
          catalogRevision,
          reasonCount: catalogRows.length,
          regionScope: campaignCity || campaignState
            ? `${campaignCity || ''}${campaignCity && campaignState ? ', ' : ''}${campaignState || ''}`
            : 'nationwide',
        });
        return {
          renderedPrompt: this.appendPromptSuffix(
            baseRendered + (catalogBlock ? '\n' + catalogBlock : '')
              + (estGeoGridDirective ? '\n' + estGeoGridDirective : ''),
            promptSuffix,
          ) + '\n' + estRegionDirective,
          resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
        };
      }

      // Stage 2 — city discovery scan consumes the resolved bronze profile
      // as its hunt list.
      //
      // Catchment footprint — the same retail-catchment geography grid the
      // stage-3 discovery scan sweeps. The campaign's city/state stays the
      // anchor (profile resolution key, catalog predicate key); the grid
      // widens the fill boundary to the catchment so a metro split by a
      // state line (e.g. Kansas City, MO/KS) scans as one market.
      const bronzeIsNational = isNationalSentinel(campaignCity) || isNationalSentinel(campaignState);
      const bronzeCachedGrid = (bronzeIsNational || !campaignCity || !campaignState)
        ? null
        : await GeographyGridService.getInstance().getGrid(
            campaignCity,
            campaignState,
            parseZipCodes((input.campaign as any).intelligence_zip_codes),
            ctx,
          );
      const bronzeGeoGridDirective = buildGeographyGridDirective(input.campaign, bronzeCachedGrid);
      const hasCatchment = !!bronzeGeoGridDirective;

      const bronzeStandard = await profileService.resolveBronzeStandard(
        category, campaignPlatform, campaignCity, campaignState, ctx,
      );
      if (!bronzeStandard) {
        const warning = '\n\n=== DEGRADED MODE — NO ACTIVE BRONZE STANDARD PROFILE ===\n'
          + `No active bronze-standard profile exists for category "${category}". `
          + 'Run a Bronze Standard Establishment campaign first to create the profile. '
          + 'This city scan will run in degraded mode — hunt for hard-to-find businesses '
          + 'using your own blind-spot judgment and report each reason you covered.\n';
        logger.warn('Bronze standard city scan resolved without active profile (degraded)', ctx, {
          campaignId: input.campaign.id,
          category,
          campaignKind,
        });
        const degradedDirective = this.renderBronzeRegionDirective(campaignCity, campaignState, null, { catchment: hasCatchment });
        return {
          renderedPrompt: this.appendPromptSuffix(
            baseRendered + warning
              + (bronzeGeoGridDirective ? '\n' + bronzeGeoGridDirective : ''),
            promptSuffix,
          ) + '\n' + degradedDirective,
          resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
        };
      }
      // Cascading profile — when the resolved profile is market-scoped, pair
      // it with the national profile's compact proof record so the scan can
      // classify empty_proven_elsewhere correctly and see exemplar evidence
      // depth even when the market profile is thin.
      const [referenceBlock, nationalProofBlock] = await Promise.all([
        profileService.serializeBronzeStandard(bronzeStandard, 'establishment_reference', ctx),
        this.resolveBronzeNationalProofBlock(profileService, category, campaignPlatform, bronzeStandard, ctx),
      ]);
      // §6.3 — location-scoped catalog rows are injected alongside the
      // profile: a city-scoped reason authored after the national profile
      // is still coverage the city scan must produce.
      const [cityRows, catalogRevision] = await Promise.all([
        catalogService.applicableReasons({
          categoryKey: category,
          city: campaignCity,
          state: campaignState,
          platform: campaignPlatform,
        }, ctx),
        catalogService.currentRevision(),
      ]);
      const cityCatalogBlock = catalogService.serializeCatalogBlock(cityRows, catalogRevision);
      const regionDirective = this.renderBronzeRegionDirective(
        campaignCity,
        campaignState,
        { reference_city: bronzeStandard.reference_city, reference_state: bronzeStandard.reference_state },
        { catchment: hasCatchment },
      );
      logger.info('Bronze standard discovery profile injected', ctx, {
        campaignId: input.campaign.id,
        category,
        bronzeStandardProfileId: bronzeStandard.id,
        bronzeStandardProfileVersion: bronzeStandard.version,
        catalogRevision,
        catalogReasonCount: cityRows.length,
      });
      return {
        renderedPrompt: this.appendPromptSuffix(
          baseRendered
            + (referenceBlock ? '\n' + referenceBlock : '')
            + (nationalProofBlock ? '\n' + nationalProofBlock : '')
            + (cityCatalogBlock ? '\n' + cityCatalogBlock : '')
            + (bronzeGeoGridDirective ? '\n' + bronzeGeoGridDirective : ''),
          promptSuffix,
        ) + '\n' + regionDirective,
        resolution: {
          profile_id: bronzeStandard.id,
          profile_version: bronzeStandard.version,
          intelligence_mode: 'profile',
          // The injected block IS the bronze standard (establishment_reference
          // role) — stamp it so provenance is explicit, per PromptResolution.
          bronze_standard_profile_id: bronzeStandard.id,
          bronze_standard_profile_version: bronzeStandard.version,
        },
      };
    }

    if (isSeek && campaignScope === 'intelligence' && hasCategory && !isProfileEstablishment && !isGoldStandardFocus && !isBronzeStandardFocus) {
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
      // National ('__all__') discovery maps the sentinel to the national
      // profile slot — reference_city NULL — so the composer resolves the
      // city-agnostic profile directly and renderProfileBlock emits no city
      // retargeting/application directive against a phantom '__All__' target.
      const isNationalDiscovery = isNationalSentinel(input.campaign.city);
      const city = isNationalDiscovery ? null : (input.campaign.city || null);
      const campaignPlatform = (input.campaign as any).intelligence_platform || null;
      const composed = await composer.composeIntelligencePrompt({ category, focus, city, platform: campaignPlatform }, ctx);

      // National discovery renders '{{city}}'/'{{state}}' as readable market
      // labels — the literal sentinels must never reach the model.
      const discoveryVariables = isNationalDiscovery
        ? { ...(input.variables ?? {}), city: 'all US markets', state: 'nationwide' }
        : input.variables;

      // Apply variable substitution on the composed body (zip_codes, radius, etc.)
      // Also strip any unresolved {{#if}}...{{/if}} Handlebars-style conditionals
      // since renderTemplate() only supports simple {{variable}} replacement.
      const cleanedBody = this.stripHandlebarsConditionals(composed.body, discoveryVariables);
      // Same interactive-verification prefix as baseRendered — the composed
      // path is the only branch that bypasses baseRendered, so it gets its
      // own copy of the (possibly empty) preamble.
      let rendered = interactivePreamble + this.renderTemplate(cleanedBody, discoveryVariables, input.campaign);

      // National discovery framing — the composed fragments are city-scoped
      // copy; this directive reframes the sweep as nationwide and pins the
      // per-candidate market-attribution contract.
      if (isNationalDiscovery) {
        rendered = rendered + '\n' + this.formatNationalDiscoveryDirective(focus);
      }

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
      // National discovery resolves the nationwide benchmark directly — the
      // literal sentinels would cascade there anyway via misses.
      const profileCity = isNationalDiscovery ? null : campaignCity;
      const profileState = isNationalDiscovery ? null : campaignState;
      const goldStandard = await profileService.resolveGoldStandard(category, campaignPlatform, profileCity, profileState, ctx);
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

      // ─── Bronze standard calibration injection (emerging only) ─────────
      // Stage 3 (spec §7.1): the city bronze-standard profile is injected
      // into EMERGING discovery as CALIBRATION framing — exemplars + the
      // empty-slot report + the vector execution log tell the analyst what a
      // hard-to-find business looks like here and which vectors reach it.
      // Bronze NEVER enters competitive output (§1 — it is not a benchmark).
      // Resolves city → state → nationwide so a market without a city scan
      // still gets national calibration.
      let bronzeStandardProfileId: string | null = null;
      let bronzeStandardProfileVersion: number | null = null;
      if (focus === 'emerging') {
        const bronzeStandard = await profileService.resolveBronzeStandard(
          category, campaignPlatform, profileCity, profileState, ctx,
        );
        if (bronzeStandard) {
          // Cascading profile (§7.1 supplement): a market-scoped calibration
          // profile is paired with the national proof record so the analyst
          // sees which blind spots are proven real and what qualifying
          // evidence looks like — even when this market's profile is thin.
          const [bronzeBlock, nationalProofBlock] = await Promise.all([
            profileService.serializeBronzeStandard(bronzeStandard, 'discovery', ctx),
            this.resolveBronzeNationalProofBlock(profileService, category, campaignPlatform, bronzeStandard, ctx),
          ]);
          const combinedBronze = (bronzeBlock || '') + (nationalProofBlock ? '\n' + nationalProofBlock : '');
          if (combinedBronze) {
            rendered = rendered + '\n' + combinedBronze;
            bronzeStandardProfileId = bronzeStandard.id;
            bronzeStandardProfileVersion = bronzeStandard.version;
            logger.info('Bronze standard calibration injected into emerging scan', ctx, {
              campaignId: input.campaign.id,
              category,
              bronzeStandardProfileId: bronzeStandard.id,
              bronzeStandardProfileVersion: bronzeStandard.version,
            });
          }
        } else {
          // Soft degraded note — absence of calibration is informational,
          // not a scan blocker (unlike gold, bronze coverage is additive).
          rendered = rendered + '\n\n=== NO BRONZE STANDARD PROFILE — BLIND-SPOT CALIBRATION ABSENT ===\n'
            + `No active bronze-standard profile exists for category "${category}"`
            + (campaignCity && campaignState && !isNationalDiscovery ? ` in ${campaignCity}, ${campaignState}` : ' nationwide')
            + '. This emerging scan runs without blind-spot calibration — hard-to-find '
            + 'businesses that evade mainstream discovery may be missed. '
            + 'To enable calibration, run the Bronze Standard national + city scans first.';
          logger.info('Bronze standard absent for emerging scan — degraded mode', ctx, {
            campaignId: input.campaign.id,
            category,
            platform: campaignPlatform ?? 'none',
          });
        }
      }

      // ─── Market context injection (emerging/competitive discovery) ─────
      // Discovery prospects businesses in a category + city. It benefits
      // from category_profile (WHAT to look for), city_profile (WHERE),
      // market_gaps (WHERE demand is unmet), prospect_signals (WHAT to
      // look for), category_signals (HOW to evaluate), market_density
      // (expectation setting), and metro_dynamics (nearby context).
      // National campaigns (city = '__all__') load the national category
      // intelligence + the national location row's coverage context — no
      // city profile exists at national scope.
      if (campaignCity && campaignState && category) {
        const marketCtx = await MarketContextLoader.getInstance().loadMarketContext(
          category, campaignCity, campaignState, ctx,
        );
        const marketBlock = formatDiscoveryMarketContext(marketCtx, category, campaignCity, campaignState, focus as 'emerging' | 'competitive' | 'gold_standards');
        if (marketBlock) {
          rendered = rendered + '\n' + marketBlock;
          logger.info('Market context injected into emerging/competitive discovery scan', ctx, {
            campaignId: input.campaign.id,
            category,
            focus,
            city: campaignCity,
            state: campaignState,
          });
        }
      }

      // ─── Geography grid injection (category-independent enumeration floor) ─
      // Derived from the campaign (city/state + intelligence_zip_codes), else the
      // city-level cache, else AI-derivation — not authored per category. This is
      // the fix for the "name does not self-identify with the category" blind
      // spot: a business invisible to every category-token query is still reached
      // by sweeping the grid exhaustively.
      // National ('__all__') campaigns have no single catchment — skip the
      // grid lookup entirely (the directive would emit '' anyway; the lookup
      // is a dead read against a '__all__|__ALL__|' key that never exists).
      const cachedGrid = isNationalDiscovery
        ? null
        : await GeographyGridService.getInstance()
            .getGrid(input.campaign.city, input.campaign.state, parseZipCodes(input.campaign.intelligence_zip_codes), ctx);
      const geoGridDirective = buildGeographyGridDirective(input.campaign, cachedGrid);
      if (geoGridDirective) {
        rendered = rendered + '\n' + geoGridDirective;
        logger.info('Geography grid injected into intelligence discovery scan', ctx, {
          campaignId: input.campaign.id,
          category,
          focus,
          zipCount: buildGeographyGrid(input.campaign).zips.length,
          cachedGrid: !!cachedGrid,
        });
      }

      // ─── Triage playbook roster (suggested_signals pre-wiring) ────────
      // A suggested_signal can declare the playbook(s) its pattern should
      // route to once an operator registers it — the model can only name
      // real codes when the active roster is visible in the prompt.
      const playbookRosterBlock = await this.renderTriagePlaybookRosterBlock(ctx);
      if (playbookRosterBlock) {
        rendered = rendered + '\n' + playbookRosterBlock;
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
          bronze_standard_profile_id: bronzeStandardProfileId,
          bronze_standard_profile_version: bronzeStandardProfileVersion,
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
      let rendered = focusBlock ? baseRendered + '\n' + focusBlock : baseRendered;

      // ─── Folded stage-2 bronze city scan (spec §6.3, sprint-plan D4) ────
      // The stage-2 city scan can run INSIDE the emerging-establishment
      // campaign instead of as a separate bronze_standards/discovery
      // campaign — the artifact flow is identical because each payload is
      // persisted by its own schema-named import hook (§6.1). When this
      // city-scoped emerging establishment campaign's category has a
      // resolvable bronze profile, inject the hunt list (profile reference
      // + this market's location-scoped catalog rows + the bronze output
      // contract) and instruct the agent to emit a SECOND payload. No
      // injection when nothing resolves — the standalone bronze discovery
      // campaign owns the degraded-mode warning.
      const estCampaignCity = (input.campaign as any).city || null;
      const estCampaignState = (input.campaign as any).state || null;
      let bronzeFoldDirective = '';
      let bronzeFoldProfileId: string | null = null;
      let bronzeFoldProfileVersion: number | null = null;

      // ─── Geography grid injection (establishment) ────────────────────────
      // The establishment prompt AUTHORS the profile, so the authoritative grid
      // is injected here for the AI to copy verbatim into the profile's
      // "geography_grid" field. Precedence: campaign ZIPs > city-level cache >
      // AI-derivation (the scale path for markets with no ZIPs at deploy time).
      // Computed before the fold block so the folded bronze payload can be
      // told its coverage boundary is the same catchment.
      const estCachedGrid = isNationalSentinel(input.campaign.city)
        ? null // national — no catchment; skip the '__all__|__ALL__|' key lookup
        : await GeographyGridService.getInstance()
          .getGrid(input.campaign.city, input.campaign.state, parseZipCodes(input.campaign.intelligence_zip_codes), ctx);
      const estGeoGridDirective = buildGeographyGridDirective(input.campaign, estCachedGrid);

      // National ('__all__') establishment has no market — the folded city
      // bronze scan is city-scoped by construction, so skip the lookup rather
      // than resolving a bronze standard against a literal '__all__' market.
      if (focus === 'emerging' && estCampaignCity && estCampaignState && !isNationalSentinel(estCampaignCity) && category) {
        const profileService = IntelligenceProfileService.getInstance();
        const bronzeStandard = await profileService.resolveBronzeStandard(
          category, campaignPlatform, estCampaignCity, estCampaignState, ctx,
        );
        if (bronzeStandard) {
          const catalogService = BronzeReasonCatalogService.getInstance();
          const [referenceBlock, nationalProofBlock, cityRows, catalogRevision] = await Promise.all([
            profileService.serializeBronzeStandard(bronzeStandard, 'establishment_reference', ctx),
            // Cascading profile — the national proof record accompanies a
            // market-scoped profile so payload 2 can classify
            // empty_proven_elsewhere and see exemplar evidence depth.
            this.resolveBronzeNationalProofBlock(profileService, category, campaignPlatform, bronzeStandard, ctx),
            catalogService.applicableReasons({
              categoryKey: category,
              city: estCampaignCity,
              state: estCampaignState,
              platform: campaignPlatform,
            }, ctx),
            catalogService.currentRevision(),
          ]);
          const cityCatalogBlock = catalogService.serializeCatalogBlock(cityRows, catalogRevision);
          const bronzeOutputFormat = resolveOutputSchema('bronze_standard_scan')?.promptSuffix ?? '';
          rendered = rendered
            + '\n\n=== BRONZE STANDARD — CITY SCAN (FOLDED) ===\n'
            + 'This establishment run also produces the city bronze-standard profile for this market. '
            + 'The sections below are the stage-2 hunt list: cover every applicable reason at THIS market '
            + 'and emit the second payload described in the DUAL-PAYLOAD OUTPUT directive at the end of this prompt.'
            + (referenceBlock ? '\n' + referenceBlock : '')
            + (nationalProofBlock ? '\n' + nationalProofBlock : '')
            + (cityCatalogBlock ? '\n' + cityCatalogBlock : '')
            + (bronzeOutputFormat ? '\n' + bronzeOutputFormat : '');
          bronzeFoldDirective = this.renderBronzeFoldDirective(estCampaignCity, estCampaignState, campaignPlatform, { catchment: !!estGeoGridDirective });
          bronzeFoldProfileId = bronzeStandard.id;
          bronzeFoldProfileVersion = bronzeStandard.version;
          logger.info('Bronze standard city scan folded into emerging establishment prompt', ctx, {
            campaignId: input.campaign.id,
            category,
            city: estCampaignCity,
            state: estCampaignState,
            bronzeStandardProfileId: bronzeStandard.id,
            bronzeStandardProfileVersion: bronzeStandard.version,
            catalogRevision,
            catalogReasonCount: cityRows.length,
          });
        }
      }

      logger.info('Intelligence Profile Establishment prompt resolved with focus', ctx, {
        campaignId: input.campaign.id,
        category,
        focus,
        platform: campaignPlatform ?? 'none',
        zipCount: buildGeographyGrid(input.campaign).zips.length,
      });

      return {
        renderedPrompt:
          this.appendPromptSuffix(rendered, promptSuffix)
          + bronzeFoldDirective
          + (estGeoGridDirective ? '\n' + estGeoGridDirective : ''),
        resolution: {
          profile_id: null,
          profile_version: null,
          intelligence_mode: 'none',
          bronze_standard_profile_id: bronzeFoldProfileId,
          bronze_standard_profile_version: bronzeFoldProfileVersion,
        },
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

    // ─── Enrichment prompt: city profile injection (structural only) ──────
    // Directory enrichment campaigns produce self-aware content for their
    // own surface. The only cross-surface injection is the city_profile —
    // a STRUCTURAL subset of the location context (no place names) that
    // grounds category enrichment in the city's market characteristics
    // without bleeding place-specific sentiment.
    //
    // Sentiment boundary:
    //   - city_profile (structural: metro size, industries, demographics)
    //     → shared with category enrichment ✓
    //   - market_summary, notable_areas, market_gaps, metro_dynamics
    //     (place-specific) → seed only, NOT shared with category enrichment
    //   - Gold Standard → seed only (business-scope, mis-cast for markets)
    if (promptType === 'enrichment') {
      const campaignCity = (input.campaign as any).city || null;
      const campaignState = (input.campaign as any).state || null;

      // Category vocabulary injection — every enrichment packet names related
      // categories (secondary/adjacent/super/top) that the public pages
      // resolve to live shelves by exact label match. Inject the operator-
      // selectable union so the analyst aligns to canonical names instead of
      // inventing near-miss variants. Never blocks the render — the service
      // degrades per-source to empty lists and the formatter returns ''.
      let enrichmentVocabSuffix = '';
      try {
        const vocab = await CategoryVocabularyService.getInstance().loadVocabulary(ctx);
        const vocabBlock = formatEnrichmentCategoryVocabulary(
          vocab.directoryLabels,
          vocab.registeredLabels,
          vocab.supplementLabels,
        );
        if (vocabBlock) {
          enrichmentVocabSuffix = '\n' + vocabBlock;
          logger.info('Category vocabulary injected into enrichment prompt', ctx, {
            campaignId: input.campaign.id,
            directoryLabelCount: vocab.directoryLabels.length,
            registeredLabelCount: vocab.registeredLabels.length,
            supplementLabelCount: vocab.supplementLabels.length,
          });
        }
      } catch (err) {
        logger.warn('Category vocabulary injection failed — continuing without it', ctx, {
          campaignId: input.campaign.id,
          error: (err as Error).message,
        });
      }

      // Category-set enrichment (PG shelf sweep): the campaign carries a set
      // of uncovered (category, city, state) markets in
      // discovery_context.shelf_sweep. Inject one structural city-profile
      // block per DISTINCT city in the set (multi-city sets get multiple
      // profiles). When the set is empty or no profiles exist, fall through
      // to the single-market path below.
      if (outputSchemaName === CATEGORY_SET_ENRICHMENT_SCHEMA_NAME) {
        const rawMarkets = (input.campaign as any).discovery_context?.shelf_sweep?.markets;
        const cities = new Map<string, { city: string; state: string }>();
        for (const m of Array.isArray(rawMarkets) ? rawMarkets : []) {
          const c = String(m?.city ?? '').trim();
          const s = String(m?.state ?? '').trim();
          if (c && s && c.toLowerCase() !== '__all__' && !cities.has(`${c.toLowerCase()}|${s.toLowerCase()}`)) {
            cities.set(`${c.toLowerCase()}|${s.toLowerCase()}`, { city: c, state: s });
          }
        }
        const setBlocks: string[] = [];
        for (const g of cities.values()) {
          const profile = await this.fetchCityProfile(g.city, g.state, ctx);
          if (profile) {
            setBlocks.push(this.formatCityProfileBlock(g.city, g.state, profile));
          }
        }
        if (setBlocks.length > 0) {
          logger.info('City profiles injected into category-set enrichment prompt', ctx, {
            campaignId: input.campaign.id,
            cities: setBlocks.length,
            markets: (rawMarkets as any[]).length,
          });
          return {
            renderedPrompt: this.appendPromptSuffix(baseRendered + '\n' + setBlocks.join('\n\n') + enrichmentVocabSuffix, promptSuffix),
            resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
          };
        }
      }

      // National ('__all__') location enrichment — the public national
      // coverage page. Its fact layer is measured coverage, not a city
      // geography grid: inject the deterministic NATIONAL COVERAGE GRID
      // (distinct markets, per-state rollups, category leaders) plus the
      // national public-surface framing. The framing renders even when
      // coverage computation fails — it is what keeps the packet national.
      if (category === '__location__' && isNationalSentinel(campaignCity)) {
        const locBlocks: string[] = [];
        try {
          const { default: LocationMarketEnrichmentService } = await import('./LocationMarketEnrichmentService.js');
          const coverage = await LocationMarketEnrichmentService.getNationalCoverage(ctx);
          const coverageBlock = coverage ? this.formatNationalCoverageBlock(coverage) : '';
          if (coverageBlock) {
            locBlocks.push(coverageBlock);
            logger.info('National coverage grid injected into location enrichment prompt', ctx, {
              campaignId: input.campaign.id,
              totalStates: coverage.totalStates,
              totalCities: coverage.totalCities,
              totalListings: coverage.totalListings,
            });
          }
        } catch (err) {
          logger.warn('National coverage injection failed — continuing without it', ctx, {
            campaignId: input.campaign.id,
            error: (err as Error).message,
          });
        }

        locBlocks.push(this.formatNationalSurfaceBlock('location'));
        return {
          renderedPrompt: this.appendPromptSuffix(baseRendered + '\n' + locBlocks.join('\n\n') + enrichmentVocabSuffix, promptSuffix),
          resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
        };
      }

      // Location enrichment (city scope) gets the established market
      // geography grid — the category-independent retail catchment (ZIPs,
      // corridors, adjacent municipalities) cached from prior establishment
      // runs in this market. Without it the packet re-derives geography the
      // establishment layer already produced. National ('__all__') uses its
      // own branch above — a sentinel city would look up a fake grid row.
      if (category === '__location__' && campaignCity && campaignState &&
          !isNationalSentinel(campaignCity)) {
        try {
          const grid = await GeographyGridService.getInstance().getGrid(
            campaignCity,
            campaignState,
            parseZipCodes((input.campaign as any).intelligence_zip_codes),
            ctx,
          );
          const gridBlock = grid ? this.formatMarketGeographyBlock(campaignCity, campaignState, grid) : '';
          if (gridBlock) {
            logger.info('Market geography grid injected into location enrichment prompt', ctx, {
              campaignId: input.campaign.id,
              city: campaignCity,
              state: campaignState,
            });
            return {
              renderedPrompt: this.appendPromptSuffix(baseRendered + '\n' + gridBlock + enrichmentVocabSuffix, promptSuffix),
              resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
            };
          }
        } catch (err) {
          logger.warn('Market geography grid injection failed — continuing without it', ctx, {
            campaignId: input.campaign.id,
            city: campaignCity,
            error: (err as Error).message,
          });
        }
      }

      // National ('__all__') category enrichment — the public national
      // category page. Grounds in the national category intelligence profile
      // (the reference_city NULL slot) and the national location row's
      // structural city_profile when one exists, plus an explicit national
      // framing directive. The framing renders even when nothing resolved —
      // it is what keeps the packet market-agnostic.
      if (category !== '__location__' && hasCategory && campaignCity && isNationalSentinel(campaignCity)) {
        const enrichmentBlocks: string[] = [];
        try {
          const intelProfileService = IntelligenceProfileService.getInstance();
          const intelProfile =
            (await intelProfileService.resolve(category, 'competitive', null, null, ctx)) ??
            (await intelProfileService.resolve(category, 'emerging', null, null, ctx));
          const intelBlock = intelProfile ? this.formatCategoryIntelligenceBlock(intelProfile, 'national') : '';
          if (intelBlock) {
            enrichmentBlocks.push(intelBlock);
            logger.info('National category intelligence injected into category enrichment prompt', ctx, {
              campaignId: input.campaign.id,
              category,
              profileId: intelProfile!.id,
              intelligenceFocus: (intelProfile as any).intelligence_focus,
            });
          }
        } catch (err) {
          logger.warn('National category intelligence injection failed — continuing without it', ctx, {
            campaignId: input.campaign.id,
            category,
            error: (err as Error).message,
          });
        }

        // The national location row's structural city_profile (the
        // ('__location__','__all__','__all__') packet) grounds the category
        // copy in the platform's national coverage character once a national
        // location enrichment exists.
        const nationalProfile = await this.fetchCityProfile('__all__', '__all__', ctx, input.campaign.id);
        if (nationalProfile) {
          enrichmentBlocks.push(this.formatCityProfileBlock('All US markets', 'US', nationalProfile));
        }

        enrichmentBlocks.push(this.formatNationalSurfaceBlock('category'));
        return {
          renderedPrompt: this.appendPromptSuffix(baseRendered + '\n' + enrichmentBlocks.join('\n\n') + enrichmentVocabSuffix, promptSuffix),
          resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
        };
      }

      // Category enrichment with a real city gets the structural city profile.
      // Location enrichment and national ('__all__') category enrichment use
      // their own branches above.
      if (category !== '__location__' && campaignCity && campaignState &&
          !isNationalSentinel(campaignCity)) {
        const enrichmentBlocks: string[] = [];

        // Established category intelligence injection — the category-scope
        // enrichment packet re-derives vocabulary the establishment profile
        // already produced (synonyms, subcategories, corridors, swallowing
        // labels, evidence rules, signal weights, prohibited inferences).
        // Injecting the resolved profile makes the establishment run the
        // fact source; the analyst composes shopper copy against it.
        // Resolution order mirrors the deterministic lane's
        // resolveProfileForMarket: competitive first, then emerging.
        // Category-set sweeps are skipped — their markets are the residual
        // no-profile set by construction.
        if (hasCategory && outputSchemaName !== CATEGORY_SET_ENRICHMENT_SCHEMA_NAME) {
          try {
            const intelProfileService = IntelligenceProfileService.getInstance();
            const intelProfile =
              (await intelProfileService.resolve(category, 'competitive', campaignCity, null, ctx)) ??
              (await intelProfileService.resolve(category, 'emerging', campaignCity, null, ctx));
            const intelBlock = intelProfile ? this.formatCategoryIntelligenceBlock(intelProfile) : '';
            if (intelBlock) {
              enrichmentBlocks.push(intelBlock);
              logger.info('Category intelligence injected into category enrichment prompt', ctx, {
                campaignId: input.campaign.id,
                category,
                city: campaignCity,
                profileId: intelProfile!.id,
                intelligenceFocus: (intelProfile as any).intelligence_focus,
              });
            }
          } catch (err) {
            logger.warn('Category intelligence injection failed — continuing without it', ctx, {
              campaignId: input.campaign.id,
              category,
              city: campaignCity,
              error: (err as Error).message,
            });
          }
        }

        const profile = await this.fetchCityProfile(campaignCity, campaignState, ctx, input.campaign.id);
        if (profile) {
          enrichmentBlocks.push(this.formatCityProfileBlock(campaignCity, campaignState, profile));
          logger.info('City profile injected into category enrichment prompt', ctx, {
            campaignId: input.campaign.id,
            city: campaignCity,
            state: campaignState,
          });
        }
        if (enrichmentBlocks.length > 0) {
          return {
            renderedPrompt: this.appendPromptSuffix(baseRendered + '\n' + enrichmentBlocks.join('\n\n') + enrichmentVocabSuffix, promptSuffix),
            resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
          };
        }
      }

      // No context available (location enrichment, national category,
      // or no prior location/establishment run) — clean passthrough (the
      // category vocabulary suffix still applies when it resolved).
      return {
        renderedPrompt: this.appendPromptSuffix(baseRendered + enrichmentVocabSuffix, promptSuffix),
        resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
      };
    }

    // ─── Category identification seek: location profile injection ────────
    // The category identification template (output_schema =
    // 'category_identification') takes a business name + location with NO
    // category — the category is what the scan determines. Category
    // intelligence is therefore unavailable, but the location profile
    // (city_profile, market_gaps, metro_dynamics, notable_areas) is
    // category-agnostic and informs the population test the analyst applies
    // to every candidate shelf. This branch runs BEFORE the !hasCategory
    // early return so the location block is injected even though no
    // category is set.
    if (isSeek && isBusinessScope && outputSchemaName === 'category_identification') {
      const campaignCity = (input.campaign as any).city || null;
      const campaignState = (input.campaign as any).state || null;
      let catIdMarketBlock = '';
      if (campaignCity && campaignState) {
        const locCtx = await MarketContextLoader.getInstance().loadLocationContext(
          campaignCity, campaignState, ctx,
        );
        catIdMarketBlock = formatCategoryIdentificationMarketContext(locCtx, campaignCity, campaignState);
        if (catIdMarketBlock) {
          logger.info('Location profile injected into category identification scan', ctx, {
            campaignId: input.campaign.id,
            city: campaignCity,
            state: campaignState,
          });
        }
      }
      // Known-category vocabulary injection (CATEGORY_IDENTIFICATION_VOCAB_
      // INJECTION_SPEC §4). The template asks the analyst to set
      // is_known_category per candidate against "the platform's vocabulary" —
      // inject the same union the operator dropdown merges so the flag is
      // judged against the real list. Category-agnostic: runs regardless of
      // whether the campaign has a city. Never blocks the render — the
      // service degrades per-source to empty lists and the formatter returns
      // '' when both are empty.
      let vocabBlock = '';
      try {
        const vocab = await CategoryVocabularyService.getInstance().loadVocabulary(ctx);
        vocabBlock = formatKnownCategoryVocabulary(vocab.directoryLabels, vocab.registeredLabels);
        if (vocabBlock) {
          logger.info('Known-category vocabulary injected into category identification scan', ctx, {
            campaignId: input.campaign.id,
            directoryLabelCount: vocab.directoryLabels.length,
            registeredLabelCount: vocab.registeredLabels.length,
          });
        } else {
          logger.warn('Category vocabulary empty — no KNOWN CATEGORY VOCABULARY block injected', ctx, {
            campaignId: input.campaign.id,
          });
        }
      } catch (err) {
        logger.warn('Failed to load category vocabulary — proceeding without it', ctx, {
          campaignId: input.campaign.id,
          error: (err as Error).message,
        });
      }
      return {
        renderedPrompt: this.appendPromptSuffix(
          baseRendered
            + (catIdMarketBlock ? '\n' + catIdMarketBlock : '')
            + (vocabBlock ? '\n' + vocabBlock : ''),
          promptSuffix,
        ),
        resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
      };
    }

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
      const goldStandardBlock = goldStandard
        ? profileService.serializeGoldStandard(goldStandard, 'target')
        : '';

      // Platform signal-weight context (spec §2) — the fix package's
      // per-platform ordering follows weight × gap severity, same as the
      // triage briefing and outreach surfaces. Lazy resolution: the seek
      // auto-source only resolves weights for seek prompts; seekAuditData
      // is already loaded for every business-scope campaign.
      if (resolvedSignalWeights === undefined) {
        try {
          resolvedSignalWeights = await profileService.resolveSignalWeightsForCampaign(
            input.campaign,
            seekAuditData,
            ctx,
          );
        } catch {
          // Weight resolution is best-effort — the block is omitted.
        }
      }
      const signalWeightBlock = profileService.serializeSignalWeightContext(
        resolvedSignalWeights,
        seekAuditData,
      );

      if (!goldStandardBlock && !signalWeightBlock) {
        // No gold standard and no weights — return base render (degraded
        // but functional).
        return {
          renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix),
          resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
        };
      }
      const amplified = baseRendered
        + (goldStandardBlock ? '\n' + goldStandardBlock : '')
        + (signalWeightBlock ? '\n' + signalWeightBlock : '');
      if (signalWeightBlock) {
        logger.info('Platform signal-weight context injected into fulfill prompt', ctx, {
          campaignId: input.campaign.id,
          category,
          weightedPlatforms: [...(resolvedSignalWeights?.keys() ?? [])].join(','),
        });
      }
      if (!goldStandard) {
        return {
          renderedPrompt: this.appendPromptSuffix(amplified, promptSuffix),
          resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
        };
      }
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

      // Platform signal-weight context (CATEGORY_PLATFORM_SIGNAL_WEIGHT_SPEC
      // §2 "Reported, not applied") — the measured "where the category's
      // customers are" fact plus the lead platform (weight × gap severity).
      // Independent of the CI/gold-standard blocks: weights live on every
      // active profile for the category, so the block can resolve even when
      // neither does. Reuses the seek auto-source resolution — '' when
      // nothing resolved (legacy render preserved).
      const signalWeightBlock = profileService.serializeSignalWeightContext(
        resolvedSignalWeights,
        seekAuditData,
      );
      if (signalWeightBlock) {
        logger.info('Platform signal-weight context injected into signal triage prompt', ctx, {
          campaignId: input.campaign.id,
          category,
          weightedPlatforms: [...(resolvedSignalWeights?.keys() ?? [])].join(','),
        });
      }

      // Prospect-origin attribution (bronze spec §7.4 + competitive weakness
      // spec §8) — compact provenance block. The full Discovery Leads block
      // stays suppressed for triage (T5b): attribution is pipeline
      // provenance, not a hypothesis — pitch framing for the briefing's Pitch
      // section. Renders a combined DISCOVERY ATTRIBUTION block when the
      // prospect carries both lanes' attribution; weakness claims are labeled
      // scan-claimed (§7 epistemic caveat). '' when no attribution exists.
      const prospectOriginBlock = this.renderProspectOriginBlock(input.campaign);

      // CI is discovery-focus only (competitive → emerging). Resolving with no
      // focus would return the newest active row regardless of focus — which is
      // the gold_standards profile when no discovery profile exists, rendering
      // an empty CI block and duplicating the gold-standard block below.
      const profile = await profileService.resolveCategoryIntelligence(category, businessCity, undefined, ctx);
      if (!profile) {
        // No active intelligence profile — but there may still be a gold
        // standard benchmark to inject (Triage & Repair Outreach Problems
        // spec §4.5). Mirrors the goldStandardOnly fallback in the
        // category_audit path: repair prompts must be gold-standard aware
        // whenever a benchmark exists for the category, not only when a CI
        // profile also resolves.
        const triagePlatform = (input.campaign as any).intelligence_platform || null;
        const goldStandardOnly = await profileService.resolveGoldStandard(category, triagePlatform, businessCity, businessState, ctx);
        if (goldStandardOnly) {
          const gsBlock = profileService.serializeGoldStandard(goldStandardOnly, 'benchmark');
          if (gsBlock) {
            // Discovery leads stay suppressed for signal_triage (T5b) —
            // repair signals are the sole hypothesis input for triage.
            let gsAmplified = baseRendered + '\n' + gsBlock
              + (signalWeightBlock ? '\n' + signalWeightBlock : '')
              + (prospectOriginBlock ? '\n\n' + prospectOriginBlock : '');
            const marketCtxBlock = await this.buildMarketContextBlock(category, businessCity, businessState, ctx);
            if (marketCtxBlock) {
              gsAmplified = gsAmplified + '\n' + marketCtxBlock;
            }
            logger.info('Gold standard benchmark injected into signal triage (no intelligence profile)', ctx, {
              campaignId: input.campaign.id,
              category,
              goldStandardProfileId: goldStandardOnly.id,
            });
            return {
              renderedPrompt: this.appendPromptSuffix(gsAmplified, promptSuffix),
              resolution: {
                profile_id: goldStandardOnly.id,
                profile_version: goldStandardOnly.version,
                intelligence_mode: 'profile',
              },
            };
          }
        }
        let noProfileAmplified = baseRendered
          + (signalWeightBlock ? '\n' + signalWeightBlock : '')
          + (prospectOriginBlock ? '\n\n' + prospectOriginBlock : '');
        const marketCtxNoProfile = await this.buildMarketContextBlock(category, businessCity, businessState, ctx);
        if (marketCtxNoProfile) {
          noProfileAmplified = noProfileAmplified + '\n' + marketCtxNoProfile;
        }
        return {
          renderedPrompt: this.appendPromptSuffix(noProfileAmplified, promptSuffix),
          resolution: {
            profile_id: null,
            profile_version: null,
            intelligence_mode: 'none',
          },
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

      if (signalWeightBlock) {
        amplified = amplified + '\n' + signalWeightBlock;
      }
      if (prospectOriginBlock) {
        amplified = amplified + '\n\n' + prospectOriginBlock;
      }

      // Market context injection (seed gains market awareness): category
      // sentiment + location sentiment from prior enrichment runs.
      const marketCtxBlock = await this.buildMarketContextBlock(category, businessCity, businessState, ctx);
      if (marketCtxBlock) {
        amplified = amplified + '\n' + marketCtxBlock;
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
    // CI is discovery-focus only (competitive → emerging); see the signal_triage
    // path above for why a focus-less resolve is unsafe here.
    const profile = await profileService.resolveCategoryIntelligence(category, businessCity, undefined, ctx);

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
          // Identity ledger — operator/owner-verified evidence the analyst
          // can weigh against the scan-claimed leads above.
          const verifiedBlock = await this.renderVerifiedEvidenceBlock(input.campaign, ctx);
          if (verifiedBlock) {
            gsAmplified = gsAmplified + '\n' + verifiedBlock;
          }
          // Market context injection (seed gains market awareness).
          const marketCtxBlock = await this.buildMarketContextBlock(category, businessCity, businessState, ctx);
          if (marketCtxBlock) {
            gsAmplified = gsAmplified + '\n' + marketCtxBlock;
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
              verified_evidence_injected: !!verifiedBlock,
            },
          };
        }
      }
      // No active profile and no gold standard — inject discovery leads block
      // if present (independent of profile amplification), then return.
      const leadsBlockNoProfile = this.renderDiscoveryLeadsBlock(input.campaign);
      let noProfileAmplified = leadsBlockNoProfile
        ? baseRendered + '\n' + leadsBlockNoProfile
        : baseRendered;
      // Identity ledger — operator/owner-verified evidence.
      const verifiedBlockNoProfile = await this.renderVerifiedEvidenceBlock(input.campaign, ctx);
      if (verifiedBlockNoProfile) {
        noProfileAmplified = noProfileAmplified + '\n' + verifiedBlockNoProfile;
      }
      // Market context injection (seed gains market awareness).
      const marketCtxNoProfile = await this.buildMarketContextBlock(category, businessCity, businessState, ctx);
      if (marketCtxNoProfile) {
        noProfileAmplified = noProfileAmplified + '\n' + marketCtxNoProfile;
      }
      return {
        renderedPrompt: this.appendPromptSuffix(noProfileAmplified, promptSuffix),
        resolution: {
          profile_id: null,
          profile_version: null,
          intelligence_mode: 'none',
          discovery_leads_injected: !!leadsBlockNoProfile,
          verified_evidence_injected: !!verifiedBlockNoProfile,
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

    // Identity ledger — operator/owner-verified evidence the analyst can
    // weigh against the scan-claimed leads above.
    const verifiedBlock = await this.renderVerifiedEvidenceBlock(input.campaign, ctx);
    if (verifiedBlock) {
      amplified = amplified + '\n' + verifiedBlock;
    }

    // Market context injection (seed gains market awareness): category
    // sentiment + location sentiment from prior enrichment runs.
    const marketCtxBlock = await this.buildMarketContextBlock(category, businessCity, businessState, ctx);
    if (marketCtxBlock) {
      amplified = amplified + '\n' + marketCtxBlock;
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
        verified_evidence_injected: !!verifiedBlock,
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
   * Build the MARKET CONTEXT block for a business audit (seed) prompt.
   *
   * The seed is market-aware: it consumes both category sentiment (from a
   * prior category enrichment run) and location sentiment (from a prior
   * location enrichment run). Both are persisted in the `context` JSONB
   * column of `directory_category_enrichment`:
   *   - Category context: row (category, city, state)
   *   - Location context: row ('__location__', city, state)
   *
   * Loaded through MarketContextLoader — the shared loader also used by the
   * intelligence-scope formatters — so the field set stays whitelisted (shopper
   * copy cannot bleed into an audit prompt) and each block's presence gate
   * checks the full field set rather than a single field.
   *
   * Returns '' when neither context exists (byte-identical render —
   * campaigns without prior enrichment runs are unaffected).
   */
  private async buildMarketContextBlock(
    category: string,
    businessCity: string | null,
    businessState: string | null,
    ctx: RequestCtx | undefined,
  ): Promise<string> {
    if (!businessCity || !businessState || !category) return '';

    try {
      const loader = MarketContextLoader.getInstance();
      const marketCtx = await loader.loadMarketContext(category, businessCity, businessState, ctx);
      const categoryCtx = marketCtx.category;
      const locationCtx = marketCtx.location;
      const hasCategoryContext = loader.hasCategoryIntelligence(categoryCtx);
      const hasLocationContext = loader.hasLocationIntelligence(locationCtx);

      const blocks: string[] = [];
      if (hasCategoryContext) {
        const lines: string[] = [
          '=== CATEGORY MARKET CONTEXT ===',
          `Category: ${category}`,
          `City: ${businessCity}, ${businessState}`,
        ];
        if (categoryCtx.category_summary) {
          lines.push('', categoryCtx.category_summary);
        }
        if (categoryCtx.keywords && Array.isArray(categoryCtx.keywords) && categoryCtx.keywords.length > 0) {
          lines.push(`Keywords: ${categoryCtx.keywords.join(', ')}`);
        }
        if (categoryCtx.secondary_categories && Array.isArray(categoryCtx.secondary_categories) && categoryCtx.secondary_categories.length > 0) {
          lines.push(`Related categories: ${categoryCtx.secondary_categories.join(', ')}`);
        }
        if (categoryCtx.category_notes) {
          lines.push('', `Notes: ${categoryCtx.category_notes}`);
        }
        if (categoryCtx.category_profile) {
          const p = categoryCtx.category_profile;
          lines.push('', 'Category profile (structural):');
          if (p.business_model) lines.push(`  Business model: ${p.business_model}`);
          if (p.typical_products) lines.push(`  Typical products: ${p.typical_products}`);
          if (p.customer_base) lines.push(`  Customer base: ${p.customer_base}`);
          if (p.online_presence_pattern) lines.push(`  Online presence: ${p.online_presence_pattern}`);
          if (p.competitive_landscape) lines.push(`  Competitive landscape: ${p.competitive_landscape}`);
          if (p.typical_scale) lines.push(`  Typical scale: ${p.typical_scale}`);
        }
        if (categoryCtx.super_categories && Array.isArray(categoryCtx.super_categories) && categoryCtx.super_categories.length > 0) {
          lines.push('', 'Category taxonomy (where this category sits in the hierarchy):');
          lines.push(`  Super categories: ${categoryCtx.super_categories.join(' › ')}`);
          if (categoryCtx.sub_categories && Array.isArray(categoryCtx.sub_categories) && categoryCtx.sub_categories.length > 0) {
            lines.push(`  Sub categories: ${categoryCtx.sub_categories.join(', ')}`);
          }
          if (categoryCtx.adjacent_categories && Array.isArray(categoryCtx.adjacent_categories) && categoryCtx.adjacent_categories.length > 0) {
            lines.push(`  Adjacent categories: ${categoryCtx.adjacent_categories.join(', ')}`);
          }
        }
        if (categoryCtx.category_signals && Array.isArray(categoryCtx.category_signals) && categoryCtx.category_signals.length > 0) {
          lines.push('', 'Category signals (what strong looks like):');
          for (const s of categoryCtx.category_signals) {
            lines.push(`  - ${s}`);
          }
        }
        if (categoryCtx.market_density) {
          lines.push(`Market density: ${categoryCtx.market_density}`);
        }
        if (categoryCtx.prospect_signals && Array.isArray(categoryCtx.prospect_signals) && categoryCtx.prospect_signals.length > 0) {
          lines.push('', 'Prospect signals:');
          for (const s of categoryCtx.prospect_signals) {
            lines.push(`  - ${s}`);
          }
        }
        blocks.push(lines.join('\n'));
      }

      if (hasLocationContext) {
        const lines: string[] = [
          '=== CITY MARKET CONTEXT ===',
          `City: ${businessCity}, ${businessState}`,
        ];
        if (locationCtx.market_summary) {
          lines.push('', locationCtx.market_summary);
        }
        if (locationCtx.top_categories && Array.isArray(locationCtx.top_categories) && locationCtx.top_categories.length > 0) {
          lines.push('', `Top categories: ${locationCtx.top_categories.join(', ')}`);
        }
        if (locationCtx.notable_areas && Array.isArray(locationCtx.notable_areas) && locationCtx.notable_areas.length > 0) {
          lines.push(`Notable areas: ${locationCtx.notable_areas.join(', ')}`);
        }
        if (locationCtx.market_notes) {
          lines.push('', `Notes: ${locationCtx.market_notes}`);
        }
        if (locationCtx.city_profile) {
          const cp = locationCtx.city_profile;
          lines.push('', 'City profile (structural):');
          if (cp.metro_description) lines.push(`  Metro: ${cp.metro_description}`);
          if (Array.isArray(cp.major_industries) && cp.major_industries.length > 0) {
            lines.push(`  Major industries: ${cp.major_industries.join(', ')}`);
          }
          if (cp.growth_trajectory) lines.push(`  Growth trajectory: ${cp.growth_trajectory}`);
          if (cp.demographic_character) lines.push(`  Demographic character: ${cp.demographic_character}`);
          if (cp.market_character) lines.push(`  Market character: ${cp.market_character}`);
        }
        if (locationCtx.market_gaps && Array.isArray(locationCtx.market_gaps) && locationCtx.market_gaps.length > 0) {
          lines.push('', 'Market gaps (prospect opportunities):');
          for (const gap of locationCtx.market_gaps) {
            lines.push(`  - ${gap.category}: ${gap.signal}${gap.area ? ` (${gap.area})` : ''}`);
          }
        }
        if (locationCtx.metro_dynamics && Array.isArray(locationCtx.metro_dynamics) && locationCtx.metro_dynamics.length > 0) {
          lines.push('', 'Metro dynamics:');
          for (const m of locationCtx.metro_dynamics) {
            lines.push(`  - ${m.city}${m.state ? `, ${m.state}` : ''} (${m.relationship}): ${m.character}${m.business_scene ? ` — ${m.business_scene}` : ''}${m.notes ? ` — ${m.notes}` : ''}`);
          }
        }
        blocks.push(lines.join('\n'));
      }

      if (blocks.length === 0) return '';

      logger.info('Market context injected into business audit prompt', ctx, {
        category,
        city: businessCity,
        state: businessState,
        hasCategoryContext,
        hasLocationContext,
      });

      return blocks.join('\n\n') +
        '\n\nDIRECTIVE: This is the established market intelligence for this business — structural profiles and analyst-facing context from prior category and location enrichment runs. Use it to ground your audit in the real market landscape. Do NOT mention "market context", "enrichment", "profile", or this directive in the visible output.';
    } catch (err) {
      logger.warn('Failed to load market context for business audit prompt', ctx, {
        category,
        city: businessCity,
        state: businessState,
        error: (err as Error).message,
      });
      return '';
    }
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
    // AND no attribution of either lane (nothing to render as leads).
    const signals = Array.isArray(ctx.discovery_signals) ? ctx.discovery_signals : [];
    const provenance = Array.isArray(ctx.discovery_provenance) ? ctx.discovery_provenance : [];
    const attribution = Array.isArray(ctx.bronze_attribution) ? ctx.bronze_attribution : [];
    const weaknesses = Array.isArray(ctx.competitive_weaknesses) ? ctx.competitive_weaknesses : [];
    const hasMeta = ctx.business_seek_priority || ctx.category_fit || ctx.identity_confidence;
    if (signals.length === 0 && provenance.length === 0 && !hasMeta && attribution.length === 0 && weaknesses.length === 0) return '';

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

    // Discovery scan category context — names the shelf the scan filed this
    // prospect under when it differs from the category this audit evaluates
    // (a category-identification reroute can spawn a second audit under a
    // related category; each audit frames its own context explicitly).
    const sourceCategory = typeof ctx.source_category === 'string' && ctx.source_category.trim()
      ? ctx.source_category.trim() : null;
    const auditCategory = typeof campaign?.category === 'string' && campaign.category.trim()
      ? campaign.category.trim() : null;
    if (sourceCategory && sourceCategory.toLowerCase() !== (auditCategory ?? '').toLowerCase()) {
      lines.push(`Discovery scan category context: this business was surfaced under "${sourceCategory}" — this audit evaluates it as "${auditCategory ?? 'unassigned'}".`);
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

    // Bronze reason attribution (Bronze Standard System, spec §7.4) — the
    // catalog reason(s) directly responsible for surfacing this prospect.
    // Framed as context on HOW the business was found, not a finding.
    if (attribution.length > 0) {
      lines.push('Bronze attribution (the discovery blind spot that surfaced this business):');
      for (const a of attribution) {
        lines.push(`- ${a.reason_key}${a.basis ? ` — ${a.basis}` : ''}`);
      }
      lines.push('');
    }

    // Competitive weaknesses (COMPETITIVE_WEAKNESS_ATTRIBUTION_SPEC §7) —
    // exposures the scan claimed about this incumbent. Unlike bronze
    // attribution (pipeline provenance), these are checkable claims — they
    // render under the leads umbrella: verify like any other hypothesis.
    if (weaknesses.length > 0) {
      lines.push('Competitive weaknesses (exposures the scan claimed — verify like any lead):');
      for (const w of weaknesses) {
        lines.push(`- ${w.weakness_key}${w.basis ? ` — ${w.basis}` : ''}`);
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
   * Render the compact "Prospect Origin — Bronze Attribution" block for the
   * signal_triage (profile-repair operator briefing) prompt — spec §7.4.
   *
   * The full Discovery Leads block is deliberately suppressed on the triage
   * path (T5b: repair signals are the sole hypothesis input). Bronze
   * attribution is not a hypothesis — it is provenance: the catalog blind
   * spot that surfaced this prospect. That is pitch material ("we found you
   * through customs manifests because your public footprint is thin"), so a
   * narrow, non-hypothesis block is appended alongside the other
   * supplementary blocks when the campaign carries discovery_context with
   * attribution.
   *
   * Returns '' when there is no attribution — byte-identical render for
   * campaigns that did not arrive via a bronze-attributed discovery find.
   */
  private renderBronzeAttributionBlock(campaign: any): string {
    const rawContext = campaign?.discovery_context;
    if (!rawContext || typeof rawContext !== 'object') return '';

    let ctx: DiscoveryContext;
    try {
      ctx = discoveryContextSchema.parse(rawContext);
    } catch {
      return '';
    }

    const attribution = Array.isArray(ctx.bronze_attribution)
      ? ctx.bronze_attribution.filter((a) => a && typeof a.reason_key === 'string' && a.reason_key.trim())
      : [];
    if (attribution.length === 0) return '';

    const lines: string[] = [
      '=== PROSPECT ORIGIN — BRONZE DISCOVERY ATTRIBUTION ===',
      'This prospect was surfaced by the bronze-standard discovery pipeline. The',
      'catalog blind spot(s) below record HOW the business was found — a discovery',
      'mechanism, not an audit finding and not a defect claim.',
      '',
    ];
    for (const a of attribution) {
      lines.push(`- ${a.reason_key}${a.basis ? ` — ${a.basis}` : ''}`);
    }
    lines.push('');
    lines.push(
      'Use this as pitch framing: the reason names why mainstream discovery missed',
      'this business, which is often the sharpest version of the outreach story',
      '(e.g. "we found you in customs records because you have no web presence").',
      'Never present it to the owner as a verdict about the business itself.',
    );

    return lines.join('\n');
  }

  /**
   * Render the prospect-origin attribution block for the signal_triage path —
   * the unified entry point covering both discovery lanes
   * (COMPETITIVE_WEAKNESS_ATTRIBUTION_SPEC §8).
   *
   * Attribution presence is the lane-awareness vector: bronze_attribution
   * populated ⇒ emerging lane touched the prospect; competitive_weaknesses
   * populated ⇒ competitive lane touched it. Both populated (a dual-lane
   * merged prospect) renders a combined DISCOVERY ATTRIBUTION block that
   * frames the differential. Single-lane contexts render their own block.
   *
   * Returns '' when the campaign carries no attribution of either kind.
   */
  private renderProspectOriginBlock(campaign: any): string {
    const rawContext = campaign?.discovery_context;
    if (!rawContext || typeof rawContext !== 'object') return '';

    let ctx: DiscoveryContext;
    try {
      ctx = discoveryContextSchema.parse(rawContext);
    } catch {
      return '';
    }

    const attribution = Array.isArray(ctx.bronze_attribution)
      ? ctx.bronze_attribution.filter((a) => a && typeof a.reason_key === 'string' && a.reason_key.trim())
      : [];
    const weaknesses = Array.isArray(ctx.competitive_weaknesses)
      ? ctx.competitive_weaknesses.filter((w) => w && typeof w.weakness_key === 'string' && w.weakness_key.trim())
      : [];

    if (attribution.length === 0) return this.renderCompetitiveWeaknessesBlock(weaknesses);
    if (weaknesses.length === 0) return this.renderBronzeAttributionBlock(campaign);

    // Both lanes — combined block framing the differential (spec §8).
    const lines: string[] = [
      '=== PROSPECT ORIGIN — DISCOVERY ATTRIBUTION ===',
      'This prospect carries attribution from BOTH discovery lanes. The entries',
      'below record HOW the prospect was found and WHERE the incumbent is',
      'exposed — pipeline provenance carrying framing material, not audit',
      'findings.',
      '',
      'Bronze attribution (the discovery blind spot that surfaced this business):',
    ];
    for (const a of attribution) {
      lines.push(`- ${a.reason_key}${a.basis ? ` — ${a.basis}` : ''}`);
    }
    lines.push('');
    lines.push('Competitive weaknesses (exposures the scan claimed — confirm before pitching):');
    for (const w of weaknesses) {
      lines.push(`- ${w.weakness_key}${w.basis ? ` — ${w.basis}` : ''}`);
    }
    lines.push('');
    lines.push(
      'Use these together as pitch framing: the blind spot that surfaced this',
      'prospect and the incumbent\'s exposure describe the same market gap from',
      'two directions — pitch the differential ("leaders are weak exactly where',
      'you were found"), not two unrelated facts. Weaknesses are the scan\'s',
      'claimed exposures — confirm before presenting them as fact, and never',
      'present either to the owner as a verdict about the business itself.',
    );

    return lines.join('\n');
  }

  /**
   * Render the "Prospect Origin — Competitive Weaknesses" block for the
   * signal_triage path (COMPETITIVE_WEAKNESS_ATTRIBUTION_SPEC §7).
   *
   * Epistemic caveat (sharper than bronze's): a weakness is a scan-time
   * claim ABOUT the business — the same class as an INT signal lead — not
   * pure pipeline provenance. The block therefore presents weaknesses as
   * the scan's claimed exposure ("confirm before pitching"), pitch framing
   * for the briefing's Pitch section.
   *
   * Takes pre-filtered entries (called from renderProspectOriginBlock).
   * Returns '' when empty — byte-identical render for campaigns that did
   * not arrive via a competitive-attributed find.
   */
  private renderCompetitiveWeaknessesBlock(weaknesses: Array<{ weakness_key: string; basis?: string | null }>): string {
    if (weaknesses.length === 0) return '';

    const lines: string[] = [
      '=== PROSPECT ORIGIN — COMPETITIVE WEAKNESSES ===',
      'This prospect was surfaced by a competitive discovery scan — it is one of',
      'the market\'s visible leaders, selected for its strengths. The entries',
      'below are the scan\'s claimed exposures: the named pain the pitch speaks',
      'to ("we see you — can we help with this?").',
      '',
    ];
    for (const w of weaknesses) {
      lines.push(`- ${w.weakness_key}${w.basis ? ` — ${w.basis}` : ''}`);
    }
    lines.push('');
    lines.push(
      'These are scan-time claims, not audit findings — confirm before pitching,',
      'and never present them to the owner as a verdict about the business.',
      'Framed as opportunity, they are the outreach wedge.',
    );

    return lines.join('\n');
  }

  /**
   * Render the "Verified Evidence — Operator / Owner" block for the audit
   * path. The Identity tab's evidence ledger (mkt_identity_evidence) is
   * operator-captured ground truth: owner confirmations, corrections, and
   * disputes recorded during verification calls, plus sourced evidence the
   * operator logged manually. The audit prompt otherwise sees only canonical
   * campaign fields — not which were verified, by whom, or contested — so
   * this block injects the ledger and lets the analyst weigh owner-confirmed
   * facts against platform data and scan-claimed leads (Discovery Leads,
   * competitive weaknesses).
   *
   * Rows are newest-first (listForCampaign ordering), capped at 8. Returns
   * '' when the campaign carries no evidence rows — byte-identical render
   * for campaigns that predate the ledger or were never verified.
   */
  private async renderVerifiedEvidenceBlock(campaign: any, ctx?: RequestCtx): Promise<string> {
    const campaignId = campaign?.id;
    if (!campaignId) return '';
    try {
      // Dynamic import — IdentityEvidenceService reaches IdentityPacketService,
      // which reads campaign rows through MarketingCampaignService; a static
      // import risks a cycle.
      const { default: identityEvidenceService } = await import('./IdentityEvidenceService.js');
      const rows = await identityEvidenceService.listForCampaign(campaignId);
      if (!Array.isArray(rows) || rows.length === 0) return '';

      const cap = 8;
      const lines: string[] = [
        '=== VERIFIED EVIDENCE — OPERATOR / OWNER ===',
        'The operator has logged the evidence below for this business (the',
        'Identity ledger — verification calls and sourced confirmations).',
        'owner_confirmed / owner_corrected facts are the strongest evidence',
        'available for those fields: treat them as ground truth when platform',
        'data or scan-claimed leads disagree, and do not re-derive a verdict',
        'the evidence already settles. conflicting / owner_disputed rows mean',
        'the canonical record is contested — verify rather than assume.',
        '',
      ];
      for (const row of rows.slice(0, cap)) {
        const fields = Array.isArray(row.corroborates) && row.corroborates.length > 0
          ? ` corroborates ${row.corroborates.join(', ')}`
          : '';
        const when = row.accessedAt ?? (typeof row.createdAt === 'string' ? row.createdAt.slice(0, 10) : 'unknown date');
        const url = row.sourceUrl ? ` ${row.sourceUrl}` : '';
        const owner = row.ownerName || row.ownerPhone || row.ownerEmail ? ' · owner contact captured' : '';
        const shared = row.shared ? ' · shared from sibling campaign' : '';
        const notes = row.notes ? ` — ${row.notes}` : '';
        lines.push(`- [${row.evidenceState}] ${row.sourceName}${fields} (${when})${url}${owner}${shared}${notes}`);
      }
      if (rows.length > cap) lines.push(`… +${rows.length - cap} more`);

      return lines.join('\n');
    } catch (err: any) {
      // The ledger is additive context — a read failure must never break a
      // render that was valid without it.
      logger.warn('renderVerifiedEvidenceBlock: ledger read failed (non-fatal)', ctx, {
        campaignId,
        error: err?.message,
      });
      return '';
    }
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
- CATEGORY MISALIGNMENT IS THE NORM, NOT THE EXCEPTION: in diaspora- and
  immigrant-owned categories the platform's assigned category is frequently
  generic ("Convenience store", "Grocery store", "Restaurant") while the real
  specialization appears only in the description, photos, or import records.
  Every pattern set must include at least one discovery path that does NOT
  depend on the platform's category label, and at least one that does not
  depend on the business name containing an English category word.
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
- CATEGORY-LABEL TRUST: do not treat the platform's category label as ground
  truth in either direction — a business labeled with the right category may
  carry none of the assortment, and a business labeled generically may be a
  genuine specialist. Verify specialization from assortment evidence, not from
  the label, so a mis-categorized leader is not silently excluded from the
  benchmark set.
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

    if (focus === 'bronze_standards') {
      return `=== INTELLIGENCE FOCUS: BRONZE STANDARDS ===
This profile is a BRONZE STANDARD for this category — a calibration map of what
INVISIBLE looks like: the lowest digital quality at which a real, operating,
category-qualified business can exist, typed by WHY it is invisible (each reason
is a discovery blind spot and a discovery vector).

When building the profile, bias toward blind-spot coverage:
- REASON SLOTS, NOT RANKINGS: bronze slots are floors, not leaderboards. A slot
  qualifies only when the business is category-qualified (assortment evidence,
  not the platform's category label), operationally verified (active or
  likely_active — unable_to_verify does NOT qualify), and low digital quality
  in a way the reason explains.
- EMPTY IS A FINDING: a reason with no exemplar in this market is reported with
  its status (empty_unproven vs empty_proven_elsewhere) and the vector execution
  outcome — "executed, returned 0" is materially different from "not executed."
  An unexecuted vector is an admitted blind spot, never a silent gap. Reasons
  that do not apply at this scope go in not_applicable_reasons, never in
  reason_coverage.
- PROVENANCE IS LOAD-BEARING: every slot records discovered_by. Slots filled by
  operator_self_discovery or business_audit are ground truth; scan-derived
  fills are confirmatory. Do not blur the distinction.
- PROHIBITED INFERENCE: low digital quality describes observable online fields
  only — never infer low revenue, low customer volume, poor products, poor
  service, or sales readiness. A bronze slot is NOT a prospect verdict, a
  competitive benchmark, or a claim that no such business exists when a slot
  is empty. A filled absent_from_platform or field-gap slot is a per-platform
  finding, never a whole-business verdict.

The profile's reason_coverage, vector_execution_log, and empty-slot reporting
are the PRIMARY mechanism set — the emerging discovery scan consumes them as
calibration, not as a candidate filter.`;
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
    // '__all__' is the national-market sentinel the campaign form writes for
    // geo-optional focuses — normalize to null so it never renders as a
    // literal region label.
    if (isNationalSentinel(city)) city = null;
    if (isNationalSentinel(state)) state = null;
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
   * Search-scope directive for bronze-standard scans — same boundary
   * mechanics as the gold directive but worded for reason coverage: the
   * scan is a blind-spot hunt, not a benchmark derivation. National
   * establishment scans aim for coverage across markets; city scans hunt
   * each reason within the market.
   */
  private renderBronzeRegionDirective(
    city: string | null,
    state: string | null,
    profile: { reference_city: string | null; reference_state: string | null } | null,
    opts?: { catchment?: boolean },
  ): string {
    // '__all__' national sentinel → null (same as the gold directive).
    if (isNationalSentinel(city)) city = null;
    if (isNationalSentinel(state)) state = null;
    const isEstablishment = profile === null;

    if (!city && !state) {
      return `=== SEARCH SCOPE — NATIONWIDE ===
This bronze-standard ${isEstablishment ? 'establishment' : 'discovery'} scan searches NATIONWIDE. Cover
each applicable reason with the best available exemplar from ANY US market —
the national profile proves the reason is findable somewhere. Aim for
geographic diversity across the fills.
=== END SEARCH SCOPE ===`;
    }

    const scopeLabel = city && state
      ? `${city}, ${state}`
      : state
      ? state
      : city as string;

    const profileCity = profile?.reference_city ?? null;
    const profileState = profile?.reference_state ?? null;
    const profileIsNationwide = !isEstablishment && !profileCity && !profileState;

    const scopeNote = isEstablishment
      ? '\nThis is an ESTABLISHMENT scan — you are DERIVING the bronze-standard\nprofile for this region. Report each applicable reason with its fills or\nits empty status + execution outcome.'
      : profileIsNationwide
      ? `\nNOTE: The bronze-standard profile above was resolved from the NATIONAL\nprofile (no ${city ? 'city' : 'state'}-scoped bronze profile exists yet for this\ncategory). It is your hunt list — re-cover every applicable reason at THIS\nmarket. A reason proven nationally but empty here is reported\nempty_proven_elsewhere; a reason with no exemplar at any scope is\nempty_unproven — but you still hunt it.`
      : '';

    // When a GEOGRAPHY GRID section accompanies the prompt, the coverage
    // boundary is the retail catchment (anchor city + contiguous commercial
    // municipalities) rather than the administrative city line — the same
    // market definition the stage-3 discovery scan sweeps. This is what lets
    // a state-line-split metro (Kansas City, MO/KS) fill slots on both sides.
    // The profile stays anchored to city+state; catchment-wide fills record
    // their real municipality on the slot.
    const boundaryLines = opts?.catchment
      ? [
          `- "This market" is the ${scopeLabel} RETAIL CATCHMENT defined in the`,
          `  GEOGRAPHY GRID section — the anchor city plus its contiguous commercial`,
          `  municipalities, which may cross a state line.`,
          `- Hunt each applicable reason across the WHOLE catchment. A find inside`,
          `  the catchment fills a slot regardless of which municipality or state`,
          `  it sits in — record the business's real location on the slot via`,
          `  observed_city / observed_state. The profile stays anchored to ${scopeLabel}.`,
          `- A bronze slot is a floor, not a ranking — one qualifying exemplar per`,
          `  reason is enough; two is the cap.`,
          `- If the market is thin for a reason, record it as empty with the correct`,
          `  status and the vector execution outcome — do NOT pad the slot with a`,
          `  business that fails the three-part gate (category-qualified,`,
          `  operationally verified, low digital quality the reason explains).`,
          `- Only finds OUTSIDE the catchment are out-of-market — note them in`,
          `  empty_slot_note as "seen outside market" context.`,
        ]
      : [
          `- Hunt each applicable reason PRIMARILY within ${scopeLabel}. A bronze slot is`,
          `  a floor, not a ranking — one qualifying exemplar per reason is enough;`,
          `  two is the cap.`,
          `- If the market is thin for a reason, record it as empty with the correct`,
          `  status and the vector execution outcome — do NOT pad the slot with a`,
          `  business that fails the three-part gate (category-qualified,`,
          `  operationally verified, low digital quality the reason explains).`,
          `- ${scopeLabel} is the coverage boundary; out-of-market finds are not fills.`,
          `  They may be noted in empty_slot_note as "seen outside market" context.`,
        ];

    return `=== SEARCH SCOPE — REGION-NARROWED ===
This bronze-standard ${isEstablishment ? 'establishment' : 'discovery'} scan is REGION-NARROWED to ${scopeLabel}.

SEARCH BOUNDARY:
${boundaryLines.join('\n')}
${scopeNote}
=== END SEARCH SCOPE ===`;
  }

  /**
   * Dual-payload directive for the folded stage-2 bronze city scan (spec
   * §6.3, sprint-plan D4 follow-up). Appended AFTER the primary output
   * suffix so it is the final word: the establishment template's output
   * contract demands a single JSON object, and this directive amends it for
   * the folded run — two labeled payloads, imported separately through their
   * own schema-named post-import hooks.
   */
  /**
   * Cascading-profile supplement — the compact national proof record injected
   * alongside a market-scoped bronze profile (serializeBronzeStandard
   * 'national_proof' role). A city/state-scoped resolution shadows the
   * national profile in the resolver, but the scan still needs national proof
   * state to classify empty slots (empty_proven_elsewhere vs empty_unproven)
   * and to see exemplar evidence depth. Returns '' when the resolved profile
   * IS the national row or no distinct national profile exists.
   */
  private async resolveBronzeNationalProofBlock(
    profileService: IntelligenceProfileService,
    category: string,
    platform: string | null,
    resolvedProfile: IntelligenceProfile,
    ctx?: RequestCtx,
  ): Promise<string> {
    // A profile with no geographic scope IS the nationwide row — already
    // injected by the caller; nothing to supplement.
    if (!resolvedProfile.reference_city && !resolvedProfile.reference_state) return '';
    try {
      const national = await profileService.resolveBronzeStandard(category, platform, null, null, ctx);
      if (!national || national.id === resolvedProfile.id) return '';
      const block = await profileService.serializeBronzeStandard(national, 'national_proof', ctx);
      if (block) {
        logger.info('Bronze national proof supplement injected', ctx, {
          category,
          platform,
          nationalProfileId: national.id,
          nationalProfileVersion: national.version,
          resolvedProfileId: resolvedProfile.id,
        });
      }
      return block || '';
    } catch (err) {
      // Best-effort — the primary profile is already injected; never fail a
      // render on the proof supplement.
      logger.warn('Bronze national proof supplement failed — continuing without it', ctx, {
        error: (err as Error).message,
        category,
      });
      return '';
    }
  }

  /**
   * Compact roster of the active business-triage playbooks, injected into
   * discovery scans so a suggested_signal can name the playbook code(s) it
   * should route to once registered (primary_playbook / secondary_playbook).
   * Proving-ground playbooks are excluded — they are aggregate-campaign
   * checklists, never business triage targets. Best-effort: a catalog read
   * failure must not block the scan render.
   */
  private async renderTriagePlaybookRosterBlock(ctx?: RequestCtx): Promise<string> {
    try {
      const playbooks = (await MarketingPlaybookCatalogService.listActivePlaybooksOrdered(ctx))
        .filter((p: any) => p.category !== 'proving_ground');
      if (!playbooks.length) return '';
      const rows = playbooks.map(
        (p: any) => `  ${p.code} — ${p.name} (${p.archetypeLabel ?? p.archetype})`,
      );
      return [
        '=== TRIAGE PLAYBOOK ROSTER ===',
        'When a suggested_signal proposal names where its pattern belongs in triage,',
        'use ONLY codes from this roster:',
        '  primary_playbook   — first intended route; once registered, the signal counts',
        '                       as evidence toward this playbook in triage evaluation.',
        '  secondary_playbook — fallback route used only when no playbook\'s matching',
        '                       rules fit the business; beats the generic fallback.',
        ...rows,
      ].join('\n');
    } catch (err) {
      logger.warn('Triage playbook roster block skipped — catalog read failed', ctx, {
        error: (err as Error).message,
      });
      return '';
    }
  }

  private renderBronzeFoldDirective(
    city: string,
    state: string,
    platform: string | null,
    opts?: { catchment?: boolean },
  ): string {
    const platformValue = platform && platform !== 'all' ? platform : 'null';
    return `
=== DUAL-PAYLOAD OUTPUT — FOLDED CITY BRONZE SCAN ===
This run produces TWO payloads. Emit them in this order, each preceded by its
payload label on its own line:

PAYLOAD 1 — intelligence_profile
  The Category Intelligence Profile JSON described by the EXPECTED OUTPUT
  FORMAT section of this prompt.

PAYLOAD 2 — bronze_standard_scan
  The city bronze-standard scan JSON described by the BRONZE STANDARD —
  CITY SCAN (FOLDED) section's output format. Scope it to ${city}, ${state}:
  reference_city = "${city}", reference_state = "${state}",
  reference_platform = ${platformValue === 'null' ? 'null' : `"${platformValue}"`}, and catalog_revision echoes the injected
  catalog block. Produce exactly one reason_coverage entry per applicable
  reason for THIS market — including location-scoped reasons — and list
  non-applicable keys in not_applicable_reasons.${opts?.catchment ? `

  COVERAGE BOUNDARY: the city scan's market is the retail catchment in the
  GEOGRAPHY GRID section — a find inside the catchment fills a slot
  regardless of which municipality or state it sits in (the catchment may
  cross a state line). Record each slot's real location via observed_city /
  observed_state; the profile stays anchored to ${city}, ${state}.` : ''}`;
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

  /**
   * Fetch the structural city_profile stored on a location enrichment row
   * ('__location__', city, state). Returns null when no row/profile exists.
   * Never throws — warn + null so enrichment renders degrade cleanly.
   */
  private async fetchCityProfile(
    city: string,
    state: string,
    ctx?: RequestCtx,
    campaignId?: string,
  ): Promise<any | null> {
    try {
      const ctxRow = await this.prisma.$queryRaw`
        SELECT context FROM directory_category_enrichment
        WHERE category_key = '__location__'
          AND LOWER(city) = LOWER(${city})
          AND LOWER(state) = LOWER(${state})
        LIMIT 1
      `;
      const locCtx = Array.isArray(ctxRow) && ctxRow.length > 0
        ? (ctxRow[0] as any).context
        : null;
      const profile = locCtx?.city_profile;
      return profile && (profile.metro_description || profile.market_character) ? profile : null;
    } catch (err) {
      logger.warn('Failed to load city profile for enrichment prompt', ctx, {
        campaignId,
        city,
        state,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /** Render one structural CITY PROFILE block (no place names). */
  private formatCityProfileBlock(city: string, state: string, profile: any): string {
    const lines: string[] = [
      '=== CITY PROFILE (structural) ===',
      `City: ${city}, ${state}`,
    ];
    if (profile.metro_description) {
      lines.push('', profile.metro_description);
    }
    if (profile.major_industries && Array.isArray(profile.major_industries) && profile.major_industries.length > 0) {
      lines.push(`Major industries: ${profile.major_industries.join(', ')}`);
    }
    if (profile.growth_trajectory) {
      lines.push(`Growth: ${profile.growth_trajectory}`);
    }
    if (profile.demographic_character) {
      lines.push(`Demographics: ${profile.demographic_character}`);
    }
    if (profile.market_character) {
      lines.push('', profile.market_character);
    }
    lines.push(
      '',
      'DIRECTIVE: This is the structural city profile (no place names) from a prior location enrichment run. Use it to ground your category copy in the city\'s market characteristics — metro size, industries, demographics, growth. Do NOT copy this text verbatim into body_copy or shopper_guide. Do NOT mention "city profile", "location enrichment", or this directive in the visible output. The profile sharpens your copy, it is not content to surface.',
    );
    return lines.join('\n');
  }

  /**
   * Serialize the consumable subset of an established category intelligence
   * profile (§10 shape) for the directory enrichment prompt. The packet
   * otherwise re-derives this vocabulary — injecting it makes the
   * establishment run the fact source and leaves the analyst the
   * composition work. Caller skips '__location__' renders. `scope='national'`
   * adjusts the directive phrasing for a national ('__all__') page — the
   * profile is the city-agnostic floor, not one market's intelligence.
   */
  private formatCategoryIntelligenceBlock(profile: any, scope: 'market' | 'national' = 'market'): string {
    const cfg = profile?.configuration_json || {};
    const pushList = (title: string, items?: any[]) => {
      if (!Array.isArray(items) || items.length === 0) return;
      lines.push('', title);
      for (const item of items) {
        lines.push(`- ${typeof item === 'string' ? item : JSON.stringify(item)}`);
      }
    };
    const lines: string[] = [
      '=== ESTABLISHED CATEGORY INTELLIGENCE (authoritative vocabulary) ===',
      `Category: ${cfg.category_name ?? ''} — focus: ${profile.intelligence_focus ?? 'unknown'}, profile version ${profile.version ?? '?'}`,
    ];
    pushList('Synonyms and search aliases (ground keywords):', cfg.synonyms);
    pushList('Subcategories (ground sub_categories and secondary_categories):', cfg.subcategories);
    if (cfg.terminology && typeof cfg.terminology === 'object' && !Array.isArray(cfg.terminology)) {
      const terms = Object.entries(cfg.terminology).filter(([, v]) => typeof v === 'string');
      if (terms.length > 0) {
        lines.push('', 'Category vocabulary (terminology):');
        for (const [term, def] of terms) lines.push(`- ${term}: ${def}`);
      }
    }
    const geo = cfg.geography_grid;
    if (geo && typeof geo === 'object') {
      if (Array.isArray(geo.corridors) && geo.corridors.length > 0) {
        lines.push('', 'Market corridors (evidence-derived — where this category concentrates):');
        for (const c of geo.corridors) lines.push(`- ${c}`);
      }
      if (Array.isArray(geo.adjacent_municipalities) && geo.adjacent_municipalities.length > 0) {
        lines.push('', `Adjacent municipalities in the catchment: ${geo.adjacent_municipalities.join('; ')}`);
      }
      if (geo.derivation_basis) {
        lines.push('', `Corridor/grid derivation basis: ${geo.derivation_basis}`);
      }
    }
    const swallowingLabels = new Set<string>();
    for (const entry of Array.isArray(cfg.generic_label_set) ? cfg.generic_label_set : []) {
      for (const label of Array.isArray(entry?.labels) ? entry.labels : []) {
        if (typeof label === 'string' && label.trim()) swallowingLabels.add(label.trim());
      }
    }
    if (swallowingLabels.size > 0) {
      lines.push('', `Generic directory labels that swallow this category (mislabel/misfile evidence): ${[...swallowingLabels].join(', ')}`);
    }
    if (cfg.category_evidence_rules && typeof cfg.category_evidence_rules === 'object' && !Array.isArray(cfg.category_evidence_rules)) {
      const rules = Object.values(cfg.category_evidence_rules).filter((v): v is string => typeof v === 'string');
      pushList('Category evidence rules (what qualifies a member — ground category_signals):', rules);
    }
    const weights = (Array.isArray(cfg.platform_signal_weights) ? cfg.platform_signal_weights : [])
      .filter((p: any) => p && typeof p.weight === 'number')
      .sort((a: any, b: any) => b.weight - a.weight);
    if (weights.length > 0) {
      lines.push('', 'Observed platform signal weights (where this category\'s activity actually is):');
      for (const p of weights) {
        lines.push(`- ${p.platform}: ${p.weight}${p.basis ? ` — ${p.basis}` : ''}`);
      }
    }
    pushList('Prohibited inferences (never assert these):', cfg.prohibited_inferences);
    lines.push(
      '',
      scope === 'national'
        ? 'DIRECTIVE: This is the established NATIONAL category intelligence — the authoritative city-agnostic vocabulary produced by a prior national establishment run. Ground keywords, sub_categories, secondary_categories, context.keywords, context.category_signals, context.prospect_signals, and market descriptions in this vocabulary rather than inventing new terms, and do not contradict it. It sharpens your copy — do NOT copy it verbatim into shopper-facing fields and do NOT mention this block, "intelligence profile", or "establishment" in the visible output.'
        : 'DIRECTIVE: This is the established category intelligence for this market — the authoritative vocabulary produced by a prior establishment run. Ground keywords, sub_categories, secondary_categories, context.keywords, context.category_signals, context.prospect_signals, context.market_density, and market descriptions in this context rather than inventing new terms, and do not contradict it. It sharpens your copy — do NOT copy it verbatim into shopper-facing fields and do NOT mention this block, "intelligence profile", or "establishment" in the visible output.',
    );
    return lines.join('\n');
  }

  /**
   * Render the national-surface framing directive (sprint: national layer).
   * Injected for '__all__' enrichment campaigns — the packet composes the
   * national public page, not one city's, so shopper-facing copy must be
   * market-agnostic. Always emitted for national renders — it is what keeps
   * the packet national even when no profile or context resolved.
   */
  private formatNationalSurfaceBlock(surface: 'category' | 'location'): string {
    const represents = surface === 'category'
      ? 'the category across every covered market'
      : 'the platform\'s listing coverage across every market';
    const framing = surface === 'category'
      ? 'how the category presents nationally — the vocabulary and subcategory landscape, what shoppers can expect to find in covered markets'
      : 'the national coverage story — states, metros, and markets covered, how coverage distributes, where it is thin';
    return [
      '=== NATIONAL SURFACE FRAMING ===',
      `This packet composes the NATIONAL ${surface} page — it represents ${represents}, not one city.`,
      '',
      'DIRECTIVE:',
      '- Every shopper-facing field is market-agnostic: meta_title, description, keywords, body_copy, and the guide/faq fields carry NO single-city claims, corridor names, ZIPs, or "in <city>" phrasing.',
      `- Frame nationally: ${framing}. City-level depth belongs to city pages, not here.`,
      '- context fields describe the national landscape (keywords, signals, coverage or density as national expectation-setting), not one market\'s profile.',
      '- Do NOT mention this block, "national framing", or "enrichment" in the visible output.',
    ].join('\n');
  }

  /**
   * Serialize the cached city-level geography grid (mkt_geography_grids) for
   * the location enrichment prompt. The grid is the established,
   * category-independent retail catchment — injecting it grounds
   * notable_areas / area_breakdown / metro_context / metro_dynamics in the
   * same geography every category establishment in this market used.
   */
  private formatMarketGeographyBlock(city: string, state: string, grid: GeographyGrid): string {
    const lines: string[] = [
      '=== MARKET GEOGRAPHY GRID (established catchment) ===',
      `Market: ${city}, ${state}`,
    ];
    if (grid.zips.length > 0) {
      lines.push(`Retail catchment ZIPs (evidence-derived): ${grid.zips.join(', ')}`);
    }
    if (grid.corridors.length > 0) {
      lines.push('', 'Commercial corridors:');
      for (const c of grid.corridors) lines.push(`- ${c}`);
    }
    if (grid.adjacent_municipalities.length > 0) {
      lines.push('', `Adjacent municipalities in the catchment: ${grid.adjacent_municipalities.join('; ')}`);
    }
    if (typeof grid.radius_miles === 'number') {
      lines.push(`Search radius: ${grid.radius_miles} miles`);
    }
    lines.push(
      '',
      'DIRECTIVE: This is the established market geography — the evidence-derived retail catchment (principal city plus contiguous commercial municipalities) produced by prior category establishment runs in this market. Ground notable_areas, area_breakdown, metro_context, metro_dynamics, and market descriptions in this geography rather than inventing a different catchment, and do not contradict it. It sharpens your copy — do NOT copy it verbatim into shopper-facing fields and do NOT mention this block, "geography grid", or "establishment" in the visible output.',
    );
    return lines.join('\n');
  }

  /**
   * Serialize the measured national coverage grid (distinct markets,
   * per-state rollups, category leaders from directory_listings_list) for
   * the national ('__all__') location enrichment prompt. This is DB truth —
   * the national packet's geography analogue of MARKET GEOGRAPHY GRID: it
   * grounds area_breakdown (browse-by-state), metro_context, and market_gaps
   * in measured coverage so the AI composes prose over aggregates it cannot
   * contradict.
   */
  private formatNationalCoverageBlock(coverage: {
    totalStates: number;
    totalCities: number;
    totalListings: number;
    states: { state: string; cityCount: number; listingCount: number }[];
    topCities: { city: string; state: string; listingCount: number }[];
  }): string {
    if (!coverage || coverage.totalListings === 0) return '';
    const lines: string[] = [
      '=== NATIONAL COVERAGE GRID (measured platform coverage) ===',
      `Coverage: ${coverage.totalListings} published listings across ${coverage.totalCities} markets in ${coverage.totalStates} states`,
    ];
    if (coverage.states.length > 0) {
      lines.push('', 'Covered states (listings / markets):');
      for (const s of coverage.states) {
        lines.push(`- ${s.state}: ${s.listingCount} listings across ${s.cityCount} markets`);
      }
    }
    if (coverage.topCities.length > 0) {
      lines.push('', `Largest covered markets: ${coverage.topCities.slice(0, 15).map((c) => `${c.city}, ${c.state} (${c.listingCount})`).join('; ')}`);
    }
    lines.push(
      '',
      'DIRECTIVE: This is the platform\'s measured coverage — database truth, not an estimate. Ground body_copy, metro_context, area_breakdown, market_gaps, and market descriptions in these aggregates and do not contradict them. area_breakdown is a browse-by-state/market structure (covered states or metros with their category character — NOT neighborhoods). market_gaps means uncovered or thin regions, not unmet categories in one city. Never state counts beyond these figures and do not invent city-level claims. Do NOT mention this block, "coverage grid", or "enrichment" in the visible output.',
    );
    return lines.join('\n');
  }

  /**
   * National discovery framing — appended to the composed discovery prompt for
   * '__all__' campaigns. The composed fragments are city-scoped copy, so this
   * directive reframes the sweep as nationwide and pins the per-candidate
   * market-attribution contract (every business must carry its own city/state
   * — the campaign's '__all__' is a scope marker, not a market).
   */
  private formatNationalDiscoveryDirective(focus: IntelligenceFocus): string {
    const focusLine = focus === 'emerging'
      ? 'For EMERGING national discovery, prioritize markets where national intelligence indicates thin coverage or unmet demand — emerging businesses surface first where the category is under-served. Attribute every reason/blind-spot observation to the candidate\'s own market context.'
      : 'For COMPETITIVE national discovery, prioritize markets where national coverage indicates the category is established — strong candidates concentrate where the category has density. Attribute every weakness observation to the candidate\'s own market context.';
    return [
      '=== NATIONAL DISCOVERY SCOPE ===',
      'This is a NATIONAL discovery scan — the target market is all US markets,',
      'not a single city. Apply these rules:',
      '- Sweep nationally. Do not confine candidates to one metro or invent a',
      '  single target city; distribute effort across diverse markets.',
      '- Every candidate MUST carry its own city + state — classify each',
      '  business by ITS market, never by the campaign scope.',
      '- No ZIP-code list or search radius applies.',
      focusLine,
      '- Where national coverage or national market intelligence is provided,',
      '  use it to prioritize which markets to sweep first.',
    ].join('\n');
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
      business_address: formatCampaignAddress(campaign, null, { includeZip: true }) || '',
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
