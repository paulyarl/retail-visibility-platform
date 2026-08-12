# Marketing Ops — Cold Call Channel Sprint Plan (Verify → Hook → Bridge → Ask → Close)

**Status:** 📋 Spec — not yet implemented
**Date:** 2026-08-11
**Prerequisite sprints:** Outreach Intelligence Prep (Sprint 1 — shipped, migration 188), Light-Score Hook Library (Outreach Intelligence Prep plan Sprint 2 — spec'd, see §4.0 merge-order note), Outreach ↔ Checklist Bridge, Multi-Archetype Campaigns (siblings), Gallery Short URLs (migration 183)

Two related sprints:

- **Sprint 1 (§1–§10):** Cold Call Script Workspace + Structured Call
  Outcomes — phone-variant hook catalog, a Call Script tab in the openers
  workspace, `call_details` on the outreach log, and one-click write-back of
  call-confirmed fields into the Outreach Intelligence worksheet.
- **Sprint 2 (§11+):** Phone Analytics + Emerging-Discovery Alignment —
  channel-aware split-test stats, emerging-archetype → angle mapping, the
  zero-footprint signal, and the wrong-number data-quality loop.

Source script: operator-authored "Cold Call Script | Verify → Confirm → Ask
Flow" (five fixed stages; only Stage 2 — the Hook — varies per angle).

---

# Sprint 1 — Cold Call Script Workspace + Structured Call Outcomes

---

## 1. Problem

Phone is a **supported but content-less** outreach channel:

1. **All outreach content assumes a written channel.** The opener workspace
   (`OpenerWorkspaceClient.tsx`) has two tabs — `opener` (generate/import)
   and `pitch` (assembly) — both producing email/DM text. The quality gate
   (`outreach-openers/quality-gate.ts`) enforces written-channel artifacts
   ("three previews attached", "— [your name]" signoff). Nothing renders a
   spoken script.
2. **The phone-first population is the fastest-growing one.** V3
   Emerging-Discovery audits classify prospects by `growth_readiness`
   (`foundation_needed`, `insufficient_evidence`) and `emerging_archetype`
   (`INVISIBLE_ANCHOR`, `DIRECTORY_GHOST`, …) — exactly the businesses where
   email/social discovery failed or never existed. For these, the phone
   number is often the *only* contact surface (`MarketingHotProspectService`
   already syncs `phone` null-only onto campaigns).
3. **Call outcomes have no structured home.** `mkt_outreach_log` accepts
   `contact_channel: 'phone'`, but everything call-specific — connected vs
   voicemail vs wrong number, identity verified, operating status confirmed,
   angle used, objections raised, email obtained — flattens into the
   free-text `notes` column. `wrong_number` and `disconnected_number` don't
   exist in the outcome enum at all.
4. **Live confirmations are wasted.** A connected call is the
   highest-quality source available in this system
   (`source_confidence: 'confirmed'` — the business itself told you). Today
   there is no write-back path from a call into the Outreach Intelligence
   worksheet; the operator would have to re-open the Outreach Prep tab and
   re-type what they just heard.
5. **Phone hooks aren't attributable.** The hook-angle attribution column
   (`mkt_outreach_openers_list.hook_angle`, migration 189) only exists for
   written openers. Phone calls can't tell us which angle converts.

---

## 2. Goal

1. A **Call Script tab** in the openers workspace rendering the five-stage
   script — Verify → Hook → Bridge → Ask → Close — with merge fields
   resolved server-side (business name, spoken address, category, city) and
   the ranked hook picker driving Stage 2.
2. **Phone variants of all 12 hook angles** plus one new angle
   (`zero_footprint` — "no usable footprint found at all", the script's
   `EF_ZERO_INDEXED_PRESENCE` row) in the server-owned hook catalog.
3. **Structured call outcome capture**: a `call_details` JSONB column on
   `mkt_outreach_log`, two new outcome values, and Zod-enforced coherence
   between `call_result` and `outcome`.
4. **One-click worksheet write-back**: when a connected call confirms owner
   name / email / team signal / preferred channel, the operator can persist
   those into the Outreach Intelligence worksheet with
   `source_confidence: 'confirmed'`, `source: "Phone call YYYY-MM-DD"` —
   respecting the primary-sibling write rules.

### Non-goals

- No telephony: no auto-dialer, click-to-call, recording, or transcription.
  The platform renders the script and logs the outcome; the call itself
  happens on the operator's phone.
- No DNC/consent registry integration. Call-compliance is an operator
  responsibility; the platform records but does not police.
- No changes to the email/DM generation path (`executeOpener`,
  `OutreachFollowUpService`, pitch assembly) — the phone catalog is additive.
- No new pipeline stage, no stage gates. Call logging remains a
  `preview_built`/`shown`-era activity via the existing outreach log.
- Phone hook copy **bypasses** the opener quality gate (spoken copy has no
  salutation/signoff/preview-attachment requirements).

---

## 3. Design principles

1. **Additive, not breaking.** One new nullable column, two new enum values,
   one new tab, one new route. Existing log rows have `call_details = null`.
2. **Server owns merge resolution.** Same rule as the hook library: the
   frontend previews, the backend resolves. Unresolvable placeholders render
   visibly — never fabricated.
3. **The call is a source, not a guess.** Write-back always lands as
   `source_confidence: 'confirmed'` with a dated source string. The
   worksheet's existing guardrail (confirmed requires a source) is satisfied
   by construction.
4. **Sibling rules are inherited, not reinvented.** The Call Script tab on a
   non-primary sibling reads the *inherited* worksheet (who to ask for) but
   ranks hooks by its *own* archetype — same split as the hook library.
   Write-back always targets the primary sibling's worksheet (the existing
   409 rule applies if attempted directly on a sibling).
