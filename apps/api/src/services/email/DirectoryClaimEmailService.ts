/**
 * Directory Claim Email Service
 *
 * Sends the welcome/congratulations email to a business owner after they
 * claim a directory presence listing. Triggered by DirectoryClaimService
 * at both claim-completion points (self-serve accept + operator approval).
 *
 * Fire-and-forget — callers treat the result as advisory; a send failure
 * must never roll back a claim.
 */

import { logger } from '../../logger';
import { unifiedConfig } from '../../config/unifiedConfig';

export interface ClaimWelcomeEmailData {
  /** Recipient email (the owner's claim/login email). */
  to: string;
  /** Owner display name — falls back to the business name in the greeting. */
  ownerName?: string | null;
  businessName: string;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  /** Claimed listing slug — the public entry lives at /directory/{slug}. */
  slug?: string | null;
  tenantId: string;
}

export interface ClaimRejectedEmailData {
  /** Recipient email (the claimant's contact email on the request). */
  to: string;
  /** Claimant display name — falls back to a generic greeting. */
  ownerName?: string | null;
  businessName: string;
  city?: string | null;
  state?: string | null;
  /** Claim request ID — included as a support reference. */
  requestId: string;
}

class DirectoryClaimEmailService {
  /**
   * Send the post-claim welcome email. Returns { success } — never throws.
   */
  async sendClaimWelcomeEmail(data: ClaimWelcomeEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const { emailService } = await import('../email-service');

      const webUrl = unifiedConfig.webUrl.replace(/\/$/, '');
      const listingUrl = data.slug ? `${webUrl}/directory/${data.slug}` : `${webUrl}/directory`;
      // Email recipients can't be assumed to hold a platform (Auth0) session —
      // route every /t/{tenantId} link through /auth/login?returnTo= (claim
      // handoff spec). Authenticated owners bounce straight through.
      const withReturnTo = (path: string) =>
        `${webUrl}/auth/login?returnTo=${encodeURIComponent(path)}`;
      const dashboardUrl = withReturnTo(`/t/${data.tenantId}/dashboard`);
      const addProductsUrl = withReturnTo(`/t/${data.tenantId}/items/create`);
      const upgradeUrl = withReturnTo(`/t/${data.tenantId}/settings/subscription/upgrade?src=claim_welcome_email`);

      const greeting = data.ownerName?.trim() || data.businessName;
      const location = [data.city, data.state].filter(Boolean).join(', ');

      const subject = `Congratulations — ${data.businessName} is yours!`;

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
    <h1 style="color: #059669; margin: 0 0 8px;">Congratulations, ${this.escape(greeting)}!</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">Your listing is officially yours.</p>

    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #059669;">
      <h2 style="color: #111827; margin: 0 0 8px; font-size: 18px;">${this.escape(data.businessName)}</h2>
      ${data.category ? `<p style="margin: 0; color: #6b7280;">${this.escape(data.category)}</p>` : ''}
      ${location ? `<p style="margin: 4px 0 0; color: #6b7280;">${this.escape(location)}</p>` : ''}
    </div>

    <p style="color: #374151;">You've successfully claimed your business listing on VisibleShelf. It's now live in the directory and fully under your control — free forever.</p>

    <div style="background: #f9fafb; padding: 16px 20px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin: 0 0 12px; color: #111827; font-size: 15px;">What's included with your claim</h3>
      <ul style="margin: 0; padding-left: 20px; color: #374151;">
        <li>Your public directory listing — live now</li>
        <li>Up to 5 free product slots so shoppers can browse your shelves</li>
        <li>A printable flyer and storefront QR code — free for your first year</li>
        <li>Free market-intel access for your listing</li>
      </ul>
    </div>

    <p style="margin: 0 0 12px;">
      <a href="${dashboardUrl}"
         style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Go to your dashboard
      </a>
    </p>
    <p style="margin: 0 0 24px;">
      <a href="${upgradeUrl}" style="color: #059669;">See upgrade options</a>
      &nbsp;·&nbsp;
      <a href="${addProductsUrl}" style="color: #059669;">Add your first products</a>
      &nbsp;·&nbsp;
      <a href="${listingUrl}" style="color: #059669;">View your live listing</a>
    </p>

    <p style="color: #6b7280; font-size: 14px;">Welcome aboard — we're glad to have you.<br>— The VisibleShelf team</p>
  </div>
</body>
</html>`;

      const text = `Congratulations, ${greeting}!

You've successfully claimed your listing for ${data.businessName}${location ? ` (${location})` : ''} on VisibleShelf. It's now live in the directory and fully under your control — free forever.

What's included with your claim:
- Your public directory listing — live now
- Up to 5 free product slots so shoppers can browse your shelves
- A printable flyer and storefront QR code — free for your first year
- Free market-intel access for your listing

Your dashboard: ${dashboardUrl}
Upgrade your presence: ${upgradeUrl}
Add your first products: ${addProductsUrl}
View your live listing: ${listingUrl}

Welcome aboard — we're glad to have you.
— The VisibleShelf team`;

      const result = await emailService.sendEmail({
        to: data.to,
        from: unifiedConfig.emailReplyTo,
        replyTo: unifiedConfig.emailReplyTo,
        subject,
        html,
        text,
      });

      if (!result.success) {
        logger.warn('[DirectoryClaimEmail] Welcome email send failed', undefined, {
          to: data.to,
          tenantId: data.tenantId,
          error: { name: 'EmailSendError', message: result.error || 'unknown' },
        });
      }

      return { success: result.success, error: result.error };
    } catch (error: any) {
      logger.error('[DirectoryClaimEmail] Error sending claim welcome email', undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack },
      });
      return { success: false, error: error?.message };
    }
  }

  /**
   * Notify a claimant that their operator-reviewed claim was not approved.
   * Previously rejections were silent — the claimant's only signal was the
   * claim link going dead. Never leaks the internal rejection_reason; gives
   * the request ID as a support reference instead.
   */
  async sendClaimRejectedEmail(data: ClaimRejectedEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const { emailService } = await import('../email-service');

      const webUrl = unifiedConfig.webUrl.replace(/\/$/, '');
      const supportUrl = `${webUrl}/support`;

      const greeting = data.ownerName?.trim() || 'there';
      const location = [data.city, data.state].filter(Boolean).join(', ');

      const subject = `Update on your claim for ${data.businessName}`;

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
    <h1 style="color: #111827; margin: 0 0 8px;">Hi ${this.escape(greeting)},</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">An update on your listing claim.</p>

    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #9ca3af;">
      <h2 style="color: #111827; margin: 0 0 8px; font-size: 18px;">${this.escape(data.businessName)}</h2>
      ${location ? `<p style="margin: 0; color: #6b7280;">${this.escape(location)}</p>` : ''}
    </div>

    <p style="color: #374151;">We reviewed your claim request for this listing, but we weren't able to verify that you're the business owner — so the listing stays unclaimed for now.</p>

    <p style="color: #374151;">If you think that's a mistake, or you have more proof of ownership (a business license, a utility bill, or a storefront photo), get in touch and we'll take another look.</p>

    <p style="margin: 24px 0;">
      <a href="${supportUrl}"
         style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Contact support
      </a>
    </p>

    <p style="color: #9ca3af; font-size: 13px;">Reference: ${this.escape(data.requestId)}</p>

    <p style="color: #6b7280; font-size: 14px;">— The VisibleShelf team</p>
  </div>
</body>
</html>`;

      const text = `Hi ${greeting},

We reviewed your claim request for ${data.businessName}${location ? ` (${location})` : ''}, but we weren't able to verify that you're the business owner — so the listing stays unclaimed for now.

If you think that's a mistake, or you have more proof of ownership (a business license, a utility bill, or a storefront photo), get in touch and we'll take another look.

Contact support: ${supportUrl}

Reference: ${data.requestId}

— The VisibleShelf team`;

      const result = await emailService.sendEmail({
        to: data.to,
        from: unifiedConfig.emailReplyTo,
        replyTo: unifiedConfig.emailReplyTo,
        subject,
        html,
        text,
      });

      if (!result.success) {
        logger.warn('[DirectoryClaimEmail] Rejection email send failed', undefined, {
          to: data.to,
          requestId: data.requestId,
          error: { name: 'EmailSendError', message: result.error || 'unknown' },
        });
      }

      return { success: result.success, error: result.error };
    } catch (error: any) {
      logger.error('[DirectoryClaimEmail] Error sending claim rejection email', undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack },
      });
      return { success: false, error: error?.message };
    }
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Singleton instance
let instance: DirectoryClaimEmailService | null = null;

export function getDirectoryClaimEmailService(): DirectoryClaimEmailService {
  if (!instance) {
    instance = new DirectoryClaimEmailService();
  }
  return instance;
}
