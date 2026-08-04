/**
 * Marketing Ops Public Payment Routes (Payment Collection Sprint)
 *
 * Public, token-gated endpoints for Marketing Ops payment collection.
 * No auth required — ptoken is the trust boundary.
 *
 * Routes:
 *   GET  /api/public/marketing/pay           — resolve ptoken → campaign + pricing + service category
 *   POST /api/public/marketing/checkout      — create Stripe PaymentIntent, return client_secret
 *   POST /api/public/marketing/coupons/validate — validate coupon code for discount
 *   POST /api/public/marketing/pay/confirm   — confirm payment, mark campaign paid, upgrade deliverable
 *   POST /api/public/marketing/receipt/:revenueId — download payment receipt PDF
 */

import express from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';
import MarketingCampaignService from '../services/MarketingCampaignService';
import { MarketingDeliverableService } from '../services/MarketingDeliverableService';
import { CouponService } from '../services/CouponService';
import MarketingServiceCategoryService from '../services/MarketingServiceCategoryService';
import { MarketingReceiptPdfService } from '../services/marketing/MarketingReceiptPdfService';
import { MarketingReceiptEmailService } from '../services/marketing/MarketingReceiptEmailService';
import { MarketingCustomerService } from '../services/MarketingCustomerService';
import { CustomerAuthService, CustomerAuthResult } from '../services/CustomerAuthService';
import { CustomerTokenService } from '../services/CustomerTokenService';

const router = express.Router();

const checkoutSchema = z.object({
  ptoken: z.string().min(1, 'ptoken is required'),
  couponCode: z.string().optional(),
});

const couponValidateSchema = z.object({
  ptoken: z.string().min(1, 'ptoken is required'),
  couponCode: z.string().min(1, 'couponCode is required'),
  amountCents: z.number().int().positive(),
});

const payConfirmSchema = z.object({
  ptoken: z.string().min(1, 'ptoken is required'),
  paymentIntentId: z.string().min(1, 'paymentIntentId is required'),
  couponCode: z.string().optional(),
  subscriptionTierId: z.string().optional(),
  email: z.string().email().optional(), // optional email from pay page (§7.1 item 1); falls back to campaign.email
});

async function resolvePreviewToken(ptoken: string) {
  const token = await prisma.mkt_deliverable_preview_tokens.findFirst({
    where: { token: ptoken },
    include: {
      mkt_campaigns_list: true,
    },
  });
  if (!token) {
    return null;
  }
  if (token.expires_at && token.expires_at < new Date()) {
    return null;
  }
  return token;
}

async function resolveSource(token: any): Promise<string> {
  if (token.token_type === 'demo_storefront') return 'demo_storefront';
  return 'qr_deliverable';
}

router.get('/public/marketing/pay', async (req, res) => {
  try {
    const ptoken = req.query.ptoken as string;
    if (!ptoken) {
      return res.status(400).json({ success: false, error: 'ptoken is required' });
    }

    const token = await resolvePreviewToken(ptoken);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Invalid or expired token' });
    }

    const campaign = token.mkt_campaigns_list;
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (!token.viewed_at) {
      await prisma.mkt_deliverable_preview_tokens.update({
        where: { id: token.id },
        data: { viewed_at: new Date() },
      });
    }

    const packagePriceCents = campaign.package_price_cents || 0;
    const serviceCategory = campaign.service_category || null;
    const serviceCategoryLabel = await MarketingServiceCategoryService.getLabel(
      serviceCategory || '',
      req.ctx,
    );

    return res.json({
      success: true,
      data: {
        campaignId: campaign.id,
        businessName: campaign.business_name,
        category: campaign.category,
        city: campaign.city,
        serviceCategory,
        serviceCategoryLabel,
        packagePriceCents,
        subscriptionTierId: campaign.subscription_tier_id || null,
        couponCode: campaign.coupon_code || null,
        tokenType: token.token_type,
        deliverableId: token.deliverable_id || null,
        alreadyPaid: token.paid_at !== null || campaign.stage === 'paid' || campaign.stage === 'delivered',
        email: campaign.email || null, // §7.1 item 1: prefill the pay-page email field
      },
    });
  } catch (error) {
    logger.error('[marketing-ops-public] GET /pay error', undefined, { error: (error as Error).message });
    return res.status(500).json({ success: false, error: 'Failed to resolve pay page' });
  }
});

