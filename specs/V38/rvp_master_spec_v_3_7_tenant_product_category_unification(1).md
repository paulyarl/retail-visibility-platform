# 🧭 Retail Visibility Platform — Master Spec v3.7 (Tenant & Product Category Unification)
**Editor:** Retail Spec & Outreach GPT  
**Status:** Draft → Implementation Prep  
**Date:** 2025-11-01  

---

## 0) Executive Summary
This version consolidates the **Tenant Category System** and **Product Category Alignment Framework** into a unified architectural layer. The goal is to enable full-spectrum category governance across the Retail Visibility Platform — empowering both **business owners** (tenants) and **platform operators** to organize, align, and synchronize data seamlessly with Google’s surfaces (SWIS, GBP, Merchant Center).

### Objectives
1. Harmonize **Tenant (Business)** and **Product (SKU)** categories under a shared Category Framework.
2. Extend the category context to the **platform sidebar**, ensuring contextual discovery and navigation.
3. Provide **mirroring and validation workflows** between Platform Categories ↔ Google Business Profile Categories.
4. Reinforce parity across **data model, API, UX, telemetry, and observability layers**.

---

## 1) System Architecture Overview
```yaml
modules:
  tenant_category: platform organization, GBP sync
  product_category: SKU taxonomy alignment, SWIS readiness
  shared_category_framework: unified validation, telemetry, and schema consistency
  ui_shell: context-aware sidebar, alignment drawer, mirror toggle
  observability: metrics, logs, dashboards for both category layers
integrations:
  google_business_profile: primary/secondary categories sync
  google_merchant: feed validation + product taxonomy alignment
```

### Core Architecture Principles
- **Single Category Framework** shared between tenant and product layers.
- **Idempotent mappings** with schema versioning and rollback capabilities.
- **Unified telemetry model** (both layers emit mapping events to one pipeline).
- **Feature flag lifecycle management** (shared registry with owner + expiry metadata).

---

## 2) Functional Specification

### 2.1 Unified Category Framework
| ID | Type | Description | Acceptance |
|---|---|---|---|
| REQ-2026-201 | Functional | Provide shared interfaces for category CRUD, mapping validation, and audit logging. | Implement shared `CategoryService` for both tenants and SKUs. |
| REQ-2026-202 | Functional | Maintain versioned taxonomy (Google Product Taxonomy + GBP Directory). | Versioned sync via worker, cache TTL 24h. |
| REQ-2026-203 | Functional | Unified validation logic for both product and tenant category assignments. | Validation API returns structured error codes and stale indicators. |
| REQ-2026-204 | Functional | Support cross-category analytics (tenants and SKUs grouped by platform categories). | Reports and filters available in admin dashboard. |
| REQ-2026-205 | Security | Enforce RLS for tenant assignments; admin-only catalog modifications. | Verified by automated integration tests. |

### 2.2 Sidebar Contextual UX Integration
| ID | Type | Description | Acceptance |
|---|---|---|---|
| REQ-2026-206 | UX | Sidebar displays both tenant and product categories contextually. | Sidebar updates dynamically when switching between tenant and SKU routes. |
| REQ-2026-207 | UX | Category chips appear under tenant header with GBP sync status. | Tooltip shows mirrored or manual sync info. |
| REQ-2026-208 | UX | SKU pages show product category hierarchy with validation state. | Visual cues for mapped/unmapped/stale. |
| REQ-2026-209 | UX | Admin view includes category filter and metrics panel. | Filters tenants by platform category in real-time. |

### 2.3 GBP Integration
| ID | Type | Description | Acceptance |
|---|---|---|---|
| REQ-2026-210 | Functional | GBP sync mirrors tenant categories to primary + additional categories. | Verified via API audit log and success metrics. |
| REQ-2026-211 | Functional | Out-of-sync detection between platform and GBP categories. | System emits telemetry `gbp.sync.out_of_sync_detected`. |
| REQ-2026-212 | Functional | Sync retries with exponential backoff. | Job completes after ≤6 attempts or manual resolution. |

### 2.4 Product Feed Integration
| ID | Type | Description | Acceptance |
|---|---|---|---|
| REQ-2026-213 | Functional | Product categories enforce precheck before feed push. | Unmapped SKUs blocked from SWIS feed when enforce=true. |
| REQ-2026-214 | Functional | Display validation badges in SKU editor. | UI reflects category state changes within 1s. |

