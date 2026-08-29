---
description: Operator workflow for entering a new niche and city — intelligence campaign ordering, profile prerequisites, thin-market tradeoffs, and the Coverage map as the primary entry point
---

# Intelligence Coverage Workflow — Operator Guide

Use this skill when guiding an operator through intelligence campaign setup
for a new niche + city, or when reasoning about which campaigns to run, in
what order, and which to skip in thin markets. Covers the Coverage map, the
dependency order, and the thin-market decision framework.

## Mental Model: Two Profiles, Two Phases

The system has **two profile types** that serve **two different phases**.
Confusing them is the most common operator mistake.

| Profile | Phase | Axis | Question it answers |
|---|---|---|---|
| **Intelligence profile** (emerging/competitive) | Seek — finding | City + focus (posture) | "How do I FIND businesses of this type in this market?" |
| **Gold standard profile** | Fulfill — rating | Platform + geo (where + which) | "What does GOOD look like, and how close is this one?" |

- **Gold standards** tell discovery how to *rate* discovered businesses (quality benchmark).
- **Intelligence profiles** tell discovery how to *find* businesses (terminology, sources, evidence rules).
- Both are category-aware (category is data, not code — no per-category engineering).

## The Dependency Order

**Establishment before discovery.** This is a hard rule, enforced by the
backend and the UI:

1. An **establishment** campaign bootstraps the profile (scan → draft → activate).
2. Only after the profile is **active** can a **discovery** campaign use it.

Without an active profile, discovery runs in degraded/generic mode — it knows
*which* category but not *how to search* that category in that city. The
backend hard-blocks discovery creation when no active profile exists
(`ValidationError` in `MarketingCampaignService.createCampaign`). The campaign
form disables the "Discovery" radio with an amber message when no profile is
found.

## The 6-Step Sequence (Saturated Market)

For entering a **new niche in a new city** with a specific platform focus:

### Prerequisite (nationwide, run once per category — reuse across cities)

**Step 0a: Gold Standard Establishment** (nationwide, per platform)
- Scope: `intelligence` · Focus: `gold_standards` · Kind: `establishment`
- Platform: pick one (`all`, `google`, `yelp`, `facebook`, `bbb`)
- Produces: nationwide gold standard profile (expected_fields, quality gates, pattern exemplars)
- **Only run if no active gold standard exists for this category.** Reuse the existing one across every city.
- Operator action: review draft → activate

**Step 0b: Gold Standard Discovery** (city-narrowed, optional)
- Scope: `intelligence` · Focus: `gold_standards` · Kind: `discovery`
- Platform: same as establishment · City: the new market
- Produces: additional candidates for the city/state-scoped gold standard slots
- **Only run if you want regional exemplars** the nationwide scan missed. Skip if the market is thin.

### Per City (4 intelligence campaigns — city is the focus dimension)

**Step 1: Emerging Establishment** (city + category)
- Scope: `intelligence` · Focus: `emerging` · Kind: `establishment`
- Produces: city/category intelligence profile (terminology, sources, evidence rules for low-visibility businesses)
- Operator action: review draft → activate

**Step 2: Emerging Discovery** (city + category)
- Scope: `intelligence` · Focus: `emerging` · Kind: `discovery`
- Consumes: active emerging profile + active gold standard (as quality benchmark)
- Produces: list of emerging/low-visibility businesses → prospect queue
- Platform narrowing is optional (defaults to "All Platforms")

**Step 3: Competitive Establishment** (city + category)
- Scope: `intelligence` · Focus: `competitive` · Kind: `establishment`
- Produces: city/category intelligence profile (terminology, sources, evidence rules for established competitors)
- Operator action: review draft → activate

**Step 4: Competitive Discovery** (city + category)
- Scope: `intelligence` · Focus: `competitive` · Kind: `discovery`
- Consumes: active competitive profile + active gold standard
- Produces: list of established competitors → prospect queue

### Downstream (per discovered prospect — archetype-agnostic at intelligence layer)

**Step 5: Triage each prospect**
- The triage engine evaluates audit signals and recommends a playbook
- Operator accepts or overrides → campaign is assigned a `campaign_category`
  (`review_management` | `recovery_management` | `profile_repair` | `triage_management`)
- **`campaign_category` is NOT set at intelligence scope.** It is a business-scope
  concept assigned downstream by triage. A single emerging discovery might surface
  businesses that become 3 review_management + 2 profile_repair campaigns.

