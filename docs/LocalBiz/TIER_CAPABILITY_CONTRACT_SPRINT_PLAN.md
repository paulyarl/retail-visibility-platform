# Tier & Capability Contract — Sprint Plan

> Companion to `.devin/skills/tier-hierarchy.md` (V3.1), `capability-module-cheatsheet.md`,
> `capability-resolution-mv.md`, `capability-data-flow-rules.md` (R1–R37),
> `add-capability-feature.md`, and `store-purchases-capability-checklist.md`.
>
> **Purpose — a fail-safe, not a feature.** The tier model and the capability
> contract are documented agreements spread across **twenty-plus files plus five
> database tables and one materialized view**, with nothing that *fails* when two
> of them disagree. `tier-hierarchy.md` itself carries a "Files that MUST stay in
> sync" list — a sync obligation enforced by memory and review, and itself already
> incomplete (Phase 0.1). This plan converts it into a test.
>
> **Why this one first.** Every defect class found on 2026-10-15 was the same
> shape: *a fact two consumers had to agree on, living in two places, with one
> writer changing it and nothing reconciling them.* Six instances shipped
> owner-facing false claims. The tier model is the **highest-stakes instance of
> that shape in the repo** — it gates capabilities and sets prices, so a silent
> divergence charges a customer the wrong amount or grants a capability the
> tenant did not buy.
>
> **Verification:** the doc inventory, inheritance rules, order arrays, pricing
> tables, and trial maps were read from source on 2026-10-15 — and the exercise
> itself surfaced live drift this plan must absorb (see **Verification
> findings**). Existing coverage is real but partial: `entry-presence-tier.test.ts`
> pins the presence feature bag, `CapabilityResolversOnOff.test.ts` and the
> per-resolver suites pin resolver-level gate semantics — nothing pins the copies
> *to each other*, which is where every observed defect lives. The audit is
> Phase 0; this plan does not assume its outcome.

---

## Decisions to settle before coding

