# Recovery Management Engine — Sprint Plan

**Status:** Draft · **Owner:** Platform Eng · **Date:** 2026-08-01
**Companion doc:** `RECOVERY_MANAGEMENT_ENGINE_INTEGRATION_ANALYSIS.md`
**Source spec:** *Recovery Management Engine Integration* (functional spec)

---

## 1. Plan Summary

Four sprints, two weeks each (8 weeks total). Each sprint ships a demonstrable
slice. The order is data → public surface → AI agent → operator workspace, so
that every layer is independently testable before the next builds on it.

| Sprint | Theme | Net-new artifacts | Demo |
|---|---|---|---|
| S1 | Data model + stage machine | Prisma migration, `recoveryStages.ts`, `transitionsFor()`, `DisputeIntakeRepository` | Create a recovery campaign via service; assert transitions |
| S2 | Public intake portal (magic link) | `recovery-intake-public.ts`, `recovery/intake` + `recovery/expired` pages, `RecoveryIntakePublicService` | Owner opens link, submits form with attachment, stage flips to `intake_submitted` |
| S3 | Recovery AI Agent + deliverable | Seeded `recovery_resolution` prompt template + output schema, `RecoveryResolutionService`, `recovery-resolution` scheduler job (no queue exists — in-process scheduler pattern), draft deliverable | Submit → async draft produced → `final_resolution_drafted` |
| S4 | Operator workspace + cascade + hardening | Admin endpoints, `RecoveryOpsService`, recovery outreach sequence, owner delivery, intake timeout, tests, Sentry, docs | Operator approves draft → `resolved_and_closed` → owner receives resolution; cascade fires |

**BFRI reminder:** the integration analysis scored BFRI 0 (Risky). Each sprint
therefore includes a mandatory test gate before the next sprint starts.

---

## 2. Sprint 1 — Data Model & Stage Machine

**Goal:** Extend `mkt_campaigns_list` with `campaign_category`, add the recovery
stage track, and stand up the dispute intake tables — all behind the existing
service layer with zero behavior change for review campaigns.

### 2.1 Tasks

1. **Prisma migration** — add `mkt_campaigns_list.campaign_category` (default
   `review_management`, `VarChar(30)`, index). Add `mkt_dispute_intake` +
   `mkt_dispute_attachments` per analysis §4.3 (including `tenant_id`). IDs are
   app-generated strings (no `@default`) via `lib/id-generator.ts`. **Migration
   workflow caveat:** this repo does not use plain `prisma migrate dev`
   timestamped folders for everything — `apps/api/prisma/migrations/` holds
   docs/backups, custom scripts live in `apps/api/prisma/scripts/`
   (e.g. `migrate_v34.sh` / `rollback_v34.sh`), and `db:migrate` runs through
   doppler. Confirm the exact workflow used for the most recent `mkt_*` table
   addition and follow it, including a matching rollback script. RLS decision:
   first verify the actual DB-level RLS posture on an existing `mkt_*` table
   (analysis R7 — no policies exist in migration SQL, and the public pay route
   reads preview tokens without issue), then mirror the
   `mkt_deliverable_preview_tokens` posture for the new tables and document it
   in the migration.
2. **Stage literals** — new `apps/api/src/services/recoveryStages.ts` exporting
   the 9 recovery stage strings as a const + Zod enum. No inline strings
   anywhere (R5).
3. **Category-aware transitions** — extend
   `MarketingCampaignService.isValidTransition()` with a `category` param
   (defaults to `review_management`). Add `RECOVERY_TRANSITIONS` map per
   analysis §4.2. Update `transitionStage()` to read `campaign_category` from
   the row and dispatch to the right table.
4. **`CampaignCategory` type** — add to `MarketingCampaignService.ts` and
   mirror in `apps/web/src/services/MarketingOpsService.ts`. Update
   `CampaignInput` / `CampaignUpdateInput` to accept `campaignCategory`.
5. **`DisputeIntakeRepository`** — new repository class
   (`apps/api/src/repositories/DisputeIntakeRepository.ts`) wrapping Prisma
   access: `create`, `findByToken`, `findByCampaign`, `markViewed`,
   `submitIntake`, `addAttachment`. No Prisma in controllers (per
   backend-dev-guidelines §7).
