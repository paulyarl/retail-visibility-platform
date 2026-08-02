# Profile Repair Integration — Functional Spec

**Status:** Draft · **Owner:** Platform Eng · **Date:** 2026-08-01
**Companion docs:** `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md`,
`docs/RECOVERY_MANAGEMENT_ENGINE_SPRINT_PLAN.md`,
`docs/RECOVERY_MANAGEMENT_RUNBOOK.md`

---

## 1. Purpose & Summary

Add **Profile Repair** as a third Marketing Ops service vector. Profile repair
covers fixing unclaimed profiles, inconsistent Name/Address/Phone (NAP) data,
hijacked/duplicate listing details, and suspended-profile reinstatements.

The key design insight: **profile repair is not one pipeline — it is two.** The
nature of the issue determines which existing campaign pattern it maps to:

```
                        ┌───────────────────────────────┐
                        │    PROFILE REPAIR SERVICES    │
                        └───────────────┬───────────────┘
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              ▼                                                   ▼
   [ TRACK A — REVIEW PATTERN ]                     [ TRACK B — RECOVERY PATTERN ]
   (Offensive / Standard Audit & Pitch)            (Defensive / Friction-Gated Intake)
 ┌─────────────────────────────────────┐         ┌─────────────────────────────────────┐
 │ • Listing Drift & NAP Audit         │         │ • Hijacked / Duplicate Listing      │
 │ • Unclaimed Google/Apple Profiles   │         │ • Suspension / Penalty Appeals      │
 │ • Missing Category / Optimization   │         │ • Address Verification Blockers     │
 │ • Output: NAP Report & Fix Package  │         │ • Output: Evidence Intake & Appeal  │
 └─────────────────────────────────────┘         └─────────────────────────────────────┘
```

Because both tracks reuse existing stage machines, outreach surfaces, billing,
and attribution, **no new pipeline architecture is required.** The work is:
one new campaign category value, a switchable track discriminator with a
triage-first decision flow, category-aware dispatch in a handful of filter
points, new deliverable/prompt templates, and an evidence-aware intake
variant.

---

## 2. Core Design Decision — One Category, Two Switchable Tracks

### 2.1 Recommendation

Add **one** new campaign category value, `profile_repair`, plus a nullable
**track discriminator** column `repair_track` on `mkt_campaigns_list`:

| `repair_track` | Meaning | Stage machine | Outreach surface |
|---------------|---------|---------------|------------------|
| `NULL` | **Triage** — audit in progress, severity not yet assessed | Review machine (campaign sits in `seek`) | None yet |
| `standard` | Routine damage: NAP drift, unclaimed profile, missing categories | `REVIEW_TRANSITIONS` (seek → preview_built → shown → paid → delivered → retainer) | Openers + Follow-Ups workspaces (Archetype A3: Listing Drift) |
| `escalated` | Severe damage: suspension, hijack, duplicate, ownership dispute | `RECOVERY_TRANSITIONS` (audit_identified → … → resolved_and_closed) | Day 1/2/4 cascade via `RecoveryCascadeService` (automatic) |

### 2.2 Triage-first: the track is a decision, not a fork

Profile repair is **intentionally flexible**. The track is *not* chosen at
campaign creation — it is **recommended by audit analysis and confirmed by
the operator**, and it can be **re-evaluated and switched** as new evidence
surfaces:

1. **Create in triage.** Every profile repair campaign starts with
   `repair_track = NULL` in `seek`. Creation only requires the business
   identity + the raw audit signal (scraper flag, operator observation, or
   inbound complaint).
2. **Audit analysis recommends a track.** A seeded `seek`-type prompt
   (`profile_repair_triage`) runs against the audit payload and returns a
   structured assessment: severity score (1–10), recommended track, issue
   type, and rationale. Heuristic guardrails backstop the AI:
   - Any `suspension` / `hijacked_listing` / `duplicate_listing` /
     `ownership_dispute` signal → recommend `escalated`.
   - `nap_drift` / `unclaimed_profile` / `missing_category` /
     `platform_gap` only → recommend `standard`.
