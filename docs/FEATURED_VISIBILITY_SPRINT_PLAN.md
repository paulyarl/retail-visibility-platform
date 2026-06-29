# Featured Visibility Channels — Sprint Plan

## Status: Active
## Date: June 2026
## Source: `FEATURED_VISIBILITY_CHANNELS_DESIGN.md`

---

## Sprint Overview

The design document defines 9 phases. We organize them into 6 sprints, prioritizing the foundation (registry elevation + active featured resolution) first, then channel adoption, then monetization, then analytics.

| Sprint | Phases | Duration | Goal |
|--------|--------|----------|------|
| **Sprint 1** | Phase 1 — Registry Elevation | 1-2 days | Eliminate hardcoded `featured` checks. All special behavior is data-driven from `featured_type_registry`. |
| **Sprint 2** | Phase 2 — Active Featured Resolution | 2-3 days | Single service that resolves "active featured" products per tenant per surface. Expiration enforcer job. |
| **Sprint 3** | Phase 3 — Visibility Channel Priority | 2-3 days | 4 premium surfaces (storefront spotlight, cross-tenant shops, directory home, directory entry) read from `ActiveFeaturedResolver` with fallback. Per-layout retrofit for all 13 layout variants. |
| **Sprint 4** | Phases 4 + 6 — Monetization Foundation | 3-4 days | Placement catalog table, admin CRUD, purchase flow, Stripe checkout, CRM alerts, expiration warnings. Merges Phase 4 placement plans into Phase 6 catalog pattern. |
| **Sprint 5** | Phases 7 + 8 — Self-Service Store & Lifecycle | 3-4 days | Merchant-facing Featured Store page, automated renewal job, grace period, trial support. |
| **Sprint 6** | Phases 5 + 9 — Analytics & Revenue | 2-3 days | Per-placement ROI, platform revenue dashboard, lift over baseline, store analytics. |

**Total estimated duration:** 13-19 days

---

## Sprint 1: Registry Elevation

**Goal:** Move all `featured`-specific flags into `featured_type_registry`. Eliminate hardcoded `type.id === 'featured'` checks.

### Tasks

#### 1.1 — Database Migration: Promotional Flags on `featured_type_registry`

- **File**: `database/migrations/065_featured_registry_promotional_flags.sql`
- **Changes**:
  - `ALTER TABLE featured_type_registry` — add 4 columns: `requires_tenant_access BOOLEAN DEFAULT false`, `requires_admin_approval BOOLEAN DEFAULT false`, `is_promotional BOOLEAN DEFAULT false`, `promotional_priority INT DEFAULT 0`
  - `UPDATE featured_type_registry SET requires_tenant_access = true, requires_admin_approval = true, is_promotional = true, promotional_priority = 100 WHERE key = 'featured' AND tenant_id IS NULL`
  - Add `updated_at` trigger if not already present
  - RLS policies for the new columns (tenant can read system badges, admin can write)

#### 1.2 — Prisma Schema Update

- **File**: `apps/api/prisma/schema.prisma`
- **Changes**: Add 4 fields to `featured_type_registry` model: `requires_tenant_access Boolean @default(false)`, `requires_admin_approval Boolean @default(false)`, `is_promotional Boolean @default(false)`, `promotional_priority Int @default(0)`

#### 1.3 — Backend `BadgeRegistryService` Update

- **File**: `apps/api/src/services/BadgeRegistryService.ts`
- **Changes**:
  - Add 4 fields to `BadgeTypeMeta` interface: `requiresTenantAccess`, `requiresAdminApproval`, `isPromotional`, `promotionalPriority`
  - Update `STATIC_BADGE_TYPES` — `featured` entry gets `requiresTenantAccess: true, requiresAdminApproval: true, isPromotional: true, promotionalPriority: 100`; all others default to `false`/`0`
  - Update `dbRowToMeta()` to map the 4 new DB columns

#### 1.4 — Backend `FeaturedProductsService` Update

- **File**: `apps/api/src/services/FeaturedProductsService.ts`
- **Changes**:
  - In `addFeaturedType()` — look up badge type from `BadgeRegistryService.getBadgeByKey()`, set `admin_approved` based on `requiresAdminApproval` flag: `admin_approved = !badgeType.requiresAdminApproval`
  - Add helper: `async function isPromotionalType(type: string): Promise<boolean>` that checks `isPromotional` from registry

#### 1.5 — Frontend `BadgeRegistryService` Update

- **File**: `apps/web/src/services/BadgeRegistryService.ts`
- **Changes**: Add 4 fields to `BadgeTypeMeta` interface and static fallback, mirroring backend changes

#### 1.6 — Frontend `useBadgeRegistry` Hook Update

- **File**: `apps/web/src/hooks/useBadgeRegistry.ts`
- **Changes**: Ensure `useBadgeMeta(key)` returns the 4 new fields; add `useIsPromotional(key)` convenience hook

#### 1.7 — Frontend `FeaturedProductsManager` — Eliminate Hardcoded Checks

