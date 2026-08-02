# Recovery Management Engine — Integration Analysis

**Status:** Draft · **Owner:** Platform Eng · **Date:** 2026-08-01
**Source spec:** *Recovery Management Engine Integration* (functional spec)
**Companion doc:** `RECOVERY_MANAGEMENT_ENGINE_SPRINT_PLAN.md`

---

## 1. Purpose

This document analyzes how the Recovery Management Engine (BBB dispute mediation,
legal de-escalation, high-stakes grievance recovery) integrates into the existing
review-centric Marketing Ops platform. It maps every claim in the functional spec
against the **actual** codebase primitives — Prisma models, singleton services,
public token-gated routes, and the web `CustomerApiSingleton` bearer-token base —
and flags deltas, risks, and required extensions before any code is written.

The goal is a token-gated dispute intake pipeline that reuses Scopes, Stages,
Categories, Prompts, Deliverables, Openers, and Follow-ups **without** structural
rewrites or a secondary microservice.

---

## 2. Current-State Inventory (As-Built)

The platform already implements the seven core primitives the spec references.
They live under the `mkt_*` Prisma namespace and the `Marketing*Service` /
`Outreach*Service` / `Review*Service` singleton families.

### 2.1 Prisma models (relevant subset)

| Spec primitive | Actual model | Location |
|---|---|---|
| Campaign | `mkt_campaigns_list` | `apps/api/prisma/schema.prisma:6088` |
| Scope | `mkt_campaigns_list.scope` (free `VarChar(20)`, default `business`; values like `business`/`category`/`city` are app-layer only, no DB constraint) | `:6139` |
| Stage | `mkt_campaigns_list.stage` (string, default `seek`) + `mkt_stage_history_list` | `:6105`, `:6464` |
| Category | `mkt_campaigns_list.category` + `mkt_service_categories_list` + `mkt_category_tone_presets_list` | `:6092`, `:6427`, `:6410` |
| Prompt | `mkt_prompt_templates_list` + `mkt_prompt_executions_list` | `:6384`, `:6354` |
| Deliverable | `mkt_deliverables_list` + `mkt_deliverable_templates_list` + `mkt_deliverable_review_slot` + `mkt_deliverable_section` | `:6212`, `:6192`, `:6264`, `:6295` |
| Opener | `mkt_outreach_openers_list` (+ closers/headers/contacts/pitches) | `:6603` |
| Follow-up | `mkt_outreach_log` (follow_up_date / follow_up_completed_at) + `OutreachFollowUpService` | `:6528` |
| Audit | `mkt_audits_list` (per-campaign, per-platform) | `:6049` |
| Owner voice | `mkt_owner_voice_profile` (1:1 campaign) | `:6245` |
| Preview token | `mkt_deliverable_preview_tokens` (token-gated magic link, **already exists**) | `:6479` |
| Review pipeline | `mkt_review_response_pipeline` + `mkt_review_response_log` | `:6551`, `:6580` |

### 2.2 Stage machine (as-built)

`MarketingCampaignService.VALID_TRANSITIONS` (`apps/api/src/services/MarketingCampaignService.ts:54`):

```
seek → preview_built → shown → paid → delivered → retainer_pitched → retainer_won
                     ↘ dead      ↘ lost / tenant_onboarded      ↘ closed
lost → seek   dead → seek  (one-way resurrection paths)
```

(Verified against the source: the map also includes a `closed` stage reachable
from `delivered` and `retainer_pitched`, and resurrection is one-way —
`lost → seek` and `dead → seek` — not bidirectional. Any regression test must
encode this actual map, not an idealized diagram.)

This is a **sales-pipeline** machine (prospect → paid → retainer), **not** a
dispute-intake machine. The spec's `AUDIT_IDENTIFIED → … → RESOLVED_AND_CLOSED`
machine is a different shape and must be modeled as a **parallel track**, not a
rewrite of the existing transitions.

### 2.3 Public token-gated route (as-built)

`apps/api/src/routes/marketing-ops-public.ts` already implements a zero-auth,
token-gated public surface using `mkt_deliverable_preview_tokens`:

