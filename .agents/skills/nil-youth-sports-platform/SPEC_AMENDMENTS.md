# NIL Youth Sports Platform — Spec Amendments

**Document version:** 1.0
**Date:** 2026-09-30
**Purpose:** The exact patch list that makes the existing spec set internally consistent and factually correct against the source repository, so `EXECUTION_PLAN.md` can be executed without ambiguity.
**Companion:** `EXECUTION_PLAN.md` (authoritative build order), `SPINOFF_MVP_ANALYSIS.md` (findings F1–F12)

> ## ✅ APPLIED — 2026-09-30
>
> All **35 amendments** have been applied to the five source documents, with **39 in-place amendment markers** left behind so the original reasoning and the correction are both visible. This document is now the **change log and verification record** for that reconciliation — see **§7** for the application record and re-verification procedure.
>
> The spec set is now internally consistent. Anyone reading `TECHNICAL_SPEC.md`, `MIGRATION_DESIGN.md`, `PROJECT_SEQUENCE.md`, `IMPLEMENTATION_PLAN.md`, or `FRONTEND_SPEC.md` will hit a `> **Amended 2026-09-30**` note wherever the original text was wrong or self-contradictory.

---

## 0. How to Apply This

### 0.1 Application rule

Each amendment below is a **patch to a specific location** in one of the five source documents. Apply them in document order. Two rules govern conflicts:

1. `EXECUTION_PLAN.md` wins over any source document.
2. Where `EXECUTION_PLAN.md` is silent, **this document wins over the original spec text**.

Do not apply a patch by deleting the original text silently. Replace it and add a one-line `> **Amended 2026-09-30 (EXECUTION_PLAN §X):**` note so the change history survives — the source docs are also the record of how the architecture was reasoned about, and that reasoning is worth keeping visible.

### 0.2 Two amendment classes

| Class | Meaning | Consequence if skipped |
|---|---|---|
| **[CORRECT]** | The source text states something **factually false** about the repository | A junior agent implements against a mechanism that does not exist. Highest risk — this is how F1 becomes a shipped defect |
| **[RESOLVE]** | The source text **contradicts another source document** | The implementer picks one at random. Medium risk, high frequency |

### 0.3 What is *not* being amended

Worth stating, because the amendment count could otherwise read as a rejection of the spec set:

- **`TECHNICAL_SPEC.md` §12 (gap analysis) needs no amendments.** It is the strongest part of the set and its P0 resolutions are adopted verbatim by `EXECUTION_PLAN.md` §7.2.
- **The §7.1 commerce ⇄ NIL capability equivalency map needs no amendments.** Independently verified as real.
- **The `IMPLEMENTATION_PLAN.md` §0.1 skill index needs no amendments.** All 20+ referenced playbooks in `.devin/skills/` were verified to exist (see §0.4). This is a genuine asset: the spinoff should copy `.devin/skills/` wholesale into the new repo, because the playbooks encode the platform patterns the plan depends on.
- **The phased roadmap (§4 of both the functional and technical specs) needs no amendments.** The four-phase structure is sound; only the *effort* figures and the *sequencing* change (per `EXECUTION_PLAN.md` §6 and the hybrid order).

### 0.4 Verification note — the skill index is valid

```
$ ls .devin/skills/*.md | wc -l   → 80 playbooks (+2 skill directories = 82 entries)
$ for s in deploy-service-extending-base-singleton tenant-scoped-id-generation \
    add-capability-feature capability-deployment-flow capability-data-flow-rules \
    verify-capability-deployment cross-context-cache-invalidation \
    troubleshooting-public-page-api-leaks server-resolved-context-delegator; do ...
deploy-service-extending-base-singleton      FOUND
tenant-scoped-id-generation                  FOUND
add-capability-feature                       FOUND
capability-deployment-flow                   FOUND
capability-data-flow-rules                   FOUND
verify-capability-deployment                 FOUND
cross-context-cache-invalidation             FOUND
troubleshooting-public-page-api-leaks        FOUND
server-resolved-context-delegator            FOUND
```

Every playbook named in `IMPLEMENTATION_PLAN.md` §0.1 exists. Two additional playbooks are directly relevant to Stage 2 and should be added to the plan's index:

| Playbook | Relevant to |
|---|---|
| `.devin/skills/manual-sql-migration-policy.md` | S2.5 (materialized view), S2.6 (trigger), S2.8 (RLS policies if built) — all are manual SQL, not Prisma-native |
| `.devin/skills/capability-resolution-mv.md` | S3.5 (`EffectiveCapabilityResolver` rewiring), S2.5 (MV) |

---

## 1. `TECHNICAL_SPEC.md`

### TS-1 — §0 mapping table: the RLS row **[CORRECT]**

**Location:** §0 "How This Spec Maps to the Existing Platform", table row:

> `| RLS isolation per athlete (§4 P4) | Postgres RLS + explicit WHERE tenant_id = $1 keyed to the athlete-tenant + tenant-scoped IDs | tenant-scoped-id-generation.md §8 |`

**Problem:** The source platform has **no RLS** (F1). There are 3 `CREATE POLICY` statements in the entire migration history, in 2 files (one a `.sql.backup`), against 343 Prisma models.

**Replace the cell with:**

> `| Per-athlete isolation (§4 P4) | Explicit WHERE tenant_id = $1 keyed to the athlete-tenant, enforced by a repository-level tenant guard; tenant-scoped IDs. Postgres RLS is Phase 4 hardening, not a Phase 2 control | tenant-scoped-id-generation.md §8; EXECUTION_PLAN §1 D1, §4 S4.1 |`

**Also amend the §0 sentence** that reads "This gives the strongest minor-privacy guarantee" to:

> "This gives the strongest minor-privacy guarantee available at this phase: per-athlete query scoping enforced by a repository guard, plus per-athlete cache namespacing and capability gating. Row-level security is scheduled as Phase-4 defense-in-depth (see §3.2 and EXECUTION_PLAN §1 D1)."

---

### TS-2 — §3.2 Enforcement Layers: the RLS layer **[CORRECT]**

**Location:** §3.2 "Enforcement Layers (defense in depth)", item 2:

> "2. **RLS policy:** Postgres row-level security on all athlete-owned tables, enforced via `WHERE tenant_id = $1` keyed to the **athlete-tenant**, so one athlete's data can never leak into another's even on a query bug. Cross-tenant relationship rows (memberships, deals) are the *only* rows visible to a second tenant, and only to the explicitly-related one (§12.4)."

**Problems:** (a) the platform has no RLS; (b) the sentence conflates RLS with `WHERE tenant_id = $1` — those are different controls with different failure modes; (c) the claim "never leak even on a query bug" is only true of RLS, and RLS is absent.

