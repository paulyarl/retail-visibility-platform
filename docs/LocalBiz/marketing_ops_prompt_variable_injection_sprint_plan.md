# Sprint Plan: Marketing Ops — Prompt Variable Injection & Amplification Gating

**Document Version:** 1.1 (revised per gap review — synchronous triage, output schema registry, scheduler dispatch, SignalExtractor integration, pseudocode fix, §11.1 resolved, audit_results formatter, triage panel UI)
**Date:** 2026-08-19
**Status:** Ready for Sprint Planning — Design Decisions Resolved (§3), Open Questions in §11

**Source analysis:** Prompt template inventory (`docs/api-response/seek-prompt-templates.md`, 36 templates), `MarketingExecutionService.resolvePrompt()` seam, `RecoveryResolutionService` variable-builder pattern, `SCOPE_VARIABLES` scope map, `IntelligenceProfileService.renderBusinessProfileBlock()` append path.
**Codebase baseline:** `retail-visibility-platform` @ migrations through `183_mkt_deliverable_preview_tokens_short_code.sql`; Profile Repair Integration Spec (`PROFILE_REPAIR_INTEGRATION_SPEC.md`) P1 shipped (campaign category, `repair_track`, `switchRepairTrack()`, seeded `profile_repair_triage` + per-issue seek templates).

**Prerequisite:** Profile Repair Integration P1 complete; Seek Intelligence Scope sprint complete (the `resolvePrompt()` amplification seam + `renderBusinessProfileBlock()` exist); Recovery Management Engine complete (the `RecoveryResolutionService` variable-builder pattern exists).

**Companion docs:**
- `docs/LocalBiz/PROFILE_REPAIR_INTEGRATION_SPEC.md` (§2.2 triage-first, §5.2.2 seeded prompts, §6.2.3 resolution template)
- `docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md` (§1B — profile-amplified business audit resolution)
- `docs/api-response/seek-prompt-templates.md` (live template inventory — 36 templates)

---

## 1. Executive Summary

The Profile Repair Integration spec shipped six seeded prompt templates (triage, three per-issue seek audits, citation-package fulfill, reinstatement-appeal resolution). All six declare out-of-scope variables (`audit_signals`, `issue_type`, `audit_results`, `issueType`, `intakePayload`, `evidencePayload`, `attachmentMeta`) that the backend cannot source today — they are not in `SCOPE_VARIABLES.business`, and unlike `RecoveryResolutionService` (which builds `complaintText`/`intakePayload`/`attachmentMeta` from campaign + intake data), no equivalent variable-builder service exists for profile repair. The templates are seeded but **orphaned**: they can only be executed via the generic `/prompts/:id/render` route with operator-supplied variables, which never happens in the triage flow.

A second, related defect compounds the first. The category-intelligence amplification gate in `resolvePrompt()` fires for *any* business-scope seek prompt with a category — including the profile-repair seek templates. It does not distinguish between **category-aware audits** (where the block is the primary intelligence input) and **signal-driven triage/audits** (where the block is supplementary and the signal variables should be primary). The result, observed in production: a profile-repair triage prompt renders with empty `{{audit_signals}}`/`{{issue_type}}` fields and a 300-line Category Intelligence block appended unconditionally — the model is asked to triage with no evidence and a large distractor.

This sprint closes both gaps plus six additional execution, data-flow, and UI gaps surfaced in review (see §2.5–§2.10) with nine coordinated changes:

1. **`ProfileRepairPromptService`** — a variable-builder service mirroring `RecoveryResolutionService`, sourcing `audit_signals`/`issue_type`/`audit_results`/`evidencePayload`/`attachmentMeta` from campaign + audit + intake data and passing them through the existing `variables` override in `resolvePrompt()`. Signal sourcing routes through `SignalExtractor.extractSignals()` (not raw `audit_data.detected_signals` reads) so legacy/derived signals are covered.
2. **Synchronous triage execution** — the triage endpoint executes the AI call synchronously (mirroring `executeSingle`) and returns the parsed recommendation, because no scheduler polls for pending seek executions. Resolution (Track B) stays asynchronous via the existing `recovery-resolution.ts` job, extended to dispatch on `template_id`.
3. **Prompt-role discriminator** — a derived field on the amplification gate so the category block is appended with the right framing for signal-driven templates, and only when the signal variables are actually populated.
4. **Output schema registrations** — `profile_repair_triage`, `profile_repair_audit`, and `citation_repair_package` Zod schemas + registry entries in `OUTPUT_SCHEMA_REGISTRY`, so external import and AI-completion validation don't throw "schema not registered."
5. **Scheduler dispatch for Track B resolution** — `jobs/recovery-resolution.ts` extended to poll both `mpt-recovery-resolution-default` and `mpt-profile-repair-resolution-default`; `RecoveryResolutionService.run()` (or a sibling `ProfileRepairPromptService.runResolution()`) handles `intake_kind === 'profile_repair'`, emits a `reinstatement_appeal` deliverable, and transitions to `final_resolution_drafted`.
6. **Scope-map fix** — `business_address`/`business_phone` added to `SCOPE_VARIABLES.business` and the `renderTemplate()` candidate map, sourced from the campaign's composite address columns (`address_line1`/`address_city`/`address_state`/`address_zip`) and `phone`/`contact_info` columns (§11.1 resolved — columns confirmed to exist).
7. **`audit_results` formatter** — a structured Markdown serializer for the citation-package fulfill template (not raw JSON dump), keeping token usage bounded and output quality high.
8. **Triage panel UI** — `RepairTrackPanel.tsx` currently shows only a static amber banner when `repair_track = NULL`. This sprint builds the "Run Triage Analysis" button, loading state, recommendation card (severity badge, recommended track, rationale, issue type), and Confirm/Override action buttons.
9. **Signal registry seed** — five new `DS_*` codes for the escalated repair track, seeded into `mkt_signal_registry`.

No new pipeline architecture, no new tables, no new stage machine. The work is one new service, one refined gate, three output-schema registrations, one scheduler extension, one scope-map correction, one UI panel expansion, and tests.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer

---

## 2. Problem Statement

### 2.1 Profile Repair Templates Declare Variables Nothing Sources

The six profile-repair templates declare these variables:

| Template | `prompt_type` | Declared out-of-scope vars |
|---|---|---|
| `mpt-profile-repair-triage-default` | seek | `audit_signals`, `issue_type` |
| `mpt-profile-repair-nap-drift-seek` | seek | `audit_signals` |
| `mpt-profile-repair-unclaimed-seek` | seek | `audit_signals` |
| `mpt-profile-repair-platform-gap-seek` | seek | `audit_signals` |
| `mpt-profile-repair-citation-package-fulfill` | fulfill | `audit_results` |
| `mpt-profile-repair-resolution-default` | recovery_resolution | `issueType`, `intakePayload`, `evidencePayload`, `attachmentMeta` |

None of these variables are in `SCOPE_VARIABLES.business` (see `apps/api/src/services/scope-utils.ts` lines 35–45). They can only be filled via the `variables` override path in `renderTemplate()` (lines 572–577 of `MarketingExecutionService.ts`: "Caller overrides always win, even if not in the scope's allowed list"). But the only path that supplies `variables` for these templates today is the generic operator-driven route at `marketing-ops.ts` line 2028 — which requires the operator to manually paste JSON. The triage flow never does this.

The working analog is `RecoveryResolutionService` (lines 95–115): it builds `complaintText` from `campaign.notes`, `intakePayload` from `intake.owner_statement`/`proposed_resolution`/`service_date`/`status_flag`, and `attachmentMeta` from the intake's attachments, then passes them to `createExecution({ variablesUsed })`. The same variables are rebuilt in `renderPromptText()` (lines 780–802) and `importExternalResult()` (lines 851–871) so all three execution modes (direct API, copy-paste bridge, external import) produce identical prompts. Profile repair has no equivalent.

### 2.2 The Category Block Fires Ungated for Signal-Driven Prompts

`resolvePrompt()` (lines 356–407 of `MarketingExecutionService.ts`) gates the category-intelligence append on three conditions only:

```ts
const isSeek = template.prompt_type === 'seek';
const isBusinessScope = campaignScope === 'business';
const hasCategory = Boolean(campaign.category);
if (!isSeek || !isBusinessScope || !hasCategory) {
  return base render (no amplification);
}
// append renderBusinessProfileBlock()
```

