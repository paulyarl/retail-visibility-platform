# Marketing Ops Prompt → Campaign Journey Integration

## Context

The admin prompt workspace at `/settings/admin/marketing-ops/prompts/[id]` is currently a dead-end. An admin can select a campaign, resolve a prompt, or execute it, but the page does not show the actual execution result and provides no clear next step. Additionally, admins sometimes run prompts in external tools (e.g., ChatGPT, Claude) and receive structured JSON output — there is no way to import that result back into the campaign workflow.

This document describes the work needed to turn the prompt workspace into a natural campaign launchpad: resolve/execute → inspect the result → choose the next campaign action.

## Goal

After any prompt execution or external-result import, the user sees the output, can validate it, and is offered the next relevant action for the campaign journey (view campaign, review filter flags, create an audit, copy an outreach angle, generate a deliverable, or move to the next pipeline stage).

## Scope

1. Display prompt execution results and next-step actions on the prompt workspace.
2. Add an "Import External Result" flow for JSON returned by out-of-app prompt runs.
3. Store `category_analysis` / `city_analysis` results as campaign audits with a human-readable renderer.
4. Use the `recommended_outreach_angle` from category/city analysis to drive the next seek/outreach step.

## Out of Scope

- Full deliverable PDF/HTML generation for market analysis (may be a placeholder / future card).
- Automatically spawning new campaigns from the `top_5_competitors` list.
- Changes to the AI execution pipeline itself.

## User Stories

### Story 1: I see the result and next steps after executing a prompt

As an admin, after I click **Execute Prompt**, I want to see the AI output and clear actions instead of a refreshed recent-executions list.

#### Tasks

- In `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx`:
  - Capture the `PromptExecution` returned by `marketingOpsService.createExecution(...)`.
  - Display `execution.raw_output` in a collapsible "Execution Result" panel.
  - Add a "Next Steps" card with:
    - "Go to campaign" → `/settings/admin/marketing-ops/campaigns/${selectedCampaignId}`
    - "Review filter flags" → `/settings/admin/marketing-ops/filter-review`
    - "Copy result" and "Download result" buttons
- Add a "Run from this preview" button that uses the current rendered preview as the basis for an execution.
- Wrap `PromptWorkspaceClient` in `MarketingOpsPageShell` with breadcrumbs back to the prompt library (`/settings/admin/marketing-ops/prompts`). See `apps/web/src/app/(platform)/settings/admin/marketing-ops/filter-review/page.tsx` for the pattern.

#### Acceptance Criteria

- [ ] Clicking **Execute Prompt** shows the `raw_output` without requiring a manual refresh.
- [ ] Each execution in the "Recent Executions" list has a "View campaign" link.
- [ ] Breadcrumbs are present and consistent with other marketing-ops pages.
- [ ] The page passes `npm run lint` / typecheck in `apps/web`.

---

### Story 2: I can import a prompt result that was run externally

As an admin, when I run a prompt outside the app and get a JSON response, I want to paste it into the prompt workspace and have it attached to the selected campaign.

#### Tasks

- In `PromptWorkspaceClient` add an "Import External Result" section:
  - Textarea for JSON paste.
  - Optional "Source / Provider" text field (defaults to `external`).
  - Optional "Cost (cents)" input.
  - "Store Result" button.
- In `apps/api/src/routes/marketing-ops.ts` add:
  - `POST /prompts/executions/external`
  - Body schema `externalExecutionCreateSchema`:
    - `campaign_id`: string
    - `template_id`: string
    - `raw_output`: string (JSON string)
    - `source` (optional): string
    - `cost_cents` (optional): number
- In `apps/api/src/services/MarketingPromptService.ts` or a new helper, create the execution record:
  - `status = 'completed'`
  - `ai_provider = source || 'external'`
  - `raw_output` and `filtered_output` = the supplied JSON string
  - `cost_cents` as provided
- For `category_analysis` / `city_analysis` templates, also create an `mkt_audits_list` record. See "Data Mapping" below.

#### Acceptance Criteria

- [ ] Pasting the sample `category_analysis` JSON for a campaign creates both an execution and an audit.
- [ ] Pasting malformed JSON or an invalid schema returns a `400` with field-level error messages.
- [ ] The imported execution appears in the campaign's execution/audit history.
- [ ] The import works for `scope = 'category'` and `scope = 'city'` campaigns.

---

### Story 3: Category / city analysis results are readable and drive the next step

As an admin, when I view a category/city analysis audit, I see it rendered as clear cards and tables, and I can act on the recommended outreach angle.

#### Tasks

- In `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`, in the Audits tab:
  - Detect `audit.platform === 'category_analysis'` or `'city_analysis'`.
  - Render the `audit_data` JSON as:
    - Header: location, industry, total businesses
    - Metrics cards: average rating, average review count, GBP claimed %, website %
    - Top 5 competitors table (name, rating, review count, location)
    - Pain points list
    - Opportunity gaps list
    - Prominent recommended outreach angle block
