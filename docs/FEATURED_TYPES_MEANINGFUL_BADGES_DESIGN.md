# Featured Types → Meaningful Badges — Design Document

## Problem Statement

The platform's featured products architecture has 11 badge types, a management page for tenants, admin pages, and sections on storefront and product pages. Two fundamental problems exist:

**1. Architectural rigidity** — Badge types are hardcoded as arrays, switch statements, and record literals across 12+ files in both frontend and backend. Adding a new badge type or supporting custom merchant badges requires touching every layer: display cards, buckets, storefront sections, capability resolvers, the MV aggregation, and bot search. The `featured_products` table itself is flexible (varchar `featured_type` column accepts any key), but everything around it is rigid.

**2. No behavioral weight** — All featured types are purely decorative labels with no semantic contract. A merchant can tag a product as "Sale" without a sale price, "Clearance" with full stock, or "New Arrival" on a year-old product. There is no validation, no auto-assignment, no customer-facing filtering, no analytics, and no cross-badge intelligence.

This document captures the gap analysis and a phased plan to make featured types **meaningful, impactful, and useful for merchants** — starting with the architectural foundation that makes everything else possible.

---

## Current Architecture

### Badge Types (11 total)

**Tenant-controlled** (merchants tag their own products):

| Type | Label | Intended Meaning |
|------|-------|-----------------|
| `store_selection` | Store Selection | Hand-picked by store owner |
| `new_arrival` | New Arrival | Recently added products |
| `seasonal` | Seasonal | Seasonal or holiday products |
| `sale` | Sale | Products currently on sale |
| `staff_pick` | Staff Pick | Recommended by store staff |
| `clearance` | Clearance | Final sale, while supplies last |
| `featured` | Featured | General featured / premium placement |

**Platform-controlled** (algorithmic, system-driven):

| Type | Label | Intended Meaning |
|------|-------|-----------------|
| `bestseller` | Bestseller | Top-selling products |
| `trending` | Trending | Gaining popularity right now |
| `recommended` | Recommended | Personalized recommendations |
| `random_featured` | Random Featured | Randomly selected featured products |

### Storage

- **`featured_products`** junction table (`schema.prisma:1429-1458`) — stores `featured_type`, `featured_priority`, `featured_expires_at`, `is_active`, `admin_approved`, `bucket_type`, `shop_scope_id`
- **`mv_storefront_discovery`** materialized view — aggregates `featured_type_array` via subquery from `featured_products` where `is_active = true`
- **Capability gating** — `featured_options` capability group controls which types a tenant's tier allows (via `FeaturedOptionsService.ts`)

### Display Surfaces

- `SmartProductCard.tsx` — colored pills with icons, sorted by priority, max 3 shown
- `ProductFeaturedBadges.tsx` — standalone badge component with active/inactive styling
- `StorefrontFeaturedProducts.tsx` — separate sections per type ("New Arrivals", "On Sale", etc.)
- `FeaturedProductsManager.tsx` — tenant management UI for tagging products
- `ProductFeaturingPage` (`/t/[tenantId]/settings/products/featuring`) — premium featuring management
- Directory and bot product search — can filter by badge type

### Platform Types (Already Have Some Logic)

- `trending` — computed from `trending_score` in `mv_storefront_discovery` (view_count, engagement_count, conversion_count)
- `bestseller` — derived from `units_sold` / `revenue_cents` in the MV
- `recommended` — personalized recommendations (algorithmic)
- `random_featured` — random selection from active featured products

These four are the **only badges with any functional weight** — they're computed from data, not manually applied. But even they don't affect sort order, search ranking, or customer filtering. Worse, they're computed on-the-fly from MV columns, **not stored in `featured_products`** — creating two separate code paths for tenant vs platform types.

### Hardcoded Surfaces Map

The 11 badge types are hardcoded in **12+ files** across both layers. This is the rigidity problem:

**Backend (2 files):**

| File | What's hardcoded |
|------|-----------------|
| `FeaturedProductsService.ts` | `VALID_FEATURED_TYPES` array (11 types), `PLATFORM_CONTROLLED_TYPES` array, separate `generateTrendingProducts()` / `generateBestsellerProducts()` code paths |
| `FeaturedOptionsService.ts` | `TENANT_FEATURED_TYPES`, `PLATFORM_FEATURED_TYPES`, `ALL_FEATURED_TYPES` arrays, `FEATURED_TYPE_META` record (label, description, group per type) |

**Frontend (10+ files):**