- `GET /api/public/marketing/pay` — resolve `ptoken` → campaign + pricing
- `POST /api/public/marketing/checkout` — Stripe PaymentIntent
- `POST /api/public/marketing/coupons/validate`
- `POST /api/public/marketing/pay/confirm` — mark paid, upgrade deliverable
- `GET /api/public/marketing/receipt/:campaignId` — receipt PDF

The `resolvePreviewToken()` helper (`:45`) is the **exact** pattern the spec's
magic-link intake needs: look up by token, reject if expired, return campaign.
Note that the helper itself does **not** stamp `viewed_at` — stamping happens in
the `GET /pay` handler (`:83–88`, only if not already set). The recovery
equivalent (`resolveDisputeToken()`) should decide explicitly where `viewed_at`
stamping lives; keeping it in the resolve handler mirrors the proven shape.
Recovery intake reuses this pattern with the token stored on the new
`mkt_dispute_intake` model (see §4.3), **not** on preview tokens (see R6).

### 2.4 Web public page (as-built)

`apps/web/src/app/marketing/pay/{page.tsx,PayPageClient.tsx}` is a zero-auth
landing page that reads `?ptoken=` from the URL, calls the public API, and
renders a Stripe form. This is the template for `/recovery/intake?token=…`.

### 2.5 Web service base classes

- `AdminApiSingleton` → used by `MarketingOpsService` (admin CRUD).
- `PublicApiSingleton` (`apps/web/src/providers/base/PublicApiSingleton.ts`)
  → abstract domain base for zero-auth public requests (`RequestType.PUBLIC`,
  no credentials, `makeDefaultRequest`); base for ~50 existing services.
- `CustomerApiSingleton` (`apps/web/src/providers/base/CustomerApiSingleton.ts`)
  → extends `FlexibleApiSingleton`; requests carry `Authorization: Bearer
  <customer_auth_token>` and `x-customer-id` headers read from `localStorage`.
  (The headers are actually attached in the **base**
  `FlexibleApiSingleton.onCustomerRequest()` at `:1268–1282`, not in the
  subclass — relevant because subclassing `CustomerApiSingleton` would inherit
  that behavior, which is exactly what the zero-auth intake must avoid.)

**Important nuance:** `CustomerApiSingleton` is JWT-bearing (customer login).
The Recovery intake portal is **zero-auth by spec** (magic link only, no
account). The right base for the intake service is therefore
**`PublicApiSingleton`** — the platform's abstract domain base for
unauthenticated requests (`defaultRequestType = RequestType.PUBLIC`,
`defaultIncludeCredentials = false`, no Bearer header, no `localStorage`
customer token), already used by ~50 services (`StorefrontSingletonService`,
`PublicCouponService`, `TenantPublicService`, …). Do **not** extend
`FlexibleApiSingleton` directly — that skips the domain-base tier and its
conventions (see `.devin/skills/deploy-service-extending-base-singleton.md`).
The **operator-side** recovery workspace uses `AdminApiSingleton` (the operator
is a platform admin, not a customer — mirroring `MarketingOpsService`), and the
**owner-facing intake form** uses the public base so no auth headers are sent.
See §5.3 for the resolved pattern.

### 2.6 AI prompt execution (as-built)

`MarketingPromptService` (`apps/api/src/services/MarketingPromptService.ts`):

- Versioned templates (`mkt_prompt_templates_list`) with `prompt_type`,
  `category`, `tone`, `scope`, `output_schema` (JSON schema for validation).
- Executions (`mkt_prompt_executions_list`) are created via `createExecution()`
  (`:227`, status `pending`) and then finalized via `updateExecution()` (`:248`),
  which records `raw_output`, `filtered_output`, `pass_rate`, `flagged_count`,
  `ai_provider`, `ai_model`, `tokens_used`, `cost_cents`. The recovery agent flow
  must call `updateExecution()` after the AI run to persist these metrics.
- `importExternalResult()` (`:326`) validates external agent JSON against the
  template's declared `output_schema` via `OUTPUT_SCHEMA_REGISTRY`, then
  transactionally creates the execution + optional audit.

The Recovery AI Agent is **just another prompt template + execution** with a
new `prompt_type = 'recovery_resolution'` and a new `output_schema` declaring
`deliverableText` + `submissionGuide`. No new execution engine required.