router.post('/public/marketing/checkout', async (req, res) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const { ptoken, couponCode } = parsed.data;
    const token = await resolvePreviewToken(ptoken);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Invalid or expired token' });
    }

    const campaign = token.mkt_campaigns_list;
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (campaign.stage === 'paid' || campaign.stage === 'delivered') {
      return res.status(400).json({ success: false, error: 'Campaign already paid' });
    }

    let amountCents = campaign.package_price_cents || 0;
    let discountCents = 0;

    if (amountCents <= 0) {
      return res.status(400).json({ success: false, error: 'Package price not set. Please contact us.' });
    }

    if (couponCode) {
      try {
        const couponResult = await CouponService.getInstance().validateCoupon(
          campaign.tenant_id || campaign.demo_tenant_id || 'platform',
          couponCode,
          { subtotalCents: amountCents },
        );
        if (couponResult && couponResult.valid && couponResult.discountCents) {
          discountCents = couponResult.discountCents;
          amountCents = Math.max(0, amountCents - discountCents);
        }
      } catch (couponError) {
        logger.warn('[marketing-ops-public] Coupon validation failed', undefined, {
          couponCode,
          error: (couponError as Error).message,
        });
      }
    }

    const serviceCategoryLabel = await MarketingServiceCategoryService.getLabel(
      campaign.service_category || '',
      req.ctx,
    );

    const billingService = getSubscriptionBillingService();
    const result = await billingService.createOneTimePaymentIntent({
      amountCents,
      description: `${serviceCategoryLabel} — ${campaign.business_name}`,
      campaignId: campaign.id,
      serviceCategory: campaign.service_category || undefined,
      couponCode: couponCode || undefined,
    });

    if ('error' in result) {
      return res.status(400).json({ success: false, error: result.error });
    }

    await prisma.mkt_deliverable_preview_tokens.update({
      where: { id: token.id },
      data: {
        amount_cents: amountCents,
        discount_cents: discountCents,
        coupon_code: couponCode || null,
        subscription_tier_id: campaign.subscription_tier_id || null,
      },
    });

    return res.json({
      success: true,
      data: {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        amountCents,
        discountCents,
        originalPriceCents: campaign.package_price_cents,
      },
    });
  } catch (error) {
    logger.error('[marketing-ops-public] POST /checkout error', undefined, { error: (error as Error).message });
    return res.status(500).json({ success: false, error: 'Failed to create payment intent' });
  }
});

router.post('/public/marketing/coupons/validate', async (req, res) => {
  try {
    const parsed = couponValidateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const { ptoken, couponCode, amountCents } = parsed.data;
    const token = await resolvePreviewToken(ptoken);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Invalid or expired token' });
    }

    const campaign = token.mkt_campaigns_list;
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    try {
      const result = await CouponService.getInstance().validateCoupon(
        campaign.tenant_id || campaign.demo_tenant_id || 'platform',
        couponCode,
        { subtotalCents: amountCents },
      );
      return res.json({ success: true, data: result });
    } catch (couponError) {
      return res.status(400).json({
        success: false,
        error: (couponError as Error).message || 'Invalid coupon code',
      });
    }
  } catch (error) {
    logger.error('[marketing-ops-public] POST /coupons/validate error', undefined, { error: (error as Error).message });
    return res.status(500).json({ success: false, error: 'Failed to validate coupon' });
  }
});

router.post('/public/marketing/pay/confirm', async (req, res) => {
  try {
    const parsed = payConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const { ptoken, paymentIntentId, couponCode, subscriptionTierId, email } = parsed.data;
    const token = await resolvePreviewToken(ptoken);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Invalid or expired token' });
    }

    const campaign = token.mkt_campaigns_list;
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const billingService = getSubscriptionBillingService();
    const piStatus = await billingService.getPaymentIntentStatus(paymentIntentId);
    if ('error' in piStatus) {
      return res.status(400).json({ success: false, error: piStatus.error });
    }

    if (piStatus.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: `Payment not succeeded (status: ${piStatus.status})`,
      });
    }

    const charge = piStatus.charges?.[0];
    const gatewayTransactionId = charge?.id || paymentIntentId;

    const amountCents = token.amount_cents || campaign.package_price_cents || 0;
    const discountCents = token.discount_cents || 0;
    const source = await resolveSource(token);

    const updated = await MarketingCampaignService.markCampaignPaid({
      campaignId: campaign.id,
      amountCents,
      discountCents,
      gatewayType: 'stripe',
      gatewayTransactionId,
      source: source as any,
      couponCode: couponCode || token.coupon_code || undefined,
      subscriptionTierId: subscriptionTierId || token.subscription_tier_id || undefined,
      serviceCategory: campaign.service_category || undefined,
    });

    const deliverableService = MarketingDeliverableService.getInstance();
    await deliverableService.upgradeDeliverableToPaid(campaign.id, token.deliverable_id || undefined);

    await prisma.mkt_deliverable_preview_tokens.update({
      where: { id: token.id },
      data: {
        paid_at: new Date(),
        converted_at: new Date(),
        order_id: paymentIntentId,
      },
    });

    // Fire-and-forget receipt email (§6.6). Failures are logged but never
    // surface to the client. Idempotency via marketing_revenue.receipt_emailed_at.
    void MarketingReceiptEmailService.send({
      campaignId: campaign.id,
      toEmail: email,
      ctx: req.ctx,
    }).catch((e) => {
      logger.error('[marketing-ops-public] Receipt email fire-and-forget failed', undefined, {
        campaignId: campaign.id,
        error: (e as Error).message,
      });
    });

    return res.json({
      success: true,
      data: {
        campaignId: campaign.id,
        stage: updated.stage,
        amountCents,
        gatewayTransactionId,
        receiptUrl: `/api/public/marketing/receipt/${campaign.id}`,
      },
    });
  } catch (error) {
    logger.error('[marketing-ops-public] POST /pay/confirm error', undefined, { error: (error as Error).message });
    return res.status(500).json({ success: false, error: 'Failed to confirm payment' });
  }
});

