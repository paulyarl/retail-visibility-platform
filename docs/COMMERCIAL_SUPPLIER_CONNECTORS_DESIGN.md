# Barcode-Driven Product Onboarding & B2B Wholesale Matching

**Status:** Design / Evaluation Complete  
**Date:** 2026-07-11  
**Goal:** Augment the product wizard's barcode lookup with commercial API suppliers (BarcodeLookup.com, Go-UPC, Kroger) and add a premium B2B wholesale matching layer via Faire marketplace integration.

---

## 1. Executive Summary

The system serves two primary functions:

- **Data Enrichment (Utility):** Merchants scan a UPC/EAN barcode to instantly populate their storefront catalog, eliminating manual data entry.
- **Wholesale Matching (Premium Marketplace):** Leverages product metadata to identify suppliers and facilitate B2B commercial relationships.

### 1.1 Core Architectural Principle: Shared Cache

**Scan Once, Benefit All:** The system checks a local unified cache database first. If a barcode has been scanned previously by any merchant, the product data loads instantly. External API calls execute only on cache misses, minimizing API consumption costs and latency.

This principle is already implemented via the `barcode_enrichment` table (cross-tenant shared cache) and `BarcodeEnrichmentService` 3-tier cache hierarchy.

### 1.2 Enrichment Fallback Chain (BarcodeEnrichmentService)

```
Barcode Scan
  │
  ▼
1. In-memory cache (Map, 24h TTL, 10k LRU)
  │ miss
  ▼
2. Database cache (barcode_enrichment table, cross-tenant)
  │ miss
  ▼
3. Supplier catalog (supplier_catalog_item table, cross-tenant)
  │ miss
  ▼
4. External API providers (parallel for commercial, sequential fallback for open-source)
  │   a. BarcodeLookup.com + Go-UPC (parallel, Promise.allSettled)
  │   b. Kroger (sequential, if both commercial fail)
  │   c. UPC Database API (sequential)
  │   d. Open Food Facts API (sequential)
  │ all fail
  ▼
5. Stub fallback (minimal data, merchant edits manually)
   + Log barcode to barcode_lookup_log for async analysis
```

**Key principle:** Each layer caches to the layer above. A barcode scanned once by any tenant is served from cache for all subsequent scans — cross-tenant.

### 1.3 Parallel API Orchestration (Enhancement)

The current `BarcodeEnrichmentService.enrich()` uses a **sequential fallback chain**. The new spec requires **parallel orchestration** for commercial providers on cache misses.

**Proposed change:** On a cache miss, fire BarcodeLookup.com and Go-UPC simultaneously via `Promise.allSettled()`. Merge results, preferring the richer payload. Kroger, UPC Database, and Open Food Facts remain as sequential fallbacks.

```
Cache Miss
  │
  ▼
Promise.allSettled([
  enrichFromBarcodeLookup(barcode),   // 5s timeout
  enrichFromGoUpc(barcode),           // 5s timeout
])
  │
  ├── Any success → merge payloads, commit to cache, return
  ├── All fail/timeout → try Kroger (if configured)
  │     ├── Success → commit, return
  │     └── Fail → try UPC Database → Open Food Facts → stub
  │
  └── Max latency: ~5s (parallel) + sequential fallbacks
      Typical: ~2-3s (commercial APIs respond in 1-2s, parallel)
```

**Payload merge strategy** (both BarcodeLookup.com and Go-UPC return data):
- `name`: Prefer BarcodeLookup.com (generally more complete)
- `brand`: Prefer whichever is non-empty
- `description`: Prefer longer description
- `imageUrl`: Prefer BarcodeLookup.com (higher resolution)
- `categoryPath`: Merge unique entries from both
- `priceCents`: Prefer BarcodeLookup.com (has store pricing; Go-UPC has none)
- `metadata`: Deep merge — `attrs` from both preserved under `attrs.barcodelookup` and `attrs.goupc` keys

### 1.4 Graceful Failure (FR-1.1)

If all external APIs fail or return 404:
1. Open a blank, manual product entry form for the merchant
2. Log the barcode to `barcode_lookup_log` with `status: 'error'` for async administrative analysis
3. Existing `createFallbackData()` produces minimal stub data as final fallback

### 1.5 Supplier Connector Interface

```typescript
// apps/api/src/services/SupplierConnectors.ts:15-19
export interface SupplierConnector {
  supplierId: string;
  fetchByBarcode(gtin: string): Promise<BatchIngestRow | null>;
  searchByText(query: string, page?: number): Promise<BatchIngestRow[]>;
}
```

### 1.6 BatchIngestRow Target Schema

```typescript
// apps/api/src/services/SupplierCatalogService.ts:51-61
export interface BatchIngestRow {
  supplier_sku: string;       // Required — unique per supplier
  gtin?: string | null;       // Barcode (UPC/EAN/ISBN)
  name: string;               // Required — product name
  brand?: string | null;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  msrp_cents?: number | null;
  attrs?: any;                // Provider-specific metadata
}
```

### 1.7 Existing Connectors

| Connector | supplierId | Auth | Scope | Scheduled Sync |
|---|---|---|---|---|
| `OpenFoodFactsConnector` | `supplier-off-open-food-facts` | None (public API) | Food products | Hourly incremental + nightly backfill |
| `OpenBeautyFactsConnector` | `supplier-off-open-beauty-facts` | None (public API) | Beauty products | Hourly incremental + nightly backfill |
| `UPCDatabaseConnector` | `supplier-off-upc-database` | API key (Bearer) | All products | On-demand only (barcode lookup) |

### 1.8 Related Services

- **`BarcodeEnrichmentService`** (`apps/api/src/services/BarcodeEnrichmentService.ts`) — Main enrichment orchestrator with 3-tier cache, rate limiting (500 req/hr per provider), Prometheus metrics, and lookup logging.
- **`SupplierCatalogService`** (`apps/api/src/services/SupplierCatalogService.ts`) — Batch ingest with dedup by `(supplier_id, supplier_sku)`, quarantine for invalid rows, catalog search/lookup by GTIN.
- **`SupplierService`** (`apps/api/src/services/SupplierService.ts`) — CRUD for supplier records, health dashboard with GTIN coverage %, success rate, freshness lag, quarantine counts.
- **`supplier-opensource-sync.ts`** (`apps/api/src/jobs/supplier-opensource-sync.ts`) — Scheduled sync job for open-source connectors. Pattern: `ensureSupplierExists()` → `runIncrementalSync()` (hourly) + `runFullBackfill()` (nightly).
- **`scan.ts`** (`apps/api/src/routes/scan.ts`) — Scan session routes: `/scan/start`, `/scan/:sessionId/lookup-barcode` (calls `enrichWithCategorySuggestion`), `/scan/:sessionId/commit` (creates `inventory_items` from enrichment data + photo assets).
- **`EffectiveCapabilityResolver`** (`apps/api/src/services/EffectiveCapabilityResolver.ts`) — Tier-capability resolver. Barcode scan capability already registered via `BarcodeScanResolver`. New `wholesale_matching` capability needed for premium Faire features.

---

## 2. Data Schema & Architecture

The spec defines three core tables. Two map to existing platform tables; one is new.

### 2.1 product_registry → `barcode_enrichment` (EXISTING — Shared Cache)

The spec's `product_registry` is already implemented as the `barcode_enrichment` table — stores the definitive global product catalog fetched from external APIs, shared cross-tenant.

**Existing schema** (`apps/api/prisma/schema.prisma:156-172`):

| Field | Type | Spec Equivalent | Notes |
|---|---|---|---|
| `id` | `String` | `id` (UUID) | PK |
| `barcode` | `String` | `barcode` (VARCHAR 14) | Unique, indexed |
| `name` | `String?` | `product_name` | |
| `brand` | `String?` | `brand` | |
| `description` | `String?` | `description` | |
| `category_path` | `String[]` | `category` | Enriched to path array |
| `price_cents` | `Int?` | (spec has no price) | Platform is richer |
| `image_url` | `String?` | `image_urls[0]` | First image |
| `image_thumbnail_url` | `String?` | (spec has no thumbnail) | Bonus |
| `metadata` | `Json?` | (spec has no metadata) | Stores full attrs, specs, ingredients |
| `source` | `String` | (spec has no source) | Tracks which API populated this |
| `last_fetched_at` | `DateTime` | `updated_at` | |
| `fetch_count` | `Int` | (spec has no count) | Cache hit counter |
| `created_at` | `DateTime` | `created_at` | |
| `updated_at` | `DateTime` | `updated_at` | |

**Alignment:** No schema changes needed. `barcode_enrichment` is a superset of the spec's `product_registry`.

