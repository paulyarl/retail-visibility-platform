/**
 * Storefront Gallery Resolver
 *
 * Resolves effective gallery state from tier features + merchant preferences.
 * Extracted from StorefrontOptionsResolver.ts (lines 136-149).
 *
 * Checks new storefront_gallery_* keys first, then falls back to old
 * storefront_opt_gallery_* keys in storefront_options features.
 */

import type {
  EffectiveStorefrontGallery,
  StorefrontGalleryMerchantSettings,
  StorefrontOptGalleryType,
  StorefrontOptGalleryDisplayMode,
} from './types';

export function resolveStorefrontGallery(
  features: Record<string, boolean>,
  merchantPrefs: StorefrontGalleryMerchantSettings | null,
  fallbackFeatures: Record<string, boolean> = {},
): EffectiveStorefrontGallery {
  const disabled = !!features.storefront_gallery_disabled || !!fallbackFeatures.storefront_opt_disabled;
  const enabled = !disabled && (!!features.storefront_gallery_enabled || !!fallbackFeatures.storefront_opt_enabled);
  const flexible = !!features.storefront_gallery_flexible || !!fallbackFeatures.storefront_opt_flexible;
  const mainOn = enabled;

  // Gallery group — new keys with fallback to old storefront_opt_gallery_* keys
  const galleryGroupEnabled = flexible
    || !!features.storefront_gallery_on || !!features.storefront_gallery
    || !!features.storefront_gallery_enabled
    || !!fallbackFeatures.storefront_opt_gallery_on
    || !!fallbackFeatures.storefront_opt_gallery
    || !!fallbackFeatures.storefront_opt_gallery_enabled;

  // Image limits — new keys with fallback to old storefront_opt_image_gallery_* keys
  const allowedGalleryTypes: StorefrontOptGalleryType[] = [];
  if (galleryGroupEnabled) {
    if (flexible
      || features.storefront_gallery_on || features.storefront_gallery || features.storefront_gallery_enabled
      || fallbackFeatures.storefront_opt_gallery_on
      || fallbackFeatures.storefront_opt_gallery
      || fallbackFeatures.storefront_opt_gallery_enabled
    ) {
      allowedGalleryTypes.push('image_gallery_5', 'image_gallery_10', 'image_gallery_15');
    } else {
      if (features.storefront_gallery_limit_5 || fallbackFeatures.storefront_opt_image_gallery_5) allowedGalleryTypes.push('image_gallery_5');
      if (features.storefront_gallery_limit_10 || fallbackFeatures.storefront_opt_image_gallery_10) allowedGalleryTypes.push('image_gallery_10');
      if (features.storefront_gallery_limit_15 || fallbackFeatures.storefront_opt_image_gallery_15) allowedGalleryTypes.push('image_gallery_15');
    }
  }

  // Carousel sub-group (new — explicit carousel mode)
  const galleryCarouselEnabled = galleryGroupEnabled && (
    flexible
    || !!features.storefront_gallery_carousel
    || !!features.storefront_gallery_carousel_on
    || !!features.storefront_gallery_enabled
  );

  // Magazine sub-group — magazine/mosaic display mode (tier-gated feature)
  const galleryMagazineEnabled = galleryGroupEnabled && (
    flexible
    || !!features.storefront_gallery_magazine
    || !!features.storefront_gallery_magazine_on
    || !!fallbackFeatures.storefront_opt_gallery_magazine
  );

  // Merchant preferences
  const prefs = {
    gallery_enabled: merchantPrefs?.gallery_enabled !== false,
    gallery_display_mode: (merchantPrefs?.gallery_display_mode as StorefrontOptGalleryDisplayMode) || 'carousel',
    image_gallery_5: merchantPrefs?.image_gallery_5 !== false,
    image_gallery_10: merchantPrefs?.image_gallery_10 ?? false,
    image_gallery_15: merchantPrefs?.image_gallery_15 ?? false,
    default_gallery_limit: merchantPrefs?.default_gallery_limit || 5,
  };

  // Effective display mode — merchant pref, but magazine requires tier gate
  const effectiveDisplayMode: StorefrontOptGalleryDisplayMode =
    prefs.gallery_display_mode === 'magazine' && !galleryMagazineEnabled ? 'carousel' : prefs.gallery_display_mode;

  // Effective gallery limit from merchant prefs
  const effectiveGalleryLimit = prefs.default_gallery_limit;

  // Effective gallery types filtered by merchant prefs
  const effectiveGalleryTypes = mainOn ? allowedGalleryTypes.filter((t) => prefs[t] !== false) : [];

  return {
    enabled: mainOn,
    is_flexible: flexible,
    gallery_enabled: mainOn && (galleryGroupEnabled || allowedGalleryTypes.length > 0),
    allowed_gallery_types: allowedGalleryTypes,
    default_gallery_limit: effectiveGalleryLimit,
    gallery_display_mode: effectiveDisplayMode,
    gallery_carousel_enabled: mainOn && galleryCarouselEnabled,
    gallery_magazine_enabled: mainOn && galleryMagazineEnabled,
    can_use_magazine_gallery: mainOn && galleryMagazineEnabled && effectiveDisplayMode === 'magazine',
    can_use_gallery: mainOn && effectiveGalleryTypes.length > 0,
    merchant_preferences: prefs,
  };
}