6. **Token generator** — `generateDisputeToken()` in `lib/id-generator.ts`
   following the existing nanoid convention (`generatePreviewToken()`, :1755 —
   32-char URL-safe alphabet). TTL from
   `unifiedConfig.recovery.intakeTokenTtlDays` (default 7).
7. **`unifiedConfig` keys** — add `recovery.intakeTokenTtlDays`,
   `recovery.maxAttachmentBytes`, `recovery.allowedAttachmentMimes`,
   `recovery.aiProvider`, `recovery.aiModel`. No `process.env` anywhere.

### 2.2 Tests (gate for S2)

- Unit: `transitionsFor('review_management')` returns the existing map
  unchanged (regression). The test must encode the **actual** map from
  `MarketingCampaignService.ts:54–64` — including the `closed` stage and
  one-way `lost → seek` / `dead → seek` resurrection paths — not the idealized
  diagram originally in analysis §2.2 (now corrected).
- Unit: every recovery transition in the spec's diagram is allowed; every
  illegal jump is rejected.
- Unit: `DisputeIntakeRepository.findByToken` rejects expired tokens.
- Integration: create a recovery campaign, walk
  `audit_identified → … → intake_submitted` via the service.

### 2.3 Files touched

```
apps/api/prisma/schema.prisma                              (edit)
<migration per confirmed repo workflow — see S1 task 1;  (new)
 e.g. apps/api/prisma/scripts/ + rollback script>
apps/api/src/services/MarketingCampaignService.ts          (edit)
apps/api/src/services/recoveryStages.ts                    (new)
apps/api/src/repositories/DisputeIntakeRepository.ts       (new)
apps/api/src/lib/id-generator.ts                           (edit)
apps/api/src/config/unifiedConfig.ts                       (edit)
apps/web/src/services/MarketingOpsService.ts               (edit)
apps/api/src/services/__tests__/recoveryStages.test.ts     (new)
apps/api/src/services/__tests__/marketingCampaign.recovery.test.ts (new)
```

(Test files follow the colocated `__tests__/` convention, e.g.
`apps/api/src/services/__tests__/MarketingCampaignService.test.ts`.)

---

## 3. Sprint 2 — Public Intake Portal (Magic Link)

**Goal:** Zero-auth owner-facing form that resolves a token, shows complaint
context, accepts statement + resolution stance + proof attachments, and flips
the campaign to `intake_submitted`.

### 3.1 Tasks

1. **`DisputeIntakeService`** — new singleton
   (`apps/api/src/services/DisputeIntakeService.ts`) extending `BaseService`.
   Methods: `generateIntakeLink(campaignId)` (creates
   `mkt_dispute_intake` row + token, transitions campaign to
   `awaiting_owner_intake`), `resolveIntake(token)` (returns complaint context
   for the form header; stamps `viewed_at` here, mirroring the `GET /pay`
   handler pattern), `submitIntake(token, payload)` (Zod-validate,
   **idempotent**: if `submitted_at` is already set, return the existing
   submission instead of re-persisting/re-transitioning; persist, transition to
   `intake_submitted`, enqueue recovery resolution job — job body implemented in
   S3, stubbed here), `reissueLink(campaignId)` (rate-limited via the existing
   global `express-rate-limit` infra + a per-campaign check; updates the token
   on the existing `mkt_dispute_intake` row — `campaign_id` is `@unique`, so
   reissue must not insert a second row).
2. **Zod validators** — `apps/api/src/validators/recovery-intake.schema.ts`:
   - `intakeSubmitSchema`: `ownerStatement` (min 20 chars), `proposedResolution`
     (enum + custom text), `serviceDate` (optional date), `statusFlag`
     (optional enum), `attachments` (array of file metadata).
   - `attachmentMimeSchema`: pdf/png/jpeg, ≤10MB (from `unifiedConfig`).
3. **Public route** — `apps/api/src/routes/recovery-intake-public.ts`:
   - `GET  /api/public/recovery/intake` — resolve token → context header data.
   - `POST /api/public/recovery/intake/submit` — validate + persist + transition.
   - `POST /api/public/recovery/intake/reissue` — request new link.
   - `POST /api/public/recovery/intake/attachments` — upload (multipart).
     **Note:** `MarketingFileService` is metadata-only — the mime allowlist,
     10MB cap, per-token count limit, and virus-scan hook are **new code** in
     the intake path, and the actual storage backend must be identified and
     named here before implementation (pre-kickoff checklist §6.5). Returns
     `file_url`.
   - `GET  /api/public/recovery/intake/attachments/:id` — token-scoped download.
   Register in `routeRegistry.ts` (mount at `/api`, `authLevel: 'public'`).
   All handlers wrapped in `asyncErrorWrapper`; errors logged via `logger.error`
   (which ships to Sentry through the logger's Sentry transport — do not import
   Sentry directly in handlers, that is not the codebase pattern). Never log the
   raw `token` param.
