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
const CASCADE_NOTE_PREFIX = 'Recovery cascade';
const CASCADE_STEPS = [
  { day: 1, channel: 'email' as const, label: 'Day 1: Primary email with intake link' },
  { day: 2, channel: 'phone' as const, label: 'Day 2: SMS pointer to email' },
  { day: 4, channel: 'social' as const, label: 'Day 4: Administrative check-in' },
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
          social_profiles: true,
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
          notes: { contains: CASCADE_NOTE_PREFIX },
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

      // ContactReadiness gate — if the campaign has NO contact channels at
      // all (no email, no phone, no social), skip the cascade entirely.
      // The operator needs to enrich the campaign with contact info first.
      const hasAnyChannel =
        this.hasChannelInfo(campaign, 'email') ||
        this.hasChannelInfo(campaign, 'phone') ||
        this.hasChannelInfo(campaign, 'social');
      if (!hasAnyChannel) {
        // Only log this once per campaign (check if we already logged a
        // "no channels" warning)
        const existingWarning = existingContacts.some(
          (c: any) => c.notes?.includes('SKIPPED — no contact channels'),
        );
        if (!existingWarning) {
          logger.warn('[RecoveryCascade] Campaign has no contact channels — cascade blocked', ctx, {
            campaignId: campaign.id,
          });
          await MarketingOutreachService.getInstance().logContact({
            campaignId: campaign.id,
            contactChannel: 'other',
            contactDate: now.toISOString(),
            outcome: 'no_answer',
            notes: `${CASCADE_NOTE_PREFIX} BLOCKED — no contact channels available (add email, phone, or social to the campaign)`,
            contactedBy: 'recovery-cascade',
          }, ctx);
        }
        return { fired: false };
      }

      // Check channel availability. If the primary channel is missing,
      // fall back to email (if available) so the cascade doesn't lose
      // momentum. If email is also missing, skip the step entirely.
      let effectiveChannel = nextStep.channel;
      let isFallback = false;

      if (!this.hasChannelInfo(campaign, nextStep.channel)) {
        if (nextStep.channel !== 'email' && this.hasChannelInfo(campaign, 'email')) {
          // Fallback: use email instead of the primary channel
          effectiveChannel = 'email';
          isFallback = true;
          logger.info('[RecoveryCascade] Falling back to email — primary channel unavailable', ctx, {
            campaignId: campaign.id,
            primaryChannel: nextStep.channel,
            step: nextStep.label,
          });
        } else {
          // No fallback available — skip the step
          logger.info('[RecoveryCascade] Skipping step — no contact info for channel or fallback', ctx, {
            campaignId: campaign.id,
            channel: nextStep.channel,
            step: nextStep.label,
          });
          await MarketingOutreachService.getInstance().logContact({
            campaignId: campaign.id,
            contactChannel: nextStep.channel,
            contactDate: now.toISOString(),
            outcome: 'no_answer',
            notes: `${CASCADE_NOTE_PREFIX} ${nextStep.label} (SKIPPED — no contact info)`,
            contactedBy: 'recovery-cascade',
          }, ctx);
          return { fired: false };
        }
      }

      // Build the intake link
      const intakeLink = `${unifiedConfig.webBaseUrl || ''}/recovery/intake?token=${intake.access_token}`;

      // Build message content based on the effective channel (not the original)
      const effectiveStep = { ...nextStep, channel: effectiveChannel };
      const isProfileRepair = campaign.campaign_category === 'profile_repair';
      const messageSnapshot = this.buildMessageSnapshot(campaign, intakeLink, effectiveStep, isProfileRepair);
      const messageSubject = isProfileRepair
        ? `Action Required: Profile Repair Appeal for ${campaign.business_name || 'Your Business'}`
        : `Action Required: Recovery Resolution for ${campaign.business_name || 'Your Business'}`;

      // Fire the contact via MarketingOutreachService
      await MarketingOutreachService.getInstance().logContact({
        campaignId: campaign.id,
        contactChannel: effectiveChannel,
        contactDate: now.toISOString(),
        outcome: 'left_message',
        notes: isFallback
          ? `${CASCADE_NOTE_PREFIX} ${nextStep.label} (FALLBACK — ${nextStep.channel} unavailable, used email)`
          : `${CASCADE_NOTE_PREFIX} ${nextStep.label}`,
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

  private buildMessageSnapshot(
    campaign: any,
    intakeLink: string,
    step: { day: number; channel: string; label: string },
    isProfileRepair = false,
  ): string {
    const businessName = campaign.business_name || 'your business';

    const bodies: Record<string, string> = isProfileRepair
      ? {
          email: `Hello ${businessName},\n\nWe've identified an issue with your Google Business Profile (or another platform) that needs your attention — this could be a suspension, duplicate listing, or ownership dispute.\n\nTo file an appeal on your behalf, we need you to submit evidence proving your business ownership. Please complete the profile repair intake form at the link below.\n\nIntake link: ${intakeLink}\n\nThis link will expire. If you have questions, reply to this email.\n\n— Profile Repair Team`,
          phone: `${businessName} — your Google Business Profile may be suspended or flagged. We sent you an email with a link to submit evidence for your appeal. Please check your inbox, or visit: ${intakeLink}. Reply STOP to opt out.`,
          social: `Hello ${businessName}, we've been trying to reach you about an issue with your business profile (suspension/duplicate/ownership). Please complete the intake form so we can file your appeal: ${intakeLink}`,
        }
      : {
          email: `Hello ${businessName},\n\nWe've identified a complaint that needs your attention. Please complete the recovery intake form so we can draft a resolution on your behalf.\n\nIntake link: ${intakeLink}\n\nThis link will expire. If you have questions, reply to this email.\n\n— Recovery Team`,
          phone: `${businessName} — we sent you an email about a complaint that needs your response. Please check your inbox for the intake link, or visit: ${intakeLink}. Reply STOP to opt out.`,
          social: `Hello ${businessName}, we've been trying to reach you about a complaint on your profile. Please complete the intake form so we can draft your resolution: ${intakeLink}`,
        };

    return JSON.stringify({
      step: step.label,
      channel: step.channel,
      businessName,
      intakeLink,
      intakeKind: isProfileRepair ? 'profile_repair' : 'dispute',
      body: bodies[step.channel] || bodies.email,
    });
  }
}

export default RecoveryCascadeService.getInstance();
