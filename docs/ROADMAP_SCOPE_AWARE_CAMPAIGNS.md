# Implementation Roadmap — SCOPE-AWARE-CAMPAIGNS-2026-01

**Initiative:** Scope-Aware Campaign Detail & Derived Business Campaigns
**Status:** 🟡 Planning (approved by product owner 2026-07-30)
**Skill reference:** `.devin/skills/marketing-ops-scope-aware-campaigns.md`

## Problem Statement

The campaign detail page is business-centric: the Overview tab hardcodes
business-scope fields (GBP Claimed, NAP, Pain Score, fees/retainer) that are
null for category/city/state campaigns, so non-business campaigns appear blank.
Additionally, there is no path from a category/city campaign's discovered
competitors to a child business-scope campaign — the natural seek→prospect
conversion for non-business scopes is missing.

A separate bug (now fixed) caused the Audits / Files / Stage History tabs to
render empty for **all** campaigns due to an API field-name mismatch
(`mkt_audits_list` vs `audits`). That fix is a prerequisite and is already
applied.

## Decisions (confirmed)

1. **Derive endpoint:** Dedicated `POST /campaigns/:id/derive-business` taking a
   competitor payload. Server derives tier + seeds fields from the parent.
2. **Child stage:** Start at `seek` — the child needs a business-scope analysis
   (full contact details, GBP audit) before `preview_built`.
3. **Recursion:** Allowed. Any campaign can have a `parent_campaign_id`.
   Spawning is a one-click action (clone-style UX). No cycle-detection
   machinery; parent link is an optional lineage reference.

---

## Phase 0 — Prerequisite Bug Fix (DONE ✅)

**Status:** Complete. Applied 2026-07-30.

- [x] Normalize Prisma relation keys in `MarketingCampaignService.getCampaign`:
      `mkt_audits_list` → `audits`, `mkt_files_list` → `files`,
      `mkt_stage_history_list` → `stage_history`.
- [x] Typecheck (`pnpm checkapi`) clean.
- [x] `MarketingCampaignService.test.ts` passes (3/3).

**Verification:** Reload `mcamp-5j9a1kog` — Audits tab now shows the
`CategoryAnalysisAuditCard` with the imported HVAC Plainfield market analysis.

---

## Phase 1 — Scope-Aware Overview Layout (frontend only)

**Owner:** Frontend
**Depends on:** Phase 0 (so `campaign.audits` is populated)
**Risk:** Low — rendering change only, no schema/backend impact.

**Tasks:**
- [ ] In `CampaignDetailClient.tsx`, branch the Overview tab content on
      `campaign.scope` (`business` | `category` | `city`).
- [ ] `business` scope: keep current Overview unchanged.
- [ ] `category` scope: render industry/category, city/state, market size,
      average GBP metrics, top competitors summary, pain points, opportunity
      gaps, outreach angle — sourced from the latest `category_analysis` audit's
      `audit_data`. Hide business-only fields unless tenant-linked.
- [ ] `city` scope: render city/state, neighborhood, any city-level analysis.
      Sparse by design.
- [ ] Extract `CategoryOverviewSection` / `CityOverviewSection` components into
      `apps/web/src/components/marketing-ops/` to keep the detail client
      manageable.
- [ ] Reuse existing `DetailField` / `Metric` helpers.
- [ ] Visual check on a category campaign (e.g. `mcamp-5j9a1kog`) and a city
      campaign.

**Exit Criteria:**
- ✅ Category campaign Overview shows market analysis content, not blank
  business fields.
- ✅ Business campaign Overview unchanged.
- ✅ No typecheck/lint regressions.

---

## Phase 2 — Backend: Parent/Child Linkage + Derive Endpoint

**Owner:** Backend
**Depends on:** Phase 0
**Risk:** Medium — schema migration + new endpoint.

**Tasks:**
- [ ] Add `parent_campaign_id` (nullable, FK self) to `mkt_campaigns_list` in
      `apps/api/prisma/schema.prisma` with `parent` / `children` relations.
- [ ] Create migration in `database/migrations/` (increment from latest number).
- [ ] `CampaignCreateInput` accepts optional `parent_campaign_id`.
- [ ] `getCampaign` includes `parent_campaign_id` and a `children` count/list.
- [ ] `listCampaigns` filter supports `parent_campaign_id` (to find children).
- [ ] New `MarketingCampaignService.deriveBusinessCampaign(parentId, payload, ctx)`:
      - Load parent; assert parent scope is `category`/`city`/`business`.
      - Build child: `scope='business'`, `business_name` from payload,
        `category`/`city`/`state`/`neighborhood` inherited, `estimated_tier`
        derived from rating/review count, `stage='seek'`,
        `parent_campaign_id=parentId`, `notes` referencing parent + outreach
        angle (from parent's latest category_analysis audit if present).
      - Create via existing create path (consistent ID gen + stage history).
- [ ] `POST /:id/derive-business` route with Zod schema
      `{ name, rating?, review_count?, location? }`. Returns created child.
- [ ] Reject `category`/`city` children spawned from a `business` parent (no use
      case; prevents confusion).
- [ ] Tests: `deriveBusinessCampaign` unit test (mocked Prisma) covering
      category→business, city→business, business→business (recursive), and the
      rejected business→category case.

**Exit Criteria:**
- ✅ Migration applies cleanly.
- ✅ `POST /:id/derive-business` creates a `seek`-stage business child with
  inherited location context and a parent link.
- ✅ `getCampaign` returns `parent_campaign_id` + children.
- ✅ `pnpm checkapi` clean; new tests pass.

---

## Phase 3 — Frontend: Derive Actions + Lineage Display

**Owner:** Frontend
**Depends on:** Phase 2
**Risk:** Low — wires up the backend.

**Tasks:**
- [ ] Add `parent_campaign_id` + `children` to `Campaign` / `CampaignDetail`
      types in `apps/web/src/services/MarketingOpsService.ts`.
- [ ] Add `deriveBusinessCampaign(parentId, payload)` helper.
- [ ] `CategoryAnalysisAuditCard`: per-competitor "Create campaign" button on
      each `top_5_competitors` entry.
- [ ] `CategoryAnalysisAuditCard`: single "Create business campaign from this
      analysis" action → chooser (pick competitor or custom name) → call derive
      → navigate to new child detail page.
- [ ] On derive success, invalidate parent campaign cache (`mkt-ops-campaign-<id>`).
- [ ] `CampaignDetailClient`: show parent link near header if
      `parent_campaign_id` set.
- [ ] `CampaignDetailClient`: "Derived Campaigns" section/tab listing children
      with links, stage badges, open action.
- [ ] Reuse the existing campaign-clone UX pattern for the derive modal.

**Exit Criteria:**
- ✅ Clicking "Create campaign" on a competitor creates a seek-stage business
  child and navigates to it.
- ✅ Parent campaign detail shows the new child under "Derived Campaigns".
- ✅ Child campaign detail shows a link back to the parent.
- ✅ No typecheck/lint regressions.

---

## Out of Scope (explicit)

- Cycle detection on `parent_campaign_id` (deferred — recursion is allowed and
  the link is optional lineage only).
- Automatic seek-stage analysis execution for derived children (the child starts
  at `seek`; running the analysis is a separate manual/automated step).
- State-scope campaigns as a distinct scope value (the scope model today is
  `business`/`category`/`city`; "state" campaigns use `city` scope with a state
  field). If a true `state` scope is needed later, extend `SCOPE_VARIABLES` and
  `assertScopeCompatible` first.
