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
import { CustomerTokenService } from '../services/CustomerTokenService';
import { CustomerAuthService } from '../services/CustomerAuthService';
import { CustomerGBPAccessService } from '../services/CustomerGBPAccessService';
import { GBPVerificationService } from '../services/GBPVerificationService';

const router = Router();
const customerTokenService = CustomerTokenService.getInstance();
const customerAuthService = CustomerAuthService.getInstance();
const customerGbpAccessService = CustomerGBPAccessService.getInstance();
const gbpVerificationService = GBPVerificationService.getInstance();

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
  data: z.record(z.any()).optional(),
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

// ── Phase 2 stubs (Review Intelligence & Tier A Reply Engine) ──────────────

router.get('/reviews', requireCustomerAuth, requirePlatformContext, notImplemented('List reviews'));
router.post('/reviews/:id/reply', requireCustomerAuth, requirePlatformContext, notImplemented('Reply to review'));
router.post('/reviews/:id/ai-draft', requireCustomerAuth, requirePlatformContext, notImplemented('Generate AI draft'));
router.post('/reviews/:id/dispute', requireCustomerAuth, requirePlatformContext, notImplemented('Dispute review'));

// ── Phase 3 stubs (Post Publisher & Media Manager) ────────────────────────

router.get('/posts', requireCustomerAuth, requirePlatformContext, notImplemented('List posts'));
router.post('/posts', requireCustomerAuth, requirePlatformContext, notImplemented('Create post'));
router.delete('/posts/:id', requireCustomerAuth, requirePlatformContext, notImplemented('Delete post'));
router.get('/media', requireCustomerAuth, requirePlatformContext, notImplemented('List media'));
router.post('/media/upload', requireCustomerAuth, requirePlatformContext, notImplemented('Upload media'));

export default router;
