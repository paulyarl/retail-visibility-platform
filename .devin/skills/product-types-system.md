# Product Types System

## Overview

The product types system controls what kinds of products a tenant can offer on their storefront. There are **4 product types**: `physical`, `digital`, `hybrid`, `service`. Tenants can select **multiple** product types simultaneously (multi-select checkboxes, not radio buttons). Storefront type remains single-select and is a separate capability.

## Two-Capability Architecture

Product types are governed by **two separate capabilities** that work together:

### 1. `product_types` (Entity Gating)
- **Purpose**: Determines which product type entities a tenant is allowed to offer
- **Tier level**: Feature gates `product_types_physical`, `product_types_digital`, `product_types_hybrid`, `product_types_service`, `product_types_flexible`, `product_types_enabled`, `product_types_disabled`
- **Merchant level**: `selected_product_types` (TEXT[] array in `tenant_product_types_settings`) — multi-select checkboxes
- **Resolver output**: `effectiveTypes: ProductType[]` — intersection of tier-allowed and merchant-selected
- **Backward compat**: `effective_type` scalar still computed (first element or 'flexible' if multiple)
- **Settings page**: `/t/[tenantId]/settings/product-types` — `ProductTypeSettingsClient.tsx`

### 2. `product_options` (Display/Behavior Features)
- **Purpose**: Controls per-type display toggles, creation features (variants, gallery, video), page layouts, and page sections
- **Merchant gates**: `product_physical_enabled`, `product_digital_enabled`, `product_hybrid_enabled`, `product_service_enabled`
- **These gates control storefront section visibility** — whether a product type section renders at all
- **Settings page**: `/t/[tenantId]/settings/product-options`

### How They Layer

```
Tier config (product_types) → allowedTypes (what's permitted)
  └─ Merchant selection (selected_product_types) → effectiveTypes (what's chosen)
      └─ Product creation (backend enforces effectiveTypes)
          └─ Storefront display (product_options merchant gates) → show/hide sections
```

A product type must pass ALL layers to appear on the storefront:
1. Tier allows it (`product_types_digital` feature gate)
2. Merchant selected it (`selected_product_types` includes 'digital')
3. Merchant enabled display (`product_digital_enabled` toggle)
4. Products of that type exist in the catalog

## Storefront Section Rendering

All 3 storefront layouts (Classic, Editorial, Immersive) now render **4 product type sections**:

| Section | Component | Gate | Layout Variants |
|---------|-----------|------|-----------------|
| Physical | `EnhancedProductDisplay` | Always shown (default) | All 3 |
| Service | `ServiceSection` | `showServices` = `product_service_enabled` OR `isServiceStore` | All 3 |
| Digital | `DigitalSection` | `showDigital` = `product_digital_enabled` | All 3 |
| Hybrid | `HybridSection` | `showHybrid` = `product_hybrid_enabled` | All 3 |

### Section Components

- **`ServiceSection`** — `@/components/storefront/sections/ServiceSection.tsx` — booking CTAs, duration/location metadata, pricing models
- **`DigitalSection`** — `@/components/storefront/sections/DigitalSection.tsx` — download CTAs, file type/size/license metadata, instant access
- **`HybridSection`** — `@/components/storefront/sections/HybridSection.tsx` — dual-component cards showing both physical and digital attributes

Each section component supports 3 layout variants: `classic`, `editorial`, `immersive` — matching the storefront layout system.

### Product Bucketing

All layouts bucket products by `productType` / `product_type` field into 4 buckets:

```typescript
const { physicalProducts, serviceProducts, digitalProducts, hybridProducts } = useMemo(() => {
  const buckets: Record<string, any[]> = { physical: [], service: [], digital: [], hybrid: [] };
  for (const p of products) {
    const pt = p.productType || p.product_type || 'physical';
    switch (pt) { /* ... */ }
  }
  return { physicalProducts: buckets.physical, serviceProducts: buckets.service, digitalProducts: buckets.digital, hybridProducts: buckets.hybrid };
}, [products]);
```

### Gate Flags Location

- **Classic layout** (`StorefrontClientWrapper.tsx`): Flags computed inline from `productOptionFlags?.merchantPreferences`
- **Editorial/Immersive layouts**: Flags come from `useStorefrontState` hook (`@/app/tenant/[id]/layouts/hooks/useStorefrontState.ts`)

## Multi-Select Implementation Details

### Database
- `tenant_product_types_settings` table has both `selected_product_type` (TEXT, legacy scalar) and `selected_product_types` (TEXT[], new array)
- Migration: `database/migrations/059_product_types_multi_select.sql` — adds array column, migrates scalar data
- Prisma: `selected_product_types String[] @default(["physical"])` on `tenant_product_types_settings` model