3. **Operator confirms or overrides.** The recommendation is advisory. The
   operator picks the track explicitly (with the recommendation pre-selected);
   the decision is stamped on the campaign (`track_decided_at`,
   `track_decision_reason`).
4. **Switch later if the picture changes.** A NAP-drift case that turns out
   to be a hijacked listing escalates mid-flight; an apparent suspension that
   resolves to a simple unclaimed profile de-escalates. See §4.3 for the
   switch mechanism and guardrails.

### 2.2 Why not two separate category values

- `transitionsFor(category)` in `MarketingCampaignService.ts` already
  centralizes dispatch; extending it to `transitionsFor(category, repairTrack)`
  is a one-function change. Two new category values (`profile_repair_standard`
  / `profile_repair_escalated`) would leak track logic into every existing
  `campaign_category` filter in the web app (Openers, Follow-Ups, Recovery
  tab, dashboard) instead of keeping it in one service function.
- Track A is *behaviorally identical* to review management: same stages, same
  workspaces, same cascade tab. The only differences are deliverable types,
  prompt templates, and service categories. Track B is *behaviorally
  identical* to recovery management: same friction-gated intake, same cascade,
  same AI-draft → approve → deliver loop. Only the intake form payload and the
  AI output schema differ.
- A `NULL`-track campaign defaults to the review machine, which is safe: its
  only reachable stages during triage are `seek` and `preview_built`, both of
  which have natural remap targets in the recovery machine if the campaign
  escalates (§4.3).

### 2.3 Alternative considered (and rejected)

"Track A campaigns are just `review_management` campaigns" — i.e., add no
category at all and only ship Track B. Rejected because operators need
per-vector reporting (dashboard pipeline, CSV export, scorecards) and
per-vector coupon/service-category validation; a shared category makes profile
repair revenue indistinguishable from review revenue.

---

## 3. Data Model Changes

Per `manual-sql-migration-policy.md`: hand-written SQL migration → apply via
SQL editor → `prisma db pull && prisma generate`. Never edit `schema.prisma`
directly. Next migration number after the current `14x` series.

### 3.1 `mkt_campaigns_list` additions

```sql
ALTER TABLE mkt_campaigns_list
  ADD COLUMN repair_track          VARCHAR(20) NULL,  -- NULL = triage; 'standard' | 'escalated'
  ADD COLUMN repair_issue_type     VARCHAR(40) NULL,  -- see §3.2
  ADD COLUMN track_decided_at      TIMESTAMPTZ NULL,  -- when the track was confirmed
  ADD COLUMN track_decision_reason TEXT NULL;         -- operator note / AI rationale snapshot

-- Guard: track must be a known value when set
ALTER TABLE mkt_campaigns_list
  ADD CONSTRAINT chk_repair_track
  CHECK (repair_track IS NULL OR repair_track IN ('standard','escalated'));

CREATE INDEX idx_mkt_campaigns_repair_track
  ON mkt_campaigns_list (campaign_category, repair_track);
```

`campaign_category` stays `VARCHAR(30)` (no DB enum, per Recovery Sprint 1) —
`profile_repair` is just a new literal, centralized in code. Track **switch
history** does not need its own table: every switch is a stage transition, so
`mkt_stage_history_list` already captures from-stage → to-stage + notes +
timestamp (§4.3 requires a note on every switch).

### 3.2 `repair_issue_type` vocabulary

| Track | Issue types |
|-------|-------------|
| `standard` | `nap_drift`, `unclaimed_profile`, `missing_category`, `missing_hours`, `platform_gap` (missing on Apple/Bing/Yelp) |
| `escalated` | `suspension`, `duplicate_listing`, `hijacked_listing`, `ownership_dispute`, `address_verification_block` |

The issue type drives: the intake form variant (Track B), the AI prompt
template selection, and the opener archetype (Track A).

### 3.3 Intake table — reuse `mkt_dispute_intake`, do not fork

Track B needs an evidence-collecting intake (business license / utility bill,
storefront photos, suspension notice details). This is structurally the same
as dispute intake: token-gated, attachment-bearing, one-per-campaign.

**Recommended:** generalize the existing table rather than create
`mkt_profile_repair_intake`:

```sql
ALTER TABLE mkt_dispute_intake
  ADD COLUMN intake_kind       VARCHAR(20) NOT NULL DEFAULT 'dispute',  -- 'dispute' | 'profile_repair'
  ADD COLUMN evidence_payload  JSONB NULL;   -- structured evidence fields (see §6.2)
```

- `access_token`, `expires_at`, `viewed_at`, `submitted_at`, attachments — all reused unchanged.
- The existing free-text columns (`owner_statement`, `proposed_resolution`)
  double as the owner's narrative for repair cases.
- `mkt_dispute_attachments` already supports images/PDFs up to 10MB — exactly
  what license/photo evidence needs (`recoveryAllowedAttachmentMimes` config
  already allows `application/pdf`, `image/png`, `image/jpeg`).

The table name becomes slightly generic-in-spirit; add a comment in the
migration. Renaming the table is **not** worth the migration risk.

### 3.4 No changes needed

- Stage machines (both reused verbatim).
- `mkt_stage_history_list`, `mkt_outreach_log`, `mkt_deliverables_list`,
  `mkt_deliverable_templates_list`, `marketing_prompt_templates_list` — all
  category-agnostic already.
- Pay/attribution tables — `/marketing/pay` and `ptoken` attribution read the
  campaign row; category is opaque to them.

---

## 4. Stage Machine & Service Changes

### 4.1 `MarketingCampaignService.ts`

```ts
export type CampaignCategory =
  | 'review_management'
  | 'recovery_management'
  | 'profile_repair';

export type RepairTrack = 'standard' | 'escalated';

export function transitionsFor(
  category: CampaignCategory = CAMPAIGN_CATEGORY_DEFAULT,
  repairTrack?: RepairTrack | null,
): Record<string, string[]> {
  if (category === 'recovery_management') return RECOVERY_TRANSITIONS;
  if (category === 'profile_repair' && repairTrack === 'escalated') return RECOVERY_TRANSITIONS;
  return REVIEW_TRANSITIONS; // review_management + profile_repair NULL (triage) / standard
}
```

`transitionStage()` reads `repair_track` from the row alongside
`campaign_category`. A `NULL` (triage) track resolves to the review machine —
during triage the campaign can only sit in `seek` / `preview_built`, which
remap cleanly if it later escalates (§4.3). The existing hooks key off stage
names, not categories, so they keep working — with two conscious decisions:

- **GBP enrichment hook** (`seek → preview_built` when no phone/website):
  applies to Track A — desirable, keep.
- **Auto intake-link generation** on entering `outreach_dispatched`: fires for
  Track B escalated campaigns. `DisputeIntakeService.generateIntakeLink()` must
  set `intake_kind = 'profile_repair'` when the campaign is `profile_repair`.

### 4.2 `recoveryStages.ts`

No new stage literals. Optionally re-export the shared module comment noting
that `profile_repair/escalated` also uses this machine (R5-style: no inline
stage strings anywhere).

### 4.3 Track switching — `switchRepairTrack()`

Track switching is a **first-class service method**, not a generic stage
transition. Generic `transitionStage()` only validates moves *within* one
machine; a track switch crosses machines, so it gets its own validated path:

```ts
async switchRepairTrack(input: {
  campaignId: string;
  toTrack: 'standard' | 'escalated';
  issueType?: string;      // revised issue type, if reassessed
  reason: string;          // mandatory — written to stage history
  changedBy?: string;
}): Promise<any>
```

**Stage remapping.** The switch rewrites `repair_track`, remaps the current
stage to its counterpart in the target machine, and logs the move in
`mkt_stage_history_list` with `trigger_type = 'track_switch'` and the
mandatory reason:

| Review machine stage | ↔ | Recovery machine stage |
|----------------------|---|------------------------|
| `seek` | ↔ | `audit_identified` |
| `preview_built` | ↔ | `framework_preview_generated` |
| `shown` | → | `outreach_dispatched` (reverse: not allowed, §guardrails) |
| `paid` / later | → | **blocked** — escalate before payment or refund-first (operator procedure) |
| — | ← | `intake_submitted` / later | **blocked** — evidence already collected; finish on the recovery track |

