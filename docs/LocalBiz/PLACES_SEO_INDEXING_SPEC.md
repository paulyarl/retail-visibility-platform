# Places, Directory, Storefronts & Products SEO Indexing — Spec

> Google has indexed the platform's marketing pages but none of its inventory.
> `site:visibleshelf.com` returns the home page, `/terms`, and `/directory` — and
> nothing else. The 70 `/place/{slug}` pages, the `/directory/{slug}` tenant
> listings, every tenant storefront (path, subdomain, or custom domain) and every
> public product page that constitute the product are invisible to search, not
> because they are low quality, but because the platform publishes no sitemap, no
> robots.txt, and no crawlable link to any of them.

**Status:** Proposed — awaiting team review
**Revision:** 2026-10-23 — extended to storefronts (`/tenant/{slug}`, `/shops/{slug}`, subdomains, custom domains) and products (`/products/{id}`); review findings folded in (sitemap index, canonical ladder, demo gating, SSR prefill contracts). All open decisions resolved and the pre-sprint plan added (§12).
**Owner:** TBD
**Scope:** `apps/api` sitemap producer · `apps/web` sitemap/robots exposure + canonical hygiene + server-rendered crawl paths
**Surfaces:**
- Directory: `/place`, `/place/city/*`, `/place/category/*`, `/place/{slug}` (unclaimed seeds), `/directory`, `/directory/{slug}` (tenants + claimed)
- Storefront: `/tenant/{slug}`, `{tenant}.visibleshelf.com`, tenant custom domains, `/shops/{slug}`
- Products: `/products/{id}` (platform and tenant-host forms)

---

## 1. Overview

### 1.1 Problem

Search Console cannot help until Google can *find* the pages. Today it cannot:

- `https://visibleshelf.com/robots.txt` → **404** (no robots file exists anywhere in `apps/web`)
- `https://visibleshelf.com/sitemap.xml` → **404** (no root sitemap)
- `https://visibleshelf.com/directory/sitemap.xml` → **200, but contains exactly one `<url>`: `/directory`**
- Every listing grid is client-fetched in `useEffect`, so the server HTML for `/place`, `/place/city/*`, `/place/category/*`, and `/directory` contains **zero** `<a href="/place/{slug}">` links
- **Storefronts are absent from every sitemap.** `/tenant/{slug}` renders 200 and already emits a correct canonical (`https://baraka-international-market.visibleshelf.com/`), but no sitemap row exists for the path form, the subdomain form, or custom domains — and `{tenant}.visibleshelf.com/robots.txt` is **404**.
- **`/shops/{slug}` is a second, unmanaged copy of the same storefront.** It returns 200 with the generic title `Shop Profile | VisibleShelf`, emits **no canonical**, and its HTML contains **zero** product links (grid is client-fetched) — while `/tenant/{slug}` server-renders the same products.
- **`/products/{id}` is a third surface with no canonical at all.** It returns 200 with a real title and `Product` JSON-LD, and the identical page also returns 200 on the tenant's subdomain — so every product is live at ≥2 URLs with nothing consolidating them. The JSON-LD `offers[].url` is derived from the *request* host, so it changes depending on which surface served the page.

The detail pages themselves are fine. `/place/dreamcast-african-market-indianapolis-in` returns 200 with a packet-driven `<title>`, a self-referencing canonical, `GroceryStore` + `BreadcrumbList` JSON-LD, description, address, phone, and hours. No `noindex`. This is a **discovery** defect, not a content defect.

### 1.2 Evidence (live probes, 2026-10-23)

| Probe | Result |
|---|---|
| `GET /robots.txt` | `404` |
| `GET /sitemap.xml` | `404` |
| `GET /directory/sitemap.xml` | `200`, `<loc>` count = **1** |
| `GET /api/public/directory/places-sitemap.xml` | `200`, `<loc>` count = **101**, all prefixed `https://api.visibleshelf.com` |
| `<a href="/place/{slug}">` in `/place` HTML | **0** |
| `<a href="/place/{slug}">` in `/place/city/indianapolis-in` HTML | **0** |
| `<a href="/directory/{slug}">` in `/directory` HTML | **0** |
| `<a href="/directory/{slug}">` in `/directory/stores` HTML | **0** |
| `GET /place/dreamcast-african-market-indianapolis-in` | `200`, title + canonical + 2 JSON-LD blocks |
| `GET /directory/baraka-international-market` | `200` |
| `GET /place/baraka-international-market` | `308` → `/directory/baraka-international-market` |
| `GET /tenant/baraka-international-market` | `200`, title present, canonical `https://baraka-international-market.visibleshelf.com/`, 12+ `/products/{id}` anchors in SSR HTML |
| `GET /shops/baraka-international-market` | `200`, title `Shop Profile \| VisibleShelf`, **no canonical**, **0** product anchors |
| `GET /products/pid-ULCW-79au4s1v` (platform) | `200`, title present, **no canonical**, JSON-LD `offers[].url` = platform URL |
| `GET /products/pid-ULCW-79au4s1v` (on `baraka-international-market.visibleshelf.com`) | `200` — same product, second URL, no canonical |
| `GET {tenant}.visibleshelf.com/robots.txt` | `404` |

**Inventory, measured at launch (2026-10-23, from the live sitemap):** 275 URLs — **70** seed listings (`/place/{slug}`), **2** non-seed tenant listings (`/directory/{slug}`), **20** category shelves, **7** city markets, **5** storefront homes, **168** public products (35 on a tenant subdomain, 133 on platform-path storefronts).

> **Do not use `/api/directory/search`'s `totalItems` as a tenant-listing count.** It reports **72**, but that total is 70 seeds + 2 tenants — it searches the whole published directory, seeds included. Likewise `/api/public/directory/places` reports `totalPlaces: 119`, which is *shelf memberships*, not unique listings (a place on three shelves counts three times). The sitemap's own `<loc>` counts are the only trustworthy page counts.

Storefront/product counts are **not yet measured** (`SELECT count(*) FROM inventory_items WHERE item_status='active' AND visibility='public'`). This matters: the storefront + product inventory sets the sitemap architecture (§5.1) — a product catalog in the tens of thousands requires a `<sitemapindex>` from day one.

### 1.3 Why it costs more than "we're not ranking yet"

- **The sitemap that exists is unusable.** The API already generates a complete 101-URL sitemap (`/api/public/directory/places-sitemap.xml`), but it stamps every `<loc>` with `https://api.visibleshelf.com`. Submitted to Search Console as-is, every URL is cross-domain and rejected.
- **The sitemap the web app serves is a silent failure.** `/directory/sitemap.xml` reads `listings.items`, but `/api/directory/search` returns `{ listings, pagination }`. `items` is `undefined`, `.map()` throws, and the `catch` returns a minimal one-URL fallback. It has never emitted a listing and never logs an error to the operator.
- **Orphaned pages don't get crawled on hope.** Googlebot renders JS, but rendering is budgeted. 72 listing pages with no static inbound link and no sitemap entry is not a "wait for the renderer" situation — it is an absence of discovery.
- **Every new seed ships orphaned.** The seed pipeline adds listings continuously; without a crawl path each new page inherits the same defect.
- **Every tenant is three-to-four URLs and none of them declare a winner.** A tenant storefront is reachable at `/tenant/{slug}`, `/shops/{slug}`, `{tenant}.visibleshelf.com`, and (if entitled) a custom domain; each product is reachable at `/products/{id}` on the platform *and* on the tenant host. Only `/tenant/{slug}` emits a canonical today. Indexing the rest without fixing that trades "invisible" for "duplicated" — which is worse, because duplicates split the equity the storefront needs to rank.

### 1.4 Solution summary

Eight changes, in dependency order:

1. **Fix the sitemap's canonical origin** — emit `WEB_URL`, not `req.get('host')`.
2. **Make the API sitemap the single producer** for all public inventory (seeds, claimed tenants, storefronts, products), and expose it at the web origin as `/sitemap.xml` — split into a `<sitemapindex>` (§4.8).
3. **Add `robots.txt`** at the web origin, pointing at that sitemap — and make sure it also serves on tenant hosts (§4.10).
4. **Retire the broken `/directory/sitemap.xml`** (308 to `/sitemap.xml`) so there is one sitemap, not two disagreeing ones.
5. **Resolve the canonical ladder into the sitemap** — storefront and product `<loc>`s are the tenant's canonical host (custom → subdomain → path), the same ladder `/tenant/{slug}` already emits.
6. **Close the canonical gaps and un-gate basic structured data** — `/shops/{slug}` and `/products/{id}` get canonicals; `/shops/{slug}` consolidates onto the storefront; demo and non-public pages get `noindex`; `Product`/`Store` JSON-LD emits for every tenant, not just `enhanced_seo` ones.
7. **Server-render listing links** on `/place`, `/place/city/*`, and `/place/category/*` so pages have inbound crawl paths independent of JS. (Product crawl paths already exist: `/tenant/{slug}` SSR includes `/products/{id}` anchors.)
8. **Verify the property in Search Console** and submit; add self-referencing canonicals so the crawl paths we just created don't create duplicates.

Steps 1–4 are the indexing unblock. Steps 5–6 are what stop the new inventory from indexing as duplicates. Step 7 is what makes it durable. Step 8 is a runbook, not code.

---

## 2. Current state (reuse — do not rebuild)

