# Sprint Plan: Marketing Ops — Prompt Variable Injection & Amplification Gating

**Document Version:** 1.0
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

This sprint closes both gaps with three coordinated changes:

1. **`ProfileRepairPromptService`** — a variable-builder service mirroring `RecoveryResolutionService`, sourcing `audit_signals`/`issue_type`/`audit_results`/`evidencePayload`/`attachmentMeta` from campaign + audit + intake data and passing them through the existing `variables` override in `resolvePrompt()`.
2. **Prompt-role discriminator** — a derived field on the amplification gate so the category block is appended with the right framing for signal-driven templates, and only when the signal variables are actually populated.
3. **Scope-map fix** — `business_address`/`business_phone` are referenced in the Digital Audit Cohesive template body but absent from `SCOPE_VARIABLES.business`; either add them or remove the references.

No new pipeline architecture, no new tables, no new stage machine. The work is one new service, one refined gate, one scope-map correction, and tests.

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

---

## 3. Design Decisions

### 3.1 Variable Builder: Mirror `RecoveryResolutionService`, Do Not Generalize

**Decision:** Create `ProfileRepairPromptService` as a sibling of `RecoveryResolutionService`, with three variable builders (seek/fulfill/resolution) and the same three-mode execution surface (direct API, copy-paste bridge, external import). Do not generalize the two services into a shared `PromptVariableBuilder` abstraction.

**Rationale:**
- The two services have different domain shapes: recovery reads `campaign.notes` + `intake.owner_statement`/`proposed_resolution`; repair reads `mkt_audits_list.audit_data.detected_signals` + `campaign.repair_issue_type` + `intake.evidence_payload`. A shared abstraction would have to parameterize the source shape, which is more code than the duplication.
- `RecoveryResolutionService` is the proven pattern (shipped, tested, in production). Mirroring it is the lowest-risk path.
- The three-mode execution surface (direct / copy-paste / external) is the same for both; if a shared abstraction becomes warranted later, it can be extracted from two concrete examples instead of speculatively designed.

**Trade-off acknowledged:** Some structural duplication (the `enqueue()` / `renderPromptText()` / `importExternalResult()` trio). Acceptable — the bodies differ.

### 3.2 Signal Sourcing: Read `detected_signals` From the Latest Audit

**Decision:** `audit_signals` is sourced from the latest `mkt_audits_list` row for the campaign, reading `audit_data.detected_signals` (the JSON array the Digital Audit templates already emit). Map the raw signal codes (`RA_*`, `DS_*`, `WC_*`, `CP_*`, `VP_*`, `INT_*`) to the triage vocabulary the template's heuristic guardrails expect (`suspension`, `hijacked_listing`, `duplicate_listing`, `ownership_dispute`, `address_verification_block`, `nap_drift`, `unclaimed_profile`, `missing_category`, `missing_hours`, `platform_gap`) via a code-defined mapping table.

**Rationale:**
- The audit JSON is the system of record for detected signals — `mkt_audits_list.audit_data` and `mkt_prospect_queue.detected_signals` both store this array (schema lines 6088, 7036).
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

### 3.4 `business_address`/`business_phone`: Add to Scope, Do Not Remove From Template

**Decision:** Add `business_address` and `business_phone` to `SCOPE_VARIABLES.business` and to the `candidate` map in `renderTemplate()`, sourced from `campaign.business_address`/`campaign.business_phone` if those columns exist, else from the latest audit's `audit_data.matched_business.address`/`phone`. Do not remove the references from the template body.

**Rationale:**
- The Digital Audit Cohesive template uses these fields for identity verification (lines 153–159 of the body), which is a legitimate audit input.
- Removing the references would lose functionality; adding them to the scope map is additive and backward-compatible.
- If the campaign row does not have `business_address`/`business_phone` columns (needs schema check during implementation), source from the audit's matched-business block. The audit JSON already contains `matched_business.address`/`phone` per the template's output schema.

**Open question (§11.1):** whether `mkt_campaigns_list` has `business_address`/`business_phone` columns or whether they must be sourced from the audit. To be resolved at implementation time by reading `schema.prisma`.

### 3.5 New Escalated Signal Codes: Code-Defined, Registry-Seeded

