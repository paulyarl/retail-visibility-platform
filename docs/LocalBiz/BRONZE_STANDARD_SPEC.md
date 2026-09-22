# Bronze Standard — Design Spec

**Document Version:** 1.1 (gap-analysis revisions — not yet scheduled)
**Date:** 2026-09-16
**Status:** Draft for review
**1.1 changes:** catalog made DB-authoritative with snapshot semantics (§3);
revision model completed (counter store, `revised_in_revision`, scope-change
bumps); `reason_coverage[].status` three-state vocabulary added (§4.1);
Option A focus recommended over B after the `idx_mkt_intel_profiles_active_scope`
collision was found (§10.2); out-of-loop fill write path + merge rule (§7.3);
routes, post-import hook, and seed-vs-migration mechanics specified
(§10.3–10.4); platform added as an optional scope dimension + slot attribute
(§3.6.5), with the field-gap reason family seeded (§3.2).
**Companion docs:** `gold_standard_sprint_plan.md`, `PLATFORM_OFFERING_ARCHITECTURE.md` (§5, §10)

---

## 1. Problem

The gold standard defines what *excellent* looks like for a category on a
platform, and the discovery pipeline fills its slots with best-in-class
businesses. It has no inverse, and the emerging pipeline has neither a
calibration target nor a falsification instrument.

The failure that motivated this spec: an Indianapolis African grocery
(`Arsema Food Mart`) was missed by **both** the emerging and competitive
discovery scans for its category and city, and was only found by operator
self-discovery. The profile's discovery patterns were not wrong in a way the
author could see — they were *incomplete*, and nothing in the profile contract
made the incompleteness observable.

Two distinct jobs are unmet:

| Job | Question | What it needs |
|-----|----------|---------------|
| **Calibration** | What does a hard-to-find business in this category and city look like? | Exemplars of the target |
| **Validation** | Would my discovery patterns actually have found one? | A held-out, externally-sourced ground truth |

A bronze standard serves both, because its slots are typed by **why** the
business is invisible — and each reason *is* a discovery vector.

---

## 2. Relationship to the Gold Standard

Bronze is **not** gold inverted. The slot axis is orthogonal.

| | Slot axis | Slot contents | Question answered |
|---|---|---|---|
| **Gold** | platform (google, yelp, facebook, website, bing, apple_maps) | top-per-platform category leaders | what does excellent look like here |
| **Bronze** | **reason** (discovery blind spot) | lowest-quality *operating* category qualifiers, one per reason | what does invisible look like, and why |

Why the axis differs: a reason is a property of the *business* (it imports
directly, it has no category token in its name, it is mis-categorized), not a
property of the scan that found it. That is what keeps bronze from being
self-referential — see §7.

Note the platform axis is not gone — it moved. Gold slots are *typed* by
platform; bronze reasons may be *scoped* by platform (`scope_platform`, for
mechanics that only exist on one platform) and bronze *slots* record the
platform they were observed on (`observed_platform`). The axis stays reason;
platform is a scope dimension and a fill attribute (§3.6.5).

### 2.1 Shared machinery (reuse, do not fork)

Bronze reuses the existing gold standard machinery:

- Table: `mkt_intelligence_profiles` (ID generator `generateIntelligenceProfileId()` → `mip-{nanoid}`)
- `configuration_json` (currently `any` — carries `expected_fields`, `quality_gates`, `candidates[]`)
- `candidates[].platform_evaluations[]` with `platform`, `is_gold_standard`, `quality_score`
- `resolveGoldStandard(category, platform, city, state, ctx)` and `serializeGoldStandard(profile, role)`
- Emission cap discipline (`MAX_EXEMPLARS_PER_PLATFORM = 2`) — bronze needs its own cap, per §5.3

---

### 2.2 Terminology hazard — two artifacts are called "category intelligence"

This codebase has two distinct artifacts under that name. Confusing them will
produce a wrong design, so this spec disambiguates explicitly.

| | Producer | Scope | Schema | What it is |
|---|---|---|---|---|
| **Category Intelligence Profile** (`mip-*`) | establishment campaign (`mpt-seed-intel-profile-establishment-001`) | city (`reference_city`) | `intelligence_profile` | *How to discover* — terminology, specialized sources, discovery patterns, evidence rules, prohibited inferences, category signals |
| **Category market context** | **category enrichment** (`CategoryMarketEnrichmentService`) | `(category, city, state)` JSONB | `category_enrichment` | *What the market looks like* — `category_profile`, `category_signals`, `market_density`, `prospect_signals`, `secondary_categories` |

Per `INTELLIGENCE_CAMPAIGN_MARKET_CONTEXT_SPEC.md` §2, the PG workflow is:

```
STAGE 1: Location enrichment  → city_profile, market_gaps, metro_dynamics, notable_areas
STAGE 2: Category enrichment  → category_profile, category_signals, market_density,
                                prospect_signals, secondary_categories
STAGE 3: Establishment scan   → CONSUMES category_profile + city_profile + category_signals
                                PRODUCES gold standard profile
STAGE 4: Discovery            → CONSUMES category_profile + city_profile + market_gaps + ...
STAGE 5: Business audit       → CONSUMES all intelligence + gold standard
```

**Consequence for this spec:** category-level market intelligence is produced
by **category enrichment**, not by any establishment campaign. Establishment
*consumes* it. An emerging establishment run is a city-scoped setup step for
emerging discovery and is in no position to author category-level intelligence.

Wherever this spec says "the Category Intelligence Profile" it means the
establishment-produced `intelligence_profile` — the discovery how-to — never
the enrichment-produced market context.

## 3. The Reason Catalog (DB-authoritative; snapshotted into profiles)

The reason catalog is **category-level and city-agnostic**. It defines which
slots exist. Its authoritative store is the `mkt_bronze_reason_catalog` table
(§3.5) — a DB artifact with an admin UI, not a prompt output. The **national
bronze profile** produced by stage 1 (§6.1) carries a *snapshot* of the
scope-applicable catalog rows (keyed to `catalog_revision`, §3.5.2) plus the
national slot fills; the snapshot is what makes a historical profile
interpretable after the catalog moves on.

The catalog is **curated, not produced**: the seed set (§3.2) was derived
post-hoc from the Indianapolis sweep, and new reasons enter only through
operator authoring in the admin UI. The bidirectional check (§3.3) is the
*detection* mechanism that surfaces candidate reasons to operators — a
discovery pattern with no covering reason is a signal to author one, not an
automatic row insert. This matters for ordering: discovery patterns are
authored by the stage-2 establishment scan, which consumes the national
bronze profile — so if the scan also authored the catalog, the pipeline would
be circular. Catalog authorship stays outside the scan pipeline.

### 3.1 Shape

Each entry carries a stable `reason_key`, a human label, a definition, and a
**signal vocabulary** — the observable, searchable markers that a bronze
establishment scan hunts for (§6).

```json
{
  "reason_key": "trade_manifest_only",
  "label": "Trade / import-only visibility",
  "definition": "The business is category-qualified and operating, but its only public trace is a customs bill-of-lading record naming it as importer of record. It has no category-bearing platform profile.",
  "signals": [
    "bill of lading names the business as importer of record",
    "manifest line items name category-defining goods",
    "importer-of-record address differs from any directory listing address"
  ],
  "expected_vectors": ["customs / trade records"],
  "priority": 1
}
```

### 3.2 Seed catalog (derived, not invented)

Every entry below is grounded in the Indianapolis African Grocery Store sweep:

| `reason_key` | Label | Indianapolis instance | Vector | Scope | Priority |
|---|---|---|---|---|---|
| `misaligned_platform_category` | Mis-categorized platform category | Arsema — GBP primary category `Convenience store` | category-taxonomy sweep | universal | 1 |
| `no_category_token_in_name` | Name carries no category word | Arsema; Senay Habesha | endonym / transliteration sweep | universal | 1 |
| `trade_manifest_only` | Trade / import-only visibility | Arsema; Kaura International Food Market | customs bill-of-lading | category: `african_grocery_store` | 1 |
| `no_mainstream_profile` | No platform profile at all | Habesha Ethiopian Store LLC — registry only | address-indexed datasets | universal | 2 |
| `hosted_storefront_only` | Hosted storefront is the only web surface | `arsemamart.square.site` | site-scoped sweep | universal | 2 |
| `alternate_identity` | Second trading name at the same address | "Ethiopian Eritrean Store" listed at Arsema's address and phone | identity-conflict detection | universal | 2 |
| `corridor_absent_from_guides` | Storefront on no known retail corridor | W Washington St / W 10th St cluster | address clustering | universal | 2 |
| `wholesale_or_hybrid_role` | Wholesale or grocery-plus-kitchen hybrid | Amez International Imports; East African Imports Wholesale | foodservice / wholesale channels | category: `african_grocery_store` | 3 |
| `community_only_no_reviews` | Community-known, no reviews | hidden-trust grocers | community / referral networks | universal | 3 |
| `non_english_signage_only` | Non-English signage, no English listing | corridor storefronts | Street View sweep | universal | 3 |
| `absent_from_platform` | Confirmed operating, no profile on the observed platform | strong-on-Google businesses with no Facebook/Yelp presence | platform-presence audit | universal | 1 |
| `unclaimed_profile` | Platform profile exists but was never claimed | unclaimed GBPs | platform-presence audit | universal | 2 |
| `stale_or_missing_hours` | Profile carries no/unreliable hours | — | platform field audit | universal | 3 |
| `no_website_or_contact` | Profile lacks website link and contact info | — | platform field audit | universal | 3 |
| `zero_or_floor_reviews` | Profile present, zero-to-floor review count | — | platform field audit | universal | 3 |
| `thin_photo_surface` | Profile has no or floor-level photos | — | platform field audit | universal | 3 |
| `low_rating_floor` | Ratings absent or floor-level on the profile | — | platform field audit | universal | 3 |