| Piece | Location | Role | Verdict |
|---|---|---|---|
| Sitemap producer | `apps/api/src/routes/directory-presence-public.ts:1467` `GET /places-sitemap.xml` | Emits `/place`, `/place/category/*`, `/place/city/*`, `/place/{slug}` from live SQL. 101 URLs today. | **Keep. Fix origin, extend to claimed + storefronts + products, split into an index.** |
| Web sitemap route | `apps/web/src/app/directory/sitemap.xml/route.ts` | Intended to emit `/directory` + listing pages. | **Broken. Retire.** |
| `PublicDirectoryService.searchDirectory` | `apps/web/src/services/PublicDirectoryService.ts:116` | Typed `DirectorySearchResponse { items }`; the API actually returns `{ listings }`. | Type lie — remove the only caller and fix the type or leave unused. |
| Places browse service | `apps/web/src/services/PlacesBrowsePublicService.ts` | `getCategories()`, `getPlacesByCategory()`, `getCityShelfSummary()`. | **Reuse** for SSR crawl paths. |
| City page | `apps/web/src/app/place/city/[citySlug]/page.tsx` | Server-renders hero + enrichment; grid is client. | Add `initialCityData` (whole `CityResponse`, not a flat list — §4.4.1). |
| Category page | `apps/web/src/app/place/category/[categorySlug]/page.tsx` | Server-renders nothing but metadata; grid is client. | Add `initialPlaces` (flat list fits this client). |
| Index page | `apps/web/src/app/place/page.tsx` | Already passes `initialCategories` to `PlacesIndexClient` (the established SSR-prefill pattern). | **Reuse the pattern.** |
| Detail page | `apps/web/src/app/place/[slug]/page.tsx` | Server-rendered listing + JSON-LD. `dynamic = 'force-dynamic'`. | No change needed for indexing. |
| Storefront page | `apps/web/src/app/tenant/[id]/page.tsx` | Server-renders storefront + products. Emits the canonical ladder (`canonicalStorefrontHome`, lines 536–547). `force-dynamic`. | **Reuse as-is.** Canonical is already correct; only sitemap + demo gating are missing. |
| Canonical ladder API | `apps/api/src/routes/tenants.ts:869` `GET /api/tenants/storefront-canonical/:id`; web delegate `apps/web/src/lib/storefront-routing.ts` | Resolves custom domain → subdomain → platform path, tenant-based (never request-host). | **Reuse the rule — do not re-implement it.** Sitemap must batch it in SQL (§4.7). |
| Shop profile | `apps/web/src/app/shops/[slug]/page.tsx` | Server-rendered shell, but product grid is client-fetched (0 anchors in SSR). `generateMetadata` returns `{}` for normal shops; only demo tenants get `noindex`. | **Duplicate surface — consolidate.** See §4.9. |
| Product page | `apps/web/src/app/products/[id]/page.tsx` | Server-rendered product + `Product` JSON-LD (gated on `showEnhancedSEO`). `force-dynamic`. | **Add canonical.** No `alternates.canonical` today; `offers[].url` follows the request host. |
| Tenant-host proxy | `apps/web/src/proxy.ts` | `{tenant}.visibleshelf.com` / custom domains rewrite to `/tenant/{id}`; paths containing `.` (incl. `robots.txt`, `sitemap.xml`) pass through to the app. | **Reuse.** This is what lets a per-host `robots.txt` authorize cross-host sitemap `<loc>`s (§4.10). |

`PlacesIndexClient` already demonstrates the pattern this spec extends — server fetches, client accepts an optional initial value, skips its own fetch when present (`apps/web/src/app/place/PlacesIndexClient.tsx:20,39-59`). Mirror it; do not invent a second approach.

---

## 3. Root causes

| ID | Root cause | Impact |
|---|---|---|
| **RC1** | API sitemap derives `<loc>` from `req.protocol + '://' + req.get('host')` (`directory-presence-public.ts:1470`). Through the Next proxy the host is `api.visibleshelf.com`. | Every URL cross-domain → sitemap unusable. |
| **RC2** | No `robots.txt` and no root `/sitemap.xml` at the web origin. | Nothing to submit; no discovery hint. |
| **RC3** | `/directory/sitemap.xml` reads `listings.items` from a response shaped `{ listings, pagination }`; the throw is swallowed into a 1-URL fallback. | Zero listings emitted; failure is invisible. |
| **RC4** | All listing grids fetch in `useEffect`. Server HTML carries no `<a href>` to any detail page. | 72 detail pages orphaned. |
| **RC5** | `/place/city/*` and `/place/category/*` emit no canonical; category URLs take `?city=&state=` query variants. | Once crawlable, variants compete as duplicates. |
| **RC6** | Shelf slugs are derived from free-text category labels. The sitemap currently includes `international-supermarket-african-goods-store-per-directory-mixed-asian-mexican-and-african`. | Composite operator labels create junk URLs in the index. |
| **RC7** | The sitemap producer only knows the seed tables. There is no storefront or product query, and no public "list all products" endpoint (`/api/public/products` is a featured-products wrapper; `/api/public/products/:id` is single-fetch). | Every tenant storefront and product page is unlisted. |
| **RC8** | `/shops/{slug}` emits `generateMetadata` `{}` for normal shops — no title, no canonical — while rendering the same storefront as `/tenant/{slug}`. | Third URL per tenant, unmanaged; splits equity and serves a generic SERP title. |
| **RC9** | `/products/{id}` never sets `alternates.canonical`, and its JSON-LD `offers[].url` is built from `headers().get('host')`. The same product returns 200 on the platform and every tenant host. | Every product is duplicated across hosts with no consolidation; the structured-data URL is unstable per request. |
| **RC10** | Demo gating is inconsistent: `/shops/{slug}` sets `robots: { index: false }` for demo tenants, `/tenant/{slug}` does not; product pages have no `noindex` for private/inactive items or demo tenants. | Sample storefronts and non-public products can be indexed if they are ever crawled — and will be, once the sitemap exists. |
| **RC11** | Structured data is gated behind the paid `enhanced_seo` capability, and where it *is* emitted from `generateMetadata` it goes through `metadata.other` — which renders `<meta name="application/ld+json">`, not a JSON-LD `<script>`. | Non-paying tenants emit no `Product`/`Store` schema at all; paying tenants emit one valid script (product page) plus an inert meta tag (both pages). The platform's directory earns no rich results from the merchants who haven't bought the capability. |

---

## 4. Design

### 4.1 Canonical origin (RC1)

Replace the host derivation in `GET /places-sitemap.xml`:

```ts
// apps/api/src/routes/directory-presence-public.ts:1470
const baseUrl = (req as any).protocol + '://' + req.get('host');
```

with the configured public web origin, using the import already present in the file (`unifiedConfig`, line 35):

```ts
const baseUrl = unifiedConfig.webUrl.replace(/\/+$/, '');
```

`unifiedConfig.webUrl` resolves `WEB_URL` (`apps/api/src/config/unifiedConfig.ts:35`), the same source used by every other outward-facing link in the API (`DirectoryPresenceSeedService:1199`, `storefront-url.ts:35`). **Note:** `WEB_URL` carries a trailing slash in prod — the `.replace(/\/+$/, '')` is required, or every `<loc>` becomes `https://visibleshelf.com//place`.

**Guard:** if `baseUrl` is empty or points at `api.`, respond `500` rather than emitting a bad sitemap. A wrong sitemap is worse than a missing one — Google caches the rejection.

### 4.2 One sitemap producer, exposed at the web origin (RC1, RC2, RC3)

**Single producer:** the API route. It has the database, the status gates (`dps.status IN ('published','invited','claimed') AND dll.is_published = true`), and the city-slug tokenizer. Reimplementing this in `apps/web` would duplicate a SQL contract that already drifts (see RC3).

**Extend the producer to claimed listings.** The current query is seed-only (`listing_origin = 'directory_seed'`), so the non-seed tenant listings at `/directory/{slug}` are absent (2 at launch — not 72; see §1.2). Add a third query and emit them at their canonical path:

```sql
SELECT dll.slug, dll.updated_at
FROM directory_listings_list dll
WHERE dll.is_published = true
  AND dll.listing_origin IS DISTINCT FROM 'directory_seed'
```

Emitted as `${baseUrl}/directory/${encodeURIComponent(slug)}`.

**Do not** emit `/directory/{slug}` for seeds: `apps/web/src/app/directory/[slug]/layout.tsx:69-87` 308-redirects them to `/place/{slug}`. A sitemap full of redirects is a canonicalization signal Google penalizes.

**Expose at the web origin** — add to `apps/web/next.config.ts` `rewrites()` alongside the existing `/api/:path*` proxy:

```ts
{ source: '/sitemap.xml',  destination: `${apiBaseUrl}/api/public/directory/sitemap.xml` },
{ source: '/sitemaps/:file', destination: `${apiBaseUrl}/api/public/directory/sitemap/:file` },
```

The rewrite inherits the API's `Content-Type: application/xml` and `Cache-Control: public, max-age=3600`. No new route handler, no duplicated URL assembly. The existing single-file route (`/places-sitemap.xml`) becomes `sitemap/places` — keep the old path working with a 301 to `/sitemap.xml` for a release, then delete it.

*Alternative (if the team prefers a handler):* `apps/web/src/app/sitemap.xml/route.ts` that proxies the same endpoint with an explicit timeout and a cached last-good response. More code, marginally better failure behavior. Not recommended for v1.

**Retire `/directory/sitemap.xml`** (RC3). Replace the route body with a `308` to `/sitemap.xml`, keeping the path alive so any existing Search Console submission or external reference lands somewhere valid:

```ts
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/sitemap.xml', request.url), 308);
}
```

Delete the `searchDirectory` call and the fallback template. If `PublicDirectoryService.searchDirectory` then has no callers, fix its return type to match the API (`{ listings, pagination }`) or remove it — leaving a type that disagrees with the wire format is how RC3 happened.

### 4.3 robots.txt (RC2)

Add `apps/web/src/app/robots.ts` (Next metadata route — no new dependency):