### 2.7 Outreach cascade (as-built)

`MarketingOutreachService` + `OutreachFollowUpService` +
`OutreachOpenerService` already drive multi-channel cascades with
`mkt_outreach_log` recording `contact_channel`, `outcome`, `follow_up_date`,
`message_snapshot`. The spec's Day 1 → Day 2 → Day 4 email/SMS/webform cascade
is an **outreach sequence config**, not new infrastructure.

---

## 3. Gap Analysis (Spec vs. As-Built)

| # | Spec requirement | As-built state | Gap | Severity |
|---|---|---|---|---|
| G1 | `CampaignCategory` enum (`REVIEW_MANAGEMENT` \| `RECOVERY_MANAGEMENT`) | `category` is a free `VarChar(100)` string; no enum | Add `campaign_category` column + enum-ish constraint (see §4.1) | Medium |
| G2 | `CampaignStage` enum with 9 dispute stages | `stage` is a string on a sales pipeline machine | Add **recovery track** stages + a category-aware transition table (§4.2) | High |
| G3 | `DisputeIntake` model (accessToken, expiresAt, ownerStatement, proposedResolution, statusFlag, attachments) | No equivalent; `mkt_deliverable_preview_tokens` is closest but is payment-oriented | New `mkt_dispute_intake` model + `mkt_dispute_attachments` (§4.3) | High |
| G4 | `ProofAttachment` model | `mkt_files_list` exists for general files but not dispute-scoped | New `mkt_dispute_attachments` (or extend `mkt_files_list` with `dispute_intake_id`) | Medium |
| G5 | `Deliverable` model with `responseDraft` + `submissionGuide` + `isApproved` | `mkt_deliverables_list` exists but stores `file_name`/`storage_path` (PDF artifact), not inline draft text | Either (a) store draft in `mkt_deliverable_section` rows, or (b) add `response_draft`/`submission_guide`/`is_approved` columns to `mkt_deliverables_list` with `deliverable_type='recovery_resolution'` | Medium |
| G6 | Magic-link generation on `OUTREACH_DISPATCHED` | Preview-token generation exists for payment (`MarketingDeliverableService`, 30-day TTL, nanoid 32-char); no recovery token. (`mkt_deliverable_preview_tokens` already has a `token_type` column, but per R6 dispute tokens must **not** overload it.) | Store the token on `mkt_dispute_intake.access_token` + generator in `DisputeIntakeService` (nanoid, matching `lib/id-generator.ts` convention) | Medium |
| G7 | Public intake form (zero-auth) | `marketing-ops-public.ts` + `marketing/pay` page are the template | New `recovery-intake-public.ts` route + `recovery/intake` page (§5) | Medium |
| G8 | Recovery AI Agent system prompt | `MarketingPromptService` supports arbitrary templates + `output_schema` | Seed a `recovery_resolution` template + schema; no engine change | Low |
| G9 | Intake submit transitions stage to `INTAKE_SUBMITTED` + triggers agent | Stage transitions exist via `MarketingCampaignService.transitionStage()` | Wire submit handler to call transition + prompt execution (§6) | Medium |
| G10 | Multi-channel cascade (Day 1/2/4) | `OutreachFollowUpService` exists | Add a recovery-specific sequence template; no infra change | Low |
| G11 | Token expiration (7 days) + "Request New Link" splash | `expires_at` column exists on preview tokens; no splash page | Reuse `expires_at`; add splash page + regenerate endpoint | Low |
| G12 | File upload (PDF/PNG/JPEG ≤10MB) | `mkt_files_list` + `MarketingFileService` exist, but the service is **metadata-only** — no mime/size guards, no storage logic, no virus scan (storage is deferred to "existing platform upload infrastructure", target TBD) | Build the type/size guards + virus-scan hook as **new code** in the intake path; identify and name the actual storage backend before S2 | Medium |

