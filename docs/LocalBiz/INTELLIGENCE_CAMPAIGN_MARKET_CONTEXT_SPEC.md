# Intelligence Campaign Market Context Injection — Spec

> Wire enrichment-produced market intelligence (category_profile + city_profile + market_gaps + prospect_signals) into establishment and discovery campaigns, with narrative awareness that announces, presents, and sets expectations for the analyst.

---

## 1. Overview

### 1.1 Problem

Establishment and discovery campaigns discover and prospect businesses in a category + city market. Today they work from:
- The category name (general knowledge)
- The intelligence profile (if one exists — describes how to discover businesses in the category)
- The gold standard (discovery only — benchmarks candidates against the best)

They do NOT receive the enrichment-produced market intelligence:
- `category_profile` — what businesses in this category look like structurally
- `category_signals` — what strong looks like in this category
- `market_density` — how saturated this category is in this city
- `city_profile` — the city's structural characteristics (industries, demographics, growth)
- `market_gaps` — where demand is unmet in this city
- `prospect_signals` — what to look for when prospecting
- `metro_dynamics` — nearby cities and their character

The intelligence campaigns are flying blind to the market context the enrichment runs already produced.

### 1.2 Solution

Inject market intelligence into establishment and discovery prompts at render time, with a binding section that:
1. **Announces** what the intelligence is and where it came from
2. **Presents** each field and what it means
3. **Sets expectations** for how the analyst should use it
4. **Distinguishes** the intelligence from the existing intelligence profile and gold standard

This mirrors the `MARKET_CONTEXT_BINDING` added to the business audit templates, but framed for discovery/establishment instead of audit.

### 1.3 Design principles

- **Narrative awareness, not just data injection.** The analyst should understand what they're looking at, not just receive a block of JSON. The binding announces the intelligence, presents each field, and sets expectations for use.
- **Graceful degradation.** If enrichment hasn't run yet, the campaigns proceed with their existing inputs. The intelligence is additive, not blocking.
- **No sentiment bleed.** The campaigns receive intelligence only (profiles, signals, gaps) — not the enrichment sentiments (body_copy, shopper_guide, faq). Same boundary as the seed audit.
- **PG sequence aware.** The intelligence is produced by stages 1-2 of the PG workflow. The campaigns are stages 3-4. The binding acknowledges this lineage.

---

## 2. PG sequence context

```
PG WORKFLOW (production order):

  STAGE 1: Location enrichment
    → Produces: city_profile, market_gaps, metro_dynamics, notable_areas
    → Persists: ('__location__', city, state) context JSONB

  STAGE 2: Category enrichment
    → Produces: category_profile, category_signals, market_density,
                prospect_signals, secondary_categories
    → Persists: (category, city, state) context JSONB
    → Consumes: city_profile (structural only, no place names)

  STAGE 3: Establishment scan ← THIS SPEC
    → Discovers best-in-class businesses for the category
    → Consumes: category_profile (WHAT to look for) +
                city_profile (WHERE/HOW to look) +
                category_signals (what strong looks like)
    → Produces: gold standard profile (benchmark for the category)

  STAGE 4: Discovery ← THIS SPEC
    → Prospects businesses in the category + city
    → Consumes: category_profile + city_profile +
                market_gaps (WHERE demand is unmet) +
                prospect_signals (WHAT to look for) +
                metro_dynamics (nearby market context)
    → Produces: discovery leads (businesses to prospect)

  STAGE 5: Business audit
    → Consumes: all intelligence + gold standard
    → Produces: market-aware audit
```

Stages 3-4 are city-scoped. They need both dimensions of the market — category and location. Same parallel as the seed audit: market = category + location.

---

## 3. Establishment scan injection

### 3.1 What the establishment scan does

The establishment scan finds 3-5 best-in-class businesses for a category on a platform (or all platforms). It evaluates each candidate against quality gates and derives the gold standard profile (expected fields, quality gates, branding standards).

