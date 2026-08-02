# Recovery Production Readiness — Sprint Plan

**Status:** Draft
**Priority:** P0 — blocks go-live for BBB dispute handling
**Theme:** "When we go live, we are live"

---

## Executive Summary

Three known gaps were identified during the recovery management review. Codebase exploration revealed **five additional issues** that must be resolved before the recovery engine is production-ready for high-stakes BBB disputes with strict response deadlines.

### Issues Found

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 1 | **RecoveryCascadeService channel bug** — all 3 steps use `channel: 'email'` despite comments describing SMS/DM | 🔴 Critical | Code inspection |
| 2 | **No channel availability checks** in RecoveryCascadeService (ReviewCascadeService has them) | 🔴 Critical | Code inspection |
| 3 | **Intake form doesn't capture owner email** — no delivery destination for the resolution | 🔴 Critical | Schema inspection |
| 4 | **No delivery status tracking** — `mkt_outreach_log` and `mkt_deliverables_list` have no `delivery_status` / `delivery_attempts` fields | 🟡 High | Schema inspection |
| 5 | **No retry mechanism** — failed email delivery is silently logged, never retried | 🟡 High | Code inspection |
| 6 | **No UI surface for delivery failures** — operator can't see if email failed, can't resend | 🟡 High | UI inspection |
| 7 | **No fallback channel** — skipped cascade steps leave gaps with no alternate channel | 🟢 Medium | Code inspection |
| 8 | **ContactReadiness not integrated** — helper exists on campaigns but isn't checked before recovery outreach/delivery | 🟢 Medium | Code inspection |

---

## Sprint Structure

### Sprint 1: Critical Fixes (must ship before go-live)

**Goal:** Fix the broken cascade, capture owner email, and ensure the resolution has a delivery destination.

#### Task 1.1 — Fix RecoveryCascadeService channel assignments + add channel validation

**Files:**
- `apps/api/src/services/RecoveryCascadeService.ts`

**Changes:**
1. Fix `CASCADE_STEPS` — Day 2 should be `channel: 'phone'`, Day 4 should be `channel: 'social'`
2. Add `hasChannelInfo()` private method (mirror `ReviewCascadeService.hasChannelInfo`)
3. Add skip handling — when channel info is missing, log with `outcome: 'no_answer'` + `notes: 'SKIPPED — no contact info'`, return `{ fired: false, exhausted: false }`
4. Add tests for channel availability + skip behavior

**Acceptance criteria:**
- Day 1 fires email only if `campaign.email` is present
- Day 2 fires SMS only if `campaign.phone` is present (skips otherwise)
- Day 4 fires DM only if `campaign.social_profiles` has entries (skips otherwise)
- Skipped steps are logged and not re-evaluated on subsequent passes
- `pnpm checkapi` passes

#### Task 1.2 — Add owner email + phone to dispute intake form

**Files:**
- `database/migrations/152_dispute_intake_contact_fields.sql` (new)
- `apps/api/prisma/schema.prisma` (add fields to `mkt_dispute_intake`)
- `apps/api/src/validators/recovery-intake.schema.ts` (add `ownerEmail`, `ownerPhone` to `intakeSubmitSchema`)
- `apps/api/src/services/DisputeIntakeService.ts` (persist new fields)
- `apps/api/src/routes/recovery-intake-public.ts` (accept new fields in POST)
- `apps/web/src/app/recovery/intake/IntakePageClient.tsx` (add email + phone inputs to the form)
- `apps/web/src/services/RecoveryOpsService.ts` (expose new fields in `DisputeIntake` type)

**Changes:**
1. Add `owner_email` (VARCHAR 255, nullable) and `owner_phone` (VARCHAR 40, nullable) to `mkt_dispute_intake`
2. Add `ownerEmail` (optional, email format) and `ownerPhone` (optional) to the intake submit schema
3. Persist both fields on intake submission
4. Add email + phone inputs to the public intake form (email required, phone optional)
5. Update the `DisputeIntake` TypeScript interface to include the new fields

**Acceptance criteria:**
- Owner can enter their email (required) and phone (optional) on the intake form
- Email is validated for format
- Both fields persist to `mkt_dispute_intake`
- `pnpm checkapi` + `pnpm checkweb` pass

#### Task 1.3 — Use owner email from intake for resolution delivery

**Files:**
- `apps/api/src/services/RecoveryResolutionService.ts`

**Changes:**
1. In `deliverToOwner()`, prefer `intake.owner_email` over `campaign.email` for the delivery destination
2. If neither exists, log a warning and set a `delivery_failed` flag (see Sprint 2 for full tracking)
3. Add a fallback: if `owner_email` is missing but `owner_phone` is present, log that SMS delivery is needed (manual for now)

**Acceptance criteria:**
- Resolution email is sent to `intake.owner_email` if present
- Falls back to `campaign.email` if intake email is missing
- If neither exists, delivery is logged as failed (not silently swallowed)
- `pnpm checkapi` passes

---

### Sprint 2: Delivery Tracking + Retry (must ship before go-live)

