# Storefront SEO Enrichment — Per-Store Sitemaps, Tenant-Branded OG, Richer JSON-LD — Spec

> The canonical ladder shipped and verified (PLACES_SEO_INDEXING_SPEC §4.9):
> all three storefront surfaces (`/tenant/{slug}`, `{tenant}.visibleshelf.com`,
> custom domain) emit `<link rel="canonical">` at the tenant's canonical host,
> and product pages canonicalize per *owning* tenant. What remains is
> enrichment: the tenant host doesn't act like a first-class site — its
> robots.txt points only at the platform sitemap, no per-store sitemap exists,
> social cards brand as the platform, and the `Store` JSON-LD omits data the
> page already renders.

**Status:** Proposed — awaiting team review
**Revision:** 2026-10-23 — initial
**Owner:** TBD
**Scope:** `apps/api` tenant sitemap producer · `apps/web` host-aware `/sitemap.xml` + `robots.txt` + storefront metadata/JSON-LD
**Surfaces:** `{tenant}.visibleshelf.com`, tenant custom domains (platform apex and `/tenant/{id}` path-tier unchanged)

---

## 1. Overview

### 1.1 Problem

A tenant on the top addressing level — a custom domain — is a real site, but
three signals still treat it as platform content:

- **No per-store sitemap.** `placeshelf.store/robots.txt` declares
  `Sitemap: https://visibleshelf.com/sitemap.xml` (correct — that is the
  §4.10 cross-host authorization), and `placeshelf.store/sitemap.xml` serves
  the *platform* index via the `next.config.ts` rewrite. The tenant's own
  URLs live inside `storefronts.xml` and `products-N.xml` shared with every
  other tenant. There is no file a merchant can submit to Search Console as
  "my store's sitemap."
- **Share cards brand the platform, not the store.** Tenant-branded
  `openGraph`/`twitter` metadata exists in
  `app/tenant/[id]/page.tsx#generateMetadata` but is gated behind the
  `enhanced_seo` capability — a tenant without it gets the root-layout
  defaults: `og:title "VisibleShelf"`, platform description, platform icon.
  Basic social correctness is not a premium feature (same reasoning as RC11).
- **The `Store` JSON-LD is thinner than the page.** `buildStorefrontSchema`
  supports `address`/`telephone`/`email`/`website`/`keywords`/`image`, but
  the address block is gated on `tenant.metadata?.address` while the fields
  come from `tenant.profileData` — so a tenant with a city/state on record
  emits no `PostalAddress`. There is no `url`, `sameAs`, `geo`, or
  `openingHoursSpecification` even though `getTenantWithProducts` already
  fetches `businessHours`, `mapLocation`, and `socialLinks`.

### 1.2 Evidence (live probes, 2026-10-23 — tenant `tid-25we5qgj`, domain `placeshelf.store`)

| Probe | Result |
|---|---|
| `GET /` on all 3 surfaces | `200`, canonical `https://placeshelf.store` ✓ |
| `GET /products/pid-QASF-4rqs54v9` on all 3 surfaces | `200`, canonical `https://placeshelf.store/products/…` ✓ |
| `GET https://www.placeshelf.store/` | `301` → apex ✓ |
| `GET placeshelf.store/robots.txt` | `Sitemap: https://visibleshelf.com/sitemap.xml` only |
| `GET placeshelf.store/sitemap.xml` | `200` — the **platform** sitemapindex (core/places/directory/storefronts/products-N) |
| `sitemaps/storefronts.xml` | lists `https://placeshelf.store/` ✓ (ladder applied at generation) |
| `og:*` on storefront home | `og:title "VisibleShelf"`, platform icon — tenant branding suppressed by `enhanced_seo` gate |
| JSON-LD on storefront home | `{"@type":"Store","name","description"}` only — no `PostalAddress` despite ", Plainfield, IN" rendering in the page |

### 1.3 Solution summary

Four changes:

1. **Per-store `/sitemap.xml`** on every tenant host — one `<urlset>` of that
   tenant's canonical URLs (`/` + `/products/{id}`). Served on the canonical
   host; non-canonical tenant hosts 308 to it. Platform apex unchanged.
2. **Host-aware `robots.txt`** — tenant hosts declare both their canonical
   sitemap and the platform sitemap (the §4.10 authorization must survive).
3. **Always-on tenant OG/Twitter** — basic social branding ungated;
   `enhanced_seo` keeps keywords + enriched copy.
4. **Richer `Store` JSON-LD** — fix the address gate, add `url`, `sameAs`,
   `geo`, `openingHoursSpecification` from data the page already loads.

