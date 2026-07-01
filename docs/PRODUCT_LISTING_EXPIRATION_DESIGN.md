# Product Listing Expiration — Design Document

## Overview

Add support for **expiring product listings** — a merchant can set an optional expiration date on a product, after which the product automatically becomes invisible to customers. This is ideal for seasonal products, time-limited offers, flash-sale items, or any product that should cease being publicly available after a known date.

## Current Architecture (Relevant Parts)

### Visibility Chain

1. **`inventory_items` table** — has `visibility` (`public`/`private`) and `item_status` (`active`/`inactive`/`archived`/`trashed`)
2. **`mv_storefront_discovery` materialized view** — the single source of truth for all public product surfaces. Filters at `@/apps/api/database/migrations/create_scope_aware_mvs.sql:917-918`:
   ```sql
   WHERE ii.item_status = 'active' AND ii.visibility = 'public'
   ```
3. **Public API routes** — query the MV (storefront, directory, bot product search, recommendations). Anything filtered out by the MV is invisible to customers.
4. **GMC sync** — `GMCProductSync.ts` checks `item.visibility !== 'public'` before syncing to Google Merchant Center.

### Product Creation Flow

1. **Wizard** (`ItemCreationWizard.tsx`) — 7-step wizard, Step 5 is `OrganizationStep.tsx` where visibility is set
2. **Create page** (`/t/[tenantId]/items/create/page.tsx`) — transforms wizard data to API payload
3. **POST `/api/items`** (`index.ts:5170`) — Zod-validated, creates `inventory_items` record
4. **PUT `/api/items/:itemId`** (`index.ts:6845`) — updates item fields

### Items Table UI

- `ItemsPageClient.tsx` — shows items with visibility toggle, status toggle, category assignment
- `ItemsSingletonService.ts` — frontend `Item` interface

## Design: Soft Expiration via MV Filter

**Chosen approach:** Add an `expires_at` column to `inventory_items`. The materialized view filters out expired products. The product stays in the DB with `item_status = 'active'` — the merchant can extend the date to re-activate instantly.

**Why soft over hard:**
- **Instant** — takes effect on MV refresh (already scheduled periodically)
- **Reversible** — merchant just changes the date, no data loss
- **No cron job needed** — the MV WHERE clause handles it declaratively
- **Merchant retains control** — expired products are still visible in the admin items table, just not to customers

## Implementation Plan

### Phase 1: Database Migration

**File:** `database/migrations/059_product_expiration_dates.sql`

```sql
-- Add expires_at column to inventory_items
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS expires_at timestamptz(6);

-- Index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_inventory_items_expires_at
  ON inventory_items (expires_at)
  WHERE expires_at IS NOT NULL;

-- Update the materialized view to filter out expired products
-- The MV needs to be dropped and recreated with the new WHERE clause
DROP MATERIALIZED VIEW IF EXISTS mv_storefront_discovery CASCADE;

-- Recreate with expiration filter added to WHERE clause
-- (Full MV definition from create_scope_aware_mvs.sql with one new line in WHERE)
-- WHERE clause becomes:
--   t.location_status = 'active'
--   AND ii.item_status = 'active'
--   AND ii.visibility = 'public'
--   AND (ii.expires_at IS NULL OR ii.expires_at > now())  -- NEW
```

**Note:** The MV drop/recreate must also handle dependent MVs (`mv_category_discovery` which inherits from `mv_storefront_discovery`). The cascade drop + recreate order must follow the same pattern in `create_scope_aware_mvs.sql`.

### Phase 2: Prisma Schema

**File:** `apps/api/prisma/schema.prisma` — `inventory_items` model

Add after the `visibility` field (around line 1939):
```prisma
  expires_at                                                                      DateTime?                @db.Timestamptz(6)
```

### Phase 3: Backend API

#### 3a. Zod Schema — `baseItemSchema` (`index.ts:~5098`)

Add to `baseItemSchema`:
```typescript
  // Expiration
  expires_at: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(), // camelCase alias
```

#### 3b. Create Handler — POST `/api/items` (`index.ts:5170`)

In the destructuring block (`index.ts:5183-5206`), extract `expires_at`:
```typescript
  expires_at,
  ...itemData
```

In the `data` object (`index.ts:5225`), add:
```typescript
  expires_at: expires_at ? new Date(expires_at) : null,
```

#### 3c. Update Handler — PUT `/api/items/:itemId` (`index.ts:6845`)

Add to the `prismaUpdateData` construction:
```typescript
  if (updateData.expires_at !== undefined) {
    prismaUpdateData.expires_at = updateData.expires_at ? new Date(updateData.expires_at) : null;
  }
  if (updateData.expiresAt !== undefined) {
    prismaUpdateData.expires_at = updateData.expiresAt ? new Date(updateData.expiresAt) : null;
  }
```

Add `expires_at` and `expiresAt` to the response transform.

#### 3d. PATCH handler (`index.ts:5876`)

Add `expires_at` to the patchable fields.

### Phase 4: Frontend — Product Wizard

#### 4a. WizardData type — `ItemCreationWizard.tsx`

Add to `organization.organizationSettings`:
```typescript
  expiresAt?: string | null; // ISO date string
```

Add to `INITIAL_DATA.organization.organizationSettings`:
```typescript
  expiresAt: null,
```

#### 4b. OrganizationStep — `OrganizationStep.tsx`

Add to `OrganizationStepProps.data.organizationSettings`:
```typescript
  expiresAt?: string | null;
```

Add a date input in the "Organization Settings" section, next to the existing Visibility dropdown:

```tsx
<div>
  <Label className="text-sm font-medium">Expiration Date (Optional)</Label>
  <Input
    type="date"
    value={data.organizationSettings.expiresAt ? data.organizationSettings.expiresAt.split('T')[0] : ''}
    onChange={(e) => handleOrganizationSettingsChange('expiresAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
    placeholder="No expiration"
    min={new Date().toISOString().split('T')[0]}
  />
  <p className="text-xs text-gray-500 mt-1">
    Product will automatically become invisible to customers after this date. Leave empty for permanent listing.
  </p>
</div>
```

