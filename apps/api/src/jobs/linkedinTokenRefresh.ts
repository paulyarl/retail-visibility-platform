/**
 * LinkedIn Token Refresh Job
 *
 * Spec: docs/LocalBiz/LINKEDIN_POSTING_SPEC.md §4.3 — member tokens live on
 * linkedin_oauth_accounts_list (~60d access token + optional refresh token).
 * Refresh when <7 days remain; accounts past refresh-token expiry are marked
 * reauthorization_required so the surface resolver stops attempting posts.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { encryptToken, decryptToken } from '../lib/meta/oauth';
import { refreshLinkedInToken } from '../lib/linkedin/oauth';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'linkedin-token-refresh';
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const STARTUP_DELAY_MS = 5 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // refresh when <7 days remain

let firstRun = true;

async function runLinkedInTokenRefresh(): Promise<void> {
  try {
    const now = new Date();
    const threshold = new Date(now.getTime() + REFRESH_THRESHOLD_MS);

    const accounts = await prisma.linkedin_oauth_accounts_list.findMany({
      where: {
        reauthorization_required: false,
        OR: [
          // Access token inside the refresh window
          { token_expires_at: { lte: threshold, gt: now } },
          // Refresh token lapsed entirely → force re-auth instead of silent failure
          { refresh_token_expires_at: { lte: now }, refresh_token_enc: { not: null } },
        ],
      },
    });

    let refreshed = 0;
    let reauth = 0;
    let failed = 0;

    for (const account of accounts) {
      try {
        // Refresh token already lapsed → nothing to exchange with.
        if (account.refresh_token_expires_at && account.refresh_token_expires_at <= now) {
          await prisma.linkedin_oauth_accounts_list.update({
            where: { id: account.id },
            data: { reauthorization_required: true, updated_at: now },
          });
          reauth++;
          continue;
        }

        if (!account.refresh_token_enc) {
          // No refresh token issued (scope/app config) — wait for access-token
          // expiry; surface resolution already fails closed on expiry.
          continue;
        }

        const next = await refreshLinkedInToken(decryptToken(account.refresh_token_enc));
        if (!next?.access_token) {
          failed++;
          continue;
        }
        await prisma.linkedin_oauth_accounts_list.update({
          where: { id: account.id },
          data: {
            access_token_enc: encryptToken(next.access_token),
            refresh_token_enc: next.refresh_token ? encryptToken(next.refresh_token) : account.refresh_token_enc,
            token_expires_at: next.expires_in ? new Date(now.getTime() + next.expires_in * 1000) : account.token_expires_at,
            refresh_token_expires_at: next.refresh_token_expires_in
              ? new Date(now.getTime() + next.refresh_token_expires_in * 1000)
              : account.refresh_token_expires_at,
            updated_at: now,
          },
        });
        refreshed++;
      } catch (error) {
        failed++;
        logger.warn('[LinkedInTokenRefresh] refresh failed', undefined, {
          accountId: account.id,
          error: (error as Error).message,
        });
      }
    }

    logger.info('[LinkedInTokenRefresh] pass complete', undefined, { refreshed, reauth, failed });
  } catch (error) {
    logger.error('[LinkedInTokenRefresh] job failed', undefined, { error: (error as Error).message });
  }
}

export async function startLinkedInTokenRefresh(): Promise<void> {
  scheduleJob({
    name: JOB_NAME,
    description: 'Refreshes LinkedIn member OAuth tokens before expiry',
    scheduleLabel: 'every 6 hours',
    envDisableVar: 'DISABLE_LINKEDIN_TOKEN_REFRESH',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : REFRESH_INTERVAL_MS),
    handler: async () => runLinkedInTokenRefresh(),
  });
}

export function stopLinkedInTokenRefresh(): void {
  stopJob(JOB_NAME);
}

export async function runLinkedInTokenRefreshPass(): Promise<void> {
  return runLinkedInTokenRefresh();
}