4. **Web public service** —
   `apps/web/src/services/RecoveryIntakePublicService.ts` extending
   **`PublicApiSingleton`** (the platform's zero-auth domain base — see analysis
   §5.3 and `.devin/skills/deploy-service-extending-base-singleton.md`).
   Standard boilerplate: private constructor, `getInstance()`,
   `super('recovery-intake-public', …)`. Methods mirror the four endpoints via
   `makeDefaultRequest()`. Two skill-doc requirements: (a) bypass the 15-min
   default cache on resolve/submit/reissue (no cache key or `ttl: 0`);
   (b) unwrap responses with `result.data?.data || result.data` (double-wrap
   contract).
5. **Web pages**:
   - `apps/web/src/app/recovery/intake/page.tsx` — server entry, reads `?token=`.
   - `apps/web/src/app/recovery/intake/IntakePageClient.tsx` — context header
     (date, board/source, complaint summary), Field 1 textarea, Field 2
     single-select + custom text, Field 3 uploader (PDF/PNG/JPEG ≤10MB), submit.
   - `apps/web/src/app/recovery/expired/page.tsx` — "Request New Link" splash
     with reissue CTA calling `reissueLink`.
   - Use Mantine components (matches `PayPageClient.tsx`).
6. **Link generation hook** — when a recovery campaign transitions to
   `outreach_dispatched`, `MarketingCampaignService` calls
   `DisputeIntakeService.generateIntakeLink(campaignId)` and the resulting URL
   is included in the outreach opener payload.
7. **Orphan attachment purge** — uploads happen before submit, so files against
   never-submitted tokens are orphaned. Add a purge path: either a periodic
   cleanup in the S3 scheduler job (delete attachments whose intake is
   unsubmitted and expired > N days) or attach-on-submit-only. Decide in S2;
   default to the cleanup in the S3 job.

### 3.2 Tests (gate for S3)

- Integration: full submit happy path (token → context → submit → stage flip).
- Integration: expired token returns `{ expired: true }`; reissue creates a new
  token and invalidates the old.
- Integration: attachment upload rejects wrong mime + oversize.
- Integration: double-submit returns the original submission without a second
  stage transition or duplicate execution.
- Unit: `DisputeIntakeService.submitIntake` calls `transitionStage` with
  `triggerType: 'system'`.
- E2E (web, Playwright — the CI e2e runner): render intake page from a fixture
  token, submit, see success state.

### 3.3 Files touched

```
apps/api/src/services/DisputeIntakeService.ts              (new)
apps/api/src/validators/recovery-intake.schema.ts          (new)
apps/api/src/routes/recovery-intake-public.ts              (new)
apps/api/src/routes/routeRegistry.ts                       (edit)
apps/web/src/services/RecoveryIntakePublicService.ts       (new)
apps/web/src/app/recovery/intake/page.tsx                  (new)
apps/web/src/app/recovery/intake/IntakePageClient.tsx      (new)
apps/web/src/app/recovery/expired/page.tsx                 (new)
apps/api/src/services/__tests__/disputeIntake.test.ts      (new)
apps/web/e2e/recovery-intake.spec.ts                       (new — Playwright)
```

(Web E2E uses Playwright, matching the CI setup; web unit tests are vitest
`.test.ts`, and no React component-test setup is confirmed — don't assume
`.test.tsx` works.)

---

## 4. Sprint 3 — Recovery AI Agent & Deliverable

**Goal:** On `intake_submitted`, run the seeded Recovery Agent prompt, validate
output, write a `recovery_resolution` deliverable, and transition to
`final_resolution_drafted`.

### 4.1 Tasks

