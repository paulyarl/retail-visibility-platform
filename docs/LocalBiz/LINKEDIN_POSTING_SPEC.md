# LinkedIn Company Page Posting — Expansion Spec

**Status:** DRAFT v0.1 — for review
**Owner:** Product (with Engineering sign-off on OAuth app + Community Management API path)
**Date:** 2026-11-06
**Scope:** Add **LinkedIn Company Pages** as a posting target in the Social Posting Suite — connect a LinkedIn identity, pick administered organization pages, and publish/schedule posts through the existing `social_posts` + `socialPostScheduler` pipeline. **Company pages only in v1** — member-profile posting is a documented alternative, not a build item (§11).

**Referenced docs:**
- `docs/LocalBiz/SOCIAL_POSTING_SUITE_SPEC.md` — the parent spec this expands (§4.7 Subsystem 7 row; Phase 4 roadmap). **Correction to its §4.7 LinkedIn row:** it cites `api.linkedin.com/v2/ugcPosts` — that surface is legacy; the live posting surface is `POST /rest/posts` (§2).
- `docs/VISIBLESHELF_INTERNAL_TENANT_SPEC.md` — dogfood tenant `tid-sud4ky1c`; platform owns `linkedin.com/company/visibleshelf` (claimed/live per `PLATFORM_GBP_GOOGLE_ADS_SPEC.md` §3.7)
- `shared/tier-contract.json` — fixture-first rules for the new `social_posting_linkedin` key

---

## 1. Executive Summary

LinkedIn is the cheapest remaining expansion target on the §4.7 table and the one that proves the suite's "write once → every surface" claim beyond Meta: **X costs money per call, Pinterest is a different post shape (pins/boards), TikTok is gated on an app audit.** LinkedIn is the same shape as Meta — text/link/media post, OAuth bearer token, per-surface lint — so nearly every piece of the pilot generalizes cleanly:

| Already generic (zero/small work) | Genuinely new |
| :--- | :--- |
| `social_posts` entity — `platform` accepts `'linkedin'` (already in the `SocialPlatform` union + migration-370 comment) | LinkedIn OAuth app + flow (`lib/linkedin/oauth.ts`) |
| `socialPostScheduler` — dispatches by `getSocialAdapter(platform)`; no scheduler changes | LinkedIn developer app + Community Management API product approval |
| Adapter registry — drop in `linkedinAdapter` | OAuth account + org-page surface tables (migration 376) |
| Capability module machinery — `social_posting` + flexible key covers new keys automatically | `social_posting_linkedin` feature key + resolver fields |
| Composer multiplex (`content-posts.ts`) + `ContentComposer` chip row | `destinations.linkedin` branch + connect UI |
| Media pipeline (`social_media` public URLs) | **Media upload path differs** — LinkedIn needs binary push, not a public URL (§4.2) |
| `metaTokenRefresh` job pattern | LinkedIn refresh-token leg (member tokens expire ~60d) |

Strategic note: the platform's own `linkedin.com/company/visibleshelf` page doubles as the **developer-app host page** (LinkedIn apps must be associated with a Page, verified by a Page admin) *and* the dogfood surface — the recursive proof point from §1.3 of the parent spec extends with zero new accounts.

---

## 2. LinkedIn API Audit (verified 2026-11-06)

### Posting surface

| Item | Reality |
| :--- | :--- |
| Endpoint | `POST https://api.linkedin.com/rest/posts` — **not** `v2/ugcPosts` (legacy/replaced) |
| Mandatory headers | `Linkedin-Version: {YYYYMM}` + `X-Restli-Protocol-Version: 2.0.0` on **every** call. LinkedIn ships a new version monthly; each is supported ~12 months then sunset. Pin `LINKEDIN_API_VERSION` in config and calendar the bump |
| Author | `author: "urn:li:organization:{id}"` for company-page posts |
| Body | `commentary` (≤ ~3000 chars), `visibility: "PUBLIC"`, `distribution.feedDistribution: "MAIN_FEED"`, `lifecycleState: "PUBLISHED"`, `isReshareDisabledByAuthor`, `content` block for article/image/multiImage/video |
| Link post | `content.article: { source, thumbnail?, title?, description? }` |
| Image post | **Two-step, server-side binary** — `POST /rest/images?action=initializeUpload` → `PUT` bytes to returned `uploadUrl` → `urn:li:image:*` URN → `content.media.id` (single) or `content.multiImage.images[]` (≤9). LinkedIn does **not** fetch a public URL like Meta does — the adapter downloads our `social_media.public_url` and pushes bytes |
| Video | Videos API `initializeUpload` + chunked upload — **deferred to v1.1** (multi-part protocol; text/link/image covers the composer today) |
| Delete | `DELETE /rest/posts/{postUrn}` — `remote_post_id` stores the post URN returned in `x-restli-id`; permalink constructible as `https://www.linkedin.com/feed/update/{urn}` |
| Page roles | Posting requires the connecting member to hold `ADMINISTRATOR`, `CONTENT_ADMIN` (wire value `CONTENT_ADMINISTRATOR`), or `DIRECT_SPONSORED_CONTENT_POSTER` on the page |

