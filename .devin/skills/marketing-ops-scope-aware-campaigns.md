---
description: Scope-aware campaign detail page and derived business campaigns from category/city/state campaigns in Marketing Ops
---

# Marketing Ops — Scope-Aware Campaigns & Derived Business Campaigns

Use this skill when implementing the scope-aware campaign detail page and the
"derive business campaign from a discovered competitor" flow. Covers the scope
model, the parent/child campaign linkage, the derive-business endpoint, and the
UI conventions for scope-conditional rendering.

## Background: The Scope Model

Campaigns and prompt templates carry a `scope` field with three values
(`apps/api/src/services/scope-utils.ts`):

- `business` — full business context. All variables injected.
- `category` — category/city/state/neighborhood/tone/attributes. No
  `business_name`, no business-specific GBP/website fields.
- `city` — city/state/neighborhood only. No business or category fields.

`SCOPE_VARIABLES` defines which template variables `renderTemplate` injects per
scope. `assertScopeCompatible(template, campaign)` throws `ScopeMismatchError`
(→ 400) when a template's scope doesn't match the campaign's scope.

External-import flow (`MarketingPromptService.importExternalResult`) validates
pasted JSON against the template's `output_schema` and creates a
`mkt_audits_list` record keyed off `output_schema->>'name'` (e.g.
`market_analysis` → `platform = 'category_analysis'`). The full validated JSON
lives in `audit.audit_data`.

## Bug Fix Already Applied (S0)

`MarketingCampaignService.getCampaign` previously returned raw Prisma relation
keys (`mkt_audits_list`, `mkt_files_list`, `mkt_stage_history_list`) which the
web client expects as `audits` / `files` / `stage_history`. This caused the
Audits / Files / Stage History tabs to render empty for **every** campaign. The
service now normalizes the keys before returning. Do not revert this mapping.

## Part 1 — Scope-Aware Overview Layout

**Goal:** The Overview tab renders scope-appropriate fields instead of always
showing business-scope GBP/fee/retainer fields that are null for category/city
campaigns.

**Approach:** Branch the Overview content on `campaign.scope`:

- `business` (current, unchanged): GBP metrics, contact, pain score, fees,
  retainer, conversion.
- `category`: industry/category, city/state, market size, average GBP metrics,
  top competitors summary, pain points, opportunity gaps, outreach angle. Pull
  these from the latest `category_analysis` audit's `audit_data`. Hide
  business-only fields (GBP claimed, NAP, pain score, fees/retainer) unless the
  campaign is linked to a tenant.
- `city`: city/state, neighborhood, any city-level analysis. Sparse by design.

**No backend changes** — the data already lives in `campaign.audits[].audit_data`.

**Files:**
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — add scope-conditional Overview sections.
- Extract `CategoryOverviewSection` / `CityOverviewSection` components alongside the existing `CategoryAnalysisAuditCard` (`apps/web/src/components/marketing-ops/`) to keep the detail client manageable.

**Conventions:**
- Reuse `DetailField` and `Metric` helpers already in the codebase.
- The scope badge already renders in the header (`{campaign.scope}`) — keep it.
- For category scope, prefer the structured `CategoryAnalysisAuditCard` rendering over flat `DetailField` grids where the data is structured (competitors list, pain points list).

## Part 2 — Derived Business Campaigns

**Goal:** From a category or city campaign's discovered competitors/businesses,
spawn a child `business`-scope campaign seeded with that business's data, linked
back to the parent via `parent_campaign_id`.

### Decisions (confirmed with product owner)

1. **Dedicated endpoint** — `POST /campaigns/:id/derive-business` takes a
   competitor payload `{name, rating, review_count, location}`. Server derives
   tier + seeds fields from the parent. Clearer contract; validation server-side.
2. **Start at `seek` stage** — derived business campaigns need a business-scope
   analysis (full contact details, GBP audit) before reaching `preview_built`.
   The seek stage is where that research happens.
3. **Allow recursion, keep it simple** — any campaign can have a
   `parent_campaign_id`. Spawning is a one-click "new campaign from this
   discovery" action (same UX pattern as a campaign clone, which already
   exists). No cycle-detection machinery; the parent link is an optional lineage
   reference. A business-scope campaign can spawn further business children from
   its own discovered competitors.

### 2a. Backend: parent/child linkage + derive endpoint

**Schema (`apps/api/prisma/schema.prisma`):**
- Add `parent_campaign_id` (nullable, FK to `mkt_campaigns_list.id`) on
  `mkt_campaigns_list`. Self-relation: `parent` and `children` relations.
- Migration file in `database/migrations/` following the existing numbered
  convention (check the latest number and increment).

