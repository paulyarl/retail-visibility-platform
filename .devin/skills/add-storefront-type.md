---
description: Add a new storefront type or storefront-type behavior overlay (e.g., social commerce) to the tenant storefront page. Covers section resolver, useStorefrontState hook, all 3 layout variants, capability flag chains, and behavior injection into existing sections. Use when implementing a phase from STOREFRONT_TYPE_INTEGRATION_PLAN.md.
---

# Add Storefront Type to Storefront Page

Use this skill when adding a new storefront type section (e.g., `ServiceSection`, `SocialProofSection`) or a storefront-type behavior overlay (e.g., social commerce share buttons injected into existing sections) to the tenant storefront page at `/tenant/[id]`. The architecture was established during Storefront Phase 2 (Service Section) and extended in Phase 3 (Social Type).

**Companion skill:** `add-product-type.md` covers the product detail page side (`/products/[id]`).

## Architecture Overview

The storefront uses a **micro-component section architecture** where each product type or storefront behavior gets its own dedicated section component. Sections are **gated by capability flags** (merchant preference + tier), not by storefront type alone. The storefront type sets default emphasis; capability flags control visibility.

There are two independent patterns:

1. **Product-type section** — A new section component for a product type (e.g., `ServiceSection` for service products). Gated by `ProductOptionFlags` / `productOptionFlags`.

2. **Storefront-type behavior overlay** — Behavior injected into *existing* sections based on storefront type (e.g., social share buttons in `ProductSection` and `ServiceSection` when `isSocialStore`). Gated by a separate capability flag system (e.g., `SocialCommerceFlags` / `socialCommerceFlags`).

### Key Files (Canonical Paths)

| Layer | File | Purpose |
|-------|------|---------|
| Section resolver | `apps/web/src/lib/storefront-sections.ts` | `resolveStorefrontSections()` maps capabilities to section visibility booleans |
| Shared hook | `apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts` | Derives `isServiceStore`, `isSocialStore`, `showServices`, `showSocialProof`, etc. from server-fetched flags |
| Layout types | `apps/web/src/app/products/[id]/layouts/types.ts` | `StorefrontLayoutProps` interface shared by all 3 layouts |
| Layout A (Classic) | `apps/web/src/app/tenant/[id]/StorefrontClientWrapper.tsx` | Classic storefront layout |
| Layout B (Editorial) | `apps/web/src/app/tenant/[id]/StorefrontEditorialLayout.tsx` | Editorial storefront layout |
| Layout C (Immersive) | `apps/web/src/app/tenant/[id]/StorefrontImmersiveLayout.tsx` | Immersive storefront layout |
| Server page | `apps/web/src/app/tenant/[id]/page.tsx` | Server component fetching data + selecting layout |
| Section components | `apps/web/src/components/storefront/sections/` | `ProductSection.tsx`, `ServiceSection.tsx`, `SocialProofSection.tsx`, etc. |
| Storefront components | `apps/web/src/components/storefront/` | `SocialShareButtons.tsx`, `SocialPlatformBadges.tsx`, etc. |
| Backend API | `apps/api/src/routes/storefront.ts` | `GET /api/storefront/:tenantId/products` with `product_type` filter |
| Frontend service | `apps/web/src/services/StorefrontSingletonService.ts` | `getStorefrontProducts()` with `productType` option |
| Capability service | `apps/web/src/services/CapabilityResolutionService.ts` | `ProductOptionFlags`, `SocialCommerceOptionsState` |
| Unified capability service | `apps/web/src/services/UnifiedCapabilityService.ts` | `getProductOptionFlags()`, `getSocialCommerceOptionsState()` |
| Settings UI | `apps/web/src/app/t/[tenantId]/settings/product-options/ProductOptionsSettingsClient.tsx` | Merchant toggle for each product type |

## Pattern 1: Product-Type Section (Checklist)

### 1. Capability Gating — `storefront-sections.ts`

- Add `showXxx` boolean to `StorefrontSectionConfig` interface
- Add the flag param to `ResolveStorefrontSectionsParams` if it's a new capability type
- Add `showXxx: !!(productOptionFlags?.merchantPreferences?.product_xxx_enabled)` to the return object

