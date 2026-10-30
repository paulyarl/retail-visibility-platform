# Social Posting Suite — Meta Pilot & Multi-Platform Expansion Spec

**Status:** DRAFT v0.3 — for review (v0.3: pilot is platform dogfood on `VisibleShelf Internal`; tenant GA gated on proof)
**Owner:** Product (with Engineering sign-off on the Meta scope-expansion path)
**Date:** 2026-10-30
**Scope:** Merchant-facing social media posting — compose, schedule, and publish posts to connected social platforms from the tenant portal. **Meta is the pilot platform — all three Meta surfaces (Facebook Page, Instagram, Threads) under one connected "platform profile".** TikTok, LinkedIn, Pinterest, and X are covered as expansion targets with honest constraint audits. This is distinct from the GBP Management Suite's localPosts pipeline (`GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md` Subsystem 3) — that subsystem is the *pattern source*; this spec generalizes it.

**Referenced docs:**
- `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md` — the capability-module + scheduler-job precedent this spec clones
- `docs/VISIBLESHELF_INTERNAL_TENANT_SPEC.md` — the platform's own dogfood tenant (`tid-sud4ky1c`, slug `shelfvisible`) — the Phase-1 host for this suite
- `docs/SOCIAL_COMMERCE_INTEGRATION_PLAN.md` — Meta/TikTok *commerce* (catalog/shop/pixel) integration; orthogonal to posting
- `shared/tier-contract.json` — capability modules, tier order, `surface_files` manifest rules
- `docs/PLATFORM_GBP_GOOGLE_ADS_SPEC.md` — platform's own social handles (§3.7: `@shelfvisible` on FB/IG/Threads/Pinterest/TikTok/X + `linkedin.com/company/visibleshelf` — all claimed/live); §2.4 overstates shipped code (claims `lib/pinterest/` — **does not exist**, corrected in §11)

---

## 1. Executive Summary & Strategic Vision

### 1.1 The Business Problem

The platform already moves merchant *catalogs* to Meta and TikTok (commerce sync) and publishes *GBP localPosts* on a scheduler — but a merchant's actual social presence (Facebook Page posts, Instagram content) is still manual, off-platform work. Merchants who pay for "we manage your Google presence" reasonably expect "we manage your social presence" — the GBP Suite's scheduled-posts UX is the proof-of-demand: the compose → schedule → publish → retry lifecycle is already built and entitled, just for a single destination.

### 1.1a The Visibility Ladder — why this is one product, not a new one

Everything the platform ships is a **surface a merchant's business appears on**. The product has always been surface coverage, not surface features:

```
products ──▶ storefront ──▶ directory ──▶ seeds (pre-listed presence)
    │            │             │
    └──── sync ──┴── Google surfaces: GMC/Shopping feed, SWIS, GBP profile,
                      GBP posts, GBP reviews
                                    │
                                    └──▶ social surfaces: FB Page, IG, Threads …
                                         (TikTok, LinkedIn, Pinterest, X)
```

- **Seeds** put the merchant on `/directory` before they know the platform exists — visibility *precedes* the merchant's first action.
- **Storefront + products** give that presence a transaction layer.
- **GMC/SWIS** pushes the catalog onto Google's shopping surfaces.
- **GBP Suite** automates the profile surface — posts, reviews, NAP, media.
- **Social Posting** is the next rung of the *same ladder*, not an adjacent product: the merchant's updates, offers, and events broadcast to the surfaces where customers actually scroll.

The strategic claim from `ULTIMATE_VALUE_PROPOSITION.md` — "Broadcast your shelf to the world" — reads literally here. Every surface added makes each merchant asset (a product, a post, a review reply) work harder without new merchant effort.

### 1.2 The Platform Opportunity

Three convergent assets make this cheap to pilot:

1. **Meta OAuth infrastructure is already live** — `lib/meta/oauth.ts` (auth URL, code exchange, long-lived 60-day tokens, AES-256-GCM token encryption, revocation), `routes/meta-oauth.ts` (full endpoint set), `meta_oauth_accounts_list`/`meta_oauth_tokens_list` tables (already storing `business_id`, `catalog_id`, `instagram_account_id`). The merchant connect flow exists and is exercised by catalog sync every 6 hours.
2. **The posts pipeline pattern is proven** — `gbp_posts` lifecycle (`SCHEDULED` → `PUBLISHING` → `PUBLISHED`/`FAILED`), the 5-minute `gbpPostScheduler` job with per-tenant entitlement checks, stuck-row lease reclaim, and attempt caps, and the `gbp-customer.ts` route surface are a working template.
3. **The capability-module machinery is generic** — `gbp_management` demonstrated that a new module (`social_posting`) flows through tier flexible keys, BSaaS catalog SKUs, and admin grants with zero billing code. Enterprise already resolves every module via its flexible keys, so the pilot is free to grant.

