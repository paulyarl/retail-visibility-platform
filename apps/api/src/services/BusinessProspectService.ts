/**
 * BusinessProspectService — sibling campaign management + sequential cycling
 *
 * Manages the multi-archetype campaign model:
 *   - initializeProspectFromCampaign: backfill a business_prospect_id onto a
 *     legacy campaign (or confirm one exists). Marks it as the primary sibling.
 *   - createSiblingCampaign: create a new campaign row sharing the same
 *     business_prospect_id as the source campaign. Copies business identity
 *     fields, starts at 'seek' stage.
 *   - listSiblings: return all campaigns sharing a business_prospect_id.
 *   - getPrimarySibling: return the primary sibling (or highest-priority one).
 *   - cycleToNextEngagement: increment engagement_cycle, reset stage + date
 *     fields, log a cycle_started stage history entry.
 *
 * Pattern: singleton extends BaseService.
 * Spec: docs/LocalBiz/marketing_ops_multi_archetype_campaign_sprint_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';
import { generateCampaignId, generateBusinessProspectId, generateStageHistoryId } from '../lib/id-generator';
import type { ArchetypeCodeWithA6, PlaybookCode, PlaybookCategory } from './triage/types';

// ─── Inputs ──────────────────────────────────────────────────────────────

export interface CreateSiblingInput {
  /** The source campaign — must already have a business_prospect_id. */
  sourceCampaignId: string;
  /** Archetype for the sibling (A1-A6). Used for display + validation. */
  archetype: ArchetypeCodeWithA6;
  /** For triage-driven siblings: the playbook code (sets category via playbook). */
  playbookCode?: PlaybookCode;
  /** For manually-created repair siblings (no playbook). */
  campaignCategory?: 'profile_repair';
  repairTrack?: 'standard' | 'escalated';
  repairIssueType?: string;
  assignedTo?: string;
  notes?: string;
}

export interface CycleInput {
  campaignId: string;
  resetToStage?: 'seek' | 'preview_built';
  notes?: string;
  changedBy?: string;
}

// ─── Sibling summary (list element shape) ────────────────────────────────

export interface SiblingSummary {
  id: string;
  businessName: string | null;
  campaignCategory: string;
  repairTrack: string | null;
  stage: string;
  engagementCycle: number;
  isPrimarySibling: boolean;
  estimatedFeeCents: number;
  amountPaidCents: number;
  archetype: ArchetypeCodeWithA6 | null;
  createdAt: Date;
}

// ─── Archetype priority for sibling ordering ─────────────────────────────

const ARCHETYPE_PRIORITY: Record<ArchetypeCodeWithA6, number> = {
  A2: 1, // BBB crisis — highest priority
  A1: 2, // Review gap
  A6: 3, // Product visibility
  A3: 4, // Listing drift
  A4: 5, // CTA gap
  A5: 6, // Dual/triage (bundle)
};

// ─── Service ─────────────────────────────────────────────────────────────

export class BusinessProspectService extends BaseService {
  private static instance: BusinessProspectService;

  private constructor() {
    super();
  }

  static getInstance(): BusinessProspectService {
    if (!BusinessProspectService.instance) {
      BusinessProspectService.instance = new BusinessProspectService();
    }
    return BusinessProspectService.instance;
  }

  // ─── Prospect initialization ───────────────────────────────────────────