#### 4c. Create Page — `page.tsx`

In `handleComplete`, add to `apiPayload`:
```typescript
  expires_at: organization.organizationSettings?.expiresAt || null,
```

#### 4d. Edit Mode — `loadExistingProduct` in `ItemCreationWizard.tsx`

In the `organizationSettings` mapping (line 537):
```typescript
  expiresAt: productData.expires_at || productData.expiresAt || null,
```

#### 4e. ReviewStep — `ReviewStep.tsx`

Add `expiresAt` to the review summary in the Organization section:
```tsx
<div className="flex justify-between">
  <span className="text-sm text-gray-600">Expiration:</span>
  <Badge variant={data.organizationSettings.expiresAt ? 'default' : 'secondary'}>
    {data.organizationSettings.expiresAt
      ? new Date(data.organizationSettings.expiresAt).toLocaleDateString()
      : 'Permanent'}
  </Badge>
</div>
```

### Phase 5: Frontend — Items Table

#### 5a. Item interface — `ItemsSingletonService.ts`

Add to `Item` interface:
```typescript
  expires_at?: string | null;
  expiresAt?: string | null; // camelCase alias
```

#### 5b. ItemsPageClient — `ItemsPageClient.tsx`

Add a badge/column showing expiration status:
- **Expired** (red badge) — `expires_at < now`
- **Expiring Soon** (yellow badge) — `expires_at` within 7 days
- **Permanent** (gray) — `expires_at` is null

Add a filter option: "Expiring Soon" / "Expired" alongside existing status/visibility filters.

### Phase 6: MV Refresh Considerations

The MV is already refreshed periodically (via scheduled job or on item create/update). The expiration filter takes effect on next refresh. For near-real-time expiration:

- **Option A (simple):** Rely on existing MV refresh schedule. Products expire within the existing refresh window.
- **Option B (near-real-time):** Add a check in the public API routes that also filter `WHERE (expires_at IS NULL OR expires_at > now())` on top of MV results. This catches expirations between MV refreshes.
- **Option C (scheduled):** A lightweight cron job that triggers `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_storefront_discovery` every hour.

**Recommendation:** Option A for MVP. The MV is already refreshed on every item create/update, so new expiration dates set by merchants take effect immediately. The only gap is products that expire while no one is editing items — Option C can be added later if needed.

### Phase 7: Capability Gating (Tier-Based Feature Control)

The platform has a tier-based capability system that gates product features by tenant subscription level. The expiration feature must follow the same pattern — lower tiers should not have access to expiration dates, while higher tiers unlock it.

The existing pattern (from `@/apps/api/src/services/resolvers/ProductOptionsResolver.ts` and `@/apps/web/src/hooks/tenant-access/useCapabilityAccess.ts`) works as follows:
1. A feature key is registered in the `capability_feature_list` table
2. Tiers are assigned feature keys in `tier_features_list`
3. A backend resolver reads features and produces an `EffectiveProductOptions` object
4. A frontend mapper converts it to `ProductOptionsState`
5. Wizard steps call `useProductOptionsCapability(tenantId)` and conditionally render UI based on the returned flags

#### 7a. Database — Register Feature Key

**File:** `database/migrations/059_product_expiration_dates.sql` (same migration file)

Register the new feature key in `capability_feature_list`:
```sql
INSERT INTO capability_feature_list (key, name, description, capability_type_id, is_enabled, sort_order, created_at, updated_at)
SELECT 'product_options_creation_expiration', 'Product Expiration Dates', 'Set expiration dates on product listings for automatic visibility removal', ct.id, true, 15, NOW(), NOW()
FROM capability_type_list ct WHERE ct.key = 'product_options'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();
```

Assign to tiers (gating strategy — expiration is a commitment+ feature):
```sql
-- Expiration dates available from commitment tier and above
INSERT INTO tier_features_list (tier_id, feature_key, label)
VALUES
  ('commitment',   'product_options_creation_expiration', 'Product Expiration Dates'),
  ('ecommerce',    'product_options_creation_expiration', 'Product Expiration Dates'),
  ('omnichannel',  'product_options_creation_expiration', 'Product Expiration Dates'),
  ('professional', 'product_options_creation_expiration', 'Product Expiration Dates'),
  ('enterprise',   'product_options_creation_expiration', 'Product Expiration Dates'),
  ('trial_chain_enterprise', 'product_options_creation_expiration', 'Product Expiration Dates')
ON CONFLICT (tier_id, feature_key) DO UPDATE SET
  label = EXCLUDED.label;
```

**Tier gating rationale:** Expiration is a merchandising power-feature. Starter/Discovery/Storefront tiers get basic listing management. Commitment+ tiers get advanced merchandising features (expiration, video, etc.) — this mirrors how `product_options_creation_video` is already gated (commitment+ only, see `@/database/migrations/057_product_types_capability_split.sql:573`).

#### 7b. Backend Resolver — `ProductOptionsResolver.ts`

**File:** `apps/api/src/services/resolvers/ProductOptionsResolver.ts`

Add `shows_expiration` to the resolver logic, following the same pattern as `showsVideo`:

In the creation group section (after line 66):
```typescript
const showsExpiration = isFlexible || creationGroupEnabled || !!features.product_options_creation_expiration;
```

In the return object (after `shows_video`):
```typescript
shows_expiration: showsExpiration,
effective_shows_expiration: showsExpiration, // No merchant pref for this yet
```

**File:** `apps/api/src/services/resolvers/types.ts`

Add to `EffectiveProductOptions` interface:
```typescript
shows_expiration: boolean;
effective_shows_expiration: boolean;
```

#### 7c. Frontend Mapper — `UnifiedCapabilityService.ts`

**File:** `apps/web/src/services/UnifiedCapabilityService.ts`

Add to `mapProductOptions()` function (after `showsVideo` mapping):
```typescript
showsExpiration: b.shows_expiration,
effectiveShowsExpiration: b.effective_shows_expiration,
```

#### 7d. Frontend Type — `CapabilityResolutionService.ts`

