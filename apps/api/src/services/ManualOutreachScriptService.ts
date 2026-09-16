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
import { unifiedConfig } from '../config/unifiedConfig';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import MarketingCampaignService from './MarketingCampaignService';
import CampaignTriageService from './CampaignTriageService';
import OutreachIntelligenceService, {
  resolveSalutation,
} from './OutreachIntelligenceService';
import { generateManualScriptId } from '../lib/id-generator';
import {
  getManualPlayTemplate,
  MANUAL_PLAY_TEMPLATES,
  type ManualPlayTemplate,
} from './outreach-openers/manual-play-templates';

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

export interface ManualTemplateListItem extends ManualPlayTemplate {
  suggested: boolean;
  saved: boolean;
}

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
    const template = getManualPlayTemplate(input.template_key);
    if (!template) {
      throw new ValidationError(
        `Unknown template_key '${input.template_key}'. Valid: ${MANUAL_PLAY_TEMPLATES.map((t) => t.key).join(', ')}`,
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

    return MANUAL_PLAY_TEMPLATES.map((t) => ({
      ...t,
      suggested: !!t.suggestedWhenSignal && detected.has(t.suggestedWhenSignal),
      saved: savedKeys.has(t.key),
    }));
  }

  // ─── Internals ──────────────────────────────────────────────────────────

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
    const claimUrl = await this.resolveClaimUrl(campaignId);

    const merge: Record<string, string | null> = {
      business: campaign.business_name ?? null,
      address: this.formatAddress(campaign),
      category: rawCategory ? rawCategory.toLowerCase() : null,
      city: campaign.city ?? null,
      operator_name: operatorName,
      sender_name: operatorName,
      salutation: '{{salutation}}',
      claim_url: claimUrl,
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
   * Resolve the directory claim URL for a campaign — mirrors
   * CallScriptService.resolveClaimUrl. Best-effort: null on any failure.
   */
  private async resolveClaimUrl(campaignId: string): Promise<string | null> {
    try {
      const links = await this.prisma.$queryRaw<any[]>`
        SELECT seed_id FROM directory_seed_campaign_links
        WHERE campaign_id = ${campaignId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!links[0]?.seed_id) return null;
      const seedId = links[0].seed_id;

      const tokens = await this.prisma.$queryRaw<any[]>`
        SELECT token FROM directory_claim_tokens
        WHERE seed_id = ${seedId}
          AND consumed_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!tokens[0]?.token) return null;

      const baseUrl = unifiedConfig.frontendUrl || unifiedConfig.webUrl || '';
      return `${baseUrl}/directory/claim/${tokens[0].token}`;
    } catch {
      return null;
    }
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
