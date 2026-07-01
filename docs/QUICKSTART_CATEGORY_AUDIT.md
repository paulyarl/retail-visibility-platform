# Quickstart Category Audit: Storefront Type & Capability Gaps

## Executive Summary

The Quickstart Category Generator has **two systemic gaps**: (1) it is completely unaware of the tenant's effective storefront type (online, retail, service, social), and (2) the backend route uses a legacy tier-feature middleware instead of the unified effective capabilities system. These gaps cause mismatched category templates, broken `service_business` selection, and inconsistent gating between frontend and backend.

---

## Gap 1: Storefront Type Not Consulted

### Problem

The platform resolves a tenant's effective storefront type (`online`, `retail`, `service`, `social`, `flexible`) via `StorefrontTypeResolver` → `EffectiveCapabilities.effective.storefront.effective_type`. This information is **never passed to or used by** the quickstart category flow.

**Impact by storefront type:**

| Storefront Type | Expected Categories | Actual Behavior |
|---|---|---|
| `online` | Digital-friendly categories (electronics, media, software) | Gets generic retail categories (fresh produce, deli) |
| `retail` | Physical goods categories (grocery, fashion, hardware) | Works correctly by coincidence — most templates are retail-oriented |
| `service` | Service categories (consultations, repairs, appointments) | `service_business` is **missing from backend schema** (Gap 3) |
| `social` | Social-commerce-friendly categories (fashion, beauty, trending items) | Gets generic categories with no social commerce alignment |

### Affected Files

- **Backend route**: `apps/api/src/routes/quick-start.ts:529` — `categoryQuickStartSchema` accepts `businessType` but never reads storefront type
- **Backend templates**: `apps/api/src/routes/quick-start.ts:627-791` — `taxonomyBranches` and `categoryTemplates` are keyed only by `businessType`, not storefront type
- **Frontend page**: `apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx:190-305` — no `useStorefrontType` hook called, no storefront type passed to generate request
- **Frontend modal**: `apps/web/src/components/quick-start/QuickStartCategoryModal.tsx:1-124` — accepts only `businessType` + `categoryCount`, no storefront type awareness
- **BusinessTypeSelector**: `apps/web/src/components/quick-start/BusinessTypeSelector.tsx:1-140` — 20 business types listed with no storefront type filtering

### What Should Happen

1. **Category template selection** should consider storefront type alongside business type. A `service` storefront should filter out physical-goods-only categories. A `social` storefront should prioritize visually-driven categories.
2. **Business type list** should be filtered by storefront type. A `service` storefront should surface `service_business` first. A `retail` storefront should hide `service_business`.
3. **Default category count** should vary by storefront type (service storefronts need fewer categories).

---

## Gap 2: Backend Uses Legacy Tier Feature Middleware

### Problem

The backend category quick-start route uses `requireTierFeature('category_quick_start')` — the **old tier-feature middleware** that queries `tier_features_list` directly via `checkTierAccessWithOverrides()`.

The frontend uses `useQuickstartOptionsCapability(tenantId)` → checks `canUseCategoryGenerator` — the **new effective capabilities system** that merges tier features + merchant preferences + cross-capability constraints.

These two systems can disagree:

| Scenario | Frontend (Effective Caps) | Backend (Legacy Tier) | Result |
|---|---|---|---|
| Merchant disables `quickstart_category_generator` in settings | `canUseCategoryGenerator = false` → shows upgrade gate | `requireTierFeature` only checks tier, ignores merchant pref | **Frontend blocks, backend allows** — inconsistent |
| Subscription frozen/canceled | `effective.quickstart.enabled = false` (EffectiveCapabilityResolver:269) | `requireTierFeature` checks `subscription_status === 'canceled' \|\| 'expired'` but NOT `frozen` | **Frozen tenant: frontend blocks, backend allows** |
| CCL constraint blocks quickstart | `constraint_status.quickstart.blocked_types` could include category_generator | No CCL check in `requireTierFeature` | **CCL violations ignored by backend** |
| BSaaS purchased `quickstart_category_generator` | EffectiveCapabilityResolver merges purchased features (line 407-450) | `checkTierAccessWithOverrides` may not check `tenant_feature_purchases` | **Purchased feature: frontend allows, backend may block** |

### Affected Files

- **Backend route**: `apps/api/src/routes/quick-start.ts:529` — `requireTierFeature('category_quick_start')`
- **Middleware**: `apps/api/src/middleware/tier-access.ts:319-413` — `requireTierFeature` implementation (legacy `checkTierAccessWithOverrides`)
- **Frontend gate**: `apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx:199-200` — `useQuickstartOptionsCapability` + `hasCategoryQuickStart`

### What Should Happen

The backend route should validate access using `resolveEffectiveCapabilities(tenantId)` and check `effective.quickstart.can_use_category_generator` instead of `requireTierFeature('category_quick_start')`. This ensures:
- Merchant preferences are respected
- Subscription status (including frozen) is enforced
- CCL constraints are evaluated
- BSaaS purchased features are recognized

---

## Gap 3: `service_business` Missing from Category Quick-Start Schema

### Problem

The **product** quick-start schema includes `service_business`:
```
apps/api/src/routes/quick-start.ts:107-113  (product schema — includes 'service_business')
apps/api/src/lib/quick-start.ts:680         (service_business product templates exist)
```

The **category** quick-start schema does NOT include `service_business`:
```
apps/api/src/routes/quick-start.ts:505-525  (category schema — 18 types, no 'service_business')
apps/api/src/routes/quick-start.ts:627-791  (taxonomyBranches + categoryTemplates — no service_business keys)
```

The **frontend** `BusinessTypeSelector.tsx` includes `service_business` (line 34), but the **frontend** `categories/quick-start/page.tsx` has its own hardcoded `businessTypes` array (lines 32-185) that also omits `service_business`.

