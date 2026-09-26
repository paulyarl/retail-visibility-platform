# Category Identification — Known-Category Vocabulary Injection — Spec

> The category-identification prompt instructs the analyst to match a business against "the platform's vocabulary of known categories" — but no vocabulary is ever injected. The analyst judges `is_known_category` blind, and every false negative mints a duplicate row into a different list than the one it should have matched.

**Status:** Implemented — vocabulary injection + act-flow backstop wired; seeds re-applied (local + prd)
**Owner:** TBD
**2026-09-26 alignment:** the block caught up with the enrichment treatment — a `PLATFORM GOAL` physical-shelves preamble, a third `ENRICHED CATEGORIES` section (`supplementLabels`: operator-typed categories that already name live enriched pages — previously dropped at the call site, so a candidate matching one was wrongly judged `is_known_category = false`), and one-prospect-across-shelves framing. `is_known_category` is now judged against **any** of the three lists. Seed re-applied (local + prd).
**Scope:** `apps/api` prompt render path + category-identification seed template

---

## 1. Overview

### 1.1 Problem

`mpt-seed-category-identification-001` ("Seek: Business Category Identification") takes a business name + location and returns ranked candidate categories. Its body contains this instruction:

> `=== KNOWN CATEGORIES ===`
> `The platform maintains a vocabulary of known categories. Where possible, match the business to an existing known category label. If no known category fits, propose a new label — the operator can register it with one click.`

The output schema carries a boolean per candidate, `is_known_category`. The analyst is therefore asked to assert whether a label exists in a vocabulary it never receives.

At render time, the only context injected into this prompt is the **location** block (`formatCategoryIdentificationMarketContext`) — city profile, market gaps, notable areas, metro dynamics, and the location enrichment's `top_categories` / `secondary_categories`. Those are *market* shelves from a single enrichment run, not the platform's label vocabulary. Two different concepts, one prompt.

### 1.2 Why it costs more than a wrong boolean

`is_known_category` is not inert. Step 1 of the category-identification act flow writes a new vocab row whenever it is false:

```
if (!parsed.is_known) {
  await MarketingServiceCategoryService.upsertCategory({
    value: categorySlug || categoryLabel,
    label: categoryLabel,
    isActive: true,
  }, ctx);
  categoryAdded = true;
}
```

So a correct answer of "Grocery Store" — a label that already exists in the directory vocabulary — returned as `is_known_category: false` creates a `grocery_store` row duplicating an existing directory category. Every false negative pollutes the vocabulary the analyst should have been shown, and the polluted list then feeds back into operator dropdowns.

The loop cannot converge: the prompt is asked to match a list it is not given, and its misses land in a different list than the one it should have matched.

### 1.3 Solution

Two complementary changes:

1. **Inject the known-category vocabulary** into the category-identification prompt at render time, alongside the existing location block, and reword the template so the analyst is told to judge `is_known_category` against it (§4.1–§4.5).
2. **Verify known-ness server-side in the act flow** before `upsertCategory`, so a wrong or stale `is_known` flag can no longer mint a duplicate row (§4.6). The analyst advises; the write path checks.

The injected list should be the **same union the operator dropdown already merges**, so the analyst and the operator are looking at the same shelves.

### 1.4 Design principles

- **Mirror the dropdown.** The injection should present exactly what `DirectoryCategorySelectorAdapter` presents to an operator, so `is_known_category` means the same thing on both sides.
- **Directory list, not GBP.** The directory vocabulary is the target. The GBP taxonomy belongs to the platform storefront and must not be injected — see §2.
- **Additive, not blocking.** If the vocabulary cannot be read, the block degrades to empty and the scan proceeds on general knowledge, matching the existing location block's behaviour.
- **Labels only.** Names, no descriptions, no slugs, no product counts.
- **Do not widen the prompt's remit.** This is a context injection, not a new instruction set. The template's existing ranking, population-test, and slot rules are unchanged.
- **Known-ness is a server-side fact.** `is_known_category` is an advisory hint to the operator; membership in the union is checked again at write time (§4.6) so stale audits and residual misses cannot write duplicates.

