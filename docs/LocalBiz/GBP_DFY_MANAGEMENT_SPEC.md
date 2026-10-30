# GBP Done-For-You (DFY) Management Spec

**Status:** DRAFT v0.1 — for review
**Date:** 2026-10-30
**Scope:** Platform-operated Google Business Profile management for merchants — the "we run it for you" layer on top of the DIY GBP Management Suite. Includes post scheduling with batch (cross-tenant fan-out) awareness.
**Prereqs (all landed 2026-10-29):** Gate B approval (project `407743626849`, 300 QPM), all three GBP API hosts enabled, tenant GBP OAuth + location link working end-to-end, `gbp_management` capability grantable per tenant.

**Referenced docs:**
- `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md` — the DIY product this extends
- `docs/VISIBLESHELF_INTERNAL_TENANT_SPEC.md` — the dogfood tenant proving the surfaces
- `docs/AUTH_CONFIG_SECURITY.md` — Gate A/B, token topology, OAuth client inventory
- `shared/tier-contract.json` — `gbp_management` capability module + feature keys

---

## 1. The two management models

### 1.1 DIY (shipped) — merchant self-service

The tenant's own OAuth (`gbp` provider row) → their linked location → the four Advanced Features tabs (Reviews/Posts/Photos/Attributes). This is what exists today at `/t/{tid}/settings/integrations/google/*`.

### 1.2 DFY (this spec) — platform-operated

The platform operates the merchant's GBP on their behalf. Two connect models:

| Model | Mechanism | When to use |
|---|---|---|
| **A — admin-assisted** | A platform admin runs the *existing* OAuth flow and signs in with the *merchant's* Google account during onboarding. Token lands on the merchant's tenant row exactly as DIY. | v1 — zero new plumbing, works today. The merchant's profile is managed by us through their credentials. |
| **B — true DFY** | The platform holds **one** GBP OAuth account; each merchant's location grants the platform **manager access** via GBP's own admin-invitation (`accounts/{}/locations/{}/admins` — merchant accepts, no merchant OAuth at all). | v2 — the real product. "Never touch Google, we own the ops." One platform token manages a portfolio. |

**Access rule for both:** the integration surface is **platform-admin-gated** — merchants never see connect/link/manage. They get a read-only "Managed by VisibleShelf" view (§5). DIY and DFY are mutually exclusive per location via `managed_by` (§3).

---

## 2. Access gating

- The current integration pages/routes gate on tenant access (`AccessPresets.SUPPORT_OR_TENANT_ADMIN`, `isGBPSyncAllowed`). For DFY, routes gain an admin-only layer on top of tenant identity — admin may act on behalf of any tenant.
- `gbp_management` becomes a **platform-admin capability** (already a per-tenant grant via the Feature Overrides admin UI — proven 2026-10-29).
- DFY is a **recurring managed-service subscription** — the fit narrative: *"We run your Google profile for you."* A monthly fee buys delegated operations across the surfaces the ops console manages: **review management** (monitor + AI-drafted replies, approved or autopilot), **profile maintenance** (NAP/hours guardian, attributes, categories kept in sync), **content cadence** (scheduled posts + media pipeline), and **verification assistance** when needed. The delegation model above is what makes it sellable — the merchant never touches Google; the platform's access (invitation or assisted OAuth) is the service.
- Commercial home: the existing **BSaaS Catalog → Services tab** (`/settings/admin/bsaas-catalog`) — same machinery as `platform_service_store_setup`/`profile_setup`/`seo_optimization`: feature key `platform_service_gbp_managed`, name/description/price/billing/order columns, demo-eligible flag, purchasable via "Create Grant QR". Difference vs the existing six entries: they're `one_time` deliverables; this is `recurring` (monthly) — the `billing` column already types both, so the catalog covers it without schema change. Granting the key flips `platform_services.enabled` + `can_use_gbp_managed` for the tenant and gates the merchant-facing "Managed by VisibleShelf" view. Scope can tier by delegated surface — reviews-only vs full-management (posts + media + NAP guardian) — as separate keys or one key plus `delegated_surfaces` recording what was actually sold.

---

## 3. Data model

### 3.1 `gbp_locations_list` — add management dimension

| Column | Type | Notes |
|---|---|---|
| `managed_by` | enum `self \| platform` | `self` = DIY (tenant OAuth). `platform` = DFY. |
| `granted_via` | enum `oauth \| invitation` | How access was obtained — merchant OAuth vs admin-invitation. |
| `delegated_surfaces` | jsonb | `{reviews, posts, media, info, hours, attributes}` toggles — what the platform may touch. Maps to `merchant_preferences.gbp_autopilot_*` where it exists. |
| `platform_account_id` | text null | The platform's GBP account that holds manager rights (model B). |

### 3.2 Token resolution (`lib/google/token-store.ts`)

