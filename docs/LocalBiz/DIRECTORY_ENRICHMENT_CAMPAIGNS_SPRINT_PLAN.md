# Directory Enrichment Campaigns — Sprint Plan

> Status: **implemented — code landed, env rollout pending** (migration 279 apply + prisma regen + seed re-run on local/prd)
> Supersedes: the ad-hoc "separate lane" plan (admin endpoints + lazy triggers only)

## Goal

Today, directory market enrichment (`directory_category_enrichment`) is only populated by
proving-ground machinery: the deterministic composer runs on `profile_activated` or an
operator `manual` trigger, and both paths require an active intelligence profile (which only
exists where an establishment campaign ran).

This sprint makes **category and location enrichment a first-class campaign activity**:

- Enrichment **behaves like a campaign** — a real `mkt_campaigns_list` row with a Prompts
  tab, executions history, audit artifacts, and stage lifecycle.
- Enrichment campaigns carry **directive prompts optimized to the task** (new seeded
  templates, not generic analysis prompts).
- **Dual execution**: internal AI run (`POST /prompts/executions`) or external import
  (`POST /prompts/executions/external`) — same machinery proving ground uses.
- Scope mapping (approved): **category enrichment → `scope='category'`**,
  **location enrichment → `scope='city'`**.
- **Possible integration with proving ground**: enrichment campaigns can attach as
  children of a proving-ground parent, AND the PG cockpit gets a shortcut to create one.

## Approved design decisions

| Decision | Resolution |
|---|---|
| Lane discriminator | `campaign_category = 'directory_enrichment'` — separates the lane in list UI, dedup signature, and reporting. No CHECK constraint on the column (plain VARCHAR(30)). Verified: no `mkt_campaigns_list` CHECK constraints on `scope` or `campaign_category` exist in any migration, so adding the lane value needs no constraint migration. |
| Scope mapping | Category enrichment → `scope='category'` (vars: category/city/state). Location enrichment → `scope='city'` (vars: city/state). |
| Location campaign `category` field | `category` is NOT NULL on `mkt_campaigns_list`; location campaigns store the `'__location__'` sentinel (mirrors the enrichment table convention). |
| Category-only (national) | Supported via sentinel city: campaign `city='__all__'` produces a city-agnostic packet stored as `(category_key, '__all__', '__all__')`, consumed by `/directory/categories/[slug]` and `/place/category/[slug]` without a city param. |
| **Sentinel handling** | `applyEnrichmentPacket` MUST write the literal sentinel strings `'__all__'` / `'__location__'` directly to `city`/`state`/`category_key` — it MUST NOT route these fields through the shared `normalizeReferenceCity` / `normalizeReferenceState` helpers. Verified against the implementations: `normalizeReferenceCity('__all__')` returns `'__all__'` unchanged (in JS regex `_` is a word char, so `\b\w` only matches the leading `_`, which uppercases to itself) — but that is fragile incidental behavior, not a contract. `normalizeReferenceState('__all__')` hits the unknown-format passthrough and returns `'__ALL__'` (uppercased, NOT `null` — the state-name map misses and the 2-letter check fails). State corruption silently breaks the `(category_key, city, state)` unique key and the public-page lookup. Bypass both helpers for sentinels; add a Sprint E assertion that stored `city`/`state` are exactly `'__all__'` for national packets. |
| Apply semantics | **Auto-apply**: validated output writes `directory_category_enrichment` immediately on run/import — no operator gate when the directive is clear. |
| **Listing fan-out** | `applyEnrichmentPacket` upserts the market row AND fans the SEO packet out to published listings in the market, mirroring `CategoryMarketEnrichmentService.enrichMarket`'s two-step shape. The existing `enrichMarketListings` consumes a *profile-derived* `packet.inputs.intelligenceProfileId`; enrichment campaigns have no profile, so the fan-out path is reworked to consume the AI packet directly (the AI packet already carries `meta_title`/`description`/`keywords`/`secondary_categories`/`schema_type_hint` — the same fields `enrichMarketListings` projects). Fan-out writes `directory_listing_enrichment_log` rows with `trigger_source='campaign_run'` and respects the existing `operator_override_*` / `owner_edit` guards. National (`__all__`) packets do NOT fan out to listings (there is no city to match on) — they only populate the category-page packet. |
| Operator visibility | AI-produced results land as `mkt_audits_list` rows (`auditPlatform` set on the output schema) → mapped render card on the campaign Audits tab via the `audit.platform → component` switch in `CampaignDetailClient.tsx` (the same chain that renders `CategoryAnalysisAuditCard`, `IntelligenceDiscoveryAuditCard`, `gold_standard_scan`, etc.). The two new platforms (`category_enrichment`, `location_enrichment`) must be added to that switch or they fall through to the generic-JSON renderer. |
| Proving-ground integration | **Both**: (a) `attachChildCampaign` accepts `directory_enrichment` children, (b) PG cockpit gets a "Create enrichment campaign" shortcut prefilled with the market. |
| Execution→enrichment hook | Post-run hook in `executeSingle` + post-import hook in `importExternalResult`, keyed on `output_schema.name` (same dispatch mechanism as `intelligence_profile → importAsDraft`). |
| **Location merge contract** | The location variant's `applyEnrichmentPacket` merges AI output with deterministic aggregates from `LocationMarketEnrichmentService`'s existing `getCategoryEnrichments` + `getListingAggregates` calls. Per-field precedence: **AI wins when non-empty; aggregate fills gaps when the AI field is empty/null**. Specifically — `meta_title`: AI if non-empty else `buildLocationSeoPacket` title; `description`: AI if non-empty else aggregate; `keywords`: AI if non-empty (length > 0) else aggregate; `secondary_categories`: AI if non-empty else aggregate; `schema_type_hint`: AI if non-empty else aggregate; `top_categories`: AI only (no aggregate equivalent). This keeps the AI's local-SEO copy authoritative while never producing an empty field. The merge happens inside `LocationMarketEnrichmentService.applyEnrichmentPacket`, not in the hook. |

