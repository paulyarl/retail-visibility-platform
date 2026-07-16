/**
 * Admin Email Service
 * Sends email notifications to platform admins about important events
 */

import { prisma } from '../../prisma';

export interface AdminNotificationData {
  type: 'merchant_onboarding_complete' | 'merchant_onboarding_requires_action' | 'platform_revenue_summary' | 'new_merchant_signup' | 'subscription_cancellation_request';
  data: Record<string, any>;
}

export interface RevenueSummaryData {
  periodStart: Date;
  periodEnd: Date;
  totalRevenueCents: number;
  totalTransactions: number;
  activeMerchants: number;
  newMerchants: number;
  topMerchants: Array<{
    name: string;
    revenue: number;
    transactions: number;
  }>;
}

class AdminEmailService {
  /**
   * Get admin email addresses
   */
  private async getAdminEmails(): Promise<string[]> {
    const admins = await prisma.user_tenants.findMany({
      where: {
        role: 'OWNER',
        tenants: {
          id: 'platform',
        },
      },
      include: {
        users: {
          select: { email: true },
        },
      },
    });

    // Fallback to env variable if no platform admins found
    if (admins.length === 0) {
      const fallbackEmail = process.env.PLATFORM_ADMIN_EMAIL;
      return fallbackEmail ? [fallbackEmail] : [];
    }

    return admins.map(a => a.users.email).filter(Boolean) as string[];
  }

  /**
   * Send notification to all platform admins
   */
  async sendAdminNotification(notification: AdminNotificationData): Promise<{ success: boolean; error?: string }> {
    try {
      const adminEmails = await this.getAdminEmails();
      
      if (adminEmails.length === 0) {
        console.warn('[AdminEmail] No admin emails configured');
        return { success: false, error: 'No admin emails configured' };
      }

      const { emailService } = await import('../email-service');
      
      const subject = this.getSubject(notification);
      const html = this.generateHtml(notification);
      const text = this.generateText(notification);

      // Send to all admins
      const results = await Promise.all(
        adminEmails.map(email => 
          emailService.sendEmail({ to: email, subject, html, text })
        )
      );

      const allSuccess = results.every(r => r.success);
      
      if (allSuccess) {
        console.log(`[AdminEmail] ${notification.type} sent to ${adminEmails.length} admins`);
      } else {
        console.error(`[AdminEmail] Some sends failed for ${notification.type}`);
      }

      return { success: allSuccess };
    } catch (error: any) {
      console.error('[AdminEmail] Error sending admin notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send merchant onboarding complete notification
   */
  async sendMerchantOnboardingComplete(data: {
    tenantId: string;
    tenantName: string;
    ownerEmail: string;
    stripeAccountId?: string;
    paypalMerchantId?: string;
  }): Promise<{ success: boolean }> {
    const result = await this.sendAdminNotification({
      type: 'merchant_onboarding_complete',
      data,
    });
    return { success: result.success };
  }

  /**
   * Send merchant onboarding requires action notification
   */
  async sendMerchantOnboardingRequiresAction(data: {
    tenantId: string;
    tenantName: string;
    ownerEmail: string;
    requirements: string[];
    gateway: 'stripe' | 'paypal';
  }): Promise<{ success: boolean }> {
    const result = await this.sendAdminNotification({
      type: 'merchant_onboarding_requires_action',
      data,
    });
    return { success: result.success };
  }

  /**
   * Send weekly platform revenue summary
   */
  async sendWeeklyRevenueSummary(): Promise<{ success: boolean }> {
    try {
      const summary = await this.getWeeklyRevenueSummary();
      
      const result = await this.sendAdminNotification({
        type: 'platform_revenue_summary',
        data: summary,
      });
      
      return { success: result.success };
    } catch (error) {
      console.error('[AdminEmail] Error sending revenue summary:', error);
      return { success: false };
    }
  }

  /**
   * Get weekly revenue summary
   */
  private async getWeeklyRevenueSummary(): Promise<RevenueSummaryData> {
    const now = new Date();
    const periodEnd = new Date(now);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 7);

    // Get total revenue and transactions
    const transactions = await prisma.platform_revenue_transactions.findMany({
      where: {
        processed_at: {
          gte: periodStart,
          lt: periodEnd,
        },
        status: 'completed',
      },
      select: {
        tenant_id: true,
        platform_fee_cents: true,
      },
    });

    // Get active merchants (with transactions in last 30 days)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeMerchants = await prisma.platform_revenue_transactions.findMany({
      where: {
        processed_at: { gte: thirtyDaysAgo },
      },
      select: { tenant_id: true },
      distinct: ['tenant_id'],
    });

    // Get new merchants this week
    const newMerchants = await prisma.merchant_stripe_connections.findMany({
      where: {
        onboarding_completed_at: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
    });

    // Calculate top merchants
    const merchantRevenue: Record<string, { revenue: number; transactions: number }> = {};
    for (const t of transactions) {
      const tenantId = t.tenant_id;
      if (!tenantId) continue;
      if (!merchantRevenue[tenantId]) {
        merchantRevenue[tenantId] = { revenue: 0, transactions: 0 };
      }
      merchantRevenue[tenantId].revenue += t.platform_fee_cents || 0;
      merchantRevenue[tenantId].transactions++;
    }

    const topMerchantIds = Object.entries(merchantRevenue)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([id]) => id);

    const topMerchantData = await prisma.tenants.findMany({
      where: { id: { in: topMerchantIds } },
      select: { id: true, name: true },
    });

    const topMerchants = topMerchantIds.map(id => {
      const tenant = topMerchantData.find(t => t.id === id);
      const stats = merchantRevenue[id];
      return {
        name: tenant?.name || 'Unknown',
        revenue: stats.revenue,
        transactions: stats.transactions,
      };
    });

    return {
      periodStart,
      periodEnd,
      totalRevenueCents: transactions.reduce((sum, t) => sum + (t.platform_fee_cents || 0), 0),
      totalTransactions: transactions.length,
      activeMerchants: activeMerchants.length,
      newMerchants: newMerchants.length,
      topMerchants,
    };
  }

