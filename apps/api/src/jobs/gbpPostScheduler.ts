/**
 * GBP Post Scheduler Job
 *
 * Runs every 5 minutes to publish due SCHEDULED posts to Google Business
 * Profile. Only processes posts for tenants with the `gbp_posts_scheduler`
 * capability. Tenants without the entitlement can still create immediate-
 * publish posts (no scheduling).
 *
 * Flow:
 * 1. Query gbp_posts where status = 'SCHEDULED' AND scheduled_for <= NOW()
 * 2. For each due post, check tenant entitlement (gbp_posts_scheduler)
 * 3. Call GBPAdvancedSync.createPost to publish to Google
 * 4. On success: set status = 'PUBLISHED', published_at = NOW(), store post_name
 * 5. On failure: set status = 'FAILED', log error
 * 6. Never double-publish: only SCHEDULED rows are processed
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §4 Subsystem 3
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE3.md Task 1
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { permissionServiceFactory } from '../services/permissions/PermissionServiceFactory';
import { createPost, type GBPPost } from '../services/GBPAdvancedSync';
import { CrmAlertService } from '../services/CrmAlertService';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import { emitGbpActivity } from '../lib/google/gbp-activity';
import { generateQuickStart } from '../lib/id-generator';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'gbp-post-scheduler';
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STARTUP_DELAY_MS = 3 * 60 * 1000; // 3 minutes
const CLAIM_LEASE_MS = 15 * 60 * 1000; // PUBLISHING rows older than this are reclaimed
const MAX_ATTEMPTS = 3;

let firstRun = true;

// ── Entitlement cache (short TTL to avoid repeated DB hits) ──────────────

const entitlementCache = new Map<string, { value: boolean; expiresAt: number }>();
const ENTITLEMENT_CACHE_TTL_MS = 60 * 1000; // 1 minute

async function hasPostsSchedulerEntitlement(tenantId: string): Promise<boolean> {
  const cached = entitlementCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const value = await permissionServiceFactory.hasFeature(tenantId, 'gbp_posts_scheduler');
    entitlementCache.set(tenantId, { value, expiresAt: Date.now() + ENTITLEMENT_CACHE_TTL_MS });
    return value;
  } catch (error) {
    logger.warn('[GbpPostScheduler] Entitlement check failed — defaulting to false', undefined, {
      tenantId,
      error: (error as Error).message,
    });
    return false;
  }
}

// ── Post-expiration upgrade trigger (§5.1) ──────────────────────────────

/**
 * Emit gbp_post_expired alerts for posts whose event/offer window ended
 * ≥6 days ago ("Your Google ranking drops when posts expire..."). Fires
 * once per post (deduped via existing crm_alerts rows keyed by
 * metadata.post_id), mkt_direct targeted per linked customer, and
 * suppressed for tenants with an active gbp_posts_scheduler entitlement.
 */
async function emitPostExpirationTriggers(): Promise<void> {
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

  const expiredPosts = await prisma.gbp_posts.findMany({
    where: {
      status: 'PUBLISHED',
      event_end_date: { not: null, lte: sixDaysAgo },
    },
    select: { id: true, tenant_id: true, summary: true, event_end_date: true },
    take: 100,
  });

  for (const post of expiredPosts) {
    try {
      // Suppressed once the tenant has the scheduler entitlement
      const entitled = await hasPostsSchedulerEntitlement(post.tenant_id);
      if (entitled) continue;

      // Dedupe: only fire once per post
      const existing = await prisma.crm_alerts.findFirst({
        where: { type: 'gbp_post_expired', metadata: { path: ['post_id'], equals: post.id } },
        select: { id: true },
      });
      if (existing) continue;

      const links = await prisma.mkt_customer_gbp_links.findMany({
        where: { tenant_id: post.tenant_id },
        select: { customer_id: true },
      });

      const baseMetadata = {
        tenant_id: post.tenant_id,
        post_id: post.id,
        expired_at: post.event_end_date,
      };
      const targets: Array<Record<string, any>> = links.length > 0
        ? links.map((l) => ({ ...baseMetadata, customer_id: l.customer_id }))
        : [baseMetadata];

      for (const metadata of targets) {
        await CrmAlertService.getInstance().create({
          tenant_id: PLATFORM_SCOPE,
          type: 'gbp_post_expired',
          title: 'A Google post has expired',
          body: `"${post.summary.slice(0, 80)}" expired ${post.event_end_date ? `on ${post.event_end_date.toLocaleDateString()}` : 'recently'}. Your Google ranking drops when posts expire — enable Auto-Scheduler to keep fresh offers active.`,
          icon: 'calendar',
          metadata,
        });
      }
    } catch (error) {
      logger.warn('[GbpPostScheduler] Failed to emit post-expiration trigger', undefined, {
        postId: post.id,
        tenantId: post.tenant_id,
        error: (error as Error).message,
      });
    }
  }
}

