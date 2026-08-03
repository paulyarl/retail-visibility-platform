/**
 * MarketingSignalRegistryService — CRUD for the signal registry
 *
 * Manages the `mkt_signal_registry` table: signal codes as DATA so admins
 * can register future unknown signals without an engine deploy. Every write
 * invalidates the in-process signal taxonomy cache so the extractor and
 * engine see the new codes immediately.
 *
 * detection_source tells the extractor how the signal is produced:
 *   model_emitted  — audit LLM output includes the code in audit_signals[]
 *   derived        — computed from raw audit/campaign fields by code (thresholds)
 *   operator_input — manually supplied (e.g. BBB pre-flight inputs)
 *
 * Pattern: singleton extends BaseService (mirrors MarketingPlaybookCatalogService).
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md
 * Sprint 3 — Admin API (signal registry CRUD).
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError } from '../middleware/errorHandler';
import { generateSignalRegistryId } from '../lib/id-generator';
import { invalidateSignalRegistryCache, type SignalRegistryRow, type DetectionSource } from './triage/signal-taxonomy';

// ─── Inputs ──────────────────────────────────────────────────────────────

export interface SignalCreateInput {
  code: string;
  family: string;
  label: string;
  description?: string;
  detectionSource?: DetectionSource;
  derivedRule?: { field: string; op: string; threshold: number | boolean } | null;
  isActive?: boolean;
}

export interface SignalUpdateInput {
  family?: string;
  label?: string;
  description?: string | null;
  detectionSource?: DetectionSource;
  derivedRule?: { field: string; op: string; threshold: number | boolean } | null;
  isActive?: boolean;
}

export interface SignalListFilters {
  family?: string;
  isActive?: boolean;
  detectionSource?: DetectionSource;
}

// ─── Validation ──────────────────────────────────────────────────────────

const CODE_PATTERN = /^[A-Z]{2}_[A-Z0-9_]+$/;

function validateCode(code: string): void {
  if (!CODE_PATTERN.test(code)) {
    throw new Error(
      `Invalid signal code: "${code}". Must match FAMILY_UPPER_SNAKE (e.g. RA_REVIEW_DROUGHT).`,
    );
  }
}

function validateDetectionSource(source: string): asserts source is DetectionSource {
  if (!['model_emitted', 'derived', 'operator_input'].includes(source)) {
    throw new Error(
      `Invalid detection_source: "${source}". Must be one of model_emitted, derived, operator_input.`,
    );
  }
}

// ─── Service ─────────────────────────────────────────────────────────────

export class MarketingSignalRegistryService extends BaseService {
  private static instance: MarketingSignalRegistryService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingSignalRegistryService {
    if (!MarketingSignalRegistryService.instance) {
      MarketingSignalRegistryService.instance = new MarketingSignalRegistryService();
    }
    return MarketingSignalRegistryService.instance;
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────

  async createSignal(input: SignalCreateInput, ctx?: RequestCtx): Promise<SignalRegistryRow> {
    validateCode(input.code);
    if (input.detectionSource) validateDetectionSource(input.detectionSource);

    const id = generateSignalRegistryId();
    try {
      const row = await this.prisma.mkt_signal_registry.create({
        data: {
          id,
          code: input.code,
          family: input.family,
          label: input.label,
          description: input.description ?? null,
          detection_source: input.detectionSource ?? 'model_emitted',
          derived_rule: (input.derivedRule ?? null) as any,
          is_active: input.isActive ?? true,
        },
      });
      invalidateSignalRegistryCache();
      logger.info('Signal registered', ctx, { signalId: id, code: input.code });
      return this.toRow(row);
    } catch (error) {
      logger.error('Failed to register signal', ctx, { error: (error as Error).message, code: input.code });
      throw this.handleError(error, ctx);
    }
  }

  async getSignal(id: string, ctx?: RequestCtx): Promise<SignalRegistryRow> {
    try {
      const row = await this.prisma.mkt_signal_registry.findUnique({ where: { id } });
      if (!row) throw new NotFoundError('Signal not found');
      return this.toRow(row);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get signal', ctx, { error: (error as Error).message, signalId: id });
      throw this.handleError(error, ctx);
    }
  }

  async getSignalByCode(code: string, ctx?: RequestCtx): Promise<SignalRegistryRow> {
    try {
      const row = await this.prisma.mkt_signal_registry.findUnique({ where: { code } });
      if (!row) throw new NotFoundError(`Signal ${code} not found`);
      return this.toRow(row);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get signal by code', ctx, { error: (error as Error).message, code });
      throw this.handleError(error, ctx);
    }
  }

  async listSignals(filters: SignalListFilters = {}, ctx?: RequestCtx): Promise<SignalRegistryRow[]> {
    const where: any = {};
    if (filters.family) where.family = filters.family;
    if (filters.isActive !== undefined) where.is_active = filters.isActive;
    if (filters.detectionSource) where.detection_source = filters.detectionSource;
    try {
      const rows = await this.prisma.mkt_signal_registry.findMany({
        where,
        orderBy: [{ family: 'asc' }, { code: 'asc' }],
      });
      return rows.map((r) => this.toRow(r));
    } catch (error) {
      logger.error('Failed to list signals', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updateSignal(id: string, input: SignalUpdateInput, ctx?: RequestCtx): Promise<SignalRegistryRow> {
    if (input.detectionSource) validateDetectionSource(input.detectionSource);

    const data: any = {};
    if (input.family !== undefined) data.family = input.family;
    if (input.label !== undefined) data.label = input.label;
    if (input.description !== undefined) data.description = input.description;
    if (input.detectionSource !== undefined) data.detection_source = input.detectionSource;
    if (input.derivedRule !== undefined) data.derived_rule = input.derivedRule as any;
    if (input.isActive !== undefined) data.is_active = input.isActive;

    try {
      const row = await this.prisma.mkt_signal_registry.update({ where: { id }, data });
      invalidateSignalRegistryCache();
      logger.info('Signal updated', ctx, { signalId: id });
      return this.toRow(row);
    } catch (error) {
      logger.error('Failed to update signal', ctx, { error: (error as Error).message, signalId: id });
      throw this.handleError(error, ctx);
    }
  }

  async deleteSignal(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_signal_registry.delete({ where: { id } });
      invalidateSignalRegistryCache();
      logger.info('Signal deleted', ctx, { signalId: id });
    } catch (error) {
      logger.error('Failed to delete signal', ctx, { error: (error as Error).message, signalId: id });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Toggle is_active. Called by the /signals/:id/activate route.
   */
  async setSignalActive(id: string, isActive: boolean, ctx?: RequestCtx): Promise<SignalRegistryRow> {
    try {
      const row = await this.prisma.mkt_signal_registry.update({
        where: { id },
        data: { is_active: isActive },
      });
      invalidateSignalRegistryCache();
      logger.info('Signal activation toggled', ctx, { signalId: id, isActive });
      return this.toRow(row);
    } catch (error) {
      logger.error('Failed to toggle signal active', ctx, { error: (error as Error).message, signalId: id });
      throw this.handleError(error, ctx);
    }
  }

  // ─── Mapper ────────────────────────────────────────────────────────────

  private toRow(r: any): SignalRegistryRow {
    return {
      id: r.id,
      code: r.code,
      family: r.family,
      label: r.label,
      description: r.description,
      detectionSource: r.detection_source as DetectionSource,
      derivedRule: r.derived_rule ?? null,
      isActive: r.is_active,
    };
  }
}

export default MarketingSignalRegistryService.getInstance();
