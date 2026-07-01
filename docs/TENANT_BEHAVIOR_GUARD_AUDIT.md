# Tenant Behavior Guard — Audit & Regression Report

## Overview

Comprehensive audit of all capability-altering entrance points to verify RBAC enforcement across frontend pages, API routes, sidebar navigation, and settings cards.

**Audit Date:** 2026-06-30  
**Sprint:** Tenant Behavior Guard (Phases 1–6)  
**Status:** ✅ All phases complete

---

## 1. Entrance Point Audit

### 1.1 Frontend Pages — TenantGuard Wrappers

All capability-altering settings pages are wrapped with `TenantGuard` (using `AccessPresets.CAN_MANAGE_TENANT_SETTINGS`) or use `useAccessControl` directly.

| Page | Guard | Status |
|------|-------|--------|
| `settings/barcode-scan-options` | `TenantGuard` | ✅ |
| `settings/commerce` | `TenantGuard` | ✅ |
| `settings/faq-control-panel` | `TenantGuard` | ✅ |
| `settings/featured-options` | `TenantGuard` | ✅ |
| `settings/featured-store` | `TenantGuard` | ✅ |
| `settings/fulfillment` | `TenantGuard` | ✅ |
| `settings/integration-options` | `TenantGuard` | ✅ |
| `settings/product-options` | `TenantGuard` | ✅ |
| `settings/product-types` | `TenantGuard` | ✅ |
| `settings/quickstart-options` | `TenantGuard` | ✅ |
| `settings/social-commerce` | `TenantGuard` | ✅ |
| `settings/storefront-options` | `TenantGuard` | ✅ |
| `settings/storefront-type-options` | `TenantGuard` | ✅ |
| `settings/payment-gateways` | `useAccessControl` | ✅ |
| `settings/branding` | `useAccessControl` | ✅ |
| `settings/tenant` (Store Profile) | `useAccessControl` | ✅ |
| `settings/gbp-category` | `useAccessControl` | ✅ |
| `settings/propagation` | `useAccessControl` | ✅ |
| `settings/users` (Team Members) | `useAccessControl` | ✅ |
| `settings/subdomain` + `verify` | `useAccessControl` | ✅ |
| `settings/integrations` (all sub-routes) | `useAccessControl` | ✅ |
| `settings/admin/flags` | `useAccessControl` | ✅ |
| `bot` (dashboard) | `TenantGuard` | ✅ |
| `bot/config` | `TenantGuard` | ✅ (added in Phase 6) |
| `faq/options` | `TenantGuard` | ✅ (added in Phase 6) |

### 1.2 API Routes — `requireTenantAdmin` Middleware

All capability-altering PUT/POST routes have `requireTenantAdmin` middleware applied.

| Route File | Method | Path | Status |
|------------|--------|------|--------|
| `storefront-options-settings.ts` | PUT | `/:tenantId/storefront-options` | ✅ |
| `storefront-type-settings.ts` | PUT | `/:tenantId/storefront-type` | ✅ |
| `product-options-settings.ts` | PUT | `/:tenantId/product-options` | ✅ |
| `product-type-settings.ts` | PUT | `/:tenantId/product-type` | ✅ |
| `featured-options-settings.ts` | PUT | `/:tenantId/featured-options` | ✅ |
| `integration-options-settings.ts` | PUT | `/:tenantId/integration-options` | ✅ |
| `quickstart-options-settings.ts` | PUT | `/:tenantId/quickstart-options` | ✅ |
| `barcode-scan-settings.ts` | PUT | `/:tenantId/barcode-scan` | ✅ |
| `fulfillment-settings.ts` | PUT | `/:tenantId/fulfillment-settings` | ✅ |
| `commerce-settings.ts` | PUT | `/:tenantId/commerce-settings` | ✅ |
| `social-commerce-options-settings.ts` | PUT | `/:tenantId/social-commerce-options` | ✅ |
| `storefront-policies.ts` | PUT | `/:tenantId/storefront-policies` | ✅ |
| `bot-merchant.ts` | PUT | `/config` | ✅ |
| `featured-placements.ts` | POST | `/tenants/:tenantId/featured-placements` | ✅ |
| `featured-placements.ts` | POST | `/tenants/:tenantId/featured-placements/:purchaseId/renew` | ✅ |