This is correct for the **generic business audits** (`mpt-seed-seek-001`, `mpt-j9bbem3l`, `mpt-6oeuiizo`, `mpt-je6m7ru6`) — those templates have only in-scope variables (`business_name`/`city`/`category`), so the category block is the *primary* intelligence input and unconditional append is right.

It is wrong for the **profile-repair seek templates**. Those templates declare `audit_signals` as their primary input; the category block is supplementary (useful for `INT_POSSIBLE_CATEGORY_MISALIGNMENT` and the prohibited-inferences list, but not the decision driver). When `audit_signals` is empty — which it always is today, per §2.1 — the model receives a 300-line category block and nothing else of substance. The block becomes a distractor, not an amplifier.

### 2.3 Latent Scope-Map Gap in the Digital Audit Cohesive Template

`mpt-j9bbem3l` ("Business Digital Audit - Cohesive (Seek)") references `{{business_address}}` and `{{business_phone}}` in its body (lines 153–159 of the template body), but:

- Neither is in `SCOPE_VARIABLES.business` (which lists `business_name`, `category`, `city`, `state`, `neighborhood`, `contact_method`, `contact_info`, `unaddressed_reviews`, `last_review_date`, `gbp_claimed`, `has_website`, `nap_consistent`, `pain_score`, `estimated_tier`, `notes`, `tone`, `attributes`, `business_origin`).
- Neither is in the template's declared `variables` list (`["business_name","city","category"]`).
- Neither is in the `candidate` map in `renderTemplate()` (lines 546–566).

`renderTemplate()`'s out-of-scope detector (lines 534–543) should reject this, but the `variables` override escape hatch suppresses the check when the caller passes *any* variables. In practice the references render as the literal strings `{{business_address}}`/`{{business_phone}}` or empty strings depending on the call path. This is a separate bug but surfaces in the same analysis.

### 2.4 No Provenance for Repair-Specific Variables

`mkt_prompt_executions_list.variables_used` stores whatever the caller passes. `RecoveryResolutionService` stamps `complaintText`/`intakePayload`/`attachmentMeta`/`intakeId` there so historical runs are reproducible. Profile repair executions today store either nothing (generic route with no variables) or whatever the operator pasted — there is no system-of-record stamp for `audit_signals` provenance, so a triage recommendation cannot be traced back to which signals produced it.

### 2.5 No Scheduler Polls for Seek/Triage Executions (Gap 1.1)

`RecoveryResolutionService.enqueue()` works because `jobs/recovery-resolution.ts` (line 38) polls for `status: 'pending', template_id: 'mpt-recovery-resolution-default'` every 5 minutes and calls `RecoveryResolutionService.run()` for each. No equivalent scheduler exists for seek prompts or profile-repair triage. If `ProfileRepairPromptService.enqueueSeek()` only creates a pending execution, it will sit in `pending` forever — the operator clicks "Run Triage Analysis" and nothing happens.

Triage is an interactive operator workflow (the operator is watching the campaign detail page and expects a recommendation). The triage endpoint must execute synchronously, mirroring `MarketingExecutionService.executeSingle()`: call the AI provider, update the execution record to `completed`, parse the triage recommendation, and return `{ executionId, recommendation }` in the HTTP response. Resolution (Track B) stays asynchronous because it is a background drafting task (the operator returns later to review the draft).

### 2.6 Unregistered Output Schemas Will Crash Validation (Gap 1.2)

`OUTPUT_SCHEMA_REGISTRY` in `apps/api/src/validators/market-analysis.schema.ts` (lines 151–201) has seven entries: `market_analysis`, `regional_city_opportunity`, `business_analysis`, `recovery_resolution`, `city_category_opportunity`, `intelligence_discovery`, `intelligence_profile`. The profile-repair templates declare three schema names that are **not registered**:

| Template | Declared `output_schema.name` | Registered? |
|---|---|---|
| `mpt-profile-repair-triage-default` | `null` (but outputs `profile_repair_triage` JSON) | **No** |
| `mpt-profile-repair-nap-drift-seek` | `profile_repair_audit` | **No** |
| `mpt-profile-repair-unclaimed-seek` | `profile_repair_audit` | **No** |
| `mpt-profile-repair-platform-gap-seek` | `profile_repair_audit` | **No** |
| `mpt-profile-repair-citation-package-fulfill` | `citation_repair_package` | **No** |
| `mpt-profile-repair-resolution-default` | `recovery_resolution` | Yes (existing) |

Calling `resolveOutputSchema()` during `importExternalResult()` or AI completion validation for the unregistered schemas returns `null`, and any downstream validation that expects a registered schema will fail. The triage template has `output_schema: null` in the database, so its output is not validated at all today — the AI could return malformed JSON and the system would accept it. All three schema names need Zod schemas + registry entries.

### 2.7 Recovery Resolution Job Hardcodes the Dispute Template (Gap 1.3)

`jobs/recovery-resolution.ts` line 38 queries `where: { status: 'pending', template_id: 'mpt-recovery-resolution-default' }`. It will never pick up `mpt-profile-repair-resolution-default` executions. Furthermore, `RecoveryResolutionService.run()` and its sibling methods hardcode `intake_kind === 'dispute'` at lines 381, 766, 846, and 1038 — they find the dispute intake, not the profile-repair intake. Track B resolution executions would sit in `pending` forever even if the poll query were fixed.

The scheduler must be extended to poll for both template IDs, and the resolution runner must dispatch on `intake_kind`: `dispute` → existing `RecoveryResolutionService.run()` (emits `dispute_resolution` deliverable); `profile_repair` → `ProfileRepairPromptService.runResolution()` (emits `reinstatement_appeal` deliverable, transitions to `final_resolution_drafted`).

### 2.8 Fragile Signal Extraction Bypasses SignalExtractor (Gap 2.1)

`SignalExtractor` (`apps/api/src/services/triage/signal-extractor.ts` line 149) implements a 3-tier extraction precedence: (1) `model_emitted` — if `audit_data.detected_signals[]` is present, use it directly; (2) `derived` — for legacy audits without `detected_signals[]`, derive codes from raw GBP/NAP/website fields + thresholds; (3) `operator_input` — BBB codes from the triage pre-flight form. Reading `audit_data.detected_signals` directly (as the v1.0 plan specified) works only for new audits that emit the signal array. Legacy audits — and any campaign imported without a full audit — would produce an empty `audit_signals` string, causing the §3.3 `signal_triage` gate to suppress the category block incorrectly.

`ProfileRepairPromptService` must call `SignalExtractor.extractSignals({ campaign, auditData: latestAudit?.audit_data })` to get the normalized `SignalCode[]` array before mapping to triage terms. This covers legacy audits via the derived tier and ensures the gate only suppresses the category block when there are genuinely no signals, not when the audit predates the signal-array contract.

### 2.9 Triage Panel UI Is a Static Banner, Not a Workflow (Gap 3.1)

`RepairTrackPanel.tsx` (lines 77–86) renders only a static amber banner when `repair_track = NULL`:

> "Triage — Track Not Yet Decided. Run the triage prompt to get an AI recommendation, then confirm a track."

There is no "Run Triage Analysis" button, no loading state, no recommendation card, and no Confirm/Override action buttons. The v1.0 plan's claim that "the triage panel already exists per Profile Repair P1 — this sprint only wires the button" was wrong: the panel exists but the triage workflow components do not. This sprint must build them.

### 2.10 `audit_results` Serialization Unspecified (Gap 2.4)

The citation-package fulfill template (`mpt-profile-repair-citation-package-fulfill`) expects `{{audit_results}}` to contain structured audit data (canonical NAP, drifting platforms, unclaimed listings, missing platforms). The v1.0 plan specified `serializeAuditResults(latestAudit?.audit_data ?? {})` but did not define the serialization format. Dumping `audit_data` as raw JSON would explode token usage (the full audit JSON can be 5–10KB) and degrade output quality (the model has to parse unstructured JSON to find the NAP drift fields). A structured Markdown formatter is needed.

---

## 3. Design Decisions

### 3.1 Variable Builder: Mirror `RecoveryResolutionService`, Do Not Generalize

