/**
 * Flyer Resolver
 *
 * Resolves effective flyer state from tier features + merchant preferences.
 * Reference: StorefrontGalleryResolver (group gates, limit resolution, R33 split).
 *
 * Spec: docs/LocalBiz/FLYER_SURFACE_SPEC.md §2.
 *
 * Key notes:
 * - `flyer_disabled` vetoes the module absolutely. Any other active `flyer_*`
 *   key implicitly activates the module (capability contract) — `flyer_enabled`,
 *   `flyer_on`, `flyer_flexible` are the explicit activation forms.
 * - `flyer_gbp_publish` lives in the SEPARATE `flyer_gbp` capability type — it is
 *   deliberately not covered by `flyer_flexible` (channel action; the MV's
 *   flexible expansion emits every active key linked to a type, so the exclusion
 *   is enforced by keeping the key out of the 'flyer' type entirely). The caller
 *   passes the `flyer_gbp` group's features as `gbpFeatures`.
 * - Tier-level fields (storefront_on, items_limit, frozen, gbp_publish…) never
 *   read merchant prefs (R33); `can_use_*` fields are tier AND merchant.
 * - Every feature check carries the `flexible ||` prefix (R23).
 */

import type { EffectiveFlyer, FlyerMerchantSettings } from './types';

export function resolveFlyer(
  features: Record<string, boolean>,
  gbpFeatures: Record<string, boolean>,
  merchantPrefs: FlyerMerchantSettings | null,
): EffectiveFlyer {
  const disabled = !!features.flyer_disabled;
  const flexible = !!features.flyer_flexible;

  const mainOn = !disabled && Object.entries(features).some(
    ([k, v]) => v && k.startsWith('flyer_') && k !== 'flyer_disabled',
  );

  // Surface gates (tier-level)
  const storefrontOn = mainOn && (flexible || !!features.flyer_storefront_on);
  const directoryOn = mainOn && (flexible || !!features.flyer_directory_on);
  const placeOn = mainOn && (flexible || !!features.flyer_place_on);
  const image = mainOn && (flexible || !!features.flyer_image);

  // Item-count limit — highest granted wins; flexible short-circuits to 20
  const itemsLimit = !mainOn ? 0
    : flexible || features.flyer_items_20 ? 20
    : features.flyer_items_10 ? 10
    : features.flyer_items_5 ? 5
    : 0;

  const frozen = mainOn && (flexible || !!features.flyer_frozen);
  const recurring = mainOn && (flexible || !!features.flyer_recurring);
  // Channel action — explicit key in the 'flyer_gbp' capability type only
  const gbpPublish = !!gbpFeatures.flyer_gbp_publish;

  // Merchant soft gates (defaults: on)
  const prefs = {
    flyer_display: merchantPrefs?.flyer_display !== false,
    flyer_storefront_display: merchantPrefs?.flyer_storefront_display !== false,
    flyer_directory_display: merchantPrefs?.flyer_directory_display !== false,
    flyer_place_display: merchantPrefs?.flyer_place_display !== false,
    flyer_frozen_display: merchantPrefs?.flyer_frozen_display !== false,
    default_title: merchantPrefs?.default_title || 'Featured Specials',
  };

  return {
    enabled: mainOn,
    is_flexible: flexible,
    storefront_on: storefrontOn,
    directory_on: directoryOn,
    place_on: placeOn,
    image,
    items_limit: itemsLimit,
    frozen,
    gbp_publish: gbpPublish,
    recurring,
    can_use_storefront: storefrontOn && prefs.flyer_display && prefs.flyer_storefront_display,
    can_use_directory: directoryOn && prefs.flyer_display && prefs.flyer_directory_display,
    can_use_place: placeOn && prefs.flyer_display && prefs.flyer_place_display,
    can_use_frozen_panel: frozen && prefs.flyer_display && prefs.flyer_frozen_display,
    can_use_gbp_publish: mainOn && gbpPublish,
    can_use_recurring: recurring,
    merchant_preferences: prefs,
    features,
  };
}
