# NIL Youth Sports Platform — Spinoff Review & MVP Effort Analysis

**Document version:** 1.0
**Author:** Devin (agent review)
**Date:** 2026-09-30
**Subject:** `retail-visibility-platform` → `nil-youth-sports-platform` spinoff
**Specs reviewed:** `SKILL.md`, `TECHNICAL_SPEC.md`, `MIGRATION_DESIGN.md`, `IMPLEMENTATION_PLAN.md`, `PROJECT_SEQUENCE.md`, `FRONTEND_SPEC.md`
**Verified against:** the live `retail-visibility-platform` working tree (commands + results in §9)

---

## 1. Scope & Method

### 1.1 Agreed scope (per kickoff clarification)

| Dimension | Decision |
|---|---|
| MVP boundary | **Stages A–G** (extraction A–D + Implementation Phases 1–3) |
| Depth | **Full-stack MVP** (backend + web), with the backend slice broken out separately in §5.4 |
| Relationship to source | **Pattern replication** — the spinoff *reuses* the source platform's architecture (including the `FlexibleApiSingleton` hierarchy), it does not replace it |
| Deliverable | This analysis doc (no code changes) |

### 1.2 Method

1. Read all six spec documents end to end, including the gap-analysis section (§12) and the DDL sketch (§14).
2. Independently verified every load-bearing architectural claim the specs make about the *source* platform against the actual repository — file paths, class names, table names, model counts, RLS presence, typecheck state.
3. Sized the work bottom-up from verified repo metrics rather than from the spec's own day estimates.
4. Produced an estimate with explicit assumptions, ranges, confidence, and a de-risking spike.

> The estimate in §5 is **not** a restatement of the spec's numbers. The spec's numbers (11–18 working days for the entire extraction) are contradicted by repo reality and are replaced.

---

## 2. Executive Verdict

**The replication thesis is sound. The execution plan is materially under-estimated and rests on at least one false architectural premise that must be resolved before Stage B.**

What is genuinely good about the spec set:

- The **commerce ⇄ NIL capability equivalency** (`TECHNICAL_SPEC.md` §7.1) is real, not aspirational. The source platform's primitives — two-tier singleton split, capability gating with tier + merchant resolvers, tenant-scoped ID generation, `BaseService` / `PermissionEnhancedBaseService`, CRM, RAG bot — all exist and all have plausible NIL analogs. Verified: `BaseService` at `apps/api/src/services/BaseService.ts:11`, `PermissionEnhancedBaseService` at `apps/api/src/services/permissions/PermissionEnhancedBaseService.ts:41`, 44 resolver files, 11 `*options_settings` Prisma models, 24 `*-options-settings` route files.
- **Athlete-as-tenant** is the right call. It is the only model that makes an athlete in a school *and* a travel club, transferring without losing history, work without inventing a parallel isolation mechanism.
- The **§12 gap analysis is the strongest part of the set.** COPPA/FERPA/state-NIL, anti-predator controls, versioned scoped consent, media moderation, and KYC-on-guardian are correctly identified as P0 and correctly folded into Phase 2 rather than deferred. This is not boilerplate compliance theater; the specific resolutions (guardian is the KYC subject; `age_band` gates intake; GPA defaults private; deal creation *blocked* not flagged where `deals_allowed=false`) are the right designs.

What is not sound:

- **The single most important privacy guarantee in the spec does not exist in the source platform.** The spec asserts, in three separate places, that the platform already has RLS tenant isolation keyed to `current_setting('app.current_tenant')` and that it "carries over unchanged." It does not. There are **3 `CREATE POLICY` statements in the entire migration history**, in **2 files** (one of which is a `.sql.backup`), against **343 Prisma models**. The only `current_setting('app.current_tenant')` references in the codebase are in `queue-routes.ts` and `ProductQueueService.ts` — and the `set_config` line is **commented out** (`apps/api/src/routes/queue-routes.ts:39`). Both files are on the spec's own DROP list. See finding **F1**.
- **The effort estimates are roughly an order of magnitude low.** The spec budgets 11–18 working days for Stages A–D. Bottom-up sizing puts extraction at **17–34 engineer-weeks**. See §5.
- **Stages E–G were never estimated at all.** `IMPLEMENTATION_PLAN.md` and `PROJECT_SEQUENCE.md` carry no effort figures for Phases 1–3. The only numbers in the set cover the extraction. So "MVP effort" as previously documented does not include the MVP.
- **Several spec file references do not exist in the repo.** `packages/feature-definitions/src/definitions/{canonical-features,tier-hierarchies}.ts` is referenced as the place to define every capability (`TECHNICAL_SPEC.md` §7 step 1, §11) — `packages/` contains only `shared`, and neither file exists anywhere in the tree. `apps/web/src/services/base/` is referenced for the NIL base singletons; the real directory is `apps/web/src/providers/base/`. See **F4**.

**Bottom line:** the architecture is a good bet; the plan needs a re-baselining pass before anyone starts deleting files. Recommended total for Stages A–G: **36–66 engineer-weeks, midpoint ~48** (§5). Recommended immediate action: a **3–5 day extraction spike** (§5.6) plus **8 blocking decisions** (§8).

---

## 3. What the Replication Thesis Gets Right

Worth stating explicitly, because the criticisms in §4 are numerous and could otherwise read as a rejection of the approach.

| Claim in the spec | Verdict | Evidence |
|---|---|---|
| Two-tier pipeline (cached public / 0-TTL private) is already the platform's architecture | **True** | `FlexibleApiSingleton.cacheTTL = 5 * 60 * 1000` default (`apps/web/src/providers/base/FlexibleApiSingleton.ts:80`); 8 services extend it directly, 6 use the V2/Enhanced variants |
| Capability gating with tier + merchant resolvers is a working, repeated pattern | **True** | 44 resolvers, 24 `*-options-settings` routes, 11 `*options_settings` models, `EffectiveCapabilityResolver.ts` present |
| Tenant-scoped ID generation with an `id-generator.ts` catalog | **True** | `apps/api/src/lib/id-generator.ts` + `ID_GENERATOR_PATTERN.md` |
| CRM is reusable with a small delta | **Mostly true** | `crm_support_tickets`, `crm_inquiries`, `crm_tasks`, `crm_activities`, `crm_alerts`, `crm_contacts` all exist with `tenant_id VARCHAR(255)`; `actor_type` is app-level so new values need no DB change. The "already uses RLS" half of the claim is false (**F1**) |
| Bot/RAG stack is reusable with a small delta | **Mostly true** | `bot_conversations`, `bot_messages`, `bot_faq_embeddings`, `bot_guardrail_rules`, `bot_configurations` all exist; `bot_guardrail_rules` is a real child-safety hook. Again, the "already uses RLS" half is false |
| `subscription_tiers_list` / `features_list` / `capability_features_list` / `tier_features_list` / `capability_type_list` exist and can be re-keyed to NIL | **True** | All five models present (`schema.prisma` lines 608, 626, 2268, 6107, 7460) |
| Deal-as-purchase reuses checkout/escrow | **Plausible** | Payment gateway abstraction, BSaaS purchase flow, refund + tax services all present. Cost is entanglement, not feasibility — see **F7** |

---

## 4. Verified Findings

Each finding was checked against the working tree. Evidence and impact are given so the plan can be amended directly.

### F1 — **[BLOCKER]** The RLS foundation the spec depends on does not exist

