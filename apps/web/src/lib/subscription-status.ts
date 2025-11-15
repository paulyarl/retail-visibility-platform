/**
 * Frontend subscription status utilities
 * Mirrors backend logic from apps/api/src/utils/subscription-status.ts
 */

/**
 * Internal subscription status enum (derived from subscription fields)
 */
export type InternalStatus = 
  | 'trialing'      // Active trial period (14 days)
  | 'active'        // Paid subscription in good standing
  | 'past_due'      // Payment failed, within grace period
  | 'maintenance'   // google_only tier, can maintain but not grow
  | 'frozen'        // Read-only visibility mode
  | 'canceled'      // Explicitly canceled
  | 'expired';      // Trial or subscription expired

/**
 * Maintenance state for UI display
 */
export type MaintenanceState = 'maintenance' | 'freeze' | null;

/**
 * Derive the internal operational status from tenant subscription fields.
 * 
 * This mirrors the backend logic and is the single source of truth for UI behavior.
 * 
 * Lifecycle:
 * 1. Trial (14 days) → Full access within tier limits
 * 2. Trial expires → Auto-downgrade to google_only (maintenance tier)
 * 3. Maintenance (google_only + within trialEndsAt) → Can maintain, no growth
 * 4. Freeze (google_only + past trialEndsAt OR canceled/expired) → Read-only
 */
export function deriveInternalStatus(tenant: {
  subscriptionStatus: string | null | undefined;
  subscriptionTier: string | null | undefined;
  trialEndsAt?: string | Date | null;
  subscriptionEndsAt?: string | Date | null;
}): InternalStatus {
  const now = new Date();
  const status = tenant.subscriptionStatus || 'active';
  const tier = tenant.subscriptionTier || 'starter';

  // 1. Check for explicit canceled status
  if (status === 'canceled') {
    return 'canceled';
  }

  // 2. Check for past_due status (payment failed, grace period)
  if (status === 'past_due') {
    return 'past_due';
  }

  // 3. Check for active trial
  if (status === 'trial') {
    // If trial hasn't expired yet, it's trialing
    if (!tenant.trialEndsAt) {
      return 'trialing';
    }
    const trialEnd = new Date(tenant.trialEndsAt);
    if (!Number.isNaN(trialEnd.getTime()) && trialEnd > now) {
      return 'trialing';
    }
    // Trial expired but status not updated yet - treat as expired
    return 'expired';
  }

  // 4. Check for explicit expired status (from auto-downgrade)
  if (status === 'expired') {
    // If tier is google_only, check maintenance window
    if (tier === 'google_only') {
      const maintenanceState = getMaintenanceState({
        tier,
        status,
        trialEndsAt: tenant.trialEndsAt,
      });

      if (maintenanceState === 'freeze') {
        return 'frozen';
      }
      return 'maintenance';
    }
    // Non-google_only expired subscriptions
    return 'expired';
  }

  // 5. Check for active paid subscription
  if (status === 'active') {
    // Check if subscription has expired
    if (tenant.subscriptionEndsAt) {
      const subEnd = new Date(tenant.subscriptionEndsAt);
      if (!Number.isNaN(subEnd.getTime()) && subEnd < now) {
        return 'expired';
      }
    }

    // Check if this is google_only tier (internal maintenance tier)
    if (tier === 'google_only') {
      // This shouldn't happen (google_only should have status='expired')
      // but handle it gracefully
      const maintenanceState = getMaintenanceState({
        tier,
        status,
        trialEndsAt: tenant.trialEndsAt,
      });

      if (maintenanceState === 'freeze') {
        return 'frozen';
      }
      return 'maintenance';
    }

    // Regular paid tier with active subscription
    return 'active';
  }

  // Default fallback: treat as active
  return 'active';
}

/**
 * Get maintenance state for google_only tier
 * 
 * Mirrors backend logic from apps/api/src/utils/subscription-status.ts
 */
export function getMaintenanceState(ctx: {
  tier: string | null | undefined;
  status: string | null | undefined;
  trialEndsAt?: string | Date | null;
}): MaintenanceState {
  const tier = ctx.tier || 'starter';
  const status = ctx.status || 'active';
  const now = new Date();

  const isInactive = status === 'canceled' || status === 'expired';

  let inMaintenanceWindow = false;

  if (tier === 'google_only' && !isInactive) {
    if (!ctx.trialEndsAt) {
      inMaintenanceWindow = true; // No boundary = always maintenance
    } else {
      const boundary = new Date(ctx.trialEndsAt);
      if (!Number.isNaN(boundary.getTime()) && now < boundary) {
        inMaintenanceWindow = true; // Within maintenance window
      }
    }
  }

  // For google_only with expired status, check maintenance window
  if (tier === 'google_only' && status === 'expired') {
    if (!ctx.trialEndsAt) {
      inMaintenanceWindow = true;
    } else {
      const boundary = new Date(ctx.trialEndsAt);
      if (!Number.isNaN(boundary.getTime()) && now < boundary) {
        inMaintenanceWindow = true;
      }
    }
  }

  const isFullyFrozen = (isInactive && tier === 'google_only' && !inMaintenanceWindow) || 
                        (tier === 'google_only' && !inMaintenanceWindow);

  if (inMaintenanceWindow) return 'maintenance';
  if (isFullyFrozen) return 'freeze';
  return null;
}

/**
 * Get user-friendly status label
 */
export function getStatusLabel(internalStatus: InternalStatus): string {
  switch (internalStatus) {
    case 'trialing':
      return 'Trial';
    case 'active':
      return 'Active';
    case 'past_due':
      return 'Past Due';
    case 'maintenance':
      return 'Maintenance Mode';
    case 'frozen':
      return 'Frozen';
    case 'canceled':
      return 'Canceled';
    case 'expired':
      return 'Expired';
    default:
      return 'Unknown';
  }
}

/**
 * Get status color for UI
 */
export function getStatusColor(internalStatus: InternalStatus): 'green' | 'yellow' | 'red' | 'gray' {
  switch (internalStatus) {
    case 'trialing':
    case 'active':
      return 'green';
    case 'past_due':
    case 'maintenance':
      return 'yellow';
    case 'frozen':
    case 'expired':
    case 'canceled':
      return 'red';
    default:
      return 'gray';
  }
}
