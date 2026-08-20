# Profile Repair Briefing Persistence & Opener Handoff Sprint Plan

## Context

The Profile Repair triage and per-issue seek prompts now produce operator briefings (scope, viability, pitch, risks) instead of rubber-stamping signal classifications. But the briefings are ephemeral:

- **Triage briefing**: rendered in `RepairTrackPanel.tsx` while the recommendation card is visible, but vanishes once the operator confirms the track. Not persisted on the campaign.
- **Per-issue briefing** (NAP Drift, Unclaimed, Platform Gap): stored only as `raw_output` on the prompt execution row. Rendered as a raw `<pre>` JSON dump in the Prompt Workspace. No structured rendering on the campaign detail page.
- **Opener hook**: the `pitch.opener_hook` field exists in both briefing types but is not wired to the Openers workspace. The operator must manually copy-paste it into a new opener variant.

This sprint makes the briefings **persistent campaign artifacts** and **wires the opener hook into the Openers workspace** so the AI output flows into the outreach workflow without manual copy-paste.

## Goals

1. **Persist the triage briefing** on the campaign row so it survives track confirmation and is visible from the Openers workspace and campaign detail.
2. **Render the per-issue briefing** as a structured card on the campaign detail page (not just raw JSON in the Prompt Workspace).
3. **Auto-create an opener variant** from the briefing's `opener_hook` with a one-click button, so the operator doesn't have to manually copy-paste into the Openers workspace.

## Non-Goals