**Spec claims (three places):**

- `TECHNICAL_SPEC.md` §3.2: "RLS policy: Postgres row-level security on all athlete-owned tables… so one athlete's data can never leak into another's **even on a query bug**."
- `TECHNICAL_SPEC.md` §14.10 note: "match `current_setting('app.current_tenant', ...)` to however the existing codebase sets the RLS tenant GUC (grep for `set_config`/`app.current_tenant` — see `ProductQueueService.ts` / `queue-routes.ts`). **Do not invent a new mechanism.**"
- `MIGRATION_DESIGN.md` §3.4: "The existing platform uses `current_setting('app.current_tenant', true)` for RLS. **This mechanism carries over unchanged.**"
- `TECHNICAL_SPEC.md` §14.11/§14.12: CRM and bot tables are described as "already use `tenant_id VARCHAR(255)`, explicit `VARCHAR` ids, **and RLS**."

**Repo reality:**

```
$ grep -rh "CREATE POLICY" apps/api/prisma/migrations | wc -l
3
$ grep -rl "ROW LEVEL SECURITY" apps/api/prisma/migrations
apps/api/prisma/migrations/003_create_product_queue.sql.backup   <-- a backup file
apps/api/prisma/migrations/create_storefront_options.sql
$ ls apps/api/prisma/migrations | wc -l
28
$ grep -c "^model " apps/api/prisma/schema.prisma
343
```

The only `set_config` / `app.current_tenant` usage in application code:

```
apps/api/src/routes/queue-routes.ts:38-39
    // Set tenant context for RLS
    // process.env.POSTGRES_OPTIONS = `-c app.current_tenant_id=${tenantId}`;
```

It is **commented out**. It also uses a *different* setting name (`app.current_tenant_id`) than the spec's policies expect (`app.current_tenant`) — so even the dead code would not satisfy the spec's policy predicate. `ProductQueueService.ts:756` and both files are commerce-specific and on the spec's DROP list.

**Impact.** The spec's "structurally impossible to leak" guarantee — the thing that justifies athlete-as-tenant and the whole Phase-2 safety story — is currently an application-level convention (`WHERE tenant_id = $1` in each query). The spec acknowledges this elsewhere (§0: "Postgres RLS + explicit `WHERE tenant_id = $1`"), but §3.2/§14.10 present RLS as an *independent second layer* that catches query bugs. It is not. And the plan's own verification defers RLS to Phase 4 (§10 item 8; `PROJECT_SEQUENCE.md` H.1) while §3.2 claims it enforces Phase 2. **The set contradicts itself.**

Additional hazard the specs do not mention: **Supabase's pooler runs in transaction mode by default**, which is incompatible with session-level `set_config` — the standard way to propagate a tenant GUC through Prisma. Making RLS actually work with a pooled Prisma client is a real engineering problem (per-transaction `set_config` via interactive transactions, or a dedicated direct connection for RLS-scoped work), not a `grep`-and-copy.

**Required action.** Resolve before Stage B. Two viable positions:

1. *(Recommended)* **RLS is Phase-4 hardening, not the Phase-2 guarantee.** Phase 2 enforcement = explicit `WHERE tenant_id` **plus** a repository-level tenant guard (a single Prisma middleware / wrapper that rejects any query against an athlete-owned table without a tenant predicate). Document RLS as defense-in-depth that arrives in Stage H. This matches what the plan already schedules (H.1) and stops the spec from promising a control it does not have.
2. **Build RLS from scratch in Stage B.** Then budget it honestly: ~24 athlete-owned tables × (policy + GUC plumbing + transaction-mode workaround + isolation tests) is its own workstream, not a line item in a schema task.

Either way, `MIGRATION_DESIGN.md` §3.4 must be corrected — a junior agent following it literally will write policies against a GUC nothing sets, and every "RLS isolation test" will pass vacuously (no rows visible at all) or fail.

### F2 — **[BLOCKER]** `tenants.tenant_type` does not exist, and `tenants` is heavily commerce-coupled

The plan correctly flags this as blocking (`B.1.1` / task `0.2`). The repo makes the stakes concrete: there is **no `tenant_type` column** (the only `tenant_type` matches in `schema.prisma` are index names on unrelated tables).

More importantly, `tenants` is a large, commerce-shaped model. The head of the model alone carries:

```
subscription_status, subscription_tier, trial_ends_at, stripe_customer_id,
stripe_subscription_id, monthly_sku_quota, skus_added_this_month,
google_business_access_token / refresh_token / token_expiry, google_sync_enabled,
google_product_count, directory_visible (default true), subdomain, slug,
platform_fee_percentage, platform_fee_fixed_cents, platform_fee_waived, ...
```

Making **every minor athlete a row in this table** means each athlete-tenant inherits: a `subscription_tier` and `subscription_status` (what tier is a 12-year-old on?), a Stripe customer slot, a public `slug`/`subdomain` uniqueness constraint, `directory_visible = true` by default, Google Merchant Center token columns, and the SKU quota counters.

**Impact.** Three distinct problems, only one of which the plan names:

1. *Semantics* — `subscription_tier` / `requireLimit(tenantId, 'nil_roster_size')` against an athlete-tenant is meaningless. §12.9 resolves the *policy* ("guardian and fan features are platform-level, always-on") but not the *mechanism* (what value does `subscription_tier` hold? does the capability resolver get called with an athlete-tenant at all?).
2. *Data hygiene* — 343-model schema with an athlete-per-tenant model means athlete rows accumulate commerce columns that will never be populated and must be nulled, defaulted, or excluded from every projection. Each one is a potential accidental disclosure.
3. *Public surface* — `directory_visible` defaults to `true` and the platform has a tenant directory / storefront-discovery surface (`mv_storefront_discovery`). Unless explicitly excluded, **athlete-tenants are eligible for public tenant discovery**. That is a minor-safety defect, not a cosmetic one.

**Required action.** Decide between (a) widening `tenants` with `tenant_type` + a `nil_tenant_profile` side table holding athlete-specific columns, or (b) a side table carrying *everything* NIL-specific including a distinct tier semantics. Recommendation: **(a), plus an explicit `directory_visible = false` default and a public-surface exclusion rule for `tenant_type='athlete'`** (see F9). Also confirm what `subscription_tier` an athlete-tenant carries — a seeded `platform_default` tier row is the cleanest answer.

### F3 — **[HIGH]** The API build deliberately tolerates TypeScript errors, so `checkapi` is the only real gate

```
$ cat apps/api/build-with-selective-errors.js
// SAFE_ERROR_PATTERNS: "Property 'x' does not exist on type 'y'" ...
// UNKNOWN ERRORS: console.log('⚠️  Proceeding with unknown errors'); process.exit(0);
```

The production build **exits 0 with unresolved TS errors** — including Prisma model-name errors and missing include/select properties. Only syntax errors, `Cannot find module`, and call-signature errors fail it.

The good news, verified:

```
$ pnpm checkapi   # tsc --noEmit --project apps/api   → exit 0, no error output
$ pnpm checkweb   # tsc --noEmit --project apps/web   → exit 0, no error output
```

**Both typecheck targets are green today.** That is a genuine asset — it means "zero TS errors" is an achievable Definition of Done rather than a pre-existing debt payoff.

