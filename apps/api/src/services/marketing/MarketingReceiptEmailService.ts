/**
 * MarketingReceiptEmailService — sends receipt emails on marketing ops
 * payment success (G5).
 *
 * Per MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md §6.6.
 *
 * Triggered from pay/confirm after revenue insert. Fire-and-forget with
 * retry — the confirm endpoint returns immediately regardless of email
 * outcome. Idempotency via marketing_revenue.receipt_emailed_at.
 *
 * The receipt email carries the Path B claim CTA for unclaimed payers
 * ("Create your free account to track your order") and a "View in your
 * portal" link for claimed payers.
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import { PLATFORM_SCOPE } from '../../lib/platform-scope';
import { MarketingReceiptPdfService, loadPlatformBranding } from './MarketingReceiptPdfService';
import { unifiedConfig } from '../../config/unifiedConfig';
import type { RequestCtx } from '../../context';

export interface ReceiptEmailInput {
  campaignId: string;
  revenueId?: string;
  /** Override email (e.g., from pay-page email field). Falls back to campaign.email. */
  toEmail?: string;
  ctx?: RequestCtx;
}

export interface ReceiptEmailResult {
  sent: boolean;
  revenueId: string;
  error?: string;
}

/**
 * Send a receipt email for a campaign's payment.
 *
 * - Generates the PDF receipt via MarketingReceiptPdfService (attached).
 * - Idempotency: if marketing_revenue.receipt_emailed_at is set, skips.
 * - On success: sets receipt_emailed_at.
 * - On failure: logs to notification_logs; does not throw.
 */