## 2. Current state (reuse — do not rebuild)

| Asset | Location | Reuse |
|---|---|---|
| Canonical ladder (web) | `lib/storefront-routing.ts` — `canonicalStorefrontOrigin`, `canonicalStorefrontHome`, `isTenantHostName` | host classification + URL mapping |
| Canonical ladder (api) | `lib/sitemap.ts` — `tenantCanonicalOrigin`, `tenantCanonicalHome`, `buildProductEntries`, `renderUrlset`, `renderSitemapIndex`, `formatLastmod`, `escapeXml` | sitemap construction |
| Custom-domain join | `directory-presence-public.ts` — `TENANT_LADDER_JOIN` | tenant resolution for entries |
| Host→tenant resolution | `GET /api/tenants/resolve-subdomain/:sub`, `GET /api/tenants/resolve-custom-domain/:host`, `GET /api/tenants/storefront-canonical/:id` | sitemap/robots canonical lookup |
| Storefront metadata | `app/tenant/[id]/page.tsx#generateMetadata` — canonical + `enhanced_seo` gate | OG/Twitter split |
| Store JSON-LD | `lib/storefront-seo.ts#buildStorefrontSchema` | schema builder |
| robots | `app/robots.ts` (`force-dynamic`, platform-absolute `Sitemap:`) | host-aware sitemap lines |
| Web sitemap exposure | `next.config.ts` rewrites `/sitemap.xml`, `/sitemaps/:file` → API | platform path stays |

## 3. Design

### 3.1 Per-store `/sitemap.xml` (D1–D4)

**D1 — the sitemap belongs to the canonical surface.** `/sitemap.xml` on a
tenant host answers "what is indexable on *this store's* canonical host":
the storefront home plus every public product page, all `<loc>`s on the
canonical origin (`tenantCanonicalOrigin`). A sitemap's scope is the host
that serves it — canonical locs on the canonical host are self-referential
and need no cross-host authorization.

**D2 — non-canonical tenant hosts 308 to the canonical sitemap.** With a
custom domain active, `place-shelf.visibleshelf.com/sitemap.xml` →
`308 https://placeshelf.store/sitemap.xml`. Alternatives rejected: emitting
subdomain-host locs advertises non-canonical URLs; emitting custom-domain
locs from the subdomain host is cross-host without authorization. The
redirect states the truth: the store's sitemap lives on its canonical host.

**D3 — path-tier tenants get no tenant sitemap.** Their canonical origin is
the platform apex (`tenantCanonicalHome` → `/tenant/{id}`), and a per-tenant
file on the apex would violate sitemap path-scoping (its products live under
`/products/`, outside `/tenant/{id}/`). The platform index already lists
their storefront and products — nothing lost.

**D4 — producer stays in the API.** Same producer, same gates, same caching.

```
GET /api/public/directory/tenant-sitemap/:key
```

- `:key` resolves a tenant by tenant id, subdomain, or active custom domain
  (whichever matches first — ids and domains are unambiguous namespaces).
- Tenant gates: identical to `loadStorefrontEntries` — not `is_demo`,
  `location_status` null-or-active, tier not `directory_presence`/`google_only`.
  Unresolvable or ineligible → 404.
- Product rows: identical gates to `loadProductEntries`, scoped
  `WHERE ii.tenant_id = $1` — `item_status='active'`, `visibility='public'`.
- Entries: `{canonical}/` (`changefreq: weekly`, `priority: 0.9`) then
  `{canonical}/products/{id}` via `buildProductEntries`-equivalent shaping
  (`lastmod` = `ii.updated_at`, `changefreq: monthly`, `priority: 0.5`).
- `Cache-Control: public, max-age=3600` (same as platform sitemaps).
- URL-cap guard: if a tenant ever exceeds ~40k products, emit a
  `<sitemapindex>` over `/api/public/directory/tenant-sitemap/:key/products-{n}.xml`
  — out of scope for v1 beyond a code comment; tenant catalogs are
  hundreds-not-thousands today.

### 3.2 Web route: `app/sitemap.xml/route.ts` (new, `force-dynamic`)

A file route takes precedence over the `next.config.ts` rewrite for
`/sitemap.xml`, so this one file owns the decision:

```
host = headers().get('host')
if (!isTenantHostName(host)) → proxy the API sitemapindex
   (fetch `${API}/api/public/directory/sitemap.xml`, stream body + content-type)
else:
   canonical = resolveTenantCanonical(host)   // 3.3
   if (!canonical) → proxy the API sitemapindex      // safe default
   else if (host === canonical.host) → fetch `/api/public/directory/tenant-sitemap/{tenantId}`, return xml
   else → 308 to `https://${canonical.host}/sitemap.xml`
