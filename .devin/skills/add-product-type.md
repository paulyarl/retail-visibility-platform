---
description: How to add a new product type (e.g., hybrid, subscription) or a storefront-type behavior overlay (e.g., social commerce) to the product detail page. Covers type-sections sub-components, ProductTypeSection compositor switch case, ProductPurchasePanel type-aware rendering, and storefront-type behavior gating via UnifiedCapabilityService. Use when implementing a phase from the PRODUCT_PAGE_INTEGRATION_PLAN.md.
---

# Add Product Type to Product Page

Use this skill when adding a new product type (hybrid, subscription, etc.) or a storefront-type behavior overlay (social commerce) to the product detail page. The architecture was established in Product Page Phase 0, extended in Phase 1 (service type), and Phase 2 (social behavior overlay).

## Canonical Reference

- **Plan doc:** `docs/PRODUCT_PAGE_INTEGRATION_PLAN.md`
- **Type-sections directory:** `apps/web/src/components/products/type-sections/`
- **Mini compositor:** `apps/web/src/components/products/sections/ProductTypeSection.tsx`
- **Purchase panel:** `apps/web/src/components/products/sections/ProductPurchasePanel.tsx`
- **Existing type-sections:** `StockStatusInfo`, `ShippingInfo`, `ConditionInfo` (physical), `DigitalDownloadInfo`, `LicenseInfo`, `AccessDurationInfo` (digital), `ServiceBookingCTA`, `ServiceDurationInfo`, `ServiceAreaInfo` (service), `SocialShareButtons`, `SocialProofBadges`, `ShoppableEmbeds` (social behavior overlay)
- **Storefront state hook:** `apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts`
- **Capability service:** `apps/web/src/services/UnifiedCapabilityService.ts` (provides `getStorefrontState()` and `getSocialCommerceOptionsState()`)

## Architecture Overview

```
ProductTypeSection.tsx (mini compositor — switch statement)
  ├── case 'physical'  → StockStatusInfo + ShippingInfo + ConditionInfo
  ├── case 'digital'   → DigitalDownloadInfo + LicenseInfo + AccessDurationInfo
  ├── case 'service'   → ServiceBookingCTA + ServiceDurationInfo + ServiceAreaInfo
  ├── case 'hybrid'    → physical + digital sub-components
  └── case '<new>'     → <new sub-components>

ProductPurchasePanel.tsx (type-aware purchase UI)
  ├── isServiceProduct → Book Now button (booking URL or phone)
  ├── default          → Add to Cart + quantity selector
  └── <new type>       → <new purchase behavior>

Storefront-Type Behavior Overlay (orthogonal to product type)
  page.tsx fetches storefrontType + socialCommerceFlags via UnifiedCapabilityService
  ├── ProductHeaderSection   → SocialProofBadges (gated by showSocialProof)
  ├── ProductGalleryPanel    → ShoppableEmbeds (gated by storefrontType='social')
  ├── ProductPurchasePanel   → SocialShareButtons (gated by canShare)
  └── ProductRecommendations → priority='trending' sort + "Trending Now" title
```

## Step-by-Step Process

### Step 1 — Create type-safe sub-components

For each new product type, create 2-3 focused sub-components in `apps/web/src/components/products/type-sections/`:

**Naming convention:** `[Type][InfoType].tsx` (e.g., `ServiceBookingCTA`, `ServiceDurationInfo`, `ServiceAreaInfo`)

**Props pattern (follow existing):**
```typescript
interface ServiceBookingCTAProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
  storefrontType?: string;  // only if social-aware behavior needed
}

export function ServiceBookingCTA({
  product,
  layoutVariant = 'classic',
  storefrontType,
}: ServiceBookingCTAProps) {
  const isCompact = layoutVariant === 'quick-commerce';
  // Read type-specific data from product.metadata
  // Return null if no relevant data (graceful no-op)
  // Use lucide-react icons consistent with existing sub-components
}
```

**Key rules:**
- Each sub-component reads from `product.metadata` (snake_case or camelCase — check both)
- Return `null` when no relevant metadata exists (graceful degradation)
- Use `layoutVariant` for compact vs spacious styling
- Use `lucide-react` icons (Calendar, Clock, MapPin, Package, Download, Globe, etc.)
- Keep sub-components under ~50 lines each

### Step 2 — Add case to ProductTypeSection compositor

`ProductTypeSection.tsx` uses a `switch` statement — add a new case:

```typescript
import { NewTypeFeature } from '../type-sections/NewTypeFeature';
import { NewTypeInfo } from '../type-sections/NewTypeInfo';

// In the switch:
case 'new_type':
  return (
    <div className="space-y-3">
      <NewTypeFeature product={product} layoutVariant={layoutVariant} storefrontType={storefrontType} />
      <NewTypeInfo product={product} layoutVariant={layoutVariant} />
    </div>
  );
```

**Important:** Always pass `layoutVariant` and `storefrontType` (if the sub-component accepts it) to maintain behavioral parity across all layout variants.

### Step 3 — Update ProductPurchasePanel for type-aware purchase UI

`ProductPurchasePanel.tsx` branches purchase behavior by product type. Currently uses a ternary for service vs default. When adding a new type, consider refactoring to a switch pattern if the ternary becomes nested.

**Current pattern (ternary):**
```typescript
const isServiceProduct = product.productType === 'service';

// In JSX:
isServiceProduct ? (<BookNowUI />) : (<AddToCartUI />)
```

