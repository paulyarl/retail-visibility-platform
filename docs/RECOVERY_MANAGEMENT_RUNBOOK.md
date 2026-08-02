# Recovery Management Runbook

**Version:** Sprint 4 — Recovery Production Readiness
**Last updated:** 2025-08-02

## Overview

The Recovery Management Engine handles dispute resolution for local
businesses that have received complaints on review platforms (Google
Business Profile, BBB, Yelp, etc.). The engine drafts a professional
response on behalf of the business owner, provides a submission guide,
and delivers the approved resolution via email.

## Stage Machine

```
audit_identified
    ↓
framework_preview_generated
    ↓
outreach_dispatched          ← intake link generated + cascade begins
    ↓
awaiting_owner_intake        ← Day 1/2/4 outreach cascade fires
    ↓
intake_submitted             ← owner submits complaint details + attachments
    ↓
final_resolution_drafted     ← Recovery AI Agent drafts response + guide
    ↓
owner_approved               ← operator approves the draft
    ↓
resolved_and_closed          ← resolution delivered to owner via email
```

Any stage can transition to `dead` (intake timeout, cascade exhaustion,
or manual operator action).

## How to Create a Recovery Campaign

1. Navigate to **Admin → Marketing Ops → Campaigns → New**.
2. Select `campaign_category = recovery_management`.
3. Fill in business name, category, city, and contact info.
4. The campaign starts at `audit_identified`.
5. Run an audit to identify the complaint, then transition through
   `framework_preview_generated` → `outreach_dispatched`.

## How the Intake Link Is Delivered

When a recovery campaign transitions to `outreach_dispatched`:

1. `MarketingCampaignService.transitionStage()` fires a hook that calls
   `DisputeIntakeService.generateIntakeLink()`.
2. A `mkt_dispute_intake` row is created with a 64-char hex access
   token (TTL: 7 days by default, configurable via
   `unifiedConfig.recoveryIntakeTokenTtlDays`).
3. The intake link is `${webBaseUrl}/recovery/intake?token=${accessToken}`.
4. The outreach cascade (Day 1 email) includes this link as the CTA.

## Outreach Cascade Timeline

The `RecoveryCascadeService` runs as part of the
`recovery-resolution` scheduler job (every 5 minutes). For campaigns
stuck in `awaiting_owner_intake`:

| Day | Channel | Content | Fallback |
|-----|---------|---------|----------|
| 1   | email   | Frame preview + grade impact + CTA = intake link | None (email is primary) |
| 2   | phone (SMS) | Short SMS pointer to email | Falls back to email if no phone |
| 4   | social (DM) | Administrative check-in | Falls back to email if no social |

### Channel Availability + Fallback

Before firing each step, the cascade checks if the campaign has contact
info for the step's primary channel:

1. **Primary channel available** → fire on primary channel
2. **Primary unavailable, email available** → fire on email (logged as `FALLBACK`)
3. **Primary unavailable AND no email** → skip step (logged as `SKIPPED — no contact info`)

### ContactReadiness Gate

Before processing any campaign, the cascade checks if the campaign has
ANY contact channel (email, phone, or social). If none exist, it logs a
single `BLOCKED — no contact channels available` warning and skips the
campaign entirely. The operator must add contact info to the campaign
before the cascade can fire.

### Channel Readiness Widget

The campaign detail page and recovery detail page both show a
**Channel Readiness** widget with:
- 4 channel badges (Email, Phone, Social, Website) — green if present, gray if missing
- Cascade readiness indicator:
  - **Green "Cascade Ready"** — email + at least one secondary channel (phone or social)
  - **Amber "Partial"** — email only (SMS/DM steps will fall back to email)
  - **Red "Blocked"** — no email (cascade cannot fire)
- For recovery campaigns: intake email status (captured vs. not yet submitted)

After Day 4 with no response, the cascade is exhausted. The intake
timeout sweep transitions the campaign to `dead` 4 days after the
intake token expires (token TTL + 4-day buffer).

## How the Operator Approves a Draft

1. Navigate to **Admin → Marketing Ops → Recovery** (sidebar link or dashboard tab).
2. The list shows recovery campaigns grouped by stage.
3. Click a campaign in `final_resolution_drafted` to open the detail view.
4. Review the **Response Draft** and **Submission Guide** sections.
5. Edit either section inline if needed (PATCH
   `/api/admin/marketing-ops/recovery/:campaignId/draft`).