### 2.2 merchant_products → `inventory_items` (EXISTING — Merchant Instance)

The spec's `merchant_products` is already implemented as the `inventory_items` table — links a cached global product to a specific merchant's storefront with custom pricing and stock.

**Key fields** (`apps/api/prisma/schema.prisma:2108-2219`):

| Field | Type | Spec Equivalent | Notes |
|---|---|---|---|
| `id` | `String` | `id` | PK |
| `tenant_id` | `String` | `merchant_id` | FK → `tenants.id` |
| `sku` | `String` | (spec has no SKU) | Platform-generated, unique per tenant |
| `gtin` | `String?` | (links to `barcode_enrichment.barcode`) | Barcode stored on item |
| `name` / `title` | `String` | (from enrichment) | Populated from `barcode_enrichment` on scan |
| `brand` | `String` | (from enrichment) | |
| `description` | `String?` | (from enrichment) | |
| `price_cents` | `Int` | `custom_price` | Merchant's specific retail price |
| `stock` | `Int` | `stock_count` | Default 0 |
| `image_url` | `String?` | (from enrichment) | |
| `image_gallery` | `String[]` | (from enrichment) | Multiple images |
| `item_status` | `item_status` | `is_active` | `active`/`trashed` (soft delete) |
| `visibility` | `item_visibility` | (spec has no visibility) | `public`/`private` |
| `enrichment_status` | `enrichment_status` | (spec has no enrichment status) | `COMPLETE`/`PENDING` |
| `enriched_from_barcode` | `String?` | (spec has no barcode ref) | Links back to scanned barcode |
| `supplier_catalog_item_id` | `String?` | (spec has no supplier link) | FK → `supplier_catalog_item` |
| `metadata` | `Json?` | (spec has no metadata) | Stores enrichment source, scan session info |

**Alignment:** No schema changes needed. `inventory_items` is a superset of the spec's `merchant_products`. The `gtin` field provides the link to `barcode_enrichment.barcode`. The `supplier_catalog_item_id` field already links to supplier catalog data.

**Data isolation:** RLS policies on `inventory_items` enforce tenant isolation — merchants cannot access or modify each other's custom pricing, stock, or proprietary data.

### 2.3 product_suppliers (NEW — Wholesale Fulfillment Node)

This is a **new table** with no existing equivalent. It maps wholesale entities capable of supplying a specific product barcode, enabling B2B wholesale matching.

**Proposed Prisma model:**

```prisma
model product_suppliers {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  product_id      String   // FK → barcode_enrichment.id (NOT inventory_items — this is cross-tenant)
  supplier_name   String   @db.VarChar(255)
  supplier_source String   @db.VarChar(50)  // 'faire_api' | 'direct_partner' | 'kroger_wholesale' | 'manual'
  external_link   String?  @db.Text          // Affiliate deep link or wholesale checkout URL
  wholesale_sku   String?  @db.VarChar(100)  // Supplier's internal product identifier
  min_order_value Decimal? @db.Decimal(10, 2) // Minimum order value for this supplier
  brand_story     String?  @db.Text           // Faire brand story text
  wholesale_terms Json?                       // Faire wholesale config (MOQ, pricing tiers, etc.)
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  @@index([product_id], map: "idx_product_suppliers_product")
  @@index([supplier_source], map: "idx_product_suppliers_source")
  @@index([is_active], map: "idx_product_suppliers_active")
}
```

**Key design decisions:**
- `product_id` references `barcode_enrichment.id` (the shared cache), NOT `inventory_items.id` — supplier relationships are global, not per-merchant
- `supplier_source` distinguishes between Faire API results, direct partner integrations, and manual entries
- `external_link` stores the affiliate deep link with tracking parameters for platform revenue capture
- `wholesale_terms` stores Faire-specific data: MOQ, pricing tiers, payment terms, shipping estimates
- `is_active` allows deactivating stale supplier relationships without deleting history

**Migration:** `database/migrations/093_product_suppliers.sql`

---

## 3. Commercial API Assessment

### 3.1 BarcodeLookup.com

| Attribute | Value |
|---|---|
| **Base URL** | `https://api.barcodelookup.com/v3` |
| **Auth** | API key via `key` query parameter |
| **Env vars** | `BARCODELOOKUP_API_KEY` |
| **Scope** | All industries — 1B+ items |
| **Barcode lookup** | `GET /products?barcode={gtin}&formatted=y&key={key}` |
| **Text search** | `GET /products?search={term}&key={key}` (also brand, category, MPN, ASIN) |
| **Pagination** | `page` param (10 results/page) |
| **Rate limit** | Per plan tier (varies) |
| **Pricing** | Paid tiers (per-call) |

**Response fields → BatchIngestRow mapping:**

| API Field | BatchIngestRow Field | Notes |
|---|---|---|
| `barcode` | `gtin` | UPC/EAN/ISBN |
| `title` | `name` | |
| `brand` | `brand` | |
| `description` | `description` | |
| `category` | `category` | Google product taxonomy |
| `images[0]` | `image_url` | First image from array |
| `stores[].price` | `msrp_cents` | Lowest store price × 100 |
| `mpn` | `supplier_sku` | Fallback: barcode if no MPN |
| All remaining fields | `attrs` | See below |

**`attrs` payload:**
```json
{
  "mpn": "LX-F942607",
  "model": "6500",
  "asin": "B01EI7RUPI",
  "manufacturer": "Ford Motor Company",
  "color": "Yellow",
  "size": "Medium",
  "weight": "1.29 lbs",
  "dimensions": { "length": "2.6 in", "width": "7.4 in", "height": "3.5 in" },
  "ingredients": "Tomatoes, Onions, Celery",
  "nutrition_facts": "Calories 75, Protein 6g",
  "features": ["Sturdy", "Real Wood", "2 Year Warranty"],
  "stores": [{ "name": "Walmart", "price": "$12.99", "url": "..." }],
  "barcode_formats": "UPC-A 736211911186, EAN-13 0736211911186"
}
```

**Verdict:** Excellent fit. Richest data of the three — store pricing, features, ingredients, dimensions. Supports both `fetchByBarcode` and `searchByText`. Simple API key auth.

### 3.2 Go-UPC

| Attribute | Value |
|---|---|
| **Base URL** | `https://go-upc.com/api/v1` |
| **Auth** | API key via `key` query parameter |
| **Env vars** | `GOUPC_API_KEY` |
| **Scope** | All industries — 1B+ items |
| **Barcode lookup** | `GET /code/{code}?key={key}&format=true` |
| **Text search** | Not available (barcode-only API) |
| **Rate limit** | Per plan tier (varies) |
| **Pricing** | Paid tiers (per-call) |

**Response fields → BatchIngestRow mapping:**

| API Field | BatchIngestRow Field | Notes |
|---|---|---|
| `product.upc` / `product.ean` | `gtin` | Both returned |
| `product.name` | `name` | |
| `product.brand` | `brand` | |
| `product.description` | `description` | Full product description |
| `product.category` | `category` | Leaf category |
| `product.imageUrl` | `image_url` | S3-hosted |
| (none) | `msrp_cents` | Not provided — `null` |
| `code` | `supplier_sku` | The barcode itself |
| `product.specs`, `product.ingredients`, `product.categoryPath` | `attrs` | See below |

**`attrs` payload:**
```json
{
  "codeType": "UPC",
  "categoryPath": ["Food, Beverages & Tobacco", "Food Items", "Dips & Spreads"],
  "specs": [["Organic", "No"], ["Non-GMO", "No"], ["Height", "4.88 In"], ["Width", "4.0 In"]],
  "ingredients": { "text": "Water, Monterey Jack Cheese..." },
  "barcodeUrl": "https://go-upc.com/barcode/781138811156",
  "inferred": false
}
```

**Verdict:** Excellent fit for barcode lookup. Clean single-endpoint API, rich specs/ingredients data. Does NOT support `searchByText` — `searchByText` returns empty array (barcode-only API). Best paired with BarcodeLookup.com which covers text search.

### 3.3 Kroger Developer API

| Attribute | Value |
|---|---|
| **Base URL** | `https://api.kroger.com/v1` |
| **Auth** | OAuth2 client credentials flow |
| **Env vars** | `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET` |
| **Scope** | Grocery/CPG only — Kroger catalog |
| **Barcode lookup** | `GET /products/{upc}?filter.locationId={loc}` |
| **Text search** | `GET /products?filter.term={query}&filter.locationId={loc}` |
| **Pagination** | `filter.start`, `filter.limit` |
| **Rate limit** | 10,000 calls/day |
| **Pricing** | Free (OAuth2 required) |

**Response fields → BatchIngestRow mapping:**