**GET routes remain open** — All authenticated tenant members can read capability settings. Only write operations are gated.

### 1.3 Sidebar Navigation — `requiredGroup: 'IS_TENANT_ADMIN'` Filtering

`DynamicTenantSidebar` uses `useTenantBehaviorAccess(tenantId)` to get `canEdit`. When `!canEdit`, `filterByTenantRole` removes all items with `requiredGroup: 'IS_TENANT_ADMIN'`.

| Nav Item | `requiredGroup` | Status |
|----------|-----------------|--------|
| My Inventory → Featured Products | `IS_TENANT_ADMIN` | ✅ |
| My Inventory → Featured Store | `IS_TENANT_ADMIN` | ✅ |
| My Inventory → Custom Badges | `IS_TENANT_ADMIN` | ✅ |
| My Storefront → Branding | `IS_TENANT_ADMIN` | ✅ |
| My Storefront → Store Hours | `IS_TENANT_ADMIN` | ✅ |
| My Storefront → Business Category | `IS_TENANT_ADMIN` | ✅ |
| My Storefront → Location Status | `IS_TENANT_ADMIN` | ✅ |
| FAQ → FAQ Options | `IS_TENANT_ADMIN` | ✅ |
| Bot → Configuration | `IS_TENANT_ADMIN` | ✅ |
| My Integrations (parent) | `IS_TENANT_ADMIN` | ✅ (pre-existing) |
| My Settings (parent) | `IS_TENANT_MANAGER` | ✅ (pre-existing) |
| Customer Portal → Fulfillment Options | `IS_TENANT_MANAGER` | ✅ (pre-existing) |

### 1.4 TenantSettings Cards — `accessOptions.roles` Enforcement

`UnifiedSettings` uses `useTenantBehaviorAccess(config.tenantId)` to get `canEdit`. Cards with `accessOptions.roles` including `'admin'` render disabled (greyed, no click, lock badge, "Admin access required" tooltip) when `!canEdit`.

| Card Group | Card | `accessOptions` | Status |
|------------|------|-----------------|--------|
| Subscription & Billing | My Subscription | `{ roles: ['admin', 'support'] }` | ✅ |
| Organization | Organization Dashboard | `{ orgMember: true }` | ✅ (org-based) |
| Organization | Propagation Settings | `{ chainPropagation: true }` | ✅ (org-based) |
| Store Settings | Setup Store | `{ roles: ['admin', 'support'] }` | ✅ (added Phase 4) |
| Store Settings | Store Profile | `{ roles: ['admin', 'support'] }` | ✅ (added Phase 4) |
| Store Settings | Location Status | `{ roles: ['admin', 'support'] }` | ✅ |
| Store Settings | Branding | `{ roles: ['admin', 'support'] }` | ✅ (added Phase 4) |
| Store Settings | Product Options | `{ roles: ['admin', 'support'] }` | ✅ |
| Store Settings | Custom Subdomain | `{ roles: ['admin', 'support'] }` | ✅ |
| Featured Products | Featured Options | `{ roles: ['admin', 'support'] }` | ✅ |
| Featured Products | Directory Featured Products | `{ roles: ['admin', 'support'] }` | ✅ |
| Featured Products | Storefront Featured Products | `{ roles: ['admin', 'support'] }` | ✅ |
| Featured Products | Inventory Featured Products | `{ roles: ['admin', 'support'] }` | ✅ |
| Featured Products | Featured Store | `{ roles: ['admin', 'support'] }` | ✅ |
| Team Management | Team Members | `{ roles: ['admin', 'support'] }` | ✅ |
| Store Configuration | Store Hours | `{ roles: ['admin', 'support'] }` | ✅ |
| Store Configuration | Business Category | `{ roles: ['admin', 'support'] }` | ✅ |
| Store Configuration | Product Categories | `{ roles: ['admin', 'support'] }` | ✅ |
| Store Configuration | Directory Listing | `{ roles: ['admin', 'support'] }` | ✅ |
| Customer Portal | Order Management | `{ roles: ['admin', 'support'] }` | ✅ |
| Customer Portal | Payment Gateways | `{ roles: ['admin', 'support'] }` | ✅ |
| Customer Portal | Fulfillment Options | `{ roles: ['admin', 'support'] }` | ✅ |
| Customer Portal | Commerce Settings | `{ roles: ['admin', 'support'] }` | ✅ |
| Integrations | Integration Options | `{ roles: ['admin', 'support'] }` | ✅ |
| Google Integration | Google Merchant Center | `{ roles: ['admin', 'support'] }` | ✅ |
| Google Integration | Feed Validation | `{ roles: ['admin', 'support'] }` | ✅ |