| File | Matches | What's hardcoded |
|------|---------|-----------------|
| `SmartProductCard.tsx` | 45 | `getBadgePriority()`, `getStorefrontBadgeStyle()`, `getStorefrontBadgeIcon()`, `getStorefrontBadgeText()`, `getStorefrontGradientBorder()` — all switch statements |
| `FeaturedProductsManager.tsx` | 36 | `getFeaturedBadgeStyle()`, `getFeaturedBadgeIcon()`, `getFeaturedBadgeText()` — all switch statements |
| `FeaturedProductsManagerSingleton.tsx` | 20 | Duplicate badge style/icon/text switch statements |
| `StorefrontFeaturedProducts.tsx` | — | `featuredTypeConfig` record (icon, colors, title, description per type) |
| `FeaturedBucketsShowcase.tsx` | 9 | Bucket configs per type |
| `ProductFeaturedBadges.tsx` | — | `typeStyles`, `labels`, `icons` records |
| `EnhancedStorefrontProductCard.tsx` | 5 | Badge styling |
| `CatalogLayouts.tsx` | 5 | Badge references |
| `CollapsibleCatalogSidebar.tsx` | 5 | Badge references |
| `featuredOptions.ts` | — | `FEATURED_TYPE_META` record, `TENANT_FEATURED_TYPES`, `PLATFORM_FEATURED_TYPES` arrays |

**The data layer is already flexible; the code layer is not.** The `featured_products.featured_type` column is a varchar that accepts any value. The MV's `featured_type_array` subquery aggregates whatever is in the table. But every component that displays, filters, or validates badges has the 11 types burned into code.

---

## Architectural Foundation: Two-Concern Separation

Before adding semantic rules or custom badges, the architecture must separate two concerns that are currently tangled:

### Concern 1: Badge Definition (what badges exist)

**Current:** Badge definitions (label, icon, color, priority, group, description) are hardcoded in arrays and records across 12+ files.

**Target:** A single `featured_type_registry` table + `BadgeRegistryService` that serves as the single source of truth for all badge metadata. Every component queries the registry instead of reading hardcoded arrays.

### Concern 2: Badge Assignment (which products have which badges)

**Current:** The `featured_products` table handles tenant-assigned badges. Platform types (trending, bestseller) are computed on-the-fly from MV columns, NOT stored in the table — creating two code paths.

**Target:** ALL badge assignments — auto, manual, and system — flow through `featured_products`. The `featured_type_array` in the MV aggregates everything uniformly. No more separate code paths for platform vs tenant types.

### The Registry Table

```sql
CREATE TABLE featured_type_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = system/global
  key             VARCHAR(50) NOT NULL,          -- 'sale', 'new_arrival', 'custom:locally_sourced'
  label           VARCHAR(100) NOT NULL,
  description     TEXT,
  group           VARCHAR(20) NOT NULL DEFAULT 'tenant',  -- 'tenant' | 'platform'
  icon            VARCHAR(50),                    -- icon name from library
  color           VARCHAR(20),                    -- color theme key
  priority        INT DEFAULT 50,                 -- display/sort priority
  sort_order      INT DEFAULT 0,
  is_system       BOOLEAN DEFAULT true,           -- true for built-in, false for custom
  is_active       BOOLEAN DEFAULT true,
  auto_assign_rule  JSONB,                        -- nullable, declarative rule
  auto_remove_rule  JSONB,                        -- nullable, declarative rule
  conflict_with     TEXT[],                       -- nullable, keys of conflicting badges
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, key)  -- system badges have tenant_id NULL
);
```

System badges (the existing 11) are seeded with `tenant_id = NULL`. Custom badges have `tenant_id` set and `is_system = false`. Both coexist in the same table — one query, one cache, one service.

### The Assignment Table (existing, minimal extension)

The `featured_products` table already works. Two small additions:

```sql
ALTER TABLE featured_products
  ADD COLUMN IF NOT EXISTS assignment_source VARCHAR(20) DEFAULT 'manual',  -- 'auto' | 'manual' | 'system'
  ADD COLUMN IF NOT EXISTS rule_evaluated_at TIMESTAMPTZ;  -- last time auto-assign rule was checked
```

`assignment_source` distinguishes how a badge was applied:
- `auto` — assigned by a background job evaluating registry rules (can be auto-removed when conditions change)
- `manual` — assigned by merchant via UI (persists until manually removed)
- `system` — assigned by platform algorithm (trending, bestseller — recomputed on schedule)

### Assignment Surfaces

Badge assignment can happen at multiple surfaces, all writing to the same `featured_products` table:

| Surface | Source | Who controls |
|---------|--------|-------------|
| Background auto-assign job | `auto` | System (registry rules) |
| Platform algorithm job (trending, bestseller) | `system` | System (MV metrics) |
| FeaturedProductsManager UI | `manual` | Merchant |
| ProductFeaturingPage (premium) | `manual` | Merchant |
| Product creation wizard (suggestions) | `manual` | Merchant (accepts/rejects) |
| Items table bulk assign | `manual` | Merchant |

### Platform Types Unification

Currently, `trending` and `bestseller` are computed on-the-fly from MV columns (`trending_score`, `units_sold`), NOT stored in `featured_products`. This creates two code paths:
1. Tenant types: query `featured_products` table
2. Platform types: query MV columns directly

In the target architecture, a background job writes platform type assignments to `featured_products` with `assignment_source = 'system'`. The MV's `featured_type_array` then aggregates ALL types uniformly. One code path, one query pattern.

---

## Gap Analysis

### 1. No Semantic Validation

Badges are labels with no enforced meaning:

- A **"Sale"** badge doesn't verify `sale_price_cents` is set or that it's lower than `price_cents`
- A **"Clearance"** badge doesn't check low stock or discontinued status
- A **"New Arrival"** badge doesn't check `created_at` recency
- A **"Seasonal"** badge has no season window (start/end dates)
- A product can be **"Clearance" and "New Arrival"** simultaneously — contradictory signals with no conflict detection

**Impact:** Customers learn badges are unreliable. "Sale" means nothing if the price isn't actually discounted. Trust erodes.

### 2. No Automatic Assignment

Merchants must manually tag every product. There are no rules like:

- "If `sale_price_cents` is set → auto-apply `sale` badge"
- "If `created_at` within last 30 days → auto-apply `new_arrival` badge"
- "If `stock <= 5` → suggest `clearance` badge"
- "If `trending_score > 0.7` → auto-apply `trending` badge"

**Impact:** Badge coverage is sparse and inconsistent. Merchants forget to tag products. High-engagement products go unbadged.

### 3. No Custom Badges

Merchants cannot create their own badge types. A grocery might want "Locally Sourced", a bookstore might want "Staff Favorite", a clothing store might want "Sustainable Fabric". The 7 tenant-controlled types are a fixed taxonomy that can't accommodate domain-specific merchandising language.

**Impact:** Badges feel generic and impersonal. Merchants can't express what makes their curation special.

### 4. No Customer-Facing Filtering

Shoppers cannot filter by badge on the storefront. There's no "Show me only sale items" or "Browse new arrivals" facet. Badges are display-only — they don't power navigation.

**Impact:** Badges don't help customers find what they're looking for. They're noise, not signal.

### 5. No Analytics

No data on whether badges drive results:

- No per-badge view count, CTR, add-to-cart rate, or conversion lift
- No comparison of badged vs. unbadged product performance
- No ROI measurement for premium featuring spend
- No "this badge increased conversions by X%" insight

**Impact:** Merchants can't make data-driven decisions about which badges to use. Premium featuring is a leap of faith.

### 6. No Behavioral Impact

Badges don't affect:

- **Search ranking** — a "featured" product doesn't sort higher in search results
- **Category page ordering** — badges don't influence product position in category grids
- **GMC feed** — "Sale" doesn't map to `sale_price` in Google feed; "Seasonal" doesn't map to `custom_label_0`
- **Bot queries** — partially implemented (bot can filter by badge), but not integrated into natural language queries ("what's on sale?")
- **Recommendations** — badge types aren't used as recommendation signals

**Impact:** Badges are cosmetic. They don't move the needle on discovery, conversion, or visibility.

### 7. No Time-Based Auto-Management

- "New Arrival" doesn't auto-remove after 30 days
- "Seasonal" doesn't auto-deactivate after the season ends
- "Sale" doesn't auto-remove when the sale price is cleared
- Expired featured products exist (via `featured_expires_at`) but the badge itself doesn't carry time semantics

**Impact:** Badge staleness. Products tagged "New Arrival" 6 months ago undermine credibility.

---

## Design: Three Layers of Meaning

### Layer 1 — Semantic Rules (System-Enforced Meaning)

Each built-in badge type gets a **semantic contract**: an auto-assign rule, a validation rule, or both.

