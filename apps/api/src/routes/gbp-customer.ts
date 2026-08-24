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
import { logger } from '../logger';
import { prisma } from '../prisma';
import { CustomerTokenService } from '../services/CustomerTokenService';
import { CustomerAuthService } from '../services/CustomerAuthService';
import { CustomerGBPAccessService } from '../services/CustomerGBPAccessService';
import { GBPVerificationService } from '../services/GBPVerificationService';
import { GBPReviewReplyService } from '../services/GBPReviewReplyService';
import { DisputeIntakeService } from '../services/DisputeIntakeService';
import { replyToReview } from '../services/GBPAdvancedSync';

const router = Router();
const customerTokenService = CustomerTokenService.getInstance();
const customerAuthService = CustomerAuthService.getInstance();
const customerGbpAccessService = CustomerGBPAccessService.getInstance();
const gbpVerificationService = GBPVerificationService.getInstance();
const gbpReviewReplyService = GBPReviewReplyService.getInstance();
const disputeIntakeService = DisputeIntakeService.getInstance();

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

    res.json({
      success: true,
      data: {
        tenantId,
        connected: location !== null,
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

// ── Phase 3 stubs (Post Publisher & Media Manager) ────────────────────────

router.get('/posts', requireCustomerAuth, requirePlatformContext, notImplemented('List posts'));
router.post('/posts', requireCustomerAuth, requirePlatformContext, notImplemented('Create post'));
router.delete('/posts/:id', requireCustomerAuth, requirePlatformContext, notImplemented('Delete post'));
router.get('/media', requireCustomerAuth, requirePlatformContext, notImplemented('List media'));
router.post('/media/upload', requireCustomerAuth, requirePlatformContext, notImplemented('Upload media'));

export default router;
