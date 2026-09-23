# Directory Report Banner — Spec

> Reserved banner inventory on every public directory **browse** surface,
> filled with a **report** creative (market-intel / free report) — never a
> claim CTA.
>
> Extends the place-page banner work (`BannerSlot` + `MarketIntelBanner`,
> §12.3 card definitions) to the `/directory/*` surfaces that today render
> only `PoweredByFooter`.

---

## 1. Overview

### 1.1 Problem

The place surfaces carry banner inventory — a tall `300x600` slot and a
square `300x250` slot filled by `MarketIntelBanner`. The `/directory/*`
browse surfaces do not. Only `/directory/location/[location]` (wired in the
location-parity pass) has slots; every other directory page renders its
listings and a footer with no report offer and no reserved ad space.

That leaves the report funnel — the thing that turns an anonymous browser
into a report view — absent from the directory's highest-traffic pages.

### 1.2 Solution

Give every public directory browse surface two reserved slots, filled with
the existing report creative:

| Slot | Size | Placement |
|---|---|---|
| **Tall** | `300x600` | Market Intel panel / right rail (see §4) |
| **Square** | `300x250` | Inline at the end of the listings grid |

Both reuse `BannerSlot` (reserves the box → no CLS) and `MarketIntelBanner`
(the house report creative). No new ad infrastructure.

### 1.3 Design principles

- **Report, not claim.** The creative promotes a report (market-intel full
  report on market surfaces, the free report on seed pages). It never renders
  a claim CTA. `UnclaimedDirectoryBanner` is a provenance strip, not ad
  inventory, and stays out of scope.
- **The slot is the deliverable.** `BannerSlot` reserves its footprint
  whether or not a creative resolves, so adding/removing a creative never
  shifts layout. `MarketIntelBanner` always renders a filled slot — real
  teaser copy when a teaser exists, fallback copy otherwise.
- **Inventory is decoupled from intelligence.** A banner spot must exist
  even on a surface with no market-intel teaser. The creative degrades to
  house copy; the reserved box stays.

---

## 2. Existing pieces (reuse — do not rebuild)

| Piece | Role |
|---|---|
| `BannerSlot` (`components/place/BannerSlot.tsx`) | Reserved `300x600`/`300x250` box, `Sponsored` label, CLS-safe. |
| `MarketIntelBanner` (`components/place/MarketIntelBanner.tsx`) | House creative. `surfaceType: 'city' \| 'category' \| 'seed'`, `variant: 'tall' \| 'square'`, `teaser?`, `seedId?`. Leads with the surface's `fullReport` card; `teaser=null` → fallback copy. Tall seed variant adds the report QR. |
| `MarketIntelSurfaceSidebar` (`components/place/MarketIntelSurfaceSidebar.tsx`) | Collapsible Market Intel panel for `category`/`city` surfaces. Hosts the tall banner + teaser cards. **Currently data-gated: `if (!teaser) return null`.** |
| `MarketIntelSurfaceService` | `getCategoryTeaser(slug, city, state)`, `getCityTeaser(citySlug)`. |

### 2.1 Teaser endpoints that exist (§12.4)

```
GET /api/public/directory/category/:categorySlug/market-intel/summary?city&state
GET /api/public/directory/city/:citySlug/market-intel/summary
```

These are the **only** surface teasers. There is no store-type, no
all-categories-index, and no directory-home teaser. This is the constraint
that drives §4 and §5.

---

## 3. Surface matrix

Scope = public **browse** surfaces. `/directory/[slug]` (claimed storefront)
and `/directory/about`, `/directory/add-business`, `/directory/claim`,
`/directory/enrich`, `/directory/suggest`, `/directory/t/[tenantId]` are out
of scope — a claimed listing has no seed report to promote, and the
transactional/info pages have no listings flow to interrupt.

