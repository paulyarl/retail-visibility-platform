# Supplier Catalog Integration — Architecture Insights & Patterns

## The Journey: From Manual Entry to Proactive Catalog Discovery

This document captures the architectural insights, patterns, and lessons from implementing the Supplier Catalog Integration across 6 sprints. It covers the data model, service layer, scheduled jobs, frontend pages, and the role each component plays in the overall platform architecture.

**Design doc:** `docs/SUPPLIER_CATALOG_SPRINT_PLAN.md`
**Feature flag:** `FF_SUPPLIER_CATALOG_IMPORT` (pilot, default off in seed, tenant override via DB hybrid flag — **now enabled in production** with `enabled=true, allow_tenant_override=true`)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                           │
│                                                                     │
│  Admin Pages                    Tenant Pages                        │
│  /settings/admin/suppliers      /t/[tenantId]/items/create          │
│  /settings/admin/suppliers/     /t/[tenantId]/settings/             │
│    health                         import-wizard                     │
│                                 /t/[tenantId]/settings/             │
│                                   supplier-mappings                 │
│                                                                     │
│  Services:                      Services:                           │
│  SupplierService (admin)        SupplierImportService (tenant)      │
│  ↳ AdminApiSingleton            ↳ TenantApiSingleton                │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ HTTP API
┌──────────────────┴──────────────────────────────────────────────────┐
│                         Backend (Express)                           │
│                                                                     │
│  Admin Routes                   Tenant Routes                       │
│  /api/admin/suppliers           /api/tenants/:tenantId/suppliers    │
│  ↳ requirePlatformAdmin         ↳ checkTenantAccess /               │
│                                   requireTenantOwner +              │
│                                   FF_SUPPLIER_CATALOG_IMPORT        │
│                                                                     │
│  Services:                                                         │
│  SupplierService          — CRUD for supplier records               │
│  SupplierCatalogService   — Batch ingest, search, quarantine        │
│  SupplierImportService    — Import selections, conflict detection   │
│  SupplierConnectors       — Open Food Facts, Open Beauty Facts,     │
│                              UPC Database connectors                │
│                                                                     │
│  Scheduled Jobs:                                                   │
│  supplier-csv-sync.ts       — Every 6h, CSV/SFTP suppliers         │
│  supplier-opensource-sync.ts — Hourly incremental + nightly         │
│                                 backfill for OFF/OBF                │
│  supplier-auto-sync.ts      — Every 1h, push updates to            │
│                                 inventory_items for auto mappings   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ Prisma
┌──────────────────┴──────────────────────────────────────────────────┐
│                         Database (PostgreSQL)                       │
│                                                                     │
│  supplier              — Supplier records (built-in + custom)       │
│  supplier_catalog_item — Catalog items from suppliers               │
│  supplier_mapping      — Tenant ↔ supplier catalog mappings         │
│  catalog_quarantine    — DLQ for bad import rows                    │
│  inventory_items       — Extended with source_type,                 │
│                          supplier_catalog_item_id, overrides,       │
│                          last_supplier_sync                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Core Tables

**`supplier`** — Source catalog provider (built-in or custom)
- `id` (varchar, manual): `supplier-open-food-facts`, `supplier-custom-{timestamp}`
- `connection_type`: `API`, `CSV`, `SFTP`
- `is_builtin`: true for 3 seeded open-source suppliers, false for custom
- `active`: toggle to enable/disable
- `api_url`, `api_key_env`: connection config (env var name, not the key itself)

**`supplier_catalog_item`** — Individual products in a supplier's catalog
- Unique on `(supplier_id, supplier_sku)` — dedup key
- Fields: name, brand, gtin, category, category_path, image_url, image_gallery, description, attrs (JSONB), msrp, availability, content_hash
- Indexed by supplier_id and has expression index on gtin
- This is the **proactive bulk counterpart** to `barcode_enrichment` (which is reactive single-lookup)

