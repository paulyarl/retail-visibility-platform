# Operator Playbook Checklists — Sprint Plan

**Status:** Draft · **Owner:** Platform Eng · **Date:** 2026-08-03
**Companion docs:** `docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md`, `docs/LocalBiz/marketing_ops_triage_admin_runbook.md`, `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md` (§31, §32)

---

## 1. Problem / Objective

The Playbook Catalog (§31) tells the operator *which* playbook a campaign should run, but not *how to execute it*. Playbooks are different — some require systematic step-by-step execution to ensure no step is missed. Today that operational knowledge lives in operators' heads, scattered docs, or not at all.

This sprint adds **Operator Playbook Checklists**:

1. **Per-playbook step templates** — admins define an ordered checklist per playbook. Steps are heterogeneous: check this website, create this document, send this message, run this AI prompt, retrieve credentials, or free-form manual steps.
2. **Checklist builder tab** — a third tab on `/settings/admin/marketing-ops/playbooks` where an operator/admin selects a playbook from a dropdown and sees/edits that playbook's **operations overview**.
3. **Campaign checklist tab** — a campaign that has an effective playbook (triage accepted or overridden) displays its playbook's checklist as a new tab, and the operator checks steps off as the campaign progresses.
4. **Soft gate** — advancing a campaign's stage with incomplete *required* steps triggers a warning dialog listing the missing steps; the operator may acknowledge and proceed (the acknowledgment is recorded).
5. **Operator suggestion loop** — checklists are not rigid. Operators executing checklist-aware campaigns discover efficiencies in the field; from any campaign they can (a) **suggest a new step** tagged as *preceding*, *succeeding*, or *superseding* an existing playbook step, or (b) **suggest a modification** to an existing step. Suggestions land in a **per-playbook review queue** on the Operator Checklist builder tab, where an admin accepts (applies to the template) or rejects them. Playbooks improve from lived execution, through a governed path — operators never edit templates directly.

Decisions locked with the requester (2026-08-03):

- **Step behavior:** Actionable deep-links where a pattern exists (open URL, run prompt, open deliverables, log outreach, credential reference), informational otherwise. Step actions are *optional conveniences* — every step is completable without using its action.
- **Gating:** Soft gate only (option B). Never hard-blocks a transition.
- **Docs:** This sprint plan + operator-facing §32 in the user guide.

---

## 2. Current State (What Already Exists)

### 2.1 Data Layer

- `mkt_playbook_catalog` (`apps/api/prisma/schema.prisma:6793`) — playbook definitions (code, name, category, archetype, fees, `matching_rules`, `priority_rank`).
- `mkt_campaign_triage_results` (`schema.prisma:6822`) — one row per campaign: `recommended_playbook_id`, `overridden_playbook_id`, `is_operator_accepted`, `detected_signals`. **This is the campaign → playbook link the checklist tab resolves.**
- `mkt_signal_registry` (`schema.prisma:6845`) — precedent for "registry as data" tables, platform-admin scoped, **no RLS** (same as all `mkt_*` tables).
- Prompt templates, deliverable templates, and outreach logs already exist and are the natural deep-link targets for actionable steps.

### 2.2 API Layer

- `apps/api/src/routes/marketing-ops.ts` — monolithic admin route surface; playbook CRUD and signal CRUD already live here (Sprint 4).
- `apps/api/src/services/MarketingPlaybookCatalogService.ts` — playbook/signal business logic.
- `POST /:id/transition` (`marketing-ops.ts:763`) — the stage-transition endpoint the soft gate hooks into.

### 2.3 Web Layer

- `apps/web/src/app/(platform)/settings/admin/marketing-ops/playbooks/PlaybookCatalogClient.tsx` — two tabs (`playbooks` | `signals`), tab state at line 75. The third tab slots in here.
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — tab union type at line 25, tabs array at line 293, tab content renderers from line 566. The `IntelligentTriageCard` (line 541) gates on `campaign.stage === 'seek'`.
- `apps/web/src/components/marketing-ops/IntelligentTriageCard.tsx` — already computes the **effective playbook**: `overriddenPlaybook ?? recommendedPlaybook` (line 168). The checklist tab uses the same rule.
- `apps/web/src/services/MarketingOpsService.ts` — API client; playbook CRUD block starts at line 3285.