5. **One hook per call.** The script's scaling rule ("lead with the single
   most visibly-true hook, hold the rest for the follow-up email") is a UI
   constraint: the picker selects exactly one Stage 2 hook per script
   rendering. Sibling campaigns carry the reserve angles — that's what
   they're for.

---

## 4. Schema changes

### 4.0 Merge-order note (hook catalog dependency)

The Light-Score Hook Library (Outreach Intelligence Prep plan, Sprint 2)
specs `apps/api/src/services/outreach-openers/hook-library.ts` with 12
templates and migration 189 (`hook_angle` on `mkt_outreach_openers_list`).
**If that sprint ships first**, this sprint extends the catalog in place
(§5.1). **If this sprint ships first**, the catalog module lands here with
the `phone_hook` field present from day one, and the email-side picker
(§13.5 of that plan) fast-follows without schema changes. Either way the
catalog ships **once**, code-defined, mirroring `GalleryArchetypeDefaults.ts`.

### 4.1 Migration `190_mkt_outreach_log_call_details.sql`

```sql
-- Migration 190: Structured call outcomes on the outreach log
--
-- Adds a nullable JSONB column for phone-channel call details. Only
-- populated when contact_channel = 'phone'; null for all other channels
-- and all legacy rows. Also registers the two new outcome values in the
-- route-layer enum (no DB CHECK constraint exists on outcome — Zod at the
-- route boundary is the enforcement point).

ALTER TABLE mkt_outreach_log
  ADD COLUMN call_details JSONB;

COMMENT ON COLUMN mkt_outreach_log.call_details IS
  'Phone-channel call outcome details (call_result, identity/operating confirmation, angle used, objections, email obtained). Null unless contact_channel = ''phone''.';

CREATE INDEX idx_mkt_outreach_log_call_angle
  ON mkt_outreach_log((call_details->>'angle_used'))
  WHERE call_details IS NOT NULL;
```

**Prisma:** after migrating, `pnpm prisma:generate` (Doppler: `doppler run
--config local -- pnpm prisma db pull` from `apps/api`).

### 4.2 `call_details` payload contract

```json
{
  "call_result": "connected",
  "identity_verified": true,
  "operating_status_confirmed": true,
  "angle_used": "gbp_verification",
  "hook_response_notes": null,
  "objections_raised": [],
  "email_obtained": false,
  "email_value": null,
  "callback_number_left": null,
  "owner_name_confirmed": null,
  "team_signal_confirmed": null,
  "preferred_channel_confirmed": null
}
```

| Field | Type | Notes |
|---|---|---|
| `call_result` | enum: `connected`, `voicemail`, `no_answer`, `wrong_number`, `disconnected_number` | Required when `call_details` present |
| `identity_verified` | `boolean \| null` | Stage 1 outcome; null if the call didn't get that far |
| `operating_status_confirmed` | `boolean \| null` | Stage 1 outcome |
| `angle_used` | `HookAngle \| null` | Which Stage 2 hook was delivered |
| `hook_response_notes` | `string \| null` | What they said to the hook |
| `objections_raised` | `string[]` | Free-text objection labels from the script's table |
| `email_obtained` | `boolean \| null` | Stage 4 outcome |
| `email_value` | `string \| null` | Validated as email when present |
| `callback_number_left` | `boolean \| null` | Declined-email fallback |
| `owner_name_confirmed` | `string \| null` | Spoken confirmation — write-back candidate |
| `team_signal_confirmed` | `TeamSignalValue \| null` | Write-back candidate |
| `preferred_channel_confirmed` | `string \| null` | Write-back candidate |

