# GBP DFY Management — Sprint Plan

**Spec:** `docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md` (v0.3 — read it first; §8 decision log is settled)
**Status:** Planning
**Date:** 2026-10-30
**Migration base:** next free number is **365** (365–368 allocated below)

---

## Sprint Overview

| Sprint | Scope | Spec workstream | Prereq |
|---|---|---|---|
| **D0** | GBP route auth + monitor stat fixes | 7.0 | — (can ship alone; security fix) |
| **D1** | `managed_by` schema + location/token resolver refactor | 7.1 | D0 |
| **D2** | Publisher upgrade (claim lease, retry, `createPost`/`storePost` fixes) | 7.2 | D1 |
| **D3** | Monitor delta + ops queues + autopilot timing | 7.3, 7.4 | D1, D2 |
| **D4** | `gbp_managed_service` SKU + resolvers + grant flow | 7.5 | — (parallel-safe) |
| **D5** | Managed-by-VisibleShelf merchant view + DIY write gating | 7.6 | D3, D4 |
| **D6** | `gbp_post_batches` + batch composer | 7.7 | D2, D3 |
| **D7** | Model B access acquisition (claim/request/handoff) | 7.8 | D1 |

**Critical path:** D0 → D1 → D2 → D3 → D5. **Parallelizable:** D4 any time; D6 after D2+D3; D7 after D1 (independent of D2–D6).

```
D0 (auth) ──> D1 (resolver) ──┬──> D2 (publisher) ──> D3 (ops queues) ──> D5 (merchant view)
                              │                          │
D4 (SKU/resolvers) ───────────┼──────────────────────────┘
                              └──> D6 (batch)         D7 (model B access)
```

---

## Sprint D0 — GBP Route Auth + Monitor Fixes

**Goal:** Close the unauthenticated GBP surface before anything else builds on it; fix the two monitor stat bugs.

### Tasks

**D0.1 — Auth on `google-business-oauth.ts`**
- Apply `authenticateToken` + `checkTenantAccess` (`middleware/auth.ts`) to the router. `checkTenantAccess` already resolves `tenantId` via `getTenantId` (params/query/body/`x-tenant-id`), checks `req.user.tenantIds` + `user_tenants` fallback, and **passes platform users via `isPlatformUser`** — admin act-on-behalf is free; no impersonation machinery needed.
- **Exception:** `GET /google/business/callback` is Google's OAuth redirect — keep it auth-gated but tolerate the redirect semantics: `authenticateToken` won't run on a Google redirect, so the callback must authenticate via the `state` payload (already carries tenant context — verify it carries a signed/nonce-bound state, not just a raw tenantId).
- Per-handler: replace raw `req.query.tenantId` trust with the resolved tenant from `checkTenantAccess`; platform admins acting on another tenant continue passing `tenantId` explicitly.
- Audit all ~30 handlers for `isGBPSyncAllowed` consistency (it exists in only 2 today) — DIY write routes should gate on it; DFY routes will not (spec §2).

**D0.2 — Monitor stat fixes (`routes/gbp-monitor.ts`)**
- `verifiedLocations`: `verification_state: 'COMPLETED'` (was `'VERIFIED'` — never matches; always 0).
- `connections`: `google_oauth_tokens_list` provider `gbp` count (was `mkt_customer_gbp_links` — mislabeled). Decide whether to keep a second stat for customer↔tenant links and label it correctly.

### Verification gates

- Unauthenticated call with foreign `tenantId` → 401; authenticated non-member → 403; platform admin → 200.
- OAuth callback still completes end-to-end against the dogfood tenant.
- Monitor shows non-zero verified count on a tenant verified via `syncVerificationState`.
- `pnpm checkapi` clean; route-map regenerates (`generate-route-map`) with authLevel corrected to `tenant`.

---

## Sprint D1 — Managed Schema + Location/Token Resolver

**Goal:** the single most valuable refactor in the spec (§3.2) — replace tenant-scoped location resolution with a location-scoped resolver, and land the management columns.

### Tasks

