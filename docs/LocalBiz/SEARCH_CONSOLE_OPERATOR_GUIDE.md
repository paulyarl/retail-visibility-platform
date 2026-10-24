# Search Console Submission — Operator Guide

> **Who this is for:** whoever owns getting the directory indexed. You do not
> need to read the code. You need a Google account, access to the DNS records,
> and about an hour for the first pass — then five minutes a week for a month.
>
> **What you are doing:** telling Google the sitemap exists, proving you own the
> domain, and recording a baseline so you can tell whether it worked.
>
> **Design background:** `docs/LocalBiz/PLACES_SEO_INDEXING_SPEC.md` (§4.10 cross-host
> authorization, §9 runbook, §7 acceptance criteria). This guide is the
> click-by-click version of §9.

**Target:** `https://visibleshelf.com` (production)
**Rehearsal (optional):** `https://visibleshelf.store` (staging — separate property)
**Time to first signal:** 3–7 days for first crawls; 2–4 weeks for a meaningful share indexed.

---

## 0. Pre-flight — do not open Search Console until all seven pass

Google caches a bad sitemap. Run these first; if any fail, stop and fix before submitting.

### 0.1 robots.txt exists and points at the sitemap

```bash
curl -sS https://visibleshelf.com/robots.txt
```

Expect `200` and, near the end:

```
Sitemap: https://visibleshelf.com/sitemap.xml
```

The file must **not** contain `Disallow: /place`, `/directory`, `/tenant`, `/shops`, `/products`, or `/_next/`.

### 0.2 The sitemap index loads

```bash
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://visibleshelf.com/sitemap.xml
```

Expect `200 application/xml`. Open it in a browser too — it should list child files (`core.xml`, `places.xml`, `directory.xml`, `storefronts.xml`, `products-1.xml`, …), not page URLs.

### 0.3 Every child file the index lists loads

```bash
curl -sS https://visibleshelf.com/sitemap.xml -o /tmp/smi.xml
grep -o '<loc>[^<]*</loc>' /tmp/smi.xml | sed 's|<loc>||;s|</loc>||' > /tmp/sm-files.txt
while read -r f; do
  printf '%s ' "$(basename "$f")"
  curl -sS -o /dev/null -w '%{http_code}\n' "$f"
done < /tmp/sm-files.txt
```

Expect `200` on **every** line. The list should include `core.xml`, `places.xml`,
`directory.xml`, `storefronts.xml`, and at least `products-1.xml` when the
catalog is non-empty.

### 0.4 No `<loc>` points at the API host

```bash
mkdir -p /tmp/sm && rm -f /tmp/sm/*
while read -r f; do curl -sS "$f" -o "/tmp/sm/$(basename "$f")"; done < /tmp/sm-files.txt
cat /tmp/sm/*.xml > /tmp/sm-all.xml
grep -c 'api.visibleshelf.com' /tmp/sm-all.xml   # expect 0
```

### 0.5 A tenant host serves robots.txt (this authorizes storefront/product URLs)

Pick any storefront host from `storefronts.xml`:

```bash
grep -o 'https://[a-z0-9.-]*\.visibleshelf\.com/' /tmp/sm-all.xml | head -1
curl -sS "<paste that URL>robots.txt"
```

Expect `200` with the **same** `Sitemap: https://visibleshelf.com/sitemap.xml` line. If this 404s, stop: the storefront and product URLs in the sitemap will be rejected as "URLs not allowed".

### 0.6 One canonical host — apex and `www` must agree

Google treats `visibleshelf.com` and `www.visibleshelf.com` as **different
sites**. If both answer `200`, every page exists twice, and the sitemap can end
up advertising one host while robots.txt lives on the other.

```bash
# Do both hosts serve, or does one redirect?
for u in https://visibleshelf.com/ https://www.visibleshelf.com/; do
  printf '%s -> ' "$u"; curl -sS -m 20 -o /dev/null -w '%{http_code} %{url_effective}\n' -L "$u"
done

# Do robots.txt and the sitemap agree on the host?
curl -sS https://visibleshelf.com/robots.txt | grep '^Sitemap:'
grep -o '<loc>https://[^/]*' /tmp/sm-all.xml | sort -u
```

