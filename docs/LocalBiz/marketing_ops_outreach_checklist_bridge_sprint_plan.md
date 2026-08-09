# Marketing Ops — Outreach ↔ Checklist/Signal Bridge Sprint Plan

**Status:** ✅ Implemented (Sprint 1) — 2026-08-09
**Date:** 2026-08-09
**Prerequisite sprints:** Operator Checklist (174/175), Outreach Openers (A1–A6), Pitch Construction, Playbook Catalog + Triage (PB-01..PB-07), Signal Registry

## 1. Problem

The campaign execution layer (Openers, Follow-Ups, Pitch Construction) and the
planning layer (Playbooks, Signal Registry, Checklist Builder) are two
disconnected worlds. An operator working a campaign sees:

- **Checklist tab** — says "do outreach" as a manual checkbox with a `channel`
  field. No link to the openers workspace, no awareness of whether an
  opener/follow-up/pitch exists, no archetype context.
- **Openers workspace** (`/marketing-ops/openers`) — where the actual
  opener/follow-up/pitch work happens. Doesn't reference the checklist, doesn't
  report back, doesn't know which checklist step it satisfies.

### Concrete gaps verified in the codebase

1. **`outreach` step type is a hollow label.** `CampaignChecklistTab.tsx`
   (lines 427–447) deep-links for `url_check` (opens URL), `ai_prompt` (shows
   `prompt_template_id`), and `credentials` (shows `credential_ref`). For
   `outreach` — **nothing**. Just a checkbox + a `channel` string in
   `action_config`.

2. **No internal-link step type.** The 6 step types (`manual`, `url_check`,
   `ai_prompt`, `deliverable`, `outreach`, `credentials`) have no way to
   deep-link to an **internal** app page or tab. `url_check` opens an
   external URL only. There's no step type that says "go to the Deliverables
   tab" or "open the Openers workspace for this campaign" — operators have
   no clickable action that takes them to the right place in the app. Every
   non-`url_check` step is either a manual checkbox or a static label.

3. **Signal Registry has zero outreach-state signals.** All 31 codes in
   `signal-taxonomy.ts` detect *prospect problems* (review drought, NAP drift,
   missing CTA, photo deficit). None detect *outreach execution state* — no
   `opener_sent`, `follow_up_n_sent`, `pitch_assembled`, `no_reply_after_n`.
   The signal system feeds triage → playbook, but the outreach cycle is
   invisible to it.

4. **Pitch Construction starters are hardcoded in the frontend.**
   `HEADER_STARTERS`, `CLOSER_STARTERS`, `CONTACT_STARTERS` in
   `PitchConstructionPanel.tsx` are keyed by archetype but live entirely in
   the component. A playbook catalog change doesn't propagate to pitch
   starters; the starters can drift from the playbook's actual intent.

5. **The only bridge is one-way and read-only.**
   `resolveCampaignArchetype` (in `OutreachOpenerService.ts`) reads the triage
   result's `playbook.archetype` to pick the opener prompt. That's a one-time
   read at generation. The checklist doesn't know the archetype, the pitch
   workspace doesn't know the checklist progress, and completing an outreach
   step doesn't auto-detect that an opener was executed.

6. **Starter steps (migration 174) use `outreach` generically.** Every
   playbook's outreach steps (PB-01 step 7, PB-02 steps 4+6, PB-03 step 6,
   PB-04 step 6, PB-05 step 6, PB-06 steps 2+6, PB-07 steps 2+6) are
   `step_type='outreach'` with `action_config='{"channel":"email"}'`. None
   distinguish "send opener" from "send follow-up" from "assemble pitch" from
   "log a contact attempt". The OutreachFollowUpCard on the overview tab
   tracks contact logs (`mkt_outreach_log`) — a separate system from the
   checklist's outreach checkbox.

7. **Operator suggestion form is stripped to manual-only.** The
   `SuggestionFormModal` (`CampaignChecklistTab.tsx` lines 560–687) captures
   only: suggestion kind, position, proposed title, stage, proposed
   instructions, and rationale. It does **not** capture `stepType` or
   `actionConfig`. The backend's `applyAddSuggestion` (line 711) already
   reads `proposedStep.stepType` and `proposedStep.actionConfig` — but the
   frontend never sends them, so every operator suggestion defaults to
   `step_type='manual'`. An operator can't suggest "add a url_check step
   that opens GBP" or "add an internal_link step to the Openers workspace".

