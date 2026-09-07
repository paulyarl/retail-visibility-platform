# Category Market Enrichment — Market-Level SEO + Operator Override Layer

Status: **DRAFT v2** — merged spec. Supersedes:
- CATEGORY_MARKET_ENRICHMENT_SPEC v1 (market-level enrichment)
- OPERATOR_ENRICHMENT_OVERRIDE_SPEC v1 (operator fine-tuning layer — merged in as §3.1 Layer 3, §3.6, §5.6, §6.5–§6.6, Phase 4)

Companion docs:
- `docs/LocalBiz/PLACE_SEED_SEO_ENRICHMENT_SPEC.md` (per-business composer — the building block this spec generalizes)
- `docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md` (the campaign type that establishes market intelligence)
- `docs/LocalBiz/PLATFORM_OFFERING_ARCHITECTURE.md` (establishment-before-discovery rule)

---

## §1 Summary

Today the directory surface has two enrichment gaps:

1. **Category pages** (`/place/category/[categorySlug]?city=...`) render pure boilerplate metadata — `"Browse African Grocery businesses listed on VisibleShelf from public information."` — regardless of whether an active intelligence profile exists for that category+city. The profile's synonyms, subcategories, schema.org type, and prohibited-keyword filtering are unused. `generateMetadata` does not read `searchParams` at all today, so even the boilerplate never varies by city.

2. **Tenant directory listings** (claimed tenants on `directory_listings_list` / `directory_settings_list`) have no write-back path from the marketing architecture. A campaign spawned from a listing can run its audit/enrichment work, but the composed description and keywords never flow back to the listing's `description` / `keywords` / `same_as` columns or the settings row's `seo_description` / `seo_keywords`. Only unclaimed seeds have the `directory_seed_campaign_links` + `syncFromCampaign` projection machinery.

This spec proposes a **market-level enrichment action** with three layers:

- **Level 1 — Category-page enrichment (market-level).** A composed description + keyword set for a `(category_key, city, state)` market, stored in a new `directory_category_enrichment` table, rendered by the category page's `generateMetadata` and visible copy.
- **Level 2 — Listing enrichment (per-business, market-powered floor).** For every listing (seed or tenant) in a market, run the composer with `audit: null` + the market's intelligence profile, and write the output to the listing's `description` / `keywords` columns. For tenant listings, also mirror to `directory_settings_list.seo_description` / `seo_keywords`.
- **Layer 3 — Operator override.** Operators fine-tune the composed floor on three surfaces (category page, seed listings, tenant listings). The composer always re-runs; the override persists across re-runs. Overrides are attributed, resettable, and never clobber owner-authored or audit-powered content.

Key insights:
- This is not a per-business operation. One intelligence profile enriches N listings simultaneously. The proving ground is the natural home for the operator surface because it is the campaign type that establishes the profile for a market.
- The composer is deterministic, so the composed floor is always recomputable — which makes "reset to composed" a re-composition, never a data-recovery problem.
- Owner-authored, audit-powered, and operator-overridden content are distinguished by **state records** (provenance source / enrichment log events), not by inspecting the text.

---

## §2 Current Architecture Analysis

### §2.1 What the composer already does

`SeedSeoComposer.buildSeedSeoPacket()` (`apps/api/src/services/directory/SeedSeoComposer.ts`) is a pure, deterministic, no-LLM function that accepts:

| Input | Required | Source |
|---|---|---|
| `campaign` (businessName, category, city, state, neighborhood, origin country/region, directory profiles, social profiles) | Yes | Campaign row or listing row |
| `audit` (storeFormat, googleAdditionalCategories, platformProfileUrls, publicNarrative) | No — null is valid | `mkt_audits_list` business_analysis audit |
| `intelligenceProfile` (synonyms, subcategories, prohibitedKeywords, schemaOrgType) | No — null is valid | `IntelligenceProfileService.resolve()` |
| `goldStandard` (expectedFieldNames) | No — null is valid | `IntelligenceProfileService.resolveGoldStandard()` |

When `audit` is null, the composer **degrades gracefully**:

- **Description**: deterministic template — `"{businessName} is a {categoryLabel} in {city}, {state}."` + disclosure sentence.
- **Keywords**: full power from the intelligence profile — synonyms, subcategories, city/state, neighborhood, origin country/region, gold-standard expected field names, prohibited-keyword filtering. Capped at 15 (`KEYWORDS_MAX`).
- **Secondary categories**: from profile subcategories (capped at 6).
- **Schema type hint**: from profile `schema_org_type` or the word-boundary inference table.
- **sameAs**: from campaign directory profiles / social profiles (empty when no audit).

The composer is **tenant-agnostic** — it doesn't know or care whether the input came from a seed, a campaign, or a listing row. Its guardrails (PLACE_SEED_SEO_ENRICHMENT_SPEC §4.4, normative): no Tier C fields (input type boundary), no claims from category vocabulary (keywords verbatim from profile fields only), no gold-standard/exemplar leakage, mechanical prohibited-keyword filtering, disclosure sentence retained in per-listing descriptions, one-way projection.

### §2.2 What exists for seeds (unclaimed)

The `directory_seed_campaign_links` bond + `DirectorySeedCampaignLinkService.syncFromCampaign()` provides:

- Per-field diff (campaign value vs. seed value)
- Operator-selected field projection
- Provenance rows (`directory_field_provenance`, unique on `(seed_id, field_key)`) with `source_name = 'linked_campaign'`, `confidence = 'high'`, `show_on_public = true`
- Auto-projection when NAP confidence is high
- The `description` projection case runs the composer with the campaign's audit + profile (`goldStandard: null` on this path — only `createFromCampaign` passes a gold standard)

This is **per-business** — one seed, one campaign, one sync. It requires a seed row and a link row.

### §2.3 What exists / is missing for tenant listings (claimed)

A claimed tenant has:
- `tenants` row (real customer, `org_standing_mode = 'independent'`)
- `directory_listings_list` row (with `description`, `keywords`, `same_as` columns)
- `directory_settings_list` row (with `seo_description`, `seo_keywords` columns)
- No `directory_presence_seeds` row, no `directory_seed_campaign_links` bond, no `directory_field_provenance` rows

The **owner-authored path already exists**: `PATCH /api/tenants/:id/directory/listing` (`apps/api/src/routes/directory-tenant.ts`) upserts `directory_settings_list` (`seo_description` max **500**, `seo_keywords` max **10** by existing Zod), mirrors to `directory_listings_list`, and refreshes the directory materialized views. It writes **no enrichment log row** — there is no record of who last wrote a tenant listing's SEO fields.

`DirectoryPresenceSeedService.createCampaignFromTenantListing()` (route: `POST /api/admin/directory/listings/:tenantId/spawn-campaign`) spawns a campaign but does not write back, and bonds nothing — the only linkage to the listing is free-text notes on the campaign. There is no join path from a tenant listing to "its" campaign's audit.

### §2.4 What's missing for category pages