| Surface | File | Teaser | Tall slot | Square slot |
|---|---|---|---|---|
| `/directory/location/[location]` | `location/[location]/page.tsx` | ✅ `getCityTeaser({city}-{state})` | ✅ done (panel) | ✅ done (inline) |
| `/directory/categories/[categorySlug]` | `categories/[categorySlug]/CategoryViewClient.tsx` | ✅ `getCategoryTeaser(slug, '__all__', null)` | panel | inline |
| `/directory/categories` | `categories/AllCategoriesClient.tsx` | ❌ none | rail | inline |
| `/directory/stores/[storeTypeSlug]` | `stores/[storeTypeSlug]/StoreTypeViewClient.tsx` | ❌ none | rail | inline |
| `/directory/stores` | `stores/AllStoreTypesClient.tsx` | ❌ none | rail | inline |
| `/directory` (home) | `DirectoryClient.tsx` | ❌ none | rail | inline |
| `/directory/category/[category]` | `category/[category]/page.tsx` | — legacy hardcoded stub (`CATEGORY_INFO`) | out of scope | out of scope |

**Two category routes exist.** `/directory/categories/[categorySlug]` is the
real enriched surface. `/directory/category/[category]` is a legacy route
keyed to a hardcoded `CATEGORY_INFO` map (~10 store types) — it has no
enrichment, no market intel, and is excluded.

---

## 4. Placement & the tall-slot host — decision required

The square slot is unambiguous: a centered `MarketIntelBanner` at the end of
the listings grid, before the "About These Listings" disclosure (mirroring
`/place/category` and `/directory/location`). Always rendered.

The **tall** slot needs a host, and this is where the current pattern
conflicts with "all browse surfaces."

### 4.1 The conflict

`MarketIntelSurfaceSidebar` is data-gated:

```ts
if (!teaser) return null;
```

So on a surface with no teaser (index, store-type, home) the whole panel —
and the tall banner inside it — renders nothing. Worse for a monetization
spec: even where the panel *does* render, it is **closed by default**, so
the tall banner is invisible until a user opens it. A hidden slot is not
saleable inventory.

### 4.2 Recommended — persistent right rail (Option A)

Give every browse surface a right rail that hosts the tall banner:

```tsx
<div className="container mx-auto px-4 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_336px] lg:gap-8">
  <div>{/* listings, disclosure, enrichment, CTAs */}</div>
  <aside className="mt-8 lg:mt-0">
    <div className="lg:sticky lg:top-6">
      <MarketIntelBanner variant="tall" surfaceType={...} teaser={teaser} />
    </div>
  </aside>
</div>
```

- `lg:` breakpoint: below it the rail stacks under the content (tall banner
  appears after the listings on mobile — acceptable).
- `sticky` keeps the slot in view while scrolling the grid.
- **Decouples inventory from intelligence** — the tall slot renders on every
  surface regardless of teaser.
- The collapsible `MarketIntelSurfaceSidebar` then renders **only** where a
  teaser resolves, and **loses its internal tall banner** (becomes pure
  intelligence cards) so there is exactly one tall slot per surface.

**Cost:** revises the just-shipped location/place/seed pages, which currently
keep the tall banner inside the panel. One-line-per-surface migration plus
removing the banner from `MarketIntelSurfaceSidebar`.

### 4.3 Alternative — decoupled panel (Option B)

Keep the tall slot inside `MarketIntelSurfaceSidebar`, but lift the
`!teaser → null` gate so the panel always renders its shell + tall banner +
the non-intelligence "Add Your Business" card, rendering teaser cards only
when a teaser resolves. Add `surfaceType: 'directory'` that skips the teaser
fetch (no doomed request on teaser-less surfaces).

- Faithful to the shipped pattern and to "mirror /place/category."
- **Downside:** the tall slot stays hidden inside a closed-by-default panel —
  poor ad viewability — and a teaser-less panel is mostly an ad drawer.

