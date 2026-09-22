# National Layer & Surface Closure — Sprint Plan

> Status: **sprint complete — Phase A landed; Phase B landed (national establishment); Phase C landed (national category grounding + NATIONAL SURFACE FRAMING); Phase D landed (national location enrichment, coverage grid, phantom-write guard); Phase E landed (/place/city packet render + metadata + nav; slug ambiguity resolved via modal-state); Phase F landed (national roster endpoint + /place national panel + category excerpts on /place and /directory/categories); Phase G landed (national discovery end-to-end + market-scoped gold/bronze + national enrichment form affordance); Phase H landed (ghost-gap sweep — national-as-superset on all city-aware admin surfaces). /directory home parity deferred — see Phase F.**
> Context doc pairs with: `DIRECTORY_ENRICHMENT_CAMPAIGNS_SPRINT_PLAN.md`,
> `CATEGORY_MARKET_ENRICHMENT_SPEC.md`, `BRONZE_STANDARD_SPRINT_PLAN.md`

## Goal

The intelligence profile flow for every market deployment is:

```
establishment (competitive + emerging) → market enrichment (category + location)
                                       → discovery (competitive + emerging)
                                       → seed / business audits (consume enrichment context)
```

Two systemic gaps remain after the fact-layer consumption fix:

1. **The national layer is missing.** Establishment requires a city, so no
   `reference_city: null` competitive/emerging profile can exist — yet the resolver's
   fallback chain already treats `reference_city: null` as the national slot, and the
   signal-weight model (`SignalWeightScope: 'local' | 'regional' | 'national'` +
   `LOCAL_PRECEDENCE_CONFIDENCE`) was designed for national/local layering. National
   `__all__` category enrichment therefore has no fact source, and markets without a
   city establishment have no vocabulary floor.

2. **Enrichment output has unread / unreachable surfaces.** The `/place/city/[slug]`
   page is a ghost (no inbound links, no packet render, no packet metadata), and the
   `/place` + `/directory` homes render static boilerplate — there is no national
   narrative panel and no `('__location__','__all__','__all__')` row to feed it.

## Phase A — landed (context, not sprint work)

Category intelligence injection into the campaign lane + location geography injection.
For reference — this is the fact-layer consumption these phases extend:

| Change | Where |
|---|---|
| `=== ESTABLISHED CATEGORY INTELLIGENCE ===` block injected into category enrichment prompts; resolves `competitive` → `emerging`, city-scoped, skips `__location__` / `__all__` / category-set | `MarketingExecutionService.resolvePrompt` (~line 1490) + `formatCategoryIntelligenceBlock` |
| `applyEnrichmentPacket` resolves the real profile, stamps `intelligence_profile_id`, fans out listings with field-merged profile vocabulary | `CategoryMarketEnrichmentService.ts` (~lines 292, 335, 382) |
| `=== MARKET GEOGRAPHY GRID ===` block injected into location enrichment prompts from `mkt_geography_grids` | `MarketingExecutionService.resolvePrompt` (~line 1489) + `formatMarketGeographyBlock` |

Tests: `ResolvePrompt.test.ts` (+9), `directoryEnrichment.apply.category.test.ts` (+2). 61 pass, `checkapi` clean.

## Approved design decisions