**Impact.** The green baseline is also a trap. The build has been masking type errors in production for a while, so the *type-level* surface of the codebase is less trustworthy than a green `checkapi` suggests. The moment a batch of commerce files is deleted, every retained file that touched a dropped model will surface an error — and those errors were previously invisible because `checkapi` is run by developers, not by the deploy. Expect a **repair tax** proportional to deletion volume, concentrated in exactly the retained subsystems the spec assumes are "reuse as-is" (CRM, bot, audit, analytics, navigation, capability seeds).

**Required action.** Freeze the green baseline *before* any deletion (capture `checkapi`/`checkweb` output to an artifact), then delete in small batches with a `checkapi` run per batch. Add a CI gate so `checkapi`/`checkweb` are enforced on the new repo from commit 1 — otherwise the fork inherits the same erosion.

### F4 — **[HIGH]** Spec file references are partially stale or non-existent

| Spec reference | Reality |
|---|---|
| `packages/feature-definitions/src/definitions/canonical-features.ts` and `tier-hierarchies.ts` (`TECHNICAL_SPEC.md` §7 step 1, §11 "Feature defs") | **Do not exist.** `packages/` contains only `shared`. No `canonical-features` or `tier-hierarchies` file anywhere in the tree |
| `apps/web/src/services/base/` for NIL base singletons (`MIGRATION_DESIGN.md` §4.1) | Real directory is `apps/web/src/providers/base/` |
| `ProductQueueService.ts` / `queue-routes.ts` as the RLS GUC reference (`TECHNICAL_SPEC.md` §14.10) | Both are commerce files on the DROP list; the reference line is commented out (**F1**) |
| `crm_options` / `chatbot_options` resolvers as the templates for `NilCrmOptionsResolver` / `NilBotOptionsResolver` | Resolver filenames differ from the capability keys; the 44-file `resolvers/` directory needs to be enumerated before the mapping is written |
| Feature/tier seeding described as "define in `canonical-features.ts` + tier assignment in `tier-hierarchies.ts`" | Actual mechanism is per-capability seed scripts (`apps/api/prisma/seed-{barcode,chatbot,crm,faq,product-layout,product-types,storefront-layout}-capabilities.ts`) plus `seed-tiers.ts` |

**Impact.** Low severity, high friction. These references are in the *definition of done* path for every capability task ("Define: feature key(s) in `canonical-features.ts`"). A junior agent following `IMPLEMENTATION_PLAN.md` §0's instruction ("Do not improvise a pattern that a skill already defines") will stall at step 1 of the 8-phase pipeline, or worse, invent the file — creating a second, divergent feature-definition mechanism in the new repo.

**Required action.** Run a path-audit pass over all six docs before kickoff and replace every reference with a verified path. The *patterns* are real; the *addresses* need correcting.

### F5 — **[HIGH]** "The `FlexibleApiSingleton` architecture" is not one thing — pin the canonical variant first

The source repo contains a fragmented and partially abandoned base-singleton layer:

```
apps/web/src/providers/base/
  UniversalSingleton.ts
  EnhancedFlexibleApiSingleton.ts      (extends UniversalSingleton)
  FlexibleApiSingleton.ts              (extends EnhancedFlexibleApiSingleton)   <-- spec §13 targets this
  FlexibleApiSingletonV2.ts            (extends UniversalSingleton directly)
  FlexibleApiSingletonStable.ts        (extends UniversalSingleton directly)
  PublicApiSingleton.ts / PublicApiSingletonStable.ts
  TenantApiSingleton.ts, CustomerApiSingleton.ts, AdminApiSingleton.ts,
  AuthenticatedApiSingleton.ts, OrganizationApiSingleton.ts, ExternalApiSingleton.ts
  + BASE_CLASS_ALIGNMENT.ts, COMMON_ALIGNMENT_STRATEGY.md,
    FINAL_ALIGNMENT_REPORT.ts, MIGRATION_PLAN.md, TARGET_SYSTEM_DEMO.ts
```

114 files reference `FlexibleApiSingleton` in some form. 8 services extend `FlexibleApiSingleton` directly; 6 use the V2/Enhanced variants. `V2` and `Stable` **bypass** `EnhancedFlexibleApiSingleton` entirely — they are a different chain, not a refinement of the one the spec's §13 hierarchy assumes.

**Impact.** The spec's §13 hierarchy (`Flexible > Enhanced > {Public, Tenant, Customer, Admin} > Nil*`) is a correct description of *one* of three coexisting chains, and it is the oldest one. Replicating "the `FlexibleApiSingleton` architecture" into a new repo without deciding which chain is canonical means the spinoff starts life with the same three-way drift — and the new NIL bases (`AthleteApiSingleton` etc.) would extend a chain that a growing share of the source's own services has moved off. The alignment docs (`COMMON_ALIGNMENT_STRATEGY.md`, `MIGRATION_PLAN.md`, `FINAL_ALIGNMENT_REPORT.ts`) indicate the source team already knows this and has not finished.

**Required action.** Before Stage D: (1) choose the canonical chain, (2) delete the abandoned variants from the fork rather than carrying them, (3) make "concrete NIL services extend a NIL base, never `UniversalSingleton` directly" an **enforced CI check** — the spec states the rule as prose (`§2.3`, `§13` "junior-agent rules") but the source repo demonstrably cannot hold that line by convention alone.

### F6 — **[MEDIUM]** Internal contradictions inside the spec set

These are not repo mismatches; they are the documents disagreeing with each other, which is worse for a junior agent than a simple error.

| # | Contradiction | Consequence |
|---|---|---|
| a | `TECHNICAL_SPEC.md` §3.2: RLS is a Phase-2 enforcement layer. `PROJECT_SEQUENCE.md` H.1 / `TECHNICAL_SPEC.md` §10 item 8: RLS is Phase 4. | The Phase-2 safety story is ambiguous; the P0 acceptance tests cannot be written |
| b | `MIGRATION_DESIGN.md` §2.1: keep `FlexibleApiSingleton` "as-is." `TECHNICAL_SPEC.md` §13: NIL bases are a new layer that concrete services must use. | Which chain, and is the platform layer still directly extensible? (**F5**) |
| c | Definition of Done: "no `randomUUID`/`Date.now()` ids." `TECHNICAL_SPEC.md` §14.12: bot tables keep `@db.Uuid` + `gen_random_uuid()`. | The grep gate will fail on compliant code, or the bot convention gets silently changed |
| d | `TECHNICAL_SPEC.md` §7: `nil_guardian` and `nil_fan_network` are registered capabilities (with options tables). §12.9: guardian and fan features "are NOT capability-gated." | `FRONTEND_SPEC.md` §13a.11 still lists `useNilGuardianCapability` and `useNilFanNetworkCapability` hooks. Two contradictory implementations are specified |
| e | `PROJECT_SEQUENCE.md` §C.3: "The NIL base singleton classes are web-side only. No API-side action needed." `TECHNICAL_SPEC.md` §9: `AthleteProfileService` extends `PermissionEnhancedBaseService`; other services extend `BaseService` / `UniversalSingleton`. | The API-side base story is left undefined for a junior agent, despite 14 services being specified |

**Required action.** A single reconciliation pass producing one authoritative answer per row, with the losing document amended. Row (d) in particular must be resolved before any capability work — it determines whether two of eleven capabilities have resolvers at all.

### F7 — **[MEDIUM]** The `orders`/`order_items`/`payments` → `nil_deals`/`nil_deal_milestones`/`nil_payments` rename is the riskiest schema transformation