**Decision:** Add five new `DS_*` signal codes for the escalated repair track (`DS_PROFILE_SUSPENDED`, `DS_DUPLICATE_LISTING`, `DS_HIJACKED_LISTING`, `DS_OWNERSHIP_DISPUTE`, `DS_ADDRESS_VERIFICATION_BLOCK`). Seed them into `mkt_signal_registry` via a seed script (the registry is DATA, per `MarketingSignalRegistryService.ts` lines 4–7), with `detection_source = 'model_emitted'` since the audit LLM emits them.

**Rationale:**
- The triage template's heuristic guardrails reference these five conditions, but the current `DS_*` family has no codes for them. The mapping in §3.2 has nowhere to map *to* without these codes.
- The signal registry is designed for exactly this — admin-extensible codes without an engine deploy. A seed script is the documented path.
- `model_emitted` is correct because the audit LLM detects these conditions from profile screenshots / platform status badges / duplicate-listing scrapes and emits the code in `detected_signals[]`.

---

## 4. Implementation Scope

### 4.1 `ProfileRepairPromptService` (new file)

**Path:** `apps/api/src/services/ProfileRepairPromptService.ts`

**Pattern:** singleton extends `BaseService` (mirrors `RecoveryResolutionService`).

**Three variable builders:**

```ts
// 4.1a — Seek (triage + per-issue audits)
buildSeekVariables(campaign, latestAudit) → {
  // in-scope vars come from renderTemplate()'s candidate map
  audit_signals: this.serializeSignals(latestAudit?.audit_data?.detected_signals ?? []),
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
- Input: raw `detected_signals` array from audit JSON (codes like `DS_CLAIMED_STATUS`, `CP_NAP_NAME_DRIFT`).
- Applies the mapping table from §3.2.
- Output: newline-joined string of triage-vocabulary terms, deduped. Example: `"nap_drift\nunclaimed_profile"`.
- Empty input → empty string (so the §3.3 `signal_triage` gate suppresses the category block).

**Three-mode execution surface** (mirrors `RecoveryResolutionService`):
- `enqueueSeek(campaignId, templateId, ctx)` — builds seek variables, calls `MarketingPromptService.createExecution({ variablesUsed })`.
- `enqueueResolution(campaignId, intakeId, ctx)` — builds resolution variables, same path.
- `renderPromptText(campaignId, templateId, ctx)` — builds variables, interpolates, appends output-schema suffix, returns `{ renderedPrompt, templateId, variablesUsed }` for the copy-paste bridge.
- `importExternalResult(campaignId, templateId, rawOutput, ctx)` — builds variables, creates a completed execution, validates output against the template's `output_schema`.

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
    return { renderedPrompt: baseRendered, resolution: { ... none ... } };
  }
  if (!hasCategory) {
    return { renderedPrompt: baseRendered, resolution: { ... none ... } };
  }
  // Append with framing directive
  const profileBlock = profileService.renderBusinessProfileBlock(profile, businessCity);
  const directive = '\n=== CATEGORY INTELLIGENCE (SUPPLEMENTARY — REPAIR SIGNALS ARE PRIMARY) ===\n' +
    'Use the category intelligence below for category-fit signals and prohibited inferences only. ' +
    'The repair signals in the Audit Signals section above are the primary input for this triage.\n';
  const amplified = baseRendered + directive + profileBlock;
  return { renderedPrompt: amplified, resolution: { ... profile ... } };
}

// 4. For 'category_audit', current behavior (unconditional append)
// ... existing code unchanged ...
```

**Regression guarantee:** The `category_audit` path is byte-identical to the current behavior. The `ResolvePrompt.test.ts` suite (which pins byte-identity for no-profile cases) continues to pass.

### 4.3 Scope-Map Correction

**File:** `apps/api/src/services/scope-utils.ts` (lines 35–45)

**Change:** Add `business_address`, `business_phone` to the `business` scope's allowed list.

**File:** `apps/api/src/services/MarketingExecutionService.ts` (lines 546–566, the `candidate` map)

**Change:** Add to the candidate map:
```ts
business_address: campaign.business_address || '',  // if column exists
business_phone: campaign.business_phone || '',      // if column exists
```