| Decision | Resolution |
|---|---|
| National campaign marker | **`city='__all__'` (and `state='__all__'`) on the campaign.** Non-empty strings pass every existing refine (`campaignCreateSchema` city/state-required, update-schema state-required) with zero schema changes; the sentinel is explicit intent (an empty city is indistinguishable from operator error) and matches the `directory_category_enrichment` national convention. |
| Profile sentinel mapping | **`__all__` → `NULL` at the import seam only.** `normalizeReferenceCity('__all__')` → `'__All__'` (title-case passthrough) — a literal slot the `reference_city: null` fallback never reads. The campaign keeps `__all__`; `referenceCity`/`referenceState` map to `null` where campaign fields flow into `importAsDraft` (`MarketingPromptService.ts` ~line 949). Do NOT patch `normalizeReferenceCity` itself — it must stay a pure formatter. |
| National slot semantics | `reference_city: null, reference_state: null` IS the national slot — the same convention national gold standards and national bronze establishment already use. The resolver's city-agnostic fallback (`IntelligenceProfileService.ts` ~line 820) then makes a national profile the vocabulary floor for every market without a city establishment — including Phase A's new injection path, which inherits the fallback for free. |
| National establishment template | A **variant** of the establishment prompt, not a rewrite — the §10 fields are mostly city-agnostic (terminology, synonyms, subcategories, category_taxonomy_queries, specialized_sources, generic_label_set, category_evidence_rules, prohibited_inferences). Dropped/changed for national: `geography_grid` (the directive already returns `''` for no-city campaigns), `platform_signal_weights` emit at the `national` scope (the layering model already expects it), no "derive from what you observed in {{city}}" phrasing. |
| National location enrichment | Same packet shape, one level up — `metro_dynamics` → state-level dynamics, `area_breakdown` → states/regions + strong categories, `market_gaps` → uncovered regions, `notable_areas` → covered metros, `city_profile` → national platform profile. Row key: `('__location__', '__all__', '__all__')`. |
| National location fact layer | **Coverage aggregates, not a profile.** "Which markets we cover" is queryable truth: distinct `(city, state)` across `directory_category_enrichment`, `directory_listings_list`, `mkt_geography_grids` — injected as a deterministic `=== NATIONAL COVERAGE GRID ===` block (covered-market roster + per-state category counts). The AI composes prose over aggregates it cannot contradict. |
| Home narrative scope | **Dual-axis: location + category.** The homes render the national location packet (coverage) AND the national `__all__` category packets (per-category descriptions on the browse cards) — not just a geographic intro. Requires a batch roster endpoint; per-category fetches don't scale to the home grid. |
| National public-narrative framing | **Explicit render-time directive on both enrichment lanes.** When the campaign signals national (`city='__all__'`; `category='__location__'` for the location lane, real category key for the category lane), inject a `=== NATIONAL SURFACE FRAMING ===` block telling the model the packet is the national public page — copy must be market-agnostic (no single-city claims, corridors, or catchment), frame the category/location narrative nationally (states, metros, coverage, vocabulary), and produce shopper-facing national copy. Same deterministic injection pattern as the intelligence/geography blocks — no seed re-run needed. |
| `/place/city` disposition | **NOT a duplicate — it's the seed shelf.** The `/place/city` API (`directory-presence-public.ts:1129-1151`) filters `listing_origin='directory_seed'` (presence-seed listings only); `/directory/location` renders all published listings (tenants + seeds). Different populations, both legitimately exist. The gap is wiring, not canonicality — and it's already in the sitemap (`directory-presence-public.ts:1357`, priority 0.8), so the orphan page is indexable NOW: unlinked, thin metadata, no packet render. Fix = wire nav + enrichment + packet metadata, same render sections as `location/[location]`. |

## Gap inventory (with evidence)

### G1 — National establishment blocked at validation + import

- `campaignCreateSchema` requires non-empty city+state for `scope='intelligence'` except `gold_standards` and national bronze establishment — `marketing-ops.ts:342-359`. `city='__all__'` already passes; the remaining work is semantic, not validation.
- §10 import hook reads campaign city straight through: `referenceCity = campaign?.city || null` (`MarketingPromptService.ts:949`). Needs the sentinel→NULL map.
- Geography-grid upsert on profile import (`MarketingPromptService.ts:974-987`) must skip the sentinel or it writes a `'__all__|__ALL__|'` cache row.
- **Sweep finding — grid directive leaks:** `buildGeographyGridDirective` treats `city='__all__'` as a real market — `campaignCity` is truthy, so it emits `Market: __all__, __ALL__` + full DERIVE instructions into the establishment prompt (`geography-grid.ts:113-156`). Needs a sentinel guard (`__all__` → `''`), or the national template carries a bogus grid section.
- `campaignUpdateSchema` state-required refine (`marketing-ops.ts:401`) — `state='__all__'` passes as-is.
- Frontend: establishment form's required city field needs a "National (all markets)" affordance.

### G2 — `__all__` category enrichment has no grounding source

