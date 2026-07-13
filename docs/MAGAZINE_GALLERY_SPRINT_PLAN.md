# Magazine-Style Gallery — Analysis & Sprint Plan

## 1. Executive Summary

Merchants currently have only carousel-style image galleries across two surfaces: **storefront product detail pages** and **directory entry pages**. This sprint plan introduces a **Magazine Gallery** — an alternative display mode that renders all images simultaneously in a magazine/mosaic layout. This gives merchants a prolific, editorial-style visual presentation instead of a controlled one-at-a-time carousel.

The feature applies to **both surfaces** — product images on storefront product pages AND store/business photos on directory entry pages — each with its own rendering path, component hierarchy, and layout variations. A single `gallery_display_mode` merchant preference controls both surfaces, so merchants set it once and it applies everywhere galleries appear.

The feature integrates into the existing `storefront_options` capability as a new gallery display mode, appears as a radio selection on the merchant options gate page, and can be monetized as a premier BSaaS app-store feature.

> **Namespace Split Alignment**: The `STOREFRONT_OPTIONS_NAMESPACE_SPLIT_PLAN.md` (§4.3) defines `storefront_gallery_*` as a dedicated capability type for all gallery features. The magazine gallery feature (`storefront_opt_gallery_magazine`) will migrate to `storefront_gallery_magazine` in Phase 2 of the namespace split. All references to `storefront_options` in this sprint plan should be considered **temporary** — the feature key, capability type assignment, merchant settings table, and BSaaS catalog entry will all be renamed to the `storefront_gallery` domain during that phase. The resolver logic already handles gallery as a separate block within `StorefrontOptionsResolver.ts`, making the migration a straightforward key rename + capability type reassignment.

---

## 2. Current State Analysis

### 2.1 Surface A — Storefront Product Gallery

#### Components

Two carousel components exist today for product images:

- **`ProductGallery.tsx`** (`apps/web/src/components/products/ProductGallery.tsx`) — Full carousel with captions, prev/next buttons, image counter, zoom button, thumbnail strip. Used when `maxGalleryImages >= 10`.
- **`BasicProductGallery.tsx`** (`apps/web/src/components/products/BasicProductGallery.tsx`) — Simpler carousel (no captions, smaller thumbnails). Used when `maxGalleryImages < 10`.

Both are **carousel-only**: one image visible at a time, user clicks through sequentially.

#### Rendering Surfaces (3 Product Page Layouts)

| Layout | Rendering Path | Gallery Component |
|--------|---------------|-------------------|
| **Classic** | `page.tsx` → `TierBasedLandingPage.tsx` (line ~1358) | `ProductGallery` or `BasicProductGallery` directly |
| **Showcase** | `page.tsx` → `ProductShowcaseLayout.tsx` → `ProductGalleryPanel.tsx` | Via `ProductGalleryPanel` |
| **Quick-Commerce** | `page.tsx` → `ProductQuickCommerceLayout.tsx` → `ProductGalleryPanel.tsx` | Via `ProductGalleryPanel` |

`ProductGalleryPanel.tsx` (`apps/web/src/components/products/sections/ProductGalleryPanel.tsx`) is the shared panel for showcase + quick-commerce layouts. It selects between `ProductGallery` and `BasicProductGallery` based on `safeFeatures.maxGalleryImages`.

The classic layout (`TierBasedLandingPage.tsx`) has its own inline gallery rendering at line ~1358, duplicating the same carousel selection logic.

#### Data Flow

Product images flow from `page.tsx` → maps `product.images` to `Photo[]` format → passes as `product.imageGallery` to layout components → reaches gallery components via `safeFeatures.maxGalleryImages` gate.

### 2.2 Surface B — Directory Entry Gallery

#### Components

Two separate components handle directory gallery:

- **`DirectoryPhotoGalleryDisplay.tsx`** (`apps/web/src/components/directory/DirectoryPhotoGalleryDisplay.tsx`) — **Public-facing** carousel display. Shows store photos on the directory entry page with prev/next buttons, image counter, zoom button, thumbnail navigation. Fetches photos via `directoryListingService.getDirectoryListingPhotos()`. Has its own `useState` for `currentIndex` — same carousel pattern as product galleries but for store/business photos (not product images).

- **`DirectoryPhotoGallery.tsx`** (`apps/web/src/components/directory/DirectoryPhotoGallery.tsx`) — **Admin-facing** photo management. Upload, reorder, set primary, edit alt/caption, delete. Grid layout for management purposes (not display). This component is NOT affected by the magazine display mode — it remains a management tool regardless of display style.

#### Rendering Surfaces (4 Directory Layouts + Shop Profile)

`DirectoryPhotoGalleryDisplay` is used across **5 rendering surfaces**:

| Surface | Rendering Path | Line |
|---------|---------------|------|
| **Directory Classic** | `directory/[slug]/page.tsx` → `DirectoryEntryClassicLayout.tsx` | ~315 |
| **Directory Editorial** | `directory/[slug]/page.tsx` → `DirectoryEntryEditorialLayout.tsx` | ~114 |
| **Directory Immersive** | `directory/[slug]/page.tsx` → `DirectoryEntryImmersiveLayout.tsx` | ~117 |
| **Directory Premium** | `directory/[slug]/page.tsx` → `DirectoryEntryPremiumLayout.tsx` | ~118 |
| **Shop Profile** | `shops/[slug]/ShopProfileClient.tsx` | ~356 |

All 4 directory layouts receive `optFlags: StorefrontOptionFlags` via `DirectoryEntryLayoutProps` (`directory/[slug]/layouts/types.ts`). The `optFlags` already carries `galleryLimit` and other storefront option flags.

The Shop Profile page also receives `optFlags` and constructs a `directoryListing` object from shop data to render `DirectoryPhotoGalleryDisplay`.

#### Data Flow

Directory photos are fetched at runtime by `DirectoryPhotoGalleryDisplay` itself — it calls `directoryListingService.getDirectoryListingPhotos(listing.id)` in a `useEffect`. Photos are stored as `directory_listing_photos` in the database, separate from product images.

#### Directory Settings Panel

`DirectorySettingsPanel.tsx` (`apps/web/src/components/directory/DirectorySettingsPanel.tsx`) manages directory-specific gallery settings:
- Gallery on/off toggle (checkbox, not radio)
- Gallery image limit (5/10/15 via `image_gallery_5/10/15` settings)
- Photo upload management via `DirectoryPhotoGallery`
- Settings saved via `tenantDirectoryManagementService.updateDirectoryListing()`

This is a **separate settings surface** from `StorefrontOptionsSettingsClient.tsx`. The gallery display mode radio should appear in **both** settings panels, or the directory panel should defer to the storefront options setting.

### 2.3 Shared Gallery Capability System

Gallery is part of the **`storefront_options`** capability type.

> **Future home**: Per `STOREFRONT_OPTIONS_NAMESPACE_SPLIT_PLAN.md` §4.3, gallery features will migrate to the **`storefront_gallery`** capability type with `storefront_gallery_*` feature key prefixes. The current `storefront_opt_gallery_*` and `storefront_opt_image_gallery_*` keys are temporary — they will be renamed during Phase 2 of the namespace split.

**Current feature keys** (radio selection — only one active at a time):
- `image_gallery_5` — limit of 5 images
- `image_gallery_10` — limit of 10 images
- `image_gallery_15` — limit of 15 images

These control the **maximum number of images** displayed, not the **display style** (carousel vs. magazine).

**Merchant settings** stored in `tenant_storefront_options_settings`:
- `image_gallery_5`, `image_gallery_10`, `image_gallery_15` (booleans, radio)
- `default_gallery_limit` (number: 5, 10, or 15)

**Settings UI (storefront)**: `StorefrontOptionsSettingsClient.tsx` — Gallery Display card with radio buttons for 5/10/15 images. Group icon: orange Image icon.

**Settings UI (directory)**: `DirectorySettingsPanel.tsx` — Gallery toggle (on/off checkbox) + gallery limit (5/10/15). Separate from storefront options but uses same underlying `tenant_storefront_options_settings` fields.

### 2.4 Resolver Pipeline