**File:** `apps/web/src/services/CapabilityResolutionService.ts`

Add to `ProductOptionsState` interface (after `showsVideo`):
```typescript
/** Whether expiration dates are available during creation (tier-allowed) */
showsExpiration: boolean;
/** Whether expiration dates are effectively available after merchant preferences */
effectiveShowsExpiration: boolean;
```

Add to `resolveProductOptionsState()` function:
```typescript
showsExpiration: !!features.product_options_creation_expiration || flexible,
effectiveShowsExpiration: !!features.product_options_creation_expiration || flexible,
```

#### 7e. Wizard UI — `OrganizationStep.tsx`

**File:** `apps/web/src/components/inventory/wizards/steps/OrganizationStep.tsx`

Import the capability hook (same pattern as `ProductTypeStep.tsx`):
```typescript
import { useProductOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
```

Inside the component:
```typescript
const productOptionsCap = useProductOptionsCapability(tenantId || null);
const showsExpiration = productOptionsCap.data?.effectiveShowsExpiration ?? false;
```

Conditionally render the expiration date picker only when `showsExpiration` is true:
```tsx
{showsExpiration && (
  <div>
    <Label className="text-sm font-medium">Expiration Date (Optional)</Label>
    <Input
      type="date"
      value={data.organizationSettings.expiresAt ? data.organizationSettings.expiresAt.split('T')[0] : ''}
      onChange={(e) => handleOrganizationSettingsChange('expiresAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
      placeholder="No expiration"
      min={new Date().toISOString().split('T')[0]}
    />
    <p className="text-xs text-gray-500 mt-1">
      Product will automatically become invisible to customers after this date. Leave empty for permanent listing.
    </p>
  </div>
)}
```

If `showsExpiration` is false, the date picker is hidden and `expiresAt` remains `null` (permanent listing). The backend should also validate: if a tenant without the feature key sends `expires_at`, reject it with a 403.

#### 7f. Backend Write-Time Validation — `index.ts`

In the POST `/api/items` and PUT `/api/items/:itemId` handlers, add a capability check before accepting `expires_at`:
```typescript
// Check if tenant has expiration feature
if (expires_at) {
  const features = await getTenantFeatures(tenantId); // existing helper
  if (!features.product_options_creation_expiration) {
    return res.status(403).json({ error: 'expiration_feature_not_available', message: 'Product expiration dates require Commitment tier or higher' });
  }
}
```

#### 7g. Public Product Page — Expiration Status Display

On the public product page (`/products/[id]`), the expiration status badge ("Expiring Soon", etc.) should only be shown if the tenant has the capability. However, since the product page is public-facing, the capability check happens server-side when fetching product data:
- The API response for `/api/public/products/:id` should include a `shows_expiration_status` flag based on the tenant's capability
- The frontend renders the badge only when this flag is true
- This prevents lower-tier merchants from having expiration badges displayed on their product pages even if they somehow have `expires_at` set

#### 7h. Items Table — `ItemsPageClient.tsx`

The expiration badge and filter in the items table (admin view) should also be gated:
```typescript
const productOptionsCap = useProductOptionsCapability(tenantId);
const showsExpiration = productOptionsCap.data?.effectiveShowsExpiration ?? false;
```

Only show the expiration column/badge/filter when `showsExpiration` is true. For tenants without the feature, the column is hidden and existing items with `expires_at` (if any from a previous tier upgrade/downgrade) are simply not displayed with expiration info.

#### 7i. Merchant Preferences (Future)

For a future iteration, add a merchant-level toggle in Product Options Settings (`/t/[tenantId]/settings/product-options`) allowing merchants to enable/disable the expiration feature even when their tier allows it. This follows the existing `product_video_enabled` pattern in `ProductOptionsMerchantSettings`.

### Phase 8: Product Display Cards — Expiration-Aware Badges

The MV filter (Phase 1) ensures expired products never appear on public surfaces. But products that are **close to expiring** (within 7 days) should show an "Expiring Soon" badge on display cards to create urgency and inform customers.

This phase covers all 4 card surfaces:

#### Card Surface Inventory

| Surface | Component | Used In | Card Interface |
|---------|-----------|---------|----------------|
| **SmartProductCard** | `SmartProductCard.tsx` | Storefront (ProductSection), RandomFeaturedProducts (directory home), catalog pages | `ProductData` |
| **EnhancedStorefrontProductCard** | `EnhancedStorefrontProductCard.tsx` | Storefront (EnhancedProductDisplay) | `EnhancedProductData` |
| **StorefrontFeaturedProducts** | `StorefrontFeaturedProducts.tsx` | Storefront featured buckets | `FeaturedProduct` |
| **UniversalDirectoryGrid** | `UniversalDirectoryGrid.tsx` | Directory listing pages | Inline product type |

#### 8a. MV — Expose `expires_at` in SELECT

**File:** `database/migrations/059_product_expiration_dates.sql`

The MV currently selects columns from `inventory_items` (aliased as `ii`). Add `expires_at` to the MV SELECT clause so it's available in all public API responses:

```sql
-- In the MV SELECT clause, after ii.updated_at:
ii.expires_at,
```

This makes `expires_at` available in every API response that reads from `mv_storefront_discovery` — storefront products, directory products, random featured products, and featured bucket products.

#### 8b. Shared Utility — `ExpirationBadge` Component

**File:** `apps/web/src/components/products/ExpirationBadge.tsx` (NEW)

Create a single reusable badge component to avoid duplicating expiration logic across 4 card types:

```tsx
interface ExpirationBadgeProps {
  expiresAt?: string | null;
  showsExpiration?: boolean; // capability-gated
  variant?: 'overlay' | 'inline'; // overlay = on image, inline = in card body
  className?: string;
}

export function ExpirationBadge({ expiresAt, showsExpiration, variant = 'overlay', className = '' }: ExpirationBadgeProps) {
  if (!showsExpiration || !expiresAt) return null;

  const now = new Date();
  const exp = new Date(expiresAt);
  const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil <= 0) return null; // Expired products are filtered by MV, shouldn't appear

  if (daysUntil <= 3) {
    // Urgent — red badge
    return <span className={`bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold ${className}`}>Ends in {daysUntil}d</span>;
  }
  if (daysUntil <= 7) {
    // Warning — amber badge
    return <span className={`bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold ${className}`}>Expiring Soon</span>;
  }
  return null; // More than 7 days out — no badge needed
}
```

