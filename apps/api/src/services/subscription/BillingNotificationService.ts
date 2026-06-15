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
import { CrmTaskService } from '../CrmTaskService';
import { CrmAlertService } from '../CrmAlertService';

export type BillingNotificationType = 
  | 'payment_success'
  | 'payment_failed'
  | 'grace_period_warning'
  | 'grace_period_final'
  | 'payment_method_update_reminder'
  | 'payment_method_added'
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
  metadata?: Record<string, any>;
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
      // Get all tenant owner emails
      const owners = await this.getTenantOwners(data.tenantId);
      if (owners.length === 0) {
        console.error(`[BillingNotification] No owner emails found for tenant ${data.tenantId}`);
        // Still log the notification attempt
        await this.logNotification(data, false);
        return false;
      }

      // Send email to each owner
      let anySent = false;
      for (const owner of owners) {
        const emailPayload = await this.buildEmailPayload(owner.email, owner.name, data);
        const sent = await this.sendEmail(emailPayload);
        if (sent) anySent = true;
      }

      // Create CRM alert (tenant-facing notification) — once per event, not per owner
      await this.createSubscriptionCrmAlert(data);

      // Log notification
      await this.logNotification(data, anySent);

      return anySent;
    } catch (error) {
      console.error('[BillingNotification] Error sending notification:', error);
      // Still log the failed attempt
      await this.logNotification(data, false);
      return false;
    }
  }

  /**
   * Get all tenant owner emails
   */
  private async getTenantOwners(tenantId: string): Promise<Array<{ email: string; name: string }>> {
    const owners: Array<{ email: string; name: string }> = [];

    // 1. Get all owner users via user_tenants (the source of truth)
    const ownerUsers = await prisma.users.findMany({
      where: {
        user_tenants: {
          some: { tenant_id: tenantId, role: 'OWNER' }
        }
      },
      select: { email: true, first_name: true, last_name: true }
    });

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { name: true }
    });
    const tenantName = tenant?.name || 'Tenant';

    for (const user of ownerUsers) {
      const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || tenantName;
      owners.push({ email: user.email, name });
    }

    // 2. Include business profile email if it exists and isn't already an owner
    const businessProfile = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id: tenantId },
      select: { email: true, contact_person: true }
    });

    if (businessProfile?.email && !owners.some(o => o.email === businessProfile.email)) {
      owners.push({
        email: businessProfile.email,
        name: businessProfile.contact_person || tenantName
      });
    }

    return owners;
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
          subject: `Action Required: Payment Overdue - ${businessName}`,
          html: this.buildGracePeriodWarningHtml(ownerName, businessName, data),
          text: this.buildGracePeriodWarningText(ownerName, businessName, data),
        };

      case 'grace_period_final':
        return {
          to: toEmail,
          subject: `URGENT: Final Notice - Account Downgrade Tomorrow`,
          html: this.buildGracePeriodFinalHtml(ownerName, businessName, data),
          text: this.buildGracePeriodFinalText(ownerName, businessName, data),
        };

      case 'payment_method_update_reminder':
        return {
          to: toEmail,
          subject: `Reminder: Update Your Payment Method - ${businessName}`,
          html: this.buildPaymentMethodReminderHtml(ownerName, businessName, data),
          text: this.buildPaymentMethodReminderText(ownerName, businessName, data),
        };

      case 'payment_method_added':
        return {
          to: toEmail,
          subject: `Payment Method Added - ${businessName}`,
          html: this.buildPaymentMethodAddedHtml(ownerName, businessName, data),
          text: this.buildPaymentMethodAddedText(ownerName, businessName, data),
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

  // Email templates - Grace Period Final Warning (1 day)
  private buildGracePeriodFinalHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">URGENT: Final Notice</h2>
        <p>Hi ${name},</p>
        <p>This is your final notice. Your subscription for <strong>${business}</strong> will be downgraded <strong>tomorrow</strong>.</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 0; font-size: 18px; color: #dc2626;"><strong>1 DAY REMAINING</strong></p>
          <p style="margin: 8px 0 0; color: #666;">Your account will lose access to paid features tomorrow.</p>
        </div>
        <p><strong>Update your payment method NOW to avoid losing access.</strong></p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/settings/subscription" style="background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Update Payment Now</a>
        </p>
        <p style="margin-top: 24px; color: #666; font-size: 14px;">
          If you believe this is an error, please contact support immediately.
        </p>
      </div>
    `;
  }

  private buildGracePeriodFinalText(name: string, business: string, data: BillingNotificationData): string {
    return `URGENT: Final Notice

Hi ${name},

This is your final notice. Your subscription for ${business} will be downgraded TOMORROW.

1 DAY REMAINING
Your account will lose access to paid features tomorrow.

UPDATE YOUR PAYMENT METHOD NOW to avoid losing access.

Update your payment at: ${process.env.WEB_URL}/settings/subscription

If you believe this is an error, please contact support immediately.`;
  }

  // Email templates - Payment Method Update Reminder
  private buildPaymentMethodReminderHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">Payment Method Reminder</h2>
        <p>Hi ${name},</p>
        <p>This is a friendly reminder to update your payment method for <strong>${business}</strong>.</p>
        <div style="background: #fff7ed; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Current Plan:</strong> ${data.tier || 'N/A'}</p>
          <p style="margin: 8px 0 0;"><strong>Amount Due:</strong> $${((data.amount || 0) / 100).toFixed(2)}</p>
        </div>
        <p>Your previous payment attempt was unsuccessful. Please update your payment details to continue your subscription without interruption.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/settings/subscription" style="background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Method</a>
        </p>
      </div>
    `;
  }

  private buildPaymentMethodReminderText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

