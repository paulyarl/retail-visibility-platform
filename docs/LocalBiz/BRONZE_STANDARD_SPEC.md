# Bronze Standard — Design Spec

**Document Version:** 1.0 (design review — not yet scheduled)
**Date:** 2026-09-16
**Status:** Draft for review
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

## 3. The Reason Catalog (carried by the national bronze profile)

The reason catalog is **category-level and city-agnostic**. It defines which
slots exist. It is not a separate artifact — it is the slot structure of the
**national bronze profile** produced by stage 1 (§6.1). It is derived from the
category's discovery patterns — every pattern should imply a reason, and every
reason should imply a pattern (§3.3).

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

| `reason_key` | Label | Indianapolis instance | Vector |
|---|---|---|---|
| `misaligned_platform_category` | Mis-categorized platform category | Arsema — GBP primary category `Convenience store` | category-taxonomy sweep |
| `no_category_token_in_name` | Name carries no category word | Arsema; Senay Habesha | endonym / transliteration sweep |
| `no_mainstream_profile` | No platform profile at all | Habesha Ethiopian Store LLC — registry only | address-indexed datasets |
| `trade_manifest_only` | Trade / import-only visibility | Arsema; Kaura International Food Market | customs bill-of-lading |
| `hosted_storefront_only` | Hosted storefront is the only web surface | `arsemamart.square.site` | site-scoped sweep |
| `corridor_absent_from_guides` | Storefront on no known retail corridor | W Washington St / W 10th St cluster | address clustering |
| `community_only_no_reviews` | Community-known, no reviews | hidden-trust grocers | community / referral networks |
| `wholesale_or_hybrid_role` | Wholesale or grocery-plus-kitchen hybrid | Amez International Imports; East African Imports Wholesale | foodservice / wholesale channels |
| `alternate_identity` | Second trading name at the same address | "Ethiopian Eritrean Store" listed at Arsema's address and phone | identity-conflict detection |
| `non_english_signage_only` | Non-English signage, no English listing | corridor storefronts | Street View sweep |

The catalog is expected to grow per category. `priority` orders slot-filling
effort when budget is bounded.

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
  `deprecated: true` with a `deprecated_reason`. Historical city bronze
  profiles must remain interpretable after the catalog moves on.
- **`reason_catalog_version` is stamped on every bronze profile**, national and
  city. A city profile records which catalog version its slots were filled
  against.
- **Version bumps on:** a new reason added; a reason's `definition` or
  `signals` changed; `priority` reordered; a reason deprecated.

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
| `scope_category_key` | Text, nullable — `NULL` = any category (§3.6.1) |
| `scope_city` / `scope_state` | Text, nullable — `NULL` = any market (§3.6.1) |
| `provenance` | `derived` \| `operator_authored` |
| `introduced_in_revision` | Integer — which catalog revision added it |
| `deprecated_in_revision` | Integer, nullable |
| `deprecated_reason` | Text, nullable |
| `superseded_by` | `reason_key`, nullable — points a retired duplicate at the canonical reason (§3.5.6) |
| `created_by` / `created_at` / `updated_at` | Standard |

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
catalog write. Each reason row records `introduced_in_revision` and
`deprecated_in_revision`.

This gives ordered comparison, which a content hash does not. (The codebase
does use content hashing elsewhere — `evidence_snapshot_hash` in
`SeedIntelligenceReportService` — but hashes are unordered and cannot answer
"is this profile behind?")

Immutable-key enforcement moves to runtime: the admin UI disables the key field
on existing rows, and the service rejects key mutation. The `UNIQUE` constraint
catches accidental reuse.

#### 3.5.3 The staleness query

With `introduced_in_revision` on every reason, the staleness question is one
predicate rather than a diff:

```sql
-- Reasons this profile has never been asked to cover.
-- Scope-filtered, or a profile for one market would be flagged as missing
-- reasons scoped to a different market.
SELECT reason_key, label
FROM mkt_bronze_reason_catalog
WHERE introduced_in_revision > :profile_catalog_revision
  AND deprecated_in_revision IS NULL
  AND (scope_category_key IS NULL OR scope_category_key = :category_key)
  AND (scope_city         IS NULL OR scope_city         = :city)
  AND (scope_state        IS NULL OR scope_state        = :state);
```