- Add actions:
  - "Copy outreach angle"
  - "Save to campaign notes" (writes to `mkt_campaigns_list.notes`)
  - "Create seek prompt from this angle" (pre-fills a new prompt template or opens the prompt workspace with the angle as a variable)

#### Acceptance Criteria

- [ ] The sample JSON renders cleanly in the Audits tab.
- [ ] The outreach angle is copyable and can be saved to campaign notes.
- [ ] The page remains usable at 1024px and 390px viewports.

## Technical Design

### Data Flow

```
Admin selects campaign + template
    |
    |-- Execute Prompt (internal) ----> AI -> execution record -> display raw_output
    |
    |-- Get Resolved Prompt ----------> preview string -> optionally Execute
    |
    |-- Import External Result (JSON) -> validate -> execution record
                                       |
                                       v
                              category/city analysis?
                                       |
                                       yes -> create mkt_audits_list record
                                       no  -> stop at execution record
                                       |
                                       v
                              Campaign detail renders audit cards
                                       |
                                       v
                              Admin copies / saves outreach angle or creates next prompt
```

### Data Mapping

The `mkt_prompt_executions_list` model stores the raw prompt output:

| Source Field | DB Model | Column |
|---|---|---|
| JSON string | `mkt_prompt_executions_list` | `raw_output` |
| JSON string | `mkt_prompt_executions_list` | `filtered_output` |
| `external` / provider | `mkt_prompt_executions_list` | `ai_provider` |
| `0` or supplied value | `mkt_prompt_executions_list` | `cost_cents` |
| `completed` | `mkt_prompt_executions_list` | `status` |

For `category_analysis` / `city_analysis`, also create an `mkt_audits_list` record:

| Source Field | DB Model | Column |
|---|---|---|
| `category_analysis` or `city_analysis` | `mkt_audits_list` | `platform` |
| `market_analysis.average_gbp_metrics.average_rating` | `mkt_audits_list` | `average_rating` (as Decimal) |
| `market_analysis.average_gbp_metrics.average_review_count` | `mkt_audits_list` | `review_count` |
| Full `market_analysis` object | `mkt_audits_list` | `audit_data` (JSON) |

### Validation Schema

Add to `apps/api/src/routes/marketing-ops.ts`:

```ts
const marketAnalysisSchema = z.object({
  market_analysis: z.object({
    location: z.string(),
    industry: z.string(),
    total_approximate_businesses: z.number(),
    average_gbp_metrics: z.object({
      average_rating: z.number(),
      average_review_count: z.number(),
    }),
    gbp_claimed_percentage: z.number(),
    website_presence_percentage: z.number(),
    top_5_competitors: z.array(z.object({
      name: z.string(),
      approximate_rating: z.number(),
      approximate_review_count: z.number(),
      location_status: z.string(),
    })),
    common_pain_points: z.array(z.string()),
    opportunity_gaps: z.array(z.string()),
    recommended_outreach_angle: z.string(),
  }),
});

const externalExecutionCreateSchema = z.object({
  campaign_id: z.string().min(1),
  template_id: z.string().min(1),
  raw_output: z.string().min(1),
  source: z.string().optional(),
  cost_cents: z.number().int().min(0).optional(),
});
```

### Backend Endpoints

- `POST /api/admin/marketing-ops/prompts/executions/external`
  - Validates `externalExecutionCreateSchema`.
  - Parses `raw_output` as JSON, then validates with `marketAnalysisSchema` **only if** the template is `category_analysis` or `city_analysis`.
  - Creates `mkt_prompt_executions_list` record.
  - For category/city templates, creates `mkt_audits_list` record using `MarketingAuditService.createAudit`.
  - Returns `{ success: true, data: { execution, audit? } }`.

### Frontend Components

- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx`
  - New `executionResult` state.
  - New `importJson` async handler.
  - New "Execution Result" panel.
  - New "Next Steps" card.
  - Wrap in `MarketingOpsPageShell`.

- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`
  - New `CategoryAnalysisAudit` renderer in the Audits tab.
  - "Copy outreach angle" and "Save to notes" handlers.

- `apps/web/src/services/MarketingOpsService.ts`
  - Add `createExternalExecution(input: ExternalExecutionInput): Promise<...>` method.

## File References

- Prompt workspace: `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx`
- Prompt page shell: `apps/web/src/components/marketing-ops/MarketingOpsPageShell.tsx`
- Filter review page: `apps/web/src/app/(platform)/settings/admin/marketing-ops/filter-review/page.tsx`
- Campaign detail: `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`
- Marketing ops service: `apps/web/src/services/MarketingOpsService.ts`
- Execution API routes: `apps/api/src/routes/marketing-ops.ts`
- Prompt execution service: `apps/api/src/services/MarketingPromptService.ts`
- AI execution service: `apps/api/src/services/MarketingExecutionService.ts`
- Audit service: `apps/api/src/services/MarketingAuditService.ts`
- Prisma schema: `apps/api/prisma/schema.prisma`

## Verification Steps

1. Run `npm run lint` and typecheck in `apps/web` and `apps/api`.
2. Create a campaign with:
   - `scope = 'category'` or `scope = 'city'`
   - `category = 'HVAC'`
   - `city = 'Plainfield'`