**Replace with:**

> "2. **Repository tenant guard (Phase 2):** a Prisma middleware/wrapper that rejects any query against an athlete-owned table that carries no tenant predicate. This is the Phase-2 substitute for RLS: it catches the same class of bug (a query that forgets its tenant scope) at the data-access layer rather than in the database. Cross-tenant relationship rows (memberships, deals) are the *only* rows visible to a second tenant, and only to the explicitly-related one (§12.4).
>
> 3. **RLS policy (Phase 4 hardening):** Postgres row-level security on all athlete-owned tables, keyed to the athlete-tenant, as an independent second layer. **This does not exist in the source platform and must be built** — see §14.10 and `EXECUTION_PLAN.md` §1 D1. Until it is built, do not describe the platform as having database-enforced isolation."

Then renumber the existing item 3 (consent guard) to 4.

---

### TS-3 — §3.3 Cache eviction **[RESOLVE]**

**Location:** §3.3 "Cache Eviction on State Change".

**Keep the text**, but append:

> "> **Amended:** eviction completeness is a **release-blocking** P0 test, not a best-effort behavior. A partial eviction leaves stale minor data publicly served — see `EXECUTION_PLAN.md` §7.2 (P0 test 3) and §4 S4.4. The enumerated namespace list is a contract with a test, not a comment."

---

### TS-4 — §7 step 1: the capability definition path **[CORRECT]**

**Location:** §7, item 1:

> "1. **Define:** feature key(s) in `canonical-features.ts` + tier assignment in `tier-hierarchies.ts` (`snake_case`, domain-prefixed e.g. `nil_roster_export`)."

**Problem:** Neither file exists. `packages/` contains only `shared`. No `canonical-features` or `tier-hierarchies` file exists anywhere in the tree (F4).

**Replace with:**

> "1. **Define:** feature key(s) + tier assignment in the seed scripts — `apps/api/prisma/seed-*-capabilities.ts` (one per capability, mirroring `seed-{barcode,chatbot,crm,faq,product-layout,product-types,storefront-layout}-capabilities.ts`) and `apps/api/prisma/seed-tiers.ts` for tier assignment. Keys are `snake_case`, domain-prefixed (e.g. `nil_roster_export`). For NIL, add a single `seed-nil-capabilities.ts` orchestrator rather than nine parallel scripts."

---

### TS-5 — §7 capability table: two capabilities are not capability-gated **[RESOLVE]**

**Location:** §7 table, rows `nil_guardian` and `nil_fan_network`.

**Problem:** §7 registers them as capabilities with merchant-pref tables and tier gating. §12.9 states they "are NOT capability-gated; they are governed by consent + role only" and "resolve from a **platform default**, not from `tier_features_list`" (F6d).

**§12.9 is correct** — never paywall the trust/safety and engagement layer. Amend the §7 table:

| Capability Key | Change |
|---|---|
| `nil_guardian` | **Remove the tier gate.** Mark as `platform-default (always-on)`. Remove `tenant_nil_guardian_options_settings` — there are no merchant prefs for a non-gated feature |
| `nil_fan_network` | **Remove the tier gate.** Mark as `platform-default (always-on)`. Remove `tenant_nil_fan_options_settings` |

**Resulting registry: 9 tier/merchant-gated capabilities + 2 platform-default features.** This changes §7's "11 NIL capabilities" to "9 gated capabilities + 2 platform-default features" everywhere it appears, including `FRONTEND_SPEC.md` §13a.1 (see FS-1, FS-2).

**Also amend §12.9** to state the implementation consequence explicitly, so the resolution is not just policy:

> "> **Amended — implementation:** because guardian and fan features are not gated, they must not be routed through the capability resolver at all. They are authorized by **role + consent** at the route layer. Do not create resolvers, options-settings tables, or tier rows for them."

---

### TS-6 — §10 item 8: RLS phase alignment **[RESOLVE]**

**Location:** §10 "Functional Verification Checklist", item:

> "- [ ] **RLS (Phase 4):** Cross-tenant query returns zero rows under RLS even without explicit `tenant_id` filter. *(DB policy test.)*"

**Problem:** §3.2 claims RLS enforces Phase 2; §10 schedules it in Phase 4 (F6a). Both cannot be true.

**Replace with:**

> "- [ ] **Tenant guard (Phase 2):** a query against an athlete-owned table with **no** tenant predicate is **rejected at runtime**, not silently widened. *(Integration test.)*
> - [ ] **RLS (Phase 4):** cross-tenant query returns zero rows under RLS even without an explicit `tenant_id` filter. *(DB policy test.)* **Note:** the test must be **non-vacuous** — it must first prove that rows *are* visible when the correct tenant is set. A policy that returns zero rows in all cases passes the naive test and provides no isolation."

---

### TS-7 — §11 Key File Reference **[CORRECT]**

**Location:** §11, row:

> `| Feature defs | packages/feature-definitions/src/definitions/{canonical-features,tier-hierarchies}.ts |`

**Replace with:**

> `| Feature defs | apps/api/prisma/seed-nil-capabilities.ts + apps/api/prisma/seed-tiers.ts |`

Also verify every other row in §11 against the tree before this section is used as a task input. The `apps/api/src/lib/id-generator.ts`, `apps/api/src/services/resolvers/`, `apps/api/src/services/EffectiveCapabilityResolver.ts`, `apps/api/src/routes/nil-*-options-settings.ts`, `apps/api/src/routes/public/nil-*.ts`, `apps/web/src/services/`, `apps/web/src/services/UnifiedCapabilityService.ts`, `apps/web/src/proxy.ts` rows were verified present. Add a **new row**:

> `| Web base singletons | apps/web/src/providers/base/ (NOT apps/web/src/services/base/) |`

---

### TS-8 — §14.10 RLS note: the dead-code reference **[CORRECT — highest priority]**

**Location:** §14.10, the note beginning "**Note for the junior agent:** match `current_setting('app.current_tenant', ...)` to however the existing codebase sets the RLS tenant GUC (grep for `set_config`/`app.current_tenant` — see `ProductQueueService.ts` / `queue-routes.ts`). **Do not invent a new mechanism.**"

**Problem — this is the single most dangerous sentence in the spec set (F1):**

1. The mechanism does not exist. The only occurrence is **commented out**:
   ```ts
   // apps/api/src/routes/queue-routes.ts:38-39
       // Set tenant context for RLS
       // process.env.POSTGRES_OPTIONS = `-c app.current_tenant_id=${tenantId}`;
   ```