The catalog is expected to grow per category **and per platform**. `priority`
orders slot-filling effort when budget is bounded. Seed priorities: **1** for
reasons with a confirmed instance that also name a concrete executable
vector, **2** for confirmed instances with a less-direct vector, **3** for
inferred instances.

**Platform-field reasons are the catalog's expected growth surface.** The
last seven rows share one vector — auditing the business's platform profile
for claim state and field completeness — but are separate reasons because
each is a distinct way a business reads as invisible or low-trust *on that
platform*. The platform is recorded on the slot (`observed_platform`, §4), so
one `absent_from_platform` reason covers "no Facebook for a highly-rated
Google business" and "nothing on Google for a business confirmed by trade
records" alike. Reasons that only exist on one platform bind it instead via
`scope_platform` (§3.6.5).

**Category-bound seed rows are deliberately narrow.** `trade_manifest_only`
and `wholesale_or_hybrid_role` are scoped to `african_grocery_store` — the
category they were observed in — not to "any import-goods category." Widening
them to universal (or to a broader category set) is a scope promotion per
§3.6.3: an SOP judgement, one row update. Seeding them universal would run
customs-record hunts against categories with no import supply chain — the
permanently-empty-slot failure mode §3.6 exists to prevent.

### 3.3 The bidirectional check

This is the core diagnostic property:

- **Pattern exists, slot empty** → the pattern may be broken, or the vector was not executed.
- **Reason exists, no pattern** → the pattern set is incomplete.

The second case is exactly the Arsema miss: the emerging profile had no
customs-records vector, so `trade_manifest_only` had no pattern to fill it.

### 3.4 Catalog versioning

The catalog is expected to **grow** — new reasons emerge as new vectors are
discovered. Versioning is therefore a first-class concern, not metadata.

**Rules:**

- **`reason_key` is immutable.** Once assigned, a key is never renamed or
  reused. Precedent: the `op_<slug>` immutability rule in
  `manual-play-templates.ts`. Keys are the join between catalog, slots,
  `vector_execution_log`, and every downstream profile.
- **The catalog is additive.** A reason is never deleted — only marked
  deprecated by stamping `deprecated_in_revision` (+ optional
  `deprecated_reason` / `superseded_by`). Historical city bronze profiles must
  remain interpretable after the catalog moves on.
- **`catalog_revision` is stamped on every bronze profile**, national and
  city. A city profile records which catalog revision its slots were filled
  against.
- **Version bumps on:** a new reason added; a reason's `definition`,
  `signals`, or `expected_vectors` changed; `priority` reordered; **scope
  columns changed** (widening or narrowing alters which profiles the reason
  applies to — see §3.6.3); a reason deprecated. Every bump writes
  `revised_in_revision` on the affected row (except inserts, which write
  `introduced_in_revision`, and deprecations, which write
  `deprecated_in_revision`).

**The version is what makes staleness detectable.** The emerging scan compares
the catalog revision its Category Intelligence Profile was authored against
with the current catalog revision. A profile authored against an older catalog
is missing reasons it has never been asked to cover — which is the Arsema
failure mode stated in version terms. Without the revision the gap is
invisible; with it, the gap is a single predicate (see §3.5.3).

### 3.5 Catalog store and operator authoring

The catalog lives in a **DB table with an admin UI**, not a seeded constant.
Rationale: operators accumulate field experience, encounter reasons no
derivation would surface, and need to author them in without a deploy. A
constant cannot accept that input, and the catalog's whole value is its
coverage.

**Governance: live immediately, no review gate.** This is an internal operator
workflow — a single operator or a team — not a tenant-facing module with
diverse inputs requiring quality control. An authored reason goes live into
stage-2 scans on save. Ownership is an SOP concern (typically one responsible
member), not a code-enforced gate.

Three consequences follow from removing the gate:

- **Deprecation is the only escape hatch.** The catalog is additive and keys
  are immutable, so a bad reason cannot be un-shipped — only deprecated. That
  makes clean deprecation more important here, not less.
- **`created_by` is the accountability mechanism.** Without review, attribution
  is what makes a bad reason traceable to its author.
- **The test affordance (§3.5.5) is the only feedback loop.** With no gate and
  live authoring, trying a reason against a real city is the sole quality
  mechanism. It is not optional polish.

#### 3.5.1 Table

`mkt_bronze_reason_catalog` — follows the `mkt_manual_play_templates` precedent
(migration 288) for an operator-authored catalog:

| Column | Notes |
|---|---|
| `reason_key` | Primary key. Immutable. `UNIQUE`. |
| `label` | Display name |
| `definition` | What the reason means |
| `signals` | `jsonb` — the searchable signal vocabulary (§3.1) |
| `expected_vectors` | `jsonb` — which vectors should surface it |
| `priority` | 1–5, orders slot-filling effort |
| `scope_category_key` | Text, nullable — `NULL` = any category (§3.6.1). **Normalized on write** via `normalizeCategoryKey` — see below |
| `scope_city` / `scope_state` | Text, nullable — `NULL` = any market (§3.6.1). **Normalized on write** via `normalizeReferenceCity` / `normalizeReferenceState` — see below |
| `scope_platform` | Text, nullable — `NULL` = platform-agnostic (§3.6.5). Values come from the gold platform vocabulary (`google`, `yelp`, `facebook`, `website`, `bing`, `apple_maps`), lowercased on write |
| `provenance` | `derived` \| `operator_authored` |
| `introduced_in_revision` | Integer — which catalog revision added it |
| `revised_in_revision` | Integer, nullable — which revision last changed `definition` / `signals` / `expected_vectors` / `priority` / scope columns. Required for the staleness query to catch *modified* reasons, not just new ones (§3.5.3) |
| `deprecated_in_revision` | Integer, nullable |
| `deprecated_reason` | Text, nullable |
| `superseded_by` | `reason_key`, nullable — points a retired duplicate at the canonical reason (§3.5.6) |
| `created_by` / `created_at` / `updated_at` | Standard. `updated_at` is maintained by the catalog service on every write — `mkt_*` tables carry no `updated_at` trigger |

**Scope values are normalized on write — this is not optional.** §3.6.4
rejects free-text region scope because a scope mismatch silently matches
nothing and produces a phantom gap. The identical hazard applies to
`scope_category_key` (`'African Grocery Store'` vs `african_grocery_store`)
and `scope_city` / `scope_state` (`'Indiana'` vs `'IN'`). The catalog service
applies `normalizeCategoryKey` / `normalizeReferenceCity` /
`normalizeReferenceState` (the same normalizers `importAsDraft` uses for
profile scope fields) to every write, and the admin UI offers
`scope_category_key` as a dropdown of existing category keys rather than a
free-text field. A scope value that fails to normalize is rejected at write
time, not silently stored.

**No CHECK constraints** — `provenance` and any status field are validated in
code, per the `mkt_manual_play_templates` precedent. This is deliberate: per
AGENTS.md the `chk_*` ↔ app-enum drift has bitten three times (migrations 256,
264, 270), and an operator-editable catalog is exactly the surface where a
stale CHECK would cause 500s at runtime.

`mkt_*` tables do not enable RLS and do not use explicit `updated_at` triggers
(per `manual-sql-migration-policy.md`).

#### 3.5.2 Revision model

Because operators author continuously, the revision cannot be a hand-bumped
constant. Use a **monotonic integer `catalog_revision`**, incremented on every
catalog write. Each reason row records `introduced_in_revision`,
`revised_in_revision`, and `deprecated_in_revision`.

This gives ordered comparison, which a content hash does not. (The codebase
does use content hashing elsewhere — `evidence_snapshot_hash` in
`SeedIntelligenceReportService` — but hashes are unordered and cannot answer
"is this profile behind?")

**The counter needs a home.** Deriving "current revision" as
`MAX(introduced_in_revision)` is wrong: if the latest write was a deprecation
or a content edit, `MAX(introduced_in_revision)` is stale and the next write
reuses a revision. Store the counter in a single-row table:

`mkt_bronze_catalog_meta` — `id` (text PK, always `'catalog'`),
`catalog_revision` (int, seeded at 1 by the DDL migration's seed rows),
`updated_at`. The catalog service bumps it inside the same transaction as the
catalog write and returns the new value, which the caller stamps onto
`introduced_in_revision` / `revised_in_revision` / `deprecated_in_revision`
as appropriate. Reading the current revision for a profile stamp is a plain
`SELECT` — never computed from the reason rows.

Immutable-key enforcement moves to runtime: the admin UI disables the key field
on existing rows, and the service rejects key mutation. The `UNIQUE` constraint
catches accidental reuse.

#### 3.5.3 The staleness query

With the revision columns on every reason, the staleness question is one
predicate rather than a diff. It must check **both** `introduced_in_revision`
and `revised_in_revision` — a reason whose `signals` changed after the
profile was authored is just as uncovered as a reason that did not exist:

```sql
-- Reasons this profile has never been asked to cover, or is covering
-- against a stale definition.
-- Scope-filtered, or a profile for one market would be flagged as missing
-- reasons scoped to a different market.
SELECT reason_key, label,
       CASE WHEN introduced_in_revision > :profile_catalog_revision
            THEN 'never_covered'
            ELSE 'revised_since_authored' END AS gap_kind
FROM mkt_bronze_reason_catalog
WHERE GREATEST(introduced_in_revision,
               COALESCE(revised_in_revision, 0)) > :profile_catalog_revision
  AND deprecated_in_revision IS NULL
  AND (scope_category_key IS NULL OR scope_category_key = :category_key)
  AND (scope_city         IS NULL OR scope_city         = :city)
  AND (scope_state        IS NULL OR scope_state        = :state);
```

That result set is the profile's **uncovered reason list** — the concrete,
enumerable form of the Arsema gap. `never_covered` is the Arsema case
verbatim; `revised_since_authored` means the profile's coverage of that
reason was authored against an older definition and should be re-examined.
Deprecated reasons drop out of future profiles and are not flagged — a
deprecation after authoring creates no coverage gap (§3.4 keeps the retired
slot interpretable).

#### 3.5.4 Operator-authored reasons are unproven by default

A reason authored by an operator has, by definition, never been shown to be
findable. That is fine and is the point — but it must be visible. An
`operator_authored` reason with no national exemplar (§6.2) should be marked
unproven rather than silently hunted, and stage 2 should report it distinctly
from a `derived` reason that came back empty.

#### 3.5.5 Authoring needs a test affordance

Without one, the catalog accumulates unproven reasons that nobody validates,
and coverage grows while confidence does not. The admin UI should let an
operator **trigger a scan for a single reason in a single city** and see
whether it yields — backed by
`POST /api/admin/marketing-ops/bronze-reasons/:reasonKey/test-scan` (§10.3).
Test scans return the outcome to the UI and write no profile: they validate
the reason, they do not fill slots. That closes the loop between authoring
and the stage-2 scan, and it turns the catalog into something operators can
iterate on rather than merely append to.

Catalog writes should go through the existing `audit()` helper with
`actorType: 'user'` so authoring is attributable.

#### 3.5.6 Superseding a duplicate instead of merging

Live authoring with no review gate guarantees that near-duplicate reasons will
appear. The catalog is additive and keys are immutable, so the answer is not a
merge workflow — it is **supersession**: deprecate the duplicate and set
`superseded_by` to the canonical `reason_key`.

This costs one nullable column and preserves history. Historical city bronze
profiles that filled the retired key stay interpretable, and the consumer can
follow `superseded_by` to the canonical reason without any past slot being
rewritten.

### 3.6 Reason scope model

Reasons are not all universal. The §3.2 seed splits into three kinds, and
operator authoring adds a fourth:

- **Universal** — `misaligned_platform_category`, `no_category_token_in_name`,
  `no_mainstream_profile`, `hosted_storefront_only`,
  `corridor_absent_from_guides`, `community_only_no_reviews`,
  `alternate_identity`, `non_english_signage_only`, and the platform-field
  reasons (`absent_from_platform`, `unclaimed_profile`, and the field-gap
  family). Apply to any category with hidden prospects.
- **Category-bound** — `trade_manifest_only` requires an import supply chain;
  `wholesale_or_hybrid_role` is meaningless for a category with no wholesale
  tier.
- **Platform-bound** — a reason that only exists on one platform (§3.6.5).
  `scope_platform` set; still evaluable at any geography.
- **Location-bound** — authored by an operator who knows their market. A
  reason that only holds in one metro.

Without scoping, a global catalog would run `trade_manifest_only` against auto
repair on every stage-2 pass — wasting a vector and producing a permanently
empty slot, which poisons the empty-slot signal the whole design depends on.

#### 3.6.1 Shape — nullable scope columns

One table, one authoring UI, four category/location levels:

| Level | `scope_category_key` | `scope_city` | `scope_state` |
|---|---|---|---|
| Universal | `NULL` | `NULL` | `NULL` |
| Category | set | `NULL` | `NULL` |
| Location | `NULL` | set | set |
| Category + location | set | set | set |

`scope_platform` is an **independent axis**, not a fifth level — any of the
four levels may additionally be platform-bound (§3.6.5).

`NULL` means wildcard. Matching is a single predicate — evaluated against the
**normalized** values, since all scope columns are normalized on write
(§3.5.1) and the caller normalizes `:category_key` / `:city` / `:state` /
`:platform` the same way:

```sql
WHERE (scope_category_key IS NULL OR scope_category_key = :category_key)
  AND (scope_city         IS NULL OR scope_city         = :city)
  AND (scope_state        IS NULL OR scope_state        = :state)
  AND (scope_platform     IS NULL OR :platform IS NULL
       OR scope_platform = :platform)
  AND deprecated_in_revision IS NULL
```

The platform clause reads: platform-agnostic reasons always apply; a
platform-bound reason applies when the scan is scoped to that platform — and
a cross-platform scan (`:platform IS NULL`) evaluates *all* platform-bound
reasons, since it covers every platform.

#### 3.6.2 City is the location unit — corridor detail is not scope

Corridor specificity belongs in a reason's **signals and evidence**, not in its
scope. `corridor_absent_from_guides` is a universal reason; the *actual
corridors* are city-specific instantiations that live in the city bronze
profile's slots.

Scope finer than city (ZIP, corridor, neighborhood) would fragment the catalog
into one-off entries and make the staleness query meaningless.

#### 3.6.3 Location scope is the exception — and should look like one

The catalog's value is that it is authored once and reused across metros.
A location-scoped reason is authored once and used once. That is legitimate —
operator market knowledge is real — but it should not crowd out the universal
reasons, and it carries a specific hazard:

**A location-scoped reason can encode a portable lesson as a local fact.** An
operator who authors "west-side Indianapolis industrial corridor" has fixed
Indianapolis and learned nothing that transfers to Milwaukee. The portable
version is the universal reason `corridor_absent_from_guides` plus address
clustering as its vector.

Practical guidance:

- The authoring UI **defaults to universal** and requires deliberate action to
  narrow scope. Narrowing should be a conscious choice, not a default.
- When a location-scoped reason is authored, the UI should prompt whether it
  generalizes — a nudge, not a gate, since authoring is live.
- A city bronze profile should report how many of its reasons came from
  location-scoped rows, so the portable/locale ratio is visible over time —
  carried as `scope_mix` on the profile (§4).

**Promotion is a switch flip, and it is an SOP judgement call.** If a
location-scoped reason turns out to generalize, widening it is a one-row
update — and because scope changes alter which profiles the reason applies
to, they are revision-bumping writes (§3.4). In practice this goes through
the catalog service, which stamps `revised_in_revision` from the catalog
counter; shown literally:

```sql
-- :new_revision comes from mkt_bronze_catalog_meta (§3.5.2), bumped in the
-- same transaction as this update.
UPDATE mkt_bronze_reason_catalog
SET scope_city = NULL, scope_state = NULL,
    revised_in_revision = :new_revision, updated_at = now()
WHERE reason_key = :reason_key;
```

The same mechanism widens a category-bound reason
(`SET scope_category_key = NULL`) — e.g. promoting `trade_manifest_only`
once it proves out across several import categories.

No promotion machinery, no slot rewriting, no key change. Existing city bronze
profiles that filled the narrowed version stay valid; the next scan simply sees
a wider reason. **The operator decides whether a reason generalizes — the
schema's only job is to make acting on that decision cheap.** Do not automate
the inference.

#### 3.6.4 Regional scope — out of scope, deliberately

Operator reasons *can* be bounded by geography that is neither a city nor a
nation: a distributor territory, a state licensing regime, a regional
community-organization network. That case is real, but it is **not supported at
this time.**

**Decision: location scope is city + state only.** City and state are already
the location vectors embedded in the campaign architecture. Adding a region
level would mean altering that architecture, which is not warranted now.

**Why city/state is not merely convenient but correct.** The prospect set is
independent retailers with physical real estate — non-chain, non-national.
Their market is bounded by where a shopper will actually travel, which is
city-and-below, not region-and-above. A region-scoped *visibility* reason would
model an entity that does not exist for this prospect class.

This also explains why supply-side geography does not generate reasons here. A
regional distributor relationship is real, but it is a *supply* fact, not a
*visibility* fact — and visibility reasons describe a business's public trace,
which for an independent is local. So the regional-reason case largely
evaporates under this structure rather than merely being deferred.

**Generalization:** scope granularity should follow the prospect set's market
structure. City/state is right for independents. A franchised or
regional-chain prospect class would legitimately reopen the region question —
so the correct statement is "regions are not needed for *this* prospect class,"
not "regions are never needed."

The cost investigation is what drove the decision. The injection point already
exists — `renderGoldStandardRegionDirective` in `MarketingExecutionService`,
with the right two-mode shape (nationwide vs. region-narrowed). But there is
**no region entity, no vocabulary, and no city → region mapping** anywhere in
the codebase: in that code, "region" is prose that resolves to `city, state`;
the nationwide branch says "span at least 3 distinct states/regions"; and
`regional_city_opportunity` is a *scan output* whose `regional_accessibility`
is a 0–1 score, not a region identifier.

So region scope would need two new artifacts (a controlled vocabulary and a
mapping) *plus* a campaign-architecture change. Two notes for whenever it is
revisited:

- **Free-text region scope must be rejected.** A scope mismatch silently
  matches nothing, and in this design an empty slot is supposed to be a
  *meaningful finding*. `Midwest` vs `midwest` would produce a permanent
  phantom gap.
- **The naming collision will need reconciling.** If a real region entity is
  introduced, `renderGoldStandardRegionDirective`'s use of "region-narrowed"
  for a city/state-scoped search becomes ambiguous. Same class of hazard as
  §2.2.

**Consequence for the catalog today:** a reason that genuinely only holds
across a multi-state region has no correct scope. Author it as **universal**
and let the city bronze profile record where it actually yielded, or leave it
unauthored. Do not approximate a region with a state unless the reason really
is state-bounded.

#### 3.6.5 Platform scope — bound vs. observed

Platform is a scope dimension, but most platform reasons should not use it.
Two distinct cases:

- **Platform-observed** — the reason applies on *any* platform; the platform
  is an attribute of the *fill*, not of the reason. `unclaimed_profile`,
  `zero_or_floor_reviews`, `stale_or_missing_hours`, `absent_from_platform`,
  and the rest of the field-gap family are platform-agnostic:
  `scope_platform = NULL`, and the slot records where the reason was seen via
  `observed_platform` (§4.2). One `absent_from_platform` row covers "no
  Facebook for a highly-rated Google business" and "nothing on Google for a
  trade-records-only business" — per-platform keys
  (`facebook_absent`, `google_absent`, ...) would fragment the catalog the
  way ZIP-level location scope would (§3.6.2).
- **Platform-bound** — the reason only *exists* on one platform because the
  mechanic is platform-specific (a GBP primary-category quirk, an Apple Maps
  data-source artifact, a platform whose listing model has no equivalent
  elsewhere). `scope_platform` set to the gold platform vocabulary
  (`google`, `yelp`, `facebook`, `website`, `bing`, `apple_maps`).

The default is platform-observed; binding is the exception and the authoring
UI should treat it as one, same as location scope (§3.6.3). When in doubt,
author platform-agnostic and let `observed_platform` carry the detail.

**Platform scope is orthogonal to geography** — a platform-bound reason is
still nationally evaluable, so platform binding alone never makes a reason
unevaluable at stage 1 (§6.2.1).

**Bronze profiles may be platform-scoped.** `reference_platform` is optional
on bronze profile rows: `null` (cross-platform) is the default and covers all
reasons; a platform-scoped profile (e.g. a Google-floor run) evaluates only
reasons whose `scope_platform` is `NULL` or matches (§3.6.1). This reuses the
existing identity-tuple dimension for free — a `google`-scoped bronze profile
and the cross-platform bronze profile for the same market are distinct rows
that never retire each other.

---

## 4. Bronze Profile Shape

The bronze profile has two scopes sharing one shape:

- **National** (stage 1) — `reference_city: null`, `reference_state: null`.
  Carries a revision-stamped snapshot of the nationally-applicable catalog
  (§3) and the national proof slots.
- **City** (stage 2) — `reference_city` / `reference_state` set. Carries the
  scope-applicable reason set for this market with city slots filled.

Both carry `intelligence_focus: 'bronze_standards'` on the profile row
(§10.2) — the focus value is what separates bronze from gold in the profile
identity tuple. `reference_platform` is **optional**: `null` (cross-platform)
is the default; a platform-scoped bronze profile evaluates only reasons whose
`scope_platform` is `NULL` or matching (§3.6.5).

Scope is distinguished by `reference_city` alone — the same convention the
gold standard uses for nationwide profiles with `city` optional. The example
below is the city variant.

```json
{
  "category_key": "african_grocery_store",
  "category_name": "African Grocery Store",
  "reference_city": "Indianapolis",
  "reference_state": "IN",
  "reference_platform": null,
  "catalog_revision": 7,
  "reason_coverage": [
    {
      "reason_key": "trade_manifest_only",
      "status": "filled",
      "slots": [
        {
          "business_name": "Arsema Food Mart",
          "category_fit_evidence": "Import manifests name brown teff flour, berbere, mitin shiro, finger millet, roasted cardamom.",
          "operational_evidence": "Indiana LLC active since 2015-08-18; 25,160 kg shipment arrived 2026-06-20; SNAP-authorized at the retail address.",
          "discovered_by": "operator_self_discovery",
          "discovered_via": "US Customs bill of lading records",
          "evidence_urls": ["https://www.importgenius.com/importers/arsema-g-food-mart-llc"],
          "digital_quality": "low",
          "platform_presence": {
            "google": "present_generic_category",
            "yelp": "not_verified",
            "facebook": "not_verified",
            "website": "hosted_storefront_unverified"
          }
        }
      ]
    },
    {
      "reason_key": "absent_from_platform",
      "status": "filled",
      "slots": [
        {
          "business_name": "Habesha Ethiopian Store LLC",
          "observed_platform": "google",
          "category_fit_evidence": "Registry filing + storefront signage name Ethiopian goods; assortment corroborated by trade records.",
          "operational_evidence": "Indiana LLC active; utility and registry records at the storefront address.",
          "discovered_by": "bronze_establishment_scan",
          "discovered_via": "platform-presence audit — no GBP found; existence confirmed via registry",
          "evidence_urls": ["..."],
          "digital_quality": "very_low",
          "platform_presence": {
            "google": "absent",
            "yelp": "not_verified",
            "facebook": "not_verified",
            "website": "absent"
          }
        }
      ]
    },
    {
      "reason_key": "community_only_no_reviews",
      "status": "empty_unproven",
      "empty_slot_note": "No exemplar found in this market during this pass; no exemplar has been found at any evaluable scope. Vector was not executed."
    },
    {
      "reason_key": "corridor_absent_from_guides",
      "status": "empty_proven_elsewhere",
      "empty_slot_note": "Proven at national scope (2 exemplars) but this market returned nothing. Vector executed, returned 0."
    }
  ],
  "not_applicable_reasons": ["wholesale_or_hybrid_role"],
  "scope_mix": { "universal": 15, "category": 2, "location": 0, "category_location": 0, "platform_bound": 0 },
  "vector_execution_log": [
    { "vector": "customs / trade records", "executed": true, "returned": 4 },
    { "vector": "community / referral networks", "executed": false, "returned": null }
  ],
  "prohibited_inferences": ["..."]
}
```

### 4.1 `reason_coverage[].status` — the three-state vocabulary

`status` is how §6.2.2's mandatory distinction survives into the emitted
artifact. The enum is:

| Value | Meaning |
|---|---|
| `filled` | At least one qualifying exemplar found in this market this pass |
| `empty_unproven` | No exemplar here, and none has ever been found at any evaluable scope (§6.2.1) |
| `empty_proven_elsewhere` | No exemplar here, but proven at national scope or another market — a real finding about this market |

A reason that fails the scope predicate is **not evaluable here** and does
not get a `reason_coverage` entry at all — it is listed by key in
`not_applicable_reasons`. Omission is what keeps a non-applicable reason from
reading as a gap, and the key list is what keeps omission from being
indistinguishable from forgetfulness.

Each entry also carries `empty_slot_note` (free text recording the execution
outcome — "executed, returned 0" vs "not executed" is the material
distinction, mirrored in `vector_execution_log`).

### 4.2 Field vocabularies

- `reason_coverage[].status` — enum per §4.1, validated by the
  `bronze_standard_scan` output schema (§10.3).
- `discovered_by` — enum per §4.3.
- `platform_presence.<platform>` — a small controlled vocabulary defined in
  the output schema (`present_generic_category`, `present_category_aligned`,
  `present_unclaimed`, `not_verified`, `absent`, `hosted_storefront_unverified`).
  Not free text — the emitted profile is a calibration artifact other prompts
  consume.
- `observed_platform` — set on slots filled for platform-anchored reasons
  (§3.6.5): which platform the reason was observed on (gold platform
  vocabulary). For `absent_from_platform` this names the platform the
  business is missing from; for `unclaimed_profile`, the platform carrying
  the unclaimed profile. `null` for reasons that aren't platform-anchored.
- `digital_quality` — `low | very_low`. A bronze slot is by definition low
  digital quality (§5.1); the enum exists only to separate "thin" from
  "nearly absent," never to rank.
- `scope_mix` — counts of the profile's applicable reasons by scope level
  (§3.6.1) plus a `platform_bound` count (§3.6.5); makes the portable/locale
  ratio visible (§3.6.3).
- `catalog_revision` — integer, stamped from `mkt_bronze_catalog_meta` at
  scan time (§3.5.2).
- `reference_platform` — optional. `null` (cross-platform) is the default and
  evaluates every applicable reason; a platform-scoped profile filters the
  reason set per §3.6.1. The value participates in the profile identity
  tuple, so platform-scoped and cross-platform bronze profiles coexist
  without retiring each other (§3.6.5).

### 4.3 `discovered_by` provenance enum

`operator_self_discovery | business_audit | emerging_scan | competitive_scan | bronze_establishment_scan`

Provenance is load-bearing (§7.2). A slot filled by `emerging_scan` is
confirmatory; one filled by `operator_self_discovery` or `business_audit` is
independent ground truth.

---

## 5. Slot Semantics

### 5.1 A slot is a floor, not a ranking

Gold's flag is relative — *"at least as strong as the existing benchmark
qualifies."* Bronze cannot use the mirror rule, because "weaker than the
existing bronze" is unbounded downward and runs straight into nonexistence.

A bronze slot therefore holds **the lowest digital quality that still
qualifies as a real, operating, category-fit business**. It defines a
boundary, not a bottom.

### 5.2 The operational gate is mandatory

Without it, bronze fills with **closed businesses** — a defunct listing has no
hours, no website, no photos, and no reviews, so it scores as maximally
bronze. The emerging scan would then calibrate toward graveyards.

**A slot qualifies only when all three hold:**

1. **Category-qualified** — assortment evidence, per the category
   intelligence evidence rules (category fit is established from observable
   assortment, not from the platform's category label — the same rule the
   competitive focus block states as "verify specialization from assortment
   evidence, not from the label").
2. **Operationally verified** — `operational_status` is `active` or
   `likely_active`. **`unable_to_verify` does not qualify**, or thin-footprint
   businesses would be excluded by the very test they are meant to pass.
3. **Low digital quality** — the reason key explains *why*.

### 5.3 Emission discipline

Platform × reason is a sparse matrix — a business invisible for
`trade_manifest_only` reasons typically has no platform presence at all, so
most cells are empty. Emit:

- all **filled** slots, capped at **`MAX_SLOTS_PER_REASON = 2`** per reason —
  mirroring `MAX_EXEMPLARS_PER_PLATFORM = 2`. Two exemplars per reason is
  enough to calibrate; more is token cost without marginal signal. (Resolves
  open question §11: per-reason, not global.)
- a compact **empty-slot report** for unfilled reasons — one line per reason
  carrying its §4.1 status and the execution outcome
- the **`vector_execution_log`**

Do **not** emit the full grid. The sparsity pattern is itself a finding.

---

## 6. Producer Pipeline — Three Stages

Bronze is produced by a three-stage chain. Stage 1 is category-scoped and
national; stages 2 and 3 are city-scoped and mirror the existing emerging
focus/kind split.

### 6.1 The chain

| Stage | Campaign | Scope | Focus / Kind | Consumes | Produces |
|---|---|---|---|---|---|
| **1** | National bronze standard | category (nationwide) | `bronze_standards` / establishment | `mkt_bronze_reason_catalog` (universal + category rows for this category) + category enrichment context | **National bronze profile** — revision-stamped catalog snapshot + national reason slots |
| **2** | City bronze scan | category + city | `bronze_standards` / discovery | national bronze profile (proof state) + `mkt_bronze_reason_catalog` (adds location-scoped rows for this market) | **City bronze profile** (city reason slots filled) |
| **3** | City emerging discovery | category + city | emerging / discovery | city bronze profile + Category Intelligence Profile | prospects |

Two run-shape notes:

- The **Category Intelligence Profile is still emitted by the existing
  emerging-establishment campaign**, unchanged. Stage 2 in this table is the
  *bronze* city scan — a separate campaign with `intelligence_focus =
  'bronze_standards'`, which is also what keeps it out of the
  structural-duplicate guardrail's collision space (§10.2). Whether the
  bronze city scan instead runs *inside* the emerging-establishment campaign
  is open (question 2, §11) — but the artifact flow is identical either way,
  because
  each imported payload is validated and persisted by its own schema-named
  hook: a combined run would simply have two `/executions/external` imports
  (`intelligence_profile` + `bronze_standard_scan`) rather than a composite
  schema.
- Stage 1's kind is `establishment` (it authors a profile); stage 2's kind is
  `discovery` (a live-search run that happens to author a profile — §6.3).
  The bronze post-import hook therefore persists a draft **keyed on the
  schema name alone**, not on campaign kind (§10.3).

Stage 3's existing behaviour is unchanged: the emerging discovery scan already
loads the stage-2 establishment profile via
`IntelligenceProfileService.resolve(category, focus, city, platform)` and
injects it as a guide. The only change is that a **second** block — the city
bronze profile — is injected alongside it, resolved by
`resolveBronzeStandard(category, city, state)` (§10.3).

This parallels the gold standard, which is also nationwide with `city`
optional, and whose consumers already receive dual injection (intelligence
profile block + gold standard block).

### 6.2 Stage 1 — national bronze standard

Reads the scope-applicable catalog rows (universal + category-bound for this
category — location-scoped rows are never nationally evaluable, §6.2.1),
embeds a revision-stamped snapshot of them in the profile, and proves **at
national scope** that each nationally-applicable reason is real and
reachable. National slots are illustrative proof, not calibration targets for
any specific market.

#### 6.2.1 Proof is scope-relative

A reason can only be proven at a scope where it can be *evaluated*. A
location-scoped reason has no national exemplar **by construction** — it
cannot be filled at stage 1 at all. The naive rule ("no national exemplar =
unproven") would mark every location-scoped reason permanently unproven, which
is wrong.

**A reason is proven at the narrowest scope where it is evaluable.**

| Reason scope | Proven at |
|---|---|
| Universal | stage 1 (national) |
| Category | stage 1 (national), for that category |
| Platform-bound | stage 1 (national), on that platform — platform is not geographic (§3.6.5) |
| Location (city/state) | stage 2 (city), for that market |
| Category + location | stage 2 (city), for that category and market |

#### 6.2.2 Three states, never conflated

When stage 2 cannot fill a reason, it must distinguish:

1. **Unproven** — no exemplar has ever been found at any evaluable scope.
   Emitted as `status: 'empty_unproven'` (§4.1).
2. **Proven elsewhere, empty here** — proven nationally or in another market,
   but this market returned nothing. A real finding about this market.
   Emitted as `status: 'empty_proven_elsewhere'`.
3. **Not evaluable here** — scope mismatch; the reason does not apply.
   Emitted as a key in `not_applicable_reasons`, never as a coverage entry.

Conflating these is the failure mode this design exists to prevent. An
unproven reason and a genuinely absent one must never look the same, and a
reason that does not apply must never appear as a gap. The `status` enum and
`not_applicable_reasons` list in §4 are what carry this distinction into the
emitted artifact — the serialization in §7.1 and the `bronze_standard_scan`
output schema both depend on it.

**Stage 2 hunts unproven reasons too.** An unproven reason is hunted like any
other — the hunt is how it becomes proven — but it is *reported* distinctly
(§3.5.4). Skipping unproven reasons at stage 2 would be cheaper and would
guarantee they never close. (Resolved — see §11.1.)

### 6.3 Stage 2 — city emerging establishment

Scans the reference city against the **scope-applicable** catalog — the
national profile's snapshot (universal + category rows) plus this market's
location-scoped rows from `mkt_bronze_reason_catalog` — hunting for
businesses that match each reason's signal vocabulary, and fills the city
reason slots. It is a research task with live search — the difference from
the gold standard, where establishment defines criteria and discovery fills
slots.

For each applicable reason, in `priority` order:

1. Execute the reason's `expected_vectors` against the reference market.
2. For each candidate returned, evaluate the three-part qualification in §5.2.
3. Record the slot, or record the reason with the correct §4.1 empty status
   **and the execution outcome** — "executed and returned nothing" is a
   materially different finding from "not executed."
4. Log every vector attempt in `vector_execution_log`.

Step 3 is what makes the stage self-diagnosing: an unexecuted vector is an
admitted blind spot rather than a silent gap.

### 6.4 City bronze profile is a sibling, not a section

Stage 2 emits the city bronze profile as a **separate profile** rather than
extending the Category Intelligence Profile, for four reasons:

1. **Different lifecycle.** The Category Intelligence Profile is a stable
   reference; bronze slots decay as businesses digitize and need re-scanning.
   Merging them forces re-establishment of the patterns every time slots
   refresh.
2. **Different injection role.** The profile block carries rules; the bronze
   block carries exemplars. `serializeGoldStandard` already takes a role
   parameter, and the business audit path already performs dual injection.
3. **Different scoping.** The Category Intelligence Profile is city-scoped but
   city-agnostic in content; the city bronze profile is city-specific by
   construction.
4. **Token budget.** The bronze block is exemplar-heavy and benefits from an
   independent emission cap (§5.3).

---

## 7. Consumer — Emerging Scan

The stage-3 emerging discovery scan is the primary consumer, receiving the
**city bronze profile** injected alongside the Category Intelligence Profile.
The bronze block is injected to **frame the analyst's research** for the city.

### 7.1 Framing, not filtering

The bronze block must not become a candidate-selection filter. Its job is to
tell the analyst what the target looks like and which vectors reach it:

- **Filled slots** → concrete calibration exemplars: "a hard-to-find business
  in this market looks like this, and this vector reveals it."
- **Empty slots** → an explicit statement of what is not yet covered.
- **`vector_execution_log`** → which vectors have been proven in this market
  and which have not.

Existing precedent for a non-benchmark gold-standard role is the
`market_reference` role, which shapes copy without filtering candidates.

### 7.2 Why this does not close the loop

If the emerging scan both *fills* bronze slots and *consumes* bronze, the
system teaches itself what it already finds. Two rules prevent it:

1. **Fill provenance must be recorded.** Slots filled by `emerging_scan` are
   marked confirmatory; slots from `operator_self_discovery` or
   `business_audit` are ground truth. The consumer weights them accordingly.
2. **The reason axis is external.** A reason is a property of the business,
   not of the scan. The emerging scan cannot invent a `trade_manifest_only`
   slot without executing the customs vector — and if it cannot, the slot
   reports empty, which is the desired signal.

The Arsema class of miss becomes visible as an **empty slot** rather than as
an undetected error. That is a stronger guarantee than the structural
self-test in the emerging establishment template, because it is an observation
rather than a self-assessment.

### 7.3 Business audit as an out-of-loop fill source

Business audits already emit `gap_analysis.gaps[]` (with severity) and
`quality_gate_results.results[]` (with `passed: true | false | null`)
evaluated *against the gold standard*. A category-qualified, operationally
verified business failing many `non_negotiable` gates **is** a bronze exemplar,
and it arrived via the queue → audit path rather than via any scan. This is
the highest-trust fill source and should be preferred over scan-derived fills.

**Write path.** Out-of-loop fills are applied by
`IntelligenceProfileService.recordBronzeExternalFills(profileId,
fills)` (single-fill calls delegate via `recordBronzeExternalFill`) —
a method that:

1. Loads the **active** bronze profile resolved at the campaign's
   (category, platform, city, state) scope via `resolveBronzeStandard`'s
   city → state → nationwide cascade. If none exists, the fill is recorded
   nowhere — a bronze exemplar without a bronze profile is noted, not
   written. (Creating a profile from a fill would fabricate coverage the
   scan never ran.)
2. Writes **one new draft version** that carries the prior version's
   `reason_coverage` forward and appends every slot under its matching
   `reason_key`. A batch of fills never produces a batch of versions. The
   draft follows the normal operator activation path (`activateDraft`) —
   an external fill never silently mutates the active profile.
3. Dedupes on `business_name` + address within the reason — a re-audit of
   the same business updates the slot in place rather than appending.

**Audit-lane automation (implemented).** When a `business_analysis` audit
imports on a campaign whose `discovery_context.bronze_attribution` is
non-empty AND the audit confirms low digital quality (at least one failed
`non_negotiable` quality gate, or a `non_negotiable` gap when gate results
are absent), the import hook writes each attributed reason a
`discovered_by: 'business_audit'` slot — ground truth that survives
re-scans. An attributed prospect that passes its gates is not a bronze
exemplar and writes nothing.

**Merge semantics on re-scan.** Provenance is what survives a re-scan. When a
stage-2 import produces a new draft, the post-import hook carries forward
slots whose `discovered_by` is `operator_self_discovery` or `business_audit`
from the previously active version, then overlays the scan's own fills
(`emerging_scan`, `competitive_scan`, `bronze_establishment_scan`). Scan
provenance means "the scan found this again or it drops"; external
provenance means "this was observed out-of-loop and persists until an
operator removes it." Without this rule every re-scan would silently discard
the highest-trust slots — the exact ground truth the design depends on.

### 7.4 Reason attribution on prospects

Calibration that never gets credited is a sunk cost — the operator cannot
tell whether the catalog's hunt list actually surfaces prospects or is just
prompt overhead. So when a bronze profile is active and a catalog reason is
**directly responsible** for a prospect's finding, the emerging scan
attributes the find in its output JSON.

- **Per-candidate field.** `discovered_businesses[].bronze_attribution` (and
  the mirrored `qualifying_businesses[]` records) is an array of
  `{ reason_key, basis }` — the reason's catalog key plus a one-line basis
  naming the vector or signal that produced the find.
- **Causal, not resemblance.** Attribution is emitted only when the reason
  *caused* the find: its `expected_vectors` surfaced the business, or its
  signal vocabulary is what identifies the business as
  category-qualified-but-invisible. A candidate mainstream discovery would
  have found anyway carries no attribution, and a candidate that merely
  resembles a bronze exemplar but was not reached through the reason's
  vector gets none either.
- **Conditional emission.** The instruction lives in the injected
  `BRONZE STANDARD — MARKET CALIBRATION` block (`serializeBronzeStandard`,
  `discovery` role), so a scan with no active bronze profile is
  byte-identical to the pre-attribution contract. The field is optional +
  nullable in `intelligence-discovery.schema.ts` — legacy payloads import
  cleanly.
- **Downstream carry.** The audit card renders attribution as a
  `bronze: <reason_key>` chip and writes it into `business_snapshot` on
  queue-add; `createCampaignFromQueue` folds it into `discovery_context`,
  so the business audit's "Discovery leads" block can name the blind spot
  that surfaced the prospect. It also spills into the **triage briefing**:
  the signal_triage path keeps the full Discovery Leads block suppressed
  (repair signals are the sole hypothesis input) but appends a compact
  `PROSPECT ORIGIN — BRONZE DISCOVERY ATTRIBUTION` block — attribution is
  provenance, not a hypothesis, and it is pitch framing for the briefing's
  Pitch section. The block exists only for **emerging-lane** prospects —
  the calibration block is injected on `focus === 'emerging'` alone, so
  competitive-lane and manually sourced prospects never carry it and its
  absence means nothing. (Competitive-lane attribution is a separate
  question — the bronze block is framing, not a benchmark, there. It is
  spec'd in `COMPETITIVE_WEAKNESS_ATTRIBUTION_SPEC.md` as an exposure
  vocabulary, not a causal-find vocabulary.) No migration —
  `business_snapshot` and `discovery_context`
  are JSONB.

This gives the catalog a falsifiable yield signal: reasons that repeatedly
appear in attribution are load-bearing; reasons that never do are candidates
for revision or deprecation (§3.5.6).

**Discovery-lane write-back (implemented).** Attribution is also the gate
for consumer fills. When an `intelligence_discovery` import carries
candidates with `bronze_attribution`, the post-import hook writes each
attributed reason a slot stamped `discovered_by: 'emerging_scan'` (or
`'competitive_scan'` under competitive focus) on the market's resolved
active profile — one draft per import, `observed_city`/`observed_state`
carrying the candidate's real location under catchment scans. The
§7.2 guards hold: attribution is causal (never resemblance),
`outside_market` and `benchmark_only` candidates are excluded, scan
provenance renders "(confirmatory)" rather than ground truth, and the
fills drop on re-scan unless re-found — so the consumer cannot teach
itself coverage it merely predicted.

---

## 8. Evidence Rules

- **Operational gate is non-negotiable** (§5.2). `unable_to_verify` never fills a slot.
- **Assortment-based category fit** — a slot's `category_fit_evidence` must
  cite observable assortment, not a label.
- **Evidence per slot** — every slot carries `evidence_urls`. A reason label
  without evidence is not a calibration target.
- **Provenance per slot** — `discovered_by` is mandatory (§7.2).
- **Empty ≠ absent** — an empty slot means "no exemplar was found for this
  reason in this market during this pass." It is never a claim that no such
  business exists.
- **Vector execution is recorded separately from vector yield** — an
  unexecuted vector must be reported as unexecuted, not as empty.

---

## 9. Prohibited Inferences

- Low digital quality in a bronze slot does NOT indicate low revenue, low
  customer volume, poor products, or poor service. It describes observable
  online fields only.
- A bronze slot does NOT imply the business is a good sales prospect, willing
  to engage, or in need of remediation.
- Absence of a business from a reason's slots does NOT mean the reason does
  not apply to this market — it may mean the vector was not executed.
- A filled `trade_manifest_only` slot does NOT mean the business sells only
  wholesale; it means trade records are the only *observed* public trace.
- Bronze slots are NOT competitive benchmarks and must never be emitted into
  competitive-focus output.
- An empty slot does NOT mean the market lacks such businesses.
- A filled `absent_from_platform` or field-gap slot does NOT mean the business
  is invisible everywhere — the reason is observed on `observed_platform`;
  the same business may be strong on other platforms. Platform absence is a
  per-platform finding, never a whole-business verdict.

---

## 10. Implementation Notes

### 10.1 Data model

**Profiles** — reuse `mkt_intelligence_profiles`. `configuration_json` is
already `any`, so the bronze profile shape in §4 needs no schema migration.

**Catalog** — two new tables: `mkt_bronze_reason_catalog` (§3.5.1) and the
single-row `mkt_bronze_catalog_meta` revision counter (§3.5.2). This is the
only new DDL in the spec.

**Frontend surface** — the operator authoring UI (§3.5.5) follows the existing
marketing-ops admin convention:
`apps/web/src/app/(platform)/settings/admin/marketing-ops/`, with methods added
to `MarketingOpsService` on `AdminApiSingleton`. Match the UI kit used by the
sibling admin pages in that directory rather than assuming one.

### 10.2 Focus value vs. tier discriminator — revised recommendation: **Option A**

The draft recommended Option B (a `standard_tier` field inside
`configuration_json`). Gap analysis found that B is **structurally broken**
against the existing identity machinery, and A is now recommended.

**The blocker:** `mkt_intelligence_profiles` identity — for import dedupe,
version bump, activation retirement, *and* uniqueness — is the tuple
`(category_key, intelligence_focus, reference_city, reference_state,
reference_platform)`:

- `importAsDraft` finds the existing profile by that tuple to reuse its id
  (`IntelligenceProfileService.ts:703-721`). A bronze import sharing
  `focus='gold_standards'` would append the bronze payload as **a new version
  of the gold profile**.
- `activateDraft` retires the prior active version by the same tuple
  (lines 808-831). Activating a bronze draft would **retire the active gold
  profile**.
- Migration 249's partial unique index `idx_mkt_intel_profiles_active_scope`
  enforces **one active profile per tuple**. Gold and bronze can never be
  active simultaneously under B — the DB rejects the second activation.

Making B work means adding a real indexed `standard_tier` column, rebuilding
the unique index, and updating `importAsDraft` + `activateDraft` +
`resolveGoldStandard` + every call site — more churn than A, not less. Option
A gets the same separation **for free** because `intelligence_focus` already
participates in the identity tuple.

Option A also fixes a second collision the draft missed: the
structural-duplicate guardrail keys campaigns on
`scope + category + intelligence_campaign_kind + intelligence_focus +
intelligence_platform + city + state` (`MarketingCampaignService.ts:512`). A
bronze city campaign under B (`focus='gold_standards'`, `kind='discovery'`)
collides with an active **gold discovery** campaign for the same scope → 409.
Under A the `bronze_standards` focus is a distinct signature — no collision
in either run shape (open question 2, §11).

**Option A touch points (enumerated):**

- `IntelligenceFocus` unions — **two exist**: `MarketingPromptService.ts:37`
  and `IntelligenceProfileService.ts:57` (the latter already carries
  `'proving_ground'`; they have drifted).
- Zod enums in `marketing-ops.ts`: campaign-create schema (line 283),
  template create/update (696, 7020), plus the `.refine` rules at 304–326 —
  which currently force `gold_standards` campaigns to be platform-scoped and
  forbid city/state. `'bronze_standards'` must be exempted from the platform
  *requirement* — `intelligence_platform` stays optional, enabling
  platform-scoped bronze runs (§3.6.5); city/state handling splits by kind:
  stage-1 national (kind=`establishment`) exempt from the city/state
  requirement like gold, stage-2 (kind=`discovery`) requires them like
  emerging.
- Literal check at `marketing-ops.ts:2788` (template list filter).
- `renderFocusBlockCore` — **still returns `''` for an unrecognized focus**;
  add an explicit `bronze_standards` branch (the bronze establishment framing
  is a real block worth emitting) rather than relying on the empty-string
  fallback.
- `MarketingCampaignService` — the `['emerging','competitive']` focus gates
  at ~line 2036 (discovery-prospect child runs): bronze campaigns are not
  discovery-prospect children, so no change needed, but the gate should be
  re-asserted in tests.
- `intelligence_focus` columns are `VarChar(20)` — `'bronze_standards'` (16)
  fits. No `chk_` constraint exists on `intelligence_focus` or
  `intelligence_campaign_kind` (verified against `database/migrations`), so
  no enum-sync migration is needed.

### 10.3 Services, routes, and templates

**Backend services:**

| Item | Change |
|---|---|
| `BronzeReasonCatalogService` (new) | Catalog CRUD with write-time scope normalization (§3.5.1), revision counter management (§3.5.2), the staleness query (§3.5.3), deprecate/supersede (§3.5.6), and `audit()` calls with `actorType: 'user'` on every write (§3.5.5) |
| `IntelligenceProfileService` | `resolveBronzeStandard(category, city, state, ctx)` — cascade: (city, state) → (null, null) national, `intelligence_focus='bronze_standards'`; `serializeBronzeStandard(profile, role)` with roles `'establishment_reference'` (stage 2: full catalog snapshot + national proof) and `'discovery'` (stage 3: §7.1 framing); `recordBronzeExternalFill(s)(...)` (§7.3 — batch variant carries a multi-reason fill set into one draft); `importAsDraft` needs no signature change — the hook passes `intelligenceFocus: 'bronze_standards'` |
| `MarketingPromptService` | New post-import hook for `schemaName === 'bronze_standard_scan'`: persist via `importAsDraft` with `intelligence_focus='bronze_standards'`, `reference_city/state` from the campaign, `reference_platform=null`. **Keyed on schema name, not campaign kind** — stage-2 runs are discovery-kind but still produce a profile (§6.1). Discovery-kind bronze imports do **not** create an audit row. Also applies the §7.3 merge (carry forward `operator_self_discovery`/`business_audit` slots from the prior active version). Plus two consumer write-back hooks: `intelligence_discovery` imports write attributed candidates as confirmatory `emerging_scan`/`competitive_scan` fills (§7.4), and `business_analysis` imports on bronze-attributed campaigns write `business_audit` fills when a `non_negotiable` gate fails (§7.3). Drafts are inert until `activateDraft` — activation is operator-controlled, same as gold |
| `MarketingExecutionService` | inject the **national** bronze block (catalog snapshot + proof state) on the `bronze_standards` **discovery** path — the stage-2 prompt consumes it (§6.1); inject the **city** bronze block on the `emerging` **discovery** path (stage 3) |

**Admin routes** (`/api/admin/marketing-ops`, following the
`/manual-script-templates` precedent):

| Route | Purpose |
|---|---|
| `GET /bronze-reasons` | List catalog rows (scope filters, include-deprecated flag) |
| `POST /bronze-reasons` | Author a reason (revision-bumping write) |
| `PUT /bronze-reasons/:reasonKey` | Edit definition/signals/vectors/priority/scope (revision-bumping; `reason_key` immutable — reject mutation) |
| `POST /bronze-reasons/:reasonKey/deprecate` | Stamp `deprecated_in_revision` + optional `deprecated_reason` / `superseded_by` |
| `GET /bronze-reasons/uncovered` | §3.5.3 staleness query for a (category, city, state, profile_catalog_revision) |
| `POST /bronze-reasons/:reasonKey/test-scan` | §3.5.5 test affordance — runs a stage-2 scan restricted to the single reason in the given city. Returns the slot outcome + vector log. **Does not write `mkt_intelligence_profiles`** — test scans are validation, not artifacts |

**Templates and schema:**

| Item | Change |
|---|---|
| Prompt templates | **Two**, mirroring gold's pair (`mpt-seed-gold-standard-scan-001` / `-discovery-001`): `mpt-bronze-standard-national` (stage 1 — catalog snapshot + national proof slots; city/state absent) and `mpt-bronze-standard-city` (stage 2 — city slot fills + `vector_execution_log`). Both `scope='intelligence'`, `intelligenceFocus='bronze_standards'`; kinds `establishment` / `discovery` respectively |
| Output schema | `bronze_standard_scan` — new validator `validators/bronze-standard-scan.schema.ts` + `BRONZE_STANDARD_SCAN_SCHEMA_NAME`, enforcing the §4 shape (status enum, `discovered_by` enum, `platform_presence` vocabulary, `catalog_revision` integer) |
| Campaign kind | stage 2 is a **discovery-kind** run with live search (§6.3); stage 1 is establishment-kind |
| `SCOPE_VARIABLES` | `intelligence` scope already allows `category`/`city`/`state`/`platform`; any new placeholder (e.g. `{reason_block}`) must be added here or `renderTemplate` **throws** — though like the gold block, bronze blocks are *injected*, not templated, so no new variable is expected |

### 10.4 Migrations and seeds

**One DDL migration** — `289_bronze_reason_catalog.sql` — following
`manual-sql-migration-policy.md` (idempotent DDL wrapped in
`DO$$ ... EXCEPTION WHEN OTHERS THEN END $$;`, `INSERT ... SELECT ... WHERE
NOT EXISTS`, then `prisma db pull` + `prisma generate`):

- `mkt_bronze_reason_catalog` (§3.5.1) — **no CHECK constraints**,
  code-validated, per the `mkt_manual_play_templates` precedent.
- `mkt_bronze_catalog_meta` (§3.5.2) — single row seeded with
  `catalog_revision = 1`.
- Seed the §3.2 catalog rows (`provenance='derived'`,
  `introduced_in_revision=1`, scope/priority columns per §3.2) via
  `INSERT ... SELECT ... WHERE NOT EXISTS`.

> **Numbering caveat:** the highest file in `database/migrations/` is 285,
> but AGENTS.md documents 286–288 as applied (their tables are in
> `schema.prisma`; the SQL files were never committed). The next free number
> is **289** — confirm against the migration ledger before writing, and do
> not reuse 286–288. (Separately: the missing 286–288 SQL files should be
> committed — repo hygiene issue outside this spec.)

**One seed script** — `src/scripts/seed-bronze-standard-scan-template.ts` —
following `seed-gold-standard-scan-template.ts` with `SEED_VERSION_MARKER`,
run against `local` + `prd` per the AGENTS.md seed discipline. The prompt
templates are seed-scripted, **not** a data migration: template bodies get
edited and re-seeded, and a one-shot data migration cannot be re-applied.

The `bronze_standard_scan` "registry entry" is **code, not data** — a new
validator file plus dispatch wiring in `MarketingPromptService`'s
schema-name switch. No migration row for it.

### 10.5 Test expectations

Parallel to the gold-standard test suite:

- `validators/__tests__/bronze-standard-scan.schema.test.ts` — §4 shape,
  status enum, `discovered_by` enum, operational-gate coercion.
- `IntelligenceProfileService.bronze-standard.test.ts` —
  `resolveBronzeStandard` cascade; `serializeBronzeStandard` roles;
  `recordBronzeExternalFill` dedupe/merge; §7.3 carry-forward semantics.
- Catalog service tests — revision bump on each write class; immutable-key
  rejection; scope normalization; §3.5.3 staleness predicate (new vs.
  revised vs. deprecated vs. scope-mismatched rows).
- Import-hook tests — `bronze_standard_scan` import persists a draft with
  `intelligence_focus='bronze_standards'` regardless of campaign kind;
  discovery-kind import does not create an audit; activating a bronze draft
  leaves the active gold profile untouched (the §10.2 regression test).
- Campaign-guardrail test — a `bronze_standards`/`discovery` campaign for a
  category+city does not collide with an active `gold_standards`/`discovery`
  or `emerging`/`establishment` campaign at the same scope.

---

## 11. Open Questions

1. **Re-scan cadence** — bronze slots decay as businesses digitize. Is there a
   TTL, or is re-run operator-triggered? Note the §7.3 merge rule interacts
   here: re-scans preserve out-of-loop fills, so cadence is about *slot
   freshness*, not slot loss.
2. **Stage 2 run structure** — a separate `bronze_standards`/`discovery`
   campaign per city, or folded into the existing emerging-establishment
   campaign? Either is non-colliding under Option A (§10.2): separate
   campaigns have distinct signatures, and a combined run emits two payloads
   through two schema-named imports — no composite schema needed. The
   question is operational (one run vs. two), not structural.
3. **Stale-catalog detection** — §3.4 makes the gap detectable via revision
   comparison (§3.5.3). Should a stale Category Intelligence Profile block
   the emerging discovery scan, warn, or proceed silently with a note? The
   uncovered-reason list exists either way; this is only about enforcement.

### 11.1 Resolved

- **Does the city-scan prompt receive the bronze block?** Yes — the stage-2
  bronze scan consumes the national bronze profile (catalog snapshot + proof
  state) as an injected block. This is where the Arsema miss should have been
  caught: the hunt runs against a known list of reasons it must cover, rather
  than blind.
- **Reason catalog versioning.** Adopted. Immutable `reason_key`, additive
  catalog, monotonic `catalog_revision` (counter in `mkt_bronze_catalog_meta`)
  stamped on every bronze profile, bump rules in §3.4. `revised_in_revision`
  makes *modified* reasons — not just new ones — detectable by the §3.5.3
  predicate.
- **Catalog producer.** The catalog is curated, not scan-produced (§3): the
  table is authoritative, profiles carry revision-stamped snapshots, and new
  reasons enter only through operator authoring. The bidirectional check is
  detection, not authorship — this avoids the circularity of the scan that
  consumes the catalog also writing it.
- **Focus mechanism.** **Option A** — a new `bronze_standards` focus value.
  Option B (tier inside `configuration_json`) is rejected: it collides with
  `idx_mkt_intel_profiles_active_scope` (migration 249), the
  `importAsDraft`/`activateDraft` identity tuple, and the duplicate-campaign
  guardrail (§10.2).
- **Slot cap.** `MAX_SLOTS_PER_REASON = 2`, per-reason (§5.3), mirroring
  `MAX_EXEMPLARS_PER_PLATFORM`.
- **Unproven reasons at stage 2.** Hunted, not skipped — the hunt is how an
  unproven reason becomes proven — but reported distinctly via
  `empty_unproven` (§6.2.2).
- **Bronze and the competitive scan.** Confirmed: never (§9). Bronze may be
  *filled by* a competitive scan (`discovered_by: 'competitive_scan'`) but is
  never emitted into competitive output.
- **Out-of-loop fills.** `recordBronzeExternalFill` writes a new draft
  version (never mutates the active profile); external-provenance slots
  survive re-scans via the merge rule (§7.3).
- **Test-scan results are ephemeral.** The §3.5.5 affordance returns the
  outcome to the UI and writes no profile — it validates the reason, it does
  not fill slots.
- **Persistence path.** `bronze_standard_scan` is a schema-named post-import
  hook in `MarketingPromptService` (§10.3), persisting drafts regardless of
  campaign kind; activation stays operator-controlled via `activateDraft`.
- **Which artifact is "category intelligence"?** Two artifacts share the name
  (§2.2). Category-level market intelligence is produced by **category
  enrichment**, not by establishment. Establishment consumes it.
- **Catalog storage.** DB table with an admin UI, not a seeded constant —
  operators accumulate field experience and must be able to author new reasons
  without a deploy. See §3.5. Immutable-key enforcement therefore moves to
  runtime, and the catalog carries a monotonic `catalog_revision` rather than a
  hand-bumped marker.
- **Authoring governance.** Live immediately, no review gate. This is an
  internal operator workflow (single operator or team), not a tenant-facing
  module. Ownership is an SOP concern, not a code-enforced gate. Deprecation is
  the only escape hatch; `created_by` is the accountability mechanism.
- **Duplicate handling.** Supersession, not merge — deprecate the duplicate and
  point `superseded_by` at the canonical key (§3.5.6). One nullable column,
  history preserved, no slot rewriting.
- **Reason scope.** Nullable `scope_category_key` / `scope_city` / `scope_state`
  columns, `NULL` = wildcard, giving four levels: universal, category,
  location, category + location (§3.6). City is the location unit — corridor
  detail belongs in signals and evidence, not scope. Authoring defaults to
  universal; location scope is a deliberate exception.
- **Scope promotion.** SOP judgement, never automated. Mechanically it is a
  one-row `UPDATE` that nulls the scope columns and bumps the revision — no
  promotion machinery, no slot rewriting (§3.6.3).
- **Regional scope — out of scope.** Location scope is **city + state only**.
  The prospect set is independent, physical, non-chain, non-national retailers,
  whose market is bounded by where a shopper will actually travel — so
  city/state is the *correct* unit, not merely the convenient one. A region
  level would also require altering the campaign architecture plus creating a
  region vocabulary and a city → region mapping, neither of which exists
  (§3.6.4). Reopens legitimately for a franchised or regional-chain prospect
  class.
- **Proof is scope-relative.** A reason is proven at the narrowest scope where
  it is evaluable. Stage 2 must distinguish *unproven* from *proven elsewhere,
  empty here* from *not evaluable here* — never conflated (§6.2.1–6.2.2).
- **Platform dimension.** Two mechanisms (§3.6.5): platform-*bound* reasons
  carry `scope_platform` (gold platform vocabulary) for mechanics that only
  exist on one platform; platform-*agnostic* reasons record the platform on
  the slot via `observed_platform`. `reference_platform` on bronze profiles is
  optional — `null` (cross-platform) is the default and evaluates all
  applicable reasons.

---

## 12. Non-Goals

- Not a prospect-scoring system. Bronze does not rank prospects for outreach.
- Not a replacement for the gold standard or for `discovery_benchmark`.
- Not a competitive artifact — it must never enter competitive-focus output.
- Not a public-facing surface.