| Layer | File | Role |
|-------|------|------|
| **Backend resolver** | `apps/api/src/services/resolvers/StorefrontOptionsResolver.ts` | Resolves allowed gallery types from tier features |
| **Backend service** | `apps/api/src/services/StorefrontOptionsService.ts` | Fetches tier features, calls resolver |
| **Backend types** | `apps/api/src/services/resolvers/types.ts` | `StorefrontOptionsMerchantSettings`, `EffectiveStorefrontOptions` |
| **Frontend resolver** | `apps/web/src/services/CapabilityResolutionService.ts` | `StorefrontOptionsState` with `allowedGalleryTypes`, `galleryEnabled` |
| **Frontend types** | `apps/web/src/utils/storefrontOptions.ts` | `GALLERY_TYPES`, `STOREFRONT_OPT_TYPE_META`, group definitions |
| **Frontend hook** | `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | `useStorefrontOptionsCapability` |
| **Frontend service** | `apps/web/src/services/TenantInfoService.ts` | `getStorefrontOptionsSettings`, `updateStorefrontOptionsSettings` |

### 2.5 BSaaS Catalog (App Store)

The `bsaas_catalog` table registers features available for à la carte purchase. Each entry references a `feature_key` from `features_list`. The feature store page (`/settings/feature-store`) displays purchasable features with pricing, trial, and eligibility.

The **Active Capability Engagement** rule requires that a merchant's tier already grants at least one other feature within the same capability type before they can purchase à la carte.

---

## 3. Proposed Architecture

### 3.1 New Feature Key

| Key | Name | Description |
|-----|------|-------------|
| `storefront_opt_gallery_magazine` | Magazine Gallery | Display all product images simultaneously in a magazine/mosaic layout |

This feature key is registered in `features_list`, linked to the `storefront_options` capability type via `capability_features_list`, and seeded into `tier_features_list` for appropriate tiers.

### 3.2 New Merchant Preference

A new `gallery_display_mode` field controls which gallery style the merchant has selected:

```typescript
gallery_display_mode: 'carousel' | 'magazine'  // default: 'carousel'
```

This is a **radio selection** on the settings page, separate from the image limit radio (5/10/15). The two are orthogonal:
- **Image limit** (existing): How many images can be uploaded/displayed
- **Display mode** (new): How those images are presented (carousel vs. magazine)

### 3.3 New Components

#### `MagazineGallery.tsx` (for product images)

A client component that renders all product gallery images in a responsive magazine/mosaic grid:

- **Layout**: CSS grid with varied tile sizes (first image larger as hero, remaining in masonry-like arrangement)
- **Responsive**: 1 column on mobile, 2 columns on tablet, 3-4 columns on desktop
- **Interactions**: Click any image to open full-size in new tab (same as carousel zoom)
- **Captions**: Displayed below each image (when present)
- **No navigation buttons**: All images visible without interaction
- **Lazy loading**: Images below the fold use `loading="lazy"`
- **Max images**: Still respects `maxGalleryImages` limit from tier
- **Props**: `gallery: Photo[]`, `productTitle: string` (same interface as `ProductGallery`)

#### `DirectoryMagazineGallery.tsx` (for directory photos)

A client component that renders all directory listing photos in a responsive magazine/mosaic grid:

- **Layout**: Same magazine/mosaic grid as `MagazineGallery.tsx` but adapted for directory photo dimensions (directory photos use `aspect-video` containers, not square)
- **Props**: `listing: DirectoryListing`, `isPublished: boolean` (same interface as `DirectoryPhotoGalleryDisplay`)
- **Data fetching**: Self-contained — calls `directoryListingService.getDirectoryListingPhotos(listing.id)` in `useEffect`, same as `DirectoryPhotoGalleryDisplay`
- **Primary photo badge**: Shows "Primary Photo" badge on position-0 photo
- **Click-to-zoom**: Opens full-size image in new tab
- **Captions**: Displayed below each photo (when present)
- **Lazy loading**: Below-fold photos use `loading="lazy"`
- **Max photos**: Still respects 10-photo directory limit

**Why two components instead of one?** The product gallery and directory gallery have different data sources, different prop interfaces, different image aspect ratios, and different rendering contexts. `MagazineGallery` receives pre-loaded `Photo[]` from parent; `DirectoryMagazineGallery` fetches its own photos from the directory listing service. Keeping them separate follows the existing pattern (`ProductGallery` vs `DirectoryPhotoGalleryDisplay` are already separate components).

### 3.4 Rendering Integration

#### Surface A — Storefront Product Pages (3 entry points)

1. **`ProductGalleryPanel.tsx`** (showcase + quick-commerce layouts): Add a conditional branch — if `galleryDisplayMode === 'magazine'` and the feature is enabled, render `MagazineGallery` instead of `ProductGallery`/`BasicProductGallery`.

2. **`TierBasedLandingPage.tsx`** (classic layout): Same conditional branch at the inline gallery rendering point.

The `galleryDisplayMode` value flows from merchant settings → `safeFeatures` → gallery rendering components.

#### Surface B — Directory Entry Pages (5 entry points)

3. **All 4 directory layouts** (`DirectoryEntryClassicLayout.tsx`, `DirectoryEntryEditorialLayout.tsx`, `DirectoryEntryImmersiveLayout.tsx`, `DirectoryEntryPremiumLayout.tsx`): Replace `<DirectoryPhotoGalleryDisplay>` with a conditional wrapper component or inline conditional:
   ```tsx
   {optFlags?.galleryDisplayMode === 'magazine' && optFlags?.canUseMagazineGallery ? (
     <DirectoryMagazineGallery listing={listing} isPublished={true} />
   ) : (
     <DirectoryPhotoGalleryDisplay listing={listing} {...businessProfile} isPublished={true} />
   )}
   ```

4. **`ShopProfileClient.tsx`** (shop profile page): Same conditional branch at line ~356 where `DirectoryPhotoGalleryDisplay` is rendered.

The `galleryDisplayMode` and `canUseMagazineGallery` values flow through `optFlags: StorefrontOptionFlags` which is already passed to all directory layouts and the shop profile.

#### Shared flag propagation

The `StorefrontOptionFlags` interface (in `CapabilityResolutionService.ts`) already flows to both surfaces — `safeFeatures` for product pages and `optFlags` for directory pages. Adding `galleryDisplayMode` and `canUseMagazineGallery` to `StorefrontOptionFlags` automatically makes it available on both surfaces.

### 3.5 Capability Resolution

The resolver pipeline updates at these points:

1. **`StorefrontOptionsResolver.ts`** (backend): Add `gallery_magazine_enabled` to `EffectiveStorefrontOptions`. Check `features.storefront_opt_gallery_magazine` or flexible key.
2. **`StorefrontOptionsService.ts`** (backend): Pass the new feature through `resolveFromFeatures`.
3. **`types.ts`** (backend): Add `gallery_magazine_enabled: boolean` to `EffectiveStorefrontOptions`. Add `gallery_display_mode?: string` to `StorefrontOptionsMerchantSettings`.
4. **`CapabilityResolutionService.ts`** (frontend): Add `galleryMagazineEnabled`, `canUseMagazineGallery` to `StorefrontOptionsState`. Add `gallery_display_mode` to `merchantPreferences`.
5. **`storefrontOptions.ts`** (frontend utils): Add `gallery_magazine` to `STOREFRONT_OPT_TYPE_META` with `selectionMode: 'radio'` in a new `gallery_mode` sub-group or within the existing `gallery` group.

6. **`StorefrontOptionFlags`** (frontend): Add `galleryDisplayMode: 'carousel' | 'magazine'` and `canUseMagazineGallery: boolean` to the `StorefrontOptionFlags` interface and `toStorefrontOptionFlags()` converter. This makes the flag available to both product pages (via `safeFeatures`) and directory pages (via `optFlags`).

### 3.6 Monetization (BSaaS App Store)

The magazine gallery feature can be sold as a premier BSaaS feature:

- **Feature key**: `storefront_opt_gallery_magazine`
- **BSaaS catalog entry**: $9/month, 7-day trial, `is_active: true`
- **Tier allocation**:
  - Trial: not available
  - Starter: not available (carousel only)
  - Growth: included (no extra charge)
  - Scale: included
  - Enterprise: included
  - Starter merchants can purchase à la carte from the Feature Store

This follows the existing BSaaS pattern: feature key in `features_list` → `capability_features_list` link → `bsaas_catalog` entry → tier seeding for higher tiers + à la carte for lower tiers.

---

## 4. Sprint Plan

### Sprint 1: Backend — Feature Registration & Resolver (3-4 days)

**Goal**: Register the new feature key, wire it through the resolver pipeline, and update merchant settings storage.

**Tasks**:

1. **Migration: Seed feature key** — SQL migration to insert `storefront_opt_gallery_magazine` into `features_list`, link it to `storefront_options` capability type in `capability_features_list`, and seed into `tier_features_list` for growth/scale/enterprise tiers.

2. **Update `StorefrontOptionsMerchantSettings`** (types.ts) — Add `gallery_display_mode?: string | null` field.

3. **Update `EffectiveStorefrontOptions`** (types.ts) — Add `gallery_magazine_enabled: boolean` and `can_use_magazine_gallery: boolean`.

4. **Update `StorefrontOptionsResolver.ts`** — Add magazine gallery resolution logic:
   - Check `features.storefront_opt_gallery_magazine` or flexible key
   - Set `gallery_magazine_enabled` and `can_use_magazine_gallery`
   - Effective flag = tier-allowed AND merchant preference is `'magazine'`

5. **Update `StorefrontOptionsService.ts`** — Pass new feature through `resolveFromFeatures`. Add `gallery_display_mode` to merchant settings read/write.

6. **Update storefront-options route** — Accept `gallery_display_mode` in PUT body, persist to `tenant_storefront_options_settings`.

7. **BSaaS catalog entry** — Insert `storefront_opt_gallery_magazine` into `bsaas_catalog` with pricing ($9/mo, 7-day trial).

**Deliverables**:
- Migration SQL file
- Updated resolver types + logic
- Updated merchant settings schema
- BSaaS catalog entry

**Verification**: `pnpm checkapi` — zero TS errors. Manual API test: GET/PUT storefront-options returns `gallery_display_mode`.

---

### Sprint 2: Frontend — MagazineGallery Components & Settings UI (5-6 days)

**Goal**: Build both magazine gallery components (product + directory), add the display mode radio to both settings pages, and wire the capability through the frontend resolver.

**Tasks**:

1. **Create `MagazineGallery.tsx`** (`apps/web/src/components/products/MagazineGallery.tsx`) — Client component for product images:
   - Responsive CSS grid magazine layout (hero image + mosaic)
   - Accepts `gallery: Photo[]` and `productTitle: string` props (same interface as `ProductGallery`)
   - Click-to-zoom on each image
   - Lazy loading for below-fold images
   - Caption display per image
   - Respects `maxGalleryImages` limit
   - Dark mode support
   - Empty state (no images)

2. **Create `DirectoryMagazineGallery.tsx`** (`apps/web/src/components/directory/DirectoryMagazineGallery.tsx`) — Client component for directory photos:
   - Same magazine/mosaic grid layout adapted for directory photo dimensions (aspect-video containers)
   - Accepts `listing: DirectoryListing`, `isPublished: boolean` props (same interface as `DirectoryPhotoGalleryDisplay`)
   - Self-contained data fetching via `directoryListingService.getDirectoryListingPhotos(listing.id)`
   - Primary photo badge on position-0 photo
   - Click-to-zoom opens full-size in new tab
   - Caption display per photo
   - Lazy loading for below-fold photos
   - Respects 10-photo directory limit
   - Dark mode support
   - Empty state (no photos)

3. **Update `CapabilityResolutionService.ts`** (frontend) — Add to `StorefrontOptionsState`:
   - `galleryMagazineEnabled: boolean`
   - `canUseMagazineGallery: boolean`
   - `galleryDisplayMode: 'carousel' | 'magazine'`
   - Add `gallery_display_mode` to `merchantPreferences`
   - Update `resolveStorefrontOptionsState` function

4. **Update `StorefrontOptionFlags`** (frontend) — Add `galleryDisplayMode` and `canUseMagazineGallery` to the `StorefrontOptionFlags` interface and `toStorefrontOptionFlags()` converter. This is the shared flag shape that flows to both product pages (`safeFeatures`) and directory pages (`optFlags`).

5. **Update `storefrontOptions.ts`** (frontend utils) — Add `gallery_magazine` to `STOREFRONT_OPT_TYPE_META` and `GALLERY_MODE_TYPES` array. Add `'gallery_mode'` to `StorefrontOptGroup` type.

6. **Update `StorefrontOptionsSettingsClient.tsx`** — Add a new "Gallery Display Mode" card (or sub-section within existing Gallery card) with two radio options:
   - **Carousel** (default) — "One image at a time with navigation. Classic controlled viewing."
   - **Magazine** (premier) — "All images displayed at once in a magazine mosaic. Maximum visual impact."
   - Magazine option shows lock icon + "Upgrade" link when tier doesn't include it
   - Add `gallery_display_mode` to `StorefrontOptionsSettings` interface and `DEFAULT_SETTINGS`
   - New `handleGalleryModeRadio` handler
   - Help text: "Applies to both product galleries and directory entry galleries"

7. **Update `DirectorySettingsPanel.tsx`** — Add a "Gallery Display Mode" sub-section within the existing "Store Gallery" card:
   - Same Carousel/Magazine radio options
   - Reads from the same `gallery_display_mode` setting (shared preference, not separate)
   - Shows current mode and lock icon if tier doesn't include magazine
   - If magazine is selected here, it also applies to storefront product pages (and vice versa)
   - Help text: "This setting also applies to product page galleries"

8. **Update `TenantInfoService.ts`** — Add `gallery_display_mode` to `getStorefrontOptionsSettings` return type.

9. **Update `useCapabilityAccess.ts`** — Expose `canUseMagazineGallery` and `galleryDisplayMode` from `useStorefrontOptionsCapability` hook.

**Deliverables**:
- `MagazineGallery.tsx` component (product images)
- `DirectoryMagazineGallery.tsx` component (directory photos)
- Updated settings pages (storefront + directory) with display mode radio
- Updated frontend resolver + types + `StorefrontOptionFlags`
- Updated capability hook

**Verification**: `pnpm checkweb` — zero TS errors. Both settings pages show carousel/magazine radio. Magazine option locked for non-eligible tiers.

---

### Sprint 3: Integration — All Rendering Surfaces & Feature Store (4-5 days)

**Goal**: Wire the magazine gallery into all 8 rendering surfaces (3 product page layouts + 4 directory layouts + 1 shop profile) and surface it in the Feature Store for purchase.

**Tasks**:

#### Surface A — Storefront Product Pages

1. **Update `ProductGalleryPanel.tsx`** — Add magazine conditional branch:
   ```tsx
   if (safeFeatures.galleryDisplayMode === 'magazine' && safeFeatures.canUseMagazineGallery) {
     return <MagazineGallery gallery={...} productTitle={...} />;
   }
   // existing carousel logic...
   ```
   - Accept new `galleryDisplayMode` and `canUseMagazineGallery` props (or via `safeFeatures`)

2. **Update `TierBasedLandingPage.tsx`** — Same conditional branch at the inline gallery rendering point (~line 1358):
   - Check `safeFeatures.galleryDisplayMode` and magazine capability
   - Render `MagazineGallery` when enabled

3. **Update `useProductDetailState.ts`** — Add `galleryDisplayMode` and `canUseMagazineGallery` to `LandingPageFeatures` interface and `mapTierToFeatures` function.

4. **Update `page.tsx`** (product detail) — Pass `gallery_display_mode` through to `ProductShowcaseLayout`, `ProductQuickCommerceLayout`, and `TierBasedLandingPage` as part of `optFlags` / `safeFeatures`.

5. **Update `ProductShowcaseLayout.tsx`** and `ProductQuickCommerceLayout.tsx`** — Pass `galleryDisplayMode` through to `ProductGalleryPanel`.

#### Surface B — Directory Entry Pages

6. **Update all 4 directory layout files** — Add magazine conditional branch in each:
   - `DirectoryEntryClassicLayout.tsx` (~line 315)
   - `DirectoryEntryEditorialLayout.tsx` (~line 114)
   - `DirectoryEntryImmersiveLayout.tsx` (~line 117)
   - `DirectoryEntryPremiumLayout.tsx` (~line 118)
   
   Each replaces:
   ```tsx
   {!showStatusPanel && <DirectoryPhotoGalleryDisplay listing={listing} {...businessProfile} isPublished={true} />}
   ```
   With:
   ```tsx
   {!showStatusPanel && (
     optFlags?.galleryDisplayMode === 'magazine' && optFlags?.canUseMagazineGallery ? (
       <DirectoryMagazineGallery listing={listing} isPublished={true} />
     ) : (
       <DirectoryPhotoGalleryDisplay listing={listing} {...businessProfile} isPublished={true} />
     )
   )}
   ```

7. **Update `ShopProfileClient.tsx`** — Same conditional branch at line ~356 where `DirectoryPhotoGalleryDisplay` is rendered.

8. **Update `DirectoryEntryLayoutProps`** (`directory/[slug]/layouts/types.ts`) — No change needed — `optFlags: StorefrontOptionFlags` is already passed. The new `galleryDisplayMode` and `canUseMagazineGallery` fields will automatically be available once `StorefrontOptionFlags` is updated in Sprint 2.

9. **Update `directory/[slug]/page.tsx`** — No change needed — `optFlags` is already fetched via `unifiedCapabilityService.getStorefrontOptionFlags()` and passed to layouts. The new fields flow through automatically.

#### Feature Store & Dashboard

10. **Feature Store integration** — The feature store page (`/settings/feature-store`) automatically lists `bsaas_catalog` entries. Verify the magazine gallery appears with:
    - Marketing name: "Magazine Gallery"
    - Description: "Display all product and directory images in a stunning magazine mosaic layout"
    - Price: $9/month
    - Trial: 7 days
    - Tier eligibility check (starter merchants see "Upgrade Required" if their tier doesn't include `storefront_options` capability engagement)

11. **CapabilityShowcase** — Add "Magazine Gallery" to the storefront options showcase row on the tenant dashboard when enabled.

**Deliverables**:
- Magazine gallery renders on all 3 product page layouts when enabled
- Magazine gallery renders on all 4 directory layouts + shop profile when enabled
- Feature Store shows magazine gallery as purchasable
- Dashboard showcase reflects the feature

**Verification**: `pnpm checkapi && pnpm checkweb` — zero TS errors. Manual test: enable magazine mode in settings, visit product page AND directory entry page, see mosaic layout on both.

---

### Sprint 4: Polish, Bot Knowledge & Skill Doc (2-3 days)

**Goal**: Final polish, bot awareness, documentation, and edge cases.

**Tasks**:

1. **Bot knowledge integration** — Update `BotKnowledgeEmbeddingService.refreshStorefrontOptionsEmbeddings()` (if exists) or add a new `refreshGalleryEmbeddings()` method that chunks the gallery display mode into bot knowledge. Update `BotDynamicResponseService` to inject gallery mode context when answering product or directory questions.

2. **Lightbox integration** — Add optional lightbox/modal viewer for magazine gallery images on both components: click an image → full-screen modal with prev/next within the modal. This combines the prolific display of magazine with the focused viewing of carousel. Shared lightbox component used by both `MagazineGallery` and `DirectoryMagazineGallery`.

3. **Analytics tracking** — Fire `badge_events` or custom analytics when magazine gallery is viewed on either surface (for A/B comparison data merchants can use to decide carousel vs. magazine).

4. **Empty/single image edge cases** — Both `MagazineGallery` and `DirectoryMagazineGallery` with 0 images: show placeholder. 1 image: show single large image (no mosaic needed). 2-3 images: simplified grid.

5. **Performance** — Ensure lazy-loaded images don't cause layout shift (use aspect-ratio placeholders). Add `priority` to hero image for LCP optimization on both components.

6. **Skill document** — Create `.devin/skills/magazine-gallery.md` documenting:
   - Feature key: `storefront_opt_gallery_magazine`
   - Merchant preference: `gallery_display_mode`
   - Components: `MagazineGallery.tsx` (product) + `DirectoryMagazineGallery.tsx` (directory)
   - Rendering surfaces: 3 product layouts + 4 directory layouts + 1 shop profile = 8 total
   - Capability resolution flow
   - BSaaS catalog entry
   - Anti-patterns: don't bypass the capability check, don't render magazine without the feature enabled, don't create a third component — reuse the pattern

7. **Navigation links** — No new nav link needed (gallery mode is a sub-setting within existing settings pages).

8. **Settings cards** — Display mode radio added within existing Gallery sections of both `StorefrontOptionsSettingsClient.tsx` and `DirectorySettingsPanel.tsx`.

**Deliverables**:
- Bot knowledge integration
- Lightbox modal
- Analytics tracking
- Edge case handling
- Skill document

**Verification**: `pnpm checkapi && pnpm checkweb` — zero TS errors. Full E2E manual test: purchase feature in store → enable in settings → view on product page AND directory entry page → bot knows about it.

---

## 5. File Inventory

### New Files

| File | Sprint | Purpose |
|------|--------|---------|
| `database/migrations/0XX_magazine_gallery.sql` | S1 | Feature key + tier seeding + BSaaS catalog |
| `apps/web/src/components/products/MagazineGallery.tsx` | S2 | Magazine/mosaic gallery for product images |
| `apps/web/src/components/directory/DirectoryMagazineGallery.tsx` | S2 | Magazine/mosaic gallery for directory photos |
| `.devin/skills/magazine-gallery.md` | S4 | Skill document |

### Modified Files

| File | Sprint | Changes |
|------|--------|---------|
| `apps/api/src/services/resolvers/types.ts` | S1 | Add `gallery_display_mode` to settings, `gallery_magazine_enabled` to effective |
| `apps/api/src/services/resolvers/StorefrontOptionsResolver.ts` | S1 | Magazine gallery resolution logic |
| `apps/api/src/services/StorefrontOptionsService.ts` | S1 | Pass new feature through resolver |
| `apps/api/src/routes/storefront-options.ts` (or equivalent) | S1 | Accept `gallery_display_mode` in PUT |
| `apps/web/src/services/CapabilityResolutionService.ts` | S2 | Add magazine state to `StorefrontOptionsState` + `StorefrontOptionFlags` |
| `apps/web/src/utils/storefrontOptions.ts` | S2 | Add `gallery_magazine` type metadata |
| `apps/web/src/app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx` | S2 | Display mode radio UI (storefront settings) |
| `apps/web/src/components/directory/DirectorySettingsPanel.tsx` | S2 | Display mode radio UI (directory settings) |
| `apps/web/src/services/TenantInfoService.ts` | S2 | Add `gallery_display_mode` to settings type |
| `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | S2 | Expose magazine capability |
| `apps/web/src/components/products/sections/ProductGalleryPanel.tsx` | S3 | Magazine conditional branch (Surface A) |
| `apps/web/src/components/landing-page/TierBasedLandingPage.tsx` | S3 | Magazine conditional branch (Surface A) |
| `apps/web/src/app/products/[id]/layouts/hooks/useProductDetailState.ts` | S3 | Add gallery display mode to features |
| `apps/web/src/app/products/[id]/page.tsx` | S3 | Pass display mode through to layouts |
| `apps/web/src/app/products/[id]/ProductShowcaseLayout.tsx` | S3 | Pass display mode to panel |
| `apps/web/src/app/products/[id]/ProductQuickCommerceLayout.tsx` | S3 | Pass display mode to panel |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryClassicLayout.tsx` | S3 | Magazine conditional branch (Surface B) |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryEditorialLayout.tsx` | S3 | Magazine conditional branch (Surface B) |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryImmersiveLayout.tsx` | S3 | Magazine conditional branch (Surface B) |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryPremiumLayout.tsx` | S3 | Magazine conditional branch (Surface B) |
| `apps/web/src/app/shops/[slug]/ShopProfileClient.tsx` | S3 | Magazine conditional branch (Surface B) |
| `apps/web/src/components/dashboard/CapabilityShowcase.tsx` | S3 | Magazine gallery showcase row |
| `apps/api/src/services/BotKnowledgeEmbeddingService.ts` | S4 | Gallery mode embeddings |
| `apps/api/src/services/BotDynamicResponseService.ts` | S4 | Gallery mode RAG context |