### OAuth & access program

| Item | Reality |
| :--- | :--- |
| Auth URL | `https://www.linkedin.com/oauth/v2/authorization` — standard `code` grant, no PKCE required server-side |
| Token exchange | `POST https://www.linkedin.com/oauth/v2/accessToken` (form-encoded) |
| Member identity | OIDC `GET /v2/userinfo` → `sub` claim (person id) — request `openid` + `profile` |
| Scopes | `openid`, `profile`, `w_organization_social` (post as org), `rw_organization_admin` (discover administered pages), `r_organization_social` (read posts — reconcile/permalink checks) |
| Page discovery | `GET /rest/organizationAcls?q=roleAssignee` (+ `role`/`state` filters, org projection for names) → list of pages the member can post to |
| Token lifetime | Access token **~60 days**; refresh token issued alongside (~1yr validity) when the product grants it → `grant_type=refresh_token` returns fresh access (+rotated refresh). Same `<7d`-threshold sweep shape as `metaTokenRefresh` |
| App requirement | LinkedIn developer app **associated with a company page** and verified by a Page admin → use `linkedin.com/company/visibleshelf` |
| Product requirement | Org-page posting needs the **LinkedIn Community Management API** product. Two tiers: **Development** (~500 calls/app/day, 100 calls/member/app/day — fine for pilot/dogfood) and **Standard** (LinkedIn review w/ screencast — the GA long pole, same posture as Meta App Review) |

---

## 3. Architecture Fit

```
linkedin_oauth_accounts_list (member identity: sub, name, tokens, expiry, scopes)
   │
   └── linkedin_surface_connections (one row per selected org page)
         surface = 'organization_page', target_ref = 'urn:li:organization:{id}'

social_posts row (platform='linkedin', target_ref=org URN)
   └── socialPostScheduler ──▶ linkedinAdapter.publish()
         └── resolveSurface(tenantId, 'linkedin', targetRef) ──▶ member token
```

**Why a sibling connection table, not `meta_surface_connections`:** that table is FK'd to `meta_oauth_accounts_list` — it is Meta-identity-scoped by construction. LinkedIn gets a parallel pair (`linkedin_oauth_accounts_list` + `linkedin_surface_connections`) so each provider's "platform profile" stays self-contained. Two honest divergences from the Meta shape:

- **Tokens are member-scoped, not surface-scoped.** One member token posts to every page they administer (`author` URN does the switching). Token lives on the **account** row; surface rows carry only `target_ref` + `display_name` — no per-surface `access_token_enc`.
- `social_posts.surface_connection_id` stays **NULL** on linkedin rows (FK is meta-scoped); `target_ref` = `urn:li:organization:{id}` is the resolution key — same as Meta rows today, which resolve by `target_ref` anyway.

`resolveSurface` in `lib/social/surfaces.ts` gains a LinkedIn branch: `META_SURFACE_MAP` keeps serving meta platforms; `platform === 'linkedin'` joins `linkedin_surface_connections` → `linkedin_oauth_accounts_list` and returns the member token. The `ResolvedSurface` shape is unchanged.

---

## 4. Subsystems

### 4.0 LinkedIn OAuth (`lib/linkedin/oauth.ts` + connect legs)