2. It uses a **different setting name** (`app.current_tenant_id`) than the policies in §14.10 expect (`app.current_tenant`), so even if uncommented it would not satisfy them.
3. Both referenced files are on the spec's own DROP list.
4. "Do not invent a new mechanism" instructs the implementer to copy something that does not work — and to do so *instead of* designing one that does.

**Replace the entire note with:**

> "> **Note — RLS status in the source platform (amended 2026-09-30):** there is **no working RLS tenant-context mechanism** in the source platform. The repository contains 3 `CREATE POLICY` statements across 2 migration files (one a `.sql.backup`) against 343 Prisma models, and the only `set_config` reference in application code is commented out in `queue-routes.ts` (a commerce file scheduled for deletion). **There is nothing to copy.**
> >
> > The Phase-2 isolation control is therefore the **repository-level tenant guard** (`EXECUTION_PLAN.md` §4 S4.1), not RLS. If RLS is later built as Phase-4 hardening, the GUC mechanism must be **designed, not inherited** — and it must solve the Supabase pooler problem: the pooler defaults to transaction mode, which does not preserve a session-level `set_config` across pooled queries. Budget that work explicitly (≈3–6 ew for ~24 tables plus the pooling workaround) rather than treating it as a schema detail.
> >
> > **Non-vacuous test requirement:** an RLS isolation test that passes because *no* rows are visible proves nothing. Every isolation test must first demonstrate that rows **are** visible with the correct tenant set."

---

### TS-9 — §14.11 / §14.12: "already uses RLS" **[CORRECT]**

**Location:** §14.11, sentence "The existing CRM tables … already use `tenant_id VARCHAR(255)`, explicit `VARCHAR` ids, and RLS."

**Replace `and RLS` with `and explicit tenant scoping`.** Same correction in §14.12: "The existing bot stack … is already tenant-scoped (`tenant_id VARCHAR(255)`) with RLS" → "is already tenant-scoped (`tenant_id VARCHAR(255)`) with explicit `tenant_id` filtering."

**Everything else in §14.11 and §14.12 stands** — the tables, the delta columns, the guardian-required trigger, and the options tables were all verified as accurate.

---

### TS-10 — §13: pin the canonical base-singleton chain **[CORRECT + RESOLVE]**

**Location:** §13.1 hierarchy diagram.

**Problem:** The source repo contains **three coexisting chains** (F5):

```
UniversalSingleton
├── EnhancedFlexibleApiSingleton
│   └── FlexibleApiSingleton          ← §13 targets this
│       ├── PublicApiSingleton
│       ├── TenantApiSingleton
│       ├── CustomerApiSingleton
│       ├── AdminApiSingleton
│       └── AuthenticatedApiSingleton
├── FlexibleApiSingletonV2            ← bypasses Enhanced
└── FlexibleApiSingletonStable        ← bypasses Enhanced
    └── PublicApiSingletonStable
```

114 files reference `FlexibleApiSingleton` in some form; 8 services extend it directly; 6 use the V2/Enhanced variants. Alignment documents (`COMMON_ALIGNMENT_STRATEGY.md`, `MIGRATION_PLAN.md`, `FINAL_ALIGNMENT_REPORT.ts`) indicate the source team already knows the layer is fragmented.

**Add above the §13.1 diagram:**

> "> **Amended 2026-09-30 — canonical chain:** the hierarchy below is canonical. `FlexibleApiSingletonV2`, `FlexibleApiSingletonStable`, and `PublicApiSingletonStable` are **abandoned variants and are deleted from the fork** (`EXECUTION_PLAN.md` §0 S0.4, §1 D3). Do not extend them, do not port them, do not treat them as an alternative. A CI check enforces that concrete NIL services extend a NIL base and never `UniversalSingleton` directly — the source repo demonstrates that this rule does not hold by convention alone."

---

### TS-11 — §12.12: test rigor **[RESOLVE]**

**Location:** §12.12 P0 acceptance criteria.

**Append to the section:**

> "> **Amended — test rigor:** every negative-path test must be **non-vacuous** (it must fail if the control is removed) and must run against a **harness built before the feature it guards** (`EXECUTION_PLAN.md` §4 S4.7). A test asserting 'zero rows returned' passes trivially when the query is broken; assert the *specific* rejection or the *specific* absence, with a positive control in the same test."

---

### TS-12 — §12.1 / §12.11: erasure vs. immutable audit **[RESOLVE]**

**Location:** §12.1 "Right to erasure" and §12.11 "Audit trail everywhere".

**Problem:** §12.1 requires full deletion of a minor's data; §12.11 requires an append-only audit log. An audit row containing a minor's DOB is a permanent retention problem that erasure cannot satisfy. The spec never reconciles them (F9, R7).

**Add to both sections:**

> "> **Amended — reconciliation:** audit rows carry **pseudonymous references only** — never PII. Erasure rewrites the reference, not the log: the audit trail remains complete and tamper-evident, while no personal data survives in it. This is a **schema-time** decision (`EXECUTION_PLAN.md` §2 S2.7, §1 D7); retrofitting it is a data migration."

---

### TS-13 — §14.12 bot IDs vs. the Definition of Done **[RESOLVE]**

**Location:** §14.12, "(Note: existing bot ids are `@db.Uuid` with `gen_random_uuid()` — keep that convention for bot tables; do not switch to VARCHAR here.)"

**Problem:** The plan's Definition of Done bans `randomUUID`/`Date.now()` IDs and the CI grep gate will fail on compliant bot code (F6c).

**Keep the convention, and add the exception explicitly:**

> "> **Amended — DoD exception:** `bot_*` tables retain `@db.Uuid` + `gen_random_uuid()`. This is an **explicit, documented exception** to the 'no generated IDs' rule. The CI grep gate must whitelist the bot service and bot route directories, or it fails on compliant code. See `EXECUTION_PLAN.md` §2.3."

---

### TS-14 — §14.10: RLS coverage **[CORRECT]**

**Location:** §14.10, which presents policies for 2 tables while §14.10's own preamble says "Apply to every athlete-owned table (profile, media, metrics, achievements, consent, escrow, moderation, threads, fan, erasure)" — i.e. ~24 tables.

**Add:**

> "> **Amended — coverage:** the two policies shown are illustrative, not complete. A Phase-4 RLS implementation covers **all** athlete-owned tables (~24) plus dual-visibility policies on the cross-tenant tables (`sponsorship_deals_list`, `athlete_tenant_memberships_list`). Count them from §14 directly before estimating: §14 contains 23 `CREATE TABLE` statements, and the plan's own model list undercounts them (F12)."

---

## 2. `MIGRATION_DESIGN.md`

### MD-1 — §0 Executive Summary: RLS claim **[CORRECT]**

**Location:** §0:

> "The existing `retail-visibility-platform` is a mature multi-tenant commerce platform with battle-tested infrastructure: Auth0 authentication, Prisma + PostgreSQL, a two-tier singleton hierarchy (cached public / 0-TTL private), a capability-gating system with tier/merchant resolvers, **RLS-enforced tenant isolation**, CRM, RAG chatbot, and a Next.js 16 frontend."

**Replace `RLS-enforced tenant isolation` with `explicit-tenant-scoped query isolation`.**

**Add to the same paragraph:**

> "> **Amended 2026-09-30:** the platform does **not** have RLS. Tenant isolation today is application-level (`WHERE tenant_id = $1` per query). This materially affects the extraction plan — see §3.4 and `EXECUTION_PLAN.md` §1 D1."

---

### MD-2 — §2.1 KEEP list: the singleton hierarchy row **[RESOLVE]**

**Location:** §2.1, row:

> `| **Singleton hierarchy (web)** | FlexibleApiSingleton, PublicApiSingleton, TenantApiSingleton, CustomerApiSingleton, AuthenticatedApiSingleton, AdminApiSingleton | Keep as-is; add NIL bases on top (§4.1) |`

**Problem:** "Keep as-is" is ambiguous against three coexisting chains (F5).

**Replace the Action cell with:**

> "Keep the canonical chain (`UniversalSingleton → EnhancedFlexibleApiSingleton → FlexibleApiSingleton → {Public, Tenant, Customer, Admin, Authenticated}`); **delete** `FlexibleApiSingletonV2`, `FlexibleApiSingletonStable`, `PublicApiSingletonStable` and the alignment scaffolding (`BASE_CLASS_ALIGNMENT.ts`, `FINAL_ALIGNMENT_REPORT.ts`, `TARGET_SYSTEM_DEMO.ts`). Add NIL bases on top (§4.1). See `EXECUTION_PLAN.md` §1 D3."

---

### MD-3 — §3.2 rename map: orders / order_items / payments **[RESOLVE]**

**Location:** §3.2 rows:

> `| orders | nil_deals | Rename; repurpose columns (order → deal, buyer → sponsor, seller → athlete-tenant) |`
> `| order_items | nil_deal_milestones | Rename; repurpose for escrow milestones |`
> `| payments | nil_payments | Rename; repurpose for deal payouts (guardian payee) |`

**Problem:** An in-place rename drags Stripe subscription billing, refunds, tax/1099, deposit forfeiture, and shipment entanglement into the deal model — all of which are on the KEEP side. On a fresh database the rename buys nothing (F7).

**Replace with:**

> `| orders | (DROP) → define nil_deals fresh from TECHNICAL_SPEC §14.8 | Recreate, do not rename. Reuse the checkout/order *service* logic, not the model shape |`
> `| order_items | (DROP) → define nil_deal_milestones fresh | Milestones are escrow states, not line items — not a 1:1 rename |`
> `| payments | (DROP) → define nil_payments fresh | Reuse the payment-gateway abstraction; do not inherit order-payment columns |`

**Add a note under the table:**

> "> **Amended — rationale:** the target database is empty, so the only thing a rename saves is typing the model. What it costs is inherited columns, relations, and semantics across every retained Stripe/refund/tax service. Create new, delete old, and adapt at the **service** layer where the logic actually lives."

---

### MD-4 — §3.4 RLS Policy Migration: full rewrite **[CORRECT — highest priority]**

**Location:** §3.4 in its entirety:

> "The existing platform uses `current_setting('app.current_tenant', true)` for RLS. This mechanism carries over unchanged."

**This sentence is false and must be replaced.** It is the direct cause of F1.

**Replace the entire §3.4 opening paragraph with:**

> "### 3.4 Tenant Isolation Strategy (amended 2026-09-30)
>
> **Correction:** the source platform does **not** use `current_setting('app.current_tenant', true)` for RLS, and there is no such mechanism to carry over. Verified:
>
> ```
> $ grep -rh "CREATE POLICY" apps/api/prisma/migrations | wc -l   → 3
> $ grep -rl "ROW LEVEL SECURITY" apps/api/prisma/migrations      → 2 files
>     (one is 003_create_product_queue.sql.backup)
> $ grep -c "^model " apps/api/prisma/schema.prisma              → 343
> $ grep -rlE "current_setting|app\.current_tenant|set_config" apps/api/src
>     routes/queue-routes.ts          (occurrence is COMMENTED OUT)
>     routes/queue-routes.ts.bak
>     lib/services/ProductQueueService.ts
>     lib/services/ProductQueueService.ts.bak
>     app/api/queue/[tenantId]/route.ts.backup
> ```
>
> The only `set_config` line in the codebase is `// process.env.POSTGRES_OPTIONS = ...` in `queue-routes.ts:39` — commented out, using a **different setting name** (`app.current_tenant_id`) than the policies below expect (`app.current_tenant`), in a commerce file on the §2.2 DROP list.
>
> **Therefore:**
>
> | Control | Phase | Status |
> |---|---|---|
> | Explicit `WHERE tenant_id = $1` per query | Phase 2 | **Exists today** — application convention |
> | Repository-level tenant guard (rejects queries with no tenant predicate) | Phase 2 | **To be built** — `EXECUTION_PLAN.md` §4 S4.1 |
> | Postgres RLS + tenant GUC | Phase 4 | **To be built from scratch** — design required, not inherited |
>
> If RLS is implemented in Phase 4, two things must be designed rather than copied: (1) the GUC propagation mechanism, and (2) a workaround for Supabase's pooler, which defaults to **transaction mode** and does not preserve a session-level `set_config` across pooled queries. Budget ≈3–6 ew for ~24 tables plus the pooling work."
>
> The illustrative policy SQL that follows in the original §3.4 may be retained as a **Phase-4 reference sketch** — but it must be labelled as such, and the dual-visibility policy on `sponsorship_deals_list` remains a correct design for when RLS is built.

**Also add the non-vacuous test requirement:**

> "> **Test requirement:** an isolation test that passes because *no* rows are visible proves nothing. Every RLS test must first prove rows **are** visible with the correct tenant set."

---

### MD-5 — §3.5 Migration Execution Order **[RESOLVE]**

**Location:** §3.5, steps 2–3:

> "2. **Strip commerce models from `schema.prisma`** — remove all DROP models from §3.2
> 3. **Rename repurposed models** — apply renames from §3.2"

**Problem:** stripping models in the same pass as the code extraction produces one entangled cascade of type errors from both directions (F3, and `EXECUTION_PLAN.md` §2.2).

**Replace steps 2–3 and insert the ordering rule:**

