# Bronze Standard — Sprint Plan

> Companion to `BRONZE_STANDARD_SPEC.md` (v1.1). Ships the DB-authoritative reason
> catalog (`mkt_bronze_reason_catalog` + `mkt_bronze_catalog_meta`), the
> `bronze_standards` intelligence focus (Option A), two prompt templates
> (national establishment + city discovery), the `bronze_standard_scan` output
> schema + schema-named post-import hook, bronze injection on the stage-2 and
> stage-3 render paths, `recordBronzeExternalFill` for out-of-loop fills, and
> the operator catalog admin UI.
>
> **Verification:** codebase audit performed 2026-09-17 against `staging` @
> `7aa447b2`. Every spec file/line reference was checked — see "Verification
> findings" at the bottom, including **one stale claim (migration numbering)**
> and several spec gaps this plan fills.

---

## Decisions to settle before coding

| # | Question | Recommendation |
|---|---|---|
| D1 | `resolveBronzeStandard` signature — spec §10.3 writes `(category, city, state, ctx)`, but §3.6.5 makes `reference_platform` part of the profile identity tuple and platform-scoped bronze profiles are a first-class feature. | **Mirror gold:** `(category, platform?, city?, state?, ctx?)`, same cascade shape as `resolveGoldStandard` (city+state → state → nationwide, platform-exact → cross-platform at each layer). A platform-less signature can't resolve a platform-scoped bronze profile. |
| D2 | `recordBronzeExternalFill` trigger — spec §7.3 defines the method but never names the caller, and `reasonKey` is a required param that **cannot be inferred from audit output** (a business audit doesn't know which blind-spot reason it exemplifies). | **Operator-initiated.** An "Add to bronze profile" action on the business-audit card opens a reason picker (catalog dropdown) → `POST /api/admin/marketing-ops/bronze-reasons/:reasonKey/external-fill` → `recordBronzeExternalFill`. Auto-detection hooks are unsound here — gate-failure patterns don't map 1:1 to reasons. Defer any auto-suggest to a later sprint. |
| D3 | Test-scan execution model (§3.5.5 / §10.3). The platform's seek runs are external-agent (render → copy → external AI → import); `AIProviderService` exists but no intelligence scan executes internally today. | **Two-mode endpoint, never internal execution.** `POST /bronze-reasons/:reasonKey/test-scan` with `{city, state}` → returns the rendered restricted-scan prompt; with `{city, state, scanOutput}` → validates against `bronze_standard_scan` and returns the parsed slot outcome + vector log, persisting nothing. Keeps the §3.5.5 "ephemeral, writes no profile" contract while fitting the existing external workflow. |
| D4 | Stage-2 run structure (spec open question 2): separate `bronze_standards`/`discovery` campaign per city, or folded into the emerging-establishment campaign? | **Separate campaign.** Matches the gold precedent (establishment + discovery are separate campaigns), keeps the template self-contained, avoids a two-payload import dance, and the distinct focus signature means no guardrail collision either way. Folding is still possible later — nothing in Phase 5 precludes it. |
| D5 | Stale-catalog enforcement (spec open question 3): block, warn, or silent when a profile's `catalog_revision` < current? | **Warn in-prompt.** When `serializeBronzeStandard` runs, compare `profile.configuration_json.catalog_revision` to `mkt_bronze_catalog_meta.catalog_revision`; if behind, append a `BRONZE CATALOG DRIFT` note + the §3.5.3 uncovered-reason list to the emitted block. The analyst sees the gap in-context; nothing is blocked; the list is directly actionable. |
| D6 | Stage-1 catalog injection — spec §10.3's table lists bronze-block injection for the discovery and emerging paths only, but §6.1 says stage 1 **consumes** the catalog rows. | Required: `BronzeReasonCatalogService.serializeCatalogBlock(rows)` emitting the scope-applicable reasons (key, label, definition, signals, expected_vectors, priority) as the stage-1 prompt's hunt list. Without it the establishment prompt has no catalog to snapshot. Not optional — add to Phase 6. |

---

## Phase 0 — Pre-flight

| # | Task | Files | Notes |
|---|------|-------|-------|
| 0.1 | **Renumber the migration.** Spec §10.4 says "next free number is 289" — stale. `database/migrations/` now contains 286–290 (`290_mkt_playbook_delivery_artifacts.sql`). Use **`291_bronze_reason_catalog.sql`**. Note the directory already has duplicate-numbered pairs (271–275) — verify no `291_*` exists before writing. | `database/migrations/` | The "286–288 never committed" caveat is resolved — all are now in the repo. |
| 0.2 | Settle D1–D6 above. | — | D2 and D3 change the route surface; D6 adds a service method. |
| 0.3 | Confirm normalizer exports: `normalizeCategoryKey` (:155), `normalizeReferenceCity` (:175), `normalizeReferenceState` (:209), `normalizePlatformScope` (:233) — all exported from `IntelligenceProfileService.ts`, reusable by the catalog service for §3.5.1 write-time normalization. | `apps/api/src/services/intelligence/IntelligenceProfileService.ts` | Verified — all four exported. |
| 0.4 | Sanity-check `category_key` vocabulary for the `scope_category_key` dropdown: the admin UI should offer existing keys (source: `mkt_intelligence_profiles.category_key` distinct values or the category registry) rather than free text (§3.5.1). | web admin | Decide source list during Phase 9. |

## Phase 1 — DDL migration (`291_bronze_reason_catalog.sql`)

Following `.devin/skills/manual-sql-migration-policy.md`: `mkt_*` family = **no RLS, no `updated_at` triggers** (app-maintained), idempotent DDL.

| # | Task | Notes |
|---|------|-------|
| 1.1 | `CREATE TABLE IF NOT EXISTS mkt_bronze_reason_catalog` — columns per spec §3.5.1: `reason_key` PK (`varchar(80)`, mirrors 288's `key`), `label`, `definition`, `signals`/`expected_vectors` jsonb, `priority` int, `scope_category_key`/`scope_city`/`scope_state`/`scope_platform` nullable text, `provenance` varchar, `introduced_in_revision`/`revised_in_revision`/`deprecated_in_revision` int, `deprecated_reason` text, `superseded_by` varchar(80), `created_by`, `created_at`, `updated_at`. **No CHECK constraints** — code-validated per the `mkt_manual_play_templates` precedent (spec §3.5.1; chk↔enum drift has bitten 3× per AGENTS.md). | Spec-compliant. Add a self-ref FK comment for `superseded_by` (nullable, no enforcement needed). |
| 1.2 | `CREATE TABLE IF NOT EXISTS mkt_bronze_catalog_meta` — `id` text PK, `catalog_revision` int, `updated_at`; seed the single row `('catalog', 1, now())` via `INSERT ... SELECT ... WHERE NOT EXISTS`. | §3.5.2 counter. |
| 1.3 | Seed the **17** §3.2 catalog rows — `provenance='derived'`, `introduced_in_revision=1`, `priority`/`scope_category_key` per the table (`trade_manifest_only` + `wholesale_or_hybrid_role` scoped to `african_grocery_store`; other 15 universal). Pre-normalized values only — the migration writes literals, so they must already be normalized (`african_grocery_store`, not `'African Grocery Store'`). | §3.2 has 17 rows: 15 universal + 2 category-bound. The §4 example `scope_mix {universal:15, category:2}` matches. |
| 1.4 | Apply `local` + `prd` (`psql $DATABASE_URL -f database/migrations/291_bronze_reason_catalog.sql`), then `doppler run --config local -- pnpm prisma db pull` + `pnpm prisma generate` from `apps/api`. | Per AGENTS.md migration discipline. |

## Phase 2 — `BronzeReasonCatalogService` (new)

New file: `apps/api/src/services/intelligence/BronzeReasonCatalogService.ts` (singleton, alongside the other intelligence services).

| # | Task | Notes |
|---|------|-------|
| 2.1 | `listReasons({categoryKey?, city?, state?, platform?, includeDeprecated?})` — §3.6.1 predicate, NULL = wildcard, caller-side normalization of filter args. | Drives admin list + consumers. |
| 2.2 | `applicableReasons(scope)` — the stage-1/stage-2 read: universal + category + platform-filtered rows (stage 1) or plus location rows (stage 2), `deprecated_in_revision IS NULL`, ordered by `priority`. | §6.1/§6.3 consume sets. |
| 2.3 | `createReason` / `updateReason` / `deprecateReason(key, {deprecatedReason?, supersededBy?})` — every write runs in a transaction that bumps `mkt_bronze_catalog_meta.catalog_revision` and returns the new value for stamping `introduced_`/`revised_`/`deprecated_in_revision`. `reason_key` immutable — reject mutation on update. Write-time normalization via the Phase-0.3 normalizers; **reject** values that fail to normalize (§3.5.1 — "not silently stored"). `scope_platform` lowercased + validated against the gold platform vocabulary (`google\|yelp\|facebook\|website\|bing\|apple_maps`). | §3.5.2 counter discipline. |
| 2.4 | `currentRevision()` — plain `SELECT` on the meta row; never `MAX()` over reason rows. | §3.5.2. |
| 2.5 | `uncoveredReasons({categoryKey, city, state, platform?, profileCatalogRevision})` — §3.5.3 predicate over `GREATEST(introduced_in_revision, COALESCE(revised_in_revision,0))`, scope-filtered, deprecated excluded; returns `gap_kind` (`never_covered` / `revised_since_authored`). | Include `platform` param per §3.6.1's five-clause predicate — the spec SQL omits it but the scope model requires it. |
| 2.6 | `serializeCatalogBlock(rows)` — **D6.** Emits the stage-1 hunt list: reason_key, label, definition, signals, expected_vectors, priority per row. | Spec gap — stage 1 cannot snapshot a catalog it never saw. |
| 2.7 | `audit()` on every write with `actorType: 'user'` + `created_by` from ctx (§3.5.5). | `audit.ts:12` signature verified. |

## Phase 3 — `bronze_standards` focus plumbing (Option A, spec §10.2)

| # | Task | Files | Notes |
|---|------|-------|-------|
| 3.1 | Add `'bronze_standards'` to both `IntelligenceFocus` unions — `IntelligenceProfileService.ts:57` and `MarketingPromptService.ts:37` (drift confirmed: only the former carries `'proving_ground'`). | Both files | `VarChar(20)` fits (16 chars); no chk_ constraint exists on `intelligence_focus`/`intelligence_campaign_kind` (verified — no migration touches them). |
| 3.2 | Widen Zod enums + **rework the refines** in `marketing-ops.ts`: `intelligence_focus` enums at :283 (campaign create), :696 (template update), :7020 (template create-ish, `default('emerging')`); literal filter at :2788; query-param unions at :7073/:7084/:7112. Refines 304–326 currently key only on `gold_standards` — make them kind-aware for bronze: `focus==='bronze_standards' && kind==='establishment'` → exempt from city/state (national stage 1, like gold) but **platform stays optional** (do NOT extend the gold platform requirement); `focus==='bronze_standards' && kind==='discovery'` → city+state required (stage 2, like emerging). | `apps/api/src/routes/marketing-ops.ts` | ⚠️ Without the refine rework, a stage-1 national bronze campaign is unrejectable-by-omission: refines 304/308 demand city/state for every non-gold focus, so national bronze campaigns would 400 at create time. |
| 3.3 | `renderFocusBlockCore` — add an explicit `bronze_standards` branch (spec §10.2). Today it returns `''` for anything but emerging/competitive (:1893) — **including gold_standards**, which has no branch either. The bronze establishment framing block is a real deliverable here. | `MarketingExecutionService.ts` | Spec-cited behavior verified. |
| 3.4 | `formatDiscoveryMarketContext` focus param (`MarketContextBindingFormatters.ts:413`) is typed `'emerging' \| 'competitive' \| 'gold_standards'` — widen or accept a broader `IntelligenceFocus`. The 877-branch call site casts (`:986`), so it compiles today, but the type should be honest. | `MarketContextBindingFormatters.ts` | Not in the spec's enumerated touch points — added by verification. |
| 3.5 | `focusOrder` map at `IntelligenceProfileService.ts:2516` — add `bronze_standards` (currently falls to `?? 3` default alongside proving_ground — acceptable but make it explicit). | same file | Cosmetic; coverage-map sort. |

## Phase 4 — Output schema + registry entry

| # | Task | Files | Notes |
|---|------|-------|-------|
| 4.1 | New `validators/bronze-standard-scan.schema.ts` mirroring `gold-standard-scan.schema.ts`: `bronzeStandardScanSchema` enforcing the §4 shape — `reason_coverage[]` with `status` 3-state enum (`filled`/`empty_unproven`/`empty_proven_elsewhere`), `discovered_by` 5-value enum, `platform_presence` 6-value vocabulary, `observed_platform` (gold platform vocab, nullable), `digital_quality` (`low\|very_low`), `catalog_revision` int, `not_applicable_reasons[]`, `scope_mix`, `vector_execution_log[]` (`executed` boolean + nullable `returned`), `prohibited_inferences[]`. Export `BRONZE_STANDARD_SCAN_SCHEMA_NAME` + `BRONZE_STANDARD_SCAN_PROMPT_SUFFIX`. | `apps/api/src/validators/bronze-standard-scan.schema.ts` | §4.2 vocabularies are code-enforced — "not free text — the emitted profile is a calibration artifact." |
| 4.2 | Register in `OUTPUT_SCHEMA_REGISTRY` (`market-analysis.schema.ts:250`) with **`auditPlatform: null`** and the prompt suffix. | `market-analysis.schema.ts` | ⚠️ Deliberate divergence from gold: gold's entry has `auditPlatform: 'gold_standard_scan'` so discovery imports create Audits-tab rows; spec §10.3 says discovery-kind bronze imports produce a **profile draft, not an audit**. `null` achieves that. |
| 4.3 | Suffix appends automatically — `bronze_standard_scan` is not in `LEGACY_NO_SUFFIX_SCHEMAS` (`MarketingExecutionService.ts:638-643`) and must not be added. | — | Verified. |

## Phase 5 — `IntelligenceProfileService` additions

| # | Task | Notes |
|---|------|-------|
| 5.1 | `resolveBronzeStandard(category, platform?, city?, state?, ctx?)` — **D1 signature.** Cascade city+state → state → nationwide, platform-exact → cross-platform at each layer, `intelligence_focus='bronze_standards'`, `status='active'`. Mirror `resolveGoldStandard` (:1832-1943) including its logged-fallback warnings. | Spec §10.3's `(category, city, state)` is the common call; the platform param keeps §3.6.5 platform-scoped profiles resolvable. |
| 5.2 | `serializeBronzeStandard(profile, role)` — roles `'establishment_reference'` (stage 2: full catalog snapshot + national proof state) and `'discovery'` (stage 3: §7.1 framing — calibration exemplars + empty-slot report + vector log, **framing not filtering**). Emission per §5.3: filled slots capped at `MAX_SLOTS_PER_REASON = 2` per reason, one-line empty-slot report per §4.1 status, `vector_execution_log`, `not_applicable_reasons`, `scope_mix`, `catalog_revision`. Include the §9 prohibited-inferences preamble in the block (same job as the gold serializer's embedded directives). | New `BronzeStandardRole` union — do NOT reuse `GoldStandardRole`; `'discovery'` collides by name but is a different directive text. Append the D5 catalog-drift note when `profile.catalog_revision < currentRevision()`. |
| 5.3 | `recordBronzeExternalFill(profileId, reasonKey, slot)` — §7.3: loads the **active** city bronze profile for scope; no active profile → note on the audit, write nothing (no fabricated coverage); writes a **new draft version** carrying prior `reason_coverage` forward + appended slot (`discovered_by` per caller); dedupe on `business_name` + address within the reason (update-in-place on re-audit); operator activates via existing `activateDraft`. | ⚠️ Reuse `importAsDraft`'s tuple identity — the new draft must share the active profile's id so activation retires it cleanly (identity tuple at :703-721). |
| 5.4 | Merge helper for the §7.3 carry-forward: given a prior active version's `reason_coverage` and a new scan payload, carry forward slots with `discovered_by ∈ {operator_self_discovery, business_audit}`, overlay scan-provenance fills. Pure function — unit-testable without DB. | Called by the Phase-6 import hook. |

## Phase 6 — Post-import hook + render injection

| # | Task | Files | Notes |
|---|------|-------|-------|
| 6.1 | `MarketingPromptService` — new post-import hook for `schemaName === 'bronze_standard_scan'` (sibling of the gold hook at :965-1041). **Keyed on schema name alone** — persists via `importAsDraft` with `intelligence_focus='bronze_standards'` for establishment AND discovery campaigns alike (§6.1: stage-2 runs are discovery-kind but still produce a profile). `reference_city/state` from the campaign; `reference_platform` from `campaign.intelligence_platform` when specific (not 'all'), else null — mirror gold's `scanPlatform` logic at :1007-1009 (spec's "reference_platform=null" is the default, not a rule — platform-scoped bronze runs exist per §3.6.5). Apply the Phase-5.4 merge so external-provenance slots survive re-scan. Best-effort try/catch, same as gold. | `MarketingPromptService.ts` | With `auditPlatform: null` (Phase 4.2), a bronze import creates the execution row + draft, no audit — spec-correct. |
| 6.2 | `MarketingExecutionService` — add `isBronzeStandardFocus` at :667 beside `isGoldStandardFocus`, and a dedicated bronze branch parallel to the gold branch (:679-875). **Establishment kind (stage 1):** base render + `serializeCatalogBlock(applicableReasons(national scope))` (D6) + region directive. **Discovery kind (stage 2):** resolve national bronze profile → inject `serializeBronzeStandard(profile, 'establishment_reference')` **plus the market's location-scoped catalog rows** (§6.3 — stage 2 consumes national snapshot + location rows; the spec §10.3 table mentions only the former — this is the second spec gap D6 covers); degraded-mode note when no national profile exists. | `MarketingExecutionService.ts` | ⚠️ **Critical ordering:** without this gate a bronze campaign falls into the 877 composer path, where `composeIntelligencePrompt`'s ternary (`PromptComposerService.ts:100`) silently loads the **competitive** focus fragment for any non-emerging focus. Add a test asserting bronze never reaches the composer. |
| 6.3 | Stage-3 injection — inside the 877 branch, **only when `focus === 'emerging'`** (§9: bronze never enters competitive output): `resolveBronzeStandard(category, campaignPlatform, campaignCity, campaignState)` → append `serializeBronzeStandard(profile, 'discovery')` beside the existing gold `discovery_benchmark` block + market-context block. Degraded note when absent (mirror the :958-971 pattern). | `MarketingExecutionService.ts` | The `renderPlatformDiscoveryDirective` call (:915) returns `''` for bronze — fine (defensive), but emerging+platform runs still get their directive since focus is `emerging` there, not bronze. |
| 6.4 | Region directive reuse check — `renderGoldStandardRegionDirective` (:2065) embeds "gold-standard profile" wording in its nationwide-fallback note (:2106). Either parameterize the profile-kind label or write `renderBronzeRegionDirective`. Prefer parameterize — one directive, two labels. | `MarketingExecutionService.ts` | Minor; avoids wrong-artifact wording in bronze prompts. |

## Phase 7 — Admin routes (`/api/admin/marketing-ops`)

Following the `/manual-script-templates` precedent (`marketing-ops.ts:2442-2584`). **Route order matters:** declare `/bronze-reasons/uncovered` and `/bronze-reasons/:reasonKey/test-scan` before `PUT /bronze-reasons/:reasonKey` so `uncovered`/`test-scan` aren't captured as reason keys.

| # | Route | Notes |
|---|-------|-------|
| 7.1 | `GET /bronze-reasons` — list, scope filters + `include_deprecated` flag. | §10.3. |
| 7.2 | `POST /bronze-reasons` — author; zod schema validates signals/vectors arrays, priority 1-5, scope fields; service normalizes + bumps revision. | §10.3. |
| 7.3 | `PUT /bronze-reasons/:reasonKey` — edit definition/signals/vectors/priority/scope; reject `reason_key` mutation (400). | §10.3. |
| 7.4 | `POST /bronze-reasons/:reasonKey/deprecate` — body `{deprecated_reason?, superseded_by?}`; validate `superseded_by` points at a live reason. | §3.5.6. |
| 7.5 | `GET /bronze-reasons/uncovered` — §3.5.3 staleness query; params `category_key, city, state, platform?, profile_catalog_revision`. | Register BEFORE `/:reasonKey`. |
| 7.6 | `POST /bronze-reasons/:reasonKey/test-scan` — **D3 two-mode.** `{city,state}` → rendered restricted prompt (catalog service + bronze city template body, single reason). `{city,state,scanOutput}` → validate via `bronzeStandardScanSchema`, return parsed outcome + vector log, persist nothing. | §3.5.5. |
| 7.7 | (D2) `POST /bronze-reasons/:reasonKey/external-fill` — body `{category_key, city, state, slot}` (slot = business_name, address, evidence fields); resolves the active city profile id and calls `recordBronzeExternalFill` with `discovered_by` from the caller context (`business_audit` / `operator_self_discovery`). | §7.3 write path entry point. |

## Phase 8 — Seed script + templates

| # | Task | Files | Notes |
|---|------|-------|-------|
| 8.1 | `seed-bronze-standard-scan-template.ts` — deterministic-id upsert per `seed-gold-standard-scan-template.ts` (`getTemplate` → `updateTemplate`/`createTemplate`; **note: that script has no `SEED_VERSION_MARKER`** — spec §10.4's claim is slightly off; upsert-in-place already reapplies, add a marker comment in the body anyway for dump-grepability). Two templates, both `promptType:'seek'`, `scope:'intelligence'`, `intelligenceFocus:'bronze_standards'`, `outputSchema:{name:'bronze_standard_scan'}`: `mpt-bronze-standard-national` (`intelligenceCampaignKind:'establishment'` — catalog snapshot + national proof slots; body must instruct echoing the injected catalog rows verbatim into the snapshot) and `mpt-bronze-standard-city` (`'discovery'` — city slot fills + `vector_execution_log` + 3-state empty vocabulary + `not_applicable_reasons`). | `apps/api/src/scripts/seed-bronze-standard-scan-template.ts` | ⚠️ Template variables: only `{{category}}`, `{{city}}`, `{{state}}`, `{{platform}}` are allowed under `SCOPE_VARIABLES.intelligence` (`scope-utils.ts:44`) — `renderTemplate` throws on anything else (`:2228`). Catalog/bronze blocks are **injected**, not templated — same as gold. |
| 8.2 | Run against **both** configs per AGENTS.md seed discipline: `doppler run --config local -- npx tsx src/scripts/seed-bronze-standard-scan-template.ts` then `--config prd`. Verify `updated_at` freshness. | — | From `apps/api`. |

## Phase 9 — Operator surfaces (`apps/web`)

| # | Task | Files | Notes |
|---|------|-------|-------|
| 9.1 | `MarketingOpsService.ts` — widen `IntelligenceFocus` (:5858, already carries `'proving_ground'`) + literal unions at :241/:1613/:1712; add `listBronzeReasons`, `createBronzeReason`, `updateBronzeReason`, `deprecateBronzeReason`, `getUncoveredBronzeReasons`, `testScanBronzeReason`, `addBronzeExternalFill` on `AdminApiSingleton`. | `apps/web/src/services/MarketingOpsService.ts` | Double-wrap contract: `result.data?.data ?? result.data`. |
| 9.2 | New admin page `marketing-ops/bronze-reasons/` — catalog table (key, label, scope badges, priority, provenance, revision stamps, deprecated state), author/edit drawer (scope defaults to universal per §3.6.3 — narrowing is deliberate; category dropdown from existing keys per 0.4; platform dropdown = gold vocab + "any"), deprecate+supersede dialog, uncovered-reasons viewer (pick category/city/state + profile revision → gap list), test-scan panel (two-mode per D3 — render prompt → paste result → view outcome). | `apps/web/src/app/(platform)/settings/admin/marketing-ops/bronze-reasons/` | Match sibling admin pages' kit (Tailwind + `@/components/ui/*` or Mantine — check `intelligence-profiles/` sibling before choosing; spec §10.1 says match, don't assume). |
| 9.3 | `CampaignFormClient.tsx` — add `bronze_standards` radio (:983 area) + kind-aware geo/platform logic: establishment → hide/require-nothing geo like gold (:289, :1002, :1023, :1071-1084), platform **optional** (unlike gold's requirement at :317); discovery → city/state required like emerging (:314). | `CampaignFormClient.tsx` | Mirrors the Phase-3.2 refine semantics — keep client and server rules identical. |
| 9.4 | (D2) "Add to bronze profile" action on the audit card — reason picker → `addBronzeExternalFill`. Only render when an active city bronze profile could exist (or let the API no-op with a clear message — prefer the API telling the truth over client-side guessing). | audit card component + service method | Deferred if D2 resolves differently. |

## Phase 10 — Tests (spec §10.5 + verification additions)

- `validators/__tests__/bronze-standard-scan.schema.test.ts` — §4 shape, all four enums, `catalog_revision` int, registry resolution via `resolveOutputSchema` (pattern: `gold-standard-scan.schema.test.ts:267`).
- `IntelligenceProfileService.bronze-standard.test.ts` — resolve cascade incl. platform layers (D1), serialize roles + caps (`MAX_SLOTS_PER_REASON`), `recordBronzeExternalFill` no-active-profile no-op / draft-not-mutate / dedupe / §7.3 merge.
- `BronzeReasonCatalogService.test.ts` — revision bump per write class (insert/update/deprecate/scope-change), immutable-key rejection, scope normalization + rejection of unnormalizable values, §3.5.3 predicate (new vs revised vs deprecated vs scope-mismatched), `superseded_by` validation.
- Import-hook tests — `bronze_standard_scan` persists a draft with `intelligence_focus='bronze_standards'` regardless of kind; no audit row (`auditPlatform: null`); activating a bronze draft leaves the active gold profile untouched (the §10.2 regression — the whole reason for Option A).
- Guardrail test — `bronze_standards`/`discovery` at category+city does not collide with active `gold_standards`/`discovery` or `emerging`/`establishment` at the same scope (pattern: `marketingCampaign.recovery.test.ts`).
- **Composer regression test** — a `bronze_standards` campaign never enters `composeIntelligencePrompt` (catches the competitive-fragment fallthrough).
- Refine tests — national bronze establishment creates without city/state; city discovery without city/state 400s; bronze never requires `intelligence_platform`.

## Phase 11 — Verification & rollout

1. `pnpm checkapi` **and** `pnpm checkweb`.
2. Api vitest suite green (fixtures + new files).
3. Apply `291_bronze_reason_catalog.sql` to `local` + `prd`; `prisma db pull` + `pnpm prisma generate`; confirm `mkt_bronze_*` models land.
4. Run the seed both configs; verify `updated_at` > seed commit.
5. **Render checks:**
   - Stage-1 national bronze establishment prompt contains the catalog block with all 17 (minus scope-filtered) seed reasons.
   - Stage-2 city bronze discovery prompt contains the national profile block (role `establishment_reference`) + the market's location-scoped catalog rows; degraded note when no national profile.
   - Stage-3 emerging discovery prompt contains the city bronze block (role `discovery`) beside the gold `discovery_benchmark` block.
   - **Negative:** competitive discovery prompt contains NO bronze block (§9).
   - Platform-scoped bronze run filters the reason set per §3.6.1.
6. **Import checks:** stage-1 payload → draft national profile stamped `catalog_revision`; stage-2 payload → draft city profile; activating bronze leaves gold active; external fill (7.7) lands as a new draft, never mutates active.
7. **Catalog checks:** author a reason via UI → revision bumps, row live; edit → `revised_in_revision` stamped; deprecate+supersede → excluded from `applicableReasons`, still readable; `/uncovered` returns `never_covered` + `revised_since_authored` correctly.
8. Catalog-drift note appears on the emitted bronze block when a stale profile is serialized (D5).

---

## Verification findings (2026-09-17, staging @ `7aa447b2`)

**Spec claims confirmed:**

- `generateIntelligenceProfileId()` → `mip-{nanoid}` — `lib/id-generator.ts:2254`.
- `mkt_intelligence_profiles`: `configuration_json Json` (schema.prisma:3850; the "any" is the service-layer cast), `intelligence_focus VarChar(20)` (:3854), `reference_platform VarChar(20)` (:3857). `mip-*` ids confirmed.
- `MAX_EXEMPLARS_PER_PLATFORM = 2` — `IntelligenceProfileService.ts:92`.
- `resolveGoldStandard(category, platform?, city?, state?, ctx?)` — :1832, city→state→nationwide cascade with platform-exact→cross-platform at each layer.
- `serializeGoldStandard(profile, role)` — :2023; `GoldStandardRole` (:74) includes `market_reference` (the §7.1 framing precedent) + `discovery`/`discovery_benchmark`/`benchmark`/`target`.
- `resolve(category, focus?, city?, platform?, ctx?)` — :292; matches spec's call shape.
- `importAsDraft` tuple lookup — :703-721 exactly; accepts `intelligenceFocus` + `referencePlatform` params already (no signature change needed, as spec claims).
- `activateDraft` retirement — :808-831 exactly; same tuple.
- `idx_mkt_intel_profiles_active_scope` — migration `249_intel_profiles_active_unique_scope.sql` — partial unique on `(category_key, intelligence_focus, COALESCE(city), COALESCE(state), COALESCE(platform)) WHERE status='active'`. Option-A analysis confirmed: a shared-focus bronze could never co-activate with gold.
- `findDuplicateCampaign` signature doc — `MarketingCampaignService.ts:512`; intelligence signature = scope+category+kind+focus+platform+city+state (:554-569). Bronze focus = distinct signature, no collision — confirmed.
- `['emerging','competitive']` focus gate — :2036 exactly.
- `IntelligenceFocus` unions — `MarketingPromptService.ts:37` (3 values, no `proving_ground`) vs `IntelligenceProfileService.ts:57` (4 values, has it) — drift confirmed.
- `marketing-ops.ts`: enum :283, refines :304-326 (gold requires platform :312, forbids city :322 / state :326; non-gold requires state :304 / city :308), enum :696, literal filter :2788, enum :7020 — all confirmed.
- `renderFocusBlockCore` — :1815, `return ''` at :1893 for unrecognized focus.
- `renderGoldStandardRegionDirective` — :2065; "span at least 3 distinct states/regions" :2078; "region-narrowed" prose :2106; no region entity/vocabulary/mapping exists — `regional_accessibility` is a 0-1 score (`regional-city-opportunity.schema.ts:201,465`). §3.6.4 cost analysis confirmed.
- `LEGACY_NO_SUFFIX_SCHEMAS` — :638-643.
- `evidence_snapshot_hash` — `SeedIntelligenceReportService.ts:208,309,354`.
- `mkt_manual_play_templates` — migration 288 applied, model at schema.prisma:7987; no CHECK constraints; `op_<slug>` comment at 288:19.
- No CHECK constraints on `intelligence_focus`/`intelligence_campaign_kind` anywhere in `database/migrations/` — grepped.
- `audit()` accepts `actorType: 'user'|'system'|'integration'|'customer'` — `audit.ts:12`.
- `CategoryMarketEnrichmentService` + `category_enrichment` schema (`directory-enrichment.schema.ts:27`) — §2.2 disambiguation confirmed; `INTELLIGENCE_CAMPAIGN_MARKET_CONTEXT_SPEC.md` §2 stage list matches the spec's quote.
- `business_analysis` emits `gap_analysis` + `quality_gate_results` — `business-analysis.schema.ts:693-694` (§7.3 input claim).
- `SCOPE_VARIABLES.intelligence` — `scope-utils.ts:44` includes category/city/state/platform; `renderTemplate` throws on out-of-scope vars (`MarketingExecutionService.ts:2228`).
- `composeIntelligencePrompt` resolves the profile via `profileService.resolve(category, focus, city, platform)` at `PromptComposerService.ts:123` — the §6.1 stage-3 mechanism.
- Admin surface: `settings/admin/marketing-ops/` exists (intelligence-profiles/, coverage/, etc.); `MarketingOpsService extends AdminApiSingleton` (:1843); `/manual-script-templates` routes at :2442-2584; `POST /prompts/executions/external` at :2932.
- Gold hook — `MarketingPromptService.ts:965-1041`: draft persistence gated on `kind==='establishment'`; discovery imports rely on `auditPlatform='gold_standard_scan'` for the Audits tab.
- Gold templates in live dump: `mpt-seed-gold-standard-scan-001` + `mpt-seed-gold-standard-scan-discovery-001` (`docs/api-response/seek-prompt-templates.md`).
- `manual-sql-migration-policy.md` at `.devin/skills/` — mkt_* = no RLS, no updated_at triggers confirmed.

**Corrections to spec wording:**

1. **§10.4 migration numbering is stale.** Spec says "highest file is 285 … next free number is 289." Since the spec was written, `286_directory_entry_whatsapp.sql` through `290_mkt_playbook_delivery_artifacts.sql` were committed. **Next free number is 291.** (The "never committed" hygiene issue self-resolved; also note the dir has duplicate-numbered pairs at 271–275 — check before writing.)
2. **§3.4 `op_<slug>` precedent** lives in migration `288_mkt_manual_play_templates.sql` (`-- op_<slug>, immutable`, line 19) and `ManualOutreachScriptService` — not in `manual-play-templates.ts` itself, whose code-catalog keys are plain slugs (`whatsapp_availability_upsell`). Same rule, wrong file citation.
3. **§10.3 gold template ids:** the discovery template is `mpt-seed-gold-standard-scan-discovery-001`, not `mpt-seed-gold-standard-discovery-001`.
4. **§10.4 `SEED_VERSION_MARKER`:** `seed-gold-standard-scan-template.ts` has none — it's deterministic-id update-in-place, which already reapplies. Marker convention belongs to the transform-style seeds; including a body marker is still useful for dump-greping.
5. **§10.3 `reference_platform=null`** on bronze imports is the default, not a rule: mirror the gold hook's `scanPlatform` logic (:1007-1009) so a platform-scoped bronze campaign stamps `reference_platform` — §3.6.5's platform-scoped profiles depend on it.
6. **§3.5.3 staleness query** omits the `scope_platform` clause — §3.6.1's five-clause predicate requires it; `uncoveredReasons` should accept `platform` (Phase 2.5).

**Spec gaps this plan fills:**

7. **Stage-1 catalog injection (D6):** §10.3 lists injection for the stage-2 and stage-3 paths only. Stage 1 consumes the catalog — it needs `serializeCatalogBlock` injected into the establishment-kind prompt, or it can't snapshot what it never saw.
8. **Stage-2 location-scoped rows:** §6.3 says stage 2 consumes the national snapshot **plus this market's location-scoped rows** — the §10.3 table mentions only the national block. Phase 6.2 covers both.
9. **`recordBronzeExternalFill` trigger (D2):** §7.3 defines the method; no caller is named, and `reasonKey` can't be inferred from audit output. Operator-initiated fill via a dedicated route is the sound trigger.
10. **Composer fallthrough hazard:** `composeIntelligencePrompt`'s fragment ternary (`PromptComposerService.ts:100`) loads the **competitive** focus fragment for any non-`emerging` focus. A `bronze_standards` campaign reaching the 877 branch (currently guaranteed — it's `!isGoldStandardFocus`) silently gets competitive framing. Phase 6.2's `isBronzeStandardFocus` gate + the Phase-10 regression test close it.
11. **Test-scan execution model (D3):** §3.5.5 says "returns the slot outcome" without naming an executor. No intelligence scan executes internally today (all external-agent); the two-mode endpoint keeps the ephemeral contract without inventing an internal runner.

**Additional touch points not in spec §10.2's enumeration:**

- `formatDiscoveryMarketContext` focus union — `MarketContextBindingFormatters.ts:413`.
- Route query-param unions — `marketing-ops.ts:7073, :7084, :7112`.
- `focusOrder` coverage-sort map — `IntelligenceProfileService.ts:2516`.
- Web: `MarketingOpsService.IntelligenceFocus` (:5858, has `proving_ground`), literal unions :241/:1613/:1712; `CampaignFormClient` radios + geo/platform logic (:91, :289-317, :400, :445-450, :662, :744, :971-984, :1002, :1023, :1071-1084).
- `renderPlatformDiscoveryDirective` returns `''` for unknown focus (:1954-1957 defensive) — correct behavior for bronze, no change.

## Out of scope (per spec §12 + decisions)

- Re-scan cadence machinery (spec open question 1) — re-runs are operator-triggered; the §7.3 merge already protects external fills.
- Region scope (§3.6.4) — deliberately unsupported; city+state only.
- Auto-detection of external fills (D2) — operator-initiated this sprint.
- Internal test-scan execution (D3) — render/validate only.
- ~~Folding stage 2 into the emerging-establishment campaign (D4)~~ — **shipped**: a city-scoped `emerging`/`establishment` campaign whose category has a resolvable bronze profile gets the folded stage-2 hunt list + `DUAL-PAYLOAD OUTPUT` directive (`MarketingExecutionService` establishment branch); PAYLOAD 2 imports via `bronze_standard_scan` against the same campaign (the schema-named hook already stamps the campaign's city/state). The bronze city template's campaign picker (`PromptWorkspaceClient.compatibleCampaigns`) surfaces `emerging`/`establishment` campaigns for that import. Separate campaign remains fully supported.
- Competitive-scan bronze injection — prohibited by §9.
