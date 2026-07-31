# Sprint Plan: Marketing Ops — Deliverable Construction (Owner Voice + Batch Review Responses + Render)

**Document Version:** 1.0
**Date:** 2026-07-31
**Status:** Draft — Ready for Review
**Prerequisite:** Outreach Opener sprint complete; Outreach Pitch Construction sprint complete (Header/Closer/Contact/ReviewResponseDraft/Pitch services + routes + workspace); Review Response Pipeline sprint complete (per-platform pipeline, scheduled follow-ups, outcome tracking); `MarketingDeliverableService` landed (templates, jsPDF generation, branding); `aiProviderFactory` wired and operational.

This plan builds the **Deliverable Construction** layer — the post-payment workflow that produces the full deliverable the owner receives. The preview (opener + 3 review/response pairs + closer) is a subset of this deliverable, so the architecture extends the same variant → quality-gate → assembly pattern already proven in the opener and pitch sprints.

---

## 1. Executive Summary

When a campaign reaches `paid`, the operator must construct the full deliverable: drafted owner responses for **every** unanswered review across all platforms, a recovery playbook keyed by theme cluster, listing corrections (if applicable), and CTA/website fix recommendations (if applicable). The owner receives a branded document that reads as if a copywriter wrote each response in the owner's own voice.

Today the operator hand-drafts each response in a text editor, has no owner-voice calibration, and no structured review/approval flow before rendering the final PDF. The existing `MarketingDeliverableService` can render a branded PDF from a template + content string, but there is no construction workflow that produces that content from raw review data + owner voice + business context.

This sprint builds a **Deliverable Construction** workspace that:

1. **Calibrates owner voice** — AI infers voice from the business's existing review responses (if any); operator edits/overrides. Falls back to a manual profile if no existing responses. The voice profile feeds every response draft prompt so responses sound like the owner, not a bot.
2. **Ingests all reviews** — pulls every unanswered review across all platforms from the audit data, creates a per-review response slot with the same dual AI/Import path proven in the pitch sprint.
3. **Generates responses in batch** — batch runner calls the review response draft prompt (extended with owner voice + business context) for each review, runs the quality gate, and persists variants.
4. **Operator edits each response** — inline edit per review slot; re-generate single response; mark as approved.
5. **Renders the final deliverable** — when all responses are approved, operator hits "Render" → `MarketingDeliverableService` generates the branded PDF (and/or TXT export) with all sections assembled.

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Owner voice profile** | Per-campaign voice profile: first person vs. third, formality, humor, apology style, signoff style, signature. AI-inferred from existing owner responses with operator override. Stored in `mkt_owner_voice_profile`. |
| **Business context block** | Extended context beyond NAP: category, services, hours, staff names, policies, GBP categories. Extracted from audit data + campaign fields. Feeds all response prompts. |
| **Batch review ingestion** | Pulls all unanswered reviews from audit data; creates a `mkt_deliverable_review_slot` per review with platform, review text, rating, date, sentiment. |
| **Batch response generation** | Batch runner generates owner response drafts for all slots using owner voice + business context + tone. Same dual AI/Import path as pitch sprint. Quality gate per response. |
| **Per-response editing** | Operator can edit any response inline, re-generate single responses, mark as approved. Approved responses are locked for render. |
| **Recovery playbook** | Generated from theme clusters: response templates by theme, escalation paths, follow-up cadence. Uses the same prompt pattern as the opener A2 archetype. |
| **Listing corrections** (if A3) | Corrected NAP data per platform with diff showing current vs. corrected. |
| **CTA/website fixes** (if A4) | Concrete recommendations + placement descriptions. |
| **Render** | Assembles all approved sections → branded PDF via `MarketingDeliverableService` (existing jsPDF pipeline) + TXT export. Operator controls when to render. |
| **Preview alignment** | The preview (3 review/response pairs shown pre-payment) is a subset of the deliverable. Same prompts, same quality gate, same owner voice. The preview is literally the first 3 slots of the deliverable. |

### Why now

