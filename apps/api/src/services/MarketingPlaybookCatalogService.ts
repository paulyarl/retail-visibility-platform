/**
 * MarketingPlaybookCatalogService — CRUD for the standard playbook catalog
 *
 * Manages the six standard playbooks (PB-01..PB-06) plus any admin-created
 * playbooks. Each playbook maps an archetype + category to a FITD offer,
 * retainer pitch, preview deliverable type, and a matching_rules DSL entry
 * that the generic triage engine evaluates against SignalCode[] sets.
 *
 * The cascade order lives in the catalog's `priority_rank` column (Sprint 2A);
 * the engine is a generic set-membership evaluator, not a hardcoded if/else.
 *
 * Pattern: singleton extends BaseService (mirrors MarketingScorecardService).
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md §3
 * Sprint 3 — Admin API.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError } from '../middleware/errorHandler';
import { generatePlaybookCatalogId } from '../lib/id-generator';
import type {
  PlaybookCode,
  PlaybookCategory,
  ArchetypeCodeWithA6,
  PlaybookCatalogRow,
  MatchingRules,
} from './triage/types';
import { PLAYBOOK_CODES, PLAYBOOK_CATEGORIES, ARCHETYPE_LABELS } from './triage/types';

// ─── Inputs ──────────────────────────────────────────────────────────────

export interface PlaybookCreateInput {
  code: PlaybookCode;
  name: string;
  category: PlaybookCategory;
  archetype: ArchetypeCodeWithA6;
  description?: string;
  matchingRules?: MatchingRules;
  priorityRank?: number;
  fitdOfferTitle: string;
  fitdDefaultFeeCents: number;
  retainerPitchTitle: string;
  retainerFeeCents: number;
  openerPromptTemplateId?: string;
  previewDeliverableType?: string;
  isActive?: boolean;
}

export interface PlaybookUpdateInput {
  name?: string;
  category?: PlaybookCategory;
  archetype?: ArchetypeCodeWithA6;
  description?: string | null;
  matchingRules?: MatchingRules;
  priorityRank?: number;
  fitdOfferTitle?: string;
  fitdDefaultFeeCents?: number;
  retainerPitchTitle?: string;
  retainerFeeCents?: number;
  openerPromptTemplateId?: string | null;
  previewDeliverableType?: string | null;
  isActive?: boolean;
}

export interface PlaybookListFilters {
  category?: PlaybookCategory;
  archetype?: ArchetypeCodeWithA6;
  isActive?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class MarketingPlaybookCatalogService extends BaseService {
  private static instance: MarketingPlaybookCatalogService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingPlaybookCatalogService {
    if (!MarketingPlaybookCatalogService.instance) {
      MarketingPlaybookCatalogService.instance = new MarketingPlaybookCatalogService();
    }
    return MarketingPlaybookCatalogService.instance;
  }

  // ─── Validation helpers ────────────────────────────────────────────────

  private validateCode(code: string): asserts code is PlaybookCode {
    if (!PLAYBOOK_CODES.includes(code as PlaybookCode)) {
      throw new Error(`Invalid playbook code: ${code}. Must be one of ${PLAYBOOK_CODES.join(', ')}`);
    }
  }

  private validateCategory(category: string): asserts category is PlaybookCategory {
    if (!PLAYBOOK_CATEGORIES.includes(category as PlaybookCategory)) {
      throw new Error(`Invalid playbook category: ${category}. Must be one of ${PLAYBOOK_CATEGORIES.join(', ')}`);
    }
  }

  private validateArchetype(archetype: string): asserts archetype is ArchetypeCodeWithA6 {
    if (!ARCHETYPE_LABELS[archetype as ArchetypeCodeWithA6]) {
      throw new Error(`Invalid archetype: ${archetype}. Must be one of ${Object.keys(ARCHETYPE_LABELS).join(', ')}`);
    }
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────

  async createPlaybook(input: PlaybookCreateInput, ctx?: RequestCtx): Promise<PlaybookCatalogRow> {
    this.validateCode(input.code);
    this.validateCategory(input.category);
    this.validateArchetype(input.archetype);

    const id = generatePlaybookCatalogId();
    try {
      const row = await this.prisma.mkt_playbook_catalog.create({
        data: {
          id,
          code: input.code,
          name: input.name,
          category: input.category,
          archetype: input.archetype,
          archetype_label: ARCHETYPE_LABELS[input.archetype],
          description: input.description ?? null,
          matching_rules: (input.matchingRules ?? {
            any: [],
            all: [],
            none: [],
            dual: null,
            confidence: 0,
          }) as any,
          priority_rank: input.priorityRank ?? 99,
          fitd_offer_title: input.fitdOfferTitle,
          fitd_default_fee_cents: input.fitdDefaultFeeCents,
          retainer_pitch_title: input.retainerPitchTitle,
          retainer_fee_cents: input.retainerFeeCents,
          opener_prompt_template_id: input.openerPromptTemplateId ?? null,
          preview_deliverable_type: input.previewDeliverableType ?? null,
          is_active: input.isActive ?? true,
        },
      });
      logger.info('Playbook created', ctx, { playbookId: id, code: input.code });
      return this.toRow(row);
    } catch (error) {
      logger.error('Failed to create playbook', ctx, { error: (error as Error).message, code: input.code });
      throw this.handleError(error, ctx);
    }
  }

  async getPlaybook(id: string, ctx?: RequestCtx): Promise<PlaybookCatalogRow> {
    try {
      const row = await this.prisma.mkt_playbook_catalog.findUnique({ where: { id } });
      if (!row) throw new NotFoundError('Playbook not found');
      return this.toRow(row);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get playbook', ctx, { error: (error as Error).message, playbookId: id });
      throw this.handleError(error, ctx);
    }
  }

  async getPlaybookByCode(code: PlaybookCode, ctx?: RequestCtx): Promise<PlaybookCatalogRow> {
    try {
      const row = await this.prisma.mkt_playbook_catalog.findUnique({ where: { code } });
      if (!row) throw new NotFoundError(`Playbook ${code} not found`);
      return this.toRow(row);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get playbook by code', ctx, { error: (error as Error).message, code });
      throw this.handleError(error, ctx);
    }
  }

  async listPlaybooks(filters: PlaybookListFilters = {}, ctx?: RequestCtx): Promise<PlaybookCatalogRow[]> {
    const where: any = {};
    if (filters.category) where.category = filters.category;
    if (filters.archetype) where.archetype = filters.archetype;
    if (filters.isActive !== undefined) where.is_active = filters.isActive;
    try {
      const rows = await this.prisma.mkt_playbook_catalog.findMany({
        where,
        orderBy: [{ priority_rank: 'asc' }, { code: 'asc' }],
      });
      return rows.map((r) => this.toRow(r));
    } catch (error) {
      logger.error('Failed to list playbooks', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Load active playbooks ordered by priority_rank ascending — the cascade
   * order the generic triage engine evaluates. Used by CampaignTriageService.
   */
  async listActivePlaybooksOrdered(ctx?: RequestCtx): Promise<PlaybookCatalogRow[]> {
    return this.listPlaybooks({ isActive: true }, ctx);
  }

  /**
   * Bulk-update priority_rank for multiple playbooks — the cascade reorder
   * affordance for the admin table (Sprint 3 route + Sprint 4 UI).
   * Accepts a map of playbookId → new priority_rank and applies them in a
   * transaction. Caller is responsible for validating no duplicate ranks.
   */
  async reorderPlaybooks(
    rankings: { id: string; priorityRank: number }[],
    ctx?: RequestCtx,
  ): Promise<PlaybookCatalogRow[]> {
    try {
      const updated = await this.prisma.$transaction(
        rankings.map((r) =>
          this.prisma.mkt_playbook_catalog.update({
            where: { id: r.id },
            data: { priority_rank: r.priorityRank },
          }),
        ),
      );
      logger.info('Playbooks reordered', ctx, { count: rankings.length });
      return updated.map((r) => this.toRow(r));
    } catch (error) {
      logger.error('Failed to reorder playbooks', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updatePlaybook(id: string, input: PlaybookUpdateInput, ctx?: RequestCtx): Promise<PlaybookCatalogRow> {
    if (input.category) this.validateCategory(input.category);
    if (input.archetype) this.validateArchetype(input.archetype);

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.archetype !== undefined) {
      data.archetype = input.archetype;
      data.archetype_label = ARCHETYPE_LABELS[input.archetype];
    }
    if (input.description !== undefined) data.description = input.description;
    if (input.matchingRules !== undefined) data.matching_rules = input.matchingRules as any;
    if (input.priorityRank !== undefined) data.priority_rank = input.priorityRank;
    if (input.fitdOfferTitle !== undefined) data.fitd_offer_title = input.fitdOfferTitle;
    if (input.fitdDefaultFeeCents !== undefined) data.fitd_default_fee_cents = input.fitdDefaultFeeCents;
    if (input.retainerPitchTitle !== undefined) data.retainer_pitch_title = input.retainerPitchTitle;
    if (input.retainerFeeCents !== undefined) data.retainer_fee_cents = input.retainerFeeCents;
    if (input.openerPromptTemplateId !== undefined) data.opener_prompt_template_id = input.openerPromptTemplateId;
    if (input.previewDeliverableType !== undefined) data.preview_deliverable_type = input.previewDeliverableType;
    if (input.isActive !== undefined) data.is_active = input.isActive;

    try {
      const row = await this.prisma.mkt_playbook_catalog.update({ where: { id }, data });
      logger.info('Playbook updated', ctx, { playbookId: id });
      return this.toRow(row);
    } catch (error) {
      logger.error('Failed to update playbook', ctx, { error: (error as Error).message, playbookId: id });
      throw this.handleError(error, ctx);
    }
  }

  async deletePlaybook(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_playbook_catalog.delete({ where: { id } });
      logger.info('Playbook deleted', ctx, { playbookId: id });
    } catch (error) {
      logger.error('Failed to delete playbook', ctx, { error: (error as Error).message, playbookId: id });
      throw this.handleError(error, ctx);
    }
  }

  // ─── Mapper ────────────────────────────────────────────────────────────

  private toRow(r: any): PlaybookCatalogRow {
    return {
      id: r.id,
      code: r.code as PlaybookCode,
      name: r.name,
      category: r.category as PlaybookCategory,
      archetype: r.archetype as ArchetypeCodeWithA6,
      archetypeLabel: r.archetype_label,
      description: r.description,
      matchingRules: (r.matching_rules ?? {
        any: [],
        all: [],
        none: [],
        dual: null,
        confidence: 0,
      }) as MatchingRules,
      priorityRank: r.priority_rank ?? 99,
      fitdOfferTitle: r.fitd_offer_title,
      fitdDefaultFeeCents: r.fitd_default_fee_cents,
      retainerPitchTitle: r.retainer_pitch_title,
      retainerFeeCents: r.retainer_fee_cents,
      openerPromptTemplateId: r.opener_prompt_template_id,
      previewDeliverableType: r.preview_deliverable_type,
      isActive: r.is_active,
    };
  }
}

export default MarketingPlaybookCatalogService.getInstance();
