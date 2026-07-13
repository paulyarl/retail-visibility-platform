# Storefront Store Gallery — Functional Spec & Sprint Plan

## 1. Executive Summary

Merchants can already upload **store/business photos** through the directory admin and those photos render on **directory entry pages** (`/directory/[slug]`) and **shop profiles** (`/shops/[slug]`). However, the **storefront landing page** (`/tenant/[id]`) has no equivalent store-level photo gallery surface. The `showsGallery` flag in storefront layouts controls **product-card gallery thumbnails** inside product grids, not a store photo gallery.

This sprint introduces a **Storefront Store Gallery** — a public surface on the merchant storefront that renders the same store photos used by directory listings. It also centralizes photo management into a single **Store Gallery** settings page, decoupling gallery management from the directory options page so the same photo set feeds both directory and storefront surfaces.

The feature is gated behind a new `storefront_opt_store_gallery` feature key, supports the existing carousel and magazine display modes, and reuses the existing `directory_photos` table (no new data pipeline required).

> **Namespace Split Alignment**: Per `STOREFRONT_OPTIONS_NAMESPACE_SPLIT_PLAN.md` §4.3, all gallery features will eventually migrate from `storefront_options` to a dedicated `storefront_gallery` capability type. The `storefront_opt_store_gallery` key introduced here is temporary and will be renamed during that later phase.

---

## 2. Current State Analysis

### 2.1 Storefront Landing Page — No Store Photo Gallery

The storefront (`/tenant/[id]`) has three layouts:

| Layout | File | Current Gallery Behavior |
|--------|------|--------------------------|
| **Classic** | `apps/web/src/app/tenant/[id]/page.tsx` (fallback) | No store gallery surface |
| **Editorial** | `apps/web/src/app/tenant/[id]/StorefrontEditorialLayout.tsx` | No store gallery surface |
| **Immersive** | `apps/web/src/app/tenant/[id]/StorefrontImmersiveLayout.tsx` | No store gallery surface |

The `showsGallery` flag in `useStorefrontState` (`apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts:194`) is passed to `EnhancedProductDisplay` and `SmartProductCard` to toggle **product-card thumbnail galleries** inside the product grid. It does not represent a standalone store photo gallery.

### 2.2 Directory & Shop Profile — Store Photos Already Exist

Store photos are already rendered on four directory layouts and the shop profile page:

| Surface | Rendering Path | Gallery Component |
|---------|---------------|-------------------|
| Directory Classic | `DirectoryEntryClassicLayout.tsx` | `DirectoryPhotoGalleryDisplay.tsx` |
| Directory Editorial | `DirectoryEntryEditorialLayout.tsx` | `DirectoryPhotoGalleryDisplay.tsx` |
| Directory Immersive | `DirectoryEntryImmersiveLayout.tsx` | `DirectoryPhotoGalleryDisplay.tsx` |
| Directory Premium | `DirectoryEntryPremiumLayout.tsx` | `DirectoryPhotoGalleryDisplay.tsx` |
| Shop Profile | `shops/[slug]/ShopProfileClient.tsx` | `DirectoryPhotoGalleryDisplay.tsx` |

A magazine/mosaic variant also exists:

| Surface | Conditional Component |
|---------|------------------------|
| Directory (all layouts) + Shop Profile | `DirectoryMagazineGallery.tsx` when `galleryDisplayMode === 'magazine'` and `canUseMagazineGallery` is enabled |

### 2.3 Data Layer — `directory_photos`

Store photos live in the existing `directory_photos` table (`apps/api/prisma/schema.prisma:1359-1382`):

- `id` (UUID)
- `tenant_id` (VARCHAR 255) — tenant scoping
- `listing_id` (VARCHAR 255) — FK to `directory_listings_list`
- `url`, `position`, `alt`, `caption`
- Relations: `directory_listings_list`, `tenants`
- Unique on `(listing_id, position)`
- Indexes on `listing_id` and `tenant_id`