### 4.3 Outcome enum extension

`contactOutcomeEnum` (route layer, `marketing-ops.ts` line 274) and
`ContactOutcome` (`MarketingOutreachService.ts` line 27) gain:

- `wrong_number`
- `disconnected_number`

Mapping from the script's vocabulary: `voicemail` → existing
`left_message`; `connected` → one of `reached` / `interested` /
`not_interested` / `callback_scheduled` (the existing human-contact set);
`no_answer` → existing `no_answer`. The script's `outcome` field
(`email_obtained`, `callback_left`, `declined`, `not_now_follow_up_later`,
`no_contact_made`) is **derived**, not stored: `email_obtained` ↔
`call_details.email_obtained`, `declined` ↔ `outcome: 'not_interested'`,
`not_now_follow_up_later` ↔ `outcome: 'callback_scheduled'` +
`follow_up_date`, `no_contact_made` ↔ `no_answer`/`left_message`.

**Split-test impact:** `REPLY_OUTCOMES` (`OutreachOpenerService.ts:573`)
already contains exactly the four human-contact outcomes — phone replies
feed the existing reply-rate numerator unchanged. `wrong_number` /
`disconnected_number` are correctly excluded (no human contact).

---

## 5. Backend

### 5.1 Catalog extension — `outreach-openers/hook-library.ts`

`HookTemplate` gains one field; the catalog gains one template:

```ts
export type HookAngle =
  | 'gbp_verification' | 'nap_normalization' | 'hours_sync'
  | 'website_foundation' | 'product_category_pages' | 'review_acquisition'
  | 'testimonial_amplification' | 'local_seo' | 'cross_platform_expansion'
  | 'photo_content_setup' | 'click_to_call' | 'reputation_monitoring'
  | 'zero_footprint';                       // ← new (13th)

export interface HookTemplate {
  angle: HookAngle;
  label: string;
  archetypes: ArchetypeCode[];
  signals: string[];
  subject: string;                          // email channel
  body: string;                             // email channel (five-beat)
  shape: { /* …unchanged… */ };
  phone_hook: string;                       // ← new: Stage 2 spoken line,
                                            //   merge placeholders allowed
                                            //   ({{category}}, {{city}},
                                            //   {{business}})
}
```

The 13 seed `phone_hook` values come verbatim from the operator script's
Stage 2 table, templatized per the same three phrasing categories as the
email bodies (clean `{{category}}` substitution, generic phrasings verbatim,
un-substitutable phrasings genericized). `zero_footprint` affinity:
archetypes **A3, A4**; signals `WC_MISSING_WEBSITE`, `DS_MISSING_PROFILE`,
`CP_MISSING_CONTACT_INFO` (Sprint 2 adds `DS_ZERO_INDEXED_PRESENCE`).

Phone-merge rules differ from email in one respect: `{{salutation}}` is
**not** used in the spoken script (Stage 1 speaks the *business* name, not
a greeting), so the phone merge set is `{{business}}`, `{{address}}`,
`{{category}}`, `{{city}}`, `{{operator_name}}`.

### 5.2 Call script assembly — `CallScriptService.assembleForCampaign(campaignId, ctx)`

New `BaseService` singleton
(`apps/api/src/services/CallScriptService.ts`). No LLM call — deterministic
assembly only:

1. Load campaign (404 if missing). Require `campaign.phone` — 400
   `phone_required` otherwise (the tab is disabled client-side too; this is
   the server guard).
2. Resolve ranked hooks by delegating to the hook suggestion ranking
   (archetype via `resolveCampaignArchetype(campaignId)` + detected signals
   from the triage result — the ranking is channel-agnostic; only the
   rendered copy differs). Returns all 13, ranked; operator picks off-rank.
