# Quickstart Category Storefront-Awareness — Sprint Plan

## Status: Active
## Date: June 2026
## Source: `QUICKSTART_CATEGORY_AUDIT.md`

---

## Sprint Overview

The audit identified 7 gaps in the quickstart category feature. This plan organizes them into 4 sprints, prioritizing the broken `service_business` schema and legacy middleware first, then storefront type awareness, then discoverability via "What's Next" destinations.

| Sprint | Gaps Addressed | Duration | Goal |
|--------|---------------|----------|------|
| **Sprint 1** | Gaps 3, 2, 4 | 1-2 days | Fix `service_business` schema omission, replace legacy tier middleware with effective capabilities, deduplicate business type definitions |
| **Sprint 2** | Gap 1 | 2-3 days | Make category generation storefront-type-aware: filter templates, adjust counts, pass storefront type through the full stack |
| **Sprint 3** | Gap 7 | 1-2 days | Filter/prioritize business types in `QuickStartCategoryModal` based on storefront type |
| **Sprint 4** | Gaps 5, 6 + Discoverability | 1-2 days | Add CCL constraints, add storefront type context to settings page, add "What's Next" quickstart category destination to both quickstart options and storefront type settings pages |

**Total estimated duration:** 5-9 days

---

## Sprint 1: Schema Fix, Middleware Migration, Deduplication

**Goal:** Unblock service tenants, ensure consistent capability gating between frontend and backend, and eliminate business type drift.

### Tasks

#### 1.1 — Add `service_business` to Category Quick-Start Schema

- **File**: `apps/api/src/routes/quick-start.ts`
- **Lines**: 504-527
- **Changes**:
  - Add `'service_business'` to the `categoryQuickStartSchema` enum (after `'pharmacy'`, before `'general'`)
  - Add `service_business` entry to `taxonomyBranches` (line ~627) with Google Product Taxonomy branches for services:
    ```
    service_business: [
      ['Services'],
      ['Professional Services'],
      ['Business Services'],
    ]
    ```
  - Add `service_business` entry to `categoryTemplates` (line ~700) with service-oriented categories:
    ```
    service_business: [
      { name: 'Consultations', searchTerm: 'consulting professional advisory services' },
      { name: 'Repairs & Maintenance', searchTerm: 'repair maintenance fix service' },
      { name: 'Appointments', searchTerm: 'appointment booking scheduling service' },
      { name: 'Subscriptions', searchTerm: 'subscription service plan recurring' },
    ]
    ```
- **Verification**: POST `/api/v1/tenants/:tenantId/categories/quick-start` with `{ businessType: 'service_business', categoryCount: 4 }` returns 200 with service categories

#### 1.2 — Replace Legacy Tier Middleware with Effective Capabilities

- **File**: `apps/api/src/routes/quick-start.ts`
- **Lines**: 529
- **Changes**:
  - Remove `requireTierFeature('category_quick_start')` from the route middleware chain
  - Add inline effective capabilities check after tenant verification:
    ```typescript
    import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
    
    // After tenant verification (line ~548):
    const effectiveCaps = await resolveEffectiveCapabilities(tenantId);
    if (!effectiveCaps?.effective.quickstart.can_use_category_generator) {
      return res.status(403).json({
        error: 'feature_not_available',
        message: 'Category Quick Start is not available on your plan or has been disabled',
        upgradeUrl: '/settings/subscription',
      });
    }
    ```
  - Keep `authenticateToken` and `requireWritableSubscription` middleware
- **Verification**: Tenant with merchant-pref `quickstart_category_generator: false` gets 403 from backend (previously only frontend blocked)

#### 1.3 — Deduplicate Business Type Definitions