**Decision:** Create `ProfileRepairPromptService` as a sibling of `RecoveryResolutionService`, with three variable builders (seek/fulfill/resolution) and the same three-mode execution surface (direct API, copy-paste bridge, external import). Do not generalize the two services into a shared `PromptVariableBuilder` abstraction.

**Rationale:**
- The two services have different domain shapes: recovery reads `campaign.notes` + `intake.owner_statement`/`proposed_resolution`; repair reads `mkt_audits_list.audit_data.detected_signals` + `campaign.repair_issue_type` + `intake.evidence_payload`. A shared abstraction would have to parameterize the source shape, which is more code than the duplication.
- `RecoveryResolutionService` is the proven pattern (shipped, tested, in production). Mirroring it is the lowest-risk path.
- The three-mode execution surface (direct / copy-paste / external) is the same for both; if a shared abstraction becomes warranted later, it can be extracted from two concrete examples instead of speculatively designed.

**Trade-off acknowledged:** Some structural duplication (the `enqueue()` / `renderPromptText()` / `importExternalResult()` trio). Acceptable — the bodies differ.

### 3.2 Signal Sourcing: Route Through `SignalExtractor`, Then Map to Triage Vocabulary

**Decision:** `audit_signals` is sourced via `SignalExtractor.extractSignals({ campaign, auditData: latestAudit?.audit_data })` (the 3-tier extractor at `apps/api/src/services/triage/signal-extractor.ts` line 149), not by reading `audit_data.detected_signals` directly. The returned `SignalCode[]` array is then mapped to the triage vocabulary the template's heuristic guardrails expect (`suspension`, `hijacked_listing`, `duplicate_listing`, `ownership_dispute`, `address_verification_block`, `nap_drift`, `unclaimed_profile`, `missing_category`, `missing_hours`, `platform_gap`) via a code-defined mapping table.

**Rationale:**
- `SignalExtractor` covers all three detection tiers: `model_emitted` (new audits with `detected_signals[]`), `derived` (legacy audits — derives codes from raw GBP/NAP/website fields + thresholds), and `operator_input` (BBB pre-flight). Reading `detected_signals` directly only covers the first tier; legacy audits would produce empty `audit_signals`, causing the §3.3 `signal_triage` gate to suppress the category block incorrectly.
- The audit JSON is the system of record, but `SignalExtractor` is the canonical normalization layer — it is already used by the triage engine and outreach hook library. Routing through it ensures the repair triage sees the same signal set the rest of the platform sees.
- The triage template's guardrails are written in the triage vocabulary, not the raw signal codes. A mapping layer is required either way; putting it in the service keeps the template body human-readable.
- The mapping is code-defined (not a DB table) because it is a fixed 10-to-N relationship between two closed vocabularies. If either vocabulary grows, the mapping updates in one place.

**Mapping table (initial):**

| Raw signal code(s) | Triage vocabulary |
|---|---|
| `DS_PROFILE_SUSPENDED` (new — see §3.5) | `suspension` |
| `DS_DUPLICATE_LISTING` (new) | `duplicate_listing` |
| `DS_HIJACKED_LISTING` (new) | `hijacked_listing` |
| `DS_OWNERSHIP_DISPUTE` (new) | `ownership_dispute` |
| `DS_ADDRESS_VERIFICATION_BLOCK` (new) | `address_verification_block` |
| `CP_NAP_NAME_DRIFT`, `CP_NAP_ADDRESS_DRIFT`, `CP_NAP_PHONE_DRIFT` | `nap_drift` |
| `DS_CLAIMED_STATUS` (when value indicates unclaimed) | `unclaimed_profile` |
| `DS_MISSING_SERVICE_MENU` (when category indicates missing) | `missing_category` |
| `DS_OUTDATED_HOURS` | `missing_hours` |
| `DS_MISSING_PROFILE` | `platform_gap` |

The five escalated signals do not exist in the current `DS_*` family — see §3.5 for the new signal codes.

### 3.3 Prompt-Role Discriminator: Derived, Not Persisted

**Decision:** Add a derived `prompt_role` discriminator computed inside `resolvePrompt()` from existing template metadata, not a new column. The discriminator takes one of three values:

| `prompt_role` | Derivation | Category block behavior |
|---|---|---|
| `category_audit` | `seek` + business scope + template.category is null/`review_management`/`Digital Audit`/`Review Response`/`Outreach from Category Analysis` (i.e., not `profile_repair`) | Append unconditionally (current behavior — block is primary intelligence) |
| `signal_triage` | `seek` + business scope + `template.category === 'profile_repair'` | Append **only if `audit_signals` variable is populated**, with a directive prefix: *"Use the category intelligence for category-fit signals and prohibited inferences only; the repair signals above are the primary input."* |
| `none` | not seek, or not business scope | No append (current behavior) |

**Rationale:**
- The discriminator is derivable from `template.category` + `template.prompt_type`, both of which `resolvePrompt()` already has. No migration, no new column, no schema change.
- The `signal_triage` role's "append only if populated" guard is the direct fix for the distractor-block bug: when `audit_signals` is empty (the bug condition), no category block is appended, so the model isn't handed a 300-line distractor with no primary input. When `audit_signals` is populated (after §3.1 lands), the block is appended with the framing directive so the model knows which input is primary.
- The `category_audit` role preserves the current behavior for the four generic audit templates — no regression.

**Trade-off acknowledged:** The derivation rule ("`template.category === 'profile_repair'` → signal_triage") is a string comparison against a category literal. If a future category needs the same signal-driven treatment, the rule must be extended. Acceptable — the alternative (a persisted `prompt_role` column on `mkt_prompt_templates_list`) is over-engineering for a two-value discriminator today, and the derivation rule is in one place.

### 3.4 `business_address`/`business_phone`: Add to Scope Using Composite Address Columns (§11.1 Resolved)

**Decision:** Add `business_address` and `business_phone` to `SCOPE_VARIABLES.business` and to the `candidate` map in `renderTemplate()`. Source them from the campaign's existing columns:

```ts
business_address: [
  campaign.address_line1, campaign.address_city,
  campaign.address_state, campaign.address_zip,
].filter(Boolean).join(', ') || '',
business_phone: campaign.phone || campaign.contact_info || '',
```

Do not remove the references from the template body.

**Rationale:**
- `mkt_campaigns_list` has the composite address columns `address_line1`, `address_line2`, `address_city`, `address_state`, `address_zip`, `address_country` (schema.prisma lines 6194–6199) and `phone` (line 6170) + `contact_info` (line 6126). §11.1 is resolved — no schema change needed, no fallback to audit data needed.
- The Digital Audit Cohesive template uses these fields for identity verification (lines 153–159 of the body), which is a legitimate audit input.
- Removing the references would lose functionality; adding them to the scope map is additive and backward-compatible.
- The composite address join (`address_line1, address_city, address_state, address_zip`) produces a single-line string suitable for prompt substitution. `address_line2` and `address_country` are omitted to keep the output concise; they are rarely populated and the template's "Optional Address" label signals it is not a structured field.

### 3.5 New Escalated Signal Codes: Code-Defined, Registry-Seeded

**Decision:** Add five new `DS_*` signal codes for the escalated repair track (`DS_PROFILE_SUSPENDED`, `DS_DUPLICATE_LISTING`, `DS_HIJACKED_LISTING`, `DS_OWNERSHIP_DISPUTE`, `DS_ADDRESS_VERIFICATION_BLOCK`). Seed them into `mkt_signal_registry` via a seed script (the registry is DATA, per `MarketingSignalRegistryService.ts` lines 4–7), with `detection_source = 'model_emitted'` since the audit LLM emits them.

**Rationale:**
- The triage template's heuristic guardrails reference these five conditions, but the current `DS_*` family has no codes for them. The mapping in §3.2 has nowhere to map *to* without these codes.
- The signal registry is designed for exactly this — admin-extensible codes without an engine deploy. A seed script is the documented path.
- `model_emitted` is correct because the audit LLM detects these conditions from profile screenshots / platform status badges / duplicate-listing scrapes and emits the code in `detected_signals[]`.

### 3.6 Triage Execution: Synchronous, Not Enqueued (Gap 1.1)

**Decision:** The triage endpoint executes the AI call synchronously, mirroring `MarketingExecutionService.executeSingle()`. It creates the execution record, calls the AI provider, updates the record to `completed`, parses the triage recommendation, and returns `{ executionId, recommendation }` in the HTTP response. Resolution (Track B) stays asynchronous via the existing `recovery-resolution.ts` job (extended per §3.8).

