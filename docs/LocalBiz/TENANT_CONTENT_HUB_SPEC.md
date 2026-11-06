# Tenant Content Hub Spec

**Status:** DRAFT v0.1 — for review
**Owner:** Product (with Engineering sign-off on the composer multiplexing + tier-contract flag additions)
**Date:** 2026-11-06
**Scope:** A single merchant-facing surface — `/t/[tenantId]/content` — that indexes every channel a tenant's content can appear on, shows per-channel state, exposes the simple on/off levers inline, and deep-links into the existing channel editors. Phase 2 adds a unified posts composer that fans a single authored post out to the place page, GBP, and Meta. **No existing editor is rebuilt** — the hub is an index plus a composer, not a settings consolidation.

**Referenced docs:**
- `docs/LocalBiz/SOCIAL_POSTING_SUITE_SPEC.md` — the Visibility Ladder framing (§1.1a) this spec reuses; the Meta posts pipeline (`social_posts`/`social_media`, migrations 370/372, currently DARK pending dogfood)
- `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md` — the `gbp_posts` scheduled-publish pipeline and `gbp_post_batches` (migration 368) the composer multiplexes into
- `docs/LocalBiz/FLYER_SURFACE_SPEC.md` — flyer authoring + the `FlyerSection surface="place"` render slot
- `shared/tier-contract.json` — capability modules, tier order, `surface_files` manifest; **all new flags land fixture-first**
- `docs/VISIBLESHELF_INTERNAL_TENANT_SPEC.md` — dogfood tenant `tid-sud4ky1c`
- `docs/LocalBiz/MARKET_PUSH_OPERATOR_GUIDE.md` — adjacent: the hub is the *claimed-tenant* complement of the operator-side seed pipeline

---

## 1. Executive Summary & Strategic Vision

### 1.1 The Business Problem

Every lever this spec indexes **already exists** — the platform did not under-build merchant content tools, it scattered them. The tenant portal has ~55 settings pages; the content an owner publishes is spread across at least 9 of them (`settings/directory`, `settings/tenant`, `storefront-gallery`, `storefront-hours`, `flyers`, `social-commerce`, `seo`, `gbp-category`, `featured-products`). An owner cannot form a mental map of "what do I control, where does it show, what's missing." The fragmentation shows up in the metrics that matter: `/place/` pages sit at **avg position ~21.8** (Search Console, 3 months, post-push window) — thin, templated, near-identical pages — while the tools that would differentiate them are undiscoverable.

### 1.2 The Same Visibility Ladder, from the other side

`SOCIAL_POSTING_SUITE_SPEC.md` §1.1a frames the product as *surface coverage*. The Content Hub is the **control surface for that ladder** — the one page where a merchant sees every surface their business appears on and what is/isn't flowing to it:

```
                 ┌─────────────────── Content Hub ────────────────────┐
   authored ────▶│  place page · storefront · GBP · Meta · GMC feed · │
   assets        │  flyers · social links                              │
                 └────────── index · status · levers · composer ──────┘
```

- **Seeds** create presence before the merchant acts — the hub is where the claimed owner takes over what the seed started.
- **The claim pitch** already promises content control ("update hours, add a photo, showcase up to 5 products"). The hub is where that promise is kept *visibly*.
- **Owner-authored content is the only thing that makes each `/place/` page genuinely unique** — the fix for position ~20 isn't more settings pages, it's the owner actually finding and using them.

### 1.3 The Opportunity — an index, not a rebuild

`settings/directory` → `DirectorySettingsPanel` (1154 lines) is already a mature channel editor for the place page: publish/unpublish, category selector, capability-gated layout picker (`classic`/`editorial`/`immersive`/`premium`), description & keywords, `DirectoryPhotoGallery` upload, section toggles — all backed by `directory-entry-options-settings.ts` and `unifiedCapabilityService.getDirectoryEntryOptionsState`. Equivalent editors exist for flyers, hours, social posting, GBP. The build cost of the hub is therefore a summary endpoint + a card grid + deep links — the editors stay put and keep working.