Mirror `lib/social/threads-oauth.ts` — a self-contained OAuth module consumed by route legs in `social-customer.ts` (the Threads precedent: separate provider leg inside the customer route, not a top-level `*-oauth.ts` route file — LinkedIn has no commerce surface needing standalone routes like Meta's).

- `getLinkedInAuthorizationUrl(state)` — scope string `LINKEDIN_SCOPES = ['openid','profile','w_organization_social','rw_organization_admin','r_organization_social']`.
- `exchangeLinkedInCode(code)` → `{access_token, expires_in, refresh_token?, refresh_token_expires_in?}`.
- `getLinkedInUserinfo(token)` → `{sub, name, email, picture}`.
- `getAdministeredOrganizations(token)` → `GET /rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED` projected with `organization~(localizedName)` → `{urn, name, role}[]`. Note: the *posting-eligible* role set is wider than `ADMINISTRATOR` — query all roles and let the picker badge non-admin roles (CONTENT_ADMINISTRATOR / DIRECT_SPONSORED_CONTENT_POSTER can post; the spec's default filter is admin because that's the common merchant case).
- `refreshLinkedInToken(refreshToken)` → `grant_type=refresh_token` exchange.
- **Reuses `encryptToken`/`decryptToken` from `lib/meta/oauth.ts`** — flag: generic AES-256-GCM token crypto lives in a Meta-named module; import it (like `surfaces.ts` already does) and leave extraction to `lib/crypto/` as optional cleanup, not a blocker.

Env: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`, `LINKEDIN_API_VERSION` (e.g. `202511`) → `unifiedConfig` getters + Doppler entries.

### 4.1 Platform profile & connect flow

```
GET  /linkedin/authorize        → state{tenantId,nonce,ts} → LinkedIn consent URL
GET  /linkedin/callback         → exchange → userinfo → upsert linkedin_oauth_accounts_list
                                   → redirect /settings/integrations/social?connected=linkedin
GET  /linkedin/organizations    → ACL discovery → pages the member can post to
POST /linkedin/select-surface   → {targetRef: 'urn:li:organization:123'} → surface row
DELETE /linkedin/surfaces/:id   → disconnect one page (per-surface, Threads precedent)
```

Same UX rules as Meta profile: surfaces resolve independently, per-surface disconnect, `reauthorizationRequired` surfaces as a banner when scopes/token lapse.

### 4.2 `linkedinAdapter` (`lib/social/linkedin.ts`)

| Normalized field | LinkedIn mapping |
| :--- | :--- |
| `body` (≤3000) | `commentary` |
| `link_url` | `content.article.source` (rich link post) — not appended to commentary |
| `media[]` | photo → Images API initialize+PUT → `content.media.id` / `content.multiImage`; video → **lint-rejected in v1** |
| `target_ref` | `author` URN (`urn:li:organization:{id}`) |
| `platform_payload` | `visibility`, `isReshareDisabledByAuthor`, `distribution` overrides |

`validateDraft`: body required ≤3000; media ≤9 photos, no video (v1), no mixed photo+video; link post + media → lint (article and media are exclusive content blocks). Return codes/permits map to existing `PublishResult` (`status`, `retryAfterMs` honored by scheduler already).

Publish: resolve surface → member token → (media? upload loop → URNs) → `POST /rest/posts` with pinned version header → `remoteId` from `x-restli-id` → `permalink` = `https://www.linkedin.com/feed/update/{urn}`.

Delete: `DELETE /rest/posts/{urn}` — adapter `delete()` implemented (LinkedIn supports it, unlike some Meta surfaces).

**Media divergence callout:** this is the first adapter where `media[].url` is consumed by *us*, not the platform — `social_media.public_url` bytes are fetched server-side then pushed to LinkedIn's `uploadUrl`. A ~30s extra step per image; failure modes (CDN 404, size limits — 8MB/image) become `PublishResult.error`, not scheduler exceptions.

### 4.3 Token refresh

New `linkedinTokenRefresh` job — same skeleton as `metaTokenRefresh` (6h sweep, refresh when `<7d` remain, encrypt on write): `linkedin_oauth_accounts_list` rows with `token_expires_at` inside the threshold → `refresh_token` grant → new access (+ rotated refresh) encrypted in place. On refresh failure set `reauthorization_required` (mirror `meta_oauth_accounts_list`). *Optional merge into a generalized `socialTokenRefresh` once a third provider lands — keep them separate now for blast-radius symmetry with `metaTokenRefresh`.*

### 4.4 Capability module

New key registered in migration **376** (next free number — two `375_` files exist):

```
social_posting_linkedin  — 'LinkedIn Company Page Posting' — publish to administered org pages
```

- `features_list` insert → `capability_features_list` link to `social_posting` module.
- **Tier assignment ships dark** (the migration-372 posture): flexible tiers resolve it automatically through `social_posting_flexible` (resolver computes `flexible || key`), explicit tier rows only at GA — no `tier_features_list` inserts in v1.
- `tenant_social_posting_settings` gains `social_posting_linkedin_on BOOLEAN DEFAULT true` — merchant soft toggle.
- Fixture work: add the key to `shared/tier-contract.json` sources → migration lands on prd → re-dump witness (`scripts/dump-tier-contract.cjs`) → `sync-fixture-modules.cjs` regenerates `capability_modules` (the 6-key list today grows to 7). Audit whether `SocialPostingResolver.ts`/new files need `surface_files` entries — the resolver currently isn't listed; if the contract guard required it, it would already be failing, so mirror whatever status it shipped with and check `tier-*`/`mv-shape-lint` suites stay green.

### 4.5 Resolver + types

`SocialPostingResolver` gains (identical mechanics to the three existing surfaces):

```ts
const canPostLinkedIn = moduleOn && (flexible || !!features.social_posting_linkedin);
const linkedinOn = merchantPrefs?.social_posting_linkedin_on !== false;
const linkedinEnabled = canPostLinkedIn && masterOn && linkedinOn;
```

`EffectiveSocialPosting` += `can_post_linkedin`, `linkedin_enabled`; `merchant_preferences` += `social_posting_linkedin_on`; `enabled` ORs in `canPostLinkedIn`. `SocialPostingMerchantSettings` += the toggle key.

---

## 5. Database Schema (migration 376 — `376_linkedin_posting.sql`)

```sql
CREATE TABLE linkedin_oauth_accounts_list (
  id                       VARCHAR(50) PRIMARY KEY,
  tenant_id                VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  linkedin_member_id       VARCHAR(64) NOT NULL,          -- OIDC sub
  display_name             VARCHAR(255),
  email                    VARCHAR(255),
  access_token_enc         TEXT NOT NULL,                 -- encryptToken() format
  refresh_token_enc        TEXT,                          -- nullable: dev-tier apps may not get one
  token_expires_at         TIMESTAMPTZ(6),
  refresh_token_expires_at TIMESTAMPTZ(6),
  scopes                   VARCHAR[] NOT NULL DEFAULT '{}',
  reauthorization_required BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, linkedin_member_id)
);
CREATE INDEX idx_linkedin_oauth_tenant ON linkedin_oauth_accounts_list (tenant_id);

CREATE TABLE linkedin_surface_connections (
  id                          VARCHAR(50) PRIMARY KEY,
  linkedin_oauth_account_id   VARCHAR(50) NOT NULL REFERENCES linkedin_oauth_accounts_list(id) ON DELETE CASCADE,
  surface                     VARCHAR(20) NOT NULL DEFAULT 'organization_page',
  target_ref                  VARCHAR(64) NOT NULL,        -- urn:li:organization:{id}
  display_name                VARCHAR(255),                -- page name
  member_role                 VARCHAR(40),                 -- ADMINISTRATOR | CONTENT_ADMINISTRATOR | ...
  connected_at                TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE (linkedin_oauth_account_id, surface, target_ref)
);
CREATE INDEX idx_linkedin_surfaces_account ON linkedin_surface_connections (linkedin_oauth_account_id);

ALTER TABLE tenant_social_posting_settings
  ADD COLUMN social_posting_linkedin_on BOOLEAN NOT NULL DEFAULT true;
```

No `social_posts` change — `platform VARCHAR(24)` and `target_ref VARCHAR(255)` already fit; `surface_connection_id` stays NULL (FK is meta-scoped — flagged §3, generalizing it is a later cleanup across providers, not this spec's job).

Then `prisma db pull`/`generate` per AGENTS.md, plus fixture regeneration (§4.4).

---

## 6. API Surface Changes

`social-customer.ts` (mounted `/api/customer/marketing/social`) gains the §4.1 legs; existing endpoints extend by enum/flag only:

| Endpoint | Change |
| :--- | :--- |
| `GET /status` | response gains `linkedin: {connected, reauthorizationRequired, organizations: [{id,targetRef,displayName,memberRole}]}` beside `meta` |
| `createPostSchema.platform` | enum += `'linkedin'`; `PLATFORM_SURFACE_KEY.linkedin = 'social_posting_linkedin'` |
| `GET /posts` | `platform=linkedin` filter works free |

`content-posts.ts` (content hub composer):

- `destinations` gains `linkedin: z.boolean().optional()`; the no-destinations guard ORs it in.
- New branch after the Meta loop: when `destinations.linkedin`, gate on `socialMod.linkedin_enabled` (+ `social_posting_scheduler` when `scheduledAt`), then **fan out to every connected org surface** — one `social_posts` row per `linkedin_surface_connections` row (`platform='linkedin'`, `target_ref`=org URN). Zero connected pages → `{channel:'linkedin', ok:false, error:'No connected LinkedIn page'}`. (A boolean that fans out per page matches the write-once model; per-page pickers in the composer are a v1.1 refinement.)

---

## 7. Web Surfaces

| Surface | Change |
| :--- | :--- |
| `ContentComposer.tsx` | LinkedIn chip beside the three `META_DESTINATIONS` — own flag (`linkedin` state) since it's not a Meta surface; gated on a `social_linkedin` channel card's `capability.enabled` (🔒 pattern); submits `destinations.linkedin` |
| `content-summary.ts` | New `social_linkedin` channel card (`rendersOn: ['LinkedIn']`, state/metrics from `social_posts` grouped by platform — reuse `socialByStatus` but per-platform counts; `state:'dark'` until granted, matching `social_meta`) |
| `apps/web/src/lib/content-hub.ts` | `ContentChannelCard` needs no type change; add `linkedin_enabled` passthrough if the card model stays `capability.enabled` |
| `account/marketing/social` page | `SURFACES` += `{platform:'linkedin', surface:'organization_page', label:'LinkedIn Page'}`; second profile card "LinkedIn" beside "Meta platform profile" (surfaces keyed off `status.linkedin`) |
| `SocialPostingService` (web) | `getStatus` type gains `linkedin`; `createPost.platform` union += `'linkedin'` |
| `settings/integrations` | LinkedIn connect card (mirrors Meta card) — authorize → org-page picker → selected pages list; or a link into the social posting page's connect legs. Pick whichever the integrations index already structures (Meta precedent: `settings/integrations/meta/page.tsx`) |

---

## 8. External Dependencies & Risks

| Dependency | Status | Risk |
| :--- | :--- | :--- |
| LinkedIn developer app + Page association | Not started | Low — `linkedin.com/company/visibleshelf` exists; a Page admin must verify the app association |
| Community Management API product | Not requested | **The schedule long pole** — Development tier allows real posting immediately under tight daily caps (500/app, 100/member); Standard tier needs LinkedIn review w/ screencast of the connect+composer flow. Dev tier unblocks dogfood; Standard is the GA gate — start the request before code, same as Meta App Review Phase 0 |
| `Linkedin-Version` header churn | Monthly versions, ~12mo support | Pin `LINKEDIN_API_VERSION`; add a quarterly version-bump task (or runtime warning if responses start rejecting the pinned version) |
| Refresh-token availability | Product-dependent | `refresh_token` may be absent on dev tier — `linkedin_oauth_accounts_list.refresh_token_enc` is nullable; absent refresh → rely on `reauthorization_required` + reauth UX instead of silent death |
| Member-scope token model | One token → all pages | Disconnect/revoke kills every org surface at once (per-surface disconnect only removes the surface row, not the grant — document on the card) |
| Scope approval semantics | `w_organization_social`/`rw_organization_admin` ride the product grant | Verify at app-config time which scopes the Community Management product actually exposes — if `rw_organization_admin` isn't granted, page discovery falls back to manual org-ID/URN entry on the connect card (documented fallback, keeps v1 unblocked) |

---

## 9. Phases

| Phase | Scope | Exit criteria |
| :--- | :--- | :--- |
| **0. LinkedIn app + product request** (external, parallel) | Create dev app under `visibleshelf` page; verify association; request Community Management API (Dev tier auto-grants); submit Standard-tier review w/ screencast once composer exists | Dev-tier product active — `w_organization_social` issues tokens |
| **1. Build** | Migration 376 + `prisma generate` + fixture sync; `lib/linkedin/oauth.ts`; `linkedinAdapter` + registry + `resolveSurface` branch; `linkedinTokenRefresh` job + index.ts registration; `social-customer` LinkedIn legs; `content-posts` linkedin branch; resolver + types + settings column; composer chip + channel card + profile card + connect UI; `unifiedConfig` + Doppler envs | `pnpm checkapi`/`checkweb`, vitest + contract suites green; surfaces.ts resolution test passes for linkedin |
| **2. Dogfood** | Admin-grant path already covers `tid-sud4ky1c` (its `social_posting_flexible` resolves the new key automatically); connect `linkedin.com/company/visibleshelf`; run the §3.5 weekly cadence through the scheduler | Real scheduled post publishes to the company page; `remote_post_id` + permalink on `social_posts`; one refresh cycle survives (or `reauthorization_required` observed correctly if dev tier issues no refresh token) |
| **3. GA** | Standard-tier approval → tier rows for `social_posting_linkedin` (propose: same explicit set as `social_posting_meta` — commitment/ecommerce/omnichannel — plus flexible already covered); BSaaS SKU; announcement | First merchant company-page post publishes |

---

## 10. Verification & Quality Gates

- **Unit:** adapter `validateDraft` table tests (3000-char cap, ≤9 images, video rejected in v1, link+media exclusivity); `resolveSurface` linkedin-branch test (account-token return, expired-token null, targetRef mismatch); resolver test additions mirroring the existing per-surface cases (flexible → linkedin on; explicit key; merchant toggle AND).
- **Scheduler:** dispatch test — a `platform='linkedin'` due row routes to `linkedinAdapter` and failure of a linkedin row doesn't block meta rows in the same pass (registry already proves this shape; pin it).
- **Render tests (web):** `ContentComposer` chip presence + lock state via `renderToStaticMarkup`; social page's LinkedIn profile-card row (`initialTab`-style props pattern per AGENTS.md).
- **Contract:** `tier-*`, `mv-shape-lint`, `tier-doc-generation` after fixture edits; `surface_files` audit per §4.4.
- **Typechecks:** `pnpm checkapi`, `pnpm checkweb`.
- **Live gates (stg → dogfood):** OAuth round-trip stores encrypted tokens; ACL discovery returns `visibleshelf` page; text-only post publishes + permalink lands; image post exercises the binary-upload path (the divergence no other adapter has); scheduled row fires within one interval; disconnect removes surfaces without touching `social_posts` history.

---

## 11. Non-goals & Open Alternatives

| Item | Disposition |
| :--- | :--- |
| **Member-profile posting** (`w_member_social` via the "Share on LinkedIn" product — *instant* approval, no Community Management review) | Alternative surface, not v1. If Standard-tier review drags, a `linkedin_member` platform + `social_posting_linkedin_member` key is a cheap interim that ships the whole pipeline minus org pages. Decide after Phase-0 timing is known |
| LinkedIn video upload | v1.1 — chunked Videos API; `validateDraft` lint-rejects today |
| LinkedIn comments/inbox/analytics | Same non-goal as the suite's §1 social-inbox deferral; `r_organization_social` is collected for reconcile only |
| Generalizing `meta_surface_connections`/`surface_connection_id` into provider-neutral tables | Deliberately deferred — two providers don't justify the migration churn; revisit when a third non-Meta provider (Pinterest/X) lands |
| X / Pinterest / TikTok | Unchanged — §4.7 of the parent spec stands |

---

## 12. Current-State Audit Baseline (verified 2026-11-06)

| Claim | Verified state |
| :--- | :--- |
| `linkedin` platform value | ✅ Pre-provisioned — `SocialPlatform` union (`lib/social/types.ts:14`), `social_posts.platform` comment (migration 370) |
| Any LinkedIn OAuth/posting code | ❌ None — no `lib/linkedin/`, no routes, no env keys (`LINKEDIN_*` greps empty); only display-name mentions on storefronts/branding |
| Scheduler dispatch by platform | ✅ `socialPostScheduler` → `getSocialAdapter(post.platform)` — new platform = registry line + adapter file |
| Composer fan-out | ✅ `content-posts.ts` multiplexes `destinations`; Meta branch is the LinkedIn template |
| Adapter + registry shape | ✅ `SocialPlatformAdapter` (`validateDraft`/`publish`/`delete`) + `META_SURFACE_MAP`; LinkedIn needs a parallel resolution branch (§3) |
| Token crypto | ✅ `encryptToken`/`decryptToken` in `lib/meta/oauth.ts` (reusable; Meta-named module — §4.0 note) |
| Token refresh precedent | ✅ `metaTokenRefresh` job — LinkedIn leg clones it (§4.3) |
| `social_posting` module + flexible resolution | ✅ Migration 372 + `SocialPostingResolver` — new key auto-resolves for flexible tiers |
| Merchant soft-toggle table | ✅ `tenant_social_posting_settings` — gains `social_posting_linkedin_on` column |
| Public media URLs | ✅ `social_media` pipeline exists — **but LinkedIn needs binary push, not URL ingest** (§4.2) |
| Dogfood host | ✅ `tid-sud4ky1c` (flexible resolves the new key automatically) + `linkedin.com/company/visibleshelf` (app host + post target) |
| LinkedIn Community Management access | ❌ Not requested — Phase 0 |
