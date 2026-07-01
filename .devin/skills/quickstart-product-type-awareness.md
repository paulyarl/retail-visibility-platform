---
description: How to add or modify product type awareness in the Quick Start product generation flow. Covers backend scenario definitions, Zod schema validation, capability gating, product-type-aware SKU/stock/digital field generation, frontend modal/settings/wizard UI components, and the tenant quick-start page. Use when adding a new product type to Quick Start, modifying scenario definitions, or changing how Quick Start handles product type selection.
---

# Quick Start Product Type Awareness

Use this skill when modifying the Quick Start product generation flow to support product types (`physical`, `digital`, `hybrid`, `service`). The architecture was implemented in phases documented in `docs/QUICK_START_PRODUCT_TYPE_AUDIT.md`.

## Canonical Reference

- **Audit doc:** `docs/QUICK_START_PRODUCT_TYPE_AUDIT.md`
- **Backend generation engine:** `apps/api/src/lib/quick-start.ts` (`generateQuickStartProducts`, `SCENARIOS`, `QuickStartOptions`, `baseItemSchema`)
- **Backend route:** `apps/api/src/routes/quick-start.ts` (Zod schema, capability check, request normalization)
- **SKU generator:** `apps/api/src/lib/sku-generator.ts` (`generateAutoSKU` — accepts `productType`, `deliveryMethod`, `accessControl`)
- **Capability service:** `apps/api/src/services/ProductTypeService.ts` (`isProductTypeAllowed`, `resolveProductTypeState`)
- **Frontend modal:** `apps/web/src/components/quick-start/QuickStartProductModal.tsx` (`QuickStartProductConfig`, `QuickStartProductType`)
- **Frontend settings:** `apps/web/src/components/quick-start/QuickStartProductSettings.tsx` (`ProductGenerationSettings`, `DEFAULT_PRODUCT_SETTINGS`)
- **Frontend wizard:** `apps/web/src/components/quick-start/QuickStartWizard.tsx` (`QuickStartWizardProps`, `onGenerate` params)
- **Business type selector:** `apps/web/src/components/quick-start/BusinessTypeSelector.tsx` (`BUSINESS_TYPES` array)
- **Tenant quick-start page:** `apps/web/src/app/t/[tenantId]/quick-start/page.tsx` (inline wizard with capability hooks)
- **Admin quick-start page:** `apps/web/src/app/(platform)/settings/admin/quick-start/products/page.tsx`
- **Tenant info service:** `apps/web/src/services/TenantInfoService.ts` (`generateQuickStartProducts` payload)
- **Capability hook:** `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` (`useProductTypeCapability`)
- **Capability resolution (frontend):** `apps/web/src/services/CapabilityResolutionService.ts` (`ProductTypeState` interface)
- **Prisma enum:** `product_type` enum in `apps/api/prisma/schema.prisma` (`physical`, `digital`, `hybrid`, `service`)
- **Prisma source enum:** `product_source` enum — use `QUICK_START_WIZARD` (not `AI_QUICK_START`)

## Architecture Overview

```
Quick Start Product Type Data Flow:

  Frontend (tenant page or shared components)
    ├── useProductTypeCapability(tenantId) → allowedTypes[]
    ├── Product type selector UI (4 buttons: physical/digital/hybrid/service)
    ├── Filter buttons by allowedTypes (capability gating)
    └── onGenerate({ scenario, productCount, productType, ... })
        ↓
  TenantInfoService.generateQuickStartProducts(tenantId, payload)
    ├── payload includes productType: string
    └── POST /api/v1/tenants/:id/quick-start
        ↓
  Backend Route (quick-start.ts)
    ├── Zod schema validates productType + scenario
    ├── Normalize camelCase/snake_case keys
    ├── Force productType='service' when scenario='service_business'
    ├── ProductTypeService.isProductTypeAllowed(tenantId, productType)
    │   └── 403 if not allowed for tenant tier
    └── generateQuickStartProducts({ ..., productType })
        ↓
  Generation Engine (quick-start.ts)
    ├── SCENARIOS[scenario] → product categories + product templates
    ├── generateAutoSKU({ productType, deliveryMethod, accessControl })
    │   └── SKU prefix varies by type (P=physical, D=digital, H=hybrid, S=service)
    ├── Stock/availability logic varies by type:
    │   ├── physical/hybrid → random stock 15-100, availability='in_stock'
    │   ├── digital → stock=null, availability='digital'
    │   └── service → stock=null, availability='service'
    ├── Digital fields populated for digital/hybrid:
    │   ├── digital_delivery_method
    │   ├── license_type, access_duration_days, download_limit
    │   └── digital_assets array
    ├── Service fields populated for service:
    │   ├── service_duration_minutes, service_area_type
    │   └── booking_required=true
    ├── source: 'QUICK_START_WIZARD' (valid Prisma enum)
    └── baseItemSchema (Zod) validates product_type + digital fields
```