3. Open a `category_analysis` prompt template.
4. Import the sample JSON from the product discussion.
5. Confirm:
   - The execution appears in the prompt workspace "Recent Executions".
   - The `raw_output` is displayed.
   - The campaign detail Audits tab shows a new `category_analysis` audit.
   - The audit renders all JSON sections (metrics, competitors, pain points, opportunities, outreach angle).
   - "Copy outreach angle" and "Save to campaign notes" work.
6. Test invalid JSON pasting returns a clear validation error.
7. Check responsive layout at 1024px and 390px.

## Open Questions / Risks

- Should `category_analysis` / `city_analysis` results live in `mkt_audits_list` long-term, or does the project need a dedicated `mkt_market_analyses_list` table? For this sprint, `mkt_audits_list.audit_data` is the fastest, non-schema-change path.
- Should the top 5 competitors become individual `seek` campaigns automatically? Defer to a follow-up story.
- `mkt_prompt_executions_list.raw_output` is a `String?`. Very large JSON may need file storage. If the average output exceeds a few KB, consider storing the JSON in `mkt_files_list` and linking the execution instead.
- Cost tracking for external runs is optional. If omitted, store `cost_cents = 0`.

---

## Sprint Optimization & Gap Closure

This section supersedes the original Stories for sprint execution. It was produced by verifying the original plan against the current codebase (`PromptWorkspaceClient.tsx`, `marketing-ops.ts` routes, `MarketingPromptService` / `MarketingAuditService` / `MarketingExecutionService`, `MarketingOpsService` web client, `schema.prisma`, `MarketingOpsPageShell`, and the tenant-scoped routes).

### Verified assumptions (original plan is correct here)

- `PromptWorkspaceClient.handleExecute` currently discards the return of `marketingOpsService.createExecution(...)` and re-fetches the whole template — so the "dead-end" premise is real and the fix is real.
- `MarketingExecutionService.executeSingle` returns the **updated** execution with `raw_output` populated, so capturing it client-side works.
- `MarketingOpsPageShell` + breadcrumbs pattern is confirmed; `prompts/[id]/page.tsx` does **not** currently wrap in the shell.
- `MarketingAuditService.createAudit` exists with the fields the data mapping targets.
- Prisma columns referenced (`raw_output`, `filtered_output`, `ai_provider VarChar(50)`, `cost_cents Int`, `status`) match the schema.
- `CampaignDetailClient.tsx` exists and has an Audits tab that renders a generic `DetailField` list — the Story 3 renderer is additive.
- Tenant-scoped routes (`apps/web/src/app/t/[tenantId]/...`) re-export the platform pages, so changes to shared client components propagate automatically.

### Gaps to close

#### High severity (will cause bugs or rework)

- **G1 — No transaction around execution + audit creation.** Story 2 creates `mkt_prompt_executions_list` then `mkt_audits_list` as separate writes. If the audit write fails, you get an orphaned execution with no audit. Wrap both in a Prisma `$transaction`.
- **G2 — No automated tests.** Existing service tests live in `apps/api/src/services/__tests__/` (e.g. `MarketingCampaignService.test.ts`). The original "Verification Steps" are entirely manual (lint + paste JSON). Per the backend guidelines ("No tests → no merge"), add a unit test for the new external-execution service method (success category, success city, non-analysis skip, malformed JSON 400, invalid market-analysis schema 400, audit-failure rollback) and a route integration test. This is the biggest omission.
- **G3 — Result panel doesn't hydrate on page load.** Story 1 only captures the result from the in-session `execute` call. Navigate away and back → result is gone, even though the `executions` list is loaded. The "Execution Result" panel must seed from the most recent completed execution in `executions[0]`. Otherwise the dead-end problem persists after any refresh.
- **G4 — Web cache invalidation missing.** `MarketingOpsService.listExecutions` is cached (`this.cacheTTL`). After an external import, the cached executions list will be stale. The import handler must call `invalidateCachePattern('mkt-ops-executions')` and `invalidateCachePattern('mkt-ops-campaign-detail')` for the audits tab. The original plan never mentions caching.
- **G5 — `marketAnalysisSchema` is brittle.** It uses `z.number()` for ratings/percentages. Real AI/external output often returns `"4.2"`, `"85%"`, or numbers as strings. Use `z.coerce.number()` and strip `%` via preprocess, or imports will fail with field errors on valid-looking output.

#### Medium severity (under-specified → implementation risk)

