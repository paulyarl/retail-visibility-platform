# Featured Type Audit — Gaps and Alignment Opportunities

## Audit Date: June 2026
## Status: Complete — recommendations for future alignment

---

## Executive Summary

The `featured` badge type has a unique architecture built around it that predates the badge registry. It includes tenant-level approval, product-level approval, UI gating, and bucket context. While the badge registry (Phase 0) successfully unified badge metadata, the `featured` type's approval workflow remains a parallel system with hardcoded checks. This audit identifies 7 gaps and recommends alignment steps.

---

## Current Architecture

### Tenant-Level Approval

Four columns on `tenants` table control merchant access to the `featured` badge type:
- `featured_access_approved` (Boolean, default false)
- `featured_access_approved_by` (String, FK to users)
- `featured_access_approved_at` (Timestamp)
- `featured_access_rejection_reason` (String)

**API endpoints:**
- `POST /api/featured-products/tenants/:id/approve-featured-access` — admin approves tenant
- `POST /api/featured-products/tenants/:id/reject-featured-access` — admin rejects with reason
- `GET /api/featured-products/tenants/all-with-featured-access-status` — all tenants + status
- `GET /api/featured-products/tenants/pending-featured-access` — pending tenants only
- `GET /api/featured-products/tenants/:tenantId/featured-access-status` — single tenant status
- `POST /api/featured-products/tenants/:tenantId/request-featured-access` — tenant self-request

**Frontend services:**
- `AdminFeaturedApprovalService.ts` — admin-side approve/reject/list
- `TenantFeaturedAccessService.ts` — tenant-side access status + products with approval

**Admin UI:**
- `/settings/admin/featured-products` — 4 tabs: Overview, Store Featured, Directory Featured, Featured Approval
- Approval tab has two sub-tabs: tenant approval and product approval
- Tenant cards show: name, tier, subscription status, approval status (Approved/Rejected/Pending)
- Product cards show: product info, tenant info, featured type, approval status

### Product-Level Approval

Three columns on `featured_products` table:
- `admin_approved` (Boolean, default false)
- `approved_by` (String, FK to users)
- `approved_at` (Timestamp)

**API endpoints:**
- `POST /api/featured-products/:productId/approve` — admin approves product
- `POST /api/featured-products/:productId/reject` — admin rejects with reason
- `GET /api/featured-products/all-featured-products` — all products with approval status

**Note:** Bulk-imported featured products default to `admin_approved: true` (line 1210 in `FeaturedProductsService.ts`). Individual manual assignments default to `admin_approved: false`.

### UI Gating in FeaturedProductsManager

`FeaturedProductsManager.tsx` receives `hasFeaturedAccess` prop. The "Add to Featured" button is:
- **Disabled** with "Approval Required" text when `selectedType === 'featured' && !hasFeaturedAccess`
- **Orange** colored when locked (vs blue when available)
- **Title** shows "Featured access requires approval" when locked

The check is hardcoded: `type.id === 'featured' && (type as any).isPayToPlay` (line 594).

### Bucket Context

`featured_products` has two context columns:
- `bucket_type` (String, default "store_selection") — storefront vs directory context
- `shop_scope_id` (String) — scope identifier for shop-level filtering

Separate admin UIs manage each context:
- `AdminTenantFeaturedManagement` — storefront context
- `AdminDirectoryFeaturedManagement` — directory context

---

## Gaps Identified

### Gap 1: Hardcoded Type Metadata in Admin Page

**Location:** `apps/web/src/app/(platform)/settings/admin/featured-products/page.tsx`

The admin page has three hardcoded constructs that duplicate the badge registry:

1. `featuredTypeOptions` array (lines 86-98) — 11 hardcoded type options for the filter dropdown
2. `getFeaturedTypeStyle()` function (lines 255-269) — hardcoded color mapping per type
3. `getFeaturedTypeLabel()` function (lines 271-285) — hardcoded label mapping per type

**Impact:** Adding a new badge type or custom badge won't appear in the admin filter dropdown. Colors and labels can diverge between admin page and storefront.

**Recommendation:** Replace with `useSystemBadges()` and `useBadgeMeta()` hooks from `useBadgeRegistry.ts`. The filter dropdown should generate options from the registry. Colors should come from `getBadgeColorClass()`.

