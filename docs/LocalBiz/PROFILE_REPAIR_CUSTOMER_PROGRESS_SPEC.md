# Profile Repair — Customer Progress Surface

Status: implemented
Scope: customer portal (`/account/marketing`), Track A `profile_repair` campaigns only.
Parent spec: `PROFILE_REPAIR_FULFILLMENT_SPRINT.md` (W6 delivery, W7 execution tracking).

## Problem

After purchase, the customer sees only the generic 3-step timeline
(Payment received → In production → Delivered). For a profile-repair
package this hides everything that matters:

- Which platforms are being fixed and their per-platform state.
- Whether the customer has an outstanding action (DIY fixes, DFY access form).
- The SLA the operator committed to.

The operator-side state already exists in `repair_fulfillment` (W2/W7);
the customer portal just never projected it.

## Design

### 1. Projection — `MarketingCustomerProjection.projectCampaign`

New optional `repair` field on `CustomerCampaignProjection`, present only
when `repair_fulfillment.tier` is set (package configured). Customer-safe
slice — internal fields (`escalated_campaign_id`, adapter internals,
canonical_nap contact data) are not projected.

```ts
repair: {
  tier: 'standard' | 'plus' | 'premium';
  tierLabel: string;                    // "Standard"
  mode: 'diy' | 'dfy';
  modeLabel: string;                    // "You apply the fixes" / "We apply the fixes"
  slaHours: number | null;
  slaDueAt: Date | null;
  platforms: Array<{
    platform: string;                   // 'google' | 'facebook' | ...
    label: string;                      // 'Google Business Profile'
    status: string;                     // raw RepairPlatformStatus
    statusLabel: string;                // customer-legible (table below)
    needsCustomerAction: boolean;
    verifiedAt: Date | null;
    note: string | null;                // operator note (already customer-facing via completion report)
  }>;
  accessForm: {                         // DFY only, null otherwise
    state: 'sent' | 'opened' | 'submitted' | 'expired';
    url: string | null;                 // /i/{short_code} — never access_token
  } | null;
}
```

Platform list derives from `repair_fulfillment.platforms`; entries missing
from `platform_status` default to `customer_pending` (DIY) / `in_progress`
(DFY) — same convention as `buildCompletionReport`.

### 2. Customer-legible status map

| Internal status      | Customer label                    | needsCustomerAction |
|----------------------|-----------------------------------|---------------------|
| `customer_pending`   | Action needed from you            | yes (DIY)           |
| `customer_reported`  | Submitted — under review          | no                  |
| `awaiting_access`    | Waiting for account access        | yes (DFY)           |
| `access_granted`     | Access received                   | no                  |
| `in_progress`        | In progress                       | no                  |
| `verified`           | Verified                          | no                  |
| `done`               | Completed                         | no                  |
| `blocked`            | Needs attention                   | no                  |
| `not_applicable`     | Not applicable                    | no                  |
| `escalated`          | Escalated for specialist review   | no                  |

### 3. Access-form state (DFY)

Sourced from the `mkt_dispute_intake` row with
`intake_kind = 'profile_repair_access'` (filtered relation include on the
existing campaign queries — `access_token` is never selected/exposed).

- `submitted_at` set → `submitted`
- `expires_at` < now → `expired`
- `viewed_at`/`viewed_count` > 0 → `opened`
- otherwise → `sent`

`url` is the tracked short link `/i/{short_code}` — safe to show the
authenticated customer their own link; hidden once `submitted`.

### 4. UI — campaign detail page

`Repair progress` card between the Progress timeline and Deliverables:

- Header: `{tierLabel} package` + mode chip + SLA line ("48-hour turnaround").
- DFY with unsubmitted access form → amber banner "We need access to your
  profiles" + button to the intake URL. Submitted → green "Access details
  received".
- DIY → muted hint "Apply the fixes in your repair package, then mark each
  platform done" (reporting itself is out of scope here — PDF instructions).
- Platform rows: label + status chip. Amber chip + left border when
  `needsCustomerAction`; green for verified/done; purple for escalated;
  operator note rendered under the row.

### 5. Non-goals

- No customer-side status writes (no "mark done" button) — DIY customers
  report via the package instructions/support ticket; `customer_reported`
  is set operator-side.
- No campaign-scoped chat — support tickets remain the channel.
- No checklist surfacing — PB-01 steps are operator-internal.

## Files

- `apps/api/src/services/MarketingCustomerProjection.ts` — projection + status map
- `apps/api/src/routes/marketing-customer.ts` — filtered `mkt_dispute_intake` include
- `apps/web/src/services/MarketingCustomerService.ts` — mirror types
- `apps/web/src/app/account/marketing/campaigns/[id]/page.tsx` — card
