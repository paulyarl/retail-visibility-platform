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

export type TenantLimitTier = 'google_only' | 'starter'| 'discovery' | 'commitment' | 'storefront' | 'professional' | 'enterprise' | 'organization';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'expired';

/**
 * Featured Products Limits by Subscription Tier
 * These limits control how many products can be featured for each type
 */
export interface FeaturedProductsLimit {
   bestseller: number;
  clearance: number;
  featured: number;
  new_arrival: number;
  recommended: number;
  sale: number;
  seasonal: number;
  staff_pick: number;
  store_selection: number;
  trending: number;
}

/**
 * Featured products limits by tier
 */
export const FEATURED_PRODUCTS_LIMITS: Record<TenantLimitTier, FeaturedProductsLimit> = {
  google_only: {
    bestseller: 3,
    clearance: 3,
    featured: 3,
    new_arrival: 3,
    recommended: 3,
    sale: 3,
    seasonal: 2,
    staff_pick: 2,
    store_selection: 3,
    trending: 3,
  },
  discovery: {
    bestseller: 3,
    clearance: 3,
    featured: 3,
    new_arrival: 3,
    recommended: 3,
    sale: 3,
    seasonal: 2,
    staff_pick: 2,
    store_selection: 3,
    trending: 3,
  },
  starter: {
    bestseller: 8,
    clearance: 8,
    featured: 8,
    new_arrival: 12,
    recommended: 12,
    sale: 10,
    seasonal: 6,
    staff_pick: 6,
    store_selection: 8,
    trending: 8,
  },
  storefront: {
    bestseller: 8,
    clearance: 8,
    featured: 8,
    new_arrival: 12,
    recommended: 12,
    sale: 10,
    seasonal: 6,
    staff_pick: 6,
    store_selection: 8,
    trending: 8,
  },
  commitment: {
    bestseller: 15,
    clearance: 15,
    featured: 15,
    new_arrival: 20,
    recommended: 20,
    sale: 15,
    seasonal: 12,
    staff_pick: 10,
    store_selection: 15,
    trending: 15,
  },
  professional: {
    bestseller: 15,
    clearance: 15,
    featured: 15,
    new_arrival: 20,
    recommended: 20,
    sale: 15,
    seasonal: 12,
    staff_pick: 10,
    store_selection: 15,
    trending: 15,
  },
  enterprise: {
    bestseller: 25,
    clearance: 25,
    featured: 25,
    new_arrival: 30,
    recommended: 30,
    sale: 25,
    seasonal: 20,
    staff_pick: 15,
    store_selection: 25,
    trending: 25,
  },
  organization: {
    bestseller: 50,
    clearance: 50,
    featured: 50,
    new_arrival: 50,
    recommended: 50,
    sale: 50,
    seasonal: 40,
    staff_pick: 30,
    store_selection: 50,
    trending: 50,
  },
};

/**
 * Get featured products limits for a tenant based on their tier
 * Falls back to starter tier limits if tier not found
 */
export function getFeaturedProductsLimits(tier?: TenantLimitTier): FeaturedProductsLimit {
  if (!tier) return FEATURED_PRODUCTS_LIMITS.starter;
  return FEATURED_PRODUCTS_LIMITS[tier] || FEATURED_PRODUCTS_LIMITS.starter;
}

/**
 * Platform support tenant creation limit per owner
 * PLATFORM_SUPPORT can only create up to 3 tenants per owner (regardless of owner's tier)
 * This applies whether creating for themselves or for a customer
 */
export const PLATFORM_SUPPORT_LIMIT = 3;

export interface TenantLimitConfig {
  limit: number;
  displayName: string; // Display name for the limit
  description: string; // Description of the limit
  upgradeMessage: string; // Message to display when limit is reached
  upgradeToTier?: TenantLimitTier; // Tier to upgrade to
}

/**
 * Trial period configuration
 */
export const TRIAL_CONFIG = {
  durationDays: 14,
  locationLimit: 1,
  displayName: '1 Location (Trial)',
  description: '14-day trial with 1 location to test the platform',
  upgradeMessage: 'Convert to paid plan to unlock full location limits',
};

/**
 * Location limits by tier (for PAID subscriptions)
 */
export const TENANT_LIMITS: Record<TenantLimitTier, TenantLimitConfig> = {
  google_only: {
    limit: 1,
    displayName: '1 Location',
    description: 'Google-only sync for one location',
    upgradeMessage: 'Upgrade to Starter for 3 locations + storefront',
    upgradeToTier: 'starter',
  },
  
  starter: {
    limit: 3,
    displayName: 'Up to 3 Locations',
    description: 'Perfect for small businesses with multiple locations',
    upgradeMessage: 'Upgrade to Professional to manage up to 10 locations',
    upgradeToTier: 'professional',
  },
  
  discovery: {
    limit: 3,
    displayName: 'Up to 3 Locations',
    description: 'Perfect for small businesses with multiple locations',
    upgradeMessage: 'Upgrade to Professional to manage up to 10 locations',
    upgradeToTier: 'professional',
  },
  
  storefront: {
    limit: 3,
    displayName: 'Up to 3 Locations',
    description: 'Perfect for small businesses with multiple locations',
    upgradeMessage: 'Upgrade to Professional to manage up to 10 locations',
    upgradeToTier: 'professional',
  },
  
  commitment: {
    limit: 10,
    displayName: 'Up to 10 Locations',
    description: 'Great for growing chains',
    upgradeMessage: 'Upgrade to Organization for unlimited locations',
    upgradeToTier: 'organization',
  },
  professional: {
    limit: 10,
    displayName: 'Up to 10 Locations',
    description: 'Great for growing chains',
    upgradeMessage: 'Upgrade to Organization for unlimited locations',
    upgradeToTier: 'organization',
  },
  
  enterprise: {
    limit: 25,
    displayName: 'Up to 25 Locations',
    description: 'Enterprise-grade management',
    upgradeMessage: 'Contact us for unlimited locations',
    upgradeToTier: 'organization',
  },
  
  organization: {
    limit: Infinity,
    displayName: 'Unlimited Locations', // Display name for the limit
    description: 'Unlimited locations for your chain', // Description of the limit
    upgradeMessage: '', // Message to display when limit is reached
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
      displayName: TRIAL_CONFIG.displayName,
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
