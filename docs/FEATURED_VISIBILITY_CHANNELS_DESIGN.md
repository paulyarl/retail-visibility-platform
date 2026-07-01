# Featured Visibility Channels — Phased Design Document

## Status: Design
## Date: June 2026
## Depends on: `FEATURED_TYPE_AUDIT.md`, `FEATURED_TYPES_MEANINGFUL_BADGES_DESIGN.md`

---

## Problem Statement

The `featured` badge type has special handling built around it — admin approval, tenant access gating, premium visual real estate, cross-tenant surfacing. But all of this is hardcoded to `type.id === 'featured'`. Meanwhile, the badge registry (`featured_type_registry`) has no concept of promotional placement, visibility channels, or monetization.

This design elevates the `featured` type's special handling into the registry and formalizes the premium surfaces as **visibility channels** — reserved surfaces that active featured products get priority on, with fallback to existing display signals when no active featured products exist.

### Key Concepts

- **Active Featured** — a `featured_products` row where `is_active = true AND admin_approved = true AND assignment_source = 'manual' AND (featured_expires_at IS NULL OR featured_expires_at > NOW())`. This is the "live promotional placement" state.
- **Visibility Channel** — any product surface on the platform that can accommodate featured visibility. The 3 initial channels (storefront spotlight, cross-tenant shops page, directory) are the first wave, but the architecture is universal — any layout that displays products can participate. When no active featured products exist, the surface falls back to its existing display logic.
- **Promotional Badge Type** — a badge type in `featured_type_registry` with `is_promotional = true`, meaning products with this badge type represent paid promotional placements, not editorial curation.

### Design Principles

1. **Registry-driven, not code-driven** — all flags that control special behavior live in `featured_type_registry`, not in `if (type.id === 'featured')` checks
2. **Channels fall back gracefully** — no active featured? Surface shows what it shows today. Active featured? Surface prioritizes them.
3. **Expiration is enforced** — promotional placements have a lifecycle. Expired placements are automatically deactivated.
4. **Monetization is first-class** — featured placement is a visibility/promotional revenue source. Pricing, billing, and renewal are part of the architecture, not an afterthought.
5. **Universal surface participation** — every product surface has equal opportunity to accommodate featured visibility. The `ActiveFeaturedResolver` is a universal service: any component calls `useActiveFeatured(tenantId, surface, { limit })` and gets active featured products for that surface. No surface is special-cased — the 3 initial channels are just the first to adopt the pattern. Storefront product grids, product detail pages, search results, category pages, related products, directory entries — all can participate by calling the same hook with their own surface identifier.

---

## Current State

### Surfaces That Can Become Visibility Channels

The architecture is universal — any product surface can participate. The table below shows all surfaces, grouped by adoption phase.

#### Phase 3 — Initial Channels (first wave)

| Surface | Current Behavior | File | Fallback (no active featured) |
|---------|-----------------|------|-------------------------------|
| **Storefront Spotlight** | Takes first 3 products from first bucket in `featuredData.buckets[0]` | `StorefrontEditorialLayout.tsx:458-550` | First bucket products (store_selection, new_arrival, etc.) |
| **Cross-Tenant Shops Page** | "Featured Products" section + "Featured Shops" section | `ShopsPageClient.tsx:1074-1143` | Trending shops, category-based featured |
| **Directory Home** | `FeaturedStoresList` + `RandomFeaturedProducts` in discovery sections | `DirectoryShell.tsx`, `DirectoryDiscoveryLayout.tsx`, `DirectoryEditorialLayout.tsx`, `DirectoryImmersiveLayout.tsx` | Algorithmic store ranking + random featured products |
| **Directory Featured** | `bucket_type = 'directory'` entries surfaced in directory views | `featured-products-scored.ts`, `directory-consolidated.ts` | Algorithmic directory scoring |

#### Future — Extended Channels (same pattern, same hook)

| Surface | Current Behavior | File | Fallback (no active featured) |
|---------|-----------------|------|-------------------------------|
| **Storefront Featured Sections** | Renders sections per badge type with type-specific styling | `StorefrontFeaturedProducts.tsx:180-305` | All non-featured badge type sections render normally |
| **Storefront Product Grid/List** | Grid/list view of all products with `SmartProductCard` | `ProductSection.tsx:700-750` | Existing sort order (newest, price, name) |
| **Product Detail Page** | Shows product info + related products | Product detail route | Related products by category/algorithm |
| **Search Results** | Product search with filters | Search route | Relevance scoring |
| **Category Pages** | Products filtered by category | Category route | Category-based product list |
| **Related Products** | Shows related items on product detail | Related products component | Category/algorithm-based related |
| **Directory Entry** | Individual store/tenant directory page | Directory detail route | Store info + product grid |

**Key point:** Extended channels use the exact same `useActiveFeatured(tenantId, surface, { limit })` hook. No new infrastructure needed — just a new surface identifier string and a fallback definition. The `ActiveFeaturedResolver` treats all surfaces identically: query active featured products for that surface, return them if they exist, return empty if they don't.

### Current Featured Lifecycle

```
Tenant requests featured access
  → Admin approves tenant (featured_access_approved = true)
    → Tenant assigns featured badge to product
      → Product enters pending approval (admin_approved = false)
        → Admin approves product (admin_approved = true)
          → Product is "active featured"
            → featured_expires_at passes → auto_unfeature deactivates
```

### What's Missing