### 1.3 Pilot Strategy — Dogfood First, Tenant GA on Proof

**The platform dogfoods the suite on its own social profiles before any merchant sees it.** The vehicle already exists: `VisibleShelf Internal` (`tid-sud4ky1c`), the platform's own tenant (`VISIBLESHELF_INTERNAL_TENANT_SPEC.md`), and the platform's real social accounts — `@shelfvisible` on Facebook, Instagram, Threads, Pinterest, TikTok, X plus `linkedin.com/company/visibleshelf` (all claimed/live per `PLATFORM_GBP_GOOGLE_ADS_SPEC.md` §3.7). The dogfood tenant receives `social_posting_flexible` via **admin grant** — the existing grant machinery, zero billing, zero tier surgery.

The recursive proof point from the GBP program repeats here: "we manage your social presence" is demonstrated by us managing *our own* social presence through the pipeline we sell. The platform's own posting cadence (GBP spec §3.5: Mon Update / Wed Offer / Fri merchant-spotlight) becomes the suite's first scheduled workload — GBP posts and Meta posts queued from one composer.

### 1.4 Partnership Positioning (strategic, not a build dependency)

The visibility-ladder architecture — normalized post entity → per-platform adapters → per-tenant OAuth → entitlement gating → dogfood proof — is exactly the shape a channel/OEM partner evaluates: multi-tenant by construction, per-surface auditable, entitlement-clean, and already operating on real accounts. Each integration landed makes the next partnership conversation concrete:

| Partner direction | What this suite demonstrates |
| :--- | :--- |
| **Google** | We're GBP API-allowlisted (approved 2026-10-29) and now operate merchant publishing across GBP *and* social from one pipeline — the cross-surface coverage story a local-presence partnership would be built on. Publish volumes, merchant counts, and a clean compliance record are the due-diligence material; dogfood metrics feed it directly. |
| **Meta** | The App Review artifacts (use-case narrative, screencast, business verification) are the same artifacts a Meta Tech Provider / Business Partner listing requires — Phase 0 doubles as partner-program groundwork. |
| **POS platforms (Clover/Square)** | Social posting joins catalog sync as proof that merchant data onboarded once fans out to every surface — the "app market" value story POS ecosystems evaluate. |

**Constraint (binding):** per the GBP API usage policy noted in `PLATFORM_GBP_GOOGLE_ADS_SPEC.md` §3.8, no public copy may suggest partnership/sponsorship/endorsement by Google without prior written approval. This section is *internal* positioning — the strategy is to build the metrics and architecture that make a partnership request credible, never to market one that doesn't exist.

**Phase gate:** tenant GA is *conditional on dogfood evidence* — N weeks of clean scheduled publishes across all three Meta surfaces, zero auth lapses, measured failure/retry rates. Only then does the module open to merchants (enterprise/flexible tiers first, BSaaS for the rest).

| Decision | Rationale |
| :--- | :--- |
| Dogfood on `VisibleShelf Internal` before tenant GA | Real posts on real `@shelfvisible` accounts = the proof artifact AND the marketing artifact; failure modes (token expiry, scope drift, container errors) get exercised on our own accounts before a merchant's reputation rides on them |
| Meta first | OAuth tables/routes/token encryption already live; the connection needs only a **scope expansion re-auth**, not a new integration |
| All 3 Meta surfaces in pilot | FB Page, IG, and Threads are one Meta app and one app-review submission. Threads rides the same review narrative as `instagram_content_publish` — excluding it would save little code but strand a fast-growing surface. The connect UI models them as one **platform profile** with up to three publishable surfaces (§4.0) |
| IG in pilot | `instagram_account_id` is already stored on `meta_oauth_accounts_list`; IG publishing is a two-step media-container API on the *same* consent — marginal cost over FB-only is small, marketing value is large |
| Threads in pilot | Threads API (`graph.threads.net`) is container-based like IG — the adapter shape is already designed. Its token leg is *separate* from Page tokens (§4.0), which is the only real added cost; scopes `threads_basic` + `threads_content_publish` go into the same App Review. Platform handle `@shelfvisible` already claimed |
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

### Subsystem 0: Meta Scope Expansion & the Three-Surface Platform Profile (PREREQUISITE)

The gating technical fact: **today's Meta connection cannot post.** `META_SCOPES` in `lib/meta/oauth.ts` requests commerce scopes only.

#### Scope delta

