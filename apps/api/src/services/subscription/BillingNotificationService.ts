/**
 * Billing Notification Service
 * 
 * Handles email notifications for subscription billing events:
 * - Payment success
 * - Payment failure
 * - Grace period warnings (7, 14, 21, 28 days)
 * - Subscription cancellation
 * - Tier changes
 */

import { prisma } from '../../prisma';

export type BillingNotificationType = 
  | 'payment_success'
  | 'payment_failed'
  | 'grace_period_warning'
  | 'subscription_canceled'
  | 'subscription_reactivated'
  | 'tier_changed'
  | 'invoice_created'
  | 'trial_started'
  | 'trial_converted'
  | 'trial_payment_failed'
  | 'trial_expired';

export interface BillingNotificationData {
  tenantId: string;
  type: BillingNotificationType;
  tier?: string;
  amount?: number;
  billingCycle?: 'monthly' | 'annual';
  gracePeriodDaysRemaining?: number;
  reason?: string;
  invoiceId?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, any>;
}

class BillingNotificationService {
  /**
   * Send billing notification
   */
  async sendNotification(data: BillingNotificationData): Promise<boolean> {
    try {
      // Get tenant owner email
      const owner = await this.getTenantOwner(data.tenantId);
      if (!owner) {
        console.error(`[BillingNotification] No owner found for tenant ${data.tenantId}`);
        return false;
      }

      // Build email payload based on notification type
      const emailPayload = await this.buildEmailPayload(owner.email, owner.name, data);
      
      // Send email (via configured email service)
      const sent = await this.sendEmail(emailPayload);
      
      // Log notification
      await this.logNotification(data, sent);
      
      return sent;
    } catch (error) {
      console.error('[BillingNotification] Error sending notification:', error);
      return false;
    }
  }

  /**
   * Get tenant owner email
   */
  private async getTenantOwner(tenantId: string): Promise<{ email: string; name: string } | null> {
    const userTenant = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        role: 'OWNER'
      },
      include: {
        users: {
          select: {
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });

    if (!userTenant?.users) return null;

    return {
      email: userTenant.users.email,
      name: `${userTenant.users.first_name || ''} ${userTenant.users.last_name || ''}`.trim() || userTenant.users.email
    };
  }

