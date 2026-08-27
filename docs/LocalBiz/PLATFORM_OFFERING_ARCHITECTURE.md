# Platform Offering Architecture

**Status:** Draft · **Owner:** Product · **Date:** 2026-08-20
**Referenced by:** `PROFILE_REPAIR_PRODUCT_SPEC.md` (first product built on this architecture)

---

## 1. Purpose

This document defines the **base architectural standard** for all
platform offerings — products that diagnose a business's digital
footprint problems and deliver fixes across external platforms.

The first product built on this architecture is **Profile Repair**
(`PROFILE_REPAIR_PRODUCT_SPEC.md`). Future offerings (Review
Acceleration, Conversion Fix, Visual & Asset Refresh, etc.) adopt the
same patterns so the operator doesn't learn a new system for each
product and the infrastructure is built once, not per-product.

The architecture is extracted from the Profile Repair spec because the
patterns are reusable, not Profile Repair-specific. Each product spec
references this document for the architectural primitives and defines
only its own product-specific details (tiers, pricing, deliverable
format, platform scope).

### 1.0 Category-agnostic by design — horizontal enterprise scaling

The entire architecture is **category-agnostic**. The category
(plumbing, restaurants, legal, medical, African grocery stores, nail
salons, HVAC, etc.) is a **data input**, not a code path. No part of
the infrastructure has category-specific logic hardcoded:

| Layer | Category-specific? | How category enters |
|-------|-------------------|---------------------|
| Campaign creation | No | Operator picks a category from the dropdown — stored as `category` on the campaign |
| Intelligence profile resolution | No | `resolve(category, focus, city)` — category is a lookup key, not a branch |
| Gold standard scan | No | `category` is a prompt variable — the model searches for that category nationwide |
| Gold standard storage | No | `category_key` on `mkt_intelligence_profiles` — a data field, not a schema |
| Audit prompt | No | `{intelligence_profile}` + `{gold_standard_benchmark}` are injected as text — the model adapts to the category |
| Fulfill prompt | No | `{gold_standard}` is injected as text — the model generates category-appropriate fix instructions |
| Platform SOP module | No | SOPs are platform-specific, category-agnostic (§6) |
| Retainer | No | Contracted platforms are tier-specific, not category-specific |
| Prompt families | No | Each family uses the same dual-profile injection — category flows through the data, not the code |
| Curation UX | No | Filter by category, but the UI renders the same for every category |

**This makes the platform operate like a horizontal enterprise.** The
same infrastructure scales across any number of categories without
per-category engineering:

- Adding a new category (e.g., "HVAC Contractor") requires **zero code
  changes** — the operator runs a gold standard scan for that category,
  activates the profile, and the entire pipeline (audit → seek →
  fulfill → deliverable) works automatically
- Adding a new product offering (e.g., Review Acceleration) requires
  **new prompts and schemas** but no new infrastructure — the prompt
  family pattern (§10) handles it
- Adding a new platform (e.g., a new vertical directory) requires **a
  new platform key** in the gold standard data and a new SOP entry —
  no schema migration, no code change

**The category intelligence is in the data, not the code.** The gold
standard scan discovers what "good" looks like for each category on
each platform. The intelligence profile scan discovers what terminology,
sources, and signals matter for each category in each city. Both are
data artifacts stored in `mkt_intelligence_profiles` — the prompts
consume them as injected text, and the model adapts its output to the
category context. The code never branches on category.

**The only category-specific logic is niche overrides** in the intake
portal (`mkt_intake_definitions.niche_overrides`), which adjust form
labels and owner copy per category — and even those are data-driven
(JSONB configuration), not code branches.

This is the scaling principle: **build the infrastructure once, populate
it with category data, and the platform serves any niche.** The operator
expands into new categories by running scans and activating profiles,
not by filing engineering tickets.

### 1.1 Gold standards are the foundational prerequisite

Gold standards have been elevated to a **critical architectural
addition** — they sit at the **top of the flow**, before the business
audit, before the seek, before the fulfill. The gold standard is the
first thing that needs to exist for a category:

```
Gold Standard Establishment (scan → draft → activate)
    ↓
Gold Standard (active)
    ↓
Business Audit (benchmarked against gold standard)
    ↓
Seek Briefing (grounded in gap analysis)
    ↓
Fulfill Fix Sheet (targets the gaps)
```

**Establishment before discovery.** The establishment campaign creates
the profile first. Only after the profile is active can discovery
campaigns use it to find businesses. This mirrors the intelligence
(seek) flow, where the establishment campaign creates the city/category
intelligence profile before discovery campaigns use it to find
emerging/competitive businesses:

```
Gold standard flow:                   Intelligence flow:
  Establishment                         Establishment
  (category/platform profile)          (city/category profile)
      ↓                                     ↓
  Activate                             Activate
      ↓                                     ↓
  Discovery                             Discovery
  (uses profile parameters             (uses profile signals
   to find candidates)                  to find businesses)
      ↓                                     ↓
  Gold standard slots                  Prospect queue
```

**The intelligence flow can consume the gold standard.** Because gold
standards sit at the top of the flow and are category-level (nationwide),
they're available before the intelligence establishment runs. The
intelligence profile consumes the gold standard at two points:

1. **Intelligence establishment consumes gold standards** — when
   building the city/category intelligence profile, the active gold
   standard's expected fields and pattern exemplars inform what
   terminology, sources, and evidence rules to look for. If the gold
   standard says the primary category should be "African goods store"
   (not "Grocery store"), the intelligence profile's terminology
   section includes "African goods store" as a key search term. The
   gold standard's platform-specific attributes (e.g., "SNAP accepted"
   for African grocery stores on Google) become evidence signals the
   intelligence profile tells discovery to look for.

2. **Intelligence discovery consumes gold standards** — when
   discovering emerging/competitive businesses, the gold standard
   serves as a quality benchmark. Each discovered business can be
   scored against the gold standard's gates to assess how close it is
   to the target state. This enriches the discovery output with a
   quality dimension beyond just "found/not found" — the operator can
   see which discovered businesses are closest to gold standard quality
   and prioritize them.

```
Full flow with cross-consumption:

  Gold Standard Establishment
  (category/platform profile)
      ↓
  Activate Gold Standard
      ↓
  ┌─────────────────────────────────────────┐
  │ Intelligence Establishment              │
  │ consumes: active gold standard          │
  │ produces: city/category intelligence    │
  │           profile (enriched with        │
  │           gold standard terminology,    │
  │           attributes, evidence signals) │
  └─────────────────────────────────────────┘
      ↓
  Activate Intelligence Profile
      ↓
  ┌─────────────────────────────────────────┐
  │ Intelligence Discovery                  │
  │ consumes: active intelligence profile   │
  │          + active gold standard         │
  │ produces: list of businesses,           │
  │           scored against gold standard  │
  │           gates for quality assessment  │
  └─────────────────────────────────────────┘
      ↓
  Prospect queue (prioritized by gold standard proximity)
      ↓
  Business Audit (benchmarked against gold standard)
      ↓
  Seek Briefing → Fulfill Fix Sheet
```

If no active gold standard exists for the category, both intelligence
establishment and discovery run without it (degraded but functional —
same fallback pattern as the audit). The gold standard enriches the
intelligence flow but is not a hard prerequisite for it.
analysis, the seek briefing is less specific, and the fulfill fix sheet
lacks concrete target values and pattern exemplars.

**This makes gold standards the starting sprint.** Before building
fulfill prompts, before building audit enhancements, before building
the deliverable template — the gold standard system must exist:
- The scan prompt and schema
- The storage and lifecycle (draft → active → retired)
- The curation UX (admin page with two lists, filters, review view)
- The serialization function (`serializeGoldStandard` with role
  parameter and platform directives)
