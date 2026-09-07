# Multi-Category Shelf Placement + Category Claim Incentive

Status: **DRAFT v1**

Companion docs:
- `docs/LocalBiz/CATEGORY_MARKET_ENRICHMENT_SPEC.md` (market-level category page enrichment)
- `docs/LocalBiz/PLACE_SEED_SEO_ENRICHMENT_SPEC.md` (per-business SEO composer — populates `secondary_categories` on seeds)
- `docs/LocalBiz/directory_presence_claim_handoff_spec.md` (claim success handoff)
- `docs/LocalBiz/directory_public_submission_cta_spec.md` (public submission CTAs)
- `.devin/skills/directory-presence-seed-claim/SKILL.md` (seed/claim architecture)

---

## §1 Summary

Category identification audits produce **multiple defensible shelves per business**. Motivating case: the Manna African Caribbean Market category audit (Fort Wayne, IN) returned three defensible candidates — **African Grocery Store** (primary, high confidence), **International Grocery Store** (broader parent, medium), and **Caribbean Grocery Store** (secondary facet, low/thin shelf locally). Each category shelf page (`/place/category/[categorySlug]`, `/directory/categories/[categorySlug]`) is a separate long-tail SEO surface.

The platform already stores multi-category data end-to-end — `directory_listings_list.secondary_categories`, seed composer output, claim token summaries, the claim listing editor — **but the two browse engines disagree**:

| Browse engine | Serves | Category match | Secondaries honored? |
|---|---|---|---|
| `directory-presence-public.ts` (`/place/...`) | Unclaimed seeds | `dps.category` only (single) | **No** |
| `directory-mv.ts` (`/directory/categories/...`) | Claimed tenants | `primary = X OR X = ANY(secondary_categories)` | **Yes** |

Net effect today: an unclaimed seed appears on **one** shelf; after claiming, the same categories place it on **multiple** `/directory` shelves. That asymmetry is itself a claim incentive — but it is invisible pre-claim, and the `/place` seed shelves under-deliver for everyone.

This spec:
1. **(Backend)** Makes the pre-claim `/place` browse honor `secondary_categories` so shelf placement is consistent across both engines.
2. **(Frontend)** Turns multi-shelf placement into a **personalized, honest claim incentive** across all CTA surfaces, powered by data the claim token summary already returns.

---

## §2 Current Architecture Analysis

### §2.1 What already exists (no new plumbing needed)

- **Data model**: `directory_listings_list.primary_category` (text) + `secondary_categories` (text[]). `directory_presence_seeds.category` is the single free-form seed category (matches `platform_categories.name`). `platform_categories` is the canonical vocabulary (slug, name, parent, gcid).
- **Population**: `SeedSeoComposer` writes `secondary_categories` (profile subcategories capped at 6, unioned with audit `additional_categories`) with provenance field key `secondary_categories` (`DirectoryPresenceSeedService.ts:1939-1962`).
- **Claim token summary**: `ClaimTokenSummary.primaryCategory` + `secondaryCategories` (`DirectoryClaimService.ts:65-66, 129-130`) — the claim page already receives the full category set.
- **Owner self-serve category editing**: `DirectoryClaimListingEditor.tsx:268-274` renders `DirectoryCategorySelectorAdapter` (primary + secondary) during the claim flow; options come from `platform_categories` via `useDirectoryCategories()` — **canonical vocabulary only, no free text** (no bespoke labels by construction).
- **Post-claim persistence**: `PATCH /api/tenants/:id/directory/listing` (`directory-tenant.ts:19-26`) Zod-validates `secondary_categories` (max 5), mirrors to `directory_listings_list`, and syncs `directory_listing_categories` for the materialized view.
- **Claimed-side browse already multi-category**: `directory-mv.ts:130` filters `(dll.primary_category = $n OR $n = ANY(dll.secondary_categories))`; the category index counts secondaries (`:473-480`, `:585-594`); shelf listing queries match secondaries (`:677`).

### §2.2 The gap

`apps/api/src/routes/directory-presence-public.ts` — all four public `/place` endpoints match **only** `dps.category`:

| Endpoint | Line | Current match | Gap |
|---|---|---|---|
| `GET /places` (category index) | 379-452 | groups by `dps.category` | secondaries uncounted |
| `GET /places/:categorySlug` | 455-516 | `pc.slug = $1` OR name-slug of `dps.category` | secondaries never match |
| `GET /places/city/:citySlug` | 672-768 | groups by `dps.category` | secondaries ungrouped |
| `GET /places-map` | 771+ | `LOWER(dps.category) = LOWER($n)` | secondaries unmatched |

Frontend CTA surfaces make no category promise:
- `UnclaimedDirectoryBanner.tsx` — generic "Claim this listing" (no category mention).
- `DirectoryClaimClient.tsx:719` — claim page header shows only `summary.category` (primary); invite alert (753-757) mentions one category.
- Claim success screen (`DirectoryClaimClient.tsx:630-700`) — has product-allowance teaser but no shelf confirmation.
- `PlaceEntryEditorialLayout.tsx:274` — incentive copy exists ("add up to 5 signature products") but no category line.
- `PlaceCategoryClient.tsx:375` — claim CTA on shelf pages, no category framing.
- Claimed listing pages (`/directory/[slug]`) render categories but do not cross-link shelf memberships.

### §2.3 The two-surface shelf story (normative framing)

- **Pre-claim**: listing lives at `/place/{slug}`, appears on `/place/category/{slug}` shelves.
- **Post-claim**: listing moves to `/directory/{slug}` (per `DirectoryClaimService` header) and appears on `/directory/categories/{slug}` shelves — **already multi-category**.

The claim CTA may therefore honestly promise *more shelf placement after claiming* today. Phase 1 (below) additionally makes the pre-claim `/place` state multi-shelf so the composer's secondaries are never dead data.

---

## §3 Design

### §3.1 Shelf membership rule (normative)

A published seed listing is a member of shelf `S` (a category name resolved from `categorySlug`) iff:

```sql
LOWER(dps.category) = LOWER($shelfName)
OR EXISTS (
  SELECT 1 FROM unnest(dll.secondary_categories) AS sc
  WHERE LOWER(sc) = LOWER($shelfName)
)
```

plus the existing name-based slug fallback for categories not registered in `platform_categories` (primary only — secondaries are UI-selected from `platform_categories`, so they are always canonical names).

Rules:
- A listing appears **once per shelf** (no dedup issues within a shelf query).
- On multi-shelf surfaces (city grouped view, category index counts), a listing may legitimately appear under multiple category groups — each group is a shelf.
- Shelf resolution order: `platform_categories.slug → name` first; fall back to name-slug normalization of `dps.category` only when no `platform_categories` row matches (preserves current behavior for unregistered categories).

### §3.2 Backend changes — `directory-presence-public.ts`

No migration. All changes are query-level. Extract the shelf-match predicate into one shared helper (e.g., `buildShelfMatchClause(categorySlug, paramIdx)` in the same file or `apps/api/src/services/directory/shelfMatch.ts`) so it is unit-testable and consistent across endpoints.

1. **`GET /places/:categorySlug`** (line 455): resolve slug → canonical name once (`SELECT name FROM platform_categories WHERE slug = $1`), then extend the WHERE clause:

   ```sql
   AND (
     pc.slug = $n
     OR LOWER(dps.category) = LOWER($shelfName)
     OR EXISTS (SELECT 1 FROM unnest(dll.secondary_categories) sc WHERE LOWER(sc) = LOWER($shelfName))
     OR LOWER(REPLACE(REPLACE(LOWER(dps.category), '[^a-z0-9 ]', ''), ' ', '-')) = LOWER($slug)
   )
   ```

2. **`GET /places`** (index, line 379): count each listing under every shelf it matches. Replace the `GROUP BY dps.category` aggregation with a `LATERAL` union of primary + secondaries:

   ```sql
   SELECT shelf_name, pc.slug, pc.id, pc.icon_emoji, pc.parent_id, pc.level, dps.city, dps.state
   FROM directory_presence_seeds dps
   JOIN directory_listings_list dll ON dll.id = dps.listing_id
   LEFT JOIN platform_categories pc ON LOWER(pc.name) = LOWER(dps.category)
   CROSS JOIN LATERAL (
     SELECT dps.category AS shelf_name
     UNION SELECT unnest(dll.secondary_categories)
   ) shelves(shelf_name)
   LEFT JOIN platform_categories pc2 ON LOWER(pc2.name) = LOWER(shelves.shelf_name)
   WHERE ...
   GROUP BY shelves.shelf_name, ...
   ```

   (Secondaries should also join `platform_categories` for slug/icon resolution; unregistered secondary names fall back to name-slug like the primary path does.)

