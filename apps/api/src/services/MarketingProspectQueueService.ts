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
import MarketingCampaignService, { INACTIVE_STAGES } from './MarketingCampaignService';
import { MarketingHotProspectService } from './MarketingHotProspectService';
import { validateDiscoveryContext, type DiscoveryContext } from '../validators/intelligence-discovery.schema';

// ─── Types ──────────────────────────────────────────────────────────────

export type ProspectSourceKind =
  | 'category_analysis'
  | 'city_category_audit'
  | 'scan_unmatched'
  | 'manual'
  | 'intelligence_seek'
  | 'directory_lead_gen'
  | 'category_identification'
  | 'public_suggestion'
  | 'gold_standard_candidate';

// Migration 262 — 'hold' parks the prospect (touch-cap / nurture; re-enters
// at next_touch_at) and 'in_thread' marks a live conversation (the ladder is
// done or interrupted — the thread drives next moves). See spec §4.6.
export type ProspectStatus = 'queued' | 'verify_then_outreach' | 'campaign_created' | 'dismissed' | 'hold' | 'in_thread';
export type ProspectPriority = 'high' | 'normal';

// ─── Verify-then-outreach (Migration 255) ───────────────────────────────
// When an audit cannot independently verify NAP and finds zero live listings,
// the prospect is routed into a verification gate. The operator calls the
// business to confirm operational status + capture a verified NAP before a
// campaign is created. See docs spec: verify-then-outreach queue status.

export type VerificationOutcome = 'operational' | 'closed' | 'relocated' | 'unreachable' | 'wrong_business';
export type OwnerReceptivity = 'interested' | 'neutral' | 'defensive' | 'no_answer';
export type VerificationNextAction = 'requeue' | 'create_campaign' | 'dismiss';

export interface VerificationRequestInput {
  queueEntryId: string;
  actingUserId?: string;
}

export interface VerificationResolutionInput {
  queueEntryId: string;
  outcome: VerificationOutcome;
  verifiedName?: string;
  verifiedPhone?: string;
  verifiedAddress?: string;
  verifiedCity?: string;
  verifiedState?: string;
  // Enrichment fields captured on the verification call — written onto the
  // queue entry's snapshot (and category column) so the campaign derive path
  // re-enriches the prospect's record instead of inheriting stale data.
  verifiedWebsite?: string;
  verifiedEmail?: string;
  verifiedCategory?: string;
  verifiedOwnerName?: string;
  ownerReceptivity?: OwnerReceptivity;
  callNotes?: string;
  nextAction: VerificationNextAction;
  actingUserId?: string;
}

export interface VerificationRecord {
  requested_at: string;
  requested_by: string | null;
  resolved_at?: string;
  resolved_by?: string | null;
  outcome?: VerificationOutcome;
  verified_name?: string;
  verified_phone?: string;
  verified_address?: string;
  verified_city?: string;
  verified_state?: string;
  verified_website?: string;
  verified_email?: string;
  verified_category?: string;
  verified_owner_name?: string;
  owner_receptivity?: OwnerReceptivity;
  call_notes?: string;
  next_action?: VerificationNextAction;
}

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
  // ─── Intelligence discovery fields (Sprint §5.10) ───────────────────
  // Populated when source_kind = 'intelligence_seek'. Stored on the dedicated
  // intelligence columns so the queue can render discovery assessment without
  // unpacking business_snapshot.
  category_fit?: 'verified' | 'probable' | 'insufficient';
  identity_confidence?: 'high' | 'medium' | 'low';
  location_status?: 'inside_city' | 'adjacent_city' | 'metro_area' | 'outside_market';
  discovery_provenance?: Record<string, any>[];
  discovery_signals?: string[];
  business_seek_priority?: 'high' | 'medium' | 'low' | 'hold';
  intelligence_run_id?: string;
  // When 'verify_then_outreach', the entry is created directly in the
  // verification state (skipping 'queued'). Used by discovery surfaces where
  // the audit already flagged NAP/digital presence as unable_to_verify and the
  // operator wants to send the prospect straight to phone verification.
  // Defaults to 'queued' (legacy behavior).
  initial_status?: 'queued' | 'verify_then_outreach';
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
  // Migration 262 — proving-ground tree scope: queue rows whose
  // source_campaign_id is any of these (the parent's intelligence children).
  source_campaign_ids?: string[];
  // Migration 282 — queue-list PG initiation: rows grouped directly into a
  // proving ground carry proving_ground_id. OR'd with source_campaign_ids
  // (dedup on row id is inherent — OR returns each row once).
  proving_ground_id?: string;
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
  // Migration 262 — account family groups prospects sharing an owner
  // (e.g. the Tairov storefronts): one operator, one thread. Editable on
  // hold/in_thread too — family assignment is identity, not cadence state.
  account_family?: string | null;
}