---

## 2. The three category lists (read this before writing code)

There are three distinct category stores in the platform. Conflating them is the single most likely way to get this wrong.

| List | Store | Rows | Consumer | In scope? |
|---|---|---|---|---|
| **Directory vocabulary** | `platform_categories` (where `is_active`) | **414** | Directory surfaces — tenant directory settings, admin presence-seeds, claim editor, campaign form, seed create/edit | **YES — this is the list to inject** |
| **GBP taxonomy** | GBP category source (mirrored by `platform-categories-seed.json`, `gcid:`-style names) | ~4000 | Platform storefront | **NO — out of scope** |
| **Registered label sink** | `mkt_service_categories_list` | small, grows | Marketing service packages (pricing/receipts) **and** the act-flow registration target | **YES — merge into the injection** |

### 2.1 Directory vocabulary — `platform_categories`

```
model platform_categories {
  id                 String    @id @default(dbgenerated("('cat_'::text || gen_random_uuid())"))
  name               String
  slug               String    @unique
  description        String?
  google_category_id String    @unique
  parent_id          String?
  level              Int?      @default(0)
  icon_emoji         String?
  sort_order         Int?      @default(0)
  is_active          Boolean?  @default(true)
  is_featured        Boolean?  @default(false)
  created_at         DateTime? @default(now()) @db.Timestamptz(6)
  updated_at         DateTime? @default(now()) @db.Timestamptz(6)
  gcid               String?
}
```

Verified live count: `select count(*) from platform_categories` → **414**.

**These rows are derived from the GBP taxonomy, but they are not the GBP taxonomy.** Both id columns are `gcid:`-prefixed, and `name` is the de-snake-cased, title-cased display form of the GBP label. Confirmed against a live row:

| Column | Sample value | Note |
|---|---|---|
| `name` | `Adult Dvd Store` | Title Case, spaces — **the injectable label** |
| `slug` | `adult-dvd-store` | kebab-case |
| `google_category_id` | `gcid:adult-dvd-store` | kebab-case GBP id |
| `gcid` | `gcid:adult_dvd_store` | snake_case GBP id (canonical taxonomy form) |
| `description` | `Adult Dvd Store - Business category for adult dvd store` | **auto-generated boilerplate** |
| `icon_emoji` | `🏬` | present on every row |
| `sort_order` / `level` / `parent_id` | `20` / `0` / `null` | hierarchical ordering exists; this row is a root |

Two consequences for the injection:

1. **`description` carries no information.** It is a mechanical template — `<Name> - Business category for <lowercased name>`. Do not inject it, and do not read it as editorial copy.
2. **What must be kept out of the prompt is the full GBP taxonomy, not this table.** The directory vocabulary is a *curated 414-row subset*, re-presented with human-readable names. It is the correct injection source; the ~4000-row GBP list backing the storefront is not.

`DirectoryCategorySelectorAdapter` names this list explicitly:

> `// The 414 directory categories are a starter list; every category-consuming surface`
> `// (seed create/edit, directory options, campaign form, claim editor) is a`
> `// discovery surface that may need to introduce a new category.`

**Server-side read (preferred):** query the table directly — do not go through the HTTP layer.

```ts
const rows = await prisma.platform_categories.findMany({
  where: { is_active: true },
  select: { name: true },
  orderBy: { name: 'asc' },
});
```

Order alphabetically by `name` — that is what the dropdown actually shows: `PlatformCategoryService.getCategories()` (the handler behind `GET /api/public/categories`, see §7.3) orders `name asc`, and `DirectoryCategorySelectorAdapter` re-sorts the merged options with `localeCompare(name)` regardless. The `[sort_order, name]` index exists, but `sort_order` drives no dropdown surface — do not order by it here.

**Casing:** inject `name` exactly as stored (`Adult Dvd Store`), not a normalized or uppercased form. The analyst should see the platform's own label. Match case-insensitively when deduping against the registered sink, but emit the directory list's casing.