#### 8c. SmartProductCard — `SmartProductCard.tsx`

**File:** `apps/web/src/components/products/SmartProductCard.tsx`

The `ProductData` interface (line 224) already has `daysUntilExpiration`, `isExpired`, `isExpiringSoon` — but these are for **featured** product expiration, not product listing expiration. Add new fields:

```typescript
// In ProductData interface, after featuredExpiresAt:
expiresAt?: string | null; // Product listing expiration (distinct from featured expiration)
```

Import and use the badge component:
```typescript
import { ExpirationBadge } from './ExpirationBadge';
```

Add capability check (the card already uses `useCommerceCapability` and `usePaymentGatewayCapability` — add `useProductOptionsCapability`):
```typescript
const productOptionsCap = useProductOptionsCapability(product.tenantId);
const showsExpiration = productOptionsCap.data?.effectiveShowsExpiration ?? false;
```

Render the badge as an overlay on the product image (in all 3 variants: `featured`, `grid`, `compact`):
```tsx
{/* Expiration badge — top-right of image, below stock badge */}
<ExpirationBadge
  expiresAt={product.expiresAt}
  showsExpiration={showsExpiration}
  variant="overlay"
  className="absolute top-2 right-2"
/>
```

**Note:** `RandomFeaturedProducts.tsx` passes `PublicProduct` data into `SmartProductCard`. The `expiresAt` field will flow through automatically once added to `PublicProduct` (see 8e).

#### 8d. EnhancedStorefrontProductCard — `EnhancedStorefrontProductCard.tsx`

**File:** `apps/web/src/components/products/EnhancedStorefrontProductCard.tsx`

Add to `EnhancedProductData` interface (line 26):
```typescript
expiresAt?: string | null;
```

Import and use:
```typescript
import { ExpirationBadge } from './ExpirationBadge';
import { useProductOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
```

Add capability check:
```typescript
const productOptionsCap = useProductOptionsCapability(product.tenantId);
const showsExpiration = productOptionsCap.data?.effectiveShowsExpiration ?? false;
```

Render in all 3 variants (`compact`, `featured`, `grid`) as an overlay on the image:
```tsx
<ExpirationBadge
  expiresAt={product.expiresAt}
  showsExpiration={showsExpiration}
  variant="overlay"
  className="absolute top-2 right-2"
/>
```

#### 8e. PublicProduct Type — `ProductSingleton.tsx`

**File:** `apps/web/src/providers/data/ProductSingleton.tsx`

Add to `PublicProduct` interface (line 10):
```typescript
expiresAt?: string | null;
```

This flows through to `RandomFeaturedProducts.tsx` which passes `PublicProduct` into `SmartProductCard`.

#### 8f. StorefrontFeaturedProducts — `StorefrontFeaturedProducts.tsx`

**File:** `apps/web/src/components/storefront/StorefrontFeaturedProducts.tsx`

The `FeaturedProduct` interface (line 12) already has `featuredExpiresAt`, `daysUntilExpiration`, `isExpired`, `isExpiringSoon` for featured expiration. Add product listing expiration:

```typescript
// In FeaturedProduct interface:
expiresAt?: string | null;
```

This component passes products into `SmartProductCard`, so the `expiresAt` field flows through automatically once added to the product mapping. Add `expiresAt` to the product mapping objects at lines 577, 747, 879, 979:
```typescript
expiresAt: product.expiresAt,
```

The `SmartProductCard` will handle the badge rendering and capability check.

#### 8g. UniversalDirectoryGrid — `UniversalDirectoryGrid.tsx`

**File:** `apps/web/src/components/directory/UniversalDirectoryGrid.tsx`

This component renders directory product cards. Check what card component it uses — if it uses `SmartProductCard`, the `expiresAt` field flows through automatically. If it renders custom cards, add the `ExpirationBadge` directly.

Add `expiresAt` to whatever product type interface it uses, and render the badge.

#### 8h. API Response — Include `expires_at` in Public Product Endpoints

The public product API endpoints that serve storefront/directory data read from `mv_storefront_discovery`. Since the MV SELECT now includes `ii.expires_at` (from 8a), the field will be in the raw query results. Ensure the API response transformers map it:

- **Storefront products endpoint** (`/api/public/storefront/:tenantId/products`) — include `expires_at` in response
- **Random featured endpoint** (`/api/public/products/random-featured`) — include `expires_at` in response
- **Directory products endpoint** — include `expires_at` in response
- **Featured bucket endpoint** — include `expires_at` in response

The field should be mapped as `expiresAt` (camelCase) in JSON responses for frontend consistency.

#### 8i. Capability Gating on Cards

All card components use `useProductOptionsCapability(product.tenantId)` to check `effectiveShowsExpiration`. The `ExpirationBadge` component receives `showsExpiration` as a prop and renders nothing when false. This means:

- **Commitment+ tenants** — "Expiring Soon" / "Ends in 3d" badges appear on product cards
- **Starter/Discovery/Storefront tenants** — no badges, even if `expires_at` is set in the DB
- The capability check happens per-tenant (using `product.tenantId`), so a directory page showing products from multiple tenants will correctly show badges only for eligible tenants' products

#### 8j. Visual Design

Badge placement and styling:

- **Position:** Top-right of product image, below any stock/preorder badges
- **Urgent (≤3 days):** Red background, white text, "Ends in Nd"
- **Warning (≤7 days):** Amber background, white text, "Expiring Soon"
- **No badge (>7 days):** No visual indicator — the product looks normal
- **Expired products:** Never appear on public surfaces (filtered by MV WHERE clause)

The badge uses the same styling pattern as existing badges in `SmartProductCard` (e.g., the "Out of Stock" badge at line 603).

