# Settings ↔ Sidebar Navigation Alignment Audit

> **Date:** 2026-06-21  
> **Scope:** Compare every href in `PlatformSettings.tsx` cards, `UniversalNavContent.tsx` sidebar, `AdminNavContent.tsx` sidebar, and `DynamicTenantSidebar.tsx` sidebar against actual route files in `apps/web/src/app/`.

## 1. PlatformSettings Cards — Broken Hrefs

**File:** `apps/web/src/components/settings/PlatformSettings.tsx`

| Card Title | Card Href | Actual Route | Status |
|---|---|---|---|
| Location Limits | `/settings/limits` | `/settings/admin/limits/page.tsx` | **BROKEN** — missing `/admin/` segment |
| Test User Management | `/admin/users` | `/app/admin/users/page.tsx` | **MISMATCH** — works but inconsistent with "Platform User Maintenance" card which links to `/settings/admin/users` |

### Fix: Location Limits
```
-  href: '/settings/limits',
+  href: '/settings/admin/limits',
```

### Fix: Test User Management
Either consolidate with "Platform User Maintenance" (both → `/settings/admin/users`) or change to `/settings/admin/users` for consistency.

---

## 2. Universal Sidebar — Broken & Duplicate Hrefs

**File:** `apps/web/src/components/navigation/UniversalNavContent.tsx` → `buildNavItems()`

### 2a. Non-existent Routes

| Nav Label | Href | Status |
|---|---|---|
| Quick Inventory | `/settings/quick-inventory` | **BROKEN** — no page exists. Actual scan page is at `/settings/scan` |
| Barcode Scanner | `/settings/quick-inventory/scan` | **BROKEN** — no page exists. Actual scan page is at `/settings/scan` |
| Onboarding | `/onboarding` | **BROKEN** — no page exists in `apps/web/src/app/` |
| Category Discovery | `/categories` | **BROKEN** — no page exists. Actual route is `/category-discovery` |

### 2b. Duplicate Hrefs (same destination, different labels)

| Label | Href | Issue |
|---|---|---|
| Directory | `/directory` | OK |
| Shops | `/directory` | **DUPLICATE** — same as Directory, misleading label |
| Branding | `/settings/appearance` | **DUPLICATE** — same as Appearance in Preferences section |
| Payment Settings | `/settings/subscription` | **DUPLICATE** — same as Subscription in My Account section |
| Dashboard | `/` | **DUPLICATE** — same as Platform Home |
| My Profile | `/settings/account` | **DUPLICATE** — same as Profile in My Account |
| My Locations | `/tenants` | **DUPLICATE** — appears in both Platform section and Tenant Management card |
| Support | `/settings/contact` | **DUPLICATE** — same as Contact & Support section |

### 2c. Recommended Fixes

1. **Remove the entire "Platform" expandable section** (lines 262–281) — every child link is either a duplicate of an existing nav item or a broken route. The section adds no value.
2. **Fix Quick Inventory**: change href to `/settings/scan` and remove the child "Barcode Scanner" entry (scan page is already the top-level).
3. **Remove "Onboarding"** and **"Category Discovery"** entries — routes don't exist.

---

## 3. Admin Sidebar — Broken Hrefs

**File:** `apps/web/src/components/navigation/AdminNavContent.tsx` → `buildAdminNavItems()`

| Nav Label | Href | Actual Route | Status |
|---|---|---|---|
| Manual Billing | `/settings/admin/billing` | `/settings/admin/billing/page.tsx` and `/settings/admin/billing/manual-billing/page.tsx` | **DUPLICATE** — should be `/settings/admin/billing/manual-billing` |
| Payment Settings | `/settings/admin/payment-settings` | `/settings/admin/payment/page.tsx` | **BROKEN** — wrong path, should be `/settings/admin/payment` |
| Store Categories | `/settings/admin/store-categories` | — | **BROKEN** — no page exists |
| Product Intelligence | `/settings/admin/product-intelligence` | — | **BROKEN** — no page exists |

### Recommended Fixes

1. **Manual Billing**: change href to `/settings/admin/billing/manual-billing`
2. **Payment Settings**: change href to `/settings/admin/payment`
3. **Store Categories**: remove entry or create the page
4. **Product Intelligence**: remove entry or create the page

---

## 4. Tenant Sidebar — Spot Check

**File:** `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` → `buildTenantNav()`

The tenant sidebar uses dynamic `/t/${currentTenantId}/...` paths. A full verification requires checking each tenant-scoped route, but the structure appears consistent — all paths follow the `/t/[tenantId]/...` pattern that maps to `apps/web/src/app/t/[tenantId]/...`.

No broken hrefs were identified in the tenant sidebar during this audit pass. A deeper route-by-route check is recommended for a future pass.

---

## 5. Summary of Action Items

### High Priority (Broken Routes — user clicks → 404)

| # | Source | Label | Bad Href | Fix |
|---|---|---|---|---|
| 1 | PlatformSettings card | Location Limits | `/settings/limits` | → `/settings/admin/limits` |
| 2 | Universal sidebar | Quick Inventory | `/settings/quick-inventory` | → `/settings/scan` |
| 3 | Universal sidebar | Barcode Scanner | `/settings/quick-inventory/scan` | → remove (parent covers it) |
| 4 | Universal sidebar | Onboarding | `/onboarding` | → remove |
| 5 | Universal sidebar | Category Discovery | `/categories` | → `/category-discovery` or remove |
| 6 | Admin sidebar | Payment Settings | `/settings/admin/payment-settings` | → `/settings/admin/payment` |
| 7 | Admin sidebar | Store Categories | `/settings/admin/store-categories` | → remove or create page |
| 8 | Admin sidebar | Product Intelligence | `/settings/admin/product-intelligence` | → remove or create page |

### Medium Priority (Duplicate/Misleading Hrefs)

| # | Source | Label | Href | Issue |
|---|---|---|---|---|
| 9 | Admin sidebar | Manual Billing | `/settings/admin/billing` | Should be `/settings/admin/billing/manual-billing` |
| 10 | Universal sidebar | Shops | `/directory` | Duplicate of Directory |
| 11 | Universal sidebar | Branding | `/settings/appearance` | Duplicate of Appearance |
| 12 | Universal sidebar | Payment Settings | `/settings/subscription` | Duplicate of Subscription |
| 13 | Universal sidebar | Platform section (entire) | multiple | All children are duplicates or broken — remove section |
| 14 | PlatformSettings card | Test User Management | `/admin/users` | Inconsistent with Platform User Maintenance → `/settings/admin/users` |

### Low Priority (Cleanup)

- Remove the "Platform" expandable section from `buildNavItems()` entirely (items 10–13 above are all within this section)
- Consolidate "Test User Management" and "Platform User Maintenance" cards in PlatformSettings into a single card