- **File**: `apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx`
- **Lines**: 11-185
- **Changes**:
  - Remove the local `BusinessType` union type (lines 11-30)
  - Remove the local `businessTypes` array (lines 32-185)
  - Import from the canonical source:
    ```typescript
    import { BUSINESS_TYPES, type BusinessType } from '@/components/quick-start/BusinessTypeSelector';
    ```
  - Update all references from `businessTypes` to `BUSINESS_TYPES`
  - Update field access: `categoryCount` → `defaultCategoryCount`, `examples` → `description` (or extend `BusinessType` interface to include `examples` if needed)
  - Add `service_business` to the imported `BUSINESS_TYPES` if not already present (it is — line 34 of `BusinessTypeSelector.tsx`)
- **File**: `apps/web/src/components/quick-start/BusinessTypeSelector.tsx`
- **Changes** (if needed):
  - Add `examples?: string[]` field to `BusinessType` interface if the page needs example display
  - Add `examples` data to each business type entry for richer UI
- **Verification**: Category quick-start page renders identically, uses single source of truth, includes `service_business` option

#### 1.4 — Verification

- Run `npm run checkapi` and `npm run checkweb` — zero TS errors
- Manual test: Select "Service Business" in category quick-start → categories generate successfully
- Manual test: Disable `quickstart_category_generator` in merchant settings → backend rejects with 403

---

## Sprint 2: Storefront-Type-Aware Category Generation

**Goal:** Category templates adapt to the tenant's effective storefront type. A `service` storefront gets service categories, a `social` storefront gets visually-driven categories.

### Tasks

#### 2.1 — Define Storefront-Type-to-Business-Type Mapping

- **File**: `apps/web/src/components/quick-start/BusinessTypeSelector.tsx` (or new file `apps/web/src/lib/storefront-business-mapping.ts`)
- **Changes**:
  - Create a mapping from storefront type to recommended/prioritized business types:
    ```typescript
    export const STOREFRONT_BUSINESS_PRIORITY: Record<string, string[]> = {
      online: ['electronics', 'books_media', 'fashion', 'home_garden', 'general'],
      retail: ['grocery', 'fashion', 'hardware_tools', 'furniture', 'pharmacy', 'general'],
      service: ['service_business', 'general'],
      social: ['fashion', 'health_beauty', 'jewelry', 'electronics', 'general'],
      flexible: [], // no filtering — show all
      none: [], // no filtering — show all
    };
    ```
  - Create a mapping from storefront type to default category count:
    ```typescript
    export const STOREFRONT_DEFAULT_CATEGORY_COUNT: Record<string, number> = {
      online: 12,
      retail: 15,
      service: 4,
      social: 10,
      flexible: 15,
      none: 15,
    };
    ```

#### 2.2 — Pass Storefront Type to Backend Category Generation

- **File**: `apps/api/src/routes/quick-start.ts`
- **Changes**:
  - Add optional `storefrontType` to `categoryQuickStartSchema`:
    ```typescript
    storefrontType: z.enum(['online', 'retail', 'service', 'social', 'flexible', 'none']).optional(),
    ```
  - After resolving `businessType` templates, apply storefront-type adjustments:
    - If `storefrontType === 'service'` and `businessType !== 'service_business'`, prepend service-oriented categories
    - If `storefrontType === 'social'`, boost visually-driven categories (fashion, beauty, jewelry) to the front
    - If `storefrontType === 'online'`, boost digital-friendly categories (electronics, media) to the front
    - Adjust `categoryCount` default based on storefront type if not explicitly provided
  - Log the storefront type for analytics: `console.log('[Category Quick Start] Storefront type:', storefrontType, 'Business type:', businessType)`

#### 2.3 — Update Frontend Services to Pass Storefront Type

- **File**: `apps/web/src/services/AdminCategoriesService.ts`
- **Lines**: 330-384
- **Changes**:
  - Add `storefrontType?: string` parameter to `getQuickStartCategories`
  - Include `storefrontType` in POST body
- **File**: `apps/web/src/services/TenantCategoriesService.ts`
- **Lines**: 335-420
- **Changes**:
  - Add `storefrontType?: string` parameter to `quickStartCategories`
  - Include `storefrontType` in POST body

#### 2.4 — Update Frontend Page to Fetch and Pass Storefront Type