**`supplier_mapping`** — Links a tenant's inventory item to a supplier catalog item
- Unique on `(tenant_id, supplier_id, supplier_sku)` — one mapping per tenant+supplier+SKU
- `sync_mode`: `manual` (default) or `auto` (enables auto-sync job)
- `last_sync`: timestamp of last auto-sync push
- Indexed by tenant_id, inventory_item_id, and composite tenant+supplier

**`catalog_quarantine`** — Dead letter queue for bad import rows
- `raw_payload` (JSONB): the original row data
- `error_code`: `MISSING_SKU`, `MISSING_NAME`, `INGEST_ERROR`
- `error_message`: human-readable error
- `replayed_at`: null until successfully replayed
- Cascade-deletes with supplier

### Extended Fields on `inventory_items`

- `source_type` (default `manual`): `manual`, `supplier_catalog`, `import_wizard`
- `supplier_catalog_item_id` (UUID, FK): direct link to catalog item
- `overrides` (JSONB): merchant overrides for supplier-synced fields
- `last_supplier_sync` (timestamptz): last time supplier data was pushed

### Migrations

| # | File | Purpose |
|---|------|---------|
| 070 | `070_supplier_catalog_integration.sql` | Creates 3 tables + extends inventory_items + seeds 3 built-in suppliers |
| 071 | `071_nav_supplier_management.sql` | Admin nav link for "Suppliers" |
| 072 | `072_nav_import_wizard_supplier_mappings.sql` | Tenant nav links for "Import Wizard" + "Supplier Mappings" |
| 073 | `073_nav_supplier_health.sql` | Admin nav link for "Supplier Health" |
| 077 | `077_supplier_dedup_cleanup.sql` | Cleanup duplicate supplier records from ID mismatch |

---

## Service Layer

### Backend Services

**`SupplierService`** (`apps/api/src/services/SupplierService.ts`)
- Role: Admin CRUD for supplier records + health metrics
- Methods: `listSuppliers`, `getSupplier`, `createSupplier`, `updateSupplier`, `deleteSupplier`, `getSupplierHealth`, `getHealthDashboard`
- `getHealthDashboard()` aggregates across all suppliers: success %, dedup %, GTIN coverage, freshness lag, alerts
- Built-in suppliers cannot be deleted (only custom)
- Exported as singleton: `export const SupplierService = new SupplierServiceClass()`

**`SupplierCatalogService`** (`apps/api/src/services/SupplierCatalogService.ts`)
- Role: Batch ingest, search, quarantine management
- Methods: `searchCatalog`, `getCatalogItem`, `lookupByBarcode`, `batchIngest`, `getQuarantinedItems`, `replayQuarantine`
- `batchIngest`: idempotent upsert by `(supplier_id, supplier_sku)`. Missing required fields → quarantine. DB errors → quarantine with `INGEST_ERROR`.
- `replayQuarantine`: re-attempts ingestion of the raw payload. On success, marks `replayed_at`. On failure, updates error message and leaves unreplayed.
- Exported as singleton with default export

**`SupplierImportService`** (`apps/api/src/services/SupplierImportService.ts`)
- Role: Tenant-scoped import orchestration
- Methods: `checkConflicts`, `executeImport`, `getMappings`, `updateSyncMode`, `unlinkMapping`
- `executeImport`: creates `inventory_items` + `supplier_mapping` records, emits audit log
- `checkConflicts`: pre-flight check for GTIN conflicts, already-in-catalog items

**`SupplierConnectors`** (`apps/api/src/services/SupplierConnectors.ts`)
- Role: Open-source API connectors for built-in suppliers
- Interface: `SupplierConnector` with `fetchByBarcode(gtin)` and `searchByText(query, page)`
- Implementations: `OpenFoodFactsConnector`, `OpenBeautyFactsConnector`, `UPCDatabaseConnector`
- Registry: `registerConnector`, `getConnector`, `getAllConnectors`
- Reuses field mappings from existing `BarcodeEnrichmentService` (product_name→name, brands→brand, code→gtin, etc.)
- UPC Database uses `UPC_DATABASE_API_KEY` env var (shared with scan enrichment)