## File Change Summary

| File | Change |
|------|--------|
| `database/migrations/059_product_expiration_dates.sql` | NEW — Add `expires_at` + `sale_expires_at` columns, indexes, MV recreate (SELECT + WHERE + sale-aware price computation), register feature key, assign to tiers |
| `apps/api/prisma/schema.prisma` | Add `expires_at` + `sale_expires_at` fields to `inventory_items` |
| `apps/api/src/index.ts` | Add `expires_at` + `sale_expires_at` to Zod schema, create handler, update handler, patch handler, capability check |
| `apps/api/src/services/resolvers/ProductOptionsResolver.ts` | Add `shows_expiration` to resolver |
| `apps/api/src/services/resolvers/types.ts` | Add `shows_expiration` to `EffectiveProductOptions` |
| `apps/web/src/services/UnifiedCapabilityService.ts` | Add `showsExpiration` to mapper |
| `apps/web/src/services/CapabilityResolutionService.ts` | Add `showsExpiration` to `ProductOptionsState` + resolver |
| `apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx` | Add `expiresAt` + `saleExpiresAt` to type, initial data, edit loader |
| `apps/web/src/components/inventory/wizards/steps/OrganizationStep.tsx` | Add listing expiration date picker UI (capability-gated) |
| `apps/web/src/components/inventory/wizards/steps/PricingStep.tsx` | Add sale expiration date picker UI (capability-gated, shown only when sale price is set) |
| `apps/web/src/components/inventory/wizards/steps/ReviewStep.tsx` | Add expiration to review summary (capability-gated) |
| `apps/web/src/app/t/[tenantId]/items/create/page.tsx` | Add `expires_at` + `sale_expires_at` to API payload |
| `apps/web/src/services/ItemsSingletonService.ts` | Add `expires_at` + `sale_expires_at` to `Item` interface |
| `apps/web/src/components/items/ItemsPageClient.tsx` | Add expiration badge + filter + "Sale Ends" column (capability-gated) |
| `apps/web/src/components/products/ExpirationBadge.tsx` | NEW — Reusable expiration badge component (supports both listing and sale expiration modes) |
| `apps/web/src/components/products/SmartProductCard.tsx` | Add `expiresAt` + `saleExpiresAt` to `ProductData`, render `ExpirationBadge` (capability-gated, sale badge priority over listing badge) |
| `apps/web/src/components/products/EnhancedStorefrontProductCard.tsx` | Add `expiresAt` + `saleExpiresAt` to `EnhancedProductData`, render `ExpirationBadge` (capability-gated) |
| `apps/web/src/components/storefront/StorefrontFeaturedProducts.tsx` | Add `expiresAt` + `saleExpiresAt` to `FeaturedProduct`, pass through to `SmartProductCard` |
| `apps/web/src/providers/data/ProductSingleton.tsx` | Add `expiresAt` + `saleExpiresAt` to `PublicProduct` interface |
| `apps/web/src/components/directory/UniversalDirectoryGrid.tsx` | Add `expiresAt` + `saleExpiresAt` to product type, render `ExpirationBadge` |
| Public API response transformers | Include `expires_at`/`expiresAt` + `sale_expires_at`/`saleExpiresAt` in storefront, directory, random-featured, featured-bucket responses |

## Edge Cases

- **Null `expires_at`** — permanent listing, no behavior change (all existing products)
- **Expired product in cart** — product remains purchasable if already in a cart; the MV filter only prevents new discovery. This is acceptable — the customer already found it.
- **Expired product with active featured_products entry** — the MV filter removes it from `mv_storefront_discovery`, so it won't appear in featured sections either. The `featured_products` record remains but is effectively hidden.
- **GMC sync** — `GMCProductSync.ts` checks `item.visibility !== 'public'` but does NOT check `expires_at`. An expired product with `visibility = 'public'` could still sync to Google. **Fix:** Add `|| (item.expires_at && item.expires_at < new Date())` to the GMC sync check.
- **Merchant extends expiration** — setting `expires_at` to a future date (or null) instantly re-activates the product on next MV refresh.
- **Variant products** — expiration is on the parent `inventory_items` record. Variants inherit visibility from parent. No change needed to variant logic.
- **Tier downgrade** — if a merchant downgrades from Commitment to Starter, they lose the expiration feature. Existing `expires_at` values remain in the DB and the MV filter still applies (expired products stay hidden). The wizard UI hides the date picker, but the merchant can contact support to remove/change expiration dates. The items table hides the expiration column. The backend write-time validation prevents setting new expiration dates.
- **Tier upgrade** — if a merchant upgrades to Commitment+, the expiration UI appears. Any existing `expires_at` values (if previously set during a higher tier) become visible and editable again.
- **Public product page display** — the "Expiring Soon" badge on public product pages is only shown when the tenant has the `product_options_creation_expiration` feature. This is controlled server-side via the `shows_expiration_status` flag in the API response, preventing lower-tier merchants from displaying expiration info.
- **Feature key naming** — follows R15 convention: `product_options_creation_expiration` (canonical key in the `creation` group of `product_options` capability type). No legacy alias needed since this is a new feature.
- **Card badge vs MV filter** — the MV WHERE clause handles **hiding** expired products (they never appear). The card badges handle **warning** about soon-to-expire products. These are complementary, not redundant. The badge only shows for products that are still visible (≤7 days from expiration) and only for tenants with the capability.
- **Multi-tenant directory pages** — when a directory page shows products from multiple tenants, the `useProductOptionsCapability(product.tenantId)` check runs per-tenant. Products from Commitment+ tenants show badges; products from Starter tenants don't. This is correct behavior — each tenant's capability settings are independent.
- **Existing featured expiration fields** — `SmartProductCard.ProductData` already has `daysUntilExpiration`, `isExpired`, `isExpiringSoon`, `featuredExpiresAt` — these are for **featured product** expiration (the `featured_products` table), not product listing expiration. The new `expiresAt` field is for **product listing** expiration (the `inventory_items.expires_at` column). Both can coexist: a product could be featured (with its own featured expiration) and also have a listing expiration. The badges serve different purposes — featured expiration controls featured badge display; listing expiration controls product visibility.
- **Sale expiration vs listing expiration** — these are independent features. A product can have a listing expiration (`expires_at`) without a sale expiration (`sale_expires_at`), and vice versa. Listing expiration hides the product entirely; sale expiration just reverts the price to normal. Both can be set on the same product (e.g., a seasonal product on sale that also expires at end of season).

