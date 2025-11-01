# RVP Implementation Tracking — v3.7 Category Unification + v3.8 SKU Scanning

Status Key: [ ] Todo · [~] In Progress · [x] Done · [!] Blocked

Owners: fill in using @handles
Dates: target vs. actual

---

## 0) Scope & Goals
- Unify Tenant + Product Category framework, GBP mirroring, feed alignment enforcement.
- Add SKU Scanning (camera/USB), enrichment, validation, duplicate detection, batch commit.
- Ship telemetry, dashboards, and CI drift guardrails.

---

## 1) Milestones
| ID | Name | Target | Owner | Status | Notes |
|---|---|---|---|---|---|
| M1 | Data model + RLS + audit (v3.7) | | | [~] | Core tables, RLS, audit hooks |
| M2 | Unified validation API + feed enforcement | | | [~] | OpenAPI docs, enforcement on push |
| M3 | UI shell integration (sidebar + drawer) | | | [ ] | Chips, drawer, flags |
| M4 | GBP sync engine + jobs + retries | | | [ ] | Backoff, out-of-sync detection |
| M5 | SKU Scanning core (session/results/cache) | | | [ ] | Tables + APIs + components |
| M6 | Observability dashboards + alerts | | | [ ] | Category + scanning KPIs |
| M7 | CI schema drift + release gate | | | [ ] | Nightly diff, PR gate |
| M8 | Business Hours + GBP sync (spec + impl) | | | [ ] | Hours model/APIs/UI + sync job |
| M9 | Pilot + staged rollout | | | [ ] | Flags, tenants, acceptance |

---

## 2) Work Breakdown Structure (WBS)

### 2.1 Shared Category Framework
- [x] Audit emitters (category create/update/delete/align; item assignment)
- [x] Coverage endpoint (viewless SQL join)
- [ ] OpenAPI: category routes, precheck/validate/push, coverage
- [ ] CategoryService abstraction (shared CRUD + validation)
- [ ] Taxonomy versioning jobs + stale mapping marker

### 2.2 Tenant Categories + GBP
- [ ] Mirror endpoint + strategy switch (platform → GBP)
- [ ] GBP sync worker with retries/backoff
- [ ] Out-of-sync detection + telemetry `gbp.sync.out_of_sync_detected`
- [ ] Admin dashboard tiles (sync status, errors, retry CTA)

### 2.3 Product Feed Alignment
- [x] Precheck/validate UI surfacing (422 handler + modal)
- [x] Feed push enforcement flag `FEED_ALIGNMENT_ENFORCE`
- [ ] ISR revalidation ≤60s for public pages on item/category changes

### 2.4 UI Shell Integration
- [ ] Sidebar chips (tenant categories + GBP status)
- [ ] Alignment Drawer (toggle via Alt+Shift+C)
- [x] Coverage badges (Feed Validation + Categories)

### 2.5 SKU Scanning (v3.8)
- [ ] Tables: session/result/template/lookup_log (+RLS)
- [ ] APIs: start scan, results, commit, lookup-barcode
- [ ] Components: BarcodeScanner (ZXing + USB), BatchReview, EnrichmentPreview
- [ ] Validation + precheck hook (category suggestion + enforcement)
- [ ] Duplicate detection (bloom/DB) + badges
- [ ] Tiered feature flags + rate limits

### 2.6 Observability & CI
- [ ] Dashboards: `gbp_sync_success_rate`, `taxonomy_stale_count`, `mapping_latency_p95`
- [ ] Scanning dashboards: `scan_success_rate`, `enrichment_hit_rate`, `validation_error_rate`, `duplicate_detection_latency_ms`, `commit_success_rate`
- [ ] Synthetic tests (hourly): mirror + precheck
- [ ] CI schema drift job + PR gate

