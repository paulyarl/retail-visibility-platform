/**
 * Recovery Resolution Scheduler Job
 *
 * Polls mkt_prompt_executions_list for pending recovery_resolution executions,
 * invokes RecoveryResolutionService.run() for each, and marks them
 * complete/failed. Also houses the S2 orphan-attachment purge.
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_RECOVERY_RESOLUTION env var.
 *
 * Sprint 3 — Recovery Management Engine.
 */

import { logger } from '../logger';
import { prisma } from '../prisma';
import { unifiedConfig } from '../config/unifiedConfig';

const STARTUP_DELAY_MS = 3 * 60 * 1000; // 3 minutes
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ORPHAN_PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const ORPHAN_PURGE_THRESHOLD_DAYS = 7;

let resolutionIntervalId: NodeJS.Timeout | null = null;
let orphanPurgeIntervalId: NodeJS.Timeout | null = null;

// ====================
// RECOVERY RESOLUTION POLL
// ====================

async function runRecoveryResolutionPass(): Promise<void> {
  logger.info('[RecoveryResolution] Starting pending execution pass...');

  try {
    // Find pending executions whose template is the recovery_resolution template
    const pendingExecutions = await prisma.mkt_prompt_executions_list.findMany({
      where: {
        status: 'pending',
        template_id: 'mpt-recovery-resolution-default',
      },
      take: 10, // Process in batches
    });

    if (pendingExecutions.length === 0) {
      logger.info('[RecoveryResolution] No pending recovery executions');
      return;
    }

    logger.info(`[RecoveryResolution] Found ${pendingExecutions.length} pending execution(s)`);

    const { default: RecoveryResolutionService } = await import('../services/RecoveryResolutionService');

    for (const execution of pendingExecutions) {
      try {
        const result = await RecoveryResolutionService.run(execution.id);
        logger.info('[RecoveryResolution] Execution processed', undefined, {
          executionId: execution.id,
          campaignId: result.campaignId,
          passed: result.passed,
          stage: result.stage,
        });
      } catch (error) {
        logger.error('[RecoveryResolution] Execution failed', undefined, {
          executionId: execution.id,
          error: {
            name: (error as Error)?.name || 'Error',
            message: (error as Error)?.message || String(error),
          },
        });
        // Continue to next execution — one failure shouldn't block the batch
      }
    }

    logger.info(`[RecoveryResolution] Pass complete (${pendingExecutions.length} processed)`);
  } catch (error) {
    logger.error('[RecoveryResolution] Pass failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
        stack: (error as Error)?.stack,
      },
    });
  }
}

// ====================
// ORPHAN ATTACHMENT PURGE (S2 task 7)
// ====================

async function runOrphanAttachmentPurge(): Promise<void> {
  logger.info('[RecoveryResolution] Starting orphan attachment purge...');

  try {
    const threshold = new Date(Date.now() - ORPHAN_PURGE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    // Find dispute intakes that are unsubmitted AND expired > threshold days
    const orphanIntakes = await prisma.mkt_dispute_intake.findMany({
      where: {
        submitted_at: null,
        expires_at: { lt: threshold },
      },
      select: { id: true },
    });

    if (orphanIntakes.length === 0) {
      logger.info('[RecoveryResolution] No orphan attachments to purge');
      return;
    }

    const orphanIntakeIds = orphanIntakes.map((i) => i.id);
    let purgedCount = 0;

    // Delete attachment rows (storage objects would be purged by Supabase
    // lifecycle policies or a future storage cleanup job — here we just
    // clean the DB metadata)
    for (const intakeId of orphanIntakeIds) {
      const deleted = await prisma.mkt_dispute_attachments.deleteMany({
        where: { dispute_intake_id: intakeId },
      });
      purgedCount += deleted.count;
    }

    logger.info(`[RecoveryResolution] Orphan purge complete: ${purgedCount} attachment(s) purged from ${orphanIntakeIds.length} expired intake(s)`);
  } catch (error) {
    logger.error('[RecoveryResolution] Orphan purge failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
      },
    });
  }
}

// ====================
// INTAKE TIMEOUT SWEEP — campaigns stuck in awaiting_owner_intake past
// token TTL + cascade exhaustion transition to dead (no limbo states)
// ====================