## Key Design Decisions

1. **Product type is per-generation, not per-tenant** — Quick Start generates a batch of products all with the same product type. The tenant's allowed types are gated by capability, but the user picks which type for each generation run.

2. **`service_business` scenario forces `service` product type** — When the user selects the `service_business` business type scenario, the product type selector auto-locks to `service`. The backend enforces this in the route handler.

3. **Capability gating happens at two levels** — Backend route does `ProductTypeService.isProductTypeAllowed()` check (403 on failure). Frontend filters the product type buttons by `allowedProductTypes` from `useProductTypeCapability` hook.

4. **SKU prefix is type-aware** — `generateAutoSKU` in `sku-generator.ts` generates different SKU prefixes based on product type. Quick Start passes the selected `productType` through to the SKU generator.

5. **Stock and availability are type-dependent** — Physical/hybrid products get random stock levels. Digital and service products get `stock=null` with type-appropriate availability values.

6. **Two frontend entry points** — The tenant quick-start page (`t/[tenantId]/quick-start/page.tsx`) has its own inline wizard. The shared components (`QuickStartProductModal`, `QuickStartProductSettings`, `QuickStartWizard`) are used by admin pages and can be embedded elsewhere. Both paths must be updated when adding product type features.

7. **`source` field must use valid Prisma enum** — Use `QUICK_START_WIZARD`, not `AI_QUICK_START` (which doesn't exist in the `product_source` enum).

## Step-by-Step Process

### Step 1 — Add or modify a scenario in SCENARIOS

In `apps/api/src/lib/quick-start.ts`, the `SCENARIOS` object maps scenario IDs to product categories and product templates:

```typescript
const SCENARIOS: Record<string, Scenario> = {
  // ... existing scenarios
  service_business: {
    name: 'Service Business',
    categories: [
      { name: 'Consulting Services', products: [...] },
      { name: 'Repair Services', products: [...] },
      // ...
    ],
  },
};
```

Each scenario has `categories` with `products` (name, price, brand, description). When adding a new scenario, ensure the `id` matches what the frontend sends as `scenario` (or `businessType`).

### Step 2 — Update QuickStartOptions and baseItemSchema

In `apps/api/src/lib/quick-start.ts`:

```typescript
export interface QuickStartOptions {
  tenant_id: string;
  scenario: string;
  productCount?: number;
  generateImages?: boolean;
  imageQuality?: 'standard' | 'hd';
  textModel?: string;
  imageModel?: string;
  productType?: 'physical' | 'digital' | 'hybrid' | 'service'; // <-- add
}
```

Extend `baseItemSchema` (Zod) to include `product_type` and any new fields:

```typescript
const baseItemSchema = z.object({
  // ... existing fields
  product_type: z.enum(['physical', 'digital', 'hybrid', 'service']).default('physical'),
  digital_delivery_method: z.string().nullable().optional(),
  license_type: z.string().nullable().optional(),
  access_duration_days: z.number().nullable().optional(),
  download_limit: z.number().nullable().optional(),
  // ...
});
```

### Step 3 — Update generateQuickStartProducts

In `apps/api/src/lib/quick-start.ts`, destructure `productType` from options and use it for:

- **SKU generation:** Pass `productType` to `generateAutoSKU()`
- **Stock/availability:** Branch on product type for stock and availability values
- **Digital fields:** Set `digital_delivery_method`, `license_type`, `access_duration_days`, `download_limit` for digital/hybrid
- **Service fields:** Set service-specific metadata for service type
- **Source field:** Use `'QUICK_START_WIZARD'` (not `'MANUAL'` or `'AI_QUICK_START'`)

### Step 4 — Update backend route

In `apps/api/src/routes/quick-start.ts`:

1. Add `productType` to the Zod request schema
2. Add any new scenario IDs to the schema's enum
3. Normalize `productType` from request body (handle both camelCase and snake_case)
4. Force `productType: 'service'` when scenario is `service_business`
5. Add capability check: `ProductTypeService.getInstance().isProductTypeAllowed(tenantId, effectiveProductType)`
6. Pass `effectiveProductType` to `generateQuickStartProducts()`

### Step 5 — Update frontend shared components

For each of the three shared components, add `productType` to the interface, state, and UI:

**QuickStartProductModal.tsx:**
- Add `productType: QuickStartProductType` to `QuickStartProductConfig`
- Add `allowedProductTypes?: QuickStartProductType[]` to props
- Add `useState` for `productType`
- Add product type selector UI (4 buttons filtered by `allowedProductTypes`)
- Include `productType` in `onGenerate()` call
- Reset `productType` to `'physical'` after generation

**QuickStartProductSettings.tsx:**
- Add `productType: QuickStartProductType` to `ProductGenerationSettings`
- Add `allowedProductTypes?: QuickStartProductType[]` to props
- Add `productType: 'physical'` to `DEFAULT_PRODUCT_SETTINGS`
- Add product type selector UI using `updateSettings({ productType: t.value })`

**QuickStartWizard.tsx:**
- Add `productType` to `onGenerate` params type
- Add `allowedProductTypes?` to props
- Add `useState` for `productType`
- Add product type selector UI in the wizard form
- Include `productType` in `onGenerate()` call

### Step 6 — Update tenant quick-start page

In `apps/web/src/app/t/[tenantId]/quick-start/page.tsx`:

1. Import `useProductTypeCapability` from capability hooks
2. Add `productType` state (default `'physical'`)
3. Call `useProductTypeCapability(tenantId)` to get `allowedTypes`
4. Add product type selector UI (filter by `allowedTypes`)
5. Auto-force `productType='service'` when `service_business` scenario selected
6. Pass `productType` to `tenantInfoService.generateQuickStartProducts()`
7. Add any new scenarios to the `allScenarios` array

### Step 7 — Update TenantInfoService

In `apps/web/src/services/TenantInfoService.ts`, add `productType: string` to the `generateQuickStartProducts` payload type.

### Step 8 — Update BusinessTypeSelector

In `apps/web/src/components/quick-start/BusinessTypeSelector.tsx`, add any new scenario to the `BUSINESS_TYPES` array with appropriate `defaultCategoryCount` and `defaultProductCount`.

Also update the admin page's local `businessTypes` array in `apps/web/src/app/(platform)/settings/admin/quick-start/products/page.tsx` if it has its own copy.

### Step 9 — Verify with TypeScript checks

```bash
pnpm checkapi   # backend TS check
pnpm checkweb   # frontend TS check
```

Both should pass with zero errors.

## Product Type Selector UI Pattern

The product type selector uses a consistent 4-button grid across all components:

```tsx
{([
  { value: 'physical', label: '📦 Physical', sub: 'Shipped items' },
  { value: 'digital', label: '💾 Digital', sub: 'Downloadable' },
  { value: 'hybrid', label: '🔀 Hybrid', sub: 'Physical + digital' },
  { value: 'service', label: '🛎️ Service', sub: 'Bookable services' },
] as { value: QuickStartProductType; label: string; sub: string }[])
  .filter(t => !allowedProductTypes || allowedProductTypes.includes(t.value))
  .map((t) => (
    <button
      key={t.value}
      onClick={() => setProductType(t.value)}
      className={`... ${productType === t.value ? 'active-styles' : 'inactive-styles'}`}
    >
      <span>{t.label}</span>
      <span className="text-xs">{t.sub}</span>
    </button>
  ))}
```

When `allowedProductTypes` is provided and has fewer than 4 types, show an upgrade hint:

```tsx
{allowedProductTypes && allowedProductTypes.length < 4 && (
  <p className="text-xs text-gray-500 mt-2">
    Your plan allows: {allowedProductTypes.join(', ')}. Upgrade to unlock more types.
  </p>
)}
```

## Common Pitfalls

1. **Don't use `AI_QUICK_START` as source** — It doesn't exist in the Prisma `product_source` enum. Use `QUICK_START_WIZARD`.

2. **Don't forget the Zod schema** — The `baseItemSchema` in `quick-start.ts` strips unknown keys by default. Any new field must be explicitly added to the schema or it will be silently dropped.

3. **Don't forget both frontend entry points** — The tenant page has its own inline wizard. The shared components (`QuickStartProductModal`, `QuickStartProductSettings`, `QuickStartWizard`) are separate. Both paths need product type support.

4. **Don't skip capability check** — The backend route must call `ProductTypeService.isProductTypeAllowed()` before generation. Without it, tenants could generate products with types their tier doesn't allow.

5. **Don't hardcode stock for all types** — Digital and service products should have `stock=null` and type-appropriate `availability` values, not random stock numbers.

6. **Handle snake_case/camelCase normalization** — The API route may receive `productType` or `product_type` depending on the client. Normalize before use.

7. **Keep scenario IDs in sync** — The scenario ID in `SCENARIOS` (backend), `allScenarios` (tenant page), `BUSINESS_TYPES` (selector), and `businessTypes` (admin page) must all match. When adding a scenario, update all four locations.
