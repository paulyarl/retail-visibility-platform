---
description: How to implement barcode-driven product enrichment with commercial APIs and B2B wholesale matching — connector patterns, parallel orchestration, tier gating, affiliate tracking, brand partner claims, affiliate analytics, click expiry job, capability system integration, and modal decomposition
---

# Barcode-Driven Product Onboarding & B2B Wholesale Matching

Use this skill when implementing barcode enrichment connectors, wholesale supplier matching, affiliate tracking, or enhancing the EditItemModal with enrichment features.

**Design doc:** `docs/COMMERCIAL_SUPPLIER_CONNECTORS_DESIGN.md`
**Sprint plan:** `docs/BARCODE_WHOLESALE_SPRINT_PLAN.md`

---

## 1. Architecture Overview

### 1.1 Two-Layer System

| Layer | Purpose | Tier | Monetization |
|---|---|---|---|
| **Data Enrichment** | Scan barcode → auto-populate product fields (name, brand, description, image) | All tiers (basic) | None — utility feature |
| **Wholesale Matching** | Find B2B suppliers for scanned products, enable bulk ordering | Growth+ (premium) | Affiliate commissions + subscription + brand claims |

### 1.2 Enrichment Fallback Chain

```
Barcode Scan
  │
  ▼
1. In-memory cache (Map, 24h TTL, 10k LRU)         ← ≤150ms
  │ miss
  ▼
2. Database cache (barcode_enrichment table)        ← cross-tenant shared
  │ miss
  ▼
3. Supplier catalog (supplier_catalog_item table)   ← cross-tenant
  │ miss
  ▼
4. External APIs (parallel + sequential fallback)
  │   a. BarcodeLookup.com + Go-UPC (parallel, Promise.allSettled)
  │   b. Kroger (sequential, OAuth2)
  │   c. UPC Database (sequential)
  │   d. Open Food Facts (sequential)
  │ all fail
  ▼
5. Stub fallback (minimal data) + log to barcode_lookup_log
```

**Core principle:** Scan once, benefit all. Each layer caches to the layer above. A barcode scanned by any tenant is served from cache for all subsequent scans.

### 1.3 Product Type Impact Matrix

| Product Type | Barcode Enrichment | Wholesale Matching | EditItemModal Decomposition |
|---|---|---|---|
| **Physical** | ✅ Full — GTIN lookup populates all fields | ✅ Full — "Order Bulk" / "Find Supplier" | ✅ Required (prerequisite) |
| **Digital** | ⚠️ Low — rarely has barcodes; no-op without GTIN | ❌ No physical supplier | ✅ Still applies (shared form infra) |
| **Service** | ❌ No barcodes | ❌ No physical supplier | ✅ Still applies (shared form infra) |

**Implementation rule:** GTIN field and `SupplierMatchSection` only render for `physical` product type. Hide for digital/service.

---

## 2. Supplier Connector Pattern

### 2.1 Interface

All barcode lookup providers implement the `SupplierConnector` interface in `apps/api/src/services/SupplierConnectors.ts`:

```typescript
interface SupplierConnector {
  supplierId: string;  // e.g., 'supplier-comm-barcodelookup'
  fetchByBarcode(gtin: string): Promise<BatchIngestRow | null>;
  searchByText(query: string): Promise<BatchIngestRow[]>;
}
```

### 2.2 Connector Implementation Checklist

When adding a new commercial connector:

1. **Read API key from env at construction** — Return `null` from `fetchByBarcode` if not configured (connector is skipped in chain)
2. **Use `AbortSignal.timeout(5000)`** — 5-second timeout per provider, same as existing connectors
3. **Map API response → `BatchIngestRow`** — Follow field mappings in design doc §3
4. **Set `supplierId`** — Follow convention: `supplier-comm-{name}` for commercial, `supplier-off-{name}` for open-source
5. **Rate limiting** — Existing per-provider rate limiting (500 req/hr), `rateLimitState` Map, 429 response on exceed
6. **OAuth2 (if applicable)** — Token refresh with 5-min safety margin, transparent re-auth on 401

### 2.3 Existing Connectors

| Connector | supplierId | Type | Methods |
|---|---|---|---|
| OpenFoodFactsConnector | `supplier-off-open-food-facts` | Open | `fetchByBarcode` |
| OpenBeautyFactsConnector | `supplier-off-open-beauty-facts` | Open | `fetchByBarcode` |
| UPCDatabaseConnector | `supplier-off-upc-database` | Open | `fetchByBarcode` |
| BarcodeLookupConnector | `supplier-comm-barcodelookup` | Commercial | `fetchByBarcode` + `searchByText` |
| GoUpcConnector | `supplier-comm-goupc` | Commercial | `fetchByBarcode` only |
| KrogerConnector | `supplier-comm-kroger` | Commercial | `fetchByBarcode` + `searchByText` (OAuth2) |

### 2.4 Parallel Orchestration

Commercial APIs are called in parallel on cache miss. Open-source APIs remain sequential fallbacks:

```typescript
// In BarcodeEnrichmentService.enrich()
Step 4a: Promise.allSettled([enrichFromBarcodeLookup, enrichFromGoUpc])
  → merge payloads if both succeed (BarcodeLookup wins conflicts, Go-UPC fills gaps)
Step 4b: enrichFromKroger (sequential fallback)
Step 4c: enrichFromUPCDatabase (existing)
Step 4d: enrichFromOpenFoodFacts (existing)
Step 5:  stub fallback + log to barcode_lookup_log
```

**Payload merge strategy:** When both BarcodeLookup and Go-UPC return data, merge by taking the first non-null value for each field. BarcodeLookup.com has priority for name/brand/category; Go-UPC fills gaps for description/images.

---

## 3. Database Schema

### 3.1 New Tables (Migrations 098-100)