| # | Question | Recommendation |
|---|---|---|
| D1 | **Assert first, or unify first?** A single `lib/tier-contract.ts` as the one source, or tests that pin the existing files to each other? | **Assert first.** A test that pins the current model across all files catches drift immediately at zero refactor risk. Extraction to a single source is a *follow-up*, justified by what the assertions reveal — unifying first means refactoring twenty files against an unverified model. |
| D2 | **What is the canonical source the test reads?** The runtime source of truth is Postgres — `subscription_tiers_list` + `tier_features_list`, loaded by `TierService.loadTiers()` (which calls itself "a single source of truth for tier data"; ~440 refs across `apps/api`). The web maps in `tier-features.ts` are a *parallel* model — `checkTierAccess` consults the DB first and falls back to hardcoded copies on failure. | **The fixture is canonical; the DB is one of its witnesses.** The committed JSON model (D6) is the contract. Both code sides assert against it, and a dump script (`subscription_tiers_list` + `tier_features_list` → JSON) lets a check compare fixture to live DB. Do **not** declare `tier-features.ts` canonical — it contradicts `TierService`'s documented role and cannot see admin-UI writes, so a code-only contract can go green while the DB drifts. |
| D3 | **Does the test assert the markdown doc?** | **Not by parsing prose.** v1 asserts the code model's internal consistency (Phase 1–3). Doc-sync is Phase 5 and reads a **generated** block — the doc carries machine-written tier/pricing tables the test regenerates and diffs. |
| D4 | **How much of R1–R37 do we test?** Thirty-seven rules is a large surface and most are placement guidance. | **Test the ones whose failure costs money or blocks an operator:** the key contract (`_enabled` / `_disabled` / `_flexible` / implicit / none), the `_disabled` veto precedence (subject to D7), and `granted=false` being **ignored, not a deny**. The rest are documented conventions, not invariants. |
| D5 | **The MV staleness window** — `mv_tenant_effective_capabilities` refreshes on a ≤10 min pg_cron. | **Scope it correctly first.** Per `capability-resolution-mv.md`, single-tenant reads (settings, post-purchase, `GET /:tenantId/effective-capabilities`) already use the live resolver — only bulk listing routes (`directory.ts`, `directory-mv.ts`, `directory-consolidated.ts`) read the MV. The window affects *public/other-viewer* surfaces, including a buyer's own directory card — not the purchaser's settings view. **0.7 is answered: the cron is scheduled, active, and succeeding on a clean 10-minute cadence — so the window is bounded as documented, not fiction.** The open item is committing the schedule (0.7), not proving it. Phase 6 owns the residual decision. |
| D6 | **Where does a cross-boundary test live?** `pnpm checkapi` and `pnpm checkweb` are separate projects. | **A shared committed fixture.** One JSON model (keys, order, prices, inheritance, key-contract semantics, trial map, module key lists, per-array roles) that *both* suites import and assert against — plus a DB-dump leg so the fixture also faces the catalog tables. Harness facts verified 2026-10-15: both vitest configs use `include: src/**/*.test.ts` (tests must live under `src/`; the fixture is importable via relative path, `resolveJsonModule` is set on both tsconfigs); `apps/api` tsconfig **excludes** `*.test.ts` (checkapi won't typecheck the suite — the vitest run is the gate); `apps/web` tsconfig does typecheck tests; `apps/web` has no `test` script and root `pnpm test` is bare `vitest` with no root config. |
| D7 | **Does `_disabled` veto purchases and admin grants?** The companion docs disagree: the cheatsheet says "absolute veto, wins over everything"; `capability-resolution-mv.md` says type gates are tier-only and purchases/overrides bypass them "intentionally"; migration `332_mv_gate_key_flow.sql` then reworked the mechanics (gate keys from *all* sources now reach resolvers; flexible expansion emits only non-negative keys — fixing live phantom vetoes). | **Decide before Phase 3.** Post-332 behavior is resolver-side veto on the merged map — a tier `_disabled` kills the module even for purchased features, which matches the cheatsheet and keeps admin grants as the documented escape path. Recommend pinning that as intent and correcting the stale "intentional bypass" note in the MV doc. If the decision goes the other way, Phase 3.1 changes sign. **Store consequence (not just an assertion question):** if the ruling is the cheatsheet's, the store must not **sell** a module whose tier carries `_disabled` — otherwise it sells what the veto kills. That is the `domainEnabled` class at the money layer, and it needs a sale-eligibility check against the merged map, added to `store-purchases-capability-checklist.md`. |
| D8 | **What is the tier-key universe?** `seed_preview`, `expired_trial`, `trial_*`, and `custom` are tier-shaped strings that appear in some maps and not others — `seed_preview` is in `SubscriptionTier` and `TIER_LIMITS` but in no order/display/pricing map; `custom` is in the canonical order but has no display name or price. | **Classify, don't flatten.** The fixture needs a `pseudo_tiers` class (never in `TIER_ORDER`, never purchasable, zero keys) distinct from `inactive_legacy` (present in order arrays, absent from GTM paths) — otherwise Phase 1.3's bidirectional check is unwritable. |
| D9 | **Where does inactive `starter` sit in `TIER_ORDER`?** Doc canonical: index 11 (after `enterprise`). `tipEngine.ts` and `GrowthTipService.ts`: index 3 (between `presence` and `discovery`). Code agrees with code; the doc disagrees — and the position is load-bearing for legacy tenants (`tierIndex('starter')` gates `isDiscoveryOrBelow`). | **Decide in Phase 0, pin in Phase 1.** Recommend pinning the doc order and fixing the two code copies — it keeps all active GTM tiers contiguous and makes position bugs impossible to hide behind inactivity. |

### Decided — 2026-10-16

| # | Ruling | Consequence |
|---|---|---|
| **D2** | **Fixture is canonical; the DB is one of its witnesses.** A committed JSON model is the contract; a dump script (`subscription_tiers_list` + `tier_features_list` → JSON) lets a check compare fixture to live DB. `tier-features.ts` is **not** canonical — it cannot see admin-UI writes. | The fixture is authored, not generated; the dump leg is a *check*, not the source. A code-only green cannot hide a DB drift. |
| **D7** | **`_disabled` is an absolute veto** — over `_enabled`, `_flexible`, purchases and admin grants. Post-332 resolver behaviour is the intent; the stale *"purchases bypass — intentional"* note in `capability-resolution-mv.md` gets corrected (Phase 5.4). | **The store must not sell a module whose tier carries the veto.** A sale-eligibility check against the merged map is now part of the work, recorded in `store-purchases-capability-checklist.md`. Without it the store sells what the veto kills. |
| **D8** | **Three classes:** `active` / `inactive_legacy` / `pseudo_tiers` (`seed_preview`, `expired_trial`, `trial_*`, `custom`). | Phase 1.3's bidirectional check becomes writable: active tiers need display name + price; `inactive_legacy` need order membership only; `pseudo_tiers` are exempt by rule. |
| **D1** | **Assert first.** Tests pin the ~23 existing files to each other; unification is a follow-up justified by what the assertions reveal. | Zero refactor risk up front. The full second model inside `middleware/tier-access.ts` gets *pinned*, not moved. |
| **D3** | **Generated block + diff.** The doc's tier-order and pricing tables are generated between markers; a test regenerates and fails on a non-empty diff. | The doc becomes a build artefact. Gated on 0.4's dormant-price decision (today the doc table lacks the `chain_*` / `google_only` / `trial` / `starter` rows that exist in code). |
| **D4** | **The three money rules:** the key contract, the veto precedence (per D7), and `granted=false` ignored rather than a deny. | R1–R37's remaining rules stay documented conventions, not invariants. The three chosen are the ones whose failure charges the wrong amount or blocks an operator. |
| **D9** | **Pin the CODE order — `starter` stays at index 3** (between `presence` and `discovery`); `tier-hierarchy.md` is corrected to match. **This reverses the plan's original recommendation** (doc order, index 11) on behaviour grounds. | No change for existing legacy `starter` tenants. Had the doc order been pinned, `tierIndex('starter')` would move 3 → 11 and legacy tenants would start ranking near `enterprise` in the tip and quick-link surfaces — a live behaviour change bought for tidiness. **The doc bends to the code here.** |

| **D5** | **Accept the bounded window; make it visible.** Single-tenant reads are already real-time via the resolver — the ≤10 min applies only to bulk listing routes and public surfaces. The purchase confirmation states when the capability activates. | Phase 6 owns the residual: whether a buyer's *own* directory card shows the unlock before the next refresh. Silence during the window is what reads as failure. |
| **D6** | **Repo-root `shared/` fixture.** One JSON file both suites import by relative path (`resolveJsonModule` is set on both tsconfigs). | One file, one truth, no alias tricks. Rejected: a `packages/` workspace (real setup for one JSON) and per-app copies (recreates the two-places problem). |
| **0.6** | **Delete the tier-relevant `.bak`s — narrowest defensible reading: the ones that DECLARE a tier map.** Deleted 2026-10-16: `middleware/tier-access.ts.bak`, `middleware/image-search-limits.ts.bak`, `services/TierService.ts.bak`. | **Scope caveat, recorded:** the boundary is not crisply definable. Three candidate sets exist — **3** by map *declaration* (deleted), **18** by name match, **23** by tier/capability identifier presence. `-name "*tier*"` is also case-sensitive and misses `TierService.ts.bak`. The stated purpose was *"kill the copies that can be mistaken for the model"*, which is the declaration set; widening to the other 20 is available but needs an explicit call. **The 493 remaining `.bak` files stay**, and the Phase 4.4 guard must still exclude `*.bak` by pattern — the deletion does not make the exclusion unnecessary. |

**All decisions settled: D1–D9 + 0.6.** No blockers remain.

### Decided — round 2, 2026-10-16

| # | Ruling | Consequence |
|---|---|---|
| **P1 — the private-map pattern** | **Export the maps.** Same treatment the four `TIER_ORDER`s already got. | Applies to 1.1's remaining arrays and **1.6's five trial maps**. Rejected: static file read (tests text, not value — a computed map evades it, which is the "goes green while the bug ships" failure mode this sprint exists to prevent) and behaviour-only (can't distinguish "map wrong" from "consumer wrong"). |
| **1.5a — chain mirror** | **Per-key: decide deliberate-vs-omission by family.** | The 14 splits: **deliberate** — `clover_pos`, `square_pos`, `payment_client_credentials` (POS/payment integration keys a chain tier plausibly excludes); **likely omission** — `basic_categories`, `business_logo`, `interactive_maps`, `privacy_mode`, `custom_marketing_copy`, `priority_support`, `advanced_analytics`, `sla_guarantee`, `custom_integrations`, `customDomains`, `category_quick_start`, `image_finder`. The `it.fails` assertion stays until each is dispositioned; promoting it means all 14 are resolved one way or the other. |
| **Next work** | **1.5c — the `propagation_*` fix.** | The one genuine defect found. 11 keys mapped to a tier whose bag contradicts them. |

### Decided — round 3, 2026-10-16

| # | Ruling | Implementation |
|---|---|---|
| **1.5c orphans** | **Add to the `organization` bag.** `propagation_selective`, `propagation_scheduling`, `propagation_rollback` become real org-tier grants. | Add the three keys to `TIER_FEATURES.organization` in `tier-features.ts`. The bag is at ~`:85-98` (the one already listing `propagation_products` … `propagation_brand`); the `organization` key is below the first six tier keys. Once added, direction (A) of the 1.5 diagnostic drops by three and 1.5c is closed. |
| **1.7 default** | **One shared default: `directory_presence`** — the free gateway, least privilege. | Export a single constant (e.g. `DEFAULT_TIER = 'directory_presence'`) and use it at all five sites: `mapTierLevel`, `hasFeature` (**currently `starter` — the INACTIVE legacy tier**, the most suspicious of the five), `getRequiredTier` (currently `professional`), `getSKULimit(null)` (currently `starter`), `getEffectiveTier(null)` (currently `discovery`). Then assert it once. |

**Note on 1.7's blast radius:** `getRequiredTier` currently answers `professional` — a *high* default for an unknown feature. Moving it to `directory_presence` **loosens** that gate, so a tenant with no tier gains access where it previously had none. That is the correct direction (least privilege for the *tenant*, and `professional` was never a defensible answer for "unknown"), but it is a behaviour change on an access path and deserves its own test, not a drive-by edit.



### 1.5c — DIAGNOSED 2026-10-16: it is naming drift, not missing grants

Reading the bag against the map settles the direction question — and it was the wrong question.

**The bag lists 8 propagation keys** (`tier-features.ts:91-98`):

```
propagation_products · propagation_categories · propagation_gbp_sync · propagation_hours
propagation_profile · propagation_flags · propagation_roles · propagation_brand
```

**The map names 11** (`:188-202`), and **three are stale renames of bag keys**:

| Map key (stale) | Bag key (live) | Also in `TIER_DISPLAY_NAMES`? |
|---|---|---|
| `propagation_user_roles` | **`propagation_roles`** | `propagation_roles` only (`:315`) |
| `propagation_feature_flags` | **`propagation_flags`** | `propagation_flags` only (`:314`) |
| `propagation_brand_assets` | **`propagation_brand`** | `propagation_brand` only (`:316`) |

**The display-name map sides with the bag**, and the three stale names appear in no other structure — so the map carries three dead aliases that nothing resolves.

**And three map keys are genuinely absent from every bag:** `propagation_selective`, `propagation_scheduling`, `propagation_rollback` (`:200-202`). These are the only real "mapped but never granted" cases.

**So the fix is three renames, not eleven bag additions** — and the commercial question I flagged (granting chain-propagation to `starter`) **does not arise**. It never was a product decision; it is a key-naming cleanup. Corrected disposition:

| Sub-item | Disposition |
|---|---|
| 3 stale aliases (`propagation_user_roles`, `propagation_feature_flags`, `propagation_brand_assets`) | **Fix code** — rename in `FEATURE_TIER_MAP` to the bag's live names |
| 3 orphans (`propagation_selective`, `propagation_scheduling`, `propagation_rollback`) | **Needs a call** — either add to the `organization` bag or remove from the map. They are advertised as org-tier features with no grant behind them |
| `propagation_products → starter` (the plan's original claim) | **Confirmed, and it is the bag's tier that needs checking** — not the map's key |



---

## Green baseline — establish before Phase 0

**The suite was already red when this plan was written.** Seven failures in three files were found on 2026-10-16, **proven pre-existing** by stashing the working changes and re-running against `HEAD`. All seven are fixed (see the disposition table); a full-suite run now stands at **4082 tests, 4 failures**, none of them in this plan's scope.

This section exists because of the plan's own remediation gate: *"a permanently red suite is worse than none."* New assertions landing in a suite nobody trusts are worthless — so the baseline is the first deliverable, not a nicety.

### Fixed (the seven, all one class)

| File | Fails | Disposition |
|---|---|---|
| `int-discovery-signals-parity.test.ts` | 1 | **Real gap, fixed.** `INT_POSSIBLE_DUPLICATE_LISTING` was seeded but absent from both `INT_SIGNAL_LABELS` maps — a signal with no label. Added to both; the stale *"closed, spec-defined 11-code family"* comment (the seed carries **13**) replaced with a pointer to the seed and to this test. |
| `HookSuggestionService.test.ts` | 5 | **Stale test, fixed.** Five hardcoded `23`s while the library had grown to 24. Now derived from `HOOK_LIBRARY.length` — the assertion's real contract is *"returns all hooks"*, not a magic number. |
| `resolveCampaignVerification.test.ts` | 1 | **Stale assertion, fixed.** It asserted `executeRaw` was never called as a proxy for "no seed back-fill" — but the seed back-fill uses **`executeRawUnsafe`** (dynamic identifiers), and `executeRaw` is the *prospect-queue* back-fill, which is independent of the seed link and expected to run. Re-targeted at the method the seed back-fill actually uses. |

### Resolved (the remaining 4) — achieved 2026-10-16

| File | Was | Fix |
|---|---|---|
| `src/tests/bronze-import-hook.test.ts` | timeout + a **cascading assertion failure** | **Not a product bug.** Verified by instrumenting the gate evaluation: the payload and the code are both correct (`passed: true` → `failedGates` empty → early return). The 5 s timeout on the *previous* test let its in-flight `importExternalResult` resolve **during the next test**, whose `not.toHaveBeenCalled()` then caught the earlier test's fill. Raised that test's timeout to 20 s; the cascade disappears. |
| `src/tests/analyst-hook-roundtrip.test.ts` | timeout | Raised to 20 s — it parses a full payload and persists it. |
| `src/jobs/rates.test.ts` | env + timeout | Passes under doppler. |
| `src/tests/route-coverage.test.ts` | env | **Passes under doppler.** |
| `VercelGatewayProvider.test.ts` | env | Passes under doppler — the bare-run failure is env-dependent factory routing, not product behaviour. |

**The lesson worth keeping:** a timeout is not a neutral failure. It leaks an in-flight promise into the *next* test, where it surfaces as a wrong-looking assertion. The red test was innocent; the slow one beside it was the cause.

### Baseline: GREEN

```
cd apps/api && doppler run --config local -- npx vitest run

Test Files  239 passed (239)
Tests       4095 passed | 1 skipped (4096)
```

**Zero failures.** Bare `npx vitest run` is *not* the baseline — the Supabase-dependent suites fail without env, which reads as "failed suites, 0 tests" and looks like a code failure. Any CI wiring (Phase 7) must run under doppler.

**The baseline is now the tripwire:** from here, any new red is this sprint's, not inherited.

---

## Phase 0 — Pre-flight

| # | Task | Files | Notes |
|---|---|---|---|
| 0.1 | **Inventory by grep sweep, not by the doc's list.** The doc's 13-code-file list is already incomplete — the real surface is 20+ files. Sweep `apps/**` for `TIER_ORDER`, `TIER_HIERARCHY`, `TIER_FEATURES`, `FEATURE_TIER_MAP`, `TIER_PRICING`, `TIER_DISPLAY_NAMES`, `tierIndex`, `trialToBaseMap`, and per-tier string arrays. For each file record: which maps it holds, whether it derives or duplicates, and **array role** (full order / intended subset / pair-compare) — Phase 1.1 depends on that classification. Members the doc's list misses (found 2026-10-15): `middleware/tier-access.ts` (named in `tier-features.ts`'s own sync header; already diverged — see Findings), `middleware/tier-access.ts.bak`, `orgTipEngine.ts`, `ShopTierMiddleware.ts` (separate shop-tier namespace — rule on scope in 0.6), `QuickLinksService.ts`, `NextStepsService.ts`, `TierFeatureService.ts`, `PublicTierFeatureService.ts`, `useTierConfig.ts`, `tiers/index.ts`, `CapabilityComparisonMatrix.tsx`, `TierFeaturesClient.tsx`, `subscription/page.tsx`, `promotion/page.tsx`, `app/api/admin/capabilities/route.ts`, `components/tenants/types.ts`, `DemoTenantService.ts`, `seed-preview.ts`, `website-build.ts`. | All of the above + the doc's 13 | **Do not assume duplication.** Some derive from shared exports; the audit separates real duplication from derived views — only the former needs asserting. |
| 0.2 | **Inventory the DB contract surface.** `subscription_tiers_list` (keys, `sort_order`, `price_monthly`, `display_name`, `is_active`), `tier_features_list` (grants per tier), `features_list` + `capability_features_list` + `capability_type_list` (module key lists), `tenant_feature_purchases` / `tenant_feature_overrides_list` (grant sources), and the MV definition (migrations 089/090/332). Decide the dump mechanism for the fixture↔DB leg (read-only SQL → JSON, runnable per env via doppler). | `apps/api/prisma/schema.prisma`, `database/migrations/{089,090,332}_*.sql` | Without this leg the contract tests two secondary representations against each other while the authoritative data sits unexamined. |
| 0.3 | Confirm `TIER_ORDER` membership in each full-order array: the two documented critical insertions (`ecommerce` between `commitment` and `omnichannel`; `organization` between `professional` and `enterprise`), `directory_presence` before the paid entry modes, and the inactive-legacy entries (`starter`, `google_only`, `chain_*`, `custom`). Settle D9 (`starter` position) here. | `tipEngine.ts`, `tier-resolver.ts`, `GrowthTipService.ts`, `tier-access.ts`, `QuickLinksService.ts`, `NextStepsService.ts` | The doc warns: *"missing either collapses index fallbacks and mis-gates capabilities"* — `QuickLinksService`/`NextStepsService` are already missing `presence`, `ecommerce`, **and** `organization`, a live mis-gating bug, not a hypothetical. |
| 0.4 | Confirm the pricing table in code against the doc — **including dormant rows**: `directory_presence` 0, `presence` 19, `discovery` 29, `storefront` 59, `commitment` 79, `ecommerce` 99, `omnichannel` 149, `professional` 199, `organization` 499, `enterprise` 499; plus code-only rows `google_only` 29, `chain_starter` 199, `chain_professional` 1999, `chain_enterprise` 4999, and `tier-access.ts`'s `trial` 0 / `starter` 49. | `tier-features.ts` (`TIER_PRICING`), `tier-access.ts`, `subscription_tiers_list` | Decide whether dormant/chain prices enter the fixture before Phase 5 generates the doc table — a naive bidirectional check fails on these rows either way. |
| 0.5 | Harness facts (verified, D6): both suites include `src/**/*.test.ts` only; fixture imports by relative path work; `checkweb` typechecks tests, `checkapi` does not. Decide fixture location (e.g., `shared/tier-contract.json` at repo root, or `packages/`). | `vitest.config.ts` ×2, `tsconfig.json` ×2 | Remaining question is where the fixture lives so both suites import it without alias tricks. |
| 0.6 | Delete `apps/api/src/middleware/tier-access.ts.bak`; rule on whether `ShopTierMiddleware`'s `basic/premium/enterprise` shop-tier model is inside the contract's scope. | — | The `.bak` is a stale full copy of the maps sitting in `src/` — a drift trap whether or not anything imports it. |
| 0.7 | **Answered 2026-10-15 — scheduled and healthy, but it needs committing, not verifying.** prd: `cron.job` **jobid 120**, `refresh-mv_tenant_effective_capabilities`, `*/10 * * * *`, `active: true`; `cron.job_run_details` shows `succeeded` at 03:00 / 03:10 / 03:20 / 03:30 — a clean cadence. **So D5's premise holds.** But the schedule is still **not reproducible from the repo** (only the commented snippet in `089`). The idiom already exists: `315_scheduled_job_runs_retention.sql` guards `cron.schedule` on `IF EXISTS (… extname = 'pg_cron') AND NOT EXISTS (… cron.job WHERE jobname = …)`. | `database/migrations/339_mv_refresh_cron.sql` | **DONE 2026-10-16 — landed as `339`** (316 was taken). Schedules `refresh-mv_tenant_effective_capabilities` at `*/10 * * * *` via 315's guarded `pg_cron` idiom: no-op on prd (job 120 exists), installs on a fresh env, skips where pg_cron is absent. Second reason it matters: 315's header says *"Every **migrated** job now records a run row"* — job 120 was not a migrated job. *(Inferred from 315's wording — `cron.job_run_details` does have it.)* Committing brings it into that mechanism. |
| 0.8 | Settle D1–D9. | — | D5/D6/D7/D8/D9 all change the shape of the work; D1 decides whether this sprint ends with a test or a refactor. |

### 0.1 — the actual inventory (sweep run 2026-10-16)

The sweep found **more than the plan's own list** — which is the point of sweeping rather than reading a list. Counts are declaration sites, not usages.

**Tier-order arrays (each with its own `tierIndex`) — 4**

| File | Note |
|---|---|
| `apps/api/src/services/QuickLinksService.ts:156` | **Fixed** in the hotfix — was missing `presence`, `ecommerce`, `organization` |
| `apps/api/src/services/NextStepsService.ts:181` | **Fixed** in the hotfix — same three missing |
| `apps/api/src/services/GrowthTipService.ts:141` | **D9's other copy** — `starter` at index 3 |
| `apps/web/src/lib/growth-tips/tipEngine.ts:88` | **D9's other copy** — same |

**Divergent inline orders — 2 more (not in the plan's list)**

| File | Note |
|---|---|
| `apps/web/src/app/api/admin/capabilities/route.ts:89` | `{ discovery:1, storefront:2, professional:3, enterprise:4 }` — a **4-tier** order; most tiers absent |
| `apps/web/src/app/(platform)/settings/subscription/page.tsx:1064` | `['starter','discovery','commitment','storefront','professional','enterprise']` — missing `directory_presence`, `presence`, `ecommerce`, `omnichannel`, `organization` |

**Full model copies — 2**

| File | Holds |
|---|---|
| `apps/web/src/lib/tiers/tier-features.ts` | `TIER_FEATURES`, `TIER_HIERARCHY`, `FEATURE_TIER_MAP`, `TIER_DISPLAY_NAMES`, `TIER_PRICING` — all five |
| **`apps/api/src/middleware/tier-access.ts`** | `TIER_FEATURES` (**exported**), `TIER_HIERARCHY`, `FEATURE_TIER_MAP`, plus its own `tierOrder` at :242 — **a complete second model in the API** |

**Trial maps — 5, not 4** (the plan undercounted)

`trial-tier-transparency.ts:28` · `tier-limits.ts:29` · `TierService.ts:18` · **`commerce-capabilities.ts:71` and `:193` (two in one file)** · plus a stale copy in `TierService.ts.bak:17`

**`TIER_LIMITS` copies — 4**

`apps/api/src/utils/tier-limits.ts:57` · `apps/web/src/lib/tiers.ts:37` · `apps/api/src/utils/trash-capacity.ts:12` · `apps/api/src/middleware/image-search-limits.ts:19`

**`TIER_DISPLAY_NAMES` — 3**

`tier-features.ts:221` · `apps/web/src/components/tenants/types.ts:104` · `tier-access.ts` (via its own model)

**A third `TIER_FEATURES`** — `apps/web/src/app/t/[tenantId]/settings/promotion/page.tsx:12`

**A `.bak` shadow tree — 496 files, not three.** The plan named one (`tier-access.ts.bak`); there are **496 `.bak` files tracked in git, all under `apps/api/src/`, against 1414 real `.ts` files** — a shadow tree ~35% the size of the source tree. Tier-relevant members include `tier-access.ts.bak`, `TierService.ts.bak`, `image-search-limits.ts.bak`, `sku-limits.ts.bak`, `subscription.ts.bak`, `tier-validation.ts.bak`, `tier-config.ts.bak`, `tiers.ts.bak`, `tenant-tier.ts.bak`, `public-tier-config.ts.bak`, `admin-tiers.ts.bak`.

They are **not compiled** (TypeScript ignores `.bak`, which is why `checkapi` passes with them present) — so they break nothing. What they do is **poison every search**: this very sweep matched `tier-access.ts.bak` and `TierService.ts.bak` alongside the live files, and `tier-access.ts.bak`'s `tierOrder` (:238) already differs from its live counterpart's (:242). Any future reader — human or agent — can copy from the wrong one.

**This is a scope decision, not a cleanup.** Deleting 496 tracked files is well beyond this plan's sanction and needs an explicit call; the tier contract does not require it. Two viable answers:

1. **Exclude by pattern, don't delete.** The contract's Phase 4.4 guard already scans statically — scope it to `*.ts` (never `*.bak`), and the inventory ignores the shadow tree entirely. Cheapest, reversible, no history rewrite.
2. **Delete the shadow tree** as its own change, with its own justification — the `.bak` convention is not documented anywhere, and 496 unreviewed copies of routing/middleware/services is a standing hazard independent of this sprint.

**Recommendation: (1) now, (2) as a separate decision.** The contract must not depend on the `.bak` question, and 496 deletions should not ride along inside a test sprint.

### 0.3 — verified: the four order arrays are now identical

All four `TIER_ORDER` declarations carry the **same 16 keys in the same order**:

```
'directory_presence', 'google_only', 'presence', 'starter', 'discovery', 'storefront',
'commitment', 'ecommerce', 'omnichannel', 'professional', 'organization', 'enterprise',
'chain_starter', 'chain_professional', 'chain_enterprise', 'custom'
```

`tipEngine.ts:88` and `GrowthTipService.ts:141` **already had `presence` / `ecommerce` / `organization`** — only `QuickLinksService` and `NextStepsService` were missing them, which the hotfix corrected. **The code agrees with itself 4/4; the doc disagrees** — `starter` sits at **index 3** in all four and at **index 11** in the documented order. That is precisely D9, and it is uniform, so it is one decision rather than four.

**One mechanic worth recording:** every copy's `tierIndex` returns **0** for an unknown key (`idx >= 0 ? idx : 0`). A missing tier therefore compares as `directory_presence` — the *lowest* rung — so an omission is a **silent under-gate**, never a crash. That is why this survived: the symptom was a tenant quietly comparing below where it belonged, not an error.

**One more order array found (0.1 addendum):** `apps/web/src/lib/features/feature-catalog.ts:431` uses its own `tierHierarchy.indexOf(tierLevel)` — a fifth order source the declaration-anchored sweep did not name. Include it in the fixture's per-array role map.

**Separate namespace — out of scope pending 0.6**

`apps/web/src/services/tiers/ShopTierMiddleware.ts:283` — `['basic','premium','enterprise']` is the **shop-tier** model, not the subscription tier model. `promotion/page.tsx:163`'s `['basic','premium','featured']` belongs with it.

**Revised count: ~23 files, 3 `.bak` copies, 6 divergent order arrays, 5 trial maps, 4 `TIER_LIMITS` copies, 3 `TIER_DISPLAY_NAMES` copies.** The plan's "twenty-plus" was right; its *list* was not — which is why 0.1 is a sweep.

**New scope question for 0.6:** do the three `.bak` files get deleted, and is the shop-tier namespace in or out? Both are cheap now and expensive once the fixture exists.

### 0.2 progress — 2026-10-16 (witness leg landed; prd dump committed)

`apps/api/scripts/dump-tier-contract.cjs` (read-only, plain `pg`, doppler per env like db-rescue) → `shared/tier-contract-db-witness.json` (26 tiers, 30 capability types). `tier-db-witness.test.ts` (9/9) pins DB↔contract parity: every DB tier classified, every `active` tier `is_active` in DB, critical order invariants on `sort_order`, active-tier prices vs fixture, veto-linkage completeness. **prd findings, all recorded as explicit baselines/divergence entries rather than silently asserted:**

- **`organization` is priced $399 in the DB itself** — the same row that made `tier-access.ts` quote $399 (fixed in 1.1); fixture/doc/web all say $499. The DB row is a live divergence needing a ruling (which price is true?), recorded in `KNOWN_PRICE_DIVERGENCES` alongside `enterprise`'s $499.99 rounding.
- **3.6's premise is falsified.** The doc said `presence`/`seed_preview`/`chain_*`/`trial_*` "carry zero keys — never `_disabled`." Reality: `seed_preview` vetoes `payment_gateway`, `chain_*`/`enterprise`/`organization` veto `wholesale_matching`, `commitment`+`chain_starter` veto `coupon`, `discovery` carries 14 vetoes, `storefront` 4, `directory_presence` 1. And every `trial_*` row carries `coupon_disabled`/`funnel_options_disabled`. The current veto set is pinned as a drift guard (`TIER_VETO_BASELINE`); whether each veto is *intended* is a ruling the fixture can't make.
- **Dormant vetoes exist:** `presence` holds 9 `*_disabled` rows with `is_enabled=false` — inert today, one UPDATE from live. Worth knowing they exist.
- **The `trial_*` tier rows' feature bags are dead data.** Both the MV and the resolver proxy `trial_*` → base BEFORE reading `tier_features_list` — the bags (some large: `trial_omnichannel` 123 keys, `trial_professional` 117) are never consulted on resolve paths, and several carry keys their base lacks (so they'd *mis*lead any raw-key read path, e.g. admin "what's in this tier" views). Ruling pending: prune, or keep for a path that reads them.
- **MV trial coverage gap confirmed:** DB has 9 `trial_*` rows; the MV maps 12 keys (incl. `trial_enterprise`, `trial_chain_professional`, `trial_chain_enterprise` — no DB rows) and canonical has 15. `trial_presence`/`trial_directory_presence`/`trial_organization` are fixture-mapped but have neither a DB row nor an MV entry.
- **`custom` has no DB row** — consistent with its pseudo/assigned nature; the witness treats "fixture order key without a DB row" as allowed only for `custom`.
- **DB `sort_order` is a different axis than `tier_order`** (chain tiers at 7–9 before `presence` at 10, trials at 101+). Only the critical invariants are pinned on it; full-order parity is deliberately not asserted.

---

## Hotfix ahead of this sprint

Two Phase 0 findings are **live tenant-facing bugs today**, not sprint work. Both are small, and both should land *before* the suite exists to catch them — a suite that documents a bug it could have fixed is worse than the fix.

| # | Bug | Evidence | Why now |
|---|---|---|---|
| H1 | `QuickLinksService` / `NextStepsService` `TIER_ORDER`s lack `presence`, `ecommerce`, **and** `organization` | `tierIndex` falls back to 0, so an `ecommerce` tenant compares *below* `commitment` — live mis-gating on two operator surfaces | The fix is array entries (subject to 0.1's role classification); the bug is active |
| H2 | `expired_trial` → `presence` only in `tier-limits`; `getEffectiveTier` returns it unmapped | One tenant, two different feature answers depending on the read path (1.6) | This *is* the class the plan exists to kill — and it is currently shipping |

Everything else in Phase 0 is latent: dormant price rows, the `.bak`, the chain tiers, the doc's stale tables, the divergence in `tier-access.ts` (which the contract will pin rather than hotfix). Those can wait for the sprint.

---

## Phase 1 — The tier model contract

Asserts the model's internal consistency. Pure, no DB, no mocks. **Every red assertion routes to the remediation gate below** — expect several on day one; a permanently red suite is worse than none.

| # | Task | Notes |
|---|---|---|
| 1.1 | Each **full-order** array (per 0.1's role classification) contains every active + inactive-legacy key in the documented order — including `directory_presence` before the paid entry modes. **Intended-subset** arrays (`orgTipEngine`, `getUpgradeOptions`, the gateway triad in `directory-presence-upgrade`) assert relative order and documented exclusions instead — they are not bugs by construction. | The doc: *"gateway is never scored as discovery."* |
| 1.2 | `ecommerce` sits between `commitment` and `omnichannel`; `organization` between `professional` and `enterprise`. | Asserted by index position, not membership — the failure mode is mis-ordering, not absence. |
| 1.3 | Every key in the fixture's tier universe resolves in `TIER_DISPLAY_NAMES` and `TIER_PRICING` per its D8 class: active tiers need both; `inactive_legacy` need order-membership only; `pseudo_tiers` (`seed_preview`, `expired_trial`, `trial_*`, `custom`) are explicitly exempt by rule. | Bidirectional within each class — a display name with no tier is as wrong as a tier with no price. Today `custom` violates this on both sides. |
| 1.4 | `presence`'s display name is `"Starter"` and `starter` is inactive legacy — present in order arrays, absent from primary GTM paths. | The doc's bug #1. Partially covered by `entry-presence-tier.test.ts` — fold it in, don't duplicate. |
| 1.5 | `TIER_FEATURES` and `FEATURE_TIER_MAP` agree in both directions for every tier they share. | **⚠️ PREMISE CORRECTED — see "1.5 is unwritable as specified" below.** The two structures are **not inverses**, so a naive bidirectional check cannot be written. |
| 1.6 | **The trial map is one map with five copies** — fixture pins `trial_*` → base for all of: the MV `trial_map` CTE (migration 332), `TierService.getBaseTierForTrial`, `tier-limits.getBaseTierForTrial`, `trial-tier-transparency.getBaseTierForTrial`. | **⚠️ PREREQUISITE (same as 1.1): every copy is a private `const trialToBaseMap` inside its function — none is exported.** Pick the 1.1 pattern (export vs static read) before writing the assertion; it applies five times here. Confirmed copies from the 0.1 sweep: `trial-tier-transparency.ts:28`, `tier-limits.ts:29`, `TierService.ts:18`, **`commerce-capabilities.ts:71` and `:193` (two in one file)**, plus the MV's `trial_map` CTE in migration 332 (SQL — needs the 3.7 mechanism, not a unit test). **Already divergent:** `trial_chain_starter` → `starter` in `tier-limits` vs `chain_starter` in `trial-tier-transparency`; `trial_presence` / `trial_directory_presence` / `trial_organization` exist only in the transparency util; `expired_trial` is absent from the transparency map **by design** (see H2) but present in `tier-limits` as `→ presence`. **That last one is NOT a defect** — the two maps answer different questions (presentation vs limits), which is why they were renamed in the hotfix. |
| 1.7 | **Pin the silent defaults.** `mapTierLevel` default → `'discovery'`; `hasFeature` fallback tier → `'starter'` (the inactive legacy!); `getRequiredTier` unknown feature → `'professional'`; `getSKULimit(null)` → `starter`; `getEffectiveTier(null)` → `'discovery'`. | Five different opinions on "tenant with no tier" — the fixture names the intended default per call site or a shared one. |

### 1.1 progress — 2026-10-16 (order arrays, all four roles dispositioned)

| Copy | Role | Disposition |
|---|---|---|
| `tier-access.ts:242` inline `tierOrder` | wanted-full-order | **Fixed + pinned.** Was missing `omnichannel`/`chain_*`/`custom` and ordered `ecommerce` after `professional` — `indexOf` → -1 meant an omnichannel tenant silently failed any ecommerce+ check on the DB-failure fallback path. Hoisted to module scope as `FALLBACK_TIER_ORDER`, aligned to the fixture, added to the api suite's `COPIES`. |
| `feature-catalog.ts:430` `tierHierarchy` | intended-subset (legacy 4-rung vocabulary) | Exported as `CATALOG_TIER_ORDER`; relative-order pinned (no membership claim). |
| `admin/capabilities/route.ts:89` | intended-subset (sparse sort for the 4 tiers the route iterates) | Exported as `CAPABILITY_TIER_SORT_ORDER`; relative-order pinned. |
| `subscription/page.tsx:1064` | wanted-full-order | **Fixed inline** to the fixture order — it was a live mis-badging bug (direction computed `toIndex > fromIndex` on a 6-key subset; any transition touching `presence`/`ecommerce`/`omnichannel`/`organization`/`directory_presence` hit `indexOf` → -1). Page can't be imported by vitest — belongs to the 4.4 static-guard list. |
| `orgTipEngine`, `tier-resolver` pairs | intended-subset (chain-only; public-comparison subset per the reduction proposal) | Classified; relative order already consistent — no change needed. |

**Found while pinning:** `getTierPricing` in `tier-access.ts` priced `organization` at **$399** vs $499 everywhere else (web `TIER_PRICING`, fixture, doc). Fixed → 499. The api-side pricing map still isn't asserted — it belongs in the 1.3/pricing leg when that extends past the web copy (`trial: 0`, `starter: 49` dormant rows stay parked under 0.4's undecided policy).

### 1.6 progress — 2026-10-16 (trial maps exported, completed, pinned)

Fixture gained `trial_map` (`canonical` 15-key convention + `site_exceptions` + `not_mapped`) and a `trial_eligible` block recorded as an **open question** (see below). Four api maps exported per P1 and completed to full canonical coverage; the MV `trial_map` CTE stays with the 3.7 SQL leg.

| Copy | Exported as | Coverage gaps fixed (were live silent defaults) |
|---|---|---|
| `trial-tier-transparency.ts` | `PRESENTATION_TRIAL_BASE_TIERS` | none — already the full 15 |
| `tier-limits.ts` | `LIMIT_TRIAL_BASE_TIERS` | +`trial_presence`→presence (was falling through to discovery's 75 SKUs vs presence's 0), +`trial_directory_presence`→directory_presence (75 vs 5), +`trial_enterprise`→enterprise (75 vs 10000) |
| `TierService.ts` | `FEATURE_TRIAL_BASE_TIERS` | +`trial_presence`, `trial_directory_presence`, `trial_organization` — unmapped keys looked up literal `trial_*` rows → zero features |
| `commerce-capabilities.ts` (was 2 identical copies) | `COMMERCE_TRIAL_BASE_TIERS` | +6 keys incl. `trial_ecommerce`/`trial_omnichannel` — a `trial_ecommerce` tenant's commerce resolved off a nonexistent tier row → `commerce_enabled` silently false |

`tier-limits`' chain-trial → display-twin entries and `expired_trial`→presence are the fixture's `site_exceptions` (TIER_LIMITS has no chain_* rows; the split is H2-deliberate). `expired_trial` stays unmapped everywhere else, pinned by a dedicated test. Suites: api `tier-trial-map.test.ts` 14/14, web `tier-trial-map.test.ts` (pins `TIER_LIMITS[*].trialTarget`) 3/3, both typechecks clean.

**Found while pinning — trial eligibility is a fifth, undecided list.** `TrialManagementService.TRIAL_ELIGIBLE_TIERS` (6, no `starter`) vs the `trial-setup.ts` zod enum + web `TrialService` union (7, incl. `starter`) vs two **dead** lists (`web/lib/tiers.ts` and `packages/shared/lib/tiers.ts` — zero importers, both stale and mutually disagreeing). Whether `starter` trials are sellable is a product decision; recorded in the fixture's `trial_eligible` block rather than guessed. Dead lists are delete-candidates under Phase 4's guard leg.

### 1.7 progress — 2026-10-16 (shared default landed — OWN-COMMIT item, loosens a live gate)

`DEFAULT_TIER = 'directory_presence'` exported once per app (`apps/api/src/utils/tier-defaults.ts`, `apps/web/src/lib/tiers/tier-defaults.ts`); fixture `default_tier` pins it. Seven silent defaults changed — the plan's five plus two found while sweeping:

| Site | Was → now | Direction |
|---|---|---|
| `tier-access.ts getRequiredTier` | professional → `DEFAULT_TIER` | **LOOSER — the decided blast radius.** Unknown feature keys now pass for every tier instead of requiring professional+. 'Premium by omission' was never defensible; unmapped = not gated until cataloged. |
| `tier-access.ts requireWritableSubscription` | starter → `DEFAULT_TIER` | tighter — a null-tier tenant's write gate no longer gets inactive-legacy-starter treatment |
| `tier-limits` `getSKULimit`/`getTierInfo` (4 spots) + `resolveLimitBaseTier` tail | starter / discovery → `DEFAULT_TIER` | tighter — null tier 500→5 SKUs; unlisted keys (incl. `chain_*`, `custom`) 75→5 |
| `trial-tier-transparency` `getEffectiveTier(WithTrialInfo)` | discovery → `DEFAULT_TIER` | tighter |
| `tier-resolver` `mapTierLevel` + `hasFeature` (×2) + `getDefaultTier` | discovery / starter / **fabricated storefront** → `DEFAULT_TIER` | tighter — and `getDefaultTier` now returns an honest floor TierInfo instead of fabricating `basic_inventory`/`single_location` grants (feature claims now fall through to the static bag check on the id anyway). Stale `['storefront','commitment']` upgrade list → `getUpgradeOptions(DEFAULT_TIER)`. |
| `useTenantComplete` | `starter` fallbacks (×5) + divergent `mapTierLevel` → `DEFAULT_TIER` + aligned cases | tighter — and this second `mapTierLevel` copy had **`organization → enterprise`** (over-map) and was missing `presence`/`ecommerce`/`directory_presence`/`chain_professional`/`chain_enterprise`; rewritten to match `tier-resolver`'s cases |

Exempt: `useTierAccess.ts` — `@deprecated` hook pending removal; its `'starter'` fallback dies with it.

Tests: api `tier-defaults.test.ts` 5/5, web `tier-defaults.test.ts` 4/4 (proves the `hasFeature` fallback no longer reaches the starter bag), full `lib/tiers/` re-run green, both typechecks clean.

### Remediation gate (between Phase 1–3 and Phase 4)

Every red assertion gets a written disposition: **fix code / fix fixture / fix doc / exempt-with-reason**. Dispositions are recorded in this plan or the fixture. The phases are allowed to land red only if each failure carries its disposition — the suite may not go green by silently weakening assertions to match whatever the code happens to do today.

### 1.5 is unwritable as specified — premise corrected 2026-10-16

The plan predicted *"`propagation_products: 'starter'` vs organization-only; six `propagation_*` keys mapped but absent from every bag."* A diagnostic run against the real data shows the mismatch is **an order of magnitude larger and of a different kind**:

| Direction | Count | Meaning |
|---|---|---|
| **A** — mapped to a tier whose bag omits it | **22** | Includes the whole `integration_*` family (14 keys) mapped to tiers whose `TIER_FEATURES` entries do not list them |
| **B** — in a bag with no map entry | **56** | Mostly `directory_entry_*` chrome plus `professional.*` / `enterprise.*` extras |
| **C** — in **multiple** bags while the map names one (or null) | **27** | `storefront` in `[starter, chain_starter]`; `custom_domain` in `[enterprise, chain_enterprise]`; `api_access` in **three** |

**Two structural reasons the check cannot be written as stated:**

1. **`FEATURE_TIER_MAP` is single-valued; the bags are multi-valued.** A feature granted at N tiers cannot be expressed by a `feature → one tier` map — and the chain tiers (`chain_starter`/`chain_professional`/`chain_enterprise`) mirror their base tiers, so **27 features are legitimately multi-tier**. This is not drift; it is the map's shape.
2. **The two structures carry different namespaces.** The map has `integration_*`; the bags have `directory_entry_*`. Neither is the other's inverse.

**What the check should assert instead** (and it is *stronger* than the original, because it tests a real invariant rather than a false one):

| # | Assertion | Status |
|---|---|---|
| 1.5a | **Chain-mirror invariant:** for every `chain_X`, `TIER_FEATURES['chain_X'] ⊇ TIER_FEATURES['X']` | **Asserted and KNOWN-RED (`it.fails`), 2026-10-16.** It does NOT hold: **14 features** are granted at the base tier and absent from the chain tier — `chain_starter` ← `basic_categories, category_quick_start, image_finder, clover_pos`; `chain_professional` ← `business_logo, interactive_maps, privacy_mode, custom_marketing_copy, priority_support, square_pos, payment_client_credentials`; `chain_enterprise` ← `advanced_analytics, sla_guarantee, custom_integrations, customDomains`. `tier-hierarchy.md` calls `chain_professional` "professional level", which implies the mirror. **Undecided: incomplete chain bags (real bug) or a deliberately different chain bundle (doc is loose).** Pinned with `it.fails` so the suite stays green, the gap stays in the source, and **fixing it makes the test fail** — forcing promotion rather than leaving it buried. |
| 1.5b | **Single-valued consistency, scoped:** for a feature in the map whose named tier's bag *does* list it, no *other* non-chain bag lists it | The 22 in (A) are the honest exception list — each needs a disposition |
| 1.5c | **The `propagation_*` family:** the 11 keys in (A) are the real finding — `propagation_products → starter` where the bag says organization-only | **Real, and it is the plan's original claim, confirmed at 11 keys not 6** |
| 1.5d | **The `integration_*` family (14 keys)** is a capability-module namespace, not a `TIER_FEATURES` namespace | Disposition: **exempt-with-reason**, documented — not a defect |

**The gate applied to itself:** 1.5 as written would have failed on 105 rows, 27 of which are *correct by construction*. A test that demands 27 legitimate facts be "fixed" is the failure mode the gate exists to prevent — so the assertion changes, not the code. **1.5c is the one genuine red and gets a code fix; 1.5a is the invariant worth pinning; 1.5d is exempt with the reason above.**


---

## Phase 2 — The inheritance contract

The four hard rules from `tier-hierarchy.md` §Inheritance, each a named assertion.

| # | Task | Assertion |
|---|---|---|
| 2.1 | `presence` does **not** inherit `google_only` / Discovery Google caps. | *"must NOT inherit — smears Entry Presence modes."* Asserted in both `tier-features.ts` and `tier-access.ts` copies. |
| 2.2 | `discovery` does **not** grant platform product browse or a branded marketplace storefront. | Entry Presence modes are peers; `discovery` is the Google surface. |
| 2.3 | `storefront` does **not** grant checkout — commerce starts at `commitment` / `ecommerce`. | A storefront tier that accepts payment is a revenue bug. |
| 2.4 | `directory_presence` grants **free gateway features only** — asserted against an explicit gateway-safe allowlist in the fixture, not by inspection. | Today its bag includes `storefront_enabled`, `storefront_retail`, `directory_visibility_snap_ebt` — presumed base chrome, but the fixture must say so, or the assertion has no criterion. |
| 2.5 | The inheritance graph is **acyclic *and* transitively closed**, and `omnichannel` inherits both money modes. | `checkTierFeature`, `getTierFeatures`, and the `tier-access` fallback each resolve exactly **one hop** — `TIER_HIERARCHY` entries *are* the closure. A tidy refactor listing only direct parents passes "acyclic" while silently stripping every inherited feature. |
| 2.6 | Rule on the empty tiers: `discovery`, `storefront`, `commitment`, `ecommerce`, `omnichannel` have **no own entries** in `TIER_FEATURES` — their web-side grants are pure inheritance, and everything else lives only in `tier_features_list`. | **RULED 2026-10-16: blessed as `db_only_grant_tiers`**, not a hole — the bags' absence is now asserted (a new static bag for one of these tiers fails the test and needs a documented reason). |

### Phase 2 progress — 2026-10-16

Fixture gained `inheritance` (`edges` = the canonical parent **closure**, `omnichannel_money_modes`, `negative_rules`, `gateway_allowlist`, `db_only_grant_tiers`). Reference = web `tier-features.ts`, verified against the doc rules.

**The api `TIER_HIERARCHY` was badly diverged** — fixed and exported:

| api copy was | vs canonical |
|---|---|
| `discovery: [directory_presence]` | missing `google_only` — the Google surface lost its own Google features on the fallback path |
| `ecommerce`, `omnichannel` | **no edges at all** — zero inherited features in `checkTierAccess`/`getTierFeatures` fallback |
| `professional: [starter, google_only, dp]` | missing the entire commerce chain (`omnichannel→…→discovery`) — inherited the legacy starter lineage instead |
| `enterprise`/`organization` | missing `omnichannel`/`ecommerce`/`storefront`/`discovery`; carried `starter` instead |
| `chain_*` | wrongly carried `commitment` (commerce!) + same missing commerce chain |

Closure properties are now asserted on both maps themselves: transitively closed (a direct-parents refactor fails), acyclic, `omnichannel` inherits both `commitment` and `ecommerce`, `presence` inherits neither `google_only` nor `starter`. Bag-level rules are web-side only (the api `TIER_FEATURES` is the fully-commented fallback set): `discovery` resolves no `storefront`/`product_search`; nothing below commitment carries `commerce_*`/`checkout_*`; `directory_presence` ⊆ the 10-key gateway allowlist; `presence` resolves none of google_only's distinct features.

Suites: api `tier-inheritance.test.ts` 20/20, web `tier-inheritance.test.ts` 33/33. Full `src/services/__tests__` run: 2309/2310 pass — one unrelated flake (`DirectoryClaimService.napStamp` 5s timeout under 129-worker load; passes solo in 373ms). Both typechecks clean.

---

## Phase 3 — The capability key contract

The rules from D4/D7. **Where they run matters:** the per-domain resolvers are pure and unit-testable; the merge step (`EffectiveCapabilityResolver` ~L1020–1172, prisma-bound) and the MV (SQL) are independent implementations of the same semantics and need the mechanisms in 3.7.

| # | Task | Notes |
|---|---|---|
| 3.1 | `<module>_disabled` is an absolute veto **per the D7 ruling** — over `_enabled`, `_flexible`, and (if D7 says so) purchases and admin grants. | `CapabilityResolversOnOff.test.ts` already pins resolver-level veto — fold it in; the new assertion must reach the *merged-map* path (tier `_disabled` + purchased feature), which no existing test touches. |
| 3.2 | `_disabled` never counts as engagement. | A veto is not a grant — pin `checkCapabilityEngagement` semantics (it reads `tier_features_list`, per the store-purchases checklist). |
| 3.3 | `_flexible` grants the module **and every feature key in the module** — a superset of the module's individual keys. | The module key list lives only in `capability_features_list` (DB). The fixture either embeds a generated dump of it (0.2) or this assertion moves to the DB leg — a hand-copied list recreates the two-places problem. Also: flexible keys are looked up, not pattern-guessed (`flexible_key_map` — 14 of 18 keys don't match `{cap}_flexible`). |
| 3.4 | `<any other active key>` implies `_enabled`; **no keys at all** means the module is OFF. | Already pinned resolver-side by `CapabilityResolversOnOff.test.ts`; extend to the merge path. |
| 3.5 | `tenant_feature_overrides_list` with `granted=false` is **ignored, not a deny**. | Lives in the prisma-bound merge (`granted: true` filter) and the MV — needs 3.7's mechanism, not a pure unit test. |
| 3.6 | Tier policy holds: `seed_preview` / `presence` / `chain_*` / `trial_*` carry **zero keys** — never `_disabled`. | The doc's *"deliberate — do not fix"*: the veto would also block admin grants. Asserted against `tier_features_list` via the DB leg — the keys live in data, not code. |
| 3.7 | **Choose the merge/MV parity mechanism.** Options: (a) extract `EffectiveCapabilityResolver`'s merge into a pure function so 3.1–3.5 stay DB-free; (b) a migration-lint asserting the MV definition's shape (gate-key flow, `flexible_key_map`, post-332 negative-key exclusion); (c) a DB integration test — the jest e2e suite already exists and runs against a real DB (excluded from vitest for exactly that reason). | Pick at least one for the merge and one for the MV. The repo's own incident history — 14/18 flexible keys guessed wrong (090), dead vetoes and phantom vetoes (332) — says the SQL copy is where drift breeds. Skipping it leaves the highest-stakes reimplementation untested. |

### Phase 3 progress — 2026-10-16

**3.7 mechanism: (a) + (b) both landed** — extraction for the merge, lint for the SQL. Option (c) stays available for the 0.2 DB leg but isn't needed for the contract rows.

- **(a) Pure merge:** `fetchRawCapabilities`'s merge (~230 lines) extracted to `apps/api/src/services/effectiveCapabilityMerge.ts` (`mergeCapabilitySources`). Prisma fetches stay in the resolver; semantics — most-permissive tier merge, veto-key carry-through, purchase/override force-enable, flexible expansion, `granted===true` filter (moved OUT of the prisma where-clause so it's testable) — live in the pure module.
- **(b) MV lint:** `mv-shape-lint.test.ts` reads the NEWEST migration that recreates `mv_tenant_effective_capabilities` (today 332) and pins: `trial_map` pairs ⊆ fixture canonical, `flexible_key_map` lookup-not-guess, each flexible CTE excluding `%_disabled`/`%_off`, NO gate-key filter on output (exactly 3 negative-key exclusions — one per CTE), `granted = true` on overrides, purchase status set `('active','past_due','trial')`, and `tenant_type_gates` suppression on all 3 flexible sources. 7/7 pass on 332.
- **3.1–3.5 pinned on the pure merge:** `tier-merge-contract.test.ts` 13/13 — veto survives the merge beside a purchase; a `_disabled`-only module grants nothing; `*_flexible` expands via purchase AND override; implicit engagement; uncategorized bucketing; `granted=false` ignored (no deny).