| API Field | BatchIngestRow Field | Notes |
|---|---|---|
| `upc` | `gtin` | |
| `description` | `name` | Kroger uses "description" as product name |
| `brand` | `brand` | |
| (none) | `description` | Not separately provided |
| `categories[].name` | `category` | First category |
| `images[].size.large` | `image_url` | First large image |
| `items[].price.price` | `msrp_cents` | Requires `filter.locationId` |
| `productId` | `supplier_sku` | Kroger product ID |
| `fulfillmentTypes`, `aisleLocation`, `temperature` | `attrs` | See below |

**`attrs` payload:**
```json
{
  "productId": "0001111041700",
  "fulfillmentTypes": ["ais", "csp", "dth", "sth"],
  "aisleLocation": { "bay": "A12", "shelf": "3" },
  "temperature": "Ambient",
  "categories": [{ "name": "Dairy" }, { "name": "Milk" }],
  "locationId": "01400347",
  "priceRequiresLocation": true
}
```

**Verdict:** Good fit for grocery merchants. Narrower scope (Kroger catalog only). OAuth2 token management adds complexity vs simple API key. Price data requires a store `locationId`. Worth adding as an optional connector for grocery-specific enrichment.

---

## 4. Connector Priority in Enrichment Chain

Commercial APIs should be tried **before** open-source APIs in the fallback chain — they have larger databases and broader industry coverage, so a hit on a commercial API is more likely and provides richer data.

**Proposed order within step 4 of the enrichment chain:**

```
4a. BarcodeLookup.com + Go-UPC  (parallel, Promise.allSettled — broadest, richest data)
4b. Kroger                      (sequential fallback — grocery-only, OAuth2, free)
4c. UPC Database                (existing — open-source)
4d. Open Food Facts             (existing — open-source, food-only)
```

Each provider is rate-limited independently (500 req/hr default, configurable per provider).

---

## 5. B2B Wholesale Matching (Premium Feature)

### 5.1 Faire Marketplace Integration

Faire is a wholesale marketplace connecting independent brands with retailers. The platform integrates with Faire's API to provide supplier matching for products in a merchant's catalog.

**Faire API overview:**

| Attribute | Value |
|---|---|
| **Base URL** | `https://api.faire.com/v1` (verify with Faire developer docs) |
| **Auth** | OAuth2 or API key (verify with Faire developer docs) |
| **Env vars** | `FAIRE_API_KEY` (or `FAIRE_CLIENT_ID` / `FAIRE_CLIENT_SECRET` for OAuth2) |
| **Scope** | Wholesale marketplace — independent brands and retailers |
| **Product search** | `GET /products?search={brand_or_name}` — search by brand or product name |
| **Brand search** | `GET /brands?search={term}` — search for brand stories, wholesale terms |
| **Rate limit** | Per Faire agreement (verify) |
| **Pricing** | Per Faire agreement (verify) |

**Note:** Faire's public API documentation should be consulted to confirm exact endpoints, auth flow, and rate limits. The integration design below assumes a REST API with search capabilities by brand and product name.

### 5.2 WholesaleMatchingService

New service: `apps/api/src/services/WholesaleMatchingService.ts`

```typescript
class WholesaleMatchingService {
  // Check if any suppliers exist for a product (product_suppliers table)
  async checkSupplierMatch(barcode: string): Promise<ProductSupplier[] | null>;

  // Search Faire API by brand or product name (premium only)
  async searchFaireSuppliers(
    tenantId: string,
    productName: string,
    brand?: string
  ): Promise<FaireSearchResult[]>;

  // Persist a Faire supplier match to product_suppliers table
  async saveSupplierMatch(
    productId: string,
    supplier: FaireSearchResult
  ): Promise<ProductSupplier>;

  // Generate affiliate deep link with tracking parameters
  private buildAffiliateLink(
    faireProductUrl: string,
    tenantId: string
  ): string;
}
```

### 5.3 Capability Registration (Tier Gating)

The wholesale matching feature is gated by a new capability type in the existing tier-capability resolver system.

**New capability type:** `wholesale_matching_options`

**Feature keys:**

| Feature Key | Description | Tier Assignment |
|---|---|---|
| `wholesale_matching_enabled` | Master switch for wholesale matching | Growth+ |
| `wholesale_matching_faire` | Faire marketplace search | Growth+ |
| `wholesale_matching_direct` | Direct partner matching | Scale+ |
| `wholesale_matching_flexible` | Flexible — all sub-features enabled | Enterprise |

**Resolver:** New `WholesaleMatchingResolver.ts` following the existing `BarcodeScanResolver.ts` pattern:

```typescript
// apps/api/src/services/resolvers/WholesaleMatchingResolver.ts
export function resolveWholesaleMatching(
  features: Record<string, boolean>,
  merchantPrefs: WholesaleMatchingMerchantSettings | null
): EffectiveWholesaleMatching {
  const disabled = !!features.wholesale_matching_disabled;
  const flexible = !!features.wholesale_matching_flexible;
  const enabled = !disabled && (!!features.wholesale_matching_enabled || flexible);

  const allowedSources: string[] = [];
  if (flexible || features.wholesale_matching_faire) allowedSources.push('faire');
  if (flexible || features.wholesale_matching_direct) allowedSources.push('direct');

  return {
    enabled,
    is_flexible: flexible,
    allowed_sources: allowedSources,
    effective_sources: allowedSources, // No merchant prefs to filter yet
    merchant_preferences: {},
  };
}
```

**Wiring:** Add to `EffectiveCapabilityResolver.ts` pipeline as `effective[18]` (after `directory_promotion` at `effective[17]`).

### 5.4 New API Routes

| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/api/tenants/:tenantId/wholesale/check` | GET | Check supplier match for a product barcode (FR-2.0) | Tenant + capability |
| `/api/tenants/:tenantId/wholesale/search` | POST | Search Faire marketplace by brand/product name (FR-2.2) | Tenant + premium capability |
| `/api/tenants/:tenantId/wholesale/suppliers` | GET | List all supplier matches for tenant's products | Tenant |
| `/api/admin/wholesale/suppliers` | GET | Admin: list all product_suppliers records | Platform admin |

**Route file:** `apps/api/src/routes/wholesale-matching.ts`

**Request/response shapes:**

```typescript
// GET /api/tenants/:tenantId/wholesale/check?barcode={gtin}
// Response (FR-2.0 — Supplier Association Verification)
{
  "success": true,
  "hasMatch": true,
  "suppliers": [
    {
      "id": "uuid",
      "supplier_name": "Annie's Homegrown",
      "supplier_source": "faire_api",
      "external_link": "https://faire.com/...?ref=visibleShelf&tenant=...",
      "wholesale_sku": "ANN-ORG-001",
      "min_order_value": 250.00,
      "brand_story": "Annie's has been committed to organic...",
      "wholesale_terms": { "moq": 12, "pricing_tiers": [...] }
    }
  ]
}

// POST /api/tenants/:tenantId/wholesale/search
// Request body: { "productName": "Annie's Organic Mac & Cheese", "brand": "Annie's" }
// Response (FR-2.2 — Faire search results)
{
  "success": true,
  "results": [
    {
      "brandName": "Annie's Homegrown",
      "brandStory": "Founded in 1989...",
      "productName": "Organic Mac & Cheese",
      "wholesalePrice": "$3.25/unit",
      "moq": 12,
      "minOrderValue": 250.00,
      "productUrl": "https://faire.com/...",
      "orderUrl": "https://faire.com/order/..."
    }
  ]
}
```

## 6. Supplier IDs and Database Records

New suppliers follow the existing `supplier-off-*` naming convention:

| Supplier ID | Name | Connection Type | Built-in | Active |
|---|---|---|---|---|
| `supplier-comm-barcodelookup` | BarcodeLookup.com | `api` | `true` | `true` if API key set |
| `supplier-comm-goupc` | Go-UPC | `api` | `true` | `true` if API key set |
| `supplier-comm-kroger` | Kroger | `api` | `true` | `true` if OAuth creds set |

Suppliers are seeded via `ensureSupplierExists()` in the sync job (same pattern as `supplier-opensource-sync.ts`). The `active` flag is toggled based on whether env vars are configured — inactive suppliers are skipped in the enrichment chain.

---

## 7. Sync Job Integration

### 7.1 Commercial Supplier Sync Job

New file: `apps/api/src/jobs/supplier-commercial-sync.ts`

Follows the same pattern as `supplier-opensource-sync.ts`:

- **BarcodeLookup.com:** Nightly backfill via `searchByText` with popular category terms. No incremental sync (API is barcode-lookup oriented, not update-stream oriented).
- **Go-UPC:** No scheduled sync (barcode-only API, no text search for backfill). Used for on-demand barcode lookup only.
- **Kroger:** Nightly backfill via `searchByText` with grocery category terms. Requires OAuth2 token refresh (30-min token lifetime).

**Job schedule:**
- Nightly backfill: 24h interval, 40-min startup delay (after open-source nightly)
- No hourly incremental (commercial APIs are per-call priced)
- Disabled via `DISABLE_SUPPLIER_COMMERCIAL_SYNC` env var

**Wiring:** Add `startSupplierCommercialSync()` call in `apps/api/src/index.ts` alongside existing `startSupplierOpenSourceSync()`.

### 7.2 Token Management (Kroger only)

Kroger uses OAuth2 client credentials flow:
1. POST `https://api.kroger.com/v1/connect/oauth2/token` with `grant_type=client_credentials`, `scope=product.compact`
2. Response: `{ access_token, token_type, expires_in }` (expires_in ~1800s / 30 min)
3. Token cached in-memory with 5-min safety margin before expiry
4. Refreshed transparently on next API call if expired

