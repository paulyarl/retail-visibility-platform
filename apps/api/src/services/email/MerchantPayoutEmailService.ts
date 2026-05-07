/**
 * Merchant Payout Email Service
 * Sends email notifications to merchants about their Stripe Connect payouts
 */

import { prisma } from '../../prisma';

export interface PayoutEmailData {
  merchantEmail: string;
  merchantName: string;
  tenantName: string;
  payoutId: string;
  amount: number;
  currency: string;
  estimatedArrivalDate?: Date;
  bankAccountLast4?: string;
  failureReason?: string;
}

export type PayoutEmailType = 'payout_sent' | 'payout_failed';

class MerchantPayoutEmailService {
  /**
   * Send payout notification email
   */
  async sendPayoutNotification(
    type: PayoutEmailType,
    data: PayoutEmailData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { emailService } = await import('../email-service');
      
      const subject = type === 'payout_sent'
        ? `Payout Sent - $${(data.amount / 100).toFixed(2)} to your account`
        : `Payout Failed - Action Required`;
      
      const html = type === 'payout_sent'
        ? this.generatePayoutSentHtml(data)
        : this.generatePayoutFailedHtml(data);
      
      const text = type === 'payout_sent'
        ? this.generatePayoutSentText(data)
        : this.generatePayoutFailedText(data);

      const result = await emailService.sendEmail({
        to: data.merchantEmail,
        subject,
        html,
        text,
      });

      if (result.success) {
        console.log(`[MerchantPayoutEmail] ${type} email sent to ${data.merchantEmail}`);
      } else {
        console.error(`[MerchantPayoutEmail] Failed to send ${type} email:`, result.error);
      }

      return { success: result.success, error: result.error };
    } catch (error: any) {
      console.error('[MerchantPayoutEmail] Error sending payout email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get merchant email from Stripe account ID
   */
  async getMerchantEmailFromStripeAccount(stripeAccountId: string): Promise<{
    email: string;
    name: string;
    tenantId: string;
    tenantName: string;
  } | null> {
    try {
      // Find merchant connection with this Stripe account
      const connection = await prisma.merchant_stripe_connections.findFirst({
        where: {
          stripe_account_id: stripeAccountId,
        },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!connection?.tenants) return null;

      // Get owner email
      const owner = await prisma.user_tenants.findFirst({
        where: {
          tenant_id: connection.tenant_id,
          role: 'OWNER',
        },
        include: {
          users: {
            select: {
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!owner?.users) return null;

      return {
        email: owner.users.email,
        name: `${owner.users.first_name || ''} ${owner.users.last_name || ''}`.trim() || owner.users.email,
        tenantId: connection.tenant_id,
        tenantName: connection.tenants.name,
      };
    } catch (error) {
      console.error('[MerchantPayoutEmail] Error getting merchant email:', error);
      return null;
    }
  }

  /**
   * Generate HTML for payout sent email
   */
  private generatePayoutSentHtml(data: PayoutEmailData): string {
    const arrivalDate = data.estimatedArrivalDate
      ? new Date(data.estimatedArrivalDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '2-5 business days';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payout Sent</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #059669; font-size: 28px;">
                Payout Sent! 
              </h1>
              <p style="margin: 12px 0 0 0; color: #6b7280; font-size: 16px;">
                Hi ${data.merchantName},
              </p>
            </td>
          </tr>

          <!-- Amount -->
          <tr>
            <td style="padding: 20px 40px;">
              <div style="background: #f0fdf4; padding: 24px; border-radius: 8px; text-align: center; border: 2px solid #059669;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">Amount</p>
                <p style="margin: 8px 0 0 0; color: #059669; font-size: 36px; font-weight: 600;">
                  $${(data.amount / 100).toFixed(2)}
                </p>
              </div>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Store</span>
                  </td>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    <span style="color: #111827; font-size: 14px; font-weight: 500;">${data.tenantName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Bank Account</span>
                  </td>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    <span style="color: #111827; font-size: 14px; font-weight: 500;">****${data.bankAccountLast4 || '****'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <span style="color: #6b7280; font-size: 14px;">Expected Arrival</span>
                  </td>
                  <td style="padding: 16px 20px; text-align: right;">
                    <span style="color: #111827; font-size: 14px; font-weight: 500;">${arrivalDate}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Info -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Your payout has been initiated and is on its way to your bank account. 
                Please note that banks may take additional time to process the deposit.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0;">Payout ID: ${data.payoutId}</p>
              <p style="margin: 0;">
                Questions? Contact support or check your 
                <a href="${process.env.WEB_URL}/settings/payments" style="color: #059669; text-decoration: none;">payment settings</a>.
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
   * Generate text for payout sent email
   */
  private generatePayoutSentText(data: PayoutEmailData): string {
    const arrivalDate = data.estimatedArrivalDate
      ? new Date(data.estimatedArrivalDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '2-5 business days';

    return `Hi ${data.merchantName},

PAYOUT SENT!

Amount: $${(data.amount / 100).toFixed(2)}
Store: ${data.tenantName}
Bank Account: ****${data.bankAccountLast4 || '****'}
Expected Arrival: ${arrivalDate}

Your payout has been initiated and is on its way to your bank account.
Please note that banks may take additional time to process the deposit.

Payout ID: ${data.payoutId}

Questions? Contact support or check your payment settings at:
${process.env.WEB_URL}/settings/payments
`.trim();
  }

  /**
   * Generate HTML for payout failed email
   */
  private generatePayoutFailedHtml(data: PayoutEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payout Failed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #dc2626; font-size: 28px;">
                Payout Failed
              </h1>
              <p style="margin: 12px 0 0 0; color: #6b7280; font-size: 16px;">
                Hi ${data.merchantName},
              </p>
            </td>
          </tr>

          <!-- Alert Box -->
          <tr>
            <td style="padding: 20px 40px;">
              <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 500;">
                  Your payout of $${(data.amount / 100).toFixed(2)} could not be processed.
                </p>
                ${data.failureReason ? `
                <p style="margin: 12px 0 0 0; color: #7f1d1d; font-size: 14px;">
                  <strong>Reason:</strong> ${data.failureReason}
                </p>
                ` : ''}
              </div>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Amount</span>
                  </td>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    <span style="color: #111827; font-size: 14px; font-weight: 500;">$${(data.amount / 100).toFixed(2)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <span style="color: #6b7280; font-size: 14px;">Store</span>
                  </td>
                  <td style="padding: 16px 20px; text-align: right;">
                    <span style="color: #111827; font-size: 14px; font-weight: 500;">${data.tenantName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 16px 0; color: #111827; font-size: 16px; font-weight: 500;">
                What you need to do:
              </p>
              <ol style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
                <li>Check your bank account details in your payment settings</li>
                <li>Ensure your bank account is active and can receive transfers</li>
                <li>Contact your bank if the account details are correct</li>
              </ol>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 20px 40px; text-align: center;">
              <a href="${process.env.WEB_URL}/settings/payments" 
                 style="display: inline-block; padding: 14px 28px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Update Payment Settings
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0;">Payout ID: ${data.payoutId}</p>
              <p style="margin: 0;">
                Need help? <a href="${process.env.WEB_URL}/support" style="color: #dc2626; text-decoration: none;">Contact support</a>
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
   * Generate text for payout failed email
   */
  private generatePayoutFailedText(data: PayoutEmailData): string {
    return `Hi ${data.merchantName},

PAYOUT FAILED

Your payout of $${(data.amount / 100).toFixed(2)} could not be processed.
${data.failureReason ? `Reason: ${data.failureReason}` : ''}

Amount: $${(data.amount / 100).toFixed(2)}
Store: ${data.tenantName}

What you need to do:
1. Check your bank account details in your payment settings
2. Ensure your bank account is active and can receive transfers
3. Contact your bank if the account details are correct

Update your payment settings:
${process.env.WEB_URL}/settings/payments

Payout ID: ${data.payoutId}

Need help? Contact support.
`.trim();
  }
}

// Singleton instance
let instance: MerchantPayoutEmailService | null = null;

export function getMerchantPayoutEmailService(): MerchantPayoutEmailService {
  if (!instance) {
    instance = new MerchantPayoutEmailService();
  }
  return instance;
}