**Rationale:**
- No scheduler polls for pending seek/profile-repair executions. `recovery-resolution.ts` line 38 hardcodes `template_id: 'mpt-recovery-resolution-default'`. A pending triage execution would sit forever.
- Triage is an interactive operator workflow — the operator clicks "Run Triage Analysis" and waits for the recommendation. Synchronous execution matches the UX expectation. The AI call for triage is fast (short prompt, short JSON output) so the request duration is acceptable.
- Resolution (Track B) is a background drafting task (longer prompt, longer output, the operator returns later). It stays asynchronous, matching `RecoveryResolutionService.enqueue()`.

**Trade-off acknowledged:** Synchronous AI calls hold the HTTP request open. If the AI provider is slow, the request may approach timeout limits. Mitigation: set a generous route timeout (60s) and surface AI-provider errors as 502s with a retry button.

### 3.7 Output Schema Registrations (Gap 1.2)

**Decision:** Add three Zod schemas + `OUTPUT_SCHEMA_REGISTRY` entries in `apps/api/src/validators/market-analysis.schema.ts`:

| Schema name | Validator | `auditPlatform` | `promptSuffix` |
|---|---|---|---|
| `profile_repair_triage` | `profileRepairTriageSchema` | `null` (triage creates a recommendation, not an audit) | `PROFILE_REPAIR_TRIAGE_PROMPT_SUFFIX` |
| `profile_repair_audit` | `profileRepairAuditSchema` | `null` (per-issue audits create deliverable inputs, not audits) | `PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX` |
| `citation_repair_package` | `citationRepairPackageSchema` | `null` (fulfill creates a deliverable, not an audit) | `CITATION_REPAIR_PACKAGE_PROMPT_SUFFIX` |

Also update the triage template's `output_schema` column from `null` to `{"name": "profile_repair_triage"}` via a seed-script update, so its output is validated.

**Rationale:**
- `resolveOutputSchema()` (line 211) returns `null` for unregistered names. `importExternalResult()` and AI-completion validation paths that expect a registered schema will fail or skip validation. The triage template's `null` schema means its output is not validated at all today.
- The three schemas mirror the JSON shapes the templates already declare in their bodies:
  - `profile_repair_triage`: `{ profile_repair_triage: { severity_score, recommended_track, issue_type_confirmed, rationale, escalation_signals[], standard_signals[] } }`
  - `profile_repair_audit`: `{ profile_repair_audit: { severityScore, issueType, openerAngle, ... } }` (fields vary by issue type — use a permissive schema with required `issueType` + `severityScore`)
  - `citation_repair_package`: `{ deliverableText, submissionGuide }` (same shape as `recovery_resolution`)
- `auditPlatform: null` for all three because these outputs create deliverables/recommendations, not audits. This matches the `recovery_resolution` and `intelligence_profile` precedents.

### 3.8 Scheduler Dispatch for Track B Resolution (Gap 1.3)

**Decision:** Extend `jobs/recovery-resolution.ts` to poll for both template IDs, and dispatch the runner based on `intake_kind`:

```ts
// recovery-resolution.ts — replace the hardcoded template_id filter
const pendingExecutions = await prisma.mkt_prompt_executions_list.findMany({
  where: {
    status: 'pending',
    template_id: {
      in: ['mpt-recovery-resolution-default', 'mpt-profile-repair-resolution-default'],
    },
  },
  take: 10,
});

for (const execution of pendingExecutions) {
  if (execution.template_id === 'mpt-profile-repair-resolution-default') {
    await ProfileRepairPromptService.runResolution(execution.id);
  } else {
    await RecoveryResolutionService.run(execution.id);
  }
}
```

`ProfileRepairPromptService.runResolution(executionId)` mirrors `RecoveryResolutionService.run()` but:
- Finds the intake via `intake_kind === 'profile_repair'` (not `'dispute'`).
- Builds resolution variables from `intake.evidence_payload` (not `owner_statement`/`proposed_resolution`).
- Emits a `reinstatement_appeal` deliverable (not `dispute_resolution`).
- Transitions the campaign to `final_resolution_drafted` (same stage as recovery — the recovery machine is shared per `PROFILE_REPAIR_INTEGRATION_SPEC.md` §4.1).

**Rationale:**
- The scheduler is the only runner for asynchronous resolution. Hardcoding a single template ID means Track B resolution executions are orphaned.
- Dispatching on `template_id` (not `intake_kind` on the execution row) is correct because the execution row stores `template_id`, and the template determines the runner. The runner then loads the intake by `intake_kind` to get the right evidence payload.
- The recovery machine's stages are reused verbatim per the Profile Repair spec (§4.1: `profile_repair/escalated` uses `RECOVERY_TRANSITIONS`). `final_resolution_drafted` is the correct post-draft stage.

### 3.9 `audit_results` Markdown Formatter (Gap 2.4)

**Decision:** `serializeAuditResults(auditData)` produces a structured Markdown string, not raw JSON:

```ts
serializeAuditResults(auditData: BusinessAnalysisAuditData): string {
  const lines: string[] = [];
  // 1. Canonical NAP
  const nap = auditData.nap_consistency;
  if (nap) {
    lines.push('## Canonical NAP');
    lines.push(`- Name: ${nap.canonical_name ?? 'Not verified'}`);
    lines.push(`- Address: ${nap.canonical_address ?? 'Not verified'}`);
    lines.push(`- Phone: ${nap.canonical_phone ?? 'Not verified'}`);
    if (nap.material_issues?.length) {
      lines.push('- Material issues: ' + nap.material_issues.join(', '));
    }
    lines.push('');
  }
  // 2. Platform status
  const platforms = auditData.platforms;
  if (platforms) {
    lines.push('## Platform Status');
    for (const [name, p] of Object.entries(platforms)) {
      lines.push(`- ${name}: ${p.profile_status ?? 'unavailable'}`
        + (p.displayed_name ? ` (${p.displayed_name})` : ''));
    }
    lines.push('');
  }
  // 3. Website
  const web = auditData.website;
  if (web) {
    lines.push('## Website');
    lines.push(`- Status: ${web.status ?? 'unavailable'}`);
    if (web.issues?.length) lines.push('- Issues: ' + web.issues.join(', '));
    lines.push('');
  }
  // 4. Detected signals (for repair context)
  const signals = auditData.detected_signals ?? [];
  if (signals.length > 0) {
    lines.push('## Detected Signals');
    lines.push(signals.map(s => `- ${s}`).join('\n'));
    lines.push('');
  }
  return lines.join('\n');
}
```

**Rationale:**
- The citation-package fulfill template needs structured NAP + platform + website data to produce per-platform fix instructions. Raw JSON dump would be 5–10KB of tokens; the Markdown formatter produces ~500–800 bytes with exactly the fields the template needs.
- The formatter reads the `business_analysis` audit-data shape (the output schema of the Digital Audit templates), which is the canonical audit structure. Fields are accessed defensively (null-safe) because legacy audits may have partial data.
- The `detected_signals` section gives the fulfill prompt context on what was found, so the package can prioritize fixes by severity.

---

## 4. Implementation Scope

### 4.1 `ProfileRepairPromptService` (new file)

**Path:** `apps/api/src/services/ProfileRepairPromptService.ts`

**Pattern:** singleton extends `BaseService` (mirrors `RecoveryResolutionService`).

**Three variable builders:**

```ts
// 4.1a — Seek (triage + per-issue audits)
buildSeekVariables(campaign, latestAudit) → {
  // Route through SignalExtractor (3-tier: model_emitted → derived → operator_input)
  // so legacy audits without detected_signals[] are covered.
  const signalCodes = extractSignals({ campaign, auditData: latestAudit?.audit_data });
  audit_signals: this.serializeSignals(signalCodes),
  issue_type: campaign.repair_issue_type || '',
}

// 4.1b — Fulfill (citation package)
buildFulfillVariables(campaign, latestAudit) → {
  audit_results: this.serializeAuditResults(latestAudit?.audit_data ?? {}),
}

// 4.1c — Resolution (reinstatement appeal)
buildResolutionVariables(campaign, intake) → {
  issueType: campaign.repair_issue_type || '',
  intakePayload: JSON.stringify({
    ownerStatement: intake.owner_statement,
    proposedResolution: intake.proposed_resolution,
  }),
  evidencePayload: JSON.stringify(intake.evidence_payload ?? {}),
  attachmentMeta: JSON.stringify(
    (intake.mkt_dispute_attachments ?? []).map(a => ({ fileName: a.file_name, fileType: a.file_type })),
  ),
}
```

