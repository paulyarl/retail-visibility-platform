# 🧩 Supplier Catalog Integration Interface & Database Patch — v2.6
**Date:** 2025-10-19  
**Owner:** Retail Spec & Outreach GPT  
**Status:** Spec Patch → Ready for Build  

---

## 1. Integration Architecture Overview
```
[Supplier Feeds/APIs (CSV, API, SFTP)]
          │
          ▼
[Connector Workers] ──► [Normalization/Schema Mapper] ──► [Supplier Catalog Store]
          │
          └─► [Import Service] ◄── [Assisted Import Wizard (Admin UI)]
                                   │   - Search/Filter supplier catalog
                                   │   - Select SKUs & set price/stock
                                   │   - Preview images/attributes
                                   ▼
                           [Inventory Upsert Layer]
                                   │
                                   └─► [Tenant Inventory DB + Mapping Tables]
                                              │
                                              └─► Feeds/Google Sync/Analytics
```

---

## 2. Data Model Integration

### Extended Tables
```sql
CREATE TABLE supplier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  connection_type TEXT CHECK (connection_type IN ('API','CSV','SFTP')) NOT NULL,
  api_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE supplier_catalog_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier(id),
  supplier_sku TEXT NOT NULL,
  name TEXT,
  brand TEXT,
  gtin TEXT,
  category TEXT,
  image_url TEXT,
  attrs JSONB DEFAULT '{}'::jsonb,
  currency TEXT DEFAULT 'USD',
  msrp DECIMAL(10,2),
  content_hash TEXT,
  availability TEXT,
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (supplier_id, supplier_sku)
);

CREATE TABLE supplier_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id),
  supplier_id UUID NOT NULL REFERENCES supplier(id),
  supplier_sku TEXT NOT NULL,
  inventory_item_id UUID REFERENCES inventoryitem(id),
  last_sync TIMESTAMP,
  sync_mode TEXT CHECK (sync_mode IN ('manual','auto')) DEFAULT 'manual',
  UNIQUE (tenant_id, supplier_id, supplier_sku)
);

ALTER TABLE inventoryitem
  ADD COLUMN source_type TEXT DEFAULT 'manual',
  ADD COLUMN supplier_catalog_item_id UUID REFERENCES supplier_catalog_item(id),
  ADD COLUMN overrides JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN last_supplier_sync TIMESTAMP;
```

### Indexes
```sql
CREATE INDEX idx_supplier_catalog_item_supplier ON supplier_catalog_item (supplier_id, supplier_sku);
CREATE INDEX idx_supplier_catalog_item_gtin ON supplier_catalog_item (gtin);
CREATE INDEX idx_supplier_mapping_tenant_supplier ON supplier_mapping (tenant_id, supplier_id);
```

---

## 3. Field Merge & Precedence Rules
| Field | Source of Truth | Notes |
|------|------------------|-------|
| Price | Merchant override | Supplier MSRP for reference only. |
| Stock | Merchant | POS/local authority only. |
| Title | Supplier → unless merchant override | Name from supplier unless customized. |
| Brand/GTIN | Supplier | Canonical identifiers; locked by default. |
| Image | Supplier preferred | Merchant override allowed. |
| Category | Supplier normalized | Merchant may refine category. |

**Read Order:** merchant.overrides → inventoryitem → supplier_catalog_item

---

## 4. Idempotency & Deduplication
- **Key:** `supplier_id + supplier_sku + content_hash`
- **Dedup Basis:** `gtin` or fuzzy match (brand + normalized_name ≥ 0.92)
- **Safeguards:** Prevent overwrite of merchant price/stock; warn on GTIN changes.

---

## 5. API Contracts

### Connector → Catalog Store
```
POST /api/supplier/{supplierId}/catalog/batch
Body: { items: [{ supplier_sku, name, brand, gtin, msrp, image_url, attrs, availability, updated_at, content_hash }] }
Response: { accepted: N, skipped: M, errors: [...], nextCursor? }
Auth: Service token
```

