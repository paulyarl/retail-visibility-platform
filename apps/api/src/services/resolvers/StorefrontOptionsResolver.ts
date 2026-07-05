/**
 * Storefront Options Resolver
 *
 * Resolves effective storefront options state from tier features + merchant preferences.
 */

import type {
  EffectiveStorefrontOptions,
  StorefrontOptionsMerchantSettings,
} from './types';

export type StorefrontOptHoursType = 'hours_animated' | 'hours_status';
export type StorefrontOptCategoryType = 'category_store' | 'category_product';
export type StorefrontOptRecommendType = 'recommend_store' | 'recommend_products';
export type StorefrontOptInfoType = 'storefront_social_media' | 'storefront_contact' | 'interactive_maps';
export type StorefrontOptQRResolutionType = 'qr_codes_512' | 'qr_codes_1024' | 'qr_codes_2048';
export type StorefrontOptQRContentType = 'qr_product' | 'qr_store' | 'qr_logo' | 'qr_directory';
export type StorefrontOptGalleryType = 'image_gallery_5' | 'image_gallery_10' | 'image_gallery_15';
export type StorefrontOptAdvancedType = 'enhanced_seo' | 'storefront_actions';
export type StorefrontOptLayoutType = 'classic' | 'editorial' | 'immersive';