**When to switch to a switch:** If adding a third purchase behavior (e.g., social type with share buttons, hybrid with dual options), refactor to:
```typescript
const productType = product.productType || 'physical';

// In JSX:
{(() => {
  switch (productType) {
    case 'service':  return <ServicePurchaseBlock ... />;
    case 'hybrid':   return <HybridPurchaseBlock ... />;
    case 'social':   return <SocialPurchaseBlock ... />;
    default:         return <StandardCartBlock ... />;
  }
})()}
```

**Also update the product type badge** in the SKU/type row:
```typescript
{product.productType === 'new_type' && <NewIcon size={isQuickCommerce ? 12 : 14} />}
```

### Step 4 — Verify no regressions

- Run `pnpm checkweb` — zero TS errors required
- Verify existing product types (physical, digital, service, hybrid) still render correctly
- Check all three layout variants (classic, showcase, quick-commerce)
- Verify the new type renders in all three layout variants

## Storefront-Type Behavior Overlay Pattern

When adding behavior gated by `storefrontType` (e.g., social commerce), the pattern is **orthogonal** to product type — it overlays on top of any product type. This was established in Phase 2.

### Step 1 — Fetch storefront state and flags in page.tsx

```typescript
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';

// In the server component:
const storefrontState = await unifiedCapabilityService.getStorefrontState(tenantId);
const storefrontType = storefrontState.effectiveType;
const socialCommerceFlags = await unifiedCapabilityService.getSocialCommerceOptionsState(tenantId);
```

### Step 2 — Pass through layout components

Add `storefrontType` and `socialCommerceFlags` to the props interface of each layout component (`ProductShowcaseLayout`, `ProductQuickCommerceLayout`), destructure them, and forward to the relevant section components.

### Step 3 — Create behavior sub-components

Create sub-components in `type-sections/` following the same props pattern, but gate on `storefrontType` and capability flags instead of `product.productType`:

```typescript
const isSocialStorefront = storefrontType === 'social';
const canShare = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) || isSocialStorefront;
```

### Step 4 — Integrate into section components

Add conditional rendering in the section components that should exhibit the behavior:
- `ProductHeaderSection` — social proof badges
- `ProductGalleryPanel` — shoppable embeds
- `ProductPurchasePanel` — social share buttons
- `ProductRecommendationsSection` — trending-prioritized sort and title

### Step 5 — Update useStorefrontState hook (storefront-side)

If the storefront layouts need the same flags, ensure `useStorefrontState.ts` **returns** any new derived values it computes. The hook computes `isSocialStore` but must include it in the return object — this was a bug found in Phase 2.

## Data Conventions

Product type-specific data lives in `product.metadata`. Always check both camelCase and snake_case:
```typescript
const bookingUrl = product.metadata?.bookingUrl || product.metadata?.booking_url;
```

This handles both Prisma (snake_case) and API-transformed (camelCase) data shapes.

## Capability Gating

There are two independent gating axes:

1. **Product type** — driven by `product.productType` from the product record. Not capability-gated; determines which sub-components render in `ProductTypeSection`.

2. **Storefront-type behavior overlay** — driven by `storefrontType` (from `UnifiedCapabilityService.getStorefrontState()`) and feature flags (e.g., `socialCommerceFlags` from `getSocialCommerceOptionsState()`). These are capability-gated and orthogonal to product type. Pass both `storefrontType` and the relevant flags to section components that need them.

**Gating pattern for social commerce:**
```typescript
const isSocialStorefront = storefrontType === 'social';
const canShare = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) || isSocialStorefront;
const showSocialProof = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseSocialProof) || isSocialStorefront;
```

The `|| isSocialStorefront` fallback ensures social storefronts always show social features even if flags are not yet populated.

## Type Union

The `ProductType` union is defined in `ProductTypeSection.tsx`:
```typescript
type ProductType = 'physical' | 'digital' | 'service' | 'hybrid';
```

Add new product types to this union when implementing. Also update any other type references in the codebase (search for `productType === 'physical'` patterns).

**Note:** `social` is a **storefront type** (from `StorefrontState.effectiveType`), not a product type. Do not add it to the `ProductType` union. Social behavior is an overlay gated by `storefrontType`, not a product type case in the compositor.

## Common Pitfalls

1. **Forgetting the type badge in ProductPurchasePanel.** The SKU/type row shows an icon per type. Add the new type's icon or it will show without an icon.

2. **Not handling missing metadata.** Sub-components must return `null` when `product.metadata` doesn't have the relevant fields. Products created before the type was added won't have the metadata.

3. **Layout variant styling.** Quick-commerce uses compact spacing (`text-xs`, smaller icons). Always branch on `layoutVariant === 'quick-commerce'` for sizing.

4. **Ternary creep in ProductPurchasePanel.** If adding a third purchase behavior, refactor the ternary to a switch to avoid nested conditionals.

5. **useStorefrontState return object.** When adding derived values to `useStorefrontState.ts`, always add them to the **return object** at the bottom of the hook, not just compute them. Phase 2 computed `isSocialStore` but forgot to return it, causing `TS2304: Cannot find name` errors in both `StorefrontEditorialLayout` and `StorefrontImmersiveLayout`.

6. **lucide-react v1.x icon availability.** This project uses `lucide-react@^1.21.0`, which does NOT export `Facebook` or `Instagram`. Use available alternatives (e.g., `Globe` for Facebook, `Camera` for Instagram, `MessageCircle` for TikTok) or SVG icons. Always verify an icon exists before importing it.

7. **Storefront type vs product type confusion.** `social` is a storefront type, not a product type. Don't add a `case 'social'` to `ProductTypeSection` — instead, gate behavior via `storefrontType` in section components. The two axes are orthogonal.