export interface CreateCampaignInput {
  queueEntryId: string;
  actingUserId?: string; // req.user.id — fallback for assigned_to
}

export interface DismissInput {
  queueEntryId: string;
  reason?: 'already_customer' | 'bad_fit' | 'duplicate' | 'unverified_closed' | 'other';
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
      // Parentless entries (manual adds, public_suggestion, lead-gen) have no
      // parent campaign — fall back to the input values directly.
      const isManual = !input.source_campaign_id;
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

      // Dedup: non-dismissed queue entry for the same normalized identity.
      // Business scope dedups on the full triple (business_name + city +
      // category). Category/city scope entries have no business_name, so they
      // dedup on city + category only (matching a null business_name row).
      // Matches every live status — queued, verify_then_outreach, hold,
      // in_thread, AND campaign_created — so a prospect that already
      // graduated to a campaign is never re-queued as a second row (the PG
      // promote panel would render both, and promoting both would mint
      // duplicate listings).
      const initialStatus = input.initial_status === 'verify_then_outreach'
        ? 'verify_then_outreach'
        : 'queued';
      const dedupWhere: any = {
        status: { in: ['queued', 'verify_then_outreach', 'hold', 'in_thread', 'campaign_created'] },
      };
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
        logger.info('addToQueue: returning existing queue entry', ctx, {
          existingId: existingQueued.id, businessName: businessName || null,
          existingStatus: existingQueued.status,
        });
        if (existingQueued.status === 'campaign_created' && existingQueued.processed_campaign_id) {
          return { kind: 'campaign_exists', campaignId: existingQueued.processed_campaign_id };
        }
        return { kind: 'already_queued', entry: existingQueued, created: false };
      }

      // Campaign-exists check (AC84 rule): a campaign for the same title +
      // city + state means the prospect is already in the pipeline — surface
      // it. Title is the primary identifier (required on input), and city +
      // state disambiguate geographically. This replaces the earlier
      // scope + city + category (+ business_name) check, which could return
      // false positives for different businesses in the same city+category.
      //
      // business_name is matched as an alternative key: campaigns derived
      // straight from an audit card (never queued) carry business_name with
      // title=null, so a title-only check missed them and the same prospect
      // could be queued again alongside its existing campaign.
      //
      // Inactive campaigns (dead/lost/closed/resolved_and_closed) don't
      // block — same semantics as the structural-duplicate guardrail: a
      // killed campaign frees the slot for a fresh run.
      //
      // Exclude the source/parent campaign (e.g. a city_category_audit that
      // discovered this prospect) — it is the originator, not a campaign for
      // this specific business, so matching it would falsely report the
      // prospect as already in the pipeline.
      const resolvedTitle = input.title.trim();
      const campaignExistsWhere: any = {
        stage: { notIn: [...INACTIVE_STAGES] },
        OR: [
          { title: { equals: resolvedTitle, mode: 'insensitive' } },
          ...(businessName
            ? [{ business_name: { equals: businessName, mode: 'insensitive' } }]
            : []),
        ],
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
          status: initialStatus,
          priority: input.priority ?? 'normal',
          note: input.note ?? null,
          queued_by: input.queuedBy ?? null,
          // When created directly in verify_then_outreach (from discovery
          // surfaces), stamp the verification request metadata so the queue
          // card can show who requested it and when.
          verification: initialStatus === 'verify_then_outreach'
            ? {
                requested_at: new Date().toISOString(),
                requested_by: input.queuedBy ?? null,
              } as any
            : undefined,
          // Intelligence discovery columns (Sprint §5.10). Populated when
          // source_kind = 'intelligence_seek'; null/undefined for other
          // source kinds (the columns are nullable).
          category_fit: input.category_fit ?? null,
          identity_confidence: input.identity_confidence ?? null,
          location_status: input.location_status ?? null,
          discovery_provenance: (input.discovery_provenance as any) ?? undefined,
          discovery_signals: (input.discovery_signals as any) ?? undefined,
          business_seek_priority: input.business_seek_priority ?? null,
          intelligence_run_id: input.intelligence_run_id ?? null,
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
      // Migration 262 — proving-ground tree scope: the worklist queries
      // `source_campaign_id IN (children of this proving ground)` (spec §5.2).
      // Migration 282 adds the direct proving_ground_id column — grouped
      // entries may have no source campaign, so the two linkages OR together
      // (each row returns once regardless of how many columns match).
      const pgLinkageOr: any[] = [];
      if (filters.source_campaign_ids?.length) {
        pgLinkageOr.push({ source_campaign_id: { in: filters.source_campaign_ids } });
      }
      if (filters.proving_ground_id) {
        pgLinkageOr.push({ proving_ground_id: filters.proving_ground_id });
      }
      if (pgLinkageOr.length === 1) {
        Object.assign(where, pgLinkageOr[0]);
      } else if (pgLinkageOr.length > 1) {
        where.AND = [...(where.AND ?? []), { OR: pgLinkageOr }];
      }
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

      // Audit coverage (pre-push tracking): when decorating with campaigns,
      // also flag which processed campaigns already have a business_analysis
      // audit — the proving-ground cockpit's promote panel uses it to steer
      // operators toward audit-first seeding (audits produce the richest
      // seed data for the public listings). Keyed on the processed_campaign_id
      // FK column, not the join, so the flag reflects the row's own state.
      const auditDates = new Map<string, Date>();
      const checklistCounts = new Map<string, number>();
      if (filters.includeCampaigns) {
        const campaignIds = entries
          .map((e: any) => e.processed_campaign_id)
          .filter(Boolean);
        if (campaignIds.length > 0) {
          // Only real audits count — queue-promotion placeholder audits
          // (audit_metadata.source = manual_queue/queue_promotion/
          // derived_from_parent) carry signals, not audit data.
          const audits = await this.prisma.$queryRaw<{ campaign_id: string; created_at: Date }[]>`
            SELECT campaign_id, created_at
            FROM mkt_audits_list
            WHERE campaign_id = ANY(${campaignIds})
              AND platform = 'business_analysis'
              AND COALESCE(audit_data->'audit_metadata'->>'source', '')
                NOT IN ('manual_queue', 'queue_promotion', 'derived_from_parent')
          `;
          for (const a of audits) {
            const prev = auditDates.get(a.campaign_id);
            if (!prev || a.created_at > prev) auditDates.set(a.campaign_id, a.created_at);
          }

          // Checklist emission (stage-culture fit §6.4 tier-1b, cheap
          // level): completed-step count per processed campaign in ONE
          // groupBy — no per-row getCampaignChecklist calls. Denominators
          // vary by effective playbook, so emit the raw completed count;
          // the checklist chip renders "checklist · N done" and the
          // campaign's checklist tab remains the full fraction view.
          // Progress rows persist after permanent steps leave their stage
          // window, so seed-wedge completions keep counting post-seek.
          const checklist = await this.prisma.mkt_campaign_checklist_progress.groupBy({
            by: ['campaign_id'],
            where: {
              campaign_id: { in: campaignIds },
              completed_at: { not: null },
            },
            _count: { step_id: true },
          });
          for (const p of checklist) {
            checklistCounts.set(p.campaign_id, p._count.step_id);
          }
        }
      }

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
              campaign_has_business_audit: e.processed_campaign_id ? auditDates.has(e.processed_campaign_id) : null,
              business_audit_at: e.processed_campaign_id ? auditDates.get(e.processed_campaign_id) ?? null : null,
              checklist_completed: e.processed_campaign_id ? checklistCounts.get(e.processed_campaign_id) ?? 0 : null,
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
      // account_family is identity metadata — editable on hold/in_thread too.
      // Cadence fields (priority/note/assigned_to) stay gated to open statuses.
      const onlyFamilyPatch =
        patch.account_family !== undefined &&
        patch.priority === undefined && patch.note === undefined && patch.assigned_to === undefined;
      const familyEditable = ['queued', 'verify_then_outreach', 'hold', 'in_thread'].includes(existing.status);
      const open = existing.status === 'queued' || existing.status === 'verify_then_outreach';
      if (!open && !(onlyFamilyPatch && familyEditable)) {
        throw new ConflictError(`Queue entry ${id} is not editable (status=${existing.status})`);
      }

      const data: any = {};
      if (patch.priority !== undefined) data.priority = patch.priority;
      if (patch.note !== undefined) data.note = patch.note;
      if (patch.account_family !== undefined) data.account_family = patch.account_family;
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

      // Verify-then-outreach gate (Migration 255): an entry pending
      // verification cannot graduate to a campaign via the direct
      // create-campaign endpoint. The operator must resolve the
      // verification first (resolveVerification with nextAction:
      // 'create_campaign'), which calls createCampaignFromQueue internally
      // after stamping the verification record. This prevents bypassing the
      // human-call gate for prospects with unverified NAP.
      if (entry.status === 'verify_then_outreach') {
        throw new ConflictError(
          `Queue entry ${input.queueEntryId} is pending verification — resolve verification before creating a campaign`,
        );
      }

      const assignee = entry.assigned_to ?? input.actingUserId ?? null;
      const snapshot = (entry.business_snapshot as any) ?? {};
      // Verified NAP/enrichment (written by resolveVerification) takes
      // precedence over the raw discovery snapshot so a correction captured
      // on the verification call flows into the campaign.
      const verifiedNap = (snapshot.verified_nap as Record<string, string> | undefined) ?? {};
      const snapshotOwnerNames = Array.isArray(snapshot.owner_names) ? (snapshot.owner_names as string[]) : undefined;
      const ownerNames = verifiedNap.owner_name
        ? [verifiedNap.owner_name]
        : ((snapshot.owner_name as string) ? [snapshot.owner_name as string] : snapshotOwnerNames);

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
          state: entry.state ?? undefined,
          assignedTo: assignee ?? undefined,
          // Contact enrichment from the snapshot (refreshed by verification
          // resolution) so the campaign is born with verified NAP + contacts.
          phone: (verifiedNap.phone as string) ?? (snapshot.phone as string) ?? undefined,
          email: (verifiedNap.email as string) ?? (snapshot.email as string) ?? undefined,
          websiteUrl: (verifiedNap.website as string) ?? (snapshot.website as string) ?? undefined,
          ownerNames,
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
        // assign a playbook immediately (mirrors the derive path). Snapshot
        // attributes ride along at the top level so the campaign → seed
        // attribute mining finds them (migration 267 sourced attributes).
        const signals = (entry.detected_signals as string[]) ?? [];
        const snapshotAttributes = Array.isArray(snapshot.attributes) ? snapshot.attributes : [];
        if (signals.length > 0 || snapshotAttributes.length > 0) {
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
                // Sourced attributes carried from the queue snapshot — the
                // campaign → seed path mines this block (migration 267).
                ...(snapshotAttributes.length > 0 ? { attributes: snapshotAttributes } : {}),
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
        // Verified NAP/enrichment is overlaid onto the scan-shape keys
        // (business_phone, website.url, business_name, category) so the
        // campaign is born with the values confirmed on the verification call.
        const scanBusiness: any = { ...snapshot };
        if (verifiedNap.name) scanBusiness.business_name = verifiedNap.name;
        if (verifiedNap.phone) scanBusiness.business_phone = verifiedNap.phone;
        if (verifiedNap.website) {
          scanBusiness.website = {
            ...((typeof snapshot.website === 'object' && snapshot.website) ? snapshot.website : {}),
            url: verifiedNap.website,
          };
        }
        if (verifiedNap.category) scanBusiness.category = verifiedNap.category;
        if (verifiedNap.email) scanBusiness.email = verifiedNap.email;
        const r = await MarketingHotProspectService.getInstance().deriveBusinessCampaignFromScanBusiness(
          entry.source_campaign_id,
          scanBusiness,
          ctx,
          { note: entry.note ?? undefined },
        );
        result = r;
        // The scan path derives city/state from the parent campaign — apply
        // the verified location when the operator captured a different one.
        const geoPatch: any = {};
        if (verifiedNap.city && r.campaign?.city !== verifiedNap.city) geoPatch.city = verifiedNap.city;
        if (verifiedNap.state && r.campaign?.state !== verifiedNap.state) geoPatch.state = verifiedNap.state;
        if (r.created && r.campaign?.id && Object.keys(geoPatch).length > 0) {
          await this.prisma.mkt_campaigns_list.update({
            where: { id: r.campaign.id },
            data: geoPatch,
          });
          r.campaign = { ...r.campaign, ...geoPatch };
        }
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

        // Migration 253 — GAP-E3: build discovery context from the queue entry
        // for intelligence_seek entries. The context carries discovery signals,
        // provenance, seek priority, category fit, and run lineage onto the
        // child business campaign so the audit prompt can render a "Discovery
        // leads" block as verification hypotheses (spec §8.3).
        //
        // Validation boundary (spec §6): invalid context is logged and dropped
        // here at handoff time — never blocks campaign creation. The
        // render-time check in renderDiscoveryLeadsBlock is cheap defense only.
        let discoveryContext: DiscoveryContext | null = null;
        let intelligenceRunId: string | undefined;
        if (entry.source_kind === 'intelligence_seek') {
          intelligenceRunId = entry.intelligence_run_id ?? undefined;
          const focus = await this.resolveRunFocus(entry.intelligence_run_id, ctx);
          const rawContext = {
            focus,
            discovered_at: entry.created_at?.toISOString?.() ?? (entry.created_at as any) ?? undefined,
            business_seek_priority: entry.business_seek_priority ?? undefined,
            category_fit: entry.category_fit ?? undefined,
            identity_confidence: entry.identity_confidence ?? undefined,
            location_status: entry.location_status ?? undefined,
            seek_batch_id: entry.seek_batch_id ?? undefined,
            discovery_signals: (entry.discovery_signals as string[]) ?? [],
            discovery_provenance: (entry.discovery_provenance as any[]) ?? [],
          };
          discoveryContext = validateDiscoveryContext(rawContext);
          if (!discoveryContext) {
            logger.warn('createCampaignFromQueue: discovery context invalid or empty — dropped (non-fatal)', ctx, {
              queueEntryId: input.queueEntryId,
              intelligenceRunId: intelligenceRunId ?? null,
            });
          }
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
          // Migration 253 — GAP-E3 discovery context handoff
          discoveryContext: discoveryContext ?? undefined,
          intelligenceRunId,
          // Migration 253 — GAP-E4 NAP handoff: forward the discovery
          // snapshot's contact + address fields so the derived campaign
          // inherits NAP from the queue entry (set by the discovery card's
          // Queue/Verify actions) instead of only business_name. The flat
          // `address` string maps to addressLine1. Verified values captured
          // on the verification call (business_snapshot.verified_nap) take
          // precedence over the raw discovery snapshot.
          phone: (verifiedNap.phone as string) ?? (snapshot.phone as string) ?? undefined,
          email: (verifiedNap.email as string) ?? (snapshot.email as string) ?? undefined,
          websiteUrl: (verifiedNap.website as string)
            ?? (typeof snapshot.website === 'string' ? snapshot.website : ((snapshot.website as any)?.url as string | undefined))
            ?? undefined,
          gbpUrl: (snapshot.gbp_url as string) ?? undefined,
          addressLine1: (verifiedNap.address as string) ?? (snapshot.address as string) ?? undefined,
          addressCity: (verifiedNap.city as string) ?? (snapshot.address_city as string) ?? undefined,
          addressState: (verifiedNap.state as string) ?? (snapshot.address_state as string) ?? undefined,
          addressZip: (snapshot.address_zip as string) ?? undefined,
          addressCountry: (snapshot.address_country as string) ?? undefined,
          ownerNames,
          // Category corrected on the verification call overrides the
          // parent-inherited category (undefined → inherit as before).
          categoryOverride: (verifiedNap.category as string) ?? undefined,
        }, ctx);
        result = { campaign, created: true };
      }

      // Attribute handoff (migration 267): when the queue snapshot carries
      // sourced attributes, stamp them onto a business_analysis audit on the
      // campaign so createFromCampaign mines them at seed time. Covers the
      // thin derive path (the scan path already stores the full business JSON
      // in its city_analysis audit, and the manual path stamps its own audit
      // above). Best-effort — attribute handoff never blocks promotion.
      const snapshotAttributes = Array.isArray((entry.business_snapshot as any)?.attributes)
        ? (entry.business_snapshot as any).attributes
        : [];
      if (snapshotAttributes.length > 0 && result.campaign?.id) {
        try {
          const { generateMarketingAuditId } = await import('../lib/id-generator.js');
          const existingAttrAudit = await this.prisma.mkt_audits_list.findFirst({
            where: { campaign_id: result.campaign.id, platform: 'business_analysis' },
            orderBy: { created_at: 'desc' },
          });
          if (existingAttrAudit) {
            const merged = {
              ...(existingAttrAudit.audit_data as any),
              attributes: snapshotAttributes,
            };
            await this.prisma.mkt_audits_list.update({
              where: { id: existingAttrAudit.id },
              data: { audit_data: merged as any },
            });
          } else {
            const attrAuditId = generateMarketingAuditId();
            await this.prisma.mkt_audits_list.create({
              data: {
                id: attrAuditId,
                campaign_id: result.campaign.id,
                platform: 'business_analysis',
                audit_data: {
                  audit_metadata: {
                    business_name: entry.business_name,
                    source: 'queue_promotion',
                  },
                  attributes: snapshotAttributes,
                } as any,
              },
            });
          }
        } catch (attrError) {
          logger.warn('createCampaignFromQueue: attribute handoff failed (non-fatal)', ctx, {
            queueEntryId: input.queueEntryId,
            error: (attrError as Error).message,
          });
        }
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

      // PG retrofit (D2 — CAMPAIGN_SEED_STAGE_SPRINT_PLAN): a queue entry
      // carrying seed_id was preflight-seeded by its proving ground — the
      // seed wedge (listing created + published, claim token minted +
      // invited) is already done. Graduate the campaign straight into
      // `seed` instead of `seek`, and mark the objectively-complete
      // seed-wedge checklist steps done so the checklist reflects the
      // preflight work. qcSeed stays unchecked — field-level QC is still
      // human review. Non-fatal: graduation must never fail on the
      // advance. The stage guard keeps dedup-attached campaigns that have
      // already progressed past seek untouched.
      if (entry.seed_id && result.campaign?.id && result.campaign.stage === 'seek') {
        try {
          await MarketingCampaignService.transitionStage({
            campaignId: result.campaign.id,
            toStage: 'seed',
            triggerType: 'automated',
            notes: `Auto-advanced on queue graduation — proving-ground preflight minted seed ${entry.seed_id}.`,
          }, ctx);
          result.campaign = { ...result.campaign, stage: 'seed' };

          const { generateCampaignChecklistProgressId } = await import('../lib/id-generator.js');
          for (const stepId of [
            '_permanent_seed_place_listing',
            '_permanent_publish_seed',
            '_permanent_mint_claim_token',
            '_permanent_pitch_free_claim',
          ]) {
            await this.prisma.mkt_campaign_checklist_progress.upsert({
              where: { campaign_id_step_id: { campaign_id: result.campaign.id, step_id: stepId } },
              create: {
                id: generateCampaignChecklistProgressId(),
                campaign_id: result.campaign.id,
                step_id: stepId,
                completed_at: new Date(),
                completed_by: 'pg_preflight',
                note: `Auto-completed — proving-ground preflight minted seed ${entry.seed_id}.`,
              },
              update: {
                completed_at: new Date(),
                completed_by: 'pg_preflight',
              },
            });
          }
        } catch (advanceError) {
          logger.warn('createCampaignFromQueue: seed auto-advance failed (non-fatal)', ctx, {
            queueEntryId: input.queueEntryId,
            campaignId: result.campaign?.id,
            error: (advanceError as Error).message,
          });
        }
      }

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
   * Resolve the intelligence focus ('emerging' | 'competitive') from the
   * source run row (Migration 253 — GAP-E3, spec §8.3). Focus is not a queue
   * column — it lives on mkt_intelligence_runs. Returns undefined when the
   * run row is missing or the column is unset, so the leads block renders
   * without the focus parenthetical (graceful degradation).
   */
  private async resolveRunFocus(
    intelligenceRunId: string | null | undefined,
    ctx?: RequestCtx,
  ): Promise<'emerging' | 'competitive' | undefined> {
    if (!intelligenceRunId) return undefined;
    try {
      const run = await this.prisma.mkt_intelligence_runs.findUnique({
        where: { id: intelligenceRunId },
        select: { focus: true },
      });
      const focus = run?.focus;
      if (focus === 'emerging' || focus === 'competitive') return focus;
      return undefined;
    } catch (error) {
      logger.warn('resolveRunFocus: failed to load run row (non-fatal)', ctx, {
        intelligenceRunId,
        error: (error as Error).message,
      });
      return undefined;
    }
  }

  /**
   * Move a queued entry into the verify_then_outreach status. The operator
   * is signaling that the prospect needs a human phone call to confirm
   * operational status and capture a verified NAP before a campaign is
   * created. Only callable from the 'queued' status — prevents
   * double-request and prevents moving already-graduated rows backward.
   *
   * The entry remains editable (assign, note, priority) while in
   * verify_then_outreach — the verification task is itself assignable work.
   */
  async requestVerification(input: VerificationRequestInput, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_prospect_queue.findUnique({
        where: { id: input.queueEntryId },
      });
      if (!existing) {
        throw new NotFoundError(`Queue entry ${input.queueEntryId} not found`);
      }
      if (existing.status !== 'queued') {
        throw new ConflictError(
          `Queue entry ${input.queueEntryId} cannot be moved to verify (status=${existing.status})`,
        );
      }

      const now = new Date().toISOString();
      const verification: VerificationRecord = {
        requested_at: now,
        requested_by: input.actingUserId ?? null,
      };

      const updated = await this.prisma.mkt_prospect_queue.update({
        where: { id: input.queueEntryId },
        data: {
          status: 'verify_then_outreach',
          verification: verification as any,
        },
      });
      logger.info('requestVerification: entry moved to verify_then_outreach', ctx, {
        id: input.queueEntryId, requestedBy: input.actingUserId ?? null,
      });
      return updated;
    } catch (error) {
      logger.error('requestVerification failed', ctx, {
        error: (error as Error).message,
        queueEntryId: input.queueEntryId,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Resolve a verify_then_outreach entry after the operator's phone call.
   * Branches on nextAction:
   *
   *  - 'requeue': status → 'queued'. Verified NAP fields (when provided)
   *    are written onto the row's top-level columns (business_name, city,
   *    state) and into business_snapshot.verified_nap so the campaign
   *    derive path picks them up.
   *  - 'create_campaign': stamps the verification record, then calls
   *    createCampaignFromQueue internally (the status is flipped back to
   *    'queued' first so the create-campaign guard passes). The verified
   *    NAP flows into the campaign via the snapshot.
   *  - 'dismiss': status → 'dismissed', dismissed_reason = 'unverified_closed'.
   *
   * Only callable from 'verify_then_outreach'. Resolving an already-resolved
   * row → 409 (except 'dismiss' which is idempotent, matching dismiss()).
   */
  async resolveVerification(input: VerificationResolutionInput, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_prospect_queue.findUnique({
        where: { id: input.queueEntryId },
      });
      if (!existing) {
        throw new NotFoundError(`Queue entry ${input.queueEntryId} not found`);
      }
      if (existing.status !== 'verify_then_outreach') {
        throw new ConflictError(
          `Queue entry ${input.queueEntryId} is not pending verification (status=${existing.status})`,
        );
      }

      const prior = (existing.verification as any) ?? {};
      const resolvedVerification: VerificationRecord = {
        ...prior,
        resolved_at: new Date().toISOString(),
        resolved_by: input.actingUserId ?? null,
        outcome: input.outcome,
        verified_name: input.verifiedName,
        verified_phone: input.verifiedPhone,
        verified_address: input.verifiedAddress,
        verified_city: input.verifiedCity,
        verified_state: input.verifiedState,
        verified_website: input.verifiedWebsite,
        verified_email: input.verifiedEmail,
        verified_category: input.verifiedCategory,
        verified_owner_name: input.verifiedOwnerName,
        owner_receptivity: input.ownerReceptivity,
        call_notes: input.callNotes,
        next_action: input.nextAction,
      };

      // Build the NAP patch — only apply verified fields when the operator
      // captured them (operational / relocated outcomes). Empty strings are
      // treated as "not captured" (null) so we don't overwrite existing
      // values with blanks.
      const napPatch: any = {};
      if (input.verifiedName && input.verifiedName.trim()) napPatch.business_name = input.verifiedName.trim();
      if (input.verifiedCity && input.verifiedCity.trim()) napPatch.city = input.verifiedCity.trim();
      if (input.verifiedState && input.verifiedState.trim()) napPatch.state = input.verifiedState.trim();
      if (input.verifiedCategory && input.verifiedCategory.trim()) napPatch.category = input.verifiedCategory.trim();

      // Merge verified NAP + enrichment into the business_snapshot so the
      // campaign derive path can pick them up. Verified values are written
      // both to the verified_nap provenance block and to the flat snapshot
      // keys the derive paths read (phone, email, website, address*, owner).
      // We preserve all existing snapshot fields.
      const snapshot = (existing.business_snapshot as any) ?? {};
      const verifiedNap: Record<string, string> = {};
      if (input.verifiedName?.trim()) verifiedNap.name = input.verifiedName.trim();
      if (input.verifiedPhone?.trim()) verifiedNap.phone = input.verifiedPhone.trim();
      if (input.verifiedAddress?.trim()) verifiedNap.address = input.verifiedAddress.trim();
      if (input.verifiedCity?.trim()) verifiedNap.city = input.verifiedCity.trim();
      if (input.verifiedState?.trim()) verifiedNap.state = input.verifiedState.trim();
      if (input.verifiedWebsite?.trim()) verifiedNap.website = input.verifiedWebsite.trim();
      if (input.verifiedEmail?.trim()) verifiedNap.email = input.verifiedEmail.trim();
      if (input.verifiedCategory?.trim()) verifiedNap.category = input.verifiedCategory.trim();
      if (input.verifiedOwnerName?.trim()) verifiedNap.owner_name = input.verifiedOwnerName.trim();

      // Flat enrichment — mirrors verified values onto the snapshot keys the
      // campaign derive paths read, so a verified correction (e.g. phone
      // captured on the call) replaces the discovery-pass value. `website`
      // is only flattened when the existing snapshot stores it as a string —
      // scan snapshots store it as an object ({ status, url }), which the
      // create-campaign paths overlay separately.
      const flatEnrichment: Record<string, string> = {};
      if (verifiedNap.phone) flatEnrichment.phone = verifiedNap.phone;
      if (verifiedNap.email) flatEnrichment.email = verifiedNap.email;
      if (verifiedNap.website && typeof snapshot.website !== 'object') flatEnrichment.website = verifiedNap.website;
      if (verifiedNap.address) flatEnrichment.address = verifiedNap.address;
      if (verifiedNap.city) flatEnrichment.address_city = verifiedNap.city;
      if (verifiedNap.state) flatEnrichment.address_state = verifiedNap.state;
      if (verifiedNap.owner_name) flatEnrichment.owner_name = verifiedNap.owner_name;
      if (verifiedNap.address || verifiedNap.city || verifiedNap.state) {
        flatEnrichment.location = [verifiedNap.address, verifiedNap.city ?? snapshot.address_city, verifiedNap.state ?? snapshot.address_state]
          .filter(Boolean).join(', ');
      }

      const hasVerified = Object.keys(verifiedNap).length > 0;
      const updatedSnapshot = hasVerified
        ? {
            ...snapshot,
            ...flatEnrichment,
            verified_nap: { ...((snapshot.verified_nap as any) ?? {}), ...verifiedNap },
          }
        : snapshot;

      if (input.nextAction === 'dismiss') {
        const updated = await this.prisma.mkt_prospect_queue.update({
          where: { id: input.queueEntryId },
          data: {
            status: 'dismissed',
            dismissed_reason: 'unverified_closed',
            processed_at: new Date(),
            verification: resolvedVerification as any,
            ...napPatch,
            business_snapshot: updatedSnapshot as any,
          },
        });
        logger.info('resolveVerification: dismissed (unverified_closed)', ctx, {
          id: input.queueEntryId, outcome: input.outcome,
        });
        return { queueEntry: updated, campaign: null, created: false };
      }

      if (input.nextAction === 'requeue') {
        const updated = await this.prisma.mkt_prospect_queue.update({
          where: { id: input.queueEntryId },
          data: {
            status: 'queued',
            verification: resolvedVerification as any,
            ...napPatch,
            business_snapshot: updatedSnapshot as any,
          },
        });
        logger.info('resolveVerification: re-queued with verified NAP', ctx, {
          id: input.queueEntryId, outcome: input.outcome,
          napFields: Object.keys(napPatch),
        });
        return { queueEntry: updated, campaign: null, created: false };
      }

      // nextAction === 'create_campaign'
      // Flip status back to 'queued' + stamp verification + write NAP, then
      // delegate to createCampaignFromQueue. The create-campaign guard
      // (which blocks verify_then_outreach) is satisfied because the row is
      // now 'queued' again.
      await this.prisma.mkt_prospect_queue.update({
        where: { id: input.queueEntryId },
        data: {
          status: 'queued',
          verification: resolvedVerification as any,
          ...napPatch,
          business_snapshot: updatedSnapshot as any,
        },
      });

      const campaignResult = await this.createCampaignFromQueue({
        queueEntryId: input.queueEntryId,
        actingUserId: input.actingUserId,
      }, ctx);

      logger.info('resolveVerification: created campaign after verification', ctx, {
        id: input.queueEntryId, campaignId: campaignResult.campaign.id,
        outcome: input.outcome,
      });
      return {
        queueEntry: campaignResult.queueEntry,
        campaign: campaignResult.campaign,
        created: campaignResult.created,
      };
    } catch (error) {
      logger.error('resolveVerification failed', ctx, {
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