That result set is the profile's **uncovered reason list** — the concrete,
enumerable form of the Arsema gap.

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
whether it yields. That closes the loop between authoring and the stage-2
scan, and it turns the catalog into something operators can iterate on rather
than merely append to.

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

Reasons are not all universal. The §3.2 seed splits into two kinds, and
operator authoring adds a third:

- **Universal** — `misaligned_platform_category`, `no_category_token_in_name`,
  `no_mainstream_profile`, `hosted_storefront_only`,
  `corridor_absent_from_guides`, `community_only_no_reviews`,
  `alternate_identity`, `non_english_signage_only`. Apply to any category with
  hidden prospects.
- **Category-bound** — `trade_manifest_only` requires an import supply chain;
  `wholesale_or_hybrid_role` is meaningless for a category with no wholesale
  tier.
- **Location-bound** — authored by an operator who knows their market. A
  reason that only holds in one metro.

Without scoping, a global catalog would run `trade_manifest_only` against auto
repair on every stage-2 pass — wasting a vector and producing a permanently
empty slot, which poisons the empty-slot signal the whole design depends on.

#### 3.6.1 Shape — nullable scope columns

One table, one authoring UI, four levels:

| Level | `scope_category_key` | `scope_city` | `scope_state` |
|---|---|---|---|
| Universal | `NULL` | `NULL` | `NULL` |
| Category | set | `NULL` | `NULL` |
| Location | `NULL` | set | set |
| Category + location | set | set | set |

`NULL` means wildcard. Matching is a single predicate:

```sql
WHERE (scope_category_key IS NULL OR scope_category_key = :category_key)
  AND (scope_city         IS NULL OR scope_city         = :city)
  AND (scope_state        IS NULL OR scope_state        = :state)
  AND deprecated_in_revision IS NULL
```

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
  location-scoped rows, so the portable/locale ratio is visible over time.

**Promotion is a switch flip, and it is an SOP judgement call.** If a
location-scoped reason turns out to generalize, widening it is a one-row
update:

```sql
UPDATE mkt_bronze_reason_catalog
SET scope_city = NULL, scope_state = NULL, updated_at = now()
WHERE reason_key = :reason_key;
```

No promotion machinery, no slot rewriting, no key change. Existing city bronze
profiles that filled the narrowed version stay valid; the next scan simply sees
a wider reason. **The operator decides whether a reason generalizes — the
schema's only job is to make acting on that decision cheap.** Do not automate
the inference (§11.9).

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

---

## 4. Bronze Profile Shape

The bronze profile has two scopes sharing one shape:

- **National** (stage 1) — `reference_city: null`, `reference_state: null`.
  Carries the reason catalog and national proof slots.
- **City** (stage 2) — `reference_city` / `reference_state` set. Carries the
  same reasons with city slots filled.

Scope is distinguished by `reference_city` alone — the same convention the
gold standard uses for nationwide profiles with `city` optional. The example
below is the city variant.

```json
{
  "standard_tier": "bronze",
  "category_key": "african_grocery_store",
  "category_name": "African Grocery Store",
  "reference_city": "Indianapolis",
  "reference_state": "IN",
  "reason_catalog_version": "rc-2026-09-16",
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
      "reason_key": "community_only_no_reviews",
      "status": "empty",
      "empty_slot_note": "No exemplar found in this market during this pass. Record whether the vector was executed and returned nothing, or was not executed."
    }
  ],
  "vector_execution_log": [
    { "vector": "customs / trade records", "executed": true, "returned": 4 },
    { "vector": "community / referral networks", "executed": false, "returned": null }
  ],
  "prohibited_inferences": ["..."]
}
```

### 4.1 `discovered_by` provenance enum

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

1. **Category-qualified** — assortment evidence, per the category intelligence
   `category_fit_is_assortment_based` rule.