```ts
import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_WEB_URL
  || process.env.NEXT_PUBLIC_APP_ORIGIN
  || process.env.WEB_URL
  || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/', '/dashboard', '/account', '/t/', '/c/', '/cart', '/carts',
        '/checkout', '/orders', '/my-orders', '/customerlogin',
        '/login', '/logout', '/signup', '/register', '/auth/',
        '/recovery', '/preview/', '/marketing/', '/prospect-report/',
        '/seed-report/', '/retail/', '/debug/', '/settings',
      ],
    }],
    sitemap: `${BASE.replace(/\/+$/, '')}/sitemap.xml`,
  };
}
```

Two rules matter more than the list:

- **Never disallow `/_next/`.** Google needs the CSS/JS bundles to render; blocking them is the classic way to make a JS-heavy site render as an empty shell.
- **Never disallow `/place`, `/directory`, `/tenant`, `/shops`, or `/products`.** A single stray `Disallow: /place` here silently undoes this entire spec — and `Disallow: /shops` would stop crawlers reading the canonical that suppresses the shop profile (§4.9), leaving those URLs blocked-and-unconsolidated instead.

No `host:` field — Google ignores it, and on a tenant host it would advertise the platform apex. The `Sitemap:` line must stay **platform-absolute on every host**; that is what authorizes cross-host `<loc>`s (§4.10).

The disallow list above is app-internal only. Review it against the route tree in `apps/web/src/app` before merge; when in doubt, omit.

### 4.4 Crawl paths — server-rendered listing links (RC4)

The sitemap gets Google to the pages. Links keep it there and distribute PageRank. Both are needed; the sitemap alone does not make a page "not orphaned".

#### 4.4.1 City and category pages — prefill the grid

Follow the `initialCategories` precedent. In each page component, fetch the first page of listings on the server and pass it down:

```ts
// apps/web/src/app/place/city/[citySlug]/page.tsx
const [marketIntelTeaser, summary, shelfIndex, initialCityData] = await Promise.all([
  marketIntelSurfaceService.getCityTeaser(citySlug).catch(() => null),
  placesBrowsePublicService.getCityShelfSummary(citySlug).catch(() => null),
  placesBrowsePublicService.getCategories().catch(() => null),
  placesBrowsePublicService.getCityPlaces(citySlug).catch(() => null),   // new — see §5.2
]);
```

**The prop shape is not a flat `PlaceListing[]`.** `PlaceCityClient` renders shelf sections from `data.categories` (grouped, deduped by `buildShelfSections`) plus `total`/`totalPages`, so the prefill must be the **whole city response** (`initialData: CityResponse | null`) — a flat list cannot seed it. `PlaceCategoryClient` *does* take `initialPlaces: PlaceListing[]` (its state is flat).

**The fetch-skip guard needs conditions.** `PlacesIndexClient`'s `if (initialCategories) return` works because its only fetch is categories. Here:

- `PlaceCityClient` paginates/sorts via `?page`/`?sort` — prefill is only valid for `page === 1 && sort === 'name'`; otherwise the effect must still fire.
- `PlaceCategoryClient` fetches places **plus** enrichment and shelf index in one `Promise.all`. Skipping the whole effect drops the enrichment body copy, the `CollectionPage`/`FAQPage` JSON-LD, and the shelf chips. Skip only `getPlacesByCategory` (or prefill all three).

This is the important detail: the existing client returns a loading branch during SSR. Passing data in props is what converts the grid from client-only markup into real `<a href="/place/{slug}">` anchors in the first HTML response — the same fix AGENTS.md documents for `/place`'s hero.

Result: `/place/city/indianapolis-in` goes from 0 to ~24 crawlable detail links; `/place/category/*` likewise.

**City slug normalization.** The sitemap emits `{slugify(city)}-{stateCode}` (`CITY_SLUG_STATE_TOKENS`), but `getPlaceCityShelfUrl(city, state)` slugifies the raw `dps.state`, which the API comments note "may be either form." A stored `Indiana` yields `/place/city/indianapolis-indiana` → 308 → `…-in`. Normalize name→code in `getPlaceCityShelfUrl` (or return a canonical `citySlug` per row from `/places`) so §4.4.2's city links don't all 308.

#### 4.4.2 `/place` index — server-rendered A–Z inventory

The index currently renders a category grid only. Add a server component `PlacesIndexDirectory` below the category grid:

- **Cities:** one link per market → `/place/city/{canonicalSlug}`. Derivable from `getCategories()` (each category carries a `cities[]` breakdown) — no new endpoint.
- **All places:** an alphabetical `<ul>` of every published seed → `/place/{slug}`. Requires `getAllPlaces()` (§5.2).

At 70 listings a flat list is correct and cheap. Define the ceiling now: render up to **500** links server-side; beyond that, paginate into `/place/all` and `/place/all/2` with `rel="next"/"prev"`. Do not ship a page that renders 5,000 anchors — it bloats HTML and dilutes the links that matter.

Use plain `<a>`/Next `<Link>` inside a `<details>` block for the A–Z list so it stays crawlable without JS and doesn't dominate the page visually.

#### 4.4.3 Detail pages — sibling links (phase 2, optional)

`/place/{slug}` currently links only to categories. Add a server-rendered "More in {city}" list of 5–8 sibling listings from the same city. This builds a crawl web rather than a star topology, and it is real user value. Not required to unblock indexing — ship it after the sitemap is accepted.

### 4.5 Canonical hygiene (RC5)

Detail pages already canonicalize correctly — `apps/web/src/app/place/[slug]/layout.tsx:44` emits a self canonical without `?shelf=`, which is right (the shelf param is a referrer hint, not content).

The two browse surfaces need the same treatment, because §4.4 now makes their query variants crawlable:

```ts
// category page — preserve the city filter in the canonical; it changes content
alternates: {
  canonical: `${baseUrl}/place/category/${categorySlug}${city ? `?city=${encodeURIComponent(city)}${state ? `&state=${encodeURIComponent(state)}` : ''}` : ''}`,
},

// city page — canonical uses the resolved slug (handles the legacy 308 source)
alternates: { canonical: `${baseUrl}/place/city/${summary?.canonicalSlug ?? citySlug}` },
```

Pagination: `PlaceCityClient` also carries `?page=` and `?sort=`. Canonicalizing page 2 to page 1 is acceptable **while every city fits on one page** (24/page, ~24 listings/city) and the A–Z index (§4.4.2) covers the remainder. State it in the code comment; if a city outgrows a page, self-canonicalize `?page=N` for N>1 rather than letting the listings fall off the crawl graph.

Storefront, shop-profile, and product canonicals are handled separately in §4.9 — they follow the tenant canonical ladder, not `baseUrl`.

Also add `metadataBase` to the root layout (`apps/web/src/app/layout.tsx:41`). Without it, every relative OG image resolves against the request origin, which is inconsistent across `visibleshelf.com`, `www.`, and preview deployments.

### 4.6 Slug hygiene (RC6)

The sitemap should list pages worth indexing. Filter at the producer, not the renderer:

- Skip any derived shelf slug longer than **60 characters**. Composite labels like `international-supermarket-african-goods-store-per-directory-mixed-asian-mexican-and-african` are operator free-text, not shelves; they produce near-duplicate pages that dilute the real ones.
- Skip any slug containing `per-directory`.
- **Keep** `-unverified` variants (`african-grocery-store-unverified`) — those are legitimate shelf labels with live listings.

Filtered categories keep working as pages and keep their internal links; they are simply not advertised. Log the excluded count on generation so the operator can see what free-text labels are costing.

### 4.7 Storefronts and products (RC7)

Two more inventory sets join the same producer. Both must emit the **canonical** URL, not a convenient platform path — see §4.9 for why, and §4.10 for the cross-host mechanics.

**Storefronts.** Every tenant that renders a live storefront, at its ladder-resolved home:

```sql
SELECT t.id, t.slug, t.subdomain, cd.domain AS custom_domain, t.updated_at
FROM tenants t
LEFT JOIN tenant_custom_domains cd
  ON cd.tenant_id = t.id AND cd.status = 'active'
WHERE t.is_demo IS NOT TRUE
  AND (t.location_status IS NULL OR t.location_status = 'active')
```

Emit `https://{custom_domain}/` when present, else `https://{subdomain}.visibleshelf.com/`, else `{baseUrl}/tenant/{id}`. The path-form segment is the **tenant id** — `/tenant/{id}` is the canonical the storefront page itself emits; the slug is an alias that resolves but canonicalizes to the id, so advertising the slug would make every path-form `<loc>` a non-canonical alternate (caught in production 2026-10-23). This is the **same ladder** as `canonicalStorefrontHome` — batch it in one query, do not call `/api/tenants/storefront-canonical/:id` per tenant. Table/column names are indicative; verify against the `resolveStorefrontCanonical` implementation before writing the query.

**Products.** Every publicly reachable product:

```sql
SELECT ii.id, ii.tenant_id, ii.updated_at
FROM inventory_items ii
JOIN tenants t ON t.id = ii.tenant_id
WHERE ii.item_status = 'active'
  AND ii.visibility = 'public'
  AND t.is_demo IS NOT TRUE
  AND (t.location_status IS NULL OR t.location_status = 'active')
```

Emit `{tenant canonical origin}/products/{id}` — i.e. the product inherits its **owning tenant's** canonical host (`SURFACE_RULES.product.origin = 'canonical'`), not the platform origin and not the request host. `id` is the `pid-…` item id used by every product link in the app; do not invent a slug URL.

**Gating parity.** The `WHERE` clauses above must match the pages' own render gates — the product page itself treats a product as public only when `item_status === 'active' && visibility === 'public'`, and `/shops`/`/tenant` treat non-active, demo, and `google_only`/`discovery` tiers as status-panel-only. Anything the page renders as a status panel or "not found" must not be in the sitemap. Apply the same `t.is_demo IS NOT TRUE` join to the claimed-listing query in §4.2 — a demo tenant's `/directory/{slug}` is a sample profile, not inventory.

