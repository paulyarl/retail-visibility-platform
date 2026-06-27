# Featured Types → Meaningful Badges — Design Document

## Problem Statement

The platform's featured products architecture has 11 badge types, a management page for tenants, admin pages, and sections on storefront and product pages. In practice, **all featured types are purely decorative labels with no behavioral contract**. A merchant can tag a product as "Sale" without a sale price, "Clearance" with full stock, or "New Arrival" on a year-old product. There is no validation, no auto-assignment, no customer-facing filtering, no analytics, and no cross-badge intelligence.

This document captures the gap analysis and a phased plan to make featured types **meaningful, impactful, and useful for merchants**.

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

These four are the **only badges with any functional weight** — they're computed from data, not manually applied. But even they don't affect sort order, search ranking, or customer filtering.

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

Beyond the 11 built-in types, merchants can create **custom badges** with their own meaning.

#### Schema: `tenant_custom_badges` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | FK → tenants | Tenant scope |
| `key` | VARCHAR(50) | Slug identifier (e.g., `locally_sourced`) |
| `label` | VARCHAR(100) | Display label |
| `description` | TEXT | Optional description |
| `icon` | VARCHAR(50) | Icon name from icon library |
| `color` | VARCHAR(20) | Color theme key |
| `auto_assign_rule` | JSONB | Optional rule (category, tag, stock threshold, price range) |
| `is_active` | BOOLEAN | Soft delete / deactivate |
| `sort_order` | INT | Display ordering |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### Rules

- Custom badges are **tenant-scoped** — not shared across tenants
- **Tier-gated slot limit**: trial = 0, starter = 2, discovery = 5, professional = 10, enterprise = unlimited
- Custom badges can have optional auto-assign rules (by category, tag, stock level, price range)
- Custom badges appear alongside built-in badges in all display surfaces
- Custom badges are included in `featured_type_array` in the MV with a `custom:` prefix (e.g., `custom:locally_sourced`) to avoid collisions with built-in types
- Bot product search and directory filtering support custom badges

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

### Phase 1 — Semantic Rules for Built-in Badges

**Goal:** Give the 11 existing badge types enforced meaning.

**Scope:**
- Auto-assign rules for `sale`, `new_arrival`, `clearance` (data-driven, no manual intervention needed)
- Validation warnings in `FeaturedProductsManager` UI when a badge contradicts product state
- Auto-remove logic for `new_arrival` (after configurable window) and `sale` (when sale price cleared)
- Season window support for `seasonal` (start_date / end_date on the featured_products record)
- Conflict detection between contradictory badges
- Background job to validate and auto-manage badges (runs alongside existing `featured-products-expiry-monitor.ts`)

**No schema changes needed** — all logic is service-layer. The `featured_products` table already has `featured_expires_at` for seasonal windows.

**Key files:**
- `apps/api/src/services/FeaturedProductsService.ts` — add rule engine
- `apps/api/src/jobs/featured-products-expiry-monitor.ts` — extend with badge validation
- `apps/web/src/components/tenant/FeaturedProductsManager.tsx` — add validation warnings
- `apps/web/src/utils/featuredOptions.ts` — add rule metadata to `FEATURED_TYPE_META`

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
- `tenant_custom_badges` table (migration + Prisma model)
- CRUD API: `GET/POST/PUT/DELETE /api/tenants/:tenantId/custom-badges`
- Tier-gated slot limits (capability: `custom_badge_slots`)
- Auto-assign rules (JSONB): by category, tag, stock threshold, price range
- Frontend management UI at `/t/[tenantId]/settings/products/badges`
- Custom badges in `featured_type_array` with `custom:` prefix
- Custom badges in all display surfaces (SmartProductCard, StorefrontFeaturedProducts, etc.)
- Custom badges in bot product search and directory filtering

**Key files:**
- New: `apps/api/src/services/CustomBadgeService.ts`
- New: `apps/api/src/routes/custom-badges.ts`
- New: `apps/web/src/app/t/[tenantId]/settings/products/badges/page.tsx`
- `apps/api/src/services/FeaturedProductsService.ts` — merge custom badges into type validation
- `apps/web/src/utils/featuredOptions.ts` — merge custom badge metadata

**Estimated effort:** 5-7 days

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

## Architecture Principles

1. **Badges are assertions, not decorations** — every badge should assert something verifiable about the product
2. **Auto-assign when possible, manual when intentional** — data-driven badges auto-assign; curation badges stay manual
3. **Merchant expression through custom badges** — the built-in taxonomy covers common cases; custom badges cover the rest
4. **Badges power navigation, not just display** — filtering, sorting, and search should respect badges
5. **Measure what matters** — if a badge doesn't drive measurable outcomes, surface that to the merchant
6. **No badge without meaning** — every badge, built-in or custom, should have a description and (where applicable) a rule

## Dependency Notes

- Phase 1 has no dependencies — can start immediately
- Phase 2 depends on Phase 1 (semantic rules make filtering trustworthy)
- Phase 3 is independent of Phases 1-2 — can run in parallel
- Phase 4 depends on Phase 2 (filtering enables tracking badge-driven discovery)
- Phase 5 depends on Phases 1-4 (behavioral impact requires meaningful badges, filtering, custom badges, and analytics)

## Relationship to Existing Work

- **Product Listing Expiration** (`docs/PRODUCT_LISTING_EXPIRATION_DESIGN.md`) — complementary. Product expiration handles "when does a product stop being visible?" Badges handle "why is this product highlighted?" Both modify the MV WHERE clause and the merchant management UI.
- **Capability System** — the `featured_options` capability already gates which badge types a tenant can use. Custom badges (Phase 3) add a new capability key (`custom_badge_slots`) with tier-based slot limits.
- **Bot Product Catalog** — `BotProductCatalogService` already supports badge filtering. Phase 5 extends this with natural language intent detection.
- **GMC Product Sync** — `GMCProductSync.ts` already syncs `sale_price`. Phase 5 extends the feed mapping to include badge-to-`custom_label` mapping.
- **Featured Products Expiry Monitor** — `featured-products-expiry-monitor.ts` already runs as a background job. Phase 1 extends it with badge validation and auto-management logic.