**Guardrails:**

1. **Escalate freely early, never after payment.** `seek` / `preview_built` /
   `shown` → escalated is always allowed. Once `paid`, the commercial
   commitment is made; escalation is blocked and handled as an operator
   procedure (refund + new linked campaign via `parent_campaign_id`).
2. **De-escalate only before intake.** `audit_identified` /
   `framework_preview_generated` / `outreach_dispatched` /
   `awaiting_owner_intake` → standard is allowed (owner hasn't invested effort
   yet). From `intake_submitted` onward, de-escalation is blocked — the
   evidence payload and cascade state only make sense on the recovery track.
3. **Cascade side-effects.** Switching *to* escalated while in
   `outreach_dispatched`-equivalent triggers the same auto intake-link
   generation hook (`intake_kind = 'profile_repair'`). Switching *away* from
   escalated during `awaiting_owner_intake` voids the outstanding intake token
   (set `expires_at = now()`) so a stale magic link can't be submitted against
   a campaign that's now on the self-serve track.
4. **Audit trail.** Every switch is a stage-history row with the reason; the
   campaign row's `track_decided_at` / `track_decision_reason` are updated to
   the latest decision. Repeated switching is allowed but visible — the
   history tab shows the full ping-pong if operators keep reassessing.
5. **`repair_issue_type` is revisable** on any switch (e.g.
   `nap_drift` → `hijacked_listing`), since severity reassessment usually
   comes with a better diagnosis.

### 4.4 Web mirror

`apps/web/src/services/MarketingOpsService.ts` — extend `CampaignCategory`
union and add `repairTrack` / `repairIssueType` to `CampaignInput` /
`CampaignUpdateInput`, mirroring the API types exactly (same pattern as
Recovery S1 task 4).

---

## 5. Track A — Standard Profile Repair (Review Pattern)

**Flow:** Scraper/audit flags NAP drift or unclaimed profile → campaign
created in triage (`profile_repair`, `repair_track = NULL`) → triage analysis
recommends `standard`, operator confirms → **Preview Built** with a
watermarked *Listing Drift & Audit Report* → opener pitch via Openers
workspace → owner pays ($99–$199 suggested price band) via `/marketing/pay` →
full *Citation & Profile Repair Package* delivered → optional retainer
upsell. If the audit or owner conversation later reveals hijack/suspension
evidence, the campaign escalates via `switchRepairTrack()` (§4.3) any time
before `paid`.

### 5.1 What already exists (zero code)

- **Archetype A3: Listing Drift** in the Openers workspace — the pitch
  archetype for exactly this pain.
- **Deliverable types** `nap_report` and `gbp_audit` in
  `MarketingDeliverableService.ts:22` — the audit artifacts.
- **Campaign audit fields** `gbp_claimed`, `nap_consistent`, `has_website`,
  `pain_score` on `mkt_campaigns_list`.
- Watermarked preview PDFs + preview tokens; `ptoken` attribution; pay page;
  coupon validation by `service_category`.

### 5.2 Net-new work

1. **New deliverable type:** `citation_repair_package` added to the
   `DeliverableType` union (paid deliverable: per-platform fix instructions,
   claim links, corrected NAP canonical record). The existing
   `nap_report` remains the watermarked preview artifact.
2. **Prompt templates (seeded, not coded):** seed
   `marketing_prompt_templates_list` with `seek`-type templates for
   `nap_drift` / `unclaimed_profile` / `platform_gap` issue types and a
   `fulfill`-type template for the citation repair package. Runs through the
   existing Prompt Workspace (Copy-Paste Bridge + Direct API).
3. **Service category values:** add `profile_repair_audit` (preview) and
   `profile_repair_package` (paid) to the service-category dropdown so coupon
   validation stays per-category (same mechanism as `review_responses`,
   `gbp_audit`).
4. **Openers/Follow-Ups filter change (the one real code change):** both
   workspaces currently filter `campaign_category = 'review_management'`.
   Change to "review management OR profile-repair/standard" — i.e., filter by
   *which stage machine governs the campaign*, not by raw category. Recommend
   exposing this from the API as a derived field (e.g. `pipeline: 'review' |
   'recovery'`) on list responses so the web app never re-implements the
   dispatch rule.