### 2. Shared Hook — `useStorefrontState.ts`

- Add `initialProductOptionFlags?: ProductOptionFlags | null` to `UseStorefrontStateProps`
- Destructure it in the hook params
- Add `const [productOptionFlags] = useState(initialProductOptionFlags ?? null)`
- Add `const showXxx = !!(productOptionFlags?.merchantPreferences?.product_xxx_enabled)`
- Return `showXxx` and `productOptionFlags` from the hook
- **CRITICAL:** Always add new derived values to the **return object** at the bottom of the hook. Forgetting to return a computed value (e.g., `isSocialStore`) causes `TS2339: Property does not exist` errors in every layout that destructures it.

### 3. Layout Props — `types.ts`

- Add `initialProductOptionFlags?: ProductOptionFlags | null` to `StorefrontLayoutProps`
- Import `ProductOptionFlags` from `@/services/CapabilityResolutionService`

### 4. Server Page — `page.tsx`

- Fetch `productOptionFlags` via `unifiedCapabilityService.getProductOptionFlags(idResolvedBySlug)`
- Pass `initialProductOptionFlags={productOptionFlags}` to **all 3 layout** components

### 5. Product Filtering — Switch-Based Pattern

In each layout component, filter products by `productType` using a **switch statement** (extensible for future types):

```typescript
const { physicalProducts, serviceProducts } = useMemo(() => {
  const buckets: Record<string, any[]> = { physical: [], service: [], digital: [], hybrid: [] };
  for (const p of products) {
    const pt = p.productType || p.product_type || 'physical';
    switch (pt) {
      case 'service':
        buckets.service.push(p);
        break;
      case 'digital':
        buckets.digital.push(p);
        break;
      case 'hybrid':
        buckets.hybrid.push(p);
        break;
      case 'physical':
      default:
        buckets.physical.push(p);
        break;
    }
  }
  return { physicalProducts: buckets.physical, serviceProducts: buckets.service };
}, [products]);
```

**Why switch?** Adding a new type only requires adding a new `case` + accumulator — no if/else chain refactoring.

### 6. Section Component — `XxxSection.tsx`

Create `apps/web/src/components/storefront/sections/XxxSection.tsx`:

- Export a main component that delegates to layout-specific variants (classic, editorial, immersive)
- Include a shared `XxxCard` sub-component for individual item rendering
- Accept `layoutVariant: StorefrontLayoutKey` prop for layout-aware styling
- Gate rendering on `showXxx && xxxProducts.length > 0 && !storefrontStatus.shouldShowPanel`

### 7. Layout Integration — All 3 Layouts

For each layout (Classic, Editorial, Immersive):

1. **Import** the new section component
2. **Destructure** `initialProductOptionFlags` from props
3. **Pass** it to `useStorefrontState()` (layouts B & C) or use directly (Layout A)
4. **Destructure** `showXxx` from `useStorefrontState()` return (B & C) or derive inline (A)
5. **Add the switch-based product filter** (useMemo)
6. **Replace** `products` with `physicalProducts` in existing retail product display sections
7. **Render** the new section component when `showXxx && xxxProducts.length > 0`

### 8. Dedicated Route (Optional)

Create `apps/web/src/app/tenant/[id]/xxx/page.tsx`:

- Server component that fetches products filtered by `product_type=xxx`
- Renders only the new section component
- Includes a back-link to the main storefront

### 9. Backend API Filter

In `apps/api/src/routes/storefront.ts`:

- Extract `product_type` from `req.query`
- Add WHERE clause: `if (product_type) { conditions.push('sp.product_type = $' + paramIndex); params.push(product_type); paramIndex++; }`

### 10. Frontend Service Filter

In `apps/web/src/services/StorefrontSingletonService.ts`:

- Add `productType?: string` to `getStorefrontProducts` options
- Append to query params: `if (options.productType) queryParams.append('product_type', options.productType)`

### 11. Settings UI

In `ProductOptionsSettingsClient.tsx`:

- Add toggle for `product_xxx_enabled` (if not already present)
- Gate by `allowedTypes.includes('xxx')` from capability resolution

