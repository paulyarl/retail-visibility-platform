# Market Surface Report — Spec

> Public report pages for **city** and **category** market surfaces,
> patterned after the seed report (`/seed-report/{seedId}`): enriched data,
> QR support, tracked redirects, short URLs. Hybrid access — the page is a
> free preview; the full brief + PDF stay behind the existing $29 unlock.
>
> Closes the loop on the "Full City Report" / "Full Category Report"
> sponsored creatives that today render `Unlock → (Coming soon)` on every
> market surface.
>
> **Build gate:** implement after a **complete PG market deploy (combo
> small + large)** — i.e., once at least one market has run every pipeline
> layer end-to-end, so the report renders real data on day one instead of
> a skeleton of omitted sections. "Complete" in data terms:

| Layer | Evidence the deploy is complete |
|---|---|
| L1 Enrichment | `directory_category_enrichment` rows: `__location__` for the market + several category keys |
| L2 Classification | Category coverage spans multiple shelves (enrichment rows across distinct `category_key`s) |
| L3 Benchmarks | Active `gold_standards` + `bronze_standard` profiles at the market scope (`mkt_intelligence_profiles`) |
| L4 Discovery | `intelligence_discovery` imports (emerging AND competitive) — `reason_coverage` fills + `competitive_weaknesses` present |
| L5 Verification | `business_analysis` audits on market seeds — at least one `business_audit` bronze slot |

> Small + large combo matters: the small market proves the thin-data
> honesty rules (§3.4/§3.6 — sections collapse cleanly), the large market
> proves the cameo/coverage density. Build can start any time after the
> combo lands; the spec's omitted-when-empty rules mean earlier
> deployment wouldn't break — it would just ship an empty product.

---

## 1. Overview

### 1.1 Problem

Every city and category surface advertises a downloadable market brief:

- `MarketIntelSurfaceSidebar` renders a **Full City Report** / **Full
  Category Report** card whose CTA never receives `ctaHref`, so it always
  shows "Unlock → (Coming soon)".
- `MarketIntelBanner` (the `300x600`/`300x250` house creative on
  `/place/city/*`, `/place/category/*`, `/directory/location/*`,
  `/directory/categories/*`) builds a tracked path only for
  `surfaceType === 'seed'`, so market surfaces render "Coming soon" even
  when `fullReport.available` is `true`.

The promise has no destination: there is no public report page, no public
preview endpoint, no QR, and no tracked link. The only thing that exists is
a paid PDF behind customer auth + Stripe — unreachable from the surface.

### 1.2 What already exists (reuse — do not rebuild)

| Piece | Role |
|---|---|
| `MarketIntelService.getCategoryFullContent` / `getCityFullContent` | Resolvers over `directory_category_enrichment` — the enriched data is already persisted and fetched. |
| `MarketIntelReportPdfService.generateCategoryReport` / `generateCityReport` | 5-section jsPDF briefs (§12.5 of the sidebar spec). |
| `market-intel-surface-customer.ts` | Mounted customer routes: `/full`, `/report.pdf`, `/unlock`, `/unlock/confirm` for both surfaces. |
| `MarketIntelAccessService` + `market_intel_unlocks` | Access tiers, admin bypass, paid-unlock records. |
| `MarketIntelPaywall` | Checkout modal — currently place-slug-only. |
| Seed-report machinery | `/seed-report/{seedId}` page, `seed-report-public.ts` preview endpoint, `seed-report-qr.ts` tracked redirect, `/r|rt|re|rs|rp` short-URL pages, `qr_scan_events` + `report_banner` surface. |

### 1.3 Design principles

- **The page is the product.** Like `/seed-report/{seedId}`, the report is
  a fast, mobile-readable public page — not a modal, not a bare PDF link.
- **Free preview, paid brief.** The public page renders a trimmed subset
  of the enrichment context with locked-item affordances (mirrors
  `PARTIAL_OPPORTUNITY_LIMIT`). The paid tier unlocks the **complete
  analyst-distilled context** — every enriched field rendered as readable
  report sections (§3.5), plus the PDF. The paid tier is preserved, not
  undercut.
- **Reports bundle their coverage.** A category report carries the cities
  that category is enriched in; a city report carries the categories
  enriched in that city plus its related coverage locations. Coverage is
  computed from the `directory_category_enrichment` key grid — no new
  data — and every covered market links to its own report page, turning
  each report into a cross-sell surface for adjacent reports.
- **Value scales with the platform.** Coverage IS the visible proof of
  value: today the grid is thin, so coverage sections render small or
  collapse entirely; as enrichment runs land, the same pages and PDFs
  grow without a code change. Nothing is fabricated to fill thin space.
- **Tracked, never direct.** The banner QR and CTA encode the tracked
  redirect — never the destination — so scans are attributable, per the
  `report_banner` precedent: a new surface outside the `report_delivery_*`
  prefix so banner scans never inflate delivered→scanned funnels.
- **The surface key is the identity.** No minted-code table — city and
  category slugs are already short, stable, human-readable URLs.

---

## 2. Routes & URLs

### 2.1 Report pages (web)

| Page | Path | Scope |
|---|---|---|
| City report | `/market-report/city/{citySlug}` | `citySlug` = `{city}-{state}` (same slug as `/place/city/*` and `/directory/location/*`) |
| Category report | `/market-report/category/{categorySlug}` | National view by default; `?city=&state=` selects the city-scoped brief |

