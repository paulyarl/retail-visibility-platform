/**
 * SeedOutreachTriggerService
 *
 * Called after DirectoryPresenceSeedService.createFromCampaign completes
 * (seed + publish + link). Fire-and-forget from the caller's perspective —
 * errors are caught and logged.
 *
 * Steps:
 * 1. Load campaign + linked seed + audit
 * 2. Check idempotency: skip if a seed_outreach log already exists for this seed
 * 3. Resolve best contact channel (phone → email → other)
 * 4. Resolve claim URL via HookSuggestionService.resolveClaimUrl (public)
 * 5. Resolve top hook via HookSuggestionService.suggestForCampaign (suggestions[0])
 * 6. Compose outreach message (hook body + claim URL + place page URL)
 * 7. ATOMIC: log outreach contact + set outreach_state in a single transaction
 *
 * See: docs/LocalBiz/seed_outreach_courtesy_window_sprint_plan.md
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';
import { MarketingOutreachService } from './MarketingOutreachService';
import { HookSuggestionService } from './HookSuggestionService';
import { audit } from '../audit';

/** Audit context for seed outreach operations (matches SeedAuditCtx shape) */
interface SeedOutreachCtx {
  actorType?: 'user' | 'system' | 'integration' | 'customer';
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

export class SeedOutreachTriggerService extends BaseService {
  private static instance: SeedOutreachTriggerService;

  private constructor() {
    super();
  }

  static getInstance(): SeedOutreachTriggerService {
    if (!SeedOutreachTriggerService.instance) {
      SeedOutreachTriggerService.instance = new SeedOutreachTriggerService();
    }
    return SeedOutreachTriggerService.instance;
  }