### Gap 2: `isPayToPlay` Not in Registry

**Location:** `FeaturedProductsManager.tsx` line 594

```typescript
const isPayToPlay = type.id === 'featured' && (type as any).isPayToPlay;
```

The `isPayToPlay` flag is checked via a type cast on the type object, not stored in the registry. This means:
- Only the `featured` type can be pay-to-play
- The flag is not data-driven — it's hardcoded to `type.id === 'featured'`
- Custom badges can never be pay-to-play

**Recommendation:** Add `requires_tenant_access` boolean column to `featured_type_registry`. The UI checks `badge.requiresTenantAccess` instead of `type.id === 'featured'`. This makes the approval gate data-driven and extensible to other badge types if needed.

### Gap 3: Approval Requirements Not Data-Driven

The registry has no concept of which badges require admin approval. The `admin_approved` column on `featured_products` applies to all types, but the approval workflow UI only surfaces products with `featured_type = 'featured'` (or whatever the admin filters by). There's no registry field that says "this badge type requires admin approval before display."

**Impact:** If a future badge type needs approval (e.g., a "Verified Sustainable" badge that requires admin review), it would require code changes to the admin UI and service layer.

**Recommendation:** Add `requires_admin_approval` boolean column to `featured_type_registry`. When true, products assigned this badge type are created with `admin_approved = false` and appear in the approval queue. When false, products are auto-approved (current behavior for all non-featured types).

### Gap 4: `featured` Type Absent from Auto-Promotion Suggestions

**Location:** `BadgeRegistryService.ts` — `STATIC_BADGE_TYPES` line 52

The `featured` badge has `autoAssignRule: null` and `autoRemoveRule: null`. This means:
- It never appears in auto-promotion suggestions
- The rule engine can't evaluate it
- There's no semantic validation for what qualifies as "featured"

**Impact:** The suggestions page at `/t/[tenantId]/settings/products/badges/suggestions` shows suggestions for sale, new_arrival, clearance, etc., but never for featured. Merchants can't see "products that would qualify for featured if they had access."

**Recommendation:** This is partially intentional — `featured` is a curation badge, not a data-driven one. However, consider adding an optional `suggestion_rule` (separate from `autoAssignRule`) that surfaces candidates without auto-assigning. For example: "products with >100 views and >5% conversion rate but no featured badge" as upsell candidates. This would require a new JSONB column `suggestion_rule` on the registry.

### Gap 5: No Approval Funnel Analytics

Badge analytics track views, clicks, CTR, conversion rate, and revenue per badge. But there's no analytics for the approval workflow itself:
- How many tenants are pending approval?
- What's the approval rate?
- What's the average time-to-approval?
- How many products are pending vs approved vs rejected?
- Does approval status correlate with badge performance?

**Impact:** Admins can't measure the friction of the approval process or its impact on merchant engagement.

**Recommendation:** Add an "Approval Funnel" section to the badge analytics dashboard. Track:
- Pending count (tenants + products)
- Approval rate (approved / total reviewed)
- Average time-to-approval
- Rejection reasons distribution
- Post-approval performance lift (compare badge performance before vs after approval)

This could be a new API endpoint: `GET /api/tenants/:tenantId/badge-analytics/approval-funnel` or a platform-wide admin endpoint.

### Gap 6: `bucket_type` vs `assignment_source` Confusion

`featured_products` has two overlapping concepts:
- `assignment_source` (added in Phase 0) — provenance: `manual`, `auto`, `system`
- `bucket_type` (pre-existing) — context: `store_selection`, directory, etc.
- `shop_scope_id` — scope within a context

These serve different purposes but are not clearly documented. `bucket_type` determines WHERE the badge appears (storefront vs directory). `assignment_source` determines HOW it got there (manual vs auto vs system). New developers may confuse them.

**Impact:** Risk of incorrect filtering. The admin page filters by `bucket_type` but not `assignment_source`. The badge analytics groups by `featured_type` but not `bucket_type`.

**Recommendation:** Document the distinction in the skill document. Consider whether `bucket_type` should be renamed to `display_context` for clarity. No immediate code change needed — just documentation.

### Gap 7: Admin Page Type Filter Hardcoded

**Location:** `page.tsx` lines 86-98

The `featuredTypeOptions` array for the admin filter dropdown is hardcoded with 11 types. Custom badges created by tenants won't appear in this filter. The filter also doesn't distinguish system vs custom badges.

