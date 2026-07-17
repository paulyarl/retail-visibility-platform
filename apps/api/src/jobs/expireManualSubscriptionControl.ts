import { prisma } from '../prisma';
import { logger } from '../logger';

/**
 * Background job to expire manual subscription control
 * This should be run daily to check for expired manual control
 */
export async function expireManualSubscriptionControl(): Promise<void> {
  try {
    console.log('[ManualSubscriptionControl] Checking for expired manual control...');
    
    const now = new Date();
    
    // Find tenants with expired manual control
    const expiredTenants = await prisma.tenants.findMany({
      where: {
        manual_subscription_control: true,
        manual_subscription_expires_at: {
          lt: now
        }
      },
      select: {
        id: true,
        name: true,
        manual_subscription_expires_at: true,
        subscription_status: true,
        subscription_tier: true
      }
    });

    if (expiredTenants.length === 0) {
      console.log('[ManualSubscriptionControl] No expired manual control found');
      return;
    }

    console.log(`[ManualSubscriptionControl] Found ${expiredTenants.length} tenants with expired manual control`);

    // Disable manual control for expired tenants
    await prisma.tenants.updateMany({
      where: {
        id: {
          in: expiredTenants.map(t => t.id)
        }
      },
      data: {
        manual_subscription_control: false,
        manual_subscription_expires_at: null,
        manual_subscription_reason: null,
        updated_at: now
      }
    });

    // Log the changes
    expiredTenants.forEach(tenant => {
      console.log(`[ManualSubscriptionControl] Disabled manual control for tenant ${tenant.name} (${tenant.id}) - expired on ${tenant.manual_subscription_expires_at}`);
    });

    // If any of these tenants are in trial or past_due status, trigger normal expiration processing
    const trialTenants = expiredTenants.filter(t => 
      t.subscription_status === 'trial' || t.subscription_status === 'past_due'
    );

    if (trialTenants.length > 0) {
      console.log(`[ManualSubscriptionControl] ${trialTenants.length} tenants need normal expiration processing`);
      // This would trigger the normal trial expiration process
      // You might want to call TrialManagementService.processTrialEnd for these tenants
    }

  } catch (error) {
    logger.error('[ManualSubscriptionControl] Error checking expired manual control:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  }
}