3. Resolve the phone merge set:
   - `{{business}}` — `campaign.business_name`. **Required for Stage 1**;
     if missing, the placeholder renders visibly (the script's
     pronunciation-check line covers name uncertainty — the UI surfaces it
     as a hint when `owner_name` is unavailable).
   - `{{address}}` — formatted from `address_line1/city/state` (reuse the
     `formatAddress` pattern from `OutreachIntelligenceService`).
   - `{{category}}` — campaign `service_category`, lowercased.
   - `{{city}}` — campaign city.
   - `{{operator_name}}` — resolved from the assigned operator / branding
     config (same source as the opener workspace's operator-name prefill).
4. Read the Outreach Intelligence worksheet via
   `OutreachIntelligenceService.getForCampaign(campaignId)` (sibling
   inheritance included) and return a `call_context` summary: who to ask
   for (owner name + confidence chip), team signal, preferred channel. The
   worksheet is **input** to the call; §5.4 makes the call **input** to the
   worksheet.
5. Return the assembled script:

```ts
interface AssembledCallScript {
  stages: {
    verify: string;        // fixed template, {{business}} + {{address}} resolved
    hook: { angle: HookAngle; label: string; line: string };  // selected
    bridge: string;        // fixed template, {{category}} resolved
    ask: string;           // fixed (free-rundown offer — the canonical CTA)
    close: string;         // fixed, incl. decline exit
  };
  hookOptions: RankedHook[];    // all 13 ranked, phone_hook resolved
  objections: { objection: string; response: string }[];      // code-defined table
  callContext: {
    phone: string;
    owner_name: string | null;
    owner_name_confidence: SourceConfidence;
    team_signal: TeamSignalValue;
    gallery_short_url: string | null;   // active /g/{code} for the SMS fallback (§7.3)
  };
}
```

Stages 1/3/4/5 and the objection table are **code-defined constants** in
the catalog module (like `DEFAULT_CLOSE_VARIANT`) — they never change per
campaign, which is the script's core scaling claim.

### 5.3 Outreach log extension — `MarketingOutreachService.logContact`

- `LogContactInput` gains `callDetails?: CallDetails` and
  `updateWorksheet?: boolean`.
- Route-layer Zod (`marketing-ops.ts`):

```ts
const callResultEnum = z.enum(['connected', 'voicemail', 'no_answer', 'wrong_number', 'disconnected_number']);
const callDetailsSchema = z.object({
  call_result: callResultEnum,
  identity_verified: z.boolean().nullable().default(null),
  operating_status_confirmed: z.boolean().nullable().default(null),
  angle_used: z.string().max(40).nullable().default(null),   // validated against HOOK_LIBRARY keys when non-null
  hook_response_notes: z.string().max(2000).nullable().default(null),
  objections_raised: z.array(z.string().max(120)).max(10).default([]),
  email_obtained: z.boolean().nullable().default(null),
  email_value: z.string().email().nullable().default(null),
  callback_number_left: z.boolean().nullable().default(null),
  owner_name_confirmed: z.string().max(255).nullable().default(null),
  team_signal_confirmed: z.enum(['sole_owner', 'family_team', 'small_staff', 'unknown']).nullable().default(null),
  preferred_channel_confirmed: z.string().max(50).nullable().default(null),
});
```

- **Coherence validation (400 on violation):**
  - `call_details` present ⇒ `contact_channel === 'phone'`.
  - `call_result: 'connected'` ⇒ `outcome` ∈ {`reached`, `interested`,
    `not_interested`, `callback_scheduled`, `other`}.
  - `call_result: 'wrong_number'` ⇒ `outcome: 'wrong_number'` (and likewise
    `disconnected_number`) — the call_result and outcome can't disagree
    about whether the number works.
  - `call_result` ∈ {`no_answer`, `voicemail`} ⇒ `outcome` ∈ {`no_answer`,
    `left_message`} respectively.
  - `email_obtained: true` ⇒ `email_value` non-null.
  - Write-back fields (`owner_name_confirmed`, …) require
    `call_result: 'connected'` — you can't confirm anything on a voicemail.
- `logContact` persists `call_details` verbatim on the row. Everything else
  (fresh snapshot, rollup recompute, prior-follow-up completion, checklist
  bridge `contact_log` auto-complete) flows through unchanged.

### 5.4 Worksheet write-back — `CallScriptService.applyCallConfirmations`

When `updateWorksheet: true` and the call row carries confirmation fields:

1. Resolve the **write target**: the campaign itself, unless it's a
   non-primary sibling — then the primary sibling's campaign id (same
   resolution as `OutreachIntelligenceService.getForCampaign`). Write-back
   never hits the sibling-409 path by construction.
