# Social Posting Suite — Meta Pilot & Multi-Platform Expansion Spec

**Status:** DRAFT v0.1 — for review
**Owner:** Product (with Engineering sign-off on the Meta scope-expansion path)
**Date:** 2026-10-30
**Scope:** Merchant-facing social media posting — compose, schedule, and publish posts to connected social platforms from the tenant portal. **Meta (Facebook Page + Instagram) is the pilot platform.** TikTok, LinkedIn, Pinterest, and X are covered as expansion targets with honest constraint audits. This is distinct from the GBP Management Suite's localPosts pipeline (`GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md` Subsystem 3) — that subsystem is the *pattern source*; this spec generalizes it.

**Referenced docs:**
- `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md` — the capability-module + scheduler-job precedent this spec clones
- `docs/SOCIAL_COMMERCE_INTEGRATION_PLAN.md` — Meta/TikTok *commerce* (catalog/shop/pixel) integration; orthogonal to posting
- `shared/tier-contract.json` — capability modules, tier order, `surface_files` manifest rules
- `docs/PLATFORM_GBP_GOOGLE_ADS_SPEC.md` — platform's own social handles; §2.4 overstates shipped code (claims `lib/pinterest/` — **does not exist**, corrected in §11)

---

## 1. Executive Summary & Strategic Vision

### 1.1 The Business Problem

The platform already moves merchant *catalogs* to Meta and TikTok (commerce sync) and publishes *GBP localPosts* on a scheduler — but a merchant's actual social presence (Facebook Page posts, Instagram content) is still manual, off-platform work. Merchants who pay for "we manage your Google presence" reasonably expect "we manage your social presence" — the GBP Suite's scheduled-posts UX is the proof-of-demand: the compose → schedule → publish → retry lifecycle is already built and entitled, just for a single destination.

### 1.2 The Platform Opportunity

Three convergent assets make this cheap to pilot:

1. **Meta OAuth infrastructure is already live** — `lib/meta/oauth.ts` (auth URL, code exchange, long-lived 60-day tokens, AES-256-GCM token encryption, revocation), `routes/meta-oauth.ts` (full endpoint set), `meta_oauth_accounts_list`/`meta_oauth_tokens_list` tables (already storing `business_id`, `catalog_id`, `instagram_account_id`). The merchant connect flow exists and is exercised by catalog sync every 6 hours.
2. **The posts pipeline pattern is proven** — `gbp_posts` lifecycle (`SCHEDULED` → `PUBLISHING` → `PUBLISHED`/`FAILED`), the 5-minute `gbpPostScheduler` job with per-tenant entitlement checks, stuck-row lease reclaim, and attempt caps, and the `gbp-customer.ts` route surface are a working template.
3. **The capability-module machinery is generic** — `gbp_management` demonstrated that a new module (`social_posting`) flows through tier flexible keys, BSaaS catalog SKUs, and admin grants with zero billing code. Enterprise already resolves every module via its flexible keys, so the pilot is free to grant.

### 1.3 Pilot Strategy — Meta First

**Ship Facebook Page posting + Instagram feed publishing behind one new capability module, expand to other platforms only after Meta pilot metrics land.**

