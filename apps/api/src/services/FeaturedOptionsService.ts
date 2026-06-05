/**
 * Featured Options Service
 *
 * Capability-aware service for resolving and managing featured options.
 * Determines which featured types (tenant-controlled and platform-controlled)
 * are available to a tenant based on their tier capabilities.
 *
 * Works alongside ShopsFeaturedService (data-level) and the
 * capability resolution system (feature-level).
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type FeaturedType =
  // Tenant-controlled
  | 'store_selection' | 'new_arrival' | 'seasonal' | 'sale'
  | 'staff_pick' | 'clearance' | 'featured'
  // Platform-controlled
  | 'bestseller' | 'trending' | 'recommended' | 'random_featured';

export const TENANT_FEATURED_TYPES: FeaturedType[] = [
  'store_selection', 'new_arrival', 'seasonal', 'sale',
  'staff_pick', 'clearance', 'featured',
];

export const PLATFORM_FEATURED_TYPES: FeaturedType[] = [
  'bestseller', 'trending', 'recommended', 'random_featured',
];

export const ALL_FEATURED_TYPES: FeaturedType[] = [
  ...TENANT_FEATURED_TYPES,
  ...PLATFORM_FEATURED_TYPES,
];

export interface FeaturedOptionsState {
  enabled: boolean;
  tenantEnabled: boolean;
  platformEnabled: boolean;
  allowedTenantTypes: FeaturedType[];
  allowedPlatformTypes: FeaturedType[];
  allowedTypes: FeaturedType[];
  isFlexible: boolean;
  featuredAvailable: boolean;
  features: Record<string, boolean>;
}

export interface FeaturedTypeMeta {
  key: FeaturedType;
  label: string;
  description: string;
  group: 'tenant' | 'platform';
}

const FEATURED_TYPE_META: Record<FeaturedType, FeaturedTypeMeta> = {
  store_selection: { key: 'store_selection', label: 'Store Selection', description: 'Hand-picked by the store owner', group: 'tenant' },
  new_arrival: { key: 'new_arrival', label: 'New Arrival', description: 'Recently added products', group: 'tenant' },
  seasonal: { key: 'seasonal', label: 'Seasonal', description: 'Seasonal or holiday products', group: 'tenant' },
  sale: { key: 'sale', label: 'Sale', description: 'Products currently on sale', group: 'tenant' },
  staff_pick: { key: 'staff_pick', label: 'Staff Pick', description: 'Recommended by store staff', group: 'tenant' },
  clearance: { key: 'clearance', label: 'Clearance', description: 'Final sale, while supplies last', group: 'tenant' },
  featured: { key: 'featured', label: 'Featured', description: 'General featured products', group: 'tenant' },
  bestseller: { key: 'bestseller', label: 'Bestseller', description: 'Top-selling products across the platform', group: 'platform' },
  trending: { key: 'trending', label: 'Trending', description: 'Gaining popularity right now', group: 'platform' },
  recommended: { key: 'recommended', label: 'Recommended', description: 'Personalized recommendations', group: 'platform' },
  random_featured: { key: 'random_featured', label: 'Random Featured', description: 'Randomly selected featured products', group: 'platform' },
};

// ====================
// SERVICE
// ====================

class FeaturedOptionsService {
  private static instance: FeaturedOptionsService;

  private constructor() {}

  static getInstance(): FeaturedOptionsService {
    if (!FeaturedOptionsService.instance) {
      FeaturedOptionsService.instance = new FeaturedOptionsService();
    }
    return FeaturedOptionsService.instance;
  }

  /**
   * Resolve featured options state for a tenant from their tier capabilities.
   * Reads the featured_options capability group from the tenant's tier features.
   */
  async resolveFeaturedOptionsState(tenantId: string): Promise<FeaturedOptionsState> {
    try {
      // Fetch tenant and tier info
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          subscription_tier: true,
          subscription_status: true,
          organization_id: true,
          organizations_list: {
            select: { subscription_tier: true },
          },
        },
      });

      if (!tenant) {
        logger.warn('[FeaturedOptionsService] Tenant not found', undefined, { tenantId });
        return this.getDisabledState();
      }

      // Collect tier keys (org + tenant, most-permissive-wins)
      const orgTierKey = tenant.organizations_list?.subscription_tier || null;
      const tenantTierKey = tenant.subscription_tier || null;
      // Proxy trial tiers to base tiers for feature resolution
      const resolvedOrgTierKey = orgTierKey ? getEffectiveTier(orgTierKey) : null;
      const resolvedTenantTierKey = tenantTierKey ? getEffectiveTier(tenantTierKey) : null;
      const tierKeys = [resolvedOrgTierKey, resolvedTenantTierKey].filter((k): k is string => !!k);

      if (tierKeys.length === 0) {
        return this.getDisabledState();
      }

      // Fetch tier records
      const tiers = await prisma.subscription_tiers_list.findMany({
        where: { tier_key: { in: tierKeys } },
      });

      const tierIds = tiers.map(t => t.id);

      // Fetch featured_ feature keys from tier_features_list
      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          feature_key: { startsWith: 'featured_' },
          is_enabled: true,
        },
        include: {
          capability_type_list: { select: { key: true } },
        },
      });

      // Merge features: union across tiers (most-permissive-wins)
      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of tierFeatures) {
        mergedFeatures[tf.feature_key] = mergedFeatures[tf.feature_key] || tf.is_enabled;
      }

      return this.resolveFromFeatures(mergedFeatures);
    } catch (error) {
      logger.error('[FeaturedOptionsService] Error resolving featured options state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve FeaturedOptionsState from a raw feature map.
   */
  resolveFromFeatures(features: Record<string, boolean>): FeaturedOptionsState {
    const enabled = !!features.featured_enabled;
    const disabled = !!features.featured_disabled;
    const flexible = !!features.featured_flexible;
    const tenantGroupEnabled = !!features.featured_tenant_enabled;
    const tenantGroupDisabled = !!features.featured_tenant_disabled;
    const platformGroupEnabled = !!features.featured_platform_enabled;
    const platformGroupDisabled = !!features.featured_platform_disabled;

    // Three states per group: enabled → all types, untouched → individual features, disabled → none
    const tenantEnabled = tenantGroupEnabled && !tenantGroupDisabled;
    const tenantUntouched = !tenantGroupEnabled && !tenantGroupDisabled;
    const platformEnabled = platformGroupEnabled && !platformGroupDisabled;
    const platformUntouched = !platformGroupEnabled && !platformGroupDisabled;

    // Tenant-controlled types
    const allowedTenantTypes: FeaturedType[] = [];
    if (flexible || tenantEnabled) {
      // Group enabled or flexible → all tenant types
      allowedTenantTypes.push('store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'clearance', 'featured');
    } else if (tenantUntouched) {
      // Group untouched → only explicitly listed features
      if (features.featured_store_selection) allowedTenantTypes.push('store_selection');
      if (features.featured_new_arrival) allowedTenantTypes.push('new_arrival');
      if (features.featured_seasonal) allowedTenantTypes.push('seasonal');
      if (features.featured_sale) allowedTenantTypes.push('sale');
      if (features.featured_staff_pick) allowedTenantTypes.push('staff_pick');
      if (features.featured_clearance) allowedTenantTypes.push('clearance');
      if (features.featured_featured) allowedTenantTypes.push('featured');
    }
    // else: tenantGroupDisabled → no tenant types

    // Platform-controlled types
    const allowedPlatformTypes: FeaturedType[] = [];
    if (flexible || platformEnabled) {
      // Group enabled or flexible → all platform types
      allowedPlatformTypes.push('bestseller', 'trending', 'recommended', 'random_featured');
    } else if (platformUntouched) {
      // Group untouched → only explicitly listed features
      if (features.featured_bestseller) allowedPlatformTypes.push('bestseller');
      if (features.featured_trending) allowedPlatformTypes.push('trending');
      if (features.featured_recommended) allowedPlatformTypes.push('recommended');
      if (features.featured_random_featured) allowedPlatformTypes.push('random_featured');
    }
    // else: platformGroupDisabled → no platform types

    const allTypes = [...allowedTenantTypes, ...allowedPlatformTypes];

    return {
      enabled: enabled && !disabled,
      tenantEnabled,
      platformEnabled,
      allowedTenantTypes,
      allowedPlatformTypes,
      allowedTypes: allTypes,
      isFlexible: flexible,
      featuredAvailable: enabled && !disabled && allTypes.length > 0,
      features,
    };
  }

  /**
   * Check if a specific featured type is allowed for a tenant.
   */
  async isFeaturedTypeAllowed(tenantId: string, type: FeaturedType): Promise<boolean> {
    const state = await this.resolveFeaturedOptionsState(tenantId);
    return state.enabled && state.allowedTypes.includes(type);
  }

  /**
   * Get metadata for a featured type.
   */
  getFeaturedTypeMeta(type: FeaturedType): FeaturedTypeMeta {
    return FEATURED_TYPE_META[type];
  }

  /**
   * Get all featured type metadata, optionally filtered by group.
   */
  getAllFeaturedTypeMeta(group?: 'tenant' | 'platform'): FeaturedTypeMeta[] {
    const types = group === 'tenant' ? TENANT_FEATURED_TYPES
      : group === 'platform' ? PLATFORM_FEATURED_TYPES
      : ALL_FEATURED_TYPES;
    return types.map(t => FEATURED_TYPE_META[t]);
  }

  /**
   * Check if a featured type is tenant-controlled.
   */
  isTenantControlled(type: FeaturedType): boolean {
    return TENANT_FEATURED_TYPES.includes(type);
  }

  /**
   * Check if a featured type is platform-controlled.
   */
  isPlatformControlled(type: FeaturedType): boolean {
    return PLATFORM_FEATURED_TYPES.includes(type);
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): FeaturedOptionsState {
    return {
      enabled: false,
      tenantEnabled: false,
      platformEnabled: false,
      allowedTenantTypes: [],
      allowedPlatformTypes: [],
      allowedTypes: [],
      isFlexible: false,
      featuredAvailable: false,
      features: {},
    };
  }
}

export default FeaturedOptionsService;