- The enrichment injection gate skips `__all__` explicitly (`MarketingExecutionService.ts` ~line 1491: `campaignCity.trim().toLowerCase() !== '__all__'`).
- `applyEnrichmentPacket` forces `intelProfile = null` for national (`CategoryMarketEnrichmentService.ts` ~line 292).
- Once G1 lands, `resolve(category, focus, null, null)` hits the national slot directly — wire injection + apply the same way, minus the city-bound fields (no corridors/catchment for a national page; synonyms/subcategories/terminology/label sets all apply).

### G3 — National location enrichment doesn't exist

- `LocationMarketEnrichmentService.applyEnrichmentPacket` has no `isNational` path: `normalizeReferenceCity('__all__')` → `'__All__'`, `normalizeReferenceState('__all__')` → `'__ALL__'`, and the aggregate fallback queries listings for a nonexistent city (lines 268-319).
- Needs: literal `('__location__','__all__','__all__')` row write (sentinel bypass like the category lane), national coverage aggregates replacing the city aggregate fallback, and the `=== NATIONAL COVERAGE GRID ===` prompt injection for `__location__` + `__all__` campaigns.
- **Sweep finding — template variant needed:** the seeded `mpt-location-enrichment-default` directive is city-scoped copywriting ("produce a packet for this city"). A `__all__` location campaign renders `CITY: __all__ STATE: __all__` — needs a national directive body (coverage narrative, not city-SEO). Same variant need as establishment.
- **Sweep finding — on-demand phantom write:** `getLocation` enriches on miss (`LocationMarketEnrichmentService.ts:110` → `enrichLocation` `'on_demand'`). A public `city=__all__` request before the national row exists writes a phantom `('__location__','__All__','__ALL__')` row with empty aggregates. `getLocation` needs an `isNational` bypass: literal sentinel lookup, null on miss, NEVER on-demand enrich for sentinels. (`getMarket` in the category service already implements exactly this pattern — `CategoryMarketEnrichmentService.ts:438-473` — use it as the reference.)
- `loadLocationContext` early-returns empty for `__all__` (`MarketContextLoader.ts:212-214`) — verify whether any consumer should read the national row (category `__all__` enrichment is the candidate — note `fetchCityProfile('__all__','__all__')` would already find the national row via its `LOWER(city)=LOWER(?)` match once it exists).

### G4 — `/place/city/[slug]` is an orphaned seed shelf (indexable today)

- **Distinct population, not a duplicate:** its API returns only `listing_origin='directory_seed'` listings (`directory-presence-public.ts:1131-1151`); `/directory/location` renders all listings. Both pages are legitimate — different listing sets for different audiences.
- **Already in the sitemap:** `directory-presence-public.ts:1357` emits `/place/city/{slug}` at priority 0.8 — crawlers reach it today despite zero inbound links.
- **Navigation:** `/place` index city chips are inert `<span>` (`PlacesIndexClient.tsx:151-169`); `/place/category` city chips self-filter (`PlaceCategoryClient.tsx:211-213`); only inbound reference is an admin seed-link (`presence-seeds/[id]/page.tsx:876`). Meanwhile `/place/[slug]` entry headers proxy city browsing to `/directory/location/{slug}` (`PlaceEntryEditorialLayout.tsx:152`) — the seed shelf gets no share of it.
- **Enrichment:** `page.tsx` never calls `getLocationEnrichment`; `PlaceCityClient` renders no `bodyCopy`/`metroContext`/`areaBreakdown`/`topCategories`/`faq`. The seed shelf is arguably the most correct home for the "listings sourced from public information" narrative — that IS the seed population — but nothing renders it.
- **Metadata:** hardcoded `Places in {city} — Directory` (`page.tsx:6-12`).
- **Sweep finding — state unavailable at render:** `getLocationEnrichment(city, state)` needs state, but `CityResponse` has no top-level `state` field (client flatMaps it from listings — `PlaceCityClient.tsx:127`). Either add `state` to the `/places/city/:citySlug` response (rows already carry `seed_state`) or fetch enrichment client-side post-load.
- **Sweep finding — slug ambiguity:** `/place/city` slugs are city-only (`indianapolis`), while `/directory/location` uses `{city}-{state}` (`indianapolis-in`). Same-name cities across states collide ('springfield' in IL/MO/MA) — the API's `LOWER(dps.city)` match can't disambiguate, and the sitemap emits the ambiguous form. Decide whether Phase E migrates the slug to `{city}-{state}` or accepts collisions.