- No registry flags for `requires_tenant_access`, `requires_admin_approval`, `is_promotional`
- No "active featured" resolution service — each surface computes it independently (or doesn't)
- No visibility channel abstraction — each surface has its own featured logic
- No monetization layer — no pricing, no billing integration, no renewal workflow
- No promotional analytics — badge analytics track performance but not placement ROI or channel lift

---

## Phase 1: Registry Elevation

**Goal:** Move all `featured`-specific flags into `featured_type_registry`. Eliminate hardcoded `type.id === 'featured'` checks.

### Schema Changes

Add 4 columns to `featured_type_registry`:

```sql
ALTER TABLE featured_type_registry
  ADD COLUMN IF NOT EXISTS requires_tenant_access  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_admin_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_promotional          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotional_priority    INT     DEFAULT 0;
```

Seed the `featured` type:

```sql
UPDATE featured_type_registry
  SET requires_tenant_access  = true,
      requires_admin_approval = true,
      is_promotional          = true,
      promotional_priority    = 100
  WHERE key = 'featured' AND tenant_id IS NULL;
```

All other system badge types default to `false` for all four columns.

### Code Changes

**`BadgeRegistryService.ts`** — Add the 4 fields to `BadgeTypeMeta` interface and `STATIC_BADGE_TYPES` fallback. The `featured` static entry gets `requiresTenantAccess: true, requiresAdminApproval: true, isPromotional: true, promotionalPriority: 100`.

**`FeaturedProductsManager.tsx`** — Replace:
```typescript
const isPayToPlay = type.id === 'featured' && (type as any).isPayToPlay;
const isLocked = isPayToPlay && !hasFeaturedAccess;
```
With:
```typescript
const isPromotional = type.requiresTenantAccess;
const isLocked = isPromotional && !hasFeaturedAccess;
```

Replace all `selectedType === 'featured' && !hasFeaturedAccess` checks with `currentType?.requiresTenantAccess && !hasFeaturedAccess`.

**`FeaturedProductsService.ts`** — In `addFeaturedType()`, set `admin_approved` based on the badge type's `requiresAdminApproval` flag:
```typescript
admin_approved: !badgeType.requiresAdminApproval, // auto-approve if no approval required
approved_at: !badgeType.requiresAdminApproval ? new Date() : null,
```

**Admin page (`featured-products/page.tsx`)** — Replace `featuredTypeOptions` array with `useSystemBadges()` hook. Replace `getFeaturedTypeStyle()` and `getFeaturedTypeLabel()` with `useBadgeMeta(key)`.

### Deliverables

- Migration: `065_featured_registry_promotional_flags.sql`
- Updated `BadgeRegistryService.ts` with 4 new fields
- Updated `FeaturedProductsManager.tsx` — zero hardcoded `featured` checks
- Updated `FeaturedProductsService.ts` — approval driven by registry
- Updated admin page — dynamic type filter from registry
- Updated Prisma schema

### Verification

- `pnpm checkapi` passes
- `pnpm checkweb` passes
- Admin page filter dropdown shows all system badge types from registry
- Tenant without featured access sees "Approval Required" for any badge type with `requiresTenantAccess = true`
- Products assigned a non-promotional badge type are auto-approved

---

## Phase 2: Active Featured Resolution Service

**Goal:** Create a single service that resolves "active featured" products per tenant per surface context. All visibility channels read from this service.

### Service Design

```typescript
// ActiveFeaturedResolver.ts

interface ActiveFeaturedQuery {
  tenantId: string;
  surface: 'storefront_spotlight' | 'cross_tenant_shops' | 'directory';
  limit?: number;
}

interface ActiveFeaturedResult {
  products: ActiveFeaturedProduct[];
  hasActive: boolean;
  fallbackUsed: boolean;
}

interface ActiveFeaturedProduct {
  // standard featured product fields +
  daysUntilExpiration: number;
  isExpiringSoon: boolean;
  promotionalPriority: number;
}
```

### Resolution Logic

```
1. Query featured_products WHERE
     tenant_id = :tenantId
     AND featured_type = 'featured'
     AND is_active = true
     AND admin_approved = true
     AND assignment_source = 'manual'
     AND (featured_expires_at IS NULL OR featured_expires_at > NOW())
   ORDER BY featured_priority DESC, featured_at ASC
   LIMIT :limit

2. If results → return { products, hasActive: true, fallbackUsed: false }

3. If no results → query fallback products based on surface:
   - storefront_spotlight → first bucket from getStorefrontFeaturedProducts (existing logic)
   - cross_tenant_shops → trending products across all tenants
   - directory → algorithmic directory scoring
   
   Return { products: fallback, hasActive: false, fallbackUsed: true }
```

### Caching

- 60-second in-memory cache per `(tenantId, surface)` pair
- Cache invalidated on: featured product create/update/delete, admin approval, expiration tick
- Follows the existing `TenantApiSingleton` pattern on the frontend

### Expiration Enforcement

Add a background job (`featured-expiration-enforcer.ts`) that runs every 5 minutes:
- Queries `featured_products WHERE featured_type = 'featured' AND is_active = true AND featured_expires_at IS NOT NULL AND featured_expires_at <= NOW()`
- Sets `is_active = false` for expired rows
- Emits `badge_events` for each expiration (event type: `featured_expired`)
- Invalidates `ActiveFeaturedResolver` cache for affected tenants

### Deliverables

- `apps/api/src/services/ActiveFeaturedResolver.ts`
- `apps/api/src/jobs/featured-expiration-enforcer.ts`
- `apps/web/src/services/ActiveFeaturedService.ts` (frontend singleton)
- Route: `GET /api/tenants/:tenantId/active-featured?surface=:surface&limit=:limit`
- Wired into server startup in `index.ts`

### Verification

- `GET /api/tenants/:tenantId/active-featured?surface=storefront_spotlight` returns active featured products when they exist
- Same endpoint returns fallback products when no active featured exist, with `fallbackUsed: true`
- Expiration enforcer deactivates expired featured products within 5 minutes of expiration
- Cache invalidation works on featured product CRUD operations

---

## Phase 3: Visibility Channel Priority

**Goal:** Update product surfaces to read from `ActiveFeaturedResolver` first, fall back to existing display logic. Phase 3 implements the 3 initial channels; the same pattern extends to any product surface.

### Universal Channel Pattern

Every visibility channel follows the same 3-step pattern — no surface is special-cased:

```typescript
// 1. Query active featured for this surface
const { data: activeFeatured } = useActiveFeatured(tenantId, 'any_surface_id', { limit: N });

// 2. Use active featured if they exist
const products = useMemo(() => {
  if (activeFeatured?.hasActive && activeFeatured.products.length > 0) {
    return activeFeatured.products;
  }
  // 3. Fall back to existing logic
  return existingProducts;
}, [activeFeatured, existingProducts]);
```

A surface becomes a visibility channel by:
1. Choosing a `surface` identifier (e.g., `'storefront_spotlight'`, `'search_results'`, `'product_detail_related'`)
2. Calling `useActiveFeatured` with that surface
3. Defining what the fallback is when no active featured products exist

That's it. No registry entry, no admin config, no new infrastructure. The surface identifier is just a string passed to the resolver — the resolver queries `featured_products` rows that have that surface in their `bucket_type` or placement metadata.

### Channel 1: Storefront Spotlight

**Current:** `StorefrontEditorialLayout.tsx` takes `featuredData.buckets[0].products.slice(0, 3)` for the spotlight section.

**New:**
```typescript
const { data: activeFeatured } = useActiveFeatured(tenantId, 'storefront_spotlight', { limit: 3 });

const spotlightProducts = useMemo(() => {
  if (activeFeatured?.hasActive && activeFeatured.products.length > 0) {
    return activeFeatured.products;
  }
  // Fallback: existing bucket logic
  if (!featuredData?.buckets?.[0]?.products) return [];
  return featuredData.buckets[0].products.slice(0, 3);
}, [activeFeatured, featuredData]);
```

When active featured products exist, the spotlight section header changes to "Premium Featured" with a Crown icon. When falling back, it shows the bucket type name as it does today.

### Channel 2: Cross-Tenant Shops Page

**Current:** `ShopsPageClient.tsx` has a "Featured Products" section that surfaces featured products across shops.

**New:** The section queries `ActiveFeaturedResolver` across all tenants (platform-level query, not tenant-scoped):
```
GET /api/active-featured?surface=cross_tenant_shops&limit=8
```

This returns active featured products from all tenants, ordered by `promotional_priority DESC, featured_priority DESC`. When no active featured products exist platform-wide, the section falls back to "Trending Products" (existing behavior).

### Channel 3: Directory Home

**Current:** The directory home page (`/directory`) renders `FeaturedStoresList` and `RandomFeaturedProducts` in discovery sections across 3 layout variants (discovery, editorial, immersive). All layouts share data via `useDirectoryData()` hook and `DirectoryShell` wrapper.

**New:** The directory home queries active featured products and stores at the platform level (not tenant-scoped):
```
GET /api/active-featured?surface=directory_home&limit=8
```

This returns active featured products from all tenants with `directory_home` surface placement, ordered by `promotional_priority DESC, featured_priority DESC`. When active featured exist, they appear in a premium hero-adjacent carousel or grid above the existing discovery sections. When none exist, the page falls back to the existing `FeaturedStoresList` (algorithmic) and `RandomFeaturedProducts` behavior.

**Premium positioning:** Directory home is the highest-traffic platform surface — the front door to all stores. Merchants pay a premium for placement here relative to cross-tenant shops or directory entry surfaces. The pricing model should reflect this tiering (see Phase 4).

**Multi-layout support:** All 3 layout variants receive the same active featured data via the shared `useDirectoryData()` hook. See the per-layout retrofit spec below for variant-specific integration points.

### Channel 4: Directory Entry Featured

**Current:** Directory entry pages (`/directory/[slug]`) use `featuredProducts` prop from `page.tsx` which fetches via `directoryService` and filters by merchant preferences.

**New:** Directory entry page first queries active featured products with `bucket_type = 'directory'`:
```
GET /api/active-featured?surface=directory_entry&tenantId=:tenantId&limit=6
```

When active featured directory products exist, they appear in a "Featured Stores" carousel at the top of the directory entry. When none exist, the page shows the algorithmic scoring results as it does today.

### Visual Treatment

Active featured products on any channel get:
- Crown icon overlay (existing `featured` type treatment)
- "Promoted" label in directory/shops context (transparency for paid placement)
- Distinct border or shadow treatment to visually separate from organic results

### Deliverables

- Updated `StorefrontEditorialLayout.tsx` — uses `useActiveFeatured` hook
- Updated `ShopsPageClient.tsx` — uses platform-level active featured query
- Updated `DirectoryShell.tsx` / `useDirectoryData.ts` — uses platform-level active featured query for directory home
- Updated directory entry `page.tsx` — uses active featured for "Featured Stores" carousel
- `useActiveFeatured` hook in `apps/web/src/hooks/useActiveFeatured.ts`
- Visual treatment components for active featured products
- Surface identifier registry (documentation, not code) — canonical list of surface IDs that channels use

### Extended Channel Adoption: Per-Layout Retrofit Spec

The 4 major surfaces — **storefront**, **product detail**, **directory home**, and **directory entry** — each have multiple layout variants. For every layout to be an equal-opportunity participant in featured visibility, each must be able to call `useActiveFeatured` and render active featured products. Some layouts are a natural fit inherent in their design; others require retrofits for alignment.

#### Surface 1: Storefront (3 layouts)

Layout selection: `resolveStorefrontLayout()` in `apps/web/src/app/products/[id]/layouts/types.ts` chooses between `classic`, `editorial`, and `immersive` based on `storefrontOptionFlags.storefrontLayout` or `?view=` preview param. All three share state via `useStorefrontState()` hook which already fetches `featuredData` from `FeaturedProductsSingleton`.

| Layout | File | Featured Surface | Natural Fit? | Retrofit Required |
|--------|------|-----------------|-------------|-------------------|
| **Classic** | `StorefrontClientWrapper.tsx` | `ProductSection.tsx` renders featured nav + product grid + `StorefrontFeaturedProducts` sections | **Yes** — already has `featuredData` and `allowedFeaturedTypes` in props. Product grid uses `SmartProductCard` which already renders featured badges. | **Minimal**: Add `useActiveFeatured(tenantId, 'storefront_classic', { limit: 3 })` call in `ProductSection.tsx` to prepend active featured products above the grid. Fallback: existing sort order. |
| **Editorial** | `StorefrontEditorialLayout.tsx` | Spotlight section (lines 458-550) takes `featuredData.buckets[0].products.slice(0, 3)` in hero grid. `FeaturedBucketsShowcase` renders bucket carousels below. | **Yes** — spotlight is purpose-built for featured products. Asymmetric hero grid is ideal for premium placement. | **None** — this is the Phase 3 Channel 1 implementation. Replace `featuredData.buckets[0].products.slice(0, 3)` with `useActiveFeatured(tenantId, 'storefront_spotlight', { limit: 3 })`. Fallback: existing bucket logic. |
| **Immersive** | `StorefrontImmersiveLayout.tsx` | "Trending Now" hero strip (line 343) + `FeaturedBucketsShowcase` tabbed sections (line 564). No spotlight section — uses compact product strip. | **Partial** — "Trending Now" strip is designed for product surfacing but uses `heroProducts` (all products), not featured-specific. | **Moderate**: Add `useActiveFeatured(tenantId, 'storefront_immersive', { limit: 4 })` and replace `heroProducts` in the trending strip when active featured exist. Rename strip header to "Featured" when active featured are present, "Trending Now" when falling back. Fallback: existing `heroProducts` from all products. |

**Shared infrastructure**: All 3 layouts use `useStorefrontState()` which already fetches `featuredData`. The `useActiveFeatured` hook can be added to `useStorefrontState` itself, making active featured data available to all 3 layouts without per-layout fetching. This is the recommended approach — add it once to the shared hook.

#### Surface 2: Product Detail (3 layouts)

Layout selection: `resolveProductLayout()` in `apps/web/src/app/products/[id]/layouts/types.ts` maps storefront layout to product layout: `classic→classic`, `editorial→showcase`, `immersive→quick-commerce`. All layouts receive `merchantFilteredFeaturedTypes` and `merchantFilteredGroupedProducts` from `page.tsx`.

The product page already renders `FeaturedProductsSection` at the bottom (line 878 of `page.tsx`) which shows `FeaturedTypeProducts` grouped by badge type. This section is layout-agnostic — it renders the same regardless of layout variant.

| Layout | File | Featured Surface | Natural Fit? | Retrofit Required |
|--------|------|-----------------|-------------|-------------------|
| **Classic** | `page.tsx` (inline, no separate layout file) | `FeaturedProductsSection` at bottom of page. Product grid is rendered inline. | **Yes** — `FeaturedProductsSection` already exists and renders featured products by type. | **Minimal**: Add `useActiveFeatured(tenantId, 'product_detail_classic', { limit: 4 })` and prepend an "Active Featured" carousel above the existing `FeaturedTypeProducts` sections. Fallback: existing `groupedProducts` by badge type. |
| **Showcase** | `ProductShowcaseLayout.tsx` | Two-column gallery + purchase panel. `FeaturedProductsSection` rendered below by `page.tsx`. No inline featured surface. | **Partial** — layout focuses on single product presentation. Featured products only appear in the bottom `FeaturedProductsSection`, which is rendered by `page.tsx` outside the layout component. | **None for layout component** — the `FeaturedProductsSection` is rendered by `page.tsx` and is layout-agnostic. The retrofit is the same as Classic: add `useActiveFeatured` to the `FeaturedProductsSection` component itself. |
| **Quick Commerce** | `ProductQuickCommerceLayout.tsx` | Compact sticky header + product info. `FeaturedProductsSection` rendered below by `page.tsx`. | **Partial** — layout is conversion-optimized, minimal real estate. Same as Showcase — featured products are in the bottom section rendered by `page.tsx`. | **None for layout component** — same as Showcase. The retrofit is in `FeaturedProductsSection`, not the layout. |

**Shared infrastructure**: All 3 product layouts share the same `FeaturedProductsSection` component rendered by `page.tsx`. The retrofit is a single change to `FeaturedProductsSection.tsx` — add `useActiveFeatured(tenantId, 'product_detail_featured', { limit: 4 })` and render an "Active Featured" carousel above the existing `FeaturedTypeProducts` when active featured exist. This single change covers all 3 product layouts.

**Additional product page surface — related products**: The product page does not currently have a "related products" section. When one is added in the future, it should call `useActiveFeatured(tenantId, 'product_detail_related', { limit: 4 })` with fallback to category-based products. Surface ID: `product_detail_related`.

#### Surface 3: Directory Home (3 layouts)

Layout selection: `resolveDirectoryLayout()` in `apps/web/src/components/directory/redesign/types.ts` chooses between `discovery`, `editorial`, and `immersive` based on `platformSettings.features.directoryHomeLayout` or `?layout_preview=` param. All three share data via `useDirectoryData()` hook and are rendered through `DirectoryShell` wrapper.

All 3 layouts already render `FeaturedStoresList` and `RandomFeaturedProducts` in discovery sections (only when no active query/filter is applied). The layouts differ in visual composition — discovery uses a 2-column filter rail + results grid, editorial uses full-bleed hero with curated rows, immersive uses map + results split view.

| Layout | File | Featured Surface | Natural Fit? | Retrofit Required |
|--------|------|-----------------|-------------|-------------------|
| **Discovery** | `DirectoryDiscoveryLayout.tsx` | `DirectoryHero` → `FeaturedStoresList` (limit 8) + `RandomFeaturedProducts` in discovery sections (lines 138-160). 2-column filter rail + results grid. | **Yes** — already has dedicated featured sections with `FeaturedStoresList` and `RandomFeaturedProducts`. Discovery sections only show when no active query, giving featured premium real estate. | **Minimal**: Add `useActiveFeatured(null, 'directory_home', { limit: 8 })` (platform-level, no tenant scope) to `useDirectoryData()` and expose `activeFeaturedProducts` in `DirectoryData`. Replace `RandomFeaturedProducts` with active featured carousel when active featured exist. Fallback: existing `RandomFeaturedProducts` + `FeaturedStoresList`. |
| **Editorial** | `DirectoryEditorialLayout.tsx` | Full-bleed `DirectoryHero` (420px min height) → "Featured Near You" section with `FeaturedStoresList` (limit 6) → `RandomFeaturedProducts` (lines 119-188). Magazine-style curated rows. | **Yes** — editorial layout is purpose-built for curation. "Featured Near You" section is ideal for active featured stores. Full-bleed hero provides premium real estate above the fold. | **Minimal**: Same shared hook approach as Discovery. Active featured products/stores replace the "Featured Near You" section content. Header changes to "Premium Featured" with Crown icon when active featured exist. Fallback: existing `FeaturedStoresList` + `RandomFeaturedProducts`. |
| **Immersive** | `DirectoryImmersiveLayout.tsx` | Map + results split view. `RandomFeaturedProducts` below results (line 161-165). No `FeaturedStoresList` — layout is conversion-focused with minimal discovery sections. | **Partial** — immersive layout prioritizes map+results interaction over discovery sections. No dedicated featured stores section. `RandomFeaturedProducts` exists but is below the fold. | **Moderate**: Add active featured carousel between the map/results split and the existing `RandomFeaturedProducts` section. When active featured exist, show a compact horizontal scroll carousel with "Promoted" labels. Fallback: existing `RandomFeaturedProducts` only. |

**Shared infrastructure**: All 3 layouts use `useDirectoryData()` hook via `DirectoryShell`. The `useActiveFeatured` call should be added to `useDirectoryData()` itself, making `activeFeaturedProducts` available in the `DirectoryData` object that all 3 layouts consume. This is the recommended approach — add it once to the shared hook, all 3 layouts benefit.

**Platform-level vs tenant-scoped**: Directory home is a platform-level surface — it is not tenant-scoped. The `useActiveFeatured` call uses `tenantId = null` (or a special `platform` scope) to query active featured products across all tenants. This is the same pattern as Channel 2 (Cross-Tenant Shops Page). The `ActiveFeaturedResolver` already supports platform-level queries.

**Premium tier positioning**: Directory home is the highest-traffic platform surface and commands a premium price point relative to other channels. The pricing model (Phase 4) should define a tier hierarchy:

| Tier | Surface | Relative Price | Reach |
|------|---------|---------------|-------|
| **Premium** | Directory Home | 3x base | All platform visitors |
| **Standard** | Cross-Tenant Shops Page | 2x base | Shops page visitors |
| **Standard** | Storefront Spotlight | 1x base | Per-tenant storefront visitors |
| **Basic** | Directory Entry | 0.5x base | Per-store directory page visitors |

#### Surface 4: Directory Entry (4 layouts)

Layout selection: `DirectoryEntryLayoutKey` in `apps/web/src/app/directory/[slug]/layouts/types.ts` supports `classic`, `editorial`, `immersive`, and `premium`. All layouts receive `featuredProducts` array from `page.tsx` which fetches via `directoryService` and filters by merchant preferences.

All 4 layouts render `featuredProducts` in a grid using `SmartProductCard` with `variant="featured"`. The rendering pattern is nearly identical across layouts — the difference is visual styling (background colors, typography, spacing).

| Layout | File | Featured Surface | Natural Fit? | Retrofit Required |
|--------|------|-----------------|-------------|-------------------|
| **Classic** | `DirectoryEntryClassicLayout.tsx` | Featured products grid (lines 200-270) grouped by product type, rendered with `SmartProductCard variant="featured"`. | **Yes** — already has a dedicated featured products section with type grouping. | **Minimal**: Add `useActiveFeatured(tenantId, 'directory_entry_classic', { limit: 6 })` and prepend active featured above the existing `featuredProducts` grid. Fallback: existing `featuredProducts` from directory service. |
| **Editorial** | `DirectoryEntryEditorialLayout.tsx` | Featured products section (lines 113-200) with product type grouping, same `SmartProductCard` pattern. | **Yes** — identical featured section pattern to Classic. | **Minimal**: Same as Classic — add `useActiveFeatured` call, prepend active featured. |
| **Immersive** | `DirectoryEntryImmersiveLayout.tsx` | Full-bleed dark hero. Featured products rendered in grid below hero. Same `SmartProductCard` pattern. | **Yes** — featured products section exists, just with dark theme styling. | **Minimal**: Same as Classic — add `useActiveFeatured` call, prepend active featured. |
| **Premium** | `DirectoryEntryPremiumLayout.tsx` | Stone-950 background with Crown icon header. Featured products rendered in grid. Same `SmartProductCard` pattern. | **Yes** — already has premium visual treatment (Crown icon, amber accents). Most natural fit for featured visibility. | **None** — layout is already designed for premium presentation. Add `useActiveFeatured` call and use active featured products as the primary grid content. Fallback: existing `featuredProducts`. |

**Shared infrastructure**: All 4 directory layouts receive `featuredProducts` as a prop from `directory/[slug]/page.tsx`. The `page.tsx` fetches featured products via `directoryService` and passes them to whichever layout is selected. The retrofit can be done **once in `page.tsx`** — call `useActiveFeatured(tenantId, 'directory_entry', { limit: 6 })` and merge/replace the `featuredProducts` prop before passing to the layout. This single change covers all 4 directory layouts.

#### Summary: Retrofit Effort Matrix

| Surface | Layouts | Shared Hook/Service | Retrofit Location | Effort |
|---------|---------|--------------------|-------------------|--------|
| Storefront | 3 (classic, editorial, immersive) | `useStorefrontState()` | Add `useActiveFeatured` to shared hook — all 3 layouts benefit | **Low** — 1 hook change + 1 layout tweak (immersive header) |
| Product Detail | 3 (classic, showcase, quick-commerce) | `FeaturedProductsSection` (rendered by `page.tsx`) | Add `useActiveFeatured` to `FeaturedProductsSection` — all 3 layouts benefit | **Low** — 1 component change |
| Directory Home | 3 (discovery, editorial, immersive) | `useDirectoryData()` via `DirectoryShell` | Add `useActiveFeatured` to shared hook — all 3 layouts benefit | **Low** — 1 hook change + 1 layout tweak (immersive carousel) |
| Directory Entry | 4 (classic, editorial, immersive, premium) | `page.tsx` passes `featuredProducts` prop | Add `useActiveFeatured` in `page.tsx` — all 4 layouts benefit | **Low** — 1 page-level change |

**Key insight**: Despite 13 total layout variants across 4 surfaces, the actual retrofit points are only **4** — one per surface — because each surface has a shared data-fetching layer that feeds all its layout variants. This is a direct consequence of the layout refactoring that extracted shared state into `useStorefrontState()`, `useDirectoryData()`, `page.tsx` data fetching, and shared props.

#### Other Product Surfaces (non-layout-dependent)

These surfaces are not layout variants but independent product-display surfaces that can adopt the pattern:

| Surface ID | Component | Fallback | Effort |
|-----------|-----------|----------|--------|
| `storefront_product_grid` | `ProductSection.tsx` | Existing sort order | **Low** — add `useActiveFeatured` call, prepend featured above grid |
| `search_results` | Search results component | Relevance scoring | **Medium** — requires search route to call `useActiveFeatured` |
| `category_page` | Category page component | Category product list | **Medium** — requires category route to call `useActiveFeatured` |
| `cross_tenant_shops` | `ShopsPageClient.tsx` | Trending shops | **Low** — Phase 3 Channel 2 implementation |

Each extended channel is a small PR: add `useActiveFeatured` call, define fallback, ship. No new services, no new tables, no new jobs.

### Verification

- Storefront spotlight shows active featured products when they exist, falls back to bucket logic when they don't
- Cross-tenant shops page shows active featured products from multiple tenants when they exist
- Directory home shows active featured products/stores in a premium carousel above discovery sections when they exist, falls back to `FeaturedStoresList` + `RandomFeaturedProducts` when they don't
- Directory entry page shows "Featured Stores" carousel with active featured tenants
- Fallback behavior is identical to current behavior when no active featured exist
- Expired featured products are removed from all channels within 5 minutes

---

## Phase 4: Monetization & Expiration

**Goal:** Featured placement is a promotional/visibility revenue source. Merchants purchase placement for a time-limited period. The platform tracks revenue and manages the lifecycle.

### Pricing Model

```sql
CREATE TABLE IF NOT EXISTS featured_placement_plans (
  id              VARCHAR(255) PRIMARY KEY,
  plan_key        VARCHAR(50) UNIQUE NOT NULL,    -- 'spotlight_7day', 'directory_30day', etc.
  label           VARCHAR(100) NOT NULL,
  surface         VARCHAR(50) NOT NULL,            -- 'storefront_spotlight', 'cross_tenant_shops', 'directory'
  duration_days   INT NOT NULL,
  price_cents     INT NOT NULL,
  currency        VARCHAR(3) DEFAULT 'USD',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

Seed plans:

| plan_key | label | surface | duration_days | price_cents |
|----------|-------|---------|---------------|-------------|
| `spotlight_7day` | Spotlight — 7 Days | storefront_spotlight | 7 | 1500 |
| `spotlight_30day` | Spotlight — 30 Days | storefront_spotlight | 30 | 5000 |
| `shops_7day` | Shops Featured — 7 Days | cross_tenant_shops | 7 | 2500 |
| `shops_30day` | Shops Featured — 30 Days | cross_tenant_shops | 30 | 8000 |
| `directory_30day` | Directory Featured — 30 Days | directory | 30 | 3000 |

### Purchase Flow

```
Merchant selects a product + a placement plan
  → POST /api/tenants/:tenantId/featured-placements
     { inventoryItemId, planKey }
  → Backend validates:
    - Tenant has featured_access_approved = true
    - Product exists and belongs to tenant
    - Product doesn't already have an active featured placement
  → Creates a checkout session (Stripe) for the plan price
  → On payment success (webhook):
    - Creates featured_products row with:
      featured_type = 'featured'
      assignment_source = 'manual'
      admin_approved = true (payment = approval)
      featured_expires_at = NOW() + plan.duration_days
      auto_unfeature = true
    - Emits badge_event: 'featured_placement_purchased'
```

### Key Design Decision: Payment = Approval

When a merchant pays for featured placement, the product is auto-approved (`admin_approved = true`). The admin approval workflow remains for **free featured placements** (editorial curation, promotional giveaways). This separates paid placements from curated ones:

- **Paid placement** — payment is the quality signal. Auto-approved. Has expiration.
- **Curated placement** — admin approval is the quality signal. Manually approved. May or may not have expiration.

### Renewal Workflow (Leveraging CRM Alerts)

The existing CRM alerts architecture handles all notification delivery — no new notification system is needed.

**How it works:**

The `featured-expiration-enforcer` job (from Phase 2) already runs every 5 minutes. It is extended to check for placements approaching expiration and creates CRM alerts via `CrmAlertService.create()`, following the same fire-and-forget pattern as `createOrderAlert()` and `createAbandonedCartAlert()`.

**Alert timeline:**

| Trigger | Alert Type | Title | Body | Icon |
|---------|-----------|-------|------|------|
| 3 days before expiration | `featured_placement_expiring` | Your featured placement expires in 3 days | "{product_name}" spotlight placement expires on {date}. Renew to keep it visible. | ⏰ |
| 1 day before expiration | `featured_placement_urgent` | Your featured placement expires tomorrow | "{product_name}" spotlight placement expires tomorrow. Renew now to avoid losing visibility. | ⚠️ |
| On expiration | `featured_placement_expired` | Featured placement expired | "{product_name}" spotlight placement has expired. The product is no longer in the spotlight channel. | ✅ |
| On purchase (payment success) | `featured_placement_active` | Featured placement is now live | "{product_name}" is now in the spotlight channel for {duration} days. Expires on {date}. | 🎉 |

**Alert metadata** (stored in `crm_alerts.metadata` JSONB):
```json
{
  "placement_id": "fp-{tk}-{nanoid}",
  "product_id": "inv-...",
  "product_name": "Blue Widget",
  "plan_key": "spotlight_7day",
  "surface": "storefront_spotlight",
  "expires_at": "2026-07-05T00:00:00Z",
  "duration_days": 7,
  "price_cents": 1500
}
```

**Delivery is automatic:**

- `CrmAlertToastWatcher` (mounted in tenant layout) polls every 30s and fires toast notifications for new alerts — no new UI component needed
- `CrmTenantCrmService.listAlerts()` already provides the API for listing, reading, and dismissing alerts
- The merchant's existing CRM widget on the tenant dashboard will show unread alert counts
- Alerts are tenant-scoped via `tenant_id`, consistent with all existing CRM alerts

**New method on `CrmAlertService`:**

```typescript
async createFeaturedPlacementAlert(params: {
  tenantId: string;
  placementId: string;
  productName: string;
  planKey: string;
  surface: string;
  expiresAt: Date;
  durationDays: number;
  priceCents: number;
  alertType: 'featured_placement_active' | 'featured_placement_expiring' | 'featured_placement_urgent' | 'featured_placement_expired';
}): Promise<void> {
  // Fire-and-forget — errors logged, never thrown
  // Follows same pattern as createOrderAlert() and createAbandonedCartAlert()
}
```

**Renewal flow:**

- Merchant sees the expiring/expired alert in their CRM toast or dashboard widget
- Alert includes a deep link to the renewal page: `/t/{tenantId}/settings/featured-options?renew={placementId}`
- `POST /api/tenants/:tenantId/featured-placements/:placementId/renew` creates a new Stripe checkout session
- On payment success: extends `featured_expires_at`, creates `featured_placement_active` alert, invalidates `ActiveFeaturedResolver` cache

**Why not email?**

CRM alerts are in-app and real-time (30s poll). Email can be added later as an additional delivery channel by extending `CrmAlertService` with an email sender — but the in-app alert is the primary notification mechanism, consistent with how order and abandoned cart alerts work today.

### Admin Controls

- Admin can grant free featured placements (bypassing payment) — existing approve workflow
- Admin can revoke any featured placement (sets `is_active = false`)
- Admin can see revenue dashboard: total placement revenue, revenue per surface, revenue per tenant

### Deliverables

- Migration: `066_featured_placement_plans.sql`
- `apps/api/src/services/FeaturedPlacementService.ts` — purchase, renew, revoke, revenue tracking
- `apps/api/src/routes/featured-placements.ts` — CRUD + checkout endpoints
- `apps/web/src/services/FeaturedPlacementService.ts` — frontend singleton
- `apps/web/src/app/t/[tenantId]/settings/featured-options/FeaturedPlacementClient.tsx` — purchase + renewal UI
- Stripe webhook handler for `featured_placement_purchased` event
- `CrmAlertService.createFeaturedPlacementAlert()` — new fire-and-forget method (follows `createOrderAlert` pattern)
- Extend `featured-expiration-enforcer.ts` (from Phase 2) to create expiration-warning alerts at 3-day and 1-day thresholds
- Admin revenue dashboard section

**Not needed (leveraging existing CRM alerts architecture):**
- ~~Renewal notification system (email + in-app)~~ — handled by `CrmAlertService` + `CrmAlertToastWatcher`
- ~~In-app notification banner~~ — handled by CRM toast notifications
- ~~Notification polling infrastructure~~ — `CrmAlertToastWatcher` already polls every 30s

### Verification

- Merchant can purchase a placement plan for a product
- On payment success, product appears in the relevant visibility channel and a `featured_placement_active` CRM alert is created
- Merchant sees the activation alert as a toast notification (via existing `CrmAlertToastWatcher`)
- 3 days before expiration, a `featured_placement_expiring` alert is created and delivered as a toast
- 1 day before expiration, a `featured_placement_urgent` alert is created and delivered as a toast
- On expiration, product is removed from channel and a `featured_placement_expired` alert is created
- Renewal extends the expiration date and creates a new `featured_placement_active` alert
- Admin can grant free placements and revoke any placement
- Revenue dashboard shows accurate totals
- All placement alerts appear in the merchant's CRM widget unread count
- Alerts can be read and dismissed via existing CRM alert endpoints

---

## Phase 5: Promotional Analytics

**Goal:** Measure the ROI of featured placements — for merchants (did it drive outcomes?) and for the platform (revenue + engagement lift).

### Metrics

**Per-placement metrics:**
- Placement duration (purchased vs actual — was it revoked early?)
- Views during placement (from `badge_events` where `badge_key = 'featured'` and `event_type = 'view'`)
- CTR during placement
- Conversion rate during placement
- Revenue attributed to placement (orders with `featured` badge during placement period)
- Lift over baseline (compare same product's metrics 7 days before vs during placement)

**Platform-level metrics:**
- Total placement revenue (per surface, per period)
- Placement utilization (what % of available slots are sold?)
- Average placement duration vs purchased duration
- Renewal rate
- Top-performing surfaces by revenue
- Top-performing tenants by placement spend

### Dashboard

Add a "Promotional Placements" tab to the existing badge analytics dashboard at `/t/[tenantId]/settings/products/badges/analytics`:

- **Merchant view:** "Your Placements" table with per-placement ROI, lift over baseline, and renewal CTA
- **Admin view:** "Platform Revenue" table with total revenue, utilization, and top spenders

### API Endpoints

```
GET /api/tenants/:tenantId/featured-placements/analytics
  → per-placement metrics for this tenant

GET /api/admin/featured-placements/analytics
  → platform-level revenue and utilization metrics
```

### Deliverables

- `apps/api/src/services/FeaturedPlacementAnalyticsService.ts`
- Analytics API endpoints
- Dashboard tab in `BadgeAnalyticsClient.tsx`
- Lift calculation logic (baseline vs placement period)

### Verification

- Merchant analytics shows per-placement ROI with lift calculation
- Admin analytics shows platform revenue totals
- Lift calculation correctly compares pre-placement vs during-placement metrics
- Analytics update within 6 hours (existing aggregation job cadence)

---

## Phase Map

| Phase | What Gets Built | Key Insight |
|-------|----------------|-------------|
| 1 — Registry Elevation | 4 new columns on `featured_type_registry`, hardcoded checks replaced | The last hardcoded badge type check is eliminated. All special behavior is data-driven. |
| 2 — Active Featured Resolution | `ActiveFeaturedResolver` service, expiration enforcer job | One service defines what "active" means. All channels read from it. |
| 3 — Visibility Channel Priority | 3 premium surfaces updated with priority + fallback | Channels gracefully degrade. No active featured? Same UX as today. |
| 4 — Monetization & Expiration | Placement plans, checkout, renewal, admin controls | Payment = approval for paid placements. Admin approval remains for curated placements. |
| 5 — Promotional Analytics | Per-placement ROI, platform revenue, lift over baseline | Analytics close the loop on monetization. Merchants see if they got their money's worth. |

---

## Architecture Diagram

```
                    featured_type_registry
                    ┌─────────────────────────┐
                    │ key: 'featured'          │
                    │ requires_tenant_access   │
                    │ requires_admin_approval  │
                    │ is_promotional           │
                    │ promotional_priority     │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  ActiveFeaturedResolver   │
                    │  (backend service)        │
                    │  - resolves active state  │
                    │  - 60s cache per surface  │
                    └───────────┬─────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                     │
    ┌──────▼──────┐    ┌───────▼───────┐    ┌───────▼───────┐
    │ Storefront   │    │ Cross-Tenant  │    │ Directory     │
    │ Spotlight    │    │ Shops Page    │    │ Featured      │
    │ (Channel 1)  │    │ (Channel 2)   │    │ (Channel 3)   │
    └──────┬──────┘    └───────┬───────┘    └───────┬───────┘
           │                    │                     │
           │  No active featured? Fallback to:        │
           │  bucket[0] products │ trending shops │ directory scoring
           └────────────────────┴─────────────────────┘

    ┌─────────────────────────────────────────────────┐
    │  FeaturedPlacementService                        │
    │  - purchase plan → Stripe checkout               │
    │  - payment success → create featured_products    │
    │  - expiration enforcer → deactivate              │
    │  - renewal → extend expiration                   │
    └──────────────────────┬──────────────────────────┘
                           │
    ┌──────────────────────▼──────────────────────────┐
    │  FeaturedPlacementAnalyticsService              │
    │  - per-placement ROI (views, CTR, conversion)   │
    │  - lift over baseline (pre vs during)           │
    │  - platform revenue (per surface, per period)   │
    └─────────────────────────────────────────────────┘
```

---

## Relationship to Existing Architecture

| Existing Component | Relationship |
|-------------------|-------------|
| `featured_type_registry` | Extended with 4 new columns (Phase 1) |
| `featured_products` | No schema change — `admin_approved`, `featured_expires_at`, `assignment_source` already exist |
| `BadgeRegistryService` | Extended with new fields in `BadgeTypeMeta` |
| `BadgeAnalyticsService` | Extended with promotional placement analytics (Phase 5) |
| `FeaturedProductsService` | `addFeaturedType` reads registry flags for approval behavior |
| `FeaturedProductsManager` | Replaces hardcoded `featured` checks with registry flags |
| `AdminFeaturedApprovalService` | Unchanged — admin approval workflow remains for curated placements |
| `TenantFeaturedAccessService` | Unchanged — tenant access check now driven by `requiresTenantAccess` flag |
| `platform-badge-sync.ts` | Unchanged — platform types (trending, bestseller, etc.) are not promotional |
| `badge-analytics-sync.ts` | Extended to aggregate promotional placement metrics (Phase 5) |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Paid placements crowd out organic featured products | Channels fall back to organic when no paid placements exist. Paid placements have priority but don't eliminate organic. |
| Merchants abuse free curated placements | Admin approval workflow remains for free placements. Admin can set quotas or disable free placements. |
| Expiration enforcer fails | Job runs every 5 minutes. `ActiveFeaturedResolver` also checks `featured_expires_at > NOW()` at query time, so even if the job is delayed, expired products won't appear in channels. |
| Stripe webhook delayed | Product isn't created as featured until webhook fires. Merchant sees "pending" state. Webhook retry logic handles transient failures. |
| Channel performance degrades with many active featured | `limit` parameter on `ActiveFeaturedResolver` caps results per channel. Platform can control how many paid placements appear per surface. |

---

## Open Questions

1. **Should multiple promotional badge types exist?** The design supports it via `is_promotional = true` on any registry entry, but the initial implementation only seeds `featured`. Future types could include "sponsored" or "promoted" with different channel priorities.

2. **Should placement plans be tenant-tier-aware?** E.g., enterprise tenants get discounted placement rates. This could be added to `featured_placement_plans` as a `tier_multiplier` column or by creating tier-specific plan keys.

3. **Should the cross-tenant shops channel show "Promoted" labels?** Transparency for paid placement is a best practice. The design includes this but it should be confirmed from a product perspective.

4. **Should free curated placements have expiration?** Currently they can have `featured_expires_at = NULL` (no expiration). The design preserves this. Admin can set expiration on curated placements if desired.

---

## Extension: Featured Store — Self-Service Placement Marketplace

### Inspiration

The platform already has two self-service purchase patterns:

1. **Subscription Store** (`/settings/subscription`) — self-serve tier management with Stripe billing
2. **BSaaS Feature Store** (`/settings/feature-store`) — self-serve à la carte feature purchases with Stripe billing, daily renewal job, and admin catalog management

Both follow the same architectural pattern: catalog table → self-service checkout → Stripe charge → `tenant_*_purchases` table → automated renewal → CRM/billing notifications → admin catalog CRUD.

Featured placements are the natural third product line. Instead of building a separate purchase system in Phase 4, the Featured Store extends the BSAAS pattern to placement purchases.

### Pattern Mapping: BSAAS → Featured Store

| BSAAS Component | Featured Store Equivalent | Reuse Level |
|----------------|--------------------------|-------------|
| `bsaas_catalog` table | `featured_placement_catalog` table | Same pattern, new table |
| `tenant_feature_purchases` table | `featured_placement_purchases` table | Same pattern, new table |
| `POST /api/subscription/feature-purchase` | `POST /api/subscription/featured-placement-purchase` | Same flow, new route |
| `GET /api/subscription/feature-catalog` | `GET /api/subscription/featured-placement-catalog` | Same pattern, new route |
| `bsaas-renewal.ts` daily job | `featured-placement-renewal.ts` daily job | Same pattern, new job |
| `BillingNotificationService` bsaas_* types | `featured_placement_*` notification types | Extended |
| `CrmAlertService.createOrderAlert()` | `CrmAlertService.createFeaturedPlacementAlert()` | Extended (Phase 4) |
| `/settings/feature-store` page | `/settings/featured-store` page | Same UX pattern, new page |
| `BsaasPurchaseService.ts` (frontend) | `FeaturedPlacementPurchaseService.ts` (frontend) | Same pattern, new service |
| `admin/bsaas-catalog.ts` (admin CRUD) | `admin/featured-placement-catalog.ts` (admin CRUD) | Same pattern, new route |
| `AdminBsaasCatalogService.ts` | `AdminFeaturedPlacementCatalogService.ts` | Same pattern, new service |
| `BsaasCatalogManagement.tsx` (admin UI) | `FeaturedPlacementCatalogManagement.tsx` (admin UI) | Same pattern, new component |
| `SubscriptionBillingService.chargePaymentMethod()` | Reused directly | **100% reuse** |
| `SubscriptionBillingService.getOrCreateStripeCustomer()` | Reused directly | **100% reuse** |
| Stripe webhook handler | Extended with `featured_placement_*` events | Extended |
| `EffectiveCapabilityResolver` | Not needed — placements use `ActiveFeaturedResolver` instead | N/A |

### Phase 6: Featured Placement Catalog & Admin Management

**Goal:** Create the catalog table and admin CRUD, mirroring `bsaas_catalog`.

#### Schema

```sql
CREATE TABLE IF NOT EXISTS featured_placement_catalog (
  id              VARCHAR(255) PRIMARY KEY,
  plan_key        VARCHAR(50) UNIQUE NOT NULL,    -- 'spotlight_7day', 'directory_30day', etc.
  marketing_name  VARCHAR(255) NOT NULL,           -- "Spotlight — 7 Days"
  marketing_description TEXT,                      -- "Your product in the storefront spotlight hero section"
  surface         VARCHAR(50) NOT NULL,            -- 'storefront_spotlight', 'cross_tenant_shops', 'directory'
  duration_days   INT NOT NULL,
  price_cents     INT NOT NULL,
  currency        VARCHAR(3) DEFAULT 'USD',
  billing_cycle   VARCHAR(20) DEFAULT 'one_time',  -- 'one_time' or 'monthly' (for auto-renewing placements)
  icon_name       VARCHAR(100),                    -- icon identifier for UI
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  trial_days      INT DEFAULT 0,                   -- free trial before first charge (mirrors BSAAS E3)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

This replaces the simpler `featured_placement_plans` table from Phase 4. The catalog is richer, supporting marketing copy, trial days, billing cycles, and sort order — exactly like `bsaas_catalog`.

#### Purchase Tracking Table

```sql
CREATE TABLE IF NOT EXISTS featured_placement_purchases (
  id              VARCHAR(255) PRIMARY KEY,
  tenant_id       VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalog_id      VARCHAR(255) NOT NULL REFERENCES featured_placement_catalog(id),
  inventory_item_id VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'suspended', 'expired', 'cancelled', 'past_due'
  source          VARCHAR(50) NOT NULL DEFAULT 'self_serve', -- 'self_serve', 'admin_grant', 'promo', 'comp'
  purchased_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,                       -- NULL = never expires (admin grants)
  auto_renew      BOOLEAN DEFAULT false,
  metadata        JSONB,                             -- { payment_method_id, price_cents, stripe_charge_id, billing_cycle, ... }
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, catalog_id, inventory_item_id)
);
```

This mirrors `tenant_feature_purchases` but is placement-specific (includes `inventory_item_id` and `catalog_id`).

#### Admin CRUD

Mirror `admin/bsaas-catalog.ts` exactly:
- `GET /api/admin/featured-placement-catalog` — list all catalog entries
- `POST /api/admin/featured-placement-catalog` — create entry
- `PUT /api/admin/featured-placement-catalog/:id` — update entry
- `DELETE /api/admin/featured-placement-catalog/:id` — deactivate entry

Admin UI at `/settings/admin/featured-placement-catalog` with `FeaturedPlacementCatalogManagement.tsx` component, mirroring `BsaasCatalogManagement.tsx`.

#### Deliverables

- Migration: `067_featured_placement_catalog.sql`
- `apps/api/src/routes/admin/featured-placement-catalog.ts` — admin CRUD
- `apps/web/src/services/AdminFeaturedPlacementCatalogService.ts` — admin frontend service
- `apps/web/src/admin/components/FeaturedPlacementCatalogManagement.tsx` — admin UI
- `apps/web/src/app/(platform)/settings/admin/featured-placement-catalog/page.tsx` — admin page
- Navigation links added to admin sidebar (via database `navigation_links` table)

---

### Phase 7: Self-Service Featured Store

**Goal:** Merchant-facing self-service purchase page, mirroring `/settings/feature-store`.

#### Purchase API

Mirror `bsaas-purchases.ts`:

```
GET  /api/subscription/featured-placement-catalog
  → Returns catalog entries with surface descriptions and tier-aware pricing

GET  /api/subscription/featured-placement-purchases
  → Lists tenant's active placement purchases

POST /api/subscription/featured-placement-purchase
  → Self-service purchase: { catalogId, inventoryItemId, paymentMethodId }
  → Validates: tenant has featured_access_approved, product belongs to tenant, no active placement for same product+surface
  → Charges via SubscriptionBillingService.chargePaymentMethod() (reused)
  → Creates featured_placement_purchases row
  → Creates featured_products row (featured_type='featured', admin_approved=true, featured_expires_at=NOW()+duration_days)
  → Invalidates ActiveFeaturedResolver cache
  → BillingNotificationService.sendNotification({ type: 'featured_placement_purchase_success' })
  → CrmAlertService.createFeaturedPlacementAlert({ alertType: 'featured_placement_active' })

POST /api/subscription/featured-placement-purchase/:id/cancel
  → Cancels auto-renew (if monthly), sets status='cancelled'
  → Does NOT immediately remove from channel — placement runs until expires_at
  → CrmAlertService.createFeaturedPlacementAlert({ alertType: 'featured_placement_cancelled' })

POST /api/subscription/featured-placement-purchase/:id/renew
  → Creates a new Stripe charge for the next period
  → Extends featured_expires_at
  → Updates featured_placement_purchases.expires_at
  → Invalidates ActiveFeaturedResolver cache
```

#### Frontend Featured Store Page

**Route**: `/settings/featured-store` (mirrors `/settings/feature-store`)

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Featured Store                                          │
│  Boost your products with premium placement              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Spotlight   │  │  Shops      │  │  Directory  │     │
│  │  7 Days      │  │  Featured   │  │  Featured   │     │
│  │  $15         │  │  7 Days     │  │  30 Days    │     │
│  │              │  │  $25        │  │  $30        │     │
│  │  [Select]    │  │  [Select]   │  │  [Select]   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                          │
│  ── Your Active Placements ──                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Blue Widget — Spotlight (expires Jul 5) [Renew]  │   │
│  │ Red Gadget — Directory (expires Jul 28) [Renew]  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ── Payment Method ──                                   │
│  [•••• 4242]  [Add new card]                            │
│                                                          │
│  [Confirm Purchase]                                     │
└─────────────────────────────────────────────────────────┘
```

**Product selection**: When a catalog entry is selected, show a product picker (tenant's inventory items) to choose which product to feature.

**Tier-aware display** (mirrors BSAAS):
- If tenant's tier includes free placements → show "Included in plan" with usage counter
- If tenant doesn't have `featured_access_approved` → show "Approval Required" with CTA to request access
- Otherwise → show price and "Select" button

#### Frontend Service

`apps/web/src/services/FeaturedPlacementPurchaseService.ts` — singleton extending `TenantApiSingleton`, mirroring `BsaasPurchaseService.ts`:
- `getCatalog()` → `GET /api/subscription/featured-placement-catalog`
- `getPurchases()` → `GET /api/subscription/featured-placement-purchases`
- `purchase(catalogId, inventoryItemId, paymentMethodId)` → `POST .../featured-placement-purchase`
- `cancel(purchaseId)` → `POST .../featured-placement-purchase/:id/cancel`
- `renew(purchaseId)` → `POST .../featured-placement-purchase/:id/renew`

#### Deliverables

- `apps/api/src/routes/featured-placement-purchases.ts` — tenant-facing purchase API
- `apps/web/src/services/FeaturedPlacementPurchaseService.ts` — frontend singleton
- `apps/web/src/app/(platform)/settings/featured-store/page.tsx` — Featured Store page
- `apps/web/src/app/(platform)/settings/featured-store/FeaturedStoreClient.tsx` — client component
- Navigation link in tenant sidebar (via database `navigation_links` table)
- `BillingNotificationService` extended with `featured_placement_*` notification types

---

### Phase 8: Automated Renewal & Lifecycle Management

**Goal:** Daily renewal job mirroring `bsaas-renewal.ts`, plus grace period and trial support.

#### Renewal Job

`apps/api/src/jobs/featured-placement-renewal.ts` — runs daily at midnight, mirroring `bsaas-renewal.ts`:

```
1. Find active purchases where auto_renew=true AND expires_at <= now+24h
2. For each expiring purchase:
   a. Read payment_method_id from purchase metadata
   b. Re-charge via SubscriptionBillingService.chargePaymentMethod() (reused)
   c. On success:
      - Extend expires_at by duration_days
      - Update featured_products.featured_expires_at
      - Invalidate ActiveFeaturedResolver cache
      - BillingNotificationService.sendNotification({ type: 'featured_placement_renewal_success' })
      - CrmAlertService.createFeaturedPlacementAlert({ alertType: 'featured_placement_active' })
   d. On failure:
      - Set status='past_due' (grace period, mirrors BSAAS E2)
      - BillingNotificationService.sendNotification({ type: 'featured_placement_renewal_failed' })
      - CRM alert: "Payment failed — placement enters grace period"
3. Expire cancelled purchases past their expires_at (status → 'expired')
4. Deactivate featured_products for expired placements
5. Suspend past_due purchases whose grace period (7 days) has elapsed (status → 'suspended')
6. Deactivate featured_products for suspended placements
```

#### Grace Period (mirrors BSAAS E2)

- On renewal failure: `status='past_due'`, placement remains active for 7 days
- Daily retry during grace period (same as BSAAS)
- After 7 days: `status='suspended'`, `featured_products.is_active = false`
- Merchant can update payment method to reactivate

#### Trial Support (mirrors BSAAS E3)

- `trial_days` on catalog entries (e.g., "1 day free trial")
- On purchase with trial: no charge for trial period, `expires_at = NOW() + trial_days`
- When trial expires: first charge via renewal job, then `expires_at = NOW() + duration_days`
- If trial payment fails: `status='past_due'`, grace period applies

#### Expiration Enforcer Integration

The `featured-expiration-enforcer.ts` job from Phase 2 is simplified — it no longer needs to create expiration-warning alerts itself. Instead:

- **Renewal job** handles expiration for auto-renewing placements (re-charges before expiry)
- **Expiration enforcer** handles non-renewing placements (one-time purchases that expire):
  - 3 days before: `CrmAlertService.createFeaturedPlacementAlert({ alertType: 'featured_placement_expiring' })`
  - 1 day before: `CrmAlertService.createFeaturedPlacementAlert({ alertType: 'featured_placement_urgent' })`
  - On expiration: deactivate `featured_products`, `CrmAlertService.createFeaturedPlacementAlert({ alertType: 'featured_placement_expired' })`

#### Deliverables

- `apps/api/src/jobs/featured-placement-renewal.ts` — daily renewal job
- Grace period logic (mirrors BSAAS E2)
- Trial support (mirrors BSAAS E3)
- Updated `featured-expiration-enforcer.ts` — handles non-renewing placements only
- `BillingNotificationService` extended with `featured_placement_renewal_success`, `featured_placement_renewal_failed`, `featured_placement_cancelled` notification types
- Wired into server startup in `index.ts`

---

### Phase 9: Featured Store Analytics & Revenue Dashboard

**Goal:** Extend Phase 5 analytics with store-level revenue metrics, mirroring BSAAS E4 revenue dashboard.

#### Merchant View

Add "Placement Store" tab to the existing analytics dashboard at `/t/[tenantId]/settings/products/badges/analytics`:

- **Purchase history** — all placement purchases with status, price, date, surface
- **Active placements** — current placements with days remaining and renewal status
- **Spend summary** — total spend per surface, per month
- **ROI per placement** — revenue attributed vs placement cost (from Phase 5)
- **Renewal rate** — what % of placements were renewed vs expired

#### Admin Revenue Dashboard

Mirror BSAAS E4 revenue analytics at `/settings/admin/featured-placement-revenue`:

- **Total placement revenue** — MRR, ARR from auto-renewing placements
- **One-time placement revenue** — total from one-time purchases
- **Revenue per surface** — spotlight vs shops vs directory
- **Revenue per catalog entry** — which plans sell best
- **Utilization rate** — active placements / available slots per surface
- **Trial conversion rate** — what % of trials convert to paid
- **Churn rate** — what % of placements are not renewed
- **Top spenders** — tenants by total placement spend

#### API Endpoints

```
GET /api/tenants/:tenantId/featured-placements/store-analytics
  → merchant's purchase history, spend summary, ROI

GET /api/admin/featured-placements/revenue-analytics
  → platform revenue, utilization, churn, trial conversion
```

#### Deliverables

- `apps/api/src/services/FeaturedPlacementStoreAnalyticsService.ts`
- Analytics API endpoints (merchant + admin)
- Merchant "Placement Store" tab in `BadgeAnalyticsClient.tsx`
- Admin revenue dashboard page at `/settings/admin/featured-placement-revenue`
- `apps/web/src/app/(platform)/settings/admin/featured-placement-revenue/page.tsx`

---

### Updated Phase Map (with Featured Store Extension)

| Phase | What Gets Built | Key Insight |
|-------|----------------|-------------|
| 1 — Registry Elevation | 4 new columns on `featured_type_registry`, hardcoded checks replaced | The last hardcoded badge type check is eliminated. All special behavior is data-driven. |
| 2 — Active Featured Resolution | `ActiveFeaturedResolver` service, expiration enforcer job | One service defines what "active" means. All channels read from it. |
| 3 — Visibility Channel Priority | 3 premium surfaces updated with priority + fallback | Channels gracefully degrade. No active featured? Same UX as today. |
| 4 — Monetization & Expiration | Placement plans, checkout, renewal, CRM alerts, admin controls | Payment = approval for paid placements. Admin approval remains for curated placements. |
| 5 — Promotional Analytics | Per-placement ROI, platform revenue, lift over baseline | Analytics close the loop on monetization. Merchants see if they got their money's worth. |
| 6 — Featured Placement Catalog | `featured_placement_catalog` table, admin CRUD, admin UI | Catalog mirrors `bsaas_catalog`. Admin manages placement products and pricing. |
| 7 — Self-Service Featured Store | Merchant purchase page, Stripe checkout, product picker | Mirrors BSAAS Feature Store. Self-service checkout with saved payment methods. |
| 8 — Automated Renewal & Lifecycle | Daily renewal job, grace period, trial support, expiration alerts | Mirrors `bsaas-renewal.ts`. Auto-renew, grace period, trials — all reuse BSAAS patterns. |
| 9 — Store Analytics & Revenue | Merchant spend summary, admin revenue dashboard, churn/trial metrics | Mirrors BSAAS E4. Revenue is a first-class metric, not an afterthought. |

---

### Architecture: Three Self-Service Stores

```
    ┌──────────────────────────────────────────────────────────┐
    │  Platform Self-Service Stores                             │
    │                                                           │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
    │  │ Subscription │  │  BSaaS      │  │  Featured   │       │
    │  │ Store        │  │  Feature    │  │  Placement  │       │
    │  │              │  │  Store      │  │  Store      │       │
    │  │ /settings/   │  │ /settings/  │  │ /settings/  │       │
    │  │ subscription │  │ feature-    │  │ featured-   │       │
    │  │              │  │ store       │  │ store       │       │
    │  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘       │
    │         │                 │                │               │
    │         ▼                 ▼                ▼               │
    │  ┌──────────────────────────────────────────────────┐     │
    │  │  SubscriptionBillingService (shared)              │     │
    │  │  - getOrCreateStripeCustomer()                    │     │
    │  │  - chargePaymentMethod()                          │     │
    │  │  - getPaymentMethodById()                         │     │
    │  └──────────────────────────────────────────────────┘     │
    │         │                 │                │               │
    │         ▼                 ▼                ▼               │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
    │  │ tenants     │  │ tenant_     │  │ featured_   │       │
    │  │ subscription│  │ feature_    │  │ placement_  │       │
    │  │ _tier       │  │ purchases   │  │ purchases   │       │
    │  └─────────────┘  └─────────────┘  └─────────────┘       │
    │         │                 │                │               │
    │         ▼                 ▼                ▼               │
    │  ┌──────────────────────────────────────────────────┐     │
    │  │  BillingNotificationService (shared)              │     │
    │  │  + CrmAlertService (shared)                       │     │
    │  │  - Email, CRM alerts, CRM tasks                   │     │
    │  └──────────────────────────────────────────────────┘     │
    │         │                 │                │               │
    │         ▼                 ▼                ▼               │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
    │  │ Tier        │  │ Effective   │  │ Active      │       │
    │  │ features    │  │ Capability  │  │ Featured    │       │
    │  │ resolver    │  │ Resolver    │  │ Resolver    │       │
    │  └─────────────┘  └─────────────┘  └─────────────┘       │
    └──────────────────────────────────────────────────────────┘
```

Each store sells a different product line (tiers, features, placements) but shares the same billing, notification, and CRM infrastructure. The only store-specific code is the catalog table, the purchase table, and the resolver that consumes the purchase.

---

### Updated Relationship to Existing Architecture

| Existing Component | Relationship |
|-------------------|-------------|
| `featured_type_registry` | Extended with 4 new columns (Phase 1) |
| `featured_products` | No schema change — `admin_approved`, `featured_expires_at`, `assignment_source` already exist |
| `BadgeRegistryService` | Extended with new fields in `BadgeTypeMeta` |
| `BadgeAnalyticsService` | Extended with promotional placement analytics (Phase 5) + store analytics (Phase 9) |
| `FeaturedProductsService` | `addFeaturedType` reads registry flags for approval behavior |
| `FeaturedProductsManager` | Replaces hardcoded `featured` checks with registry flags |
| `AdminFeaturedApprovalService` | Unchanged — admin approval workflow remains for curated placements |
| `TenantFeaturedAccessService` | Unchanged — tenant access check now driven by `requiresTenantAccess` flag |
| `platform-badge-sync.ts` | Unchanged — platform types (trending, bestseller, etc.) are not promotional |
| `badge-analytics-sync.ts` | Extended to aggregate promotional placement metrics (Phase 5) |
| **`SubscriptionBillingService`** | **Reused directly** — `chargePaymentMethod()`, `getOrCreateStripeCustomer()` (Phases 7-8) |
| **`BillingNotificationService`** | **Extended** with `featured_placement_*` notification types (Phases 7-8) |
| **`CrmAlertService`** | **Extended** with `createFeaturedPlacementAlert()` (Phase 4) |
| **`CrmAlertToastWatcher`** | **Reused directly** — delivers placement alerts as toasts (Phase 4) |
| **`stripe-webhooks.ts`** | **Extended** with `featured_placement_*` event handlers (Phase 7) |
| **BSaaS Feature Store** | **Pattern reference** — Featured Store mirrors its architecture (Phases 6-9) |
| **`bsaas-renewal.ts`** | **Pattern reference** — `featured-placement-renewal.ts` mirrors its logic (Phase 8) |
| **`bsaas_catalog` table** | **Pattern reference** — `featured_placement_catalog` mirrors its schema (Phase 6) |
