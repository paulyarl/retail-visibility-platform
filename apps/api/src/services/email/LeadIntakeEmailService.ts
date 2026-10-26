/**
 * Lead Intake Email Service
 *
 * Sends the branded acknowledgement email to a prospect after they submit
 * the public lead-intake form (`POST /api/public/directory/lead-gen`).
 *
 * Fire-and-forget — callers treat the result as advisory; a send failure
 * must never fail the intake request (the lead is already queued).
 */

import { logger } from '../../logger';
import { unifiedConfig } from '../../config/unifiedConfig';

export interface LeadAcknowledgementData {
  /** Recipient email from the intake form. */
  to: string;
  /** Submitter's name — falls back to the business name in the greeting. */
  name?: string | null;
  businessName: string;
}

class LeadIntakeEmailService {
  /**
   * Send the intake acknowledgement. Returns { success } — never throws.
   */
  async sendLeadAcknowledgement(data: LeadAcknowledgementData): Promise<{ success: boolean; error?: string }> {
    try {
      const { emailService } = await import('../email-service');

      const webUrl = unifiedConfig.webUrl.replace(/\/$/, '');
      const directoryUrl = `${webUrl}/directory`;
      const registerUrl = `${webUrl}/customerlogin?mode=register`;
      const greeting = data.name?.trim() || 'there';

      const subject = `We got your message — ${data.businessName}`;

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
    <h1 style="color: #2563eb; margin: 0 0 8px;">Thanks, ${this.escape(greeting)}!</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">We received your message about ${this.escape(data.businessName)}.</p>

    <p style="color: #374151;">A member of the VisibleShelf team will get back to you within one business day. In the meantime, your store may already be listed on our marketplace — we seed local retailers from public info.</p>

    <div style="background: #f9fafb; padding: 16px 20px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin: 0 0 12px; color: #111827; font-size: 15px;">What happens next</h3>
      <ol style="margin: 0; padding-left: 20px; color: #374151;">
        <li><strong>We seed (or find) your listing</strong> — our team verifies your business and prepares a free listing on our marketplace. You'll receive a claim invite by email.</li>
        <li><strong>Claim it free</strong> — one click takes control of your hours, photos, and details. Claiming also activates <strong>5 free product slots</strong> so shoppers can browse your shelf.</li>
        <li><strong>Your dashboard</strong> — after claiming you land in your store's dashboard: add products, manage the listing, and watch your storefront and directory surfaces go live.</li>
      </ol>
    </div>

    <div style="background: #f9fafb; padding: 16px 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #2563eb;">
      <h3 style="margin: 0 0 12px; color: #111827; font-size: 15px;">Two addresses worth knowing once you claim</h3>
      <ul style="margin: 0; padding-left: 20px; color: #374151;">
        <li><strong>Your tenant ID</strong> — your store's account address on the platform: <code>visibleshelf.com/t/&lt;tenant-id&gt;</code>. That's where your dashboard, products, and settings live.</li>
        <li><strong>Your listing slug</strong> — your store's public address shoppers see: <code>visibleshelf.com/directory/&lt;slug&gt;</code>. Claiming also unlocks your storefront — the same store can live on a subdomain and your own domain too.</li>
      </ul>
    </div>

    <p style="margin: 0 0 12px;">
      <a href="${directoryUrl}"
         style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Find your store
      </a>
    </p>
    <p style="margin: 0 0 24px;">
      <a href="${registerUrl}" style="color: #2563eb;">Create a free account to track and claim your listing</a>
    </p>

    <p style="color: #6b7280; font-size: 14px;">Your shelf, made visible.<br>— The VisibleShelf team</p>
  </div>
</body>
</html>`;

      const text = `Thanks, ${greeting}!

We received your message about ${data.businessName}. A member of the VisibleShelf team will get back to you within one business day.

What happens next:
1. We seed (or find) your listing — our team verifies your business and prepares a free listing on our marketplace. You'll receive a claim invite by email.
2. Claim it free — one click takes control of your hours, photos, and details. Claiming also activates 5 free product slots so shoppers can browse your shelf.
3. Your dashboard — after claiming you land in your store's dashboard: add products, manage the listing, and watch your storefront and directory surfaces go live.

Two addresses worth knowing once you claim:
- Tenant ID — your store's account address: visibleshelf.com/t/<tenant-id> (dashboard, products, settings).
- Listing slug — your store's public address: visibleshelf.com/directory/<slug>. Claiming also unlocks your storefront — the same store can live on a subdomain and your own domain.

Find your store: ${directoryUrl}
Create a free account: ${registerUrl}

Your shelf, made visible.
— The VisibleShelf team`;

      const result = await emailService.sendEmail({
        to: data.to,
        from: unifiedConfig.emailSupport,
        fromName: 'Support',
        replyTo: unifiedConfig.emailSupport,
        subject,
        html,
        text,
      });

      if (!result.success) {
        logger.warn('[LeadIntakeEmail] Acknowledgement send failed', undefined, {
          error: result.error,
          to: data.to,
        });
      }
      return { success: result.success, error: result.error };
    } catch (error: any) {
      logger.error('[LeadIntakeEmail] Acknowledgement error:', undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error) },
      });
      return { success: false, error: error?.message || 'send_failed' };
    }
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default new LeadIntakeEmailService();
