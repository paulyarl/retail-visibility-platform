# Profile Repair Runbook

**Status:** Active · **Owner:** Platform Eng · **Date:** 2026-08-02
**Companion docs:** `docs/LocalBiz/PROFILE_REPAIR_INTEGRATION_SPEC.md`,
`docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md`,
`docs/RECOVERY_MANAGEMENT_RUNBOOK.md`

---

## 1. Overview

Profile Repair is the third Marketing Ops service vector. It reuses both
existing pipelines (review + recovery) via a triage-first track discriminator:

- **Track A (standard):** NAP drift, unclaimed profiles, missing categories → review pipeline
- **Track B (escalated):** suspensions, hijacks, duplicates, ownership disputes → recovery pipeline
- **Triage:** every campaign starts with no track; the triage prompt recommends, the operator confirms

This runbook covers operational procedures, troubleshooting, and maintenance
for the profile repair system.

---

## 2. Architecture

### 2.1 Data Model

**`mkt_campaigns_list` additions (migration 154):**
- `repair_track` VARCHAR(20) NULL — NULL = triage; 'standard' = review pipeline; 'escalated' = recovery pipeline
- `repair_issue_type` VARCHAR(40) NULL — the issue type (nap_drift, suspension, etc.)
- `track_decided_at` TIMESTAMPTZ NULL — when the track was confirmed
- `track_decision_reason` TEXT NULL — operator note / AI rationale snapshot
- Constraint: `chk_repair_track` ensures track is NULL or a known value

**`mkt_dispute_intake` additions (migration 154):**
- `intake_kind` VARCHAR(20) NOT NULL DEFAULT 'dispute' — 'dispute' or 'profile_repair'
- `evidence_payload` JSONB NULL — structured evidence fields for Track B intakes

### 2.2 Dispatch Rule

```
transitionsFor(category, repairTrack):
  recovery_management                     → RECOVERY_TRANSITIONS
  profile_repair + repairTrack='escalated' → RECOVERY_TRANSITIONS
  profile_repair + NULL/standard          → REVIEW_TRANSITIONS
  review_management (default)             → REVIEW_TRANSITIONS
```

The derived `pipeline` field ('review' | 'recovery') is computed by
`pipelineFor()` and returned on campaign list responses. The web app filters
workspaces by `pipeline`, not by raw `campaign_category`.

### 2.3 Track Switching

`switchRepairTrack()` is a first-class service method (not a generic stage
transition) because it crosses stage machines. It:
1. Validates the move against guardrails (§2.4)
2. Remaps the current stage to its counterpart in the target machine
3. Logs the move in `mkt_stage_history_list` with `trigger_type = 'track_switch'`
4. Fires side effects (intake link generation, token voiding)

### 2.4 Stage Remap Table

| Review machine stage | ↔ | Recovery machine stage |
|----------------------|---|------------------------|
| `seek` | ↔ | `audit_identified` |
| `preview_built` | ↔ | `framework_preview_generated` |
| `shown` | → | `outreach_dispatched` (reverse: not allowed) |
| `paid` / later | → | **blocked** — escalate before payment or refund-first |
| — | ← | `intake_submitted` / later | **blocked** — evidence already collected |

### 2.5 Guardrails

1. **Escalate freely early, never after payment.** `seek` / `preview_built` / `shown` → escalated is always allowed. Once `paid`, escalation is blocked.
2. **De-escalate only before intake.** `audit_identified` / `framework_preview_generated` / `outreach_dispatched` / `awaiting_owner_intake` → standard is allowed. From `intake_submitted` onward, de-escalation is blocked.
3. **Cascade side-effects.** Switching TO escalated while in `outreach_dispatched`-equivalent triggers auto intake-link generation. Switching AWAY from escalated during `awaiting_owner_intake` voids the outstanding intake token.
4. **Audit trail.** Every switch is a stage-history row with the reason. Repeated switching is allowed but visible.
5. **`repair_issue_type` is revisable** on any switch.

---

## 3. Migrations

| # | File | Description |
|---|------|-------------|
| 154 | `154_profile_repair_track_discriminator.sql` | Campaign track columns + intake generalization + triage prompt seed |
| 155 | `155_profile_repair_resolution_template.sql` | Profile repair resolution prompt template (Track B AI agent) |
| 156 | `156_profile_repair_track_a_templates.sql` | Track A seek prompts (nap_drift, unclaimed, platform_gap) + fulfill prompt (citation package) + service categories |