- **File**: `apps/web/src/components/tenant/FeaturedProductsManager.tsx`
- **Changes**:
  - Replace `type.id === 'featured' && (type as any).isPayToPlay` with `type.requiresTenantAccess` (line 594)
  - Replace `isPayToPlay && !hasFeaturedAccess` with `type.requiresTenantAccess && !hasFeaturedAccess` (line 595)
  - Replace all `selectedType === 'featured' && !hasFeaturedAccess` checks (lines 467, 1154, 1161, 1165, 1169, 1171) with `currentType?.requiresTenantAccess && !hasFeaturedAccess`
  - Use `useBadgeMeta(selectedType)` to get the current type's metadata instead of hardcoded `selectedType === 'featured'` checks

#### 1.8 — Verification

- `pnpm checkapi` passes
- `pnpm checkweb` passes
- Admin page filter dropdown shows all system badge types from registry
- Tenant without featured access sees "Approval Required" for any badge type with `requiresTenantAccess = true`
- Products assigned a non-promotional badge type are auto-approved

---

## Sprint 2: Active Featured Resolution Service

**Goal:** Create a single service that resolves "active featured" products per tenant per surface. All visibility channels read from this service.

### Tasks

#### 2.1 — Backend `ActiveFeaturedResolver` Service

- **File**: `apps/api/src/services/ActiveFeaturedResolver.ts`
- **Interface**: `ActiveFeaturedQuery { tenantId: string | null; surface: string; limit?: number }` → `ActiveFeaturedResult { products: ActiveFeaturedProduct[]; hasActive: boolean; fallbackUsed: boolean }`
- **Resolution logic**: Query `featured_products` WHERE `featured_type = 'featured' AND is_active = true AND admin_approved = true AND assignment_source = 'manual' AND (featured_expires_at IS NULL OR featured_expires_at > NOW())`, ordered by `promotional_priority DESC, featured_priority DESC, featured_at ASC`
- **Platform-level queries**: When `tenantId = null`, query across all tenants (for cross-tenant surfaces)
- **Caching**: 60-second in-memory cache per `(tenantId, surface)` pair
- **Cache invalidation**: Export `invalidateActiveFeaturedCache(tenantId?, surface?)` for external callers

#### 2.2 — API Route

- **File**: `apps/api/src/routes/active-featured.ts`
- **Endpoints**:
  - `GET /api/tenants/:tenantId/active-featured?surface=:surface&limit=:limit` — tenant-scoped
  - `GET /api/active-featured?surface=:surface&limit=:limit` — platform-level (no tenant scope)
- Mount in `index.ts`

#### 2.3 — Expiration Enforcer Job

- **File**: `apps/api/src/jobs/featured-expiration-enforcer.ts`
- **Runs**: Every 5 minutes
- **Logic**: Query expired featured products, set `is_active = false`, emit `badge_events` (type: `featured_expired`), invalidate `ActiveFeaturedResolver` cache
- Wire into server startup in `index.ts`

#### 2.4 — Frontend `ActiveFeaturedService`

- **File**: `apps/web/src/services/ActiveFeaturedService.ts`
- **Pattern**: Singleton extending `TenantApiSingleton` (for tenant-scoped) + platform-level method
- **Methods**: `getActiveFeatured(tenantId, surface, limit?)`, `getPlatformActiveFeatured(surface, limit?)`

#### 2.5 — Frontend `useActiveFeatured` Hook

- **File**: `apps/web/src/hooks/useActiveFeatured.ts`
- **Pattern**: React Query hook wrapping `ActiveFeaturedService`
- **Interface**: `useActiveFeatured(tenantId: string | null, surface: string, options?: { limit?: number })` → `{ data: ActiveFeaturedResult | undefined; isLoading: boolean; error: any }`

#### 2.6 — Verification

- `pnpm checkapi` passes
- `pnpm checkweb` passes
- `GET /api/tenants/:tenantId/active-featured?surface=storefront_spotlight` returns active featured products when they exist
- Same endpoint returns fallback products when no active featured exist, with `fallbackUsed: true`
- Expiration enforcer deactivates expired featured products within 5 minutes
- Cache invalidation works on featured product CRUD operations

---

## Sprint 3: Visibility Channel Priority

**Goal:** Update 4 premium surfaces to read from `ActiveFeaturedResolver` first, fall back to existing display logic. Retrofit all 13 layout variants across 4 surfaces.

### Tasks

#### 3.1 — Storefront Layouts (3 variants)

- **Shared hook**: Add `useActiveFeatured` call to `useStorefrontState.ts` — all 3 layouts benefit
- **Editorial** (`StorefrontEditorialLayout.tsx`): Replace `featuredData.buckets[0].products.slice(0, 3)` with active featured in spotlight section
- **Classic** (`StorefrontClientWrapper.tsx`): Active featured prepended above product grid in `ProductSection.tsx`
- **Immersive** (`StorefrontImmersiveLayout.tsx`): Replace `heroProducts` in "Trending Now" strip with active featured; rename header to "Featured" when active

#### 3.2 — Product Detail Layouts (3 variants)

