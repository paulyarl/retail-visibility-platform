/**
 * MarketingProspectQueueService
 *
 * Operator-facing Prospect Queue — capture businesses from audit surfaces
 * for later campaign creation, without navigating away from the audit.
 *
 *  - addToQueue: persist a prospect (dedup vs active queue + campaign-exists check)
 *  - list: filtered list + queuedCount for nav badge (include=campaigns for board)
 *  - update: priority / note / assigned_to (claim semantics)
 *  - createCampaignFromQueue: replay the stored snapshot through the existing
 *    derive services (scan path → MarketingHotProspectService, thin path →
 *    MarketingCampaignService), carry ownership forward, mark processed
 *  - dismiss: set status dismissed + reason
 *
 * Pattern: singleton extends BaseService (mirrors MarketingHotProspectService —
 * Prisma directly, RequestCtx logging, handleError). All mkt_* tables are
 * platform-admin scoped (no RLS, no tenant key in IDs).
 *
 * Per docs/LocalBiz/marketing_ops_prospect_queue_sprint_plan.md
 * Sprint — Phase 1 (Data + API).
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';
import { generateProspectQueueId } from '../lib/id-generator';
import MarketingCampaignService from './MarketingCampaignService';
import { MarketingHotProspectService } from './MarketingHotProspectService';

// ─── Types ──────────────────────────────────────────────────────────────

export type ProspectSourceKind =
  | 'category_analysis'
  | 'city_category_audit'
  | 'scan_unmatched'
  | 'manual'
  | 'intelligence_seek';

export type ProspectStatus = 'queued' | 'campaign_created' | 'dismissed';
export type ProspectPriority = 'high' | 'normal';

export type ProspectCampaignScope = 'business' | 'category' | 'city' | 'intelligence';

export interface ProspectQueueAddInput {
  // Required for business-scope entries; optional for category/city-scope
  // entries (the triggering business may be unknown or irrelevant).
  business_name?: string;
  // Required — scope-neutral descriptive title (e.g. "Homer Hills Fleet
  // Services — Review Recovery"). Persisted on the queue entry and forwarded
  // to the campaign when the operator creates one from the queue. Also serves
  // as the primary dedup key for the campaign-exists check (title + city +
  // state), which prevents false positives where different businesses in the
  // same city+category would match each other.
  title: string;
  category?: string;
  city?: string;
  state?: string;
  source_kind: ProspectSourceKind;
  // Optional for manual entries added directly from the queue page (no parent
  // campaign to inherit scope/category/city/state from).
  source_campaign_id?: string;
  source_audit_id?: string;
  source_execution_id?: string;
  audit_date?: Date;
  business_snapshot?: Record<string, any>;
  priority?: ProspectPriority;
  note?: string;
  queuedBy?: string;
  // Operator-chosen campaign scope for manual entries (no parent campaign).
  // Defaults to 'business' (legacy behavior). Audit-derived entries inherit
  // the parent campaign's scope and ignore this field.
  scope?: ProspectCampaignScope;
}

export type AddToQueueResult =
  | { kind: 'created'; entry: any; created: true }
  | { kind: 'already_queued'; entry: any; created: false }
  | { kind: 'campaign_exists'; campaignId: string };

export interface ListQueueFilters {
  status?: ProspectStatus | ProspectStatus[]; // comma-separated → array at route layer
  category?: string;
  city?: string;
  source_kind?: ProspectSourceKind;
  assigned_to?: string; // 'me' resolved to userId at route layer; 'unassigned' → null filter
  // When true, the assigned_to filter is OR'd with assigned_to IS NULL
  // (matches the "Assigned to me + unassigned" checkbox label on the queue page).
  include_unassigned?: boolean;
  limit?: number;
  includeCampaigns?: boolean;
}

export interface UpdateQueueInput {
  priority?: ProspectPriority;
  note?: string | null;
  assigned_to?: string | null; // null = unassign
}

export interface CreateCampaignInput {
  queueEntryId: string;
  actingUserId?: string; // req.user.id — fallback for assigned_to
}

export interface DismissInput {
  queueEntryId: string;
  reason?: 'already_customer' | 'bad_fit' | 'duplicate' | 'other';
}

// ─── Service ────────────────────────────────────────────────────────────

class MarketingProspectQueueServiceClass extends BaseService {
  /**
   * Add a business to the queue.
   *
   * Dedup: if a `queued` row already exists for the same normalized
   * business_name + city + category → returns it (created: false).
   * Campaign-exists: if a business-scope campaign already exists for the same
   * triple (AC84 rule) → returns { kind: 'campaign_exists', campaignId } so
   * the route can surface a 409 with a link.
   */
  async addToQueue(input: ProspectQueueAddInput, ctx?: RequestCtx): Promise<AddToQueueResult> {
    try {
      // Load parent campaign to inherit scope/category/city/state defaults.
      // Manual entries (added directly from the queue page) may have no parent
      // campaign — fall back to the input values directly.
      const isManual = input.source_kind === 'manual' && !input.source_campaign_id;
      let parent: any = null;
      if (!isManual) {
        parent = await this.prisma.mkt_campaigns_list.findUnique({
          where: { id: input.source_campaign_id! },
        });
        if (!parent) {
          throw new NotFoundError(`Source campaign ${input.source_campaign_id} not found`);
        }
      }

      const category = (input.category ?? parent?.category ?? null) as string | null;
      const city = (input.city ?? parent?.city ?? null) as string | null;
      const state = (input.state ?? parent?.state ?? null) as string | null;
      // For audit-derived entries, inherit the parent campaign's scope.
      // For manual entries (no parent), use the operator-chosen scope,
      // defaulting to 'business' (legacy behavior).
      const sourceScope = parent
        ? (parent.scope as string | null)
        : (input.scope ?? 'business');
      const resolvedScope = sourceScope ?? 'business';

      // business_name is required only for business-scope entries. For
      // category/city-scope entries the triggering business may be unknown
      // or irrelevant, so it is optional.
      const businessName = (input.business_name ?? '').trim();
      if (resolvedScope === 'business' && !businessName) {
        throw new ConflictError('business_name is required for business-scope entries');
      }

      // Denormalize signal/rating/review fields from the snapshot so the card
      // can render without unpacking business_snapshot per row.
      const snapshot = input.business_snapshot ?? {};
      const detectedSignals = extractDetectedSignals(snapshot);
      const signalCount = detectedSignals.length;
      const rating = extractRating(snapshot);
      const reviewCount = extractReviewCount(snapshot);

      // Dedup: active queue entry for the same normalized identity.
      // Business scope dedups on the full triple (business_name + city +
      // category). Category/city scope entries have no business_name, so they
      // dedup on city + category only (matching a null business_name row).
      const dedupWhere: any = { status: 'queued' };
      if (businessName) {
        dedupWhere.business_name = { equals: businessName, mode: 'insensitive' };
      } else {
        dedupWhere.business_name = null;
      }
      Object.assign(dedupWhere, insensitiveEq('city', city));
      Object.assign(dedupWhere, insensitiveEq('category', category));
      const existingQueued = await this.prisma.mkt_prospect_queue.findFirst({
        where: dedupWhere,
      });
      if (existingQueued) {
        logger.info('addToQueue: returning existing queued entry', ctx, {
          existingId: existingQueued.id, businessName: businessName || null,
        });
        return { kind: 'already_queued', entry: existingQueued, created: false };
      }

      // Campaign-exists check (AC84 rule): a campaign for the same title +
      // city + state means the prospect is already in the pipeline — surface
      // it. Title is the primary identifier (required on input), and city +
      // state disambiguate geographically. This replaces the earlier
      // scope + city + category (+ business_name) check, which could return
      // false positives for different businesses in the same city+category.
      //
      // Exclude the source/parent campaign (e.g. a city_category_audit that
      // discovered this prospect) — it is the originator, not a campaign for
      // this specific business, so matching it would falsely report the
      // prospect as already in the pipeline.
      const resolvedTitle = input.title.trim();
      const campaignExistsWhere: any = {
        title: { equals: resolvedTitle, mode: 'insensitive' },
      };
      if (input.source_campaign_id) {
        campaignExistsWhere.id = { not: input.source_campaign_id };
      }
      Object.assign(campaignExistsWhere, insensitiveEq('city', city));
      Object.assign(campaignExistsWhere, insensitiveEq('state', state));
      const existingCampaign = await this.prisma.mkt_campaigns_list.findFirst({
        where: campaignExistsWhere,
        select: { id: true },
      });
      if (existingCampaign) {
        logger.info('addToQueue: campaign already exists for prospect', ctx, {
          campaignId: existingCampaign.id, businessName: businessName || null, scope: resolvedScope,
        });
        return { kind: 'campaign_exists', campaignId: existingCampaign.id };
      }

      const id = generateProspectQueueId();
      const entry = await this.prisma.mkt_prospect_queue.create({
        data: {
          id,
          business_name: businessName || null,
          title: input.title.trim(),
          category,
          city,
          state,
          source_kind: input.source_kind,
          source_scope: sourceScope,
          source_campaign_id: input.source_campaign_id ?? null,
          source_audit_id: input.source_audit_id ?? null,
          source_execution_id: input.source_execution_id ?? null,
          audit_date: input.audit_date ?? null,
          business_snapshot: snapshot as any,
          detected_signals: detectedSignals as any,
          signal_count: signalCount,
          rating: rating != null ? rating : null,
          review_count: reviewCount ?? null,
          status: 'queued',
          priority: input.priority ?? 'normal',
          note: input.note ?? null,
          queued_by: input.queuedBy ?? null,
        },
      });

      logger.info('addToQueue: created queue entry', ctx, {
        id, businessName: businessName || null, sourceKind: input.source_kind, signalCount,
      });
      return { kind: 'created', entry, created: true };
    } catch (error) {
      logger.error('addToQueue failed', ctx, {
        error: (error as Error).message,
        businessName: input.business_name ?? null,
        sourceCampaignId: input.source_campaign_id,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * List queue entries with filters. `queuedCount` (status='queued' only) is
   * always returned regardless of filters — it drives the nav badge / widget.
   * `includeCampaigns` LEFT JOINs processed_campaign_id → mkt_campaigns_list
   * and decorates each entry with campaign stage fields for the board view.
   */
  async list(filters: ListQueueFilters, ctx?: RequestCtx): Promise<{ entries: any[]; queuedCount: number }> {
    try {
      const statusValues = normalizeStatusFilter(filters.status);
      const where: any = {};
      if (statusValues) where.status = { in: statusValues };
      if (filters.category) where.category = { equals: filters.category, mode: 'insensitive' };
      if (filters.city) where.city = { equals: filters.city, mode: 'insensitive' };
      if (filters.source_kind) where.source_kind = filters.source_kind;
      if (filters.assigned_to === 'unassigned') {
        where.assigned_to = null;
      } else if (filters.assigned_to && filters.include_unassigned) {
        // "Assigned to me + unassigned" — OR the assignee with NULL rows so
        // newly-queued (unassigned) prospects are visible alongside the
        // operator's own claims.
        where.OR = [
          { assigned_to: filters.assigned_to },
          { assigned_to: null },
        ];
      } else if (filters.assigned_to) {
        where.assigned_to = filters.assigned_to;
      }

      const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));

      const entries = await this.prisma.mkt_prospect_queue.findMany({
        where,
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { signal_count: 'desc' },
          { created_at: 'asc' },
        ],
        take: limit,
        include: filters.includeCampaigns
          ? {
              mkt_campaigns_list_mkt_prospect_queue_processed_campaign_idTomkt_campaigns_list: {
                select: {
                  id: true,
                  stage: true,
                  category: true,
                  repair_track: true,
                  is_hot_prospect: true,
                  stage_entered_at: true,
                },
              },
            }
          : undefined,
      });

      // queuedCount is always the count of status='queued' regardless of the
      // status filter the caller passed — it drives the nav badge.
      const queuedCount = await this.prisma.mkt_prospect_queue.count({
        where: { status: 'queued' },
      });

      // Flatten the campaign join for the board view so the API payload is
      // { ..., campaign_stage, campaign_category, ... } instead of the long
      // Prisma relation name.
      const decorated = filters.includeCampaigns
        ? entries.map((e: any) => {
            const camp = e.mkt_campaigns_list_mkt_prospect_queue_processed_campaign_idTomkt_campaigns_list;
            const { mkt_campaigns_list_mkt_prospect_queue_processed_campaign_idTomkt_campaigns_list, ...rest } = e;
            return {
              ...rest,
              campaign_stage: camp?.stage ?? null,
              campaign_category: camp?.category ?? null,
              repair_track: camp?.repair_track ?? null,
              is_hot_prospect: camp?.is_hot_prospect ?? null,
              stage_entered_at: camp?.stage_entered_at ?? null,
            };
          })
        : entries;

      return { entries: decorated, queuedCount };
    } catch (error) {
      logger.error('list failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Update priority / note / assigned_to on a queued entry.
   * 404 if not found; 409 if not in 'queued' status (only queued rows are
   * editable — graduated/dismissed rows are history).
   */
  async update(id: string, patch: UpdateQueueInput, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_prospect_queue.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundError(`Queue entry ${id} not found`);
      }
      if (existing.status !== 'queued') {
        throw new ConflictError(`Queue entry ${id} is not editable (status=${existing.status})`);
      }

      const data: any = {};
      if (patch.priority !== undefined) data.priority = patch.priority;
      if (patch.note !== undefined) data.note = patch.note;
      if (patch.assigned_to !== undefined) {
        if (patch.assigned_to === null) {
          data.assigned_to = null;
          data.assigned_at = null;
        } else {
          data.assigned_to = patch.assigned_to;
          data.assigned_at = new Date();
        }
      }

      const updated = await this.prisma.mkt_prospect_queue.update({
        where: { id },
        data,
      });
      logger.info('update: patched queue entry', ctx, { id, fields: Object.keys(data) });
      return updated;
    } catch (error) {
      logger.error('update failed', ctx, { error: (error as Error).message, id });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Create a campaign from a queued entry by replaying the stored snapshot
   * through the existing derive services. Idempotent — repeat calls return
   * the already-created campaign. Ownership carries forward: if the entry
   * has an assignee, the campaign's assigned_to is set to the same user
   * (falling back to the acting user when unassigned).
   */
  async createCampaignFromQueue(input: CreateCampaignInput, ctx?: RequestCtx): Promise<{ campaign: any; created: boolean; queueEntry: any }> {
    try {
      const entry = await this.prisma.mkt_prospect_queue.findUnique({
        where: { id: input.queueEntryId },
      });
      if (!entry) {
        throw new NotFoundError(`Queue entry ${input.queueEntryId} not found`);
      }

      // Idempotent: already processed → return the existing campaign.
      if (entry.status === 'campaign_created' && entry.processed_campaign_id) {
        const existingCampaign = await this.prisma.mkt_campaigns_list.findUnique({
          where: { id: entry.processed_campaign_id },
        });
        if (existingCampaign) {
          logger.info('createCampaignFromQueue: idempotent return', ctx, {
            queueEntryId: input.queueEntryId, campaignId: existingCampaign.id,
          });
          return { campaign: existingCampaign, created: false, queueEntry: entry };
        }
        // Campaign was deleted — fall through to re-create.
      }

      const assignee = entry.assigned_to ?? input.actingUserId ?? null;
      const snapshot = (entry.business_snapshot as any) ?? {};

      let result: { campaign: any; created: boolean };

      // Manual entries with no parent campaign (added directly from the queue
      // page) create a campaign directly — there is no parent to derive
      // category/city/tone/attributes from, so we seed from the queue entry's
      // own fields. The campaign scope follows the operator's choice stored
      // on the entry (source_scope), defaulting to 'business' for legacy rows.
      if (!entry.source_campaign_id) {
        const campaignScope = (entry.source_scope as any) ?? 'business';
        const campaign = await MarketingCampaignService.createCampaign({
          scope: campaignScope,
          title: entry.title ?? undefined,
          businessName: entry.business_name ?? undefined,
          category: entry.category ?? '',
          city: entry.city ?? '',
          assignedTo: assignee ?? undefined,
          notes: [
            `Manually queued prospect (no parent campaign, scope=${campaignScope}).`,
            entry.city ? `City: ${entry.city}` : null,
            entry.category ? `Category: ${entry.category}` : null,
            entry.rating != null ? `Rating: ${Number(entry.rating).toFixed(1)}` : null,
            entry.review_count != null ? `Reviews: ${entry.review_count}` : null,
            (entry.detected_signals as string[])?.length
              ? `Detected signals: ${(entry.detected_signals as string[]).join(', ')}`
              : null,
            entry.note ? `Operator note: ${entry.note}` : null,
          ].filter(Boolean).join('\n'),
        }, ctx);

        // Seed a business_analysis audit with the queued signals so triage can
        // assign a playbook immediately (mirrors the derive path).
        const signals = (entry.detected_signals as string[]) ?? [];
        if (signals.length > 0) {
          const { generateMarketingAuditId } = await import('../lib/id-generator.js');
          const auditId = generateMarketingAuditId();
          await this.prisma.mkt_audits_list.create({
            data: {
              id: auditId,
              campaign_id: campaign.id,
              platform: 'business_analysis',
              audit_data: {
                audit_metadata: {
                  business_name: entry.business_name,
                  source: 'manual_queue',
                },
                detected_signals: signals,
                summary: `Manually queued with ${signals.length} detected signals.`,
              } as any,
            },
          });
          try {
            const { default: CampaignTriageService } = await import('./CampaignTriageService.js');
            await CampaignTriageService.evaluateTriageForCampaign({ campaignId: campaign.id }, ctx);
          } catch (triageError) {
            logger.warn('Auto-triage failed for manual queue campaign (non-fatal)', ctx, {
              campaignId: campaign.id,
              error: (triageError as Error).message,
            });
          }
        }

        result = { campaign, created: true };
      } else if (entry.source_kind === 'city_category_audit' || entry.source_kind === 'scan_unmatched') {
        // Replay path is selected by source_kind — scan-derived entries carry
        // the full business JSON; category-analysis entries carry a thin payload.
        const r = await MarketingHotProspectService.getInstance().deriveBusinessCampaignFromScanBusiness(
          entry.source_campaign_id,
          snapshot,
          ctx,
          { note: entry.note ?? undefined },
        );
        result = r;
        // Carry ownership forward for the scan path (deriveBusinessCampaign
        // accepts assignedTo natively; the scan path does not, so set it
        // after creation when the entry had an assignee).
        if (entry.assigned_to && r.campaign?.id && r.campaign.assigned_to !== entry.assigned_to) {
          await this.prisma.mkt_campaigns_list.update({
            where: { id: r.campaign.id },
            data: { assigned_to: entry.assigned_to },
          });
          r.campaign = { ...r.campaign, assigned_to: entry.assigned_to };
        }
      } else {
        // category_analysis / manual (with parent) → thin path.
        // deriveBusinessCampaign creates a business-scope child, so a
        // business_name is required. Audit-derived entries always carry one.
        const derivedBusinessName = entry.business_name ?? '';
        if (!derivedBusinessName) {
          throw new ConflictError('Cannot derive business campaign: queue entry has no business_name');
        }
        const campaign = await MarketingCampaignService.deriveBusinessCampaign({
          parentId: entry.source_campaign_id,
          businessName: derivedBusinessName,
          title: entry.title ?? undefined,
          rating: entry.rating != null ? Number(entry.rating) : undefined,
          reviewCount: entry.review_count ?? undefined,
          location: (snapshot.location as string) ?? undefined,
          detectedSignals: (entry.detected_signals as string[]) ?? undefined,
          assignedTo: assignee ?? undefined,
          note: entry.note ?? undefined,
        }, ctx);
        result = { campaign, created: true };
      }

      // AC84 dedup inside the derive services may return created:false — the
      // entry is still marked processed against the pre-existing campaign
      // (the prospect is in the pipeline, which is the operator's goal).
      const updated = await this.prisma.mkt_prospect_queue.update({
        where: { id: input.queueEntryId },
        data: {
          status: 'campaign_created',
          processed_campaign_id: result.campaign.id,
          processed_at: new Date(),
        },
      });

      logger.info('createCampaignFromQueue: campaign created/attached', ctx, {
        queueEntryId: input.queueEntryId,
        campaignId: result.campaign.id,
        created: result.created,
      });
      return { campaign: result.campaign, created: result.created, queueEntry: updated };
    } catch (error) {
      logger.error('createCampaignFromQueue failed', ctx, {
        error: (error as Error).message,
        queueEntryId: input.queueEntryId,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Dismiss a queued entry. Idempotent — dismissing an already-dismissed
   * entry just updates the reason. Re-queueing a dismissed business creates
   * a new row (the partial unique index only covers status='queued').
   */
  async dismiss(input: DismissInput, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_prospect_queue.findUnique({
        where: { id: input.queueEntryId },
      });
      if (!existing) {
        throw new NotFoundError(`Queue entry ${input.queueEntryId} not found`);
      }

      const updated = await this.prisma.mkt_prospect_queue.update({
        where: { id: input.queueEntryId },
        data: {
          status: 'dismissed',
          dismissed_reason: input.reason ?? null,
          processed_at: new Date(),
        },
      });
      logger.info('dismiss: entry dismissed', ctx, {
        id: input.queueEntryId, reason: input.reason ?? null,
      });
      return updated;
    } catch (error) {
      logger.error('dismiss failed', ctx, {
        error: (error as Error).message,
        queueEntryId: input.queueEntryId,
      });
      throw this.handleError(error, ctx);
    }
  }
}

// ─── Snapshot field extraction helpers ──────────────────────────────────
// Handle both the full scan business JSON shape (platforms.google.rating,
// combined_review_metrics.observable_total_reviews) and the thin
// category-analysis payload ({ rating, review_count } at top level).

function extractDetectedSignals(snapshot: any): string[] {
  const signals = snapshot?.detected_signals;
  if (Array.isArray(signals)) return signals.filter((s) => typeof s === 'string');
  return [];
}

function extractRating(snapshot: any): number | null {
  const r =
    snapshot?.rating ??
    snapshot?.platforms?.google?.rating ??
    null;
  if (r == null || typeof r !== 'number') return null;
  // Numeric(2,1) — clamp to one decimal.
  return Math.round(r * 10) / 10;
}

function extractReviewCount(snapshot: any): number | null {
  const rc =
    snapshot?.review_count ??
    snapshot?.combined_review_metrics?.observable_total_reviews ??
    snapshot?.platforms?.google?.total_reviews ??
    null;
  if (rc == null || typeof rc !== 'number') return null;
  return Math.round(rc);
}

function normalizeStatusFilter(status?: ProspectStatus | ProspectStatus[]): ProspectStatus[] | undefined {
  if (!status) return undefined;
  if (Array.isArray(status)) return status.length ? status : undefined;
  return [status];
}

/**
 * Build a Prisma insensitive-equals filter for an optional string field.
 * Returns `{}` (spread no-op) when the value is null/undefined so Prisma
 * treats the field as "not filtered" rather than "must be null".
 */
function insensitiveEq(field: string, value: string | null | undefined): Record<string, any> {
  if (value == null) return {};
  return { [field]: { equals: value, mode: 'insensitive' as const } };
}

// Singleton export (mirrors MarketingHotProspectService.getInstance pattern).
const MarketingProspectQueueService = new MarketingProspectQueueServiceClass();
export default MarketingProspectQueueService;
