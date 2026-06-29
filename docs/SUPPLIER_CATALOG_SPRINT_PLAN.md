# Supplier Catalog Integration — Sprint Plan

## Status: Active
## Date: June 2026
## Source: `specs/enhancement_queue_v_26.md`

---

## Sprint Overview

The spec defines a supplier catalog integration system with connector workers, normalization, an import wizard, and mapping tables. This plan includes **built-in connectors for open-source product catalogs** so the system is usable on day one — no business development or supplier negotiations required to pilot.

### Built-in Open-Source Catalog Connectors

Three open-source catalogs are available with free APIs. Two are **already integrated** in the existing `BarcodeEnrichmentService` — the supplier catalog connectors will reuse those field mappings and extend them for bulk search. The third (Open Beauty Facts) is new but shares the same API structure as Open Food Facts.

| Catalog | Scope | API | Records | Already Integrated? | License |
|---------|-------|-----|---------|---------------------|---------|
| **Open Food Facts** | Food & beverage products | `https://world.openfoodfacts.org/api/v2` — JSON, no auth | 3M+ products, 150+ countries | **Yes** — `BarcodeEnrichmentService.enrichFromOpenFoodFacts()` has full field mapping (name, brand, gtin, image, categories, nutrition, allergens) | ODbL — free for commercial use |
| **UPC Database** | General merchandise (UPC/EAN lookup) | `https://api.upcdatabase.org/product/{barcode}` — JSON, requires API key | Large UPC database | **Yes** — `BarcodeEnrichmentService.enrichFromUPCDatabase()` has full field mapping (name, brand, category, msrp, images, specs) | Requires free API key |
| **Open Beauty Facts** | Cosmetics & personal care | `https://world.openbeautyfacts.org/api/v2` — JSON, no auth | 100K+ products | **No** — new connector, but shares OFF API structure (same codebase) | ODbL — free for commercial use |

### Relationship to Existing Scan Enrichment Architecture

The platform already has a `BarcodeEnrichmentService` (`apps/api/src/services/BarcodeEnrichmentService.ts`) that performs **reactive single-barcode lookups** — a merchant scans a barcode, the service fetches product data from Open Food Facts or UPC Database, caches it in `barcode_enrichment` table, and returns enriched product data.

The supplier catalog integration is the **proactive bulk counterpart** to this:

| Aspect | Scan Enrichment (existing) | Supplier Catalog (planned) |
|--------|---------------------------|---------------------------|
| **Trigger** | Reactive — merchant scans one barcode | Proactive — system pre-fetches entire catalogs |
| **Scope** | Single product lookup by barcode | Bulk browse/search across millions of products |
| **API pattern** | `GET /product/{barcode}.json` (single item) | `GET /search?category=...&page=...` (paginated search) |
| **Storage** | `barcode_enrichment` (cache table) | `supplier_catalog_item` (persistent catalog) |
| **Use case** | Enrich an existing inventory item | Discover and import new products |

**Reuse strategy:**
- The Open Food Facts connector will reuse the field mapping from `enrichFromOpenFoodFacts()` (product_name→name, brands→brand, code→gtin, image_url→image_url, categories_tags→category)
- The UPC Database integration replaces the planned Datakick connector (already integrated with API key, rate limiting, full field mapping)
- The `barcode_enrichment` table can serve as a cache layer — when ingesting catalog items, check `barcode_enrichment` first to avoid re-fetching
- Rate limiting infrastructure (500 req/hour per provider) already exists and will be shared

These three connectors cover the most common retail verticals on the platform (grocery, pharmacy, convenience, beauty). A merchant onboarding with a grocery store can immediately search "organic milk" against Open Food Facts, select 200 items, set prices, and import — all without any supplier setup.

