/**
 * Platform Fee Summary Email Service
 * Sends monthly summary emails to merchants about platform fees collected
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';

export interface FeeSummaryData {
  merchantEmail: string;
  merchantName: string;
  tenantName: string;
  periodStart: Date;
  periodEnd: Date;
  totalSalesCents: number;
  totalTransactions: number;
  platformFeesCents: number;
  stripeFeesCents: number;
  netPayoutCents: number;
  breakdown: {
    transactionFees: number;
    subscriptionFees: number;
    depositForfeits: number;
  };
}

class PlatformFeeSummaryEmailService {
  /**
   * Generate and send monthly fee summary to merchant
   */
  async sendMonthlyFeeSummary(tenantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get tenant and owner info
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true },
      });

      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      // Get owner email
      const owner = await prisma.user_tenants.findFirst({
        where: {
          tenant_id: tenantId,
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

      if (!owner?.users) {
        return { success: false, error: 'No owner found for tenant' };
      }

      // Calculate period (last month)
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
      const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of last month

      // Get fee summary from platform_revenue_transactions
      const transactions = await prisma.platform_revenue_transactions.findMany({
        where: {
          tenant_id: tenantId,
          processed_at: {
            gte: periodStart,
            lt: periodEnd,
          },
          status: 'completed',
        },
        select: {
          transaction_type: true,
          gross_amount_cents: true,
          platform_fee_cents: true,
          gateway_fee_cents: true,
          net_amount_cents: true,
        },
      });

      // Calculate totals
      const summary: FeeSummaryData = {
        merchantEmail: owner.users.email,
        merchantName: `${owner.users.first_name || ''} ${owner.users.last_name || ''}`.trim() || owner.users.email,
        tenantName: tenant.name,
        periodStart,
        periodEnd,
        totalSalesCents: transactions.reduce((sum, t) => sum + (t.gross_amount_cents || 0), 0),
        totalTransactions: transactions.length,
        platformFeesCents: transactions.reduce((sum, t) => sum + (t.platform_fee_cents || 0), 0),
        stripeFeesCents: transactions.reduce((sum, t) => sum + (t.gateway_fee_cents || 0), 0),
        netPayoutCents: transactions.reduce((sum, t) => sum + (t.net_amount_cents || 0), 0),
        breakdown: {
          transactionFees: transactions
            .filter(t => t.transaction_type === 'transaction_fee')
            .reduce((sum, t) => sum + (t.platform_fee_cents || 0), 0),
          subscriptionFees: transactions
            .filter(t => t.transaction_type === 'subscription')
            .reduce((sum, t) => sum + (t.platform_fee_cents || 0), 0),
          depositForfeits: transactions
            .filter(t => t.transaction_type === 'deposit_forfeit')
            .reduce((sum, t) => sum + (t.platform_fee_cents || 0), 0),
        },
      };

      // Send email
      const { emailService } = await import('../email-service');
      
      const result = await emailService.sendEmail({
        to: summary.merchantEmail,
        subject: `Monthly Fee Summary - ${tenant.name} (${this.formatMonth(periodStart)})`,
        html: this.generateSummaryHtml(summary),
        text: this.generateSummaryText(summary),
      });

      if (result.success) {
        console.log(`[PlatformFeeSummary] Monthly summary sent to ${summary.merchantEmail}`);
      } else {
        logger.error(`[PlatformFeeSummary] Failed to send summary:`, undefined, { error: { name: 'Error', message: result.error } });
      }

      return { success: result.success, error: result.error };
    } catch (error: any) {
      logger.error('[PlatformFeeSummary] Error sending monthly summary:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send monthly summaries to all merchants with Stripe Connect
   */
  async sendAllMonthlySummaries(): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    const result = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Get all tenants with active Stripe Connect
      const connections = await prisma.merchant_stripe_connections.findMany({
        where: {
          onboarding_status: 'completed',
          stripe_payouts_enabled: true,
        },
        select: {
          tenant_id: true,
        },
      });

      console.log(`[PlatformFeeSummary] Sending monthly summaries to ${connections.length} merchants`);

      for (const connection of connections) {
        const summaryResult = await this.sendMonthlyFeeSummary(connection.tenant_id);
        
        if (summaryResult.success) {
          result.sent++;
        } else {
          result.failed++;
          result.errors.push(`${connection.tenant_id}: ${summaryResult.error}`);
        }
      }

      console.log(`[PlatformFeeSummary] Complete. Sent: ${result.sent}, Failed: ${result.failed}`);
      return result;
    } catch (error: any) {
      logger.error('[PlatformFeeSummary] Error in batch send:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Format month for display
   */
  private formatMonth(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  /**
   * Generate HTML for fee summary email
   */
  private generateSummaryHtml(data: FeeSummaryData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Fee Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #111827; font-size: 24px;">
                Monthly Fee Summary
              </h1>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 16px;">
                ${this.formatMonth(data.periodStart)}
              </p>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">
                ${data.tenantName}
              </p>
            </td>
          </tr>

          <!-- Summary Card -->
          <tr>
            <td style="padding: 20px 40px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px; color: white;">
                <p style="margin: 0; font-size: 14px; opacity: 0.9;">Net Payout</p>
                <p style="margin: 8px 0 0 0; font-size: 36px; font-weight: 600;">
                  $${(data.netPayoutCents / 100).toFixed(2)}
                </p>
                <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.8;">
                  ${data.totalTransactions} transactions
                </p>
              </div>
            </td>
          </tr>

          <!-- Breakdown -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px;">Fee Breakdown</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Total Sales</span>
                  </td>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    <span style="color: #111827; font-size: 14px; font-weight: 500;">$${(data.totalSalesCents / 100).toFixed(2)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Platform Fees</span>
                  </td>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    <span style="color: #dc2626; font-size: 14px; font-weight: 500;">-$${(data.platformFeesCents / 100).toFixed(2)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Payment Processing Fees</span>
                  </td>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    <span style="color: #dc2626; font-size: 14px; font-weight: 500;">-$${(data.stripeFeesCents / 100).toFixed(2)}</span>
                  </td>
                </tr>
                <tr style="background: #f0fdf4;">
                  <td style="padding: 16px 20px; border-radius: 0 0 8px 0;">
                    <span style="color: #059669; font-size: 14px; font-weight: 600;">Net Amount</span>
                  </td>
                  <td style="padding: 16px 20px; text-align: right;">
                    <span style="color: #059669; font-size: 16px; font-weight: 600;">$${(data.netPayoutCents / 100).toFixed(2)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${data.breakdown.transactionFees > 0 || data.breakdown.subscriptionFees > 0 ? `
          <!-- Fee Types -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <h3 style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">Platform Fees by Type</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${data.breakdown.transactionFees > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Transaction Fees</td>
                  <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 13px;">$${(data.breakdown.transactionFees / 100).toFixed(2)}</td>
                </tr>
                ` : ''}
                ${data.breakdown.subscriptionFees > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Subscription Fees</td>
                  <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 13px;">$${(data.breakdown.subscriptionFees / 100).toFixed(2)}</td>
                </tr>
                ` : ''}
                ${data.breakdown.depositForfeits > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Deposit Forfeits</td>
                  <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 13px;">$${(data.breakdown.depositForfeits / 100).toFixed(2)}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Info -->
          <tr>
            <td style="padding: 20px 40px;">
              <div style="background: #eff6ff; padding: 16px; border-radius: 8px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                  <strong>How fees work:</strong> Platform fees are automatically deducted from each transaction before the payout is sent to your bank account.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0;">
                View detailed transaction history in your 
                <a href="${process.env.WEB_URL}/settings/payments" style="color: #667eea; text-decoration: none;">payment settings</a>.
              </p>
              <p style="margin: 0;">
                Questions? <a href="${process.env.WEB_URL}/support" style="color: #667eea; text-decoration: none;">Contact support</a>
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
   * Generate text for fee summary email
   */
  private generateSummaryText(data: FeeSummaryData): string {
    return `Monthly Fee Summary - ${this.formatMonth(data.periodStart)}
${data.tenantName}

NET PAYOUT: $${(data.netPayoutCents / 100).toFixed(2)}
${data.totalTransactions} transactions

FEE BREAKDOWN
-----------------
Total Sales:           $${(data.totalSalesCents / 100).toFixed(2)}
Platform Fees:        -$${(data.platformFeesCents / 100).toFixed(2)}
Processing Fees:      -$${(data.stripeFeesCents / 100).toFixed(2)}
-----------------
Net Amount:            $${(data.netPayoutCents / 100).toFixed(2)}

${data.breakdown.transactionFees > 0 || data.breakdown.subscriptionFees > 0 ? `
PLATFORM FEES BY TYPE
${data.breakdown.transactionFees > 0 ? `Transaction Fees: $${(data.breakdown.transactionFees / 100).toFixed(2)}` : ''}
${data.breakdown.subscriptionFees > 0 ? `Subscription Fees: $${(data.breakdown.subscriptionFees / 100).toFixed(2)}` : ''}
${data.breakdown.depositForfeits > 0 ? `Deposit Forfeits: $${(data.breakdown.depositForfeits / 100).toFixed(2)}` : ''}
` : ''}
How fees work: Platform fees are automatically deducted from each transaction before the payout is sent to your bank account.

View detailed transaction history: ${process.env.WEB_URL}/settings/payments
Questions? Contact support: ${process.env.WEB_URL}/support
`.trim();
  }
}

// Singleton instance
let instance: PlatformFeeSummaryEmailService | null = null;

export function getPlatformFeeSummaryEmailService(): PlatformFeeSummaryEmailService {
  if (!instance) {
    instance = new PlatformFeeSummaryEmailService();
  }
  return instance;
}