---

## 6. Tier Feature Matrix

| Tier | Carousel (Default) | Magazine Gallery |
|------|-------------------|------------------|
| Trial | ✅ (5 images) | ❌ |
| Starter | ✅ (5 images) | ❌ (purchase à la carte) |
| Growth | ✅ (10 images) | ✅ (included) |
| Scale | ✅ (15 images) | ✅ (included) |
| Enterprise | ✅ (15 images) | ✅ (included) |

**BSaaS Catalog Entry**:
- Feature key: `storefront_opt_gallery_magazine`
- Marketing name: "Magazine Gallery"
- Price: $9/month
- Trial: 7 days
- Billing cycle: monthly
- Sort order: after existing storefront options features

---

## 7. Design Decisions

1. **Orthogonal to image limit** — Display mode (carousel/magazine) is independent from image count (5/10/15). A merchant can have 15 images in magazine mode or 5 images in carousel mode.

2. **Magazine is opt-in** — Default is always carousel. Merchants must explicitly select magazine mode in settings. This preserves backward compatibility.

3. **Feature gate + merchant preference** — Two-layer gating: (1) tier must include the feature key, (2) merchant must select "Magazine" in settings. Both must be true for magazine to render.

4. **No new capability type** — Magazine gallery is a new feature within the existing `storefront_options` capability type. No new capability registration needed.

