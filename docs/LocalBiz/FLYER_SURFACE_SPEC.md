# Flyer Surface Spec

Status: DRAFT
Date: 2026-10-17
Surfaces: `/tenant/[id]` storefront, `/directory/[slug]` entry, `/place/[slug]` entry, standalone share link

## 1. Insight & Goal

Many target retailers (e.g., ethnic groceries) run a **side kitchen** and announce
featured dishes to their community as image flyers in WhatsApp groups — sometimes
weekly, sometimes daily. The platform already owns every piece of the buyer journey
(products → cart → checkout → pickup time slots → `ready_for_pickup`), and already
owns image real-estate (gallery carousel/magazine, GBP post cards, featured
buckets). What it lacks is a **first-class, time-boxed, image-led surface that
binds "here's what's cooking" to "order ahead, pick up in store."**

A **flyer** is a merchant-authored, window-scoped surface: a title, an optional
flyer image (the same artwork they'd post to WhatsApp), and an optional set of
linked inventory items rendered as orderable cards. The window is generic —
`starts_at`/`ends_at` — so a *day's* flyer and a *week's* flyer are the same
object. "Weekly" is a creation preset, not semantics.

**Items are optional; the static-item + rotating-variant model is the default.**
The minimal flyer is image + window — as cheap as the WhatsApp post it replaces.
For ordering, the merchant does **not** create a new item per dish: a stable
"Kitchen Special" parent item persists across flyers, and **each dish is a
`product_variants` row on it**. Variants are the rotation unit — the composer
creates/activates this flyer's variants and deactivates the expired ones. This
mirrors how these kitchens actually work (a fixed-price plate that changes
weekly, not a menu) and gets per-dish price, stock, and receipt fidelity for
free: `checkout.ts` already does per-variant stock checks and pricing and writes
`order_items` with `variant_id` + `"Kitchen Special - Jollof Rice Plate"`.
Linking real catalog items stays available as the power path (a grocery running
a "this week's imports" flyer links shelf items).

**Goal:** a flyer section that renders on the storefront, the directory entry, and
the place page; whose items click straight into the existing cart/checkout/pickup
journey; and whose share link replaces the WhatsApp image post with a URL that
converts.

### Positioning — a neutral, opt-in tool

> **The platform is the ship; the merchant packages and releases the container.**
> The ship carries what it's handed — it doesn't pack, inspect, or originate the
> cargo. But it does check the **manifest**: contractual warranties (merchant
> holds required permits, is merchant of record), reactive report → suppress
> moderation, payment-processor category screening on *orderable* items (the
> platform's own gateway accounts are at stake), DMCA takedown, and restricted-
> category gating to display-only until age-verification models exist. What it
> must not do is *verify* — licenses, kitchens, jurisdictions — because
> verifying some implies warranting all, a worse posture than honest neutrality.

The platform offers the flyer as a **capability, not a program**: no campaign
pushes it, no surface demands it. Discovery, perceived value, and incorporation
into operations are the merchant's intentional choice — the capability sits in
their tier's feature set and waits. This posture is deliberate: it keeps the
platform a tool provider (the merchant of record owns what they merchandise and
how they sell it — compliance posture included) and it keeps the feature honest —
a flyer that only exists because a merchant chose to make one is a live signal,
not platform-generated noise.

**Merchant authorship end-to-end.** Enabled-but-unused is a valid, expected
state — the key grants the tooling, nothing more. The merchant authors every
artifact: the flyer itself, its title and window, the uploaded image, the dishes
(variants) and their prices. The platform's only write is the auto-provisioned
static *parent* item (§3) — an infrastructure container the merchant can see,
rename, and manage like any catalog row, never content in itself. No flow
creates flyer content on a merchant's behalf; the lone exception ever
contemplated (operator teaser flyers on *unclaimed* seeds, where no merchant
exists yet) is explicitly out of scope as a non-goal.

**Category-agnostic by construction.** The side-kitchen archetype motivated the
feature and drives this spec's examples, but nothing in the entity, keys, or
composer is food-bound: a flyer is a window + image + optional item/variant
links. A boutique runs "this week's arrivals," a nursery runs seasonal stock, a
butcher runs this week's cuts, a bookstore runs a signing-week flyer — same
object, same surfaces. Where this spec says "dish"/"kitchen," read it as
archetype shorthand; `variant_name` is a free label. Category-tailored defaults
(the static parent's seeded name — "Kitchen Special" vs. "Weekly Special" — and
composer copy presets) are a localization detail, not a schema concern.

### Strategic value

No competing surface offers **ephemeral merchandising + community-channel
distribution + merchant-owned pickup commerce** in one primitive: Shopify/Square
have static products and discounts but no rotating-specials surface; DoorDash/
UberEats do prepared food but own the customer and take a marketplace commission.
The flyer is also uniquely *platform-shaped*: it only exists because the seed →
claim → storefront → commerce ladder already does — it is a capability that could
not be bolted onto a directory-only or storefront-only product. Beyond the sales
story, it compounds the durable moat: the dish repertoire, per-dish order history,
and weekly engagement habit all accumulate on-platform and get harder to leave.

### Composite-merchant signal (from intelligence scans)

The audits increasingly show merchants running **composite offerings** —
grocery + kitchen, fresh + frozen, retail + prepared food, pickup + delivery +
gig-marketplace logistics. The flyer is the merchandising layer for exactly this
archetype. Crucially, the scans can *identify* these merchants, not just reveal
the trend: `has_pickup_ordering` / `has_delivery_option` (migration 337),
`observed_assets` (`verified_on_surface`), and dual-category patterns
(grocery primary + restaurant/food secondary) in the enrichment/campaign data
are all detectable signals. Flyer candidacy should feed the prospect → campaign →
seed → claim pipeline as an explicit signal — e.g., an `observed_assets` entry
for a weekly-specials surface (WhatsApp link, menu board photo, social post
cadence) makes the merchant a flyer upsell target at claim time, not a generic
commerce pitch.

Channel sprawl is the *case for* the flyer, not a scope risk: every channel a
composite merchant adds fragments the announcement (a WhatsApp group here, a
delivery-app listing there, a paper sign on the door). The flyer is the
**bridging surface** — the single canonical "what's on offer" destination that
every channel points back to (group chat, GBP post, directory entry, counter
QR). Fulfillment is a choice behind the CTA — pickup, local delivery, eventually
external — not a competing surface. The platform owns the discovery layer either
way.

### Non-goals (v1)

- No new checkout/cart/pickup machinery — the buyer journey is reused as-is.
- No flyer rendering on unclaimed `directory_presence` seeds (no checkout; seed
  products are force-`inactive` by trigger, migration 319). An operator-authored
  teaser flyer on seeds (SeedPhotoCapturePanel-style bypass) is a possible future
  claim incentive, out of scope here.
- No menu/dining model — a dish is a `product_variants` row on the static
  special item, not a dining-menu entity. Recurring auto-rollover of flyer
  windows is phase 3.
- No EBT claims on flyer items — hot prepared food is generally not SNAP-eligible,
  and the listing-level SNAP badge contract (migration 207) is untouched.

## 2. Capability Contract — module, not a single key

The flyer is **cross-surface**, so it gets its own capability module `flyer` with
per-surface keys — following the `directory_entry` section-key convention rather
than living inside it (the storefront surface would be awkward to gate from
`directory_entry_*`).

| Feature key | Meaning |
|---|---|
| `flyer_enabled` / `flyer_on` | Master module on |
| `flyer_disabled` | Hard off (wins over everything) |
| `flyer_flexible` | Grants all **display** keys |
| `flyer_storefront_on` | Flyer section on `/tenant/[id]` |
| `flyer_directory_on` | Flyer section on `/directory/[slug]` |
| `flyer_place_on` | Flyer section on `/place/[slug]` |
| `flyer_image` | Hero/flyer artwork upload |
| `flyer_items_5` / `flyer_items_10` / `flyer_items_20` | Item-count limits (mirrors `storefront_gallery_limit_*`). Limit resolution = highest granted; `flyer_flexible` → 20. |
| `flyer_frozen` | Frozen twin: `Frozen Specials` item + freeze workflow in the composer + `FrozenSpecialsPanel` on all enabled flyer surfaces. Without it, the frozen item is just ordinary catalog inventory with no merchandising link. |
| `flyer_gbp_publish` | Dual-publish flyer as a GBP `OFFER` post. **Explicit key only — `flyer_flexible` does NOT grant it** (channel-facing action; same precedent as `directory_entry_whatsapp_on`, spec decision D5). |
| `flyer_recurring` | Repeat-window presets (daily/weekly auto-roll). Phase 3. |

**No `flyer_order_cta` key.** Order CTAs are not a flyer grant — they resolve
from the tenant's *commerce* capability + active payment gateway at render time
(`hasActivePaymentGateway`/`commerceDisabled`, same as `FeaturedBucketsShowcase`).
The contract bans `commerce_*`/`checkout_*` below `commitment`
(`no_checkout_below_commitment` invariant), so on browse-only tiers the flyer
renders "available in store" discovery cards automatically. A merchant who wants
an orderable-tier flyer displayed without CTAs uses the per-flyer `cta_mode`
field instead of a capability key.

### Contract workflow (fixture-first, per AGENTS.md)

1. Edit `shared/tier-contract.json` **first**: tier feature grants + list any new
   `TIER_*`/`*_TRIAL_*` map files in `surface_files`.
2. Migration inserts `features_list` rows for the keys above **plus the module
   wiring the resolver needs**: a `capability_type_list` row (`key='flyer'`) and
   `capability_features_list` links mapping every `flyer_*` feature to it (or
   `capability_type_id` on the `tier_features_list` rows — the resolver checks
   both, `EffectiveCapabilityResolver.ts`). Without this the keys land in
   `uncategorized_features` and `effective.flyer` never materializes.
3. Re-dump the DB witness (`doppler run --config prd -- node scripts/dump-tier-contract.cjs`
   → `shared/tier-contract-db-witness.json`), then regenerate `capability_modules`
   via `node apps/api/scripts/sync-fixture-modules.cjs` — the `flyer` module
   grouping is generated, not hand-written.
4. Regenerate tier doc blocks: `node apps/api/scripts/gen-tier-doc-blocks.cjs --write`.
5. New routes → register in `apps/api/src/routes/routeRegistry.ts` and
   regenerate `apps/api/src/generated/route-map.json`.

The `mv_tenant_effective_capabilities` MV aggregates tier grants + purchases +
overrides automatically once the rows exist (≤10-min staleness; refresh cron in
migration 339; `trial_*` keys inherit base-tier grants via the trial_map CTE).
Public/read surfaces use `resolveEffectiveCapabilitiesFromMV`; the flyer
settings page must use `resolveEffectiveCapabilities` (non-MV) so a just-granted
key isn't invisible for 10 minutes.

### Proposed tier grants (subject to fixture edit)

The real ladder (`tier_order` in the fixture): `directory_presence → google_only
→ presence → starter → discovery → storefront → commitment → ecommerce →
omnichannel → professional → organization → enterprise → chain_* → custom`.

| Tier | Keys |
|---|---|
| `directory_presence` | none (gateway chrome only — the `gateway_allowlist` fixture guard makes flyer keys here a contract violation) |
| `discovery` | none (Google surface only — `discovery_no_platform_storefront` invariant bans platform-catalog keys) |
| `storefront` | `flyer_on`, `flyer_storefront_on`, `flyer_image`, `flyer_items_5` — **the headline use case**: browse-only merchants get the flyer as a discovery surface with no checkout |
| `commitment` / `ecommerce` | storefront set + `flyer_directory_on`, `flyer_place_on`, `flyer_items_10`, `flyer_frozen` — order CTAs light up automatically via commerce caps; the frozen twin is a commerce-adjacent workflow (stock tracking, discounted tail pricing), so it starts here |
| `omnichannel` / `professional` / `organization` / `enterprise` | `flyer_flexible` + `flyer_items_20`, `flyer_recurring` |
| any tier with `gbp_posts_scheduler` | `flyer_gbp_publish` |
| `presence` | none — no storefront/catalog surface; revisit `flyer_directory_on` only if presence gains item capacity |
| `starter`, `google_only`, `chain_*`, `custom` | **none — `inactive_legacy`, deprecated.** Deprecated tiers get no new capability grants; existing tenants on them are encouraged to migrate to an active tier rather than accumulating new keys. |

Note: `discovery`, `storefront`, `commitment`, `ecommerce`, `omnichannel` are
`db_only_grant_tiers` — they have no fixture `TIER_FEATURES` entries; their
grants are `tier_features_list` rows in the DB (fixture bags for them need a
documented reason). The fixture-side edit covers the key vocabulary +
`surface_files`; the per-tier grants land via the migration.

### Merchant soft-gates — `tenant_flyer_options_settings`

Mirrors `tenant_featured_options_settings` / the `*_display !== false` pattern in
`DirectoryEntryOptionsResolver`:

| Column | Default | Gates |
|---|---|---|
| `flyer_display` | true | Master merchant toggle |
| `flyer_storefront_display` | true | Storefront surface |
| `flyer_directory_display` | true | Directory entry surface |
| `flyer_place_display` | true | Place page surface |
| `flyer_frozen_display` | true | Frozen panel (only when `flyer_frozen` is granted) |
| `default_title` | `'Featured Specials'` | Composer prefill |

Effective visibility per surface = `flyer_<surface>_on` (tier) AND
`flyer_<surface>_display !== false` (merchant). Resolver output gains a
`flyer` block (`effective.flyer = { enabled, storefront_on, directory_on,
place_on, image, items_limit, frozen, gbp_publish }`), mirroring the
`gbp_management` block consumed by `directory-gbp-public.ts`.

## 3. Data Model — migration `344_tenant_flyers.sql`

```sql
CREATE TABLE tenant_flyers (
  id              VARCHAR(50)  PRIMARY KEY,              -- 'fly-' prefixed
  tenant_id       VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(160) NOT NULL,                 -- "This Week's Kitchen", "Today's Specials"
  summary         TEXT,
  hero_image_url  TEXT,                                  -- flyer artwork (the WhatsApp image)
  starts_at       TIMESTAMPTZ  NOT NULL,
  ends_at         TIMESTAMPTZ  NOT NULL,                 -- generic window: day | weekend | week
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft', -- draft|scheduled|published|expired|archived
  cta_mode        VARCHAR(16)  NOT NULL DEFAULT 'auto',  -- auto|order|view — 'auto' resolves from commerce caps
  share_code      VARCHAR(12)  UNIQUE,                   -- standalone link: /flyer/<code>
  impressions     INT          NOT NULL DEFAULT 0,
  clicks          INT          NOT NULL DEFAULT 0,
  gbp_post_id     VARCHAR(50),                           -- dual-published GBP OFFER post (phase 3)
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_flyer_status CHECK (status IN ('draft','scheduled','published','expired','archived')),
  CONSTRAINT chk_flyer_window CHECK (ends_at > starts_at)
);

-- Live-flyer lookup (the only read pattern the public endpoints use)
CREATE INDEX idx_tenant_flyers_live ON tenant_flyers (tenant_id, ends_at)
  WHERE status = 'published';

CREATE TABLE tenant_flyer_items (
  id                VARCHAR(50)  PRIMARY KEY,            -- 'fli-' prefixed
  flyer_id          VARCHAR(50)  NOT NULL REFERENCES tenant_flyers(id) ON DELETE CASCADE,
  inventory_item_id VARCHAR(255) REFERENCES inventory_items(id) ON DELETE CASCADE,  -- catalog item…
  variant_id        VARCHAR(255) REFERENCES product_variants(id) ON DELETE CASCADE, -- …or dish variant
  sort_order        INT          NOT NULL DEFAULT 0,
  note              VARCHAR(120),                        -- "serves 4", "vegan", "while it lasts"
  CONSTRAINT chk_flyer_item_target CHECK (
    (variant_id IS NOT NULL) <> (inventory_item_id IS NOT NULL)  -- exactly one target
  )
);
-- NULLs are distinct in PG uniques, so each constraint only dedupes its own kind
CREATE UNIQUE INDEX uq_flyer_item_item    ON tenant_flyer_items (flyer_id, inventory_item_id) WHERE inventory_item_id IS NOT NULL;
CREATE UNIQUE INDEX uq_flyer_item_variant ON tenant_flyer_items (flyer_id, variant_id)        WHERE variant_id IS NOT NULL;

CREATE TABLE tenant_flyer_options_settings (
  id                        VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id                 VARCHAR(255) UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flyer_display             BOOLEAN DEFAULT true,
  flyer_storefront_display  BOOLEAN DEFAULT true,
  flyer_directory_display   BOOLEAN DEFAULT true,
  flyer_place_display       BOOLEAN DEFAULT true,
  default_title             VARCHAR(160) DEFAULT 'Featured Specials',
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);
```

**Window semantics.** Public reads match
`status = 'published' AND now() BETWEEN starts_at AND ends_at`. An expiry job
(mirrors `featured-expiration-enforcer` / `featured-products-expiry-monitor`)
flips `published → expired` past `ends_at`; `scheduled → published` at
`starts_at`. No cron is strictly required for correctness if the public query
predicates on the window, but the status flip keeps admin lists honest.

**Windows are store-local, not UTC.** Merchants think "today" / "this week" in
the store's timezone; the composer must compute `starts_at`/`ends_at` from the
tenant's local clock (reuse the timezone handling in `apps/api/src/lib/hours-utils.ts`,
which the business-hours code already relies on) rather than UTC day boundaries —
otherwise a "today only" flyer expires mid-evening in the store's own time zone.

**Concurrency.** Cap live flyers at **2 per tenant** (e.g., a "today" flyer and
a "this week" flyer can coexist); the section renders all live flyers newest-window
first. Enforcement lives in the publish route, not a DB constraint.

`tenant_flyer_options_settings` needs the same RLS treatment as its neighbors —
several `tenant_*_settings` tables carry row-level security; the migration must
mirror whatever policy `tenant_featured_options_settings`/`tenant_fulfillment_settings`
actually have rather than assuming none.

**Dishes are `product_variants` on a stable parent item.** The platform
auto-provisions the parent on first composer open — a flagged `inventory_items`
row (`product_type` marker or metadata flag, `has_variants=true`, generic
name/description so the item page never contradicts the live flyer). Each dish
entry in the composer (name + price + optional stock/photo) becomes a variant;
SKU is auto-generated to satisfy `unique_tenant_variant_sku`. Variant `stock` is
the batch quantity — checkout's per-variant stock check handles sold-out.
`order_items.variant_name`/`variant_id` give receipt fidelity natively.

**Variant lifecycle — the dish repertoire.** Variants accumulate on the parent
as the merchant's **permanent dish library**; each flyer links a subset via
`tenant_flyer_items`. `is_active` means *orderable now*: publish →
`is_active=true` on this flyer's variants; expiry job → `is_active=false` on
variants linked only to expired flyers (never deleted — `order_items.variant_id`
FK has no cascade, and order history needs them anyway). Returning dishes are a
one-checkbox re-enable — a dish from 4 weeks ago is re-linked, not recreated;
its price/history come along unchanged unless the merchant edits it. This makes
kitchens' real cadence (a rotating repertoire, not a new menu each week) the
native workflow. For flyer-level attribution beyond the dish, stamp `flyer_id`
into `order_items.metadata` (JSONB, exists) — powers per-flyer conversion
analytics. Concurrent flyers may share the parent item freely — dishes differ
at the *variant* level, so there is no price conflict (unlike the earlier
flat-item model).

**The frozen twin.** Kitchens freeze unsold dishes and sell them later — the
platform mirrors this with a second auto-provisioned static item, `Frozen
Specials`, whose variants mirror the fresh dishes ("Jollof Rice Plate —
Frozen"). A frozen variant is a `product_variants` row on the frozen parent
carrying `attributes.source_variant_id` → the fresh variant it mirrors (JSONB,
no schema change); it is **not**
window-bound — it stays orderable while `stock > 0`, sold "while supplies last."
Merchant action (at flyer expiry, or anytime): "Freeze N" → composer creates or
tops up the mirrored variant with a quantity and an independent price (frozen
usually sells at a discount). This is the graceful tail of the repertoire
lifecycle: fresh variant deactivates at `ends_at`, its frozen sibling carries
the remaining inventory. The whole frozen capability — twin item, freeze
workflow, and the §4.1a panel — is gated by the **`flyer_frozen`** feature key:
without it, a `Frozen Specials` item is just ordinary catalog inventory with no
merchandising link to the flyer.

**Why not `featured_products`?** Reusing the junction with a new
`featured_type='flyer'` was considered (free priority + expiry machinery), but
the flyer window — not per-item expiry — is the visibility contract, and
`featured_products` has no flyer-scoped grouping. A dedicated junction keeps the
contract clean.

## 4. Surfaces

### 4.1 Storefront `/tenant/[id]`

New `FlyerSection` component rendered above the featured buckets / product grid
in each storefront layout (`StorefrontImmersiveLayout`,
`StorefrontEditorialLayout`, classic path via `ProductSection`). Card: flyer hero
(magazine-style), title + window chip ("Today only" / "Oct 18–24"), horizontal
item carousel. Item cards reuse the standard product card path so add-to-cart,
variants, and pickup eligibility are inherited — `hasActivePaymentGateway` /
`commerceDisabled` props gate the CTA exactly as `FeaturedBucketsShowcase` does.

**Cart continuity is free.** `shopping_carts` is tenant-scoped server-side
(`cart_`/`item_` prefixed ids) — items added from the storefront flyer, the
standalone flyer page, or a deep-linked product all land in the same tenant cart
and flow through the same checkout → `fulfillment_time_slots` pickup path.

### 4.1a Frozen panel — the fresh → frozen link (gated `flyer_frozen`)

A `FrozenSpecialsPanel` renders **directly beneath the `FlyerSection`** on every
flyer surface — when `flyer_frozen` is granted (hard gate) and
`flyer_frozen_display !== false` (merchant soft gate). Content: frozen variants
currently in stock — "Missed it fresh?
It's in the freezer" — each with price, qty-limited framing ("3 left"), and the
same order CTA rules as flyer items (it's a normal `product_variants` add-to-cart
target). The `attributes.source_variant_id` mirror is what makes the panel
contextual rather than generic: when a dish on the *current* flyer also has a
frozen twin, its card can badge "also available frozen," and a dish that just
rotated off the flyer can surface "from last week's kitchen" framing.

**It renders independently of a live flyer.** Between flyer windows the panel
still shows (whenever frozen stock > 0) — the flyer slot never goes dark; on
surfaces where the flyer module is enabled but no flyer is live, the frozen
panel is the persistent occupant. It self-hides only when the frozen item has no
in-stock variants — or the tenant has no frozen item at all.

### 4.2 Directory entry `/directory/[slug]` & place `/place/[slug]`

Self-gating `FlyerSection` **+ `FrozenSpecialsPanel`** dropped into the shared
strip where the GBP sections already render — the `max-w-5xl` block after the
layout in **all four** directory layouts in `StoreDetailClient.tsx` and after
`PlaceEntryEditorialLayout` in `PlacePageClient.tsx`. Same contract as
`GbpPostsSection`: fetch public endpoint, render `null` when `enabled === false`
or there is nothing live/frozen to show.

On these surfaces the flyer is primarily a **discovery + traffic-driver**: item
taps navigate to the storefront flyer section (or the standalone flyer page),
where order CTAs render when commerce gates pass — the order itself always
happens on the storefront surface; there is no in-place checkout inside a
directory entry. The listing's `pickup_offered` fact (migration 337) reinforces
the "pick up in store" story — when a claimed merchant enables pickup in
`tenant_fulfillment_settings`, ops can set `fulfillment_source = 'owner_confirmed'`.

### 4.3 Standalone — `/flyer/[shareCode]` and the stable `/flyer/[tenantSlug]`

Two URL shapes, two jobs:

- **`/flyer/[shareCode]`** — the per-flyer link the merchant drops into a
  WhatsApp group. Server-rendered: hero image, title + live window, item cards
  with order CTAs, pickup summary ("In-store pickup — ready in ~2h — FREE" from
  `FulfillmentOptionsPane` data), store card linking to storefront/directory.
  Expired → store card + "specials have ended" + frozen panel, never a 404.
- **`/flyer/[tenantSlug]`** — the **stable, always-current** landing: resolves
  the tenant's live flyer(s), falls back to most-recent + frozen panel when
  nothing is live. This is the QR target — a printed QR never goes stale
  because the content behind it rotates.

**QR = the physical surface.** `QRCodeGenerator` + `tenant_storefront_qr_settings`
(and the styled-QR work from migrations 340/341) produce a counter/door/receipt
card — "Scan for this week's specials" — pointing at the stable URL. One print,
permanently fresh: the flyer slot's ephemeral content hides behind a permanent
physical artifact. This is also strong claim collateral: a printed "Scan for this week's
specials" card (4×6 counter card / door sticker) can be handed or mailed to a
seeded merchant — its QR resolves to their **live directory listing today**
(seeds can't host flyers), and after claim + upgrade the *same printed card*
starts resolving their actual flyer. The artifact pre-dates the claim; its
meaning upgrades after it. `/f/[code]` shortcode
is available through the letter-prefixed shortcode routes if a shorter link is
wanted for print.

### 4.3a Cards as distribution — merchant hands them to *customers*

The card is not only fixed signage: a claimed merchant gets a **starter pack**
(e.g., 5 cards at onboarding) to hand to customers — bag-drop, counter, receipt
insert. Every scan is a visit to the platform-hosted storefront, so the
merchant's own foot traffic becomes the flyer's acquisition channel. The
**"order more cards"** flow lives in the flyer settings page: packs of
25/50/100. Fulfillment is **fully delegated to a print partner** (Lob/Printful-
class API): the platform renders print-ready art server-side (styled double-
sided card — merchant name, both QRs, both URLs — deterministic from tenant
data), records a `tenant_flyer_card_orders` row, submits the job to the vendor
API, and the vendor prints + dropships to the tenant's address on file. The
platform holds no inventory and touches no shipping; vendor webhooks update
order status (`submitted → printed → shipped → delivered`) surfaced in the
settings page. Optionally priced as a small BSaaS add-on or perk-bundled by
tier — partner cost is ~$0.50–1/card + postage. Cards carry a
`?src=qr` attribution param (or per-batch shortcode) so the flyer analytics
distinguish physical-scan traffic — "your cards drove N visits this week" is
proof-of-channel the merchant can see in their dashboard.

**Card design — one double-sided card (recommended) over two cards.** Front
(customer side): styled QR → `/flyer/[tenantSlug]?src=qr-customer`, "Scan for
this week's specials." Back (merchant side): styled QR → the *manage* URL —
claim link pre-claim, `/t/[tenantId]/settings/flyers` post-claim (auth-gated,
lands on login then through) — "Manage your specials / order more cards." The
stable-URL trick works on both sides: the same printed artifact upgrades its
meaning at claim for the customer *and* for the merchant — front resolves
listing → flyer, back resolves claim → composer. Per-side `src` params keep
the attribution honest. Two separate cards remain the fallback if print
constraints force single-sided.

## 5. API

### Merchant (`/api/tenants/:tenantId/flyers`)

Auth: `authenticateToken` + `checkTenantAccess` + `requireInventoryAccess`
(same middleware stack as `product-featuring.ts`). New route file registers in
`routeRegistry.ts`; `route-map.json` is regenerated after. Hero image upload
reuses the existing multer → Supabase storage pattern
(`inline-tenant-upload.ts` `/api/tenants/:id/logo`, 5MB cap) — the composer POSTs
the image first, then saves `hero_image_url` on the flyer.

| Route | Purpose |
|---|---|
| `GET /` | List flyers (all statuses) |
| `POST /` | Create: `{ title, summary?, heroImageUrl?, startsAt, endsAt, status?, ctaMode? }` — validates `endsAt > startsAt`, item count vs resolved `flyer_items_*` limit, live-flyer cap |
| `PATCH /:flyerId` | Edit fields / reschedule |
| `DELETE /:flyerId` | Archive |
| `PUT /:flyerId/items` | Replace item set — catalog `{ inventoryItemId, … }`, existing repertoire `{ variantId, … }`, or new dish `{ dish: { name, priceCents, stock?, imageUrl? }, … }` (dish entries create variants on the tenant's special parent) |
| `GET /repertoire` | The tenant's dish library — all variants on the special parent, active or not, for the composer checklist |
| `POST /:flyerId/publish` | Publish now or schedule (honors window) |
| `GET /:flyerId/share-assets` | `{ url, caption, qrPayload }` — WhatsApp kit |
| `POST /:flyerId/duplicate` | Copy into a new draft with a fresh window — the "next flyer" workflow |

### Public (no auth)

`GET /api/public/directory/:slug/flyers` — mirrors `directory-gbp-public.ts`
exactly: resolve slug → tenant (same `resolveTenantIdentifier`), check hard gate
+ soft gate, fail closed to `{ success: true, data: { enabled: false } }`.

```json
{ "enabled": true,
  "flyers": [{
    "id": "fly-…", "title": "This Week's Kitchen",
    "heroImageUrl": "…", "window": { "startsAt": "…", "endsAt": "…" },
    "shareUrl": "https://…/flyer/abc123",
    "items": [{ "id": "…", "name": "…", "priceCents": 1299,
                "salePriceCents": null, "imageUrl": "…", "note": "serves 4",
                "orderable": true, "inStock": true }],
    "cta": { "orderEnabled": true, "pickupEnabled": true,
             "pickupReadyMinutes": 120 }
  }],
  "frozen": [{ "variantId": "…", "name": "Jollof Rice Plate — Frozen",
               "priceCents": 1100, "inStock": 3,
               "sourceVariantId": "…", "orderable": true }]
}
```

`orderable` = commerce capability resolved (`checkout_*`/`commerce_*` grants,
commitment+) AND active payment gateway AND `cta_mode != 'view'` AND — per
target — (`inventory_item`: `item_status='active'` AND `visibility='public'` AND
`stock > 0`) OR (`variant`: `is_active` AND `stock > 0`).
`GET /api/public/flyer/:code` serves the standalone page (and increments
`impressions`; item/CTA taps increment `clicks` via a `POST …/events` route,
mirroring promotion analytics).

## 6. Merchant Workflow — `/t/[tenantId]/settings/flyers`

Two paths, by effort:

**Quick path (~1 minute, the default).** Upload the flyer image they'd have
posted to WhatsApp → pick a window preset (*Today / This weekend / This week /
Custom*) → publish. Items optional — an image-only flyer is a complete flyer.
If they want ordering, the composer shows the **repertoire** — every dish
variant ever created on the `Kitchen Special` parent — as a checklist; returning
dishes are one checkbox each, new dishes are just **name + price** (+ optional
qty). `duplicate` preselects last flyer's set — rotate one dish out, one in.

**Power path.** Link real catalog items (a grocer's "this week's imports" flyer);
per-item `note` ("serves 4", "vegan"); per-dish photos.

**Freeze action.** On an expired flyer (or any live dish), "Freeze unsold" tops
up the mirrored variant on the `Frozen Specials` item — suggested quantity
prefilled from the fresh variant's remaining `stock`; price defaults to a
merchant-set frozen discount.

Then:
1. **Publish or schedule** — live flyers show the window chip everywhere.
2. **Share kit** — copy caption + link for WhatsApp ("This week's specials —
   order ahead, pick up in store: {shareCode url}") — the per-flyer link, since
   a group post is about *this* window; plus a **printable QR card** via
   `QRCodeGenerator` + `tenant_storefront_qr_settings` pointing at the stable
   `/flyer/[tenantSlug]` URL — print once for the counter/door/receipt footer,
   always resolves the latest flyer.
3. **Next flyer** — `duplicate` carries the flyer forward into a new draft
   window; the merchant swaps only the image.

## 7. GBP Dual-Publish (phase 3)

When `flyer_gbp_publish` is granted and the tenant has `gbp_management`:
publishing a flyer optionally creates a `gbp_posts` row — `topic_type='OFFER'`,
`media_url` = flyer image, `event_start/end_date` = flyer window,
`call_to_action_url` = flyer share URL — through the existing
`gbpPostScheduler` path. One composer, three surfaces (storefront, directory,
Google).

## 7a. Future Iteration — AI-Assisted Composition & Bot Awareness

Two distinct directions, both built on the platform's existing AI substrate
(prompt registry, seeded templates, zod-validated outputs, bot knowledge
services):

### 7a.1 Authoring — agent-drafted flyers (the scale lever)

The merchant supplies **predictable inputs**: a flyer image upload (the WhatsApp
artwork itself), a free-text brief ("jollof plate $14 vegan, friday"), or last
week's flyer to roll forward. An extraction pass (`prompt_type='flyer_extraction'`,
seeded like the other marketing templates) returns a **structured draft** —
never a publish:

```json
{ "title": "This Week's Kitchen",
  "dishes": [{ "name": "Jollof Rice Plate", "priceCents": 1400,
               "attributes": ["vegan"], "note": "serves 2" }],
  "suggestedWindow": "this_week" }
```

Validation rules (zod, same pattern as `business-analysis.schema.ts`):

- **Never invent a price.** A dish with no parsed price defaults to (a) the last
  price used for the same dish name on this tenant, else (b) the slot default —
  and the field renders flagged *"confirm price"* in the review step.
- Attributes map to a controlled vocabulary (dietary/portion tags → the
  `note` field), mirroring how enrichment prompts constrain output to a known
  vocabulary.
- **Draft-then-confirm is mandatory** — the composer opens the prefilled
  review form (same pattern as the Create Seed form's load-from-prospect: "the
  operator reviews every prefilled field; nothing is saved on load"). The agent
  proposes, the merchant disposes.
- On confirm, dishes materialize as `product_variants` rows on the static
  parent — identical to the manual power path downstream.

This drops recurring effort from ~1 minute to ~15 seconds (upload → review →
publish) and makes the *dish extraction* the product, not the form-filling.

### 7a.2 Surfacing — bot & channel awareness

Live flyers flow into the existing bot context (`BotProductCatalogService` /
knowledge-base sync à la `faq_kb_auto_sync`), so `PublicBotWidget` on the
storefront/directory can answer "what's this week's special?" from the same
`GET /flyers` payload the sections render — one source of truth, no duplicate
content. Flyer data is also natural input for outreach/report surfaces
(prospect report "opportunities" sections) and the GBP dual-publish of §7.

## 8. Phasing

- **Phase 1** — migration 344, `flyer` module keys + resolver block, merchant CRUD
  + composer, storefront `FlyerSection`, `GET /api/public/directory/:slug/flyers`,
  order CTAs wired to existing cart/pickup.
- **Phase 2** — `FlyerSection` on `/directory/[slug]` + `/place/[slug]` strips,
  standalone `/flyer/[code]` page, share kit (caption + QR), impressions/clicks.
- **Phase 3** — GBP dual-publish, `flyer_recurring` presets, flyer analytics
  dashboard card.
- **Phase 4** — AI-assisted composition (`flyer_extraction` prompt, draft-then-confirm
  composer, price-default rules) + bot/directory surfacing of live flyers (§7a).

## 9. Verification

```bash
cd apps/api && doppler run --config local -- pnpm prisma db pull
pnpm prisma:generate
node apps/api/scripts/gen-tier-doc-blocks.cjs --check   # fixture/DB drift
pnpm checkapi && pnpm checkweb
cd apps/web && npx vitest run                            # FlyerSection render tests (Mantine-free pattern)
```

Manual: publish a 1-day flyer on a `storefront`-tier tenant → appears on storefront only;
grant `flyer_directory_on` → appears on `/directory/[slug]`; toggle
`flyer_directory_display=false` → gone. Order CTA absent without gateway, present
with; past `ends_at`, all surfaces return `enabled:false` flyers omitted.

## 10. Risks, Costs & Threats (post-implementation)

### Adoption

- **Empty-flyer risk (highest).** Surfaces self-hide, so a dead feature is
  invisible — which makes it easy to ship and forget. Mitigate: image-only
  quick path, `duplicate`, expiry nudge notifications ("your flyer ends
  Friday — roll it?"), and instrument flyer-creation rate as the launch metric.
- **Cadence decay.** Even habitual WhatsApp posters lapse; an expired flyer
  leaves only the frozen panel. Nudge job before `ends_at` is cheap insurance.
- **Hidden complexity.** The composer must never say "variant" — merchants see
  dishes; variants are plumbing. If the repertoire checklist leaks product-
  admin concepts, adoption dies.

### Operational

- **First-order failure.** Order-ahead hot food requires an order-acceptance
  habit the merchant doesn't have today. One missed pickup poisons the
  channel harder than no feature. Mitigate: order CTAs stay off until the
  merchant completes a readiness step (confirmed pickup instructions +
  notification channel); `storefront`-tier flyers are discovery-only by
  contract anyway.
- **Stock honesty.** `stock` is the sold-out gate — a kitchen that sets 30 and
  has 5 oversells. Composer should prompt batch qty honestly, not default high.
- **Permit-scope visibility (narrower than it sounds).** A licensed grocery's
  kitchen is audited routinely — the cooked meal itself is on-premise and
  visible regardless, so the flyer exposes *nothing about the dish*. The real
  delta is the *sales channel*: a store permitted for on-premise food retail
  may not be covered for order-ahead or delivery, and a published flyer with a
  pickup CTA is a dated, public record of that channel in a way a WhatsApp post
  never was. For properly-licensed kitchen/deli operations (likely most of the
  cohort) this is a non-issue; the edge is the merchant whose informal channel
  exceeds their permit scope. Platform posture: merchant of record owns
  compliance — a terms line and ops awareness, not a feature gate.
- **Public-content moderation.** `hero_image_url` renders on public directory
  surfaces; an uploaded flyer image is unreviewed user content on a platform page.
  Needs at least a report/ops-suppress path (the `suppressed` precedent on seeds
  shows the pattern), even if review stays reactive.

### Data/model

- **Variant graveyard** on the parent item page (open Q3) and frozen-twin name
  drift from `source_variant_id` — both bounded, both real.
- **GMC feed contamination** — a `flyer_special` item leaking into the merchant
  center feed risks feed-quality flags on the *whole* catalog sync, which is an
  existing revenue surface. The exclusion flag is a hard requirement, not a
  nice-to-have.
- **`share_code` entropy** — 12 random chars minimum, non-sequential; public
  share pages must not leak order/customer data (they don't — flyer payload is
  display-only).
- **Attribution inflation** — bot scans and merchant self-scans inflate `?src=qr`
  numbers; report scans as engagement, not proof of demand.

### Cost structure

- **Build:** moderate — mostly composition of existing machinery (tables,
  module keys, composer, sections, public endpoints, expiry job). Net-new:
  card art renderer + print-vendor API.
- **Run COGS:** card perk ~$0.50–1/card + postage — a 25-card quarterly perk is
  ~$15–25/merchant/quarter; only viable perk-bundled at `ecommerce`+. If
  paid-add-on, expect low attach rate.
- **AI extraction (phase 4):** per-flyer LLM call — trivial per-unit cost, but
  only worth it if image-extraction accuracy earns the review step.
- **Support load:** flyer vs. featured buckets vs. coupons vs. GBP posts is
  *four* promotional strips — merchant confusion is a real support cost and a
  UX-dilution risk. The composer must own the "rotating specials" job clearly;
  if merchants can't tell flyer from `seasonal` bucket, one should absorb the
  other.

### Competitive & strategic threats

- **Copyability.** The feature is copyable in a quarter (Square/Shopify). The
  defense is not the flyer — it's the seed→claim→storefront→commerce ladder
  and the accumulated repertoire/order data. Ship fast enough that the *data*,
  not the feature, is the lead.
- **Channel trust.** Some merchants will read the share-link pitch as
  "the platform wants between me and my customers" — WhatsApp is *theirs*.
  Mitigate with positioning: the flyer is a destination they own content on,
  customer accounts stay theirs, cards carry their brand first.
- **Opaque-cargo diversion (expected, unmeasurable, don't fight it).** The flyer
  image is content the platform cannot parse: a phone number, "call to order,"
  an address — all legitimate merchant cargo on the merchant's own surface.
  Customers will see the flyer and call directly, bypassing cart/checkout
  entirely. Suppressing contact info in images is futile and hostile; the
  honest posture is (a) measure what's measurable — impressions, clicks,
  scans — and report phone-driven orders as invisible upside, not leakage, and
  (b) win the conversion on *convenience*, not enclosure: an order-ahead CTA
  with a pickup slot must simply be a better path than hoping the kitchen
  answers the phone. The ship transports the container; it doesn't control
  what the customer does after reading the label.
- **Thin-basket economics.** A $12 plate at payment-processing rates leaves
  thin margin — expect merchants to prefer pay-at-pickup over card online.
  That reduces transaction revenue but *increases* the engagement story
  (order ahead, pay cash at counter). Plan reporting so "orders placed,
  paid at pickup" counts as success, not leakage.
- **Surface clutter.** Flyer + frozen panel + featured buckets + coupon +
  GBP posts can stack into banner blindness — stacking order on the storefront
  needs one owner deciding what wins (spec pins flyer above featured buckets;
  revisit if coupon/promo strips compete).

## 11. Open Questions

1. The `flyer_special` parent item (and its variants, if GMC sync expands them)
   must be **excluded from GMC sync** (`GMCProductSync` pushes the catalog to
   Google Merchant Center; a rotating weekly special is not a merchant-listing
   product and its content drift would misrepresent the feed). An exclusion flag
   on the item (`product_type` marker or metadata) keeps it out of the feed.
2. The static parent consumes `max_skus` like any item — one SKU slot is fine,
   but worth confirming `sku_billing_policies_list` counting doesn't surprise
   `storefront`-tier merchants. Do variants count toward SKU limits? Check the
   counting rule before launch.
3. Variant accumulation is bounded (~52/tenant/year) but old variants surface on
   the parent item's page while `is_active` — the expiry job must deactivate
   them, and the product page should only show currently-orderable variants.
   Confirm the variant picker UX doesn't display a graveyard of past dishes.
4. Should the flyer strip on the storefront sit above or below the category
   sidebar on mobile (`CategoryMobileDropdown` ordering)?
5. Standalone flyer page SEO — indexable, or `noindex` since it's ephemeral?
6. Seed-teaser variant (operator-authored flyer preview on unclaimed listings)
   as a claim incentive — worth a follow-up spec?
7. `/shops` multi-store surfaces (`ShopsFeaturedService`) — out of scope for v1;
   if flyer items ever appear there they need `shop_scope_id` semantics like
   `featured_products`.
8. **Gig-marketplace handoff** — many composite merchants already run delivery
   through gig platforms, and the bridging logic cuts both ways: a flyer item
   could offer "order for pickup" AND "order via delivery app" as parallel CTAs
   (`cta_mode='external'`), keeping the *discovery* on-platform even when the
   last mile goes to a marketplace — the customer relationship started here
   either way. v1 still ships merchant-owned fulfillment only; the strategic
   question for later is not whether gig links are allowed but how to make the
   merchant-owned path (no commission, better margin) the visually default one.
