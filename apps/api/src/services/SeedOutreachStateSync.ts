/**
 * SeedOutreachStateSync
 *
 * Post-log side-effect: when an operator logs a contact on a campaign that
 * has a primary-linked seed, update the seed's outreach_state based on the
 * logged outcome.
 *
 * Called from the POST /:id/outreach route handler in marketing-ops.ts
 * AFTER logContact succeeds. Errors are caught and logged by the caller —
 * they do not affect the 201 response.
 *
 * See: docs/LocalBiz/seed_outreach_courtesy_window_sprint_plan.md §7.3
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import DirectoryPresenceSeedService from './DirectoryPresenceSeedService';

/** Audit context for seed outreach operations (accepts both SeedAuditCtx and RequestCtx) */
interface SeedOutreachCtx {
  actorType?: 'user' | 'system' | 'integration' | 'customer';
  actorId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  region?: string;
}

export class SeedOutreachStateSync extends BaseService {
  private static instance: SeedOutreachStateSync;

  private constructor() {
    super();
  }

  static getInstance(): SeedOutreachStateSync {
    if (!SeedOutreachStateSync.instance) {
      SeedOutreachStateSync.instance = new SeedOutreachStateSync();
    }
    return SeedOutreachStateSync.instance;
  }

  /**
   * Map a logged ContactOutcome to a seed outreach_state.
   * Returns null if the outcome should not change the state (system-generated).
   */
  private mapOutcomeToState(
    outcome: string,
    callDetails: any,
  ): string | null {
    // System-generated outcomes — no state change
    if (outcome === 'seed_outreach_scheduled' || outcome === 'auto_follow_up_scheduled') {
      return null;
    }

    // Freshness outcomes
    if (outcome === 'freshness_verified') return 'freshness_verified';
    if (outcome === 'freshness_failed') return 'freshness_failed';

    // Wrong number / disconnected → freshness failed
    if (outcome === 'wrong_number' || outcome === 'disconnected_number') {
      return 'freshness_failed';
    }

    // Reached + operating status confirmed → freshness verified
    if (outcome === 'reached' && callDetails?.operating_status_confirmed === true) {
      return 'freshness_verified';
    }

    // Any other operator-logged outcome → owner contacted
    if (
      outcome === 'reached' ||
      outcome === 'no_answer' ||
      outcome === 'left_message' ||
      outcome === 'callback_scheduled' ||
      outcome === 'interested' ||
      outcome === 'not_interested' ||
      outcome === 'other'
    ) {
      return 'owner_contacted';
    }

    return null;
  }

  /**
   * Sync seed outreach_state from a logged outreach contact.
   * Called after MarketingOutreachService.logContact succeeds.
   */
  async syncFromLog(input: {
    campaignId: string;
    outcome: string;
    callDetails?: any;
    ctx?: SeedOutreachCtx;
  }): Promise<void> {
    const { campaignId, outcome, callDetails, ctx } = input;

    // Find the primary-linked seed for this campaign
    const links = await prisma.$queryRaw<any[]>`
      SELECT seed_id FROM directory_seed_campaign_links
      WHERE campaign_id = ${campaignId}
        AND link_role = 'primary'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!links[0]) {
      // No linked seed — this is a non-seed campaign, no-op
      return;
    }

    const seedId = links[0].seed_id;
    const newState = this.mapOutcomeToState(outcome, callDetails);
    if (!newState) {
      // Outcome doesn't warrant a state change (system-generated)
      return;
    }

    // Only update if the new state is a valid transition
    // (don't downgrade from 'claimed' or 'suppressed')
    const seed = await prisma.$queryRaw<any[]>`
      SELECT outreach_state FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seed[0]) return;

    const currentState = seed[0].outreach_state;
    if (currentState === 'claimed' || currentState === 'suppressed') {
      // Terminal states — don't override
      return;
    }

    await DirectoryPresenceSeedService.setOutreachState(seedId, newState, {
      actorId: ctx?.actorId || ctx?.userId,
      actorType: ctx?.actorType,
    });

    logger.info('SeedOutreachStateSync.syncFromLog', undefined, {
      seedId,
      campaignId,
      outcome,
      newState,
      prevState: currentState,
    });
  }
}
