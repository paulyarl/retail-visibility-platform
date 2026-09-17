/**
 * Manual Outreach Script Service
 *
 * Backend for the Manual tab on the outreach openers workspace — the
 * operator playground / producer lane. Operators pick a code-defined
 * template (manual-play-templates.ts), edit field slots + script body,
 * and save a working doc per campaign (mkt_campaign_manual_scripts,
 * migration 287). Docs reload whenever the campaign is selected and can
 * be re-edited freely — unlike anchors, they are not lifecycle-frozen.
 *
 * Promotion into the shared pipeline is done by the frontend calling the
 * existing write endpoints (importOpener / importHeader / importCloser /
 * createCampaignAnchor) and stamping the produced row id back via
 * `promoted_*` columns — the other tabs consume those rows unchanged.
 *
 * Merge resolution happens at READ time ({{business}}, {{category}},
 * {{claim_url}}, field keys …) so persisted text never goes stale.
 * Merge behavior mirrors CallScriptService.resolveMerge — unresolvable
 * placeholders stay visible, never fabricated.
 *
 * Pattern: singleton extends BaseService
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import { audit } from '../audit';
import type { RequestCtx } from '../context';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import MarketingCampaignService from './MarketingCampaignService';
import CampaignTriageService from './CampaignTriageService';
import OutreachIntelligenceService, {
  resolveSalutation,
} from './OutreachIntelligenceService';
import {
  generateManualScriptId,
  generateManualPlayTemplateId,
} from '../lib/id-generator';
import { MANUAL_ANCHOR_TYPES } from './intelligence/ManualOutreachAnchorService';
import {
  getManualPlayTemplate,
  MANUAL_PLAY_TEMPLATES,
  type ManualFieldRole,
  type ManualPlayField,
  type ManualPlayTemplate,
} from './outreach-openers/manual-play-templates';
import { HOOK_ANGLE_KEYS } from './outreach-openers/hook-library';
import {
  buildOutreachLinkVars,
  resolveCampaignSeedId,
} from './outreach-openers/outreach-link-vars';

export type { ManualPlayTemplate };

// ─── Types ──────────────────────────────────────────────────────────────

export interface ManualScriptView {
  id: string;
  campaign_id: string;
  template_key: string;
  title: string;
  fields: Record<string, string>;
  script_body: string;
  promoted_opener_id: string | null;
  promoted_anchor_id: string | null;
  promoted_header_id: string | null;
  promoted_closer_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_fields: Record<string, string>;
  resolved_body: string;
}

export interface ManualScriptUpsertInput {
  template_key: string;
  title?: string;
  fields?: Record<string, string>;
  script_body?: string;
  promoted_opener_id?: string | null;
  promoted_anchor_id?: string | null;
  promoted_header_id?: string | null;
  promoted_closer_id?: string | null;
}

export type ManualTemplateSource = 'catalog' | 'operator';
export type ManualTemplateStatus = 'active' | 'archived';

export interface ManualTemplateListItem extends ManualPlayTemplate {
  suggested: boolean;
  saved: boolean;
  source: ManualTemplateSource;
  status?: ManualTemplateStatus;
}

/**
 * Create/update body for operator-authored templates ("Save as template").
 * `key` is optional on create — server-slugged from label when omitted.
 */
export interface ManualPlayTemplateInput {
  key?: string;
  label: string;
  description: string;
  anchor_type?: string;
  hook_angle?: string | null;
  suggested_when_signal?: string | null;
  fields: ManualPlayField[];
  script_body: string;
  /** Update/archive only — 'active' | 'archived'. Ignored on create. */
  status?: ManualTemplateStatus;
  created_from_campaign_id?: string | null;
  created_from_template_key?: string | null;
}