A category page visited with `?city=Kansas City&state=MO` renders the
city-scoped brief; without params it renders the national (`__all__`)
brief — matching `MarketContextLoader`'s existing resolution.

### 2.2 Tracked redirects (API)

New route file `apps/api/src/routes/market-report-qr.ts`, mounted at
`/api/public` in `routeRegistry` (domain `directory`, `authLevel:
'public'`), mirroring `seed-report-qr.ts`:

```
GET /api/public/r/report/city/:citySlug/:channel
GET /api/public/r/report/category/:categorySlug/:channel?city&state
```

Each handler:

1. Validates `:channel` against `VALID_CHANNELS` (below).
2. Records a `qr_scan_events` row via `trackQrScanEvent` with
   `tenantId: 'platform'` (market surfaces have no tenant), the mapped
   surface, `consumer: 'merchant'`, `productId: surfaceKey`, referrer,
   user-agent, geo fields. The scan is recorded even when the surface key
   is malformed — the scan is the signal.
3. 302s to the report page (`${WEB_URL}/market-report/city/{citySlug}` or
   `/market-report/category/{categorySlug}?city&state` — query params
   ride through to the redirect destination).

No delivery write-back: there is no operator-delivered market report, so
nothing calls `recordViewFromScan` — the `DELIVERY_CHANNELS` concept does
not apply here.

### 2.3 Channels & QR surfaces

| `:channel` | `qr_scan_events.surface` | Use |
|---|---|---|
| `banner` | `market_report_banner` | QR served in the tall banner slot |
| `share` | `market_report_share` | Short link (`/mr/…`) shared/printed by anyone |

Both are **new** `QrSurfaceType` values with `SURFACE_LABELS` entries in
`QrAnalyticsService` ('Market Report Banner QR', 'Market Report Share
Link'). They sit outside `report_delivery_*`, preserving the seed
funnel's delivered→scanned rates.

### 2.4 Short URL (web)

```
/mr/{citySlug}                      → city report, channel 'share'
/mr/{categorySlug}                  → category report (national), 'share'
/mr/{categorySlug}?city&state       → category report (city-scoped), 'share'
```

Two `force-dynamic` Next.js routes under `apps/web/src/app/mr/`:

- `app/mr/[citySlug]/page.tsx` — but `/mr/{slug}` is ambiguous between a
  city slug and a category slug. Disambiguate by resolving **city first**:
  a `resolve+track` endpoint (§3.3) looks up the location enrichment row
  for `{city}-{state}` slugs; if it resolves, treat as city; otherwise
  treat as category. Cheaper alternative if ambiguity is undesirable:
  `/mr/c/{citySlug}` and `/mr/k/{categorySlug}` — decide at implement time;
  the spec defaults to the prefixed form for unambiguous URLs.
- Each page calls the resolve+track endpoint (one request records the
  `market_report_share` scan and returns the canonical report path), then
  `redirect()`s — the `resolveReportQrAndRedirect` pattern, no forked
  logic.

This satisfies "short URL" without a code-minting table: the slug IS the
short code. If vanity/campaign codes are ever wanted, a
`market_report_links` table (minted `short_code` per surface key, lazily
created) is the extension point — explicitly deferred.

---

## 3. API endpoints

### 3.1 Public report preview (new)

Add to `market-intel-surface-public.ts` (or a sibling
`market-report-public.ts` mounted at `/api/public/directory`):

```
GET /api/public/directory/city/:citySlug/market-intel/report-preview
GET /api/public/directory/category/:categorySlug/market-intel/report-preview?city&state
```

Returns a **preview-shaped subset** of `getCityFullContent` /
`getCategoryFullContent` — the public-safe trim, not the raw context:

**City preview:**

```ts
{
  surfaceType: 'city',
  city, state, citySlug,
  hasIntelligence: boolean,
  marketSummary: string | null,              // full — it is the hook
  cityProfile: { metro_description, major_industries, growth_trajectory } | null,
  marketGaps: MarketGap[],                   // first PREVIEW_GAP_LIMIT (3)
  marketGapsLockedCount: number,
  metroDynamics: MetroDynamic[],             // first 3
  metroDynamicsLockedCount: number,
  notableAreas: string[],                    // first 5
  coverage: CityCoverage,                    // §3.4 — bundled coverage index
  attribution: AttributionCameo,             // §3.6 — blind spots + leader weaknesses
  unlockPriceCents: number,                  // for the paywall CTA copy
}
```

**Category preview:**

```ts
{
  surfaceType: 'category',
  categorySlug, city, state,
  hasIntelligence: boolean,
  categorySummary: string | null,
  categorySignals: string[],                 // first 5
  categorySignalsLockedCount: number,
  categoryProfile: { business_model, customer_base, competitive_landscape } | null,
  marketDensity: string | null,
  prospectSignals: [],                       // always empty — prospect
                                           // signals are sales intel,
                                           // never public
  coverage: CategoryCoverage,                // §3.4 — bundled coverage index
  attribution: AttributionCameo,             // §3.6 — blind spots + leader weaknesses
  unlockPriceCents: number,
}
```

Rules:

- `404 { error: 'no_report' }` when `hasIntelligence` is false — same
  contract as the seed preview's `no_published_report`.
- `prospect_signals` is **excluded** from the public payload entirely
  (it stays in the paid `/full` response). Everything else is trimmed by
  count with `*LockedCount` companions so the page can render "N more —
  unlock the full brief."
- `Cache-Control: public, max-age=300`, same as the teaser endpoints.
- `unlockPriceCents` comes from the same `platform_settings_list` /
  `DEFAULT_UNLOCK_PRICE_CENTS` resolution the customer routes use, so the
  page's paywall copy can never drift from the real price.

### 3.2 Customer endpoints (existing — unchanged)

`/api/customer/directory/{city,category}/.../market-intel/{full,report.pdf,unlock,unlock/confirm}`
already enforce `canAccessFull`, admin bypass, Stripe PI, unlock +
revenue recording. The report page consumes them as-is.

### 3.3 Resolve + track (new)

```
GET /api/public/r/report-resolve?kind=city&key={citySlug}
GET /api/public/r/report-resolve?kind=category&key={categorySlug}&city&state
GET /api/public/r/report-resolve?kind=auto&key={slug}      (for /mr/ unprefixed, if used)
```

Records the `market_report_share` scan and returns
`{ success, path: '/market-report/city/kansas-city-mo' }` so the `/mr/`
page can `redirect()`. Returns `404` for unresolvable keys — the page
`notFound()`s. (If the prefixed `/mr/c/…`, `/mr/k/…` form is chosen,
`kind` is implicit and `auto` is unneeded.)

### 3.4 Coverage index — the bundle

Coverage is derived from the `directory_category_enrichment` **key grid**
— the rows themselves are the coverage map; no joins into listing data
and no new tables. Two lookups, both cacheable behind
`MarketContextLoader`'s 5-minute TTL (new cached methods on
`MarketIntelService` or the loader):