`PlatformCategoryService.getInstance().getCategories()` also reads this table and is cached via `UniversalSingleton`, but it additionally runs an `inventory_items.groupBy` to compute product counts — irrelevant here and an unnecessary query per render. Use the lean query, with a short TTL cache mirroring `MarketContextLoader`'s 5-minute pattern.

### 2.2 GBP taxonomy — out of scope

The GBP taxonomy is the platform storefront's list. It must not be injected: its raw names are snake_case Google labels (e.g. `aadhar_center`, `abarth_dealer`), and injecting it would let the analyst match labels the directory cannot render as shelves.

Relationship to §2.1: the directory vocabulary is a curated, renamed **subset** of this taxonomy. Same lineage, different list. Inject the subset, never the source.

> **Trap:** `apps/api/src/data/platform-categories-seed.json` contains ~4034 GBP-style entries and looks like the directory seed. It is not the live directory vocabulary. The live `platform_categories` table holds 414 rows. Do not size or source the injection from that seed file.

### 2.3 Registered label sink — `mkt_service_categories_list`

`MarketingServiceCategoryService` reads/writes `mkt_service_categories_list`. The table is dual-purpose: it holds the marketing service packages used for pricing and receipts (with a 7-entry `HARDCODED_FALLBACK` in the service), **and** it is the target of the act flow's `upsertCategory` call for newly identified categories.

Because accepts land here, the dropdown merges this list with the 414. The injection must do the same, or the analyst will re-propose labels the operator can already select.

**Caveat — the sink is not all-categories.** The table has no `kind`/`type` column (only `value`, `label`, `is_active`), so service-package rows (e.g. "Google Business Profile Optimization") sit in the same list as analyst-registered niche labels. This is acceptable: the dropdown shows them too (mirroring principle holds — `is_known_category` means "selectable by the operator", not "is a taxonomy node"), but the injected copy must call them **registered labels**, never "categories", so the analyst is not told "Local SEO Package" is a directory shelf. Inject `label` only — `value` is a snake_case code, not a display label.

**Caveat — `listCategories()` rethrows.** `MarketingServiceCategoryService.listCategories()` catches, logs, and then `throw this.handleError(error, ctx)`. The vocab reader must wrap the call per-source: a sink failure must not take down the directory list.

---

## 3. Current render path

### 3.1 The injection point

`apps/api/src/services/MarketingExecutionService.ts`, in the category-identification seek branch (search for `outputSchemaName === 'category_identification'`):

```ts
if (isSeek && isBusinessScope && outputSchemaName === 'category_identification') {
  const campaignCity = (input.campaign as any).city || null;
  const campaignState = (input.campaign as any).state || null;
  let catIdMarketBlock = '';
  if (campaignCity && campaignState) {
    const locCtx = await MarketContextLoader.getInstance().loadLocationContext(
      campaignCity, campaignState, ctx,
    );
    catIdMarketBlock = formatCategoryIdentificationMarketContext(locCtx, campaignCity, campaignState);
    if (catIdMarketBlock) {
      logger.info('Location profile injected into category identification scan', ctx, { ... });
    }
  }
  return {
    renderedPrompt: this.appendPromptSuffix(
      baseRendered + (catIdMarketBlock ? '\n' + catIdMarketBlock : ''),
      promptSuffix,
    ),
    resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
  };
}
```

This branch runs **before** the `!hasCategory` early return, deliberately, so the location block is injected even though the campaign has no category. The vocabulary block belongs in the same branch, for the same reason: the vocabulary is category-agnostic.

### 3.2 The location block

`formatCategoryIdentificationMarketContext` lives in `apps/api/src/services/intelligence/MarketContextBindingFormatters.ts`. It emits `=== MARKET CONTEXT (from prior location enrichment) ===` with the city profile, market gaps, notable areas, metro dynamics, and:

- `TOP CATEGORIES (shelves already active in this market)`
- `SECONDARY CATEGORIES (additional active shelves)`

…and instructs the analyst to treat an active shelf as satisfying the population test "by construction."

**This is the source of the conflation.** Those lines are *market* shelves. The template's `KNOWN CATEGORIES` paragraph is about *platform* labels. An analyst reading both cannot tell which list `is_known_category` refers to.