---

## 8. Caching Alignment

### 8.1 Enrichment Cache (existing)

All three new connectors feed into the same cache layers:

1. **In-memory cache** — `enrichmentCache` Map, 24h TTL, 10k LRU. No changes needed.
2. **Database cache** — `barcode_enrichment` table. No schema changes — `source` field extended with new values: `barcodelookup`, `goupc`, `kroger`.
3. **Supplier catalog** — `supplier_catalog_item` table. Populated by sync job backfill. Queried before external API calls.

### 8.2 Source Field Extension

The `EnrichmentResult.source` union type extends:

```typescript
// Before
source: 'cache' | 'upc_database' | 'open_food_facts' | 'stub' | 'fallback' | 'supplier_catalog';

// After
source: 'cache' | 'upc_database' | 'open_food_facts' | 'stub' | 'fallback' | 'supplier_catalog'
      | 'barcodelookup' | 'goupc' | 'kroger';
```

### 8.3 Metrics

Existing Prometheus metrics automatically pick up new providers via labels:

- `enrichment_api_success_total{tenant, provider}` — new provider labels: `barcodelookup`, `goupc`, `kroger`
- `enrichment_api_fail_total{tenant, provider}` — same
- `enrichment_cache_hit_total{tenant}` — unchanged (cache hits are source-agnostic)
- `enrichment_cache_miss_total{tenant}` — unchanged
- `enrichment_duration_ms{tenant, source}` — new source labels
- `enrichment_fallback_total{tenant}` — unchanged

Rate limit state tracked per provider in `rateLimitState` Map — new keys: `barcodelookup`, `goupc`, `kroger`.

---

## 9. API Routes

### 9.1 Existing Routes (no changes)

| Route | Purpose |
|---|---|
| `POST /api/barcode-enrichment-singleton/enrich` | Single barcode enrichment (tenant-scoped) |
| `POST /api/barcode-enrichment-singleton/batch` | Batch enrichment (max 100 barcodes) |
| `GET /api/barcode-enrichment-singleton/stats` | Enrichment statistics |
| `GET /api/barcode-enrichment-singleton/health` | Service health |
| `DELETE /api/barcode-enrichment-singleton/cache` | Clear cache (admin only) |
| `GET /api/barcode-enrichment-singleton/providers` | List supported providers |
| `GET /api/admin/enrichment/analytics` | Admin analytics dashboard |
| `GET /api/admin/enrichment/search` | Search enriched products |
| `GET /api/admin/enrichment/:barcode` | Product detail by barcode |

### 9.2 Providers Endpoint Update

`GET /api/barcode-enrichment-singleton/providers` should be updated to include the three new providers:

```json
[
  {
    "name": "barcodelookup",
    "displayName": "BarcodeLookup.com",
    "description": "Commercial barcode database with 1B+ items, store pricing, and rich product attributes",
    "rateLimit": "Per plan tier",
    "features": ["product_info", "images", "pricing", "categories", "ingredients", "dimensions", "stores"]
  },
  {
    "name": "goupc",
    "displayName": "Go-UPC",
    "description": "Commercial barcode database with 1B+ items, specs, and ingredients",
    "rateLimit": "Per plan tier",
    "features": ["product_info", "images", "specs", "ingredients", "categories"]
  },
  {
    "name": "kroger",
    "displayName": "Kroger",
    "description": "Kroger grocery product catalog with pricing and fulfillment info",
    "rateLimit": "10,000 calls/day",
    "features": ["product_info", "images", "pricing", "categories", "fulfillment", "aisle_location"]
  }
]
```

### 9.3 Admin Supplier Health Dashboard

The existing `SupplierService.getHealthDashboard()` automatically includes new suppliers once their `supplier` records exist in the database. Metrics displayed:

- Total catalog items per supplier
- GTIN coverage %
- Success rate % (catalog items vs quarantined)
- Freshness lag (hours since last update)
- Freshness alert (if lag > 24h)
- Quarantined items count

---

## 10. Environment Variables

```env
# BarcodeLookup.com
BARCODELOOKUP_API_KEY=your_api_key_here

# Go-UPC
GOUPC_API_KEY=your_api_key_here

# Kroger (OAuth2 client credentials)
KROGER_CLIENT_ID=your_client_id_here
KROGER_CLIENT_SECRET=your_client_secret_here

# Faire Marketplace (wholesale matching — premium feature)
FAIRE_API_KEY=your_faire_api_key_here

# Optional: Disable commercial supplier sync job
DISABLE_SUPPLIER_COMMERCIAL_SYNC=false

# Optional: Per-provider rate limit override (defaults to 500/hr)
BARCODELOOKUP_RATE_LIMIT_PER_HOUR=500
GOUPC_RATE_LIMIT_PER_HOUR=500
KROGER_RATE_LIMIT_PER_HOUR=500
```

Add to `apps/api/.env.example` with commented-out defaults.

---

## 11. Premium Monetization Strategies

The wholesale matching layer introduces three revenue streams that build on the enrichment cache and supplier matching infrastructure.

### 11.1 Affiliate / Referral Commissions (The Faire Path)

**Mechanism:** When a merchant views a scanned product and clicks "Source via Faire," the platform earns a commission on their first wholesale order or a bounty for bringing a new retail buyer to Faire.

**Implementation:**

The `WholesaleMatchingService.buildAffiliateLink()` method appends tracking parameters to every Faire outbound link:

```typescript
private buildAffiliateLink(faireProductUrl: string, tenantId: string): string {
  const params = new URLSearchParams({
    ref: 'visibleShelf',           // Platform identifier for Faire partner program
    tenant: tenantId,               // Track which merchant initiated the order
    click_id: generateAffiliateClickId(tenantId),  // Unique click ID for attribution
    source: 'barcode_scan',         // Entry point (barcode scan vs. catalog browse)
  });
  return `${faireProductUrl}?${params.toString()}`;
}
```

**Affiliate click tracking table (NEW):**

```prisma
model affiliate_clicks {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  barcode         String   @db.VarChar(14)
  supplier_id     String   // FK → product_suppliers.id
  click_id        String   @unique @db.VarChar(100)  // Unique attribution ID
  destination_url String   @db.Text
  status          String   @default('clicked')  // 'clicked' | 'ordered' | 'commissioned' | 'expired'
  commission_cents Int?    // Commission amount (set on webhook callback)
  order_id        String?  @db.VarChar(100)      // Faire order ID (set on webhook callback)
  clicked_at      DateTime @default(now()) @db.Timestamptz(6)
  converted_at    DateTime? @db.Timestamptz(6)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id], map: "idx_affiliate_clicks_tenant")
  @@index([click_id], map: "idx_affiliate_clicks_click_id")
  @@index([status], map: "idx_affiliate_clicks_status")
  @@index([clicked_at], map: "idx_affiliate_clicks_date")
}
```

**Webhook:** `POST /api/webhooks/faire` — receives order confirmation callbacks from Faire, matches `click_id` to `affiliate_clicks` record, updates `status` to `ordered`, records `commission_cents` and `order_id`.

**Admin dashboard:** `GET /api/admin/affiliate/analytics` — shows total clicks, conversion rate, commission revenue, per-tenant breakdown, top-converting barcodes.

**Revenue flow:**
```
Merchant scans barcode → Enrichment populates product data
  → Merchant views product in dashboard
  → WholesaleMatchingService.checkSupplierMatch(barcode)
  → If match: "Order Bulk" button with affiliate link
  → Merchant clicks → affiliate_clicks record created
  → Merchant places Faire order → Faire webhook fires
  → affiliate_clicks.status = 'commissioned'
  → Platform earns commission (typically 5-15% of first order, or fixed bounty)
```