| Sprint | Scope | Duration | Goal |
|--------|-------|----------|------|
| **Sprint 1** | DB migration + Prisma schema + feature flag + seed suppliers | 1-2 days | Create `supplier`, `supplier_catalog_item`, `supplier_mapping` tables. Add `source_type`, `supplier_catalog_item_id`, `overrides`, `last_supplier_sync` columns to `inventory_items`. Register feature flag. Seed 3 built-in open-source suppliers (Open Food Facts, UPC Database, Open Beauty Facts). |
| **Sprint 2** | Backend services + admin API endpoints + open-source connectors | 2-3 days | `SupplierService`, `SupplierCatalogService`, `SupplierImportService`. Admin routes. **Built-in connector workers** for Open Food Facts, Open Beauty Facts, and UPC Database APIs — reusing field mappings from existing `BarcodeEnrichmentService`, extending for bulk search/pagination. |
| **Sprint 3** | Tenant import API + RBAC | 1-2 days | `POST /api/tenant/:tenantId/import` endpoint with selection validation, conflict detection, and upsert execution. RBAC enforcement. |
| **Sprint 4** | Admin UI — Supplier management + catalog browser | 2-3 days | Admin pages for managing suppliers, viewing catalog items, monitoring import health. Frontend `SupplierService` singleton. |
| **Sprint 5** | Tenant Assisted Import Wizard | 2-3 days | Tenant-facing wizard UI: supplier picker, catalog search/filter, bulk select with image preview, inline edit, validation, import summary with conflict report. |
| **Sprint 6** | Sync automation + observability + nav links | 1-2 days | Scheduled sync jobs (nightly full + hourly incremental for open-source connectors), supplier health dashboard, error handling (DLQ, replay), navigation links. |

**Total estimated duration:** 9-15 days

---

## Sprint 1: Database Migration + Prisma Schema + Feature Flag

**Goal:** Create the data foundation for supplier catalog integration.

### Tasks

#### 1.1 — Database Migration

- **File**: `database/migrations/070_supplier_catalog_integration.sql`
- **Tables**:
  - `supplier` (id, name, connection_type, api_url, active, created_at)
  - `supplier_catalog_item` (id, supplier_id, supplier_sku, name, brand, gtin, category, image_url, attrs JSONB, currency, msrp DECIMAL, content_hash, availability, updated_at, UNIQUE(supplier_id, supplier_sku))
  - `supplier_mapping` (id, tenant_id, supplier_id, supplier_sku, inventory_item_id, last_sync, sync_mode, UNIQUE(tenant_id, supplier_id, supplier_sku))
- **ALTER TABLE inventory_items**:
  - ADD COLUMN `source_type` TEXT DEFAULT 'manual'
  - ADD COLUMN `supplier_catalog_item_id` UUID REFERENCES supplier_catalog_item(id)
  - ADD COLUMN `overrides` JSONB DEFAULT '{}'
  - ADD COLUMN `last_supplier_sync` TIMESTAMPTZ
- **Indexes**: idx_supplier_catalog_item_supplier, idx_supplier_catalog_item_gtin, idx_supplier_mapping_tenant_supplier
- **Backfill**: UPDATE inventory_items SET source_type = 'manual' WHERE source_type IS NULL

#### 1.2 — Prisma Schema Update

- **File**: `apps/api/prisma/schema.prisma`
- Add `supplier`, `supplier_catalog_item`, `supplier_mapping` models
- Add 4 new fields to `inventory_items` model
- Add relations

#### 1.3 — Feature Flag Registration

- **File**: `docs/feature-flags/registry.yaml`
- Add `supplier_catalog_import` feature flag (default: disabled, pilot tenants only)

#### 1.4 — Seed Built-in Open-Source Suppliers

- **File**: `database/migrations/070_supplier_catalog_integration.sql` (same migration, appended)
- Seed 3 supplier records:
  - `supplier-off-open-food-facts` — name: 'Open Food Facts', connection_type: 'API', api_url: 'https://world.openfoodfacts.org/api/v2', active: true
  - `supplier-off-upc-database` — name: 'UPC Database', connection_type: 'API', api_url: 'https://api.upcdatabase.org', active: true (requires `UPC_DATABASE_API_KEY` env var — already configured for scan enrichment)
  - `supplier-off-open-beauty-facts` — name: 'Open Beauty Facts', connection_type: 'API', api_url: 'https://world.openbeautyfacts.org/api/v2', active: true
- These are pre-configured and active — no admin setup needed to start importing
- Note: UPC Database replaces the originally planned Datakick connector — it's already integrated in `BarcodeEnrichmentService` with full field mapping and API key support

### Done Criteria

- [ ] Migration `070_supplier_catalog_integration.sql` created and idempotent
- [ ] Prisma schema updated with 3 new models + 4 new fields on `inventory_items`
- [ ] Feature flag registered
- [ ] 3 open-source suppliers seeded in migration
- [ ] `pnpm checkapi` passes

---

## Sprint 2: Backend Services + Admin API Endpoints

**Goal:** Core backend services for supplier management, catalog ingestion, and import logic.

### Tasks