---

## 3) Technical Implementation

### 3.1 Data Model
```sql
-- Shared Framework Tables
CREATE TABLE IF NOT EXISTS category_taxonomy_version (
  id serial PRIMARY KEY,
  source text NOT NULL, -- google_product_taxonomy | gbp_directory
  version_label text NOT NULL,
  last_synced timestamptz DEFAULT now()
);

-- Platform Tenant Categories
CREATE TABLE IF NOT EXISTS platform_tenant_category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  parent_id uuid REFERENCES platform_tenant_category(id) ON DELETE SET NULL,
  gbp_key text,
  visibility text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tenant Assignment
CREATE TABLE IF NOT EXISTS tenant_category_assignment (
  tenant_id uuid REFERENCES tenant(id) ON DELETE CASCADE,
  category_id uuid REFERENCES platform_tenant_category(id) ON DELETE RESTRICT,
  is_primary boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, category_id)
);

-- Product Category Mapping
CREATE TABLE IF NOT EXISTS product_category_mapping (
  tenant_id uuid REFERENCES tenant(id) ON DELETE CASCADE,
  sku text,
  google_category_id text,
  is_stale boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, sku)
);

-- GBP Category Sync Jobs
CREATE TABLE IF NOT EXISTS gbp_category_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_status text CHECK (job_status IN ('queued','processing','success','failed')) DEFAULT 'queued',
  attempt int DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now()
);
```

### 3.2 API Contracts
```yaml
GET /tenant/context/category
→ {tenant_id, platform_category_label, gbp_category_label, sync_state}

GET /sku/{sku}/category
→ {sku, product_category_path, validation_state}

POST /tenant/gbp/category/mirror
→ {strategy: 'from_platform'}

POST /category/validate
→ {context: 'tenant'|'product', id, version} → {valid: boolean, errors: [], stale: boolean}
```

### 3.3 Jobs & Backoff
| Job | Description | Retry Policy |
|---|---|---|
| gbp_category_sync_jobs | Mirror categories to GBP via API | 1m → 5m → 15m → 1h → 6h |
| taxonomy_refresh_job | Refresh taxonomy versions (Google Product + GBP Directory) | Daily at 03:00 UTC |

### 3.4 Feature Flags
```yaml
FF_TENANT_PLATFORM_CATEGORY: pilot
FF_TENANT_GBP_CATEGORY_SYNC: pilot
FF_CATEGORY_MIRRORING: off → per-tenant rollout
FF_PRODUCT_CATEGORY_ALIGNMENT: active
FF_CATEGORY_UNIFICATION: staged rollout v3.7
```

### 3.5 Observability
- **Metrics:** `gbp_sync_success_rate`, `taxonomy_stale_count`, `mapping_latency_p95`.  
- **Logs:** structured with tenant_id, sku, category_id, action.  
- **Dashboards:** unified tile for Tenant + Product category states.  
- **Synthetic tests:** hourly validation of mirror + precheck APIs.

---

## 4) UI Design Overview
### 4.1 Shell Sidebar Integration
- Tenant header includes category chips with GBP sync status.
- SKU view replaces chips with product category hierarchy.
- Category Drawer opens inline from sidebar (Alt+Shift+C shortcut).

### 4.2 Component Summary
| Component | Purpose | Shared? |
|---|---|---|
| `CategoryPicker` | Single/multi-select for platform + GBP categories | ✅ |
| `MirrorToggle` | Enables GBP mirroring | ✅ |
| `SyncStateBadge` | Displays mirrored/manual/out-of-sync | ✅ |
| `DiffPanel` | Compares platform ↔ GBP state | ✅ |

### 4.3 Performance Targets
- Sidebar context load ≤ 150ms P95.  
- Drawer open latency ≤ 200ms.  
- Keyboard traversal full flow without traps.  
- Lighthouse Accessibility ≥ 95.

---