1. **Seed prompt template** — migration/seed inserting a
   `mkt_prompt_templates_list` row:
   - `prompt_type = 'recovery_resolution'`
   - `scope = 'business'`
   - `body` = the system prompt from spec §4.1 (ROLE / OBJECTIVE / CONSTRAINTS)
     plus variable interpolation markers for `complaintText`,
     `intakePayload`, `attachmentMeta`.
   - `output_schema` = `{ name: 'recovery_resolution', fields: {
       deliverableText: string, submissionGuide: string } }`.
2. **Output schema registration** — register `recovery_resolution` in
   `OUTPUT_SCHEMA_REGISTRY` (alongside the existing schemas used by
   `importExternalResult`) with a Zod parser.
3. **`RecoveryResolutionService`** — new singleton
   (`apps/api/src/services/RecoveryResolutionService.ts`):
   - `enqueue(campaignId, intakeId)` — loads complaint text (from
     `mkt_audits_list` / campaign notes), intake payload, attachment meta;
     calls `MarketingPromptService.createExecution` with the seeded template.
   - `run(executionId)` — invokes `AIProviderService` with
     `unifiedConfig.recovery.aiProvider` / `aiModel`, writes `raw_output`,
     validates against `output_schema`, persists metrics via
     `MarketingPromptService.updateExecution()` (`filtered_output`,
     `pass_rate`, `flagged_count`, `ai_model`, `tokens_used`, `cost_cents` —
     `createExecution` does not set these), creates a `mkt_deliverables_list`
     row (`deliverable_type = 'recovery_resolution'`, `status = 'drafted'` —
     free-string column, no DB change) with two `mkt_deliverable_section` rows
     (`response_draft`, `submission_guide`), transitions campaign to
     `final_resolution_drafted`.
   - On validation failure: write `mkt_filter_flags_list` rows, leave campaign
     at `intake_submitted`, surface flags to operator.
4. **Scheduler job (net-new infra — no queue exists)** — the platform has no
   BullMQ/pg-boss; async jobs are in-process `setInterval` schedulers under
   `apps/api/src/jobs/` started in `index.ts`. Add
   `apps/api/src/jobs/recovery-resolution.ts` following the
   `marketing-ops-auto-followup.ts` pattern: poll `mkt_prompt_executions_list`
   for `status='pending'` recovery executions, call
   `RecoveryResolutionService.run()`, mark complete/failed. Also house the S2
   orphan-attachment purge here (S2 task 7).
5. **Wire S2 stub** — replace the S2 `submitIntake` stub with a real call to
   `RecoveryResolutionService.enqueue`. Execution is async (per analysis §11
   Q3, implemented via the job above); the public submit returns 202
   immediately.
6. **Operator preview** — extend `MarketingDeliverableService` to render a
   `recovery_resolution` deliverable (sections → text blocks). Reuse the
   existing `mkt_deliverable_preview_tokens` for operator-shareable previews
   (not for owner intake — see R6).

### 4.2 Tests (gate for S4)

- Unit: `RecoveryResolutionService.run` with a mocked AI provider produces a
  valid deliverable + transitions stage.
- Unit: invalid AI output → filter flags created, stage unchanged.
- Integration: end-to-end submit → async draft → `final_resolution_drafted`.
- Snapshot: seeded template body matches spec §4.1.

### 4.3 Files touched

```
apps/api/prisma/seeds/recovery_resolution_template.seed.ts (new — seed infra
    exists: prisma/seed.ts + db:seed script; requires the source spec to be
    checked into docs/ first — see §6.4 Q5)
apps/api/src/services/RecoveryResolutionService.ts         (new)
apps/api/src/jobs/recovery-resolution.ts                   (new — scheduler, see task 4)
apps/api/src/index.ts                                      (edit — start the job)
apps/api/src/services/MarketingPromptService.ts            (edit — register schema)
apps/api/src/services/MarketingDeliverableService.ts       (edit — render recovery type)
apps/api/src/services/DisputeIntakeService.ts              (edit — wire enqueue)
apps/api/src/services/__tests__/recoveryResolution.test.ts (new)
```

---

## 5. Sprint 4 — Operator Workspace, Cascade & Hardening

**Goal:** Operator reviews/approves drafts, the outreach cascade fires on
`awaiting_owner_intake`, and the whole flow is production-hardened.

### 5.1 Tasks