**`product_suppliers`** (migration 098) — Cross-tenant, global supplier data:

| Column | Type | Notes |
|---|---|---|
| `id` | VarChar(255) | `psup-{nanoid}` |
| `gtin` | VarChar(14) | Indexed — lookup key |
| `supplier_name` | VarChar(255) | Display name |
| `supplier_type` | VarChar(50) | `distributor` / `wholesaler` / `manufacturer` |
| `moq` | Integer | Minimum order quantity |
| `min_order_value` | Integer | Minimum order value (cents) |
| `external_link` | Text | Ordering URL |
| `affiliate_params` | Text | Affiliate query params to append |
| `region` | VarChar(100) | Geographic coverage |
| `claim_type` | VarChar(30) | `exclusive` / `preferred` / `verified` |
| `brand_partner_id` | VarChar(255) | FK → brand_partner_claims.id (nullable) |

- RLS: cross-tenant read (global supplier data), no tenant-scoped writes
- Unique constraint: `(gtin, supplier_name)` — one row per supplier per barcode
- Index on `gtin` (lookup), `claim_type` (filtering)

**`affiliate_clicks`** (migration 099) — Tenant-scoped, per-merchant click tracking:

| Column | Type | Notes |
|---|---|---|
| `id` | VarChar(255) | `ac-{tk}-{nanoid}` (tenant-scoped) |
| `tenant_id` | VarChar(255) | FK → tenants.id |
| `gtin` | VarChar(14) | Barcode that triggered the click |
| `supplier_id` | VarChar(255) | FK → product_suppliers.id |
| `click_id` | VarChar(100) | Unique attribution ID (for Faire webhook) |
| `destination_url` | Text | Full URL clicked |
| `status` | VarChar(20) | `clicked` → `ordered` → `commissioned` / `expired` |
| `commission_cents` | Integer? | Set on webhook callback |
| `order_id` | VarChar(100)? | Faire order ID (set on webhook) |

- RLS: tenant-scoped (merchants see only their own clicks)
- Index on `tenant_id`, `click_id` (webhook lookup), `status`, `clicked_at`
- 30-day expiry: daily job marks `expired` if no conversion

**`brand_partner_claims`** (migration 100) — Cross-tenant, brand-paid exclusivity:

| Column | Type | Notes |
|---|---|---|
| `id` | VarChar(255) | `bpc-{nanoid}` |
| `partner_name` | VarChar(255) | Brand or distributor name |
| `partner_type` | VarChar(50) | `brand` / `distributor` / `manufacturer` |
| `barcode` | VarChar(14) | UPC/EAN being claimed |
| `claim_type` | VarChar(30) | `exclusive` / `preferred` / `verified` |
| `external_link` | Text | Direct ordering link (no affiliate — brand paid) |
| `monthly_fee_cents` | Integer | What the brand pays per month |
| `subscription_status` | VarChar(20) | `active` / `expired` / `pending` |
| `subscription_expires_at` | Timestamptz? | Auto-deactivation date |

- Unique constraint: `(barcode, claim_type)` where `claim_type = 'exclusive'` — only one exclusive per barcode
- Index on `barcode`, `partner_name`, `is_active`

### 3.2 ID Generation

Follow `tenant-scoped-id-generation.md` patterns:

| Entity | Prefix | Scope | Format |
|---|---|---|---|
| `product_suppliers` | `psup` | Global | `psup-{nanoid}` |
| `affiliate_clicks` | `ac` | Tenant-scoped | `ac-{tk}-{nanoid}` |
| `brand_partner_claims` | `bpc` | Global | `bpc-{nanoid}` |

Add generators to `apps/api/src/lib/id-generator.ts` before creating services.

### 3.3 Migration Conventions

- All DDL wrapped in `DO$$ BEGIN ... EXCEPTION WHEN OTHERS THEN END $$;`
- All INSERTs use `INSERT ... SELECT ... WHERE NOT EXISTS`
- `updated_at` trigger on all tables
- Check latest migration number before creating — as of this writing, latest is 097

---

## 4. Wholesale Matching Service

### 4.1 Supplier Match Resolution Order

```
checkSupplierMatch(barcode):
  1. Check brand_partner_claims for this barcode
     → If exclusive claim exists and active: return ONLY that partner
     → If preferred claim exists: return that partner first, then product_suppliers
  2. Check product_suppliers table
     → Return all matches
  3. Return null (no match)
```

### 4.2 Affiliate Link Construction

```typescript
buildAffiliateLink(supplier, tenantId):
  1. Take supplier.external_link
  2. Append supplier.affiliate_params (if any)
  3. Generate unique click_id (nanoid)
  4. Create affiliate_clicks record: { tenant_id, gtin, supplier_id, click_id, destination_url, status: 'clicked' }
  5. Return URL with click_id param for Faire webhook attribution
```

### 4.3 Faire Webhook

`POST /api/webhooks/faire` — receives order confirmation callbacks:
1. Verify webhook signature (Faire-specific)
2. Match `click_id` to `affiliate_clicks` record
3. Update: `status = 'ordered'`, `commission_cents = order.commission`, `order_id = order.id`, `converted_at = now()`
4. If no matching click found, log and return 200 (prevent retries)

---

## 5. Capability System & Tier Gating

### 5.1 Feature Keys

| Feature Key | Description | Tier |
|---|---|---|
| `wholesale_matching_enabled` | Master switch | Growth+ |
| `wholesale_matching_faire` | Faire marketplace search | Growth+ |
| `wholesale_matching_direct` | Direct partner matching | Scale+ |
| `wholesale_matching_dashboard` | Distributor dashboard | Scale+ |
| `wholesale_matching_flexible` | All sub-features + API access | Enterprise |

### 5.1.1 Implemented Resolver (`WholesaleMatchingResolver.ts`)

