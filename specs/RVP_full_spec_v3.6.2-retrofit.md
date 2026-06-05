# 🧭 Retail Visibility Platform — Master Spec (v3.6.2-prep, Retrofit Applied)
**Editor:** Retail Spec & Outreach GPT  
**Status:** Implementation-Ready  
**Date:** 2025-10-31

> This document merges the stable v3.6.1 spec with the UI flows (2.4) and all retrofit changes required for v3.6.2-prep.


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



## 2.4 UI Design Flows & Screen Map (Sprint A)
**Principles:** keyboard-first, clear primary action per view, progressive disclosure, live validation, optimistic UI with server confirm.

### 2.4.1 Screen Map (canonical routes)
| Area | Route | Purpose | Primary Actions |
|---|---|---|---|
| Dashboard | `/t/{tenant}` | Snapshot of feed health & tasks | Fix unmapped, Connect Google |
| Business Profile | `/t/{tenant}/settings/profile` | NAP/SEO data | Save, Validate, Publish |
| Categories | `/t/{tenant}/categories` | Manage tenant categories & align to Google | Add/Edit/Delete, Align, Validate |
| Inventory List | `/t/{tenant}/inventory` | Browse & filter SKUs | New, Edit, Bulk Align |
| SKU Editor | `/t/{tenant}/inventory/{sku}` | Edit SKU + SWIS preview | Save, Align, Validate |
| Google Connect | `/t/{tenant}/integrations/google` | Link GBP/Merchant | Link/Unlink, Refresh, Sync |
| Public Tenant Page | `/store/{slug}` | Public storefront | View, Share |

### 2.4.2 Flow A — Onboarding: Business Profile (REQ‑2026‑010)
1) **Welcome** → 2) **Profile Form** (business_name, address, phone, website) with live validators  
3) **Map Preview** (if `FF_MAP_CARD`) → 4) **Confirm & Save** → 5) **Optional: Connect Google** (CTA to Flow C)

**States:**
- *Empty:* blank form with helper copy and examples.  
- *Invalid:* inline field errors; disabled primary until valid.  
- *Saved:* "NAP complete" badge appears; next-step toast to Categories.

**A11y:** labeled inputs, error `aria-describedby`, focus sent to first invalid.

**Events:** `profile_saved`, `profile_validation_failed`, `map_preview_toggled`.

### 2.4.3 Flow B — Category Management & Alignment (ENH‑2026‑045; REQ‑2025‑911/912)
**Page Layout:** Left = Tenant Category tree, Right = Alignment Panel.

**Alignment Drawer (component):**
- **Inputs:** `tenantCategoryId`, `currentMapping`, `suggestions[]`, `googleTaxonomyVersion`  
- **Actions:** Search Google taxonomy; Choose mapping; Add notes/tag; Save mapping.

**Quick Actions Footer (component):**
- **Props:** `state` (`unmapped` | `stale` | `dirty` | `compliant`), `pendingChangesCount`, callbacks `{onAlign,onValidate,onSave}`  
- **Behavior:** Sticky at bottom of SKU edit and Categories pages; hides when `state='compliant' && !dirty`.

**User Journey:**
1) Select tenant category → 2) **Align** (Alt+G) → 3) Search & choose Google category  
4) **Validate** (Alt+V) → list issues inline  
5) **Save** (Alt+S) → toast confirms; footer switches to `compliant`.

**Edge Cases:** conflicting mappings; taxonomy version bump → *stale* badge and one‑click revalidate.

**Events:** `category_align_opened`, `taxonomy_search`, `mapping_saved`, `precheck_failed`, `footer_action`.

### 2.4.4 Flow C — Google Connect Suite (ENH‑2026‑044)
1) **Integration Hub** shows Google card → 2) **Link** opens OAuth (scopes: `content`, `business.manage`)  
3) **Consent Return** shows locations picker → 4) **Select & Save**  
5) **Sync Settings**: toggles for Merchant feed push + GBP posting → 6) **Test Sync** → success badge.

**Error States:** OAuth denied, token expired, insufficient scopes → actionable banners with retry.

**A11y:** focus trap for OAuth modal fallback; announce success/error via ARIA live region.

**Events:** `oauth_start`, `oauth_success`, `oauth_error`, `location_linked`, `sync_test_triggered`.

### 2.4.5 Flow D — SKU Editor + SWIS Preview
**Layout:** Form left (Title/Brand/Pricing/Availability/Images/Category), **SWIS Preview** right (live).  
**Badges:** `Compliant`, `Needs Image`, `Price Invalid`, `Category Unmapped`.

**Save Model:** optimistic save with rollback on server reject.  
**Validation:** image URL HTTPS; price ≥ 0; currency length = 3; availability derived from qty.

**Keyboard:** Alt+P (Preview), Alt+S (Save), Alt+G (Align).

**Events:** `sku_saved`, `sku_validation_error`, `swis_preview_rendered`.