---

## 3. Gap Analysis

| Need | Codebase Reality | Implication |
|------|------------------|-------------|
| Per-playbook ordered steps | Does not exist | New table `mkt_playbook_checklist_steps` + Prisma model |
| Per-campaign check-off state | Does not exist | New table `mkt_campaign_checklist_progress` + Prisma model |
| Effective playbook resolution for a campaign | Exists inside `IntelligentTriageCard` (client-side) | Reimplement server-side in the checklist service (single source of truth) |
| Checklist builder UI | Does not exist | Third tab in `PlaybookCatalogClient.tsx` |
| Campaign checklist UI | Does not exist | New `checklist` tab in `CampaignDetailClient.tsx` |
| Soft gate on transitions | Transition endpoint has no checklist awareness | Extend `POST /:id/transition` with an incomplete-required-steps warning + `acknowledge_incomplete` override flag |
| Credential steps | No credential storage anywhere in mkt_* (correctly) | Steps store a **reference label only** (e.g. vault location). Never store secrets in the checklist — see §5.4 |
| Operator suggestions on playbook steps | Does not exist | New table `mkt_playbook_checklist_suggestions` + review queue on the builder tab — see §13 |

---

## 4. Proposed Architecture

```
┌─────────────────────────────┐
│ mkt_playbook_catalog        │
└──────────────┬──────────────┘
               │ 1:N
               ▼
┌─────────────────────────────┐      ┌──────────────────────────────┐
│ mkt_playbook_checklist_steps│      │ mkt_campaign_triage_results  │
│ (template, per playbook)    │      │ (effective playbook per      │
└──────────────┬──────────────┘      │  campaign — already exists)  │
               │                     └──────────────┬───────────────┘
               │ 1:N progress                       │ campaign_id
               ▼                                    ▼
┌─────────────────────────────┐      ┌──────────────────────────────┐
│ mkt_campaign_checklist_     │◄─────│ mkt_campaigns_list           │
│ progress (per campaign+step)│      └──────────────────────────────┘
└─────────────────────────────┘
```