### Backend
- **Resolver** (`ProductTypeResolver.ts`): Computes `effective_types` array from merchant-selected types filtered by tier-allowed types. Maintains backward-compatible `effective_type` scalar (first element, or 'flexible' if multiple, or 'none' if empty)
- **Route** (`product-type-settings.ts`): Zod schema accepts `selected_product_types` array. PUT handler persists both fields. CCL write-time validation uses `effective_types` with `includes` operator
- **CCL constraints** (`CapabilityConstraintRegistry.ts`): `product_service_recommends_fulfillment_service` and `product_digital_excludes_fulfillment_shipping` use `effective_types` / `includes` instead of `effective_type` / `equals`

### Frontend
- **State** (`CapabilityResolutionService.ts`): `ProductTypeState` interface includes `effectiveTypes: ProductType[]` and `selected_product_types` in merchant preferences. `resolveProductTypeState` computes the array
- **Mapper** (`UnifiedCapabilityService.ts`): `mapProductType` maps backend `effective_types` and `selected_product_types` to frontend state
- **UI** (`ProductTypeSettingsClient.tsx`): Checkboxes with `handleTypeToggle` add/remove from `selected_product_types` array. Checkbox indicator is `rounded-md` (square) with checkmark SVG
- **Display components**: `CapabilityShowcase.tsx`, `PlanSummaryWidget.tsx` (dashboard + options pages), `PlanSummaryPanel.tsx` (plan-summary page only), `SystemStatusService.ts` all use `effectiveTypes` array for display

## CCL Constraints

Two cross-capability constraints reference product types:

| Constraint | Rule | Operator |
|-----------|------|----------|
| `product_service_recommends_fulfillment_service` | If `effective_types` includes `service`, recommend fulfillment service | `includes` |
| `product_digital_excludes_fulfillment_shipping` | If `effective_types` includes `digital`, warn about fulfillment shipping | `includes` |

Both migrated from `effective_type` / `equals` to `effective_types` / `includes` for multi-select compatibility.

## Key Files

| Layer | File | Purpose |
|-------|------|---------|
| DB migration | `database/migrations/059_product_types_multi_select.sql` | Add array column, migrate data, update CCL seeds |
| Prisma schema | `apps/api/prisma/schema.prisma` | `selected_product_types` field |
| Backend types | `apps/api/src/services/resolvers/types.ts` | `ProductTypeMerchantSettings`, `EffectiveProductType` |
| Backend resolver | `apps/api/src/services/resolvers/ProductTypeResolver.ts` | Compute `effective_types` array |
| Backend route | `apps/api/src/routes/product-type-settings.ts` | Zod schema, GET/PUT, CCL validation |
| Backend CCL | `apps/api/src/services/resolvers/CapabilityConstraintRegistry.ts` | Static constraints with `includes` operator |
| Backend status | `apps/api/src/services/SystemStatusService.ts` | Display `effective_types` |
| Frontend state | `apps/web/src/services/CapabilityResolutionService.ts` | `ProductTypeState`, `resolveProductTypeState` |
| Frontend mapper | `apps/web/src/services/UnifiedCapabilityService.ts` | `mapProductType` |
| Frontend UI | `apps/web/src/app/t/[tenantId]/settings/product-types/ProductTypeSettingsClient.tsx` | Multi-select checkboxes |
| Frontend showcase | `apps/web/src/components/dashboard/CapabilityShowcase.tsx` | `effectiveTypes` display |
| Frontend summary | `apps/web/src/components/settings/PlanSummaryPanel.tsx` | `effectiveTypes` display |
| Storefront hook | `apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts` | `showDigital`, `showHybrid` flags |
| Storefront classic | `apps/web/src/app/tenant/[id]/StorefrontClientWrapper.tsx` | All 4 sections rendered |
| Storefront editorial | `apps/web/src/app/tenant/[id]/StorefrontEditorialLayout.tsx` | All 4 sections rendered |
| Storefront immersive | `apps/web/src/app/tenant/[id]/StorefrontImmersiveLayout.tsx` | All 4 sections rendered |
| Service section | `apps/web/src/components/storefront/sections/ServiceSection.tsx` | 3 layout variants |
| Digital section | `apps/web/src/components/storefront/sections/DigitalSection.tsx` | 3 layout variants |
| Hybrid section | `apps/web/src/components/storefront/sections/HybridSection.tsx` | 3 layout variants |

## Rules

- **R1**: Product types are multi-select. Tenants can offer physical + digital + service simultaneously.
- **R2**: Storefront type is single-select and separate. Do not conflate with product types.
- **R3**: `effective_types` is the canonical array. `effective_type` scalar is backward-compat only.
- **R4**: CCL constraints use `effective_types` / `includes` operator, not `effective_type` / `equals`.
- **R5**: All 4 product type sections must be rendered in all 3 storefront layouts (classic, editorial, immersive).
- **R6**: Each section is gated by its `product_{type}_enabled` merchant toggle from `product_options` capability.
- **R7**: `ServiceSection` has an exception: `showServices` is true if `product_service_enabled` OR `isServiceStore` (storefront type is service/flexible).
- **R8**: New section components must support all 3 layout variants (classic, editorial, immersive).
- **R9**: DB changes must be additive and non-breaking. New array column alongside legacy scalar.
- **R10**: Product bucketing uses `productType || product_type || 'physical'` fallback chain.
