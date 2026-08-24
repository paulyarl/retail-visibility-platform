/**
 * GBP Review Ingestion Job
 *
 * Hourly cron that polls Google's reviews.list API for every tenant with a
 * linked GBP location, upserts reviews into gbp_reviews, refreshes the cached
 * aggregate rating on gbp_locations_list, tags sentiment on new/updated
 * reviews, reconciles reply_status for already-replied reviews, and fires
 * gbp_new_review CRM alerts for each newly detected review.
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §4 Subsystem 2
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE2.md Task 1 + Task 7
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_GBP_REVIEW_INGESTION env var.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { CrmAlertService } from '../services/CrmAlertService';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import { listReviews } from '../services/GBPAdvancedSync';

const HOURLY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 50;

let reviewIngestionIntervalId: NodeJS.Timeout | null = null;

// ── Sentiment tagging (v1 — rule-based, no external API) ─────────────────

function classifySentiment(starRating: number | null, comment: string | null): 'positive' | 'neutral' | 'negative' | null {
  if (starRating === null) return null;
  if (starRating <= 2) return 'negative';
  if (starRating === 3) return 'neutral';
  if (starRating >= 4) return 'positive';
  return null;
}

// ── Alert targeting ──────────────────────────────────────────────────────

/**
 * Resolve the marketing customers linked to this tenant via the
 * mkt_customer_gbp_links bridge (Subsystem 0). gbp_new_review alerts use
 * mkt_direct targeting (metadata.customer_id) so they are visible to the
 * customer in the portal — alerts with only tenant metadata are filtered
 * out by the read-time targeting in marketing-customer.ts.
 */
async function getLinkedCustomerIds(tenantId: string): Promise<string[]> {
  try {
    const links = await prisma.mkt_customer_gbp_links.findMany({
      where: { tenant_id: tenantId },
      select: { customer_id: true },
    });
    return links.map((l) => l.customer_id);
  } catch (error) {
    logger.warn('[GbpReviewIngestion] Failed to resolve linked customers — alerts will be tenant-scoped only', undefined, {
      tenantId,
      error: (error as Error).message,
    });
    return [];
  }
}

const STAR_RATING_INT: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

// ── Per-tenant ingestion ─────────────────────────────────────────────────

/**
 * Ingest reviews for a single tenant. Returns the count of NEW reviews
 * detected (used for alert firing).
 */