### G5 — No national narrative on the homes (two axes: location + category)

- `/place` (`PlacesIndexClient`) and `/directory` (`DirectoryClient`, `AllCategoriesClient`) consume zero enrichment — verified by grep: only `CategoryViewClient` (a leaf page) fetches a packet.
- **The home is the top of TWO axes, not one.** Geographic coverage (`('__location__','__all__','__all__')` national location packet — Phase D) AND category awareness (the `(category,'__all__','__all__')` national category packets — Phase C). Today the `/place` index renders category cards with only `{name, placeCount}` + city chips — no descriptive content. With national category packets each card can carry the national `effective.description` / `category_overview` excerpt, and the page gains a category-level SEO layer (keywords, CollectionPage schema) it currently lacks entirely.
- The render components already exist on `directory/location/[location]/page.tsx` (bodyCopy intro ~line 317, metroContext ~line 375, areaBreakdown grid) — reusable one level up.
- **Batch read needed:** `getCategoryEnrichment` fetches one packet at a time — the home needs a roster endpoint returning ALL national category packets in one call (e.g. `?city=__all__` returning every `(category,'__all__','__all__')` row), plus `location-enrichment?city=__all__` verified to resolve the national row.

## Phases

### Phase B — National establishment lane (G1)

1. Import seam: `__all__` → `null` on `referenceCity` (+ `referenceState` where persisted) in the §10 hook (`MarketingPromptService.ts:949`) and the grid-upsert guard.
2. National establishment template variant (seed script — new template id; city-agnostic §10 body, national weight scope, no geography grid).
3. Template selection: how does a campaign pick the national variant — keyed on `city='__all__'` at prompt-resolve time, or a separate operator-picked template? Decide in implementation (recommend keyed on sentinel — one template family, zero operator friction).
4. Frontend: "National (all markets)" option in the establishment form setting both sentinels.
5. Tests: import path maps `__all__` → `reference_city: null`; resolver fallback returns national profile for a city-scoped lookup; update-schema accepts the sentinels.

### Phase C — `__all__` enrichment grounding (G2)

1. `resolvePrompt` enrichment branch: for `city='__all__'` category campaigns, `resolve(category, 'competitive', null, null)` → `'emerging'` fallback; inject `formatCategoryIntelligenceBlock` minus the geography section (or emit the block with geography omitted naturally when the profile has none). ALSO inject `=== NATIONAL SURFACE FRAMING ===` (national public-narrative directive — market-agnostic copy, no city claims) whenever the campaign signals national, whether or not a profile resolved.
2. `applyEnrichmentPacket`: `resolveProfileForMarket(categoryKey, null)` for national; stamp `intelligence_profile_id`; no listing fan-out (existing national behavior preserved).
3. **Sweep finding — activation trigger skips national:** the `profile_activated` hook fires enrichment only when `reference_city && reference_state` are set (`IntelligenceProfileService.ts:1301`) — a national profile activation produces NO national packet. Optional: extend to fire a national `__all__` enrichment (`enrichMarket` needs an `isNational` path), or deliberately keep national packets campaign-only — decide.
4. **Bonus seam (free):** `fetchCityProfile('__all__','__all__')` already matches the national location row once Phase D writes it — national category enrichment can inject the national `city_profile` block via the existing helper, no new code path.
5. Can land before Phase B — resolves to `null` today, graceful passthrough.
6. Tests: national injection when a national profile exists; no city-bound fields leak into the block.

### Phase D — National location enrichment (G3)

