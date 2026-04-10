/**
 * Subscription Validation Service
 * 
 * Enforces business rules for subscription changes
 * Prevents abuse and ensures proper subscription lifecycle
 */

import { prisma } from '../../prisma';

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  errorCode?: string;
}

export class SubscriptionValidationService {
  private static instance: SubscriptionValidationService;

  static getInstance(): SubscriptionValidationService {
    if (!SubscriptionValidationService.instance) {
      SubscriptionValidationService.instance = new SubscriptionValidationService();
    }
    return SubscriptionValidationService.instance;
  }

  /**
   * Validate if a subscription change is allowed
   */
  async validateSubscriptionChange(
    tenantId: string,
    newTier: string,
    userId?: string
  ): Promise<ValidationResult> {
    // Get current tenant state
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        subscription_ends_at: true,
        grace_ends_at: true,
        manual_subscription_control: true,
        manual_subscription_expires_at: true,
        created_at: true,
      }
    } as any);

    if (!tenant) {
      return { allowed: false, reason: 'Tenant not found', errorCode: 'TENANT_NOT_FOUND' };
    }

    const currentTier = tenant.subscription_tier || 'starter';
    const isCurrentTrial = currentTier.startsWith('trial_');
    const isNewTrial = newTier.startsWith('trial_');
    const isCurrentPaid = !isCurrentTrial && currentTier !== 'starter';
    const isNewPaid = !isNewTrial && newTier !== 'starter';

    // Rule 1: Prevent paid plan -> trial downgrades
    if (isCurrentPaid && isNewTrial) {
      return { 
        allowed: false, 
        reason: 'Cannot downgrade from paid plan to trial',
        errorCode: 'PAID_TO_TRIAL_NOT_ALLOWED' 
      };
    }

    // Rule 2: Allow trial tier switching during active trial period, but not during grace period
    if (isCurrentTrial && isNewTrial) {
      // Allow switching to different trial tiers during active trial period
      if (newTier !== currentTier && !tenant.grace_ends_at) {
        return { allowed: true };
      }
      // Block trial renewals/extensions and any trial changes during grace period
      return { 
        allowed: false, 
        reason: tenant.grace_ends_at 
          ? 'Cannot change trial tiers during grace period'
          : 'Cannot renew or extend current trial',
        errorCode: 'TRIAL_CHANGE_NOT_ALLOWED' 
      };
    }

    // Rule 3: Check if tenant has already used a trial
    // For now, we'll use a simple approach - check if tenant had a paid plan before
    if (isNewTrial && !isCurrentTrial) {
      const hasUsedTrial = tenant.created_at && (Date.now() - tenant.created_at.getTime()) > 30 * 24 * 60 * 60 * 1000; // Older than 30 days
      if (hasUsedTrial) {
        return { 
          allowed: false, 
          reason: 'Trial already used. Only one trial per customer.',
          errorCode: 'TRIAL_ALREADY_USED' 
        };
      }
    }

    // Rule 4: Validate subscription status
    if (tenant.subscription_status === 'canceled') {
      return { 
        allowed: false, 
        reason: 'Cannot change subscription on canceled account',
        errorCode: 'SUBSCRIPTION_CANCELED' 
      };
    }

    if (tenant.subscription_status === 'past_due') {
      return { 
        allowed: false, 
        reason: 'Please update payment method before changing subscription',
        errorCode: 'SUBSCRIPTION_PAST_DUE' 
      };
    }

    // Rule 5: Grace period restrictions
    if (tenant.grace_ends_at && tenant.grace_ends_at > new Date()) {
      // Only allow upgrades during grace period
      if (this.getTierLevel(newTier) <= this.getTierLevel(currentTier)) {
        return { 
          allowed: false, 
          reason: 'Only upgrades allowed during grace period',
          errorCode: 'GRACE_PERIOD_RESTRICTION' 
        };
      }
    }

    // Rule 6: Manual subscription control restrictions
    if ((tenant as any).manual_subscription_control) {
      // Allow only admin changes for manually controlled subscriptions
      return { 
        allowed: false, 
        reason: 'Contact support to change manually managed subscription',
        errorCode: 'MANUAL_CONTROL_RESTRICTION' 
      };
    }

    return { allowed: true };
  }

  
  /**
   * Get tier level for comparison (higher = better)
   */
  private getTierLevel(tier: string): number {
    const tierLevels = {
      'trial_starter': 0,
      'trial_pro': 1,
      'trial_enterprise': 2,
      'starter': 3,
      'pro': 4,
      'enterprise': 5,
      'chain_starter': 6,
      'chain_pro': 7,
      'chain_enterprise': 8
    };

    return tierLevels[tier as keyof typeof tierLevels] || 0;
  }

  /**
   * Validate if payment method can be added/updated
   */
  async validatePaymentMethodChange(
    tenantId: string,
    action: 'add' | 'update' | 'remove'
  ): Promise<ValidationResult> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_status: true,
        manual_subscription_control: true
      }
    } as any);

    if (!tenant) {
      return { allowed: false, reason: 'Tenant not found', errorCode: 'TENANT_NOT_FOUND' };
    }

    // Prevent payment method changes on manually controlled subscriptions
    if ((tenant as any).manual_subscription_control) {
      return { 
        allowed: false, 
        reason: 'Contact support to update payment methods',
        errorCode: 'MANUAL_CONTROL_RESTRICTION' 
      };
    }

    // Prevent removing last payment method on active subscription
    if (action === 'remove' && tenant.subscription_status === 'active') {
      return { 
        allowed: false, 
        reason: 'Cannot remove payment method on active subscription',
        errorCode: 'ACTIVE_SUBSCRIPTION_RESTRICTION' 
      };
    }

    return { allowed: true };
  }
}
