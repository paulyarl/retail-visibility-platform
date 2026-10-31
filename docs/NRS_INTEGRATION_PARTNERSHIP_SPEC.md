# NRS Integration & Partnership Spec (Pre-Proof Outlook)

> Status: **pre-proof** — strategic positioning document. No outreach until the
> proof milestones below exist. Captured 2026-10-31 after the NRS competitive
> pass that shipped the POS-solutions/add-ons/portal counter-stack.

## 1. The counterparty

**National Retail Solutions (NRS Plus)** — division of IDT Corp (NYSE: IDT).

- Founded 2015, HQ Newark NJ; 501–1,000 employees; ~3K LinkedIn followers.
- **~20,000+ deployed stores** (per their careers page), US + Canada.
- Verticals: urban c-stores, bodegas, liquor, tobacco, grocery, gas/c-store —
  heavy Hispanic-market focus. Multilingual: EN/ES/HI/AR/FR.
- Revenue model is the rails, not the software:
  - **NRS Pay** — card processing (EBT/eWIC authorized)
  - **NRS Funding** — merchant cash advances $2.5K–$500K
  - **NRS Petro** — pump-integrated POS, EMV-at-pump (Fiscal Systems partner)
  - Hardware POS + recurring add-ons ($29.95–$39.95/mo each)

### Their topology (mirrored in RVP)

| NRS | Role | RVP equivalent |
|---|---|---|
| `nrsplus.com` | Marketing/corporate | `visibleshelf.com` apex |
| `nrsgo.com/{store}` | Consumer webstores (JS SPA, poor crawlability) | `{slug}.visibleshelf.com` (SSR, crawlable) |
| `mystore.nrsplus.com` | Shared merchant portal | `mystore.visibleshelf.com` + per-store `/manage` |
| Premium add-ons band | A-la-carte upsell menu | `AddonsStrip` (`PRESENCE_ADDONS`) |
| Find My Biz (~$30–40/mo) | Directory syndication (Google/Apple/Waze/35+ dirs) | GBP automation + directory presence |
| nrsmarket.com | Wholesale supplies + program cart | Platform tenant storefront spec |

### Their structural gaps (our wedge)

- **Acquisition**: webstores only exist *after* a POS sale. RVP seeds listings
  first (PG pushes — thousands per batch) and converts claims into upgrades.
- **POS lock**: everything rides their register. RVP is POS-agnostic
  (Clover + Square live today).
- **Search surface**: `nrsgo` storefronts are SPAs — product-level local search
  indexing is weak. RVP surfaces are server-rendered/crawlable.
- **No public developer API**. All integrations are partner-negotiated
  (Altria scan-data, Fiscal/Conexus Petro, DoorDash/Grubhub).

## 2. The thesis

> **NRS becomes the next Clover — a third POS connector — but only through a
> deal, because their integration door is BD, not developer self-serve.**

- Clover integration = technical capability → **done** (OAuth, item/category
  mappings, sync history, demo mode).
- NRS integration = business development → **the deal IS the capability.**
  There is no API to build against without a partnership agreement.

The pitch to NRS/IDT:

> *"Your 20K stores' catalogs are offline. Clover and Square merchants already
> get storefronts, Google Shopping feeds, and GBP automation through us — your
> merchants are the third connector. We don't touch your payments, hardware,
> or funding margins — we make your registers' inventory visible."*

### Why it fits like a glove

- Complementary, not competitive: we sit **on top of** their stack — same
  position we hold over Clover/Square. No POS replacement ask.
- Their add-on menu (Find My Biz, loyalty, ecommerce) vs ours (directory
  presence, GBP automation, review mgmt, SSR storefronts, Google Shopping
  feeds) — overlapping ambition, disjoint delivery.
- IDT is acquisitive; NRS itself was bought once. They know the motion.
- Deposit-pickup model vs their DoorDash/Grubhub outsourcing: "their ecommerce
  ends in delivery fees; ours ends in foot traffic."

## 3. Proof milestones (gate for outreach)

The claim → POS-connect funnel must produce numbers before any approach:

1. **Claim→connect conversion** — % of claimed tenants who connect a POS
   (Clover/Square) within N days of claim.
2. **Seed economics** — cost per claimed merchant via seed funnel vs NRS's
   cost per merchant via hardware sale ("we acquire at seed cost what they
   acquire at hardware cost").
3. **Sync reliability** — Clover sync success rate, mapping coverage,
   conflict-resolution rate across ≥1 real merchant cohort.
4. **Surface proof** — indexed product pages / crawl stats on seeded
   storefronts vs equivalent nrsgo pages (crawlability delta).
5. **Add-on attach rate** — `AddonsStrip` → upgrade conversion once the
   solutions-led cards have flight time.

## 4. What exists today (shipped 2026-10-31)

- `GATEWAY_UPGRADE_SOLUTIONS` + `solutions` payloads through claim-accept and
  `/upgrade/options` — POS sold as outcomes, not tiers.
- `AddonsStrip` (scrollable card strip w/ ‹ › controls) on claim teaser,
  upgrade page, FeaturesShowcase triad, `/place/about`; data: `PRESENCE_ADDONS`
  in `apps/web/src/lib/presence-modes.ts` (8 solutions incl. Clover POS,
  Square POS, GBP, Google Shopping feed, review management, coupons, flyers,
  social posting).
- `mystore.visibleshelf.com` + `mystore.visibleshelf.store` shared portal —
  workspace served on portal host; `{slug}.*/manage` per-store doors;
  subdomains minted at claim; reserved portal names in `RESERVED_SUBDOMAINS`.
- Owner-entry discoverability: footer "Store owner? Manage →" on live,
  pending/closed storefronts, directory coming-soon, place not-found.
- Social-links merge fix (three payload sources) on both storefront layouts.
- `/place/about` triad hero images + prominent add-ons band.

## 5. Open questions

- Does NRS have *any* partner API surface worth probing (their `API@nrsplus.com`
  mailbox exists for Altria — indicates they do run inbound API coordination)?
- Does IDT/NRS have a corporate-development or partnerships contact?
- Would a no-deal interim path exist (merchant-exported pricebook CSV →
  catalog import) to serve NRS merchants before an API deal?
- If partnership stalls: does NRS POS allow barcode/catalog export that
  merchants could carry to us voluntarily?

## 6. Non-goals

- No outreach, no NRS-specific connector code, no pricing changes until
  milestones 1–3 show signal.
- Do not position RVP as POS-replacement in any NRS-facing material — the
  "keep your register" thesis is the partnership compatibility argument.