### Frontend Services

**`SupplierService`** (`apps/web/src/services/SupplierService.ts`)
- Extends `AdminApiSingleton` — calls `/api/admin/suppliers` endpoints
- Methods: `listSuppliers`, `getSupplier`, `createSupplier`, `updateSupplier`, `deleteSupplier`, `getSupplierHealth`, `getHealthDashboard`, `searchCatalog`, `batchIngest`, `getQuarantinedItems`, `replayQuarantine`
- Types exported: `Supplier`, `SupplierHealth`, `CatalogItem`, `CatalogSearchResult`, `BatchIngestRow`, `BatchIngestResult`, `QuarantinedItem`, `SupplierInput`, `HealthDashboard`, `SupplierHealthMetric`

**`SupplierImportService`** (`apps/web/src/services/SupplierImportService.ts`)
- Extends `TenantApiSingleton` — calls `/api/tenants/:tenantId/suppliers` endpoints
- Methods: `listSuppliers`, `searchCatalog`, `lookupByBarcode`, `checkConflicts`, `executeImport`, `getMappings`, `updateSyncMode`, `unlinkMapping`

---

## API Routes

### Admin Routes (`apps/api/src/routes/admin/suppliers.ts`)
- **Auth:** `requirePlatformAdmin` on all routes
- **Route ordering:** `/health/dashboard` must be declared BEFORE `/:id` to avoid Express matching `health` as an ID

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/suppliers` | List suppliers (optional `?active=true`) |
| GET | `/api/admin/suppliers/health/dashboard` | Aggregated health metrics |
| GET | `/api/admin/suppliers/:id` | Get single supplier |
| POST | `/api/admin/suppliers` | Create custom supplier |
| PUT | `/api/admin/suppliers/:id` | Update supplier |
| DELETE | `/api/admin/suppliers/:id` | Delete (custom only) |
| GET | `/api/admin/suppliers/:id/health` | Per-supplier health metrics |
| GET | `/api/admin/suppliers/:id/catalog` | Browse catalog items (paginated) |
| POST | `/api/admin/suppliers/:id/ingest` | Batch ingest catalog rows |
| GET | `/api/admin/suppliers/:id/quarantine` | List quarantined items |
| POST | `/api/admin/suppliers/:id/quarantine/:qid/replay` | Replay quarantined item |

### Tenant Routes (`apps/api/src/routes/tenant/suppliers.ts`)
- **Auth:** `authenticateToken` + `checkTenantAccess` (read) or `requireTenantOwner` (write)
- **Feature gate:** `requireFlag('FF_SUPPLIER_CATALOG_IMPORT')` on all routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tenants/:tenantId/suppliers` | List active suppliers |
| GET | `/api/tenants/:tenantId/suppliers/catalog/search` | Search catalog items |
| GET | `/api/tenants/:tenantId/suppliers/catalog/lookup` | Lookup by barcode/GTIN |
| POST | `/api/tenants/:tenantId/suppliers/import/check` | Pre-flight conflict check |
| POST | `/api/tenants/:tenantId/suppliers/import` | Execute import |
| GET | `/api/tenants/:tenantId/suppliers/mappings` | List mappings |
| PUT | `/api/tenants/:tenantId/suppliers/mappings/:mid` | Update sync mode |
| DELETE | `/api/tenants/:tenantId/suppliers/mappings/:mid` | Unlink mapping |

---

## Scheduled Jobs

All jobs follow the existing platform pattern (see `platform-badge-sync.ts`):
- Dynamic import in `index.ts` server startup block
- Try-catch with structured error logging
- Startup delay (5-10 min) to avoid firing on nodemon restarts
- Env var to disable (`DISABLE_SUPPLIER_CSV_SYNC`, `DISABLE_SUPPLIER_OPENSOURCE_SYNC`, `DISABLE_SUPPLIER_AUTO_SYNC`)

