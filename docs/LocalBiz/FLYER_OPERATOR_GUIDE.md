# Specials Flyer — Operator Guide

Operator-facing runbook for the `flyer` capability module: gating model, grants,
moderation, card-pack fulfillment, GBP dual-publish, and troubleshooting.

Design spec: `docs/LocalBiz/FLYER_SURFACE_SPEC.md` (§2 gating, §8 phasing).
Migrations: `database/migrations/344_tenant_flyers.sql`, `345_tenant_flyer_events_recurrence.sql`,
`346_flyer_live_expansion.sql`, `347_tenant_flyer_keywords.sql`.

> **Positioning:** the flyer is the on-ramp from closed-group distribution
> (WhatsApp-class chats: ephemeral, unindexed, invisible to search) to public
> search surfaces — stable share URLs, indexable standalone pages, directory/
> place strips, GBP posts, and QR cards that always resolve to the current
> flyer. One more reason to be on the platform; promotion requires presence.

---

## 1. What the Flyer Is — Operating Posture

The flyer is a **merchant-authored, time-boxed specials board**. The platform is a
neutral tool: the merchant discovers the capability, authors every flyer
(title, items, prices, image, window), and publishes it. The platform does not
auto-create content — enabling the capability grants the tooling, never the
flyer itself.

Consequences for operators:

- **You never create or edit flyer content.** There is no admin composer.
- **Your levers are capability gates and suppression.** Grant/deny access
  (tier, override, purchase) and suppress a published flyer on reports.
- The merchant is merchant-of-record. Flyer images may contain the merchant's
  own phone number / off-platform ordering — that is allowed; the platform
  offers a better on-platform path but does not block it.

---

## 2. Gating Model

Two capability modules (migrations 344):

| Module | Keys | Meaning |
|---|---|---|
| `flyer` | 13 keys | The flyer capability itself |
| `flyer_gbp` | `flyer_gbp_publish` | GBP dual-publish channel action — kept in its own capability type so `flyer_flexible` expansion never sweeps it in |

`flyer` keys:

| Key | Kind | Effect |
|---|---|---|
| `flyer_on` / `flyer_enabled` | sentinel | Module ON |
| `flyer_disabled` | veto | Module OFF — absolute veto, wins over every other grant. **Never grant it as a punishment you intend to lift by revoking a different key** — use it when you want flyer hard-off |
| `flyer_flexible` | sentinel | Module ON + every active `flyer_*` key (expansion excludes `*_disabled`/`*_off`) |
| `flyer_storefront_on` / `flyer_directory_on` / `flyer_place_on` | surface | Which public surfaces may render the flyer's strip |
| `flyer_image` | option | Hero image upload |
| `flyer_items_5` / `flyer_items_10` / `flyer_items_20` | limit | Max items per flyer (best-match wins) |
| `flyer_live_3` / `flyer_live_5` | expansion | Max **concurrent live flyers** — purchasable BSaaS keys, granted to no tier; `flyer_flexible` sweeps to 5. **Expansion, not activation**: a lone `flyer_live_*` grant does not enable the module |
| `flyer_frozen` | option | Frozen-twin merchandising (frozen copies of fresh variants) |
| `flyer_recurring` | option | `daily`/`weekly` auto-roll presets in the composer |

### 2.1 Tier grant table (seeded by migration 344)

| Tier | flyer keys granted |
|---|---|
| `storefront` | `flyer_on`, `flyer_storefront_on`, `flyer_image`, `flyer_items_5` |
| `commitment`, `ecommerce` | storefront set **+** `flyer_directory_on`, `flyer_place_on`, `flyer_items_10`, `flyer_frozen` |
| `omnichannel`, `professional`, `organization`, `enterprise` | commitment set **+** `flyer_flexible`, `flyer_items_20`, `flyer_recurring` (display keys granted **explicitly** — merge-path `_flexible` expansion does not cover tier grants) |
| all other tiers | nothing → module OFF |

`flyer_gbp_publish`: **no tier holds it** — purchase/admin-grant only (same
posture as `gbp_posts_scheduler`, which no tier holds either).

