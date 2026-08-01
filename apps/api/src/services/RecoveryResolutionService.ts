/**
 * RecoveryResolutionService — Recovery AI Agent execution + deliverable creation.
 *
 * On intake_submitted, enqueues a prompt execution against the seeded
 * recovery_resolution template. The scheduler job (jobs/recovery-resolution.ts)
 * polls for pending executions and calls run(), which:
 *   1. Loads complaint text + intake payload + attachment meta
 *   2. Interpolates the template body
 *   3. Invokes AIProviderService (via AiProviderFactory)
 *   4. Validates output against recovery_resolution schema
 *   5. On success: persists deliverable + sections, transitions to
 *      final_resolution_drafted
 *   6. On failure: writes filter flags, leaves stage at intake_submitted
 *
 * Sprint 3 — Recovery Management Engine.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';
import MarketingPromptService from './MarketingPromptService';
import MarketingCampaignService from './MarketingCampaignService';
import { generateDeliverableId, generateDeliverableSectionId, generateFilterFlagId } from '../lib/id-generator';
import { resolveOutputSchema } from '../validators/market-analysis.schema';
import { RECOVERY_RESOLUTION_PROMPT_SUFFIX } from '../validators/recovery-resolution.schema';
import AiProviderFactory from './ai-providers/AiProviderFactory';
import type { RequestCtx } from '../context';

// ====================
// CONSTANTS
// ====================

const RECOVERY_TEMPLATE_ID = 'mpt-recovery-resolution-default';
const RECOVERY_SCHEMA_NAME = 'recovery_resolution';

// ====================
// TYPES
// ====================

export interface EnqueueResult {
  executionId: string;
  campaignId: string;
}

export interface RunResult {
  executionId: string;
  campaignId: string;
  deliverableId: string;
  stage: string;
  passed: boolean;
}

// ====================
// SERVICE
// ====================

export class RecoveryResolutionService extends BaseService {
  private static instance: RecoveryResolutionService;

  private constructor() {
    super();
  }

  static getInstance(): RecoveryResolutionService {
    if (!RecoveryResolutionService.instance) {
      RecoveryResolutionService.instance = new RecoveryResolutionService();
    }
    return RecoveryResolutionService.instance;
  }

  // ====================
  // ENQUEUE — called by DisputeIntakeService.submitIntake
  // ====================

  async enqueue(campaignId: string, intakeId: string, ctx?: RequestCtx): Promise<EnqueueResult> {
    try {
      // Load complaint context: campaign notes + audit data + intake payload
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_audits_list: { take: 1, orderBy: { created_at: 'desc' } },
          mkt_dispute_intake: { include: { mkt_dispute_attachments: true } },
        },
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const intake = campaign.mkt_dispute_intake;
      if (!intake) {
        throw new Error(`Dispute intake for campaign ${campaignId} not found`);
      }

      // Build variable inputs for the prompt template
      const complaintText = campaign.notes || '(No complaint text recorded — see audit data)';
      const intakePayload = JSON.stringify({
        ownerStatement: intake.owner_statement,
        proposedResolution: intake.proposed_resolution,
        serviceDate: intake.service_date,
        statusFlag: intake.status_flag,
      });
      const attachmentMeta = JSON.stringify(
        (intake.mkt_dispute_attachments || []).map((a: any) => ({
          fileName: a.file_name,
          fileType: a.file_type,
        })),
      );

      const variablesUsed = {
        complaintText,
        intakePayload,
        attachmentMeta,
        intakeId,
      };

      // Create a pending prompt execution
      const execution = await MarketingPromptService.createExecution({
        campaignId,
        templateId: RECOVERY_TEMPLATE_ID,
        variablesUsed,
        executedBy: 'recovery-agent',
      }, ctx);

      logger.info('Recovery resolution execution enqueued', ctx, {
        executionId: execution.id,
        campaignId,
        intakeId,
      });

      return { executionId: execution.id, campaignId };
    } catch (error) {
      logger.error('Failed to enqueue recovery resolution', ctx, {
        error: (error as Error).message,
        campaignId,
        intakeId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // RUN — called by the scheduler job
  // ====================

  async run(executionId: string, ctx?: RequestCtx): Promise<RunResult> {
    try {
      const execution = await MarketingPromptService.getExecution(executionId, ctx);
      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }
      if (execution.status !== 'pending') {
        logger.info('Recovery resolution execution already processed, skipping', ctx, {
          executionId,
          status: execution.status,
        });
        // Return a no-op result — the job should skip non-pending executions
        return {
          executionId,
          campaignId: execution.campaign_id,
          deliverableId: '',
          stage: '',
          passed: false,
        };
      }

      const template = execution.mkt_prompt_templates_list;
      if (!template) {
        throw new Error(`Template not found for execution ${executionId}`);
      }

      const campaignId = execution.campaign_id;
      const variables = execution.variables_used || {};

      // Interpolate the template body with variables
      const interpolatedBody = this.interpolateTemplate(template.body, variables);

      // Invoke the AI provider
      const aiResult = await this.invokeAi(interpolatedBody, ctx);

      // Persist raw output + metrics
      await MarketingPromptService.updateExecution(executionId, {
        rawOutput: aiResult.content,
        aiProvider: aiResult.provider,
        aiModel: aiResult.model,
        tokensUsed: aiResult.tokensUsed,
        costCents: aiResult.costCents,
        status: 'completed',
      }, ctx);

      // Validate against recovery_resolution schema
      const resolved = resolveOutputSchema(RECOVERY_SCHEMA_NAME);
      if (!resolved) {
        throw new Error(`Output schema "${RECOVERY_SCHEMA_NAME}" not registered`);
      }

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(this.stripJsonArtifacts(aiResult.content));
      } catch (e) {
        // JSON parse failure → filter flag, no deliverable
        await this.createFilterFlag(executionId, {
          failedChecks: [{ issue: 'invalid_json', detail: 'AI output is not valid JSON' }],
          suggestedFix: 'Re-run the execution with a more explicit JSON instruction in the prompt.',
        }, ctx);
        await MarketingPromptService.updateExecution(executionId, {
          status: 'failed',
          flaggedCount: 1,
          passRate: 0,
        }, ctx);
        logger.warn('Recovery resolution AI output was not valid JSON', ctx, { executionId });
        return {
          executionId,
          campaignId,
          deliverableId: '',
          stage: 'intake_submitted',
          passed: false,
        };
      }

      const validationResult = resolved.validator.safeParse(parsedJson);
      if (!validationResult.success) {
        // Schema validation failure → filter flags, no deliverable, stage unchanged
        const issues = validationResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        await this.createFilterFlag(executionId, {
          failedChecks: issues,
          suggestedFix: 'Re-run the execution or manually edit the AI output to match the recovery_resolution schema.',
        }, ctx);
        await MarketingPromptService.updateExecution(executionId, {
          status: 'failed',
          flaggedCount: issues.length,
          passRate: 0,
          filteredOutput: JSON.stringify(parsedJson),
        }, ctx);
        logger.warn('Recovery resolution AI output failed schema validation', ctx, {
          executionId,
          issueCount: issues.length,
        });
        return {
          executionId,
          campaignId,
          deliverableId: '',
          stage: 'intake_submitted',
          passed: false,
        };
      }

      // Success — persist the deliverable + sections
      const output = parsedJson.recovery_resolution;
      const deliverableId = generateDeliverableId();

      await this.prisma.mkt_deliverables_list.create({
        data: {
          id: deliverableId,
          campaign_id: campaignId,
          execution_id: executionId,
          template_id: null,
          deliverable_type: 'recovery_resolution',
          status: 'drafted',
          file_name: `recovery-resolution-${campaignId}.json`,
          storage_path: `recovery/${campaignId}/${deliverableId}.json`,
          mime_type: 'application/json',
          generated_by: 'recovery-agent',
        },
      });

      // Create two sections: response_draft + submission_guide
      await this.prisma.mkt_deliverable_section.createMany({
        data: [
          {
            id: generateDeliverableSectionId(),
            deliverable_id: deliverableId,
            campaign_id: campaignId,
            section_type: 'response_draft',
            title: 'Response Draft',
            content: output.deliverableText,
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
            content: output.submissionGuide,
            source: 'ai',
            quality_gate_passed: true,
            quality_gate_issues: [],
            status: 'draft',
            section_index: 1,
          },
        ],
      });

      await MarketingPromptService.updateExecution(executionId, {
        filteredOutput: JSON.stringify(parsedJson),
        passRate: 100,
        flaggedCount: 0,
      }, ctx);

      // Transition campaign to final_resolution_drafted
      const updated = await MarketingCampaignService.transitionStage({
        campaignId,
        toStage: 'final_resolution_drafted',
        triggerType: 'system',
        notes: 'Recovery AI Agent drafted resolution',
      }, ctx);

      logger.info('Recovery resolution deliverable created', ctx, {
        executionId,
        campaignId,
        deliverableId,
        stage: updated.stage,
      });

      return {
        executionId,
        campaignId,
        deliverableId,
        stage: updated.stage,
        passed: true,
      };
    } catch (error) {
      logger.error('Recovery resolution run failed', ctx, {
        error: (error as Error).message,
        executionId,
      });
      // Mark execution as failed
      try {
        await MarketingPromptService.updateExecution(executionId, {
          status: 'failed',
        }, ctx);
      } catch (updateErr) {
        logger.error('Failed to mark execution as failed', ctx, {
          error: (updateErr as Error).message,
          executionId,
        });
      }
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // REGENERATE — operator re-runs the agent with edited intake/notes
  // ====================

  async regenerate(campaignId: string, ctx?: RequestCtx): Promise<EnqueueResult> {
    try {
      // Archive the existing deliverable (mark status='archived')
      const existingDeliverable = await this.prisma.mkt_deliverables_list.findFirst({
        where: {
          campaign_id: campaignId,
          deliverable_type: 'recovery_resolution',
          status: 'drafted',
        },
        orderBy: { generated_at: 'desc' },
      });

      if (existingDeliverable) {
        await this.prisma.mkt_deliverables_list.update({
          where: { id: existingDeliverable.id },
          data: { status: 'archived' },
        });
        logger.info('Recovery deliverable archived for regeneration', ctx, {
          campaignId,
          deliverableId: existingDeliverable.id,
        });
      }

      // Re-enqueue a fresh execution (loads current intake state)
      const intake = await this.prisma.mkt_dispute_intake.findUnique({
        where: { campaign_id: campaignId },
      });

      if (!intake) {
        throw new Error(`Dispute intake for campaign ${campaignId} not found`);
      }

      return this.enqueue(campaignId, intake.id, ctx);
    } catch (error) {
      logger.error('Failed to regenerate recovery resolution', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // APPROVE DRAFT — operator approves, transitions to resolved_and_closed
  // ====================

  async approveDraft(campaignId: string, ctx?: RequestCtx): Promise<{
    campaignId: string;
    stage: string;
    deliverableId: string;
  }> {
    try {
      // Find the current drafted deliverable
      const deliverable = await this.prisma.mkt_deliverables_list.findFirst({
        where: {
          campaign_id: campaignId,
          deliverable_type: 'recovery_resolution',
          status: 'drafted',
        },
        orderBy: { generated_at: 'desc' },
      });

      if (!deliverable) {
        throw new Error(`No drafted recovery resolution found for campaign ${campaignId}`);
      }

      // Mark deliverable as approved
      await this.prisma.mkt_deliverables_list.update({
        where: { id: deliverable.id },
        data: { status: 'approved' },
      });

      // Transition: final_resolution_drafted → owner_approved → resolved_and_closed
      // Two-step transition (single action from operator perspective)
      await MarketingCampaignService.transitionStage({
        campaignId,
        toStage: 'owner_approved',
        triggerType: 'manual',
        notes: 'Operator approved recovery resolution draft',
      }, ctx);

      const updated = await MarketingCampaignService.transitionStage({
        campaignId,
        toStage: 'resolved_and_closed',
        triggerType: 'manual',
        notes: 'Recovery resolution delivered to owner',
      }, ctx);

      // Deliver the approved resolution to the owner via email
      await this.deliverToOwner(campaignId, deliverable.id, ctx);

      logger.info('Recovery resolution approved and delivered', ctx, {
        campaignId,
        deliverableId: deliverable.id,
        stage: updated.stage,
      });

      return {
        campaignId,
        stage: updated.stage,
        deliverableId: deliverable.id,
      };
    } catch (error) {
      logger.error('Failed to approve recovery draft', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // DELIVER TO OWNER — send approved resolution via email
  // ====================

  private async deliverToOwner(campaignId: string, deliverableId: string, ctx?: RequestCtx): Promise<void> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) return;

      // Load the deliverable sections
      const sections = await this.prisma.mkt_deliverable_section.findMany({
        where: { deliverable_id: deliverableId },
        orderBy: { section_index: 'asc' },
      });

      const responseDraft = sections.find((s: any) => s.section_type === 'response_draft');
      const submissionGuide = sections.find((s: any) => s.section_type === 'submission_guide');

      const messageSnapshot = JSON.stringify({
        responseDraft: responseDraft?.content || '',
        submissionGuide: submissionGuide?.content || '',
      });

      // Log the delivery via MarketingOutreachService (records in mkt_outreach_log)
      const { MarketingOutreachService } = await import('./MarketingOutreachService.js');
      await MarketingOutreachService.getInstance().logContact({
        campaignId,
        contactChannel: 'email',
        contactDate: new Date().toISOString(),
        outcome: 'other',
        notes: 'Approved recovery resolution delivered to owner',
        messageSnapshot,
        messageSubject: `Your Recovery Resolution — ${campaign.business_name || 'Action Required'}`,
        contactedBy: ctx?.userId || 'system',
      }, ctx);

      logger.info('Recovery resolution delivered to owner', ctx, {
        campaignId,
        deliverableId,
      });
    } catch (error) {
      // Best-effort — delivery failure shouldn't roll back the approval
      logger.warn('Recovery resolution owner delivery failed (best-effort)', ctx, {
        campaignId,
        deliverableId,
        error: (error as Error).message,
      });
    }
  }

  // ====================
  // DUAL-MODE: Render prompt text for copy-paste bridge
  // ====================

  async renderPromptText(campaignId: string, ctx?: RequestCtx): Promise<{
    renderedPrompt: string;
    templateId: string;
    variablesUsed: Record<string, any>;
  }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_audits_list: { take: 1, orderBy: { created_at: 'desc' } },
          mkt_dispute_intake: { include: { mkt_dispute_attachments: true } },
        },
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const intake = campaign.mkt_dispute_intake;
      if (!intake) {
        throw new Error(`Dispute intake for campaign ${campaignId} not found`);
      }

      // Load the prompt template
      const template = await this.prisma.mkt_prompt_templates_list.findUnique({
        where: { id: RECOVERY_TEMPLATE_ID },
      });

      if (!template) {
        throw new Error(`Recovery resolution template "${RECOVERY_TEMPLATE_ID}" not found`);
      }

      // Build the same variables as enqueue()
      const complaintText = campaign.notes || '(No complaint text recorded — see audit data)';
      const intakePayload = JSON.stringify({
        ownerStatement: intake.owner_statement,
        proposedResolution: intake.proposed_resolution,
        serviceDate: intake.service_date,
        statusFlag: intake.status_flag,
      });
      const attachmentMeta = JSON.stringify(
        (intake.mkt_dispute_attachments || []).map((a: any) => ({
          fileName: a.file_name,
          fileType: a.file_type,
        })),
      );

      const variablesUsed = {
        complaintText,
        intakePayload,
        attachmentMeta,
        intakeId: intake.id,
      };

      const interpolated = this.interpolateTemplate(template.body, variablesUsed);

      // Append the output schema suffix so external agents know the expected JSON shape
      const fullPrompt = interpolated + RECOVERY_RESOLUTION_PROMPT_SUFFIX;

      logger.info('Recovery prompt text rendered for copy', ctx, { campaignId });

      return {
        renderedPrompt: fullPrompt,
        templateId: RECOVERY_TEMPLATE_ID,
        variablesUsed,
      };
    } catch (error) {
      logger.error('Failed to render recovery prompt text', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // DUAL-MODE: Import external result (copy-paste bridge)
  // ====================

  async importExternalResult(campaignId: string, rawOutput: string, ctx?: RequestCtx): Promise<{
    executionId: string;
    campaignId: string;
    deliverableId: string;
    passed: boolean;
    errors?: string[];
  }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_dispute_intake: { include: { mkt_dispute_attachments: true } },
        },
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const intake = campaign.mkt_dispute_intake;
      if (!intake) {
        throw new Error(`Dispute intake for campaign ${campaignId} not found`);
      }

      // Build variables (same as enqueue)
      const complaintText = campaign.notes || '(No complaint text recorded — see audit data)';
      const intakePayload = JSON.stringify({
        ownerStatement: intake.owner_statement,
        proposedResolution: intake.proposed_resolution,
        serviceDate: intake.service_date,
        statusFlag: intake.status_flag,
      });
      const attachmentMeta = JSON.stringify(
        (intake.mkt_dispute_attachments || []).map((a: any) => ({
          fileName: a.file_name,
          fileType: a.file_type,
        })),
      );

      const variablesUsed = {
        complaintText,
        intakePayload,
        attachmentMeta,
        intakeId: intake.id,
      };

      // Create a completed execution record (external source)
      const execution = await MarketingPromptService.createExecution({
        campaignId,
        templateId: RECOVERY_TEMPLATE_ID,
        variablesUsed,
        executedBy: ctx?.userId || 'operator-external',
      }, ctx);

      // Parse + validate the external output
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(this.stripJsonArtifacts(rawOutput));
      } catch (e) {
        await MarketingPromptService.updateExecution(execution.id, {
          rawOutput,
          status: 'failed',
          flaggedCount: 1,
          passRate: 0,
        }, ctx);
        await this.createFilterFlag(execution.id, {
          failedChecks: [{ issue: 'invalid_json', detail: 'Imported output is not valid JSON' }],
          suggestedFix: 'Ensure the external AI returned only JSON, no markdown fences or commentary.',
        }, ctx);
        return {
          executionId: execution.id,
          campaignId,
          deliverableId: '',
          passed: false,
          errors: ['Invalid JSON — the external output could not be parsed'],
        };
      }

      const resolved = resolveOutputSchema(RECOVERY_SCHEMA_NAME);
      if (!resolved) {
        throw new Error(`Output schema "${RECOVERY_SCHEMA_NAME}" not registered`);
      }

      const validationResult = resolved.validator.safeParse(parsedJson);
      if (!validationResult.success) {
        const issues = validationResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        await this.createFilterFlag(execution.id, {
          failedChecks: issues,
          suggestedFix: 'Edit the external output to match the recovery_resolution schema and re-import.',
        }, ctx);
        await MarketingPromptService.updateExecution(execution.id, {
          rawOutput,
          status: 'failed',
          flaggedCount: issues.length,
          passRate: 0,
          filteredOutput: JSON.stringify(parsedJson),
        }, ctx);
        return {
          executionId: execution.id,
          campaignId,
          deliverableId: '',
          passed: false,
          errors: issues.map((i) => `${i.path}: ${i.message}`),
        };
      }

      // Success — persist the deliverable + sections (same as run())
      const output = parsedJson.recovery_resolution;
      const deliverableId = generateDeliverableId();

      await this.prisma.mkt_deliverables_list.create({
        data: {
          id: deliverableId,
          campaign_id: campaignId,
          execution_id: execution.id,
          template_id: null,
          deliverable_type: 'recovery_resolution',
          status: 'drafted',
          file_name: `recovery-resolution-${campaignId}.json`,
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
            title: 'Response Draft',
            content: output.deliverableText,
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
            content: output.submissionGuide,
            source: 'external',
            quality_gate_passed: true,
            quality_gate_issues: [],
            status: 'draft',
            section_index: 1,
          },
        ],
      });

      await MarketingPromptService.updateExecution(execution.id, {
        rawOutput,
        filteredOutput: JSON.stringify(parsedJson),
        status: 'completed',
        passRate: 100,
        flaggedCount: 0,
        aiProvider: 'external',
        aiModel: 'external-import',
      }, ctx);

      // Transition campaign to final_resolution_drafted
      await MarketingCampaignService.transitionStage(campaignId, 'final_resolution_drafted', ctx, {
        note: 'Recovery resolution imported from external AI output',
      });

      logger.info('Recovery external result imported successfully', ctx, {
        executionId: execution.id,
        campaignId,
        deliverableId,
      });

      return {
        executionId: execution.id,
        campaignId,
        deliverableId,
        passed: true,
      };
    } catch (error) {
      logger.error('Failed to import external recovery result', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // DUAL-MODE: Direct execute (enqueue + run immediately)
  // ====================

  async executeDirect(campaignId: string, ctx?: RequestCtx): Promise<{
    executionId: string;
    campaignId: string;
    deliverableId: string;
    passed: boolean;
    errors?: string[];
  }> {
    try {
      const intake = await this.prisma.mkt_dispute_intake.findUnique({
        where: { campaign_id: campaignId },
      });

      if (!intake) {
        throw new Error(`Dispute intake for campaign ${campaignId} not found`);
      }

      // Enqueue
      const enqueued = await this.enqueue(campaignId, intake.id, ctx);

      // Run immediately (don't wait for scheduler)
      const result = await this.run(enqueued.executionId, ctx);

      return {
        executionId: result.executionId,
        campaignId: result.campaignId,
        deliverableId: result.deliverableId,
        passed: result.passed,
        errors: result.passed ? undefined : ['AI output failed validation — check filter flags'],
      };
    } catch (error) {
      logger.error('Failed to execute recovery resolution directly', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // HELPERS
  // ====================

  private interpolateTemplate(body: string, variables: Record<string, any>): string {
    let result = body;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.split(placeholder).join(String(value));
    }
    return result;
  }

  private async invokeAi(promptBody: string, ctx?: RequestCtx): Promise<{
    content: string;
    provider: string;
    model: string;
    tokensUsed: number;
    costCents: number;
  }> {
    // AiProviderFactory is imported as the singleton instance (default export)
    const factory = AiProviderFactory;

    const provider = unifiedConfig.recoveryAiProvider;
    const model = unifiedConfig.recoveryAiModel;

    // If a specific provider/model is configured for recovery, use it;
    // otherwise fall back to the platform default via getChatConfig().
    let result;
    let usedProvider: string;
    let usedModel: string;

    if (provider && model) {
      // Use the recovery-specific provider — get the instance from the factory
      const config = await factory.getChatConfig();
      result = await config.provider.generateChatCompletion({
        model,
        messages: [
          { role: 'system', content: 'You are the Recovery Resolution Agent. Return only valid JSON.' },
          { role: 'user', content: promptBody },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });
      usedProvider = provider;
      usedModel = model;
    } else {
      // Fall back to platform default
      result = await factory.generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are the Recovery Resolution Agent. Return only valid JSON.' },
          { role: 'user', content: promptBody },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });
      const config = await factory.getChatConfig();
      usedProvider = config.provider.constructor.name.replace('Provider', '').toLowerCase();
      usedModel = config.model;
    }

    const tokensUsed = result.usage?.totalTokens || 0;
    // Rough cost estimate: $0.01 per 1K tokens (configurable later)
    const costCents = Math.ceil((tokensUsed / 1000) * 1);

    return {
      content: result.content,
      provider: usedProvider,
      model: usedModel,
      tokensUsed,
      costCents,
    };
  }

  private async createFilterFlag(
    executionId: string,
    input: { failedChecks: any; suggestedFix?: string },
    ctx?: RequestCtx,
  ): Promise<void> {
    const id = generateFilterFlagId();
    await this.prisma.mkt_filter_flags_list.create({
      data: {
        id,
        execution_id: executionId,
        response_number: 1,
        failed_checks: input.failedChecks,
        suggested_fix: input.suggestedFix || null,
        status: 'pending',
      },
    });
    logger.info('Filter flag created for recovery resolution', ctx, { executionId, flagId: id });
  }

  /**
   * Strip common LLM JSON-generation artifacts (markdown fences, leading text).
   * Mirrors stripLlmJsonArtifacts in MarketingPromptService but also handles
   * ```json fences.
   */
  private stripJsonArtifacts(raw: string): string {
    let cleaned = raw.trim();
    // Strip markdown code fences
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    // Strip leading non-JSON text (find first { or [)
    const firstBrace = cleaned.search(/[{[]/);
    if (firstBrace > 0) {
      cleaned = cleaned.slice(firstBrace);
    }
    // Strip trailing non-JSON text (find last } or ])
    const lastBrace = cleaned.search(/[}\]]\s*$/);
    if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
      cleaned = cleaned.slice(0, cleaned.lastIndexOf(cleaned.match(/[}\]]\s*$/)?.[0] || '}'));

      // Re-add the closing brace
      const match = raw.match(/[}\]]\s*$/);
      if (match) {
        cleaned = cleaned + match[0].trim();
      }
    }
    return cleaned;
  }
}

export default RecoveryResolutionService.getInstance();
