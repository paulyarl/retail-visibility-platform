# NIL Youth Sports Platform — Execution Plan (v2)

**Document version:** 2.0 — supersedes v1 build order
**Date:** 2026-09-30
**Authority:** see §0.2
**Companion:** `SPEC_AMENDMENTS.md` (the patch list that makes the source spec set consistent with this plan)
**Predecessor analysis:** `SPINOFF_MVP_ANALYSIS.md` (findings F1–F12 referenced throughout)

---

## 0. How to Use This Plan

### 0.1 Scope

| Dimension | Value |
|---|---|
| MVP boundary | Stages 0–9 (Implementation Phases 1–3), delivered **API-first** |
| Stage 10 | Post-MVP (Phase 4) — outline only, no estimates |
| Build order | **Hybrid:** extract API + schema (S1–S3), build and *validate* a vertical slice (S4–S5), then complete web extraction (S6) and feature breadth (S7–S9) |
| Relationship to source platform | **Pattern replication** — the spinoff reuses the source architecture, including the `FlexibleApiSingleton` hierarchy |
| Estimate | **39.5–73 engineer-weeks, likely ~56** (§6) |

### 0.2 Authority & supersession

| Document | Status after this plan |
|---|---|
| `PROJECT_SEQUENCE.md` | **Superseded** as build order. Retained as historical record and as the stage→source traceability map (§9) |
| `IMPLEMENTATION_PLAN.md` | **Superseded** as task backlog. Its skill index (§0.1) and Definition of Done (§0) are **retained** and incorporated into §2.4 and §7 |
| `TECHNICAL_SPEC.md` | **Remains authoritative** for architecture, DDL, capability design, and the §12 gap analysis — *as amended by `SPEC_AMENDMENTS.md`* |
| `MIGRATION_DESIGN.md` | **Remains authoritative** for the extraction inventory (KEEP/DROP lists, file counts) — *as amended* |
| `FRONTEND_SPEC.md` | **Remains authoritative** for UI surfaces, components, and navigation — *as amended* |
| `SPINOFF_MVP_ANALYSIS.md` | Findings register. Every finding F1–F12 is closed by a task or a gate in this plan (§8) |

**Conflict rule.** If any document contradicts this plan, **this plan wins**. If this plan is silent, `SPEC_AMENDMENTS.md` is authoritative over the original spec text. If both are silent, the source platform's actual behavior wins over all documents (per finding F1 — this rule exists because the spec set asserted a mechanism that does not exist).

### 0.3 Work units

| Unit | Definition |
|---|---|
| **ew** | engineer-week = 1 person × 5 focused days, **inclusive** of design, implementation, review, and the task's acceptance gate |
| **Task** | Smallest unit that can be independently verified. Has an ID, dependencies, deliverable, acceptance, effort, and confidence |
| **Stage** | A group of tasks with a single entry gate and exit gate |
| **Gate** | A hard stop. Cannot be passed on "mostly working." Requires the named evidence artifact |

### 0.4 Confidence ratings

| Rating | Meaning | Planning use |
|---|---|---|
| **High** | Comparable work has been done in this codebase; scope is enumerable | Use the estimate |
| **Medium** | Scope is enumerable but execution has unknowns | Use the estimate, add 20% buffer |
| **Low** | Scope depends on coupling that has not been measured | **Do not commit.** Measure first (spike, S0.1) or re-baseline after S5 |

Low-confidence stages in this plan: **S2, S3, S6, S9**. Together they are ~44 ew of the ~56 ew midpoint. That is the honest shape of the risk.

---

## 1. Decisions Ledger

Every decision below has a **recommended default**. The plan is executable immediately by accepting defaults; each may be overridden before its "Decide by" stage. Decisions marked **[SIGN-OFF]** require a human (legal, finance, or product owner) — they are not the implementer's to make.

| ID | Decision | Recommended default | Rationale | Blocks | Decide by | Owner |
|---|---|---|---|---|---|---|
| **D1** | Is RLS the Phase-2 isolation guarantee or Phase-4 hardening? | **Phase-4 hardening.** Phase-2 enforcement = explicit `WHERE tenant_id` **+ a repository-level tenant guard** (S4.1) | The source platform has no RLS (F1). Promising it in Phase 2 means promising a control that does not exist. The tenant guard gives equivalent bug-catch power at a fraction of the cost | S2, S4 | S0 | Eng lead |
| **D2** | Athlete-tenants: widen `tenants` or side table? What tier do they carry? | **Add `tenant_type` + a `nil_tenant_profile` side table.** Seed a `platform_default` tier row; force `directory_visible = false` for `tenant_type='athlete'` | `tenants` is commerce-shaped (Stripe slots, SKU quotas, GBP tokens). Athletes must not inherit those columns or public directory eligibility (F2) | S2 | S0 | Eng lead |
| **D3** | Which base-singleton chain is canonical? Are `V2`/`Stable` deleted? | **`UniversalSingleton → EnhancedFlexibleApiSingleton → FlexibleApiSingleton → {Public, Tenant, Customer, Admin, Authenticated}` is canonical.** Delete `FlexibleApiSingletonV2`, `FlexibleApiSingletonStable`, `PublicApiSingletonStable` | The spec's §13 hierarchy targets this chain. Three coexisting chains is drift, not a feature (F5) | S0 (hygiene), S3, S6 | S0 | Eng lead |
| **D4** | Rename `orders`/`order_items`/`payments`, or create `nil_deals`/`nil_deal_milestones`/`nil_payments` fresh? | **Create fresh, delete commerce models, reuse the *services*** | On a fresh DB the rename buys nothing and drags Stripe/refund/tax/shipment entanglement along (F7) | S2, S3 | S0 | Eng lead |
| **D5** | Can an athlete-tenant appear in tenant-directory / discovery / storefront-discovery surfaces? | **No — ever.** Explicit exclusion rule + `directory_visible = false` default + a regression test | `directory_visible` defaults `true`; athlete-tenants would otherwise be publicly discoverable (F2, F9) | S2, S4 | S0 | Eng lead + product |
| **D6** | Are `nil_guardian` / `nil_fan_network` capability-gated or platform-default? | **Platform-default, not tier-gated** (per §12.9). Remove them from the capability registry **and** delete the corresponding hooks from `FRONTEND_SPEC.md` §13a.11 | §7 and §12.9 contradict each other; §12.9 is the correct policy (never paywall the trust/safety and engagement layer) (F6d) | S9 | S4 | Product owner **[SIGN-OFF]** |
| **D7** | How does right-to-erasure coexist with an append-only audit trail? | **Audit rows carry pseudonymous references only — never PII.** Erasure rewrites the reference, not the log | Both requirements are legally load-bearing and the spec never reconciles them. Resolving it at schema time is cheap; later it is a migration (F9) | S2 | S0 | Eng lead + legal **[SIGN-OFF]** |
| **D8** | Test strategy: harness, CI gates, jsdom-or-not for web? | **vitest everywhere. CI gates: typecheck, raw-`fetch`, UUID/`Date.now()` id, PII-under-`/api/public/*`. Web = server-render assertions only for now** (matches existing `AGENTS.md` constraint) | "Release-blocking P0 tests" must not be built after the features they guard (F10) | S0, S4 | S0 | Eng lead |
| **D9** | Fee parameters: platform %, guardian split, non-profit slice, payer-keyed tier matrix | **Defer.** Model is already settled (§12.10 — deal = purchase, transaction fee). These are parameters | Confirmed non-blocking: parameter tuning, not architecture. Must be closed before S9 finance work, not before S1 | S9 only | S8 | Finance **[SIGN-OFF]** |
| **D10** | Legal sign-off on COPPA / FERPA / state-NIL / erasure design | **Start immediately.** External dependency, longest lead time | Hard-gates the schema freeze (S2). Slipping this slips everything | S2 | **S0 (start)** | Legal **[SIGN-OFF]** |
| **D11** | Is a pilot dataset to be carried over? | **Assume no — new Supabase project is empty** | The whole plan assumes no data migration. If this is wrong, every estimate is void | S2 | S0 | Product owner |

**Rule:** a stage does not begin while a decision it depends on is open. If a decision is not made by its "Decide by" stage, the recommended default is **adopted in writing** and the plan proceeds — no stage blocks on silence.

---

## 2. Delivery Model

### 2.1 Stage flow