- Destination URL capture as an intentional focus

See §5 for the gold standard system spec and the Profile Repair spec's
§10.3 for the infrastructure gap. Gold standards are **Sprint 0** — the
prerequisite sprint that makes everything downstream richer.

**Sprint plan:** `docs/LocalBiz/gold_standard_sprint_plan.md`

---

## 2. The Seek → Fulfill Parallel

Every platform offering has two phases:

- **Seek** — diagnose what's broken and why it matters
- **Fulfill** — produce the fix (instructions for DIY, execution for DFY)

Both phases share the same structural primitives across five dimensions.

### 2.0 Gold standards as pre-audit benchmark

Gold standards are not only a fulfill-time input. They can also **precede
the audit** — the business is audited against the category gold standard
on each platform, producing a richer, category-aware, platform-aware
audit report.

**Without gold standard pre-audit:**
- The audit collects raw data (NAP, categories, photos, claim status)
- The audit flags generic issues ("primary_category not set")
- The seek briefing diagnoses from raw data alone

**With gold standard pre-audit:**
- The audit receives the gold standard's `expected_fields` as a benchmark
- The audit compares the business's actual state against the category
  target state on each platform
- The audit flags **category-specific** issues ("primary_category is
  'Grocery store' but the category gold standard for African grocery
  stores sets it to 'African goods store' — this reduces discoverability
  for diaspora customers searching by cuisine")
- The audit can score the business against the gold standard's quality
  gates (universal + platform-specific) — "fails Google
  `primary_category_set` gate, fails Yelp `categories_set` gate, passes
  universal `presence` and `nap_accuracy` gates"
- The seek briefing is richer because it starts from a gap analysis, not
  raw data

**The flow becomes:**

```
Gold standard (active) ──→ Audit (business vs. gold standard)
                              ↓
                         Richer audit report
                         (category-aware, platform-aware,
                          with gap analysis + quality gate scores)
                              ↓
                         Seek briefing (grounded in gaps)
                              ↓
                         Fulfill (fix sheet targets the gaps)
```

**This does not change the seek/fulfill parallel** — the gold standard
is still platform-aware on the fulfill side and city-aware on the seek
side. It adds a third leverage point: the gold standard informs the
audit itself, making the seek side category-aware and platform-aware
*before* the briefing is generated. The audit becomes a comparison
against the target state, not just raw data collection.

**Prerequisite:** the gold standard must be active before the audit
runs. If no gold standard exists for the category, the audit runs
without it (degraded but functional — same fallback pattern as fulfill).
This means gold standard scans should be run and activated for priority
categories *before* auditing businesses in those categories — the gold
standard is a prerequisite for the richest audit, not an optional
enhancement.

#### 2.0.1 Prompt resolution — dual profile injection

The audit prompt is not only city-category profile aware, but also
platform-category standards aware. Both profiles are injected during
prompt **resolution** — the phase where template variables are populated
before the prompt is sent to the model (or before the external import
path validates against the schema).

```
Prompt Resolution Pipeline (audit prompt)
=========================================

1. Resolve city-category intelligence profile
   IntelligenceProfileService.resolve(category, focus, city)
   → injects: terminology, synonyms, sources, evidence rules
   → variable: {intelligence_profile}

2. Resolve category gold standard profile          ← NEW
   serializeGoldStandard(category, role='benchmark')
   → injects: expected_fields, quality_gates, per-platform patterns,
     destination URLs for each candidate, AND a platform directive
     telling the model what to do with this data (benchmark = compare
     against; target = fix toward)
   → variable: {gold_standard_benchmark}

3. Both variables are available to the prompt body
   The audit prompt uses BOTH:
   - {intelligence_profile} → "what sources to check, what terminology
     to search for, what signals matter for this category in this city"
   - {gold_standard_benchmark} → "what correct looks like for this
     category on each platform — compare the business against this.
     Each platform block has a BENCHMARK directive. Each candidate
     includes its live profile URL — the model can
     reference or browse the URL to verify the exemplar's current state.
     The benchmark includes **branding artifact gates** (has_logo,
     has_cover_photo, min_photo_count, photo_types) — the audit
     evaluates the business's branding against these gates and flags
     missing/low-quality branding as gaps in the gap_analysis block."

4. If either profile is missing, the variable is empty
   (degraded but functional — same fallback pattern)
```

This means the audit prompt's resolution step now resolves **two
profiles** in sequence:

| Resolution step | Profile type | Awareness | Variable injected |
|-----------------|-------------|-----------|-------------------|
| 1. Intelligence profile | Seek profile | City-aware, category-aware | `{intelligence_profile}` |
| 2. Gold standard profile | Fulfill profile | Platform-aware, category-aware | `{gold_standard_benchmark}` |

Both are resolved from the same `mkt_intelligence_profiles` table —
the intelligence profile by `(category, focus, city)` and the gold
standard by `(category, reference_city=NULL)`. The resolver picks up
active profiles automatically (§2.2). The operator doesn't select
either profile at execution time — both flow in once activated.

**The fulfill prompt already does step 2** (resolves the gold standard
for the fix sheet). The change is that the **audit prompt also does
step 2** — the same `serializeGoldStandard` call, the same resolution
path, just injected into a different prompt as a benchmark rather than
as a target.

This is the symmetry: the gold standard profile is resolved once and
injected twice — once into the audit (as benchmark) and once into the
fulfill (as target). Same profile, same resolution, same serialized
data, different `role` parameter passed to `serializeGoldStandard`:
- `role='benchmark'` → audit prompt → "compare the business against
  this" directive per platform
- `role='target'` → fulfill prompt → "fix the business toward this"
  directive per platform

The role determines the **platform directive** prepended to each
platform block in the serialized output (§5.4). The data is identical;
only the instruction to the model changes.

### 2.1 Awareness

| Seek | Fulfill |
|------|---------|
| Category intelligence profiles are **city-aware** — `resolve(category, focus, city)` resolves city-specific profiles first, falls back to city-agnostic | Category gold standard profiles are **city/state-aware + platform-aware** — `resolveGoldStandard(category, platform, city, state)` resolves city → state → nationwide, with platform-specific preferred over cross-platform at each layer |

The seek side is aware of *where* the business is — a plumbing
contractor in Zionsville resolves to a different intelligence profile
than one in Indianapolis, because the competitive landscape and
discovery sources differ by city. The fulfill side is aware of *which
platform* it's fixing — a business can be the gold standard for Google
without being the standard for Yelp, because listing quality varies by
platform. The fulfill side is also now aware of *where* the business is
— a beauty supply store in Atlanta resolves to a Georgia-scoped gold
standard profile (if one exists) before falling back to the nationwide
profile, so the audit compares against regionally-relevant exemplars
instead of only metro-area ones.

**This awareness extends to the scan itself.** A seek discovery scan has
a **city focus** — the operator picks a city and the scan searches that
market. A gold standard scan has a **platform focus** — the operator
picks a platform (or "all platforms") and the scan evaluates candidates
on that platform. A gold standard **discovery** scan can optionally be
**city/state-narrowed** — the operator picks a region and the scan
searches for candidates in that geography only, finding strong local
independents that a nationwide search would bury under more visible
metro businesses. The gold standard prompt is platform-aware the same
way the seek prompt is city-aware:

| Scan property | Seek discovery | Gold standard discovery |
|--------------|----------------|------------------------|
| Focus dimension | City | Platform + optional city/state |
| Scan parameter | `city` | `platform` (or `all`) + optional `city`/`state` |
| What the scan searches | A specific city's market | A specific platform's listings (or all platforms), optionally narrowed to a region |
| Profile produced | City-aware seek profile | Platform-aware gold standard profile (nationwide, or city/state-scoped) |
| Fallback | City-agnostic profile if no city-specific one exists | State-specific → nationwide if no city-specific profile exists |

A platform-focused gold standard scan (e.g., "find gold standard
candidates for African Grocery Store on Google") evaluates candidates
only on that platform, producing higher-quality per-platform results
than a broad all-platforms scan. The operator can run separate scans
per platform — Google, Yelp, Facebook, BBB — and each scan's candidates
populate that platform's slots in the gold standard profile.

### 2.2 Automatic

| Seek | Fulfill |
|------|---------|
| Intelligence profiles are **leveraged automatically** — the resolver picks up active profiles without operator intervention; the seek prompt receives category context transparently | Gold standard profiles are **leveraged automatically** — `serializeGoldStandard(campaign)` resolves the profile and injects expected_fields + pattern into the fulfill prompt without operator intervention |

Neither side requires the operator to manually select a profile or
pattern. The operator's job is to *curate* (run scans, review drafts,
activate profiles) — not to *select at execution time*. Once a profile
is active, it flows into every seek/fulfill for that category
automatically. This is the same `resolve()` → inject pattern in both
cases.

### 2.3 Curation

| Seek | Fulfill |
|------|---------|
| Operator activates intelligence profiles on the admin page — reviews draft in the Seek Profiles list, clicks Activate | Operator activates gold standard profiles on the same page — reviews draft in the Gold Standard Profiles list, clicks Activate |

Both sides use the same `mkt_intelligence_profiles` table, the same
draft → active → retired status lifecycle, and the same activation
endpoint. The admin page hosts **two separate lists** — Seek Profiles
and Gold Standard Profiles — each with its own Draft and Active
sections. The lists are **filterable** by category and platform so the
operator can confirm coverage before running a scan campaign. Gold
standard cards show **category + platform badges** so the operator can
see at a glance which platforms have standards and which are missing.

The operator's review task differs by profile type, but the activation
gate is the same: until the operator activates, the profile is inert
and the resolver won't pick it up. See §4 for the curation UX pattern.

### 2.4 Execution

| Seek | Fulfill |
|------|---------|
| **Dual execution**: AI agent runs the seek prompt → produces briefing; OR operator generates externally → imports via `/executions/external` with schema validation | **Dual execution**: AI agent runs the fulfill prompt → produces fix sheet; OR operator generates externally → imports via `/executions/external` with schema validation |

Both sides support the same two execution paths:
- **AI path** — runs the prompt through the model and validates output
  against the Zod schema
- **External import path** — operator pastes externally-generated
  output (different model, manual analysis, third-party tool) and
  validates against the same schema

Post-import hooks fire in both cases — the seek side persists the
briefing, the fulfill side persists the deliverable. The gold standard
scan also uses the same dual path.

### 2.5 Briefing

| Seek | Fulfill |
|------|---------|
| **AI triage briefing** (campaign-level: should we pursue? which track? what severity?) + **per-issue repair briefing** (issue-level: what's broken, what's the impact, what's the pitch) | **Fulfill summary** consumes the seek briefing + produces the deliverable summary (fix sheet + submission guide) |

The seek produces two layers:
1. **Triage briefing** — campaign-level decision: severity, track,
   viability. Answers "should we pursue this at all?"
2. **Per-issue briefing** — issue-level diagnosis: scope, affected
   platforms, impact, value preview. Answers "what specifically is
   broken and why does it matter?"

The fulfill consumes the per-issue briefing (not just raw audit data)
and produces the deliverable summary. The briefing is the **contract**
between seek and fulfill — the fulfill addresses exactly what the seek
diagnosed, on exactly the platforms the seek flagged, delivering exactly
the value the seek promised.

**The seek pitch can include a gold standard artifact.** When a gold
standard benchmark is injected into the audit, the per-issue briefing's
`value_preview` references the exemplar — making the pitch concrete:

- **With gold standard:** "Your Google profile has 2 photos and no
  logo. Gold standard [African grocery stores] on Google have a logo,
  cover photo, and 15+ photos. Here's what good looks like:
  [destination URL]. We can close this gap."
- **Without gold standard:** "Your Google profile has 2 photos and no
  logo. Well-optimized profiles in your category typically have 10+
  photos with a logo and cover photo."

The exemplar reference is only included when the gold standard benchmark
is populated. This is a prompt body instruction — the `value_preview`
field already exists; the change is telling the model to use the
benchmark data when available. The same artifact flows downstream: the
fulfill's fix sheet references the same exemplar as the target, and the
branding upsell pitch (§10.2) uses it as the before/after comparison.

### 2.6 Summary

```
                    SEEK                          FULFILL
                    ====                          =======

Awareness:    city-aware profiles            platform-aware gold standards
              (where the business is)         (which platform we're fixing)

Automatic:    resolve() → inject             resolve() → inject
              (no manual selection)           (no manual selection)

Curation:     operator activates on          operator activates on
              admin page                      same page (two lists:
              (Seek Profiles list →           Seek Profiles + Gold
              review draft → Activate)        Standard Profiles, each
                                               filterable → review → Activate)

Execution:    AI agent ─┐                    AI agent ─┐
              external  ─┘→ schema validate   external  ─┘→ schema validate
              → post-import hook              → post-import hook

Briefing:     triage (campaign-level)         ──→ consume seek briefing
              repair (issue-level)            ──→ produce deliverable summary
```

---

## 3. Platform Type Taxonomy

Every platform is tagged with one or more **platform types**. The type
tag determines what kind of work applies and ensures the package covers
the full digital footprint, not just one type.

### 3.1 Types

| Type | Description |
|------|-------------|
| **directory** | Listing platforms where the business is found by searchers |
| **social_media** | Social platforms where the business has a page or profile |
| **reputation** | Platforms where reviews and ratings live |
| **website** | The business's own web presence (special — see §3.3) |

A platform can have multiple types — Google Business Profile is both
directory and reputation. For type distribution purposes, each platform
counts toward its primary type. The secondary type is noted but doesn't
double-count.

### 3.2 Platform-to-type mapping

| Platform | Primary type | Secondary type(s) |
|----------|-------------|-------------------|
| Google Business Profile | directory | reputation |
| Yelp | directory | reputation |
| Facebook | social_media | directory |
| BBB | directory | reputation |
| Apple Maps | directory | — |
| Bing Places | directory | — |
| MapQuest | directory | — |
| Waze | directory | — |
| Loc8NearMe | directory | — |
| DataAxle | directory | — |
| Foursquare | directory | — |
| Instagram | social_media | — |
| TikTok | social_media | — |
| X (Twitter) | social_media | — |
| LinkedIn | social_media | directory |
| Trustpilot | reputation | directory |
| Vertical directories (SNAP, HomeAdvisor, etc.) | directory | — |
| Business website | website | — |

### 3.3 Website is special

Website is not a platform type in the repair packaging — it's a
separate surface with its own upsell path. However, website **can** be
a gold standard platform. The gold standard system is broader than any
single product's packaging — it captures what "good" looks like for a
niche across all surfaces that matter, including surfaces that aren't
in the product's core package.

For niches where the website is critical to conversions (plumbing, HVAC,
legal, medical), the gold standard scan can capture website patterns
(hero copy, CTAs, service page structure, trust signals, mobile
optimization). These patterns inform the upsell pitch and audit
benchmarking, even though fixing the website is not part of the core
product.

### 3.4 Type distribution per product tier

Each product tier has a **minimum number of platforms per type** to
ensure the package is comprehensive. The specific minimums are defined
per-product in the product spec. The principle is universal:

- A package that's all directories misses social presence
- A package with no reputation platforms misses the review footprint
- Type minimums ensure discoverability, social presence, and review
  footprint are all covered

---

## 4. Profile Lifecycle and Curation UX

### 4.1 Profile lifecycle

All intelligence profiles (seek and gold standard) follow the same
lifecycle:

```
draft → active → retired
```

- **draft** — created by scan or manual entry, not yet usable by the
  resolver. The operator reviews the draft before activation.
- **active** — the resolver picks this up automatically at execution
  time. Only one active profile per category (per profile type) at a
  time.
- **retired** — superseded by a newer active version. Kept for audit
  trail and rollback.

### 4.2 Storage

All profiles are stored in `mkt_intelligence_profiles`:
- Category-keyed (`category_key`)
- City/state-aware (`reference_city`, `reference_state`) — gold standards
  use `reference_city = NULL, reference_state = NULL` for the nationwide
  profile (the bar). City/state-scoped gold standard profiles have
  non-NULL values — they copy the bar from the nationwide profile but
  hold their own per-platform candidate slots (up to 4 per platform).
- Versioned (immutable version rows)
- Status-gated (`draft` / `active` / `retired`)
- JSONB-structured (`configuration_json`)
- **Focus-tagged** (`intelligence_focus`) — `emerging`, `competitive`,
  or `gold_standards`. This is the same column used by `mkt_campaigns`
  and `mkt_prompt_templates` — the focus value flows from campaign
  creation through prompt resolution to profile storage.

Seek profiles store: terminology, synonyms, subcategories, specialized
sources, discovery patterns, category evidence rules.

Gold standard profiles store: `expected_fields` (data layer) +
`gold_standards` (pattern layer). See §5.

### 4.2a Campaign creation — Scope, Focus, and Campaign Kind

Profiles are created via **campaigns**. When the operator creates a new
campaign, they select:

1. **Scope** (dropdown) — `business` · `category` · `city` · `intelligence`
2. When Scope = `intelligence`, the modal expands with:
   - **Focus** (radio) — `emerging` · `competitive` · `gold_standards`
   - **Campaign Kind** (radio) — `discovery` · `establishment`
   - **Focus dimension** (conditional):
     - When Focus = `emerging` or `competitive` → **City** field (the
       scan's city focus)
     - When Focus = `gold_standards` → **Platform** dropdown (the
       scan's platform focus): `all` · `google` · `yelp` · `facebook` ·
       `bbb` · `apple_maps` · `bing` · ... (all platform keys from §5.3)

The Focus + Campaign Kind combination determines what the campaign
produces. The pattern is consistent across all three focuses:
**discovery** produces a **list of businesses** the operator picks from;
**establishment** **bootstraps the profile** itself.

| Focus | Kind | What it produces | Operator action from results |
|-------|------|-----------------|------------------------------|
| `emerging` | `discovery` | List of emerging/low-visibility businesses for the category-city | Add businesses to prospect queue; create campaigns from them |
| `emerging` | `establishment` | Category-city intelligence profile (terminology, synonyms, sources) | Review draft → activate seek profile |
| `competitive` | `discovery` | List of established competitors for the category-city | Add businesses to prospect queue; create campaigns from them |
| `competitive` | `establishment` | Category-city intelligence profile (terminology, synonyms, sources) | Review draft → activate seek profile |
| `gold_standards` | `discovery` | List of gold standard candidate businesses for the category, evaluated per-platform. Optionally narrowed to a city/state to find regional exemplars the nationwide scan missed. | Add businesses to the category/platform gold standard slots (up to 4 per platform). Scoped promotions create a city/state-scoped profile. |
| `gold_standards` | `establishment` | Category gold standard profile (expected_fields + gold_standards blocks). Always nationwide. | Review draft → activate gold standard profile |

**The discovery → establishment relationship:**

- **Discovery** finds businesses and presents them as a list. The
  operator reviews the list and picks which businesses to act on.
  - For `emerging`/`competitive`: picked businesses go to the prospect
    queue or become campaigns.
  - For `gold_standards`: picked businesses go into the gold standard
    profile's per-platform candidate slots (up to 4 per platform). A
    business can be added to Google's slot without being added to
    Yelp's — the operator picks per-platform.
- **Establishment** bootstraps the profile itself — the scan runs and
  produces the profile's `configuration_json` content (terminology and
  sources for seek; `expected_fields` + `gold_standards` for gold
  standards). The result is a draft profile awaiting operator review
  and activation.

**Profile flow — establishment before discovery.** The establishment
campaign runs **first**, creating the profile. The discovery campaign
runs **second**, using that profile's signals/parameters to find
businesses. This mirrors the existing intelligence (seek) flow:

| Step | Intelligence (seek) | Gold standards |
|------|---------------------|----------------|
| 1. Establishment | Creates the city/category intelligence profile (terminology, synonyms, sources, evidence rules) | Creates the nationwide category/platform gold standard profile (expected_fields, quality gates, pattern exemplars). Always nationwide — derives the bar from the best independents anywhere. |
| 2. Activate | Operator reviews draft → activates the seek profile | Operator reviews draft → activates the gold standard profile |
| 3. Discovery | Uses the active seek profile's signals to discover emerging/competitive businesses in that city | Uses the active gold standard profile's bar to find additional candidates. Optionally narrowed to a city/state — this is Layer 2's purpose: finding strong regional independents that a nationwide search buries under more visible metro businesses. Candidates pass the same nationwide bar; they fill scoped slots, not nationwide ones. |
| 4. Act on results | Add discovered businesses to prospect queue; create campaigns | Add discovered candidates to the platform's gold standard slots (up to 4). Scoped promotions auto-create a city/state-scoped profile so regional exemplars coexist with nationwide ones. |

**Why establishment first:** the discovery campaign needs the profile's
signals to know what to search for. For intelligence, the establishment
profile tells discovery what terminology, sources, and evidence rules
to use when scanning a city. For gold standards, the establishment
profile tells discovery what expected fields, quality gates, and
pattern exemplars to evaluate candidates against on a platform.

**The two layers have complementary roles:**
- **Layer 1 (Establishment):** "What does excellence look like for this
  category?" — derives the universal bar (expected_fields +
  quality_gates) from the best independents nationwide, plus initial
  pattern exemplars. Always nationwide — narrowing it would produce a
  regionally-biased bar, defeating the purpose of a universal benchmark.
- **Layer 2 (Discovery):** "Who exemplifies excellence in *this*
  region?" — evaluates additional candidates against the established
  bar. The bar doesn't change; only *where you look* changes. A
  nationwide discovery finds more of the same metro businesses the
  establishment scan already surfaced. A region-narrowed discovery
  forces the analyst to dig into a specific geography and find strong
  local independents that pass the same bar but wouldn't appear in a
  nationwide search.

Without geographic narrowing, Layer 2 has little reason to exist —
the establishment scan already picked the strongest nationwide
candidates, and a nationwide discovery would either find weaker ones
or duplicates. Geographic narrowing gives Layer 2 a distinct job:
filling regional gaps the establishment scan structurally can't cover.

**Gold standard campaigns are platform-focused, with optional geographic
narrowing for discovery.** When Focus = `gold_standards`:
- **Establishment** scans always run nationwide — they derive the bar
  (expected_fields + quality_gates) from the best independents anywhere
  in the country. The City field is hidden for establishment campaigns.
- **Discovery** scans can optionally be narrowed to a city/state — the
  operator picks a region and the scan searches for candidates in that
  geography only. The City/State fields appear for discovery campaigns
  and are optional. When left blank, the scan runs nationwide (same as
  establishment).
- A **Platform** dropdown appears for both kinds — the operator picks
  which platform to scan (`all`, `google`, `yelp`, `facebook`, `bbb`,
  etc.)
- A platform-focused scan (e.g., "Google only") evaluates candidates
  only on that platform, producing higher-quality per-platform results
- An `all`-platforms scan evaluates candidates across all platforms in
  a single pass (broader but shallower per platform)
- The operator can run separate scans per platform — each scan's
  candidates populate that platform's slots in the gold standard profile

**When a discovery scan is city/state-narrowed and the operator promotes
a candidate:**
- A new city/state-scoped gold standard profile is auto-created from the
  nationwide profile (copies the bar, starts with empty candidate slots)
- The candidate is promoted into the scoped profile's per-platform slots
- The nationwide profile's slots are untouched — the scoped profile
  coexists with it
- `resolveGoldStandard(category, platform, city, state)` resolves the
  scoped profile first, falling back to state-specific, then nationwide
- Business audits in that region see regionally-relevant exemplars;
  business audits elsewhere see the nationwide exemplars

**Campaign naming convention.** The title auto-fill continues the
existing intelligence campaign pattern (Category + Kind + Focus +
locale/focus-dimension). For gold standards, the platform replaces the
city as the focus dimension:

| Focus | Kind | Platform | Auto-filled title |
|-------|------|----------|-------------------|
| `emerging` | `discovery` | (n/a) | "African Grocery Store - Discovery - Emerging - Indianapolis, IN" |
| `emerging` | `establishment` | (n/a) | "African Grocery Store - Establishment - Emerging - Indianapolis, IN" |
| `competitive` | `discovery` | (n/a) | "African Grocery Store - Discovery - Competitive - Indianapolis, IN" |
| `competitive` | `establishment` | (n/a) | "African Grocery Store - Establishment - Competitive - Indianapolis, IN" |
| `gold_standards` | `discovery` | `google` | "African Grocery Store - Discovery - Gold Standards - Google" |
| `gold_standards` | `establishment` | `google` | "African Grocery Store - Establishment - Gold Standards - Google" |
| `gold_standards` | `discovery` | `yelp` | "African Grocery Store - Discovery - Gold Standards - Yelp" |
| `gold_standards` | `establishment` | `yelp` | "African Grocery Store - Establishment - Gold Standards - Yelp" |
| `gold_standards` | `discovery` | `all` | "African Grocery Store - Discovery - Gold Standards - All Platforms" |
| `gold_standards` | `establishment` | `all` | "African Grocery Store - Establishment - Gold Standards - All Platforms" |

**Campaigns per category.** A single category can have up to 2
campaigns per platform (discovery + establishment), plus 2 for
`all`-platforms. With the top 4 platforms (Google, Yelp, Facebook, BBB)
+ `all`, that's up to 10 gold standard campaigns per category:

| Platform | Discovery | Establishment |
|----------|-----------|---------------|
| Google | "African Grocery Store - Discovery - Gold Standards - Google" | "African Grocery Store - Establishment - Gold Standards - Google" |
| Yelp | "African Grocery Store - Discovery - Gold Standards - Yelp" | "African Grocery Store - Establishment - Gold Standards - Yelp" |
| Facebook | "African Grocery Store - Discovery - Gold Standards - Facebook" | "African Grocery Store - Establishment - Gold Standards - Facebook" |
| BBB | "African Grocery Store - Discovery - Gold Standards - BBB" | "African Grocery Store - Establishment - Gold Standards - BBB" |
| All Platforms | "African Grocery Store - Discovery - Gold Standards - All Platforms" | "African Grocery Store - Establishment - Gold Standards - All Platforms" |

The naming makes each campaign uniquely identifiable in the campaign
list — the operator can see at a glance which category, kind, focus,
and platform a campaign covers. The auto-fill stops once the operator
manually edits the title (same behavior as existing intelligence
campaigns).

The `intelligence_focus` column is already `varchar(20)` on
`mkt_campaigns`, `mkt_intelligence_profiles`, `mkt_prompt_templates`,
`mkt_seek_batches`, and `mkt_directory_presence_seeds` — the value
`gold_standards` fits without a migration. The gold standard scan
prompt template is seeded with `intelligence_focus = 'gold_standards'`
and `intelligence_campaign_kind = 'establishment'`, so the prompt
resolution pipeline picks it up automatically.

### 4.3 Curation UX pattern

The admin page hosts **two separate list groups**:

1. **Seek Profiles (Intelligence)** — city-aware, focus-aware profiles
   that feed the seek prompt
2. **Gold Standard Profiles (Fulfill)** — city/state-aware (nationwide
   + optional scoped), platform-aware profiles that feed the fulfill
   prompt

The two lists don't mix. Each has its own Draft and Active sections.

**Shared filter bar:**
- Category filter (dropdown) — confirm coverage before running a scan
- Platform filter (dropdown) — "which categories have a Google gold standard?"
- Type filter (dropdown) — "which categories have social_media coverage?"
- Search (text) — by category name or business name

**Gold standard card badges:**
- Category badge — the category name
- Platform badges — one per platform, color-coded by type, showing
  check/cross for whether that platform has candidates. Each platform
  badge with candidates is a **clickable link** to the top candidate's
  live profile URL on that platform (e.g., clicking `[Google ✓]` opens
  the highest-scored Google candidate's GBP listing in a new tab)
- Type coverage summary — "directory: 3/4 · social_media: 0/1"
- Status badge — Draft / Active / Retired
- City-agnostic badge
- Version badge
- Summary line — "N candidates · M platforms with standards"

**Destination URL is always visible.** Every gold standard candidate
has a live profile URL (the destination URL on the platform — e.g.,
`https://www.google.com/maps/place/...`, `https://www.yelp.com/biz/...`).
This URL is shown wherever the candidate appears:
- On the card (platform badges link to the top candidate's URL)
- In the review view (each candidate card shows a clickable URL)
- In the fulfill prompt output (the pattern reference includes the URL
  so the operator can verify the exemplar during execution)
- In the deliverable (the fix sheet references the pattern's URL so the
  customer can see the exemplar for themselves)

The destination URL is the **verification anchor** — it lets the
operator confirm the scan's assessment is accurate at any point in the
workflow, and it lets the customer see the concrete example the fix
sheet is based on.

**Review view (gold standard drafts):**
- Universal expected fields (canonical NAP, hours, universal quality
  gates) in readable format
- Per-platform expected fields + quality gates (non-negotiable vs.
  recommended badges)
- Per-platform candidate cards (up to 4 per platform) with quality
  scores, rationales, platform config, NAP, and **clickable live
  profile URL** for each candidate
- Scan metadata (scan date, sources, selection criteria)

**Activation:**
- Same endpoint for both seek and gold standard profiles
- Activation retires the previous active profile for the same category
- Until activated, the profile is inert and the resolver won't pick it
  up

---

## 5. Gold Standard System

### 5.1 The concept — gold standards are both data and targets

For each business category, a gold standard is **two things at once**:

1. **Data** — the expected field values per platform/category. These are
   the target data fields the fulfill prompt drives toward.
2. **Target/pattern** — a concrete business that proves the data fields
   are achievable and shows what they look like in practice.

This mirrors the seek side:

| Seek | Fulfill |
|------|---------|
| **Signals** (what's broken — from audit) | **Data fields** (what correct looks like — from gold standard) |
| **Intelligence profile** (category context) | **Gold standard pattern** (category target state — concrete exemplar) |

**Pattern is to fulfill as profile is to seek. Data fields is to fulfill
as signals are to seek.**

### 5.2 Data structure

Gold standard profiles store two blocks in `configuration_json`:

#### `expected_fields` — the data layer

Split into:
- **`universal`** — fields that translate across ALL platforms (NAP,
  hours, website). The fulfill prompt checks these on every platform.
- **`platforms`** — fields specific to each platform (categories,
  attributes, page_type, photo_count, description). Keyed by platform
  name.

Each platform's expected fields include:
- Target field values (e.g., `primary_category`, `required_attributes`)
- **Branding artifact fields** — logo, cover photo, banners, profile
  photos, photo count, photo types. Gold standard businesses typically
  have superior branding; the expected fields capture what "good
  branding" looks like for this category on this platform (e.g.,
  `has_logo: true`, `has_cover_photo: true`, `min_photo_count: 10`,
  `photo_types: ["logo", "cover", "exterior", "interior", "products"]`).
  These are `recommended` gates (non-blocking) — the repair package
  fixes NAP/categories/hours, but branding asset creation is an upsell
  (see the product spec's upsell section). The gap analysis flags
  missing branding so the operator can pitch the upsell with concrete
  evidence.
- Quality gates — universal and platform-specific
  - Universal gates: `presence`, `nap_accuracy`, `hours_accuracy`
    (non-negotiable on every platform)
  - Platform-specific gates: e.g., Google `primary_category_set`,
    Yelp `categories_set`, Facebook `page_type_correct`
  - **Branding gates** (recommended, non-blocking): `has_logo`,
    `has_cover_photo`, `min_photo_count`, `photo_types` — derived from
    what all/most gold standard candidates have
  - Gate severity: `non_negotiable` (blocking) or `recommended`
    (non-blocking). Severity is derived from candidate evidence — if
    all candidates pass a gate, it's non-negotiable; if only some pass,
    it's recommended.

#### `gold_standards` — the pattern layer

Per platform, up to 4 concrete businesses that match or exceed the
expected fields. Each candidate includes:
- Business name, city, state
- Quality score (1-10) with rationale
- `is_gold_standard` tag per platform
- Platform config (categories, attributes, photo_count, description)
- NAP record
- **`destination_url`** — the live profile URL on the platform (e.g.,
  `https://www.google.com/maps/place/...`, `https://www.yelp.com/biz/...`).
  This is a **required field** — every candidate must have a destination
  URL. The URL is the verification anchor: it lets the operator confirm
  the scan's assessment, and it's shown wherever the candidate appears
  (card badges, review view, fulfill output, deliverable). See §4.3.
- Provenance and freshness

Candidate caps are **per platform, not global** — up to 4 candidates
per platform, different candidates may be selected for Google vs. Yelp
vs. Facebook. A candidate is retained if it qualifies as a standard on
at least one platform. The same business may appear under multiple
platforms only if it independently qualifies on each.

### 5.3 Platform keys

| Key | Platform | Primary type | Secondary type |
|-----|----------|-------------|----------------|
| `google` | Google Business Profile | directory | reputation |
| `yelp` | Yelp | directory | reputation |
| `facebook` | Facebook Page | social_media | directory |
| `bbb` | BBB | directory | reputation |
| `apple_maps` | Apple Maps | directory | — |
| `bing` | Bing Places | directory | — |
| `mapquest` | MapQuest | directory | — |
| `waze` | Waze | directory | — |
| `instagram` | Instagram | social_media | — |
| `tiktok` | TikTok | social_media | — |
| `linkedin` | LinkedIn | social_media | directory |
| `trustpilot` | Trustpilot | reputation | directory |
| `vertical_directories` | Niche-specific directories (keyed by name) | directory | — |
| `website` | Business website | website | — |

The `vertical_directories` key is a nested object because vertical
directories are category-specific. The `website` key is optional —
populated only for niches where the website is critical to conversions.

### 5.4 Resolution and serialization

`serializeGoldStandard(campaign)` is called during prompt resolution for
both the audit prompt (as benchmark) and the fulfill prompt (as target).
Same function, same resolution, different injection point.

1. Reads `campaign.category`, `campaign.city`, `campaign.state`, and the
   campaign's tier scope
2. Calls `IntelligenceProfileService.resolveGoldStandard(category, platform, city, state)`
   — resolves city-specific → state-specific → nationwide, with
   platform-specific preferred over cross-platform at each layer
3. Extracts `expected_fields` and `gold_standards` from
   `configuration_json`
4. For each platform in the tier scope:
   - Applies universal quality gates (presence, nap_accuracy,
     hours_accuracy)
   - Reads platform-specific expected fields and quality gates
   - Picks the highest `quality_score` entry as the pattern exemplar
5. Serializes all layers into a text block — **including the
   destination URL for each pattern exemplar**

**The serialized output includes destination URLs.** Each pattern
exemplar's `destination_url` is included in the serialized text block
so the AI model can:
- **Reference the URL** in its output (the audit's gap analysis or the
  fulfill's fix sheet can cite the exemplar's live profile)
- **Browse the URL** if the model has web access, to verify the
  exemplar's current state matches the scan's assessment (categories,
  photos, description may have changed since the scan)
- **Ground its analysis** in the concrete exemplar rather than
  abstract field values alone

The serialized format per platform includes an explicit **platform
directive** — a statement of what role the gold standard plays for that
platform in this prompt. The model doesn't have to infer the purpose;
the directive tells it.

**For seek (audit prompt) — benchmark directive:**

```
Platform: google
DIRECTIVE: This is your BENCHMARK for Google. Compare the business's
actual Google profile against these expected fields and quality gates.
Flag any field where the business's actual value differs from the
expected value as a gap. Score the business against each quality gate.
Evaluate branding artifacts (logo, cover photo, photo count, photo
types) against the branding gates and flag missing/low-quality
branding as gaps — these are recommended (non-blocking) but should
appear in the gap_analysis for upsell opportunity identification.
Expected fields:
  primary_category: "African goods store"
  additional_categories: ["Grocery store"]
  required_attributes: ["SNAP accepted"]
  min_photo_count: 10
  description_requirements: ["mentions cuisine/diaspora served"]
  Branding artifacts:
    has_logo: true
    has_cover_photo: true
    photo_types: ["logo", "cover", "exterior", "interior", "products"]
Quality gates:
  primary_category_set: non-negotiable
  claimed: non-negotiable
  min_photos: recommended (threshold: 10)
  has_logo: recommended
  has_cover_photo: recommended
Pattern exemplar:
  Business: Baraka Market (Kansas City, MO)
  Quality score: 9/10
  Destination URL: https://www.google.com/maps/place/Baraka+Market/...
  Platform config:
    primary_category: "African goods store"
    attributes: ["SNAP accepted", "Women-led", "Small business"]
    photo_count: 24
    photo_types: ["logo", "cover", "exterior", "interior", "products"]
    has_logo: true
    has_cover_photo: true
    description: "East African and Somali halal grocery serving..."
```

**For fulfill (fix sheet prompt) — target directive:**

```
Platform: google
DIRECTIVE: This is your TARGET for Google. Generate fix instructions
that move the business's Google profile toward these expected field
values. Use the pattern exemplar as the concrete adaptation source —
adapt its description style, category selection, and attribute set for
this business. Do not copy it verbatim. Address every quality gate
that the business fails. For branding gates (has_logo, has_cover_photo,
min_photos) that the business fails, note them as recommended next
steps in the fix sheet — branding asset creation is an upsell, not part
of the core repair, but the fix sheet should flag the gap and reference
the exemplar's branding for comparison.
Expected fields:
  ... (same fields as above, including branding artifacts)
Quality gates:
  ... (same gates as above, including branding gates)
Pattern exemplar:
  ... (same exemplar as above, including destination URL and branding)
```
Platform: google
DIRECTIVE: This is your TARGET for Google. Generate fix instructions
that move the business's Google profile toward these expected field
values. Use the pattern exemplar as the concrete adaptation source —
adapt its description style, category selection, and attribute set for
this business. Do not copy it verbatim. Address every quality gate
that the business fails.
Expected fields:
  ... (same fields as above)
Quality gates:
  ... (same gates as above)
Pattern exemplar:
  ... (same exemplar as above, including destination URL)
```

The directive changes by injection context but the data is the same.
`serializeGoldStandard` accepts a `role` parameter (`'benchmark'` for
audit, `'target'` for fulfill) that determines which directive is
prepended to each platform block. The same resolved profile, the same
serialized fields, the same destination URLs — just a different
instruction to the model about what to do with them.

**Per-platform isolation:** Use only the relevant platform's pattern and
fields for that platform's section. Do not apply Google categories to
Yelp, or cross-contaminate platform instructions. Each platform block
is self-contained with its own directive, expected fields, gates, and
exemplar.

**Fallback chain:**
- If no pattern exists for a platform → use expected fields + quality
  gates alone (no destination URL for that platform, directive still
  applies)
- If neither exists → use generic instructions, but universal gates
  still apply (directive notes "no category-specific benchmark/target
  available — use generic best practices")

### 5.5 Website gold standards

Website can be a gold standard platform even though it's not in the
repair packaging. The gold standard system is broader than any single
product's packaging.

For niches where the website is critical to conversions, the scan
captures:
- Hero copy pattern
- CTA pattern
- Service page structure
- NAP presentation
- Trust signals
- Mobile optimization

Website gold standards are **not** injected into the repair fulfill
prompt (the repair package doesn't fix websites). They're used for:
1. **Upsell pitch** — "here's what a well-optimized plumbing website
   looks like"
2. **Audit flagging** — the quality gates provide the benchmark for what
   "issues" means

Not every niche needs a website gold standard. The operator runs the
website portion of the scan only for niches where the website is the
primary conversion surface.

---

## 6. Platform SOP Module

### 6.1 The concept

Every platform has a claim/edit/correction procedure, even if hidden or
poorly documented. The SOP module captures the researched step-by-step
procedure for each platform — the **how**. The gold standard provides
the **what** (target values). The fulfill prompt combines both:

> "Set primary_category to 'African goods store' [gold standard] by
> following these steps: GBP dashboard → Info → pencil icon [SOP]."

SOPs are **platform-specific and category-agnostic** — the same Google
SOP applies to plumbing, African grocery, and nail salons. The
category-specific part comes from the gold standard, not the SOP.

### 6.2 What the SOP captures

| Field | Description |
|-------|-------------|
| `platform_key` | The platform identifier |
| `platform_type` | directory / social_media / reputation |
| `claim_process` | How to claim an unclaimed listing |
| `edit_process` | How to correct NAP/categories on an existing claimed listing |
| `access_method` | How the operator gets access (manager invite, login sharing, etc.) |
| `api_available` | Whether an API exists for programmatic updates |
| `verification_method` | How to verify the change took effect |
| `expected_timeline` | How long corrections take to appear |
| `common_pitfalls` | Known issues that trip up operators |
| `diy_instructions` | Step-by-step for the DIY customer |
| `dfy_instructions` | Step-by-step for the operator |
| `researched_at` | When the SOP was last verified |
| `researched_by` | Who researched/verified the procedure |
| `status` | current / outdated / needs_research |

### 6.3 Storage

The SOP module is a **separate data structure** from gold standard
profiles. Gold standards are category-specific; SOPs are
platform-specific and category-agnostic.

**Proposed:** `mkt_platform_sops` table or JSONB in `unifiedConfig`,
keyed by `platform_key`.

### 6.4 Research workflow

1. **Initial research** — operator researches the procedure (official
   docs, testing, screenshots)
2. **Verification** — operator confirms the procedure works end-to-end
3. **Documentation** — operator fills in SOP fields, marks `current`
4. **Periodic re-verification** — quarterly or on procedure failure.
   Outdated SOPs marked `needs_research`.

### 6.5 Fulfill integration

The fulfill prompt's `submissionGuide` is generated from the SOP module.
For each platform in scope:
1. Read the platform's SOP
2. Combine the SOP's procedure with the gold standard's target values
3. The `diy_instructions` or `dfy_instructions` (depending on delivery
   mode) is the base procedure, with gold standard values injected

### 6.6 Coverage priority

1. Top 4 platforms (highest volume) — SOPs first
2. Common additional platforms — straightforward procedures
3. Data aggregators — most hidden/complex, most research needed
4. Vertical directories — niche-specific, researched per category

A platform without an SOP can still be in scope — the fulfill prompt
notes "SOP pending" and instructions are marked incomplete.

---

## 7. Retainer Model

### 7.1 The concept

The retainer is a **contract for specific platforms** — the platforms in
the customer's tier scope at repair time. It is a two-way relationship:

1. **System-initiated (drift defense)** — the system scans for unplanned
   drift and alerts the operator to re-correct
2. **Merchant-initiated (change requests)** — the merchant submits
   planned changes and the operator executes them on the contracted
   platforms

### 7.2 Contracted platforms

The retainer subscription record stores the list of contracted platforms
at activation time. Both the drift scan and the change request flow use
this list.

### 7.3 Drift scan (system-initiated)

Automated monthly scan that checks each contracted platform for:
- **Presence** — is the listing still there?
- **NAP accuracy** — does NAP still match canonical?
- **Hours accuracy** — do hours still match canonical?
- **Claim status** — is the listing still claimed?

The scan compares current state against the canonical record. Drift =
any field that no longer matches. When drift is detected, an admin alert
is created with: customer, campaign, platform(s), drifted field(s),
severity, suggested action.

The operator reviews the alert and either: re-submits the correction
(DFY, included), accepts the drift (owner confirmation + canonical
record update), or escalates to the customer.

### 7.4 Change requests (merchant-initiated)

The merchant submits change requests through the customer portal:
- Seasonal hours changes
- Holiday closures
- New phone number
- Address move (requires owner confirmation — high-impact)
- New website
- Category/attribute updates

The operator receives the request, updates the canonical record, and
pushes the change to all contracted platforms using the Platform SOP.
For scheduled changes (e.g., seasonal hours), a calendar reminder is
set to execute on the effective date.

### 7.5 Activity status report

The customer portal includes a retainer activity status report showing
a full log of what the retainer is doing. Every action is tagged with
one of four activity types:

| Type | Direction | Description |
|------|-----------|-------------|
| **proactive** | system-initiated | The system scanned for drift before the merchant knew there was a problem |
| **defensive** | system → operator | The system detected drift and the operator corrected it |
| **request** | merchant-initiated | The merchant submitted a change request |
| **execution** | operator | The operator executed a correction or change on the contracted platforms |

The portal shows:
- **Summary cards** — counts for the current month by type
- **Activity timeline** — chronological log with type badges, platform
  tags, descriptions, and status
- **Platform health dashboard** — per-platform current status (clean /
  drift detected / correction in progress), last scanned, last corrected
- **Request submission form** — with submitted requests appearing in
  the timeline with status tracking

The activity report is the **retention tool** — without it, the merchant
pays monthly and sees nothing. With it, every month has a visible record
of retainer value, even when no drift is found.

---

## 8. Dual Execution Pattern

Both seek and fulfill support two execution paths:

### 8.1 AI execution

- Prompt runs through the model
- Output validated against registered Zod schema
- Post-import hook persists the result

### 8.2 External import

- Operator generates output externally (different model, manual
  analysis, third-party tool)
- Output pasted/imported via `/executions/external`
- Same Zod schema validation
- Same post-import hooks fire

### 8.3 Why dual execution

- Not all prompts produce reliable AI output on first run — the external
  path lets the operator use a better model or manual research
- Some scans require web browsing or API access the AI agent doesn't
  have — the operator can do the research externally and import
- The schema validation ensures quality regardless of source — the
  system doesn't care how the output was produced, only that it matches
  the schema

### 8.4 Post-import hooks

Both paths trigger the same post-import hooks:
- Seek: persists the briefing (`profile_repair_audit` or equivalent)
- Fulfill: persists the deliverable (`citation_repair_package` or
  equivalent)
- Gold standard scan: populates the intelligence profile draft

### 8.5 Destination URL capture — an intentional focus on both sides

Both the seek side (audit) and the fulfill side (gold standard scan)
must **intentionally capture destination URLs** — the live profile URL
for each platform they evaluate. This is not an afterthought; it's a
required focus of every scan and audit prompt.

**Seek side (audit):** the `business_analysis` audit evaluates the
target business's profiles on Google, Yelp, Facebook, BBB, etc. For
each platform, the audit must capture the live profile URL (e.g., the
Google Maps listing URL, the Yelp business URL). This lets the operator
verify audit findings by visiting the live profile. The existing
`platformSchema` needs a `profile_url` field added.

**Fulfill side (gold standard scan):** the gold standard scan evaluates
candidate businesses per platform. For each platform evaluation, the
scan must capture the live profile URL. This is the verification anchor
— the operator clicks the URL to confirm the scan's assessment, and the
URL is shown wherever the candidate appears (admin cards, review view,
fulfill output, deliverable). See §5.2.

**Why this matters:** without destination URLs, the operator has to
manually search for each business on each platform to verify the scan's
or audit's findings. With URLs captured, verification is one click. The
prompts must explicitly instruct the model to search for and record the
exact URL — not just the business name. If the URL cannot be found, the
field is set to null and noted in the rationale.

---

## 9. How Product Specs Use This Architecture

Each product spec (Profile Repair, Review Acceleration, Conversion Fix,
etc.) defines:

1. **Product-specific tiers and pricing** — not in this doc
2. **Product-specific platform scope** — which platforms are in each
   tier, with type minimums
3. **Product-specific deliverable format** — what the fulfill output
   looks like (fix sheet, review response template, landing page copy,
   etc.)
4. **Product-specific quality gates** — beyond the universal gates
5. **Product-specific retainer terms** — if the product has a retainer
6. **Product-specific upsells** — what's not included and sold
   separately

The product spec **references** this architecture doc for:
- The seek/fulfill parallel (§2)
- Platform type taxonomy (§3)
- Profile lifecycle and curation UX (§4)
- Gold standard system (§5)
- Platform SOP module (§6)
- Retainer model (§7)
- Dual execution pattern (§8)
- Prompt families (§10)

This keeps each product spec focused on what's unique to that product,
with the shared architecture defined once here.

---

## 10. Prompt Families

A **prompt family** is a set of prompts that share the same dual-profile
injection (intelligence profile + gold standard profile) but serve
different purposes within a product offering. The architecture supports
families so a single product can have multiple seek and fulfill prompts
without each one redefining the injection pipeline.

### 10.1 How a family works

Every prompt in a family receives the same resolved variables:
- `{intelligence_profile}` — category context (terminology, sources,
  evidence rules), resolved by city
- `{gold_standard_benchmark}` or `{gold_standard}` — category target
  state (expected fields, quality gates, pattern exemplars, destination
  URLs, branding artifacts), resolved by platform, with a role directive

The difference between prompts in a family is:
1. **Role** — benchmark (seek) vs. target (fulfill)
2. **Focus** — what aspect of the gold standard the prompt emphasizes
3. **Output schema** — what the prompt produces
4. **Post-import hook** — what the system does with the output

### 10.2 Branding prompt family

The first prompt family beyond Profile Repair is **Branding** — powered
by both profiles, focused on branding artifacts. The gold standard's
branding gates and exemplar branding data drive every prompt in the
family.

| Prompt | Type | Role | Input emphasis | Output | Post-import hook |
|--------|------|------|----------------|--------|-----------------|
| `mpt-branding-audit` | seek | benchmark | Branding gates + exemplar branding per platform | `branding_audit` — per-platform branding gap analysis with `is_branding_gap` flags, recommended asset list, exemplar comparison URLs | Persists as branding audit execution row |
| `mpt-branding-recommendation` | seek | benchmark | Branding gates + category context | `branding_recommendation` — what branding assets to create, why, priority order, platform-specific specs (dimensions, formats) | Persists as recommendation execution row |
| `mpt-branding-creation-guide` | fulfill | target | Exemplar branding + platform specs | `branding_creation_guide` — DIY instructions for sourcing/creating each asset (logo, cover photo, banners, photos), with platform-specific dimensions and format requirements | Persists as deliverable — the DIY upsell deliverable |
| `mpt-branding-upsell-pitch` | seek | benchmark | Branding gaps + exemplar comparison | `branding_upsell_pitch` — operator-facing pitch document with evidence (gap summary, exemplar URLs, before/after framing, price points) | Persists as pitch execution row |

### 10.3 Branding family injection

Each branding prompt receives the same dual-profile injection, but the
`serializeGoldStandard` role and emphasis differ:

**Branding audit (seek, benchmark):**
```
Platform: google
DIRECTIVE: This is your BENCHMARK for Google BRANDING. Compare the
business's actual branding artifacts (logo, cover photo, photos,
banners) against the gold standard's branding gates and exemplar.
Flag every missing or low-quality branding artifact as a gap. For
each gap, note the exemplar's branding for comparison (destination
URL provided). Mark all branding gaps as recommended (non-blocking).
Expected fields:
  ... (branding artifact fields: has_logo, has_cover_photo,
       min_photo_count, photo_types)
Quality gates:
  ... (branding gates: has_logo, has_cover_photo, min_photos —
       all recommended)
Pattern exemplar:
  ... (including branding data and destination URL)
```

**Branding creation guide (fulfill, target):**
```
Platform: google
DIRECTIVE: This is your TARGET for Google BRANDING. Generate
step-by-step instructions for creating/sourcing each branding
artifact the business is missing. Use the exemplar's branding as
the concrete reference — what their logo looks like, what their
cover photo shows, how many photos they have and what types.
Include platform-specific specifications (dimensions, formats,
file size limits). The output is a DIY guide the customer follows
to create and upload branding assets.
Expected fields:
  ... (branding artifact fields)
Quality gates:
  ... (branding gates)
Pattern exemplar:
  ... (including branding data and destination URL)
```

### 10.4 Family extensibility

The branding family is the first example, but the pattern extends to
other families:

| Family | Seek prompts | Fulfill prompts | Gold standard emphasis |
|--------|-------------|-----------------|----------------------|
| **Profile Repair** | triage, per-issue audits | citation repair package | NAP, categories, attributes, hours |
| **Branding** | branding audit, recommendation, upsell pitch | creation guide | Logo, cover photo, photos, banners |
| **Review Acceleration** | review gap audit, response strategy | review response templates | Review volume, response rate, rating |
| **Conversion Fix** | conversion audit, CTA analysis | landing page copy, CTA recommendations | CTA patterns, service page structure |
| **Visual & Asset Refresh** | visual audit, asset inventory | asset refresh guide | Photo quality, visual consistency |

Each family:
- Uses the same `mkt_intelligence_profiles` table
- Uses the same `serializeGoldStandard(category, role)` function
- Uses the same dual execution pattern (AI + external import)
- Uses the same post-import hook pattern
- Defines its own output schemas (registered in `OUTPUT_SCHEMA_REGISTRY`)
- Defines its own quality gates (layered on top of universal gates)

The architecture is built once; each family adds prompts and schemas
without adding infrastructure.