**Signal serializer** (`serializeSignals`):
- Input: `SignalCode[]` array from `SignalExtractor.extractSignals()` (codes like `DS_CLAIMED_STATUS`, `CP_NAP_NAME_DRIFT`).
- Applies the mapping table from §3.2.
- Output: newline-joined string of triage-vocabulary terms, deduped. Example: `"nap_drift\nunclaimed_profile"`.
- Empty input → empty string (so the §3.3 `signal_triage` gate suppresses the category block).

**`audit_results` formatter** (`serializeAuditResults`): per §3.9 — structured Markdown with Canonical NAP, Platform Status, Website, and Detected Signals sections.

**Execution surface** (seek = synchronous per §3.6; resolution = asynchronous per §3.8; copy-paste + import = both):
- `executeSeekSync(campaignId, templateId, ctx)` → `{ executionId, recommendation }` — **synchronous**: builds seek variables, creates a pending execution, calls `MarketingExecutionService.executeSingle()` (which calls the AI provider, stamps the execution `completed`), parses the JSON output against `profileRepairTriageSchema` (or `profileRepairAuditSchema` for per-issue templates), and returns the structured recommendation. This is the method the `/campaigns/:id/repair-triage` route calls.
- `enqueueResolution(campaignId, intakeId, ctx)` → `{ executionId }` — **asynchronous**: builds resolution variables, calls `MarketingPromptService.createExecution({ variablesUsed })` with `status: 'pending'`. The `recovery-resolution.ts` scheduler picks it up and calls `runResolution()`.
- `runResolution(executionId)` → `{ campaignId, passed, stage }` — **scheduler-called**: mirrors `RecoveryResolutionService.run()` but finds the intake via `intake_kind === 'profile_repair'`, builds resolution variables from `evidence_payload`, invokes the AI, emits a `reinstatement_appeal` deliverable, and transitions the campaign to `final_resolution_drafted`.
- `renderPromptText(campaignId, templateId, ctx)` → `{ renderedPrompt, templateId, variablesUsed }` — **copy-paste bridge**: builds variables, interpolates via `resolvePrompt()`, appends output-schema suffix, returns the rendered prompt for the operator to copy into an external AI. Works for both seek and resolution template IDs.
- `importExternalResult(campaignId, templateId, rawOutput, ctx)` → `{ executionId, passed }` — **external import**: builds variables, creates a completed execution, validates output against the template's registered `output_schema` (per §3.7). Works for both seek and resolution.

**Template ID constants:**
```ts
const PROFILE_REPAIR_TRIAGE_TEMPLATE_ID = 'mpt-profile-repair-triage-default';
const PROFILE_REPAIR_NAP_DRIFT_TEMPLATE_ID = 'mpt-profile-repair-nap-drift-seek';
const PROFILE_REPAIR_UNCLAIMED_TEMPLATE_ID = 'mpt-profile-repair-unclaimed-seek';
const PROFILE_REPAIR_PLATFORM_GAP_TEMPLATE_ID = 'mpt-profile-repair-platform-gap-seek';
const PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID = 'mpt-profile-repair-citation-package-fulfill';
const PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID = 'mpt-profile-repair-resolution-default';
```

**Resolution helper** — given a campaign + `repair_issue_type`, return the right seek template ID:
```ts
resolveSeekTemplateId(issueType: string | null): string {
  // null/unknown → triage template (the default)
  // 'nap_drift' → NAP drift template
  // 'unclaimed_profile' → unclaimed template
  // 'platform_gap' → platform gap template
  // escalated issue types → triage template (escalated campaigns use the recovery machine, not seek)
}
```

### 4.2 `resolvePrompt()` Amplification Gate Refinement

**File:** `apps/api/src/services/MarketingExecutionService.ts` (lines 356–407)

**Change:** Replace the current 3-condition gate with a 4-step derivation:

```ts
// 1. Compute prompt_role (derived, not persisted)
const isSeek = template.prompt_type === 'seek';
const isBusinessScope = campaignScope === 'business';
const hasCategory = Boolean(campaign.category);
const isProfileRepair = template.category === 'profile_repair';

const promptRole: 'category_audit' | 'signal_triage' | 'none' =
  !isSeek || !isBusinessScope ? 'none'
  : isProfileRepair ? 'signal_triage'
  : 'category_audit';

// 2. For 'none', return base render (current behavior)
if (promptRole === 'none') {
  return { renderedPrompt: baseRendered, resolution: { ... none ... } };
}

// 3. For 'signal_triage', only append if audit_signals is populated
if (promptRole === 'signal_triage') {
  const auditSignals = input.variables?.audit_signals ?? '';
  if (!auditSignals || !String(auditSignals).trim()) {
    // No signals → no amplification (fixes the distractor-block bug)
    return { renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix), resolution: { ... none ... } };
  }
  if (!hasCategory) {
    return { renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix), resolution: { ... none ... } };
  }
  // Resolve the profile (async — must be awaited; profile may be null)
  const profile = await profileService.resolve(category, undefined, businessCity, ctx);
  if (!profile) {
    // No active profile → no amplification (same as category_audit path)
    return { renderedPrompt: this.appendPromptSuffix(baseRendered, promptSuffix), resolution: { ... none ... } };
  }
  // Append with framing directive
  const profileBlock = profileService.renderBusinessProfileBlock(profile, businessCity);
  const directive = '\n=== CATEGORY INTELLIGENCE (SUPPLEMENTARY — REPAIR SIGNALS ARE PRIMARY) ===\n' +
    'Use the category intelligence below for category-fit signals and prohibited inferences only. ' +
    'The repair signals in the Audit Signals section above are the primary input for this triage.\n';
  const amplified = baseRendered + directive + profileBlock;
  return {
    renderedPrompt: this.appendPromptSuffix(amplified, promptSuffix),
    resolution: { profile_id: profile.id, profile_version: profile.version, intelligence_mode: 'profile' },
  };
}

// 4. For 'category_audit', current behavior (unconditional append)
// ... existing code unchanged (already awaits profileService.resolve + handles null) ...
```

**Regression guarantee:** The `category_audit` path is byte-identical to the current behavior. The `ResolvePrompt.test.ts` suite (which pins byte-identity for no-profile cases) continues to pass. The `signal_triage` path's null-profile guard mirrors the `category_audit` path's existing null guard — both return the base render when no profile is found.

### 4.3 Scope-Map Correction (§11.1 Resolved — Columns Confirmed)

**File:** `apps/api/src/services/scope-utils.ts` (lines 35–45)

**Change:** Add `business_address`, `business_phone` to the `business` scope's allowed list.

**File:** `apps/api/src/services/MarketingExecutionService.ts` (lines 546–566, the `candidate` map)

**Change:** Add to the candidate map using the campaign's composite address columns (`address_line1`/`address_city`/`address_state`/`address_zip` — schema.prisma lines 6194–6199) and `phone`/`contact_info` (lines 6170, 6126):
```ts
business_address: [
  campaign.address_line1, campaign.address_city,
  campaign.address_state, campaign.address_zip,
].filter(Boolean).join(', ') || '',
business_phone: campaign.phone || campaign.contact_info || '',
```

No fallback to audit data is needed — the columns exist on `mkt_campaigns_list` and are populated during campaign creation / directory-enrichment intake. `address_line2` and `address_country` are omitted to keep the output concise (rarely populated; the template labels the field "Optional Address").

### 4.4 Signal Registry Seed Script

**Path:** `apps/api/src/scripts/seed-profile-repair-signals.ts`

**Pattern:** mirrors `seed-intelligence-fragments.ts`.

**Seeds five new `DS_*` codes** into `mkt_signal_registry`:

| `code` | `family` | `label` | `detection_source` |
|---|---|---|---|
| `DS_PROFILE_SUSPENDED` | `DS` | "Google Business Profile suspended" | `model_emitted` |
| `DS_DUPLICATE_LISTING` | `DS` | "Duplicate listing detected" | `model_emitted` |
| `DS_HIJACKED_LISTING` | `DS` | "Listing appears hijacked" | `model_emitted` |
| `DS_OWNERSHIP_DISPUTE` | `DS` | "Ownership dispute evident" | `model_emitted` |
| `DS_ADDRESS_VERIFICATION_BLOCK` | `DS` | "Address verification blocked" | `model_emitted` |

Idempotent — checks for existing code before inserting. Invalidates the signal taxonomy cache on completion.

### 4.5 Route Wiring

**File:** `apps/api/src/routes/marketing-ops.ts`

The existing `/prompts/:id/render` and `/prompts/executions` routes (lines 2028, 2098) stay as-is for operator-driven use. Add two new routes for the repair-specific flow:

- `POST /campaigns/:id/repair-triage` — calls `ProfileRepairPromptService.executeSeekSync(campaignId, triageTemplateId, ctx)`. Returns `{ executionId, recommendation: { severityScore, recommendedTrack, issueTypeConfirmed, rationale, escalationSignals, standardSignals } }`. This is the "Run Triage Analysis" button on the campaign detail triage panel. **Synchronous** — the HTTP response includes the parsed recommendation (per §3.6).
- `POST /campaigns/:id/repair-triage/render` — calls `ProfileRepairPromptService.renderPromptText(campaignId, triageTemplateId, ctx)`. Returns `{ renderedPrompt, templateId, variablesUsed }` for the copy-paste bridge.
- `POST /campaigns/:id/repair-resolution` — calls `ProfileRepairPromptService.enqueueResolution(campaignId, intakeId, ctx)` (Track B, escalated campaigns only). Returns `{ executionId }`. **Asynchronous** — the scheduler picks it up.
- `POST /campaigns/:id/repair-resolution/render` — copy-paste bridge for resolution.
- `POST /campaigns/:id/repair-triage/import` — calls `ProfileRepairPromptService.importExternalResult(campaignId, triageTemplateId, rawOutput, ctx)`. For operator-pasted AI output.

The per-issue seek templates (NAP drift / unclaimed / platform gap) are dispatched by `ProfileRepairPromptService.resolveSeekTemplateId(issueType)` — the route is the same `/repair-triage`, the template is selected by the campaign's `repair_issue_type`.

### 4.6 Frontend Wiring — Triage Panel UI (Gap 3.1)

**File:** `apps/web/src/services/MarketingOpsService.ts`

Add `runRepairTriage(campaignId): Promise<{ executionId, recommendation }>`, `renderRepairTriage(campaignId)`, `importRepairTriage(campaignId, rawOutput)`, `runRepairResolution(campaignId, intakeId)`, `renderRepairResolution(campaignId)` methods wrapping the new routes.

**File:** `apps/web/src/components/marketing-ops/RepairTrackPanel.tsx`

The current panel (lines 77–86) shows only a static amber banner when `repair_track = NULL`. This sprint builds the full triage workflow:

1. **"Run Triage Analysis" button** — visible when `repair_track = NULL`. On click, calls `runRepairTriage(campaign.id)`. Shows a loading spinner during the synchronous AI call (per §3.6, the request stays open until the recommendation returns).
2. **Recommendation card** — rendered when the API returns a recommendation. Displays:
   - Severity score badge (1–10, color-coded: green 1–3, amber 4–6, red 7–10)
   - Recommended track (Standard / Escalated)
   - Confirmed issue type
   - Rationale text
   - Escalation signals list + standard signals list
3. **"Confirm [Standard/Escalated]" button** — one-click confirmation. Calls `switchRepairTrack` with the AI's confirmed issue type in addition to track + reason, so the campaign row's `repair_issue_type` is stamped in the same operation:

   ```ts
   await marketingOpsService.switchRepairTrack(campaign.id, {
     to_track: recommendation.recommendedTrack,
     reason: recommendation.rationale,
     issue_type: recommendation.issueTypeConfirmed || undefined,
   });
   ```

   Refreshes the campaign on success (the panel re-renders with the confirmed track state, which already exists at lines 87–109). Passing `issue_type` here means the operator doesn't have to re-select it in the switch-track dialog — the AI's diagnosis is persisted as part of the confirmation.
4. **"Override" dropdown** — lets the operator pick a different track than recommended. Opens the existing switch-track dialog (lines 120–176) with the AI rationale pre-filled in the reason field but the track selector editable.
5. **Error state** — if the synchronous AI call fails (502 / timeout), show a retry button with the error message.

The existing switch-track dialog (lines 120–176) and confirmed-track display (lines 87–109) are reused unchanged — this sprint only adds the pre-decision triage workflow above them.

### 4.7 Output Schema Registrations (Gap 1.2)

**File:** `apps/api/src/validators/market-analysis.schema.ts`

Add three Zod schemas + `OUTPUT_SCHEMA_REGISTRY` entries (per §3.7):

```ts
// profile_repair_triage — validates the triage template output
const profileRepairTriageSchema = z.object({
  profile_repair_triage: z.object({
    severity_score: z.number().int().min(1).max(10),
    recommended_track: z.enum(['standard', 'escalated']),
    issue_type_confirmed: z.string(),
    rationale: z.string(),
    escalation_signals: z.array(z.string()),
    standard_signals: z.array(z.string()),
  }),
});

// profile_repair_audit — permissive (fields vary by issue type); requires the two constants
const profileRepairAuditSchema = z.object({
  profile_repair_audit: z.object({
    severityScore: z.number().int().min(1).max(10),
    issueType: z.string(),
  }).passthrough(), // openerAngle, missingPlatforms, etc. vary by issue type
});

// citation_repair_package — same shape as recovery_resolution
const citationRepairPackageSchema = z.object({
  deliverableText: z.string(),
  submissionGuide: z.string(),
});
```

Register all three in `OUTPUT_SCHEMA_REGISTRY` with `auditPlatform: null` and appropriate `promptSuffix` constants.

**Seed-script update (in `seed-profile-repair-signals.ts`):** include an `update` on `mkt_prompt_templates_list` to set `output_schema = '{"name": "profile_repair_triage"}'` for `mpt-profile-repair-triage-default` so that imports and `resolveOutputSchema()` lookups link automatically. This is a one-row backfill in the same seed script that registers the new `DS_*` signal codes — no separate migration:

```ts
await prisma.mkt_prompt_templates_list.update({
  where: { id: 'mpt-profile-repair-triage-default' },
  data: { output_schema: { name: 'profile_repair_triage' } as any },
});
```

### 4.8 Scheduler Extension for Track B Resolution (Gap 1.3)

**File:** `apps/api/src/jobs/recovery-resolution.ts` (line 38)

**Change:** Replace the hardcoded `template_id` filter with an `in` clause and dispatch on `template_id`:

```ts
const pendingExecutions = await prisma.mkt_prompt_executions_list.findMany({
  where: {
    status: 'pending',
    template_id: {
      in: ['mpt-recovery-resolution-default', 'mpt-profile-repair-resolution-default'],
    },
  },
  take: 10,
});

for (const execution of pendingExecutions) {
  if (execution.template_id === 'mpt-profile-repair-resolution-default') {
    const { default: ProfileRepairPromptService } = await import('../services/ProfileRepairPromptService');
    await ProfileRepairPromptService.runResolution(execution.id);
  } else {
    await RecoveryResolutionService.run(execution.id);
  }
}
```

`ProfileRepairPromptService.runResolution(executionId)` mirrors `RecoveryResolutionService.run()` (lines 140–200) but:
- Finds the intake via `intake_kind === 'profile_repair'` (not `'dispute'`).
- Builds resolution variables from `intake.evidence_payload` (not `owner_statement`/`proposed_resolution`).
- Emits a `reinstatement_appeal` deliverable (not `dispute_resolution`).
- Transitions the campaign to `final_resolution_drafted` (same recovery-machine stage).

---

## 5. What Already Exists (Zero Code)