5. **Campaign form:** category selector gains **Profile Repair**; when
   selected, show the issue-type dropdown (initial diagnosis, revisable) and
   the inline explainer table extended (same pattern as the existing
   Review/Recovery explainer in `CampaignFormClient.tsx`). The track selector
   is **not** on the create form — campaigns are created in triage and the
   track is confirmed on the detail page after analysis (§7).

### 5.3 Stage walkthrough (Track A)

| Stage | What happens |
|-------|--------------|
| `seek` (triage) | Audit captured; `profile_repair_triage` prompt returns severity + recommended track; operator confirms `standard` |
| `preview_built` | Watermarked *Listing Drift & Audit Report* generated (`nap_report`) |
| `shown` | Opener sent (A3 archetype, soft or direct_paid close) |
| `paid` | Owner pays via `/marketing/pay`; coupon validated against `profile_repair_package` |
| `delivered` | Full *Citation & Profile Repair Package* PDF delivered |
| `retainer_pitched` → … | Standard retainer / tenant-conversion flow, unchanged |

---

## 6. Track B — Escalated Profile Repair (Recovery Pattern)

**Flow:** Scraper flags suspension badge / duplicate marker / hijacked
listing — *or* a triage/standard campaign escalates after reassessment →
track confirmed as `escalated` (stage remapped per §4.3) → **Framework
Preview** → intake link auto-generated → Day 1/2/4 cascade (email → SMS → DM)
→ owner submits **evidence intake** via magic link → AI Agent drafts
**Reinstatement Appeal Letter + submission guide** → operator approves →
delivered to owner. If the "suspension" turns out to be a simple unclaimed
profile before the owner submits evidence, the campaign de-escalates via
`switchRepairTrack()` and the outstanding intake token is voided.

### 6.1 What already exists (zero code)

- The full recovery stage machine + validated transitions
  (`RECOVERY_TRANSITIONS`, `recoveryStages.ts`).
- Magic-link intake infrastructure: `DisputeIntakeService`,
  `DisputeIntakeRepository`, `mkt_dispute_intake`, 7-day token TTL, reissue
  flow, expired page with **Request New Link**.
- Attachment pipeline (upload/download, 10MB, PDF/PNG/JPEG).
- `RecoveryCascadeService` Day 1/2/4 automatic cascade + intake timeout sweep.
- `RecoveryResolutionService` async AI drafting + `recovery-resolution`
  scheduler job + `recovery-delivery-retry` job.
- Operator workspace: Recovery tab, `RecoveryDetailClient.tsx`, AI Workspace
  (Copy-Paste Bridge + Direct API), approve → deliver via email.

### 6.2 Net-new work

1. **Evidence intake form variant.** Public page: extend
   `/recovery/intake` (preferred) rather than create `/repair/intake` —
   `DisputeIntakeService.resolveIntake()` already returns intake context;
   adding `intakeKind` + `issueType` to that response lets
   `IntakePageClient.tsx` render the right form. Track B form collects:
   - Owner narrative (reuses `owner_statement`)
   - Structured evidence (`evidence_payload` JSONB):
     - `proof_of_location`: business license / utility bill (attachment refs)
     - `storefront_photos`: signage / vehicle photos (attachment refs)
     - `google_profile_id`: original GBP profile ID or URL
     - `suspension_notice_details`: date + quoted reason text
     - `duplicate_listing_url`: (for duplicate/hijack issue types)
   - Validation: new `profile-repair-intake.schema.ts` Zod schema alongside
     `recovery-intake.schema.ts`; route dispatches on `intake_kind`.
2. **New deliverable type:** `reinstatement_appeal` added to the
   `DeliverableType` union. AI output schema (mirroring
   `recovery-resolution.schema.ts`): appeal letter body, evidence checklist,
   step-by-step Google Support submission guide. Failed schema validation
   lands in `mkt_filter_flags_list` exactly like recovery drafts.
3. **AI prompt template:** seeded `profile_repair_resolution` template (the
   Track-B analog of the seeded `recovery_resolution` template). Issue-type
   variable interpolation (`suspension` vs `duplicate_listing` vs
   `hijacked_listing` appeals differ materially).
