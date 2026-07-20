---
description: How to implement a new product type end-to-end using the service product type as a reference. Covers wizard step creation, metadata data model, backend API validation, capability gating, inventory display adaptation, public product page rendering, storefront section rendering, and settings/onboarding integration. Use when adding a new product type or modifying service-type behavior.
---

# Service Product Type — End-to-End Implementation

Use this skill when implementing a new product type or modifying the service product type. The service type was implemented across 7 phases (documented in `docs/SERVICE_PRODUCT_TYPE_PLAN.md`) and serves as the reference architecture for adding new product types.

## Canonical Reference

- **Plan doc:** `docs/SERVICE_PRODUCT_TYPE_PLAN.md`
- **Capability architecture:** `docs/CAPABILITY_TYPES_TARGET_ARCHITECTURE.md`
- **Wizard:** `apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx`
- **Service wizard step:** `apps/web/src/components/inventory/wizards/steps/ServiceDetailsStep.tsx`
- **Type-sections:** `apps/web/src/components/products/type-sections/` (ServiceBookingCTA, ServiceDurationInfo, ServiceAreaInfo)
- **Purchase panel:** `apps/web/src/components/products/sections/ProductPurchasePanel.tsx`
- **Storefront section:** `apps/web/src/components/storefront/sections/ServiceSection.tsx`
- **Booking CTA:** `apps/web/src/components/storefront/BookingCTA.tsx`
- **Inventory cards:** `apps/web/src/components/items/EnhancedProductCard.tsx`, `apps/web/src/components/items/ItemsList.tsx`
- **Settings page:** `apps/web/src/app/t/[tenantId]/settings/product-types/ProductTypeSettingsClient.tsx`
- **Backend resolver:** `apps/api/src/services/resolvers/ProductTypeResolver.ts`
- **Backend route:** `apps/api/src/routes/product-type-settings.ts`
- **Capability resolution (frontend):** `apps/web/src/services/CapabilityResolutionService.ts` (resolveProductTypeState)
- **Unified capability service:** `apps/web/src/services/UnifiedCapabilityService.ts` (mapProductTypeState)
- **Prisma model:** `tenant_product_types_settings` in `apps/api/prisma/schema.prisma`

## Architecture Overview

```
Product Type Data Flow:

  Tier Features (canonical-features.ts)
    ↓
  ProductTypeResolver.ts (backend)
    → resolves tier gates → allowedTypes[]
    → applies merchant prefs → effectiveTypes[]
    → returns ProductTypeState (backend shape)
    ↓
  /api/tenants/:id/product-type (GET/PUT route)
    → validates against tier allowedTypes
    → validates cross-capability constraints (CCL)
    → stores in tenant_product_types_settings
    ↓
  UnifiedCapabilityService.ts (frontend mapper)
    → maps snake_case backend → camelCase frontend ProductTypeState
    ↓
  useProductTypeCapability hook
    → used by wizard, settings page, dashboard, inventory
```

```
Wizard Creation Flow:

  ItemCreationWizard.tsx
    ├── ProductTypeStep.tsx (type selection — uses useProductTypeCapability)
    ├── ServiceDetailsStep.tsx (conditional — when type === 'service')
    ├── PricingStep.tsx (conditional — service pricing model vs standard)
    ├── OrganizationStep.tsx (conditional — hide inventory tracking for services)
    └── ReviewStep.tsx (conditional — service-specific summary)
```

```
Public Display Flow:

  ProductTypeSection.tsx (switch on product.productType)
    ├── case 'service' → ServiceBookingCTA + ServiceDurationInfo + ServiceAreaInfo
    └── reads from product.metadata (camelCase || snake_case)

  ProductPurchasePanel.tsx
    ├── isServiceProduct → Book Now / Call to Book (no cart UI)
    └── default → Add to Cart + quantity selector

  ServiceSection.tsx (storefront)
    ├── ServiceCard → reads metadata, shows duration, location, pricing model
    └── BookingCTA → reads bookingUrl/bookingPhone from metadata
```