### Apply order

```bash
# Apply via SQL editor, then:
cd apps/api
doppler run --config local -- pnpm prisma db pull
pnpm prisma generate
```

### Rollback

```sql
-- Migration 156
DELETE FROM mkt_prompt_templates_list WHERE id IN (
  'mpt-profile-repair-nap-drift-seek',
  'mpt-profile-repair-unclaimed-seek',
  'mpt-profile-repair-platform-gap-seek',
  'mpt-profile-repair-citation-package-fulfill'
);
DELETE FROM mkt_service_categories_list WHERE value IN (
  'profile_repair_audit', 'profile_repair_package', 'profile_repair_appeal'
);

-- Migration 155
DELETE FROM mkt_prompt_templates_list WHERE id = 'mpt-profile-repair-resolution-default';

-- Migration 154
DROP INDEX IF EXISTS idx_mkt_campaigns_repair_track;
ALTER TABLE mkt_campaigns_list DROP CONSTRAINT IF EXISTS chk_repair_track;
ALTER TABLE mkt_campaigns_list
  DROP COLUMN IF EXISTS repair_track,
  DROP COLUMN IF EXISTS repair_issue_type,
  DROP COLUMN IF EXISTS track_decided_at,
  DROP COLUMN IF EXISTS track_decision_reason;
ALTER TABLE mkt_dispute_intake
  DROP COLUMN IF EXISTS intake_kind,
  DROP COLUMN IF EXISTS evidence_payload;
DELETE FROM mkt_prompt_templates_list WHERE id = 'mpt-profile-repair-triage-default';
```

---

## 4. Key Files

### API

| File | Role |
|------|------|
| `apps/api/src/services/MarketingCampaignService.ts` | `transitionsFor(category, repairTrack)`, `pipelineFor()`, `switchRepairTrack()`, `createCampaign` (persists repair_track + repair_issue_type) |
| `apps/api/src/services/ProfileRepairPromptService.ts` | Variable builder (seek/fulfill/resolution), synchronous triage (`executeSeekSync`), Track B resolution runner (`runResolution`), copy-paste and external import bridges |
| `apps/api/src/services/DisputeIntakeService.ts` | `generateIntakeLink(campaignId, ctx, intakeKind)`, `resolveIntake()` (returns intakeKind + issueType), `submitProfileRepairIntake()` |
| `apps/api/src/services/RecoveryCascadeService.ts` | `buildMessageSnapshot()` — profile-repair-specific cascade copy |
| `apps/api/src/services/MarketingDeliverableService.ts` | `DeliverableType` union includes `reinstatement_appeal` + `citation_repair_package` |
| `apps/api/src/validators/profile-repair-output.schema.ts` | Zod schemas and prompt suffixes for `profile_repair_triage`, `profile_repair_audit`, and `citation_repair_package` |
| `apps/api/src/validators/profile-repair-intake.schema.ts` | Zod schema for evidence payload + issue-type-specific validation |
| `apps/api/src/jobs/recovery-resolution.ts` | Scheduler job polling pending resolution executions for both dispute and profile repair templates |
| `apps/api/src/scripts/seed-profile-repair-signals.ts` | Seed script for escalated `DS_*` signal codes and triage template output schema registration |
| `apps/api/src/routes/marketing-ops.ts` | Routes for `switch-track`, `/repair-triage` (execute, render, import), `/repair-resolution` (enqueue, render) |
| `apps/api/src/routes/recovery-intake-public.ts` | `POST /public/recovery/intake/submit` — dispatches on intake_kind |

### Web

