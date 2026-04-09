/**
 * Trial Management Service
 * 
 * Handles the trial subscription lifecycle:
 * - Start trial (requires payment method)
 * - Trial end: auto-charge payment method
 * - Grace period: retry payment, send reminders
 * - Grace expiry: downgrade to expired_trial
 */

import { prisma } from '../../prisma';
import { getSubscriptionBillingService } from './SubscriptionBillingService';
import { getBillingNotificationService } from './BillingNotificationService';

// Trial constants
export const TRIAL_DURATION_DAYS = 14;
export const GRACE_DURATION_DAYS = 14;
export const TRIAL_ELIGIBLE_TIERS = ['google_only', 'starter', 'professional', 'chain_starter'] as const;
export type TrialEligibleTier = typeof TRIAL_ELIGIBLE_TIERS[number];

export interface TrialStartResult {
  success: boolean;
  trialTier: string;
  trialEndsAt: Date;
  graceEndsAt: Date;
  error?: string;
}

export interface TrialChargeResult {
  success: boolean;
  charged: boolean;
  newStatus: 'active' | 'past_due' | 'expired_trial' | 'trial';
  error?: string;
}

export class TrialManagementService {
  /**
   * Start a trial for a tenant
   * Requires a valid payment method on file
   */
  async startTrial(
    tenantId: string,
    selectedTier: TrialEligibleTier,
    paymentMethodId: string
  ): Promise<TrialStartResult> {
    // Verify tier is trial-eligible
    if (!TRIAL_ELIGIBLE_TIERS.includes(selectedTier)) {
      return {
        success: false,
        trialTier: '',
        trialEndsAt: new Date(),
        graceEndsAt: new Date(),
        error: `Tier ${selectedTier} is not eligible for trial`,
      };
    }

    // Verify payment method exists and belongs to tenant
    const paymentMethod = await prisma.merchant_billing_gateways.findFirst({
      where: {
        id: paymentMethodId,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!paymentMethod) {
      return {
        success: false,
        trialTier: '',
        trialEndsAt: new Date(),
        graceEndsAt: new Date(),
        error: 'Valid payment method required to start trial',
      };
    }

    // Calculate trial and grace periods
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

    const graceEndsAt = new Date(trialEndsAt);
    graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_DURATION_DAYS);

    // Create trial wrapper tier
    const trialTier = `trial_${selectedTier}` as const;

    // Update tenant with trial info
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_tier: trialTier,
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt,
        trial_selected_tier: selectedTier,
        grace_ends_at: graceEndsAt,
        trial_payment_retry_count: 0,
        trial_payment_failed_at: null,
        billing_payment_method_id: paymentMethodId,
        status_changed_at: now,
      },
    });

    // Send trial started notification
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'trial_started',
      tier: selectedTier,
    }).catch(err => console.error('[TrialManagement] Failed to send notification:', err));

    return {
      success: true,
      trialTier,
      trialEndsAt,
      graceEndsAt,
    };
  }

  /**
   * Process trial end - attempt to charge payment method
   * Called by background job when trial_ends_at is reached
   */
  async processTrialEnd(tenantId: string): Promise<TrialChargeResult> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        trial_selected_tier: true,
        grace_ends_at: true,
        billing_payment_method_id: true,
        trial_payment_retry_count: true,
        manual_subscription_control: true,
        manual_subscription_expires_at: true,
      },
    });

    if (!tenant || tenant.subscription_status !== 'trial') {
      return {
        success: false,
        charged: false,
        newStatus: 'expired_trial',
        error: 'Tenant not in trial status',
      };
    }

    // Check if manual subscription control is enabled
    if (tenant.manual_subscription_control) {
      if (!tenant.manual_subscription_expires_at || 
          tenant.manual_subscription_expires_at > new Date()) {
        return {
          success: true,
          charged: false,
          newStatus: 'trial'
        };
      }
      // Manual control has expired, proceed with normal processing
    }

    const selectedTier = tenant.trial_selected_tier as TrialEligibleTier;
    if (!selectedTier) {
      // No selected tier - downgrade to expired_trial
      await this.downgradeToExpired(tenantId);
      return {
        success: false,
        charged: false,
        newStatus: 'expired_trial',
        error: 'No tier selected for trial',
      };
    }

    // Attempt to charge the saved payment method
    try {
      const billingService = getSubscriptionBillingService();
      
      // Get tier pricing
      const tierPricing = await billingService.getTierPricing();
      const tierInfo = tierPricing.find(t => t.tier === selectedTier);
      
      if (!tierInfo) {
        throw new Error(`Tier pricing not found for ${selectedTier}`);
      }

      // Charge the payment method
      const chargeResult = await billingService.chargePaymentMethod(
        tenantId,
        tenant.billing_payment_method_id!,
        tierInfo.monthlyPriceCents,
        `Trial conversion: ${selectedTier}`
      );

      if (chargeResult.success) {
        // Payment successful - activate subscription
        await prisma.tenants.update({
          where: { id: tenantId },
          data: {
            subscription_tier: selectedTier,
            subscription_status: 'active',
            trial_ends_at: null,
            trial_selected_tier: null,
            grace_ends_at: null,
            trial_payment_retry_count: 0,
            trial_payment_failed_at: null,
            status_changed_at: new Date(),
          },
        });

        // Send success notification
        const notificationService = getBillingNotificationService();
        notificationService.sendNotification({
          tenantId,
          type: 'trial_converted',
          tier: selectedTier,
        }).catch(err => console.error('[TrialManagement] Failed to send notification:', err));

        return {
          success: true,
          charged: true,
          newStatus: 'active',
        };
      } else {
        // Payment failed - enter grace period
        return await this.handleTrialPaymentFailure(tenantId, chargeResult.error || 'Payment failed');
      }
    } catch (error: any) {
      return await this.handleTrialPaymentFailure(tenantId, error.message);
    }
  }

  /**
   * Handle payment failure during trial conversion
   * Sets status to past_due and tracks retry count
   */
  private async handleTrialPaymentFailure(tenantId: string, reason: string): Promise<TrialChargeResult> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        trial_selected_tier: true,
        trial_payment_retry_count: true,
        grace_ends_at: true,
      },
    });

    const retryCount = (tenant?.trial_payment_retry_count || 0) + 1;

    // Update to past_due with retry tracking
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_status: 'past_due',
        trial_payment_retry_count: retryCount,
        trial_payment_failed_at: new Date(),
        status_changed_at: new Date(),
      },
    });

    // Send payment failed notification
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'trial_payment_failed',
      reason,
    }).catch(err => console.error('[TrialManagement] Failed to send notification:', err));

    return {
      success: false,
      charged: false,
      newStatus: 'past_due',
      error: reason,
    };
  }

  /**
   * Retry payment during grace period
   * Called by background job every 3 days during grace period
   */
  async retryPayment(tenantId: string): Promise<TrialChargeResult> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_status: true,
        trial_selected_tier: true,
        grace_ends_at: true,
        billing_payment_method_id: true,
        trial_payment_retry_count: true,
      },
    });

    if (!tenant || tenant.subscription_status !== 'past_due') {
      return {
        success: false,
        charged: false,
        newStatus: 'expired_trial',
        error: 'Tenant not in past_due status',
      };
    }

    // Check if grace period has expired
    if (tenant.grace_ends_at && new Date() > tenant.grace_ends_at) {
      await this.downgradeToExpired(tenantId);
      return {
        success: false,
        charged: false,
        newStatus: 'expired_trial',
        error: 'Grace period expired',
      };
    }

    // Retry payment
    return this.processTrialEnd(tenantId);
  }

  /**
   * Downgrade tenant to expired_trial
   * Tenant becomes invisible on public pages
   */
  async downgradeToExpired(tenantId: string): Promise<void> {
    // Check manual subscription control before downgrading
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        manual_subscription_control: true,
        manual_subscription_expires_at: true,
      }
    });

    if (tenant?.manual_subscription_control) {
      if (!tenant.manual_subscription_expires_at || 
          tenant.manual_subscription_expires_at > new Date()) {
        // Manual control is active - don't downgrade
        console.log(`[TrialManagement] Skipping downgrade for tenant ${tenantId} - manual control active`);
        return;
      }
    }

    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_tier: 'expired_trial',
        subscription_status: 'canceled',
        trial_ends_at: null,
        trial_selected_tier: null,
        grace_ends_at: null,
        trial_payment_retry_count: 0,
        trial_payment_failed_at: null,
        status_changed_at: new Date(),
      },
    });

    // Send trial expired notification
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'trial_expired',
    }).catch(err => console.error('[TrialManagement] Failed to send notification:', err));
  }

  /**
   * Get tenants whose trials are ending today (need charging)
   */
  async getTrialsEndingToday(): Promise<string[]> {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tenants = await prisma.tenants.findMany({
      where: {
        subscription_status: 'trial',
        trial_ends_at: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: { id: true },
    });

    return tenants.map(t => t.id);
  }

  /**
   * Get tenants in grace period needing payment retry
   * Returns tenants where retry is due (every 3 days)
   */
  async getTenantsNeedingRetry(): Promise<string[]> {
    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const tenants = await prisma.tenants.findMany({
      where: {
        subscription_status: 'past_due',
        grace_ends_at: { gt: now }, // Still in grace period
        trial_payment_failed_at: { lte: threeDaysAgo }, // Last retry was 3+ days ago
      },
      select: { id: true },
    });

    return tenants.map(t => t.id);
  }

  /**
   * Get tenants whose grace period has expired
   */
  async getGracePeriodExpired(): Promise<string[]> {
    const now = new Date();

    const tenants = await prisma.tenants.findMany({
      where: {
        subscription_status: 'past_due',
        grace_ends_at: { lt: now },
      },
      select: { id: true },
    });

    return tenants.map(t => t.id);
  }

  /**
   * Check if a tenant is in trial
   */
  async isInTrial(tenantId: string): Promise<boolean> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subscription_status: true },
    });

    return tenant?.subscription_status === 'trial';
  }

  /**
   * Get trial info for a tenant
   */
  async getTrialInfo(tenantId: string): Promise<{
    isInTrial: boolean;
    trialTier: string | null;
    selectedTier: string | null;
    trialEndsAt: Date | null;
    graceEndsAt: Date | null;
    daysRemaining: number;
  } | null> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_status: true,
        subscription_tier: true,
        trial_selected_tier: true,
        trial_ends_at: true,
        grace_ends_at: true,
      },
    });

    if (!tenant) return null;

    const isInTrial = tenant.subscription_status === 'trial';
    const isPastDue = tenant.subscription_status === 'past_due';

    // Calculate days remaining
    let daysRemaining = 0;
    if (isInTrial && tenant.trial_ends_at) {
      const now = new Date();
      const diff = tenant.trial_ends_at.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } else if (isPastDue && tenant.grace_ends_at) {
      const now = new Date();
      const diff = tenant.grace_ends_at.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    return {
      isInTrial: isInTrial || isPastDue,
      trialTier: tenant.subscription_tier,
      selectedTier: tenant.trial_selected_tier,
      trialEndsAt: tenant.trial_ends_at,
      graceEndsAt: tenant.grace_ends_at,
      daysRemaining,
    };
  }
}

// Singleton instance
let instance: TrialManagementService | null = null;

export function getTrialManagementService(): TrialManagementService {
  if (!instance) {
    instance = new TrialManagementService();
  }
  return instance;
}
