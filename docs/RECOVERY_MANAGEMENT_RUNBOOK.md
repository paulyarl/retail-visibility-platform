# Recovery Management Runbook

**Version:** Sprint 4 — Recovery Management Engine
**Last updated:** 2025-08-01

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

| Day | Channel | Content |
|-----|---------|---------|
| 1   | email   | Frame preview + grade impact + CTA = intake link |
| 2   | email   | SMS pointer to email (if unopened 24–48h) |
| 4   | email   | Administrative check-in (if unopened 48h+) |

After Day 4 with no response, the cascade is exhausted. The intake
timeout sweep transitions the campaign to `dead` 4 days after the
intake token expires (token TTL + 4-day buffer).

## How the Operator Approves a Draft

1. Navigate to **Admin → Marketing Ops → Recovery tab**.
2. The list shows recovery campaigns grouped by stage.
3. Click a campaign in `final_resolution_drafted` to open the detail view.
4. Review the **Response Draft** and **Submission Guide** sections.
5. Edit either section inline if needed (PATCH
   `/api/admin/marketing-ops/recovery/:campaignId/draft`).
6. Click **Approve** to transition to `resolved_and_closed`.
   - This is a single operator action that performs a two-step
     transition: `final_resolution_drafted → owner_approved → resolved_and_closed`.
   - The approved resolution is automatically emailed to the owner
     (recorded in `mkt_outreach_log` with `message_snapshot`).

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

## Scheduler Job

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

## Troubleshooting

### Campaign stuck in `awaiting_owner_intake`
- Check if the intake token has expired (TTL = 7 days).
- Check if the cascade has fired all 3 steps (Day 1/2/4).
- After token expiry + 4 days, the timeout sweep transitions to `dead`.
- Operator can manually transition to `dead` or re-dispatch outreach.

### AI agent output failed validation
- Check `mkt_filter_flags_list` for the failed execution.
- Review the `failed_checks` field for schema mismatch details.
- Operator can edit the intake statement and click **Regenerate**.

### Owner didn't receive the resolution email
- Check `mkt_outreach_log` for the campaign — there should be a row
  with `notes = 'Approved recovery resolution delivered to owner'`.
- The email delivery is best-effort; if it failed, the approval still
  succeeded. Operator can manually resend.