---

### Phase 9: Optional Sale Price Expiration (`sale_expires_at`)

The product wizard already has a sale price input (`PricingStep.tsx`). All product display surfaces are already sale-price-aware (`PriceDisplay` shows sale price with strikethrough, `SmartProductCard` and `EnhancedStorefrontProductCard` show "SALE" badges and discount percentages). Adding an optional `sale_expires_at` field follows the same pattern as `expires_at` — optional, capability-gated, MV-computed.

**Key distinction from Phase 8:** Sale expiration does NOT hide the product. It only **nullifies the sale price** after the expiration date. The product remains visible at its regular price.

#### 9a. Database — Add `sale_expires_at` Column

**File:** `database/migrations/059_product_expiration_dates.sql` (same migration file)

```sql
-- Add sale_expires_at column
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sale_expires_at timestamp with time zone;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_inventory_items_sale_expires_at
  ON inventory_items (sale_expires_at)
  WHERE sale_expires_at IS NOT NULL;
```

**File:** `apps/api/prisma/schema.prisma`

```prisma
model inventory_items {
  // ... existing fields ...
  sale_expires_at   DateTime?   // Optional sale price expiration
}
```

#### 9b. MV — Sale-Aware Price Computation

**File:** `database/migrations/059_product_expiration_dates.sql` (MV recreate section)

The MV currently computes `sale_price_cents`, `current_price_cents`, `is_on_sale`, `discount_percentage`, and `price_status` from `ii.sale_price_cents`. Update these to nullify the sale price when `sale_expires_at` has passed:

```sql
-- Replace existing sale_price_cents in MV SELECT:
CASE
  WHEN ii.sale_price_cents IS NOT NULL
    AND ii.sale_price_cents < ii.price_cents
    AND (ii.sale_expires_at IS NULL OR ii.sale_expires_at > now())
  THEN ii.sale_price_cents
  ELSE NULL
END as sale_price_cents,

-- current_price_cents uses COALESCE(sale_price_cents, price_cents) — automatically picks up NULL
COALESCE(
  CASE
    WHEN ii.sale_price_cents IS NOT NULL
      AND ii.sale_price_cents < ii.price_cents
      AND (ii.sale_expires_at IS NULL OR ii.sale_expires_at > now())
    THEN ii.sale_price_cents
    ELSE NULL
  END,
  ii.price_cents
) as current_price_cents,

-- is_on_sale — false when sale has expired
CASE
  WHEN ii.sale_price_cents IS NOT NULL
    AND ii.sale_price_cents < ii.price_cents
    AND (ii.sale_expires_at IS NULL OR ii.sale_expires_at > now())
  THEN true
  ELSE false
END as is_on_sale,

-- discount_percentage — 0 when sale has expired
CASE
  WHEN ii.sale_price_cents IS NOT NULL
    AND ii.sale_price_cents < ii.price_cents
    AND (ii.sale_expires_at IS NULL OR ii.sale_expires_at > now())
  THEN ROUND(((ii.price_cents - ii.sale_price_cents)::numeric / ii.price_cents::numeric) * 100, 0)
  ELSE 0
END as discount_percentage,

-- price_status — 'regular' when sale has expired
CASE
  WHEN ii.sale_price_cents IS NOT NULL
    AND ii.sale_price_cents < ii.price_cents
    AND (ii.sale_expires_at IS NULL OR ii.sale_expires_at > now())
  THEN 'on_sale'
  WHEN (ii.metadata->>'compare_at_price_cents')::numeric IS NOT NULL
    AND (ii.metadata->>'compare_at_price_cents')::numeric > ii.price_cents THEN 'discounted'
  ELSE 'regular'
END as price_status,

-- Expose sale_expires_at for card "Sale Ends Soon" badges
ii.sale_expires_at,
```

This pattern appears in **3 places** in the MV SQL (storefront scope, tenant scope, and directory scope). All 3 must be updated identically.

**Important:** The `sale_expires_at` column is also added to the MV SELECT so frontend cards can display "Sale Ends in Nd" badges.

#### 9c. Backend API — Accept `sale_expires_at` in Create/Update

**File:** `apps/api/src/index.ts`

Add to the Zod create/update schema (alongside `sale_price_cents`):

```typescript
sale_expires_at: z.string().datetime().optional().nullable(),
```

In the create/update handlers, map to Prisma:
```typescript
sale_expires_at: data.sale_expires_at ? new Date(data.sale_expires_at) : null,
```

**Capability gating:** The same `product_options_creation_expiration` feature key gates both `expires_at` and `sale_expires_at`. If the tenant lacks the feature, the backend rejects `sale_expires_at` with a 403. This is consistent — "expiration" as a creation-group feature covers all expiration types.

#### 9d. Frontend Item Interface

**File:** `apps/web/src/services/ItemsSingletonService.ts`

Add to `Item` interface:
```typescript
sale_expires_at?: string | null;
saleExpiresAt?: string | null; // camelCase alias
```

#### 9e. Product Wizard — Sale Expiration Date Picker

**File:** `apps/web/src/components/inventory/wizards/steps/PricingStep.tsx`

The wizard already has a sale price input section (line 261). Add an optional sale expiration date picker **below** the sale price input, visible only when:
1. A sale price is set (`data.salePrice` is truthy)
2. The tenant has the expiration capability (`showsExpiration`)