The opener and pitch sprints landed the preview construction workflow. The review response pipeline landed per-platform tracking and follow-up gating. The `MarketingDeliverableService` landed PDF generation with branding. The missing piece is the construction workflow between payment and render — owner voice calibration, batch generation, per-response editing, and the render trigger. Without it, operators hand-draft 50-200 responses with no voice consistency and no structured approval flow.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer

---

## 2. Architecture — Extending the Existing Pattern

### 2.1 The preview is a subset of the deliverable

```
DELIVERABLE (post-payment)
├── Owner Voice Profile (new — calibrates all responses)
├── Business Context Block (new — extends NAP with full context)
├── Review Response Slots (ALL unanswered reviews, not just 3)
│   ├── Slot 1: Review text → Owner response (AI/Import → QG → variant)
│   ├── Slot 2: Review text → Owner response (AI/Import → QG → variant)
│   ├── ...
│   └── Slot N: Review text → Owner response (AI/Import → QG → variant)
├── Recovery Playbook (theme clusters → templates → escalation)
├── Listing Corrections (if A3 archetype)
├── CTA/Website Fixes (if A4 archetype)
└── Render → Branded PDF / TXT

PREVIEW (pre-payment) = first 3 slots + opener + header + closer
```

The preview reuses the exact same slot infrastructure — it's just limited to 3 reviews (the negative cluster) and rendered with a watermark. When the campaign pays, the deliverable expands to all reviews and removes the watermark.

### 2.2 New models

#### `mkt_owner_voice_profile`
Per-campaign owner voice calibration. One row per campaign.

| Field | Type | Description |
|-------|------|-------------|
| `id` | VARCHAR(255) PK | `movp-{nanoid}` |
| `campaign_id` | VARCHAR(255) UNIQUE | FK to `mkt_campaigns_list` |
| `person` | VARCHAR(10) | `first_person` / `third_person` / `we` |
| `formality` | VARCHAR(10) | `casual` / `professional` / `formal` |
| `humor` | VARCHAR(10) | `none` / `light` / `witty` |
| `apology_style` | VARCHAR(20) | `direct_apology` / `fix_first` / `acknowledge_and_pivot` |
| `signoff_style` | VARCHAR(20) | `first_name` / `full_name` / `title` / `team` / `none` |
| `signature` | VARCHAR(100) | The actual signoff text (e.g., "— Sarah, Owner") |
| `inferred_from_count` | INT | Number of existing owner responses analyzed (0 = manual) |
| `inferred_sample` | TEXT | Sample of existing responses used for inference |
| `operator_overrides` | JSON | Fields the operator overrode from AI inference |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `mkt_deliverable_review_slot`
Per-review slot in the deliverable. One row per unanswered review.

| Field | Type | Description |
|-------|------|-------------|
| `id` | VARCHAR(255) PK | `mdrs-{nanoid}` |
| `deliverable_id` | VARCHAR(255) | FK to `mkt_deliverables_list` |
| `campaign_id` | VARCHAR(255) | FK to `mkt_campaigns_list` |
| `platform` | VARCHAR(20) | `google` / `yelp` / `facebook` |
| `review_text` | TEXT | The customer review text |
| `review_rating` | INT | 1-5 |
| `review_date` | DATE | |
| `review_author` | VARCHAR(100) | |
| `sentiment` | VARCHAR(10) | `positive` / `neutral` / `negative` |
| `theme` | VARCHAR(50) | Theme cluster this review belongs to (if any) |
| `is_negative_first` | BOOLEAN | Whether this is the handled 1-star (slot 1 in preview) |
| `response_text` | TEXT | The drafted owner response |
| `response_source` | VARCHAR(10) | `ai` / `external` |
| `response_ai_provider` | VARCHAR(50) | |
| `response_ai_model` | VARCHAR(50) | |
| `response_tokens_used` | INT | |
| `quality_gate_passed` | BOOLEAN | |
| `quality_gate_issues` | TEXT[] | |
| `status` | VARCHAR(20) | `draft` / `approved` / `skipped` |
| `slot_index` | INT | Sort order (negative-first = 0) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `mkt_deliverable_section`
Non-review-response sections (playbook, listing corrections, CTA fixes).