**Category report → covered cities** (`CategoryCoverage`):

```sql
SELECT city, state, context->'market_density' AS market_density
FROM directory_category_enrichment
WHERE category_key = :categorySlug
  AND city <> '__all__'
```

```ts
interface CategoryCoverage {
  coveredCityCount: number;
  cities: Array<{ city: string; state: string; citySlug: string;
                 marketDensity: string | null }>;   // teaser line per market
}
```

**City report → covered categories + coverage locations**
(`CityCoverage`):

```sql
-- Categories enriched in this city
SELECT category_key, context->'category_summary' AS category_summary
FROM directory_category_enrichment
WHERE LOWER(city) = LOWER(:city) AND LOWER(state) = LOWER(:state)
  AND category_key <> '__location__'

-- Other enriched cities (coverage locations) — every city with a
-- '__location__' row, minus self; optionally narrowed to same-state
-- or metro_dynamics cities first
SELECT city, state FROM directory_category_enrichment
WHERE category_key = '__location__' AND city <> '__all__'
```

```ts
interface CityCoverage {
  coveredCategoryCount: number;
  categories: Array<{ categoryKey: string; summaryExcerpt: string | null }>;
  coverageLocations: Array<{ city: string; state: string; citySlug: string }>;
}
```

Rules:

- Each coverage entry renders a link to **that market's own report
  page** (`/market-report/category/{cat}?city&state` or
  `/market-report/city/{slug}`) — the bundle cross-sells adjacent
  reports; each linked report keeps its own preview + unlock.
- Coverage entries carry at most a one-line teaser (density read /
  summary excerpt) — enough to be a real index, not enough to leak the
  paid brief.
- **Thin-data honesty:** empty coverage renders nothing (no section
  header, no placeholder). One covered city → the section still renders,
  honest about platform scale. Counts are always shown
  ("3 cities covered") so growth is visible.
- `coverageLocations` prefers metro-adjacent cities (`metro_dynamics`
  names matched against enriched cities) then same-state, then a flat
  enriched-city list — ordered by relevance, capped (e.g. 10).
- The **paid PDF** embeds the same coverage index as an appendix section
  (covered markets table) — the bundle is in the deliverable too, not
  just the page.

**Why coverage is first-class — the deploy multiplier.** The report mesh
is bipartite (categories ↔ cities) over the enrichment key grid. Every
enrichment run adds a cell, and each cell strengthens **two** existing
reports simultaneously: a new `category_key` row in a city adds an entry
to that city report's coverage card AND a covered market to that
category report. One complete market deploy of K categories therefore
ships K category reports + 1 city report + K cross-links — and the next
city deploying the same K categories upgrades all K category reports
for free. Marginal cost per report trends to zero; marginal value per
deploy compounds. Corollary: the **complete market deploy is the atomic
unit of value** — a half-deployed market produces dangling mesh edges
(reports whose coverage cards point at nothing), which is why §1's build
gate keys on completeness, not first-enrichment.

### 3.5 Full report content model — the analyst's distillation

The paid brief renders **every enriched field** the enrichment run
produced — the report is the analyst's distilled work product, not a
marketing summary of it. Field → section mapping (fields absent from a
given row simply skip their section — thin data stays honest):

**Category Market Brief:**