| Badge | Auto-Assign Rule | Validation Rule | Auto-Remove Rule |
|-------|-----------------|-----------------|-----------------|
| `sale` | `sale_price_cents IS NOT NULL AND sale_price_cents < price_cents` | Warn if no sale price or sale price ≥ list price | Remove when `sale_price_cents` cleared |
| `new_arrival` | `created_at > now() - N days` (configurable, default 30) | None — time-based | Auto-remove after N days |
| `clearance` | `stock <= threshold` (configurable, default 5) OR `availability = 'discontinued'` | Warn if stock is high and not discontinued | Remove when stock replenished above threshold |
| `seasonal` | Merchant sets season window (start_date / end_date) | None — merchant-defined window | Auto-deactivate outside window |
| `staff_pick` | Manual only | None | Manual only |
| `featured` | Manual only (premium placement) | Tier-gated, count-limited | Manual or expiration date |
| `store_selection` | Manual only | None | Manual only |
| `bestseller` | `units_sold > threshold` (platform-computed) | System-only, not merchant-assignable | Recomputed on MV refresh |
| `trending` | `trending_score > threshold` (platform-computed) | System-only | Recomputed on MV refresh |
| `recommended` | Algorithmic (personalization) | System-only | Per-user, recomputed |
| `random_featured` | Random selection from active pool | System-only | Rotates on schedule |

**Conflict detection:** When a merchant applies badges that contradict each other (e.g., `clearance` + `new_arrival`, or `sale` + `featured`), show a warning in the management UI. Don't hard-block — the merchant may have a valid reason — but surface the conflict.

### Layer 2 — Custom Merchant Badges

Beyond the 11 built-in types, merchants can create **custom badges** with their own meaning. Custom badges are entries in `featured_type_registry` with `tenant_id` set and `is_system = false` — they flow through the same registry, same assignment table, same display surfaces as built-in badges. No separate table, no separate code path.

#### Custom Badge Key Convention

Custom badge keys use a `custom:` prefix (e.g., `custom:locally_sourced`) to avoid collisions with built-in types in the `featured_type` column and `featured_type_array`.

#### Rules

- Custom badges are **tenant-scoped** — not shared across tenants
- **Tier-gated slot limit**: trial = 0, starter = 2, discovery = 5, professional = 10, enterprise = unlimited (capability: `custom_badge_slots`)
- Custom badges can have optional auto-assign rules (JSONB in registry: by category, tag, stock threshold, price range)
- Custom badges appear alongside built-in badges in all display surfaces — automatically, because all surfaces read from the registry
- Custom badges are included in `featured_type_array` in the MV — automatically, because the MV aggregates from `featured_products` regardless of type
- Bot product search and directory filtering support custom badges — automatically, because they query `featured_type_array`

### Layer 3 — Behavioral Impact (Badges That Do Something)

#### 3a. Customer-Facing Badge Filtering

Add badge filter facets to storefront and directory:

- Storefront: filter bar with badge chips ("On Sale", "New Arrivals", "Clearance", custom badges)
- Directory: badge filter in search sidebar
- API: `GET /api/public/products?tenantId=X&badge=sale,new_arrival` (multi-select)
- MV query: filter on `featured_type_array` with `&&` array overlap operator

#### 3b. Sort Priority Weighting

Products with active badges sort higher in category/collection views:

- Base sort: `featured_priority DESC, created_at DESC`
- Badge-weighted sort: `featured_priority DESC, badge_weight DESC, created_at DESC`
- `badge_weight` = sum of badge type weights (e.g., `featured` = 100, `sale` = 50, `new_arrival` = 30, `clearance` = 20)
- Weights are configurable per tenant (merchants can prioritize which badges matter most for their store)

#### 3c. GMC Feed Mapping

Map badges to Google Merchant Center feed attributes:

| Badge | GMC Field |
|-------|-----------|
| `sale` | `sale_price` (already synced if `sale_price_cents` is set) |
| `seasonal` | `custom_label_0` |
| `clearance` | `custom_label_1` |
| `new_arrival` | `custom_label_2` |
| `staff_pick` | `custom_label_3` |
| `featured` | `custom_label_4` |
| Custom badges | `custom_label_4` through `custom_label_4` (max 5 custom labels in GMC) |

This makes badges **visible to Google Shopping** — they become feed attributes that power Google's own filtering and promotion.

#### 3d. Bot Query Integration

Extend `BotProductCatalogService` to support natural language badge queries:

- "What's on sale?" → query `featured_type_array @> ARRAY['sale']`
- "Show me new arrivals" → query `featured_type_array @> ARRAY['new_arrival']`
- "Any clearance items?" → query `featured_type_array @> ARRAY['clearance']`
- "What's locally sourced?" → query `featured_type_array @> ARRAY['custom:locally_sourced']`

Already partially implemented — the bot can filter by badge. This phase adds natural language intent detection for badge queries.

#### 3e. Badge Analytics

Track per-badge performance:

| Metric | Source |
|--------|--------|
| Views | `view_count` in MV (already tracked) |
| CTR | `click_count / view_count` (needs `click_count` tracking) |
| Add-to-cart rate | `add_to_cart_count / view_count` |
| Conversion rate | `conversion_count / view_count` |
| Revenue lift | `revenue_cents` for badged vs. unbadged products in same category |

Surface in merchant dashboard:
- Per-badge performance table
- Badge ROI comparison chart
- "Badges driving the most conversions" leaderboard
- Premium featuring spend vs. revenue generated

#### 3f. Auto-Promotion Suggestions

When a product with no badge shows high engagement:

- "This product is trending — apply `trending` badge?" (platform-assisted)
- "This product has high views but no badge — consider featuring it?"
- "Products in this category with `sale` badge convert 3x better — apply?"

Suggestions appear in the merchant dashboard as actionable cards. Merchant approves/rejects — no automatic application without consent.

---

## Phased Implementation Plan

### Phase 0 — Badge Registry: Data-Driven Architecture

**Goal:** Replace all hardcoded badge type arrays, switch statements, and record literals with a single data-driven registry. This is the foundation that makes every subsequent phase possible without touching 12+ files.

**Scope:**

1. **Create `featured_type_registry` table** (migration + Prisma model)
   - Seed all 11 existing badge types with their current metadata (label, description, group, icon, color, priority)
   - System badges have `tenant_id = NULL`, `is_system = true`

2. **Create `BadgeRegistryService`** (backend)
   - Loads from DB with 60s in-memory cache (same pattern as `CapabilityConstraintService`)
   - `getAllTypes()`, `getTypesByGroup(group)`, `getMeta(key)`, `getTenantTypes(tenantId)` (system + tenant custom)
   - `invalidateCache()` for admin/tenant CRUD
   - Falls back to static seed data if DB unavailable

3. **Extend `featured_products` table**
   - Add `assignment_source` column ('auto' | 'manual' | 'system', default 'manual')
   - Add `rule_evaluated_at` column (for auto-assigned badges)

4. **Replace backend hardcoded arrays**
   - `FeaturedProductsService.ts`: `VALID_FEATURED_TYPES` → `registry.getAllTypes()`
   - `FeaturedOptionsService.ts`: `TENANT_FEATURED_TYPES`, `PLATFORM_FEATURED_TYPES`, `FEATURED_TYPE_META` → `registry.getTypesByGroup()` / `registry.getMeta()`
   - `FeaturedOptionsService.resolveFeaturedOptionsState()`: query registry for allowed types instead of hardcoded arrays

5. **Replace frontend hardcoded metadata**
   - New: `apps/web/src/hooks/useBadgeRegistry.ts` — fetches badge metadata from API, cached via React Query
   - New: `apps/web/src/services/BadgeRegistryService.ts` — frontend singleton for badge metadata
   - `featuredOptions.ts`: `FEATURED_TYPE_META` → fetched from registry service
   - `SmartProductCard.tsx`: `getBadgePriority()`, `getStorefrontBadgeStyle()`, `getStorefrontBadgeIcon()`, `getStorefrontBadgeText()`, `getStorefrontGradientBorder()` → read from registry metadata
   - `FeaturedProductsManager.tsx`: `getFeaturedBadgeStyle()`, `getFeaturedBadgeIcon()`, `getFeaturedBadgeText()` → read from registry metadata
   - `FeaturedProductsManagerSingleton.tsx`: same replacement
   - `StorefrontFeaturedProducts.tsx`: `featuredTypeConfig` → built from registry data
   - `ProductFeaturedBadges.tsx`: `typeStyles`, `labels`, `icons` → built from registry data
   - `EnhancedStorefrontProductCard.tsx`, `CatalogLayouts.tsx`, `CollapsibleCatalogSidebar.tsx` → read from registry
   - `FeaturedBucketsShowcase.tsx` → bucket configs from registry

6. **Platform types unification**
   - Background job writes `trending` / `bestseller` assignments to `featured_products` with `assignment_source = 'system'`
   - Remove separate `generateTrendingProducts()` / `generateBestsellerProducts()` code paths in `FeaturedProductsService.ts`
   - All badge queries go through `featured_products` uniformly

7. **API endpoints for registry**
   - `GET /api/public/badge-registry` — public endpoint returning active badge metadata (for storefront rendering)
   - `GET /api/tenants/:tenantId/badge-registry` — tenant-scoped (system + tenant custom badges)

