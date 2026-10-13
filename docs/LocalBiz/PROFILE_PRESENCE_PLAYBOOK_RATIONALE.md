# PB-09 Profile Presence & Creation — Strategic Rationale (A8)

> Archival rationale document. PB-09 started as gap closure — the presence/integrity signal family (`DS_MISSING_PROFILE`, `DS_CLAIMED_STATUS`, `DS_ZERO_INDEXED_PRESENCE`, `DS_PROFILE_SUSPENDED`, `DS_DUPLICATE_LISTING`, `DS_HIJACKED_LISTING`, `DS_OWNERSHIP_DISPUTE`, `DS_ADDRESS_VERIFICATION_BLOCK`) fired with no playbook to consume it, routing the platform's most invisible prospects to the blind PB-03 fallback. But the decision to build it as a first-class archetype rather than a PB-01 patch rests on a larger observation: **profile presence creation is where the platform's entire internal marketing machinery converges.** The same audit that detects the absence also powers the pitch, the build spec, the deliverable, the report, and the seed that makes the result publicly visible. PB-09 may prove to be a mini-pivot — a premium service offering in its own right — because no competitor assembling profiles by hand can match the intelligence stack already built to power this one playbook.

**Status:** Shipped. Code complete (A8 across API + web seams); migration 334 applied to local + prd 2026-10-10; PB-09 seeded `is_active=false` pending A8 deployment (G-1 deployment guard, same as PB-08).
**Scope of this document:** rationale and architecture leverage only — not a build spec. Implementation details live in migration 334 and `AGENTS.md` §A8/PB-09.

---

## 1. The core observation — one audit, every product

Every marketing archetype consumes intelligence; A8 is the first archetype where the intelligence **is** the product being sold. The assets the platform built for other purposes turn out to be exactly what premium profile creation requires:

| Internal asset | Built for | What it contributes to PB-09 |
|---|---|---|
| Establishment intelligence profiles (`IntelligenceProfileService`) | Category/market context for audits and enrichment | What a business of this category, in this market, should look like to a customer — the benchmark the new profile is built against |
| Gold standard profiles (`gold_standard_scan`, `resolveGoldStandard`) | Category benchmarking, emerging/competitive discovery | The expected field set per category — the attributes top-performing listings carry. PB-09 builds to this spec, not to "name + phone" |
| Signals + triage (`mkt_signal_registry`, `TriageEngineService`) | Diagnostic routing | Detects the absence/integrity state, routes to PB-09 (`primary_playbook` wiring + `matching_rules.any`), and discloses the reasoning in `triage_reasoning` |
| AI briefings (`archetypeFactSlice`, `mpt-archetype-briefing-a8`) | Operator prep for siblings | The deterministic fact slice + analyst narrative that turns "you're missing Yelp" into an evidence-backed story |
| Outreach narratives (hook library, opener/pitch/follow-up prompts, call scripts, quality gates) | Selling every other archetype | A8-tagged hooks (`zero_footprint`, `cross_platform_expansion`, `profile_claim_service`, `profile_rescue`) sharpened with intelligence-backed framing — "every platform is a door customers walk through" |
| Playbooks (`mkt_playbook_catalog`, checklist steps) | Fulfillment discipline | The 8-step presence sequence: inventory → audit supplementation → canonical record → GBP claim/create → platform builds → integrity resolution → presence plan → retainer |
| Reports (`ProspectReportService` `presence` chapter) | Owner-facing proof of value | The owner-visible chapter that turns internal diagnosis into a readable before/after story |
| Deliverables (`profile_presence_plan`, source-material + construction + render pipeline) | FITD fulfillment | The flagship artifact: before/after platform map, per-profile status, gold-standard field spec, claim handoff — carrying the DFY/DIY fork |
| Seeds (`directory_presence_seeds`, `DirectorySeedCampaignLinkService`) | Public directory layer 1/2 | The created presence itself can be hosted — a seed IS a gold-standard-profile-shaped public listing, generated and claimable |
| Storefronts + custom domains | Directory monetization | The premium surface a completed profile can grow into — the upsell path from "we built your profiles" to "we host your presence" |
| Diagnostic galleries, intake portal, customer portal | Multi-archetype GTM | Previews, `profile_setup` intake at `paid`, prospect-facing delivery — the full funnel an offering needs to be sellable end-to-end |

