# 🧭 MVP Scope Lock — Retail Visibility Platform v1.0 (Retrofitted with Gap Analysis & Patches)
**Date:** 2025-10-19  
**Owner:** Retail Spec & Outreach GPT  
**Status:** Locked + Retrofitted for Build Readiness  

---

## 1. Objective
Deliver a working MVP that allows small retailers to digitize inventory, upload SKUs (manual + CSV), capture images, sync to Google Merchant Center, and view basic analytics — within a 30-day execution window.

---

## 2. MVP Functional Scope
| Module | Description | Source Reqs | Status |
|--------|--------------|--------------|---------|
| **Auth & Tenant Setup** | Supabase Auth multi-tenant login and store creation. | REQ-2025-101 | Ready |
| **Inventory CRUD** | Basic SKU creation/edit/delete, price, stock, brand, category, description. | REQ-2025-201 | Ready |
| **Photo Capture & Compression** | Camera integration, image compression, offline queue, validation. | REQ-2025-301..305 | Ready |
| **Offline Sync** | Delta synchronization between local storage and Supabase backend. | REQ-2025-303 | Ready |
| **CSV Bulk Import (Lite)** | Simple upload + validation of local CSV for bulk SKU creation. | MINI-REQ-2025-01 | Planned |
| **Google OAuth & Feed Push** | Merchant Center connection, feed generation, push sync. | REQ-2025-601 | Ready |
| **Analytics Dashboard (Lite)** | Display 7-day impressions/clicks + sync status summary. | REQ-2025-701 | Ready |
| **Vendor Onboarding Flow** | Guided onboarding, store setup checklist, feedback form. | vendor_onboarding_mvp(v1.2) | Ready |

---

## 3. Out-of-Scope for MVP (Deferred to MasterSpec v2.6+)
| Module | Reason |
|--------|--------|
| Supplier Catalog Connectors (API/CSV/SFTP) | Post-MVP — complex normalization + licensing layer. |
| AI SKU Labeling & SEO Enhancements | Phase 3 (ARR Pathway). |
| POS Adapter Pilots (Square, Clover) | Post-MVP integrations. |
| Localization & Multi-Currency | Deferred to Global Readiness v2.5+. |
| Mobile App (Capacitor Hybrid) | Scheduled after web parity achieved. |

---

## 4. CSV Bulk Import (Lite) Mini-Spec

### Goal
Enable merchants to upload a spreadsheet (.csv) and create inventory records without needing supplier integration.

### Required Columns
| Column | Type | Description |
|---------|------|--------------|
| sku | string | Unique product SKU |
| name | string | Product name |
| price | decimal | Retail price (must be > 0) |
| stock | integer | Quantity in stock (≥ 0) |
| category | string | Product category |
| brand | string | Brand or manufacturer |
| image_url | string (optional) | Product image URL (validated <1MB) |

### Core Features
- CSV upload via dashboard file input.
- Client-side + server-side validation (type, format, semantics).
- Error file with downloadable CSV for failed rows.
- Optional retry flow: re-import only failed rows.
- Duplicate SKUs upserted by key (not duplicated).
- Preview table for user confirmation before import.
- Offline-safe: queued upload, sync on reconnect.
- Audit trail for each import (rows created, updated, failed).

### Example API Contract
```http
POST /api/import/csv
Content-Type: multipart/form-data
Body: { file: inventory.csv }
Response:
{
  created: 125,
  updated: 17,
  failed: 8,
  errors: [{ row: 24, reason: "missing price" }]
}
```

### Backend Schema Additions
```sql
CREATE TABLE csv_import_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant(id),
  filename TEXT,
  row_count INT,
  created INT,
  updated INT,
  failed INT,
  created_at TIMESTAMP DEFAULT now(),
  error_log JSONB
);
```

### Acceptance Criteria
- 1000-row CSV import in < 30 seconds.
- 95% data validation success on clean template.
- Safe upsert by SKU (no duplicates).
- Re-import of failed rows supported.
- Audit log persisted per tenant.
- UTF-8 encoding and RFC4180 compliance.

---

## 5. Functional Enhancements Added via Gap Analysis
```yaml
- id: REQ-2025-501
  type: reliability
  title: CSV Import Retry & Re-upload Flow
  desc: Allow merchants to re-import only failed rows via UI prompt.
  acceptance: [Retry available post-error CSV, audit logs updated, no duplicates.]

- id: REQ-2025-502
  type: functional
  title: Search & Bulk Edit in Inventory Dashboard
  desc: Add simple search box + bulk price/stock editor for better usability.
  acceptance: [Search by name/brand/SKU, select-all edit updates apply within 2s.]

- id: REQ-2025-503
  type: observability
  title: Feed Sync Logging & Metrics
  desc: Persist Google feed submission responses + sync success rate.
  acceptance: [Feed log table with response_code, sync_time, success %, per tenant.]

- id: REQ-2025-504
  type: analytics
  title: Store Metrics Table
  desc: Persist impressions, clicks, and feed success metrics for offline analytics.
  acceptance: [7-day rolling window metrics stored; dashboard averages computed.]

- id: REQ-2025-505
  type: qa
  title: Mid-Sprint QA Checkpoints
  desc: Enforce QA validation after week 2 (offline/photo/CSV flows).
  acceptance: [QA sign-off checklist logged by day 14.]
```

---

## 6. Implementation Sequence (30-Day Build Plan)
| Day | Task | Team |
|-----|------|------|
| 1–3 | Tenant Auth + Dashboard Shell | DevOps + Frontend |
| 4–10 | Inventory CRUD + Photo Capture | Full-stack |
| 11–14 | Offline Sync Layer + Mid-Sprint QA (REQ-2025-505) | Frontend + QA |
| 15–20 | CSV Bulk Import (Lite) + Retry Flow (REQ-2025-501) | Backend |
| 21–25 | Google OAuth + Feed Sync + Feed Log (REQ-2025-503) | DevOps |
| 26–28 | Analytics (REQ-2025-504) + Search/Bulk Edit (REQ-2025-502) | Full-stack |
| 29–30 | QA Final + Pilot Setup | Outreach + QA |

---

## 7. Operational & QA Additions
- Add **staging environment** by Day 24 for Google test feeds.
- Include **RLS test scripts** to verify tenant isolation.
- Implement **log monitoring** (Sentry/Logflare) for import/sync jobs.
- Run mid-sprint QA checkpoint for Offline, Photo, CSV, OAuth modules.
- Enforce **WCAG 2.1 AA** accessibility baseline for dashboard.

---

## 8. KPI Targets
| Metric | Target |
|---------|---------|
| Feed Success Rate | ≥90% |
| Import Validation Success | ≥95% |
| Data Completeness (Valid SKUs) | ≥90% |
| Pilot Store NPS | ≥7 |
| Feed Approval Lag | <24 hours |

---

## 9. Deliverables
- ✅ MVP Spec Snapshot (v1.0-Lock Retrofitted)
- ✅ CSV Import (Lite) + Retry + Validation Module
- ✅ Feed Log + Store Metrics tables for analytics
- ✅ Search + Bulk Edit MVP enhancements
- ✅ QA Checkpoint protocol added

---

## 10. Summary
This retrofit strengthens the MVP with validation, observability, and UX reliability. It remains achievable in the 30-day MVP window, but adds key governance and QA layers to ensure pilot-grade quality and data integrity.

**Next Step:** Generate developer bundle (SQL migrations, OpenAPI stubs, validation schema, UI upload component, and feed log metrics).