1. **Admin endpoints** — fold into `apps/api/src/routes/marketing-ops.ts`
   (admin-authed, not public):
   - `GET  /api/admin/marketing-ops/recovery/campaigns` — list recovery
     campaigns grouped by stage.
   - `GET  /api/admin/marketing-ops/recovery/:campaignId/intake` — full intake +
     attachments.
   - `GET  /api/admin/marketing-ops/recovery/:campaignId/draft` — current
     resolution draft + sections.
   - `PATCH /api/admin/marketing-ops/recovery/:campaignId/draft` — edit
     `response_draft` / `submission_guide` sections.
   - `POST /api/admin/marketing-ops/recovery/:campaignId/approve` — transition
     `final_resolution_drafted → owner_approved → resolved_and_closed`
     (two-step or single action per operator preference; default single action
     with audit log).
   - `POST /api/admin/marketing-ops/recovery/:campaignId/regenerate` — re-run
     the agent with edited intake/operator notes.
2. **`RecoveryOpsService`** — new web service extending `AdminApiSingleton`
   (mirrors `MarketingOpsService`). Methods mirror the admin endpoints.
3. **Operator UI** — add a **Recovery** tab/filter to the existing Marketing Ops
   admin page (decided: tab inside the existing page — analysis §11 Q4; do not
   create a new top-level nav section or a new route directory). The admin
   section lives at `apps/web/src/app/(platform)/settings/admin/marketing-ops/`
   (hyphenated — **not** `marketing/`). Show:
   - Recovery campaign list with stage chips.
   - Detail view: complaint + intake + attachments + draft (editable) +
     approve/regenerate buttons.
   - Extend `campaigns/new` with a `campaign_category` selector so operators can
     create recovery campaigns (currently unowned — analysis §11 Q6).
   - Use the existing Mantine admin shell.
4. **Outreach cascade** — add a recovery sequence config consumed by
   `OutreachFollowUpService`:
   - Day 1: primary email (frame preview + grade impact + CTA = intake link).
   - Day 2 (unopened 24–48h): SMS pointer to email.
   - Day 4 (unopened 48h): webform/DM administrative check-in.
   - Gates on `campaign_category = 'recovery_management'` AND
     `stage = awaiting_owner_intake`. Uses `mkt_outreach_openers_list` with a
     recovery archetype and `mkt_outreach_log` for tracking.
5. **Owner delivery of the approved resolution** — on `resolved_and_closed`,
   send the approved `response_draft` + `submission_guide` to the owner via
   `MarketingOutreachService` (email), recorded in `mkt_outreach_log` with
   `message_snapshot`. Without this step the business outcome never reaches the
   owner (analysis §6 step 7).
6. **Intake timeout** — extend the S3 scheduler job: campaigns stuck in
   `awaiting_owner_intake` past token TTL + cascade exhaustion transition to
   `dead` (transition added in analysis §4.2). No limbo states.
7. **Hardening**:
   - Errors logged via `logger.error` on every new handler (ships to Sentry via
     the logger transport); no swallowed errors.
   - Rate limit `reissue` (per IP + per campaign; global `express-rate-limit`
     infra already exists).
   - Virus-scan hook on attachment upload before persisting `file_url` (new
     code — see S2 task 3).
   - Audit log entries (`audit_log`) for every stage transition + approval, and
     for public-side intake view/submit events (no PII beyond IDs in the
     payload).
   - `pnpm checkapi` + `pnpm checkweb` green (note: both are **typecheck-only**
     scripts, and CI runs typecheck/lint with `|| true` — the sprint gates are
     enforced in PR review, not by CI).
6. **Docs** — append a `RECOVERY_MANAGEMENT_RUNBOOK.md` covering: how to create
   a recovery campaign, how the intake link is delivered, how the operator
   approves a draft, how to regenerate, and the cascade timeline.

### 5.2 Tests (release gate)

- Integration: operator approve → `resolved_and_closed`; audit log entry
  present; owner delivery email recorded in `mkt_outreach_log`.
- Integration: campaign stuck in `awaiting_owner_intake` past TTL transitions
  to `dead` via the scheduler job.
- Integration: regenerate produces a new draft version; old version archived.
- Integration: cascade fires Day 1 email on `outreach_dispatched`; Day 2 SMS
  only if unopened.
- E2E (web): operator logs in, opens recovery tab, approves a draft.
- Load: 100 concurrent intake submits (async path must not block).
- Security: token enumeration resistance (random 64-char hex), expired-token
  reissue rate limit, attachment mime enforcement.