router.get('/public/marketing/receipt/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { pdfBuffer, filename } = await MarketingReceiptPdfService.generate({
      campaignId,
      ctx: req.ctx,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error: any) {
    const msg = (error as Error).message || 'Failed to generate receipt';
    if (msg.includes('not found') || msg.includes('No payment records')) {
      return res.status(404).json({ success: false, error: msg });
    }
    logger.error('[marketing-ops-public] GET /receipt error', undefined, { error: msg, campaignId: req.params.campaignId });
    return res.status(500).json({ success: false, error: 'Failed to generate receipt' });
  }
});

// ── Claim endpoints (§6.1) ────────────────────────────────────────────────
//
// Path A (ptoken-gated, paid), Path B (email-awareness), and Path B completion.
// All paths funnel through MarketingCustomerService.claimAllEligible(), which
// links every paid, unclaimed campaign matching the verified email (plus the
// ptoken's specific campaign for Path A) to the customer.

const customerAuthService = CustomerAuthService.getInstance();
const customerTokenService = CustomerTokenService.getInstance();

const claimRegisterSchema = z.object({
  ptoken: z.string().min(1, 'ptoken is required'),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  oauthProvider: z.string().optional(),
  oauthId: z.string().optional(),
});

const claimLoginSchema = z.object({
  ptoken: z.string().min(1, 'ptoken is required'),
  email: z.string().email(),
  password: z.string().min(1, 'password is required'),
});

const claimRequestSchema = z.object({
  email: z.string().email(),
});

const claimCompleteSchema = z.object({
  mode: z.enum(['register', 'login']),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  oauthProvider: z.string().optional(),
  oauthId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

/**
 * Path A: POST /api/public/marketing/pay/claim
 *
 * Resolve ptoken → campaign. If email matches an existing verified customer →
 * 409 with `requires_login` (caller should hit /pay/claim/login). Else register
 * (or OAuth-login) the customer, run claimAllEligible with the ptoken's
 * campaign as specificCampaignId, return JWT tokens + claim summary.
 */
router.post('/public/marketing/pay/claim', async (req, res) => {
  try {
    const parsed = claimRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }
    const { ptoken, email, password, firstName, lastName, oauthProvider, oauthId } = parsed.data;

    // ptoken must be paid (§6.1 rule: claims before payment are rejected)
    const token = await resolvePreviewToken(ptoken);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Invalid or expired token' });
    }
    if (!token.paid_at) {
      return res.status(402).json({ success: false, error: 'not_paid', message: 'Pay before claiming your account.' });
    }
    const campaign = token.mkt_campaigns_list;
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    // If email matches an existing VERIFIED customer → require login (Path A
    // only registers new accounts; existing accounts use /pay/claim/login).
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.customers.findUnique({ where: { email: normalizedEmail } });
    if (existing && existing.email_verified) {
      return res.status(409).json({
        success: false,
        error: 'requires_login',
        message: 'An account already exists for this email. Please log in to claim your purchase.',
      });
    }

    // Register or OAuth-login
    let authResult: CustomerAuthResult;
    if (oauthProvider && oauthId) {
      authResult = await customerAuthService.oauthLogin(
        oauthProvider,
        oauthId,
        normalizedEmail,
        firstName,
        lastName,
        req.headers['user-agent'],
        req.ip || (req.headers['x-forwarded-for'] as string),
      );
    } else {
      if (!password) {
        return res.status(400).json({ success: false, error: 'missing_password', message: 'Password is required.' });
      }
      authResult = await customerAuthService.register({
        email: normalizedEmail,
        password,
        firstName,
        lastName,
      });
    }

    if (!authResult.success || !authResult.customer) {
      return res.status(400).json({ success: false, error: 'registration_failed', message: authResult.error });
    }

    const customerId = authResult.customer.id;

    // Run the claim service (Path A: include the ptoken's specific campaign)
    const claimResult = await MarketingCustomerService.claimAllEligible(customerId, normalizedEmail, {
      via: 'A',
      specificCampaignId: campaign.id,
    });

    const tokens = await customerTokenService.generateTokens(customerId, normalizedEmail);

    return res.status(201).json({
      success: true,
      customer: authResult.customer,
      contexts: authResult.contexts,
      tokens,
      claim: claimResult,
    });
  } catch (error: any) {
    if (error?.code === 'already_claimed_by_other') {
      return res.status(409).json({ success: false, error: 'already_claimed', message: error.message });
    }
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[marketing-ops-public] POST /pay/claim error', undefined, { error: msg });
    return res.status(500).json({ success: false, error: 'Failed to claim account' });
  }
});