| Section | Source fields (`CategoryIntelligence`) |
|---|---|
| Category Summary | `category_summary` |
| Category Profile | `category_profile.*` (business_model, typical_products, customer_base, online_presence_pattern, competitive_landscape, typical_scale) |
| Benchmark Signals | `category_signals` (all) |
| Market Density | `market_density` |
| Keywords | `keywords` (all — SEO/discovery vocabulary) |
| Category Taxonomy | `super_categories`, `sub_categories`, `adjacent_categories`, `secondary_categories` |
| Analyst Notes | `category_notes` |
| Prospect Signals | `prospect_signals` (all — **paid only**, never in the preview payload) |
| Discovery Blind Spots | `AttributionCameo.blindSpots` (§3.6 — attributed `reason_coverage`) |
| Leader Weaknesses | `AttributionCameo.leaderWeaknesses` (§3.6 — `competitive_weaknesses` aggregate) |
| What Strong Looks Like | `AttributionCameo.goldBar` (§3.6 — resolved gold profile gates) |
| Coverage | `CategoryCoverage` (§3.4) |

**City Market Brief:**

| Section | Source fields (`LocationIntelligence`) |
|---|---|
| Market Summary | `market_summary` |
| City Profile | `city_profile.*` (metro_description, major_industries, growth_trajectory, demographic_character, market_character) |
| Market Gaps | `market_gaps` (all) |
| Metro Context & Dynamics | `metro_context`, `metro_dynamics` (all) |
| Notable Areas | `notable_areas` (all) |
| Category Landscape | `top_categories`, `secondary_categories` |
| Keywords | `keywords` (all) |
| Analyst Notes | `market_notes` |
| National Coverage | `national_coverage` (present on the `__all__` location row — measured states/cities/listings aggregates) |
| Discovery Blind Spots | `AttributionCameo.blindSpots` (§3.6 — market-aggregated `reason_coverage`) |
| Leader Weaknesses | `AttributionCameo.leaderWeaknesses` (§3.6 — `competitive_weaknesses` aggregate) |
| Benchmarks Established | `AttributionCameo.benchmarkedCategoryCount` (§3.6 — categories with active gold profiles) |
| Coverage | `CityCoverage` (§3.4) |

Implications:

- `getCategoryFullContent` / `getCityFullContent` already return the raw
  context objects — the full-report response needs **no new resolver**,
  only a typed view model so the page/PDF enumerate sections uniformly.
- The existing 5-section `generateCategoryReport` / `generateCityReport`
  PDF functions **expand to this model** — new sections slot between the
  current ones (Keywords + Taxonomy after Category Profile; Category
  Landscape + Keywords + Analyst Notes after Metro Dynamics; National
  Coverage before the coverage appendix).
- The free preview stays the §3.1 trim — narrative + counts + coverage.
  `prospect_signals` never appear in any public payload at any count.

### 3.6 Attribution cameo — what discovery actually found

Beyond the enrichment context, the reports carry a **cameo of the
attribution catalogs** — the observed, provenance-stamped record of what
discovery produced in this market. Discovery is dual-lane, and the cameo
renders both lanes:

| Lane | Candidate field | Catalog | Report framing |
|---|---|---|---|
| **Emerging** | `bronze_attribution: [{reason_key, basis}]` | `mkt_bronze_reason_catalog` | "How businesses stay hidden" — blind spots proven in this market |
| **Competitive** | `competitive_weaknesses: [{weakness_key, basis}]` | COMPETITIVE FOCUS weakness vocabulary | "Where leaders fall short" — named exposures observed on market leaders |

**Bronze cameo — source of truth is the profile, not the catalog.** The
catalog alone is a hypothetical hunt list; the cameo renders the resolved
bronze profile's `reason_coverage` — reasons that produced actual
attributed finds (slots stamped `emerging_scan` / `competitive_scan` /
`business_audit` / `operator_self_discovery` / `bronze_establishment_scan`),
each with status (`filled`, `empty_proven_elsewhere`, `empty_unproven`).
Labels/definitions come from the profile's `catalog_snapshot` (fallback:
live `mkt_bronze_reason_catalog` lookup by `reason_key`).

- **Category report** — `resolveBronzeStandard(categoryKey, null, city, state)`
  (city → state → national cascade) → render that profile's coverage.