| Scope | Today | Needed for | Meta review tier |
| :--- | :---: | :--- | :--- |
| `catalog_management`, `business_management`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights` | ✅ | (existing commerce) | — |
| `pages_manage_posts` | ❌ | Publish/delete FB Page posts (text/link/photo) | **Advanced Access — app review required** |
| `publish_video` | ❌ | FB Page *video* uploads | Advanced Access — include in same submission |
| `instagram_content_publish` | ❌ | IG media containers + publish | **Advanced Access — app review required** |
| `threads_basic`, `threads_content_publish` | ❌ | Threads profile read + media-container publish | **Advanced Access — same app review submission** |
| `pages_manage_engagement` | ❌ | (Phase 3: comments/replies into Marketing Ops) | Advanced Access — defer |
| `instagram_manage_comments` | ❌ | (Phase 3) | Advanced Access — defer |
| `threads_manage_replies`, `threads_manage_insights` | ❌ | (Phase 3: Threads engagement + metrics) | Advanced Access — defer |

#### The platform profile — one Meta connect, three surfaces

The merchant-facing mental model is **one "Meta" connect card** that resolves into a *platform profile* listing every publishable surface under that Meta identity:

```
meta_oauth_accounts_list (existing — the Meta identity)
   │
   ├── FB Page surface      ← GET /me/accounts → page token
   │     publish: POST /{page-id}/feed | /photos | /videos        (graph.facebook.com)
   ├── Instagram surface    ← page.instagram_business_account (ig_user_id already stored)
   │     publish: POST /{ig-user}/media → /{ig-user}/media_publish (graph.facebook.com)
   └── Threads surface      ← separate Threads token leg (below)
         publish: POST /{threads-user-id}/threads → /threads_publish (graph.threads.net)