| Decision | Rationale |
| :--- | :--- |
| Meta first | OAuth tables/routes/token encryption already live; one app covers FB Page + IG; merchant's existing connection needs only a **scope expansion re-auth**, not a new integration |
| IG included in pilot (not deferred) | `instagram_account_id` is already stored on `meta_oauth_accounts_list`; IG publishing is a two-step media-container API on the *same* token — marginal cost over FB-only is small, marketing value is large |
| TikTok deferred to Phase 2 | Existing TikTok OAuth is **TikTok Shop** (`auth.tiktok-shops.com`, `shop.*` scopes) — the Content Posting API (`open.tiktokapis.com`, `video.upload`) is a separate app, separate review, and posts to private (`SELF_ONLY`) accounts until audited. Not a scope bump; a new integration |
| LinkedIn / Pinterest / X deferred | No integration exists for any of them (the GBP/Ads spec's `lib/pinterest/` claim is wrong — see §11). Each is a greenfield OAuth app |

**Non-goal for v1:** social *inbox* (comments, DMs, review-style engagement). `pages_manage_engagement` and `instagram_manage_comments` are noted as Phase-3 scope candidates that would feed the existing Marketing Ops queue — `facebook` is already a first-class `scope_platform` enum value there (`marketing-ops.ts`, `MarketingOpsService.ts`, `marketingOpsReviewResponsePlatformPriority = {google:1, yelp:2, facebook:3, other:4}`), but that enum is currently a triage label with no ingestion behind it.

---

## 2. Platform Skill Alignment & Connective Tissues

| Platform Skill | Architectural Function | Role in Social Posting Suite |
| :--- | :--- | :--- |
| `three-tier-feature-gating` | Flexible/explicit/BSaaS resolution via `EffectiveCapabilityResolver` | Gates the new `social_posting` module keys (`social_posting_flexible`, `social_posting_meta`, `social_posting_instagram`, `social_posting_scheduler`) — identical mechanics to `gbp_management` |
| `bsaas-purchase-flow` | Saved-card recurring SKUs | `social_posting` module/features become purchasable SKUs — no new billing code |
| `multi-archetype-campaigns` | Multi-diagnostic galleries, campaign deliverables | Social posting is a natural DFY deliverable archetype (platform posts *for* the merchant under `gbp_managed_service`-style flagging) |
| `marketing-ops-category-tone` | Category tone presets | Tone input to the AI post-suggest prompt, same as GBP post suggest uses today |
| `alerts-and-notifications` | `CrmAlertService` signal-gated alerts | Publish-failure and token-expiry alerts to merchant + ops |
| `directory-presence-seed-claim` | Seed → claim lifecycle | Deferred: claimed seed merchants are a natural low-tier upsell surface for `social_posting_meta` |

---

## 3. Existing Codebase Connective Tissues

**Verified 2026-10-30.**

```
apps/api/src/
├── lib/meta/
│   ├── oauth.ts                  ◄── Auth URL, code exchange, long-lived token, AES-256-GCM
│   │                               encrypt/decrypt, revoke. META_SCOPES lacks posting scopes (§4.1)
│   └── feed-generator.ts         ◄── Catalog feed builder (commerce — unrelated to posting)
├── lib/tiktok/
│   ├── oauth.ts                  ◄── TikTok SHOP OAuth (auth.tiktok-shops.com; scopes
│   │                               user.info.basic, shop.product, shop.order, shop.product.stock)
│   │                               — NOT the Content Posting API. Separate product surface.
│   └── feed-generator.ts
├── lib/google/
│   └── gbp-post-suggest.ts       ◄── buildGbpPostSuggestPrompt + GBP_POST_SUGGEST_SYSTEM —
│                                   the AI-copy prompt builder pattern to generalize per platform
├── routes/
│   ├── meta-oauth.ts             ◄── /meta/oauth/{status,authorize,callback,disconnect,businesses,
│   │                               link-catalog}; /meta/catalog/{sync,sync-status}
│   ├── meta-webhooks.ts          ◄── Webhook receiver (product approvals, feed uploads, WhatsApp)
│   ├── tiktok-oauth.ts / tiktok-webhooks.ts  ◄── Shop-scoped; not reusable for content posting
│   ├── gbp-customer.ts           ◄── THE TEMPLATE: requireCustomerAuth + requirePlatformContext;
│   │                               GET/POST /posts, DELETE /posts/:id, media upload + gallery-assets
│   └── social-commerce-options-settings.ts ◄── Merchant soft-toggle settings route pattern
├── services/
│   ├── MetaCatalogSyncService.ts ◄── Token decryption + Graph API call pattern for Meta
│   ├── GBPAdvancedSync.ts        ◄── createPost() publisher shape (persist:false job-mode flag)
│   ├── resolvers/
│   │   ├── GbpManagementResolver.ts        ◄── module resolver to mirror (flexible || feature key)
│   │   └── SocialCommerceOptionsResolver.ts◄── hard-gate/soft-gate merge pattern
│   └── permissions/PermissionServiceFactory.ts ◄── hasFeature(tenantId, key) runtime gate
├── jobs/
│   ├── gbpPostScheduler.ts       ◄── 5-min scheduler: entitlement cache (60s TTL), PUBLISHING
│   │                               lease reclaim (15min), MAX_ATTEMPTS=3 — clone target
│   ├── meta-catalog-sync.ts      ◄── 6h per-tenant loop w/ BATCH_DELAY rate-limit spacing
│   └── oauth-token-refresh.ts    ◄── Existing token refresh sweep — Meta page tokens join here
└── prisma/schema.prisma
    ├── meta_oauth_accounts_list (:3258) ◄── tenant_id, business_id, catalog_id,
    │                                      instagram_account_id, scopes[] — needs page fields (§6)
    ├── meta_oauth_tokens_list  (:3279) ◄── single user-level token row per account —
    │                                      page-scoped tokens need a new relation (§6)
    └── gbp_posts               (:2589) ◄── lifecycle shape to generalize (NOT extend in place —
                                          GBP-specific columns argue for a sibling social_posts)

apps/web/src/
├── app/t/[tenantId]/settings/integrations/google/advanced/page.tsx
│                                   ◄── GBP posts composer UI w/ suggest/schedule/recurrence —
│                                       layout template for the social composer (new route sibling)
└── (no Meta/TikTok merchant surface exists — integrations UI is Google-only today)
```

**Web-side gap (verified):** there is no merchant-facing Meta connection UI — the OAuth endpoints exist API-side, but catalog sync linkage is the only consumer. The pilot includes the connect-card + composer surface, not just the backend.

---

## 4. Functional Architecture & Subsystems

### Subsystem 0: Meta Scope Expansion & Page Token Graph (PREREQUISITE)

The gating technical fact: **today's Meta connection cannot post.** `META_SCOPES` in `lib/meta/oauth.ts` requests commerce scopes only.

#### Scope delta

| Scope | Today | Needed for | Meta review tier |
| :--- | :---: | :--- | :--- |
| `catalog_management`, `business_management`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights` | ✅ | (existing commerce) | — |
| `pages_manage_posts` | ❌ | Publish/delete FB Page posts | **Advanced Access — app review required** |
| `instagram_content_publish` | ❌ | IG media containers + publish | **Advanced Access — app review required** |
| `pages_manage_engagement` | ❌ | (Phase 3: comments/replies into Marketing Ops) | Advanced Access — defer |
| `instagram_manage_comments` | ❌ | (Phase 3) | Advanced Access — defer |

#### Token model

FB posting uses **Page access tokens**, not the user token stored today:

```
user token (existing meta_oauth_tokens_list)
   └── GET /me/accounts → [{ id, name, access_token(Page), instagram_business_account }]
        ├── Page token  → POST /{page-id}/feed, /{page-id}/photos, /{page-id}/videos
        └── IG business account id (already stored) → POST /{ig-user}/media → /{ig-user}/media_publish
```

Page tokens derived from a long-lived user token **never expire** — store per-page rows rather than refreshing. User-token expiry (60 days) still breaks the graph at renewal time; the existing `oauth-token-refresh` sweep must extend to Meta, and `meta_oauth_tokens_list.scopes` must diff against the new `META_SCOPES` to flag `reauthorization_required` for pre-expansion connections.

#### Functional workflow

1. Admin scopes `META_SCOPES` to include `pages_manage_posts`, `instagram_content_publish`.
2. Existing connections: status endpoint reports `scopesMissing: ['pages_manage_posts', …]` → merchant re-auths (same `/meta/oauth/authorize` flow; new token overwrites).
3. New connections: post-callback step calls `getBusinessAccounts` + `/me/accounts` → merchant picks **one Page** (v1 constraint) → page token encrypted via existing `encryptToken` → stored on new `meta_page_connections` table; `instagram_account_id` resolves through the page's `instagram_business_account`.
4. Disconnect must delete page rows and (policy cleanliness) call `revokeToken`.

---

### Subsystem 1: Unified Post Entity & Platform Adapters

`gbp_posts` is GBP-shaped (`topic_type`, `call_to_action_type`, `event_*`, `offer_*`, `post_name` resource name). Rather than overload it, introduce **`social_posts`** — a normalized cross-platform entity with a `platform` discriminator and a `platform_payload` JSON escape hatch:

| Normalized field | FB Page mapping | IG mapping | GBP equivalent (for reference) |
| :--- | :--- | :--- | :--- |
| `body` (text, ≤63,206 chars FB / ≤2,200 IG) | `message` | `caption` | `summary` |
| `link_url` | `link` | n/a (link-in-bio note; URLs not clickable in captions) | `call_to_action_url` |
| `media[]` (url + type photo\|video + alt) | `/photos` batch or `/videos` | `media_type` IMAGE/VIDEO/REELS + container `media_url` | `media_url` |
| `platform_payload` JSON | `published`, `scheduled_publish_time` | `media_type`, `caption` extras | topic/event/offer structs |
| `target_ref` | `page_id` | `ig_user_id` | `location_id` |

**IG hard constraint:** the Content Publishing API requires media at a **publicly fetchable URL** — the existing GBP media-upload + gallery-assets pipeline (public URLs already) is the media source; no private-asset signing work needed.

**Adapter interface** (mirrors `GBPAdvancedSync.createPost` + `persist:false` job-mode):

```ts
interface SocialPlatformAdapter {
  platform: 'meta_facebook' | 'meta_instagram' | 'tiktok' | 'linkedin' | 'pinterest' | 'x';
  validateDraft(post: SocialPost): string[];            // per-platform lint (length, media rules)
  publish(tenantId: string, post: SocialPost):          // returns remote id + permalink
    Promise<{ success: boolean; remoteId?: string; permalink?: string; error?: string; status?: number; retryAfterMs?: number }>;
  delete?(tenantId: string, remoteId: string): Promise<boolean>;
}
// implementations: lib/social/meta-facebook.ts, lib/social/meta-instagram.ts (v1)
//                  lib/social/tiktok.ts, lib/social/linkedin.ts, lib/social/pinterest.ts (Phase 2+)
```

---

### Subsystem 2: Scheduler & Publisher Lifecycle

Clone `gbpPostScheduler.ts` almost mechanically:

- New job `socialPostScheduler` — 5-min cadence, `scheduleJob`/`stopJob` registry, `STARTUP_DELAY_MS` stagger.
- Same lifecycle: `SCHEDULED` (due) → `PUBLISHING` (claim, `publishing_started_at`) → `PUBLISHED`/`FAILED`; `PUBLISHING` rows older than 15-min lease are reclaimed; `MAX_ATTEMPTS = 3`; `attempts`/`last_error` columns.
- Same entitlement shape: `hasFeature(tenantId, 'social_posting_scheduler')` with the 60s entitlement cache. Immediate-publish stays free within the module — only *scheduling* is the premium key (exactly the GBP split).
- **Addition over the GBP template:** per-platform dispatch — the due-post query fans out to the adapter registry by `post.platform`; one platform's outage marks its rows `FAILED` without blocking others.
- Rate-limit hygiene: `retryAfterMs` honored from adapter result (GBPAdvancedSync already returns this); per-tenant `BATCH_DELAY_MS` between publishes, mirroring `meta-catalog-sync`.

---

### Subsystem 3: AI Copy Assist (dual pattern — render + resolve)

The GBP post suggest endpoint was just extended (2026-10-30) with the marketing-ops dual pattern: `renderOnly` returns the built prompt + system message for the merchant's own LLM; otherwise the platform resolves via `aiProviderFactory`. Social posts adopt this verbatim:

- `lib/social/social-post-suggest.ts` — `buildSocialPostSuggestPrompt({platform, businessName, category, photoDescription, tone, theme, cta, linkUrl})` + `SOCIAL_POST_SUGGEST_SYSTEM`, with platform-conditioned length/format constraints injected into the prompt (IG ≤2,200 chars + hashtag block; FB conversational; LinkedIn professional).
- `POST /api/social/posts/suggest` with the same `renderOnly` contract — one endpoint, `platform` param selects the prompt variant.
- Composer UI gets the same three controls just shipped for GBP: **Suggest** (internal), **Copy prompt** (render + clipboard), **Import** (paste external output back).

### Subsystem 4: Media Pipeline

- Reuse the `gbp-customer.ts` media routes' pattern for social: `POST /api/social/media/upload` (multer, size/mime guards) + `GET /api/social/media/gallery-assets` (reuse tenant gallery library as post attachments — the cross-pollination that made GBP media cheap).
- Storage lands wherever GBP media lands today (public URL is an IG API *requirement* — confirm the gallery-assets URL form is publicly fetchable before Phase 1 exits; this is a verification gate, not new infra).

### Subsystem 5: Insights & Webhook Surface (minimal in v1)

- Extend `meta-webhooks.ts` switch to log `feed`-field events (reactions/comments counts) — **ingest-only** in v1; no inbox UI.
- Publish-status truth stays pull-based: adapter `publish()` result + optional `GET /{post-id}` reconciliation sweep (cheap; deferred if Phase 1 ships clean).

### Subsystem 6: TikTok (Phase 2 — separate integration, not a scope bump)

Honest assessment, verified against `lib/tiktok/oauth.ts`: the existing integration is **TikTok Shop** (`auth.tiktok-shops.com`, `open.tiktokglobalshop.com`, `shop.*` scopes) — seller commerce, no content surface. TikTok content posting needs:

- A **separate developer app** on the TikTok for Developers platform (not the Shop partner app), scopes `user.info.basic`, `video.upload`, `video.publish`.
- **API audit before public posting:** unaudited apps can only post `SELF_ONLY` (private) videos — meaning a merchant-visible "post to TikTok" button literally cannot function publicly until TikTok approves the app. This is a weeks-scale external dependency with rejection risk.
- Video-first UX: TikTok has no text post; the composer needs a video-required validation branch the unified entity already accommodates via `adapter.validateDraft()`.

**Recommendation:** do not start the TikTok app-audit process until Meta pilot has ≥N active posting tenants (gate on evidence, not enthusiasm).

### Subsystem 7: LinkedIn / Pinterest / X (Phase 3+)

| Platform | API | OAuth | Posting surface | Notable constraint |
| :--- | :--- | :--- | :--- | :--- |
| LinkedIn | `api.linkedin.com/v2/ugcPosts` | New app; `w_member_social` (member) / `w_organization_social` (page) | Personal profile or Company Page | Org-page posting requires the merchant to be a page admin; token 60d refresh |
| Pinterest | `api.pinterest.com/v5/pins` | New app; `pins:write`, `boards:read` | Pins to boards | Standard access tier is free but rate-limited; board picker UX needed |
| X (Twitter) | `api.x.com/2/tweets` | OAuth 2.0 PKCE; `tweet.write`, `offline.access` | Text + media posts | **Paid API tier required for write access** — real per-tenant economics question; likely last |

None of these have any code presence today — each adapter is a new `lib/<platform>/oauth.ts` + adapter implementation behind the same `social_posts` entity and scheduler.

---

## 5. Capability Gate & RBAC Architecture

*(Aligned with `gbp_management` §6 precedent and `shared/tier-contract.json` fixture-first rules.)*

### 5.1 Capability Module Design

```
Capability Type (module): social_posting   ← "Social Suite" in product/marketing surface
  ├── Feature: social_posting_enabled        — module on/off baseline (mirrors *_enabled convention)
  ├── Feature: social_posting_flexible       — grants ALL module features
  ├── Feature: social_posting_meta           — Facebook Page posting
  ├── Feature: social_posting_instagram      — Instagram content publishing
  ├── Feature: social_posting_scheduler      — scheduled queue + lifecycle (vs. immediate-publish only)
  └── (Phase 2+: social_posting_tiktok, social_posting_linkedin, social_posting_pinterest, social_posting_x,
       social_posting_engagement — registered as built, per contract fixture-first rule)
```

### 5.2 Tier Contract Work (fixture-first — required by contract suites)

Per `AGENTS.md` tier/capability contract rules, **the fixture is edited before code**:

1. `shared/tier-contract.json` — add `social_posting` module keys under `capability_modules` (hand-edit the key list *shape* is generated — so: add keys to `features_list` source data, re-dump DB witness via `scripts/dump-tier-contract.cjs` on prd, then `node apps/api/scripts/sync-fixture-modules.cjs`).
2. Any new file declaring `TIER_*` maps / `DEFAULT_TIER` must be registered in `surface_files` — the new resolver `SocialPostingResolver.ts` and settings route will likely need `asserted`/`covered` entries.
3. Registration mirrors `gbp_management` §6.3 exactly: `features_list` inserts → `capability_features_list` module link → `tier_features_list` assignment → optional BSaaS SKUs.

### 5.3 Tier Assignment Proposal

| Tier | `social_posting` assignment | Rationale |
| :--- | :--- | :--- |
| `directory_presence`, `discovery`, `presence`, `storefront` | none (BSaaS-purchasable) | Posting is an upsell, not a gateway feature — same posture as GBP Pro vs. the claimed-portal free core |
| `commitment`, `ecommerce`, `omnichannel` | `social_posting_meta` explicit (no scheduler) | Matches `social_commerce_meta_catalog` enablement on ecommerce/omnichannel today |
| `professional`, `organization`, `chain_professional` | `social_posting_flexible` | Same tiers carry `social_commerce_flexible` + `gbp_management_flexible` in the prd witness |
| `enterprise`, `chain_enterprise` | `social_posting_flexible` (inherited/bundled) | Enterprise already resolves all modules — the pilot's free entitlement surface |

### 5.4 Expiry & Entitlement Boundary

Same semantics as GBP Suite §6.6: purchase expiry stops *new* post creation immediately; `SCHEDULED` rows whose `scheduled_for` passed while entitled still publish; `PUBLISHED` posts remain live on Meta (not retractable via entitlement); disconnecting Meta revokes nothing already published.

---

## 6. Database Schema Extensions

New migrations (next available: **370**; `database/migrations/369_gbp_access_lifecycle.sql` is latest).

| Migration | File | Purpose |
| :--- | :--- | :--- |
| 370 | `370_social_posting_tables.sql` | `social_posts` + `meta_page_connections` |
| 371 | `371_meta_oauth_posting_columns.sql` | `meta_oauth_accounts_list`: add `page_scopes_granted_at`, `reauthorization_required`; `meta_oauth_tokens_list`: add `scopes_missing` cache or compute live |
| 372 | `372_social_posting_features.sql` | `features_list` + `capability_features_list` + `tier_features_list` registration rows (§5.3) |

```sql
-- 370 core shape (naming follows gbp_posts conventions)
CREATE TABLE social_posts (
  id                    VARCHAR(50) PRIMARY KEY,
  tenant_id             VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform              VARCHAR(24) NOT NULL,          -- meta_facebook | meta_instagram | tiktok | linkedin | pinterest | x
  target_ref            VARCHAR(255),                  -- page_id / ig_user_id / board_id
  body                  TEXT NOT NULL,
  link_url              TEXT,
  media                 JSONB,                         -- [{url, type, alt}]
  platform_payload      JSONB,                         -- adapter-specific extras
  status                VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  scheduled_for         TIMESTAMPTZ(6),
  published_at          TIMESTAMPTZ(6),
  remote_post_id        VARCHAR(255),
  permalink             TEXT,
  attempts              INT NOT NULL DEFAULT 0,
  last_error            TEXT,
  publishing_started_at TIMESTAMPTZ(6),
  batch_id              VARCHAR(64),
  recurrence            JSONB,
  created_by            VARCHAR(12) NOT NULL DEFAULT 'tenant',
  approved_by           VARCHAR(50), approved_at TIMESTAMPTZ(6),
  created_at            TIMESTAMPTZ(6) DEFAULT now(),
  updated_at            TIMESTAMPTZ(6) DEFAULT now()
);
CREATE INDEX idx_social_posts_due ON social_posts (status, scheduled_for);
CREATE INDEX idx_social_posts_tenant ON social_posts (tenant_id, status);
CREATE INDEX idx_social_posts_platform ON social_posts (platform);

CREATE TABLE meta_page_connections (
  id                       VARCHAR(50) PRIMARY KEY,
  meta_oauth_account_id    VARCHAR(50) NOT NULL REFERENCES meta_oauth_accounts_list(id) ON DELETE CASCADE,
  page_id                  VARCHAR(64) NOT NULL,
  page_name                VARCHAR(255),
  page_access_token_enc    TEXT NOT NULL,              -- encryptToken() format: iv:authTag:ct
  ig_user_id               VARCHAR(64),                -- denormalized from page's instagram_business_account
  ig_username              VARCHAR(255),
  created_at               TIMESTAMPTZ(6) DEFAULT now(),
  updated_at               TIMESTAMPTZ(6) DEFAULT now(),
  UNIQUE (meta_oauth_account_id, page_id)
);
```

Merchant soft-gate settings (per `add-capability-feature` §3 pattern): a `tenant_social_posting_settings` table (or JSONB column on an existing settings table — decide at build; precedent favors a dedicated table) holding `social_posting_enabled`, per-platform display toggles, default posting times. **Every settings PUT must call `invalidateEffectiveCapabilities(tenantId)`.**

---

## 7. API Route Endpoints Contract

New file `apps/api/src/routes/social-customer.ts`, mounted beside `gbp-customer.ts`, identical auth stack (`requireCustomerAuth`, `requirePlatformContext`).

| Method & Path | Function | Gate |
| :--- | :--- | :--- |
| `GET /api/social/status` | Connection status per platform: connected, page selected, scopes granted/missing, `reauthorization_required` | customer auth |
| `GET /api/social/meta/pages` | List available FB Pages + linked IG accounts (drives the picker) | `social_posting_meta` |
| `POST /api/social/meta/select-page` | Persist page choice → `meta_page_connections` row (fetch + encrypt page token) | `social_posting_meta` |
| `GET /api/social/posts` | List posts (paginated; filter `platform`, `status`) | module enabled |
| `POST /api/social/posts` | Create post: immediate publish OR `scheduled_for` → `SCHEDULED`; adapter `validateDraft` lint first | module enabled; `social_posting_scheduler` when `scheduled_for` present; per-platform key (`social_posting_meta`/`_instagram`) by `platform` |
| `DELETE /api/social/posts/:id` | Cancel `SCHEDULED`/`DRAFT`; best-effort remote delete for `PUBLISHED` where adapter supports | module enabled |
| `POST /api/social/posts/suggest` | Dual-pattern AI copy (`renderOnly` → prompt; else resolve) — `platform` param selects variant | module enabled |
| `POST /api/social/media/upload` + `GET /api/social/media/gallery-assets` | Post media, public URL | module enabled |

OAuth surface changes to `meta-oauth.ts`: `GET /meta/oauth/status` response gains `postingScopes: {granted:[], missing:[]}`; no new OAuth routes needed — authorize/callback already parameterized by `META_SCOPES`.

---

## 8. External Dependencies & Review Requirements

| Dependency | Status | Risk |
| :--- | :--- | :--- |
| Meta App Review — Advanced Access for `pages_manage_posts` + `instagram_content_publish` | **Not started** — screencast + business verification + use-case description | **The schedule long pole.** Existing `META_APP_ID` already passed commerce review, which helps; still weeks-scale. Start before code, not after |
| Existing tenant re-auth | Scope diff → `reauthorization_required` flag → banner in composer | Low (same flow re-run) |
| IG public media URL | Verify gallery-assets URLs are unauthenticated | Verification gate §10 |
| TikTok app audit (Phase 2) | Not started | `SELF_ONLY`-only until approved — do not build before approval path is understood |
| LinkedIn/Pinterest/X apps (Phase 3) | Not started | X requires paid API tier — revisit unit economics |

---

## 9. Phased Implementation Roadmap

| Phase | Scope | Exit criteria |
| :--- | :--- | :--- |
| **0. Meta app review kickoff** (external, parallel) | Submit `pages_manage_posts` + `instagram_content_publish` for Advanced Access; prep screencast of composer UX (can demo in dev mode) | Approved or in-review with no blockers |
| **1. Meta pilot** | Migrations 370–372; `meta_page_connections`; scope expansion + reauth flag; `social_posts` + FB Page adapter; scheduler job; `social-customer.ts`; composer UI (clone GBP advanced page structure); `SocialPostingResolver`; contract fixture updates | A test tenant schedules a FB post, job publishes it, permalink recorded; entitlement OFF → scheduler skips; `pnpm checkapi`/`checkweb`/vitest green; contract suites green |
| **1.5. Instagram** | IG adapter (container two-step), media pipeline verification, `social_posting_instagram` key | IG photo post publishes from same composer |
| **2. Pilot bake + evaluate** | ≥N tenants posting (set N with Product); failure-rate dashboard via existing job logs; decide TikTok audit go/no-go | Go/no-go doc |
| **3. Expansion** | TikTok (post-audit), LinkedIn, Pinterest, X per §4.7 table; `pages_manage_engagement` → Marketing Ops queue ingestion | Per-platform adapters behind registry |

**Web surface:** new `apps/web/src/app/t/[tenantId]/settings/integrations/social/` page tree — Meta connect card (mirroring `GoogleConnectCard`), page picker, composer reusing the GBP advanced-page layout + the suggest/copy-prompt/import controls shipped 2026-10-30. A platform-overview post calendar is a Phase-1 stretch, not a blocker.

---

## 10. Verification & Quality Gates

- **Contract suites:** `tier-*`, `mv-shape-lint`, `tier-doc-generation` in `apps/api/src/services/__tests__/` must pass after fixture edits; regenerate doc blocks via `gen-tier-doc-blocks.cjs --write` if the module is surfaced in generated docs.
- **Typechecks:** `pnpm checkapi`, `pnpm checkweb`.
- **Unit tests:** resolver tests mirroring `GbpManagementResolver` coverage (flexible → all keys; explicit per-platform key; merchant soft-toggle AND); adapter `validateDraft` lint table-tests (IG caption length, media-required-for-IG, FB link posts); scheduler claim/lease/attempt-cap tests mirroring `gbpPostScheduler` behavior.
- **Render tests (web):** composer page via `renderToStaticMarkup` + `MantineProvider` pattern (AGENTS.md §Web component render tests); pin page-picker options and the suggest/copy/import control presence.
- **Live gates (staging):** scope-diff reauth on an existing connection; page token retrieval; scheduled post fires within one scheduler interval; `pages_manage_posts` dev-mode post to a test page (dev mode bypasses Advanced Access for app-role users — pilot can dogfood before review completes, which is also how the Phase-0 screencast gets recorded).

---

## 11. Current-State Audit Baseline (verified 2026-10-30)

| Claim | Verified state |
| :--- | :--- |
| Meta OAuth/token storage | ✅ `lib/meta/oauth.ts`, `meta_oauth_accounts_list`/`_tokens_list`, `routes/meta-oauth.ts` live |
| Meta posting scopes | ❌ `META_SCOPES` = commerce-only; no `pages_manage_posts`/`instagram_content_publish` |
| Page access token storage | ❌ Single user-token row; no page entity |
| Any social *posting* code | ❌ `pages_manage_posts`/`instagram_content_publish`/`feed`-publish greps return nothing |
| GBP posting pipeline | ✅ `gbp_posts` + `gbpPostScheduler` + `GBPAdvancedSync.createPost` + `gbp-customer.ts` — the clone source |
| AI post suggest | ✅ `lib/google/gbp-post-suggest.ts` + dual render/resolve pattern (extended 2026-10-30) |
| TikTok content posting | ❌ Existing integration is Shop-only (`auth.tiktok-shops.com`, `shop.*` scopes) |
| LinkedIn/Pinterest/X | ❌ No code. `PLATFORM_GBP_GOOGLE_ADS_SPEC.md` §2.4's `lib/pinterest/` claim is **wrong** — flag for spec correction |
| Enterprise entitlement | ✅ `social_commerce_flexible` enabled on `enterprise`/`organization`/`professional`/`chain_professional` in prd witness; `social_posting_flexible` will flow identically |
| Meta App Review for posting scopes | ❌ Not started — Phase 0 kickoff |
