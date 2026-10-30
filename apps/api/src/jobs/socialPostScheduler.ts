/**
 * Social Post Scheduler Job
 *
 * Spec: docs/LocalBiz/SOCIAL_POSTING_SUITE_SPEC.md §4 Subsystem 2
 * Cloned from gbpPostScheduler.ts mechanics:
 *  - 5-minute cadence, 15-min PUBLISHING lease reclaim, MAX_ATTEMPTS = 3
 *  - 429/Retry-After → reschedule without burning an attempt
 *  - exponential backoff + jitter on failure
 *  - entitlement gate: social_posting_scheduler (60s cache)
 *  - per-platform dispatch via the adapter registry — one platform's outage
 *    fails its own rows without blocking others
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { permissionServiceFactory } from '../services/permissions/PermissionServiceFactory';
import { getSocialAdapter } from '../lib/social/registry';
import { generateQuickStart } from '../lib/id-generator';
import type { SocialPostDraft } from '../lib/social/types';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'social-post-scheduler';
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STARTUP_DELAY_MS = 4 * 60 * 1000; // 4 minutes (staggered after gbpPostScheduler's 3)
const CLAIM_LEASE_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const BATCH_DELAY_MS = 2000;

let firstRun = true;

// ── Entitlement cache ────────────────────────────────────────────────────

const entitlementCache = new Map<string, { value: boolean; expiresAt: number }>();
const ENTITLEMENT_CACHE_TTL_MS = 60 * 1000;

async function hasSchedulerEntitlement(tenantId: string): Promise<boolean> {
  const cached = entitlementCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const value = await permissionServiceFactory.hasFeature(tenantId, 'social_posting_scheduler');
    entitlementCache.set(tenantId, { value, expiresAt: Date.now() + ENTITLEMENT_CACHE_TTL_MS });
    return value;
  } catch (error) {
    logger.warn('[SocialPostScheduler] Entitlement check failed — defaulting to false', undefined, {
      tenantId,
      error: (error as Error).message,
    });
    return false;
  }
}

// ── Recurrence — same mechanics as gbpPostScheduler ─────────────────────

async function spawnRecurrence(post: any): Promise<void> {
  const rec = post.recurrence as { freq?: 'weekly' | 'monthly'; remaining?: number } | null;
  if (!rec?.freq) return;
  if (typeof rec.remaining === 'number' && rec.remaining <= 1) return;

  const next = new Date((post.scheduled_for ?? new Date()).getTime());
  if (rec.freq === 'weekly') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);

  try {
    await prisma.social_posts.create({
      data: {
        id: generateQuickStart('spost'),
        tenant_id: post.tenant_id,
        platform: post.platform,
        target_ref: post.target_ref,
        surface_connection_id: post.surface_connection_id,
        body: post.body,
        link_url: post.link_url,
        media: post.media,
        platform_payload: post.platform_payload,
        status: 'SCHEDULED',
        scheduled_for: next,
        batch_id: post.batch_id ?? null,
        created_by: post.created_by,
        recurrence: typeof rec.remaining === 'number' ? { ...rec, remaining: rec.remaining - 1 } : rec,
      },
    });
    logger.info('[SocialPostScheduler] Spawned next recurrence', undefined, {
      sourcePostId: post.id,
      scheduledFor: next.toISOString(),
      freq: rec.freq,
    });
  } catch (error: any) {
    logger.warn('[SocialPostScheduler] recurrence spawn failed', undefined, {
      postId: post.id,
      error: error?.message,
    });
  }
}

// ── Publish-failure bookkeeping ──────────────────────────────────────────

async function handlePublishFailure(
  post: { id: string; tenant_id: string; attempts: number },
  error: string,
  status?: number,
  retryAfterMs?: number,
): Promise<void> {
  const attempts = (post.attempts ?? 0) + 1;

  if (status === 429) {
    await prisma.social_posts.update({
      where: { id: post.id },
      data: {
        status: 'SCHEDULED',
        publishing_started_at: null,
        scheduled_for: new Date(Date.now() + (retryAfterMs ?? 60_000)),
        last_error: error,
        updated_at: new Date(),
      },
    });
    logger.warn('[SocialPostScheduler] Rate-limited — rescheduling post', undefined, {
      postId: post.id,
      retryAfterMs,
    });
    return;
  }

  if (attempts >= MAX_ATTEMPTS) {
    await prisma.social_posts.update({
      where: { id: post.id },
      data: {
        status: 'FAILED',
        publishing_started_at: null,
        attempts,
        last_error: error,
        updated_at: new Date(),
      },
    });
    logger.warn('[SocialPostScheduler] Post failed after max attempts', undefined, {
      postId: post.id,
      attempts,
      error,
    });
    return;
  }

  const backoffMs = Math.pow(2, attempts) * 5 * 60 * 1000 + Math.floor(Math.random() * 60_000);
  await prisma.social_posts.update({
    where: { id: post.id },
    data: {
      status: 'SCHEDULED',
      publishing_started_at: null,
      attempts,
      last_error: error,
      scheduled_for: new Date(Date.now() + backoffMs),
      updated_at: new Date(),
    },
  });
}

// ── Main pass ────────────────────────────────────────────────────────────

async function runPostScheduler(): Promise<void> {
  logger.info('[SocialPostScheduler] Starting scheduled post processing...');

  try {
    // Reclaim stale claims
    await prisma.social_posts.updateMany({
      where: {
        status: 'PUBLISHING',
        publishing_started_at: { lt: new Date(Date.now() - CLAIM_LEASE_MS) },
      },
      data: { status: 'SCHEDULED', publishing_started_at: null },
    });

    const duePosts = await prisma.social_posts.findMany({
      where: {
        status: 'SCHEDULED',
        scheduled_for: { lte: new Date() },
      },
      orderBy: { scheduled_for: 'asc' },
      take: 50,
    });

    if (duePosts.length === 0) {
      logger.info('[SocialPostScheduler] No due scheduled posts — skipping');
      return;
    }

    let published = 0;
    let failed = 0;
    let skipped = 0;

    for (const post of duePosts) {
      try {
        const entitled = await hasSchedulerEntitlement(post.tenant_id);
        if (!entitled) {
          skipped++;
          continue;
        }

        const adapter = getSocialAdapter(post.platform);
        if (!adapter) {
          await prisma.social_posts.update({
            where: { id: post.id },
            data: { status: 'FAILED', last_error: `no adapter for platform ${post.platform}`, updated_at: new Date() },
          });
          failed++;
          continue;
        }

        const draft: SocialPostDraft = {
          tenantId: post.tenant_id,
          platform: post.platform as SocialPostDraft['platform'],
          targetRef: post.target_ref,
          body: post.body,
          linkUrl: post.link_url,
          media: (post.media as unknown as SocialPostDraft['media']) ?? undefined,
          platformPayload: (post.platform_payload as Record<string, unknown>) ?? undefined,
        };

        // Atomic claim — never publish the same row twice
        const claim = await prisma.social_posts.updateMany({
          where: { id: post.id, status: 'SCHEDULED' },
          data: { status: 'PUBLISHING', publishing_started_at: new Date() },
        });
        if (claim.count === 0) {
          skipped++;
          continue;
        }

        const result = await adapter.publish(post.tenant_id, draft);

        if (result.success) {
          await prisma.social_posts.update({
            where: { id: post.id },
            data: {
              status: 'PUBLISHED',
              published_at: new Date(),
              publishing_started_at: null,
              last_error: null,
              remote_post_id: result.remoteId ?? null,
              permalink: result.permalink ?? null,
              updated_at: new Date(),
            },
          });
          published++;
          logger.info('[SocialPostScheduler] Published post', undefined, {
            postId: post.id,
            tenantId: post.tenant_id,
            platform: post.platform,
            remoteId: result.remoteId,
          });
          await spawnRecurrence(post);
        } else {
          await handlePublishFailure(post, result.error || 'publish_failed', result.status, result.retryAfterMs);
          if (result.status === 429 || post.attempts + 1 < MAX_ATTEMPTS) skipped++;
          else failed++;
        }

        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      } catch (error) {
        await handlePublishFailure(post, (error as Error).message);
        if (post.attempts + 1 < MAX_ATTEMPTS) skipped++;
        else failed++;
        logger.error('[SocialPostScheduler] Error processing post', undefined, {
          postId: post.id,
          error: (error as Error).message,
        });
      }
    }

    logger.info('[SocialPostScheduler] Pass complete', undefined, { published, failed, skipped });
  } catch (error) {
    logger.error('[SocialPostScheduler] Job failed', undefined, {
      error: (error as Error).message,
    });
  }
}

// ── Scheduler lifecycle ──────────────────────────────────────────────────

export async function startSocialPostScheduler(): Promise<void> {
  scheduleJob({
    name: JOB_NAME,
    description: 'Publishes due scheduled social posts across platforms',
    scheduleLabel: 'every 5 minutes',
    envDisableVar: 'DISABLE_SOCIAL_POST_SCHEDULER',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : SCHEDULER_INTERVAL_MS),
    handler: async () => runPostScheduler(),
  });
}

export function stopSocialPostScheduler(): void {
  stopJob(JOB_NAME);
}

export async function runSchedulerPass(): Promise<void> {
  return runPostScheduler();
}