### UI → Import Service
```
POST /api/tenant/{tenantId}/import
Body: {
  supplierId: "...",
  selections: [{ supplierSku: "12345", price: 2.99, stock: 30, overrides: { name?: "...", image_url?: "..." } }],
  syncMode: "manual" | "auto"
}
Response: { created: [...], mapped: [...], warnings: [...] }
Auth: Tenant user (Admin/Staff)
```

---

## 6. Assisted Import Wizard UX
**Features:**
- Supplier picker, catalog search/filter
- Bulk select with image preview
- Inline edit: price/stock/overrides
- Validation: price >0, stock ≥0
- Import summary with conflict report

**States:** `Can import` • `Already in catalog` • `GTIN conflict` • `Discontinued`

---

## 7. Sync Strategies
- Full catalog backfill (CSV/API pagination)
- Incremental syncs via `updated_at` or ETag
- Nightly full refresh, hourly incremental (per SLA)
- Auto mode: push name/image updates, never price/stock

---

## 8. Error Handling & Observability
- Exponential backoff on API errors
- Row-level quarantine for bad imports
- Metrics: success %, dedup %, GTIN coverage %, latency
- Audit triggers on all writes

---

## 9. Security & RBAC
| Role | Capability |
|------|------------|
| Admin | Link suppliers, imports, sync settings |
| Staff | Run imports, edit price/stock |
| Viewer | Read-only |
| Platform Admin | Manage suppliers, credentials, logs |

All tokens in Vault/KMS; RLS enforces tenant isolation.

---

## 10. Upsert Logic
```ts
for (sel of selections) {
  const cat = getSupplierCatalogItem(supplierId, sel.supplierSku);
  const existing = findExistingItem(tenantId, cat.gtin) || findBySupplierMapping(tenantId, supplierId, sel.supplierSku);

  const base = { name: cat.name, brand: cat.brand, gtin: cat.gtin, image_url: cat.image_url, category: mapCategory(cat.category), source_type: 'supplier', supplier_catalog_item_id: cat.id };

  const final = applyOverrides(base, sel.overrides);
  final.price = sel.price; final.stock = sel.stock;

  if (!existing) insertInventoryItem(tenantId, final);
  else updateInventoryItem(existing.id, safeMerge(existing, final));

  upsertMapping(tenantId, supplierId, sel.supplierSku, existing?.id || newId, now(), sel.syncMode);
  emitDomainEvent('inventory.upserted_from_supplier', {...});
}
```

---

## 11. Downstream Integrations
- Google Sync: auto-triggers via domain_events
- Analytics: track SKU source performance
- POS Adapters: maintain POS as stock authority

---

## 12. Migration Plan
1. Apply DB migrations
2. Backfill `source_type='manual'`
3. Deploy connector workers & API endpoints
4. Enable feature flag for pilot tenants
5. QA dedup + override logic

---

## 13. Expected Outcomes
| Metric | Baseline | Target |
|---------|-----------|--------|
| Onboarding Time | 4–6 hrs | <1 hr |
| Data Completeness | ~70% | ≥95% |
| Photo Coverage | ~80% manual | 100% from catalogs |
| Data Errors | 15% | <3% |
| NPS | 7 | 9+ |

---

## 14. Next Steps
- Build CSV connector + Import Service prototype
- Integrate Wizard for pilot stores (GreenMart, Sunrise, Hilltop)
- Monitor metrics & refine thresholds

**Deliverable:** Supplier Catalog Integration Patch for MasterSpec v2.6  
**Status:** Ready for development handoff



---

## 🚧 Gap Closure Patch v2.6b — Added Requirements & Schema Deltas (2025-10-19)