## Pattern 2: Storefront-Type Behavior Overlay

When adding behavior gated by `storefrontType` (e.g., social commerce), the pattern is **orthogonal** to product type — it overlays on top of existing sections. This was established in Phase 3 (Social Type).

### Key Difference from Pattern 1

Pattern 1 adds a **new section component**. Pattern 2 injects behavior (e.g., share buttons) into **existing section components** (`ProductSection`, `ServiceSection`) and adds **non-product-type sections** (e.g., `SocialProofSection`) gated by a separate capability flag system.

### Step 1 — Define a New Capability Flag Type

If the behavior overlay needs its own capability flags (separate from `ProductOptionFlags`), define them in `CapabilityResolutionService.ts`:

```typescript
export interface SocialCommerceOptionsState {
  enabled: boolean;
  canUseShareButtons: boolean;
  canUseSocialProof: boolean;
  // ...other flags
}
```

Add a fetcher method to `UnifiedCapabilityService.ts`:

```typescript
async getSocialCommerceOptionsState(tenantId: string): Promise<SocialCommerceOptionsState> {
  const all = await this.getAllCapabilities(tenantId);
  return all.socialCommerceOptions;
}
```

### Step 2 — Extend the Section Resolver

In `storefront-sections.ts`, add the new flag to `StorefrontSectionConfig` and the new param type to `ResolveStorefrontSectionsParams`:

```typescript
interface StorefrontSectionConfig {
  // ...existing flags
  showSocialProof: boolean;
}

interface ResolveStorefrontSectionsParams {
  // ...existing params
  socialCommerceFlags?: SocialCommerceOptionsState | null;
}
```

### Step 3 — Extend the Hook

In `useStorefrontState.ts`:

- Add `initialSocialCommerceFlags?: SocialCommerceOptionsState | null` to `UseStorefrontStateProps`
- Add `const [socialCommerceFlags] = useState(initialSocialCommerceFlags ?? null)`
- Derive flags:
```typescript
const isSocialStore =
  storefrontCap.data?.type === 'social' ||
  storefrontCap.data?.type === 'flexible';
const showSocialProof =
  !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseSocialProof) || isSocialStore;
```
- **Return** `isSocialStore`, `socialCommerceFlags`, and `showSocialProof` from the hook

### Step 4 — Extend Layout Props

In `types.ts`, add `initialSocialCommerceFlags` to `StorefrontLayoutProps`:

```typescript
initialSocialCommerceFlags?: SocialCommerceOptionsState | null;
```

### Step 5 — Fetch in Server Page

In `page.tsx`, fetch the new flags and pass to all 3 layouts:

```typescript
let socialCommerceOptions: SocialCommerceOptionsState | null = null;
try {
  socialCommerceOptions = await unifiedCapabilityService.getSocialCommerceOptionsState(idResolvedBySlug);
} catch (e) { /* log and continue */ }

// Pass to all 3 layouts:
initialSocialCommerceFlags={socialCommerceOptions}
```

### Step 6 — Create Overlay Components

Create storefront-side components in `apps/web/src/components/storefront/`:

- `SocialShareButtons.tsx` — share buttons for Facebook, X, Pinterest, TikTok
- `SocialPlatformBadges.tsx` — badge links from tenant metadata

**Note:** There are TWO `SocialShareButtons` components:
- `apps/web/src/components/storefront/SocialShareButtons.tsx` — for storefront sections (takes `url`, `title`, `layoutVariant`)
- `apps/web/src/components/products/type-sections/SocialShareButtons.tsx` — for product detail pages (takes `product`, `currentUrl`, `layoutVariant`, `storefrontType`, `canUseShareButtons`)

### Step 7 — Create Non-Product-Type Section (if needed)

Create `apps/web/src/components/storefront/sections/SocialProofSection.tsx`:

- Main component delegates to layout-specific variants (classic, editorial, immersive)
- Gated by `showSocialProof` (from `socialCommerceFlags`), NOT by `productOptionFlags`
- Combines platform badges + share buttons

### Step 8 — Inject Behavior into Existing Sections