| Job | File | Interval | Startup Delay | Purpose |
|-----|------|----------|---------------|---------|
| CSV Sync | `supplier-csv-sync.ts` | 6 hours | 10 min | Fetch CSV from custom suppliers, parse, batchIngest |
| Open-Source Sync | `supplier-opensource-sync.ts` | 1h incremental + 24h backfill | 10 min | OFF + OBF catalog sync (hourly search, nightly 20-page backfill) |
| Auto-Sync | `supplier-auto-sync.ts` | 1 hour | 5 min | Push supplier field updates to inventory_items for `sync_mode='auto'` mappings |

### Exponential Backoff

The CSV sync worker implements exponential backoff on fetch failures:
- 3 retries with delays of 1s, 2s, 4s (capped at 8s)
- Failed fetches log error and continue to next supplier

### Auto-Sync Field Merge Rules

The auto-sync job and `SingleProductService.applySupplierFieldMerge` both follow the same read order:

**`merchant.overrides → inventory_items → supplier_catalog_item`**

| Field | Source | Rule |
|-------|--------|------|
| Price | inventory_items | Always merchant-controlled, never overwritten |
| Stock | inventory_items | Always merchant-controlled, never overwritten |
| Title | supplier_catalog_item | From supplier unless merchant has overridden (detected via `metadata.supplier_overrides.title`) |
| Brand | supplier_catalog_item | Locked to supplier |
| GTIN | supplier_catalog_item | Locked to supplier |
| Image | supplier_catalog_item | Supplier preferred, but only if inventory has no custom image |
| Description | supplier_catalog_item | From supplier if inventory description is empty |
| Category | supplier_catalog_item | Supplier normalized, stored in specifications if merchant hasn't set a category |

---

## Frontend Pages

### Admin Pages (Platform Admin only)

**Supplier Management** — `/settings/admin/suppliers`
- Component: `apps/web/src/admin/components/SupplierManagement.tsx`
- CRUD table for suppliers with create/edit modal, delete confirmation
- Per-supplier health metrics (loaded in parallel via `Promise.all`)
- Active toggle, built-in badge, catalog item count, mapping count

**Supplier Health Dashboard** — `/settings/admin/suppliers/health`
- Component: `apps/web/src/admin/components/SupplierHealthDashboard.tsx`
- Summary cards: catalog items, GTIN coverage %, success rate %, freshness alerts
- Per-supplier table with color-coded metrics (green/amber/red thresholds)
- CSV export button for weekly reports
- Refresh button for manual data reload

**Supplier Catalog Browser** — `/settings/admin/suppliers/:id/catalog`
- Component: `apps/web/src/admin/components/SupplierCatalogBrowser.tsx`
- Paginated catalog grid with search/filter (name, brand, GTIN, category)
- Image preview thumbnails
- Batch ingest upload (CSV file upload)

### Tenant Pages (Feature-flagged)

**Item Creation Wizard — Catalog Search Step** — `/t/[tenantId]/items/create`
- Component: `apps/web/src/components/inventory/wizards/steps/CatalogSearchStep.tsx`
- Inserted as Step 0 in `ItemCreationWizard` when `FF_SUPPLIER_CATALOG_IMPORT` is enabled
- Search by barcode/GTIN or text (name, brand)
- Click a result → auto-populates all 7 wizard steps and jumps to Review
- "Skip & Enter Manually" button → proceeds to Step 1 as before (zero regression)
- `WizardData` interface extended with `catalogMatch` and `basicInfo.gtin`

**Standalone Import Wizard** — `/t/[tenantId]/settings/import-wizard`
- Component: `apps/web/src/components/supplier/ImportWizard.tsx`
- 6-step bulk import: supplier picker → search/filter → bulk select with image preview → inline edit (price/stock) → conflict report → confirm import
- For bulk operations (200+ items)

**Supplier Mappings** — `/t/[tenantId]/settings/supplier-mappings`
- Component: `apps/web/src/components/supplier/SupplierMappings.tsx`
- Table of existing mappings (supplier, SKU, inventory item, sync mode, last sync)
- Toggle sync mode (manual/auto)
- Unlink mapping (does not delete inventory item)