### 3.2 What it currently receives

```
CURRENT INPUTS:
  - Category name (general knowledge)
  - Platform focus (which platform to scan)
  - City (reference market — used for city-scoped profiles)
  - Intelligence profile (if exists — describes how to discover businesses)
```

### 3.3 What it should receive

```
NEW INPUTS (from enrichment intelligence):
  - category_profile: business_model, typical_products, customer_base,
    online_presence_pattern, competitive_landscape, typical_scale
    → WHAT to look for (the business model shape)

  - city_profile: metro_description, major_industries, growth_trajectory,
    demographic_character, market_character
    → WHERE/HOW to look (the city's market character)

  - category_signals: what strong looks like in this category
    → HOW to evaluate candidates (the signal checklist)

  - market_density: qualitative density in this city
    → EXPECTATION SETTING (sparse = few candidates expected;
      dense = many candidates, competitive)
```

### 3.4 The binding (narrative awareness)

```
=== MARKET CONTEXT (from prior enrichment runs) ===

This scan benefits from market intelligence produced by prior PG enrichment runs.
The intelligence below was produced by:

  - Location enrichment (Stage 1): established the city's market character
  - Category enrichment (Stage 2): established the category's business model

Use this intelligence to guide your candidate discovery and evaluation.

CATEGORY PROFILE (what businesses in this category look like):
  - Business model: {business_model}
  - Typical products: {typical_products}
  - Customer base: {customer_base}
  - Online presence pattern: {online_presence_pattern}
  - Competitive landscape: {competitive_landscape}
  - Typical scale: {typical_scale}

  Use this to recognize qualifying businesses — a business that matches the
  category profile is more likely to be a strong candidate. A business that
  deviates significantly may be miscategorized or not a true category member.

CITY PROFILE (the market these businesses operate in):
  - Metro description: {metro_description}
  - Major industries: {major_industries}
  - Growth trajectory: {growth_trajectory}
  - Demographic character: {demographic_character}
  - Market character: {market_character}

  Use this to understand WHERE these businesses concentrate and WHAT the
  market looks like. A city with large immigrant communities will have
  stronger ethnic grocery candidates; a city with a logistics hub will have
  more distribution-oriented businesses.

CATEGORY SIGNALS (what strong looks like):
  {category_signals as checklist}

  Use these signals to evaluate candidates. A candidate that meets more
  signals is a stronger gold standard candidate. Record which signals each
  candidate meets or misses in your evaluation.

MARKET DENSITY (expectation setting):
  {market_density}

  Use this to calibrate expectations. In a sparse market, your candidate
  pool will be small — that's expected. In a dense market, you have more
  candidates to choose from but the bar is higher.

If any of these blocks are missing, proceed with your existing instructions —
the intelligence is additive, not blocking. Note the absence in scan_metadata.
```

### 3.5 Injection point

The establishment scan template (`mpt-seed-gold-standard-scan-001`) is a `seek` prompt with a body that ends before the JSON schema suffix. The market context block is appended after the body, before the suffix — same pattern as `buildMarketContextBlock` for the business audit.

```
Rendered establishment prompt:
  [template body]
  [market context block]     ← NEW
  [JSON schema suffix]
```

### 3.6 Implementation

In `MarketingExecutionService.resolvePrompt`, the intelligence scope branch (which delegates to `PromptComposerService` for discovery, and directly renders for establishment) needs a new step: load market context and append it.

For establishment scans (`intelligence_campaign_kind = 'establishment'`):
- After the template body is rendered
- Before the prompt suffix is appended
- Load `category_profile` + `city_profile` + `category_signals` + `market_density` from the enrichment context JSONB
- Format as the binding block above
- Append to the rendered prompt

---

## 4. Discovery injection

### 4.1 What discovery does

Discovery finds businesses to prospect. Two focuses:
- **Emerging**: discover low-visibility, hard-to-find businesses
- **Competitive**: analyze established competitors