**Net new schema objects: 2** (`mkt_dispute_intake`, `mkt_dispute_attachments`).
**Net new services: 2** (`DisputeIntakeService`, `RecoveryResolutionService`).
**Net new jobs: 1** (recovery-resolution scheduler draining `pending` prompt
executions — there is no existing queue; see §6 step 3).
**Net new routes: 1 file** (`recovery-intake-public.ts`) + admin endpoints folded
into `marketing-ops.ts`. **Net new web pages: 2** (`recovery/intake`,
`recovery/expired`). No microservice split.

---

## 4. Data Model Resolution

The spec's Prisma snippet uses PascalCase (`Campaign`, `DisputeIntake`). The
actual codebase uses snake_case table names (`mkt_campaigns_list`) with
snake_case columns. The implementation must follow the **codebase convention**,
not the spec's illustrative names. Below is the resolved mapping.

### 4.1 Campaign category

Add a new column to `mkt_campaigns_list`:

```prisma
campaign_category String @default("review_management") @db.VarChar(30)
```

Plus an index `@@index([campaign_category])`. Do **not** introduce a Prisma
`enum` (the codebase has none for marketing; it uses string + app-layer
validation via Zod). The Zod schema in `MarketingCampaignService` /
`MarketingOpsService` types must add:

```ts
export type CampaignCategory = 'review_management' | 'recovery_management';
```

Default `review_management` keeps every existing row on the review track with
zero backfill.

### 4.2 Stage machine — dual track

Keep the existing sales-pipeline stages untouched. Add recovery stages as
**additional string values** the `stage` column already accepts (it is
`VarChar(50)`, no DB enum). Introduce a **category-aware transition table** in
`MarketingCampaignService`:

```ts
const REVIEW_TRANSITIONS = { /* existing VALID_TRANSITIONS */ };
const RECOVERY_TRANSITIONS: Record<string, string[]> = {
  audit_identified:          ['framework_preview_generated', 'dead'],
  framework_preview_generated: ['outreach_dispatched', 'dead'],
  outreach_dispatched:       ['awaiting_owner_intake', 'dead'],
  awaiting_owner_intake:     ['intake_submitted', 'outreach_dispatched', 'dead'], // re-dispatch on expiry; dead on cascade exhaustion / timeout
  intake_submitted:          ['final_resolution_drafted'],
  final_resolution_drafted:  ['owner_approved'],
  owner_approved:            ['resolved_and_closed'],
  resolved_and_closed:       [],
  dead:                      ['audit_identified'],
};

function transitionsFor(category: CampaignCategory) {
  return category === 'recovery_management' ? RECOVERY_TRANSITIONS : REVIEW_TRANSITIONS;
}
```

`isValidTransition(from, to, category)` gains a third param. Existing callers
default to `review_management` so behavior is unchanged.

### 4.3 New models

Convention notes: all `mkt_*` IDs are app-generated strings (no `@default` on
`id`) via `lib/id-generator.ts` (nanoid-based) — the new models must follow
suit. `tenant_id` is included because every neighboring `mkt_*` table
(including `mkt_campaigns_list` and `mkt_deliverable_preview_tokens`) is
tenant-scoped; omitting it would break admin filtering and any future RLS.

```prisma
model mkt_dispute_intake {
  id                  String   @id @db.VarChar(255)
  campaign_id         String   @unique @db.VarChar(255)
  tenant_id           String?  @db.VarChar(255)
  access_token        String   @unique @db.VarChar(255)
  expires_at          DateTime @db.Timestamptz(6)
  owner_statement     String?
  service_date        DateTime? @db.Date
  proposed_resolution String?
  status_flag         String?  @db.VarChar(50) // REFUND_OFFERED | CONTRACT_ENFORCED | ...
  submitted_at        DateTime? @db.Timestamptz(6)
  viewed_at           DateTime? @db.Timestamptz(6)
  created_at          DateTime  @default(now()) @db.Timestamptz(6)
  updated_at          DateTime  @default(now()) @db.Timestamptz(6)
  mkt_campaigns_list  mkt_campaigns_list @relation(fields: [campaign_id], references: [id], onDelete: Cascade, map: "fk_dispute_intake_campaign")
  mkt_dispute_attachments mkt_dispute_attachments[]

  @@index([access_token], map: "idx_dispute_intake_token")
  @@index([campaign_id], map: "idx_dispute_intake_campaign")
  @@index([tenant_id], map: "idx_dispute_intake_tenant")
}

model mkt_dispute_attachments {
  id               String   @id @db.VarChar(255)
  dispute_intake_id String  @db.VarChar(255)
  file_url         String   @db.VarChar(500)
  file_name        String   @db.VarChar(255)
  file_type        String   @db.VarChar(20) // pdf | png | jpeg
  file_size        Int?
  uploaded_at      DateTime @default(now()) @db.Timestamptz(6)
  mkt_dispute_intake mkt_dispute_intake @relation(fields: [dispute_intake_id], references: [id], onDelete: Cascade, map: "fk_dispute_attach_intake")

  @@index([dispute_intake_id], map: "idx_dispute_attach_intake")
}
```