---

## Product Wizard Integration

The supplier catalog integrates directly into the Item Creation Wizard (`/t/[tenantId]/items/create`) as an optional Step 0, providing proactive product discovery before manual entry.

### Architecture

```
ItemCreationWizard
  ├── useFeatureFlag('FF_SUPPLIER_CATALOG_IMPORT')
  ├── catalogEnabled = !isEditing && ffSupplierCatalog
  ├── STEPS = catalogEnabled ? [CATALOG_STEP, ...BASE_STEPS] : BASE_STEPS
  └── renderStep()
       ├── Step 0: CatalogSearchStep (when catalogEnabled)
       │    ├── Supplier dropdown (from SupplierImportService.listSuppliers)
       │    ├── Barcode/GTIN lookup → SupplierImportService.lookupByBarcode()
       │    ├── Text search → SupplierImportService.searchCatalog()
       │    ├── Result grid (image, name, brand, SKU, price, GTIN)
       │    ├── "Use This Product" → handleCatalogMatch()
       │    └── "Skip & Enter Manually" → handleCatalogSkip()
       └── Steps 1-7: BasicInfoStep, ProductTypeStep, ... ReviewStep
```

### Key Components

**`CatalogSearchStep`** (`apps/web/src/components/inventory/wizards/steps/CatalogSearchStep.tsx`)
- Props: `tenantId`, `onUseProduct(item)`, `onSkip()`
- Loads active suppliers via `SupplierImportService.listSuppliers(tenantId)` on mount
- Dual search mode: barcode/GTIN lookup + text search
- Supplier filter dropdown (optional — searches all suppliers by default)
- Result cards with image preview, name, brand, SKU, price, GTIN
- Select a result → click "Use This Product" → auto-populates wizard

**`ItemCreationWizard`** (`apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx`)
- `WizardData` interface extended with `catalogMatch` field:
  ```ts
  catalogMatch?: {
    supplier_catalog_item_id: string;
    supplier_id: string;
    supplier_sku: string;
    source_type: 'supplier_catalog';
  }
  ```
- `handleCatalogMatch(item)`: auto-populates `basicInfo` (name, brand, gtin), `content` (description, specifications), `media` (primaryImage from catalog URL), `pricing` (listPrice from MSRP), and `catalogMatch` metadata. Jumps to Review step.
- `handleCatalogSkip()`: proceeds to Basic Info step (step 1 when catalog enabled, step 0 otherwise)
- On submit: includes `source_type: 'supplier_catalog'` and `supplier_catalog_item_id` in the API payload when `catalogMatch` is set
- `BasicInfoStep` receives `gtinReadOnly={!!wizardData.catalogMatch}` — GTIN is locked when product came from supplier catalog (supplier is source of truth for GTIN)

### On-Demand Barcode Lookup (UPC Database)

The UPC Database connector has no bulk search API — it only supports single barcode lookups. This means:
- **Catalog Items count is always 0** in the admin suppliers table (no bulk sync job)
- The "(on-demand)" badge appears next to the count for built-in suppliers with 0 items
- When a merchant scans a barcode in the wizard, `lookupByBarcode()` calls the UPC Database connector's `fetchByBarcode(gtin)` in real-time
- If found, the result is returned to the wizard for selection — no pre-ingestion needed
- The `supplier-opensource-sync.ts` job does NOT include UPC Database (only OFF + OBF have scheduled sync)

### Feature Flag Gating

The wizard integration is gated by `FF_SUPPLIER_CATALOG_IMPORT`:
- **Enabled (pilot tenants):** Wizard starts at Step 0 (Catalog Search). Merchant can search supplier catalogs, select a match, and jump to Review with auto-populated data.
- **Disabled (default):** Wizard starts at Step 1 (Basic Info) as before. Zero regression — no code path changes, no UI changes.
- **Edit mode:** Catalog search step is never shown when editing an existing product (`catalogEnabled = !isEditing && ffSupplierCatalog`)