## 5) QA & Rollout
### 5.1 QA Matrix
| Test | Description | Type |
|---|---|---|
| Mirror Workflow | Toggle mirror, sync GBP, verify success | E2E |
| Sidebar Category Context | Switch tenant→SKU view, ensure correct chips | UI |
| API Validation | Simulate stale taxonomy, validate error code | Integration |
| RLS Enforcement | Tenant cannot modify catalog | Security |
| A11y | AXE/NVDA keyboard traversal | Accessibility |

### 5.2 Rollout Phases
1. **Schema + API Launch:** Enable catalog tables, validation API.  
2. **UI Integration:** Tenant + SKU sidebar categories behind flags.  
3. **GBP Sync Pilot:** Small tenant cohort; monitor success ≥95%.  
4. **Category Unification Flag On:** Platform-wide activation post-QA.

---

## 6) Changelog
| Date | Version | Notes |
|---|---|---|
| 2025-11-01 | v3.7 | Introduced unified Category Framework, sidebar integration, GBP mirror system, and taxonomy refresh logic. |



---

## 📘 Technical Appendix — v3.7 Unified SQL Pack (Tenant & Product Category)
**Source:** `/mnt/data/rvp_v3_7_sql_pack_combined.md`

```markdown
# RVP v3.7 — Data Migration & SQL Pack
**Generated:** 2025-11-01T12:00:00

This pack implements the **Tenant & Product Category Unification** for v3.7.

## Contents (apply in order)
1. `V3_7_001_prereqs_functions_enums.sql`
2. `V3_7_002_tables_core.sql`
3. `V3_7_003_indexes_constraints.sql`
4. `V3_7_004_rls_policies.sql`
5. `V3_7_005_seed_taxonomy_version.sql`
6. `V3_7_006_jobs_and_scheduling.sql`
7. `V3_7_100_backfill_examples.sql` (optional)
8. `V3_7_900_rollback.sql`

> All scripts are **idempotent** where possible. Use transactions in staging; use concurrent index creation in production.

---

## V3_7_001_PREREQS_FUNCTIONS_ENUMS
```sql
-- 1) touch_updated_at() helper
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'touch_updated_at' AND n.nspname = 'public'
  ) THEN
    CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at := now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Enums: tenant_category_visibility, job_status
```

---

## V3_7_002_TABLES_CORE
```sql
-- Core Tables: category_taxonomy_version, platform_tenant_category, tenant_category_assignment,
-- product_category_mapping, tenant_gbp_category, audit_log
```

---

## V3_7_003_INDEXES_CONSTRAINTS
```sql
-- Index and constraint definitions for category and mapping performance
```

---

## V3_7_004_RLS_POLICIES
```sql
-- RLS policies for tenant_category_assignment and tenant_gbp_category
```

---

## V3_7_005_SEED_TAXONOMY_VERSION
```sql
-- Seed initial taxonomy version entries for google_product_taxonomy and gbp_directory
```

---

## V3_7_006_JOBS_AND_SCHEDULING
```sql
-- GBP Category Sync Jobs table and placeholders for scheduled taxonomy refresh
```

---

## V3_7_100_BACKFILL_EXAMPLES
```sql
-- Examples: suggest platform categories from business profile data, mark stale mappings after taxonomy updates
```

---

## V3_7_900_ROLLBACK
```sql
-- Rollback procedure to safely remove v3.7 category unification artifacts while preserving audit_log
```
```

---

### ✅ Deployment Note
Integrate the SQL pack with the Master Spec release pipeline:
1. Apply sequentially in staging.
2. Validate RLS enforcement and audit logs.
3. Verify dashboards for `gbp_sync_success_rate` and `taxonomy_stale_count` post-deploy.
4. Flip feature flag `FF_CATEGORY_UNIFICATION=true` after QA confirmation.



---

# 📦 SKU Scanning Module — v3.8‑pre (Incorporating User Context)
**Status:** Scoped → Implementation Prep  
**Goal:** Fast, accurate SKU creation via barcode scanning with enrichment, validation, and bulk workflows; parity with platform category framework.

## 1) Why This Matters
- **Speed:** Scan → auto‑populate core fields.
- **Accuracy:** Eliminate UPC/EAN typos; duplicate detection.
- **UX:** POS‑like feel with mobile-first flows.
- **Bulk:** Rapid shelf‑to‑catalog entry.
- **In‑store:** Works on the floor via phone camera or USB scanner.