5. **No new DB table** — The `gallery_display_mode` value is stored as a new column/field in the existing `tenant_storefront_options_settings` table (JSONB or ALTER TABLE ADD COLUMN).

6. **BSaaS purchasable** — Starter merchants can buy the feature à la carte. The Active Capability Engagement rule is satisfied because `storefront_options` features (like `image_gallery_5`) are already granted at the Starter tier.

7. **Magazine layout: hero + mosaic** — First image is the hero (larger tile), remaining images fill a responsive mosaic grid. This provides visual hierarchy while showing everything at once.

8. **Lightbox as enhancement, not replacement** — Sprint 4 adds a lightbox modal so users can still view images full-size without losing the magazine overview.

9. **Single preference, two surfaces** — One `gallery_display_mode` setting controls both product galleries and directory galleries. Merchants set it once in either settings page and it applies everywhere. Both `StorefrontOptionsSettingsClient.tsx` and `DirectorySettingsPanel.tsx` expose the same radio, reading/writing the same underlying field.

10. **Two components, not one** — `MagazineGallery.tsx` (product images, receives pre-loaded `Photo[]`) and `DirectoryMagazineGallery.tsx` (directory photos, self-fetches via `directoryListingService`) are separate components following the existing pattern of `ProductGallery` vs `DirectoryPhotoGalleryDisplay`. They share visual styling but have different data flows and prop interfaces.