### 11.2 "Find My Distributor" Premium Tier

**Mechanism:** Standard users get product name and image to populate their store. Premium users get an automated dashboard showing which regional distributors supply that exact EAN/UPC barcode.

**Tier gating (via existing capability system):**

| Tier | Barcode Enrichment | Supplier Match (View) | Faire Search (Action) | Distributor Dashboard |
|---|---|---|---|---|
| Trial | ✅ Basic | ❌ | ❌ | ❌ |
| Starter | ✅ Basic | ❌ | ❌ | ❌ |
| Growth | ✅ Full | ✅ View matches | ✅ Search Faire | ❌ |
| Scale | ✅ Full | ✅ View matches | ✅ Search Faire | ✅ Full dashboard |
| Enterprise | ✅ Full + Flexible | ✅ All sources | ✅ All sources | ✅ + API access |

**Capability feature keys (extends §5.3):**

| Feature Key | Description | Tier |
|---|---|---|
| `wholesale_matching_enabled` | Master switch | Growth+ |
| `wholesale_matching_faire` | Faire marketplace search | Growth+ |
| `wholesale_matching_direct` | Direct partner matching | Scale+ |
| `wholesale_matching_dashboard` | Distributor dashboard with regional data | Scale+ |
| `wholesale_matching_flexible` | All sub-features + API access | Enterprise |

**Distributor dashboard route:** `GET /api/tenants/:tenantId/wholesale/dashboard`

Returns:
- List of all tenant's products with supplier match status (matched / unmatched)
- Regional distributor breakdown (filter by geography)
- Wholesale price comparison across suppliers
- MOQ and minimum order value summary
- Recent affiliate click history and commission earnings
- "Sourcing opportunities" — products in tenant's catalog with no supplier match, suggested for Faire search

**Frontend page:** `/t/[tenantId]/settings/wholesale` — DistributorDashboardClient.tsx with:
- Product table with supplier match badges
- Regional filter dropdown
- Price comparison cards
- Affiliate earnings widget
- "Search Faire" action button per unmatched product

### 11.3 Wholesale Lead Generation for Brands

**Mechanism:** Brands and distributors pay a fee to pin themselves as the "Official Fulfillment Partner" for specific UPCs. When any merchant scans that barcode, the pinned distributor gets the exclusive ordering lead.

**Implementation:**

New table — `brand_partner_claims`:

```prisma
model brand_partner_claims {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  partner_name    String   @db.VarChar(255)    // Brand or distributor name
  partner_type    String   @db.VarChar(50)     // 'brand' | 'distributor' | 'manufacturer'
  barcode         String   @db.VarChar(14)     // UPC/EAN being claimed
  claim_type      String   @db.VarChar(30)     // 'exclusive' | 'preferred' | 'verified'
  external_link   String   @db.Text            // Direct ordering link (no affiliate — they paid)
  wholesale_sku   String?  @db.VarChar(100)
  contact_email   String?  @db.VarChar(255)
  region          String?  @db.VarChar(100)   // Geographic coverage
  subscription_status String @default('active') // 'active' | 'expired' | 'pending'
  subscription_expires_at DateTime? @db.Timestamptz(6)
  monthly_fee_cents Int    // What the brand pays per month for this claim
  metadata        Json     @default("{}")
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  @@unique([barcode, claim_type])  // Only one exclusive claim per barcode
  @@index([barcode], map: "idx_brand_partner_claims_barcode")
  @@index([partner_name], map: "idx_brand_partner_claims_partner")
  @@index([is_active], map: "idx_brand_partner_claims_active")
}
```

**Claim types:**
- **`exclusive`** — Highest tier. Only this partner's link shows when barcode is scanned. Premium monthly fee.
- **`preferred`** — Mid tier. Partner's link shows first, but other suppliers also appear below. Moderate monthly fee.
- **`verified`** — Base tier. Partner gets a "Verified Supplier" badge but no priority placement. Low monthly fee.

**Enrichment chain integration:**

When `BarcodeEnrichmentService.enrich()` returns a result, the `WholesaleMatchingService.checkSupplierMatch()` method checks `brand_partner_claims` **first** (before `product_suppliers`):

```
checkSupplierMatch(barcode):
  1. Check brand_partner_claims for this barcode
     → If exclusive claim exists and active: return ONLY that partner
     → If preferred claim exists: return that partner first, then product_suppliers
  2. Check product_suppliers table
     → Return all matches
  3. Return null (no match)
```

**Admin route:** `POST /api/admin/brand-partners/claims` — Platform admin creates/updates brand partner claims. Includes subscription management (monthly fee, expiry date, auto-deactivation on expiry).

**Brand partner self-service (future):** `POST /api/brand-partners/claims` — Brands self-register and pay via Stripe for barcode claims. Requires email verification and UPC ownership proof.

**Revenue flow:**
```
Brand/Distributor approaches platform
  → Admin creates brand_partner_claims record (barcode + claim_type + monthly_fee)
  → Brand pays monthly subscription via Stripe
  → Any merchant scans that barcode → enrichment returns product data
  → WholesaleMatchingService checks brand_partner_claims first
  → Exclusive/preferred partner link displayed prominently
  → Merchant clicks → goes directly to brand's ordering page (no affiliate code — brand paid for the lead)
  → Brand gets exclusive lead → platform earns monthly subscription revenue
```

### 11.4 Revenue Summary

| Stream | Source | Pricing Model | Est. Revenue |
|---|---|---|---|
| **Affiliate commissions** | Faire referral links | 5-15% of first wholesale order | Per-conversion, scales with merchant activity |
| **"Find My Distributor" subscription** | Premium tier upgrade | $29-99/month (Scale/Enterprise tier) | Recurring monthly, scales with merchant count |
| **Brand partner claims** | Brands pay for UPC exclusivity | $50-500/month per barcode claim (tier-dependent) | Recurring monthly, scales with brand count × claims |

---

## 12. Functional Requirements

### 12.1 Feature Tier: Standard (Data Enrichment)

**FR-1.0: Barcode Scans & Local Cache Lookup**

When a merchant triggers a barcode scan or manual input, the system performs an exact string match against `barcode_enrichment.barcode`. If found, skip all external API steps, extract payload, and immediately populate the merchant UI form fields.

**Implementation:** Already exists in `BarcodeEnrichmentService.enrich()` — checks in-memory cache → database cache → supplier catalog before external APIs. The scan route (`scan.ts:POST /scan/:sessionId/lookup-barcode`) calls `enrichWithCategorySuggestion()` which returns enriched data + category suggestion for the frontend wizard.

**FR-1.1: External API Cascade (Cache Miss)**

On a cache miss, the system triggers parallel backend requests to BarcodeLookup.com and Go-UPC. Payloads are normalized and merged into a unified format matching the `barcode_enrichment` schema. If all APIs fail, a blank manual entry form opens and the barcode is logged to `barcode_lookup_log` for async analysis.

**Implementation:** New parallel orchestration via `Promise.allSettled()` in `BarcodeEnrichmentService.enrich()` (see §1.3). Existing `createFallbackData()` handles the stub fallback. The scan route already logs to `barcode_lookup_log`.

### 12.2 Feature Tier: Premium (Wholesale Marketplace Connection)

**FR-2.0: Supplier Association Verification**

When a merchant views any product in their catalog dashboard, the system queries `product_suppliers` (and `brand_partner_claims`) matching the product's barcode. This check runs on every product detail view.

**Implementation:** `WholesaleMatchingService.checkSupplierMatch(barcode)` — checks `brand_partner_claims` first (exclusive/preferred), then `product_suppliers`. Called from the product detail API route. Result includes supplier name, source, external link, wholesale terms.

**FR-2.1: The Active "Order Bulk" Component (Supplier Match Found)**

If a supplier row exists, display an "Order Bulk" button in the merchant workspace UI. Clicking routes the user to the wholesale buying channel via `product_suppliers.external_link` (or `brand_partner_claims.external_link`), with affiliate tracking parameters appended for Faire-sourced links.

**Implementation:**
- Frontend: `OrderBulkButton` component in product detail view
- Backend: `GET /api/tenants/:tenantId/wholesale/check?barcode={gtin}` returns supplier data
- Affiliate tracking: `affiliate_clicks` record created on click (Faire links only — brand partner claims use direct links)

**FR-2.2: The "Find Supplier" Upsell Component (No Supplier Match Found)**

If no supplier row exists, check the current merchant's account tier:

- **Free/Starter Tier UX:** Show grayed-out message: "No known wholesale suppliers tracked for this item."
- **Growth+ Tier UX:** Display interactive "Find Supplier via Faire Marketplace" button. Clicking executes a live backend query to the Faire API, searching for matching inventory via brand or product name. Returns brand stories, wholesale configurations, minimum order values, and an interface to establish a direct relationship.