The flywheel: one `business_analysis` audit detects the absence (render-control-gated), feeds the triage route, populates the briefing, grounds the outreach narrative, seeds the presence plan's field spec, sources the report chapter, and — when the work is delivered — becomes the seed/storefront that *is* the new public presence. Audits, scans, and public narratives are shared infrastructure; PB-09 is the first playbook that monetizes the whole chain in one product.

## 2. Why this is a premium offering, not a repair task

1. **The intelligence is the moat.** Any freelancer can claim a GBP. Nobody else builds the profile from a category gold-standard field set derived from category intelligence + market signals + public data. The deliverable isn't "a listing" — it's a benchmarked profile with a defensible spec.
2. **Education is part of the product.** Prospects are uninformed about profile value — that profiles drive discovery, visibility, and traffic, and that each platform is a separate door. The pitch, the briefing, the presence plan, and the report chapter all teach this. Education is what makes the FITD → retainer path legible to the owner.
3. **It sells a chain, not a task.** FITD ($149 presence build) → retainer ($199/mo presence & sync defense) → seed/storefront/custom domain growth path. The same machinery that builds the profile also monitors and defends it — drift, suspension, duplicates, hijack are all already signal codes.
4. **DFY and DIY both monetize the blueprint.** The benchmarked field spec is the asset; DFY charges for execution against it, DIY charges for the blueprint itself. The spec survives either delivery mode — which means the intelligence does the heavy lifting in both.
5. **Operator loop compounds.** Checklist step 2 has operators supplement the audit with per-platform evidence (URLs, claim states, what a customer sees). Every PB-09 engagement makes the next audit sharper for the whole platform — the intelligence gets better the more it's sold.

## 3. Positioning vs. sibling archetypes

- **A3 (listing drift):** repairs inconsistency in profiles that *exist*. A8 owns profiles that don't, or that exist but aren't owned/usable (unclaimed, suspended, hijacked, disputed, duplicated, unverifiable).
- **A7 (website gap):** website acquisition/build — the owned domain surface. A8 is the distributed platform surface. They are complements in the same visibility thesis, deliberately kept distinct (`A7` retains its own audit type, `website_positioning`; A8 builds on the shared `business_analysis` + gold-standard machinery).
- **A5 (multi-signal):** presence codes joined `PB-05 dual.groupA` — presence + review backlog is exactly the multi-signal footprint A5 triages, so the dual lane still outranks PB-09 when the combined signature fires.
- **Cascade rank 3** was deliberate: presence is foundational — a business with no profiles has no surface for drift/review/conversion fixes to stick to.

## 4. Historical context

- **2026-10-10:** PB-09 + A8 shipped; migration 334 applied to local + prd. PB-09 seeded inactive (pre-A8 prod code would throw stamping `archetype='A8'`); activation is a one-line operator step post-deploy.
- Prior state (the gap this closed): eight presence/integrity codes registered in `mkt_signal_registry` with no playbook wiring; `DS_MISSING_PROFILE` rated `crisis` magnitude internally while routing nowhere; the sharpest absence copy lived only in outreach hooks that no owned playbook could reach.

## 5. What "mini-pivot" would mean concretely

If PB-09 validates as a standalone offering, the same stack supports it as a product line rather than one playbook among nine: the presence audit is the diagnostic, the gold-standard field spec is the blueprint, DFY/DIY are the delivery tiers, the retainer is the subscription, and seeds/storefronts/domains are the expansion surface. None of that requires new machinery — it requires packaging what already exists around the profile-presence thesis. This document exists so the rationale is on record if that evaluation happens.