The frontend fetches photos today via `directoryListingService.getDirectoryListingPhotos(listingId)` (`DirectoryListingSingletonService.ts:98` and `TenantDirectoryManagementService.ts:203`). Because the table has a `tenant_id`, a tenant-scoped fetch is possible without requiring a directory listing ID.

### 2.4 Management Surface — Directory Settings Panel

Photo upload and management is currently embedded inside `DirectorySettingsPanel.tsx` (`apps/web/src/components/directory/DirectorySettingsPanel.tsx:8`) via `DirectoryPhotoGallery.tsx`. This couples store photo management to the directory entry options page. Merchants must navigate to directory settings to manage photos that should also be usable on the storefront.

### 2.5 Capability / Resolver Pipeline

Storefront gallery will be a feature within the existing `storefront_options` capability type (temporary home until namespace split). The resolver pipeline already supports gallery display mode through `gallery_display_mode` and `canUseMagazineGallery` after the Magazine Gallery sprint.

| Layer | File | Role |
|-------|------|------|
| Backend resolver | `apps/api/src/services/resolvers/StorefrontOptionsResolver.ts` | Resolves gallery features from tier features |
| Backend service | `apps/api/src/services/StorefrontOptionsService.ts` | Fetches tier features, calls resolver |
| Backend types | `apps/api/src/services/resolvers/types.ts` | `StorefrontOptionsMerchantSettings`, `EffectiveStorefrontOptions` |
| Frontend resolver | `apps/web/src/services/CapabilityResolutionService.ts` | `StorefrontOptionsState` with gallery flags |
| Frontend types | `apps/web/src/utils/storefrontOptions.ts` | `GALLERY_TYPES`, `STOREFRONT_OPT_TYPE_META` |
| Frontend hook | `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | `useStorefrontOptionsCapability` |
| Frontend service | `apps/web/src/services/TenantInfoService.ts` | `getStorefrontOptionsSettings`, `updateStorefrontOptionsSettings` |

---

## 3. Proposed Architecture

### 3.1 New Feature Key

| Key | Name | Description |
|-----|------|-------------|
| `storefront_opt_store_gallery` | Storefront Store Gallery | Render a store-level photo gallery on the merchant storefront landing page |

This feature key is registered in `features_list`, linked to the `storefront_options` capability type via `capability_features_list`, and seeded into `tier_features_list` for appropriate tiers.

### 3.2 New Merchant Preferences

Two settings control the storefront store gallery:

```typescript
storefront_store_gallery_enabled: boolean   // default: false
storefront_store_gallery_mode: 'carousel' | 'magazine'  // default: 'carousel'
```

- `storefront_store_gallery_enabled` — whether the gallery section is visible on the storefront at all.
- `storefront_store_gallery_mode` — which display component to use (carousel vs. magazine mosaic).

These are stored in `tenant_storefront_options_settings` alongside existing gallery preferences (`gallery_display_mode` controls product/directory galleries; this is a separate storefront-only toggle).

### 3.3 Centralized Management Page

A new settings page is created at `/t/[tenantId]/settings/store-gallery`:

- Upload, reorder, set primary, edit alt/caption, delete store photos.
- Reuses `DirectoryPhotoGallery.tsx` management UI or a new `StoreGalleryManager.tsx` wrapper.
- Toggle for enabling the storefront gallery.
- Radio for carousel vs. magazine display mode.
- Live preview of how the gallery will appear on the storefront.
- Saves to `directory_photos` table (tenant-scoped) so the same photos feed directory and storefront.

The existing `DirectorySettingsPanel.tsx` loses the inline photo management card; instead it shows a read-only preview + a link to the central Store Gallery page. The directory entry page continues to render photos from the same pool.

### 3.4 New Display Components

#### `StorefrontStoreGallery.tsx`

A client component that renders store photos on the storefront landing page.

- **Data fetching**: self-contained — fetches photos by `tenantId` via a new tenant-scoped API endpoint or service method.
- **Display modes**:
  - `carousel`: uses `DirectoryPhotoGalleryDisplay.tsx` rendering pattern adapted for storefront styling.
  - `magazine`: uses `DirectoryMagazineGallery.tsx` rendering pattern adapted for storefront styling.
- **Props**: `tenantId: string`, `listing?: DirectoryListing`, `isPublished: boolean`, `displayMode: 'carousel' | 'magazine'`.
- **Empty state**: shows nothing (or a merchant-only placeholder) when no photos exist.
- **Lazy loading**: below-fold photos use `loading="lazy"`.
- **Dark mode support**.
- **Primary badge**: position-0 photo marked as primary.
- **Click-to-zoom**: opens full-size image in modal or new tab (reuse existing zoom overlay).

#### `StoreGalleryManager.tsx` (admin/management)

A client component for the new `/t/[tenantId]/settings/store-gallery` page.

- Reuses `DirectoryPhotoGallery.tsx` for upload/reorder/delete.
- Adds enablement toggle and display mode radio.
- Shows live preview of `StorefrontStoreGallery.tsx`.
- Persists `storefront_store_gallery_enabled` and `storefront_store_gallery_mode` via `tenantInfoService.updateStorefrontOptionsSettings()`.

### 3.5 Rendering Integration — Storefront Landing Page

Add a conditional gallery section to all three storefront layouts. The section should appear **above the product collection** or **within the hero/about area**, depending on layout:

| Layout | Placement | Component |
|--------|-----------|-----------|
| Classic | Below hero/banner or above product grid | `StorefrontStoreGallery` |
| Editorial | Below hero banner or in a new visual section | `StorefrontStoreGallery` |
| Immersive | Below hero strip or in a dedicated gallery section | `StorefrontStoreGallery` |

Conditional rendering:

```tsx
{showStoreGallery && (
  <section className="..." aria-label="Store gallery">
    <StorefrontStoreGallery
      tenantId={tenantId}
      displayMode={storeGalleryMode}
      isPublished={directoryPublished}
    />
  </section>
)}
```

### 3.6 Rendering Integration — Directory & Shop Profile (unchanged data source)

Directory and shop profile surfaces continue to render photos from `directory_photos`. They do not need a new data source. Optionally, they can also respect the new central `gallery_display_mode` preference if not already doing so.

### 3.7 Capability Resolution

Backend and frontend updates:

1. **`StorefrontOptionsResolver.ts`** — add `store_gallery_enabled` and `can_use_store_gallery` to `EffectiveStorefrontOptions`.
2. **`StorefrontOptionsService.ts`** — pass `storefront_opt_store_gallery` through `resolveFromFeatures`.
3. **`types.ts`** — add `store_gallery_enabled: boolean`, `can_use_store_gallery: boolean` to `EffectiveStorefrontOptions`; add `storefront_store_gallery_enabled?: boolean` and `storefront_store_gallery_mode?: string` to `StorefrontOptionsMerchantSettings`.
4. **`storefront-options-settings.ts` route** — accept new fields in PUT body, persist to `tenant_storefront_options_settings`.
5. **`CapabilityResolutionService.ts`** — add `storeGalleryEnabled`, `canUseStoreGallery`, `storeGalleryMode` to `StorefrontOptionsState` and `StorefrontOptionFlags`.
6. **`storefrontOptions.ts`** — add `store_gallery` metadata entry to `STOREFRONT_OPT_TYPE_META`.
7. **`TenantInfoService.ts`** — add new fields to `getStorefrontOptionsSettings` return type.
8. **`useCapabilityAccess.ts`** — expose `canUseStoreGallery` and `storeGalleryMode` from `useStorefrontOptionsCapability`.

### 3.8 BSaaS Catalog & Monetization

| Field | Value |
|-------|-------|
| Feature key | `storefront_opt_store_gallery` |
| Marketing name | Storefront Store Gallery |
| Price | $9/month |
| Trial | 7 days |
| Billing cycle | monthly |

Tier allocation:

- Trial: not available
- Starter: not available (purchase à la carte)
- Growth: included
- Scale: included
- Enterprise: included

Active Capability Engagement rule is satisfied because `storefront_options` already grants features (e.g., `image_gallery_5`) at the Starter tier.

---

## 4. Sprint Plan

### Sprint 1: Backend — Feature Registration, Tenant-Scoped Photo Fetch, and Settings Storage (3-4 days)

**Goal**: Register the feature key, add a tenant-scoped photo fetch endpoint, persist new merchant settings, and wire the resolver pipeline.

**Tasks**:

1. **Migration**: `database/migrations/0XX_storefront_store_gallery.sql`
   - Insert `storefront_opt_store_gallery` into `features_list`.
   - Link to `storefront_options` capability type in `capability_features_list`.
   - Seed into `tier_features_list` for growth/scale/enterprise tiers.
   - Add `storefront_store_gallery_enabled` and `storefront_store_gallery_mode` columns to `tenant_storefront_options_settings` (or use JSONB if schema uses JSONB for settings).
   - Insert BSaaS catalog entry ($9/mo, 7-day trial).
   - Add an index on `directory_photos.tenant_id` if not already present (already exists per schema).

2. **Backend types** (`apps/api/src/services/resolvers/types.ts`):
   - Add `storefront_store_gallery_enabled?: boolean` and `storefront_store_gallery_mode?: string` to `StorefrontOptionsMerchantSettings`.
   - Add `store_gallery_enabled: boolean` and `can_use_store_gallery: boolean` to `EffectiveStorefrontOptions`.

3. **Backend resolver** (`apps/api/src/services/resolvers/StorefrontOptionsResolver.ts`):
   - Check `features.storefront_opt_store_gallery` or flexible key.
   - Set `store_gallery_enabled` and `can_use_store_gallery`.
   - `can_use_store_gallery` = tier-allowed AND merchant has enabled it.

4. **Backend service** (`apps/api/src/services/StorefrontOptionsService.ts`):
   - Pass new feature through `resolveFromFeatures`.
   - Read/write new merchant settings fields.

5. **Backend route** (`apps/api/src/routes/storefront-options-settings.ts`):
   - Accept `storefront_store_gallery_enabled` and `storefront_store_gallery_mode` in PUT body.
   - Include new fields in GET response.
   - Tier-gate enforcement on PUT (403 if tier doesn't include store gallery).

6. **Tenant-scoped photo endpoint**:
   - Add `GET /api/tenants/:tenantId/store-gallery/photos` (or extend directory listing service) that returns `directory_photos` filtered by `tenant_id`, sorted by `position`.
   - Ensure RLS policy allows public read when storefront is enabled.

7. **Prisma schema update**:
   - Add new fields to `tenant_storefront_options_settings` model.
   - Run `prisma db pull` + `prisma generate`.

**Deliverables**:
- Migration SQL file
- Updated resolver types and logic
- Updated storefront-options route
- New tenant-scoped photo API

**Verification**: `pnpm checkapi` — zero TS errors. Manual API test: GET/PUT storefront-options returns new fields; GET store-gallery photos returns tenant photos.

---

### Sprint 2: Frontend — Management Page, Display Component, and Settings UI (5-6 days)

**Goal**: Build the central Store Gallery management page, the storefront display component, and update capability resolution.

**Tasks**:

1. **Create `StorefrontStoreGallery.tsx`** (`apps/web/src/components/storefront/StorefrontStoreGallery.tsx`):
   - Self-contained data fetch by `tenantId` via new service method.
   - Render carousel mode using `DirectoryPhotoGalleryDisplay.tsx` styling/pattern.
   - Render magazine mode using `DirectoryMagazineGallery.tsx` styling/pattern.
   - Empty state returns `null` on public pages.
   - Dark mode, lazy loading, primary badge, click-to-zoom.

2. **Create `StoreGalleryManager.tsx`** (`apps/web/src/components/storefront/StoreGalleryManager.tsx`):
   - Reuses `DirectoryPhotoGallery.tsx` for CRUD operations.
   - Enablement toggle.
   - Display mode radio (carousel / magazine).
   - Live preview of `StorefrontStoreGallery.tsx`.
   - Save settings via `tenantInfoService.updateStorefrontOptionsSettings()`.
   - Save photos via `tenantDirectoryManagementService` (existing) or a new tenant-scoped service method.

3. **Create settings page** (`apps/web/src/app/t/[tenantId]/settings/store-gallery/page.tsx`):
   - Server component with tenant ID param.
   - Renders `StoreGalleryManager.tsx` client component.
   - Title: "Store Gallery".
   - Access control: tenant admin or org admin.

4. **Update `CapabilityResolutionService.ts`**:
   - Add `storeGalleryEnabled`, `canUseStoreGallery`, `storeGalleryMode` to `StorefrontOptionsState`.
   - Add fields to `StorefrontOptionFlags` interface and `toStorefrontOptionFlags()` converter.
   - Update `resolveStorefrontOptionsState`.

5. **Update `storefrontOptions.ts`**:
   - Add `store_gallery` metadata entry to `STOREFRONT_OPT_TYPE_META`.

6. **Update `TenantInfoService.ts`**:
   - Add `storefront_store_gallery_enabled` and `storefront_store_gallery_mode` to `getStorefrontOptionsSettings` return type.

7. **Update `useCapabilityAccess.ts`**:
   - Expose `canUseStoreGallery` and `storeGalleryMode` from `useStorefrontOptionsCapability`.

8. **Update `DirectorySettingsPanel.tsx`**:
   - Remove inline photo management.
   - Add a "Store Gallery" card with read-only preview and a link to `/t/[tenantId]/settings/store-gallery`.
   - Keep the existing gallery display mode radio if already present (or move it to the new Store Gallery page).

9. **Navigation links**:
   - Add "Store Gallery" link to tenant settings sidebar under Storefront or Store section.
   - Add a settings card in `TenantSettings.tsx` for Store Gallery under the appropriate group.

**Deliverables**:
- `StorefrontStoreGallery.tsx`
- `StoreGalleryManager.tsx`
- `/t/[tenantId]/settings/store-gallery/page.tsx`
- Updated capability resolution and types
- Updated `DirectorySettingsPanel.tsx` preview/link
- New sidebar/settings card entries

**Verification**: `pnpm checkweb` — zero TS errors. Settings page renders, upload/reorder works, preview updates live.

---

### Sprint 3: Integration — Storefront Layouts, Directory Surfaces, and Feature Store (4-5 days)

**Goal**: Wire the gallery into all three storefront layouts, verify directory/shop profile surfaces still consume the same data, and surface the feature in the Feature Store.

**Tasks**:

#### Storefront Layouts

1. **Update `useStorefrontState`** (`apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts`):
   - Derive `showStoreGallery` and `storeGalleryMode` from `optFlags`.
   - Return them from the hook.

2. **Update Classic storefront layout** (`apps/web/src/app/tenant/[id]/page.tsx`):
   - Add `StorefrontStoreGallery` section above the product collection or below the hero banner.
   - Conditional on `showStoreGallery && directoryPublished`.

3. **Update Editorial layout** (`apps/web/src/app/tenant/[id]/StorefrontEditorialLayout.tsx`):
   - Add gallery section in a prominent visual area (e.g., below hero banner or as a dedicated "Store Gallery" section).
   - Use existing section spacing and `max-w-7xl` container.

4. **Update Immersive layout** (`apps/web/src/app/tenant/[id]/StorefrontImmersiveLayout.tsx`):
   - Add gallery section below hero strip or in a dedicated block.

#### Directory & Shop Profile (data consistency)

5. **Verify directory layouts** (`DirectoryEntry*Layout.tsx`) still render photos from `directory_photos`.
6. **Verify `ShopProfileClient.tsx`** still renders photos from `directory_photos`.
7. **Optional**: have directory/shop profile respect `storeGalleryMode` from `StorefrontOptionFlags` if not already wired through `galleryDisplayMode`.

#### Feature Store & Dashboard

8. **Feature Store integration**: the feature store page (`/settings/feature-store`) automatically lists `bsaas_catalog` entries. Verify "Storefront Store Gallery" appears with pricing, trial, and eligibility.
9. **CapabilityShowcase**: add a "Store Gallery" row to the storefront options showcase on the tenant dashboard when enabled.
10. **PlanSummaryPanel**: add store gallery to the storefront options summary if applicable.

**Deliverables**:
- Gallery section renders on all 3 storefront layouts when enabled.
- Directory/shop profile surfaces continue to render the same photos.
- Feature Store lists the feature.
- Dashboard showcase reflects the feature.

**Verification**: `pnpm checkapi && pnpm checkweb` — zero TS errors. Manual test: enable store gallery, upload photos, view storefront → see gallery; view directory → same photos; purchase via Feature Store.

---

### Sprint 4: Polish, Bot Knowledge, and Skill Doc (2-3 days)

**Goal**: Final polish, bot awareness, documentation, and edge cases.

**Tasks**:

1. **Bot knowledge integration**:
   - Extend `BotKnowledgeEmbeddingService` to chunk `storefront_store_gallery_enabled` and `storefront_store_gallery_mode` into bot knowledge embeddings (if a storefront options embeddings method exists).
   - Update `BotDynamicResponseService` to inject gallery context when answering questions about store photos or storefront layout.

2. **Lightbox/modal viewer**: add a shared zoom overlay for `StorefrontStoreGallery` (reuse `DirectoryMagazineGallery` zoom overlay or extract a reusable `PhotoLightbox` component).

3. **Analytics tracking**: fire `badge_events` or custom analytics when the storefront gallery is viewed, with `badgeKey='storefront_store_gallery'` and `eventType='view'`.

4. **Edge cases**:
   - 0 photos: return null on public pages; show empty-state helper in admin preview.
   - 1 photo: single large image.
   - 2-3 photos: simplified grid.
   - Unpublished directory listing: still allow storefront gallery (since it is tenant-scoped), but optionally hide if merchant has disabled the entire storefront.

5. **Performance**: use `next/image` where possible, lazy loading, aspect-ratio placeholders, priority on hero image.

6. **Skill document**: create `.devin/skills/storefront-store-gallery.md` documenting:
   - Feature key: `storefront_opt_store_gallery`
   - Merchant preferences: `storefront_store_gallery_enabled`, `storefront_store_gallery_mode`
   - Components: `StorefrontStoreGallery.tsx`, `StoreGalleryManager.tsx`
   - Rendering surfaces: 3 storefront layouts + 4 directory layouts + 1 shop profile = 8 surfaces using the same photo pool
   - Central management page: `/t/[tenantId]/settings/store-gallery`
   - Data source: `directory_photos` table
   - Anti-patterns: don't duplicate the photo table, don't create a separate upload pipeline, don't bypass capability check

**Deliverables**:
- Bot knowledge integration
- Shared lightbox
- Analytics tracking
- Edge case handling
- Skill document

**Verification**: `pnpm checkapi && pnpm checkweb` — zero TS errors. Full E2E test: upload photos → enable → view on storefront → ask bot about store photos → see gallery in analytics.

---

## 5. File Inventory

### New Files

| File | Sprint | Purpose |
|------|--------|---------|
| `database/migrations/0XX_storefront_store_gallery.sql` | S1 | Feature key + tier seeding + BSaaS catalog + settings columns |
| `apps/web/src/components/storefront/StorefrontStoreGallery.tsx` | S2 | Public storefront store gallery display |
| `apps/web/src/components/storefront/StoreGalleryManager.tsx` | S2 | Central admin management UI for store photos |
| `apps/web/src/app/t/[tenantId]/settings/store-gallery/page.tsx` | S2 | Store Gallery settings page |
| `.devin/skills/storefront-store-gallery.md` | S4 | Skill document |

### Modified Files

| File | Sprint | Changes |
|------|--------|---------|
| `apps/api/prisma/schema.prisma` | S1 | Add new settings columns to `tenant_storefront_options_settings` |
| `apps/api/src/services/resolvers/types.ts` | S1 | Add store gallery fields to merchant settings + effective options |
| `apps/api/src/services/resolvers/StorefrontOptionsResolver.ts` | S1 | Store gallery resolution logic |
| `apps/api/src/services/StorefrontOptionsService.ts` | S1 | Pass new feature through resolver |
| `apps/api/src/routes/storefront-options-settings.ts` | S1 | Accept/store new settings fields |
| `apps/api/src/routes/directory-listings.ts` (or new route) | S1 | Tenant-scoped photo fetch endpoint |
| `apps/web/src/services/CapabilityResolutionService.ts` | S2 | Add store gallery state to `StorefrontOptionsState` + `StorefrontOptionFlags` |
| `apps/web/src/utils/storefrontOptions.ts` | S2 | Add `store_gallery` type metadata |
| `apps/web/src/services/TenantInfoService.ts` | S2 | Add new settings fields to settings type |
| `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | S2 | Expose store gallery capability |
| `apps/web/src/components/directory/DirectorySettingsPanel.tsx` | S2 | Replace photo management with preview + link |
| `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` | S2 | Add "Store Gallery" nav link |
| `apps/web/src/components/settings/TenantSettings.tsx` | S2 | Add Store Gallery settings card |
| `apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts` | S3 | Derive `showStoreGallery` and `storeGalleryMode` |
| `apps/web/src/app/tenant/[id]/page.tsx` | S3 | Render gallery section in classic layout |
| `apps/web/src/app/tenant/[id]/StorefrontEditorialLayout.tsx` | S3 | Render gallery section |
| `apps/web/src/app/tenant/[id]/StorefrontImmersiveLayout.tsx` | S3 | Render gallery section |
| `apps/web/src/components/dashboard/CapabilityShowcase.tsx` | S3 | Add store gallery showcase row |
| `apps/web/src/components/settings/PlanSummaryPanel.tsx` | S3 | Add store gallery summary |
| `apps/api/src/services/BotKnowledgeEmbeddingService.ts` | S4 | Store gallery mode embeddings |
| `apps/api/src/services/BotDynamicResponseService.ts` | S4 | Store gallery RAG context |