async function ingestReviewsForTenant(tenantId: string): Promise<number> {
  let newReviewCount = 0;
  let pageToken: string | undefined;
  let averageRating: number | undefined;
  let totalReviewCount: number | undefined;

  // Resolve linked customers once per tenant for mkt_direct alert targeting
  const linkedCustomerIds = await getLinkedCustomerIds(tenantId);

  // Collect all reviews across pages (single-location v1 — typically 1 page)
  do {
    const result = await listReviews(tenantId, PAGE_SIZE, pageToken);
    if (!result.success) {
      logger.warn('[GbpReviewIngestion] listReviews failed for tenant', undefined, {
        tenantId,
        error: result.error,
      });
      return 0;
    }

    if (result.averageRating !== undefined) averageRating = result.averageRating;
    if (result.totalReviewCount !== undefined) totalReviewCount = result.totalReviewCount;

    // listReviews → storeReviews already upserts into gbp_reviews.
    // We need to detect which ones are NEW (not previously in the DB) so we
    // can fire alerts and tag sentiment. Query the DB for the review IDs we
    // just stored to determine which were newly created.
    if (result.reviews.length > 0) {
      const reviewIds = result.reviews.map((r) => r.name);
      const existing = await prisma.gbp_reviews.findMany({
        where: { google_review_id: { in: reviewIds } },
        select: { google_review_id: true, created_at: true, updated_at: true, reply_status: true, is_replied: true },
      });

      const existingMap = new Map(existing.map((r) => [r.google_review_id, r]));

      for (const review of result.reviews) {
        const row = existingMap.get(review.name);
        const isNew = !row || (row.created_at && row.updated_at && row.created_at.getTime() === row.updated_at.getTime());
        const sentiment = classifySentiment(
          review.starRating ? ({ ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as Record<string, number>)[review.starRating] ?? null : null,
          review.comment ?? null,
        );

        // Update sentiment + reconcile reply_status for newly detected or replied reviews
        if (row) {
          const isReplied = !!review.reviewReply;
          const replyStatusNeedsUpdate = isReplied && row.reply_status === 'NONE';
          if (sentiment || replyStatusNeedsUpdate) {
            await prisma.gbp_reviews.update({
              where: { google_review_id: review.name },
              data: {
                ...(sentiment ? { sentiment } : {}),
                ...(replyStatusNeedsUpdate ? { reply_status: 'PUBLISHED' } : {}),
              },
            });
          }
        }

        if (isNew) {
          newReviewCount++;
          // Fire gbp_new_review CRM alert (best-effort — failures logged, never thrown).
          // mkt_direct targeting: one alert per linked customer with
          // metadata.customer_id so the portal read-time targeting filter
          // (marketing-customer.ts) surfaces it. Tenants with no linked
          // customers get a single tenant-scoped alert (operator visibility).
          const starInt = review.starRating ? STAR_RATING_INT[review.starRating] ?? null : null;
          const baseMetadata = {
            tenant_id: tenantId,
            review_id: review.name,
            reviewer_name: review.reviewer?.displayName ?? null,
            star_rating: starInt,
            snippet: review.comment ? review.comment.slice(0, 200) : null,
          };
          const alertTitle = `New ${starInt ?? ''}★ review from ${review.reviewer?.displayName ?? 'a customer'}`;
          const alertBody = review.comment ? review.comment.slice(0, 200) : 'No comment provided.';
          const targets: Array<Record<string, any>> = linkedCustomerIds.length > 0
            ? linkedCustomerIds.map((customerId) => ({ ...baseMetadata, customer_id: customerId }))
            : [baseMetadata];

          for (const metadata of targets) {
            try {
              await CrmAlertService.getInstance().create({
                tenant_id: PLATFORM_SCOPE,
                type: 'gbp_new_review',
                title: alertTitle,
                body: alertBody,
                icon: 'star',
                metadata,
              });
            } catch (alertError) {
              logger.warn('[GbpReviewIngestion] Failed to fire gbp_new_review alert', undefined, {
                tenantId,
                reviewId: review.name,
                customerId: metadata.customer_id,
                error: (alertError as Error).message,
              });
            }
          }
        }
      }
    }

    pageToken = result.nextPageToken;
  } while (pageToken);

  // Refresh cached aggregate rating on gbp_locations_list
  if (averageRating !== undefined || totalReviewCount !== undefined) {
    try {
      await prisma.gbp_locations_list.updateMany({
        where: { tenant_id: tenantId },
        data: {
          ...(averageRating !== undefined ? { cached_average_rating: averageRating } : {}),
          ...(totalReviewCount !== undefined ? { cached_review_count: totalReviewCount } : {}),
          rating_cache_updated: new Date(),
        },
      });
    } catch (error) {
      logger.warn('[GbpReviewIngestion] Failed to refresh cached aggregate rating', undefined, {
        tenantId,
        error: (error as Error).message,
      });
    }
  }

  return newReviewCount;
}

// ── Hourly sync runner ───────────────────────────────────────────────────

/**
 * Run hourly review ingestion for all tenants with a linked GBP location.
 * A "linked" tenant is one that has both a google_oauth_accounts_list row
 * and a gbp_locations_list row.
 */
async function runHourlyIngestion(): Promise<void> {
  logger.info('[GbpReviewIngestion] Starting hourly review ingestion...');

  try {
    // Find all tenants with a linked GBP location
    const linkedTenants = await prisma.gbp_locations_list.findMany({
      where: { tenant_id: { not: null } },
      select: { tenant_id: true },
      distinct: ['tenant_id'],
    });

    if (linkedTenants.length === 0) {
      logger.info('[GbpReviewIngestion] No tenants with linked GBP locations — skipping');
      return;
    }

    let totalNewReviews = 0;
    for (const { tenant_id } of linkedTenants) {
      if (!tenant_id) continue;
      try {
        const newCount = await ingestReviewsForTenant(tenant_id);
        totalNewReviews += newCount;
      } catch (error) {
        logger.warn('[GbpReviewIngestion] Ingestion failed for tenant', undefined, {
          tenantId: tenant_id,
          error: (error as Error).message,
        });
      }
      // Small delay between tenants to be respectful to the Google API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    logger.info('[GbpReviewIngestion] Hourly ingestion completed', undefined, {
      tenantsProcessed: linkedTenants.length,
      newReviewsDetected: totalNewReviews,
    });
  } catch (error) {
    logger.error('[GbpReviewIngestion] Hourly ingestion failed:', undefined, {
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
 * Start the scheduled GBP review ingestion job (hourly).
 */
export async function startGbpReviewIngestion(): Promise<void> {
  if (process.env.DISABLE_GBP_REVIEW_INGESTION === 'true') {
    logger.info('[GbpReviewIngestion] Disabled by env var');
    return;
  }

  if (reviewIngestionIntervalId) {
    logger.info('[GbpReviewIngestion] Already running');
    return;
  }

  logger.info('[GbpReviewIngestion] Starting scheduler (hourly)');

  // Delay first run to avoid firing on nodemon restarts
  setTimeout(() => {
    runHourlyIngestion();
  }, STARTUP_DELAY_MS);

  reviewIngestionIntervalId = setInterval(() => {
    runHourlyIngestion();
  }, HOURLY_INTERVAL_MS);
}

/**
 * Stop the scheduled GBP review ingestion job.
 */
export function stopGbpReviewIngestion(): void {
  if (reviewIngestionIntervalId) {
    clearInterval(reviewIngestionIntervalId);
    reviewIngestionIntervalId = null;
    logger.info('[GbpReviewIngestion] Stopped');
  }
}

/**
 * Manually trigger ingestion for a single tenant (used by admin routes / tests).
 */
export async function runIngestionForTenant(tenantId: string): Promise<number> {
  return ingestReviewsForTenant(tenantId);
}