| Field | Type | Description |
|-------|------|-------------|
| `id` | VARCHAR(255) PK | `mds-{nanoid}` |
| `deliverable_id` | VARCHAR(255) | FK to `mkt_deliverables_list` |
| `section_type` | VARCHAR(30) | `recovery_playbook` / `listing_corrections` / `cta_fixes` |
| `title` | VARCHAR(200) | |
| `content` | TEXT | The generated section content |
| `source` | VARCHAR(10) | `ai` / `external` |
| `quality_gate_passed` | BOOLEAN | |
| `quality_gate_issues` | TEXT[] | |
| `status` | VARCHAR(20) | `draft` / `approved` / `skipped` |
| `section_index` | INT | Sort order |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 2.3 Service layer

```
apps/api/src/services/
├── outreach-pitch/                    (existing — preview construction)
│   ├── HeaderService.ts               (existing)
│   ├── CloserService.ts               (existing)
│   ├── ContactService.ts              (existing)
│   ├── ReviewResponseDraftService.ts  (existing — single draft)
│   ├── PitchService.ts                (existing — pitch assembly)
│   └── prompts.ts                     (existing — extended with owner voice)
│
├── deliverable/                       (NEW — deliverable construction)
│   ├── OwnerVoiceService.ts           (voice inference + CRUD)
│   ├── BusinessContextService.ts      (assembles full context block)
│   ├── ReviewSlotService.ts           (batch ingestion + per-slot CRUD)
│   ├── DeliverableSectionService.ts   (playbook, corrections, CTA)
│   ├── DeliverableAssemblyService.ts  (assembles all sections → render input)
│   ├── DeliverableRenderService.ts    (wraps MarketingDeliverableService for PDF/TXT)
│   └── prompts.ts                     (owner-voice-extended response prompts)
│
└── MarketingDeliverableService.ts     (existing — PDF generation, branding)
```

### 2.4 Owner voice inference flow

```
1. Operator clicks "Calibrate Owner Voice" on the deliverable workspace
2. OwnerVoiceService scans audit_data for existing owner responses
   (GBP "Owner Response" fields, Yelp public responses, etc.)
3. If existing responses found (>= 3):
   a. AI inference prompt: "Analyze these owner responses. Infer:
      person, formality, humor, apology_style, signoff_style, signature."
   b. Returns inferred profile + sample of responses used
   c. Operator reviews, can override any field
   d. Saved to mkt_owner_voice_profile with inferred_from_count + operator_overrides
4. If no existing responses:
   a. Operator fills manual profile form
   b. Saved with inferred_from_count = 0
5. Voice profile is now injected into every review response draft prompt
```

### 2.5 Batch review response generation flow

```
1. Operator clicks "Ingest Reviews" on the deliverable workspace
2. ReviewSlotService pulls all unanswered reviews from audit_data
   - Sorted: negative-first (1-star handled first), then by date desc
   - Creates mkt_deliverable_review_slot rows (status='draft', response_text=null)
3. Operator clicks "Generate All Responses"
4. Batch runner iterates slots:
   For each slot:
     a. Build prompt = REVIEW_RESPONSE_PROMPT
        + owner voice profile fields
        + business context block
        + campaign tone
        + review text + rating + platform
     b. Call aiProviderFactory
     c. Run quality gate (same rules as pitch sprint)
     d. Persist response_text + quality_gate result
     e. status remains 'draft'
5. Operator reviews each response:
   - Edit inline → saves new response_text, source='external'
   - Re-generate single → re-runs AI for that slot
   - Approve → status='approved' (locked for render)
   - Skip → status='skipped' (excluded from render)
```

### 2.6 Render flow