/**
 * Path A, existing account: POST /api/public/marketing/pay/claim/login
 *
 * Login → claimAllEligible (with the ptoken's campaign as specificCampaignId)
 * → return tokens + claim summary.
 */
router.post('/public/marketing/pay/claim/login', async (req, res) => {
  try {
    const parsed = claimLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }
    const { ptoken, email, password } = parsed.data;

    const token = await resolvePreviewToken(ptoken);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Invalid or expired token' });
    }
    if (!token.paid_at) {
      return res.status(402).json({ success: false, error: 'not_paid', message: 'Pay before claiming your account.' });
    }
    const campaign = token.mkt_campaigns_list;
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const authResult = await customerAuthService.login({
      email: normalizedEmail,
      password,
      deviceInfo: req.headers['user-agent'],
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
    });
    if (!authResult.success || !authResult.customer) {
      return res.status(401).json({ success: false, error: 'login_failed', message: authResult.error });
    }

    const customerId = authResult.customer.id;
    const claimResult = await MarketingCustomerService.claimAllEligible(customerId, normalizedEmail, {
      via: 'A',
      specificCampaignId: campaign.id,
    });

    const tokens = await customerTokenService.generateTokens(customerId, normalizedEmail);

    return res.json({
      success: true,
      customer: authResult.customer,
      contexts: authResult.contexts,
      tokens,
      claim: claimResult,
    });
  } catch (error: any) {
    if (error?.code === 'already_claimed_by_other') {
      return res.status(409).json({ success: false, error: 'already_claimed', message: error.message });
    }
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[marketing-ops-public] POST /pay/claim/login error', undefined, { error: msg });
    return res.status(500).json({ success: false, error: 'Failed to claim account' });
  }
});

/**
 * Path B: POST /api/public/marketing/claim/request
 *
 * If email matches ≥1 paid, unclaimed campaign → issue a claim token and send
 * the claim email. Always returns the same generic success message
 * (enumeration resistance). Rate-limited per email + IP (basic in-process
 * throttle; production should use Redis).
 */
const claimRequestThrottle = new Map<string, number>();
const CLAIM_REQUEST_THROTTLE_MS = 60 * 1000; // 1 minute per (email+ip)