- **File**: `apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx`
- **Changes**:
  - Import `useStorefrontCapability` from `@/hooks/tenant-access/useCapabilityAccess`
  - Fetch storefront type: `const { data: storefrontCap } = useStorefrontCapability(tenantId);`
  - Extract effective type: `const storefrontType = storefrontCap?.effectiveType ?? 'none';`
  - Pass to generate call: `adminCategoriesService.getQuickStartCategories(selectedType, categoryCount, storefrontType)`
  - Use `STOREFRONT_DEFAULT_CATEGORY_COUNT` to adjust default count when storefront type is known
  - Show storefront type badge in the page header: "Storefront: Service" etc.

#### 2.5 — Verification

- Run `npm run checkapi` and `npm run checkweb` — zero TS errors
- Manual test: Tenant with `service` storefront type → quickstart categories page shows service-oriented defaults
- Manual test: Tenant with `retail` storefront type → quickstart categories page shows retail-oriented defaults
- Manual test: Storefront type passed through to backend, category templates adjusted accordingly

---

## Sprint 3: Storefront-Type-Filtered Modal

**Goal:** `QuickStartCategoryModal` filters and prioritizes business types based on the tenant's storefront type.

### Tasks

#### 3.1 — Add Storefront Type Prop to QuickStartCategoryModal

- **File**: `apps/web/src/components/quick-start/QuickStartCategoryModal.tsx`
- **Changes**:
  - Add `storefrontType?: string` to `QuickStartCategoryModalModalProps`
  - Import `STOREFRONT_BUSINESS_PRIORITY` from the mapping file
  - When `storefrontType` is provided and has priority entries:
    - Reorder `BUSINESS_TYPES` so prioritized types appear first
    - Add a visual indicator (badge/icon) on prioritized types: "Recommended for your storefront"
  - When `storefrontType === 'service'`:
    - Show only `service_business` and `general` (filter out physical-goods-only types)
    - Show info banner: "Service storefronts work best with service-oriented categories"
  - When `storefrontType === 'social'`:
    - Move `fashion`, `health_beauty`, `jewelry` to top
    - Show info banner: "Social commerce works best with visually-driven categories"
  - Default `categoryCount` based on `STOREFRONT_DEFAULT_CATEGORY_COUNT[storefrontType]` when available

#### 3.2 — Pass Storefront Type from Consumer Pages

- **File**: `apps/web/src/app/t/[tenantId]/categories/page.tsx`
- **Lines**: 440-489
- **Changes**:
  - Import `useStorefrontCapability`
  - Pass `storefrontType` prop to `QuickStartCategoryModal`
- **File**: `apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx`
- **Changes**:
  - Already has storefront type from Sprint 2.4 — pass it to any modal usage

#### 3.3 — Verification

- Run `npm run checkweb` — zero TS errors
- Manual test: Service storefront tenant → modal shows filtered business types with service first
- Manual test: Social storefront tenant → modal shows fashion/beauty prioritized
- Manual test: Flexible/none storefront tenant → modal shows all types unfiltered

---

## Sprint 4: CCL Constraints, Settings Context & Discoverability

**Goal:** Add cross-capability constraint warnings, show storefront type context on settings pages, and make quickstart category visible as a "What's Next" destination on both the Quickstart Options and Storefront Type settings pages.

### Tasks

#### 4.1 — Add CCL Constraints for Quickstart ↔ Storefront Type

- **File**: `apps/api/src/services/resolvers/CapabilityConstraintRegistry.ts`
- **Changes**: Add 2 new `recommends` constraints (severity: `warn`):
  ```typescript
  // ── Service storefront recommends service_business quickstart categories ──
  {
    id: 'storefront_service_recommends_quickstart_service',
    type: 'recommends',
    severity: 'warn',
    source: {
      capability: 'storefront',
      field: 'effective_type',
      operator: 'equals',
      value: 'service',
    },
    target: {
      capability: 'quickstart',
      field: 'enabled',
      operator: 'is_true',
      value: true,
    },
    message: 'Service storefront works best with service-oriented quickstart categories',
    resolution_hint: 'Use the Service Business type in Category Quick Start for optimal category alignment',
  },
  // ── Social storefront recommends quickstart category generator ──
  {
    id: 'storefront_social_recommends_quickstart_category',
    type: 'recommends',
    severity: 'warn',
    source: {
      capability: 'storefront',
      field: 'effective_type',
      operator: 'equals',
      value: 'social',
    },
    target: {
      capability: 'quickstart',
      field: 'can_use_category_generator',
      operator: 'is_true',
      value: true,
    },
    message: 'Social storefront benefits from quickstart categories for product discovery',
    resolution_hint: 'Enable Category Generator in Quickstart Options and generate fashion/beauty categories',
  },
  ```