// ── Scheduler runner ─────────────────────────────────────────────────────

/**
 * Process all due SCHEDULED posts. Runs every 5 minutes.
 */
/**
 * Recurrence — after a post with `recurrence` publishes, spawn the next
 * SCHEDULED row carrying the same content. Repeat is entirely platform-side:
 * Google only ever sees individual posts. `remaining` counts down when set;
 * absent means repeat until cancelled.
 */
async function spawnRecurrence(post: any): Promise<void> {
  const rec = post.recurrence as { freq?: 'weekly' | 'monthly'; remaining?: number } | null;
  if (!rec?.freq) return;
  if (typeof rec.remaining === 'number' && rec.remaining <= 1) return;

  const next = new Date((post.scheduled_for ?? new Date()).getTime());
  if (rec.freq === 'weekly') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);

  try {
    await prisma.gbp_posts.create({
      data: {
        id: generateQuickStart('gbpp'),
        tenant_id: post.tenant_id,
        location_id: post.location_id ?? null,
        batch_id: post.batch_id ?? null,
        summary: post.summary,
        topic_type: post.topic_type,
        call_to_action_type: post.call_to_action_type,
        call_to_action_url: post.call_to_action_url,
        media_url: post.media_url,
        event_title: post.event_title,
        event_start_date: post.event_start_date,
        event_end_date: post.event_end_date,
        offer_coupon_code: post.offer_coupon_code,
        offer_redeem_url: post.offer_redeem_url,
        offer_terms: post.offer_terms,
        status: 'SCHEDULED',
        scheduled_for: next,
        created_by: post.created_by,
        recurrence: typeof rec.remaining === 'number' ? { ...rec, remaining: rec.remaining - 1 } : rec,
      },
    });
    logger.info('[GbpPostScheduler] Spawned next recurrence', undefined, {
      sourcePostId: post.id,
      scheduledFor: next.toISOString(),
      freq: rec.freq,
    });
  } catch (error: any) {
    // A failed spawn must never break the publish pass — the row already went out.
    logger.warn('[GbpPostScheduler] recurrence spawn failed', undefined, {
      postId: post.id,
      error: error?.message,
    });
  }
}

/**
 * Publish-failure bookkeeping (Sprint D2, spec §6.3):
 *  - 429 / Retry-After → reschedule, no attempt burned
 *  - attempts < MAX_ATTEMPTS → back to SCHEDULED with exponential backoff + jitter
 *  - attempts >= MAX_ATTEMPTS → FAILED + last_error + ops-internal activity event
 */
