# Decoupled Domain Self-Containment

## Core Principle

When a capability domain is decoupled from `storefront_options` into its own namespace (e.g., `storefront_qr`, `storefront_hours`, `storefront_maps`, `storefront_gallery`, `storefront_layouts`), **all rendering decisions for that domain must come from the dedicated domain state** — not from the legacy `StorefrontOptionFlags` overlay.

A decoupled domain is **self-contained**. It decides:
- **where** (which surfaces to render on)
- **gate** (enabled / disabled)
- **what** (which variant to render)
- **how** (styling, options, configuration)
- **when** (fetches its own cached effective-capabilities state internally)

Callers don't pass domain-specific props. They import the component and use it.

## The Legacy Overlay Problem

`UnifiedCapabilityService.getStorefrontOptionFlags()` overlays dedicated domain values onto `StorefrontOptionFlags` for backward compatibility:

```
flags.showHoursDisplay = all.storefrontHours.canShowHoursDisplay;
flags.showMapDisplay = all.storefrontMaps.canShowMapDisplay;
flags.storefrontLayout = all.storefrontLayouts.effectiveLayout;
flags.showQRStyled = all.storefrontQr.qrStyledEnabled;  // BUG: tier-only, not merchant pref
```

This overlay is a **compatibility bridge**, not a permanent architecture. Components that read from `StorefrontOptionFlags` for decoupled domain decisions are depending on a pass-through that:

1. **Can diverge** — if a resolver separates tier from merchant (like QR did per R33), the overlay may copy the tier-only field, losing the merchant preference.
2. **Obscures the data source** — the component doesn't know which namespace it's reading from.
3. **Prevents self-containment** — callers must fetch and pass `storefrontOptionFlags`, creating coupling.

## The QR Bug (Real-World Example)

**Bug**: `TenantQRCode` checked `qrState.qrStyledEnabled` (tier-level: "does the tier allow styled?") instead of `qrState.merchantPreferences.qr_styled_enabled` (merchant choice: "did the merchant select styled?"). The QR rendered as styled even when the merchant selected classic.

**Root cause**: After R33 separated tier-level fields from merchant preferences in `StorefrontQrResolver`, the overlay in `getStorefrontOptionFlags` copied `qrStyledEnabled` (tier-only) into `flags.showQRStyled`. `TenantQRCode` read `resolvedFlags.showQRStyled` and got the tier-level answer, not the merchant's choice.

**Fix**: `TenantQRCode` now reads all QR decisions from `qrState` (the `storefront_qr` namespace) directly. The `capabilityFlags` prop is accepted but ignored for QR decisions. `StyledTenantQR` accepts `qrState` instead of `capabilityFlags`.

## Deviation Audit: Current State of Each Domain

### QR (storefront_qr) — FIXED
- **Resolver**: `StorefrontQrResolver.ts` — tier-level fields (`qrStyledEnabled`, `qrClassicEnabled`) are tier-only per R33. Merchant prefs in `merchant_preferences`.
- **Frontend state**: `StorefrontQrState` with `merchantPreferences` record.
- **Component**: `TenantQRCode.tsx` — self-contained, fetches `qrState` internally. All 5 dimensions from `qrState`.
- **Status**: ✅ Self-contained.

### Hours (storefront_hours) — STRUCTURAL DEVIATION
- **Resolver**: `StorefrontHoursResolver.ts` — `can_show_hours_display = mainOn && hoursDisplayTierAllowed && prefs.hours_display` (merges tier+merchant).
- **Frontend state**: `StorefrontHoursState` exists but unused by components.
- **Component**: `StorefrontClientWrapper.tsx` and `useStorefrontState.ts` read `optFlags?.showHoursDisplay` from `StorefrontOptionFlags` overlay.
- **Deviation**: Works today because the overlay preserves the merged value. But if the resolver is ever refactored to separate tier from merchant (like QR was), the overlay will copy the tier-only field and the merchant pref will be lost.
- **Fix path**: Components should fetch `StorefrontHoursState` and read `canShowHoursDisplay` / `merchantPreferences.hours_display` directly.

### Maps (storefront_maps) — STRUCTURAL DEVIATION
- **Resolver**: `StorefrontMapsResolver.ts` — `can_show_map_display = mainOn && mapDisplayTierAllowed && prefs.map_display` (merges tier+merchant).
- **Frontend state**: `StorefrontMapsState` exists but unused by components.
- **Component**: `StorefrontClientWrapper.tsx` and `useStorefrontState.ts` read `optFlags?.showMapDisplay` / `optFlags?.showInteractiveMaps` from overlay.
- **Deviation**: Same as Hours. Works today, breaks if resolver is refactored.
- **Fix path**: Components should fetch `StorefrontMapsState` and read `canShowMapDisplay` / `canUseInteractiveMaps` / `merchantPreferences` directly.