```

**Token model — three token shapes behind one profile:**

| Surface | Token | Host | Lifetime |
| :--- | :--- | :--- | :--- |
| FB Page | **Page access token** derived from user token via `/me/accounts` | `graph.facebook.com` | Never expires when derived from a long-lived user token — store per-page, don't refresh |
| Instagram | Page token works for the linked IG Business account (or user token — verify at build) | `graph.facebook.com` | Rides the Page token |
| Threads | **Separate Threads-scoped token** — NOT the FB user token | `graph.threads.net` | Short-lived (1h) → `th_exchange_token` → 60-day long-lived → **`th_refresh_token` refresh required** (new job — see gap note below) |

**Threads auth leg (build-time verification):** Meta now supports requesting `threads_*` scopes inside Facebook Login for Business — one consent, three surfaces — but the standalone Threads OAuth (`threads.net/oauth/authorize` → `graph.threads.net/oauth/access_token`) also works and is the documented fallback. Prefer the single-consent path if the existing Meta app config permits; either way the *result* is a distinct Threads token stored on its own surface row. Two constraints: the Threads profile **must be public**, and the profile needn't share identity with the FB Page (a tenant can have Page+IG but no Threads, or vice versa — surfaces resolve independently).

Page tokens derived from a long-lived user token **never expire** — store per-surface rows rather than refreshing. User-token expiry (60 days) still breaks the graph at renewal time. **Gap-sweep correction (2026-10-30):** the existing `oauth-token-refresh` job is **PayPal/Square gateway-scoped only** (`oauth_tokens` table) — nothing in the codebase refreshes Meta tokens today (`MetaCatalogSyncService` just skips expired tokens). So this is new code: a `metaTokenRefresh` job (fb_exchange_token re-up for the user token + `th_refresh_token` for each Threads surface row), not a join into an existing sweep. `meta_oauth_tokens_list.scopes` must also diff against the new `META_SCOPES` to flag `reauthorization_required` for pre-expansion connections. Threads exposes `GET /{threads-user-id}/threads_publishing_limit` for quota — wire it into the scheduler's pacing as a soft check.

#### Functional workflow

1. Admin expands `META_SCOPES` to include `pages_manage_posts`, `instagram_content_publish`, `threads_basic`, `threads_content_publish`.
2. Existing connections: status endpoint reports `scopesMissing: ['pages_manage_posts', …]` → merchant re-auths (same `/meta/oauth/authorize` flow; new token overwrites).
3. Post-callback the platform profile resolves each surface independently:
   - `getBusinessAccounts` + `/me/accounts` → merchant picks **one Page** (v1 constraint) → page token encrypted via existing `encryptToken` → `facebook_page` surface row.
   - The page's `instagram_business_account` → `instagram` surface row (skipped if none linked).
   - Threads leg → `threads` surface row with `threads_user_id`, `threads_username`, own encrypted token (skipped if merchant declines/has no public profile).
4. The platform profile card shows per-surface status independently — "Facebook ✓ · Instagram ✓ · Threads — not connected" is a valid end state.
5. Disconnect must delete all surface rows and (policy cleanliness) call `revokeToken`; Threads disconnect is a per-surface revoke, not the whole connect.

---

### Subsystem 1: Unified Post Entity & Platform Adapters

`gbp_posts` is GBP-shaped (`topic_type`, `call_to_action_type`, `event_*`, `offer_*`, `post_name` resource name). Rather than overload it, introduce **`social_posts`** — a normalized cross-platform entity with a `platform` discriminator and a `platform_payload` JSON escape hatch:

| Normalized field | FB Page mapping | IG mapping | Threads mapping | GBP equivalent (for reference) |
| :--- | :--- | :--- | :--- | :--- |
| `body` (text, ≤63,206 FB / ≤2,200 IG / **≤500 Threads**) | `message` | `caption` | `text` | `summary` |
| `link_url` | `link` | n/a (links not clickable in captions) | appended to `text` (Threads renders inline links) | `call_to_action_url` |
| `media[]` (url + type photo\|video + alt) | `/photos` batch or `/videos` | `media_type` IMAGE/VIDEO/REELS + container `media_url` | `media_type` TEXT/IMAGE/VIDEO/CAROUSEL + container `image_url`/`video_url`/`children` | `media_url` |
| `platform_payload` JSON | `published`, `scheduled_publish_time` | `media_type`, caption extras | `reply_to_id`, `quote_post_id` | topic/event/offer structs |
| `target_ref` | `page_id` | `ig_user_id` | `threads_user_id` | `location_id` |

**IG & Threads hard constraints:** both are container APIs requiring media at a **publicly fetchable URL** — the existing GBP media-upload + gallery-assets pipeline (public URLs already) is the media source; no private-asset signing work needed. Threads additionally: **media is optional** (TEXT posts allowed — the one Meta surface with no media requirement), body cap **500 chars**, and containers should be **status-polled** (`GET /{container-id}?fields=status` — `IN_PROGRESS`/`FINISHED`/`ERROR`; Meta recommends ~30s before publish, max 5min) — the adapter's `publish()` encapsulates the two-step + poll.

#### The composer's real shape: write once → broadcast to every surface

Following the visibility-ladder framing (§1.1a), the composer is **surface-agnostic at submission time**, not per-platform. The merchant writes one update and checks destinations — **FB Page / IG / Threads today, GBP localPost tomorrow** (an adapter wrapping `GBPAdvancedSync.createPost` unifies the two pipelines; v1 keeps `gbp_posts` and `social_posts` as separate tables but the UI should not assume it). One submission fans out to N `social_posts` rows — one per destination — sharing a `batch_id`, so each surface publishes/fails independently through its own adapter while the composer reports one logical post. `platform_payload` holds per-surface divergence (IG's media requirement, Threads' 500-char cap, GBP's CTA types); `validateDraft` runs per destination so the merchant sees "IG needs an image" as a per-surface lint, not a hard failure of the whole post.

**Adapter interface** (mirrors `GBPAdvancedSync.createPost` + `persist:false` job-mode):

```ts
interface SocialPlatformAdapter {
  platform: 'meta_facebook' | 'meta_instagram' | 'meta_threads' | 'tiktok' | 'linkedin' | 'pinterest' | 'x';
  validateDraft(post: SocialPost): string[];            // per-platform lint (length, media rules)
  publish(tenantId: string, post: SocialPost):          // returns remote id + permalink
    Promise<{ success: boolean; remoteId?: string; permalink?: string; error?: string; status?: number; retryAfterMs?: number }>;
  delete?(tenantId: string, remoteId: string): Promise<boolean>;
}
// implementations: lib/social/meta-facebook.ts, lib/social/meta-instagram.ts,
//                  lib/social/meta-threads.ts (v1)
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

- `lib/social/social-post-suggest.ts` — `buildSocialPostSuggestPrompt({platform, businessName, category, photoDescription, tone, theme, cta, linkUrl})` + `SOCIAL_POST_SUGGEST_SYSTEM`, with platform-conditioned length/format constraints injected into the prompt (IG ≤2,200 chars + hashtag block; Threads ≤500 chars, punchy single-thought; FB conversational; LinkedIn professional).
- `POST /api/social/posts/suggest` with the same `renderOnly` contract — one endpoint, `platform` param selects the prompt variant.
- Composer UI gets the same three controls just shipped for GBP: **Suggest** (internal), **Copy prompt** (render + clipboard), **Import** (paste external output back).

### Subsystem 4: Media Pipeline (gap-sweep correction — real work, not reuse)