**Pass condition:** the `Sitemap:` host matches the host used by the `<loc>`s,
and the other host `301`s to it. **Fail condition:** both serve `200`, or the two
hosts disagree.

> **State (2026-10-23, prod):** `www.visibleshelf.com` → `301` apex, verified for
> `/`, `/robots.txt`, and `/sitemap.xml`. Configured in Vercel → Project →
> Domains with three entries:
>
> | Domain | Setting | Why |
> |---|---|---|
> | `visibleshelf.com` | **Production** | canonical host |
> | `*.visibleshelf.com` | **Production** (served, NOT redirected) | tenant subdomains are canonical hosts — a wildcard redirect kills them |
> | `www.visibleshelf.com` | **Redirect → `visibleshelf.com` (301)** | the specific entry wins over the wildcard for `www` |
>
> **Do not** set the wildcard to "Redirect": a `*.visibleshelf.com → 301`
> redirect catches every tenant subdomain, so `{tenant}.visibleshelf.com/`
> lands on the platform homepage and the sitemap's off-apex `<loc>`s all
> become redirects. Observed live 2026-10-23 when the wildcard was briefly
> set to redirect — `baraka-international-market.visibleshelf.com` 301'd
> root, `robots.txt`, and product pages to the apex. Reverted to served the
> same day; the subdomain and all 35 off-apex `<loc>`s re-verified `200`.
>
> **State (staging):** still split — both `visibleshelf.store` and
> `www.visibleshelf.store` serve `200`; the sitemap's `<loc>`s are on `www`
> (API `WEB_URL`) while `robots.txt`'s `Sitemap:` line is on the apex (web
> `NEXT_PUBLIC_WEB_URL`). Pick one canonical host, align both env vars to it,
> and redirect the other host the same way.

### 0.7 Full sweep — every advertised URL returns 200

```bash
grep -o '<loc>[^<]*</loc>' /tmp/sm-all.xml | sed 's|<loc>||;s|</loc>||' > /tmp/urls.txt
cat /tmp/urls.txt | xargs -P 10 -I{} sh -c \
  'printf "%s %s\n" "$(curl -sS -m 25 -o /dev/null -w "%{http_code}" "{}")" "{}"' \
  | awk '{print $1}' | sort | uniq -c
```

Expect a single line: `N 200`. Any `3xx` or `404` must be fixed before submission — a sitemap full of redirects or dead links trains Google to distrust it.

---

## 1. Create or verify the property

**Use a Domain property, not a URL-prefix property.** A Domain property
(`visibleshelf.com`) covers the apex, `www`, **every tenant subdomain**, and both
protocols in one place. A URL-prefix property covers only the exact prefix you
type — which is why it is the wrong choice here.

1. Open <https://search.google.com/search-console>.
2. **Add property** → choose **Domain** → enter `visibleshelf.com` → **Continue**.
3. Google shows a DNS **TXT** record:
   - Name/host: `@` (the apex)
   - Value: `google-site-verification=…` (copy it exactly)
4. Add that TXT record at whoever hosts DNS for `visibleshelf.com`
   (registrar, Cloudflare, Vercel — wherever the existing records live).
5. Wait for DNS to propagate (usually minutes), then click **Verify**.

**If a property already exists**, do not migrate it — add the Domain property
alongside it. Both can coexist; the Domain one is the one you will submit from.

**Staging:** repeat with `visibleshelf.store` if you want to rehearse. Staging is
a different domain and needs its own verification.

> Verification survives redeploys. You only do this once per domain.

---

## 2. Submit the sitemap

1. In the property, open **Indexing → Sitemaps**.
2. Enter **`https://visibleshelf.com/sitemap.xml`** — the full URL. A Domain
   property shows no host prefix on the input, so a bare `sitemap.xml` is
   rejected as "Invalid sitemap address" (a URL-prefix property prefixes the
   input and would take just `sitemap.xml`, but that is not what we use).
3. **Submit**.
4. Open the entry and confirm:
   - **Status:** `Success`
   - **Discovered URLs:** roughly the total `<loc>` count across all child files
     (`grep -c '<loc>' /tmp/sm-all.xml` gives the number).

Statuses you may see and what they mean:

| Status | Meaning | Action |
|---|---|---|
| **Success** | Fetched and parsed. | Nothing. Move to §3. |
| **Couldn't fetch** | Google could not download it. | Re-run §0.2. If it loads for you, wait 24h and check again — transient fetches are common. |
| **Sitemap has errors / URLs not allowed** | Some `<loc>`s are on a host Google won't accept. | Re-run §0.4 and §0.5. Cross-host storefront/product URLs require the tenant host's `robots.txt` to reference the sitemap. |
| **Pending** | Queued. | Wait a day. |

**Submit once.** Resubmitting repeatedly does not speed anything up and can
delay processing.

---

## 3. Ask for the first pages (URL Inspection)

Google will work through the sitemap on its own. To seed discovery for the
highest-value pages, request indexing for a handful. The tool is rate-limited —
use it on **representative** pages, not everything.

Pick 5–7, one from each surface:

1. A seed listing — `https://visibleshelf.com/place/<a slug from places.xml>`
2. A claimed tenant listing — `https://visibleshelf.com/directory/<a slug from directory.xml>`
3. A city shelf — `https://visibleshelf.com/place/city/<city-slug>`
4. A category shelf — `https://visibleshelf.com/place/category/<category-slug>`
5. A storefront — `https://visibleshelf.com/tenant/<tenant-slug>`
6. A shop profile — `https://visibleshelf.com/shops/<tenant-slug>`
7. A product — `https://visibleshelf.com/products/<product-id>`

For each: paste the URL into the search box at the top of Search Console →
**Test live URL** → when it says the URL is available, click **Request indexing**.

**Check the canonical on each result.** The storefront, shop profile, and product
should report a canonical pointing at the tenant's own host (a subdomain or
custom domain), not the platform path. If they disagree, the canonical code
regressed — tell engineering before requesting more.

> `/shops/<slug>` is **expected** to be reported as "Alternate page with proper
> canonical tag" — that is the intended state. It is crawlable on purpose and
> deliberately not indexed in its own right. Do not "fix" it.

---

## 4. Record the baseline — before you wait

This is the only step people skip, and it is the only way to know it worked.

Open **Indexing → Pages** and record:

| Metric | Date: ______ | Notes |
|---|---|---|
| Indexed (total) | | |
| Not indexed → *Discovered – currently not indexed* | | Should **fall** over 2–4 weeks |
| Not indexed → *Crawled – currently not indexed* | | Watch this one (§5) |
| Not indexed → *Alternate page with proper canonical tag* | | Expected to **rise** — `/shops` and the platform-form storefront/product URLs land here |
| Not indexed → *Excluded by ‘noindex’ tag* | | Should stay near zero; demo tenants only |

Also record the sitemap's own numbers:

```bash
echo "total locs: $(grep -c '<loc>' /tmp/sm-all.xml)"
echo "place:      $(grep -c '/place/[^/<]*</loc>' /tmp/sm-all.xml)"
echo "directory:  $(grep -c '/directory/[^/<]*</loc>' /tmp/sm-all.xml)"
echo "products:   $(grep -c '/products/[^/<]*</loc>' /tmp/sm-all.xml)"
```

---

## 5. Weekly check (5 minutes, for four weeks)

Each week, in the same property:

1. **Indexing → Pages** — compare against §4. `Discovered` should trend down, `Indexed` up.
2. **Indexing → Sitemaps** — status still `Success`, discovered count roughly stable.
3. **Experience / Enhancements** — if `Product` structured-data items appear, the JSON-LD un-gating worked.

Interpretation:

| What you see | What it means | What to do |
|---|---|---|
| `Indexed` rising steadily | Working. | Nothing. |
| `Discovered – currently not indexed` stays flat for 3+ weeks | Google found them but is deferring. Usually crawl budget or thin content. | Request indexing on a few; confirm internal links exist on `/place` (cities + A–Z block). |
| `Crawled – currently not indexed` climbs | Google fetched and decided not to index. This is a **content quality** signal, not a discovery one. | Escalate — this is a different problem than this work solved. |
| `Alternate page with proper canonical tag` climbs | Expected: `/shops`, and storefront/product URLs seen on the "wrong" host. | Nothing. |
| `Excluded by ‘noindex’` climbing on real pages | A gating rule is too broad (demo/`google_only`/non-public). | Escalate with the affected URLs. |
| Sitemap flips to *Couldn't fetch* | The API or the rewrite broke. | Re-run §0.2; if it fails for you too, escalate. |

