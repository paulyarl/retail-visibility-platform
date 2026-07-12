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
import { getEffectiveTier } from '../utils/trial-tier-transparency';

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
export type StorefrontOptLayoutType = 'classic' | 'editorial' | 'immersive';

export const HOURS_TYPES: StorefrontOptHoursType[] = ['hours_animated', 'hours_status'];
export const CATEGORY_TYPES: StorefrontOptCategoryType[] = ['category_store', 'category_product'];
export const RECOMMEND_TYPES: StorefrontOptRecommendType[] = ['recommend_store', 'recommend_products'];
export const INFO_TYPES: StorefrontOptInfoType[] = ['storefront_social_media', 'storefront_contact', 'interactive_maps'];
export const QR_RESOLUTION_TYPES: StorefrontOptQRResolutionType[] = ['qr_codes_512', 'qr_codes_1024', 'qr_codes_2048'];
export const QR_CONTENT_TYPES: StorefrontOptQRContentType[] = ['qr_product', 'qr_store', 'qr_logo', 'qr_directory'];
export const GALLERY_TYPES: StorefrontOptGalleryType[] = ['image_gallery_5', 'image_gallery_10', 'image_gallery_15'];
export const ADVANCED_TYPES: StorefrontOptAdvancedType[] = ['enhanced_seo', 'storefront_actions'];
export const LAYOUT_TYPES: StorefrontOptLayoutType[] = ['classic', 'editorial', 'immersive'];

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
  // Layout group
  layoutEnabled: boolean;
  allowedLayouts: StorefrontOptLayoutType[];
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
  // QR Style
  qrStyledEnabled: boolean;
  qrGradients: boolean;
  canUseEnhancedSEO: boolean;
  canUseStorefrontActions: boolean;
  canUseLayoutClassic: boolean;
  canUseLayoutEditorial: boolean;
  canUseLayoutImmersive: boolean;
  // Gallery Magazine
  galleryMagazineEnabled: boolean;
  canUseMagazineGallery: boolean;
  galleryDisplayMode: string;
  // Raw features
  features: Record<string, boolean>;
}

export interface StorefrontOptTypeMeta {
  key: string;
  label: string;
  description: string;
  group: 'hours' | 'category' | 'recommend' | 'behavior' | 'info' | 'qr' | 'gallery' | 'advanced' | 'layout';
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
  classic: { key: 'classic', label: 'Classic Layout', description: 'Traditional single-column layout', group: 'layout' },
  editorial: { key: 'editorial', label: 'Modern Editorial', description: 'Storytelling emphasis, hero banner layout', group: 'layout' },
  immersive: { key: 'immersive', label: 'Immersive Commerce', description: 'Conversion-optimized compact purchase flow', group: 'layout' },
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