Add `isSocialStore` and `socialCommerceFlags` props to existing section components (`ProductSection`, `ServiceSection`). Gate share button rendering:

```typescript
const showShareButtons = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) && isSocialStore;
```

Render `SocialShareButtons` in the section header area of each variant (classic, editorial, immersive).

### Step 9 — Pass Props Through All 3 Layouts

Each layout must pass `isSocialStore`, `socialCommerceFlags`, and `currentUrl` to the section components:

```typescript
<ProductSection
  // ...existing props
  isSocialStore={isSocialStore}
  socialCommerceFlags={socialCommerceFlags}
/>
<ServiceSection
  // ...existing props
  isSocialStore={isSocialStore}
  socialCommerceFlags={socialCommerceFlags}
  currentUrl={currentUrl}
/>
```

## Service-Specific Patterns (Reference)

### Service Metadata Conventions

Service products use `inventory_items.metadata` for service-specific fields (no new DB tables):

| Metadata Key | Type | Description |
|-------------|------|-------------|
| `duration_minutes` | number | Service duration in minutes |
| `service_area` | string | Geographic service area |
| `provider_name` | string | Service provider name |
| `service_category` | string | Service category label |
| `booking_url` | string | External booking URL (optional) |

### Service Section vs Product Section

| Aspect | ProductSection | ServiceSection |
|--------|---------------|----------------|
| Add to cart | Yes | No |
| Stock/shipping | Yes | No |
| Booking CTA | No | Yes (BookingCTA component) |
| Duration display | No | Yes |
| Service area | No | Yes |
| Price display | Yes | Yes |

## Two Capability Flag Systems

The storefront has two independent capability flag chains:

| Flag System | Interface | Fetcher | Hook Prop | Hook Derived | Section Config Flag |
|-------------|-----------|---------|-----------|--------------|---------------------|
| Product Options | `ProductOptionFlags` | `getProductOptionFlags()` | `initialProductOptionFlags` | `showServices`, `showGallery`, etc. | `showXxx` from `merchantPreferences.product_xxx_enabled` |
| Social Commerce | `SocialCommerceOptionsState` | `getSocialCommerceOptionsState()` | `initialSocialCommerceFlags` | `showSocialProof`, `isSocialStore` | `showSocialProof` from `socialCommerceFlags.canUseSocialProof` |

Both follow the same prop chain: `page.tsx (fetch) → layout props → useStorefrontState → section components`.

## Common Pitfalls

1. **Don't forget all 3 layouts** — Classic, Editorial, and Immersive each need the section/behavior. Classic uses `StorefrontClientWrapper.tsx`; Editorial and Immersive have their own layout files.

2. **Pass `physicalProducts` not `products`** to existing retail sections after filtering.

3. **Gate on `!storefrontStatus.shouldShowPanel`** — don't show sections when storefront is disabled.

4. **Use `useMemo` for filtering** — prevents re-computation on every render.

5. **Server-side fetch all flags** in `page.tsx` — eliminates client-side waterfall.

6. **useStorefrontState return object.** When adding derived values to `useStorefrontState.ts`, always add them to the **return object** at the bottom of the hook, not just compute them. Phase 3 computed `isSocialStore` but forgot to return it, causing `TS2339: Property 'isSocialStore' does not exist` errors in both `StorefrontEditorialLayout` and `StorefrontImmersiveLayout`.

7. **lucide-react icon availability.** This project's `lucide-react` version does NOT export `Facebook` or `Instagram`. Use available alternatives (`Globe` for Facebook, `Camera` for Instagram, `MessageCircle` for TikTok) or custom SVG icons. Always verify an icon exists before importing it.

8. **Storefront type vs product type.** `social` is a storefront type, not a product type. Don't add a `case 'social'` to product type compositor switches — instead, gate behavior via `storefrontType` / `isSocialStore` in section components. The two axes are orthogonal.

9. **Two SocialShareButtons.** Don't confuse the storefront-side component (`components/storefront/SocialShareButtons.tsx`) with the product-page-side component (`components/products/type-sections/SocialShareButtons.tsx`). They have different props and serve different surfaces.