### 4.8 Sitemap index architecture

With products in scope, a single `<urlset>` is the wrong shape — product catalogs grow by tenant, not by market, and the 50,000-URL ceiling is reachable. Build the index **now** (this supersedes the earlier "do not build the index yet" guidance):

```
/sitemap.xml                  → <sitemapindex>
  /sitemaps/core.xml          → /place, /directory, /shops (marketing statics optional)
  /sitemaps/places.xml        → /place/category/*, /place/city/*, /place/{slug}
  /sitemaps/directory.xml     → /directory/{slug}
  /sitemaps/storefronts.xml   → ladder-resolved storefront homes
  /sitemaps/products-1.xml …  → products, chunked (≤20,000 per file)
```

- One producer route, `file` as a path param (`GET /api/public/directory/sitemap/:file`); `/sitemap.xml` returns the index.
- Chunk products deterministically (ordered by `id`, fixed page size) so successive crawls fetch stable file contents; emit `<lastmod>` per chunk.
- The web rewrite becomes two entries: `/sitemap.xml` and `/sitemaps/:file`. Both inherit `Cache-Control` from the API.
- `lastmod` is optional per row — **guard it**: `new Date(row.updated_at)` throws on NULL and 500s the whole file (`row.updated_at ? lastmod : omit`).

### 4.9 Canonical consolidation (RC8, RC9, RC10)

The sitemap is only as good as the canonical it agrees with. Three fixes, all on the render side:

**`/shops/{slug}` → storefront home — suppress from the index, not from the crawl.** It is the same storefront as `/tenant/{slug}` with a weaker SSR payload (no product links). The mechanism is **canonicalization only**:

- Emit `alternates: { canonical: canonicalStorefrontHome(lookup, tenantId) }` and give it a real title/description (`{businessName} — Shop Profile`), replacing today's `{}`.
- **No `noindex`.** `noindex` and `canonical` are contradictory: Google drops the URL *and* ignores the canonical, so the consolidation this is meant to achieve never happens. Canonical alone is the signal.
- **No `Disallow: /shops`.** A robots block stops the crawl before the canonical is read — the URL sits in the index as "blocked" with no consolidation, which is worse than either extreme. Crawlers must be able to fetch it.
- **Not in the sitemap** — a sitemap should list canonical URLs only. `/shops` itself (the index) is fine to list.
- **Keep it linked.** `/shops` cards, `/directory/{slug}` storefront hops, and any cross-tenant product links stay as they are: discovery is how the canonical gets found. The page is a crawler path to the storefront, not a dead end.

**`/products/{id}` → owning tenant's canonical origin.** Add `alternates.canonical` built from `canonicalStorefrontOrigin(getStorefrontCanonical(product.tenantId))` + `/products/{id}`. Also switch the JSON-LD `offers[].url` (page.tsx:538–542) from `headers().get('host')` to the same ladder value — the request host is not a stable identity, and the current code emits a different `Offer.url` depending on which surface served the page.

**Demo / non-public gating (RC10).** Add `robots: { index: false, follow: false }` to:
- `/tenant/{id}` when `tenant.isDemo` (mirroring `/shops/{slug}`, which already does this),
- `/products/{id}` when the product is not `item_status === 'active' && visibility === 'public'` (the page already computes `isPubliclyAccessible`), or its tenant is a demo tenant.

Then the sitemap queries in §4.7 exclude the same rows, so the two gates agree.

**Basic SEO is not a paid capability (RC11).** `enhanced_seo` was designed as an enhancement on the assumption that basic SEO already existed for everyone. It didn't — `Product` and `Store` JSON-LD sit behind the capability, so the inventory this spec is trying to index is the inventory that emits no structured data. Un-gate the basics:

**Always emit (no capability check):**
- `Product` JSON-LD on `/products/{id}` — one `<script type="application/ld+json">` built from the existing `structuredData` object (it already carries `sku`, `offers`, `seller`, address).
- `Store` / `OnlineStore` / `Service` JSON-LD on `/tenant/{id}` — built from the existing `schema` object.
- Title, description, canonical — already ungated; keep.

**Stays behind `enhanced_seo` (the capability key is unchanged — no `shared/tier-contract.json` edit):**
- `<meta name="keywords">` — Google ignores it; it is a merchant-visible "your tags are on the page" feature.
- Enriched description concatenation (business description / marketing description appended to the base description).
- Extra OG/Twitter imagery and per-product share-card customization.

**Delete the `metadata.other` JSON-LD path while doing it.** `generateMetadata` in both pages returns `other: { 'application/ld+json': JSON.stringify(schema) }` (`products/[id]/page.tsx:354-356`, `tenant/[id]/page.tsx:598-600`). `metadata.other` renders `<meta name="application/ld+json" content="…">`, which no crawler treats as structured data. Emit exactly one valid `<script>` per page in the body; drop the meta.

**Why this is safe commercially:** structured data is discoverability infrastructure, not a merchant perk. Gating it suppresses the very traffic the paid tiers exist to sell, and BSAAS has other revenue paths that don't depend on this one. The capability keeps its key and its remaining meaning, so no contract or migration work.

### 4.10 robots.txt on tenant hosts (cross-host sitemap authorization)

If the sitemap lists `https://{tenant}.visibleshelf.com/…` or custom-domain URLs, Google requires authorization: either the property is verified in the same Search Console account (true for platform subdomains under the domain property) or **the target host's `robots.txt` references the sitemap**. Today `{tenant}.visibleshelf.com/robots.txt` is 404.

Good news: the proxy already passes any path containing `.` straight through (`proxy.ts:124–128, 208–212`), so `app/robots.ts` will serve on every tenant host with no extra routing work. Two requirements:

- The `Sitemap:` line must be **platform-absolute** (`https://visibleshelf.com/sitemap.xml`) on every host — that is precisely the cross-site authorization signal. Keep `BASE` env-derived, not request-derived.
- `host:` should be omitted (Google ignores it; emitting the platform apex on a tenant host is misleading). Drop it rather than compute it per request.

Custom domains: same mechanism (their `robots.txt` is served by the same app), but the tenant's domain is not in our Search Console account — the robots reference is the only authorization path. Verify per tenant after launch (§8).

### 4.11 Search Console verification

No `google-site-verification` meta tag exists today, so if the property is verified it was done by DNS. Two options:

| Method | Code change | Coupling |
|---|---|---|
| **DNS TXT** (recommended) | none | none — verification survives redeploys and domain changes |
| HTML meta | add to root layout | requires `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in every environment |

If the meta route is chosen:

```ts
// apps/web/src/app/layout.tsx metadata
verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
```

The token is public by design; `NEXT_PUBLIC_` is correct.

---

## 5. Contract

### 5.1 Sitemap URL inventory (expected after change)

| File | Surface | Count | Path form |
|---|---|---|---|
| `core.xml` | Places + directory + shops indexes | 3 | `/place`, `/directory`, `/shops` |
| `places.xml` | Category shelves (post §4.6 filter) | ≤20 | `/place/category/{slug}` |
| `places.xml` | City markets | 10 | `/place/city/{city}-{state}` |
| `places.xml` | Seed listings | 70 | `/place/{slug}` |
| `directory.xml` | Claimed/tenant listings | 2 (measured; not 72 — that total includes seeds) | `/directory/{slug}` |
| `storefronts.xml` | Tenant storefront homes | = real tenants with storefronts | canonical ladder: custom → `{sub}.visibleshelf.com` → `/tenant/{id}`; gate = declared `storefront_visible` predicate (§13.4): not demo, active location, not `google_only`, not an unclaimed `directory_presence` seed — inventory-independent |
| `products-N.xml` | Public products | = active public items | `{owning tenant canonical origin}/products/{id}` |

`/sitemap.xml` is a `<sitemapindex>` over those files (§4.8). Per-file limit 20,000 URLs for products (headroom under the 50,000 cap), 50,000 for the rest.

`/shops/{slug}` is deliberately **absent** — it canonicalizes to the storefront home (§4.9), and a sitemap must list canonical URLs only. Storefront and product counts are not yet measured; the index makes that a non-event.

Note the mixed hosts: storefront/product `<loc>`s for subdomain and custom-domain tenants point off the platform apex. That is intentional and legal only because every tenant host serves a `robots.txt` referencing the platform sitemap (§4.10).

### 5.2 Response shapes

Existing, unchanged:

- `GET /api/public/directory/places` → `{ success, categories[], totalPlaces }`
- `GET /api/public/directory/places/:categorySlug?city=` → `{ success, categorySlug, places[], count }`
- `GET /api/public/directory/places/city/:citySlug?perPage=` → `{ city, state, canonicalSlug, categories[] (shelf-grouped), places[] (flat), total, page, perPage, totalPages, enrichment }` — `perPage` capped at **48**
- `GET /api/public/directory/places/search?page=&perPage=` → `{ success, query, places[], count, total, page, perPage, totalPages }` — **flat, not nested under `pagination`**; `perPage` capped at **48**
- `GET /api/directory/search` → `{ listings[], pagination: { page, limit, totalItems, totalPages } }`, `limit` capped at **100**

New service method (`apps/web/src/services/PlacesBrowsePublicService.ts`):

```ts
/** GET /api/public/directory/places/search — every published seed, alphabetical.
 *  Pages at the API's 48 cap; hard-stops at `max` so a runaway dataset can't
 *  stall a server render. */
async getAllPlaces(max = 500): Promise<PlaceListing[]>
```

New service method for §4.4.1:

```ts
/** GET /api/public/directory/places/city/:citySlug?page=1&perPage=24 — the
 *  first page in the shape PlaceCityClient renders (grouped `categories[]`,
 *  `places[]`, `total`, `totalPages`). NOT a flat PlaceListing[]. */
