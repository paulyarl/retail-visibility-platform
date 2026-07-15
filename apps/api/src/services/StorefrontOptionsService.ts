/**
 * Storefront Options Service
 *
 * Capability-aware service for resolving and managing storefront options.
 * Determines which storefront display and behavior features are available
 * to a tenant based on their tier capabilities.
 *
 * Feature prefix: storefront_opt_ (distinct from storefront_ which belongs to storefront_types)
 *
 * QR, Gallery, Hours, and Layouts capabilities have been extracted to their own dedicated
 * services (StorefrontQrService, StorefrontGalleryService, StorefrontHoursService,
 * StorefrontLayoutService).
 *
 * Gate hierarchy (core only):
 *   storefront_options (main gate - hard)
 *   ├── Category Display (feature gate) → category_store, category_product
 *   ├── Recommendation Display (feature gate) → recommend_store, recommend_products
 *   ├── User Behavior → recently_viewed
 *   ├── Store Information (feature gate) → storefront_social_media, storefront_contact
 *   ├── Advanced (feature gate) → enhanced_seo, storefront_actions
 *   └── storefront_opt_flexible (master gate - unlocks all)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type StorefrontOptCategoryType = 'category_store' | 'category_product';
export type StorefrontOptRecommendType = 'recommend_store' | 'recommend_products';
export type StorefrontOptInfoType = 'storefront_social_media' | 'storefront_contact';
export type StorefrontOptAdvancedType = 'enhanced_seo' | 'storefront_actions';

export const CATEGORY_TYPES: StorefrontOptCategoryType[] = ['category_store', 'category_product'];
export const RECOMMEND_TYPES: StorefrontOptRecommendType[] = ['recommend_store', 'recommend_products'];
export const INFO_TYPES: StorefrontOptInfoType[] = ['storefront_social_media', 'storefront_contact'];
export const ADVANCED_TYPES: StorefrontOptAdvancedType[] = ['enhanced_seo', 'storefront_actions'];

export interface StorefrontOptionsState {
  enabled: boolean;
  isFlexible: boolean;
  // Category Display group
  categoryEnabled: boolean;
  allowedCategoryTypes: StorefrontOptCategoryType[];
  // Recommendation Display group
  recommendEnabled: boolean;
  allowedRecommendTypes: StorefrontOptRecommendType[];
  // User Behavior
  recentlyViewedEnabled: boolean;
  // Store Information group
  infoEnabled: boolean;
  allowedInfoTypes: StorefrontOptInfoType[];
  // Advanced group
  advancedEnabled: boolean;
  allowedAdvancedTypes: StorefrontOptAdvancedType[];
  // Convenience flags
  canUseCategoryStore: boolean;
  canUseCategoryProduct: boolean;
  canUseRecommendStore: boolean;
  canUseRecommendProducts: boolean;
  canUseRecentlyViewed: boolean;
  canUseSocialMedia: boolean;
  canUseContact: boolean;
  canUseEnhancedSEO: boolean;
  canUseStorefrontActions: boolean;
  // Raw features
  features: Record<string, boolean>;
}

export interface StorefrontOptTypeMeta {
  key: string;
  label: string;
  description: string;
  group: 'category' | 'recommend' | 'behavior' | 'info' | 'advanced';
}

const STOREFRONT_OPT_TYPE_META: Record<string, StorefrontOptTypeMeta> = {
  category_store: { key: 'category_store', label: 'Store Categories', description: 'Category navigation on storefront', group: 'category' },
  category_product: { key: 'category_product', label: 'Product Categories', description: 'Category badges on product cards', group: 'category' },
  recommend_store: { key: 'recommend_store', label: 'Store Recommendations', description: 'Recommended store section', group: 'recommend' },
  recommend_products: { key: 'recommend_products', label: 'Product Recommendations', description: 'Recommended products section', group: 'recommend' },
  recently_viewed: { key: 'recently_viewed', label: 'Recently Viewed', description: 'Recently viewed products tracking', group: 'behavior' },
  storefront_social_media: { key: 'storefront_social_media', label: 'Social Media', description: 'Social media links on storefront', group: 'info' },
  storefront_contact: { key: 'storefront_contact', label: 'Contact Info', description: 'Contact information on storefront', group: 'info' },
  enhanced_seo: { key: 'enhanced_seo', label: 'Enhanced SEO', description: 'Advanced SEO controls and metadata', group: 'advanced' },
  storefront_actions: { key: 'storefront_actions', label: 'Storefront Actions', description: 'Custom call-to-action buttons', group: 'advanced' },
};

// ====================
// SERVICE
// ====================

class StorefrontOptionsService {
  private static instance: StorefrontOptionsService;

  private constructor() {}

  static getInstance(): StorefrontOptionsService {
    if (!StorefrontOptionsService.instance) {
      StorefrontOptionsService.instance = new StorefrontOptionsService();
    }
    return StorefrontOptionsService.instance;
  }

  /**
   * Resolve storefront options state for a tenant from their tier capabilities.
   */
  async resolveStorefrontOptionsState(tenantId: string): Promise<StorefrontOptionsState> {
    try {
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
        logger.warn('[StorefrontOptionsService] Tenant not found', undefined, { tenantId });
        return this.getDisabledState();
      }

      const orgTierKey = tenant.organizations_list?.subscription_tier || null;
      const tenantTierKey = tenant.subscription_tier || null;
      // Proxy trial tiers to base tiers for feature resolution
      const resolvedOrgTierKey = orgTierKey ? getEffectiveTier(orgTierKey) : null;
      const resolvedTenantTierKey = tenantTierKey ? getEffectiveTier(tenantTierKey) : null;
      const tierKeys = [resolvedOrgTierKey, resolvedTenantTierKey].filter((k): k is string => !!k);

      if (tierKeys.length === 0) {
        return this.getDisabledState();
      }

      const tiers = await prisma.subscription_tiers_list.findMany({
        where: { tier_key: { in: tierKeys } },
      });

      const tierIds = tiers.map(t => t.id);

      // Primary: query by capability_type_id (robust against feature key typos/spaces)
      // Fallback: query by feature_key prefix if capability type not found
      const sfOptCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_options' },
      });

      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          ...(sfOptCapType
            ? { capability_type_id: sfOptCapType.id }
            : { feature_key: { startsWith: 'storefront_opt_' } }),
          is_enabled: true,
        },
      });

      // Merge features: union across tiers (most-permissive-wins)
      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of tierFeatures) {
        const cleanKey = tf.feature_key.trim();
        mergedFeatures[cleanKey] = mergedFeatures[cleanKey] || tf.is_enabled;
      }

      return this.resolveFromFeatures(mergedFeatures);
    } catch (error) {
      logger.error('[StorefrontOptionsService] Error resolving storefront options state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve StorefrontOptionsState from a raw feature map.
   */
  resolveFromFeatures(features: Record<string, boolean>): StorefrontOptionsState {
    const enabled = !!features.storefront_opt_enabled;
    const disabled = !!features.storefront_opt_disabled;
    const flexible = !!features.storefront_opt_flexible;
    const mainOn = enabled && !disabled;

    // --- Category: individual features (group gate removed, fallback to old group gate) ---
    const allowedCategoryTypes: StorefrontOptCategoryType[] = [];
    if (flexible) {
      allowedCategoryTypes.push('category_store', 'category_product');
    } else if (features.storefront_opt_category_store || features.storefront_opt_category_product) {
      if (features.storefront_opt_category_store) allowedCategoryTypes.push('category_store');
      if (features.storefront_opt_category_product) allowedCategoryTypes.push('category_product');
    } else if ((features.storefront_opt_category_on || features.storefront_opt_category_enabled) && !(features.storefront_opt_category_off || features.storefront_opt_category_disabled)) {
      allowedCategoryTypes.push('category_store', 'category_product');
    }

    // --- Recommend: individual features (group gate removed, fallback to old group gate) ---
    const allowedRecommendTypes: StorefrontOptRecommendType[] = [];
    if (flexible) {
      allowedRecommendTypes.push('recommend_store', 'recommend_products');
    } else if (features.storefront_opt_recommend_store || features.storefront_opt_recommend_products) {
      if (features.storefront_opt_recommend_store) allowedRecommendTypes.push('recommend_store');
      if (features.storefront_opt_recommend_products) allowedRecommendTypes.push('recommend_products');
    } else if ((features.storefront_opt_recommend_on || features.storefront_opt_recommend_enabled) && !(features.storefront_opt_recommend_off || features.storefront_opt_recommend_disabled)) {
      allowedRecommendTypes.push('recommend_store', 'recommend_products');
    }

    // --- User Behavior (standalone, no group gate) ---
    const recentlyViewedEnabled = flexible || !!features.storefront_opt_recently_viewed;

    // --- Info: consolidated key (new) with fallback to old group gate + individual keys ---
    const allowedInfoTypes: StorefrontOptInfoType[] = [];
    if (flexible || features.storefront_opt_info || features.storefront_opt_info_on) {
      allowedInfoTypes.push('storefront_social_media', 'storefront_contact');
    } else if ((features.storefront_opt_info_on || features.storefront_opt_info_enabled) && !(features.storefront_opt_info_off || features.storefront_opt_info_disabled)) {
      allowedInfoTypes.push('storefront_social_media', 'storefront_contact');
    } else {
      if (features.storefront_opt_storefront_social_media) allowedInfoTypes.push('storefront_social_media');
      if (features.storefront_opt_storefront_contact) allowedInfoTypes.push('storefront_contact');
    }

    // --- Advanced: individual features (group gate removed, fallback to old group gate) ---
    const allowedAdvancedTypes: StorefrontOptAdvancedType[] = [];
    if (flexible) {
      allowedAdvancedTypes.push('enhanced_seo', 'storefront_actions');
    } else if (features.storefront_opt_enhanced_seo || features.storefront_opt_storefront_actions) {
      if (features.storefront_opt_enhanced_seo) allowedAdvancedTypes.push('enhanced_seo');
      if (features.storefront_opt_storefront_actions) allowedAdvancedTypes.push('storefront_actions');
    } else if ((features.storefront_opt_advanced_on || features.storefront_opt_advanced_enabled) && !(features.storefront_opt_advanced_off || features.storefront_opt_advanced_disabled)) {
      allowedAdvancedTypes.push('enhanced_seo', 'storefront_actions');
    }

    return {
      enabled: mainOn,
      isFlexible: flexible,
      categoryEnabled: mainOn && allowedCategoryTypes.length > 0,
      allowedCategoryTypes,
      recommendEnabled: mainOn && allowedRecommendTypes.length > 0,
      allowedRecommendTypes,
      recentlyViewedEnabled: mainOn && recentlyViewedEnabled,
      infoEnabled: mainOn && allowedInfoTypes.length > 0,
      allowedInfoTypes,
      advancedEnabled: mainOn && allowedAdvancedTypes.length > 0,
      allowedAdvancedTypes,
      // Convenience flags
      canUseCategoryStore: mainOn && allowedCategoryTypes.includes('category_store'),
      canUseCategoryProduct: mainOn && allowedCategoryTypes.includes('category_product'),
      canUseRecommendStore: mainOn && allowedRecommendTypes.includes('recommend_store'),
      canUseRecommendProducts: mainOn && allowedRecommendTypes.includes('recommend_products'),
      canUseRecentlyViewed: mainOn && recentlyViewedEnabled,
      canUseSocialMedia: mainOn && allowedInfoTypes.includes('storefront_social_media'),
      canUseContact: mainOn && allowedInfoTypes.includes('storefront_contact'),
      canUseEnhancedSEO: mainOn && allowedAdvancedTypes.includes('enhanced_seo'),
      canUseStorefrontActions: mainOn && allowedAdvancedTypes.includes('storefront_actions'),
      features,
    };
  }

  /**
   * Check if a specific storefront option type is allowed for a tenant.
   */
  async isStorefrontOptionAllowed(tenantId: string, type: string): Promise<boolean> {
    const state = await this.resolveStorefrontOptionsState(tenantId);
    if (!state.enabled) return false;

    if (CATEGORY_TYPES.includes(type as StorefrontOptCategoryType)) return state.allowedCategoryTypes.includes(type as StorefrontOptCategoryType);
    if (RECOMMEND_TYPES.includes(type as StorefrontOptRecommendType)) return state.allowedRecommendTypes.includes(type as StorefrontOptRecommendType);
    if (type === 'recently_viewed') return state.recentlyViewedEnabled;
    if (INFO_TYPES.includes(type as StorefrontOptInfoType)) return state.allowedInfoTypes.includes(type as StorefrontOptInfoType);
    if (ADVANCED_TYPES.includes(type as StorefrontOptAdvancedType)) return state.allowedAdvancedTypes.includes(type as StorefrontOptAdvancedType);
    return false;
  }

  /**
   * Get metadata for a storefront option type.
   */
  getStorefrontOptTypeMeta(type: string): StorefrontOptTypeMeta | undefined {
    return STOREFRONT_OPT_TYPE_META[type];
  }

  /**
   * Get all storefront option type metadata, optionally filtered by group.
   */
  getAllStorefrontOptTypeMeta(group?: StorefrontOptTypeMeta['group']): StorefrontOptTypeMeta[] {
    const allTypes = group === 'category' ? CATEGORY_TYPES
      : group === 'recommend' ? RECOMMEND_TYPES
      : group === 'behavior' ? ['recently_viewed']
      : group === 'info' ? INFO_TYPES
      : group === 'advanced' ? ADVANCED_TYPES
      : [...CATEGORY_TYPES, ...RECOMMEND_TYPES, 'recently_viewed', ...INFO_TYPES, ...ADVANCED_TYPES];
    return allTypes.map(t => STOREFRONT_OPT_TYPE_META[t]).filter(Boolean);
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): StorefrontOptionsState {
    return {
      enabled: false,
      isFlexible: false,
      categoryEnabled: false,
      allowedCategoryTypes: [],
      recommendEnabled: false,
      allowedRecommendTypes: [],
      recentlyViewedEnabled: false,
      infoEnabled: false,
      allowedInfoTypes: [],
      advancedEnabled: false,
      allowedAdvancedTypes: [],
      canUseCategoryStore: false,
      canUseCategoryProduct: false,
      canUseRecommendStore: false,
      canUseRecommendProducts: false,
      canUseRecentlyViewed: false,
      canUseSocialMedia: false,
      canUseContact: false,
      canUseEnhancedSEO: false,
      canUseStorefrontActions: false,
      features: {},
    };
  }
}

export default StorefrontOptionsService;