Provider `gbp` gains a **platform scope**: when `managed_by='platform'`, resolve the platform's own `gbp` token row (a `google_oauth_accounts_list` row owned by the platform's internal tenant or a sentinel `tenant_id='__platform__'`) instead of the merchant's. All existing sync services (`GBPAdvancedSync`, `GBPBusinessInfoSync`, `GBPVerificationService`, `gbpHoursSync`) already parameterize by `location.accountId/locationId` — they need no API changes, only the token source.

**Guard:** a platform-managed location must never silently fall back to the merchant's token (or vice versa) — token resolution fails closed and logs which `managed_by` path was attempted.

### 3.3 Invitation flow (model B)

`accounts/{account}/locations/{location}/admins` — the platform sends an invitation to its GBP account for the merchant location; merchant accepts in their GBP dashboard (one click, no OAuth). The admin-invitation call needs the *merchant's* owner approval — which is a docs/onboarding step, not an OAuth flow. Alternative v1.5: merchant manually adds the platform's Google account as manager; operator links it.

---

## 4. Admin ops console — GBP Monitor evolution

The existing GBP Monitor (`/settings/admin/marketing-ops/gbp`) is **seed-view** — it reads the directory claim pipeline, not integration state. DFY needs a second, integration-aware layer on the same page:

### 4.1 Tenants tab → managed portfolio view

One row per tenant: OAuth state (provider `gbp` present, expiry), linked location, `managed_by`, delegated surfaces, GBP object counts, drift summary, open queue depth.

### 4.2 Integration-aware stats (replace/augment seed metrics)

| Stat | Source |
|---|---|
| GBP Connections | `google_oauth_tokens_list` provider `gbp` rows |
| Verified Locations | v4 `verifications` call per linked location — Google's real state, not platform flag |
| Reviews / Posts / Media | v4 `reviews`, `localPosts`, `media` counts per location |
| Drift | the comparison endpoint's per-field conflict count |
| Sync jobs | `GoogleBusinessStatusSync` / `gbpHoursSync` run history |

### 4.3 Action queues (the DFY work surface)

- **Review queue** — unreplied reviews across managed locations, AI-drafted responses, approve/send
  - **Autopilot reply scheduling** (`gbp_review_replies` — same due-claim/idempotency pattern as `gbp_scheduled_posts`): `respond_after = detected_at + jitter(2–72h)`, then clamped to the **merchant's own business-hours window** (hours already canonical via `gbpHoursSync` — a reply landing while the store is open reads as the owner at work, not a bot). Per-rating policy rides `gbp_autopilot_min_rating` (5★ fast-path, lower ratings held for human review), daily reply cap so bursts don't all answer at once, skip-if-already-replied idempotency. Timing is merchant-optics, not an algorithm requirement — the real risk gate is never auto-replying to a bad review.
- **Post calendar** — scheduled `localPosts` per location (§6)
- **Media pipeline** — upload/curate across locations
- **NAP/hours guardian** — drift alerts + auto-fix
- **Verification requests** — `GBPVerificationService` for platform-managed locations

---

## 5. Merchant-facing "Managed by VisibleShelf" view

Replaces the DIY tabs for `managed_by='platform'` tenants:

- **Activity feed** — what the platform did: posts published, replies sent, fields changed, media uploaded (written by every DFY action — see §6.3 event model)
- **Autopilot settings** — `gbp_autopilot_enabled` + `gbp_autopilot_min_rating` (auto-reply threshold — already in caps)
- **Delegated surfaces display** — which areas are managed (reviews/posts/hours/photos)
- **Request-changes form** — merchant asks for a post/hours change/photo → lands in the ops queue
- **Approval mode** (optional) — posts/replies queue for merchant approval before publishing

---

## 6. Post scheduling + batch awareness

The DIY Posts tab is single-shot (compose → Post to Google now). Scheduling adds a deferred-publish layer with three modes: **DIY scheduled**, **DFY scheduled**, and **DFY batch** (one composition → N managed locations).

### 6.1 `gbp_scheduled_posts` table

| Column | Type | Notes |
|---|---|---|
| `id` | text pk | `gsp_*` |
| `tenant_id` | text fk | Owning tenant |
| `gbp_location_id` | text fk | Target location (`gbp_locations_list.id`) |
| `payload` | jsonb | `{summary, topicType (STANDARD/OFFER/EVENT), media[], callToAction{actionType,url}}` — mirrors the v4 `localPosts` create body |
| `scheduled_at` | timestamptz | When to publish |
| `status` | enum | `scheduled \| publishing \| published \| failed \| cancelled` |
| `remote_post_name` | text null | Google-side post name on success |
| `attempts` / `last_error` | int / text | Retry bookkeeping |
| `batch_id` | text fk null | Set for batch-materialized rows (§6.2) |
| `created_by` | enum `tenant \| admin \| autopilot` | Who scheduled it |
| `recurrence` | jsonb null | `{freq: weekly, day, count}` for series |
| `approved_by` / `approved_at` | | Approval-mode bookkeeping (§5) |
| `created_at` / `updated_at` | | |