11. **`StorefrontOptionFlags` as the shared bridge** — The `StorefrontOptionFlags` interface already flows to both surfaces (`safeFeatures` for products, `optFlags` for directory). Adding `galleryDisplayMode` and `canUseMagazineGallery` to this interface is the single change that makes the feature available on all 8 rendering surfaces.

---

## 8. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Many images cause page bloat | Performance | Lazy loading + image limits still apply (5/10/15 for products, 10 for directory) |
| Magazine layout breaks on mobile | UX | Responsive grid: 1 column mobile, 2 tablet, 3-4 desktop |
| Merchants switch back and forth | Confusion | Both settings pages clearly show current mode with preview |
| Bot doesn't know about gallery mode | AI quality | Sprint 4 adds bot knowledge embeddings |
| Existing carousel tests break | Regression | Magazine is additive — carousel path unchanged when feature disabled |
| Directory and storefront settings disagree | Consistency | Both read/write the same `gallery_display_mode` field — impossible to disagree |
| 8 rendering surfaces = 8 integration points | Complexity | `StorefrontOptionFlags` already flows to all surfaces; only conditional branch needed |
| Directory photos have different aspect ratios than product images | Layout | `DirectoryMagazineGallery` uses aspect-video containers vs `MagazineGallery` square tiles |

