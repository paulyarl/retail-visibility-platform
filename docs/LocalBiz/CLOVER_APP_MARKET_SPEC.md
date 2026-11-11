# Clover App Market Listing — Spec for Team Review

Status: **v8** · engineering pass landed 2026-11-11 · most §7 blockers shipped — see per-item status markers
Scope: polish + submission of the VISIBLE SHELF connector listing on the Clover App Market (web/REST app — no APK, no device targets).

## 0. Changelog

### v7 → v8 — engineering pass landed

The §7 blockers were patched 2026-11-11 (commit on `staging`, migration `378`
applied to stg+prd, `BATCH_JOBS_ENABLED=false` set on the Railway standby).
The unbound-install fix shipped as a **generalized onboarding-lane mechanism**,
not the §7.1 signed-cookie sketch — see the marker on that item.

| Item | State |
| --- | --- |
| §7.1 unbound launch | **Shipped (better shape)** — lane-based signup routing, params survive the Auth0 round-trip, post-tenant exit auto-continues OAuth and chains into the Google/GMC connect |
| §7.2 scopes | **Done** — `merchant_r` + `inventory_r` only; sandbox consent re-verify pending reinstall |
| §7.3 token refresh | **Done** — Clover sweep in `oauth-token-refresh`, rotates + persists refresh tokens, stamps `token_expired` on failure; sandbox can't exercise it (non-expiring tokens) — prod verify pending |
| §7.4 disconnect gate | **Done** — tier middleware removed; auth + tenant access kept |
| §7.5 failure states | **Done** — card renders `token_expired` / `failed` / `module_missing` with actions |
| §7.7 launch identity | **Done (partial)** — `client_id` validated; route stays public by design |
| §7.11 trial grant | **Done (superseded)** — `integration_clover` granted on **all three triad tiers** (presence/discovery/storefront), not a single trial grant; `FEATURE_TIER_MAP` → `discovery` in both canonical copies; fixture witness re-synced, contract suite green |
| §7.13 module probe | **Done** — `item_stocks?limit=1` probe at callback; 403/404 → `module_missing` state + merchant-readable error |
| §7.14 duplicate tenant | **Partial** — onboarding already 409s a second trial tenant; explicit `merchant_id` rebind guard still open |
| §7.10 funnel metrics | **Partial** — `lane` id in phase-1 state gives channel attribution for free; no counters yet |
| §7.6 / §7.8 / §7.9 / §7.12 / §7.15 | **Open** — unchanged |

### v6 → v7 — platform control promoted to the headline benefit

Merchant control is the durable advantage, not a secondary bullet. v7 makes it the
first benefit and explains why it is structural rather than a feature gap.

| Change | Why |
| --- | --- |
| §2 "Why platform control is the durable difference" | Control comes from being a tenant with a system of record; Pointy's ceiling is the UPC database, so it cannot copy this without becoming a different product |
| §3 tagline gains a control subline (option B, recommended) | Outcome stays in the hero; control goes in the subline |
| §3 benefits reordered — control is #1 | Clover renders benefits above the description; the first line must be a claim the free incumbent can't make |
| §2.1 pattern 1 annotated | Resolves the apparent conflict between "lead with the outcome" and "lead the benefits with control" |

### v5 → v6 — the ownership split (correction)

v5 called the sync overwrite a blocker on the headline claim. That overstated it.
The Clover lane is one-way and only touches **Clover-mapped** rows, and only two
fields (`name`, `directory_category_id`). Photos and descriptions are never written
by the sync, and `MerchantProductSync` — the platform → SWIS lane — has zero Clover
references, so merchant-created products are structurally immune.

| Change | Why |
| --- | --- |
| §2 "Ownership contract" added | Names the two lanes and which side owns which field — the defensible version of the authority claim |
| §3 authority copy scoped | "Nothing you write is overwritten" is true for platform products, and true for photos/descriptions on synced items; only the *name* of a Clover-mapped item belongs to the register |
| §7.16 downgraded: blocker → copy scoping | Narrowed to 2 fields × mapped items; not a launch gate |
| §10 criterion relaxed accordingly | Verify the scoped claim, not an absolute one |

### v4 → v5 — merchant authority as the differentiator

Pointy's constraint is not only "UPC required" — it is that the **manufacturer's
record is the product**. The merchant has no control over the name, image,
description, or identity of anything they sell. v5 makes that the primary axis of
the positioning, and records the code finding that currently contradicts it.

| Change | Why |
| --- | --- |
| §2 table + "Two axes" paragraph | Coverage and **authority** are separate claims; authority is the defensible one |
| §3 copy: "Your record, not the manufacturer's" | The listing's differentiator now leads with merchant authorship |
| Benefits 3–4 rewritten | "Your record wins" replaces the weaker "presentation layer" |
| **§7.16 added — blocker** | The Clover catalog sync **overwrites** merchant-edited `name` and `directory_category_id` on every sync (`updateExisting = true` by default). Until fixed, the headline claim is false |
| §10 criteria | Adds record-authority survival checks |

### v3 → v4 — Pointy pattern applied

Pointy is the incumbent and the category template (now Google's Local Inventory
app). Its listing structure and monetization model are the pattern merchants will
compare us against, so v4 adopts both and records where we must deliberately
differ.

| Change | Why |
| --- | --- |
| New §2.1 — Pointy as the pattern | Evidence + the eight structural patterns to copy |
| §3 rewritten outcome-first with a Requirements block | Pointy's listing leads with the customer outcome and discloses eligibility explicitly; ours led with mechanism |
| §6.6 marked **REOPEN** | Pointy's free tier is permanent and functional. Auto-disconnect at day 30 is the anti-Pointy move. See §6.7 |
| §6.7 added — "Pointy-proof" pricing | Free tier must do something real; paid for depth/ads. Mirrors the incumbent's ladder |
| §7.11 corrected | A `trial_starter` is impossible (`starter` is inactive_legacy) and `presence` doesn't satisfy the gate. The Clover trial must be `trial_discovery` |
| §8 adds App Market Spotlight pitch | Pointy's Clover distribution came from an editorial spotlight, not the listing alone |
| §9.2 adopts Pointy's cancellation sentence | Their answer to the retention question is the sentence reviewers expect |
| §10 adds zero-manual-work + eligibility criteria | Both are claims Pointy makes and we currently cannot |

