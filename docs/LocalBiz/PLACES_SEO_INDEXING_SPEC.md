# Places & Directory SEO Indexing — Spec

> Google has indexed the platform's marketing pages but none of its inventory.
> `site:visibleshelf.com` returns the home page, `/terms`, and `/directory` — and
> nothing else. The 70 `/place/{slug}` pages and 72 `/directory/{slug}` pages that
> constitute the product are invisible to search, not because they are low quality,
> but because the platform publishes no sitemap, no robots.txt, and no crawlable
> link to any of them.

**Status:** Proposed — awaiting team review
**Owner:** TBD
**Scope:** `apps/api` sitemap producer · `apps/web` sitemap/robots exposure + server-rendered crawl paths
**Surfaces:** `/place`, `/place/city/*`, `/place/category/*`, `/place/{slug}`, `/directory`, `/directory/{slug}`

---

## 1. Overview

### 1.1 Problem

Search Console cannot help until Google can *find* the pages. Today it cannot:

- `https://visibleshelf.com/robots.txt` → **404** (no robots file exists anywhere in `apps/web`)
- `https://visibleshelf.com/sitemap.xml` → **404** (no root sitemap)
- `https://visibleshelf.com/directory/sitemap.xml` → **200, but contains exactly one `<url>`: `/directory`**
- Every listing grid is client-fetched in `useEffect`, so the server HTML for `/place`, `/place/city/*`, `/place/category/*`, and `/directory` contains **zero** `<a href="/place/{slug}">` links

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

Inventory at the time of writing: **70** seed listings (`/place/{slug}`), **72** published tenant listings (`/directory/{slug}`), **20** category shelves, **10** city markets. `/api/public/directory/places` reports `totalPlaces: 119` — that is *shelf memberships*, not unique listings (a place on three shelves counts three times). Do not use it as a page count.

### 1.3 Why it costs more than "we're not ranking yet"

- **The sitemap that exists is unusable.** The API already generates a complete 101-URL sitemap (`/api/public/directory/places-sitemap.xml`), but it stamps every `<loc>` with `https://api.visibleshelf.com`. Submitted to Search Console as-is, every URL is cross-domain and rejected.
- **The sitemap the web app serves is a silent failure.** `/directory/sitemap.xml` reads `listings.items`, but `/api/directory/search` returns `{ listings, pagination }`. `items` is `undefined`, `.map()` throws, and the `catch` returns a minimal one-URL fallback. It has never emitted a listing and never logs an error to the operator.
- **Orphaned pages don't get crawled on hope.** Googlebot renders JS, but rendering is budgeted. 142 listing pages with no static inbound link and no sitemap entry is not a "wait for the renderer" situation — it is an absence of discovery.
- **Every new seed ships orphaned.** The seed pipeline adds listings continuously; without a crawl path each new page inherits the same defect.

### 1.4 Solution summary

Six changes, in dependency order:

1. **Fix the sitemap's canonical origin** — emit `WEB_URL`, not `req.get('host')`.
2. **Make the API sitemap the single producer** for all public inventory (seeds *and* claimed tenants), and expose it at the web origin as `/sitemap.xml`.
3. **Add `robots.txt`** at the web origin, pointing at that sitemap.
4. **Retire the broken `/directory/sitemap.xml`** (308 to `/sitemap.xml`) so there is one sitemap, not two disagreeing ones.
5. **Server-render listing links** on `/place`, `/place/city/*`, and `/place/category/*` so pages have inbound crawl paths independent of JS.
6. **Verify the property in Search Console** and submit; add self-referencing canonicals so the crawl paths we just created don't create duplicates.

Steps 1–4 are the indexing unblock. Step 5 is what makes it durable. Step 6 is a runbook, not code.

---

## 2. Current state (reuse — do not rebuild)