- **City report** — aggregate `reason_coverage` across all **active**
  bronze profiles scoped to the market (`intelligence_focus =
  'bronze_standard'`, `reference_city`/`reference_state` match, plus the
  nationwide profile's coverage for context): group by `reason_key`,
  sum slot counts, keep the strongest status per key.

**Competitive weakness cameo** — aggregate `weakness_key` across the
market's prospects: `mkt_prospect_queue` rows carry
`business_snapshot.competitive_weaknesses` (the dual-lane merge already
dedupes by key and keeps the best basis). Group by `weakness_key` →
count + best basis line. Category report filters prospects by category;
city report by city/state.

**Gold cameo** — the bar that gives the weaknesses meaning:
`resolveGoldStandard(categoryKey, null, city, state)` → the profile's
`expected_fields.universal.quality_gates` renders as a short "what
strong looks like" reference list (non_negotiable gates first). On the
city report, where no single category owns the benchmark, the cameo
instead lists which covered categories have an active gold profile —
"benchmarks established for N categories" — linking to their category
reports.

```ts
interface AttributionCameo {
  blindSpots: Array<{ reasonKey: string; label: string;
                     filledCount: number; status: string;
                     scope: string }>;             // formatBronzeReasonScope
  leaderWeaknesses: Array<{ weaknessKey: string; count: number;
                           basis: string | null }>;
  goldBar: Array<{ field: string; severity: string }> | null;
  benchmarkedCategoryCount: number | null;         // city report only
}
```

Rules:

- **Cameo ≠ dump.** Public payloads cap each lane at the top N entries
  (5, ordered by filledCount/count then priority); the paid `/full`
  response carries the complete attributed record including per-slot
  `basis`/`discovered_via` lines and exemplar business names — the
  observed instances ARE the product a buyer pays for.
- **The cameo is the teaser's hook.** Preview copy frames the
  attribution as platform-exclusive intelligence — findings produced by
  real scans, available nowhere else. The preview teases a few named
  entries ("3 businesses surfaced only through trade-manifest records;
  leaders here most often fail review response") so the consumer sees
  the intelligence is real and specific; the full record — every
  attributed business, every basis line — is what the unlock buys.
  Preview copy guidance: name the *mechanism* and the *count*, withhold
  the *who*.
- **Internal vocabulary stays internal.** Never render `signals`,
  `expected_vectors`, `empty_slot_note`, or scan mechanics — those are
  operator hunting language. Labels + definitions + counts only.
- **Empty → omitted.** No bronze profile at scope, no competitive
  candidates, no gold profile → the lane's section doesn't render (same
  thin-data honesty as coverage).
- `basis` lines are analyst prose shown verbatim — they already passed
  the import schema's one-line constraint; they never contain scan
  internals by construction.

### 3.7 Methodology explainer — the intelligence stack

The report ends with a plain-language explainer of the pipeline that
produced it — the consumer can see the data is the output of a method,
not a scrape.

**The primitives** — four nouns the whole system is built from, explained
once up front:

| Primitive | Consumer-facing explanation |
|---|---|
| **The seed** | Every business enters as a seed — a presence listing assembled from public sources, with its own page and free report. The seed is the subject everything else studies. |
| **The Proving Ground (PG)** | The research pipeline that works the seeds: enrichment runs, scans, and audits all execute inside the PG — nothing in this report is hand-entered. |
| **The scopes** | Every piece of intelligence is bounded — by category, by market (city/state/national), by platform. A finding scoped to Kansas City is never reported as a national truth. |
| **The profiles** | Scans produce durable intelligence profiles — the gold bar, the bronze blind-spot coverage, the category intelligence profile — that later stages read and audits verify against. |

**The stack** — the pipeline itself frames as **five layers**, each
building on the one below; the report's own sections map onto the same
layers, so the explainer doubles as a map of the report. One shared copy
block renders on both surfaces (and a compact version in the PDF):

| Layer | Contains | Consumer-facing explanation |
|---|---|---|
| **L1 — Market foundation** | Enrichment (category + location intelligence) | Analysts research each category and market and distill structured intelligence — profiles, signals, gaps — the base everything else reads. |
| **L2 — Classification** | Category identification | Every seed lands on the shelf its assortment evidence supports — not the label a platform happened to give it. |
| **L3 — Benchmarks** | Gold standard + bronze standard | Per category scope: a gold bar built from the strongest independent businesses ("what strong looks like"), and a bronze map of the discovery blind spots that hide real operators from search. |
| **L4 — Discovery** | Emerging + competitive focus scans | Emerging scans hunt the blind spots — real businesses invisible to normal discovery, attributed to the reason that surfaced them. Competitive scans evaluate leaders against the gold bar and document their named exposures. |
| **L5 — Verification** | Business audit | Individual seeds are audited against the gold gates — signal checklists and gap analyses that confirm the market-level findings on the ground. |

Report-section → layer mapping (the explainer links each to where its
output appears):

| Layer | Where it shows up in the report |
|---|---|
| L1 | Enrichment sections (§3.5), coverage index (§3.4) |
| L2 | Category Landscape section, coverage categories |
| L3 | "What strong looks like" gold cameo + "How businesses stay hidden" blind-spot framing (§3.6) |
| L4 | Attribution cameo — blind spots filled (emerging) + leader weaknesses (competitive) (§3.6) |
| L5 | Verified exemplars — `business_audit` slots inside the cameo; audit-driven signal evidence |

Rules:

- **Static copy, versioned in code** (`lib/report-methodology.ts`) — it
  describes the platform, not the market, so it needs no resolver. If the
  copy later needs operator editing it can move to
  `platform_settings_list`.
- Renders on **every tier** — the layered model is the trust argument
  for the free preview AND the provenance appendix of the paid brief.
- **Visual:** a stacked-layer diagram on the page (five labeled bands,
  L1 at the base — plain divs, no image asset), an ordered text list in
  the PDF.
- Explainer entries name the layer and give one honest sentence — no
  internal vocabulary (`mkt_*` tables, scan contract, lint, draft
  versions), no invented metrics. Where a layer produced nothing for
  this market (no bronze profile → no blind spots), the explainer still
  describes the layer — it explains the method, not the outcome; the
  §3.6 cameo carries the outcome.
- The PDF gets the same explainer as a final "Methodology" appendix —
  the deliverable self-documents when it's forwarded.

### 3.8 Freshness & reruns — the PG cockpit is the only entry

The report is a **live projection** of persisted intelligence — it has
no regenerate button, no version table, no snapshot. A "rerun" means
re-executing the pipeline stage that produced the data, and every rerun
path starts in the PG cockpit (or its sibling, the coverage grid) —
never on the report itself.

**The rerun chain (all existing machinery):**

```
PG cockpit / coverage grid
  → attached child campaign (directory_enrichment | intelligence_discovery
    | business_analysis — attached under the PG via the attach guard)
  → campaign resolves to an execution
  → analyst handles it (internal executeSingle, or external export →
    paste JSON → importExternalResult → execution + audit + post-import
    hooks)
  → data lands: enrichment apply is upsert-in-place, bronze fills write a
    new draft profile version, audits append
  → report reflects the new state on next read (5-min resolver TTL —
    nothing to invalidate)
```

**Layer → rerun surface:**

| Report content | Refreshed by | Cockpit/coverage entry |
|---|---|---|
| Enrichment sections (§3.5) + coverage (§3.4) | `directory_enrichment` child campaign (category or location lane) | Green filled `EnrichmentPair` chip → rendered packet; `inflight` chip → the running campaign; cockpit `#enrich` "Category/Location enrichment campaign" buttons (create-or-attach) |
| Attribution cameo (§3.6) | `intelligence_discovery` import (emerging → bronze fills; competitive → weakness aggregate) | Attached intelligence child campaigns on the PG |
| Gold bar cameo | Gold establishment/discovery scans | Profile-slot chips (missing → create; active → profile) |
| Verification cameo | `business_analysis` audits on market seeds | PG worklist / prospect queue → audit campaigns |

**Provenance on the report.** The coverage chips already carry
`enriched_at` + `trigger_source`; the report page surfaces the same —
"Intelligence as of {latest enriched_at}" in the header — so a consumer
can tell a fresh brief from a stale one, and an operator can see when a
rerun is due. (When the enrichment row has no `source_campaign_id` —
non-campaign triggers like `enrichNational` — show the date without a
campaign link, same as the chip tooltip's 'no source campaign recorded'.)

**Operator deep link (admin-tier only).** When the viewer resolves as
platform admin, the report header renders "Open in cockpit" →
`/settings/admin/marketing-ops/proving-grounds/{pgId}#enrich` (or the
coverage grid when no PG is resolvable) — the loop report → rerun
surface closes without exposing operator URLs to the public.

---

## 4. Web implementation

### 4.1 Report pages

```
apps/web/src/app/market-report/city/[citySlug]/page.tsx          (server)
apps/web/src/app/market-report/city/[citySlug]/CityReportClient.tsx
apps/web/src/app/market-report/category/[categorySlug]/page.tsx  (server)
apps/web/src/app/market-report/category/[categorySlug]/CategoryReportClient.tsx
```

Pattern after `SeedReportClient` but **server-fetch the preview** in
`page.tsx` and pass it as `initialReport` so the content lands in SSR
HTML (the place-index hero lesson: client-only fetches render nothing for
crawlers). `generateMetadata` sets the title (`Kansas City, MO — City
Market Brief`). The client component re-fetches only if the server read
returned null.

Layout (mirrors the seed report's card-per-section, Tailwind — no
Mantine dependency needed; the `/seed-report` page uses Mantine but the
place surface components are plain Tailwind — match the place surface):

- Header: "City Market Brief" eyebrow + `{city}, {state}` H1 +
  generated-date.
- Status row: "Free preview — {n} sections locked" badge.
- Cards: Market Summary / City Profile / Market Gaps (top 3 + "N more —
  unlock") / Metro Dynamics / Notable Areas.
- **Attribution cameo cards** (§3.6): "How businesses stay hidden"
  (attributed blind spots + counts) and "Where leaders fall short"
  (weakness aggregate) — the discovery proof, rendered only when a
  profile/aggregate exists.
- **Coverage card** (§3.4): "Covered categories in {city}" linking to
  each category report, and "Other covered markets" linking to other
  city reports — renders only when coverage exists.
- Unlock CTA card → opens the paywall (§4.3).
- Post-unlock: page swaps preview for `GET …/full`, renders the full
  §3.5 section model (keywords, taxonomy, analyst notes, landscape —
  every enriched field, untrimmed), and reveals the **Download PDF**
  button (`…/report.pdf` with `a.download`, same as the place sidebar).
- **Methodology explainer** (§3.7): "How this intelligence is produced"
  — the seven-stage pipeline, rendered on every tier.
- "Add Your Business" footer CTA → `/directory/add-business` — the
  lead-gen conversion, analogous to the seed report's claim CTA.
- `no_report` → the same "Report not available" empty state the seed
  page uses.

Category variant: Category Summary / Benchmark Signals / Category
Profile / Market Density + **"What strong looks like" gold cameo** +
attribution cameo cards + **"Covered markets" card** (each city linking
to its city-scoped category report) + same unlock + footer CTAs.

### 4.2 Services

- `MarketIntelSurfaceService` (public singleton) gains
  `getCityReportPreview(citySlug)` and
  `getCategoryReportPreview(categorySlug, city, state)`.
- New `MarketIntelSurfaceCustomerService` (mirrors
  `MarketIntelCustomerService`, `ttl: 0`, bearer-token aware):
  `getCityFull(citySlug)`, `getCategoryFull(slug, city, state)`,
  `createCityUnlock`, `createCategoryUnlock`, `confirmUnlock`,
  `getReportPdfUrl` — one method pair per surface, no place routes
  touched.
- New `MarketReportScanService` or reuse pattern from
  `ReportQrScanService` for the `/mr/` resolve+track call.

### 4.3 Paywall

Generalize `MarketIntelPaywall` to take a surface descriptor:

```ts
type PaywallSurface =
  | { kind: 'place'; slug: string }
  | { kind: 'category'; categorySlug: string; city: string; state: string | null }
  | { kind: 'city'; citySlug: string };
```

It delegates to the correct service (existing customer service for
place, the new surface customer service otherwise) and parameterizes the
copy ("this business" → "Kansas City, MO" / "this category"). The Stripe
Elements step remains stubbed exactly as it is today — out of scope.

### 4.4 Banner + sidebar wiring

**`MarketIntelBanner`:**

- `marketReportTrackedPath(surfaceType, key, city?, state?)` —
  sibling to `bannerReportTrackedPath`, returning
  `/api/public/r/report/city/{citySlug}/banner` and
  `/api/public/r/report/category/{categorySlug}/banner?city&state`.
- `trackedPath` resolves for `city`/`category` surfaces when
  `report.available` — the tall variant then renders the report QR
  (`generateQrDataUrl`, `styled: true`), ending the seed-only QR rule
  (`DIRECTORY_REPORT_BANNER_SPEC` §6 — this pass un-defers it for market
  surfaces only; `directory` surfaces still get no QR).
- CTA verb: `Unlock →` is no longer honest — the immediate action is a
  free page. Market surfaces use `See the report →` (same as seed). The
  paid ask happens on the report page.
- `available && !trackedPath` (e.g. `directory` surface) keeps the
  existing non-linked rendering.

**`MarketIntelSurfaceSidebar`:** the full-report card gets
`ctaHref={reportPath}` when `fullReport.available`, where `reportPath`
is the canonical `/market-report/...` page (the card is a normal link —
QR carries the tracked variant). `ctaLabel="See the report →"`. When
`!available` it keeps "Coming soon" — correct, since there is no
enrichment to report on.

### 4.5 Where it lands

| Surface | Banner tall slot | Sidebar report card | Report page target |
|---|---|---|---|
| `/place/city/[citySlug]` | ✅ QR + tracked CTA | ✅ | `/market-report/city/{citySlug}` |
| `/place/category/[categorySlug]` | ✅ QR + tracked CTA | ✅ | `/market-report/category/{slug}?city&state` |
| `/directory/location/[location]` | ✅ QR + tracked CTA | ✅ | `/market-report/city/{citySlug}` |
| `/directory/categories/[categorySlug]` | ✅ QR + tracked CTA | ✅ | `/market-report/category/{slug}` (national) |
| `/directory` index / stores / store-type | ❌ (no per-surface report) | n/a | stays "Coming soon" — the aggregate-CTA open question stands |

---

## 5. Access model (hybrid)

| Tier | Sees |
|---|---|
| Anonymous | Public report page — trimmed preview + locked counts |
| Logged-in, no unlock | Same preview + "Unlock for $29" → Stripe flow |
| Paid (`market_intel_unlocks` row for the surface key) | Full content + PDF download |
| Platform admin | Full content + PDF (existing `isPlatformAdmin` bypass) |

Surface keys are unchanged: `city → "{city}:{state}"`,
`category → "{categorySlug}:{city}:{state|'__all__'}"`. A national
category unlock does not grant city-scoped category briefs — same
keying as the existing backend, no migration needed.

**Bundle pricing:** the coverage index (market list + one-line teasers +
links) is free on every tier — it is navigation and proof-of-scale, not
content. Each linked report has its own unlock; a city report's paid PDF
embeds its coverage appendix, but does not include the covered
categories' full briefs. This keeps per-surface pricing coherent and
makes every report an acquisition surface for adjacent reports.

---

## 6. Edge cases

- **No enrichment** (`hasIntelligence: false`): teaser already returns
  `fullReport.available: false` → card/banner keep "Coming soon"; the
  preview endpoint 404s; the page renders the empty state. No dead ends.
- **Category with `city=__all__`**: renders the national brief; the
  surface key for unlock is `{slug}:__all__:__all__` — already what the
  customer routes compute.
- **Malformed slug**: `parseCitySlug` returns null → preview/resolve
  endpoints 400/404; `/mr/` page `notFound()`s; banner never builds a
  path from unparseable keys.
- **Scan on a bad key**: recorded anyway with `tenantId: 'platform'` —
  warm-lead analytics, same as seed.
- **Paywall `tenant_required`**: existing modal copy handles it.

---

## 7. Analytics

- `qr_scan_events` gains `market_report_banner` + `market_report_share`
  surfaces → flows into existing `qr_analytics` rollup + QR dashboard
  labels, no pipeline changes.
- No new funnel stages — market reports have no delivered→viewed
  lifecycle (nothing is operator-delivered).
- Unlock revenue already lands in `marketing_revenue` via the existing
  confirm routes (`source: 'market_intel_unlock'`).

---

## 8. File checklist

**API (new):**
- `apps/api/src/routes/market-report-qr.ts` — tracked redirects + resolve/track
- `apps/api/src/services/__tests__/market-report-preview.test.ts` — preview trim logic
- `apps/api/src/tests/market-report-routes.test.ts` — redirect/scan/404 coverage

**API (modified):**
- `market-intel-surface-public.ts` — two `report-preview` endpoints
- `MarketIntelService.ts` — `getCityReportPreview` / `getCategoryReportPreview` (trim + locked counts)
- `MarketIntelService.ts` (or a `MarketAttributionService`) — cameo resolvers: `resolveBronzeStandard`/`resolveGoldStandard` reads + `mkt_prospect_queue` weakness aggregation (§3.6)
- `MarketIntelReportPdfService.ts` — expand both briefs to the §3.5/§3.6 content model + coverage appendix
- `MarketContextLoader.ts` (or `MarketIntelService`) — cached coverage-index queries (§3.4)
- `QrAnalyticsService.ts` — two `QrSurfaceType` values + labels
- `routeRegistry.ts` — mount `market-report-qr.ts`

**Web (new):**
- `app/market-report/city/[citySlug]/{page.tsx,CityReportClient.tsx}`
- `app/market-report/category/[categorySlug]/{page.tsx,CategoryReportClient.tsx}`
- `app/mr/...` short-link routes
- `lib/report-methodology.ts` — shared explainer copy (§3.7)
- `services/MarketIntelSurfaceCustomerService.ts`
- Report-page + preview `.test.ts` files (SSR render pattern per AGENTS.md)

**Web (modified):**
- `MarketIntelBanner.tsx` — tracked path + QR for city/category, "See the report →"
- `MarketIntelSurfaceSidebar.tsx` — `ctaHref` on the report card
- `MarketIntelPaywall.tsx` — surface-descriptor props
- `MarketIntelSurfaceService.ts` — preview fetchers

**DB:** no migration — surface keys are the identity; unlocks reuse
`market_intel_unlocks`.

---

## 9. Acceptance criteria

1. City page banner + sidebar CTA resolve to `/market-report/city/{slug}`
   when the city has enrichment; "Coming soon" otherwise.
2. Same for category pages (national + city-scoped variants).
3. Tall banner on market surfaces renders a working QR; scanning records
   `market_report_banner` and lands on the report page.
4. `/mr/{slug}` short links record `market_report_share` and land on the
   report page.
5. Anonymous visitors see the trimmed preview with locked counts; the
   raw enrichment JSON is never served publicly (no `prospect_signals`).
6. Unlock on the report page completes the existing Stripe flow and
   reveals full content + `report.pdf` download; admin sees full without
   payment.
7. `pnpm checkapi`, `pnpm checkweb`, `npx vitest run` green; new API
   route tests pass.

## 10. Open questions

- **`/mr/` shape** — unprefixed with city-first resolution vs. prefixed
  `/mr/c/` + `/mr/k/` (spec defaults to prefixed; decide at implement
  time).
- **Thin-data launch posture** — coverage is currently thin, so the paid
  tier's value proposition is thin with it. Options: ship the paywall
  anyway (coverage counts make the thinness visible and the CTA grows
  with scale), launch free-only and add the unlock when a coverage
  threshold is met (e.g. N enriched cities), or keep the unlock but
  suppress the CTA copy when `hasIntelligence` covers < N markets. Spec
  default: ship the paywall — honest coverage counts sell scale better
  than a hidden gate.
- **Aggregate (`directory`) surface CTA** — still needs a general intel
  landing or stays "Coming soon" (unchanged from the banner spec).
- **Free teaser PDF** — offer a preview-grade PDF download on the free
  page? Deferred; the page itself is the free artifact.
- **Per-city category report pricing** — one $29 unlock per surface key
  means a user pays separately for `indian-grocery:__all__:__all__` and
  `indian-grocery:Kansas City:MO`. Intended (matches existing keying) but
  worth a product decision before this ships.

---

## Appendix A — Operator SOP: refreshing a market report

No expertise required. A rerun is always: open the proving ground → open
the attached campaign → hand the execution to an analyst → verify the
report date moved. Estimated effort: minutes of operator time per step;
the analyst leg is the only real work.

### A.1 Refresh a city or category report's data

1. Open the report page (`/market-report/city/...` or
   `/market-report/category/...`). Note the **"Intelligence as of"**
   date in the header — that is what you are moving forward.
2. Go to the proving ground for that market:
   `/settings/admin/marketing-ops/proving-grounds` → open the PG for the
   city (or find it via `/settings/admin/marketing-ops/coverage`).
3. In the cockpit, find the **Market enrichment** strip (`#enrich`).
   - If the enrichment campaign already exists, open it — the coverage
     grid's **green chip** for that (category, market) also resolves to
     the same campaign/packet.
   - If it does not exist yet, click **Category enrichment campaign**
     (category data) or **Location enrichment campaign** (city data) —
     it creates the campaign attached under this PG.
4. On the campaign, resolve to its **execution** and hand it to the
   analyst — either run it internally, or export the prompt for the
   external agent and paste the JSON result back (import).
5. Done. The enrichment row updates in place; the report reflects it
   within ~5 minutes. Reload the report and confirm the "Intelligence
   as of" date moved.

### A.2 Refresh the discovery findings (blind spots / leader weaknesses)

1. Same PG cockpit → open the attached **intelligence discovery**
   campaign (emerging or competitive focus).
2. Resolve to a new execution → analyst runs it → import the result.
3. The cameo updates: new attributed fills appear as a new draft profile
   version (bronze) or new weakness counts on the report.

### A.3 Refresh a business verification

1. PG cockpit → worklist / prospect queue → open the business's audit
   campaign.
2. New execution → analyst → import. Verified exemplars gain
   `business_audit` provenance in the cameo.

### A.4 If a report shows "Report not available"

The market has no enrichment yet — there is nothing to rerun. Run the
deploy sequence first (the §1 build-gate table lists what "complete"
looks like); the report appears automatically once the first enrichment
row lands.