**D1.1 — Migration 365**
```sql
gbp_locations_list += managed_by ('self'|'platform'),
                     granted_via ('oauth'|'invitation'|'platform_claim'),
                     delegated_surfaces jsonb,
                     platform_account_id text null;
gbp_activity_events  (id gae_*, tenant_id, gbp_location_id, action, actor,
                      actor_user_id, detail jsonb, visible_to_merchant, created_at);
```
- Ownership rule: unique index on `gbp_locations_list.location_id` (one platform row per Google location) — verify no dupes exist first; if the unique can't be made safe, use a check-side resolver conflict guard instead and log collisions.

**D1.2 — `lib/google/gbp-target.ts`**
- `resolveGbpLocation(scope: { tenantId } | { gbpLocationId })` — reads `gbp_locations_list` directly (tenant-first-location for DIY; explicit row for DFY).
- `resolveGbpToken(location)` — `granted_via='oauth'` → `findGoogleToken('gbp', { accountId: location.account_id })`; `invitation`/`platform_claim` → platform token (owner = VisibleShelf internal tenant row — add its tenant id to `unifiedConfig` or a pointer row; do NOT use a `__platform__` sentinel — FK violation).
- Fail closed + log attempted path (spec §3.2 guard).

**D1.3 — Thread `(accountId, locationId)` through the call sites**
- `GBPAdvancedSync`: `createPost`, `listPosts`, `deletePost`, `listReviews`, `replyToReview`, `uploadPhoto`, `uploadPhotoBinary`, `listMedia`, `storePost` — signature gains a `GbpTarget` (or location row) param; keep a `getLinkedLocation` compat shim for untouched callers.
- `GBPVerificationService`: `verify`, `complete`, `syncVerificationState`.
- Jobs: `gbpReviewIngestion`, `gbpPostScheduler`, `gbpHoursSync`.
- `GBPReviewReplyService` (via `replyToReview`).

### Verification gates

- `resolveGbpToken` unit tests: oauth → merchant token; invitation/platform_claim → platform token; wrong-row never returned; fail-closed + logged.
- Every refactored service compiles against `GbpTarget`; existing DIY paths produce identical behavior (regression via current test suite).
- `syncVerificationState` no longer smears one location's verdict across a tenant's rows (per-location loop) — spec §4.3/Q4 caveat. Pull this forward into D1 since it touches the same file.
- `pnpm checkapi` clean; `pnpm prisma:generate` after schema change.

---

## Sprint D2 — Publisher Upgrade

**Goal:** extend the shipped `gbp_posts` + `gbpPostScheduler` into the DFY publisher (spec §6.1–6.3). No new table, no new job.

### Tasks

**D2.1 — Migration 366**
```sql
gbp_posts += batch_id text null, created_by ('tenant'|'admin'|'autopilot'),
             recurrence jsonb null, approved_by, approved_at,
             attempts int default 0, last_error text null,
             publishing_started_at timestamptz null;
gbp_reviews += autopilot_due_at timestamptz null, autopilot_status varchar(16);
-- status vocab stays uppercase; add PUBLISHING + CANCELLED to the allowed set
```

**D2.2 — `gbpPostScheduler` upgrade**
- Claim-by-update: `UPDATE gbp_posts SET status='PUBLISHING', publishing_started_at=now() WHERE id=? AND status='SCHEDULED'` — atomic row lease; stale `PUBLISHING` (>15min) reclaimable.
- Retry: `attempts < 3` → back to `SCHEDULED` + jittered `scheduled_at`; else `FAILED` + `last_error`.
- 429/`Retry-After`: per-location backoff; shared 300 QPM budget noted (spec §6.3.4).
- Emit `gbp_activity_events` row per outcome + audit `actor_user_id` where `created_by='admin'`.

**D2.3 — Fix inherited defects (spec §6.3)**
- `createPost`: add `persist` option so the publisher owns persistence (no duplicate `storePost` row); `storePost` writes `location_id`; normalize `topic_type` to the uppercase `STANDARD|EVENT|OFFER` enum at the API boundary (stored value is currently lowercased).
- `createPost` honors the target location from `resolveGbpLocation`, not the tenant's first linked row.

### Verification gates

