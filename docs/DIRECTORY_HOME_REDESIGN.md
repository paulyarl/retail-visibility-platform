# Directory Home — Modern Redesign Spec (Switchable Designs)

> **Audience:** Junior implementation agents.
> **Goal:** Redesign the directory home page (`/directory`) as **multiple switchable design variants** that all consume the **same data and shared components** but present different styles/UX. A **platform admin** chooses the active variant from the directory admin settings page (with a live `?layout_preview=` override for previewing).
> **Variants:** `discovery` (default, the modern redesign), `editorial`, `immersive` — names intentionally aligned with the platform's existing storefront/product layout system.
> **Stack (do not change):** Next.js App Router, React, TailwindCSS, Mantine, `lucide-react`.
> **Scope route:** `http://localhost:3000/directory` (and with params e.g. `?lat=39.70&lng=-86.36&sort=distance`).
>
> **Two distinct surfaces, two distinct ownership models:**
> | Surface | Route | Who controls the design | Mechanism |
> | --- | --- | --- | --- |
> | **Directory Home** | `/directory` | **Platform admin** (one global choice) | Platform setting + `?layout_preview=` (this doc, §2–§8) |
> | **Tenant Directory Entry** | `/directory/[slug]` | **The tenant**, gated by their plan | Capability flags + merchant preference, like storefronts (§9) |
>
> Rationale: the home is a platform-owned aggregation page, so its look is a platform decision. A tenant's entry page is that tenant's surface, so it follows the same capability-gated, merchant-selectable model as their storefront.
>
> **Reuse the proven pattern.** The platform already ships switchable storefront/product layouts. Mirror them exactly:
> - `apps/web/src/app/tenant/[id]/page.tsx` — reads the stored layout flag + `view` preview param, then renders one of three layout components with **identical props**.
> - `apps/web/src/app/tenant/[id]/StorefrontEditorialLayout.tsx` / `StorefrontImmersiveLayout.tsx` — variant components sharing `useStorefrontState` and `layouts/shared/*` sub-components.
> - `apps/web/src/app/products/[id]/layouts/types.ts` — `StorefrontLayoutProps`, `resolveStorefrontLayout()`, `resolveProductLayout()`.
> - `apps/web/src/utils/storefrontOptions.ts` — `STOREFRONT_OPT_TYPE_META` (classic/editorial/immersive labels, descriptions, icons).
> - `apps/web/src/app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx` — the 3-card layout picker UI to copy for admin.

---

## 1. Current State (what exists today)

| File | Role |
| --- | --- |
| `apps/web/src/app/directory/page.tsx` | Suspense wrapper + full-page spinner fallback |
| `apps/web/src/app/directory/DirectoryClient.tsx` | **803-line monolith**: state, geolocation, fetch, layout |
| `apps/web/src/hooks/useDirectoryStores.ts` | Data hook (caching, pagination) |
| `apps/web/src/services/DirectorySingletonService.ts` | API + types (`DirectoryStore`, `DirectorySearchResult`) |
| `apps/web/src/components/directory/DirectorySearch.tsx` | Hero search box (writes `?q=`) |
| `apps/web/src/components/directory/DirectoryFilters.tsx` | Sticky collapsible filter bar (category, store type, ZIP, city/state, sort, Near Me) |
| `apps/web/src/components/directory/DirectoryGrid.tsx` / `DirectoryList.tsx` | Result renderers → `StoreCard` / `UnifiedStoreCard` |
| `apps/web/src/components/stores/StoreCard.tsx` | grid / list / map card variants |

### Identified problems (root causes, not symptoms)
1. **Split search/filter state** — `DirectorySearch` and `DirectoryFilters` each build their own `URLSearchParams`; they don't reflect each other.
2. **Distance never displayed** — `DirectoryStore.distance` is fetched but no card surfaces it, even when `sort=distance`.
3. **No location context bar** — arriving with `lat/lng/sort=distance` shows no "Near you" affordance, radius control, or "change location".
4. **Light-mode hardcoding** — listing section uses `bg-white`/`text-gray-900` with no `dark:` variants, breaking dark mode.
5. **Visual noise** — repeated `gradient border` dividers and stacked full-width sections create a long, unfocused scroll.
6. **Full reload pagination** — `window.location.href = ...` instead of `router.push`.
7. **Monolithic component** — hard to maintain; mixes geolocation, tracking, fetching, and presentation.
8. **Weak loading/empty states** — full-page spinner; no card skeletons or "no results" guidance.