### Data Flow

```
Merchant scans barcode in wizard
  → CatalogSearchStep calls SupplierImportService.lookupByBarcode(tenantId, gtin)
  → Tenant route /api/tenants/:tenantId/suppliers/catalog/lookup
  → SupplierCatalogService.lookupByBarcode() checks supplier_catalog_item table first
  → If not found, calls SupplierConnectors.getConnector(supplierId).fetchByBarcode(gtin)
  → Connector hits external API (OFF, OBF, or UPC Database)
  → Returns BatchIngestRow → normalized to TenantCatalogItem
  → Merchant clicks "Use This Product"
  → handleCatalogMatch() populates wizardData + jumps to Review
  → On submit, API receives source_type='supplier_catalog' + supplier_catalog_item_id
  → inventory_items record created with supplier link
  → supplier_mapping record created (tenant ↔ supplier catalog item)
```

---

## RBAC Matrix

| Action | Platform Admin | Tenant Owner/Admin | Tenant Staff | Tenant Viewer |
|--------|---------------|--------------------|-------------- | ------------- |
| Manage suppliers (CRUD) | ✅ | ❌ | ❌ | ❌ |
| View health dashboard | ✅ | ❌ | ❌ | ❌ |
| Browse supplier catalog (admin) | ✅ | ❌ | ❌ | ❌ |
| Batch ingest (admin) | ✅ | ❌ | ❌ | ❌ |
| Replay quarantine | ✅ | ❌ | ❌ | ❌ |
| List suppliers (tenant) | ✅ | ✅ | ✅ | ✅ |
| Search catalog (tenant) | ✅ | ✅ | ✅ | ✅ |
| Lookup by barcode | ✅ | ✅ | ✅ | ✅ |
| Execute import | ✅ | ✅ | ❌ | ❌ |
| Update sync mode | ✅ | ✅ | ❌ | ❌ |
| Unlink mapping | ✅ | ✅ | ❌ | ❌ |
| List mappings | ✅ | ✅ | ✅ | ✅ |

---

## Relationship to Existing Scan Enrichment

The platform already had `BarcodeEnrichmentService` for reactive single-barcode lookups. The supplier catalog integration is the proactive bulk counterpart:

| Aspect | Scan Enrichment (existing) | Supplier Catalog (new) |
|--------|---------------------------|------------------------|
| Trigger | Reactive — merchant scans one barcode | Proactive — system pre-fetches catalogs |
| Scope | Single product lookup | Bulk browse/search across millions |
| Storage | `barcode_enrichment` (cache) | `supplier_catalog_item` (persistent) |
| Use case | Enrich existing inventory item | Discover and import new products |

**Reuse:** Open Food Facts and UPC Database connectors reuse field mappings from `BarcodeEnrichmentService`. Rate limiting infrastructure (500 req/hour) is shared.

---

## Pattern: Quarantine as DLQ

The `catalog_quarantine` table functions as a dead letter queue for bad import rows. This pattern is used throughout the platform (e.g., badge analytics, CRM).

**Flow:**
1. `batchIngest` encounters a bad row (missing required fields or DB error)
2. Row is written to `catalog_quarantine` with `raw_payload`, `error_code`, `error_message`
3. Ingest continues with next row (no abort)
4. Admin views quarantined items via `GET /api/admin/suppliers/:id/quarantine`
5. Admin clicks "Replay" → `replayQuarantine` re-attempts ingestion
6. On success: `replayed_at` is set, item is in catalog
7. On failure: error message is updated, item remains unreplayed

**Key insight:** The replay endpoint re-runs the full `batchIngest` pipeline for the single row, so any validation or dedup logic is automatically applied. No separate replay code path.

---

## Pattern: Feature Flag Gating with Zero Regression

The `FF_SUPPLIER_CATALOG_IMPORT` flag gates the tenant-facing features. When disabled:
- `ItemCreationWizard` starts at Step 1 (Basic Information) as before — no catalog search step
- Tenant routes return 403 (flag required middleware)
- Admin routes work regardless (platform admin can always manage suppliers)