### 4.2 What it currently receives

```
CURRENT INPUTS:
  - Category name
  - City, state, zip codes, search radius, neighborhood
  - Focus (emerging / competitive)
  - Intelligence profile (if exists — composed by PromptComposerService)
  - Gold standard (if exists — benchmark for candidate evaluation)
```

### 4.3 What it should receive

```
NEW INPUTS (from enrichment intelligence):
  - category_profile: WHAT to look for (business model shape)
  - city_profile: WHERE to look (market character, industries, demographics)
  - market_gaps: WHERE demand is unmet (specific areas + categories)
  - prospect_signals: WHAT to look for when prospecting
  - metro_dynamics: nearby market context (expansion opportunities)
  - category_signals: HOW to evaluate discovered candidates
  - market_density: EXPECTATION SETTING (how many to expect)
```

### 4.4 The binding (narrative awareness)

```
=== MARKET CONTEXT (from prior enrichment runs) ===

This discovery benefits from market intelligence produced by prior PG enrichment runs.
The intelligence below was produced by:

  - Location enrichment (Stage 1): established the city's market character,
    identified demand gaps, and mapped metro dynamics
  - Category enrichment (Stage 2): established the category's business model,
    identified what strong looks like, and produced prospecting signals

Use this intelligence to target your discovery. The intelligence tells you
WHAT to look for (category profile), WHERE to look (city profile + market gaps),
and HOW to evaluate what you find (category signals).

CATEGORY PROFILE (what businesses in this category look like):
  - Business model: {business_model}
  - Typical products: {typical_products}
  - Customer base: {customer_base}
  - Online presence pattern: {online_presence_pattern}
  - Competitive landscape: {competitive_landscape}
  - Typical scale: {typical_scale}

  Use this to recognize qualifying businesses. Businesses matching this
  profile are your primary targets. Businesses that partially match may
  be conversion opportunities (e.g., an international grocery that could
  reposition as African grocery).

CITY PROFILE (the market you're discovering in):
  - Metro description: {metro_description}
  - Major industries: {major_industries}
  - Growth trajectory: {growth_trajectory}
  - Demographic character: {demographic_character}
  - Market character: {market_character}

  Use this to understand the market. A city with large diaspora communities
  will have more ethnic grocery candidates. A city with a growing tech sector
  will have more new businesses. Let the city's character guide WHERE you
  search.

MARKET GAPS (where demand is unmet):
  {market_gaps as list: category, signal, area}

  Use this to target your discovery. If the category you're discovering has
  a market gap in a specific area, prioritize that area. Businesses in gap
  areas are high-value prospects — they fill unmet demand.

PROSPECT SIGNALS (what to look for when prospecting):
  {prospect_signals as checklist}

  Use these signals to identify prospects. A business that matches these
  signals is a strong prospect even if it doesn't explicitly identify as
  this category (e.g., an international grocery near a diaspora neighborhood
  is a conversion prospect for African grocery).

CATEGORY SIGNALS (what strong looks like):
  {category_signals as checklist}

  Use these to evaluate discovered candidates. A candidate that meets more
  signals is a stronger prospect. Record which signals each candidate meets.

MARKET DENSITY (expectation setting):
  {market_density}

  Use this to calibrate expectations. In a sparse market, you'll find fewer
  candidates — that's expected, not a failure. In a dense market, you'll
  find more but the competitive bar is higher.

METRO DYNAMICS (nearby market context):
  {metro_dynamics as list: city, relationship, character, business_scene}

  Use this for expansion context. If nearby cities have complementary
  characteristics, businesses there may be expansion prospects. Note this
  in your discovery metadata when relevant.

If any of these blocks are missing, proceed with your existing instructions —
the intelligence is additive, not blocking. Note the absence in
scan_metadata or discovery_metadata.
```

### 4.5 Focus-specific framing

The binding above is the base. Each focus adds a one-line framing:

**Emerging:**
```
For EMERGING discovery, prioritize businesses that DON'T appear in the
category profile's online_presence_pattern — businesses with thin online
presence are the emerging targets this intelligence helps you find.
```

**Competitive:**
```
For COMPETITIVE discovery, prioritize businesses that DO match the
category profile and meet the most category_signals — these are the
established competitors. Use market_density to understand how many
to expect.
```

### 4.6 Injection point

Discovery prompts are composed by `PromptComposerService` from fragments:
1. Category Base fragment
2. Intelligence Extension fragment
3. Profile block (or generic fallback)
4. Focus modifier fragment

The market context block is appended as step 5:

```
Composed discovery prompt:
  1. [category base fragment]
  2. [intelligence extension fragment]
  3. [profile block / generic fallback]
  4. [focus modifier fragment]
  5. [market context block]     ← NEW
  6. [JSON schema suffix]
```

### 4.7 Implementation

In `PromptComposerService.composeIntelligencePrompt`, after assembling the four fragments, load the market context and append it:

```typescript
// 5. Load market context from enrichment runs
const marketContext = await this.loadMarketContext(
  input.category,
  input.city,
  input.focus,
  ctx,
);

// 6. Assemble: base + extension + profile + focus + market context
const body = [
  baseFragment,
  extensionFragment,
  profileSection,
  focusFragment,
  marketContext,  // ← NEW
]
  .filter((s) => s.length > 0)
  .join('\n\n');
```

The `loadMarketContext` method reuses the same DB query pattern as `buildMarketContextBlock` in `MarketingExecutionService` — loads both the category and location context rows from `directory_category_enrichment`.

---

## 5. Shared implementation

### 5.1 Market context loader

Both establishment and discovery need the same data. Extract a shared method:

```
apps/api/src/services/intelligence/MarketContextLoader.ts
```

```typescript
class MarketContextLoader {
  async loadCategoryIntelligence(category, city, state): Promise<{
    category_profile?: CategoryProfile;
    category_signals?: string[];
    market_density?: string;
    prospect_signals?: string[];
    secondary_categories?: string[];
  }>

  async loadLocationIntelligence(city, state): Promise<{
    city_profile?: CityProfile;
    market_gaps?: MarketGap[];
    metro_dynamics?: MetroDynamic[];
    notable_areas?: string[];
    market_notes?: string;
  }>

  async loadMarketContext(category, city, state): Promise<{
    category: CategoryIntelligence;
    location: LocationIntelligence;
  }>
}
```

This is the same query `buildMarketContextBlock` does, extracted into a reusable service. The business audit's `buildMarketContextBlock` can later be refactored to use this loader too.

### 5.2 Binding formatters

Each campaign type needs a different binding format. The loader returns raw data; the formatters produce the narrative-aware text:

```
MarketContextLoader → raw data
  ↓
EstablishmentBindingFormatter → establishment binding text
DiscoveryBindingFormatter → discovery binding text
AuditBindingFormatter → audit binding text (existing buildMarketContextBlock)
```

Each formatter:
1. **Announces** what the intelligence is and its lineage (Stage 1 + Stage 2)
2. **Presents** each field with its meaning
3. **Sets expectations** for how to use it
4. **Distinguishes** from existing inputs (intelligence profile, gold standard)

---

## 6. Graceful degradation

### 6.1 No enrichment run yet

If stages 1-2 haven't run, the context rows don't exist. The loader returns empty data. The formatter returns an empty string. The campaign proceeds with its existing inputs. No error, no warning to the analyst — the intelligence is additive.

### 6.2 Partial enrichment

If only stage 1 (location) ran but not stage 2 (category), the loader returns location intelligence but no category intelligence. The formatter includes only the available blocks. The binding notes the absence:

```
CATEGORY PROFILE: not available (category enrichment has not run for this
market yet). Proceed with general category knowledge.
```

### 6.3 National campaigns