`MIGRATION_DESIGN.md` §3.2 renames these in place. Because the target database is **fresh**, the rename buys nothing and costs a great deal: `orders` / `payments` are entangled with Stripe subscription billing, refunds (`refund-singleton.ts`), tax/1099 (`tax.ts`, `TaxService.ts`), deposit forfeiture, shipments, and the BSaaS purchase flow — all of which the spec lists on the KEEP side.

**Impact.** An in-place rename means the deal model inherits order-shaped columns, relations, and semantics (`order_items` → milestones is not a 1:1 conceptual fit: milestones are escrow *states*, not line items). Every retained Stripe/refund/tax service then needs its queries re-pointed at renamed models, which is a wide, shallow, error-prone change.

**Required action.** On a fresh DB, prefer **create-new + delete-old**: define `nil_deals` / `nil_deal_milestones` / `nil_payments` as purpose-built models from `TECHNICAL_SPEC.md` §14.8, delete the commerce order/payment models, and let the repurposed checkout/payment *services* be the reuse point (which is where the real logic lives anyway). This converts a risky rename-with-entanglement into a clean model definition plus a service-level adaptation.

### F8 — **[MEDIUM]** Extraction hygiene was not planned, and the fork carries a lot of dead weight

```
$ git ls-files | grep -cE "\.(bak|backup)$"
509
```

509 tracked `.bak`/`.backup` files. Plus abandoned code (`FlexibleApiSingletonV2/Stable`, `TARGET_SYSTEM_DEMO.ts`, `FINAL_ALIGNMENT_REPORT.ts`), plus backup *Prisma models* (`subscription_tiers_list_v1_backup`, `tier_features_list_v1_backup`, `tenants_metadata_backup_gbp`), plus a `UniversalSingleton.ts.bak`, plus stray baseline-metric text dumps in `apps/api/`.

**Impact.** The extraction stages are defined entirely as *deletions of commerce* with no hygiene pass. A fork that keeps 509 backup files and three backup Prisma models will (a) make every future grep/gate noisy, (b) leave duplicate-looking models in the schema that a junior agent may mistake for the real one, and (c) carry commerce artifacts into a child-safety-sensitive codebase where a PII sweep must be provably complete. "Delete the backup files" is a 1–2 day task that materially improves every downstream verification step — it should be Stage B.0, not an afterthought.

### F9 — **[HIGH]** Retained subsystems are minor-data exposure surfaces, and only CRM/bot were considered

The spec's PII strategy is: (1) public routes filter `visibility_status='approved'` + consent, (2) DTO mappers strip PII, (3) RLS (which does not exist — **F1**). It considers the CRM and the bot as the places where athlete/guardian linkage columns are needed.

Not considered, all of which are on the KEEP list and all of which can project athlete data:

| Surface | Risk |
|---|---|
| `mv_storefront_discovery` → renamed `mv_athlete_discovery` | A **materialized view** is a second copy of the data. Renaming it does not re-scope it; if it is built from a broad join it can expose athlete rows that no route would |
| Tenant directory / discovery (`directory_visible` default `true`) | Athlete-tenants become publicly discoverable unless explicitly excluded (**F2**) |
| `navigation_links` (DB-driven nav, reseeded for NIL) | Nav is data. A stale link can point at an athlete surface that the route layer no longer gates |
| Email templates (`email-service.ts`, 6 new invitation templates) | Guardian/athlete identity, deal amounts, and claim tokens transit email. Needs its own review |
| Audit log (`audit_log`, `X-Audit-ID`) | Audit trails are append-only by design; an audit row containing a minor's DOB is a permanent retention problem, and "right to erasure" (§12.1) must reconcile with "immutable audit trail" (§12.11). **The spec never resolves this tension** |
| Sentry / error tracking | Stack traces and request payloads are the classic PII leak; a new Sentry project does not fix `sendDefaultPii` settings |
| Analytics / behaviour tracking / threat detection | KEEP-list services that log request context |
| Sitemap / SEO / social preview surfaces | Athlete profiles are public routes; previews and crawlers are a projection path |

**Impact.** The verification checklist (`TECHNICAL_SPEC.md` §10 item 7) reduces this to "no public route projects DOB, parent contact, or financial routing" with a "schema/DTO snapshot test." That is necessary but not sufficient — the materialized view, the directory default, nav links, email, Sentry, and the audit/erasure conflict are all outside that test's reach.

**Required action.** Add a dedicated stage (**Public Surface & PII Sweep**, see §6) that *enumerates* every retained read path — routes, materialized views, nav data, email, error reporting, analytics, sitemap — and proves athlete/guardian data cannot reach it. And resolve the erasure-vs-immutable-audit conflict explicitly (§8 decision 7).

### F10 — **[MEDIUM]** The P0 negative-path tests have no harness, and the frontend has no DOM test environment

The spec is emphatic that P0 negative paths are release-blocking (`§12.12`, `PROJECT_SEQUENCE.md` "Verification & Test Strategy"). Verified test inventory:

```
apps/api  : 204 test files      (vitest at root)
apps/web  :  30 test files      (vitest, node environment)
```

Per `AGENTS.md`, `apps/web` has **no jsdom and no testing-library** — component tests must server-render via `renderToStaticMarkup`, `useEffect` never runs, Radix/Accordion panels unmount when inactive, and only `.test.ts` (not `.tsx`) is collected. That is a workable but *constrained* harness for the presentational assertions `FRONTEND_SPEC.md` §14 asks for ("all user-visible states handled", "no unintended page-level horizontal overflow", "mobile 320px / desktop 1440px intentionally designed"). Those are not expressible in the existing harness.

Meanwhile the P0 tests the spec specifies are of a kind the repo has no precedent for:

- COPPA: under-13 self-registration → 403
- Structural invariant: no adult↔minor thread without a guardian participant
- Cascade: consent revocation removes profile + media from public surfaces within one request, evicting every cache namespace
- Per-state matrix: deal blocked where `deals_allowed=false`
- RLS isolation (see **F1** — cannot be written against a mechanism that does not exist)

**Impact.** "All P0 negative-path tests are release-blocking" is stated as a gate but is unbuildable at Stage F without a harness built at Stage B/C. Building the harness *after* the features it guards is how safety tests get skipped under schedule pressure.

**Required action.** Move harness construction into Stage B/C. Decide explicitly what the frontend verification story is (server-render assertions only, or introduce jsdom — a dependency decision that should be made once, deliberately, not discovered per-component).

### F11 — **[LOW]** Effort figures exist only for the extraction, and only in one document

`MIGRATION_DESIGN.md` §5 gives M0–M4 day counts (1–2 / 2–3 / 3–5 / 3–5 / 2–3 days = **11–18 working days**). `IMPLEMENTATION_PLAN.md` and `PROJECT_SEQUENCE.md` give **no** estimates for Phases 1–4. So the only published effort figure in the set covers ~a third of the agreed MVP scope and is itself ~an order of magnitude low (§5).

**Impact.** Anyone planning against these documents will size the MVP from the 11–18 day figure and conclude it is a three-week project.

**Required action.** Replace the §5 estimates with the ranges in §5 of this document, and add estimates for Phases 1–3 (which have none).

### F12 — **[LOW]** The NIL model count in the plan undercounts the schema work

