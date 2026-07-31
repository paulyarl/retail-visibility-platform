# Implementation Roadmap — SCOPE-AWARE-CAMPAIGNS-2026-01

**Initiative:** Scope-Aware Campaign Detail & Derived Business Campaigns
**Status:** � Implementation complete (Phases 0–3, 2026-07-30). Pending: live visual verification + unit tests for `deriveBusinessCampaign`.
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

## Phase 1 — Scope-Aware Overview Layout (frontend only) ✅ DONE

**Owner:** Frontend
**Depends on:** Phase 0 (so `campaign.audits` is populated)
**Risk:** Low — rendering change only, no schema/backend impact.
**Status:** Complete (2026-07-30). `pnpm checkweb` clean.

**Tasks:**
- [x] In `CampaignDetailClient.tsx`, branch the Overview tab content on
      `campaign.scope` (`business` | `category` | `city`).
- [x] `business` scope: keep current Overview unchanged.
- [x] `category` scope: render industry/category, city, market size, average GBP
      metrics, top competitors summary, pain points, opportunity gaps, outreach
      angle — sourced from the latest `category_analysis` audit's `audit_data`.
      Hide business-only fields unless tenant-linked.
- [x] `city` scope: render city, neighborhood, any city-level analysis. Sparse.
- [x] Extract `CategoryOverviewSection` / `CityOverviewSection` components into
      `apps/web/src/components/marketing-ops/`.
- [x] Reuse existing `DetailField` / `Metric` helpers.
- [ ] Visual check on a category campaign (e.g. `mcamp-5j9a1kog`) and a city
      campaign. (Pending live verification.)

**Exit Criteria:**
- ✅ Category campaign Overview shows market analysis content, not blank
  business fields.
- ✅ Business campaign Overview unchanged.
- ✅ No typecheck/lint regressions.

---

## Phase 2 — Backend: Parent/Child Linkage + Derive Endpoint ✅ DONE

**Owner:** Backend
**Depends on:** Phase 0
**Risk:** Medium — schema migration + new endpoint.
**Status:** Complete (2026-07-30). `pnpm checkapi` clean. Prisma client regenerated.

**Tasks:**
- [x] Add `parent_campaign_id` (nullable, FK self) to `mkt_campaigns_list` in
      `apps/api/prisma/schema.prisma` with `parent` / `children` relations.
- [x] Create migration `138_marketing_ops_campaign_parent_link.sql`.
- [x] `CampaignInput` accepts optional `parentCampaignId`.
- [x] `getCampaign` includes `parent` (select subset) and `children` list,
      normalized to `parent_campaign` / `children` in the response.
- [x] `listCampaigns` filter supports `parentCampaignId` (to find children).
- [x] New `MarketingCampaignService.deriveBusinessCampaign(parentId, payload, ctx)`:
      - Loads parent + latest `category_analysis` audit.
      - Builds child: `scope='business'`, `business_name` from payload,
        `category`/`city`/`neighborhood`/`tone`/`attributes` inherited,
        `estimated_tier` derived from rating/review count, `stage='seek'`,
        `parent_campaign_id=parentId`, `notes` referencing parent + outreach
        angle.
      - Creates via existing create path (consistent ID gen + stage history).
- [x] `POST /:id/derive-business` route with Zod schema
      `{ business_name, rating?, review_count?, location?, assigned_to? }`.
      Returns 201 with created child.
- [x] Method always creates `business`-scope children (category/city children
      from a business parent are not produced by this endpoint).
- [ ] Tests: `deriveBusinessCampaign` unit test (mocked Prisma) covering
      category→business, city→business, business→business (recursive), and the
      rejected business→category case. (Pending.)

**Exit Criteria:**
- ✅ Migration applies cleanly.
- ✅ `POST /:id/derive-business` creates a `seek`-stage business child with
  inherited location context and a parent link.
- ✅ `getCampaign` returns `parent_campaign` + children.
- ✅ `pnpm checkapi` clean.

---

## Phase 3 — Frontend: Derive Actions + Lineage Display ✅ DONE

**Owner:** Frontend
**Depends on:** Phase 2
**Risk:** Low — wires up the backend.
**Status:** Complete (2026-07-30). `pnpm checkweb` clean.

**Tasks:**
- [x] Add `parent_campaign_id` + `CampaignLineageEntry` + `parent_campaign` /
      `children` to `Campaign` / `CampaignDetail` types in
      `apps/web/src/services/MarketingOpsService.ts`.
- [x] Add `deriveBusinessCampaign(parentId, payload)` helper (invalidates parent
      + list caches).
- [x] `CategoryAnalysisAuditCard`: per-competitor "Campaign" button on each
      `top_5_competitors` entry.
- [x] `CategoryAnalysisAuditCard`: "Business campaign…" toggle revealing a
      custom-name input for deriving a child from a business not in the
      competitor list.
- [x] On derive success, invalidate parent campaign cache + navigate to child.
- [x] `CampaignDetailClient`: show parent link near header subtitle if
      `parent_campaign` is set.
- [x] `CampaignDetailClient`: new "Derived Campaigns" tab listing children with
      links, scope, stage badges, created date. Empty state with guidance.

**Exit Criteria:**
- ✅ Clicking "Campaign" on a competitor creates a seek-stage business child and
  navigates to it.
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