#### 2.1 — SupplierService (Admin CRUD)

- **File**: `apps/api/src/services/SupplierService.ts`
- Methods: createSupplier, updateSupplier, deleteSupplier, getSupplier, listSuppliers, toggleSupplierActive
- Fields: name, connection_type (API/CSV/SFTP), api_url, active

#### 2.2 — SupplierCatalogService (Batch Ingest + Search + Dedup)

- **File**: `apps/api/src/services/SupplierCatalogService.ts`
- Methods:
  - `batchIngest(supplierId, items[])` — idempotent upsert by (supplier_id, supplier_sku), content_hash dedup
  - `searchCatalog(supplierId, { query, brand, category, gtin, page, limit })` — paginated search with filter
  - `getCatalogItem(supplierId, supplierSku)` — single item lookup
  - `deduplicateByGtin(supplierId)` — GTIN-based dedup report
  - `fuzzyMatch(brand, normalizedName, threshold)` — brand + normalized name matching (≥0.92)

#### 2.3 — SupplierImportService (Upsert Logic + Override Merge)

- **File**: `apps/api/src/services/SupplierImportService.ts`
- Methods:
  - `importSelections(tenantId, supplierId, selections[], syncMode)` — core upsert loop per spec §10
  - `findExistingItem(tenantId, gtin)` — find by GTIN
  - `findBySupplierMapping(tenantId, supplierId, supplierSku)` — find by mapping
  - `applyOverrides(base, overrides)` — merge merchant overrides over supplier data
  - `safeMerge(existing, final)` — protect merchant price/stock from overwrite
  - `upsertMapping(tenantId, supplierId, supplierSku, inventoryItemId, syncMode)`
  - `detectConflicts(tenantId, selections[])` — GTIN conflict detection, already-in-catalog detection

#### 2.4 — Admin API Routes

- **File**: `apps/api/src/routes/admin-suppliers.ts`
- Routes:
  - `GET /api/admin/suppliers` — list suppliers
  - `POST /api/admin/suppliers` — create supplier
  - `PUT /api/admin/suppliers/:id` — update supplier
  - `DELETE /api/admin/suppliers/:id` — delete supplier
  - `GET /api/admin/suppliers/:id/catalog` — browse catalog items (paginated, filterable)
  - `POST /api/admin/suppliers/:id/catalog/batch` — batch ingest (connector → catalog store)
  - `GET /api/admin/suppliers/:id/health` — supplier health metrics

#### 2.5 — Open-Source Catalog Connectors

Three built-in connector workers that fetch from open APIs and normalize to `supplier_catalog_item`. Two reuse existing field mappings from `BarcodeEnrichmentService`:

- **File**: `apps/api/src/connectors/OpenFoodFactsConnector.ts`
  - Fetches by category/search query from `https://world.openfoodfacts.org/api/v2/search`
  - **Reuses field mapping** from `BarcodeEnrichmentService.enrichFromOpenFoodFacts()`: `product_name` → name, `brands` → brand, `code` (barcode) → gtin, `image_url` → image_url, `categories_tags` → category, `quantity` → attrs
  - Extends for bulk: pagination via `page` + `page_size` params (OFF supports up to 100 per page)
  - Full backfill: iterate categories, page through results
  - Incremental: `?fields=code,product_name,last_modified_t&sort=last_modified_t` to get recently updated
  - Checks `barcode_enrichment` table first to avoid re-fetching already-cached products

- **File**: `apps/api/src/connectors/OpenBeautyFactsConnector.ts`
  - Same API structure as Open Food Facts (shared codebase, different host)
  - Maps OBF fields → our schema (identical field names as OFF)
  - Can extend `OpenFoodFactsConnector` with a different base URL

- **File**: `apps/api/src/connectors/UPCDatabaseConnector.ts`
  - **Reuses field mapping** from `BarcodeEnrichmentService.enrichFromUPCDatabase()`: `title` → name, `brand` → brand, `category` → category, `msrp` → msrp, `images[0]` → image_url, full specs metadata
  - Uses existing `UPC_DATABASE_API_KEY` env var (already configured for scan enrichment)
  - Bulk mode: batch lookup via `POST /products/batch` (if available) or sequential lookup with existing rate limiting (500 req/hour)
  - Best for on-demand barcode enrichment during import (not full catalog backfill)

