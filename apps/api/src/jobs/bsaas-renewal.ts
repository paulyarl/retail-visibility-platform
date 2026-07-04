/**
 * BSaaS Feature Renewal Job
 *
 * Scheduled job that runs daily to:
 * 1. Re-charge expiring monthly/annual feature purchases
 * 1b. Convert expired trials — attempt charge → active or grace period
 * 2. Retry past_due purchases within grace period
 * 3. Suspend past_due purchases whose grace period has expired
 * 4. Expire cancelled purchases that have reached end of billing period
 *
 * Run schedule: Daily at midnight (00:00 UTC)
 */

const GRACE_PERIOD_DAYS = 7;

import { prisma } from '../prisma';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';
import { getBillingNotificationService } from '../services/subscription/BillingNotificationService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

export interface BsaasRenewalResult {
  renewed: number;
  pastDue: number;
  suspended: number;
  expired: number;
  errors: string[];
}

/**
 * Process expiring BSaaS feature purchases.
 * Finds active purchases with expires_at <= now+1day and re-charges them.
 */
export async function processBsaasRenewals(): Promise<BsaasRenewalResult> {
  const result: BsaasRenewalResult = {
    renewed: 0,
    pastDue: 0,
    suspended: 0,
    expired: 0,
    errors: [],
  };

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1. Find active purchases expiring within 24 hours (monthly/annual only)
  //    Skip companion purchases (source='companion') — they have no expiry and no charge
  const expiringPurchases = await prisma.tenant_feature_purchases.findMany({
    where: {
      status: 'active',
      expires_at: { lte: tomorrow, gt: now },
      source: 'bsaas',
    },
  });

  console.log(`[BSaaS Renewal] Found ${expiringPurchases.length} purchases due for renewal`);

  for (const purchase of expiringPurchases) {
    try {
      const metadata = (purchase.metadata as any) || {};
      const priceCents = metadata.price_cents;
      const billingCycle = metadata.billing_cycle;
      const paymentMethodId = metadata.payment_method_id;

      if (!priceCents || !billingCycle || billingCycle === 'one_time') {
        // one_time purchases don't renew — mark as expired (no expiry action needed)
        continue;
      }

      if (!paymentMethodId) {
        console.warn(`[BSaaS Renewal] No payment_method_id in metadata for purchase ${purchase.id}, entering grace period`);
        await enterGracePeriod(purchase, 'No payment method on file', result);
        continue;
      }

      // Get feature name for description
      const feature = await prisma.features_list.findUnique({
        where: { key: purchase.feature_key },
        select: { name: true },
      });
      const featureName = feature?.name || purchase.feature_key;

      // Re-charge the payment method
      const billingService = getSubscriptionBillingService();
      const chargeResult = await billingService.chargePaymentMethod(
        purchase.tenant_id,
        paymentMethodId,
        priceCents,
        `BSaaS renewal: ${featureName}`
      );

      if (chargeResult.success) {
        // Extend expiry
        const newExpiresAt = billingCycle === 'monthly'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        await prisma.tenant_feature_purchases.update({
          where: { id: purchase.id },
          data: {
            expires_at: newExpiresAt,
            updated_at: new Date(),
            metadata: {
              ...metadata,
              last_renewed_at: new Date().toISOString(),
              last_transaction_id: chargeResult.transactionId,
            },
          },
        });

        result.renewed++;
        console.log(`[BSaaS Renewal] Renewed ${purchase.feature_key} for tenant ${purchase.tenant_id}`);

        // Send renewal success notification
        const notificationService = getBillingNotificationService();
        notificationService.sendNotification({
          tenantId: purchase.tenant_id,
          type: 'bsaas_renewal_success',
          amount: priceCents,
          billingCycle: billingCycle as 'monthly' | 'annual',
          metadata: { featureKey: purchase.feature_key, featureName },
        }).catch(err => console.error('[BSaaS Renewal] Failed to send renewal notification:', err));
      } else {
        // Payment failed — enter grace period instead of immediate suspension
        await enterGracePeriod(purchase, chargeResult.error || 'Payment declined', result, featureName, priceCents, billingCycle);
      }
    } catch (error: any) {
      console.error(`[BSaaS Renewal] Error processing purchase ${purchase.id}:`, error);
      result.errors.push(`Purchase ${purchase.id}: ${error.message}`);
    }
  }

  // 1b. Process expired trials — attempt charge to convert to active
  // Skip companion purchases — they don't have trials
  const expiredTrials = await prisma.tenant_feature_purchases.findMany({
    where: {
      status: 'trial',
      expires_at: { lt: now },
      source: 'bsaas',
    },
  });

  console.log(`[BSaaS Renewal] Found ${expiredTrials.length} expired trials to convert`);

  for (const purchase of expiredTrials) {
    try {
      const metadata = (purchase.metadata as any) || {};
      const priceCents = metadata.price_cents;
      const billingCycle = metadata.billing_cycle;
      const paymentMethodId = metadata.payment_method_id;

      const feature = await prisma.features_list.findUnique({
        where: { key: purchase.feature_key },
        select: { name: true },
      });
      const featureName = feature?.name || purchase.feature_key;

      if (!paymentMethodId || !priceCents) {
        // No payment method — enter grace period so tenant can add one
        await enterGracePeriod(purchase, 'Trial expired — no payment method on file', result, featureName, priceCents, billingCycle);
        continue;
      }

      const billingService = getSubscriptionBillingService();
      const chargeResult = await billingService.chargePaymentMethod(
        purchase.tenant_id,
        paymentMethodId,
        priceCents,
        `BSaaS trial conversion: ${featureName}`
      );

      if (chargeResult.success) {
        const newExpiresAt = billingCycle === 'monthly'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        await prisma.tenant_feature_purchases.update({
          where: { id: purchase.id },
          data: {
            status: 'active',
            expires_at: newExpiresAt,
            updated_at: new Date(),
            metadata: {
              ...metadata,
              trial_converted_at: new Date().toISOString(),
              last_transaction_id: chargeResult.transactionId,
            },
          },
        });

        result.renewed++;
        console.log(`[BSaaS Renewal] Trial converted for ${purchase.feature_key} (tenant ${purchase.tenant_id})`);

        const notificationService = getBillingNotificationService();
        notificationService.sendNotification({
          tenantId: purchase.tenant_id,
          type: 'bsaas_purchase_success',
          amount: priceCents,
          billingCycle: billingCycle as 'monthly' | 'annual',
          metadata: { featureKey: purchase.feature_key, featureName },
        }).catch(err => console.error('[BSaaS Renewal] Failed to send trial conversion notification:', err));
      } else {
        // Trial conversion charge failed — enter grace period
        await enterGracePeriod(purchase, chargeResult.error || 'Payment declined during trial conversion', result, featureName, priceCents, billingCycle);
      }
    } catch (error: any) {
      console.error(`[BSaaS Renewal] Error converting trial ${purchase.id}:`, error);
      result.errors.push(`Trial ${purchase.id}: ${error.message}`);
    }
  }

  // 2. Retry past_due purchases within grace period
  // Skip companion purchases — they can't be past_due (no charge)
  const pastDuePurchases = await prisma.tenant_feature_purchases.findMany({
    where: {
      status: 'past_due',
      source: 'bsaas',
    },
  });

  console.log(`[BSaaS Renewal] Found ${pastDuePurchases.length} past_due purchases to retry`);

  for (const purchase of pastDuePurchases) {
    try {
      const metadata = (purchase.metadata as any) || {};
      const graceEndsAt = metadata.grace_ends_at ? new Date(metadata.grace_ends_at) : null;

      // Check if grace period has expired
      if (graceEndsAt && graceEndsAt <= now) {
        // Grace period expired — suspend the purchase
        await suspendPurchase(purchase.id, purchase.tenant_id, purchase.feature_key, 'Grace period expired — payment not updated');
        result.suspended++;
        console.log(`[BSaaS Renewal] Suspended purchase ${purchase.id} (grace period expired)`);

        const notificationService = getBillingNotificationService();
        notificationService.sendNotification({
          tenantId: purchase.tenant_id,
          type: 'bsaas_renewal_failed',
          amount: metadata.price_cents,
          billingCycle: metadata.billing_cycle as 'monthly' | 'annual',
          reason: 'Grace period expired',
          metadata: { featureKey: purchase.feature_key, featureName: metadata.feature_name || purchase.feature_key },
        }).catch(err => console.error('[BSaaS Renewal] Failed to send suspension notification:', err));
        continue;
      }

      // Still within grace period — attempt retry
      const priceCents = metadata.price_cents;
      const billingCycle = metadata.billing_cycle;
      const paymentMethodId = metadata.payment_method_id;

      if (!paymentMethodId || !priceCents) {
        // Can't retry without payment method — skip (will be caught when grace expires)
        continue;
      }

      const feature = await prisma.features_list.findUnique({
        where: { key: purchase.feature_key },
        select: { name: true },
      });
      const featureName = feature?.name || purchase.feature_key;

      const billingService = getSubscriptionBillingService();
      const chargeResult = await billingService.chargePaymentMethod(
        purchase.tenant_id,
        paymentMethodId,
        priceCents,
        `BSaaS renewal retry: ${featureName}`
      );

      if (chargeResult.success) {
        // Retry succeeded — reactivate
        const newExpiresAt = billingCycle === 'monthly'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        await prisma.tenant_feature_purchases.update({
          where: { id: purchase.id },
          data: {
            status: 'active',
            expires_at: newExpiresAt,
            updated_at: new Date(),
            metadata: {
              ...metadata,
              grace_ends_at: null,
              last_renewed_at: new Date().toISOString(),
              last_transaction_id: chargeResult.transactionId,
            },
          },
        });

        result.renewed++;
        console.log(`[BSaaS Renewal] Retry succeeded for ${purchase.feature_key} (tenant ${purchase.tenant_id})`);

        const notificationService = getBillingNotificationService();
        notificationService.sendNotification({
          tenantId: purchase.tenant_id,
          type: 'bsaas_renewal_success',
          amount: priceCents,
          billingCycle: billingCycle as 'monthly' | 'annual',
          metadata: { featureKey: purchase.feature_key, featureName },
        }).catch(err => console.error('[BSaaS Renewal] Failed to send retry success notification:', err));
      } else {
        // Retry failed — send grace period warning with remaining days
        const daysRemaining = graceEndsAt
          ? Math.ceil((graceEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          : GRACE_PERIOD_DAYS;

        console.log(`[BSaaS Renewal] Retry failed for ${purchase.id}, ${daysRemaining} days remaining in grace period`);

        const notificationService = getBillingNotificationService();
        notificationService.sendNotification({
          tenantId: purchase.tenant_id,
          type: 'bsaas_grace_period_warning',
          amount: priceCents,
          billingCycle: billingCycle as 'monthly' | 'annual',
          gracePeriodDaysRemaining: daysRemaining,
          reason: chargeResult.error || 'Payment declined',
          metadata: { featureKey: purchase.feature_key, featureName },
        }).catch(err => console.error('[BSaaS Renewal] Failed to send grace warning:', err));
      }
    } catch (error: any) {
      console.error(`[BSaaS Renewal] Error retrying past_due purchase ${purchase.id}:`, error);
      result.errors.push(`Retry ${purchase.id}: ${error.message}`);
    }
  }

  // 3. Expire cancelled purchases that have reached end of billing period
  // Skip companion purchases — they have no expiry to check
  const cancelledExpiring = await prisma.tenant_feature_purchases.findMany({
    where: {
      status: 'cancelled',
      expires_at: { lt: now },
      source: 'bsaas',
    },
  });

  for (const purchase of cancelledExpiring) {
    try {
      await prisma.tenant_feature_purchases.update({
        where: { id: purchase.id },
        data: {
          status: 'expired',
          updated_at: new Date(),
        },
      });

      invalidateEffectiveCapabilities(purchase.tenant_id);
      result.expired++;
      console.log(`[BSaaS Renewal] Expired cancelled purchase ${purchase.id} for tenant ${purchase.tenant_id}`);
    } catch (error: any) {
      console.error(`[BSaaS Renewal] Error expiring purchase ${purchase.id}:`, error);
      result.errors.push(`Expire ${purchase.id}: ${error.message}`);
    }
  }

  // 4. Suspend active purchases whose expiry has passed (missed renewal)
  //    These get a grace period instead of immediate suspension
  // Skip companion purchases — they have no expiry (expires_at=null)
  const overduePurchases = await prisma.tenant_feature_purchases.findMany({
    where: {
      status: 'active',
      expires_at: { lt: now },
      source: 'bsaas',
    },
  });

  for (const purchase of overduePurchases) {
    try {
      await enterGracePeriod(purchase, 'Renewal window missed — purchase expired', result);
    } catch (error: any) {
      console.error(`[BSaaS Renewal] Error entering grace period for overdue purchase ${purchase.id}:`, error);
      result.errors.push(`Grace ${purchase.id}: ${error.message}`);
    }
  }

  console.log(`[BSaaS Renewal] Complete. Renewed: ${result.renewed}, Past Due: ${result.pastDue}, Suspended: ${result.suspended}, Expired: ${result.expired}, Errors: ${result.errors.length}`);
  return result;
}

/**
 * Enter grace period for a purchase (sets status='past_due', stores grace_ends_at in metadata)
 */
async function enterGracePeriod(
  purchase: any,
  reason: string,
  result: BsaasRenewalResult,
  featureName?: string,
  priceCents?: number,
  billingCycle?: string
): Promise<void> {
  const metadata = (purchase.metadata as any) || {};
  const graceEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await prisma.tenant_feature_purchases.update({
    where: { id: purchase.id },
    data: {
      status: 'past_due',
      updated_at: new Date(),
      metadata: {
        ...metadata,
        grace_ends_at: graceEndsAt.toISOString(),
        grace_period_reason: reason,
      },
    },
  });

  result.pastDue++;
  console.log(`[BSaaS Renewal] Entered grace period for purchase ${purchase.id} (feature: ${purchase.feature_key}, tenant: ${purchase.tenant_id}): ${reason}`);

  // Send grace period warning notification
  const notificationService = getBillingNotificationService();
  notificationService.sendNotification({
    tenantId: purchase.tenant_id,
    type: 'bsaas_grace_period_warning',
    amount: priceCents || metadata.price_cents,
    billingCycle: (billingCycle || metadata.billing_cycle) as 'monthly' | 'annual',
    gracePeriodDaysRemaining: GRACE_PERIOD_DAYS,
    reason,
    metadata: {
      featureKey: purchase.feature_key,
      featureName: featureName || metadata.feature_name || purchase.feature_key,
    },
  }).catch(err => console.error('[BSaaS Renewal] Failed to send grace period notification:', err));
}

/**
 * Suspend a purchase and invalidate capabilities
 */
async function suspendPurchase(
  purchaseId: string,
  tenantId: string,
  featureKey: string,
  reason: string
): Promise<void> {
  await prisma.tenant_feature_purchases.update({
    where: { id: purchaseId },
    data: {
      status: 'suspended',
      updated_at: new Date(),
    },
  });

  invalidateEffectiveCapabilities(tenantId);
  console.log(`[BSaaS Renewal] Suspended purchase ${purchaseId} (feature: ${featureKey}, tenant: ${tenantId}): ${reason}`);
}

/**
 * Start the scheduled job
 * Runs daily at midnight
 */
let jobInterval: NodeJS.Timeout | null = null;

export function startBsaasRenewalJob(): void {
  if (jobInterval) {
    console.log('[BSaaS Renewal] Job already running');
    return;
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  console.log(`[BSaaS Renewal] Scheduling first run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

  setTimeout(() => {
    processBsaasRenewals().catch(console.error);

    jobInterval = setInterval(() => {
      processBsaasRenewals().catch(console.error);
    }, 24 * 60 * 60 * 1000);

    console.log('[BSaaS Renewal] Daily job started');
  }, msUntilMidnight);

  console.log('[BSaaS Renewal] Scheduler initialized');
}

export function stopBsaasRenewalJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[BSaaS Renewal] Job stopped');
  }
}

/**
 * Manual trigger for testing
 */
export async function triggerBsaasRenewalJob(): Promise<BsaasRenewalResult> {
  console.log('[BSaaS Renewal] Manual trigger');
  return processBsaasRenewals();
}
