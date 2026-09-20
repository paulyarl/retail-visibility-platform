/**
 * RepairFulfillmentService — Track A profile-repair fulfillment state.
 *
 * Owns reads/writes of mkt_campaigns_list.repair_fulfillment:
 *   { tier, mode, platforms[], sla_hours, sla_due_at, canonical_nap,
 *     platform_status{}, access_intake_id, access_collected_at,
 *     seed_id, seed_claimed, claimed_at, completion{}, escalated_from }
 *
 * Spec: docs/LocalBiz/PROFILE_REPAIR_FULFILLMENT_SPRINT.md (W2, W7).
 *
 * The JSONB is the single source of truth for package configuration
 * (operator-set via PATCH) and execution tracking (adapter + operator
 * writes). Writes always deep-merge — adapter-owned keys
 * (canonical_nap, platform_status, access_*, sla_due_at, seed_*,
 * completion, escalated_from) are never clobbered by the config PATCH.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler';
import {
  REPAIR_TIER_CATALOG,
  REPAIR_PLATFORM_STATUSES,
  isRepairTier,
  isRepairMode,
  outOfScopePlatforms,
  type RepairTier,
  type RepairMode,
  type RepairPlatformStatus,
} from '../lib/repair-tiers';
import { generateCampaignId, generateStageHistoryId, generateBusinessProspectId } from '../lib/id-generator';
import { isStubBusinessAnalysisAudit } from '../lib/marketing-audits';

export interface RepairFulfillmentPatch {
  tier?: RepairTier;
  mode?: RepairMode;
  platforms?: string[];
  sla_hours?: number;
}

export interface PlatformStatusPatch {
  status: RepairPlatformStatus;
  note?: string;
}

/** Keys owned by adapters/system — never overwritten by the config PATCH. */
const ADAPTER_OWNED_KEYS = new Set([
  'canonical_nap',
  'platform_status',
  'access_intake_id',
  'access_collected_at',
  'sla_due_at',
  'seed_id',
  'seed_claimed',
  'claimed_at',
  'completion',
  'escalated_from',
]);

/** Map audit-scope platform display names → tier-catalog platform keys. */
const AUDIT_PLATFORM_TO_KEY: Record<string, string> = {
  google: 'google',
  googlebusinessprofile: 'google',
  gbp: 'google',
  facebook: 'facebook',
  yelp: 'yelp',
  bbb: 'bbb',
  betterbusinessbureau: 'bbb',
  applemaps: 'apple_maps',
  apple: 'apple_maps',
  bingplaces: 'bing_places',
  bing: 'bing_places',
};

function normalizeAuditPlatform(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return AUDIT_PLATFORM_TO_KEY[norm] ?? null;
}

export class RepairFulfillmentService extends BaseService {
  private static instance: RepairFulfillmentService;

  private constructor() {
    super();
  }

  static getInstance(): RepairFulfillmentService {
    if (!RepairFulfillmentService.instance) {
      RepairFulfillmentService.instance = new RepairFulfillmentService();
    }
    return RepairFulfillmentService.instance;
  }

  // ====================
  // W2 — PACKAGE CONFIG PATCH
  // ====================