## Thin-Market Decision Framework

Not every market deserves all 6 steps. The value of each step varies with
market density:

| Step | Thin-market value | Why |
|---|---|---|
| Gold standard establishment (0a) | **High** | Nationwide, reusable across every city. Fixed cost, pays off everywhere. Dropping it to save one scan costs benchmark quality in every city you later enter. |
| Gold standard discovery, city-narrowed (0b) | Low | Few regional candidates pass the bar. Skip. |
| Emerging establishment (1) | **Medium-high** | You still need to know *how* to search that city for that category. Terminology and sources differ by market. |
| Emerging discovery (2) | **Higher per-find** | Fewer finds, but each is more valuable — less competition for the operator's outreach. Don't skip. |
| Competitive establishment (3) | Low | Few competitors to model. |
| Competitive discovery (4) | Low | Few competitors to find. Skip. |

### The rule

**The first thing to drop in a thin market is competitive (steps 3-4), not
the gold standard.** The gold standard is a nationwide reusable asset —
dropping it to save one scan costs you benchmark quality in every city you
later enter. Emerging is often *more* worth running in a thin market, not
less, because the hidden businesses are the only opportunity.

## The Coverage Map — Primary Entry Point

The Coverage page (`/settings/admin/marketing-ops/coverage`) is the
operator-friendly driver for intelligence work. It shows a matrix of
categories × profile slots, with status indicators:

- **Green chip** = active profile (with a discovery arrow → links to pre-filled discovery campaign)
- **Amber chip** = draft profile (awaiting activation)
- **Dashed chip** = missing profile (links to pre-filled establishment campaign)

### How to use it

1. **Open Coverage** — see which categories have gaps
2. **Click a dashed chip** → lands on campaign form pre-filled for `establishment` with the right focus/category/city/platform
3. **Run + activate** the establishment campaign → profile becomes active
4. **Return to Coverage** — the slot is now green with a discovery arrow
5. **Click the arrow** → lands on campaign form pre-filled for `discovery` (allowed because profile exists)
6. **Run discovery** → prospect queue fills → triage assigns `campaign_category` downstream

### What the Coverage map enforces

- **Dependency order**: you can't click "discovery" on a missing slot — there's no arrow until the profile is active
- **Correct scope/focus/kind**: every link pre-fills the right combination
- **No `campaign_category` confusion**: the field is hidden at intelligence scope in the campaign form
- **Backend hard block**: even if an operator bypasses the UI, the backend rejects discovery creation without an active profile

## Key Architecture Rules (Don't Violate These)

1. **Establishment before discovery** — hard dependency, enforced at backend + UI
2. **Gold standards are nationwide** — establishment always runs nationwide; city is hidden for gold standard establishment. Only gold standard *discovery* can be city-narrowed.
3. **City is the focus dimension for emerging/competitive** — platform is optional narrowing, not the organizing axis
4. **One active profile per (category, focus, city)** — activating a new profile retires the prior active one for the same (category, focus, city) tuple
5. **`campaign_category` is business-scope only** — not set at intelligence scope; assigned by triage downstream
6. **Category is data, not code** — adding a new niche requires zero code changes; run scans and activate profiles
7. **Focus-specific profiles** — emerging and competitive need separate establishment campaigns (different search postures, different terminology/sources/evidence rules). One shared profile silently corrupts one of the two discovery runs (ghost bug).

## File Reference

| Component | File |
|---|---|
| Coverage map (frontend) | `apps/web/src/app/(platform)/settings/admin/marketing-ops/coverage/CoverageClient.tsx` |
| Coverage endpoint (backend) | `apps/api/src/routes/marketing-ops.ts` — `GET /intelligence-profiles/coverage` |
| Coverage aggregation | `apps/api/src/services/intelligence/IntelligenceProfileService.ts` — `getCoverage()` |
| Discovery hard block | `apps/api/src/services/MarketingCampaignService.ts` — `createCampaign()` prerequisite check |
| Form gating + deep-link pre-fill | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` |
| Architecture spec | `docs/LocalBiz/PLATFORM_OFFERING_ARCHITECTURE.md` — §1.1, §4.2a |
| Focus alignment spec | `docs/LocalBiz/intelligence_profile_type_alignment_sprint_plan.md` |