**Impact:** If a tenant selects "Service Business" in the `BusinessTypeSelector` (used by `QuickStartCategoryModal`), the backend rejects the request with a Zod validation error because `service_business` is not in the `categoryQuickStartSchema` enum.

### Affected Files

- **Backend schema**: `apps/api/src/routes/quick-start.ts:505-525` — `categoryQuickStartSchema` enum missing `service_business`
- **Backend templates**: `apps/api/src/routes/quick-start.ts:627-791` — no `service_business` entry in `taxonomyBranches` or `categoryTemplates`
- **Frontend page**: `apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx:11-30` — `BusinessType` union type missing `service_business`
- **Frontend page**: `apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx:32-185` — `businessTypes` array missing `service_business`

---

## Gap 4: Duplicated Business Type Definitions

### Problem

Business types are defined in **three places** with drift:

| Source | File | Count | Has `service_business`? |
|---|---|---|---|
| `BusinessTypeSelector.tsx` | `apps/web/src/components/quick-start/BusinessTypeSelector.tsx:15-36` | 20 | Yes |
| `categories/quick-start/page.tsx` | `apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx:32-185` | 18 | No |
| `quick-start.ts` (product schema) | `apps/api/src/routes/quick-start.ts:107-113` | 20 | Yes |
| `quick-start.ts` (category schema) | `apps/api/src/routes/quick-start.ts:505-525` | 18 | No |

The `categories/quick-start/page.tsx` has a completely separate hardcoded array with different field names (`categoryCount` vs `defaultCategoryCount`, `examples` vs `description`) instead of importing from `BusinessTypeSelector`.

### What Should Happen

Single source of truth: `BusinessTypeSelector.tsx` `BUSINESS_TYPES` should be the canonical list. The `categories/quick-start/page.tsx` should import from it rather than maintaining its own copy.

---

## Gap 5: No CCL Constraint Between Quickstart and Storefront Type

### Problem

The Cross-Capability Constraint Layer (CCL) registry in `CapabilityConstraintRegistry.ts` has 6 constraints involving storefront types, product types, fulfillment, and social commerce. **None involve the quickstart capability.**

There is no constraint like:
- `storefront.type = service` → `quickstart.category_generator` should recommend service-friendly business types
- `storefront.type = social` → `quickstart.category_generator` should recommend social-friendly business types

### What Should Happen

Add CCL constraints (severity: `warn`) that surface recommendations when a tenant's storefront type doesn't align with their quickstart category selection. This would show warnings in the settings UI via `PlanSummaryPanel` constraint warnings.

---

## Gap 6: Quickstart Settings Page Ignores Storefront Type

### Problem

`QuickstartOptionsSettingsClient.tsx` shows the category generator toggle and "Manage Categories" quick action link without checking the tenant's storefront type. A `service` storefront tenant sees the same category generator UI as a `retail` tenant, with no indication that their storefront type should influence their category choices.

### Affected Files

- `apps/web/src/app/t/[tenantId]/settings/quickstart-options/QuickstartOptionsSettingsClient.tsx:250-273` — Category Quick Start card has no storefront type context
- `apps/web/src/app/t/[tenantId]/settings/quickstart-options/QuickstartOptionsSettingsClient.tsx:54-92` — `getQuickActions` doesn't consider storefront type

---

## Gap 7: No Storefront Type Filtering in QuickStartCategoryModal

### Problem

`QuickStartCategoryModal.tsx` renders `BusinessTypeSelector` with all 20 business types regardless of the tenant's storefront type. A `service` storefront tenant sees "Grocery Store", "Fashion Boutique", etc. with no filtering or prioritization.

### What Should Happen

The modal should accept a `storefrontType` prop and either:
- Filter business types to those appropriate for the storefront type
- Reorder business types to prioritize matches
- Show an informational banner about storefront type alignment

---

## Summary of Actionable Fixes

| # | Gap | Severity | Effort | Fix |
|---|---|---|---|---|
| 1 | Storefront type not consulted | **High** | Medium | Pass `effective_type` from `EffectiveCapabilities` into category generation; filter/adjust templates by storefront type |
| 2 | Backend uses legacy tier middleware | **High** | Small | Replace `requireTierFeature('category_quick_start')` with `resolveEffectiveCapabilities` check on `effective.quickstart.can_use_category_generator` |
| 3 | `service_business` missing from category schema | **High** | Small | Add `service_business` to `categoryQuickStartSchema` enum + add service category templates |
| 4 | Duplicated business type definitions | **Medium** | Small | Import `BUSINESS_TYPES` from `BusinessTypeSelector` in `categories/quick-start/page.tsx` instead of maintaining separate array |
| 5 | No CCL constraint for quickstart ↔ storefront | **Low** | Small | Add `recommends` constraints to `CAPABILITY_CONSTRAINTS` registry |
| 6 | Settings page ignores storefront type | **Medium** | Small | Add storefront type context to category card in `QuickstartOptionsSettingsClient` |
| 7 | Modal doesn't filter by storefront type | **Medium** | Medium | Accept `storefrontType` prop in `QuickStartCategoryModal`, filter/prioritize business types |

---

## Recommended Implementation Order

1. **Fix 3** (add `service_business` to category schema) — unblocks service tenants immediately
2. **Fix 2** (replace legacy middleware) — ensures consistent gating, security fix
3. **Fix 4** (deduplicate business types) — prevents future drift
4. **Fix 1** (storefront type-aware category generation) — core UX improvement
5. **Fix 7** (modal filtering) — frontend UX for Fix 1
6. **Fix 6** (settings page context) — informational improvement
7. **Fix 5** (CCL constraints) — nice-to-have, adds warnings