---

## 6. Tier Feature Matrix

| Tier | Product Card Gallery | Directory Store Gallery | Storefront Store Gallery |
|------|---------------------|--------------------------|--------------------------|
| Trial | ✅ (5 images) | ✅ (view only, limited) | ❌ |
| Starter | ✅ (5 images) | ✅ | ❌ (purchase à la carte) |
| Growth | ✅ (10 images) | ✅ | ✅ (included) |
| Scale | ✅ (15 images) | ✅ | ✅ (included) |
| Enterprise | ✅ (15 images) | ✅ | ✅ (included) |

**BSaaS Catalog Entry**:
- Feature key: `storefront_opt_store_gallery`
- Marketing name: "Storefront Store Gallery"
- Price: $9/month
- Trial: 7 days
- Billing cycle: monthly
- Sort order: after existing storefront options features

---

## 7. Design Decisions

1. **Centralized management** — Store photos are managed from a single `/t/[tenantId]/settings/store-gallery` page, not from the directory options page. This page feeds both storefront and directory surfaces.

2. **No new data table** — Reuses the existing `directory_photos` table. The table is already tenant-scoped via `tenant_id`, so a tenant-scoped fetch is sufficient for the storefront.

3. **Separate storefront toggle** — `storefront_store_gallery_enabled` is distinct from `gallery_display_mode` (which controls product/directory galleries). Merchants can show a store gallery on the storefront independently of whether they use magazine mode on product/directory galleries.