`flyer_disabled`: **no tier holds it** — it exists only as the operator veto.

### 2.2 Merchant soft gates (R33 — not operator levers)

`tenant_flyer_options_settings` carries the merchant's own toggles: `flyer_display`
(master), per-surface `flyer_storefront_display` / `_directory` / `_place`,
`flyer_frozen_display`, `default_title`. These are the merchant's prefs — a
"flyer doesn't show on my directory" ticket is usually `flyer_directory_display=false`
**or** the tier lacks `flyer_directory_on`. Check both before escalating.

### 2.3 Operator gates summary

| Layer | Who controls | Mechanism |
|---|---|---|
| Tier grant | plan | `tier_features_list` rows (above) |
| Per-tenant override | **operator** | admin feature-overrides (`grant`/`revoke`) |
| Purchase grant | **operator** (or BSaaS bundle when defined) | `flyer_gbp_publish`, `gbp_posts_scheduler` |
| Suppression | **operator** | moderation queue → `status='suppressed'` |
| Merchant prefs | merchant | flyer options page |
| Window lifecycle | system | `flyer-expiry-enforcer` job |

---

## 3. Granting & Revoking Flyer Keys

Admin UI: **Settings → Admin → Feature Overrides**
(`apps/web/src/app/(platform)/settings/admin/feature-overrides`).

API: `POST /api/admin/feature-overrides` (`requirePlatformAdmin`):

```json
{ "tenantId": "<t-...>", "feature": "flyer_gbp_publish", "granted": true,
  "reason": "GBP dual-publish pilot", "expires_at": "<optional RFC3339>" }
```

Typical operator actions:

| Goal | Key(s) | `granted` |
|---|---|---|
| Enable flyer for a tenant below `storefront` (pilot) | `flyer_on`, plus the surface/item keys you want them to have | `true` |
| Give a `storefront` merchant the directory surface | `flyer_directory_on` | `true` |
| Give GBP dual-publish | `flyer_gbp_publish` **and** entitlement `gbp_posts_scheduler` | `true` |
| Raise the item cap | `flyer_items_10` or `flyer_items_20` (best-match wins) | `true` |
| Raise the concurrent live-flyer cap (enables carousel display) | `flyer_live_3` or `flyer_live_5` | `true` |
| Hard-disable flyer for one tenant | `flyer_disabled` | `true` |
| Re-enable after `flyer_disabled` | `flyer_disabled` | `false` (revoke the veto) |

Notes:

- `flyer_flexible` as an override sweeps every active flyer key — convenient for
  pilots, but it also flips on `flyer_recurring`/`flyer_items_20`/`flyer_frozen`.
  Prefer explicit keys when you want a narrower grant.
- Overrides are override-first in `hasFeature`/`resolveEffectiveCapabilities` —
  they beat tier rows. A `flyer_disabled=true` override beats **everything**.
- **Seeds don't get flyers.** `directory_presence` and below hold no flyer keys
  by design: unclaimed listings have no merchant to author content, and
  platform-authored "specials" on a real business would be fabricated
  promotion. Granting keys to a seed would be inert anyway (surfaces render
  nothing without a live flyer). The supported path is a per-tenant comp grant
  **after claim**, or a managed `is_demo` tenant where someone actually
  authors.
- `flyer_gbp_publish` without `gbp_posts_scheduler`: the merchant's
  "publish to GBP" button exists but the post never leaves `SCHEDULED` — the
  scheduler skips the tenant (see §8). Grant both or neither.

---

## 4. Lifecycle

```
draft ──publish──▶ scheduled ──(starts_at)──▶ published ──(ends_at)──▶ expired
   │                                            │
   │                                            ├──suppress──▶ suppressed (ops)
   └──restore──▶ draft (merchant must republish; platform never re-activates)
```

(`archived` exists in the status enum for a future retention pass — nothing
writes it today.)

- Windows are generic `starts_at`/`ends_at` — not hardcoded weekly.
- `flyer-expiry-enforcer` (job catalog: every 5 minutes) flips
  `scheduled→published` at `starts_at` and `published→expired` past `ends_at`,
  rolls `flyer_recurring` successors, then releases orphan dish variants
  (variants referenced only by expired flyers are deactivated).