**Verified 2026-10-30:** the GBP media paths do *not* provide reusable public URLs:

- `POST /media/upload` + `POST /media/from-gallery` push bytes **to Google's media API** (`uploadPhotoBinary`/`uploadPhoto`) — the platform never retains the binary; the result is Google-hosted `mediaItemId`s, useless for Meta.
- `GET /media/gallery-assets` returns **Supabase signed URLs with a 300-second TTL** (`createSignedUrl(path, 300)` from the private `disputes` bucket) — fine for an authenticated composer preview, fatal as an IG `media_url` (Meta fetches asynchronously, retries past expiry).

**What exists and is reusable:** `photos.ts`/`directory-photos.ts` already implement the required pattern — multer → Supabase `PHOTOS`/`TENANTS` buckets (`isPublic: true` in `storage-config.ts`) → `getPublicUrl()` permanent URLs. **The social media path is that pattern with a new table**, not the GBP routes:

- `POST /api/social/media/upload` — multer → `StorageBuckets.TENANTS` (or `PHOTOS`) → `getPublicUrl` → row in new `social_media` (`id, tenant_id, storage_path, public_url, mime, bytes`) → `social_posts.media[]` references the row, adapter reads `public_url` at publish time.
- `GET /api/social/media/gallery-assets` stays as a *composer picker*, but selection **re-uploads the binary into the public bucket** at compose time — never persist the signed URL as post media.

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
  ├── Feature: social_posting_threads        — Threads publishing
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

| Tier / Tenant | `social_posting` assignment | Rationale |
| :--- | :--- | :--- |
| `VisibleShelf Internal` (`tid-sud4ky1c`) — dogfood | `social_posting_flexible` via **admin grant** (not tier, not BSaaS) | Phase-1 host; existing grant machinery, no billing, revocable without touching tier bags. Its tier row may carry the module too — the grant makes it independent of which |
| `directory_presence`, `discovery`, `presence`, `storefront` | none (BSaaS-purchasable at GA) | Posting is an upsell, not a gateway feature — same posture as GBP Pro vs. the claimed-portal free core |
| `commitment`, `ecommerce`, `omnichannel` | `social_posting_meta` explicit (no scheduler) | Matches `social_commerce_meta_catalog` enablement on ecommerce/omnichannel today |
| `professional`, `organization`, `chain_professional` | `social_posting_flexible` | Same tiers carry `social_commerce_flexible` + `gbp_management_flexible` in the prd witness |
| `enterprise`, `chain_enterprise` | `social_posting_flexible` (inherited/bundled) | Enterprise already resolves all modules — the pilot's free entitlement surface |

**GA sequencing note:** tier assignment ships *dark* — registrations exist in `features_list`/`tier_features_list` so resolution works, but the composer UI and connect card are gated behind the dogfood phase gate (§9) before any merchant-facing surface links to them. The entitlement plumbing being live ≠ the feature being announced.

### 5.4 Expiry & Entitlement Boundary

Same semantics as GBP Suite §6.6: purchase expiry stops *new* post creation immediately; `SCHEDULED` rows whose `scheduled_for` passed while entitled still publish; `PUBLISHED` posts remain live on Meta (not retractable via entitlement); disconnecting Meta revokes nothing already published.

---

## 6. Database Schema Extensions

New migrations (next available: **370**; `database/migrations/369_gbp_access_lifecycle.sql` is latest).

| Migration | File | Purpose |
| :--- | :--- | :--- |
| 370 | `370_social_posting_tables.sql` | `social_posts` + `meta_surface_connections` + `social_media` |
| 371 | `371_meta_oauth_posting_columns.sql` | `meta_oauth_accounts_list`: add `page_scopes_granted_at`, `reauthorization_required`; `meta_oauth_tokens_list`: add `scopes_missing` cache or compute live |
| 372 | `372_social_posting_features.sql` | `features_list` + `capability_features_list` + `tier_features_list` registration rows (§5.3) |