4. **Display mode parity** — The storefront store gallery supports the same carousel/magazine display modes already available for directory photos, so the merchant experience is consistent.

5. **Default off** — The storefront store gallery is disabled by default. Enabling it requires both the tier feature and an explicit merchant toggle.

6. **Decouple directory settings from management** — `DirectorySettingsPanel.tsx` no longer contains photo upload/reorder controls. It shows a preview and a link to the central management page.

7. **Reuse before rebuild** — `DirectoryPhotoGalleryDisplay.tsx` and `DirectoryMagazineGallery.tsx` patterns are reused for storefront rendering rather than creating a third unique component.

8. **Tenant-scoped public API** — The storefront gallery fetches photos by `tenantId`, not by `listingId`, so it works even when the directory listing is not yet published.

9. **Capability gating** — The storefront gallery section is only rendered when the tenant's tier includes `storefront_opt_store_gallery` and the merchant has enabled it.

---

## 8. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Photos intended only for directory leak to storefront | Medium | Separate enablement toggle; default off; merchant controls storefront visibility |
| Directory listing not yet created but storefront needs photos | Low | Tenant-scoped fetch by `tenant_id` works without a `listing_id` |
| Layout shift from gallery section on storefront | Medium | Aspect-ratio placeholders; reserve space when enabled |
| Mobile magazine layout breaks | Medium | Responsive grid; 1 column mobile, 2 tablet, 3-4 desktop |
| Merchants confused by moving management out of directory settings | Medium | Clear preview + link; onboarding tooltip; keep existing directory preview |
| Bot doesn't know about storefront gallery | Low | Sprint 4 adds bot knowledge embeddings |
| Existing directory tests break | Low | Data source unchanged; only UI management location changes |
| 8 rendering surfaces = integration complexity | Medium | `StorefrontOptionFlags` already flows to all surfaces; only conditional branch needed |