### 2.7 Business Hours + GBP Sync
- [ ] Data model: business_hours (weekly) + special_hours (overrides) with timezone, last_synced_at, hash
- [ ] APIs: `GET/PUT /tenant/{tenant_id}/business-hours`, `GET/PUT /tenant/{tenant_id}/business-hours/special`
- [ ] Mirror endpoint (optional via flag): `POST /tenant/{tenant_id}/gbp/hours/mirror`
- [ ] Sync job: retries/backoff, out-of-sync detector, audit events
- [ ] UI: HoursEditor (weekly grid), SpecialHoursCalendar, TimezonePicker, SyncStateBadge (Hours)
- [ ] Observability: `gbp_hours_sync_success_rate`, `hours_out_of_sync_count`
 - [ ] Mirror strategy: `platform_is_source` (default); no automatic GBP pull; show out-of-sync warning with "Mirror Now" CTA

---

## 3) Feature Flags & Tenants
| Flag | Default | Rollout | Owner | Notes |
|---|---|---|---|---|
| FF_CATEGORY_UNIFICATION | off | staged v3.7 | | |
| FF_TENANT_PLATFORM_CATEGORY | pilot | per-tenant | | |
| FF_TENANT_GBP_CATEGORY_SYNC | pilot | cohort | | |
| FF_CATEGORY_MIRRORING | off | per-tenant | | |
| FF_PRODUCT_CATEGORY_ALIGNMENT | on | global | | |
| FEED_ALIGNMENT_ENFORCE (API) | true | global | | |
| FF_SKU_SCANNING | off | Starter+ staged | | |
| FF_CAMERA_SCANNER | off | Starter+ | | |
| FF_USB_SCANNER | off | Pro+ | | |
| FF_SKU_ENRICHMENT_ENGINE | off | tiered | | |
| FF_SKU_BATCH_MODE | off | Pro+ | | |
| FF_TENANT_GBP_HOURS_SYNC | off | pilot | | Controls optional GBP hours mirror endpoint and job |

---

## 4) Dependencies & Risks
- GBP API quotas/instability → backoff, alerting, manual override.
- Taxonomy drift → nightly refresh, stale flags, dashboards.
- Enrichment provider reliability → cache-first, rotation, timeouts.
- A11y/Mobile constraints → progressive enhancement, USB fallback.

Mitigations documented in Observability & CI sections.

---

## 5) Acceptance Criteria
- GBP mirror success ≥95% in pilot; out-of-sync alarms actionable.
- Precheck blocks unmapped SKUs when enforce=true; UI shows actionable errors.
- 50 SKUs ≤20 minutes on mid-tier phone; enrichment hit ≥70% pilot.
- A11y: keyboard-only flows pass; Lighthouse A11y ≥95.
- Dashboards live for categories + scanning with alert thresholds.
- Hours editor + GBP mirror functional in pilot; sync success ≥95%; out-of-sync alarms actionable.

---

## 6) Tracking Log (update as you ship)
| Date | Area | Change | Ref | By |
|---|---|---|---|---|
| 2025-11-01 | API | Audit emitters for categories + item assignment | commit 09bfc8f | |
| 2025-11-01 | API | Coverage endpoint (viewless) | commit 09bfc8f | |
| 2025-11-01 | Web | Coverage badges; TenantContextProvider split | commit 09bfc8f | |
| 2025-11-01 | Docs | Batch test scripts + e2e instructions | commit 09bfc8f | |

---

## 7) Rollout Checklist
- [ ] Apply migrations (staging → prod)
- [ ] Validate RLS + audit events
- [ ] Smoke test mirror + precheck APIs (synthetics green)
- [ ] Dashboards populated with baseline
- [ ] Pilot flags on for cohort; monitor 48h
- [ ] Flip `FF_CATEGORY_UNIFICATION=true` globally after QA
- [ ] Enable SKU scanning by tier per plan

---

## 8) OpenAPI & Contracts To-Do
- [ ] Publish/commit OpenAPI for category validation/mirroring/scanning
- [ ] Add contract tests for 401 refresh, 429/5xx retries (client resilience)

---

## 9) Owners & Contact
- Tech Lead: @
- Backend: @
- Frontend: @
- DevOps/CI: @
- QA: @

---

Notes:
- Keep this file up to date per milestone.
- Link PRs and issues to each WBS item.