**Key files:**
- New: `database/migrations/06X_featured_type_registry.sql`
- New: `apps/api/src/services/BadgeRegistryService.ts`
- New: `apps/api/src/routes/badge-registry.ts`
- New: `apps/web/src/hooks/useBadgeRegistry.ts`
- New: `apps/web/src/services/BadgeRegistryService.ts`
- Modified: `apps/api/src/services/FeaturedProductsService.ts`
- Modified: `apps/api/src/services/FeaturedOptionsService.ts`
- Modified: `apps/web/src/utils/featuredOptions.ts`
- Modified: `apps/web/src/components/products/SmartProductCard.tsx`
- Modified: `apps/web/src/components/tenant/FeaturedProductsManager.tsx`
- Modified: `apps/web/src/components/tenant/FeaturedProductsManagerSingleton.tsx`
- Modified: `apps/web/src/components/storefront/StorefrontFeaturedProducts.tsx`
- Modified: `apps/web/src/components/products/ProductFeaturedBadges.tsx`
- Modified: `apps/web/src/components/storefront/FeaturedBucketsShowcase.tsx`
- Modified: `apps/web/src/components/products/EnhancedStorefrontProductCard.tsx`
- Modified: `apps/web/src/components/storefront/CatalogLayouts.tsx`
- Modified: `apps/web/src/components/storefront/CollapsibleCatalogSidebar.tsx`

**Estimated effort:** 7-10 days

**Why this comes first:** Without the registry, Phase 1 (semantic rules) would add rule metadata to `FEATURED_TYPE_META` in `featuredOptions.ts` — another hardcoded field. Phase 3 (custom badges) would need a separate table and separate code paths. Every phase would touch the same 12+ files. The registry makes all subsequent phases additive — new badges are data, not code.

---

### Phase 1 — Semantic Rules for Built-in Badges

**Goal:** Give the 11 existing badge types enforced meaning via declarative rules in the registry.

**Scope:**
- Add `auto_assign_rule` and `auto_remove_rule` JSONB to registry entries for `sale`, `new_arrival`, `clearance`, `seasonal`
- Add `conflict_with` arrays to registry entries (e.g., `clearance` conflicts with `new_arrival`)
- Background auto-assign job: reads rules from registry, evaluates against product data, writes to `featured_products` with `assignment_source = 'auto'`
- Auto-remove logic: job re-evaluates auto-assigned badges and removes when conditions no longer match
- Validation warnings in `FeaturedProductsManager` UI when a manual badge contradicts product state
- Season window support for `seasonal` (start_date / end_date stored in `featured_products.featured_expires_at` or a new JSONB column)
- Extend `featured-products-expiry-monitor.ts` to also run badge rule validation

**No additional schema changes** — rules live in the registry's `auto_assign_rule` / `auto_remove_rule` JSONB columns (created in Phase 0).

**Key files:**
- `apps/api/src/services/BadgeRegistryService.ts` — add rule evaluation
- New: `apps/api/src/services/BadgeRuleEngine.ts` — evaluates declarative rules against product data
- `apps/api/src/jobs/featured-products-expiry-monitor.ts` — extend with badge rule validation
- `apps/web/src/components/tenant/FeaturedProductsManager.tsx` — add validation warnings

**Estimated effort:** 3-5 days

---

### Phase 2 — Customer-Facing Badge Filtering

**Goal:** Let shoppers filter by badge on storefront and directory.

**Scope:**
- Storefront filter bar with badge chips (multi-select)
- Directory badge filter in search sidebar
- API endpoint: `GET /api/public/products?tenantId=X&badge=sale,new_arrival` (multi-select)
- MV query: filter on `featured_type_array` using array overlap
- URL state for badge filters (shareable links: `?badge=sale,new_arrival`)
- Mobile: badge filter as collapsible section

**Key files:**
- `apps/api/src/routes/storefront.ts` — add badge filter param
- `apps/api/src/routes/directory-consolidated.ts` — add badge filter param
- `apps/web/src/components/storefront/StorefrontFeaturedProducts.tsx` — add filter bar
- New: `apps/web/src/components/storefront/BadgeFilterBar.tsx`

**Estimated effort:** 3-4 days

---

### Phase 3 — Custom Merchant Badges

**Goal:** Let merchants create their own badge types with their own meaning.