## Metadata Schema

Service-specific data is stored in `product.metadata` (JSONB). The wizard writes **camelCase** keys. Display components must check both camelCase (wizard output) and snake_case (legacy/direct product object) for backward compatibility.

```typescript
interface ServiceMetadata {
  bookingMethod: 'external_url' | 'phone' | 'in_store' | 'contact_only';
  bookingUrl?: string;
  bookingPhone?: string;
  durationMinutes?: number | null;
  sessionLength?: string;
  availabilitySchedule?: string;
  serviceLocation: 'on_site' | 'remote' | 'customer_location';
  serviceArea?: string;
  travelRadius?: number | null;
  pricingModel: 'per_session' | 'per_hour' | 'fixed' | 'deposit';
  depositAmount?: number | null;
  requiresDeposit: boolean;
}
```

**Reading metadata pattern (always check both key formats):**
```typescript
const metadata = product.metadata || {};
const bookingUrl = metadata.bookingUrl || metadata.booking_url || product.bookingUrl;
const bookingPhone = metadata.bookingPhone || metadata.booking_phone || product.bookingPhone;
const durationMinutes = metadata.durationMinutes || metadata.duration_minutes || product.durationMinutes;
const serviceLocation = metadata.serviceLocation || metadata.service_location || product.serviceLocation;
const pricingModel = metadata.pricingModel || metadata.pricing_model || product.pricingModel;
```

## Step-by-Step Process for a New Product Type

### Phase 1 — Wizard Data Model & Step Component

1. **Add type to the wizard data model** in `ItemCreationWizard.tsx`:
   - Add a config block (e.g., `serviceProduct?: ServiceProductData`) to `WizardData.productType`
   - Update `INITIAL_DATA` with default values
   - Update `loadExistingProduct` to hydrate from existing metadata
   - Update `handleSubmit` to include type-specific metadata in `productData`

2. **Create a details step component** (e.g., `ServiceDetailsStep.tsx`) in `wizards/steps/`:
   - Conditionally rendered when `productType.type === 'service'`
   - Use card-based option selectors for enum fields (booking method, location, pricing model)
   - Show conditional fields based on selections (e.g., booking URL only when `bookingMethod === 'external_url'`)
   - Include helper text under each field
   - Use `lucide-react` icons (Calendar, Clock, MapPin, DollarSign, Phone, Link, Store, MessageSquare)

3. **Update `ProductTypeStep.tsx`** to use `useProductTypeCapability` (not `useProductOptionsCapability`) for `allowedTypes` and `effectiveTypes`

4. **Insert the step into the wizard flow** — add as a conditional sub-step within Step 2 when type is selected

### Phase 2 — Pricing & Organization Adaptation

1. **Update `PricingStep.tsx`**:
   - Show type-specific pricing model selector when type matches
   - Hide variant pricing section if the type doesn't support variants
   - Show deposit field when `pricingModel === 'deposit'`

2. **Update `OrganizationStep.tsx`**:
   - Hide inventory tracking settings (`trackInventory`, `lowStockThreshold`, `reorderPoint`, `maxStockLevel`) for non-physical types
   - Hide `allowBackorder` for non-physical types
   - Keep category, SEO, and channel settings

3. **Update `ReviewStep.tsx`**:
   - Show type-specific summary fields
   - Hide irrelevant fields (stock, variants, shipping) for non-physical types

### Phase 3 — Backend API & Metadata Handling

1. **Update item creation/update API routes** to validate type-specific metadata fields
2. **Store metadata in `metadata` JSON column** — no schema changes needed
3. **Add server-side validation**: require minimum fields (e.g., `bookingMethod` and `pricingModel` for service)
4. **Ensure `ProductTypeResolver` enforces tier gating** — reject type if tier doesn't allow it
5. **Update `product-type-settings.ts` route**:
   - Add type to Zod validation schema
   - Validate `selected_product_types` entries against tier `allowedTypes`
   - Include in CCL write-time validation (`validateProposedChange`)