- **File**: `database/migrations/067_quickstart_storefront_constraints.sql`
- **Changes**: Insert the 2 new constraints into `capability_constraints_list` table (idempotent with `ON CONFLICT DO NOTHING`)

#### 4.2 — Add Storefront Type Context to Quickstart Options Settings

- **File**: `apps/web/src/app/t/[tenantId]/settings/quickstart-options/QuickstartOptionsSettingsClient.tsx`
- **Changes**:
  - Import `useStorefrontCapability` from `@/hooks/tenant-access/useCapabilityAccess`
  - Fetch storefront type: `const { data: storefrontCap } = useStorefrontCapability(tenantId);`
  - Get effective type: `const storefrontType = storefrontCap?.effectiveType ?? 'none';`
  - In the Category Quick Start card (lines 250-273), add a storefront type context badge:
    ```tsx
    {storefrontType !== 'none' && storefrontType !== 'flexible' && (
      <div className="mt-2 text-xs text-neutral-500 flex items-center gap-1">
        <Store className="h-3 w-3" />
        Storefront type: <strong className="capitalize">{storefrontType}</strong>
        {storefrontType === 'service' && ' — service-oriented categories recommended'}
        {storefrontType === 'social' && ' — visually-driven categories recommended'}
      </div>
    )}
    ```

#### 4.3 — Add Quickstart Category "What's Next" Destination to Quickstart Options Page

- **File**: `apps/web/src/app/t/[tenantId]/settings/quickstart-options/QuickstartOptionsSettingsClient.tsx`
- **Lines**: 54-92 (`getQuickActions` function)
- **Changes**:
  - Update the existing `categories` action to point to the quick-start categories page instead of the generic categories page:
    ```typescript
    if (settings.quickstart_category_generator) {
      actions.push({
        id: 'quick-start-categories',
        label: 'Generate Categories',
        description: 'Auto-generate storefront-aligned categories for your store',
        href: `/t/${tenantId}/categories/quick-start`,
        icon: LayoutGrid,
        variant: 'category',
      });
    }
    ```
  - This replaces the current `categories` action (id: `'categories'`, href: `/t/${tenantId}/categories`)

#### 4.4 — Add Quickstart Category "What's Next" Destination to Storefront Type Settings Page

- **File**: `apps/web/src/app/t/[tenantId]/settings/storefront-type-options/StorefrontTypeOptionsSettingsClient.tsx`
- **Lines**: 32-80 (`getQuickActions` function)
- **Changes**:
  - Add a `category` variant to the `QuickAction` interface:
    ```typescript
    variant: 'general' | 'storefront' | 'category';
    ```
  - Add a quickstart category action that appears when the storefront type is set:
    ```typescript
    // After the type-specific actions and before the storefront-options action:
    actions.push({
      id: 'quick-start-categories',
      label: 'Generate Categories',
      description: 'Quick-start categories aligned with your storefront type',
      href: `/t/${tenantId}/categories/quick-start`,
      icon: LayoutGrid,
      variant: 'category',
    });
    ```
  - Import `LayoutGrid` from `lucide-react`
  - Add `category` variant styles to the rendering block (lines 370-377):
    ```typescript
    const variantStyles = {
      storefront: 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900',
      category: 'bg-purple-50 border-purple-200 hover:border-purple-300 text-purple-900',
      general: 'bg-gray-50 border-gray-200 hover:border-gray-300 text-neutral-900',
    };
    const iconStyles = {
      storefront: 'text-blue-600',
      category: 'text-purple-600',
      general: 'text-neutral-600',
    };
    ```
  - Only show this action when `settings.storefront_type_enabled` is true (already gated by the early return at line 35)