## New prompt type

`prompt_type = 'enrichment'` — required because reusing `city_analysis` would wrongly
fire the hot-prospect sync hook in `executeSingle` (keyed on `prompt_type`), and audit
creation is keyed on `output_schema.name` (not prompt_type), so a distinct type is clean.
`prompt_type` is VARCHAR(50) with no CHECK — safe to extend.

## Output schemas (new)

`apps/api/src/validators/directory-enrichment.schema.ts`:

- `category_enrichment` → auditPlatform `'category_enrichment'`
  - `{ meta_title, meta_description, keywords[], secondary_categories[], schema_type_hint, body_copy }`
- `location_enrichment` → auditPlatform `'location_enrichment'`
  - same packet + `top_categories[]`

Both registered in `OUTPUT_SCHEMA_REGISTRY` (market-analysis.schema.ts) with
`PROMPT_SUFFIX` constants appended to exported prompt text for external agents.

## Directive templates (seeded)

`apps/api/src/scripts/seed-directory-enrichment-templates.ts` (idempotent, deterministic
IDs, run against local + prd per AGENTS.md seed discipline):

- `mpt-category-enrichment-default` — "Category Market Enrichment",
  `prompt_type='enrichment'`, `scope='category'`, `output_schema={name:'category_enrichment'}`,
  `variables=['category','city','state']`
- `mpt-location-enrichment-default` — "Location Market Enrichment",
  `prompt_type='enrichment'`, `scope='city'`, `output_schema={name:'location_enrichment'}`,
  `variables=['city','state']`

Prompt bodies are task-optimized directives: produce a local-SEO packet (meta title ≤60
chars, description ≤155, keyword set, secondary/related categories, schema.org type hint,
short visible body copy). The location variant should be written to compose from real
market data; the renderer injects campaign vars, and `applyEnrichmentPacket` merges
deterministic aggregates (listing counts, top categories) server-side per the "Location
merge contract" decision (AI wins when non-empty; aggregate fills gaps).