- **G6 — Tenant-scoped routes not addressed.** The breadcrumb wrapping must happen in the **platform `prompts/[id]/page.tsx`** (server component) so the tenant route inherits it. Wrapping inside the client component would break the tenant route's `SetTenantId` ordering. Make the wrapping location explicit.
- **G7 — Backend layering not pinned down.** The original plan says "in `MarketingPromptService.ts` or a new helper." The new endpoint must delegate execution+audit logic to a named service method (e.g. `MarketingPromptService.importExternalResult` or `MarketingExecutionService.createExternalExecution`), keeping the route thin: parse → call service → `handleServiceError`. The method must use `getCtx(req)` like every other route in `marketing-ops.ts`.
- **G8 — "Create seek prompt from this angle" has no contract.** `PromptWorkspaceClient` reads only `templateId` from route params — there is no mechanism to pre-fill an outreach angle. Define one: link to `/settings/admin/marketing-ops/prompts/{seekTemplateId}?campaignId=...&angle=...` and have the workspace read `useSearchParams()`. Without this contract the action cannot be implemented.
- **G9 — "Save to campaign notes" — append vs overwrite undefined.** `PUT /:id` accepts `notes`, but the action must **append** with a timestamp/label (e.g. `Outreach angle (YYYY-MM-DD): ...`), not overwrite existing notes. State this explicitly.
- **G10 — Filter-flag pipeline bypassed for external imports.** Internal executions go through quality-filter flag creation; external imports skip it entirely. Decide explicitly: external imports are exempt (admin-vetted output) — document why. Otherwise run the same filter checks.
- **G11 — No dedup on re-import.** Pasting the same JSON twice creates two audits. Either dedupe by a hash of `audit_data` / `recommended_outreach_angle` per campaign, or accept duplicates and document it. Sprint decision: accept duplicates, document.

#### Low severity (polish / UX guardrails)

- **G12 — `ai_provider` is `VarChar(50)`.** "external" fits, but a user-typed provider name could exceed 50 chars. Validate `source.max(50)` and clamp.
- **G13 — Responsive/states only checked for Story 3.** Per UX guardrails, Stories 1 & 2 need the same viewports (320 / 390 / 1024), and the new "Execution Result" panel + "Import External Result" form need explicit **empty / loading / error / disabled** states (import button disabled until valid JSON, parsing spinner, parse-error inline message).
- **G14 — `navCounts` for the shell.** Wrapping in `MarketingOpsPageShell` renders `MarketingOpsNavPanel`, which optionally takes `navCounts`. The plan does not fetch counts; the nav will show no badges. Acceptable — note it so it is not treated as a bug.
- **G15 — Schema field vs. render label mismatch.** Schema requires `top_5_competitors[].location_status` but Story 3 renders a "location" column. Align the label to `location_status`.
- **G16 — Goal vs. tasks scope drift.** The Goal lists "move to the next pipeline stage" as a next-step action, but Story 1's Next Steps card only implements Go to campaign / Review filter flags / Copy / Download. Trim the goal wording (stage transition deferred) — `POST /:id/transition` already exists for a future card.

#### Critical (output contract — blocks the entire external-import premise)

- **G17 — Prompts do not specify expected output format/structure.** The external-import flow assumes the pasted JSON matches `marketAnalysisSchema`, but nothing tells the external agent (ChatGPT/Claude) what shape to return. `mkt_prompt_templates_list` has no `output_schema` field, and the seed templates only say "Format as structured JSON." with no actual schema. Result: external agents return freeform JSON and the import validation 400s on valid-looking but differently-shaped output. The prompt and the import validator must be driven by a single declared schema so they cannot drift.
- **G18 — Audit creation is detected by `prompt_type`, but the market-analysis template is typed `seek`.** The seed "Seek: Category Analysis" template (`mpt-seed-seek-002`) is `promptType: 'seek'`, **not** `category_analysis`. So the plan's branch "if template is `category_analysis`/`city_analysis` → validate + create audit" will not fire for the actual template that produces market-analysis JSON. Detection must be driven by the template's declared output schema name (e.g. `market_analysis`), not by `prompt_type` (which encodes pipeline stage: seek/fulfill/filter/retainer, not output shape).

**Design decision for G17/G18:** Add an `output_schema` column to `mkt_prompt_templates_list` (`Json?`, nullable) holding `{ name: 'market_analysis' | 'review_responses' | 'service_menu' | ... , schema: <zod-compatible JSON schema or example> }`. The render/copy/download flow appends the schema to the prompt text sent externally ("Return your response as JSON matching this schema: ..."). The import endpoint looks up the template's `output_schema.name` to decide which validator to run and whether to create an audit — replacing the hardcoded `marketAnalysisSchema` + `prompt_type` branch. Seed the `market_analysis` schema onto `mpt-seed-seek-002` (Category Analysis) and `mpt-seed-seek-003` is city-ecosystem-shaped (decide its schema name separately).

#### Critical (execution pipeline is scope-blind — silent wrong-scope executions)

- **G19 — Execution pipeline does not validate scope compatibility.** The backend (campaigns, templates) and the frontend (campaign dropdown filter) are scope-aware, but `MarketingExecutionService.executeSingle`, `executeBatch`, and `renderPrompt` fetch the template + campaign and proceed with **no `template.scope === campaign.scope` check**. The frontend only filters the dropdown — it does not enforce. A direct API call, batch execution, or the new external-import endpoint can mismatch scopes silently (e.g. a `business`-scoped template executed against a `city`-scoped campaign). Add a shared `assertScopeCompatible(template, campaign)` helper and call it at the top of `executeSingle`, `executeBatch` (per campaign), `renderPrompt`, and the new `importExternalResult`. On mismatch, return a `400` with a clear field-level message (`template scope "business" is not compatible with campaign scope "city"`).
- **G20 — `renderTemplate` injects all variables regardless of scope.** For a `city`-scoped campaign, `business_name` is null and injects an empty string into a template that may reference `{{business_name}}` — silently producing a broken prompt. `renderTemplate` should inject only scope-relevant variables and either warn or reject templates that reference out-of-scope variables. Scope→variable mapping: `business` → all variables; `category` → `category, city, neighborhood, tone, attributes` (no `business_name`, no business-specific GBP/website fields); `city` → `city, neighborhood` (no `business_name`, no `category`-specific fields). Document the mapping in the service.