export function resolveStorefrontOptions(
  features: Record<string, boolean>,
  merchantPrefs: StorefrontOptionsMerchantSettings | null
): EffectiveStorefrontOptions {
  const disabled = !!features.storefront_opt_disabled;
  const enabled = !disabled && !!features.storefront_opt_enabled;
  const flexible = !!features.storefront_opt_flexible;
  const mainOn = enabled;

  // Hours
  const hoursGroupEnabled = !!features.storefront_opt_hours_enabled;
  const allowedHoursTypes: StorefrontOptHoursType[] = [];
  if (flexible || hoursGroupEnabled) {
    allowedHoursTypes.push('hours_animated', 'hours_status');
  } else {
    if (features.storefront_opt_hours_animated) allowedHoursTypes.push('hours_animated');
    if (features.storefront_opt_hours_status) allowedHoursTypes.push('hours_status');
  }

  // Category
  const categoryGroupEnabled = !!features.storefront_opt_category_enabled;
  const allowedCategoryTypes: StorefrontOptCategoryType[] = [];
  if (flexible || categoryGroupEnabled) {
    allowedCategoryTypes.push('category_store', 'category_product');
  } else {
    if (features.storefront_opt_category_store) allowedCategoryTypes.push('category_store');
    if (features.storefront_opt_category_product) allowedCategoryTypes.push('category_product');
  }

  // Recommend
  const recommendGroupEnabled = !!features.storefront_opt_recommend_enabled;
  const allowedRecommendTypes: StorefrontOptRecommendType[] = [];
  if (flexible || recommendGroupEnabled) {
    allowedRecommendTypes.push('recommend_store', 'recommend_products');
  } else {
    if (features.storefront_opt_recommend_store) allowedRecommendTypes.push('recommend_store');
    if (features.storefront_opt_recommend_products) allowedRecommendTypes.push('recommend_products');
  }

  // Info
  const infoGroupEnabled = !!features.storefront_opt_info_enabled;
  const allowedInfoTypes: StorefrontOptInfoType[] = [];
  if (flexible || infoGroupEnabled) {
    allowedInfoTypes.push('storefront_social_media', 'storefront_contact', 'interactive_maps');
  } else {
    if (features.storefront_opt_storefront_social_media) allowedInfoTypes.push('storefront_social_media');
    if (features.storefront_opt_storefront_contact) allowedInfoTypes.push('storefront_contact');
    if (features.storefront_opt_interactive_maps) allowedInfoTypes.push('interactive_maps');
  }

  // QR
  const qrGroupEnabled = !!features.storefront_opt_qr_enabled;
  const allowedQRResolutions: StorefrontOptQRResolutionType[] = [];
  const allowedQRContentTypes: StorefrontOptQRContentType[] = [];
  if (flexible || qrGroupEnabled) {
    allowedQRResolutions.push('qr_codes_512', 'qr_codes_1024', 'qr_codes_2048');
    allowedQRContentTypes.push('qr_product', 'qr_store', 'qr_logo', 'qr_directory');
  } else {
    if (features.storefront_opt_qr_codes_512) allowedQRResolutions.push('qr_codes_512');
    if (features.storefront_opt_qr_codes_1024) allowedQRResolutions.push('qr_codes_1024');
    if (features.storefront_opt_qr_codes_2048) allowedQRResolutions.push('qr_codes_2048');
    if (features.storefront_opt_qr_product) allowedQRContentTypes.push('qr_product');
    if (features.storefront_opt_qr_store) allowedQRContentTypes.push('qr_store');
    if (features.storefront_opt_qr_logo) allowedQRContentTypes.push('qr_logo');
    if (features.storefront_opt_qr_directory) allowedQRContentTypes.push('qr_directory');
  }

  // Gallery
  const galleryGroupEnabled = !!features.storefront_opt_gallery_enabled;
  const allowedGalleryTypes: StorefrontOptGalleryType[] = [];
  if (flexible || galleryGroupEnabled) {
    allowedGalleryTypes.push('image_gallery_5', 'image_gallery_10', 'image_gallery_15');
  } else {
    if (features.storefront_opt_image_gallery_5) allowedGalleryTypes.push('image_gallery_5');
    if (features.storefront_opt_image_gallery_10) allowedGalleryTypes.push('image_gallery_10');
    if (features.storefront_opt_image_gallery_15) allowedGalleryTypes.push('image_gallery_15');
  }

  // Advanced
  const advancedGroupEnabled = !!features.storefront_opt_advanced_enabled;
  const allowedAdvancedTypes: StorefrontOptAdvancedType[] = [];
  if (flexible || advancedGroupEnabled) {
    allowedAdvancedTypes.push('enhanced_seo', 'storefront_actions');
  } else {
    if (features.storefront_opt_enhanced_seo) allowedAdvancedTypes.push('enhanced_seo');
    if (features.storefront_opt_storefront_actions) allowedAdvancedTypes.push('storefront_actions');
  }

  // Layout
  const layoutGroupEnabled = !!features.storefront_opt_layout_enabled;
  const allowedLayouts: StorefrontOptLayoutType[] = [];
  if (flexible || layoutGroupEnabled) {
    allowedLayouts.push('classic', 'editorial', 'immersive');
  } else {
    if (features.storefront_opt_layout_classic) allowedLayouts.push('classic');
    if (features.storefront_opt_layout_editorial) allowedLayouts.push('editorial');
    if (features.storefront_opt_layout_immersive) allowedLayouts.push('immersive');
  }

  const prefs = {
    storefront_opt_enabled: merchantPrefs?.storefront_opt_enabled !== false,
    hours_display: merchantPrefs?.hours_display !== false,
    hours_animated: merchantPrefs?.hours_animated !== false,
    hours_status: merchantPrefs?.hours_status !== false,
    map_display: merchantPrefs?.map_display !== false,
    location_display: merchantPrefs?.location_display !== false,
    category_store: merchantPrefs?.category_store !== false,
    category_product: merchantPrefs?.category_product !== false,
    recommend_store: merchantPrefs?.recommend_store !== false,
    recommend_products: merchantPrefs?.recommend_products !== false,
    recently_viewed: merchantPrefs?.recently_viewed !== false,
    storefront_social_media: merchantPrefs?.storefront_social_media !== false,
    storefront_contact: merchantPrefs?.storefront_contact !== false,
    interactive_maps: merchantPrefs?.interactive_maps !== false,
    qr_codes_512: merchantPrefs?.qr_codes_512 ?? false,
    qr_codes_1024: merchantPrefs?.qr_codes_1024 !== false,
    qr_codes_2048: merchantPrefs?.qr_codes_2048 ?? false,
    qr_product: merchantPrefs?.qr_product !== false,
    qr_store: merchantPrefs?.qr_store !== false,
    qr_logo: merchantPrefs?.qr_logo ?? false,
    qr_directory: merchantPrefs?.qr_directory ?? false,
    image_gallery_5: merchantPrefs?.image_gallery_5 !== false,
    image_gallery_10: merchantPrefs?.image_gallery_10 ?? false,
    image_gallery_15: merchantPrefs?.image_gallery_15 ?? false,
    enhanced_seo: merchantPrefs?.enhanced_seo ?? false,
    storefront_actions: merchantPrefs?.storefront_actions ?? false,
    storefront_layout: merchantPrefs?.storefront_layout || 'classic',
    default_qr_resolution: merchantPrefs?.default_qr_resolution || '1024',
    default_gallery_limit: merchantPrefs?.default_gallery_limit || 5,
  };

  // Effective filters
  const effectiveHoursTypes = mainOn ? allowedHoursTypes.filter((t) => prefs[t] !== false) : [];
  const effectiveCategoryTypes = mainOn ? allowedCategoryTypes.filter((t) => prefs[t] !== false) : [];
  const effectiveRecommendTypes = mainOn ? allowedRecommendTypes.filter((t) => prefs[t] !== false) : [];
  const effectiveInfoTypes = mainOn ? allowedInfoTypes.filter((t) => prefs[t] !== false) : [];
  const effectiveQRResolutions = mainOn ? allowedQRResolutions.filter((t) => prefs[t] !== false) : [];
  const effectiveQRContentTypes = mainOn ? allowedQRContentTypes.filter((t) => prefs[t] !== false) : [];
  const effectiveGalleryTypes = mainOn ? allowedGalleryTypes.filter((t) => prefs[t] !== false) : [];
  const effectiveAdvancedTypes = mainOn ? allowedAdvancedTypes.filter((t) => prefs[t] !== false) : [];
  const effectiveLayouts = mainOn ? allowedLayouts : [];
  const merchantLayoutChoice = merchantPrefs?.storefront_layout || 'classic';
  const effectiveLayout: StorefrontOptLayoutType = effectiveLayouts.includes(merchantLayoutChoice as StorefrontOptLayoutType)
    ? (merchantLayoutChoice as StorefrontOptLayoutType)
    : (effectiveLayouts[0] || 'classic');

  const hoursDisplayTierAllowed = flexible || !!features.storefront_opt_hours_display;
  const mapDisplayTierAllowed = flexible || !!features.storefront_opt_map_display;
  const locationDisplayTierAllowed = flexible || !!features.storefront_opt_location_display;
  const recentlyViewedTierAllowed = flexible || !!features.storefront_opt_recently_viewed;

  return {
    enabled: mainOn,
    is_flexible: flexible,
    hours_enabled: mainOn && (hoursGroupEnabled || allowedHoursTypes.length > 0),
    allowed_hours_types: allowedHoursTypes,
    category_enabled: mainOn && (categoryGroupEnabled || allowedCategoryTypes.length > 0),
    allowed_category_types: allowedCategoryTypes,
    recommend_enabled: mainOn && (recommendGroupEnabled || allowedRecommendTypes.length > 0),
    allowed_recommend_types: allowedRecommendTypes,
    recently_viewed_enabled: mainOn && recentlyViewedTierAllowed,
    info_enabled: mainOn && (infoGroupEnabled || allowedInfoTypes.length > 0),
    allowed_info_types: allowedInfoTypes,
    qr_enabled: mainOn && (qrGroupEnabled || allowedQRResolutions.length > 0 || allowedQRContentTypes.length > 0),
    allowed_qr_resolutions: allowedQRResolutions,
    allowed_qr_content_types: allowedQRContentTypes,
    gallery_enabled: mainOn && (galleryGroupEnabled || allowedGalleryTypes.length > 0),
    allowed_gallery_types: allowedGalleryTypes,
    advanced_enabled: mainOn && (advancedGroupEnabled || allowedAdvancedTypes.length > 0),
    allowed_advanced_types: allowedAdvancedTypes,
    layout_enabled: mainOn && (layoutGroupEnabled || allowedLayouts.length > 0),
    allowed_layouts: allowedLayouts,
    effective_layout: effectiveLayout,
    can_show_hours_display: mainOn && hoursDisplayTierAllowed && prefs.hours_display,
    can_use_animated_hours: mainOn && effectiveHoursTypes.includes('hours_animated'),
    can_show_hours_status: mainOn && effectiveHoursTypes.includes('hours_status'),
    can_show_map_display: mainOn && mapDisplayTierAllowed && prefs.map_display,
    can_show_location_display: mainOn && locationDisplayTierAllowed && prefs.location_display,
    can_use_category_store: mainOn && effectiveCategoryTypes.includes('category_store'),
    can_use_category_product: mainOn && effectiveCategoryTypes.includes('category_product'),
    can_use_recommend_store: mainOn && effectiveRecommendTypes.includes('recommend_store'),
    can_use_recommend_products: mainOn && effectiveRecommendTypes.includes('recommend_products'),
    can_use_recently_viewed: mainOn && recentlyViewedTierAllowed && prefs.recently_viewed,
    can_use_social_media: mainOn && effectiveInfoTypes.includes('storefront_social_media'),
    can_use_contact: mainOn && effectiveInfoTypes.includes('storefront_contact'),
    can_use_interactive_maps: mainOn && effectiveInfoTypes.includes('interactive_maps'),
    can_use_qr_codes: mainOn && (effectiveQRResolutions.length > 0 || effectiveQRContentTypes.length > 0),
    can_use_enhanced_seo: mainOn && effectiveAdvancedTypes.includes('enhanced_seo'),
    can_use_storefront_actions: mainOn && effectiveAdvancedTypes.includes('storefront_actions'),
    can_use_layout_classic: mainOn && allowedLayouts.includes('classic'),
    can_use_layout_editorial: mainOn && allowedLayouts.includes('editorial'),
    can_use_layout_immersive: mainOn && allowedLayouts.includes('immersive'),
    merchant_preferences: prefs,
  };
}