The category page `generateMetadata` (`apps/web/src/app/place/category/[categorySlug]/page.tsx`) hardcodes:

```ts
title: `${categoryName} — Places Directory — VisibleShelf`
description: `Browse ${categoryName} businesses listed on VisibleShelf from public information.`
```

No intelligence profile lookup. No city context (`searchParams` is not read). No synonyms. No schema.org type. Every category page in every city reads identically except for the category name.

### §2.5 What the seed "Edit Sourced Fields" panel does and does not have

`PATCH /api/admin/directory-presence/presence-seeds/:id/fields` (`updateFieldsSchema` + `DirectoryPresenceSeedService.updateFields`) supports snapEBT, phone, website, hours, categories, address/NAP, slug — and arbitrary `provenanceUpdates[]` (upserted on `(seed_id, field_key)`). It does **not** have a `description` field: the schema, the service signature, and the panel UI cannot edit the listing description today. The seed detail page displays the `description` provenance row read-only. Adding operator description overrides (Layer 3) therefore requires adding a real `description` field to this schema, service, and panel — not just a label change.

---

## §3 Proposed Architecture

### §3.1 Three layers

**Level 1 — Category-page enrichment (market-level)**
**Level 2 — Listing enrichment (per-business, market-powered floor)**
**Layer 3 — Operator override** on three surfaces:
1. Category pages — override columns on `directory_category_enrichment`
2. Seed listings — `directory_field_provenance` rows with `source_name = 'operator_override'` (via the fields panel, extended per §2.5)
3. Tenant listings — `directory_settings_list` values + `directory_listing_enrichment_log` events with `trigger_source = 'operator_override'` (via a new admin endpoint)

Design principle: **the composer always re-runs; the override persists across re-runs.** Composed columns are always regenerated on enrichment; override state lives in separate columns / provenance rows / log events and takes precedence at render or is skipped at write.

### §3.2 Market identity and the trigger

**Market key: `(category_key, city, state)`.**

- `category_key` — normalized via `normalizeCategoryKey` (lowercase, hyphens/underscores → spaces). The category page's slug normalizes to the same form, so `/place/category/african-grocery` → `"african grocery"` matches profile `category_key` and the enrichment row.
- `city` — normalized via `normalizeReferenceCity` (title-cased) and matched case-insensitively against `directory_listings_list.city`.
- `state` — normalized via `normalizeReferenceState` (2-letter postal code). **Required.** City names are not unique across states (Springfield IL/MO, Portland OR/ME); a `(category, city)` key alone merges distinct markets. State also flows into `resolveGoldStandard`, which is state-aware.

v1 scopes every market row to a city+state. State-scoped and nationwide profiles (`reference_city = null`, per `mkt_intelligence_profiles.reference_state`) do **not** create market rows in v1; a future phase may relax the key (see §10, D2).

**The trigger.** Establishment campaigns import profiles as **drafts** (`importAsDraft` — explicitly does not activate). Activation is a separate operator action: `POST /api/admin/marketing-ops/intelligence-profiles/:id/:version/activate` → `IntelligenceProfileService.activateDraft()`. There is no campaign stage that promotes a profile. The enrichment trigger therefore fires **after a successful activation**, with these filters:

1. **Focus filter** — fire only when `profile.intelligence_focus !== 'gold_standards'`. Establishment profiles carry `'emerging'` or `'competitive'` focus; gold-standard profiles describe exemplar businesses and are excluded from SEO composition by the composer's own guardrails (PLACE_SEED spec §4.2). Without this filter, every gold-standard activation would enrich a market on the wrong profile type.
2. **Scope filter** — fire only when `reference_city` AND `reference_state` are both non-null (city-scoped profiles). City-agnostic or state-scoped activations log an info line and do not auto-fire (no v1 market row can represent them).
3. **First-activation-only** — fire only when no `directory_category_enrichment` row exists for the `(category_key, city, state)` market. Re-activations (new versions of the same profile) are effectively profile *updates* — those require a manual re-enrich (§10, D3), which keeps the automatic path predictable and avoids enrich-storms on version churn.

Two trigger paths:
1. **Automatic (post-activation hook)** — fire-and-forget after the `activateDraft` transaction commits; failure logs a warning and never rolls back activation (§5.3).
2. **Manual (operator action)** — "Enrich Market Listings" button on the proving-ground cockpit + `POST` endpoint, for re-running after profile updates or when new listings join the market.

**Profile resolution inside `enrichMarket`** (deterministic, never unfocused — an unfocused `resolve()` is nondeterministic across focuses and a leakage risk per PLACE_SEED §4.4.3):

```
resolveProfileForMarket(categoryKey, city, state):
  1. IntelligenceProfileService.resolve(categoryKey, 'competitive', city)   → active competitive profile
  2. IntelligenceProfileService.resolve(categoryKey, 'emerging', city)      → active emerging profile
  3. null → enrichment no-ops with reason 'no_active_profile'
```

Gold standard: `IntelligenceProfileService.resolveGoldStandard(categoryKey, null, city, state)` (cross-platform default; platform-specific gold standards are not needed for keyword hints).

### §3.3 What the enrichment action does

```
enrichMarket(categoryKey, city, state, opts, ctx)
  ├─ normalize inputs (normalizeCategoryKey / normalizeReferenceCity / normalizeReferenceState)
  ├─ profile = resolveProfileForMarket(...)            → null ⇒ return { skipped: 'no_active_profile' }
  ├─ goldStandard = resolveGoldStandard(categoryKey, null, city, state)
  ├─ category packet = buildCategorySeoPacket({ categoryKey, categoryName: profile.category_name,
  │     city, state, intelligenceProfile, goldStandard })          (§3.4)
  ├─ upsert directory_category_enrichment ON CONFLICT (category_key, city, state):
  │     ALWAYS refresh composed columns (meta_title, description, keywords,
  │     secondary_categories, schema_type_hint, intelligence_profile_id,
  │     gold_standard_profile_id, composer_version, enriched_at, enriched_by,
  │     trigger_source). NEVER touch override columns (operator_override_*,
  │     override_by, override_at) — the override persists across re-runs.
  ├─ find listings in market (case-insensitive exact match; no fuzzy matching — §10, D4):
  │     SELECT * FROM directory_listings_list
  │     WHERE LOWER(primary_category) = LOWER(profile.category_name)
  │       AND LOWER(city) = LOWER(market.city)
  │       AND state = market.state
  │       AND is_published = true
  │     (chunked, e.g. 200 per batch)
  ├─ for each listing — classify (§3.6):
  │     seed row exists (any status incl. claimed) ⇒ SEED path
  │     otherwise ⇒ TENANT path
  ├─ for each SEED listing:
  │     per field f in {description, keywords}:
  │       provenance row (seed_id, f).source_name:
  │         'operator_override'  ⇒ SKIP f (reason: operator_override)
  │         'linked_campaign'    ⇒ SKIP f (reason: linked_campaign — audit sync owns f)
  │         'market_enrichment'  ⇒ WRITE f (idempotent recompose)
  │         no row               ⇒ WRITE f (first enrichment)
  │     packet = buildSeedSeoPacket({ campaign: listingFields, audit: null,
  │                                   intelligenceProfile, goldStandard })
  │     on write: UPDATE directory_listings_list SET description, keywords
  │               UPSERT directory_field_provenance (seed_id, field_key)
  │                 source_name = 'market_enrichment', confidence = 'medium',
  │                 show_on_public = true, value = composed value
  │               UPDATE directory_presence_seeds.seo_enrichment
  │                 = buildSeoEnrichmentJson(packet)          (keeps seed JSON in sync — §7.1)
  ├─ for each TENANT listing:
  │     latest = latest directory_listing_enrichment_log row for listing_id (§3.6)
  │     per field f in {description, keywords}:
  │       latest.trigger_source = 'operator_override' AND latest.fields_values.f != null ⇒ SKIP f
  │       latest.trigger_source = 'owner_edit'        AND latest.fields_values.f != null ⇒ SKIP f
  │       latest is null / 'manual' / 'profile_activated' / 'operator_reset'
  │         OR latest.fields_values.f = null (owner/operator cleared it)   ⇒ WRITE f
  │     on write: UPDATE directory_listings_list SET description, keywords
  │               UPSERT directory_settings_list SET seo_description, seo_keywords
  │               APPEND directory_listing_enrichment_log row
  │                 (trigger_source = run trigger, fields_projected, fields_skipped,
  │                  skip_reasons, fields_values = composed values)
  └─ audit({ action: 'directory_market_enrichment.sync', payload: { market, counts, reasons } })
```

