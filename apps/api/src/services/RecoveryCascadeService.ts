/**
 * RecoveryCascadeService — Outreach cascade for recovery campaigns
 *
 * Fires a Day 1/2/4 outreach sequence for recovery campaigns stuck in
 * `awaiting_owner_intake`. The cascade nudges the owner to submit their
 * intake form.
 *
 * Timeline:
 *   Day 1: primary email (frame preview + grade impact + CTA = intake link)
 *   Day 2 (unopened 24–48h): SMS pointer to email
 *   Day 4 (unopened 48h): webform/DM administrative check-in
 *
 * Gates on `campaign_category = 'recovery_management'` AND
 * `stage = awaiting_owner_intake`. Uses `mkt_outreach_log` for tracking.
 *
 * Sprint 4 — Recovery Management Engine.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';
import { MarketingOutreachService } from './MarketingOutreachService';
import type { RequestCtx } from '../context';

// ====================
// CONSTANTS
// ====================

const DAY_MS = 24 * 60 * 60 * 1000;
const CASCADE_STEPS = [
  { day: 1, channel: 'email' as const, label: 'Day 1: Primary email with intake link' },
  { day: 2, channel: 'email' as const, label: 'Day 2: SMS pointer to email' },
  { day: 4, channel: 'email' as const, label: 'Day 4: Administrative check-in' },
];

// ====================
// SERVICE
// ====================

export class RecoveryCascadeService extends BaseService {
  private static instance: RecoveryCascadeService;

  private constructor() {
    super();
  }

  static getInstance(): RecoveryCascadeService {
    if (!RecoveryCascadeService.instance) {
      RecoveryCascadeService.instance = new RecoveryCascadeService();
    }
    return RecoveryCascadeService.instance;
  }

  /**
   * Run a single cascade pass — finds recovery campaigns in
   * awaiting_owner_intake, determines which cascade step is due, and
   * fires it via MarketingOutreachService.logContact().
   */
  async run(ctx?: RequestCtx): Promise<{ fired: number; skipped: number }> {
    let fired = 0;
    let skipped = 0;

    try {
      const campaigns = await this.prisma.mkt_campaigns_list.findMany({
        where: {
          campaign_category: 'recovery_management',
          stage: 'awaiting_owner_intake',
        },
        select: {
          id: true,
          business_name: true,
          stage_entered_at: true,
          email: true,
          phone: true,
          mkt_dispute_intake: { select: { id: true, access_token: true } },
        },
      });

      if (campaigns.length === 0) {
        return { fired: 0, skipped: 0 };
      }

      const now = new Date();

      for (const campaign of campaigns) {
        const result = await this.processCampaign(campaign, now, ctx);
        if (result.fired) fired++;
        else skipped++;
      }

      logger.info('[RecoveryCascade] Pass complete', ctx, { fired, skipped });
      return { fired, skipped };
    } catch (error) {
      logger.error('[RecoveryCascade] Pass failed', ctx, {
        error: (error as Error).message,
      });
      return { fired, skipped };
    }
  }

  private async processCampaign(
    campaign: any,
    now: Date,
    ctx?: RequestCtx,
  ): Promise<{ fired: boolean }> {
    try {
      const stageEnteredAt = new Date(campaign.stage_entered_at);
      const elapsedMs = now.getTime() - stageEnteredAt.getTime();
      const elapsedDays = Math.floor(elapsedMs / DAY_MS);

      // Find existing cascade contacts for this campaign
      const existingContacts = await this.prisma.mkt_outreach_log.findMany({
        where: {
          campaign_id: campaign.id,
          notes: { contains: 'Recovery cascade' },
        },
        orderBy: { contact_date: 'asc' },
      });

      // Determine which step is next
      const nextStepIndex = existingContacts.length; // 0-based: 0=Day1, 1=Day2, 2=Day4
      if (nextStepIndex >= CASCADE_STEPS.length) {
        // Cascade exhausted — no more steps to fire
        return { fired: false };
      }

      const nextStep = CASCADE_STEPS[nextStepIndex];
      if (elapsedDays < nextStep.day) {
        // Not time yet for this step
        return { fired: false };
      }

      // Check if owner already submitted (intake_submitted would have transitioned
      // the stage, but double-check via intake record)
      const intake = campaign.mkt_dispute_intake;
      if (!intake) {
        return { fired: false };
      }

      // Build the intake link
      const intakeLink = `${unifiedConfig.webBaseUrl || ''}/recovery/intake?token=${intake.access_token}`;

      // Build message content based on step
      const messageSnapshot = this.buildMessageSnapshot(campaign, intakeLink, nextStep);
      const messageSubject = `Action Required: Recovery Resolution for ${campaign.business_name || 'Your Business'}`;

      // Fire the contact via MarketingOutreachService
      await MarketingOutreachService.getInstance().logContact({
        campaignId: campaign.id,
        contactChannel: nextStep.channel,
        contactDate: now.toISOString(),
        outcome: 'other',
        notes: `Recovery cascade — ${nextStep.label}`,
        messageSnapshot,
        messageSubject,
        contactedBy: 'recovery-cascade',
      }, ctx);

      logger.info('[RecoveryCascade] Step fired', ctx, {
        campaignId: campaign.id,
        step: nextStep.label,
        elapsedDays,
      });

      return { fired: true };
    } catch (error) {
      logger.warn('[RecoveryCascade] Failed to process campaign', ctx, {
        campaignId: campaign.id,
        error: (error as Error).message,
      });
      return { fired: false };
    }
  }

  private buildMessageSnapshot(campaign: any, intakeLink: string, step: { day: number; label: string }): string {
    const businessName = campaign.business_name || 'your business';
    return JSON.stringify({
      step: step.label,
      businessName,
      intakeLink,
      body: `Hello ${businessName},\n\nWe've identified a complaint that needs your attention. Please complete the recovery intake form so we can draft a resolution on your behalf.\n\nIntake link: ${intakeLink}\n\nThis link will expire. If you have questions, reply to this email.\n\n— Recovery Team`,
    });
  }
}

export default RecoveryCascadeService.getInstance();