### Net effect

The Checklist Builder produces starter steps that are blind to the entire
outreach execution pipeline that's already built and operational. Operators
maintain two parallel mental models and two parallel UIs for the same work.

---

## 2. Goal

Bridge the two layers so that:

- An `outreach` checklist step knows **which outreach artifact** it expects
  (opener / follow-up / pitch / contact-log) and deep-links to the right
  workspace.
- Executing an opener / follow-up / pitch **auto-detects** the matching
  checklist step and offers to mark it complete (or auto-completes if the
  step is configured for it).
- The Signal Registry gains **outreach-state signals** so the triage engine
  and playbook catalog can reason about outreach progress, not just prospect
  problems.
- Pitch Construction starters are **sourced from the playbook**, not
  hardcoded in the frontend, so a playbook edit propagates to the pitch
  workspace.

---

## 3. Design principles

1. **Additive, not breaking.** Existing `outreach` steps with
   `action_config={"channel":"email"}` keep working. The new fields are
   optional; old steps are treated as "generic outreach" (legacy behavior).
2. **Checklist is the operator's single source of truth for "what's left to
   do."** The openers workspace remains the place to *do* the work; the
   checklist links to it and reflects its state.
3. **Auto-completion is opt-in per step.** `action_config.auto_complete`
   defaults to `false`. Some operators want manual check-off even when the
   system detected the artifact; respect that.
4. **Signals are derived, not model-emitted.** Outreach-state signals are
   computed from `mkt_outreach_openers_list` / `mkt_outreach_pitches_list` /
   `mkt_outreach_log` rows — not from the audit LLM. This keeps the audit
   prompt unchanged and makes the signals instant (no re-audit needed).

---

## 4. Schema changes

### 4.0 New step type: `internal_link` (DDL — check constraint update)

Today's 6 step types have no way to deep-link to an internal app page or tab.
`url_check` opens an **external** URL only. Operators need a step type that
links to an internal destination — "go to the Deliverables tab", "open the
Openers workspace for this campaign", "open the Diagnostic Gallery".

Add `'internal_link'` to `CHECKLIST_STEP_TYPES`:

```ts
export const CHECKLIST_STEP_TYPES = [
  'manual',
  'url_check',       // external URL — opens in new tab
  'internal_link',   // NEW — deep-links to an internal app page/tab
  'ai_prompt',
  'deliverable',
  'outreach',
  'credentials',
] as const;
```

`internal_link` `action_config` shape:

```jsonc
{
  "target": "deliverables",          // named target (see registry below)
  "params": { "tab": "gallery" }     // optional params passed to the target
}
```