---

## 6. Troubleshooting

| Symptom | Most likely cause | Check | Fix owner |
|---|---|---|---|
| `sitemap.xml` 404s | Rewrite removed or web deploy didn't ship | §0.2 | Engineering |
| `robots.txt` sitemap host ≠ `<loc>` host | `WEB_URL` and the web env disagree, or no host redirect | §0.6 | Engineering (env / edge redirect) |
| Both apex and `www` serve `200` | No canonical-host redirect at the edge | §0.6 | Engineering (edge config) |
| `<loc>`s show `api.visibleshelf.com` | Producer fell back to the request host | §0.4 | Engineering |
| "URLs not allowed" for storefront/product URLs | Tenant host `robots.txt` missing or not referencing the platform sitemap | §0.5 | Engineering |
| Sitemap has far fewer URLs than expected | Gates too tight (demo/`location_status`) or the product table is empty | Compare §4 counts to the database | Engineering |
| `/shops` pages appear in the index | Canonical missing on shop profiles | Inspect one `/shops/<slug>` for `<link rel="canonical">` | Engineering |
| Product pages indexed under two hosts | Canonical or `Offer.url` regressed to the request host | Inspect both hosts' `<link rel="canonical">` | Engineering |
| Pages indexed but show no rich results | Structured data missing or invalid | Run one product URL through the Rich Results Test | Engineering |

---

## 7. Custom domains (per tenant)

A tenant's own domain (e.g. `shop.example.com`) is **outside** our Domain
property. Two consequences:

- Its URLs in our sitemap are authorized only by that domain's `robots.txt`
  pointing at our sitemap (§0.5 covers the platform subdomains; custom domains
  work the same way).
- If a tenant wants their own domain's index, they verify it in their own Search
  Console. **Do not gate this launch on that.**

> **Productizing this:** `docs/LocalBiz/DOMAIN_VISIBILITY_SERVICE_SPEC.md` specs the
> paid per-domain service — per-host sitemap, guided verification, automated health
> checks, monthly reporting. Two consequences for this guide once that ships:
> a tenant host will advertise **its own** sitemap (not the platform one), and the
> platform sitemap will stop listing custom-domain URLs (decision D4), so the
> cross-host authorization in §0.5 applies to platform subdomains only.

---

## 8. Do not do these

- ❌ Submit `https://api.visibleshelf.com/…` — every URL would be cross-domain and rejected.
- ❌ Submit `/directory/sitemap.xml` — it 308s to `/sitemap.xml` by design.
- ❌ Add `Disallow: /shops` "to hide it" — a robots block stops the crawl before the
  canonical is read, leaving the URLs blocked-and-unconsolidated. The canonical is
  what suppresses them.
- ❌ Add `noindex` to `/shops` — same problem: `noindex` voids the canonical.
- ❌ Disallow `/_next/` — Google needs the bundles to render the pages.
- ❌ Resubmit the sitemap daily hoping for speed.
- ❌ Expect a same-day jump. Two to four weeks is normal.
- ❌ Request indexing on hundreds of URLs — the quota is small and it does not scale.

---

## 9. Rollback

The sitemap is the only externally visible piece. If it misbehaves:

1. Engineering reverts the two rewrites (`/sitemap.xml`, `/sitemaps/:file`) — the
   sitemap 404s again, which is exactly where we started.
2. Canonicals, robots rules, and structured data are independent and stay correct.
3. In Search Console, the sitemap entry will show *Couldn't fetch*; remove it if the
   rollback lasts more than a week.

Nothing here is destructive: there is no data migration, and no page changes
behaviour when the sitemap is absent.

---

## 10. Handoff checklist

Copy this into the ticket and tick as you go.

- [ ] §0.1 robots.txt 200 + `Sitemap:` line
- [ ] §0.2 sitemap index 200
- [ ] §0.3 every child file 200
- [ ] §0.4 zero `api.` occurrences
- [ ] §0.5 tenant-host robots.txt 200
- [ ] §0.6 robots/sitemap host agree; `www` 301s to the canonical host
- [ ] §0.7 full sweep = single `N 200`
- [ ] Domain property verified (`visibleshelf.com`)
- [ ] `sitemap.xml` submitted, status **Success**
- [ ] 5–7 URLs inspected + indexing requested; canonicals checked
- [ ] Baseline recorded (§4 table filled in)
- [ ] Week 1 check done
- [ ] Week 2 check done
- [ ] Week 3 check done
- [ ] Week 4 check done — result summarised in the ticket