### 1.5 Dashboard Components — `readOnly` Prop

| Component | `readOnly` Prop | Status |
|-----------|-----------------|--------|
| `PlanSummaryPanel` | Disables capability card navigation links | ✅ |
| `CapabilityShowcase` | Replaces `Link` with non-clickable `div` | ✅ |
| `TenantDashboardV2` | Passes `readOnly={!canEdit}` from `useTenantBehaviorAccess` | ✅ |
| `TenantDashboard` | Passes `readOnly={!canManageSettings}` from `canManageTenantSettings` | ✅ |

---

## 2. E2E Test Matrix

| Entrance Point | TENANT_ADMIN / OWNER | TENANT_MANAGER | TENANT_MEMBER | TENANT_VIEWER |
|---------------|---------------------|----------------|---------------|---------------|
| Capability settings pages | ✅ Full access | 🚫 AccessDenied | 🚫 AccessDenied | 🚫 AccessDenied |
| PlanSummaryPanel links | Clickable | Read-only | Read-only | Read-only |
| CapabilityShowcase links | Clickable | Read-only | Read-only | Read-only |
| TenantSettings cards | Clickable | Disabled (lock icon) | Disabled (lock icon) | Disabled (lock icon) |
| Sidebar nav links (admin) | Visible | Hidden | Hidden | Hidden |
| Sidebar nav links (manager) | Visible | Visible | Hidden | Hidden |
| Sidebar nav links (general) | Visible | Visible | Visible | Visible |
| API PUT/POST | 200 | 403 | 403 | 403 |
| API GET | 200 | 200 | 200 | 200 |

**Roles with admin access:** OWNER, TENANT_ADMIN, TENANT_OWNER, PLATFORM_ADMIN, PLATFORM_SUPPORT, ADMIN  
*(Defined by `IS_TENANT_ADMIN` group in `rbac.ts`)*

---

## 3. Regression Check

| Check | Result |
|-------|--------|
| `pnpm checkweb` (tsc --noEmit --project apps/web) | ✅ Zero errors |
| `pnpm checkapi` (tsc --noEmit --project apps/api) | ✅ Zero errors |

**Note:** Two pre-existing errors in `DemoTenantService.ts` were resolved by another agent during this sprint.

---

## 4. Architecture Summary

### Access Control Layers (Defense in Depth)

```
Layer 1: Sidebar Navigation     → filterByTenantRole() hides admin links
Layer 2: TenantSettings Cards   → UnifiedSettings disables cards with lock icon
Layer 3: Dashboard Components   → readOnly prop disables interactive elements
Layer 4: Page-Level Guard       → TenantGuard shows AccessDenied page
Layer 5: API Middleware         → requireTenantAdmin returns 403
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `TenantGuard` | `apps/web/src/components/tenant/TenantGuard.tsx` | Page-level access guard |
| `TenantBehaviorGuard` | `apps/web/src/components/tenant/TenantBehaviorGuard.tsx` | Inline UI guard |
| `useTenantBehaviorAccess` | `apps/web/src/hooks/tenant-access/useTenantBehaviorAccess.ts` | Hook returning `canEdit`, `loading`, `tenantRole` |
| `requireTenantAdmin` | `apps/api/src/middleware/permissions.ts` | API middleware for role enforcement |
| `UnifiedSettings` | `apps/web/src/components/settings/UnifiedSettings.tsx` | Settings card renderer with role enforcement |
| `DynamicTenantSidebar` | `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` | Sidebar with tenant role filtering |

### Authorized Roles

The `IS_TENANT_ADMIN` role group (defined in `apps/web/src/config/rbac.ts`) includes:
- `OWNER`
- `TENANT_ADMIN`
- `TENANT_OWNER`
- `PLATFORM_ADMIN`
- `PLATFORM_SUPPORT`
- `ADMIN`

These roles get `canEdit: true` from `useTenantBehaviorAccess`, granting full access to all capability-altering entrance points.
