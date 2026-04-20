/**
 * Trial Tier Transparency Utility
 * 
 * Makes trial tiers transparent to frontend by presenting them as their base tiers.
 * This ensures consistent UI/UX behavior regardless of trial status.
 * 
 * Frontend should always see the "effective" tier, not the trial wrapper.
 */

/**
 * Map trial tiers to their base tiers for frontend presentation
 */
function getBaseTierForTrial(tierKey: string): string | null {
  const trialToBaseMap: Record<string, string> = {
    'trial_google_only': 'google_only',
    'trial_discovery': 'discovery',
    'trial_storefront': 'storefront',
    'trial_commitment': 'commitment',
    'trial_starter': 'starter',
    'trial_professional': 'professional',
    'trial_chain_starter': 'chain_starter',
    'trial_chain_professional': 'chain_professional',
    'trial_chain_enterprise': 'chain_enterprise',
    // expired_trial has no base tier - it's a terminal state
  };
  
  return trialToBaseMap[tierKey] || null;
}

/**
 * Check if a tier is a trial tier
 */
export function isTrialTier(tierKey: string): boolean {
  return tierKey.startsWith('trial_') || tierKey === 'expired_trial';
}

/**
 * Get the effective tier for frontend presentation
 * Trial tiers are transparent and show as their base tiers
 */
export function getEffectiveTier(tierKey: string | null | undefined): string {
  if (!tierKey) return 'discovery';
  
  // If it's a trial tier, return the base tier for frontend
  const baseTier = getBaseTierForTrial(tierKey);
  return baseTier || tierKey;
}

/**
 * Get the effective tier with trial status metadata
 * Returns the base tier for UI but includes trial information for status display
 */
export function getEffectiveTierWithTrialInfo(tierKey: string | null | undefined, subscriptionStatus?: string | null, trialEndsAt?: Date | null): {
  effectiveTier: string;
  isTrial: boolean;
  trialStatus?: string;
  trialEndsAt?: Date | null;
} {
  if (!tierKey) {
    return { effectiveTier: 'discovery', isTrial: false };
  }
  
  const isTrial = isTrialTier(tierKey);
  const effectiveTier = getEffectiveTier(tierKey);
  
  return {
    effectiveTier,
    isTrial,
    trialStatus: isTrial ? subscriptionStatus || undefined : undefined,
    trialEndsAt: isTrial ? trialEndsAt : undefined,
  };
}

/**
 * Transform tenant data for frontend consumption
 * Makes trial tiers transparent while preserving trial metadata
 */
export function transformTenantForFrontend(tenant: any): any {
  const { effectiveTier, isTrial, trialStatus, trialEndsAt } = getEffectiveTierWithTrialInfo(
    tenant.subscription_tier,
    tenant.subscription_status,
    tenant.trial_ends_at
  );
  
  return {
    ...tenant,
    // Use effective tier for all frontend logic
    subscription_tier: effectiveTier,
    // Preserve trial information for status display
    is_trial: isTrial,
    trial_status: trialStatus,
    trial_ends_at: trialEndsAt,
    // Keep original tier for admin reference
    original_subscription_tier: tenant.subscription_tier,
  };
}

/**
 * Transform an array of tenants for frontend consumption
 */
export function transformTenantsForFrontend(tenants: any[]): any[] {
  return tenants.map(transformTenantForFrontend);
}

/**
 * Get tier display name that shows trial status appropriately
 */
export function getTierDisplayName(tierKey: string, subscriptionStatus?: string | null): string {
  const isTrial = isTrialTier(tierKey);
  const effectiveTier = getEffectiveTier(tierKey);
  
  // For trial tiers, show the base tier name
  // Trial status is handled separately in the UI
  return effectiveTier;
}