- **File**: `apps/api/src/connectors/index.ts`
  - Connector registry: maps supplier ID → connector instance
  - `getConnector(supplierId)`: returns the appropriate connector for a supplier
  - `runIngest(supplierId, options)`: orchestrates full or incremental sync
  - Built-in suppliers (Open Food Facts, Open Beauty Facts, UPC Database) auto-resolve to their connectors
  - Custom suppliers (CSV/SFTP) resolve to the generic CSV connector (Sprint 6)
  - **Shared rate limiting** with existing `BarcodeEnrichmentService` (500 req/hour per provider)

### Done Criteria

- [ ] SupplierService, SupplierCatalogService, SupplierImportService created
- [ ] Admin API routes mounted in index.ts
- [ ] 3 open-source connector workers created and functional
- [ ] Connector registry created
- [ ] `pnpm checkapi` passes

---

## Sprint 3: Tenant Import API + RBAC

**Goal:** Tenant-facing import endpoint with validation, conflict detection, and RBAC.

### Tasks

#### 3.1 — Tenant Import Route

- **File**: `apps/api/src/routes/supplier-import.ts`
- Routes:
  - `POST /api/tenant/:tenantId/import` — execute import selections
  - `GET /api/tenant/:tenantId/import/conflicts?supplierId=&skus=` — pre-flight conflict check
  - `GET /api/tenant/:tenantId/suppliers` — list available suppliers (for wizard picker)
  - `GET /api/tenant/:tenantId/suppliers/:id/catalog` — search supplier catalog (for wizard)
  - `GET /api/tenant/:tenantId/supplier-mappings` — list existing mappings
  - `PUT /api/tenant/:tenantId/supplier-mappings/:id` — update sync mode

#### 3.2 — RBAC Enforcement

- Admin: link suppliers, imports, sync settings
- Staff: run imports, edit price/stock
- Viewer: read-only
- Platform Admin: manage suppliers, credentials, logs

#### 3.3 — Domain Events

- Emit `inventory.upserted_from_supplier` event after each import
- Wire to existing domain event system for downstream Google Sync / Analytics

### Done Criteria

- [ ] Tenant import routes mounted in index.ts
- [ ] RBAC gates enforced
- [ ] Domain events emitted
- [ ] `pnpm checkapi` passes

---

## Sprint 4: Admin UI — Supplier Management + Catalog Browser

**Goal:** Admin pages for managing suppliers and browsing catalog items.

### Tasks

#### 4.1 — Frontend SupplierService

- **File**: `apps/web/src/services/SupplierService.ts`
- Extends `AdminApiSingleton`
- Methods: listSuppliers, createSupplier, updateSupplier, deleteSupplier, searchCatalog, batchIngest, getSupplierHealth

#### 4.2 — Admin Supplier Management Page

- **Route**: `/settings/admin/suppliers`
- Supplier list table (name, connection type, active toggle, catalog item count, last sync)
- Create/edit supplier modal (name, connection_type, api_url)
- Health metrics per supplier (success %, dedup %, GTIN coverage, freshness lag)

#### 4.3 — Admin Catalog Browser

- **Route**: `/settings/admin/suppliers/:id/catalog`
- Paginated catalog item grid with search/filter (by name, brand, GTIN, category)
- Image preview thumbnails
- Batch ingest upload (CSV file upload for CSV connector)
- Import health dashboard (success rate, errors, quarantine count)

#### 4.4 — Navigation Links

- SQL migration to add "Suppliers" admin nav link under Payments & Billing or a new "Catalog" section
- Follow database navigation system patterns (dynamic parent lookup, idempotent insert)

### Done Criteria

- [ ] SupplierService singleton created
- [ ] Admin supplier management page functional
- [ ] Admin catalog browser page functional
- [ ] Nav link migration created
- [ ] `pnpm checkweb` passes

---

## Sprint 5: Tenant Catalog Integration — ItemCreationWizard + Import Wizard

**Goal:** Embed supplier catalog search at the point of product creation (ItemCreationWizard Step 0) AND provide a standalone bulk import wizard. Capability-gated via `FF_SUPPLIER_CATALOG_IMPORT`.

### Design Rationale

The smartest placement for catalog integration is the **point of product creation** — the existing `ItemCreationWizard` (`apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx`). When a merchant clicks "Add Product," the first thing they see should be an optional catalog search step. If they find a match, the entire 7-step wizard auto-populates with supplier data (name, brand, GTIN, image, category, description). If they skip, they proceed to manual entry as before.

