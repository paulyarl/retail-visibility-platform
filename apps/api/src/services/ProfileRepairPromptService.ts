/**
 * Profile Repair Prompt Service
 *
 * Dedicated variable-builder, execution, and import service for Profile Repair
 * prompt templates (triage seek, per-issue seek, citation-package fulfill,
 * and Track B reinstatement appeal resolution).
 *
 * Sibling of RecoveryResolutionService.
 * Spec: docs/LocalBiz/marketing_ops_prompt_variable_injection_sprint_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { MarketingPromptService } from './MarketingPromptService';
import { MarketingExecutionService } from './MarketingExecutionService';
import MarketingCampaignService from './MarketingCampaignService';
import { extractSignals } from './triage/signal-extractor';
import { type SignalCode } from './triage/signal-taxonomy';
import aiProviderFactory from './ai-providers';
import { generateDeliverableId, generateDeliverableSectionId } from '../lib/id-generator';
import {
  resolveOutputSchema,
  profileRepairTriageSchema,
  type ProfileRepairTriageOutput,
} from '../validators/market-analysis.schema';

// Template ID constants
export const PROFILE_REPAIR_TRIAGE_TEMPLATE_ID = 'mpt-profile-repair-triage-default';
export const PROFILE_REPAIR_NAP_DRIFT_TEMPLATE_ID = 'mpt-profile-repair-nap-drift-seek';
export const PROFILE_REPAIR_UNCLAIMED_TEMPLATE_ID = 'mpt-profile-repair-unclaimed-seek';
export const PROFILE_REPAIR_PLATFORM_GAP_TEMPLATE_ID = 'mpt-profile-repair-platform-gap-seek';
export const PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID = 'mpt-profile-repair-citation-package-fulfill';
export const PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID = 'mpt-profile-repair-resolution-default';

// Signal Code -> Triage Vocabulary mapping table
const SIGNAL_TO_TRIAGE_VOCAB: Record<string, string> = {
  DS_PROFILE_SUSPENDED: 'suspension',
  DS_DUPLICATE_LISTING: 'duplicate_listing',
  DS_HIJACKED_LISTING: 'hijacked_listing',
  DS_OWNERSHIP_DISPUTE: 'ownership_dispute',
  DS_ADDRESS_VERIFICATION_BLOCK: 'address_verification_block',
  CP_NAP_NAME_DRIFT: 'nap_drift',
  CP_NAP_ADDRESS_DRIFT: 'nap_drift',
  CP_NAP_PHONE_DRIFT: 'nap_drift',
  CP_MISSING_CONTACT_INFO: 'nap_drift',
  CP_NAP_INCONSISTENCY: 'nap_drift',
  CP_NAP_INCONSISTENT: 'nap_drift',
  DS_CLAIMED_STATUS: 'unclaimed_profile',
  DS_UNCLAIMED_PROFILE: 'unclaimed_profile',
  DS_MISSING_SERVICE_MENU: 'missing_category',
  DS_MISSING_PRODUCT_CATALOG: 'missing_category',
  DS_MISSING_CATEGORY: 'missing_category',
  DS_OUTDATED_HOURS: 'missing_hours',
  DS_OUTDATED_HOLIDAY_HOURS: 'missing_hours',
  DS_MISSING_HOURS: 'missing_hours',
  DS_MISSING_PROFILE: 'platform_gap',
  DS_PLATFORM_GAP: 'platform_gap',
  DS_BROKEN_PROFILE_LINK: 'platform_gap',
  WC_URL_MISMATCH: 'platform_gap',
  WC_BROKEN_WEBSITE: 'platform_gap',
  WC_MISSING_WEBSITE: 'platform_gap',
  VP_MISSING_STOREFRONT_PHOTOS: 'platform_gap',
};

export class ProfileRepairPromptService extends BaseService {
  private static instance: ProfileRepairPromptService;

  private constructor() {
    super();
  }

  static getInstance(): ProfileRepairPromptService {
    if (!ProfileRepairPromptService.instance) {
      ProfileRepairPromptService.instance = new ProfileRepairPromptService();
    }
    return ProfileRepairPromptService.instance;
  }

  // ==========================================================================
  // Template Resolution Helper
  // ==========================================================================

  /**
   * Code-side track resolution — the deterministic floor for the AI's
   * recommended_track. The AI may escalate above this (e.g., flag a
   * nap_drift case as escalated due to context), but never de-escalate
   * below it (e.g., a suspension signal always forces escalated).
   *
   * Used in executeSeekSync to validate the AI's track output.
   */
  resolveTrackFromSignals(signals: SignalCode[] | string[]): 'standard' | 'escalated' {
    const ESCALATION_VOCAB = new Set([
      'suspension',
      'hijacked_listing',
      'duplicate_listing',
      'ownership_dispute',
      'address_verification_block',
    ]);
    for (const sig of signals) {
      const vocab = SIGNAL_TO_TRIAGE_VOCAB[sig];
      if (vocab && ESCALATION_VOCAB.has(vocab)) return 'escalated';
    }
    return 'standard';
  }

  resolveSeekTemplateId(issueType: string | null | undefined): string {
    if (!issueType) return PROFILE_REPAIR_TRIAGE_TEMPLATE_ID;
    const normalized = issueType.toLowerCase().trim();
    switch (normalized) {
      case 'nap_drift':
        return PROFILE_REPAIR_NAP_DRIFT_TEMPLATE_ID;
      case 'unclaimed_profile':
        return PROFILE_REPAIR_UNCLAIMED_TEMPLATE_ID;
      case 'platform_gap':
        return PROFILE_REPAIR_PLATFORM_GAP_TEMPLATE_ID;
      default:
        return PROFILE_REPAIR_TRIAGE_TEMPLATE_ID;
    }
  }

  // ==========================================================================
  // Variable Serializers & Builders
  // ==========================================================================

  serializeSignals(signals: SignalCode[] | string[]): string {
    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return '';
    }

    const triageTerms = new Set<string>();
    for (const sig of signals) {
      const vocab = SIGNAL_TO_TRIAGE_VOCAB[sig];
      if (vocab) {
        triageTerms.add(vocab);
      }
    }

    return Array.from(triageTerms).join('\n');
  }

  serializeAuditResults(auditData: any): string {
    if (!auditData || typeof auditData !== 'object') {
      return '';
    }

    const lines: string[] = [];

    // 1. Canonical NAP
    const nap = auditData.nap_consistency;
    if (nap) {
      lines.push('## Canonical NAP');
      lines.push(`- Name: ${nap.canonical_name ?? 'Not verified'}`);
      lines.push(`- Address: ${nap.canonical_address ?? 'Not verified'}`);
      lines.push(`- Phone: ${nap.canonical_phone ?? 'Not verified'}`);
      if (Array.isArray(nap.material_issues) && nap.material_issues.length > 0) {
        lines.push(`- Material issues: ${nap.material_issues.join(', ')}`);
      }
      lines.push('');
    }

    // 2. Platform Status
    const platforms = auditData.platforms;
    if (platforms && typeof platforms === 'object') {
      lines.push('## Platform Status');
      for (const [name, p] of Object.entries(platforms) as [string, any][]) {
        if (p && typeof p === 'object') {
          const status = p.profile_status ?? 'unavailable';
          const nameSuffix = p.displayed_name ? ` (${p.displayed_name})` : '';
          lines.push(`- ${name}: ${status}${nameSuffix}`);
        }
      }
      lines.push('');
    }

    // 3. Website
    const web = auditData.website;
    if (web && typeof web === 'object') {
      lines.push('## Website');
      lines.push(`- Status: ${web.status ?? 'unavailable'}`);
      if (Array.isArray(web.issues) && web.issues.length > 0) {
        lines.push(`- Issues: ${web.issues.join(', ')}`);
      }
      lines.push('');
    }

    // 4. Detected signals
    const signals = auditData.detected_signals;
    if (Array.isArray(signals) && signals.length > 0) {
      lines.push('## Detected Signals');
      for (const s of signals) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  buildSeekVariables(campaign: any, latestAudit?: any): Record<string, string> {
    const audit = latestAudit || campaign?.audits?.[0] || campaign?.mkt_audits_list?.[0] || null;
    const signalCodes = extractSignals({
      campaign,
      auditData: audit?.audit_data,
    });

    // Also include any pre-extracted detected_signals from campaign or triage results
    const storedSignals = campaign?.mkt_campaign_triage_results?.detected_signals || campaign?.detected_signals;
    if (Array.isArray(storedSignals)) {
      for (const s of storedSignals) {
        const code = typeof s === 'string' ? s : (s as any)?.code;
        if (code && !signalCodes.includes(code)) {
          signalCodes.push(code);
        }
      }
    }

    const serialized = this.serializeSignals(signalCodes);

    // Triage template now uses audit_results as a primary input for scope
    // assessment (which platforms are broken, what's drifted, what's missing).
    // Previously only injected for fulfill; triage needs it too so the AI can
    // produce an evidence-grounded operator briefing instead of rubber-stamping
    // the signal→track mapping.
    const auditResults = this.serializeAuditResults(audit?.audit_data ?? {});

    return {
      audit_signals: serialized,
      issue_type: campaign?.repair_issue_type || '',
      audit_results: auditResults,
    };
  }

  buildFulfillVariables(campaign: any, latestAudit: any): Record<string, string> {
    return {
      audit_results: this.serializeAuditResults(latestAudit?.audit_data ?? {}),
    };
  }

  buildResolutionVariables(campaign: any, intake: any): Record<string, any> {
    const intakePayload = JSON.stringify({
      ownerStatement: intake?.owner_statement ?? '',
      proposedResolution: intake?.proposed_resolution ?? '',
    });

    const evidencePayload = JSON.stringify(intake?.evidence_payload ?? {});

    const attachmentMeta = JSON.stringify(
      (intake?.mkt_dispute_attachments ?? []).map((a: any) => ({
        fileName: a.file_name,
        fileType: a.file_type,
      })),
    );

    return {
      issueType: campaign?.repair_issue_type || '',
      intakePayload,
      evidencePayload,
      attachmentMeta,
      intakeId: intake?.id,
    };
  }

  // ==========================================================================
  // Seek Execution (Synchronous Triage Flow)
  // ==========================================================================

  async executeSeekSync(
    campaignId: string,
    templateId?: string,
    ctx?: RequestCtx,
  ): Promise<{
    executionId: string;
    recommendation: ProfileRepairTriageOutput['profile_repair_triage'] | null;
  }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_audits_list: { take: 1, orderBy: { created_at: 'desc' } },
        },
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const latestAudit = campaign.mkt_audits_list?.[0] ?? null;
      const targetTemplateId = templateId || this.resolveSeekTemplateId(campaign.repair_issue_type);
      const seekVars = this.buildSeekVariables(campaign, latestAudit);

      const execution = await MarketingExecutionService.getInstance().executeSingle(
        {
          campaignId,
          templateId: targetTemplateId,
          variables: seekVars,
          executedBy: ctx?.userId || 'operator',
        },
        ctx,
      );

      let recommendation: ProfileRepairTriageOutput['profile_repair_triage'] | null = null;
      let validatedSuccess = false;

      if (targetTemplateId === PROFILE_REPAIR_TRIAGE_TEMPLATE_ID && execution.raw_output) {
        try {
          const cleaned = this.stripJsonArtifacts(execution.raw_output);
          const parsed = JSON.parse(cleaned);
          const validated = profileRepairTriageSchema.safeParse(parsed);
          validatedSuccess = validated.success;
          if (validated.success) {
            recommendation = validated.data.profile_repair_triage;
          } else {
            logger.warn('Triage AI output did not strictly match schema', ctx, {
              errors: validated.error.format(),
              executionId: execution.id,
            });
            // Best-effort extraction if top-level structure is present
            if (parsed?.profile_repair_triage) {
              recommendation = parsed.profile_repair_triage;
            }
          }

          // Code-side track floor: the AI may escalate above the signal-derived
          // track, but never de-escalate below it. If the AI recommends
          // 'standard' when signals say 'escalated', force 'escalated'.
          if (recommendation) {
            const signalCodes = extractSignals({
              campaign,
              auditData: latestAudit?.audit_data as any,
            });
            const floorTrack = this.resolveTrackFromSignals(signalCodes);
            if (floorTrack === 'escalated' && recommendation.recommended_track === 'standard') {
              logger.warn('Triage AI de-escalated below signal floor; forcing escalated', ctx, {
                campaignId,
                aiTrack: recommendation.recommended_track,
                floorTrack,
              });
              recommendation.recommended_track = 'escalated';
            }

            // Persist the briefing on the campaign row with provenance metadata.
            // No write on AI failure (recommendation is null → skip). Flag
            // best-effort output with _validated: false so the UI can badge it.
            await this.prisma.mkt_campaigns_list.update({
              where: { id: campaignId },
              data: {
                repair_triage_briefing: {
                  ...recommendation,
                  _execution_id: execution.id,
                  _validated: validatedSuccess,
                } as any,
              },
            });
          }
        } catch (parseErr) {
          logger.error('Failed to parse triage JSON output', ctx, {
            error: (parseErr as Error).message,
            executionId: execution.id,
          });
        }
      }

      logger.info('Profile repair seek execution completed synchronously', ctx, {
        campaignId,
        templateId: targetTemplateId,
        executionId: execution.id,
        hasRecommendation: Boolean(recommendation),
      });

      return {
        executionId: execution.id,
        recommendation,
      };
    } catch (error) {
      logger.error('Failed to execute profile repair seek', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ==========================================================================
  // Track B Resolution (Async Enqueue & Scheduler Runner)
  // ==========================================================================

  async enqueueResolution(campaignId: string, intakeId: string, ctx?: RequestCtx): Promise<{ executionId: string; campaignId: string }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_dispute_intake: {
            where: { id: intakeId },
            include: { mkt_dispute_attachments: true },
          },
        },
      });

      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const intake = campaign.mkt_dispute_intake?.[0];
      if (!intake) throw new Error(`Dispute intake ${intakeId} not found for campaign ${campaignId}`);

      const variablesUsed = this.buildResolutionVariables(campaign, intake);

      const execution = await MarketingPromptService.getInstance().createExecution(
        {
          campaignId,
          templateId: PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID,
          variablesUsed,
          executedBy: ctx?.userId || 'repair-agent',
        },
        ctx,
      );

      logger.info('Profile repair resolution execution enqueued', ctx, {
        executionId: execution.id,
        campaignId,
        intakeId,
      });

      return { executionId: execution.id, campaignId };
    } catch (error) {
      logger.error('Failed to enqueue profile repair resolution', ctx, {
        error: (error as Error).message,
        campaignId,
        intakeId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async runResolution(executionId: string, ctx?: RequestCtx): Promise<{
    executionId: string;
    campaignId: string;
    deliverableId: string;
    stage: string;
    passed: boolean;
  }> {
    try {
      const promptService = MarketingPromptService.getInstance();
      const execution = await promptService.getExecution(executionId, ctx);
      if (!execution) throw new Error(`Execution ${executionId} not found`);

      if (execution.status !== 'pending') {
        logger.info('Profile repair execution already processed, skipping', ctx, {
          executionId,
          status: execution.status,
        });
        return {
          executionId,
          campaignId: execution.campaign_id,
          deliverableId: '',
          stage: '',
          passed: false,
        };
      }

      const campaignId = execution.campaign_id;
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_dispute_intake: {
            where: { intake_kind: 'profile_repair' },
            include: { mkt_dispute_attachments: true },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
      const intake = campaign.mkt_dispute_intake?.[0];
      if (!intake) throw new Error(`Profile repair intake not found for campaign ${campaignId}`);

      const template = execution.mkt_prompt_templates_list;
      if (!template) throw new Error(`Template not found for execution ${executionId}`);

      const variables = this.buildResolutionVariables(campaign, intake);
      const executionService = MarketingExecutionService.getInstance();
      const { renderedPrompt } = await executionService.resolvePrompt(
        { template, campaign, variables },
        ctx,
      );

      const aiResult = await aiProviderFactory.generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are the Profile Repair Resolution Agent. Produce valid JSON matching the schema.' },
          { role: 'user', content: renderedPrompt },
        ],
        maxTokens: 2500,
        temperature: 0.3,
      });

      const tokensUsed = aiResult.usage?.totalTokens || 0;
      const costCents = Math.round((tokensUsed / 1000) * 0.2);

      await promptService.updateExecution(
        executionId,
        {
          rawOutput: aiResult.content,
          aiProvider: aiResult.model.split('-')[0] || 'unknown',
          aiModel: aiResult.model,
          tokensUsed,
          costCents,
          status: 'completed',
        },
        ctx,
      );

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(this.stripJsonArtifacts(aiResult.content));
      } catch (e) {
        await promptService.updateExecution(executionId, {
          status: 'failed',
          flaggedCount: 1,
        }, ctx);
        throw new Error(`AI output was not valid JSON: ${(e as Error).message}`);
      }

      // Create deliverable of type reinstatement_appeal + sections
      const deliverableId = generateDeliverableId();

      await this.prisma.mkt_deliverables_list.create({
        data: {
          id: deliverableId,
          campaign_id: campaignId,
          execution_id: executionId,
          template_id: null,
          deliverable_type: 'reinstatement_appeal',
          status: 'drafted',
          file_name: `reinstatement-appeal-${campaignId}.json`,
          storage_path: `recovery/${campaignId}/${deliverableId}.json`,
          mime_type: 'application/json',
          generated_by: 'profile-repair-agent',
        },
      });

      await this.prisma.mkt_deliverable_section.createMany({
        data: [
          {
            id: generateDeliverableSectionId(),
            deliverable_id: deliverableId,
            campaign_id: campaignId,
            section_type: 'response_draft',
            title: 'Reinstatement Appeal Letter',
            content: parsedJson.deliverableText,
            source: 'ai',
            quality_gate_passed: true,
            quality_gate_issues: [],
            status: 'draft',
            section_index: 0,
          },
          {
            id: generateDeliverableSectionId(),
            deliverable_id: deliverableId,
            campaign_id: campaignId,
            section_type: 'submission_guide',
            title: 'Submission Guide',
            content: parsedJson.submissionGuide,
            source: 'ai',
            quality_gate_passed: true,
            quality_gate_issues: [],
            status: 'draft',
            section_index: 1,
          },
        ],
      });

      // Transition campaign stage to final_resolution_drafted
      await MarketingCampaignService.transitionStage(
        {
          campaignId,
          toStage: 'final_resolution_drafted',
          triggerType: 'system',
          notes: 'Profile Repair AI Agent drafted reinstatement appeal package',
        },
        ctx,
      );

      logger.info('Profile repair resolution run completed', ctx, {
        executionId,
        campaignId,
        deliverableId,
      });

      return {
        executionId,
        campaignId,
        deliverableId,
        stage: 'final_resolution_drafted',
        passed: true,
      };
    } catch (error) {
      logger.error('Failed to run profile repair resolution', ctx, {
        error: (error as Error).message,
        executionId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ==========================================================================
  // Copy-Paste Bridge & External Import
  // ==========================================================================

  async renderPromptText(
    campaignId: string,
    templateId: string,
    ctx?: RequestCtx,
  ): Promise<{
    renderedPrompt: string;
    templateId: string;
    variablesUsed: Record<string, any>;
  }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_audits_list: { take: 1, orderBy: { created_at: 'desc' } },
          mkt_dispute_intake: {
            where: { intake_kind: 'profile_repair' },
            include: { mkt_dispute_attachments: true },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const promptService = MarketingPromptService.getInstance();
      const template = await promptService.getTemplate(templateId, ctx);
      if (!template) throw new Error(`Template ${templateId} not found`);

      const latestAudit = campaign.mkt_audits_list?.[0] ?? null;
      const intake = campaign.mkt_dispute_intake?.[0] ?? null;

      let variablesUsed: Record<string, any> = {};
      if (template.prompt_type === 'recovery_resolution' || templateId === PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID) {
        variablesUsed = this.buildResolutionVariables(campaign, intake);
      } else if (template.prompt_type === 'fulfill' || templateId === PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID) {
        variablesUsed = this.buildFulfillVariables(campaign, latestAudit);
      } else {
        variablesUsed = this.buildSeekVariables(campaign, latestAudit);
      }

      const executionService = MarketingExecutionService.getInstance();
      const { renderedPrompt } = await executionService.resolvePrompt(
        { template, campaign, variables: variablesUsed },
        ctx,
      );

      return {
        renderedPrompt,
        templateId,
        variablesUsed,
      };
    } catch (error) {
      logger.error('Failed to render profile repair prompt text', ctx, {
        error: (error as Error).message,
        campaignId,
        templateId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async importExternalResult(
    campaignId: string,
    templateId: string,
    rawOutput: string,
    ctx?: RequestCtx,
  ): Promise<{
    executionId: string;
    passed: boolean;
    deliverableId?: string;
    errors?: string[];
  }> {
    try {
      const promptService = MarketingPromptService.getInstance();
      const template = await promptService.getTemplate(templateId, ctx);
      if (!template) throw new Error(`Template ${templateId} not found`);

      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_audits_list: { take: 1, orderBy: { created_at: 'desc' } },
          mkt_dispute_intake: {
            where: { intake_kind: 'profile_repair' },
            include: { mkt_dispute_attachments: true },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const latestAudit = campaign.mkt_audits_list?.[0] ?? null;
      const intake = campaign.mkt_dispute_intake?.[0] ?? null;

      let variablesUsed: Record<string, any> = {};
      if (template.prompt_type === 'recovery_resolution' || templateId === PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID) {
        variablesUsed = this.buildResolutionVariables(campaign, intake);
      } else if (template.prompt_type === 'fulfill' || templateId === PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID) {
        variablesUsed = this.buildFulfillVariables(campaign, latestAudit);
      } else {
        variablesUsed = this.buildSeekVariables(campaign, latestAudit);
      }

      const execution = await promptService.createExecution(
        {
          campaignId,
          templateId,
          variablesUsed,
          executedBy: ctx?.userId || 'operator-external',
        },
        ctx,
      );

      // Parse & validate JSON
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(this.stripJsonArtifacts(rawOutput));
      } catch (e) {
        await promptService.updateExecution(
          execution.id,
          { rawOutput, status: 'failed', flaggedCount: 1 },
          ctx,
        );
        return {
          executionId: execution.id,
          passed: false,
          errors: [`Output is not valid JSON: ${(e as Error).message}`],
        };
      }

      const schemaName = template.output_schema?.name || template.outputSchema?.name;
      const schemaEntry = resolveOutputSchema(schemaName);

      if (schemaEntry) {
        const validation = schemaEntry.validator.safeParse(parsedJson);
        if (!validation.success) {
          const errors = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
          await promptService.updateExecution(
            execution.id,
            { rawOutput, status: 'failed', flaggedCount: 1 },
            ctx,
          );
          return { executionId: execution.id, passed: false, errors };
        }
      }

      let deliverableId: string | undefined;

      // Persist triage briefing on the campaign row when the import targets the
      // triage template. Per-issue imports stay execution-row-only (Non-Goals).
      // Mirrors executeSeekSync: provenance metadata + _validated flag.
      if (templateId === PROFILE_REPAIR_TRIAGE_TEMPLATE_ID && parsedJson?.profile_repair_triage) {
        try {
          const triageValidated = profileRepairTriageSchema.safeParse(parsedJson);
          const recommendation = triageValidated.success
            ? triageValidated.data.profile_repair_triage
            : parsedJson.profile_repair_triage;

          // Apply the same code-side track floor as executeSeekSync.
          const signalCodes = extractSignals({
            campaign,
            auditData: latestAudit?.audit_data as any,
          });
          const floorTrack = this.resolveTrackFromSignals(signalCodes);
          if (floorTrack === 'escalated' && recommendation?.recommended_track === 'standard') {
            logger.warn('Imported triage de-escalated below signal floor; forcing escalated', ctx, {
              campaignId,
              aiTrack: recommendation.recommended_track,
              floorTrack,
            });
            recommendation.recommended_track = 'escalated';
          }

          if (recommendation) {
            await this.prisma.mkt_campaigns_list.update({
              where: { id: campaignId },
              data: {
                repair_triage_briefing: {
                  ...recommendation,
                  _execution_id: execution.id,
                  _validated: triageValidated.success,
                } as any,
              },
            });
          }
        } catch (persistErr) {
          logger.warn('Failed to persist triage briefing from import', ctx, {
            error: (persistErr as Error).message,
            campaignId,
            executionId: execution.id,
          });
        }
      }

      // Handle resolution import -> deliverable + stage transition
      if (templateId === PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID || template.prompt_type === 'recovery_resolution') {
        deliverableId = generateDeliverableId();

        await this.prisma.mkt_deliverables_list.create({
          data: {
            id: deliverableId,
            campaign_id: campaignId,
            execution_id: execution.id,
            template_id: templateId,
            deliverable_type: 'reinstatement_appeal',
            status: 'drafted',
            file_name: `reinstatement-appeal-${campaignId}.json`,
            storage_path: `recovery/${campaignId}/${deliverableId}.json`,
            mime_type: 'application/json',
            generated_by: ctx?.userId || 'operator-external',
          },
        });

        await this.prisma.mkt_deliverable_section.createMany({
          data: [
            {
              id: generateDeliverableSectionId(),
              deliverable_id: deliverableId,
              campaign_id: campaignId,
              section_type: 'response_draft',
              title: 'Reinstatement Appeal Letter',
              content: parsedJson.deliverableText,
              source: 'external',
              quality_gate_passed: true,
              quality_gate_issues: [],
              status: 'draft',
              section_index: 0,
            },
            {
              id: generateDeliverableSectionId(),
              deliverable_id: deliverableId,
              campaign_id: campaignId,
              section_type: 'submission_guide',
              title: 'Submission Guide',
              content: parsedJson.submissionGuide,
              source: 'external',
              quality_gate_passed: true,
              quality_gate_issues: [],
              status: 'draft',
              section_index: 1,
            },
          ],
        });

        await MarketingCampaignService.transitionStage(
          {
            campaignId,
            toStage: 'final_resolution_drafted',
            triggerType: 'manual',
            notes: 'External reinstatement appeal imported',
          },
          ctx,
        );
      }

      await promptService.updateExecution(
        execution.id,
        {
          rawOutput,
          filteredOutput: rawOutput,
          status: 'completed',
        },
        ctx,
      );

      return {
        executionId: execution.id,
        passed: true,
        deliverableId,
      };
    } catch (error) {
      logger.error('Failed to import external profile repair result', ctx, {
        error: (error as Error).message,
        campaignId,
        templateId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private stripJsonArtifacts(content: string): string {
    return content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }
}

export default ProfileRepairPromptService.getInstance();