### v2 → v3 — decisions settled

| # | Decision | Resolution | What it creates |
| --- | --- | --- | --- |
| 6.5 | Fresh-install destination | **New-tenant registration flow**, landing in an integration-capability-aware tier | §7.1 rewritten; §7.11, §7.14 |
| 6.1 | Pricing vs Starter gate | **30-day trial auto-granted on install** | §7.11, §7.12, copy in §3 |
| 6.2 | Merchant availability | **All Clover plans** | §7.13 (Inventory-module detection) becomes mandatory |
| 6.3 | Categories | Inventory Management + Retail, positioned as a **product visibility connector** | §2 reframed, §3 revised |
| 6.4 | App name | `VisibleShelf — Local Inventory Sync` | Verify Clover name-length limit (35 chars) |
| 5 | Support contact | `support@visibleshelf.com` | §5 closed |
| 6.6 | Trial expiry | **Auto-disconnect** at day 30 | §7.12 — **reopened in v4, see §6.7** |

### v1 → v2 — code review corrections

| v1 claim | v2 state |
| --- | --- |
| §5 "Launch path — Done … auto-continues OAuth" | **Partial.** Route exists; the unbound branch 404s and `?clover=installed` is consumed by nothing. |
| §5 "Permissions … do NOT request Write" | **Not true of the code.** `REQUIRED_SCOPES` still requests `inventory_w`. |
| §7.6 "`oauth-token-refresh` needs a Clover branch" | Promoted to **blocker** — no refresh exists. |
| §8 "Uninstall webhook … phase 2" | **Blocker.** With tier-gated disconnect there is no revocation path at all. |
| §8 `BATCH_JOBS_ENABLED` / lease checks | Moved to the cutover runbook. |

## 1. Why this document exists

The sandbox connector is proven end-to-end for an **already-bound merchant**
(OAuth → encrypted tokens → `item_stocks` → reconciled inventory → SWIS/Google →
one-click launch → connected, verified 2026-11-11). Before we file the
**production** developer account + app, the listing must be polished: copy,
branding, media, legal links, pricing, and a defensible rationale — because it has
to convince two audiences at once:

1. **Clover's review team** — legitimacy, compliance, permission justification, a real product.
2. **The merchant browsing the market** — "why this, when Google's Local Inventory app is free?"

## 2. Positioning — a product visibility connector

**Decision (6.3):** the app is a **connector between the Clover register and
Google's local inventory surfaces (Maps / SWIS)** — the same slot Pointy occupies,
but with the merchant in control because they are a platform tenant, not a feed
endpoint.

| | Google Local Inventory app (free) | VISIBLE SHELF |
| --- | --- | --- |
| Catalog coverage | UPC/EAN-barcoded items only | Every synced item + platform-only items |
| **Record authority** | **The manufacturer's UPC record** — Google supplies the name, image and description; the merchant has no say | **The merchant's own record** — their name, their ID, their photos, their description, their categories |
| Identification | Manufacturer UPC/EAN only; self-generated barcodes explicitly not supported | Merchant-defined IDs, plus products with no barcode at all |
| Presentation | None — manufacturer data decides | Merchant-authored description, categories, and **up to 11 photos per product** (1 primary + 10 additional) |
| Surfaces | Google only | Google + tenant storefront/local pages |
| Items beyond the register | No | Yes — "platform-only" catalog |
| Merchant control | None | Full tenant control of the catalog |
| Pricing | Free, permanently | Free tier + paid depth (§6.7) |

**Two axes, not one.** Coverage — "which items can appear" — is only half the
claim. The second axis is **authority**: who defines what the product *is*.

Pointy is a **matcher**. It reads UPC/EAN from the POS, looks the code up in
Google's product database, and publishes the manufacturer's name, image and
description. The merchant cannot override it, cannot supply their own identifier,
and cannot list an item that has no manufacturer code. The product record is never
theirs.

VisibleShelf is an **authoring surface**. The merchant's product record is the
source of truth. They photograph it, describe it, categorize it, give it their own
identifier, and create products from scratch — including ones no barcode database
knows. For a Clover-mapped item the register keeps the name, price and stock;
everything about how that product looks and reads is the merchant's. Authority is
the more defensible difference, because it still holds when both products manage to
show the same item on Google.

**The ownership contract.** There are two lanes, and each side owns what it should:

| Lane | Direction | Owns |
| --- | --- | --- |
| Clover → platform | one-way | `stock`, `price`, and the item **name** of a Clover-mapped item — the register's facts |
| platform → SWIS | one-way, **independent of Clover** | `description`, photos (up to 11), categories, and the entire record of merchant-created products |

A Clover sync can only touch rows that carry a Clover mapping; merchant-created
products have none, so nothing the merchant writes there can be overwritten. On
mapped items the sync writes name / price / stock / category and **never** touches
description or images. Pointy has no equivalent lane — its catalog is a projection
of the UPC database, not a record the merchant authors.

**Why platform control is the durable difference.** The gap is not a feature we
could lose to a competitor's roadmap; it is structural.

- Pointy's ceiling *is* the UPC database. Letting a merchant author their own
  catalog would mean it stopped being a matcher — and Google's incentive is to
  normalize local inventory data across ~24 POS systems, not to host per-merchant
  product records.
- Our control comes from being a **tenant with a system of record**, not a
  connector. Photos, descriptions, categories, identifiers, platform-only products
  and storefront surfaces all read from the same merchant-owned record, so every
  new surface inherits it.
- It is also why the paid tier can be about breadth and presentation (§6.7) instead
  of holding sync hostage: **sync is the commodity, control is the product.**

For the listing this means **control leads the benefits**, not trails them — it is
the only claim on the page the free incumbent cannot make.

Other listings checked: QuickSync / SKU IQ / Kosmos / Ecwid bridge Clover → e-commerce platforms (Shopify, Amazon); Thrive is inventory analytics. None address local-search presentation.