```tsx
// Add to PricingStepProps data interface:
saleExpiresAt?: string;

// Add import:
import { useProductOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';

// In component:
const productOptionsCap = useProductOptionsCapability(tenantId);
const showsExpiration = productOptionsCap.data?.effectiveShowsExpiration ?? false;

// Render below sale price calculations (after line ~330):
{data.salePrice && showsExpiration && (
  <div className="space-y-2 mt-4">
    <Label className="text-sm font-medium">Sale End Date (Optional)</Label>
    <p className="text-xs text-gray-500">
      When the sale expires, the product reverts to its regular price automatically.
    </p>
    <Input
      type="datetime-local"
      value={data.saleExpiresAt ? new Date(data.saleExpiresAt).toISOString().slice(0, 16) : ''}
      onChange={(e) => onChange({
        ...data,
        saleExpiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined
      })}
    />
  </div>
)}
```

**File:** `apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx`

Add to `WizardData` interface and `INITIAL_DATA`:
```typescript
saleExpiresAt: undefined as string | undefined,
```

In `loadExistingProduct`, map from API response:
```typescript
saleExpiresAt: existing.sale_expires_at || existing.saleExpiresAt,
```

**File:** `apps/web/src/app/t/[tenantId]/items/create/page.tsx`

Add to API payload:
```typescript
sale_expires_at: data.saleExpiresAt || undefined,
```

#### 9f. PublicProduct Type

**File:** `apps/web/src/providers/data/ProductSingleton.tsx`

Add to `PublicProduct` interface:
```typescript
saleExpiresAt?: string | null;
```

#### 9g. Card Interfaces — Add `saleExpiresAt`

**`SmartProductCard.tsx` — `ProductData` interface:**
```typescript
saleExpiresAt?: string | null;
```

**`EnhancedStorefrontProductCard.tsx` — `EnhancedProductData` interface:**
```typescript
saleExpiresAt?: string | null;
```

**`StorefrontFeaturedProducts.tsx` — `FeaturedProduct` interface:**
```typescript
saleExpiresAt?: string | null;
```

Add `saleExpiresAt: product.saleExpiresAt` to all product mapping objects (alongside the existing `salePriceCents` mapping).

#### 9h. ExpirationBadge Component — Extend for Sale Expiration

**File:** `apps/web/src/components/products/ExpirationBadge.tsx`

Extend the reusable badge to support a `saleMode` variant:

```tsx
interface ExpirationBadgeProps {
  expiresAt?: string | null;
  showsExpiration?: boolean;
  variant?: 'overlay' | 'inline';
  className?: string;
  // Sale expiration support
  saleExpiresAt?: string | null;
  saleMode?: boolean; // When true, badge says "Sale Ends in Nd" instead of "Expiring Soon"
}

export function ExpirationBadge({
  expiresAt,
  showsExpiration,
  variant = 'overlay',
  className = '',
  saleExpiresAt,
  saleMode = false,
}: ExpirationBadgeProps) {
  if (!showsExpiration) return null;

  const targetDate = saleMode ? saleExpiresAt : expiresAt;
  if (!targetDate) return null;

  const now = new Date();
  const exp = new Date(targetDate);
  const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil <= 0) return null;

  if (saleMode) {
    // Sale expiration badges — always red/urgent to drive purchase urgency
    if (daysUntil <= 1) {
      return <span className={`bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse ${className}`}>Sale Ends Today!</span>;
    }
    if (daysUntil <= 3) {
      return <span className={`bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold ${className}`}>Sale Ends in {daysUntil}d</span>;
    }
    if (daysUntil <= 7) {
      return <span className={`bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-semibold ${className}`}>Sale Ends Soon</span>;
    }
    return null;
  }

  // Listing expiration badges (existing logic from Phase 8)
  if (daysUntil <= 3) {
    return <span className={`bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold ${className}`}>Ends in {daysUntil}d</span>;
  }
  if (daysUntil <= 7) {
    return <span className={`bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold ${className}`}>Expiring Soon</span>;
  }
  return null;
}
```

#### 9i. Card Rendering — Sale Expiration Badge