- **Shared component**: Add `useActiveFeatured` to `FeaturedProductsSection.tsx` — all 3 layouts benefit
- Renders "Active Featured" carousel above existing `FeaturedTypeProducts` when active featured exist

#### 3.3 — Directory Home Layouts (3 variants)

- **Shared hook**: Add `useActiveFeatured(null, 'directory_home')` to `useDirectoryData.ts` — all 3 layouts benefit
- **Discovery**: Replace `RandomFeaturedProducts` with active featured carousel
- **Editorial**: Replace "Featured Near You" section content with active featured
- **Immersive**: Add active featured carousel between map/results split and existing sections

#### 3.4 — Directory Entry Layouts (4 variants)

- **Shared page**: Add `useActiveFeatured` in `directory/[slug]/page.tsx` — all 4 layouts benefit
- Merge/replace `featuredProducts` prop with active featured before passing to layout

#### 3.5 — Cross-Tenant Shops Page

- **File**: `ShopsPageClient.tsx`
- Platform-level `useActiveFeatured(null, 'cross_tenant_shops')` call
- Replace "Featured Products" section content with active featured; fallback to trending

#### 3.6 — Visual Treatment Components

- Crown icon overlay for active featured products
- "Promoted" label in directory/shops context
- Distinct border/shadow treatment

#### 3.7 — Verification

- All 13 layout variants show active featured products when they exist
- Fallback behavior is identical to current behavior when no active featured exist
- Expired featured products are removed from all channels within 5 minutes

---

## Sprint 4: Monetization Foundation

**Goal:** Placement catalog table, admin CRUD, purchase flow, Stripe checkout, CRM alerts, expiration warnings. Merges Phase 4 (placement plans) and Phase 6 (catalog pattern) into a single sprint.

### Tasks

- Migration: `067_featured_placement_catalog.sql` — `featured_placement_catalog` + `featured_placement_purchases` tables
- `FeaturedPlacementService.ts` — purchase, renew, revoke, revenue tracking
- Admin CRUD routes + UI for catalog management
- `CrmAlertService.createFeaturedPlacementAlert()` — fire-and-forget alert method
- Extend `featured-expiration-enforcer.ts` with 3-day and 1-day warning alerts
- Stripe webhook handler for placement purchase events
- Prisma schema updates

---

## Sprint 5: Self-Service Store & Lifecycle

**Goal:** Merchant-facing Featured Store page, automated renewal job, grace period, trial support.

### Tasks

- `featured-placement-purchases.ts` routes — tenant-facing purchase API
- `FeaturedPlacementPurchaseService.ts` — frontend singleton
- `/settings/featured-store` page with product picker, plan cards, payment method selection
- `featured-placement-renewal.ts` daily job — auto-renew, grace period, trial support
- `BillingNotificationService` extended with `featured_placement_*` notification types
- Navigation links in tenant sidebar

---

## Sprint 6: Analytics & Revenue

**Goal:** Per-placement ROI, platform revenue dashboard, lift over baseline, store analytics.

### Tasks

- `FeaturedPlacementAnalyticsService.ts` — per-placement metrics, lift calculation
- `FeaturedPlacementStoreAnalyticsService.ts` — store-level revenue, churn, trial conversion
- Analytics API endpoints (merchant + admin)
- "Placement Store" tab in `BadgeAnalyticsClient.tsx`
- Admin revenue dashboard at `/settings/admin/featured-placement-revenue`

---

## Dependency Graph

```
Sprint 1 (Registry Elevation)
  └→ Sprint 2 (Active Featured Resolution)
       └→ Sprint 3 (Visibility Channel Priority)
            └→ Sprint 4 (Monetization Foundation)
                 └→ Sprint 5 (Self-Service Store & Lifecycle)
                      └→ Sprint 6 (Analytics & Revenue)
```

Sprints are strictly sequential — each builds on the previous sprint's deliverables.

---

## Sprint 1 Start Criteria

- [ ] Design doc reviewed and approved
- [ ] Sprint plan reviewed and approved
- [ ] No blocking TS errors on `pnpm checkapi` or `pnpm checkweb`

## Sprint 1 Done Criteria

- [ ] Migration `065_featured_registry_promotional_flags.sql` created and idempotent
- [ ] Prisma schema updated with 4 new fields on `featured_type_registry`
- [ ] `BadgeRegistryService.ts` (backend) — 4 new fields in `BadgeTypeMeta`, `STATIC_BADGE_TYPES`, `dbRowToMeta`
- [ ] `BadgeRegistryService.ts` (frontend) — 4 new fields in `BadgeTypeMeta` and static fallback
- [ ] `useBadgeRegistry.ts` — `useBadgeMeta` returns new fields
- [ ] `FeaturedProductsService.ts` — `addFeaturedType` uses registry `requiresAdminApproval` flag
- [ ] `FeaturedProductsManager.tsx` — zero hardcoded `selectedType === 'featured'` checks; all replaced with `currentType?.requiresTenantAccess`
- [ ] `pnpm checkapi` passes
- [ ] `pnpm checkweb` passes
