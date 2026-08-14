# Seek Category Intelligence Scope — Gap Analysis

**Status:** Planning document for sprint scoping
**Spec under review:** Functional Specification — Seek Category Intelligence Scope (§1–§66)
**Analysis date:** 2026-08-14 (revised same-day after Category V3 artifact was identified)
**Codebase baseline:** `retail-visibility-platform` @ marketing-ops seek pipeline (migrations through `193_mkt_prospect_queue_business_name_nullable.sql`)
**Category V3 artifact:** DB template `mpt-6vrf6xtz` — "Local Category Market Opportunity Audit | Seek: Category Audit V3 (Emerging Discovery / Bottom-of-Pack / SaaS-Aligned Variant)"; full body exported at `errors/mpt-6vrf6xtz-prompt-body.md`; validator support in `apps/api/src/validators/city-category-opportunity.schema.ts`

---

## 1. Executive Summary

The spec proposes a fourth Seek scope, `intelligence`, that composes (1) the existing Category Seek prompt framework, (2) a new Intelligence amplification extension, (3) a reusable Category Intelligence Profile, and (4) an `emerging`/`competitive` focus modifier, then routes qualifying businesses into the existing Business Seek workflow.

**Headline finding: the spec is substantially a refactor-and-generalize of behavior that already exists as the Category V3 monolithic prompt — plus one genuinely new subsystem (Category Intelligence Profiles) and one genuinely new discipline (clean discovery-signal separation + provenance).**

Category Audit V3 (`mpt-6vrf6xtz`) already implements, in production-ready form:

- The spec's entire **emerging-focus behavior** (§15): thin-footprint targeting, deep/long-tail search, social-only/directory-only/single-platform discovery, hidden trust, recently-established businesses, "low visibility ≠ poor quality."
- A discovery-signal vocabulary (`EF_*`) that maps near-1:1 onto the spec's `INT_*` family (§28).
- The spec's geographic classification **including `outside_market`** (§24), the ownership exclusion list (§25), dedup and identity rules, the "do not convert unavailable information into a negative signal" rule (§31), a Business-Audit routing list (`prospect_discovery.recommended_for_business_audit[]`), and a hold analog (`insufficient_evidence` readiness + `insufficient_evidence_hold` playbook).
- Full-stack support: the `city_category_opportunity` Zod schema validates V3 output (emerging archetypes, growth readiness, reference anchors, foundational presence benchmarks, `tier_foundation*` tiers), and the signal registry already carries a V3-emitted signal (`DS_ZERO_INDEXED_PRESENCE`, aliased from `EF_ZERO_INDEXED_PRESENCE`, migration 191) consumed by the outreach hook library.

What V3 does **not** have — i.e., the spec's true delta:

1. **Category Intelligence Profiles** (§9–§13): reusable, versioned, per-category discovery knowledge (specialized sources with capability/limitation contracts, evidence ecosystems, category-specific signals). V3 is category-generic.
2. **Focus as a modifier** (§14–§16): V3 is hardwired to emerging; competitive behavior lives separately in V2. The spec unifies them under one framework.
3. **Prompt composition** (§3, §6, §49–§50): V3 is a hand-maintained monolith that *textually references* V2 ("Use the same input variables as Category Audit V2", "Use the same geographic model as Category Audit V2") — precisely the maintenance hazard §49 warns about. V3's existence is the strongest internal evidence that the composition architecture is needed.
4. **Discovery provenance** (§32): per-candidate, per-source attribution with source roles and evidence types. V3 has only a flat `sources[]` list at the audit level.
5. **Clean signal-family separation** (§30–§31): V3 mixes Business-Audit signals (RA/DS/WC/CP/VP) and discovery signals (EF) in one `detected_signals` array, and migration 191 folded an emerging signal into the `DS` family — the exact boundary blur the spec prohibits.
6. **Run-level versioning** (§41–§43): prompt_version + profile_version + intelligence_mode per run. Not reliable for any scope today.

What already exists and is directly reusable:

- A scope-aware, campaign-anchored prompt execution system (`mkt_prompt_templates_list` + `mkt_prompt_executions_list`) with Zod-validated output schemas, prompt-suffix generation, and an external-import path for LLM results produced outside the platform.
- A category-scope output contract (`city_category_opportunity`) that already produces per-business `ownership_type`, `location_status`, `detected_signals`, `prospect_priority`, and a `prospect_discovery.recommended_for_business_audit[]` routing list — the closest existing analog to the spec's discovered-business object.
- A Business Seek handoff mechanism (`deriveBusinessCampaign`) with `parent_campaign_id` lineage, plus a prospect queue with `source_kind` / `source_scope` / `source_campaign_id` / `source_audit_id` / `source_execution_id` provenance fields.
- A signal registry (`mkt_signal_registry`) organized by prefix families, which structurally supports adding a new `INT_` family that stays separate from Business Audit signals.
- Geographic classification (`inside_city` / `adjacent_city` / `metro_area`), ownership enums, and identity-confidence conventions that match the spec's suggested values.

What does not exist (the real gaps):

1. **No prompt composition mechanism.** Templates are monolithic with simple `{{variable}}` substitution. The spec's core architectural decision (§3, §6, §49–§50) — compose Category Base + Intelligence Extension + Profile + Focus — has no runtime support today. This is the single largest design decision for the sprint.
2. **No `intelligence` scope anywhere.** `CampaignScope`, `PromptScope`, the `SCOPE_VARIABLES` map, scope-compat checks, queue `source_kind`/`source_scope` enums, and all UI selectors are hardcoded to `business | category | city`.
3. **No Category Intelligence Profile store, resolver, or versioning.** Nothing resembling profiles, profile resolution, or generic-fallback mode exists.
4. **Weak prompt-version provenance.** Template updates mutate rows in place; executions do not snapshot template version or body. The spec (§42–§43) requires every run to durably record `prompt_version` AND `profile_version`.
5. **No focus modifiers, discovery signals (`INT_*`), discovery provenance model, or discovered-business output schema.**

**Bottom line for planning:** the sprint is best framed as **"extract V3's emerging behavior into the composed Intelligence framework, add the profile subsystem, and clean up signal separation"** — not as building discovery from scratch. Roughly 70–80% of the spec's *behavioral* surface already exists in V3 + the shared pipeline. The genuinely new engineering is: prompt assembly (or generated-prompt tooling), the profile subsystem, a slimmer discovery-oriented output schema, run-level provenance, and the operator UI.

---

## 1A. Category V3 Baseline — What the Spec Is Actually Extending

The spec repeatedly references "Category V3" (§5, §44–§45, §61). Verified identification:

| Property | Value |
|---|---|
| Template | `mpt-6vrf6xtz` in `mkt_prompt_templates_list` — "Category Audit V3 (Emerging Discovery / Bottom-of-Pack / SaaS-Aligned Variant)" |
| Full prompt body | `errors/mpt-6vrf6xtz-prompt-body.md` (1,199 lines; exported during execution debugging 2026-08-10) |
| Input contract | `{{category}}`, `{{city}}`, `{{state}}`, `{{zip_codes}}`, `{{search_radius_miles}}` — identical to spec §17 (minus profile params and focus) |
| Validator | `city-category-opportunity.schema.ts` — V3 enums present: `emergingArchetypeEnum` (L292), `growthReadinessEnum`, `reference_anchors`, `foundational_presence_benchmarks`, V3 tiers (L270–271), `outside_market` exclusion rule documented (L153); prompt suffix covers both V2/V3 (L1082–1086) |
| Signal integration | `DS_ZERO_INDEXED_PRESENCE` seeded via migration `191_mkt_signal_zero_indexed.sql` (registry alias of V3's `EF_ZERO_INDEXED_PRESENCE`); consumed by `apps/api/src/services/outreach-openers/emerging-angle-map.ts` and the hook library |
| Live usage evidence | `errors/zionsville-category-import-chatgpt.md` (2026-08-14) — a V3 Zionsville run via external LLM, imported through the external-import path |

### V3 → Intelligence-spec concept mapping

| Spec concept (Intelligence) | V3 equivalent | Delta |
|---|---|---|
| `focus = emerging` (§15) | The entire V3 prompt | V3 = emerging-only; spec wants focus as a switchable modifier |
| `focus = competitive` (§16) | Category V2 prompt | Two separate monoliths today; spec unifies |
| `INT_LOW_VISIBILITY` / `INT_WEAK_MAINSTREAM_INDEXING` | `EF_ZERO_INDEXED_PRESENCE` (registry: `DS_ZERO_INDEXED_PRESENCE`) | Rename + re-family into INT |
| `INT_SINGLE_SOURCE` | `EF_SINGLE_SOURCE_ONLY` | Rename |
| `INT_HIDDEN_TRUST` | `EF_STRONG_HIDDEN_TRUST` | Rename |
| `INT_RECENT_BUSINESS_EVIDENCE` | `EF_RECENTLY_ESTABLISHED` | Rename |
| `INT_POSSIBLE_CATEGORY_MISALIGNMENT` | `EF_NO_CATEGORY_SIGNAL` + `MISCATEGORIZED_OR_MISLABELED` archetype | Partial overlap; spec is signal-only |
| `INT_VERTICAL_SOURCE_DISCOVERY` | `DIRECTORY_GHOST` archetype (approx.) | Spec generalizes to profile-driven vertical sources (e.g. CARFAX) |
| `INT_MULTISOURCE_IDENTITY`, `INT_ACTIVE_OPERATIONAL_EVIDENCE`, `INT_CATEGORY_SPECIALIZATION`, `INT_UNDEREXPOSED_CREDENTIAL` | — | Net-new; profile-driven |
| Discovery provenance array (§32) | Flat audit-level `sources[]` only | Net-new per-candidate structure |
| Category Intelligence Profile (§9–§13) | — (V3 is category-generic) | **The core net-new subsystem** |
| `business_seek_priority` high/medium/low/hold (§34–§38) | `growth_readiness` + `suggested_growth_playbook` (`insufficient_evidence_hold` ≈ hold) | Rename + reframe as routing priority, decoupled from tiering |
| `category_fit` (§27) | Implicit via category qualification + `EF_NO_CATEGORY_SIGNAL` | Needs explicit field |
| `identity_confidence` (§26) | `data_confidence` + `EF_NAME_ONLY_VERIFICATION` (approx.) | Needs explicit field |
| `intelligence_mode` disclosure (§20) | — | Net-new |
| Business-Audit signals in output | V3 **mixes** RA/DS/WC/CP/VP into `detected_signals` | Spec §30 **prohibits** this mixing for Intelligence scope |
| Benchmarks/readiness/tier estimation | V3 computes Foundational Presence, archetypes, tiers, fees | Spec §22 deliberately **drops** audit-adjacent computation from the discovery scope |

**Design tension to resolve:** migration 191 deliberately aliased `EF_ZERO_INDEXED_PRESENCE` into the `DS` (Business Audit) family so the outreach hook library could consume it. The spec's §30 mandates the opposite direction — discovery signals in their own family. The sprint must decide: adopt `INT_*` as canonical for the new scope and leave V3/EF/DS aliases untouched (recommended, per §45's "do not retrofit V3"), or re-map. Do not silently reuse the DS alias for Intelligence output.

---

## 1B. Vision Extension — Profile-Amplified Business Prompt Resolution

**Product vision (stated 2026-08-14, beyond the written spec):** the Category Intelligence Profile should not be consumed only by the new `intelligence` discovery scope. It should also amplify **business-scope prompt resolution**: before a business audit prompt is presented or executed, the backend resolves it against the business's category, and if an active intelligence profile exists for that category, the resolved prompt includes category intelligence.

Conceptually:

```text
Business Audit Template (monolith, unchanged)
        +
Category Intelligence Profile (business-audit slice)
        ↓ backend resolution, transparent to the operator
Resolved Business Audit Prompt
```

This generalizes the spec's profile from "discovery-scope input" to a **cross-scope capability**: profiles describe how a category can be discovered (Intelligence scope) *and* what evidence ecosystems matter when auditing a business in that category (Business scope — e.g. CARFAX service-history corroboration for Auto Repair, licensing ecosystems for HVAC/childcare, booking ecosystems for salons).

**Framing (confirmed 2026-08-14):** the business audit moves from *category-aligned* to *category-intelligence-profile-aware*. Today the audit receives the category as a substituted string (`{{category}}`) — it knows *which* category, nothing more. Profile awareness means the resolved prompt knows *how to audit that category*: terminology, specialized sources, per-source capability/limitation contracts, category evidence rules, prohibited inferences, category signals. The alignment rule below is the **gate** (profile.category must equal campaign.category); profile awareness is the **resulting behavior**. Alignment without a profile → today's generic audit. Misalignment → never amplified. Awareness changes research guidance only: the audit's output contract (`business_analysis` schema, triage, signals) is unchanged, and the profile's `limitations`/`prohibited_inferences` actively constrain invalid inference (§31) at the scope where it is most tempting.

### Why the existing architecture supports this cleanly

Both backend entry points already converge on a single resolution seam in `apps/api/src/services/MarketingExecutionService.ts`:

- `renderPrompt()` (L207–223) — used by the Prompt Workspace "server-side render" to present the resolved prompt to the operator **before** execution (including copy-out to external LLMs);
- `executeSingle()` (L110–201) — the in-platform execution path;
- both delegate to `renderTemplate()` (L234–288), which already receives the full campaign object — and therefore `campaign.category`, the only input profile resolution needs.

### Category alignment rule (normative)

**A profile is applied to a business-scope resolution if and only if the profile's category matches the campaign's category.** Confirmed by the product owner 2026-08-14: *the intelligence profile's category and the business campaign's category must be the same category for the amplified audit to be produced.*

Concretely:

1. **Match key:** `IntelligenceProfileService.resolve(campaign.category)` performs a normalized exact match (case/whitespace-insensitive) against `mkt_intelligence_profiles.category_key`, optionally extended by declared per-profile aliases. Campaign `category` is an operator-entered string (suggestive select, `VARCHAR(100)`) — normalization is required, fuzzy/nearest-neighbor matching is **prohibited**.
2. **No cross-category application, ever.** A mismatched profile is actively harmful — e.g. CARFAX capability contracts injected into a restaurant audit would corrupt it. Wrong-category amplification is strictly worse than none.
3. **Miss behavior:** no active profile for the category → generic resolution, `intelligence_mode: 'none'`, and the workspace indicator (GAP-F3) shows "No category profile — generic resolution." This is the expected steady state during the PoC, since only `auto_repair_us` will exist.
4. **One profile per category:** the `is_active` + `(profile_id, version)` uniqueness model means resolution is deterministic — at most one active version per profile, at most one profile per category key.
5. **Audit trail:** every profiled resolution stamps `profile_id` + `profile_version` on the execution record, so category-profile effectiveness can later be measured per category (ties into the §58 metrics vision: profile → qualified lead rate, now extended to profile → audit quality).

Proposed resolution flow (one shared function, called by both paths):

```text
resolvePrompt(template, campaign, variables)
  1. base render          → renderTemplate(body, variables, campaign)   [existing, unchanged]
  2. profile resolution   → IntelligenceProfileService.resolve(campaign.category)
                            (normalized exact match on category_key; active version only)
  3. profile found?       → append rendered "Category Intelligence" block
                            (terminology, specialized sources + capabilities/limitations,
                             category evidence rules, prohibited inferences, category signals)
     no match?            → return base render unchanged
  4. return { prompt, resolution: { profile_id, profile_version,
                                    intelligence_mode: 'profile' | 'none' } }
```

Key properties:

- **Backward compatible by construction:** campaigns whose category has no active profile resolve exactly as today (`intelligence_mode: 'none'`); no existing business template changes; no scope-compat changes (the profile block contains no `{{variables}}`, so the out-of-scope reference check in `renderTemplate` is unaffected).
- **Provenance is mandatory, not optional:** resolution mutates the prompt without any template edit, so every execution/import must stamp `profile_id` + `profile_version` (same fields as GAP-P4/E1 — this vision *increases* the urgency of the execution-snapshot work, since "which prompt produced this output" now depends on resolution-time state, not just template state).
- **External-import parity:** the dominant audit workflow today is external LLM + JSON import (e.g. the V3 Zionsville run). Because `renderPrompt()` output is what the operator copies out, the profile block travels with it automatically; `importExternalResult()` should accept/record the resolution metadata so imported results carry the same provenance.
- **Profile content reuse:** the §10 profile structure already contains everything the business-audit slice needs (`terminology`, `specialized_sources[].capabilities/limitations`, `category_evidence_rules`, `prohibited_inferences`, `category_signals`). One new serializer (`renderBusinessProfileBlock`) — the intelligence scope's `renderProfileBlock` can share the same section renderers with different sections enabled.
- **Evidence-safety payoff:** injecting `prohibited_inferences` and source `limitations` into business audits directly attacks the §31 failure modes at the scope where they are most likely to occur (e.g. "CARFAX review count ≠ total online reviews" lands in the audit prompt itself).

### Impact on the composition decision (§4.1)