async function handlePublishFailure(
  post: { id: string; tenant_id: string; location_id?: string | null; batch_id?: string | null; attempts: number },
  error: string,
  status?: number,
  retryAfterMs?: number
): Promise<void> {
  const attempts = (post.attempts ?? 0) + 1;

  if (status === 429) {
    await prisma.gbp_posts.update({
      where: { id: post.id },
      data: {
        status: 'SCHEDULED',
        publishing_started_at: null,
        scheduled_for: new Date(Date.now() + (retryAfterMs ?? 60_000)),
        last_error: error,
        updated_at: new Date(),
      },
    });
    logger.warn('[GbpPostScheduler] Rate-limited — rescheduling post', undefined, {
      postId: post.id,
      retryAfterMs,
    });
    return;
  }

  if (attempts >= MAX_ATTEMPTS) {
    await prisma.gbp_posts.update({
      where: { id: post.id },
      data: {
        status: 'FAILED',
        publishing_started_at: null,
        attempts,
        last_error: error,
        updated_at: new Date(),
      },
    });
    await emitGbpActivity({
      tenantId: post.tenant_id,
      gbpLocationId: post.location_id ?? null,
      action: 'post_failed',
      actor: 'system',
      detail: { postId: post.id, error, attempts, batchId: post.batch_id ?? null },
      visibleToMerchant: false,
    });
    logger.warn('[GbpPostScheduler] Post failed after max attempts', undefined, {
      postId: post.id,
      attempts,
      error,
    });
    return;
  }

  const backoffMs = Math.pow(2, attempts) * 5 * 60 * 1000 + Math.floor(Math.random() * 60_000);
  await prisma.gbp_posts.update({
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

async function runPostScheduler(): Promise<void> {
  logger.info('[GbpPostScheduler] Starting scheduled post processing...');

  try {
    // Reclaim stale claims — a row left PUBLISHING past the lease means its
    // worker died mid-publish; put it back so this pass can take it.
    await prisma.gbp_posts.updateMany({
      where: {
        status: 'PUBLISHING',
        publishing_started_at: { lt: new Date(Date.now() - CLAIM_LEASE_MS) },
      },
      data: { status: 'SCHEDULED', publishing_started_at: null },
    });

    const duePosts = await prisma.gbp_posts.findMany({
      where: {
        status: 'SCHEDULED',
        scheduled_for: { lte: new Date() },
      },
      orderBy: { scheduled_for: 'asc' },
      take: 50, // batch limit
    });

    if (duePosts.length === 0) {
      logger.info('[GbpPostScheduler] No due scheduled posts — skipping');
      // §5.1 post-expiration trigger still runs — expiry observation is
      // independent of the publish queue
      await emitPostExpirationTriggers();
      return;
    }

    let published = 0;
    let failed = 0;
    let skipped = 0;

    // Approval-mode cache (Q3): one lookup per tenant per pass.
    const approvalModeCache = new Map<string, string>();
    const getApprovalMode = async (tenantId: string): Promise<string> => {
      if (!approvalModeCache.has(tenantId)) {
        const s = await prisma.tenant_gbp_options_settings.findUnique({
          where: { tenant_id: tenantId },
          select: { gbp_approval_mode: true },
        });
        approvalModeCache.set(tenantId, (s as any)?.gbp_approval_mode ?? 'auto_publish');
      }
      return approvalModeCache.get(tenantId)!;
    };

    for (const post of duePosts) {
      try {
        // Entitlement gate — only process for tenants with gbp_posts_scheduler
        const entitled = await hasPostsSchedulerEntitlement(post.tenant_id);
        if (!entitled) {
          skipped++;
          // Leave as SCHEDULED — if entitlement is granted later, it will be picked up
          continue;
        }

        // Build the GBPPost payload from the stored row
        const gbpPost: GBPPost = {
          summary: post.summary,
          topicType: (post.topic_type as 'STANDARD' | 'EVENT' | 'OFFER') || 'STANDARD',
          ...(post.call_to_action_type && post.call_to_action_url
            ? {
                callToAction: {
                  actionType: post.call_to_action_type as 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL',
                  url: post.call_to_action_url,
                },
              }
            : {}),
          ...(post.media_url
            ? {
                media: [{ sourceUrl: post.media_url, mediaFormat: 'PHOTO' as const }],
              }
            : {}),
          ...(post.event_title && post.event_start_date && post.event_end_date
            ? {
                event: {
                  title: post.event_title,
                  schedule: {
                    startDate: {
                      year: post.event_start_date.getFullYear(),
                      month: post.event_start_date.getMonth() + 1,
                      day: post.event_start_date.getDate(),
                    },
                    endDate: {
                      year: post.event_end_date.getFullYear(),
                      month: post.event_end_date.getMonth() + 1,
                      day: post.event_end_date.getDate(),
                    },
                  },
                },
              }
            : {}),
          ...(post.offer_coupon_code || post.offer_redeem_url
            ? {
                offer: {
                  couponCode: post.offer_coupon_code || undefined,
                  redeemOnlineUrl: post.offer_redeem_url || undefined,
                  termsConditions: post.offer_terms || undefined,
                },
              }
            : {}),
        };

        // Approval mode (Q3): non-auto_publish modes hold rows until the
        // merchant approves them from the managed view (approved_at set).
        const approvalMode = await getApprovalMode(post.tenant_id);
        if (approvalMode !== 'auto_publish' && !(post as any).approved_at) {
          skipped++;
          continue;
        }

        // Atomic claim — SCHEDULED → PUBLISHING. count===0 means another
        // worker took it; never publish the same row twice.
        const claim = await prisma.gbp_posts.updateMany({
          where: { id: post.id, status: 'SCHEDULED' },
          data: { status: 'PUBLISHING', publishing_started_at: new Date() },
        });
        if (claim.count === 0) {
          skipped++;
          continue;
        }

        // Publish to Google — persist:false because this row IS the record.
        const result = await createPost(post.tenant_id, gbpPost, { persist: false });

        if (result.success) {
          await prisma.gbp_posts.update({
            where: { id: post.id },
            data: {
              status: 'PUBLISHED',
              published_at: new Date(),
              publishing_started_at: null,
              last_error: null,
              post_name: result.postId || null,
              google_post_id: result.postId || null,
              updated_at: new Date(),
            },
          });
          published++;
          logger.info('[GbpPostScheduler] Published post', undefined, {
            postId: post.id,
            tenantId: post.tenant_id,
            googlePostId: result.postId,
          });
          await emitGbpActivity({
            tenantId: post.tenant_id,
            gbpLocationId: (post as any).location_id ?? null,
            action: 'post_published',
            actor: post.created_by === 'admin' ? 'admin' : post.created_by === 'autopilot' ? 'autopilot' : 'system',
            detail: {
              postId: post.id,
              remotePostName: result.postId,
              batchId: (post as any).batch_id ?? null,
              summary: post.summary?.slice(0, 80),
            },
          });
          await spawnRecurrence(post);
        } else {
          await handlePublishFailure(post, result.error || 'publish_failed', result.status, result.retryAfterMs);
          if (result.status === 429 || post.attempts + 1 < MAX_ATTEMPTS) skipped++;
          else failed++;
        }
      } catch (error) {
        await handlePublishFailure(post, (error as Error).message);
        if (post.attempts + 1 < MAX_ATTEMPTS) skipped++;
        else failed++;
        logger.error('[GbpPostScheduler] Error processing post', undefined, {
          postId: post.id,
          tenantId: post.tenant_id,
          error: (error as Error).message,
        });
      }

      // Small delay between posts to be respectful to the Google API
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info('[GbpPostScheduler] Completed', undefined, {
      total: duePosts.length,
      published,
      failed,
      skipped,
    });

    // §5.1 post-expiration upgrade trigger — emitted when the scheduler
    // observes expired posts (day 6+ after expiry)
    await emitPostExpirationTriggers();
  } catch (error) {
    logger.error('[GbpPostScheduler] Failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
        stack: (error as Error)?.stack,
      },
    });
  }
}

// ── Scheduler lifecycle ──────────────────────────────────────────────────

/**
 * Start the scheduled GBP post publisher (every 5 minutes).
 */
export async function startGbpPostScheduler(): Promise<void> {
  scheduleJob({
    name: JOB_NAME,
    description: 'Publishes due scheduled GBP posts',
    scheduleLabel: 'every 5 minutes',
    envDisableVar: 'DISABLE_GBP_POST_SCHEDULER',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : SCHEDULER_INTERVAL_MS),
    handler: async () => runPostScheduler(),
  });
}

/**
 * Stop the scheduled GBP post publisher.
 */
export function stopGbpPostScheduler(): void {
  stopJob(JOB_NAME);
}

/**
 * Manually trigger the scheduler (used by admin routes / tests).
 */
export async function runSchedulerPass(): Promise<void> {
  return runPostScheduler();
}