```
1. Operator clicks "Render Deliverable"
2. DeliverableAssemblyService checks all slots are 'approved' or 'skipped'
3. Assembles content in order:
   - Header (business name, category, location, date)
   - Section 1: Review Responses (all approved slots, sorted by slot_index)
   - Section 2: Recovery Playbook (if approved)
   - Section 3: Listing Corrections (if A3 and approved)
   - Section 4: CTA/Website Fixes (if A4 and approved)
   - Footer (branding disclaimer)
4. DeliverableRenderService calls MarketingDeliverableService.generateDeliverable()
   with the assembled content
5. PDF is generated with branding, saved to uploads/
6. TXT export also generated (plain text, no branding)
7. Deliverable record updated with file paths
8. Campaign stage advanced: paid → delivered
```

---

## 3. API Surface

### Owner Voice
```
GET    /deliverable/voice/:campaignId           — get voice profile (or null)
POST   /deliverable/voice/:campaignId/infer     — AI infer from existing responses
POST   /deliverable/voice/:campaignId           — create/update voice profile
```

### Review Slots
```
GET    /deliverable/:campaignId/slots           — list all slots
POST   /deliverable/:campaignId/slots/ingest    — ingest all unanswered reviews from audit
POST   /deliverable/:campaignId/slots/generate  — batch generate responses for all draft slots
POST   /deliverable/slots/:slotId/regenerate    — re-generate single slot response
PUT    /deliverable/slots/:slotId               — edit slot response text
POST   /deliverable/slots/:slotId/approve       — mark slot as approved
POST   /deliverable/slots/:slotId/skip          — mark slot as skipped
```

### Deliverable Sections
```
GET    /deliverable/:campaignId/sections        — list all sections
POST   /deliverable/:campaignId/sections/generate — generate all sections (playbook, corrections, CTA)
PUT    /deliverable/sections/:sectionId         — edit section content
POST   /deliverable/sections/:sectionId/approve — mark section as approved
POST   /deliverable/sections/:sectionId/skip    — mark section as skipped
```

### Render
```
POST   /deliverable/:campaignId/render          — assemble + render PDF + TXT
GET    /deliverable/:campaignId/render/status   — check render status
GET    /deliverable/:campaignId/download        — download rendered PDF
GET    /deliverable/:campaignId/download/txt    — download TXT export
```

---

## 4. Frontend — Deliverable Workspace

New page: `/settings/admin/marketing-ops/deliverables/[campaignId]`

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Deliverable Construction — [business_name]                  │
│ Campaign: [display_id] · Stage: paid → delivered            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─ Owner Voice ───────────────────────────────────────────┐ │
│ │ Person: [first_person ▾]  Formality: [casual ▾]         │ │
│ │ Humor: [none ▾]  Apology: [fix_first ▾]                 │ │
│ │ Signoff: [first_name ▾]  Signature: [— Sarah, Owner]    │ │
│ │ [Infer from existing]  [Save]                           │ │
│ │ Inferred from 12 existing responses · 2 operator overrides│
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Review Responses (47 slots) ───────────────────────────┐ │
│ │ [Ingest Reviews]  [Generate All]  [42 approved · 5 draft]│ │
│ │                                                         │ │
│ │ Slot 1 ★ (negative-first)  Google · 2024-02-10 · 1★    │ │
│ │ ┌─ Customer Review ──────────────────────────────────┐  │ │
│ │ │ "Diagnostic fee was ridiculous..."                  │  │ │
│ │ └────────────────────────────────────────────────────┘  │ │
│ │ ┌─ Owner Response (AI · approved ✓) ─────────────────┐  │ │
│ │ │ "Hi Jennifer — you're right, the trip fee should..."│  │ │
│ │ └────────────────────────────────────────────────────┘  │ │
│ │ [Edit] [Re-generate] [Approve ✓] [Skip]                │ │
│ │                                                         │ │
│ │ Slot 2  Google · 2024-01-15 · 3★                       │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Recovery Playbook ─────────────────────────────────────┐ │
│ │ [Generate]  [Edit]  [Approve]                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Listing Corrections (A3) ──────────────────────────────┐ │
│ │ [Generate]  [Edit]  [Approve]                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ CTA/Website Fixes (A4) ────────────────────────────────┐ │
│ │ [Generate]  [Edit]  [Approve]                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Render Deliverable →]  (disabled until all slots approved) │
│                                                             │
│ ┌─ Rendered Output ───────────────────────────────────────┐ │
│ │ deliverable_2024-03-15.pdf  (2.1 MB)  [Download PDF]    │ │
│ │ deliverable_2024-03-15.txt  (45 KB)   [Download TXT]    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component structure
```
apps/web/src/components/deliverable/
├── OwnerVoiceCard.tsx           — voice profile form + infer button
├── ReviewSlotList.tsx           — batch list with ingest/generate-all
├── ReviewSlotCard.tsx           — single slot: review text + response + edit/approve
├── DeliverableSectionCard.tsx   — playbook/corrections/CTA section
├── RenderPanel.tsx              — render button + download links
└── DeliverableWorkspace.tsx     — orchestrates all sections

apps/web/src/app/(platform)/settings/admin/marketing-ops/deliverables/[campaignId]/
├── page.tsx                     — server component
└── DeliverableWorkspaceClient.tsx — client component
```

