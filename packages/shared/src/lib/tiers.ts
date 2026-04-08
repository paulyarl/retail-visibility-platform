/**
 * Shared tier configuration for API and Web
 * 
 * Trial wrappers (trial_*) provide full tier benefits during 14-day trial period.
 * expired_trial is a virtual tier for tenants who didn't convert after trial+grace period.
 */

// Trial-eligible tiers (can be wrapped in trial_*)
export const TRIAL_ELIGIBLE_TIERS = ['google_only', 'starter', 'professional', 'chain_starter'] as const;
export type TrialEligibleTier = typeof TRIAL_ELIGIBLE_TIERS[number];

// Trial duration constants
export const TRIAL_DURATION_DAYS = 14;
export const GRACE_DURATION_DAYS = 14;
export const TOTAL_TRIAL_DAYS = TRIAL_DURATION_DAYS + GRACE_DURATION_DAYS; // 30 days

/**
 * Check if a tier is a trial wrapper
 */
export function isTrialTier(tier: string): boolean {
  return tier.startsWith('trial_');
}

/**
 * Get the target tier from a trial wrapper
 */
export function getTrialTargetTier(trialTier: string): string | null {
  if (!isTrialTier(trialTier)) return null;
  return trialTier.replace('trial_', '');
}

/**
 * Check if a tier is trial-eligible
 */
export function isTrialEligibleTier(tier: string): tier is TrialEligibleTier {
  return TRIAL_ELIGIBLE_TIERS.includes(tier as TrialEligibleTier);
}

/**
 * Create a trial wrapper tier from a target tier
 */
export function createTrialTier(targetTier: TrialEligibleTier): string {
  return `trial_${targetTier}`;
}

/**
 * Check if tenant is in expired trial state
 */
export function isExpiredTrial(tier: string): boolean {
  return tier === 'expired_trial';
}