**Scope:**
- CRUD API: `GET/POST/PUT/DELETE /api/tenants/:tenantId/badge-registry` (operates on `featured_type_registry` rows where `tenant_id` is set and `is_system = false`)
- Tier-gated slot limits (capability: `custom_badge_slots`)
- Custom badge auto-assign rules (JSONB in registry — same rule format as built-in badges from Phase 1)
- Frontend management UI at `/t/[tenantId]/settings/products/badges`
- Custom badges appear in all display surfaces **automatically** — all surfaces already read from the registry (Phase 0)
- Custom badges appear in `featured_type_array` in the MV **automatically** — the MV aggregates from `featured_products` regardless of type
- Custom badges work in bot product search and directory filtering **automatically** — they query `featured_type_array`
- Custom badge keys use `custom:` prefix (e.g., `custom:locally_sourced`)

**No new table needed** — custom badges are rows in `featured_type_registry` (created in Phase 0). No new display surface code needed — all surfaces already read from the registry.

**Key files:**
- New: `apps/api/src/routes/tenant-badge-registry.ts` — tenant CRUD for custom badges
- New: `apps/web/src/app/t/[tenantId]/settings/products/badges/page.tsx`
- Modified: `apps/api/src/services/BadgeRegistryService.ts` — add tenant CRUD methods
- Modified: `apps/web/src/hooks/useBadgeRegistry.ts` — include tenant custom badges

**Estimated effort:** 3-5 days (down from 5-7, because Phase 0 already built the foundation)

---

### Phase 4 — Badge Analytics

**Goal:** Measure whether badges actually drive results.

**Scope:**
- `badge_analytics` materialized view or aggregate table (per tenant, per badge type, per period)
- Track: views, CTR, add-to-cart rate, conversion rate, revenue for badged vs. unbadged products
- Merchant dashboard analytics tab with per-badge performance
- Badge ROI comparison (which badges drive the most incremental revenue)
- Premium featuring spend vs. revenue generated report
- Weekly digest email (optional): "Your Sale badge drove 45% more clicks this week"

**Key files:**
- New: `apps/api/src/services/BadgeAnalyticsService.ts`
- New: `apps/api/src/routes/badge-analytics.ts`
- New: `apps/web/src/app/t/[tenantId]/settings/products/badges/analytics/page.tsx`
- `apps/api/database/migrations/` — new migration for analytics table/MV

**Estimated effort:** 5-7 days

---

### Phase 5 — Behavioral Integration

**Goal:** Badges affect discovery, search, and external feeds.

**Scope:**
- **Sort priority weighting** — badge-weighted sort in category/collection views (configurable per tenant)
- **GMC feed mapping** — map badges to `custom_label_0` through `custom_label_4` in GMC product sync
- **Bot natural language queries** — "what's on sale?", "show me new arrivals", "any clearance items?"
- **Auto-promotion suggestions** — actionable cards in merchant dashboard for high-engagement unbadged products
- **Recommendation signal** — feed badge types into the recommendation engine as preference signals

**Key files:**
- `apps/api/src/services/GMCProductSync.ts` — add custom_label mapping
- `apps/api/src/services/BotProductCatalogService.ts` — add NL intent detection for badges
- `apps/api/src/services/recommendationService.ts` — add badge preference signals
- `apps/api/src/services/DiscoveryService.ts` — add badge-weighted sort
- New: `apps/web/src/components/tenant/AutoPromotionSuggestions.tsx`

**Estimated effort:** 7-10 days

---

### Phase 6 — Skill Document: Meaningful Badge Architecture

**Goal:** Capture the architectural insights and patterns from this design as a reusable skill document for future development.

**Scope:**
- Create `.devin/skills/meaningful-badge-architecture.md` capturing:
  - **Anti-pattern identified:** Hardcoding entity type metadata (labels, icons, colors, priorities) as arrays and switch statements across 12+ files instead of using a data-driven registry
  - **Pattern: Two-Concern Separation** — separate "what badges exist" (definition/registry) from "which products have which badges" (assignment table). Both concerns can evolve independently.
  - **Pattern: Data-driven badge registry** — single table + cached service replaces all hardcoded arrays. Adding a badge type becomes a data operation, not a code change. Mirrors the `CapabilityConstraintService` cache pattern.
  - **Pattern: Unified assignment table** — all assignment sources (auto, manual, system) write to the same `featured_products` table. The `assignment_source` column distinguishes provenance. Eliminates separate code paths for platform vs tenant types.
  - **Pattern: Registry-driven display** — all display surfaces (cards, storefront sections, buckets, manager UI) read badge metadata from a single registry API. No component has badge types hardcoded.
  - **Pattern: Declarative badge rules** — auto-assign and auto-remove rules stored as JSONB in the registry, evaluated by a rule engine. Rules are data, not code. New rules don't require deployment.
  - **Insight: Badges need behavioral weight** — decorative badges erode customer trust. Every badge should assert something verifiable about the product. Semantic rules enforce that assertion.
  - **Insight: Custom badges are registry entries, not a separate system** — if the registry is built correctly in Phase 0, custom badges (Phase 3) require no new tables and no new display code. They're just rows.
  - **Insight: Platform types should flow through the same assignment table** — computing trending/bestseller on-the-fly from MV columns creates two code paths. Writing them to `featured_products` with `assignment_source = 'system'` unifies the query pattern.
  - **Checklist for future badge work:**
    - Does the change touch more than 2 files? If so, it should go through the registry, not hardcoded
    - Is the new badge type stored in `featured_type_registry`? If not, it won't appear in display surfaces
    - Does the badge have a semantic rule? If not, it's decorative — is that intentional?
    - Does the badge assignment write to `featured_products`? If not, it bypasses the MV aggregation
  - **Related patterns in the codebase:**
    - `CapabilityConstraintService.ts` — same cache + DB-driven + static fallback pattern
    - `navigation_links` table — same data-driven vs hardcoded evolution (see `docs/NAVIGATION_ALIGNMENT_PLAN.md`)
    - `capability_features_list` — same registry pattern for capability definitions

