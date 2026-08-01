/**
 * ReviewCascadeService — Multi-channel cascade for review campaigns
 *
 * Executes an automated channel-escalation cascade for review campaigns
 * that an operator has opted-in via `cascade_enabled = true`.
 *
 * Timeline (default — overridable via `cascade_config` JSON):
 *   Day 1: Primary Email  — Frame preview + grade impact + CTA
 *   Day 2: SMS Pointer     — Short reference to email + drop link (if unopened 24-48h)
 *   Day 4: Webform / DM    — Administrative check-in (if unopened 48h+)
 *
 * Gates on:
 *   - `cascade_enabled = true`
 *   - `campaign_category != 'recovery_management'` (recovery has its own cascade)
 *   - `stage IN ('preview_built', 'shown')` (hot-prospect stages)
 *   - Latest contact was a no-response (or no contact exists)
 *
 * Channel availability:
 *   - Email: requires `campaign.email` to be non-null
 *   - SMS:   requires `campaign.phone` to be non-null
 *   - DM:    requires `campaign.social_profiles` to have at least one entry
 *   If a channel's contact info is missing, that step is skipped (not fired).
 *
 * Sprint 4 extension — Multi-Channel Cascade Queue.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import { MarketingOutreachService } from './MarketingOutreachService';
import type { RequestCtx } from '../context';

// ====================
// TYPES
// ====================

interface CascadeStep {
  day: number;
  channel: 'email' | 'phone' | 'social';
  label: string;
}

interface CascadeConfig {
  steps?: CascadeStep[];
}

// ====================
// CONSTANTS
// ====================

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_CASCADE_STEPS: CascadeStep[] = [
  { day: 1, channel: 'email', label: 'Day 1: Primary Email — Frame preview + grade impact + CTA' },
  { day: 2, channel: 'phone', label: 'Day 2: SMS Pointer — Short reference to email + drop link' },
  { day: 4, channel: 'social', label: 'Day 4: Webform / DM — Administrative check-in' },
];

const NO_RESPONSE_OUTCOMES = new Set(['no_answer', 'left_message', 'auto_follow_up_scheduled']);

const CASCADE_NOTE_PREFIX = 'Review cascade —';

// ====================
// SERVICE
// ====================

export class ReviewCascadeService extends BaseService {
  private static instance: ReviewCascadeService;

  private constructor() {
    super();
  }

  static getInstance(): ReviewCascadeService {
    if (!ReviewCascadeService.instance) {
      ReviewCascadeService.instance = new ReviewCascadeService();
    }
    return ReviewCascadeService.instance;
  }

  /**
   * Run a single cascade pass — finds review campaigns with cascade_enabled,
   * determines which cascade step is due, and fires it via
   * MarketingOutreachService.logContact().
   */
  async run(ctx?: RequestCtx): Promise<{ fired: number; skipped: number; exhausted: number }> {
    let fired = 0;
    let skipped = 0;
    let exhausted = 0;

    try {
      const campaigns = await this.prisma.mkt_campaigns_list.findMany({
        where: {
          cascade_enabled: true,
          campaign_category: { not: 'recovery_management' },
          stage: { in: ['preview_built', 'shown'] },
        },
        select: {
          id: true,
          business_name: true,
          stage: true,
          stage_entered_at: true,
          email: true,
          phone: true,
          social_profiles: true,
          cascade_config: true,
          last_contacted_at: true,
        },
      });

      if (campaigns.length === 0) {
        return { fired: 0, skipped: 0, exhausted: 0 };
      }

      const now = new Date();

      for (const campaign of campaigns) {
        const result = await this.processCampaign(campaign, now, ctx);
        if (result.fired) fired++;
        else if (result.exhausted) exhausted++;
        else skipped++;
      }

      logger.info('[ReviewCascade] Pass complete', ctx, { fired, skipped, exhausted });
      return { fired, skipped, exhausted };
    } catch (error) {
      logger.error('[ReviewCascade] Pass failed', ctx, {
        error: (error as Error).message,
      });
      return { fired, skipped, exhausted };
    }
  }

  private async processCampaign(
    campaign: any,
    now: Date,
    ctx?: RequestCtx,
  ): Promise<{ fired: boolean; exhausted: boolean }> {
    try {
      // Check latest contact — only cascade if no-response or no contact
      const latestContact = await this.prisma.mkt_outreach_log.findFirst({
        where: { campaign_id: campaign.id },
        orderBy: { contact_date: 'desc' },
      });

      // If the latest contact was a response (reached/interested), don't cascade
      if (latestContact && !NO_RESPONSE_OUTCOMES.has(latestContact.outcome)) {
        return { fired: false, exhausted: false };
      }

      // Find existing cascade contacts for this campaign
      const existingCascadeContacts = await this.prisma.mkt_outreach_log.findMany({
        where: {
          campaign_id: campaign.id,
          notes: { contains: CASCADE_NOTE_PREFIX },
        },
        orderBy: { contact_date: 'asc' },
      });

      // Determine the cascade steps (from config or default)
      const steps = this.resolveSteps(campaign.cascade_config);

      // Determine which step is next (0-based index)
      const nextStepIndex = existingCascadeContacts.length;
      if (nextStepIndex >= steps.length) {
        // Cascade exhausted — no more steps to fire
        return { fired: false, exhausted: true };
      }

      const nextStep = steps[nextStepIndex];

      // Check if enough time has elapsed since the last cascade contact
      // (or since stage_entered_at if no cascade contacts yet)
      const referenceDate = existingCascadeContacts.length > 0
        ? new Date(existingCascadeContacts[existingCascadeContacts.length - 1].contact_date)
        : new Date(campaign.stage_entered_at);

      const elapsedMs = now.getTime() - referenceDate.getTime();
      const elapsedDays = Math.floor(elapsedMs / DAY_MS);

      if (elapsedDays < nextStep.day) {
        // Not time yet for this step
        return { fired: false, exhausted: false };
      }

      // Check channel availability
      if (!this.hasChannelInfo(campaign, nextStep.channel)) {
        logger.info('[ReviewCascade] Skipping step — channel contact info missing', ctx, {
          campaignId: campaign.id,
          channel: nextStep.channel,
          step: nextStep.label,
        });
        // Log a skipped step so we don't re-evaluate it every pass
        await MarketingOutreachService.getInstance().logContact({
          campaignId: campaign.id,
          contactChannel: nextStep.channel,
          contactDate: now.toISOString(),
          outcome: 'no_answer',
          notes: `${CASCADE_NOTE_PREFIX} ${nextStep.label} (SKIPPED — no contact info)`,
          contactedBy: 'review-cascade',
        }, ctx);

        return { fired: false, exhausted: false };
      }

      // Build message content based on step
      const messageSnapshot = this.buildMessageSnapshot(campaign, nextStep);
      const messageSubject = `Frame Preview for ${campaign.business_name || 'Your Business'}`;

      // Fire the contact via MarketingOutreachService
      await MarketingOutreachService.getInstance().logContact({
        campaignId: campaign.id,
        contactChannel: nextStep.channel,
        contactDate: now.toISOString(),
        outcome: 'left_message',
        notes: `${CASCADE_NOTE_PREFIX} ${nextStep.label}`,
        messageSnapshot,
        messageSubject,
        contactedBy: 'review-cascade',
      }, ctx);

      logger.info('[ReviewCascade] Step fired', ctx, {
        campaignId: campaign.id,
        step: nextStep.label,
        channel: nextStep.channel,
        elapsedDays,
      });

      return { fired: true, exhausted: false };
    } catch (error) {
      logger.warn('[ReviewCascade] Failed to process campaign', ctx, {
        campaignId: campaign.id,
        error: (error as Error).message,
      });
      return { fired: false, exhausted: false };
    }
  }

  // ====================
  // HELPERS
  // ====================

  private resolveSteps(config: any): CascadeStep[] {
    if (config?.steps && Array.isArray(config.steps) && config.steps.length > 0) {
      return config.steps;
    }
    return DEFAULT_CASCADE_STEPS;
  }

  private hasChannelInfo(campaign: any, channel: 'email' | 'phone' | 'social'): boolean {
    switch (channel) {
      case 'email':
        return !!campaign.email && campaign.email.trim().length > 0;
      case 'phone':
        return !!campaign.phone && campaign.phone.trim().length > 0;
      case 'social': {
        if (!campaign.social_profiles) return false;
        const profiles = Array.isArray(campaign.social_profiles) ? campaign.social_profiles : [];
        return profiles.length > 0;
      }
      default:
        return false;
    }
  }

  private buildMessageSnapshot(campaign: any, step: CascadeStep): string {
    const businessName = campaign.business_name || 'your business';
    const channelContext = {
      email: {
        body: `Hello ${businessName},\n\nWe've prepared a frame preview showing how your business appears to potential customers, along with a grade impact analysis. We'd love to walk you through it — it takes 10 minutes and there's no obligation.\n\nWould you be available this week for a quick call?\n\n— Marketing Team`,
      },
      phone: {
        body: `Hi ${businessName}, we sent you an email with your frame preview + grade impact. Haven't seen you open it yet. Here's the link: [drop link]. Reply STOP to opt out.`,
      },
      social: {
        body: `Hi ${businessName}, this is a quick administrative check-in. We prepared a frame preview for your business but haven't heard back. Is there a better way to reach you? — Marketing Team`,
      },
    };

    const content = channelContext[step.channel] || channelContext.email;
    return JSON.stringify({
      step: step.label,
      businessName,
      channel: step.channel,
      body: content.body,
    });
  }

  // ====================
  // ADMIN — enable/disable cascade for a campaign
  // ====================

  async enableCascade(campaignId: string, config?: CascadeConfig, ctx?: RequestCtx): Promise<any> {
    try {
      const updated = await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: {
          cascade_enabled: true,
          cascade_config: config ? (config as any) : null,
        },
        select: { id: true, cascade_enabled: true, cascade_config: true },
      });

      logger.info('[ReviewCascade] Cascade enabled for campaign', ctx, {
        campaignId,
        hasCustomConfig: !!config,
      });

      return updated;
    } catch (error) {
      logger.error('[ReviewCascade] Failed to enable cascade', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async disableCascade(campaignId: string, ctx?: RequestCtx): Promise<any> {
    try {
      const updated = await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: { cascade_enabled: false },
        select: { id: true, cascade_enabled: true, cascade_config: true },
      });

      logger.info('[ReviewCascade] Cascade disabled for campaign', ctx, { campaignId });
      return updated;
    } catch (error) {
      logger.error('[ReviewCascade] Failed to disable cascade', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async getCascadeStatus(campaignId: string, ctx?: RequestCtx): Promise<{
    campaignId: string;
    cascadeEnabled: boolean;
    cascadeConfig: CascadeConfig | null;
    stepsFired: number;
    stepsRemaining: number;
    totalSteps: number;
    contacts: any[];
  }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { id: true, cascade_enabled: true, cascade_config: true },
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const contacts = await this.prisma.mkt_outreach_log.findMany({
        where: {
          campaign_id: campaignId,
          notes: { contains: CASCADE_NOTE_PREFIX },
        },
        orderBy: { contact_date: 'asc' },
      });

      const steps = this.resolveSteps(campaign.cascade_config);
      const stepsFired = contacts.filter((c: any) => !c.notes?.includes('SKIPPED')).length;
      const stepsSkipped = contacts.filter((c: any) => c.notes?.includes('SKIPPED')).length;
      const stepsRemaining = Math.max(0, steps.length - contacts.length);

      return {
        campaignId,
        cascadeEnabled: campaign.cascade_enabled,
        cascadeConfig: campaign.cascade_config as CascadeConfig | null,
        stepsFired,
        stepsRemaining,
        totalSteps: steps.length,
        contacts: contacts.map((c: any) => ({
          id: c.id,
          contactDate: c.contact_date,
          channel: c.contact_channel,
          outcome: c.outcome,
          notes: c.notes,
        })),
      };
    } catch (error) {
      logger.error('[ReviewCascade] Failed to get cascade status', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }
}

export default ReviewCascadeService.getInstance();