- A suppressed flyer is off every surface immediately and stays suppressed.

### Surfaces

| Surface | Path | Gate |
|---|---|---|
| Storefront | all 3 layouts, after coupons | `flyer_storefront_on` |
| Directory listing | all 4 layouts | `flyer_directory_on` |
| Place entry | `PlaceEntryEditorialLayout` | `flyer_place_on` |
| Standalone / QR target | `/flyer/[share_code]` | module ON |
| Chatbot | product-search skill context | module ON + `chatbot_skill_product_search` |
| GBP | `gbp_posts` row → GBP post | `flyer_gbp_publish` + `gbp_posts_scheduler` |

Stable links: `share_code` (12-char) → `/flyer/<code>` always resolves to the
tenant's **current** live flyer — printed QR cards never go stale.

**SEO & keywords.** The standalone page is an indexable surface: dynamic
`<title>`/`description`/`openGraph` per flyer, JSON-LD `ItemList` with `Offer`
nodes (price, `validThrough` = window end, `seller` = tenant name), `noindex`
on the dead-end state. Flyers carry optional merchant-authored `keywords`
(`TEXT[]`, max 10 — `tenant_flyers.keywords`, migration 347) feeding meta
keywords + JSON-LD; the AI draft can propose them, the merchant confirms.

**Concurrent flyers & display layout.** A tenant may run multiple live flyers
at once — default cap **2** (`flyer.max_live`), raised to 3/5 by the
purchasable `flyer_live_3`/`flyer_live_5` keys or `flyer_flexible`. Publishing
past the cap returns `409 live_flyer_cap` (scheduled flyers don't count until
live). Display follows the count: **≤2** live flyers render as a vertical
stack (each flyer = title + window pill + hero + item grid, soonest-expiring
first); **>2** switch to a snap carousel with arrows and dots — one flyer per
slide. No flyer → the surface renders nothing at all (fail-closed).

---

## 5. Item Model — How Flyer Items Work

Support questions about flyer items almost always reduce to this model. There
is no per-flyer inventory — items are **links**, exactly one target each
(`PUT /:tenantId/flyers/:flyerId/items` rejects anything else):

| Target | What it is | Order path |
|---|---|---|
| `inventoryItemId` | An existing catalog `inventory_items` row — the composer exposes this via **"Link catalog item"** (`ItemPickerModal`, same picker the item wizard uses) | Normal catalog item — its own price/stock |
| `variantId` | An existing variant on the repertoire parent (re-link re-activates it) | Variant price/stock |
| `dish` | `{name, priceCents?, salePriceCents?, stock?, imageUrl?}` — creates a **new variant** | Variant price/stock |

### The repertoire ("Specials" parent)

First dish ever added auto-provisions one `inventory_items` row per tenant:

- `metadata.flyer_special_parent = true` — this is how it's found
- `visibility = 'private'` — **never shows in the regular catalog/storefront**
- `has_variants = true`, name/title `"Specials"`, price 0 — it is a container,
  not a sellable item

Every ad-hoc dish becomes a `product_variants` row under it
(`variant_name`, `price_cents`, `sale_price_cents`, `stock`, `image_url`).
The composer's "repertoire" picker (`GET /flyers/repertoire`) lists these
variants — yesterday's dish is next week's one-click re-add.

**Operators may see a private "Specials" item in a tenant's inventory and think
it's junk data — it is intentional. Do not delete it** (deleting it orphans
every linked variant's flyer display).

### Lifecycle

- Re-linking a dormant variant sets `is_active = true` again.
- `flyer-expiry-enforcer` deactivates a variant only when **no**
  draft/scheduled/published flyer references it ("orphan release"). A dish on
  next week's scheduled flyer stays active through today's expiry.
- Recurring roll (`flyer_recurring`) clones the successor *before* the orphan
  sweep, so rolled dishes never flicker inactive.
- Stock: variant `stock` is the orderable qty shown on the card (`sold out`
  badge at 0); the platform does not restock — the merchant edits the variant
  in the composer.

### Caps

