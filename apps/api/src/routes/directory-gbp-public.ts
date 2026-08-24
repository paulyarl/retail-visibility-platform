/**
 * Directory GBP Public Routes
 *
 * Surface-agnostic public endpoints for GBP content (reviews, posts, photos).
 * All endpoints enforce the canonical two-gate model:
 *   Hard gate: features.gbp_directory_reviews / gbp_directory_content
 *   Soft gate: merchantPreferences.gbp_reviews_display / gbp_content_display
 *
 * If either gate fails, returns { success: true, data: { enabled: false } }
 *
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE4.md Task 5
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §8.2
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { resolveEffectiveCapabilitiesFromMV } from '../services/EffectiveCapabilityResolver';

const router = Router({ mergeParams: true });

/**
 * Resolve a slug or tenant ID to a tenant ID.
 * Mirrors the pattern in public-tenant-capabilities.ts.
 */
async function resolveTenantIdentifier(identifier: string): Promise<{ id: string } | null> {
  // Try ID lookup first
  const byId = await prisma.tenants.findUnique({
    where: { id: identifier },
    select: { id: true },
  });
  if (byId) return byId;

  // Fall back to slug lookup
  const bySlug = await prisma.tenants.findFirst({
    where: { slug: identifier },
    select: { id: true },
  });
  if (bySlug) return bySlug;

  // Final fallback: directory_listings_list.slug
  const dirListing = await prisma.directory_listings_list.findFirst({
    where: { slug: identifier },
    select: { tenant_id: true },
  });
  if (dirListing) {
    return { id: dirListing.tenant_id };
  }

  return null;
}

/**
 * Check both gates for a tenant's GBP directory surfacing.
 * Returns { enabled, reviewsEnabled, contentEnabled }.
 */
async function checkGbpGates(tenantId: string): Promise<{
  enabled: boolean;
  reviewsEnabled: boolean;
  contentEnabled: boolean;
}> {
  try {
    const caps = await resolveEffectiveCapabilitiesFromMV(tenantId);
    if (!caps || !caps.effective?.gbp_management) {
      return { enabled: false, reviewsEnabled: false, contentEnabled: false };
    }
    const gbp = caps.effective.gbp_management;
    return {
      enabled: gbp.enabled,
      reviewsEnabled: gbp.reviews_enabled,
      contentEnabled: gbp.content_enabled,
    };
  } catch (error) {
    logger.warn('[directory-gbp-public] Failed to resolve GBP gates', undefined, {
      tenantId,
      error: (error as Error).message,
    });
    return { enabled: false, reviewsEnabled: false, contentEnabled: false };
  }
}

// GET /:slug/gbp-reviews — public GBP reviews
router.get('/:slug/gbp-reviews', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const tenant = await resolveTenantIdentifier(slug);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    const gates = await checkGbpGates(tenant.id);
    if (!gates.reviewsEnabled) {
      return res.json({ success: true, data: { enabled: false } });
    }

    // Fetch reviews + cached aggregate rating
    const [reviews, location] = await Promise.all([
      prisma.gbp_reviews.findMany({
        where: { tenant_id: tenant.id },
        orderBy: { google_create_time: 'desc' },
        take: 50,
        select: {
          id: true,
          reviewer_name: true,
          star_rating: true,
          comment: true,
          review_reply: true,
          google_create_time: true,
        },
      }),
      prisma.gbp_locations_list.findFirst({
        where: { tenant_id: tenant.id },
        select: {
          cached_average_rating: true,
          cached_review_count: true,
          business_name: true,
        },
      }),
    ]);

    // Public fields only — no sentiment, reply_status, ai_drafts
    res.json({
      success: true,
      data: {
        enabled: true,
        aggregateRating: location?.cached_average_rating ?? null,
        totalReviewCount: location?.cached_review_count ?? reviews.length,
        businessName: location?.business_name ?? null,
        reviews: reviews.map((r) => ({
          id: r.id,
          reviewerName: r.reviewer_name,
          starRating: r.star_rating,
          comment: r.comment,
          reviewReply: r.review_reply,
          createTime: r.google_create_time,
        })),
      },
    });
  } catch (error: any) {
    logger.error('[directory-gbp-public] GET /:slug/gbp-reviews error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// GET /:slug/gbp-posts — public GBP posts
router.get('/:slug/gbp-posts', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const tenant = await resolveTenantIdentifier(slug);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    const gates = await checkGbpGates(tenant.id);
    if (!gates.contentEnabled) {
      return res.json({ success: true, data: { enabled: false } });
    }

    const posts = await prisma.gbp_posts.findMany({
      where: {
        tenant_id: tenant.id,
        status: 'PUBLISHED',
      },
      orderBy: { published_at: 'desc' },
      take: 20,
      select: {
        id: true,
        topic_type: true,
        summary: true,
        media_url: true,
        call_to_action_type: true,
        call_to_action_url: true,
        event_title: true,
        event_start_date: true,
        event_end_date: true,
        offer_coupon_code: true,
        offer_redeem_url: true,
        offer_terms: true,
        google_create_time: true,
        published_at: true,
      },
    });

    // Public fields only — no status, scheduled_for, post_name
    res.json({
      success: true,
      data: {
        enabled: true,
        posts: posts.map((p) => ({
          id: p.id,
          topicType: p.topic_type,
          summary: p.summary,
          mediaUrl: p.media_url,
          callToActionType: p.call_to_action_type,
          callToActionUrl: p.call_to_action_url,
          eventTitle: p.event_title,
          eventStartDate: p.event_start_date,
          eventEndDate: p.event_end_date,
          offerCouponCode: p.offer_coupon_code,
          offerRedeemUrl: p.offer_redeem_url,
          offerTerms: p.offer_terms,
          createTime: p.google_create_time,
          publishedAt: p.published_at,
        })),
      },
    });
  } catch (error: any) {
    logger.error('[directory-gbp-public] GET /:slug/gbp-posts error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// GET /:slug/gbp-photos — public GBP photos
router.get('/:slug/gbp-photos', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const tenant = await resolveTenantIdentifier(slug);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    const gates = await checkGbpGates(tenant.id);
    if (!gates.contentEnabled) {
      return res.json({ success: true, data: { enabled: false } });
    }

    const photos = await prisma.gbp_media.findMany({
      where: {
        tenant_id: tenant.id,
        is_active: true,
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        category: true,
        source_url: true,
        google_url: true,
        description: true,
      },
    });

    // Public fields only — no view_count
    res.json({
      success: true,
      data: {
        enabled: true,
        photos: photos.map((p) => ({
          id: p.id,
          category: p.category,
          sourceUrl: p.source_url,
          googleUrl: p.google_url,
          description: p.description,
        })),
      },
    });
  } catch (error: any) {
    logger.error('[directory-gbp-public] GET /:slug/gbp-photos error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

export default router;
