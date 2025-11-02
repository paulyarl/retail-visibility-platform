# 🧭 Retail Visibility Platform — Master Spec
## Version: v 3.6.1 — *Visibility Alignment Pack*
**Release Date:** 2025-11-05  
**Status:** Stable  
**Editor:** Retail Spec & Outreach GPT  

---

### 5  Visibility & Feed Governance (Updated)

#### 5.3 Tenant Category Management (ENH-2026-045)
- Each tenant defines its own category structure while enforcing mapping to Google’s taxonomy.
- Data Model: `tenant_category`, `google_taxonomy`, and view `v_feed_category_resolved`.
- Feed Output: `productType` → local path; `googleProductCategory` → resolved Google path.
- Validation: Feed precheck blocks unmapped public categories when `FF_FEED_ALIGNMENT_ENFORCE=true`.
- UI: `/t/{tenant}/categories` with list + Alignment Drawer.
- Governance: 100 % mapping coverage, 95 %+ feed approval, full audit trail.

#### 5.4 Category Alignment Compliance (REQ-2025-911)
- Every tenant category must align with at least one valid Google taxonomy entry.
- System validation occurs at feed precheck and job submission.
- Metrics: `category_mapping_coverage_pct ≥ 100 %`, `feed_approval_rate ≥ 95 %`, and `feed_blocked_due_to_unmapped_category_total = 0`.

#### 5.5 Quick Actions Workflow (REQ-2025-912 & 912A)
- **Product Edit:** Sticky Quick Actions Footer appears when category unmapped/stale/dirty.
- CTAs: Align Category • Preview SKUs • Validate Feed • Save & Return.
- **Tenant Settings:** “Categories → Review & Align” Card deep-links to `/categories?tab=overview`.
- Keyboard Shortcuts: Alt + G / Alt + V / Alt + S.
- Footer hidden when compliant + saved.  
- All events (`qa_footer_*`) logged for engagement KPIs.

#### 5.6 Observability & Governance KPIs
| Metric | Target | Owner |
|---------|---------|--------|
| `feed_approval_rate` | ≥ 95 % | QA Lead |
| `category_mapping_coverage_pct` | 100 % | API Lead |
| `qa_footer_engagement_rate` | ≥ 60 % | Product Ops |
| `time_to_alignment_median_ms` | ≤ 90 000 ms | UX Lead |
| `taxonomy_version_active_age_days` | ≤ 30 days | DevOps |

---

### 6  Feature Flags
| Flag | Description | Default |
|-------|--------------|----------|
| `FF_CATEGORY_MANAGEMENT_PAGE` | Enables Category Management UI | true |
| `FF_TENANT_CATEGORY_OVERRIDE` | Allows tenant-level mapping writes | false |
| `FF_FEED_ALIGNMENT_ENFORCE` | Blocks feed when unmapped | warn |
| `FF_CATEGORY_QUICK_ACTIONS` | Enables sticky footer | false (pilot) |

---

### 7  QA Matrix Summary
- 26 test cases covering happy paths, deep-links, footer logic, validation, permissions, a11y, and performance.  
- All passed ✅ in pre-production (2025-11-04 QA report #CAT-VALID-3).

---

### 8  Changelog
## v3.6.1 – Visibility Alignment Pack
- Added Tenant Category Management (ENH-2026-045)
- Added Google Category Alignment Compliance (REQ-2025-911)
- Added Category Deep-Links & Quick Actions Footer (REQ-2025-912 / 912A)
- Integrated feed serializer mapping logic
- Added audit trail & Datadog dashboards
- QA matrix expanded to Category Alignment Suite

---

### 9  Release Summary
| Label | Value |
|--------|--------|
| **Release Name** | Visibility Alignment Pack v 3.6.1 |
| **Goal** | Vendor-owned categories + Google taxonomy alignment for feed compliance |
| **Release Type** | Functional Enhancement + UX Workflow |
| **Impact** | Feed rejection ↓ > 80 %, 100 % mapping coverage, faster merchant setup |
| **Rollback Plan** | Disable `FF_CATEGORY_MANAGEMENT_PAGE` & `FF_CATEGORY_QUICK_ACTIONS`; feeds revert to warn-only mode. |

---

### ✅ Status: Merged & Published
- **Tag:** `v3.6.1-stable`
- **Cluster:** Pre-prod validated; promoted to prod release candidate on 2025-11-05.
- **Next Cycle:** v 3.7 “Observability Unification” – scheduled 2025-12-01.