**Key files:**
- New: `.devin/skills/meaningful-badge-architecture.md`

**Estimated effort:** 1 day

---

## Architecture Principles

1. **Badges are assertions, not decorations** — every badge should assert something verifiable about the product
2. **Auto-assign when possible, manual when intentional** — data-driven badges auto-assign; curation badges stay manual
3. **Merchant expression through custom badges** — the built-in taxonomy covers common cases; custom badges cover the rest
4. **Badges power navigation, not just display** — filtering, sorting, and search should respect badges
5. **Measure what matters** — if a badge doesn't drive measurable outcomes, surface that to the merchant
6. **No badge without meaning** — every badge, built-in or custom, should have a description and (where applicable) a rule
7. **One registry, one assignment table** — badge definitions live in `featured_type_registry`; badge assignments live in `featured_products`. No separate tables or code paths for different badge categories.
8. **Data-driven, not code-driven** — adding a badge type (built-in or custom) should be a data operation, not a code change across 12+ files
9. **All assignment surfaces write to the same table** — auto-assign jobs, manual UI, platform algorithms, and wizard suggestions all write to `featured_products`. The `assignment_source` column distinguishes provenance.

## Dependency Notes

- **Phase 0** (registry) has no dependencies — can start immediately. This is the foundation.
- **Phase 1** (semantic rules) depends on Phase 0 — rules are stored in the registry's JSONB columns
- **Phase 2** (customer filtering) depends on Phase 0 (registry provides badge metadata for filter UI) and benefits from Phase 1 (semantic rules make filtering trustworthy)
- **Phase 3** (custom badges) depends on Phase 0 — custom badges are registry entries. Independent of Phases 1-2.
- **Phase 4** (analytics) depends on Phase 0 (registry for per-badge grouping) and Phase 2 (filtering enables tracking badge-driven discovery)
- **Phase 5** (behavioral integration) depends on Phases 0-4 (behavioral impact requires meaningful badges, filtering, custom badges, and analytics)
- **Phase 6** (skill document) depends on Phase 0 (registry pattern is the core insight). Can be written after Phase 0 is complete, but benefits from being written after all phases are implemented (captures real-world lessons, not just design predictions)

**Critical path:** Phase 0 → Phase 1 → Phase 2 → Phase 4 → Phase 5
**Parallel track:** Phase 0 → Phase 3 (can run alongside Phases 1-2)
**Documentation track:** Phase 0 → Phase 6 (can be drafted after Phase 0, finalized after Phase 5)

## Relationship to Existing Work

- **Product Listing Expiration** (`docs/PRODUCT_LISTING_EXPIRATION_DESIGN.md`) — complementary. Product expiration handles "when does a product stop being visible?" Badges handle "why is this product highlighted?" Both modify the MV WHERE clause and the merchant management UI.
- **Capability System** — the `featured_options` capability already gates which badge types a tenant can use. Custom badges (Phase 3) add a new capability key (`custom_badge_slots`) with tier-based slot limits.
- **Bot Product Catalog** — `BotProductCatalogService` already supports badge filtering. Phase 5 extends this with natural language intent detection.
- **GMC Product Sync** — `GMCProductSync.ts` already syncs `sale_price`. Phase 5 extends the feed mapping to include badge-to-`custom_label` mapping.
- **Featured Products Expiry Monitor** — `featured-products-expiry-monitor.ts` already runs as a background job. Phase 1 extends it with badge validation and auto-management logic.
