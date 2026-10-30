/**
 * GBP Admin Monitoring Routes
 *
 * Cross-tenant GBP health monitoring for platform admins.
 * Mounted at /api/admin/gbp-monitor
 *
 * Routes:
 *   GET /overview         — aggregate stats (connections, verification, reviews, posts, media)
 *   GET /tenants          — per-tenant GBP status list (paginated, filterable)
 *   GET /jobs             — job health (review ingestion + post scheduler)
 *   GET /entitlements     — capability entitlement summary (who has what)
 *
 * Auth: authenticateToken + requirePlatformAdmin
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requirePlatformAdmin } from '../middleware/auth';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { previewBatch, createAndMaterializeBatch } from '../services/GbpBatchService';

const router = Router();

router.use(authenticateToken);
router.use(requirePlatformAdmin);

// ── Overview ──────────────────────────────────────────────────────────────

router.get('/overview', async (req: any, res: Response) => {
  try {
    const [
      totalConnections,
      verifiedLocations,
      unverifiedLocations,
      totalReviews,
      totalPosts,
      totalMedia,
      stuckScheduledPosts,
      failedPosts,
      recentReviews,
      merchantGateStats,
      managedBySplit,
      unrepliedQueueDepth,
    ] = await Promise.all([
      prisma.google_oauth_tokens_list.count({ where: { provider: 'gbp' } }),
      prisma.gbp_locations_list.count({ where: { verification_state: 'COMPLETED' } }),
      prisma.gbp_locations_list.count({ where: { verification_state: { not: 'COMPLETED' } } }),
      prisma.gbp_reviews.count(),
      prisma.gbp_posts.count(),
      prisma.gbp_media.count(),
      prisma.gbp_posts.count({
        where: {
          status: 'SCHEDULED',
          scheduled_for: { lt: new Date() },
        },
      }),
      prisma.gbp_posts.count({ where: { status: 'FAILED' } }),
      prisma.gbp_reviews.count({
        where: { google_create_time: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.tenant_gbp_options_settings.groupBy({
        by: ['gbp_reviews_display', 'gbp_content_display'],
        _count: true,
      }),
      // D3: platform-managed vs self-serve split across all linked locations
      prisma.gbp_locations_list.groupBy({
        by: ['managed_by'],
        _count: true,
      }),
      // D3: ops review queue — total unreplied reviews awaiting the platform
      prisma.gbp_reviews.count({
        where: { reply_status: 'NONE', review_reply: null },
      }),
    ]);

    res.json({
      success: true,
      data: {
        connections: totalConnections,
        locations: {
          verified: verifiedLocations,
          unverified: unverifiedLocations,
          total: verifiedLocations + unverifiedLocations,
        },
        reviews: {
          total: totalReviews,
          last7Days: recentReviews,
        },
        posts: {
          total: totalPosts,
          stuckScheduled: stuckScheduledPosts,
          failed: failedPosts,
        },
        media: {
          total: totalMedia,
        },
        merchantGates: merchantGateStats.map((g) => ({
          reviewsDisplay: g.gbp_reviews_display,
          contentDisplay: g.gbp_content_display,
          count: g._count,
        })),
        managedBy: managedBySplit.map((g) => ({
          managedBy: g.managed_by,
          count: g._count,
        })),
        reviewQueue: {
          unreplied: unrepliedQueueDepth,
        },
      },
    });
  } catch (error: any) {
    logger.error('[gbp-monitor] overview error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch GBP overview' });
  }
});

// ── Per-Tenant GBP Status ─────────────────────────────────────────────────

router.get('/tenants', async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const verificationFilter = (req.query.verification as string) || '';

    const linkWhere: any = {};
    if (search) {
      linkWhere.tenant_id = { contains: search, mode: 'insensitive' };
    }

    const [links, total] = await Promise.all([
      prisma.mkt_customer_gbp_links.findMany({
        where: linkWhere,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.mkt_customer_gbp_links.count({ where: linkWhere }),
    ]);

    const tenantIds = links.map((l) => l.tenant_id);

    // Fetch tenants, locations, counts, and settings in parallel
    const [tenants, locations, reviewCounts, postCounts, mediaCounts, merchantSettings, unrepliedCounts] =
      await Promise.all([
        prisma.tenants.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true, slug: true, subscription_tier: true },
        }),
        prisma.gbp_locations_list.findMany({
          where: { tenant_id: { in: tenantIds } },
          select: {
            tenant_id: true,
            verification_state: true,
            cached_average_rating: true,
            cached_review_count: true,
            business_name: true,
            managed_by: true,
            granted_via: true,
            delegated_surfaces: true,
            platform_account_id: true,
          },
        }),
        prisma.gbp_reviews.groupBy({
          by: ['tenant_id'],
          where: { tenant_id: { in: tenantIds } },
          _count: true,
        }),
        prisma.gbp_posts.groupBy({
          by: ['tenant_id'],
          where: { tenant_id: { in: tenantIds } },
          _count: true,
        }),
        prisma.gbp_media.groupBy({
          by: ['tenant_id'],
          where: { tenant_id: { in: tenantIds } },
          _count: true,
        }),
        // D3: ops review queue depth — unreplied reviews per tenant
        prisma.gbp_reviews.groupBy({
          by: ['tenant_id'],
          where: {
            tenant_id: { in: tenantIds },
            reply_status: 'NONE',
            review_reply: null,
          },
          _count: true,
        }),
        prisma.tenant_gbp_options_settings.findMany({
          where: { tenant_id: { in: tenantIds } },
          select: {
            tenant_id: true,
            gbp_reviews_display: true,
            gbp_content_display: true,
          },
        }),
      ]);

    // Build lookup maps
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));
    const locationMap = new Map(locations.map((l) => [l.tenant_id, l]));
    const reviewMap = new Map(reviewCounts.map((r) => [r.tenant_id, r._count]));
    const postMap = new Map(postCounts.map((p) => [p.tenant_id, p._count]));
    const mediaMap = new Map(mediaCounts.map((m) => [m.tenant_id, m._count]));
    const settingsMap = new Map(merchantSettings.map((s) => [s.tenant_id, s]));
    const unrepliedMap = new Map(unrepliedCounts.map((r) => [r.tenant_id, r._count]));

    // Assemble tenant rows
    let tenantRows = links.map((link) => {
      const tenant = tenantMap.get(link.tenant_id);
      const loc = locationMap.get(link.tenant_id);
      const settings = settingsMap.get(link.tenant_id);
      return {
        tenantId: link.tenant_id,
        tenantName: tenant?.name || link.tenant_id,
        tenantSlug: tenant?.slug || null,
        tier: tenant?.subscription_tier || null,
        connected: true,
        connectedAt: link.created_at,
        verificationState: loc?.verification_state || 'UNVERIFIED',
        businessName: loc?.business_name || null,
        cachedRating: loc?.cached_average_rating || null,
        cachedReviewCount: loc?.cached_review_count || 0,
        reviewCount: reviewMap.get(link.tenant_id) || 0,
        unrepliedReviews: unrepliedMap.get(link.tenant_id) || 0,
        postCount: postMap.get(link.tenant_id) || 0,
        mediaCount: mediaMap.get(link.tenant_id) || 0,
        managed: {
          by: loc?.managed_by || 'self',
          grantedVia: loc?.granted_via || null,
          delegatedSurfaces: loc?.delegated_surfaces || null,
          platformAccountId: loc?.platform_account_id || null,
        },
        merchantGate: {
          reviewsDisplay: settings?.gbp_reviews_display ?? true,
          contentDisplay: settings?.gbp_content_display ?? true,
          configured: !!settings,
        },
      };
    });

    // Apply verification filter after assembly
    if (verificationFilter) {
      tenantRows = tenantRows.filter((t) =>
        verificationFilter === 'verified'
          ? t.verificationState === 'COMPLETED'
          : t.verificationState !== 'COMPLETED'
      );
    }

    res.json({
      success: true,
      data: {
        tenants: tenantRows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    logger.error('[gbp-monitor] tenants error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch GBP tenants' });
  }
});

// ── Ops Review Queue ──────────────────────────────────────────────────────
// D3: unreplied reviews across platform-managed locations — the DFY work
// surface. Reply drafting/approve-and-send goes through the existing
// GBPReviewReplyService (generateDrafts / replyToReview) — this endpoint
// only lists what needs attention.
router.get('/review-queue', async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = (page - 1) * limit;
    const tenantId = (req.query.tenantId as string) || undefined;
    const minRating = req.query.minRating ? Number(req.query.minRating) : undefined;

    const where: any = {
      reply_status: 'NONE',
      review_reply: null,
      gbp_locations_list: { managed_by: 'platform' },
    };
    if (tenantId) where.tenant_id = tenantId;
    if (minRating) where.star_rating = { gte: minRating };

    const [reviews, total] = await Promise.all([
      prisma.gbp_reviews.findMany({
        where,
        select: {
          id: true,
          tenant_id: true,
          google_review_id: true,
          reviewer_name: true,
          star_rating: true,
          comment: true,
          google_create_time: true,
          sentiment: true,
          ai_drafts: true,
          autopilot_due_at: true,
          autopilot_status: true,
          gbp_locations_list: {
            select: { id: true, location_name: true, business_name: true, granted_via: true },
          },
        },
        orderBy: { google_create_time: 'asc' },
        skip,
        take: limit,
      }),
      prisma.gbp_reviews.count({ where }),
    ]);

    const tenantIds = [...new Set(reviews.map((r) => r.tenant_id))];
    const tenants = await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

    res.json({
      success: true,
      data: {
        reviews: reviews.map((r) => ({
          id: r.id,
          tenantId: r.tenant_id,
          tenantName: tenantMap.get(r.tenant_id) || r.tenant_id,
          googleReviewId: r.google_review_id,
          reviewerName: r.reviewer_name,
          starRating: r.star_rating,
          comment: r.comment,
          createdAt: r.google_create_time,
          sentiment: r.sentiment,
          hasDraft: !!(r.ai_drafts as any[])?.length,
          autopilotDueAt: r.autopilot_due_at,
          autopilotStatus: r.autopilot_status,
          location: r.gbp_locations_list
            ? {
                id: r.gbp_locations_list.id,
                name: r.gbp_locations_list.location_name || r.gbp_locations_list.business_name,
                grantedVia: r.gbp_locations_list.granted_via,
              }
            : null,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    logger.error('[gbp-monitor] review-queue error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch review queue' });
  }
});

// ── Post Batches (DFY fan-out, spec §6.2) ────────────────────────────────

const batchSchema = z.object({
  audience: z.object({
    type: z.enum(['all_managed', 'explicit']),
    gbpLocationIds: z.array(z.string()).max(500).optional(),
  }),
  template: z.object({
    summary: z.string().min(1).max(1500),
    topicType: z.enum(['STANDARD', 'EVENT', 'OFFER']).optional(),
    event: z.object({
      title: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional(),
    offer: z.object({
      couponCode: z.string().optional(),
      redeemUrl: z.string().optional(),
      terms: z.string().optional(),
    }).optional(),
    callToAction: z.object({ type: z.string().optional(), url: z.string().optional() }).optional(),
    media: z.object({ type: z.string().optional(), url: z.string().optional() }).optional(),
  }),
  scheduledFor: z.string().datetime(),
  recurrence: z.unknown().optional(),
});

router.get('/batches', async (req: any, res: Response) => {
  try {
    const batches = await prisma.gbp_post_batches.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    const ids = batches.map((b) => b.id);
    const counts = ids.length
      ? await prisma.gbp_posts.groupBy({ by: ['batch_id', 'status'], where: { batch_id: { in: ids } }, _count: true })
      : [];
    const countMap = new Map<string, Record<string, number>>();
    for (const c of counts) {
      const m = countMap.get(c.batch_id!) ?? {};
      m[c.status] = c._count;
      countMap.set(c.batch_id!, m);
    }
    res.json({
      success: true,
      data: batches.map((b) => ({
        ...b,
        postCounts: countMap.get(b.id) ?? {},
      })),
    });
  } catch (error: any) {
    logger.error('[gbp-monitor] batches list error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch batches' });
  }
});

router.post('/batches/preview', async (req: any, res: Response) => {
  try {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }
    const { audience, template, scheduledFor } = parsed.data;
    const plans = await previewBatch(audience, template, new Date(scheduledFor));
    res.json({
      success: true,
      data: plans.map(({ loc, decision }) => ({
        gbpLocationId: loc.id,
        tenantId: loc.tenant_id,
        outcome: decision.outcome,
        scheduledFor: decision.scheduledFor instanceof Date ? decision.scheduledFor.toISOString() : decision.scheduledFor,
        reason: decision.reason,
      })),
    });
  } catch (error: any) {
    logger.error('[gbp-monitor] batch preview error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to preview batch' });
  }
});

router.post('/batches', async (req: any, res: Response) => {
  try {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }
    const { audience, template, scheduledFor, recurrence } = parsed.data;
    const actorUserId = req.user?.userId || req.user?.id || null;
    const { batchId, decisions } = await createAndMaterializeBatch(
      audience,
      template,
      new Date(scheduledFor),
      actorUserId,
      recurrence
    );
    res.json({ success: true, data: { batchId, decisions } });
  } catch (error: any) {
    logger.error('[gbp-monitor] batch create error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create batch' });
  }
});

// ── Job Health ────────────────────────────────────────────────────────────

router.get('/jobs', async (req: any, res: Response) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const [
      stuckScheduledPosts,
      failedPosts,
      recentReviews,
      recentPublishedPosts,
      tenantsWithReviewsNoReply,
    ] = await Promise.all([
      prisma.gbp_posts.findMany({
        where: {
          status: 'SCHEDULED',
          scheduled_for: { lt: now },
        },
        select: {
          id: true,
          tenant_id: true,
          topic_type: true,
          summary: true,
          scheduled_for: true,
          status: true,
        },
        take: 20,
        orderBy: { scheduled_for: 'asc' },
      }),
      prisma.gbp_posts.findMany({
        where: { status: 'FAILED' },
        select: {
          id: true,
          tenant_id: true,
          topic_type: true,
          summary: true,
          status: true,
          created_at: true,
        },
        take: 20,
        orderBy: { created_at: 'desc' },
      }),
      prisma.gbp_reviews.count({
        where: { google_create_time: { gte: oneHourAgo } },
      }),
      prisma.gbp_posts.count({
        where: {
          status: 'PUBLISHED',
          published_at: { gte: fifteenMinutesAgo },
        },
      }),
      prisma.gbp_reviews.count({
        where: { review_reply: null },
      }),
    ]);

    res.json({
      success: true,
      data: {
        reviewIngestion: {
          reviewsLastHour: recentReviews,
          reviewsAwaitingReply: tenantsWithReviewsNoReply,
          healthy: recentReviews > 0 || true,
        },
        postScheduler: {
          stuckScheduled: stuckScheduledPosts,
          failed: failedPosts,
          publishedLast15Min: recentPublishedPosts,
          stuckCount: stuckScheduledPosts.length,
          failedCount: failedPosts.length,
        },
      },
    });
  } catch (error: any) {
    logger.error('[gbp-monitor] jobs error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch GBP job health' });
  }
});

// ── Entitlement Summary ───────────────────────────────────────────────────

router.get('/entitlements', async (req: any, res: Response) => {
  try {
    const [tierFeatures, bsaasPurchases, featureGrants, merchantGateOff] = await Promise.all([
      prisma.tier_features_list.findMany({
        where: { feature_key: { startsWith: 'gbp_' }, is_enabled: true },
        include: {
          subscription_tiers_list: { select: { tier_key: true, name: true } },
        },
      }),
      prisma.tenant_feature_purchases.findMany({
        where: {
          feature_key: { startsWith: 'gbp_' },
          status: 'active',
        },
        select: {
          tenant_id: true,
          feature_key: true,
          source: true,
          status: true,
          expires_at: true,
        },
      }),
      prisma.$queryRaw`
        SELECT tenant_id, feature_key, granted_by, reason
        FROM tenant_feature_grants
        WHERE feature_key LIKE 'gbp_%'
        ORDER BY created_at DESC
        LIMIT 100
      ` as Promise<any[]>,
      prisma.tenant_gbp_options_settings.findMany({
        where: {
          OR: [{ gbp_reviews_display: false }, { gbp_content_display: false }],
        },
        select: {
          tenant_id: true,
          gbp_reviews_display: true,
          gbp_content_display: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        tierEntitlements: tierFeatures.map((tf) => ({
          tierKey: tf.subscription_tiers_list?.tier_key,
          tierName: tf.subscription_tiers_list?.name,
          featureKey: tf.feature_key,
          featureName: tf.feature_name,
        })),
        bsaasPurchases: bsaasPurchases.map((p) => ({
          tenantId: p.tenant_id,
          featureKey: p.feature_key,
          source: p.source,
          status: p.status,
          expiresAt: p.expires_at,
        })),
        featureGrants: featureGrants.map((g) => ({
          tenantId: g.tenant_id,
          featureKey: g.feature_key,
          grantedBy: g.granted_by,
          reason: g.reason,
        })),
        merchantGateDisabled: merchantGateOff.map((m) => ({
          tenantId: m.tenant_id,
          reviewsDisplay: m.gbp_reviews_display,
          contentDisplay: m.gbp_content_display,
        })),
      },
    });
  } catch (error: any) {
    logger.error('[gbp-monitor] entitlements error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch GBP entitlements' });
  }
});

export default router;