export async function sendReceiptEmail(input: ReceiptEmailInput): Promise<ReceiptEmailResult> {
  try {
    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id: input.campaignId },
      select: {
        id: true,
        business_name: true,
        email: true,
        customer_id: true,
        service_category: true,
      },
    });

    if (!campaign) {
      return { sent: false, revenueId: input.revenueId || '', error: 'Campaign not found' };
    }

    const toEmail = (input.toEmail || campaign.email || '').trim().toLowerCase();
    if (!toEmail) {
      logger.warn('[MarketingReceiptEmail] No email address to send to', undefined, { campaignId: input.campaignId });
      return { sent: false, revenueId: input.revenueId || '', error: 'No email address' };
    }

    // Load the revenue record (most recent, or specific by ID)
    const revenueRecords = await prisma.marketing_revenue.findMany({
      where: { campaign_id: input.campaignId, ...(input.revenueId ? { id: input.revenueId } : {}) },
      orderBy: { recorded_at: 'desc' },
      take: 1,
    });

    if (revenueRecords.length === 0) {
      return { sent: false, revenueId: input.revenueId || '', error: 'No revenue record found' };
    }

    const revenue = revenueRecords[0];

    // Idempotency: skip if already emailed
    if (revenue.receipt_emailed_at) {
      logger.info('[MarketingReceiptEmail] Receipt already emailed, skipping', undefined, {
        campaignId: input.campaignId,
        revenueId: revenue.id,
        receiptEmailedAt: revenue.receipt_emailed_at,
      });
      return { sent: true, revenueId: revenue.id };
    }

    // Generate the PDF receipt
    const { pdfBuffer, filename } = await MarketingReceiptPdfService.generate({
      campaignId: input.campaignId,
      revenueId: revenue.id,
      ctx: input.ctx,
    });

    const branding = await loadPlatformBranding();
    const isClaimed = !!campaign.customer_id;

    // Build the email
    const { emailService } = await import('../email-service');

    const subject = `Receipt from ${branding.platformName} — ${campaign.business_name || 'Your Campaign'}`;
    const claimUrl = `${unifiedConfig.frontendUrl || unifiedConfig.webUrl}/marketing/claim`;
    const portalUrl = `${unifiedConfig.frontendUrl || unifiedConfig.webUrl}/account/marketing`;
    const receiptUrl = `${unifiedConfig.frontendUrl || unifiedConfig.webUrl}/marketing/pay?ptoken=`;

    const ctaHtml = isClaimed
      ? `<a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:${branding.primaryColor};color:white;text-decoration:none;border-radius:6px;font-weight:600;">View in your portal</a>`
      : `<a href="${claimUrl}" style="display:inline-block;padding:12px 24px;background:${branding.primaryColor};color:white;text-decoration:none;border-radius:6px;font-weight:600;">Create your free account to track your order</a>`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt from ${branding.platformName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 20px; background: white; border-radius: 8px 8px 0 0; }
    .header h1 { color: ${branding.primaryColor}; margin: 0 0 10px; font-size: 24px; }
    .header p { color: #666; margin: 0; }
    .body { padding: 30px 20px; background: white; }
    .body h2 { color: #333; font-size: 18px; margin: 0 0 15px; }
    .details { background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .details p { margin: 5px 0; color: #555; }
    .details strong { color: #333; }
    .cta { text-align: center; margin: 25px 0; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
    .footer a { color: ${branding.primaryColor}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${branding.platformName}</h1>
      <p>Payment Receipt</p>
    </div>
    <div class="body">
      <h2>Thank you for your payment${campaign.business_name ? ', ' + campaign.business_name : ''}!</h2>
      <p>We've received your payment and your receipt is attached to this email as a PDF.</p>
      <div class="details">
        <p><strong>Receipt ID:</strong> ${revenue.id}</p>
        <p><strong>Amount:</strong> $${(revenue.amount_cents / 100).toFixed(2)}</p>
        <p><strong>Payment Date:</strong> ${new Date(revenue.recorded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div class="cta">
        ${ctaHtml}
      </div>
      <p style="color: #666; font-size: 14px;">
        ${isClaimed
          ? 'You can track your campaign progress, download deliverables, and view all your receipts in your portal account.'
          : 'Create a free account to track your order, download deliverables, and check out faster next time. Your purchase is already linked — just sign up with this email.'}
      </p>
    </div>
    <div class="footer">
      <p>${branding.platformName} · ${branding.contactEmail}</p>
      <p>Need help? Reply to this email or contact our support team.</p>
    </div>
  </div>
</body>
</html>`;

    const text = `Receipt from ${branding.platformName}

Thank you for your payment${campaign.business_name ? ', ' + campaign.business_name : ''}!

Receipt ID: ${revenue.id}
Amount: $${(revenue.amount_cents / 100).toFixed(2)}
Payment Date: ${new Date(revenue.recorded_at).toLocaleDateString('en-US')}

Your receipt is attached as a PDF.

${isClaimed
  ? `View in your portal: ${portalUrl}`
  : `Create your free account to track your order: ${claimUrl}`}

---
${branding.platformName} · ${branding.contactEmail}`;

    // Send with PDF attachment
    const result = await (emailService as any).sendEmail({
      to: toEmail,
      subject,
      html,
      text,
      from: branding.contactEmail,
      attachments: [
        {
          filename,
          content: pdfBuffer.toString('base64'),
          encoding: 'base64',
          contentType: 'application/pdf',
        },
      ],
    });

    if (result.success) {
      // Set receipt_emailed_at for idempotency
      await prisma.marketing_revenue.update({
        where: { id: revenue.id },
        data: { receipt_emailed_at: new Date() },
      });

      // Log to notification_logs
      try {
        await prisma.notification_logs.create({
          data: {
            tenant_id: PLATFORM_SCOPE,
            type: 'marketing_receipt',
            sent: true,
            metadata: {
              campaignId: input.campaignId,
              revenueId: revenue.id,
              toEmail,
              isClaimed,
            } as any,
          },
        });
      } catch (logError) {
        logger.error('[MarketingReceiptEmail] Failed to log notification', undefined, { error: (logError as Error).message });
      }

      logger.info('[MarketingReceiptEmail] Receipt email sent', undefined, {
        campaignId: input.campaignId,
        revenueId: revenue.id,
        toEmail,
      });
      return { sent: true, revenueId: revenue.id };
    } else {
      // Log failure to notification_logs
      try {
        await prisma.notification_logs.create({
          data: {
            tenant_id: PLATFORM_SCOPE,
            type: 'marketing_receipt',
            sent: false,
            error_message: String(result.error || 'Email send failed'),
            metadata: {
              campaignId: input.campaignId,
              revenueId: revenue.id,
              toEmail,
            } as any,
          },
        });
      } catch (logError) {
        // swallow
      }

      logger.error('[MarketingReceiptEmail] Email send failed', undefined, {
        campaignId: input.campaignId,
        revenueId: revenue.id,
        error: String(result.error),
      });
      return { sent: false, revenueId: revenue.id, error: String(result.error) };
    }
  } catch (error: any) {
    logger.error('[MarketingReceiptEmail] Unexpected error', undefined, {
      campaignId: input.campaignId,
      error: (error as Error).message,
    });
    return { sent: false, revenueId: input.revenueId || '', error: (error as Error).message };
  }
}

/**
 * Resend a receipt email (operator-initiated, §8.2).
 * Clears receipt_emailed_at first so the idempotency guard doesn't skip it.
 */
export async function resendReceiptEmail(input: ReceiptEmailInput): Promise<ReceiptEmailResult> {
  if (input.revenueId) {
    await prisma.marketing_revenue.update({
      where: { id: input.revenueId },
      data: { receipt_emailed_at: null },
    });
  }
  return sendReceiptEmail(input);
}

/**
 * Send a Path B claim invite email (§6.1, §8.2).
 *
 * Triggered by POST /api/public/marketing/claim/request when an eligible
 * (paid, unclaimed) campaign exists for the email, and by the operator
 * "Send claim invite" action (§8.2). Best-effort: failures are logged but
 * not surfaced to the caller (the request endpoint always returns the same
 * generic success message for enumeration resistance).
 */
export async function sendClaimInviteEmail(email: string, token: string): Promise<{ sent: boolean; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const branding = await loadPlatformBranding();
    const { emailService } = await import('../email-service');

    const baseUrl = unifiedConfig.frontendUrl || unifiedConfig.webUrl;
    const claimUrl = `${baseUrl}/marketing/claim/${token}`;

    const subject = `Claim your ${branding.platformName} account`;
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claim your ${branding.platformName} account</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 20px; background: white; border-radius: 8px 8px 0 0; }
    .header h1 { color: ${branding.primaryColor}; margin: 0 0 10px; font-size: 24px; }
    .header p { color: #666; margin: 0; }
    .body { padding: 30px 20px; background: white; }
    .body h2 { color: #333; font-size: 18px; margin: 0 0 15px; }
    .cta { text-align: center; margin: 25px 0; }
    .cta a { display: inline-block; padding: 12px 24px; background: ${branding.primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
    .footer a { color: ${branding.primaryColor}; }
    .note { color: #999; font-size: 13px; text-align: center; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${branding.platformName}</h1>
      <p>Claim your account</p>
    </div>
    <div class="body">
      <h2>You have purchases waiting for you</h2>
      <p>We found purchases associated with this email address. Create a free account to track your orders, download deliverables, view receipts, and check out faster next time.</p>
      <div class="cta">
        <a href="${claimUrl}">Claim your account</a>
      </div>
      <p class="note">This link expires in 24 hours. If you didn't request this email, you can safely ignore it.</p>
    </div>
    <div class="footer">
      <p>${branding.platformName} · ${branding.contactEmail}</p>
    </div>
  </div>
</body>
</html>`;

    const text = `Claim your ${branding.platformName} account

We found purchases associated with this email address. Create a free account to track your orders, download deliverables, view receipts, and check out faster next time.

Claim your account: ${claimUrl}

This link expires in 24 hours. If you didn't request this email, you can safely ignore it.

---
${branding.platformName} · ${branding.contactEmail}`;

    const result = await (emailService as any).sendEmail({
      to: normalizedEmail,
      subject,
      html,
      text,
      from: branding.contactEmail,
    });

    // Log to notification_logs regardless of outcome
    try {
      await prisma.notification_logs.create({
        data: {
          tenant_id: PLATFORM_SCOPE,
          type: 'marketing_claim_invite',
          sent: !!result.success,
          error_message: result.success ? undefined : String(result.error || 'Email send failed'),
          metadata: { toEmail: normalizedEmail } as any,
        },
      });
    } catch (logError) {
      logger.error('[MarketingReceiptEmail] Claim invite log failed', undefined, { error: (logError as Error).message });
    }

    if (!result.success) {
      logger.error('[MarketingReceiptEmail] Claim invite email failed', undefined, {
        toEmail: normalizedEmail,
        error: String(result.error),
      });
      return { sent: false, error: String(result.error) };
    }

    logger.info('[MarketingReceiptEmail] Claim invite email sent', undefined, { toEmail: normalizedEmail });
    return { sent: true };
  } catch (error: any) {
    logger.error('[MarketingReceiptEmail] Claim invite unexpected error', undefined, {
      email,
      error: (error as Error).message,
    });
    return { sent: false, error: (error as Error).message };
  }
}

export const MarketingReceiptEmailService = {
  send: sendReceiptEmail,
  resend: resendReceiptEmail,
  sendClaimInviteEmail,
};

export default MarketingReceiptEmailService;