```

The existing `/sitemap.xml` rewrite becomes unreachable — remove it (keep
`/sitemaps/:file`, which still serves the platform's child files).

### 3.3 Canonical resolution from a request host

A small shared helper (`lib/tenant-host-canonical.ts`) used by both
`sitemap.xml/route.ts` and `robots.ts`:

- Host matches `*.visibleshelf.com` → `GET /api/tenants/storefront-canonical/{subdomain}`
  (the endpoint accepts id-or-slug; subdomain is a slug).
- Any other non-platform host → `GET /api/tenants/resolve-custom-domain/{host}`
  → `tenantId`, then `storefront-canonical/{tenantId}`.
- Result: `{ kind, host, tenantId } | null` — null on miss/4xx/outage.
- `cache` the fetches (React `cache()` or the service layer's 30 s cache) —
  robots.txt and sitemap.xml are crawled often.

### 3.4 Host-aware `robots.ts`

`robots.ts` is already `force-dynamic`; read the request host and emit two
`Sitemap:` lines on tenant hosts (`MetadataRoute.Robots.sitemap` accepts
`string[]`):

```
# tenant host (canonical or not — always point at the canonical file)
Sitemap: https://{canonical.host}/sitemap.xml
Sitemap: https://visibleshelf.com/sitemap.xml   # §4.10 authorization — DO NOT DROP
```

- Resolution failure → platform line only (today's behavior, safe).
- The `Allow`/`Disallow` list is host-agnostic and stays identical —
  storefront paths are the same on every tenant host.
- Keep the file's §4.10 comment; extend it to explain the two-line form.

### 3.5 Always-on tenant OG/Twitter (`generateMetadata`)

Split what the `enhanced_seo` gate currently bundles:

**Always (baseline social correctness):**
```
openGraph: {
  title:       customTitle || businessName,
  description: `${typeLabel.desc} from ${businessName}`,
  url:         canonicalUrl,               // new — canonical, not request host
  siteName:    businessName,               // new — store, not "VisibleShelf"
  images:      [logo_url || banner_url] (absolute — prefix canonical origin if relative),
  type:        'website',
},
twitter: { card: 'summary_large_image', title, description, images }
```

**Still gated on `enhanced_seo`:** `keywords`, the `business_description`-enriched
`description`/`og:description`, and any future premium fields.

Note: this *un-gates* part of what `enhanced_seo` sold. That is deliberate —
the capability keeps the premium surface (keywords + enriched copy); a share
card naming the platform on a merchant's own domain reads as a bug to them.

### 3.6 JSON-LD enrichment (`buildStorefrontSchema` + call site)

Basic structured data stays outside the capability (RC11). Changes:

- **Fix the address gate (bug).** Emit `PostalAddress` whenever *any* of
  `profileData.{address_line1,city,state,postal_code,country_code}` is
  non-empty — drop the `tenant.metadata?.address` precondition that made the
  block vanish for tenants whose address lives in `profileData` (observed:
  Place Shelf renders ", Plainfield, IN" but emitted no schema address).
- **`url`:** canonical storefront home (`canonicalUrl` is already computed in
  `generateMetadata`; pass it through to the builder).
- **`sameAs`:** `socialLinks`/`metadata.social_links` values
  (`facebook`, `instagram`, `twitter`, `linkedin`) filtered to absolute
  `https?://` URLs — garbage strings never reach the schema.
- **`geo`:** `mapLocation` → `{"@type":"GeoCoordinates","latitude","longitude"}`
  when lat/lng are present.
- **`openingHoursSpecification`:** `businessHours` (already fetched) →
  `{@type:'OpeningHoursSpecification', dayOfWeek, opens, closes}` per open
  day; closed days omitted (schema.org convention); timezone applied.
- Out of scope v1: `priceRange`, `aggregateRating`, `makesOffer`/`ItemList`
  of products.

### 3.7 Product JSON-LD

`Product` schema already emits with canonical `offers[].url` (spec §4.9 fixed
the request-host leak). Verify `image` and `offers.availability` survive on
tenant hosts; no other change this round.

## 4. Contract

### 4.1 robots.txt per host class

| Host | `Sitemap:` lines |
|---|---|
| `visibleshelf.com` | `https://visibleshelf.com/sitemap.xml` |
| `placeshelf.store` (canonical) | `https://placeshelf.store/sitemap.xml` + `https://visibleshelf.com/sitemap.xml` |
| `place-shelf.visibleshelf.com` (non-canonical) | `https://placeshelf.store/sitemap.xml` + `https://visibleshelf.com/sitemap.xml` |