This vision **tips the Option A/B recommendation toward Option A (runtime composition/resolution).** Under Option B (generated monoliths), profile-amplified business audits would require regenerating profile-augmented variants of every business template per profile version — proliferation squared. Under Option A, profile injection is one resolver call shared by both scopes, and profile edits propagate to future resolutions with correct version stamping.

### UI implications

Prompt Workspace (`PromptWorkspaceClient.tsx`) gains a passive resolution indicator — e.g. "Category intelligence: auto_repair_us v1" vs. "No category profile — generic resolution" — so operators can see *why* a resolved prompt differs from the template. No workflow change.

### New gaps introduced by this vision

Added to the register as **GAP-P7** (resolution service + business profile-block renderer + execution/import provenance stamping) and **GAP-F3** (workspace resolution indicator). Both are LOW–MEDIUM effort because they ride the existing single-seam design.

---

## 1C. Operating Workflow — New Market + Category (confirmed 2026-08-14)

**Confirmed operator workflow for entering a new market/category:** run the Intelligence scope in **both focus layers** — `competitive` and `emerging` — and let each run execute either against the **internal AI** (in-platform) or an **external AI**, using the backend-resolved campaign prompt in both cases.

```text
New market + category
        ↓
Intelligence-scope campaign (category, city, state)
        ↓
┌─────────────────────────────┬─────────────────────────────┐
│ Run 1: focus = competitive  │ Run 2: focus = emerging     │
└─────────────────────────────┴─────────────────────────────┘
        ↓ per run: backend resolution (resolvePrompt)
Category Base + Intelligence Extension + Profile (if category match) + Focus Modifier + Market Inputs
        ↓
┌─────────────────────────────┬─────────────────────────────┐
│ Path A: internal AI         │ Path B: external AI         │
│ executeSingle() via         │ copy resolved prompt from   │
│ configured provider         │ workspace → run externally  │
│                             │ → import JSON via           │
│                             │ /executions/external        │
└─────────────────────────────┴─────────────────────────────┘
        ↓ both paths produce identical artifacts
Execution record + intelligence run + intelligence_discovery audit
        ↓ validated import/parse
Discovered businesses → prospect queue (cross-layer dedup)
        ↓ per candidate
Business Seek → profile-aware business audit (§1B) → triage → campaign
```

Properties of this workflow, mapped to existing seams:

1. **Dual execution paths already exist and are inherited for free.** Internal: `MarketingExecutionService.executeSingle()`. External: the Prompt Workspace renders/copies the resolved prompt and the operator imports the result via the external-execution endpoint with Zod validation (`importExternalResult`). The V3 Zionsville run used exactly path B. No new transport work is needed for either path — the new work is *resolution + provenance parity* across both (GAP-P7): an external import must record the same `focus` / `profile_id` / `profile_version` / `intelligence_mode` an internal run stamps automatically.
2. **Two layers, one campaign.** Executions are already many-per-campaign, so a single intelligence-scope campaign can hold both focus runs; the run record's `focus` field distinguishes them, and the results UI (GAP-F2) groups or filters by layer.
3. **Cross-layer convergence is a feature, not a collision.** Queue dedup (business_name + city + category) collapses businesses surfaced by both layers into one entry; discovery provenance preserves which layer(s) found it. A business appearing in *both* layers is itself a signal worth surfacing (visible enough to compete, thin enough to be opportunity) — consider a derived indicator in the queue UI.
4. **Layer roles stay distinct per spec §15/§16:** competitive builds the benchmarking set (who leads this market); emerging builds the prospect set (who needs us). Same profile, same category base — only the focus modifier differs, which is the core §49 anti-proliferation win.
5. **Practical constraint today:** internal execution is capped at `maxTokens: 2000` with a fixed system message (`executeSingle` L140–147) — too small for full discovery JSON. Until per-execution model/token configuration exists (open question 11), **path B (external run + import) is the realistic execution mode** for intelligence runs, exactly as V3 operates today. This is acceptable for the sprint but should be called out in the plan so "internal AI" isn't assumed to work out of the box.

---

## 1D. Profile Establishment Loop (confirmed 2026-08-14 — pulls spec §51/§52 forward into scope)

**Confirmed product workflow:** the same resolve → external-run → import loop is used to *establish* a category's intelligence profile. Once established, the profile is what business audits resolve against at prompt-resolution time (§1B) and what intelligence discovery runs inject (§19).

```text
New category without a profile
        ↓
Profile-establishment template (NEW prompt family — spec §51 "Category Signal Discovery")
        ↓ backend resolution (category + market inputs)
Resolved prompt exposed in workspace
        ↓ operator runs it in external AI (browsing-capable)
External result imported via POST /api/admin/marketing-ops/prompts/executions/external
        ↓ Zod-validated against NEW category_intelligence_profile schema (§10 structure)
Post-import hook persists mkt_intelligence_profiles row as DRAFT
        ↓ operator reviews + activates (one active version per profile)
Profile ACTIVE
        ├──→ business-scope resolvePrompt() now amplifies audits for that category (§1B)
        └──→ intelligence discovery runs now use mode 'profile' instead of 'generic_fallback' (§19)
```

Why this is architecturally sound on current seams:

- **Import path is already generic.** `importExternalResult` (MarketingPromptService L354–494) validates any registry-declared `output_schema`, creates the execution record, and supports post-import hooks — the `business_analysis` auto-sync hook (L468–483) is the direct precedent for "validate, then persist somewhere other than audits."
- **Registry precedent for non-audit outputs exists:** the `recovery_resolution` schema entry uses `auditPlatform: null` because imports create deliverables, not audits (`market-analysis.schema.ts` L166–170). A `category_intelligence_profile` entry with `auditPlatform: null` + a profile-persistence hook follows the same pattern.
- **Run record consistency:** profile-establishment executions stamp `intelligence_mode: 'bootstrap'` — the third mode the spec already enumerates (§41).

Two normative rules:

1. **Draft-by-default with human activation.** Profiles silently shape every future prompt resolved for that category (§1B resolution is transparent to operators). An imported profile therefore lands as `status: 'draft'` and only influences resolution after explicit operator activation. At most one active version per profile; activating a new version retires the old one, and historical runs keep referencing the version they used (§43).
2. **Discovery runs never establish profiles implicitly.** A `generic_fallback` discovery run (§20) must not "promote" its findings into a profile; establishment only happens through the dedicated profile-establishment template + import + activation path. This preserves the spec's §51 separation of profile creation from profile consumption while making creation operator-driven instead of manual JSON authoring.

**Scope note:** the written spec defers automatic profile generation (§51, §63) and requires only `profile` + `generic_fallback` modes for MVP. This confirmed workflow pulls the `bootstrap` path forward as an *operator-driven* capability (no autonomous generation — the operator runs and approves each profile). Register as **GAP-P8**; it is additive to MVP, not a replacement for seeding `auto_repair_us v1` directly.

---

## 2. Current-State Architecture Map (verified against code)

### 2.1 Prompt layer

| Concern | Today | Reference |
|---|---|---|
| Template storage | `mkt_prompt_templates_list` (id, name, `prompt_type`, `scope`, category, tone, `version` int, `body`, `variables` JSON, `output_schema` JSON, `is_active`, `is_default`) | `apps/api/prisma/schema.prisma` (~L6431–6453) |
| Prompt types | `'seek' \| 'fulfill' \| 'filter' \| 'retainer' \| 'category_analysis' \| 'city_analysis'` | `apps/api/src/services/MarketingPromptService.ts` L20 |
| Prompt scopes | `'business' \| 'category' \| 'city'` | `MarketingPromptService.ts` L22 |
| Composition | **None.** Monolithic body + regex `{{variable}}` substitution | `MarketingExecutionService.renderTemplate()` L234–288 |
| Variable allowlists | `SCOPE_VARIABLES`: business=17 vars, category=6, city=3; out-of-scope variable references are rejected at render time | `apps/api/src/services/scope-utils.ts` L35–44 |
| Versioning | Integer `version` on the template row; **updates mutate in place; no history; clone resets to v1** | `MarketingPromptService.ts` L218–249 |
| Output validation | `OUTPUT_SCHEMA_REGISTRY` maps schema name → Zod validator + `auditPlatform` + prompt suffix; 5 registered schemas (`market_analysis`, `regional_city_opportunity`, `business_analysis`, `recovery_resolution`, `city_category_opportunity`) | `apps/api/src/validators/market-analysis.schema.ts` L141–187 |
| Execution | `MarketingExecutionService.executeSingle()`: load template → load campaign → `assertScopeCompatible` → render → `aiProviderFactory.generateChatCompletion()` → persist execution (raw_output, tokens, cost) | `apps/api/src/services/MarketingExecutionService.ts` L110–201 |
| External import | `POST /api/admin/marketing-ops/prompts/executions/external` — paste LLM JSON, validate via registry schema, create execution + audit | `MarketingPromptService.importExternalResult()` L354–494 |
| Seeded seek templates | `mpt-seed-seek-001` (business audit), `mpt-seed-seek-002` (category analysis → `city_category_opportunity`), `mpt-seed-seek-003` (city ecosystem) | `apps/api/src/scripts/seed-marketing-ops-templates.ts` L19–230 |
| Category V3 (emerging discovery) | **DB template `mpt-6vrf6xtz`** — full V3 emerging-discovery prompt; validates against `city_category_opportunity`; executed externally + imported (Zionsville run in `errors/`) | `errors/mpt-6vrf6xtz-prompt-body.md`; `city-category-opportunity.schema.ts` L262–292, L656–760 |
| Authoring docs | V1/V2 prompt texts + per-LLM variants (gpt/claude/gemini/kimi/perplexity) live as markdown; V3 lives in the DB | `docs/LocalBiz/Audit Prompts/` |