1. `LocationMarketEnrichmentService.applyEnrichmentPacket`: `isNational` path — literal `('__location__','__all__','__all__')` row, skip listing aggregates, coverage aggregates as the deterministic fallback.
2. **Phantom-write guard (sweep finding):** `getLocation`/`enrichLocation` sentinel bypass — literal `__all__` lookup, null on miss, never `enrichLocation` on-demand for sentinels (pattern: `getMarket` `CategoryMarketEnrichmentService.ts:438-473`).
3. Coverage aggregate query: distinct `(city, state)` + counts across `directory_category_enrichment` / listings / grids.
4. `resolvePrompt`: `=== NATIONAL COVERAGE GRID ===` + `=== NATIONAL SURFACE FRAMING ===` injection for `__location__` + `__all__` campaigns (coverage facts + explicit national public-narrative framing; the framing directive renders even if the aggregate query returns sparse data).
5. National location **template variant** (seed script — `mpt-location-enrichment-default` is city-scoped copywriting; national needs the coverage-narrative body). Alternative: the injected framing directive may suffice over the shared body — evaluate at implementation; prefer the injected-directive path since it needs no seed re-run.
6. Tests: sentinel row written literally; coverage block injected; `getLocation('__all__', '__all__')` never triggers on-demand write; city path unchanged.

### Phase E — `/place/city` seed-shelf wiring (G4) — IMPLEMENTED 2026-10-01

- API: `/places/city/:slug` now returns `state` (modal seed state — resolves the city-only slug ambiguity deterministically; a `{city}-{state}` slug migration remains an option but is no longer required for correctness) and an embedded `enrichment` packet (the same `('__location__',city,state)` row `/directory/location` renders, fetched via `LocationMarketEnrichmentService.getLocation`).
- Web: `getCityShelfSummary` on `PlacesBrowsePublicService`; packet-driven `generateMetadata`; new server component `PlaceCityEnrichmentContent` renders About/ShopperGuide/AreaBreakdown/Metro/FAQ+JSON-LD outside the client loading gate (crawler-visible); `PlaceCityClient` header renders `effective.description` + `topCategories` chips + real `state`.
- Nav: `/place` index city chips are now real links → `/place/city/{slug}` (chips moved out of the card anchor — nested-link fix); `/place/category` gains "Browse all places in {city}" when a `?city=` filter is active.

1. **Enrichment render (highest value):** `page.tsx` fetches `getLocationEnrichment(city, state)` → packet-driven `generateMetadata` + pass packet to client; render bodyCopy/metroContext/areaBreakdown/topCategories/faq using the `location/[location]` sections. Two prerequisites from the sweep: (a) `CityResponse` needs a `state` field (or the enrichment fetch moves client-side post-load); (b) **slug-ambiguity decision** — city-only slug can't disambiguate same-name cities across states; migrate to `{city}-{state}` or accept collisions. Open question: does the seed shelf need a population-aware copy tweak ("these listings are sourced from public information" is already the packet's frame — likely a fit as-is, verify wording at render time).
2. **Navigation:** `/place` index city chips → `Link` to `/place/city/{slug}` (the index already aggregates seed categories — the chips are the natural link); category page gains "Browse all places in {city}" alongside the self-filter chips. **Entry-page nav landed:** the `/place/[slug]` hero keeps the platform proxy (`getCityUrl` → `/directory/location/{city-state}`, "Browse stores in {city}, {state}") while the lower "Browse more places" panel now spotlights the seed shelf — `{category}` → `/place/category/{slug}` and "Places in {city}" → `/place/city/{city-slug}` (`PlaceEntryEditorialLayout.tsx` ~line 401; slug is city-only per the `/places/city/:citySlug` API + sitemap format).
3. **Metadata:** packet-driven (mirror `location/[location]/page.tsx:86-94`).
4. Tests: server-render coverage per AGENTS.md pattern; verify sitemap URLs resolve to enriched pages.

### Phase F — Home narrative, both axes (G5) — IMPLEMENTED 2026-10-01

