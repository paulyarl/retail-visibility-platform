# Sprint Plan: Gold Standard System — Sprint 0 (Foundational Prerequisite)

**Document Version:** 1.1
**Date:** 2026-08-20
**Status:** Ready for Sprint Planning

---

## 0. Pre-Flight Checklist (Start-of-Phase)

Run before writing any code. Mirrors
`.devin/skills/start-of-phase-sprint-checklist.md`.

### 0.1 Hard Rule — TypeScript Checks at Phase End

```bash
pnpm checkapi   # tsc --noEmit --project apps/api
pnpm checkweb   # tsc --noEmit --project apps/web
```

Zero new errors on both. Non-negotiable. Plan time at the end of every
session to run checks and fix errors before committing.

### 0.2 Singleton Service Strategy

**Skill:** `deploy-service-extending-base-singleton.md`

| Service | Audience | Base | Status |
|---------|----------|------|--------|
| `MarketingOpsService` (frontend) | Admin platform panel | `AdminApiSingleton` | Existing — extend with new methods |
| `IntelligenceProfileService` (backend) | Internal | `BaseService` | Existing — extend with `serializeGoldStandard`, `buildGoldStandardScanVariables` |
| `MarketingPromptService` (backend) | Internal | Existing | Existing — extend `importExternalResult` hook |
| `MarketingExecutionService` (backend) | Internal | Existing | Existing — extend `resolvePrompt` for dual injection |
| `MarketingCampaignService` (backend) | Internal | Existing | Existing — extend to persist `intelligence_platform` |

- [ ] No new frontend services — `MarketingOpsService` is extended
- [ ] No direct `fetch` — all new frontend calls go through
  `MarketingOpsService` methods on `AdminApiSingleton`
- [ ] No new backend singletons — all services are existing, extended
  in place

### 0.3 Skill Document Awareness

**Skills to read before starting:**

| Skill | Why |
|-------|-----|
| `manual-sql-migration-policy.md` | Migrations 234/235/236 — must follow the hand-written SQL + `prisma db pull` workflow, never edit `schema.prisma` directly |
| `vitest-hoisted-mock-pattern.md` | All new tests — must use `vi.hoisted()` for mock factories that reference variables |
| `marketing-ops-scope-aware-campaigns.md` | Campaign form changes — the scope/focus/kind pattern is documented here |
| `deploy-service-extending-base-singleton.md` | Frontend service extensions — confirms `AdminApiSingleton` pattern |
| `structured-logging.md` | Logger usage in new service methods — `logger.method(message, undefined, { ...meta })` |

**Skills to update after completion (mandatory):**

| Skill | Section to update | What to capture |
|-------|-------------------|-----------------|
| `marketing-ops-scope-aware-campaigns.md` | Scope/focus/kind section | Add `gold_standards` as third focus; add platform dropdown; document the six combinations |
| `marketing-ops-archetype-resolution.md` | If it covers prompt resolution | Add dual injection pattern (intelligence profile + gold standard benchmark) |

**New skill to create (if any):** None — the gold standard patterns are
documented in `PLATFORM_OFFERING_ARCHITECTURE.md` §5 and §10, not in a
skill. The architecture doc is the reference, not a skill file.

### 0.4 Tenant-Scoped ID Planning

**Skill:** `tenant-scoped-id-generation.md`

- [ ] **No new entities** — gold standards reuse
  `mkt_intelligence_profiles` (existing ID generator:
  `generateIntelligenceProfileId()` → `mip-{nanoid}`)
- [ ] **No new ID generators needed** — gold standard scan executions
  reuse the existing prompt execution ID pattern
  (`mkt_prompt_executions_list`)
- [ ] **No `randomUUID()` patterns to migrate** — all new code uses
  existing generators

### 0.5 Navigation & Page Planning

**Skill:** `database-navigation-system.md`

- [ ] **No new pages or routes** — the sprint extends three existing
  pages:
  - `IntelligenceProfilesClient.tsx` — add Gold Standard Profiles list
  - `CampaignFormClient.tsx` — add `gold_standards` focus + platform
    dropdown
  - `CampaignDetailClient.tsx` — add discovery/establishment panels
- [ ] **No new sidebar links** — all pages are already linked from the
  Marketing Ops admin section
- [ ] **No new settings cards** — the Intelligence Profiles page is
  already accessible from the admin settings
- [ ] **No SQL INSERTs for `navigation_links`** — no new navigation

### 0.6 Backend Architecture Planning

- [ ] **No new route files** — all new functionality is exposed via
  existing endpoints:
  - `GET /intelligence-profiles` — extend with optional `focus` query
    parameter for filtering by `intelligence_focus`
  - `POST /prompts/executions/external` — already exists, the
    post-import hook extension is internal to
    `MarketingPromptService.importExternalResult`
  - `POST /intelligence-profiles/:id/:version/activate` — already
    exists, used unchanged for gold standard profile activation
- [ ] **No new background jobs** — gold standard scans run via the
  existing prompt execution pipeline (AI path or external import)
- [ ] **Logger usage** — all new service methods use
  `logger.method(message, undefined, { ...meta })` per
  `structured-logging.md`
- [ ] **Existing services to modify:**

| Service | Changes | Cache implications |
|---------|---------|-------------------|
| `IntelligenceProfileService` | Add `serializeGoldStandard()`, `buildGoldStandardScanVariables()`, extend `resolve()` for gold_standards focus, extend `listActive()`/`listDrafts()` with optional focus filter | None — backend service, no frontend cache |
| `MarketingPromptService` | Add post-import hook for `gold_standard_scan` schema in `importExternalResult` | None |
| `MarketingExecutionService` | Add gold standard resolution to `resolvePrompt` (dual injection) | None |
| `MarketingCampaignService` | Extend create/update to persist `intelligence_platform` | Campaign list cache may need invalidation after update — verify |
| `ProfileRepairPromptService` | May need to extend variable builders if the gold standard scan uses a separate builder | None |

### 0.7 Database & Migration Planning

**Skill:** `manual-sql-migration-policy.md`

- [ ] **Migration files** (latest in repo: `233_prompt_execution_error_message.sql`):

| Migration | Type | Purpose |
|-----------|------|---------|
| `234_mkt_intelligence_platform_column.sql` | DDL | Add `intelligence_platform` nullable `VARCHAR(20)` to `mkt_campaigns_list` |
| `235_mkt_gold_standard_scan_prompt.sql` | Data | Seed `mpt-gold-standard-scan` prompt template row |
| `236_mkt_business_audit_prompt_url_capture.sql` | Data | Update business audit prompt body to instruct URL capture |

- [ ] **No new tables** — gold standards reuse
  `mkt_intelligence_profiles`
- [ ] **Idempotency** — DDL wrapped in `DO$$ BEGIN ... EXCEPTION WHEN OTHERS THEN END $$;`; INSERTs use `INSERT ... SELECT ... WHERE NOT EXISTS`
- [ ] **Prisma introspection** — after applying migration 234, run `doppler run --config local -- pnpm prisma db pull && doppler run --config local -- pnpm prisma generate` to update `schema.prisma` and TypeScript types. **Never edit `schema.prisma` directly.**
- [ ] **`mkt_*` exception** — marketing ops tables do NOT enable RLS and do NOT use explicit `updated_at` triggers (per `manual-sql-migration-policy.md`)
- [ ] **No materialized views to rebuild**

### 0.8 Frontend Architecture Planning

- [ ] **New components:**

| Component | Type | States needed |
|-----------|------|---------------|
| `GoldStandardDiscoveryPanel.tsx` | Client | Loading (scan running), empty (no execution), no-candidates, populated (candidate table), error |
| `GoldStandardEstablishmentPanel.tsx` | Client | Loading, empty (not imported), draft (review + activate), active, error |

- [ ] **Existing components to extend:**

| Component | Changes |
|-----------|---------|
| `IntelligenceProfilesClient.tsx` | Add Gold Standard Profiles list group (separate from Seek Profiles), platform badges, destination URL links, review view with candidate cards |
| `CampaignFormClient.tsx` | Add `gold_standards` focus radio, platform dropdown (conditional), make City optional when focus = gold_standards, update title auto-fill |
| `CampaignDetailClient.tsx` | Conditionally render `GoldStandardDiscoveryPanel` or `GoldStandardEstablishmentPanel` based on focus + kind |

