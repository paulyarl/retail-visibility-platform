/**
 * gbp-customer.ts — customer portal routes for the GBP Management Suite.
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §8.1
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE0.md Task 8, GBP_SPRINT_PHASE1.md Task 2
 *
 * Phase 0: /status implemented.
 * Phase 1: /verification/options, /verification/start, /verification/complete implemented.
 * Phase 2–3: reviews, posts, media endpoints are stubbed with 501.
 *
 * All routes require customer JWT auth and enforce hasPlatformContext (same
 * pattern as marketing-customer.ts). Every handler calls
 * CustomerGBPAccessService.resolveTenant(customerId) first to establish the
 * bridge, then delegates to the appropriate service.
 *
 * Routes (mounted at /api/customer/marketing/gbp):
 *   GET  /status                           — GBP connection + verification status
 *   GET  /verification/options             — fetch verification channels (Phase 1)
 *   POST /verification/start               — trigger verification (Phase 1)
 *   POST /verification/complete            — submit PIN (Phase 1)
 *   GET  /reviews                          — list reviews (Phase 2)
 *   POST /reviews/:id/reply                — publish owner reply (Phase 2)
 *   POST /reviews/:id/ai-draft             — generate 3 AI drafts (Phase 2)
 *   POST /reviews/:id/dispute              — submit dispute intake (Phase 2)
 *   GET  /posts                            — list posts (Phase 3)
 *   POST /posts                            — create/schedule post (Phase 3)
 *   DELETE /posts/:id                      — delete post (Phase 3)
 *   GET  /media                            — list media (Phase 3)
 *   POST /media/upload                     — upload photo (Phase 3)
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { logger } from '../logger';
import { prisma } from '../prisma';
import { CustomerTokenService } from '../services/CustomerTokenService';
import { CustomerAuthService } from '../services/CustomerAuthService';
import { CustomerGBPAccessService } from '../services/CustomerGBPAccessService';
import { GBPVerificationService } from '../services/GBPVerificationService';
import { GBPReviewReplyService } from '../services/GBPReviewReplyService';
import { DisputeIntakeService } from '../services/DisputeIntakeService';
import { replyToReview, createPost, deletePost, listMedia, uploadPhoto, uploadPhotoBinary } from '../services/GBPAdvancedSync';
import { IntelligenceProfileService } from '../services/intelligence/IntelligenceProfileService';
import { permissionServiceFactory } from '../services/permissions/PermissionServiceFactory';
import { resolveEffectiveCapabilitiesFromMV } from '../services/EffectiveCapabilityResolver';
import { isGBPSyncAllowed, isGMCSyncAllowed } from '../lib/google/capability-gate';
import { unifiedConfig } from '../config/unifiedConfig';

const router = Router();
const customerTokenService = CustomerTokenService.getInstance();
const customerAuthService = CustomerAuthService.getInstance();
const customerGbpAccessService = CustomerGBPAccessService.getInstance();
const gbpVerificationService = GBPVerificationService.getInstance();
const gbpReviewReplyService = GBPReviewReplyService.getInstance();
const disputeIntakeService = DisputeIntakeService.getInstance();
const intelligenceProfileService = IntelligenceProfileService.getInstance();

// Multer config for binary media uploads — memory storage, 10MB limit
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Auth middleware (same pattern as marketing-customer.ts) ───────────────

const getCustomerId = (req: Request): string | null => {
  const token = CustomerTokenService.extractBearerToken(req);
  if (token) {
    const payload = customerTokenService.verifyAccessToken(token);
    if (payload) return payload.customerId;
  }
  if (req.cookies?.customer_session_id) {
    return req.cookies.customer_session_id;
  }
  return null;
};

const requireCustomerAuth = (req: Request, res: Response, next: Function) => {
  const customerId = getCustomerId(req);
  if (!customerId) {
    return res.status(401).json({ success: false, error: 'unauthorized', message: 'Not authenticated' });
  }
  (req as any).customerId = customerId;
  next();
};

const requirePlatformContext = async (req: Request, res: Response, next: Function) => {
  const customerId = (req as any).customerId;
  const contexts = await customerAuthService.computeContexts(customerId);
  if (!contexts.platform) {
    return res.status(403).json({
      success: false,
      error: 'context_required',
      message: 'Marketing portal access requires a linked marketing purchase.',
    });
  }
  next();
};

// ── Helper: 501 stub for Phase 1+ endpoints ───────────────────────────────

const notImplemented = (feature: string) => async (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: 'not_implemented', message: `${feature} is not yet available` });
};

// ── /status (Phase 0 — implemented) ───────────────────────────────────────
//
// Returns GBP connection status, verification state, location metadata, and
// cached aggregate rating. Delegates to CustomerGBPAccessService for bridge
// resolution, then reads gbp_locations_list directly.

router.get('/status', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    // Fetch the linked GBP location for this tenant
    const locations = await customerGbpAccessService.resolveLocations(customerId);
    const location = locations.length > 0 ? locations[0] : null;

    // Resolve gbp_management capability state for upgrade-funnel CTAs.
    // Hard-gate fields (can_use_*) — merchant display toggles must not hide
    // the upgrade CTA. Falls back to null if capability resolution fails.
    let capabilities: {
      canUseAiResponse: boolean;
      canUsePostsScheduler: boolean;
      canShowReviews: boolean;
      canShowContent: boolean;
    } | null = null;
    try {
      const caps = await resolveEffectiveCapabilitiesFromMV(tenantId);
      const gbp = caps?.effective?.gbp_management;
      if (gbp) {
        capabilities = {
          canUseAiResponse: gbp.can_use_ai_response,
          canUsePostsScheduler: gbp.can_use_posts_scheduler,
          canShowReviews: gbp.can_show_reviews,
          canShowContent: gbp.can_show_content,
        };
      }
    } catch (capError) {
      logger.warn('[gbp-customer] GET /status capability resolution failed — continuing without capabilities', undefined, {
        tenantId,
        error: (capError as Error).message,
      });
    }

    // §5.1 upgrade-trigger signals — evaluated from ingested GBP data.
    // Each trigger is suppressed once its corresponding entitlement is active.
    let upgradeTriggers: {
      reviewVelocity: { active: boolean; recentReviewCount: number };
      postExpiration: { active: boolean; expiredPostCount: number };
      posUpsell: { active: boolean };
    } | null = null;
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

      const [recentReviewCount, expiredPostCount, gbpAllowed, gmcAllowed] = await Promise.all([
        // Review velocity: new reviews in the trailing 7 days
        prisma.gbp_reviews.count({
          where: { tenant_id: tenantId, google_create_time: { gte: sevenDaysAgo } },
        }),
        // Post expiration: published posts whose event/offer window ended ≥6 days ago
        prisma.gbp_posts.count({
          where: { tenant_id: tenantId, status: 'PUBLISHED', event_end_date: { lte: sixDaysAgo } },
        }),
        isGBPSyncAllowed(tenantId),
        isGMCSyncAllowed(tenantId),
      ]);

      upgradeTriggers = {
        reviewVelocity: {
          active: recentReviewCount > 5 && !(capabilities?.canUseAiResponse ?? false),
          recentReviewCount,
        },
        postExpiration: {
          active: expiredPostCount > 0 && !(capabilities?.canUsePostsScheduler ?? false),
          expiredPostCount,
        },
        posUpsell: { active: gbpAllowed && !gmcAllowed },
      };
    } catch (triggerError) {
      logger.warn('[gbp-customer] GET /status upgrade-trigger evaluation failed — continuing without triggers', undefined, {
        tenantId,
        error: (triggerError as Error).message,
      });
    }

    res.json({
      success: true,
      data: {
        tenantId,
        connected: location !== null,
        capabilities,
        upgradeTriggers,
        location: location
          ? {
              id: location.id,
              locationName: location.locationName,
              businessName: location.businessName,
              verificationState: location.verificationState,
              cachedAverageRating: location.cachedAverageRating,
              cachedReviewCount: location.cachedReviewCount,
              ratingCacheUpdated: location.ratingCacheUpdated,
              address: location.address,
              phone: location.phone,
              websiteUrl: location.websiteUrl,
              category: location.category,
            }
          : null,
      },
    });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] GET /status error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'status_failed', message: 'Failed to fetch GBP status' });
  }
});

// ── /verification/options (Phase 1 — implemented) ─────────────────────────
//
// Fetches available verification options (SMS, CALL, MAIL, etc.) from Google
// for the customer's linked GBP location.

router.get('/verification/options', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    const result = await gbpVerificationService.fetchOptions(tenantId);

    if (!result.success) {
      return res.status(502).json({ success: false, error: 'verification_options_failed', message: result.error || 'Failed to fetch verification options' });
    }

    res.json({ success: true, data: { options: result.options } });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] GET /verification/options error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'verification_options_failed', message: 'Failed to fetch verification options' });
  }
});

// ── /verification/start (Phase 1 — implemented) ───────────────────────────
//
// Triggers a verification request to Google. Transitions UNVERIFIED → PENDING.

const startVerificationSchema = z.object({
  method: z.string().min(1),
  label: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
});

router.post('/verification/start', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    const parsed = startVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', message: 'Method is required' });
    }

    const result = await gbpVerificationService.start(tenantId, {
      method: parsed.data.method,
      label: parsed.data.label || parsed.data.method,
      data: parsed.data.data,
    });

    if (!result.success) {
      return res.status(502).json({ success: false, error: 'verification_start_failed', message: result.error || 'Failed to start verification' });
    }

    res.json({ success: true, data: { pending: result.pending, verificationId: result.verificationId } });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] POST /verification/start error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'verification_start_failed', message: 'Failed to start verification' });
  }
});

// ── /verification/complete (Phase 1 — implemented) ───────────────────────
//
// Submits PIN code to Google. Transitions PENDING → COMPLETED or FAILED.
// On COMPLETED: fires milestone alert + flips directory_seed → independent.

const completeVerificationSchema = z.object({
  pin: z.string().min(1).max(10),
});

router.post('/verification/complete', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    const parsed = completeVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', message: 'PIN code is required' });
    }

    const result = await gbpVerificationService.complete(tenantId, parsed.data.pin);

    if (!result.success) {
      return res.status(502).json({ success: false, error: 'verification_complete_failed', message: result.error || 'Failed to complete verification' });
    }

    res.json({ success: true, data: { verified: result.verified, message: result.verified ? 'Verification completed' : (result.error || 'PIN verification failed') } });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] POST /verification/complete error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'verification_complete_failed', message: 'Failed to complete verification' });
  }
});

// ── Phase 2 endpoints (Review Intelligence & Tier A Reply Engine) ─────────

// GET /reviews — list reviews from gbp_reviews (paginated, filtered)
// Served from the database (kept fresh by the hourly ingestion cron), not
// a live Google API call.

const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  replyStatus: z.enum(['NONE', 'AI_DRAFTED', 'PUBLISHED', 'FAILED', 'DISPUTED']).optional(),
});

router.get('/reviews', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    const parsed = listReviewsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', message: 'Invalid query parameters' });
    }

    const { page, pageSize, rating, sentiment, replyStatus } = parsed.data;
    const where: any = { tenant_id: tenantId };
    if (rating !== undefined) where.star_rating = rating;
    if (sentiment !== undefined) where.sentiment = sentiment;
    if (replyStatus !== undefined) where.reply_status = replyStatus;

    const [reviews, total] = await Promise.all([
      prisma.gbp_reviews.findMany({
        where,
        orderBy: { google_create_time: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.gbp_reviews.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] GET /reviews error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'reviews_list_failed', message: 'Failed to list reviews' });
  }
});

// POST /reviews/:id/reply — publish owner reply via Google API + update reply_status

const replySchema = z.object({
  comment: z.string().min(1).max(4096),
});

router.post('/reviews/:id/reply', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);
    const reviewId = req.params.id;

    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', message: 'Reply comment is required (1–4096 chars)' });
    }

    // Load review (tenant-scoped — cross-customer isolation)
    const review = await prisma.gbp_reviews.findFirst({
      where: { id: reviewId, tenant_id: tenantId },
    });
    if (!review) {
      return res.status(404).json({ success: false, error: 'review_not_found', message: 'Review not found' });
    }
    if (!review.google_review_id) {
      return res.status(400).json({ success: false, error: 'no_google_id', message: 'Review has no Google review ID — cannot reply' });
    }

    // Publish reply via Google API
    const result = await replyToReview(tenantId, review.google_review_id, parsed.data.comment);
    if (!result.success) {
      return res.status(502).json({ success: false, error: 'reply_failed', message: result.error || 'Failed to publish reply' });
    }

    // Update reply_status → PUBLISHED
    await prisma.gbp_reviews.update({
      where: { id: reviewId },
      data: {
        review_reply: parsed.data.comment,
        is_replied: true,
        reply_status: 'PUBLISHED',
        reply_update_time: new Date(),
        updated_at: new Date(),
      },
    });

    res.json({ success: true, data: { published: true } });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] POST /reviews/:id/reply error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'reply_failed', message: 'Failed to publish reply' });
  }
});

// POST /reviews/:id/ai-draft — generate 3 AI drafts (Tier A)
// Entitlement gate: gbp_ai_response capability (draft-preview mode when unentitled)

router.post('/reviews/:id/ai-draft', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);
    const reviewId = req.params.id;

    const result = await gbpReviewReplyService.generateDrafts(tenantId, reviewId);

    res.json({
      success: true,
      data: {
        drafts: result.drafts,
        previewMode: result.previewMode,
        upgradeCta: result.upgradeCta,
      },
    });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    if (error.message?.includes('not found for tenant')) {
      return res.status(404).json({ success: false, error: 'review_not_found', message: 'Review not found' });
    }
    logger.error('[gbp-customer] POST /reviews/:id/ai-draft error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'ai_draft_failed', message: 'Failed to generate AI drafts' });
  }
});

// POST /reviews/:id/dispute — submit a review dispute via DisputeIntakeService
// Uses the registry-driven intake flow with intake_kind = 'review_dispute'.

const disputeSchema = z.object({
  ownerEmail: z.string().email(),
  ownerPhone: z.string().optional(),
  ownerStatement: z.string().optional(),
  evidencePayload: z.record(z.string(), z.any()),
  attachmentIds: z.array(z.string()).optional(),
});

router.post('/reviews/:id/dispute', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);
    const reviewId = req.params.id;

    const parsed = disputeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', message: 'ownerEmail + evidencePayload are required' });
    }

    // Load review (tenant-scoped — cross-customer isolation)
    const review = await prisma.gbp_reviews.findFirst({
      where: { id: reviewId, tenant_id: tenantId },
    });
    if (!review) {
      return res.status(404).json({ success: false, error: 'review_not_found', message: 'Review not found' });
    }

    // Find the GBP campaign for this tenant to anchor the intake
    const campaign = await prisma.mkt_campaigns_list.findFirst({
      where: {
        tenant_id: tenantId,
        category: { in: ['gbp_optimization', 'review_management'] },
      },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
    if (!campaign) {
      return res.status(400).json({ success: false, error: 'no_campaign', message: 'No GBP campaign found for this tenant' });
    }

    // Generate (or reuse) an intake link with intake_kind = 'review_dispute'
    const intakeLink = await disputeIntakeService.generateIntakeLink(campaign.id, undefined, 'review_dispute');

    // Enrich the evidence payload with review context
    const enrichedPayload = {
      ...parsed.data.evidencePayload,
      review_id: reviewId,
      google_review_id: review.google_review_id,
      reviewer_name: review.reviewer_name,
      star_rating: review.star_rating,
      comment: review.comment,
    };

    // Submit the registry intake
    const submitResult = await disputeIntakeService.submitRegistryIntake({
      token: intakeLink.token,
      ownerEmail: parsed.data.ownerEmail,
      ownerPhone: parsed.data.ownerPhone || null,
      ownerStatement: parsed.data.ownerStatement,
      evidencePayload: enrichedPayload,
      attachmentIds: parsed.data.attachmentIds,
    });

    // Mark the review as disputed
    await prisma.gbp_reviews.update({
      where: { id: reviewId },
      data: { reply_status: 'DISPUTED', updated_at: new Date() },
    });

    res.json({ success: true, data: submitResult });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    if (error.message?.includes('No active intake definition')) {
      return res.status(400).json({ success: false, error: 'no_intake_definition', message: 'Review dispute intake kind is not configured' });
    }
    if (error.message?.includes('Validation failed')) {
      return res.status(400).json({ success: false, error: 'invalid_payload', message: error.message });
    }
    logger.error('[gbp-customer] POST /reviews/:id/dispute error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'dispute_failed', message: 'Failed to submit dispute' });
  }
});

// ── Phase 3 endpoints (Post Publisher & Media Manager) ───────────────────

// GET /posts — list posts from gbp_posts (paginated, filtered by status/type)

const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PUBLISHED', 'SCHEDULED', 'FAILED']).optional(),
  topicType: z.enum(['STANDARD', 'EVENT', 'OFFER']).optional(),
});

router.get('/posts', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    const parsed = listPostsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', message: 'Invalid query parameters' });
    }

    const { page, pageSize, status, topicType } = parsed.data;
    const where: any = { tenant_id: tenantId };
    if (status !== undefined) where.status = status;
    if (topicType !== undefined) where.topic_type = topicType;

    const [posts, total] = await Promise.all([
      prisma.gbp_posts.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.gbp_posts.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        posts,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] GET /posts error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'posts_list_failed', message: 'Failed to list posts' });
  }
});

// POST /posts — create post (immediate publish OR schedule for later)

const createPostSchema = z.object({
  summary: z.string().min(1).max(1000),
  topicType: z.enum(['STANDARD', 'EVENT', 'OFFER']).default('STANDARD'),
  callToActionType: z.enum(['BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL']).optional(),
  callToActionUrl: z.string().url().optional(),
  mediaUrl: z.string().url().optional(),
  eventTitle: z.string().max(255).optional(),
  eventStartDate: z.string().datetime().optional(),
  eventEndDate: z.string().datetime().optional(),
  offerCouponCode: z.string().max(100).optional(),
  offerRedeemUrl: z.string().url().optional(),
  offerTerms: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
});

router.post('/posts', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', message: 'Invalid post payload', details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // If scheduledFor is present, check gbp_posts_scheduler entitlement
    if (data.scheduledFor) {
      const entitled = await permissionServiceFactory.hasFeature(tenantId, 'gbp_posts_scheduler');
      if (!entitled) {
        return res.status(403).json({ success: false, error: 'scheduling_not_entitled', message: 'Post scheduling requires the GBP Posts Scheduler capability' });
      }

      // Insert as SCHEDULED — cron will pick it up
      const post = await prisma.gbp_posts.create({
        data: {
          id: postId,
          tenant_id: tenantId,
          summary: data.summary,
          topic_type: data.topicType,
          call_to_action_type: data.callToActionType || null,
          call_to_action_url: data.callToActionUrl || null,
          media_url: data.mediaUrl || null,
          event_title: data.eventTitle || null,
          event_start_date: data.eventStartDate ? new Date(data.eventStartDate) : null,
          event_end_date: data.eventEndDate ? new Date(data.eventEndDate) : null,
          offer_coupon_code: data.offerCouponCode || null,
          offer_redeem_url: data.offerRedeemUrl || null,
          offer_terms: data.offerTerms || null,
          status: 'SCHEDULED',
          scheduled_for: new Date(data.scheduledFor),
        },
      });

      return res.json({ success: true, data: { post, scheduled: true } });
    }

    // Immediate publish via Google API
    const gbpPost = {
      summary: data.summary,
      topicType: data.topicType,
      ...(data.callToActionType && data.callToActionUrl
        ? { callToAction: { actionType: data.callToActionType, url: data.callToActionUrl } }
        : {}),
      ...(data.mediaUrl ? { media: [{ sourceUrl: data.mediaUrl, mediaFormat: 'PHOTO' as const }] } : {}),
      ...(data.eventTitle && data.eventStartDate && data.eventEndDate
        ? {
            event: {
              title: data.eventTitle,
              schedule: {
                startDate: { year: new Date(data.eventStartDate).getFullYear(), month: new Date(data.eventStartDate).getMonth() + 1, day: new Date(data.eventStartDate).getDate() },
                endDate: { year: new Date(data.eventEndDate).getFullYear(), month: new Date(data.eventEndDate).getMonth() + 1, day: new Date(data.eventEndDate).getDate() },
              },
            },
          }
        : {}),
      ...(data.offerCouponCode || data.offerRedeemUrl
        ? { offer: { couponCode: data.offerCouponCode, redeemOnlineUrl: data.offerRedeemUrl, termsConditions: data.offerTerms } }
        : {}),
    };

    const result = await createPost(tenantId, gbpPost);
    if (!result.success) {
      return res.status(502).json({ success: false, error: 'publish_failed', message: result.error || 'Failed to publish post' });
    }

    // Store in gbp_posts with PUBLISHED status
    const post = await prisma.gbp_posts.create({
      data: {
        id: postId,
        tenant_id: tenantId,
        summary: data.summary,
        topic_type: data.topicType,
        call_to_action_type: data.callToActionType || null,
        call_to_action_url: data.callToActionUrl || null,
        media_url: data.mediaUrl || null,
        event_title: data.eventTitle || null,
        event_start_date: data.eventStartDate ? new Date(data.eventStartDate) : null,
        event_end_date: data.eventEndDate ? new Date(data.eventEndDate) : null,
        offer_coupon_code: data.offerCouponCode || null,
        offer_redeem_url: data.offerRedeemUrl || null,
        offer_terms: data.offerTerms || null,
        status: 'PUBLISHED',
        published_at: new Date(),
        post_name: result.postId || null,
        google_post_id: result.postId || null,
      },
    });

    res.json({ success: true, data: { post, scheduled: false } });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] POST /posts error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'post_create_failed', message: 'Failed to create post' });
  }
});

// DELETE /posts/:id — delete post from Google + database

router.delete('/posts/:id', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);
    const postId = req.params.id;

    const post = await prisma.gbp_posts.findFirst({
      where: { id: postId, tenant_id: tenantId },
    });
    if (!post) {
      return res.status(404).json({ success: false, error: 'post_not_found', message: 'Post not found' });
    }

    // If published to Google, delete from Google first
    if (post.status === 'PUBLISHED' && post.post_name) {
      const result = await deletePost(tenantId, post.post_name);
      if (!result.success) {
        logger.warn('[gbp-customer] Google deletePost failed — proceeding with DB delete', undefined, { error: result.error });
      }
    }

    await prisma.gbp_posts.delete({ where: { id: postId } });

    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] DELETE /posts/:id error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'post_delete_failed', message: 'Failed to delete post' });
  }
});

// GET /media — list media from Google + Gold Standard benchmark

router.get('/media', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    // Fetch media from Google
    const mediaResult = await listMedia(tenantId);

    // Fetch Gold Standard benchmark for the tenant's category
    let benchmark: { expectedPhotoCount: number | null; currentPhotoCount: number } | null = null;
    try {
      const location = await prisma.gbp_locations_list.findFirst({
        where: { tenant_id: tenantId },
        select: { category: true },
      });
      if (location?.category) {
        const goldStandard = await intelligenceProfileService.resolveGoldStandard(location.category, 'google');
        if (goldStandard) {
          const config = goldStandard.configuration_json as any;
          const expectedPhotoCount = config?.expected_fields?.platforms?.google?.expected_photo_count
            ?? config?.expected_fields?.platforms?.google?.branding_expectations?.photo_count
            ?? null;
          benchmark = {
            expectedPhotoCount,
            currentPhotoCount: mediaResult.media?.length || 0,
          };
        }
      }
    } catch (benchmarkError) {
      logger.warn('[gbp-customer] Gold Standard benchmark lookup failed — continuing without benchmark', undefined, {
        error: (benchmarkError as Error).message,
      });
    }

    res.json({
      success: true,
      data: {
        media: mediaResult.media || [],
        benchmark,
      },
    });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] GET /media error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'media_list_failed', message: 'Failed to list media' });
  }
});

// POST /media/upload — upload photo (sourceUrl OR binary)

const uploadMediaSchema = z.object({
  sourceUrl: z.string().url().optional(),
  category: z.enum(['COVER', 'PROFILE', 'LOGO', 'EXTERIOR', 'INTERIOR', 'PRODUCT', 'AT_WORK', 'FOOD_AND_DRINK', 'MENU', 'COMMON_AREA', 'ROOMS', 'TEAMS', 'ADDITIONAL']).default('ADDITIONAL'),
  description: z.string().max(500).optional(),
});

router.post('/media/upload', requireCustomerAuth, requirePlatformContext, mediaUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    // Check if this is a multipart upload (binary) or JSON (sourceUrl)
    const isMultipart = req.headers['content-type']?.startsWith('multipart/form-data');

    if (isMultipart && (req as any).file) {
      // Binary upload path
      const file = (req as any).file;
      const result = await uploadPhotoBinary(
        tenantId,
        file.buffer,
        file.mimetype,
        (req.body?.category as any) || 'ADDITIONAL',
        req.body?.description,
      );

      if (!result.success) {
        return res.status(502).json({ success: false, error: 'upload_failed', message: result.error || 'Failed to upload photo' });
      }

      // Store in gbp_media
      const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await prisma.gbp_media.create({
        data: {
          id: mediaId,
          tenant_id: tenantId,
          google_media_id: result.mediaItemId || null,
          media_format: 'photo',
          category: (req.body?.category as string) || 'additional',
          description: req.body?.description || null,
          is_active: true,
        },
      });

      return res.json({ success: true, data: { mediaItemId: result.mediaItemId, mediaId } });
    }

    // JSON path (sourceUrl)
    const parsed = uploadMediaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', message: 'sourceUrl is required for URL-based upload', details: parsed.error.flatten() });
    }

    const data = parsed.data;
    if (!data.sourceUrl) {
      return res.status(400).json({ success: false, error: 'invalid_request', message: 'Either sourceUrl (JSON) or a file (multipart) is required' });
    }

    const result = await uploadPhoto(tenantId, data.sourceUrl, data.category as any, data.description);

    if (!result.success) {
      return res.status(502).json({ success: false, error: 'upload_failed', message: result.error || 'Failed to upload photo' });
    }

    // Store in gbp_media
    const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await prisma.gbp_media.create({
      data: {
        id: mediaId,
        tenant_id: tenantId,
        google_media_id: result.mediaItemId || null,
        media_format: 'photo',
        category: data.category.toLowerCase(),
        source_url: data.sourceUrl,
        description: data.description || null,
        is_active: true,
      },
    });

    res.json({ success: true, data: { mediaItemId: result.mediaItemId, mediaId } });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] POST /media/upload error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'upload_failed', message: 'Failed to upload media' });
  }
});

// ── Diagnostic Gallery → GBP media handoff (§4 Subsystem 4) ─────────────
//
// Deliverable images from the Diagnostic Gallery (/g/{shortCode}) can be
// published directly to live GBP media with one click. Gallery assets are
// mkt_files_list rows (file_type = 'diagnostic_screenshot') on the tenant's
// GBP-scoped campaign; signed URLs (5-min TTL) are sufficient because
// Google's sourceUrl fetch happens immediately.

async function getGalleryAssetsForTenant(tenantId: string) {
  const campaign = await prisma.mkt_campaigns_list.findFirst({
    where: {
      tenant_id: tenantId,
      category: { in: ['gbp_optimization', 'review_management'] },
    },
    orderBy: { created_at: 'desc' },
    select: { id: true },
  });
  if (!campaign) return [];

  const files = await prisma.mkt_files_list.findMany({
    where: { campaign_id: campaign.id, file_type: 'diagnostic_screenshot' },
    orderBy: { uploaded_at: 'asc' },
    select: { id: true, file_name: true, storage_path: true, mime_type: true, uploaded_at: true },
  });

  const { createClient } = await import('@supabase/supabase-js');
  const { StorageBuckets } = await import('../storage-config');
  const supabaseUrl = unifiedConfig.supabaseUrl;
  const supabaseKey = unifiedConfig.supabaseServiceRoleKey;

  return Promise.all(
    files.map(async (f) => {
      let signedUrl: string | null = null;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase.storage
          .from(StorageBuckets.DISPUTES.name)
          .createSignedUrl(f.storage_path, 300);
        if (!error && data) signedUrl = data.signedUrl;
      }
      return {
        id: f.id,
        fileName: f.file_name,
        signedUrl,
        mimeType: f.mime_type,
        uploadedAt: f.uploaded_at,
      };
    }),
  );
}

// GET /media/gallery-assets — list publishable diagnostic gallery images

router.get('/media/gallery-assets', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    const assets = await getGalleryAssetsForTenant(tenantId);
    res.json({ success: true, data: { assets } });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] GET /media/gallery-assets error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'gallery_assets_failed', message: 'Failed to load gallery assets' });
  }
});

// POST /media/from-gallery — publish a gallery deliverable image to GBP media

const fromGallerySchema = z.object({
  fileId: z.string().min(1),
  category: z.enum(['COVER', 'PROFILE', 'LOGO', 'EXTERIOR', 'INTERIOR', 'PRODUCT', 'AT_WORK', 'FOOD_AND_DRINK', 'MENU', 'COMMON_AREA', 'ROOMS', 'TEAMS', 'ADDITIONAL']).default('ADDITIONAL'),
  description: z.string().max(500).optional(),
});

router.post('/media/from-gallery', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId as string;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);

    const parsed = fromGallerySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_request', message: 'fileId is required' });
    }

    // Verify the file belongs to a campaign owned by the resolved tenant
    // (cross-customer isolation — foreign file IDs return 404)
    const file = await prisma.mkt_files_list.findFirst({
      where: { id: parsed.data.fileId, file_type: 'diagnostic_screenshot' },
      select: { id: true, file_name: true, storage_path: true, mkt_campaigns_list: { select: { tenant_id: true } } },
    });
    if (!file || file.mkt_campaigns_list?.tenant_id !== tenantId) {
      return res.status(404).json({ success: false, error: 'asset_not_found', message: 'Gallery asset not found' });
    }

    // Fresh signed URL for Google's sourceUrl fetch
    const { createClient } = await import('@supabase/supabase-js');
    const { StorageBuckets } = await import('../storage-config');
    const supabase = createClient(unifiedConfig.supabaseUrl!, unifiedConfig.supabaseServiceRoleKey!);
    const { data: signed, error: signError } = await supabase.storage
      .from(StorageBuckets.DISPUTES.name)
      .createSignedUrl(file.storage_path, 300);
    if (signError || !signed) {
      return res.status(502).json({ success: false, error: 'sign_failed', message: 'Failed to generate asset URL' });
    }

    const result = await uploadPhoto(tenantId, signed.signedUrl, parsed.data.category as any, parsed.data.description);
    if (!result.success) {
      return res.status(502).json({ success: false, error: 'upload_failed', message: result.error || 'Failed to publish to GBP' });
    }

    const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await prisma.gbp_media.create({
      data: {
        id: mediaId,
        tenant_id: tenantId,
        google_media_id: result.mediaItemId || null,
        media_format: 'photo',
        category: parsed.data.category.toLowerCase(),
        source_url: signed.signedUrl,
        description: parsed.data.description || file.file_name || null,
        is_active: true,
      },
    });

    res.json({ success: true, data: { mediaItemId: result.mediaItemId, mediaId } });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link', message: 'No GBP connection found for this customer' });
    }
    logger.error('[gbp-customer] POST /media/from-gallery error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'from_gallery_failed', message: 'Failed to publish gallery asset' });
  }
});

export default router;