- **Reads:** `GET /api/public/directory/location-enrichment?city=__all__&state=__all__` already resolves the national row — `getLocation` gained the literal-sentinel lookup in Phase D, no extra fix needed. New roster endpoint `GET /api/public/directory/category-enrichment-roster` returns every `(category,'__all__','__all__')` non-location packet in one call via `CategoryMarketEnrichmentService.getNationalRoster()` (literal sentinel query, `ORDER BY category_name`).
- **Location axis:** `/place` home renders `PlaceNationalPanel` (new server component) above the client index — the national packet's `bodyCopy`/`effective.description` intro + measured coverage band (`context.national_coverage`: listings / markets / states) + top-market chips linking `/place/city/{city-slug}` (the seed city shelves — real destinations, no phantom state pages). `generateMetadata` is now packet-driven (national `metaTitle`/`description` with static fallback). Panel renders nothing when no national packet exists — graceful-absent.
- **Category axis:** `page.tsx` fetches the roster server-side and passes it to `PlacesIndexClient` — each category card surfaces `context.category_overview` (fallback `effective.description`) as a 2-line excerpt, keyed on `categoryKey`/`categoryName`. Same treatment on `/directory/categories` (`AllCategoriesClient` + roster prop from its `page.tsx`).
- **`/directory` home parity — deferred:** the home is a layout-variant system (`DirectoryShell` + `platformSettingsService` layout key), so a national panel there means touching the layout layer — out of proportion to its value while `/directory/categories` and the `/directory/location` leaf pages already carry enrichment. Recorded as the intentional parity boundary: `/directory` home stays layout-driven; revisit if a locations index (`/directory/locations`) is added.
- Web service: `getNationalCategoryRoster()` on `PlacesBrowsePublicService` (5-min TTL cache, same convention as the other public reads).
- Tests: `getNationalRoster` literal-sentinel + `__location__` exclusion coverage in `directoryEnrichment.apply.category.test.ts`; `PlaceNationalPanel.test.ts` render tests (intro, coverage stats, shelf links, graceful-absent empty render).

1. ~~**Reads:**~~ **done** — see above.
2. ~~**Location axis:**~~ **done** — `PlaceNationalPanel`.
3. ~~**Category axis:**~~ **done** — roster excerpts on `/place` + `/directory/categories`.
4. `/directory` home: **deferred** — decision recorded above.
5. Depends on Phase C (category packets) and Phase D (location packet) for content; render plumbing degrades graceful-absent.

### Phase G — National discovery + market-scoped standards (post-sprint extension) — IMPLEMENTED 2026-10-01

The two-tier campaign matrix (NATIONAL + MARKET × all lanes) exposed three
gaps the original phases didn't cover:

- **National discovery** — `__all__` emerging/competitive discovery campaigns
  now work end-to-end:
  - `MarketingCampaignService.createCampaign` maps the sentinel to `null`
    city/state at the profile-prerequisite check → resolves the national slot
    directly; error copy says "nationwide".
  - `MarketingExecutionService.resolvePrompt` passes `city: null` to the
    composer (national profile slot, no retargeting directive), substitutes
    `{{city}}`→'all US markets' / `{{state}}`→'nationwide' in the composed
    body, resolves gold + bronze at nationwide scope (`null` slots), skips the
    geography-grid lookup, and appends `=== NATIONAL DISCOVERY SCOPE ===` —
    sweep nationally, every candidate carries its own city+state, no
    ZIP/radius applies.
  - `MarketContextLoader` loads the national `__location__` row for `__all__`
    campaigns (was the deferred out-of-scope item — now landed);
    `hasLocationIntelligence` counts `national_coverage` alone as intelligence.
  - `formatDiscoveryMarketContext` renders NATIONAL phrasing + a measured
    `NATIONAL COVERAGE` block (listings/markets/states + top states/cities),
    omits city-only blocks (city_profile, notable_areas), and never leaks the
    sentinel.
  - `GET /intelligence-profiles/resolve/:category` maps `__all__`→null on all
    four focus paths — the form's profile-prerequisite check resolves the
    national slot.
  - Form: the "National (all markets)" checkbox extends to discovery kind
    (distinct copy per kind); ZIP/radius fields hide when `__all__`.
- **National location enrichment affordance** — the `__all__` hint now renders
  for `scope=city` enrichment campaigns (was category-only).
- **Market-scoped gold + bronze establishment** — the nationwide-only gates
  are removed (validator + form geo-clearing). The import seams already
  stamped campaign city/state → `reference_city`/`reference_state`, so a
  filled market produces a market-scoped profile that resolves city-first and
  still cascades to nationwide. A pairing guard on `campaignCreateSchema`
  rejects half-scoped input (city without state or vice versa) — a half-slot
  resolves ambiguously.

