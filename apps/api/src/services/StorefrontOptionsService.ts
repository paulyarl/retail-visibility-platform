/**
 * Storefront Options Service
 *
 * Capability-aware service for resolving and managing storefront options.
 * Determines which storefront display and behavior features are available
 * to a tenant based on their tier capabilities.
 *
 * Feature prefix: storefront_opt_ (distinct from storefront_ which belongs to storefront_types)
 *
 * Gate hierarchy:
 *   storefront_options (main gate - hard)
 *   ├── Store Hours (feature gate) → hours_animated, hours_status
 *   ├── Category Display (feature gate) → category_store, category_product
 *   ├── Recommendation Display (feature gate) → recommend_store, recommend_products
 *   ├── User Behavior → recently_viewed
 *   ├── Store Information (feature gate) → storefront_social_media, storefront_contact, interactive_maps
 *   ├── QR Code Display (feature gate) → qr_codes_512/1024/2048, qr_product/store/logo/directory
 *   ├── Gallery Display (radio gate) → image_gallery_5/10/15
 *   ├── Advanced (feature gate) → enhanced_seo, storefront_actions
 *   └── storefront_opt_flexible (master gate - unlocks all)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

// ====================
// TYPES
// ====================

export type StorefrontOptHoursType = 'hours_animated' | 'hours_status';
export type StorefrontOptCategoryType = 'category_store' | 'category_product';
export type StorefrontOptRecommendType = 'recommend_store' | 'recommend_products';
export type StorefrontOptInfoType = 'storefront_social_media' | 'storefront_contact' | 'interactive_maps';
export type StorefrontOptQRResolutionType = 'qr_codes_512' | 'qr_codes_1024' | 'qr_codes_2048';
export type StorefrontOptQRContentType = 'qr_product' | 'qr_store' | 'qr_logo' | 'qr_directory';
export type StorefrontOptGalleryType = 'image_gallery_5' | 'image_gallery_10' | 'image_gallery_15';
export type StorefrontOptAdvancedType = 'enhanced_seo' | 'storefront_actions';

export const HOURS_TYPES: StorefrontOptHoursType[] = ['hours_animated', 'hours_status'];
export const CATEGORY_TYPES: StorefrontOptCategoryType[] = ['category_store', 'category_product'];
export const RECOMMEND_TYPES: StorefrontOptRecommendType[] = ['recommend_store', 'recommend_products'];
export const INFO_TYPES: StorefrontOptInfoType[] = ['storefront_social_media', 'storefront_contact', 'interactive_maps'];
export const QR_RESOLUTION_TYPES: StorefrontOptQRResolutionType[] = ['qr_codes_512', 'qr_codes_1024', 'qr_codes_2048'];
export const QR_CONTENT_TYPES: StorefrontOptQRContentType[] = ['qr_product', 'qr_store', 'qr_logo', 'qr_directory'];
export const GALLERY_TYPES: StorefrontOptGalleryType[] = ['image_gallery_5', 'image_gallery_10', 'image_gallery_15'];
export const ADVANCED_TYPES: StorefrontOptAdvancedType[] = ['enhanced_seo', 'storefront_actions'];

export interface StorefrontOptionsState {
  enabled: boolean;
  isFlexible: boolean;
  // Store Hours group
  hoursEnabled: boolean;
  allowedHoursTypes: StorefrontOptHoursType[];
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
  // QR Code Display group
  qrEnabled: boolean;
  allowedQRResolutions: StorefrontOptQRResolutionType[];
  allowedQRContentTypes: StorefrontOptQRContentType[];
  // Gallery Display group (radio)
  galleryEnabled: boolean;
  allowedGalleryTypes: StorefrontOptGalleryType[];
  // Advanced group
  advancedEnabled: boolean;
  allowedAdvancedTypes: StorefrontOptAdvancedType[];
  // Convenience flags
  canUseAnimatedHours: boolean;
  canShowHoursStatus: boolean;
  canUseCategoryStore: boolean;
  canUseCategoryProduct: boolean;
  canUseRecommendStore: boolean;
  canUseRecommendProducts: boolean;
  canUseRecentlyViewed: boolean;
  canUseSocialMedia: boolean;
  canUseContact: boolean;
  canUseInteractiveMaps: boolean;
  canUseQRCodes: boolean;
  canUseEnhancedSEO: boolean;
  canUseStorefrontActions: boolean;
  // Raw features
  features: Record<string, boolean>;
}

export interface StorefrontOptTypeMeta {
  key: string;
  label: string;
  description: string;
  group: 'hours' | 'category' | 'recommend' | 'behavior' | 'info' | 'qr' | 'gallery' | 'advanced';
}

const STOREFRONT_OPT_TYPE_META: Record<string, StorefrontOptTypeMeta> = {
  hours_animated: { key: 'hours_animated', label: 'Animated Hours', description: 'Animated store hours display', group: 'hours' },
  hours_status: { key: 'hours_status', label: 'Hours Status', description: 'Open/closed status indicator', group: 'hours' },
  category_store: { key: 'category_store', label: 'Store Categories', description: 'Category navigation on storefront', group: 'category' },
  category_product: { key: 'category_product', label: 'Product Categories', description: 'Category badges on product cards', group: 'category' },
  recommend_store: { key: 'recommend_store', label: 'Store Recommendations', description: 'Recommended store section', group: 'recommend' },
  recommend_products: { key: 'recommend_products', label: 'Product Recommendations', description: 'Recommended products section', group: 'recommend' },
  recently_viewed: { key: 'recently_viewed', label: 'Recently Viewed', description: 'Recently viewed products tracking', group: 'behavior' },
  storefront_social_media: { key: 'storefront_social_media', label: 'Social Media', description: 'Social media links on storefront', group: 'info' },
  storefront_contact: { key: 'storefront_contact', label: 'Contact Info', description: 'Contact information on storefront', group: 'info' },
  interactive_maps: { key: 'interactive_maps', label: 'Interactive Maps', description: 'Embedded map on storefront', group: 'info' },
  qr_codes_512: { key: 'qr_codes_512', label: 'QR 512px', description: '512px QR code resolution', group: 'qr' },
  qr_codes_1024: { key: 'qr_codes_1024', label: 'QR 1024px', description: '1024px QR code resolution', group: 'qr' },
  qr_codes_2048: { key: 'qr_codes_2048', label: 'QR 2048px', description: '2048px QR code resolution (HD)', group: 'qr' },
  qr_product: { key: 'qr_product', label: 'Product QR', description: 'QR codes for individual products', group: 'qr' },
  qr_store: { key: 'qr_store', label: 'Store QR', description: 'QR code for store page', group: 'qr' },
  qr_logo: { key: 'qr_logo', label: 'Logo QR', description: 'QR code with embedded logo', group: 'qr' },
  qr_directory: { key: 'qr_directory', label: 'Directory QR', description: 'QR code for directory listing', group: 'qr' },
  image_gallery_5: { key: 'image_gallery_5', label: '5 Images', description: 'Gallery limit of 5 images', group: 'gallery' },
  image_gallery_10: { key: 'image_gallery_10', label: '10 Images', description: 'Gallery limit of 10 images', group: 'gallery' },
  image_gallery_15: { key: 'image_gallery_15', label: '15 Images', description: 'Gallery limit of 15 images', group: 'gallery' },
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
      const tierKeys = [orgTierKey, tenantTierKey].filter((k): k is string => !!k);

      if (tierKeys.length === 0) {
        return this.getDisabledState();
      }

      const tiers = await prisma.subscription_tiers_list.findMany({
        where: { tier_key: { in: tierKeys } },
      });

      const tierIds = tiers.map(t => t.id);

      // Fetch storefront_opt_ feature keys from tier_features_list
      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          feature_key: { startsWith: 'storefront_opt_' },
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

    // --- Store Hours feature gate ---
    const hoursGroupEnabled = !!features.storefront_opt_hours_enabled;
    const hoursGroupDisabled = !!features.storefront_opt_hours_disabled;
    const hoursEnabled = hoursGroupEnabled && !hoursGroupDisabled;
    const hoursUntouched = !hoursGroupEnabled && !hoursGroupDisabled;

    const allowedHoursTypes: StorefrontOptHoursType[] = [];
    if (flexible || hoursEnabled) {
      allowedHoursTypes.push('hours_animated', 'hours_status');
    } else if (hoursUntouched) {
      if (features.storefront_opt_hours_animated) allowedHoursTypes.push('hours_animated');
      if (features.storefront_opt_hours_status) allowedHoursTypes.push('hours_status');
    }

    // --- Category Display feature gate ---
    const categoryGroupEnabled = !!features.storefront_opt_category_enabled;
    const categoryGroupDisabled = !!features.storefront_opt_category_disabled;
    const categoryEnabled = categoryGroupEnabled && !categoryGroupDisabled;
    const categoryUntouched = !categoryGroupEnabled && !categoryGroupDisabled;

    const allowedCategoryTypes: StorefrontOptCategoryType[] = [];
    if (flexible || categoryEnabled) {
      allowedCategoryTypes.push('category_store', 'category_product');
    } else if (categoryUntouched) {
      if (features.storefront_opt_category_store) allowedCategoryTypes.push('category_store');
      if (features.storefront_opt_category_product) allowedCategoryTypes.push('category_product');
    }

    // --- Recommendation Display feature gate ---
    const recommendGroupEnabled = !!features.storefront_opt_recommend_enabled;
    const recommendGroupDisabled = !!features.storefront_opt_recommend_disabled;
    const recommendEnabled = recommendGroupEnabled && !recommendGroupDisabled;
    const recommendUntouched = !recommendGroupEnabled && !recommendGroupDisabled;

    const allowedRecommendTypes: StorefrontOptRecommendType[] = [];
    if (flexible || recommendEnabled) {
      allowedRecommendTypes.push('recommend_store', 'recommend_products');
    } else if (recommendUntouched) {
      if (features.storefront_opt_recommend_store) allowedRecommendTypes.push('recommend_store');
      if (features.storefront_opt_recommend_products) allowedRecommendTypes.push('recommend_products');
    }

    // --- User Behavior (standalone, no group gate) ---
    const recentlyViewedEnabled = flexible || !!features.storefront_opt_recently_viewed;

    // --- Store Information feature gate ---
    const infoGroupEnabled = !!features.storefront_opt_info_enabled;
    const infoGroupDisabled = !!features.storefront_opt_info_disabled;
    const infoEnabled = infoGroupEnabled && !infoGroupDisabled;
    const infoUntouched = !infoGroupEnabled && !infoGroupDisabled;

    const allowedInfoTypes: StorefrontOptInfoType[] = [];
    if (flexible || infoEnabled) {
      allowedInfoTypes.push('storefront_social_media', 'storefront_contact', 'interactive_maps');
    } else if (infoUntouched) {
      if (features.storefront_opt_storefront_social_media) allowedInfoTypes.push('storefront_social_media');
      if (features.storefront_opt_storefront_contact) allowedInfoTypes.push('storefront_contact');
      if (features.storefront_opt_interactive_maps) allowedInfoTypes.push('interactive_maps');
    }

    // --- QR Code Display feature gate ---
    const qrGroupEnabled = !!features.storefront_opt_qr_enabled;
    const qrGroupDisabled = !!features.storefront_opt_qr_disabled;
    const qrEnabled = qrGroupEnabled && !qrGroupDisabled;
    const qrUntouched = !qrGroupEnabled && !qrGroupDisabled;

    const allowedQRResolutions: StorefrontOptQRResolutionType[] = [];
    const allowedQRContentTypes: StorefrontOptQRContentType[] = [];
    if (flexible || qrEnabled) {
      allowedQRResolutions.push('qr_codes_512', 'qr_codes_1024', 'qr_codes_2048');
      allowedQRContentTypes.push('qr_product', 'qr_store', 'qr_logo', 'qr_directory');
    } else if (qrUntouched) {
      if (features.storefront_opt_qr_codes_512) allowedQRResolutions.push('qr_codes_512');
      if (features.storefront_opt_qr_codes_1024) allowedQRResolutions.push('qr_codes_1024');
      if (features.storefront_opt_qr_codes_2048) allowedQRResolutions.push('qr_codes_2048');
      if (features.storefront_opt_qr_product) allowedQRContentTypes.push('qr_product');
      if (features.storefront_opt_qr_store) allowedQRContentTypes.push('qr_store');
      if (features.storefront_opt_qr_logo) allowedQRContentTypes.push('qr_logo');
      if (features.storefront_opt_qr_directory) allowedQRContentTypes.push('qr_directory');
    }

    // --- Gallery Display feature gate (radio — only one active at a time) ---
    const galleryGroupEnabled = !!features.storefront_opt_gallery_enabled;
    const galleryGroupDisabled = !!features.storefront_opt_gallery_disabled;
    const galleryEnabled = galleryGroupEnabled && !galleryGroupDisabled;
    const galleryUntouched = !galleryGroupEnabled && !galleryGroupDisabled;

    const allowedGalleryTypes: StorefrontOptGalleryType[] = [];
    if (flexible || galleryEnabled) {
      allowedGalleryTypes.push('image_gallery_5', 'image_gallery_10', 'image_gallery_15');
    } else if (galleryUntouched) {
      if (features.storefront_opt_image_gallery_5) allowedGalleryTypes.push('image_gallery_5');
      if (features.storefront_opt_image_gallery_10) allowedGalleryTypes.push('image_gallery_10');
      if (features.storefront_opt_image_gallery_15) allowedGalleryTypes.push('image_gallery_15');
    }

    // --- Advanced feature gate ---
    const advancedGroupEnabled = !!features.storefront_opt_advanced_enabled;
    const advancedGroupDisabled = !!features.storefront_opt_advanced_disabled;
    const advancedEnabled = advancedGroupEnabled && !advancedGroupDisabled;
    const advancedUntouched = !advancedGroupEnabled && !advancedGroupDisabled;

    const allowedAdvancedTypes: StorefrontOptAdvancedType[] = [];
    if (flexible || advancedEnabled) {
      allowedAdvancedTypes.push('enhanced_seo', 'storefront_actions');
    } else if (advancedUntouched) {
      if (features.storefront_opt_enhanced_seo) allowedAdvancedTypes.push('enhanced_seo');
      if (features.storefront_opt_storefront_actions) allowedAdvancedTypes.push('storefront_actions');
    }

    const mainOn = enabled && !disabled;

    return {
      enabled: mainOn,
      isFlexible: flexible,
      hoursEnabled: mainOn && (hoursEnabled || allowedHoursTypes.length > 0),
      allowedHoursTypes,
      categoryEnabled: mainOn && (categoryEnabled || allowedCategoryTypes.length > 0),
      allowedCategoryTypes,
      recommendEnabled: mainOn && (recommendEnabled || allowedRecommendTypes.length > 0),
      allowedRecommendTypes,
      recentlyViewedEnabled: mainOn && recentlyViewedEnabled,
      infoEnabled: mainOn && (infoEnabled || allowedInfoTypes.length > 0),
      allowedInfoTypes,
      qrEnabled: mainOn && (qrEnabled || allowedQRResolutions.length > 0 || allowedQRContentTypes.length > 0),
      allowedQRResolutions,
      allowedQRContentTypes,
      galleryEnabled: mainOn && (galleryEnabled || allowedGalleryTypes.length > 0),
      allowedGalleryTypes,
      advancedEnabled: mainOn && (advancedEnabled || allowedAdvancedTypes.length > 0),
      allowedAdvancedTypes,
      // Convenience flags
      canUseAnimatedHours: mainOn && allowedHoursTypes.includes('hours_animated'),
      canShowHoursStatus: mainOn && allowedHoursTypes.includes('hours_status'),
      canUseCategoryStore: mainOn && allowedCategoryTypes.includes('category_store'),
      canUseCategoryProduct: mainOn && allowedCategoryTypes.includes('category_product'),
      canUseRecommendStore: mainOn && allowedRecommendTypes.includes('recommend_store'),
      canUseRecommendProducts: mainOn && allowedRecommendTypes.includes('recommend_products'),
      canUseRecentlyViewed: mainOn && recentlyViewedEnabled,
      canUseSocialMedia: mainOn && allowedInfoTypes.includes('storefront_social_media'),
      canUseContact: mainOn && allowedInfoTypes.includes('storefront_contact'),
      canUseInteractiveMaps: mainOn && allowedInfoTypes.includes('interactive_maps'),
      canUseQRCodes: mainOn && (allowedQRResolutions.length > 0 || allowedQRContentTypes.length > 0),
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

    if (HOURS_TYPES.includes(type as StorefrontOptHoursType)) return state.allowedHoursTypes.includes(type as StorefrontOptHoursType);
    if (CATEGORY_TYPES.includes(type as StorefrontOptCategoryType)) return state.allowedCategoryTypes.includes(type as StorefrontOptCategoryType);
    if (RECOMMEND_TYPES.includes(type as StorefrontOptRecommendType)) return state.allowedRecommendTypes.includes(type as StorefrontOptRecommendType);
    if (type === 'recently_viewed') return state.recentlyViewedEnabled;
    if (INFO_TYPES.includes(type as StorefrontOptInfoType)) return state.allowedInfoTypes.includes(type as StorefrontOptInfoType);
    if (QR_RESOLUTION_TYPES.includes(type as StorefrontOptQRResolutionType)) return state.allowedQRResolutions.includes(type as StorefrontOptQRResolutionType);
    if (QR_CONTENT_TYPES.includes(type as StorefrontOptQRContentType)) return state.allowedQRContentTypes.includes(type as StorefrontOptQRContentType);
    if (GALLERY_TYPES.includes(type as StorefrontOptGalleryType)) return state.allowedGalleryTypes.includes(type as StorefrontOptGalleryType);
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
    const allTypes = group === 'hours' ? HOURS_TYPES
      : group === 'category' ? CATEGORY_TYPES
      : group === 'recommend' ? RECOMMEND_TYPES
      : group === 'behavior' ? ['recently_viewed']
      : group === 'info' ? INFO_TYPES
      : group === 'qr' ? [...QR_RESOLUTION_TYPES, ...QR_CONTENT_TYPES]
      : group === 'gallery' ? GALLERY_TYPES
      : group === 'advanced' ? ADVANCED_TYPES
      : [...HOURS_TYPES, ...CATEGORY_TYPES, ...RECOMMEND_TYPES, 'recently_viewed', ...INFO_TYPES, ...QR_RESOLUTION_TYPES, ...QR_CONTENT_TYPES, ...GALLERY_TYPES, ...ADVANCED_TYPES];
    return allTypes.map(t => STOREFRONT_OPT_TYPE_META[t]).filter(Boolean);
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): StorefrontOptionsState {
    return {
      enabled: false,
      isFlexible: false,
      hoursEnabled: false,
      allowedHoursTypes: [],
      categoryEnabled: false,
      allowedCategoryTypes: [],
      recommendEnabled: false,
      allowedRecommendTypes: [],
      recentlyViewedEnabled: false,
      infoEnabled: false,
      allowedInfoTypes: [],
      qrEnabled: false,
      allowedQRResolutions: [],
      allowedQRContentTypes: [],
      galleryEnabled: false,
      allowedGalleryTypes: [],
      advancedEnabled: false,
      allowedAdvancedTypes: [],
      canUseAnimatedHours: false,
      canShowHoursStatus: false,
      canUseCategoryStore: false,
      canUseCategoryProduct: false,
      canUseRecommendStore: false,
      canUseRecommendProducts: false,
      canUseRecentlyViewed: false,
      canUseSocialMedia: false,
      canUseContact: false,
      canUseInteractiveMaps: false,
      canUseQRCodes: false,
      canUseEnhancedSEO: false,
      canUseStorefrontActions: false,
      features: {},
    };
  }
}

export default StorefrontOptionsService;
