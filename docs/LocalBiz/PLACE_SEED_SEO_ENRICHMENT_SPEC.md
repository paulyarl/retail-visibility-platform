# Place Seed SEO Enrichment — 1-Click "Add to Place Listing" Spec Draft

Status: **DRAFT v3** — revised after full-spectrum review (v2) + cross-path SEO
parity analysis (v3). v2 resolutions: structured `prohibited_keywords` field
(replaces unenforceable `prohibited_inferences` guardrail), explicit `focus` +
city/state on profile resolution, composer-side schema-type inference,
visible-copy rendering decision, disclaimer reconciliation, pinned migration
254, concrete test-fixture requirements, and resolved open questions §9.1–§9.3.
v3 addition: §6.1 cross-path SEO parity — batch-create composer reuse with
graceful degradation (see §10 Revision Log).

Scope: business-scope campaigns with a `business_analysis` audit. The audit tab's
"Add to place listing" button currently seeds a minimal unclaimed listing. This spec
analyzes what the campaign metadata corpus already knows about the business and
proposes how the 1-click should use it to frame SEO on the public `/place/[slug]`
surface — without violating the provenance, honesty, and no-inference guardrails
that govern directory presence seeds.

---

## §1 Summary

When a business-scope campaign is audited, the platform already holds a rich
corpus about the business: the business analysis audit, the category intelligence
profile, the gold standard profile, discovery lineage, triage signals, and sibling
campaigns. Today the 1-click uses only a sliver of it (NAP + category + hours),
so the resulting public place page ships with:

- a generic `<title>` (`{Business Name} - VisibleShelf Place`),
- a meta description that falls back to boilerplate disclaimer copy,
- no listing `description`, no `keywords`, no `sameAs` links,
- JSON-LD `LocalBusiness` with no `description` or `sameAs`,
- visible "About this listing" copy that is pure disclaimer boilerplate.

This spec proposes a deterministic **SEO enrichment packet** assembled at seed
time from public-safe campaign metadata, written into the existing (currently
always-empty) listing `description` / `keywords` columns and the place-page
metadata, visible copy, and JSON-LD, with provenance rows for every projected
field. No LLM call in v1; no new public claims; identity and NAP guards unchanged.

---

## §2 Current Architecture Analysis

### §2.1 The 1-click flow (as built)

```
Audit tab (BusinessAnalysisAuditCard)
  └─ "Add to place listing" button (disabled when identity_status === 'mismatched')
       └─ DirectoryPresenceAdminService.createSeedFromCampaign(campaignId)   [web]
            └─ POST /api/admin/directory-presence/presence-seeds/from-campaign/:campaignId
                 (requirePlatformAdmin, body { publish = true })
                 └─ DirectoryPresenceSeedService.createFromCampaign(campaignId, opts, ctx)  [api]
                      ├─ load campaign (mkt_campaigns_list)
                      ├─ load latest audit (mkt_audits_list, platform = 'business_analysis')
                      ├─ guards: identity_mismatch (409) · incomplete_nap (400)
                      ├─ idempotency: existing directory_seed_campaign_links row
                      │   (link_role = 'primary') → return existing seed, created: false
                      ├─ build CreateSeedInput from campaign + audit
                      ├─ createSeed()   → tenant + listing + seed + provenance rows
                      ├─ publishSeed()  → is_published = true, status = 'published'
                      └─ DirectorySeedCampaignLinkService.linkCampaign(seed, campaign, 'primary')
                           └─ returns { publicUrl: /place/{slug}, seedId, listingId, created }
```

**Files:**

| Layer | File |
|---|---|
| Button + result UI | `apps/web/src/components/marketing-ops/BusinessAnalysisAuditCard.tsx` (`handleAddToPlace`) |
| Frontend service | `apps/web/src/services/DirectoryPresenceAdminService.ts` (`createSeedFromCampaign`) |
| Route | `apps/api/src/routes/directory-presence-admin.ts` (`POST /presence-seeds/from-campaign/:campaignId`) |
| Seed service | `apps/api/src/services/DirectoryPresenceSeedService.ts` (`createFromCampaign`, `createSeed`, `publishSeed`, `updateFields`) |
| Campaign bond | `apps/api/src/services/DirectorySeedCampaignLinkService.ts` (`linkCampaign`, `syncFromCampaign`) |

Note: the route file's header comments (lines 4–12) still say
`/api/admin/directory/presence-seeds` — a stale comment; the registry mounts at
`/api/admin/directory-presence`. Cleanup included in §5.1.

### §2.2 What the 1-click consumes today

From the **campaign** row: `business_name`, `address_line1/city/state/zip`, `phone`,
`website_url`, `category`, `display_id`.

From the **audit** (`audit_data` JSON): `audit_metadata` (identity_status,
identity_confidence, matched/requested business), `nap_consistency` (canonical
address/phone/zip fallbacks), `website.url` fallback, `business_hours`,
`summary` → **internal seed notes only** (truncated to 1000 chars, never public),
`data_quality.confidence`, and `google.additional_categories` — see §2.5 bug.

Provenance rows written: `name`, `address`, `phone`, `website`,
`primary_category` — `source_name = 'business_analysis_audit'`,
`source_url = /settings/admin/marketing-ops/campaigns/{id}`.

### §2.3 The public SEO surface of `/place/[slug]`