`flyer_items_5/10/20` — best-match wins (highest granted applies). Exceeding it
returns `tier_restricted` at both save and item-set time.

### Price is optional — orderability follows item completeness

Think of per-item orderability the same way as tier-level commerce: a
price-less dish is the item-level **storefront tier** (display, no cart); a
priced dish is the item-level **commerce tier** (add to cart). The flyer's own
`orderEnabled` remains the tenant-level gate (commerce + gateway) — both must
say yes.

The flyer is a promo surface: real-world flyer artwork often shows no prices.
A `dish` with `priceCents: null` is stored as a variant with
`price_cents = 0` + `attributes.no_price = true`:

- Public payloads map it to `priceCents: null, orderable: false` — cards show
  the name, never "$0.00", never an order button.
- Checkout rejects it (`item_not_orderable`) even if a request is crafted —
  no $0 orders.
- The bot never quotes a price for it.
- It is **not** permanently stuck: the merchant completes the item by adding
  a price (re-add the dish with a price → a priced, orderable variant), or by
  linking a fully-attributed catalog item instead. Orderability always derives
  from the item's own commerce completeness — never from what the flyer shows.

### Frozen twins — **known gap**

Spec §3/§4.1a describes a `Frozen Specials` twin item
(`metadata.flyer_frozen_parent`) whose variants carry
`attributes.source_variant_id` → a fresh variant, plus a composer "Freeze N"
action. **Only the read paths shipped**: the repertoire endpoint and public
flyer payload both query for frozen twins, and `flyer_frozen` /
`flyer_frozen_display` gates work. **Nothing creates the frozen parent or
variants** — there is no freeze action in the composer or API. Until it lands,
the frozen panel can never have content; treat "frozen panel is always empty"
as expected, not a bug.

### AI-draft dishes

"Draft with AI" dishes become ordinary `dish` entries at composer save —
they materialize as variants only when the merchant confirms. The draft itself
persists nothing; flagged `needsPriceConfirmation` items save as price-less
`no_price` promo lines unless the merchant adds a price.

### Discovery from the item workflow

Merchants who arrive through the standard item creation flow
(`/t/<tid>/items`, `/t/<tid>/items/create`, `?create=true`) see a dismissible
`FlyerItemHint` card when the capability is enabled — catalog items belong on
flyers through the composer's "Link catalog item"; name+price specials skip the
wizard entirely. Discovery stays merchant-initiated — the hint points, the
platform doesn't push.

### Dashboard quick link

`GET /api/tenants/:tenantId/quick-links` (`QuickLinksService`) emits a
**Specials Flyer** destination (`/t/<tid>/settings/flyers`, Megaphone icon,
`visibility` category) whenever `effective.flyer.enabled` — gated tenants never
see it. With ≥1 live flyer it shows an "N live flyers" description and a `Live`
badge; otherwise "Promote specials & events". Ranked below setup/storefront/
directory/items so core destinations keep top slots.

---

## 6. Moderation Queue

Admin UI: **Settings → Admin → Flyer Reports**
(`apps/web/src/app/(platform)/settings/admin/flyer-reports`).
API mount: `/api/admin/flyer-reports` (`requirePlatformAdmin`).

Public reports come from `POST /api/public/flyer/:code/report` (the report
button on `/flyer/[code]`) into `tenant_flyer_reports`
(`status`: `open`/`actioned`/`dismissed`).

| Action | Endpoint | Effect |
|---|---|---|
| Suppress | `POST /:reportId/resolve` `{action:"suppress"}` | Flyer → `suppressed`, off all surfaces; the report + sibling open reports → `actioned` |
| Dismiss | `POST /:reportId/resolve` `{action:"dismiss"}` | Report → `dismissed`; flyer untouched |
| Restore | `POST /flyers/:flyerId/restore` | Flyer → `draft` — **merchant must republish**; the platform never re-activates content itself |

Suppression is the designed content lever — the platform does not pre-screen
flyer images/text. Route licensing/permit questions to the merchant
(they are merchant-of-record).

---

## 7. Card Packs & Print Fulfillment