**Implementation:**
- Frontend: `FindSupplierUpsell` component with tier-aware rendering (uses `useWholesaleMatchingCapability` hook)
- Backend: `POST /api/tenants/:tenantId/wholesale/search` — calls `WholesaleMatchingService.searchFaireSuppliers()`
- Capability gate: `resolveEffectiveCapabilities()` checks `wholesale_matching_options` capability group

### 12.3 Non-Functional & Operational Requirements

| Requirement | Target | Implementation |
|---|---|---|
| **Cache lookup latency** | ≤ 150ms | In-memory Map (O(1)) + indexed `barcode_enrichment.barcode` unique scan |
| **API orchestration latency (cache miss)** | ≤ 2.5s | Parallel `Promise.allSettled()` for commercial APIs, 5s timeout per provider |
| **Rate-limit safeguards** | Circuit breaker + throttle | Existing per-provider rate limiting (500 req/hr), `rateLimitState` Map, 429 response on exceed |
| **Data security & isolation** | Tenant RLS | `inventory_items` has RLS policies; `product_suppliers` and `brand_partner_claims` are cross-tenant (global supplier data) but affiliate clicks are tenant-scoped with RLS |
| **Affiliate attribution** | Click → order → commission | `affiliate_clicks` table with `click_id` tracking, Faire webhook for conversion attribution |

### 12.4 EditItemModal Decomposition (Prerequisite to Spec Alignment)

**Problem:** The `EditItemModal` (`apps/web/src/components/items/EditItemModal.tsx`) is a 1180-line monolith containing all form state, variant logic, category management, digital product config, payment gateway selection, and save logic in a single component. It predates the `ItemCreationWizard` and was never enhanced with barcode enrichment or supplier engagement. Adding spec features (GTIN field, enrichment lookup, "Order Bulk" / "Find Supplier" components) directly into this monolith would significantly increase technical debt.

**Decision:** Decompose `EditItemModal` into focused sub-components **before** adding spec-aligned features. This mirrors the wizard's step-based decomposition pattern (`BasicInfoStep`, `PricingStep`, `ContentStep`, etc.) but adapted for a modal layout.

#### 12.4.1 Current Monolith Structure (What Exists)

The 1180-line `EditItemModal` currently inlines:

| Block | Lines (approx) | Concern |
|---|---|---|
| CategoryNameDisplay helper | 1–88 | Category lookup + display (self-contained, already a sub-component) |
| Form state (20+ useState) | 98–134 | All fields in one flat state — no reducer, no form context |
| Variant change detection | 146–203 | Diff logic for create/update/delete variants |
| Item initialization effect | 234–307 | Populates all fields from `item` prop |
| Variants loading effect | 309–375 | Fetches variants via API if not in prop |
| Digital product stock effect | 377–389 | Auto-adjusts stock for digital products |
| Keyboard shortcuts | 391–418 | Alt+G/V/S shortcuts (feature-flagged) |
| Save handler | 420–586 | Builds metadata, variants, digital fields, calls `onSave`, handles variant CRUD |
| JSX: Status toggle | 611–668 | Draft/Active/Archived buttons |
| JSX: ProductTypeSelector | 670–695 | Physical/Digital/Hybrid (already a component) |
| JSX: DigitalProductConfig | 684–695 | Digital settings (already a component) |
| JSX: ProductVariants | 697–733 | Variant editor (already a component) |
| JSX: Basic fields (SKU, name, brand) | 735–790 | Inline inputs |
| JSX: Condition + MPN | 792–824 | Inline inputs |
| JSX: Pricing (list + sale) | 826–863 | Inline inputs |
| JSX: Stock | 865–882 | Inline input |
| JSX: Description + enhanced | 884–918 | Inline textareas |
| JSX: Features + specifications | 920–954 | Inline textareas |
| JSX: Photo placeholder | 956–988 | Static display (no upload in modal) |
| JSX: Category section | 990–1064 | Inline category display + selector trigger |
| JSX: Payment gateway | 1066–1074 | Already a component (`PaymentGatewaySelector`) |
| JSX: Current values debug | 1076–1101 | Inline read-only display |
| JSX: Quick actions footer | 1104–1155 | Feature-flagged shortcuts |
| JSX: ModalFooter | 1157–1164 | Save/Cancel buttons |

#### 12.4.2 Proposed Decomposition

Extract inline blocks into focused components under `apps/web/src/components/items/edit-modal/`:

```
apps/web/src/components/items/
├── EditItemModal.tsx              ← Orchestrator only (~150 lines)
├── CategoryNameDisplay.tsx        ← Already exists (move out)
└── edit-modal/
    ├── EditItemForm.tsx           ← Form context provider + state reducer
    ├── ItemStatusSelector.tsx     ← Draft/Active/Archived toggle
    ├── ItemBasicFields.tsx        ← SKU, name, brand, manufacturer, condition, MPN
    ├── ItemPricingFields.tsx      ← List price, sale price, stock
    ├── ItemContentFields.tsx      ← Description, enhanced description, features, specifications
    ├── ItemCategorySection.tsx    ← Category display + assignment trigger
    ├── ItemPhotoPlaceholder.tsx   ← Current photo display (future: upload)
    ├── ItemCurrentValues.tsx      ← Read-only current values debug panel
    ├── useItemFormState.ts        ← Custom hook: all form state + initialization + save logic
    ├── useVariantManagement.ts    ← Custom hook: variant state, change detection, CRUD
    └── types.ts                   ← Shared types for decomposed components
```

**Key extraction details:**

- **`useItemFormState.ts`** — Extracts the 20+ `useState` calls, item initialization effect, digital stock effect, and save handler into a custom hook. Returns `{ values, setters, handleSave, resetForm }`. This is the single biggest win — the state management is currently inseparable from the JSX.

- **`useVariantManagement.ts`** — Extracts variant state (`variants`, `originalVariants`, `hasVariants`, `attributeTypes`, `variantsLoading`), the variant loading effect, `detectVariantChanges()`, `extractAttributeTypes()`, and the variant save logic from `handleSave`. Returns `{ variants, setVariants, hasVariants, setHasVariants, detectChanges, loading }`.

- **`EditItemForm.tsx`** — Wraps all sub-components, consumes `useItemFormState` and `useVariantManagement`, passes props down. The orchestrator `EditItemModal.tsx` becomes a thin shell that manages modal open/close and delegates to `EditItemForm`.

- **`ItemBasicFields.tsx`** — Receives `{ sku, name, brand, manufacturer, condition, mpn, productType }` + setters. Pure presentational. **This is where the new GTIN/barcode field will be added** (see §12.4.3).

- **`ItemContentFields.tsx`** — Receives `{ description, enhancedDescription, features, specifications }` + setters. Pure presentational. **This is where enrichment-populated data renders** after a barcode lookup.

#### 12.4.3 Spec Alignment After Decomposition

Once decomposed, the following spec features slot into the focused components:

| Spec Feature | Target Component | Integration |
|---|---|---|
| **GTIN/Barcode input field** | `ItemBasicFields.tsx` | New input field bound to `gtin` state in `useItemFormState` |
| **Barcode enrichment lookup** | `useItemFormState.ts` | New `lookupBarcode(gtin)` method calls `SupplierImportService.enrichBarcode()`, populates name/brand/description/features/specs/images from `BarcodeEnrichment` result (same mapping logic as `ItemCreationWizard.handleEnrichmentMatch`) |
| **Enrichment loading state** | `ItemBasicFields.tsx` | Loading spinner on barcode field during lookup, "Enriched from {source}" badge on success |
| **Supplier match check** | `EditItemForm.tsx` | After enrichment or on item load (if `gtin` exists), call `WholesaleMatchingService.checkSupplierMatch(gtin)` |
| **"Order Bulk" button** | New: `edit-modal/SupplierMatchSection.tsx` | Renders below content fields when supplier match found. Shows supplier name, MOQ, external link with affiliate tracking. Tier-gated via `useWholesaleMatchingCapability` hook. |
| **"Find Supplier" upsell** | `edit-modal/SupplierMatchSection.tsx` | Renders when no supplier match found. Free tier: grayed message. Growth+: interactive "Find Supplier via Faire" button that calls `WholesaleMatchingService.searchFaireSuppliers()` and displays results modal. |
| **Save with GTIN** | `useItemFormState.ts` | `handleSave` includes `gtin` in the item payload sent to API. The `inventory_items.gtin` column already exists — just needs to be populated. |

**New component for supplier engagement:**