| Surface | File | Today |
|---|---|---|
| `<title>` / meta description / OG / Twitter | `apps/web/src/app/place/[slug]/layout.tsx` (`generateMetadata`) | title = `{Business Name} - VisibleShelf Place`; description = `publicDisclaimer` **or** a generic sentence. The listing `description` column is **never read**. |
| JSON-LD `LocalBusiness` | `apps/web/src/components/directory/StructuredData.tsx` rendered by `apps/web/src/app/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx` | name, address, geo, phone, website, hours, category→`@type` map, ratings. No `description`, no `sameAs`, no `keywords`. |
| Visible copy | `apps/web/src/app/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx` ("About this listing" section, ~lines 191–204) | Renders `{disclaimer}` (= `publicDisclaimer` fallback) only. Never reads `listing.description`. |
| Data source | `GET /api/directory/consolidated/:slug` (`apps/api/src/routes/directory-consolidated.ts`) | Already returns `description` and `keywords` — both always `null`/empty for seeds because `createSeed` never writes them. Does **not** join `directory_presence_seeds` (only a claim-token subquery), so seed-scoped fields like `meta_title` need a new join (§5.3.3). |
| Sitemap | `directory_places_sitemap_log` | Places sitemap exists; enriched pages are crawlable immediately. |

### §2.4 Gap analysis — what the 1-click ignores

| Available metadata | Used today? | SEO potential |
|---|---|---|
| Audit `matched_business.store_format` (grocery, bakery, butcher…) | No | High — precise category framing for title/keywords/`@type` |
| Audit `platforms.google.additional_categories` | **Broken** (§2.5) | High — secondary categories / keywords |
| Audit `platforms.{google,yelp,facebook}.profile_url` | No | High — JSON-LD `sameAs` |
| Campaign `directory_profiles[]` (`{platform, url, claim_status}`) | No (sync path stores as provenance only) | High — JSON-LD `sameAs` |
| Campaign `social_profiles` | No | Medium — JSON-LD `sameAs` |
| Campaign `neighborhood`, `business_origin_country/region` | No (sync path can project to keywords) | Medium — long-tail keywords |
| Intelligence profile (`terminology`, `synonyms`, `subcategories`, `category_signals`) | No | High — category-level keyword vocabulary |
| Gold standard profile (`expected_fields`, exemplars) | No | Low-Medium — category vocabulary only (§4.4) |
| Discovery context (`discovery_context` JSONB) | No | Low — lineage/auditability; **not** public copy (§4.4) |
| Audit `summary` | Internal notes only | **None publicly** — analyst narrative includes deficiencies; publishing it would be hostile/defamatory (§4.4) |
| Opportunity score, tier/fee recommendations, review themes, detected signals | No | **None** — internal sales intelligence, never public |
| Listing `description` / `keywords` columns | Never written | The actual SEO carrier fields |

### §2.5 Latent bug found during analysis

`createFromCampaign` reads `const google = d.google ?? {}` — but the v2 audit
schema (see `seed-business-audit-v2-templates.ts`, `platforms.google.category_fit_assessment`)
and `BusinessAnalysisAuditCard` both place platforms under **`d.platforms.google`**.
Top-level `d.google` does not exist, so `secondaryCategories` is always `[]` and
the `primary_category` provenance value silently relies on `campaign.category`
alone. This spec includes the fix (§5.1) since it is prerequisite to category
enrichment.

---

## §3 Campaign Metadata Inventory & SEO Usability Classification

The governing rule for what may reach the public surface is the same one that
governs seeds today: **a field renders publicly only with a provenance row
(`show_on_public = true`)**, and **absence of evidence is never inverted into a
claim** (intelligence `prohibited_inferences`; SNAP/EBT contract).

### Tier A — Public-safe business facts (usable in visible copy, meta, JSON-LD)

| Source | Fields | SEO use |
|---|---|---|
| Campaign | `business_name`, `category`, `address_*`, `phone`, `website_url`, `neighborhood`, `business_origin_country/region` | Title, description, keywords, JSON-LD |
| Campaign | `directory_profiles[]` `{platform, url, claim_status}` | JSON-LD `sameAs` (only `url`; claim_status stays internal) |
| Campaign | `social_profiles` | JSON-LD `sameAs` |
| Audit | `platforms.*.profile_url`, `platforms.*.displayed_name` | JSON-LD `sameAs` |
| Audit | `platforms.google.additional_categories`, `matched_business.store_format`, `matched_business.category` | Secondary categories, keywords, `@type` hint |
| Audit | `business_hours` | Hours (already seeded) + `openingHoursSpecification` (already rendered) |
| Intelligence profile | `schema_org_type` (proposed new optional key, §7 Phase 2) | Precise JSON-LD `@type` (e.g. `GroceryStore`) |

### Tier B — Category-level vocabulary (keywords/meta only; never stated as claims about this business)

| Source | Fields | SEO use |
|---|---|---|
| Intelligence profile | `terminology`, `synonyms`, `subcategories`, `category_signals` | Keyword pool (category-level: e.g. "African grocery", "West African staples" as search terms, not as inventory claims) |
| Intelligence profile | `prohibited_keywords` (proposed new structured field, §4.4.4) | Mechanical keyword denylist |
| Gold standard profile | `expected_fields` field names, `category_notes` | Keyword hints only; **never** "gold standard" language on a prospect's listing |
| Audit | `matched_business.store_format` | Keyword ("butcher", "grocery") — factual classification, safe |

### Tier C — Internal-only (must never reach the public surface)

- Audit `summary` (analyst narrative; contains deficiencies), `negative_review_themes`,
  `unanswered_negative_review_examples`, `combined_review_metrics`, platform ratings/counts,
  `digital_opportunity_score`, `recommended_tier`, `estimated_monthly_service_fee`,
  `recommended_services`, `high_attention*`, `gap_analysis`, `quality_gate_results`,
  `competitive_benchmarks`, `operational_status`, `data_quality`, `limitations`.
- Detected signals `RA_/DS_/WC_/CP_/VP_` (triage) and `INT_*` (discovery) — these are
  **deficiency/lead signals**, the opposite of SEO keywords.
- `discovery_context` (`business_seek_priority`, `category_fit`, provenance) — pipeline
  lineage; retain for auditability only.
