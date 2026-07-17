/**
 * Digital Download Email Service
 * Sends email notifications with download links for digital products
 */

import { prisma } from '../../prisma';
import { emailService } from '../email-service';
import { getOrderNotificationService } from '../OrderNotificationService';
import { logger } from '../../logger';

interface DownloadEmailData {
  customerEmail: string;
  customerName: string;
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  downloads: Array<{
    productName: string;
    downloadUrl: string;
    accessDurationDays: number | null;
    downloadLimit: number | null;
    downloadsRemaining: number | null;
    fileSize?: number;
    expiresAt?: Date | null;
  }>;
}

export class DigitalDownloadEmailService {
  /**
   * Send digital download receipt email
   */
  async sendDownloadReceipt(data: DownloadEmailData): Promise<void> {
    console.log('[DigitalDownloadEmail] Sending download receipt to:', data.customerEmail);

    const emailHtml = this.generateDownloadReceiptHtml(data);
    const emailText = this.generateDownloadReceiptText(data);

    const subject = 'Your Digital Download is Ready! 🎉';

    try {
      const result = await emailService.sendEmail({
        to: data.customerEmail,
        subject,
        html: emailHtml,
        text: emailText,
      });

      if (result.success) {
        console.log('[DigitalDownloadEmail] Email sent successfully to:', data.customerEmail);

        // Log to notification_logs for audit trail and CRM tracking
        try {
          // Find the order to get tenantId
          const order = await prisma.orders.findUnique({
            where: { id: data.orderId },
            select: { tenant_id: true },
          });
          if (order) {
            await getOrderNotificationService().notifyDigitalDelivered({
              tenantId: order.tenant_id,
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              customerEmail: data.customerEmail,
              customerName: data.customerName,
              amount: data.orderTotal,
              downloadLinks: data.downloads.map(d => ({
                productName: d.productName,
                url: d.downloadUrl,
                expiresAt: d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : undefined,
              })),
            });
          }
        } catch (logError) {
          logger.error('[DigitalDownloadEmail] Failed to log notification:', undefined, { error: { name: (logError as any)?.name || 'Error', message: (logError as any)?.message || String(logError), stack: (logError as any)?.stack } });
        }
      } else {
        logger.error('[DigitalDownloadEmail] Failed to send email:', undefined, { error: { name: 'Error', message: result.error } });
      }
    } catch (error) {
      logger.error('[DigitalDownloadEmail] Error sending email:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('\n' + '='.repeat(80));
      console.log('DIGITAL DOWNLOAD EMAIL');
      console.log('='.repeat(80));
      console.log('To:', data.customerEmail);
      console.log('Subject:', subject);
      console.log('\n' + emailText);
      console.log('='.repeat(80) + '\n');
    }
  }

  /**
   * Generate HTML email template
   */
  private generateDownloadReceiptHtml(data: DownloadEmailData): string {
    const downloadItems = data.downloads.map(download => {
      const expiryText = download.expiresAt 
        ? `Access expires: ${this.formatDate(download.expiresAt)}`
        : 'Access: Lifetime';
      
      const downloadsText = download.downloadLimit
        ? `Downloads remaining: ${download.downloadsRemaining}`
        : 'Downloads: Unlimited';

      const fileSizeText = download.fileSize
        ? `File size: ${this.formatFileSize(download.fileSize)}`
        : '';

      return `
        <tr>
          <td style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 18px;">
              💾 ${download.productName}
            </h3>
            <a href="${download.downloadUrl}" 
               style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 12px 0;">
              📥 Download Now
            </a>
            <div style="margin-top: 12px; color: #6b7280; font-size: 14px;">
              <div>• ${expiryText}</div>
              <div>• ${downloadsText}</div>
              ${fileSizeText ? `<div>• ${fileSizeText}</div>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Digital Download is Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #111827; font-size: 28px;">
                Your Digital Download is Ready! 🎉
              </h1>
              <p style="margin: 12px 0 0 0; color: #6b7280; font-size: 16px;">
                Thank you for your purchase, ${data.customerName}!
              </p>
            </td>
          </tr>

          <!-- Order Info -->
          <tr>
            <td style="padding: 20px 40px;">
              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Order #${data.orderNumber}</div>
                <div style="color: #111827; font-size: 18px; font-weight: 600;">$${(data.orderTotal / 100).toFixed(2)}</div>
              </div>
            </td>
          </tr>

          <!-- Download Items -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">Digital Products:</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${downloadItems}
              </table>
            </td>
          </tr>

          <!-- Instructions -->
          <tr>
            <td style="padding: 20px 40px; background: #eff6ff; border-radius: 8px; margin: 20px 40px;">
              <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px;">💡 Download Instructions</h3>
              <ol style="margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 14px; line-height: 1.6;">
                <li>Click the "Download Now" button above</li>
                <li>Files will download directly to your device</li>
                <li>Save files to a secure location</li>
              </ol>
              <p style="margin: 12px 0 0 0; color: #1e3a8a; font-size: 14px;">
                🔒 Your download links are unique and secure. Do not share them with others.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0;">Need help? Reply to this email or contact support.</p>
              <p style="margin: 0;">
                <a href="${process.env.FRONTEND_URL}/orders/${data.orderId}" style="color: #2563eb; text-decoration: none;">
                  View Order Details
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text email
   */
  private generateDownloadReceiptText(data: DownloadEmailData): string {
    const downloadItems = data.downloads.map(download => {
      const expiryText = download.expiresAt 
        ? `Access expires: ${this.formatDate(download.expiresAt)}`
        : 'Access: Lifetime';
      
      const downloadsText = download.downloadLimit
        ? `Downloads remaining: ${download.downloadsRemaining}`
        : 'Downloads: Unlimited';

      return `
💾 ${download.productName}
   Download: ${download.downloadUrl}
   • ${expiryText}
   • ${downloadsText}
      `.trim();
    }).join('\n\n');

    return `
Your Digital Download is Ready! 🎉

Hi ${data.customerName},

Thank you for your purchase! Your digital content is ready to download.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 ORDER #${data.orderNumber}

${downloadItems}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Download Instructions:
1. Click the download link above
2. Files will download directly to your device
3. Save files to a secure location

🔒 Your download links are unique and secure.
   Do not share them with others.

Need help? Reply to this email or contact support.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Order Total: $${(data.orderTotal / 100).toFixed(2)}
Order Date: ${this.formatDate(new Date())}

View Order Details: ${process.env.FRONTEND_URL}/orders/${data.orderId}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thanks for your business!
    `.trim();
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Send expiration reminder email
   */
  async sendExpirationReminder(data: {
    customerEmail: string;
    customerName: string;
    expiringAccess: Array<{
      productName: string;
      accessToken: string;
      expiresAt: Date;
      downloadsRemaining: number | null;
    }>;
  }): Promise<void> {
    console.log('[DigitalDownloadEmail] Sending expiration reminder to:', data.customerEmail);

    const emailHtml = this.generateExpirationReminderHtml(data);
    const emailText = this.generateExpirationReminderText(data);

    const subject = '⚠️ Your Digital Downloads Are Expiring Soon';

    try {
      const result = await emailService.sendEmail({
        to: data.customerEmail,
        subject,
        html: emailHtml,
        text: emailText,
      });

      if (result.success) {
        console.log('[DigitalDownloadEmail] Expiration reminder sent to:', data.customerEmail);
      } else {
        logger.error('[DigitalDownloadEmail] Failed to send expiration reminder:', undefined, { error: { name: 'Error', message: result.error } });
      }
    } catch (error) {
      logger.error('[DigitalDownloadEmail] Error sending expiration reminder:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('\n' + '='.repeat(80));
      console.log('EXPIRATION REMINDER EMAIL');
      console.log('='.repeat(80));
      console.log('To:', data.customerEmail);
      console.log('Subject: ⚠️ Your Digital Downloads Are Expiring Soon');
      console.log('\n' + emailText);
      console.log('='.repeat(80) + '\n');
    }
  }

  /**
   * Generate HTML expiration reminder email
   */
  private generateExpirationReminderHtml(data: {
    customerEmail: string;
    customerName: string;
    expiringAccess: Array<{
      productName: string;
      accessToken: string;
      expiresAt: Date;
      downloadsRemaining: number | null;
    }>;
  }): string {
    const accessItems = data.expiringAccess.map(access => {
      const daysUntilExpiration = Math.ceil(
        (access.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      return `
        <tr>
          <td style="padding: 20px; border: 1px solid #fbbf24; border-radius: 8px; margin-bottom: 16px; background: #fffbeb;">
            <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 18px;">
              ⚠️ ${access.productName}
            </h3>
            <p style="margin: 0 0 12px 0; color: #b45309; font-size: 14px;">
              Expires in <strong>${daysUntilExpiration} day${daysUntilExpiration !== 1 ? 's' : ''}</strong>
            </p>
            <a href="${process.env.FRONTEND_URL}/download/${access.accessToken}" 
               style="display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
              📥 Download Now Before It Expires
            </a>
            ${access.downloadsRemaining !== null ? `
              <p style="margin: 12px 0 0 0; color: #92400e; font-size: 14px;">
                Downloads remaining: ${access.downloadsRemaining}
              </p>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Digital Downloads Are Expiring</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(to right, #fef3c7, #fde68a);">
              <h1 style="margin: 0; color: #92400e; font-size: 28px;">
                ⚠️ Your Downloads Are Expiring Soon
              </h1>
              <p style="margin: 12px 0 0 0; color: #b45309; font-size: 16px;">
                Hi ${data.customerName}, don't lose access to your purchases!
              </p>
            </td>
          </tr>

          <!-- Expiring Items -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">Expiring Digital Products:</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${accessItems}
              </table>
            </td>
          </tr>

          <!-- Warning -->
          <tr>
            <td style="padding: 20px 40px; background: #fef3c7; border-radius: 8px; margin: 20px 40px;">
              <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px;">⚡ Act Now</h3>
              <p style="margin: 0; color: #b45309; font-size: 14px; line-height: 1.6;">
                Once access expires, you won't be able to download these files. Download them now to ensure you have permanent access to your purchases.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0;">Questions? Reply to this email or contact support.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text expiration reminder email
   */
  private generateExpirationReminderText(data: {
    customerEmail: string;
    customerName: string;
    expiringAccess: Array<{
      productName: string;
      accessToken: string;
      expiresAt: Date;
      downloadsRemaining: number | null;
    }>;
  }): string {
    const accessItems = data.expiringAccess.map(access => {
      const daysUntilExpiration = Math.ceil(
        (access.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      return `
⚠️ ${access.productName}
   Expires in: ${daysUntilExpiration} day${daysUntilExpiration !== 1 ? 's' : ''}
   Download: ${process.env.FRONTEND_URL}/download/${access.accessToken}
   ${access.downloadsRemaining !== null ? `Downloads remaining: ${access.downloadsRemaining}` : ''}
      `.trim();
    }).join('\n\n');

    return `
⚠️ YOUR DOWNLOADS ARE EXPIRING SOON

Hi ${data.customerName},

Some of your digital purchases will expire soon. Download them now to ensure permanent access!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${accessItems}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ ACT NOW

Once access expires, you won't be able to download these files.
Download them now to ensure you have permanent access.

Questions? Reply to this email or contact support.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }
}

// Export singleton instance
export const digitalDownloadEmailService = new DigitalDownloadEmailService();