  /**
   * Build email payload based on notification type
   */
  private async buildEmailPayload(
    toEmail: string,
    ownerName: string,
    data: BillingNotificationData
  ): Promise<EmailPayload> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: data.tenantId },
      select: { name: true },
    });

    const businessName = tenant?.name || 'Your Store';

    switch (data.type) {
      case 'payment_success':
        return {
          to: toEmail,
          subject: `Payment Successful - ${businessName} Subscription`,
          html: this.buildPaymentSuccessHtml(ownerName, businessName, data),
          text: this.buildPaymentSuccessText(ownerName, businessName, data),
        };

      case 'payment_failed':
        return {
          to: toEmail,
          subject: `Payment Failed - ${businessName} Subscription`,
          html: this.buildPaymentFailedHtml(ownerName, businessName, data),
          text: this.buildPaymentFailedText(ownerName, businessName, data),
        };

      case 'grace_period_warning':
        return {
          to: toEmail,
          subject: `Action Required: Subscription Payment Overdue - ${businessName}`,
          html: this.buildGracePeriodWarningHtml(ownerName, businessName, data),
          text: this.buildGracePeriodWarningText(ownerName, businessName, data),
        };

      case 'subscription_canceled':
        return {
          to: toEmail,
          subject: `Subscription Canceled - ${businessName}`,
          html: this.buildSubscriptionCanceledHtml(ownerName, businessName, data),
          text: this.buildSubscriptionCanceledText(ownerName, businessName, data),
        };

      case 'subscription_reactivated':
        return {
          to: toEmail,
          subject: `Subscription Reactivated - ${businessName}`,
          html: this.buildSubscriptionReactivatedHtml(ownerName, businessName, data),
          text: this.buildSubscriptionReactivatedText(ownerName, businessName, data),
        };

      case 'tier_changed':
        return {
          to: toEmail,
          subject: `Plan Updated - ${businessName}`,
          html: this.buildTierChangedHtml(ownerName, businessName, data),
          text: this.buildTierChangedText(ownerName, businessName, data),
        };

      default:
        return {
          to: toEmail,
          subject: `Subscription Update - ${businessName}`,
          html: `<p>Hi ${ownerName},</p><p>Your subscription has been updated.</p>`,
          text: `Hi ${ownerName},\n\nYour subscription has been updated.`,
        };
    }
  }

  // Email templates - Payment Success
  private buildPaymentSuccessHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Payment Successful</h2>
        <p>Hi ${name},</p>
        <p>Your payment for <strong>${business}</strong> has been processed successfully.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Plan:</strong> ${data.tier || 'N/A'}</p>
          <p style="margin: 8px 0 0;"><strong>Amount:</strong> $${((data.amount || 0) / 100).toFixed(2)}</p>
        </div>
        <p>Your subscription is now active. Thank you for your continued support!</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/settings/subscription" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Manage Subscription</a>
        </p>
      </div>
    `;
  }

  private buildPaymentSuccessText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

Your payment for ${business} has been processed successfully.

Plan: ${data.tier || 'N/A'}
Amount: $${((data.amount || 0) / 100).toFixed(2)}

Your subscription is now active. Thank you for your continued support!

Manage your subscription at: ${process.env.WEB_URL}/settings/subscription`;
  }

  // Email templates - Payment Failed
  private buildPaymentFailedHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Payment Failed</h2>
        <p>Hi ${name},</p>
        <p>We were unable to process your payment for <strong>${business}</strong>.</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Reason:</strong> ${data.reason || 'Payment method declined'}</p>
        </div>
        <p>Please update your payment method to avoid service interruption.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/settings/subscription" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Method</a>
        </p>
      </div>
    `;
  }

  private buildPaymentFailedText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

We were unable to process your payment for ${business}.

Reason: ${data.reason || 'Payment method declined'}

Please update your payment method to avoid service interruption.

Update your payment method at: ${process.env.WEB_URL}/settings/subscription`;
  }

  // Email templates - Grace Period Warning
  private buildGracePeriodWarningHtml(name: string, business: string, data: BillingNotificationData): string {
    const days = data.gracePeriodDaysRemaining || 0;
    const urgency = days <= 7 ? 'urgent' : days <= 14 ? 'important' : 'reminder';
    const color = days <= 7 ? '#dc2626' : days <= 14 ? '#ea580c' : '#ca8a04';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${color};">Action Required: Payment Overdue</h2>
        <p>Hi ${name},</p>
        <p>Your subscription payment for <strong>${business}</strong> is overdue.</p>
        <div style="background: #fefce8; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${color};">
          <p style="margin: 0; font-size: 18px;"><strong>${days} days</strong> remaining in grace period</p>
          <p style="margin: 8px 0 0; color: #666;">After ${days} days, your account will be downgraded to the free tier.</p>
        </div>
        <p>Please update your payment method to maintain your current plan.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/settings/subscription" style="background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Now</a>
        </p>
      </div>
    `;
  }

  private buildGracePeriodWarningText(name: string, business: string, data: BillingNotificationData): string {
    const days = data.gracePeriodDaysRemaining || 0;
    return `Hi ${name},

Your subscription payment for ${business} is overdue.

${days} days remaining in grace period.
After ${days} days, your account will be downgraded to the free tier.

Please update your payment method to maintain your current plan.

Update your payment at: ${process.env.WEB_URL}/settings/subscription`;
  }

  // Email templates - Subscription Canceled
  private buildSubscriptionCanceledHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6b7280;">Subscription Canceled</h2>
        <p>Hi ${name},</p>
        <p>Your subscription for <strong>${business}</strong> has been canceled.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Reason:</strong> ${data.reason || 'Grace period expired'}</p>
          <p style="margin: 8px 0 0;"><strong>Current Plan:</strong> ${data.tier || 'Free'}</p>
        </div>
        <p>You can reactivate your subscription at any time.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/settings/subscription" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reactivate Subscription</a>
        </p>
      </div>
    `;
  }

  private buildSubscriptionCanceledText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

Your subscription for ${business} has been canceled.

Reason: ${data.reason || 'Grace period expired'}
Current Plan: ${data.tier || 'Free'}

You can reactivate your subscription at any time.

Reactivate at: ${process.env.WEB_URL}/settings/subscription`;
  }

  // Email templates - Subscription Reactivated
  private buildSubscriptionReactivatedHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Subscription Reactivated</h2>
        <p>Hi ${name},</p>
        <p>Your subscription for <strong>${business}</strong> has been reactivated.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Plan:</strong> ${data.tier || 'N/A'}</p>
        </div>
        <p>Welcome back! Your subscription is now active.</p>
      </div>
    `;
  }

  private buildSubscriptionReactivatedText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

Your subscription for ${business} has been reactivated.

Plan: ${data.tier || 'N/A'}