**Goal:** Make delivery failures visible, retryable, and resolvable from the UI.

#### Task 2.1 — Add delivery status fields to outreach log + deliverables

**Files:**
- `database/migrations/153_outreach_delivery_tracking.sql` (new)
- `apps/api/prisma/schema.prisma` (add fields)
- `apps/api/src/services/MarketingOutreachService.ts` (accept + persist new fields in `logContact`)

**Changes:**
1. Add to `mkt_outreach_log`:
   - `delivery_status` VARCHAR(20) — `pending` | `sent` | `failed` | `retrying` (default: `sent`)
   - `delivery_attempts` INT — default 0
   - `last_delivery_error` TEXT — nullable
   - `retry_after` TIMESTAMPTZ — nullable
2. Add to `mkt_deliverables_list`:
   - `delivery_status` VARCHAR(20) — `pending` | `sent` | `failed` (default: null)
   - `delivered_at` TIMESTAMPTZ — nullable
3. Update `LogContactInput` to accept optional `deliveryStatus`, `deliveryAttempts`, `lastDeliveryError`, `retryAfter`
4. Update `logContact()` to persist these fields

**Acceptance criteria:**
- Migration applies cleanly
- `logContact()` accepts and persists delivery status fields
- Existing log calls without delivery status default to `sent` (backward compatible)
- `pnpm checkapi` passes

#### Task 2.2 — Add delivery retry scheduler job

**Files:**
- `apps/api/src/jobs/recovery-delivery-retry.ts` (new)
- `apps/api/src/config/unifiedConfig.ts` (add job interval config)
- `apps/api/src/index.ts` (register the job)

**Changes:**
1. New scheduler job that runs every 15 minutes
2. Queries `mkt_outreach_log` for records where `delivery_status = 'failed'` AND `delivery_attempts < 3` AND (`retry_after` is null OR `retry_after <= now()`)
3. Re-attempts email delivery for each
4. On success: update `delivery_status = 'sent'`, clear `retry_after`
5. On failure: increment `delivery_attempts`, set `retry_after = now() + (attempts * 15 minutes)` (exponential backoff: 15min, 30min, 45min)
6. After 3 failed attempts: set `delivery_status = 'failed'` (permanent), leave for manual intervention

**Acceptance criteria:**
- Job runs every 15 minutes
- Failed deliveries are retried up to 3 times with exponential backoff
- Permanent failures are flagged for manual intervention
- Job logs each retry attempt
- `pnpm checkapi` passes

#### Task 2.3 — Surface delivery status on recovery detail UI

**Files:**
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx`
- `apps/web/src/services/RecoveryOpsService.ts` (fetch delivery status)
- `apps/api/src/routes/marketing-ops.ts` (endpoint to fetch delivery status + resend)

**Changes:**
1. Add a "Delivery Status" panel to the recovery detail page (below the Actions section)
2. Shows: delivery status badge (Sent / Failed / Retrying), attempts count, last error, delivered timestamp
3. If delivery failed permanently (3 attempts), show a red banner with a **Resend Email** button
4. Add `POST /recovery/:campaignId/resend-delivery` endpoint that re-attempts delivery and resets `delivery_attempts`
5. Add `resendDelivery()` to `RecoveryOpsService`

**Acceptance criteria:**
- Operator sees delivery status on the recovery detail page
- Failed deliveries show a red banner with error details
- **Resend Email** button triggers a new delivery attempt
- Resent deliveries reset the retry counter
- `pnpm checkapi` + `pnpm checkweb` pass

---

### Sprint 3: Channel Readiness + Fallback (ship after go-live, within 2 weeks)

**Goal:** Prevent skipped cascade steps from breaking momentum; give operators visibility into channel readiness before outreach.

#### Task 3.1 — Add channel readiness scoring to campaign detail

**Files:**
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx`
- `apps/api/src/routes/marketing-ops.ts` (expose `getContactReadiness` if not already)

**Changes:**
1. Add a "Channel Readiness" widget to both campaign detail pages
2. Shows 4 channel badges: Email, Phone, Social, Website — green if present, gray if missing
3. Shows a "Cascade Ready" indicator: green if email + (phone OR social) present, amber if only email, red if no email
4. For recovery: also shows whether intake email was captured

**Acceptance criteria:**
- Operators see channel readiness at a glance
- Missing channels are visually obvious before cascade is enabled
- `pnpm checkapi` + `pnpm checkweb` pass

#### Task 3.2 — Add fallback channel for skipped cascade steps

**Files:**
- `apps/api/src/services/ReviewCascadeService.ts`
- `apps/api/src/services/RecoveryCascadeService.ts`

**Changes:**
1. When a cascade step is skipped (missing channel info), attempt a fallback:
   - Day 2 SMS skipped (no phone) → fire a second short email with SMS-style brevity
   - Day 4 DM skipped (no social) → fire a third email with administrative check-in content
2. Log the fallback with `notes: 'FALLBACK — [original channel] unavailable, used email'`
3. If email is also missing, skip entirely (no channels available)