| Piece | Location | Role | Verdict |
|---|---|---|---|
| Sitemap producer | `apps/api/src/routes/directory-presence-public.ts:1467` `GET /places-sitemap.xml` | Emits `/place`, `/place/category/*`, `/place/city/*`, `/place/{slug}` from live SQL. 101 URLs today. | **Keep. Fix origin, extend to claimed.** |
| Web sitemap route | `apps/web/src/app/directory/sitemap.xml/route.ts` | Intended to emit `/directory` + listing pages. | **Broken. Retire.** |
| `PublicDirectoryService.searchDirectory` | `apps/web/src/services/PublicDirectoryService.ts:116` | Typed `DirectorySearchResponse { items }`; the API actually returns `{ listings }`. | Type lie — remove the only caller and fix the type or leave unused. |
| Places browse service | `apps/web/src/services/PlacesBrowsePublicService.ts` | `getCategories()`, `getPlacesByCategory()`, `getCityShelfSummary()`. | **Reuse** for SSR crawl paths. |
| City page | `apps/web/src/app/place/city/[citySlug]/page.tsx` | Server-renders hero + enrichment; grid is client. | Add `initialPlaces`. |
| Category page | `apps/web/src/app/place/category/[categorySlug]/page.tsx` | Server-renders nothing but metadata; grid is client. | Add `initialPlaces`. |
| Index page | `apps/web/src/app/place/page.tsx` | Already passes `initialCategories` to `PlacesIndexClient` (the established SSR-prefill pattern). | **Reuse the pattern.** |
| Detail page | `apps/web/src/app/place/[slug]/page.tsx` | Server-rendered listing + JSON-LD. `dynamic = 'force-dynamic'`. | No change needed for indexing. |

`PlacesIndexClient` already demonstrates the pattern this spec extends — server fetches, client accepts an optional initial value, skips its own fetch when present (`apps/web/src/app/place/PlacesIndexClient.tsx:20,39-59`). Mirror it; do not invent a second approach.

---

## 3. Root causes

| ID | Root cause | Impact |
|---|---|---|
| **RC1** | API sitemap derives `<loc>` from `req.protocol + '://' + req.get('host')` (`directory-presence-public.ts:1470`). Through the Next proxy the host is `api.visibleshelf.com`. | Every URL cross-domain → sitemap unusable. |
| **RC2** | No `robots.txt` and no root `/sitemap.xml` at the web origin. | Nothing to submit; no discovery hint. |
| **RC3** | `/directory/sitemap.xml` reads `listings.items` from a response shaped `{ listings, pagination }`; the throw is swallowed into a 1-URL fallback. | Zero listings emitted; failure is invisible. |
| **RC4** | All listing grids fetch in `useEffect`. Server HTML carries no `<a href>` to any detail page. | 142 detail pages orphaned. |
| **RC5** | `/place/city/*` and `/place/category/*` emit no canonical; category URLs take `?city=&state=` query variants. | Once crawlable, variants compete as duplicates. |
| **RC6** | Shelf slugs are derived from free-text category labels. The sitemap currently includes `international-supermarket-african-goods-store-per-directory-mixed-asian-mexican-and-african`. | Composite operator labels create junk URLs in the index. |

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

**Extend the producer to claimed listings.** The current query is seed-only (`listing_origin = 'directory_seed'`), so the 72 tenant listings at `/directory/{slug}` are absent. Add a third query and emit them at their canonical path:

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
{ source: '/sitemap.xml', destination: `${apiBaseUrl}/api/public/directory/places-sitemap.xml` },
```

The rewrite inherits the API's `Content-Type: application/xml` and `Cache-Control: public, max-age=3600`. No new route handler, no duplicated URL assembly.

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
        '/checkout', '/login', '/logout', '/signup', '/register', '/auth/',
        '/recovery', '/preview/', '/debug/', '/settings',
      ],
    }],
    sitemap: `${BASE.replace(/\/+$/, '')}/sitemap.xml`,
    host: BASE,
  };
}
```

Two rules matter more than the list:

- **Never disallow `/_next/`.** Google needs the CSS/JS bundles to render; blocking them is the classic way to make a JS-heavy site render as an empty shell.
- **Never disallow `/place` or `/directory`.** A single stray `Disallow: /place` here silently undoes this entire spec.

The disallow list above is app-internal only. Review it against the route tree in `apps/web/src/app` before merge; when in doubt, omit.

### 4.4 Crawl paths — server-rendered listing links (RC4)

The sitemap gets Google to the pages. Links keep it there and distribute PageRank. Both are needed; the sitemap alone does not make a page "not orphaned".

#### 4.4.1 City and category pages — prefill the grid

Follow the `initialCategories` precedent. In each page component, fetch the first page of listings on the server and pass it down:

```ts
// apps/web/src/app/place/city/[citySlug]/page.tsx
const [marketIntelTeaser, summary, shelfIndex, initialPlaces] = await Promise.all([
  marketIntelSurfaceService.getCityTeaser(citySlug).catch(() => null),
  placesBrowsePublicService.getCityShelfSummary(citySlug).catch(() => null),
  placesBrowsePublicService.getCategories().catch(() => null),
  placesBrowsePublicService.getCityPlaces(citySlug).catch(() => null),   // new — see §5.2
]);
```

Client change in `PlaceCityClient` / `PlaceCategoryClient`: accept `initialPlaces?: PlaceListing[] | null`, seed state from it, and skip the initial fetch when present (exactly `PlacesIndexClient`'s `useEffect` guard at line 41).

This is the important detail: the existing client returns a loading branch during SSR. Passing data in props is what converts the grid from client-only markup into real `<a href="/place/{slug}">` anchors in the first HTML response — the same fix AGENTS.md documents for `/place`'s hero.

Result: `/place/city/indianapolis-in` goes from 0 to ~24 crawlable detail links; `/place/category/*` likewise.

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

Also add `metadataBase` to the root layout (`apps/web/src/app/layout.tsx:41`). Without it, every relative OG image resolves against the request origin, which is inconsistent across `visibleshelf.com`, `www.`, and preview deployments.

### 4.6 Slug hygiene (RC6)

The sitemap should list pages worth indexing. Filter at the producer, not the renderer:

- Skip any derived shelf slug longer than **60 characters**. Composite labels like `international-supermarket-african-goods-store-per-directory-mixed-asian-mexican-and-african` are operator free-text, not shelves; they produce near-duplicate pages that dilute the real ones.
- Skip any slug containing `per-directory`.
- **Keep** `-unverified` variants (`african-grocery-store-unverified`) — those are legitimate shelf labels with live listings.

Filtered categories keep working as pages and keep their internal links; they are simply not advertised. Log the excluded count on generation so the operator can see what free-text labels are costing.

### 4.7 Search Console verification

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

| Surface | Count | Path |
|---|---|---|
| Places index | 1 | `/place` |
| Directory index | 1 | `/directory` |
| Category shelves | ≤20 (post §4.6 filter) | `/place/category/{slug}` |
| City markets | 10 | `/place/city/{city}-{state}` |
| Seed listings | 70 | `/place/{slug}` |
| Claimed/tenant listings | 72 | `/directory/{slug}` |
| **Total** | **~174** | |

Single `<urlset>`, well under the 50,000-URL / 50 MB limits. **Growth path:** when the count approaches 45,000, split into a `<sitemapindex>` with `sitemap-places-1.xml` … and keep `/sitemap.xml` as the index. Do not build the index now — it adds a moving part for a site with 174 pages.

### 5.2 Response shapes

Existing, unchanged:

- `GET /api/public/directory/places` → `{ success, categories[], totalPlaces }`
- `GET /api/public/directory/places/:categorySlug?city=` → `{ success, categorySlug, places[], count }`
- `GET /api/public/directory/places/city/:citySlug?perPage=` → `{ city, state, total, enrichment, canonicalSlug, places[] }`
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
/** GET /api/public/directory/places/city/:citySlug — first page of listings.
 *  City summary already returns `places[]`; this is the typed accessor for it. */
async getCityPlaces(citySlug: string): Promise<PlaceListing[] | null>
```

Both return `[]`/`null` on failure. A browse page must never 500 because an SEO prefill failed — degrade to the current client-fetch behavior.

### 5.3 Caching

| Surface | Cache |
|---|---|
| API sitemap | `public, max-age=3600` (existing) |
| `/sitemap.xml` rewrite | inherits the above |
| `/robots.txt` | Next static metadata route |
| SSR prefills | existing 5-minute `PublicApiSingleton` TTL — no change |

The producer writes a row to `directory_places_sitemap_log` per generation. At 1/hour that is ~8.7k rows/year — acceptable, but **add it to the retention job set** (`purge-*` pattern documented in AGENTS.md) or drop the write. Flagging rather than deciding.

---

## 6. File-by-file change list

### `apps/api`

| File | Change |
|---|---|
| `src/routes/directory-presence-public.ts:1467-1580` | `baseUrl` → `unifiedConfig.webUrl`; add claimed-listing query emitting `/directory/{slug}`; add §4.6 slug filter; add `/directory` to the index URLs; 500 on bad base URL. |
| `src/services/__tests__/` | New contract test for the URL assembler (pure function extracted from the route). |

### `apps/web`

| File | Change |
|---|---|
| `next.config.ts` | Add `/sitemap.xml` rewrite. |
| `src/app/robots.ts` | **New** — §4.3. |
| `src/app/directory/sitemap.xml/route.ts` | Replace body with 308 → `/sitemap.xml`. |
| `src/app/place/page.tsx` | Fetch `getAllPlaces()`; render `PlacesIndexDirectory`. |
| `src/app/place/PlacesIndexDirectory.tsx` | **New** — server component, cities + A–Z listing links, `<details>`. |
| `src/app/place/city/[citySlug]/page.tsx` | Fetch `getCityPlaces()`; pass `initialPlaces`. |
| `src/app/place/city/[citySlug]/PlaceCityClient.tsx` | Accept `initialPlaces`; seed state; guard the fetch. |
| `src/app/place/city/[citySlug]/page.tsx` (metadata) | Add `alternates.canonical`. |
| `src/app/place/category/[categorySlug]/page.tsx` | Fetch first page; pass `initialPlaces`; add canonical. |
| `src/app/place/category/[categorySlug]/PlaceCategoryClient.tsx` | Accept `initialPlaces`; seed state; guard the fetch. |
| `src/services/PlacesBrowsePublicService.ts` | Add `getAllPlaces`, `getCityPlaces`. |
| `src/app/layout.tsx` | Add `metadataBase`; optional `verification.google`. |
| `src/**/*.test.ts` | Render test for `PlacesIndexDirectory` (server component → `renderToStaticMarkup`, no provider needed); assert `href="/place/..."` and `href="/place/city/..."` are present. |

No new dependencies. No schema changes. No migrations.

---

## 7. Acceptance criteria

1. `GET https://visibleshelf.com/robots.txt` → `200`, `text/plain`, contains `Sitemap: https://visibleshelf.com/sitemap.xml`, and does **not** disallow `/place`, `/directory`, or `/_next/`.
2. `GET https://visibleshelf.com/sitemap.xml` → `200`, `application/xml`, every `<loc>` starts with the web origin (zero `api.visibleshelf.com` occurrences).
3. Sitemap contains ≥70 `/place/{slug}` URLs and ≥72 `/directory/{slug}` URLs.
4. **Every** `<loc>` returns `200` — no `3xx`, no `404`. (Full sweep, not a sample; §8.)
5. `GET /directory/sitemap.xml` → `308` → `/sitemap.xml`.
6. `/place` server HTML contains ≥1 `<a href="/place/{slug}">` and ≥1 `<a href="/place/city/...">` with JS disabled.
7. `/place/city/indianapolis-in` and `/place/category/grocery-store` server HTML each contain ≥10 `<a href="/place/{slug}">`.
8. No listing page emits `noindex`; every `/place/{slug}` has a self-referencing canonical with no `?shelf=`.
9. `pnpm checkapi` and `pnpm checkweb` exit 0.
10. `pnpm build` exits 0 (both apps).

---

## 8. Verification commands

```bash
# 1. Sitemap shape and origin
curl -sS https://visibleshelf.com/sitemap.xml -o /tmp/sm.xml
grep -c '<loc>' /tmp/sm.xml                       # expect ~174
grep -c 'api.visibleshelf.com' /tmp/sm.xml        # expect 0
grep -c '/place/[^/<]*</loc>' /tmp/sm.xml         # expect >= 70
grep -c '/directory/[^/<]*</loc>' /tmp/sm.xml     # expect >= 72

# 2. Every URL resolves 200 (full sweep)
grep -o '<loc>[^<]*</loc>' /tmp/sm.xml | sed 's|<loc>||;s|</loc>||' > /tmp/urls.txt
cat /tmp/urls.txt | xargs -P 10 -I{} sh -c \
  'printf "%s %s\n" "$(curl -sS -m 25 -o /dev/null -w "%{http_code}" "{}")" "{}"' \
  | awk '{print $1}' | sort | uniq -c          # expect a single "N 200" line

# 3. robots.txt
curl -sS https://visibleshelf.com/robots.txt

# 4. Crawlable links with JS disabled
curl -sS https://visibleshelf.com/place | grep -c 'href="/place/[a-z0-9-]*"'
curl -sS https://visibleshelf.com/place/city/indianapolis-in | grep -c 'href="/place/[a-z0-9-]*"'
curl -sS https://visibleshelf.com/place/category/grocery-store | grep -c 'href="/place/[a-z0-9-]*"'

# 5. Canonicals
curl -sS https://visibleshelf.com/place/city/indianapolis-in | grep -o '<link rel="canonical"[^>]*>'
curl -sS https://visibleshelf.com/place/category/grocery-store | grep -o '<link rel="canonical"[^>]*>'

# 6. Typecheck + build
pnpm checkapi && pnpm checkweb && pnpm build
```

Run 1–5 against production after deploy; 6 locally before merge.

---

## 9. Launch runbook (Search Console)

Code alone will not move the index. After deploy:

1. **Verify the property.** Prefer the domain property (`visibleshelf.com`, DNS TXT) — it covers `www`, apex, and both protocols in one property. If a URL-prefix property already exists, keep it and add the domain property rather than migrating.
2. **Submit `https://visibleshelf.com/sitemap.xml`.** Status should go to *Success* within a day. *Couldn't fetch* means §4.1 regressed.
3. **URL Inspection on 3–5 representative pages** — one `/place/{slug}`, one `/directory/{slug}`, one city, one category. Confirm *URL is on Google* → *Request indexing*. This seeds discovery for the highest-value pages while the sitemap works through the queue.
4. **Baseline before, measure after.** Record *Pages → Indexed* and *Not indexed → Discovered – currently not indexed* today. Expect `Discovered` to fall and `Indexed` to rise over 2–4 weeks; a same-day jump is not expected.
5. **Watch *Page indexing → Crawled – currently not indexed*.** If it climbs, the problem has moved from discovery to content quality — different spec.

Realistic expectation: sitemap submission → first crawl within days; a meaningful share of 142 pages indexed in 2–4 weeks. New domains and thin pages index slower; the content here is not thin (description, address, phone, hours, JSON-LD), which helps.

---

## 10. Risks & open decisions

| # | Risk / decision | Recommendation |
|---|---|---|
| 1 | **Rewrite vs route handler** for `/sitemap.xml`. A rewrite 502s if the API is down. | Rewrite for v1. Google retries a failed sitemap; the API is the same dependency the pages themselves need. |
| 2 | **Claimed-listing source.** `listing_origin IS DISTINCT FROM 'directory_seed'` may include published rows whose `/directory/{slug}` 404s (inactive tenant). | Acceptance criterion 4 (full sweep) catches it. If failures appear, tighten the join to active tenants rather than dropping the surface. |
| 3 | **Slug filter aggressiveness** (§4.6). Excluding >60 chars removes real pages from the index. | Ship the filter, log exclusions, revisit after Search Console shows which category pages earn impressions. |
| 4 | **`totalPlaces` is misleading** (shelf memberships). Any sitemap count check using it will be wrong. | Use `<loc>` counts. Do not add a page-count assertion against `totalPlaces`. |
| 5 | **Duplicate content across shelves.** A place with 3 secondary categories appears on 3 category pages with the same card. | Not a new problem, and each shelf page has distinct copy from its enrichment packet. Do not `noindex` shelf pages. |
| 6 | **`directory_places_sitemap_log` growth.** Unbounded insert per generation. | Add to the retention job set or drop the write. Low urgency. |
| 7 | **SSR prefill cost.** Three extra API calls per browse page render. | All are 5-minute cached and already fetched by the client on the same page view. Net: the client's duplicate fetch is removed. |

**Blocking decision for review:** item 1 (rewrite vs handler) and item 2 (claimed-listing scope). The rest can proceed.

---

## 11. Out of scope

- Content quality / E-E-A-T work on seed descriptions.
- Adding `?city=` category variants to the sitemap (needs canonicalization from §4.5 to settle first).
- Detail-page sibling links (§4.4.3) — phase 2.
- Google Business Profile integration, Merchant Center feeds.
- Any change to `directory_presence_seeds` status semantics.
- IndexNow / Bing submission (worth doing, separate ticket).

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
```