The resolver is implemented at `apps/api/src/services/resolvers/WholesaleMatchingResolver.ts` and determines the effective wholesale matching state from tier features + merchant preferences:

```typescript
export function resolveWholesaleMatching(
  features: Record<string, boolean>,
  merchantPrefs: WholesaleMatchingMerchantSettings | null
): EffectiveWholesaleMatching {
  const disabled = !!features.wholesale_matching_disabled;
  const flexible = !!features.wholesale_matching_flexible;

  let tier: WholesaleMatchingTier = 'none';
  if (!disabled) {
    if (flexible || !!features.wholesale_matching_full) {
      tier = 'full';
    } else if (!!features.wholesale_matching_search) {
      tier = 'search';
    }
  }

  const enabled = !disabled && tier !== 'none';
  const prefEnabled = merchantPrefs?.wholesale_matching_enabled !== false;
  const effectiveEnabled = enabled && prefEnabled;

  return {
    enabled: effectiveEnabled,
    tier: effectiveEnabled ? tier : 'none',
    can_check_supplier_match: effectiveEnabled,
    can_search_faire: effectiveEnabled && (tier === 'search' || tier === 'full'),
    can_build_affiliate_link: effectiveEnabled && tier === 'full',
    can_view_brand_partners: effectiveEnabled,
    is_flexible: flexible,
  };
}
```

**Key flags returned:** `enabled`, `tier` (`none`/`search`/`full`), `can_check_supplier_match`, `can_search_faire`, `can_build_affiliate_link`, `can_view_brand_partners`, `is_flexible`.

**Merchant preference override:** `merchantPrefs.wholesale_matching_enabled === false` disables the feature even if the tier allows it. Default is enabled when `null`.

### 5.1.2 Capability System Integration (Completed)

The `wholesale_matching` capability is fully wired through the 8-phase deployment flow:

- **`EffectiveCapabilityResolver.ts`**: Added to `buildExpiredCapabilitiesResponse`, `isReadOnly` override block, and `isLimited` override block (R13, R23, R27)
- **`CAPABILITY_META`** (`apps/web/src/lib/tiers/capability-display.ts`): Entry with label, icon, and summary fields
- **`summarizeResolvedCapabilities`**: Includes `wholesale_matching` in the summary output
- **`PlanSummaryPanel.tsx`** (`CAPABILITY_DISPLAY` map): Display entry for the plan summary panel
- **`CapabilityShowcase.tsx`** (rows array): Row with icon, label, enabled check, status, detail, settings link, and constraint warning
- **`CONSTRAINT_METADATA`** (`apps/api/src/routes/admin/capability-constraints.ts`): Entry with capability key, label, fields, operators, and values
- **`UnifiedCapabilityService.ts`**: Backend interface mapping including `can_view_brand_partners`
- **`CapabilityResolutionService.ts`**: `WholesaleMatchingState` interface mapping
- **`useCapabilityAccess.ts`** (`useWholesaleMatchingCapability` hook): Fetches wholesale matching state with loading/error handling
- **`wholesale-matching-options-settings.ts`**: GET returns `tierState`, PUT uses `requireWritableSubscription` middleware

### 5.2 Tier Access Matrix

| Tier | Barcode Enrichment | Supplier Match (View) | Faire Search (Action) | Distributor Dashboard |
|---|---|---|---|---|
| Trial | ✅ Basic | ❌ | ❌ | ❌ |
| Starter | ✅ Basic | ❌ | ❌ | ❌ |
| Growth | ✅ Full | ✅ View matches | ✅ Search Faire | ❌ |
| Scale | ✅ Full | ✅ View matches | ✅ Search Faire | ✅ Full dashboard |
| Enterprise | ✅ Full + Flexible | ✅ All sources | ✅ All sources | ✅ + API access |

### 5.3 Capability Deployment (8-Phase Flow)

Follow `capability-deployment-flow.md` and `add-capability-feature.md`:

1. Define feature keys in `canonical-features.ts` + `tier-hierarchies.ts`
2. Seed DB: `features_list` + `capability_features_list` + `tier_features_list`
3. No store prefs table (tier-gated, not preference-gated)
4. Create `WholesaleMatchingResolver.ts` + types in `resolvers/types.ts`
5. Wire into `EffectiveCapabilityResolver.ts` as `effective[18]`
6. Route: `wholesale-matching-options-settings.ts` with GET + PUT + tier filtering
7. Map: `UnifiedCapabilityService.ts` + `CapabilityResolutionService.ts` (frontend fallback)
8. Display: `CapabilityShowcase.tsx` row + settings page
9. Verify: `pnpm checkapi` + `pnpm checkweb` + `verify-capability-deployment.md`

### 5.4 Frontend Capability Hook

```typescript
// useWholesaleMatchingCapability.ts
export function useWholesaleMatchingCapability(tenantId: string) {
  // Uses resolveEffectiveCapabilities via UnifiedCapabilityService
  // Returns: { enabled, canSearchFaire, canViewDashboard, canDirectMatch }
}
```

---

## 6. EditItemModal Decomposition Pattern

### 6.1 When to Decompose

The `EditItemModal` (1180 lines) is a monolith with 20+ flat `useState` calls, all JSX inline, and no component extraction. **Decompose before adding spec features** — adding barcode enrichment and supplier engagement directly into the monolith would increase technical debt.

### 6.2 Decomposition Strategy

Extract into `apps/web/src/components/items/edit-modal/`:

| Component/Hook | Extracts | Lines Saved |
|---|---|---|
| `useItemFormState.ts` | All useState + init effect + save handler | ~350 |
| `useVariantManagement.ts` | Variant state + loading + change detection | ~200 |
| `ItemBasicFields.tsx` | SKU/name/brand/manufacturer/condition/MPN JSX | ~90 |
| `ItemPricingFields.tsx` | Price/sale price/stock JSX | ~60 |
| `ItemContentFields.tsx` | Description/enhanced/features/specs JSX | ~70 |
| `ItemCategorySection.tsx` | Category display + selector trigger | ~75 |
| `ItemPhotoPlaceholder.tsx` | Photo display | ~35 |
| `ItemCurrentValues.tsx` | Debug values panel | ~25 |
| `EditItemForm.tsx` | Wraps sub-components, consumes hooks | New orchestrator |
| `types.ts` | Shared prop types | New |

`EditItemModal.tsx` becomes ~150-line shell (modal open/close + delegates to `EditItemForm`).

### 6.3 Extraction Rules

1. **One extraction per commit** — Each step independently verifiable with `pnpm checkweb`
2. **No behavior changes** — Only structural. Same props, same callbacks, same rendering
3. **Hooks first** — Extract `useItemFormState` and `useVariantManagement` before JSX components (hooks are the foundation)
4. **Pure presentational components** — Sub-components receive props + setters, no state of their own
5. **Verify contract preservation** — `useItemsModals.ts` and `ItemsPageClient.tsx` must not change

### 6.4 Post-Deccomposition Spec Integration

| Spec Feature | Target | Integration |
|---|---|---|
| GTIN/barcode field | `ItemBasicFields.tsx` | New input, bound to `gtin` in `useItemFormState` |
| Barcode enrichment lookup | `useItemFormState.ts` | `lookupBarcode(gtin)` → `SupplierImportService.enrichBarcode()` → map to form fields |
| Enrichment loading state | `ItemBasicFields.tsx` | Spinner on barcode field, "Enriched from {source}" badge |
| Supplier match check | `EditItemForm.tsx` | Call `checkSupplierMatch(gtin)` on mount/when GTIN changes |
| "Order Bulk" button | `SupplierMatchSection.tsx` | Renders when match found, tier-gated |
| "Find Supplier" upsell | `SupplierMatchSection.tsx` | Renders when no match, tier-gated |
| Save with GTIN | `useItemFormState.ts` | `handleSave` includes `gtin` in payload |

---

## 7. Enrichment Data Mapping

### 7.1 BarcodeEnrichment → Form Fields

When enrichment returns a `BarcodeEnrichment` result, map to form fields using the same logic as `ItemCreationWizard.handleEnrichmentMatch`:

```typescript
// In useItemFormState.lookupBarcode() or wizard handleEnrichmentMatch()
enrichment → {
  name:           enrichment.name           || '',
  brand:          enrichment.brand          || '',
  manufacturer:   enrichment.brand          || '',  // fallback to brand
  description:    enrichment.description    || '',
  // Features/specs from enrichment.metadata
  features:       enrichment.metadata?.features   || [],
  specifications: enrichment.metadata?.specs      || {},
  // Images
  primaryImage:   enrichment.image_url ? { url: enrichment.image_url, ... } : null,
  // Category
  categoryPath:   enrichment.category_path   || '',
  // Source tracking
  enrichedFrom:   enrichment.source,  // 'barcodelookup' | 'goupc' | 'kroger' | etc.
}
```

### 7.2 Source Priority for Merge

When parallel APIs both return data:
1. **BarcodeLookup.com** — priority for: `name`, `brand`, `category_path`
2. **Go-UPC** — priority for: `description`, `image_url`, `metadata`
3. **Kroger** — priority for: `price_cents`, `nutritional_info` (grocery-specific)
4. First non-null value wins per field; subsequent values fill gaps only

---

## 8. API Routes

### 8.1 Enrichment Routes (Existing, Modified)

| Method | Path | Change |
|---|---|---|
| GET | `/api/barcode-enrichment-singleton/providers` | Add new commercial providers to list |
| POST | `/enrich` | Accept new provider names in validation |
| POST | `/batch` | Accept new provider names in validation |

### 8.2 Wholesale Matching Routes (New)

| Method | Path | Auth | Description | Mount Location |
|---|---|---|---|---|
| GET | `/api/tenants/:tenantId/wholesale/check?gtin=...` | Tenant | Check supplier match for barcode | `tenant.routes.ts` orchestrator |
| POST | `/api/tenants/:tenantId/wholesale/search` | Tenant | Search Faire for suppliers | `tenant.routes.ts` orchestrator |
| GET | `/api/tenants/:tenantId/wholesale/suppliers` | Tenant | List known suppliers for tenant products | `tenant.routes.ts` orchestrator |
| GET | `/api/tenants/:tenantId/wholesale/dashboard` | Tenant | Distributor dashboard data | `tenant.routes.ts` orchestrator |
| GET | `/:tenantId/wholesale-matching-options` | Tenant | Capability settings | `tenant.routes.ts` orchestrator |
| PUT | `/:tenantId/wholesale-matching-options` | Tenant | Update capability settings | `tenant.routes.ts` orchestrator |
| GET | `/api/admin/wholesale/suppliers` | Admin | Admin supplier dashboard | `admin.routes.ts` orchestrator |
| GET | `/api/admin/wholesale/affiliate/analytics` | Admin | Affiliate click analytics | `admin.routes.ts` orchestrator |
| POST | `/api/admin/brand-partners/claims` | Admin | CRUD for brand partner claims | `admin.routes.ts` orchestrator |
| GET | `/api/admin/brand-partners/claims` | Admin | List brand partner claims | `admin.routes.ts` orchestrator |
| POST | `/api/brand-partners/claims` | Auth | Brand self-service claim submission | `routeRegistry.ts` standalone entry |
| POST | `/api/webhooks/faire` | Webhook | Faire order confirmation callback | `routeRegistry.ts` as `preMiddleware: true` |

### 8.3 Route Mounting (Orchestrator Architecture)