4. **Cascade content templates:** the Day 1 email frames financial impact
   ("Your Google Maps profile is suspended, blocking local search calls") —
   new copy keyed off `intake_kind`, same `RecoveryCascadeService` mechanics.
5. **Recovery tab inclusion:** `RecoveryTabClient.tsx` currently filters
   `campaign_category = 'recovery_management'`. Include
   `profile_repair/escalated` (same `pipeline: 'recovery'` derived field from
   §5.2.4). Conversely, the Cascade tab on campaign detail must stay
   review-pipeline-only — Track A campaigns *should* show it (they're review
   pipeline), Track B must not.
6. **Intake link auto-generation hook:** on `outreach_dispatched`, pass
   `intake_kind: 'profile_repair'` for escalated campaigns (§4.1).

### 6.3 Stage walkthrough (Track B)

| Stage | What happens |
|-------|--------------|
| `audit_identified` | Suspension/duplicate/hijack flagged; issue type recorded |
| `framework_preview_generated` | Reinstatement strategy preview drafted |
| `outreach_dispatched` | Intake link auto-generated (`intake_kind = 'profile_repair'`) |
| `awaiting_owner_intake` | Day 1 email → Day 2 SMS → Day 4 DM cascade |
| `intake_submitted` | Owner submitted narrative + evidence payload + attachments; AI Agent enqueued |
| `final_resolution_drafted` | Appeal letter + submission guide drafted (`reinstatement_appeal` deliverable) |
| `owner_approved` | Operator approves (auto-transitions) |
| `resolved_and_closed` | Appeal package emailed to owner |
| `dead` | Token TTL + 4-day timeout sweep, or cascade exhausted |

---

## 7. Admin UI Surface Map

| Surface | Change |
|---------|--------|
| `CampaignFormClient.tsx` | Add Profile Repair category + issue-type selector; extend inline explainer. No track selector (triage-first) |
| Campaign detail (profile_repair) | **Triage panel** when `repair_track = NULL`: severity score, AI-recommended track + rationale, Confirm/Override buttons. **Switch Track** action when a track is set, with mandatory reason dialog; blocked options shown disabled with explanation (§4.3 guardrails) |
| History tab | Track switches render as stage-history rows (`track_switch` trigger) — no new UI |
| `StageBadge.tsx` | None — stage sets are reused |
| Openers / Follow-Ups pages | Filter by derived `pipeline = 'review'` (includes Track A) |
| Recovery tab / `RecoveryDetailClient.tsx` | Filter by derived `pipeline = 'recovery'` (includes Track B); render evidence payload in intake panel; `reinstatement_appeal` in deliverables |
| Campaign detail Cascade tab | Show for `pipeline = 'review'` only (Track A yes, Track B no) |
| Dashboard / pipeline chart | New category filter chip; per-vector revenue split optional |
| Deliverable template library (`DeliverableTemplateLibraryClient`) | New types appear automatically once seeded |
| Public intake page | Category-aware form variant via `intake_kind` |
| Sidebar / navigation links | None — same Marketing Ops section |

---

## 8. Billing, Coupons & Attribution

- **Pricing:** Track A one-off package via existing `package_price_cents` +
  `/marketing/pay` (suggested $99–$199 band is an operator pricing decision,
  not a platform constraint). Track B monetizes at the operator's discretion —
  either free-intake lead-gen (current recovery posture) or a paid appeal
  package via the same pay page; no billing code changes either way.
- **Coupons:** new `service_category` values (`profile_repair_audit`,
  `profile_repair_package`, optionally `profile_repair_appeal`) keep dynamic
  coupon validation working per vector.
- **Attribution:** `first_touch_source` / `last_touch_source` / `ptoken` and
  QR deliverable flows are category-agnostic — reused unchanged.
- **Retainer upsell:** Track A feeds the standard retainer pipeline; a repair
  package can upsell into monthly tiers via `subscription_tier_id`, unchanged.

---