If the columns do not exist on `mkt_campaigns_list` (§11.1), source from the latest audit's `audit_data.matched_business.address`/`phone` instead — this requires `resolvePrompt()` to load the latest audit, which it does not today. In that case, defer this sub-task to a follow-up and instead remove the `{{business_address}}`/`{{business_phone}}` references from the template body (the simpler fix).

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

- `POST /campaigns/:id/repair-triage` — calls `ProfileRepairPromptService.enqueueSeek(campaignId, triageTemplateId, ctx)`. Returns `{ executionId }`. This is the "Run Triage Analysis" button on the campaign detail triage panel (per `PROFILE_REPAIR_INTEGRATION_SPEC.md` §7).
- `POST /campaigns/:id/repair-triage/render` — calls `ProfileRepairPromptService.renderPromptText(campaignId, triageTemplateId, ctx)`. Returns `{ renderedPrompt, templateId, variablesUsed }` for the copy-paste bridge.
- `POST /campaigns/:id/repair-resolution` — calls `ProfileRepairPromptService.enqueueResolution(campaignId, intakeId, ctx)` (Track B, escalated campaigns only).
- `POST /campaigns/:id/repair-resolution/render` — copy-paste bridge for resolution.

The per-issue seek templates (NAP drift / unclaimed / platform gap) are dispatched by `ProfileRepairPromptService.resolveSeekTemplateId(issueType)` — the route is the same `/repair-triage`, the template is selected by the campaign's `repair_issue_type`.

### 4.6 Frontend Wiring (minimal)

**File:** `apps/web/src/services/MarketingOpsService.ts`