The API uses an **orchestrator pattern** — not direct `app.use()` in `index.ts`. Route files are organized into orchestrators that mount sub-routers in strict order, and the orchestrators are registered in `routeRegistry.ts`.

**Key files:**
- `routeRegistry.ts` — Central registry of `RouteEntry[]` with `mountFromRegistry()` function
- `tenant.routes.ts` — Orchestrator for all `/api/tenants` sub-routes (sub-resources before `/:id` catch-all)
- `admin.routes.ts` — Orchestrator for all `/api/admin` sub-routes (specific sub-paths before generic root mounts)
- `directory.routes.ts` — Orchestrator for all `/api/directory` sub-routes (static before catch-all)

**Mounting rules for wholesale routes:**

1. **Tenant wholesale routes** (`wholesale-matching.ts`) — Mount in `tenant.routes.ts` as a sub-resource router, BEFORE `tenantsRoutes` (which has `/:id` catch-all). Same pattern as `payment-gateways`, `storefront-policies`, etc.

2. **Tenant capability settings** (`wholesale-matching-options-settings.ts`) — Mount in `tenant.routes.ts` alongside other `*-options-settings` routers (e.g., `productOptionsSettingsRoutes`, `storefrontOptionsSettingsRoutes`).

3. **Admin wholesale routes** (`admin/wholesale-matching.ts`) — Mount in `admin.routes.ts` as a specific sub-path router (`router.use('/wholesale', authenticateToken, wholesaleAdminRoutes)`), BEFORE generic root mounts.

4. **Admin brand partner routes** (`admin/brand-partners.ts`) — Mount in `admin.routes.ts` as a specific sub-path router (`router.use('/brand-partners', authenticateToken, brandPartnerAdminRoutes)`), BEFORE generic root mounts.

5. **Brand self-service** (`brand-partners.ts`) — Add as a standalone `RouteEntry` in `routeRegistry.ts` at path `/api/brand-partners`.

6. **Faire webhook** (`webhooks/faire.ts`) — Add as a `RouteEntry` in `routeRegistry.ts` with `preMiddleware: true` (before JSON parsing for signature verification). Mount at `/api/webhooks/faire`. Same pattern as existing Stripe webhooks at `/api/webhooks` and `/api/webhooks/stripe-connect`.

7. **`index.ts`** — Only wire sync job startup. Routes are handled by orchestrators + registry.

**Route ordering rules (critical):**
- Tenant sub-resource routers MUST mount before `tenantsRoutes` (which has `/:id` patterns) in `tenant.routes.ts`
- Admin specific sub-path routers MUST mount before generic root-mounted routers in `admin.routes.ts`
- Webhook routes with `preMiddleware: true` mount before JSON parsing middleware
- Check for catch-all patterns under any mount path before adding new routes

**`RouteEntry` interface:**
```typescript
interface RouteEntry {
  path: string;           // Mount path (e.g., '/api/tenants')
  router: any;            // Router or orchestrator
  middleware?: any[];     // Optional mount-level middleware
  domain: string;         // Domain grouping (e.g., 'tenant', 'admin')
  comment?: string;       // Description for logging
  preMiddleware?: boolean; // Mount before JSON parsing (webhooks)
  isCatchAll?: boolean;    // Mount after specific routes
}
```

---

## 9. Frontend Service Pattern

### 9.1 WholesaleMatchingService (Frontend Singleton)

Extends `TenantApiSingleton` (tenant-scoped, authenticated):

```typescript
class WholesaleMatchingService extends TenantApiSingleton {
  checkMatch(gtin: string): Promise<SupplierMatch | null>
  searchSuppliers(query: string): Promise<FaireSearchResult[]>
  trackClick(clickId: string): Promise<void>
  listSuppliers(): Promise<ProductSupplier[]>
  getDashboard(): Promise<DashboardData>
}
```

- Use `makeDefaultRequest` for all API calls — never direct `fetch`
- Cache patterns via `getServiceCachePatterns()`
- Invalidate via `invalidateServiceCaches()` after supplier match changes

### 9.2 Shared Components

Both the EditItemModal and ItemCreationWizard use the same components:

- **`OrderBulkButton`** — Shows when supplier match found. Links to `external_link` with affiliate params. Calls `trackAffiliateClick()` on click.
- **`FindSupplierUpsell`** — Tier-aware. Free tier: grayed message. Growth+: interactive "Find Supplier via Faire" button.
- **`SupplierMatchSection`** — Orchestrates the above. Receives `{ gtin, tenantId, productType }`. Only renders for `physical` type.
- **Faire search results modal** — Brand stories, wholesale terms, MOQ, ordering links.

### 9.3 Wizard Integration

The `ItemCreationWizard` is already step-decomposed — no decomposition needed. Add `SupplierMatchSection` to `ReviewStep.tsx`:

```tsx
// In ReviewStep.tsx
{wizardData.basicInfo.gtin && (
  <SupplierMatchSection
    gtin={wizardData.basicInfo.gtin}
    tenantId={tenantId}
    productType={wizardData.productType.type}
  />
)}
```

---

## 10. Monetization Flows

### 10.1 Affiliate Commissions (Faire Path)

```
Merchant scans barcode → Enrichment populates product data
  → Merchant views product in dashboard/modal
  → WholesaleMatchingService.checkSupplierMatch(barcode)
  → If match: "Order Bulk" button with affiliate link
  → Merchant clicks → affiliate_clicks record created (status: 'clicked')
  → Merchant places Faire order → Faire webhook fires
  → affiliate_clicks.status = 'commissioned', commission_cents set
  → Platform earns 5-15% of first wholesale order
```

### 10.2 "Find My Distributor" Premium Tier

Standard users: product name + image only (basic enrichment).
Growth+: view supplier matches + search Faire.
Scale+: full distributor dashboard with regional data.
Enterprise: all sources + API access.

### 10.3 Brand Partner Claims