### Optimized sprint slices

Reordered into 5 small, independently-mergeable PRs. Dependencies are explicit. Stories 1 and 3-frontend can proceed in parallel once 2-backend lands.

| # | Slice | Scope | Depends on | Tests required |
|---|---|---|---|---|
| **S0** | Output schema column + seed | Prisma migration: add `output_schema Json?` to `mkt_prompt_templates_list`; update `MarketingPromptService` create/update/list to pass it through; update `promptTemplateCreateSchema`/`update` in `marketing-ops.ts` to accept `output_schema`; seed `market_analysis` schema onto `mpt-seed-seek-002` (and decide city-ecosystem schema for `mpt-seed-seek-003`); define the canonical `market_analysis` zod schema in a shared validator module so both the render flow and the import flow import it. (G17, G18) | none | migration applies; seed idempotent; unit test that seeded template carries `output_schema.name === 'market_analysis'` |
| **S0b** | Execution pipeline scope validation | Add shared `assertScopeCompatible(template, campaign)` helper (throws a typed `ScopeMismatchError` → 400 with field-level message); call it at the top of `MarketingExecutionService.executeSingle`, `executeBatch` (per campaign), and `renderPrompt` (G19); update `renderTemplate` to inject only scope-relevant variables per the scope→variable mapping and reject/warn on out-of-scope `{{var}}` references (G20); document the scope→variable mapping in the service. | none | unit tests: compatible scopes pass; mismatched scopes throw (business↔city, category↔business); renderTemplate injects only scope-relevant vars; out-of-scope var reference rejected |
| **S1** | Prompt workspace shell + result display | Wrap `prompts/[id]/page.tsx` in `MarketingOpsPageShell` with breadcrumbs (G6); capture `createExecution` return; render collapsible "Execution Result" panel; **hydrate panel from `executions[0]` on load** (G3); Next Steps card (Go to campaign, Review filter flags, Copy/Download); "Run from this preview" button; **Copy/Download appends the template's `output_schema` to the exported prompt text** so external agents return the expected shape (G17); **show a scope-mismatch error inline if the selected campaign's scope ≠ template scope** (defense-in-depth behind S0b's backend check). | S0, S0b | lint/typecheck; responsive 320/390/1024 (G13); empty+loading+error states; verify copied prompt includes output schema instructions; verify scope-mismatch error renders |
| **S2a** | Backend: external import endpoint + service | New service method `MarketingPromptService.importExternalResult` (or on `MarketingExecutionService`) that **transactionally** creates execution + audit (G1); **calls `assertScopeCompatible(template, campaign)` from S0b** (G19); route `POST /prompts/executions/external` (thin: parse `externalExecutionCreateSchema` → fetch template + campaign → **assert scope compatible** → **look up `template.output_schema.name`** to pick the validator and decide audit creation (G18) → validate with the canonical schema using `z.coerce.number()` (G5) → call service → `handleServiceError`); pass `getCtx(req)` (G7); default `cost_cents=0`, `ai_provider` clamped to 50 chars (G12); external imports exempt from filter-flag pipeline (G10). | S0, S0b | unit tests: success (market_analysis schema), non-analysis skip, malformed JSON 400, schema-invalid 400, audit-failure rollback, **scope-mismatch 400**; route integration test (G2) |
| **S2b** | Frontend: import external result UI | "Import External Result" section in `PromptWorkspaceClient` (textarea, source, cost, Store button) with parse-error inline state, disabled-until-valid, success toast; **show the template's expected output schema name/shape as a hint above the textarea** (G17); **invalidate `mkt-ops-executions` + `mkt-ops-campaign-detail` cache** on success (G4); refresh list. | S2a | lint/typecheck; responsive; error/empty/disabled states (G13) |
| **S3a** | Audit renderer | `CategoryAnalysisAudit` renderer in `CampaignDetailClient` Audits tab (header, metric cards, competitors table, pain points, opportunity gaps, outreach angle block); detect by `audit.platform === 'category_analysis' \|\| 'city_analysis'` (set by the import service from the schema name); align `location_status` label (G15). | S2a (needs an audit to render) | lint/typecheck; responsive 320/390/1024; render with sample JSON |
| **S3b** | Outreach-angle actions | "Copy outreach angle"; "Save to campaign notes" (**append** with timestamp via `PUT /:id`, not overwrite) (G9); "Create seek prompt from this angle" via the agreed query-param contract `?campaignId=&angle=` read by `PromptWorkspaceClient` via `useSearchParams()` (G8). | S3a, and the query-param contract agreed upfront | lint/typecheck; verify append (not overwrite); verify seek prompt pre-fill |

### Cross-cutting checklist (apply within the slices above, not as separate PRs)

- [ ] Add `z.coerce.number()` + `%` strip to the canonical `market_analysis` schema (G5)
- [ ] Add Prisma `$transaction` to the import service method (G1)
- [ ] Add cache invalidation calls after import (G4)
- [ ] Document: external imports exempt from filter-flag pipeline (G10)
- [ ] Document: re-import duplicates accepted (G11)
- [ ] Convert the `raw_output` size open question into a trigger condition: track pasted payload size; if any payload > 16KB, switch to `mkt_files_list` linking in a follow-up card
- [ ] Trim the Goal wording to drop "move to the next pipeline stage" (G16) — stage transition deferred to a future card; `POST /:id/transition` already exists
- [ ] Define the canonical `market_analysis` zod schema in a shared validator module imported by both the render flow (to append to exported prompt text) and the import flow (to validate pasted JSON) — single source of truth (G17)
- [ ] Audit-creation detection keys off `template.output_schema.name === 'market_analysis'`, NOT `prompt_type` (G18)
- [ ] Add `assertScopeCompatible(template, campaign)` shared helper; call from `executeSingle`, `executeBatch`, `renderPrompt`, `importExternalResult` (G19)
- [ ] Update `renderTemplate` to inject only scope-relevant variables per the scope→variable mapping; reject/warn on out-of-scope `{{var}}` references (G20)
- [ ] Document the scope→variable mapping: `business` → all; `category` → `category, city, neighborhood, tone, attributes`; `city` → `city, neighborhood` (G20)

### Sequencing rationale

- **S0 and S0b first (parallel)**: both are small backend-only changes with no dependency on each other. S0 adds the output-schema column + canonical validator + seed; S0b adds scope validation to the existing execution pipeline. Together they are the critical path — S1, S2a, and the import flow all depend on them.
- **S1 next**: smallest UX win, unblocks the dead-end immediately; depends on S0 (schema-appended copy/download) and S0b (inline scope-mismatch error).
- **S2a next**: backend import endpoint; depends on S0 (schema-driven validation/detection) and S0b (`assertScopeCompatible`). Land with tests before any UI depends on it.
- **S2b and S3a in parallel** after S2a (different files, no merge conflict).
- **S3b last**: depends on the renderer and the query-param contract, which is the riskiest under-specified piece — resolve the contract in sprint planning before S3b starts.

---

## Start-of-Sprint Pre-Flight Checklist

Run per `start-of-phase-sprint-checklist.md` before writing any code. Filled in for this sprint below.

### 0. Hard Rule — TypeScript Checks at Sprint End (Non-Negotiable)

Every slice MUST end with zero new TypeScript errors on both apps.

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

- [ ] Allocate time at the end of each slice to run both checks and fix errors before committing.
- [ ] Pre-existing errors must not increase.

### 1. Singleton Service Strategy

- [x] **Web base identified**: `MarketingOpsService` already extends `AdminApiSingleton` (admin platform panel audience). New `createExternalExecution` method goes on this existing singleton — no new web service.
- [x] **API base identified**: `MarketingPromptService` / `MarketingExecutionService` / `MarketingAuditService` already extend `BaseService` (singleton via `getInstance()`). New `importExternalResult` method goes on `MarketingPromptService` (it owns execution creation) — no new API service.
- [x] **Cache contract planned**: `MarketingOpsService` uses `invalidateCachePattern`. New import method must invalidate:
  - `mkt-ops-executions` (executions list)
  - `mkt-ops-execution-{id}` (single execution — N/A, new ID)
  - `mkt-ops-audits-{campaignId}` (audits for the campaign)
  - `mkt-ops-campaign-{campaignId}` (campaign detail, includes audits)
  - `mkt-ops-prompt-templates` (only if template's `output_schema` is mutated — not in import flow)
- [x] **No direct `fetch`**: all new frontend calls go through `MarketingOpsService.createExternalExecution(...)` via `makeDefaultRequest`.

### 2. Skill Document Awareness

Skills to read before starting:
- [ ] `manual-sql-migration-policy.md` — S0 adds a column; must follow SQL-first → `prisma db pull` → `prisma generate` workflow. **Never edit `schema.prisma` directly.**
- [ ] `deploy-service-extending-base-singleton.md` — confirm `AdminApiSingleton` cache invalidation patterns for the new import method.
- [ ] `cross-context-cache-invalidation.md` — the import flow touches executions + audits + campaign detail caches across contexts.
- [ ] `skill-frontend-ux-guardrails` (already invoked) — S1/S2b/S3a UI work.
- [ ] `backend-dev-guidelines` (already invoked) — S0/S0b/S2a layered architecture, Zod, Sentry, tests.

Skills to update after completion (mandatory):
- [ ] `manual-sql-migration-policy.md` — add migration 136 to the example numbering reference if the skill maintains one.
- [ ] `start-of-phase-sprint-checklist.md` / `end-of-phase-sprint-checklist.md` — capture the "scope-aware execution pipeline" pattern (G19/G20) as a reusable insight: scope checks belong in the execution service, not just the data model and UI filter.
- [ ] Consider a new skill `marketing-ops-output-schema-contract.md` capturing: template declares `output_schema`, render flow appends it to exported prompt text, import flow validates against it, audit creation keyed off `output_schema.name` not `prompt_type`. This is a recurring pattern for any future prompt-driven import flow.

### 3. Tenant-Scoped ID Planning

- [x] **No new entities created this sprint.** S0 adds a column to an existing table; S0b/S1/S2/S3 add methods/renderers to existing entities.
- [x] **Existing ID generators reused** (already in `id-generator.ts`):
  - `generatePromptExecutionId()` → `mpe-{nanoid}` for the imported execution record.
  - `generateMarketingAuditId()` → `maud-{nanoid}` for the audit created from market-analysis imports.
- [x] **No new prefixes needed.** No collision risk — both prefixes are already in the catalog.
- [x] **No raw UUID / `Date.now()` patterns introduced.** The import service must use the existing generators, not `randomUUID()`.

### 4. Navigation & Page Planning

- [x] **No new pages or routes this sprint.** All work is on existing routes:
  - `/settings/admin/marketing-ops/prompts/[id]` (S1, S2b)
  - `/settings/admin/marketing-ops/campaigns/[id]` (S3a, S3b)
  - Tenant-scoped mirrors under `/t/[tenantId]/...` inherit automatically (re-export pattern).
- [x] **No new sidebar links.** `MarketingOpsNavPanel` already has Prompts + Campaigns entries.
- [x] **No new settings cards.** The prompt workspace and campaign detail already have entry points.
- [x] **No `navigation_links` SQL INSERTs needed.**
- [x] **No file-based fallback nav updates needed.**

### 5. Backend Architecture Planning

New route (S2a):
- [ ] **Mount path**: added to existing `apps/api/src/routes/marketing-ops.ts` (already mounted under `/api/admin/marketing-ops`). New endpoint: `POST /prompts/executions/external`.
- [ ] **Auth level**: inherits `router.use(authenticateToken)` + `router.use(requirePlatformAdmin)` already applied at the top of the file. No new middleware.
- [ ] **RBAC**: platform admin only (existing). No new `requirePermission` / `requireRole`.
- [ ] **Route order risk**: `POST /prompts/executions/external` must be registered **before** `POST /prompts/executions/:id`-style catch-alls. Current file has `GET /prompts/executions/:id` and `PUT /prompts/executions/:id` — `POST /prompts/executions/external` is a distinct path (`external` ≠ `:id` because the method is POST and there is no `POST /prompts/executions/:id`), so no conflict. Verify by reading the route order before committing.
- [ ] **Zod schemas needed** (in `marketing-ops.ts`):
  - `externalExecutionCreateSchema` (campaign_id, template_id, raw_output, source?, cost_cents?)
  - Canonical `marketAnalysisSchema` with `z.coerce.number()` (place in a shared validator module, e.g. `apps/api/src/validators/market-analysis.schema.ts`, so render + import share it).
- [ ] **Logger usage**: `logger.info('External execution imported', ctx, { ... })` / `logger.error(...)` with `getCtx(req)`. No `console.log`.

Existing services modified:
- [ ] `MarketingPromptService` — add `importExternalResult(input, ctx)`; transactional execution + audit creation via `this.prisma.$transaction`.
- [ ] `MarketingExecutionService` — add `assertScopeCompatible(template, campaign)` (shared helper, exported); call from `executeSingle`, `executeBatch` (per campaign), `renderPrompt`. Update `renderTemplate` to inject only scope-relevant variables.
- [ ] `MarketingAuditService` — no changes (existing `createAudit` is reused).

No new background jobs this sprint.

### 6. Database & Migration Planning

- [ ] **Migration file**: `database/migrations/136_marketing_ops_prompt_output_schema.sql` (next number confirmed — last is 135).
- [ ] **Prerequisite**: `135_marketing_ops_prompt_scope.sql` applied.
- [ ] **DDL**:
  ```sql
  ALTER TABLE mkt_prompt_templates_list
    ADD COLUMN IF NOT EXISTS output_schema JSONB;
  ```
  (Nullable — existing templates have no declared schema until seeded.)
- [ ] **Seed** (idempotent, in the same migration):
  ```sql
  UPDATE mkt_prompt_templates_list
    SET output_schema = '{"name":"market_analysis","schema":{...}}'::jsonb
    WHERE id = 'mpt-seed-seek-002' AND output_schema IS NULL;
  ```
  Decide the city-ecosystem schema name for `mpt-seed-seek-003` and seed it too (or leave null and document as TBD).
- [ ] **Idempotency**: `ADD COLUMN IF NOT EXISTS`; `UPDATE ... WHERE output_schema IS NULL`.
- [ ] **No RLS changes** (column added to existing RLS-enabled table; existing policies cover it).
- [ ] **No new indexes** (`output_schema` is not a filter column in this sprint; add later if list-by-schema becomes a query).
- [ ] **No materialized view rebuilds** (table not feeding any MV).
- [ ] **After applying**: run `npx prisma db pull && npx prisma generate`. **Never edit `schema.prisma` directly.**
- [ ] **Verification queries** (commented at bottom of migration):
  ```sql
  -- SELECT id, name, scope, output_schema->>'name' AS schema_name FROM mkt_prompt_templates_list WHERE output_schema IS NOT NULL;
  ```

### 7. Frontend Architecture Planning

New/modified components:
- [ ] `PromptWorkspaceClient.tsx` (S1, S2b) — client component (already is). New state: `executionResult`, `importJson`, `importing`, `importError`. New sections: "Execution Result" panel, "Next Steps" card, "Import External Result" form. States needed: empty (no execution yet), loading (executing/importing), error (execute/import failed), success (result shown), disabled (import button until valid JSON).
- [ ] `prompts/[id]/page.tsx` (S1) — server component; wrap `<PromptWorkspaceClient>` in `<MarketingOpsPageShell>` with breadcrumbs. Pass `navCounts` as undefined (acceptable — nav shows no badges).
- [ ] `CampaignDetailClient.tsx` (S3a, S3b) — client component (already is). New sub-component `CategoryAnalysisAudit` renderer in the Audits tab. New handlers: copy outreach angle, save to notes (append), create seek prompt link.
- [ ] `MarketingOpsService.ts` (S2b) — add `createExternalExecution(input)` method; invalidate `mkt-ops-executions`, `mkt-ops-audits-{campaignId}`, `mkt-ops-campaign-{campaignId}`.

- [ ] **React Query cache keys**: this app uses `makeDefaultRequest` with string cache keys (`'mkt-ops-executions'`, etc.) — no React Query key planning needed. New method uses cache key `'mkt-ops-execution-external'` with TTL 0 (mutation, not cached).
- [ ] **SSR safety**: `PromptWorkspaceClient` already uses `'use client'`. New `useSearchParams()` for the `?angle=` contract (S3b) must be wrapped in a `<Suspense>` boundary per Next.js App Router requirements — plan for this.
- [ ] **No `ServerResolvedContextProvider` impact** — no auth/tenant flow changes.

### 8. Capability System Planning

- [x] **No new capability features this sprint.** The prompt workspace and campaign detail are admin-only platform features, not tier-gated capabilities. No `canonical-features.ts` / `tier-hierarchies.ts` / resolver / `EffectiveCapabilityResolver` changes.
- [x] **No cross-capability constraints.**
- [x] **No frontend fallback resolver impact.**
- [x] **No `buildExpiredCapabilitiesResponse` updates.**

### 9. Design Doc & Memory Planning

- [x] **Design doc**: this plan (`MARKETING_OPS_PROMPT_CAMPAIGN_INTEGRATION_PLAN.md`) is the design doc. Read fully before starting (done during this analysis).
- [ ] **Memory entry at sprint completion**: summarize slices shipped, key files, the output-schema-contract pattern, and the scope-aware execution pipeline pattern. Tags: `marketing-ops`, `prompt-campaign-integration`, `sprint-complete`.
- [ ] **Check existing memories**: search for prior `marketing-ops` session memories to confirm no rediscovery needed.

### 10. Pre-Flight Summary

```
Phase/Sprint: Marketing Ops Prompt → Campaign Journey Integration
Design doc: docs/MARKETING_OPS_PROMPT_CAMPAIGN_INTEGRATION_PLAN.md

New services: none (methods added to existing MarketingPromptService,
              MarketingExecutionService, MarketingOpsService)
New entities: none (column added to existing mkt_prompt_templates_list)
New ID generators needed: none (reuse generatePromptExecutionId, generateMarketingAuditId)
New pages/routes: none (existing prompts/[id] and campaigns/[id] enhanced)
New sidebar links: none
New settings cards (tenant and/or admin): none
New migration: 136_marketing_ops_prompt_output_schema.sql
New background jobs: none
New capability features: none
Skills to read before starting: manual-sql-migration-policy.md,
              deploy-service-extending-base-singleton.md,
              cross-context-cache-invalidation.md
Skills to update after completion: manual-sql-migration-policy.md (migration 136 ref),
              start-of-phase-sprint-checklist.md / end-of-phase-sprint-checklist.md
              (scope-aware execution pipeline insight)
Insights to capture in skills: output-schema-contract pattern (template declares
              schema → render appends to prompt → import validates → audit keyed
              off schema name not prompt_type); scope checks belong in execution
              service not just data model + UI filter
New skill to create: marketing-ops-output-schema-contract.md (proposed — captures
              the recurring pattern for any future prompt-driven import flow)
```

### Sprint start gate

All checklist items above are resolved or explicitly N/A. The sprint is ready to begin with **S0** (`136_marketing_ops_prompt_output_schema.sql` + canonical validator + seed) and **S0b** (scope validation in `MarketingExecutionService`) in parallel, followed by S1 → S2a → (S2b ∥ S3a) → S3b per the sequencing rationale.