This means the feature can be deployed to production with zero impact on tenants that don't have the flag enabled. Pilot tenants get the feature, everyone else sees no change.

### Troubleshooting: `platform_disabled` Error

If tenant supplier routes return `400 { error: 'platform_disabled' }`, the flag is OFF at platform level with `allow_tenant_override=false` (or the flag row is missing from `platform_feature_flags_list` entirely). The resolution logic in `effectiveFlags.ts` blocks all tenant access when the platform flag is off and overrides aren't allowed.

**Quick fix (SQL):**
```sql
INSERT INTO platform_feature_flags_list (id, flag, enabled, allow_tenant_override, created_at, updated_at)
VALUES (gen_random_uuid(), 'FF_SUPPLIER_CATALOG_IMPORT', true, true, now(), now())
ON CONFLICT (flag) DO UPDATE SET enabled = true, allow_tenant_override = true, updated_at = now();
```

After running the SQL, either restart the API or wait 30s for the in-memory cache to expire. The admin API `PUT /api/admin/platform-flags/:flag` endpoint calls `invalidateEffectiveFlagCaches()` for immediate effect.

**Symptom:** The error appears on pages that call supplier endpoints, such as `/t/[tenantId]/settings/import-wizard` when it fetches `GET /api/tenants/:tenantId/suppliers`.

---

## Pattern: Built-in vs Custom Supplier Separation

Built-in suppliers (Open Food Facts, Open Beauty Facts, UPC Database) are seeded in the migration with `is_builtin = true`. Custom suppliers created by admins have `is_builtin = false`.

- Built-in suppliers **cannot be deleted if they have catalog items or mappings** (enforced in `SupplierService.deleteSupplier`)
- Built-in suppliers **can be deleted when empty** (0 catalog items + 0 mappings) — allows cleanup of unused built-in suppliers
- Custom suppliers can always be deleted
- Built-in suppliers have pre-configured connectors in `SupplierConnectors.ts`
- Custom suppliers use the generic CSV connector (`supplier-csv-sync.ts`)
- The `is_builtin` flag drives UI behavior (badge display, delete button visibility)

---

## Navigation Links

All supplier nav links follow the database navigation system pattern (see `.devin/skills/database-navigation-system.md`):

| Nav ID | Label | Route | Target | Migration |
|--------|-------|-------|--------|-----------|
| `nav-admin-suppliers` | Suppliers | `/settings/admin/suppliers` | admin | 071 |
| `nav-admin-supplier-health` | Supplier Health | `/settings/admin/suppliers/health` | admin | 073 |
| `nav-tenant-import-wizard` | Import Wizard | `/t/[tenantId]/settings/import-wizard` | tenant | 072 |
| `nav-tenant-supplier-mappings` | Supplier Mappings | `/t/[tenantId]/settings/supplier-mappings` | tenant | 072 |

Each migration is idempotent (WHERE NOT EXISTS) and updates the parent's `childrenKeys` array.

---

## Key Files Reference

### Backend
- `apps/api/src/services/SupplierService.ts` — Admin CRUD + health metrics
- `apps/api/src/services/SupplierCatalogService.ts` — Batch ingest, search, quarantine
- `apps/api/src/services/SupplierImportService.ts` — Tenant import orchestration
- `apps/api/src/services/SupplierConnectors.ts` — Open-source API connectors
- `apps/api/src/routes/admin/suppliers.ts` — Admin API routes
- `apps/api/src/routes/tenant/suppliers.ts` — Tenant API routes
- `apps/api/src/jobs/supplier-csv-sync.ts` — CSV connector worker
- `apps/api/src/jobs/supplier-opensource-sync.ts` — OFF/OBF sync jobs
- `apps/api/src/jobs/supplier-auto-sync.ts` — Auto-sync for manual→auto mappings
- `apps/api/src/services/SingleProductService.ts` — Field merge in `applySupplierFieldMerge`
- `apps/api/src/index.ts` — Job startup wiring (lines ~8243-8268)
- `apps/api/prisma/schema.prisma` — Models: `supplier`, `supplier_catalog_item`, `supplier_mapping`, `catalog_quarantine`

