/**
 * Storefront Options Utility
 *
 * Domain helpers for working with the storefront_options capability.
 * Provides classification, display, and filtering logic for storefront option types
 * across tenant, admin, and public scopes.
 */

import {
  StorefrontOptHoursType as HoursTypeInternal,
  StorefrontOptCategoryType as CategoryTypeInternal,
  StorefrontOptRecommendType as RecommendTypeInternal,
  StorefrontOptInfoType as InfoTypeInternal,
  StorefrontOptQRResolutionType as QRResolutionTypeInternal,
  StorefrontOptQRContentType as QRContentTypeInternal,
  StorefrontOptGalleryType as GalleryTypeInternal,
  StorefrontOptAdvancedType as AdvancedTypeInternal,
  StorefrontOptionsState,
} from '@/services/CapabilityResolutionService';

// Re-export types for consumers
export type StorefrontOptHoursType = HoursTypeInternal;
export type StorefrontOptCategoryType = CategoryTypeInternal;
export type StorefrontOptRecommendType = RecommendTypeInternal;
export type StorefrontOptInfoType = InfoTypeInternal;
export type StorefrontOptQRResolutionType = QRResolutionTypeInternal;
export type StorefrontOptQRContentType = QRContentTypeInternal;
export type StorefrontOptGalleryType = GalleryTypeInternal;
export type StorefrontOptAdvancedType = AdvancedTypeInternal;

// ====================
// GROUP DEFINITIONS
// ====================

export type StorefrontOptGroup = 'hours' | 'category' | 'recommend' | 'behavior' | 'info' | 'qr' | 'gallery' | 'gallery_mode' | 'advanced';

export const HOURS_TYPES: StorefrontOptHoursType[] = ['hours_animated', 'hours_status'];
export const CATEGORY_TYPES: StorefrontOptCategoryType[] = ['category_store', 'category_product'];
export const RECOMMEND_TYPES: StorefrontOptRecommendType[] = ['recommend_store', 'recommend_products'];
export const INFO_TYPES: StorefrontOptInfoType[] = ['storefront_social_media', 'storefront_contact', 'interactive_maps'];
export const QR_RESOLUTION_TYPES: StorefrontOptQRResolutionType[] = ['qr_codes_512', 'qr_codes_1024', 'qr_codes_2048'];
export const QR_CONTENT_TYPES: StorefrontOptQRContentType[] = ['qr_product', 'qr_store', 'qr_logo', 'qr_directory'];
export const GALLERY_TYPES: StorefrontOptGalleryType[] = ['image_gallery_5', 'image_gallery_10', 'image_gallery_15'];
export const GALLERY_MODE_TYPES = ['carousel', 'magazine'] as const;
export const ADVANCED_TYPES: StorefrontOptAdvancedType[] = ['enhanced_seo', 'storefront_actions'];

// ====================
// TYPE GUARDS
// ====================

export function isHoursType(type: string): type is StorefrontOptHoursType {
  return HOURS_TYPES.includes(type as StorefrontOptHoursType);
}

export function isCategoryType(type: string): type is StorefrontOptCategoryType {
  return CATEGORY_TYPES.includes(type as StorefrontOptCategoryType);
}

export function isRecommendType(type: string): type is StorefrontOptRecommendType {
  return RECOMMEND_TYPES.includes(type as StorefrontOptRecommendType);
}

export function isInfoType(type: string): type is StorefrontOptInfoType {
  return INFO_TYPES.includes(type as StorefrontOptInfoType);
}

export function isQRResolutionType(type: string): type is StorefrontOptQRResolutionType {
  return QR_RESOLUTION_TYPES.includes(type as StorefrontOptQRResolutionType);
}

export function isQRContentType(type: string): type is StorefrontOptQRContentType {
  return QR_CONTENT_TYPES.includes(type as StorefrontOptQRContentType);
}

export function isGalleryType(type: string): type is StorefrontOptGalleryType {
  return GALLERY_TYPES.includes(type as StorefrontOptGalleryType);
}

export function isAdvancedType(type: string): type is StorefrontOptAdvancedType {
  return ADVANCED_TYPES.includes(type as StorefrontOptAdvancedType);
}

// ====================
// DISPLAY HELPERS
// ====================

export interface StorefrontOptTypeMeta {
  key: string;
  label: string;
  description: string;
  group: StorefrontOptGroup;
  icon: string;
  color: string;
  /** Selection mode for this type within its group */
  selectionMode: 'toggle' | 'radio' | 'multi';
}