### 4.4 Deliverable extension

Prefer **option (a)** from G5: reuse `mkt_deliverables_list` with
`deliverable_type = 'recovery_resolution'` and store the draft text in
`mkt_deliverable_section` rows (`section_key = 'response_draft' |
'submission_guide'`). This avoids altering the high-traffic deliverables table
and reuses the existing section/preview-token machinery. `is_approved` maps to
the existing `status` column (`preview` → `paid`/`archived` becomes
`drafted` → `approved`/`closed` for recovery type — app-layer mapping, no DB
change).

---

## 5. Public Intake Portal — Architecture

### 5.1 Backend route

New file `apps/api/src/routes/recovery-intake-public.ts`, registered in
`routeRegistry.ts` alongside `marketing-ops-public.ts`. Zero-auth, token-gated,
mirrors the proven `resolvePreviewToken()` pattern:

```
GET  /api/public/recovery/intake?token=…        resolve token → complaint context + form spec
POST /api/public/recovery/intake/submit         validate + persist submission, transition stage, trigger agent
POST /api/public/recovery/intake/reissue         request a new link (rate-limited)
GET  /api/public/recovery/intake/attachments/:id stream/download proof (token-scoped)
```

All handlers validate `token` via a `resolveDisputeToken()` helper that checks
`mkt_dispute_intake.access_token` + `expires_at`. Expired tokens return a
structured `{ expired: true }` payload so the page can render the "Request New
Link" splash instead of a generic 404.

### 5.2 Web page

New route group `apps/web/src/app/recovery/intake/{page.tsx,IntakePageClient.tsx}`
mirroring `marketing/pay`. Reads `?token=`, calls the public API, renders the
context header + 3 fields + uploader. A sibling `recovery/expired/page.tsx`
handles the reissue CTA.

### 5.3 Web service base — resolved

The spec says zero-auth. The user's steer is to leverage the singleton base
classes. Resolved per the platform's domain-base convention
(`.devin/skills/deploy-service-extending-base-singleton.md`):

- **Owner-facing intake service** (`RecoveryIntakePublicService`) extends
  **`PublicApiSingleton`** and calls endpoints via `makeDefaultRequest()` —
  `RequestType.PUBLIC` and `includeCredentials = false` are the class defaults,
  so no Bearer header or `localStorage` customer token is ever sent. This keeps
  the form zero-friction, matches the spec, and follows the pattern used by all
  ~50 existing public services. Two caveats from the skill doc apply:
  1. **Cache:** the base default TTL is 15 min — too long for token state.
     Token resolution, submit, and reissue calls must bypass caching (no cache
     key / explicit `ttl: 0`); otherwise a post-submit re-resolve could serve a
     stale pre-submit form.
  2. **Double-unwrap contract:** backend `handleSuccess` wraps payloads in
     `{ success, data }` and `makeDefaultRequest` wraps again — service methods
     must return `result.data?.data || result.data`, never bare `result.data`.
- **Operator-facing recovery workspace service** (`RecoveryOpsService`) extends
  `AdminApiSingleton` (like `MarketingOpsService`) for the admin CRUD over
  disputes, drafts, and approvals.
- `CustomerApiSingleton` remains the right base for any future **logged-in
  owner** flows (e.g., a business owner portal that lists their disputes). It is
  **not** used for the magic-link intake itself, because forcing a JWT would
  break the zero-auth requirement.

---