  /**
   * Get subject line for notification type
   */
  private getSubject(notification: AdminNotificationData): string {
    switch (notification.type) {
      case 'merchant_onboarding_complete':
        return `Merchant Onboarding Complete: ${notification.data.tenantName}`;
      case 'merchant_onboarding_requires_action':
        return `Action Required: ${notification.data.tenantName} onboarding needs attention`;
      case 'platform_revenue_summary':
        return `Weekly Revenue Summary - $${((notification.data.totalRevenueCents || 0) / 100).toFixed(2)}`;
      case 'new_merchant_signup':
        return `New Merchant Signup: ${notification.data.tenantName}`;
      case 'subscription_cancellation_request':
        return `Cancellation Request: ${notification.data.tenantName}`;
      default:
        return 'Platform Notification';
    }
  }

  /**
   * Generate HTML content
   */
  private generateHtml(notification: AdminNotificationData): string {
    switch (notification.type) {
      case 'merchant_onboarding_complete':
        return this.generateOnboardingCompleteHtml(notification.data);
      case 'merchant_onboarding_requires_action':
        return this.generateOnboardingRequiresActionHtml(notification.data);
      case 'platform_revenue_summary':
        return this.generateRevenueSummaryHtml(notification.data);
      default:
        return `<p>Admin notification: ${notification.type}</p><pre>${JSON.stringify(notification.data, null, 2)}</pre>`;
    }
  }

  /**
   * Generate text content
   */
  private generateText(notification: AdminNotificationData): string {
    switch (notification.type) {
      case 'merchant_onboarding_complete':
        return this.generateOnboardingCompleteText(notification.data);
      case 'merchant_onboarding_requires_action':
        return this.generateOnboardingRequiresActionText(notification.data);
      case 'platform_revenue_summary':
        return this.generateRevenueSummaryText(notification.data);
      default:
        return `${notification.type}\n\n${JSON.stringify(notification.data, null, 2)}`;
    }
  }

  // Template generators
  private generateOnboardingCompleteHtml(data: Record<string, any>): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
    <h1 style="color: #059669; margin: 0 0 16px;">Merchant Onboarding Complete</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">A new merchant has completed payment gateway onboarding.</p>
    
    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
      <h2 style="color: #111827; margin: 0 0 12px; font-size: 18px;">${data.tenantName}</h2>
      <p style="margin: 0; color: #6b7280;">Owner: ${data.ownerEmail}</p>
      ${data.stripeAccountId ? `<p style="margin: 8px 0 0; color: #6b7280;">Stripe: ${data.stripeAccountId}</p>` : ''}
      ${data.paypalMerchantId ? `<p style="margin: 8px 0 0; color: #6b7280;">PayPal: ${data.paypalMerchantId}</p>` : ''}
    </div>
    
