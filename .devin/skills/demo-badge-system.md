# Demo Badge System

## Overview
The platform supports demo tenants (`is_demo = true` in the `tenants` table). Demo tenants behave like regular tenants but are explicitly marked so frontend surfaces can display a "Demo" badge. This document covers the full data flow from database to UI.

## Data Flow

### Backend (API)
The `is_demo` boolean and `demo_expires_at` datetime are stored on the `tenants` table. These fields are exposed through:

1. **TenantService** (`apps/api/src/services/TenantService.ts`) — `getTenantProfile()` and `getTenantComplete()` return `isDemo` and `demoExpiresAt` (ISO string).
2. **TenantProfileService** (`apps/api/src/services/TenantProfileService.ts`) — `getTenantProfile()` returns same fields.
3. **TenantSingletonService** (`apps/api/src/services/TenantSingletonService.ts`) — `getTenantInfo()` returns `isDemo` and `demoExpiresAt` in `TenantInfo`.
4. **API Routes**:
   - `GET /api/tenants/:identifier/profile` — via `TenantService.getTenantProfile()`
   - `GET /api/tenants/:identifier/complete` — via `TenantService.getTenantComplete()`
   - `GET /api/tenants/:id/complete` — in `tenant-tier.ts`, returns `isDemo`/`demoExpiresAt` in `tenantData`
   - `GET /api/public/tenant/:tenantId/profile` — in `public/tenants.ts`, includes `isDemo`/`demoExpiresAt`
   - `GET /api/public/tenant/:identifier/info` — in `public-api.ts`, includes `isDemo`/`demoExpiresAt`

### Frontend Interfaces
All consuming interfaces have been updated with optional `isDemo?: boolean` and `demoExpiresAt?: string | null`:

- `PublicTenantInfo` in `apps/web/src/services/TenantPublicService.ts`
- `TenantInfo` in `apps/web/src/services/PublicTenantInfoService.ts`
- `TenantCompleteResponse['tenant']` in `apps/web/src/hooks/dashboard/useTenantComplete.ts`
- `DirectoryEntryLayoutProps` in `apps/web/src/app/directory/[slug]/layouts/types.ts`

### Frontend Component
**`apps/web/src/components/shared/DemoBadge.tsx`** — reusable badge component.

Props:
- `isDemo?: boolean | null` — when falsy, renders nothing (zero overhead)
- `demoExpiresAt?: string | null` — shown in tooltip on hover
- `size?: 'sm' | 'md' | 'lg'` — controls badge dimensions
- `variant?: 'inline' | 'overlay'` — `inline` = amber pill with border, `overlay` = solid amber for dark backgrounds
- `className?: string` — additional styling

### Frontend Surfaces (6 insertion points)

| Surface | File | Data Source |
|---|---|---|
| Tenant Dashboard | `apps/web/src/components/dashboard/TenantDashboardV2.tsx` | `useTenantComplete` → `tenantData.isDemo` |
| Storefront Header | `apps/web/src/components/storefront/sections/StorefrontHeader.tsx` | `tenant.isDemo` prop (passed to `ImmersiveHeader` sub-component) |
| Tenant Scope Header | `apps/web/src/components/tenant/TenantScopeHeader.tsx` | `tenantData.isDemo` from `tenantInfoService` |
| Directory Store Card | `apps/web/src/components/directory/StoreCard.tsx` | `listing.isDemo` (requires backend directory query/MV to include `is_demo`) |
| Directory Entry (4 layouts) | `apps/web/src/app/directory/[slug]/layouts/DirectoryEntry*.tsx` | `isDemo` from `DirectoryEntryLayoutProps`, passed from `page.tsx` via `tenantInfo` |
| Directory Entry Page | `apps/web/src/app/directory/[slug]/page.tsx` | Passes `tenantInfo.isDemo` to layout props |

## Key Patterns

1. **Zero-overhead for non-demo**: `DemoBadge` returns `null` when `isDemo` is falsy. No DOM nodes, no cost.
2. **Props-based, not context-based**: Each surface receives `isDemo` through its existing data flow. No new context provider needed.
3. **Sub-component prop passing**: For components with internal sub-components (e.g., `ImmersiveHeader` inside `StorefrontHeader`), the `tenant` prop must be added to the sub-component's `Pick<>` type and passed at the call site.
4. **Layout props pattern**: Directory layouts share a `DirectoryEntryLayoutProps` type. New fields are added once to `types.ts`, destructured in each layout, and passed from `page.tsx`.

## Backend: Directory Listing Queries (StoreCard)

The `StoreCard` component expects `listing.isDemo`. The following directory routes now JOIN `tenants t` and return `isDemo`/`demoExpiresAt` in their responses:

| Route | File | Method |
|---|---|---|
| `GET /api/directory/stores` | `apps/api/src/routes/directory-v2.ts` | `LEFT JOIN tenants t` on `dl.tenant_id`, returns `isDemo`/`demoExpiresAt` in row spread |
| `GET /api/directory/search` | `apps/api/src/routes/directory-v2.ts` | Already joins `tenants t`; added `t.is_demo, t.demo_expires_at` to SELECT + camelCase transform |
| `GET /api/directory/consolidated/:slug` | `apps/api/src/routes/directory-consolidated.ts` | Added `LEFT JOIN tenants t` to listing query; `transformedListing` includes `isDemo`/`demoExpiresAt` |
| `GET /api/directory/categories/:categoryId/stores` | `apps/api/src/routes/directory-optimized.ts` | Subquery: `(SELECT is_demo FROM tenants WHERE id = tenant_id) as is_demo` (MV doesn't have `is_demo` column) |
| `GET /api/directory/search` (optimized) | `apps/api/src/routes/directory-optimized.ts` | Same subquery pattern on `directory_category_products` MV |
| Shop page data | `apps/api/src/services/ShopService.ts` | `getShopByIdentifier()` already joins `tenants t`; added `t.is_demo, t.demo_expires_at` to SELECT + `unifiedShop` |

**Phase 2 (deferred):** Add `is_demo`/`demo_expires_at` directly to `mv_global_discovery`, `mv_storefront_discovery`, and `directory_category_products` MV definitions to eliminate per-row subqueries. Requires MV drop/recreate/refresh.

## DemoTenantService

`apps/api/src/services/DemoTenantService.ts` manages the full demo tenant lifecycle:
- Creates demo tenants with `is_demo = true`, `demo_expires_at`, `demo_template`, `demo_source_tenant_id`
- Provides demo tenant retrieval and management methods
- Demo tenants use the same tables and relationships as regular tenants

## Testing Checklist

- [ ] Non-demo tenant: no badge renders on any surface
- [ ] Demo tenant (no expiry): badge renders with "This is a demo profile" tooltip
- [ ] Demo tenant (with expiry): badge renders with "Expires MM/DD/YYYY" tooltip
- [ ] Dashboard: badge appears next to page title `<h1>`
- [ ] Storefront (all layout variants): badge appears next to business name
- [ ] Directory entry (all 4 layouts): badge appears next to business name
- [ ] Tenant scope header: badge appears next to tenant name
- [ ] Dark mode: badge styles adapt (amber-900/amber-300 for dark)
- [ ] StoreCard: badge appears when listing data includes `isDemo` (directory routes now return this)