Notes:
- Market enrichment **never runs with an audit**. It is the floor, not the ceiling. Audit-powered content comes from the existing per-business sync (seeds) — which is why linked-campaign seeds are *skipped*, not recomposed with audit data. The audit-powered path for *tenant* listings is deferred (no bond table exists; §7.3).
- Market enrichment writes exactly `description` + `keywords`. It never writes `same_as` (no URL sources without an audit — writing an empty array would clobber linked-campaign values) and never writes `secondary_categories` (operator/audit-managed; §10, D8).

### §3.4 Category-page composition (no business name)

New composer export (§5.2): `buildCategorySeoPacket()`. It reuses the keyword / schema-type / secondary-category composition and adds two normative templates:

**`metaTitle`** (70-char cap, word-boundary truncation):

```
{CategoryName} in {City}, {State} — VisibleShelf Places
```

**`description`** (300-char cap) — market-level browse framing, **no disclosure sentence** (the category page is a browse page; the disclosure lives on each listing — guardrail carve-out §3.7.5):

```
Browse {CategoryName} businesses in {City}, {State}, listed on VisibleShelf from public information.[ Related: {s1}, {s2}, {s3}.]
```

- The optional `Related:` sentence lists **verbatim profile synonyms** (prohibited-filtered, deduped, max 3, each ≤ 60 chars) as browse hints. The template never generates claims about the businesses ("offering X", "specializing in X" are prohibited — guardrail §3.7.2 applies to market-level copy too).
- `CategoryName` comes from `mkt_intelligence_profiles.category_name` (human-readable), not the slug.

**Keywords / schema type / secondary categories** — same composition as the per-business composer with a synthetic market input (`category`, `city`, `state`; no businessName, neighborhood, or origin fields).

The packet type is a dedicated `CategorySeoPacket` (no `sameAs`, no `auditId` — those are meaningless at market level):

```ts
export interface CategorySeoPacket {
  metaTitle: string;
  description: string;
  keywords: string[];
  secondaryCategories: string[];
  schemaTypeHint: string | null;
  inputs: { intelligenceProfileId: string | null; goldStandardProfileId: string | null };
  composerVersion: number;
}
```

### §3.5 Listing composition (profile-only, no audit)

For every listing, the composer runs with `audit: null`:

- **Description**: `"{businessName} is a {categoryLabel} in {city}, {state}."` + disclosure
- **Keywords**: full profile-powered set (synonyms, subcategories, city/state, schema.org type, gold-standard field-name hints)
- **sameAs / secondary categories**: not written (§3.3 note)

Listings with a linked campaign that has a business_analysis audit are **skipped** for `description`/`keywords` — the existing `syncFromCampaign` path produces the richer, audit-powered output and owns those fields (guardrail §3.7.8).

### §3.6 State & provenance model (unified)

**Seeds — provenance row as per-field current state.** `directory_field_provenance` is unique on `(seed_id, field_key)`; the row's `source_name` *is* the state:

| Source precedence | Meaning |
|---|---|
| `operator_override` | Operator's text — highest; all machine writers skip |
| `linked_campaign` | Audit-powered composed text; market enrichment skips |
| `market_enrichment` | Profile-powered floor; re-enrich overwrites (idempotent) |
| *(no row)* | Not yet enriched |

- Confidence: `operator_override` = `high`, `linked_campaign` = `high`, `market_enrichment` = `medium`. Precedence is **source-based**, never confidence-compared.
- Attribution: migration 265 adds `override_by` + `override_at` (nullable) to `directory_field_provenance` — set when `source_name = 'operator_override'`, null otherwise (`updated_at` alone is a timestamp, not attribution).
- **Claimed seeds** keep the seed path regardless of claim status. Classification is "a `directory_presence_seeds` row exists for the listing" — NOT `listing_origin` (which stays `'directory_seed'` after claim). A claimed seed has both a seed row and a tenant relationship; the seed machinery (provenance rows, guardrails) continues to own its SEO fields.
- Reset (§5.6) recomposes and upserts the row back to `market_enrichment`, clearing `override_by`/`override_at`.

**Tenant listings — append-only event log, latest-row-wins.** `directory_listing_enrichment_log` is an **append-only history**; the latest row per `listing_id` is the current state. `trigger_source` event types (CHECK-enforced):

| `trigger_source` | Event | Guard behavior on next enrich |
|---|---|---|
| `manual` / `profile_activated` | Market enrichment run | fields with non-null `fields_values` are re-composed (idempotent) |
| `operator_override` | Operator wrote override values | fields with non-null values are skipped |
| `operator_reset` | Operator reset → service recomposed immediately | treated as machine-written (re-enrichable) |
| `owner_edit` | Owner edited via `PATCH /api/tenants/:id/directory/listing` (new stamping, §5.7) | fields with non-null values are skipped; **null values mean the owner cleared the field → re-enrichable** |

Every event row carries `fields_values` (`{description, keywords}` actually written — null for skipped) so each row is a self-contained audit record; rows are never deleted (reset appends `operator_reset`, it does not delete the override row).

**Category page — separate composed and override columns.** `directory_category_enrichment` always holds the composed packet; `operator_override_description` / `operator_override_meta_title` / `operator_override_keywords` (+ `override_by` / `override_at`) hold the override. Render resolution: `override ?? composed` per field. Enrichment refreshes composed columns and never touches override columns.