- Operator `notes` (contains "Discovery context" sections and internal commentary).
  Note: the existing `syncFromCampaign` `description` projection writes
  `campaign.notes` **verbatim** into the public listing description — this spec retires
  that mapping (§5.4).

---

## §4 Design — The SEO Enrichment Packet

### §4.1 New module: `SeedSeoComposer`

`apps/api/src/services/directory/SeedSeoComposer.ts` — a **pure, deterministic**
composer (no LLM, no network). Input is everything already loaded by
`createFromCampaign` plus two cheap exact-match lookups (§4.2):

```ts
interface SeedSeoInput {
  campaign: CampaignRow;            // already loaded
  audit: AuditDataRow;              // already loaded (audit_data)
  intelligenceProfile: IntelligenceProfileConfiguration | null;  // resolved §4.2
  goldStandard: GoldStandardConfig | null;                       // resolved §4.2
}

interface SeedSeoPacket {
  metaTitle: string;          // ≤ 70 chars
  description: string;        // ≤ 300 chars, disclosure-bearing
  keywords: string[];         // ≤ 15, deduped, lowercase
  secondaryCategories: string[];
  sameAs: string[];           // profile/social URLs
  schemaTypeHint: string | null;   // e.g. 'GroceryStore'
  inputs: { auditId, intelligenceProfileId?, goldStandardProfileId? }; // auditability
  composerVersion: number;
}
```

The composer accepts **explicit fields only** — never the raw `audit_data` blob —
so Tier C leakage requires a deliberate type violation (enforced by tests, §8).

### §4.2 Profile resolution at seed time (deterministic)

```ts
// Terminology profile — focus is EXPLICIT. Never 'gold_standards' here:
// gold-standard configs describe other businesses (exemplars), and an
// unfocused resolve() returns any active profile for the category ordered by
// version desc — nondeterministic across focuses and a leakage risk (§4.4.3).
const seoFocus: 'emerging' | 'competitive' =
  campaign.intelligence_focus === 'emerging' || campaign.intelligence_focus === 'competitive'
    ? campaign.intelligence_focus
    : 'competitive';

const profile = await IntelligenceProfileService.resolve(
  campaign.category,
  seoFocus,
  campaign.address_city ?? null,     // Migration 205 city scoping — preferred when
  campaign.address_state ?? null,    // a city-scoped profile exists; nationwide
  ctx,                               // fallback is intentional (see justification below)
);

const gold = await IntelligenceProfileService.resolveGoldStandard(
  campaign.category,
  campaign.intelligence_platform ?? 'google',
  campaign.address_city ?? null,
  campaign.address_state ?? null,
  ctx,
);
```

**City-scoping justification (Migration 205 alignment):** both resolvers receive
the campaign's city/state so a city-scoped profile **wins when one exists** —
the Migration 205 contract is honored, not bypassed. When only a
nationwide/city-agnostic profile exists, the resolvers' own fallback chains
return it, which is intentional for this consumer: keyword vocabulary is
category-level ("African grocery", "West African staples") and does not vary by
city; a missing city-scoped profile must not degrade SEO to an empty packet.
The resolved profile IDs (and therefore the scope that produced the packet) are
recorded in `inputs` for auditability.

A profile miss degrades gracefully: the packet is built from Tier A
campaign/audit facts only (`intelligence_mode: 'none'` equivalent).

### §4.3 Field compositions (v1 templates)

**`metaTitle`** — `{Business Name} — {Category} in {City}, {State}` truncated to 70;
falls back to today's `{Business Name} - VisibleShelf Place` when data is thin.

**`description`** — deterministic template, disclosure-bearing, e.g.:

> `{Business Name} is a {category label} in {City}{, neighborhood}, {State}. Listed
> on VisibleShelf from public information (address, phone). Claim this listing to
> verify and update details.`

- Category label may use `store_format` when present (e.g. "African grocery store"
  → "grocery store"), else `campaign.category`.
- No review, score, tier, or deficiency language. Ever.
- Hard cap 300 chars; truncation is word-boundary + ellipsis.
- The disclosure sentence is retained **in every context the description travels**
  (meta tags, JSON-LD, scrapers) even though the visible page also renders the
  disclaimer — redundancy is acceptable; honesty is non-negotiable (§4.4.5).

**`keywords`** — merged, deduped, capped at 15, in priority order:

1. `campaign.category` (lowercased, plain term)
2. `store_format` (plain term)
3. city, state (plain terms), `{neighborhood}` (**`neighborhood:{x}` key:value
   format preserved**)
4. audit `additional_categories` (plain terms)
5. intelligence profile `synonyms` + `subcategories` (plain terms, category-level)
6. `origin_country:{x}` / `origin_region:{x}` (key:value, existing sync format)

**Format resolution (was §9.2):** keep `key:value` for geographically/attribute-scoped
terms (neighborhood, origin) — matching the existing `syncFromCampaign` output that
the GIN-indexed `keywords` column already contains — and plain terms for
category/city/state/format. No normalization migration; mixed formats are
GIN-compatible and the display concern is deferred to Phase 3 hub pages.

**`secondaryCategories`** — union of audit `additional_categories` (fixed §2.5) and
intelligence `subcategories`, capped at 6, excluding the primary category string.

**`sameAs`** — deduped URLs from `directory_profiles[]`, `social_profiles`, and
audit `platforms.*.profile_url`. Only http(s) URLs; `claim_status` never leaves the API.

**`schemaTypeHint`** — resolution order (fixes the broken-fallback dependency):

