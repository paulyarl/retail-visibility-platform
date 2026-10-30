# GBP Done-For-You (DFY) Management Spec

**Status:** DRAFT v0.3 — for review
**Date:** 2026-10-30 (v0.3: open questions resolved)
**Scope:** Platform-operated Google Business Profile management for merchants — the "we run it for you" layer on top of the DIY GBP Management Suite. Includes post scheduling with batch (cross-tenant fan-out) awareness.
**Prereqs (all landed 2026-10-29):** Gate B approval (project `407743626849`, 300 QPM), all three GBP API hosts enabled, tenant GBP OAuth + location link working end-to-end, `gbp_management` capability grantable per tenant.

**v0.2 changelog** — a codebase audit found several v0.1 premises were greenfield assumptions on top of shipped code:

- §2: the GBP integration routes have **no auth middleware** — `tenantId` is caller-supplied and `authLevel` in `routeRegistry` is display metadata, not enforcement. Auth is now its own workstream (7.0) and a prerequisite.
- §3.2: "existing services parameterize by location — no API changes" was false. Every GBP service resolves one tenant-scoped location via `getLinkedLocation(tenantId)`; model B requires a **location-scoped resolver** (new §3.2), which becomes the critical-path workstream (7.1).
- §4: the GBP Monitor is **already integration-aware** (DB-backed stats, per-tenant rows, job health, entitlements) — §4.1/§4.2 are mostly shipped. Two live bugs folded in ('VERIFIED' enum mismatch → always 0; `connections` counts `mkt_customer_gbp_links`).
- §6: `gbp_scheduled_posts` + `gbp-post-publisher` duplicated `gbp_posts` + `jobs/gbpPostScheduler.ts` (shipped, every 5 min, `gbp_posts_scheduler`-gated). v0.2 extends the existing table/job; `gbp_post_batches` is the only new table.
- §4.3: the review autopilot exists (`GBPReviewReplyService.runAutopilot`, catalog-only job, three gates, no timing window). The spec's addition is scheduling/jitter/business-hours, plus a required consent-precedence table.
- New: §9 verification & quality gates; §8 open questions updated (Q2 resolved, Q4 caveat, three new).
- **v0.3:** all open questions resolved — DFY is `gbp_managed_service` inside `gbp_management` (not `platform_service_*`), which also carries `gbp_management_flexible` to the tenant (Q10). Model-B onboarding is **one-way/platform-initiated** (Q1): `googleLocations.search` → `requestAdminRightsUri` for claimed (owner gets a Google email, 1 click or ~7-day silence) / `accounts.locations.create` for unclaimed (platform owns, zero interaction). Autopilot extends `gbp_reviews` (Q7), consent = delegation + merchant opt-out (Q8, table in §4.3), per-tenant approval mode (Q3), lapse mirrors DIY §6.6 (Q9), flat per-tenant pricing (Q2). Only open item: Q11 — the external model-A policy review.

**Referenced docs:**
- `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md` — the DIY product this extends
- `docs/VISIBLESHELF_INTERNAL_TENANT_SPEC.md` — the dogfood tenant (also the platform token owner, §3.2)
- `docs/AUTH_CONFIG_SECURITY.md` — Gate A/B, token topology, OAuth client inventory
- `shared/tier-contract.json` — `gbp_management` capability module + feature keys

---

## 1. The two management models

### 1.1 DIY (shipped) — merchant self-service

The tenant's own OAuth (`gbp` provider row) → their linked location → the four Advanced Features tabs (Reviews/Posts/Photos/Attributes) at `/t/{tid}/settings/integrations/google/*`. Also the customer-portal surfaces under `/account/marketing/gbp/`.

### 1.2 DFY (this spec) — platform-operated

The platform operates the merchant's GBP on their behalf. Two connect models:

| Model | Mechanism | When to use |
|---|---|---|
| **A — admin-assisted** | A platform admin runs the *existing* OAuth flow and signs in with the *merchant's* Google account during onboarding. Token lands on the merchant's tenant row exactly as DIY. | v1 — zero new plumbing **but a policy question**: the platform holding a merchant-account session is credential sharing under Google's OAuth / API Services User Data Policy, collides with 2FA, and makes revocation unilateral and invisible to the merchant. **Conditional on a written policy review before implementation (Q5 — decided: check first).** |
| **B — true DFY** | The platform holds **one** GBP OAuth account and either **claims unclaimed listings outright** (`googleLocations.search` → `accounts.locations.create`) or **requests access** to claimed ones (`requestAdminRightsUri` → owner gets a Google email — 1 click, or ~7 days of silence auto-proceeds). One-way from the platform; the merchant's max interaction is a single email click. See §3.3. | v2 — the real product. "Never touch Google, we own the ops." One platform token manages a portfolio. |