async getCityPlaces(citySlug: string): Promise<CityResponse | null>
```

Both return `[]`/`null` on failure. A browse page must never 500 because an SEO prefill failed — degrade to the current client-fetch behavior.

**New producer endpoints** (`apps/api`):

- `GET /api/public/directory/sitemap.xml` → `<sitemapindex>` (§4.8).
- `GET /api/public/directory/sitemap/:file` → one `<urlset>` per file (`core`, `places`, `directory`, `storefronts`, `products-N`).
- No new public list endpoints for storefronts/products are needed for v1 — the producer queries SQL directly (§4.7), same as the existing sitemap route. Adding a public "list all products" API would be a second contract to keep in sync; skip it until a consumer other than the sitemap exists.

**Existing, reused:**

- `GET /api/tenants/storefront-canonical/:id` → `{ kind: 'custom'|'subdomain'|'path', host?, tenantId? }`. Correct rule, wrong shape for bulk use — the sitemap must resolve the ladder in SQL (§4.7), not per tenant.

### 5.3 Caching

| Surface | Cache |
|---|---|
| API sitemap index + files | `public, max-age=3600` (existing behaviour, applied to each file) |
| `/sitemap.xml` + `/sitemaps/:file` rewrites | inherit the above |
| `/robots.txt` | Next static metadata route; env-derived, host-independent |
| `/tenant/{slug}` canonical lookup | `tenantPublicService.getStorefrontCanonical` — already cached per tenant |
| SSR prefills | existing 5-minute `PublicApiSingleton` TTL — no change |

**Resolved 2026-10-23:** the `directory_places_sitemap_log` write is **dropped**. Nothing read the table, and the index now generates five-plus files per crawl (so the old ~8.7k rows/year became ~44k). Drop the table in a follow-up migration if nothing else adopts it.

---

## 6. File-by-file change list

### `apps/api`

| File | Change |
|---|---|
| `src/routes/directory-presence-public.ts:1467-1580` | `baseUrl` → `unifiedConfig.webUrl`; add claimed-listing query emitting `/directory/{slug}`; add storefront + product queries with the canonical ladder (§4.7); split into index + per-file `<urlset>` (§4.8); add §4.6 slug filter; add `/place`, `/directory`, `/shops` index URLs; NULL-safe `lastmod`; 500 on bad base URL. |
| `src/services/__tests__/` | New contract test for the URL assembler (pure function extracted from the route), including ladder cases: custom domain, subdomain, path. |

### `apps/web`

| File | Change |
|---|---|
| `next.config.ts` | Add `/sitemap.xml` + `/sitemaps/:file` rewrites. |
| `src/app/robots.ts` | **New** — §4.3. Must serve on tenant hosts too (§4.10) — it does, via the proxy's `.`-path passthrough; add a comment saying so. |
| `src/app/directory/sitemap.xml/route.ts` | Replace body with 308 → `/sitemap.xml`. |
| `src/app/place/page.tsx` | Fetch `getAllPlaces()`; render `PlacesIndexDirectory`. |
| `src/app/place/PlacesIndexDirectory.tsx` | **New** — server component, cities + A–Z listing links, `<details>`. |
| `src/app/place/city/[citySlug]/page.tsx` | Fetch `getCityPlaces()`; pass `initialCityData`; add `alternates.canonical` (§4.5). |
| `src/app/place/city/[citySlug]/PlaceCityClient.tsx` | Accept `initialCityData: CityResponse`; seed state; guard the fetch on `page===1 && sort==='name'`. |
| `src/app/place/category/[categorySlug]/page.tsx` | Fetch first page; pass `initialPlaces`; add canonical. |
| `src/app/place/category/[categorySlug]/PlaceCategoryClient.tsx` | Accept `initialPlaces`; skip only the places call (keep enrichment + shelf fetch). |
| `src/services/PlacesBrowsePublicService.ts` | Add `getAllPlaces`, `getCityPlaces` (returns `CityResponse`). |
| `src/app/layout.tsx` | Add `metadataBase`; optional `verification.google`. |
| `src/app/shops/[slug]/page.tsx` | `generateMetadata`: real title/description + `alternates.canonical` → storefront home (§4.9). Keep the existing demo `noindex`. |
| `src/app/products/[id]/page.tsx` | `generateMetadata`: add `alternates.canonical` from the owning tenant's ladder; replace request-host `offers[].url` with the ladder value; **delete the `metadata.other` JSON-LD**; `noindex` when not publicly accessible or demo tenant (§4.9). Un-gate the body `Product` JSON-LD `<script>` (RC11). |
| `src/app/tenant/[id]/page.tsx` | `generateMetadata`: `noindex` for demo tenants (§4.9); **delete the `metadata.other` JSON-LD** and emit the storefront schema as a body `<script>` for every tenant, not only `enhanced_seo` ones (RC11). Canonical already correct — do not touch it. |
| `src/utils/slug.ts` | `getPlaceCityShelfUrl`: normalize full state names → postal codes so city links match the sitemap (§4.4.1). |
| `src/**/*.test.ts` | Render test for `PlacesIndexDirectory` (server component → `renderToStaticMarkup`, no provider needed); assert `href="/place/..."` and `href="/place/city/..."`. Unit tests for the state-name normalizer and the canonical-ladder URL builder. |

No new dependencies. No schema changes. No migrations.

---

## 7. Acceptance criteria

1. `GET https://visibleshelf.com/robots.txt` → `200`, `text/plain`, contains `Sitemap: https://visibleshelf.com/sitemap.xml`, and does **not** disallow `/place`, `/directory`, `/tenant`, `/shops`, `/products`, or `/_next/`.
2. `GET https://visibleshelf.com/sitemap.xml` → `200`, `application/xml`, is a `<sitemapindex>`; every child file fetches `200`; zero `api.visibleshelf.com` occurrences in any `<loc>`.
3. Sitemap inventory: ≥70 `/place/{slug}`, ≥ the non-seed published listing count at `/directory/{slug}` (**2 at launch — do not assert 72**, that total includes seeds), ≥1 storefront home per live tenant, ≥1 `/products/{id}` per active public item. `/shops/{slug}` appears **zero** times (canonicalized away).
4. **Every** `<loc>` returns `200` — no `3xx`, no `404` — across **all hosts** (platform, `{tenant}.visibleshelf.com`, custom domains). Full sweep, not a sample; §8.
5. `GET /directory/sitemap.xml` → `308` → `/sitemap.xml`.
6. `/place` server HTML contains ≥1 `<a href="/place/{slug}">` and ≥1 `<a href="/place/city/...">` with JS disabled.
7. `/place/city/indianapolis-in` and `/place/category/grocery-store` server HTML each contain ≥10 `<a href="/place/{slug}">`.
8. No indexable listing page emits `noindex`; every `/place/{slug}` has a self-referencing canonical with no `?shelf=`.
9. Canonical agreement: for a subdomain tenant, `/tenant/{slug}` canonical == `https://{sub}.visibleshelf.com/`; `/shops/{slug}` canonical == the same; `/products/{id}` canonical == `https://{sub}.visibleshelf.com/products/{id}` and the JSON-LD `offers[].url` matches it on **both** hosts.
10. **`/shops/{slug}` is suppressed but discoverable:** returns `200`, emits **no** `noindex`, is **not** disallowed by `robots.txt`, and carries the storefront canonical — crawlable and linkable, simply not indexed in its own right. It appears in no sitemap file.
11. Demo tenants and non-public products emit `robots: noindex` and appear in no sitemap file.
12. **Structured data exists without the capability.** A product page for a tenant **without** `enhanced_seo` contains exactly one `<script type="application/ld+json">` with `@type: Product` and `offers[].url` == the canonical URL; a `/tenant/{slug}` for the same tenant contains one `Store`-family script. No page emits `<meta name="application/ld+json">`.
13. `GET https://{tenant}.visibleshelf.com/robots.txt` → `200` containing `Sitemap: https://visibleshelf.com/sitemap.xml`.
14. `pnpm checkapi` and `pnpm checkweb` exit 0.
15. `pnpm build` exits 0 (both apps).

---

## 8. Verification commands