2. Load the target worksheet (may not exist yet — see 4).
3. Merge semantics — **fill-and-confirm only, never clobber**:
   - Field empty / `unavailable` in the worksheet + call confirmed a value
     → write value, `source: "Phone call YYYY-MM-DD"`,
     `source_confidence: 'confirmed'`.
   - Field already `confirmed` with the **same** value → no-op (idempotent).
   - Field already holds a **different** non-null value → **do not
     overwrite**; return it in the response as a `conflicts[]` entry for
     the operator to adjudicate in the Outreach Prep tab.
4. No worksheet row exists yet → create one with the confirmed fields,
   `prepared_by` = the call's `contacted_by`, `research_date` = call date;
   `recommended_salutation` recomputes through the existing chain.
5. `email_obtained` + `email_value` additionally fills `campaigns.email`
   **null-only** (mirrors the HotProspectService contact-sync rule — never
   overwrite an existing address).
6. `audit()` entry (`actorType: 'user'`) recording which fields were
   written, which conflicted, and the source call-log id.

### 5.5 Routes — `apps/api/src/routes/marketing-ops.ts`

```
GET  /:campaignId/call-script?angle=   — assembled script (default angle = top-ranked)
POST /:id/outreach                     — existing route, extended schema
                                         (call_details, update_worksheet)
```

Registration: `GET /:campaignId/call-script` is a two-segment path under
`/:campaignId` — registered **before** the `GET /:id` catch-all group, same
discipline as the outreach-intelligence routes. Response envelope follows
`{ success, data }`.

---

## 6. Frontend

### 6.1 Call Script tab — `OpenerWorkspaceClient.tsx`