Merchants reorder physical QR card packs from the flyer settings page
(`FlyerCardOrderPanel`): `packSize ∈ {25,50,100}` × `packCount`, shipping
address. The platform renders print-ready art and submits to the vendor —
**it never holds stock or ships**.

Env config (`unifiedConfig`):

| Key | Effect |
|---|---|
| `FLYER_PRINT_LOB_API_KEY` | set → vendor resolves to `lob` (Lob print API; **the live POST is not yet wired** — currently records as stub and logs a warn) |
| `FLYER_PRINT_VENDOR` | `stub` / `manual` / `lob` — explicit vendor pick when no Lob key |
| `FLYER_PRINT_WEBHOOK_SECRET` | shared secret the vendor sends as `token` in the JSON body of `POST /api/public/flyer/card-order-webhook`. **Unset → webhook returns 503 `webhook_not_configured`; wrong token → 401** |

Vendor resolution order: `FLYER_PRINT_LOB_API_KEY` present → `lob`, else
`FLYER_PRINT_VENDOR`, else `stub`.

### Until a vendor contract lands (current state)

`stub`/`manual` both record the order and leave it `submitted` — fulfillment is
manual: download the art PDF (`GET /api/tenants/:tenantId/flyers/card-art`),
print it, then push status via the vendor webhook (with the secret configured)
or update `tenant_flyer_card_orders.status` directly.

### Order lifecycle

`submitted → printed → shipped → delivered` (+`cancelled` from `submitted` only).

The webhook accepts only **forward** transitions; secrets and tenant/order ids
are validated. Card contents: front = customer QR → `/flyer/<share_code>?src=qr-customer`;
back = merchant QR → the flyer settings page.

`tenant_flyer_events` rows with `src='qr-customer'` measure card-pack traffic —
useful when deciding on the vendor contract.

---

## 8. GBP Dual-Publish

Merchant action "publish to GBP" (`POST /:tenantId/flyers/:flyerId/publish-gbp`)
requires **all three**:

1. `flyer_gbp_publish` effective (override/purchase — no tier grants it)
2. `gbp_posts_scheduler` entitlement (`hasFeature` — same override path)
3. flyer `published` or `scheduled`

It dedupes on `(title, starts_at, ends_at)` and inserts a `gbp_posts` row
(`SCHEDULED`, `topic_type=EVENT`, CTA → the always-current tenant slug URL so
the post survives flyer expiry). `gbp-post-scheduler` (every 5 min) picks up
due rows and calls `GBPAdvancedSync.createPost` → `PUBLISHED`/`FAILED`.

Operator checks when a merchant says "GBP button does nothing":

```sql
SELECT feature_key, granted FROM tenant_feature_overrides_list
WHERE tenant_id='<t>' AND feature_key IN ('flyer_gbp_publish','gbp_posts_scheduler');
SELECT id,title,status,publish_at FROM gbp_posts
WHERE tenant_id='<t>' ORDER BY id DESC LIMIT 5;
```

Missing `gbp_posts_scheduler` = rows sit `SCHEDULED` forever.

---

## 9. AI Drafting & Bot (Phase 4)

- `POST /:tenantId/flyers/extract` — text-brief → draft JSON. Gated by
  `flyer.enabled` + inventory access; **never persists**. Flagged items
  (`needsPriceConfirmation`) cannot save/publish until priced — AI never
  invents a price, and repertoire history fills misses by dish name.
- Image flyers cannot be extracted yet — the AI provider interface is
  text-only (`ChatMessage.content: string`). Hero artwork goes through
  `POST /:tenantId/flyers/hero-image` (gated by `flyer_image`; accepts
  multipart `file`, JSON `dataUrl`, or passthrough `url`; stores to the
  TENANTS bucket under `flyer/:tenantId/`).
- Chatbot: specials intent + `chatbot_skill_product_search` + module ON → live
  flyer context is queried per-request (never embedded — too short-lived).
  Only `published` + in-window flyers are injected; suppressed/draft/expired
  content cannot leak.

---

## 10. Observability

