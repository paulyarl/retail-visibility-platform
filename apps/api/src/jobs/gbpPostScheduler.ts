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

const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STARTUP_DELAY_MS = 3 * 60 * 1000; // 3 minutes

let postSchedulerIntervalId: NodeJS.Timeout | null = null;

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
async function runPostScheduler(): Promise<void> {
  logger.info('[GbpPostScheduler] Starting scheduled post processing...');

  try {
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

        // Publish to Google
        const result = await createPost(post.tenant_id, gbpPost);

        if (result.success) {
          // Mark as PUBLISHED
          await prisma.gbp_posts.update({
            where: { id: post.id },
            data: {
              status: 'PUBLISHED',
              published_at: new Date(),
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
        } else {
          // Mark as FAILED — will not be retried automatically (merchant can re-create)
          await prisma.gbp_posts.update({
            where: { id: post.id },
            data: {
              status: 'FAILED',
              updated_at: new Date(),
            },
          });
          failed++;
          logger.warn('[GbpPostScheduler] Failed to publish post', undefined, {
            postId: post.id,
            tenantId: post.tenant_id,
            error: result.error,
          });
        }
      } catch (error) {
        // Mark as FAILED on unexpected error
        try {
          await prisma.gbp_posts.update({
            where: { id: post.id },
            data: {
              status: 'FAILED',
              updated_at: new Date(),
            },
          });
        } catch (updateError) {
          logger.error('[GbpPostScheduler] Failed to mark post as FAILED', undefined, {
            postId: post.id,
            error: (updateError as Error).message,
          });
        }
        failed++;
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
  if (process.env.DISABLE_GBP_POST_SCHEDULER === 'true') {
    logger.info('[GbpPostScheduler] Disabled by env var');
    return;
  }

  if (postSchedulerIntervalId) {
    logger.info('[GbpPostScheduler] Already running');
    return;
  }

  logger.info('[GbpPostScheduler] Starting scheduler (every 5min)');

  setTimeout(() => {
    runPostScheduler();
  }, STARTUP_DELAY_MS);

  postSchedulerIntervalId = setInterval(() => {
    runPostScheduler();
  }, SCHEDULER_INTERVAL_MS);
}

/**
 * Stop the scheduled GBP post publisher.
 */
export function stopGbpPostScheduler(): void {
  if (postSchedulerIntervalId) {
    clearInterval(postSchedulerIntervalId);
    postSchedulerIntervalId = null;
    logger.info('[GbpPostScheduler] Stopped');
  }
}

/**
 * Manually trigger the scheduler (used by admin routes / tests).
 */
export async function runSchedulerPass(): Promise<void> {
  return runPostScheduler();
}