3. **`GET /places/city/:citySlug`** (line 672): group each place under **every** matching shelf. Fetch secondaries in the row select (`dll.secondary_categories`), then in the grouping loop push the place into the primary group and every secondary group that resolves to a shelf. `total` stays listing-count (not shelf-membership-count) to keep pagination correct.

4. **`GET /places-map`** (line 771): category filter becomes `LOWER(dps.category) = LOWER($n) OR EXISTS (SELECT 1 FROM unnest(dll.secondary_categories) sc WHERE LOWER(sc) = LOWER($n))`.

### §3.3 Claim CTA incentive copy (personalized, honest)

**Data source**: `ClaimTokenSummary` already returns `primaryCategory` + `secondaryCategories` — the claim page can render the exact shelf list with zero new backend work.

**Copy rules (normative):**
- Say "every matching category shelf" — never a fixed count or "maximum exposure". Some businesses have one honest shelf (thin-shelf rule).
- Never promise a shelf the browse engine doesn't deliver. Phase 2 copy ships only after Phase 1 (or phrase copy strictly about the post-claim `/directory` surface, which already honors secondaries).
- Retain the disclosure sentence and "This is not an online store." framing on all surfaces.
- Do not promise shelves that would exist only for this business (no bespoke labels — vocabulary is enforced by the selector, but copy must not imply unlimited categories).

**Surface changes:**

1. **Claim page — valid state** (`apps/web/src/app/directory/claim/[token]/DirectoryClaimClient.tsx`):
   - Header (line ~717-720): render secondary category badges under the primary; add a shelf line when `summary.secondaryCategories.length > 0`:
     > Your listing will appear on {N} category shelves: {primary}, {secondary…}.
   - Update the invite alert (line 753-757) to append: "Claiming also lets you manage the categories your listing appears under — it can show up on every matching shelf."
2. **Claim success screen** (`DirectoryClaimClient.tsx` success block, after the product-allowance teaser at line 645): add a shelf-confirmation alert listing the accepted categories with links to each `/directory/categories/{slug}` shelf. Data: `claimResult`/`summary` categories.
3. **`UnclaimedDirectoryBanner`** (`apps/web/src/components/directory/UnclaimedDirectoryBanner.tsx`): add optional `secondaryCategories?: string[]` prop. When present, replace the static line with: "**{businessName}** is listed from public information. Claim to verify your details and appear on every matching category shelf." No secondaries → current copy unchanged.
4. **`PlaceEntryEditorialLayout`** (`apps/web/src/app/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx:274`): extend the existing incentive block with a category sentence beside the 5-products line.
5. **`PlaceCategoryClient`** (`apps/web/src/app/place/category/[categorySlug]/PlaceCategoryClient.tsx:375`): claim CTA subline — "Own this business? Claim it to keep it on this shelf and appear on every other shelf that matches."

### §3.4 Listing-page shelf cross-links (Phase 3)

Render shelf memberships as links on the listing page so crawlers discover every shelf placement from the listing itself:
- `PlaceEntryEditorialLayout` (unclaimed): render secondary categories as links to `/place/category/{slug}` next to the primary category chip.
- `/directory/[slug]` claimed layout: same, linking to `/directory/categories/{slug}`.
- Single listing URL is preserved — no per-category duplicate pages, no canonicalization risk.

### §3.5 Governance

- Owner category edits are constrained to `platform_categories` by the selector UI (no free text → no bespoke labels, per the category identification rules).
- Categories edited during a pending-approval claim are already visible to the operator in the claim review (the editor saves to the seed; the approval worksheet shows current values). Add "categories match the business" to the operator verification checklist copy.
- Post-claim edits flow through the existing Zod-validated tenant route (max 5 secondaries) — unchanged.
- Operator discipline (not code): a secondary belongs on a seed only if the shelf plausibly hosts more than one business in that market (directory-hosting rule). The composer's cap (6) stays.

### §3.6 SEO notes