```
S0 Baseline ──► S1 Infra ──► S2 Schema ──► S3 API Extraction ──┬──► S4 Safety Substrate
                                                                │            │
                                                                │            ▼
                                                                │    S5 ★ VERTICAL SLICE ★   (G5 — architecture validated)
                                                                │            │
                                                                │            ▼  (re-baseline S6–S9 from measured velocity)
                                                                │    S6 Web Extraction ──► S8 Native Pipeline ──► S9 Unified Service
                                                                │                                                       │
                                                                │                                                       ▼
                                                                │                                              S10 Post-MVP (outline)
                                                                │
                                                                └──► S7 Credibility Shell   ◄── RECOMMENDED: pull forward,
                                                                     (parallel with S4–S5)      investor demo at ~3 months
```

**Why this order (the hybrid choice).** Worth being precise about the gain rather than overselling it.

- **Architectural feedback arrives at a similar time.** G5 lands at ~25 ew cumulative (S0–S5 mid). Under the spec's order, the equivalent validation lands at ~28 ew (A–D plus E, before Phase 2 begins). The feedback is *not* dramatically earlier — anyone claiming a large timing win is misreading the plan.
- **What genuinely improves is what you are holding when the feedback arrives.** This plan validates **before** the low-confidence destructive web strip (S6, ~9 ew) and never breaks the web app — it stays demoable from S1 onward. The spec's order strips the web app to zero *before* anything has been proven. If the architecture is wrong here, you correct a working app and a rebuilt API; under the spec's order you correct a half-destroyed one.
- **A third benefit, easily missed:** the API is built **once**, against a design that has been validated, rather than speculatively and then reworked.

**Sequencing option — pull the Credibility Shell forward (recommended).** S7 (landing + lead capture + `nil_landing`) has **no dependency on the slice**. It needs only S1 (infra), S2 (the `nil_leads_list` table), and S3.5/S3.7 (resolver plumbing + the lead service). Because Implementation Phase 1 is explicitly investor-facing, **S7 should be executed immediately after S3, in parallel with S4–S5.**

- Effect: an investor-ready public shell at **~21 ew cumulative instead of ~36.5 ew** — roughly 3 months instead of 8.
- Trade-off: `nil_landing` (tier-only, no merchant prefs) becomes the template-setting capability rather than `nil_roster`. A simpler reference is acceptable, and arguably preferable as a first pass.
- It does **not** disturb the G5 gate, the P0 suite, or the post-G5 re-baseline rule.

**Serialization reality.** S2 → S3 → S4 → S5 is a hard chain and cannot be widened. S7 can move (above). S6 and S9 parallelize well. Plan staffing around the chain, not around the total.

### 2.2 Additive-then-subtractive rule *(optimization O4)*

**Never delete a Prisma model before the code that references it is gone.** The spec's M1/M2 split deletes models and code in the same pass, which means every deletion batch produces a cascade of type errors from both directions at once.

Mandated order:
1. **Add** all NIL models (additive — breaks nothing). `prisma validate` green.
2. **Delete** commerce code in vertical batches, `checkapi` green after each batch.
3. **Then** drop commerce models, `grep` proving zero references remain.

This converts one large entangled repair into two ordered, independently-verifiable repairs.

### 2.3 Definition of Done

**Per task** (inherited from `IMPLEMENTATION_PLAN.md` §0, retained):

- `pnpm checkapi` and `pnpm checkweb` pass with **zero TS errors** (verified baseline — both green today)
- The task's named acceptance check passes
- No raw `fetch` introduced (web → `makeDefaultRequest`; API → `UniversalSingleton` helpers)
- No `randomUUID()` / `Date.now()` IDs — all IDs from `id-generator.ts`
- **Exception (documented):** `bot_*` tables retain `@db.Uuid` + `gen_random_uuid()` per `TECHNICAL_SPEC.md` §14.12. The grep gate must whitelist `apps/api/src/services/bot/` and the bot route directory, or the gate fails on compliant code (F6c)

**Per stage:** the exit gate's evidence artifact exists and is attached to the stage PR.

**Per capability** (the 8-phase pipeline, from `TECHNICAL_SPEC.md` §7 — corrected paths per F4):

1. **Define** feature keys + tier assignment in the seed scripts (`apps/api/prisma/seed-*-capabilities.ts`, `seed-tiers.ts`) — **not** `canonical-features.ts` / `tier-hierarchies.ts`, which do not exist
2. **Seed** `features_list` → `capability_features_list` → `tier_features_list`
3. **Store prefs** `tenant_nil_*_options_settings` model + table
4. **Resolve** `resolveNilXxx()` + wire `EffectiveCapabilityResolver.ts` + add the disabled entry to `buildExpiredCapabilitiesResponse`
5. **Route** `nil-xxx-options-settings.ts` (GET `{ success, settings, tierState }`; PUT tier-validates + `invalidateEffectiveCapabilities`)
6. **Map** `UnifiedCapabilityService.mapNilXxx()` + state interface + `useNilXxxCapability` hook
7. **Display** `PlanSummaryPanel` + `CapabilityShowcase` (correct group-level `merchantGated` counting)
8. **Verify** `checkapi` + `checkweb` + `verify-capability-deployment` checklist

### 2.4 Standing engineering rules