- `GBP_TRANSPORT=fixture` + `localPosts` create fixture: due row → `PUBLISHED` + `post_name` + event; API error → retry → `FAILED` after 3.
- Two concurrent passes never double-publish (claim lease).
- No duplicate `gbp_posts` row on publish (post count stays 1 per post).
- `DISABLE_GBP_POST_SCHEDULER` + JobRegistry DB kill switch still work.

---

## Sprint D3 — Ops Queues + Monitor Delta

**Goal:** the DFY work surface (spec §4) — managed columns on the monitor, review queue, autopilot timing layer.

### Tasks

**D3.1 — Monitor delta**
- `/api/admin/gbp-monitor/tenants`: add `managed_by`, `granted_via`, `delegated_surfaces`, `platform_account_id`, drift summary, queue depth.
- `/overview`: per-`managed_by` splits; verification count fed by the D0 fix.
- Drift endpoint: per-field conflict count from the existing compare endpoint, per linked location.

**D3.2 — Review queue + autopilot timing**
- Ops endpoint: unreplied reviews across `managed_by='platform'` locations (filter `reply_status='NONE'`, `is_replied=false`), AI-drafted responses via `GBPReviewReplyService.generateDrafts`, approve/send.
- `runAutopilot` timing layer (spec §4.3, Q7/Q8 decided): `autopilot_due_at = detected_at + jitter(2–72h)` clamped to `business_hours_list` window; daily cap; skip-if-replied; precedence table enforced (delegation default-on + merchant veto via `gbp_autopilot_enabled=false`).
- **Gate:** `runAutopilot` stays behind the Phase-2.5 green light (`GBP_AUTOPILOT_ENABLED` + Tier-A validation); this sprint builds the timing layer and scheduling mechanics — activation is an ops decision, not this sprint's call.

**D3.3 — NAP/media/verification queues**
- Drift alerts → auto-fix via `GBPBusinessInfoSync` for `delegated_surfaces.info/hours`.
- Media upload/curate across managed locations (D1 resolver).
- `syncVerificationState` per-location (done in D1 if pulled forward — otherwise here).

### Verification gates

- Queue endpoints return platform-managed rows only.
- Autopilot precedence table: all 7 rows of the §4.3 matrix hold in tests.
- `autopilot_due_at` lands inside `business_hours_list` window; daily cap enforced.
- `pnpm checkapi`/`checkweb` clean.

---

## Sprint D4 — Commercial: `gbp_managed_service` SKU + Resolvers

**Goal:** the purchasable DFY key (spec §2, Q2/Q6/Q10 decided).

### Tasks

**D4.1 — Migration 367**
```sql
features_list            += gbp_managed_service;
capability_features_list += link gbp_managed_service -> gbp_management;
bsaas_catalog            += (gbp_managed_service, monthly, price TBD, trial_eligible, sort_order 15);
tenant_gbp_options_settings += gbp_approval_mode varchar(16) default 'auto_publish';
```

**D4.2 — Resolver + mirrors**
- `GbpManagementFeature` union += `'managed_service'`; `isGbpManagementFeatureAllowed` case; `EffectiveGbpManagement` += `can_use_managed_service`; `resolveGbpManagement` wiring.
- Web mirrors: `UnifiedCapabilityService`, `CapabilityResolutionService`, `capability-display`.

**D4.3 — Grant flow (Q10: yes)**
- `gbp_managed_service` purchase/grant also issues `gbp_management_flexible` scoped to `delegated_surfaces` — implement in the grant/checkout path (BSaaS grant token claim + purchase completion + Feature Overrides).

### Verification gates

- Feature key resolves in effective manifest; `can_use_managed_service` flips on purchase.
- Grant flow issues both keys; `delegated_surfaces` recorded.
- `tier-contract` surface guard: `features_list` migration + resolver file edits must pass the contract suites in `apps/api/src/services/__tests__/` (fixture-first per AGENTS.md — edit `shared/tier-contract.json` if the key list changes... `gbp_managed_service` is a `gbp_management` module feature, so `capability_modules` in the fixture needs the key appended; regenerate via `sync-fixture-modules.cjs` after re-dumping the witness).

---

## Sprint D5 — Managed-by-VisibleShelf Merchant View

**Goal:** §5 — the read-only merchant surface + DIY write gating.

### Tasks