### Gallery (storefront_gallery) — STRUCTURAL DEVIATION
- **Resolver**: `StorefrontGalleryResolver.ts` — `can_use_magazine_gallery = mainOn && galleryMagazineEnabled && effectiveDisplayMode === 'magazine'` (merges tier+merchant).
- **Frontend state**: `StorefrontGalleryState` exists but unused by components.
- **Component**: `useStorefrontState.ts` reads `optFlags?.canUseMagazineGallery` / `optFlags?.galleryDisplayMode` from overlay. `showsGallery` is hardcoded `true`.
- **Deviation**: Same pattern. The gallery limit and display mode come through the overlay instead of from `StorefrontGalleryState`.
- **Fix path**: Components should fetch `StorefrontGalleryState` and read `canUseGallery` / `canUseMagazineGallery` / `galleryDisplayMode` / `defaultGalleryLimit` directly.

### Layout (storefront_layouts) — STRUCTURAL DEVIATION
- **Resolver**: `StorefrontLayoutResolver.ts` — `effective_layout` = merchant's choice if allowed by tier (merges tier+merchant).
- **Frontend state**: `StorefrontLayoutState` exists but unused by components.
- **Component**: `useStorefrontState.ts` reads `optFlags?.storefrontLayout` from overlay. The layout selection logic is in `page.tsx` / `StorefrontClientWrapper.tsx`.
- **Deviation**: Same pattern. The effective layout comes through the overlay.
- **Fix path**: Components should fetch `StorefrontLayoutState` and read `effectiveLayout` / `allowedLayouts` / `merchantPreferences.storefront_layout` directly.

## Self-Containment Checklist

When auditing or building a decoupled domain component, verify:

1. **No `StorefrontOptionFlags` reads for domain decisions** — the component must not read `optFlags?.showXxx` for any field that belongs to the decoupled domain.
2. **Dedicated state fetched internally** — the component fetches its own domain state (e.g., `unifiedCapabilityService.getStorefrontQrState(tenantId)`) and caches it.
3. **Merchant preferences read from `merchantPreferences`** — not from tier-level fields. See R33.
4. **Tier-level fields used only for gating** — `qrStyledEnabled` (tier) gates whether the styled option is available; `merchantPreferences.qr_styled_enabled` (merchant) determines whether to render styled.
5. **Props are minimal** — callers pass `tenantId`, `url`, `pageType`, etc. They do NOT pass `capabilityFlags` or `optFlags` for domain-specific decisions.
6. **Tier fallback for backward compat** — when domain state is null (e.g., older cached endpoint), fall back to tier-based logic, not to `StorefrontOptionFlags`.

## Migration Pattern (from overlay-dependent to self-contained)

```
Before (overlay-dependent):
  const showsHours = optFlags?.showHoursDisplay ?? true;

After (self-contained):
  const [hoursState, setHoursState] = useState<StorefrontHoursState | null>(null);
  useEffect(() => {
    unifiedCapabilityService.getStorefrontHoursState(tenantId)
      .then(setHoursState).catch(() => {});
  }, [tenantId]);
  const showsHours = hoursState?.canShowHoursDisplay ?? true;
```

## Related Rules

- **R33** (capability-data-flow-rules.md): Merchant preferences must never gate tier-level fields in resolver output. Tier-level fields derive from features + fallbackFeatures only.
- **This skill**: Components must read from dedicated domain state, not the legacy `StorefrontOptionFlags` overlay. The overlay is a compatibility bridge, not the source of truth.

## Audit Command

To find deviation bugs in a decoupled domain:

```bash
# Find all files that read StorefrontOptionFlags for domain-specific fields
grep -rn "optFlags\?\.\(showHours\|showMap\|showInteractiveMaps\|showQR\|qrResolution\|qrDot\|qrCorner\|qrBg\|qrGradient\|galleryLimit\|galleryDisplayMode\|canUseMagazineGallery\|storefrontLayout\)" apps/web/src/

# Find all files that import StorefrontOptionFlags
grep -rn "StorefrontOptionFlags" apps/web/src/ --include="*.tsx" --include="*.ts"
```

Each hit is a candidate for migration to dedicated domain state.