---

## 2. Switchable Design Architecture

All three variants are **presentation-only shells** over one shared data/logic layer. A variant must never fetch differently or change query-param contracts — it only changes layout, styling, and section arrangement.

### 2.1 Data flow (single source of truth)
```
/directory/page.tsx (server)
  └─ reads platform setting `directoryHomeLayout` + `?layout_preview=` override
  └─ resolveDirectoryLayout() → 'discovery' | 'editorial' | 'immersive'
        └─ <DirectoryShell variant=…>            ← shared container (Task 0/1)
              ├─ useDirectoryData()  ← shared hook wrapping useDirectoryStores + filters/categories/geolocation/tracking
              ├─ provides identical DirectoryLayoutProps to the chosen variant
              └─ renders one of:
                   ├─ <DirectoryDiscoveryLayout/>   (default)
                   ├─ <DirectoryEditorialLayout/>
                   └─ <DirectoryImmersiveLayout/>
```

- **Shared hook `useDirectoryData()`** owns: `useDirectoryStores`, search/filter params, categories/store-types fetch, geolocation auto-detect, behavior tracking, pagination handlers. Every variant consumes the **same** returned object.
- **Shared sub-components** (variant-agnostic, reused by all): `DirectorySearchBar`, `DirectoryContextBar`, `DirectoryFilterRail`, `StoreResults`, `StoreCardV2`, plus existing `DirectoryCategoryBrowser`, `DirectoryStoreTypeBrowser`, `FeaturedStoresList`, `RandomFeaturedProducts`, `LastViewed`, `DirectoryHomeRecommendations`, `DirectoryMapGoogle`. Variants compose/skin these differently but do **not** fork their logic.

### 2.2 Variant resolution (mirror `resolveStorefrontLayout`)
**File:** `apps/web/src/components/directory/redesign/types.ts`
```ts
export type DirectoryLayoutKey = 'discovery' | 'editorial' | 'immersive';

export function resolveDirectoryLayout(
  stored?: string | null,       // platform setting value
  preview?: string | null,      // ?layout_preview= query param (admin preview)
): DirectoryLayoutKey {
  const valid: DirectoryLayoutKey[] = ['discovery', 'editorial', 'immersive'];
  if (preview && valid.includes(preview as DirectoryLayoutKey)) return preview as DirectoryLayoutKey;
  if (stored && valid.includes(stored as DirectoryLayoutKey)) return stored as DirectoryLayoutKey;
  return 'discovery';
}

// Shared props contract every variant receives (identical data)
export interface DirectoryLayoutProps {
  variant: DirectoryLayoutKey;
  data: ReturnType<typeof useDirectoryData>; // stores, loading, pagination, filters, handlers, counts
}
```

### 2.3 Variant metadata (mirror `STOREFRONT_OPT_TYPE_META`)
Used by the admin picker UI. Keep in `types.ts`:
```ts
export const DIRECTORY_LAYOUT_META: Record<DirectoryLayoutKey, { label: string; description: string; icon: string }> = {
  discovery:  { label: 'Discovery',  description: 'Location-first marketplace grid with sticky filters and distance badges.', icon: '🧭' },
  editorial:  { label: 'Editorial',  description: 'Storytelling emphasis: large hero, curated featured rows, magazine-style sections.', icon: '📰' },
  immersive:  { label: 'Immersive',  description: 'Edge-to-edge map + results split view, compact cards, conversion-focused.', icon: '🗺️' },
};
```

---

## 3. Design Variants

All variants share the tokens in §4 and consume `DirectoryLayoutProps`. Only the arrangement/skin differs.

### Variant A — `discovery` (default; the modern redesign)
**Principle:** *A location-first marketplace discovery surface* — answer "what good stores are near me right now?" within one viewport, then invite deeper browsing.