This gives **maximum discoverability** without requiring merchants to find a separate import page. The standalone import wizard remains for bulk operations (200+ items).

### Tasks

#### 5.1 — Frontend SupplierImportService

- **File**: `apps/web/src/services/SupplierImportService.ts`
- Extends `TenantApiSingleton`
- Methods: listSuppliers, searchCatalog, checkConflicts, executeImport, getMappings, updateSyncMode, lookupByBarcode

#### 5.2 — ItemCreationWizard Catalog Search Step (Step 0)

- **File**: `apps/web/src/components/inventory/wizards/steps/CatalogSearchStep.tsx` (NEW)
- **Inserted before** Step 1 (Basic Information) in the wizard step list
- Only visible when `FF_SUPPLIER_CATALOG_IMPORT` is enabled for the tenant (checked via `isFeatureEnabled`)
- **UI**:
  - Search bar with barcode/GTIN lookup + text search (name, brand)
  - Supplier filter dropdown (defaults to "All Suppliers")
  - Results grid: thumbnail, name, brand, GTIN, category, MSRP — click to select
  - "Skip & Enter Manually" button → proceeds to Step 1 as before
  - "Use This Product" button on selected item → auto-populates wizard data and jumps to Step 7 (Review)
- **Auto-populate mapping** (supplier_catalog_item → wizard data):
  - `name` → `basicInfo.name`
  - `brand` → `basicInfo.brand`
  - `gtin` → `basicInfo.gtin` (new field on BasicInfoStep)
  - `description` → `content.description`
  - `image_url` → `media.primaryImage`
  - `category` → `organization.categoryId` (matched against tenant categories)
  - `msrp` → `pricing.listPrice` (converted to cents)
  - `attrs` → `content.specifications`
  - `supplier_catalog_item_id` → stored in wizard metadata for mapping on save
- **Capability awareness**: The wizard checks `isFeatureEnabled('FF_SUPPLIER_CATALOG_IMPORT', tenantId)` and only shows Step 0 if enabled. If disabled, wizard starts at Step 1 (Basic Information) as before — zero regression.

- **File**: `apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx` (MODIFIED)
  - Add `CatalogSearchStep` as step 0 when feature flag is enabled
  - Update `STEPS` array to conditionally include catalog step
  - Add `catalogMatch` state to `WizardData` interface (stores selected supplier_catalog_item_id + source data)
  - On save, include `source_type: 'supplier_catalog'` and `supplier_catalog_item_id` in API payload

- **File**: `apps/web/src/components/inventory/wizards/steps/BasicInfoStep.tsx` (MODIFIED)
  - Add optional `gtin` field to the data interface
  - Show GTIN as read-only when pre-filled from catalog match

- **File**: `apps/web/src/app/t/[tenantId]/items/create/page.tsx` (MODIFIED)
  - Include `source_type` and `supplier_catalog_item_id` in `apiPayload` when catalog match was used

#### 5.3 — Standalone Import Wizard Page (Bulk)

- **Route**: `/t/[tenantId]/settings/import-wizard`
- For bulk imports (200+ items) — separate from the single-product wizard integration
- **Steps**:
  1. Supplier picker (dropdown of available suppliers)
  2. Catalog search/filter (search bar, brand filter, category filter, pagination)
  3. Bulk select with image preview (grid of catalog items with checkboxes, image, name, brand, GTIN, MSRP)
  4. Inline edit (price, stock, optional name/image overrides) — validation: price > 0, stock ≥ 0
  5. Import summary with conflict report (states: Can import, Already in catalog, GTIN conflict, Discontinued)
  6. Confirm import → execute POST /api/tenant/:tenantId/import

#### 5.4 — Import Results & Mapping Management

- **Route**: `/t/[tenantId]/settings/supplier-mappings`
- Table of existing supplier mappings (supplier, SKU, inventory item, sync mode, last sync)
- Toggle sync mode (manual/auto)
- Unlink mapping

#### 5.5 — Navigation Links

- SQL migration to add "Import Wizard" and "Supplier Mappings" tenant nav links
- Place under tenant Settings or Inventory section

### Done Criteria

- [ ] SupplierImportService singleton created
- [ ] CatalogSearchStep (Step 0) integrated into ItemCreationWizard with capability gating
- [ ] Auto-populate from catalog match functional (all 7 wizard steps populated)
- [ ] Standalone import wizard page functional (all 6 steps)
- [ ] Supplier mappings page functional
- [ ] Nav link migration created
- [ ] Feature flag gating verified (wizard shows Step 0 only when enabled)
- [ ] `pnpm checkweb` passes