2. **Operationally verified** — `operational_status` is `active` or
   `likely_active`. **`unable_to_verify` does not qualify**, or thin-footprint
   businesses would be excluded by the very test they are meant to pass.
3. **Low digital quality** — the reason key explains *why*.

### 5.3 Emission discipline

Platform × reason is a sparse matrix — a business invisible for
`trade_manifest_only` reasons typically has no platform presence at all, so
most cells are empty. Emit:

- all **filled** slots (capped per reason, mirroring `MAX_EXEMPLARS_PER_PLATFORM`)
- a compact **empty-slot report** for unfilled reasons
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
| **1** | National bronze standard | category (nationwide) | bronze / establishment | — | **National bronze profile** — reason catalog + national reason slots |
| **2** | City emerging establishment | category + city | emerging / establishment | national bronze profile | **City bronze profile** (city reason slots filled). Also emits the Category Intelligence Profile per its existing contract — but see §2.2: that is the discovery *how-to*, not category market intelligence, which comes from category enrichment |
| **3** | City emerging discovery | category + city | emerging / discovery | city bronze profile + Category Intelligence Profile | prospects |

Stage 3's existing behaviour is unchanged: the emerging discovery scan already
loads the stage-2 establishment profile via
`IntelligenceProfileService.resolve(category, focus, city, platform)` and
injects it as a guide. The only change is that a **second** block — the city
bronze profile — is injected alongside it.

This parallels the gold standard, which is also nationwide with `city`
optional, and whose consumers already receive dual injection (intelligence
profile block + gold standard block).

### 6.2 Stage 1 — national bronze standard

Produces the reason catalog and proves, **at national scope**, that each
nationally-applicable reason is real and reachable. National slots are
illustrative proof, not calibration targets for any specific market.

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
| Location (city/state) | stage 2 (city), for that market |
| Category + location | stage 2 (city), for that category and market |

#### 6.2.2 Three states, never conflated

When stage 2 cannot fill a reason, it must distinguish:

1. **Unproven** — no exemplar has ever been found at any evaluable scope.
2. **Proven elsewhere, empty here** — proven nationally or in another market,
   but this market returned nothing. A real finding about this market.
3. **Not evaluable here** — scope mismatch; the reason does not apply.

Conflating these is the failure mode this design exists to prevent. An
unproven reason and a genuinely absent one must never look the same, and a
reason that does not apply must never appear as a gap.

### 6.3 Stage 2 — city emerging establishment

Scans the reference city against the national catalog, hunting for businesses
that match each reason's signal vocabulary, and fills the city reason slots.
It is a research task with live search — the difference from the gold
standard, where establishment defines criteria and discovery fills slots.

For each reason in the catalog, in `priority` order:

1. Execute the reason's `expected_vectors` against the reference market.
2. For each candidate returned, evaluate the three-part qualification in §5.2.
3. Record the slot, or record the reason as `empty` **with the execution
   outcome** — "executed and returned nothing" is a materially different
   finding from "not executed."
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

---

## 10. Implementation Notes

### 10.1 Data model

**Profiles** — reuse `mkt_intelligence_profiles`. `configuration_json` is
already `any`, so the bronze profile shape in §4 needs no schema migration.

**Catalog** — one new table, `mkt_bronze_reason_catalog` (§3.5.1). This is the
only new DDL in the spec.

**Frontend surface** — the operator authoring UI (§3.5.5) follows the existing
marketing-ops admin convention:
`apps/web/src/app/(platform)/settings/admin/marketing-ops/`, with methods added
to `MarketingOpsService` on `AdminApiSingleton`. Match the UI kit used by the
sibling admin pages in that directory rather than assuming one.

### 10.2 Focus value vs. tier discriminator

Two options; **Option B is recommended**.

| | Option A — new focus value | Option B — tier discriminator |
|---|---|---|
| Mechanism | Add `bronze_standards` to `IntelligenceFocus` | Add `standard_tier: 'gold' \| 'bronze'` to `configuration_json`; add a tier param to the resolver |
| Touch points | TS union; literal string check at `marketing-ops.ts:2788`; `renderFocusBlockCore`; `resolveGoldStandard`; campaign creation | `resolveGoldStandard` / `serializeGoldStandard` signature; no enum churn |
| Risk | `renderFocusBlockCore` **returns `''` for an unrecognised focus** — a new value without a block ships as a silently degraded prompt with no error | Overloads the `gold_standards` focus semantically |