Brands pay monthly fee to pin as "Official Fulfillment Partner" for specific UPCs:
- **Exclusive** — Only this partner shows when barcode scanned. Premium monthly fee.
- **Preferred** — Partner shows first, others below. Moderate fee.
- **Verified** — "Verified Supplier" badge, no priority. Low fee.

When `checkSupplierMatch()` runs, `brand_partner_claims` is checked **first** (before `product_suppliers`). Exclusive claims suppress all other results.

#### Claim Type Priority Hierarchy

The `checkSupplierMatch()` method sorts results by `claim_type` priority:
1. `exclusive` (highest)
2. `preferred`
3. `verified`
4. Any unknown type (lowest)

This sorting is applied in `WholesaleMatchingService.checkSupplierMatch()` after fetching from `product_suppliers`.

#### Admin Brand Partner Claim Workflow (Implemented)

The following endpoints are implemented in `apps/api/src/routes/admin/brand-partners.ts`:

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/brand-partners/claims` | List all claims with filters (gtin, brand_name, claim_type, approved) + pagination |
| POST | `/api/admin/brand-partners/claims` | Create a claim (brand_name, gtin, claim_type, contact_email) |
| PUT | `/api/admin/brand-partners/claims/:id/approve` | Approve a claim (sets `admin_approved = true`) |
| DELETE | `/api/admin/brand-partners/claims/:id` | Reject a claim (deletes the record) |

**Service methods** in `WholesaleMatchingService.ts`:
- `createBrandPartnerClaim(brandName, gtin, claimType, contactEmail)` — creates claim, default type `verified`
- `approveBrandPartnerClaim(id)` — sets `admin_approved = true`
- `rejectBrandPartnerClaim(id)` — deletes the claim
- `listAllBrandPartnerClaims(filters, limit, offset)` — paginated list with filters
- `getBrandPartnerClaims(gtin)` — get claims for a specific GTIN

All service methods handle errors gracefully (return `null`/`false`/empty array on DB errors).

### 10.4 Affiliate Analytics (Implemented)

The `WholesaleMatchingService.getAffiliateAnalytics(tenantId?)` method aggregates click data:

```typescript
{
  total_clicks: number,
  pending: number,
  converted: number,
  expired: number,
  total_commission: number  // sum of commission_amount for converted clicks
}
```

- Handles Prisma `Decimal` commission amounts via `.toNumber()` fallback
- Works with or without `tenantId` (platform-wide when omitted)
- Returns all zeros on error

**Dashboard endpoint**: `GET /api/tenants/:tenantId/wholesale/dashboard` returns both analytics and recent suppliers in a single call.

### 10.5 Affiliate Click Expiry Job (Implemented)

**File**: `apps/api/src/jobs/affiliate-click-expiry.ts`

Daily job that marks `affiliate_clicks` with `status = 'pending'` as `expired` when `expires_at < now()`:

- `processClickExpiry()` — calls `wholesaleMatchingService.expireStaleClicks()`, returns count
- `startAffiliateClickExpiryJob()` — runs immediately on start, then every 24 hours
- `stopAffiliateClickExpiryJob()` — clears the interval
- Error handling: logs error and returns 0 on failure (never crashes)

### 10.6 Revenue Summary

| Stream | Source | Pricing | Scaling |
|---|---|---|---|
| Affiliate commissions | Faire referral links | 5-15% of first order | Per-conversion, scales with merchant activity |
| Premium subscription | "Find My Distributor" tier upgrade | $29-99/month | Recurring, scales with merchant count |
| Brand partner claims | Brands pay for UPC exclusivity | $50-500/month per claim | Recurring, scales with brand count × claims |

---

## 11. Effort Insights

### 11.1 Complexity Assessment

| Component | Complexity | Risk | Est. Effort |
|---|---|---|---|
| Commercial connectors (3) | Medium | API cost overrun, rate limits | 3 days |
| Parallel orchestration | Medium | Payload merge conflicts, timeout handling | 1.5 days |
| Sync job | Low | Token refresh, backfill logic | 1 day |
| Database migrations (3) | Low | Standard DDL + RLS patterns | 1.5 days |
| WholesaleMatchingService | Medium-High | Faire API uncertainty (verify endpoints) | 1.5 days |
| Capability resolver | Medium | 8-phase deployment, frontend parity | 1 day |
| API routes | Low | Standard Express patterns | 1 day |
| EditItemModal decomposition | Medium-High | Regression risk in 1180-line monolith | 3-4 days |
| Frontend spec features | Medium | Shared component design, tier gating | 4-5 days |
| Distributor dashboard | Medium | New page, navigation, settings card | 1.5 days |
| Monetization (brand claims, analytics) | Medium | Admin UI, Stripe integration | 2 days |
| Polish & documentation | Low | Updates, verification | 1.5 days |

### 11.2 Key Risk Areas

1. **Faire API availability** — Endpoints marked "verify" in design doc. Integration requires Faire partner program enrollment. Affiliate tracking degrades gracefully (links work without commission if not enrolled).
2. **EditItemModal regression** — 1180-line monolith split into 10+ files. Mitigated by incremental extraction, `pnpm checkweb` after each step, per-step git commits.
3. **API cost overrun** — Both BarcodeLookup.com and Go-UPC called on every cache miss. Acceptable — cache hit rate >90% after initial population. Rate limiting prevents runaway costs.
4. **Kroger OAuth2 token expiry** — 5-min safety margin on refresh, transparent re-auth on 401.
5. **Affiliate click attribution loss** — Faire webhook may not fire if merchant doesn't complete order. `affiliate_clicks.status` has `expired` state for clicks with no conversion after 30 days.

### 11.3 What's NOT in Scope

- **Direct Faire ordering** — Platform facilitates the click; merchant completes order on Faire's site. No in-platform checkout.
- **Brand self-service payment** — Sprint 5 includes admin-managed claims only. Brand self-service with Stripe comes later.
- **Wizard decomposition** — Wizard is already step-decomposed. Optional polish (extract types/enrichment mapper) is non-blocking.
- **Digital/service product enrichment** — These product types don't have barcodes. GTIN field and `SupplierMatchSection` are hidden for non-physical types.

### 11.4 Sprint Parallelization

```
Sprint 1 (Backend Connectors)     5-6 days
    ↓