---

## 5. Prompt Extensions

### 5.1 Owner voice injection into review response prompt

The existing `REVIEW_RESPONSE_PROMPT` in `outreach-pitch/prompts.ts` is extended:

```
You are drafting an owner response to a customer review for [business_name].
Write in the owner's voice — not as a marketing bot.

Owner voice profile:
- Person: [first_person / third_person / we]
- Formality: [casual / professional / formal]
- Humor: [none / light / witty]
- Apology style: [direct_apology / fix_first / acknowledge_and_pivot]
- Signoff: [signoff_style] — [signature]

Business context:
- Category: [category]
- City: [city], [state]
- Services: [services from audit]
- Hours: [hours from audit]

Tone: [campaign tone]

Customer review ([platform], [rating]★, [date]):
[review_text]

Task: Write the owner response, ≤80 words, in the owner's voice.
Acknowledge the specific complaint, name the concrete fix, end with
an invitation to return. No exclamation points, no emojis, no pricing.

Output the response only.
```

### 5.2 Recovery playbook prompt

```
You are writing a recovery playbook for [business_name], a [category] in
[city], [state]. The playbook gives the owner ready-to-use response
templates for each recurring negative theme in their reviews.

Negative review themes (from audit):
[theme clusters with counts + example complaints]

For each theme, provide:
1. Theme name (plain language, not audit labels)
2. What usually went wrong (1 sentence)
3. Response template (fill-in-the-blank, owner's voice)
4. Escalation trigger (when to take offline vs. public response)
5. Follow-up cadence (when to check back)

Owner voice profile:
[voice fields]

Output as structured text with clear section breaks.
```

---

## 6. Migration

### Migration 145: Owner voice profile + deliverable review slots + sections