---

## 9. Timeline

| Sprint | Duration | Dependencies |
|--------|----------|-------------|
| Sprint 1: Backend | 3-4 days | None |
| Sprint 2: Frontend (management + display + settings) | 5-6 days | Sprint 1 |
| Sprint 3: Integration (3 storefront layouts + directory/shop + feature store) | 4-5 days | Sprint 2 |
| Sprint 4: Polish | 2-3 days | Sprint 3 |
| **Total** | **14-18 days** | |

Critical path: S1 → S2 → S3 (12-15 days to merchant-usable feature). S4 is enhancement.

---

## 10. Acceptance Criteria

- [ ] `storefront_opt_store_gallery` feature key exists in `features_list`
- [ ] Feature linked to `storefront_options` capability type in `capability_features_list`
- [ ] Feature seeded for growth/scale/enterprise tiers in `tier_features_list`
- [ ] BSaaS catalog entry exists with $9/mo pricing and 7-day trial
- [ ] `StorefrontOptionsMerchantSettings` includes `storefront_store_gallery_enabled` and `storefront_store_gallery_mode`
- [ ] `EffectiveStorefrontOptions` includes `store_gallery_enabled` and `can_use_store_gallery`
- [ ] `StorefrontOptionsResolver.ts` resolves store gallery from tier features
- [ ] Tenant-scoped API returns `directory_photos` by `tenant_id`
- [ ] `StorefrontStoreGallery.tsx` component renders store photos on the storefront
- [ ] `StoreGalleryManager.tsx` centralizes photo upload/reorder/management
- [ ] `/t/[tenantId]/settings/store-gallery` page exists and is reachable from sidebar
- [ ] `StorefrontOptionFlags` includes `storeGalleryEnabled`, `canUseStoreGallery`, `storeGalleryMode`
- [ ] Directory settings panel shows preview + link to Store Gallery page instead of inline management
- [ ] Storefront gallery renders on all 3 storefront layouts when enabled
- [ ] Directory and shop profile surfaces continue to render the same photos
- [ ] Feature Store shows "Storefront Store Gallery" as purchasable
- [ ] Dashboard showcase reflects the feature when enabled
- [ ] Carousel remains default; magazine mode available when merchant selects it
- [ ] `pnpm checkapi` — zero TS errors
- [ ] `pnpm checkweb` — zero TS errors
- [ ] Skill document created at `.devin/skills/storefront-store-gallery.md`