> "2. **Add NIL models** (additive — breaks nothing). `prisma validate` green.
> 3. **Defer all model removal to the API extraction stage.** Commerce models are dropped only after `grep` proves no code references them (`EXECUTION_PLAN.md` §2.2, §3 S3.6).
>
> > **Ordering rule (amended):** never delete a Prisma model before the code that references it is gone. Add → delete code → drop models. Three ordered, independently-verifiable repairs instead of one entangled pass."

**Also amend step 11 ("Seed base data")** to name the real mechanism:

> "11. **Seed base data** — tiers (payer-keyed, incl. a `platform_default` row), NIL features/capabilities via `seed-nil-capabilities.ts`, `nil_eligibility_rules_list`, navigation links, bot guardrails"

**And add a new step 0:**

> "0. **Enumerate DB objects from the live database** — triggers, policies, views, materialized views, extensions. `schema.prisma` is not a complete record: `prisma db push` scripts coexist with 28 migrations, so out-of-band objects would be silently lost (`EXECUTION_PLAN.md` §0 S0.5)."

---

### MD-6 — §4.1 base singleton path **[CORRECT]**

**Location:** §4.1:

> "Add to `apps/web/src/services/base/`:"

**Replace with:**

> "Add to `apps/web/src/providers/base/`:"

Also add the three missing bases to the §4.1 table so it matches `TECHNICAL_SPEC.md` §13.2 (7 bases, not 7 rows — the table currently lists all 7 but omits the canonical-chain constraint). Append a note:

> "> All seven extend the **canonical** chain (`EXECUTION_PLAN.md` §1 D3). `FlexibleApiSingletonV2`/`Stable` are deleted in S0.4 and must not be used as parents."

---

### MD-7 — §4.2 ID generator table **[CORRECT]**

**Location:** §4.2 table, which lists 17 generators.

**Problem:** `TECHNICAL_SPEC.md` §6 and `PROJECT_SEQUENCE.md` §C.2.1 list **19** — the table omits `generateNilInvitationId()` (`nilinv-{nanoid}`) and `generateOnboardingSessionId()` (`onboard-{actorType}-{nanoid}`).

**Add both rows:**

| Generator | Prefix | Format |
|---|---|---|
| `generateNilInvitationId()` | `nilinv` | `nilinv-{nanoid}` |
| `generateOnboardingSessionId()` | `onboard` | `onboard-{actorType}-{nanoid}` |

And note: "19 generators total. Verify against `TECHNICAL_SPEC.md` §6 — that table is authoritative."

---

### MD-8 — §4.3 resolver mapping **[CORRECT]**

**Location:** §4.3 "Remove (commerce resolvers)" list.

**Problem:** the list names resolver files by capability key (`CommerceResolver.ts`, `CrmOptionsResolver.ts`, `ChatbotOptionsResolver.ts`) rather than by actual filename. The `resolvers/` directory contains 44 files (F4).

**Add above the list:**

> "> **Amended — verify before mapping:** enumerate `apps/api/src/services/resolvers/` (44 files) and map each to its keep/replace/drop decision by **actual filename**. The names in this list are capability keys, not verified filenames. Do not begin S3.4 until the mapping table is complete."

---

### MD-9 — §5 phased migration day estimates **[CORRECT]**

**Location:** §5 in its entirety — "Phase M0: 1–2 days … M1: 2–3 days … M2: 3–5 days … M3: 3–5 days … M4: 2–3 days" = **11–18 working days**.

**Problem:** ~7–10× low for the extraction, and covers only Stages A–D (F11).

**Replace the day figures with:**

> "> **Amended — effort (supersedes the day estimates below):** see `EXECUTION_PLAN.md` §6. Extraction (S0–S3, S6) is **18.5–36.5 ew**; the full MVP (S0–S9) is **39.5–73 ew, likely ~56**. The day figures in this section are retained only as the historical v1 estimate and must not be used for planning.
> >
> > Note also that §5 gives **no** estimate for Implementation Phases 1–3. Those are the majority of the work and are estimated in `EXECUTION_PLAN.md` §6.1 (S7–S9)."

---

### MD-10 — §6.2 / §6.4 file inventories: add the hygiene pass **[CORRECT]**

**Location:** §6.1–§6.4.

**Add a new subsection §6.0:**

> "### 6.0 Hygiene Purge (before extraction)
>
> The fork carries substantial dead weight that must be removed before extraction, or it pollutes every subsequent grep gate and leaves duplicate-looking models in the schema:
>
> - **509** tracked `.bak` / `.backup` files (`git ls-files | grep -cE "\.(bak|backup)$"`)
> - Backup Prisma models: `subscription_tiers_list_v1_backup`, `tier_features_list_v1_backup`, `tenants_metadata_backup_gbp`
> - Abandoned singleton variants + alignment scaffolding (`FlexibleApiSingletonV2/Stable`, `PublicApiSingletonStable`, `BASE_CLASS_ALIGNMENT.ts`, `FINAL_ALIGNMENT_REPORT.ts`, `TARGET_SYSTEM_DEMO.ts`)
> - Stray baseline-metric text dumps in `apps/api/`
>
> ≈0.5–1.0 ew. See `EXECUTION_PLAN.md` §0 S0.4."

---

### MD-11 — §2.2 DROP list: add a second pass **[RESOLVE]**

**Location:** §2.2.

**Add after the table:**

> "> **Amended — second pass required:** several §2.1 KEEP entries are semantically commerce-shaped and will re-import coupling the strip just removed. Before closing the extraction, re-evaluate: `promotion.ts`, `quick-start.ts` / `QuickstartOptionsService.ts`, `recommendationService.ts` / `RecommendationSingletonService.ts`, `GlobalCatalogService.ts` / `catalog-*`, `slug-generation.ts` / `SlugSingletonService.ts`, `SocialPixelService.ts` / `social-pixels.ts`. Decide each explicitly rather than carrying it by default."

---

### MD-12 — §3.3 NIL model list **[CORRECT]**

**Location:** §3.3, "Tables (§14.2–14.9)" — lists 25 tables + 7 options tables.

**Problem:** `PROJECT_SEQUENCE.md` §B.2.3 lists 22; `TECHNICAL_SPEC.md` §14 contains 23 `CREATE TABLE` statements. The three documents disagree (F12).

**Add:**

> "> **Amended — reconcile before writing the migration:** count tables directly from `TECHNICAL_SPEC.md` §14 and treat that as authoritative. The three lists in this spec set disagree. Also note `nil_invitations_list` and `nil_onboarding_sessions_list` (§18) are absent from this list but required — they are specified in `TECHNICAL_SPEC.md` §14.4a/§14.4b."

---

## 3. `PROJECT_SEQUENCE.md`

