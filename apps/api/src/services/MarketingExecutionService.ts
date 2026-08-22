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
        const goldStandard = await profileService.resolveGoldStandard(category, ctx);
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
          return {
            renderedPrompt: this.appendPromptSuffix(baseRendered + warning, promptSuffix),
            resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
          };
        }
        const discoveryBlock = profileService.serializeGoldStandard(goldStandard, 'discovery');
        if (!discoveryBlock) {
          return {
            renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix),
            resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
          };
        }
        const amplified = baseRendered + '\n' + discoveryBlock;
        logger.info('Gold standard discovery profile injected', ctx, {
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
      // Establishment kind — fall through to the base render (the template
      // body instructs the analyst to derive expected_fields from scratch).
    }

    if (isSeek && campaignScope === 'intelligence' && hasCategory && !isProfileEstablishment && !isGoldStandardFocus) {
      const composer = PromptComposerService.getInstance();
      const focus = (input.campaign.intelligence_focus || 'emerging') as IntelligenceFocus;
      // Pass the campaign's city so the composer resolves a city-scoped
      // profile (Migration 205) and emits a city retargeting directive
      // when the resolved profile's reference city differs.
      const city = input.campaign.city || null;
      const composed = await composer.composeIntelligencePrompt({ category, focus, city }, ctx);

      // Apply variable substitution on the composed body (zip_codes, radius, etc.)
      // Also strip any unresolved {{#if}}...{{/if}} Handlebars-style conditionals
      // since renderTemplate() only supports simple {{variable}} replacement.
      const cleanedBody = this.stripHandlebarsConditionals(composed.body, input.variables);
      const rendered = this.renderTemplate(cleanedBody, input.variables, input.campaign);

      logger.info('Intelligence-scope prompt composed', ctx, {
        campaignId: input.campaign.id,
        category,
        focus,
        profileId: composed.resolution.profile_id,
        intelligenceMode: composed.resolution.intelligence_mode,
      });

      return {
        renderedPrompt: this.appendPromptSuffix(rendered, promptSuffix),
        resolution: composed.resolution,
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
      const focusBlock = this.renderEstablishmentFocusBlock(focus);
      const withFocus = focusBlock ? baseRendered + '\n' + focusBlock : baseRendered;

      logger.info('Intelligence Profile Establishment prompt resolved with focus', ctx, {
        campaignId: input.campaign.id,
        category,
        focus,
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
      const goldStandard = await profileService.resolveGoldStandard(category, ctx);
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

      const profile = await profileService.resolve(category, undefined, businessCity, ctx);
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
      const goldStandard = await profileService.resolveGoldStandard(category, ctx);
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
    const profile = await profileService.resolve(category, undefined, businessCity, ctx);

    if (!profile) {
      // No active intelligence profile — but there may still be a gold
      // standard benchmark to inject. Check for it before returning the
      // base render. This ensures the audit gets the gold-standard
      // comparison even when no category intelligence profile exists.
      const goldStandardOnly = await profileService.resolveGoldStandard(category, ctx);
      if (goldStandardOnly) {
        const gsBlock = profileService.serializeGoldStandard(goldStandardOnly, 'benchmark');
        if (gsBlock) {
          const gsAmplified = baseRendered + '\n' + gsBlock;
          logger.info('Gold standard benchmark injected (no intelligence profile)', ctx, {
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
      // No active profile and no gold standard — return byte-identical base render (plus suffix).
      return {
        renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix),
        resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
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
    const goldStandard = await profileService.resolveGoldStandard(category, ctx);
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

    logger.info('Profile-aware prompt resolved (§1B)', ctx, {
      campaignId: input.campaign.id,
      category,
      city: businessCity ?? 'none',
      profileId: profile.id,
      profileVersion: profile.version,
      profileReferenceCity: (profile as any).reference_city ?? null,
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
   * Render the intelligence-focus context block appended to the Intelligence
   * Profile Establishment prompt. The establishment template produces a
   * category-agnostic §10 profile, but the campaign is coupled to an
   * intelligence type (emerging or competitive). This block instructs the AI
   * to bias the profile toward the campaign's focus so the downstream
   * Intelligence-scope seek (which loads this profile via the composer) is
   * tuned for the right discovery posture.
   *
   * Returns an empty string for an unrecognized focus value (defensive — the
   * campaign column defaults to 'emerging' and is constrained to the
   * IntelligenceFocus union, but we never want to corrupt the establishment
   * prompt with a malformed focus label).
   */
  private renderEstablishmentFocusBlock(focus: IntelligenceFocus): string {
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