## 2) Requirements
| ID | Type | Description | Acceptance |
|---|---|---|---|
| REQ‑SCN‑001 | Functional | Support **camera** and **USB scanner (keyboard wedge)** inputs. | Camera scan succeeds on iOS/Android + desktop webcams; USB scans captured in text input with Enter commit. |
| REQ‑SCN‑002 | Functional | Enrich product data from external sources and cache results. | ≥80% enrichment hit on common CPG barcodes in pilot; cache hit ratio ≥60% after week 1. |
| REQ‑SCN‑003 | Functional | Validate against SWIS schema & product category precheck. | Block commit on missing required fields when enforce=true. |
| REQ‑SCN‑004 | Functional | **Bulk scan mode** for rapid multi‑item capture. | 50 SKUs in ≤20 minutes target on mid-range phone. |
| REQ‑SCN‑005 | Security | RLS isolation for scan sessions/results. | Cross‑tenant access returns 403; audit logs present. |
| REQ‑SCN‑006 | Observability | Metrics for scan success, enrichment hit, validation error, duplicates. | Dashboards & alerts configured. |
| REQ‑SCN‑007 | UX | Three entry modes: Manual, Scan, CSV Upload; POS‑like flow. | Keyboard-first; a11y passes AXE (0 critical). |
| REQ‑SCN‑008 | Perf | Camera preview ≤150ms to first frame; decode ≤500ms p95. | Measured on recent mobile devices. |

## 3) Tiers & Feature Flags
```yaml
# Commercial tiers mapped to flags/limits
FF_SKU_SCANNING: {tier: Starter↑, default: off}
FF_SKU_ENRICHMENT_ENGINE: {Starter: 100 lookups/mo, Pro: unlimited, Enterprise: custom DB}
FF_SKU_DUPLICATE_CHECK: true
FF_SKU_BATCH_MODE: {Pro+: true}
FF_USB_SCANNER: {Pro+: true}
FF_CAMERA_SCANNER: {Starter+: true}
rate_limits:
  enrichment_requests_per_month:
    GoogleOnly: 0
    Starter: 100
    Pro: -1
    Enterprise: -1
```

## 4) Input Methods (A/B/C)
- **A) Camera‑based** (mobile/desktop): WebRTC with **@zxing/library** or **quagga2** (choose ZXing by default for better maintenance).  
- **B) USB barcode scanner**: keyboard wedge; focus on hidden input, capture until Enter; debounce & EAN/UPC checksum validation.  
- **C) Both**: auto‑detect capability; gracefully fallback to manual entry.

## 5) Data Model (DB)
```sql
-- Sessions
CREATE TABLE IF NOT EXISTS sku_scan_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenant(id) ON DELETE CASCADE,
  user_id uuid,
  status text CHECK (status IN ('pending','processed','failed')) DEFAULT 'pending',
  device text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Results
CREATE TABLE IF NOT EXISTS sku_scan_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_session_id uuid REFERENCES sku_scan_session(id) ON DELETE CASCADE,
  barcode text,
  format text,
  resolved_product jsonb,
  enrichment_source text,
  validation_state text,
  validation_errors jsonb,
  created_inventory_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Enrichment cache (product templates)
CREATE TABLE IF NOT EXISTS product_template (
  barcode text PRIMARY KEY,
  name text,
  brand text,
  category_hint text,
  description text,
  images text[],
  msrp numeric(12,2),
  updated_at timestamptz DEFAULT now()
);

-- Lookup log + rate limiting
CREATE TABLE IF NOT EXISTS barcode_lookup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  barcode text,
  source text,
  status text,
  latency_ms int,
  created_at timestamptz DEFAULT now()
);
```

**Indexes & Constraints**
- Unique `(tenant_id, barcode)` guard at inventory layer; bloom filter in Redis for fast pre‑check.
- Partial index on `sku_scan_result(validation_state)` for triage.

## 6) API Contracts
```yaml
POST /tenant/{tenant_id}/sku/scan               # start a scan (camera/upload/manual)
GET  /tenant/{tenant_id}/sku/scan/{session}/results
POST /tenant/{tenant_id}/sku/scan/{session}/commit
GET  /products/lookup-barcode/{barcode}         # enrichment lookup (cached → external)
```