Welcome back! Your subscription is now active.`;
  }

  // Email templates - Tier Changed
  private buildTierChangedHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Plan Updated</h2>
        <p>Hi ${name},</p>
        <p>Your subscription for <strong>${business}</strong> has been updated.</p>
        <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>New Plan:</strong> ${data.tier || 'N/A'}</p>
          ${data.amount ? `<p style="margin: 8px 0 0;"><strong>Amount:</strong> $${(data.amount / 100).toFixed(2)}/${data.billingCycle === 'annual' ? 'year' : 'month'}</p>` : ''}
        </div>
        <p>Your new plan is now active.</p>
      </div>
    `;
  }

  private buildTierChangedText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

Your subscription for ${business} has been updated.

New Plan: ${data.tier || 'N/A'}
${data.amount ? `Amount: $${(data.amount / 100).toFixed(2)}/${data.billingCycle === 'annual' ? 'year' : 'month'}` : ''}

Your new plan is now active.`;
  }

  /**
   * Send email via configured email service
   */
  private async sendEmail(payload: EmailPayload): Promise<boolean> {
    // Check if Resend is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (resendApiKey) {
      try {
        // Dynamically import resend (may not be installed)
        // @ts-expect-error - resend package is optional
        const resendModule = await import('resend').catch(() => null);
        if (!resendModule) {
          console.warn('[BillingNotification] Resend package not installed, skipping email send');
          return this.logEmailFallback(payload);
        }
        
        const Resend = resendModule.Resend;
        const resend = new Resend(resendApiKey);
        
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'noreply@visibleshelf.com',
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        });
        
        console.log(`[BillingNotification] Email sent to ${payload.to}: ${payload.subject}`);
        return true;
      } catch (error) {
        console.error('[BillingNotification] Resend error:', error);
        return this.logEmailFallback(payload);
      }
    }

    // Fallback: Log email for development
    return this.logEmailFallback(payload);
  }

  /**
   * Log email to console (dev fallback)
   */
  private logEmailFallback(payload: EmailPayload): boolean {
    console.log('[BillingNotification] Email (not sent - no service):');
    console.log(`  To: ${payload.to}`);
    console.log(`  Subject: ${payload.subject}`);
    console.log(`  Body: ${payload.text.substring(0, 100)}...`);
    return true;
  }

  /**
   * Log notification for audit trail
   */
  private async logNotification(data: BillingNotificationData, sent: boolean): Promise<void> {
    try {
      await prisma.notification_logs.create({
        data: {
          tenant_id: data.tenantId,
          type: data.type,
          sent: sent,
          metadata: data as any,
        },
      });
    } catch (error) {
      // Don't fail if logging fails
      console.error('[BillingNotification] Failed to log notification:', error);
    }
  }

  /**
   * Send grace period warning notifications
   * Called by scheduled job
   */
  async sendGracePeriodWarnings(): Promise<{
    sevenDays: number;
    fourteenDays: number;
    twentyOneDays: number;
    twentyEightDays: number;
  }> {
    const { getTenantsApproachingExpiry } = await import('../../jobs/subscription-grace-period');
    const tenants = await getTenantsApproachingExpiry();

    const results = {
      sevenDays: 0,
      fourteenDays: 0,
      twentyOneDays: 0,
      twentyEightDays: 0,
    };

    for (const tenant of tenants.sevenDays) {
      await this.sendNotification({
        tenantId: tenant.id,
        type: 'grace_period_warning',
        gracePeriodDaysRemaining: 7,
      });
      results.sevenDays++;
    }

    for (const tenant of tenants.fourteenDays) {
      await this.sendNotification({
        tenantId: tenant.id,
        type: 'grace_period_warning',
        gracePeriodDaysRemaining: 14,
      });
      results.fourteenDays++;
    }

    for (const tenant of tenants.twentyOneDays) {
      await this.sendNotification({
        tenantId: tenant.id,
        type: 'grace_period_warning',
        gracePeriodDaysRemaining: 21,
      });
      results.twentyOneDays++;
    }

    for (const tenant of tenants.twentyEightDays) {
      await this.sendNotification({
        tenantId: tenant.id,
        type: 'grace_period_warning',
        gracePeriodDaysRemaining: 28,
      });
      results.twentyEightDays++;
    }

    return results;
  }
}

// Singleton instance
let instance: BillingNotificationService | null = null;

export function getBillingNotificationService(): BillingNotificationService {
  if (!instance) {
    instance = new BillingNotificationService();
  }
  return instance;
}