  /**
   * Ensure a campaign has a business_prospect_id. If it doesn't, generate one
   * and mark the campaign as the primary sibling. If it already has one, this
   * is a no-op (returns the existing prospect ID).
   */
  async initializeProspectFromCampaign(campaignId: string, ctx?: RequestCtx): Promise<string> {
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
    }) as any;
    if (!campaign) throw new NotFoundError(`Campaign ${campaignId} not found`);

    if (campaign.business_prospect_id) {
      return campaign.business_prospect_id as string;
    }

    const prospectId = generateBusinessProspectId();
    await this.prisma.mkt_campaigns_list.update({
      where: { id: campaignId },
      data: {
        business_prospect_id: prospectId,
        is_primary_sibling: true,
      } as any,
    });

    logger.info('Prospect initialized from campaign', ctx, { campaignId, prospectId });
    return prospectId;
  }

  // ─── Sibling creation ──────────────────────────────────────────────────

  /**
   * Create a sibling campaign for the same business prospect. Copies business
   * identity fields from the source campaign, starts at 'seek' stage with
   * engagement_cycle = 1.
   *
   * Validation:
   * - Source campaign must have a business_prospect_id (auto-initializes if not).
   * - At least one of playbookCode or campaignCategory must be provided.
   * - The (campaign_category, repair_track) combination must not already exist
   *   as a sibling for this prospect (409 Conflict).
   * - customer_id is copied from the source sibling (§3.5: customer_id sharing).
   */
  async createSiblingCampaign(input: CreateSiblingInput, ctx?: RequestCtx): Promise<any> {
    const { sourceCampaignId, archetype, playbookCode, campaignCategory, repairTrack, repairIssueType, assignedTo, notes } = input;

    if (!playbookCode && !campaignCategory) {
      throw new Error('At least one of playbookCode or campaignCategory must be provided');
    }

    // 1. Load source campaign + ensure prospect ID exists
    const source = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: sourceCampaignId },
    }) as any;
    if (!source) throw new NotFoundError(`Source campaign ${sourceCampaignId} not found`);

    let prospectId: string = source.business_prospect_id;
    if (!prospectId) {
      prospectId = await this.initializeProspectFromCampaign(sourceCampaignId, ctx);
    }

    // 2. Determine the category for the new sibling
    let siblingCategory: PlaybookCategory;
    let siblingRepairTrack: 'standard' | 'escalated' | null = repairTrack ?? null;
    let estimatedFeeCents = 0;

    if (playbookCode) {
      // Triage-driven sibling — resolve category from the playbook
      const { MarketingPlaybookCatalogService } = await import('./MarketingPlaybookCatalogService.js');
      const playbook = await MarketingPlaybookCatalogService.getPlaybookByCode(playbookCode, ctx);
      siblingCategory = playbook.category;
      estimatedFeeCents = playbook.fitdDefaultFeeCents;
      // For profile_repair playbooks, default to standard track
      if (playbook.category === 'profile_repair' && !siblingRepairTrack) {
        siblingRepairTrack = 'standard';
      }
    } else {
      // Manually-created repair sibling
      siblingCategory = campaignCategory!;
    }

    // 3. Check for existing sibling with the same (category, repair_track)
    const existingSiblings = await this.prisma.mkt_campaigns_list.findMany({
      where: { business_prospect_id: prospectId, scope: 'business' },
    });
    const trackKey = siblingRepairTrack ?? 'none';
    const conflict = existingSiblings.find((s) => {
      const sTrack = (s.repair_track as string | null) ?? 'none';
      return s.campaign_category === siblingCategory && sTrack === trackKey;
    });
    if (conflict) {
      throw new ConflictError(
        `A sibling campaign with category '${siblingCategory}' (track: ${siblingRepairTrack ?? 'none'}) already exists for this prospect`,
      );
    }

    // 4. Create the sibling campaign — copy business identity from source
    const newId = generateCampaignId();
    const initialStage = siblingCategory === 'recovery_management' ? 'audit_identified' : 'seek';

    const sibling = await this.prisma.mkt_campaigns_list.create({
      data: {
        id: newId,
        scope: 'business',
        campaign_category: siblingCategory,
        repair_track: siblingRepairTrack,
        repair_issue_type: repairIssueType || null,
        business_name: source.business_name,
        category: source.category,
        city: source.city,
        neighborhood: source.neighborhood,
        contact_method: source.contact_method,
        contact_info: source.contact_info,
        phone: source.phone,
        email: source.email,
        website_url: source.website_url,
        social_profiles: source.social_profiles as any,
        owner_names: source.owner_names as any,
        phones: source.phones as any,
        address_line1: source.address_line1,
        address_line2: source.address_line2,
        address_city: source.address_city,
        address_state: source.address_state,
        address_zip: source.address_zip,
        address_country: source.address_country,
        directory_profiles: source.directory_profiles as any,
        gbp_claimed: source.gbp_claimed,
        unaddressed_reviews: source.unaddressed_reviews,
        last_review_date: source.last_review_date,
        has_website: source.has_website,
        nap_consistent: source.nap_consistent,
        estimated_tier: source.estimated_tier,
        estimated_fee_cents: estimatedFeeCents,
        pain_score: source.pain_score,
        tone: source.tone,
        attributes: source.attributes as any,
        assigned_to: assignedTo || source.assigned_to,
        notes: notes || null,
        parent_campaign_id: source.parent_campaign_id,
        customer_id: source.customer_id,
        business_prospect_id: prospectId,
        is_primary_sibling: false,
        engagement_cycle: 1,
        stage: initialStage,
        stage_entered_at: new Date(),
      } as any,
    });

    // 5. Log initial stage transition
    await this.logStageHistory(newId, null, initialStage, 'system', assignedTo);

    logger.info('Sibling campaign created', ctx, {
      sourceCampaignId,
      newCampaignId: newId,
      prospectId,
      archetype,
      category: siblingCategory,
      repairTrack: siblingRepairTrack,
    });

    return sibling;
  }

  // ─── Sibling listing ───────────────────────────────────────────────────

  /**
   * List all sibling campaigns for a prospect, ordered by archetype priority.
   */
  async listSiblings(businessProspectId: string, ctx?: RequestCtx): Promise<SiblingSummary[]> {
    const campaigns = await this.prisma.mkt_campaigns_list.findMany({
      where: { business_prospect_id: businessProspectId, scope: 'business' } as any,
      orderBy: { created_at: 'asc' },
    }) as any[];

    // Resolve archetype for each sibling for priority ordering
    const summaries: SiblingSummary[] = campaigns.map((c) => ({
      id: c.id,
      businessName: c.business_name,
      campaignCategory: c.campaign_category,
      repairTrack: (c.repair_track as string | null) ?? null,
      stage: c.stage,
      engagementCycle: c.engagement_cycle ?? 1,
      isPrimarySibling: c.is_primary_sibling ?? false,
      estimatedFeeCents: c.estimated_fee_cents ?? 0,
      amountPaidCents: c.amount_paid_cents ?? 0,
      archetype: null, // archetype is resolved at runtime — not persisted
      createdAt: c.created_at,
    }));

    // Sort: primary first, then by archetype priority (if available), then by created_at
    summaries.sort((a, b) => {
      if (a.isPrimarySibling && !b.isPrimarySibling) return -1;
      if (!a.isPrimarySibling && b.isPrimarySibling) return 1;
      const aPrio = a.archetype ? ARCHETYPE_PRIORITY[a.archetype] : 99;
      const bPrio = b.archetype ? ARCHETYPE_PRIORITY[b.archetype] : 99;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return summaries;
  }

  /**
   * Get the primary sibling for a prospect. Falls back to the first created
   * sibling if no primary is marked.
   */
  async getPrimarySibling(businessProspectId: string, ctx?: RequestCtx): Promise<any | null> {
    const primary = await this.prisma.mkt_campaigns_list.findFirst({
      where: { business_prospect_id: businessProspectId, is_primary_sibling: true } as any,
    });
    if (primary) return primary;

    // Fallback: oldest sibling
    return this.prisma.mkt_campaigns_list.findFirst({
      where: { business_prospect_id: businessProspectId, scope: 'business' } as any,
      orderBy: { created_at: 'asc' },
    });
  }

  // ─── Sequential cycling ────────────────────────────────────────────────

  /**
   * Cycle a campaign to its next engagement. Increments engagement_cycle,
   * resets stage + date fields per §3.5, and logs a cycle_started stage
   * history entry.
   *
   * Preserved (NOT reset): business_prospect_id, is_primary_sibling,
   * campaign_category, repair_track, customer_id, tenant_id, business
   * identity fields, parent_campaign_id, estimated_fee_cents, pain_score,
   * notes, assigned_to, service_category, tone, attributes, scope.
   */
  async cycleToNextEngagement(input: CycleInput, ctx?: RequestCtx): Promise<any> {
    const { campaignId, resetToStage, notes, changedBy } = input;

    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
    }) as any;
    if (!campaign) throw new NotFoundError(`Campaign ${campaignId} not found`);

    const currentCycle = (campaign.engagement_cycle as number) ?? 1;
    const newCycle = currentCycle + 1;
    const targetStage = resetToStage ?? 'seek';
    const fromStage = campaign.stage as string;

    const updated = await this.prisma.mkt_campaigns_list.update({
      where: { id: campaignId },
      data: {
        stage: targetStage,
        stage_entered_at: new Date(),
        date_entered: new Date(),
        date_preview_built: targetStage === 'preview_built' ? campaign.date_preview_built : null,
        date_shown: null,
        date_paid: null,
        date_delivered: null,
        date_retainer_pitched: null,
        date_retainer_won: null,
        amount_paid_cents: 0,
        retainer_status: 'not_pitched',
        retainer_amount_cents: 0,
        engagement_cycle: newCycle,
        cascade_enabled: false,
        cascade_config: null,
      } as any,
    });

    // Log the cycle transition in stage history
    await this.logStageHistory(
      campaignId,
      fromStage,
      targetStage,
      'manual',
      changedBy,
      `Engagement cycle ${currentCycle}→${newCycle}${notes ? ': ' + notes : ''}`,
    );

    logger.info('Campaign cycled to next engagement', ctx, {
      campaignId,
      fromCycle: currentCycle,
      toCycle: newCycle,
      fromStage,
      toStage: targetStage,
    });

    return updated;
  }

  // ─── Private helpers ───────────────────────────────────────────────────

  private async logStageHistory(
    campaignId: string,
    fromStage: string | null,
    toStage: string,
    triggerType: string,
    changedBy?: string,
    notes?: string,
  ): Promise<void> {
    try {
      await this.prisma.mkt_stage_history_list.create({
        data: {
          id: generateStageHistoryId(),
          campaign_id: campaignId,
          from_stage: fromStage,
          to_stage: toStage,
          notes: notes || null,
          trigger_type: triggerType,
          changed_by: changedBy || null,
        },
      });
    } catch (error) {
      logger.error('Failed to log stage history', undefined, {
        error: (error as Error).message,
        campaignId,
      });
    }
  }
}