```
apps/web/src/components/items/edit-modal/
└── SupplierMatchSection.tsx       ← Renders "Order Bulk" or "Find Supplier" upsell
```

This component:
- Receives `{ gtin, tenantId, item }` props
- Calls `checkSupplierMatch(gtin)` on mount and when `gtin` changes
- If match found: renders `OrderBulkButton` with supplier details (name, MOQ, min order value, external link)
- If no match: renders `FindSupplierUpsell` (tier-aware — uses `useWholesaleMatchingCapability` hook)
- If Faire search triggered: renders `FaireSearchResults` modal with brand stories, wholesale terms, ordering links
- Affiliate click tracking: calls `WholesaleMatchingService.trackAffiliateClick()` on "Order Bulk" click

#### 12.4.4 Decomposition Execution Order

1. **Extract `useItemFormState.ts`** — Move all `useState`, initialization effect, digital stock effect, and save handler. No JSX changes yet — `EditItemModal` consumes the hook and renders the same JSX.
2. **Extract `useVariantManagement.ts`** — Move variant state, loading effect, change detection, and variant save logic. Same pattern — hook consumed by main component.
3. **Extract `ItemBasicFields.tsx`** — Move SKU/name/brand/manufacturer/condition/MPN JSX. Pure presentational with props.
4. **Extract `ItemPricingFields.tsx`** — Move price/sale price/stock JSX.
5. **Extract `ItemContentFields.tsx`** — Move description/enhanced/features/specifications JSX.
6. **Extract `ItemCategorySection.tsx`** — Move category display + selector trigger JSX.
7. **Extract `ItemPhotoPlaceholder.tsx`** + **`ItemCurrentValues.tsx`** — Small presentational extractions.
8. **Move `CategoryNameDisplay.tsx`** — Already self-contained, move to `items/` root.
9. **Verify** — `pnpm checkweb` passes, modal behavior unchanged.
10. **Then add spec features** — GTIN field in `ItemBasicFields`, enrichment in `useItemFormState`, `SupplierMatchSection` component.

Each step is independently verifiable — extract one component, run `checkweb`, commit. No behavior changes during decomposition, only structural.

#### 12.4.5 ItemCreationWizard: No Decomposition Required

The `ItemCreationWizard` (`apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx`, 1365 lines) is **already step-decomposed** — 10 separate step components in `wizards/steps/` handle all field rendering. The orchestrator's bulk is types/defaults (~270 lines), the `handleEnrichmentMatch` mapping function (~170 lines), and business logic — not inline JSX.

**Already spec-ready:**
- GTIN field exists in `BasicInfoStep` (via `wizardData.basicInfo.gtin`)
- Barcode enrichment exists via `CatalogSearchStep` → `SupplierImportService.enrichBarcode()`
- `handleEnrichmentMatch` maps `BarcodeEnrichment` → all wizard fields (same pattern `EditItemModal` will adopt post-decomposition)
- `catalogMatch` tracking with `source_type`

**Spec alignment is additive — no decomposition needed:**
- Add `SupplierMatchSection` to `ReviewStep.tsx` — calls `checkSupplierMatch(gtin)`, renders "Order Bulk" / "Find Supplier"
- Add affiliate click tracking on "Order Bulk" click

**Optional polish (non-blocking):**
- Extract `WizardData` + `INITIAL_DATA` → `wizards/types.ts` (~270 lines)
- Extract `handleEnrichmentMatch` → `wizards/utils/enrichmentMapper.ts` (~170 lines)
- Extract draft auto-save/recovery → `wizards/hooks/useWizardDraft.ts` (~100 lines)

These would reduce the orchestrator from ~1365 to ~825 lines but are convenience refactors, not prerequisites.

---

## 13. Implementation Plan

### Phase 1: Connector Implementations (SupplierConnectors.ts)

Add three new connector classes to `apps/api/src/services/SupplierConnectors.ts`:

1. **`BarcodeLookupConnector`** — implements both `fetchByBarcode` and `searchByText`
2. **`GoUpcConnector`** — implements `fetchByBarcode` only; `searchByText` returns `[]`
3. **`KrogerConnector`** — implements both, with OAuth2 token management

Each connector:
- Reads API key/credentials from env vars at construction time
- Returns `null` from `fetchByBarcode` if not configured (skipped in chain)
- Uses `AbortSignal.timeout(5000)` for 5-second timeout (same as existing)
- Maps API response → `BatchIngestRow` per the field mappings in §3

### Phase 2: Parallel Enrichment Service Integration (BarcodeEnrichmentService.ts)

Add three new provider methods to `BarcodeEnrichmentService`:

1. `enrichFromBarcodeLookup(barcode)` — calls `BarcodeLookupConnector.fetchByBarcode`
2. `enrichFromGoUpc(barcode)` — calls `GoUpcConnector.fetchByBarcode`
3. `enrichFromKroger(barcode)` — calls `KrogerConnector.fetchByBarcode`

**Change `enrich()` to use parallel orchestration for commercial APIs:**

```
Step 4a: Promise.allSettled([enrichFromBarcodeLookup, enrichFromGoUpc])
  → merge payloads if both succeed
Step 4b: enrichFromKroger (sequential fallback)
Step 4c: enrichFromUPCDatabase (existing)
Step 4d: enrichFromOpenFoodFacts (existing)
Step 5:  stub fallback + log to barcode_lookup_log
```

Each method follows the existing pattern: check rate limit → call API → save to database cache → save to memory cache → log lookup → emit metrics.

### Phase 3: Sync Job (supplier-commercial-sync.ts)

Create `apps/api/src/jobs/supplier-commercial-sync.ts`:
- `ensureSupplierExists()` for all three suppliers
- Nightly backfill for BarcodeLookup.com and Kroger (Go-UPC skipped — no text search)
- Token refresh for Kroger OAuth2
- Wire `startSupplierCommercialSync()` into `apps/api/src/index.ts`

### Phase 4: Wholesale Matching Backend

- Migration `098_product_suppliers.sql` — `product_suppliers` table
- Migration `099_affiliate_clicks.sql` — `affiliate_clicks` table
- Migration `100_brand_partner_claims.sql` — `brand_partner_claims` table
- `WholesaleMatchingService.ts` — supplier check, Faire search, affiliate link builder, brand partner claim lookup
- `WholesaleMatchingResolver.ts` — capability resolver for `wholesale_matching_options`
- Wire resolver into `EffectiveCapabilityResolver.ts` as `effective[18]`
- Routes: `wholesale-matching.ts` (check, search, suppliers, dashboard) — mount in `tenant.routes.ts` orchestrator
- Webhook: `POST /api/webhooks/faire` — Faire order confirmation callback — mount as `preMiddleware: true` in `routeRegistry.ts`
- Admin routes: `admin/brand-partners.ts` — CRUD for brand partner claims, affiliate analytics — mount in `admin.routes.ts` orchestrator
- Brand self-service: `brand-partners.ts` — mount as standalone entry in `routeRegistry.ts`

### Phase 5: Route & Provider Updates

- Update `GET /api/barcode-enrichment-singleton/providers` to include new providers
- Update provider validation in `POST /enrich` and `POST /batch` to accept new provider names
- **Mount wholesale routes in `tenant.routes.ts` orchestrator** (NOT `index.ts`) — as sub-resource router before `tenantsRoutes` catch-all
- **Mount admin wholesale + brand partner routes in `admin.routes.ts` orchestrator** — as specific sub-path routers before generic root mounts
- **Mount Faire webhook in `routeRegistry.ts`** as `preMiddleware: true` entry (before JSON parsing, same as Stripe webhooks)
- **Mount brand self-service in `routeRegistry.ts`** as standalone `/api/brand-partners` entry

### Phase 6: EditItemModal Decomposition (Prerequisite to Phase 7)

Execute the 10-step decomposition in §12.4.4:
- Extract `useItemFormState.ts` and `useVariantManagement.ts` hooks
- Extract `ItemBasicFields`, `ItemPricingFields`, `ItemContentFields`, `ItemCategorySection`, `ItemPhotoPlaceholder`, `ItemCurrentValues` components
- Move `CategoryNameDisplay` to `items/` root
- Reduce `EditItemModal.tsx` to ~150-line orchestrator
- Verify with `pnpm checkweb` after each extraction step
- No behavior changes — purely structural

### Phase 7: Frontend — Spec-Aligned Features

- **EditItemModal enhancements (post-decomposition):**
  - Add GTIN/barcode field to `ItemBasicFields.tsx`
  - Add `lookupBarcode()` to `useItemFormState.ts` — calls `SupplierImportService.enrichBarcode()`, maps result to form fields (same logic as `ItemCreationWizard.handleEnrichmentMatch`)
  - Add `SupplierMatchSection.tsx` to `edit-modal/` — renders "Order Bulk" or "Find Supplier" upsell based on supplier match + tier
  - Include `gtin` in save payload from `useItemFormState.handleSave()`
