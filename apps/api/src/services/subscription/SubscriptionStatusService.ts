/**
 * Subscription Status Service
 * 
 * Handles subscription status transitions based on payment outcomes
 * - Payment success: active status
 * - Payment failure: past_due status (triggers grace period)
 * - Grace period expiry: canceled + expired_trial demotion
 * 
 * NOTE: google_only is now a paid tier ($29/mo), not a downgrade target.
 * Expired trials go to expired_trial (invisible on public pages).
 */

import { prisma } from '../../prisma';
import { getBillingNotificationService } from './BillingNotificationService';
import { getTrialManagementService } from './TrialManagementService';

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'expired';

export interface StatusTransitionResult {
  previousStatus: SubscriptionStatus;
  newStatus: SubscriptionStatus;
  previousTier: string | null;
  newTier: string | null;
  changedAt: Date;
  reason: string;
}

export class SubscriptionStatusService {
  /**
   * Handle successful payment - activate subscription
   */
  async handlePaymentSuccess(
    tenantId: string,
    tier: string,
    invoiceId: string,
    amount?: number
  ): Promise<StatusTransitionResult> {
    // Get current status
    const current = await this.getTenantSubscriptionState(tenantId);
    
    // Always process payments and update to active status
    // Manual control only prevents expiration, not activation
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_status: 'active',
        subscription_tier: tier,
        status_changed_at: new Date(),
      },
    });

    // Log the transition
    await this.logStatusTransition(tenantId, current.status, 'active', current.tier, tier, 'payment_success');

    // Send notification
    console.log('[SubscriptionStatus] Sending payment_success notification:', { tenantId, tier, amount });
    const notificationService = getBillingNotificationService();
    const notificationResult = await notificationService.sendNotification({
      tenantId,
      type: 'payment_success',
      tier,
      amount,
    });
    console.log('[SubscriptionStatus] Notification result:', notificationResult);

    // Create platform revenue transaction for subscription payment
    if (amount && amount > 0) {
      try {
        const transactionId = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await prisma.platform_revenue_transactions.create({
          data: {
            id: transactionId,
            tenant_id: tenantId,
            transaction_type: 'subscription',
            gross_amount_cents: amount,
            platform_fee_cents: amount, // Full amount is platform revenue for subscriptions
            gateway_fee_cents: 0, // Will be updated when actual gateway fees are known
            net_amount_cents: amount,
            stripe_transaction_id: invoiceId?.startsWith('paypal_') ? null : invoiceId,
            status: 'completed',
            processed_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
            metadata: {
              tier,
              payment_method: invoiceId?.startsWith('paypal_') ? 'paypal' : 'stripe'
            }
          }
        });
        console.log('[SubscriptionStatus] Platform revenue transaction created:', transactionId);
      } catch (error) {
        console.error('[SubscriptionStatus] Failed to create platform revenue transaction:', error);
        // Don't fail the subscription activation if revenue tracking fails
      }
    }

    return {
      previousStatus: current.status,
      newStatus: 'active',
      previousTier: current.tier,
      newTier: tier,
      changedAt: new Date(),
      reason: 'payment_success',
    };
  }

  /**
   * Handle failed payment - set to past_due (starts grace period)
   */
  async handlePaymentFailure(
    tenantId: string,
    reason: string,
    attemptCount: number = 1
  ): Promise<StatusTransitionResult> {
    // Get current status and manual control settings
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_status: true,
        subscription_tier: true,
        status_changed_at: true,
        manual_subscription_control: true,
        manual_subscription_expires_at: true,
      }
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    // Check if manual subscription control is enabled
    if (tenant.manual_subscription_control) {
      if (!tenant.manual_subscription_expires_at || 
          tenant.manual_subscription_expires_at > new Date()) {
        // Manual control is active - don't change status
        return {
          previousStatus: tenant.subscription_status as any,
          newStatus: tenant.subscription_status as any,
          previousTier: tenant.subscription_tier,
          newTier: tenant.subscription_tier,
          changedAt: new Date(),
          reason: 'manual_subscription_control_active',
        };
      }
    }

    const current = {
      status: tenant.subscription_status as any,
      tier: tenant.subscription_tier,
      statusChangedAt: tenant.status_changed_at,
    };

    // Only transition to past_due if currently active
    if (current.status !== 'active') {
      return {
        previousStatus: current.status,
        newStatus: current.status,
        previousTier: current.tier,
        newTier: current.tier,
        changedAt: new Date(),
        reason: 'not_active',
      };
    }

    // Set to past_due - this starts the 30-day grace period
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_status: 'past_due',
        status_changed_at: new Date(),
      },
    });

    // Log the transition
    await this.logStatusTransition(tenantId, current.status, 'past_due', current.tier, current.tier, `payment_failed: ${reason}`);

    // Send notification (email + CRM task)
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'payment_failed',
      reason,
    }).catch(err => console.error('[SubscriptionStatus] Failed to send notification:', err));
    notificationService.createSubscriptionCrmTask({
      tenantId,
      type: 'payment_failed',
      reason,
    }).catch(err => console.error('[SubscriptionStatus] Failed to create CRM task:', err));

    return {
      previousStatus: current.status,
      newStatus: 'past_due',
      previousTier: current.tier,
      newTier: current.tier,
      changedAt: new Date(),
      reason: `payment_failed: ${reason}`,
    };
  }

  /**
   * Handle grace period expiry - demote to expired_trial
   * Called by the scheduled job after 30 days of past_due
   */
  async handleGracePeriodExpiry(tenantId: string): Promise<StatusTransitionResult> {
    const current = await this.getTenantSubscriptionState(tenantId);

    // Use TrialManagementService for consistent downgrade handling
    const trialService = getTrialManagementService();
    await trialService.downgradeToExpired(tenantId);

    // Log the transition
    await this.logStatusTransition(tenantId, current.status, 'canceled', current.tier, 'expired_trial', 'grace_period_expired');

    return {
      previousStatus: current.status,
      newStatus: 'canceled',
      previousTier: current.tier,
      newTier: 'expired_trial',
      changedAt: new Date(),
      reason: 'grace_period_expired',
    };
  }

  /**
   * Handle subscription cancellation (user-initiated)
   */
  async handleCancellation(
    tenantId: string,
    reason: string = 'user_requested'
  ): Promise<StatusTransitionResult> {
    const current = await this.getTenantSubscriptionState(tenantId);

    // Set to canceled but keep tier until end of billing cycle
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_status: 'canceled',
        status_changed_at: new Date(),
      },
    });

    // Log the transition
    await this.logStatusTransition(tenantId, current.status, 'canceled', current.tier, current.tier, reason);

    return {
      previousStatus: current.status,
      newStatus: 'canceled',
      previousTier: current.tier,
      newTier: current.tier,
      changedAt: new Date(),
      reason,
    };
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivate(
    tenantId: string,
    tier: string
  ): Promise<StatusTransitionResult> {
    const current = await this.getTenantSubscriptionState(tenantId);

    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_status: 'active',
        subscription_tier: tier,
        status_changed_at: new Date(),
      },
    });

    // Log the transition
    await this.logStatusTransition(tenantId, current.status, 'active', current.tier, tier, 'reactivation');

    // Send notification
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'subscription_reactivated',
      tier,
    }).catch(err => console.error('[SubscriptionStatus] Failed to send notification:', err));

    return {
      previousStatus: current.status,
      newStatus: 'active',
      previousTier: current.tier,
      newTier: tier,
      changedAt: new Date(),
      reason: 'reactivation',
    };
  }

  /**
   * Get current subscription state
   */
  async getTenantSubscriptionState(tenantId: string): Promise<{
    status: SubscriptionStatus;
    tier: string | null;
    statusChangedAt: Date | null;
    billingCycleEnd: Date | null;
  }> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_status: true,
        subscription_tier: true,
        status_changed_at: true,
        billing_cycle_end: true,
      },
    });

    return {
      status: (tenant?.subscription_status as SubscriptionStatus) || 'trial',
      tier: tenant?.subscription_tier || null,
      statusChangedAt: tenant?.status_changed_at || null,
      billingCycleEnd: tenant?.billing_cycle_end || null,
    };
  }

  /**
   * Log status transition for audit trail
   */
  private async logStatusTransition(
    tenantId: string,
    fromStatus: SubscriptionStatus,
    toStatus: SubscriptionStatus,
    fromTier: string | null,
    toTier: string | null,
    reason: string
  ): Promise<void> {
    try {
      await prisma.location_status_logs.create({
        data: {
          tenant_id: tenantId,
          old_status: fromStatus as any, // Cast to location_status enum
          new_status: toStatus as any, // Cast to location_status enum
          changed_by: 'subscription_status_service',
          reason: `Tier change: ${fromTier} -> ${toTier}. ${reason}`,
        },
      });
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.error('[SubscriptionStatus] Failed to log status transition:', error);
    }
  }

  /**
   * Check if tenant is in grace period
   */
  async isInGracePeriod(tenantId: string): Promise<boolean> {
    const state = await this.getTenantSubscriptionState(tenantId);
    
    if (state.status !== 'past_due' || !state.statusChangedAt) {
      return false;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return state.statusChangedAt > thirtyDaysAgo;
  }

  /**
   * Get remaining grace period days
   */
  async getGracePeriodDaysRemaining(tenantId: string): Promise<number> {
    const state = await this.getTenantSubscriptionState(tenantId);
    
    if (state.status !== 'past_due' || !state.statusChangedAt) {
      return 0;
    }

    const thirtyDaysLater = new Date(state.statusChangedAt);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const now = new Date();
    const remainingMs = thirtyDaysLater.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    return Math.max(0, remainingDays);
  }
}

// Singleton instance
let instance: SubscriptionStatusService | null = null;

export function getSubscriptionStatusService(): SubscriptionStatusService {
  if (!instance) {
    instance = new SubscriptionStatusService();
  }
  return instance;
}