- [ ] **React Query cache keys** — the new panels use
  `marketingOpsService.listExecutions({ campaignId })` (existing
  pattern). No new cache keys needed — the existing
  `listExecutions` cache key includes `campaignId`.
- [ ] **SSR safety** — no `localStorage` / `window` access in new
  components
- [ ] **Frontend service methods to add:**

| Method | Endpoint | Cache key |
|--------|----------|-----------|
| `listIntelligenceProfiles({ focus? })` | `GET /intelligence-profiles?focus=...` | `['intel-profiles', focus?]` |
| (existing) `activateIntelligenceProfileDraft(id, version)` | `POST /intelligence-profiles/:id/:version/activate` | Invalidates `['intel-profiles']` |

### 0.9 Capability System Planning

- [ ] **No new capability features** — gold standards are infrastructure,
  not a capability-gated feature. They don't appear in the plan/tier
  hierarchy. All marketing ops admin features are platform-scoped (not
  tenant-scoped capabilities).
- [ ] **No capability constraints** — no cross-capability dependencies
- [ ] **No frontend fallback resolver changes** — no new resolver logic

### 0.10 Design Doc & Memory Planning

- [ ] **Design doc:** this sprint plan + `PLATFORM_OFFERING_ARCHITECTURE.md`
  §5 + `PROFILE_REPAIR_PRODUCT_SPEC.md` §4 — all read and current
- [ ] **Memory entry:** at sprint completion, summarize: gold standard
  system built, key files, dual injection pattern, campaign modal
  changes, next steps (SOP module, retainer drift, branding prompt
  family). Tags: `gold-standard`, `sprint-0`, `complete`.
- [ ] **No existing memories to check** — this is the first gold
  standard sprint

### 0.11 Pre-Flight Summary

```
Phase/Sprint: Gold Standard System — Sprint 0 (Foundational Prerequisite)
Design doc: docs/LocalBiz/gold_standard_sprint_plan.md
            docs/LocalBiz/PLATFORM_OFFERING_ARCHITECTURE.md (§5, §10)
            docs/LocalBiz/PROFILE_REPAIR_PRODUCT_SPEC.md (§4, §9)

New services: None (all existing services extended in place)
New entities: None (gold standards reuse mkt_intelligence_profiles)
New ID generators needed: None (reuse generateIntelligenceProfileId)
New pages/routes: None (extend 3 existing pages)
New sidebar links: None
New settings cards: None
New migrations: 234 (intelligence_platform column), 235 (scan prompt seed), 236 (audit prompt URL capture)
New background jobs: None
New capability features: None
New components: GoldStandardDiscoveryPanel, GoldStandardEstablishmentPanel

Skills to read before starting:
  - manual-sql-migration-policy.md (migration conventions)
  - vitest-hoisted-mock-pattern.md (test mock patterns)
  - marketing-ops-scope-aware-campaigns.md (scope/focus/kind pattern)
  - deploy-service-extending-base-singleton.md (frontend service pattern)
  - structured-logging.md (logger usage)

Skills to update after completion (mandatory):
  - marketing-ops-scope-aware-campaigns.md — add gold_standards focus + platform dropdown + six combinations
  - marketing-ops-archetype-resolution.md — add dual injection pattern (if it covers prompt resolution)

Insights to capture in skills:
  - Dual injection pattern: resolve intelligence profile + gold standard in sequence, inject as separate variables, fallback to empty string if either missing
  - Gold standard scan: platform-focused (mirrors seek's city focus), nationwide, per-platform candidate evaluation
  - Campaign naming: Category + Kind + Focus + platform-label (platform replaces city as focus dimension for gold standards)

New skill to create: None (patterns documented in architecture doc, not skills)
```

**Source specs:**
- `docs/LocalBiz/PLATFORM_OFFERING_ARCHITECTURE.md` (§1.1, §2.0, §5, §6, §8.5)
- `docs/LocalBiz/PROFILE_REPAIR_PRODUCT_SPEC.md` (§4, §10.0, §10.3, §10.4a)

**Codebase baseline:** `retail-visibility-platform` @ migrations through `233_prompt_execution_error_message.sql`; Profile Repair Integration Spec P1 shipped; Prompt Variable Injection sprint shipped (`ProfileRepairPromptService`, `resolvePrompt()` amplification seam, output schema registry).

**Prerequisite:** Prompt Variable Injection sprint complete (the `resolvePrompt()` amplification seam, `SCOPE_VARIABLES`, `OUTPUT_SCHEMA_REGISTRY`, and `ProfileRepairPromptService` variable-builder pattern exist).

**Companion docs:**
- `docs/LocalBiz/PLATFORM_OFFERING_ARCHITECTURE.md` (base architecture — §5 gold standard system, §6 SOP module, §8.5 URL capture)
- `docs/LocalBiz/PROFILE_REPAIR_PRODUCT_SPEC.md` (product spec — §4 gold standard pattern matching, §10.3 infrastructure gap)

---

## 1. Executive Summary

Gold standards have been elevated to a **critical architectural
addition**. They sit at the top of the flow — before the business audit,
before the seek, before the fulfill. The gold standard is the first
thing that needs to exist for a category: the establishment campaign
creates the profile, the operator activates it, and only then can
discovery and downstream audits use it. Without an active gold standard
for a category, the entire downstream pipeline runs degraded:

- The audit is raw data collection without category-aware gap analysis
- The seek briefing is less specific (no benchmark to compare against)
- The fulfill fix sheet lacks concrete target values and pattern exemplars

This sprint builds the gold standard system as **Sprint 0** — the prerequisite sprint that makes everything downstream richer. The work is:

1. **Gold standard scan prompt + schema** — a new prompt type (`mpt-gold-standard-scan`) with output schema (`gold_standard_scan`) that discovers category-specific target state across platforms, including destination URLs as an intentional focus
2. **Storage and lifecycle** — gold standards stored in `mkt_intelligence_profiles` with `expected_fields` + `gold_standards` blocks in `configuration_json`, using the existing draft → active → retired lifecycle
3. **Curation UX** — the Intelligence Profiles admin page extended with a separate Gold Standard Profiles list (filterable by category, platform, type), review view with candidate cards, and activation flow
4. **Serialization function** — `serializeGoldStandard(category, role)` with the `role` parameter (`'benchmark'` for audit, `'target'` for fulfill) that produces platform-keyed text blocks with explicit platform directives and destination URLs
5. **Dual injection** — the audit prompt's resolution step resolves both the intelligence profile AND the gold standard profile; the fulfill prompt already resolves the gold standard (this sprint adds the `role` parameter and platform directive)
6. **Destination URL capture** — both the gold standard scan and the business audit capture live profile URLs as an intentional focus, not an afterthought

No new tables. Gold standards reuse `mkt_intelligence_profiles`. No new pipeline architecture — the scan uses the existing prompt execution + external import paths. The work is one new prompt type, one new output schema, one new serialization function, one admin page extension, and the dual injection wiring.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer

---

## 2. Problem Statement

### 2.1 No gold standard system exists

The Profile Repair spec (§4) and the Platform Offering Architecture (§5) define gold standards as the target state for a category — both data (expected field values per platform) and pattern (concrete exemplar businesses). But no infrastructure exists to:

- Scan for gold standards (no prompt, no schema)
- Store them (the `mkt_intelligence_profiles` table exists but has no `expected_fields` or `gold_standards` blocks in any profile's `configuration_json`)
- Curate them (the admin page has no Gold Standard Profiles list)
- Serialize them (no `serializeGoldStandard` function)
- Inject them (the audit prompt doesn't resolve a gold standard; the fulfill prompt has no gold standard to resolve)

### 2.2 The audit runs without category-aware benchmarking

The `business_analysis` audit collects raw data (NAP, categories, photos, claim status) and flags generic issues ("primary_category not set"). Without a gold standard benchmark, the audit cannot say "primary_category is 'Grocery store' but the category gold standard for African grocery stores sets it to 'African goods store' — this reduces discoverability for diaspora customers." The audit is data collection, not gap analysis.

### 2.3 The fulfill runs without concrete targets

The `mpt-profile-repair-citation-package-fulfill` prompt has a `gold_standard` variable in its declared scope, but nothing sources it. The fix sheet is generated from raw audit data + seek briefing alone — no expected field values, no pattern exemplar, no destination URL for verification.

### 2.4 Destination URLs are not captured

The existing `business_analysis` audit schema (`apps/api/src/validators/business-analysis.schema.ts`) has no `profile_url` field on `platformSchema` (line 274) or `googlePlatformSchema` (line 288). The audit captures `profile_status`, `rating`, `categories`, `displayed_name/address/phone` — but not the live profile URL. The operator cannot verify audit findings by clicking through to the live profile.

---

## 3. Design Decisions

### 3.1 Gold standards reuse `mkt_intelligence_profiles`

No new table. Gold standards are stored as intelligence profiles with `reference_city = NULL` (city-agnostic) and `expected_fields` + `gold_standards` blocks in `configuration_json`. The existing draft → active → retired lifecycle and `activateIntelligenceProfileDraft` endpoint apply unchanged.

**Rationale:** the seek/fulfill parallel (architecture §2) is built on the same table, same lifecycle, same activation gate. A new table would break the symmetry and require duplicate curation UX.

### 3.2 The scan is a new prompt type, not a campaign

The gold standard scan (`mpt-gold-standard-scan`) is a new prompt type with `prompt_type = 'seek'`. It's category-only — not tied to a specific campaign or business. The scan searches nationwide for well-optimized businesses in a category and produces both `expected_fields` and `candidates` in a single pass.

**Rationale:** gold standards are category-specific, not business-specific. Tying the scan to a campaign would couple the target state to a specific business's audit, which is wrong — the gold standard is the target for the category, not for one business.

### 3.3 `serializeGoldStandard` accepts a `role` parameter

The same resolved profile is injected into two prompts with different roles:
- `role='benchmark'` → audit prompt → "compare the business against this" directive
- `role='target'` → fulfill prompt → "fix the business toward this" directive

The role determines the platform directive prepended to each platform block in the serialized output. Same data, same destination URLs, different instruction to the model.

**Rationale:** the AI model needs an explicit directive telling it what to do with the gold standard data for each platform. Without it, the model has to infer whether the data is a benchmark or a target.

### 3.4 Destination URLs are a required field, not optional

Every gold standard candidate must have a `destination_url` — the live profile URL on the platform. The scan prompt explicitly instructs the model to capture URLs as an intentional focus. If the URL cannot be found, the field is set to null and noted in the rationale.

**Rationale:** the destination URL is the verification anchor. It lets the operator confirm the scan's assessment by visiting the live profile, and it's shown wherever the candidate appears (admin cards, review view, fulfill output, deliverable). The AI model can also browse the URL during generation if it has web access.

### 3.5 The admin page hosts two separate lists

The Intelligence Profiles admin page (`IntelligenceProfilesClient.tsx`) is extended with a second list group: Gold Standard Profiles. The two lists (Seek Profiles + Gold Standard Profiles) don't mix. Each has its own Draft and Active sections, its own filter bar (category, platform, type, search), and its own review view.

**Rationale:** seek profiles and gold standard profiles serve different purposes (city-aware vs. platform-aware), have different review tasks (terminology/sources vs. candidates/expected fields), and answer different coverage questions. Mixing them would make it harder for the operator to confirm coverage before running a campaign.

### 3.6 Gold standards are a third Focus in the campaign creation modal

When creating a new campaign, the operator selects a **Scope** from a
dropdown. When the scope is `intelligence`, the modal expands to show
**Focus** and **Campaign Kind** fields. Gold standards are added as a
third Focus option — no new scope, no new campaign kind.

**Current campaign creation modal (intelligence scope):**

| Field | Options |
|-------|---------|
| Scope | `business` · `category` · `city` · `intelligence` |
| Focus (intelligence only) | `emerging` · `competitive` |
| Campaign Kind (intelligence only) | `discovery` · `establishment` |

**After this sprint:**

| Field | Options |
|-------|---------|
| Scope | `business` · `category` · `city` · `intelligence` |
| Focus (intelligence only) | `emerging` · `competitive` · **`gold_standards`** |
| Campaign Kind (intelligence only) | `discovery` · `establishment` |

The pattern is consistent across all three focuses: **discovery**
produces a **list of businesses** the operator picks from;
**establishment** **bootstraps the profile** itself.

When Focus = `gold_standards` and Campaign Kind = `establishment`, the
campaign bootstraps a **category gold standard profile** — the scan runs
nationwide (city-agnostic), evaluates candidates per-platform, and the
post-import hook stores the result as a gold standard intelligence
profile draft with `expected_fields` + `gold_standards` blocks.

When Focus = `gold_standards` and Campaign Kind = `discovery`, the
campaign produces a **list of gold standard candidate businesses** for
the category, evaluated per-platform. The operator reviews the list and
adds businesses to the category/platform gold standard slots (up to 4
per platform). A business can be added to Google's slot without being
added to Yelp's — the operator picks per-platform. This mirrors how
emerging/competitive discovery produces a list of businesses that can
be added to the prospect queue.

**The four intelligence campaign combinations become six:**

| Focus | Kind | What it produces | Operator action from results |
|-------|------|-----------------|------------------------------|
| `emerging` | `discovery` | List of emerging/low-visibility businesses | Add to prospect queue; create campaigns |
| `emerging` | `establishment` | Category-city intelligence profile | Review draft → activate seek profile |
| `competitive` | `discovery` | List of established competitors | Add to prospect queue; create campaigns |
| `competitive` | `establishment` | Category-city intelligence profile | Review draft → activate seek profile |
| `gold_standards` | `discovery` | List of gold standard candidate businesses, evaluated per-platform | Add businesses to category/platform gold standard slots (up to 4 per platform) |
| `gold_standards` | `establishment` | Category gold standard profile (expected_fields + gold_standards) | Review draft → activate gold standard profile |

**Profile flow — establishment before discovery.** The establishment
campaign runs **first**, creating the profile. The discovery campaign
runs **second**, using that profile's signals/parameters to find
businesses. This mirrors the existing intelligence (seek) flow:

| Step | Intelligence (seek) | Gold standards |
|------|---------------------|----------------|
| 1. Establishment | Run establishment campaign → creates the city/category intelligence profile (terminology, synonyms, sources, evidence rules) | Run establishment campaign → creates the category/platform gold standard profile (expected_fields, quality gates, pattern exemplars) |
| 2. Activate | Operator reviews draft → activates the seek profile | Operator reviews draft → activates the gold standard profile |
| 3. Discovery | Run discovery campaign → uses the active seek profile's signals to discover emerging/competitive businesses in that city | Run discovery campaign → uses the active gold standard profile's parameters to discover additional gold standard candidates for that platform |
| 4. Act on results | Add discovered businesses to prospect queue; create campaigns | Add discovered candidates to the category/platform gold standard slots (up to 4 per platform) |

**Why establishment first:** the discovery campaign needs the profile's
signals to know what to search for. For intelligence, the establishment
profile tells discovery what terminology, sources, and evidence rules
to use when scanning a city. For gold standards, the establishment
profile tells discovery what expected fields, quality gates, and
pattern exemplars to evaluate candidates against on a platform. Without
the profile, discovery has no category-specific context — it's just a
generic search.

**The establishment scan finds its own candidates nationwide** and
derives the expected fields + quality gates from them. The operator
curates (rejects weak candidates, activates the profile). Then discovery
runs with those parameters to find additional candidates that match the
established standard — potentially in different cities or with
different search terms. Discovery candidates are evaluated against the
active profile's gates and added to the platform slots if they qualify.

**No migration needed** — `intelligence_focus` is already `varchar(20)`
on `mkt_campaigns`, `mkt_intelligence_profiles`,
`mkt_prompt_templates`, `mkt_seek_batches`, and
`mkt_directory_presence_seeds`. The value `gold_standards` (14 chars)
fits. The gold standard scan prompt template is seeded with
`intelligence_focus = 'gold_standards'` and
`intelligence_campaign_kind = 'establishment'`.

**Title auto-fill** — the existing auto-fill logic (Category + Kind +
Focus + City, State) produces titles like "African Grocery Store -
Establishment - Gold Standards" (gold standard campaigns are
city-agnostic, so the city/state part is omitted or noted as
"Nationwide").

**Rationale:** gold standards are not a new scope — they're an
intelligence focus. They use the same campaign infrastructure, the same
prompt execution pipeline, and the same intelligence profile storage.
Adding them as a third Focus keeps the campaign creation UX consistent
and avoids introducing a new top-level concept. The operator already
understands "Scope = intelligence → pick a Focus and a Kind" — adding
`gold_standards` as a Focus is a natural extension of that mental model.

---

## 4. Implementation Plan

### 4.1 Gold standard scan schema (`gold-standard-scan.schema.ts`)

**File:** `apps/api/src/validators/gold-standard-scan.schema.ts` (new)

A Zod schema validating the scan output:
- `category_key`, `category_name`
- `expected_fields.universal` — NAP, hours, universal quality gates (presence, nap_accuracy, hours_accuracy)
- `expected_fields.platforms` — per-platform target fields (primary_category, additional_categories, required_attributes, recommended_attributes, min_photo_count, description_requirements, quality_gates, category_specific_notes) **and branding artifact fields** (has_logo, has_cover_photo, photo_types, branding_gates as recommended)
- `candidates[]` — each with `business_name`, `city`, `state`, `nap`, `platform_evaluations` (per-platform: `profile_url` (required, nullable), config including **branding artifacts** (logo present, cover photo present, photo_count, photo_types), `quality_score`, `quality_rationale`, `is_gold_standard`), `category_specific_notes`
- `scan_metadata` — scan date, sources consulted, selection criteria, platforms evaluated, expected_fields derivation

**Branding artifacts** are captured per-platform: whether the candidate
has a logo, cover photo, banners, and what photo types they have
(exterior, interior, products, team, etc.). The expected fields derive
branding gates (e.g., `has_logo: recommended`, `min_photo_count: 10`)
from what all/most gold standard candidates have. These are
non-blocking gates — the repair package fixes NAP/categories/hours, but
branding asset creation is an upsell. The gap analysis flags missing
branding so the operator can pitch the upsell with concrete evidence.

**Registration:** add to `OUTPUT_SCHEMA_REGISTRY` in `market-analysis.schema.ts`.

**Tests:** `apps/api/src/validators/__tests__/gold-standard-scan-schema.test.ts`
- Valid scan with all platforms populated
- Valid scan with partial platform coverage (some platforms null)
- Candidate with missing `profile_url` (nullable, accepted)
- Candidate with `profile_url` present (string, accepted)
- Quality gate severity derivation (non_negotiable vs. recommended)
- Per-platform `is_gold_standard` flag independence
- Rejects scan with no candidates
- Rejects candidate with no platform evaluations

### 4.2 Gold standard scan prompt template (seed)

**Table:** `mkt_prompt_templates` (seed via migration)

Seed `mpt-gold-standard-scan`:
- `prompt_type = 'seek'`
- `output_schema.name = 'gold_standard_scan'`
- `scope = 'business'` (category-level, not campaign-coupled)
- `intelligence_focus = 'gold_standards'`
- `intelligence_campaign_kind = 'establishment'` (default; discovery uses
  the same template with a different kind value)
- Declared variables: `category`, `platform` (or `all`), `max_results_per_platform`
- Prompt body instructs the model to:
  1. Search nationwide for businesses in the given category
  2. **If `platform` is specified (not `all`), focus the evaluation on
     that platform only** — evaluate candidates on that platform in
     depth (categories, attributes, photos, description, claim status,
     destination URL, **branding artifacts**). If `all`, evaluate across
     all platforms in the tier scope.
  3. Evaluate each candidate per-platform (scoring 1-10, setting
     `is_gold_standard` per platform)
  4. Return candidates that are gold standards on at least one platform
  5. **Capture the destination URL for every platform evaluation** —
     the live profile URL on each platform. Required focus. If URL not
     found, set null and note in rationale.
  6. **Capture branding artifacts per platform evaluation** — whether
     the candidate has a logo, cover photo, banners, photo count, and
     photo types (exterior, interior, products, team, etc.). Gold
     standard businesses typically have superior branding; this data
     drives branding gates and upsell opportunity identification.
  7. Derive universal `expected_fields` (canonical NAP, hours, universal
     quality gates)
  8. Derive platform-specific `expected_fields` (aggregating across gold
     standard candidates per platform, **including branding artifact
     fields**: has_logo, has_cover_photo, min_photo_count, photo_types)
  9. Derive platform-specific `quality_gates` (non-negotiable if all
     pass, recommended if most pass — **branding gates are always
     recommended/non-blocking** since branding asset creation is an
     upsell, not core repair)
  10. Capture category-specific patterns per platform

**Platform focus:** the `platform` variable makes the gold standard scan
**platform-aware** — mirroring how the seek discovery scan is
**city-aware** (the city parameter focuses the scan on a specific
market). A platform-focused scan (e.g., `platform = 'google'`) produces
higher-quality per-platform results than a broad `all`-platforms scan.
The operator can run separate scans per platform — each scan's
candidates populate that platform's slots in the gold standard profile.

**Migration:** `235_mkt_gold_standard_scan_prompt.sql` (seed the prompt template row)

### 4.3 Post-import hook

**File:** `apps/api/src/services/MarketingPromptService.ts` (extend `importExternalResult`)

When `output_schema.name === 'gold_standard_scan'`:
1. Detect the schema name
2. Store `expected_fields` block as-is into `configuration_json.expected_fields`
3. Distribute candidates into per-platform arrays in `configuration_json.gold_standards[platform][]`, keeping top 4 per platform by `quality_score`
4. Call `IntelligenceProfileService.importAsDraft()` with:
   - `categoryKey` + `categoryName` from scan output
   - `referenceCity = null` (city-agnostic, nationwide)
   - `configurationJson` with both blocks merged into any existing profile configuration
5. The profile enters as a draft — inert until the operator activates it

**Tests:** `apps/api/src/services/__tests__/gold-standard-import.test.ts`
- Import produces a draft intelligence profile with `reference_city = null`
- `expected_fields` stored correctly
- Candidates distributed per-platform (top 4 per platform)
- Re-import merges into existing profile (version bump, not replace)
- Candidate with `is_gold_standard: false` on all platforms is dropped

### 4.4 `serializeGoldStandard` function

**File:** `apps/api/src/services/IntelligenceProfileService.ts` (extend)

```ts
serializeGoldStandard(category: string, role: 'benchmark' | 'target'): string
```

1. Calls `resolve(category, undefined, undefined)` — gold standards are city-agnostic
2. Extracts `expected_fields` and `gold_standards` from `configuration_json`
3. For each platform with data:
   - Prepends the **platform directive** based on `role`:
     - `benchmark`: "This is your BENCHMARK for [platform]. Compare the business's actual [platform] profile against these expected fields and quality gates. Flag any field where the business's actual value differs from the expected value as a gap."
     - `target`: "This is your TARGET for [platform]. Generate fix instructions that move the business's [platform] profile toward these expected field values. Use the pattern exemplar as the concrete adaptation source."
   - Lists expected fields
   - Lists quality gates (non-negotiable vs. recommended)
   - Lists pattern exemplar (business name, quality score, **destination URL**, platform config)
4. Returns the serialized text block

**Fallback:** if no active gold standard exists for the category, returns empty string (the prompt runs without it — degraded but functional).

**Tests:** `apps/api/src/services/__tests__/serialize-gold-standard.test.ts`
- Serializes active gold standard with all platforms
- `role='benchmark'` produces benchmark directives
- `role='target'` produces target directives
- Destination URLs included in serialized output
- Per-platform isolation (Google data doesn't leak into Yelp block)
- Fallback: no active profile → empty string
- Fallback: no pattern for a platform → expected fields + gates only (no URL)
- Fallback: no expected fields for a platform → generic note with directive

### 4.5 Dual injection — audit prompt resolution

**File:** `apps/api/src/services/MarketingExecutionService.ts` (extend `resolvePrompt`)

The audit prompt's resolution step now resolves **two profiles**:
1. City-category intelligence profile (existing) → `{intelligence_profile}`
2. Category gold standard profile (NEW) → `{gold_standard_benchmark}`

The gold standard is resolved via `serializeGoldStandard(category, 'benchmark')` and injected as the `gold_standard_benchmark` variable. If no active gold standard exists, the variable is empty.

**Note:** the fulfill prompt's resolution does **not** currently call
`serializeGoldStandard` — this function does not exist yet (see Gap
Analysis below). This sprint builds `serializeGoldStandard` from
scratch and wires it into both the audit prompt (as benchmark) and the
fulfill prompt (as target). The existing `renderBusinessProfileBlock`
method on `IntelligenceProfileService` is the pattern to follow — it
renders a profile into a text block with a header directive.

**Tests:** `apps/api/src/services/__tests__/gold-standard-injection.test.ts`
- Audit prompt with active gold standard → `{gold_standard_benchmark}` populated with benchmark directive
- Audit prompt with no gold standard → `{gold_standard_benchmark}` empty, audit runs degraded
- Fulfill prompt with active gold standard → `{gold_standard}` populated with target directive
- Fulfill prompt with no gold standard → `{gold_standard}` empty, fulfill runs degraded
- Both profiles resolved in sequence (intelligence + gold standard)
- Seek pitch (per-issue briefing) with active gold standard → `value_preview` references the exemplar's destination URL and branding gaps
- Seek pitch with no gold standard → `value_preview` uses generic language (no exemplar reference)

**Cross-consumption — intelligence establishment and discovery also
consume gold standards.** The dual injection pattern extends beyond
the business audit to the intelligence (seek) campaigns themselves:

- **Intelligence establishment prompt** — resolves the active gold
  standard as `{gold_standard_benchmark}` alongside any other
  variables. The establishment prompt uses the gold standard's
  expected fields and pattern exemplars to inform what terminology,
  sources, and evidence rules to capture for the city/category
  intelligence profile. If the gold standard says the primary category
  should be "African goods store," the intelligence profile's
  terminology section includes that as a key search term.
- **Intelligence discovery prompt** — resolves the active gold standard
  as `{gold_standard_benchmark}` alongside the active intelligence
  profile. Discovery uses the gold standard's gates to score discovered
  businesses for quality proximity — how close each business is to the
  target state. This enriches the discovery output with a quality
  dimension beyond "found/not found."

Both fall back to running without the gold standard if no active
profile exists (degraded but functional). The gold standard enriches
the intelligence flow but is not a hard prerequisite — intelligence
establishment and discovery can run before a gold standard exists,
they just produce less category-specific results.

**Seek pitch variant — gold standard artifact in `value_preview`:**
The per-issue seek briefing (the pitch material shown before the repair
is sold) already has a `value_preview` field. When the gold standard
benchmark is injected into the audit, the seek prompt is instructed to
reference the exemplar in the `value_preview` — making the pitch
concrete rather than generic:

- **With gold standard:** "Your Google profile has 2 photos and no
  logo. Gold standard [African grocery stores] on Google have a logo,
  cover photo, and 15+ photos. Here's what good looks like:
  [destination URL]. We can close this gap."
- **Without gold standard:** "Your Google profile has 2 photos and no
  logo. Well-optimized profiles in your category typically have 10+
  photos with a logo and cover photo."

The exemplar reference is only included when `{gold_standard_benchmark}`
is populated — the prompt falls back to generic language when no active
gold standard exists. This is a **prompt body instruction change**, not
a schema change — the `value_preview` field already exists in the seek
output schema; the change is instructing the model to use the benchmark
data when available.

### 4.6 Audit schema — `profile_url` field

**File:** `apps/api/src/validators/business-analysis.schema.ts` (extend)

Add `profile_url: z.string().nullable().optional()` to `platformSchema` (line 274), which propagates to all platform subtypes via `.extend()`. The field is optional and passthrough, so existing audits remain valid.

**Audit prompt update:** the `mpt-seed-seek-001` (business audit) prompt body is updated to instruct the model to capture the live profile URL for each platform it evaluates. If the URL cannot be found, set `profile_url` to null.

**Migration:** `236_mkt_business_audit_prompt_url_capture.sql` (update the prompt template body)

**Tests:** extend `apps/api/src/validators/__tests__/business-analysis-schema-sprint1.test.ts`
- Audit with `profile_url` present on each platform → valid
- Audit with `profile_url` null on some platforms → valid
- Audit with `profile_url` absent (legacy) → valid (optional field)
- Audit with `profile_url` as non-string → rejected

### 4.7 Audit schema — `gap_analysis` and `quality_gate_results` blocks

**File:** `apps/api/src/validators/business-analysis.schema.ts` (extend)

Add optional blocks to the audit output:

`gap_analysis` (per platform):
- `field` — the field being compared
- `actual` — the business's current value
- `expected` — the gold standard's expected value
- `gap_severity` — high / medium / low
- `category_specific_note` — why this gap matters for this category

`quality_gate_results` (per platform):
- `gate` — the gate name
- `passed` — boolean
- `severity` — non_negotiable / recommended
- `note` — optional context

Both blocks are optional in the Zod schema so existing audits remain valid. They are only populated when a gold standard benchmark was injected.

**Tests:** extend `apps/api/src/validators/__tests__/business-analysis-schema-sprint1.test.ts`
- Audit with `gap_analysis` populated → valid
- Audit with `quality_gate_results` populated → valid
- Audit with both absent (legacy or no gold standard) → valid
- Audit with `gap_severity` as invalid value → rejected

### 4.8 Curation UX — Gold Standard Profiles list

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/intelligence-profiles/IntelligenceProfilesClient.tsx` (extend)

Add a second list group to the page: **Gold Standard Profiles**. The two lists (Seek Profiles + Gold Standard Profiles) are visually separated, each with:

- **Filter bar:** category, platform, type, search
- **Draft section:** profiles awaiting review/activation
- **Active section:** profiles currently resolving into prompts
- **Cards** showing:
  - Category badge
  - Platform badges (color-coded by type, clickable links to top candidate's destination URL)
  - Type coverage summary ("directory: 3/4 · social_media: 0/1")
  - Status badge (Draft / Active / Retired)
  - City-agnostic badge
  - Version badge
  - Summary line ("N candidates · M platforms with standards")

**Review view** (for gold standard drafts):
- Universal expected fields (canonical NAP, hours, universal quality gates)
- Per-platform expected fields + quality gates (non-negotiable vs. recommended badges)
- Per-platform candidate cards (up to 4 per platform) with quality scores, rationales, platform config, NAP, and clickable destination URLs
- Scan metadata (scan date, sources, selection criteria)
- Per-platform candidate rejection (operator can reject individual candidates before activation)
- Activate button (uses existing `activateIntelligenceProfileDraft` endpoint)

**Tests:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/intelligence-profiles/__tests__/`
- Two lists render separately
- Gold standard cards show platform badges with type color-coding
- Platform badges with candidates are clickable links to destination URLs
- Filter by category shows only matching gold standards
- Filter by platform shows only gold standards with that platform
- Review view shows candidate cards with destination URLs
- Candidate rejection removes candidate from view
- Activation calls existing endpoint and retires previous active profile

### 4.8a Campaign detail panel — Gold Standard Discovery overview

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (extend)
**New component:** `apps/web/src/components/marketing-ops/GoldStandardDiscoveryPanel.tsx`

When a campaign has `scope = 'intelligence'`,
`intelligence_focus = 'gold_standards'`, and
`intelligence_campaign_kind = 'discovery'`, the campaign detail page
shows a **Gold Standard Discovery overview panel** — mirroring how
city-scope campaigns show `SyncReportCard` and profile_repair campaigns
show `RepairBriefingCard`.

**Prerequisite:** the discovery campaign assumes an active gold standard
profile already exists for the category (created by a prior
establishment campaign). The panel shows a warning banner if no active
gold standard profile is found: "No active gold standard profile for
[category] on [platform]. Run an Establishment campaign first to create
the profile — discovery uses the profile's parameters to evaluate
candidates." (See §3.6 — establishment before discovery.)

**The panel shows:**

1. **Campaign context header**
   - Category + Platform focus (e.g., "African Grocery Store · Google")
   - Scan date + status (running / completed / imported)
   - Summary line: "N candidates found · M platforms evaluated · K
     candidates qualifying as gold standard on at least one platform"

2. **Candidate discoveries table**
   - One row per candidate business found by the scan
   - Columns: Business Name, City/State, Platforms (badges with
     quality score per platform), Gold Standard On (platform badges
     where `is_gold_standard = true`), Destination URL (clickable
     link per platform), Actions
   - Sortable by quality score, business name, city
   - Each row expandable to show the full platform evaluation:
     - Per-platform quality score (1-10)
     - Quality rationale (why this candidate qualifies or doesn't)
     - Platform config (categories, attributes, photo count, branding
       artifacts — logo, cover photo, photo types)
     - Destination URL (clickable, opens live profile in new tab)
     - `is_gold_standard` flag per platform

3. **Gold standard justification summary**
   - For each platform where at least one candidate qualifies:
     - The top candidate(s) and why they were selected
     - The quality gates they pass (non-negotiable + recommended)
     - The branding artifacts they have (logo, cover photo, photo
       count, photo types)
     - The expected fields they exemplify (primary category,
       attributes, description pattern)
   - For each platform where no candidate qualifies:
     - "No gold standard found for [platform] — consider running a
       platform-focused scan with a broader search"

4. **Operator actions**
   - **Add to gold standard profile** — adds a candidate to the
     category/platform gold standard slot (up to 4 per platform).
     Disabled if the slot is full or the candidate is already in the
     slot. Shows which slots are filled vs. open.
   - **View live profile** — opens the destination URL in a new tab
   - **Reject candidate** — marks the candidate as rejected (not
     suitable for this category/platform); persists in the scan
     execution metadata so the rejection survives page reloads
   - **Re-run scan** — creates a new gold standard discovery campaign
     with the same category + platform focus (for refreshing
     candidates)

**Data source:** the panel reads the latest execution with
`output_schema.name === 'gold_standard_scan'` for the campaign, via
`marketingOpsService.listExecutions({ campaignId })` (same pattern as
`RepairBriefingCard` and `SyncReportCard`). The execution's
`raw_output` contains the scan results (candidates, platform
evaluations, quality scores, destination URLs, branding artifacts).

**When no scan has run yet:** the panel shows an empty state with a
"Run Gold Standard Scan" button that opens the prompt workspace
pre-selected with the gold standard scan template.

**When the scan is still running:** the panel shows a loading state
with the execution status.

**When the scan completed but found no candidates:** the panel shows
"No candidates found — consider broadening the search or trying a
different platform focus."

**Tests:** `apps/web/src/components/marketing-ops/__tests__/GoldStandardDiscoveryPanel.test.tsx`
- Panel renders when campaign is gold_standards + discovery
- Panel does not render for other focus/kind combinations
- Candidate table shows business name, city, platform badges with
  quality scores
- Expandable row shows full platform evaluation (rationale, branding,
  destination URL)
- Destination URL is a clickable link opening in new tab
- "Add to gold standard profile" button disabled when slot is full
- "Add to gold standard profile" button disabled when candidate
  already in slot
- "Reject candidate" removes candidate from view
- Empty state shows "Run Gold Standard Scan" button when no execution
  exists
- Loading state shows when scan is running
- "No candidates found" state shows when scan returned empty results
- Warning banner shows when no active gold standard profile exists
  (establishment prerequisite not met)
- Justification summary shows per-platform top candidates with
  quality gates passed and branding artifacts

### 4.8b Campaign detail panel — Gold Standard Establishment overview

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (extend)
**New component:** `apps/web/src/components/marketing-ops/GoldStandardEstablishmentPanel.tsx`

When a campaign has `scope = 'intelligence'`,
`intelligence_focus = 'gold_standards'`, and
`intelligence_campaign_kind = 'establishment'`, the campaign detail
page shows a **Gold Standard Establishment overview panel**.

**The panel shows:**

1. **Campaign context header**
   - Category + Platform focus (e.g., "African Grocery Store · Google")
   - Scan date + status
   - Profile status badge: "Draft created" / "Active" / "Not yet
     imported" (links to the intelligence profile in the curation page)

2. **Expected fields summary**
   - Universal expected fields (canonical NAP, hours, universal
     quality gates)
   - Per-platform expected fields (primary category, attributes,
     min_photo_count, description requirements, branding gates)
   - Quality gates summary (non-negotiable vs. recommended, with
     pass/fail counts from the candidate evidence)

3. **Pattern exemplars**
   - Per-platform candidate cards (up to 4 per platform) with:
     - Business name, city/state
     - Quality score + rationale
     - Destination URL (clickable)
     - Platform config (categories, attributes, photos, branding)
   - Candidates that were rejected by the operator are shown greyed
     out with the rejection reason

4. **Profile lifecycle status**
   - "Draft — review and activate" (links to curation page review view)
   - "Active — resolving into audit/fulfill prompts" (shows which
     prompts are using it)
   - "Not yet imported — run scan and import results"

5. **Operator actions**
   - **View in curation page** — links to the gold standard profile
     review view in `IntelligenceProfilesClient.tsx`
   - **Activate profile** — if draft, activates via existing
     `activateIntelligenceProfileDraft` endpoint
   - **Re-run scan** — creates a new establishment campaign with the
     same category + platform focus (for refreshing the profile)

**Data source:** the panel reads the latest execution with
`output_schema.name === 'gold_standard_scan'` for the campaign, plus
the resulting intelligence profile (if imported) via
`marketingOpsService.getIntelligenceProfile(profileId)`.

**Tests:** similar structure to §4.8a, focused on establishment-specific
content (expected fields, pattern exemplars, profile lifecycle status).

### 4.9 Variable builder for gold standard scan

**File:** `apps/api/src/services/IntelligenceProfileService.ts` (extend)

`buildGoldStandardScanVariables(category: string, platform: string)` —
injects the category string and platform focus into the scan prompt.
`platform` is `'all'` or a specific platform key (`'google'`, `'yelp'`,
etc.). No campaign coupling — the scan is category + platform only.

### 4.10 Campaign creation modal — Gold Standards focus

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` (extend)

Add `gold_standards` as a third Focus radio option in the intelligence
scope section (lines 625-640). The current Focus radio group has
`emerging` and `competitive`; add:

```tsx
<label className="flex items-center gap-2">
  <input type="radio" name="intelligence_focus" value="gold_standards"
    checked={form.intelligence_focus === 'gold_standards'}
    onChange={(e) => handleChange('intelligence_focus', e.target.value)} />
  <span className="text-sm">Gold Standards — discover category target state per platform (nationwide)</span>
</label>
```

**Conditional behavior when Focus = `gold_standards`:**
- **City/State fields** — gold standard campaigns are city-agnostic
  (nationwide scan). The City field becomes optional (not required).
  The helper text updates: "Gold standard scans are nationwide — city
  is not required. Leave blank for a category-wide scan."
- **Platform dropdown** (NEW) — a platform selector appears, mirroring
  how the City field focuses the seek discovery scan. Options:
  `all` · `google` · `yelp` · `facebook` · `bbb` · `apple_maps` ·
  `bing` · `mapquest` · `waze` · ... (all platform keys from the
  architecture doc §5.3). Default: `all`. Helper text: "Focus the scan
  on a specific platform for higher-quality per-platform results, or
  scan all platforms at once."
- **Campaign Kind** — both `discovery` and `establishment` remain
  available:
  - `establishment` bootstraps a new gold standard profile (scan runs
    nationwide, produces `expected_fields` + `gold_standards` blocks,
    stores as a draft profile)
  - `discovery` produces a list of gold standard candidate businesses
    for the category, evaluated per-platform. The operator reviews the
    list and adds businesses to the category/platform gold standard
    slots (up to 4 per platform). This mirrors how emerging/competitive
    discovery produces a list of businesses that can be added to the
    prospect queue.
- **Title auto-fill** — continues the existing intelligence campaign
  naming pattern (Category + Kind + Focus + focus-dimension). For gold
  standards, the **platform replaces the city** as the focus dimension.
  The auto-fill produces:
  - Specific platform: "African Grocery Store - Establishment - Gold
    Standards - Google"
  - All platforms: "African Grocery Store - Establishment - Gold
    Standards - All Platforms"
  - Discovery variant: "African Grocery Store - Discovery - Gold
    Standards - Google"

  A single category can have up to 2 campaigns per platform (discovery +
  establishment), plus 2 for `all`-platforms. With the top 4 platforms
  + `all`, that's up to 10 gold standard campaigns per category — each
  uniquely named by the Kind + Platform combination. Update the
  auto-fill logic (lines 287-299) to:
  - Skip city/state when focus is `gold_standards`
  - Append the platform label (or "All Platforms" when `all`)
  - Use the platform display name (e.g., "Google" not "google",
    "BBB" not "bbb")
- **Campaign Kind helper text** — update the helper text (line 656) to
  note: "When Focus = Gold Standards, Establishment bootstraps a
  category gold standard profile (nationwide, platform-aware). Discovery
  finds candidate businesses to add to the profile's per-platform slots
  (up to 4 per platform)."

**Form state type:** `intelligence_focus` is already typed as
`'emerging' | 'competitive' | ''` (line 260). Extend to
`'emerging' | 'competitive' | 'gold_standards' | ''`. Add a new
`intelligence_platform` field: `string` (default `'all'`).

**Backend:** `MarketingCampaignService` already accepts
`intelligence_focus` as a string — no backend change needed for the
field itself. The `intelligence_platform` value is stored in a new
nullable `VARCHAR(20)` column on `mkt_campaigns_list` (migration `234`,
see §5). This mirrors the existing `intelligence_zip_codes` and
`intelligence_search_radius_miles` pattern — a dedicated nullable
column for an intelligence-scope-specific field. The
`MarketingCampaignService` create/update methods must be extended to
accept and persist `intelligence_platform`. The gold standard scan
prompt template (§4.2) is seeded
with `intelligence_focus = 'gold_standards'` and
`intelligence_campaign_kind = 'establishment'`, so the prompt
resolution pipeline picks it up automatically when a campaign with
those values runs.

**Tests:**
- Focus radio shows three options when scope = intelligence
- Selecting `gold_standards` makes City optional
- Platform dropdown appears when focus = `gold_standards`
- Title auto-fill: "African Grocery Store - Establishment - Gold
  Standards - Google" when platform = google, kind = establishment
- Title auto-fill: "African Grocery Store - Discovery - Gold Standards -
  Yelp" when platform = yelp, kind = discovery
- Title auto-fill: "African Grocery Store - Establishment - Gold
  Standards - All Platforms" when platform = all
- Title auto-fill uses platform display name ("Google" not "google")
- Title auto-fill stops when operator manually edits the title
- Campaign with `intelligence_focus = 'gold_standards'` and
  `intelligence_campaign_kind = 'establishment'` saves correctly
- Campaign with `gold_standards` focus + specific platform resolves to
  the gold standard scan prompt with that platform
- Campaign with `gold_standards` focus + `all` platforms resolves to
  the gold standard scan prompt with `all`

---

## 5. Migration Plan

**Latest migration in repo:** `233_prompt_execution_error_message.sql`.
New migrations start at **234**.

| Migration | Purpose |
|-----------|---------|
| `234_mkt_intelligence_platform_column.sql` | Add `intelligence_platform` nullable `VARCHAR(20)` column to `mkt_campaigns_list` (for the platform focus on gold standard campaigns) |
| `235_mkt_gold_standard_scan_prompt.sql` | Seed `mpt-gold-standard-scan` prompt template |
| `236_mkt_business_audit_prompt_url_capture.sql` | Update business audit prompt body to instruct URL capture |

No other schema migrations needed — gold standards reuse
`mkt_intelligence_profiles` and the `profile_url` / `gap_analysis` /
`quality_gate_results` fields are optional in the Zod schema
(passthrough), not database columns. The `intelligence_focus` column is
already `varchar(20)` on all relevant tables (`mkt_campaigns`,
`mkt_intelligence_profiles`, `mkt_prompt_templates`, `mkt_seek_batches`,
`mkt_directory_presence_seeds`) — the value `gold_standards` (14 chars)
fits without a column change.

The `intelligence_platform` column **is** required — the plan's §4.10
left this as TBD, but the platform dropdown needs to persist. A nullable
`VARCHAR(20)` column mirrors the existing `intelligence_zip_codes` and
`intelligence_search_radius_miles` pattern. Default: `NULL` (legacy
campaigns). Gold standard campaigns set it to `'all'` or a specific
platform key.

---

## 6. Verification

### 6.1 Type checks
- `pnpm checkapi` — after schema, service, and route changes
- `pnpm checkweb` — after admin page changes

### 6.2 Tests
- Gold standard scan schema tests (§4.1)
- Gold standard import hook tests (§4.3)
- `serializeGoldStandard` tests (§4.4)
- Dual injection tests (§4.5)
- Audit schema `profile_url` tests (§4.6)
- Audit schema `gap_analysis` / `quality_gate_results` tests (§4.7)
- Curation UX tests (§4.8)
- Gold Standard Discovery panel tests (§4.8a)
- Gold Standard Establishment panel tests (§4.8b)

### 6.3 Manual verification
- Run a gold standard scan for a priority category (e.g., "African Grocery Store")
- Import the scan result via `/executions/external`
- Verify the draft intelligence profile appears in the Gold Standard Profiles list
- Open the review view — verify candidate cards show destination URLs
- Activate the profile — verify it moves to Active section
- Run a business audit for a business in that category — verify `{gold_standard_benchmark}` is populated with benchmark directives
- Verify the audit output includes `gap_analysis` and `quality_gate_results`
- Run a fulfill prompt — verify `{gold_standard}` is populated with target directives

---

## 7. Out of Scope

- **Platform SOP module** (architecture §6) — separate sprint; the SOP module captures the "how" for each platform and is not required for gold standard scan/store/inject
- **Retainer drift scan** (architecture §7) — separate sprint; depends on gold standards existing (for canonical state comparison) but is not part of Sprint 0
- **Website gold standards** (architecture §5.5) — the scan schema supports the `website` platform key, but website gold standard prompts and UX are deferred to a later sprint
- **Flywheel promotion** (Profile Repair spec §4.3.4) — the pattern where successful repairs promote the repaired business as a new gold standard candidate is a future enhancement
- **Gold standard freshness/reverification** — alerts when a gold standard is stale and needs re-scanning are deferred

---

## 8. Gap Analysis — Codebase vs Plan (Pre-Implementation)

Conducted by reading the actual codebase before starting implementation.
This section documents what the plan assumed vs what actually exists, and
what additional work items the codebase requires.

### 8.1 Critical assumption errors in the plan

| Plan claim | Reality | Fix |
|------------|---------|-----|
| "the fulfill prompt already calls `serializeGoldStandard`" (§4.5) | `serializeGoldStandard` does not exist anywhere in the codebase | Build from scratch — both audit and fulfill injection are new work |
| "this sprint adds the `role` parameter to that call" (§4.5) | There is no call to add a parameter to | Build the function, then wire it into both prompts |
| Migrations 184/185 are available | Latest migration is **233** — 184/185 are already taken | Renumber to 234/235/236 (see §5) |
| `intelligence_platform` storage is TBD | The column does not exist and is required | Migration 234 adds the column (see §5) |

### 8.2 Existing patterns to follow (confirmed in codebase)

| Implementation item | Existing pattern | File |
|---------------------|-----------------|------|
| §4.1 OUTPUT_SCHEMA_REGISTRY | Registry with `{ validator, auditPlatform, promptSuffix }` | `apps/api/src/validators/market-analysis.schema.ts` (lines 204-274) |
| §4.3 Post-import hook | `intelligence_profile` schema hook: detect schemaName → dynamic import → `importAsDraft` | `apps/api/src/services/MarketingPromptService.ts` (lines 837-902) |
| §4.4 `serializeGoldStandard` | `renderBusinessProfileBlock(profile, targetCity, headerTitle, headerDirective)` — renders a profile into a text block with a header directive | `apps/api/src/services/intelligence/IntelligenceProfileService.ts` (lines 879-959) |
| §4.5 Dual injection | Business-scope §1B amplification: resolve profile → render block → append to base prompt | `apps/api/src/services/MarketingExecutionService.ts` (lines 489-579) |
| §4.8 Admin list | Draft/Active sections, filter bar, card rendering, view modal, activation flow | `apps/web/src/app/(platform)/settings/admin/marketing-ops/intelligence-profiles/IntelligenceProfilesClient.tsx` |
| §4.10 Campaign form | Radio groups for focus/kind, conditional fields, title auto-fill | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` (lines 623-673, 287-299) |
| §4.9 Variable builder | `buildSeekVariables()`, `buildFulfillVariables()` return variable objects | `apps/api/src/services/ProfileRepairPromptService.ts` |

### 8.3 Missing work items the plan didn't mention

These items are required by the codebase but not explicitly called out
in the plan's implementation sections:

#### 8.3.1 Extend `IntelligenceFocus` type to include `'gold_standards'`

**Current:** `export type IntelligenceFocus = 'emerging' | 'competitive';`
(`IntelligenceProfileService.ts` line 48)

**Required:** `export type IntelligenceFocus = 'emerging' | 'competitive' | 'gold_standards';`

**Files that must be updated:**
- `apps/api/src/services/intelligence/IntelligenceProfileService.ts` (line 48)
- `apps/api/src/services/MarketingPromptService.ts` (type reference, line ~36)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` (line 260 — form state type)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/intelligence-profiles/IntelligenceProfilesClient.tsx` (line 42 — filter type)
- `apps/web/src/services/MarketingOpsService.ts` (if it has a focus type)

**Prerequisite:** this type extension must happen before any
focus-specific logic. It's the first implementation step.

#### 8.3.2 Add `platform` to `SCOPE_VARIABLES`

**Current:** `SCOPE_VARIABLES.intelligence` in `scope-utils.ts` (line 44)
is `['category', 'city', 'state', 'zip_codes', 'search_radius_miles', 'focus', 'neighborhood', 'business_origin']`

**Required:** add `'platform'` to the intelligence scope array so the
gold standard scan prompt can reference `{platform}` as a declared
variable. Without this, `renderTemplate` will reject the prompt at
render time (out-of-scope variable guard).

**File:** `apps/api/src/services/scope-utils.ts` (line 44)

#### 8.3.3 Extend `MarketingCampaignService` to persist `intelligence_platform`

**Current:** `MarketingCampaignService` create/update methods accept
`intelligence_focus`, `intelligence_zip_codes`,
`intelligence_search_radius_miles`, and `intelligence_campaign_kind`
but not `intelligence_platform`.

**Required:** extend the create/update input types and Prisma write
calls to include `intelligence_platform` (nullable string, default
`NULL`). The campaign list/detail queries should also select the new
column so the frontend can read it back.

**File:** `apps/api/src/services/MarketingCampaignService.ts`

#### 8.3.4 Extend frontend `MarketingOpsService` to send/receive `intelligence_platform`

**Current:** the frontend campaign service sends
`intelligence_focus`, `intelligence_zip_codes`,
`intelligence_search_radius_miles`, and `intelligence_campaign_kind`
but not `intelligence_platform`.

**Required:** add `intelligence_platform` to the campaign create/update
payloads and to the campaign type definition.

**File:** `apps/web/src/services/MarketingOpsService.ts`

#### 8.3.5 Service layer method for gold standard profile filtering

**Current:** `IntelligenceProfilesClient.tsx` lists all profiles
together — there's no filter by `intelligence_focus` at the API or
service layer.

**Required:** either:
- Extend the existing profile list endpoint to accept a `focus` query
  parameter, OR
- Filter client-side in `IntelligenceProfilesClient.tsx` by checking
  `profile.intelligence_focus === 'gold_standards'`

The client-side approach is simpler and sufficient if the profile
counts stay manageable. The API approach is better for scale.

**Files:**
- `apps/api/src/routes/marketing-ops.ts` (if API-side filter)
- `apps/web/src/services/MarketingOpsService.ts` (if API-side filter)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/intelligence-profiles/IntelligenceProfilesClient.tsx` (either way)

#### 8.3.6 `IntelligenceProfileService.resolve` must handle `gold_standards` focus

**Current:** `resolve(category, focus, city)` (line 177) accepts
`focus?: IntelligenceFocus`. The resolution logic queries
`mkt_intelligence_profiles` by category + focus + city.

**Required:** when `focus = 'gold_standards'`, the resolver must:
- Pass `referenceCity = null` (gold standards are city-agnostic)
- Query by `(category_key, intelligence_focus = 'gold_standards', reference_city IS NULL, status = 'active')`
- Return the active gold standard profile

The existing resolver may already handle this correctly if it falls
back to city-agnostic when city is null — verify during implementation.

#### 8.3.7 `importAsDraft` must accept `intelligence_focus = 'gold_standards'`

**Current:** `importAsDraft` (line 464) accepts
`intelligenceFocus?: IntelligenceFocus` which is currently
`'emerging' | 'competitive'`.

**Required:** after extending the type (§8.3.1), the method will accept
`'gold_standards'`. The post-import hook (§4.3) must pass
`intelligenceFocus: 'gold_standards'` and `referenceCity: null`.

### 8.4 Revised implementation order

Based on the gap analysis, the implementation should proceed in this
order (dependencies flow downward):

```
1. Extend IntelligenceFocus type (§8.3.1) — prerequisite for everything
2. Migration 234: intelligence_platform column (§5)
3. Add 'platform' to SCOPE_VARIABLES (§8.3.2)
4. Gold standard scan schema (§4.1) — new file + registry
5. Migration 235: seed gold standard scan prompt (§4.2)
6. buildGoldStandardScanVariables (§4.9)
7. Post-import hook (§4.3) — uses importAsDraft with gold_standards focus
8. serializeGoldStandard (§4.4) — new function, follows renderBusinessProfileBlock pattern
9. Dual injection in resolvePrompt (§4.5) — audit (benchmark) + fulfill (target)
10. Migration 236: update audit prompt body for URL capture (§4.6)
11. Audit schema: profile_url (§4.6)
12. Audit schema: gap_analysis + quality_gate_results (§4.7)
13. MarketingCampaignService: persist intelligence_platform (§8.3.3)
14. Frontend MarketingOpsService: send/receive intelligence_platform (§8.3.4)
15. CampaignFormClient: gold_standards focus + platform dropdown (§4.10)
16. IntelligenceProfilesClient: Gold Standard Profiles list (§4.8)
17. Service layer: gold standard profile filtering (§8.3.5)
18. GoldStandardDiscoveryPanel: campaign detail overview (§4.8a)
19. GoldStandardEstablishmentPanel: campaign detail overview (§4.8b)
20. Tests for all above
21. pnpm checkapi + pnpm checkweb
```

### 8.5 No-risk items (plan assumptions confirmed correct)

- `mkt_intelligence_profiles` table exists with `intelligence_focus` column (varchar(20)) — confirmed
- `intelligence_focus` column is already on all relevant tables — confirmed
- `intelligence_campaign_kind` column exists — confirmed
- `OUTPUT_SCHEMA_REGISTRY` exists and is extensible — confirmed
- `importAsDraft` method exists on `IntelligenceProfileService` — confirmed
- `importExternalResult` has a post-import hook pattern to follow — confirmed
- `resolvePrompt` has a profile resolution pattern to follow — confirmed
- `business-analysis.schema.ts` uses `.passthrough()` — confirmed, optional fields won't break existing audits
- `CampaignFormClient.tsx` has the radio group + conditional field pattern — confirmed
- `IntelligenceProfilesClient.tsx` has the list/filter/review/activation pattern — confirmed

---

## 9. Open Questions

1. **Scan execution mode** — should the gold standard scan run synchronously (like triage) or asynchronously (like the business audit)? The scan is category-only and not user-facing, so asynchronous is likely fine, but synchronous gives the operator immediate feedback. Recommendation: asynchronous via the existing execution queue, with admin notification on completion.

2. **Priority categories** — which categories should we scan first? The Profile Repair spec suggests starting with categories that have active campaigns. Recommendation: scan categories in descending order of active campaign count, so the highest-impact categories get gold standards first.

3. **Re-scan cadence** — how often should gold standards be re-scanned? Categories evolve (new platforms, changing category taxonomies). Recommendation: re-scan quarterly, with manual trigger available. Stale alerts are out of scope for this sprint but the `researched_at` / freshness field is captured in the scan metadata.

4. **Candidate rejection persistence** — when the operator rejects a candidate in the review view, is the rejection persisted in `configuration_json` or just filtered in the UI? Recommendation: persist in `configuration_json.gold_standards[platform][i].operator_rejected = true` so the rejection survives page reloads and is visible to other operators.