6. Click **Approve & Deliver** to transition to `resolved_and_closed`.
   - This is a single operator action that performs a two-step
     transition: `final_resolution_drafted → owner_approved → resolved_and_closed`.
   - The approved resolution is emailed to the owner using the
     delivery destination priority:
     1. `intake.owner_email` (owner's email captured at intake — preferred)
     2. `campaign.email` (business email from audit — fallback)
     3. If neither exists → delivery is logged as `failed` with
        `last_delivery_error = 'No email destination available'`
   - The delivery is recorded in `mkt_outreach_log` with
     `delivery_status`, `delivery_attempts`, and `message_snapshot`.
   - The deliverable is marked with `delivery_status = 'sent'` and
     `delivered_at` timestamp on success.

## Delivery Tracking + Retry

### Delivery Status Panel

After approval, the recovery detail page shows a **Delivery Status**
panel below the approval section:

| Status | Badge | Behavior |
|--------|-------|----------|
| `sent` | Green "Delivered" | Shows delivered timestamp |
| `retrying` | Amber "Retrying" | Shows attempts count + next retry time + error |
| `failed` (permanent) | Red "Delivery Failed (Permanent)" | Shows error + **Resend Email** button |

### Retry Scheduler

The `recovery-delivery-retry` job (`apps/api/src/jobs/recovery-delivery-retry.ts`)
runs every 15 minutes and retries failed deliveries:

- **Max attempts:** 3
- **Backoff:** 15min → 30min → 45min (exponential)
- After 3 failed attempts → permanently `failed` (manual intervention)
- Disableable via `DISABLE_RECOVERY_DELIVERY_RETRY` env var

### Manual Resend

The operator can click **Resend Email** on the recovery detail page to
manually re-attempt delivery. This resets the retry counter and forces
a new delivery attempt immediately.

API: `POST /api/admin/marketing-ops/recovery/:campaignId/resend-delivery`

## How to Regenerate a Draft

If the operator wants the AI to re-draft (e.g., after the owner
updates their intake statement):

1. Open the campaign detail view.
2. Click **Regenerate**.
3. The existing deliverable is archived (`status = 'archived'`).
4. A new prompt execution is enqueued.
5. The scheduler job picks it up within 5 minutes and produces a new
   draft.
6. The campaign stays at `final_resolution_drafted` (or returns to
   `intake_submitted` briefly until the new draft is ready).

## Recovery AI Agent

- **Prompt template:** `mpt-recovery-resolution-default` (seeded by
  migration 150).
- **Output schema:** `recovery_resolution` (registered in
  `OUTPUT_SCHEMA_REGISTRY`).
- **Output fields:** `deliverableText` (80–300 words) +
  `submissionGuide` (50–200 words).
- **AI provider:** Uses `unifiedConfig.recoveryAiProvider` /
  `recoveryAiModel` if set, otherwise falls back to the platform
  default.
- **Validation:** Output is validated against the Zod schema. Invalid
  JSON or schema mismatch → filter flags created, execution marked
  `failed`, operator can regenerate.

## Scheduler Jobs

### Recovery Resolution Job

The `recovery-resolution` job (`apps/api/src/jobs/recovery-resolution.ts`)
runs every 5 minutes and performs three passes:

1. **Resolution pass** — polls for pending `recovery_resolution`
   prompt executions, invokes the AI agent, validates output, creates
   deliverables.
2. **Intake timeout sweep** — transitions campaigns stuck in
   `awaiting_owner_intake` past token TTL + 4-day buffer to `dead`.
3. **Recovery cascade** — fires Day 1/2/4 outreach steps for
   campaigns in `awaiting_owner_intake`.

Additionally, an **orphan attachment purge** runs hourly, deleting
attachment metadata from intakes that are unsubmitted AND expired >7
days.

### Recovery Delivery Retry Job

The `recovery-delivery-retry` job
(`apps/api/src/jobs/recovery-delivery-retry.ts`) runs every 15 minutes
and retries failed delivery entries in `mkt_outreach_log`:

- Queries for `delivery_status IN ('failed', 'retrying')` where
  `delivery_attempts < 3` and `retry_after` has elapsed.
- Calls `RecoveryResolutionService.retryDelivery()` for each.
- Exponential backoff: 15min → 30min → 45min.
- After 3 failed attempts → permanently `failed`.

Disableable via `DISABLE_RECOVERY_DELIVERY_RETRY` env var.

## Admin API Endpoints

All endpoints are admin-authed (mounted at `/api/admin/marketing-ops`):

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/recovery/campaigns` | List recovery campaigns grouped by stage |
| GET    | `/recovery/:campaignId/intake` | Get intake + attachments |
| GET    | `/recovery/:campaignId/draft` | Get current draft + sections |
| PATCH  | `/recovery/:campaignId/draft` | Edit draft sections |
| POST   | `/recovery/:campaignId/approve` | Approve draft → resolved_and_closed |
| POST   | `/recovery/:campaignId/regenerate` | Re-run the AI agent |
| GET    | `/recovery/:campaignId/prompt-text` | Get rendered prompt text (dual-mode) |
| POST   | `/recovery/:campaignId/import-result` | Import external AI result (dual-mode) |
| POST   | `/recovery/:campaignId/execute` | Execute prompt via API directly (dual-mode) |
| GET    | `/recovery/:campaignId/delivery-status` | Get delivery status (outreach log + deliverable) |
| POST   | `/recovery/:campaignId/resend-delivery` | Manually resend failed delivery |

## Public Intake Endpoints

All endpoints are public (no auth, token-based):

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/recovery/intake` | Resolve intake by token |
| POST   | `/api/recovery/intake` | Submit intake (owner statement + resolution) |
| POST   | `/api/recovery/reissue` | Reissue expired intake link |
| POST   | `/api/recovery/attachments` | Upload attachment |
| GET    | `/api/recovery/attachments/:id` | Download attachment |

## Configuration

| Config key | Default | Description |
|------------|---------|-------------|
| `recoveryIntakeTokenTtlDays` | 7 | Intake link token TTL |
| `recoveryMaxAttachmentBytes` | 10MB | Max attachment file size |
| `recoveryAllowedAttachmentMimes` | `[image/png, image/jpeg, application/pdf, text/plain]` | Allowed MIME types |
| `recoveryAiProvider` | undefined | AI provider for recovery agent (falls back to platform default) |
| `recoveryAiModel` | undefined | AI model for recovery agent (falls back to platform default) |

### Environment Variables

| Env var | Default | Description |
|---------|---------|-------------|
| `DISABLE_RECOVERY_RESOLUTION` | unset | Disables the recovery resolution scheduler job |
| `DISABLE_RECOVERY_DELIVERY_RETRY` | unset | Disables the delivery retry scheduler job |

### Database Migrations

| # | File | Description |
|---|------|-------------|
| 150 | `150_recovery_management_seed.sql` | Seeds recovery prompt template + output schema |
| 151 | `151_dispute_intake_table.sql` | Creates `mkt_dispute_intake` + `mkt_dispute_attachments` |
| 152 | `152_dispute_intake_contact_fields.sql` | Adds `owner_email` + `owner_phone` to `mkt_dispute_intake` |
| 153 | `153_outreach_delivery_tracking.sql` | Adds delivery tracking fields to `mkt_outreach_log` + `mkt_deliverables_list` |

## Troubleshooting

### Campaign stuck in `awaiting_owner_intake`
- Check the **Channel Readiness** widget on the campaign detail page.
  If it shows "Blocked" (no email), the cascade cannot fire.
- Check if the intake token has expired (TTL = 7 days).
- Check `mkt_outreach_log` for cascade entries:
  - `BLOCKED — no contact channels available` → add email/phone/social to the campaign
  - `SKIPPED — no contact info` → individual step skipped, cascade continues
  - `FALLBACK — phone unavailable, used email` → step fell back to email
- Check if the cascade has fired all 3 steps (Day 1/2/4).
- After token expiry + 4 days, the timeout sweep transitions to `dead`.
- Operator can manually transition to `dead` or re-dispatch outreach.

### AI agent output failed validation
- Check `mkt_filter_flags_list` for the failed execution.
- Review the `failed_checks` field for schema mismatch details.
- Operator can edit the intake statement and click **Regenerate**.

### Owner didn't receive the resolution email
- Open the recovery detail page and check the **Delivery Status** panel.
- If status is `failed` or `retrying`:
  - Check `last_delivery_error` for the failure reason.
  - Check `delivery_attempts` — if < 3, the retry scheduler will retry automatically.
  - If `delivery_attempts >= 3` (permanent failure), click **Resend Email** to manually retry.
- If status is `failed` with `No email destination available`:
  - The intake form was submitted without an owner email AND the campaign has no business email.
  - Add an email to the campaign, then click **Resend Email**.
- The email delivery is best-effort; if it failed, the approval still
  succeeded. The campaign is at `resolved_and_closed` regardless of
  delivery outcome.

### Cascade step shows "FALLBACK" in notes
- This is expected behavior when the primary channel (phone/social) is
  unavailable but email is. The step was delivered via email instead.
- To enable the primary channel, add phone or social profile info to
  the campaign via the Business Contact card.

### Cascade step shows "SKIPPED" in notes
- The primary channel was unavailable AND email was also unavailable.
- The step was not delivered. Add contact info to the campaign.
- The cascade will not re-attempt this step (it's logged as completed
  with `no_answer` outcome).