```bash
# 1. Sitemap index → child files, then flatten every loc
curl -sS https://visibleshelf.com/sitemap.xml -o /tmp/sm-index.xml
grep -o '<loc>[^<]*</loc>' /tmp/sm-index.xml | sed 's|<loc>||;s|</loc>||' > /tmp/sm-files.txt
mkdir -p /tmp/sm && rm -f /tmp/sm/*
while read -r f; do
  curl -sS "$f" -o "/tmp/sm/$(basename "$f")"
done < /tmp/sm-files.txt
cat /tmp/sm/*.xml > /tmp/sm-all.xml

grep -c '<loc>' /tmp/sm-all.xml                      # total inventory
grep -c 'api.visibleshelf.com' /tmp/sm-all.xml       # expect 0
grep -c '/place/[^/<]*</loc>' /tmp/sm-all.xml        # expect >= 70
grep -c '/directory/[^/<]*</loc>' /tmp/sm-all.xml    # expect >= non-seed published count (2 at launch)
grep -c '/products/[^/<]*</loc>' /tmp/sm-all.xml     # expect >= 1
grep -c '/shops/[^/<]*</loc>' /tmp/sm-all.xml        # expect 0 (canonicalized away)

# 2. Every URL resolves 200 — across ALL hosts (platform, subdomains, custom domains)
grep -o '<loc>[^<]*</loc>' /tmp/sm-all.xml | sed 's|<loc>||;s|</loc>||' > /tmp/urls.txt
cat /tmp/urls.txt | xargs -P 10 -I{} sh -c \
  'printf "%s %s\n" "$(curl -sS -m 25 -o /dev/null -w "%{http_code}" "{}")" "{}"' \
  | awk '{print $1}' | sort | uniq -c          # expect a single "N 200" line

# 3. robots.txt — platform and a tenant host (cross-site sitemap authorization)
curl -sS https://visibleshelf.com/robots.txt
curl -sS "https://$(sed -n 's|<loc>https://\([^./]*\)\.visibleshelf\.com/</loc>|\1|p' /tmp/sm-all.xml | head -1).visibleshelf.com/robots.txt"

# 4. Crawlable listing links with JS disabled (exclude category/city prefixes)
for u in https://visibleshelf.com/place \
         https://visibleshelf.com/place/city/indianapolis-in \
         https://visibleshelf.com/place/category/grocery-store; do
  echo -n "$u  "
  curl -sS "$u" | grep -o 'href="/place/[^"?]*"' \
    | grep -v 'place/category/\|place/city/' | sort -u | wc -l
done                                             # each expect >= 10

# 5. Canonicals — browse, storefront, shop profile, product (both hosts)
for u in https://visibleshelf.com/place/city/indianapolis-in \
         https://visibleshelf.com/place/category/grocery-store \
         https://visibleshelf.com/tenant/baraka-international-market \
         https://visibleshelf.com/shops/baraka-international-market \
         https://visibleshelf.com/products/pid-ULCW-79au4s1v \
         https://baraka-international-market.visibleshelf.com/products/pid-ULCW-79au4s1v; do
  echo "== $u"
  curl -sS "$u" | grep -oE '<link rel="canonical"[^>]*>|<meta name="robots"[^>]*>'
done

# 5b. Structured data exists without the capability, and only as a script
P=https://visibleshelf.com/products/pid-ULCW-79au4s1v
curl -sS "$P" | grep -o '<script type="application/ld+json">' | wc -l   # expect 1
curl -sS "$P" | grep -o '"@type":"Product"' | wc -l                      # expect >= 1
curl -sS "$P" | grep -c '<meta name="application/ld+json"'               # expect 0
curl -sS https://visibleshelf.com/tenant/baraka-international-market \
  | grep -o '<script type="application/ld+json">' | wc -l                # expect 1
curl -sS https://visibleshelf.com/tenant/baraka-international-market \
  | grep -c '<meta name="application/ld+json"'                           # expect 0

# 5c. /shops — suppressed from the index, still crawlable
S=https://visibleshelf.com/shops/baraka-international-market
curl -sS https://visibleshelf.com/robots.txt | grep -c 'Disallow: /shops'   # expect 0
curl -sS "$S" | grep -cE '<meta name="robots"[^>]*noindex'                  # expect 0
curl -sS "$S" -o /dev/null -w '%{http_code}\n'                              # expect 200
curl -sS "$S" | grep -o '<link rel="canonical"[^>]*>'                       # expect storefront home
grep -c '/shops/[^/<]*</loc>' /tmp/sm-all.xml                               # expect 0 (not advertised)

# 6. Typecheck + build
pnpm checkapi && pnpm checkweb && pnpm build
```

Run 1–5 against production after deploy; 6 locally before merge.

---

## 9. Launch runbook (Search Console)

> **Operator-facing version:** `docs/LocalBiz/SEARCH_CONSOLE_OPERATOR_GUIDE.md` — the
> click-by-click checklist, pre-flight probes, status/troubleshooting matrix, and
> the operator log. This section is the design-level summary.

Code alone will not move the index. After deploy:

1. **Verify the property.** Prefer the domain property (`visibleshelf.com`, DNS TXT) — it covers `www`, apex, every `*.visibleshelf.com` tenant subdomain, and both protocols in one property. That coverage is also what authorizes cross-host `<loc>`s for subdomains in the sitemap. If a URL-prefix property already exists, keep it and add the domain property rather than migrating.
2. **Submit `https://visibleshelf.com/sitemap.xml`.** Status should go to *Success* within a day. *Couldn't fetch* means §4.1 regressed; *URLs not allowed* means §4.10 (per-host robots) regressed.
3. **URL Inspection on 5–7 representative pages** — one `/place/{slug}`, one `/directory/{slug}`, one city, one category, one storefront (subdomain form), one `/shops/{slug}`, one product. Confirm *URL is on Google* → *Request indexing*. Check the storefront/product inspections report the **canonical** host, not the inspected path — if they disagree, §4.9 regressed.
4. **Baseline before, measure after.** Record *Pages → Indexed* and *Not indexed → Discovered – currently not indexed* today. Expect `Discovered` to fall and `Indexed` to rise over 2–4 weeks; a same-day jump is not expected.
5. **Watch *Page indexing → Crawled – currently not indexed*.** If it climbs, the problem has moved from discovery to content quality — different spec.
6. **Custom domains are a separate property each.** They are outside `visibleshelf.com`'s domain property, so cross-host `<loc>`s for them rely solely on the tenant domain's `robots.txt` referencing our sitemap (§4.10). If a tenant cares about their own domain's index, they verify it in their own Search Console; we should not gate the launch on it.

Realistic expectation: sitemap submission → first crawl within days; a meaningful share of the 72 listing pages plus storefronts and products indexed in 2–4 weeks. New domains and thin pages index slower; the content here is not thin (description, address, phone, hours, JSON-LD), which helps — but product pages are only as strong as their catalog data, so expect uneven product coverage.

---

## 10. Risks & open decisions

| # | Risk / decision | Recommendation |
|---|---|---|
| 1 | **Rewrite vs route handler** for `/sitemap.xml`. A rewrite 502s if the API is down. | **Decided: rewrite.** Google retries a failed sitemap; the API is the same dependency the pages themselves need. |
| 2 | **Claimed-listing source.** `listing_origin IS DISTINCT FROM 'directory_seed'` may include rows whose `/directory/{slug}` does not render a listing. | **Lower risk than it looks:** `/api/directory/consolidated/:slug` gates on exactly `dll.slug = $1 AND dll.is_published = true`, so the proposed query matches the page gate. The residual case is `StoreDetailPage`'s `pending` branch — a 200 `StoreComingSoon` stub, which a status-only sweep cannot see. Add a content assertion to the sweep (response must contain the business name, not "Coming Soon"). |
| 3 | **Slug filter aggressiveness** (§4.6). Excluding >60 chars removes real pages from the index. | Ship the filter, log exclusions, revisit after Search Console shows which category pages earn impressions. |
| 4 | **`totalPlaces` is misleading** (shelf memberships). Any sitemap count check using it will be wrong. | Use `<loc>` counts. Do not add a page-count assertion against `totalPlaces`. |
| 5 | **Duplicate content across shelves.** A place with 3 secondary categories appears on 3 category pages with the same card. | Not a new problem, and each shelf page has distinct copy from its enrichment packet. Do not `noindex` shelf pages. |
| 6 | **`directory_places_sitemap_log` growth.** Unbounded insert per generation. | **Resolved: write dropped.** No readers; the index multiplies generation events. Table can be dropped in a follow-up migration. |
| 7 | **SSR prefill cost.** Three extra API calls per browse page render. | All are 5-minute cached and already fetched by the client on the same page view. Net: the client's duplicate fetch is removed. |
| 8 | **Cross-host `<loc>`s** (subdomain + custom-domain storefronts/products) are legal only while each tenant host serves a `robots.txt` referencing the platform sitemap. The proxy's `.`-path passthrough is what makes that work — an unrelated routing change could silently break it. | Keep acceptance #11 and a comment in `proxy.ts` / `robots.ts`. If it breaks, fall back to emitting path-form URLs only (canonicals still consolidate). |
| 9 | **`/shops/{slug}` consolidation** (§4.9) assumes the shop profile is not a deliberately distinct surface. | **Decided 2026-10-23: suppress, don't block.** Canonical to the storefront home; no `noindex`, no `Disallow`, not in the sitemap, keep it linked. Crawlers keep discovering it; equity lands on the storefront. If it later earns unique content, drop the canonical. |
| 10 | **Product volume is unmeasured.** | Run `count(*)` before the sprint; the `<sitemapindex>` (§4.8) makes the answer a sizing exercise, not a redesign. Chunk at 20k. |
| 11 | **Product/storefront JSON-LD was capability-gated** (`showEnhancedSEO`) — an enhancement shipped before the basics existed. | **Decided 2026-10-23: un-gate.** Structured data is discoverability infrastructure, not a merchant perk; the paid path is not load-bearing for BSAAS revenue. `enhanced_seo` keeps `keywords`, enriched copy, and share-card customization (§4.9). Also delete the invalid `metadata.other` JSON-LD while doing it. |
| 12 | **Demo tenants are indexable on `/tenant/{slug}` today** (only `/shops/{slug}` noindexes them), and demo storefronts carry sample products. | §4.9 adds the `noindex`; sitemap queries exclude `is_demo`. Verify demo pages are gone from the index after launch, not just from the sitemap. |
| 13 | **Storefront/product canonical is the tenant host**, so the platform sitemap lists off-apex URLs for subdomain and custom-domain tenants. | **Decided: canonical host.** Agrees with what the pages already emit; §4.10 robots authorization is therefore load-bearing and is verified at launch (§7.13, §8.3). Fallback if Search Console rejects the locs: switch to path form — canonicals still consolidate. |
| 14 | **Apex and `www` both serve 200** (verified on prod and staging 2026-10-23), and staging's `robots.txt` advertises the apex sitemap while its `<loc>`s are on `www.`. | **Fix before submitting.** 301 the non-canonical host at the edge so one host serves content; then robots and sitemap agree by construction. Duplicate hosts split crawl budget and inflate "Alternate page" counts. Pre-flight §0.6 in the operator guide gates on this. |

