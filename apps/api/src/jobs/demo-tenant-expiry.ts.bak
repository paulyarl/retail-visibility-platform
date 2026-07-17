/**
 * Demo Tenant Expiry Job
 *
 * Runs hourly to find and expire demo tenants whose demo_expires_at
 * has passed. Marks them as closed and hides from directory.
 */

import demoTenantService from '../services/DemoTenantService';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let intervalId: NodeJS.Timeout | null = null;

async function runExpiryCheck(): Promise<void> {
  try {
    const expired = await demoTenantService.findExpiredDemoTenants();

    if (expired.length === 0) return;

    console.log(`[Demo Expiry Job] Found ${expired.length} expired demo tenant(s)`);

    for (const tenant of expired) {
      try {
        const result = await demoTenantService.expireDemoTenant(tenant.id);
        if (result.expired) {
          console.log(`[Demo Expiry Job] Expired: ${tenant.id} (${tenant.name})`);
        } else {
          console.warn(`[Demo Expiry Job] Could not expire ${tenant.id}: ${result.reason}`);
        }
      } catch (error) {
        console.error(`[Demo Expiry Job] Error expiring ${tenant.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Demo Expiry Job] Error running expiry check:', error);
  }
}

export function startDemoExpiryJob(): void {
  if (intervalId) {
    console.log('[Demo Expiry Job] Already running');
    return;
  }

  console.log('[Demo Expiry Job] Starting (runs every 1 hour)');

  // Run immediately on startup
  runExpiryCheck().catch(err =>
    console.error('[Demo Expiry Job] Initial run failed:', err)
  );

  intervalId = setInterval(() => {
    runExpiryCheck().catch(err =>
      console.error('[Demo Expiry Job] Scheduled run failed:', err)
    );
  }, CHECK_INTERVAL_MS);
}

export function stopDemoExpiryJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Demo Expiry Job] Stopped');
  }
}