## 6. Recovery AI Agent — Execution Flow

1. Owner submits intake → `POST /api/public/recovery/intake/submit`.
2. Handler validates Zod schema, **guards idempotency** (`submitted_at IS NULL`,
   else return the existing submission — double-submit on a public form is
   guaranteed), persists `mkt_dispute_intake` fields + attachments, sets
   `submitted_at`, transitions campaign
   `awaiting_owner_intake → intake_submitted` via
   `MarketingCampaignService.transitionStage({ triggerType: 'system' })`.
3. Handler enqueues a recovery resolution job (reuse the existing prompt
   execution path): `MarketingPromptService.createExecution({ campaignId,
   templateId: RECOVERY_TEMPLATE_ID, variablesUsed: { complaintText,
   intakePayload, attachmentMeta } })`. **Queue reality:** the platform has no
   job queue (no BullMQ/pg-boss); "async" means an in-process scheduled job
   following the `apps/api/src/jobs/marketing-ops-auto-followup.ts`
   `setInterval` pattern that picks up `pending` executions. That job is net-new
   code and must be scoped in S3.
4. The execution runs the seeded `recovery_resolution` template (system prompt
   from spec §4.1) via `AIProviderService`, validates the JSON output against
   the template's `output_schema` (`{ deliverableText, submissionGuide }`),
   persists metrics via `MarketingPromptService.updateExecution()`, and writes
   a `mkt_deliverables_list` row (`deliverable_type = 'recovery_resolution'`,
   `status = 'drafted'` — the column is a free string, so no DB change) with
   two sections.
5. Campaign transitions `intake_submitted → final_resolution_drafted`.
6. Operator reviews in the admin workspace, edits if needed, approves →
   `final_resolution_drafted → owner_approved → resolved_and_closed`.
7. **Owner delivery:** on `resolved_and_closed`, the approved `response_draft`
   + `submission_guide` are delivered to the owner via the existing outreach
   service (email, recorded in `mkt_outreach_log` with `message_snapshot`).
   Without this step the business outcome — the owner actually receiving the
   mediated resolution — never happens.

No new execution engine. The new artifacts are the **seeded prompt template**,
its **output schema registration** in `OUTPUT_SCHEMA_REGISTRY`, and the
**scheduler job** that drains pending recovery executions.

---

## 7. Outreach Cascade

The Day 1 → Day 2 → Day 4 sequence is configured as a recovery outreach
template consumed by `OutreachFollowUpService`. Channels (`email`, `sms`,
`webform`) already exist in `mkt_outreach_log.contact_channel`. The cascade
gates on `campaign_category = 'recovery_management'` and
`stage = awaiting_owner_intake`. No new infra; only a sequence definition +
scheduler hook.

---

## 8. Risk Register

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Dual stage machine complicates `isValidTransition` callers | Third param defaults to `review_management`; all existing call sites unchanged; add a BFRI check (per backend-dev-guidelines) before merging |
| R2 | Magic-link token leakage (intake tokens are PII-bearing) | `access_token` is high-entropy (nanoid 32-char via `lib/id-generator.ts`, matching the existing preview-token convention), `@unique`, 7-day expiry, single-use submission enforced by the `submitted_at` guard, rate-limited reissue (global `express-rate-limit` infra exists), no listing endpoint. Tokens travel in `?token=` query params → they land in access logs and browser history; keep TTL short and never log the param server-side |
| R3 | File upload abuse on public endpoint | Strict mime allowlist (pdf/png/jpeg), 10MB cap, virus-scan hook before persisting `file_url`, per-token upload count limit. **All four are net-new code** — `MarketingFileService` today is metadata-only with no guards; do not assume reuse. Also: files uploaded against a token that is never submitted are orphaned — add a purge path (see sprint plan S2) |
| R4 | Recovery AI output not policy-compliant | `output_schema` validation + a `mkt_filter_flags_list` pass (existing filter pipeline) before draft is exposed to operator; operator must approve |
| R5 | Stage string drift (typo in recovery stage) | Centralize stage literals in a `recoveryStages.ts` const + Zod enum; never inline strings |
| R6 | `mkt_deliverable_preview_tokens` overload | Keep dispute tokens in `mkt_dispute_intake`, **not** preview tokens, to avoid coupling payment and intake lifecycles |
| R7 | RLS posture unknown for `mkt_*` tables | 22 of 25 `mkt_*` models carry the comment "contains row level security…", but **no RLS policies exist in any migration SQL**, and the public pay route reads `mkt_deliverable_preview_tokens` via Prisma today with no workaround — evidence the API role bypasses RLS. **Pre-S1 action:** verify actual DB-level RLS state on one existing `mkt_*` table, then document the chosen posture for the new tables in the migration (likely: same posture as `mkt_deliverable_preview_tokens`) |
| R8 | Operator confusion: two campaign categories in one table | Admin UI filter chip on `campaign_category`; default list view groups by category |
| R9 | PII/legal exposure: owner statements + dispute evidence on a zero-auth endpoint; AI-drafted de-escalation text in a legal-adjacent context | Operator approval is the primary control for AI output (state it as such); define a retention/deletion policy for intake data + attachments; legal/comms review of the owner-facing copy and the seeded agent prompt before launch |