Add a third workspace tab `'call'` alongside `'opener' | 'pitch'` (tab bar
already gates on campaign selection; the new tab additionally requires
`selectedCampaign.phone`, else renders a disabled tab with a "No phone
number on campaign" tooltip).

`CallScriptPanel.tsx` (new, co-located in `openers/`):

1. **Call context header** — number to dial (click-to-copy), who to ask for
   (owner name + confidence chip from the worksheet, "inherited" banner
   when read from the primary sibling), team signal, and — when no owner
   name is available — the pronunciation-check hint from the script.
2. **Stage 2 hook picker** — ranked cards from
   `GET /:campaignId/call-script` (`hookOptions`): angle label, resolved
   spoken line, matched-signal chips. Exactly one selected; re-fetch with
   `?angle=` on change (server re-resolves merge fields).
3. **Five-stage script body** — Verify / Hook / Bridge / Ask / Close
   rendered as numbered blocks with one-click copy per block. Stage 4 shows
   the declined-email fallback ("leave my number") as a sub-line; when
   `callContext.gallery_short_url` is present, the Ask block also shows
   "Text the diagnostic link: `/g/{code}`" for the SMS handoff.
4. **Objection accordion** — the five objection/response rows, collapsed by
   default.
5. **"Log call outcome" button** — opens `LogContactModal` in phone mode
   (§6.2), pre-filled with the selected angle.

Loading skeleton, error card with dismiss, dark-mode classes throughout
(`skill-frontend-ux-guardrails`).

### 6.2 `LogContactModal.tsx` — phone mode

When `channel === 'phone'`, the form swaps the message fields for:

- `call_result` segmented control (connected / voicemail / no answer /
  wrong number / disconnected).
- On `connected`: identity verified + operating confirmed toggles, angle
  selector (preselected from the Call Script tab), objections multi-chip
  input, email obtained + value, callback-number-left toggle.
- On `connected` with any confirmation field filled: **"Update Outreach
  Prep worksheet with confirmed fields"** checkbox (default on), with
  helper text: *"Writes to the primary sibling's worksheet as
  `confirmed` with source 'Phone call {date}'. Conflicting existing values
  are never overwritten."*
- On `wrong_number` / `disconnected_number`: a static notice — *"This won't
  change the campaign's phone number automatically. Review it in Business
  Contact Details."* (The data-quality loop is Sprint 2, §13.3.)

The existing email-only `message_subject` stays gated to `channel ===
'email'`; `message_snapshot` is hidden in phone mode (nothing was sent).

### 6.3 Outreach Prep tab — call provenance

`OutreachIntelligenceTab.tsx`: a field whose `source` matches
`/^Phone call /` renders a small phone-icon chip next to the confidence
badge. Read-only affordance; no form changes.

---

## 7. Integration points

### 7.1 Checklist bridge

None required. `logContact` already fires `onOutreachArtifactCreated(
…, 'contact_log', …)`; phone logs auto-complete the same checklist steps.
`OX_CONTACT_LOGGED` derivation (`outreach-state-extractor.ts`) counts
`mkt_outreach_log` rows regardless of channel.

### 7.2 Sibling campaigns

- **Read:** the Call Script tab on a non-primary sibling gets
  `callContext` from the inherited worksheet and ranks hooks by its own
  triage-accepted archetype (e.g., the review-management sibling leads with
  `review_acquisition`, the profile-repair sibling with `nap_normalization`
  — one business, one phone call, angle chosen per sibling being worked).
- **Write:** `applyCallConfirmations` always resolves the primary sibling
  as the write target (§5.4.1).

### 7.3 Gallery short-code SMS handoff

The script's declined-email fallback ("leave my number") pairs with the
existing `/g/{shortCode}` short URLs (migration 183, built for SMS to
phone-only prospects): `CallScriptService` resolves the campaign's most
recent active gallery token (same query as
`LogContactModal.handleInsertGalleryLink`, including `ensureShortCode`
lazy backfill for legacy tokens) and surfaces the short URL in
`callContext`. No new token machinery.

---

## 8. Sprint 1 slices

| Slice | Deliverables | Files |
|---|---|---|
| **1. Schema** | Migration 190; Prisma regen | `database/migrations/190_mkt_outreach_log_call_details.sql`, `apps/api/prisma/schema.prisma` |
| **2. Catalog** | `phone_hook` on all 12 templates + `zero_footprint` (13th); fixed-stage constants + objection table | `apps/api/src/services/outreach-openers/hook-library.ts` |
| **3. Assembly service + tests** | `CallScriptService.assembleForCampaign` + `applyCallConfirmations`; unit tests: merge resolution (incl. visible-placeholder on missing business/address), phone_required 400, ranking passthrough, write-back fill/confirm/conflict/idempotency, sibling write-target resolution, null-only campaign.email fill | `CallScriptService.ts`, `__tests__/CallScriptService.test.ts` |
| **4. Log extension + route tests** | `call_details` + outcome enum + coherence 400s; `GET /:campaignId/call-script`; extended `POST /:id/outreach`; route tests: 401, wrong-channel 400, connected-with-voicemail-fields 400, wrong_number coherence 400, round-trip preserves call_details verbatim | `MarketingOutreachService.ts`, `marketing-ops.ts`, `apps/api/src/tests/` |
| **5. Frontend** | Call Script tab + panel; LogContactModal phone mode; worksheet provenance chip; service client methods | `OpenerWorkspaceClient.tsx`, `CallScriptPanel.tsx`, `LogContactModal.tsx`, `OutreachIntelligenceTab.tsx`, `MarketingOpsService.ts` (web) |
| **6. Verify** | `pnpm checkapi`, `pnpm checkweb`, run API test suites | — |

Slices 1–4 are the MVP (script renderable + outcomes loggable + write-back
working via API). Slice 5 can ship in the same sprint or fast-follow.

---

## 9. Acceptance criteria (Sprint 1)

1. A phone-bearing campaign shows the Call Script tab; selecting it renders
   all five stages with merge fields resolved — `{{business}}` and
   `{{address}}` never blank-fabricated, placeholders visible when
   unresolvable.
2. The Stage 2 picker lists all 13 hooks ranked (archetype-affinity first,
   signal-match tie-break), and switching angles re-renders only Stage 2.
3. Logging a connected phone call with `call_details` round-trips verbatim;
   coherence violations (call_details on email channel, connected +
   no_answer outcome, wrong_number call_result without matching outcome,
   confirmations on non-connected results) are 400s.
4. With "update worksheet" on, confirmed owner name/email/team signal land
   on the **primary sibling's** worksheet as `confirmed` with source
   `Phone call YYYY-MM-DD`; a conflicting existing value is returned in
   `conflicts[]` and left untouched; `campaigns.email` fills null-only.
5. `getSplitTestStats` reply-rate math is unchanged (the four human-contact
   outcomes already cover phone replies); `wrong_number` /
   `disconnected_number` never count as replies.
6. A declined-email call surfaces the active `/g/{code}` short URL in the
   Ask block for the SMS fallback.
7. `pnpm checkapi` / `pnpm checkweb` pass; new tests pass.

---

## 10. Guardrails (Sprint 1)

1. **Spoken copy is not gated copy.** `phone_hook` values bypass
   `runQualityGate` — the gate's requirements (salutation line, "three
   previews attached", signoff) are written-channel artifacts. The catalog
   copy encodes the script's tone rules instead: observation phrased as a
   genuine question, one hook per call, no stacked hooks.
2. **Never fabricate identity.** Missing business name/address render as
   visible placeholders; the pronunciation-check line is the sanctioned
   fallback, not a guess.
3. **Confirmed means confirmed.** Write-back values come only from
   `call_result: 'connected'` rows, always carry the dated source string,
   and never overwrite a conflicting non-null value — conflicts surface to
   the operator.
4. **A clear no is terminal.** `not_interested` on a call must not trigger
   any automated re-outreach; the next-touch decision belongs to the
   operator (engagement cycling stays manual). The modal's default
   follow-up behavior is unchanged — follow-up dates are always
   operator-set.
5. **Call compliance is operator-owned.** The platform records and renders;
   it does not dial. No auto-redial, no retry scheduling on
   `no_answer` beyond the existing manual follow-up date.

---

# Sprint 2 — Phone Analytics + Emerging-Discovery Alignment

---

## 11. Problem

Sprint 1 makes phone a real channel; three alignment gaps remain:

1. **The phone-first population isn't systematically mapped.** V3
   Emerging-Discovery fields (`growth_readiness`, `emerging_archetype`) are
   validated by `city-category-opportunity.schema.ts` but consumed by **no
   service** — nothing connects `foundation_needed` / `INVISIBLE_ANCHOR` /
   `DIRECTORY_GHOST` prospects to the channel decision or the angle
   ranking. Operators currently infer "call this one" by eyeballing the
   audit.
2. **Phone angle performance is unmeasurable.** `hook_angle` attribution
   (migration 189) covers written openers; `call_details.angle_used`
   (migration 190) covers calls — but `getSplitTestStats()` has no
   channel dimension, so "does `zero_footprint` convert better on the phone
   than `website_foundation` does by email" is unanswerable.
3. **Bad numbers don't feed data quality.** `wrong_number` /
   `disconnected_number` outcomes are stored but inert — the campaign keeps
   its dead phone, the hot-prospect record stays warm, and the next
   operator redials the same dead number.

---

## 12. Goal

1. A code-defined **emerging-archetype → angle map** + a **channel hint**
   (`phone_first`) derived from `growth_readiness`, surfaced on the
   campaign and consumed by hook ranking.
2. **Channel-aware split-test stats**: `byChannel` and
   `byHookAngle × channel` groupings in `getSplitTestStats()`.
3. A **wrong-number data-quality loop**: dead-number outcomes prompt
   operator review (banner → confirm → null phone + audit note → optional
   hot-prospect deprioritization).
4. Register `DS_ZERO_INDEXED_PRESENCE` in the signal registry so the
   `zero_footprint` angle ranks on signal match, not just archetype
   affinity.

### Non-goals

- No V3 ingestion pipeline rebuild — the map reads fields already stored in
  audit JSON (`audit_data.prospect_discovery` / per-business V3 blocks).
- No automatic deprioritization — every data-quality action is
  operator-confirmed.

---

## 13. Design

### 13.1 Emerging-angle map — `outreach-openers/emerging-angle-map.ts`

Code-defined, typed, unit-tested (same pattern as the hook catalog):

```ts
export type EmergingArchetype =
  | 'SINGLE_PLATFORM' | 'DIRECTORY_GHOST' | 'MISCATEGORIZED_OR_MISLABELED'
  | 'INVISIBLE_ANCHOR' | 'INSUFFICIENT_EVIDENCE';

export const EMERGING_ANGLE_MAP: Record<EmergingArchetype, HookAngle[]> = {
  DIRECTORY_GHOST:            ['zero_footprint', 'gbp_verification', 'cross_platform_expansion'],
  INVISIBLE_ANCHOR:           ['local_seo', 'website_foundation', 'zero_footprint'],
  SINGLE_PLATFORM:            ['cross_platform_expansion', 'photo_content_setup'],
  MISCATEGORIZED_OR_MISLABELED: ['nap_normalization', 'local_seo'],
  INSUFFICIENT_EVIDENCE:      ['zero_footprint'],
};
```

Ranking integration: when the campaign's latest audit carries a V3
`emerging_archetype`, hooks in that archetype's list get a rank boost
(ordered by list position) applied **after** A-archetype affinity and
**before** signal-match tie-break. `growth_readiness` ∈
{`foundation_needed`, `insufficient_evidence`} + campaign has phone but no
email/social ⇒ `channel_hint: 'phone_first'`, surfaced as a badge on the
campaign row and defaulted in the Call Script tab's tab ordering. This is a
hint, not a gate — the operator always picks the channel.

### 13.2 Channel-aware stats — `OutreachOpenerService.getSplitTestStats`

- Each cohort row gains `byChannel: { email_dm: {...}, phone: {...} }`:
  phone-side sent/replied counts derive from `mkt_outreach_log` rows with
  `contact_channel = 'phone'`; written-side from the existing opener/sent
  logic.
- New `byHookAngle` matrix: rows = angle, columns = channel. Phone cells
  attribute via `call_details->>'angle_used'` (indexed by migration 190);
  written cells via `mkt_outreach_openers_list.hook_angle` (migration 189).
- `REPLY_OUTCOMES` is unchanged; the new dimensions are group-bys over the
  same numerator/denominator definitions.

### 13.3 Wrong-number data-quality loop

- `MarketingOutreachService.getFollowUpsDue` and the campaign overview
  query include `has_dead_number: boolean` (any un-acked
  `wrong_number`/`disconnected_number` log where `campaigns.phone` is still
  non-null).
- Campaign detail shows a review banner: *"Call on {date} reached a
  {wrong number / disconnected line}."* Actions:
  - **Confirm dead** → `campaigns.phone = null` + `audit()` note linking
    the log id + (if the campaign is a hot prospect) optional
    deprioritization via the existing `MarketingHotProspectService`
    lifecycle — operator-chosen, never automatic.
  - **Keep number** → acks the banner (recorded on the log row's
    `call_details.ack`), no data change.
- A subsequent confirmed working number (operator edits Business Contact
  Details) clears the banner state naturally (`phone` non-null again is
  fine — the ack flag prevents re-prompting for the same log row).

### 13.4 Signal registration — migration `191_mkt_signal_zero_indexed.sql`

Data-only seed, mirroring migration 186's pattern (`ON CONFLICT (code) DO
NOTHING`):

```sql
INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active)
VALUES
  ('sig-ds-zero-indexed', 'DS_ZERO_INDEXED_PRESENCE', 'DS', 'Zero indexed presence',
   'No usable online footprint found — no website, no meaningful Google presence. Emitted by V3 Emerging-Discovery audits (operator vocabulary: EF_ZERO_INDEXED_PRESENCE). Boosts the zero_footprint hook angle.',
   'model_emitted', NULL, true)