export interface ManualPlayTemplateRow {
  id: string;
  key: string;
  label: string;
  description: string;
  anchor_type: string;
  hook_angle: string | null;
  suggested_when_signal: string | null;
  fields: ManualPlayField[];
  script_body: string;
  status: ManualTemplateStatus;
  created_from_campaign_id: string | null;
  created_from_template_key: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ManualPlayTemplateDbRow {
  id: string;
  key: string;
  label: string;
  description: string;
  anchor_type: string;
  hook_angle: string | null;
  suggested_when_signal: string | null;
  fields: ManualPlayField[] | null;
  script_body: string;
  status: string;
  created_from_campaign_id: string | null;
  created_from_template_key: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

const MANUAL_FIELD_ROLES = new Set<ManualFieldRole>([
  'opener',
  'header',
  'closer',
  'thesis',
  'note',
]);

const TEMPLATE_KEY_PATTERN = /^op_[a-z0-9][a-z0-9_]{1,76}$/;
const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const HOOK_ANGLE_SET = new Set<string>(HOOK_ANGLE_KEYS);

interface ManualScriptRow {
  id: string;
  campaign_id: string;
  template_key: string;
  title: string;
  fields: Record<string, string> | null;
  script_body: string;
  promoted_opener_id: string | null;
  promoted_anchor_id: string | null;
  promoted_header_id: string | null;
  promoted_closer_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

// ─── Service ────────────────────────────────────────────────────────────

export class ManualOutreachScriptService extends BaseService {
  private static instance: ManualOutreachScriptService;

  private constructor() {
    super();
  }

  static getInstance(): ManualOutreachScriptService {
    if (!ManualOutreachScriptService.instance) {
      ManualOutreachScriptService.instance = new ManualOutreachScriptService();
    }
    return ManualOutreachScriptService.instance;
  }

  /**
   * List all saved manual scripts for a campaign, merge-resolved.
   */
  async listForCampaign(campaignId: string, ctx?: RequestCtx): Promise<ManualScriptView[]> {
    const rows = await this.prisma.$queryRawUnsafe<ManualScriptRow[]>(
      `SELECT * FROM mkt_campaign_manual_scripts
       WHERE campaign_id = $1
       ORDER BY updated_at DESC`,
      campaignId,
    );
    if (rows.length === 0) return [];

    const mergeContext = await this.buildMergeContext(campaignId, ctx);
    return rows.map((row) => this.toView(row, mergeContext));
  }

  /**
   * Insert or update the doc for (campaign_id, template_key).
   * Missing fields fall back to the existing row, then to the template
   * defaults — so a PUT carrying only promoted_* stamps a row id without
   * clobbering edits.
   */
  async upsert(
    campaignId: string,
    input: ManualScriptUpsertInput,
    ctx?: RequestCtx,
  ): Promise<ManualScriptView> {
    const template = await this.resolveTemplate(input.template_key);
    if (!template) {
      const valid = await this.validTemplateKeys();
      throw new ValidationError(
        `Unknown template_key '${input.template_key}'. Valid: ${valid.join(', ')}`,
      );
    }
    const campaign = await MarketingCampaignService.getCampaign(campaignId, ctx);
    if (!campaign) {
      throw new NotFoundError(`Campaign ${campaignId} not found`);
    }

    const actor = ctx?.userId ?? 'system';
    const existing = await this.prisma.$queryRawUnsafe<ManualScriptRow[]>(
      `SELECT * FROM mkt_campaign_manual_scripts
       WHERE campaign_id = $1 AND template_key = $2`,
      campaignId,
      input.template_key,
    );

    // Docs outlive their template: an existing doc under an archived key
    // still saves, but no NEW doc can be created under one.
    if (existing.length === 0 && template.source === 'operator' && template.status === 'archived') {
      throw new ValidationError(
        `Template '${input.template_key}' is archived — new docs cannot be created under it.`,
      );
    }

    const title = input.title ?? existing[0]?.title ?? template.label;
    const fields = input.fields ?? existing[0]?.fields ?? {};
    const scriptBody = input.script_body ?? existing[0]?.script_body ?? template.scriptBody;

    if (existing.length === 0) {
      const id = generateManualScriptId();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO mkt_campaign_manual_scripts
           (id, campaign_id, template_key, title, fields, script_body,
            promoted_opener_id, promoted_anchor_id, promoted_header_id, promoted_closer_id,
            created_by, updated_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,now(),now())`,
        id,
        campaignId,
        input.template_key,
        title,
        JSON.stringify(fields),
        scriptBody,
        input.promoted_opener_id ?? null,
        input.promoted_anchor_id ?? null,
        input.promoted_header_id ?? null,
        input.promoted_closer_id ?? null,
        actor,
        actor,
      );
      await this.logAudit(campaignId, input.template_key, 'created', ctx, id);
      return this.requireView(id, campaignId, ctx);
    }

    const row = existing[0];
    await this.prisma.$executeRawUnsafe(
      `UPDATE mkt_campaign_manual_scripts SET
         title = $2,
         fields = $3::jsonb,
         script_body = $4,
         promoted_opener_id = COALESCE($5, promoted_opener_id),
         promoted_anchor_id = COALESCE($6, promoted_anchor_id),
         promoted_header_id = COALESCE($7, promoted_header_id),
         promoted_closer_id = COALESCE($8, promoted_closer_id),
         updated_by = $9,
         updated_at = now()
       WHERE id = $1`,
      row.id,
      title,
      JSON.stringify(fields),
      scriptBody,
      input.promoted_opener_id ?? null,
      input.promoted_anchor_id ?? null,
      input.promoted_header_id ?? null,
      input.promoted_closer_id ?? null,
      actor,
    );
    await this.logAudit(campaignId, input.template_key, 'updated', ctx, row.id);
    return this.requireView(row.id, campaignId, ctx);
  }

  /**
   * Template catalog annotated for the campaign: `suggested` when the
   * campaign's detected triage signals include the template's trigger
   * signal, `saved` when a doc already exists for that template.
   */
  async listTemplatesForCampaign(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<ManualTemplateListItem[]> {
    const savedRows = await this.prisma.$queryRawUnsafe<{ template_key: string }[]>(
      `SELECT template_key FROM mkt_campaign_manual_scripts WHERE campaign_id = $1`,
      campaignId,
    );
    const savedKeys = new Set(savedRows.map((r) => r.template_key));

    let detected = new Set<string>();
    try {
      const triage = await CampaignTriageService.getTriageResult(campaignId, ctx);
      detected = new Set((triage?.detectedSignals ?? []).map((s) => s.code));
    } catch {
      // No triage result yet — nothing is suggested
    }

    // Catalog first (catalog order), then operator templates (label ASC).
    // Archived operator templates stay listed when this campaign already
    // has a doc under that key — docs outlive their template.
    const savedKeysArr = [...savedKeys];
    const operatorRows = await this.prisma.$queryRawUnsafe<ManualPlayTemplateDbRow[]>(
      `SELECT * FROM mkt_manual_play_templates
       WHERE status = 'active' OR key = ANY($1::varchar[])
       ORDER BY label ASC`,
      savedKeysArr,
    );

    const annotate = (t: ManualPlayTemplate, source: ManualTemplateSource, status?: ManualTemplateStatus): ManualTemplateListItem => ({
      ...t,
      suggested: !!t.suggestedWhenSignal && detected.has(t.suggestedWhenSignal),
      saved: savedKeys.has(t.key),
      source,
      status,
    });

    return [
      ...MANUAL_PLAY_TEMPLATES.map((t) => annotate(t, 'catalog')),
      ...operatorRows.map((r) => {
        const status: ManualTemplateStatus = r.status === 'archived' ? 'archived' : 'active';
        return annotate(this.rowToTemplate(r), 'operator', status);
      }),
    ];
  }

  /**
   * Catalog-first, DB-fallback template resolution. Returns the
   * ManualPlayTemplate shape regardless of where the template lives so
   * callers (upsert, promotion) don't care about provenance.
   */
  async resolveTemplate(
    key: string,
  ): Promise<(ManualPlayTemplate & { source: ManualTemplateSource; status?: ManualTemplateStatus }) | null> {
    const catalog = getManualPlayTemplate(key);
    if (catalog) {
      return { ...catalog, source: 'catalog' };
    }
    const rows = await this.prisma.$queryRawUnsafe<ManualPlayTemplateDbRow[]>(
      `SELECT * FROM mkt_manual_play_templates WHERE key = $1`,
      key,
    );
    if (rows.length === 0) return null;
    const status: ManualTemplateStatus = rows[0].status === 'archived' ? 'archived' : 'active';
    return { ...this.rowToTemplate(rows[0]), source: 'operator', status };
  }

  /**
   * All operator-authored template rows (incl. archived) — manage list +
   * key-availability checks. Catalog templates are NOT included (they are
   * code-managed).
   */
  async listOperatorTemplates(): Promise<ManualPlayTemplateRow[]> {
    const rows = await this.prisma.$queryRawUnsafe<ManualPlayTemplateDbRow[]>(
      `SELECT * FROM mkt_manual_play_templates ORDER BY label ASC`,
    );
    return rows.map((r) => this.rowToView(r));
  }

  /**
   * Create an operator-authored template. Key is optional — server-slugged
   * `op_<slug>` from the label when omitted.
   */
  async createTemplate(
    input: ManualPlayTemplateInput,
    ctx?: RequestCtx,
  ): Promise<ManualPlayTemplateRow> {
    const fields = this.validateTemplateInput(input);
    const actor = ctx?.userId ?? 'system';

    let key = input.key?.trim() ?? '';
    if (key) {
      if (!TEMPLATE_KEY_PATTERN.test(key)) {
        throw new ValidationError(
          `Invalid template key '${key}'. Must match op_<slug> (lowercase letters, digits, underscores; 4-80 chars).`,
        );
      }
    } else {
      key = this.slugTemplateKey(input.label);
    }

    if (getManualPlayTemplate(key)) {
      throw new ConflictError(`Template key '${key}' collides with a code-catalog template.`);
    }
    const dupe = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM mkt_manual_play_templates WHERE key = $1`,
      key,
    );
    if (dupe.length > 0) {
      throw new ConflictError(`Template key '${key}' is already in use.`);
    }

    const id = generateManualPlayTemplateId();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO mkt_manual_play_templates
         (id, key, label, description, anchor_type, hook_angle,
          suggested_when_signal, fields, script_body, status,
          created_from_campaign_id, created_from_template_key,
          created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,'active',$10,$11,$12,$12,now(),now())`,
      id,
      key,
      input.label.trim(),
      input.description.trim(),
      input.anchor_type ?? 'custom',
      input.hook_angle ?? null,
      input.suggested_when_signal?.trim() || null,
      JSON.stringify(fields),
      input.script_body,
      input.created_from_campaign_id ?? null,
      input.created_from_template_key ?? null,
      actor,
    );
    await this.logTemplateAudit(id, key, 'created', ctx, input.created_from_campaign_id ?? null);
    return this.requireTemplateView(id);
  }

  /**
   * Update an operator template (label/description/fields/script_body/
   * advanced/status). `key` is immutable. Catalog keys are code-managed.
   */
  async updateTemplate(
    key: string,
    input: Partial<ManualPlayTemplateInput>,
    ctx?: RequestCtx,
  ): Promise<ManualPlayTemplateRow> {
    if (getManualPlayTemplate(key)) {
      throw new ValidationError(`Template '${key}' is a catalog template — catalog templates are code-managed.`);
    }
    const rows = await this.prisma.$queryRawUnsafe<ManualPlayTemplateDbRow[]>(
      `SELECT * FROM mkt_manual_play_templates WHERE key = $1`,
      key,
    );
    if (rows.length === 0) {
      throw new NotFoundError(`Manual play template '${key}' not found`);
    }
    const row = rows[0];

    const fields = input.fields !== undefined
      ? this.validateFields(input.fields)
      : row.fields ?? [];
    if (input.label !== undefined && input.label.trim().length === 0) {
      throw new ValidationError('label is required');
    }
    if (input.anchor_type !== undefined && !MANUAL_ANCHOR_TYPES.includes(input.anchor_type as any)) {
      throw new ValidationError(`Invalid anchor_type '${input.anchor_type}'`);
    }
    if (input.hook_angle !== undefined && input.hook_angle !== null && !HOOK_ANGLE_SET.has(input.hook_angle)) {
      throw new ValidationError(`Invalid hook_angle '${input.hook_angle}'. Valid: ${HOOK_ANGLE_KEYS.join(', ')}`);
    }
    if (input.status !== undefined && input.status !== 'active' && input.status !== 'archived') {
      throw new ValidationError(`Invalid status '${input.status}'`);
    }
    if (input.script_body !== undefined && (input.script_body.length === 0 || input.script_body.length > 50000)) {
      throw new ValidationError('script_body must be 1-50000 chars');
    }

    const actor = ctx?.userId ?? 'system';
    await this.prisma.$executeRawUnsafe(
      `UPDATE mkt_manual_play_templates SET
         label = $2,
         description = $3,
         anchor_type = $4,
         hook_angle = $5,
         suggested_when_signal = $6,
         fields = $7::jsonb,
         script_body = $8,
         status = $9,
         updated_by = $10,
         updated_at = now()
       WHERE id = $1`,
      row.id,
      input.label?.trim() ?? row.label,
      input.description?.trim() ?? row.description,
      input.anchor_type ?? row.anchor_type,
      input.hook_angle !== undefined ? input.hook_angle : row.hook_angle,
      input.suggested_when_signal !== undefined
        ? (input.suggested_when_signal?.trim() || null)
        : row.suggested_when_signal,
      JSON.stringify(fields),
      input.script_body ?? row.script_body,
      input.status ?? row.status,
      actor,
    );
    await this.logTemplateAudit(row.id, key, 'updated', ctx, null);
    return this.requireTemplateView(row.id);
  }

  /**
   * Soft-archive an operator template. Archived keys stay resolvable
   * (docs reference them) and can be re-activated via updateTemplate
   * with status='active'.
   */
  async archiveTemplate(key: string, ctx?: RequestCtx): Promise<ManualPlayTemplateRow> {
    return this.updateTemplate(key, { status: 'archived' }, ctx);
  }

  /**
   * Global merge context for a campaign — the same values used to resolve
   * {{business}} / {{claim_url}} / etc. in doc reads. Exposed so the Manual
   * tab can classify construction variables and live-resolve the preview.
   */
  async mergeContextForCampaign(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<Record<string, string>> {
    return this.buildMergeContext(campaignId, ctx);
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  private rowToTemplate(row: ManualPlayTemplateDbRow): ManualPlayTemplate {
    return {
      key: row.key,
      label: row.label,
      description: row.description,
      anchorType: row.anchor_type,
      hookAngle: row.hook_angle ?? undefined,
      suggestedWhenSignal: row.suggested_when_signal ?? undefined,
      fields: row.fields ?? [],
      scriptBody: row.script_body,
    };
  }

  private rowToView(row: ManualPlayTemplateDbRow): ManualPlayTemplateRow {
    return {
      id: row.id,
      key: row.key,
      label: row.label,
      description: row.description,
      anchor_type: row.anchor_type,
      hook_angle: row.hook_angle,
      suggested_when_signal: row.suggested_when_signal,
      fields: row.fields ?? [],
      script_body: row.script_body,
      status: row.status === 'archived' ? 'archived' : 'active',
      created_from_campaign_id: row.created_from_campaign_id,
      created_from_template_key: row.created_from_template_key,
      created_by: row.created_by,
      updated_by: row.updated_by,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }

  private async requireTemplateView(id: string): Promise<ManualPlayTemplateRow> {
    const rows = await this.prisma.$queryRawUnsafe<ManualPlayTemplateDbRow[]>(
      `SELECT * FROM mkt_manual_play_templates WHERE id = $1`,
      id,
    );
    if (rows.length === 0) {
      throw new NotFoundError(`Manual play template ${id} not found`);
    }
    return this.rowToView(rows[0]);
  }

  /** Catalog keys ++ active operator keys — for the upsert error message. */
  private async validTemplateKeys(): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<{ key: string }[]>(
      `SELECT key FROM mkt_manual_play_templates WHERE status = 'active'`,
    );
    return [...MANUAL_PLAY_TEMPLATES.map((t) => t.key), ...rows.map((r) => r.key)];
  }

  /** op_<slug> derived from a label; capped at the 80-char key limit. */
  private slugTemplateKey(label: string): string {
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 77);
    const base = `op_${slug || 'play'}`;
    return TEMPLATE_KEY_PATTERN.test(base) ? base : 'op_play';
  }

  private validateTemplateInput(input: ManualPlayTemplateInput): ManualPlayField[] {
    if (!input.label || input.label.trim().length === 0 || input.label.length > 255) {
      throw new ValidationError('label is required (1-255 chars)');
    }
    if (input.description === undefined || input.description.length > 2000) {
      throw new ValidationError('description is required (max 2000 chars)');
    }
    if (!input.script_body || input.script_body.length === 0 || input.script_body.length > 50000) {
      throw new ValidationError('script_body must be 1-50000 chars');
    }
    const anchorType = input.anchor_type ?? 'custom';
    if (!MANUAL_ANCHOR_TYPES.includes(anchorType as any)) {
      throw new ValidationError(`Invalid anchor_type '${anchorType}'`);
    }
    if (input.hook_angle != null && !HOOK_ANGLE_SET.has(input.hook_angle)) {
      throw new ValidationError(`Invalid hook_angle '${input.hook_angle}'. Valid: ${HOOK_ANGLE_KEYS.join(', ')}`);
    }
    if (input.suggested_when_signal != null && input.suggested_when_signal.length > 80) {
      throw new ValidationError('suggested_when_signal must be ≤ 80 chars');
    }
    return this.validateFields(input.fields);
  }

  private validateFields(fields: ManualPlayField[] | undefined): ManualPlayField[] {
    if (!Array.isArray(fields) || fields.length < 1 || fields.length > 40) {
      throw new ValidationError('fields must be an array of 1-40 items');
    }
    return fields.map((f, i) => {
      if (!f || typeof f.key !== 'string' || !FIELD_KEY_PATTERN.test(f.key)) {
        throw new ValidationError(`fields[${i}].key must match ^[a-z][a-z0-9_]{0,39}$`);
      }
      if (typeof f.label !== 'string' || f.label.length === 0 || f.label.length > 120) {
        throw new ValidationError(`fields[${i}].label is required (1-120 chars)`);
      }
      if (!MANUAL_FIELD_ROLES.has(f.role)) {
        throw new ValidationError(`fields[${i}].role must be one of: ${[...MANUAL_FIELD_ROLES].join(', ')}`);
      }
      if (typeof f.placeholder !== 'string' || f.placeholder.length > 500) {
        throw new ValidationError(`fields[${i}].placeholder must be ≤ 500 chars`);
      }
      if (typeof f.defaultValue !== 'string' || f.defaultValue.length > 20000) {
        throw new ValidationError(`fields[${i}].defaultValue must be ≤ 20000 chars`);
      }
      return f;
    });
  }

  private async logTemplateAudit(
    rowId: string,
    key: string,
    action: 'created' | 'updated' | 'archived',
    ctx: RequestCtx | undefined,
    createdFromCampaignId: string | null,
  ): Promise<void> {
    try {
      await audit({
        actor: ctx?.userId ?? null,
        actorType: 'user',
        action: 'update',
        payload: {
          entity_type: 'other',
          id: rowId,
          manual_template_key: key,
          manual_template_action: action,
          created_from_campaign_id: createdFromCampaignId,
        },
      });
    } catch {
      // audit failures must not block
    }
  }

  private async requireView(
    id: string,
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<ManualScriptView> {
    const rows = await this.prisma.$queryRawUnsafe<ManualScriptRow[]>(
      `SELECT * FROM mkt_campaign_manual_scripts WHERE id = $1`,
      id,
    );
    if (rows.length === 0) {
      throw new NotFoundError(`ManualOutreachScript ${id} not found`);
    }
    const mergeContext = await this.buildMergeContext(campaignId, ctx);
    return this.toView(rows[0], mergeContext);
  }

  private toView(row: ManualScriptRow, mergeContext: Record<string, string>): ManualScriptView {
    const fields = row.fields ?? {};
    // Field values can embed global merges and other field keys — resolve
    // them through the same context (fields are merged in after globals so
    // a field value can reference {{business}} etc.).
    const fieldCtx: Record<string, string> = { ...mergeContext, ...fields };
    const resolved_fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      resolved_fields[k] = this.resolveMerge(v, fieldCtx);
    }
    return {
      id: row.id,
      campaign_id: row.campaign_id,
      template_key: row.template_key,
      title: row.title,
      fields,
      script_body: row.script_body,
      promoted_opener_id: row.promoted_opener_id,
      promoted_anchor_id: row.promoted_anchor_id,
      promoted_header_id: row.promoted_header_id,
      promoted_closer_id: row.promoted_closer_id,
      created_by: row.created_by,
      updated_by: row.updated_by,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      resolved_fields,
      resolved_body: this.resolveMerge(row.script_body, fieldCtx),
    };
  }

  /**
   * Build the merge context for a campaign — mirrors
   * CallScriptService.assembleForCampaign merge handling plus
   * {{salutation}} / {{sender_name}} for the email-shaped slots.
   * Unresolvable values stay as visible placeholders.
   */
  private async buildMergeContext(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<Record<string, string>> {
    const campaign = await MarketingCampaignService.getCampaign(campaignId, ctx);
    if (!campaign) {
      throw new NotFoundError(`Campaign ${campaignId} not found`);
    }

    const rawCategory = campaign.service_category ?? campaign.category ?? null;
    const operatorName = await this.resolveOperatorName(campaign);

    // Tracked link + QR variables (§5.1) — report_url, claim_url,
    // claim_short_url, qr_url_* — resolved from the seed's claim/report kits.
    // Absent keys keep their {{placeholder}} visible in the script.
    const seedId = await resolveCampaignSeedId(campaignId);
    const linkVars = await buildOutreachLinkVars(seedId);

    const merge: Record<string, string | null> = {
      business: campaign.business_name ?? null,
      address: this.formatAddress(campaign),
      category: rawCategory ? rawCategory.toLowerCase() : null,
      city: campaign.city ?? null,
      operator_name: operatorName,
      sender_name: operatorName,
      salutation: '{{salutation}}',
      claim_url: null,
      ...linkVars,
    };

    // Salutation: worksheet's stored recommendation → resolveSalutation
    // on the payload's sourced owner_name → business-name fallback chain.
    try {
      const worksheet = await OutreachIntelligenceService.getForCampaign(campaignId, ctx);
      const ownerField = worksheet?.payload?.owner_name ?? {
        value: worksheet?.owner_name ?? null,
        source: null,
        source_confidence: 'unavailable' as const,
      };
      merge.salutation = worksheet?.recommended_salutation
        || resolveSalutation({ owner_name: ownerField }, campaign.business_name ?? null);
    } catch {
      merge.salutation = resolveSalutation(
        { owner_name: { value: null, source: null, source_confidence: 'unavailable' } },
        campaign.business_name ?? null,
      );
    }

    // Values are `string | null` internally; resolveMerge keeps the
    // placeholder on null. Cast to the outward shape.
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(merge)) {
      if (v !== null) out[k] = v;
    }
    return out;
  }

  /**
   * Resolve {{key}} placeholders; unknown keys stay visible (never
   * fabricated) — same contract as CallScriptService.resolveMerge.
   */
  private resolveMerge(template: string, ctx: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (m, k) => ctx[k] ?? m);
  }

  /**
   * Format the campaign address into a single spoken string.
   * Mirrors CallScriptService.formatAddress.
   */
  private formatAddress(campaign: any): string | null {
    const parts = [
      campaign.address_line1,
      campaign.address_city,
      campaign.address_state,
    ].filter((p: any) => p && String(p).trim().length > 0);

    if (parts.length === 0) return null;

    const line1 = campaign.address_line1?.trim();
    const city = campaign.address_city?.trim();
    const state = campaign.address_state?.trim();

    if (line1 && city && state) {
      return `${line1}, ${city}, ${state}`;
    }
    if (line1 && city) {
      return `${line1}, ${city}`;
    }
    if (city && state) {
      return `${city}, ${state}`;
    }
    return parts.map((p: any) => String(p).trim()).join(', ');
  }

  /**
   * Resolve the operator display name — mirrors
   * CallScriptService.resolveOperatorName: assigned_to display name →
   * users table lookup → 'your team'.
   */
  private async resolveOperatorName(campaign: any): Promise<string> {
    const assigned = campaign?.assigned_to;
    if (assigned && typeof assigned === 'string' && assigned.trim().length > 0) {
      if (!assigned.startsWith('uid-')) {
        return assigned.trim();
      }
      try {
        const user = await this.prisma.users.findUnique({
          where: { id: assigned },
          select: { first_name: true, last_name: true, email: true },
        });
        if (user) {
          const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
          if (displayName && displayName.length > 0) {
            return displayName;
          }
          if (user.email) {
            return user.email.split('@')[0];
          }
        }
      } catch {
        // User lookup failed — fall through to default
      }
    }
    return 'your team';
  }

  private async logAudit(
    campaignId: string,
    templateKey: string,
    action: 'created' | 'updated',
    ctx: RequestCtx | undefined,
    rowId: string,
  ): Promise<void> {
    try {
      await audit({
        actor: ctx?.userId ?? null,
        actorType: 'user',
        action: 'update',
        payload: {
          entity_type: 'other',
          id: rowId,
          campaign_id: campaignId,
          template_key: templateKey,
          manual_script_action: action,
        },
      });
    } catch {
      // audit failures must not block
    }
  }
}

export default ManualOutreachScriptService.getInstance();