### 6.2 `gbp_post_batches` table (DFY fan-out)

| Column | Type | Notes |
|---|---|---|
| `id` | text pk | `gpb_*` |
| `created_by_admin` | text | Platform admin user |
| `payload` | jsonb | Post template (same shape as scheduled row) |
| `audience` | jsonb | Target selector: `{mode: all_managed \| metro:X \| category:Y \| explicit:[locationIds]}` |
| `scheduled_at` | timestamptz | Batch publish time (per-row stagger optional) |
| `materialized` | bool | Whether per-location `gbp_scheduled_posts` rows were generated |

**Materialization:** creating a batch fans out to per-location `gbp_scheduled_posts` rows (`batch_id` set), honoring:

- **Per-location dedupe** — skip a location if an identical-content post is scheduled/published within N days (default 7)
- **Per-location min interval** — don't book two posts within X hours of each other on one location (default 24h; conflicts → shift to next slot)
- **Delegated surfaces gate** — skip locations whose `delegated_surfaces.posts` is off
- **Per-location exclusion** — admin can uncheck individual locations before materializing

### 6.3 Publisher job

New scheduled job `gbp-post-publisher` (pg_cron, e.g. every 5 min — the codebase's `jobs/` + pg_cron pattern):

1. Claim due rows (`scheduled_at <= now()`, `status='scheduled'`, atomic `publishing` transition)
2. Resolve token by `managed_by` (§3.2)
3. POST to `localPosts` via the transport seam (`gbpFetch` — fixture/record modes come free)
4. Record `remote_post_name` + `status='published'`, or `failed` + `last_error` + retry-with-backoff (max 3)
5. Write an **activity event** (the merchant-facing feed in §5) for every outcome

**Quotas:** 300 QPM shared across all GBP calls — the publisher is the biggest writer; stagger fan-out (e.g., spread batch rows over minutes, not seconds) and prefer per-row `scheduled_at` offsets over a burst.

### 6.4 Surfaces

| Surface | Who | What |
|---|---|---|
| Posts tab → scheduled section + datetime picker | DIY tenant | Schedule own posts; see scheduled/published lists |
| Ops console → Post calendar | Admin | Per-location scheduled queue across the portfolio |
| Ops console → Batch composer | Admin | Audience picker → template → preview materialized rows → confirm fan-out |
| Managed view → upcoming | DFY merchant | Read-only "what's scheduled for your profile" |

---

## 7. Workstreams

| # | Item | Depends on |
|---|---|---|
| 7.1 | `managed_by`/`delegated_surfaces`/`granted_via` columns + admin-gated DIY routes | — |
| 7.2 | `gbp_scheduled_posts` + publisher job + DIY schedule picker | 7.1 |
| 7.3 | Integration-aware stats on GBP Monitor (connections/verifications/object counts/drift) | 7.1 |
| 7.4 | DFY ops queues (reviews, posts calendar, media, NAP) | 7.3 |
| 7.5 | `platform_service_gbp_managed` key in BSaaS Services catalog + `platform_services.can_use_gbp_managed` | — |
| 7.6 | Managed-by-VisibleShelf merchant view (activity feed, autopilot, request-changes) | 7.4 |
| 7.7 | `gbp_post_batches` + audience selector + materialization rules | 7.2, 7.4 |
| 7.8 | Platform-token provider scope + admin-invitation flow (model B) | 3.2 |

## 8. Open questions

- **Q1:** Does model B need Google's *agency* relationship (`locationGroup` accounts) vs per-location `manager`? Per-location manager invitations are simpler and don't require the platform to be an org account — verify the API supports agency-wide grant if we want portfolio ops.
- **Q2 — resolved:** billing lands in the **BSaaS Catalog → Services tab** as `platform_service_gbp_managed` (recurring billing). Remaining sub-question: flat per-tenant fee vs per-managed-location pricing — per-location likely needs a price-quantity field or a bundle of per-location keys; check whether the Grants tab supports quantity.
- **Q3:** Approval mode default — do DFY posts/replies auto-publish, or queue for merchant approval? Suggest auto-publish with `autopilot_min_rating` for reviews, optional approval for posts.
- **Q4 — resolved 2026-10-30:** the "Verified Locations 0/1" gap was `gbp_locations_list.is_verified` only ever being written by the platform's PIN `complete()` flow — locations verified directly in Google's dashboard never got marked. `GBPVerificationService.syncVerificationState(tenantId)` now re-truths the flag from the v4 `verifications` list (a `COMPLETED` entry = Google-verified), called on `GET /google/business/linked-location` so every integrations-page load self-heals the row. Errors swallowed — best-effort, never a blocker. Cross-tenant monitor-level backfill (one call per linked tenant) still belongs in 7.3.
