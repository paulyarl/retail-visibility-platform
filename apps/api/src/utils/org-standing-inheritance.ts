/**
 * Org Standing Inheritance Utility
 *
 * Asymmetric inheritance: if a tenant is in 'inherited' mode and its org
 * is in good standing, the tenant is treated as active regardless of its
 * own subscription status. Org bad standing does NOT drag the tenant down.
 */

import { prisma } from '../prisma';
import { deriveInternalStatus } from './subscription-status';

export interface OrgStandingResult {
  /** Whether the tenant is effectively in good standing (active/trialing/past_due) */
  inGoodStanding: boolean;
  /** The effective subscription status to use (may be overridden by org) */
  effectiveStatus: string;
  /** The effective subscription tier to use (may be overridden by org) */
  effectiveTier: string;
  /** Whether org inheritance was applied */
  inherited: boolean;
}

/**
 * Check if a tenant inherits good standing from its organization.
 * Returns the effective status/tier after applying asymmetric inheritance.
 */
export async function resolveOrgStandingInheritance(tenantId: string): Promise<OrgStandingResult | null> {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: {
      subscription_status: true,
      subscription_tier: true,
      trial_ends_at: true,
      subscription_ends_at: true,
      organization_id: true,
      org_standing_mode: true,
      organizations_list: {
        select: {
          subscription_status: true,
          subscription_tier: true,
        },
      },
    },
  });

  if (!tenant) return null;

  const standingMode = tenant.org_standing_mode || 'independent';
  const ownStatus = tenant.subscription_status || 'active';
  const ownTier = tenant.subscription_tier || 'starter';

  // Default: tenant's own status
  let effectiveStatus = ownStatus;
  let inherited = false;

  if (standingMode === 'inherited' && tenant.organizations_list) {
    const orgInternalStatus = deriveInternalStatus({
      subscription_status: tenant.organizations_list.subscription_status,
      subscription_tier: tenant.organizations_list.subscription_tier,
      trialEndsAt: null,
      subscription_ends_at: null,
    });

    // Only lift up — org active/trialing/past_due rescues a frozen/canceled/expired tenant
    // Tenant's own tier is NEVER replaced — capabilities are always from the tenant's tier.
    if (orgInternalStatus === 'active' || orgInternalStatus === 'trialing' || orgInternalStatus === 'past_due') {
      effectiveStatus = 'active';
      inherited = true;
    }
    // If org is also bad, fall through with tenant's own status (no change)
  }

  const effectiveInternalStatus = deriveInternalStatus({
    subscription_status: effectiveStatus,
    subscription_tier: ownTier,
    trialEndsAt: tenant.trial_ends_at,
    subscription_ends_at: tenant.subscription_ends_at,
  });

  const inGoodStanding = effectiveInternalStatus === 'active' || effectiveInternalStatus === 'trialing' || effectiveInternalStatus === 'past_due';

  return {
    inGoodStanding,
    effectiveStatus,
    effectiveTier: ownTier,
    inherited,
  };
}

/**
 * Synchronous helper: resolve effective subscription status from already-fetched tenant data.
 * Use this inline when you already have the tenant row with org_standing_mode and organizations_list.
 * Avoids an extra DB query compared to resolveOrgStandingInheritance().
 */
export function resolveEffectiveStatusFromTenant(tenant: {
  subscription_status: string | null;
  org_standing_mode?: string | null;
  organizations_list?: { subscription_status: string | null; subscription_tier: string | null } | null;
}): { effectiveStatus: string; inherited: boolean } {
  const standingMode = tenant.org_standing_mode || 'independent';
  const ownStatus = tenant.subscription_status || 'active';

  if (standingMode === 'inherited' && tenant.organizations_list) {
    const orgInternalStatus = deriveInternalStatus({
      subscription_status: tenant.organizations_list.subscription_status,
      subscription_tier: tenant.organizations_list.subscription_tier,
      trialEndsAt: null,
      subscription_ends_at: null,
    });
    if (orgInternalStatus === 'active' || orgInternalStatus === 'trialing' || orgInternalStatus === 'past_due') {
      return { effectiveStatus: 'active', inherited: true };
    }
  }

  return { effectiveStatus: ownStatus, inherited: false };
}