### PS-1 — Superseded banner **[RESOLVE]**

**Location:** top of document, after the version line.

**Add:**

> "> ## ⚠️ SUPERSEDED — 2026-09-30
> >
> > This document's **build order is superseded by `EXECUTION_PLAN.md`**. The MVP is now delivered **API-first (hybrid)**: extract API + schema, validate a vertical slice, then complete web extraction and breadth.
> >
> > Retained value: the **stage → source traceability map** (§"Stage-to-Source Mapping") and the task enumeration. Retained caveats: the RLS premise in Stage B.2.5 is **false** (see `SPEC_AMENDMENTS.md` MD-4), the day-level estimates are superseded, and the Definition of Done needs the bot-UUID exception (`SPEC_AMENDMENTS.md` TS-13).
> >
> > Do not execute this document's stage order. Execute `EXECUTION_PLAN.md` §4."

---

### PS-2 — §C.3: the API-side base story **[RESOLVE]**

**Location:** §C.3:

> "> Note: The NIL base singleton classes (§13 of TECHNICAL_SPEC) are web-side only. The API side uses `UniversalSingleton` directly for backend services. No API-side action needed here."

**Problem:** `TECHNICAL_SPEC.md` §9 specifies 14 backend services extending `BaseService` / `PermissionEnhancedBaseService` / `UniversalSingleton`, but this note tells the implementer there is nothing to do. The two documents leave the API base story undefined (F6e).

**Replace with:**

> "> **Amended — API-side bases are not 'nothing':** the NIL *context-specific* bases (§13) are indeed web-only. But the API side has its own base hierarchy that the 14 services in `TECHNICAL_SPEC.md` §9 depend on, and it must be used deliberately:
> >
> > | API base | Path | Used by |
> > |---|---|---|
> > | `BaseService` | `apps/api/src/services/BaseService.ts` | `GuardianConsentService`, `AthleteMembershipService`, `RecruitingBoardService`, `EscrowLedgerService`, `MediaModerationService`, `MessagingService`, `FanNetworkService`, `DataErasureService`, `InvitationService`, `OnboardingService`, `NilLeadService` |
> > | `PermissionEnhancedBaseService` | `apps/api/src/services/permissions/PermissionEnhancedBaseService.ts` | `AthleteProfileService`, `SponsorshipService` (capability-gated: call `requireFeature(tenantId, 'nil_xxx')` / `requireLimit(...)` before mutating) |
> > | `UniversalSingleton` | `apps/api/src/lib/UniversalSingleton.ts` | `NilRosterService`, `ComplianceVettingService` (cached reads) |
> >
> > The capability-gated services must be the `PermissionEnhanced` ones, and the `tenantId` they gate on is the **athlete-tenant** for athlete-owned features or the **institution/sponsor tenant** for theirs (§12.9)."

---

### PS-3 — §B.2.5 RLS policies **[CORRECT]**

**Location:** §B.2.5:

> "Create RLS policies per athlete-tenant (TECHNICAL_SPEC §14.10) + dual-visibility policies for cross-tenant tables (sponsorship_deals_list)."

**Replace with:**

> "**Phase 2:** build the **repository-level tenant guard** (`EXECUTION_PLAN.md` §4 S4.1) — the platform has no RLS to extend (`SPEC_AMENDMENTS.md` MD-4). **Phase 4:** RLS policies per athlete-tenant + dual-visibility policies, designed from scratch including the Supabase pooler workaround."

---

### PS-4 — Definition of Done: bot UUID exception **[RESOLVE]**

**Location:** §"Guiding rules", the Definition of Done bullet.

**Append:**

> "- **Exception:** `bot_*` tables retain `@db.Uuid` + `gen_random_uuid()` per `TECHNICAL_SPEC.md` §14.12. The CI grep gate whitelists the bot service and bot route directories."

---

## 4. `IMPLEMENTATION_PLAN.md`

### IP-1 — Superseded banner **[RESOLVE]**

**Add at the top:**

> "> ## ⚠️ SUPERSEDED AS TASK BACKLOG — 2026-09-30
> >
> > The task backlog is superseded by `EXECUTION_PLAN.md` §4, which re-sequences the work API-first and adds the Safety Substrate (S4) and Vertical Slice (S5) stages.
> >
> > **Retained and still authoritative:**
> > - **§0 Definition of Done** — incorporated into `EXECUTION_PLAN.md` §2.3 (with the bot-UUID exception)
> > - **§0.1 Skill index** — verified: every referenced playbook in `.devin/skills/` exists. This is a genuine asset; copy `.devin/skills/` into the new repo
> > - **§0.1 'Capability build shortcut'** — the 'open the commerce analog first' rule, made a checklist item in `EXECUTION_PLAN.md` §2.4 and the basis of optimization O2 (template-first capability)
> > - **§9 Risk register** — merged into `EXECUTION_PLAN.md` §10"

---

### IP-2 — §0.1 skill index: add two playbooks **[CORRECT]**

**Add to the skill index table:**

| Concern | Skill to follow |
|---|---|
| Manual SQL (triggers, views, MVs, RLS policies) | `manual-sql-migration-policy.md` |
| Capability resolution + MV | `capability-resolution-mv.md` |

Both verified present in `.devin/skills/`.

---

### IP-3 — Phase 0 tasks 0.2 / 0.3 **[RESOLVE]**

**Location:** Phase 0, tasks 0.2 and 0.3.

**Amend:**

| Task | Change |
|---|---|
| 0.2 "Confirm `tenants.tenant_type` is alterable" | **Resolved** — there is no `tenant_type` column. Becomes decision **D2** (`EXECUTION_PLAN.md` §1): add `tenant_type` + `nil_tenant_profile` side table + `platform_default` tier + forced `directory_visible=false` for athlete type |
| 0.3 "Map RLS GUC mechanism — confirm how `app.current_tenant` is set" | **Resolved — it is not set.** There is no working mechanism. Becomes decision **D1**: Phase-2 enforcement is the repository tenant guard; RLS is Phase-4 hardening built from scratch (`SPEC_AMENDMENTS.md` MD-4) |

**Note:** these two were the only tasks in the set that correctly anticipated a real problem. Both are now closed with answers rather than left as open questions.

---

### IP-4 — Phase 2 tasks 2.13–2.15 (P0 gates) **[RESOLVE]**

**Location:** §3.4 "P0 safety gates (blocking)", tasks 2.13–2.15.

**Amend:** these move **earlier** — into `EXECUTION_PLAN.md` S4 (substrate) and S5 (slice), so the controls exist before the features they guard.