    // --- Hours: individual features (group gate removed, fallback to old group gate) ---
    const allowedHoursTypes: StorefrontOptHoursType[] = [];
    if (flexible) {
      allowedHoursTypes.push('hours_animated', 'hours_status');
    } else if (features.storefront_opt_hours_animated || features.storefront_opt_hours_status) {
      if (features.storefront_opt_hours_animated) allowedHoursTypes.push('hours_animated');
      if (features.storefront_opt_hours_status) allowedHoursTypes.push('hours_status');
    } else if ((features.storefront_opt_hours_on || features.storefront_opt_hours_enabled) && !(features.storefront_opt_hours_off || features.storefront_opt_hours_disabled)) {
      allowedHoursTypes.push('hours_animated', 'hours_status');
    }

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
      allowedInfoTypes.push('storefront_social_media', 'storefront_contact', 'interactive_maps');
    } else if ((features.storefront_opt_info_on || features.storefront_opt_info_enabled) && !(features.storefront_opt_info_off || features.storefront_opt_info_disabled)) {
      allowedInfoTypes.push('storefront_social_media', 'storefront_contact', 'interactive_maps');
    } else {
      if (features.storefront_opt_storefront_social_media) allowedInfoTypes.push('storefront_social_media');
      if (features.storefront_opt_storefront_contact) allowedInfoTypes.push('storefront_contact');
      if (features.storefront_opt_interactive_maps) allowedInfoTypes.push('interactive_maps');
    }

    // --- QR: new consolidated keys (qr, qr_resolution, qr_content) with fallback to old keys ---
    const qrGroupOn = flexible || !!features.storefront_opt_qr
      || ((!!features.storefront_opt_qr_on || !!features.storefront_opt_qr_enabled) && !(!!features.storefront_opt_qr_off || !!features.storefront_opt_qr_disabled));
    const allowedQRResolutions: StorefrontOptQRResolutionType[] = [];
    const allowedQRContentTypes: StorefrontOptQRContentType[] = [];
    if (qrGroupOn) {
      allowedQRResolutions.push('qr_codes_512', 'qr_codes_1024', 'qr_codes_2048');
      allowedQRContentTypes.push('qr_product', 'qr_store', 'qr_logo', 'qr_directory');
    } else {
      if (features.storefront_opt_qr_resolution) {
        allowedQRResolutions.push('qr_codes_512', 'qr_codes_1024', 'qr_codes_2048');
      } else {
        if (features.storefront_opt_qr_codes_512) allowedQRResolutions.push('qr_codes_512');
        if (features.storefront_opt_qr_codes_1024) allowedQRResolutions.push('qr_codes_1024');
        if (features.storefront_opt_qr_codes_2048) allowedQRResolutions.push('qr_codes_2048');
      }
      if (features.storefront_opt_qr_content) {
        allowedQRContentTypes.push('qr_product', 'qr_store', 'qr_logo', 'qr_directory');
      } else {
        if (features.storefront_opt_qr_product) allowedQRContentTypes.push('qr_product');
        if (features.storefront_opt_qr_store) allowedQRContentTypes.push('qr_store');
        if (features.storefront_opt_qr_logo) allowedQRContentTypes.push('qr_logo');
        if (features.storefront_opt_qr_directory) allowedQRContentTypes.push('qr_directory');
      }
    }

    // --- QR Style: styled QR renderer, gated by storefront_opt_qr_styled feature key ---
    const qrStyledOn = flexible
      || !!features.storefront_opt_qr_styled
      || !!features.storefront_opt_qr_styled_on
      || (!!features.storefront_opt_qr_styled_enabled && !features.storefront_opt_qr_styled_disabled);
    const qrStyledOff = !!features.storefront_opt_qr_styled_off || !!features.storefront_opt_qr_styled_disabled;
    const qrStyledEnabled = mainOn && qrStyledOn && !qrStyledOff;
    const qrGradients = qrStyledEnabled && (flexible || !!features.storefront_opt_qr_gradients);

    // --- Gallery: new consolidated key with fallback to old group gate + individual keys ---
    const allowedGalleryTypes: StorefrontOptGalleryType[] = [];
    if (flexible || features.storefront_opt_gallery || features.storefront_opt_gallery_on) {
      allowedGalleryTypes.push('image_gallery_5', 'image_gallery_10', 'image_gallery_15');
    } else if ((features.storefront_opt_gallery_on || features.storefront_opt_gallery_enabled) && !(features.storefront_opt_gallery_off || features.storefront_opt_gallery_disabled)) {
      allowedGalleryTypes.push('image_gallery_5', 'image_gallery_10', 'image_gallery_15');
    } else {
      if (features.storefront_opt_image_gallery_5) allowedGalleryTypes.push('image_gallery_5');
      if (features.storefront_opt_image_gallery_10) allowedGalleryTypes.push('image_gallery_10');
      if (features.storefront_opt_image_gallery_15) allowedGalleryTypes.push('image_gallery_15');
    }

    // --- Gallery Magazine: magazine/mosaic display mode (tier-gated feature) ---
    const galleryMagazineEnabled = flexible || !!features.storefront_opt_gallery_magazine;

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

    // --- Layout: new consolidated key with fallback to old group gate + individual keys ---
    const allowedLayouts: StorefrontOptLayoutType[] = [];
    if (flexible || features.storefront_opt_layout || features.storefront_opt_layout_on) {
      allowedLayouts.push('classic', 'editorial', 'immersive');
    } else if ((features.storefront_opt_layout_on || features.storefront_opt_layout_enabled) && !(features.storefront_opt_layout_off || features.storefront_opt_layout_disabled)) {
      allowedLayouts.push('classic', 'editorial', 'immersive');
    } else {
      if (features.storefront_opt_layout_classic) allowedLayouts.push('classic');
      if (features.storefront_opt_layout_editorial) allowedLayouts.push('editorial');
      if (features.storefront_opt_layout_immersive) allowedLayouts.push('immersive');
    }

    return {
      enabled: mainOn,
      isFlexible: flexible,
      hoursEnabled: mainOn && allowedHoursTypes.length > 0,
      allowedHoursTypes,
      categoryEnabled: mainOn && allowedCategoryTypes.length > 0,
      allowedCategoryTypes,
      recommendEnabled: mainOn && allowedRecommendTypes.length > 0,
      allowedRecommendTypes,
      recentlyViewedEnabled: mainOn && recentlyViewedEnabled,
      infoEnabled: mainOn && allowedInfoTypes.length > 0,
      allowedInfoTypes,
      qrEnabled: mainOn && (qrGroupOn || allowedQRResolutions.length > 0 || allowedQRContentTypes.length > 0),
      allowedQRResolutions,
      allowedQRContentTypes,
      galleryEnabled: mainOn && allowedGalleryTypes.length > 0,
      allowedGalleryTypes,
      advancedEnabled: mainOn && allowedAdvancedTypes.length > 0,
      allowedAdvancedTypes,
      layoutEnabled: mainOn && allowedLayouts.length > 0,
      allowedLayouts,
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
      qrStyledEnabled,
      qrGradients,
      canUseEnhancedSEO: mainOn && allowedAdvancedTypes.includes('enhanced_seo'),
      canUseStorefrontActions: mainOn && allowedAdvancedTypes.includes('storefront_actions'),
      canUseLayoutClassic: mainOn && allowedLayouts.includes('classic'),
      canUseLayoutEditorial: mainOn && allowedLayouts.includes('editorial'),
      canUseLayoutImmersive: mainOn && allowedLayouts.includes('immersive'),
      galleryMagazineEnabled: mainOn && galleryMagazineEnabled,
      canUseMagazineGallery: mainOn && galleryMagazineEnabled, // Service-level: tier-allowed. Effective use also requires merchant pref 'magazine'
      galleryDisplayMode: 'carousel', // Default; route layer reads merchant pref for actual value
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
    if (LAYOUT_TYPES.includes(type as StorefrontOptLayoutType)) return state.allowedLayouts.includes(type as StorefrontOptLayoutType);
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
      : group === 'layout' ? LAYOUT_TYPES
      : [...HOURS_TYPES, ...CATEGORY_TYPES, ...RECOMMEND_TYPES, 'recently_viewed', ...INFO_TYPES, ...QR_RESOLUTION_TYPES, ...QR_CONTENT_TYPES, ...GALLERY_TYPES, ...ADVANCED_TYPES, ...LAYOUT_TYPES];
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
      layoutEnabled: false,
      allowedLayouts: [],
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
      qrStyledEnabled: false,
      qrGradients: false,
      canUseEnhancedSEO: false,
      canUseStorefrontActions: false,
      canUseLayoutClassic: false,
      canUseLayoutEditorial: false,
      canUseLayoutImmersive: false,
      galleryMagazineEnabled: false,
      canUseMagazineGallery: false,
      galleryDisplayMode: 'carousel',
      features: {},
    };
  }
}

export default StorefrontOptionsService;