```sql
-- 370 core shape (naming follows gbp_posts conventions)
CREATE TABLE social_posts (
  id                    VARCHAR(50) PRIMARY KEY,
  tenant_id             VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform              VARCHAR(24) NOT NULL,          -- meta_facebook | meta_instagram | meta_threads | tiktok | linkedin | pinterest | x
  target_ref            VARCHAR(255),                  -- page_id / ig_user_id / threads_user_id / board_id
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

CREATE TABLE social_media (
  id            VARCHAR(50) PRIMARY KEY,
  tenant_id     VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  storage_path  VARCHAR(500) NOT NULL,                 -- path inside public bucket
  public_url    TEXT NOT NULL,                         -- getPublicUrl — permanent, Meta-fetchable
  mime_type     VARCHAR(100), bytes INT,
  created_at    TIMESTAMPTZ(6) DEFAULT now()
);
CREATE INDEX idx_social_media_tenant ON social_media (tenant_id);

-- The platform profile: one row per publishable surface under a Meta connection.
-- 'facebook_page' → page_id + never-expiring page token; 'instagram' → ig_user_id
-- resolved through the page (token = page token); 'threads' → threads_user_id +
-- its own 60-day token refreshed via th_refresh_token (oauth-token-refresh job).
CREATE TABLE meta_surface_connections (
  id                       VARCHAR(50) PRIMARY KEY,
  meta_oauth_account_id    VARCHAR(50) NOT NULL REFERENCES meta_oauth_accounts_list(id) ON DELETE CASCADE,
  surface                  VARCHAR(20) NOT NULL,       -- facebook_page | instagram | threads
  target_ref               VARCHAR(64) NOT NULL,       -- page_id | ig_user_id | threads_user_id
  display_name             VARCHAR(255),               -- page name | ig handle | threads username
  access_token_enc         TEXT NOT NULL,              -- encryptToken() format: iv:authTag:ct
  token_expires_at         TIMESTAMPTZ(6),             -- NULL for page tokens; ~60d for threads
  scopes                   VARCHAR[] DEFAULT '{}',
  connected_at             TIMESTAMPTZ(6) DEFAULT now(),
  updated_at               TIMESTAMPTZ(6) DEFAULT now(),
  UNIQUE (meta_oauth_account_id, surface, target_ref)
);
CREATE INDEX idx_meta_surfaces_account ON meta_surface_connections (meta_oauth_account_id);
```

Merchant soft-gate settings (per `add-capability-feature` §3 pattern): a `tenant_social_posting_settings` table — dedicated table is the confirmed call, precedent `tenant_social_commerce_options_settings` (schema :7037) — holding `social_posting_enabled`, per-platform display toggles, default posting times. **Every settings PUT must call `invalidateEffectiveCapabilities(tenantId)`** (`EffectiveCapabilityResolver.ts:84`, verified).

---

## 7. API Route Endpoints Contract

New file `apps/api/src/routes/social-customer.ts`, mounted beside `gbp-customer.ts`, on a **shared auth middleware** (see note below).

| Method & Path | Function | Gate |
| :--- | :--- | :--- |
| `GET /api/social/status` | **Platform profile**: per-surface connection card — `{meta: {connected, surfaces: {facebook_page?, instagram?, threads?}, scopesGranted, scopesMissing, reauthorization_required}}` | customer auth |
| `GET /api/social/meta/surfaces` | List resolvable surfaces: available FB Pages (+linked IG), and whether a Threads leg is authorized (drives the connect UI) | `social_posting_meta` |
| `POST /api/social/meta/select-surface` | Persist a surface choice → `meta_surface_connections` row (`surface`, `target_ref`; fetches + encrypts the surface token) | matching `social_posting_{meta\|instagram\|threads}` |
| `DELETE /api/social/meta/surfaces/:id` | Disconnect a single surface (Threads revoke ≠ whole Meta connect) | matching surface key |
| `GET /api/social/posts` | List posts (paginated; filter `platform`, `status`) | module enabled |
| `POST /api/social/posts` | Create post: immediate publish OR `scheduled_for` → `SCHEDULED`; adapter `validateDraft` lint first | module enabled; `social_posting_scheduler` when `scheduled_for` present; per-platform key (`social_posting_meta`/`_instagram`) by `platform` |
| `DELETE /api/social/posts/:id` | Cancel `SCHEDULED`/`DRAFT`; best-effort remote delete for `PUBLISHED` where adapter supports | module enabled |
| `POST /api/social/posts/suggest` | Dual-pattern AI copy (`renderOnly` → prompt; else resolve) — `platform` param selects variant | module enabled |
| `POST /api/social/media/upload` + `GET /api/social/media/gallery-assets` | Post media, public URL | module enabled |

OAuth surface changes to `meta-oauth.ts`: `GET /meta/oauth/status` response gains `postingScopes: {granted:[], missing:[]}`; no new OAuth routes needed — authorize/callback already parameterized by `META_SCOPES`.