### §3.7 Guardrails (normative)

Inherited from the composer (PLACE_SEED_SEO_ENRICHMENT_SPEC §4.4):
1. No Tier C fields in any output (enforced by input type boundary).
2. No claims from category vocabulary — keywords are verbatim from profile fields only; the composer never generates new keyword strings. **Market-level copy follows the same rule** — the `Related:` sentence is verbatim synonyms as browse hints, never inventory claims.
3. No gold-standard language or exemplar leakage — market enrichment resolves profiles with an explicit non-`gold_standards` focus (§3.2).
4. Mechanical prohibited-keyword filtering.
5. Disclosure sentence retained in **per-listing** descriptions. **Carve-out:** the category-page packet omits the disclosure (browse page; disclosure lives on each listing). Operator overrides on listings get the disclosure **appended at write time** (§5.6) — it is non-negotiable and the override UI previews the final text.
6. One-way projection (intelligence → listing, never reverse).

Market-enrichment guardrails:
7. **Never overwrite operator overrides.** Seed: provenance `source_name = 'operator_override'` → skip the field. Tenant: latest log event `operator_override` with non-null value → skip the field. Category page: override columns are never touched by enrichment.
8. **Never overwrite audit-powered content.** Seed: provenance `source_name = 'linked_campaign'` → skip the field (linked-campaign sync owns it).
9. **Never overwrite owner-authored content.** Tenant: latest log event `owner_edit` with non-null value → skip the field. Additionally, an operator override **attempt** on an owner-authored tenant listing is rejected (409 `owner_authored`, §5.6) rather than stored dormant.
10. **Idempotent composition.** Re-running enrichment for the same market + profile produces byte-identical composed output. Provenance rows upsert in place (no duplicates). The tenant log is append-only by design — each run is an event; "no duplicate rows" means no duplicate *state*, not no history.
11. **State-keyed markets.** `(category_key, city, state)` — city-only keys are ambiguous across states.
12. **Market enrichment never runs with an audit and never writes `same_as` or `secondary_categories`.**

---

## §4 Schema — Migration 265

`database/migrations/265_category_market_enrichment.sql`. All tables and columns ship in this one migration (including the override layer — nothing is implemented yet, so no later ALTERs). Idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`). After applying: `doppler run --config local -- pnpm prisma db pull` + `pnpm prisma generate` (per AGENTS.md — no hand-edited `schema.prisma`).

### §4.1 `directory_category_enrichment`

```sql
CREATE TABLE IF NOT EXISTS directory_category_enrichment (
  id                              text PRIMARY KEY,
  -- Market key (§3.2). City+state required in v1.
  category_key                    text NOT NULL,
  category_name                   text NOT NULL,             -- display label from profile.category_name
  city                            text NOT NULL,
  state                           text NOT NULL,             -- 2-letter postal code
  -- Composed packet (always refreshed by enrichMarket; §3.4 templates)
  meta_title                      text,
  description                     text,
  keywords                        text[] NOT NULL DEFAULT '{}',
  secondary_categories            text[] NOT NULL DEFAULT '{}',
  schema_type_hint                text,
  -- Operator override layer (never touched by enrichMarket; §3.6)
  operator_override_description   text,
  operator_override_meta_title    text,
  operator_override_keywords      text[],
  override_by                     text,
  override_at                     timestamptz,
  -- Composer provenance
  intelligence_profile_id         text,
  gold_standard_profile_id        text,
  composer_version                int  NOT NULL DEFAULT 1,
  -- State
  enriched_at                     timestamptz NOT NULL DEFAULT now(),
  enriched_by                     text,                      -- operator id (activating operator for auto-trigger)
  trigger_source                  text NOT NULL DEFAULT 'manual'
                                  CHECK (trigger_source IN ('manual', 'profile_activated')),
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_key, city, state)
);
CREATE INDEX IF NOT EXISTS idx_dce_markets
  ON directory_category_enrichment (category_key, state, city);