**Desktop ≥ `lg`:**
```
┌───────────────────────────────────────────────────────────────┐
│  HERO: gradient band                                          │
│   "Discover Local Stores"  +  unified SearchBar (q + Near Me) │
│   quick stat chips: 1,240 stores · 38 categories · open now   │
├───────────────────────────────────────────────────────────────┤
│  CONTEXT BAR (sticky):  📍 Near you (5 mi) ▾  | Sort: Distance ▾ │
│                          [Grid][List][Map]   Showing 1–24 of N  │
├──────────────┬────────────────────────────────────────────────┤
│ FILTER RAIL  │   RESULTS GRID (3-up cards, distance badge)     │
│ (sticky,     │   ...                                            │
│  240px)      │   Pagination (client-side)                       │
│ Categories   │                                                  │
│ Store types  │                                                  │
│ Rating       │                                                  │
│ Open now     │                                                  │
└──────────────┴────────────────────────────────────────────────┘
│  DISCOVERY SECTIONS (only when no active query/filter):       │
│   Featured Stores · Browse Categories · Browse Store Types ·  │
│   Trending Products · Recently Viewed                          │
├───────────────────────────────────────────────────────────────┤
│  MERCHANT CTA  |  How it works                                │
└───────────────────────────────────────────────────────────────┘
```
**Mobile < `lg`:** hero search full width; context bar one row; filter rail becomes a Mantine `Drawer` ("Filters" button); results single column (list) or 2-up (grid).

### Variant B — `editorial`
**Principle:** *Magazine-style curation.* Discovery-first feel where featured/curated content leads and raw search is secondary.
- **Full-bleed hero** with a large background image (use platform banner or a featured store banner) and the `DirectorySearchBar` centered, oversized.
- **Curated rows above the grid:** "Featured near you" (horizontal scroll of `StoreCardV2` in a wide aspect), "Trending categories" as large image tiles, "Editor's picks".
- Results grid is **2-up large cards** with bigger imagery and serif-leaning headings (use `font-semibold tracking-tight`, larger `text-xl` titles).
- Context bar still sticky; filter rail collapses into a top filter chip row instead of a left rail.
- Reuses the same `StoreResults`/`StoreCardV2` with an `appearance="editorial"` prop that toggles size/spacing (no logic fork).

### Variant C — `immersive`
**Principle:** *Map-led exploration*, conversion-focused.
- **Split view:** left = scrollable results column (`~40%`, compact `StoreCardV2` rows), right = sticky full-height `DirectoryMapGoogle` (`~60%`) that syncs hover/selection with the list.
- Hero is minimized to a slim sticky bar (`DirectorySearchBar` + `DirectoryContextBar` merged).
- Filters are a compact popover/segmented control, not a rail.
- On mobile: map collapses to a top peek with a "View map" toggle; results list below.
- Reuses `StoreResults` with `appearance="immersive"` (compact density) and the existing `DirectoryMapGoogle`.

> **Rule for juniors:** if a variant needs a visual difference in a shared component, add an `appearance` prop (`'discovery' | 'editorial' | 'immersive'`) that only changes Tailwind classes/density. Never duplicate data logic.

---

## 4. Design Tokens

Use Tailwind classes; **always pair light + `dark:` variants.**

| Token | Light | Dark |
| --- | --- | --- |
| Page bg | `bg-neutral-50` | `dark:bg-neutral-950` |
| Surface / card | `bg-white` | `dark:bg-neutral-900` |
| Border | `border-neutral-200` | `dark:border-neutral-800` |
| Primary text | `text-neutral-900` | `dark:text-neutral-50` |
| Muted text | `text-neutral-500` | `dark:text-neutral-400` |
| Brand accent | `text-blue-600` / `bg-blue-600` | `dark:text-blue-400` |
| Success/open | `text-emerald-600` | `dark:text-emerald-400` |
| Featured | `from-amber-500 to-orange-500` | same |
| Focus ring | `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` | `dark:focus:ring-offset-neutral-950` |

