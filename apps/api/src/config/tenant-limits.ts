/**
 * Tenant (Location) Limits by Subscription Tier and Status
 * 
 * IMPORTANT: Trial is a STATUS, not a tier!
 * - Trial Status: 14 days, 1 location max (regardless of tier)
 * - After trial: Full tier limits apply
 * 
 * User can sign up for any tier (google_only, starter, professional)
 * but during trial period, they're limited to 1 location.
 * 
 * PLATFORM ROLES:
 * - PLATFORM_ADMIN: Unlimited tenant creation (no limits)
 * - PLATFORM_SUPPORT: Limited to 3 tenants per owner (regardless of owner's tier)
 * - PLATFORM_VIEWER: Read-only, cannot create tenants
 */

export type TenantLimitTier = 'google_only' | 'starter' | 'professional' | 'enterprise' | 'organization';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'expired';

/**
 * Platform support tenant creation limit per owner
 * PLATFORM_SUPPORT can only create up to 3 tenants per owner (regardless of owner's tier)
 * This applies whether creating for themselves or for a customer
 */
export const PLATFORM_SUPPORT_LIMIT = 3;

export interface TenantLimitConfig {
  limit: number;
  display_name: string;
  description: string;
  upgradeMessage: string;
  upgradeToTier?: TenantLimitTier;
}

/**
 * Trial period configuration
 */
export const TRIAL_CONFIG = {
  durationDays: 14,
  locationLimit: 1,
  display_name: '1 Location (Trial)',
  description: '14-day trial with 1 location to test the platform',
  upgradeMessage: 'Convert to paid plan to unlock full location limits',
};

/**
 * Location limits by tier (for PAID subscriptions)
 */
export const TENANT_LIMITS: Record<TenantLimitTier, TenantLimitConfig> = {
  google_only: {
    limit: 1,
    display_name: '1 Location',
    description: 'Google-only sync for one location',
    upgradeMessage: 'Upgrade to Starter for 3 locations + storefront',
    upgradeToTier: 'starter',
  },
  
  starter: {
    limit: 3,
    display_name: 'Up to 3 Locations',
    description: 'Perfect for small businesses with multiple locations',
    upgradeMessage: 'Upgrade to Professional to manage up to 10 locations',
    upgradeToTier: 'professional',
  },
  
  professional: {
    limit: 10,
    display_name: 'Up to 10 Locations',
    description: 'Great for growing chains',
    upgradeMessage: 'Upgrade to Organization for unlimited locations',
    upgradeToTier: 'organization',
  },
  
  enterprise: {
    limit: 25,
    display_name: 'Up to 25 Locations',
    description: 'Enterprise-grade management',
    upgradeMessage: 'Contact us for unlimited locations',
    upgradeToTier: 'organization',
  },
  
  organization: {
    limit: Infinity,
    display_name: 'Unlimited Locations',
    description: 'Unlimited locations for your chain',
    upgradeMessage: '',
  },
};

/**
 * Get tenant limit for a specific tier and status
 * 
 * CRITICAL: Trial status overrides tier limits!
 */
export function getTenantLimit(tier: string, status?: string): number {
  // Trial status always limits to 1 location
  if (status === 'trial') {
    return TRIAL_CONFIG.locationLimit;
  }
  
  // Paid subscriptions use tier limits
  const config = TENANT_LIMITS[tier as TenantLimitTier];
  return config?.limit ?? 1; // Default to 1 if tier not found
}

/**
 * Get platform support limit
 * PLATFORM_SUPPORT can create up to 3 tenants per owner (regardless of owner's tier)
 */
export function getPlatformSupportLimit(): number {
  return PLATFORM_SUPPORT_LIMIT;
}

/**
 * Get tenant limit config for a specific tier and status
 */
export function getTenantLimitConfig(tier: string, status?: string): TenantLimitConfig {
  // Trial status uses trial config
  if (status === 'trial') {
    return {
      limit: TRIAL_CONFIG.locationLimit,
      display_name: TRIAL_CONFIG.display_name,
      description: TRIAL_CONFIG.description,
      upgradeMessage: TRIAL_CONFIG.upgradeMessage,
      upgradeToTier: tier as TenantLimitTier, // Keep same tier, just convert to paid
    };
  }
  
  // Paid subscriptions use tier config
  return TENANT_LIMITS[tier as TenantLimitTier] ?? TENANT_LIMITS.starter;
}

/**
 * Check if user can create more tenants
 */
export function canCreateTenant(currentCount: number, tier: string, status?: string): boolean {
  const limit = getTenantLimit(tier, status);
  return currentCount < limit;
}

/**
 * Get remaining tenant slots
 */
export function getRemainingTenantSlots(currentCount: number, tier: string, status?: string): number {
  const limit = getTenantLimit(tier, status);
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - currentCount);
}

/**
 * Get upgrade message for when limit is reached
 */
export function getUpgradeMessage(tier: string, status?: string): string {
  const config = getTenantLimitConfig(tier, status);
  return config.upgradeMessage;
}

/**
 * Get next tier to upgrade to
 */
export function getUpgradeTier(tier: string, status?: string): TenantLimitTier | undefined {
  const config = getTenantLimitConfig(tier, status);
  return config.upgradeToTier;
}