router.post('/public/marketing/claim/request', async (req, res) => {
  try {
    const parsed = claimRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      // Still return generic success to avoid enumeration via validation errors
      return res.json({ success: true, message: 'If we found any purchases for that email, we sent a claim link.' });
    }
    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const ip = (req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown') as string;

    // Throttle: 1 request per email+IP per minute
    const throttleKey = `${normalizedEmail}:${ip}`;
    const last = claimRequestThrottle.get(throttleKey);
    if (last && Date.now() - last < CLAIM_REQUEST_THROTTLE_MS) {
      return res.json({ success: true, message: 'If we found any purchases for that email, we sent a claim link.' });
    }
    claimRequestThrottle.set(throttleKey, Date.now());

    const issued = await MarketingCustomerService.issueClaimToken(normalizedEmail);
    if (issued) {
      // Send the claim email (best-effort; failures logged, not surfaced)
      try {
        await MarketingReceiptEmailService.sendClaimInviteEmail(normalizedEmail, issued.token);
      } catch (e) {
        logger.error('[marketing-ops-public] claim invite email failed', undefined, {
          email: normalizedEmail,
          error: (e as Error).message,
        });
      }
    }

    // Always the same generic message
    return res.json({ success: true, message: 'If we found any purchases for that email, we sent a claim link.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[marketing-ops-public] POST /claim/request error', undefined, { error: msg });
    // Never leak error details — return generic success
    return res.json({ success: true, message: 'If we found any purchases for that email, we sent a claim link.' });
  }
});

/**
 * Path B: GET /api/public/marketing/claim/:token
 *
 * Validate claim token → return masked summary for the claim landing page.
 * Never returns full purchase details pre-auth.
 */
router.get('/public/marketing/claim/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const summary = await MarketingCustomerService.getClaimTokenSummary(token);
    if (!summary) {
      return res.status(404).json({ success: false, error: 'invalid_token', message: 'This claim link is invalid.' });
    }
    return res.json({ success: true, summary });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[marketing-ops-public] GET /claim/:token error', undefined, { error: msg });
    return res.status(500).json({ success: false, error: 'Failed to validate claim link' });
  }
});

/**
 * Path B: POST /api/public/marketing/claim/:token/complete
 *
 * Register or login → claimAllEligible links all eligible campaigns → mark
 * token claimed_at → return JWT tokens + claim summary.
 *
 * Register: email is prefilled & locked to the token's email.
 * Login: must match an existing verified account with the token's email.
 */
router.post('/public/marketing/claim/:token/complete', async (req, res) => {
  try {
    const { token } = req.params;
    const parsed = claimCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }
    const { mode, password, oauthProvider, oauthId, firstName, lastName } = parsed.data;

    // Validate the token first
    const tokenRow = await prisma.mkt_customer_claim_tokens.findUnique({ where: { token } });
    if (!tokenRow) {
      return res.status(404).json({ success: false, error: 'invalid_token', message: 'This claim link is invalid.' });
    }
    if (tokenRow.claimed_at) {
      return res.status(410).json({ success: false, error: 'token_claimed', message: 'This claim link has already been used.' });
    }
    if (tokenRow.expires_at < new Date()) {
      return res.status(410).json({ success: false, error: 'token_expired', message: 'This claim link has expired.' });
    }

    const normalizedEmail = tokenRow.email; // locked to the token's email

    let authResult: CustomerAuthResult;
    if (mode === 'register') {
      if (oauthProvider && oauthId) {
        authResult = await customerAuthService.oauthLogin(
          oauthProvider,
          oauthId,
          normalizedEmail,
          firstName,
          lastName,
          req.headers['user-agent'],
          req.ip || (req.headers['x-forwarded-for'] as string),
        );
      } else {
        if (!password) {
          return res.status(400).json({ success: false, error: 'missing_password', message: 'Password is required.' });
        }
        authResult = await customerAuthService.register({
          email: normalizedEmail,
          password,
          firstName,
          lastName,
        });
      }
    } else {
      // login mode
      if (!password) {
        return res.status(400).json({ success: false, error: 'missing_password', message: 'Password is required.' });
      }
      authResult = await customerAuthService.login({
        email: normalizedEmail,
        password,
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      });
      // Per spec: login must match a verified account with the token's email
      if (authResult.success && authResult.customer && !authResult.customer.emailVerified) {
        return res.status(403).json({
          success: false,
          error: 'email_not_verified',
          message: 'Please verify your email before claiming your purchases.',
        });
      }
    }

    if (!authResult.success || !authResult.customer) {
      return res.status(400).json({ success: false, error: 'auth_failed', message: authResult.error });
    }

    const customerId = authResult.customer.id;

    // Run the claim service (Path B: no specificCampaignId — link all eligible)
    const claimResult = await MarketingCustomerService.claimAllEligible(customerId, normalizedEmail, {
      via: 'B',
    });

    // Mark the token as consumed
    await MarketingCustomerService.consumeClaimToken(token);

    const tokens = await customerTokenService.generateTokens(customerId, normalizedEmail);

    return res.json({
      success: true,
      customer: authResult.customer,
      contexts: authResult.contexts,
      tokens,
      claim: claimResult,
    });
  } catch (error: any) {
    if (error?.code === 'already_claimed_by_other') {
      return res.status(409).json({ success: false, error: 'already_claimed', message: error.message });
    }
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[marketing-ops-public] POST /claim/:token/complete error', undefined, { error: msg });
    return res.status(500).json({ success: false, error: 'Failed to complete claim' });
  }
});

export default router;
