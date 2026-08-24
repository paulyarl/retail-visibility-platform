/**
 * gbp-customer.ts — customer portal routes for the GBP Management Suite.
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §8.1
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE0.md Task 8
 *
 * Phase 0 scaffold: only /status is implemented. The remaining 11 endpoints
 * are stubbed with 501 not_implemented and will be filled in Phases 1–3.
 *
 * All routes require customer JWT auth and enforce hasPlatformContext (same
 * pattern as marketing-customer.ts). Every handler calls
 * CustomerGBPAccessService.resolveTenant(customerId) first to establish the
 * bridge, then delegates to the appropriate service.
 *
 * Routes (mounted at /api/customer/marketing/gbp):
 *   GET  /status                           — GBP connection + verification status (Phase 0)
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
import { logger } from '../logger';
import { CustomerTokenService } from '../services/CustomerTokenService';
import { CustomerAuthService } from '../services/CustomerAuthService';
import { CustomerGBPAccessService } from '../services/CustomerGBPAccessService';

const router = Router();
const customerTokenService = CustomerTokenService.getInstance();
const customerAuthService = CustomerAuthService.getInstance();
const customerGbpAccessService = CustomerGBPAccessService.getInstance();

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
        phase: 'scaffold',
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

// ── Phase 1 stubs (OAuth & Verification Flow) ─────────────────────────────

router.get('/verification/options', requireCustomerAuth, requirePlatformContext, notImplemented('Verification options'));
router.post('/verification/start', requireCustomerAuth, requirePlatformContext, notImplemented('Start verification'));
router.post('/verification/complete', requireCustomerAuth, requirePlatformContext, notImplemented('Complete verification'));

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