### 2.4.6 Flow E — Public Tenant Page
- **Header:** name, hours, phone, website; optional map.  
- **Catalog:** grid of public SKUs; client filter/search; availability badges.  
- **SEO:** meta + JSON‑LD (`LocalBusiness`) with NAP + product offers.

**Empty:** friendly zero‑state prompting owners to add inventory.  
**Performance:** target LCP ≤2.2s p75; lazy‑load images; responsive sources.

### 2.4.7 Component Specs (UI Contracts)
```yaml
QuickActionsFooter:
  props: { state, pendingChangesCount, onAlign(), onValidate(), onSave() }
  slots: {leftHelp?, rightMeta?}
AlignmentDrawer:
  props: { tenantCategoryId, currentMapping, suggestions[], onSave(mapping) }
GoogleCard:
  props: { linked:boolean, scopes[], onLink(), onUnlink(), onRefreshToken() }
MapCard:
  props: { address, lat, lng, privacyMode }
SwisPreviewPane:
  props: { sku, resolvedCategory, validationState }
```

### 2.4.8 Copy & Micro‑UX (draft)
- Primary CTAs: **Save**, **Align**, **Validate**, **Link Google**.  
- Success toasts: "Saved", "Mapping updated", "Google connected".  
- Inline help: "Why align? Improves approval rate on Google".

### 2.4.9 Analytics & Telemetry (front‑end)
| Event | Props |
|---|---|
| `ui.view` | {route, tenant_id} |
| `category.mapping_saved` | {tenant_id, cat_id, google_cat_id} |
| `sku.saved` | {tenant_id, sku, duration_ms, was_optimistic} |
| `oauth.success` | {tenant_id, scopes} |
| `footer.action` | {tenant_id, action} |

### 2.4.10 A11y Checklist per View
- Visible focus order matches DOM order  
- All interactive controls reachable via keyboard  
- Landmarks: header, main, nav, footer  
- AXE: 0 criticals; contrast ≥ 4.5:1



# 🔁 Retrofit Applied — v3.6.2-prep (2025-10-31)

## R1. Architecture Boundaries
```yaml
services:
  auth: owns tenant/user session + RLS
  inventory: owns SKU CRUD + feed sync
  business_profile: owns NAP, hours, SEO
  integrations: owns Google/Stripe connections
  observability: owns metrics export + alert rules
api_gateway: enabled
```
Deliverables: `architecture_boundaries.yaml` diagram + manifests.

## R2. Data Layer Additions
**Audit Log**
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  timestamp timestamptz DEFAULT now(),
  diff jsonb
);
```
**Feed Push Jobs (async + retries)**
```sql
CREATE TABLE IF NOT EXISTS feed_push_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sku text,
  job_status text CHECK (job_status IN ('queued','processing','success','failed')),
  retry_count int DEFAULT 0,
  last_attempt timestamptz,
  next_retry timestamptz,
  created_at timestamptz DEFAULT now()
);
```
Backoff: 1m → 5m → 15m → 1h (max 5 retries).

**Rollback Pack**
- `rollback_001_to_007.sql` with constraint relaxers + view/trigger drops.

## R3. Observability & Synthetic Monitoring
SLA targets: uptime ≥ 99.9%, synthetic_latency_p95 < 400ms, feed_push_success_rate ≥ 95%.  
Add Datadog monitors and 3 synthetic journeys (Align Category, Save Profile, Feed Push).

## R4. Feature Flag Lifecycle
```yaml
flag_registry:
  - key: FF_GOOGLE_CONNECT_SUITE
    owner: integrations_team
    created: 2025-09-10
    expires: 2026-03-01
    status: pilot
  - key: FF_FEED_ALIGNMENT_ENFORCE
    owner: api_team
    created: 2025-08-15
    expires: 2026-01-15
    status: active
```
Policy: define owner + expiry; remove stale flags each minor release.

## R5. API Clarifications
- Standardize on JWT for `/tenant/*` endpoints; admin routes require `aud=admin` and step‑up (`amr=step_up`) ≤ 5m.
- Add rate limiting headers and client backoff guidance.

## R6. Rollout & CI/CD
- Migrations run via CI/CD (GitHub Actions + Flyway) with a rollback job.
- Environments: `staging` → `pilot` → `prod`; keep artifacts and reports under `/ops/reports/`.

## R7. A11y & UX
- Integrate AXE/NVDA checks into pipeline; link Figma: `/design/sprint-a-v3.6.2.fig`.
- Localization readiness: extract copy keys for primary CTAs and banners.

## R8. Outreach & Pilot Feedback
```sql
CREATE TABLE IF NOT EXISTS outreach_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  feedback jsonb,
  score integer CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now()
);
```
Pilot KPIs: ≥80% satisfaction, ≥90% feed accuracy.



## Changelog
| Date | Version | Changes |
|---|---|---|
| 2025-10-31 | v3.6.2-prep | Applied retrofit (architecture boundaries, audit_log, feed_push_jobs, synthetic monitors, flag registry, API clarifications, CI/CD rollout), added UI Flows 2.4 |
| 2025-10-31 | v3.6.1 | Stable base spec (pre-retrofit) |