const STOREFRONT_OPT_TYPE_META: Record<string, StorefrontOptTypeMeta> = {
  // Store Hours
  hours_animated: { key: 'hours_animated', label: 'Animated Hours', description: 'Animated store hours display with transitions', group: 'hours', icon: '⏰', color: 'blue', selectionMode: 'toggle' },
  hours_status: { key: 'hours_status', label: 'Open/Closed Status', description: 'Real-time open/closed indicator badge', group: 'hours', icon: '🟢', color: 'green', selectionMode: 'toggle' },
  // Category Display
  category_store: { key: 'category_store', label: 'Store Categories', description: 'Category navigation on storefront page', group: 'category', icon: '🏪', color: 'purple', selectionMode: 'toggle' },
  category_product: { key: 'category_product', label: 'Product Categories', description: 'Category badges on product cards', group: 'category', icon: '🏷️', color: 'violet', selectionMode: 'toggle' },
  // Recommendation Display
  recommend_store: { key: 'recommend_store', label: 'Store Recommendations', description: 'Recommended stores section', group: 'recommend', icon: '⭐', color: 'amber', selectionMode: 'toggle' },
  recommend_products: { key: 'recommend_products', label: 'Product Recommendations', description: 'Recommended products section', group: 'recommend', icon: '💡', color: 'yellow', selectionMode: 'toggle' },
  // User Behavior
  recently_viewed: { key: 'recently_viewed', label: 'Recently Viewed', description: 'Track and display recently viewed products', group: 'behavior', icon: '👁️', color: 'teal', selectionMode: 'toggle' },
  // Store Information
  storefront_social_media: { key: 'storefront_social_media', label: 'Social Media Links', description: 'Social media links on storefront', group: 'info', icon: '🔗', color: 'cyan', selectionMode: 'toggle' },
  storefront_contact: { key: 'storefront_contact', label: 'Contact Info', description: 'Contact information on storefront', group: 'info', icon: '📞', color: 'sky', selectionMode: 'toggle' },
  interactive_maps: { key: 'interactive_maps', label: 'Interactive Maps', description: 'Embedded interactive map on storefront', group: 'info', icon: '🗺️', color: 'emerald', selectionMode: 'toggle' },
  // QR Code Display — Resolution (multi select)
  qr_codes_512: { key: 'qr_codes_512', label: 'QR 512px', description: '512px QR code resolution (standard)', group: 'qr', icon: '📱', color: 'slate', selectionMode: 'multi' },
  qr_codes_1024: { key: 'qr_codes_1024', label: 'QR 1024px', description: '1024px QR code resolution (high)', group: 'qr', icon: '📱', color: 'gray', selectionMode: 'multi' },
  qr_codes_2048: { key: 'qr_codes_2048', label: 'QR 2048px', description: '2048px QR code resolution (HD)', group: 'qr', icon: '📱', color: 'zinc', selectionMode: 'multi' },
  // QR Code Display — Content (toggle)
  qr_product: { key: 'qr_product', label: 'Product QR', description: 'QR codes for individual products', group: 'qr', icon: '🏷️', color: 'indigo', selectionMode: 'toggle' },
  qr_store: { key: 'qr_store', label: 'Store QR', description: 'QR code for store page', group: 'qr', icon: '🏪', color: 'blue', selectionMode: 'toggle' },
  qr_logo: { key: 'qr_logo', label: 'Logo QR', description: 'QR code with embedded logo', group: 'qr', icon: '🎨', color: 'fuchsia', selectionMode: 'toggle' },
  qr_directory: { key: 'qr_directory', label: 'Directory QR', description: 'QR code for directory listing', group: 'qr', icon: '📋', color: 'pink', selectionMode: 'toggle' },
  // Gallery Display (radio)
  image_gallery_5: { key: 'image_gallery_5', label: '5 Images', description: 'Gallery limit of 5 images', group: 'gallery', icon: '🖼️', color: 'orange', selectionMode: 'radio' },
  image_gallery_10: { key: 'image_gallery_10', label: '10 Images', description: 'Gallery limit of 10 images', group: 'gallery', icon: '🖼️', color: 'rose', selectionMode: 'radio' },
  image_gallery_15: { key: 'image_gallery_15', label: '15 Images', description: 'Gallery limit of 15 images', group: 'gallery', icon: '🖼️', color: 'red', selectionMode: 'radio' },
  // Gallery Display Mode (radio)
  carousel: { key: 'carousel', label: 'Carousel', description: 'One image at a time with navigation. Classic controlled viewing.', group: 'gallery_mode', icon: '🔄', color: 'orange', selectionMode: 'radio' },
  magazine: { key: 'magazine', label: 'Magazine', description: 'All images displayed at once in a magazine mosaic. Maximum visual impact.', group: 'gallery_mode', icon: '📰', color: 'rose', selectionMode: 'radio' },
  // Advanced
  enhanced_seo: { key: 'enhanced_seo', label: 'Enhanced SEO', description: 'Advanced SEO controls and metadata', group: 'advanced', icon: '🔍', color: 'lime', selectionMode: 'toggle' },
  storefront_actions: { key: 'storefront_actions', label: 'Storefront Actions', description: 'Custom call-to-action buttons', group: 'advanced', icon: '⚡', color: 'yellow', selectionMode: 'toggle' },
};