### Enrichment Lookup (Backend)
- Check **product_template** cache first.  
- Fall through to providers in order with timeouts + retries: 
  1) Open Product Facts  
  2) UPCitemdb (respect free limits)  
  3) Barcode Lookup  
- Normalize fields (title, brand, description, image URL), compute checksum for idempotency, store in cache.

## 7) UI/UX — Add Products (3 Modes)
```
[ Manual Entry ] [ Scan Barcode ] [ CSV Upload ]

┌ Camera Panel ┐         Or USB scanner input:
│  [Preview]   │         [___________] (type/scan → Enter)
└──────────────┘
✓ Scanned: 078000113464
📦 Coca‑Cola Classic 12oz Can
[ Edit Details ] [ Add Another ]
```
**Batch Review**: paginated list of scanned items; inline errors (missing price/category/image).

## 8) Validation & Category Suggestion
- Apply **SWIS schema** rules pre‑commit.  
- Suggest `google_product_category` from enrichment → re‑score using tenant’s platform category and brand hints.  
- If `FF_FEED_ALIGNMENT_ENFORCE=true` and category unmapped → block commit; open Alignment Drawer.

## 9) Duplicate Detection
- Fast path: Redis bloom filter for `(tenant_id, barcode)`; fall back to DB unique lookup.  
- UI shows **Duplicate** badge with link to existing SKU editor.

## 10) Observability & Alerts
**Metrics:** `scan_success_rate`, `enrichment_hit_rate`, `validation_error_rate`, `duplicate_detection_latency_ms`, `commit_success_rate`.  
**Alerts:** enrichment provider failure rate >10%; latency p95 > 1s; cache miss rate spike.

## 11) Security & Privacy
- Honor provider ToS; store only normalized product metadata; keep source attribution in cache.  
- RLS on session/result tables; audit `lookup` and `commit` events.  
- Camera permissions: HTTPS origin, visible permission prompts, fallbacks documented.

## 12) Rollout Phases
- **Phase 1 (Quick Win):** USB scanner + manual entry + basic lookup (100/mo per tenant).  
- **Phase 2 (Mobile):** Camera scanning, mobile UI, batch mode.  
- **Phase 3 (Advanced):** Custom product DB, barcode generation, scan‑driven inventory adjustments.

## 13) Acceptance Criteria
- 50 products captured in ≤20 minutes on mid‑tier phone.  
- Enrichment hit rate ≥70% in pilot categories (CPG/Beverage).  
- Validation prevents feed‑blocking errors before commit.  
- A11y: keyboard‑only flow passes; screen reader labels on camera and input controls.

## 14) Frontend Components (React Contracts)
```tsx
// BarcodeScanner
<BarcodeScanner onScan={(code) => handleScan(code)} provider="zxing" allowUsb={true} />

// BatchReview
<BatchReview results={results} onEdit={openEditor} onCommit={commitAll} />

// EnrichmentPreview
<EnrichmentPreview data={resolvedProduct} onAccept={fillForm} onRetry={retryLookup} />
```

## 15) Example Backend Route (Lookup)
```ts
GET /products/lookup-barcode/:barcode
→ checks cache → external APIs → cache-and-return
```

### Next Step
- Generate **v3.8 SQL + API stub pack** (idempotent, RLS) and link feature flags to tier limits in config registry.



---

## 🚀 v3.8 Addendum — SKU Scanning Module (Merged)
**Status:** Implementation-Ready  
**Summary:** Added camera + USB scanning, enrichment cache, validation & duplicate detection, batch review flow, and full SQL/API/UI stubs.

**Artifacts:**
- Combined Pack (Markdown): `/mnt/data/rvp_v3_8_sku_scanning_pack_combined.md`
- Release Doc: `/mnt/data/RVP_Master_Spec_v3_8_Release.md`

### Notes
- UI follows the scoped POS-like flow (Manual / Scan / CSV), with mobile-first camera scanning and keyboard wedge support.
- Enforcement aligns with product category precheck (`FF_FEED_ALIGNMENT_ENFORCE`).
- RLS enabled on scan tables; audit events emitted.

### Next Step
Promote **v3.8 Addendum** to release branch, run migrations, and enable `FF_SKU_SCANNING` for pilot tenants.

