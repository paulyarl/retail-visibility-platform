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
import { MarketingCampaignService } from './MarketingCampaignService';
import { MarketingDeliverableService } from './MarketingDeliverableService';
import { extractSignals, type SignalCode } from './triage/signal-extractor';
import { aiProviderFactory } from './ai/AIProviderFactory';
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
  DS_CLAIMED_STATUS: 'unclaimed_profile',
  DS_UNCLAIMED_PROFILE: 'unclaimed_profile',
  DS_MISSING_SERVICE_MENU: 'missing_category',
  DS_MISSING_CATEGORY: 'missing_category',
  DS_OUTDATED_HOURS: 'missing_hours',
  DS_OUTDATED_HOLIDAY_HOURS: 'missing_hours',
  DS_MISSING_HOURS: 'missing_hours',
  DS_MISSING_PROFILE: 'platform_gap',
  DS_PLATFORM_GAP: 'platform_gap',
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

  buildSeekVariables(campaign: any, latestAudit: any): Record<string, string> {
    const signalCodes = extractSignals({
      campaign,
      auditData: latestAudit?.audit_data,
    });

    return {
      audit_signals: this.serializeSignals(signalCodes),
      issue_type: campaign.repair_issue_type || '',
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

      if (targetTemplateId === PROFILE_REPAIR_TRIAGE_TEMPLATE_ID && execution.raw_output) {
        try {
          const cleaned = this.stripJsonArtifacts(execution.raw_output);
          const parsed = JSON.parse(cleaned);
          const validated = profileRepairTriageSchema.safeParse(parsed);
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

      // Create deliverable of type reinstatement_appeal
      const deliverableService = MarketingDeliverableService.getInstance();
      const deliverable = await deliverableService.createDeliverable(
        {
          campaignId,
          type: 'reinstatement_appeal',
          filePayload: {
            deliverableText: parsedJson.deliverableText,
            submissionGuide: parsedJson.submissionGuide,
          },
          generatedBy: 'profile-repair-agent',
        },
        ctx,
      );

      // Transition campaign stage to final_resolution_drafted
      await MarketingCampaignService.transitionStage(
        campaignId,
        'final_resolution_drafted',
        {
          reason: 'AI drafted reinstatement appeal package',
          changedBy: 'profile-repair-agent',
          metadata: { deliverableId: deliverable.id, executionId },
        },
        ctx,
      );

      logger.info('Profile repair resolution run completed', ctx, {
        executionId,
        campaignId,
        deliverableId: deliverable.id,
      });

      return {
        executionId,
        campaignId,
        deliverableId: deliverable.id,
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

      // Handle resolution import -> deliverable + stage transition
      if (templateId === PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID || template.prompt_type === 'recovery_resolution') {
        const deliverableService = MarketingDeliverableService.getInstance();
        const deliverable = await deliverableService.createDeliverable(
          {
            campaignId,
            type: 'reinstatement_appeal',
            filePayload: {
              deliverableText: parsedJson.deliverableText,
              submissionGuide: parsedJson.submissionGuide,
            },
            generatedBy: ctx?.userId || 'operator-external',
          },
          ctx,
        );
        deliverableId = deliverable.id;

        await MarketingCampaignService.transitionStage(
          campaignId,
          'final_resolution_drafted',
          {
            reason: 'External reinstatement appeal imported',
            changedBy: ctx?.userId || 'operator-external',
            metadata: { deliverableId: deliverable.id, executionId: execution.id },
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