**Spacing/shape:** card radius `rounded-2xl`; section gap `gap-6`; container `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
**Elevation:** rest `shadow-sm`, hover `hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`.
**Remove:** all `gradient border` divider lines (`bg-gradient-to-r from-transparent via-blue-500`). Replace with whitespace + section headers.

---

## 5. Component Spec (build order)

Built in **4 phases**. Create new files under `apps/web/src/components/directory/redesign/`; do not delete old files until the final cutover task. Keep `useDirectoryStores`, `DirectorySingletonService`, and routing/query-param contracts unchanged.

| Phase | Tasks | Output |
| --- | --- | --- |
| **1 — Shared core** | 0 | `types.ts` + `useDirectoryData()` hook |
| **2 — Shared components** | 1–7 | Hero, search bar, context bar, filter rail, card, results, pagination |
| **3 — Variants** | 8, 10, 11 | `discovery`, `editorial`, `immersive` layout shells |
| **4 — Admin switch & cutover** | 12, 13 | Platform setting + admin picker UI + `page.tsx` wiring |

> The shared components (Phase 2) accept an optional `appearance?: DirectoryLayoutKey` prop (default `'discovery'`) that ONLY changes Tailwind classes/density. All three variants reuse them.

### Task 0 — Shared types + `useDirectoryData()` hook
**Files:** `apps/web/src/components/directory/redesign/types.ts`, `apps/web/src/components/directory/redesign/useDirectoryData.ts`
- `types.ts`: add `DirectoryLayoutKey`, `resolveDirectoryLayout()`, `DirectoryLayoutProps`, `DIRECTORY_LAYOUT_META` (see §2.2–2.3).
- `useDirectoryData.ts`: a single hook that encapsulates ALL current `DirectoryClient.tsx` logic — `useDirectoryStores`, search/filter param reads, categories/store-types fetch, geolocation auto-detect, behavior tracking, view-mode/page-size persistence, and pagination/handlers. Returns one object: `{ stores, loading, error, pagination, counts, viewMode, setViewMode, pageSize, setPageSize, categories, storeTypes, userLocation, handlers… }`.
- **Acceptance:** hook compiles with no `any` on the public return type; no UI in this task; behavior identical to today's `DirectoryClient` side-effects.

### Task 1 — `DirectoryHero`
**File:** `apps/web/src/components/directory/redesign/DirectoryHero.tsx`
- Gradient band: `bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white`.
- Title `Discover Local Stores`, subtitle.
- Embed a **unified `DirectorySearchBar`** (Task 2).
- Stat chips row: total stores, total categories, "open now" count (props in; default 0 → hide chip).
- Props: `{ totalStores: number; totalCategories: number; openNowCount?: number }`.
- **Acceptance:** renders responsively; passes `aria-label` on search; no layout shift on load (reserve chip height).

### Task 2 — `DirectorySearchBar` (unified search + Near Me)
**File:** `apps/web/src/components/directory/redesign/DirectorySearchBar.tsx`
- Single source of truth for `q`, plus a "Near Me" button that calls `navigator.geolocation` and sets `lat`,`lng`,`sort=distance` (reuse logic from `DirectoryFilters.getNearMe`).
- On submit: merge into existing `useSearchParams`, `router.push("/directory?"+params)`, reset `page`.
- Loading state on Near Me (`gettingLocation`).
- **Acceptance:** typing `q` and pressing enter updates URL; Near Me populates `lat/lng/sort`; existing params preserved.

### Task 3 — `DirectoryContextBar` (sticky)
**File:** `apps/web/src/components/directory/redesign/DirectoryContextBar.tsx`
- Sticky `top-0 z-20` with `backdrop-blur bg-white/80 dark:bg-neutral-900/80 border-b`.
- Left: **location pill** — if `sort=distance` & `lat/lng` present, show `📍 Near you` + reverse-geocoded label (use `externalApiService.reverseGeocode`) + a **radius selector** (`5 / 10 / 25 / 50 mi`, writes `?radius=`). If no location, show a "Use my location" button.
- Center/right: **Sort dropdown** (`relevance/distance/rating/newest/products`), **view toggle** (Grid/List/Map), and **result counter** ("Showing X–Y of N").
- Props: counts + current view + handlers; read sort/location from `useSearchParams`.
- **Acceptance:** sort change updates URL & refetches; view toggle persists to `localStorage` (`directory-view-mode`); radius writes `?radius=` (backend wiring is Task 9, UI can no-op-store until then).

### Task 4 — `DirectoryFilterRail`
**File:** `apps/web/src/components/directory/redesign/DirectoryFilterRail.tsx`
- Desktop: sticky left column `w-60 shrink-0`. Mobile: render inside a Mantine `Drawer` triggered by a "Filters" button in the context bar.
- Sections (collapsible `<details>` or Mantine `Accordion`): **Categories** (checkbox/radio list with counts), **Store Types**, **Minimum Rating** (star radio), **Open now** (toggle).
- Each change updates URL params (`category`, `storeType`, `minRating`, `openNow`) via `router.push`, resets `page`.
- Show active-filter count badge + "Clear all".
- **Acceptance:** selecting a category updates URL & list; clear-all resets to `/directory`; works in drawer on mobile.

### Task 5 — `StoreCardV2` (grid)
**File:** `apps/web/src/components/directory/redesign/StoreCardV2.tsx`
- Modern card: `rounded-2xl`, banner/logo header, name, category chip, rating, **distance badge** (`{distance.toFixed(1)} mi` when present), open-now `HoursStatusBadge`, product count, primary "Visit Store" button.
- Full dark-mode support. Hover lift. Whole card clickable (wrap link) with inner buttons using `stopPropagation`.
- Reuse `useStoreStatus` and `HoursStatusBadge` (see existing `StoreCard.tsx`).
- Props: `{ store: DirectoryStore; }` (type from `DirectorySingletonService`).
- **Acceptance:** distance shows only when defined; renders correctly in light/dark; keyboard-focusable.

### Task 6 — `StoreCardV2Skeleton` + grid/empty states
**File:** `apps/web/src/components/directory/redesign/StoreResults.tsx`
- Renders grid (`grid gap-6 sm:grid-cols-2 xl:grid-cols-3`) of `StoreCardV2`, list mode (reuse `DirectoryList`), or map (reuse `DirectoryMapGoogle`).
- Loading: render 6–9 skeleton cards (not a full-page spinner).
- Empty: friendly illustration/icon + "No stores match your filters" + "Clear filters" CTA.
- **Acceptance:** smooth skeleton → content; empty state appears when `data.length === 0 && !loading`.

### Task 7 — Client-side pagination fix
**File:** edit results/pagination usage in the new container (Task 8).
- Replace `window.location.href = ...` with `router.push("/directory?"+params, { scroll: true })` and scroll results into view.
- **Acceptance:** page change does not full-reload; preserves filters.

### Task 8 — `DirectoryDiscoveryLayout` (Variant A, default)
**File:** `apps/web/src/components/directory/redesign/layouts/DirectoryDiscoveryLayout.tsx`
- Props: `DirectoryLayoutProps`. Consumes `data` from `useDirectoryData()` — **does not fetch**.
- Compose: `DirectoryHero` → `DirectoryContextBar` → 2-col (`DirectoryFilterRail` + `StoreResults appearance="discovery"`) → discovery sections (only when no `q`/`category`/`storeType` active) → CTAs → `PoweredByFooter`.
- Reuse existing discovery components: `DirectoryCategoryBrowser`, `DirectoryStoreTypeBrowser`, `RandomFeaturedProducts`, `FeaturedStoresList`, `LastViewed`, `DirectoryHomeRecommendations`.
- **Acceptance:** feature parity with the current page; no console errors; dark mode correct.

### Task 10 — `DirectoryEditorialLayout` (Variant B)
**File:** `apps/web/src/components/directory/redesign/layouts/DirectoryEditorialLayout.tsx`
- Props: `DirectoryLayoutProps`. Same `data`, magazine arrangement per §3 Variant B.
- Full-bleed hero, curated horizontal rows (reuse `FeaturedStoresList`, `DirectoryCategoryBrowser` skinned large), `StoreResults appearance="editorial"` (2-up large cards), filters as top chip row.
- **Acceptance:** renders from the same hook; switching to it changes only layout/skin; dark mode correct.

### Task 11 — `DirectoryImmersiveLayout` (Variant C)
**File:** `apps/web/src/components/directory/redesign/layouts/DirectoryImmersiveLayout.tsx`
- Props: `DirectoryLayoutProps`. Split list/map per §3 Variant C.
- Left results column (`StoreResults appearance="immersive"`, compact) + sticky `DirectoryMapGoogle`; slim merged search/context bar; mobile map peek toggle.
- **Acceptance:** map and list stay in sync; same data; no logic fork; dark mode correct.

### Task 12 — Admin switching (platform setting + picker UI)
**Backend coordination + frontend.**
1. **Persisted setting.** Store the active variant in platform settings (e.g. `features.directoryHomeLayout: 'discovery' | 'editorial' | 'immersive'`). Read via `PlatformSettingsSingletonService.getPlatformSettings()` (`/api/platform-settings`); write via the admin settings endpoint (`/api/admin/platform-settings`). Coordinate with the backend owner to add the field if missing (default `'discovery'`).
2. **Admin page.** Create `apps/web/src/app/(platform)/settings/admin/directory/appearance/page.tsx` — a 3-card picker copied from `StorefrontOptionsSettingsClient.tsx` (selected card highlighted with check, `DIRECTORY_LAYOUT_META` for label/description/icon). Save button persists the setting; show a success/error message.
3. **Nav entry.** Add `{ label: 'Appearance', href: '/settings/admin/directory/appearance' }` to the Directory `children` in `apps/web/src/components/navigation/AdminNavContent.tsx`.
4. **Live preview.** The picker links to `/directory?layout_preview=<variant>` (new tab) so admins preview before saving.
- **Acceptance:** changing + saving the setting changes the public `/directory` variant for all visitors; `?layout_preview=` overrides for the current view only; non-admins cannot access the page.

### Task 13 — `page.tsx` wiring & cutover
**File:** `apps/web/src/app/directory/page.tsx`
- Server component: read `directoryHomeLayout` from platform settings and `layout_preview` from `searchParams`; call `resolveDirectoryLayout(stored, preview)`; render the matching layout inside the existing `Suspense`. All three receive the SAME provider/hook output (wrap shared `useDirectoryData` in a small `DirectoryShell` client component if needed for the hook).
- Keep old `DirectoryClient.tsx` until parity QA passes on all 3 variants, then delete.
- **Acceptance:** default renders `discovery`; admin setting + preview switch correctly; `/directory?lat=..&lng=..&sort=distance` works in every variant.

### Task 14 — (Optional / backend) radius + open-now filtering
- Wire `?radius=` and `?openNow=` into `useDirectoryStores` → `directoryService.searchDirectoryStores`. Coordinate with backend `directory` route owner. If backend unsupported, filter client-side as interim and leave a `// TODO: backend radius filter` note.
- **Acceptance:** radius narrows results; documented whether client- or server-side.

