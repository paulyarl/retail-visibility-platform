/**
 * Product Options Resolver
 *
 * Resolves effective product options state from tier features + merchant preferences.
 * Uses group gates (R16) for creation, layout, and sections groups.
 *
 * Type gating (physical/digital/hybrid/service) is handled by ProductTypeResolver.
 */

import type {
  EffectiveProductOptions,
  ProductOptionsMerchantSettings,
  ProductLayoutType,
} from './types';

export function resolveProductOptions(
  features: Record<string, boolean>,
  merchantPrefs: ProductOptionsMerchantSettings | null
): EffectiveProductOptions {
  // ── Master gates (R17: disabled > enabled > flexible > features) ──
  const masterDisabled = !!features.product_options_disabled;
  const masterEnabled = !!features.product_options_enabled;
  const flexible = !!features.product_options_flexible;

  const enabled = masterDisabled
    ? false
    : masterEnabled
      ? true
      : flexible
        ? true
        : hasAnyOptionsFeature(features);

  const isFlexible = flexible;

  // ── Creation group (R16: group gates) ──
  const creationGroupOn = !!features.product_options_creation_on || !!features.product_options_creation_enabled;
  const creationGroupOff = !!features.product_options_creation_off || !!features.product_options_creation_disabled;

  const showsVariants = isFlexible || creationGroupOn || !!features.product_options_creation_variants;
  const showsGallery = isFlexible || creationGroupOn || !!features.product_options_creation_gallery;
  const showsVideo = isFlexible || creationGroupOn || !!features.product_options_creation_video;
  const showsSupplierCatalog = isFlexible || creationGroupOn || !!features.product_options_creation_supplier_catalog;

  const creationEnabled = !creationGroupOff && (isFlexible || creationGroupOn || showsVariants || showsGallery || showsVideo || showsSupplierCatalog);

  // ── Layout group (R16: group gates) ──
  const layoutGroupOn = !!features.product_options_layout_on || !!features.product_options_layout_enabled;
  const layoutGroupOff = !!features.product_options_layout_off || !!features.product_options_layout_disabled;

  const layoutEnabled = !layoutGroupOff && (isFlexible || layoutGroupOn);
  const allowedLayouts: ProductLayoutType[] = [];
  if (isFlexible || (layoutEnabled && !layoutGroupOff)) {
    if (isFlexible || layoutGroupOn) {
      allowedLayouts.push('classic', 'editorial', 'immersive');
    } else {
      if (features.product_options_layout_classic) allowedLayouts.push('classic');
      if (features.product_options_layout_editorial) allowedLayouts.push('editorial');
      if (features.product_options_layout_immersive) allowedLayouts.push('immersive');
    }
  }

  // ── Sections group (R16: group gates) ──
  const sectionsGroupOn = !!features.product_options_sections_on || !!features.product_options_sections_enabled;
  const sectionsGroupOff = !!features.product_options_sections_off || !!features.product_options_sections_disabled;

  const sectionsEnabled = !sectionsGroupOff && (isFlexible || sectionsGroupOn || hasAnySectionFeature(features));

  const showsRecentlyViewed = isFlexible || sectionsGroupOn || !!features.product_options_sections_recently_viewed;
  const showsQrCodes = isFlexible || sectionsGroupOn || !!features.product_options_sections_qr_codes;
  const showsQrLogo = isFlexible || sectionsGroupOn || !!features.product_options_sections_qr_logo;
  const showsRecommended = isFlexible || sectionsGroupOn || !!features.product_options_sections_recommended;
  const showsMapDisplay = isFlexible || sectionsGroupOn || !!features.product_options_sections_map_display;
  const showsLocationDisplay = isFlexible || sectionsGroupOn || !!features.product_options_sections_location_display;
  const showsHoursDisplay = isFlexible || sectionsGroupOn || !!features.product_options_sections_hours_display;
  const showsEnhancedSeo = isFlexible || sectionsGroupOn || !!features.product_options_sections_enhanced_seo;
  const showsReviews = isFlexible || sectionsGroupOn || !!features.product_options_sections_reviews;
  const showsFulfillment = isFlexible || sectionsGroupOn || !!features.product_options_sections_fulfillment;
  const showsCategories = isFlexible || sectionsGroupOn || !!features.product_options_sections_categories;
  const showsLocationAvailability = isFlexible || sectionsGroupOn || !!features.product_options_sections_location_availability;

  // ── Merchant preferences (soft toggles, default true when unset) ──
  const prefs = {
    product_variant_enabled: merchantPrefs?.product_variant_enabled !== false,
    product_gallery_enabled: merchantPrefs?.product_gallery_enabled !== false,
    product_video_enabled: merchantPrefs?.product_video_enabled !== false,
    product_layout: merchantPrefs?.product_layout || 'classic',
    product_opt_recently_viewed: merchantPrefs?.product_opt_recently_viewed !== false,
    product_opt_qr_codes: merchantPrefs?.product_opt_qr_codes !== false,
    product_opt_qr_logo: merchantPrefs?.product_opt_qr_logo !== false,
    product_opt_recommended: merchantPrefs?.product_opt_recommended !== false,
    product_opt_map_display: merchantPrefs?.product_opt_map_display !== false,
    product_opt_location_display: merchantPrefs?.product_opt_location_display !== false,
    product_opt_hours_display: merchantPrefs?.product_opt_hours_display !== false,
    product_opt_enhanced_seo: merchantPrefs?.product_opt_enhanced_seo !== false,
    product_opt_reviews: merchantPrefs?.product_opt_reviews !== false,
    product_opt_fulfillment: merchantPrefs?.product_opt_fulfillment !== false,
    product_opt_categories: merchantPrefs?.product_opt_categories !== false,
    product_opt_location_availability: merchantPrefs?.product_opt_location_availability !== false,
    product_opt_supplier_catalog: merchantPrefs?.product_opt_supplier_catalog !== false,
  };

  // ── Effective layout ──
  const effectiveLayout = allowedLayouts.includes(prefs.product_layout as ProductLayoutType)
    ? prefs.product_layout as ProductLayoutType
    : allowedLayouts[0] || 'classic';

  return {
    enabled,
    // Creation group
    creation_enabled: creationEnabled,
    shows_variants: showsVariants,
    shows_gallery: showsGallery,
    shows_video: showsVideo,
    effective_shows_variants: showsVariants && prefs.product_variant_enabled,
    effective_shows_gallery: showsGallery && prefs.product_gallery_enabled,
    effective_shows_video: showsVideo && prefs.product_video_enabled,
    // Layout group
    layout_enabled: layoutEnabled,
    allowed_layouts: allowedLayouts,
    effective_layout: effectiveLayout,
    can_use_layout_classic: allowedLayouts.includes('classic'),
    can_use_layout_editorial: allowedLayouts.includes('editorial'),
    can_use_layout_immersive: allowedLayouts.includes('immersive'),
    // Sections group
    sections_enabled: sectionsEnabled,
    shows_recently_viewed: showsRecentlyViewed,
    shows_qr_codes: showsQrCodes,
    shows_qr_logo: showsQrLogo,
    shows_recommended: showsRecommended,
    shows_map_display: showsMapDisplay,
    shows_location_display: showsLocationDisplay,
    shows_hours_display: showsHoursDisplay,
    shows_enhanced_seo: showsEnhancedSeo,
    shows_reviews: showsReviews,
    shows_fulfillment: showsFulfillment,
    shows_categories: showsCategories,
    shows_location_availability: showsLocationAvailability,
    // Effective section flags (tier-allowed AND merchant-enabled)
    effective_shows_recently_viewed: showsRecentlyViewed && prefs.product_opt_recently_viewed,
    effective_shows_qr_codes: showsQrCodes && prefs.product_opt_qr_codes,
    effective_shows_qr_logo: showsQrLogo && prefs.product_opt_qr_logo,
    effective_shows_recommended: showsRecommended && prefs.product_opt_recommended,
    effective_shows_map_display: showsMapDisplay && prefs.product_opt_map_display,
    effective_shows_location_display: showsLocationDisplay && prefs.product_opt_location_display,
    effective_shows_hours_display: showsHoursDisplay && prefs.product_opt_hours_display,
    effective_shows_enhanced_seo: showsEnhancedSeo && prefs.product_opt_enhanced_seo,
    effective_shows_reviews: showsReviews && prefs.product_opt_reviews,
    effective_shows_fulfillment: showsFulfillment && prefs.product_opt_fulfillment,
    effective_shows_categories: showsCategories && prefs.product_opt_categories,
    effective_shows_location_availability: showsLocationAvailability && prefs.product_opt_location_availability,
    // Supplier catalog (creation group)
    shows_supplier_catalog: showsSupplierCatalog,
    effective_shows_supplier_catalog: showsSupplierCatalog && prefs.product_opt_supplier_catalog,
    merchant_preferences: prefs,
    is_flexible: isFlexible,
  };
}

function hasAnyOptionsFeature(features: Record<string, boolean>): boolean {
  return !!(
    features.product_options_creation_variants ||
    features.product_options_creation_gallery ||
    features.product_options_creation_video ||
    features.product_options_layout_classic ||
    features.product_options_layout_editorial ||
    features.product_options_layout_immersive ||
    features.product_options_sections_recently_viewed ||
    features.product_options_sections_qr_codes ||
    features.product_options_sections_recommended
  );
}

function hasAnySectionFeature(features: Record<string, boolean>): boolean {
  return !!(
    features.product_options_sections_recently_viewed ||
    features.product_options_sections_qr_codes ||
    features.product_options_sections_qr_logo ||
    features.product_options_sections_recommended ||
    features.product_options_sections_map_display ||
    features.product_options_sections_location_display ||
    features.product_options_sections_hours_display ||
    features.product_options_sections_enhanced_seo ||
    features.product_options_sections_reviews ||
    features.product_options_sections_fulfillment ||
    features.product_options_sections_categories ||
    features.product_options_sections_location_availability
  );
}
