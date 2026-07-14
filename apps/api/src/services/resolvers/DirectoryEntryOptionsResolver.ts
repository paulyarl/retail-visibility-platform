/**
 * Directory Entry Options Resolver
 *
 * Resolves effective directory entry layout state from tier features + merchant preferences.
 * Decoupled from storefront options — directory entry has its own capability flags.
 */

import type {
  EffectiveDirectoryEntryOptions,
} from './types';

export type DirectoryEntryLayoutType = 'classic' | 'editorial' | 'immersive' | 'premium';

export function resolveDirectoryEntryOptions(
  features: Record<string, boolean>,
  merchantPrefs: Record<string, any> | null
): EffectiveDirectoryEntryOptions {
  // Single-key pattern: present + true = enabled; missing/false = disabled
  const disabled = !!features.directory_entry_disabled;
  const flexible = !!features.directory_entry_flexible;

  // Check if any individual directory_entry feature is enabled (implicit enable)
  const hasAnyDirectoryEntryFeature = Object.keys(features).some(
    k => k.startsWith('directory_entry_') &&
    k !== 'directory_entry_enabled' &&
    k !== 'directory_entry_disabled' &&
    k !== 'directory_entry_flexible' &&
    features[k]
  );
  const enabled = !disabled && (!!features.directory_entry_enabled || hasAnyDirectoryEntryFeature);
  const mainOn = enabled;

  // Layout gates
  const layoutGroupOn = !!features.directory_entry_layout_on || !!features.directory_entry_layout_enabled;
  const allowedLayouts: DirectoryEntryLayoutType[] = [];
  if (flexible || layoutGroupOn) {
    allowedLayouts.push('classic', 'editorial', 'immersive', 'premium');
  } else {
    if (features.directory_entry_layout_classic) allowedLayouts.push('classic');
    if (features.directory_entry_layout_editorial) allowedLayouts.push('editorial');
    if (features.directory_entry_layout_immersive) allowedLayouts.push('immersive');
    if (features.directory_entry_layout_premium) allowedLayouts.push('premium');
  }

  const externalLinkTierAllowed = mainOn && (flexible || !!features.directory_entry_external_link);

  const prefs = {
    directory_entry_opt_enabled: merchantPrefs?.storefront_opt_enabled !== false,
    directory_entry_layout: merchantPrefs?.directory_entry_layout || 'classic',
    external_link_enabled: merchantPrefs?.external_link_enabled === true,
  };

  // Effective layout = tier allowed AND merchant choice
  const effectiveLayouts = mainOn ? allowedLayouts : [];
  const merchantLayoutChoice = merchantPrefs?.directory_entry_layout || 'classic';
  const effectiveLayout: DirectoryEntryLayoutType = effectiveLayouts.includes(merchantLayoutChoice as DirectoryEntryLayoutType)
    ? (merchantLayoutChoice as DirectoryEntryLayoutType)
    : (effectiveLayouts[0] || 'classic');

  // Section effective flags — tier feature OR flexible grants availability; merchant prefs gate display
  const hasGalleryPref = merchantPrefs && (
    merchantPrefs.image_gallery_5 || merchantPrefs.image_gallery_10 || merchantPrefs.image_gallery_15
  );
  const hasQrPref = merchantPrefs && (
    merchantPrefs.qr_product || merchantPrefs.qr_store || merchantPrefs.qr_logo || merchantPrefs.qr_directory
  );

  return {
    enabled: mainOn,
    is_flexible: flexible,
    layout_enabled: mainOn && (layoutGroupOn || allowedLayouts.length > 0),
    allowed_layouts: allowedLayouts,
    effective_layout: effectiveLayout,
    can_use_layout_classic: mainOn && allowedLayouts.includes('classic'),
    can_use_layout_editorial: mainOn && allowedLayouts.includes('editorial'),
    can_use_layout_immersive: mainOn && allowedLayouts.includes('immersive'),
    can_use_layout_premium: mainOn && allowedLayouts.includes('premium'),
    // Section effective flags — tier feature OR flexible; merchant pref gates (default true if tier allows)
    hours_enabled: mainOn && (flexible || !!features.directory_entry_hours_on || !!features.directory_entry_hours_enabled) && (merchantPrefs?.hours_display !== false),
    map_enabled: mainOn && (flexible || !!features.directory_entry_map_on || !!features.directory_entry_map_enabled) && (merchantPrefs?.map_display !== false),
    contact_enabled: mainOn && (flexible || !!features.directory_entry_contact_on || !!features.directory_entry_contact_enabled) && (merchantPrefs?.storefront_contact !== false),
    gallery_enabled: mainOn && (flexible || !!features.directory_entry_gallery_on || !!features.directory_entry_gallery_enabled) && (hasGalleryPref !== false),
    qr_enabled: mainOn && (flexible || !!features.directory_entry_qr_on || !!features.directory_entry_qr_enabled) && (hasQrPref !== false),
    social_enabled: mainOn && (flexible || !!features.directory_entry_social_on || !!features.directory_entry_social_enabled) && (merchantPrefs?.storefront_social_media !== false),
    seo_enabled: mainOn && (flexible || !!features.directory_entry_seo_on || !!features.directory_entry_seo_enabled) && (merchantPrefs?.enhanced_seo !== false),
    // Tier-gated availability flags (for UI disable states)
    can_show_hours: mainOn && (flexible || !!features.directory_entry_hours_on || !!features.directory_entry_hours_enabled),
    can_show_map: mainOn && (flexible || !!features.directory_entry_map_on || !!features.directory_entry_map_enabled),
    can_show_contact: mainOn && (flexible || !!features.directory_entry_contact_on || !!features.directory_entry_contact_enabled),
    can_show_gallery: mainOn && (flexible || !!features.directory_entry_gallery_on || !!features.directory_entry_gallery_enabled),
    can_show_qr: mainOn && (flexible || !!features.directory_entry_qr_on || !!features.directory_entry_qr_enabled),
    can_show_social: mainOn && (flexible || !!features.directory_entry_social_on || !!features.directory_entry_social_enabled),
    can_show_seo: mainOn && (flexible || !!features.directory_entry_seo_on || !!features.directory_entry_seo_enabled),
    // External link — tier feature OR flexible grants availability; merchant pref gates effective state
    can_show_external_link: externalLinkTierAllowed,
    external_link_enabled: externalLinkTierAllowed && (merchantPrefs?.external_link_enabled === true),
    merchant_preferences: prefs,
  };
}