### 4.2 `GET placeshelf.store/sitemap.xml` → `200`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://placeshelf.store/</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://placeshelf.store/products/pid-QASF-4rqs54v9</loc><lastmod>2026-10-23</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>
  …
</urlset>
```

`GET place-shelf.visibleshelf.com/sitemap.xml` → `308 https://placeshelf.store/sitemap.xml`.
`GET visibleshelf.com/sitemap.xml` → unchanged `<sitemapindex>`.

### 4.3 Metadata on the storefront home (every surface)

```html
<link rel="canonical" href="https://placeshelf.store"/>
<meta property="og:title" content="Place Shelf"/>
<meta property="og:url" content="https://placeshelf.store/"/>
<meta property="og:site_name" content="Place Shelf"/>
<meta name="twitter:title" content="Place Shelf"/>
```

### 4.4 JSON-LD

```json
{"@context":"https://schema.org","@type":"Store",
 "name":"Place Shelf","description":"Browse products from Place Shelf.",
 "url":"https://placeshelf.store/",
 "address":{"@type":"PostalAddress","addressLocality":"Plainfield","addressRegion":"IN"},
 "openingHoursSpecification":[…], "sameAs":[…]}
```

## 5. Edge cases

- **Zero-product tenant:** urlset contains just `/` — a valid minimal sitemap.
- **Domain disabled/suspended:** canonical ladder falls to subdomain → the
  subdomain host serves its own sitemap; custom host stops resolving at the
  proxy anyway.
- **Demo / `google_only` tenants:** excluded by the producer gates; their
  hosts shouldn't serve a sitemap (resolve → ineligible → 404 → the route
  falls back to the platform index proxy, which is also correct).
- **Resolution outage:** both the route and robots degrade to platform
  behavior — never an empty sitemap or a missing robots.
- **`www.` host:** the proxy's www→apex 301 fires before any route handling —
  no special-casing needed.
- **Stale cache:** all fetches honor the existing short TTLs; a newly-active
  domain shows its sitemap within the cache window (≤60 s) + CDN TTL (1 h).

## 6. File-by-file change list

### `apps/api`
- `src/routes/directory-presence-public.ts` — `GET /tenant-sitemap/:key`
  (tenant resolve by id/subdomain/domain + gates) and `loadTenantProductRows`.
- `src/lib/sitemap.ts` — `buildTenantSitemapEntries` (compose
  `tenantCanonicalOrigin` + `buildProductEntries` shaping).
- `src/lib/__tests__/sitemap.test.ts` — tenant urlset shaping, gate coverage,
  path-tier exclusion.

### `apps/web`
- `src/app/sitemap.xml/route.ts` — **new**; host-aware route (§3.2).
- `src/lib/tenant-host-canonical.ts` — **new**; request-host → canonical
  resolver (§3.3).
- `src/app/robots.ts` — two-line `Sitemap:` on tenant hosts.
- `src/app/tenant/[id]/page.tsx` — `generateMetadata`: ungated OG/Twitter +
  `og:url`/`siteName`; `buildStorefrontSchema` call gains `url`, `sameAs`,
  `geo`, `openingHoursSpecification`, and the profileData-driven address gate.
- `src/lib/storefront-seo.ts` — builder fields for `url`/`sameAs`/`geo`/
  `openingHoursSpecification` (+ `StorefrontSchemaInput` extension).
- `src/lib/__tests__/storefront-seo.test.ts` — new field coverage, address
  gate, `sameAs` URL filtering, hours mapping.
- `next.config.ts` — remove the `/sitemap.xml` rewrite (shadowed by the route);
  keep `/sitemaps/:file`.

### Tests / verification

- Unit: sitemap builders, schema builder, host classifier branches.
- Render test (`renderToStaticMarkup` pattern): storefront home emits
  tenant-branded `og:*` without `enhanced_seo`, and JSON-LD carries
  `url`/`address`/`sameAs`.
- Live probes (post-deploy): the four evidence rows in §1.2 — canonical
  sitemap 200 on canonical host, 308 on subdomain, two-line robots, branded
  OG, enriched JSON-LD.

## 7. Out of scope

- `/services` + `/policies/*` sitemap entries (prefix-root pages exist but are
  thin; add when their content warrants it).
- `ItemList` schema for the collection grid.
- Per-tenant Search Console property automation.
- 301-consolidating the three storefront surfaces (canonical-link
  consolidation is the shipped design — spec §4.9).