---

## 9. Timeline

| Sprint | Duration | Dependencies |
|--------|----------|-------------|
| Sprint 1: Backend | 3-4 days | None |
| Sprint 2: Frontend (both components + both settings) | 5-6 days | Sprint 1 |
| Sprint 3: Integration (8 surfaces + feature store) | 4-5 days | Sprint 2 |
| Sprint 4: Polish | 2-3 days | Sprint 3 |
| **Total** | **14-18 days** | |

Critical path: S1 → S2 → S3 (12-15 days to merchant-usable feature on both surfaces). S4 is enhancement.

---

## 10. Acceptance Criteria

- [ ] `storefront_opt_gallery_magazine` feature key exists in `features_list`
- [ ] Feature linked to `storefront_options` capability type in `capability_features_list`
- [ ] Feature seeded for growth/scale/enterprise tiers in `tier_features_list`
- [ ] BSaaS catalog entry exists with $9/mo pricing and 7-day trial
- [ ] `StorefrontOptionsMerchantSettings` includes `gallery_display_mode`
- [ ] `EffectiveStorefrontOptions` includes `gallery_magazine_enabled` and `can_use_magazine_gallery`
- [ ] `StorefrontOptionsResolver.ts` resolves magazine gallery from tier features
- [ ] `MagazineGallery.tsx` component renders product images in responsive mosaic grid
- [ ] `DirectoryMagazineGallery.tsx` component renders directory photos in responsive mosaic grid
- [ ] `StorefrontOptionFlags` includes `galleryDisplayMode` and `canUseMagazineGallery`
- [ ] Both settings pages (storefront + directory) show Carousel/Magazine radio with lock icon for non-eligible tiers
- [ ] Magazine gallery renders on all 3 product page layouts (classic, showcase, quick-commerce)
- [ ] Magazine gallery renders on all 4 directory layouts (classic, editorial, immersive, premium)
- [ ] Magazine gallery renders on shop profile page
- [ ] Carousel remains default when feature disabled or not selected (both surfaces)
- [ ] Feature Store shows "Magazine Gallery" as purchasable for eligible merchants
- [ ] `pnpm checkapi` — zero TS errors
- [ ] `pnpm checkweb` — zero TS errors
- [ ] Skill document created at `.devin/skills/magazine-gallery.md`