Add `runRepairTriage(campaignId)`, `renderRepairTriage(campaignId)`, `runRepairResolution(campaignId, intakeId)`, `renderRepairResolution(campaignId)` methods wrapping the new routes.

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx` (or the campaign detail client, per existing profile-repair UI)

Wire the "Run Triage Analysis" button to `runRepairTriage`. The triage panel already exists per Profile Repair P1 (`PROFILE_REPAIR_INTEGRATION_SPEC.md` §7: "Triage panel when `repair_track = NULL`: severity score, AI-recommended track + rationale, Confirm/Override buttons"). This sprint makes the button actually produce a recommendation.

---

## 5. What Already Exists (Zero Code)

- `resolvePrompt()` seam with `variables` override (`MarketingExecutionService.ts` lines 261–407).
- `renderBusinessProfileBlock()` append (`IntelligenceProfileService.ts` lines 879–950).
- `RecoveryResolutionService` three-mode pattern (enqueue / renderPromptText / importExternalResult) — the template for `ProfileRepairPromptService`.
- `MarketingSignalRegistryService` — the registry that the new `DS_*` codes are seeded into.
- `mkt_audits_list.audit_data` JSON column — the source of `detected_signals`.
- `mkt_dispute_intake.evidence_payload` JSONB column (Migration 173) — the source of `evidencePayload` for resolution.
- `campaign.repair_issue_type` column (Profile Repair P1 migration) — the source of `issue_type`/`issueType`.
- All six profile-repair prompt templates, seeded and active.
- The triage panel UI (Profile Repair P1) — just needs the button wired.

---

## 6. What Is Net-New

1. `ProfileRepairPromptService.ts` (one new service, ~300 lines).
2. `resolvePrompt()` gate refinement (one method, ~20 lines changed).
3. `scope-utils.ts` + `MarketingExecutionService.ts` candidate map (two-line additions, if §11.1 resolves favorably).
4. `seed-profile-repair-signals.ts` (one seed script, ~80 lines).
5. Two new routes in `marketing-ops.ts` (triage + resolution, each with enqueue + render).
6. Four frontend service methods + one button wiring.
7. Signal-to-triage-vocabulary mapping table (code-defined, ~30 lines in the service).

---

## 7. Suggested Slicing

| Slice | Scope | Demo gate |
|-------|-------|-----------|
| **P1** | `ProfileRepairPromptService` seek builder + signal serializer + mapping table; `resolvePrompt()` gate refinement; signal registry seed; `POST /campaigns/:id/repair-triage` + `/render` routes; frontend button wiring | Triage campaign with a populated audit → "Run Triage Analysis" → rendered prompt has filled `audit_signals`/`issue_type` fields + category block with framing directive; AI returns severity + track recommendation; operator confirms |
| **P2** | `ProfileRepairPromptService` resolution builder + `POST /campaigns/:id/repair-resolution` + `/render` routes; frontend wiring | Escalated campaign with submitted intake → "Run Resolution" → rendered prompt has filled `issueType`/`intakePayload`/`evidencePayload`/`attachmentMeta`; AI returns appeal letter + submission guide |
| **P3** | `ProfileRepairPromptService` fulfill builder (citation package); scope-map fix (`business_address`/`business_phone`); regression test sweep | Paid Track A campaign → citation package prompt has filled `audit_results`; Digital Audit Cohesive template renders `{{business_address}}`/`{{business_phone}}` correctly |

P1 is the slice that fixes the bug you observed. P2 completes Track B. P3 is cleanup.

---

## 8. Test Gates

### 8.1 Unit Tests

**`ProfileRepairPromptService.test.ts`:**
- `buildSeekVariables()` — populated audit → `audit_signals` contains triage-vocabulary terms; `issue_type` from campaign row.
- `buildSeekVariables()` — no audit → `audit_signals` is empty string (so the gate suppresses the category block).
- `buildSeekVariables()` — audit with `DS_PROFILE_SUSPENDED` → `audit_signals` contains `suspension`.
- `buildSeekVariables()` — audit with `CP_NAP_NAME_DRIFT` + `CP_NAP_ADDRESS_DRIFT` → `audit_signals` contains `nap_drift` once (deduped).
- `buildResolutionVariables()` — intake with `evidence_payload` → `evidencePayload` is the JSON string of the payload; `attachmentMeta` lists attachments.
- `resolveSeekTemplateId()` — every `repair_issue_type` maps to the right template; null/unknown → triage template; escalated types → triage template.

**`ResolvePrompt.test.ts` (extend existing):**
- `signal_triage` role + empty `audit_signals` → no category block appended (regression guard for the distractor-block bug).
- `signal_triage` role + populated `audit_signals` → category block appended **with** the framing directive prefix.
- `signal_triage` role + populated `audit_signals` + no category → no block appended.
- `category_audit` role → byte-identical to current behavior (regression pin).
- `none` role (non-seek / non-business) → no block appended (current behavior).

**`MarketingExecutionService.scope.test.ts` (extend existing):**
- `renderTemplate()` with `business_address`/`business_phone` in the body + business scope → substitutes correctly (if §11.1 resolves favorably).

### 8.2 Integration Tests

**`profile-repair-prompt-routes.test.ts`:**
- `POST /campaigns/:id/repair-triage` with a campaign that has an audit → 201 with `executionId`; execution's `variables_used.audit_signals` is populated.
- `POST /campaigns/:id/repair-triage` with a campaign that has no audit → 201 with `executionId`; `variables_used.audit_signals` is empty string.
- `POST /campaigns/:id/repair-triage/render` → 200 with `renderedPrompt` containing filled `{{audit_signals}}`/`{{issue_type}}` and the framing directive.
- `POST /campaigns/:id/repair-resolution` with an escalated campaign + submitted intake → 201; `variables_used.evidencePayload` is the intake's evidence payload JSON.
- Cross-customer isolation: customer A cannot trigger triage/resolution on customer B's campaign (404).

### 8.3 Regression

- Existing `ResolvePrompt.test.ts` suite passes unchanged (the `category_audit` path is byte-identical).
- Existing `recoveryResolution.test.ts` suite passes unchanged (recovery path is untouched).
- Existing `MarketingExecutionService.scope.test.ts` suite passes unchanged (scope map is additive only).

---

## 9. BFRI Assessment (per backend-dev-guidelines)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Architectural Fit | 5 | Strictly reuses routes → services → repositories; mirrors a proven pattern (`RecoveryResolutionService`); no new layers |
| Business Logic Complexity | 3 | One mapping table (signal → triage vocab), one derived discriminator, three variable builders — all straightforward |
| Data Risk | 1 | No schema changes (signal registry is DATA, seeded by script); scope-map change is additive; `resolvePrompt()` change is logic-only |
| Operational Risk | 2 | New routes are operator-triggered (no automated cascade); the gate refinement has a regression pin (byte-identity for `category_audit`) |
| Testability | 5 | Direct unit-test surface for the service + gate; integration test surface for the routes; existing test patterns directly applicable |

**BFRI = (5 + 3) − (1 + 2 + 5) = 0 → Balanced.** The complexity is low because the pattern is proven and the changes are additive. The only risk is the `resolvePrompt()` gate change, which is mitigated by the byte-identity regression pin.

---

## 10. Out of Scope

- **Automated triage confirmation.** The spec's open question §11.2 (high-confidence recommendations auto-confirming) is deferred — this sprint ships operator-confirmed triage only.
- **Scraper-driven signal emission.** The five new `DS_*` codes are seeded into the registry, but the audit LLM's prompt is not updated to emit them. That is a separate prompt-engineering task (the Digital Audit templates would need their signal-taxonomy sections extended). This sprint assumes the codes are populated via operator import or a future audit-prompt update.
- **Generalizing `RecoveryResolutionService` and `ProfileRepairPromptService` into a shared abstraction.** Deferred per §3.1 — two concrete examples first.
- **Persisted `prompt_role` column.** Derived per §3.3 — no migration.
- **Frontend triage-panel UX redesign.** The panel exists (Profile Repair P1); this sprint only wires the button.

---

## 11. Open Questions

### 11.1 `business_address`/`business_phone` column existence

Does `mkt_campaigns_list` have `business_address`/`business_phone` columns, or must they be sourced from the latest audit's `audit_data.matched_business`? To be resolved at P3 implementation time by reading `schema.prisma`. If the columns don't exist, the simpler fix is removing the `{{business_address}}`/`{{business_phone}}` references from the Digital Audit Cohesive template body (they're optional inputs per the template's own wording: "Optional Address" / "Optional Phone").

### 11.2 Escalated signal detection in the audit LLM

The five new `DS_*` codes are seeded but the audit prompt templates don't yet instruct the LLM to emit them. Should this sprint also update the Digital Audit templates' signal-taxonomy sections to include the new codes, or is that a separate prompt-engineering follow-up? Recommend separate follow-up — the codes are useful for operator-imported audits immediately, and the prompt update is a one-template-text change that doesn't need code deployment.

### 11.3 Triage template selection for escalated issue types

When `repair_issue_type` is an escalated type (`suspension`, `hijacked_listing`, etc.) and the campaign is on the recovery machine (not seek), should the triage template still run? Current plan: no — escalated campaigns use the recovery machine and the resolution template, not the seek triage template. The triage template is for `repair_track = NULL` (pre-decision) campaigns only. Confirm this matches operator expectations.

### 11.4 Signal mapping extensibility

The mapping table in §3.2 is code-defined. If the signal registry grows new codes (via admin UI, no deploy), the mapping won't recognize them until a code update. Is this acceptable, or should the mapping be stored in the registry row (e.g., a `triage_vocab` column on `mkt_signal_registry`)? Recommend code-defined for now — the mapping is between two closed vocabularies, and a DB column adds migration surface for no current benefit. Revisit if the triage vocabulary grows beyond 10 terms.

---

## 12. References

- `apps/api/src/services/MarketingExecutionService.ts` — `resolvePrompt()` (lines 261–407), `renderTemplate()` (lines 530–586)
- `apps/api/src/services/scope-utils.ts` — `SCOPE_VARIABLES` (lines 35–45)
- `apps/api/src/services/intelligence/IntelligenceProfileService.ts` — `renderBusinessProfileBlock()` (lines 879–950)
- `apps/api/src/services/RecoveryResolutionService.ts` — variable-builder pattern (lines 95–115, 780–802, 851–871)
- `apps/api/src/services/MarketingSignalRegistryService.ts` — signal registry CRUD
- `apps/api/src/routes/marketing-ops.ts` — existing prompt routes (lines 2028, 2098)
- `apps/api/prisma/schema.prisma` — `mkt_audits_list` (line 6074), `mkt_dispute_intake.evidence_payload` (line 6865), `mkt_campaigns_list.repair_track`/`repair_issue_type` (lines 6187–6188)
- `docs/api-response/seek-prompt-templates.md` — live template inventory (36 templates)
- `docs/LocalBiz/PROFILE_REPAIR_INTEGRATION_SPEC.md` — §2.2 triage-first, §5.2.2 seeded prompts, §6.2.3 resolution template
- `docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md` — §1B profile-amplified business audit resolution