For national campaigns (city = `__all__`), there is no city profile. The loader returns only category intelligence (from the national category row). The binding omits the city profile section.

---

## 7. Sentiment boundary

The intelligence campaigns receive intelligence only — not sentiments:

```
RECEIVED (intelligence):
  ✓ category_profile, category_signals, market_density, prospect_signals
  ✓ city_profile, market_gaps, metro_dynamics, notable_areas, market_notes

NOT RECEIVED (sentiments):
  ✗ body_copy (shopper-facing narrative)
  ✗ shopper_guide (shopper-facing guidance)
  ✗ faq (shopper-facing FAQ)
  ✗ area_breakdown (shopper-facing area cards)
  ✗ category_overview (shopper-facing category definition)
  ✗ metro_context (shopper-facing metro description)
  ✗ top_categories (shopper-facing hero chips)
  ✗ super/sub/adjacent_categories (shopper-facing hierarchy)
```

Same boundary as the seed audit. The campaigns consume intelligence to inform their work; they do not consume the domain's public sentiments.

---

## 8. Implementation phases

### Phase 1 — Shared market context loader
- `MarketContextLoader` service
- Extract the query pattern from `buildMarketContextBlock`
- Unit tests for loader (category-only, location-only, both, neither)

### Phase 2 — Establishment scan injection
- `EstablishmentBindingFormatter`
- Wire into `MarketingExecutionService.resolvePrompt` for establishment scans
- The binding is appended after the template body, before the suffix

### Phase 3 — Discovery injection
- `DiscoveryBindingFormatter` (with focus-specific framing)
- Wire into `PromptComposerService.composeIntelligencePrompt`
- The binding is appended as step 5 in the composition

### Phase 4 — Refactor audit to use shared loader
- Refactor `buildMarketContextBlock` to use `MarketContextLoader`
- The audit binding stays in `MarketingExecutionService` (it has audit-specific framing)
- Verify the audit prompt is unchanged after refactor

### Phase 5 — PG cockpit awareness
- The PG cockpit's 3-stage sentiment flow card (Stage 3: Seed audit) should acknowledge that stages 3-4 (establishment + discovery) also consume the intelligence
- Update the card to show 5 stages or add a note that intelligence campaigns also consume stages 1-2

---

## 9. Files to touch

```
NEW:
  apps/api/src/services/intelligence/MarketContextLoader.ts
  apps/api/src/services/intelligence/MarketContextBindingFormatters.ts

MODIFIED:
  apps/api/src/services/MarketingExecutionService.ts
    → establishment scan branch: append market context
    → (later) refactor buildMarketContextBlock to use MarketContextLoader

  apps/api/src/services/intelligence/PromptComposerService.ts
    → composeIntelligencePrompt: append market context as step 5

  apps/web/src/app/(platform)/settings/admin/marketing-ops/proving-grounds/[id]/ProvingGroundCockpitClient.tsx
    → (later) update sentiment flow card to show 5 stages
```

---

## 10. Open questions

1. **Establishment scan city scoping** — the establishment template has a `CITY (reference market)` field. Is the market context injection city-scoped (only inject when a city is specified) or always injected? Answer: city-scoped — national establishment scans don't have a city profile.

2. **Discovery profile block vs market context** — the discovery prompt already has a profile block (from the intelligence profile). The market context is a separate block. How do they coexist? Answer: they're complementary — the profile block describes how to discover businesses in the category; the market context describes what the market looks like. Both are useful, neither replaces the other.

3. **Gold standard vs category_signals** — the establishment scan derives the gold standard from candidates. The category_signals from enrichment are a lighter-weight checklist. How do they coexist? Answer: category_signals guide candidate evaluation during the scan; the gold standard is the OUTPUT of the scan. The signals are an input; the gold standard is a derivative.

4. **Cache strategy** — the market context is the same for all campaigns in the same (category, city) market. Cache the loader result? Answer: yes, cache per (category, city, state) with a 5-minute TTL, same as the enrichment public API.