### 1.4 Pilot Strategy — dogfood first, again

Same pattern as the social suite: build it on `VisibleShelf Internal` (`tid-sud4ky1c`) — the one tenant with real content in every channel — before any merchant sees it. The hub's cards must render correctly for dark/in-progress surfaces (`social_posting` ships DARK until its dogfood gate passes): a dark card shows the channel and "coming soon," never an error.

---

## 2. Current-State Inventory (verified 2026-11-06)

| Channel | Content types | Editor today | Status data source | Capability gate |
|---|---|---|---|---|
| **Directory listing** (`/directory/<slug>` — the canonical claimed page; `/place/[slug]` `permanentRedirect`s to it once claimed) | publish state, categories, layout, description+keywords, photos, section toggles, WhatsApp/SNAP-EBT/attrs | `settings/directory` (`DirectorySettingsPanel`) — nav labels this page **"Storefront"** (naming collision, see §3.3) | `useDirectoryListing`, `tenantDirectoryManagementService`, `directory-entry-options-settings.ts` | `directory_entry_options` module; `directory_entry_{logo,about,gallery,social,hours,map,contact,qr}_on`, `directory_entry_layout_{classic,editorial,immersive}` |
| **Storefront** | products, featured products, layout, gallery, hours, coupons, FAQ, reviews | `items`, `catalog`, `settings/storefront-*`, `settings/coupons`, `settings/faq-*` | item/featured counts, reviews route | storefront tier + feature keys |
| **Products feed** | catalog items → GMC/Shopping/SWIS | `items`, `feed-validation` | feed validation status | `google` mode / GMC entitlements |
| **GBP** | localPosts, NAP sync, categories, media | `settings/gbp-category`, GBP suite surfaces | `gbp_posts` lifecycle (`SCHEDULED→PUBLISHING→PUBLISHED/FAILED`), `gbp_post_batches` | `gbp_management` module |
| **Social (Meta)** | posts → FB Page/IG/Threads + scheduler | `settings/social-commerce` (`SocialCommerceSettingsClient`) | `social_posts`, `tenant_social_posting_settings` | `social_posting` module (**DARK**) |
| **Flyers** | flyer docs → place page (`FlyerSection surface="place"`) + storefront | `settings/flyers` | flyer records, active count | tier-gated |
| **Profile & SEO** | business_description, hours, social links, seo_tags | `settings/tenant`, `settings/seo` | `profile-completeness` page + `calculateSEOReadiness` (`lib/validation/businessProfile`) | — |
| **Directory-entry posts feed** | short updates rendered on the claimed entry | **does not exist** | **does not exist** | **new flag `directory_entry_posts_on`** |

Only the last row is missing infrastructure; everything else is a discovery problem.

---

## 3. Design

### 3.1 Route & entry points

- **`/t/[tenantId]/content`** — the hub. New top-level tenant route (sibling of `dashboard`, `reviews`), matching existing `[tenantId]` conventions.
- **Entry card on `TenantDashboardV2`** (`/t/[tenantId]/dashboard`) — "Content" card showing surfaces-live count + one gap nudge.
- **`/t/[tenantId]/profile-completeness` folds in** — its score becomes the hub header (§3.2); the standalone page redirects to `/content`. **Fold-in has three known call sites to update**: `TenantSidebar` renders contextual quick-links specifically when on that route (the hours/settings shortcuts at the bottom of the nav), plus references in `OnboardingWizard` and `TenantProfileSingleton`. Keep `calculateSEOReadiness` as the single scoring function so hub and any other surface can't disagree.

### 3.2 Page anatomy

