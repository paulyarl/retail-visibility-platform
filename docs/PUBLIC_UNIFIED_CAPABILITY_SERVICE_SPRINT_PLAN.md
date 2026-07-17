# Sprint Plan: PublicUnifiedCapabilityService

## Problem

`UnifiedCapabilityService` extends `TenantApiSingleton` and uses a **single-service dual-scope pattern** — every method accepts `options?: { isPublic?: boolean; ssrAuth?: SsrAuth }`. When `isPublic: true`, it manually calls `makePublicRequest` → `/api/public/tenants/:tenantId/effective-capabilities`. When falsy, it calls `makeDefaultRequest` with `RequestType.AUTHENTICATED` → `/api/tenants/:tenantId/effective-capabilities`.

This creates three issues:

1. **Every public caller must remember to pass `{ isPublic: true }`** on every call — easy to forget, no compiler enforcement.
2. **401-fallback hack** — `fetchEffective` has a code path (lines 1242-1257) that catches 401 errors from the authenticated endpoint and retries on the public endpoint. This only exists because someone forgot `isPublic: true`.
3. **`isPublic` flag is a hack** — the platform already has a clean two-service pattern (`PublicTenantInfoService` extends `PublicApiSingleton`, `TenantInfoService` extends `TenantApiSingleton`). The capability service should follow the same pattern.

## Solution

Create `PublicUnifiedCapabilityService` extending `PublicApiSingleton`. Since `FlexibleApiSingleton.makeDefaultRequest` routes based on `defaultRequestType` (which `PublicApiSingleton` sets to `RequestType.PUBLIC`), the new service just calls `makeDefaultRequest` — the base class automatically routes to `/api/public/...` with no auth cookies.

### Key insight

`FlexibleApiSingleton` is extremely flexible. All extending classes (`TenantApiSingleton`, `PublicApiSingleton`, etc.) can use `makeDefaultRequest` with no issues. The base class routes the request to the correct context based on `defaultRequestType`. So `PublicUnifiedCapabilityService` extending `PublicApiSingleton` uses `makeDefaultRequest` and it automatically hits public endpoints — no `makePublicRequest` needed.

### What gets eliminated

- The `isPublic` parameter from ~30 methods on `UnifiedCapabilityService`
- The `ssrAuth` parameter from public-path methods (only authenticated SSR needs it)
- The 401-fallback logic in `fetchEffective` (lines 1242-1257)
- The `-public` / `-auth` cache key suffix split — each service manages its own cache naturally
- Callers stop passing `{ isPublic: true }` — they just call `publicUnifiedCapabilityService.getAllCapabilities(tenantId)`

### What stays the same

- `UnifiedCapabilityService` keeps `ssrAuth` for authenticated SSR (server layout passing Auth0 session)
- All mapping functions (`mapCommerce`, `mapStorefront`, `mapStorefrontQr`, etc.) are shared — exported from `UnifiedCapabilityService.ts` and imported by the new service
- `AllCapabilitiesState` return type is identical
- `getStorefrontOptionFlags` overlay logic (QR/Gallery/Hours/Maps/Layouts) is duplicated in the public service since it's a pure function of the mapped state

## Implementation

### Sprint 1: Create PublicUnifiedCapabilityService + migrate callers

**Task 1.1** — Export mapping functions from `UnifiedCapabilityService.ts`:
- Export `mapAll`, `BackendEffectiveCapabilities`, `SsrAuth` type
- These are already module-scope pure functions, just add `export` keyword

**Task 1.2** — Create `apps/web/src/services/PublicUnifiedCapabilityService.ts`:
- Extends `PublicApiSingleton` (defaults: `RequestType.PUBLIC`, no auth cookies, 15-min TTL)
- Singleton pattern: `private static instance`, `private constructor`, `public static getInstance()`
- `fetchEffective(tenantId)` — calls `makeDefaultRequest('/api/public/tenants/:tenantId/effective-capabilities')`, uses `mapAll` to transform response
- `getAllCapabilities(tenantId)` — caches in `capCache` Map (same pattern as `UnifiedCapabilityService`)
- All public accessor methods: `getCommerceState`, `getPaymentGatewayState`, `getStorefrontState`, `getProductOptionsState`, `getProductOptionFlags`, `getFeaturedOptionsState`, `getStorefrontOptionFlags`, `getFaqOptionsState`, `getFaqOptionsFlags`, `getCrmOptionsState`, `getCrmOptionsFlags`, `getSocialCommerceOptionsState`, `getDirectoryEntryOptionsState`, `getStorefrontQrState`, `getStorefrontGalleryState`, `getStorefrontHoursState`, `getStorefrontLayoutsState`, `getStorefrontMapsState`, `getBarcodeScanState`, `getFulfillmentState`, `getProductTypeState`, `getIntegrationOptionsState`, `getQuickstartOptionsState`, `getChatbotOptionsState`, `getDirectoryPromotionState`, `getWholesaleMatchingState`, `getPlatformServicesState`, `getFunnelState`, `checkFeatureByCapability`
- `invalidateTenantCapabilities(tenantId)` — clears cache for tenant
- No `isPublic` parameter on any method — it's always public
- No `ssrAuth` parameter — public requests don't need auth headers