**Middleware extraction (pre-work, gap-sweep 2026-10-30):** `requireCustomerAuth`/`requirePlatformContext` are inline copies in `gbp-customer.ts` (:78/:87) and `marketing-customer.ts` (:70/:83) — the `requirePlatformContext` bodies are byte-identical; `requireCustomerAuth` is duplicated across **six** route files (gbp-customer, marketing-customer, market-intel-customer, market-intel-surface-customer, customer-coupons, customer-addresses, customer-payment-methods) with trivial response-shape drift (`'Not authenticated'` vs `'Authentication required'`). Since every future platform surface (TikTok/LinkedIn/…) needs the same gate, extract once to **`src/middleware/customer-auth.ts`** alongside `auth.ts`/`permissions.ts`: canonical shape `{success:false, error:'unauthorized'}` (message unification is a harmless behavior change for the coupon variant). `social-customer.ts` consumes the shared middleware; existing files swap opportunistically — not a blocking refactor of all six.

---

## 8. External Dependencies & Review Requirements

| Dependency | Status | Risk |
| :--- | :--- | :--- |
| Meta App Review — Advanced Access for `pages_manage_posts` + `instagram_content_publish` + `threads_basic` + `threads_content_publish` | **Not started** — screencast + business verification + use-case description | **The schedule long pole.** Existing `META_APP_ID` already passed commerce review, which helps; still weeks-scale. All four scopes go in *one* submission — Threads adds no second review. Start before code, not after |
| Threads token lifecycle | Short(1h) → long(60d) via `th_exchange_token`, refreshed via `th_refresh_token` | **New `metaTokenRefresh` job required** — existing `oauth-token-refresh` is gateway-scoped (PayPal/Square `oauth_tokens`); lapsed Threads tokens expire permanently (unlike page tokens) |
| Meta user-token refresh | 60-day long-lived token; **no refresh path exists today** (`MetaCatalogSyncService` skips expired) | Same `metaTokenRefresh` job covers it; without it every Meta connection silently dies at day 60 |
| Threads profile requirements | Profile must be **public**; independent of Page/IG linkage | Composer must surface "make your Threads profile public" guidance on failure |
| Threads auth path | Facebook Login for Business may cover `threads_*` in one consent vs. standalone `threads.net/oauth/authorize` leg | Build-time verification — Meta guidance has shifted; prefer single consent, keep standalone as fallback |
| Threads quota | `threads_publishing_limit` endpoint | Soft-check in scheduler pacing (§4.2) |
| Existing tenant re-auth | Scope diff → `reauthorization_required` flag → banner in composer | Low (same flow re-run) |
| IG/Threads public media URL | **New upload path required** — gallery-assets URLs are 300s signed URLs (private `disputes` bucket); use `photos.ts` public-bucket pattern (§4.4) | Build item, not a verification gate — the public-URL infra exists, the social table/route doesn't |
| TikTok app audit (Phase 2) | Not started | `SELF_ONLY`-only until approved — do not build before approval path is understood |
| LinkedIn/Pinterest/X apps (Phase 3) | Not started | X requires paid API tier — revisit unit economics |

---

## 9. Phased Implementation Roadmap

| Phase | Scope | Exit criteria |
| :--- | :--- | :--- |
| **0. Meta app review kickoff** (external, parallel) | Submit `pages_manage_posts` + `instagram_content_publish` + `threads_basic` + `threads_content_publish` for Advanced Access in one submission; prep screencast of composer UX (can demo in dev mode) | Approved or in-review with no blockers |
| **1. Build + dogfood (Meta)** | Migrations 370–372; `meta_surface_connections` + platform-profile resolution; scope expansion + reauth flag; `social_posts` + all three Meta adapters (FB Page, IG, Threads); `social_media` public-bucket upload path (§4.4); **`metaTokenRefresh` job** (user token `fb_exchange_token` + Threads `th_refresh_token` — new code, existing refresh job is gateway-scoped); **`src/middleware/customer-auth.ts` extraction** (§7 note); scheduler job; `social-customer.ts`; composer UI (clone GBP advanced page structure); `SocialPostingResolver`; `tenant_social_posting_settings`; contract fixture updates; admin-grant `social_posting_flexible` to `tid-sud4ky1c`; connect the platform's own `@shelfvisible` FB page + IG + Threads | **Live proof on our own accounts:** the §3.5 weekly cadence (Mon/Wed/Fri) publishes through the scheduler to all three Meta surfaces; permalinks recorded; entitlement OFF → scheduler skips; `pnpm checkapi`/`checkweb`/vitest + contract suites green |
| **2. Dogfood bake + tenant GA gate** | N weeks (set N with Product) of scheduled publishes on `@shelfvisible` across all three surfaces; token-refresh cycles observed; failure/retry rates measured from job logs; composer UX hardened | Go/no-go doc → tier assignments go live for merchants (§5.3) |
| **3. Tenant GA (Meta)** | Merchant-facing composer + connect card linked in settings nav; BSaaS SKUs priced; announcement surfaces | First merchant post publishes; support runbook exists |
| **4. Expansion** | TikTok (post-audit), LinkedIn, Pinterest, X per §4.7 table — platform already owns `@shelfvisible`/`linkedin.com/company/visibleshelf` on each, so the dogfood story extends naturally; `pages_manage_engagement` → Marketing Ops queue ingestion | Per-platform adapters behind registry |