**Named target registry** (resolved by the frontend, not raw URLs — so route
changes don't break checklist steps):

| target | resolves to | context |
|--------|-------------|---------|
| `openers_workspace` | `/settings/admin/marketing-ops/openers?campaign={campaignId}&tab={tab}` | `params.tab`: `opener` / `pitch` / `followup` |
| `deliverables` | `/settings/admin/marketing-ops/deliverables/{campaignId}` | — |
| `gallery` | `/settings/admin/marketing-ops/campaigns/{campaignId}` (Gallery tab) | — |
| `campaign_tab` | `/settings/admin/marketing-ops/campaigns/{campaignId}` (specific tab) | `params.tab`: `overview` / `audits` / `checklist` / `history` / `siblings` / `cascade` |
| `recovery_detail` | `/settings/admin/marketing-ops/recovery/{campaignId}` | — |
| `intake_form` | `/recovery/intake?campaign={campaignId}&kind={intakeKind}` | `params.intakeKind` |

The frontend resolves `{campaignId}` from the current campaign context. This
keeps step templates portable across campaigns (the playbook doesn't know
the campaign ID — it's resolved at render time).

**Migration 185a** (DDL): updates the `step_type` check constraint on
`mkt_playbook_checklist_steps` to add `'internal_link'` to the allowed
values. (The existing constraint likely allows any string — verify and add
if needed.)

### Migration 187: `mkt_playbook_checklist_steps.action_config` enrichment (no DDL)

No schema change needed — `action_config` is already `Json`. This migration
is **data-only**: updates the existing `outreach` starter steps (from
migration 174) to carry the new `outreach_kind` + `auto_complete` fields.

New `action_config` shape for `outreach` steps:

```jsonc
{
  "channel": "email",           // existing — email/phone/sms/dm
  "outreach_kind": "opener",    // NEW — opener | follow_up | pitch | contact_log | generic
  "auto_complete": false,       // NEW — if true, artifact detection auto-checks the step
  "min_followup_number": null   // NEW — for follow_up steps: which follow-up # satisfies this (null = any)
}
```

`outreach_kind` values:
- `opener` — satisfied when an opener (`message_type IS NULL`) exists for the campaign
- `follow_up` — satisfied when a follow-up (`message_type='follow_up'`) exists; `min_followup_number` gates which #
- `pitch` — satisfied when an assembled pitch (`mkt_outreach_pitches_list`) exists
- `contact_log` — satisfied when a `mkt_outreach_log` entry exists with the matching channel
- `generic` — legacy / unspecified; manual check-off only (current behavior)

### Migration 187: Outreach-state signal registry seed (data-only)

Seeds new signal rows in `mkt_signal_registry` under a new family **`OX`**
(Outreach Execution). These are `detection_source='derived'` — computed by
the outreach-state extractor (§5.2), not emitted by the audit LLM.

| code | family | label | detection_source | derived_rule |
|------|--------|-------|------------------|--------------|
| `OX_OPENER_SENT` | OX | Opener sent | derived | `{field:"opener_count",op:">=",threshold:1}` |
| `OX_FOLLOWUP_SENT` | OX | Follow-up sent | derived | `{field:"followup_count",op:">=",threshold:1}` |
| `OX_PITCH_ASSEMBLED` | OX | Pitch assembled | derived | `{field:"pitch_count",op:">=",threshold:1}` |
| `OX_NO_REPLY_AFTER_OPENER` | OX | No reply after opener | derived | `{field:"days_since_opener",op:">=",threshold:3}` |
| `OX_NO_REPLY_AFTER_FOLLOWUP_N` | OX | No reply after N follow-ups | derived | `{field:"followup_count",op:">=",threshold:2}` |
| `OX_CONTACT_LOGGED` | OX | Contact logged | derived | `{field:"contact_log_count",op:">=",threshold:1}` |

The `SIGNAL_FAMILIES` array in `signal-taxonomy.ts` gains `'OX'` with label
`'Outreach Execution'`. These signals do **not** feed the triage engine's
playbook selection (they're not prospect-problem signals) — they feed the
checklist state resolver and the campaign overview's outreach status card.

---

## 5. Backend

### 5.1 OutreachChecklistBridgeService (new)

`apps/api/src/services/OutreachChecklistBridgeService.ts`

The single service that connects outreach artifacts to checklist progress.

```
class OutreachChecklistBridgeService extends BaseService {
  // Resolve the outreach state for a campaign — used by the checklist view
  // builder and the overview outreach card.
  async getOutreachState(campaignId, ctx?): Promise<OutreachState> {
    // Counts: opener_count, followup_count, pitch_count, contact_log_count
    // Timings: latest_opener_at, days_since_opener, latest_followup_at
    // Derived flags: has_opener, has_followup, has_pitch, no_reply_after_opener
  }

  // For a given checklist step (outreach kind), check if its artifact exists.
  // Returns { satisfied, artifactId, artifactDate } or { satisfied: false }.
  async checkStepSatisfaction(campaignId, step, ctx?): Promise<StepSatisfaction> {
    // switch on action_config.outreach_kind:
    //   opener     → query mkt_outreach_openers_list WHERE message_type IS NULL
    //   follow_up  → query WHERE message_type='follow_up' [AND followup_number >= min]
    //   pitch      → query mkt_outreach_pitches_list
    //   contact_log→ query mkt_outreach_log WHERE channel = step.channel
    //   generic    → { satisfied: false } (manual only)
  }

  // Called after an opener/follow-up/pitch is executed or imported.
  // Finds outreach-kind checklist steps for the campaign's effective playbook,
  // checks satisfaction, and auto-completes steps where auto_complete=true.
  // Returns the list of steps that were auto-completed (for the caller to
  // surface in the API response).
  async onOutreachArtifactCreated(campaignId, artifactKind, ctx?): Promise<AutoCompletedStep[]>

  // Resolve deep-link target for an outreach checklist step.
  // Returns the URL the frontend should link to.
  resolveStepDeepLink(campaignId, step): string | null {
    // opener/pitch → /settings/admin/marketing-ops/openers?campaign={id}&tab=pitch
    // follow_up    → /settings/admin/marketing-ops/openers?campaign={id}&tab=followup
    // contact_log  → #overview (the OutreachFollowUpCard's Log Contact modal)
    // generic      → null
  }
}
```

**Wiring points** (call `onOutreachArtifactCreated` fire-and-forget after):
- `OutreachOpenerService.executeOpener` / `importOpener` — artifactKind `'opener'`
- `OutreachFollowUpService.executeFollowUp` / `importFollowUp` — artifactKind `'follow_up'`
- `PitchService.assemblePitch` — artifactKind `'pitch'`
- `MarketingOutreachService.logContact` — artifactKind `'contact_log'`

### 5.2 OutreachStateSignalExtractor (new)

`apps/api/src/services/triage/outreach-state-extractor.ts`

Mirrors the existing `signal-extractor.ts` pattern but derives `OX_*` signals
from outreach tables instead of audit data. Called by
`OutreachChecklistBridgeService.getOutreachState` and optionally by the
triage engine's signal enrichment pass (so `OX_*` signals appear in the
campaign's `triggered_signals` array for display, but are excluded from
playbook rule evaluation — see §5.3).

### 5.3 Signal taxonomy update

`apps/api/src/services/triage/signal-taxonomy.ts`:
- Add `'OX'` to `SIGNAL_FAMILIES` + `FAMILY_LABELS`
- Add the 6 `OX_*` codes to `KNOWN_SIGNAL_CODES`
- Add `isOutreachStateSignal(code)` predicate (true for `OX_*`)
- **Triage engine:** `TriageEngineService` skips `OX_*` signals when
  evaluating playbook rules. They're display-only in the triage card's
  "Triggered Signals" section, grouped under the new "Outreach Execution"
  family header. This prevents outreach state from influencing playbook
  selection (which is prospect-problem-driven).

### 5.4 PlaybookChecklistService update

`getCampaignChecklist` (the view builder) gains an optional
`outreachState` enrichment pass:
- For each `outreach`-kind step, calls
  `OutreachChecklistBridgeService.checkStepSatisfaction`
- Attaches `step.outreachStatus: { satisfied, artifactId, artifactDate, deepLink }`
  to the `CampaignChecklistStepView`
- Steps that are `satisfied` but not yet checked off render with a "detected"
  indicator (blue dot) and a one-click "mark complete" button (or are already
  auto-completed if `auto_complete=true`)
- For `internal_link` steps, attaches `step.internalLink: { target, params, resolvedUrl }`
  so the frontend can render the deep-link button without client-side
  resolution logic (the backend resolves the URL using the campaign context).

### 5.5 `internal_link` validation

`PlaybookChecklistService.validateActionConfig` gains a case for
`internal_link`:
- `action_config.target` must be one of the named targets in the registry
  (§4.0): `openers_workspace | deliverables | gallery | campaign_tab |
  recovery_detail | intake_form`
- `action_config.params` is optional; if present must be a flat object of
  string values
- Rejects raw URL strings in `target` (must use the named registry, not
  arbitrary paths — keeps templates portable and prevents stale links)

### 5.6 Pitch starter source (new)

`apps/api/src/services/MarketingPlaybookCatalogService.ts` gains a
`getPitchStarters(playbookCode, archetype)` method that returns
`{ headers: string[], closers: string[], contacts: string[] }` from a new
`pitch_starters` JSONB column on `mkt_playbook_catalog` (migration 186).

This moves the hardcoded `HEADER_STARTERS` / `CLOSER_STARTERS` /
`CONTACT_STARTERS` from `PitchConstructionPanel.tsx` into the playbook
catalog, editable by admins. The frontend falls back to the component-level
defaults if the playbook has no `pitch_starters` (backward compat).

### Migration 187: `mkt_playbook_catalog.pitch_starters` (DDL)

```sql
ALTER TABLE mkt_playbook_catalog
  ADD COLUMN IF NOT EXISTS pitch_starters JSONB DEFAULT NULL;
-- Shape: { "A1": { "headers": [...], "closers": [...], "contacts": [...] }, "A2": {...}, ... }
-- Seeded from the current frontend defaults (migration 186 part 2).
```

---

## 6. Routes

### 6.1 Checklist outreach state (new endpoint)

`GET /api/admin/marketing-ops/campaigns/:campaignId/outreach-state`

Returns the `OutreachState` DTO (opener/follow-up/pitch/contact-log counts +
derived flags). Used by the checklist tab and the overview outreach card.

### 6.2 Existing checklist endpoint enrichment

`GET /api/admin/marketing-ops/campaigns/:campaignId/checklist` — the
response body's `steps[]` now includes `outreachStatus` on outreach-kind
steps (see §5.4). No new endpoint; the existing one is enriched.

### 6.3 Pitch starters (new endpoint)

`GET /api/admin/marketing-ops/playbooks/:playbookId/pitch-starters?archetype=A1`

Returns the playbook's pitch starters for the given archetype. Used by
`PitchConstructionPanel` instead of the hardcoded component constants.

### 6.4 Pitch starters CRUD (new endpoints, admin)

```
PUT  /api/admin/marketing-ops/playbooks/:playbookId/pitch-starters
DELETE /api/admin/marketing-ops/playbooks/:playbookId/pitch-starters
```

Body: `{ archetype, headers, closers, contacts }` (PUT) or `{ archetype }`
(DELETE — falls back to component defaults). Surfaces in the Checklist
Builder tab as a new "Pitch Starters" sub-section per playbook.

---

## 7. Frontend

### 7.1 CampaignChecklistTab — outreach step enrichment

`apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignChecklistTab.tsx`

For `stepType === 'outreach'` steps, replace the current "nothing" render
block (lines 427–447 gap) with:

1. **Deep-link button** — if `step.outreachStatus?.deepLink` is set, render a
   link button "Open in Outreach Workspace →" that navigates to the openers
   workspace with the campaign pre-selected and the right tab active.
2. **Satisfaction indicator** — if `step.outreachStatus?.satisfied`:
   - `auto_complete=true` → step is already checked off (green).
   - `auto_complete=false` → render a blue "detected" dot + a one-click
     "Mark complete" button that calls `setChecklistStepProgress`.
3. **Channel badge** — show the channel (email/phone/sms/dm) as a small chip.
4. **Outreach kind label** — show `outreach_kind` (Opener / Follow-up /
   Pitch / Contact Log / Generic) as a secondary label next to "Outreach".

For `stepType === 'internal_link'` steps, add:
5. **Internal deep-link button** — render a "Open →" button that resolves
   `action_config.target` via the named target registry (§4.0) and navigates
   to the resolved URL with the current campaign ID substituted. This is the
   internal-link equivalent of `url_check`'s external link.

### 7.2 PitchConstructionPanel — starter source

`apps/web/src/app/(platform)/settings/admin/marketing-ops/openers/PitchConstructionPanel.tsx`

- On mount / campaign change, fetch
  `GET /playbooks/:playbookId/pitch-starters?archetype=A1` (playbookId from
  the campaign's effective playbook).
- Replace the hardcoded `HEADER_STARTERS` / `CLOSER_STARTERS` /
  `CONTACT_STARTERS` constants with the fetched values.
- **Fallback:** if the API returns empty (playbook has no starters), fall
  back to the existing component-level constants (keep them as
  `DEFAULT_HEADER_STARTERS` etc.).
- The starters panel gains a small "edit in Playbook →" link for admins.

### 7.3 ChecklistBuilderTab — step type actions + outreach kind + pitch starters editor

`apps/web/src/app/(platform)/settings/admin/marketing-ops/playbooks/ChecklistBuilderTab.tsx`

**Step type form changes:**
- Add `internal_link` to the step type dropdown.
- For `internal_link`: show a **Target** select (from the named target
  registry) + optional **Params** JSON input (e.g. `{"tab":"gallery"}`).
- For `outreach` branch (lines 549–560), add:
  - **Outreach Kind** select: `generic / opener / follow_up / pitch / contact_log`
  - **Auto-complete** checkbox: "Auto-complete when artifact detected"
  - **Min follow-up #** number input (only visible when kind = `follow_up`)

New sub-section below the step list: **Pitch Starters** (per archetype).
Renders a tabbed editor (A1–A6) with three textarea lists (headers, closers,
contacts). Save calls `PUT /playbooks/:id/pitch-starters`. This is where
admins customize the starters that the Pitch Construction panel consumes.

### 7.4 SuggestionFormModal — step type + action config capture

`apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignChecklistTab.tsx`

Today the `SuggestionFormModal` (lines 560–687) only captures: kind,
position, title, stage, instructions, rationale. It does NOT capture
`stepType` or `actionConfig` — so every operator suggestion defaults to
`step_type='manual'` on the backend (line 711: `?? 'manual'`).

**Changes:**
- Add a **Step Type** select to the form (for `add` and `modify` kinds):
  `manual / url_check / internal_link / ai_prompt / deliverable / outreach / credentials`
- When `url_check` is selected: show a **URL** input (validated http/s).
- When `internal_link` is selected: show a **Target** select (from the named
  target registry) + optional **Params** input.
- When `outreach` is selected: show **Channel** select + **Outreach Kind**
  select + **Auto-complete** checkbox.
- When `credentials` is selected: show **Credential Reference** input +
  **Username Hint** input (same fields as the admin builder).
- The `proposedStep` object sent to the backend now includes `stepType` and
  `actionConfig`:
  ```ts
  const proposedStep: Record<string, any> = {
    title: proposedTitle,
    stepType: proposedStepType,        // NEW
    actionConfig: proposedActionConfig, // NEW
  };
  if (proposedInstructions) proposedStep.instructions = proposedInstructions;
  if (suggestionStageTag) proposedStep.stage_tag = suggestionStageTag;
  ```
- The backend `applyAddSuggestion` already reads `proposedStep.stepType` and
  `proposedStep.actionConfig` (lines 711–714) — no backend change needed for
  this part. The `validateActionConfig` call already handles all types.
- For `modify` suggestions: pre-fill the step type + action config from the
  anchor step so the operator sees what they're modifying.

### 7.5 OutreachFollowUpCard — checklist cross-link

`apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx`

Add a small footer line: "Checklist: X of Y outreach steps complete" with a
link to the Checklist tab. Uses the enriched checklist endpoint's
`outreachStatus` data. This gives the overview tab's outreach card visibility
into the checklist's outreach progress without leaving the overview.

### 7.6 OpenerWorkspaceClient — checklist awareness badge

`apps/web/src/app/(platform)/settings/admin/marketing-ops/openers/OpenerWorkspaceClient.tsx`

When a campaign is selected, show a small badge in the workspace header:
"Checklist: 3/7 outreach steps done" with a link to the campaign's checklist
tab. After executing an opener/follow-up/pitch, if the API response includes
`autoCompletedSteps`, show a toast: "Checklist step auto-completed: {title}".

---

## 8. Migration 174 backfill (migration 184)

Update the existing starter steps from migration 174 to carry
`outreach_kind`. Mapping:

| Step ID | Playbook | Current title | New `outreach_kind` | `auto_complete` |
|---------|----------|---------------|---------------------|-----------------|
| pbcs-pb01-007 | PB-01 | Send client a profile alignment summary | `contact_log` | true |
| pbcs-pb02-004 | PB-02 | Send first batch of review requests | `contact_log` | true |
| pbcs-pb02-006 | PB-02 | Schedule 30-day review velocity check-in | `contact_log` | false |
| pbcs-pb03-006 | PB-03 | Pitch the Conversion & Local SEO retainer | `pitch` | false |
| pbcs-pb04-002 | PB-04 | Document every unanswered complaint | `contact_log` | true |
| pbcs-pb04-006 | PB-04 | Report status and pitch Reputation Defense | `pitch` | false |
| pbcs-pb05-006 | PB-05 | Present the full retainer pitch | `pitch` | false |
| pbcs-pb06-002 | PB-06 | Collect fresh photos and assets from the client | `contact_log` | true |
| pbcs-pb06-006 | PB-06 | Pitch the ongoing content & photo refresh retainer | `pitch` | false |
| pbcs-pb07-002 | PB-07 | Collect the product catalog from the client | `contact_log` | true |
| pbcs-pb07-006 | PB-07 | Pitch the product visibility retainer | `pitch` | false |

**Note:** The starter steps today don't include explicit "send opener" or
"send follow-up" steps — those are implicit in the outreach cycle. This
sprint **adds** two new starter steps per review-pipeline playbook (PB-02,
PB-04, PB-05) at the top of the outreach sequence:

- "Generate and send the opener" — `outreach_kind: 'opener'`,
  `auto_complete: true`, `stage_tag: 'shown'`
- "Send follow-up if no reply within 3 days" — `outreach_kind: 'follow_up'`,
  `auto_complete: true`, `min_followup_number: 1`, `stage_tag: 'shown'`

These are inserted at the appropriate `step_order` position and existing
steps are renumbered.

---

## 9. Tests

### 9.1 OutreachChecklistBridgeService tests

`apps/api/src/services/__tests__/OutreachChecklistBridgeService.test.ts`

- `getOutreachState` — correct counts for opener/follow-up/pitch/contact-log
- `checkStepSatisfaction` — each `outreach_kind` returns satisfied when
  artifact exists, unsatisfied when not
- `checkStepSatisfaction` — `follow_up` with `min_followup_number` gates
  correctly (follow-up #1 doesn't satisfy a step requiring #2)
- `checkStepSatisfaction` — `generic` always returns unsatisfied (manual)
- `onOutreachArtifactCreated` — auto-completes steps with `auto_complete=true`
- `onOutreachArtifactCreated` — does NOT auto-complete steps with
  `auto_complete=false` (but they appear as "detected")
- `onOutreachArtifactCreated` — no-op when no outreach-kind steps exist
- `resolveStepDeepLink` — correct URL per kind

### 9.2 OutreachStateSignalExtractor tests

`apps/api/src/services/triage/__tests__/OutreachStateSignalExtractor.test.ts`

- Emits `OX_OPENER_SENT` when opener exists
- Emits `OX_NO_REPLY_AFTER_OPENER` when opener >3 days old and no reply
- Emits `OX_FOLLOWUP_SENT` when follow-up exists
- Emits `OX_PITCH_ASSEMBLED` when pitch exists
- Emits nothing when campaign has no outreach artifacts
- `isOutreachStateSignal` predicate true for all `OX_*`, false for others

### 9.3 Signal taxonomy test update

`apps/api/src/services/triage/__tests__/TriageEngineService.test.ts`

- `OX_*` signals appear in `triggered_signals` but do NOT influence playbook
  selection (PB-02 still selected based on `RA_*` signals regardless of
  `OX_*` state)

### 9.4 PlaybookChecklistService test update

`apps/api/src/services/__tests__/PlaybookChecklistService.test.ts`

- `getCampaignChecklist` — outreach steps carry `outreachStatus` when
  outreach state exists
- `getCampaignChecklist` — `outreachStatus.satisfied` is false when no
  artifact exists
- `getCampaignChecklist` — `internal_link` steps carry `internalLink.resolvedUrl`
- `createStep` — `internal_link` with valid target succeeds
- `createStep` — `internal_link` with unknown target rejected
- `createStep` — `internal_link` with raw URL in target rejected (must use
  named registry)
- `submitSuggestion` — proposed step with `stepType='url_check'` +
  `actionConfig.url` is accepted and applied on accept
- `submitSuggestion` — proposed step with `stepType='internal_link'` +
  `actionConfig.target` is accepted and applied on accept
- `submitSuggestion` — proposed step with no `stepType` defaults to `manual`
  (backward compat with existing suggestions)

### 9.5 Pitch starters test

`apps/api/src/services/__tests__/MarketingPlaybookCatalogService.test.ts`

- `getPitchStarters` — returns seeded starters for A1
- `getPitchStarters` — returns empty for unseeded archetype (frontend
  falls back)
- `updatePitchStarters` — persists and reads back
- `updatePitchStarters` — rejects invalid archetype

---

## 10. File inventory

| File | Change | Sprint |
|------|--------|--------|
| `database/migrations/185a_internal_link_step_type.sql` | DDL: add `internal_link` to `step_type` check constraint | 1 |
| `database/migrations/185_outreach_checklist_bridge_backfill.sql` | Data-only: update starter steps with `outreach_kind` + add opener/follow-up steps | 1 |
| `database/migrations/186_outreach_state_signal_registry.sql` | Data-only: seed `OX_*` signal rows | 1 |
| `database/migrations/187_playbook_pitch_starters.sql` | DDL: `pitch_starters` JSONB on `mkt_playbook_catalog` + seed from frontend defaults | 2 |
| `apps/api/src/services/OutreachChecklistBridgeService.ts` | New — bridge service | 1 |
| `apps/api/src/services/triage/outreach-state-extractor.ts` | New — OX signal extractor | 1 |
| `apps/api/src/services/triage/signal-taxonomy.ts` | Add OX family + codes + predicate | 1 |
| `apps/api/src/services/triage/TriageEngineService.ts` | Skip OX signals in rule evaluation | 1 |
| `apps/api/src/services/PlaybookChecklistService.ts` | Add `internal_link` to step types + validation; enrich view with outreachStatus + internalLink | 1 |
| `apps/api/src/services/OutreachOpenerService.ts` | Call bridge on execute/import | 1 |
| `apps/api/src/services/OutreachFollowUpService.ts` | Call bridge on execute/import | 1 |
| `apps/api/src/services/outreach-pitch/PitchService.ts` | Call bridge on assemble | 1 |
| `apps/api/src/services/MarketingOutreachService.ts` | Call bridge on logContact | 1 |
| `apps/api/src/services/MarketingPlaybookCatalogService.ts` | getPitchStarters + CRUD | 2 |
| `apps/api/src/routes/marketing-ops.ts` | New endpoints (§6) | 1+2 |
| `apps/api/prisma/schema.prisma` | `pitch_starters` column (after migration 186 + db pull) | 2 |
| `apps/web/src/app/.../CampaignChecklistTab.tsx` | Outreach step enrichment (§7.1) + SuggestionFormModal step type capture (§7.4) | 1 |
| `apps/web/src/app/.../PitchConstructionPanel.tsx` | Fetch starters from API (§7.2) | 2 |
| `apps/web/src/app/.../ChecklistBuilderTab.tsx` | `internal_link` target selector + outreach kind + pitch starters editor (§7.3) | 1+2 |
| `apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx` | Checklist cross-link (§7.5) | 1 |
| `apps/web/src/app/.../OpenerWorkspaceClient.tsx` | Checklist badge + auto-complete toast (§7.6) | 1 |
| `apps/web/src/services/MarketingOpsService.ts` | New service methods + types (`internal_link` target registry, outreach state, pitch starters) | 1+2 |

---

## 11. Sprint phasing

### Sprint 1 — Checklist ↔ Outreach bridge + step type actions (the core gap)
- Migration 185a (`internal_link` step type DDL)
- Migration 184 (starter step backfill with `outreach_kind`)
- Migration 185 (OX signal registry seed)
- `OutreachChecklistBridgeService` + `OutreachStateSignalExtractor`
- Signal taxonomy + triage engine update
- `PlaybookChecklistService`: `internal_link` step type + validation + view enrichment
- Wiring into opener/follow-up/pitch/contact-log services
- `GET /campaigns/:id/outreach-state` endpoint
- Frontend: `CampaignChecklistTab` outreach + internal_link enrichment,
  `SuggestionFormModal` step type + action config capture,
  `OutreachFollowUpCard` cross-link, `OpenerWorkspaceClient` badge + toast
- `ChecklistBuilderTab`: `internal_link` target selector + outreach kind
  selector + auto-complete toggle
- Tests 9.1–9.4

### Sprint 2 — Pitch starters from playbook
- Migration 186 (`pitch_starters` column + seed)
- `MarketingPlaybookCatalogService.getPitchStarters` + CRUD
- `GET/PUT/DELETE /playbooks/:id/pitch-starters` endpoints
- Frontend: `PitchConstructionPanel` fetch-from-API, `ChecklistBuilderTab`
  pitch starters editor sub-section
- Test 9.5

---

## 12. Out of scope

- **Auto-generating checklist steps from the signal registry.** The signal
  registry tells you *what's wrong*; the checklist tells you *what to do*.
  Auto-generating steps from signals would conflate detection with action and
  is a separate, larger effort.
- **Outreach cadence automation.** "Send follow-up #2 after 5 days" is a
  workflow automation feature, not a bridge feature. This sprint makes the
  *state* visible; cadence automation is future work.
- **Recovery pipeline outreach.** Recovery campaigns have their own cascade
  (`RecoveryCascadeService`). This sprint targets the review pipeline only
  (the openers/follow-ups/pitch workspace's scope). Recovery bridge is
  future work.
- **Customer portal visibility into outreach state.** The customer portal
  (Phase 2) shows campaign status via `mapCustomerStatus`. Surfacing
  outreach progress to the customer is a separate decision (may not be
  desirable — outreach is operator-internal).