/**
 * Get metadata for a specific storefront option type.
 */
export function getStorefrontOptMeta(type: string): StorefrontOptTypeMeta | undefined {
  return STOREFRONT_OPT_TYPE_META[type];
}

/**
 * Get all storefront option types in a group.
 */
export function getTypesByGroup(group: StorefrontOptGroup): string[] {
  switch (group) {
    case 'hours': return [...HOURS_TYPES];
    case 'category': return [...CATEGORY_TYPES];
    case 'recommend': return [...RECOMMEND_TYPES];
    case 'behavior': return ['recently_viewed'];
    case 'info': return [...INFO_TYPES];
    case 'qr': return [...QR_RESOLUTION_TYPES, ...QR_CONTENT_TYPES];
    case 'gallery': return [...GALLERY_TYPES];
    case 'advanced': return [...ADVANCED_TYPES];
    default: return [];
  }
}

/**
 * Get all storefront option type metadata, optionally filtered by group.
 */
export function getAllStorefrontOptMeta(group?: StorefrontOptGroup): StorefrontOptTypeMeta[] {
  const types = group ? getTypesByGroup(group) : Object.keys(STOREFRONT_OPT_TYPE_META);
  return types.map(t => STOREFRONT_OPT_TYPE_META[t]).filter(Boolean);
}

// ====================
// GROUP METADATA
// ====================