async function runIntakeTimeoutSweep(): Promise<void> {
  try {
    // Find recovery campaigns stuck in awaiting_owner_intake
    const stuckCampaigns = await prisma.mkt_campaigns_list.findMany({
      where: {
        campaign_category: 'recovery_management',
        stage: 'awaiting_owner_intake',
      },
      select: {
        id: true,
        stage_entered_at: true,
        mkt_dispute_intake: { select: { expires_at: true } },
      },
    });

    if (stuckCampaigns.length === 0) {
      return;
    }

    const now = new Date();
    const cascadeBufferMs = 4 * 24 * 60 * 60 * 1000; // 4 days past expiry for cascade exhaustion
    const { default: MarketingCampaignService } = await import('../services/MarketingCampaignService.js');
    let sweptCount = 0;

    for (const campaign of stuckCampaigns) {
      const intake = campaign.mkt_dispute_intake;
      if (!intake) continue;

      const expiryWithBuffer = new Date(intake.expires_at.getTime() + cascadeBufferMs);
      if (now < expiryWithBuffer) continue;

      // Token expired + cascade exhausted → transition to dead
      try {
        await MarketingCampaignService.transitionStage({
          campaignId: campaign.id,
          toStage: 'dead',
          triggerType: 'system',
          notes: 'Intake token expired + outreach cascade exhausted',
        });
        sweptCount++;
        logger.info('[RecoveryResolution] Stuck campaign transitioned to dead', undefined, {
          campaignId: campaign.id,
        });
      } catch (error) {
        logger.warn('[RecoveryResolution] Failed to sweep stuck campaign', undefined, {
          campaignId: campaign.id,
          error: (error as Error).message,
        });
      }
    }

    if (sweptCount > 0) {
      logger.info(`[RecoveryResolution] Intake timeout sweep: ${sweptCount} campaign(s) transitioned to dead`);
    }
  } catch (error) {
    logger.error('[RecoveryResolution] Intake timeout sweep failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
      },
    });
  }
}

// ====================
// RECOVERY CASCADE — fire Day 1/2/4 outreach sequence for campaigns
// stuck in awaiting_owner_intake
// ====================

async function runRecoveryCascadePass(): Promise<void> {
  try {
    const { default: RecoveryCascadeService } = await import('../services/RecoveryCascadeService.js');
    const result = await RecoveryCascadeService.run();
    if (result.fired > 0) {
      logger.info(`[RecoveryResolution] Cascade: ${result.fired} step(s) fired, ${result.skipped} skipped`);
    }
  } catch (error) {
    logger.error('[RecoveryResolution] Cascade pass failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
      },
    });
  }
}

// ====================
// LIFECYCLE
// ====================

export async function startRecoveryResolutionJob(): Promise<void> {
  if (process.env.DISABLE_RECOVERY_RESOLUTION === 'true') {
    logger.info('[RecoveryResolution] Disabled by env var');
    return;
  }

  if (resolutionIntervalId) {
    logger.info('[RecoveryResolution] Already running');
    return;
  }

  logger.info(`[RecoveryResolution] Starting scheduler (every ${POLL_INTERVAL_MS / 60000}min)`);

  // Initial pass after startup delay
  setTimeout(() => {
    runRecoveryResolutionPass();
    runIntakeTimeoutSweep();
    runRecoveryCascadePass();
  }, STARTUP_DELAY_MS);

  resolutionIntervalId = setInterval(() => {
    runRecoveryResolutionPass();
    runIntakeTimeoutSweep();
    runRecoveryCascadePass();
  }, POLL_INTERVAL_MS);

  // Orphan purge runs on its own slower interval
  setTimeout(() => {
    runOrphanAttachmentPurge();
  }, STARTUP_DELAY_MS + 60_000); // 1 min after the resolution pass

  orphanPurgeIntervalId = setInterval(() => {
    runOrphanAttachmentPurge();
  }, ORPHAN_PURGE_INTERVAL_MS);
}

export function stopRecoveryResolutionJob(): void {
  if (resolutionIntervalId) {
    clearInterval(resolutionIntervalId);
    resolutionIntervalId = null;
  }
  if (orphanPurgeIntervalId) {
    clearInterval(orphanPurgeIntervalId);
    orphanPurgeIntervalId = null;
  }
  logger.info('[RecoveryResolution] Stopped');
}