**Impact:** Admin can't filter by custom badge types. If a merchant creates a "Local Made" custom badge, admin can't filter the featured products list to show only products with that badge.

**Recommendation:** Replace with a dynamic dropdown populated from the badge registry. Use `useSystemBadges()` for system types and optionally `useTenantBadges(tenantId)` for tenant-specific types when a tenant is selected.

---

## Alignment Recommendations

### Priority 1: Data-Driven Approval Gates (Gaps 2 + 3)

Add two columns to `featured_type_registry`:
- `requires_tenant_access` (Boolean, default false) — badge requires tenant-level admin approval before use
- `requires_admin_approval` (Boolean, default false) — products with this badge require admin approval before display

Seed the `featured` type with both set to `true`. All other system types default to `false`.

Update `FeaturedProductsManager` to check `badge.requiresTenantAccess` from the registry instead of `type.id === 'featured'`.

Update `addFeaturedType()` in `FeaturedProductsService` to set `admin_approved = false` when the badge type has `requiresAdminApproval = true`, and `admin_approved = true` otherwise.

### Priority 2: Replace Hardcoded Metadata (Gaps 1 + 7)

Replace `featuredTypeOptions`, `getFeaturedTypeStyle()`, and `getFeaturedTypeLabel()` in the admin page with registry lookups. Use `useSystemBadges()` for the filter dropdown and `useBadgeMeta(key)` for style/label.

### Priority 3: Approval Funnel Analytics (Gap 5)

Add an approval funnel view to the badge analytics dashboard. Track pending/approved/rejected counts, approval rate, time-to-approval, and post-approval performance lift.

### Priority 4: Suggestion Rule for Featured (Gap 4)

Add an optional `suggestion_rule` JSONB column to the registry. The rule engine evaluates it for suggestion candidates without auto-assigning. The `featured` type could use this to surface high-performing products as upsell candidates.

### Priority 5: Document `bucket_type` vs `assignment_source` (Gap 6)

Update `meaningful-badge-architecture.md` with a clear distinction between the two columns. No code change needed.

---

## Architecture Decision: Keep or Merge the Approval System?

The `featured` type's approval system (tenant-level + product-level) is a parallel governance layer that the badge architecture doesn't have. The question is whether to:

**Option A: Merge into the badge architecture** — add `requires_tenant_access` and `requires_admin_approval` to the registry, make all approval checks data-driven. The approval workflow stays in `FeaturedProductsService` but is triggered by registry flags.

**Option B: Keep as a special case** — the `featured` type is intentionally special (pay-to-play, premium placement). Its approval system is a business concern, not a badge concern. Document it as an exception.

**Recommendation: Option A.** The badge architecture's core principle is "data-driven, not code-driven." Hardcoding `type.id === 'featured'` violates this principle. Making the approval gates data-driven:
- Costs 2 new columns + ~50 lines of code changes
- Makes the approval system extensible to future badge types
- Eliminates the last hardcoded badge type check in the codebase
- Follows the pattern established in Phase 0 (registry replaces hardcoded arrays)

---

## File Reference

| File | Role | Gap |
|------|------|-----|
| `apps/web/src/app/(platform)/settings/admin/featured-products/page.tsx` | Admin featured management UI | 1, 7 |
| `apps/web/src/components/tenant/FeaturedProductsManager.tsx` | Tenant featured product manager | 2 |
| `apps/web/src/services/AdminFeaturedApprovalService.ts` | Admin approval API service | — |
| `apps/web/src/services/TenantFeaturedAccessService.ts` | Tenant access status service | — |
| `apps/web/src/components/admin/AdminTenantFeaturedManagement.tsx` | Store featured admin | — |
| `apps/web/src/components/admin/AdminDirectoryFeaturedManagement.tsx` | Directory featured admin | — |
| `apps/api/src/routes/featured-products-scored.ts` | Backend approval endpoints | — |
| `apps/api/src/services/FeaturedProductsService.ts` | Backend approval logic | 3 |
| `apps/api/src/services/BadgeRegistryService.ts` | Badge registry (no approval fields) | 2, 3, 4 |
| `apps/api/prisma/schema.prisma` | Schema (tenants + featured_products) | 2, 3, 4, 6 |
