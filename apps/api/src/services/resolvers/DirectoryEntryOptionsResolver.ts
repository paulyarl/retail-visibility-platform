/**
 * Directory Entry Options Resolver
 *
 * Resolves effective directory entry layout state from tier features + merchant preferences.
 * Decoupled from storefront options — directory entry has its own capability flags.
 */

import type {
  EffectiveDirectoryEntryOptions,
  StorefrontOptionsMerchantSettings,
} from './types';

export type DirectoryEntryLayoutType = 'classic' | 'editorial' | 'immersive' | 'premium';

export function resolveDirectoryEntryOptions(
  features: Record<string, boolean>,
  merchantPrefs: StorefrontOptionsMerchantSettings | null
): EffectiveDirectoryEntryOptions {
  // Single-key pattern: present + true = enabled; missing/false = disabled
  const enabled = !!features.directory_entry_enabled;
  const flexible = !!features.directory_entry_flexible;
  const mainOn = enabled;

  // Layout gates
  const layoutGroupEnabled = !!features.directory_entry_layout_enabled;
  const allowedLayouts: DirectoryEntryLayoutType[] = [];
  if (flexible || layoutGroupEnabled) {
    allowedLayouts.push('classic', 'editorial', 'immersive', 'premium');
  } else {
    if (features.directory_entry_layout_classic) allowedLayouts.push('classic');
    if (features.directory_entry_layout_editorial) allowedLayouts.push('editorial');
    if (features.directory_entry_layout_immersive) allowedLayouts.push('immersive');
    if (features.directory_entry_layout_premium) allowedLayouts.push('premium');
  }

  // Fail-open: when no directory entry config exists at all, allow classic
  const hasAnyDirectoryEntryConfig = Object.keys(features).some(k => k.startsWith('directory_entry_'));
  if (!hasAnyDirectoryEntryConfig && allowedLayouts.length === 0) {
    allowedLayouts.push('classic');
  }

  const prefs = {
    directory_entry_opt_enabled: merchantPrefs?.storefront_opt_enabled !== false,
    directory_entry_layout: merchantPrefs?.directory_entry_layout || 'classic',
  };

  // Effective layout = tier allowed AND merchant choice
  const effectiveLayouts = mainOn ? allowedLayouts : [];
  const merchantLayoutChoice = merchantPrefs?.directory_entry_layout || 'classic';
  const effectiveLayout: DirectoryEntryLayoutType = effectiveLayouts.includes(merchantLayoutChoice as DirectoryEntryLayoutType)
    ? (merchantLayoutChoice as DirectoryEntryLayoutType)
    : (effectiveLayouts[0] || 'classic');

  return {
    enabled: mainOn,
    is_flexible: flexible,
    layout_enabled: mainOn && (layoutGroupEnabled || allowedLayouts.length > 0),
    allowed_layouts: allowedLayouts,
    effective_layout: effectiveLayout,
    can_use_layout_classic: mainOn && allowedLayouts.includes('classic'),
    can_use_layout_editorial: mainOn && allowedLayouts.includes('editorial'),
    can_use_layout_immersive: mainOn && allowedLayouts.includes('immersive'),
    can_use_layout_premium: mainOn && allowedLayouts.includes('premium'),
    // Section effective flags — flexible grants all sections automatically
    hours_enabled: mainOn && (flexible || !!features.directory_entry_hours_enabled),
    map_enabled: mainOn && (flexible || !!features.directory_entry_map_enabled),
    contact_enabled: mainOn && (flexible || !!features.directory_entry_contact_enabled),
    gallery_enabled: mainOn && (flexible || !!features.directory_entry_gallery_enabled),
    qr_enabled: mainOn && (flexible || !!features.directory_entry_qr_enabled),
    social_enabled: mainOn && (flexible || !!features.directory_entry_social_enabled),
    seo_enabled: mainOn && (flexible || !!features.directory_entry_seo_enabled),
    merchant_preferences: prefs,
  };
}