| Original | New home |
|---|---|
| 2.13 COPPA guardian-initiated intake | S4.2 (consent engine) + S5.1 (age-band gate) |
| 2.14 Consent revocation cascade | S4.4 (cache contract) + S5.7 (P0 test) |
| 2.15 Media moderation gate + allowlist | S4.5 (moderation core) + S5.7 (P0 test) |

---

## 5. `FRONTEND_SPEC.md`

### FS-1 — §13a.11 capability hooks inventory **[RESOLVE]**

**Location:** §13a.11 table, rows `useNilGuardianCapability` and `useNilFanNetworkCapability`.

**Problem:** §12.9 says these features are not capability-gated (F6d).

**Delete both rows** and add beneath the table:

> "> **Amended:** `nil_guardian` and `nil_fan_network` are **platform-default, always-on** features — not tier-gated (`TECHNICAL_SPEC.md` §12.9). They have no capability hook, no resolver, and no options-settings table. Access is authorized by **role + consent** at the route layer. The aggregate `useNilCapabilities()` returns **9** capability states, not 11."

---

### FS-2 — §13a.1 capability registry **[RESOLVE]**

**Location:** §13a.1 "Capability Registry (11 NIL Capabilities)".

**Change the heading to "Capability Registry (9 gated capabilities + 2 platform-default features)"** and split the table:

- **Gated (9):** `nil_landing`, `nil_roster`, `nil_recruiting`, `nil_sponsorship`, `nil_achievements`, `nil_compliance`, `nil_finance`, `nil_crm`, `nil_bot`
- **Platform-default (2):** `nil_guardian`, `nil_fan_network` — no tier gate, no merchant prefs, no upsell card

**Also amend §13a.8 "Capability Upsell Pattern"** to state that platform-default features never appear in upsell surfaces.

---

### FS-3 — §14 Frontend Skill Compliance Checklist: testability **[RESOLVE]**

**Location:** §14, particularly the `skill-frontend-ux-guardrails` checklist items ("No unintended page-level horizontal overflow", "Mobile (320px) and desktop (1440px) layouts intentionally designed").

**Problem:** `apps/web` has no jsdom and no testing-library. Interactional and layout assertions are **not expressible** in the existing harness (F10).

**Add to the section:**

> "> **Amended — verification constraint:** `apps/web` has no jsdom and no testing-library (per `AGENTS.md`). Component tests server-render via `renderToStaticMarkup`; `useEffect` never runs; Radix `Accordion`/`Tabs` panels unmount when inactive. Consequences:
> >
> > - **Automatable:** serialized-markup assertions (prefilled `value="…"`, collapsed/expanded copy, status chips, empty/error/loading states reachable without interaction), and pure-helper unit tests extracted from components.
> > - **Not automatable:** layout, overflow, responsive breakpoints, hover/focus behavior, and any interaction requiring a real DOM.
> >
> > The not-automatable items become a **signed manual review checklist** at `EXECUTION_PLAN.md` §4 S7.4 — recorded as evidence, not claimed as a passing test. If automated interaction/layout testing is wanted, that is a deliberate dependency decision (`EXECUTION_PLAN.md` §1 D8), made once."

---

### FS-4 — Child-safety UI constraints: add the discovery and projection surfaces **[CORRECT]**

**Location:** §12 "Child-Safety UI Constraints".

**Add:**

> "> **Amended — surfaces beyond the route layer (2026-09-30):** the following are PII projection paths that are not covered by route-level gating and must each be constrained explicitly:
> >
> > | Surface | Constraint |
> > |---|---|
> > | Tenant directory / discovery | **Athlete-tenants are never eligible.** `directory_visible = false` for `tenant_type='athlete'` (`EXECUTION_PLAN.md` §1 D5) |
> > | `mv_athlete_discovery` materialized view | Must exclude non-`approved` and `directory_visible=false` rows — proven by test, not by inspection |
> > | Database-driven navigation links | Nav is data. A stale link can point at an athlete surface the route layer no longer gates. Reseed and verify (`EXECUTION_PLAN.md` §6 S6.5) |
> > | Email templates (incl. the 6 invitation templates) | Guardian/athlete identity, deal amounts, and claim tokens transit email. Review every template |
> > | Social previews / sitemap / crawler surfaces | Athlete profiles are public routes; previews and crawlers are a projection path |
> > | Error reporting (Sentry) | Verify `sendDefaultPii` is off; stack traces and request payloads are a classic leak |
> >
> > `EXECUTION_PLAN.md` §4 S4.6 automates the enumeration as a CI gate."

---

### FS-5 — §8.3 navigation links to seed **[RESOLVE]**

**Location:** §8.3.

**Add beneath the SQL block:**

> "> **Amended:** navigation is **data**, and data can drift from the route layer. Two consequences: (1) the athlete and institution nav entries reference `{tenantId}` placeholders — these must resolve to the **athlete-tenant** and **institution-tenant** respectively, and must never resolve a guardian or fan into a tenant-scoped route; (2) reseeding nav is part of the PII surface review, not a cosmetic step (`EXECUTION_PLAN.md` §6 S6.5)."

---

## 6. Amendment Summary

| Document | [CORRECT] | [RESOLVE] | Total | Highest-priority item |
|---|---|---|---|---|
| `TECHNICAL_SPEC.md` | 7 (TS-1, TS-2, TS-4, TS-7, TS-8, TS-9, TS-10, TS-14) | 6 (TS-3, TS-5, TS-6, TS-11, TS-12, TS-13) | 14 | **TS-8** — §14.10's "do not invent a new mechanism" instruction sends the implementer to commented-out dead code |
| `MIGRATION_DESIGN.md` | 5 (MD-1, MD-4, MD-6, MD-7, MD-9, MD-10, MD-12) | 4 (MD-2, MD-3, MD-5, MD-11) | 12 | **MD-4** — §3.4's "carries over unchanged" is the root cause of F1 |
| `PROJECT_SEQUENCE.md` | 1 (PS-3) | 3 (PS-1, PS-2, PS-4) | 4 | **PS-1** — superseded banner, so nobody executes the old order |
| `IMPLEMENTATION_PLAN.md` | 1 (IP-2) | 3 (IP-1, IP-3, IP-4) | 4 | **IP-3** — the two tasks that correctly anticipated real problems are now closed with answers |
| `FRONTEND_SPEC.md` | 1 (FS-4) | 4 (FS-1, FS-2, FS-3, FS-5) | 5 | **FS-4** — the non-route PII surfaces |
| **Total** | **15** | **20** | **35** | |

### 6.1 Applying them

Suggested order, because some patches depend on decisions:

1. **Apply §1 (TECHNICAL_SPEC) and §2 (MIGRATION_DESIGN) together** — TS-1/TS-2/TS-8/TS-9 and MD-1/MD-4 are one consistent correction about RLS. Applying half of them leaves the set still contradictory.
2. **Then §3 and §4** (superseded banners) — so nobody starts executing the old order in the meantime.
3. **Then §5** (frontend) — lowest urgency; blocks nothing before S6.
4. **Re-verify §11 of `TECHNICAL_SPEC.md`** as a whole against the tree before it is used as a task input. The known-wrong rows are patched here; a full path audit is a 1–2 hour task and belongs in S0.

### 6.2 What this patch list does not fix

Two things are **not** amendable by text and must be decided, not documented:

- **D1 (RLS strategy)** — the amendments remove the false claim, but they cannot choose the replacement. That is a decision (`EXECUTION_PLAN.md` §1), and it is the one decision that most changes the effort.
- **D10 (legal sign-off)** — the specs' P0 resolutions are sound designs, but "sound design" is not "legal clearance." No amendment substitutes for the review.

---

## 7. Application Record

### 7.1 What was applied

| Document | Amendments | Amendment markers |
|---|---|---|
| `TECHNICAL_SPEC.md` | TS-1 … TS-14 | **16** |
| `MIGRATION_DESIGN.md` | MD-1 … MD-12 | **10** |
| `FRONTEND_SPEC.md` | FS-1 … FS-5 | **7** |
| `PROJECT_SEQUENCE.md` | PS-1 … PS-4 | **4** |
| `IMPLEMENTATION_PLAN.md` | IP-1 … IP-4 | **2** |
| **Total** | **35** | **39** |

### 7.2 Corrections found *during* application (not in the original patch list)

The post-application verification sweep surfaced roughly **30 further live references** that the original patch list missed. They were corrected in place. This is worth recording, because it validates the finding it belongs to (F4 — stale references are systemic, not isolated):

| Document | Additional corrections |
|---|---|
| `TECHNICAL_SPEC.md` | 4 × `apps/web/src/services/base/` → `providers/base/` in the §13.3 reference implementation · `RLS` removed as a reference skill in the §0 firewall row · "RLS machinery / per-athlete RLS" → tenant-scoping in §0 and §12.3 · `RLS-scoped` → tenant-scoped in §1 and §12.3 · `RLS` removed from the inherited-infra lists in §6 and §12.3 · "RLS-enforced" → tenant-guard-enforced in §5.2 · `tier-hierarchies.ts` → `seed-tiers.ts` in §7.1 and §12.10 · new §12.4 note that dual-visibility applies at **both** phases, not only under RLS · §12.12 P1 isolation test re-phased · §14 preamble re-phased |
| `MIGRATION_DESIGN.md` | "and RLS patterns carry over" → auth patterns only (§0) · Supabase plan justification (§1.2) · "Configure RLS policies" → tenant isolation (§1.2) · §3.3 conventions line · dual-visibility row · task M1.5 · risk register row · §8 acceptance criterion |
| `PROJECT_SEQUENCE.md` | Stage B diagram cell · Stage B objective · B.1.2 (now resolved) · F.1.1 · F.1.4 · G.2.3 · verification-strategy line · risk row · First Executable Slice |
| `IMPLEMENTATION_PLAN.md` | Tasks 2.1, 2.5, 3.5 · verification-strategy line · First Executable Slice |
| `FRONTEND_SPEC.md` | Deal List row (§12) · §13a.3 Phase 1 file path (which was wrong in a *different* way than `TECHNICAL_SPEC.md` §7 — itself evidence of the stale-reference problem) |

**Root cause of the extra 30:** the original patch list was written against the sections the review examined closely. `RLS` in particular appeared as a *descriptive* word in ~20 places (diagrams, risk rows, acceptance criteria, prose about "the platform's RLS machinery") where it read as an existing capability rather than a Phase-4 plan. Each was individually harmless and collectively misleading — which is exactly how the false premise propagated in the first place.

### 7.3 Re-verification procedure

To confirm the set stays consistent after any future edit:

```
# 1. Marker count — expect 39 across the five source documents
grep -rc "Amended 2026-09-30" .agents/skills/nil-youth-sports-platform/*.md

# 2. No live RLS claim should remain outside an amendment note or a Phase-4 context.
#    Review each hit and confirm it is one of: an amendment note, a Phase-4 reference,
#    or a test/verification instruction.
grep -rn "RLS" .agents/skills/nil-youth-sports-platform/*.md

# 3. No references to files that do not exist
grep -rn "canonical-features\|tier-hierarchies\|feature-definitions\|services/base/" \
  .agents/skills/nil-youth-sports-platform/*.md

# 4. No capability registry claiming 11 gated capabilities
grep -rn "11 NIL Capabilities\|11 capability states" .agents/skills/nil-youth-sports-platform/*.md
```

**Expected result at time of writing:** checks 3 and 4 return only hits inside amendment notes or inside this document (both of which legitimately quote the original text). Check 2 returns hits that are all Phase-4 references, amendment notes, or verification instructions.

### 7.4 Intentionally left unchanged

These were reviewed and deliberately **not** amended:

| Item | Why |
|---|---|
| `TECHNICAL_SPEC.md` §12 (the gap analysis) | The strongest part of the set. Its P0 resolutions are adopted verbatim by `EXECUTION_PLAN.md` §7.2 |
| `TECHNICAL_SPEC.md` §7.1 (commerce ⇄ NIL equivalency map) | Independently verified as real, not aspirational |
| `IMPLEMENTATION_PLAN.md` §0.1 skill index | All referenced playbooks verified present (80 `.md` playbooks) — a genuine asset |
| `TECHNICAL_SPEC.md` §4 / the four-phase roadmap | The structure is sound; only the effort figures and sequencing changed |
| `TECHNICAL_SPEC.md` §14.11 / §14.12 tables, columns, triggers | Verified accurate; only the "already uses RLS" clause was wrong |
| `FRONTEND_SPEC.md` §12 core safety constraints | Correct as written; §12 was **extended** with the non-route projection surfaces, not corrected |
| Phase-4 RLS policy SQL (§14.10, §3.4) | Retained as a valid Phase-4 reference sketch — the *timing* was wrong, not the design |

### 7.5 Follow-on

The remaining work is not documentation:

1. **Decide D1** (RLS strategy) — the amendments removed the false claim; they cannot choose the replacement.
2. **Start D10** (legal review) — longest lead time, hard-gates the S2 schema freeze.
3. **Run the S0.1 spike** (3–5 days) — converts the two lowest-confidence estimates into measured numbers.
4. **Execute `EXECUTION_PLAN.md` §4** — in the API-first hybrid order, with S7 pulled forward per optimization O16.
