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
import { logger } from '../../logger';

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
  | 'trial_expired'
  | 'bsaas_purchase_success'
  | 'bsaas_renewal_success'
  | 'bsaas_renewal_failed'
  | 'bsaas_grace_period_warning'
  | 'bsaas_trial_started'
  | 'bsaas_purchase_cancelled'
  | 'featured_placement_purchased'
  | 'featured_placement_renewal_success'
  | 'featured_placement_renewal_failed'
  | 'featured_placement_grace_period_warning'
  | 'featured_placement_expired'
  | 'directory_promotion_purchased'
  | 'directory_promotion_renewal_success'
  | 'directory_promotion_renewal_failed'
  | 'directory_promotion_grace_period_warning'
  | 'directory_promotion_expired'
  | 'policy_template_updated'
  | 'platform_service_delivered'
  | 'funnel_builder_purchased'
  | 'funnel_builder_renewal_success'
  | 'funnel_builder_renewal_failed'
  | 'funnel_builder_expired'
  | 'funnel_step_conversion';

export interface BillingNotificationData {
  tenantId: string;
  type: BillingNotificationType;
  tier?: string;
  amount?: number;
  billingCycle?: 'weekly' | 'monthly' | 'annual';
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
        logger.error(`[BillingNotification] No owner emails found for tenant ${data.tenantId}`, undefined);
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
      logger.error('[BillingNotification] Error sending notification:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

      case 'bsaas_purchase_success':
        return {
          to: toEmail,
          subject: `Feature Purchased - ${data.metadata?.featureName || 'Feature'} - ${businessName}`,
          html: this.buildBsaasPurchaseSuccessHtml(ownerName, businessName, data),
          text: this.buildBsaasPurchaseSuccessText(ownerName, businessName, data),
        };

      case 'bsaas_renewal_success':
        return {
          to: toEmail,
          subject: `Feature Renewed - ${data.metadata?.featureName || 'Feature'} - ${businessName}`,
          html: this.buildBsaasRenewalSuccessHtml(ownerName, businessName, data),
          text: this.buildBsaasRenewalSuccessText(ownerName, businessName, data),
        };

      case 'bsaas_renewal_failed':
        return {
          to: toEmail,
          subject: `Payment Failed: Feature Renewal - ${data.metadata?.featureName || 'Feature'} - ${businessName}`,
          html: this.buildBsaasRenewalFailedHtml(ownerName, businessName, data),
          text: this.buildBsaasRenewalFailedText(ownerName, businessName, data),
        };

      case 'bsaas_purchase_cancelled':
        return {
          to: toEmail,
          subject: `Feature Cancelled - ${data.metadata?.featureName || 'Feature'} - ${businessName}`,
          html: this.buildBsaasCancelledHtml(ownerName, businessName, data),
          text: this.buildBsaasCancelledText(ownerName, businessName, data),
        };

      case 'bsaas_grace_period_warning':
        return {
          to: toEmail,
          subject: `Action Required: Payment Retry in ${data.gracePeriodDaysRemaining} days - ${data.metadata?.featureName || 'Feature'} - ${businessName}`,
          html: this.buildBsaasGracePeriodHtml(ownerName, businessName, data),
          text: this.buildBsaasGracePeriodText(ownerName, businessName, data),
        };

      case 'bsaas_trial_started':
        return {
          to: toEmail,
          subject: `Free Trial Started - ${data.metadata?.featureName || 'Feature'} - ${businessName}`,
          html: this.buildBsaasTrialStartedHtml(ownerName, businessName, data),
          text: this.buildBsaasTrialStartedText(ownerName, businessName, data),
        };

      case 'featured_placement_purchased':
        return {
          to: toEmail,
          subject: `Featured Placement Active - ${data.metadata?.planLabel || data.metadata?.planKey || 'Placement'} - ${businessName}`,
          html: this.buildFeaturedPlacementPurchasedHtml(ownerName, businessName, data),
          text: this.buildFeaturedPlacementPurchasedText(ownerName, businessName, data),
        };

      case 'featured_placement_renewal_success':
        return {
          to: toEmail,
          subject: `Featured Placement Renewed - ${data.metadata?.planLabel || data.metadata?.planKey || 'Placement'} - ${businessName}`,
          html: this.buildFeaturedPlacementRenewalSuccessHtml(ownerName, businessName, data),
          text: this.buildFeaturedPlacementRenewalSuccessText(ownerName, businessName, data),
        };

      case 'featured_placement_renewal_failed':
        return {
          to: toEmail,
          subject: `Payment Failed: Featured Placement Renewal - ${data.metadata?.planLabel || data.metadata?.planKey || 'Placement'} - ${businessName}`,
          html: this.buildFeaturedPlacementRenewalFailedHtml(ownerName, businessName, data),
          text: this.buildFeaturedPlacementRenewalFailedText(ownerName, businessName, data),
        };

      case 'featured_placement_grace_period_warning':
        return {
          to: toEmail,
          subject: `Action Required: Featured Placement Grace Period - ${data.metadata?.planLabel || data.metadata?.planKey || 'Placement'} - ${businessName}`,
          html: this.buildFeaturedPlacementGracePeriodHtml(ownerName, businessName, data),
          text: this.buildFeaturedPlacementGracePeriodText(ownerName, businessName, data),
        };

      case 'featured_placement_expired':
        return {
          to: toEmail,
          subject: `Featured Placement Expired - ${data.metadata?.planLabel || data.metadata?.planKey || 'Placement'} - ${businessName}`,
          html: this.buildFeaturedPlacementExpiredHtml(ownerName, businessName, data),
          text: this.buildFeaturedPlacementExpiredText(ownerName, businessName, data),
        };

      case 'directory_promotion_purchased':
        return {
          to: toEmail,
          subject: `Directory Promotion Active - ${data.metadata?.tierLabel || data.metadata?.tier || 'Promotion'} - ${businessName}`,
          html: this.buildDirectoryPromotionPurchasedHtml(ownerName, businessName, data),
          text: this.buildDirectoryPromotionPurchasedText(ownerName, businessName, data),
        };

      case 'directory_promotion_renewal_success':
        return {
          to: toEmail,
          subject: `Directory Promotion Renewed - ${data.metadata?.tierLabel || data.metadata?.tier || 'Promotion'} - ${businessName}`,
          html: this.buildDirectoryPromotionRenewalSuccessHtml(ownerName, businessName, data),
          text: this.buildDirectoryPromotionRenewalSuccessText(ownerName, businessName, data),
        };

      case 'directory_promotion_renewal_failed':
        return {
          to: toEmail,
          subject: `Payment Failed: Directory Promotion Renewal - ${data.metadata?.tierLabel || data.metadata?.tier || 'Promotion'} - ${businessName}`,
          html: this.buildDirectoryPromotionRenewalFailedHtml(ownerName, businessName, data),
          text: this.buildDirectoryPromotionRenewalFailedText(ownerName, businessName, data),
        };

      case 'directory_promotion_grace_period_warning':
        return {
          to: toEmail,
          subject: `Action Required: Directory Promotion Grace Period - ${data.metadata?.tierLabel || data.metadata?.tier || 'Promotion'} - ${businessName}`,
          html: this.buildDirectoryPromotionGracePeriodHtml(ownerName, businessName, data),
          text: this.buildDirectoryPromotionGracePeriodText(ownerName, businessName, data),
        };

      case 'directory_promotion_expired':
        return {
          to: toEmail,
          subject: `Directory Promotion Expired - ${data.metadata?.tierLabel || data.metadata?.tier || 'Promotion'} - ${businessName}`,
          html: this.buildDirectoryPromotionExpiredHtml(ownerName, businessName, data),
          text: this.buildDirectoryPromotionExpiredText(ownerName, businessName, data),
        };

      case 'policy_template_updated':
        return {
          to: toEmail,
          subject: `Policy Template Update Available - ${data.metadata?.templateTitle || 'Template'} - ${businessName}`,
          html: this.buildPolicyTemplateUpdatedHtml(ownerName, businessName, data),
          text: this.buildPolicyTemplateUpdatedText(ownerName, businessName, data),
        };

      case 'platform_service_delivered':
        return {
          to: toEmail,
          subject: `Service Delivered - ${data.metadata?.serviceName || 'Platform Service'} - ${businessName}`,
          html: this.buildPlatformServiceDeliveredHtml(ownerName, businessName, data),
          text: this.buildPlatformServiceDeliveredText(ownerName, businessName, data),
        };

      case 'funnel_builder_purchased':
        return {
          to: toEmail,
          subject: `Sales Funnel Builder Activated - ${businessName}`,
          html: this.buildFunnelBuilderPurchasedHtml(ownerName, businessName, data),
          text: this.buildFunnelBuilderPurchasedText(ownerName, businessName, data),
        };

      case 'funnel_builder_renewal_success':
        return {
          to: toEmail,
          subject: `Sales Funnel Builder Renewed - ${businessName}`,
          html: this.buildFunnelBuilderRenewalSuccessHtml(ownerName, businessName, data),
          text: this.buildFunnelBuilderRenewalSuccessText(ownerName, businessName, data),
        };

      case 'funnel_builder_renewal_failed':
        return {
          to: toEmail,
          subject: `Sales Funnel Builder Renewal Failed - ${businessName}`,
          html: this.buildFunnelBuilderRenewalFailedHtml(ownerName, businessName, data),
          text: this.buildFunnelBuilderRenewalFailedText(ownerName, businessName, data),
        };

      case 'funnel_builder_expired':
        return {
          to: toEmail,
          subject: `Sales Funnel Builder Expired - ${businessName}`,
          html: this.buildFunnelBuilderExpiredHtml(ownerName, businessName, data),
          text: this.buildFunnelBuilderExpiredText(ownerName, businessName, data),
        };

      case 'funnel_step_conversion':
        return {
          to: toEmail,
          subject: `Funnel Conversion - ${data.metadata?.funnelName || businessName}`,
          html: this.buildFunnelStepConversionHtml(ownerName, businessName, data),
          text: this.buildFunnelStepConversionText(ownerName, businessName, data),
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
          ${data.amount ? `<p style="margin: 8px 0 0;"><strong>Amount:</strong> $${(data.amount / 100).toFixed(2)}/${data.billingCycle === 'annual' ? 'year' : data.billingCycle === 'weekly' ? 'week' : 'month'}</p>` : ''}
        </div>
        <p>Your new plan is now active.</p>
      </div>
    `;
  }

  private buildTierChangedText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

Your subscription for ${business} has been updated.

New Plan: ${data.tier || 'N/A'}
${data.amount ? `Amount: $${(data.amount / 100).toFixed(2)}/${data.billingCycle === 'annual' ? 'year' : data.billingCycle === 'weekly' ? 'week' : 'month'}` : ''}

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
        logger.error('[BillingNotification] Resend error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
      logger.error('[BillingNotification] Failed to log notification:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
      logger.error('[BillingNotification] Failed to create CRM task:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

      case 'bsaas_purchase_success':
        return {
          title: `Feature purchased: ${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'} — ${tenantName}`,
          description: `Tenant "${tenantName}" purchased the "${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'}" feature for $${((data.amount || 0) / 100).toFixed(2)} (${data.billingCycle || 'monthly'}). Public storefront and directory updates may take up to 10 minutes to reflect this change.\n\nFeature Store: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/feature-store`,
          priority: 'low',
        };

      case 'bsaas_renewal_success':
        return {
          title: `Feature renewed: ${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'} — ${tenantName}`,
          description: `Feature "${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'}" was renewed for tenant "${tenantName}". Charged $${((data.amount || 0) / 100).toFixed(2)}.\n\nFeature Store: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/feature-store`,
          priority: 'low',
        };

      case 'bsaas_renewal_failed':
        return {
          title: `Feature renewal payment failed: ${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'} — ${tenantName}`,
          description: `Payment failed for renewal of feature "${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'}" for tenant "${tenantName}". The feature has been suspended. Reason: ${data.reason || 'Payment declined'}.\n\nBilling settings: ${billingUrl}`,
          priority: 'high',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };

      case 'bsaas_purchase_cancelled':
        return {
          title: `Feature cancelled: ${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'} — ${tenantName}`,
          description: `Feature "${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'}" was cancelled for tenant "${tenantName}". The feature will remain active until the current billing period ends.\n\nFeature Store: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/feature-store`,
          priority: 'medium',
        };

      case 'bsaas_grace_period_warning':
        return {
          title: `Feature renewal grace period: ${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'} — ${tenantName}`,
          description: `Payment failed for renewal of feature "${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'}" for tenant "${tenantName}". The feature is in a ${data.gracePeriodDaysRemaining || 7}-day grace period. Reason: ${data.reason || 'Payment declined'}.\n\nBilling settings: ${billingUrl}`,
          priority: 'high',
          dueDate: new Date(Date.now() + (data.gracePeriodDaysRemaining || 7) * 24 * 60 * 60 * 1000),
        };

      case 'bsaas_trial_started':
        return {
          title: `Feature trial started: ${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'} — ${tenantName}`,
          description: `Tenant "${tenantName}" started a ${data.metadata?.trialDays || 0}-day free trial for feature "${data.metadata?.featureName || data.metadata?.featureKey || 'Unknown'}". No charge until trial ends. Public storefront and directory updates may take up to 10 minutes to reflect this change.\n\nFeature Store: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/feature-store`,
          priority: 'low',
        };

      case 'funnel_builder_purchased':
        return {
          title: `Sales Funnel Builder purchased — ${tenantName}`,
          description: `Tenant "${tenantName}" activated the Sales Funnel Builder add-on. Funnel builder: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/funnels`,
          priority: 'low',
        };

      case 'funnel_builder_renewal_success':
        return {
          title: `Sales Funnel Builder renewed — ${tenantName}`,
          description: `Tenant "${tenantName}" renewed the Sales Funnel Builder add-on. Amount: $${((data.amount || 0) / 100).toFixed(2)}.`,
          priority: 'low',
        };

      case 'funnel_builder_renewal_failed':
        return {
          title: `Sales Funnel Builder renewal failed — ${tenantName}`,
          description: `Tenant "${tenantName}" Sales Funnel Builder renewal failed. Reason: ${data.reason || 'Payment declined'}. Funnels will be paused after the grace period.\n\nBilling settings: ${billingUrl}`,
          priority: 'high',
          dueDate: new Date(Date.now() + (data.gracePeriodDaysRemaining || 7) * 24 * 60 * 60 * 1000),
        };

      case 'funnel_builder_expired':
        return {
          title: `Sales Funnel Builder expired — ${tenantName}`,
          description: `Tenant "${tenantName}" Sales Funnel Builder add-on has expired. Funnels are now paused.\n\nRenew: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/feature-store`,
          priority: 'medium',
        };

      case 'funnel_step_conversion':
        return {
          title: `Funnel conversion — ${tenantName}`,
          description: `A customer accepted a ${data.metadata?.stepType || 'funnel'} offer in "${data.metadata?.funnelName || 'Funnel'}". Additional revenue: $${((data.amount || 0) / 100).toFixed(2)}.`,
          priority: 'low',
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
      logger.error('[BillingNotification] Failed to create CRM alert:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
      case 'bsaas_purchase_success':
        return {
          title: 'Feature purchased',
          body: `You purchased "${data.metadata?.featureName || data.metadata?.featureKey || 'a feature'}" for ${tenantName}. It is now active. Public storefront and directory updates may take up to 10 minutes to reflect this change.`,
          icon: '⚡',
        };
      case 'bsaas_renewal_success':
        return {
          title: 'Feature renewed',
          body: `Your feature "${data.metadata?.featureName || data.metadata?.featureKey || 'a feature'}" for ${tenantName} was renewed successfully.`,
          icon: '✅',
        };
      case 'bsaas_renewal_failed':
        return {
          title: 'Feature renewal payment failed',
          body: `We could not process payment for "${data.metadata?.featureName || data.metadata?.featureKey || 'a feature'}" on ${tenantName}. The feature has been suspended. Please update your payment method.`,
          icon: '⚠️',
        };
      case 'bsaas_purchase_cancelled':
        return {
          title: 'Feature cancelled',
          body: `You cancelled "${data.metadata?.featureName || data.metadata?.featureKey || 'a feature'}" for ${tenantName}. It will remain active until the current billing period ends.`,
          icon: '❌',
        };
      case 'bsaas_grace_period_warning':
        return {
          title: 'Feature renewal payment failed — grace period active',
          body: `We could not process payment for "${data.metadata?.featureName || data.metadata?.featureKey || 'a feature'}" on ${tenantName}. You have ${data.gracePeriodDaysRemaining || 7} days to update your payment method before the feature is suspended.`,
          icon: '⏰',
        };
      case 'bsaas_trial_started':
        return {
          title: 'Free trial started',
          body: `You started a ${data.metadata?.trialDays || 0}-day free trial for "${data.metadata?.featureName || data.metadata?.featureKey || 'a feature'}" on ${tenantName}. No charge until the trial ends. Public storefront and directory updates may take up to 10 minutes to reflect this change.`,
          icon: '🎁',
        };
      case 'featured_placement_purchased':
        return {
          title: 'Featured placement is live',
          body: `Your featured placement "${data.metadata?.planLabel || data.metadata?.planKey || 'Placement'}" for ${tenantName} is now active. ${data.metadata?.durationDays || 0}-day placement expires on ${data.metadata?.expiresAt || 'soon'}. Public storefront and directory updates may take up to 10 minutes to reflect this change.`,
          icon: '🎉',
        };
      case 'featured_placement_renewal_success':
        return {
          title: 'Featured placement renewed',
          body: `Your featured placement "${data.metadata?.planLabel || data.metadata?.planKey || 'Placement'}" for ${tenantName} was renewed successfully.`,
          icon: '✅',
        };
      case 'featured_placement_renewal_failed':
        return {
          title: 'Featured placement renewal payment failed',
          body: `We could not process payment for "${data.metadata?.planLabel || data.metadata?.planKey || 'Placement'}" on ${tenantName}. Please update your payment method.`,
          icon: '⚠️',
        };
      case 'featured_placement_grace_period_warning':
        return {
          title: 'Featured placement grace period warning',
          body: `Payment for "${data.metadata?.planLabel || data.metadata?.planKey || 'Placement'}" on ${tenantName} failed. ${data.gracePeriodDaysRemaining || 7} days remaining in grace period to update your payment method.`,
          icon: '⏰',
        };
      case 'featured_placement_expired':
        return {
          title: 'Featured placement expired',
          body: `Your featured placement "${data.metadata?.planLabel || data.metadata?.planKey || 'Placement'}" for ${tenantName} has expired. The product is no longer in the spotlight channel.`,
          icon: '⌛',
        };
      case 'directory_promotion_purchased':
        return {
          title: 'Directory promotion activated',
          body: `Directory promotion "${data.metadata?.tierLabel || data.metadata?.tier || 'Promotion'}" for ${tenantName} is now active. Your store will be highlighted in the directory${data.metadata?.expiresAt ? ` until ${new Date(data.metadata.expiresAt).toLocaleDateString()}` : ''}. Public storefront and directory updates may take up to 10 minutes to reflect this change.`,
          icon: '📍',
        };
      case 'directory_promotion_renewal_success':
        return {
          title: 'Directory promotion renewed',
          body: `Directory promotion "${data.metadata?.tierLabel || data.metadata?.tier || 'Promotion'}" for ${tenantName} has been renewed${data.metadata?.expiresAt ? ` until ${new Date(data.metadata.expiresAt).toLocaleDateString()}` : ''}.`,
          icon: '📍',
        };
      case 'directory_promotion_renewal_failed':
        return {
          title: 'Directory promotion renewal payment failed',
          body: `Payment for directory promotion "${data.metadata?.tierLabel || data.metadata?.tier || 'Promotion'}" on ${tenantName} failed. ${data.gracePeriodDaysRemaining || 7} days remaining to update your payment method.`,
          icon: '⚠️',
        };
      case 'directory_promotion_grace_period_warning':
        return {
          title: 'Directory promotion grace period warning',
          body: `Payment for directory promotion "${data.metadata?.tierLabel || data.metadata?.tier || 'Promotion'}" on ${tenantName} failed. ${data.gracePeriodDaysRemaining || 7} days remaining in grace period to update your payment method.`,
          icon: '⏰',
        };
      case 'directory_promotion_expired':
        return {
          title: 'Directory promotion expired',
          body: `Directory promotion "${data.metadata?.tierLabel || data.metadata?.tier || 'Promotion'}" for ${tenantName} has expired. Your store is no longer highlighted in the directory.`,
          icon: '⌛',
        };
      case 'policy_template_updated':
        return {
          title: 'Policy template update available',
          body: `A policy template you used for ${tenantName} has been updated. Template: "${data.metadata?.templateTitle || 'Policy'}" — version ${data.metadata?.appliedVersion || '?'} → ${data.metadata?.currentVersion || '?'}. Review and update your policies to stay compliant.`,
          icon: '📋',
        };
      case 'platform_service_delivered':
        return {
          title: `Service delivered: ${data.metadata?.serviceName || 'Platform Service'}`,
          body: `Your "${data.metadata?.serviceName || 'platform service'}" for ${tenantName} has been delivered. You can view the details and any deliverables in your CRM portal.`,
          icon: '✅',
        };
      case 'funnel_builder_purchased':
        return {
          title: 'Sales Funnel Builder activated',
          body: `Your Sales Funnel Builder add-on for ${tenantName} is now active. Create funnels to increase average order value.`,
          icon: '🚀',
        };
      case 'funnel_builder_renewal_success':
        return {
          title: 'Sales Funnel Builder renewed',
          body: `Your Sales Funnel Builder add-on for ${tenantName} was renewed successfully.`,
          icon: '✅',
        };
      case 'funnel_builder_renewal_failed':
        return {
          title: 'Sales Funnel Builder renewal failed',
          body: `We could not process payment for Sales Funnel Builder on ${tenantName}. Please update your payment method before the grace period ends.`,
          icon: '⚠️',
        };
      case 'funnel_builder_expired':
        return {
          title: 'Sales Funnel Builder expired',
          body: `Your Sales Funnel Builder add-on for ${tenantName} has expired. Your funnels are paused until you renew.`,
          icon: '⏰',
        };
      case 'funnel_step_conversion':
        return {
          title: 'Funnel conversion',
          body: `A customer accepted a ${data.metadata?.stepType || 'funnel'} offer in "${data.metadata?.funnelName || 'Funnel'}" for ${tenantName}. Additional revenue: $${((data.amount || 0) / 100).toFixed(2)}.`,
          icon: '💰',
        };
      default:
        return {
          title: 'Subscription update',
          body: `Your subscription for ${tenantName} has been updated.`,
          icon: '📋',
        };
    }
  }

  // Email templates - BSaaS Purchase Success
  private buildBsaasPurchaseSuccessHtml(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Feature Purchased</h2>
        <p>Hi ${name},</p>
        <p>You've successfully purchased <strong>${featureName}</strong> for <strong>${business}</strong>.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Feature:</strong> ${featureName}</p>
          <p style="margin: 8px 0 0;"><strong>Price:</strong> $${((data.amount || 0) / 100).toFixed(2)} (${data.billingCycle || 'monthly'})</p>
        </div>
        <p>The feature is now active and ready to use.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/feature-store" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Manage Features</a>
        </p>
      </div>
    `;
  }

  private buildBsaasPurchaseSuccessText(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    return `Hi ${name},

You've successfully purchased ${featureName} for ${business}.

Feature: ${featureName}
Price: $${((data.amount || 0) / 100).toFixed(2)} (${data.billingCycle || 'monthly'})

The feature is now active and ready to use.

Manage your features at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/feature-store`;
  }

  // Email templates - BSaaS Renewal Success
  private buildBsaasRenewalSuccessHtml(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Feature Renewed</h2>
        <p>Hi ${name},</p>
        <p>Your feature <strong>${featureName}</strong> for <strong>${business}</strong> has been renewed successfully.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Feature:</strong> ${featureName}</p>
          <p style="margin: 8px 0 0;"><strong>Amount:</strong> $${((data.amount || 0) / 100).toFixed(2)}</p>
        </div>
        <p>Your feature remains active.</p>
      </div>
    `;
  }

  private buildBsaasRenewalSuccessText(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    return `Hi ${name},

Your feature ${featureName} for ${business} has been renewed successfully.

Feature: ${featureName}
Amount: $${((data.amount || 0) / 100).toFixed(2)}

Your feature remains active.`;
  }

  // Email templates - BSaaS Renewal Failed
  private buildBsaasRenewalFailedHtml(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Feature Renewal Payment Failed</h2>
        <p>Hi ${name},</p>
        <p>We were unable to process payment for <strong>${featureName}</strong> on <strong>${business}</strong>.</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Reason:</strong> ${data.reason || 'Payment method declined'}</p>
        </div>
        <p>The feature has been <strong>suspended</strong>. Please update your payment method to restore access.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/subscription" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Method</a>
        </p>
      </div>
    `;
  }

  private buildBsaasRenewalFailedText(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    return `Hi ${name},

We were unable to process payment for ${featureName} on ${business}.

Reason: ${data.reason || 'Payment method declined'}

The feature has been suspended. Please update your payment method to restore access.

Update your payment method at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/subscription`;
  }

  // Email templates - BSaaS Purchase Cancelled
  private buildBsaasCancelledHtml(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6b7280;">Feature Cancelled</h2>
        <p>Hi ${name},</p>
        <p>You've cancelled <strong>${featureName}</strong> for <strong>${business}</strong>.</p>
        <p>The feature will remain active until the end of the current billing period, then will be deactivated.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/feature-store" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Browse Features</a>
        </p>
      </div>
    `;
  }

  private buildBsaasCancelledText(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    return `Hi ${name},

You've cancelled ${featureName} for ${business}.

The feature will remain active until the end of the current billing period, then will be deactivated.

Browse features at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/feature-store`;
  }

  // Email templates - BSaaS Grace Period Warning
  private buildBsaasGracePeriodHtml(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    const daysLeft = data.gracePeriodDaysRemaining || 7;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Payment Retry Needed</h2>
        <p>Hi ${name},</p>
        <p>We were unable to process payment for <strong>${featureName}</strong> on <strong>${business}</strong>.</p>
        <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fde68a;">
          <p style="margin: 0;"><strong>Feature:</strong> ${featureName}</p>
          <p style="margin: 8px 0 0;"><strong>Grace period:</strong> ${daysLeft} days remaining</p>
          <p style="margin: 8px 0 0;"><strong>Reason:</strong> ${data.reason || 'Payment declined'}</p>
        </div>
        <p>The feature is still active, but will be <strong>suspended in ${daysLeft} days</strong> if payment is not updated.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/subscription" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Method</a>
        </p>
      </div>
    `;
  }

  private buildBsaasGracePeriodText(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    const daysLeft = data.gracePeriodDaysRemaining || 7;
    return `Hi ${name},

We were unable to process payment for ${featureName} on ${business}.

The feature is still active, but will be suspended in ${daysLeft} days if payment is not updated.

Reason: ${data.reason || 'Payment declined'}

Update your payment method at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/subscription`;
  }

  // Email templates - BSaaS Trial Started
  private buildBsaasTrialStartedHtml(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    const trialDays = data.metadata?.trialDays || 0;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Free Trial Started</h2>
        <p>Hi ${name},</p>
        <p>You've started a <strong>${trialDays}-day free trial</strong> of <strong>${featureName}</strong> for <strong>${business}</strong>.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Feature:</strong> ${featureName}</p>
          <p style="margin: 8px 0 0;"><strong>Trial length:</strong> ${trialDays} days</p>
          <p style="margin: 8px 0 0;"><strong>Price after trial:</strong> $${((data.amount || 0) / 100).toFixed(2)} (${data.billingCycle || 'monthly'})</p>
        </div>
        <p>The feature is now active. You won't be charged until the trial ends. Add a payment method to ensure uninterrupted service after the trial.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/subscription" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Add Payment Method</a>
        </p>
      </div>
    `;
  }

  private buildBsaasTrialStartedText(name: string, business: string, data: BillingNotificationData): string {
    const featureName = data.metadata?.featureName || data.metadata?.featureKey || 'Feature';
    const trialDays = data.metadata?.trialDays || 0;
    return `Hi ${name},

You've started a ${trialDays}-day free trial of ${featureName} for ${business}.

The feature is now active. You won't be charged until the trial ends.

Price after trial: $${((data.amount || 0) / 100).toFixed(2)} (${data.billingCycle || 'monthly'})

Add a payment method at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/subscription`;
  }

  // Email templates - Featured Placement Purchased
  private buildFeaturedPlacementPurchasedHtml(name: string, business: string, data: BillingNotificationData): string {
    const planLabel = data.metadata?.planLabel || data.metadata?.planKey || 'Featured Placement';
    const durationDays = data.metadata?.durationDays || 0;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Featured Placement is Live!</h2>
        <p>Hi ${name},</p>
        <p>Your featured placement <strong>${planLabel}</strong> for <strong>${business}</strong> is now active.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Plan:</strong> ${planLabel}</p>
          <p style="margin: 8px 0 0;"><strong>Duration:</strong> ${durationDays} days</p>
          <p style="margin: 8px 0 0;"><strong>Amount:</strong> $${((data.amount || 0) / 100).toFixed(2)}</p>
        </div>
        <p>Your product is now featured in the spotlight channel. It will remain featured for ${durationDays} days.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/featured-store" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Manage Placements</a>
        </p>
      </div>
    `;
  }

  private buildFeaturedPlacementPurchasedText(name: string, business: string, data: BillingNotificationData): string {
    const planLabel = data.metadata?.planLabel || data.metadata?.planKey || 'Featured Placement';
    const durationDays = data.metadata?.durationDays || 0;
    return `Hi ${name},

Your featured placement ${planLabel} for ${business} is now active.

Plan: ${planLabel}
Duration: ${durationDays} days
Amount: $${((data.amount || 0) / 100).toFixed(2)}

Your product is now featured in the spotlight channel.

Manage placements at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/featured-store`;
  }

  // Email templates - Featured Placement Renewal Success
  private buildFeaturedPlacementRenewalSuccessHtml(name: string, business: string, data: BillingNotificationData): string {
    const planLabel = data.metadata?.planLabel || data.metadata?.planKey || 'Featured Placement';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Featured Placement Renewed</h2>
        <p>Hi ${name},</p>
        <p>Your featured placement <strong>${planLabel}</strong> for <strong>${business}</strong> has been renewed successfully.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Plan:</strong> ${planLabel}</p>
          <p style="margin: 8px 0 0;"><strong>Amount:</strong> $${((data.amount || 0) / 100).toFixed(2)}</p>
        </div>
        <p>Your product remains featured in the spotlight channel.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/featured-store" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Manage Placements</a>
        </p>
      </div>
    `;
  }

  private buildFeaturedPlacementRenewalSuccessText(name: string, business: string, data: BillingNotificationData): string {
    const planLabel = data.metadata?.planLabel || data.metadata?.planKey || 'Featured Placement';
    return `Hi ${name},

Your featured placement ${planLabel} for ${business} has been renewed successfully.

Plan: ${planLabel}
Amount: $${((data.amount || 0) / 100).toFixed(2)}

Your product remains featured in the spotlight channel.

Manage placements at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/featured-store`;
  }

  // Email templates - Featured Placement Renewal Failed
  private buildFeaturedPlacementRenewalFailedHtml(name: string, business: string, data: BillingNotificationData): string {
    const planLabel = data.metadata?.planLabel || data.metadata?.planKey || 'Featured Placement';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Featured Placement Renewal Payment Failed</h2>
        <p>Hi ${name},</p>
        <p>We were unable to process payment for <strong>${planLabel}</strong> on <strong>${business}</strong>.</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Reason:</strong> ${data.reason || 'Payment method declined'}</p>
        </div>
        <p>Your placement has entered a <strong>7-day grace period</strong>. Please update your payment method to avoid losing your featured spot.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/featured-store" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment & Renew</a>
        </p>
      </div>
    `;
  }

  private buildFeaturedPlacementRenewalFailedText(name: string, business: string, data: BillingNotificationData): string {
    const planLabel = data.metadata?.planLabel || data.metadata?.planKey || 'Featured Placement';
    return `Hi ${name},

We were unable to process payment for ${planLabel} on ${business}.

Reason: ${data.reason || 'Payment method declined'}

Your placement has entered a 7-day grace period. Please update your payment method to avoid losing your featured spot.

Renew at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/featured-store`;
  }

  // Email templates - Featured Placement Grace Period Warning
  private buildFeaturedPlacementGracePeriodHtml(name: string, business: string, data: BillingNotificationData): string {
    const planLabel = data.metadata?.planLabel || data.metadata?.planKey || 'Featured Placement';
    const daysLeft = data.gracePeriodDaysRemaining || 7;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Action Required: Featured Placement Grace Period</h2>
        <p>Hi ${name},</p>
        <p>Payment for <strong>${planLabel}</strong> on <strong>${business}</strong> failed during auto-renewal.</p>
        <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fde68a;">
          <p style="margin: 0;"><strong>Placement:</strong> ${planLabel}</p>
          <p style="margin: 8px 0 0;"><strong>Grace period:</strong> ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining</p>
          <p style="margin: 8px 0 0;"><strong>Reason:</strong> ${data.reason || 'Payment declined'}</p>
        </div>
        <p>Your placement is still active, but will be <strong>removed in ${daysLeft} days</strong> if payment is not updated.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/featured-store" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment & Renew</a>
        </p>
      </div>
    `;
  }

  private buildFeaturedPlacementGracePeriodText(name: string, business: string, data: BillingNotificationData): string {
    const planLabel = data.metadata?.planLabel || data.metadata?.planKey || 'Featured Placement';
    const daysLeft = data.gracePeriodDaysRemaining || 7;
    return `Hi ${name},

Payment for ${planLabel} on ${business} failed during auto-renewal.

Your placement is still active, but will be removed in ${daysLeft} days if payment is not updated.

Reason: ${data.reason || 'Payment declined'}

Renew at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/featured-store`;
  }

  // Email templates - Featured Placement Expired
  private buildFeaturedPlacementExpiredHtml(name: string, business: string, data: BillingNotificationData): string {
    const planLabel = data.metadata?.planLabel || data.metadata?.planKey || 'Featured Placement';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6b7280;">Featured Placement Expired</h2>
        <p>Hi ${name},</p>
        <p>Your featured placement <strong>${planLabel}</strong> for <strong>${business}</strong> has expired.</p>
        <p>The product is no longer in the spotlight channel. You can renew your placement to restore featured visibility.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/featured-store" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Renew Placement</a>
        </p>
      </div>
    `;
  }

  private buildFeaturedPlacementExpiredText(name: string, business: string, data: BillingNotificationData): string {
    const planLabel = data.metadata?.planLabel || data.metadata?.planKey || 'Featured Placement';
    return `Hi ${name},

Your featured placement ${planLabel} for ${business} has expired.

The product is no longer in the spotlight channel. You can renew your placement to restore featured visibility.

Renew at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/featured-store`;
  }

  // Email templates - Directory Promotion Purchased
  private buildDirectoryPromotionPurchasedHtml(name: string, business: string, data: BillingNotificationData): string {
    const tierLabel = data.metadata?.tierLabel || data.metadata?.tier || 'Promotion';
    const expiresAt = data.metadata?.expiresAt ? new Date(data.metadata.expiresAt).toLocaleDateString() : 'N/A';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Directory Promotion Active</h2>
        <p>Hi ${name},</p>
        <p>Your directory promotion for <strong>${business}</strong> is now active!</p>
        <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Tier:</strong> ${tierLabel}</p>
          <p style="margin: 8px 0 0;"><strong>Expires:</strong> ${expiresAt}</p>
          <p style="margin: 8px 0 0;"><strong>Price:</strong> $${((data.amount || 0) / 100).toFixed(2)}</p>
        </div>
        <p>Your store will be highlighted in the directory with a promoted badge and priority placement.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/promotion" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Manage Promotion</a>
        </p>
      </div>
    `;
  }

  private buildDirectoryPromotionPurchasedText(name: string, business: string, data: BillingNotificationData): string {
    const tierLabel = data.metadata?.tierLabel || data.metadata?.tier || 'Promotion';
    const expiresAt = data.metadata?.expiresAt ? new Date(data.metadata.expiresAt).toLocaleDateString() : 'N/A';
    return `Hi ${name},

Your directory promotion ${tierLabel} for ${business} is now active!

Tier: ${tierLabel}
Expires: ${expiresAt}
Price: $${((data.amount || 0) / 100).toFixed(2)}

Your store will be highlighted in the directory with a promoted badge and priority placement.

Manage at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/promotion`;
  }

  // Email templates - Directory Promotion Renewal Success
  private buildDirectoryPromotionRenewalSuccessHtml(name: string, business: string, data: BillingNotificationData): string {
    const tierLabel = data.metadata?.tierLabel || data.metadata?.tier || 'Promotion';
    const expiresAt = data.metadata?.expiresAt ? new Date(data.metadata.expiresAt).toLocaleDateString() : 'N/A';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Directory Promotion Renewed</h2>
        <p>Hi ${name},</p>
        <p>Your directory promotion for <strong>${business}</strong> has been successfully renewed.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Tier:</strong> ${tierLabel}</p>
          <p style="margin: 8px 0 0;"><strong>New Expiration:</strong> ${expiresAt}</p>
          <p style="margin: 8px 0 0;"><strong>Price:</strong> $${((data.amount || 0) / 100).toFixed(2)}</p>
        </div>
        <p>Your store will continue to be highlighted in the directory.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/promotion" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Manage Promotion</a>
        </p>
      </div>
    `;
  }

  private buildDirectoryPromotionRenewalSuccessText(name: string, business: string, data: BillingNotificationData): string {
    const tierLabel = data.metadata?.tierLabel || data.metadata?.tier || 'Promotion';
    const expiresAt = data.metadata?.expiresAt ? new Date(data.metadata.expiresAt).toLocaleDateString() : 'N/A';
    return `Hi ${name},

Your directory promotion ${tierLabel} for ${business} has been renewed!

Tier: ${tierLabel}
New Expiration: ${expiresAt}
Price: $${((data.amount || 0) / 100).toFixed(2)}

Your store will continue to be highlighted in the directory.

Manage at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/promotion`;
  }

  // Email templates - Directory Promotion Renewal Failed
  private buildDirectoryPromotionRenewalFailedHtml(name: string, business: string, data: BillingNotificationData): string {
    const tierLabel = data.metadata?.tierLabel || data.metadata?.tier || 'Promotion';
    const graceDays = data.gracePeriodDaysRemaining || 7;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Payment Failed: Directory Promotion Renewal</h2>
        <p>Hi ${name},</p>
        <p>We were unable to charge your payment method for the directory promotion on <strong>${business}</strong>.</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Tier:</strong> ${tierLabel}</p>
          <p style="margin: 8px 0 0;"><strong>Grace Period:</strong> ${graceDays} days remaining</p>
        </div>
        <p>Please update your payment method within ${graceDays} days to avoid losing your directory promotion.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/settings/billing/payment-methods" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Method</a>
        </p>
      </div>
    `;
  }

  private buildDirectoryPromotionRenewalFailedText(name: string, business: string, data: BillingNotificationData): string {
    const tierLabel = data.metadata?.tierLabel || data.metadata?.tier || 'Promotion';
    const graceDays = data.gracePeriodDaysRemaining || 7;
    return `Hi ${name},

We were unable to charge your payment method for the directory promotion ${tierLabel} on ${business}.

Tier: ${tierLabel}
Grace Period: ${graceDays} days remaining

Please update your payment method within ${graceDays} days to avoid losing your directory promotion.

Update payment method at: ${process.env.WEB_URL}/settings/billing/payment-methods`;
  }

  // Email templates - Directory Promotion Grace Period Warning
  private buildDirectoryPromotionGracePeriodHtml(name: string, business: string, data: BillingNotificationData): string {
    const tierLabel = data.metadata?.tierLabel || data.metadata?.tier || 'Promotion';
    const graceDays = data.gracePeriodDaysRemaining || 7;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Action Required: Directory Promotion Grace Period</h2>
        <p>Hi ${name},</p>
        <p>Your directory promotion for <strong>${business}</strong> is in the grace period due to a failed payment.</p>
        <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Tier:</strong> ${tierLabel}</p>
          <p style="margin: 8px 0 0;"><strong>Days Remaining:</strong> ${graceDays}</p>
        </div>
        <p>Your store is still promoted, but will lose its promoted status if payment is not updated within ${graceDays} days.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/settings/billing/payment-methods" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Method</a>
        </p>
      </div>
    `;
  }

  private buildDirectoryPromotionGracePeriodText(name: string, business: string, data: BillingNotificationData): string {
    const tierLabel = data.metadata?.tierLabel || data.metadata?.tier || 'Promotion';
    const graceDays = data.gracePeriodDaysRemaining || 7;
    return `Hi ${name},

Your directory promotion ${tierLabel} for ${business} is in the grace period due to a failed payment.

Tier: ${tierLabel}
Days Remaining: ${graceDays}

Your store is still promoted, but will lose its promoted status if payment is not updated within ${graceDays} days.

Update payment method at: ${process.env.WEB_URL}/settings/billing/payment-methods`;
  }

  // Email templates - Directory Promotion Expired
  private buildDirectoryPromotionExpiredHtml(name: string, business: string, data: BillingNotificationData): string {
    const tierLabel = data.metadata?.tierLabel || data.metadata?.tier || 'Promotion';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6b7280;">Directory Promotion Expired</h2>
        <p>Hi ${name},</p>
        <p>Your directory promotion for <strong>${business}</strong> has expired.</p>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Tier:</strong> ${tierLabel}</p>
        </div>
        <p>Your store is no longer highlighted in the directory. You can renew your promotion to restore promoted visibility.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL}/t/${data.tenantId}/settings/promotion" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Renew Promotion</a>
        </p>
      </div>
    `;
  }

  private buildDirectoryPromotionExpiredText(name: string, business: string, data: BillingNotificationData): string {
    const tierLabel = data.metadata?.tierLabel || data.metadata?.tier || 'Promotion';
    return `Hi ${name},

Your directory promotion ${tierLabel} for ${business} has expired.

Your store is no longer highlighted in the directory. You can renew your promotion to restore promoted visibility.

Renew at: ${process.env.WEB_URL}/t/${data.tenantId}/settings/promotion`;
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

  // Email templates - Policy Template Updated
  private buildPolicyTemplateUpdatedHtml(name: string, business: string, data: BillingNotificationData): string {
    const templateTitle = data.metadata?.templateTitle || 'Policy Template';
    const appliedVersion = data.metadata?.appliedVersion || 'unknown';
    const currentVersion = data.metadata?.currentVersion || 'unknown';
    const policyType = data.metadata?.policyType || 'policy';
    const reason = data.metadata?.reason || 'regulatory changes';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Hi ${name},</h2>
        <p style="color: #444; font-size: 16px;">A policy template you previously applied to <strong>${business}</strong> has been updated due to ${reason}.</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Template: <strong>${templateTitle}</strong></p>
          <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Policy Type: ${policyType.replace(/_/g, ' ')}</p>
          <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Your version: ${appliedVersion}</p>
          <p style="margin: 0; font-size: 14px; color: #666;">Current version: <strong>${currentVersion}</strong></p>
        </div>
        <p style="color: #444; font-size: 16px;">We recommend reviewing and updating your ${policyType.replace(/_/g, ' ')} to stay compliant with the latest requirements.</p>
        <a href="${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/policies" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 16px; margin: 16px 0;">Review Policies</a>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Templates are starting points, not legal advice. Consult your attorney before publishing updated policies.</p>
      </div>
    `;
  }

  private buildPolicyTemplateUpdatedText(name: string, business: string, data: BillingNotificationData): string {
    const templateTitle = data.metadata?.templateTitle || 'Policy Template';
    const appliedVersion = data.metadata?.appliedVersion || 'unknown';
    const currentVersion = data.metadata?.currentVersion || 'unknown';
    const policyType = data.metadata?.policyType || 'policy';
    const reason = data.metadata?.reason || 'regulatory changes';
    return `
Hi ${name},

A policy template you previously applied to ${business} has been updated due to ${reason}.

Template: ${templateTitle}
Policy Type: ${policyType.replace(/_/g, ' ')}
Your version: ${appliedVersion}
Current version: ${currentVersion}

We recommend reviewing and updating your ${policyType.replace(/_/g, ' ')} to stay compliant with the latest requirements.

Review at: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/policies

Templates are starting points, not legal advice. Consult your attorney before publishing updated policies.
    `.trim();
  }

  private buildPlatformServiceDeliveredHtml(name: string, business: string, data: BillingNotificationData): string {
    const serviceName = data.metadata?.serviceName || 'Platform Service';
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Service Delivered</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hi ${name},</p>
          <p>Your <strong>${serviceName}</strong> for <strong>${business}</strong> has been delivered.</p>
          <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Service:</strong> ${serviceName}</p>
          </div>
          <p>You can view the details and any deliverables in your CRM portal.</p>
          <a href="${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/crm" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">View in CRM</a>
        </div>
      </div>
    `;
  }

  private buildPlatformServiceDeliveredText(name: string, business: string, data: BillingNotificationData): string {
    const serviceName = data.metadata?.serviceName || 'Platform Service';
    return `
Hi ${name},

Your ${serviceName} for ${business} has been delivered.

You can view the details and any deliverables in your CRM portal at: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/crm
    `.trim();
  }

  // Email templates - Funnel Builder
  private buildFunnelBuilderPurchasedHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Sales Funnel Builder Activated</h2>
        <p>Hi ${name},</p>
        <p>Your <strong>Sales Funnel Builder</strong> add-on for <strong>${business}</strong> is now active.</p>
        <p>You can start creating order bumps, upsells, downsells, and one-time offers to increase your average order value.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/funnels" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Open Funnel Builder</a>
        </p>
      </div>
    `;
  }

  private buildFunnelBuilderPurchasedText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

Your Sales Funnel Builder add-on for ${business} is now active.

Start creating funnels at: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${data.tenantId}/settings/funnels`;
  }

  private buildFunnelBuilderRenewalSuccessHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Sales Funnel Builder Renewed</h2>
        <p>Hi ${name},</p>
        <p>Your Sales Funnel Builder add-on for <strong>${business}</strong> has been renewed successfully.</p>
        <p><strong>Amount:</strong> $${((data.amount || 0) / 100).toFixed(2)}</p>
      </div>
    `;
  }

  private buildFunnelBuilderRenewalSuccessText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

Your Sales Funnel Builder add-on for ${business} has been renewed successfully. Amount: $${((data.amount || 0) / 100).toFixed(2)}`;
  }

  private buildFunnelBuilderRenewalFailedHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Sales Funnel Builder Renewal Failed</h2>
        <p>Hi ${name},</p>
        <p>We were unable to renew your Sales Funnel Builder add-on for <strong>${business}</strong>.</p>
        <p>Please update your payment method within the grace period to keep your funnels active.</p>
      </div>
    `;
  }

  private buildFunnelBuilderRenewalFailedText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

We were unable to renew your Sales Funnel Builder add-on for ${business}. Please update your payment method to keep your funnels active.`;
  }