- **Shared components (used by both modal and wizard):**
  - `OrderBulkButton` component — shows when supplier match found, links to `external_link` with affiliate params
  - `FindSupplierUpsell` component — tier-aware: grayed message for free, interactive Faire search for premium
  - `useWholesaleMatchingCapability` hook — uses `resolveEffectiveCapabilities` for tier gating
  - Faire search results modal — brand stories, wholesale terms, MOQ, ordering links
- **Distributor dashboard:**
  - `DistributorDashboardClient.tsx` at `/t/[tenantId]/settings/wholesale` — product table with supplier status, regional filters, affiliate earnings widget
- **Wizard enhancement:**
  - Update `ItemCreationWizard` to call wholesale check after enrichment completes (add `SupplierMatchSection` to `ReviewStep`)

### Phase 8: Environment Variables & Documentation

- Add env vars to `.env.example` (commercial APIs + Faire)
- Update `SupplierService.ts` header comment
- Update this document with any implementation deviations

---

## 14. File Inventory

| File | Action | Description |
|---|---|---|
| `apps/api/src/services/SupplierConnectors.ts` | Modify | Add `BarcodeLookupConnector`, `GoUpcConnector`, `KrogerConnector` |
| `apps/api/src/services/BarcodeEnrichmentService.ts` | Modify | Add 3 provider methods, parallel orchestration, extend `source` type |
| `apps/api/src/services/WholesaleMatchingService.ts` | Create | Supplier matching, Faire search, affiliate link builder, brand claim lookup |
| `apps/api/src/services/resolvers/WholesaleMatchingResolver.ts` | Create | Capability resolver for `wholesale_matching_options` |
| `apps/api/src/services/resolvers/types.ts` | Modify | Add `EffectiveWholesaleMatching` type |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Modify | Wire `resolveWholesaleMatching` as `effective[18]` |
| `apps/api/src/jobs/supplier-commercial-sync.ts` | Create | Nightly sync job for commercial suppliers |
| `apps/api/src/routes/wholesale-matching.ts` | Create | Wholesale check, search, suppliers, dashboard routes (mounted in `tenant.routes.ts`) |
| `apps/api/src/routes/wholesale-matching-options-settings.ts` | Create | Capability settings routes (mounted in `tenant.routes.ts`) |
| `apps/api/src/routes/admin/wholesale-matching.ts` | Create | Admin wholesale + affiliate analytics (mounted in `admin.routes.ts`) |
| `apps/api/src/routes/admin/brand-partners.ts` | Create | Admin brand partner claims CRUD (mounted in `admin.routes.ts`) |
| `apps/api/src/routes/brand-partners.ts` | Create | Brand self-service claim submission (mounted in `routeRegistry.ts`) |
| `apps/api/src/routes/webhooks/faire.ts` | Create | Faire webhook (mounted as `preMiddleware: true` in `routeRegistry.ts`) |
| `apps/api/src/routes/tenant.routes.ts` | Modify | Add wholesale sub-resource routers before `tenantsRoutes` catch-all |
| `apps/api/src/routes/admin.routes.ts` | Modify | Add wholesale + brand-partner sub-path routers before generic root mounts |
| `apps/api/src/routes/routeRegistry.ts` | Modify | Add Faire webhook (preMiddleware) + brand-partners standalone entry |
| `apps/api/src/routes/barcode-enrichment-singleton.ts` | Modify | Update providers list, extend provider validation |
| `apps/api/src/index.ts` | Modify | Wire sync job startup only (routes handled by orchestrators + registry) |
| `apps/api/prisma/schema.prisma` | Modify | Add `product_suppliers`, `affiliate_clicks`, `brand_partner_claims` models |
| `database/migrations/098_product_suppliers.sql` | Create | `product_suppliers` table |
| `database/migrations/099_affiliate_clicks.sql` | Create | `affiliate_clicks` table |
| `database/migrations/100_brand_partner_claims.sql` | Create | `brand_partner_claims` table |
| `apps/api/.env.example` | Modify | Add commercial API + Faire env vars |
| `apps/web/src/components/products/OrderBulkButton.tsx` | Create | "Order Bulk" button for matched suppliers (shared: modal + wizard) |
| `apps/web/src/components/products/FindSupplierUpsell.tsx` | Create | Tier-aware "Find Supplier via Faire" upsell (shared: modal + wizard) |
| `apps/web/src/app/t/[tenantId]/settings/wholesale/page.tsx` | Create | Distributor dashboard page |
| `apps/web/src/app/t/[tenantId]/settings/wholesale/DistributorDashboardClient.tsx` | Create | Dashboard client with product table, filters, earnings |
| `apps/web/src/hooks/tenant-access/useWholesaleMatchingCapability.ts` | Create | Capability hook for wholesale matching |
| `apps/web/src/services/WholesaleMatchingService.ts` | Create | Frontend singleton for wholesale API calls |
| `apps/web/src/components/items/EditItemModal.tsx` | Modify | Reduce to ~150-line orchestrator (decomposition) |
| `apps/web/src/components/items/CategoryNameDisplay.tsx` | Move | Move out of EditItemModal to items/ root |
| `apps/web/src/components/items/edit-modal/EditItemForm.tsx` | Create | Form context provider + sub-component orchestrator |
| `apps/web/src/components/items/edit-modal/ItemStatusSelector.tsx` | Create | Draft/Active/Archived toggle |
| `apps/web/src/components/items/edit-modal/ItemBasicFields.tsx` | Create | SKU, name, brand, manufacturer, condition, MPN, GTIN (spec) |
| `apps/web/src/components/items/edit-modal/ItemPricingFields.tsx` | Create | List price, sale price, stock |
| `apps/web/src/components/items/edit-modal/ItemContentFields.tsx` | Create | Description, enhanced description, features, specifications |
| `apps/web/src/components/items/edit-modal/ItemCategorySection.tsx` | Create | Category display + assignment trigger |
| `apps/web/src/components/items/edit-modal/ItemPhotoPlaceholder.tsx` | Create | Current photo display |
| `apps/web/src/components/items/edit-modal/ItemCurrentValues.tsx` | Create | Read-only current values debug panel |
| `apps/web/src/components/items/edit-modal/SupplierMatchSection.tsx` | Create | "Order Bulk" / "Find Supplier" upsell in modal (spec) |
| `apps/web/src/components/items/edit-modal/useItemFormState.ts` | Create | Custom hook: form state + init + save + barcode enrichment (spec) |
| `apps/web/src/components/items/edit-modal/useVariantManagement.ts` | Create | Custom hook: variant state, change detection, CRUD |
| `apps/web/src/components/items/edit-modal/types.ts` | Create | Shared types for decomposed components |

---

## 15. Risk Assessment

| Risk | Mitigation |
|---|---|
| API cost overrun (per-call pricing) | Rate limiting (500 req/hr default), 24h cache TTL, supplier catalog pre-population via nightly backfill |
| Kroger OAuth2 token expiry | 5-min safety margin on token refresh, transparent re-auth on 401 |
| API downtime | Parallel orchestration + fallback chain — if commercial APIs fail, open-source fallbacks are tried. All failing → stub fallback |
| Data quality variance | `source` field tracks origin; admin analytics dashboard shows per-source breakdown |
| Go-UPC lacks text search | Paired with BarcodeLookup.com which covers `searchByText`. Go-UPC used for barcode-only enrichment |
| Kroger grocery-only scope | Positioned as sequential fallback after commercial APIs — only hit if barcode not found in broader databases |
| Faire API availability / terms | Faire API endpoints marked as "verify" — integration requires Faire partner program enrollment. Affiliate tracking degrades gracefully (links still work without commission if partner program not active) |
| Brand partner claim disputes | `claim_type` hierarchy (exclusive > preferred > verified) + admin approval workflow. Only one exclusive claim per barcode enforced by DB unique constraint |
| Affiliate click attribution loss | Faire webhook may not fire if merchant doesn't complete order. `affiliate_clicks.status` has `expired` state for clicks with no conversion after 30 days |
| Parallel API cost doubling | Both BarcodeLookup.com and Go-UPC are called on every cache miss. Acceptable — cache hit rate is typically >90% after initial population. Rate limiting prevents runaway costs |
| EditItemModal decomposition regression | 1180-line monolith split into 10+ files. Mitigated by 10-step incremental extraction — each step verified with `pnpm checkweb`, no behavior changes during decomposition, only structural. Rollback is per-step git revert. |