---

## Appendix — operator log

| Date | Action | Result / notes |
|---|---|---|
| 2026-10-24 | Pre-flight (§0) run | All 7 checks pass. 160 `<loc>`s, all `200` (80 `/place/*` seeds, 23 categories, 12 cities, 2 `/directory/*`, 7 `/tenant/*`, 32 products + 1 storefront root on `placeshelf.store`, 3 core). No `api.` hosts; `www` 301s → apex; `placeshelf.store/robots.txt` authorizes the platform sitemap (§0.5). Note: storefront `<loc>`s are `/tenant/tid-*` IDs, not slugs; no `/shops/<slug>` `<loc>`s exist (only the `/shops` index). |
| | Property verified | Domain property `visibleshelf.com` already existed — 2 indexed / 13 not indexed at start |
| 2026-10-24 | Sitemap submitted | `https://visibleshelf.com/sitemap.xml` — status **Success** (briefly showed "Couldn't fetch" immediately after submit; flipped to Success within minutes). Discovered pages: 0 at submit time (lags while children parse) |
| 2026-10-24 | Indexing requested | 7 URLs: `/place/enerem-african-food-store`, `/directory/global-grace-grocery`, `/place/city/indianapolis-in`, `/place/category/african-grocery-store`, `/tenant/tid-3x142y4v`, `/place`, `/shops`. `/directory` already indexed; `/shops` already attributed to sitemap.xml discovery. Also: `placeshelf.store` is outside this Domain property; products are not inspectable here. |
| 2026-10-24 | Smoke-test tenants retired | Initial "canonical drift" hypothesis was wrong — the `/tenant/tid-*` `<loc>`s were **duplicate fake tenant records** for businesses that have real tenants (real Baraka = `tid-m8ijkrnk`, subdomain `baraka-international-market`, `ecommerce`, `location_status: pending`). Gate analysis: the storefronts query only excludes `directory_presence` tenants that have an *unclaimed seed listing* — bare tenants with **no listing row** pass as "real storefronts". Retired 7 fake tenants to `location_status='inactive'` (`95z7cwca`, `xha7tg6k`, `88ng3zem`, `3x142y4v`, `drevvhrc`, `g22hluvc`, `wlm4vswo`; `closure_reason`/`status_changed_*` stamped; `tid-vde9sc6a` was already `archived`). `storefronts.xml` re-verified = 2 locs (`placeshelf.store/` + `tid-vqg85k8p`). **Engineering follow-ups:** (a) retired storefronts still serve `200` self-canonical with **no `noindex`** — inactive tenants should 404/410 or noindex (we'd already queued `tid-3x142y4v` for indexing); (b) consider gating storefronts on having ≥1 listing or an explicit storefront flag, not just "no unclaimed-seed listing"; (c) `/tenant/` bare root resolved **same day** — platform host 308s to `/shops` (`app/tenant/page.tsx`), tenant hosts 301 to `/` via `tenantHostCanonicalPath`; building a `/tenant` index was rejected (duplicate of `/shops`, tenant-host leak). Remaining gap: `/shops` index is client-rendered — SSR HTML has no canonical and zero storefront anchors, yet it's advertised in `core.xml`. SSR the grid + self-canonical + `ItemList` JSON-LD before expecting it to index. |
| 2026-10-24 | Baseline recorded | Indexed **2** / Not indexed **13** = `Crawled – currently not indexed` 10 (pre-dates submission — content-quality watch item per §5), `Page with redirect` 2, `Duplicate without user-selected canonical` 1. Zero `Discovered`, `Alternate page`, `noindex` — all expected to move once the sitemap's 160 URLs process. Sitemap side: 160 locs (80 place, 2 directory, 32 products, 23 categories, 12 cities, 2 storefronts post-retirement, 3 core). |
| | Week 1 | |
| | Week 2 | |
| | Week 3 | |
| | Week 4 | |