Note: no `intelligence_focus` CHECK constraint was found in
`database/migrations`, so the AGENTS.md enum-sync migration risk does not
appear to apply — **verify before relying on this**.

### 10.3 Services and templates

| Item | Change |
|---|---|
| `IntelligenceProfileService` | `serializeBronzeStandard(profile, role)`; tier-aware `resolve` |
| `MarketingExecutionService` | inject the **national** bronze block on the emerging **establishment** path (stage 2); inject the **city** bronze block on the emerging **discovery** path (stage 3) |
| Prompt template | `mpt-bronze-standard-scan` (mirrors `mpt-gold-standard-scan`) |
| Output schema | `bronze_standard_scan` (new registry entry) |
| Campaign kind | bronze establishment is a **discovery-kind** run with live search — see §6 |
| `SCOPE_VARIABLES` | any new placeholder must be added here, or `renderTemplate` **throws** |

### 10.4 Migrations

Two, both following `manual-sql-migration-policy.md` (idempotent DDL wrapped in
`DO$$ ... EXCEPTION WHEN OTHERS THEN END $$;`, `INSERT ... SELECT ... WHERE NOT
EXISTS`, then `prisma db pull` + `prisma generate`). Use the next free numbers.

| # | Type | Purpose |
|---|---|---|
| next | DDL | Create `mkt_bronze_reason_catalog` (§3.5.1). **No CHECK constraints** — code-validated, per the `mkt_manual_play_templates` precedent |
| next+1 | Data | Seed `mpt-bronze-standard-scan` prompt template + `bronze_standard_scan` output schema registry entry |

The seeded catalog rows come from §3.2, with `provenance: 'derived'` and
`introduced_in_revision: 1`. Operator-authored reasons start at revision 2+.

---

## 11. Open Questions

1. **Catalog storage** — a seeded constant (like `manual-play-templates.ts`) or
   a DB table? Constants are simpler; a table allows operator authoring.
2. **Catalog authorship** — derived by the establishment analyst, or curated by
   operators? Derivation risks the same blind spots; curation does not scale.
3. **Slot cap per reason** — `MAX_EXEMPLARS_PER_PLATFORM` is 2. Bronze needs a
   number; is it per-reason or global?
4. **Re-scan cadence** — bronze slots decay as businesses digitize. Is there a
   TTL, or is re-run operator-triggered?
5. **Does bronze feed the competitive scan?** §9 says no. Confirm.
6. **Stage 2 run structure** — does one city emerging establishment campaign
   emit **both** the city bronze profile and the Category Intelligence Profile,
   or are these two separate campaigns that share a scope? The sibling decision
   (§6.4) settles the artifact shape, not the run shape.
7. **Unproven reasons at stage 2** — when stage 1 leaves a reason unfilled
   nationally, should stage 2 still hunt for it, or skip it? §6.2 says treat it
   as unproven; skipping is cheaper but risks never closing the gap.
9. **Stale-catalog detection** — §3.4 makes the gap detectable via revision
   comparison (§3.5.3). Should a stale Category Intelligence Profile block the
   emerging discovery scan, warn, or proceed silently with a note?

### 11.1 Resolved

- **Does the emerging establishment template receive the bronze block?** Yes —
  stage 2 consumes the national bronze profile. This is where the Arsema miss
  should have been caught: the pattern set is authored against a known list of
  reasons it must cover, rather than blind.
- **Reason catalog versioning.** Adopted. Immutable `reason_key`, additive
  catalog, `reason_catalog_version` stamped on every bronze profile, version
  bump rules in §3.4.
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

---

## 12. Non-Goals

- Not a prospect-scoring system. Bronze does not rank prospects for outreach.
- Not a replacement for the gold standard or for `discovery_benchmark`.
- Not a competitive artifact — it must never enter competitive-focus output.
- Not a public-facing surface.