Sprint 2 (Wholesale Backend)      4-5 days  ←  Sprint 3 (Decomposition) 3-4 days
    ↓                                ↓
Sprint 4 (Frontend Features)      4-5 days
    ↓
Sprint 5 (Monetization & Polish)  3-4 days
```

**Critical path: 16-20 days** (Sprint 3 parallelized with Sprint 2)

---

## 12. User Guide: End-to-End Flows

### 12.1 Merchant Scans a Product (Barcode Enrichment)

**Via ItemCreationWizard:**
1. Merchant opens Items page → clicks "Add Item" → wizard opens
2. Step 0 (Catalog Search): merchant enters or scans barcode
3. `CatalogSearchStep` calls `SupplierImportService.lookupByBarcode(gtin)` → checks supplier catalog
4. If no catalog match: falls back to `SupplierImportService.enrichBarcode(gtin)` → calls enrichment API
5. Enrichment service checks: in-memory cache → DB cache → supplier catalog → external APIs (parallel) → stub
6. On hit: `handleEnrichmentMatch()` maps `BarcodeEnrichment` → all wizard fields (name, brand, description, images, category)
7. Merchant reviews auto-populated fields across remaining steps
8. On ReviewStep: if GTIN exists and product type is physical, `SupplierMatchSection` renders
9. Merchant publishes product

**Via EditItemModal (post-decomposition):**
1. Merchant opens Items page → clicks "Edit" on existing item (or "Add" for new)
2. `EditItemModal` opens, renders `EditItemForm` with decomposed sub-components
3. Merchant enters GTIN in `ItemBasicFields` barcode field
4. `useItemFormState.lookupBarcode(gtin)` fires → calls `SupplierImportService.enrichBarcode()`
5. On hit: form fields auto-populate (name, brand, description, features, specs, images)
6. "Enriched from {source}" badge appears on barcode field
7. If product type is physical, `SupplierMatchSection` renders below content fields
8. Merchant clicks Save → `handleSave()` includes `gtin` in payload

### 12.2 Merchant Finds a Supplier (Wholesale Matching)

**With existing supplier match:**
1. After enrichment or on item load, `SupplierMatchSection` calls `checkSupplierMatch(gtin)`
2. Service checks `brand_partner_claims` first (exclusive → preferred → verified), then `product_suppliers`
3. If match found: "Order Bulk" button renders with supplier name, MOQ, min order value
4. Merchant clicks "Order Bulk" → `buildAffiliateLink()` creates `affiliate_clicks` record → redirects to supplier's external ordering link
5. Merchant places order on supplier's site (or Faire)
6. If via Faire: Faire webhook fires → `affiliate_clicks.status` updates to `commissioned`

**Without supplier match (upsell):**
1. `checkSupplierMatch(gtin)` returns null
2. `FindSupplierUpsell` renders
3. **Free/Starter tier:** Grayed "Find Supplier" message with upgrade prompt
4. **Growth+ tier:** Interactive "Find Supplier via Faire" button
5. Merchant clicks → `searchSuppliers(query)` calls Faire API
6. Faire search results modal opens: brand stories, wholesale terms, MOQ, ordering links
7. Merchant clicks a result → `trackAffiliateClick()` → redirects to Faire

### 12.3 Merchant Views Distributor Dashboard (Scale+ Tier)

1. Merchant navigates to `/t/[tenantId]/settings/wholesale`
2. `DistributorDashboardClient` loads: product table with supplier match status per GTIN
3. Regional filter dropdown — filter suppliers by geography
4. Affiliate earnings widget — shows total clicks, conversion rate, commission earned
5. "Sourcing Opportunities" section — products with no supplier match, suggested for Faire search
6. Merchant can click "Search Faire" per unmatched product

### 12.4 Brand Claims a Barcode (Admin-Managed)

1. Brand/distributor approaches platform
2. Admin navigates to brand partner management (admin route)
3. Admin creates `brand_partner_claims` record: barcode, partner name, claim type, monthly fee, external link
4. Brand pays monthly subscription via Stripe (admin-managed in Sprint 5)
5. Any merchant scans that barcode → `checkSupplierMatch()` checks `brand_partner_claims` first
6. Exclusive claim: only that partner's link shows. Preferred: shows first, others below.
7. Merchant clicks → goes directly to brand's ordering page (no affiliate code — brand paid for the lead)
8. On subscription expiry: `is_active` set to false, claim stops appearing

### 12.5 Admin Views Affiliate Analytics

1. Admin navigates to `/api/admin/affiliate/analytics` (or admin dashboard page)
2. Views: total clicks, conversion rate, commission revenue, per-tenant breakdown, top-converting barcodes
3. Daily job marks clicks as `expired` after 30 days with no conversion
4. Faire webhook updates clicks to `commissioned` on order confirmation

---

## 13. E2E Batch Test

### Sprint Batch Test File

**File**: `apps/api/src/tests/sprint-e2e-batch.test.ts` (68 tests, all passing)

Comprehensive test covering all sprint-implemented services and endpoints:

| Section | Tests | Coverage |
|---|---|---|
| **WholesaleMatchingService** | 18 | `checkSupplierMatch`, `buildAffiliateLink`, `trackAffiliateClick`, `getBrandPartnerClaims`, `createBrandPartnerClaim`, `approveBrandPartnerClaim`, `rejectBrandPartnerClaim`, `listAllBrandPartnerClaims`, `expireStaleClicks`, `getAffiliateAnalytics`, `getAllSuppliers`, `saveSupplierMatch` |
| **WholesaleMatchingResolver** | 9 | Tier gating: none/search/full, disabled flag, flexible flag, merchant pref override, `can_view_brand_partners` |
| **calculateRenewalCharge** | 8 | `once`/`repeating`/`forever` durations, `renewalCount` boundaries, `amount_off` cap, fallback |
| **validatePromoCode** | 10 | Stripe not configured, invalid/expired/maxed promo codes, `percent_off`/`amount_off` calc, target validation, Stripe API error |
| **Affiliate Click Expiry Job** | 3 | `processClickExpiry` success, empty, error |
| **CouponTargetService integration** | 3 | Target mismatch, target match, no rules pass-through |
| **Claim Type Priority** | 2 | exclusive > preferred > verified sorting, unknown type fallback |
| **Affiliate Link URL Construction** | 2 | URL with/without existing query params, tracking param injection |
| **Affiliate Analytics Aggregation** | 3 | Mixed statuses, Decimal commission, empty, platform-wide |

**Run command** (must run from `apps/api`, not project root — root doesn't have `vitest`/`tsx` installed):
```bash
cd apps/api
doppler run --config local -- npx vitest run src/tests/sprint-e2e-batch.test.ts --reporter=verbose
```

The test uses `vi.hoisted()` for mock functions available in `vi.mock` factories, mocks `prisma`, `logger`, `unifiedConfig`, `CouponTargetService`, `stripe`, `EffectiveCapabilityResolver`, and `SubscriptionBillingService`. All tests are pure unit tests with no DB or Stripe dependencies.

---

## 14. Skills to Read Before Implementation

| Skill | When to Read |
|---|---|
| `api-route-architecture-audit.md` | Before mounting any new routes (orchestrator pattern, ordering rules) |
| `deploy-service-extending-base-singleton.md` | Before creating `WholesaleMatchingService` (frontend singleton) |
| `tenant-scoped-id-generation.md` | Before creating migrations (ID prefixes: `psup-`, `ac-`, `bpc-`) |
| `capability-deployment-flow.md` | Before creating `WholesaleMatchingResolver` (8-phase deployment) |
| `capability-data-flow-rules.md` | Before wiring capability types (naming conventions, frontend parity) |
| `capability-constraint-relationships.md` | Before finalizing feature keys (check for cross-capability deps) |
| `add-capability-feature.md` | Before seeding `features_list` + `capability_features_list` + `tier_features_list` |
| `database-navigation-system.md` | Before creating `/t/[tenantId]/settings/wholesale` page (navigation_links INSERT) |
| `skill-frontend-ux-guardrails.md` | Before creating frontend components (loading/empty/error/disabled states) |
| `saas-navigation.md` | Before adding sidebar link for distributor dashboard |
| `debug-infinite-render-loops.md` | During EditItemModal decomposition (hook extraction risk) |
| `start-of-phase-sprint-checklist.md` | At the start of each sprint (pre-flight checklist) |
| `end-of-phase-sprint-checklist.md` | At the end of each sprint (verification checklist) |

---

## 15. Anti-Patterns to Avoid

1. **Don't add spec features to EditItemModal before decomposing** — The 1180-line monolith will become unmaintainable. Decompose first, then add features to focused components.
2. **Don't call `fetch` directly in frontend components** — Use `WholesaleMatchingService` (extends `TenantApiSingleton`) with `makeDefaultRequest`.
3. **Don't use raw UUIDs for new entities** — Use tenant-scoped ID generators (`psup-`, `ac-`, `bpc-` prefixes).
4. **Don't skip capability deployment phases** — The 8-phase flow ensures backend resolver, frontend mapping, and display are all in sync. Skipping causes tier gating to fail silently.
5. **Don't render GTIN field or `SupplierMatchSection` for digital/service products** — These product types don't have barcodes or physical suppliers.
6. **Don't call commercial APIs sequentially** — Use `Promise.allSettled` for parallel orchestration. Sequential calls double latency on cache miss.
7. **Don't forget RLS** — `product_suppliers` is cross-tenant (global read), `affiliate_clicks` is tenant-scoped. Getting this wrong leaks data across merchants.
8. **Don't skip the Faire webhook signature verification** — Unverified webhooks allow fake order confirmations.
9. **Don't hardcode Faire API endpoints** — Mark as "verify" and make configurable. Faire's API may change.
10. **Don't extract multiple EditItemModal components in one commit** — One per commit, `pnpm checkweb` after each. Regression isolation is critical.
11. **Don't mount routes directly in `index.ts`** — Use the orchestrator pattern. Tenant routes go in `tenant.routes.ts`, admin routes in `admin.routes.ts`, webhooks in `routeRegistry.ts` with `preMiddleware: true`. Direct `app.use()` in `index.ts` bypasses the ordering guarantees of the orchestrators.
12. **Don't mount tenant sub-resource routers after `tenantsRoutes`** — `tenantsRoutes` has `/:id` catch-all patterns that will intercept sub-resource paths like `/:tenantId/wholesale`. Always mount sub-resource routers BEFORE `tenantsRoutes` in `tenant.routes.ts`.
13. **Don't mount admin routes after generic root mounts** — Generic root-mounted routers (`tenantFlagsRoutes`, `platformFlagsRoutes`, etc.) in `admin.routes.ts` can intercept paths meant for specific sub-path routers. Always mount specific sub-paths first.
14. **Don't forget `preMiddleware: true` for webhooks** — Faire webhook needs raw body for signature verification, same as Stripe webhooks. Without `preMiddleware: true`, JSON parsing middleware consumes the body before signature verification can run.