## 9. BFRI Assessment (per backend-dev-guidelines)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Architectural Fit | 5 | Strictly reuses routes → services → repositories; no new layers |
| Business Logic Complexity | 4 | Dispatch rule + track-switch remapping with guardrails + intake variant + evidence schema |
| Data Risk | 2 | Four additive columns + two additive columns on existing tables; fully backward-compatible |
| Operational Risk | 2 | No new auth surface (magic-link pattern proven); scheduler jobs reused; token-voiding on de-escalation is the one new side-effect |
| Testability | 4 | Existing test patterns (`recoveryStages.test.ts`, `marketingCampaign.recovery.test.ts`, `recoveryResolution.test.ts`) directly applicable |

**BFRI = (5 + 4) − (4 + 2 + 2) = +1 → Risky.** Complexity, not architecture,
drives the score — specifically the track-switch state machine. Mitigation:
ship triage + switching as its own gated slice (P1 below) before any
escalated-track surface work, exactly as the Recovery Engine did from BFRI 0.

---

## 10. Suggested Slicing (sprint-level sketch)

| Slice | Scope | Demo gate |
|-------|-------|-----------|
| **P1** | Migration (§3), `CampaignCategory`/`RepairTrack` types, `transitionsFor` dispatch (incl. NULL triage), `switchRepairTrack()` + stage remap + guardrails, seeded `profile_repair_triage` prompt, derived `pipeline` field, form + filter + triage-panel updates | Triage campaign gets AI recommendation → operator confirms standard → walks seek → paid; same campaign type escalates from `preview_built` to `framework_preview_generated` with history row + reason |
| **P2** | `intake_kind` + evidence payload, intake form variant + Zod schema, `profile_repair_resolution` template, `reinstatement_appeal` deliverable, Recovery tab inclusion, cascade copy, token-voiding on de-escalation | Track B campaign walks audit_identified → resolved_and_closed; owner submits evidence via magic link; de-escalation before intake voids the token |
| **P3** | Seeded Track A prompt/deliverable templates, service-category/coupon values, user-guide + runbook updates, dashboard category chip | End-to-end both tracks; docs published |

### Test gates

- Unit: `transitionsFor` for all (category, track) combinations including
  NULL triage; regression pin that review/recovery maps are unchanged.
- Unit: `switchRepairTrack()` — every remap pair in §4.3; every blocked move
  (`paid`+ → escalated, `intake_submitted`+ → standard) rejected; missing
  reason rejected; issue-type revision persisted.
- Unit: evidence payload Zod schema rejects missing required evidence per
  issue type.
- Integration: de-escalation from `awaiting_owner_intake` voids the
  outstanding intake token (subsequent submit returns expired).
- Integration: Track A stage walk + coupon validation for
  `profile_repair_package`.
- Integration: Track B intake submit → AI draft → approve → delivered,
  mirroring `recoveryResolution.test.ts`.
- Regression: Openers/Follow-Ups/Recovery-tab filters include and exclude the
  right categories (triage/standard → review surfaces; escalated → recovery
  surfaces).

---

## 11. Open Questions

1. **Track B pricing posture** — free intake (lead-gen, current recovery
   posture) or paid appeal package? Spec supports both; decision needed before
   P2 copy is written.
2. **Triage automation depth** — the `profile_repair_triage` prompt returns a
   recommendation and the operator confirms (current spec). If volume justifies
   it later, high-confidence recommendations (severity ≥ 8 with a suspension
   signal) could auto-confirm with an operator notification; not in P1 scope.
3. **Scraper triggers** — which detection source emits suspension/duplicate
   flags, and does campaign creation happen manually (operator) or via an
   automated seek prompt? Current spec assumes manual creation, same as today.
4. **Apple/Bing reinstatement flows** — GBP reinstatement is the well-trodden
   path; Apple Maps / Bing Places appeals have different evidence
   requirements. P2 ships GBP-only templates; others follow as new seeded
   templates without code change.
5. **`mkt_dispute_intake` naming** — accept the slightly generic name (with a
   migration comment) or schedule a rename later? Recommend accept.
6. **Derived `pipeline` field** — computed in `MarketingCampaignService` list
   responses (recommended) or a persisted generated column? Persisting is
   over-engineering for a two-value dispatch.