  private buildFunnelBuilderExpiredHtml(name: string, business: string, data: BillingNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6b7280;">Sales Funnel Builder Expired</h2>
        <p>Hi ${name},</p>
        <p>Your Sales Funnel Builder add-on for <strong>${business}</strong> has expired and your funnels are now paused.</p>
        <p>Renew the add-on to reactivate your funnels.</p>
      </div>
    `;
  }

  private buildFunnelBuilderExpiredText(name: string, business: string, data: BillingNotificationData): string {
    return `Hi ${name},

Your Sales Funnel Builder add-on for ${business} has expired and your funnels are now paused. Renew to reactivate them.`;
  }

  private buildFunnelStepConversionHtml(name: string, business: string, data: BillingNotificationData): string {
    const funnelName = data.metadata?.funnelName || 'Funnel';
    const stepType = data.metadata?.stepType || 'step';
    const revenue = ((data.amount || 0) / 100).toFixed(2);
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Funnel Conversion</h2>
        <p>Hi ${name},</p>
        <p>A customer accepted a <strong>${stepType}</strong> offer in <strong>${funnelName}</strong> for <strong>${business}</strong>.</p>
        <p><strong>Additional revenue:</strong> $${revenue}</p>
      </div>
    `;
  }

  private buildFunnelStepConversionText(name: string, business: string, data: BillingNotificationData): string {
    const funnelName = data.metadata?.funnelName || 'Funnel';
    const stepType = data.metadata?.stepType || 'step';
    const revenue = ((data.amount || 0) / 100).toFixed(2);
    return `Hi ${name},

A customer accepted a ${stepType} offer in ${funnelName} for ${business}. Additional revenue: $${revenue}`;
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