### New Requirements (Appended to EnhancementQueue)
```yaml
- id: REQ-2025-406
  type: data
  title: Product Variant Model & Bundles
  desc: Add first-class variant (size/uom/pack) and bundle support with parent-child SKU relations.
  status: proposed
  acceptance:
    - Variants selectable in import wizard.
    - Bundles link ≥2 inventory items with quantity per component.

- id: REQ-2025-407
  type: compliance
  title: Supplier License Registry & Enforcement
  desc: Store license terms (territory, scope, expiry) and block ingestion when invalid.
  status: proposed
  acceptance:
    - Ingestion fails closed if license expired.
    - Admin dashboard shows days-to-expiry alerts.

- id: REQ-2025-408
  type: reliability
  title: Error Taxonomy, DLQ & Replay
  desc: Standardize error codes; add DLQ and replay endpoints for failed batches.
  status: proposed
  acceptance:
    - All failures tagged with code & severity.
    - Replay restores ≥95% of quarantined rows in tests.

- id: REQ-2025-409
  type: performance
  title: Catalog Scale & SLA
  desc: Partition large supplier tables; define throughput/latency SLOs.
  status: proposed
  acceptance:
    - P95 nightly import < 15 min for 50k items.
    - Partitioning reduces write amplification (observed <1.2x).

- id: REQ-2025-410
  type: ux
  title: Bulk Pricing Rules & Safe Rollback
  desc: Bulk transforms (margin %, rounding) and one-click rollback of last import.
  status: proposed
  acceptance:
    - Bulk update preview before commit.
    - Rollback completes < 2 min for 5k items.

- id: REQ-2025-411
  type: governance
  title: Taxonomy & Mapping Versioning
  desc: Version controlled category mappings with audit trail and approval workflow.
  status: proposed
  acceptance:
    - All mapping changes logged with version and actor.
    - UI prevents imports against unapproved mappings.

- id: REQ-2025-412
  type: intl
  title: Multi-currency & Localization Fields
  desc: Currency conversion pipeline and optional localized names/attrs.
  status: proposed
  acceptance:
    - Prices display in tenant currency with daily rate sync.
    - Locale fields included in feeds when present.

- id: REQ-2025-413
  type: security
  title: Key Rotation & Scope Policy
  desc: 90-day rotation, per-supplier scoped credentials, key-use telemetry.
  status: proposed
  acceptance:
    - Rotation logfile & alerts.
    - Connector calls fail if stale key > 95 days.

- id: REQ-2025-414
  type: ops
  title: Supplier Health Dashboard & Alerts
  desc: Uptime, error rate, freshness lag with thresholds and paging alerts.
  status: proposed
  acceptance:
    - Alerts on freshness lag > 24h.
    - Weekly report export (CSV/PDF).
```

### Schema Deltas (to append to migration bundle)
```sql
-- Variants & Bundles
ALTER TABLE inventoryitem ADD COLUMN parent_item_id UUID REFERENCES inventoryitem(id);
CREATE TABLE bundle_component (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_item_id UUID NOT NULL REFERENCES inventoryitem(id),
  component_item_id UUID NOT NULL REFERENCES inventoryitem(id),
  qty NUMERIC(10,2) NOT NULL DEFAULT 1
);

-- Taxonomy & Mapping
CREATE TABLE product_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE supplier_category_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier(id),
  supplier_category TEXT NOT NULL,
  taxonomy_id UUID NOT NULL REFERENCES product_taxonomy(id),
  version TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT now()
);

-- Licensing & Enforcement
CREATE TABLE supplier_license (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier(id),
  scope TEXT,
  valid_from DATE,
  valid_to DATE,
  terms_url TEXT,
  status TEXT CHECK (status IN ('active','expired','revoked')) DEFAULT 'active'
);

-- DLQ / Quarantine
CREATE TABLE catalog_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier(id),
  raw_payload JSONB NOT NULL,
  error_code TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low','medium','high','critical')) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  replayed_at TIMESTAMP
);
```

### Policies & Operations
- **Source-of-Truth Matrix (per tenant):** store in `tenant_settings.inventory_policy` JSON → fields: `price_source`, `stock_source`, `precedence`.
- **Key Rotation:** scheduled job (90-day cadence) + alert if key age > 95 days.
- **SLOs:** nightly imports P95 < 15 min (50k SKUs), hourly incrementals P95 < 3 min; freshness lag alert > 24h.

### QA & Testing Additions
- Golden datasets (missing GTIN, duplicate names, variant packs, discontinued SKUs).
- Property-based tests for normalization & identity matching.

**Changelog Note:** v2.6b adds governance, performance, licensing, and recovery controls on top of v2.6.