Tests: national discovery describe in `ResolvePrompt.test.ts` (composer null
city, readable labels + directive, nationwide gold/bronze, grid skip,
market-context load, city unchanged); `__location__` national load in
`MarketContextLoader.test.ts`; pairing guard + national/market acceptance in
`bronze-campaign-refines.test.ts`; national framing in new
`DiscoveryMarketContextFormatter.test.ts`.

### Phase H — Ghost-gap sweep: national-as-superset on city-aware surfaces — IMPLEMENTED 2026-10-01

Because the resolvers treat national as a superset of every market (city →
state → nationwide cascade), any surface that enumerates markets literally
must know the national layer or it reports gaps that don't exist:

- **Coverage map** (the epicenter). API `getCoverage`: national campaigns map
  onto the null-city slot position (previously a `__all__` campaign would
  create an orphan inflight slot that never merged with its own profile),
  and `__all__` is excluded from the `cities` dimension (was a fake column).
  UI `CoverageClient`: emerging + competitive sections gain the leading
  Nationwide column (same pattern bronze already used); a city's discovery
  chip unlocks when the national establishment is active — the honest gap is
  the city *establishment* chip (local delta still missing), not the lock.
  Gold proxy tightened: the All Platforms proxy + platform-column unlock now
  require a null-city slot, because a market-scoped gold profile does not
  back a nationwide platform scan (`resolveGoldStandard` layer 3 is
  null-city only); platform-dimensioned slot matching prefers the nationwide
  slot when both exist. Nationwide-column create links carry `__all__` for
  emerging/competitive but stay geo-empty for bronze (bronze national is
  geo-free — a literal sentinel would import `reference_city='__All__'`, an
  orphan slot).
- **Dropdowns** — `vocab.cities`/`states` + the city↔state pairing maps in
  `CampaignFormClient` exclude `__all__` (SuggestiveSelect still renders it
  when it IS the current value); `IntelligenceProfilesClient` city filter
  labels it "National (all markets)"; `CampaignListClient` city column shows
  "National" and the filter excludes the sentinel.
- **City-aware lists** — `ProspectQueueClient` city filter excludes `__all__`
  defensively (national-discovery prospects carry real cities by contract);
  `ProvingGroundsClient` groups a stray sentinel under "National (all
  markets)" instead of a fake market.
- **Proving grounds** — a PG is a market deployment workspace, so the
  sentinel can never anchor one: `promoteToProvingGround` maps a `__all__`
  source to the geography-free category-scope umbrella (an explicit
  `input.city` still forces a specific market); `expandProvingGroundDomain`
  excludes the sentinel from member_geos and treats a sentinel anchor as
  unconstrained; `groupQueueEntriesIntoProvingGround` collapses a
  sentinel-derived modal city to blank → category umbrella.
- **Structurally immune (verified, no change):** `/settings/admin/directory/
  funnel` (cohorts are per-city seed rows; city is a free-text filter),
  `/settings/admin/growth-engine` (per-city breakdown groups
  `directory_presence_seeds.city` — real listings only).

Tests: 5 national-lane cases in `IntelligenceProfileService.coverage.test.ts`
(sentinel→null position, profile merge, discovery attach, cities exclusion,
case variants).

## Out of scope (recorded, not forgotten)

- Bronze `scope_level: 'category_family'` matching — observed label overlap via `category_taxonomy_queries` is a future category-association mechanism; user deferred ("no action for now").
- City establishment consuming a national profile for city-agnostic fields — deeper change; national-as-floor already comes free via resolver fallback.

## Test plan

- `npx vitest run src/services/__tests__/ResolvePrompt.test.ts src/services/__tests__/directoryEnrichment.apply.category.test.ts` (extend existing describes)
- New: import-hook sentinel mapping test (MarketingPromptService or a focused unit), location `isNational` apply test
- `pnpm checkapi`; `pnpm checkweb` for Phase E/F
- Manual: run a national establishment campaign → activate → verify city-scoped `resolve` falls back to it; verify `/place` renders the national narrative