## Data model changes — Migration `279_directory_enrichment_campaign_lane.sql`

1. `directory_category_enrichment.trigger_source` CHECK — drop + re-add with the **full** value set:
   `('manual', 'profile_activated', 'on_demand', 'campaign_run')`
   - `'on_demand'` fixes a **live bug**: `LocationMarketEnrichmentService.getLocation()`
     already writes `on_demand` on lazy public reads; the current CHECK (265) rejects it
     (23514). Symptom is NOT a silent boilerplate fallback — the public route
     `GET /api/public/directory/location-enrichment` wraps `getLocation` in a try/catch
     that returns `500 internal_error`, so un-enriched cities currently 500 on that
     endpoint (and the category-enrichment endpoint that recomputes location via
     `CategoryMarketEnrichmentService.enrichMarket` swallows the same error as a
     `logger.warn`). Fixing the CHECK makes both endpoints succeed for new cities.
   - `'campaign_run'` marks rows produced by an enrichment campaign execution.
2. `directory_listing_enrichment_log.trigger_source` CHECK — drop + re-add with the
   **full** value set (note: this table's current set differs from the category table —
   it does NOT include `on_demand` today, and `enrichMarketListings` currently only
   receives `manual`/`profile_activated` via `enrichMarket`'s opts type):
   `('manual', 'profile_activated', 'operator_override', 'operator_reset', 'owner_edit', 'on_demand', 'campaign_run')`
   - `'on_demand'` is added defensively for symmetry even though no current code path
     writes it to the listing log; `'campaign_run'` is the value the new
     `applyEnrichmentPacket` fan-out writes (see "Listing fan-out" decision above).
3. `directory_category_enrichment` gains lineage columns:
   - `source_campaign_id VARCHAR(255)` — the enrichment campaign that produced the row
   - `source_execution_id VARCHAR(255)` — the `mkt_prompt_executions_list` row
4. **Prisma client regeneration (required)** — `directory_category_enrichment` is a
   db-pulled model. After applying migration 279 to each environment, run
   `doppler run --config <env> -- pnpm prisma db pull` then
   `doppler run --config <env> -- pnpm prisma generate` from `apps/api`, against both
   `local` and `prd`. Without regeneration, Prisma's generated client has no
   `source_campaign_id` / `source_execution_id` fields and the apply path won't
   typecheck. (This is listed in Sprint A as a step, not just a verification item.)

## Sprint breakdown

### Sprint A — schema + schemas + templates (backend foundation)

- [x] Migration 279 written: CHECK resync + lineage columns + `body_copy` +
      `idx_category_enrichment_source_campaign` (see above). **Pending: apply to local + prd.**
- [ ] **Prisma client regen** (after migration applies in each env): from `apps/api`,
      `doppler run --config local -- pnpm prisma db pull` then
      `doppler run --config local -- pnpm prisma generate`; repeat with `--config prd`.
      Required so the new `source_campaign_id` / `source_execution_id` columns are
      present on the generated `directory_category_enrichment` model. (schema.prisma
      already updated; generated-client regen is an env step.)
- [x] `validators/directory-enrichment.schema.ts`: `category_enrichment` +
      `location_enrichment` Zod schemas, `*_SCHEMA_NAME`, `*_PROMPT_SUFFIX`.
- [x] Register both in `OUTPUT_SCHEMA_REGISTRY` (`market-analysis.schema.ts`) with
      auditPlatforms `'category_enrichment'` / `'location_enrichment'`.
- [x] `MarketingPromptService`: `PromptType` union += `'enrichment'`.
- [x] `marketing-ops.ts`: `promptTemplateCreateSchema` / update schema prompt_type enums
      += `'enrichment'`; `campaign_category` zod enum += `'directory_enrichment'`.
      **Pre-existing drift note**: `PromptType` in `MarketingPromptService.ts` already
      includes `'fragment'`, but `promptTemplateCreateSchema.prompt_type` in
      `marketing-ops.ts` does NOT (`['seek','fulfill','filter','retainer','category_analysis','city_analysis']`).
      Add `'enrichment'` to both the route schema and the `PromptType` union — do not
      rely on one implying the other. (Out of scope for this sprint: backfilling
      `'fragment'` into the route schema, which is a separate pre-existing gap.)
- [x] `MarketingCampaignService`: `CampaignCategory` union += `'directory_enrichment'`.
- [x] `seed-directory-enrichment-templates.ts` written: the two directive templates
      above (`SEED_VERSION_MARKER = 'ENRICHMENT_DIRECTIVE_V1'`, presence-check
      idempotency). **Pending: re-run local + prd, verify `updated_at`.**

### Sprint B — apply path (dual execution lands in the table)

- [x] `CategoryMarketEnrichmentService.applyEnrichmentPacket(campaign, payload, provenance)`:
      upsert `(category, city, state)` — or `(category, '__all__', '__all__')` when
      `city='__all__'` — with `trigger_source='campaign_run'`, `source_campaign_id`,
      `source_execution_id`. **Write sentinels literally; do NOT call
      `normalizeReferenceCity`/`normalizeReferenceState` on `__all__`** (they corrupt
      it — see "Sentinel handling" decision). Respect existing guards: never overwrite
      `operator_override_*` columns. Then fan the packet out to published listings in
      the market via a profile-free variant of `enrichMarketListings` (the AI packet
      carries the same fields `enrichMarketListings` projects), writing
      `directory_listing_enrichment_log` rows with `trigger_source='campaign_run'`.
      Skip fan-out for national (`__all__`) packets (no city to match on).
      Implemented via a synthesized `IntelligenceProfileSeoFields` (profileId=null)
      fed to the existing `enrichMarketListings` — operator_override and
      linked_campaign provenance guards apply unchanged.
- [x] `LocationMarketEnrichmentService.applyEnrichmentPacket(campaign, payload, provenance)`:
      upsert `('__location__', city, state)` with same provenance. Merge AI output with
      deterministic aggregates per the "Location merge contract" decision (AI wins when
      non-empty; aggregate fills gaps). **Deviation (documented in code):** no listing
      fan-out — the location packet is city-level copy, not business-specific; stamping
      it onto every listing would duplicate identical content across listings.
- [x] Export the JSON-candidate helpers (`extractJsonCandidates`, `stripLlmJsonArtifacts`)
      from `MarketingPromptService.ts` for reuse.
- [x] `MarketingPromptService.importExternalResult`: post-import hook on
      `schemaName === 'category_enrichment' | 'location_enrichment'` → apply packet.
      Best-effort with error logging; response surfaces `enrichmentApplied`.
- [x] `MarketingExecutionService.executeSingle`: post-run hook on
      `template.output_schema.name` for the two enrichment schemas → parse rawOutput →
      validate → create `mkt_audits_list` record (auditPlatform) → apply packet.
      Best-effort; execution stays `completed` even if apply fails (log + flag).
- [x] Route: `POST /prompts/executions/external` returns the import result including
      `enrichmentApplied` (no route change needed — the flag rides on the result).
- [x] **Latent bug fixed**: `Prisma.join([])` throws on empty arrays — all six
      `ARRAY[${Prisma.join(...)}]::text[]` sites across both services (including the
      pre-existing `enrichMarket`/`enrichLocation` upserts) now go through an
      empty-safe `textArraySql` helper. Caught by the new apply tests.

### Sprint C — proving-ground integration

- [x] `attachChildCampaign`: extend guard — accept children with
      `campaign_category='directory_enrichment'` (scope `category` or `city`) in
      addition to the existing intelligence/discovery rules. **Guard restructure
      note**: the current guard hard-fails any non-intelligence child with
      `ValidationError('child_not_intelligence_scope')` and separately checks
      `intelligence_campaign_kind`/`intelligence_focus`. Restructure to branch on
      `campaign_category` first: `directory_enrichment` children skip the
      intelligence-kind/focus checks entirely (they have no `intelligence_*` fields).
      The `child_already_parented` (409) check stays. Update the existing
      `provingGround.test.ts` assertions that expect rejection of non-intelligence
      children to instead expect acceptance for `directory_enrichment` children.
- [x] Cockpit (`ProvingGroundCockpitClient`): "Create enrichment campaign" actions
      (category + location buttons beside "Enrich Market Listings") →
      prefilled create → attach as child via `POST /:campaignId/children`.
      Child-list rendering verified + fixed: heading renamed to "Attached
      campaigns" with a per-child intelligence/enrichment scope badge.
- [x] `MarketingOpsService` (web): `attachProvingGroundChild` +
      `createEnrichmentCampaign` helpers; `CampaignCreateInput.parent_campaign_id`
      passthrough added.

### Sprint D — admin + public surfaces

- [x] `CampaignFormClient`: `campaign_category='directory_enrichment'` option; when set,
      scope picker limited to category/city (switching away resets the category);
      city-scope auto-fills `category='__location__'` (selector replaced by a locked
      sentinel note); category-scope shows an `__all__` hint on the city field; title
      autofill ("Category Enrichment - Halal Grocery - Columbus, OH" / "Location
      Enrichment - Columbus, OH" / "… - National"); per-category description block.
- [x] `CampaignDetailClient` Audits tab: mapped render cards for
      `category_enrichment` / `location_enrichment` audits (meta title, description,
      keyword chips, secondary categories, schema type, applied-to target + link to the
      enrichment row). **Wiring point**: the `audit.platform → component` switch lives
      inline in `CampaignDetailClient.tsx` (the `audit.platform === '...' && audit.audit_data ?`
      chain that renders `CategoryAnalysisAuditCard` / `IntelligenceDiscoveryAuditCard` /
      `gold_standard_scan` / etc.). Add two new branches for `'category_enrichment'` and
      `'location_enrichment'` before the generic-JSON fallthrough, or the audits render as
      a raw JSON blob. Build the two new card components under
      `apps/web/src/components/marketing-ops/` mirroring `CategoryAnalysisAuditCard`.
      Implemented as a single `EnrichmentAuditCard` component handling both
      platforms (mapped packet render + applied-to target derived from the
      campaign's category/city/state, import-metadata badge).
      Also: `STAGE_PROMPT_TYPES` gained `'enrichment'` for all active stages
      (else the Prompts tab hid the enrichment template), web `PromptType` and
      the prompt-library label/color maps extended.
- [ ] Category enrichment admin page (`category-enrichment-admin` router +
      `/settings/admin/directory` surfaces): show `source_campaign_id` lineage,
      `campaign_run` rows distinctly from deterministic rows. **Not yet built —
      small follow-up; the lineage columns exist in the table.**
- [ ] Location admin endpoints: `GET/POST /api/admin/directory/category-enrichment/locations`
      (list + trigger) — operator-triggered location enrichment without a campaign.
      **Scope note**: this is additive operator surface beyond the sprint's stated goal
      ("enrichment behaves like a campaign"); the auto-apply path already covers the
      campaign-driven case. Ship only if there's an operator ask for non-campaign
      triggering — otherwise defer to "Open items".
- [x] Public: `/directory/categories/[slug]` + `/place/category/[slug]` (no city) consume
      the `'__all__'` category packet for metadata + copy. **Fetch contract**: the no-city
      page calls the existing
      `GET /api/public/directory/category-enrichment?category=<slug>&city=__all__`
      endpoint (or its category-slug variant) and renders the returned `effective`
      packet; when no `__all__` row exists it falls back to the city-scoped/boilerplate
      path as today. The endpoint's service lookup must query
      `WHERE category_key = <slug> AND city = '__all__' AND state = '__all__'` literally
      (no normalization on the sentinels). Specify the exact query + client call here
      before implementing.

### Sprint E — tests + verification

- [x] Unit: schema validators accept/reject (`directoryEnrichment.schema.test.ts`);
      apply-path sentinel + fan-out coverage
      (`directoryEnrichment.apply.category.test.ts`,
      `directoryEnrichment.apply.location.test.ts`); attach guard extension in
      `provingGround.test.ts`.
- [x] **Sentinel storage unit test**: assert `applyEnrichmentPacket` for a national
      category campaign stores `city='__all__'` and `state='__all__'` **exactly** (not
      `'__ALL__'` — the `normalizeReferenceState` passthrough output), and that a
      location campaign stores `category_key='__location__'` exactly. Regression guard
      for the sentinel-corruption path (see "Sentinel handling" decision).
- [ ] **Sentinel-in-signature dedup test**: `findDuplicateCampaign` for two
      `directory_enrichment` campaigns with `city='__all__'` (national) and for two
      location campaigns with `category='__location__'` must trip the structural-
      duplicate guardrail. Verify `normalizeSignatureValue('__all__')` preserves the
      leading underscores (it lowercases/trims but should not strip them); if it does,
      fix the normalizer or bypass it for sentinels in the dedup path.
      Covered in `provingGround.test.ts` → "directory_enrichment
      structural-duplicate guardrail" (verified `normalizeSignatureValue`
      preserves `'__all__'` — no normalizer change needed).
- [ ] **`on_demand` regression test**: after migration 279, `LocationMarketEnrichmentService.getLocation`
      for a previously-unenriched city succeeds (no 23514) and writes
      `trigger_source='on_demand'`. Pre-migration this path 500s on the public
      `GET /api/public/directory/location-enrichment` endpoint (the route's try/catch
      returns `internal_error`); post-migration it returns 200 with a real packet.
      Cover both the service call and the route-level 200.
- [x] **`provingGround.test.ts` updates**: the existing tests assert rejection of
      non-intelligence children (`child_not_intelligence_scope`). Update them to expect
      acceptance for `campaign_category='directory_enrichment'` children (scope
      `category`/`city`) and keep rejection for other non-intelligence categories. Add
      a positive case: attach a `directory_enrichment` child → 200 `attached: true`.
- [ ] Route tests: external import → execution + audit + applied row; scope mismatch → 400.
      (Unit coverage of the apply path + `assertScopeCompatible` exists; the
      route-level test is still open.)
- [x] `pnpm checkapi`, `pnpm checkweb` — both clean (49/49 new+touched tests pass).
- [ ] Seed scripts re-run (local + prd), verify `updated_at` on both templates.
- [ ] Migration 279 applied to local + prd (`psql $DATABASE_URL -f …`), then
      `prisma db pull` + `prisma generate` in each env (see Sprint A).

## Guardrails (unchanged, must be preserved)

- Never overwrite `operator_override_*` columns or `owner_edit` provenance.
- `linked_campaign` / audit-powered listing content outranks market enrichment on fan-out.
- `directory_listing_enrichment_log` stays append-only.
- Scope check (`assertScopeCompatible`) enforced on both execution paths — enrichment
  templates only run on matching-scope campaigns.
- Structural-duplicate guard applies: only one active `directory_enrichment` campaign per
  `scope + category + city + state` signature (sentinels included in the signature).

## Rollout caveat (live-content side effect)

Fixing the `on_demand` CHECK in migration 279 is not a no-op bug fix on `prd`: the moment
it lands, `LocationMarketEnrichmentService.getLocation` starts *succeeding* for every
previously-unenriched city hit by public pages, so location pages that currently 500 (or
category pages whose location recompute currently no-ops via the swallowed
`logger.warn`) will begin rendering real composed SEO packets immediately. That is a
content/SEO shift on live public pages at migration-apply time, not at code-deploy time.
Heads-up to the operator before applying 279 to `prd`; consider applying 279 to `prd`
ahead of the rest of the sprint so the deterministic composer backfill runs before the
campaign-driven path lands.

## Open items / not in this sprint

- Internal AI batch enrichment across many markets (`executions/batch` already works if
  templates exist — no extra plumbing needed, but no dedicated bulk UI).
- Customer-facing enrichment purchase (pricing/packaging) — not requested.
- Re-apply endpoint for a completed execution (`POST …/enrichment/apply`) — defer until
  there's an operator ask; auto-apply covers the common path.