**Access rule for both:** the integration surface is **platform-admin-gated** — merchants never see connect/link/manage. They get a read-only "Managed by VisibleShelf" view (§5). DIY and DFY are mutually exclusive per Google location (§3.1).

---

## 2. Access gating

- **Current state (verified 2026-10-30):** `google-business-oauth.ts` mounts with `authLevel: 'public'` and **no middleware** — `tenantId` comes from `req.query`/`req.body` and `mountFromRegistry` does not read `authLevel` (it's route-map metadata). Every endpoint — including `POST /posts`, `POST /reviews/:name/reply`, `PATCH /attributes`, `POST /disconnect` — is callable for any tenant by anyone. `isGBPSyncAllowed` is a capability check used inside two handlers, not route auth. **Fixing this is a prerequisite, not an assumption** (workstream 7.0).
- The DFY authz model: `authenticateToken` + tenant-access check on DIY routes; `authenticateToken` + `requirePlatformAdmin` on the DFY ops surface; the admin acts on an explicit `tenantId`/`locationId` path param, never a silently resolved one.
- **Entitlement for DFY ops is the platform grant, not the tenant's plan.** `isGBPSyncAllowed` gates on the tenant's storefront type + `integration_gbp` — a DFY merchant must not be blocked by their own plan when the platform operates for them. The delegation record (§3.1) replaces `isGBPSyncAllowed` on DFY call paths; DIY keeps it.
- `gbp_management` stays a **per-tenant capability module** (Feature Overrides admin grant — proven 2026-10-29). The DFY *commercial* key is separate (below).
- **Commercial home (decided, Q6):** DFY is a **`gbp_management` module feature key** — `gbp_managed_service` — sold as a monthly BSaaS SKU in the **Features tab** of `/settings/admin/bsaas-catalog` (where the other five `gbp_*` SKUs already live: `gbp_ai_response` $29, `gbp_posts_scheduler` $19, `gbp_directory_*` $9, `gbp_management_flexible` $49). The earlier `platform_service_gbp_managed` plan is dropped — it lived in a different module and would have bought the view without the ops.
  - **Registration + resolver work:** `features_list` + `capability_features_list` link (numbered migration, same pattern as 243), `GbpManagementFeature` union gains `'managed_service'`, `isGbpManagementFeatureAllowed` + `EffectiveGbpManagement` gain `can_use_managed_service`, and the web mirrors (`UnifiedCapabilityService`, `CapabilityResolutionService`, `capability-display`) resolve it.
  - **Grant semantics (decided, Q10):** a `gbp_managed_service` purchase **also grants `gbp_management_flexible` to the tenant, scoped to the surfaces in `delegated_surfaces`** — the merchant view then shows real data and no per-feature gate can block the ops work. The grant flow issues both keys together (7.5); `gbp_managed_service` stays the billing SKU, `gbp_management_flexible` the entitlement it carries.
  - **Pricing (decided, Q2):** flat per-tenant monthly — per-location quantity is not expressible in BSaaS today (`bsaas_grant_tokens` has no quantity field; `bsaas_grant_token_claims` is unique on `(token, tenant)`; `bsaas_catalog` has no min/max). v1 is one managed location per tenant anyway (§6.2).

---

## 3. Data model

### 3.1 `gbp_locations_list` — add management dimension

| Column | Type | Notes |
|---|---|---|
| `managed_by` | enum `self \| platform` | `self` = DIY (tenant OAuth). `platform` = DFY. |
| `granted_via` | enum `oauth \| invitation \| platform_claim` | `oauth` = merchant OAuth (DIY + model A). `invitation` = owner approved platform access (§3.3 paths A + C). `platform_claim` = platform owns the listing directly (§3.3 path B; also path A if Google grants *ownership* rather than manager rights). |
| `delegated_surfaces` | jsonb | `{reviews, posts, media, info, hours, attributes}` toggles — what the platform may touch. **A platform-side delegation record, not a merchant soft gate** — per capability-data-flow-rules R33 it must NOT live in `tenant_gbp_options_settings` (the merchant prefs table). Needs an explicit map to the `GbpManagementFeature` union (`ai_response | posts_scheduler | media_upload | attributes`) — two taxonomies, one truth. |
| `platform_account_id` | text null | The platform's GBP `google_account_id` that holds manager rights (model B). |

**Ownership rule (new — required):** uniqueness today is `(account_id, location_id)`; `location_id` alone is not unique. Model B adds a platform-account row for a location that may already have a merchant-account row → two rows, one Google location, conflicting `managed_by`. Enforce exclusivity: unique index on `location_id` **or** an ownership-table/constraint ensuring one platform row per Google location, plus a reconciliation path for "merchant reconnects DIY while DFY is live" (specify: DFY wins with a warning? admin handoff?).

### 3.2 Location + token resolution — the real refactor

The v0.1 claim ("services already parameterize by `location.accountId/locationId` — only the token source changes") was **false**. Today every entry point is `tenantId` → `getLinkedLocation(tenantId)` → `google_oauth_accounts_list.findFirst({tenant_id})` + first location by `updated_at`:

- `GBPAdvancedSync`: `createPost`, `listPosts`, `deletePost`, `listReviews`, `replyToReview`, `uploadPhoto`, `uploadPhotoBinary`, `listMedia`, `storePost`
- `GBPVerificationService`: `verify`, `complete`, `syncVerificationState`
- Jobs: `gbpReviewIngestion`, `gbpPostScheduler`, `gbpHoursSync`
- `GBPReviewReplyService` (via `replyToReview`)

Under model B the merchant has **no** `google_oauth_accounts_list` row, so every one of these returns "No GBP location linked".

**Design — a two-part resolver in `lib/google/`:**

1. **`resolveGbpLocation(scope)`** — reads `gbp_locations_list` directly (not via the OAuth account join). Scope is `{ tenantId }` for DIY (first location, current behaviour) or `{ gbpLocationId }` for DFY portfolio ops. Returns the row: `{ id, account_id, location_id, managed_by, granted_via, platform_account_id, tenant_id }`.
2. **`resolveGbpToken(location)`** — keys off `granted_via`, **not** `managed_by`:
   - `granted_via='oauth'` → merchant token via `findGoogleToken('gbp', { accountId: location.account_id })` (covers DIY *and* model A).
   - `granted_via='invitation'` or `'platform_claim'` → the platform's `gbp` token row.

   Then thread `(accountId, locationId)` — from the location row, not the account lookup — into every call site above. `createPost` and friends gain an explicit location parameter instead of resolving internally.

   (v0.1 keyed resolution on `managed_by` — that broke model A, which is `managed_by='platform'` + merchant token.)

**Platform token owner:** `google_oauth_accounts_list.tenant_id` is non-null FK → `tenants`, and `lib/platform-scope.ts` documents `'platform'` as *not* a tenants row — a `__platform__` sentinel violates the FK. Use the **VisibleShelf internal tenant** (existing real tenants row, already the GBP dogfood tenant) as the platform token owner, or add an explicit platform-token pointer table.

**Guard:** resolution fails closed per `granted_via` — a platform-managed location must never fall back to the merchant's token (or vice versa). Log which path was attempted. Multi-instance safety: the publisher claims rows before resolving (§6.3).

### 3.3 Access acquisition (model B) — platform-initiated, verified API surface

The merchant-facing flow is **one-way**: the platform initiates everything; the merchant's maximum interaction is one click on a Google email — and for unclaimed listings (common in the v1 emerging-merchant segment), zero. `googleLocations.search` on `mybusinessbusinessinformation` v1 is the entry point; the response's `requestAdminRightsUri` field is the claimed/unclaimed branch:

- **Path A — claimed listing (`requestAdminRightsUri` present):** the platform submits the admin-rights request under its own GBP session. Google emails the listing's owner. Owner clicks **Approve** → manager rights granted. Owner ignores → after ~7 days of silence the requester can proceed to verification (`locations.verifications` — `GBPVerificationService` already wraps it). Owner denies → ops queue alert, DFY can't proceed without consent. `granted_via='invitation'`.
- **Path B — unclaimed listing (no `requestAdminRightsUri`):** platform calls `accounts.locations.create` under its own account — **the platform owns the listing**. Then verify via `locations.verifications` (PIN via business phone/address may be the only merchant touch — handled in onboarding ops). `granted_via='platform_claim'`.
- **Path C — cooperative-owner fallback:** if the merchant wants to keep ownership and actively grant manager rights, `locations.admins.create` (`POST mybusinessaccountmanagement/v1/locations/{locationId}/admins`) exists — but it's issued *by the owner*, so either the merchant adds the platform in their GBP dashboard, or a one-shot `business.manage` OAuth lets the platform send the invite on their behalf (then discard the merchant token). Keep as a fallback only.

**Verification + drift:** `locations.admins.list` (or `locations.list` under the platform token) confirms the grant post-hoc and doubles as the periodic drift check — merchant revokes or a claimed owner re-takes control → alert the ops queue + flip `granted_via`/`managed_by` handling; never silently fail writes.

**Scale caveat:** many `platform_claim` listings under one account is the agency pattern Google routes through **location groups / org accounts** (`accounts.create` user groups, per `manage-locations`). Fine at pilot scale; if the portfolio grows past a handful, the platform account should become an org account with location groups — flag for 7.8.

**Offboarding consequence:** `platform_claim` flips the revocation direction — the platform owns the listing, so the merchant can't "revoke"; we hand ownership back. `locations.transfer` does **not** do this (it only moves locations between accounts the *same* user administers). The real handoff: `locations.admins.create(role=OWNER)` to the merchant's Google email → merchant accepts (Google email / GBP sign-in prompt — one click) → `locations.admins.patch` them to `PRIMARY_OWNER` → `locations.admins.delete` on the platform's own row. Order matters — a location can't have zero owners. Whether `PRIMARY_OWNER` is patch-assignable needs confirming in 7.8; fallback is merchant finishing "transfer primary ownership" in the GBP UI, or the merchant-initiated claim → platform-approves path. For `invitation` rows, `locations.admins.delete` removes the platform as manager. Verification state travels with the listing either way.

---

## 4. Admin ops console — GBP Monitor evolution

**Baseline (verified 2026-10-30):** `/settings/admin/marketing-ops/gbp` → `/api/admin/gbp-monitor` is **already integration-aware** — `/overview`, `/tenants` (per-tenant connected/verification/review/post/media counts + merchant gate), `/jobs`, `/entitlements`, reading `gbp_locations_list`/`gbp_reviews`/`gbp_posts`/`gbp_media`/`tenant_gbp_options_settings`. The DFY delta is smaller than v0.1 assumed.

### 4.1 Tenants tab → managed portfolio view

The per-tenant table exists. Add: `managed_by`, `granted_via`, `platform_account_id`, delegated surfaces, drift summary, open queue depth, approval-mode flag.

### 4.2 Stats — fold in two live bugs, then the delta

| Stat | Source | Note |
|---|---|---|
| GBP Connections | `google_oauth_tokens_list` provider `gbp` rows | **Bug:** current code counts `mkt_customer_gbp_links` (customer↔tenant bridge) — mislabeled. |
| Verified Locations | `gbp_locations_list.verification_state` (DB) | **Bug:** code queries `'VERIFIED'`; enum is `UNVERIFIED \| PENDING \| COMPLETED \| FAILED` → always 0 (the Q4 symptom one layer up). |
| Verified (live refresh) | v4 `verifications` per linked location | Don't call Google per page load (300 QPM is shared) — run `syncVerificationState` per linked tenant on a job or admin click, serve from DB. |
| Reviews / Posts / Media | DB counts (already) | Keep; add per-`managed_by` split. |
| Drift | comparison endpoint's per-field conflict count | New — add to `/tenants`. |
| Sync jobs | `GoogleBusinessStatusSync` / `gbpHoursSync` / registry run history | Mostly exists via `/jobs`. |

### 4.3 Action queues (the DFY work surface)

- **Review queue** — unreplied reviews across managed locations, AI-drafted responses, approve/send.
  - **Autopilot already exists** — `GBPReviewReplyService.runAutopilot` + the catalog-only `gbp-review-autopilot` job (three gates: `GBP_AUTOPILOT_ENABLED` env **and** `gbp_ai_response` entitlement **and** `tenant_gbp_options_settings.gbp_autopilot_enabled`; 5 replies/pass max; no timing window).
  - **This spec adds reply timing (decided, Q7):** extend `gbp_reviews` — add `autopilot_due_at` + `autopilot_status` columns (the table already has `reply_status`, `ai_drafts`, `sentiment`; matches the `gbp_posts` lifecycle pattern — no parallel queue table). `autopilot_due_at = detected_at + jitter(2–72h)`, clamped to the merchant's `business_hours_list` window, plus a daily reply cap and skip-if-replied idempotency.
  - **Consent precedence (decided, Q8):** delegation enables by default; the merchant can opt out.

    | `GBP_AUTOPILOT_ENABLED` | `gbp_ai_response` entitled | `managed_by` | `delegated_surfaces.reviews` | `gbp_autopilot_enabled` | Autopilot runs? |
    |---|---|---|---|---|---|
    | false | any | any | any | any | **no** (global kill switch) |
    | true | false | any | any | any | **no** |
    | true | true | `self` | n/a | false | **no** (DIY is opt-IN) |
    | true | true | `self` | n/a | true | **yes** |
    | true | true | `platform` | false | any | **no** (reviews not delegated) |
    | true | true | `platform` | true | true | **yes** |
    | true | true | `platform` | true | false | **no** (merchant opt-OUT honored — delegation defaults on, merchant retains the veto) |
  - **Fix the semantics:** `gbp_autopilot_min_rating` is a *floor* (lowest rating eligible to auto-reply, default 5) — v0.1's "5★ fast-path" implied lower ratings are eligible with delay. They are not, and must not be.
- **Post calendar** — scheduled `gbp_posts` per location (§6).
- **Media pipeline** — upload/curate across locations (same location-resolver refactor).
- **NAP/hours guardian** — drift alerts + auto-fix via `GBPBusinessInfoSync`.
- **Verification requests** — `GBPVerificationService` for platform-managed locations. **Known bug to fix here:** `syncVerificationState` fetches the first location's verdict then `updateMany({tenant_id})` writes it onto *every* location row of that tenant — silently falsifies verification state the moment a tenant has two locations (Q4 caveat).

---

## 5. Merchant-facing "Managed by VisibleShelf" view

Replaces the DIY tabs for `managed_by='platform'` tenants:

- **Activity feed** — what the platform did: posts published, replies sent, fields changed, media uploaded. Event model in §6.5.
- **DIY endpoint behaviour (must pin):** for `managed_by='platform'`, the ~30 existing tenant GBP endpoints should reject writes (`403 managed_by_platform`) and degrade reads appropriately — the view hides the tabs, but given §2's auth gap the endpoints are the enforcement, not the UI.
- **Autopilot settings** — `gbp_autopilot_enabled` + `gbp_autopilot_min_rating` (DIY semantics — see §4.3 precedence).
- **Delegated surfaces display** — which areas are managed (reviews/posts/hours/photos).
- **Request-changes form** — merchant asks for a post/hours change/photo → lands in the ops queue.
- **Approval mode** (decided, Q3) — per-tenant setting chosen at onboarding: `auto_publish` (default), `approve_posts` (posts queue, replies autopilot), `approve_all`. Stored on `tenant_gbp_options_settings` (`gbp_approval_mode`) — it's a merchant preference, so it belongs in the soft-gate table per R33. `approved_by`/`approved_at` bookkeeping already lands on `gbp_posts` via §6.1.
- **Operator audit trail** — separate from the merchant feed: every DFY action records *which platform user* did it (admin accountability for delegated access). `audit_log` exists (`tenant_id`, `actor_type`, `action` enum, `diff`, `entity`) — extend its enums or log alongside the event table.

### 5.1 Event model (`gbp_activity_events` — new table, or `audit_log` + new actions)

| Column | Type | Notes |
|---|---|---|
| `id` | text pk | `gae_*` |
| `tenant_id` | text fk | Merchant tenant the feed is for |
| `gbp_location_id` | text fk null | Scoped location |
| `action` | enum | `post_published \| post_failed \| reply_published \| field_synced \| media_uploaded \| verification_requested \| managed_connected \| managed_revoked` |
| `actor` | enum `admin \| system \| autopilot` | Who triggered it |
| `actor_user_id` | text null | Platform user for the audit trail |
| `detail` | jsonb | `{postId, summary, field, oldValue, newValue, batchId, error}` |
| `visible_to_merchant` | bool | Some events are ops-internal (token failures) |
| `created_at` | timestamptz | |

Every DFY writer (publisher, autopilot, NAP guardian, media, verification) emits one row per outcome. Merchant feed = `visible_to_merchant` rows; ops audit = all rows. Retention: add to the nightly purge list (e.g., 90d) — the AGENTS.md retention pattern (`purge-application-error-log` etc.).

### 5.2 Offboarding / revocation boundary (required — v0.1 had none)

When the DFY service ends (cancellation, lapse, admin revoke):

- **Access:** model B splits by `granted_via` — `platform_claim` → ownership handoff per §3.3 (`admins.create(role=OWNER)` → merchant accepts → `PRIMARY_OWNER` patch → platform self-removes); `invitation` → `locations.admins.delete` removes the platform as manager. Model A — merchant re-runs OAuth in DIY (or the platform disconnects the token). `managed_by` returns to `'self'`.
- **Writes stop for new work immediately:** every DFY writer re-checks `delegated_surfaces`/`managed_by` per action — a lapsed service can't *schedule* new work. **Boundary (decided, Q9): mirrors DIY §6.6** — rows already `SCHEDULED` still publish (they were queued while entitled); unmaterialized batch rows are cancelled; new scheduling stops. Rationale: consistent with the DIY boundary and avoids silently stranding committed content — the alternative (hard-cancel) can be added later via an ops action if merchants ask for it.
- **Data:** published posts/replies stay live on Google (not retractable); `gbp_activity_events` retention keeps the history; the merchant feed transitions to read-only or is removed with the view.

---

## 6. Post scheduling + batch awareness

**Baseline (verified 2026-10-30):** `gbp_posts` already carries the lifecycle — `status` (`DRAFT | SCHEDULED | PUBLISHED | FAILED`, uppercase), `scheduled_for`, `published_at`, `post_name`, `location_id`, event/offer/CTA/media columns — and `jobs/gbpPostScheduler.ts` publishes `SCHEDULED` rows every 5 min, gated on `gbp_posts_scheduler`, killable via `DISABLE_GBP_POST_SCHEDULER` + the JobRegistry DB kill switch. **v0.2 extends this** rather than building `gbp_scheduled_posts` + `gbp-post-publisher` in parallel — two scheduling tables would fork the status vocabulary the monitor/UI/job already query.

### 6.1 `gbp_posts` — extend, don't fork

Add columns (numbered migration): `batch_id` (text null), `created_by` (`tenant \| admin \| autopilot`), `recurrence` (jsonb null), `approved_by`/`approved_at`, `attempts` (int default 0), `last_error` (text null), `publishing_started_at` (timestamptz null — the claim lease).

Statuses stay uppercase; add `PUBLISHING` (in-flight claim) and `CANCELLED`. The compose body is already normalized columns — do **not** introduce a payload-jsonb shape alongside it.

### 6.2 `gbp_post_batches` (new — the only new table)

| Column | Type | Notes |
|---|---|---|
| `id` | text pk | `gpb_*` |
| `created_by_admin` | text | Platform admin user (feeds the audit trail, §5.1) |
| `payload` | jsonb | Post template (same fields as the `gbp_posts` columns) |
| `audience` | jsonb | `{mode: all_managed \| explicit:[gbpLocationIds]}` — **v1 is `all_managed` + `explicit` only**: `metro:X`/`category:Y` have no data (locations carry free-text `address`/single `category`; metro needs tenant directory data). Also note multi-location-per-tenant is post-v1 in the DIY spec — v1 DFY = one managed location per tenant, so batch = cross-tenant fan-out. Pulling multi-location forward pulls location-scoped CRUD into 7.1. |
| `scheduled_at` | timestamptz | Batch publish time (per-row stagger optional) |
| `materialized` | bool | Whether per-location `gbp_posts` rows were generated |
| `created_at` | timestamptz | |

**Materialization:** fans out to `gbp_posts` rows (`status='SCHEDULED'`, `batch_id` set), honoring:

- **Per-location dedupe** — skip if identical content scheduled/published within N days (default 7)
- **Per-location min interval** — don't book two posts within X hours on one location (default 24h; conflicts → next slot)
- **Delegated surfaces gate** — skip locations whose `delegated_surfaces.posts` is off
- **`managed_by='platform'` gate** — DIY locations are never batch targets
- **Per-location exclusion** — admin can uncheck locations before materializing

### 6.3 Publisher — extend `gbp-post-scheduler`, don't add `gbp-post-publisher`

The existing job already does: due-row query, entitlement gate, `createPost`, status transitions. Changes (7.2):

1. **Claim-by-update:** `UPDATE gbp_posts SET status='PUBLISHING', publishing_started_at=now() WHERE id=? AND status='SCHEDULED'` — atomic lease; the registry's `tryLock`/`maxRunMs` bounds the *job*; this bounds the *row* (stale `PUBLISHING` rows reclaimable after N minutes).
2. **Token/location via §3.2 resolver** — `created_by='admin'`/`autopilot` rows resolve by `granted_via`; DIY rows keep today's path.
3. **Retry with backoff:** `attempts < 3` → back to `SCHEDULED` with jittered `scheduled_at`; else `FAILED` + `last_error`. (Today `FAILED` is terminal, no attempts column.)
4. **429/`Retry-After` handling:** per-location backoff on rate limits — the 300 QPM budget is shared with hourly review ingestion, hours sync, and the verification self-heal.
5. **Activity event** per outcome (§5.1) + admin audit row with `actor_user_id`.
6. **Kill switches:** existing `DISABLE_GBP_POST_SCHEDULER` + JobRegistry DB switch.

**Two inherited defects to fix inside 7.2, not after:**

- `createPost` calls `storePost`, which upserts a **second** `gbp_posts` row (lookup key `post.name`, created id generated separately) → every publish duplicates a row and inflates monitor counts. Give `createPost` a `persist: false` path (publisher owns persistence) or move `post_name` recording into it.
- `storePost` never writes `location_id`, and `createPost` ignores `post.location_id` — the row cannot target its location. Both fixed by the §3.2 resolver. Also: `storePost` lowercases `topic_type`; the scheduler casts it back to the `STANDARD|EVENT|OFFER` union — normalize at the API boundary, don't trust the stored case.

**Tests run free through `GBP_TRANSPORT=fixture`** — add a `localPosts` create fixture; `gbp-transport.guard.test.ts` enforces no call site bypasses `gbpFetch`.

### 6.4 Surfaces

| Surface | Who | What |
|---|---|---|
| Posts tab → scheduled section | DIY tenant | Already exists (schedule picker + `gbp_posts_scheduler` gate) |
| Ops console → Post calendar | Admin | Per-location scheduled queue across the portfolio |
| Ops console → Batch composer | Admin | Audience picker → template → preview materialized rows → confirm fan-out |
| Managed view → upcoming | DFY merchant | Read-only "what's scheduled for your profile" |

---

## 7. Workstreams

| # | Item | Depends on |
|---|---|---|
| 7.0 | **Auth on GBP routes** — `authenticateToken` + tenant-access on `google-business-oauth.ts`, `requirePlatformAdmin` for act-on-behalf; close the caller-supplied-`tenantId` hole. Also the monitor stat fixes (`'VERIFIED'`→enum, connections→`google_oauth_tokens_list`). | — (prerequisite for everything) |
| 7.1 | `managed_by`/`granted_via`/`delegated_surfaces`/`platform_account_id` columns + ownership rule (§3.1) + **`resolveGbpLocation`/`resolveGbpToken` refactor** threaded through `GBPAdvancedSync`/`GBPVerificationService`/`gbpReviewIngestion`/`gbpPostScheduler`/`gbpHoursSync`/`GBPReviewReplyService` (§3.2) | 7.0 |
| 7.2 | `gbp_posts` extension + scheduler-job upgrade (claim lease, retry/backoff, 429 handling, `createPost`/`storePost` fixes) | 7.1 |
| 7.3 | GBP Monitor delta — `managed_by`/delegated columns, drift, portfolio actions | 7.1 |
| 7.4 | DFY ops queues — review queue + autopilot timing extension + consent precedence, media, NAP | 7.1, 7.2, 7.3 |
| 7.5 | `platform_service_gbp_managed` BSaaS entry + `PlatformServiceResolver`/`PlatformServiceType`/`EffectivePlatformServices`/web-mirror edits + the DFY→`gbp_management` implication decision (Q6) | — |
| 7.6 | `gbp_activity_events` + managed-by-VisibleShelf merchant view (feed, delegated surfaces, request-changes, approval mode) + DIY-endpoint write gating for platform-managed tenants | 7.4, 7.5 |
| 7.7 | `gbp_post_batches` + audience selector + materialization rules | 7.2, 7.4 |
| 7.8 | Model B: `googleLocations.search` → `requestAdminRightsUri` request / `accounts.locations.create` claim + `locations.admins.list` drift check + platform token owner + location-group scale decision | 7.1 |

## 8. Open questions & decision log

**Resolved 2026-10-30:**

- **Q1:** The admin API exists — and the flow is platform-initiated, not interactive: `googleLocations.search` → claimed → `requestAdminRightsUri` (owner approves via Google email, 1 click or ~7-day silence) → unclaimed → `accounts.locations.create` under the platform account (zero merchant interaction). Full flow in §3.3.
- **Q2:** Flat per-tenant monthly, `gbp_managed_service`. Per-location quantity isn't expressible in BSaaS (`bsaas_grant_tokens` has no quantity; `bsaas_grant_token_claims` unique on `(token, tenant)`; `bsaas_catalog` has no min/max).
- **Q3:** Per-tenant `gbp_approval_mode` (`auto_publish` default / `approve_posts` / `approve_all`), set at onboarding (§5).
- **Q4:** `syncVerificationState` self-heals on `GET /google/business/linked-location`. **Caveat:** first-location verdict + `updateMany({tenant_id})` smears it across all the tenant's rows — fix inside 7.4 (per-location loop).
- **Q5:** Model A requires a **written Google-policy review before implementation** — the spec ships it as conditional; if the review fails, DFY launches on model B alone.
- **Q6:** DFY is `gbp_managed_service` inside `gbp_management`, monthly BSaaS SKU on the Features tab — `platform_service_gbp_managed` dropped (§2).
- **Q7:** Extend `gbp_reviews` with `autopilot_due_at` + `autopilot_status` — no new queue table (§4.3).
- **Q8:** Delegation enables autopilot by default; `gbp_autopilot_enabled=false` is the merchant's veto — precedence table in §4.3.
- **Q9:** Lapse boundary mirrors DIY §6.6 — `SCHEDULED` rows still publish, unmaterialized batches cancel, new scheduling stops (§5.2).
- **Q10:** Yes — `gbp_managed_service` purchase grants `gbp_management_flexible` to the tenant, scoped to `delegated_surfaces`; the grant flow issues both keys (§2).

**Still open:**

- **Q11:** Does the model-A policy review pass? (External — blocks model A only.)

## 9. Verification & quality gates

1. **Auth regression:** unauthenticated `tenantId`-spoof calls to `GET /google/business/linked-location`, `POST /posts`, `POST /reviews/:name/reply` → 401/403. Tenant B acting on tenant A → 403. Platform admin act-on-behalf → 200.
2. **Resolver:** `resolveGbpToken` tests per `granted_via` — oauth → merchant token; invitation → platform token; cross-lookup never returns the wrong row; fail-closed + logged.
3. **Publisher:** fixture-mode tests (`GBP_TRANSPORT=fixture`, `localPosts` create fixture) — due-row claim is atomic (two concurrent passes publish once), retry/backoff increments `attempts` and reschedules, max-3 → `FAILED`, `remote_post_name`/`post_name` recorded, activity event + audit row emitted, no `storePost` duplicate row.
4. **Batch:** materialization honors dedupe window, min-interval shift, `delegated_surfaces.posts` off, `managed_by='self'` exclusion, per-location uncheck.
5. **Autopilot:** precedence table enforced (DFY delegation vs merchant opt-in vs env flag); `min_rating` floor semantics; business-hours clamp reads `business_hours_list`.
6. **Monitor:** `'VERIFIED'` enum fix returns real counts; `syncVerificationState` per-location (no `updateMany` smear).
7. **Offboarding:** cancelling the DFY key stops the platform's writes (delegation check on every writer), revokes model-B access, and leaves/purges per the §5.2 boundary — whatever the final decision is, test it.
8. **Build:** `pnpm checkapi` + `pnpm checkweb` clean; `pnpm build` exits 0.