**D5.1 — Write gating for managed tenants**
- All tenant GBP write endpoints return `403 managed_by_platform` when the target location's `managed_by='platform'` (reads still allowed or degraded per §5).

**D5.2 — Merchant view page**
- `/t/{tid}/settings/integrations/google/managed` (replaces the four DIY tabs when `managed_by='platform'`): activity feed (`gbp_activity_events` where `visible_to_merchant`), delegated surfaces display, `gbp_approval_mode` picker (Q3), request-changes form → ops queue, "what's scheduled" list.
- `PUT /gbp-options` updates `gbp_approval_mode` + `gbp_autopilot_enabled` (merchant veto per Q8) — must call `invalidateEffectiveCapabilities(tenantId)` per the §6.8 cache pitfall.

### Verification gates

- Managed tenant: DIY tabbed UI hidden/replaced; write endpoints 403; feed renders events.
- Approval mode: `approve_posts`/`approve_all` routes work through `approved_by/at` before publish.
- `pnpm checkweb` clean.

---

## Sprint D6 — Batch Fan-Out

**Goal:** §6.2 — `gbp_post_batches` + materialization + ops batch composer.

### Tasks

**D6.1 — Migration 368:** `gbp_post_batches` per spec §6.2.

**D6.2 — Materialization service**
- Audience `{all_managed, explicit:[gbpLocationIds]}` → per-location `gbp_posts` rows (`batch_id`, `created_by='admin'`), honoring dedupe window (7d), min-interval shift (24h), `delegated_surfaces.posts` off, `managed_by='self'` exclusion, admin uncheck.

**D6.3 — Ops UI:** audience picker → template → preview materialized rows → confirm (inside GBP Monitor).

### Verification gates

- All four materialization rules hold in tests; preview matches what lands in `gbp_posts`.
- Staggered `scheduled_at` offsets spread fan-out (quota §6.3).

---

## Sprint D7 — Model B Access Acquisition

**Goal:** §3.3 — platform-initiated claim/request flow under one platform token.

### Tasks

**D7.1 — `googleLocations.search` intake**
- Ops tool: paste business name/address → `search` → `requestAdminRightsUri` present/absent decides path A vs B.

**D7.2 — Path B (unclaimed):** `accounts.locations.create` under platform account → `locations.verifications` via `GBPVerificationService` (platform token) → `granted_via='platform_claim'`.
**D7.3 — Path A (claimed):** submit admin-rights request under platform session → owner email → approve → `granted_via='invitation'`; denied → ops queue alert.
**D7.4 — Drift check:** `locations.admins.list` sweep (job or monitor on-load) — revoked/reclaimed → alert + `managed_by` handling.
**D7.5 — Decisions to verify in-flight:** `PRIMARY_OWNER` patch-assignability for handoff; org account / location groups if portfolio > handful; platform token owner row (VisibleShelf tenant) wired into `unifiedConfig`.

### Verification gates

- End-to-end on the dogfood tenant: claim an unclaimed test listing OR complete the request flow against a controlled second GBP account.
- `resolveGbpToken` returns the platform row for `invitation`/`platform_claim` locations.
- Fixture recorded for `googleLocations.search` + `locations.admins.*` calls.

---

## Cross-cutting (every sprint)

- `pnpm checkapi` + `pnpm checkweb` clean; `pnpm build` exits 0 before merge.
- New GBP API calls go through `gbpFetch` — `gbp-transport.guard.test.ts` enforces it; add fixtures for every new call shape.
- `audit_log`/`gbp_activity_events` written by every DFY action (`actor_user_id` for admin-initiated).
- Contract suites: `features_list`/`capability_features_list` migrations keep `shared/tier-contract.json` in sync (regenerate `capability_modules` after re-dumping the witness).
- Job additions register in JobRegistry with `DISABLE_*` env + `maxRunMs` lease — **never pg_cron** for app jobs.

## Out of scope

- Model A (admin-assisted OAuth) — blocked pending Q11 policy review.
- Multi-location per tenant (DIY spec post-v1); batch v1 = cross-tenant `all_managed`/`explicit` only.
- `metro`/`category` batch audiences — no data source yet.
- Pub/Sub review ingestion; performance API for `gbp_media.view_count`.