**Web surface:** new `apps/web/src/app/t/[tenantId]/settings/integrations/social/` page tree — Meta connect card (mirroring `GoogleConnectCard`), page picker, composer reusing the GBP advanced-page layout + the suggest/copy-prompt/import controls shipped 2026-10-30. A platform-overview post calendar is a Phase-1 stretch, not a blocker.

---

## 10. Verification & Quality Gates

- **Contract suites:** `tier-*`, `mv-shape-lint`, `tier-doc-generation` in `apps/api/src/services/__tests__/` must pass after fixture edits; regenerate doc blocks via `gen-tier-doc-blocks.cjs --write` if the module is surfaced in generated docs.
- **Typechecks:** `pnpm checkapi`, `pnpm checkweb`.
- **Unit tests:** resolver tests mirroring `GbpManagementResolver` coverage (flexible → all keys; explicit per-platform key; merchant soft-toggle AND); adapter `validateDraft` lint table-tests (IG caption length, media-required-for-IG, FB link posts); scheduler claim/lease/attempt-cap tests mirroring `gbpPostScheduler` behavior.
- **Render tests (web):** composer page via `renderToStaticMarkup` + `MantineProvider` pattern (AGENTS.md §Web component render tests); pin page-picker options and the suggest/copy/import control presence.
- **Live gates (staging → dogfood):** scope-diff reauth on an existing connection; page token retrieval; scheduled post fires within one scheduler interval; `pages_manage_posts` dev-mode post to a test page (dev mode bypasses Advanced Access for app-role users — dogfood can start before review completes, which is also how the Phase-0 screencast gets recorded).
- **Dogfood acceptance:** a real scheduled post publishes to `@shelfvisible` FB + Threads from `tid-sud4ky1c`, permalink lands on `social_posts`, and the Threads token survives one `th_refresh_token` cycle. IG adds the media-container path on top — its `media_url` must be a `social_media.public_url` (permanent), verified by publishing a photo post, not just a text one.

---

## 11. Current-State Audit Baseline (verified 2026-10-30)

| Claim | Verified state |
| :--- | :--- |
| Meta OAuth/token storage | ✅ `lib/meta/oauth.ts`, `meta_oauth_accounts_list`/`_tokens_list`, `routes/meta-oauth.ts` live |
| Meta posting scopes | ❌ `META_SCOPES` = commerce-only; no `pages_manage_posts`/`instagram_content_publish`/`threads_*` |
| Page/Threads token storage | ❌ Single user-token row; no per-surface entity (`meta_surface_connections` is new in §6) |
| Threads API integration | ❌ None — `graph.threads.net` appears nowhere in `apps/api`; separate token leg required |
| Any social *posting* code | ❌ `pages_manage_posts`/`instagram_content_publish`/`threads_content_publish`/`feed`-publish greps return nothing |
| GBP posting pipeline | ✅ `gbp_posts` + `gbpPostScheduler` + `GBPAdvancedSync.createPost` + `gbp-customer.ts` — the clone source |
| AI post suggest | ✅ `lib/google/gbp-post-suggest.ts` + dual render/resolve pattern (extended 2026-10-30) |
| Public post media URLs | ⚠️ Partial — `PHOTOS`/`TENANTS` buckets are public with `getPublicUrl` precedent (`photos.ts`), but GBP media routes push to Google (not reusable) and gallery-assets are 300s signed URLs. New `social_media` table + upload route needed (§4.4) |
| Meta token refresh | ❌ `oauth-token-refresh` job is PayPal/Square gateway-scoped (`oauth_tokens`); no Meta refresh exists — expired tokens are just skipped by catalog sync. New `metaTokenRefresh` job required |
| TikTok content posting | ❌ Existing integration is Shop-only (`auth.tiktok-shops.com`, `shop.*` scopes) |
| LinkedIn/Pinterest/X | ❌ No code. `PLATFORM_GBP_GOOGLE_ADS_SPEC.md` §2.4's `lib/pinterest/` claim is **wrong** — flag for spec correction |
| Enterprise entitlement | ✅ `social_commerce_flexible` enabled on `enterprise`/`organization`/`professional`/`chain_professional` in prd witness; `social_posting_flexible` will flow identically |
| Meta App Review for posting scopes | ❌ Not started — Phase 0 kickoff |