**Two live bugs found and fixed during extraction:**

1. **Resolver-side phantom-veto risk.** The original flexible-*purchase* expansion filtered `capLinks` — which only cover PURCHASED feature ids — so a `*_flexible` purchase expanded to ~itself (near no-op). Fixed to fetch the full active feature set per cap type like the override path — and since working expansion must not emit `_disabled`/`_off` (the MV's BUG-2 rule, previously unenforced resolver-side), the negative-key exclusion was added INSIDE the pure merge where the contract test can see it. Without this, the newly-functional expansion would have created the same phantom vetoes 332 fixed in the MV.
2. **D7 store eligibility (the "don't sell a vetoed module" consequence).** `checkCapabilityEngagement` in `bsaas-purchases.ts` only refused when EVERY enabled tier feature in the cap type was `*_disabled` — a tier carrying `{cap}_disabled` plus any positive key still sold into a module the veto then kills. Replaced with `capabilitySaleAllowed` (pure, pinned): the exact `{cap}_disabled` veto key enabled → unsellable. Covers catalog listing, single purchase, and bundle purchase paths. **Also fixed:** both `checkCapabilityEngagement` and `checkTierFeatureStatus` looked up tiers by RAW `subscription_tier` — a `trial_*` key resolves to no tier row (no engagement → can't buy; no "included in plan" → could re-buy a granted feature). Both now apply `getEffectiveTier` (the canonical trial map).

**5.4 pulled forward:** `capability-resolution-mv.md` corrected — the stale "purchases/overrides bypass type gates — intentional" note is replaced with the D7 semantics, the gate-key filter doc updated to 332's post-fix reality (keys flow to resolvers; expansion emits non-negative keys only).

**Remaining in Phase 3:** 3.6 (zero-key tiers — `seed_preview`/`presence`/`chain_*`/`trial_*` carry no `_disabled`) is DB-leg work (0.2) — the keys live in `tier_features_list` data, not code.

---

## Phase 4 — The shared fixture (D6)

| # | Task | Notes |
|---|---|---|
| 4.1 | Author the fixture: one JSON model holding tier keys, order, display names, prices (incl. the dormant-price policy from 0.4), inheritance edges, key-contract semantics, the trial map (1.6), silent defaults (1.7), tier classes (D8), module key lists (3.3), the gateway-safe allowlist (2.4), and the per-array role map (1.1). | **Generated or DB-validated, not hand-copied** — the dump script from 0.2 produces the DB-derived legs so the fixture faces `subscription_tiers_list`/`tier_features_list`/`capability_features_list` instead of restating them. |
| 4.2 | Point the Phase 1–3 suites at the fixture instead of hardcoded expectations. | A test that hardcodes the model tests nothing — it restates the code. |
| 4.3 | Add the fixture to both `apps/web` and `apps/api` suites; existing suites (`entry-presence-tier.test.ts`, `CapabilityResolversOnOff.test.ts`, per-resolver tests) are reconciled into the fixture's vocabulary — same truth, no parallel assertions that can drift from it. | Two suites, one truth. |
| 4.4 | **Guard test:** every file in the inventory (0.1 — the grep-derived one, not the doc's stale list) is either covered by a contract assertion or explicitly listed as derived-and-exempt. | Implement as a **static** check (import-graph scan or marker comments), not runtime import — several listed files are Express routers/services that pull `prisma`/env at module load and are fragile under vitest. The inventory's doc members go on the exempt list explicitly. |

---

## Phase 5 — Doc sync (D3)

| # | Task | Notes |
|---|---|---|
| 5.1 | Generate the tier-order and pricing tables in `tier-hierarchy.md` from the fixture, between explicit markers. | Pricing generation is gated on the 0.4 dormant-price decision — today the doc table lacks the `chain_*`/`google_only`/`trial`/`starter` rows that exist in code. |
| 5.2 | Add a test that regenerates the block and fails on a non-empty diff. | The doc becomes a build artefact of the contract rather than a parallel copy. |
| 5.3 | Extend the same treatment to the capability cheatsheet's key-contract block. | Same class, same remedy — the cheatsheet's five-line contract is currently prose. |
| 5.4 | Correct `capability-resolution-mv.md`: the "type gates are tier-level only; purchases/overrides bypass — this is intentional" note is stale post-332 (gate keys from all sources now reach resolvers); gate-key flow is attributed to migration 090 but was reworked in 332. | Per D7's ruling. The doc is itself one of the drifted copies — leave it agreeing with the code or the next reader re-derives the bug. |

---

## Phase 6 — The MV staleness decision (D5)

| # | Task | Notes |
|---|---|---|
| 6.1 | Decide: which MV-read surfaces matter post-purchase? Single-tenant reads are already real-time (resolver); the window applies to bulk listing routes and public surfaces — including whether a buyer's own directory card shows the unlock. | **0.7 answered — the cron is scheduled and succeeding on a 10-minute cadence**, so "accept the window" means a bounded ≤10 min, not forever. The residual question is whether a buyer's own directory card should show the unlock before the next refresh. |
| 6.2 | Pin the decision with a test — either "a fresh purchase is visible immediately" or "the window is bounded and documented". | An untested decision is the next silent divergence. |
| 6.3 | If the window is accepted, make it **visible**: a purchase confirmation that states when the capability activates. | Silence during the window is what reads as a failure to the buyer. |

---

## Phase 7 — Rollout

| # | Task | Notes |
|---|---|---|
| 7.1 | Wire the suites into the verification path: add `"test": "vitest run"` to both app `package.json`s (web has none today) and a root script (`pnpm -r test` or explicit per-app) — `pnpm test` is currently bare `vitest` with no root config. | `checkapi` can't see the api suite (tsconfig excludes tests) — the vitest run is the only gate. |
| 7.2 | Record the contract in `AGENTS.md`: the fixture is the source, both suites assert it, the DB-dump leg validates it, and adding a tier or capability key means editing the fixture first (then regenerating the DB-derived legs). | The rule that keeps it true — including *who regenerates the dump when the catalog changes*. |
| 7.3 | Delete the "Files that MUST stay in sync" list from `tier-hierarchy.md` **only if** Phase 4.4's guard covers the grep-derived inventory; otherwise keep the list and let the guard assert it. | The list is load-bearing until the test replaces it — and it is already incomplete today. |

---

## Definition of done

- A tier or capability key added to any inventoried file — or to `subscription_tiers_list` / `tier_features_list` via admin UI — without the fixture fails a test.
- The five inheritance rules, the seven key-contract rules, and the trial map each have a named, failing-capable assertion.
- Every Phase 1–3 red assertion carries a remediation-gate disposition; none is green by fiat.
- The doc's tier and pricing tables are generated, and a hand-edit fails a test; `capability-resolution-mv.md`'s stale veto note is corrected.
- The MV has a parity mechanism (3.7) — the SQL copy is not left as an untestable reimplementation.
- The MV refresh schedule is **committed** — a migration using 315's guarded `cron.schedule` idiom — not merely verified live in prd. Job 120 is currently scheduled, active, and succeeding on cadence; the deliverable is making that reproducible.
- `tier-access.ts.bak` is deleted; `tier-access.ts` is inside the contract.
- The MV staleness question has a written answer and a test that pins it.
- `AGENTS.md` names the fixture as the source of truth and the dump discipline that keeps it honest.

## Verification findings

- **Dedicated partial suites exist** (the first draft of this plan claimed none). `apps/web/src/lib/tiers/entry-presence-tier.test.ts` pins the presence feature bag, hierarchy, display name, and price. `apps/api/src/services/resolvers/CapabilityResolversOnOff.test.ts` pins resolver-level `_on`/`_off`/`_enabled`/`_disabled`/`_flexible` semantics across eleven resolvers; `StorefrontQrResolver.test.ts` et al. add more. What's absent is cross-copy consistency — the gap this plan fills.
- **`tier-access.ts` has already diverged** (found during 2026-10-15 verification): `professional` inherits `['starter','google_only','directory_presence']` (no omnichannel/storefront chain), `starter` is priced $49 with no web counterpart, `trial` has a display name and price the web lacks, and its fallback `tierOrder` omits `omnichannel` entirely and orders `ecommerce` after `professional` — the exact bug class the doc warns about.
- **`QuickLinksService` and `NextStepsService` are mis-gating now**: their `TIER_ORDER`s lack `presence`, `ecommerce`, and `organization`, so `tierIndex` falls back to 0 and e.g. an ecommerce tenant compares *below* commitment.
- **The trial map exists in four divergent copies** (see 1.6).
- **The companion docs disagree on veto scope** (see D7) — the cheatsheet says absolute, the MV doc says purchases bypass intentionally, migration 332 changed the mechanics again.
- **The MV refresh cron is scheduled and healthy, but not committed** (verified 2026-10-15): prd `cron.job` jobid **120**, `refresh-mv_tenant_effective_capabilities`, `*/10 * * * *`, `active: true`, with `cron.job_run_details` showing `succeeded` on a clean 10-minute cadence. **So the ≤10 min bound is real** — but it is not reproducible from the repo (only a commented snippet in `089`), and job 120 may not write `scheduled_job_runs` rows because it is not a migrated job. Deliverable is `316_*.sql` (0.7).
- **`TIER_FEATURES` has no entries for `discovery`, `storefront`, `commitment`, `ecommerce`, or `omnichannel`** — those tiers' web-side "grants" are pure inheritance; the authoritative grant rows live in `tier_features_list`. A code-only contract can't see them.
- **The sync list is itself stale** — `tier-features.ts`'s own header names `tier-access.ts` as its sync partner; the doc's list doesn't. The audit method must be a sweep, not the list.