In `SmartProductCard`, `EnhancedStorefrontProductCard`, and other card components, render the sale expiration badge **only when the product is on sale** (the MV already nullifies `sale_price_cents` when the sale has expired, so `isOnSale` / `salePriceCents` will be false/null for expired sales — the badge won't show because the product is no longer on sale).

```tsx
{/* Sale expiration badge — shown only while sale is active */}
{product.isOnSale && (
  <ExpirationBadge
    saleExpiresAt={product.saleExpiresAt}
    showsExpiration={showsExpiration}
    saleMode
    variant="overlay"
    className="absolute top-2 right-2"
  />
)}
```

**Placement:** The sale expiration badge replaces (or sits next to) the existing "SALE" / discount badge. Since the sale expiration badge conveys urgency, it should take priority. If both listing expiration and sale expiration badges would show, the sale badge takes priority (it's more actionable for the customer).

```tsx
{/* Priority: sale expiration > listing expiration > stock badges */}
{product.isOnSale && product.saleExpiresAt ? (
  <ExpirationBadge saleExpiresAt={product.saleExpiresAt} showsExpiration={showsExpiration} saleMode className="absolute top-2 right-2" />
) : (
  <ExpirationBadge expiresAt={product.expiresAt} showsExpiration={showsExpiration} className="absolute top-2 right-2" />
)}
```

#### 9j. Items Table — Sale Expiration Column

**File:** `apps/web/src/components/items/ItemsPageClient.tsx`

When `showsExpiration` is true, add a "Sale Ends" column showing `sale_expires_at` (only for items with a sale price). This sits next to the "Expires At" column from Phase 7.

#### 9k. API Response Transformers

Same as Phase 8h — include `sale_expires_at`/`saleExpiresAt` in all public product API responses. The MV SELECT already exposes `ii.sale_expires_at` (from 9b), so the raw data is available. Map it as `saleExpiresAt` (camelCase) in JSON responses.

#### 9l. Visual Design — Sale Expiration Badges

| Time Remaining | Badge Text | Color | Animation |
|----------------|------------|-------|-----------|
| ≤1 day | "Sale Ends Today!" | Red-600 | Pulse |
| ≤3 days | "Sale Ends in Nd" | Red-500 | None |
| ≤7 days | "Sale Ends Soon" | Orange-500 | None |
| >7 days | No badge | — | — |
| Expired | No badge (sale price nullified by MV, product shows at regular price) | — | — |

The sale expiration badges use warmer colors (red/orange) compared to listing expiration badges (red/amber) to visually distinguish them. The "Sale Ends Today!" badge with pulse animation creates maximum urgency for last-day sales.

#### 9m. Edge Cases — Sale Expiration

- **No `sale_expires_at` set** — sale price is permanent (existing behavior, all current products)
- **Sale expired, no listing expiration** — product shows at regular price, no badge
- **Sale expired + listing expiration active** — product shows at regular price with listing expiration badge (if ≤7 days)
- **Sale active + listing expiring soon** — both badges could show; sale badge takes priority (more actionable)
- **Merchant extends sale** — setting `sale_expires_at` to a future date re-activates the sale price on next MV refresh
- **Merchant removes sale price** — setting `sale_price_cents` to null also nullifies the sale expiration (no sale = no sale expiration)
- **Variant sale prices** — `sale_expires_at` is on the parent `inventory_items` record. If individual variants have their own `sale_price_cents`, the parent `sale_expires_at` applies to all variant sale prices. This is the simplest model; per-variant sale expiration is a future enhancement.

---

### Phase 10 — Skill Document: Product Expiration Architecture

**Goal:** Capture the architectural insights and patterns from this design as a reusable skill document for future development.

**Scope:**
- Create `.devin/skills/product-expiration-architecture.md` capturing:
  - **Pattern: MV as enforcement layer** — the materialized view WHERE clause is the single enforcement point for listing expiration. Expired products are filtered before they reach any API response, so no client-side or API-level filtering is needed. This is the root cause fix — every downstream consumer automatically benefits.
  - **Pattern: MV as computation layer** — sale expiration uses the MV SELECT clause (not WHERE) to nullify sale prices. The product stays visible but the price reverts. Same MV, different enforcement mechanism (filter vs transform).
  - **Pattern: Two expiration types, one capability gate** — `product_options_creation_expiration` gates both `expires_at` and `sale_expires_at`. Splitting them into separate feature keys would create a confusing UX ("I can expire listings but not sales?"). One conceptual feature ("expiration") maps to two DB columns.
  - **Pattern: Shared badge component with mode switch** — `ExpirationBadge` handles both listing and sale modes via a `saleMode` prop. Avoids two separate components with duplicated date math. Badge priority (sale > listing) is a render-time decision, not a config decision.
  - **Pattern: Capability-gated display, MV-enforced behavior** — the MV enforces expiration regardless of tier (expired products are hidden for ALL tenants). The capability only gates whether merchants can SET expiration dates and whether customers SEE the "Expiring Soon" badges. This separation means: a downgraded tenant's existing expirations still work (products still hide), they just can't set new ones.
  - **Insight: Expiration ≠ featured expiration** — the codebase already had `featuredExpiresAt`, `daysUntilExpiration`, `isExpired`, `isExpiringSoon` on `SmartProductCard.ProductData` — but these are for the `featured_products` table (featured badge lifecycle), not the `inventory_items` table (product listing lifecycle). The new `expiresAt` / `saleExpiresAt` fields are structurally similar but semantically distinct. Both can coexist on the same product.
  - **Insight: Sale expiration is price transformation, not visibility filtering** — listing expiration removes the product from the MV result set (WHERE clause). Sale expiration transforms the price columns in the MV SELECT (sale_price_cents → NULL, is_on_sale → false). Confusing these two would put sale-expired products in a WHERE filter, hiding products that should remain visible at regular price.
  - **Insight: Badge urgency should match actionability** — "Sale Ends Today!" with pulse animation drives immediate purchase. "Expiring Soon" (listing) is informational, not actionable. The badge styling reflects this: sale badges are warmer (red/orange) and more aggressive; listing badges are cooler (red/amber) and calmer.
  - **Insight: Per-tenant capability checks on multi-tenant surfaces** — directory pages show products from multiple tenants. The `useProductOptionsCapability(product.tenantId)` hook runs per-product, so badges appear only for eligible tenants' products. This is correct — capability settings are per-tenant, not per-page.
  - **Checklist for future expiration work:**
    - Does the expiration enforcement happen in the MV? If not, it's a downstream workaround — move it upstream
    - Is the new expiration field in the MV SELECT? If not, frontend badges can't access it
    - Does the wizard date picker check `showsExpiration`? If not, lower-tier merchants can set expirations they can't use
    - Does the API reject `expires_at` / `sale_expires_at` when the capability is off? If not, it's a write-time validation gap
    - Is the badge using the shared `ExpirationBadge` component? If not, date math and styling will diverge
    - Are both listing and sale expiration badges handled with priority? If not, both could render simultaneously and clutter the card
  - **Related patterns in the codebase:**
    - `CapabilityConstraintService.ts` — same cache + DB-driven + static fallback pattern (for capability constraints)
    - `featured_products` table — separate expiration system for featured badges (the "other" expiration)
    - `PriceDisplay.tsx` — existing sale-price-aware display that automatically benefits from MV sale nullification
    - `GMCProductSync.ts` — downstream consumer that needs explicit expiration awareness (edge case: expired products syncing to Google)

**Key files:**
- New: `.devin/skills/product-expiration-architecture.md`

**Estimated effort:** 1 day

---

## Phase Dependencies

- **Phases 1-6** (DB + API + wizard + items table) — sequential, each builds on the previous
- **Phase 7** (capability gating) — depends on Phases 1-6 (feature must exist before it can be gated)
- **Phase 8** (product display cards) — depends on Phases 1-6 (MV exposes `expires_at`) and Phase 7 (capability check for badge display)
- **Phase 9** (sale expiration) — depends on Phases 1-6 (same migration, same MV recreate) and Phase 8 (extends `ExpirationBadge` component)
- **Phase 10** (skill document) — depends on Phases 1-9 (captures real implementation insights, not just design predictions)

**Critical path:** Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9
**Documentation track:** Phase 9 → Phase 10 (can be drafted after Phase 9, finalized after all phases are implemented)
