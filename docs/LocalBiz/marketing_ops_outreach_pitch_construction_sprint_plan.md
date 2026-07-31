# Sprint Plan: Marketing Ops — Outreach Pitch Construction (Opener + Header + Preview + Closer + Contact)

**Document Version:** 1.0
**Date:** 2026-07-31
**Status:** Draft — Ready for Review
**Prerequisite:** Marketing Ops Outreach Opener sprint complete (`mkt_outreach_openers_list`, `OutreachOpenerService`, archetype selection, dual AI/Import execution path, `/settings/admin/marketing-ops/openers` workspace smoke-tested); Business Contact Details sprint landed; Seek Audit Integration landed (`business_analysis` audits with structured `audit_data`); `aiProviderFactory` wired and operational.

This plan builds the **Pitch Construction** layer on top of the existing Outreach Opener workspace. The opener is one component of a full outreach pitch; this sprint adds the remaining components — **Header**, **Preview** (3 review/response pairs), **Closer**, and optional **Contact** — each as a variation-bearing entity to enable split-testing, plus an assembler that renders the full pitch in the operator's fixed format.

---

## 1. Executive Summary

The Outreach Opener sprint produced the handshake — the personalized first-touch paragraph that proves the operator studied the prospect. But the opener alone is not the deliverable. The full outreach pitch is a structured document:

```
The Pitch

The Opener (handshake):
<opener text>

The Header (subject):
<header text>

The Preview (3 completed reviews + responses):

THE NEGATIVE - The handled 1-star goes first

Review # 1
Customer Review: "...."
Owner Response Message: "...."
----------------------
Review # 2
Customer Review: "...."
Owner Response Message: "...."
----------------------
Review # 3
Customer Review: "...."
Owner Response Message: "...."
----------------------
CLOSER - The closer creates the itch

<closer text>

My Contact:  <optional contact text>
```

Today there is no tooling to assemble this. Operators hand-assemble pitches in a text editor, copy review text from public platform browser pages by hand, draft owner responses ad hoc, and lose the variation history that would let them learn which header/closer combinations convert. This sprint builds a **Pitch Construction** panel on the existing Openers page that:

1. **Treats every copy component as a variation-bearing entity** — Header, Closer, and Contact each get their own table mirroring `mkt_outreach_openers_list`, so multiple variants per campaign enable split-testing combinations against the same opener + preview.
2. **Generates each component via the same dual AI/Import path** proven in the Opener sprint — AI draft (using the campaign's `tone`) or Import External paste, both run through component-specific quality gates where applicable.
3. **Assembles the 3-slot preview from pasted public reviews + AI-drafted or imported owner responses** — the operator pastes the customer review text (publicly available from the platform browser page), then chooses AI draft or Import External for the owner response. The handled 1-star negative goes first (slot 1 default).
4. **Assembles and persists the full pitch** in the fixed format above, with Copy + Download, stored in `mkt_outreach_pitches_list` with full provenance (which variant of each component was used, which review/response pairs, who assembled it, when).

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Header variants** | Multiple subject-line variants per campaign via dual AI/Import path; subject-line quality gate (length, no spam-trigger words, specificity check) |
| **Closer variants** | Multiple closer variants per campaign; editable template pre-filled with `The remaining {{remaining}} responses are written and ready to deliver today.` where `remaining` = unanswered count − 3 (operator-adjustable); AI/Import dual path |
| **Contact variants (optional)** | Multiple contact-footer variants per campaign; free-text, no AI gate (contact is optional — the pitch can stand alone on the review/response preview; any owner reply triggers the payment-intake reply) |
| **Review/response preview slots** | 3 slots per pitch; each slot = pasted customer review text + owner response (AI draft using campaign `tone` or Import External); slot 1 defaults to the handled 1-star negative |
| **Pitch assembly** | Renders the full pitch in the fixed format; Copy + Download; persists to `mkt_outreach_pitches_list` with component variant IDs + review/response pairs as JSON |
| **Split-test foundation** | Every component is a variant row, so future analytics can correlate which header/closer/contact combo converted — variants are stored now, analytics later |

### Why now

The Opener sprint landed the hardest component (the personalized handshake from audit data). The remaining components are simpler copy but currently hand-assembled, which means: (a) no variation history, (b) no quality gate on subject lines, (c) no AI assist on owner responses, (d) no persisted record of which pitch was sent to which prospect. With the opener workspace already smoke-tested, the natural next step is to extend the same workspace to assemble the full pitch — same page, same dual-path UX, same provenance discipline.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer

---

## 2. Strategy — Why Each Component Is a Variant

### The pitch anatomy (fixed format, variable components)

1. **Opener (handshake)** — already a variant in `mkt_outreach_openers_list`. Selected per pitch.
2. **Header (subject)** — the subject line of the outreach email/DM. Split-testing subject lines is the single highest-leverage variable in cold outreach open rates. Variants stored in `mkt_outreach_headers_list`.
3. **Preview (3 review/response pairs)** — the proof. The operator pastes 3 real customer reviews (publicly available from the platform browser page) and pairs each with an owner response. The handled 1-star negative goes first to lead with the hardest case turned around. Review/response pairs are evidence, not copy — they live on the pitch row as JSON, not as their own variant tables.
4. **Closer** — "creates the itch." Default template: `The remaining {{remaining}} responses are written and ready to deliver today.` The count is editable (operator can adjust per prospect). Variants stored in `mkt_outreach_closers_list`.
5. **Contact (optional)** — operator footer. Optional because the pitch can stand alone on the review/response preview; any owner reply triggers the payment-intake reply. When used, it's a split-testable variant in `mkt_outreach_contacts_list`.

### What stays out of the pitch

- **Pricing / tier labels** — same forbidden list as the opener. The pitch is proof + itch, not a price quote.
- **"Digital opportunity score"** — internal jargon.
- **Positive infrastructure notes** (HTTPS, mobile-friendly) — not uncomfortable enough.

### Split-testing rationale

Storing every component as a variant row (rather than free-text on the pitch) means future analytics can answer: "Of the 50 pitches sent last month, which header variant had the highest reply rate? Which closer?" Without variant rows, this question is unanswerable. The cost of variant rows now is low (4 small tables mirroring an existing pattern); the cost of retrofitting them later is high (re-importing historical pitches).

---

## 3. Component Detail

### 3.1 Header (Subject Line)

**Quality gate** (subject-line specific):
- Length: 4–60 characters
- No spam-trigger words: `free`, `guarantee`, `act now`, `urgent`, all-caps words
- Must contain the business name or a specific audit signal (theme/platform name) — generic subjects fail
- No exclamation points, no emojis

**Prompt template** (`header-prompts.ts`):
```
You are writing a cold first-touch outreach subject line to a small business owner.

Inputs (JSON):
{{extracted_fields}}

Task: Write one subject line, 4–60 characters, that names the business and
references the single most uncomfortable signal from the audit (the review
cluster theme, the listing inconsistency, or the missing CTA — whichever
the opener archetype uses). No pricing, no jargon, no exclamation points,
no emojis. Specificity over cleverness.

Output the subject line only.
```

### 3.2 Closer

**Default template** (pre-filled on resolve, editable):
```
The remaining {{remaining}} responses are written and ready to deliver today.
```
Where `remaining` = `combined_review_metrics.observable_unanswered_reviews − 3` (the 3 shown in the preview). Operator can override the number and wording per variant.

**Quality gate**:
- Must contain a number (the remaining count)
- ≤ 25 words
- No pricing, no exclamation points, no emojis
- Must reference "responses" or "replies" (the itch is: more proof exists, delivered on request)

**Prompt template** (`closer-prompts.ts`):
```
You are writing the closer line for a cold first-touch outreach pitch to a
small business owner. The closer creates the itch — it tells the owner that
more proof exists beyond the 3 previews shown.

Inputs (JSON):
{{extracted_fields}}

Task: Write one closer line, ≤25 words, that conveys "the remaining
{{remaining}} responses are written and ready to deliver today." Vary the
phrasing but keep the itch. No pricing, no exclamation points, no emojis.

Output the closer only.
```

### 3.3 Contact (Optional)

No AI generation, no quality gate — free-text operator footer. Stored as a variant so the operator can save their standard footer(s) and reuse across pitches, and so split-testing can compare "with contact" vs "without contact" reply rates.

Fields: `contact_text` (text), `label` (varchar — operator-facing name for the variant, e.g. "Pauly — phone+email", "Pauly — email only").

### 3.4 Review/Response Preview Slots

Three slots per pitch. For each slot:
- **Customer Review** — operator pastes the review text from the public platform browser page (Google Maps, Yelp, Facebook). Stored as `review_text` on the slot JSON. No AI generation — the review is real public text.
- **Owner Response** — dual path:
  - **AI draft** — `ReviewResponseDraftService.generateResponse({campaignId, reviewText})` uses the campaign's `tone` field to draft an owner response that turns the review around. Prompt below.
  - **Import External** — operator pastes a response drafted elsewhere.
- **Negative-first flag** — slot 1 defaults to `is_negative_first=true` (the handled 1-star goes first). Operator can reorder.

**Response draft prompt** (`review-response-prompt.ts`):
```
You are drafting an owner response to a customer review for a small business.
The response turns the review around — acknowledges the issue, names the
specific fix, and invites the customer back. Tone: {{tone}}.

Customer review:
{{review_text}}

Business name: {{business_name}}

Task: Write the owner response, ≤80 words. No exclamation points, no emojis,
no pricing. Acknowledge the specific complaint, name the concrete fix, end
with an invitation to return.

Output the response only.
```

No persistent table for review/response pairs — they live on the pitch row as JSON. They're evidence assembled per-pitch, not reusable copy.

---

## 4. Data Model

Four new tables, all mirroring `mkt_outreach_openers_list` shape. Plus one assembly table.

### 4.1 `mkt_outreach_headers_list`

| Column | Type | Notes |
|---|---|---|
| `id` | varchar(255) | `moh-` prefix |
| `campaign_id` | varchar(255) | FK to `mkt_campaigns_list` |
| `header_text` | text | Subject line |
| `quality_gate_passed` | boolean | Quality gate result |
| `quality_gate_issues` | json | Array of failed check strings |
| `source` | varchar(20) | `ai` or `external` |
| `ai_provider` | varchar(50) | nullable |
| `ai_model` | varchar(100) | nullable |
| `tokens_used` | integer | default 0 |
| `cost_cents` | integer | default 0 |
| `extracted_fields` | json | Fields passed to prompt (audit provenance) |
| `executed_by` | varchar(255) | nullable |
| `executed_at` | timestamptz | default now() |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

Indexes: `[campaign_id, executed_at(desc)]`, `[source]`.

### 4.2 `mkt_outreach_closers_list`

Same shape as headers, with `closer_text` instead of `header_text`. `moc-` prefix.

### 4.3 `mkt_outreach_contacts_list`

| Column | Type | Notes |
|---|---|---|
| `id` | varchar(255) | `mocc-` prefix (distinct from closers `moc-`) |
| `campaign_id` | varchar(255) | FK to `mkt_campaigns_list` |
| `contact_text` | text | Operator footer text |
| `label` | varchar(100) | Operator-facing variant name |
| `created_by` | varchar(255) | nullable |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

No AI columns, no quality gate — free-text. Indexes: `[campaign_id]`.

### 4.4 `mkt_outreach_pitches_list`

The assembly record — one row per assembled pitch.

| Column | Type | Notes |
|---|---|---|
| `id` | varchar(255) | `mopch-` prefix (distinct from openers `mop-`) |
| `campaign_id` | varchar(255) | FK to `mkt_campaigns_list` |
| `opener_id` | varchar(255) | FK to `mkt_outreach_openers_list` |
| `header_id` | varchar(255) | nullable, FK to `mkt_outreach_headers_list` |
| `closer_id` | varchar(255) | nullable, FK to `mkt_outreach_closers_list` |
| `contact_id` | varchar(255) | nullable, FK to `mkt_outreach_contacts_list` |
| `review_pairs` | json | Array of 3: `{review_text, response_text, response_source, response_ai_provider, response_ai_model, response_tokens_used, is_negative_first}` |
| `assembled_text` | text | Rendered full pitch in the fixed format |
| `created_by` | varchar(255) | nullable |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

Indexes: `[campaign_id, created_at(desc)]`, `[opener_id]`, `[header_id]`, `[closer_id]`.

---

## 5. Backend Services

New module: `apps/api/src/services/outreach-pitch/`

### 5.1 `HeaderService.ts`
Mirrors `OutreachOpenerService`:
- `resolveHeader(campaignId)` — deterministic field extraction + prompt build (no AI)
- `executeHeader({campaignId, executedBy})` — AI generation + quality gate + store
- `importHeader({campaignId, headerText, executedBy})` — quality gate on paste + store
- `listHeaders(campaignId)`, `getHeader(id)`

### 5.2 `CloserService.ts`
Same shape as HeaderService. `resolveCloser` pre-fills the editable template with `remaining` computed from `combined_review_metrics.observable_unanswered_reviews − 3`. AI generation is optional (the template is often enough; AI varies the phrasing for split-testing).

### 5.3 `ContactService.ts`
Simplest — no AI, no quality gate:
- `createContact({campaignId, contactText, label, createdBy})`
- `updateContact(id, {contactText, label})`
- `deleteContact(id)`
- `listContacts(campaignId)`

### 5.4 `ReviewResponseDraftService.ts`
No persistence — returns a draft for the slot:
- `generateResponse({campaignId, reviewText})` — AI draft using campaign `tone`; returns `{response_text, ai_provider, ai_model, tokens_used, cost_cents}`
- `importResponse({campaignId, reviewText, responseText})` — validates non-empty; returns `{response_text, source: 'external'}`

The caller (PatchService) is responsible for storing the pair in the pitch's `review_pairs` JSON.

### 5.5 `PatchService.ts`
- `assemblePatch({campaignId, openerId, headerId, closerId, contactId, reviewPairs, createdBy})` — fetches each component by ID, renders `assembled_text` in the fixed format, persists to `mkt_outreach_pitches_list`
- `listPatches(campaignId)`, `getPatch(id)`
- `renderPitchText({opener, header, reviewPairs, closer, contact})` — pure function that produces the fixed-format string (see §1)

### 5.6 Prompt templates
- `header-prompts.ts` — subject-line prompt (§3.1)
- `closer-prompts.ts` — closer prompt (§3.2)
- `review-response-prompt.ts` — owner response draft prompt (§3.4)

### 5.7 Quality gates
- `header-quality-gate.ts` — subject-line checks (§3.1)
- `closer-quality-gate.ts` — closer checks (§3.2)
- (No gate for contact; no gate for review/response pairs — the review is real public text, the response is operator-approved)

---

## 6. API Routes (added to `marketing-ops.ts`, under `/openers/...`)

```
# Header variants
GET    /openers/headers?campaignId=X
POST   /openers/headers/execute
POST   /openers/headers/import
GET    /openers/headers/:id

# Closer variants
GET    /openers/closers?campaignId=X
POST   /openers/closers/execute
POST   /openers/closers/import
GET    /openers/closers/:id

# Contact variants
GET    /openers/contacts?campaignId=X
POST   /openers/contacts              (create)
PUT    /openers/contacts/:id          (update)
DELETE /openers/contacts/:id

# Review/response draft (no persistence — returns draft for slot)
POST   /openers/review-responses/generate
POST   /openers/review-responses/import

# Pitch assembly
GET    /openers/pitches?campaignId=X
POST   /openers/pitches               (assemble + persist)
GET    /openers/pitches/:id
```

Routes declared before `router.get('/:id', ...)` (same ordering constraint as existing opener routes — see comment at `marketing-ops.ts:1684`).

---

## 7. Frontend — Pitch Construction Panel

Added to `OpenerWorkspaceClient.tsx` as a new collapsible section below the existing workspace, visible when a campaign is selected and at least one opener variant exists.

### Layout (single column, full width below the existing two-column workspace)

1. **Header** — variant dropdown (existing variants for this campaign) + "New variant" button → expands the dual AI/Import path (mirrors opener UI: blue Execute button + violet Import textarea). Quality gate badge on each variant.
2. **Opener** — variant dropdown (read from existing `mkt_outreach_openers_list`). Required before assembling. Shows selected opener text preview.
3. **Preview (3 slots)** — for each slot:
   - Textarea: paste customer review (from platform browser page)
   - "AI draft response" (violet button) / "Import response" (textarea) — uses campaign tone
   - Checkbox: "Negative first (1-star handled)" — slot 1 defaults checked
   - Rendered review/response pair preview in the fixed format (`Customer Review: "..." / Owner Response Message: "..."`)
4. **Closer** — variant dropdown + AI/Import; editable template pre-filled with `The remaining {{remaining}} responses are written and ready to deliver today.` (remaining computed, operator-editable).
5. **Contact** (optional) — variant dropdown + free-text create; can be left empty. Label field for split-test identification.
6. **Assemble Pitch** button → renders the full pitch in the fixed format (Pitch / Header / Preview with NEGATIVE first / CLOSER / Contact) with Copy + Download. Persists to `mkt_outreach_pitches_list`.
7. **Pitch history** — list of assembled pitches for this campaign, each with Copy/Download and the variant IDs used (for future split-test correlation).

### Web service layer (`MarketingOpsService.ts`)

New methods mirroring the opener methods:
- `resolveHeader`, `executeHeader`, `importHeader`, `listHeaders`
- `resolveCloser`, `executeCloser`, `importCloser`, `listClosers`
- `listContacts`, `createContact`, `updateContact`, `deleteContact`
- `generateReviewResponse`, `importReviewResponse`
- `assemblePitch`, `listPitches`, `getPitch`

---

## 8. Sprint Phases

| Phase | Task | Output |
|---|---|---|
| 1 | Prisma schema (4 new tables) + migration | Schema |
| 2 | Backend services: `HeaderService`, `CloserService`, `ContactService`, `ReviewResponseDraftService`, `PatchService` + prompt templates + quality gates | Backend services |
| 3 | API routes in `marketing-ops.ts` | Endpoints |
| 4 | Web service methods in `MarketingOpsService.ts` + types | Web service layer |
| 5 | Pitch Construction panel in `OpenerWorkspaceClient.tsx` | UI |
| 6 | Smoke test on a real campaign (e.g. One Hour Heating A2) — full assemble + Copy/Download | Validation |
| 7 | Test on A1, A3, A4 campaigns | Coverage |
| 8 | Tune prompts from quality gate failures | Prompt set v2 |

---

## 9. Dependencies & Reuse

| Component | Reused From | Path |
|---|---|---|
| Opener variant table | Outreach Opener sprint | `mkt_outreach_openers_list` |
| AI provider factory | `MarketingExecutionService` | `apps/api/src/services/ai-providers` (via `aiProviderFactory.generateChatCompletion()`) |
| Dual execution UX pattern | `PromptWorkspaceClient` + `OpenerWorkspaceClient` | `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx` |
| Campaign fetch + audit access + tone | `MarketingCampaignService.getCampaign()` | `apps/api/src/services/MarketingCampaignService.ts` |
| Page shell + breadcrumbs | `MarketingOpsPageShell` | `apps/web/src/components/marketing-ops/MarketingOpsPageShell.tsx` |
| Web service layer | `MarketingOpsService` | `apps/web/src/services/MarketingOpsService.ts` |
| ID generation | `generateOutreachOpenerId` pattern | `apps/api/src/lib/id-generator.ts` (add `generateOutreachHeaderId`, `generateOutreachCloserId`, `generateOutreachContactId`, `generateOutreachPitchId`) |
| Base service pattern | `BaseService` singleton | `apps/api/src/services/BaseService.ts` |
| Logger | `logger` | `apps/api/src/logger.ts` |
| Archetype selection (for header/closer prompt context) | `selectArchetype` | `apps/api/src/services/outreach-openers/archetype-selection.ts` |

---

## 10. Open Questions

1. **Header/closer prompt context** — Should the header and closer prompts receive the full extracted fields (like the opener) or just the archetype + business name + theme? Lean: full fields, so the subject line can name the specific signal. Confirm in Phase 2.
2. **Review/response pair validation** — Should the UI enforce that slot 1 has `is_negative_first=true` and the review text contains a 1-star signal, or is the flag purely operator-controlled? Lean: operator-controlled (the operator pasted the review, they know its rating).
3. **Contact variant scope** — Should contact variants be per-campaign (like header/closer) or per-operator (reused across all campaigns the operator works)? Lean: per-campaign for now (matches the variant pattern); promote to operator-profile field later if reuse becomes painful.
4. **Pitch "sent" tracking** — Should assembling a pitch also mark the campaign `stage='shown'`, or is that a separate explicit action (as in the opener sprint plan §10)? Lean: separate explicit action — assembling ≠ sending.
5. **Split-test analytics** — Out of scope for this sprint (variants are stored now, analytics later). Confirm before Phase 5 so the UI doesn't imply analytics that don't exist yet.

---

## 11. Out of Scope (Follow-ups)

- **Split-test analytics** — correlating header/closer/contact variant combos with reply rates. Variants are stored now; analytics is a later sprint.
- **"Mark as sent" stage transition** — already specced in the opener sprint plan §10; separate task.
- **Review/response pair variation/split-testing** — pairs are evidence assembled per-pitch, not reusable copy. No variant table.
- **Automated review fetching from platform browser pages** — operator pastes review text manually for now; automated scraping is a separate compliance-scoped sprint.
- **Multi-opener pitch** — one opener per pitch for now; A/B testing openers within a single pitch is a later concern.