- `resolvePrompt()` seam with `variables` override (`MarketingExecutionService.ts` lines 261–407).
- `renderBusinessProfileBlock()` append (`IntelligenceProfileService.ts` lines 879–950).
- `RecoveryResolutionService` three-mode pattern (enqueue / renderPromptText / importExternalResult) — the template for `ProfileRepairPromptService`.
- `SignalExtractor.extractSignals()` (`signal-extractor.ts` line 149) — the 3-tier signal extractor that `ProfileRepairPromptService` calls.
- `MarketingSignalRegistryService` — the registry that the new `DS_*` codes are seeded into.
- `mkt_audits_list.audit_data` JSON column — the source of audit data for `SignalExtractor` and `serializeAuditResults`.
- `mkt_dispute_intake.evidence_payload` JSONB column (Migration 173) — the source of `evidencePayload` for resolution.
- `campaign.repair_issue_type` column (Profile Repair P1 migration) — the source of `issue_type`/`issueType`.
- `campaign.address_line1`/`address_city`/`address_state`/`address_zip` + `phone`/`contact_info` columns (schema.prisma lines 6126, 6170, 6194–6199) — the source of `business_address`/`business_phone`.
- `OUTPUT_SCHEMA_REGISTRY` + `resolveOutputSchema()` (`market-analysis.schema.ts` lines 151–212) — the registry to add the three new schemas to.
- `jobs/recovery-resolution.ts` scheduler — the job to extend for Track B resolution dispatch.
- All six profile-repair prompt templates, seeded and active.
- `RepairTrackPanel.tsx` — the panel shell + confirmed-track display + switch-track dialog (lines 87–176). The triage workflow components are built in this sprint; the existing components are reused.

---

## 6. What Is Net-New

1. `ProfileRepairPromptService.ts` (one new service, ~400 lines — seek/fulfill/resolution builders + signal serializer + audit-results formatter + `executeSeekSync` + `runResolution` + copy-paste + import).
2. `resolvePrompt()` gate refinement (one method, ~30 lines changed — the `signal_triage` branch with profile resolution + `appendPromptSuffix`).
3. `scope-utils.ts` + `MarketingExecutionService.ts` candidate map (two-line additions for `business_address`/`business_phone`).
4. `seed-profile-repair-signals.ts` (one seed script, ~80 lines).
5. Three Zod schemas + `OUTPUT_SCHEMA_REGISTRY` entries in `market-analysis.schema.ts` (~60 lines).
6. `jobs/recovery-resolution.ts` scheduler extension (~10 lines changed — `in` clause + dispatch).
7. Five new routes in `marketing-ops.ts` (triage execute/render/import + resolution execute/render).
8. Five frontend service methods in `MarketingOpsService.ts`.
9. Triage workflow UI in `RepairTrackPanel.tsx` (Run button + loading state + recommendation card + Confirm/Override buttons — ~120 lines of new JSX).
10. Signal-to-triage-vocabulary mapping table (code-defined, ~30 lines in the service).
11. `audit_results` Markdown formatter (~40 lines in the service).

---

## 7. Suggested Slicing

| Slice | Scope | Demo gate |
|-------|-------|-----------|
| **P1** | `ProfileRepairPromptService` seek builder + `SignalExtractor` integration + signal serializer + mapping table; `resolvePrompt()` gate refinement; signal registry seed; `profile_repair_triage` + `profile_repair_audit` output schema registrations; `POST /campaigns/:id/repair-triage` (synchronous) + `/render` + `/import` routes; `RepairTrackPanel.tsx` triage workflow UI (Run button + recommendation card + Confirm/Override) | Triage campaign with a populated audit → "Run Triage Analysis" → synchronous AI call returns → recommendation card renders with severity/track/rationale → operator clicks Confirm → `switchRepairTrack` fires → panel re-renders with confirmed track |
| **P2** | `ProfileRepairPromptService` resolution builder + `runResolution()`; `jobs/recovery-resolution.ts` scheduler extension; `POST /campaigns/:id/repair-resolution` + `/render` routes; frontend wiring | Escalated campaign with submitted intake → `enqueueResolution` creates pending execution → scheduler picks it up → `runResolution` runs AI → `reinstatement_appeal` deliverable created → campaign transitions to `final_resolution_drafted` |
| **P3** | `ProfileRepairPromptService` fulfill builder (citation package) + `serializeAuditResults` Markdown formatter; `citation_repair_package` output schema registration; scope-map fix (`business_address`/`business_phone`); regression test sweep | Paid Track A campaign → citation package prompt has formatted Markdown `audit_results`; Digital Audit Cohesive template renders `{{business_address}}`/`{{business_phone}}` correctly from composite address columns |

P1 is the slice that fixes the bug you observed (empty fields + distractor block) and delivers the end-to-end triage workflow. P2 completes Track B resolution. P3 is cleanup + the scope-map fix.

---

## 8. Test Gates

### 8.1 Unit Tests

**`ProfileRepairPromptService.test.ts`:**
- `buildSeekVariables()` — populated audit → `audit_signals` contains triage-vocabulary terms; `issue_type` from campaign row.
- `buildSeekVariables()` — no audit → `audit_signals` is empty string (so the gate suppresses the category block).
- `buildSeekVariables()` — legacy audit (no `detected_signals[]` but has GBP/NAP fields) → `audit_signals` is populated via `SignalExtractor` derived tier (not empty — proves the SignalExtractor integration).
- `buildSeekVariables()` — audit with `DS_PROFILE_SUSPENDED` → `audit_signals` contains `suspension`.
- `buildSeekVariables()` — audit with `CP_NAP_NAME_DRIFT` + `CP_NAP_ADDRESS_DRIFT` → `audit_signals` contains `nap_drift` once (deduped).
- `buildFulfillVariables()` — audit with NAP + platform data → `audit_results` is a Markdown string with "## Canonical NAP", "## Platform Status", "## Website" sections (not raw JSON).
- `buildResolutionVariables()` — intake with `evidence_payload` → `evidencePayload` is the JSON string of the payload; `attachmentMeta` lists attachments.
- `resolveSeekTemplateId()` — every `repair_issue_type` maps to the right template; null/unknown → triage template; escalated types → triage template.
- `serializeSignals()` — empty `SignalCode[]` → empty string.
- `serializeSignals()` — unknown signal codes (not in mapping table) → omitted from output (not crashed).
- `serializeAuditResults()` — null `auditData` → empty string (not crash).
- `serializeAuditResults()` — partial audit data (only NAP, no platforms) → Markdown with only the NAP section.

**`ResolvePrompt.test.ts` (extend existing):**
- `signal_triage` role + empty `audit_signals` → no category block appended, `appendPromptSuffix` retained (regression guard for the distractor-block bug).
- `signal_triage` role + populated `audit_signals` + active profile → category block appended **with** the framing directive prefix + `appendPromptSuffix` retained.
- `signal_triage` role + populated `audit_signals` + no active profile → no block appended (null-profile guard).
- `signal_triage` role + populated `audit_signals` + no category → no block appended.
- `category_audit` role → byte-identical to current behavior (regression pin).
- `none` role (non-seek / non-business) → no block appended (current behavior).

**`MarketingExecutionService.scope.test.ts` (extend existing):**
- `renderTemplate()` with `business_address`/`business_phone` in the body + business scope → substitutes correctly from composite address columns + phone/contact_info.

**`market-analysis.schema.test.ts` (extend existing):**
- `profileRepairTriageSchema` validates a well-formed triage output; rejects missing `severity_score` / invalid `recommended_track`.
- `profileRepairAuditSchema` validates a per-issue audit output with required `severityScore` + `issueType`; passes through extra fields (permissive).
- `citationRepairPackageSchema` validates `{ deliverableText, submissionGuide }`.
- `resolveOutputSchema('profile_repair_triage')` returns the registered entry (not null).
- `resolveOutputSchema('profile_repair_audit')` returns the registered entry (not null).
- `resolveOutputSchema('citation_repair_package')` returns the registered entry (not null).

### 8.2 Integration Tests

