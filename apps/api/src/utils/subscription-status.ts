import { tenant, organization } from "@prisma/client";

/**
 * Internal subscription status enum (derived from Tenant fields)
 * 
 * This represents the actual operational state of a subscription,
 * derived from subscriptionStatus, subscriptionTier, and date fields.
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
 * Internal maintenance state for google_only and inactive subscriptions.
 *
 * - `maintenance`: limited maintenance window (google_only + within boundary)
 * - `freeze`: full read-only visibility mode (inactive or outside boundary)
 * - `null`: no special maintenance/freeze semantics
 */
export type MaintenanceState = 'maintenance' | 'freeze' | null;

interface MaintenanceContext {
  tier: string | null | undefined;
  status: string | null | undefined;
  trialEndsAt?: Date | null;
}

/**
 * Derive maintenance/freeze state for a tenant based on tier, status, and trial end.
 *
 * This mirrors the frontend logic in SubscriptionStatusGuide:
 * - google_only + active + trialEndsAt in the future (or missing) => maintenance
 * - canceled/expired => freeze
 * - google_only outside maintenance window => freeze
 */
export function getMaintenanceState(ctx: MaintenanceContext): MaintenanceState {
  const tier = ctx.tier || 'starter';
  const status = ctx.status || 'active';
  const now = new Date();

  const isInactive = status === 'canceled' || status === 'expired';

  let inMaintenanceWindow = false;

  if (tier === 'google_only' && !isInactive) {
    if (!ctx.trialEndsAt) {
      inMaintenanceWindow = true;
    } else {
      const boundary = new Date(ctx.trialEndsAt);
      if (!Number.isNaN(boundary.getTime()) && now < boundary) {
        inMaintenanceWindow = true;
      }
    }
  }

  const isFullyFrozen = isInactive || (tier === 'google_only' && !inMaintenanceWindow);

  if (inMaintenanceWindow) return 'maintenance';
  if (isFullyFrozen) return 'freeze';
  return null;
}

/**
 * Derive the internal operational status from tenant subscription fields.
 * 
 * This is the single source of truth for determining what a tenant can do.
 * 
 * Lifecycle:
 * 1. Trial (14 days) → Full access within tier limits
 * 2. Trial expires → Auto-downgrade to google_only (maintenance tier)
 * 3. Maintenance (google_only + within trialEndsAt) → Can maintain, no growth
 * 4. Freeze (google_only + past trialEndsAt OR canceled/expired) → Read-only
 * 
 * @param tenant - Tenant object with subscription fields
 * @returns InternalStatus enum value
 */
export function deriveInternalStatus(tenant: {
  subscription_status: string | null;
  subscription_tier: string | null;
  trialEndsAt: Date | null;
  subscription_ends_at: Date | null;
}): InternalStatus {
  const now = new Date();
  const status = tenant.subscription_status || 'active';
  const tier = tenant.subscriptionTier || 'starter';

  // 1. Check for explicit canceled status
  if (status === 'canceled') {
    return 'canceled';
  }

  // 2. Check for explicit expired status
  if (status === 'expired') {
    return 'expired';
  }

  // 3. Check for past_due status (payment failed, grace period)
  if (status === 'past_due') {
    return 'past_due';
  }

  // 4. Check for active trial
  if (status === 'trial') {
    // If trial hasn't expired yet, it's trialing
    if (!tenant.trialEndsAt || tenant.trialEndsAt > now) {
      return 'trialing';
    }
    // Trial expired but status not updated yet - treat as expired
    // (This shouldn't happen after GET /tenants/:id auto-downgrade, but handle it)
    return 'expired';
  }

  // 5. Check for active paid subscription
  if (status === 'active') {
    // Check if subscription has expired
    if (tenant.subscriptionEndsAt && tenant.subscriptionEndsAt < now) {
      return 'expired';
    }

    // Check if this is google_only tier (internal maintenance tier)
    if (tier === 'google_only') {
      // google_only is maintenance tier for expired trials
      // Check if still within maintenance window (uses trialEndsAt as boundary)
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