**Recommendation: Option A.** It makes the tall slot real, visible inventory
on every surface, and cleanly separates ad space from the intelligence
panel. Option B is documented in case consistency with the shipped pages is
preferred over viewability.

---

## 5. Teaser sourcing

| Surface | surfaceType | Call |
|---|---|---|
| `categories/[categorySlug]` | `category` | `getCategoryTeaser(categorySlug, '__all__', null)` — national view (no city param) |
| `location/[location]` | `city` | `getCityTeaser(location)` — `{city}-{state}` slug, already wired |
| index / store-type / home | `directory` (new) | none — `teaser=null`, fallback copy |

Fetch the teaser **server-side** in `page.tsx` and pass it to the client as
`initialTeaser` / a prop — same as `/place/category`'s `marketIntelTeaser`
pattern — so the report copy lands in the SSR HTML for crawlers. The panel
re-fetches client-side on open (existing `ttl: 0` behaviour).

### 5.1 New `directory` surface type

`MarketIntelSurfaceType` gains `'directory'` with a neutral promo (no
per-surface report exists on aggregate pages):

```ts
directory: {
  reportTitle: 'Free market report',
  fallbackTeaser: 'See what public data says about local businesses in this directory.',
  alsoInside: ['Category Signals', 'Market Gaps', 'Market Density'],
}
```

With no teaser and no resolvable report target, the CTA renders the
existing "Unlock → (Coming soon)" treatment — no dead link, no fabricated
destination. (If a general intel landing ships, point the CTA there.)

---

## 6. Creative rules (already enforced by `MarketIntelBanner`)

- Lead card = the surface's **report** card (`cards.fullReport`). Never
  `claimBusiness` — the claim card is excluded from "Also inside" by test.
- `teaser=null` → `promo.fallbackTeaser`; the reserved box is never empty.
- CTA verb is surface-aware: seed → "See the report" (free), market →
  "Unlock" (paid). A `directory` surface with no target renders "Coming
  soon."
- **QR is seed-only.** The report QR appears in the tall banner only on the
  seed surface (`/place/[slug]`, `surfaceType='seed'` + `seedId`). Directory
  browse surfaces are not seeds → **no QR**. The QR/CTA both encode the
  tracked redirect — never the destination.

---

## 7. Attribution

No new tracking needed for these surfaces — there is no QR (§6). The square
banner CTA on a market surface is a normal `Link` to the report; if a
tracked redirect is later wanted for category/city report clicks, it must
get its **own** channel (the `report_banner` precedent — a banner scan is a
distinct surface, never folded into the `report_delivery_*` funnel so it
can't inflate delivered→scanned rates).

---

## 8. Acceptance criteria

1. Every in-scope browse surface renders a `300x250` square
   `MarketIntelBanner` at the end of the listings flow.
2. Every in-scope browse surface renders a `300x600` tall
   `MarketIntelBanner` in the host chosen in §4 (rail or panel).
3. `/directory/categories/[categorySlug]` resolves the national category
   teaser (`getCategoryTeaser(slug, '__all__')`) and renders
   `MarketIntelSurfaceSidebar surfaceType="category"`.
4. Teaser-less surfaces render the banner with fallback copy — the reserved
   `data-banner-slot` box is present in the DOM regardless.
5. No banner renders a claim CTA; no directory surface renders a QR.
6. `pnpm checkweb` clean; `npx vitest run src/components/place` green.

## 9. Open questions

- **§4 host** — right rail (recommended) vs decoupled panel. Affects whether
  the shipped location/place/seed pages migrate.
- **Aggregate CTA target** — where does a `directory`-surface report banner
  point? Needs a general report/intel landing, else it stays "Coming soon."
- **Store-type → category mapping** — worth resolving a store type to a
  market-intel category so those surfaces get real teaser data instead of
  fallback copy? (Speculative; not in this pass.)
- **National/index teaser endpoint** — a platform-aggregate teaser would let
  the index and home render real card data + a real panel.