**Task 1.3** — Clean `UnifiedCapabilityService.ts`:
- Remove `isPublic` from `fetchEffective` — always use authenticated path
- Remove `isPublic` from all public accessor methods — keep only `ssrAuth` optional param
- Remove 401-fallback logic in `fetchEffective`
- Remove `-public` cache key suffix from `invalidateTenantCapabilities`
- Keep `-auth` cache key suffix

**Task 1.4** — Migrate public callers (files that pass `{ isPublic: true }`):

| File | Calls to migrate |
|---|---|
| `app/products/[id]/page.tsx` | 8 calls: `getStorefrontOptionFlags`, `getStorefrontState`, `getFeaturedOptionsState`, `getProductOptionFlags`, `getFaqOptionsFlags`, `getCrmOptionsFlags`, `getSocialCommerceOptionsState` |
| `app/tenant/[id]/page.tsx` | 8 calls: same pattern |
| `app/directory/[slug]/page.tsx` | 5 calls: `getStorefrontOptionFlags`, `getFeaturedOptionsState`, `getFaqOptionsFlags`, `getCrmOptionsFlags`, `getDirectoryEntryOptionsState` |
| `app/shops/[slug]/page.tsx` | 2 calls: `getStorefrontOptionFlags`, `getFaqOptionsFlags` |
| `app/carts/page.tsx` | 1 call: `getCommerceState` |
| `app/account/support/page.tsx` | 1 call: `getCrmOptionsFlags` |
| `hooks/usePublicFaqOptions.ts` | 1 call: `getFaqOptionsFlags` |
| `components/public/TenantQRCode.tsx` | 2 calls: `getStorefrontOptionFlags`, `getStorefrontQrState` (uses `isPublic` prop) |

**Task 1.5** — Update `TenantQRCode.tsx`:
- Replace `isPublic` prop with direct `publicUnifiedCapabilityService` usage
- When `isPublic` is true (default for public pages), use `publicUnifiedCapabilityService`
- When `isPublic` is false (tenant settings), use `unifiedCapabilityService`
- Or simpler: always use `publicUnifiedCapabilityService` since QR code rendering is always on public surfaces

**Task 1.6** — Update skill doc `deploy-service-extending-base-singleton.md`:
- Update rule 8 (dual-scope pattern) to reference `PublicUnifiedCapabilityService` as the two-service pattern example for capabilities
- Update quick reference table row for "Dual-scope"

## Files created

- `apps/web/src/services/PublicUnifiedCapabilityService.ts`

## Files modified

- `apps/web/src/services/UnifiedCapabilityService.ts` (export mappings, remove `isPublic`)
- `apps/web/src/app/products/[id]/page.tsx`
- `apps/web/src/app/tenant/[id]/page.tsx`
- `apps/web/src/app/directory/[slug]/page.tsx`
- `apps/web/src/app/shops/[slug]/page.tsx`
- `apps/web/src/app/carts/page.tsx`
- `apps/web/src/app/account/support/page.tsx`
- `apps/web/src/hooks/usePublicFaqOptions.ts`
- `apps/web/src/components/public/TenantQRCode.tsx`
- `.devin/skills/deploy-service-extending-base-singleton.md`

## Not in scope

- `useReviews.ts` / `StoreRatingDisplay.tsx` — these use `isPublic` for reviews service scope, not capability service
- `SyncStatusIndicator.tsx` — uses `isPublic` for item visibility, not capability service
- `useStoreStatus.ts` — uses `isPublic` for hours status service scope, not capability service
- `FulfillmentOptionsPane.tsx` — uses `isPublic` to skip client-side hook on public pages, not capability service
- `ProductSection.tsx`, `ReviewsSection.tsx`, `StorefrontFooter.tsx`, `TrustSignalsBar.tsx`, `StoreRatingsSection.tsx`, `StorefrontEditorialLayout.tsx`, `TierBasedLandingPage.tsx`, `ProductPurchasePanel.tsx` — these pass `isPublic` as a prop to child components (TenantQRCode, StoreRatingDisplay), not to capability service directly
- `app/products/[id]/layouts/types.ts` — `isPubliclyAccessible` is a different concept (item visibility)