| Where | What |
|---|---|
| `tenant_flyer_events` | `impression`/`click`/`add_to_cart` per flyer, with `surface` + `src` (e.g. `qr-customer`) |
| `order_items.metadata->>'flyer_id'` | order attribution (verified against tenant before accepting) |
| Merchant analytics card | `GET /:tenantId/flyers/analytics` — daily series, bySrc, attributed orders. Reported as engagement, **never demand** (phone orders on images aren't counted) |
| Scheduled Jobs UI | `flyer-expiry-enforcer`, `gbp-post-scheduler` run history |
| `tenant_flyer_reports` | moderation input |

---

## 11. Troubleshooting

| Symptom | Check |
|---|---|
| "No flyer settings page" | tier grants (`storefront`+ has `flyer_on`); `flyer_disabled` override; subscription `isReadOnly` |
| Flyer absent on directory only | `flyer_directory_on` tier key AND merchant `flyer_directory_display` pref |
| "Draft with AI" 403 | `flyer.enabled` resolved false (tier/override) — or `extraction_invalid_*` 422 means unparseable brief, advise rephrasing with `name $price` per item |
| Composer Publish disabled | `unconfirmedPrices` — red chips need prices (AI never invents) |
| Flyer never expires/starts | `flyer-expiry-enforcer` in Scheduled Jobs UI |
| Recurring flyer didn't roll | `flyer_recurring` grant at roll time is re-checked — a revoked grant stops the roll; also job health |
| GBP post stuck `SCHEDULED` | `gbp_posts_scheduler` entitlement missing |
| GBP button hidden | `flyer_gbp_publish` not effective |
| Card order stuck `submitted` | vendor = `stub`/`manual` → manual fulfillment expected; check `FLYER_PRINT_*` env |
| Webhook 503/401 | `FLYER_PRINT_WEBHOOK_SECRET` unset (503) or `token` field mismatch (401) |
| Events not recorded | check `tenant_flyer_events` directly; impressions fire on strip render, clicks on CTA tap |
| Ghost "Specials" item in tenant inventory | Intended — private repertoire parent (`metadata.flyer_special_parent`). Do not delete |
| Dish gone after flyer expired | Orphan release — variant deactivates when no live flyer references it. Re-adding re-activates |
| "tier_restricted" saving items | over `flyer_items_*` cap (best-match wins) |
| Frozen panel always empty | Known gap — no freeze write path exists yet (§5) |

---

## 12. Quick Reference

```
Merchant UI      /t/<tenantId>/settings/flyers   (composer, analytics, card orders)
Public page      /flyer/<share_code>
Admin queue      /settings/admin/flyer-reports
Admin grants     /settings/admin/feature-overrides

Merchant API     /api/tenants/:tenantId/flyers[/*]
                 /api/tenants/:tenantId/flyer-options
                 /api/tenants/:tenantId/flyers/extract       (draft-only)
                 /api/tenants/:tenantId/flyers/card-art     (PDF)
                 /api/tenants/:tenantId/flyers/analytics
Public API       /api/public/directory/:slug/flyers
                 /api/public/flyer/:code[/events|/report]
                 /api/public/flyer/card-order-webhook       (vendor, secret header)
Admin API        /api/admin/flyer-reports[/*]
                 /api/admin/feature-overrides

Tables           tenant_flyers, tenant_flyer_items, tenant_flyer_events,
                 tenant_flyer_reports, tenant_flyer_card_orders,
                 tenant_flyer_options_settings
Jobs             flyer-expiry-enforcer (5 min), gbp-post-scheduler (5 min)
Env              FLYER_PRINT_VENDOR, FLYER_PRINT_LOB_API_KEY,
                 FLYER_PRINT_WEBHOOK_SECRET
ID prefixes      fly-/fli-/fle-/flr-/fco-   share_code = 12-char nanoid
Files            apps/api/src/routes/tenant-flyers.ts
                 apps/api/src/routes/public-flyer.ts
                 apps/api/src/routes/admin/flyer-reports.ts
                 apps/api/src/services/{FlyerExtractionService,
                   FlyerCardArtService,FlyerPrintProvider}.ts
                 apps/api/src/jobs/flyer-expiry-enforcer.ts
                 apps/web/src/services/{FlyerService,PublicFlyerService}.ts
```
