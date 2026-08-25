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
import { authenticateToken, requirePlatformAdmin } from '../middleware/auth';
import { prisma } from '../prisma';
import { logger } from '../logger';

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
    ] = await Promise.all([
      prisma.mkt_customer_gbp_links.count(),
      prisma.gbp_locations_list.count({ where: { verification_state: 'VERIFIED' } }),
      prisma.gbp_locations_list.count({ where: { verification_state: { not: 'VERIFIED' } } }),
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
    const [tenants, locations, reviewCounts, postCounts, mediaCounts, merchantSettings] =
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
        postCount: postMap.get(link.tenant_id) || 0,
        mediaCount: mediaMap.get(link.tenant_id) || 0,
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
          ? t.verificationState === 'VERIFIED'
          : t.verificationState !== 'VERIFIED'
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