```
┌────────────────────────────────────────────────────────────┐
│ Content                                        [+ New post] │
│ ▓▓▓▓▓▓▓░░ 78% profile · Appearing on 5 of 7 surfaces        │
├──────────┬──────────┬──────────┬────────────────────────────┤
│ Place    │ Products │ Photos & │ Flyers &                   │
│ page     │ & catalog│ media    │ offers                     │
│ ●live    │ ●124 it. │ ◐ 3 / 5  │ ● 1 active                 │
├──────────┼──────────┼──────────┼────────────────────────────┤
│ Posts &  │ Google   │ Social   │ Storefront                 │
│ updates  │ (GBP/GMC)│ (Meta)   │                            │
│ ◐ 2 sch. │ ● sync'd │ 🔒 locked│ ● live                     │
└──────────┴──────────┴──────────┴────────────────────────────┘
```

- **Header** — completeness score (reused function), "appearing on N of M surfaces" count, primary composer CTA.
- **Card grid** — one card per channel (§2 rows, minus the last until Phase 2). Each card: name, renders-on line ("renders on: /place · storefront"), state metric, one gap nudge ("no photos yet"), deep-link button ("Manage"), and inline levers where they exist (§3.4).
- **States**: `empty` (channel available, nothing published), `active` (content live, with count/freshness), `locked` (capability absent → upgrade affordance naming the tier), `dark` (module exists but unlaunched → "coming soon", no error).
- **Naming rule (nav collision)**: `SidebarTemplates` already labels `settings/directory` as **"Storefront"** — an existing inaccuracy this spec must route around, not amplify. The hub's claimed-listing card is named **"Directory listing"** (renders on `/directory/<slug>`); the catalog/storefront channel card is **"Storefront & catalog"**. Do not create a second "Storefront"-named surface pointing somewhere else.
- **Nav registration**: the top-level "Content" item is added in `SidebarTemplates.tsx` (the hierarchical nav source feeding `TenantSidebar`/`DynamicTenantSidebar`).

### 3.3 Card model

```ts
interface ContentChannelCard {
  key: string;                       // 'place_page' | 'products' | 'flyers' | …
  label: string;
  rendersOn: string[];               // human-readable destinations
  state: 'empty' | 'active' | 'locked' | 'dark';
  metrics: Record<string, number>;   // {items: 124}, {scheduled: 2, published: 31}
  freshness?: string | null;         // last publish/update ISO
  capability: { enabled: boolean; flexible: boolean; upgradeTier?: string };
  editorHref: string;                // deep link into the existing editor
  quickLevers?: QuickLever[];        // inline on/off toggles (§3.4)
  nudge?: string;                    // one gap hint ("Add photos — pages with photos rank higher")
}
```

### 3.4 Quick levers — "push and pull the levers" inline

Simple boolean toggles ride the card instead of requiring the deep link — starting with the place-page section toggles that already persist through `updateDirectoryEntryOptions` (`hours_display`, `map_display`, `contact`, `qr`, `social links`). Each lever renders capability-aware (disabled + lock hint when the tier lacks the flag). Anything more complex than a boolean stays behind the deep link — the hub must not grow into a second settings tree.

### 3.5 The composer entry

Header `[+ New post]` opens the Phase-1 unified composer (§4). Until then the button deep-links to the social posting surface and stays hidden when `social_posting` is dark and GBP posts aren't granted.

---

## 4. The Unified Posts Composer (Phase 1–2)

The one genuinely new authoring surface. **Storage stays per-channel; the composer multiplexes** — two proven pipelines already exist, and a third is cheap:

- Author once → destination checkboxes: **Place page** · **Google Business Profile** · **Meta (FB/IG/Threads)**
- GBP selection writes into the existing `gbp_posts`/`gbp_post_batches` pipeline (scheduler, retry, lifecycle already proven).
- Meta selection writes `social_posts` rows (existing schema; gated on the social suite exiting DARK).
- **Directory-entry selection (Phase 2, new)**: small `tenant_place_posts` table — `id, tenant_id, body, media_url, status, published_at` — rendered by a new `directory_entry_posts_on`-gated **shared section component mounted in all three claimed layouts** (`/directory/[slug]/layouts/{DirectoryEntryClassic,Editorial,Immersive}Layout`, selected by `effectiveLayout` in `StoreDetailClient`). ⚠️ Do **not** mount it on `PlaceEntryEditorialLayout` — that layout serves only *unclaimed* seeds (`/place/[slug]` `permanentRedirect`s claimed listings to `/directory/<slug>`; seeds have no owner to author posts). This is the same GBP localPosts concept pointed at the platform's own surface — and it's the content type most directly aimed at the position-~20 problem: fresh, unique, dated owner content on the indexed page.
- Scheduling reuses the GBP scheduler pattern (per-tenant entitlement check, lease reclaim, attempt caps) — no new job machinery.

Non-goal: unified *status* across channels in v1. Each destination keeps its own lifecycle; the composer reports per-destination results.

---

## 5. Capability Gating & Tier Contract

All gating resolves through the existing machinery (`unifiedCapabilityService` / `EffectiveCapabilityResolver`); the hub itself is **entitlement-free chrome** — every claimed tenant sees the page, cards render their own lock state.

**New flags (fixture-first — `shared/tier-contract.json` edits precede code):**

| Flag | Module | Proposal |
|---|---|---|
| `directory_entry_posts_on` | `directory_entry_options` | Renders the place-page posts feed. **Free at claim** — dated owner content improves the directory for everyone; charging for the thing that fixes position ~20 is self-defeating. |
| `directory_entry_posts_volume` (or rely on flexible) | `directory_entry_options` | Post cadence cap if abuse warrants; default: flexible key only. |

Existing flags already cover the rest: `about_on`/`gallery_on`/`social_on`/layout flags are entry-presence-tier grants — the hub's locked cards advertise exactly the tier ladder `FeaturesShowcase` sells, closing the loop between marketing surface and product surface.

**Locked-card copy rule:** name the concrete tier + price via `tierPrice()`/`TIER_DISPLAY_NAMES` (never hand-typed strings — same rule as `FeaturesShowcase`).

---

## 6. API

**`GET /api/tenants/:tenantId/content/summary`** — one aggregate endpoint; the hub must not fan out into N client fetches.

```jsonc
{
  "completeness": { "score": 78, "grade": "good" },
  "surfaces": { "live": 5, "total": 8 },
  "channels": [ /* ContentChannelCard[] — §3.3 */ ]
}
```

Server-side assembly reuses existing resolvers/services: `EffectiveCapabilityResolver` for gates, `useDirectoryListing`'s backing route for publish state, `gbp_posts` status counts, `social_posts` counts (skip silently when module dark), item/featured counts, flyer counts, `calculateSEOReadiness` on the profile. Follows the `directory-consolidated.ts` precedent for a consolidated tenant-read route.

Auth: standard `authenticateToken` + `checkTenantAccess` — same as every `/t/*` backing route.

---

## 7. Phasing

| Phase | Deliverable | New infra? |
|---|---|---|
| **0 — The index** | `/content` route, summary endpoint, card grid, header score, dashboard entry card, `profile-completeness` redirect | Endpoint + page only |
| **1 — The composer** | Unified posts composer → GBP + Meta destinations (respecting DARK state) | UI + writes into existing pipelines |
| **2 — The place feed** | `tenant_place_posts` + `directory_entry_posts_on` section + composer third destination | Table + flag + render section |
| **3 — Gap intelligence** | Per-card nudges informed by what's missing ("pages with photos rank higher"; later, per-market Search Console signals) | Query/nudge logic only |

Phases 0–1 ship as dogfood on `tid-sud4ky1c` — the platform tenant has real content in every channel and exercises every card state including `dark`.

---

## 8. Why this moves the needle (SEO rationale)