- Automatic opener creation without operator action (the operator clicks a button; we don't auto-fire).
- Replacing the existing `executeOpener` / `importOpener` flows — the briefing-to-opener path is a third entry point that coexists.
- Persisting the per-issue briefing on the campaign row — it stays on the execution row and is fetched by template_id. Only the triage briefing gets a campaign-row column (it's the one that survives track confirmation and feeds the opener decision).

---

## §1 Migration 232 — Triage Briefing Column

### Schema

Add a nullable JSONB column `repair_triage_briefing` to `mkt_campaigns_list`:

```sql
-- Migration 232
ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS repair_triage_briefing JSONB;
```

**Why on the campaign row, not `mkt_campaign_triage_results`:** The triage briefing is specific to profile repair campaigns and is read every time the campaign detail or Openers workspace loads. A direct column avoids a join and follows the existing pattern of `gbp_lookup_cache`, `cascade_config`, `directory_profiles` — structured AI/lookup output stored directly on the campaign. The `mkt_campaign_triage_results` table is for the older playbook-triage system (different purpose, different shape).

### Prisma

Add to `mkt_campaigns_list` model in `apps/api/prisma/schema.prisma`:

```
repair_triage_briefing Json?
```

Run `pnpm prisma:generate` after schema update.

### Rollback

```sql
ALTER TABLE mkt_campaigns_list DROP COLUMN IF EXISTS repair_triage_briefing;
```

---

## §2 Persist Triage Briefing on Confirm

### Backend — `ProfileRepairPromptService.executeSeekSync`

**File:** `apps/api/src/services/ProfileRepairPromptService.ts`

After the AI output is validated and the track floor is applied (existing code), persist the `recommendation` object to the campaign row **with provenance metadata**:

```typescript
if (recommendation) {
  await this.prisma.mkt_campaigns_list.update({
    where: { id: campaignId },
    data: {
      repair_triage_briefing: {
        ...recommendation,
        _execution_id: execution.id,
        _validated: validated.success, // false when best-effort extraction was used
      } as any,
    },
  });
}
```

Rules:

- **No write on AI failure.** Persist only when `recommendation` is non-null — a failed parse leaves the previous briefing in place.
- **Flag best-effort output.** When strict Zod validation fails and the recommendation comes from the unvalidated fallback extraction, store it with `_validated: false` so the UI can badge it as unverified. Do not silently treat unvalidated output as canonical.
- **Provenance.** `_execution_id` lets the "Create Opener from Hook" button (§4) pass `execution_id` even after a page refresh, when the recommendation is rehydrated from the campaign row instead of React state.

This runs at triage execution time (before the operator confirms), so the briefing is on the campaign row as soon as the AI produces it. The `RepairTrackPanel` can then read it from the campaign object on refresh instead of holding it in ephemeral React state.

### Backend — `ProfileRepairPromptService.importExternalResult` (also persists)

The copy-paste bridge (`POST /:id/repair-triage/import`) is a second path that produces a triage recommendation. Persist the briefing there too, with the same `_execution_id` / `_validated` shape — otherwise operators using the import flow hit the same ephemeral-briefing problem this sprint fixes. Only persist when the import targets the triage template (`templateId === PROFILE_REPAIR_TRIAGE_TEMPLATE_ID`); per-issue imports stay execution-row-only (Non-Goals).

### Backend — `switchRepairTrack` (no change needed)

`switchRepairTrack` already updates `repair_track`, `repair_issue_type`, `track_decided_at`, `track_decision_reason`. The briefing column is set at triage execution time and doesn't need to be re-written on confirm. If the operator re-runs triage, the briefing is overwritten (latest wins).

### Frontend — `RepairTrackPanel.tsx`

**File:** `apps/web/src/components/marketing-ops/RepairTrackPanel.tsx`

Currently the panel holds the recommendation in ephemeral `useState`. After this change:

1. On mount, check `campaign.repair_triage_briefing` — if present, populate `recommendation` from it so the briefing card renders even after a page refresh (before track confirmation).
2. After `handleRunTriage`, the `onRefresh()` call re-fetches the campaign, which now carries `repair_triage_briefing` — so the recommendation persists across refreshes. (`runRepairTriage` already invalidates the `mkt-ops-campaign` cache — no extra work needed.)
3. After track confirmation, the briefing card stays visible (read from `campaign.repair_triage_briefing`) but the confirm/override buttons hide (since `currentTrack` is now set). Add a "Re-run Triage" button to allow re-evaluation.
   - **The re-run button must pass the triage template ID explicitly**: `runRepairTriage(campaign.id, 'mpt-profile-repair-triage-default')`. `executeSeekSync` resolves the template from `campaign.repair_issue_type` when no `templateId` is given — after track confirmation that field is set (e.g. `nap_drift`), so a bare call would silently run the *per-issue seek* instead and return `recommendation: null`. (This is also a latent bug in today's "Run Triage Analysis" button when a track was set manually first — fix both call sites.)
4. Surface the `_validated: false` flag (if present) as an "unverified output" badge on the briefing card.

### Frontend — `Campaign` type + shared `TriageRecommendation`

**File:** `apps/web/src/services/MarketingOpsService.ts`

- Move the `TriageRecommendation` interface out of `RepairTrackPanel.tsx` into `MarketingOpsService.ts` (exported), extended with the provenance fields:
  ```typescript
  export interface TriageRecommendation {
    // ...existing fields...
    _execution_id?: string;
    _validated?: boolean;
  }
  ```
- Add `repair_triage_briefing?: TriageRecommendation | null` to the `Campaign` interface.

---

## §3 Render Per-Issue Briefing Card

### New component — `RepairBriefingCard.tsx`

**File:** `apps/web/src/components/marketing-ops/RepairBriefingCard.tsx` (new)

A structured card that renders the `profile_repair_audit` output (scope, impact, pitch, risks) — mirrors the triage briefing card in `RepairTrackPanel` but with the per-issue shape.

Props:
```typescript
interface RepairBriefingCardProps {
  execution: PromptExecution; // passed down from CampaignDetailClient — no second fetch
  campaignId: string;
}
```

(`GET /prompts/executions/:id` and `MarketingOpsService.getExecution` already exist — see §5 — but the parent already has the full execution row from `listExecutions`, so fetching it again by ID would be a redundant network round-trip.)

Behavior:
1. Parse `execution.raw_output` as JSON, validate against the `profile_repair_audit` shape client-side (lightweight — just check the fields exist).
2. Render the briefing card: Scope (summary, affected platforms, specifics), Impact (primary consequence, reach loss, competitive gap), Pitch (opener hook in a quoted callout, pain points, value preview), Risks.
3. Include a "Create Opener from Hook" button (§4), passing `execution_id: execution.id` for provenance.

### Campaign detail integration

**File:** `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`

On the Overview tab, below `RepairTrackPanel`, add a `RepairBriefingCard` that shows the latest per-issue seek execution for the campaign.

**Match on the output schema name, not a hardcoded template-ID list.** The three seek template IDs already exist as exported constants in `ProfileRepairPromptService.ts`, and hardcoding them in frontend code means a future fourth issue-type template would be silently missed. `PromptExecution` already carries the joined `output_schema` field, so filter on `output_schema.name === 'profile_repair_audit'` instead — this automatically covers any present or future per-issue seek template:

```typescript
// Fetch the latest per-issue repair execution for this campaign
const [repairExecution, setRepairExecution] = useState<PromptExecution | null>(null);
useEffect(() => {
  if (campaign?.campaign_category !== 'profile_repair') return;
  marketingOpsService.listExecutions(campaignId).then((execs) => {
    const latest = execs
      .filter((e) => e.output_schema?.name === 'profile_repair_audit')
      .sort((a, b) => (b.executed_at || '').localeCompare(a.executed_at || ''))[0];
    setRepairExecution(latest ?? null);
  });
}, [campaign?.campaign_category, campaignId]);
```

Note: `listExecutions` caches with `this.cacheTTL` — after running a new per-issue seek, the `mkt-ops-executions` cache must be invalidated (or this fetch made with `ttl: 0`), otherwise the card shows a stale execution until TTL expiry.

Render:
```tsx
{repairExecution && (
  <RepairBriefingCard execution={repairExecution} campaignId={campaignId} />
)}
```

Only renders if a per-issue seek execution exists. The operator sees the triage briefing (from `RepairTrackPanel`) and the per-issue briefing (from `RepairBriefingCard`) stacked on the Overview tab.

---

## §4 Auto-Create Opener from Briefing Hook

### Backend — `OutreachOpenerService.createFromBriefing`

**File:** `apps/api/src/services/OutreachOpenerService.ts`

New method:

```typescript
async createFromBriefing(input: {
  campaignId: string;
  openerText: string;
  primaryAngle?: string | null; // free-text pitch angle — stored in extracted_fields, NOT hook_angle
  executedBy?: string;
  operatorName?: string;
  sourceBriefing: 'triage' | 'issue_audit';
  executionId?: string;
}, ctx?: RequestCtx): Promise<OpenerResult>
```

Behavior:
1. Resolve archetype + fields (same as `importOpener`) — for provenance and archetype assignment. Note this throws if the campaign has no `business_analysis` audit; let that error surface to the operator (the button is only meaningful on campaigns that have been through seek).
2. Run the quality gate on the opener text (same as `importOpener`).
3. **Upsert — one opener per campaign.** A partial unique index (`uq_mkt_outreach_openers_one_per_campaign WHERE message_type IS NULL`) enforces a single opener per campaign. Mirror `importOpener`'s `findFirst` + update-in-place behavior — a plain `create` would 500 when an opener already exists (including on double-click).
4. **Quality-gate failure does not block creation** (mirrors `importOpener`): store with `quality_gate_passed: false` and return the issues so the frontend can surface them in the confirmation ("Opener created — 2 quality warnings").
5. Store the opener record with:
   - `source = 'ai_briefing'` (new source value, distinguishes from 'ai' and 'external'; fits the `VarChar(20)` column — no DB constraint to migrate)
   - `opener_text = input.openerText`
   - `hook_angle = null` — **do not write the briefing's `pitch.primary_angle` here.** The column is `VarChar(40)` and the existing import route validates `hook_angle` against `HOOK_ANGLE_KEYS`; the free-text AI angle fits neither. Store it in `extracted_fields` instead.
   - `extracted_fields` includes `{ sourceBriefing, executionId, primaryAngle }` for provenance
6. Fire `fireBridgeAutoComplete(campaignId, 'opener', ...)` for parity with `importOpener` (auto-completes outreach checklist steps).
7. Return the `OpenerResult`.

This is a thin variant of `importOpener` — same storage + upsert logic, different `source` value, provenance metadata in `extracted_fields`.

### Backend — API route

**File:** `apps/api/src/routes/marketing-ops.ts`

```typescript
const openerFromBriefingSchema = z.object({
  campaign_id: z.string().min(1),
  opener_text: z.string().min(10, 'opener_text must be at least 10 characters'),
  primary_angle: z.string().max(500).optional(), // stored in extracted_fields, NOT hook_angle
  operator_name: z.string().max(120).optional(),
  source_briefing: z.enum(['triage', 'issue_audit']),
  execution_id: z.string().optional(),
});

router.post('/openers/from-briefing', async (req, res) => {
  // ... validate, call createFromBriefing, return 201 + OpenerResult
});
```

No `hook_angle` field — see §4 service notes. Declare this route alongside the other `/openers/*` routes, before the catch-all `router.get('/:id')` at the end of the file (the file documents this shadowing hazard repeatedly).

### Frontend — `MarketingOpsService.createOpenerFromBriefing`

**File:** `apps/web/src/services/MarketingOpsService.ts`

```typescript
async createOpenerFromBriefing(input: {
  campaign_id: string;
  opener_text: string;
  primary_angle?: string;
  operator_name?: string;
  source_briefing: 'triage' | 'issue_audit';
  execution_id?: string;
}): Promise<OpenerResult> {
  // POST to /openers/from-briefing, ttl: 0, invalidate mkt-ops-campaign + mkt-ops-openers
}
```

Also widen the opener source union — `OpenerSource` is currently `'ai' | 'external'` (used by the `Opener`, split-test, and pitch-pair interfaces):

```typescript
export type OpenerSource = 'ai' | 'external' | 'ai_briefing';
```

Audit any UI that switches on opener/response source (e.g. the source badges in `PitchConstructionPanel.tsx`, which currently handles only `'ai'` and `'external'`) and add an `'ai_briefing'` case (suggested label: "AI Briefing").

### Frontend — "Create Opener" buttons

**In `RepairTrackPanel.tsx`** (triage briefing):
- Add a "Create Opener from Hook" button next to the `pitch.opener_hook` display.
- On click, calls `createOpenerFromBriefing({ campaign_id, opener_text: recommendation.pitch.opener_hook, primary_angle: recommendation.pitch.primary_angle, source_briefing: 'triage', execution_id: recommendation._execution_id })` — `_execution_id` survives refresh because it's persisted inside `repair_triage_briefing` (§2).
- Shows a success toast / inline confirmation with a link to the Openers workspace. If the opener was stored with `quality_gate_passed: false`, list the gate issues in the confirmation.

**In `RepairBriefingCard.tsx`** (per-issue briefing):
- Same button next to the `pitch.opener_hook` display.
- On click, calls `createOpenerFromBriefing({ campaign_id, opener_text: briefing.pitch.opener_hook, primary_angle: briefing.pitch.primary_angle, source_briefing: 'issue_audit', execution_id: execution.id })`.
- Same success feedback.

**Overwrite guard (both buttons):** because the backend upserts in place (one opener per campaign), check whether an opener already exists for the campaign first. If one exists, confirm before overwriting ("This will replace the existing opener") — or disable the button with a link to the existing opener. Never silently overwrite.

Both buttons are optional — the operator can still manually copy the hook and use the existing import/execute flows. The button is a convenience shortcut.

---

## §5 Backend — `getExecution` endpoint (verified: no work needed)

Both pieces already exist:

- **Route:** `GET /prompts/executions/:id` in `apps/api/src/routes/marketing-ops.ts`
- **Frontend:** `MarketingOpsService.getExecution(id)`

`RepairBriefingCard` receives the execution object as a prop from `CampaignDetailClient` (§3), so neither is actually called by this sprint. No changes in this section.

---

## §6 Tests

### Schema tests

**File:** `apps/api/src/validators/__tests__/profile-repair-output.schema.test.ts`

Already updated for the new briefing shapes (11 tests pass). No additional schema tests needed for this sprint.

### Service tests

**File:** `apps/api/src/services/__tests__/ProfileRepairPromptService.test.ts` (new or existing)

- `executeSeekSync` persists `repair_triage_briefing` on the campaign row after AI output validation, including `_execution_id` and `_validated: true`.
- Best-effort extraction path persists with `_validated: false`.
- `repair_triage_briefing` is overwritten on re-run (latest wins).
- No write when AI output fails to parse (previous briefing preserved).
- `importExternalResult` with the triage template persists the briefing; with a per-issue template it does not.
- Re-run after track confirmation with an explicit triage `templateId` bypasses `resolveSeekTemplateId` and overwrites the briefing (regression coverage for the §2.3 wrong-template hazard).

### Opener service tests

**File:** `apps/api/src/services/__tests__/OutreachOpenerService.test.ts` (new or existing)

- `createFromBriefing` creates an opener with `source = 'ai_briefing'` and `hook_angle = null`.
- `createFromBriefing` updates the existing opener in place when one already exists (no unique-constraint error).
- `createFromBriefing` runs the quality gate and stores `quality_gate_passed: false` + issues on failure (does not throw).
- `createFromBriefing` stores `extracted_fields.sourceBriefing` + `extracted_fields.executionId` + `extracted_fields.primaryAngle`.

### Route tests

**File:** `apps/api/src/tests/profile-repair-prompt-routes.test.ts` (existing)

- `POST /campaigns/:id/repair-triage` response includes `recommendation`, and a follow-up `GET /:id` shows `repair_triage_briefing` on the campaign. (The route returns `{ executionId, recommendation }`, not the campaign — assert both legs.)
- `POST /openers/from-briefing` creates an opener and returns 201; second call updates in place and also returns 201/200 without error.

---

## §7 Documentation

### Runbook

**File:** `docs/LocalBiz/PROFILE_REPAIR_RUNBOOK.md`

Update §5.2 (triage) and §5.4 (Track A) to note:
- Triage briefing is persisted on the campaign row (`repair_triage_briefing`).
- Per-issue briefing is rendered on the Overview tab as a structured card.
- "Create Opener from Hook" button wires the briefing into the Openers workspace.

### User Guide

**File:** `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md`

Update §28 (Profile Repair) to describe the persistent briefing + opener handoff flow.

### AGENTS.md

Add the new column, service method, route, and component to the Profile Repair section.

---

## §8 Implementation Order

1. **Migration 232** — add `repair_triage_briefing` column + Prisma generate
2. **Backend: persist triage briefing** — `executeSeekSync` + `importExternalResult` write to campaign row (with `_execution_id` / `_validated`)
3. **Frontend: RepairTrackPanel** — read briefing from campaign object, survive refresh, show after confirm, explicit-templateId re-run, unverified badge
4. **Frontend: RepairBriefingCard** — new component for per-issue briefing (execution passed as prop)
5. **Frontend: Campaign detail integration** — fetch latest per-issue execution by `output_schema.name`, render card, handle executions-cache staleness
6. **Backend: createFromBriefing** — service method (upsert, gate, bridge autocomplete) + route (placed before catch-all `GET /:id`)
7. **Frontend: createOpenerFromBriefing** — service method, `OpenerSource` union widening, source-badge audit, buttons in both cards with overwrite guard
8. **Tests** — service + route tests
9. **Docs** — runbook, user guide, AGENTS.md
10. **Typecheck + test run** — `pnpm checkapi`, `pnpm checkweb`, `vitest`

---

## §9 Key Files

| Layer | File | Change |
|-------|------|--------|
| Migration | `database/migrations/232_repair_triage_briefing.sql` | New column |
| Prisma | `apps/api/prisma/schema.prisma` | Add `repair_triage_briefing Json?` |
| Backend service | `apps/api/src/services/ProfileRepairPromptService.ts` | Persist briefing in `executeSeekSync` + `importExternalResult` |
| Backend service | `apps/api/src/services/OutreachOpenerService.ts` | New `createFromBriefing` method (upsert semantics) |
| Backend route | `apps/api/src/routes/marketing-ops.ts` | New `POST /openers/from-briefing` route |
| Frontend service | `apps/web/src/services/MarketingOpsService.ts` | `createOpenerFromBriefing`, `Campaign` type update, shared `TriageRecommendation`, `OpenerSource` widening |
| Frontend component | `apps/web/src/components/marketing-ops/RepairTrackPanel.tsx` | Read briefing from campaign, "Create Opener" button |
| Frontend component | `apps/web/src/components/marketing-ops/RepairBriefingCard.tsx` | New — per-issue briefing card |
| Frontend page | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` | Render `RepairBriefingCard` on Overview tab |
| Tests | `apps/api/src/services/__tests__/ProfileRepairPromptService.test.ts` | Persistence tests |
| Tests | `apps/api/src/services/__tests__/OutreachOpenerService.test.ts` | `createFromBriefing` tests |
| Docs | `docs/LocalBiz/PROFILE_REPAIR_RUNBOOK.md` | §5.2, §5.4 updates |
| Docs | `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md` | §28 updates |
| Docs | `AGENTS.md` | Profile Repair section update |