This is a friendly reminder to update your payment method for ${business}.

Current Plan: ${data.tier || 'N/A'}
Amount Due: $${((data.amount || 0) / 100).toFixed(2)}

Your previous payment attempt was unsuccessful. Please update your payment details to continue your subscription without interruption.

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

  // Email templates - Payment Method Added
  private buildPaymentMethodAddedHtml(name: string, business: string, data: BillingNotificationData): string {
    const paymentType = data.metadata?.paymentType || 'payment method';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
          <h1>Payment Method Added</h1>
        </div>
        <div style="padding: 30px; background-color: #f9f9f9;">
          <p>Hi ${name},</p>
          <p>Your ${paymentType} has been successfully added to ${business}.</p>
          <p>You can now use this payment method for subscription payments and other transactions.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.WEB_URL || 'https://visibleshelf.com'}/settings/billing/payment-methods" 
               style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Manage Payment Methods
            </a>
          </div>
          <p>Thank you for keeping your payment information up to date!</p>
        </div>
        <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>${business}</p>
          <p>If you didn't add this payment method, please contact support immediately.</p>
        </div>
      </div>
    `;
  }

  /**
   * Create a CRM task for a critical subscription event.
   * This surfaces subscription issues as actionable tasks in the tenant's CRM dashboard,
   * providing an equal alternative channel to email notifications.
   */
  async createSubscriptionCrmTask(data: BillingNotificationData): Promise<void> {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: data.tenantId },
        select: { name: true },
      });
      const tenantName = tenant?.name || data.tenantId;

      const { title, description, priority, dueDate } = this.buildCrmTaskPayload(data, tenantName);

      const taskService = CrmTaskService.getInstance();
      await taskService.create({
        tenant_id: data.tenantId,
        title,
        description,
        priority,
        due_date: dueDate,
        created_by: 'system-subscription-job',
      });

      console.log(`[BillingNotification] CRM task created for tenant ${data.tenantId}: ${title}`);
    } catch (error) {
      console.error('[BillingNotification] Failed to create CRM task:', error);
    }
  }

  private buildCrmTaskPayload(
    data: BillingNotificationData,
    tenantName: string,
  ): { title: string; description: string; priority: string; dueDate?: Date } {
    const billingUrl = `${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/billing/payment-methods`;

    switch (data.type) {
      case 'trial_payment_failed':
      case 'payment_failed':
        return {
          title: `Payment failed — ${tenantName} entered grace period`,
          description: `Tenant "${tenantName}" failed to complete payment and has entered the grace period. A payment method needs to be added or updated.\n\nBilling settings: ${billingUrl}`,
          priority: 'high',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        };

      case 'grace_period_warning': {
        const daysLeft = data.gracePeriodDaysRemaining ?? 0;
        const daysPast = 30 - daysLeft; // grace period is 30 days total
        return {
          title: `Grace period warning (${daysPast}d past due) — ${tenantName}`,
          description: `Tenant "${tenantName}" is ${daysPast} days past due with ${daysLeft} days remaining in grace period. No payment method on file.\n\nBilling settings: ${billingUrl}`,
          priority: daysLeft <= 7 ? 'urgent' : 'high',
          dueDate: new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000),
        };
      }

      case 'grace_period_final':
        return {
          title: `Final grace period notice — ${tenantName}`,
          description: `Tenant "${tenantName}" is nearing the end of the grace period. Subscription will be canceled if payment is not resolved.\n\nBilling settings: ${billingUrl}`,
          priority: 'urgent',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        };

      case 'subscription_canceled':
        return {
          title: `Subscription canceled — ${tenantName} demoted to expired_trial`,
          description: `Tenant "${tenantName}" has been demoted to expired_trial after grace period expiry. Reason: ${data.reason || 'Grace period expired'}. The tenant is now invisible on public pages.\n\nIf the tenant adds a payment method, the subscription can be reactivated.\n\nBilling settings: ${billingUrl}`,
          priority: 'urgent',
        };

      case 'trial_expired':
        return {
          title: `Trial expired — ${tenantName}`,
          description: `Tenant "${tenantName}" trial has expired without conversion. The tenant has been demoted.\n\nBilling settings: ${billingUrl}`,
          priority: 'high',
        };

      default:
        return {
          title: `Subscription event: ${data.type} — ${tenantName}`,
          description: `Subscription event "${data.type}" for tenant "${tenantName}".`,
          priority: 'medium',
        };
    }
  }

  /**
   * Create a CRM alert for a billing/subscription event.
   * This surfaces subscription issues as tenant-facing alerts in the CRM dashboard.
   */
  private async createSubscriptionCrmAlert(data: BillingNotificationData): Promise<void> {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: data.tenantId },
        select: { name: true },
      });
      const tenantName = tenant?.name || data.tenantId;

      const { title, body, icon } = this.buildCrmAlertPayload(data, tenantName);

      const alertService = CrmAlertService.getInstance();
      await alertService.create({
        tenant_id: data.tenantId,
        type: 'subscription',
        title,
        body,
        icon,
        metadata: {
          notification_type: data.type,
          ...(data.gracePeriodDaysRemaining !== undefined ? { grace_period_days_remaining: data.gracePeriodDaysRemaining } : {}),
          ...(data.reason ? { reason: data.reason } : {}),
          ...(data.tier ? { tier: data.tier } : {}),
        },
      });

      console.log(`[BillingNotification] CRM alert created for tenant ${data.tenantId}: ${title}`);
    } catch (error) {
      console.error('[BillingNotification] Failed to create CRM alert:', error);
    }
  }

  private buildCrmAlertPayload(
    data: BillingNotificationData,
    tenantName: string,
  ): { title: string; body: string; icon: string } {
    switch (data.type) {
      case 'payment_success':
        return {
          title: 'Payment successful',
          body: `Your payment for ${tenantName} was processed successfully.`,
          icon: '💳',
        };
      case 'payment_failed':
        return {
          title: 'Payment failed',
          body: `We were unable to process your payment for ${tenantName}. Please update your payment method to avoid service interruption.`,
          icon: '⚠️',
        };
      case 'grace_period_warning': {
        const days = data.gracePeriodDaysRemaining ?? 0;
        return {
          title: 'Payment overdue',
          body: `Your subscription payment for ${tenantName} is overdue. ${days} day${days === 1 ? '' : 's'} remaining in grace period. Update your payment method to maintain your current plan.`,
          icon: '⏳',
        };
      }
      case 'grace_period_final':
        return {
          title: 'Final notice: payment overdue',
          body: `Your subscription for ${tenantName} will be downgraded tomorrow if payment is not received. Update your payment method now to avoid losing access.`,
          icon: '🚨',
        };
      case 'payment_method_update_reminder':
        return {
          title: 'Update payment method',
          body: `Please update your payment method for ${tenantName} to avoid subscription interruption.`,
          icon: '💳',
        };
      case 'payment_method_added':
        return {
          title: 'Payment method added',
          body: `A new payment method has been added to ${tenantName}.`,
          icon: '✅',
        };
      case 'subscription_canceled':
        return {
          title: 'Subscription canceled',
          body: `Your subscription for ${tenantName} has been canceled. You can reactivate your subscription at any time.`,
          icon: '❌',
        };
      case 'subscription_reactivated':
        return {
          title: 'Subscription reactivated',
          body: `Your subscription for ${tenantName} has been reactivated. Welcome back!`,
          icon: '✅',
        };
      case 'tier_changed':
        return {
          title: 'Plan updated',
          body: `Your subscription plan for ${tenantName} has been updated.`,
          icon: '📋',
        };
      case 'trial_started':
        return {
          title: 'Trial started',
          body: `Your trial for ${tenantName} has started. Enjoy exploring the platform!`,
          icon: '🚀',
        };
      case 'trial_converted':
        return {
          title: 'Trial converted',
          body: `Your trial for ${tenantName} has been converted to a paid subscription. Thank you!`,
          icon: '🎉',
        };
      case 'trial_payment_failed':
        return {
          title: 'Trial payment failed',
          body: `We could not process your payment for ${tenantName}. Please update your payment method to continue.`,
          icon: '⚠️',
        };
      case 'trial_expired':
        return {
          title: 'Trial expired',
          body: `Your trial for ${tenantName} has expired. Upgrade to a paid plan to continue using all features.`,
          icon: '⌛',
        };
      default:
        return {
          title: 'Subscription update',
          body: `Your subscription for ${tenantName} has been updated.`,
          icon: '📋',
        };
    }
  }

  private buildPaymentMethodAddedText(name: string, business: string, data: BillingNotificationData): string {
    const paymentType = data.metadata?.paymentType || 'payment method';
    return `
Hi ${name},

Your ${paymentType} has been successfully added to ${business}.

You can now use this payment method for subscription payments and other transactions.

Manage your payment methods at: ${process.env.WEB_URL || 'https://visibleshelf.com'}/settings/billing/payment-methods

Thank you for keeping your payment information up to date!

${business}
If you didn't add this payment method, please contact support immediately.
    `.trim();
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