1. `intelligenceProfile.schema_org_type` when present (Phase 2 profile key, §7) — wins.
2. Composer-side inference via a **curated word-boundary table** applied to
   `campaign.category` + `store_format` (e.g. contains-word "grocery" →
   `GroceryStore`, "bakery" → `Bakery`, "butcher" → `ButcherShop`, "restaurant" →
   `Restaurant`, "cafe"/"coffee" → `CafeOrCoffeeShop`, "salon" → `BeautySalon`,
   "pharmacy" → `Pharmacy`, "clothing" → `ClothingStore`, "electronics" →
   `ElectronicsStore`, "furniture" → `FurnitureStore`, "hardware" → `HardwareStore`,
   "gym"/"fitness" → `ExerciseGym`, "store"/"retail" → `Store`). This is required
   because the existing `mapCategoryToSchemaType` in `StructuredData.tsx` matches
   single-word keys only — multi-word diaspora-niche categories ("African Grocery
   Store") always fall through to `LocalBusiness`, making the existing fallback a
   no-op for the target corpus.
3. `null` → JSON-LD emits `LocalBusiness` (today's behavior, unchanged).

The existing `mapCategoryToSchemaType` in `StructuredData.tsx` is left untouched;
the composer's inference supersedes it for seeds via the `@type` override path.

### §4.4 Guardrails (normative)

1. **No Tier C fields in any public output.** The composer's input type is the
   boundary: it accepts explicit fields, not the raw `audit_data` blob. Unit tests
   assert absence with Tier C-populated fixtures (§8).
2. **No claims from category vocabulary.** Tier B words may appear as keywords or
   category framing, never as statements about this business's inventory, quality,
   or specialization ("specializing in X" is prohibited in v1). Tier B keywords are
   emitted **verbatim from profile fields only** — the composer never generates,
   inflects, or composes new keyword strings.
3. **No gold-standard language or exemplar leakage.** A prospect's unclaimed
   listing never references benchmarks, exemplars, or other businesses. The
   terminology profile is resolved with an explicit non-`gold_standards` focus
   (§4.2) so exemplar business names cannot enter the keyword pool; the gold
   standard profile contributes only `expected_fields` field-name vocabulary.
4. **Mechanical prohibited-keyword filtering.** `prohibited_inferences` is
   natural-language prose for LLM prompts and is **not** a composer input — a
   deterministic composer cannot decide whether a keyword "asserts" a prose
   inference. Instead:
   - New structured field **`prohibited_keywords?: string[]`** on
     `IntelligenceProfileConfiguration` (alongside `prohibited_inferences`),
     supplied per category via profile versions (seed/establishment output, §7).
   - The composer filters its keyword pool against `prohibited_keywords`
     case-insensitively (exact term match) **and** against the other categories'
     entries when multiple profiles are consulted (terminology + gold standard).
   - Empty/absent `prohibited_keywords` filters nothing — the verbatim-only rule
     (guardrail 2) remains the primary bound.
   - Phase 2 backfills `prohibited_keywords` for active categories (e.g.
     "halal", "kosher", "certified" for categories whose `prohibited_inferences`
     forbid certification inferences).
5. **Disclosure preserved.** The description always carries the "listed from public
   information" sentence; the unclaimed banner and disclaimer rendering are unchanged.
6. **Provenance per projected field.** `description`, `keywords`,
   `secondary_categories`, `same_as` each get a `directory_field_provenance` row
   (`source_name = 'business_analysis_audit'` or `'intelligence_profile'`,
   `show_on_public = true`). These four keys extend the provenance field-key
   registry (`name`, `address`, `phone`, `snap_ebt`, `hours`, `specialty_line`) —
   the registry list in the `directory-presence-seed-claim` skill doc and any
   code that enumerates provenance keys (admin detail page, `PATCH /fields`
   handler) must be updated in the same change (§5.1, §5.6).
7. **Identity + NAP guards unchanged.** `identity_mismatch` and `incomplete_nap`
   still hard-stop the 1-click. Enrichment never widens what may be seeded.
8. **One-way projection.** Campaign → seed only, matching `DirectorySeedCampaignLinkService`'s
   stated direction.

---

## §5 Changes

### §5.1 API — `DirectoryPresenceSeedService.createFromCampaign`

1. **Bug fix:** `const google = d.platforms?.google ?? {}` (§2.5).
2. After loading campaign + audit, resolve profiles (§4.2) and build the packet:
   `const seo = buildSeedSeoPacket({ campaign, audit, intelligenceProfile, goldStandard })`.
3. Extend `CreateSeedInput` with optional `description: string`, `keywords: string[]`,
   `sameAs: string[]`, `metaTitle: string` (metaTitle is stored on the seed's
   `seo_enrichment` JSON, not the listing — see §5.5).
4. `createSeed`'s listing INSERT gains `description`, `keywords`, `same_as` columns
   (`description`/`keywords` already exist on `directory_listings_list` — no
   migration for those; `same_as` is new, §5.5).
5. Provenance rows for the new fields (§4.4.6).
6. **Audit event:** the existing `directory_presence_seed.create` audit payload is
   extended with `seoEnriched: boolean` and `composerVersion` (single event, no
   double-audit). Phase 2 regeneration emits a distinct
   `directory_presence_seed.seo_enriched` action.
7. Idempotency unchanged: existing primary link → return existing seed. A future
   "regenerate SEO" action re-runs the composer — **dependency:** the existing
   `updateFields` handler whitelist (email, snap*, phone, website, hours,
   categories, address, slug) does **not** accept `description`, `keywords`,
   `sameAs`, or `metaTitle`; Phase 2 must extend both the service whitelist and the
   route's Zod schema (§7).
8. Cleanup: correct the stale mount-path header comment in
   `directory-presence-admin.ts` (§2.1 note).

### §5.2 API — `SeedSeoComposer` (new)

Pure module per §4.1. Exported for tests. No Prisma access.

### §5.3 Web — place page metadata, visible copy, and JSON-LD

1. **Metadata** (`apps/web/src/app/place/[slug]/layout.tsx`) — `generateMetadata`
   prefers `listing.description` (new first choice), then `publicDisclaimer`, then
   the generic fallback. Title uses the seed's `meta_title` when present (via
   consolidated payload), else today's format. Note: `generateMetadata` and the
   layout body each call `getDirectoryConsolidated` (double fetch, pre-existing);
   the enriched fields flow through both calls identically — no change needed,
   but the consolidated payload must carry them (item 3).
2. **Visible copy** (`PlaceEntryEditorialLayout.tsx`, "About this listing") —
   when `listing.description` is present, render it as the **lead paragraph**,
   with the existing disclaimer paragraph retained beneath it (honesty notice).
   When absent, today's disclaimer-only rendering is unchanged. This makes the
   enriched description visible text matching the meta description, not meta-only.
3. **Consolidated route** (`apps/api/src/routes/directory-consolidated.ts`) —
   requires a **new join**, not a column add: the query currently joins only
   `tenants` (plus a claim-token subquery). Add
   `LEFT JOIN directory_presence_seeds dps ON dps.listing_id = dll.id` and select
   `dps.seo_enrichment->>'meta_title' AS meta_title` plus the new `dll.same_as`.
   Claimed listings have no seed row → `meta_title` is `null` → `generateMetadata`
   falls back to today's format (desired; see §10 G1). The join must not fan out
   rows (`directory_presence_seeds.listing_id` is unique).
4. **JSON-LD** (`apps/web/src/components/directory/StructuredData.tsx`) —
   `LocalBusinessStructuredData` gains optional `description`, `sameAs`, and
   `schemaType` → emits `description`, `sameAs`, and `@type` override when
   provided. Additive; all existing consumers (`/directory/[slug]` layouts)
   unaffected (they pass none of the new props and keep today's output).

### §5.4 API — retire the raw-notes description projection

In `DirectorySeedCampaignLinkService.syncFromCampaign`, the `description` case
currently writes `campaign.notes` verbatim to the public listing. Replace it with
the composer: `case 'description'` rebuilds the packet from the linked campaign's
latest audit and writes the composed description. **When the composer degrades
(no audit, no profile), the projection writes nothing rather than falling back to
notes** — the notes-leak path is closed unconditionally, not conditionally. This
keeps 1-click and sync surfaces consistent.

### §5.5 Data model (migration 254)

`database/migrations/254_place_seed_seo_enrichment.sql` (next number after 253 —
verified against `database/migrations/`; re-check at implementation time in case
numbering advanced):

```sql
ALTER TABLE directory_presence_seeds
  ADD COLUMN seo_enrichment JSONB NULL;   -- composer inputs + version + meta_title

ALTER TABLE directory_listings_list
  ADD COLUMN same_as TEXT[] NULL DEFAULT '{}';
```

`seo_enrichment` shape:

```json
{
  "composer_version": 1,
  "meta_title": "…",
  "inputs": {
    "audit_id": "maudit-…",
    "intelligence_profile_id": "mip-… | null",
    "gold_standard_profile_id": "mip-… | null"
  },
  "generated_at": "…"
}
```

Post-migration discipline per AGENTS.md:

```powershell
doppler run --config local -- pnpm prisma db pull
pnpm prisma generate
# repeat with --config prd for production
```

### §5.6 Frontend — operator surface (minimal)

- `BusinessAnalysisAuditCard`: button unchanged (still 1-click). Result line gains
  an "SEO enriched" suffix when `seo_enrichment` was written (route response
  includes `seoEnriched: true`).
- Presence-seed admin detail page: show `description` / `keywords` / `same_as`
  with their provenance rows (the page already renders provenance; extend it for
  the four new field keys per §4.4.6).
- Skill-doc amendment: update the `directory-presence-seed-claim` skill's
  provenance field-key registry to list `description`, `keywords`,
  `secondary_categories`, `same_as`.

---

## §6 What Does NOT Change

| Component | Why |
|---|---|
| Claim flow, tokens, `org_standing_mode` flip | SEO enrichment is pre-claim only; claim handoff spec untouched |
| SNAP/EBT contract | Composer never touches `snap_*` fields |
| Tier capabilities / `directory_entry_*` options | No capability changes |
| Public disclaimer default | Still applied and still rendered; description supplements it as lead copy (§5.3.2), never replaces the honesty notice |
| Places sitemap | Enriched rows flow through unchanged |
| `/directory/[slug]` claimed listings | `StructuredData` changes are additive-optional; no seed row → `meta_title` null → today's metadata (§5.3.3) |
| Triage, outreach, gallery, intake | Tier C stays internal; nothing reads SEO fields |
| `mapCategoryToSchemaType` in `StructuredData.tsx` | Untouched; composer inference supersedes via the `@type` override (§4.3) |

---

## §6.1 Cross-Path SEO Parity (Batch-Create Gap)

### The gap

Phase 1 enriches only the 1-click `createFromCampaign` path. The platform has
five other seeding paths, all of which call `createSeed` directly and produce
**bare listings** (no description, no keywords, no `sameAs`, no `metaTitle`,
no `schemaTypeHint`):

| Path | Entry point | Has campaign + audit? | Has intelligence profile? | Post-Phase-1 SEO |
|---|---|---|---|---|
| **1-click from audit** | `DirectoryPresenceSeedService.createFromCampaign` | Yes (full corpus) | Yes (resolved §4.2) | **Full packet** |
| Manual single seed | `POST /presence-seeds` → `createSeed` | No | No | Bare |
| Batch from queue | `POST /presence-seeds/batch-create` → `createSeedsFromBatch` | **Partial** (see below) | No | Bare |
| Public suggestion | `DirectorySuggestionService.createSeed` | No | No | Bare |
| Owner self-submission | `DirectoryOwnerSubmissionService.createSeed` | No | No | Bare |
| Migration (e.g. 209) | Static SQL | No | No | Bare until backfill script runs |

This creates an **incentive mismatch**: operators processing prospect queues in
batch produce inferior listings compared to operators who go through the
campaign audit → 1-click flow. The batch path is the highest-volume seeding
path for prospect-derived listings, so the gap is material, not edge-case.

### Why batch-create is the viable candidate (and the others are not)

The `mkt_prospect_queue` row carries more corpus than the other non-1-click
paths:

- `category`, `city`, `state` — sufficient to resolve an intelligence profile
  by category+focus+city (the composer's §4.2 resolution, minus the audit).
  All three are nullable on the queue row.
- `source_campaign_id` (nullable, declared FK to `mkt_campaigns_list`) and
  `source_audit_id` (nullable, plain string column — **no declared FK relation**,
  so referential integrity is not enforced; the `findUnique` null-check pattern
  below is required, not defensive). When present, the full composer could run
  with the same inputs as the 1-click.
- `business_snapshot` (JSON) — carries `platforms.google` (ratings today;
  `additional_categories` and `profile_url` are not currently snapshotted but
  the shape is extensible).

The other three paths (manual, public suggestion, owner submission) have no
campaign linkage and no category intelligence access — they remain bare in
all phases. Owner-submitted and public-suggestion listings are also
provenance-thin by design (visitor/owner-supplied, not platform-audited), so
enriching them with category-level vocabulary would be a stronger claim than
the evidence supports.

### Phase 2 design — composer reuse in `createSeedsFromBatch`

`DirectoryPresenceSeedService.createSeedsFromBatch` (the batch-create handler)
gains an optional composer invocation per entry. The composer is a pure module
(`SeedSeoComposer`, §4.1) that takes explicit inputs — it is not architecturally
locked to the 1-click and can be called from any path that can supply
`SeedSeoInput`.

**Resolution per queue entry (deterministic, no LLM):**

```ts
// 1. Resolve intelligence profile by category (always available on queue entries)
const profile = entry.category
  ? await IntelligenceProfileService.resolve(
      entry.category,
      'competitive',                    // default focus for batch (no campaign to read it from)
      entry.city ?? null,
      null,                             // no platform signal on queue entries
      ctx,
    )
  : null;

// 2. If source_audit_id is present, load the audit for full Tier A+B inputs
const audit = entry.source_audit_id
  ? await prisma.mkt_audits_list.findUnique({ where: { id: entry.source_audit_id } })
  : null;

// 3. If source_campaign_id is present, load the campaign for directory_profiles / social_profiles
const sourceCampaign = entry.source_campaign_id
  ? await prisma.mkt_campaigns_list.findUnique({ where: { id: entry.source_campaign_id } })
  : null;

// 4. Build a SeedSeoInput-shaped object from queue entry + snapshot + optional audit/campaign
const seoInput = buildBatchSeoInput({ entry, snapshot, audit, sourceCampaign });

// 5. Compose (degrades gracefully — see below)
const seo = buildSeedSeoPacket(seoInput);
```

**Graceful degradation tiers (deterministic by data availability):**

| Queue entry has… | Composer output |
|---|---|
| `category` + `city`/`state` only (no audit, no campaign) | **Tier A-lite**: metaTitle (name + category + city), description (template with category label), keywords (category + city + state + profile synonyms/subcategories), schemaTypeHint (composer inference table). No `sameAs` (no profile URLs), no `secondaryCategories` (no audit). |
| `category` + `source_audit_id` | **Tier A+B**: above plus audit `additional_categories`, `store_format`, `platforms.*.profile_url` → `sameAs`. Full packet minus campaign `directory_profiles`/`social_profiles`. |
| `category` + `source_audit_id` + `source_campaign_id` | **Full packet** — identical to the 1-click output. |

The degradation is automatic and per-entry: a single batch call may produce a
mix of full-packet and Tier A-lite seeds depending on which queue entries
carry source IDs. The `seo_enrichment.inputs` JSON records which sources
produced each packet so the quality tier is auditable.

**Placeholder sentinel handling (verified against `createSeedsFromBatch`):**
the batch path falls back to sentinel strings when data is missing —
`'Address not available'`, `'Unknown City'`, `'Unknown Category'`,
`'Unknown Business'` (`DirectoryPresenceSeedService.ts:922-930`). These must
never reach composer output: `buildBatchSeoInput` maps sentinel values to
`null`/`undefined` before composing, and the composer's existing thin-data
fallbacks apply (metaTitle falls back to today's format; description omits
the city clause when city is absent). A queue entry whose business name
resolves to `'Unknown Business'` gets **no packet at all** — enriching an
unidentified business violates the §4.4 honesty guardrails.

**What does NOT change in batch-create:**

- The `business_snapshot` remains the source for NAP, `secondary_categories`
  (snapshot), `snap_ebt_*`, and `discovery_provenance` — the composer only
  adds SEO fields, it does not replace existing field sourcing.
- Batch idempotency (duplicate detection by city + category + business name)
  is unchanged.
- The `seedBatch` label is unchanged.
- Batch seeds are still created in `draft` status (`createSeedsFromBatch` does
  not call `publishSeed`, unlike the 1-click) — the SEO parity gap therefore
  materializes at publish time, and the §7 backfill script must handle draft
  seeds as well.
- Provenance rows for SEO fields use `source_name = 'intelligence_profile'`
  (for profile-derived keywords/schemaTypeHint) or `'business_analysis_audit'`
  (for audit-derived `sameAs`/`secondaryCategories`), matching §4.4.6.

**Guardrails carried over from §4.4:**

- Tier C fields in `business_snapshot` (`detected_signals`, `combined_review_metrics`,
  platform ratings/counts) are **not** composer inputs — the composer's input
  type boundary (§4.1) applies identically here.
- `prohibited_keywords` filtering (§4.4.4) applies — the same profile that
  supplies synonyms/subcategories also supplies the denylist.
- No claims from category vocabulary (§4.4.2) — keywords are verbatim from
  profile fields only.
- Disclosure sentence retained in the composed description (§4.4.5).

### Why this is Phase 2, not Phase 1

- Phase 1's scope is the 1-click path + the §2.5 bug fix + the sync-path
  notes-leak fix — all narrowly scoped to `createFromCampaign` and
  `syncFromCampaign`. Adding batch-create expands the surface to a
  high-volume path that needs its own test coverage and its own degradation
  matrix.
- The `prohibited_keywords` field (§4.4.4) is Phase 2 — without it, batch-
  create would emit category vocabulary keywords with no mechanical denylist,
  which is riskier at volume than in the 1-click path (where an operator
  reviewed the audit before clicking).
- The composer's `buildBatchSeoInput` adapter is new code (maps queue entry +
  snapshot to `SeedSeoInput`), separate from `createFromCampaign`'s existing
  campaign+audit loading.

### Tests (added to §8)

| File | Coverage |
|---|---|
| `apps/api/src/services/__tests__/DirectoryPresenceSeedService.batchCreate.test.ts` | Batch-create with `source_audit_id` + `source_campaign_id` → full SEO packet written; batch-create with category only → Tier A-lite packet (keywords from profile, no `sameAs`); batch-create with no category → bare seed (no `seo_enrichment`); degradation matrix assertions; `seo_enrichment.inputs` records the correct source IDs per tier; Tier C fields in `business_snapshot` do not appear in any output; **sentinel values (`'Unknown City'`, `'Address not available'`, `'Unknown Business'`) never appear in any composer output** — sentinel business name produces no packet |

### Open question (new)

1. Should the batch-create composer invocation be **opt-in** (operator passes
   `enrichSeo: true` in the request body, default false) or **automatic**
   (always runs when category is present, degrades gracefully)? Draft
   assumes automatic — the graceful degradation means there is no downside
   to running it, and opt-in would leave the gap open for operators who
   don't know to toggle it. Revisit at Phase 2 implementation.

---

## §7 Rollout Phases

**Phase 1 (this spec, v1):** composer (deterministic, with curated schema-type
table + `prohibited_keywords` filtering), bug fix §2.5, listing
`description`/`keywords`/`same_as` + provenance, `generateMetadata` + visible-copy
+ JSON-LD updates, consolidated-route join, sync-path description fix, migration
254, skill-doc registry amendment.

**Phase 2:** operator "Regenerate SEO" action on the seed detail page — requires
extending `updateFields`'s whitelist + route Zod schema for the four SEO fields
(§5.1.7); `schema_org_type` **and `prohibited_keywords`** keys on intelligence
profiles — supplied via profile versions: extend the establishment prompt output
schema (intelligence establishment template seed script, if touched → re-run
`local` + `prd` per AGENTS.md seed discipline) and add operator-editable fields in
the profiles admin UI; backfill `prohibited_keywords` for active categories;
**batch-create composer reuse** (§6.1) — `createSeedsFromBatch` invokes the
composer per entry with graceful degradation by data availability;
LLM-assisted description drafting **behind operator review** (draft status until
approved — never auto-published).

**Phase 3:** category/city hub pages consume seed keywords for internal-link
anchor relevance (incl. display normalization of `key:value` terms if needed);
`specialty_line` provenance key rendered on the editorial layout.

**Backfill (one-off, after Phase 1):** `apps/api/src/scripts/backfill-seed-seo.ts`
— re-runs the composer in degraded Tier-A mode for seeds without a campaign audit
(e.g. the 10 `indianapolis-african-grocery-2026` seeds). Idempotency marker:
presence of `seo_enrichment` with `composer_version` on the seed row (skip
already-enriched seeds). Run against `local` and `prd` per AGENTS.md discipline.

---

## §8 Tests

Fixture requirements (normative — without these the assertions are vacuous):

- The audit fixture must use the **real v2 `audit_data` shape** from
  `seed-business-audit-v2-templates.ts` — `platforms.google.additional_categories`
  populated (not top-level `google`), and **Tier C fields present**
  (`digital_opportunity_score`, `recommended_tier`, `negative_review_themes`,
  `detected_signals`, `summary`) so absence assertions are non-vacuous.
- The intelligence profile fixture must include `terminology`, `synonyms`,
  `subcategories`, `category_signals`, and `prohibited_keywords`.

| File | Coverage |
|---|---|
| `apps/api/src/services/directory/__tests__/SeedSeoComposer.test.ts` | Deterministic output; 300/70-char caps; keyword merge order + dedupe + cap + `key:value` vs plain-term formats; `store_format` framing; profile miss → degraded packet; focus/city/state passed through (assert resolver args via injected fake); **Tier C absence assertions against the Tier C-populated fixture**; `prohibited_keywords` filtering (case-insensitive); schema-type inference table (multi-word category → precise `@type`); `sameAs` URL sanitization (http(s) only, deduped) |
| `apps/api/src/services/__tests__/DirectoryPresenceSeedService.fromCampaign.test.ts` | Enriched createFromCampaign: description/keywords/same_as written; provenance rows for the four new field keys; **`platforms.google` fix asserted against the v2-shaped fixture** (secondaryCategories non-empty); idempotency returns existing seed unchanged; identity/NAP guards still throw; audit payload carries `seoEnriched` |
| `apps/api/src/services/__tests__/DirectorySeedCampaignLinkService.test.ts` | `description` projection now composes (not raw notes); **notes never reach the public description even when the composer degrades** (no audit / no profile → empty write, not notes fallback) |
| `apps/web` metadata + JSON-LD | `generateMetadata` preference order (description → disclaimer → generic); seed `meta_title` used when present, null for claimed listings; JSON-LD emits `description`/`sameAs`/`@type` when present, byte-identical output when absent; visible "About this listing" renders description as lead paragraph with disclaimer retained |

Verification: `pnpm checkapi`, `pnpm checkweb`, then manually 1-click
`mcamp-z4r3evbw` → inspect `/place/{slug}` source for title/description/JSON-LD
and confirm the visible "About this listing" lead paragraph.

---

## §9 Open Questions (remaining)

1. ~~meta_title seed-scoped vs listing-scoped~~ → **Resolved: seed-scoped**
   (`seo_enrichment` JSON). Keeps claimed listings untouched and respects one-way
   projection. Claimed-listing null case documented in §5.3.3.
2. ~~Keyword format~~ → **Resolved: `key:value` for scoped terms (neighborhood,
   origin), plain terms for category/city/state/format** (§4.3).
3. Should the composer also emit a `specialty_line` provenance value (field key
   already defined) for Phase 3 rendering, or defer entirely? (Deferred in v1;
   revisit at Phase 3.)
4. ~~Backfill the 10 Indianapolis seeds~~ → **Resolved: yes, via one-off script
   `backfill-seed-seo.ts` with `seo_enrichment`-presence idempotency marker** (§7).
5. Should batch-create composer invocation be opt-in (`enrichSeo: true` in the
   request body, default false) or automatic (always runs when category is
   present, degrades gracefully)? Draft assumes automatic — see §6.1 open
   question. Revisit at Phase 2 implementation.

---

## §10 Revision Log

**v3 (this revision)** — cross-path SEO parity:

> **Verification pass (post-v3):** all §6.1 claims verified against source —
> `createSeedsFromBatch` (`DirectoryPresenceSeedService.ts:884`), route
> `POST /presence-seeds/batch-create` (`directory-presence-admin.ts:458`, body
> `{queueEntryIds 1–200, seedBatch}`), queue columns (`schema.prisma:4200-4245`),
> duplicate-detection idempotency (`:904-918`), and the existence of
> `DirectorySuggestionService` / `DirectoryOwnerSubmissionService`. Two
> corrections applied from verification: (1) placeholder sentinel handling
> added to the degradation design + tests — batch fallbacks like
> `'Unknown City'` must never reach composer output; (2) `source_audit_id`
> re-characterized as a plain string column (no declared FK) with the
> null-check pattern noted as required. Draft-status note added
> (batch seeds don't publish; gap materializes at publish time).

| # | Severity | Finding | Resolution |
|---|---|---|---|
| H1 | Medium | Batch-create produces bare listings while 1-click produces full SEO packets — incentive mismatch on the highest-volume prospect-derived seeding path | New §6.1: composer reuse in `createSeedsFromBatch` with graceful degradation by data availability (full packet when `source_audit_id` + `source_campaign_id` present, Tier A-lite from category+profile otherwise); Phase 2 scoped; test coverage added to §8; open question §9.5 (opt-in vs automatic) |

**v2** — addressed review findings:

| # | Severity | Finding | Resolution |
|---|---|---|---|
| C1 | Blocker | `prohibited_inferences` guardrail unimplementable (natural-language prose, not machine-checkable) | New structured `prohibited_keywords` field on `IntelligenceProfileConfiguration`; mechanical case-insensitive filtering; verbatim-only keyword rule as primary bound (§4.4.4) |
| C2 | Blocker | `resolve()` called without `focus` → nondeterministic profile selection; gold-standard exemplar leakage risk | Explicit focus arg (`emerging`/`competitive` from campaign, never `gold_standards`); rationale documented (§4.2) |
| B2 | High | `mapCategoryToSchemaType` fallback is a no-op for multi-word diaspora categories | Composer-side curated word-boundary inference table; profile `schema_org_type` override wins when present; existing function untouched (§4.3) |
| D1 | High | Enriched description was meta-only; visible copy unchanged | Editorial layout renders description as lead paragraph in "About this listing", disclaimer retained beneath (§5.3.2) |
| D2 | High | `publicDisclaimer` vs composed description unreconciled | Explicit relationship: description = business-descriptive copy (meta + JSON-LD + visible lead); disclaimer = provenance notice (unchanged rendering, meta fallback only when description absent); disclosure sentence retained in description for off-page contexts (§4.3, §5.3) |
| C3 | Medium | Migration 205 city scoping bypassed without justification | City/state now passed to both resolvers (city-scoped profile wins when it exists); nationwide fallback justified as intentional for category-level vocabulary (§4.2) |
| D3 | Medium | Consolidated route `meta_title` exposure understated | New `LEFT JOIN directory_presence_seeds` spelled out; uniqueness prevents fan-out; claimed-listing null case documented (§5.3.3) |
| B1 | Low | Wrong/ambiguous path for `PlaceEntryEditorialLayout.tsx` | Full path pinned everywhere: `apps/web/src/app/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx` |
| D4 | Low | Provenance field-key registry not extended | Four new keys added to registry; skill-doc amendment + admin/`PATCH /fields` enumeration updates scoped (§4.4.6, §5.6) |
| D5 | Low | `PATCH /fields` doesn't accept SEO field keys | Named as explicit Phase 2 dependency (whitelist + Zod schema) (§5.1.7, §7) |
| E1 | Low | Migration number placeholder | Pinned `254_place_seed_seo_enrichment.sql` (latest is 253; re-check at implementation) + prd discipline (§5.5) |
| E2 | Low | Seed-script implications for new profile keys unstated | Phase 2 names the mechanism (establishment prompt schema + profiles admin UI) and mandates local+prd re-run when seed scripts are touched (§7) |
| E3 | Low | `audit()` action for new write paths unstated | `directory_presence_seed.create` payload extended with `seoEnriched`/`composerVersion`; distinct `seo_enriched` action for Phase 2 regeneration (§5.1.6) |
| F1–F4 | Low | Test fixtures would make assertions vacuous | Normative fixture requirements added: v2-shaped audit_data with Tier C fields populated; notes-leak regression assertion; double-fetch note; visible-copy test (§8) |
| G1–G3 | — | Open questions | §9.1, §9.2, §9.4 resolved; §9.3 deferred to Phase 3 |