### Frontend
- `apps/web/src/services/SupplierService.ts` — Admin API singleton
- `apps/web/src/services/SupplierImportService.ts` — Tenant API singleton
- `apps/web/src/admin/components/SupplierManagement.tsx` — Admin CRUD UI
- `apps/web/src/admin/components/SupplierHealthDashboard.tsx` — Health dashboard
- `apps/web/src/admin/components/SupplierCatalogBrowser.tsx` — Catalog browser
- `apps/web/src/components/supplier/ImportWizard.tsx` — Bulk import wizard
- `apps/web/src/components/supplier/SupplierMappings.tsx` — Mapping management
- `apps/web/src/components/inventory/wizards/steps/CatalogSearchStep.tsx` — Wizard Step 0
- `apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx` — Wizard integration

### Database
- `database/migrations/070_supplier_catalog_integration.sql` — Schema + seed
- `database/migrations/071_nav_supplier_management.sql` — Admin nav
- `database/migrations/072_nav_import_wizard_supplier_mappings.sql` — Tenant nav
- `database/migrations/073_nav_supplier_health.sql` — Health dashboard nav
- `database/migrations/077_supplier_dedup_cleanup.sql` — Duplicate supplier cleanup

### Config
- `docs/feature-flags/registry.yaml` — `FF_SUPPLIER_CATALOG_IMPORT` flag
- `docs/SUPPLIER_CATALOG_SPRINT_PLAN.md` — Full sprint plan

---

## Lessons Learned

1. **Route ordering matters in Express.** `GET /health/dashboard` must be declared before `GET /:id`, otherwise Express matches `health` as the `id` parameter. Always place specific static routes before parameterized routes.

2. **Quarantine replay should re-run the full pipeline.** Instead of writing a separate replay code path, `replayQuarantine` calls `batchIngest` with the single row. This ensures all validation, dedup, and error handling logic is automatically applied to replays.

3. **Feature flag gating with zero regression requires conditional step insertion.** The `ItemCreationWizard` conditionally includes `CatalogSearchStep` as Step 0 only when the flag is enabled. When disabled, the wizard starts at Step 1 exactly as before — no code path changes, no UI changes for non-pilot tenants.

4. **Built-in suppliers need protection.** The `is_builtin` flag prevents deletion of seeded suppliers. This is enforced in the service layer (`deleteSupplier` throws if `is_builtin`), not just in the UI. Defense in depth.

5. **Field merge read order must be explicit.** The read order `merchant.overrides → inventory_items → supplier_catalog_item` ensures merchant data always wins for price/stock, supplier data wins for brand/GTIN (locked), and title/image have nuanced rules. Document this in the service method, not just in the sprint plan.

6. **Scheduled jobs need startup delays.** All supplier jobs use 5-10 minute startup delays to avoid firing during nodemon restarts or deployment cycles. The env var disable switches (`DISABLE_SUPPLIER_*_SYNC`) provide a kill switch for debugging.

7. **Health dashboard route before parameterized route.** The `/health/dashboard` endpoint aggregates across all suppliers. It must be declared before `/:id` in the Express router, or it will be interpreted as "get supplier with id=health".

8. **Frontend service types must match backend return types.** When upgrading `replayQuarantine` from returning the quarantined item to returning `{ success, error }`, both the backend route response and the frontend service method signature needed updating in lockstep.

9. **Seed IDs must match connector IDs exactly.** Migration 070 seeded suppliers with IDs like `supplier-off-open-food-facts`, but the connectors and sync job used `supplier-open-food-facts` (missing the `off-` prefix). The sync job's `ensureSupplierExists()` upsert created duplicate supplier records with the wrong IDs. Always verify that hardcoded IDs in connectors/jobs match the migration seed IDs exactly. Migration 077 was created to clean up the duplicates.
