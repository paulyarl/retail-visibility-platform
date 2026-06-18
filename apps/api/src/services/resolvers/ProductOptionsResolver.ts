/**
 * Product Options Resolver
 *
 * Resolves effective product options state from tier features + merchant preferences.
 */

import type {
  EffectiveProductOptions,
  ProductOptionsMerchantSettings,
} from './types';

export type ProductType = 'physical' | 'digital' | 'hybrid' | 'service';
export type ProductLayoutType = 'classic' | 'editorial' | 'immersive';

export function resolveProductOptions(
  features: Record<string, boolean>,
  merchantPrefs: ProductOptionsMerchantSettings | null
): EffectiveProductOptions {
  const enabled = !!features.product_enabled;
  const flexible = !!features.product_flexible;

  const allowedTypes: ProductType[] = [];
  if (features.product_physical) allowedTypes.push('physical');
  if (features.product_digital) allowedTypes.push('digital');
  if (features.product_hybrid) allowedTypes.push('hybrid');
  if (features.product_service) allowedTypes.push('service');
  if (flexible) {
    allowedTypes.push('physical', 'digital', 'hybrid', 'service');
  }
  const uniqueAllowedTypes = [...new Set(allowedTypes)];

  const showsVariants = flexible || !!features.product_variant;
  const showsGallery = flexible || !!features.product_gallery;
  const showsVideo = flexible || !!features.product_video;

  const layoutEnabled = flexible || !!features.product_layout_enabled;
  const allowedLayouts: ProductLayoutType[] = [];
  if (flexible || layoutEnabled) {
    allowedLayouts.push('classic', 'editorial', 'immersive');
  } else {
    if (features.product_layout_classic) allowedLayouts.push('classic');
    if (features.product_layout_editorial) allowedLayouts.push('editorial');
    if (features.product_layout_immersive) allowedLayouts.push('immersive');
  }

  const prefs = {
    product_physical_enabled: merchantPrefs?.product_physical_enabled !== false,
    product_digital_enabled: merchantPrefs?.product_digital_enabled !== false,
    product_hybrid_enabled: merchantPrefs?.product_hybrid_enabled !== false,
    product_service_enabled: merchantPrefs?.product_service_enabled !== false,
    product_variant_enabled: merchantPrefs?.product_variant_enabled !== false,
    product_gallery_enabled: merchantPrefs?.product_gallery_enabled !== false,
    product_video_enabled: merchantPrefs?.product_video_enabled !== false,
    product_layout: merchantPrefs?.product_layout || 'classic',
    product_opt_recently_viewed: merchantPrefs?.product_opt_recently_viewed !== false,
    product_opt_qr_codes: merchantPrefs?.product_opt_qr_codes !== false,
    product_opt_recommended: merchantPrefs?.product_opt_recommended !== false,
    product_opt_map_display: merchantPrefs?.product_opt_map_display !== false,
    product_opt_location_display: merchantPrefs?.product_opt_location_display !== false,
    product_opt_hours_display: merchantPrefs?.product_opt_hours_display !== false,
    product_opt_enhanced_seo: merchantPrefs?.product_opt_enhanced_seo !== false,
    product_opt_reviews: merchantPrefs?.product_opt_reviews !== false,
    product_opt_fulfillment: merchantPrefs?.product_opt_fulfillment !== false,
    product_opt_categories: merchantPrefs?.product_opt_categories !== false,
    product_opt_location_availability: merchantPrefs?.product_opt_location_availability !== false,
  };

  const effectiveTypes = uniqueAllowedTypes.filter((t) => {
    switch (t) {
      case 'physical': return prefs.product_physical_enabled;
      case 'digital': return prefs.product_digital_enabled;
      case 'hybrid': return prefs.product_hybrid_enabled;
      case 'service': return prefs.product_service_enabled;
      default: return true;
    }
  });

  const effectiveLayout = allowedLayouts.includes(prefs.product_layout as ProductLayoutType)
    ? prefs.product_layout as ProductLayoutType
    : allowedLayouts[0] || 'classic';

  return {
    enabled,
    allowed_types: uniqueAllowedTypes,
    effective_types: effectiveTypes,
    shows_variants: showsVariants,
    shows_gallery: showsGallery,
    shows_video: showsVideo,
    effective_shows_variants: showsVariants && prefs.product_variant_enabled,
    effective_shows_gallery: showsGallery && prefs.product_gallery_enabled,
    effective_shows_video: showsVideo && prefs.product_video_enabled,
    layout_enabled: layoutEnabled,
    allowed_layouts: allowedLayouts,
    effective_layout: effectiveLayout,
    can_use_layout_classic: allowedLayouts.includes('classic'),
    can_use_layout_editorial: allowedLayouts.includes('editorial'),
    can_use_layout_immersive: allowedLayouts.includes('immersive'),
    shows_recently_viewed: flexible || !!features.product_opt_recently_viewed,
    shows_qr_codes: flexible || !!features.product_opt_qr_codes,
    shows_recommended: flexible || !!features.product_opt_recommended,
    shows_map_display: flexible || !!features.product_opt_map_display,
    shows_location_display: flexible || !!features.product_opt_location_display,
    shows_hours_display: flexible || !!features.product_opt_hours_display,
    shows_enhanced_seo: flexible || !!features.product_opt_enhanced_seo,
    shows_reviews: flexible || !!features.product_opt_reviews,
    shows_fulfillment: flexible || !!features.product_opt_fulfillment,
    shows_categories: flexible || !!features.product_opt_categories,
    shows_location_availability: flexible || !!features.product_opt_location_availability,
    merchant_preferences: prefs,
    is_flexible: flexible,
  };
}