#### 4.5 — Verification

- Run `npm run checkapi` and `npm run checkweb` — zero TS errors
- Manual test: Quickstart Options settings page → "What's Next" shows "Generate Categories" linking to `/t/{tenantId}/categories/quick-start`
- Manual test: Storefront Type settings page → "What's Next" shows "Generate Categories" card with purple styling
- Manual test: Service storefront tenant on quickstart options page → Category card shows "Storefront type: service — service-oriented categories recommended"
- Manual test: CCL constraint warnings appear in `PlanSummaryPanel` for service/social storefront tenants

---

## File Change Summary

| Sprint | File | Type | Description |
|--------|------|------|-------------|
| 1 | `apps/api/src/routes/quick-start.ts` | Edit | Add `service_business` to schema + templates, replace `requireTierFeature` with effective caps check |
| 1 | `apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx` | Edit | Import `BUSINESS_TYPES` from `BusinessTypeSelector`, remove local copy |
| 1 | `apps/web/src/components/quick-start/BusinessTypeSelector.tsx` | Edit | Add `examples?` field if needed |
| 2 | `apps/web/src/lib/storefront-business-mapping.ts` | New | Storefront-to-business-type priority mapping + default counts |
| 2 | `apps/api/src/routes/quick-start.ts` | Edit | Accept `storefrontType`, adjust templates by storefront type |
| 2 | `apps/web/src/services/AdminCategoriesService.ts` | Edit | Add `storefrontType` param to `getQuickStartCategories` |
| 2 | `apps/web/src/services/TenantCategoriesService.ts` | Edit | Add `storefrontType` param to `quickStartCategories` |
| 2 | `apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx` | Edit | Fetch storefront type, pass to generate call, show badge |
| 3 | `apps/web/src/components/quick-start/QuickStartCategoryModal.tsx` | Edit | Accept `storefrontType` prop, filter/prioritize business types |
| 3 | `apps/web/src/app/t/[tenantId]/categories/page.tsx` | Edit | Pass `storefrontType` to modal |
| 4 | `apps/api/src/services/resolvers/CapabilityConstraintRegistry.ts` | Edit | Add 2 quickstart↔storefront CCL constraints |
| 4 | `database/migrations/067_quickstart_storefront_constraints.sql` | New | Seed CCL constraints into DB |
| 4 | `apps/web/src/app/t/[tenantId]/settings/quickstart-options/QuickstartOptionsSettingsClient.tsx` | Edit | Add storefront context to category card, update "What's Next" link |
| 4 | `apps/web/src/app/t/[tenantId]/settings/storefront-type-options/StorefrontTypeOptionsSettingsClient.tsx` | Edit | Add quickstart category "What's Next" destination |

---

## Dependencies

- Sprint 2 depends on Sprint 1 (deduplicated types, `service_business` in schema)
- Sprint 3 depends on Sprint 2 (storefront type prop threaded through services)
- Sprint 4 depends on Sprint 2 (storefront type awareness in frontend)
- Sprint 4.4 (storefront type "What's Next") is independent and can be done in parallel with Sprint 1-3 if needed

## Risk Notes

- **Sprint 1.2** (middleware replacement): Must verify that `resolveEffectiveCapabilities` is performant enough for the quick-start route. It has a 60s in-memory cache (`EffectiveCapabilityResolver.ts:54`) so repeated calls are fast. The first call per tenant does a DB round-trip.
- **Sprint 2.2** (backend storefront adjustments): Category template adjustments should be additive (prepend/reorder), not restrictive — tenants should still be able to select any business type. Storefront type influences defaults and ordering, not hard restrictions.
- **Sprint 4.1** (CCL constraints): New constraints are `recommends`/`warn` severity only — they surface warnings in the UI but don't block actions.