  /**
   * Deep-merge operator config into repair_fulfillment. Only
   * profile_repair + standard-track campaigns carry a package.
   *
   * Rules (spec W2):
   *  - platforms must be within the tier's scope
   *  - mode is immutable once access_collected_at is set
   *  - tier default platforms = tier scope ∩ latest audit affected_platforms
   *    (empty intersection → full tier scope)
   *  - sla_hours defaults to the tier default (48h; 24h premium)
   *  - switching mode to dfy opportunistically mints the access intake link
   */
  async updateRepairFulfillment(
    campaignId: string,
    patch: RepairFulfillmentPatch,
    ctx?: RequestCtx,
  ): Promise<any> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) throw new NotFoundError(`Campaign ${campaignId} not found`);

      if (campaign.campaign_category !== 'profile_repair' || campaign.repair_track !== 'standard') {
        throw new ValidationError(
          'Package configuration is only available for Track A profile-repair campaigns ' +
          '(campaign_category=profile_repair, repair_track=standard).',
        );
      }

      const rf = { ...((campaign.repair_fulfillment as Record<string, any> | null) ?? {}) };

      // Mode immutability after access collection
      if (patch.mode !== undefined && !isRepairMode(patch.mode)) {
        throw new ValidationError(`mode must be 'diy' or 'dfy'`);
      }
      if (patch.mode && rf.access_collected_at && patch.mode !== rf.mode) {
        throw new ConflictError(
          'mode_locked: the fulfillment mode cannot change after access has been collected ' +
          '(access_collected_at is set).',
        );
      }

      const tier: RepairTier | undefined = patch.tier;
      if (tier !== undefined && !isRepairTier(tier)) {
        throw new ValidationError(`tier must be standard|plus|premium`);
      }
      const effectiveTier: RepairTier | undefined = tier ?? (isRepairTier(rf.tier) ? rf.tier : undefined);
      const effectiveMode: RepairMode | undefined =
        patch.mode ?? (isRepairMode(rf.mode) ? rf.mode : undefined);

      // Premium has no DIY mode
      if (effectiveTier === 'premium' && effectiveMode === 'diy') {
        throw new ValidationError('Premium tier is DFY-only (24h SLA, full platform sweep).');
      }

      // Platform scope validation
      if (patch.platforms !== undefined) {
        if (!Array.isArray(patch.platforms)) {
          throw new ValidationError('platforms must be an array');
        }
        if (!effectiveTier) {
          throw new ValidationError('Set a tier before choosing platforms.');
        }
        const outOfScope = outOfScopePlatforms(effectiveTier, patch.platforms);
        if (outOfScope.length > 0) {
          throw new ValidationError(
            `Platforms out of scope for ${effectiveTier}: ${outOfScope.join(', ')}. ` +
            `Allowed: ${REPAIR_TIER_CATALOG[effectiveTier].platforms.join(', ')}.`,
          );
        }
      }

      // Build the merged object — adapter-owned keys survive untouched.
      if (tier !== undefined) rf.tier = tier;
      if (patch.mode !== undefined) rf.mode = patch.mode;

      if (patch.platforms !== undefined) {
        rf.platforms = patch.platforms;
      } else if (tier !== undefined && !rf.platforms) {
        // Default on tier set: tier scope ∩ latest audit affected_platforms.
        const auditPlatforms = await this.latestAuditAffectedPlatforms(campaignId, ctx);
        const intersection = REPAIR_TIER_CATALOG[tier].platforms.filter((p) =>
          auditPlatforms.has(p),
        );
        rf.platforms = intersection.length > 0 ? intersection : [...REPAIR_TIER_CATALOG[tier].platforms];
      }

      if (patch.sla_hours !== undefined) {
        rf.sla_hours = patch.sla_hours;
      } else if (tier !== undefined && rf.sla_hours === undefined) {
        rf.sla_hours = REPAIR_TIER_CATALOG[tier].slaHours;
      }

      const updated = await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: { repair_fulfillment: rf },
      });

      // Opportunistic DFY intake mint: switching to dfy with no existing
      // access intake mints the link so the operator can send it immediately.
      let accessIntake: { intakeId: string; shortUrl: string; url: string } | null = null;
      if (patch.mode === 'dfy' || (effectiveMode === 'dfy' && rf.access_intake_id === undefined)) {
        const existing = await this.prisma.mkt_dispute_intake.findFirst({
          where: { campaign_id: campaignId, intake_kind: 'profile_repair_access' },
          select: { id: true },
        });
        if (!existing) {
          try {
            const { default: disputeIntakeService } = await import('./DisputeIntakeService.js');
            const link = await disputeIntakeService.generateIntakeLink(campaignId, ctx, 'profile_repair_access');
            accessIntake = { intakeId: link.intakeId, shortUrl: link.shortUrl, url: link.url };
            rf.access_intake_id = link.intakeId;
            await this.prisma.mkt_campaigns_list.update({
              where: { id: campaignId },
              data: { repair_fulfillment: rf },
            });
          } catch (mintErr) {
            logger.warn('Opportunistic DFY access-intake mint failed', ctx, {
              campaignId,
              error: (mintErr as Error).message,
            });
          }
        }
      }

      logger.info('repair_fulfillment updated', ctx, { campaignId, tier: rf.tier, mode: rf.mode });
      return { repair_fulfillment: rf, campaign: updated, access_intake: accessIntake };
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Latest non-stub business_analysis audit's scope.affected_platforms,
   * normalized to tier-catalog platform keys. Empty set when no audit.
   */
  private async latestAuditAffectedPlatforms(campaignId: string, ctx?: RequestCtx): Promise<Set<string>> {
    const keys = new Set<string>();
    try {
      const audits = await this.prisma.mkt_audits_list.findMany({
        where: { campaign_id: campaignId, platform: 'business_analysis' },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { audit_data: true },
      });
      const audit = audits.find((a) => !isStubBusinessAnalysisAudit(a));
      const scope = (audit?.audit_data as any)?.profile_repair_audit?.scope
        ?? (audit?.audit_data as any)?.scope;
      const affected = Array.isArray(scope?.affected_platforms) ? scope.affected_platforms : [];
      for (const p of affected) {
        const key = normalizeAuditPlatform(p);
        if (key) keys.add(key);
      }
    } catch (error) {
      logger.warn('latestAuditAffectedPlatforms lookup failed', ctx, {
        campaignId,
        error: (error as Error).message,
      });
    }
    return keys;
  }

  // ====================
  // W7 — PER-PLATFORM STATUS
  // ====================

  /**
   * Update a single platform's execution status on the fulfillment card.
   * `verified` stamps verified_at; every write stamps updated_at.
   */
  async updatePlatformStatus(
    campaignId: string,
    platform: string,
    patch: PlatformStatusPatch,
    ctx?: RequestCtx,
  ): Promise<any> {
    try {
      if (!(REPAIR_PLATFORM_STATUSES as readonly string[]).includes(patch.status)) {
        throw new ValidationError(
          `status must be one of: ${REPAIR_PLATFORM_STATUSES.join(', ')}`,
        );
      }

      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { id: true, repair_fulfillment: true },
      });
      if (!campaign) throw new NotFoundError(`Campaign ${campaignId} not found`);

      const rf = { ...((campaign.repair_fulfillment as Record<string, any> | null) ?? {}) };
      const statusMap = { ...((rf.platform_status as Record<string, any>) ?? {}) };
      const entry = { ...((statusMap[platform] as Record<string, any>) ?? {}) };

      entry.status = patch.status;
      entry.updated_at = new Date().toISOString();
      if (patch.status === 'verified') {
        entry.verified_at = entry.verified_at ?? new Date().toISOString();
      }
      if (patch.note !== undefined) entry.note = patch.note;

      statusMap[platform] = entry;
      rf.platform_status = statusMap;

      await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: { repair_fulfillment: rf },
      });

      logger.info('Repair platform status updated', ctx, { campaignId, platform, status: patch.status });
      return { platform, entry };
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Seed platform_status rows when the citation_repair_package deliverable
   * is generated (spec §4: "DIY by seeding customer_pending per platform
   * when the package deliverable is generated"). DFY rows are written by
   * the access-intake adapter instead — this is a no-op for mode='dfy'.
   * Existing entries are never clobbered.
   */
  async seedPlatformStatusesOnPackageGeneration(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<{ seeded: string[] }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { id: true, repair_fulfillment: true },
      });
      if (!campaign) throw new NotFoundError(`Campaign ${campaignId} not found`);

      const rf = { ...((campaign.repair_fulfillment as Record<string, any> | null) ?? {}) };
      if (rf.mode !== 'diy' || !Array.isArray(rf.platforms)) return { seeded: [] };

      const statusMap = { ...((rf.platform_status as Record<string, any>) ?? {}) };
      const seeded: string[] = [];
      for (const platform of rf.platforms as string[]) {
        if (statusMap[platform]) continue;
        statusMap[platform] = { status: 'customer_pending', updated_at: new Date().toISOString() };
        seeded.push(platform);
      }
      if (seeded.length === 0) return { seeded };

      rf.platform_status = statusMap;
      await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: { repair_fulfillment: rf },
      });

      logger.info('DIY platform statuses seeded', ctx, { campaignId, seeded });
      return { seeded };
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // W7 — PLATFORM ESCALATION (Track A → Track B sibling)
  // ====================

  /**
   * Atomically spawn a Track B escalated sibling for one platform and stamp
   * the parent's platform_status entry as escalated. Both writes happen in a
   * single transaction — a sibling-creation failure leaves no partial stamp.
   *
   * The sibling inherits the parent's business_prospect_id (audit context
   * inheritance comes free via loadPrimarySiblingAudits) and starts at
   * 'audit_identified' — the recovery machine's first stage.
   */
  async escalatePlatform(
    campaignId: string,
    platform: string,
    input: { issueType: string; notes?: string; changedBy?: string },
    ctx?: RequestCtx,
  ): Promise<{ sibling: any; platform_status: any }> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const parent = await tx.mkt_campaigns_list.findUnique({
          where: { id: campaignId },
        });
        if (!parent) throw new NotFoundError(`Campaign ${campaignId} not found`);
        if (parent.campaign_category !== 'profile_repair' || parent.repair_track !== 'standard') {
          throw new ValidationError('Escalation is only available on Track A profile-repair campaigns.');
        }

        const rf = { ...((parent.repair_fulfillment as Record<string, any>) ?? {}) };
        const statusMap = { ...((rf.platform_status as Record<string, any>) ?? {}) };
        const entry = { ...((statusMap[platform] as Record<string, any>) ?? {}) };

        if (entry.status === 'escalated' && entry.escalated_campaign_id) {
          throw new ConflictError(`Platform '${platform}' is already escalated to ${entry.escalated_campaign_id}.`);
        }

        // Ensure the parent has a prospect id so the sibling groups correctly.
        let prospectId = parent.business_prospect_id as string | null;
        if (!prospectId) {
          prospectId = generateBusinessProspectId();
          await tx.mkt_campaigns_list.update({
            where: { id: parent.id },
            data: { business_prospect_id: prospectId, is_primary_sibling: true },
          });
        }

        const siblingId = generateCampaignId();
        const escalatedAt = new Date();
        const sibling = await tx.mkt_campaigns_list.create({
          data: {
            id: siblingId,
            scope: 'business',
            campaign_category: 'profile_repair',
            repair_track: 'escalated',
            repair_issue_type: input.issueType,
            title: parent.title,
            business_name: parent.business_name,
            category: parent.category,
            secondary_categories: parent.secondary_categories as any,
            city: parent.city,
            state: parent.state,
            neighborhood: parent.neighborhood,
            contact_method: parent.contact_method,
            contact_info: parent.contact_info,
            phone: parent.phone,
            email: parent.email,
            website_url: parent.website_url,
            social_profiles: parent.social_profiles as any,
            owner_names: parent.owner_names as any,
            phones: parent.phones as any,
            address_line1: parent.address_line1,
            address_line2: parent.address_line2,
            address_city: parent.address_city,
            address_state: parent.address_state,
            address_zip: parent.address_zip,
            address_country: parent.address_country,
            directory_profiles: parent.directory_profiles as any,
            gbp_claimed: parent.gbp_claimed,
            has_website: parent.has_website,
            nap_consistent: parent.nap_consistent,
            estimated_tier: parent.estimated_tier,
            pain_score: parent.pain_score,
            tone: parent.tone,
            attributes: parent.attributes as any,
            assigned_to: parent.assigned_to,
            notes:
              `Escalated from Track A campaign ${parent.id} — platform '${platform}' ` +
              `requires Track B scope (${input.issueType}).` +
              (input.notes ? ` Operator notes: ${input.notes}` : ''),
            customer_id: parent.customer_id,
            tenant_id: parent.tenant_id,
            business_prospect_id: prospectId,
            is_primary_sibling: false,
            engagement_cycle: 1,
            stage: 'audit_identified',
            stage_entered_at: escalatedAt,
            service_category: parent.service_category,
            repair_fulfillment: {
              escalated_from: {
                campaign_id: parent.id,
                platform,
                escalated_at: escalatedAt.toISOString(),
              },
            },
          },
        });

        await tx.mkt_stage_history_list.create({
          data: {
            id: generateStageHistoryId(),
            campaign_id: siblingId,
            from_stage: null,
            to_stage: 'audit_identified',
            notes: `Track B sibling spawned by platform escalation (${platform}: ${input.issueType})`,
            trigger_type: 'system',
            changed_by: input.changedBy || null,
          },
        });

        // Stamp the parent's platform row — same transaction, so a failure
        // above leaves no partial escalation mark.
        entry.status = 'escalated';
        entry.escalated_campaign_id = siblingId;
        entry.updated_at = escalatedAt.toISOString();
        statusMap[platform] = entry;
        rf.platform_status = statusMap;

        await tx.mkt_campaigns_list.update({
          where: { id: parent.id },
          data: { repair_fulfillment: rf },
        });

        return { sibling, entry };
      });

      logger.info('Platform escalated to Track B sibling', ctx, {
        campaignId,
        platform,
        siblingId: result.sibling.id,
        issueType: input.issueType,
      });
      return { sibling: result.sibling, platform_status: result.entry };
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // W7 — EXECUTION READ MODEL (RepairExecutionCard)
  // ====================

  /**
   * Assemble the execution-card read model: fulfillment config, per-platform
   * status, SLA countdown fields, seed-link info, and DFY intake state.
   */
  async getRepairExecution(campaignId: string, ctx?: RequestCtx): Promise<any> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          campaign_category: true,
          repair_track: true,
          repair_fulfillment: true,
          stage: true,
        },
      });
      if (!campaign) throw new NotFoundError(`Campaign ${campaignId} not found`);

      const rf = (campaign.repair_fulfillment as Record<string, any> | null) ?? {};

      // Linked seed — prefer the primary link row.
      const seedLink = await this.prisma.directory_seed_campaign_links.findFirst({
        where: { campaign_id: campaignId },
        orderBy: [{ link_role: 'asc' }, { created_at: 'asc' }],
        select: {
          seed_id: true,
          link_role: true,
          nap_match_confidence: true,
          nap_match_summary: true,
          directory_presence_seeds: { select: { status: true, claimed_at: true } },
        },
      });

      // DFY access intake state
      let accessIntake: any = null;
      const intakeRow = await this.prisma.mkt_dispute_intake.findFirst({
        where: { campaign_id: campaignId, intake_kind: 'profile_repair_access' },
        select: {
          id: true,
          short_code: true,
          submitted_at: true,
          viewed_count: true,
          expires_at: true,
          _count: { select: { mkt_dispute_attachments: true } },
        },
      });
      if (intakeRow) {
        accessIntake = {
          intake_id: intakeRow.id,
          short_code: intakeRow.short_code,
          short_url: intakeRow.short_code ? `/i/${intakeRow.short_code}` : null,
          submitted_at: intakeRow.submitted_at,
          viewed_count: intakeRow.viewed_count,
          expires_at: intakeRow.expires_at,
          attachment_count: (intakeRow as any)._count?.mkt_dispute_attachments ?? 0,
        };
      }

      return {
        campaign_id: campaignId,
        stage: campaign.stage,
        repair_fulfillment: rf,
        tier: rf.tier ?? null,
        mode: rf.mode ?? null,
        platforms: Array.isArray(rf.platforms) ? rf.platforms : [],
        sla_hours: rf.sla_hours ?? null,
        sla_due_at: rf.sla_due_at ?? null,
        access_collected_at: rf.access_collected_at ?? null,
        canonical_nap: rf.canonical_nap ?? null,
        platform_status: rf.platform_status ?? {},
        seed: seedLink
          ? {
              seed_id: seedLink.seed_id,
              link_role: seedLink.link_role,
              nap_match_confidence: seedLink.nap_match_confidence,
              nap_match_summary: seedLink.nap_match_summary,
              seed_status: (seedLink as any).directory_presence_seeds?.status ?? null,
              seed_claimed: rf.seed_claimed === true,
              claimed_at: rf.claimed_at ?? null,
            }
          : null,
        access_intake: accessIntake,
      };
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // W8 — COMPLETION REPORT (assembled content, both modes)
  // ====================

  /**
   * Assemble the repair_completion_report body from repair_fulfillment +
   * checklist progress (spec §5.3 / W8). Deterministic — no LLM call. Both
   * modes share the artifact: DFY documents operator-executed verified
   * changes; DIY documents verified state + remaining customer actions
   * (which doubles as the retainer pitch).
   *
   * Returns the rendered body text plus the computed remaining_actions list
   * so the caller can stamp repair_fulfillment.completion.
   */
  async buildCompletionReport(campaignId: string, ctx?: RequestCtx): Promise<{
    content: string;
    remaining_actions: string[];
  }> {
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        business_name: true,
        repair_fulfillment: true,
      },
    });
    if (!campaign) throw new NotFoundError(`Campaign ${campaignId} not found`);

    const rf = (campaign.repair_fulfillment as Record<string, any> | null) ?? {};
    const mode: string = rf.mode ?? 'diy';
    const tierLabel = rf.tier ? String(rf.tier).toUpperCase() : '—';
    const platforms: string[] = Array.isArray(rf.platforms) ? rf.platforms : [];
    const platformStatus: Record<string, any> = rf.platform_status ?? {};
    const nap = rf.canonical_nap ?? {};

    // Checklist progress — PB-01 paid-stage steps completed by the operator.
    const checklistRows = await this.prisma.mkt_campaign_checklist_progress.findMany({
      where: { campaign_id: campaignId, completed_at: { not: null } },
      select: { step_id: true, completed_at: true, note: true },
      orderBy: { completed_at: 'asc' },
    });
    const stepIds = checklistRows.map((r) => r.step_id);
    const stepTitles = stepIds.length
      ? await this.prisma.mkt_playbook_checklist_steps.findMany({
          where: { id: { in: stepIds } },
          select: { id: true, title: true },
        })
      : [];
    const titleById = new Map(stepTitles.map((s) => [s.id, s.title]));

    // Attachment count from the access intake (DFY evidence).
    const intake = await this.prisma.mkt_dispute_intake.findFirst({
      where: { campaign_id: campaignId, intake_kind: 'profile_repair_access' },
      select: { _count: { select: { mkt_dispute_attachments: true } } },
    });
    const attachmentCount = (intake as any)?._count?.mkt_dispute_attachments ?? 0;

    const remaining: string[] = [];
    const lines: string[] = [];

    lines.push(`Package: ${tierLabel} (${mode.toUpperCase()})`);
    if (rf.sla_hours) lines.push(`SLA: ${rf.sla_hours} hours`);
    if (rf.sla_due_at) {
      lines.push(`SLA deadline: ${new Date(rf.sla_due_at).toLocaleString()}`);
    }
    lines.push('');

    if (nap.business_name || nap.address || nap.phone) {
      lines.push('Canonical business details (owner-confirmed)');
      const napLine = [
        nap.business_name,
        [nap.address, nap.city, nap.state, nap.zip].filter(Boolean).join(', '),
        nap.phone,
        nap.website,
      ].filter(Boolean).join(' · ');
      lines.push(napLine);
      lines.push('');
    }

    lines.push('Platform outcomes');
    for (const platform of platforms) {
      const entry = platformStatus[platform] ?? {};
      const status = entry.status ?? (mode === 'diy' ? 'customer_pending' : 'in_progress');
      const label = status.replace(/_/g, ' ');
      let line = `  ${platform.replace(/_/g, ' ')} — ${label}`;
      if (entry.verified_at) line += ` (verified ${new Date(entry.verified_at).toLocaleDateString()})`;
      if (status === 'escalated' && entry.escalated_campaign_id) {
        line += ` — in escalation, see sibling campaign ${entry.escalated_campaign_id}`;
      }
      if (entry.note) line += ` — ${entry.note}`;
      lines.push(line);

      if (status === 'escalated') {
        remaining.push(`${platform}: in escalation — sibling campaign ${entry.escalated_campaign_id ?? 'pending'}`);
      } else if (status === 'blocked' || status === 'not_applicable') {
        remaining.push(`${platform}: ${entry.note ?? `status ${label}`}`);
      } else if (status !== 'verified' && status !== 'done') {
        // Unverified platform — a remaining action for whoever executes
        // (customer in DIY, operator in DFY).
        remaining.push(`${platform}: ${mode === 'dfy' ? 'operator' : 'customer'} action still required (${label})`);
      }
    }
    lines.push('');

    if (checklistRows.length > 0) {
      lines.push('Operator checklist — completed steps');
      for (const row of checklistRows) {
        const title = titleById.get(row.step_id) ?? row.step_id;
        const when = row.completed_at ? new Date(row.completed_at).toLocaleDateString() : '';
        lines.push(`  [x] ${title}${when ? ` — ${when}` : ''}${row.note ? ` (${row.note})` : ''}`);
      }
      lines.push('');
    }

    if (attachmentCount > 0) {
      lines.push(`Evidence attachments on file: ${attachmentCount}`);
      lines.push('');
    }

    if (remaining.length > 0) {
      lines.push(mode === 'diy' ? 'Remaining actions' : 'Outstanding items');
      for (const action of remaining) lines.push(`  - ${action}`);
      lines.push('');
    } else {
      lines.push('All in-scope platforms verified.');
      lines.push('');
    }

    // Retainer pitch — the report doubles as the handoff artifact (spec §7).
    lines.push('What happens next');
    lines.push(
      'Listings drift over time as platforms re-verify data, competitors suggest edits, and directories re-crawl sources. ' +
      'An ongoing listing-synchronization retainer watches the platforms in this report, re-verifies your canonical details ' +
      'monthly, and flags new drift before it costs you customers. Ask us about keeping this coverage active.',
    );

    return { content: lines.join('\n'), remaining_actions: remaining };
  }

  /**
   * Stamp repair_fulfillment.completion once a completion-report
   * deliverable exists (W8). Deep-merges — never clobbers other keys.
   */
  async stampCompletionReport(
    campaignId: string,
    deliverableId: string,
    remainingActions: string[],
    ctx?: RequestCtx,
  ): Promise<void> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { repair_fulfillment: true },
      });
      if (!campaign) return;
      const rf = (campaign.repair_fulfillment as Record<string, any> | null) ?? {};
      await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: {
          repair_fulfillment: {
            ...rf,
            completion: {
              ...(rf.completion ?? {}),
              report_deliverable_id: deliverableId,
              remaining_actions: remainingActions,
            },
          },
        },
      });
    } catch (error) {
      // Best-effort — the deliverable exists either way.
      logger.error('Failed to stamp repair completion report', ctx, {
        error: (error as Error).message, campaignId, deliverableId,
      });
    }
  }
}

export default RepairFulfillmentService.getInstance();