---

## Sprint 6: Sync Automation + Observability + Error Handling

**Goal:** Automated sync jobs, error handling/recovery, and health monitoring.

### Tasks

#### 6.1 — CSV Connector Worker + Open-Source Sync Jobs

- **File**: `apps/api/src/jobs/supplier-csv-sync.ts`
  - Generic CSV connector for custom suppliers (CSV/SFTP)
  - Reads CSV from supplier API URL or SFTP
  - Normalizes rows to supplier_catalog_item format
  - Calls SupplierCatalogService.batchIngest

- **File**: `apps/api/src/jobs/supplier-opensource-sync.ts`
  - Scheduled sync for the 3 built-in open-source suppliers
  - Nightly full backfill: Open Food Facts + Open Beauty Facts (category-by-category pagination)
  - Hourly incremental: fetch items updated since last sync via `last_modified_t`
  - UPC Database: on-demand only (not scheduled — used for barcode lookups during import, reuses existing `BarcodeEnrichmentService` rate limiting)
  - Wired into server startup in `index.ts` (following existing job pattern like `platform-badge-sync.ts`)

#### 6.2 — Auto-Sync Job

- **File**: `apps/api/src/jobs/supplier-auto-sync.ts`
- For mappings with sync_mode='auto': push name/image updates to inventory_items
- Never overwrite merchant price/stock
- Runs hourly

#### 6.3 — Error Handling & DLQ

- **Tables** (in migration): `catalog_quarantine` (id, supplier_id, raw_payload JSONB, error_code, severity, created_at, replayed_at)
- Row-level quarantine for bad imports
- Exponential backoff on API errors
- Replay endpoint: `POST /api/admin/suppliers/:id/quarantine/:qid/replay`

#### 6.4 — Supplier Health Dashboard

- **Route**: `/settings/admin/suppliers/health`
- Metrics: success %, dedup %, GTIN coverage %, latency, freshness lag
- Alerts on freshness lag > 24h
- Weekly report export (CSV)

#### 6.5 — Field Merge & Precedence (Read Order)

- Implement read order in SingleProductService / InventoryService: `merchant.overrides → inventory_items → supplier_catalog_item`
- Fields: Price (merchant), Stock (merchant), Title (supplier unless override), Brand/GTIN (supplier, locked), Image (supplier preferred, override allowed), Category (supplier normalized, merchant may refine)

### Done Criteria

- [ ] CSV connector worker scheduled
- [ ] Auto-sync job scheduled
- [ ] Quarantine table + replay endpoint
- [ ] Health dashboard page functional
- [ ] Field merge read order implemented
- [ ] `pnpm checkapi` + `pnpm checkweb` pass

---

## Dependency Graph

```
Sprint 1 (DB + Schema + Seed Suppliers)
  └→ Sprint 2 (Backend Services + Admin API + Open-Source Connectors)
       └→ Sprint 3 (Tenant Import API + RBAC)
            └→ Sprint 4 (Admin UI)
                 └→ Sprint 5 (Tenant Import Wizard)
                      └→ Sprint 6 (Sync Jobs + Observability)
```

Sprints are strictly sequential — each builds on the previous sprint's deliverables.

---

## Future: v2.6b Gap Closure (Post-Sprint 6)

The spec includes a v2.6b patch with additional requirements that are NOT part of the initial 6 sprints:

- REQ-2025-406: Product Variant Model & Bundles (parent_item_id, bundle_component table)
- REQ-2025-407: Supplier License Registry & Enforcement
- REQ-2025-408: Error Taxonomy, DLQ & Replay (partially covered in Sprint 6)
- REQ-2025-409: Catalog Scale & SLA (partitioning)
- REQ-2025-410: Bulk Pricing Rules & Safe Rollback
- REQ-2025-411: Taxonomy & Mapping Versioning
- REQ-2025-412: Multi-currency & Localization Fields
- REQ-2025-413: Key Rotation & Scope Policy
- REQ-2025-414: Supplier Health Dashboard & Alerts (partially covered in Sprint 6)

These will be planned as separate sprints after the core integration is stable.

---

## Sprint 1 Start Criteria

- [ ] Spec reviewed and approved
- [ ] Sprint plan reviewed and approved
- [ ] No blocking TS errors on `pnpm checkapi` or `pnpm checkweb`
