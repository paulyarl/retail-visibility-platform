/**
 * OutreachChecklistBridgeService — bridges outreach artifacts to checklist
 *
 * Connects the campaign execution layer (Openers, Follow-Ups, Pitch
 * Construction, Contact Log) to the planning layer (Checklist Builder).
 *
 * Responsibilities:
 *   1. getOutreachState(campaignId) — counts + derived flags for the
 *      campaign's outreach artifacts. Used by the checklist view builder
 *      and the campaign overview's outreach status card.
 *   2. checkStepSatisfaction(campaignId, step) — for an outreach-kind
 *      checklist step, check if its artifact exists.
 *   3. onOutreachArtifactCreated(campaignId, artifactKind) — called after
 *      an opener/follow-up/pitch/contact-log is created. Auto-completes
 *      steps where action_config.auto_complete=true.
 *   4. resolveStepDeepLink(campaignId, step) — resolves the internal URL
 *      for an outreach or internal_link step.
 *   5. enrichStepViews(campaignId, stepViews) — enriches the checklist
 *      view with outreachStatus + internalLink data.
 *
 * Pattern: singleton extends BaseService.
 * Spec: docs/LocalBiz/marketing_ops_outreach_checklist_bridge_sprint_plan.md §5.1
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { generateCampaignChecklistProgressId } from '../lib/id-generator';
import outreachStateExtractor, { type OutreachState } from './triage/outreach-state-extractor';
import type { CampaignChecklistStepView } from './PlaybookChecklistService';

// ─── Types ──────────────────────────────────────────────────────────────

export type OutreachArtifactKind = 'opener' | 'follow_up' | 'pitch' | 'contact_log';

export interface StepSatisfaction {
  satisfied: boolean;
  artifactId: string | null;
  artifactDate: Date | null;
}

export interface AutoCompletedStep {
  stepId: string;
  stepTitle: string;
}

// ─── Internal-link target resolver ──────────────────────────────────────
//
// Named targets → URL templates. {campaignId} is substituted at render time.
// Using named targets (not raw URLs) keeps step templates portable across
// campaigns and prevents stale links when routes change.

const BASE = '/settings/admin/marketing-ops';

function resolveInternalLinkUrl(
  campaignId: string,
  target: string,
  params: Record<string, any> | null,
): string {
  switch (target) {
    case 'openers_workspace': {
      const tab = params?.tab ?? 'opener';
      return `${BASE}/openers?campaign=${campaignId}&tab=${tab}`;
    }
    case 'deliverables':
      return `${BASE}/deliverables/${campaignId}`;
    case 'gallery':
      return `${BASE}/campaigns/${campaignId}?tab=gallery`;
    case 'campaign_tab': {
      const tab = params?.tab ?? 'overview';
      return `${BASE}/campaigns/${campaignId}?tab=${tab}`;
    }
    case 'recovery_detail':
      return `${BASE}/recovery/${campaignId}`;
    case 'intake_form': {
      const kind = params?.intakeKind ?? 'dispute';
      return `/recovery/intake?campaign=${campaignId}&kind=${kind}`;
    }
    default:
      return `${BASE}/campaigns/${campaignId}`;
  }
}

// ─── Service ────────────────────────────────────────────────────────────

export class OutreachChecklistBridgeService extends BaseService {
  private static instance: OutreachChecklistBridgeService;

  private constructor() {
    super();
  }

  static getInstance(): OutreachChecklistBridgeService {
    if (!OutreachChecklistBridgeService.instance) {
      OutreachChecklistBridgeService.instance = new OutreachChecklistBridgeService();
    }
    return OutreachChecklistBridgeService.instance;
  }

  /**
   * Get the outreach state for a campaign. Delegates to the
   * OutreachStateSignalExtractor for the counts + derived flags.
   */
  async getOutreachState(campaignId: string, ctx?: RequestCtx): Promise<OutreachState> {
    return outreachStateExtractor.extractOutreachState(campaignId, ctx);
  }

  /**
   * For a given outreach checklist step, check if its artifact exists.
   * Returns { satisfied, artifactId, artifactDate } or { satisfied: false }.
   */
  async checkStepSatisfaction(
    campaignId: string,
    step: { stepType: string; actionConfig: Record<string, any> },
    ctx?: RequestCtx,
  ): Promise<StepSatisfaction> {
    const kind = step.actionConfig?.outreach_kind ?? 'generic';
    if (kind === 'generic') {
      return { satisfied: false, artifactId: null, artifactDate: null };
    }

    try {
      switch (kind) {
        case 'opener': {
          const row = await this.prisma.mkt_outreach_openers_list.findFirst({
            where: { campaign_id: campaignId, message_type: null },
            orderBy: { executed_at: 'desc' },
            select: { id: true, executed_at: true },
          }) as any;
          return row
            ? { satisfied: true, artifactId: row.id, artifactDate: new Date(row.executed_at) }
            : { satisfied: false, artifactId: null, artifactDate: null };
        }
        case 'follow_up': {
          const minNum = step.actionConfig?.min_followup_number ?? null;
          const where: any = { campaign_id: campaignId, message_type: 'follow_up' };
          if (minNum != null) where.followup_number = { gte: minNum };
          const row = await this.prisma.mkt_outreach_openers_list.findFirst({
            where,
            orderBy: { executed_at: 'desc' },
            select: { id: true, executed_at: true },
          }) as any;
          return row
            ? { satisfied: true, artifactId: row.id, artifactDate: new Date(row.executed_at) }
            : { satisfied: false, artifactId: null, artifactDate: null };
        }
        case 'pitch': {
          const row = await this.prisma.mkt_outreach_pitches_list.findFirst({
            where: { campaign_id: campaignId },
            orderBy: { created_at: 'desc' },
            select: { id: true, created_at: true },
          }) as any;
          return row
            ? { satisfied: true, artifactId: row.id, artifactDate: new Date(row.created_at) }
            : { satisfied: false, artifactId: null, artifactDate: null };
        }
        case 'contact_log': {
          const channel = step.actionConfig?.channel ?? null;
          const where: any = { campaign_id: campaignId };
          if (channel) where.channel = channel;
          const row = await this.prisma.mkt_outreach_log.findFirst({
            where,
            orderBy: { created_at: 'desc' },
            select: { id: true, created_at: true },
          }) as any;
          return row
            ? { satisfied: true, artifactId: row.id, artifactDate: new Date(row.created_at) }
            : { satisfied: false, artifactId: null, artifactDate: null };
        }
        default:
          return { satisfied: false, artifactId: null, artifactDate: null };
      }
    } catch (error) {
      logger.warn('checkStepSatisfaction failed', ctx, {
        error: (error as Error).message,
        campaignId,
        kind,
      });
      return { satisfied: false, artifactId: null, artifactDate: null };
    }
  }

  /**
   * Resolve the deep-link URL for an outreach or internal_link step.
   * Returns null for generic/manual steps.
   */
  resolveStepDeepLink(
    campaignId: string,
    step: { stepType: string; actionConfig: Record<string, any> },
  ): string | null {
    if (step.stepType === 'internal_link') {
      const target = step.actionConfig?.target;
      if (!target) return null;
      return resolveInternalLinkUrl(campaignId, target, step.actionConfig?.params ?? null);
    }
    if (step.stepType === 'outreach') {
      const kind = step.actionConfig?.outreach_kind ?? 'generic';
      switch (kind) {
        case 'opener':
          return `${BASE}/openers?campaign=${campaignId}&tab=opener`;
        case 'follow_up':
          return `${BASE}/openers?campaign=${campaignId}&tab=followup`;
        case 'pitch':
          return `${BASE}/openers?campaign=${campaignId}&tab=pitch`;
        case 'contact_log':
          return `${BASE}/campaigns/${campaignId}?tab=overview`;
        default:
          return null;
      }
    }
    return null;
  }

  /**
   * Called after an opener/follow-up/pitch/contact-log is created.
   * Finds outreach-kind checklist steps for the campaign's effective
   * playbook, checks satisfaction, and auto-completes steps where
   * auto_complete=true. Returns the list of auto-completed steps.
   */
  async onOutreachArtifactCreated(
    campaignId: string,
    artifactKind: OutreachArtifactKind,
    actor: string,
    ctx?: RequestCtx,
  ): Promise<AutoCompletedStep[]> {
    try {
      // Lazy import to avoid circular dependency
      const { default: checklistService } = await import('./PlaybookChecklistService');
      const view = await checklistService.getCampaignChecklist(campaignId, ctx);
      if (!view.playbook) return [];

      const autoCompleted: AutoCompletedStep[] = [];

      for (const step of view.steps) {
        if (step.stepType !== 'outreach') continue;
        const kind = step.actionConfig?.outreach_kind ?? 'generic';
        if (kind === 'generic' || kind !== artifactKind) continue;
        if (!step.actionConfig?.auto_complete) continue;
        if (step.progress?.completedAt != null) continue; // already done

        // Check satisfaction
        const sat = await this.checkStepSatisfaction(campaignId, step, ctx);
        if (!sat.satisfied) continue;

        // Auto-complete the step
        const progressId = generateCampaignChecklistProgressId();
        await this.prisma.mkt_campaign_checklist_progress.upsert({
          where: { campaign_id_step_id: { campaign_id: campaignId, step_id: step.id } },
          create: {
            id: progressId,
            campaign_id: campaignId,
            step_id: step.id,
            completed_at: new Date(),
            completed_by: actor,
            note: `Auto-completed: ${artifactKind} detected by bridge service`,
          },
          update: {
            completed_at: new Date(),
            completed_by: actor,
            note: `Auto-completed: ${artifactKind} detected by bridge service`,
          },
        });
        autoCompleted.push({ stepId: step.id, stepTitle: step.title });
      }

      if (autoCompleted.length > 0) {
        logger.info('Outreach bridge auto-completed checklist steps', ctx, {
          campaignId,
          artifactKind,
          count: autoCompleted.length,
          steps: autoCompleted.map((s) => s.stepTitle),
        });
      }

      return autoCompleted;
    } catch (error) {
      logger.warn('onOutreachArtifactCreated failed', ctx, {
        error: (error as Error).message,
        campaignId,
        artifactKind,
      });
      return [];
    }
  }

  /**
   * Enrich an array of CampaignChecklistStepView with outreachStatus and
   * internalLink data. Called by PlaybookChecklistService.getCampaignChecklist.
   * Mutates the stepViews in place (adds outreachStatus / internalLink fields).
   */
  async enrichStepViews(
    campaignId: string,
    stepViews: CampaignChecklistStepView[],
    ctx?: RequestCtx,
  ): Promise<void> {
    for (const step of stepViews) {
      if (step.stepType === 'outreach') {
        const kind = step.actionConfig?.outreach_kind ?? 'generic';
        const sat = await this.checkStepSatisfaction(campaignId, step, ctx);
        const deepLink = this.resolveStepDeepLink(campaignId, step);
        step.outreachStatus = {
          satisfied: sat.satisfied,
          artifactId: sat.artifactId,
          artifactDate: sat.artifactDate,
          deepLink,
          kind,
        };
      } else if (step.stepType === 'internal_link') {
        const target = step.actionConfig?.target;
        if (target) {
          const params = step.actionConfig?.params ?? null;
          const resolvedUrl = resolveInternalLinkUrl(campaignId, target, params);
          step.internalLink = { target, params, resolvedUrl };
        }
      }
    }
  }
}

export default OutreachChecklistBridgeService.getInstance();