---

## 6. Accessibility & Quality Bar
- All interactive elements keyboard-reachable with visible focus ring.
- Color contrast ≥ WCAG AA in both themes.
- Images use `next/image` with `alt`.
- No `any`-typed props on new components (use `DirectoryStore`).
- No new ESLint/TS errors: run `pnpm --filter web typecheck` (or the repo's `checkweb` script) — must be **0 errors**.

---

## 7. Definition of Done
- [ ] Tasks 0–13 merged; old `DirectoryClient.tsx` removed after parity QA.
- [ ] All three variants (`discovery`, `editorial`, `immersive`) render from the **same** `useDirectoryData()` hook with no logic forks.
- [ ] Admin can switch the active variant from `/settings/admin/directory/appearance` and it changes the public page for all visitors.
- [ ] `?layout_preview=<variant>` overrides the variant for the current view only.
- [ ] `/directory` and `/directory?lat=..&lng=..&sort=distance` work in every variant.
- [ ] Distance badges appear when sorting by distance.
- [ ] Dark mode verified on every section of every variant.
- [ ] Pagination is client-side; filters persist.
- [ ] `checkweb` typecheck passes with 0 errors.
- [ ] Lighthouse: no major a11y regressions; CLS < 0.1 on directory home.

---

## 8. Out of Scope (for the Directory Home work, §2–§7)
- Backend MV/schema changes (except Task 12 platform-setting field + optional Task 14 coordination).
- The home variant is a **platform-wide** admin choice; tenants do not control the home page.
- Storefront / category detail pages.
- Changing the `useDirectoryStores` caching contract.

---

## 9. Tenant Directory Entry Page — Capability-Gated Layouts

**Surface:** `apps/web/src/app/directory/[slug]/page.tsx` (a tenant's individual directory listing page).
**Ownership:** the tenant selects the design for their own entry page; availability is gated by their plan — exactly like the storefront layout system. This is **separate** from the platform-admin home variant (§2–§8).

### 9.1 UX Character — "Local Trust Card"

A directory entry is **not** a storefront. The storefront is a *transaction surface* (browse → cart → checkout). The entry page is a **discovery & trust surface**: the 10-second decision moment where a visitor judges *"is this business worth visiting, contacting, or clicking into?"* Cloning the storefront would be a UX mistake.

**Design character:** clean, credible, place-aware — a polished "business card meets local guide." Every variant must express this character; they differ only in emphasis/medium.

**Priority-ordered information architecture (the contract every variant honors):**
1. **Identity & trust** — logo, business name, primary category, rating (`StoreRatingsSection`), open-now badge (`HoursStatusBadge`), verified/established signals.
2. **Place & reachability** (more prominent than on a storefront) — map (`GoogleMapEmbed`), address, hours (`BusinessHoursCollapsible`), contact (`ContactInformationCollapsible`), "Get directions" / "Call".
3. **A *taste*, not the catalog** — a small curated product/photo strip (`DirectoryPhotoGalleryDisplay`, a few `SmartProductCard`s) that **funnels into the full storefront** via a prominent "Visit full store →" CTA.
4. **Proof & engagement** — reviews, FAQ (`FaqStorefrontDisplay`), inquiry form (`PublicInquiryForm`), QR (`TenantQRCode`) — depth gated by plan.
5. **Directory-native context** — keyword tags (`DirectoryKeywordTags`), category chips that **link back to directory filters**, and **`RelatedStores`** ("nearby / similar") at the bottom.

### 9.2 Directory-native navigation model (the signature that distinguishes it from a storefront)
- **Sticky identity header** (reuse the storefront convention: `sticky top-0 z-50 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b`) showing logo + name + a primary **"Visit full store"** action and `DirectoryActions` (share/QR).
- **Breadcrumb back to the directory** (`BreadcrumbStructuredData` + visible UI): `Directory / {Category} / {Business}` — links the visitor back into discovery. Storefronts deliberately lack this; the entry page must have it.
- **Category chips link to directory filters** (e.g. `/directory?category=…`), not internal-only anchors — keeps the user inside the directory journey.
- **`RelatedStores` footer** ("Stores like this nearby") to continue discovery — the move that makes the page feel like part of a *directory*, not an island.
- Close with `PoweredByFooter` for cross-surface consistency.

### 9.3 Shared tokens (cross-surface consistency)
Reuse the same conventions as the home spec (§4) and the storefront layouts so all three platform surfaces feel like one product:
- Container `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`; card radius `rounded-2xl`; full light/dark pairing on every element.
- Brand theming pulled from `tenant.metadata` (`banner_url`, `primary_color`) exactly like `StorefrontEditorialLayout`.
- Reuse storefront shared primitives where sensible: `SectionDivider`, `TrustSignalsBar`, `StickySearchBar`, `StorefrontFooter` (`apps/web/src/app/tenant/[id]/layouts/shared/`).

### 9.4 The four variants (intent + who it's for)

All variants consume the **same** data already fetched in `directory/[slug]/page.tsx` (presentation-only, no new fetching) and honor the §9.1 IA + §9.2 navigation.

Each variant maps 1:1 to a capability flag. **Availability is decided entirely by the feature-aware capability infrastructure** — the design does **not** hardcode any tier mapping. Which tiers unlock which flag is configured later (tier↔feature assignment), so the same code works regardless of how plans are arranged or re-priced.

| Variant | Intent | Best for | Gated by (flag only) |
| --- | --- | --- | --- |
| **`classic`** (current) | Info-dense, scannable. Today's page, refined to the navigation model. | Any tenant; default | `directory_entry_layout_classic` |
| **`editorial`** | Photo-led storytelling: full-bleed banner hero, large gallery, brand narrative. | Lifestyle/boutique/food merchants with strong imagery | `directory_entry_layout_editorial` |
| **`immersive`** | Visit-planning focus: prominent sticky map, hours/directions/contact elevated, compact product taste. | Location-driven businesses (services, brick-and-mortar) | `directory_entry_layout_immersive` |
| **`premium`** | Flagship: video/animated hero, featured-products carousel, elevated reviews & trust, custom accent theming, richer related-stores. | Premium tenants | `directory_entry_layout_premium` |

**Per-variant notes:**
- **`classic`** — keep current sections; apply §9.2 navigation + §9.3 tokens. Lowest risk; preserves behavior.
- **`editorial`** — banner/gradient hero + business description (mirror `StorefrontEditorialLayout` hero), `DirectoryPhotoGalleryDisplay` enlarged, `SmartProductCard` spotlight row, scroll-to CTA.
- **`immersive`** — two-column on desktop: left identity/products, **right sticky `GoogleMapEmbed`** with directions/hours/contact; collapses to map-peek on mobile.
- **`premium`** — superset of editorial; adds video hero (if `metadata.video_url`), featured-products carousel, prominent `StoreRatingsSection`, custom accent color, and an expanded `RelatedStores`. Visually signals a premium business. **Gated by `directory_entry_layout_premium`** — selectable/renderable only when that flag resolves true (tier assignment owned by the capability infra).

### 9.5 Capability model (mirror the storefront layout block)
- The page already consumes `unifiedCapabilityService` + `StorefrontOptionFlags`. Mirror the storefront layout capability in `apps/web/src/services/CapabilityResolutionService.ts`:
  - **New feature gates:** `directory_entry_layout_classic / _editorial / _immersive / _premium` — register them; **do not assign them to tiers in code.** Tier↔flag assignment lives in the capability/tier configuration and can change anytime without touching this feature.
  - **New merchant preference:** `directory_entry_layout` (default `'classic'`).
  - Extend the resolver with `canUseDirectoryEntryLayout{Classic,Editorial,Immersive,Premium}` + `effectiveDirectoryEntryLayout` (= flag-allowed AND merchant-selected; falls back to first allowed, else `classic`).
  - **No onset tier map required.** The feature is correct as long as it honors whatever the capability infrastructure resolves for each flag. Follow the existing storefront `flexible`/`enabled`/`disabled` fail-open conventions so untouched configs behave sanely (mirror `resolveFeaturedOptions` / the storefront layout block).

### 9.6 Resolver + variant components
**Files:** `apps/web/src/app/directory/[slug]/layouts/types.ts` and `layouts/DirectoryEntry{Classic,Editorial,Immersive,Premium}Layout.tsx`
- Add `DirectoryEntryLayoutKey = 'classic' | 'editorial' | 'immersive' | 'premium'` and `resolveDirectoryEntryLayout(stored, preview)` mirroring `resolveStorefrontLayout` (allow `?layout_preview=` for merchant preview).
- Extract today's render into `DirectoryEntryClassicLayout` and define the other three as siblings receiving identical props. **No new data fetching in any variant.**
- `directory/[slug]/page.tsx` resolves the layout from `effectiveDirectoryEntryLayout` + preview param and renders the matching component.

### 9.7 Tenant settings UI
- Add a layout picker to `apps/web/src/components/directory/DirectorySettingsPanel.tsx` (rendered at `/t/[tenantId]/settings/directory`).
- Copy the card picker from `StorefrontOptionsSettingsClient.tsx`, now **four cards**, each gated by `canUseDirectoryEntryLayout*` with the "Not included in your plan" treatment and an upgrade hint on `premium` for non-premium tenants.
- Each card links to `/directory/{slug}?layout_preview=<variant>` (new tab) for live preview.
- Persist via `useDirectoryListing.updateSettings` → `tenantDirectoryManagementService.updateDirectoryListing`.

### 9.8 Acceptance criteria (designer-review bar)
- [ ] Every variant honors the §9.1 IA order and §9.2 directory-native navigation (breadcrumb, category→filter links, `RelatedStores`).
- [ ] `classic` preserves today's content/behavior; only navigation + tokens refined.
- [ ] Gating is **capability-flag-driven only** (no tier names hardcoded in the feature). A variant is selectable/renderable iff its `canUseDirectoryEntryLayout*` flag resolves true — including `?layout_preview=`, which must be blocked when the flag is false.
- [ ] Responsive: identity/trust + primary CTA visible above the fold on mobile; immersive map collapses to a peek toggle.
- [ ] A11y: keyboard-navigable, visible focus rings, WCAG AA contrast in light/dark, `alt` on all imagery, semantic headings.
- [ ] Cross-surface consistency: shared container/blur-header/footer tokens match home (§4) and storefront.
- [ ] `checkweb` typecheck passes with 0 errors.

> **Strict separation:** the directory **home** variant (platform setting) and the directory **entry** layout (tenant capability) must not read each other's values.