**"Category V2/V3" resolved:** V2 = the competitive-benchmarking category audit (docs + `city_category_opportunity` base contract). V3 = `mpt-6vrf6xtz`, the emerging-discovery variant, fully supported by the validator. The spec's §61 baseline test ("Legacy Category V3 vs Intelligence Emerging") therefore means: **same market, `mpt-6vrf6xtz` vs. the new composed Intelligence-emerging prompt.**

### 2.2 Execution & data layer

| Concern | Today | Reference |
|---|---|---|
| Campaign scope | `mkt_campaigns_list.scope` VARCHAR(20), default `'business'`; TS `CampaignScope = 'business' \| 'category' \| 'city'` | schema.prisma L6151; `MarketingCampaignService.ts` L65 |
| Pipeline stage | `stage` default `'seek'`; transitions defined in `REVIEW_TRANSITIONS` | `MarketingCampaignService.ts` L29–83 |
| Category-scope output contract | `city-category-opportunity.schema.ts`: `sampled_businesses[]` (business_name, `ownership_type`, `location_status`, `detected_signals`, `signal_count`, `prospect_priority`), `prospect_discovery` (counts + `recommended_for_business_audit[]`) | `apps/api/src/validators/city-category-opportunity.schema.ts` |
| Ownership enum | `independent \| local_chain \| regional_chain \| national_chain \| franchise \| unknown` | city-category-opportunity.schema.ts L137–144 |
| Geographic enum | `inside_city \| adjacent_city \| metro_area \| outside_city_serving_city (legacy→metro_area) \| unable_to_verify`; `scope_mode: city_only \| explicit_radius \| prospect_market` | city-category-opportunity.schema.ts L155–174, L330–343 |
| Identity confidence | `high \| medium \| low` (business-analysis `audit_metadata.identity_confidence`, plus `identity_status: confirmed/ambiguous/mismatched`) | `apps/api/src/validators/business-analysis.schema.ts` |
| Business Seek handoff | `deriveBusinessCampaign(parentId, …)` creates a business-scope child at `seek` stage with `parent_campaign_id` lineage and inherited category/city | `MarketingCampaignService.ts` L603–700 |
| Prospect queue | `mkt_prospect_queue`: `source_kind` (`category_analysis \| city_category_audit \| scan_unmatched \| manual`), `source_scope`, `source_campaign_id`, `source_audit_id`, `source_execution_id`, `business_snapshot` JSON, `detected_signals` JSON, `signal_count`, `priority (high/normal)`, status, dedup on name+city+category | schema.prisma L6988–7019; `MarketingProspectQueueService.ts` L33–37, L121–256 |
| Chain exclusion | Hot-prospect sync skips `national_chain` only, behind `unifiedConfig.marketingOpsHotProspectSkipNationalChains` | `MarketingHotProspectService.ts` L246–255 |
| Signal system | 31 canonical codes in 6 prefix families (RA/DS/WC/CP/VP/OX); `mkt_signal_registry` (code, family, label, detection_source, derived_rule); extraction precedence: model_emitted → derived → operator_input | `apps/api/src/services/triage/signal-extractor.ts`; schema.prisma L6899–6913 |
| Audits | `mkt_audits_list` (campaign_id, `platform`, `audit_data` JSON, `import_metadata` JSON) | schema.prisma L6056–6082 |
| Executions | `mkt_prompt_executions_list` (campaign_id, template_id, variables_used, raw_output, ai_provider, ai_model, tokens, cost, sync_report) — **no prompt_version/profile_version columns** | schema.prisma L6401–6428 |

### 2.3 Frontend layer