**Positioning rule:** we do not argue against the free app — we complete it. Name
the gap (barcode-locked, no curation, no merchant control) rather than claiming
generic "sync," which reviewers will see as redundant.

**Copy rule:** "SWIS" is an internal lane name. Merchant-facing copy says
**Google Maps** / **local inventory**, never SWIS.

## 2.1 Pointy as the pattern (verified 2026-11-11)

Pointy was acquired by Google in Jan 2020 and is now **the Local Inventory app**
(the "Pointy box" is now the product reader). It is free, installed on Clover and
~24 other POS systems, and it is the app every merchant will compare us to. Its
listing structure is the template to work from.

**What Pointy actually says**

- Problem-first, in Clover's own words: local stores are never found for product
  searches "even if someone is searching for their best-selling item 50 feet from
  their door," because Amazon and large retailers dominate results.
- Promise: *"Your potential customers can check what's in stock, then come to your
  store to make the purchase."* Not "sync," not "integrate" — foot traffic.
- Mechanism claim: *"Your product details, images, and stock status are all done
  automatically — no manual entry needed."*
- Surfaces enumerated exactly: Business Profile, Google Search, Google Maps, the
  Shopping tab.
- **Eligibility disclosed in-listing**: physical storefront, verified Business
  Profile, products with manufacturer (UPC/EAN) barcodes, eligible country
  (US/CA/UK/IE/AU), eligible vertical — plus what to do if ineligible (manual
  Product Editor).