```sql
-- Owner voice profile (one per campaign)
CREATE TABLE IF NOT EXISTS mkt_owner_voice_profile (
  id                    VARCHAR(255) PRIMARY KEY,
  campaign_id           VARCHAR(255) UNIQUE NOT NULL REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  person                VARCHAR(10),
  formality             VARCHAR(10),
  humor                 VARCHAR(10),
  apology_style         VARCHAR(20),
  signoff_style         VARCHAR(20),
  signature             VARCHAR(100),
  inferred_from_count   INT DEFAULT 0,
  inferred_sample       TEXT,
  operator_overrides    JSON DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Deliverable review slots (one per unanswered review)
CREATE TABLE IF NOT EXISTS mkt_deliverable_review_slot (
  id                       VARCHAR(255) PRIMARY KEY,
  deliverable_id           VARCHAR(255) REFERENCES mkt_deliverables_list(id) ON DELETE CASCADE,
  campaign_id              VARCHAR(255) NOT NULL REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  platform                 VARCHAR(20),
  review_text              TEXT,
  review_rating            INT,
  review_date              DATE,
  review_author            VARCHAR(100),
  sentiment                VARCHAR(10),
  theme                    VARCHAR(50),
  is_negative_first        BOOLEAN DEFAULT FALSE,
  response_text            TEXT,
  response_source          VARCHAR(10),
  response_ai_provider     VARCHAR(50),
  response_ai_model        VARCHAR(50),
  response_tokens_used     INT DEFAULT 0,
  quality_gate_passed      BOOLEAN,
  quality_gate_issues      TEXT[],
  status                   VARCHAR(20) DEFAULT 'draft',
  slot_index               INT DEFAULT 0,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mkt_deliverable_slots_campaign ON mkt_deliverable_review_slot(campaign_id, slot_index);
CREATE INDEX idx_mkt_deliverable_slots_status ON mkt_deliverable_review_slot(campaign_id, status);

-- Deliverable sections (playbook, corrections, CTA)
CREATE TABLE IF NOT EXISTS mkt_deliverable_section (
  id                    VARCHAR(255) PRIMARY KEY,
  deliverable_id        VARCHAR(255) REFERENCES mkt_deliverables_list(id) ON DELETE CASCADE,
  campaign_id           VARCHAR(255) NOT NULL REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  section_type          VARCHAR(30),
  title                 VARCHAR(200),
  content               TEXT,
  source                VARCHAR(10),
  quality_gate_passed   BOOLEAN,
  quality_gate_issues   TEXT[],
  status                VARCHAR(20) DEFAULT 'draft',
  section_index         INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mkt_deliverable_sections_campaign ON mkt_deliverable_section(campaign_id, section_index);
```

---

## 7. Preview → Deliverable Alignment

The preview (pre-payment) and deliverable (post-payment) share the same infrastructure:

| Aspect | Preview | Deliverable |
|--------|---------|-------------|
| Review slots | 3 (negative cluster) | All unanswered reviews |
| Owner voice | Campaign `tone` field | Full voice profile |
| Business context | NAP only | Full context block |
| Response prompt | `REVIEW_RESPONSE_PROMPT` | `REVIEW_RESPONSE_PROMPT` + voice + context |
| Quality gate | Same | Same |
| Render | Watermarked PDF | Branded PDF + TXT |
| Workspace | Opener workspace (`/openers`) | Deliverable workspace (`/deliverables/[id]`) |

When the campaign pays, the deliverable workspace pre-populates from the preview's 3 slots (preserving the operator's edits) and expands to all remaining reviews.

---

## 8. Testing

- Unit tests for `OwnerVoiceService` (inference, CRUD, override)
- Unit tests for `ReviewSlotService` (ingest, batch generate, per-slot CRUD)
- Unit tests for `DeliverableSectionService` (playbook, corrections, CTA)
- Unit tests for `DeliverableAssemblyService` (assembly order, skip handling)
- Integration test: full flow from ingest → generate → edit → approve → render
- Quality gate tests for owner-voice-extended prompts

---

## 9. Sprint Tasks

1. Migration 145: owner voice profile + review slots + sections tables
2. Update `schema.prisma` with new models
3. `OwnerVoiceService` — inference prompt + CRUD + operator override
4. `BusinessContextService` — assemble full context from audit + campaign
5. `ReviewSlotService` — batch ingest from audit + per-slot CRUD + batch generate
6. `DeliverableSectionService` — playbook/corrections/CTA generation
7. Extend `prompts.ts` with owner voice injection in review response prompt
8. `DeliverableAssemblyService` — assemble all approved sections
9. `DeliverableRenderService` — wrap `MarketingDeliverableService` for PDF + TXT
10. API routes (voice, slots, sections, render)
11. Frontend service layer methods in `MarketingOpsService.ts`
12. `OwnerVoiceCard` component
13. `ReviewSlotList` + `ReviewSlotCard` components
14. `DeliverableSectionCard` component
15. `RenderPanel` component
16. `DeliverableWorkspaceClient` page
17. Wire into campaign detail (deliverable link when stage >= paid)
18. Typecheck + tests
