/**
 * Storefront QR Resolver
 *
 * Resolves effective QR code state from tier features + merchant preferences.
 * Extracted from StorefrontOptionsResolver.ts (lines 78-134).
 *
 * Checks new storefront_qr_* keys first, then falls back to old
 * storefront_opt_qr_* keys in storefront_options features.
 */

import type {
  EffectiveStorefrontQr,
  StorefrontQrMerchantSettings,
  StorefrontOptQRResolutionType,
  StorefrontOptQRContentType,
  StorefrontOptQRDotStyleType,
  StorefrontOptQRCornerStyleType,
} from './types';

export function resolveStorefrontQr(
  features: Record<string, boolean>,
  merchantPrefs: StorefrontQrMerchantSettings | null,
  fallbackFeatures: Record<string, boolean> = {},
): EffectiveStorefrontQr {
  const disabled = !!features.storefront_qr_disabled || !!fallbackFeatures.storefront_opt_disabled;
  const enabled = !disabled && (!!features.storefront_qr_enabled || !!fallbackFeatures.storefront_opt_enabled);
  const flexible = !!features.storefront_qr_flexible || !!fallbackFeatures.storefront_opt_flexible;
  const mainOn = enabled;

  // QR group — new keys with fallback to old storefront_opt_qr_* keys
  // storefront_qr_enabled is the master enable (checked above), NOT a group-on key.
  // Individual QR keys implicitly enable the group.
  const hasAnyIndividualQRKey = !!(
    features.storefront_qr_resolution_512 || features.storefront_qr_resolution_1024 || features.storefront_qr_resolution_2048
    || features.storefront_qr_product || features.storefront_qr_store || features.storefront_qr_logo || features.storefront_qr_directory
    || fallbackFeatures.storefront_opt_qr_codes_512 || fallbackFeatures.storefront_opt_qr_codes_1024 || fallbackFeatures.storefront_opt_qr_codes_2048
    || fallbackFeatures.storefront_opt_qr_product || fallbackFeatures.storefront_opt_qr_store || fallbackFeatures.storefront_opt_qr_logo || fallbackFeatures.storefront_opt_qr_directory
  );
  const qrGroupEnabled = flexible
    || !!features.storefront_qr_on || !!features.storefront_qr
    || !!fallbackFeatures.storefront_opt_qr_on
    || !!fallbackFeatures.storefront_opt_qr
    || !!fallbackFeatures.storefront_opt_qr_enabled
    || hasAnyIndividualQRKey;

  // QR resolutions
  const allowedQRResolutions: StorefrontOptQRResolutionType[] = [];
  if (qrGroupEnabled) {
    if (flexible
      || features.storefront_qr_on || features.storefront_qr
      || features.storefront_qr_resolution
      || fallbackFeatures.storefront_opt_qr_on || fallbackFeatures.storefront_opt_qr || fallbackFeatures.storefront_opt_qr_enabled
      || fallbackFeatures.storefront_opt_qr_resolution
    ) {
      allowedQRResolutions.push('qr_codes_512', 'qr_codes_1024', 'qr_codes_2048');
    } else {
      if (features.storefront_qr_resolution_512 || fallbackFeatures.storefront_opt_qr_codes_512) allowedQRResolutions.push('qr_codes_512');
      if (features.storefront_qr_resolution_1024 || fallbackFeatures.storefront_opt_qr_codes_1024) allowedQRResolutions.push('qr_codes_1024');
      if (features.storefront_qr_resolution_2048 || fallbackFeatures.storefront_opt_qr_codes_2048) allowedQRResolutions.push('qr_codes_2048');
    }
  }

  // QR content types
  const allowedQRContentTypes: StorefrontOptQRContentType[] = [];
  if (qrGroupEnabled) {
    if (flexible
      || features.storefront_qr_on || features.storefront_qr
      || features.storefront_qr_content
      || fallbackFeatures.storefront_opt_qr_on || fallbackFeatures.storefront_opt_qr || fallbackFeatures.storefront_opt_qr_enabled
      || fallbackFeatures.storefront_opt_qr_content
    ) {
      allowedQRContentTypes.push('qr_product', 'qr_store', 'qr_logo', 'qr_directory');
    } else {
      if (features.storefront_qr_product || fallbackFeatures.storefront_opt_qr_product) allowedQRContentTypes.push('qr_product');
      if (features.storefront_qr_store || fallbackFeatures.storefront_opt_qr_store) allowedQRContentTypes.push('qr_store');
      if (features.storefront_qr_logo || fallbackFeatures.storefront_opt_qr_logo) allowedQRContentTypes.push('qr_logo');
      if (features.storefront_qr_directory || fallbackFeatures.storefront_opt_qr_directory) allowedQRContentTypes.push('qr_directory');
    }
  }

  // Styled QR — styled QR renderer, gated by storefront_qr_styled feature key
  const qrStyledOn = flexible
    || !!features.storefront_qr_styled
    || !!features.storefront_qr_styled_on
    || (!!features.storefront_qr_styled_enabled && !features.storefront_qr_styled_disabled)
    || !!fallbackFeatures.storefront_opt_qr_styled
    || !!fallbackFeatures.storefront_opt_qr_styled_on
    || (!!fallbackFeatures.storefront_opt_qr_styled_enabled && !fallbackFeatures.storefront_opt_qr_styled_disabled);
  const qrStyledOff = !!features.storefront_qr_styled_off || !!features.storefront_qr_styled_disabled
    || !!fallbackFeatures.storefront_opt_qr_styled_off || !!fallbackFeatures.storefront_opt_qr_styled_disabled;
  const showQRStyled = qrStyledOn && !qrStyledOff;

  const allowedQRDotStyles: StorefrontOptQRDotStyleType[] = [];
  if (showQRStyled && (flexible
    || features.storefront_qr_dot_styles || features.storefront_qr_dot_styles_on
    || fallbackFeatures.storefront_opt_qr_dot_styles || fallbackFeatures.storefront_opt_qr_dot_styles_on
  )) {
    allowedQRDotStyles.push('rounded', 'dots', 'classy', 'classy-rounded', 'extra-rounded');
  } else if (showQRStyled) {
    if (features.storefront_qr_dot_rounded || fallbackFeatures.storefront_opt_qr_dot_rounded) allowedQRDotStyles.push('rounded');
    if (features.storefront_qr_dot_dots || fallbackFeatures.storefront_opt_qr_dot_dots) allowedQRDotStyles.push('dots');
    if (features.storefront_qr_dot_classy || fallbackFeatures.storefront_opt_qr_dot_classy) allowedQRDotStyles.push('classy');
    if (features.storefront_qr_dot_classy_rounded || fallbackFeatures.storefront_opt_qr_dot_classy_rounded) allowedQRDotStyles.push('classy-rounded');
    if (features.storefront_qr_dot_extra_rounded || fallbackFeatures.storefront_opt_qr_dot_extra_rounded) allowedQRDotStyles.push('extra-rounded');
  }

  const allowedQRCornerStyles: StorefrontOptQRCornerStyleType[] = [];
  if (showQRStyled && (flexible
    || features.storefront_qr_corner_styles || features.storefront_qr_corner_styles_on
    || fallbackFeatures.storefront_opt_qr_corner_styles || fallbackFeatures.storefront_opt_qr_corner_styles_on
  )) {
    allowedQRCornerStyles.push('dot', 'extra-rounded', 'rounded');
  } else if (showQRStyled) {
    if (features.storefront_qr_corner_dot || fallbackFeatures.storefront_opt_qr_corner_dot) allowedQRCornerStyles.push('dot');
    if (features.storefront_qr_corner_extra_rounded || fallbackFeatures.storefront_opt_qr_corner_extra_rounded) allowedQRCornerStyles.push('extra-rounded');
    if (features.storefront_qr_corner_rounded || fallbackFeatures.storefront_opt_qr_corner_rounded) allowedQRCornerStyles.push('rounded');
  }

  const qrCustomColors = showQRStyled && (flexible
    || !!features.storefront_qr_custom_colors
    || !!fallbackFeatures.storefront_opt_qr_custom_colors);
  const qrGradients = showQRStyled && (flexible
    || !!features.storefront_qr_gradients
    || !!fallbackFeatures.storefront_opt_qr_gradients);

  // Merchant preferences
  const prefs = {
    qr_enabled: merchantPrefs?.qr_enabled !== false,
    qr_classic_enabled: merchantPrefs?.qr_classic_enabled !== false,
    qr_styled_enabled: merchantPrefs?.qr_styled_enabled !== false,
    qr_codes_512: merchantPrefs?.qr_codes_512 ?? false,
    qr_codes_1024: merchantPrefs?.qr_codes_1024 !== false,
    qr_codes_2048: merchantPrefs?.qr_codes_2048 ?? false,
    qr_product: merchantPrefs?.qr_product !== false,
    qr_store: merchantPrefs?.qr_store !== false,
    qr_logo: merchantPrefs?.qr_logo ?? false,
    qr_directory: merchantPrefs?.qr_directory ?? false,
    default_qr_resolution: merchantPrefs?.default_qr_resolution || '1024',
  };

  // Effective filters
  const effectiveQRResolutions = mainOn ? allowedQRResolutions.filter((t) => prefs[t] !== false) : [];
  const effectiveQRContentTypes = mainOn ? allowedQRContentTypes.filter((t) => prefs[t] !== false) : [];

  return {
    enabled: mainOn,
    is_flexible: flexible,
    qr_enabled: mainOn && (qrGroupEnabled || allowedQRResolutions.length > 0 || allowedQRContentTypes.length > 0),
    allowed_qr_resolutions: allowedQRResolutions,
    allowed_qr_content_types: allowedQRContentTypes,
    qr_classic_enabled: mainOn && prefs.qr_classic_enabled && (flexible
      || !!features.storefront_qr_classic || !!features.storefront_qr_classic_on
      || !!features.storefront_qr_on || !!features.storefront_qr
      || !!fallbackFeatures.storefront_opt_qr_on || !!fallbackFeatures.storefront_opt_qr
      || !!fallbackFeatures.storefront_opt_qr_enabled),
    qr_styled_enabled: mainOn && showQRStyled && prefs.qr_styled_enabled,
    allowed_qr_dot_styles: allowedQRDotStyles,
    allowed_qr_corner_styles: allowedQRCornerStyles,
    qr_custom_colors: mainOn && qrCustomColors && prefs.qr_styled_enabled,
    qr_gradients: mainOn && qrGradients && prefs.qr_styled_enabled,
    can_use_qr_codes: mainOn && (effectiveQRResolutions.length > 0 || effectiveQRContentTypes.length > 0),
    merchant_preferences: prefs,
  };
}