### 3.3 The template

`apps/api/src/scripts/seed-category-identification-template.ts`:

```ts
variables: ['business_name', 'city', 'state'],
```

No vocabulary variable exists. The body's `=== KNOWN CATEGORIES ===` paragraph is unbacked.

---

## 4. Design

### 4.1 Injection source — mirror the dropdown union

Load the lists **independently** — each read is wrapped in its own try/catch so a failure of one source never takes down the others:

1. `platform_categories` where `is_active` → ~414 names, `orderBy name asc` (alphabetical — the dropdown's real presentation order; see §2.1)
2. `mkt_service_categories_list` where `is_active` → registered labels, `orderBy label asc`
3. Enrichment-ecosystem categories → `supplementLabels` (added 2026-09-26): `mkt_campaigns_list.category` + unnested `secondary_categories`, `directory_category_enrichment.category_name`, and `mkt_intelligence_profiles.category_name` (`status='active'`; `__`-prefixed sentinels excluded by key AND name — location packets reuse `directory_category_enrichment` with `category_key='__location__'`). These are operator-typed labels that already name live enriched category pages — `GET /api/public/directory/places` LEFT JOINs `platform_categories` and falls back to a name-derived slug — so a candidate matching one IS known even without a `platform_categories` row. `CategoryVocabularyService.isKnownLabel` already counted them toward the union; injecting them made the prompt agree with the backstop (§4.6).

The lists are rendered as **separate sections** (§4.2) that partition the union: a label matching an earlier list (case-insensitive, trimmed) is **excluded from later sections** — it is already covered. The directory list's casing always wins on overlap. The directory/registered partition is the same merge `DirectoryCategorySelectorAdapter` performs for the operator dropdown (`seen` set of `name.trim().toLowerCase()`, directory first); the supplement list dedupes against both.

`is_known_category = true` therefore means "the label appears in ANY section" — the same union the claim-side abuse gate uses (`DirectoryClaimService.applyOwnerVerification`, which computes `platform_categories ∪ mkt_service_categories_list` — note that query omits `is_active` on `platform_categories`; the new reader must include it to match the dropdown).

**Minimal variant:** if merging the sink list is undesirable for v1, inject `platform_categories` alone. The critical fix is that *some* real vocabulary reaches the prompt. Merging is recommended because it makes the two sides agree exactly.

### 4.2 Block format

New formatter alongside the existing ones in `MarketContextBindingFormatters.ts`: `formatKnownCategoryVocabulary(directoryLabels: string[], registeredLabels: string[], supplementLabels: string[] = []): string`. It shares the `partitionCategoryVocabulary` dedupe/partition helper with the enrichment formatter (`formatEnrichmentCategoryVocabulary`).

Shape (counts are dynamic — interpolate `directory.length`, never a literal 414):

```
=== KNOWN CATEGORY VOCABULARY (platform directory shelves) ===

PLATFORM GOAL: this directory exists to make the PHYSICAL SHELVES of
independent brick-and-mortar retailers visible to customers who walk
through the door. The vocabulary is therefore shelf-shaped by design —
the {N} canonical category labels below are the storefront categories
those retailers are shelved under, each a public directory page, not an
abstract taxonomy node.

Your candidate list propagates ONE prospect across shelves: the primary
candidate becomes its canonical shelf and every accepted secondary files
the same business on another public shelf. Choose labels for the shelves
they create, not just for how well they describe the business.

Judge `is_known_category` against the lists below — not against the market
shelves in the MARKET CONTEXT block (when that block is present). The two
are different:

  - MARKET CONTEXT top/secondary categories = shelves observed to be
    active in this city by a prior enrichment run. Use them for the
    population test.
  - KNOWN CATEGORIES = the platform's canonical directory shelves.
  - ENRICHED CATEGORIES = categories established by enrichment campaigns
    and intelligence profiles; each names a live category page in the
    ecosystem.
  - REGISTERED LABELS = operator- and analyst-added labels, including
    service packages that are not directory shelves.

If a candidate label appears in ANY list below, set is_known_category =
true; otherwise set it to false so the operator is prompted to register
it.

PRIMARY vs SECONDARY:
  - primary_category is the business's canonical shelf. Prefer a listed
    label whenever one fits — if your best-fit label is a close variant
    of a listed label (singular vs plural, word order, "Shop" vs
    "Store"), use the listed label. Propose a new primary label only
    when no listed label fits.
  - Secondary candidates file the same business on additional shelves:
    freely propose adjacent shelves, broader parent (super) categories,
    and narrower niche (sub) categories the business legitimately
    belongs on — including labels not in this list. Near-duplicate
    spellings of a listed shelf should still resolve to the listed
    label.

KNOWN CATEGORIES ({N}):
  <comma-separated labels, alphabetical — omitted when empty>

ENRICHED CATEGORIES ({N}) — established by enrichment campaigns
  and profiles; each names a live category page in the ecosystem:
  <comma-separated labels, alphabetical — only labels not already in KNOWN
  CATEGORIES or REGISTERED LABELS; the whole section is omitted when empty>

REGISTERED LABELS ({N}) — operator- and analyst-added, not all are directory shelves:
  <comma-separated labels, alphabetical — only labels not already in KNOWN
  CATEGORIES; the whole section is omitted when empty>
```

Wording constraints:

- **The market-block reference must be conditional.** The vocabulary is injected even when the campaign has no city (the MARKET CONTEXT block is then absent). Say "the MARKET CONTEXT block (when that block is present)" — not "the MARKET CONTEXT block above".
- **REGISTERED LABELS are not called categories.** The sink also holds marketing service-package labels (§2.3) — describe them as registered labels only.
- If all lists are empty, return `''` and log a warning — the template then falls back to its existing general-knowledge behaviour.

### 4.3 Placement

Append the vocabulary block **after** the location block, in the same branch, so the analyst reads market context first and the vocabulary second — the block's wording depends on that ordering to disambiguate the two lists.

```ts
const vocabBlock = formatKnownCategoryVocabulary(directoryLabels, registeredLabels, supplementLabels);
return {
  renderedPrompt: this.appendPromptSuffix(
    baseRendered
      + (catIdMarketBlock ? '\n' + catIdMarketBlock : '')
      + (vocabBlock ? '\n' + vocabBlock : ''),
    promptSuffix,
  ),
  resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' },
};
```

### 4.4 Template wording change

Replace the `=== KNOWN CATEGORIES ===` paragraph in `seed-category-identification-template.ts` with a pointer to the injected block:

```
=== KNOWN CATEGORIES ===
Where a KNOWN CATEGORY VOCABULARY block is present in this prompt, match the
business against its lists (KNOWN CATEGORIES, ENRICHED CATEGORIES, REGISTERED
LABELS) and set is_known_category accordingly. Where the block is absent,
fall back to general knowledge of common category labels.

Primary vs secondary: primary_category is the business's canonical shelf —
prefer a listed label whenever one fits and propose a new label only when no
listed label does. Secondary slots have more flexibility: freely propose
adjacent shelves, broader parent categories, and narrower sub-niches the
business legitimately belongs on, including labels outside the vocabulary —
mark those is_known_category = false and the operator can register them with
one click.
```

(The `ENRICHED CATEGORIES` list name was added 2026-09-26 alongside the supplement injection.)

The `=== DIRECTORY HOSTING CONTEXT ===` section also opens with the mission + propagation framing (added 2026-09-26): the platform exists to make the physical shelves of independent brick-and-mortar retailers visible to walk-in customers, and the candidate list propagates ONE business across shelves — so the mission framing survives even when the vocabulary block is absent (empty vocabulary → no block).

Add `known_categories` to the template's `variables` metadata array (informational — the actual injection is handled by the render path, mirroring the pattern used by `seed-profile-repair-issue-briefings.ts`).

### 4.5 Prompt budget

414 labels at roughly 8 tokens each ≈ 3-4k tokens. Acceptable. Constraints:

- labels only — no descriptions, slugs, emoji, or product counts
- one comma-separated list, alphabetical
- measured against the live DB (local): **414 directory + 10 registered labels → 9,447 chars ≈ ~2.4k tokens** (supplement labels add a small third list — same per-label cost)

If the directory list grows materially (say, past ~800 labels), revisit — consider injecting only labels whose first letter matches the business's name, or a two-pass approach (match, then confirm).

### 4.6 Server-side backstop in the act flow (do not trust the flag)

The prompt injection fixes the *analyst's* information problem, but the write path still trusts `is_known` blindly. Three residual pollution sources remain even with a perfect prompt:

1. **Stale audits.** Every `category_identification` audit recorded before this change carries `is_known_category` values judged against no vocabulary. Acting on one mints the same duplicate the spec exists to prevent — forever, because the flag is frozen in `audit_data`.
2. **Residual false negatives.** Even shown the list, the analyst can miss a near-variant.
3. **Operator-typed labels.** `allowCreateNew` surfaces let operators type arbitrary labels into downstream flows.

The fix is cheap because "is this label already in the vocabulary" is a *server-computable* fact — the endpoint does not need the analyst's opinion at all. Precedent already exists: `DirectoryClaimService.applyOwnerVerification` builds exactly this union (`platform_categories ∪ mkt_service_categories_list`, case-insensitive `LOWER()` match) to gate owner-proposed categories.

**Change `POST /:id/category-identification/act` step 1:**

```ts
let categoryAdded = false;
if (!parsed.is_known) {
  let alreadyKnown: boolean | null = null;
  try {
    alreadyKnown = await CategoryVocabularyService.getInstance().isKnownLabel(categoryLabel, ctx);
  } catch { /* lookup failed — fall back to trusting the flag (current behaviour) */ }
  if (alreadyKnown === true) {
    logger.info('Skipped vocab registration — label already in vocabulary', ctx, { campaignId, categoryLabel });
  } else {
    await MarketingServiceCategoryService.upsertCategory({ value: categorySlug || categoryLabel, label: categoryLabel, isActive: true }, ctx);
    categoryAdded = true;
  }
}
```

- Lookup failure falls back to the current flag-driven behaviour — the backstop can only *prevent* writes, never add new failure modes to the destination action.
- `category_added` in the response already reflects whether a row was written, so the audit card's "added to category vocab" hint stays accurate with no frontend change.
- `parsed.is_known` stays in the request schema (backward compatible) but becomes advisory.

**Edge — `value` collision on a different label.** `upsertCategory` keys on `value` (the slugified label). A genuinely-new label that slugifies to an existing service-package `value` (e.g. a proposed category "Website Audit" → `website_audit`) would *overwrite* that package's label. The label-membership check above does not catch this (labels differ). Rare, but worth a log line: when the slug already exists under a different label, log a warning — leave the upsert semantics unchanged for v1.

---

## 5. Implementation tasks

- [ ] Add `CategoryVocabularyService` (`apps/api/src/services/CategoryVocabularyService.ts`) — singleton `BaseService`, 5-minute TTL mirroring `MarketContextLoader`:
  - `loadVocabulary(ctx?)` → `{ directoryLabels: string[]; registeredLabels: string[]; supplementLabels: string[] }` — **independent** try/catch reads per source (`platform_categories` names `orderBy name asc`; `mkt_service_categories_list` labels via `MarketingServiceCategoryService.listCategories()`, which rethrows — catch locally; supplement union via `$queryRaw` across the enrichment ecosystem, `__`-sentinels excluded). Per-source failure degrades that source to `[]`, never throws.
  - `isKnownLabel(label, ctx?)` → boolean — case-insensitive trimmed membership over the union (drives the §4.6 backstop).
  - `resetCache()` for tests.
  - Do NOT reuse `PlatformCategoryService.getCategories()` as-is — its `inventory_items` groupBy is wasted work here.
- [ ] Add `formatKnownCategoryVocabulary(directoryLabels, registeredLabels, supplementLabels)` to `apps/api/src/services/intelligence/MarketContextBindingFormatters.ts` — dynamic counts, conditional market-block reference, registered/supplement sections pre-deduped against earlier lists, `''` when all empty.
- [ ] Wire both into the `outputSchemaName === 'category_identification'` branch of `MarketingExecutionService`, appended after the location block; log label counts on inject, warn on empty.
- [ ] Degrade to empty + warn per-source; never block the render.
- [ ] Add the §4.6 backstop to `POST /:id/category-identification/act` in `routes/marketing-ops.ts` (`isKnownLabel` check before `upsertCategory`; fail-open to flag behaviour on lookup error; warn on `value` collision with a different label).
- [ ] Update the `=== KNOWN CATEGORIES ===` paragraph in `seed-category-identification-template.ts`.
- [ ] Add `known_categories` to the template's `variables` metadata. Verified safe: the run UI derives inputs from `{{placeholder}}` matches in the body (not this array), and the only consumer of the array is the `includes('category')` guard in `executeSingle`/`renderPrompt`. It will be the only declared variable with no `{{placeholder}}` — metadata-only, documents the injected context.
- [ ] Update the `MarketContextInjection.test.ts` `vi.mock` factory for `MarketContextBindingFormatters` — it currently mocks only 2 of 3 exports (`formatCategoryIdentificationMarketContext` is already missing and latent); add it plus `formatKnownCategoryVocabulary`, and add a `vi.mock` for `CategoryVocabularyService`. New cat-id-branch tests crash on `undefined` otherwise.
- [ ] Re-run the seed against **both** configs per AGENTS.md: `doppler run --config local -- npx tsx src/scripts/seed-category-identification-template.ts` and again with `--config prd`.
- [ ] Verify the live template's `updated_at` is newer than the seed file's last commit (or regenerate `docs/api-response/seek-prompt-templates.md` via `dump-prompt-templates.ts`).
- [ ] `pnpm checkapi` + run the touched vitest files.

---

## 6. Verification

**Unit — formatter**

- Renders all sections with dynamic counts when all lists are present
- Renders the directory list alone when the other lists are empty; renders the supplement list alone likewise
- Returns `''` when all lists are empty
- Registered section excludes labels already in the directory list; supplement section excludes labels already in either earlier list (case-insensitive, trimmed) and preserves directory-list casing on overlap
- PLATFORM GOAL preamble and one-prospect-across-shelves framing are present
- Does not emit descriptions, slugs, or counts
- Counts are interpolated (`{N}`), not hardcoded
- Copy does not claim a MARKET CONTEXT block exists (campaign may have no city)

**Unit — vocabulary service**

- `loadVocabulary` returns all lists; per-source failure degrades that source to `[]` without throwing (mock `listCategories()` to reject — it rethrows by design)
- `isKnownLabel` matches case-insensitively on the trimmed union
- Cache serves repeat calls within the TTL; `resetCache()` clears

**Unit — render path**

- Business-scope seek with `output_schema = category_identification` renders the vocabulary block
- The block appears **after** the location block
- A campaign with no city still gets the vocabulary block (city is irrelevant to the vocabulary)
- Non-category-identification prompts are byte-identical to before

**Unit — act-flow backstop (§4.6)**

- `is_known: false` + label already in the union → no `upsertCategory` call, `category_added: false` in the response
- `is_known: false` + label not in the union → `upsertCategory` called, `category_added: true`
- `is_known: true` → `upsertCategory` never called regardless of union membership
- `isKnownLabel` lookup throws → falls back to flag behaviour (upsert proceeds when `is_known: false`)

**Manual runbook — end to end** (not CI-automatable: requires a real analyst run)

- Run the category-identification seek for a business whose true category is in the 414 and confirm `is_known_category: true` on that candidate
- Accept a candidate from a pre-change (stale) audit whose label is in the vocabulary but was flagged `is_known_category: false` → confirm no duplicate row is written (the §4.6 backstop catches it)
- Measure the rendered vocabulary block once and record the token count in the PR

**Regression**

- Confirm the location block's content and ordering are unchanged
- Confirm `resolution` metadata is unchanged
- Existing `MarketContextInjection.test.ts` still passes with the extended mock factory

---

## 7. Open questions

1. **Should accepts write to `platform_categories` instead of `mkt_service_categories_list`?**
   Arguably yes — a newly identified niche category that is meant to become a directory shelf belongs in the directory vocabulary, not in a table also used for marketing service packages. Blocked by a schema constraint: `platform_categories.google_category_id` is `String @unique` and **not nullable**, so a programmatic insert needs a synthetic value. The nullable `gcid` column alongside it looks like the decoupling seam someone already started. Out of scope for this spec; tracked here because it is the natural follow-on and would let the loop fully close.

2. **Which list should win on conflict?** If a label exists in both sources with different casing or wording, the spec says directory wins — now applied in two places: the formatter's registered-section dedupe (§4.1) and the `isKnownLabel` membership check (§4.6). Confirm that matches operator expectation.

3. ~~**Web read-path ambiguity (non-blocking).**~~ **RESOLVED (verified against code).** `GET /api/public/categories` is served by `public-catalog.ts` (`router.get('/categories')`, mounted at `/api/public` in `routeRegistry.ts`) → `PlatformCategoryService.getCategories()` → `platform_categories WHERE is_active ORDER BY name` — the 414-row directory vocabulary. The competing handler in `apps/api/src/routes/public/categories.ts` (storefront `categories` table + `HAVING COUNT(DISTINCT sp.id) > 0`) is **unmounted dead code** — it is not imported by `routeRegistry.ts` or `public-catalog.ts`. The duplicate `/api/public/categories` entry in `generated/route-map.json` is the `shops.ts` sub-router's `/categories` route flattened without its `/shops` mount prefix (real path: `/api/public/shops/categories`). The registered-label side of the merge comes from `MarketingOpsService.getServiceCategories()` (admin) with fallback to `GET /api/public/directory/category-vocab` — both read `mkt_service_categories_list`. "Mirror the dropdown" is therefore verified, not assumed.

4. **Should the vocabulary block also be injected into other category-consuming prompts?** Out of scope here. Flagged because the same blind-match problem may exist wherever a prompt reasons about category labels.

5. **`mkt_service_categories_list` has no kind discriminator.** Service packages and analyst-registered category labels share the table (§2.3). If a `kind`/`role` column is ever added, the registered-label read can filter to category labels and the §4.2 caveat goes away.

---

## 8. Non-goals

- Changing the GBP taxonomy or the platform storefront's category list
- Changing the category-identification output schema or the act-flow destinations
- Changing `is_known_category` semantics beyond supplying the list it was always meant to be judged against
- Auto-registering proposed labels without operator action
- Migrating `mkt_service_categories_list` or consolidating the three lists

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| GBP taxonomy injected by mistake | Source is `platform_categories` only; §2.2 records the seed-file trap explicitly |
| Prompt bloat as the vocabulary grows | Labels only; measure token count; revisit past ~800 labels (§4.5) |
| Analyst over-anchors on the list and stops proposing genuinely new labels | Block wording keeps the "propose a new label" path explicit |
| Stale list cached in memory | 5-minute TTL mirroring `MarketContextLoader` |
| Seed not re-run, so the live template still lacks the new wording | AGENTS.md seed-discipline task; verify `updated_at` |
| Two vocabularies still read as one | Block states the distinction from the MARKET CONTEXT block explicitly and depends on being rendered after it |
| Stale audits (recorded pre-injection) keep minting duplicate rows via `is_known: false` | §4.6 backstop: the act endpoint checks union membership server-side before `upsertCategory`; the flag becomes advisory |
| Analyst still misses a near-variant and the flag is wrong | Same backstop — the write path never trusts the flag for the dup check |
| Service-package labels in the sink read as "categories" to the analyst | §4.2 wording calls them registered labels only; they are legitimately part of the operator-selectable union |
| Registered-label slug collides with a service-package `value` and overwrites its label | Logged (warn) on collision in §4.6; upsert semantics unchanged for v1 |
| Vocabulary read fails mid-render | Per-source try/catch; empty source degrades to `[]`; both-empty → no block + warning; render never blocked |