**Service (`apps/api/src/services/MarketingCampaignService.ts`):**
- `CampaignCreateInput` accepts optional `parent_campaign_id`.
- `getCampaign` includes `parent_campaign_id` and a `children` count (or list).
- New method `deriveBusinessCampaign(parentId, competitorPayload, ctx)`:
  - Load parent campaign; assert parent scope is `category` or `city` (or
    `business` for the recursive case — allowed per decision 3).
  - Build the child campaign: `scope = 'business'`, `business_name` from
    payload, `category`/`city`/`state`/`neighborhood` inherited from parent,
    `estimated_tier` derived from rating/review count (reuse existing tier
    inference if present), `stage = 'seek'`, `parent_campaign_id = parentId`,
    `notes` referencing the parent and the outreach angle (if available from
    parent's latest category_analysis audit).
  - Create via the existing create path so stage history + ID generation stay
    consistent.

**Route (`apps/api/src/routes/marketing-ops.ts`):**
- `POST /:id/derive-business` with Zod schema:
  `{ name: string, rating?: number, review_count?: number, location?: string }`.
- Returns the created child campaign.
- Extend the create schema and list filters to surface `parent_campaign_id`.

### 2b. Frontend: derive actions + lineage display

**Service (`apps/web/src/services/MarketingOpsService.ts`):**
- Add `parent_campaign_id` to `Campaign` / `CampaignDetail` types.
- Add `children?: Campaign[]` (or count) to `CampaignDetail`.
- Add `deriveBusinessCampaign(parentId, payload)` helper.

**Component (`apps/web/src/components/marketing-ops/CategoryAnalysisAuditCard.tsx`):**
- Per-competitor "Create campaign" button next to each entry in
  `top_5_competitors` (alongside the existing Copy/Save/Seek actions).
- A single "Create business campaign from this analysis" action that opens a
  chooser: pick a competitor (or enter a custom business name) → calls
  `deriveBusinessCampaign` → navigates to the new child campaign's detail page.
- On success, invalidate the parent campaign cache so lineage updates.

**Detail page (`CampaignDetailClient.tsx`):**
- Show parent linkage: if `campaign.parent_campaign_id`, render a link to the
  parent campaign near the header.
- Show derived children: a "Derived Campaigns" section (or new tab) listing
  child campaigns with links, stage badges, and a quick "open" action.

## Key Files

- `apps/api/src/services/scope-utils.ts` — scope model, `SCOPE_VARIABLES`,
  `assertScopeCompatible`.
- `apps/api/src/services/MarketingCampaignService.ts` — campaign CRUD,
  `getCampaign` (now normalizes relation keys), `deriveBusinessCampaign` (new).
- `apps/api/src/services/MarketingPromptService.ts` — `importExternalResult`,
  output_schema registry lookup.
- `apps/api/src/validators/market-analysis.schema.ts` — `market_analysis` Zod
  schema, `OUTPUT_SCHEMA_REGISTRY`, `MARKET_ANALYSIS_SCHEMA_NAME`.
- `apps/api/src/routes/marketing-ops.ts` — API schemas and endpoints.
- `apps/web/src/services/MarketingOpsService.ts` — frontend types and service.
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — detail page (scope-conditional Overview + lineage).
- `apps/web/src/components/marketing-ops/CategoryAnalysisAuditCard.tsx` — market analysis renderer + derive actions.
- `apps/api/prisma/schema.prisma` — `mkt_campaigns_list` (add `parent_campaign_id`).

## Common Pitfalls

- **Do not revert the relation-key normalization** in `getCampaign`. The web
  client depends on `audits` / `files` / `stage_history`; the raw Prisma keys
  (`mkt_audits_list` etc.) are dropped at the client boundary.
- The `attributes` DB column is JSONB but Prisma returns/accepts `string[]` in
  the frontend; keep arrays in the service layer (per existing skill).
- `retainer` is a campaign filter-only field — do not inject it into prompt
  variables or derive-campaign seeding.
- When deriving a child, inherit `category`/`city`/`state`/`neighborhood` from
  the parent but do **not** inherit business-specific fields (`gbp_claimed`,
  `has_website`, `pain_score`, etc.) — those are unknown for the competitor and
  must be discovered during the child's seek stage.
- The derive endpoint must assert scope compatibility in the direction that
  matters: a `business`-scope child can be spawned from any parent scope, but a
  `category`/`city` child should not be spawned from a `business` parent (no
  use case; reject to prevent confusion).
- Reuse the existing campaign-clone UX pattern for the derive action — it's
  already familiar and avoids inventing a new modal flow.