- Seeds are near-identical templates (same structure, swapped NAP) — Google reads hundreds of thin near-duplicates. That is consistent with **avg position ~21.8** on the platform's own Search Console data.
- Owner-authored content (dated posts, real photos, owner-written about) is the only input that makes each page *genuinely* unique and *fresh* — the two signals most likely to move position ~20 → ~5.
- The flywheel: content tools → richer page → better ranking → visible impressions → reason to claim → richer page. The hub is the visible half of that loop — the owner can finally *see* the surfaces their work lands on.

## 9. Non-goals

- Not a settings consolidation — editors stay in place; the hub indexes them.
- Not an admin/operator console — this is the claimed tenant's surface only.
- Not unified analytics (Phase 3 nudges are qualitative hints, not a Search Console clone).
- Not a new scheduling/job system — reuses the GBP scheduler pattern.

## 10. Open questions

1. ~~**Place-feed placement**~~ — **resolved by gap sweep**: renders on all three claimed layouts (`classic`/`editorial`/`immersive`) via a shared section component in `StoreDetailClient`; the seed layout (`PlaceEntryEditorialLayout`) is out of scope by definition — unclaimed seeds have no owner.
2. **Post volume policy** — uncapped free vs a soft cap behind flexible; watch for spam-shaped usage before deciding.
3. **`profile-completeness` semantics** — does the hub header keep the SEO-readiness weighting or grow a content-coverage score that includes channel state, not just profile fields?
4. **Composer ↔ social suite ordering** — Phase 1 can ship GBP-only if the Meta suite is still dark; confirm the dogfood-gate timing.
5. **`premium` layout key** — the API enum accepts `classic|editorial|immersive|premium` but only three layout components exist under `/directory/[slug]/layouts/`; confirm whether `premium` is reserved/unused or aliases one of the three before wiring the layout matrix.

## 11. Gap sweep (2026-11-06, pre-build)

Verified against the codebase before implementation — corrections applied above; everything else confirmed:

- ✅ GBP composer backend exists: `gbp-customer.ts` `GET/POST /posts` (paginated, status-filtered), entitlement via `permissionServiceFactory.hasFeature(tenantId, 'gbp_posts_scheduler')`, `gbp_posts` lifecycle + `gbp_post_batches`.
- ✅ Flyer card data exists: `FlyerService.listFlyers(tenantId)` → `GET /api/tenants/:tid/flyers` returns `{flyers, capability}` — count + gate in one call.
- ✅ Directory-entry get/set: `tenantDirectoryManagementService.{getDirectoryListing,getDirectoryEntryOptions,updateDirectoryEntryOptions}` — quick levers can call the existing setter.
- ✅ No name conflicts: `tenant_place_posts`, `place_posts`, `/t/[tenantId]/content` route — all free.
- ✅ Route mount point: `apps/api/src/routes/routeRegistry.ts`; nav source: `SidebarTemplates.tsx`.
- ⚠️ **Composer UI is greenfield** — no `PostComposer`-type component exists on the web side (Meta suite is DARK; its composer hasn't shipped). Phase 1 builds a new component writing to existing backends — it does not extend an existing one.
- ⚠️ **Nav "Storefront" mislabel** predates this spec (points at `settings/directory`) — renaming it is a separate cleanup; the hub works around it per §3.3.
- ⚠️ **Module gates: `hasFeature` ≠ module resolution** (found post-Phase-0, fixed). `permissionServiceFactory.hasFeature(tenantId, 'gbp_management')` does a *literal feature-key* lookup and returns `false` for module grants that arrive via flexible keys — enterprise `tid-sud4ky1c` showed GBP Locked / Social dark while `effective-capabilities` reported both `enabled: true, is_flexible: true`. Card gates must read `resolveEffectiveCapabilities(tenantId).effective.<module>.{enabled,is_flexible}` — the same call that powers the flyer card. Rule of thumb: `hasFeature` for granular keys (`gbp_posts_scheduler`), `effective.<module>` for module on/off.