- The listing URL is single (`/place/{slug}` → `/directory/{slug}` after claim). Shelves are the additive surfaces; each shelf page already carries enrichment metadata (CATEGORY_MARKET_ENRICHMENT_SPEC).
- Net shelf-count change from claiming must be ≥ 1: pre-claim the seed shows on its `/place` shelves; post-claim it shows on `/directory` shelves for the same categories. Phase 1 guarantees the `/place` side honors secondaries so the pre-claim state is never richer than the post-claim state.

---

## §4 Delivery Phases

### Phase 0 — Build hygiene (prerequisite, blocking)

`pnpm checkapi` currently fails (9 errors) and `pnpm checkweb` fails (4 errors) in the exact files this spec touches. Fix before Phase 1:

`apps/api/src/services/CategoryMarketEnrichmentService.ts` (6):
- 293, 301, 309 — `TS18047`: `opts.overrideDescription/overrideMetaTitle/overrideKeywords` possibly null at length checks (null-guard or narrow before `.length`).
- 355, 1105 — `TS2353`: `target` is not a property of the `audit()` payload type (`apps/api/src/audit.ts` — move the id into `payload` or extend the signature deliberately).
- 900 — `TS2345`: `city` is `string | null` at `normalizeReferenceCity(city)` (coalesce or guard).

`apps/api/src/services/DirectoryPresenceSeedService.ts` (3):
- 2407 — same `normalizeReferenceCity(city)` null case.
- 2460 — `SeedAuditCtx` missing `region` required by `RequestCtx` (extend the ctx type or construct a full `RequestCtx`).
- 2551 — `target` not in `audit()` payload type (same as above).

`apps/web/src/services/DirectoryPresenceAdminService.ts` (4):
- 1017, 1030, 1067, 1080 — `new Error(result.error || '...')` where `result.error` is `string | { status; message; code }`. Normalize with a typed helper (e.g., extract `message` when object) or narrow the service return type.

### Phase 1 — Browse engine honors secondaries (backend)

- Extract shared shelf-match helper; apply to the four endpoints in §3.2.
- Unit test the helper (registered category, unregistered fallback, secondary match, no match) — extend the directory presence public route tests.

### Phase 2 — Claim CTA incentive (frontend)

- Copy changes in the five surfaces in §3.3, gated on `secondaryCategories` presence (never render an empty shelf promise).
- Claim success screen shelf confirmation.

### Phase 3 — Polish

- `/places` index + `/places/city/:citySlug` grouping + `/places-map` filter (if not already in Phase 1).
- Listing-page shelf cross-links (§3.4).
- Optional: "Related shelves" cross-links on category pages from enrichment synonyms instead of thin secondaries.

---

## §5 Verification

```bash
pnpm checkapi
pnpm checkweb
```

Manual:
- Seed a listing with `secondary_categories = ['International Grocery Store']` and primary `African Grocery Store`; verify it renders on both `/place/category/african-grocery-store` and `/place/category/international-grocery-store` (with and without `?city=`).
- Verify `/places` index counts the listing under both categories; `/places/city/:city` groups it under both; `/places-map?category=` matches both.
- Open `/place/claim/:token`: header shows secondary badges + shelf line; success screen lists shelf links.
- `UnclaimedDirectoryBanner` renders category-aware copy only when secondaries exist; falls back cleanly.
- Claim a seed; verify the listing leaves `/place` shelves and appears on the matching `/directory/categories/*` shelves.

---

## §6 Non-Goals

- No schema migrations (secondaries already stored on `directory_listings_list`).
- No per-category duplicate listing pages; the listing URL stays single.
- No free-text category entry (vocabulary stays `platform_categories`-bound).
- No auto-derivation of secondaries beyond the existing composer caps (profile subcategories ≤ 6, tenant PATCH ≤ 5).
- No change to the claim flow's ownership verification.

## §7 Open Questions

1. Should the `/place` seed shelves and `/directory` shelves eventually merge into one browse surface post-claim (removing the `listing_origin = 'directory_seed'` split)? Out of scope here; flagged because it affects long-term shelf continuity claims in marketing copy.
2. Analytics: add `shelf_count` + `cta_surface` metadata to claim initiation events (BehaviorTrackingService) to measure whether the category incentive moves claim conversion? Cheap to add in Phase 2; decide at implementation.