| Concern | Today | Reference |
|---|---|---|
| Scope selection | Campaign form dropdown: business / category / city | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` L545–549 |
| Category result UI | `CityCategoryAnalysisAuditCard` — sampled-businesses table with per-row **Queue** and **Campaign** (derive) actions; `CategoryAnalysisAuditCard` — top-competitors table with same actions | `apps/web/src/components/marketing-ops/CityCategoryAnalysisAuditCard.tsx`, `CategoryAnalysisAuditCard.tsx` |
| Business result UI | `BusinessAnalysisAuditCard` + `IntelligentTriageCard` | `apps/web/src/components/marketing-ops/` |
| Prospect queue UI | Source-kind labels, source-scope badges, parent-campaign links, priority toggle | `apps/web/src/app/(platform)/settings/admin/marketing-ops/queue/ProspectQueueClient.tsx` |
| Prompt library | Filter by type/scope/category/tone; workspace with render/import; no version history | `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/` |
| Existing "intelligence" naming | `mkt_outreach_intelligence` = owner-contact research worksheet (unrelated to this spec) | schema.prisma L7169–7187 |

---

## 3. Spec-to-Code Traceability Matrix

Legend: **EXISTS** = reusable as-is · **PARTIAL** = exists but needs modification · **GAP** = net-new build

| Spec § | Requirement | Status | Evidence / Notes |
|---|---|---|---|
| §2 | `intelligence` as 4th runtime scope | **GAP** | Scope enums hardcoded to 3 values in `CampaignScope`, `PromptScope`, `SCOPE_VARIABLES`, queue `source_scope`, UI selectors |
| §3, §6, §49–50 | Prompt composition (Base + Extension + Profile + Focus) | **GAP** | No composition mechanism; monolithic templates only. Spec permits "equivalent generated prompt assembly" (§6) |
| §4, §7 | Inherit Category Seek rules (definition, geography, ownership, identity, dedup, safety, output discipline) | **EXISTS (as prompt text)** | All these rule blocks exist verbatim in the Category V2 prompt doc (`docs/LocalBiz/Audit Prompts/…prompt - v2 - Seek.md`). They are text, not shared components — see §4.1 below |
| §7 | SaaS input contract (category, city, state, zip, radius) | **EXISTS** | Category template variables + city-category schema `requested_market` |
| §8 | Intelligence amplification extension | **GAP** | New prompt asset |
| §9–13 | Category Intelligence Profile (structure, sources, evidence exhaust) | **GAP** | No store, no model, no resolver |
| §12 | Source capability/limitation model | **GAP** | New JSON structure inside profile |
| §14–16 | Focus modifiers `emerging` / `competitive` | **PARTIAL** | Emerging behavior fully exists as V3 (`mpt-6vrf6xtz`); competitive ≈ V2. GAP is *focus as a modifier of one framework* + parameter plumbing — not the discovery behavior itself |
| §17 | Inputs incl. optional zip_codes, search_radius, profile_id/version | **PARTIAL** | zip/radius exist in category contract; profile params are new |
| §18–19 | Prompt + profile resolution pipeline | **GAP** | Today: operator manually picks a template; no automatic resolution at all |
| §20 | Generic fallback + `intelligence_mode: generic_fallback` disclosure | **GAP** | New template + output field |
| §21 | Execution model (20-step discovery pipeline) | **PARTIAL** | Runtime is single-shot LLM call; pipeline is prompt-instructed. Persistence/validation seam exists via output-schema registry |
| §22, §31 | Intelligence ≠ Business Audit boundary; no deficiency conversion | **PARTIAL** | Enforceable structurally: separate `INT_` signal family + separate output schema. Needs validation guardrails (see §4.4) |
| §23–25 | Candidate inclusion, geographic classification, ownership eligibility | **PARTIAL/EXISTS** | V3 already implements the full model incl. `outside_market` exclusion (validator documents the rule at L153) and the exact §25 ownership exclusion list. Backend-coded exclusion remains thin (hot-prospect sync skips `national_chain` only) |
| §26 | Identity confidence high/medium/low | **EXISTS** | business-analysis schema uses identical values |
| §27 | Category fit verified/probable/insufficient | **GAP** | New enum (closest existing: `prospect_priority` incl. `insufficient_evidence`) |
| §28–30 | Discovery signals `INT_*`, separate from Business signals | **PARTIAL** | V3's `EF_*` family is a near-1:1 precursor (see §1A mapping), but V3 mixes EF + RA/DS/WC in one array and migration 191 aliased one EF code into the DS family. INT family + strict separation + guardrails are new |
| §32 | Discovery provenance array (source_name, source_role, evidence_types) | **GAP** | Queue has single `source_kind`; per-candidate multi-source provenance is new |
| §33 | Discovered-business output object | **GAP** | New Zod schema + registry entry + prompt suffix |
| §34–38 | Business Seek priority high/medium/low/hold | **PARTIAL** | V2 schema has high/medium/low/insufficient_evidence; V3 has growth_readiness incl. `insufficient_evidence` + `insufficient_evidence_hold` playbook (hold analog); queue has high/normal. Explicit routing-priority field with `hold` is new |
| §39–40 | Business Seek handoff + parent-child lineage | **EXISTS/PARTIAL** | `deriveBusinessCampaign` + `parent_campaign_id` exist. Carrying `discovery_context` (focus/signals/sources) into the child is new but trivial (snapshot JSON / notes) |
| §41 | Intelligence run record (profile_id, profile_version, intelligence_mode, focus…) | **PARTIAL** | Executions table exists but lacks these fields; needs new table or column/metadata extension |
| §42–43 | prompt_version + profile_version per run; historical profile immutability | **GAP** | Template versions mutate in place today — **provenance is currently unreliable even for existing scopes**; profile versioning is net-new |
| §44–45 | Backward compat; no mandatory changes to Category V2/V3 or Business Seek callers | **EXISTS (constraint satisfiable)** | All proposed changes are additive; V3 (`mpt-6vrf6xtz`) and V2 remain operational per §45; legacy callers never supply intelligence metadata |
| §46–48 | Auto Repair PoC, CARFAX source, emerging + competitive examples | **GAP (content)** | Profile content authoring task, not engineering |
| §51–52 | Profile creation separate from consumption; future lifecycle | **N/A (deferred)** | Spec defers auto-generation; MVP is consumer-only |
| §53–54 | Discovery saturation; efficiency pre-filter | **PARTIAL** | Prompt-level behavior; no runtime enforcement needed. Queue dedup already prevents re-queueing |
| §55 | Data model: intelligence_profiles, intelligence_runs, business_discoveries | **GAP** | None exist; prospect queue is a viable substrate for discoveries (spec allows this) |
| §56–57 | UI: scope selector, focus, results summary, candidate actions | **PARTIAL** | Scope dropdown + audit-card pattern + queue/derive actions all exist to copy; intelligence-specific UI is new |
| §58 | Observability (run + source metrics) | **PARTIAL** | Execution records capture provider/model/tokens/cost; focus/profile/source metrics are new fields |
| §59 | MVP acceptance criteria | — | Mapped individually in §7 below |
| §60–62 | Sprint PoC, test, deliverables | — | Planning guidance; see recommended plan §6 |
| §63–64 | Deferred enhancements | **N/A** | Out of scope |

---

## 4. Detailed Gap Analysis by Layer

### 4.1 Prompt layer — the core architectural gap

**GAP-P1 · No prompt composition engine (severity: HIGH — the spec's central design decision)**

The spec's §3 requires Intelligence prompts to be *composed* from a Category Base + Intelligence Extension + Profile + Focus, and §49 explicitly warns against maintaining `AutoRepairEmergingPrompt`, `HVACCompetitivePrompt`, etc. Today's `renderTemplate()` performs flat `{{variable}}` substitution on a single monolithic body. There is no fragment model, no include mechanism, no conditional blocks.

Two viable implementations:

| Option | Approach | Pros | Cons |
|---|---|---|---|
| **A. Runtime fragment composition** | Store fragments as templates with a new `prompt_type = 'fragment'` (or a `fragment_kind` column): `seek_category_base`, `seek_intelligence_extension`, `seek_intelligence_focus_emerging`, `seek_intelligence_focus_competitive`. A composer service assembles body = base + extension + rendered-profile-block + focus + market inputs, then runs existing variable substitution. | True to spec §49; single source of truth per fragment; profile changes don't touch prompt text | New composer code path; scope-utils variable validation must run against the *assembled* body; prompt library UI needs a fragment concept (or fragments hidden from the normal list) |
| **B. Generated monolithic prompts** | A build/generation script (or service method) renders fragments + profile into a full template row per (profile, focus) combination, with provenance stamped into `variables`/metadata | Zero runtime changes; works with existing execution, import, and UI as-is | Prompt proliferation in the DB (the thing §49 wants to avoid — though it's *generated* proliferation, not *maintained* proliferation); profile edits require regeneration; version provenance must be stamped at generation time |

**Recommendation:** Option A if the team expects ≥3 profiles or frequent profile iteration within 2 sprints; Option B is the faster path to the Auto Repair PoC and is explicitly permitted by spec §6/§50 ("equivalent generated prompt assembly is acceptable"). A hybrid is defensible: ship B for the sprint, design the composer so B's generator becomes A's assembler later. **V3 is the in-house proof that the monolith approach hurts:** `mpt-6vrf6xtz` is a 1,199-line hand-maintained prompt that re-states or textually references V2 rules in at least six sections (input contract, category definition, geography, dedup, signals, market size) — every V2 rule change must currently be manually mirrored into V3. Composition eliminates exactly this.

Either way, **the Category Base must first be extracted into a canonical store**. Today the shared rule text is scattered across: the V2 doc in `docs/LocalBiz/Audit Prompts/`, the DB seed `mpt-seed-seek-002` (a materially shorter V1-era template), and inline re-statements inside V3. Prerequisite decision: which of these is the authoritative "Category Seek framework" text that the Intelligence scope inherits (recommendation: the V2 doc text, since V3 already treats it as the reference).

**GAP-P2 · `intelligence` scope absent from the scope system (severity: HIGH, effort: LOW)**

Touchpoints: `PromptScope` (MarketingPromptService L22), `CampaignScope` (MarketingCampaignService L65), `SCOPE_VARIABLES` + `assertScopeCompatible` (scope-utils.ts — add an `intelligence` allowlist, likely `['category','city','state','zip_codes','search_radius_miles','focus','neighborhood']`), queue `source_scope` enum, UI scope selectors. The DB column is `VARCHAR(20)` with no CHECK constraint, so no migration is needed for the enum value itself. Note the spec requires `zip_codes` and `search_radius_miles` inputs — these are **not currently campaign fields or scope variables** (they exist only inside the audit output schema), so they must be added as execution-time caller-supplied variables or campaign attributes.

**GAP-P3 · Focus parameter plumbing (severity: MEDIUM, effort: LOW)**

`focus` is a new template variable (`emerging`/`competitive`) plus validation. If Option A is chosen, focus selects a fragment; if Option B, focus selects a generated template. Either way it must be captured on the run record for observability (§58).

**GAP-P4 · Prompt-version provenance is unreliable (severity: HIGH — pre-existing defect the spec exposes)**

§42 requires every Intelligence run to record `prompt_version`. Today, updating a template mutates the row in place (`MarketingPromptService` update path) and executions store only `template_id` — so historical executions cannot be faithfully attributed to the prompt text that produced them. **This is already a latent reproducibility defect for existing scopes; the spec makes it a hard requirement.** Minimum fix: snapshot `template_version` + `template_body_hash` (or full body) onto `mkt_prompt_executions_list` at execution/import time. This benefits all scopes and should be pulled forward regardless of option A/B.

### 4.2 Category Intelligence Profile subsystem — net-new

**GAP-P5 · No profile store, resolver, or versioning (severity: HIGH — four spec sections: §9–13, §19, §43)**

New table (recommended: migration `194_mkt_intelligence_profiles.sql`):

```text
mkt_intelligence_profiles
  id                  varchar  (profile_id, e.g. 'auto_repair_us')
  category_key        varchar  (normalized lookup key)
  category_name       varchar
  version             int
  configuration_json  jsonb    (§10 structure: terminology, synonyms, subcategories,
                                specialized_sources[{name,type,priority,capabilities,limitations}],
                                discovery_patterns, *_evidence_rules, category_signals,
                                prohibited_inferences)
  status              varchar  ('active' | 'draft' | 'retired')
  created_at / updated_at
  @@unique([id, version])