### Phase 4 — Inventory Display Adaptation

1. **Update `EnhancedProductCard.tsx`**:
   - Detect product type: `const isService = (item as any).productType === 'service' || (item as any).product_type === 'service';`
   - Replace stock status badge with type-specific badge (e.g., Wrench icon + "Service")
   - Set `stockStatus = isService ? null : getStockStatus(item.stock)`
   - Hide `QuickStockEditor` for non-physical types: `{onStockUpdate && !isService && (...)}`

2. **Update `ItemsList.tsx`**:
   - Same detection pattern and badge replacement
   - Hide stock column/editor for non-physical types in list rows

3. **Update `ItemsPageClient.tsx`**:
   - Use `useProductTypeCapability` for type-enabled check (not `useProductOptionsCapability.enabled`)
   - Gate "Create your first item" button on `isProductEnabled`

### Phase 5 — Public Product Page Integration

1. **Create type-section sub-components** in `apps/web/src/components/products/type-sections/`:
   - 2-3 focused components (e.g., ServiceBookingCTA, ServiceDurationInfo, ServiceAreaInfo)
   - Each reads from `product.metadata` (both camelCase and snake_case)
   - Return `null` when no relevant metadata (graceful degradation)
   - Accept `layoutVariant` prop for compact vs spacious styling

2. **Add case to `ProductTypeSection.tsx`** compositor switch statement

3. **Update `ProductPurchasePanel.tsx`**:
   - Replace "Add to Cart" with type-specific CTA (e.g., "Book Now" / "Call to Book")
   - Hide cart-related actions (quantity selector, add to cart button)
   - Show deposit info if `pricingModel === 'deposit'`
   - Add type icon to the SKU/type row

4. **Verify product page layouts** (`ProductShowcaseLayout`, `ProductQuickCommerceLayout`) handle the new type

### Phase 6 — Storefront, Settings & Onboarding

1. **Update storefront section** (e.g., `ServiceSection.tsx`):
   - Read metadata using both camelCase and snake_case fallback
   - Display type-specific details (duration, location, pricing model, provider name)
   - Include `BookingCTA` with type-specific call-to-action

2. **Update `StorefrontClientWrapper.tsx` and `useStorefrontState.ts`**:
   - Ensure `showServices` (or equivalent flag) is true when either:
     - The merchant preference flag is enabled (e.g., `product_service_enabled`), OR
     - The storefront type inherently includes this type (e.g., `isServiceStore`)

3. **Update dedicated type page** (e.g., `services/page.tsx`):
   - Simplify "No items available" condition to check only `items.length === 0`

4. **Update `ProductTypeSettingsClient.tsx`**:
   - Add type to `typeOptions` array with icon and description
   - Multi-select toggle pattern (not radio) for `selected_product_types`
   - Validate against `allowedTypes` from capability resolver

5. **Update `PlanSummaryPanel.tsx`** (plan-summary page only — options pages use `PlanSummaryWidget`):
   - Add type to `PRODUCT_TYPE_LABELS` record
   - Use `effectiveTypes.includes(t)` for status (not scalar `effectiveType`)

6. **Update `CapabilityShowcase.tsx`**:
   - Use `effectiveTypes.length` for enabled/gated checks (not scalar `effectiveType`)

7. **Add quickstart scenario** in `scenarios.ts` for the new type

### Phase 7 — Verification

- Run `pnpm checkapi` — zero TS errors
- Run `pnpm checkweb` — zero TS errors
- Verify wizard creates products with correct metadata
- Verify public product page renders type-specific components
- Verify inventory grid/list shows type badge and hides stock UI
- Verify settings page allows toggling the type
- Verify capability gating rejects type when tier doesn't include it

