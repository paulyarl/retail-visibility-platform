# Outreach + Pilot Tracker — v2.0

> Unified tracker for outreach, onboarding, and pilot validation across MVP, Google Integration, POS Adapters, Mobile Transition, and Global Readiness.

```yaml
version: 2.0
owner: Retail Spec & Outreach GPT
last_updated: 2025-10-19
timezone: America/Indiana/Indianapolis
id_schemes:
  outreach: OUTR-YYYY-NNN
  requirement: REQ-YYYY-NNN
  risk: RSK-YYYY-NNN
policies:
  - Never delete rows; only append or change Status with a dated note.
  - Each update must reference a date and actor (Initials) in the Notes column.
  - Do not create new store entries without a source (email, visit, message).
```

---

## 1) Portfolio Summary (Pilot KPIs)

| KPI | Target | Current | Notes |
|---|---:|---:|---|
| Pilot Stores (total) | 15 | 3 | Based on confirmed entries below |
| Stores with Google OAuth connected | ≥3 | 0 | Pending onboarding per store |
| Avg SKU count per pilot store | ≥20 | — | Compute after first uploads |
| Feed approval rate | ≥90% | — | Requires initial sync |
| Data sync success | ≥95% | — | From sync job logs |
| NPS (pilot satisfaction) | ≥7.0 | — | From Feedback form |
| Uptime (pilot window) | ≥99.5% | — | From monitoring dashboards |

> Next Step: After each store’s first upload + Google connect, update **Section 3** metrics and roll into this KPI card.

---

## 2) Outreach & Onboarding Log (Authoritative)

**Legend — Status:** `Planned` · `Contacted` · `Interested` · `Demo Scheduled` · `Onboarded` · `Live` · `Stalled` · `Closed`

| ID | Store Name | Contact | Status | Date Contacted | Next Step | Source | Notes |
|---|---|---|---|---|---|---|---|
| OUTR-2025-001 | GreenMart | +1 555-1234 | Interested | 2025-10-18 | Schedule demo | Pitch Kit table | Wants offline mode (PK: “offline mode”); assign demo slot |
| OUTR-2025-002 | Sunrise Grocery | +1 555-2345 | Contacted | 2025-10-19 | Await reply / propose weekend visit | Pitch Kit table | Owner prefers weekend visit |
| OUTR-2025-003 | Hilltop Market | +1 555-3456 | Onboarded | 2025-10-20 | Upload inventory (20–50 SKUs) | Pitch Kit table | Needs help with images |
| OUTR-2025-004 | — | — | Planned | — | — | Template | **Do not fill without a source** |
| OUTR-2025-005 | — | — | Planned | — | — | Template | **Do not fill without a source** |

> Governance: Only append rows with verifiable source (email thread, in‑person notes, SMS/WhatsApp screenshot, or call log).

---

## 3) Per‑Store Pilot Checklist (Operational Gate)

**Definition of “Live”:** Storefront public, ≥20 SKUs uploaded, Google OAuth connected, first feed approved, analytics visible.

### 3.1 GreenMart (OUTR-2025-001)
- [ ] Tenant created
- [ ] Admin user invited (Supabase Auth)
- [ ] Inventory upload ≥20 SKUs
- [ ] Photo QC (all <1MB, WebP/JPEG)
- [ ] Google OAuth completed (tokens vaulted)
- [ ] Feed approval ≥90%
- [ ] Analytics visible (7‑day impressions/clicks)
- [ ] Feedback form submitted (NPS)
- **Dependencies:** REQ‑2025‑301..305 (Photo, Compression, Offline, Signed Uploads, Validation)
- **Notes:** Requested offline mode priority.

### 3.2 Sunrise Grocery (OUTR-2025-002)
- [ ] Tenant created
- [ ] Admin user invited
- [ ] Inventory upload ≥20 SKUs
- [ ] Photo QC
- [ ] Google OAuth completed
- [ ] Feed approval ≥90%
- [ ] Analytics visible
- [ ] Feedback form submitted
- **Notes:** Preferred weekend visit.

### 3.3 Hilltop Market (OUTR-2025-003)
- [ ] Tenant created
- [ ] Admin user invited
- [ ] Inventory upload ≥20 SKUs
- [ ] Photo QC
- [ ] Google OAuth completed
- [ ] Feed approval ≥90%
- [ ] Analytics visible
- [ ] Feedback form submitted
- **Notes:** Needs image assistance; schedule capture session.

---

## 4) Pilot Metrics Register (per Store)

> Update after first sync; one row per store per week (rolling 4 weeks retained here; archive monthly).

| Store (ID) | Week Start (ISO) | SKUs Live | Google OAuth? | Feed Approval % | Impressions (7d) | Clicks (7d) | CTR % | Sync Success % | Incidents |
|---|---|---:|:---:|---:|---:|---:|---:|---:|---|
| GreenMart (OUTR-2025-001) | — | — | — | — | — | — | — | — | — |
| Sunrise Grocery (OUTR-2025-002) | — | — | — | — | — | — | — | — | — |
| Hilltop Market (OUTR-2025-003) | — | — | — | — | — | — | — | — | — |

---

## 5) Pilot Scope Mapping (Traceability)

| Pilot | Modules / Specs | Success Criteria | Owner |
|---|---|---|---|
| MVP Core | Inventory CRUD, Offline Sync, Public Storefront | Admin & storefront usable; queued sync working | PM/Architect |
| Google Integration | OAuth2, Product Sync, Analytics Pull | ≥95% sync success; ≥100 impressions/store | Backend Lead |
| Vendor Onboarding | CSV upload, Photo QC, Validation | ≥20 SKUs/store; approval ≥90% | Support Lead |
| POS Integration (Square, Clover, etc.) | API Adapters, ETL, Telemetry | <3m sync latency; uptime ≥99.5% | Integration Lead |
| Mobile Transition | Hybrid app parity, secure storage | Feature parity; device matrix passed | Mobile Lead |
| Global Readiness | i18n, latency, residency | Coverage ≥95%; P95 <250ms/region | DevOps |

---

## 6) Risks & Mitigations (Pilot Window)

| Risk ID | Category | Description | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|---|---|
| RSK-2025-001 | Operational | Merchant delays on data prep | Medium | Medium | Assisted CSV + photo day | Support |
| RSK-2025-002 | Technical | Google token revocation mid‑pilot | Low | High | Auto‑refresh + alert on failure | Backend |
| RSK-2025-003 | Data Quality | Low feed approval due to missing fields | Medium | Medium | Pre‑sync validation + QA checklist | Product |

---

## 7) Communications Log (append-only)

```yaml
- 2025-10-18: Created v2.0 tracker and seeded initial outreach entries from Pitch Kit table. (PM)
- 2025-10-19: Published KPI targets and per‑store checklists. (PM)
```

---

## 8) Changelog

| Version | Date | Changes |
|---|---|---|
| 2.0 | 2025-10-19 | Initial canvas tracker; added KPIs, authoritative outreach log, per‑store checklists, metrics register, risk table, and traceability map. |

---

### How to Use
1) Log new outreach under **Section 2** with a verifiable source.  
2) Progress stores using the **Section 3** checklist; mark items as completed.  
3) After first sync, append weekly metrics into **Section 4**.  
4) Keep risks updated in **Section 6**; add incident notes in **Section 4**.

> Next Step: Provide source details (contact name/email/phone) to complete the three seeded entries and schedule the first demo block for GreenMart.