```

Plus a small `IntelligenceProfileService`: `resolve(category)` → latest active profile or null; `getVersion(profile_id, version)` for historical fidelity (§43 — historical runs must reference the version used; versioning therefore requires **immutable version rows**, unlike prompt templates today). Profile JSON → prompt-block rendering (a `renderProfileBlock(profile)` that serializes capabilities/limitations/signals into prompt text) belongs here or in the composer. The spec's §10 JSON maps cleanly to a single JSONB column; a relational decomposition is explicitly not required for MVP.

**GAP-P6 · Generic fallback mode (severity: MEDIUM, effort: LOW)**

A `generic_fallback` template/fragment using mainstream sources only, plus the mandatory `intelligence_mode` field in the output schema (§20). The resolver returning null → fallback path must stamp `intelligence_mode: 'generic_fallback'` on the run record and into the rendered prompt so the model discloses it in output.

**GAP-P7 · Profile-amplified business prompt resolution (severity: MEDIUM — vision extension §1B; effort: LOW–MEDIUM)**

Nothing in the current render path is category-aware beyond raw `{{category}}` text substitution. Required:

1. `resolvePrompt()` in `MarketingExecutionService` wrapping `renderTemplate()` — called by both `renderPrompt()` and `executeSingle()` so presentation and execution resolve identically.
2. `IntelligenceProfileService.renderBusinessProfileBlock(profile)` — serializes the audit-relevant slice of the §10 profile (terminology, specialized sources + capability/limitation contracts, category evidence rules, prohibited inferences, category signals) into prompt text.
3. Strict category alignment per the §1B normative rule: normalized exact match on `category_key`, active version only, no fuzzy matching, no cross-category application.
4. Provenance stamping: `profile_id`, `profile_version`, `intelligence_mode` onto the execution record (shares the migration with GAP-P4/E1) and accepted as optional metadata on the external-import path.
5. No-profile path returns the base render byte-identical to today (regression-testable). Test matrix: matching category → block present + provenance stamped; mismatched/absent category → byte-identical base render; inactive profile version → treated as absent; case/whitespace variants of the category string still match.

**GAP-P8 · Profile-establishment loop (severity: MEDIUM — vision extension §1D, pulls spec §51/§52 forward; effort: MEDIUM)**

Nothing today persists a validated import into anything other than audits/deliverables. Required:

1. Profile-establishment prompt template (new prompt asset; declares `output_schema = {"name": "category_intelligence_profile"}`).
2. `category-intelligence-profile.schema.ts` — Zod schema mirroring the §10 profile structure (terminology, synonyms, subcategories, `specialized_sources[{source_name, source_type, priority, capabilities[], limitations[]}]`, evidence rules, `category_signals`, `prohibited_inferences`) + registry entry with `auditPlatform: null` + prompt suffix (follows the `recovery_resolution` non-audit precedent).
3. Post-import persistence hook in `importExternalResult` (pattern: the `business_analysis` auto-sync hook, L468–483): upsert into `mkt_intelligence_profiles` as `status: 'draft'`, next version number when the profile_id already exists, record the establishing execution id on the profile row, and stamp the run record `intelligence_mode: 'bootstrap'`.
4. Activation path: minimal operator action to activate a draft (retires the previous active version atomically). A full profile admin UI is deferred per §63 — a single activate button in the prompt/workspace area or a small list view is sufficient.
5. Resolver unchanged: `IntelligenceProfileService.resolve()` only ever returns `active` profiles, so both consumers (§1B business resolution, §19 discovery injection) pick up newly activated profiles with no further work.

### 4.3 Execution, run persistence, and lineage

**GAP-E1 · Intelligence run record (severity: HIGH, effort: MEDIUM)**

Every prompt execution today is anchored to a `campaign_id` and `template_id`. The consistent, lowest-friction pattern (matching how city/category runs work) is:

- An Intelligence run = an `intelligence`-scope campaign (stage `seek`) + one or more prompt executions against it. This reuses campaign CRUD, the audit attachment model, the execution table, and the existing UI shells with zero new persistence for the run header.
- Run-specific fields (§41: `focus`, `profile_id`, `profile_version`, `intelligence_mode`, `prompt_version`) then need a home. Options: (a) new nullable columns on `mkt_prompt_executions_list`; (b) a dedicated `mkt_intelligence_runs` table linked to the execution; (c) JSON in `variables_used` / audit `import_metadata`. **Recommendation:** (a) for `prompt_version` (universal fix, see GAP-P4) + (b) a thin `mkt_intelligence_runs` table for the §41 record, because §58 observability wants to query by focus/profile/mode without JSON spelunking, and §40 wants a stable `intelligence_run_id` lineage handle.

**GAP-E2 · Discovered-business persistence (severity: HIGH, effort: MEDIUM — but the substrate exists)**

Spec §55 explicitly allows reusing the existing prospect/candidate model instead of a new `business_discoveries` table. `mkt_prospect_queue` is a strong substrate: it already has dedup (name+city+category), campaign-exists checks, `business_snapshot` JSON, `detected_signals`, priority, assignment, dismissal, and `createCampaignFromQueue()` which already replays snapshots into business-scope campaigns. Required extensions (migration `195_mkt_prospect_queue_intelligence.sql`):

- `source_kind` enum gains `'intelligence_seek'` (TS union + UI labels; DB column is varchar).
- New columns: `category_fit` (`verified|probable|insufficient`), `identity_confidence` (`high|medium|low`), `location_status`, `discovery_provenance` JSONB (§32 array), `business_seek_priority` (`high|medium|low|hold` — note queue `priority` today is `high|normal` and means *operator triage priority*, so do **not** overload it), `intelligence_run_id` nullable FK.
- **Decision point:** keep `detected_signals` for Business-Audit signals only and add `discovery_signals` JSON for `INT_*` codes, so the two families never mix in one column (§30). This is cleaner than stuffing INT codes into `detected_signals` and filtering downstream.

**GAP-E3 · Business Seek handoff with discovery context (severity: MEDIUM, effort: LOW)**

`deriveBusinessCampaign` already creates the business-scope child at `seek` stage with lineage. Gaps: (1) carry §39 `discovery_context` (focus, signals, sources) — pass through `business_snapshot` into the child campaign's `attributes`/notes, or stamp on the queue entry the campaign is created from; (2) `createCampaignFromQueue` must propagate the new intelligence fields so the lineage chain `intelligence_run → discovery (queue entry) → campaign → business audit` is queryable. Legacy callers are unaffected (§44) because all new fields are nullable/optional.

### 4.4 Signals and evidence safety

**GAP-S1 · `INT_` signal family (severity: MEDIUM, effort: LOW)**

`mkt_signal_registry` accepts new codes without schema change. Add the 11 §28 codes with `family = 'INT'`, `detection_source = 'model_emitted'`. Five of them are renames of existing V3 `EF_*` codes (mapping in §1A) — but **do not reuse the `DS_ZERO_INDEXED_PRESENCE` alias**: migration 191 deliberately placed it in the DS family so the outreach hook library (`emerging-angle-map.ts`, `hook-library.ts`) could consume it, and the spec's §30 boundary requires the INT family to stay out of the audit families. V3 keeps emitting EF/DS aliases (unchanged per §45); Intelligence scope emits INT codes only. Required guardrails, because the registry currently feeds triage:

- `signal-extractor.ts` must not map INT codes into triage evaluation (extraction today pulls from `audit_data.detected_signals` of business/category audits — intelligence discoveries must write to the new `discovery_signals` field, GAP-E2, so this separation is mechanical if the naming discipline holds).
- Playbook rule evaluation and the signal-enrichment UI should exclude the INT family (verify family filtering; today families are display-grouped, not access-controlled).
- UI badge color map (queue `prospectQueueStageMaps.ts` / family colors) gains an INT color.

**GAP-S2 · Evidence-safety enforcement (severity: MEDIUM — behavioral, not structural)**

§31 prohibitions (don't convert "website not found during discovery" into `WC_MISSING_WEBSITE`; don't treat CARFAX review counts as total reviews) are prompt-contract and code-review concerns, not enforceable by the Zod layer — **except** that the new output schema can and should *structurally prevent* the main failure mode by (a) not including any `detected_signals`/Business-Audit fields at all, and (b) scoping source evidence under `discovery_provenance[].evidence_types` with an enum drawn from the profile capability vocabulary. Schema-level omission is the strongest available guarantee and should be called out in the sprint's test plan.

### 4.5 Output contract

**GAP-O1 · `intelligence_discovery` output schema (severity: HIGH, effort: MEDIUM)**

New Zod schema (new validator module, e.g. `apps/api/src/validators/intelligence-discovery.schema.ts`) + entry in `OUTPUT_SCHEMA_REGISTRY` + `INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX`. Shape = §33 minimum object + run-level fields (`intelligence_mode`, `focus`, profile echo, saturation summary, excluded-count rollup for §57). Recommended `auditPlatform: 'intelligence_discovery'` so imports land in `mkt_audits_list` like every other analysis type, and the existing external-import endpoint works unchanged for offline PoC runs — important because current practice (per `docs/LocalBiz/Audit Prompts/`) is to run prompts in external LLM interfaces and import JSON. Follow existing conventions: tolerant enum preprocessors, `.passthrough()`, coercion helpers (mirror `city-category-opportunity.schema.ts`). Include a cross-field refinement: candidates with `identity_confidence` conflicts or `category_fit = 'insufficient'` must have `business_seek_priority = 'hold'` or `business_seek_recommended = false` (§26, §38).

### 4.6 Ownership and geography deltas

**GAP-G1 · `outside_market` classification (severity: LOW)**

Spec §24's rule ("`outside_market` businesses must not appear in the final qualifying set") is already implemented V3-style: the prompt emits the classification but excludes such rows from output, and the validator documents this at L153. For the new intelligence schema, copy the same pattern (enum value + exclusion rule); no change to existing schemas (§44).

**GAP-G2 · Ownership exclusion breadth (severity: LOW)**

Spec §25 excludes national chains, national franchises, **and regional multi-state chains**. The only coded exclusion today skips `national_chain` in hot-prospect sync (config-gated). The intelligence prompt carries the primary exclusion duty (inherited Category Base rules); if backend filtering of discoveries is desired, extend the queue-ingestion path to drop/hold `national_chain`, `franchise`, `regional_chain` per the profile/run config. The ownership enum itself already has all needed values.

### 4.7 Frontend

**GAP-F1 · Scope + focus selection (severity: MEDIUM, effort: LOW–MEDIUM)**

- `CampaignFormClient.tsx` scope dropdown gains Intelligence; when selected, show Category/City/State + Focus radio (Emerging/Competitive) + advanced ZIP/radius inputs. Profile resolution stays invisible (§56).
- Prompt library: scope filter gains the new value; if Option A (fragments), decide whether fragments are hidden from the library list or shown with a distinct badge.

**GAP-F2 · Intelligence results UI (severity: MEDIUM, effort: MEDIUM)**

New `IntelligenceDiscoveryAuditCard` following the established audit-card pattern (copy `CityCategoryAnalysisAuditCard` structure): run summary header (§57 counts: discovered / recommended / held / excluded, profile + version + mode + focus), candidate table sorted by priority, per-row badges for `INT_*` signals and provenance source count, `why_discovered` expandable, and per-row actions reusing existing handlers — **Queue** (`addToQueue` with new fields) and **Campaign** (`deriveBusinessCampaign` with discovery context). `hold` rows render disabled actions with a tooltip. Admin/advanced view exposes profile/prompt versions and mode per §56.

### 4.8 Observability

**GAP-B1 · Run + source metrics (severity: LOW for MVP)**

The §58 capture list maps onto fields already proposed above (run record + candidate rows). The future source→campaign conversion funnel needs no new infrastructure beyond keeping `intelligence_run_id` on queue entries and `parent_campaign_id` on campaigns — both already in the plan. No metrics pipeline work required for MVP beyond recording the fields.

---

## 5. Consolidated Gap Register

| # | Gap | Layer | Severity | Effort | Blocks MVP? |
|---|---|---|---|---|---|
| GAP-P1 | No prompt composition (fragments or generated assembly) | Prompt | High | M | **Yes** (spec §3 core decision; Option B mitigates) |
| GAP-P2 | `intelligence` absent from scope system (types, variables, compat, queue, UI) | Cross-cutting | High | L | **Yes** |
| GAP-P3 | Focus parameter (`emerging`/`competitive`) | Prompt/Runtime | Medium | L | **Yes** |
| GAP-P4 | Prompt-version provenance unreliable (in-place template mutation; no snapshot on execution) | Data/Runtime | High | S | **Yes** (§42 acceptance criterion) |
| GAP-P5 | Category Intelligence Profile store + resolver + immutable versioning | Data/Service | High | M | **Yes** |
| GAP-P6 | Generic fallback template + `intelligence_mode` disclosure | Prompt/Runtime | Medium | L | **Yes** (§20) |
| GAP-E1 | Intelligence run record (run fields + lineage handle) | Data | High | M | **Yes** (§41) |
| GAP-E2 | Discovered-business persistence (queue extension: category_fit, identity_confidence, provenance, seek priority incl. `hold`, run FK) | Data | High | M | **Yes** |
| GAP-E3 | Handoff carries discovery context; lineage queryable end-to-end | Service | Medium | L | **Yes** (§39) |
| GAP-S1 | `INT_` signal family + triage/UI separation guardrails (5 of 11 codes are renames of V3 `EF_*`; do not reuse the DS alias) | Service | Medium | L | **Yes** (§30) |
| GAP-S2 | Evidence-safety enforcement (schema omission + test plan; V3 prompt already states the rule) | Validator | Medium | S | **Yes** (§31) |
| GAP-O1 | `intelligence_discovery` output schema + registry entry + prompt suffix (slimmer than V3's contract — no benchmarks/tiers/fees per §22) | Validator | High | M | **Yes** |
| GAP-G1 | `outside_market` classification + exclusion filter (pattern exists in V3) | Validator | Low | S | Yes (small) |
| GAP-G2 | Broader ownership exclusion (franchise/regional) on ingestion (prompt-level rule already in V3) | Service | Low | S | Optional |
| GAP-F1 | Scope + focus selection UI | Frontend | Medium | L–M | **Yes** |
| GAP-F2 | Intelligence results card + candidate actions | Frontend | Medium | M | **Yes** |
| GAP-P7 | Profile-amplified business prompt resolution (resolvePrompt seam + business profile block + provenance stamping) — vision §1B | Service | Medium | L–M | Vision ext. |
| GAP-P8 | Profile-establishment loop (establishment template + profile output schema + import persistence hook + draft/activate lifecycle) — vision §1D, pulls spec §51/§52 forward | Service/Validator | Medium | M | Vision ext. |
| GAP-F3 | Prompt Workspace resolution indicator ("resolved with auto_repair_us v1") — vision §1B | Frontend | Low | S | Vision ext. |
| GAP-B1 | Observability fields (focus/profile/mode/source rollups) | Data | Low | S | Partially (§58 capture) |

**Not gaps (confirmed reusable):** geographic enum core values; ownership enum; identity-confidence vocabulary; dedup mechanics; Business Seek handoff mechanism; external-import execution path; audit storage; prompt-suffix pattern; scope-compat enforcement pattern; campaign-anchored run model; queue→campaign conversion path; backward compatibility constraints (all changes are additive).

---

## 6. Recommended Build Plan (mapped to spec §62 deliverables)

Sequenced by dependency. Naming follows repo conventions (`apps/api/src/services/…`, migration numbering continues at 194).

**Workstream 1 — Provenance foundation (unblocks everything; benefits existing scopes)**
1. Migration `194_mkt_execution_prompt_snapshot.sql`: add `template_version`, `template_body_hash` (or full snapshot) to `mkt_prompt_executions_list`; populate at execution + external-import time. *(GAP-P4)*
2. Establish the canonical Category Base as a first-class asset (recommendation: extract the shared rule sections from the V2 doc text — the same text V3 references — rather than the shorter DB seed `mpt-seed-seek-002`). *(prereq for GAP-P1)*

**Workstream 2 — Scope + profile plumbing**
3. Add `intelligence` to `CampaignScope`, `PromptScope`, `SCOPE_VARIABLES` (incl. `focus`, `zip_codes`, `search_radius_miles` as intelligence-scope variables), queue `source_scope`, UI selectors. *(GAP-P2, P3)*
4. Migration `195_mkt_intelligence_profiles.sql` + `IntelligenceProfileService` (resolve by category, getVersion, immutable versions, renderProfileBlock). Seed `auto_repair_us v1` with the CARFAX source model per §46. *(GAP-P5)*
5. Generic fallback asset + resolver null-path stamping `intelligence_mode`. *(GAP-P6)*

**Workstream 3 — Prompt assembly + cross-scope resolution**
6. Chosen composition path (Option A composer service, or Option B generator producing `scope: 'intelligence'` templates). Assets: category base, intelligence extension, focus_emerging, focus_competitive. **Note:** the §1B vision (profile-amplified business resolution) strengthens the case for Option A — see §1B impact analysis. *(GAP-P1, P3)*
7. `resolvePrompt()` seam in `MarketingExecutionService` + `renderBusinessProfileBlock` + execution/import provenance stamping; no-profile regression test (byte-identical base render). *(GAP-P7)*
8. Seed Intelligence templates with `output_schema = {"name": "intelligence_discovery"}`.

**Workstream 4 — Output + persistence**
9. `intelligence-discovery.schema.ts` + registry entry + prompt suffix + hold/cross-field refinements + `outside_market` handling. *(GAP-O1, G1, S2)*
9a. Profile-establishment loop: establishment template + `category-intelligence-profile.schema.ts` + import persistence hook (draft) + minimal activate action. *(GAP-P8 — vision §1D; can trail MVP if sprint capacity is tight, since `auto_repair_us v1` is seeded directly)*
10. Migration `196_mkt_prospect_queue_intelligence.sql` (new columns + `intelligence_seek` source kind) + queue service ingestion from imported intelligence audits. *(GAP-E2, G2)*
11. Migration `197_mkt_intelligence_runs.sql` (or decided alternative) + run record creation on execution/import. *(GAP-E1)*
12. `INT_` signal registry seeds + triage/UI family separation. *(GAP-S1)*
13. Handoff: extend `deriveBusinessCampaign` / `createCampaignFromQueue` to carry discovery context + run lineage. *(GAP-E3)*

**Workstream 5 — Frontend**
14. Campaign form: Intelligence scope + focus + advanced inputs. *(GAP-F1)*
15. `IntelligenceDiscoveryAuditCard` + queue/derive actions + run summary header; queue UI badges for INT signals and provenance. *(GAP-F2)*
16. Prompt Workspace resolution indicator for profile-amplified business prompts. *(GAP-F3)*

**Workstream 6 — Validation sprint test (spec §61)**
17. Run matrix: Legacy Category V3 (`mpt-6vrf6xtz`, as-is per §45) vs Intelligence Emerging vs Intelligence Competitive × {Zionsville, Plainfield} × Auto Repair; capture §61 metrics from the new observability fields. **A V3 baseline for the exact PoC cell already exists:** `errors/zionsville-category-import-chatgpt.md` is a V3 Auto Repair / Zionsville run dated 2026-08-13 — the §61 "V3 vs Intelligence Emerging, Zionsville" comparison can start immediately once the Intelligence side produces its first run.
18. Regression: existing category/business executions + external imports unchanged (assert via existing test suites + spot runs); V3's EF/DS signal aliases must continue flowing to the hook library untouched; business audits in categories without a profile must render byte-identical to today.
19. Vision-extension spot check: run a business audit for a Zionsville Auto Repair prospect with `auto_repair_us v1` active and verify the resolved prompt contains the CARFAX capability/limitation block and the execution record carries `profile_id`/`profile_version`.

**Suggested test additions** (mirroring existing patterns in `apps/api/src/services/__tests__/` and `apps/api/src/tests/`): schema validator tests (enum coercion, hold refinement, provenance shape, no-Business-signal-fields), profile service tests (resolve/version immutability/fallback), route tests for the queue-ingestion and run-record paths, and a scope-compat test proving intelligence templates reject non-intelligence campaigns.

---

## 7. MVP Acceptance Criteria Mapping (spec §59)

| Criterion | Status today | Closed by |
|---|---|---|
| `intelligence` valid Seek scope | ✗ | GAP-P2 |
| Existing scopes remain operational | ✓ (must regression-test) | Workstream 6 |
| Prompts extend Category framework, not duplicated | ✗ no composition | GAP-P1 + canonical base decision |
| Composition includes all 4 components | ✗ | GAP-P1, P5 |
| Accepts category/city/state/focus | partial (no focus) | GAP-P2, P3 |
| Focus `emerging` / `competitive` | partial — emerging behavior exists as V3 monolith; not a modifier | GAP-P3, P1 |
| Run records prompt_version | ✗ (unreliable for all scopes) | GAP-P4 |
| Run records profile_version | ✗ | GAP-E1 |
| Profile defines specialized sources | ✗ | GAP-P5 |
| Source capabilities / prohibited inferences | ✗ | GAP-P5 (JSON structure) |
| Generic fallback | ✗ | GAP-P6 |
| Returns qualifying discovered businesses | ✗ | GAP-O1 |
| Candidates: category fit | ✗ | GAP-O1, E2 |
| Candidates: identity confidence | vocabulary ✓, discovery-level ✗ | GAP-O1, E2 |
| Candidates: location status | ✓ reusable enum | GAP-O1 |
| Candidates: discovery signals | partial — V3 `EF_*` precursor exists; INT family new | GAP-S1, O1 |
| Candidates: discovery provenance | ✗ | GAP-E2, O1 |
| Candidates: Business Seek recommendation + priority | partial (category schema analog exists) | GAP-O1, E2 |
| Signal families stay separate | ✗ — V3 mixes EF + RA/DS/WC; migration 191 aliased EF→DS | GAP-S1 |
| Missing evidence ≠ deficiency | prompt-level rule ✓ in V3, enforcement ✗ | GAP-S2, O1 |
| Chain/franchise exclusion | partial (national only, sync path only) | GAP-G2 + prompt base |
| Deduplication | ✓ queue dedup exists | reuse |
| Candidate launches Business Seek | ✓ mechanism exists (`deriveBusinessCampaign`, queue→campaign) | GAP-E3 wiring |
| Optional Intelligence parentage on Business Seek | ✗ | GAP-E3 |
| Legacy Business Seek callers compatible | ✓ (additive-only changes) | design constraint |
| No mandatory Category V2/V3 modification | ✓ | design constraint |

---

## 8. Open Questions for the Team

1. ~~What exactly is "Category V3"?~~ **Resolved:** V3 = DB template `mpt-6vrf6xtz` (emerging-discovery monolith); see §1A. The §61 baseline is this template, unmodified (§45).
2. **Composition: runtime fragments (Option A) vs. generated monoliths (Option B)?** A is architecturally truer to §49; B ships the PoC faster. See §4.1.
3. ~~Where do runs execute?~~ **Partially resolved (§1C):** both paths are intended — internal AI *or* external AI run from the backend-resolved campaign prompt, with identical provenance either way. Remaining sub-question: internal execution currently uses the configured chat model (default `gpt-4o-mini`) with `maxTokens: 2000` and a fixed system message — realistic intelligence runs need per-execution model/token configuration before path A is viable (see question 11).
4. **Signal naming:** adopt `INT_*` as canonical for the new scope while V3 keeps emitting `EF_*`/`DS_ZERO_INDEXED_PRESENCE` aliases (recommended per §45), or re-map the existing alias? Also confirm the hook library (`emerging-angle-map.ts`) never needs to consume INT codes — if it does, that's a deliberate exception to §30 to document.
5. **New `mkt_intelligence_runs` table vs. columns/metadata on executions?** Recommendation in §4.3 (E1); needs team sign-off.
6. **Profile authoring ownership:** `auto_repair_us v1` should still be hand-seeded for the PoC (critical-path content task) even though §1D adds the bootstrap loop — the loop's own establishment template needs a known-good profile format to validate against. Who approves `prohibited_inferences`? Who activates draft profiles (GAP-P8)?
7. **Queue vs. new `business_discoveries` table:** this analysis recommends extending `mkt_prospect_queue` (spec §55 permits); confirm the queue's operator workflow (assign/dismiss/priority) is desired for discoveries, since it comes along with the substrate.
8. **CARFAX access:** the profile assumes CARFAX-sourced evidence is reachable by the executing model. Confirm the research channel (external LLM with browsing? in-platform model with tools?) can actually reach it — this affects the §61 test design more than the code.
9. **V3's signal mixing:** V3 emits Business-Audit signals from a discovery audit. The spec forbids this for Intelligence (§22, §30). Confirm the team accepts the slimmer Intelligence output (no benchmarks, tiers, fees, or audit signals) rather than expecting V3-parity richness — §57's summary UI implies the slimmer shape.
10. **Scope of profile amplification (vision §1B):** should the business-resolution injection apply to *all* business-scope prompt types (`seek`, `fulfill`, `retainer`) or only `seek` business audits initially? Fulfill prompts (e.g. GBP optimization, service menus) plausibly benefit from category terminology too, but starting with `seek` keeps the blast radius small.
11. **Token budget:** in-platform executions currently cap `maxTokens: 2000` (`executeSingle` L145) — far below what a full business-audit JSON requires, which is presumably why audits flow through external import. If profile-amplified prompts make in-platform execution more attractive, model + token configuration per execution becomes a real requirement (related to question 3).

---

*Prepared from direct code inspection of the marketing-ops seek pipeline (prompt templates, execution service, output-schema registry, prospect queue, signal taxonomy, campaign service, admin UI). All file/line references verified 2026-08-14.*