### 5.3 Files touched

```
apps/api/src/routes/marketing-ops.ts                       (edit — admin endpoints)
apps/api/src/services/OutreachFollowUpService.ts           (edit — recovery sequence)
apps/api/src/services/MarketingOutreachService.ts          (edit — owner delivery)
apps/api/src/services/RecoveryResolutionService.ts         (edit — regenerate)
apps/api/src/jobs/recovery-resolution.ts                   (edit — intake timeout sweep)
apps/web/src/services/RecoveryOpsService.ts                (new)
apps/web/src/app/(platform)/settings/admin/marketing-ops/  (edit — Recovery tab +
    campaigns/new category selector; no new route directory)
apps/api/src/services/__tests__/recoveryAdmin.test.ts      (new)
apps/api/src/services/__tests__/recoveryCascade.test.ts    (new)
apps/web/e2e/recovery-ops.spec.ts                          (new — Playwright)
docs/RECOVERY_MANAGEMENT_RUNBOOK.md                        (new)
```

---

## 6. Cross-Sprint Concerns

### 6.1 Branching

- Branch from `staging`: `feature/recovery-engine-s1` … `s4`.
- Each sprint PR merges back to `staging` after the test gate passes.
- No long-lived feature branch; rebase weekly.

### 6.2 Verification per sprint

| Sprint | `pnpm checkapi` | `pnpm checkweb` | Unit | Integration | E2E |
|---|---|---|---|---|---|
| S1 | ✓ | ✓ | ✓ | ✓ | — |
| S2 | ✓ | ✓ | ✓ | ✓ | ✓ |
| S3 | ✓ | ✓ | ✓ | ✓ | — |
| S4 | ✓ | ✓ | ✓ | ✓ | ✓ |

### 6.3 Rollback

- S1 migration is additive (new columns/tables with defaults) → safe rollback
  by dropping the new objects; existing rows keep `campaign_category =
  review_management` default.
- S2–S4 are code-only; revert the PR.

### 6.4 Open questions to resolve before S1 kickoff

Each question needs a named owner and a decision recorded here before kickoff.

| # | Question | Recommendation | Owner |
|---|---|---|---|
| Q1 | DB-level RLS posture for `mkt_*`; policy for `mkt_dispute_intake` (analysis §11 Q1 / R7) | Verify actual posture on an existing table first, then mirror `mkt_deliverable_preview_tokens` | TBD |
| Q2 | Token TTL global vs per-tenant (analysis §11 Q2) | Global via `unifiedConfig` | TBD |
| Q3 | Sync vs async agent execution (analysis §11 Q3) | Async via new S3 scheduler job (no queue exists) | TBD |
| Q4 | Operator nav: new section vs tab (analysis §11 Q4) | **Decided:** tab inside existing marketing-ops admin page | — |
| Q5 | Source functional spec not in `docs/` (analysis §11 Q5) | Check it in before S3 (snapshot test source of truth) | TBD |
| Q6 | How operators create recovery campaigns (analysis §11 Q6) | `campaign_category` selector on `campaigns/new` in S4 | TBD |

### 6.5 Pre-kickoff checklist

1. Confirm the actual migration workflow for a recent `mkt_*` table addition
   (custom scripts vs `prisma migrate`) and template the S1 migration +
   rollback script accordingly (S1 task 1).
2. Verify DB-level RLS state on one existing `mkt_*` table (feeds Q1).
3. Identify and name the attachment storage backend behind "existing platform
   upload infrastructure" (S2 task 3 depends on it).
4. Check the source functional spec into `docs/` (feeds Q5).
5. Assign owners for Q1–Q3, Q5, Q6 above.

---

## 7. Definition of Done

- All four sprint test gates green.
- `pnpm checkapi` and `pnpm checkweb` clean (typecheck).
- `logger.error` (Sentry transport) on every new handler; one error event
  seeded to confirm.
- `unifiedConfig` holds every tunable; no `process.env` reads in new code.
- Approved resolution is delivered to the owner and recorded in
  `mkt_outreach_log`; no campaign can be stranded in `awaiting_owner_intake`.
- `RECOVERY_MANAGEMENT_RUNBOOK.md` published.
- BFRI re-scored post-implementation; target ≥ 3 (moderate) after isolation +
  tests land.