## Capability Gating

Product types use the `product_types` capability with feature keys:

| Feature Key | Description |
|---|---|
| `product_types_enabled` | Master toggle |
| `product_types_disabled` | Master disable (overrides enabled) |
| `product_types_flexible` | All types allowed |
| `product_types_physical` | Physical type allowed |
| `product_types_digital` | Digital type allowed |
| `product_types_hybrid` | Hybrid type allowed |
| `product_types_service` | Service type allowed |

**Resolution precedence (R17):** `disabled > enabled > flexible > features`

The resolver returns both:
- `effectiveType` (scalar, backward compat) — single type or 'flexible' or 'none'
- `effectiveTypes` (array) — intersection of tier-allowed and merchant-selected types

**Multi-select pattern:** `selected_product_types` is an array on `tenant_product_types_settings`. The resolver filters merchant selections against tier `allowedTypes`. The scalar `selected_product_type` is maintained for backward compatibility.

## Cross-Capability Constraints (CCL)

When writing product type settings, the PUT handler calls `validateProposedChange()` with simulated effective capabilities. For multi-select, set both:
```typescript
simulated.product_types.effective_types = typesToValidate;
simulated.product_types.effective_type = typesToValidate.length === 1 ? typesToValidate[0] : 'flexible';
```

## Inventory Display Rules

| Product Type | Stock Badge | Stock Editor | Icon | Quick Stock |
|---|---|---|---|---|
| physical | Stock status (In Stock / Low / Out) | Shown | Package | Shown |
| digital | Hidden | Hidden | Download | Hidden |
| service | "Service" badge (indigo) | Hidden | Wrench | Hidden |
| hybrid | Stock status | Shown | Layers | Shown |

**Detection pattern (always check both key formats):**
```typescript
const isService = (item as any).productType === 'service' || (item as any).product_type === 'service';
```

## Storefront Gating Rules

`showServices` should be true when **either** condition is met:
1. Merchant preference `product_service_enabled` is set, OR
2. Storefront type is `service` or `flexible` (inherent to the storefront)

```typescript
const showServices = !!(productOptionFlags?.merchantPreferences?.product_service_enabled) || isServiceStore;
```

This ensures service sections appear on service-type storefronts even without explicit merchant preference.

## Common Pitfalls

1. **Metadata key casing.** The wizard writes camelCase keys. Some API responses return snake_case. Display components must check both: `metadata.bookingUrl || metadata.booking_url`. Forgetting this causes blank fields on public pages.

2. **Using scalar `effectiveType` for multi-type checks.** With multi-select, `effectiveType` is 'flexible' when multiple types are selected. Use `effectiveTypes` array for checking if a specific type is enabled: `effectiveTypes.includes('service')` instead of `effectiveType === 'service'`.

3. **Forgetting to hide stock UI for non-physical types.** `QuickStockEditor`, stock count, and stock status badges must be conditionally hidden. Use the `isService` (or equivalent) guard pattern.

4. **Storefront gating only on merchant preference.** If `showServices` only checks `product_service_enabled`, service sections won't appear on service-type storefronts where the merchant hasn't explicitly toggled the preference. Always include `|| isServiceStore`.

5. **Not adding type to `ProductTypeSettingsClient` typeOptions.** The settings page iterates a `typeOptions` array — new types must be added there with an icon and description, or they won't appear in the settings UI.

6. **CCL validation not updated for multi-select.** When validating proposed changes, set both `effective_types` (array) and `effective_type` (scalar, for backward compat) on the simulated capabilities object.

7. **Step component not conditional.** The `ServiceDetailsStep` must only render when `productType.type === 'service'`. Always guard with a conditional check in the wizard step flow.

8. **Returning null from sub-components.** Type-section sub-components (ServiceBookingCTA, etc.) must return `null` when metadata is absent. Products created before the type was added won't have the metadata — rendering without a null guard causes blank/broken UI sections.