| Rule | Enforcement |
|---|---|
| No raw `fetch` in NIL code paths | CI grep gate |
| No `randomUUID`/`Date.now()` IDs (bot exception above) | CI grep gate |
| No PII fields on `/api/public/*` | CI grep gate + S4.6 enumeration script |
| Concrete NIL services extend a **NIL base**, never `UniversalSingleton` directly | CI check (F5 — prose rules demonstrably did not hold in the source repo) |
| Every minor-data mutation enumerates **all** cache namespaces | `cross-context-cache-invalidation.md` + S4.4 contract + test |
| Every status/consent/deal/payout transition emits an `X-Audit-ID` | `structured-logging.md` + S4.8 |
| Before building any `nil_*` capability, open its commerce analog and copy the structure | Task-level checklist item (the spec's own §7.1 rule, made explicit) |

---

## 3. Gates

Each gate has an **evidence artifact** — a file, test run, or report attached to the stage. "Passed" without the artifact is not passed.

| Gate | After | Exit criteria | Evidence artifact |
|---|---|---|---|
| **G0** | S0 | Spike report with measured repair ratio; green baseline captured; CI gates running; D1–D5, D7, D8, D11 closed; D10 legal review formally started; live-DB object inventory complete | `spike-report.md`, `baseline-typecheck.txt`, CI config committed, `db-object-inventory.md` |
| **G1** | S1 | **Unmodified fork** deploys to Railway + Vercel; Auth0 login→dashboard→logout round-trips for all 8 roles; `doppler secrets` lists every required key in all 3 configs; zero old-brand strings | deploy logs, Auth0 role screenshot set, `grep` output |
| **G2** | S2 | `prisma validate` green; NIL wave-1 tables created on the new DB; seeds run idempotently; **API still compiles** (additive only — no deletions yet); `tenant_type` + `nil_tenant_profile` + `platform_default` tier present; `directory_visible=false` for athlete type | `prisma validate` output, seed logs, `checkapi` output |
| **G3** | S3 | `checkapi` green; zero commerce route/service references; commerce Prisma models dropped with `grep` proof of no references; 19 ID generators with tests; resolver registry dispatches; 8 NIL roles validate | `checkapi` output, `grep` proofs, generator test run |
| **G4** | S4 | Tenant guard rejects a query against an athlete-owned table with no tenant predicate (**proven by test**); consent engine handles grant/revoke/most-restrictive-wins; visibility state machine enforces all transition guards; cache contract enumerated; PII enumeration script runs in CI; negative-path harness executes | test run, CI log, `pii-surface-report.md` |
| **G5** ★ | S5 | **Architecture validated.** Slice demo: guardian provisions athlete-tenant → grants scoped consent → passes moderation + compliance → profile appears on public roster → revoke removes it within one request. All P0 negative tests green. PII gate green | demo recording, P0 test run, PII report |
| **G6** | S6 | `checkweb` green; zero commerce web references; 7 NIL bases + web services in place on the canonical chain; proxy/auth/capability-service/rbac/nav updated; rebrand complete (no VisibleShelf strings) | `checkweb` output, `grep` proof, brand audit |
| **G7** | S7 | Landing live on the NIL domain over TLS; lead intake writes and is not publicly readable; `nil_landing` capability resolves + R13 expired-manifest returns 200 disabled | TLS check, lead write test, capability route test |
| **G8** | S8 | M2 milestone: media/metrics/achievements live; institution roster management; manual compliance verdict workflow; **every P0 negative-path test from §12.12 green** | full P0 suite run |
| **G9** | S9 | All personas have scoped portals; 5 persona capabilities deployed (8 phases each); CRM + bot live with child-safety guardrails; invitations + onboarding working end-to-end; every adult↔minor interaction guardian-gated | capability checklists ×5, P1 suite run, invitation E2E |

**★ G5 is the decision gate.** After G5, **re-baseline S6–S9 from measured velocity** (§6.5). Do not commit to the S6–S9 numbers before then.

---

## 4. Stages

### Stage 0 — Baseline, Hygiene & Decisions

**Entry:** none. **Exit:** G0. **Estimate: 1.5–2.5 ew.**

| ID | Task | Depends | Deliverable | Acceptance | ew | Conf |
|---|---|---|---|---|---|---|
| 0.1 | **Extraction spike** *(de-risking)*: on a throwaway branch, delete one complete commerce vertical (`inventory/` recommended), repair until `checkapi` **and** `checkweb` are green. Record files deleted, files *edited*, errors surfaced, wall-clock | — | `spike-report.md` with measured repair ratio per vertical | Ratio extrapolates to the full DROP list; two lowest-confidence stage estimates replaced with measured numbers | 0.6–1.0 | High |
| 0.2 | Capture green baseline: `checkapi` + `checkweb` outputs; record file/LOC/model counts | — | `baseline-typecheck.txt`, `baseline-metrics.txt` | Artifacts committed; baseline reproducible | 0.1 | High |
| 0.3 | Install CI gates: typecheck, raw-`fetch`, UUID/`Date.now()` id, PII-under-`/api/public/*`, `prisma validate`, "NIL service must extend a NIL base" | 0.2 | CI config committed | Each gate **fails on a deliberately-introduced violation** (gate-testing the gate) | 0.3–0.5 | High |
| 0.4 | **Hygiene purge:** 509 `.bak`/`.backup` files, 3 backup Prisma models (`subscription_tiers_list_v1_backup`, `tier_features_list_v1_backup`, `tenants_metadata_backup_gbp`), abandoned singleton variants per D3, stray baseline dumps | D3 | Clean tree | `grep -cE "\.(bak\|backup)$"` → 0; `prisma validate` green; `checkapi`/`checkweb` still green | 0.5–1.0 | High |
| 0.5 | **Live-DB object inventory:** enumerate triggers, policies, views, materialized views, extensions from the **live** Supabase DB — not from `schema.prisma` | — | `db-object-inventory.md` | Inventory reconciles against `schema.prisma`; every out-of-band object listed with a keep/drop decision | 0.2–0.4 | High |
| 0.6 | Close the decisions ledger (D1–D5, D7, D8, D11) or adopt defaults in writing | — | Signed-off ledger | Every blocking decision has a written answer or an adopted default | 0.1 | High |
| 0.7 | **Start legal review** (D10) — external, longest lead time | — | Legal engagement confirmed + target date | Review formally opened and tracked as an S2 dependency | — | — |

> **Why 0.1 before everything.** The estimate's uncertainty is concentrated in the deletion-and-repair tax. A 3–5 day measurement replaces the two lowest-confidence rows with measured numbers and typically halves the total range. It also produces the coupling map (which retained subsystems touch dropped models) that S2 needs anyway.

> **Why 0.4 is not optional.** 509 backup files and three backup Prisma models make every downstream grep gate noisy, and leave duplicate-looking models a junior agent can mistake for the real one. It is 0.5–1.0 ew that improves every subsequent verification step.

---

### Stage 1 — Infrastructure

**Entry:** G0. **Exit:** G1. **Estimate: 1–2 ew.** *(= spec Stage A)*

| ID | Task | Deliverable | Acceptance | ew | Conf |
|---|---|---|---|---|---|
| 1.1 | New git repo; clone source files without `.git` history | Clean repo, single initial commit | `git log` shows one commit | 0.1 | High |
| 1.2 | New Supabase project; `CREATE EXTENSION vector` | Provisioned project | Dashboard accessible; extension present | 0.2 | High |
| 1.3 | New Auth0 tenant + 8 roles (`athlete`, `guardian`, `institution_admin`, `coach`, `sponsor`, `fan`, `platform_admin`, `compliance_auditor`); callback + logout URLs | Configured tenant | All 8 roles visible; login round-trips locally | 0.3–0.5 | Medium |
| 1.4 | New Vercel project (web) | Linked project | Preview deploy succeeds | 0.1 | High |
| 1.5 | New Railway service (api) | Linked service | Service deploys | 0.1 | High |
| 1.6 | Doppler: `local`, `dev`, `prd` configs with all secrets | Three configs | `doppler secrets` lists every required key in each | 0.2–0.4 | Medium |
| 1.7 | Package rename (`@rvp/*` → `@nil/*`); brand strings; `PLATFORM_DOMAINS`; `API_BASE_URL` defaults | Renamed packages | `pnpm install` succeeds; zero old-brand references | 0.2–0.4 | High |
| 1.8 | **Prove the unmodified fork deploys** to both targets | Deploy logs | Both targets serve; API health check passes | 0.1–0.2 | High |

> **Task 1.8 is the real point of this stage.** Deploying *before* any deletion separates "the fork is broken" from "our extraction broke it." Without it, the first deploy failure in S3 is ambiguous.

---

### Stage 2 — Schema Foundation

**Entry:** G1. **Exit:** G2. **Estimate: 4–8 ew.** *(= spec Stage B, re-scoped: additive only)*

> **This stage adds. It does not delete.** Per §2.2, commerce model removal happens in S3.6, after the code that references those models is gone.

| ID | Task | Depends | Deliverable | Acceptance | ew | Conf |
|---|---|---|---|---|---|---|
| 2.1 | **Wave-1 schema (slice-critical):** enums; `tenants.tenant_type`; `nil_tenant_profile`; `athlete_profiles_list`; `guardians_list`; `guardian_athlete_links_list`; `consent_records_list`; `highlight_media_list`; `nil_leads_list`; the `*_options_settings` base | D2 | Migration `nil_wave1` | `prisma validate` green; tables created; athlete provisions as a tenant | 1.0–2.0 | Low |
| 2.2 | **Wave-2 schema (breadth):** `athlete_metrics_list`, `athlete_achievements_list`, `athlete_tenant_memberships_list`, `recruiting_boards_list`, `scout_ratings_list`, `sponsorship_deals_list`, `escrow_milestones_list`, `nonprofit_allocation_pools_list`, `nil_eligibility_rules_list`, `moderation_cases_list`, `message_threads_list`, `fan_badges_list`, `data_erasure_requests_list`, `payout_schedules_list`, `sponsor_spend_limits_list`, `nil_offers_list`, `nil_events_list`, `nil_invitations_list`, `nil_onboarding_sessions_list`, 7 × `tenant_nil_*_options_settings` | 2.1, D4 | Migration `nil_wave2` | `prisma validate` green; table count reconciles against `TECHNICAL_SPEC.md` §14 counted **directly** (the plan's list undercounts — F12) | 1.5–3.0 | Low |
| 2.3 | **`platform_default` tier** + NIL feature/capability/tier seed scripts | D2, D6 | Seed scripts | Athlete/guardian/fan features resolve from platform default, never `tier_features_list` | 0.5–1.0 | Medium |
| 2.4 | Seed base data: NIL eligibility rules, navigation links, bot guardrails (child-safety) | 2.2 | Seed scripts | All base data present; seeds idempotent | 0.5–1.0 | Medium |
| 2.5 | `mv_athlete_discovery` materialized view **+ its scoping review** | 2.2, D5 | View + refresh function + scoping note | View queryable; **proven to exclude unapproved and `directory_visible=false` rows** (F9) | 0.3–0.6 | Medium |
| 2.6 | Guardian-required trigger (`nil_require_guardian_for_minor`) on CRM tables | 2.2 | Trigger | Minor-subject CRM record without guardian → DB error | 0.2–0.4 | High |
| 2.7 | Audit-trail schema per D7 (pseudonymous references; erasure reconciliation) | D7 | Schema + design note | Erasure can rewrite references without falsifying the log | 0.2–0.4 | Medium |
| 2.8 | **RLS decision applied** (D1): if Phase-4 hardening, write the deferral record; if Phase-2, build the policies **and** the transaction-mode GUC workaround | D1 | `rls-decision.md` (+ policies if option 2) | Decision recorded with rationale; if built, isolation test passes **non-vacuously** (proves rows *are* visible with the right tenant set) | 0.2–0.4 / **+3–6** | Medium |

> **F1 closure note.** `MIGRATION_DESIGN.md` §3.4 currently states RLS "carries over unchanged." It does not exist. If you take the default (D1 = Phase-4 hardening), 2.8 is a short design record and the Phase-2 guarantee is the S4.1 tenant guard. If you take option 2, budget it here honestly — ~24 tables × (policy + GUC plumbing + Supabase transaction-mode workaround + non-vacuous isolation tests) is its own workstream.

> **F12 closure note.** Count the tables from `TECHNICAL_SPEC.md` §14 directly. The plan lists 22; the migration design lists 25; the spec contains 23 `CREATE TABLE` statements plus the options tables. Reconcile before writing the migration.

---

### Stage 3 — API Extraction & Core

**Entry:** G2. **Exit:** G3. **Estimate: 6–12 ew.** *(= spec Stage C)*

| ID | Task | Depends | Deliverable | Acceptance | ew | Conf |
|---|---|---|---|---|---|---|
| 3.1 | Delete commerce routes in **vertical batches** (products, inventory, storefronts, shops, directory, GBP, GMC, barcode, cart, shipments, business hours, feed, store reviews, featured, social commerce, recommendations, image enrichment, clone, quick-start, publishing, digital downloads, catalog adoption, cross-tenant products, location availability, deposit forfeiture, smart-sale tagging, slug gen, override analytics) | 0.1 (spike ratio), 0.3 | Deleted routes | `checkapi` green after **each** batch; no broken mounts in `index.ts` | 2.0–4.0 | Low |
| 3.2 | Delete commerce services + middleware (`image-search-limits.ts`, `sku-limits.ts`) + commerce-specific test/doc files | 3.1 | Deleted services | `checkapi` green | 1.5–3.0 | Low |
| 3.3 | **19 NIL ID generators** + table-driven tests | 3.2 | `id-generator.ts` entries + tests | All formats match §6; collision check done; test covers every generator | 0.3–0.6 | High |
| 3.4 | NIL resolver registry: `NilLandingResolver`, `NilRosterResolver`, `NilGuardianResolver`, `NilRecruitingResolver`, `NilSponsorshipResolver`, `NilAchievementsResolver`, `NilFanNetworkResolver`, `NilComplianceResolver`, `NilFinanceResolver`, `NilCrmOptionsResolver`, `NilBotOptionsResolver` | 3.3 | Resolver files | Each returns the correct capability shape. **Build the first one by copying its commerce analog, then template the rest** (O2) | 1.0–2.0 | Medium |
| 3.5 | Rewire `EffectiveCapabilityResolver.ts`: NIL imports, `MerchantSettingsBundle` type, dispatch, `buildExpiredCapabilitiesResponse` disabled entries | 3.4 | Updated orchestrator | `resolveEffectiveCapabilities()` dispatches to NIL resolvers; R13 expired manifest returns 200 disabled | 0.3–0.6 | Medium |
| 3.6 | **Drop commerce Prisma models** (second wave, per §2.2) — only after `grep` proves zero references | 3.1, 3.2 | Reduced `schema.prisma` | `grep` proof of zero references; `prisma validate` green; `checkapi` green | 0.5–1.0 | Medium |
| 3.7 | Phase-1/2 NIL backend services: `NilLeadService`, `AthleteProfileService`, `GuardianConsentService`, `MediaModerationService`, `NilRosterService`, `ComplianceVettingService` (manual verdict) | 3.5 | Services | Non-`consent_authority` write → 403; non-allowlisted host rejected | 1.5–3.0 | Medium |
| 3.8 | Auth middleware + 8 NIL roles (`auth.ts`, `role-validation.ts`, `permissions.ts`) | 1.3 | Updated middleware | All 8 roles validate correctly | 0.3–0.6 | Medium |
| 3.9 | Route mounting in `index.ts`: remove commerce mounts, add NIL mounts | 3.1, 3.7 | Updated entry | Server starts without errors | 0.2–0.4 | High |

> **O2 — template-first capability *(the single largest effort saver)*.** Task 3.4 builds eleven resolvers. Do **not** design them independently. Build `NilRosterResolver` by copying its commerce analog end to end, get it through the 8-phase pipeline (S5.5), then produce the remaining ten by analogy against that reference. Eleven independent designs is the failure mode; one reference plus ten analogies is roughly half the cost.

---

### Stage 4 — Safety Substrate

**Entry:** G3. **Exit:** G4. **Estimate: 2–4 ew.** *(new stage — F1, F9, F10)*

> This stage exists because the spec treats its safety controls as *features of* Phase 2 rather than as an **enforcement layer that Phase 2 features are built on**. Building the layer first means every subsequent feature inherits it, instead of each feature re-implementing (and subtly mis-implementing) tenant scoping, consent checks, and cache eviction.

| ID | Task | Depends | Deliverable | Acceptance | ew | Conf |
|---|---|---|---|---|---|---|
| 4.1 | **Repository-level tenant guard** (D1): a Prisma middleware/wrapper that rejects any query against an athlete-owned table without a tenant predicate | D1 | Guard module | **Test: a query against `athlete_profiles_list` with no `tenant_id` is rejected at runtime.** This is the Phase-2 substitute for RLS (F1) | 0.5–1.0 | Medium |
| 4.2 | **Consent engine:** versioned scoped consent; `consent_authority` checks; **most-restrictive-wins** across multiple guardians; revocation cascade contract | 2.1 | `GuardianConsentService` core + tests | Grant/revoke/veto all tested; any owning guardian can veto; cascade contract enumerated | 0.5–1.0 | Medium |
| 4.3 | **Visibility firewall** state machine + transition guards (`draft→pending→approved→archived`, `pending→rejected`) | 2.1 | State machine module | Transition to `approved` requires all three gates true; illegal transitions rejected | 0.3–0.6 | Medium |
| 4.4 | **Cache-invalidation contract:** namespace enumeration + `getServiceCachePatterns` / `invalidateServiceCaches` + eviction test | 4.2, 4.3 | Contract + test | Approve → roster reflects within one request; **revoke evicts every namespace** (partial eviction = safety incident) | 0.3–0.6 | Medium |
| 4.5 | **Media moderation core** + host allowlist (`parseVideoUrl` pattern) | 2.1 | Service + allowlist | Non-allowlisted host rejected; media cannot publish unmoderated | 0.2–0.4 | High |
| 4.6 | **PII / public-surface enumeration script** *(optimization — automated, not a manual audit)*: walks all retained read paths (routes, materialized views, nav data, email templates, Sentry config, analytics, sitemap/preview) and reports any athlete/guardian field reachable | 2.5 | `pii-surface-report.md` + CI gate | Script runs in CI; report enumerates every surface; **no unclassified surface remains** (F9) | 0.4–0.8 | Medium |
| 4.7 | **Negative-path test harness** (DB-level + API-level) for the P0 suite | D8 | Harness | The five P0 tests from §12.12 can be written and executed against it (F10) | 0.3–0.6 | Medium |
| 4.8 | **Audit trail** implementation per D7: `X-Audit-ID` emission on every status/consent/deal/payout transition | D7, 2.7 | Logging integration | Every transition emits an audit id; audit rows contain no PII | 0.2–0.4 | Medium |

> **F9 closure.** The spec's PII strategy covers DTO projections. Task 4.6 covers the paths a DTO test cannot reach: the materialized view, the directory default, DB-driven nav, email templates, error reporting, analytics, and sitemap/preview surfaces.

> **F10 closure.** Task 4.7 is scheduled **before** the features it guards, not after.

---

### Stage 5 — Vertical Slice Validation ★

**Entry:** G4. **Exit:** G5 (the decision gate). **Estimate: 2.5–4.5 ew.** *(= the spec's "First Executable Slice," expanded to include its web consumer)*

| ID | Task | Depends | Deliverable | Acceptance | ew | Conf |
|---|---|---|---|---|---|---|
| 5.1 | Athlete-tenant provisioning (guardian-initiated) + **COPPA age-band gate** | 4.1, 4.3 | Provisioning path | Athlete-initiated under-13 intake → **403** | 0.4–0.7 | Medium |
| 5.2 | Guardian link + scoped consent grant/revoke through the private 0-TTL path | 4.2 | Consent flow | Non-`consent_authority` write → 403; scoped grants enforced | 0.3–0.5 | Medium |
| 5.3 | Visibility state machine end-to-end on a real profile | 4.3, 5.1, 5.2 | Working transitions | Only all-three-gates-true reaches `approved` | 0.3–0.5 | Medium |
| 5.4 | Public roster route: `approved`-only, consent-filtered, PII-stripped | 5.3 | `NilRosterService` + route | Zero records when no row is `approved`; GPA visible only with `gpa_display` consent | 0.4–0.7 | Medium |
| 5.5 | **`nil_roster` + `nil_compliance` capabilities, full 8 phases** — the **reference implementation** (O2) | 3.4, 3.5, 5.4 | Capability end-to-end | `verify-capability-deployment` checklist passes; R13 expired manifest works | 0.6–1.0 | Medium |
| 5.6 | Per-athlete cache eviction on status/consent change | 4.4 | Eviction wiring | Approve → roster reflects within one request; revoke → gone within one request | 0.2–0.4 | Medium |
| 5.7 | **P0 gates:** under-13 self-register 403; consent revocation cascade; media moderation gate | 4.5, 4.7 | P0 tests green | All three negative paths pass | 0.3–0.6 | Medium |
| 5.8 | **Web slice (additive only):** `NilPublicApiSingleton`, `AthleteApiSingleton`, `GuardianApiSingleton`, `NilPublicRosterService`, `AthleteService`, `GuardianService` + a minimal public roster page | D3, 5.4 | Web slice | Slice renders against the live API; **no commerce code deleted yet** (hybrid property) | 0.7–1.2 | Medium |

> **★ G5 is where the architecture gets validated.** If athlete-as-tenant, the tenant guard, scoped consent, the firewall, capability gating, and the P0 gates all hold on this thin path, the remaining ~40 ew is execution rather than discovery. If any of them does not hold, you have spent ~10 ew instead of ~26 to find out.

> **Task 5.8 keeps the hybrid property.** The web app is *additive* here — the slice's consumers are new files. Commerce web code is still present and still compiling. Destructive web extraction is S6.

---

### Stage 6 — Web Extraction & Core

**Entry:** G5 + re-baseline (§6.5). **Exit:** G6. **Estimate: 6–12 ew.** *(= spec Stage D)*

| ID | Task | Depends | Deliverable | Acceptance | ew | Conf |
|---|---|---|---|---|---|---|
| 6.1 | Delete commerce web routes in batches (`/products/*`, `/shops/*`, `/directory/*`, `/items/*`, `/cart/*`, `/carts/*`, `/checkout/*`, `/orders/*`, `/my-orders/*`, `/downloads/*`, `/catalog/*`, `/category-discovery/*`, `/cross-tenant/*`, `/test-*`, `/debug/*`, `/sentry-example-page/*`) | G5, 0.1 ratio | Deleted routes | `checkweb` green after each batch | 2.0–4.0 | Low |
| 6.2 | Delete commerce web services, components, hooks, API route handlers | 6.1 | Clean `src` | `checkweb` green | 1.5–3.0 | Low |
| 6.3 | Remaining NIL bases + web services on the canonical chain (D3): `ComplianceApiSingleton`, `InstitutionApiSingleton`, `SponsorApiSingleton`, `FanApiSingleton` + their services | D3 | Base classes + services | Each extends the correct NIL base; **CI base-check passes** | 0.8–1.5 | Medium |
| 6.4 | `proxy.ts` + `PLATFORM_DOMAINS`; `AuthContext` / `ServerResolvedContextProvider`; `UnifiedCapabilityService`; `rbac.ts` | 6.3 | Updated infra | Auth flow works against the new Auth0 tenant; capability requests use NIL keys | 0.5–1.0 | Medium |
| 6.5 | Navigation links reseeded for NIL sidebars | 6.4 | Reseeded nav | Every sidebar item correct per `FRONTEND_SPEC.md` §8.3 | 0.3–0.6 | Medium |
| 6.6 | Rebrand: colors, logo, fonts, email templates, Sentry project | 6.4 | Rebranded UI | Zero VisibleShelf branding remains | 0.5–1.0 | Medium |

---

### Stage 7 — Credibility Shell

**Entry:** G6. **Exit:** G7. **Estimate: 2–3 ew.** *(= spec Stage E / Phase 1)*

| ID | Task | Depends | Deliverable | Acceptance | ew | Conf |
|---|---|---|---|---|---|---|
| 7.1 | Marketing landing route + NIL brand domain in `proxy.ts` env config | 6.4 | Landing segment | TLS handshake + 200 on landing | 0.5–0.8 | Medium |
| 7.2 | Lead intake form (athlete/parent vs sponsor vs investor) → `NilLeadService` → `nil_leads_list` | 3.7, 7.1 | Form + route + Zod schema | Lead writes succeed; **no PII publicly readable** | 0.5–0.8 | Medium |
| 7.3 | `nil_landing` capability, full 8 phases (**second capability — now templated from S5.5**) | 5.5, 7.2 | Capability | `verify-capability-deployment` checklist passes | 0.5–0.8 | Medium |
| 7.4 | Investor-facing shell review: state coverage, responsive breakpoints, a11y | 7.3 | Reviewed shell | `skill-frontend-ux-guardrails` checklist passes | 0.3–0.6 | Medium |

> **Optimization visible here.** `nil_landing` is the second capability built. With S5.5 as the reference implementation, its cost drops from a template-establishing exercise to an analogy. Tasks 7.3 and the five S9.2 capabilities all benefit from the same template.

---

### Stage 8 — Native Pipeline Breadth

**Entry:** G7. **Exit:** G8. **Estimate: 2.5–5 ew.** *(= remainder of spec Stage F / Phase 2 beyond the slice)*

| ID | Task | Depends | Deliverable | Acceptance | ew | Conf |
|---|---|---|---|---|---|---|
| 8.1 | Media + metrics + achievements: models, services, submission paths | 2.2 | Services + routes | Media defaults `pending`; achievements feed the profile only when `approved` | 0.6–1.2 | Medium |
| 8.2 | `athlete_tenant_memberships_list` + `AthleteMembershipService` (transfers) | 2.2 | Service + routes | Transfer preserves history; cross-tenant row visible to both tenants | 0.4–0.8 | Medium |
| 8.3 | Institution roster management + admin/compliance roster controller | 8.2, 5.5 | Controller UI + routes | Status toggle triggers per-athlete cache eviction | 0.5–1.0 | Medium |
| 8.4 | Manual compliance verdict workflow (`ComplianceVettingService` full) | 3.7 | Workflow | **No profile reaches `approved` without a verdict** | 0.3–0.6 | Medium |
| 8.5 | Remaining P0 gates: non-allowlisted video host rejected; unmoderated media never public | 4.5, 8.1 | P0 tests | Both negative paths pass | 0.3–0.6 | Medium |
| 8.6 | RLS follow-through per D1 (if option 2: implement the deferred policies; if option 1: write the Phase-4 handoff note) | 2.8 | Policies or handoff note | Non-vacuous isolation test (option 2) or documented deferral (option 1) | 0.4–0.8 / **+1–2** | Medium |

**M2 milestone:** a guardian can create an athlete-tenant, grant scoped consent, pass moderation + compliance, and see the athlete on the public roster — **with every P0 negative-path test green.**

---

### Stage 9 — Unified Service

**Entry:** G8. **Exit:** G9. **Estimate: 12–20 ew.** *(= spec Stage G / Phase 3)*

| ID | Task | Depends | Deliverable | Acceptance | ew | Conf |
|---|---|---|---|---|---|---|
| 9.1 | `athlete_tenant_memberships_list` transfers + multi-guardian edge cases | 8.2 | Service hardening | Most-restrictive-wins verified with conflicting guardians | 0.4–0.8 | Medium |
| 9.2 | **Five persona capabilities, 8 phases each** (D6): `nil_recruiting`, `nil_sponsorship`, `nil_achievements`, `nil_compliance` (auto-ready), `nil_finance` (per D9). `nil_guardian` / `nil_fan_network` are **platform-default, not gated** | 5.5 (template), D6 | Capabilities | `verify-capability-deployment` passes per capability; **template-then-analogy, not independent design** | 3.0–5.0 | Low |
| 9.3 | **Six per-actor dashboards** (guardian, athlete, institution, sponsor, fan, compliance) reusing `CrmPageShell`/`CrmNavPanel` + the 5 standard panels (`FRONTEND_SPEC.md` §3a) | 6.4, 9.2 | Dashboards | No polling loop; unread via `getReadState`; scoped per base; server-resolved context | 3.0–6.0 | Low |
| 9.4 | CRM deltas: `athlete_tenant_id`/`guardian_id` columns + guardian-required trigger + `tenant_nil_crm_options_settings`; NIL CRM surfaces (Compliance / Institution+Sponsor / Guardian); `nil_crm` capability | 2.6 | Services + routes + capability | **Minor-subject ticket without guardian → DB error**; PII never projected without a consented relationship | 1.0–2.0 | Medium |
| 9.5 | Bot deltas: conversation athlete/guardian scoping + `is_minor_safe` + `tenant_nil_bot_options_settings`; 4 personas (Compliance/Eligibility, Guardian Onboarding, Recruiting/Sponsor FAQ, Fan); `bot_guardrail_rules` seed; `nil_bot` capability | 2.2 | Bot configs + RAG + capability | **No minor PII in responses**; unanswered → CRM escalation; **guardrails at the RAG retrieval filter, not just the prompt** | 1.0–2.0 | Medium |
| 9.6 | **Invitations:** `InvitationService` (lifecycle, guardian consent gate, anti-spam) + 9 routes + 5 FE components + 6 email templates + **6 connection-establishment side effects** (each with its cache-invalidation obligation) | 9.2 | Invitation subsystem | Create/accept/reject/withdraw/guardian-approve work; **minor cannot self-accept**; 30-day re-invitation block enforced; each connection type creates the correct row + fires invalidation | 2.0–3.5 | Low |
| 9.7 | **Onboarding:** `OnboardingService` (actor-aware state machine) + 3 routes + `OnboardingWizard` + `OnboardingProgressBanner` | 9.6 | Onboarding subsystem | Per-actor step sequences return correct completion %; skip works for non-blocking steps | 1.0–2.0 | Low |
| 9.8 | Cross-cutting sweep: observability, cache correctness, i18n for compliance/bylaw copy | 9.2 | Sweep report | Every standing rule in §2.4 verified | 0.5–1.0 | Medium |

> **9.6 is the sleeper.** Invitations and onboarding are described in the spec as one Phase-3 sub-feature. They are a bidirectional subsystem with nine routes, six side effects, six email templates, and a consent gate. Budget them as their own workstream.

---

### Stage 10 — Post-MVP (outline only)

**No estimates.** Listed so nothing is silently dropped. Full scoping is a separate exercise after G9.

- Automated compliance vetting (`ComplianceVettingService` auto + `nil_eligibility_rules_list` expansion per state/association)
- Financial infrastructure: deal-as-purchase transaction fee, `EscrowLedgerService` double-entry, guardian KYC/W-9, payout routing, non-profit pool slice
- RLS implementation (if D1 = option 1) across all athlete-owned + cross-tenant tables
- `DataErasureService` cascade + certificate
- Age-out job (18 → athlete gains financial scope, consent ledger preserved)
- Advanced abuse detection / scraping defense / rate-limit tuning

---

## 5. Optimizations Applied

Each is a concrete change from the spec's approach, with the saving it produces.

| # | Optimization | Replaces | Why it saves |
|---|---|---|---|
| **O1** | **API-first hybrid sequencing** (S1–S3 → S4–S5 → S6) | Full extraction before any feature work | Surfaces architectural error at ew ~10 instead of ew ~26. Keeps a compiling web app throughout, so the destructive web pass is isolated |
| **O2** | **Template-first capability:** build `nil_roster` end-to-end as the reference, then produce the other 10 by analogy | 11 independently-designed capabilities | One design decision plus ten analogies instead of eleven designs. Largest single saving in S9 |
| **O3** | **Automated PII/public-surface enumeration** (S4.6) as a repeatable CI gate | One-time manual audit + DTO snapshot test | Repeatable, covers non-route surfaces, and catches regressions after G5 |
| **O4** | **Additive-then-subtractive schema sequencing** (§2.2) | Spec's M1/M2 split (delete models and code together) | Two ordered, independently-verifiable repairs instead of one entangled cascade |
| **O5** | **Tenant guard instead of Phase-2 RLS** (S4.1, default D1) | 24 RLS policies + GUC plumbing + Supabase transaction-mode workaround in Phase 2 | Equivalent bug-catch power at ~1 ew instead of ~3–6 ew plus an unsolved pooling problem |
| **O6** | **Single canonical base chain; delete `V2`/`Stable`** (S0.4, D3) | Three coexisting chains carried into the fork | Removes drift and prevents new NIL bases from targeting an abandoned chain |
| **O7** | **Table-driven ID generator tests** (S3.3) | Per-generator ad-hoc verification | 19 generators verified by one parameterized test |
| **O8** | **CI gates from commit 1** (S0.3), each gate-tested against a deliberate violation | Adding gates later | The source repo's type-level health eroded precisely because the deploy build masks errors (F3). Gates added late never get adopted |
| **O9** | **Hygiene purge before extraction** (S0.4) | Cleaning up at the end | 509 backup files make every grep gate and every "did we get them all?" verification noisy |
| **O10** | **Spike-measured repair ratio** (S0.1) | Guessing the deletion tax | Converts the two lowest-confidence estimates into measured ones |
| **O11** | **Re-baseline S6–S9 after G5** (§6.5) | Committing to the full estimate up front | ~44 ew of the estimate sits in Low-confidence stages; velocity after the slice is real data |
| **O12** | **Deferred `nil_finance`/auto-compliance to S10** | Pulling Phase-4 finance into the MVP | Keeps the MVP about the safety core, not money movement. D9 (fee params) is explicitly non-blocking |
| **O13** | **Evidence artifact per gate** (§3) | "Stage complete" by assertion | Makes gate passage auditable and prevents silent scope erosion |
| **O14** | **Decisions ledger with defaults** (§1) | Open questions blocking stages | No stage blocks on silence; the default is adopted in writing and the plan proceeds |
| **O15** | **Server-resolved context for all dashboards** (S9.3) | Client polling | Prevents the ~1/sec request storm the spec itself flags (§12.11) |
| **O16** | **Pull the Credibility Shell forward** (§2.1): run S7 immediately after S3, in parallel with S4–S5 | Shell at the end of the plan (~36.5 ew cumulative) | Implementation Phase 1 is explicitly investor-facing, and S7 has no dependency on the slice. Investor-ready public site at **~3 months instead of ~8**. Zero cost in total effort — sequencing only |

---

## 6. Effort

### 6.1 Estimate by stage

| Stage | Low | **Mid** | High | Confidence | Dominant cost |
|---|---|---|---|---|---|
| S0 Baseline, hygiene, decisions, spike | 1.5 | **2.0** | 2.5 | High | Spike + hygiene + CI gates |
| S1 Infrastructure | 1.0 | **1.5** | 2.0 | High | Auth0 8-role wiring; Doppler parity; proving the fork deploys |
| S2 Schema Foundation | 4.0 | **6.0** | 8.0 | **Low** | Schema surgery + seeds + the RLS decision |
| S3 API Extraction & Core | 6.0 | **9.0** | 12.0 | **Low** | The deletion-and-repair loop across 542 route files / 361 services |
| S4 Safety Substrate | 2.0 | **3.0** | 4.0 | Medium | Tenant guard, consent engine, harness, PII enumeration |
| S5 Vertical Slice Validation ★ | 2.5 | **3.5** | 4.5 | Medium | The thin end-to-end path + 3 P0 gates + web slice |
| S6 Web Extraction & Core | 6.0 | **9.0** | 12.0 | **Low** | Same repair loop at 168,776 LOC / 436 pages / 303 services |
| S7 Credibility Shell | 2.0 | **2.5** | 3.0 | Medium | Landing + leads + second capability |
| S8 Native Pipeline Breadth | 2.5 | **3.5** | 5.0 | Medium | Media/metrics/achievements + roster mgmt + manual compliance |
| S9 Unified Service | 12.0 | **16.0** | 20.0 | **Low** | Breadth: 5 capabilities, 6 dashboards, CRM, bot, invitations, onboarding |
| **Total (S0–S9)** | **39.5** | **≈56** | **73.0** | | |

### 6.2 Correction to the v1 analysis

`SPINOFF_MVP_ANALYSIS.md` §5.3 reported a midpoint of **~48 ew**; the correct midpoint of its own ranges was **~52 ew** (extraction 26.25 + feature 25.5) — an arithmetic slip in that document's summary line.

This plan's midpoint is **~56 ew**, i.e. **+4 ew over the corrected v1 figure**. The increase is deliberate and traceable:

| Change | Δ ew (mid) | Why |
|---|---|---|
| S0 (baseline, hygiene, decisions, spike) added as a stage | +2.0 | Previously implicit in "extraction"; the spike and hygiene pass are real work |
| Safety substrate (S4) + slice (S5) + breadth (S8) replace the single "Stage F" line | +3.0 | The v1 figure of 5–9 ew for the entire native pipeline was **optimistic by omission** — it did not carry the tenant guard, the negative-path harness, or the PII enumeration as explicit line items |
| **Total** | **+5.0** | Offset by O2/O4/O5 savings already reflected in the per-stage numbers |

Reporting the increase explicitly is the point: the v1 number was low for reasons, and hiding that would repeat the spec's own error (F11).

### 6.3 Backend / web split

The backend is **not** half the work — it is roughly two thirds, because schema, API extraction, and the safety core dominate and are shared.

| Slice | Stages included | Low | **Mid** | High |
|---|---|---|---|---|
| **Backend / API** — infra, schema, API extraction, safety substrate, slice (API), shell (API), native pipeline, unified service (API) | S0, S1, S2, S3, S4, S5 (API), S7 (API), S8, S9 (API) | 26.0 | **37.5** | 49.0 |
| **Web / frontend** — slice (web), web extraction, web bases/services, landing + roster UI, 6 dashboards, ~44 components, nav, rebrand | S5 (web), S6, S7 (web), S9 (UI) | 13.5 | **19.0** | 24.0 |
| **Total** | | **39.5** | **≈56** | **73.0** |

### 6.4 Calendar scenarios

Assumes decisions are made on time. S2→S3→S4→S5 is a hard chain; S6 and S9 parallelize.

| Team | Calendar (mid, ~56 ew) | Notes |
|---|---|---|
| 1 engineer | **12–17 months** | Fully serialized on the S2→S5 chain |
| 2 engineers (backend, web) | **7–10 months** | Web is idle during S2–S5 — consider starting S6 prep in parallel |
| 3 engineers (backend, web, safety/QA) | **5–8 months** | Best fit. Safety/QA owns S4.6/S4.7 and the P0 suite from S2 onward |
| 4 engineers (+ data/platform) | **4.5–7 months** | Diminishing returns; the chain does not widen |

### 6.5 Re-baselining rule *(O11)*

**After G5, re-estimate S6–S9 from measured velocity.** S2, S3, S6 and S9 are Low-confidence and carry ~44 ew of the ~56 ew midpoint. By G5 you have measured:

- the actual repair ratio (S0.1 predicted it; S3 confirmed it)
- the real schema surgery cost (S2)
- capability cost for one full 8-phase implementation (S5.5)
- slice velocity per task

Feed those into S6–S9 and reissue §6.1. **Do not treat the numbers above as a commitment beyond G5.** Treating them as one is exactly the failure mode documented in F11.

### 6.6 Cost

Effort converts to money in the companion document **`BUDGET.md`**. Headline figures for the recommended delivery shape (**2 human engineers + 3 agent seats**), using the illustrative loaded rate of $3,000/ew:

| | Mid | Range |
|---|---|---|
| MVP build (labor + agents + infra + legal) | **~$168,000** | $128,000–224,000 |
| — of which human engineering labor | ~$130,000 | |
| — of which legal review (parameter — hold open until quoted) | $30,000 | $15,000–60,000 |
| Post-launch infrastructure run-rate | ~$150–600/month | |

Three things in that document change how **this** plan should be executed:

1. **Budget agent capacity by usage, not seats.** Anthropic's published enterprise data puts observed Claude Code cost at $150–250/developer/month with the seat fee only ~8–12% of the total. A $20 seat can produce a $250 bill. Use **$200–400/seat-month all-in**.
2. **~34 of the 56 ew midpoint is agent-suitable; ~22 ew is human-owned.** `BUDGET.md` §4.1 maps this per stage. The human-owned portion is S4 (Safety Substrate) and S5 (Vertical Slice) plus the review tax — and it is the part that is **not compressible**.
3. **Optimization O2 (template-first capability) is the single largest source of agent leverage** — one reference implementation, then ten near-copies. It is worth doing well for that reason alone, not just for the direct time saving.

**The S0.1 spike should also measure agent effectiveness.** Have the agent perform the deletion-and-repair, and record agent-hours, human review-hours, and defects found. That replaces `BUDGET.md` parameters 6 (`E`, the effectiveness multiplier) and 7 (`T`, the review tax) with measured values — the same 3–5 days the plan already recommends, now paying off twice.

---

## 7. Verification & Evidence Standard

### 7.1 Test layers

| Layer | Tool | Covers | Where |
|---|---|---|---|
| Typecheck | `tsc --noEmit` via `pnpm checkapi` / `pnpm checkweb` | Both apps, zero errors | CI, every PR |
| Unit | vitest | ID generators, pure helpers, mappers, resolvers | `apps/api`, `apps/web` |
| Integration (API) | vitest + test DB | Services, consent engine, firewall transitions, capability routes | `apps/api` |
| DB-level | vitest + test DB | Tenant guard rejection, guardian-required trigger, MV scoping | `apps/api` |
| **P0 negative paths** | vitest + harness (S4.7) | The five §12.12 P0 tests | **Release-blocking** |
| Component render | vitest + `renderToStaticMarkup` | Web components (no jsdom — see D8 / `AGENTS.md`) | `apps/web` |
| Static gates | grep / AST script | Raw `fetch`, UUID ids, PII on `/api/public/*`, NIL-base compliance | CI, every PR |

### 7.2 P0 release-blocking suite *(from `TECHNICAL_SPEC.md` §12.12)*

- [ ] Under-13 athlete cannot be registered without prior verifiable guardian consent → **403**
- [ ] No messaging thread between an adult role and a minor can exist without a guardian participant *(structural invariant)*
- [ ] Consent revocation removes the profile **and all media** from public surfaces within one request and evicts **every** cache namespace
- [ ] Deal creation is blocked where `nil_eligibility_rules_list.deals_allowed = false`
- [ ] Media cannot publish without moderation clearance; non-allowlisted hosts rejected

A stage cannot ship with any of these red — **even if it is functionally working.**

### 7.3 Frontend verification constraint

`apps/web` has **no jsdom and no testing-library** (per `AGENTS.md`). Component tests server-render via `renderToStaticMarkup`; `useEffect` never runs; Radix/`Accordion`/`Tabs` panels unmount when inactive. Consequences the plan must live with:

- Assert on serialized markup (`value="…"` attributes, copy presence), not on interaction
- Use `initialTab` / `initialOutcome`-style props to reach state-gated panels without interaction
- Extract pure helpers and data-contract mappers into named exports and unit-test those instead of the component
- The `FRONTEND_SPEC.md` §14 checklist items that are *interactional* or *layout*-based ("no page-level horizontal overflow", "mobile 320px / desktop 1440px intentionally designed") are **not expressible** in this harness. They require manual review at S7.4, recorded as a signed checklist — not a passing test

If the project wants automated interaction/layout testing, that is a **deliberate dependency decision** (D8), made once, not discovered per-component.

---

## 8. Gap Closure Matrix

Every finding from `SPINOFF_MVP_ANALYSIS.md` maps to the task or gate that closes it. No finding is left to chance.

| Finding | Severity | Closed by | How |
|---|---|---|---|
| **F1** RLS premise is false; spec points at commented-out dead code | **Critical** | **D1**, **S2.8**, **S4.1**, **S8.6**, `SPEC_AMENDMENTS.md` TS-1/TS-8/MD-4 | Decision ledger resolves it; tenant guard substitutes in Phase 2; RLS deferred to S10 or budgeted honestly; source docs corrected |
| **F2** No `tenant_type`; `tenants` is commerce-shaped; `directory_visible` defaults true | **Critical** | **D2**, **D5**, **S2.1**, **S2.5**, TS-9 | Side table + `platform_default` tier + forced `directory_visible=false` + MV scoping test |
| **F3** Build masks TS errors; `checkapi` is the only real gate | High | **S0.2**, **S0.3**, **O8** | Green baseline captured; typecheck gate installed and gate-tested from commit 1 |
| **F4** Spec file references stale or non-existent | High | **S2.3** (corrected paths), **§2.3**, `SPEC_AMENDMENTS.md` TS-4/TS-7/MD-6 | Every path replaced with a verified one before it is used in a DoD |
| **F5** Three coexisting base-singleton chains | High | **D3**, **S0.4**, **S6.3**, **§2.4**, TS-10/MD-2 | Canonical chain chosen; abandoned variants deleted; NIL-base rule enforced in CI |
| **F6** Five internal spec contradictions | High | **§1** (D1, D3, D6), **§2.3** (bot UUID exception), `SPEC_AMENDMENTS.md` | Each contradiction resolved to one authoritative answer; losing text amended |
| **F7** `orders`/`payments` rename drags entanglement | Medium | **D4**, **S2.2**, **S3.6**, MD-3 | Create `nil_deals`/`nil_deal_milestones`/`nil_payments` fresh; delete commerce models; reuse services |
| **F8** 509 backup files + backup Prisma models carried into the fork | Medium | **S0.4**, **O9** | Hygiene purge before extraction |
| **F9** Non-route PII surfaces unswept (MV, directory, nav, email, Sentry, audit/erasure conflict) | **Critical** | **D5**, **D7**, **S2.5**, **S2.7**, **S4.6**, **S4.8**, **O3** | Automated enumeration script as a CI gate; MV scoping test; audit rows pseudonymous; erasure reconciliation designed at schema time |
| **F10** P0 tests have no harness; frontend harness constrained | Medium | **D8**, **S4.7**, **§7.3** | Harness built before the features it guards; web constraints documented and the interactional checklist routed to manual review |
| **F11** Estimates exist only for extraction, and are ~an order of magnitude low | Low | **§6** (this plan), **O10**, **O11** | Effort published for every stage; spike measures the tax; S6–S9 re-baselined after G5 |
| **F12** NIL model count undercounted | Low | **S2.2** | Tables counted directly from `TECHNICAL_SPEC.md` §14 before the migration is written |

---

## 9. Traceability

Stage → source documents, so nothing is silently dropped from the original plan.

| This plan | Spec stage | Source |
|---|---|---|
| S0 Baseline & hygiene | *(new)* | `SPINOFF_MVP_ANALYSIS.md` §5.6, §6 items 1/4/11; F1–F12 |
| S1 Infrastructure | Stage A | `MIGRATION_DESIGN.md` §1 (M0); `PROJECT_SEQUENCE.md` A |
| S2 Schema Foundation | Stage B | `MIGRATION_DESIGN.md` §3 (M1); `PROJECT_SEQUENCE.md` B; `TECHNICAL_SPEC.md` §14, §18 |
| S3 API Extraction & Core | Stage C | `MIGRATION_DESIGN.md` §4 (M2); `PROJECT_SEQUENCE.md` C; `TECHNICAL_SPEC.md` §6, §7, §9 |
| S4 Safety Substrate | *(new — distributed in spec)* | `TECHNICAL_SPEC.md` §3, §8, §12.6–12.8, §12.12; `IMPLEMENTATION_PLAN.md` 2.13–2.15 |
| S5 Vertical Slice | *(spec's "First Executable Slice")* | `PROJECT_SEQUENCE.md` "First Executable Slice"; `TECHNICAL_SPEC.md` §8, §10 |
| S6 Web Extraction & Core | Stage D | `MIGRATION_DESIGN.md` §4.7–4.9 (M3); `PROJECT_SEQUENCE.md` D |
| S7 Credibility Shell | Stage E / Phase 1 | `PROJECT_SEQUENCE.md` E; `TECHNICAL_SPEC.md` §4 Phase 1 |
| S8 Native Pipeline | Stage F / Phase 2 | `PROJECT_SEQUENCE.md` F; `TECHNICAL_SPEC.md` §4 Phase 2, §12.12 |
| S9 Unified Service | Stage G / Phase 3 | `PROJECT_SEQUENCE.md` G; `TECHNICAL_SPEC.md` §4 Phase 3, §15–§18 |
| S10 Post-MVP | Stage H / Phase 4 | `PROJECT_SEQUENCE.md` H; `TECHNICAL_SPEC.md` §4 Phase 4 |

---

## 10. Risk Register (v2)

Ordered by expected impact. Each has a **trigger** — the observable signal that the risk is materializing — so mitigation starts before the damage.

| # | Risk | Sev | Likelihood | Trigger | Mitigation | Contingency |
|---|---|---|---|---|---|---|
| **R1** | RLS assumed present, is absent → Phase-2 privacy guarantee weaker than documented; isolation tests pass vacuously | **Critical** | **Certain (verified)** | Any test asserting isolation that passes with *zero* rows visible | D1 + S4.1 tenant guard + non-vacuous test requirement (S2.8) | Build RLS in S2 (+3–6 ew) and slip S7 |
| **R2** | Deletion-and-repair tax exceeds estimate | High | **High** | S0.1 spike ratio > 3× spec assumption; a batch takes > 1.5× its estimate | O10 spike; §2.2 additive-then-subtractive; batch with `checkapi` per batch | Cut breadth: ship S1–S8, defer S9 capabilities to a second release |
| **R3** | Minor data reaches a public surface via a non-route path | **Critical** | Medium | S4.6 enumeration reports an unclassified surface | S4.6 automated gate + S2.5 MV scoping test + D5 exclusion + D7 pseudonymous audit | Halt S6; treat as a release blocker |
| **R4** | `tenant_type` / athlete-tenant tier semantics left ambiguous | High | High | Capability resolver called with an athlete-tenant and returning a tier-shaped answer | D2 + S2.1 + S2.3 `platform_default` tier | Add an explicit actor-type guard to the resolver |
| **R5** | Spec instructions remain internally contradictory → wrong variant of a safety control implemented | High | High | Implementer asks "which document wins?" | §0.2 conflict rule + `SPEC_AMENDMENTS.md` + §1 decisions ledger | Freeze the spec set; re-issue amendments before continuing |
| **R6** | Consent revocation cascade is partial → stale minor data publicly cached | **Critical** | Medium | A revoke test passes but a *different* namespace still serves the profile | S4.4 enumerated contract + P0 cascade test (release-blocking) | Halt feature work; fix eviction completeness before proceeding |
| **R7** | Erasure vs. immutable audit trail unreconciled | High | Medium-High | Legal review flags it, or an erasure request cannot complete | D7 + S2.7 pseudonymous references designed at schema time | Retrofit = data migration; avoid by deciding in S0 |
| **R8** | State NIL law changes mid-build | High | High (inherent) | A state passes/amends HS NIL legislation | Data-driven `nil_eligibility_rules_list` — **no bylaw logic in code** | Seed update only; no code change |
| **R9** | Frontend verification gap → UX guardrails silently skipped | Medium | High | Components merged with no state/layout evidence | D8 + §7.3 + S7.4 signed manual checklist | Add jsdom deliberately (a D8 revision) |
| **R10** | Bot/RAG leaks non-consented athlete data | **Critical** | Medium | A bot response contains a non-consented field | Guardrails at the **RAG retrieval filter**, not the prompt; `is_minor_safe` default true | Disable `nil_bot` capability until fixed |
| **R11** | Supabase pooler transaction mode breaks the tenant-context mechanism | Medium | Medium | GUC does not persist across a pooled query | Resolve in S2.8 **before** scheduling RLS | Use a direct connection for RLS-scoped work |
| **R12** | Fork inherits dead weight → noisy gates, duplicate models, incomplete sweep | Medium | **Certain (verified)** | Any grep gate returning `.bak` noise | S0.4 hygiene purge | — |
| **R13** | A pilot dataset exists after all | Medium | Low | Supabase project is not empty | D11 confirmed at S0 | Void the estimate; re-plan with a data-migration stage |
| **R14** | Auth0 8-role mapping breaks after the fork | Medium | Medium | A role fails to resolve on the new tenant | S1.3 + S3.8 + G1 round-trip | Fix at S1 — do not carry a broken auth into S3 |

---

## 11. Change Control

| Change type | Process |
|---|---|
| **Task-level** (reorder, split, re-estimate a task) | Update this document; note the reason in the stage PR |
| **Gate change** (exit criteria relaxed) | Requires the plan owner's explicit sign-off, recorded in this document. Relaxing a **P0** criterion is not permitted without a written risk acceptance |
| **Stage insertion/removal** | Requires the plan owner's sign-off + a re-issued §6 estimate |
| **Decision override** (a D-number) | Update §1 with the override, the rationale, and the date. Overrides that contradict a `SPEC_AMENDMENTS.md` entry require that entry to be revised too |
| **Finding closure disputed** | Re-open the finding in `SPINOFF_MVP_ANALYSIS.md`, mark §8 here as contested, and re-verify against the repo before proceeding |

**Re-baseline checkpoint.** §6.1 must be re-issued after G5 (§6.5). A stage that begins after G5 using the pre-G5 estimate without a re-baseline is a plan violation.

---

## 12. Summary

| Question | Answer |
|---|---|
| Is the approach sound? | **Yes.** Pattern replication of a verified-capable platform, with athlete-as-tenant as the isolation root |
| Is the plan executable now? | **Yes.** Every blocking decision has a recommended default (§1); every finding has a closing task or gate (§8); every stage has an entry gate, exit gate, and evidence artifact (§3) |
| Build order | **Hybrid (API-first):** S1–S3 extract API + schema, S4–S5 validate a vertical slice, S6 extracts web, S7–S9 add breadth |
| Estimated effort | **39.5–73 ew, likely ~56.** Backend ~37.5 ew (⅔), web ~19 ew |
| Calendar | 3 engineers: **5–8 months**. Solo: 12–17 months |
| When is the estimate trustworthy? | **After G5.** ~44 of ~56 ew sits in Low-confidence stages; re-baseline S6–S9 from measured velocity (§6.5) |
| The single highest-value action | **S0.1 — the 3–5 day extraction spike.** It converts the two lowest-confidence estimates into measured numbers and produces the coupling map S2 needs |
| The single highest-risk item | **R1 / F1** — resolve the RLS premise (D1) before S2 begins. Do not carry the false premise into the fork |
| What must not slip | **D10 legal review.** External, longest lead time, hard-gates the S2 schema freeze |