`PROJECT_SEQUENCE.md` B.2.3 lists 22 `*_list` tables plus two invitation/onboarding tables plus "`tenant_nil_*_options_settings` tables". `MIGRATION_DESIGN.md` §3.3 enumerates 25 tables + 8 enums + 7 options-settings tables. `TECHNICAL_SPEC.md` §14 contains **23 `CREATE TABLE` statements and only 2 `CREATE POLICY` statements** — i.e. the spec's own RLS sketch covers 2 of ~24 athlete-owned tables, which is the same shortfall as **F1** seen from the other direction.

**Impact.** Minor, but it means the "add NIL models" task (`B.2.3`) is not the well-bounded item it appears to be. Count the tables from §14 directly and treat the RLS story per F1.

---

## 5. Effort Estimate — Stages A–G (Full-Stack MVP)

### 5.1 Method & units

**Unit: engineer-week (ew) = 1 person × 5 focused days, inclusive of design, implementation, review, and the spec's own verification gate.** Ranges are optimistic–pessimistic; the midpoint is the planning number.

Estimates are bottom-up from verified repo metrics (§9), **not** derived from the spec's day counts. They assume:

- **Assumption 1.** A competent implementer (or agent-assisted pair) familiar with the codebase, not a junior agent working the task list cold.
- **Assumption 2.** Extraction is done as a *fork-and-strip on a fresh database*, so **no data migration is required** — this is a large saving the spec correctly claims.
- **Assumption 3.** The green `checkapi`/`checkweb` baseline holds and is enforced in CI from commit 1 (F3).
- **Assumption 4.** The 8 blocking decisions in §8 are made *before* the stage that depends on them. Estimates assume decisions are available when needed; a late decision adds rework, not just delay.
- **Assumption 5.** RLS is treated as Phase-4 hardening with an explicit-`WHERE` + repository-guard Phase-2 story (F1 option 1). Choosing F1 option 2 (build RLS in Stage B) adds **+3 to +6 ew** to Stage B and +1 to +2 ew to Stage F.
- **Assumption 6.** Phase-3 capability work is counted **once**, in Stage G. Stage C creates ID generators and the resolver/registry plumbing only; it does not create the five persona capabilities (this prevents double counting between the spec's Stage C and Stage G task lists).
- **Excluded:** legal review itself (B.1.3 — external, but it *blocks* Stage B and must be scheduled); content/UX copywriting; Stripe/Auth0/SendGrid account setup lead times; ongoing maintenance.

### 5.2 Estimate by stage

#### Extraction (Stages A–D) — fork, strip, re-platform

| Stage | Deliverable | Spec says | **This estimate** | Confidence | Dominant cost |
|---|---|---|---|---|---|
| **A** Infra | New git/Supabase/Auth0/Vercel/Railway/Doppler; package + brand rename | 1–2 d | **1–2 ew** | High | Auth0 8-role wiring + callback/logout flows; Doppler parity across 3 configs; proving the *unmodified* fork deploys before anything is deleted |
| **B** Schema transform | 343 → NIL-only Prisma schema; ~25 new tables, 8 enums, 7 options tables; RLS decision; trigger; MV; base seeds | 2–3 d | **4–8 ew** | **Low** | Schema surgery on 8,413 lines with Prisma relation fallout; `tenant_type` decision (F2); capability/tier/feature reseeding to NIL keys; RLS decision (F1); enumerating DB objects from the *live* DB, not just `schema.prisma` (the repo uses `prisma db push` scripts alongside 28 migrations, so out-of-band objects are a real risk) |
| **C** API strip + core | Delete ~90 commerce route/service/middleware files; repair import fallout; 19 ID generators; resolver registry + `EffectiveCapabilityResolver` rewiring; auth middleware for 8 roles | 3–5 d | **6–12 ew** | **Low** | The deletion-and-repair loop across 542 route files / 361 services / 87,884 LOC. Latent type errors surface only after deletion (F3). Retained subsystems (CRM, bot, audit, analytics, nav, seeds) all touch dropped models |
| **D** Web strip + core | Delete commerce routes/services/components; 7 NIL base singletons; ~10 web services; `proxy.ts`/`PLATFORM_DOMAINS`; AuthContext; `UnifiedCapabilityService`; rbac; nav reseed; rebrand | 3–5 d | **6–12 ew** | **Low** | Same repair loop at 168,776 LOC / 436 `page.tsx` / 303 services, plus the canonical-base-variant decision (F5) and rebrand across email/Sentry/theme |
| **B.0** Hygiene *(new — not in spec)* | Delete 509 `.bak`/`.backup` files + 3 backup Prisma models + abandoned singleton variants; freeze green baseline artifacts | — | **0.5–1 ew** | High | Cheap, and it de-noises every subsequent verification step (F8) |
| | **Extraction subtotal** | **11–18 d (2.2–3.6 ew)** | **17.5–35 ew** | | |

#### MVP feature build (Stages E–G) — Implementation Phases 1–3

| Stage | Deliverable | Spec says | **This estimate** | Confidence | Dominant cost |
|---|---|---|---|---|---|
| **E** Credibility shell | Landing + NIL domain in `proxy.ts` + lead intake (`NilLeadService`, `nil_leads_list`) + `nil_landing` capability (full 8-phase) | not estimated | **2–3 ew** | Medium | The 8-phase capability pipeline is the template-establishing exercise; the first capability is always the most expensive |
| **F** Native pipeline (Phase 2) | Athlete-tenant + guardianship + memberships + versioned consent + media/metrics/achievements + roster + visibility firewall + `nil_roster` + `nil_compliance` (manual) + cache-eviction contract + **P0 gates** + P0 test harness | not estimated | **5–9 ew** | Medium | The safety core: `age_band`/COPPA intake gating, consent ledger + revocation cascade, media allowlist + moderation queue, cache-namespace completeness, and building the negative-path harness (F10). Highest *consequence* density in the whole program |
| **G** Unified service (Phase 3) | Memberships; 5 persona capabilities × 8 phases (`nil_guardian`, `nil_recruiting`, `nil_sponsorship`, `nil_achievements`, `nil_fan_network`); 6 dashboards; CRM deltas + `nil_crm`; bot deltas + 4 personas + guardrails + `nil_bot`; invitations (9 routes, service, 5 FE components, 6 email templates, 6 connection side effects); onboarding (3 routes, service, 2 FE components) | not estimated | **12–20 ew** | Low | Breadth. ~30 discrete tasks in the spec's own Phase-3 list. Invitations + onboarding alone are a multi-week subsystem, and the connection-establishment side effects each carry a cache-invalidation obligation |
| | **Feature-build subtotal** | **not estimated** | **19–32 ew** | | |

### 5.3 Total

| | Low | **Likely (mid)** | High |
|---|---|---|---|
| Extraction (A–D incl. B.0) | 17.5 | **26** | 35 |
| Feature build (E–G) | 19 | **25** | 32 |
| **Total, Stages A–G** | **36.5 ew** | **~48 ew** | **67 ew** |

**Against the spec's published figure:** `MIGRATION_DESIGN.md` §5 estimates the extraction at 11–18 working days (2.2–3.6 ew) and gives no figure for the feature build. This estimate is **~7–10× the published extraction number** and adds ~25 ew of previously unestimated feature work.

**Why the gap is this large** (worth internalizing, because it recurs in every fork-and-strip estimate):

1. The spec counts *deletion* as the work. Deletion is fast; **repair is the work**, and repair cost scales with the *retained* code's coupling to dropped models, which is invisible until you delete.
2. The spec treats `schema.prisma` as the DB source of truth. It may not be — `prisma db push` scripts coexist with 28 migrations, so triggers, policies, and views applied out-of-band will be silently lost in the fork (and RLS is already un-versioned — F1).
3. The spec's DoD ("zero TS errors") is real and currently green, but the *deploy* build masks errors (F3), so the codebase's type-level health is less trustworthy than it looks.
4. The spec's "reuse as-is" list (CRM, bot, payment, audit, analytics, nav) is where the coupling concentrates — those are the files that must be *edited*, not kept.

### 5.4 Backend slice (if you want to fund it separately)

Because the schema, API, and safety core dominate the cost, the backend is **not** half the work — it is roughly two thirds.

| Slice | Stages | Estimate |
|---|---|---|
| **Backend / API only** — infra, schema, API strip + services, NIL base classes needed by API consumers, ID generators, resolvers, capability routes, firewall, consent, roster, moderation, P0 harness, CRM/bot/invitation/onboarding *services* | A, B, B.0, C, minimal D, E (API), F (API), G (API) | **24–45 ew** (~33 mid) |
| **Web / frontend remainder** — web base singletons, web services, `proxy.ts`/auth, landing + roster UI, 6 dashboards, ~44 new components (`FRONTEND_SPEC.md` §8.2), nav reseed, rebrand, capability hooks, invitation/onboarding UI | D (UI), E (UI), F (UI), G (UI) | **12–22 ew** (~16 mid) |

If the goal is to *prove the architecture* rather than ship the MVP, the spec's own "First Executable Slice" (`PROJECT_SEQUENCE.md` §"First Executable Slice") is the right target: athlete-tenant + RLS/guard + consent + `nil_roster` + P0 gates. That slice is **~7–11 ew** on top of Stage A and a *narrowed* Stage B (schema for profile/guardianship/consent/media only). It validates the riskiest assumptions — athlete-as-tenant, the firewall, scoped consent, capability gating, P0 gates — before breadth is committed.

### 5.5 Calendar scenarios

Ranges assume the §8 decisions are made on time. Stage B blocks C and D; C blocks F. Stages C and D are largely parallelizable; G parallelizes well across personas.

| Team | Calendar (mid estimate, ~48 ew) | Notes |
|---|---|---|
| 1 engineer | **9–14 months** | Serialized; Stage C alone is 6–12 ew |
| 2 engineers (backend, web) | **6–9 months** | Blocked by B→C→F chain |
| 3 engineers (backend, web, safety/QA) | **4.5–7 months** | Best fit; safety/QA owns the P0 harness + PII sweep from Stage B |

These are planning ranges, not commitments — the low-confidence stages (B, C, D) carry the spread.

### 5.6 De-risking spike (do this first — 3–5 days)

The estimate's uncertainty is concentrated in the deletion-and-repair tax (F3). Measure it instead of guessing:

1. On a throwaway branch of the fork, delete **one complete commerce vertical** — `inventory/` is a good candidate (routes + services + web surfaces + Prisma models).
2. Repair until `pnpm checkapi` **and** `pnpm checkweb` are green again.
3. Record: files deleted, files *edited* (not deleted), type errors surfaced, wall-clock time.
4. Extrapolate by vertical against the DROP list (~30 groups in `MIGRATION_DESIGN.md` §2.2).

This converts the two lowest-confidence rows in §5.2 into measured numbers and typically tightens the total range by more than half. It also surfaces the coupling map (which retained subsystems touch dropped models) that Stage B needs anyway.

---

## 6. Recommended Plan Amendments

Additions and re-sequencing, in priority order. Items 1–3 are blocking.

| # | Amendment | Rationale |
|---|---|---|
| 1 | **Resolve the RLS premise before Stage B** (F1). Amend `MIGRATION_DESIGN.md` §3.4 and `TECHNICAL_SPEC.md` §3.2/§14.10/§14.11/§14.12 to match the decision. | The spec's core privacy claim currently rests on a mechanism that does not exist and points a junior agent at commented-out dead code in a file scheduled for deletion |
| 2 | **Decide `tenant_type` and athlete-tenant tier semantics** (F2), including `directory_visible=false` for `tenant_type='athlete'` and a public-surface exclusion rule. | Blocking per the plan; and the default-true directory flag is a minor-safety defect |
| 3 | **Pin the canonical base-singleton chain and delete the abandoned variants** (F5). Add a CI check that NIL services extend a NIL base, never `UniversalSingleton` directly. | Otherwise the fork inherits three coexisting chains and the spec's §13 hierarchy targets the oldest |
| 4 | **New Stage B.0 — Hygiene + green baseline** (F8, F3): delete 509 backup files + backup Prisma models + abandoned singletons; capture `checkapi`/`checkweb` baseline artifacts; install CI gates (typecheck; grep gates for raw `fetch`, `randomUUID`/`Date.now()` ids, PII fields under `/api/public/*`). | 0.5–1 ew that de-noises every later verification step and stops the fork inheriting the erosion |
| 5 | **New stage — Public Surface & PII Sweep** (F9), between B and F. Enumerate every retained read path (routes, materialized views, nav data, email templates, Sentry/error reporting, analytics, sitemap/preview) and prove athlete/guardian data cannot reach it. | The current checklist covers DTO projections only; the MV, directory default, nav data, email, and error reporting are outside its reach |
| 6 | **Move the P0 test harness into Stage B/C** (F10), not F. Decide the frontend verification story once (server-render assertions only vs. introducing jsdom). | "Release-blocking P0 tests" must not be built after the features they guard |
| 7 | **Recreate rather than rename the order/payment models** (F7): define `nil_deals` / `nil_deal_milestones` / `nil_payments` fresh, delete the commerce models, and reuse the *services*. | On a fresh DB the rename buys nothing and drags Stripe/refund/tax/shipment entanglement along |
| 8 | **Path-audit all six docs** (F4): replace every stale reference with a verified path (`providers/base/`, `seed-*-capabilities.ts` + `seed-tiers.ts`, real resolver names). | The wrong paths are in the DoD path for every capability task |
| 9 | **Reconcile the five internal contradictions** (F6), especially (d): are `nil_guardian` and `nil_fan_network` capability-gated or platform-default? | Determines whether 2 of 11 capabilities have resolvers at all |
| 10 | **Add a second DROP pass for semantically-commerce KEEP items** (catalog, promotions, social commerce, quick-start, recommendations). | The KEEP list is "reuse as-is" but several entries are commerce-shaped and will re-import coupling the strip just removed |
| 11 | **Enumerate DB objects from the live database, not `schema.prisma`.** `prisma db push` scripts coexist with 28 migrations. | Out-of-band triggers/policies/views would be silently lost in the fork |
| 12 | **Replace the §5 day estimates** (F11) and add estimates for Phases 1–3, which have none. | The only published figure covers a third of the scope and is ~an order of magnitude low |

---

## 7. Risk Register

Ordered by expected impact. Severity × likelihood, with the mitigation that actually reduces it.

| # | Risk | Sev | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | **RLS assumed present, is absent** → the Phase-2 minor-privacy guarantee is weaker than documented, and isolation tests pass vacuously | **Critical** | **Certain (verified)** | F1 decision + doc amendment; repository-level tenant guard as the Phase-2 enforcement; RLS scheduled honestly in Stage H |
| R2 | **Deletion-and-repair tax exceeds estimate** → extraction overruns; schedule pressure lands on Stage F safety work | **High** | **High** | §5.6 spike to measure it; batch deletion with `checkapi`/`checkweb` per batch; protect Stage F explicitly in the plan |
| R3 | **Minor data reaches a public surface via a non-route path** (materialized view, directory default, nav data, email, Sentry, audit log) | **Critical** | Medium | New Public Surface & PII Sweep stage; `directory_visible=false` for athlete-tenants; per-surface enumeration, not a DTO test alone |
| R4 | **`tenant_type` / athlete-tenant tier semantics left ambiguous** → capability gating and limits behave incoherently for athlete-tenants | High | High | Blocking decision (§8); `platform_default` tier row; explicit resolver-scoping rules per actor type |
| R5 | **Spec's own instructions are internally contradictory** → junior agent implements the wrong variant of a safety control | High | High | §6 item 9 reconciliation pass; single authoritative doc; delete superseded sections rather than leaving both |
| R6 | **Consent revocation cascade is partial** → stale minor data remains publicly cached | **Critical** | Medium | `cross-context-cache-invalidation.md` + enumerate-all-namespaces rule; cascade test as a P0 gate (already specified — keep it blocking) |
| R7 | **Erasure vs. immutable audit trail never reconciled** → a minor's data cannot actually be erased, or the audit trail is falsifiable | High | Medium-High | §8 decision 7; design the audit row to carry pseudonymous references rather than PII |
| R8 | **State NIL law changes mid-build** | High | High (inherent) | Already mitigated well: `nil_eligibility_rules_list` is data-driven. Keep it that way — no bylaw logic in code |
| R9 | **Frontend verification story is unspecified and untestable as written** → UX guardrails silently skipped | Medium | High | §6 item 6; decide jsdom vs. server-render-only once |
| R10 | **Bot/RAG leaks non-consented athlete data** | **Critical** | Medium | Guardrails at the RAG *retrieval filter*, not just the prompt (the spec gets this right); `is_minor_safe` default true; seed + test in Stage G |
| R11 | **Supabase pooler transaction mode breaks the chosen tenant-context mechanism** | Medium | Medium | Decide and spike the GUC propagation in Stage B before any RLS work is scheduled |
| R12 | **Fork inherits dead weight** (509 backups, duplicate models, three singleton chains) → noisy gates, duplicate-model confusion, incomplete PII sweep | Medium | **Certain (verified)** | Stage B.0 hygiene pass |
| R13 | **No data migration needed** is assumed; if any pilot data exists, the estimate is void | Medium | Low | Confirm the new Supabase project is genuinely empty before Stage B |

---

## 8. Decisions Required Before Kickoff

Each blocks a stage. Numbers in brackets are the §4 finding that motivates it.

| # | Decision | Blocks | Recommendation |
|---|---|---|---|
| 1 | **Is RLS the Phase-2 isolation guarantee, or Phase-4 hardening?** [F1] | Stage B | Phase-4 hardening. Phase 2 = explicit `WHERE tenant_id` + a repository-level tenant guard + the consent/DTO layer. Do not promise a control that does not exist |
| 2 | **Athlete-tenants: widen `tenants` or use a side table? What `subscription_tier` do they carry?** [F2] | Stage B | Add `tenant_type` + a `nil_tenant_profile` side table; seed a `platform_default` tier; force `directory_visible=false` for `tenant_type='athlete'` |
| 3 | **Which base-singleton chain is canonical, and are `V2`/`Stable` deleted?** [F5] | Stage D | Pick one chain, delete the others from the fork, enforce the "extend a NIL base" rule in CI |
| 4 | **Rename `orders`/`order_items`/`payments`, or create `nil_deals`/`nil_deal_milestones`/`nil_payments` fresh?** [F7] | Stage B | Create fresh; delete the commerce models; reuse the services |
| 5 | **Can an athlete-tenant ever appear in tenant-directory / discovery / storefront-discovery surfaces?** [F2, F9] | Stage B | No. Explicit exclusion rule + `directory_visible=false` default + a test |
| 6 | **Are `nil_guardian` and `nil_fan_network` capability-gated or platform-default?** [F6d] | Stage G | Platform-default, per §12.9. Then remove them from the capability registry *and* delete the `useNilGuardianCapability` / `useNilFanNetworkCapability` hooks from `FRONTEND_SPEC.md` §13a.11 |
| 7 | **How does right-to-erasure coexist with an append-only audit trail?** [F9] | Stage B (schema) | Audit rows carry pseudonymous references, never PII. Resolve before the schema is frozen |
| 8 | **Test strategy: harness choice, CI gates, and jsdom-or-not for web?** [F3, F10] | Stage B/C | vitest everywhere; CI gates for typecheck + the three grep gates; decide the web DOM question once, deliberately |
| 9 | **Fee parameters** (platform %, guardian split, non-profit slice, payer-keyed tier matrix) [§12.10] | Stage G only | Can safely defer; do **not** let it block Phase 1–2 (the plan's original framing was right — this is parameter tuning, not an architectural blocker) |
| 10 | **Legal sign-off on the COPPA/FERPA/state-NIL/erasure design** [B.1.3] | Stage B (**hard gate**) | External dependency — start it immediately; it has the longest lead time and blocks the schema |

---

## 9. Verification Log

Every load-bearing claim in §4 traces to a command in this section.

### 9.1 Repo metrics

```
$ ls apps/web/src/services | wc -l                        303
$ ls apps/api/src/routes | wc -l                          542
$ ls apps/api/src/services | wc -l                        361
$ grep -c "^model " apps/api/prisma/schema.prisma         343
$ wc -l apps/api/prisma/schema.prisma                     8413
$ ls apps/api/prisma/migrations | wc -l                   28
$ ls apps/api/src/services/resolvers | wc -l              44
$ ls apps/api/src/routes | grep -c options-settings       24
$ grep -c "model .*options_settings" schema.prisma        11
$ git ls-files apps/web/src/app | grep -c page.tsx        436
$ git ls-files "apps/api"  (ts) LOC                        87,884
$ git ls-files "apps/web"  (ts|tsx) LOC                    168,776
$ git ls-files | grep -cE "\.(bak|backup)$"               509
$ git ls-files "apps/api" | grep -cE "\.(test|spec)\.ts$" 204
$ git ls-files "apps/web" | grep -cE "\.test\.ts$"         30
$ ls packages/                                            shared          (no feature-definitions)
```

### 9.2 RLS (finding F1)

```
$ grep -rh "CREATE POLICY" apps/api/prisma/migrations | wc -l
3
$ grep -rl "ROW LEVEL SECURITY" apps/api/prisma/migrations
apps/api/prisma/migrations/003_create_product_queue.sql.backup
apps/api/prisma/migrations/create_storefront_options.sql
$ grep -rlE "current_setting|app\.current_tenant|set_config" apps/api/src
apps/api/src/routes/queue-routes.ts.bak
apps/api/src/routes/queue-routes.ts
apps/api/src/lib/services/ProductQueueService.ts.bak
apps/api/src/lib/services/ProductQueueService.ts
apps/api/src/app/api/queue/[tenantId]/route.ts.backup
$ grep -nE "current_setting|set_config|RLS" apps/api/src/lib/prisma-flexible.ts
(no matches)
```

`apps/api/src/routes/queue-routes.ts:38-39` — the only live occurrence:

```ts
    // Set tenant context for RLS
    // process.env.POSTGRES_OPTIONS = `-c app.current_tenant_id=${tenantId}`;
```

Commented out, wrong setting name vs. the spec's policies, and in a commerce file on the DROP list.

### 9.3 `tenant_type` (finding F2)

```
$ grep -n "tenant_type" apps/api/prisma/schema.prisma
922:  @@index([tenant_id, activity_type], map: "idx_crm_activities_tenant_type")
942:  @@index([tenant_id, type], map: "idx_crm_alerts_tenant_type")
2154: @@index([tenant_id, override_type, status], map: "idx_feature_overrides_tenant_type_status")
2235: @@index([tenant_id, featured_type], map: "idx_featured_tenant_type")
```

All four are unrelated index names. No `tenant_type` column exists. `tenants` head inspected directly (see F2 for the commerce-coupled column list).

### 9.4 Build masking + typecheck baseline (finding F3)

```
$ cat apps/api/build-with-selective-errors.js
  SAFE_ERROR_PATTERNS: "Property 'x' does not exist on type 'y'" ...
  CRITICAL_ERROR_PATTERNS: syntax errors, Cannot find module, call signatures
  // unknown errors: "Proceeding with unknown errors" -> process.exit(0)

$ pnpm checkapi
$ node scripts/tsc-check.js --noEmit --project apps/api
(exit 0, no error output — clean)

$ pnpm checkweb
$ node scripts/tsc-check.js --noEmit --project apps/web
(exit 0, no error output — clean)
```

### 9.5 Missing spec paths (finding F4)

```
$ ls packages/
shared
$ find apps -name "canonical-features.ts" -o -name "tier-hierarchies.ts"
(no results)
$ grep -rnE "tier_features_list|canonicalFeatures|canonical-features|tierHierarchies|tier-hierarchies"
(no matches outside schema.prisma's model definition)
$ git ls-files | grep -iE "seed.*(feature|tier|capab)"
apps/api/prisma/seed-barcode-capabilities.ts
apps/api/prisma/seed-chatbot-capabilities.ts
apps/api/prisma/seed-crm-capabilities.ts
apps/api/prisma/seed-faq-capabilities.ts
apps/api/prisma/seed-organization-chain-tiers.ts
apps/api/prisma/seed-product-layout-capabilities.ts
apps/api/prisma/seed-product-types-capabilities.ts
apps/api/prisma/seed-storefront-layout-capabilities.ts
apps/api/prisma/seed-tiers.ts
$ ls apps/web/src/providers/base/
(21 entries — the real base-singleton directory; not apps/web/src/services/base/)
```

### 9.6 Base-singleton fragmentation (finding F5)

```
$ grep -rn "class FlexibleApiSingleton|class EnhancedFlexibleApiSingleton|class FlexibleApiSingletonV2|class FlexibleApiSingletonStable|class PublicApiSingletonStable" apps/web/src/providers/base/*.ts
EnhancedFlexibleApiSingleton.ts:201  extends UniversalSingleton
FlexibleApiSingleton.ts:79            extends EnhancedFlexibleApiSingleton
FlexibleApiSingletonStable.ts:41      extends UniversalSingleton          <-- bypasses Enhanced
FlexibleApiSingletonV2.ts:40          extends UniversalSingleton          <-- bypasses Enhanced
PublicApiSingletonStable.ts:10        extends FlexibleApiSingletonStable
$ grep -rl "FlexibleApiSingleton" apps/web/src | wc -l          114
$ grep -rl "extends FlexibleApiSingleton" apps/web/src/services | wc -l   8
$ grep -rl "FlexibleApiSingletonV2|EnhancedFlexibleApiSingleton" apps/web/src/services | wc -l   6
$ grep -rl "UniversalSingleton" apps/api/src/services | wc -l   55
```

### 9.7 Retained base services (confirming the reuse thesis)

```
apps/api/src/services/BaseService.ts:11                    export abstract class BaseService
apps/api/src/services/permissions/PermissionEnhancedBaseService.ts:41   export abstract class PermissionEnhancedBaseService
apps/api/src/services/EffectiveCapabilityResolver.ts       (present)
apps/api/src/lib/id-generator.ts + ID_GENERATOR_PATTERN.md (present)
$ grep "^model (features_list|capability_features_list|tier_features_list|capability_type_list|subscription_tiers_list|tenants)"
schema.prisma:608   capability_features_list
schema.prisma:626   capability_type_list
schema.prisma:2268  features_list
schema.prisma:6107  subscription_tiers_list
schema.prisma:7460  tier_features_list
schema.prisma:7152  tenants
```

### 9.8 Spec-internal counts (finding F12)

```
$ grep -c "CREATE TABLE" TECHNICAL_SPEC.md     23
$ grep -c "CREATE POLICY" TECHNICAL_SPEC.md     2      <-- for ~24 athlete-owned tables
$ awk '/^### 2.2 DROP/,/^### 2.3/' MIGRATION_DESIGN.md | grep -c "^| \*\*"    30 DROP groups
$ awk '/^### 2.1 KEEP/,/^### 2.2/' MIGRATION_DESIGN.md | grep -c "^| \*\*"    28 KEEP rows
$ awk '/^### 6.1 API Files/,/^### 6.2/' MIGRATION_DESIGN.md | grep -cE "^- "  92 KEEP API files
```

### 9.9 Spec self-reported estimates (finding F11)

`MIGRATION_DESIGN.md` §5: M0 1–2 d · M1 2–3 d · M2 3–5 d · M3 3–5 d · M4 2–3 d → **11–18 working days**.
`IMPLEMENTATION_PLAN.md` and `PROJECT_SEQUENCE.md`: **no effort figures for Phases 1–4.**

---

## 10. Summary

| Question | Answer |
|---|---|
| Is the replication approach right? | **Yes.** The commerce ⇄ NIL capability equivalency is real, verified, and the athlete-as-tenant model is the correct isolation root |
| Is the spec's §12 gap analysis sound? | **Yes — it is the strongest part of the set.** COPPA/FERPA/state-NIL, anti-predator controls, versioned consent, and media moderation are correctly P0 and correctly pulled into Phase 2 |
| Is the plan executable as written? | **No.** One false architectural premise (RLS — F1), two blocking undecided schema questions (F2), one unpinned architectural choice (F5), five internal contradictions (F6), and stale file paths in the DoD path (F4) |
| Are the effort estimates usable? | **No.** The only published figure covers a third of the agreed scope and is ~7–10× low (F11) |
| Estimated effort, Stages A–G, full-stack | **36–67 ew; likely ~48 ew.** Backend-only slice ~24–45 ew (the backend is ~⅔ of the cost). See §5 |
| What unblocks a reliable estimate? | The **3–5 day extraction spike** (§5.6), plus the **10 blocking decisions** (§8) |
| Biggest single risk | **R1/F1** — the minor-privacy guarantee the whole design rests on is not implemented in the source platform. Resolve it before Stage B; do not carry the false premise into the fork |
| Recommended first move | Fix the RLS premise + run the spike + get legal review started. Legal has the longest lead time and blocks the schema freeze |

**The architecture is worth building. The plan needs re-baselining before the first file is deleted — and the RLS finding in particular must be corrected in the specs themselves, because a junior agent following `MIGRATION_DESIGN.md` §3.4 literally will write row-level security policies against a session variable that nothing in the codebase sets.**
