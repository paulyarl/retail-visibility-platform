/**
 * Meta Token Refresh Job
 *
 * Spec: SOCIAL_POSTING_SUITE_SPEC.md §4.0 — gap-sweep correction:
 * the existing oauth-token-refresh job is PayPal/Square gateway-scoped;
 * nothing refreshed Meta tokens. Two refresh paths:
 *
 *  1. Meta user token (meta_oauth_tokens_list): re-run fb_exchange_token to
 *     mint a fresh 60-day long-lived token before expiry.
 *  2. Threads surface tokens (meta_surface_connections surface='threads'):
 *     th_refresh_token — lapses permanently if the 60-day window passes.
 *
 * Page access tokens never expire — no refresh needed.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { encryptToken, decryptToken, getLongLivedToken } from '../lib/meta/oauth';
import { refreshThreadsToken } from '../lib/social/threads-oauth';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'meta-token-refresh';
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const STARTUP_DELAY_MS = 5 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // refresh when <7 days remain

let firstRun = true;

async function refreshUserTokens(): Promise<{ refreshed: number; failed: number }> {
  const threshold = new Date(Date.now() + REFRESH_THRESHOLD_MS);
  const tokens = await prisma.meta_oauth_tokens_list.findMany({
    where: { expires_at: { lte: threshold, gt: new Date() } },
  });

  let refreshed = 0;
  let failed = 0;
  for (const tokenRow of tokens) {
    try {
      const current = decryptToken(tokenRow.access_token_encrypted);
      const next = await getLongLivedToken(current);
      if (!next?.access_token) {
        failed++;
        continue;
      }
      await prisma.meta_oauth_tokens_list.update({
        where: { id: tokenRow.id },
        data: {
          access_token_encrypted: encryptToken(next.access_token),
          expires_at: new Date(Date.now() + next.expires_in * 1000),
          updated_at: new Date(),
        },
      });
      refreshed++;
    } catch (error) {
      failed++;
      logger.warn('[MetaTokenRefresh] user-token refresh failed', undefined, {
        tokenId: tokenRow.id,
        error: (error as Error).message,
      });
    }
  }
  return { refreshed, failed };
}

async function refreshThreadsSurfaces(): Promise<{ refreshed: number; failed: number }> {
  const threshold = new Date(Date.now() + REFRESH_THRESHOLD_MS);
  const surfaces = await prisma.meta_surface_connections.findMany({
    where: {
      surface: 'threads',
      token_expires_at: { lte: threshold, gt: new Date() },
    },
  });

  let refreshed = 0;
  let failed = 0;
  for (const surface of surfaces) {
    try {
      const current = decryptToken(surface.access_token_enc);
      const next = await refreshThreadsToken(current);
      if (!next?.access_token) {
        failed++;
        continue;
      }
      await prisma.meta_surface_connections.update({
        where: { id: surface.id },
        data: {
          access_token_enc: encryptToken(next.access_token),
          token_expires_at: new Date(Date.now() + next.expires_in * 1000),
          updated_at: new Date(),
        },
      });
      refreshed++;
    } catch (error) {
      failed++;
      logger.warn('[MetaTokenRefresh] threads refresh failed', undefined, {
        surfaceId: surface.id,
        error: (error as Error).message,
      });
    }
  }
  return { refreshed, failed };
}

async function runMetaTokenRefresh(): Promise<void> {
  try {
    const user = await refreshUserTokens();
    const threads = await refreshThreadsSurfaces();
    logger.info('[MetaTokenRefresh] pass complete', undefined, {
      userTokens: user,
      threadsTokens: threads,
    });
  } catch (error) {
    logger.error('[MetaTokenRefresh] job failed', undefined, { error: (error as Error).message });
  }
}

export async function startMetaTokenRefresh(): Promise<void> {
  scheduleJob({
    name: JOB_NAME,
    description: 'Refreshes Meta user + Threads surface tokens before expiry',
    scheduleLabel: 'every 6 hours',
    envDisableVar: 'DISABLE_META_TOKEN_REFRESH',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : REFRESH_INTERVAL_MS),
    handler: async () => runMetaTokenRefresh(),
  });
}

export function stopMetaTokenRefresh(): void {
  stopJob(JOB_NAME);
}

export async function runMetaTokenRefreshPass(): Promise<void> {
  return runMetaTokenRefresh();
}