```

### §4.2 `directory_listing_enrichment_log`

```sql
CREATE TABLE IF NOT EXISTS directory_listing_enrichment_log (
  id                       text PRIMARY KEY,
  tenant_id                text NOT NULL,
  listing_id               text NOT NULL,
  category_key             text NOT NULL,
  city                     text NOT NULL,
  state                    text NOT NULL,
  fields_projected         text[] NOT NULL DEFAULT '{}',
  fields_skipped           text[] NOT NULL DEFAULT '{}',
  skip_reasons             jsonb,                      -- { field: reason }
  fields_values            jsonb,                      -- { description, keywords } actually written (null per skipped field)
  intelligence_profile_id  text,
  composer_version         int  NOT NULL DEFAULT 1,
  enriched_at              timestamptz NOT NULL DEFAULT now(),
  enriched_by              text,                       -- operator id; null for owner_edit events (owner identity is the tenant)
  trigger_source           text NOT NULL
    CHECK (trigger_source IN ('manual', 'profile_activated', 'operator_override', 'operator_reset', 'owner_edit')),
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- latest-row-per-listing state lookups (§3.6) + badge queries (§6.4)
CREATE INDEX IF NOT EXISTS idx_dlel_listing_latest
  ON directory_listing_enrichment_log (listing_id, enriched_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlel_tenant
  ON directory_listing_enrichment_log (tenant_id, enriched_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlel_market
  ON directory_listing_enrichment_log (category_key, city, state, enriched_at DESC);
```

Append-only history; latest row per `listing_id` is the state (§3.6). No UNIQUE on `(tenant_id, listing_id)` — rows are events, never deleted.

### §4.3 `directory_field_provenance` — attribution columns

```sql
ALTER TABLE directory_field_provenance
  ADD COLUMN IF NOT EXISTS override_by text,
  ADD COLUMN IF NOT EXISTS override_at timestamptz;
```

Nullable; set only on `source_name = 'operator_override'` rows.

### §4.4 `directory_listings_list` — market-scan index

```sql
CREATE INDEX IF NOT EXISTS idx_dll_market_scan
  ON directory_listings_list (LOWER(primary_category), LOWER(city), state)
  WHERE is_published;
```

### §4.5 ID prefix

`cme-` for `directory_category_enrichment` ids, `dlel-` for log ids — add `generateCategoryMarketEnrichmentId` / `generateListingEnrichmentLogId` to `apps/api/src/lib/id-generator.ts` (house style: `dll-`, `dps-`, `dfp-`, `dscl-` precedents).

---

## §5 Backend

### §5.1 New service: `CategoryMarketEnrichmentService`

Location: `apps/api/src/services/CategoryMarketEnrichmentService.ts` — singleton (`getInstance()`, house style), extends `BaseService`.

```ts
class CategoryMarketEnrichmentService {
  /** Run market enrichment (§3.3). Returns counts + skip reasons. */
  async enrichMarket(
    category: string, city: string, state: string,
    opts: { triggerSource?: 'manual' | 'profile_activated'; enrichedBy?: string },
    ctx?: RequestCtx,
  ): Promise<{
    marketKey: { categoryKey: string; city: string; state: string };
    categoryEnrichmentId: string | null;      // null ⇒ no_active_profile no-op
    listingsEnriched: number;
    listingsSkipped: number;
    skipReasons: Record<string, number>;       // reason → count
  }>;

  /** Effective + composed + override state for one market (admin). */
  async getMarket(categoryKey: string, city: string, state: string): Promise<MarketState | null>;

  /** All enriched markets (admin list page). */
  async listMarkets(limit?: number, offset?: number): Promise<MarketRow[]>;

  /** Enrichment log events for a tenant listing (admin). */
  async listEnrichmentLog(tenantId: string, limit?: number): Promise<LogRow[]>;

  /** Override / reset the category-page packet (§5.6). */
  async overrideMarket(categoryKey: string, city: string, state: string,
    input: OverrideMarketInput, ctx?: RequestCtx): Promise<MarketState>;

  /** Operator override of a tenant listing's SEO (§5.6). Throws 409 owner_authored. */
  async overrideTenantSeo(tenantId: string, input: OverrideTenantSeoInput, ctx?: RequestCtx): Promise<void>;

  /** Reset a tenant listing field(s) → immediate recompose (§5.6). */
  async resetTenantSeo(tenantId: string, fields: ('description' | 'keywords')[], ctx?: RequestCtx): Promise<void>;

  /** Recompute the composed packet for one seed (fields-panel reference + reset). */
  async recomposeSeed(seedId: string, ctx?: RequestCtx): Promise<SeedComposedState>;

  /** Reset a seed field override → recompose + upsert provenance back to market_enrichment. */
  async resetSeedOverride(seedId: string, fields: ('description' | 'keywords')[], ctx?: RequestCtx): Promise<void>;
}
```

### §5.2 Composer extension: `buildCategorySeoPacket`

Add to `apps/api/src/services/directory/SeedSeoComposer.ts`:

```ts
export function buildCategorySeoPacket(input: {
  categoryKey: string;
  categoryName: string;          // display label (profile.category_name)
  city: string;
  state: string | null;
  intelligenceProfile: IntelligenceProfileSeoFields | null;
  goldStandard: GoldStandardSeoFields | null;
}): CategorySeoPacket;
```

Normative templates in §3.4. Same keyword / schema-type / secondary-category composition as `buildSeedSeoPacket` (shared helpers, no duplication). Same `composerVersion` constant. No `businessName`, no disclosure, no `sameAs`.

### §5.3 Trigger hook: `activateDraft`

In `IntelligenceProfileService.activateDraft()` (or the route, immediately after) — after the transaction commits:

```ts
try {
  const p = result as any;
  if (p.intelligence_focus !== 'gold_standards' && p.reference_city && p.reference_state) {
    const existing = await this.prisma.$queryRaw`
      SELECT 1 FROM directory_category_enrichment
      WHERE category_key = ${p.category_key}
        AND city = ${normalizeReferenceCity(p.reference_city)}
        AND state = ${p.reference_state} LIMIT 1`;
    if (!existing[0]) {
      await CategoryMarketEnrichmentService.getInstance().enrichMarket(
        p.category_key, p.reference_city, p.reference_state,
        { triggerSource: 'profile_activated', enrichedBy: ctx?.userId ?? null },
        ctx,
      );
    }
  }
} catch (err) {
  logger.warn('post-activation market enrichment failed (non-blocking)', ctx, {
    error: (err as Error).message,
  });
}
```

- `enrichedBy` passes the **activating operator's id** through (not null) for auditability.
- Gold-standard activations, city-agnostic/state-scoped activations, and re-activations of an already-enriched market do not auto-fire (filters §3.2). All are available via manual trigger.

### §5.4 Admin routes — one new router

New file `apps/api/src/routes/category-enrichment-admin.ts`, mounted in `routeRegistry.ts` at **`/api/admin/directory/category-enrichment`** (authLevel `admin`, auth in routes; local `requirePlatformStaff` middleware admitting `PLATFORM_ADMIN | PLATFORM_SUPPORT | PLATFORM_VIEWER`, `requirePlatformAdmin` for writes — same pattern as `directory-presence-admin.ts`).

Naming note: do NOT name anything `directory-enrichment-*` — `directory-enrichment-public.ts` already exists for an unrelated lead-gen "enrich" flow. The `/api/admin/directory/...` path family is shared (multiple routers may mount under one prefix; precedent: three routers under `/api/public/directory`).

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/admin/directory/category-enrichment/markets` | PLATFORM_ADMIN | Trigger enrichment — body `{ category, city, state }` |
| `GET  /api/admin/directory/category-enrichment/markets` | PLATFORM_STAFF | List enriched markets (admin page) |
| `GET  /api/admin/directory/category-enrichment/markets/:categoryKey/:city/:state` | PLATFORM_STAFF | Market state: composed + override + effective + profile info |
| `PATCH /api/admin/directory/category-enrichment/markets/:categoryKey/:city/:state` | PLATFORM_ADMIN | Category-page override / reset (§5.6) |
| `GET  /api/admin/directory/category-enrichment/listings/:tenantId/seo` | PLATFORM_STAFF | Tenant SEO state for the Edit SEO modal (composed recomputed + effective + latest event + ownerAuthored flag) |
| `PATCH /api/admin/directory/category-enrichment/listings/:tenantId/seo` | PLATFORM_ADMIN | Tenant SEO override / reset (§5.6) |
| `GET  /api/admin/directory/category-enrichment/listings/:tenantId/log` | PLATFORM_STAFF | Enrichment log events |
| `POST /api/admin/directory/category-enrichment/seeds/:seedId/compose` | PLATFORM_STAFF | Recompute the seed's composed packet (fields-panel reference) |
| `POST /api/admin/directory/category-enrichment/seeds/:seedId/reset` | PLATFORM_ADMIN | Reset seed override → recompose (§5.6) |

### §5.5 Public endpoint — category page

In `apps/api/src/routes/directory-presence-public.ts` (the existing home of the places browse routes):

```
GET /api/public/directory/category-enrichment?category=<slug-or-key>&city=<city>&state=<ST>
```

- `category` accepts the page slug or raw category — normalized via `normalizeCategoryKey` server-side. `city` normalized via `normalizeReferenceCity`; `state` via `normalizeReferenceState`.
- **`state` is optional on this endpoint.** Today's category-page URLs carry only `?city=` — `generateMetadata` runs before any client data loads and has no state source. When `state` is omitted, the endpoint resolves all market rows for `(category_key, city)` and returns the **unique** match; if zero or multiple markets exist (a city name spanning states), it returns `{ market: null }` and the page falls back to boilerplate. When `state` is provided, it must match exactly. The city filter chips should append `&state=` to their links (from the listings' `state` field) so multi-state cities resolve unambiguously.
- Missing/invalid `city` ⇒ `{ market: null }` (v1 has no city-agnostic resolution; the page falls back to boilerplate).
- Response DTO:

```json
{
  "market": { "categoryName": "African Grocery", "city": "Indianapolis", "state": "IN" },
  "effective": {
    "metaTitle": "...", "description": "...", "keywords": ["..."],
    "schemaTypeHint": "GroceryStore", "secondaryCategories": ["..."],
    "synonyms": ["west african foods", "east african foods"]
  },
  "overridden": { "description": false, "metaTitle": false, "keywords": false },
  "enrichedAt": "2026-09-07T00:00:00Z"
}
```

- `effective` = override ?? composed per field. `synonyms` (prohibited-filtered, max 6) power the browse-hint chips — distinct from `keywords` (capped at 15, deduped, lowercased).
- No enrichment row ⇒ `{ "market": null }` (200) — the frontend falls back to today's boilerplate. No error status for misses.
- Response wraps follow the double-wrap contract (`result.data?.data ?? result.data` on the web side).

### §5.6 Override endpoints — normative behavior

**Category page** — `PATCH .../markets/:categoryKey/:city/:state`, PLATFORM_ADMIN. Body (all optional):

```json
{
  "operator_override_description": "…",      // ≤ 1000 chars
  "operator_override_meta_title": "…",       // ≤ 70 chars
  "operator_override_keywords": ["…"],       // ≤ 15 items
  "reset_description": false, "reset_meta_title": false, "reset_keywords": false
}
```

- `reset_*` sets the corresponding override column to null — the page immediately falls back to composed (composed columns are always populated; no recompose needed).
- Sets `override_by` / `override_at` on any write. Audits via `audit({ action: 'directory_enrichment.operator_override', ... })`.
- **No disclosure handling** — the category-page packet has no disclosure (§3.4).

**Tenant listing** — `PATCH .../listings/:tenantId/seo`, PLATFORM_ADMIN. Body:

```json
{
  "seo_description": "…",        // ≤ 500 chars (matches the owner path cap)
  "seo_keywords": ["…"],         // ≤ 10 items (matches the owner path cap)
  "reset_description": false, "reset_keywords": false
}
```

- **Owner-wins rule:** if the latest log event for the listing is `owner_edit` with a non-null value for a field being overridden → **409 `owner_authored`** with an explanatory payload. The override is rejected, not stored dormant (decision D6, §10). The UI shows the owner-authored state and the warning before submit.
- On write: the disclosure sentence is **appended at write time** to `seo_description` (single append — the stored value is the final text; the UI preview shows body + disclosure). Writes `directory_settings_list.seo_description` / `seo_keywords`, mirrors to `directory_listings_list.description` / `keywords`, appends an `operator_override` log event (with `fields_values`).
- `reset_*` → **immediate recompose** (decision D7): the service recomposes the field(s) with the current market profile, writes the composed values, and appends an `operator_reset` event (with `fields_values` = composed values). Never deletes rows; the listing never goes dark.
- Audits via `audit({ action: 'directory_enrichment.operator_override' | 'directory_enrichment.operator_reset', ... })`.

**Seed listing** — no new write endpoint. The existing `PATCH /api/admin/directory-presence/presence-seeds/:id/fields` is extended (§5.7) with a `description` field; the operator passes `provenanceUpdates` with `fieldKey: 'description' | 'keywords'`, `sourceName: 'operator_override'`, `confidence: 'high'`, `showOnPublic: true`. Disclosure appended at write time (same rule as tenant). Reset is `POST .../seeds/:seedId/reset` (PLATFORM_ADMIN) — recompose + upsert provenance back to `source_name = 'market_enrichment'` (clearing `override_by`/`override_at`), audited.

### §5.7 Existing-flow changes (guards + stamping)

1. **`DirectorySeedCampaignLinkService.syncFromCampaign`** — the `description` (and `keywords`) projection cases must first check the current provenance row's `source_name`; if `'operator_override'` → skip the field (record in `skipped`). Without this, a later linked-campaign sync would silently clobber an operator override (provenance is one current-state row per `(seed_id, field_key)`).
2. **`directory-tenant.ts` `PATCH /:id/directory/listing`** (owner path) — fire-and-forget append of an `owner_edit` log event whenever the patch includes `seo_description` / `seo_keywords` (with `fields_values` reflecting the new values, null when cleared). This is what makes "owner-authored" detectable at all — the column is shared between owner and machine writers; the log is the only discriminator. Failure to log is non-blocking (warn).
3. **`DirectoryPresenceSeedService.updateFields` + `updateFieldsSchema`** — add `description?: string` (≤ 500 chars): writes `directory_listings_list.description` alongside the existing provenance upsert machinery. The seed detail panel gains the textarea (§6.6).
4. **`IntelligenceProfileService.activateDraft`** — the §5.3 hook.

---

## §6 Frontend

### §6.1 Category page — `generateMetadata` upgrade

`apps/web/src/app/place/category/[categorySlug]/page.tsx`:

- `generateMetadata` reads **both** `params` and `searchParams` and calls the public category-enrichment endpoint with `(categorySlug, city, state?)` — `state` from `?state=` when present, otherwise relying on the endpoint's unique-match resolution (§5.5). Server pages calling public services have precedent: `apps/web/src/app/g/[shortCode]/page.tsx`.
- If `market` found: use effective `metaTitle` / `description` / `keywords` (override ?? composed).
- If not: fall back to current boilerplate — **now including the city** when present (fixes the today-ignored `searchParams`).
- The city filter chips in `PlaceCategoryClient` append `&state=` (from the loaded listings' `state` field) so multi-state cities resolve unambiguously on subsequent navigations.

### §6.2 Category page — visible copy

`PlaceCategoryClient.tsx`:

- Render the effective description as an intro paragraph above the listing grid.
- Render `synonyms` as browse-hint chips ("Related: West African foods, East African foods").
- Render schema.org JSON-LD: **`CollectionPage`** (decision D9) with the effective description; `schemaTypeHint` applies to listing-level JSON-LD, not the page node.

### §6.3 Proving-ground cockpit — enrich action + status

On the **proving-ground cockpit** `/settings/admin/marketing-ops/proving-grounds/[id]` (`ProvingGroundCockpitClient.tsx` — keyed by campaignId, the operator action surface for the market):

- "Enrich Market Listings" button — calls `POST .../markets` with the campaign's `(category, city, state)`; visible when `campaign_category = 'proving_ground'`; shows the result (N enriched, N skipped, reasons).
- Phase 5 adds the "Enrichment Status" section: market row state (composed + override + timestamps + profile id/version), "Edit Override" link to the markets page, "Re-enrich" button, and listing counts (composed / operator-overridden / owner-authored / audit-powered).
- An "Enrich Market" affordance is also added to the Intelligence Profiles page next to Activate (where the automatic trigger actually fires).

### §6.4 Directory listings admin — badge, re-enrich, Edit SEO

On `/settings/admin/directory/listings` (`DirectoryListingsTable` — row actions Feature / Spawn Campaign / View already exist):

- "SEO enriched" badge when a recent log event exists; tooltip = last event type + date + profile.
- "Re-enrich" row action → `POST .../markets` with the listing's category+city+state.
- "Edit SEO" row action (Phase 4) → modal: composed description (recomputed reference, read-only), owner-authored state + warning (submit disabled with explanation when owner-authored), override description textarea (500 chars, live preview with appended disclosure), override keywords tag input (≤ 10), "Reset to composed" (with confirm), Save/Cancel.

### §6.5 Markets admin page (Phase 4)

`/settings/admin/directory/category-enrichment/markets` — table of enriched markets (category, city, state, enriched_at, override status); detail panel: composed description (read-only, monospace, "Last composed"), override textarea (≤ 1000), composed keywords (read-only chips), override keywords tag input (optional, ≤ 15), meta-title override (≤ 70), "Reset to composed" per field, Save. Search/filter by category or city.

### §6.6 Seed detail — fields panel enhancement (Phase 4)

On `/settings/admin/directory/presence-seeds/[id]`:

- New "Composed enrichment" reference section above the description textarea: recomputed composed description (via `POST .../seeds/:seedId/compose`), source label (`market_enrichment` / `linked_campaign` / `none`), "Last composed" timestamp.
- Description textarea (new field, §5.7.3) labeled "Description (overrides composed enrichment)" — 500 chars, live preview with appended disclosure.
- "Reset to composed" button → `POST .../seeds/:seedId/reset` (confirm, then refresh).

### §6.7 Web services

- `apps/web/src/services/PlacesBrowsePublicService.ts` — add `getCategoryEnrichment(categorySlug, city, state)` (extends `PublicApiSingleton`; TTL 5 min, matching the existing places browse caching — this is static-ish public data, not a pay/claim flow, so the `ttl: 0` rule for marketing flows does not apply).
- `apps/web/src/services/DirectoryPresenceAdminService.ts` — add `enrichMarket`, `listMarkets`, `getMarket`, `overrideMarket`, `getTenantSeoState`, `overrideTenantSeo`, `resetTenantSeo`, `getSeedComposed`, `resetSeedOverride`, `listEnrichmentLog` + types.
- All unwrap via `result.data?.data ?? result.data`.

---

## §7 Interaction with Existing Flows

### §7.1 Seed-campaign sync (unchanged + guard)

`DirectorySeedCampaignLinkService.syncFromCampaign()` continues per-business with the audit (richer than market enrichment). Guard §5.7.1 makes it respect `operator_override` rows. Market enrichment skips `linked_campaign` fields (guardrail §3.7.8) — the two writers are mutually precedence-aware.

### §7.2 Seed creation from campaign (unchanged)

`DirectoryPresenceSeedService.createFromCampaign()` runs the composer at seed time with the campaign's audit + profile + gold standard — the richest output. Market enrichment is a floor, not a ceiling. Note: `syncFromCampaign` passes `goldStandard: null` (only `createFromCampaign` passes gold standard) — pre-existing behavior, unchanged.

### §7.3 Tenant listing → campaign spawn (audit-powered write-back deferred)

`createCampaignFromTenantListing()` spawns a campaign but bonds nothing — there is no join path from a tenant listing to its campaign's audit, so market enrichment cannot use audit data for tenants (and never tries — §3.3). A future phase may add a tenant-listing↔campaign bond table to enable the audit-powered tenant path; until then the operator path is: market enrichment now, spawn + audit for the richer follow-up work.

### §7.4 Owner overrides

The owner edits `seo_description` / `seo_keywords` via their settings page at any time. The owner path now stamps `owner_edit` events (§5.7.2) — market enrichment skips owner-authored fields (guardrail §3.7.9), and operator overrides on owner-authored fields are rejected (409, §5.6). When the owner clears a field, the next enrichment re-composes it.

### §7.5 Claimed seeds

A claimed seed keeps its seed row — the seed path (provenance state machine) continues to own its SEO fields regardless of claim status. `listing_origin` is NOT the classifier (it stays `'directory_seed'` after claim); the classifier is seed-row existence (§3.6).

### §7.6 Materialized views

Tenant writes (`directory_listings_list` / `directory_settings_list`) trigger the existing directory MV refresh path (same as the owner PATCH). Enrichment batches should refresh once per run, not per listing.

---

## §8 Phased Implementation

### Phase 1 — Category-page enrichment (market-level)

- Migration 265 — **all** tables/columns/indexes (§4, including override columns and provenance attribution — no later ALTERs)
- `buildCategorySeoPacket()` + composer tests
- `CategoryMarketEnrichmentService.enrichMarket()` — category-packet mode only (no listing writes yet); no-op on profile miss
- Public endpoint `GET /api/public/directory/category-enrichment`
- Category page `generateMetadata` upgrade + visible copy (intro + synonym chips + CollectionPage JSON-LD)
- Admin: `POST .../markets` trigger; markets list page (read-only); cockpit "Enrich Market" button
- Activation hook (§5.3) — first-activation-only, focus+scope filtered

**Acceptance:** Activating a city-scoped establishment profile auto-enriches the market's category page; the page renders the composed description + synonyms instead of boilerplate; re-running produces identical output; gold-standard activations do not fire.

### Phase 2 — Listing enrichment (per-business, market-powered)

- `enrichMarket()` listing scan + per-field guards (operator_override / linked_campaign / owner_edit incl. cleared-field case)
- Writes: listing columns, settings mirror, seed provenance upserts (`market_enrichment`, confidence `medium`, `show_on_public` true), seed `seo_enrichment` JSON refresh, tenant log events
- Owner-path `owner_edit` stamping (§5.7.2); `syncFromCampaign` operator-override guard (§5.7.1)
- Listings admin: "SEO enriched" badge + "Re-enrich" action

**Acceptance:** Every published listing in the market has a profile-powered description + keywords. Operator-overridden, audit-powered, and owner-authored content is preserved (skips recorded). Claimed seeds take the seed path.

### Phase 3 — Automatic trigger hardening

- Cockpit status line ("Market enrichment: auto-fired on profile activation / manual")
- Hook observability: log line per skipped auto-fire (gold_standards / out-of-scope / already enriched)

**Acceptance:** The automatic path is observable and predictable; version re-activations do not auto-refire.

### Phase 4 — Operator override layer

- Category-page override: `PATCH .../markets/...` + markets page editing (§6.5)
- Tenant listing override: `GET/PATCH .../listings/:tenantId/seo` + Edit SEO modal (409 owner rule, write-time disclosure, reset-recompose) (§6.4)
- Seed override: `description` field in the fields panel + composed reference + reset-recompose (§5.7.3, §6.6)

**Acceptance:** Operators can view composed output, write attributed overrides, see them render, and reset to composed (listing resets restore composed text immediately). Re-enrichment never clobbers overrides. Owner-authored tenant fields reject overrides with 409.

### Phase 5 — Proving-ground enrichment status panel

- Cockpit "Enrichment Status" section (§6.3): market state, override status, listing counts by state, links to markets page

**Acceptance:** An operator on the cockpit sees the market's enrichment state at a glance and can drill into overrides.

---

## §9 Tests

| File | Covers |
|---|---|
| `apps/api/src/services/directory/__tests__/SeedSeoComposer.test.ts` (extended) | `buildCategorySeoPacket` determinism; metaTitle/description template conformance (exact strings, 70/300 caps, word-boundary truncation); no disclosure in category packet; `Related:` sentence = verbatim prohibited-filtered synonyms, max 3; keyword composition without businessName; schema-type reuse; `CategorySeoPacket` shape (no sameAs/auditId); prohibited-keyword filtering |
| `apps/api/src/services/__tests__/CategoryMarketEnrichmentService.test.ts` (new) | Input normalization; profile-miss no-op (`no_active_profile`); focus resolution order (competitive → emerging, never gold_standards, never unfocused); category upsert always refreshes composed + never touches override columns; listing scan matching (case-insensitive exact, state required); seed guards (operator_override / linked_campaign per field); tenant guards (latest-event owner_edit / operator_override, non-null vs cleared values); claimed-seed classification (seed-row existence, not listing_origin); tenant mirror + log event rows incl. `fields_values`; seed provenance upserts + `seo_enrichment` JSON; idempotent composed output; audit() called with `directory_market_enrichment.sync`; reset-recompose writes `operator_reset` event + composed values; owner-override attempt on owner-authored listing → 409 |
| `apps/api/src/tests/category-enrichment-admin-routes.test.ts` (new) | Auth (no/invalid token → 401; viewer/support on writes → 403); POST enrich happy path + validation; GET market (composed + override + effective); PATCH market override + resets (caps enforced); PATCH tenant seo 409 `owner_authored`; seed compose/reset endpoints |
| `apps/api/src/tests/directory-presence-public.category-enrichment.test.ts` (new) | Hit (slug normalized), miss → `{market: null}`, missing city/state → null, `overridden` flags, synonyms present and prohibited-filtered |
| `apps/api/src/services/__tests__/DirectorySeedCampaignLinkService` guard case (extended) | syncFromCampaign skips description/keywords when provenance source is `operator_override` |
| `directory-tenant` owner-path test (extended) | PATCH with seo fields appends `owner_edit` event (non-blocking on log failure) |

---

## §10 Resolved Design Decisions

All former open questions (both specs' §9) and merge-forced decisions, resolved:

| # | Question | Resolution |
|---|---|---|
| D1 | Operator overrides on enriched surfaces? (CAT §9.1) | Yes — Layer 3, folded into migration 265 from day one (no later ALTER) |
| D2 | State-level / nationwide enrichment? (CAT §9.2) | v1 is city+state only — `(category_key, city, state)` key, both NOT NULL. State-scoped/nationwide profiles don't auto-fire; future migration may relax the key with a most-specific-match chain (city → state → nationwide) |
| D3 | Re-enrichment cadence? (CAT §9.3) | Auto-fire only on **first** activation (no market row). Version re-activations = profile updates = manual re-enrich. Resolves the v1-auto-trigger vs. manual-updates contradiction |
| D4 | Fuzzy category matching? (CAT §9.4) | No. Case-insensitive **exact** match after normalization (`normalizeCategoryKey` collapses hyphens/underscores; slugs and display names normalize to the same key). Display-name drift is fixed by aligning the listing category (existing operator tooling) |
| D5 | Merge shape | Single unified spec (this document); OPERATOR_ENRICHMENT_OVERRIDE_SPEC.md replaced by a stub |
| D6 | Owner-authored + operator override conflict | **Owner wins — reject with 409 `owner_authored`** (guardrail §3.7.9). No dormant override state; UI explains before submit |
| D7 | Reset semantics | **Recompose immediately** — reset re-runs the deterministic composer and restores composed values on the spot (category page needs no recompose: composed columns stay populated). Log/provenance record the reset; nothing is deleted |
| D8 | Which fields does market enrichment project? | `description` + `keywords` only. Never `same_as` (no sources without audit; writing empty would clobber linked-campaign values); never `secondary_categories` (operator/audit-managed) |
| D9 | Category-page JSON-LD node | `CollectionPage` (with effective description); listing-level JSON-LD keeps `schemaTypeHint` |
| D10 | Disclosure on overrides (OVR §9.1) | Appended **at write time** to listing-level overrides (single append, UI preview shows final text); category-page packet has no disclosure. Disclosure is non-negotiable |
| D11 | Override length caps (OVR §9.2) | Listing overrides: description ≤ 500, keywords ≤ 10 (matches existing owner-path Zod). Category-page override: description ≤ 1000, meta title ≤ 70, keywords ≤ 15. Composed caps unchanged (300/70/15/6) |
| D12 | Notify owner on override? (OVR §9.3) | v1 silent. Future: optional CRM alert when the tenant has platform context |
| D13 | Tenant audit-powered enrichment | Deferred — no tenant-listing↔campaign bond exists; market enrichment is always `audit: null` (§7.3) |
| D14 | Trigger focus | Fire only non-`gold_standards`; service resolves `competitive` then `emerging`, never unfocused (PLACE_SEED §4.4.3) |
| D15 | Admin route home | One new router `category-enrichment-admin.ts` at `/api/admin/directory/category-enrichment` (avoids the `directory-enrichment-public.ts` name collision; `requirePlatformStaff`/`requirePlatformAdmin` middleware per `directory-presence-admin.ts` pattern) |
| D16 | Log model | Append-only events, latest-row-wins state; `trigger_source` CHECK domain `manual / profile_activated / operator_override / operator_reset / owner_edit`; `fields_values` on every row; rows never deleted |
| D17 | Seed override attribution | `override_by` / `override_at` columns on `directory_field_provenance` (migration 265) — `updated_at` is a timestamp, not attribution |
| D18 | Composed reference in override UIs | Recomputed on demand (deterministic composer) via the compose/state endpoints — the stored composed value may have been superseded |

---

## §11 Revision Log

- **v2** — Merged OPERATOR_ENRICHMENT_OVERRIDE_SPEC v1 in as the operator override layer (Layer 3). Closed all gaps from both specs' reviews: market key gains `state` (D2/D11); trigger defined as operator-driven activation with focus + scope + first-activation filters (D3/D14); normative category-page templates incl. metaTitle and no-claims `Related:` framing; dedicated `CategorySeoPacket` type; unified state model (provenance source precedence for seeds, append-only latest-row-wins log with `owner_edit` stamping for tenants); `syncFromCampaign` override guard; seed fields panel gains a real `description` field; reset-recomposes (D7); owner-wins 409 (D6); write-time disclosure (D10); caps harmonized (D11); single admin router (D15); market-scan index; `seo_enrichment` JSON refresh; tests section (§9); all open questions resolved (§10).
- **v1** — Initial draft. Market-level enrichment action triggered by intelligence profile activation; two levels (category-page + listing); three phases.