  /**
   * Called after createFromCampaign completes (seed + publish + link).
   * Fire-and-forget — errors are caught and logged by the caller.
   */
  async onSeedCreated(input: {
    campaignId: string;
    seedId: string;
    ctx?: SeedOutreachCtx;
  }): Promise<void> {
    const { campaignId, seedId, ctx } = input;

    // Kill switch
    if (unifiedConfig.disableSeedOutreachTrigger) {
      logger.info('SeedOutreachTriggerService.onSeedCreated skipped (kill switch)', undefined, {
        campaignId,
        seedId,
      });
      return;
    }

    // 1. Load campaign + seed
    const campaign = await prisma.$queryRaw<any[]>`
      SELECT id, phone, email, business_name FROM mkt_campaigns_list WHERE id = ${campaignId} LIMIT 1
    `;
    if (!campaign[0]) {
      logger.warn('SeedOutreachTriggerService: campaign not found', undefined, { campaignId, seedId });
      return;
    }

    const seed = await prisma.$queryRaw<any[]>`
      SELECT id, tenant_id, listing_id, owner_email, owner_phone, owner_name
      FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) {
      logger.warn('SeedOutreachTriggerService: seed not found', undefined, { campaignId, seedId });
      return;
    }

    // 2. Idempotency: check for existing seed_outreach log for this seed
    const existing = await prisma.$queryRaw<any[]>`
      SELECT 1 FROM mkt_outreach_log
      WHERE campaign_id = ${campaignId}
        AND call_details->>'seed_id' = ${seedId}
        AND call_details->>'seed_outreach' = 'true'
      LIMIT 1
    `;
    if (existing[0]) {
      logger.info('SeedOutreachTriggerService: outreach already logged for this seed', undefined, {
        campaignId,
        seedId,
      });
      return;
    }

    // 3. Resolve best contact channel (phone → email → other)
    const phone = seed[0].owner_phone || campaign[0].phone || null;
    const email = seed[0].owner_email || campaign[0].email || null;
    let contactChannel: 'phone' | 'email' | 'other' = 'other';
    let notes: string | undefined;
    if (phone) {
      contactChannel = 'phone';
    } else if (email) {
      contactChannel = 'email';
    } else {
      notes = 'No phone or email on file — operator must find contact channel manually';
    }

    // 4. Resolve claim URL
    let claimUrl: string | null = null;
    try {
      claimUrl = await HookSuggestionService.getInstance().resolveClaimUrl(campaignId);
    } catch (err) {
      logger.warn('SeedOutreachTriggerService: resolveClaimUrl failed', undefined, {
        campaignId,
        seedId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 5. Resolve top hook
    let hookAngle: string | null = null;
    let hookBody: string | null = null;
    try {
      const suggestion = await HookSuggestionService.getInstance().suggestForCampaign(campaignId);
      if (suggestion.suggestions && suggestion.suggestions.length > 0) {
        const topHook = suggestion.suggestions[0];
        hookAngle = topHook.angle || null;
        hookBody = topHook.resolved?.body || topHook.body || null;
      }
    } catch (err) {
      logger.warn('SeedOutreachTriggerService: suggestForCampaign failed', undefined, {
        campaignId,
        seedId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 6. Resolve place URL from listing slug
    const listing = await prisma.$queryRaw<any[]>`
      SELECT slug FROM directory_listings_list WHERE id = ${seed[0].listing_id} LIMIT 1
    `;
    const slug = listing[0]?.slug || '';
    const placeUrl = slug ? `/place/${slug}` : null;

    // 7. Compose outreach message
    const messageParts: string[] = [];
    if (hookBody) {
      messageParts.push(hookBody);
    }
    if (placeUrl) {
      messageParts.push(`Your listing is live at ${placeUrl}`);
    }
    if (claimUrl) {
      messageParts.push(`Claim your listing: ${claimUrl}`);
    }
    const messageSnapshot = messageParts.join('\n\n');

    // 8. Load audit detected_signals for profile_quality_findings (Phase 1)
    let profileQualityFindings: Array<{ signal: string; severity: string; label: string }> | null = null;
    try {
      const auditRow = await prisma.$queryRaw<any[]>`
        SELECT audit_payload FROM mkt_audits_list
        WHERE campaign_id = ${campaignId}
          AND platform = 'business_analysis'
        ORDER BY created_at DESC LIMIT 1
      `;
      if (auditRow[0]?.audit_payload) {
        const payload = typeof auditRow[0].audit_payload === 'string'
          ? JSON.parse(auditRow[0].audit_payload)
          : auditRow[0].audit_payload;
        const signals: string[] = payload?.detected_signals || [];
        if (signals.length > 0) {
          profileQualityFindings = signals.slice(0, 10).map((signal: string) => ({
            signal,
            severity: 'material',
            label: signal.replace(/_/g, ' ').toLowerCase(),
          }));
        }
      }
    } catch {
      // Audit payload parsing is best-effort
    }

    // 9. ATOMIC: log outreach + set outreach_state in a single transaction
    const today = new Date();
    const followUpDate = new Date(today);
    followUpDate.setDate(followUpDate.getDate() + unifiedConfig.seedOutreachNoResponseDays);
    const followUpDateStr = followUpDate.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    const callDetails = {
      seed_outreach: true,
      seed_id: seedId,
      claim_url: claimUrl,
      place_url: placeUrl,
      hook_angle: hookAngle,
      trigger_source: 'createFromCampaign',
      profile_quality_findings: profileQualityFindings,
    };

    await prisma.$transaction(async (tx) => {
      // Log the outreach contact
      await tx.$executeRaw`
        INSERT INTO mkt_outreach_log (
          id, campaign_id, stage_at_time, contact_channel, contact_date,
          outcome, follow_up_date, notes, message_snapshot,
          call_details, contacted_by, created_at
        ) VALUES (
          ${'ol-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)},
          ${campaignId},
          ${campaign[0].stage || 'preview_built'},
          ${contactChannel},
          ${todayStr},
          ${'seed_outreach_scheduled'},
          ${followUpDateStr},
          ${notes || null},
          ${messageSnapshot || null},
          ${JSON.stringify(callDetails)}::jsonb,
          ${'system'},
          now()
        )
      `;

      // Update seed outreach_state
      await tx.$executeRaw`
        UPDATE directory_presence_seeds
        SET outreach_state = 'outreach_scheduled',
            outreach_state_entered_at = now(),
            outreach_scheduled_at = now(),
            updated_at = now()
        WHERE id = ${seedId}
      `;
    });

    audit({
      actor: ctx?.actorId || 'system',
      actorType: ctx?.actorType || 'system',
      action: 'directory_presence_seed.outreach_triggered',
      payload: { seedId, campaignId, contactChannel, claimUrl, placeUrl, hookAngle },
    });

    logger.info('SeedOutreachTriggerService.onSeedCreated completed', undefined, {
      seedId,
      campaignId,
      contactChannel,
      claimUrl,
      hookAngle,
    });
  }
}