**Decisions:** all resolved 2026-10-23 (§12.3) — rewrite, canonical-host locs, `/shops` suppressed via canonical, structured data un-gated, `/directory` sitemap-only, all five PR slices. Item 2 (claimed-listing scope) needs no separate decision: §4.2 includes claimed listings gated on `is_published`, and the content-asserting sweep (§7.4) is what catches any stub or miss.

---

## 11. Out of scope

- Content quality / E-E-A-T work on seed descriptions.
- Adding `?city=` category variants to the sitemap (needs canonicalization from §4.5 to settle first).
- Detail-page sibling links (§4.4.3) — phase 2.
- **`/directory` A–Z crawl block.** Claimed listings ship sitemap-only in v1 (§12.3); add the server-rendered list if Search Console shows them underperforming `/place` pages.
- **Per-tenant-host sitemaps.** Each tenant host could serve its own `sitemap.xml` (storefront + that tenant's products). Cleaner for custom domains, unnecessary while the platform sitemap + robots authorization works — **now spec'd as the prerequisite for the paid service**: `docs/LocalBiz/DOMAIN_VISIBILITY_SERVICE_SPEC.md` §2.1 / PR A.
- **Pretty product URLs.** `/products/{pid-…}` stays; a slug URL is a routing + redirect project, not an indexing one.
- **`/retail/[slug]`** — token-gated client preview, correctly `noindex`/disallowed; not an inventory surface.
- Google Business Profile integration, Merchant Center feeds.
- Any change to `directory_presence_seeds` status semantics.
- IndexNow / Bing submission (worth doing, separate ticket).

---

## 12. Implementation plan (pre-sprint)

### 12.1 Before any code — measure and verify

Three numbers and two schema checks decide query shape and chunk sizing. None of them block the code, but all of them change the queries if guessed:

| # | Check | Why |
|---|---|---|
| 1 | `SELECT count(*) FROM inventory_items WHERE item_status='active' AND visibility='public'` | Product volume → chunk count for §4.8. |
| 2 | `SELECT count(*) FROM tenants WHERE is_demo IS NOT TRUE AND (location_status IS NULL OR location_status='active')` | Storefront volume → `storefronts.xml` size. |
| 3 | `SELECT DISTINCT state FROM directory_presence_seeds` | Full names vs postal codes → whether §4.4.1 normalization is required or just defensive. |
| 4 | Read `resolveStorefrontCanonical` against the live schema | Confirm the custom-domain table name + `status` value used in the §4.7 ladder join. |
| 5 | Staging: fetch `{tenant}.visibleshelf.com/robots.txt` through the proxy | Confirm the `.`-path passthrough reaches an app route (it should 404 today, not rewrite to `/404` HTML). |

### 12.2 PR slices, in merge order

Each slice is independently shippable and independently verifiable. Only PR3 changes what Google sees. **Sprint scope: all five** (§12.3) — PR1 ∥ PR2, then PR3, then PR4 ∥ PR5.

**PR1 — Producer correctness (no new surfaces).** `apps/api` only.
§4.1 origin + 500 guard · §4.2 claimed query with demo exclusion · §4.6 slug filter + excluded-count log · extract the pure URL assembler · NULL-safe `lastmod` · contract tests for seed/claimed/ladder cases.
*Why first:* gives a correct single sitemap immediately, and PR3 reuses the assembler.
*Verify:* contract tests, `pnpm checkapi`, staging `curl` of the sitemap → all `<loc>`s on the web origin, the expected `/directory/` rows (2 at launch), zero `3xx` targets.

**PR2 — Canonicals and gating (render side; sitemap untouched).** `apps/web` only.
§4.9 `/shops/{slug}` canonical + real title · `/products/{id}` canonical + ladder `offers[].url` + `noindex` for non-public/demo · `/tenant/{id}` demo `noindex` · RC11 un-gate `Product`/`Store` JSON-LD and delete both `metadata.other` JSON-LD paths.
*Why before PR3:* never advertise a URL whose canonical is wrong — a canonical flip after indexing is slow to consolidate.
*Verify:* §7 criteria 9–12; unit tests for the ladder URL builder; staging `curl` of `/shops/{slug}`, `/tenant/{slug}`, `/products/{id}` on platform **and** tenant host.

**PR3 — Discovery go-live.** `apps/api` sitemap index + `apps/web` plumbing.
§4.7 storefront + product queries · §4.8 `<sitemapindex>` + deterministic chunking · `/sitemap.xml` + `/sitemaps/:file` rewrites · `app/robots.ts` · retire `/directory/sitemap.xml` (308) · `metadataBase` in the root layout.
*Depends on:* PR1 (assembler/origin) and PR2 (canonical agreement).
*Verify:* §7 criteria 1–5, 10, 13; §8 steps 1–3 on staging, then prod; then GSC submission (§9).

**PR4 — Crawl paths (SSR).** `apps/web`.
§4.4.1 city/category prefills (`initialCityData` / `initialPlaces` with the correct guards) · §4.4.2 `/place` A–Z server component (500-link ceiling) · `getAllPlaces`/`getCityPlaces` · §4.4.1 state normalization.
*Can run in parallel with PR3; merge after* so the full sweep isn't measuring new links.
*Verify:* §7 criteria 6–7; `renderToStaticMarkup` test for `PlacesIndexDirectory`; §8 step 4 greps.

**PR5 — Cleanup and ops.**
`PublicDirectoryService.searchDirectory` type fix or removal (RC3 leftover) · `directory_places_sitemap_log` retention job or drop the write (§5.3) · sweep script promoted from §8 if the manual pass gets tedious. The `/directory` A–Z block is **not** in this sprint (§12.3).

### 12.3 Decisions (all resolved 2026-10-23)

| Decision | Resolution |
|---|---|
| Rewrite vs route handler (§10.1) | **Rewrite.** Same dependency the pages already have; no handler to maintain. |
| Canonical-host vs path-form `<loc>`s (§10.13) | **Canonical host.** Storefront/product `<loc>`s use the ladder; §4.10 tenant-host robots is therefore load-bearing and must be verified at launch. |
| `/directory/{slug}` crawl paths | **Sitemap-only for v1.** No `/directory` A–Z block this sprint; revisit if claimed listings earn impressions. |
| `/shops` suppression (§10.9) | **Canonical, not `noindex`, not `Disallow`.** Crawlable and linked, absent from the index and the sitemap. |
| Basic structured data (§10.11) | **Un-gated.** `Product`/`Store` JSON-LD for every tenant; `enhanced_seo` keeps keywords, enriched copy, and share-card customization. |
| Sprint scope | **All five PR slices** (PR1–PR5). |

**Sequencing for the full-scope sprint:** PR1 and PR2 touch disjoint apps (`apps/api` vs `apps/web`) and can run in parallel. PR3 depends on both and is the only externally visible change. PR4 and PR5 can run in parallel after PR3 merges — PR4's SSR prefills are independent of what the sitemap advertises.

### 12.4 Failure modes and rollback

- **PR3 is the only externally visible change.** Rollback = revert the two rewrites; `/sitemap.xml` 404s again (no worse than today) and PR2's canonicals remain correct and harmless.
- **If the full sweep fails on a subset** (claimed listings or products), drop that query from the index rather than shipping `404`s. A sitemap with fewer valid URLs is strictly better than one with broken ones — Google caches failures.
- **If cross-host `<loc>`s are rejected** ("URLs not allowed"), fall back to path-form URLs for storefronts/products (canonicals still consolidate); per-host sitemaps stay out of scope (§11).

### 12.5 Definition of done

All §7 criteria pass against production; §8 returns a single `N 200` line across all hosts; `pnpm build` is green; the sitemap is submitted and *Success* in Search Console; the pre-launch *Pages → Indexed* baseline is recorded (§9.4); the sitemap-log retention job is installed or the write is gone.

**Delivered 2026-10-23:** PR1–PR5 implemented. Local gates green (`pnpm checkapi`, `pnpm checkweb`, `pnpm build`, 217 API lib tests, 734 web tests).

**Production pre-flight (2026-10-23, after the API + web deploy):**

| Gate | Result |
|---|---|
| `robots.txt` | 200, platform-absolute `Sitemap:` line |
| `sitemap.xml` | 200 `<sitemapindex>`; 5 child files all 200 |
| `<loc>` origin | 0 `api.` occurrences; 240 on the apex, 35 on a tenant subdomain |
| Inventory | 275 URLs — 70 place, 2 directory, 20 categories + 7 cities, 5 storefronts, 168 products |
| Full sweep | **275/275 → 200** |
| Tenant-host `robots.txt` | 200, references the platform sitemap |
| Product canonical | platform form and subdomain form both canonicalize to `https://baraka-international-market.visibleshelf.com/products/{id}` |
| `/shops/{slug}` | real title + canonical → storefront home, no `noindex` |
| Legacy paths | `/directory/sitemap.xml` → 308; API `/places-sitemap.xml` → 301 |
| **Host canonicalization** | ✅ prod: `www` → `301` apex (incl. `/robots.txt`, `/sitemap.xml`); wildcard `*.visibleshelf.com` **served** (a redirect there 301'd all tenant subdomains — observed and reverted same day); baraka subdomain + all 35 off-apex `<loc>`s re-verified `200`. ⚠️ staging still split — `visibleshelf.store` and `www.` both `200`, robots/sitemap hosts disagree (API `WEB_URL` vs web `NEXT_PUBLIC_WEB_URL`) |

**Post-promotion finds (2026-10-23, second pass):**

- Path-form `<loc>`s now emit `/tenant/{id}` (matching the canonical); this un-dropped ~90 slug-less tenants and exposed that the storefront gate was undefined: the first deploy advertised **95 storefront URLs of which 59 → 404** — unclaimed presence seeds (freshness-gated render, not a real predicate). Iterated to the declared `storefront_visible` gate (§13.4): excludes unclaimed seeds by tier+origin (not inventory — flyer-only and zero-item storefronts qualify), plus `noindex` on `/tenant/{id}` for `directory_presence` so claim-preview renders never index. **Pending redeploy — expect storefronts.xml ≈ 7–10 locs, all 200.**
- Staging now mirrors prod's domain config (`visibleshelf.store` canonical, `www` → 301, wildcard served) — **but** the API `WEB_URL` still names `www.visibleshelf.store`, so every staging `<loc>` 301s to the apex. Flip staging `WEB_URL` to `https://visibleshelf.store` (and confirm the web `NEXT_PUBLIC_WEB_URL` agrees) — env change, no code.
- `placeshelf.store` confirmed live as a demo storefront on a custom domain: self-canonical, `noindex` (demo), excluded from sitemaps, and serving the **global** sitemap at its own `/sitemap.xml` — the live instance of the Domain Visibility spec's cross-tenant leak.

Remaining: redeploy the storefront gate, fix staging `WEB_URL`, then Search Console submission and the §9 baseline.

---

## 13. Post-launch hardening (non-blocking)

Findings from the 2026-10-23 production sweep (397 advertised URLs: 337 → 200, 59 → 404 pending the storefront-tier gate, 1 transient). None block submission; all are one-PR fixes.

### 13.1 Index pages emit no self-canonical

`/place` and `/directory` render without `<link rel="canonical">`. The URLs are the canonical set *declared* in `core.xml`, but a missing self-canonical leaves `?utm=`/tracking-param duplicates to consolidate by inference instead of declaration.

**Fix:** add `alternates.canonical` — `metadataBase`-relative, so it's host-correct on every surface:

- `apps/web/src/app/place/page.tsx` → `canonical: '/place'`
- `apps/web/src/app/directory/page.tsx` → `canonical: '/directory'`

Cost: two lines each. Verify by grepping SSR HTML for `<link rel="canonical"` on both routes.

### 13.2 Category JSON-LD is hydration-only

`PlaceCategoryClient` builds `enrichment` in `useState(null)` + `useEffect` (`PlaceCategoryClient.tsx:56,63`), so both the `CollectionPage` block (line 129) and the `FAQPage` block (line 382) **never exist in the initial HTML** — they only appear after client hydration. Googlebot's deferred render may pick them up, but structured data that only exists post-JS is a weaker, slower signal — and any crawler without a render pass never sees it.

**Fix:** server-prefetch enrichment in `page.tsx` (identical pattern to the `initialPlaces` prop added in PR4 — fetch `getCategoryEnrichment(categorySlug)` server-side, pass `initialEnrichment`), hydrate `useState(initialEnrichment ?? null)`, and skip the enrichment call inside the `useEffect` when it's present. Then both scripts render into the server document.

**Also fix while there:** `jsonLd.url` falls back to a hardcoded apex (`PlaceCategoryClient.tsx:138`) and on the client uses `window.location.href` — which carries `?city=`/`?state=` params the canonical strips. Set `url` to the same canonical the metadata emits (sans filters), so the schema URL, the canonical, and the sitemap `<loc>` are identical byte-for-byte.

### 13.3 Unenriched category pages have zero structured data

Even with 13.2 fixed, categories without an `enrichment` row emit no JSON-LD at all. Every category page is a list of places — emit a baseline `ItemList` (or `CollectionPage` with `mainEntity: ItemList` of `ListItem → /place/{slug}`) built from the SSR-prefilled `places`, independent of enrichment. Cheap: the data is already in the component.

### 13.4 Storefront existence must be a declared property, not an inventory side-effect

**Finding (2026-10-23, prod data):** `/tenant/{id}` renderability is emergent — there is **no declared storefront flag** on `tenants` (only `google_sync_enabled` matched a flag scan). Empirically:

- `directory_presence` spans both outcomes: ~29 such tenants **render** real storefronts (Garaya, `tid-541v3dug`: title, canonical, JSON-LD, no `noindex`); 59 **404** — and the 404s correlate with `created_at` = today's PG push, not with any data predicate (same tier, same `invited` seed status, same null slug, same published listing).
- `mv_storefront_discovery` presence is **not** the render contract either: Garaya renders with `in_mv = false`. It only looked like the gate because it correlated on the first sample.
- The likely mechanism is a freshness dependency in the render path (an MV/cache that hasn't picked up today's rows) — i.e., the 404s will probably self-heal on the next refresh, at which point *all* unclaimed seeds will render storefronts, which is itself contrary to the intended surface split (seeds = `/place` + `/directory` only).

**Shipped predicate (2026-10-23):**

```sql
storefront_visible(t) :=
  t.is_demo IS NOT TRUE
  AND (t.location_status IS NULL OR t.location_status = 'active')
  AND t.subscription_tier IS DISTINCT FROM 'google_only'
  AND NOT (t.subscription_tier = 'directory_presence'
           AND EXISTS (sl.tenant_id = t.id AND sl.listing_origin = 'directory_seed'))
```

- **Unclaimed seeds** (tier `directory_presence` + `listing_origin='directory_seed'`) → no storefront in the sitemap; they render at `/place/{slug}` and `/directory/{slug}` only. Claiming flips the listing origin → the predicate turns on → the storefront is advertised on next publish. Seed storefronts that still render also get `noindex` on the page (added alongside this gate) so rendering for claim/preview UX cannot leak into the index.
- **Real tenants** (any other tier, or a claimed seed) → storefront is advertised **regardless of inventory**. A tenant maintaining a storefront purely for flyer display qualifies — `tenant_flyers` are visibility content, not `inventory_items`, so any product-count gate is wrong by construction.
- **Consumers wired:** `storefronts.xml` (this predicate) and `/tenant/{id}` `robots` (`directory_presence` now emits `noindex`). `/shops/{slug}` resolution unchanged — it stays crawlable per §4.9.
- **Known gap, deliberate:** the page still *renders* seed storefronts (404s on today's push are a freshness accident, not policy) — the `noindex` makes that safe. If seed storefronts should hard-404 instead, that's a product decision — verify nothing links `/tenant/{id}` to a seed as a preview surface before flipping to `notFound()`.

**Optional follow-up:** flyers may deserve their own indexable surface (`/flyers/{id}`-style detail + a `flyers.xml` sitemap file) once flyer display is a productized storefront reason — out of scope here, flagged for the Domain Visibility work.

### 13.5 Sweep anomalies to keep watching

- **59 storefront 404s** — `directory_presence` seed rows; fixed in code, pending promote. Re-sweep `storefronts.xml` post-deploy: expect ~36 locs, all 200.
- **1 transient product 404** (`sid-er0kwf2z` → 200 on retry, API healthy) — likely a cold miss; note if it recurs in weekly checks.
- **Methodology note:** sweep from a *fresh* fetch of the five child files only — a stale staging capture injected 34 `www.visibleshelf.store` locs into one run (they 301; staging is healthy). Prod sitemap contains zero staging locs.

---

## Appendix A — Probe log (2026-10-23)

```
GET https://visibleshelf.com/robots.txt                     404  text/html
GET https://visibleshelf.com/sitemap.xml                    404
GET https://visibleshelf.com/directory/sitemap.xml          200  application/xml  (1 <loc>)
GET https://visibleshelf.com/api/public/directory/places-sitemap.xml
                                                            200  application/xml  (101 <loc>, all api.visibleshelf.com)
GET https://visibleshelf.com/api/directory/search?limit=1&published=true
                                                            200  {"listings":[...],"pagination":{...,"totalItems":72}}
  NOTE (2026-10-23): 72 = 70 seeds + 2 tenant listings. This total searches the
  whole published directory, seeds included — it is NOT a tenant-listing count.
GET https://visibleshelf.com/api/public/directory/places    200  {"totalPlaces":119,"categories":[...20...]}

SSR link census (raw HTML, no JS):
  /place                                  href="/place/{slug}"  = 0
  /place/city/indianapolis-in             href="/place/{slug}"  = 0
  /directory                              href="/directory/{slug}" = 0
  /directory/stores                       href="/directory/{slug}" = 0

Full sweep of the 101 sitemap URLs against the web origin: 101/101 → 200
  (1 index + 20 category + 10 city + 70 detail)

GET /place/dreamcast-african-market-indianapolis-in           200
  <title>Dreamcast African Market — African Grocery Store — in Indianapolis, IN | VisibleShelf</title>
  <link rel="canonical" href="https://visibleshelf.com/place/dreamcast-african-market-indianapolis-in"/>
  JSON-LD: GroceryStore, BreadcrumbList
  <meta name="robots"> absent (indexable)

GET /directory/baraka-international-market                    200
GET /place/baraka-international-market                        308 → /directory/baraka-international-market

Storefront / shop / product probes (same day):
GET /tenant/baraka-international-market                       200
  <title>Baraka International Market inc. - Store &amp; Services | VisibleShelf</title>
  <link rel="canonical" href="https://baraka-international-market.visibleshelf.com/"/>
  href="/products/{pid-…}" anchors in raw HTML: 12+
GET /shops/baraka-international-market                        200
  <title>Shop Profile | VisibleShelf</title>          ← generic, no tenant name
  <link rel="canonical">                              ← absent
  href="/products/{pid-…}" anchors in raw HTML: 0
GET /products/pid-ULCW-79au4s1v                               200
  <title>Product Name - Custom attribute test - Baraka International Market inc. | VisibleShelf</title>
  <link rel="canonical">                              ← absent
  JSON-LD offers[].url = https://visibleshelf.com/products/pid-ULCW-79au4s1v
GET https://baraka-international-market.visibleshelf.com/products/pid-ULCW-79au4s1v
                                                              200  (same product, second URL)
GET https://baraka-international-market.visibleshelf.com/robots.txt
                                                              404
```