- Clover badge: **"Free Version Available / View Subscription Pricing."**
- Monetization: core free **permanently** (full in-store inventory listing,
  organic Google listings, See What's In Store). Paid depth = Local Inventory Ads
  (pay-per-click) + insights. Month-to-month; on cancel the account is deleted and
  all products are removed.
- Distribution came from an **App Market Spotlight** editorial post on Clover's
  blog plus POS-partner co-marketing, not the listing alone.
- Social proof: a merchant testimonial in the listing.
- Setup claim: *"It takes less than a minute to get set up."*

**The eight patterns to copy**

1. **Lead with the customer outcome, then the mechanism.** Our §3 led with "what it
   does"; Pointy leads with "customers check stock, then walk in." We apply this to
   the hero line. The benefit list is the deliberate exception — see §3.
2. **"No manual entry" is the headline.** Our copy says "attach photos once," which
   reads as work. Photos must be presented as optional polish — an item goes live
   from Clover data alone.
3. **Disclose eligibility in the listing**, including the ineligible path. We need
   the same block (Inventory module, verified GBP, country, vertical).
4. **Enumerate surfaces exactly.** "Google local search" is vague; list Business
   Profile products, Search/Maps, and the tenant storefront.
5. **Free tier that works, paid for depth.** See §6.7.
6. **State what happens on cancel** — deletion and product removal. This is the
   retention answer reviewers ask for (§9.2).
7. **Carry a merchant testimonial.**
8. **Ask Clover for an App Market Spotlight**, and pitch POS partners directly.

**Where we must deliberately differ**

- Pointy is free because Google subsidizes it to win local inventory data. We
  cannot match unlimited free sync, but we also cannot charge at day 30 while the
  incumbent stays free. The resolution is a **capped free tier** (§6.7), not a
  trial wall.
- Pointy **requires** UPC/EAN, explicitly excludes self-generated barcodes, and
  even for barcoded items publishes the *manufacturer's* record. Those are two
  distinct gaps: **coverage** (items with no manufacturer code) and **authority**
  (who defines the record). Both are our addressable market, and authority is the
  larger one — it applies to every item the merchant sells, not just the unbarcoded
  tail. Frame them as capability statements — "works whether or not your items have
  barcodes" and "your record, not the manufacturer's" — never as a competitor
  attack, and never name Pointy in the listing.

## 3. Listing copy — draft (v4, Pointy-structured)

### Tagline

- Hero: **Your register knows what you stock. VisibleShelf makes it findable.**
- Subline (option A, category): **The connector between your Clover register and Google Maps.**
- Subline (option B, differentiator — recommended): **Findable on Google Maps — with a catalog that stays yours.**

Hero carries the outcome (foot traffic); the subline carries the control. That
split lets the outcome stay the hook without spending the first line on a claim the
free incumbent also makes.

### Short description

> Help shoppers find what you stock before they visit. VisibleShelf connects your
> Clover register to Google Maps — every item, not just the barcoded ones, and each
> one described the way you want it described. Barcode-matching tools publish a
> manufacturer's record and leave you no say in it. VisibleShelf makes *your*
> product record the source of truth: your name for it, your own ID, your photos,
> your categories — including products no barcode database has ever heard of.

### Long description (for the details page)

> **What it does**
> VisibleShelf connects your Clover register to Google Maps and your own online
> storefront. What you stock and what it costs stay current automatically, so
> shoppers checking nearby see your real shelf, not last month's.
>
> **Why it exists**
> Clover items carry no photos, and Google's own inventory app only surfaces
> products with manufacturer barcodes. If you sell house brands, bulk goods,
> specialty items, or anything without a UPC, your best products never appear.
> And when a barcode does match, the *manufacturer's* record is what gets
> published — their name for the product, their image, their description. You
> never get a say in it.
>
> **Your record, not the manufacturer's**
> On VisibleShelf your product record is the source of truth. Give an item your
> own name, your own ID, your own photos and categories — for barcoded items as
> well as ones no barcode database knows. Products you create on VisibleShelf are
> yours outright: no Clover sync can overwrite them, and on synced items your
> photos and descriptions are never touched either. Stock, price and the item name
> come from Clover — everything about how the product looks and reads is yours.
>
> **Up to 11 photos per product**
> Show your packaging, your shelf, your angles — not a stock image a manufacturer
> chose years ago. VisibleShelf publishes one primary photo plus up to ten more per
> product to Google, alongside your description and categories.
>
> **No manual entry**
> Your product names, prices, and stock come straight from Clover. You don't type
> anything to get listed. Photos, descriptions, and categories are there when you
> want them — not a prerequisite to go live.
>
> **Beyond the register**
> Not everything you sell is on the register. Platform-only items — special
> orders, services, not-yet-keyed products — list right alongside POS inventory.
>
> **Where your products appear**
> - Your Google Business Profile products
> - Google Search and Google Maps
> - Your VisibleShelf storefront and local pages
>
> **What you need**
> - A Clover account with the **Inventory** module
> - A verified Google Business Profile
> - A physical storefront (US, Canada, UK, Ireland, or Australia)
>
> If you don't have a Business Profile yet, VisibleShelf can help you claim and
> verify one.
>
> **How it works**
> Connect → automatic sync every 15 minutes → optionally add photos → live. Your
> Clover data stays the source of truth; we never write back to your register.

**Disclosures required by the settled decisions:**

- **Module requirement** — stated in "What you need" (6.2 + §7.13).
- **Pricing** — the free/paid split per §6.7, whatever it resolves to. The App
  Market FREE badge plus an undisclosed paywall is the bait-listing pattern
  reviewers flag.
- **"We never write back"** is only defensible once §7.2 lands. If `inventory_w`
  ships, cut the sentence.

### Benefits (Clover requires ≥2; Pointy uses 5 — ours should match that shape)

1. **Your catalog, your control** — your names, your IDs, your photos, your descriptions, your categories. Not a manufacturer's record you can't touch.
2. **Every item, barcoded or not** — house brands, bulk goods, and anything with no manufacturer UPC.
3. **Up to 11 photos per product on Google** — your packaging and your angles, not a stock image chosen by someone else.
4. **Sell beyond the register** — special orders, services, and products you create on VisibleShelf list alongside POS inventory.
5. **Found before they visit** — shoppers see what's in stock nearby, then come in to buy. Stock and price flow from Clover automatically.

**Why control is benefit 1.** Clover renders benefits above the description, so
these five lines are the decision surface — and the first one has to be something
the free incumbent cannot say. Benefits 1–4 are all control or coverage claims
Pointy structurally can't make; benefit 5 is the category promise, kept as
reassurance rather than spent in the prime slot. The outcome still leads the page,
but it leads through the hero line, not the benefit list.

The 11-photo figure is already true in code (§7.17), so it ships as written.

### 3.9 Paste-ready field block (v8 — FREE listing + disclosed platform tiers)

Pricing shape resolved for the listing fields below: **Clover-side FREE**
("This app will not be billed to your account") with platform tiers disclosed
in the description — one billing source of truth, honest FREE badge (§6.7
Option B is the pending decision that would change the "Pricing" paragraph;
if Clover-billed plans are chosen instead, replace that paragraph with the
plan table).

**App name** (≤126 chars):
```
VisibleShelf — Clover Inventory to Google Search & Maps
```

**Tagline** (≤255 chars):
```
Your register knows what you stock. VisibleShelf makes it findable — on Google Maps, with a catalog that stays yours.
```

**Short description:**
```
Help shoppers find what you stock before they visit. VisibleShelf connects your Clover register to Google Maps — every item, not just the barcoded ones, and each one described the way you want it described. Barcode-matching tools publish a manufacturer's record and leave you no say in it. VisibleShelf makes your product record the source of truth: your name for it, your own ID, your photos, your categories — including products no barcode database has ever heard of.
```

**Merchant benefits** (each ≤100 chars, verified):
```
Your catalog, your control — your names, photos and descriptions, not a manufacturer's record
List every item, barcoded or not — house brands and specialty goods included
Up to 11 photos per product on Google — your packaging, not a stock image
Sell beyond the register — special orders and services list alongside POS items
Found before they visit — stock and price flow from Clover automatically
```

**Description** (long — §3 long description plus the Pricing paragraph. Field-safe variant:
Clover's Description field strips newlines and HTML-escapes ASCII apostrophes into
`&#39;`, so headers carry em-dash separators and the text avoids apostrophes
entirely, and the field truncates past ~2.5-3K chars so this compressed
variant (≈1.8K, PRICING placed early enough to survive truncation) is what to
paste — exactly this):
```
WHAT IT DOES — VisibleShelf connects your Clover register to Google Maps, Google Search, and your own online storefront. Stock and prices stay current automatically, so shoppers nearby see your real shelf.

WHY IT EXISTS — Clover items carry no photos, and the Google inventory app only surfaces products with manufacturer barcodes. House brands, bulk goods, anything without a UPC — they never appear. When a barcode does match, the published record belongs to the manufacturer: their name, their image, their description.

YOUR RECORD — Your product record is the source of truth: your names, your IDs, your photos, your categories. Products you create on VisibleShelf are yours outright — no Clover sync can overwrite them — and on synced items your photos and descriptions are never touched. Stock, price, and item name come from Clover; how the product looks and reads is yours.

UP TO 11 PHOTOS PER PRODUCT — Your packaging, your angles — not a stock image. One primary photo plus up to ten more per product publish to Google alongside your description and categories.

NO MANUAL ENTRY — Names, prices, and stock come straight from Clover. You never type anything to get listed.

BEYOND THE REGISTER — Platform-only items — special orders, services, not-yet-keyed products — list right alongside POS inventory.

PRICING — Connecting Clover and syncing inventory is free. Presentation features — photos, descriptions, platform-only items, storefront publishing — are part of VisibleShelf plans with a free trial; see visibleshelf.com for current plans. Cancel any time; disconnecting removes your access tokens.

WHAT YOU NEED — A Clover account with the Inventory module and a verified Google Business Profile.

HOW IT WORKS — Connect, automatic sync every 15 minutes, live. We never write back to your register.
```

**Legal & Privacy:**
- Privacy policy URL: `https://visibleshelf.com/privacy`
- Terms URL: `https://visibleshelf.com/terms`

**Developer Support:**
- Email: `support@visibleshelf.com`

**Pricing & Subscription Information:** keep the single FREE plan — no
Clover-billed subscription tiers (platform tiers disclosed in the description
instead; revisit if §6.7 resolves to Clover-side billing).

## 4. Media assets — spec

| Asset | Requirement | Proposed |
| --- | --- | --- |
| App icon | Square, on-brand at small size (replaces the default clover-flower placeholder) | VisibleShelf mark on brand background; export at Clover's required sizes |
| Screenshots | ≥1 required; tell the story in order | See shot list below |
| Banner/collection art | Optional, for featured placement | Defer until approval |

**Screenshot shot list** (real product, not mockups):

1. **Connected card** — Clover POS card showing Connected, 4/4 items synced, last-sync timestamp. Proves the plumbing works.
2. **Item card** — a POS item showing `In Stock · Stock: 30` and the `Syncing to Google` badge. Proves stock flows to Google.
3. **Mappings tab** — `4 synced from Clover · 42 platform-only` chips + the two-table layout. The "beyond the register" argument in one image.
4. **Photo gallery** — item photos modal (0/11 → with photos). The presentation layer, made visual.

Annotations: short captions under each shot ("Real stock from your register, every 15 minutes" / "Items that live beyond the register").

**Pointy-pattern addition:** one shot should show an item with **no photo and no
manual entry** still listed — that is the "no manual entry" claim made visual, and
it is the thing Pointy cannot do for a non-barcoded item.

**Screenshot hygiene:** re-shoot after the environment cutover (§7.6).

## 5. Compliance & legal

| Requirement | State |
| --- | --- |
| Privacy policy URL | **Done** — `visibleshelf.com/privacy` (incl. `/privacy/ccpa`) updated Nov 2026: POS/integration data + encrypted OAuth tokens disclosed in §1; disconnect/uninstall deletes credentials + stops syncing in §5; disconnect listed in §6 choices. |
| Terms / EULA URL | **Done** — `visibleshelf.com/terms` updated Nov 2026: §5 covers integration authority, consent-screen permissions (Clover read-only, no write-back), and disconnect/uninstall stopping sync + removing stored credentials. |
| Support contact | **Settled: `support@visibleshelf.com`.** Same inbox as lead intake (`EMAIL_SUPPORT`). Confirm monitoring SLA. |
| Permissions justification | **Done** — code requests Inventory **Read** + Merchant **Read** only (§7.2). Re-verify the consent screen on next reinstall. |
| Launch path | **Done** — bound merchants route to their tenant; unbound route into the `clover_market` signup lane → tenant creation → auto-OAuth → GMC chain (§7.1). `client_id` validated. |
| Reviewer enablement | **Missing** — test-merchant credentials, "how to test" steps, demo video. |
| App name | **Settled (v8): `VisibleShelf — Clover Inventory to Google Search & Maps`** (55 chars — Clover dashboard confirmed the field allows 126). Supersedes `VisibleShelf — Local Inventory Sync`; names the source→destination surface instead of the generic pipe. |
| Categories | **Settled:** Inventory Management (functional), Retail (vertical). |

## 6. Configuration decisions

### Settled

| # | Decision | Resolution |
| --- | --- | --- |
| 6.1 | Pricing model | Free listing + 30-day trial auto-granted on install *(trial mechanism under review — §6.7)* |
| 6.2 | Merchant availability | All Clover plans |
| 6.3 | Categories / positioning | Inventory Management + Retail; product visibility connector |
| 6.4 | App name | `VisibleShelf — Clover Inventory to Google Search & Maps` (v8 — SWIS destination named; "See What's In Store" stays out of the title to avoid implied-endorsement flags) |
| 6.5 | Fresh-install destination | New-tenant registration flow → integration-capability-aware tier |

### 6.6 REOPENED — trial expiry

Settled in v3 as **auto-disconnect at day 30** (clear tokens; reconnect after
upgrade). The Pointy review undermines it: the incumbent's core product is free
**permanently**, month-to-month, with no expiry. A merchant comparing the two
listings sees "free forever" beside "free for 30 days," and the free one has better
distribution (Google-owned, pre-installed, featured by POS partners).

Auto-disconnect also has a mechanical cost we now know about: it requires the
tier-ungated token-clearing path in §7.4, warning comms, and idempotency against a
mid-run clear (§7.12) — real work for a conversion-negative outcome.

**Options:**

- **A. Keep auto-disconnect** (v3 decision). Cleanest data hygiene, sharp upgrade
  moment, weakest against a free incumbent.
- **B. Permanent free tier, capped** (§6.7 — recommended). Free sync for a capped
  catalog (e.g. 50 items) on Google only; paid unlocks unlimited items, photos,
  storefront, ads. Matches the incumbent's shape without giving away the
  presentation layer that is our differentiator.
- **C. Soft-limit** — keep syncing but stop Google push at the cap. Free tier looks
  broken in Google, which is worse than a cap the merchant can see in-product.

### 6.7 "Pointy-proof" pricing (new — decision required)

The tier ladder already supports this: `directory_presence` is $0 and the default
tier; `discovery` ($29, "Nearby") is the Google-surface rung and the one that
carries `integration_clover` in practice (see §7.11). Proposed shape:

| | Free (`directory_presence`) | Paid (`discovery`+) |
| --- | --- | --- |
| Clover connect + sync | Yes, capped (e.g. 50 items) | Unlimited |
| Google surfaces | Yes | Yes |
| Photos / descriptions / categories | No | Yes |
| Platform-only items | No | Yes |
| Storefront surfaces | No | Yes (higher tiers) |

This keeps the FREE badge honest, keeps install friction at zero, and puts the
paywall where the value is (presentation and breadth) rather than at the OAuth
wall — the same place Pointy puts it (ads and insights).

## 7. Engineering gaps — blockers and copy scoping

Verified against the code 2026-11-11, extended for v3 decisions and the Pointy
pattern.

**Blockers** (§7.1–7.14) gate filing. **§7.16–7.17** are copy-scoping and
verification notes — they constrain what the listing may claim, not whether it can
be filed.

**7.1 Launch path does not survive a fresh install. — SHIPPED (better shape)**
*Shipped 2026-11-11 as the generalized **onboarding-lane** mechanism rather than
the signed-cookie sketch below:* the launch route resolves bound merchants to
their tenant; unbound installs redirect to
`/auth/signup/wizard?lane=clover_market&merchant_id=…`. The lane
(`apps/web/src/lib/onboarding/lanes.ts`) declares the preselected tier
(`discovery`) and the post-tenant exit; it persists through the Auth0 round-trip
in `onboardingStateService` phase-1. After tenant creation every onboarding exit
routes to `/t/{id}/settings/integrations?clover=installed` → auto-OAuth → on
success, if GMC is unavailable, `?from=clover` auto-continues into the Google
connect — the lane's real completion state. The `/signup` and `/auth/signup`
redirect stubs were also fixed to forward query params. Remaining delta vs. the
original design: `merchant_id` rides as an advisory param (no signed cookie) —
binding still happens at the OAuth callback — and the explicit
already-bound-rebind guard is §7.14.

*Original problem statement (for the record):*
`GET /clover/launch` resolved the tenant from `merchant_id`; unbound merchants
hit a nonexistent `/settings/integrations` route.
*Fix (per 6.5):*
1. Unbound launch → public `/clover/install?merchant_id=…`, stashing `merchant_id`
   in a **signed** cookie (24h — must survive onboarding), then Auth0 universal
   login.
2. Auth0 handles both branches: existing user → sign in; new user → registration.
3. After login: if the user has tenants → bind `merchant_id`, continue OAuth. If
   none → onboarding creates the tenant, assigns the Clover trial tier (§7.11),
   binds `merchant_id`, continues OAuth.
4. Never create a tenant for a user who already has one (§7.14).

**7.2 Over-scoped permissions. — DONE**
`REQUIRED_SCOPES` is now `merchant_r` + `inventory_r` only
(`apps/api/src/services/clover-oauth.ts`); `formatScopesForDisplay` no longer
advertises write. Remaining: re-verify the sandbox consent screen + full stock
sync on the next reinstall, since the granted permission lives on the install.

**7.3 No Clover token refresh. — DONE**
`oauth-token-refresh` now sweeps `clover_integrations_list` for rows with a
`refresh_token` expiring inside the threshold, refreshes via
`refreshAccessToken`, **persists the rotated refresh token** when Clover returns
one, and updates `token_expires_at`. Runs unconditionally (not gated on
`oauth_tokens` rows). Refresh failure stamps `last_sync_status='token_expired'`,
which the card renders with a Reconnect action (§7.5). Sandbox can't exercise it
(non-expiring tokens) — verify on the first prod integration.

**7.4 No revocation path. — DONE**
`requireTierFeature('integration_clover')` removed from
`POST /:tenantId/clover/disconnect`; `authenticateToken` + `checkTenantAccess`
remain, so a lapsed tier can never trap a merchant's tokens. The uninstall
webhook also landed ahead of schedule: `/api/webhooks/clover` now handles `A:`
app events — `UNINSTALL`/`DELETE` disconnects the integration (clears tokens,
`status='disconnected'`, `last_sync_status='uninstalled'`) and logs every app
event for payload-shape observability. `CLOVER_WEBHOOK_SECRET` is set on prod
and the App subscription is enabled in the dashboard; verify on the next
uninstall.

**7.5 Failure is invisible. — DONE**
`CloverConnectionCard` takes `lastSyncStatus` and renders three honest states:
`token_expired` (red banner + Reconnect button), `module_missing` (amber,
explains the missing Inventory module), `failed` (amber, points at History).
Wired on both integrations pages; `CloverIntegrationData` exposes the field;
`useCloverIntegration` maps `inventory_module_missing` / `oauth_denied` /
`state_expired` to readable messages. `trial_ended` / `cap_reached` remain
pending §6.6/§6.7 (§7.12).

**7.6 The environment cutover breaks the sandbox lane.** `cloverApiBaseUrl()` reads
one process-wide `CLOVER_ENVIRONMENT`, while the OAuth callback writes sandbox
integrations as `mode: 'production'`. Flipping to production re-points every
sandbox integration at `api.clover.com` with a sandbox token → 401.
*Fix:* purge/flag sandbox rows in §8 step 6, or add a per-integration environment
column.

**7.7 Launch route trusts `merchant_id` alone. — DONE (partial)**
`client_id` is now validated against the configured Clover client ID — a
mismatch redirects to signup with no tenant routing. The route stays public by
design (Clover launches are unauthenticated); `merchant_id` only resolves bound
integration rows, and the destination is always the merchant's *own* tenant —
so a foreign launch can't route into the wrong tenant. The residual
`merchant_id`-rebind concern is tracked in §7.14.

**7.8 Schema assumptions.** Every lookup is `findFirst` on `tenant_id` or
`merchant_id`; no unique constraint on `merchant_id`; no migration files for the
Clover tables at all. One merchant could bind to two tenants.
*Fix:* add the uniqueness constraint; state the 1:1 assumption.

**7.9 No rate-limit/backoff design.** The 15-minute poll fans out across all active
integrations; nothing handles Clover 429s or per-merchant backoff.

**7.10 No funnel instrumentation. — PARTIAL**
The lane mechanism made the funnel *addressable* for free: `lane.id` rides in
phase-1 onboarding state (e.g. `clover_market`), so channel attribution exists
at the data layer and each transition point (launch → wizard mount →
`completePhase1` → lane exit → OAuth callback) has a natural emit site.
Counters themselves are still open.

**7.11 Trial grant must be integration-capability-aware — DONE (superseded).**
*Superseded by a better shape:* instead of a single trial grant,
`integration_clover` is now enabled on **all three Entry-Presence triad tiers**
(`presence`, `discovery`, `storefront`) via migration
`database/migrations/378_clover_triad_grant.sql` (applied stg+prd). Trial keys
proxy to base tiers at check time (`TierService.checkTierFeatureAccess`), so
every triad trial carries it — onboarding already mints `trial_discovery` by
default, which is what the Clover lane lands on. `FEATURE_TIER_MAP` →
`discovery` in both canonical copies (`apps/api/src/middleware/tier-access.ts`,
`apps/web/src/lib/tiers/tier-features.ts`); `starter` keeps its legacy grant
(grandfathered). DB witness re-dumped, `capability_modules` synced, tier
contract suite green.

*Original analysis (still accurate):*

- `starter` is marked **inactive_legacy** in `shared/tier-contract.json` (see the
  `trial_eligible` note), so a new tenant can't be assigned it in practice.
- `presence` ($39) sits **below** `starter` in `FALLBACK_TIER_ORDER`, so it does
  **not** satisfy the `integration_clover` gate in
  `apps/api/src/middleware/tier-access.ts`.
- The first live tier that does is **`discovery`** ($29, display name "Nearby") —
  which is also the Google-surface rung, so it is semantically right for this
  connector. `discovery` is trial-eligible in every observed list, so
  **`trial_discovery`** is the correct grant.

Also worth a decision: `integration_clover: 'starter'` in `FEATURE_TIER_MAP` points
at a legacy tier. If `starter` really is inactive, the canonical mapping should be
`discovery` — otherwise the gate's intent is ambiguous and any future "starter"
cleanup silently changes who can use Clover.

*Contract-first:* edit `shared/tier-contract.json` (tier order, trial maps,
`capability_modules`, `surface_files`) **before** code, then
`node apps/api/scripts/sync-fixture-modules.cjs`, then
`node apps/api/scripts/gen-tier-doc-blocks.cjs --write`. The `tier-*`,
`mv-shape-lint` and `tier-doc-generation` suites fail on drift.

**7.12 Expiry / cap enforcement (shape depends on §6.6).**
If auto-disconnect survives: day 30 clears `access_token` / `refresh_token` /
`token_expires_at`, sets a renderable state (§7.5), warns at T-7/T-3/T-1, is
idempotent against a mid-run clear, and cannot be undone by the refresh job.
If §6.7 option B is chosen instead: the cap must be enforced at sync time (sync the
first N items, mark the rest `cap_reached`) and surfaced as an upgrade prompt, not
as a silent partial catalog.

**7.13 Inventory-module detection (mandatory because of 6.2). — DONE**
The OAuth callback probes `GET /v3/merchants/{mid}/item_stocks?limit=1` with the
fresh token; `403`/`404` stamps `last_sync_status='module_missing'` and
redirects with `error=inventory_module_missing` instead of a hollow
`success=connected`. The card renders the state and the hook maps the error to
a merchant-readable message. Probe failure is non-fatal — only a definitive
403/404 blocks the connect.

**7.14 Duplicate-tenant guard (from 6.5). — PARTIAL**
The onboarding route already refuses a second trial tenant
(`trial_limit_reached` 409), and the wizard's existing-user path routes to their
own tenant's integrations page rather than creating anything. **Still open:**
an explicit refuse when `merchant_id` is already bound to a *different* tenant —
today the callback would write the merchant onto whichever tenant completes
OAuth. Enforce at callback: if `merchant_id` is bound to tenant A and the OAuth
state resolves tenant B, refuse with a merchant-readable error.

**7.15 "No manual entry" must be true (new, Pointy pattern).** The listing will
claim products go live from Clover data alone. Verify a fresh connect produces
listable items with no photo, no description, and no category edit — and that the
Google/SWIS push does not require photos. If any step gates on presentation, either
fix it or drop the claim.

**7.16 Sync overwrite is narrow — scope the copy, don't gate the launch.**
*(v5 called this a blocker; that was too broad.)* The Clover catalog sync is one-way
and only touches rows carrying a Clover mapping
(`clover_item_mappings_list.rvp_item_id`). For those rows it writes exactly `name`,
`price_cents`, `sale_price_cents`, `stock` and `directory_category_id`
(`apps/api/src/routes/integrations/clover.ts`, ~line 1949). It never writes
`description`, `image_url`, `additional_images`, `title` or `brand`.

What that actually means:

- **Merchant-created / platform-only products are immune.** No mapping, never in
  `cloverData.items`, never updated. `MerchantProductSync` — the platform → SWIS
  lane — has **zero** Clover references, so that lane is structurally independent.
- **Photos and descriptions on Clover-mapped items survive every sync.** The
  11-photo enrichment (§7.17) is never at risk.
- **Only two fields are at risk, and only on mapped items:** the item *name*
  (reset to Clover's) and `directory_category_id` (reset to the Clover-category
  mapping).

That leaves one product question rather than a blocker: for a Clover-mapped item,
should the merchant be able to rename it? **Recommendation: no** — the register owns
the name of its own item, and the listing copy should say so plainly ("stock, price
and name come from Clover; photos, descriptions and categories are yours"). A
merchant who wants a different name creates a platform product instead — the lane
that cannot be overwritten.

*Optional polish:* keep `directory_category_id` merchant-owned once explicitly set
(per-item override flag), since that is a curation decision rather than a register
fact.

**7.17 The 11-photo claim is already implemented (verified — no action).**
`convertToProductInput` in `apps/api/src/services/MerchantProductSync.ts` sends
`imageLink` (primary) plus `additionalImageLinks` capped at
`MAX_ADDITIONAL_IMAGES = 10` — 11 total — and includes `FREE_LOCAL_LISTINGS` in
`includedDestinations` for SWIS-selected items. `gtins` is only set when a GTIN
exists, so a non-barcoded item still pushes. The upload cap is enforced at 11 in
`apps/api/src/photos.ts` (1 primary + 10 additional).

This is the one positioning claim that needs no engineering. Keep it that way: the
`image_gallery_5` / `image_gallery_10` feature keys gate *storefront gallery*
surfaces, not the per-item upload cap — confirm the Clover/SWIS path is not subject
to them, or the claim becomes tier-dependent.

## 8. Submission sequence (order matters)

1. ✅ Legal pages cover the connector's data handling — **partially**; add the retention clause (§9.2)
2. ✅ ~~§7.1 registration flow + §7.2 scopes~~ — **done** (lane routing + read-only scopes); still open: resolve §6.6/§6.7 pricing shape
3. ~~§7.11 trial grant + §7.13 module detection~~ — **done** (triad grant + connect probe); still open: §7.12 cap/expiry once §6.6/§6.7 resolves
4. Produce icon + screenshots (after §7.6 cleanup), including the no-photo item shot
5. Polish listing fields on the **sandbox** app first (copy is reusable)
6. File **production developer account** (approval lead time — the long pole; start early)
7. Re-create app in the **production** dashboard → §8.2 cutover checklist
8. ✅ ~~§7.3 refresh + §7.4 revocation + §7.5 failure states~~ — **done**
9. Prod test-merchant install (fresh merchant, not a pre-bound one) → submit listing
10. **Pitch Clover for an App Market Spotlight** and POS-partner co-marketing — Pointy's distribution came from there, not from the listing alone
11. Approval review → published listing

### 8.2 Production cutover checklist

- [ ] Client ID / secret → env (`CLOVER_CLIENT_ID`, `CLOVER_CLIENT_SECRET`)
- [ ] `CLOVER_ENVIRONMENT=production`
- [ ] Redirect URI → `https://api.visibleshelf.com/api/integrations/clover/oauth/callback`
- [ ] **Alternate Launch Path** → `/api/integrations/clover/launch` (the sandbox app has it; a new app does not)
- [ ] Site URL / App URL
- [ ] Webhook URL + `CLOVER_WEBHOOK_SECRET` (per-app, not per-account)
- [ ] App Market visibility = all plans (§6.2), categories, name, support email, pricing badge
- [ ] Purge or flag sandbox `clover_integrations_list` rows (§7.6)
- [x] `BATCH_JOBS_ENABLED=false` on the Railway standby — **set on `visible-shelf-api-prod` 2026-11-11**
- [ ] Confirm `scheduled_jobs` / `scheduled_job_runs` exist on prod so the cross-instance lease holds
- [ ] Rotate `CLOVER_TOKEN_ENCRYPTION_KEY` before external merchants join

## 9. Open items / known gaps

### 9.1 Disclose in review

- ~~App-uninstall webhook not wired~~ — **wired** (§7.4): `A:` events disconnect + clear tokens. Live-verify on next uninstall; if Clover's event type differs from UNINSTALL/DELETE, the logged payload will show it.
- One merchant per tenant (§7.8) — state as a scope limit.

### 9.2 Retention & revocation

Clover's legal guidelines ask how POS data is handled after uninstall. Pointy's
listing answers it in one sentence: on cancel, *"the Merchant's Pointy account will
be deleted and all products will be removed."* Ours must be as concrete:

- Tokens encrypted at rest with `CLOVER_TOKEN_ENCRYPTION_KEY`; never logged.
- **On cancel, uninstall, or expiry:** tokens cleared immediately (manual
  disconnect + the uninstall webhook now both clear credentials).
- Google-surface removal: the privacy policy states the honest behavior —
  published catalog **stops updating** and is removed per Google's own
  processes. ⚠️ Do NOT promise "removed within one sync cycle" anywhere — no
  GMC deletion sweep exists in code. If reviewers push on it, the sweep is a
  real feature build; until then "stops updating" is the true claim.
- Synced inventory retained as merchant data (merchant-owned) and deleted on
  account deletion.
- Retention window for sync logs and the dirty-item queue: state a number.

### 9.3 Commerce lane — deferred scopes (v2 direction)

The platform is payment-aware (deposit checkout on `presence`, `orders` /
`payments` models, tenant commerce settings), so Clover's Orders / Payments /
Ecommerce scopes are a *sequenced expansion*, not a rejected one. The v1
submission deliberately requests only Inventory Read + Merchant Read:

- every requested scope is a review-justification burden — "what does the app
  do with Payments write?" has no honest answer until the feature exists
- "we never write back" is a one-line verifiable claim only while scopes are
  read-only
- Clover supports expanding requested permissions on app update — merchants
  re-consent on next install. Growing scopes later is normal; shrinking them
  after consent is the awkward direction.

**Target shape when the feature lands:** platform checkout → **Clover order
write** — a `presence`-tier deposit purchase lands in the merchant's Clover
register, keeping the register authoritative for transactions exactly as it is
for stock/price/name. A read-only intermediate (Orders read → sell-through
velocity into the intelligence layer) is also available as a lighter v1.5.
Webhook subscriptions for Orders/Payments are already configured on the app, so
the event plumbing is in place when this activates.

## 10. Acceptance criteria for "listing is polished"

- [ ] Icon + ≥2 screenshots (re-shot post-cutover), including a no-photo item still listed
- [ ] Tagline + description + ≥2 benefits approved; benefits lead with the customer outcome
- [ ] Listing has a **"What you need"** block: Inventory module, verified Business Profile, country
- [ ] Listing enumerates surfaces (Business Profile products, Search/Maps, storefront)
- [ ] Pricing badge and copy match §6.6/§6.7 — no undisclosed paywall
- [ ] "No manual entry" verified end-to-end (§7.15)
- [ ] Authority copy scoped correctly: platform products immune to sync, mapped items keep photos/descriptions, name follows Clover (§7.16)
- [ ] 11-photo push verified on a SWIS-listed item, and not tier-gated (§7.17)
- [x] "We never write back" matches the requested scopes (§7.2 — code requests read-only)
- [ ] Privacy/ToS live, including the retention/deletion clause (§9.2)
- [ ] Support contact populated (`support@visibleshelf.com`) and monitored
- [x] Permissions = Inventory R + Merchant R — verified against `REQUIRED_SCOPES` in code
- [ ] App name + categories live; name length within Clover's limit
- [ ] Merchant testimonial sourced (Pointy pattern)
- [ ] Fresh-install verified from a merchant with **no prior binding**, through registration, landing on `discovery`-equivalent access (§7.1, §7.11)
- [ ] Existing-merchant install verified: no duplicate tenant, binds to existing (§7.14)
- [ ] Merchant without Inventory module gets the explicit state (§7.13 — code landed; verify live)
- [ ] Token refresh verified by forcing an expired access token (§7.3)
- [ ] Cap or expiry behaviour verified by forcing the boundary; card shows the state (§7.12)
- [ ] Disconnect verified on a sub-`discovery` tenant (§7.4)
- [ ] Reviewer test merchant + how-to-test notes ready (§5)
- [ ] App Market Spotlight pitch sent (§8 step 10)