export interface StorefrontOptGroupMeta {
  key: StorefrontOptGroup;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export const STOREFRONT_OPT_GROUPS: StorefrontOptGroupMeta[] = [
  { key: 'hours', label: 'Store Hours', description: 'Hours display and status options', icon: '⏰', color: 'blue' },
  { key: 'category', label: 'Category Display', description: 'Category navigation and badges', icon: '🏷️', color: 'purple' },
  { key: 'recommend', label: 'Recommendation Display', description: 'Recommended content sections', icon: '⭐', color: 'amber' },
  { key: 'behavior', label: 'User Behavior', description: 'User tracking and behavior features', icon: '👁️', color: 'teal' },
  { key: 'info', label: 'Store Information', description: 'Contact, social, and map display', icon: 'ℹ️', color: 'cyan' },
  { key: 'qr', label: 'QR Code Display', description: 'QR code generation and display options', icon: '📱', color: 'indigo' },
  { key: 'gallery', label: 'Gallery Display', description: 'Image gallery limits', icon: '🖼️', color: 'orange' },
  { key: 'advanced', label: 'Advanced', description: 'Advanced storefront features', icon: '⚡', color: 'lime' },
];

export function getGroupMeta(group: StorefrontOptGroup): StorefrontOptGroupMeta | undefined {
  return STOREFRONT_OPT_GROUPS.find(g => g.key === group);
}

// ====================
// CAPABILITY-AWARE FILTERING
// ====================

/**
 * Filter storefront option types based on capability state.
 * Returns only types that are allowed by the tenant's tier.
 */
export function filterAllowedTypes(state: StorefrontOptionsState, group?: StorefrontOptGroup): string[] {
  if (!state.enabled) return [];

  const allTypes = group ? getTypesByGroup(group) : [
    ...HOURS_TYPES, ...CATEGORY_TYPES, ...RECOMMEND_TYPES, 'recently_viewed',
    ...INFO_TYPES, ...QR_RESOLUTION_TYPES, ...QR_CONTENT_TYPES,
    ...GALLERY_TYPES, ...ADVANCED_TYPES,
  ];

  return allTypes.filter(type => {
    if (HOURS_TYPES.includes(type as StorefrontOptHoursType)) return false;
    if (CATEGORY_TYPES.includes(type as StorefrontOptCategoryType)) return state.allowedCategoryTypes.includes(type as StorefrontOptCategoryType);
    if (RECOMMEND_TYPES.includes(type as StorefrontOptRecommendType)) return state.allowedRecommendTypes.includes(type as StorefrontOptRecommendType);
    if (type === 'recently_viewed') return state.recentlyViewedEnabled;
    if (INFO_TYPES.includes(type as StorefrontOptInfoType)) return state.allowedInfoTypes.includes(type as StorefrontOptInfoType);
    if (QR_RESOLUTION_TYPES.includes(type as StorefrontOptQRResolutionType)) return false;
    if (QR_CONTENT_TYPES.includes(type as StorefrontOptQRContentType)) return false;
    if (GALLERY_TYPES.includes(type as StorefrontOptGalleryType)) return false;
    if (ADVANCED_TYPES.includes(type as StorefrontOptAdvancedType)) return state.allowedAdvancedTypes.includes(type as StorefrontOptAdvancedType);
    return false;
  });
}

/**
 * Get the effective (tier-allowed AND merchant-enabled) storefront option types.
 * Uses the convenience `canUse*` flags from the state.
 */
export function getEffectiveTypes(state: StorefrontOptionsState): string[] {
  if (!state.enabled) return [];

  const effective: string[] = [];
  if (state.canUseCategoryStore) effective.push('category_store');
  if (state.canUseCategoryProduct) effective.push('category_product');
  if (state.canUseRecommendStore) effective.push('recommend_store');
  if (state.canUseRecommendProducts) effective.push('recommend_products');
  if (state.canUseRecentlyViewed) effective.push('recently_viewed');
  if (state.canUseSocialMedia) effective.push('storefront_social_media');
  if (state.canUseContact) effective.push('storefront_contact');
  if (state.canUseInteractiveMaps) effective.push('interactive_maps');
  if (state.canUseEnhancedSEO) effective.push('enhanced_seo');
  if (state.canUseStorefrontActions) effective.push('storefront_actions');

  return effective;
}

/**
 * Get the active gallery limit from state (resolves radio selection).
 */
export function getActiveGalleryLimit(state: StorefrontOptionsState): number {
  return 0;
}

/**
 * Get the active QR resolution from state.
 */
export function getActiveQRResolution(state: StorefrontOptionsState): string {
  return '';
}

// ====================
// PUBLIC PAGE CONSUMPTION CONSTANTS
// ====================

/**
 * Pre-computed storefront option flags for public pages.
 * These constants are consumed by the storefront, directory, and products pages
 * to conditionally render UI elements based on tenant capability state.
 *
 * Usage:
 *   const flags = getStorefrontOptionFlags(state);
 *   if (flags.showAnimatedHours) { ... }
 */

export interface StorefrontOptionFlags {
  // Store Hours
  showAnimatedHours: boolean;
  showHoursStatus: boolean;
  // Category Display
  showCategoryStore: boolean;
  showCategoryProduct: boolean;
  // Recommendation Display
  showRecommendStore: boolean;
  showRecommendProducts: boolean;
  // User Behavior
  showRecentlyViewed: boolean;
  // Store Information
  showSocialMedia: boolean;
  showContact: boolean;
  showInteractiveMaps: boolean;
  // QR Code Display
  showQRCodes: boolean;
  showQRProduct: boolean;
  showQRStore: boolean;
  showQRLogo: boolean;
  showQRDirectory: boolean;
  qrResolution: string;
  // Gallery Display
  galleryLimit: number;
  // Advanced
  showEnhancedSEO: boolean;
  showStorefrontActions: boolean;
  // Layout
  storefrontLayout: 'classic' | 'editorial' | 'immersive';
}

/**
 * Derive storefront option flags from capability state for public page consumption.
 * Uses effective (tier-allowed AND merchant-enabled) state.
 */
export function getStorefrontOptionFlags(state: StorefrontOptionsState): StorefrontOptionFlags {
  return {
    showAnimatedHours: false,
    showHoursStatus: false,
    showCategoryStore: state.canUseCategoryStore,
    showCategoryProduct: state.canUseCategoryProduct,
    showRecommendStore: state.canUseRecommendStore,
    showRecommendProducts: state.canUseRecommendProducts,
    showRecentlyViewed: state.canUseRecentlyViewed,
    showSocialMedia: state.canUseSocialMedia,
    showContact: state.canUseContact,
    showInteractiveMaps: state.canUseInteractiveMaps,
    showQRCodes: false,
    showQRProduct: false,
    showQRStore: false,
    showQRLogo: false,
    showQRDirectory: false,
    qrResolution: '',
    galleryLimit: 0,
    showEnhancedSEO: state.canUseEnhancedSEO,
    showStorefrontActions: state.canUseStorefrontActions,
    storefrontLayout: 'classic',
  };
}

/**
 * Default flags when capability is disabled or unavailable.
 * All features off, sensible defaults for numeric values.
 */
export const DEFAULT_STOREFRONT_OPTION_FLAGS: StorefrontOptionFlags = {
  showAnimatedHours: false,
  showHoursStatus: false,
  showCategoryStore: false,
  showCategoryProduct: false,
  showRecommendStore: false,
  showRecommendProducts: false,
  showRecentlyViewed: false,
  showSocialMedia: false,
  showContact: false,
  showInteractiveMaps: false,
  showQRCodes: false,
  showQRProduct: false,
  showQRStore: false,
  showQRLogo: false,
  showQRDirectory: false,
  qrResolution: '',
  galleryLimit: 0,
  showEnhancedSEO: false,
  showStorefrontActions: false,
  storefrontLayout: 'classic',
};

/**
 * Page-specific flag subsets for targeted consumption.
 * Each page only gets the flags relevant to its context.
 */

/** Flags relevant to the public storefront page */
export interface StorefrontPageFlags {
  showAnimatedHours: boolean;
  showHoursStatus: boolean;
  showCategoryStore: boolean;
  showRecommendStore: boolean;
  showRecommendProducts: boolean;
  showRecentlyViewed: boolean;
  showSocialMedia: boolean;
  showContact: boolean;
  showInteractiveMaps: boolean;
  showQRStore: boolean;
  showQRLogo: boolean;
  showEnhancedSEO: boolean;
  showStorefrontActions: boolean;
  galleryLimit: number;
  storefrontLayout: 'classic' | 'editorial' | 'immersive';
}

/** Flags relevant to the public directory entry page */
export interface DirectoryPageFlags {
  showHoursStatus: boolean;
  showCategoryStore: boolean;
  showContact: boolean;
  showInteractiveMaps: boolean;
  showQRDirectory: boolean;
  showSocialMedia: boolean;
}

/** Flags relevant to the public products page */
export interface ProductsPageFlags {
  showCategoryProduct: boolean;
  showRecommendProducts: boolean;
  showRecentlyViewed: boolean;
  showQRProduct: boolean;
  galleryLimit: number;
}

/**
 * Extract storefront-page-specific flags from full flags.
 */
export function getStorefrontPageFlags(flags: StorefrontOptionFlags): StorefrontPageFlags {
  return {
    showAnimatedHours: flags.showAnimatedHours,
    showHoursStatus: flags.showHoursStatus,
    showCategoryStore: flags.showCategoryStore,
    showRecommendStore: flags.showRecommendStore,
    showRecommendProducts: flags.showRecommendProducts,
    showRecentlyViewed: flags.showRecentlyViewed,
    showSocialMedia: flags.showSocialMedia,
    showContact: flags.showContact,
    showInteractiveMaps: flags.showInteractiveMaps,
    showQRStore: flags.showQRStore,
    showQRLogo: flags.showQRLogo,
    showEnhancedSEO: flags.showEnhancedSEO,
    showStorefrontActions: flags.showStorefrontActions,
    galleryLimit: flags.galleryLimit,
    storefrontLayout: flags.storefrontLayout,
  };
}

/**
 * Extract directory-page-specific flags from full flags.
 */
export function getDirectoryPageFlags(flags: StorefrontOptionFlags): DirectoryPageFlags {
  return {
    showHoursStatus: flags.showHoursStatus,
    showCategoryStore: flags.showCategoryStore,
    showContact: flags.showContact,
    showInteractiveMaps: flags.showInteractiveMaps,
    showQRDirectory: flags.showQRDirectory,
    showSocialMedia: flags.showSocialMedia,
  };
}

/**
 * Extract products-page-specific flags from full flags.
 */
export function getProductsPageFlags(flags: StorefrontOptionFlags): ProductsPageFlags {
  return {
    showCategoryProduct: flags.showCategoryProduct,
    showRecommendProducts: flags.showRecommendProducts,
    showRecentlyViewed: flags.showRecentlyViewed,
    showQRProduct: flags.showQRProduct,
    galleryLimit: flags.galleryLimit,
  };
}
