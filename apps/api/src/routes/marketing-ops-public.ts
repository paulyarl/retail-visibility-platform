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

const router = express.Router();

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  gbp_optimization: 'Google Business Profile Optimization',
  review_management: 'Review Management Setup',
  website_audit: 'Website Audit & Report',
  local_seo: 'Local SEO Package',
  social_media_setup: 'Social Media Setup',
  branding_package: 'Branding Package',
  content_creation: 'Content Creation Package',
};

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
    const serviceCategoryLabel = serviceCategory
      ? SERVICE_CATEGORY_LABELS[serviceCategory] || serviceCategory
      : 'Marketing Package';

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
          campaign.tenant_id || campaign.demo_tenant_id || '_platform_',
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

    const serviceCategoryLabel = campaign.service_category
      ? SERVICE_CATEGORY_LABELS[campaign.service_category] || campaign.service_category
      : 'Marketing Package';

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
        campaign.tenant_id || campaign.demo_tenant_id || '_platform_',
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

    const { ptoken, paymentIntentId, couponCode, subscriptionTierId } = parsed.data;
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
    const campaign = await prisma.mkt_campaigns_list.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const revenueRecords = await prisma.marketing_revenue.findMany({
      where: { campaign_id: campaignId },
      orderBy: { recorded_at: 'desc' },
      take: 1,
    });

    if (revenueRecords.length === 0) {
      return res.status(404).json({ success: false, error: 'No payment records found' });
    }

    const revenue = revenueRecords[0];

    const platformSettings = await prisma.platform_settings_list.findFirst();
    const branding = {
      platformName: platformSettings?.platform_name || 'Visible Shelf',
      logoUrl: platformSettings?.logo_url,
      primaryColor: (platformSettings?.theme_colors as any)?.primary || '#0066ff',
      contactEmail: platformSettings?.contact_email || 'billing@visibleshelf.store',
      contactPhone: platformSettings?.contact_phone || '(913) 703-6157',
      contactAddress: platformSettings?.contact_address || '',
      contactWebsite: platformSettings?.contact_website || 'https://visibleshelf.store',
    };

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 20;

    let logoWidth = 0;
    const logoHeight = 15;
    if (branding.logoUrl) {
      try {
        const logoResponse = await fetch(branding.logoUrl);
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer();
          const logoBase64 = Buffer.from(logoBuffer).toString('base64');
          const contentType = logoResponse.headers.get('content-type') || 'image/png';
          const logoDataUri = `data:${contentType};base64,${logoBase64}`;
          const imgProps = doc.getImageProperties(logoDataUri);
          const aspectRatio = imgProps.width / imgProps.height;
          logoWidth = logoHeight * aspectRatio;
          doc.addImage(logoDataUri, 'PNG', margin, yPos - 5, logoWidth, logoHeight);
          yPos += 12;
        }
      } catch {
        // Continue without logo
      }
    }

    doc.setFontSize(24);
    doc.setTextColor(branding.primaryColor);
    const textX = logoWidth > 0 ? margin + logoWidth + 5 : margin;
    doc.text(branding.platformName, textX, yPos);

    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text('PAYMENT RECEIPT', pageWidth - margin - 50, 20, { align: 'left' });

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`#${revenue.id}`, pageWidth - margin - 50, 28, { align: 'left' });

    yPos = 50;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('From:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    doc.text(branding.platformName, margin, yPos);
    yPos += 5;
    if (branding.contactEmail) doc.text(branding.contactEmail, margin, yPos);

    yPos = 50;
    const toX = pageWidth / 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', toX, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    doc.text(campaign.business_name, toX, yPos);

    yPos = Math.max(yPos, 75) + 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    const formatDate = (date: string | Date | null | undefined) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };
    const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const serviceCategoryLabel = revenue.service_category
      ? SERVICE_CATEGORY_LABELS[revenue.service_category] || revenue.service_category
      : 'Marketing Package';

    const infoRows: [string, string][] = [
      ['Receipt ID:', revenue.id],
      ['Campaign ID:', campaign.id],
      ['Business:', campaign.business_name],
      ['Service:', serviceCategoryLabel],
      ['Payment Date:', formatDate(revenue.recorded_at)],
      ['Payment Method:', revenue.gateway_type || 'N/A'],
      ['Transaction ID:', revenue.gateway_transaction_id || 'N/A'],
      ['Source:', revenue.source],
    ];

    for (const [label, value] of infoRows) {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 40, yPos);
      yPos += 6;
    }

    yPos += 10;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Description', margin + 2, yPos + 5);
    doc.text('Amount', pageWidth - margin - 20, yPos + 5, { align: 'right' });
    yPos += 12;

    doc.setFont('helvetica', 'normal');
    doc.text(`${serviceCategoryLabel} — ${campaign.business_name}`, margin + 2, yPos);
    doc.text(formatPrice(revenue.amount_cents), pageWidth - margin - 20, yPos, { align: 'right' });
    yPos += 8;

    if (revenue.discount_cents > 0) {
      yPos += 5;
      doc.text('Discount Applied:', margin + 2, yPos);
      doc.text(`-${formatPrice(revenue.discount_cents)}`, pageWidth - margin - 20, yPos, { align: 'right' });
      yPos += 8;
    }

    yPos += 5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Paid:', margin + 2, yPos);
    doc.text(formatPrice(revenue.amount_cents), pageWidth - margin - 20, yPos, { align: 'right' });

    yPos = doc.internal.pageSize.getHeight() - 30;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Thank you for your business!', margin, yPos);
    yPos += 10;
    if (branding.contactPhone) {
      doc.text(`Phone: ${branding.contactPhone}  |  Email: ${branding.contactEmail}`, margin, yPos);
    } else {
      doc.text(`Email: ${branding.contactEmail}`, margin, yPos);
    }

    const filename = `marketing-receipt-${revenue.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return res.send(pdfBuffer);
  } catch (error) {
    logger.error('[marketing-ops-public] GET /receipt error', undefined, { error: (error as Error).message, campaignId: req.params.campaignId });
    return res.status(500).json({ success: false, error: 'Failed to generate receipt' });
  }
});

export default router;