**`profile-repair-prompt-routes.test.ts`:**
- `POST /campaigns/:id/repair-triage` with a campaign that has an audit → 200 with `{ executionId, recommendation }`; execution's `variables_used.audit_signals` is populated; `recommendation.severityScore` is 1–10; `recommendation.recommendedTrack` is `'standard'` or `'escalated'`.
- `POST /campaigns/:id/repair-triage` with a campaign that has no audit → 200 with `{ executionId, recommendation }`; `variables_used.audit_signals` is empty string; recommendation still returns (the AI sees empty signals and recommends standard/low severity).
- `POST /campaigns/:id/repair-triage` with a legacy audit (no `detected_signals[]` but has GBP/NAP fields) → `variables_used.audit_signals` is populated via `SignalExtractor` derived tier (not empty).
- `POST /campaigns/:id/repair-triage/render` → 200 with `renderedPrompt` containing filled `{{audit_signals}}`/`{{issue_type}}` and the framing directive (when signals are present).
- `POST /campaigns/:id/repair-triage/import` with valid triage JSON → 201; execution status `completed`; output validated against `profileRepairTriageSchema`.
- `POST /campaigns/:id/repair-triage/import` with malformed JSON → 400 with validation error.
- `POST /campaigns/:id/repair-resolution` with an escalated campaign + submitted intake → 201; `variables_used.evidencePayload` is the intake's evidence payload JSON.
- Cross-customer isolation: customer A cannot trigger triage/resolution on customer B's campaign (404).

**`recovery-resolution-scheduler.test.ts` (extend existing):**
- Scheduler polls both `mpt-recovery-resolution-default` and `mpt-profile-repair-resolution-default` pending executions.
- `mpt-profile-repair-resolution-default` execution → `ProfileRepairPromptService.runResolution()` is called (not `RecoveryResolutionService.run()`).
- `runResolution()` finds the intake via `intake_kind === 'profile_repair'` (not `'dispute'`).
- `runResolution()` emits a `reinstatement_appeal` deliverable and transitions the campaign to `final_resolution_drafted`.

### 8.3 Regression

- Existing `ResolvePrompt.test.ts` suite passes unchanged (the `category_audit` path is byte-identical).
- Existing `recoveryResolution.test.ts` suite passes unchanged (recovery path is untouched — the scheduler dispatch is additive).
- Existing `MarketingExecutionService.scope.test.ts` suite passes unchanged (scope map is additive only).

---

## 9. BFRI Assessment (per backend-dev-guidelines)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Architectural Fit | 5 | Strictly reuses routes → services → repositories; mirrors a proven pattern (`RecoveryResolutionService`); no new layers |
| Business Logic Complexity | 4 | Signal mapping table, derived discriminator, three variable builders, synchronous triage execution, scheduler dispatch, output schema registrations, audit-results formatter — more moving parts than v1.0 estimated |
| Data Risk | 1 | No schema changes (signal registry is DATA, seeded by script; triage template `output_schema` update is a seed-script row update); scope-map change is additive; `resolvePrompt()` change is logic-only |
| Operational Risk | 3 | Synchronous AI call holds HTTP request (timeout risk); scheduler extension touches a running job; the gate refinement has a regression pin (byte-identity for `category_audit`) |
| Testability | 5 | Direct unit-test surface for the service + gate + schemas; integration test surface for the routes + scheduler; existing test patterns directly applicable |

**BFRI = (5 + 4) − (1 + 3 + 5) = 0 → Balanced.** Complexity rose from 3→4 (synchronous execution + scheduler dispatch + schema registrations) and operational risk rose from 2→3 (synchronous AI timeout + scheduler extension). Both are mitigated: the synchronous call has a retry button on failure, the scheduler extension is additive (existing dispute path unchanged), and the gate change has a byte-identity regression pin.

---

## 10. Out of Scope

- **Automated triage confirmation.** The spec's open question §11.2 (high-confidence recommendations auto-confirming) is deferred — this sprint ships operator-confirmed triage only.
- **Scraper-driven signal emission.** The five new `DS_*` codes are seeded into the registry, but the audit LLM's prompt is not updated to emit them. That is a separate prompt-engineering task (the Digital Audit templates would need their signal-taxonomy sections extended). This sprint assumes the codes are populated via operator import or a future audit-prompt update.
- **Generalizing `RecoveryResolutionService` and `ProfileRepairPromptService` into a shared abstraction.** Deferred per §3.1 — two concrete examples first.
- **Persisted `prompt_role` column.** Derived per §3.3 — no migration.
- **Triage panel UX beyond the workflow components.** This sprint builds the Run button, recommendation card, and Confirm/Override buttons. Broader panel redesign (e.g. signal-by-signal breakdown, historical triage runs) is deferred.

---

## 11. Open Questions

### 11.1 `business_address`/`business_phone` column existence — RESOLVED

**Resolved in v1.1.** `mkt_campaigns_list` has composite address columns (`address_line1`, `address_line2`, `address_city`, `address_state`, `address_zip`, `address_country` — schema.prisma lines 6194–6199) and `phone` (line 6170) + `contact_info` (line 6126). No schema change needed. The scope-map fix (§4.3) uses the composite address join + phone/contact_info fallback. No fallback to audit data is needed.

### 11.2 Escalated signal detection in the audit LLM

The five new `DS_*` codes are seeded but the audit prompt templates don't yet instruct the LLM to emit them. Should this sprint also update the Digital Audit templates' signal-taxonomy sections to include the new codes, or is that a separate prompt-engineering follow-up? Recommend separate follow-up — the codes are useful for operator-imported audits immediately, and the prompt update is a one-template-text change that doesn't need code deployment.

### 11.3 Triage template selection for escalated issue types

When `repair_issue_type` is an escalated type (`suspension`, `hijacked_listing`, etc.) and the campaign is on the recovery machine (not seek), should the triage template still run? Current plan: no — escalated campaigns use the recovery machine and the resolution template, not the seek triage template. The triage template is for `repair_track = NULL` (pre-decision) campaigns only. Confirm this matches operator expectations.

### 11.4 Signal mapping extensibility

The mapping table in §3.2 is code-defined. If the signal registry grows new codes (via admin UI, no deploy), the mapping won't recognize them until a code update. Is this acceptable, or should the mapping be stored in the registry row (e.g., a `triage_vocab` column on `mkt_signal_registry`)? Recommend code-defined for now — the mapping is between two closed vocabularies, and a DB column adds migration surface for no current benefit. Revisit if the triage vocabulary grows beyond 10 terms.

### 11.5 Synchronous triage timeout

The synchronous triage call (§3.6) holds the HTTP request open. What is the route timeout? Default Express/Next.js timeouts may be 30s; AI calls can take 10–30s for a short triage prompt. Recommend a 60s route timeout with a 502 + retry button on timeout. Confirm the deployment environment (reverse proxy, load balancer) allows 60s requests.

---

## 12. References

- `apps/api/src/services/MarketingExecutionService.ts` — `resolvePrompt()` (lines 261–407), `renderTemplate()` (lines 530–586), `executeSingle()` (line 113)
- `apps/api/src/services/scope-utils.ts` — `SCOPE_VARIABLES` (lines 35–45)
- `apps/api/src/services/intelligence/IntelligenceProfileService.ts` — `renderBusinessProfileBlock()` (lines 879–950)
- `apps/api/src/services/RecoveryResolutionService.ts` — variable-builder pattern (lines 95–115, 780–802, 851–871), `intake_kind === 'dispute'` hardcoding (lines 381, 766, 846, 1038)
- `apps/api/src/services/MarketingSignalRegistryService.ts` — signal registry CRUD
- `apps/api/src/services/triage/signal-extractor.ts` — `extractSignals()` (line 149), 3-tier extraction precedence
- `apps/api/src/validators/market-analysis.schema.ts` — `OUTPUT_SCHEMA_REGISTRY` (lines 151–201), `resolveOutputSchema()` (lines 207–212)
- `apps/api/src/jobs/recovery-resolution.ts` — scheduler with hardcoded `template_id` filter (line 38)
- `apps/api/src/routes/marketing-ops.ts` — existing prompt routes (lines 2028, 2098)
- `apps/api/prisma/schema.prisma` — `mkt_audits_list` (line 6074), `mkt_dispute_intake.evidence_payload` (line 6865), `mkt_campaigns_list.repair_track`/`repair_issue_type` (lines 6187–6188), `mkt_campaigns_list` composite address columns (lines 6194–6199), `phone` (line 6170), `contact_info` (line 6126)
- `apps/web/src/components/marketing-ops/RepairTrackPanel.tsx` — static amber banner (lines 77–86), confirmed-track display (lines 87–109), switch-track dialog (lines 120–176)
- `docs/api-response/seek-prompt-templates.md` — live template inventory (36 templates)
- `docs/LocalBiz/PROFILE_REPAIR_INTEGRATION_SPEC.md` — §2.2 triage-first, §5.2.2 seeded prompts, §6.2.3 resolution template
- `docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md` — §1B profile-amplified business audit resolution