- **Templates are edited once per playbook** (admin tab) and **instantiated implicitly per campaign** — progress rows are created lazily on first check-off, not on triage accept. No fan-out writes when a playbook is assigned; no orphan cleanup when a playbook is overridden (progress rows reference `step_id`, and an override simply resolves a different step set — stale progress rows for the old playbook's steps are retained for audit but not displayed).
- **Effective playbook rule (server-side):** if a triage result exists for the campaign, use `overridden_playbook_id ?? recommended_playbook_id`, exposed only when `is_operator_accepted = true` OR `overridden_playbook_id IS NOT NULL`. No triage decision → no checklist tab content (empty state points the operator at the triage card).

---

## 5. Data Model — Migration `159_mkt_playbook_checklists.sql`

### 5.1 `mkt_playbook_checklist_steps` (template)

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(255) PK | `cuid()` at app layer (matches existing mkt_* convention) |
| `playbook_id` | VARCHAR(255) NOT NULL FK → `mkt_playbook_catalog(id)` ON DELETE CASCADE | |
| `step_order` | INT NOT NULL | Display order; reorder swaps values (same pattern as `priority_rank`) |
| `title` | VARCHAR(255) NOT NULL | Short imperative, e.g. "Verify GBP listing is claimed" |
| `instructions` | TEXT | Operator-facing detail: what to check, what done looks like |
| `step_type` | VARCHAR(30) NOT NULL DEFAULT `'manual'` | `manual` · `url_check` · `ai_prompt` · `deliverable` · `outreach` · `credentials` |
| `action_config` | JSONB DEFAULT `'{}'` | Type-specific deep-link config — see §5.3 |
| `is_required` | BOOLEAN DEFAULT `true` | Only required steps feed the soft gate |
| `is_active` | BOOLEAN DEFAULT `true` | Deactivate instead of delete to preserve progress history |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Indexes: `(playbook_id, step_order)`, `(playbook_id, is_active)`.

### 5.2 `mkt_campaign_checklist_progress`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(255) PK | |
| `campaign_id` | VARCHAR(255) NOT NULL FK → `mkt_campaigns_list(id)` ON DELETE CASCADE | |
| `step_id` | VARCHAR(255) NOT NULL FK → `mkt_playbook_checklist_steps(id)` ON DELETE CASCADE | |
| `completed_at` | TIMESTAMPTZ NULL | NULL = not completed (row may not exist at all) |
| `completed_by` | VARCHAR(255) NULL | Admin user id/email of whoever checked it off |
| `note` | TEXT NULL | Optional per-completion note (evidence link, result summary) |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Constraint: `UNIQUE (campaign_id, step_id)`. Index: `(campaign_id)`.

Unchecking a step sets `completed_at = NULL` (row kept → audit trail of who last touched it).

### 5.3 `action_config` per step type

| `step_type` | `action_config` shape | Rendered action |
|-------------|----------------------|-----------------|
| `manual` | `{}` | None — title + instructions + checkbox |
| `url_check` | `{ "url": "https://...", "new_tab": true }` | **Open site** button (external link icon) |
| `ai_prompt` | `{ "prompt_template_id": "..." }` | **Run prompt** → deep-links to campaign Prompts tab with template preselected |
| `deliverable` | `{ "deliverable_type": "preview\|report\|..." }` | **Open deliverables** → campaign Deliverables tab |
| `outreach` | `{ "channel": "email\|phone\|sms\|dm" }` | **Log outreach** → scrolls to/opens outreach logger |
| `credentials` | `{ "credential_ref": "1Password › LocalBiz › GBP vault", "username_hint": "..." }` | Shows the reference label with copy button. **Never a secret value.** |

### 5.4 Security: credentials steps

`credential_ref` is a **pointer to where the secret lives** (vault path, password-manager entry name), never the secret itself. Validation rejects configs containing likely secret material (e.g. fields named `password`, `token`, `secret`, or values matching common key patterns). This keeps the checklist useful ("here's where the creds for this task live") without turning the marketing DB into a secret store.

### 5.5 Prisma models

Two new models in `apps/api/prisma/schema.prisma`, mirroring the SQL above, with relations:

- `mkt_playbook_catalog` gains `checklist_steps mkt_playbook_checklist_steps[]`
- `mkt_campaigns_list` gains `checklist_progress mkt_campaign_checklist_progress[]`

No RLS — platform-admin scoped like every other `mkt_*` table.

### 5.6 `mkt_playbook_checklist_suggestions` (operator feedback queue)

Same migration (`159_mkt_playbook_checklists.sql`). One row per operator suggestion.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(255) PK | |
| `playbook_id` | VARCHAR(255) NOT NULL FK → `mkt_playbook_catalog(id)` ON DELETE CASCADE | Denormalized from the campaign's effective playbook — the queue is queried per playbook |
| `campaign_id` | VARCHAR(255) NOT NULL FK → `mkt_campaigns_list(id)` ON DELETE CASCADE | Origin context — reviewers can see the campaign where the efficiency was discovered |
| `step_id` | VARCHAR(255) NULL FK → `mkt_playbook_checklist_steps(id)` ON DELETE SET NULL | Target step for `modify` / `remove`, and the anchor step for `add` with `before` / `after` / `supersede`. NULL = append-at-end suggestion. SET NULL preserves the suggestion if the target step is later deleted |
| `suggestion_kind` | VARCHAR(20) NOT NULL | `add` · `modify` · `remove` |
| `position` | VARCHAR(20) NULL | For `add` only: `before` · `after` · `supersede` (relative to `step_id`); NULL = append at end |
| `proposed_step` | JSONB NOT NULL | For `add`: full proposed step `{ title, instructions, step_type, action_config, is_required }`. For `modify`: sparse field patch (same shape, only changed fields). For `remove`: `{}` |
| `rationale` | TEXT NOT NULL | Operator's reasoning — the discovered efficiency. Required: a suggestion without a *why* is unreviewable |
| `status` | VARCHAR(20) NOT NULL DEFAULT `'pending'` | `pending` · `accepted` · `rejected` |
| `submitted_by` | VARCHAR(255) NOT NULL | Operator (admin user) id/email |
| `reviewed_by` | VARCHAR(255) NULL | Reviewing admin id/email |
| `reviewed_at` | TIMESTAMPTZ NULL | |
| `review_note` | TEXT NULL | Reviewer's note on accept/reject (esp. rejection reason) |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Indexes: `(playbook_id, status)` (queue query), `(campaign_id)`, `(step_id)`.

**Supersede semantics:** `add` + `position = 'supersede'` proposes a replacement for the anchor step. On accept, the new step is inserted at the anchor's `step_order` and the anchor is **deactivated** (`is_active = false`) — not deleted — preserving existing campaign progress and the audit trail.

**Modify semantics:** `proposed_step` is a sparse patch; the review UI renders a field-by-field diff (current → proposed) against the target step's *current* values at review time, not submission time.

---

## 6. API Surface (`apps/api/src/routes/marketing-ops.ts`)

Follows the existing playbook-CRUD conventions (Zod-validated bodies, `{ data }` envelopes, camelCase DTOs in the web client).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/playbooks/:id/checklist` | List active steps for a playbook, ordered by `step_order` (builder tab) |
| POST | `/playbooks/:id/checklist` | Create step (validated per §5.3 schema union) |
| PUT | `/checklist-steps/:id` | Update step fields |
| DELETE | `/checklist-steps/:id` | Delete step (blocked if progress rows exist → 409, suggest deactivate) |
| PUT | `/playbooks/:id/checklist/reorder` | Swap `step_order` values: `{ rankings: [{ id, step_order }] }` (same pattern as playbook reorder) |
| GET | `/campaigns/:id/checklist` | **Resolved campaign view:** effective playbook summary + active steps + per-step progress + counts (`completed`, `required_total`, `required_completed`) |
| PUT | `/campaigns/:id/checklist/:stepId` | Toggle: `{ completed: boolean, note?: string }` — upserts progress row, stamps `completed_by` from session |
| POST | `/campaigns/:id/checklist/suggestions` | Operator submits a suggestion (`suggestion_kind`, `position`, `step_id`, `proposed_step`, `rationale`) — server stamps `playbook_id` from the campaign's effective playbook and `submitted_by` from session |
| GET | `/campaigns/:id/checklist/suggestions` | Operator sees their own pending/resolved suggestions for this campaign (feedback that the loop is alive) |
| GET | `/playbooks/:id/checklist/suggestions?status=pending` | Review queue for the builder tab (default `pending`) |
| POST | `/checklist-suggestions/:id/accept` | Applies the suggestion to the template (see accept semantics below); body may carry admin amendments to `proposed_step` before applying |
| POST | `/checklist-suggestions/:id/reject` | `{ review_note?: string }` — marks rejected |

**Accept semantics (server-side, single transaction):**

- `add` + `position = 'before'|'after'` → insert new step adjacent to the anchor (shifts later `step_order` values); NULL position → append at end.
- `add` + `position = 'supersede'` → insert new step at the anchor's `step_order`, deactivate the anchor (§5.6). Existing progress on the anchor is preserved; campaigns now see the replacement.
- `modify` → apply the (possibly admin-amended) patch to the target step. Guard: if the target step was edited or deactivated *after* the suggestion was submitted, accept returns `409 suggestion_stale` with the step's current values — the reviewer re-reviews against reality rather than blindly applying a stale patch.
- `remove` → deactivate the target step (same audit-preserving rule as manual deletion).
- All accepts stamp `reviewed_by` / `reviewed_at` and set `status = 'accepted'`.

**Soft gate (transition hook):** `POST /:id/transition` gains checklist awareness:

- Compute incomplete *required* steps for the campaign's effective playbook.
- If any exist and the request body lacks `acknowledge_incomplete: true` → respond `409` with `{ error: 'checklist_incomplete', incomplete_steps: [{ id, title }] }`.
- Client shows a confirm dialog listing those steps; "Continue anyway" retries with `acknowledge_incomplete: true`; the transition log note records that the operator acknowledged incomplete checklist items.
- Campaigns with no effective playbook, or playbooks with zero required steps, are unaffected (zero behavior change for existing flows).

**Service layer:** extend `MarketingPlaybookCatalogService.ts` (or a new `PlaybookChecklistService.ts` if the file grows past comfort) with:

- `listSteps(playbookId)` / `createStep` / `updateStep` / `deleteStep` / `reorderSteps`
- `getCampaignChecklist(campaignId)` — resolves effective playbook (§4 rule), joins steps + progress
- `setStepProgress(campaignId, stepId, completed, note, actor)` — validates the step belongs to the campaign's *current* effective playbook (rejects check-offs against stale playbooks after an override)
- `getIncompleteRequiredSteps(campaignId)` — consumed by the transition route

---

## 7. Admin UI — "Operator Checklist" Tab (Playbook Catalog Page)

`PlaybookCatalogClient.tsx`: tab union becomes `'playbooks' | 'signals' | 'checklist'`.

Layout of the new tab:

1. **Playbook selector** — dropdown of active playbooks (`Code — Name`). Selecting one loads its **operations overview**:
   - Header card: code, name, category badge, archetype, FITD offer + fee, retainer pitch + fee, description (read-only summary so the checklist author has full playbook context without switching tabs).
   - Completion coverage hint: "Used by N campaigns · M% average completion" (nice-to-have, Phase 4).
2. **Step list** — ordered rows: drag-free up/down arrows (same UX as priority-rank reorder), step_order, type badge (color-coded per `step_type`), title, required chip, active toggle, edit/delete buttons.
3. **Add / Edit Step modal** — fields: title, instructions (textarea), step_type select (drives conditional config fields per §5.3), required checkbox, active checkbox.
   - `url_check` → URL input (validated http/https)
   - `ai_prompt` → prompt-template picker (sourced from existing prompt templates API)
   - `deliverable` → deliverable-type select
   - `outreach` → channel select
   - `credentials` → reference label + username hint (with inline warning: "Reference only — never paste secrets here")
4. **Empty states** — no playbook selected ("Select a playbook to view its operations overview"); playbook with no steps ("No checklist steps yet — add the first step").
5. **Suggestion review queue** — a collapsible panel above the step list (badge with pending count) listing operator suggestions for the selected playbook:
   - Each card: kind badge (`New step` / `Modify` / `Remove` / `Supersede`), position anchor ("after step 3: *Verify GBP listing*"), proposed title/config, rationale, origin campaign link, submitter, age.
   - **Modify** cards render a field-by-field diff (current → proposed) against the target step's live values.
   - **Accept** applies per §6 semantics (admin may amend the proposal in-place before accepting — e.g. tighten the title, fix a URL); **Reject** prompts for an optional reason that the submitting operator can later see.
   - Stale suggestions (target step changed since submission) are flagged "step changed since submitted — re-review" instead of silently applying.

Reuses existing page chrome: error/success banners, modal patterns, button styles from the Playbooks/Signals tabs.

---

## 8. Campaign UI — "Checklist" Tab (Campaign Detail)

`CampaignDetailClient.tsx`: tab union gains `'checklist'`; tabs array gains `{ key: 'checklist', label: 'Checklist', count: incompleteRequiredCount }` (count shows remaining required steps — matches existing `(n)` badge convention).

Visibility rules:

- Campaign **has** an effective playbook (triage accepted or overridden) → full checklist renders.
- Campaign in `seek` with no triage decision → tab renders an empty state: "No playbook assigned yet — run Intelligent Triage above to assign one." (The triage card is already rendered above the tabs at seek stage.)
- Playbook has no steps defined → empty state with a deep-link to the builder tab ("Define this playbook's checklist").

Checklist content:

- **Header:** effective playbook chip (code + name + category), progress bar `x / y steps` (+ required sub-count), "Overridden from PB-04" indicator when applicable.
- **Step rows:** checkbox, order number, type badge, title, expandable instructions, per-type action button (§5.3), and — once completed — `completed_by` + timestamp + note. Optional note capture on check-off (small inline input or popover).
- **Uncheck** is allowed (reopens the step); the row keeps the last-completed audit info dimmed until re-completed.
- Action buttons navigate within the campaign page where possible (switch to Prompts/Deliverables tab with preselection via query/state) — they never auto-execute anything; the operator still performs the work and checks the box.

**Soft gate UX:** clicking a stage in the pipeline triggers the transition call; on `409 checklist_incomplete`, show a dialog: "N required steps incomplete for PB-02" + step titles + buttons "Go to Checklist" / "Continue anyway". Choosing continue retries with `acknowledge_incomplete: true`.

**Suggestion affordances (operator feedback loop):**

- Each step row carries a subtle **Suggest improvement** action (lightbulb icon) opening a modal with three choices:
  - **Add a step** — position picker: *before this step* / *after this step* / *instead of this step (supersede)*; then title, instructions, step type + config, required flag.
  - **Change this step** — the step's current fields pre-filled and editable; submission stores only the changed fields as the patch.
  - **Remove this step** — rationale only.
- A general **Suggest a step** button at the list foot covers append-at-end suggestions (no anchor).
- Rationale is a required textarea, prompted with "What did you discover?" — the efficiency story is the reviewable payload.
- The tab shows the operator's own submitted suggestions (status chips: pending / accepted / rejected + review note), closing the feedback loop and teaching what kinds of suggestions get accepted.
- Operators **cannot** edit the playbook template from the campaign page — suggestions are the only write path, keeping templates governed.

---

## 9. Web Client (`MarketingOpsService.ts`)

New block after the signal-registry CRUD (~line 3400), mirroring existing style:

- `listChecklistSteps(playbookId)` · `createChecklistStep(playbookId, input)` · `updateChecklistStep(id, input)` · `deleteChecklistStep(id)` · `reorderChecklistSteps(playbookId, rankings)`
- `getCampaignChecklist(campaignId)` → `CampaignChecklistView` DTO: `{ playbook: { id, code, name, category, isOverride }, steps: ChecklistStepView[], completedCount, requiredTotal, requiredCompleted }`
- `setChecklistStepProgress(campaignId, stepId, { completed, note? })`
- `submitChecklistSuggestion(campaignId, input)` · `listCampaignChecklistSuggestions(campaignId)`
- `listPlaybookChecklistSuggestions(playbookId, status?)` · `acceptChecklistSuggestion(id, amendedStep?)` · `rejectChecklistSuggestion(id, reviewNote?)`
- New exported types: `PlaybookChecklistStep`, `ChecklistStepInput`, `ChecklistStepView`, `CampaignChecklistView`, `PlaybookChecklistSuggestion`, `ChecklistSuggestionInput`, and `CHECKLIST_STEP_TYPES` / `SUGGESTION_KINDS` constants.

`transitionStage` gains optional `acknowledge_incomplete` passthrough and surfaces the 409 payload to the caller.

---

## 10. Testing

**Unit (API):**

- Effective playbook resolution: accepted → recommended; overridden → override; no triage → null; override without accept → override wins.
- `setStepProgress`: happy path, idempotent re-check, uncheck clears `completed_at`, rejects step from a non-effective playbook (post-override staleness guard).
- Reorder swaps orders atomically; validation rejects duplicate orders.
- Credential config validator rejects secret-looking payloads.
- `getIncompleteRequiredSteps` counts only `is_required && is_active` steps.
- Suggestion accept: `add` inserts at correct order (before/after/end); `supersede` deactivates anchor and inherits its order; `modify` applies sparse patch; stale target → `409 suggestion_stale`; reject stamps reviewer fields; accept runs in one transaction (step mutation + suggestion status).

**Integration (routes):**

- Full CRUD cycle on `/playbooks/:id/checklist`.
- `GET /campaigns/:id/checklist` returns joined progress for a campaign with accepted triage; 404/empty DTO for no triage.
- Transition returns 409 `checklist_incomplete` with incomplete steps; succeeds with `acknowledge_incomplete: true`; unaffected when no checklist exists (regression guard).
- Delete step with existing progress → 409.
- Suggestion lifecycle: submit from campaign → appears in playbook queue → accept (step created/modified, suggestion resolved) / reject (note visible to submitter). Submit without rationale → 400. Submit on campaign with no effective playbook → 409.

**Frontend:**

- Builder tab: select playbook → steps load; create/edit/reorder flows.
- Campaign tab: checkbox toggles persist; progress bar updates; empty states for no-triage and no-steps.
- Soft-gate dialog appears on transition with incomplete required steps; "Continue anyway" completes the transition.

---

## 11. Phasing

| Phase | Scope | Depends on |
|-------|-------|-----------|
| **1 — Data + API** | Migration 159 (all three tables), Prisma models, service, checklist + progress routes, transition soft gate | — |
| **2 — Builder tab** | Third tab on playbooks page: selector, operations overview, step CRUD + reorder | 1 |
| **3 — Campaign tab** | Checklist tab with progress, empty states, action deep-links | 1 |
| **4 — Soft gate UX + polish** | Transition dialog, per-playbook completion stats on builder tab, note capture polish | 2, 3 |
| **5 — Suggestion loop** | Suggestion submission from campaign tab, review queue on builder tab, accept/reject with supersede + stale-guard semantics | 2, 3 |

Phases 2 and 3 are independent of each other once Phase 1 lands. Phase 5 is scoped separately so the core loop ships first — but the suggestions table ships in migration 159 with everything else, avoiding a second migration.

---

## 12. Risks & Open Questions

1. **Stale progress after override.** An override swaps the step set; old progress rows are retained but hidden. Risk: operator confusion if they override back and see old checkmarks. *Mitigation:* this is intentional (audit trail); the tab shows an "Overridden from PB-XX" indicator. Open question: should re-overriding back restore previous progress? (Current spec: yes, rows were never deleted.)
2. **Step edits mid-flight.** Editing a step's title/config after campaigns checked it off rewrites history's meaning. *Mitigation:* edits are allowed (admins own templates) but `updated_at` is tracked; deactivation preferred over deletion; deletion blocked once progress exists.
3. **Soft-gate fatigue.** If every campaign has many required steps, the warning becomes noise. *Mitigation:* only `is_required` steps gate; builder UI makes the required flag deliberate (default true, but easy to flip); per-playbook completion stats (Phase 4) surface over-gating.
4. **Action drift.** `action_config.prompt_template_id` / `deliverable_type` reference other admin-editable entities that can be deleted. *Mitigation:* render actions defensively — missing target → disabled button with tooltip, step still checkable.
5. **Open question — per-campaign ad-hoc steps.** Should operators add one-off steps to a single campaign's checklist (not the template)? Out of scope for this sprint; the `note` field covers exceptions. Revisit if requested.
6. **Suggestion quality / queue noise.** A frictionless suggestion box can fill with low-value or duplicate proposals. *Mitigations:* rationale is mandatory; operators see rejection reasons (teaches the bar); duplicates are cheap to reject; pending counts are per-playbook so noise is contained. If volume grows, add "similar pending suggestions" hints at submit time.
7. **Suggestion staleness.** The target step may be edited or deactivated between submission and review. *Mitigation:* the `suggestion_stale` 409 guard + review-time diff rendering against live values (§6); SET NULL on step deletion keeps the suggestion readable.
8. **Supersede confusion.** An operator's superseded step disappearing mid-campaign could confuse. *Mitigation:* supersede deactivates (not deletes); campaigns that already checked the anchor keep their progress count; the builder tab can show deactivated steps with a "superseded by" note.

---

## 13. Operator Suggestion Loop — End to End

```
Campaign Checklist tab (execution)
  → operator discovers an efficiency mid-campaign
  → "Suggest improvement" on a step  (add before/after/supersede · modify · remove)
    or "Suggest a step" at list foot (append)
  → rationale required ("What did you discover?")
  → POST /campaigns/:id/checklist/suggestions
        │
        ▼
mkt_playbook_checklist_suggestions (status = pending)
        │
        ▼
Playbooks page → Operator Checklist tab → review queue (badge: N pending)
  → card shows proposal, diff vs live step, rationale, origin campaign, submitter
  → Accept (optionally amend first)            → Reject (+ reason)
        │                                            │
        ▼                                            ▼
  template updated in one tx                    status = rejected
  (insert / patch / deactivate-anchor)          review_note visible to submitter
        │
        ▼
  All future campaigns on this playbook inherit the improvement;
  in-flight campaigns see the new step set on next checklist load
        │
        ▼
  Operator sees status chip on their suggestion (pending/accepted/rejected)
  → feedback loop closes, playbook quality compounds with execution
```

Design principles for the loop:

1. **Governed, not rigid** — operators never write to templates; every field discovery flows through review.
2. **Context-preserving** — every suggestion carries its origin campaign and rationale so reviewers judge with evidence, not in a vacuum.
3. **Safe to accept** — supersede/remove deactivate rather than delete; stale guards prevent blind application; admin can amend before accepting.
4. **Visible outcomes** — submitters see accept/reject + reasons, which trains suggestion quality over time.