| File | Role |
|------|------|
| `apps/web/src/services/MarketingOpsService.ts` | `CampaignCategory` + `RepairTrack` types, `switchRepairTrack()`, `runRepairTriage()`, `renderRepairTriage()`, `importRepairTriage()`, `runRepairResolution()`, `renderRepairResolution()` |
| `apps/web/src/services/RecoveryIntakePublicService.ts` | `IntakeContext` includes intakeKind + issueType, `submitProfileRepairIntake()` method |
| `apps/web/src/components/marketing-ops/RepairTrackPanel.tsx` | Interactive triage workflow (Run Analysis, recommendation card, Confirm / Override) + Switch Track dialog |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` | Profile Repair category + issue-type selector |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` | RepairTrackPanel integration, Cascade tab gated to review pipeline |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/openers/OpenerWorkspaceClient.tsx` | Filters by `pipeline === 'review'` (includes Track A) |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/follow-ups/FollowUpWorkspaceClient.tsx` | Filters by `pipeline === 'review'` (includes Track A) |
| `apps/web/src/app/recovery/intake/IntakePageClient.tsx` | Profile-repair form variant (issue type, evidence fields, required uploads) |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx` | Evidence payload rendering in intake panel |

---

## 5. Operational Procedures

### 5.1 Creating a Profile Repair Campaign

1. Navigate to `/settings/admin/marketing-ops/campaigns/new`
2. Select **Profile Repair** as the campaign category
3. Select the **Initial Issue Type** from the dropdown (this is the initial diagnosis, revisable)
4. Fill in the business information + audit signals
5. Submit — the campaign is created in `seek` with `repair_track = NULL` (triage)

### 5.2 Triaging a Profile Repair Campaign

1. Open the campaign detail page
2. The **Repair Track Panel** shows the Triage header with a **"Run Triage Analysis"** button
3. Click **"Run Triage Analysis"**:
   - The backend runs `ProfileRepairPromptService.executeSeekSync()`, automatically extracting signals via `SignalExtractor` (covering both model-emitted and legacy-derived signals) and injecting `audit_signals`, `audit_results` (full serialized audit data), and `issue_type` into `mpt-profile-repair-triage-default`
   - The AI produces an **operator briefing** (not just a track label): scope assessment (what's broken, which platforms, drift details, missing assets), viability assessment (pursue / pursue_with_caveats / low_probability), pitch angle (category-aware opener hook + pain points + marketplace positioning), and risk flags
   - The track recommendation is backed by a code-side floor (`resolveTrackFromSignals`): the AI may escalate above the deterministic signal→track mapping, but never de-escalate below it
4. Review the **AI Triage Briefing Card**:
   - **Scope**: what's actually broken, drawn from audit data
   - **Viability**: whether the campaign is worth pursuing
   - **Pitch Angle**: category-aware opener hook + pain points for the Openers workspace
   - **Risks**: anything that makes this campaign harder than it looks
   - **Severity Score Badge** (1–10 color-coded: green 1–3, amber 4–6, red 7–10)
   - **Recommended Track** (`Standard (Review)` vs `Escalated (Recovery)`)
   - **One-Click Confirm:** Click **"Confirm [Standard/Escalated] Track"** to confirm the recommendation. The system sets the track, revises the confirmed issue type, and stores the rationale in stage history.
   - **Override:** Click **"Override / Custom..."** to select a different track or manually edit the rationale before saving.

### 5.3 Switching Tracks Mid-Flight

1. Open the campaign detail page
2. Click **Switch Track** on the Repair Track Panel
3. Select the target track
4. Enter a mandatory reason (logged in stage history)
5. Optionally revise the issue type
6. Confirm — the stage is remapped to the target machine's equivalent

**Blocked moves** produce an error explaining why (e.g., "Cannot escalate from stage 'paid'. Escalate before payment or refund first.")

### 5.4 Track A — Standard Profile Repair

Track A campaigns behave identically to review management campaigns:
1. **Seek → Preview Built:** Run the appropriate seek prompt (nap_drift, unclaimed, or platform_gap). Each produces an issue-specific repair briefing (scope, impact, category-aware pitch, risks) grounded in the audit data, which becomes the basis for the watermarked NAP report and the opener conversation.
2. **Preview Built → Shown:** The campaign appears in the Openers workspace (A3 Listing Drift archetype). Send the opener using the briefing's opener hook + pain points.
3. **Shown → Paid:** Owner pays via `/marketing/pay`. Coupon validated against `profile_repair_package`.
4. **Paid → Delivered:** Run the `citation_repair_package` fulfill prompt. Generate the Citation & Profile Repair Package deliverable.
5. **Delivered → Retainer:** Standard retainer upsell flow.

### 5.5 Track B — Escalated Profile Repair

Track B campaigns behave identically to recovery management campaigns:
1. **Audit Identified → Framework Preview:** Draft the reinstatement strategy preview.
2. **Framework Preview → Outreach Dispatched:** Intake link auto-generated with `intake_kind = 'profile_repair'`.
3. **Outreach Dispatched → Awaiting Owner Intake:** Day 1 email (profile repair copy) → Day 2 SMS → Day 4 DM cascade.
4. **Awaiting Owner Intake → Intake Submitted:** Owner submits narrative + evidence payload + attachments via the public intake page.
5. **Intake Submitted → Final Resolution Drafted:** The `jobs/recovery-resolution.ts` scheduler job (or manual execute) triggers `ProfileRepairPromptService.runResolution()`. The AI Agent drafts the reinstatement appeal letter + submission guide, persists a `reinstatement_appeal` deliverable with response and guide sections, and transitions the campaign to `final_resolution_drafted`.
6. **Final Resolution Drafted → Owner Approved:** Operator reviews + approves.
7. **Owner Approved → Resolved & Closed:** Appeal package emailed to owner (tracked + auto-retried).

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Track switching is only available for profile_repair campaigns" | Tried to switch track on a non-profile-repair campaign | Track switching only applies to `campaign_category = 'profile_repair'` |
| "Cannot escalate from stage 'paid'" | Tried to escalate after payment | Escalate before payment, or refund + create a new linked campaign |
| "Cannot de-escalate from stage 'intake_submitted'" | Tried to de-escalate after evidence was collected | Evidence payload only makes sense on the recovery track; finish there |
| "A reason is required for track switches" | Tried to switch without a reason | Every track switch requires a reason (logged in stage history) |
| Profile repair campaign not appearing in Openers | Campaign is on the escalated track (recovery pipeline) | Openers only shows `pipeline = 'review'` campaigns. Escalated campaigns appear in the Recovery tab. |
| Profile repair campaign not appearing in Recovery tab | Campaign is in triage or on the standard track (review pipeline) | Recovery tab only shows `pipeline = 'recovery'` campaigns. Standard campaigns appear in Openers/Follow-Ups. |
| Cascade tab missing on campaign detail | Campaign is on the escalated track (recovery pipeline) | Cascade tab is review-pipeline only. Escalated campaigns use RecoveryCascadeService. |
| Evidence intake form not rendering | `intake_kind` not set to `profile_repair` on the intake row | Check `mkt_dispute_intake.intake_kind` for the campaign. Should be `profile_repair` for escalated campaigns. |
| Owner can't submit evidence | Required evidence missing for the issue type | Issue-type-specific validation requires certain fields (e.g., suspension requires notice details + Google profile ID; duplicate requires URL + storefront photos) |

---

## 7. Monitoring

### 7.1 Track Distribution

```sql
SELECT repair_track, COUNT(*)
FROM mkt_campaigns_list
WHERE campaign_category = 'profile_repair'
GROUP BY repair_track;
```

### 7.2 Track Switch History

```sql
SELECT campaign_id, from_stage, to_stage, notes, created_at
FROM mkt_stage_history_list
WHERE trigger_type = 'track_switch'
ORDER BY created_at DESC
LIMIT 20;
```

### 7.3 Profile Repair Intakes by Issue Type

```sql
SELECT c.repair_issue_type, COUNT(*) as intake_count
FROM mkt_dispute_intake i
JOIN mkt_campaigns_list c ON i.campaign_id = c.id
WHERE i.intake_kind = 'profile_repair' AND i.submitted_at IS NOT NULL
GROUP BY c.repair_issue_type
ORDER BY intake_count DESC;
```

---

## 8. Open Questions

1. **Track B pricing posture** — free intake (lead-gen, current recovery posture) or paid appeal package? Spec supports both; decision needed before P2 copy is finalized.
2. **Triage automation depth** — high-confidence recommendations (severity ≥ 8 with a suspension signal) could auto-confirm with an operator notification; not in current scope.
3. **Scraper triggers** — which detection source emits suspension/duplicate flags? Current spec assumes manual creation.
4. **Apple/Bing reinstatement flows** — P2 ships GBP-only templates; Apple Maps / Bing Places appeals have different evidence requirements and would follow as new seeded templates.
5. **`mkt_dispute_intake` naming** — accept the slightly generic name (with a migration comment) or schedule a rename later? Recommend accept.