    <p style="margin: 0;">
      <a href="${process.env.WEB_URL}/settings/admin/tenants/${data.tenantId}" 
         style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        View Merchant
      </a>
    </p>
  </div>
</body>
</html>`;
  }

  private generateOnboardingCompleteText(data: Record<string, any>): string {
    return `Merchant Onboarding Complete

${data.tenantName}
Owner: ${data.ownerEmail}
${data.stripeAccountId ? `Stripe: ${data.stripeAccountId}` : ''}
${data.paypalMerchantId ? `PayPal: ${data.paypalMerchantId}` : ''}

View merchant: ${process.env.WEB_URL}/settings/admin/tenants/${data.tenantId}`;
  }

  private generateOnboardingRequiresActionHtml(data: Record<string, any>): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
    <h1 style="color: #dc2626; margin: 0 0 16px;">Onboarding Requires Action</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">A merchant's payment gateway onboarding needs additional information.</p>
    
    <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #dc2626;">
      <h2 style="color: #111827; margin: 0 0 12px; font-size: 18px;">${data.tenantName}</h2>
      <p style="margin: 0; color: #6b7280;">Owner: ${data.ownerEmail}</p>
      <p style="margin: 8px 0 0; color: #6b7280;">Gateway: ${data.gateway}</p>
    </div>
    
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; color: #111827;">Requirements:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #374151;">
        ${(data.requirements || []).map((r: string) => `<li>${r}</li>`).join('')}
      </ul>
    </div>
    
    <p style="margin: 0;">
      <a href="${process.env.WEB_URL}/settings/admin/tenants/${data.tenantId}" 
         style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        View & Help
      </a>
    </p>
  </div>
</body>
</html>`;
  }

  private generateOnboardingRequiresActionText(data: Record<string, any>): string {
    return `Onboarding Requires Action

${data.tenantName}
Owner: ${data.ownerEmail}
Gateway: ${data.gateway}

Requirements:
${(data.requirements || []).map((r: string) => `- ${r}`).join('\n')}

View merchant: ${process.env.WEB_URL}/settings/admin/tenants/${data.tenantId}`;
  }

  private generateRevenueSummaryHtml(data: Record<string, any>): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
    <h1 style="color: #111827; margin: 0 0 8px;">Weekly Revenue Summary</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      ${new Date(data.periodStart).toLocaleDateString()} - ${new Date(data.periodEnd).toLocaleDateString()}
    </p>
    
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px; color: white; margin-bottom: 24px;">
      <p style="margin: 0; opacity: 0.9; font-size: 14px;">Platform Revenue</p>
      <p style="margin: 8px 0 0; font-size: 36px; font-weight: 600;">$${((data.totalRevenueCents || 0) / 100).toFixed(2)}</p>
      <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">${data.totalTransactions || 0} transactions</p>
    </div>
    
    <div style="display: flex; gap: 16px; margin-bottom: 24px;">
      <div style="flex: 1; background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: #059669; font-size: 24px; font-weight: 600;">${data.activeMerchants || 0}</p>
        <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">Active Merchants</p>
      </div>
      <div style="flex: 1; background: #eff6ff; padding: 16px; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: #2563eb; font-size: 24px; font-weight: 600;">${data.newMerchants || 0}</p>
        <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">New This Week</p>
      </div>
    </div>
    
    ${(data.topMerchants || []).length > 0 ? `
    <h3 style="margin: 0 0 12px; color: #111827;">Top Merchants</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid #e5e7eb;">
          <th style="text-align: left; padding: 8px; color: #6b7280; font-weight: 500;">Merchant</th>
          <th style="text-align: right; padding: 8px; color: #6b7280; font-weight: 500;">Revenue</th>
          <th style="text-align: right; padding: 8px; color: #6b7280; font-weight: 500;">Txns</th>
        </tr>
      </thead>
      <tbody>
        ${(data.topMerchants || []).map((m: any) => `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px; color: #111827;">${m.name}</td>
            <td style="padding: 12px 8px; text-align: right; color: #059669; font-weight: 500;">$${(m.revenue / 100).toFixed(2)}</td>
            <td style="padding: 12px 8px; text-align: right; color: #6b7280;">${m.transactions}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    <p style="margin: 24px 0 0;">
      <a href="${process.env.WEB_URL}/settings/admin/platform-revenue" 
         style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        View Full Report
      </a>
    </p>
  </div>
</body>
</html>`;
  }

  private generateRevenueSummaryText(data: Record<string, any>): string {
    return `Weekly Revenue Summary
${new Date(data.periodStart).toLocaleDateString()} - ${new Date(data.periodEnd).toLocaleDateString()}

Platform Revenue: $${((data.totalRevenueCents || 0) / 100).toFixed(2)}
Transactions: ${data.totalTransactions || 0}

Active Merchants: ${data.activeMerchants || 0}
New This Week: ${data.newMerchants || 0}

${(data.topMerchants || []).length > 0 ? `
Top Merchants:
${(data.topMerchants || []).map((m: any) => `- ${m.name}: $${(m.revenue / 100).toFixed(2)} (${m.transactions} txns)`).join('\n')}
` : ''}
View full report: ${process.env.WEB_URL}/settings/admin/platform-revenue`;
  }
}

// Singleton instance
let instance: AdminEmailService | null = null;

export function getAdminEmailService(): AdminEmailService {
  if (!instance) {
    instance = new AdminEmailService();
  }
  return instance;
}
