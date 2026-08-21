# Profile Repair Product Spec

**Status:** Draft · **Owner:** Product · **Date:** 2026-08-20
**Companion docs:** `PLATFORM_OFFERING_ARCHITECTURE.md` (base architecture — referenced throughout),
`PROFILE_REPAIR_INTEGRATION_SPEC.md` (infrastructure),
`PROFILE_REPAIR_RUNBOOK.md` (operational), `marketing_ops_playbook_catalog_triage_sprint_plan.md` (triage engine),
`gold_standard_sprint_plan.md` (Sprint 0 — gold standard system, the foundational prerequisite)

---

## 1. Purpose

The seek/identify layer is built — we can audit a business, detect signals,
triage to the right track, and produce operator + per-issue briefings with
opener hooks. What's missing is the **product the customer buys**: the
deliverable, the SOP, the tiers, the pricing, and the fulfillment workflow.

This spec defines the Profile Repair product for **Track A (standard)** —
the review-pipeline path covering NAP drift, unclaimed profiles, and platform
gaps. Track B (escalated) is a separate product (reinstatement appeals) and
is out of scope for this document.

### 1.1 Design principles

1. **Foot-in-the-door product.** Profile Repair is the entry engagement.
   Website work, storefront optimization, and ongoing retainer are upsells,
   not inclusions.
2. **Tiered by scope and service level.** The customer self-selects based on
   budget and technical comfort: DIY (instructions only) vs. Done-For-You
   (operator executes within a promised turnaround).
3. **The deliverable is actionable, not informational.** A Citation & Repair
   Package is not a report — it is a step-by-step fix sheet with claim links,
   corrected NAP, and a verification checklist. DIY customers follow it; DFY
   customers receive the completed work.
4. **Platform access, not passwords.** DFY uses delegated access (GBP manager
   invite, Facebook Page admin role) — never password sharing. The SOP
   reflects this.
5. **Seek and fulfill are two sides of the same coin.** The per-issue seek
   (briefing) and the per-issue fulfill (fix sheet) share the same campaign
   context. The seek identifies *what's broken and why it matters*; the
   fulfill turns that into *exactly what to fix and how*. The fulfill prompt
   consumes the seek's output — not just the raw audit data — so the fix
   sheet is grounded in the same findings the operator used to pitch the
   customer. The fulfill architecture replicates the seek architecture
   across four dimensions: **awareness** (city-aware profiles →
   platform-aware gold standards), **automatic** (resolve → inject in
   both), **execution** (AI + external import in both), and **briefing**
   (triage + repair briefing → consume seek briefing + produce deliverable
   summary). See §3.1a.
6. **Niche gold standard pattern matching.** For each business category, a
   "gold standard" — a business with clean NAP, claimed profiles, correct
   categories, and complete listings — serves as the target state. But the
   gold standard is both **data** (expected field values per
   platform/category) and **target/pattern** (a concrete business that
   proves the data is achievable). The fulfill prompt is both data-driven
   and pattern-driven: "Set primary_category to 'African goods store'
   (data); Baraka Market does this — adapt their description style
   (pattern)." Gold standards are **platform-tagged** — a business can be
   the gold standard for Google without being the standard for Yelp.
   **Pattern is to fulfill as profile is to seek. Data fields is to fulfill
   as signals are to seek.** Gold standards also **precede the audit** —
   the business is audited against the category gold standard on each
   platform, producing a richer, category-aware, platform-aware gap
   analysis instead of raw data collection. See §4 and
   `PLATFORM_OFFERING_ARCHITECTURE.md` §2.0.
7. **Universal non-negotiable quality gates.** Every repair, regardless of
   tier or platform, must pass universal quality gates: **presence** (the
   listing exists), **NAP accuracy** (name/address/phone/website match the
   canonical record), and **hours accuracy** (hours match canonical). These
   are non-negotiable on every platform. Platform-specific quality gates
   (e.g., Google primary_category must be set, Yelp categories must include
   the niche category) layer on top. See §4.2.2.
8. **Platform type distribution.** Every platform is tagged with a type:
   **directory**, **social_media**, or **reputation**. Each tier has a
   **minimum number of platforms per type** to ensure the package covers
   the full digital footprint — not just directories. A package that's
   all directories misses social presence; a package with no reputation
   platforms misses the review footprint. Website is not a platform type
   in the repair packaging — it's a separate surface with its own upsell
   path (§9). However, website **can** be a gold standard platform —
   the gold standard system is broader than the repair packaging and
   captures website patterns for niches where the website is critical to
   conversions (e.g., plumbing). See §2.2 and §4.2.5.
9. **Platform SOP module.** Every platform has a claim/edit/correction
   procedure, even if hidden or poorly documented. The SOP module
   captures the researched step-by-step procedure for each platform —
   the **how**. The gold standard provides the **what** (target values).
   The fulfill prompt combines both: "Set primary_category to 'African
   goods store' [gold standard] by following these steps: GBP dashboard
   → Info → pencil icon [SOP]." SOPs are platform-specific and
   category-agnostic. See §7.5.

---

## 2. Product Definition

### 2.1 What the customer buys

A **Citation & Profile Repair Package** — the correction of the business's
Name, Address, and Phone (NAP) across directory platforms, plus the claiming
of unclaimed profiles. The product has two delivery modes and three scope
tiers:

| | Standard | Plus | Premium |
|---|---|---|---|
| **Platforms** | Top 4 (Google, Yelp, Facebook, BBB) | Top 4 + any 3 | Full citation sweep |
| **Type min** | 2 directory, 1 social, 1 reputation | 3 directory, 1 social, 1 reputation | 4+ directory, 1 social, 1 reputation |
| **DIY** | $149 — instructions PDF | $249 — instructions PDF | — |
| **Done-For-You** | $299 — 48h turnaround | $399 — 48h turnaround | $599 — 24h turnaround |
| **Retainer upsell** | $199/mo | $199/mo | $199/mo |

Website is not a platform in Profile Repair — it's a separate surface
with its own upsell path (§9). The type minimums cover directory,
social_media, and reputation only.

### 2.2 Platform types and tiers

#### 2.2.1 Platform types

Every platform in scope is tagged with one or more **platform types**.
The type tag determines what kind of repair work applies and ensures the
package covers the full digital footprint, not just directories.

| Type | Description | What repair means here |
|------|-------------|------------------------|
| **directory** | Listing platforms where the business is found by searchers | Claim listing, correct NAP, set categories, add attributes, add photos, write description |
| **social_media** | Social platforms where the business has a page or profile | Claim page, correct page type/categories, ensure NAP consistency, add profile completeness |
| **reputation** | Platforms where reviews and ratings live | Listing presence/accuracy is in scope (claim, correct NAP, set categories). Review response management is a separate upsell. |

**Website is not a platform type in the repair packaging.** The
business's website is a separate surface entirely — outside the scope of
the repair tiers. Website work (fixing placeholder copy, correcting NAP
on the site, basic on-site SEO) is an **upsell option**, same as platform
storefront creation and directory entry creation. See §9.

**However, website can still be a gold standard platform.** The gold
standard system is broader than the repair packaging — it captures what
"good" looks like for a niche across all surfaces, including surfaces
that aren't in the repair package. A plumbing niche that depends heavily
on website CTA for conversions benefits from a website gold standard:
what a good plumbing website's hero copy says, what CTAs it uses, what
service pages it has, how the phone number is presented. The gold
standard scan can evaluate websites and set `expected_fields` for
website quality, even though fixing the website is an upsell. When the
operator pitches the website copy fix upsell, they reference the gold
standard pattern: "here's what a well-optimized plumbing website looks
like — your site should match this pattern." See §4.2.5.

**Platform-to-type mapping:**

| Platform | Primary type | Secondary type(s) | In repair packaging? | In gold standard scope? |
|----------|-------------|-------------------|----------------------|------------------------|
| Google Business Profile | directory | reputation | Yes (top 4) | Yes |
| Yelp | directory | reputation | Yes (top 4) | Yes |
| Facebook | social_media | directory | Yes (top 4) | Yes |
| BBB | directory | reputation | Yes (top 4) | Yes |
| Apple Maps (Apple Business Connect) | directory | — | Yes (additional) | Yes |
| Bing Places | directory | — | Yes (additional) | Yes |
| MapQuest | directory | — | Yes (additional) | Yes |
| Waze | directory | — | Yes (additional) | Yes |
| Loc8NearMe | directory | — | Yes (additional) | Yes |
| DataAxle | directory | — | Yes (additional, API push) | Yes |
| Foursquare | directory | — | Yes (additional, API push) | Yes |
| Instagram | social_media | — | Optional (additional) | Yes |
| TikTok | social_media | — | Optional (additional) | Yes |
| X (Twitter) | social_media | — | Optional (additional) | Yes |
| LinkedIn | social_media | directory | Optional (additional) | Yes |
| Trustpilot | reputation | directory | Optional (additional) | Yes |
| Vertical directories (SNAP, HomeAdvisor, etc.) | directory | — | Premium sweep, niche-specific | Yes |
| Business website | website | — | No (upsell, §9) | **Yes** — gold standard captures website patterns for niches where the website is critical to conversions |

A platform can have multiple types — Google Business Profile is both a
directory (listing found in search) and a reputation platform (reviews).
For type distribution purposes, each platform counts toward its primary
type. The secondary type is noted but doesn't double-count.

#### 2.2.2 Type distribution per tier

Each tier has a **minimum number of platforms per type** to ensure the
package is comprehensive. The minimums guarantee the customer's digital
footprint is covered across all three in-scope types, not just
directories.

| Tier | directory min | social_media min | reputation min | Total platforms |
|------|---------------|------------------|----------------|-----------------|
| **Standard** | 2 | 1 | 1 (via directory+reputation overlap) | 4 (top 4) |
| **Plus** | 3 | 1 | 1 (via overlap) | 7 (top 4 + 3) |
| **Premium** | 4+ | 1 | 1 (via overlap) | full sweep |

**How the current top 4 satisfies the Standard minimums:**
- Google Business Profile → directory (counts toward directory min: 2)
- Yelp → directory (counts toward directory min: 2 ✓)
- Facebook → social_media (counts toward social_media min: 1 ✓)
- BBB → directory (directory count: 3, exceeds min)
- Reputation coverage: Google and Yelp are both directory+reputation, so
  reputation presence is covered via overlap (reviews exist on these
  platforms). BBB also has reputation overlap.

**How Plus satisfies the minimums (top 4 + 3 picks):**
- The 3 additional picks must include at least 1 more directory (to hit
  directory min: 3). Apple Maps, Bing Places, MapQuest, Waze, Loc8NearMe,
  DataAxle, Foursquare all qualify.
- Social media min is already met by Facebook (top 4). If the customer
  wants more social media, they can pick Instagram/TikTok/LinkedIn as
  their additional picks.