ON CONFLICT (code) DO NOTHING;
```

Family `DS` (Digital Surface & Profile) — the `EF_` prefix from the
operator script is documented as an alias in the description rather than
introducing a seventh family. The signal is inert until V3 audit ingestion
emits it (extraction wiring is deliberately out of scope — registering the
code now lets the hook catalog reference it and lets manual/registry-driven
use start immediately).

---

## 14. Sprint 2 slices

| Slice | Deliverables | Files |
|---|---|---|
| **1. Map + ranking** | `emerging-angle-map.ts`; rank boost + `channel_hint` in the suggestion/assembly path; unit tests: boost ordering, hint derivation (phone-only + foundation_needed), absent-V3 passthrough | `emerging-angle-map.ts`, `HookSuggestionService.ts` / `CallScriptService.ts`, tests |
| **2. Stats** | `byChannel` + angle×channel matrix; tests: phone attribution via call_details, written via hook_angle, reply-rate parity | `OutreachOpenerService.ts`, tests |
| **3. Dead-number loop** | `has_dead_number` query + banner + confirm/keep endpoints + null-phone write with audit | `MarketingOutreachService.ts`, `marketing-ops.ts`, campaign detail UI |
| **4. Signal seed** | Migration 191; registry test | `database/migrations/191_mkt_signal_zero_indexed.sql` |
| **5. Verify** | `pnpm checkapi`, `pnpm checkweb`, suites | — |

---

## 15. Acceptance criteria (Sprint 2)

1. A campaign whose latest V3 audit says `DIRECTORY_GHOST` ranks
   `zero_footprint` first in both the email hook picker and the Call Script
   tab; a `foundation_needed` phone-only campaign shows the `phone_first`
   badge.
2. Split-test stats expose `byChannel` and the angle×channel matrix;
   phone-cell reply rates count exactly the four human-contact outcomes.
3. Logging `disconnected_number` raises the review banner; "Confirm dead"
   nulls the phone with an audit trail and never deprioritizes without an
   explicit operator choice; "Keep number" acks without re-prompting.
4. `DS_ZERO_INDEXED_PRESENCE` appears in the signal registry admin and in
   the triage card's signal display when present.
5. `pnpm checkapi` / `pnpm checkweb` pass; new tests pass.