**Acceptance criteria:**
- Skipped SMS/DM steps fall back to email when email is available
- Fallback is logged distinctly from normal fires
- If no channels are available, the step is skipped (no infinite loops)
- `pnpm checkapi` passes

#### Task 3.3 — Integrate ContactReadiness check into recovery outreach flow

**Files:**
- `apps/api/src/services/RecoveryCascadeService.ts`
- `apps/api/src/services/RecoveryResolutionService.ts`

**Changes:**
1. Before enabling the recovery cascade, check `MarketingCampaignService.getContactReadiness()`
2. If `!complete` (no email AND no phone), block cascade enablement with a clear error: "Cannot enable cascade — campaign has no email or phone. Add contact info first."
3. Before `deliverToOwner()`, check that a delivery destination exists (intake email OR campaign email)
4. If no destination, set `delivery_status = 'failed'` with error "No delivery destination available"

**Acceptance criteria:**
- Cascade cannot be enabled without at least one contact channel
- Delivery fails gracefully (with status tracking) when no destination exists
- `pnpm checkapi` passes

---

### Sprint 4: E2E Tests + Runbook Update (ship after Sprint 1-2, before full go-live)

**Goal:** Prove the full recovery cycle works end-to-end; update the runbook with the new delivery tracking + retry flow.

#### Task 4.1 — Recovery E2E test (Playwright)

**Files:**
- `apps/web/tests/e2e/recovery-ops.spec.ts` (new)

**Test flow:**
1. Create a recovery campaign
2. Verify it appears on the recovery list page
3. Open recovery detail → verify campaign cycle banner
4. Simulate intake submission (POST to public intake endpoint with test token)
5. Verify stage transitions to `intake_submitted`
6. Verify AI workspace panel renders
7. Approve draft → verify stage transitions to `resolved_and_closed`
8. Verify delivery status panel shows "Sent"
9. (Optional) Simulate delivery failure → verify retry + resend flow

**Acceptance criteria:**
- E2E test passes in CI
- Test covers the full cycle from creation to delivery

#### Task 4.2 — Update recovery runbook

**Files:**
- `docs/RECOVERY_MANAGEMENT_RUNBOOK.md`

**Changes:**
1. Document the delivery tracking + retry flow
2. Add troubleshooting for delivery failures
3. Document the resend delivery endpoint
4. Document the channel readiness check
5. Add operator runbook for handling permanently failed deliveries

---

## Migration Summary

| Migration | Sprint | Tables | Fields |
|-----------|--------|--------|--------|
| `152_dispute_intake_contact_fields.sql` | 1 | `mkt_dispute_intake` | `owner_email`, `owner_phone` |
| `153_outreach_delivery_tracking.sql` | 2 | `mkt_outreach_log`, `mkt_deliverables_list` | `delivery_status`, `delivery_attempts`, `last_delivery_error`, `retry_after`, `delivered_at` |

---

## Sprint Timeline

| Sprint | Duration | Dependency | Go-live blocker? |
|--------|----------|------------|-------------------|
| **Sprint 1** — Critical Fixes | 2-3 days | None | ✅ Yes |
| **Sprint 2** — Delivery Tracking + Retry | 2-3 days | Sprint 1 | ✅ Yes |
| **Sprint 3** — Channel Readiness + Fallback | 3-4 days | Sprint 1 | ❌ No (ship after go-live) |
| **Sprint 4** — E2E Tests + Runbook | 2 days | Sprint 1-2 | ❌ No (ship alongside go-live) |

**Total P0 effort:** 4-6 days (Sprint 1 + Sprint 2)
**Total full effort:** 9-12 days (all 4 sprints)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| BBB dispute deadline missed due to silent email failure | Medium | High | Sprint 2 delivery tracking + retry + UI surface |
| Cascade sends all 3 steps via email (current bug) | High | Medium | Sprint 1 Task 1.1 fix |
| Owner can't receive resolution (no email captured) | High | High | Sprint 1 Task 1.2 + 1.3 |
| Operator doesn't know delivery failed | High | High | Sprint 2 Task 2.3 UI surface |
| Skipped cascade steps reduce response rate | Medium | Medium | Sprint 3 fallback channels |

---

## References

- `apps/api/src/services/RecoveryResolutionService.ts` — `approveDraft()`, `deliverToOwner()`
- `apps/api/src/services/RecoveryCascadeService.ts` — `CASCADE_STEPS` (bug), no channel validation
- `apps/api/src/services/ReviewCascadeService.ts` — `hasChannelInfo()` (reference implementation)
- `apps/api/src/services/MarketingOutreachService.ts` — `logContact()`, no delivery tracking
- `apps/api/src/services/MarketingCampaignService.ts` — `getContactReadiness()` (exists, not integrated)
- `apps/api/src/validators/recovery-intake.schema.ts` — `intakeSubmitSchema` (missing email/phone)
- `apps/api/prisma/schema.prisma` — `mkt_dispute_intake`, `mkt_outreach_log`, `mkt_deliverables_list`
- `apps/web/src/app/recovery/intake/IntakePageClient.tsx` — public intake form
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx` — recovery detail UI