- Reputation min is met via overlap (Google + Yelp reviews).
- The operator guides the customer's 3 picks to ensure type distribution
  is balanced — not 3 more directories if social media is thin.

**How Premium satisfies the minimums (full sweep):**
- All directories in scope (4+ minimum easily met — GBP, Yelp, BBB,
  Apple Maps, Bing, MapQuest, Waze, Loc8NearMe, DataAxle, Foursquare,
  vertical directories)
- Social media: Facebook (top 4) + any additional social platforms
  relevant to the niche
- Reputation: covered via overlap + any dedicated reputation platforms

**Why type minimums matter:**

A package that's all directories (e.g., Google + Yelp + BBB + Apple Maps)
misses social media entirely. A package that's all social media misses
the directory footprint. The type minimums ensure:
- The customer's **discoverability** is covered (directories — where
  people search)
- The customer's **social presence** is covered (social media — where
  people engage)
- The customer's **review footprint** is covered (reputation — where
  trust is built)

Website is not part of this distribution — it's a separate surface with
its own upsell path (§9).

The operator uses the type distribution to guide tier selection and
platform picks. If a business has zero social media presence, the
operator recommends Plus (to add a social platform) rather than Standard
(which only includes Facebook). If a business's reputation is the main
issue, the operator notes that the core package covers listing
presence/accuracy on reputation platforms but review response management
is a separate upsell.

#### 2.2.3 Platform list

**Top 4 (Standard scope):**
1. Google Business Profile (directory + reputation)
2. Yelp (directory + reputation)
3. Facebook (social_media + directory)
4. BBB (directory + reputation)

**Additional platforms (Plus picks 3, Premium includes all):**
5. Apple Maps (Apple Business Connect) — directory
6. Bing Places — directory
7. MapQuest — directory
8. Waze — directory
9. Loc8NearMe (or relevant vertical directory per niche) — directory
10. Data aggregators (DataAxle, Foursquare — pushed via API) — directory
11. Instagram — social_media (optional)
12. TikTok — social_media (optional)
13. LinkedIn — social_media + directory (optional)

**Premium sweep** adds niche/vertical directories relevant to the business
category (e.g., SNAP retailer directory for grocery, HomeAdvisor for
contractors, etc.). The per-issue seek briefing's `affected_platforms` field
informs which verticals matter for this specific business. The sweep also
flags website issues (placeholder, broken, missing NAP) in the Completion
Report even though website repair is an upsell.

### 2.3 DIY vs. Done-For-You

**DIY (instructions only):**
- Customer receives the Citation & Repair Package PDF
- Contains: canonical NAP record, per-platform fix sheet (claim link, edit
  URL, step-by-step instructions, verification method), submission guide
  (order of operations, expected timelines, common pitfalls)
- Customer executes the fixes themselves
- Optional: customer sends screenshots for verification (free, best-effort)

**Done-For-You (operator executes):**
- Customer receives the same Citation & Repair Package PDF (transparency)
- Operator collects delegated platform access via intake form
- Operator executes fixes in priority order within the promised turnaround
- Operator delivers a **Completion Report** with before/after screenshots
  and per-platform verification status
- Customer does nothing but provide access and review the results

### 2.4 What's NOT included (upsell boundaries)

- Website redesign or content fixes (separate product — pitched from the
  website issues identified in the audit)
- Storefront/directory photo optimization (upsell — "Visual & Asset Refresh"
  PB-06, $149)
- Review response management (separate product — PB-02)
- Ongoing NAP monitoring (retainer — $199/mo, §8)
- New directory submissions beyond the tier scope (quoted separately)

---

## 3. Seek → Fulfill Coupling — Two Sides of the Same Coin

The per-issue seek and the per-issue fulfill are not independent prompts that
happen to run on the same campaign. They are a tightly coupled pair: the seek
produces the *diagnosis*, the fulfill produces the *treatment*, and the
treatment is grounded in the diagnosis — not just the raw audit data.

### 3.1 The coupling

```
Gold Standard (active, category-specific)
    │  provides: expected_fields + quality_gates per platform
    ▼
Business Digital Audit (Cohesive)
    │  input:   gold_standard expected_fields (as benchmark)
    │  produces: audit_data + detected_signals + gap_analysis
    │            (category-aware, platform-aware — compares business
    │             against gold standard, not just raw data collection)
    ▼
Per-issue seek (e.g., NAP Drift Audit)
    │  input:   audit_results + audit_signals + issue_type
    │             ↑ signal-driven + profile-driven + gap-aware
    │  output:  profile_repair_audit {
    │    scope: { summary, affected_platforms, specifics }
    │    impact: { primary_consequence, estimated_reach_loss, competitive_gap }
    │    pitch: { opener_hook, pain_points, value_preview }
    │    risks: [...]
    │  }
    │  persisted: execution row (raw_output = the briefing JSON)
    ▼
Per-issue fulfill (Citation & Repair Package)
    │  input:   audit_results + seek_briefing + gold_standard + issue_type
    │             ↑ data-driven + pattern-driven
    │             gold_standard contains BOTH:
    │               expected_fields (data — what correct looks like)
    │               pattern (concrete exemplar — what correct looks like in practice)
    │  output:  citation_repair_package {
    │    deliverableText: per-platform fix sheet
    │    submissionGuide: execution playbook
    │  }
```

**Gold standards precede the audit.** The gold standard's
`expected_fields` serve as a benchmark during the audit itself — the
business is audited against the category target state on each platform,
producing a richer, category-aware, platform-aware audit report. Instead
of the audit just saying "primary_category not set," it says
"primary_category is 'Grocery store' but the category gold standard for
African grocery stores sets it to 'African goods store' — this reduces
discoverability for diaspora customers." The audit becomes a gap
analysis against the target state, not just raw data collection. See
`PLATFORM_OFFERING_ARCHITECTURE.md` §2.0.

**Prerequisite:** the gold standard must be active before the audit
runs. If no gold standard exists for the category, the audit runs
without it (degraded but functional — same fallback pattern as fulfill).
Gold standard scans should be run and activated for priority categories
*before* auditing businesses in those categories.

The structural parallel:

| Seek | Fulfill |
|------|---------|
| **Signals** (from audit — what's broken) | **Data fields** (from gold standard scan — what correct looks like) |
| **Intelligence profile** (category context — terminology, synonyms, sources) | **Gold standard pattern** (category target state — concrete exemplar) |
| **Gold standard benchmark** (category-aware gap analysis during audit) | **Gold standard target** (category-aware fix sheet during fulfill) |

The seek is **signal-driven** (audit signals tell it what's wrong),
**profile-driven** (the intelligence profile gives it category context),
and **benchmark-driven** (the gold standard's expected_fields make the
audit a gap analysis, not just data collection). The fulfill is
**data-driven** (expected field values tell it what correct looks like)
and **pattern-driven** (the gold standard business shows it what correct
looks like in practice).

### 3.1a The architectural parallel

The fulfill architecture replicates the seek architecture across five
dimensions — awareness, automatic, curation, execution, and briefing.
This is not coincidence: it's the same design pattern applied to the
opposite side of the coin. Seek identifies problems; fulfill produces
solutions. Both use the same structural primitives, stored in the same
`mkt_intelligence_profiles` table with the same draft → active → retired
lifecycle and the same dual execution paths (AI agent or external
import with Zod schema validation).

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §2 for the full parallel** —
> the awareness/automatic/curation/execution/briefing dimension tables,
> the summary diagram, and the dual execution pattern.

**Profile Repair-specific: the three inputs the fulfill prompt receives.**

The fulfill prompt receives **three inputs**, not one:

1. **`audit_results`** (existing) — the raw NAP, platform status, website
   data from the business_analysis audit. This is the *what is*.
2. **`seek_briefing`** (NEW) — the per-issue seek's output
   (`profile_repair_audit`), specifically:
   - `scope.affected_platforms` — which platforms need fixing (the fulfill
     doesn't waste time on platforms the seek already cleared)
   - `scope.specifics` — the exact drift fields, missing assets, or gaps
     the seek identified (the fulfill's fix sheet addresses these
     specifically, not generically)
   - `issueType` — the confirmed issue type (NAP drift vs. unclaimed vs.
     platform gap produces materially different fix sheets)
3. **`gold_standard`** (NEW, §4) — the niche-specific target state, with
   **two layers**:
   - `expected_fields` (data) — the target field values per platform for
     this category (e.g., Google primary_category = "African goods store",
     required_attributes include "SNAP accepted", min 10 photos). This is
     the *what correct should be*.
   - `pattern` (target) — a concrete business that matches or exceeds the
     expected fields, with its full platform configuration. This is the
     *what correct looks like in practice*.

### 3.2 Why the coupling matters

Without the seek briefing, the fulfill prompt only has raw audit data. It
can see that "Google shows a different address than the website" but it
doesn't know:
- Which platforms the seek *already checked and cleared* (avoid redundant
  fix instructions for platforms that are fine)
- The *specific* drift the operator pitched to the customer (the fix sheet
  should address exactly what the customer was sold, not a generic NAP
  audit)
- The *value_preview* the customer was promised (the fix sheet should
  deliver on that promise — if the seek promised "we'll push your correct
  NAP to Google, Yelp, Facebook, BBB, MapQuest, Waze, Loc8NearMe, and the
  SNAP directory," the fix sheet covers exactly those platforms)

The coupling also means **seek quality determines fulfill quality.** If the
seek produces a vague briefing ("NAP is inconsistent across directories"),
the fulfill produces a generic fix sheet. If the seek produces a precise
briefing ("Google shows 2408 NW Vivion Rd, Northmoor, MO 64151; Loc8NearMe
shows 2516 NW Vivion Rd, Riverside, MO 64150; name varies between 'Afro
Ethiopian Market' and 'Afro Ethiopia market'"), the fulfill produces a
precise fix sheet with per-platform corrections.

### 3.3 Implementation: `buildFulfillVariables` extension

Currently `buildFulfillVariables` in `ProfileRepairPromptService.ts` passes
only `audit_results`:

```ts
buildFulfillVariables(campaign, latestAudit) {
  return {
    audit_results: this.serializeAuditResults(latestAudit?.audit_data ?? {}),
  };
}
```

Extended to pass the seek briefing + gold standard:

```ts
buildFulfillVariables(campaign, latestAudit) {
  // 1. Raw audit data (existing)
  const auditResults = this.serializeAuditResults(latestAudit?.audit_data ?? {});

  // 2. Seek briefing — find the latest profile_repair_audit execution
  //    for this campaign and serialize its scope + issueType
  const seekBriefing = this.serializeSeekBriefing(campaign);

  // 3. Gold standard — resolve the niche pattern for this business category
  const goldStandard = this.serializeGoldStandard(campaign);

  return {
    audit_results: auditResults,
    seek_briefing: seekBriefing,
    gold_standard: goldStandard,
    issue_type: campaign?.repair_issue_type || '',
  };
}
```

`serializeSeekBriefing` loads the latest `profile_repair_audit` execution
(same query `RepairBriefingCard` uses on the frontend) and extracts the
scope/impact/value_preview into a text block the fulfill prompt can consume.

---

## 4. Gold Standard Pattern Matching

### 4.1 The concept — gold standards are both data and targets

For each business category, a gold standard is **two things at once**:

1. **Data** — the expected field values per platform/category. These are
   the target data fields the fulfill prompt drives toward.
2. **Target/pattern** — a concrete business that proves the data fields
   are achievable and shows what they look like in practice.

This mirrors the seek side: signals (what's broken) ↔ data fields (what
correct looks like); intelligence profile (category context) ↔ gold
standard pattern (concrete exemplar). **Pattern is to fulfill as profile
is to seek. Data fields is to fulfill as signals are to seek.**

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §5.1 for the full concept** —
> the seek/fulfill mirror table and the data-fields-vs-pattern
> explanation.

**Profile Repair-specific example.** For an African grocery store on
Google, the expected data is: `primary_category = "African goods store"`,
`additional_categories = ["Grocery store"]`, attributes should include
`"SNAP accepted"`, `photo_count` >= 10, etc. **Baraka Market** (Kansas
City, MO) is the pattern — a concrete business that proves these field
values are achievable, with 24 photos, a correct primary category, and
SNAP attributes on Google. The data fields are what the operator checks
against; the pattern is what the AI model learns from. Both come from
the same scan.

### 4.2 Storage: extend the intelligence profile system

Gold standards are stored in the existing `mkt_intelligence_profiles`
table, using `reference_city = NULL` (city-agnostic, nationwide). The
`configuration_json` is extended with two new blocks:

1. **`expected_fields`** — the data layer, split into:
   - **`universal`** — NAP, hours, and universal quality gates that apply
     to every platform
   - **`platforms`** — per-platform target field values (categories,
     attributes, page_type, photo_count, description) and platform-specific
     quality gates, keyed by platform name
2. **`gold_standards`** — the pattern layer: per platform, up to 4 concrete
   businesses that match or exceed the expected fields, with quality scores,
   platform config, NAP, and **destination URLs** (the live profile URL on
   each platform — required field, shown wherever the candidate appears)

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §5.2 for the full data
> structure** — the `expected_fields` and `gold_standards` JSON schema,
> the two-layer model explanation, the per-platform candidate caps, and
> the platform-tagged (not business-level) selection rationale.

**Profile Repair-specific: universal quality gates.**

These apply to ALL platforms, ALL repair work, regardless of tier or
issue type. They are the floor every listing must meet:

| Gate | Description | Non-negotiable |
|------|-------------|---------------|
| `presence` | The listing must exist on the platform | Yes |
| `nap_accuracy` | NAP (name, address, phone, website) must match canonical exactly | Yes |
| `hours_accuracy` | Hours must match the canonical hours | Yes |

**Profile Repair-specific: platform quality gates (examples).**

These layer on top of the universal gates per platform:

| Platform | Gate | Description | Non-negotiable |
|----------|------|-------------|---------------|
| Google | `primary_category_set` | GBP primary category must match expected value | Yes |
| Google | `claimed` | GBP must be claimed by owner | Yes |
| Google | `min_photos` | At least N photos present | No (recommended) |
| Yelp | `categories_set` | Yelp categories must include niche category | Yes |
| Yelp | `claimed` | Yelp page should be claimed | Yes |
| Facebook | `page_type_correct` | Page type must be correct (e.g., "Grocery Store") | Yes |
| Facebook | `claimed` | Page must be managed by owner | Yes |
| BBB | `category_correct` | BBB category should map correctly | No (recommended) |
| Apple Maps | `claimed` | Apple Business Connect listing should be claimed | Yes |
| SNAP directory | `listed` | Business should be listed if it accepts SNAP | Yes |

Gate severity is derived from scan evidence: non-negotiable if ALL gold
standard candidates pass the gate; recommended if only some pass.

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §5.3 for the full platform
> key table** (google, yelp, facebook, bbb, apple_maps, bing, mapquest,
> waze, instagram, tiktok, linkedin, trustpilot, vertical_directories,
> website) with primary and secondary type tags.

**Website gold standards (§4.2.5).** Website can be a gold standard
platform even though it's not in the repair packaging — it's an upsell
surface (§9). Website gold standards are not injected into the repair
fulfill prompt; they're used for upsell pitch and audit flagging. The
operator runs the website scan only for niches where the website is the
primary conversion surface.

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §5.5 for the full website
> gold standard spec** — hero copy, CTA, service page structure, NAP
> presentation, trust signals, mobile optimization, and when to scan.

### 4.3 Gold standard discovery — the gold standard scan

Gold standards and their expected field values are discovered via a **gold
standard scan** — a new prompt type that behaves like a category scan but
searches **nationwide** (not city-coupled) for well-optimized businesses in
a category. A gold standard in Hawaii can serve a campaign in New Jersey —
the gold standard is a *pattern*, not a local competitor.

The scan produces **both layers** in a single pass:
1. **Expected fields** — split into:
   - **Universal** (NAP, hours) — derived from the canonical record shared
     across all platforms. Every gold standard candidate should have
     consistent NAP and hours; the scan confirms the canonical values.
   - **Platform-specific** (categories, attributes, page_type, etc.) — by
     aggregating the field values across all gold standard candidates per
     platform, the scan derives the expected field schema for that
     platform/category combination (e.g., "all 3 Google gold standards use
     'African goods store' as primary_category → that's the expected
     value").
   - **Quality gates** — derived by checking which gates ALL gold standard
     candidates pass (non-negotiable) vs. which most pass (recommended).
2. **Gold standard businesses** — the concrete businesses that match or
   exceed the expected fields, with their full platform configuration as
   the pattern.

#### 4.3.1 Why nationwide, not city-coupled

The gold standard represents the *target state* for a category — what a
well-optimized [African grocery store] / [plumbing contractor] / [nail
salon] looks like across directory platforms. The target state is
category-dependent, not geography-dependent:
- An African grocery store in Honolulu with clean GBP, correct categories,
  and complete listings is a valid gold standard for an African grocery
  store in Kansas City — the *categories, attributes, hours patterns, and
  vertical directories* are what matter, not the local market.
- City-coupling would artificially limit the candidate pool — a small niche
  in a small city may have zero well-optimized businesses, but the same
  niche in a larger market will have several.

The intelligence profile system already supports city-agnostic profiles
(`reference_city = NULL`) — the gold standard scan produces city-agnostic
profiles that resolve for any campaign in that category regardless of
location.

#### 4.3.2 The scan prompt

A new prompt template (`mpt-gold-standard-scan`) with output schema
`gold_standard_scan`:

```
Input variables:
  - category: the business category to scan (e.g., "African Grocery Store")
  - max_results_per_platform: 4 (the cap per platform per niche)

Output schema (gold_standard_scan):
{
  "category_key": "<normalized category>",
  "category_name": "<display name>",
  "expected_fields": {
    "universal": {
      "nap": {
        "business_name": "<canonical name>",
        "address": "<canonical address>",
        "phone": "<canonical phone>",
        "website": "<canonical website or null>"
      },
      "hours": "<canonical hours pattern>",
      "quality_gates": {
        "presence": {
          "description": "The listing must exist on the platform",
          "required": true,
          "non_negotiable": true
        },
        "nap_accuracy": {
          "description": "NAP must match canonical exactly",
          "required": true,
          "non_negotiable": true,
          "fields": ["business_name", "address", "phone", "website"]
        },
        "hours_accuracy": {
          "description": "Hours must match canonical",
          "required": true,
          "non_negotiable": true
        }
      }
    },
    "platforms": {
      "google": {
        "primary_category": "<string>",
        "additional_categories": ["<string>", ...],
        "required_attributes": ["<string>", ...],
        "recommended_attributes": ["<string>", ...],
        "min_photo_count": <number>,
        "description_requirements": ["<string>", ...],
        "quality_gates": {
          "primary_category_set": {
            "description": "<string>",
            "required": true,
            "non_negotiable": true,
            "expected_value": "<string>"
          },
          "claimed": {
            "description": "<string>",
            "required": true,
            "non_negotiable": true
          },
          "min_photos": {
            "description": "<string>",
            "required": false,
            "non_negotiable": false,
            "threshold": <number>
          }
        },
        "category_specific_notes": "<string>"
      },
      "yelp": {
        "categories": ["<string>", ...],
        "recommended_attributes": ["<string>", ...],
        "quality_gates": {
          "categories_set": { "description": "<string>", "required": true, "non_negotiable": true, "must_include": "<string>" },
          "claimed": { "description": "<string>", "required": true, "non_negotiable": true }
        },
        "category_specific_notes": "<string>"
      },
      "facebook": {
        "page_type": "<string>",
        "categories": ["<string>", ...],
        "quality_gates": {
          "page_type_correct": { "description": "<string>", "required": true, "non_negotiable": true, "expected_value": "<string>" },
          "claimed": { "description": "<string>", "required": true, "non_negotiable": true }
        },
        "category_specific_notes": "<string>"
      },
      "bbb": {
        "category": "<string|null>",
        "quality_gates": {
          "category_correct": { "description": "<string>", "required": false, "non_negotiable": false }
        },
        "category_specific_notes": "<string>"
      },
      "apple_maps": { ... },
      "bing": { ... },
    "vertical_directories": {
      "<directory_name>": {
        "expected_listed": true|false,
        "expected_category": "<string|null>",
        "category_specific_notes": "<string>"
      }
    }
  },
  "candidates": [
    {
      "business_name": "<string>",
      "city": "<string>",
      "state": "<string>",
      "nap": {
        "business_name": "<string>",
        "address": "<string>",
        "phone": "<string>",
        "website": "<string|null>"
      },
      "platform_evaluations": {
        "google": {
          "profile_url": "<URL>",
          "primary_category": "<string>",
          "additional_categories": ["<string>", ...],
          "attributes": ["<string>", ...],
          "hours": "<string>",
          "photo_count": <number>,
          "description": "<string>",
          "rating": <number|null>,
          "review_count": <number|null>,
          "quality_score": <number 1-10>,
          "quality_rationale": "<why this business is or isn't a Google gold standard>",
          "is_gold_standard": true|false
        },
        "yelp": {
          "profile_url": "<URL|null>",
          "categories": ["<string>", ...],
          "attributes": ["<string>", ...],
          "quality_score": <number 1-10>,
          "quality_rationale": "<string>",
          "is_gold_standard": true|false
        },
        "facebook": {
          "page_url": "<URL|null>",
          "page_type": "<string>",
          "categories": ["<string>", ...],
          "quality_score": <number 1-10>,
          "quality_rationale": "<string>",
          "is_gold_standard": true|false
        },
        "bbb": {
          "profile_url": "<URL|null>",
          "accreditation_status": "accredited|not_accredited|unknown",
          "category": "<string|null>",
          "quality_score": <number 1-10>,
          "quality_rationale": "<string>",
          "is_gold_standard": true|false
        },
        "apple_maps": { ... , "is_gold_standard": true|false },
        "bing": { ... , "is_gold_standard": true|false },
        "vertical_directories": [
          {
            "platform": "<string>",
            "url": "<URL>",
            "listed": true,
            "quality_score": <number 1-10>,
            "is_gold_standard": true|false
          }
        ]
      },
      "category_specific_notes": "<string>"
    }
  ],
  "scan_metadata": {
    "scan_date": "<date>",
    "sources_consulted": ["<string>", ...],
    "selection_criteria": "<what made these candidates stand out>",
    "platforms_evaluated": ["google", "yelp", "facebook", "bbb", ...],
    "expected_fields_derivation": "<how the expected_fields were derived from the candidates>"
  }
}
```

The prompt instructs the AI model to:
1. Search nationwide for businesses in the given category.
2. For each candidate, evaluate **every platform independently** — a
   business may have an excellent Google profile but a poor Yelp profile.
   Score each platform separately (1-10) and set `is_gold_standard` per
   platform (true if quality_score >= 7, false otherwise).
3. Return candidates that are gold standards on **at least one platform**.
   A business that's mediocre across all platforms is not a candidate.
4. **Capture the destination URL for every platform evaluation** — the
   live profile URL on each platform (e.g., the Google Maps listing URL,
   the Yelp business URL, the Facebook page URL). This is a **required
   field** — if the model cannot find the live profile URL for a
   platform, it must set `profile_url` to null and note in
   `quality_rationale` that the URL was not found. The destination URL
   is the verification anchor: it lets the operator confirm the scan's
   assessment by visiting the live profile, and it's shown wherever the
   candidate appears (admin cards, review view, fulfill output,
   deliverable). URL capture is an **intentional focus** of the scan,
   not an afterthought — the model must search for and record the exact
   URL, not just the business name.
5. **Derive universal `expected_fields`** — confirm the canonical NAP and
   hours that are consistent across all gold standard candidates. These
   translate across all platforms. Also derive the **universal quality
   gates**: presence (listing exists), nap_accuracy (NAP matches
   canonical), hours_accuracy (hours match canonical). These are
   non-negotiable for ALL platforms.
6. **Derive platform-specific `expected_fields`** — for each platform,
   aggregate the field values across all candidates tagged
   `is_gold_standard` on that platform and derive the expected schema:
   - `primary_category`: the most common value across gold standards
   - `additional_categories`: the union of categories, deduplicated
   - `required_attributes`: attributes present on *all* gold standards
   - `recommended_attributes`: attributes present on *most* gold standards
   - `min_photo_count`: the minimum photo_count across gold standards
   - `description_requirements`: the common themes/patterns across
     descriptions (e.g., "mentions cuisine/diaspora served")
   - `category_specific_notes`: the AI model's synthesis of what makes
     this category's listings correct on this platform
7. **Derive platform-specific `quality_gates`** — for each platform, check
   which gates ALL gold standard candidates pass (→ non-negotiable) vs.
   which most pass (→ recommended). A gate that all Google gold standards
   pass (e.g., primary_category is set to "African goods store") becomes
   non-negotiable for Google. A gate that only some pass (e.g., BBB
   accreditation) becomes recommended, not non-negotiable.
8. Capture the *category-specific patterns* per platform — which GBP
   categories they use, which Yelp categories they set, which Facebook
   page type they chose, which vertical directories they appear on, what
   their description says. This is the data that makes the gold standard
   useful as a pattern, not just a benchmark.

The scan may return more than 4 candidates total, because different
businesses may be standards on different platforms. The post-import hook
(§4.3.3) distributes them into the per-platform arrays, keeping only the
top 4 per platform (by quality_score).

#### 4.3.3 Post-import: populating the intelligence profile

When a gold standard scan result is imported via
`/api/admin/marketing-ops/prompts/executions/external`, the post-import
hook (mirroring the `intelligence_profile` hook in
`MarketingPromptService.importExternalResult`):

1. Detects `output_schema.name === 'gold_standard_scan'`
2. **Stores the `expected_fields` block as-is** — the scan's derived
   expected field values per platform are stored directly into
   `configuration_json.expected_fields`. These are the data-layer targets
   the fulfill prompt uses to drive fix instructions.
3. **Distributes candidates into per-platform arrays** — iterates the scan
   output's `candidates[]`, and for each candidate, iterates
   `platform_evaluations`. For each platform where `is_gold_standard` is
   true, the candidate (with its platform-specific config) is added to the
   `gold_standards[platform][]` array. A business that's a standard on
   Google only goes into `gold_standards.google[]`, not into
   `gold_standards.yelp[]`.
4. **Caps at 4 per platform** — if a platform already has 4 standards
   (from a prior scan version), the new candidate replaces the lowest
   quality_score if it scores higher.
5. Calls `IntelligenceProfileService.importAsDraft()` with:
   - `categoryKey`: from the scan output's `category_key`
   - `categoryName`: from the scan output's `category_name`
   - `referenceCity`: **null** (city-agnostic — nationwide gold standard)
   - `intelligenceFocus`: not applicable (gold standards are focus-agnostic)
   - `configurationJson`: both `expected_fields` and `gold_standards`
     blocks merged into the existing `configuration_json` structure
6. The profile is created as **draft** — operator reviews the expected
   fields and per-platform candidates and activates the profile when
   satisfied.

If an intelligence profile already exists for the category (e.g., from a
prior intelligence discovery scan), both blocks are **merged** into the
existing profile's `configuration_json` as a new version — they don't
replace the terminology/synonyms/specialized_sources that are already
there. The `importAsDraft` version-bump logic already handles this.

#### 4.3.4 Per-platform selection at fulfill time

Both layers are stored per-platform. At fulfill time, the
`serializeGoldStandard` helper resolves **universal fields, per-platform
expected fields, quality gates, and a gold standard pattern per platform**
in the campaign's tier scope:

1. Resolves the intelligence profile for the campaign's category
   (city-agnostic match — `referenceCity = null` preferred)
2. Reads `expected_fields.universal` — the canonical NAP, hours, and
   universal quality gates (presence, nap_accuracy, hours_accuracy).
   These apply to every platform.
3. Reads `expected_fields.platforms` — the platform-specific target field
   values and platform-specific quality gates
4. Reads `gold_standards` (the pattern layer) from `configuration_json`
5. For each platform in the campaign's tier scope (Standard = top 4,
   Plus = top 4 + 3, Premium = full sweep):
   - Applies the **universal quality gates** (presence, nap_accuracy,
     hours_accuracy) — these are checked on every platform
   - Reads `expected_fields.platforms[platform]` — the platform-specific
     data target and quality gates
   - Reads `gold_standards[platform][]` — the pattern exemplars
   - Picks the highest `quality_score` entry as the pattern for that
     platform's fix sheet section
   - If the pattern array is empty for that platform, the fix sheet
     section uses the expected fields alone (data-driven without a
     concrete pattern)
   - If expected fields are also empty, the fix sheet section runs with
     generic instructions (no data, no pattern) — but the universal
     quality gates still apply
6. Serializes all layers into the fulfill prompt's `gold_standard`
   variable: universal fields + per-platform expected_fields + quality
   gates + pattern

This means the Google fix sheet section uses:
- **Universal gates**: "listing exists, NAP matches canonical, hours
  match canonical" — checked on Google just like every other platform
- **Google expected fields**: "set primary_category to 'African goods
  store', set required_attributes to include 'SNAP accepted', min 10
  photos" — the platform-specific **data**
- **Google quality gates**: "primary_category must be set, GBP must be
  claimed" — the platform-specific **non-negotiable gates**
- **Google gold standard pattern**: Baraka Market's actual description,
  categories, attributes — the **pattern** the AI model adapts from

A business that's excellent on Google but poor on Yelp only influences the
Google section — it doesn't contaminate the Yelp section with the wrong
pattern. The universal gates provide a floor on every platform, and the
platform-specific expected fields + quality gates provide a data-driven
target even when no pattern exemplar exists for a platform.

#### 4.3.5 The flywheel

The gold standard scan has two entry points:

1. **Operator-initiated scan** — operator runs the scan for a category
   that has active repair campaigns but no gold standard yet. This is the
   cold-start path.
2. **Post-repair promotion** — after a successful Track A repair, the
   operator can promote the repaired business as a gold standard candidate
   by running the scan with the repaired business as a known-good seed.
   The scan evaluates the business per-platform and tags which platforms
   it's now a standard on. A repaired business that got its Google and
   Yelp fixed but not its Facebook becomes the Google and Yelp gold
   standard, not the Facebook one. This is the flywheel — every
   successful repair makes the next repair in that niche smarter, and the
   platform tagging ensures the flywheel only promotes patterns that are
   actually good.

### 4.4 Resolution and serialization

`serializeGoldStandard(campaign, role)` is called during prompt
resolution for both the audit prompt (as benchmark) and the fulfill
prompt (as target). It resolves the active gold standard profile for
the campaign's category and serializes all layers (universal fields,
per-platform expected fields, quality gates, pattern exemplars, and
destination URLs) into a text block the prompt consumes.

The `role` parameter determines the **platform directive** prepended to
each platform block:
- `role='benchmark'` (audit) → "compare the business against this"
- `role='target'` (fulfill) → "fix the business toward this"

The directive tells the AI model what to do with the gold standard data
for each platform — the model doesn't have to infer the purpose. Same
data, same destination URLs, different instruction per injection context.

The destination URL for each pattern exemplar is included in the
serialized output so the AI model can reference it, browse it (if web
access is available), and ground its analysis in the concrete exemplar's
live profile.

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §5.4 for the full resolution
> and serialization logic** — the resolve → extract → per-platform
> serialization steps, the platform directive format, the serialized
> output with destination URLs, and the fallback chain.

**Profile Repair-specific: fallback chain.** If no pattern exists for a
platform, the fix sheet section uses expected fields + quality gates
alone (data-driven without a concrete exemplar). If expected fields are
also empty, the section falls back to generic instructions — but the
universal quality gates (presence, NAP accuracy, hours accuracy) always
apply. The product works without gold standards but gets better with
them; a missing standard on one platform doesn't degrade the fix sheet
for platforms that do have one.

### 4.5 The fulfill prompt's use of all layers

The fulfill prompt instructs the AI model to use **universal fields,
platform-specific expected fields, quality gates, and the gold standard
pattern** when generating each platform's fix sheet section. The prompt
checks universal gates first (presence, NAP, hours), then platform-
specific gates, then uses expected fields as the explicit target and the
pattern as the adaptation source.

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §5.4 for the resolution
> logic** that feeds these layers into the prompt.

**Per-platform isolation rule:** the prompt uses ONLY the expected
fields, quality gates, and pattern for the platform being fixed — do not
apply Google's categories to Yelp, or cross-contaminate platform
instructions.

---

## 5. Deliverable Structure — Citation & Repair Package

The `citation_repair_package` fulfill prompt
(`mpt-profile-repair-citation-package-fulfill`) generates the content. The
output schema is `{ deliverableText, submissionGuide }` — this spec defines
what those fields contain.

### 5.1 `deliverableText` — the fix sheet

Structured as a per-platform action document:

```
## Canonical NAP Record (Universal — applies to ALL platforms)
- Business Name: <canonical>
- Address: <canonical>
- Phone: <canonical>
- Website: <canonical>
- Category: <canonical>
- Hours: <canonical>

## Universal Quality Gates (Non-Negotiable — checked on EVERY platform)
- [ ] Presence: listing exists on the platform
- [ ] NAP Accuracy: name/address/phone/website match canonical exactly
- [ ] Hours Accuracy: hours match canonical

## Platform Fix Sheet

### 1. Google Business Profile
- Current state: <what's wrong from audit>
- Action: <claim | edit | create>
- URL: <claim link or edit URL>
- Universal gates to check:
  - [ ] Listing exists (presence)
  - [ ] NAP matches canonical (nap_accuracy)
  - [ ] Hours match canonical (hours_accuracy)
- Platform-specific gates to check:
  - [ ] Primary category set to "African goods store" (non-negotiable)
  - [ ] Profile claimed by owner (non-negotiable)
  - [ ] Min 10 photos (recommended)
- Target field values (from gold standard expected_fields):
  - Primary category: African goods store
  - Additional categories: Grocery store
  - Required attributes: SNAP accepted
  - Recommended attributes: Women-led, Small business
  - Min photos: 10
  - Description requirements: mentions cuisine/diaspora served
- Pattern reference: Baraka Market (Kansas City, MO) — adapt their
  description style and category selection for this business
  (exemplar URL: https://www.google.com/maps/place/Baraka+Market/...)
- Steps:
  1. <step>
  2. <step>
  ...
- Verification: <how to confirm the fix took>
- Expected time: <e.g., "instant" or "3-5 days for postcard">

### 2. Yelp
- Current state: <what's wrong from audit>
- Action: <claim | edit | create>
- Universal gates to check:
  - [ ] Listing exists (presence)
  - [ ] NAP matches canonical (nap_accuracy)
  - [ ] Hours match canonical (hours_accuracy)
- Platform-specific gates to check:
  - [ ] Categories include "African" (non-negotiable)
  - [ ] Business page claimed (non-negotiable)
- Target field values:
  - Categories: African, Grocery
  - Recommended attributes: Wheelchair Accessible, Accepts Credit Cards
- Pattern reference: Sahara Market (Honolulu, HI) — adapt their
  category selection and attribute set
  (exemplar URL: https://www.yelp.com/biz/sahara-market-honolulu)
- Steps: ...
- Verification: ...
- Expected time: ...

### 3. Facebook
... (same structure — universal gates + platform-specific gates +
target fields + pattern reference + steps)

### 4. BBB
... (same structure)

## Verification Checklist (all gates)
### Universal (every platform)
- [ ] Google — presence, NAP, hours
- [ ] Yelp — presence, NAP, hours
- [ ] Facebook — presence, NAP, hours
- [ ] BBB — presence, NAP, hours
### Platform-specific (non-negotiable)
- [ ] Google — primary category set, claimed
- [ ] Yelp — categories include niche, claimed
- [ ] Facebook — page type correct, claimed
### Platform-specific (recommended)
- [ ] Google — min 10 photos
- [ ] BBB — category correct
```

### 5.2 `submissionGuide` — the execution playbook

```
## Order of Operations
1. Claim Google Business Profile first (longest verification delay — postcard)
2. Correct NAP on Google (instant once claimed)
3. Claim + correct Yelp
4. Claim + correct Facebook
5. Submit BBB update
6. (Plus/Premium) Continue through additional platforms

## Common Pitfalls
- Google postcard verification takes 3-5 business days — start first
- Yelp suppresses listings with PO box addresses — use street address
- Facebook requires a business page (not a personal profile) to edit NAP
- BBB updates require accreditation or a formal request
- ...

## Expected Timeline
- DIY: 1-2 weeks (Google postcard is the bottleneck)
- DFY Standard: 48 hours for everything except Google postcard (5 days)
- DFY Premium: 24 hours for everything except Google postcard (5 days)
```

### 5.3 Completion Report (DFY only)

Delivered after execution. Not generated by the fulfill prompt — assembled
by the operator from execution tracking (§10.7):

```
## Completion Report — <Business Name>
Date: <date>
Tier: <Standard DFY / Plus DFY / Premium DFY>

### Per-Platform Results
| Platform | Action | Status | Verified | Notes |
|----------|--------|--------|----------|-------|
| Google | Claimed + NAP corrected | Complete | Yes — live | Postcard pending; NAP live |
| Yelp | NAP corrected | Complete | Yes — live | |
| Facebook | Claimed + NAP corrected | Complete | Yes — live | Manager access granted |
| BBB | Update submitted | Pending | — | 3-5 day review |

### Before/After
<screenshots or NAP diff per platform>

### Remaining Actions
- [ ] Google postcard verification (customer receives in 3-5 days, enters code)
- [ ] BBB review completion (automatic)
```

---

## 6. Pricing

### 6.1 FITD (one-time) pricing

| Tier | Platforms | Type min | DIY | DFY | Rationale |
|------|-----------|----------|-----|-----|-----------|
| Standard | Top 4 | 2 dir, 1 social, 1 rep | $149 | $299 | DIY matches PB-01 seed. DFY adds ~2h operator time. |
| Plus | Top 4 + 3 | 3 dir, 1 social, 1 rep | $249 | $399 | 3 more platforms = ~1h additional operator time. |
| Premium | Full sweep | 4+ dir, 1 social, 1 rep | — | $599 | Full sweep + 24h SLA. No DIY — too complex for self-service. |

### 6.2 Retainer pricing

| Retainer | Price | Includes |
|----------|-------|----------|
| Listing Synchronization & Search Defense | $199/mo | Monthly NAP drift scan, re-correction on top 4, new directory submission (1/mo), quarterly citation audit report |

The retainer is the same regardless of which FITD tier the customer bought —
it covers the top 4 platforms monthly. Premium-sweep customers can buy
expanded retainer coverage (all swept platforms) for $299/mo.

### 6.3 Alignment with playbook catalog

PB-01 currently seeds at $149 FITD / $199/mo retainer. This spec keeps that
as the Standard DIY entry price. The playbook catalog's `fitd_default_fee_cents`
and `retainer_fee_cents` are defaults — the operator can override per campaign
via `package_price_cents`. Tier selection happens at the pay page or during
the opener conversation, not at campaign creation.

### 6.4 Coupon / service category mapping

| Service category | Coupon valid for |
|------------------|------------------|
| `profile_repair_audit` | Preview/audit (free or discounted) |
| `profile_repair_package` | All FITD tiers (Standard/Plus/Premium, DIY/DFY) |
| `profile_repair_appeal` | Track B only (out of scope) |

The tier (Standard/Plus/Premium) and mode (DIY/DFY) are not separate service
categories — they are price points within `profile_repair_package`. The
operator sets `package_price_cents` to the tier price; coupon validation
checks the category, not the price.

---

## 7. SOP — Operator Execution

### 7.1 DIY fulfillment

```
1. Customer pays → campaign transitions to `delivered`
2. Operator runs the citation_repair_package fulfill prompt
   - Input: audit_results (serialized from business_analysis audit)
   - Output: { deliverableText, submissionGuide }
3. Operator generates the Citation & Repair Package PDF
   - Uses the citation_repair_package deliverable template
   - Watermarked if preview, clean if paid
4. Operator delivers PDF to customer (email + portal)
5. Campaign transitions to `retainer_pitched`
6. Operator pitches retainer (Listing Synchronization & Search Defense)
```

### 7.2 DFY fulfillment

```
1. Customer pays → campaign transitions to `delivered`
   - DFY mode recorded on campaign (new field: repair_fulfillment_mode)
2. Operator sends credentials/access intake form to customer
   - Collects: Google Business Profile manager invite, Facebook Page admin
     role, Yelp business owner claim, BBB login (if accredited)
   - Never collects passwords — only delegated access
3. Customer grants access (intake form submission)
4. Operator runs the citation_repair_package fulfill prompt (same as DIY)
   - Uses the fix sheet as the execution checklist
5. Operator executes fixes in priority order:
   a. Claim Google Business Profile (start postcard verification first)
   b. Correct NAP on Google
   c. Claim + correct Yelp
   d. Claim + correct Facebook
   e. Submit BBB update
   f. (Plus/Premium) Continue through additional platforms
6. Operator verifies each fix (live check or screenshot)
7. Operator assembles Completion Report (§5.3)
8. Operator delivers Completion Report + original fix sheet to customer
9. Campaign transitions to `retainer_pitched`
10. Operator pitches retainer
```

### 7.3 Turnaround SLA

| Tier | SLA | Clock starts |
|------|-----|--------------|
| Standard DFY | 48 hours | When customer grants access |
| Plus DFY | 48 hours | When customer grants access |
| Premium DFY | 24 hours | When customer grants access |

The SLA does not include Google postcard verification (3-5 business days,
mailed by Google — not controllable). All other platforms are fixed within
the SLA. The Completion Report notes the postcard as a pending item.

### 7.4 Access collection

DFY requires delegated platform access. The intake form collects:

| Platform | Access method | What the customer does |
|----------|---------------|------------------------|
| Google Business Profile | Manager invite | Adds operator email as Manager via GBP dashboard |
| Facebook | Page Admin role | Adds operator as Editor/Admin via Page settings |
| Yelp | Business Owner claim | Initiates claim, operator completes verification |
| BBB | Login sharing (if accredited) | Customer shares BBB login or submits update themselves |
| Apple Maps | Apple Business Connect | Customer adds operator as admin |
| Bing Places | Bing Places for Business | Customer shares login or adds operator |

**Security:** Access credentials are never stored in the platform. The intake
form collects *instructions* (e.g., "I've added manager@visibleshelf.store as
a Manager on my Google Business Profile") and the operator confirms access
manually. If a platform requires a shared login, it is exchanged via encrypted
channel and deleted after the engagement.

### 7.5 Platform SOP module

The **Platform SOP module** captures the researched step-by-step
claim/edit/correction procedure for each platform — the **how**. The
gold standard provides the **what** (target values). The fulfill prompt
combines both: "Set primary_category to 'African goods store' [gold
standard] by following these steps: GBP dashboard → Info → pencil icon
[SOP]."

SOPs are platform-specific and category-agnostic — the same Google SOP
applies to plumbing, African grocery, and nail salons. The category-
specific part comes from the gold standard, not the SOP.

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §6 for the full SOP module
> spec** — the field table (claim_process, edit_process, access_method,
> api_available, verification_method, expected_timeline, common_pitfalls,
> diy_instructions, dfy_instructions, etc.), storage proposal, research
> workflow, and re-verification cycle.

**Profile Repair-specific: fulfill integration.** The fulfill prompt's
`submissionGuide` (§5.2) is generated from the SOP module — for each
platform in the campaign's tier scope, the prompt reads the platform's
SOP and combines the procedure with the gold standard's target values.
The `diy_instructions` or `dfy_instructions` field (depending on
delivery mode) is the base procedure, with gold standard values injected
at the relevant steps.

**Coverage priority:** (1) Top 4 platforms — Google, Yelp, Facebook, BBB
(highest volume, SOPs first); (2) Common additional — Apple Maps, Bing
Places, MapQuest, Waze; (3) Data aggregators — DataAxle, Foursquare
(most hidden/complex); (4) Vertical directories — SNAP, HomeAdvisor,
etc. (niche-specific, researched per category). A platform without an
SOP can still be in scope — the fulfill prompt notes "SOP pending" and
instructions are marked incomplete.

---

## 8. Retainer — Listing Synchronization & Search Defense

The retainer is a **two-way contract for specific platforms** — the
platforms in the customer's tier scope at repair time:

1. **System-initiated (drift defense)** — the system scans for unplanned
   drift and alerts the operator to re-correct.
2. **Merchant-initiated (change requests)** — the merchant submits
   planned changes and the operator executes them on the contracted
   platforms.

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §7 for the full retainer
> model** — the drift scan automation, admin alert workflow, merchant
> change request flow, and the activity status report portal spec.

### 8.1 Contracted platforms

- **Standard retainer ($199/mo)** — top 4 platforms (Google, Yelp,
  Facebook, BBB)
- **Expanded retainer ($299/mo, Premium customers)** — all platforms in
  the original sweep

The contracted platform list is stored on the retainer subscription
record at activation time. If the customer later upgrades their repair
tier, the retainer platform list is updated to match.

### 8.2 What's included ($199/mo)

1. **Monthly drift scan** (system-initiated) — a lightweight, NAP-only
   scan checking each contracted platform for presence, NAP accuracy,
   hours accuracy, and claim status. Drift = any field that no longer
   matches the canonical record.
2. **Merchant change requests** (merchant-initiated) — the merchant
   submits correction requests through the customer portal: seasonal
   hours changes, holiday closures, new phone number, address move
   (requires owner confirmation), new website, category/attribute
   updates. The operator updates the canonical record and pushes the
   change to all contracted platforms using the Platform SOP (§7.5).
3. **Re-correction on contracted platforms** — whether drift is detected
   by the system or a change is requested by the merchant, the operator
   re-submits corrections (DFY, no additional charge).
4. **New directory submission (1/month)** — submit the business to one
   new directory per month (operator picks based on niche relevance).
5. **Quarterly citation audit report** — summary of all citations,
   status, drift detected/corrected, and change requests processed.

### 8.3 What's NOT included

- Review management (separate retainer — PB-02)
- Website maintenance (separate service)
- Photo/media refresh (separate — PB-06)
- New platform claiming beyond the monthly submission (quoted separately)
- Changes to platforms outside the contracted list (quoted per-change)

### 8.4 Expanded retainer ($299/mo, Premium customers)

Same as above but re-correction and change requests cover all platforms
in the original sweep, not just top 4. Two new directory submissions per
month instead of one.

### 8.5 Activity status report

The customer portal includes a **retainer activity status report**
showing a full log of what the retainer is doing. Every action is tagged
with one of four activity types: **proactive** (system scanned for
drift), **defensive** (system detected drift, operator corrected it),
**request** (merchant submitted a change), **execution** (operator
executed a correction or change on contracted platforms).

The portal shows summary cards (counts by type for the current month),
an activity timeline (chronological log with type badges, platform tags,
descriptions, and status), a platform health dashboard (per-platform
current status: clean / drift detected / correction in progress), and a
request submission form.

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §7.5 for the full portal
> spec** — the activity type table, activity log structure, portal view
> layout, and why the activity report is the retention tool.

### 8.6 Customer portal retainer page

The retainer activity status report lives at
`/account/marketing/retainer` on the customer portal. This is the
retention tool — without it, the merchant pays monthly and sees nothing.
With it, every month has a visible record of retainer value, even when
no drift is found.

---

## 9. Upsell Structure

The per-issue briefing and business_analysis audit identify issues beyond
NAP/claims. These are upsell opportunities, pitched after the repair package
is delivered. Website work, storefront creation, and directory entry
creation are all **upsell surfaces** — separate from the core Profile
Repair packaging.

| Upsell | Trigger | Product | Price |
|--------|---------|---------|-------|
| Website copy fix (DIY) | Website issues in audit (placeholder content, NAP mismatch on site, missing service info) | Instructions PDF for fixing website copy | $49–$99 |
| Website copy fix (DFY) | Same trigger | Operator fixes website copy within 48h | $149–$299 |
| Website redesign | Placeholder/broken website, no checkout | Separate engagement | Quoted |
| Platform storefront creation | Business has no Facebook page, no GBP, no Yelp — needs creation from scratch | Storefront setup (separate from repair of existing listings) | $99–$199 per platform |
| Directory entry creation | Business missing from vertical directories (SNAP, HomeAdvisor, etc.) | New listing submission | $49–$99 per directory |
| Storefront optimization | Missing photos, no category, no hours on existing profiles | Visual & Asset Refresh (PB-06) | $149 one-time |
| **Branding asset creation (DIY)** | **Gap analysis shows missing/low-quality logo, cover photo, banner, or profile photos vs. gold standard** | **Instructions for sourcing/creating branding artifacts (logo, cover photo, profile photo, banners) per platform** | **$49–$99** |
| **Branding asset creation (DFY)** | **Same trigger** | **Operator creates/sources branding artifacts and uploads to contracted platforms within 48h** | **$149–$299 per platform** |
| **Branding asset refresh** | **Existing logo/photos are low quality, outdated, or inconsistent across platforms (vs. gold standard pattern)** | **Visual & Asset Refresh — new logo, cover photos, profile photos, platform-specific banners** | **$199–$399** |
| Review management | Low review volume, unanswered reviews | Review Acceleration (PB-02) | $99 + $199/mo |
| Conversion fix | Missing CTA, no service pages | Conversion Fix (PB-03) | $199 + $299/mo |
| Ongoing monitoring | After any repair | Listing Sync retainer | $199/mo |

**Website is special.** The business's website is not a platform in
Profile Repair — it's a separate surface entirely. The audit may flag
website issues (placeholder content, NAP mismatch, missing checkout),
and the Completion Report notes them, but the repair package doesn't
fix the website. Website copy fix (DIY or DFY) is the entry-level
upsell; website redesign is the higher-tier upsell. Both are quoted
separately from the repair package.

**Website gold standards inform the upsell.** For niches where the
website is critical to conversions (plumbing, HVAC, legal, medical),
the gold standard scan can capture website patterns — hero copy, CTAs,
service page structure, trust signals (§4.2.5). When the operator
pitches the website copy fix upsell, they reference the website gold
standard: "Here's what a well-optimized plumbing website looks like —
your site should match this pattern." The gold standard makes the
upsell concrete rather than generic. The website gold standard is not
injected into the repair fulfill prompt (the repair package doesn't
fix websites) — it's used for the upsell pitch and for audit flagging
benchmarking.

**Platform storefront creation vs. Profile Repair.** Profile Repair
fixes *existing* listings (claim, correct NAP, set categories). If a
business has no listing on a platform at all (no Facebook page, no GBP),
creating one from scratch is a separate upsell — storefront creation —
not part of the repair package. The repair package assumes the listing
exists (or the platform is in scope for presence creation as part of
the repair, which is a boundary case the operator clarifies during
intake).

**Branding artifacts and gold standards.** Gold standard businesses
typically have **superior branding** — professional logo, cover photos,
banners, profile photos, and platform-specific visual assets. When the
audit compares a business against the gold standard (§3.1, architecture
§2.0), the gap analysis surfaces **missing or low-quality branding
artifacts** as a specific, concrete gap:

- "Google profile has 2 photos; gold standard candidates average 15+
  photos including a logo, cover photo, and interior/exterior shots"
- "Facebook page has no cover photo; all gold standard candidates have
  a branded cover photo with business name and tagline"
- "Yelp profile has no business logo; gold standard candidates have a
  consistent logo across all platforms"

This makes the branding upsell **evidence-based** rather than generic.
The operator can show the customer the gold standard exemplar's
branding (via the destination URL — §4.3.2) and say: "Here's what a
well-branded [African grocery store] looks like on Google — logo, cover
photo, 15+ photos. Your profile has 2 photos and no logo. We can create
and upload these for you."

**Branding artifacts are not part of core Profile Repair.** The repair
package fixes NAP, claims, categories, and hours. Branding asset
creation (logo, cover photo, banners, profile photos) is an upsell —
the business may need these artifacts to reach gold standard quality,
but sourcing/creating them is a separate service. The repair package's
fix sheet notes the branding gap in the `recommended` quality gates
(non-blocking), and the Completion Report lists it as a recommended
next step with the upsell pitch.

**Branding is a prompt family.** The platform offering architecture
supports a **Branding prompt family** — a set of prompts powered by
both the intelligence profile (category context) and the gold standard
(branding target state). The family includes:
- **Branding audit** (seek) — evaluates the business's branding against
  the gold standard's branding gates, produces a per-platform branding
  gap analysis
- **Branding recommendation** (seek) — what branding assets to create,
  why, priority order, platform-specific specs
- **Branding creation guide** (fulfill) — DIY instructions for
  sourcing/creating each asset with platform-specific dimensions and
  formats (this is the DIY upsell deliverable)
- **Branding upsell pitch** (seek) — operator-facing pitch document with
  evidence (gap summary, exemplar URLs, before/after framing, price
  points)

Each prompt in the family uses the same `serializeGoldStandard(category,
role)` injection — the same gold standard profile, the same destination
URLs, the same branding gates. The family is the first example of the
prompt family pattern; future families (Review Acceleration, Conversion
Fix, Visual & Asset Refresh) follow the same structure. See
`PLATFORM_OFFERING_ARCHITECTURE.md` §10.

**Platform-specific branding requirements.** Each platform has different
branding asset specifications:

| Platform | Logo | Cover photo | Banner | Photos | Other |
|----------|------|-------------|--------|--------|-------|
| Google Business Profile | Profile photo (logo) | Cover photo | — | Min 10 (gold standard) | Videos, virtual tour |
| Yelp | Business logo | Cover photo | — | Photos (interior, exterior, food/products) | — |
| Facebook | Profile picture (logo) | Cover photo | Event banners | Photo albums | Story highlights |
| BBB | Business logo | — | — | Accreditation badge | — |
| Apple Maps | Logo | — | — | Photos | — |
| Bing Places | Logo | — | — | Photos | — |

The gold standard scan captures the **branding artifact profile** of
each candidate per platform — what assets they have, how many, and
quality assessment. The `expected_fields` for each platform can include
branding gates (e.g., `has_logo: recommended`, `min_photo_count: 10`,
`has_cover_photo: recommended`) so the gap analysis flags missing
branding automatically.

The operator pitches upsells at the `retainer_pitched` stage, using the
briefing's `value_preview` and the audit's `recommended_services` list as
the talking points.

---

## 10. Infrastructure Gaps — What Needs to Be Built

The product spec above requires the following infrastructure work to be
operational:

### 10.0 Audit enhancements (seek-side gaps)

Two gaps in the existing `business_analysis` audit:

**10.0a — Profile URL capture.** The audit schema
(`apps/api/src/validators/business-analysis.schema.ts`) captures
`profile_status`, `rating`, `categories`, `displayed_name/address/phone`
per platform — but does **not** capture the live profile URL for each
platform. The `platformSchema` (line 274) and `googlePlatformSchema`
(line 288) have no `profile_url` field.

The audit should capture the destination URL for each platform it
evaluates — the Google Maps listing URL, the Yelp business URL, the
Facebook page URL — so the operator can verify audit findings by
visiting the live profile. This mirrors the gold standard scan's URL
capture requirement (§4.3.2 step 4) and the architecture principle
(`PLATFORM_OFFERING_ARCHITECTURE.md` §8.5).

**Proposed:** add `profile_url: z.string().nullable().optional()` to
`platformSchema` (which propagates to all platform subtypes via
`.extend()`). The audit prompt should be updated to instruct the model
to capture the live profile URL for each platform it evaluates. This is
a schema + prompt change, not a migration — the field is optional and
passthrough, so existing audits remain valid.

**10.0b — Gold standard benchmark injection during prompt resolution.**
The audit currently collects raw data (NAP, categories, photos, claim
status) and flags generic issues. With an active gold standard for the
category, the audit can compare the business against the category target
state on each platform, producing a richer, category-aware,
platform-aware gap analysis.

The audit prompt is not only city-category profile aware, but also
platform-category standards aware. Both profiles are injected during
prompt **resolution** — the phase where template variables are populated
before the prompt is sent to the model. See
`PLATFORM_OFFERING_ARCHITECTURE.md` §2.0.1 for the dual profile injection
pipeline.

**Proposed:**
- **Prompt resolution pipeline change** — the audit prompt's resolution
  step resolves **two profiles** in sequence:
  1. City-category intelligence profile (existing) → `{intelligence_profile}`
  2. Category gold standard profile (NEW) → `{gold_standard_benchmark}`
  Both resolved from `mkt_intelligence_profiles` via the same
  `IntelligenceProfileService.resolve` / `serializeGoldStandard` path.
  The gold standard is resolved the same way as fulfill — same call,
  same table, injected as a different variable with a different role
  (benchmark vs. target).
- **Audit prompt body change** — the prompt instructs the model to use
  `{intelligence_profile}` for source/terminology context AND
  `{gold_standard_benchmark}` to compare the business's actual state
  against the category target state per platform, flagging
  **category-specific** gaps (e.g., "primary_category is 'Grocery
  store' but the gold standard for African grocery stores sets it to
  'African goods store'"). The prompt is **branding-aware**: it
  evaluates the business's branding artifacts (logo, cover photo, photo
  count, photo types) against the gold standard's branding gates and
  flags missing/low-quality branding as gaps for upsell opportunity
  identification.
- **Audit output schema change** — gains a `gap_analysis` block per
  platform:
  - `field` — the field being compared
  - `actual` — the business's current value
  - `expected` — the gold standard's expected value
  - `gap_severity` — high / medium / low
  - `category_specific_note` — why this gap matters for this category
  - **`is_branding_gap`** — boolean, true when the gap is a branding
    artifact (logo, cover photo, photos). Branding gaps are always
    `low` severity (non-blocking, upsell opportunity) unless the
    platform requires a logo for listing completeness.
- **Audit output schema change** — gains a `quality_gate_results` block
  per platform: which universal, platform-specific, **and branding**
  gates the business passes/fails against the gold standard. Branding
  gate results are marked `recommended` (non-blocking).
- If no gold standard exists for the category, the audit runs without
  the benchmark (degraded but functional — `gold_standard_benchmark` is
  empty, `gap_analysis` and `quality_gate_results` are absent)
- The `gap_analysis` and `quality_gate_results` blocks are optional in
  the Zod schema so existing audits remain valid. This is a prompt
  resolution + prompt body + schema change, not a migration.

### 10.1 Fulfill prompt body (content gap)

`mpt-profile-repair-citation-package-fulfill` has a template ID and output
schema but no prompt body. Needs a prompt that:
- Takes **three inputs** (§3): `audit_results` (raw audit data),
  `seek_briefing` (the per-issue seek's scope/specifics/affected_platforms),
  and `gold_standard` (the niche target state pattern, §4)
- Generates `deliverableText` (per-platform fix sheet, §5.1) and
  `submissionGuide` (execution playbook, §5.2)
- Is issue-type-aware (NAP drift fix sheet differs from unclaimed profile
  fix sheet differs from platform gap fix sheet)
- Uses the gold standard as the target state pattern — category-specific
  GBP categories, attributes, description patterns, vertical directories
- Is grounded in the seek briefing — only addresses platforms the seek
  flagged, and delivers on the value_preview the seek promised
- Is **branding-aware** — for branding gates the business fails (has_logo,
  has_cover_photo, min_photos), notes them as **recommended next steps**
  in the fix sheet (not blocking repair completion). References the gold
  standard exemplar's branding for comparison: "Gold standard candidates
  for this category have a logo, cover photo, and 15+ photos on Google.
  Your profile has 2 photos and no logo. Branding asset creation is
  available as an upsell." The fix sheet does not include branding
  creation steps (that's the upsell), but flags the gap and the exemplar
  for the operator's upsell pitch.

### 10.2 Seek → fulfill variable injection (coupling gap)

`buildFulfillVariables` in `ProfileRepairPromptService.ts` currently passes
only `audit_results`. Needs extension to also pass:
- `seek_briefing` — serialized from the latest `profile_repair_audit`
  execution for the campaign (scope.specifics, scope.affected_platforms,
  issueType, pitch.value_preview). The query is the same one
  `RepairBriefingCard` uses on the frontend (filter by
  `output_schema.name === 'profile_repair_audit'`, take latest by
  `executed_at`).
- `gold_standard` — serialized from the resolved intelligence profile's
  `configuration_json.gold_standard` block (§4.4). Uses
  `IntelligenceProfileService.resolve(category, undefined, city)`.

Both are text-serialized into the prompt variables. If either is missing
(no seek execution yet, no gold standard for the category), the variable
is empty and the fulfill prompt runs without that input — degraded but
functional.

### 10.3 Gold standard scan prompt + schema (new prompt type)

The gold standard scan (`mpt-gold-standard-scan`) is a new prompt type
with a new output schema (`gold_standard_scan`). The scan produces **both
layers** in a single pass: `expected_fields` (data) and `candidates`
(pattern). Needs:
- **Output schema** (`gold_standard_scan`) — Zod schema in a new
  `gold-standard-scan.schema.ts` file, registered in
  `market-analysis.schema.ts`'s `OUTPUT_SCHEMA_REGISTRY`. The schema
  validates:
  - `expected_fields` — per-platform target field values (primary_category,
    required_attributes, recommended_attributes, hours_pattern,
    min_photo_count, description_requirements, category_specific_notes)
  - `candidates[]` — each with `platform_evaluations` containing
    per-platform config + `quality_score` + `is_gold_standard` flags
  - `scan_metadata` — including `expected_fields_derivation` (how the
    expected fields were aggregated from the candidates)
- **Prompt template** — seeded `mpt-gold-standard-scan` with
  `output_schema.name = 'gold_standard_scan'`, `prompt_type = 'seek'`.
  The prompt body instructs the AI model to:
  1. Search nationwide for businesses in the given category
  2. Evaluate each one per-platform (scoring 1-10 and setting
     `is_gold_standard` per platform)
  3. Return candidates that are gold standards on at least one platform
  4. **Capture the destination URL for every platform evaluation** — the
     live profile URL on each platform (Google Maps URL, Yelp URL,
     Facebook page URL, etc.). This is a **required focus** of the scan,
     not an afterthought. If the URL cannot be found, set `profile_url`
     to null and note it in `quality_rationale`. The destination URL is
     the verification anchor — it's shown wherever the candidate appears
     (admin cards, review view, fulfill output, deliverable).
  5. **Derive `expected_fields`** by aggregating field values across gold
     standard candidates per platform (most common primary_category, union
     of additional_categories, required vs. recommended attributes, min
     photo_count, common description themes, hours pattern)
- **Post-import hook** — extend `MarketingPromptService.importExternalResult`
  to detect `output_schema.name === 'gold_standard_scan'` and:
  1. Store `expected_fields` as-is into `configuration_json.expected_fields`
  2. Iterate `candidates[]` and their `platform_evaluations`
  3. For each platform where `is_gold_standard` is true, add the candidate
     (with platform-specific config) to `gold_standards[platform][]`
  4. Cap at 4 per platform (replace lowest quality_score if full)
  5. Call `IntelligenceProfileService.importAsDraft()` with:
     - `categoryKey` + `categoryName` from the scan output
     - `referenceCity = null` (city-agnostic, nationwide)
     - `configurationJson` with both `expected_fields` and `gold_standards`
       blocks merged into any existing profile configuration
- **Variable builder** — `buildGoldStandardScanVariables(category)` that
  injects the category string into the prompt. No campaign coupling —
  the scan is category-only, not tied to a specific campaign.
- **Fulfill-time resolver** — `serializeGoldStandard(campaign)` resolves
  the intelligence profile, reads both `expected_fields[platform]` and
  `gold_standards[platform][]` for each platform in the campaign's tier
  scope, picks the highest quality_score pattern per platform, and
  serializes as a platform-keyed object with `expected_fields` and
  `pattern` sub-keys per platform — **including the destination URL**
  for each pattern exemplar so the AI model can reference or browse the
  live profile during generation.

### 10.4 Gold standard data (content gap)

No `gold_standards` per-platform arrays exist in any intelligence profile
`configuration_json` yet. The gold standard scan (§10.3) populates them,
but the initial scans need to be run. Needs:
- Run the gold standard scan for priority categories (start with
  categories that have active repair campaigns)
- Review the scan output (draft profiles) — verify the per-platform
  `is_gold_standard` tags are correct (the AI may over-tag a business as
  a Yelp gold standard when its Yelp profile is actually thin)
- Activate the profiles with quality candidates per platform
- Optionally: promote successfully repaired businesses as gold standard
  candidates (the flywheel, §4.3.5) — the scan re-evaluates the repaired
  business per-platform and only tags the platforms that are now excellent

This is a curation effort once the scan prompt (§10.3) is built — the
storage and resolution infrastructure already exists in
`IntelligenceProfileService`. The `gold_standards[]` array is just new
JSONB content within the existing `configuration_json` field.

### 10.4a Gold standard activation UX (admin page gap)

The admin page at `/settings/admin/marketing-ops/intelligence-profiles`
(`IntelligenceProfilesClient.tsx`) hosts **two separate lists**:

1. **Seek Profiles (Intelligence)** — the existing list, filtered to
   profiles without `gold_standards`/`expected_fields` in
   `configuration_json`
2. **Gold Standard Profiles (Fulfill)** — a new list group, filtered to
   profiles with `gold_standards`/`expected_fields` in
   `configuration_json`

Each list has its own Draft and Active sections. Both share a filter bar
(category, platform, type, search) so the operator can confirm coverage
before running a scan campaign.

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §4.3 for the curation UX
> pattern** — the shared filter bar, card badges, review view, and
> activation flow.

**Profile Repair-specific details:**

- **Gold standard cards** show category + platform badges with type
  color-coding (e.g., `[Google ✓]` blue/directory, `[Facebook ✗]`
  violet/social_media, `[SNAP Directory ✓]` blue/vertical). Each
  platform badge with candidates is a **clickable link** to the top
  candidate's destination URL on that platform. A type coverage summary
  line shows "directory: 3/4 · social_media: 0/1".
- **The review view** shows universal expected fields (canonical NAP,
  hours, universal quality gates), per-platform expected fields + quality
  gates (with non-negotiable vs. recommended badges), and per-platform
  candidate cards (up to 4 per platform) with quality scores,
  rationales, platform config, NAP, and **clickable destination URLs**
  for each candidate. Scan metadata (date, sources, selection criteria)
  is also shown.
- **Per-platform candidate rejection** — the operator can individually
  reject a candidate the scan tagged as `is_gold_standard: true` but the
  operator disagrees with (e.g., checks the live URL and sees the
  profile is thin). This is an edit to the draft's `configuration_json`
  before activation.
- **Activation** uses the existing `activateIntelligenceProfileDraft`
  endpoint — no new endpoint needed. Activation retires the previous
  active gold standard profile for the same category.

### 10.5 Deliverable template (layout gap)

No `mkt_deliverable_templates_list` row exists for `citation_repair_package`.
Needs a template with:
- Section layout: Canonical NAP → Per-Platform Fix Sheet → Verification
  Checklist → Submission Guide
- PDF generation via `MarketingDeliverableService.generateDeliverable()`
- Watermarked preview variant (for pre-pay gallery) + clean paid variant

### 10.6 Tier selection (data gap)

The campaign has `package_price_cents` but no field for:
- Which tier was selected (Standard / Plus / Premium)
- Which delivery mode (DIY / DFY)
- Which 3 additional platforms (for Plus)
- DFY turnaround SLA

**Proposed:** add `repair_fulfillment_metadata` JSONB on
`mkt_campaigns_list` (or reuse an existing JSONB field) to store:
```json
{
  "tier": "standard|plus|premium",
  "mode": "diy|dfy",
  "additional_platforms": ["apple_maps", "bing", "waze"],
  "sla_hours": 48,
  "access_collected": true,
  "access_collected_at": "2026-08-20T..."
}
```

### 10.7 Execution tracking (workflow gap)

For DFY, the operator needs to track per-platform execution status. No
infrastructure exists for this. Options:
- **Lightweight:** a JSONB checklist on the campaign (similar to
  `repair_triage_briefing`) that the operator updates manually
- **Structured:** a new `mkt_repair_execution_items` table with per-platform
  rows (platform, action, status, verified_at, notes)

Recommend the lightweight approach for v1 — a `repair_execution_log` JSONB
field updated by the operator as they work. Upgrade to structured if volume
justifies it.

### 10.8 Access intake form (DFY only)

The existing intake system (`mkt_dispute_intake`) is for Track B evidence
collection. DFY access collection is lighter — it's a form the customer
fills out to confirm they've granted access, not an evidence submission.

**Proposed:** reuse the intake infrastructure with a new `intake_kind =
'profile_repair_access'`. The form collects:
- Per-platform: "I have granted access to [email] on [platform]" (checkbox)
- Optional: shared login instructions (encrypted, deleted after engagement)
- No evidence attachments needed

### 10.9 Completion Report deliverable

The Completion Report (§5.3) is a second deliverable type for DFY. Either:
- Add `completion_report` to the `DeliverableType` union, or
- Reuse `citation_repair_package` with a different template/layout for the
  completion variant

Recommend a new type `repair_completion_report` — it's a different artifact
with different content (before/after, verification status) than the fix
sheet.

### 10.10 Pay page tier selection

The `/marketing/pay` page currently shows a single price
(`package_price_cents`). For tiered pricing, it needs:
- Tier selector (Standard / Plus / Premium)
- Mode selector (DIY / DFY) — Premium is DFY-only
- Dynamic price update based on selection
- Plus: platform picker (choose 3 additional)

This is a frontend change — the pay endpoint already accepts
`package_price_cents` as the amount. The tier selection sets the price
before checkout.

### 10.11 Platform SOP module (procedural knowledge gap)

No SOP records exist for any platform yet. The fulfill prompt's
`submissionGuide` (§5.2) needs the SOP module to generate accurate,
platform-specific step-by-step instructions. Without SOPs, the fulfill
prompt generates generic instructions rather than concrete steps.

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §6 for the full SOP module
> spec** — storage proposal, field table, research workflow, fulfill
> integration, and re-verification cycle. Build SOPs starting with the
> top 4 platforms (§7.5 coverage priority), then expand.

### 10.12 Retainer automation — drift scan + change requests (workflow gap)

The retainer (§8) needs infrastructure for both directions: system-
initiated drift defense and merchant-initiated change requests.

> **See `PLATFORM_OFFERING_ARCHITECTURE.md` §7 for the full retainer
> model** — drift scan automation, admin alert workflow, merchant change
> request flow, and the activity status report portal spec.

**Profile Repair-specific infrastructure needs:**
- **Scheduled drift scan job** — cron-based monthly job iterating all
  active retainer subscriptions, running a lightweight NAP-only scan
  (presence, NAP accuracy, hours accuracy, claim status) against the
  canonical record stored at repair completion
- **Contracted platform list storage** — retainer subscription record
  stores the contracted platforms (top 4 for Standard, full sweep for
  Premium) so both drift scan and change request flow know which
  platforms to cover
- **Activity log storage** — `mkt_retainer_activities` table (or JSONB
  on subscription record) recording every retainer action with
  `activity_type` (proactive / defensive / request / execution),
  `activity_date`, `platform(s)`, `description`, `status`
- **Customer portal retainer page** at `/account/marketing/retainer`
  showing summary cards, activity timeline, platform health dashboard,
  and request submission form

---

## 11. Open Questions

1. ~~**NAP scan for retainer**~~ — **RESOLVED.** The retainer is a
   monthly drift seeker and reporter. It runs a lighter NAP-only scan
   (not the full `business_analysis` audit) and can be automated with
   admin alert capability. See §8.
2. ~~**Data aggregator integration**~~ — **RESOLVED.** Implement a
   Platform SOP module (§7.5) that captures the researched step-by-step
   process for each candidate platform. Every platform has a
   claim/edit/correction procedure, even if it's hidden or poorly
   documented. The SOP module is the research artifact that makes DFY
   execution repeatable across all platforms in the tier scope,
   including data aggregators.
3. **Google postcard workaround** — the 3-5 day postcard delay is the
   bottleneck for every DFY engagement. Do we offer a "fast-track" option
   (video verification, phone verification) where available?
4. **Vertical directory selection** — for Premium sweep, how do we
   determine which vertical directories matter for a given business
   category? The per-issue briefing's `affected_platforms` is a start, but
   it only covers directories the audit found — not ones the business is
   missing from.
5. **DFY capacity** — what's the max concurrent DFY engagements one
   operator can handle? The 24h Premium SLA may require capacity planning.
6. **Retainer churn** — what's the expected retainer retention curve?
   Affects pricing and the monthly scan cost calculation.
7. **Gold standard provenance** — should the gold standard block record
   *which* business is the reference (by name + URL), or should it be
   anonymized to avoid competitive sensitivity? Recording the reference
   business makes the gold standard verifiable and updatable; anonymizing
   avoids exposing a competitor's profile configuration to the AI model's
   output.
8. **Gold standard freshness** — how often should gold standards be
   re-verified? Platform category taxonomies change (Google adds/removes
   categories), attributes change, and a gold standard from 6 months ago
   may have stale category recommendations. Recommend re-auditing gold
   standards quarterly as part of the retainer scan cycle.
9. **Seek quality gate** — the seek→fulfill coupling means seek quality
   determines fulfill quality. Should there be a quality gate on the
   per-issue seek output before the fulfill runs? E.g., if the seek's
   `scope.specifics` is empty or generic, flag it for operator review
   before generating the fix sheet.
10. **Gold standard `is_gold_standard` threshold** — the scan uses
    `quality_score >= 7` as the auto-tag threshold. Is 7 the right cutoff?
    Too low and thin profiles get tagged as standards (contaminating the
    fix sheet); too high and small niches may have no standards at all.
    The operator review step (draft → active) is the safety net, but the
    auto-tag threshold determines what the operator sees.
11. **Cross-platform gold standard contamination** — the per-platform
    tagging prevents a business's weak Yelp profile from contaminating the
    Yelp fix sheet. But what if a platform has *no* gold standard in the
    niche (e.g., no African grocery store has a good BBB profile)? The
    fix sheet for that platform falls back to generic instructions. Should
    the fulfill prompt note this ("no category-specific pattern available
    for BBB — using generic instructions") so the operator knows a gold
    standard scan for that platform would improve the product?
