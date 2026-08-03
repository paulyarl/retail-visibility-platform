/**
 * PlaybookChecklistService — Operator Playbook Checklists
 *
 * Manages per-playbook ordered checklist step templates, per-campaign
 * check-off progress, and the operator suggestion feedback loop.
 *
 * Templates are edited once per playbook (admin tab) and instantiated
 * implicitly per campaign — progress rows are created lazily on first
 * check-off, not on triage accept.
 *
 * Effective playbook rule (server-side, single source of truth):
 *   if a triage result exists for the campaign, use
 *   overridden_playbook_id ?? recommended_playbook_id, exposed only when
 *   is_operator_accepted = true OR overridden_playbook_id IS NOT NULL.
 *   No triage decision → no checklist (empty state points at triage card).
 *
 * Pattern: singleton extends BaseService (mirrors MarketingPlaybookCatalogService).
 * Spec: docs/LocalBiz/marketing_ops_operator_checklist_sprint_plan.md
 * Sprint — Phase 1 (Data + API).
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError } from '../middleware/errorHandler';
import {
  generatePlaybookChecklistStepId,
  generateCampaignChecklistProgressId,
  generatePlaybookChecklistSuggestionId,
} from '../lib/id-generator';

// ─── Types ───────────────────────────────────────────────────────────────

export const CHECKLIST_STEP_TYPES = [
  'manual',
  'url_check',
  'ai_prompt',
  'deliverable',
  'outreach',
  'credentials',
] as const;
export type ChecklistStepType = (typeof CHECKLIST_STEP_TYPES)[number];

export const SUGGESTION_KINDS = ['add', 'modify', 'remove'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const SUGGESTION_POSITIONS = ['before', 'after', 'supersede'] as const;
export type SuggestionPosition = (typeof SUGGESTION_POSITIONS)[number];

export const SUGGESTION_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export interface ChecklistStepInput {
  title: string;
  instructions?: string;
  stepType: ChecklistStepType;
  actionConfig?: Record<string, any>;
  isRequired?: boolean;
  isActive?: boolean;
}

export interface ChecklistStepUpdateInput {
  title?: string;
  instructions?: string | null;
  stepType?: ChecklistStepType;
  actionConfig?: Record<string, any>;
  isRequired?: boolean;
  isActive?: boolean;
  stepOrder?: number;
}

export interface ChecklistStepRow {
  id: string;
  playbookId: string;
  stepOrder: number;
  title: string;
  instructions: string | null;
  stepType: ChecklistStepType;
  actionConfig: Record<string, any>;
  isRequired: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignChecklistStepView extends ChecklistStepRow {
  progress: {
    completedAt: Date | null;
    completedBy: string | null;
    note: string | null;
  } | null;
}

export interface CampaignChecklistView {
  playbook: {
    id: string;
    code: string;
    name: string;
    category: string;
    isOverride: boolean;
  } | null;
  steps: CampaignChecklistStepView[];
  completedCount: number;
  requiredTotal: number;
  requiredCompleted: number;
}

export interface IncompleteRequiredStep {
  id: string;
  title: string;
}

export interface SuggestionSubmitInput {
  stepId?: string | null;
  suggestionKind: SuggestionKind;
  position?: SuggestionPosition | null;
  proposedStep: Record<string, any>;
  rationale: string;
}

export interface SuggestionRow {
  id: string;
  playbookId: string;
  campaignId: string;
  stepId: string | null;
  suggestionKind: SuggestionKind;
  position: SuggestionPosition | null;
  proposedStep: Record<string, any>;
  rationale: string;
  status: SuggestionStatus;
  submittedBy: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class PlaybookChecklistService extends BaseService {
  private static instance: PlaybookChecklistService;

  private constructor() {
    super();
  }

  static getInstance(): PlaybookChecklistService {
    if (!PlaybookChecklistService.instance) {
      PlaybookChecklistService.instance = new PlaybookChecklistService();
    }
    return PlaybookChecklistService.instance;
  }

  // ─── Validation helpers ────────────────────────────────────────────────

  private validateStepType(stepType: string): asserts stepType is ChecklistStepType {
    if (!CHECKLIST_STEP_TYPES.includes(stepType as ChecklistStepType)) {
      throw new Error(
        `Invalid step_type: ${stepType}. Must be one of ${CHECKLIST_STEP_TYPES.join(', ')}`,
      );
    }
  }

  private validateSuggestionKind(kind: string): asserts kind is SuggestionKind {
    if (!SUGGESTION_KINDS.includes(kind as SuggestionKind)) {
      throw new Error(`Invalid suggestion_kind: ${kind}. Must be one of ${SUGGESTION_KINDS.join(', ')}`);
    }
  }

  private validatePosition(position: string | null | undefined): asserts position is SuggestionPosition | null {
    if (position != null && !SUGGESTION_POSITIONS.includes(position as SuggestionPosition)) {
      throw new Error(`Invalid position: ${position}. Must be one of ${SUGGESTION_POSITIONS.join(', ')} or null`);
    }
  }

  /**
   * Reject credential configs that look like they contain secret material.
   * credential_ref must be a pointer (vault path, password-manager entry name),
   * never the secret itself. See sprint plan §5.4.
   */
  private validateCredentialConfig(config: Record<string, any>): void {
    const secretKeyPattern = /^(password|passwd|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret)$/i;
    const secretValuePattern = /^(sk_|pk_|ghp_|gho_|AKIA|AIza|xox[bpoa]-|-----BEGIN)/;
    for (const [key, value] of Object.entries(config)) {
      if (secretKeyPattern.test(key)) {
        throw new Error(`Credential config field "${key}" looks like a secret — store a reference label, not the secret value`);
      }
      if (typeof value === 'string' && secretValuePattern.test(value)) {
        throw new Error(`Credential config value for "${key}" looks like a secret — store a reference label, not the secret value`);
      }
    }
  }

  private validateActionConfig(stepType: ChecklistStepType, config: Record<string, any>): void {
    if (stepType === 'credentials') {
      this.validateCredentialConfig(config);
    }
    if (stepType === 'url_check' && config.url != null) {
      const url = String(config.url);
      if (!/^https?:\/\//i.test(url)) {
        throw new Error('url_check action_config.url must be a valid http(s) URL');
      }
    }
  }

  // ─── Step CRUD (template) ──────────────────────────────────────────────

  async listSteps(playbookId: string, ctx?: RequestCtx): Promise<ChecklistStepRow[]> {
    try {
      const rows = await this.prisma.mkt_playbook_checklist_steps.findMany({
        where: { playbook_id: playbookId, is_active: true },
        orderBy: [{ step_order: 'asc' }, { created_at: 'asc' }],
      });
      return rows.map((r: any) => this.toStepRow(r));
    } catch (error) {
      logger.error('Failed to list checklist steps', ctx, { error: (error as Error).message, playbookId });
      throw this.handleError(error, ctx);
    }
  }

  async listAllSteps(playbookId: string, ctx?: RequestCtx): Promise<ChecklistStepRow[]> {
    try {
      const rows = await this.prisma.mkt_playbook_checklist_steps.findMany({
        where: { playbook_id: playbookId },
        orderBy: [{ step_order: 'asc' }, { created_at: 'asc' }],
      });
      return rows.map((r: any) => this.toStepRow(r));
    } catch (error) {
      logger.error('Failed to list all checklist steps', ctx, { error: (error as Error).message, playbookId });
      throw this.handleError(error, ctx);
    }
  }

  async createStep(playbookId: string, input: ChecklistStepInput, ctx?: RequestCtx): Promise<ChecklistStepRow> {
    this.validateStepType(input.stepType);
    const actionConfig = input.actionConfig ?? {};
    this.validateActionConfig(input.stepType, actionConfig);

    // Next step_order = max + 1 (append at end by default)
    const existing = await this.prisma.mkt_playbook_checklist_steps.findMany({
      where: { playbook_id: playbookId },
      select: { step_order: true },
      orderBy: { step_order: 'desc' },
      take: 1,
    });
    const nextOrder = (existing[0]?.step_order ?? 0) + 1;

    const id = generatePlaybookChecklistStepId();
    try {
      const row = await this.prisma.mkt_playbook_checklist_steps.create({
        data: {
          id,
          playbook_id: playbookId,
          step_order: nextOrder,
          title: input.title,
          instructions: input.instructions ?? null,
          step_type: input.stepType,
          action_config: actionConfig as any,
          is_required: input.isRequired ?? true,
          is_active: input.isActive ?? true,
        },
      });
      logger.info('Checklist step created', ctx, { stepId: id, playbookId, stepType: input.stepType });
      return this.toStepRow(row);
    } catch (error) {
      logger.error('Failed to create checklist step', ctx, { error: (error as Error).message, playbookId });
      throw this.handleError(error, ctx);
    }
  }

  async updateStep(stepId: string, input: ChecklistStepUpdateInput, ctx?: RequestCtx): Promise<ChecklistStepRow> {
    if (input.stepType) this.validateStepType(input.stepType);
    if (input.stepType && input.actionConfig) {
      this.validateActionConfig(input.stepType, input.actionConfig);
    }

    const data: any = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.instructions !== undefined) data.instructions = input.instructions;
    if (input.stepType !== undefined) data.step_type = input.stepType;
    if (input.actionConfig !== undefined) data.action_config = input.actionConfig as any;
    if (input.isRequired !== undefined) data.is_required = input.isRequired;
    if (input.isActive !== undefined) data.is_active = input.isActive;
    if (input.stepOrder !== undefined) data.step_order = input.stepOrder;

    try {
      const row = await this.prisma.mkt_playbook_checklist_steps.update({ where: { id: stepId }, data });
      logger.info('Checklist step updated', ctx, { stepId });
      return this.toStepRow(row);
    } catch (error) {
      logger.error('Failed to update checklist step', ctx, { error: (error as Error).message, stepId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Delete a step. Blocked (409) if progress rows exist — caller should
   * deactivate instead to preserve audit history. See sprint plan §6.
   */
  async deleteStep(stepId: string, ctx?: RequestCtx): Promise<void> {
    const progressCount = await this.prisma.mkt_campaign_checklist_progress.count({
      where: { step_id: stepId, completed_at: { not: null } },
    });
    if (progressCount > 0) {
      const err = new Error('Cannot delete step with completed progress — deactivate (is_active=false) instead to preserve audit history');
      (err as any).statusCode = 409;
      (err as any).code = 'step_has_progress';
      throw err;
    }
    try {
      await this.prisma.mkt_playbook_checklist_steps.delete({ where: { id: stepId } });
      logger.info('Checklist step deleted', ctx, { stepId });
    } catch (error) {
      logger.error('Failed to delete checklist step', ctx, { error: (error as Error).message, stepId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Swap step_order values (same pattern as playbook priority_rank reorder).
   */
  async reorderSteps(
    playbookId: string,
    rankings: { id: string; stepOrder: number }[],
    ctx?: RequestCtx,
  ): Promise<ChecklistStepRow[]> {
    try {
      const updated = await this.prisma.$transaction(
        rankings.map((r) =>
          this.prisma.mkt_playbook_checklist_steps.update({
            where: { id: r.id },
            data: { step_order: r.stepOrder },
          }),
        ),
      );
      logger.info('Checklist steps reordered', ctx, { playbookId, count: rankings.length });
      return updated.map((r: any) => this.toStepRow(r));
    } catch (error) {
      logger.error('Failed to reorder checklist steps', ctx, { error: (error as Error).message, playbookId });
      throw this.handleError(error, ctx);
    }
  }

  // ─── Effective playbook resolution (server-side, single source of truth) ─

  /**
   * Resolve the effective playbook for a campaign.
   * Rule: overridden_playbook_id ?? recommended_playbook_id, exposed only when
   * is_operator_accepted = true OR overridden_playbook_id IS NOT NULL.
   * Returns null if no triage decision or no triage result exists.
   */
  private async resolveEffectivePlaybook(campaignId: string, ctx?: RequestCtx): Promise<{ id: string; code: string; name: string; category: string; isOverride: boolean } | null> {
    const triage = await this.prisma.mkt_campaign_triage_results.findUnique({
      where: { campaign_id: campaignId },
      include: { playbook: true, overridden_playbook: true },
    });
    if (!triage) return null;

    // Exposed only when operator has decided (accepted OR overridden)
    const hasDecision = triage.is_operator_accepted === true || triage.overridden_playbook_id != null;
    if (!hasDecision) return null;

    const effectiveRow = triage.overridden_playbook ?? triage.playbook;
    if (!effectiveRow) return null;

    return {
      id: effectiveRow.id,
      code: effectiveRow.code,
      name: effectiveRow.name,
      category: effectiveRow.category,
      isOverride: triage.overridden_playbook_id != null,
    };
  }

  // ─── Campaign checklist (resolved view) ────────────────────────────────

  async getCampaignChecklist(campaignId: string, ctx?: RequestCtx): Promise<CampaignChecklistView> {
    const playbook = await this.resolveEffectivePlaybook(campaignId, ctx);
    if (!playbook) {
      return { playbook: null, steps: [], completedCount: 0, requiredTotal: 0, requiredCompleted: 0 };
    }

    const steps = await this.prisma.mkt_playbook_checklist_steps.findMany({
      where: { playbook_id: playbook.id, is_active: true },
      orderBy: [{ step_order: 'asc' }, { created_at: 'asc' }],
    });

    const progressRows = await this.prisma.mkt_campaign_checklist_progress.findMany({
      where: { campaign_id: campaignId },
    });
    const progressByStep = new Map(progressRows.map((p: any) => [p.step_id, p]));

    const stepViews: CampaignChecklistStepView[] = steps.map((s: any) => {
      const p = progressByStep.get(s.id);
      return {
        ...this.toStepRow(s),
        progress: p
          ? { completedAt: p.completed_at, completedBy: p.completed_by, note: p.note }
          : null,
      };
    });

    const completedCount = stepViews.filter((s) => s.progress?.completedAt != null).length;
    const requiredSteps = stepViews.filter((s) => s.isRequired);
    const requiredTotal = requiredSteps.length;
    const requiredCompleted = requiredSteps.filter((s) => s.progress?.completedAt != null).length;

    return { playbook, steps: stepViews, completedCount, requiredTotal, requiredCompleted };
  }

  /**
   * Toggle a step's completion. Validates the step belongs to the campaign's
   * CURRENT effective playbook (rejects check-offs against stale playbooks
   * after an override). See sprint plan §6.
   */
  async setStepProgress(
    campaignId: string,
    stepId: string,
    completed: boolean,
    note: string | null | undefined,
    actor: string,
    ctx?: RequestCtx,
  ): Promise<CampaignChecklistView> {
    const playbook = await this.resolveEffectivePlaybook(campaignId, ctx);
    if (!playbook) {
      const err = new Error('No effective playbook for this campaign — run triage first');
      (err as any).statusCode = 409;
      (err as any).code = 'no_effective_playbook';
      throw err;
    }

    // Validate the step belongs to the current effective playbook
    const step = await this.prisma.mkt_playbook_checklist_steps.findUnique({ where: { id: stepId } });
    if (!step || step.playbook_id !== playbook.id || !step.is_active) {
      const err = new Error('Step does not belong to the campaign current effective playbook (may be stale after override)');
      (err as any).statusCode = 409;
      (err as any).code = 'stale_step';
      throw err;
    }

    const progressId = generateCampaignChecklistProgressId();
    const completedAt = completed ? new Date() : null;
    const completedBy = completed ? actor : null;

    try {
      await this.prisma.mkt_campaign_checklist_progress.upsert({
        where: { campaign_id_step_id: { campaign_id: campaignId, step_id: stepId } },
        create: {
          id: progressId,
          campaign_id: campaignId,
          step_id: stepId,
          completed_at: completedAt,
          completed_by: completedBy,
          note: note ?? null,
        },
        update: {
          completed_at: completedAt,
          completed_by: completedBy,
          ...(note !== undefined ? { note } : {}),
        },
      });
      logger.info('Checklist progress toggled', ctx, { campaignId, stepId, completed, actor });
      return this.getCampaignChecklist(campaignId, ctx);
    } catch (error) {
      logger.error('Failed to set checklist progress', ctx, { error: (error as Error).message, campaignId, stepId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Incomplete required steps for the soft gate. Consumed by the transition route.
   */
  async getIncompleteRequiredSteps(campaignId: string, ctx?: RequestCtx): Promise<IncompleteRequiredStep[]> {
    const view = await this.getCampaignChecklist(campaignId, ctx);
    if (!view.playbook) return [];
    return view.steps
      .filter((s) => s.isRequired && (s.progress?.completedAt == null))
      .map((s) => ({ id: s.id, title: s.title }));
  }

  // ─── Suggestions (operator feedback loop) ──────────────────────────────

  async submitSuggestion(
    campaignId: string,
    input: SuggestionSubmitInput,
    actor: string,
    ctx?: RequestCtx,
  ): Promise<SuggestionRow> {
    this.validateSuggestionKind(input.suggestionKind);
    this.validatePosition(input.position);

    const playbook = await this.resolveEffectivePlaybook(campaignId, ctx);
    if (!playbook) {
      const err = new Error('No effective playbook for this campaign — cannot suggest on a playbook that is not assigned');
      (err as any).statusCode = 409;
      (err as any).code = 'no_effective_playbook';
      throw err;
    }

    if (!input.rationale || !input.rationale.trim()) {
      throw new Error('Rationale is required — a suggestion without a why is unreviewable');
    }

    // Validate step_id anchor for modify/remove/supersede/before/after
    if (input.stepId) {
      const step = await this.prisma.mkt_playbook_checklist_steps.findUnique({ where: { id: input.stepId } });
      if (!step || step.playbook_id !== playbook.id) {
        throw new Error('Anchor step_id does not belong to the campaign effective playbook');
      }
    }
    if ((input.suggestionKind === 'modify' || input.suggestionKind === 'remove') && !input.stepId) {
      throw new Error(`${input.suggestionKind} suggestion requires a step_id anchor`);
    }
    if (input.suggestionKind === 'add' && input.position && !input.stepId) {
      throw new Error(`${input.position} position requires a step_id anchor`);
    }

    const id = generatePlaybookChecklistSuggestionId();
    try {
      const row = await this.prisma.mkt_playbook_checklist_suggestions.create({
        data: {
          id,
          playbook_id: playbook.id,
          campaign_id: campaignId,
          step_id: input.stepId ?? null,
          suggestion_kind: input.suggestionKind,
          position: input.position ?? null,
          proposed_step: input.proposedStep as any,
          rationale: input.rationale,
          status: 'pending',
          submitted_by: actor,
        },
      });
      logger.info('Checklist suggestion submitted', ctx, { suggestionId: id, campaignId, playbookId: playbook.id, kind: input.suggestionKind });
      return this.toSuggestionRow(row);
    } catch (error) {
      logger.error('Failed to submit checklist suggestion', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async listCampaignSuggestions(campaignId: string, ctx?: RequestCtx): Promise<SuggestionRow[]> {
    try {
      const rows = await this.prisma.mkt_playbook_checklist_suggestions.findMany({
        where: { campaign_id: campaignId },
        orderBy: { created_at: 'desc' },
      });
      return rows.map((r: any) => this.toSuggestionRow(r));
    } catch (error) {
      logger.error('Failed to list campaign checklist suggestions', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async listPlaybookSuggestions(
    playbookId: string,
    status?: SuggestionStatus,
    ctx?: RequestCtx,
  ): Promise<SuggestionRow[]> {
    const where: any = { playbook_id: playbookId };
    if (status) where.status = status;
    try {
      const rows = await this.prisma.mkt_playbook_checklist_suggestions.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
      return rows.map((r: any) => this.toSuggestionRow(r));
    } catch (error) {
      logger.error('Failed to list playbook checklist suggestions', ctx, { error: (error as Error).message, playbookId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Accept a suggestion — applies it to the template in one transaction.
   * Admin may amend proposedStep before accepting. See sprint plan §6.
   *
   * Semantics:
   *   add + before/after → insert adjacent to anchor (shifts later step_order)
   *   add + null position → append at end
   *   add + supersede → insert at anchor step_order, deactivate anchor
   *   modify → apply sparse patch to target; 409 if target changed since submission
   *   remove → deactivate target (audit-preserving)
   */
  async acceptSuggestion(
    suggestionId: string,
    amendedStep: Record<string, any> | null | undefined,
    reviewer: string,
    ctx?: RequestCtx,
  ): Promise<SuggestionRow> {
    const suggestion = await this.prisma.mkt_playbook_checklist_suggestions.findUnique({
      where: { id: suggestionId },
    });
    if (!suggestion) throw new NotFoundError('Suggestion not found');
    if (suggestion.status !== 'pending') {
      throw new Error(`Suggestion is already ${suggestion.status}`);
    }

    const proposedStep = amendedStep ?? (suggestion.proposed_step as any);
    const playbookId = suggestion.playbook_id;
    const stepId = suggestion.step_id;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (suggestion.suggestion_kind === 'add') {
          await this.applyAddSuggestion(tx, playbookId, stepId, suggestion.position, proposedStep);
        } else if (suggestion.suggestion_kind === 'modify') {
          await this.applyModifySuggestion(tx, stepId, proposedStep, suggestion.updated_at);
        } else if (suggestion.suggestion_kind === 'remove') {
          await this.applyRemoveSuggestion(tx, stepId);
        }
        await tx.mkt_playbook_checklist_suggestions.update({
          where: { id: suggestionId },
          data: {
            status: 'accepted',
            reviewed_by: reviewer,
            reviewed_at: new Date(),
            proposed_step: proposedStep as any,
          },
        });
      });
      logger.info('Checklist suggestion accepted', ctx, { suggestionId, reviewer, kind: suggestion.suggestion_kind });
      const updated = await this.prisma.mkt_playbook_checklist_suggestions.findUnique({ where: { id: suggestionId } });
      return this.toSuggestionRow(updated);
    } catch (error) {
      logger.error('Failed to accept checklist suggestion', ctx, { error: (error as Error).message, suggestionId });
      throw error;
    }
  }

  private async applyAddSuggestion(
    tx: any,
    playbookId: string,
    anchorStepId: string | null,
    position: string | null,
    proposedStep: Record<string, any>,
  ): Promise<void> {
    const newId = generatePlaybookChecklistStepId();
    const stepType = proposedStep.stepType ?? proposedStep.step_type ?? 'manual';
    this.validateStepType(stepType);
    const actionConfig = proposedStep.actionConfig ?? proposedStep.action_config ?? {};
    this.validateActionConfig(stepType as ChecklistStepType, actionConfig);

    if (!anchorStepId || !position) {
      // Append at end
      const existing = await tx.mkt_playbook_checklist_steps.findMany({
        where: { playbook_id: playbookId },
        select: { step_order: true },
        orderBy: { step_order: 'desc' },
        take: 1,
      });
      const nextOrder = (existing[0]?.step_order ?? 0) + 1;
      await tx.mkt_playbook_checklist_steps.create({
        data: {
          id: newId,
          playbook_id: playbookId,
          step_order: nextOrder,
          title: proposedStep.title,
          instructions: proposedStep.instructions ?? null,
          step_type: stepType,
          action_config: actionConfig,
          is_required: proposedStep.isRequired ?? proposedStep.is_required ?? true,
          is_active: true,
        },
      });
      return;
    }

    const anchor = await tx.mkt_playbook_checklist_steps.findUnique({ where: { id: anchorStepId } });
    if (!anchor) throw new NotFoundError('Anchor step not found (may have been deleted)');

    if (position === 'supersede') {
      // Insert new step at anchor's step_order, deactivate anchor
      await tx.mkt_playbook_checklist_steps.create({
        data: {
          id: newId,
          playbook_id: playbookId,
          step_order: anchor.step_order,
          title: proposedStep.title,
          instructions: proposedStep.instructions ?? null,
          step_type: stepType,
          action_config: actionConfig,
          is_required: proposedStep.isRequired ?? proposedStep.is_required ?? true,
          is_active: true,
        },
      });
      await tx.mkt_playbook_checklist_steps.update({
        where: { id: anchorStepId },
        data: { is_active: false },
      });
      return;
    }

    // before / after: shift later steps, insert adjacent
    const insertOrder = position === 'before' ? anchor.step_order : anchor.step_order + 1;
    await tx.mkt_playbook_checklist_steps.updateMany({
      where: { playbook_id: playbookId, step_order: { gte: insertOrder } },
      data: { step_order: { increment: 1 } },
    });
    await tx.mkt_playbook_checklist_steps.create({
      data: {
        id: newId,
        playbook_id: playbookId,
        step_order: insertOrder,
        title: proposedStep.title,
        instructions: proposedStep.instructions ?? null,
        step_type: stepType,
        action_config: actionConfig,
        is_required: proposedStep.isRequired ?? proposedStep.is_required ?? true,
        is_active: true,
      },
    });
  }

  private async applyModifySuggestion(
    tx: any,
    stepId: string | null,
    proposedStep: Record<string, any>,
    submittedAt: Date,
  ): Promise<void> {
    if (!stepId) throw new Error('modify suggestion requires step_id');
    const target = await tx.mkt_playbook_checklist_steps.findUnique({ where: { id: stepId } });
    if (!target) throw new NotFoundError('Target step not found (may have been deleted)');
    if (!target.is_active) {
      const err = new Error('Target step is deactivated — re-review against current state');
      (err as any).statusCode = 409;
      (err as any).code = 'suggestion_stale';
      throw err;
    }
    // Stale guard: if target was edited after suggestion was submitted
    if (target.updated_at > submittedAt) {
      const err = new Error('Target step changed since suggestion was submitted — re-review against current state');
      (err as any).statusCode = 409;
      (err as any).code = 'suggestion_stale';
      (err as any).currentValues = {
        title: target.title,
        instructions: target.instructions,
        stepType: target.step_type,
        actionConfig: target.action_config,
        isRequired: target.is_required,
      };
      throw err;
    }

    const data: any = {};
    if (proposedStep.title !== undefined) data.title = proposedStep.title;
    if (proposedStep.instructions !== undefined) data.instructions = proposedStep.instructions;
    if (proposedStep.stepType !== undefined) {
      this.validateStepType(proposedStep.stepType);
      data.step_type = proposedStep.stepType;
    } else if (proposedStep.step_type !== undefined) {
      this.validateStepType(proposedStep.step_type);
      data.step_type = proposedStep.step_type;
    }
    if (proposedStep.actionConfig !== undefined) {
      data.action_config = proposedStep.actionConfig;
    } else if (proposedStep.action_config !== undefined) {
      data.action_config = proposedStep.action_config;
    }
    if (proposedStep.isRequired !== undefined) data.is_required = proposedStep.isRequired;
    else if (proposedStep.is_required !== undefined) data.is_required = proposedStep.is_required;

    if (data.step_type && data.action_config) {
      this.validateActionConfig(data.step_type, data.action_config);
    }

    await tx.mkt_playbook_checklist_steps.update({ where: { id: stepId }, data });
  }

  private async applyRemoveSuggestion(tx: any, stepId: string | null): Promise<void> {
    if (!stepId) throw new Error('remove suggestion requires step_id');
    const target = await tx.mkt_playbook_checklist_steps.findUnique({ where: { id: stepId } });
    if (!target) throw new NotFoundError('Target step not found (may have been deleted)');
    // Deactivate (not delete) to preserve audit trail + existing progress
    await tx.mkt_playbook_checklist_steps.update({
      where: { id: stepId },
      data: { is_active: false },
    });
  }

  async rejectSuggestion(
    suggestionId: string,
    reviewNote: string | null | undefined,
    reviewer: string,
    ctx?: RequestCtx,
  ): Promise<SuggestionRow> {
    const suggestion = await this.prisma.mkt_playbook_checklist_suggestions.findUnique({
      where: { id: suggestionId },
    });
    if (!suggestion) throw new NotFoundError('Suggestion not found');
    if (suggestion.status !== 'pending') {
      throw new Error(`Suggestion is already ${suggestion.status}`);
    }
    try {
      const updated = await this.prisma.mkt_playbook_checklist_suggestions.update({
        where: { id: suggestionId },
        data: {
          status: 'rejected',
          reviewed_by: reviewer,
          reviewed_at: new Date(),
          review_note: reviewNote ?? null,
        },
      });
      logger.info('Checklist suggestion rejected', ctx, { suggestionId, reviewer });
      return this.toSuggestionRow(updated);
    } catch (error) {
      logger.error('Failed to reject checklist suggestion', ctx, { error: (error as Error).message, suggestionId });
      throw this.handleError(error, ctx);
    }
  }

  // ─── Mappers ───────────────────────────────────────────────────────────

  private toStepRow(r: any): ChecklistStepRow {
    return {
      id: r.id,
      playbookId: r.playbook_id,
      stepOrder: r.step_order,
      title: r.title,
      instructions: r.instructions,
      stepType: r.step_type as ChecklistStepType,
      actionConfig: (r.action_config ?? {}) as Record<string, any>,
      isRequired: r.is_required,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private toSuggestionRow(r: any): SuggestionRow {
    return {
      id: r.id,
      playbookId: r.playbook_id,
      campaignId: r.campaign_id,
      stepId: r.step_id,
      suggestionKind: r.suggestion_kind as SuggestionKind,
      position: r.position as SuggestionPosition | null,
      proposedStep: (r.proposed_step ?? {}) as Record<string, any>,
      rationale: r.rationale,
      status: r.status as SuggestionStatus,
      submittedBy: r.submitted_by,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
      reviewNote: r.review_note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export default PlaybookChecklistService.getInstance();