---

## 9. BFRI Score (per backend-dev-guidelines)

| Dimension | Score (1–5) | Notes |
|---|---|---|
| Architectural Fit | 5 | Reuses routes → services → repositories; no layer skip |
| Business Logic Complexity | 3 | Dual stage machine + AI agent; moderate |
| Data Risk | 3 | New tables, public-write surface; mitigated by token + validation |
| Operational Risk | 3 | Public upload + AI execution; existing Sentry + filter pipeline cover it |
| Testability | 4 | Services are singletons with DI; public route is integration-testable |

**BFRI = (5 + 4) − (3 + 3 + 3) = 0 → Risky.**

Per the doctrine, BFRI 0–2 means **refactor or isolate**. The integration is
approved to proceed **only because** it isolates the new surface in two new
services + one new public route file, and reuses every existing primitive
rather than mutating shared ones. Mandatory gates before merge:

- Unit tests for `RECOVERY_TRANSITIONS` + `transitionsFor()`.
- Integration test for the full intake → submit → draft → approve happy path.
- Integration test for expired-token and reissue paths.
- Zod schema for every public endpoint.
- Sentry on every handler (no swallowed errors).
- `unifiedConfig` for token TTL, upload limits, AI provider/model.

---

## 10. Out of Scope (Explicit)

- Logged-in owner portal (CustomerApiSingleton-based) — future sprint.
- BBB portal auto-submission (the spec's `submissionGuide` is a human-readable
  guide, not an API integration).
- SMS/webform sending providers — the cascade defines the sequence; provider
  wiring is existing infra work, not part of this integration.
- Migration of existing review campaigns to the new `campaign_category` column
  (default handles it; no backfill needed).

---

## 11. Open Questions

Each question needs a named owner and a decision before S1 kickoff (see sprint
plan §6.4).

1. What is the actual DB-level RLS posture for `mkt_*` tables, and should
   `mkt_dispute_intake` match it? (Recommendation: verify on an existing table
   first — see R7 — then mirror the `mkt_deliverable_preview_tokens` posture.)
2. Is the 7-day expiry configurable per-tenant or global? (Recommendation:
   global via `unifiedConfig.recovery.intakeTokenTtlDays`.)
3. Should the Recovery AI Agent run synchronously on submit or async via a
   scheduler job? (Recommendation: async via a new in-process scheduler job —
   note there is **no existing queue**; see §6 step 3.)
4. Does the operator workspace need a new top-level nav section, or a tab inside
   the existing Marketing Ops admin page? (Recommendation: tab — decided; see
   sprint plan §5.)
5. The source functional spec (*Recovery Management Engine Integration*) is
   referenced repeatedly (e.g. "spec §4.1") but is **not checked into `docs/`**.
   Check it in before S3 — the seeded-template snapshot test needs a source of
   truth.
6. How does an operator create a recovery-category campaign? The existing
   `campaigns/new` UI has no category selector and no sprint currently owns it.
   (Recommendation: extend `campaigns/new` with a `campaign_category` selector
   in S4 — see sprint plan §5.1 task 3.)
