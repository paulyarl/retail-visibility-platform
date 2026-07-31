# Sprint Plan: Marketing Ops — Outreach Opener System with Dual Execution Path

**Document Version:** 1.0
**Date:** 2026-07-31
**Status:** Draft — Ready for Review
**Prerequisite:** Marketing Ops Sprint 1–4 complete (campaign pipeline, prompt workspace, deliverables, branding); Business Contact Details sprint landed (`phone`, `email`, `website_url`, `social_profiles` on campaigns); Seek Audit Integration sprint landed (`business_analysis` audits with structured `audit_data`); `aiProviderFactory` wired and operational via `MarketingExecutionService`.

This plan contains **one sprint** focused on building a dedicated Outreach Opener workspace that produces personalized first-touch openers from campaign audit data, with a dual execution path mirroring the existing Prompt Workspace (`/settings/admin/marketing-ops/prompts/[id]`).

---

## 1. Executive Summary

When a campaign reaches the `preview_built` stage, the operator needs a short, personalized first-touch opener to send alongside 3 previews. Today there is no tooling for this — operators write openers ad hoc, and the quality varies wildly. The opener is the single most important conversion artifact at the `preview_built → shown` transition: it establishes authority, credibility, and trust in the first 5 seconds by proving the operator actually studied the prospect's business.

This sprint builds a dedicated Outreach Opener workspace at `/settings/admin/marketing-ops/outreach` that:

1. **Deterministically selects an opener archetype** from the campaign's latest `business_analysis` audit data (no LLM needed for selection — pure function over structured JSON).
2. **Generates a personalized opener** via the wired AI provider (Path 1: Execute Opener), OR accepts an externally-generated opener pasted back (Path 2: Import External Opener) — mirroring the dual `Execute Prompt` / `Import External Result` pattern from the Prompt Workspace.
3. **Validates every opener** against a quality gate (word count, one-stat rule, forbidden-list check) before storing.
4. **Stores openers** in a new `mkt_outreach_openers_list` table with full provenance (archetype, extracted fields, source, quality gate result, AI provider/model/tokens/cost).
5. **Closes the loop** with a "Mark as sent" action that advances the campaign stage to `shown`.

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Deterministic archetype selection** | Pure function over `audit_data` selects one of 4 archetypes (A1: Review Response Gap, A2: Negative Review Recovery, A3: Listing Inconsistency, A4: Conversion/CTA Gap) — no LLM, no misclassification |
| **Per-archetype field extraction** | Each archetype extracts only the fields its prompt needs from `audit_data`, producing a focused payload for the LLM |
| **4 opener prompt templates** | One prompt per archetype, enforcing the opener anatomy (salutation + one punchy insight + preview reference + soft CTA + signoff) with a hard forbidden-list |
| **Dual execution path** | Path 1 (Execute Opener): deterministic select + LLM + quality gate. Path 2 (Import External Opener): deterministic select shows resolved prompt for external use, user pastes result back, quality gate runs |
| **Quality gate** | Automated checker: ≤85 words body, exactly one stat, no pricing/tier/opportunity-score jargon, no positive-infrastructure notes, theme/directory named specifically, salutation present, preview reference present, close present, no emojis/exclamation points |
| **Opener provenance storage** | `mkt_outreach_openers_list` records archetype, extracted_fields, opener_text, quality_gate_passed, quality_gate_issues, source, AI provider/model/tokens/cost |
| **Stage integration** | "Mark as sent" action updates campaign `stage='shown'`, `date_shown`, `last_touch_source` |

### Why now

The `preview_built` stage is where the operator contacts the prospect with previews. Without opener tooling, every operator writes their own, quality is inconsistent, and the personalized salutation (the part that establishes trust) is often skipped in favor of letting previews speak for themselves. Previews alone fail because the business owner doesn't know what they're looking at or why it matters. The opener is what converts data into urgency.

The `business_analysis` audit data is now structured JSON (landed by the Seek Audit Integration sprint), making deterministic archetype selection possible — no LLM needed for classification, only for opener text generation. The dual execution path pattern is already proven in the Prompt Workspace and can be mirrored directly.

**Sprint Duration:** 1 sprint (2 weeks)
**Team Size:** 1 full-stack developer

---

## 2. Strategy — Why the Opener Matters

### The opener anatomy (fixed across all archetypes)

1. **Salutation** — `Hi [name] —` (or `Hi [business_name] team —` if no contact name). Skipping it makes "short informal" read as "cold and lazy." The owner's name + business name in line one is what separates personalized outreach from spam.
2. **One punchy insight** — single most uncomfortable, specific, provable stat from the summary. Specific enough to prove research (themes, counts, directories named), never generic.
3. **Preview reference** — "Three previews attached…" + what they show.
4. **Soft CTA** — value already delivered; ask is implicit. "Full deliverable's ready within a day if any of it's useful."
5. **Signoff** — `— [your name]`

### What to leave out of the first message

- **Pricing / tier labels** ($750–$1,500/mo, "Tier 2") — mentioning price before they've asked makes it a transactional pitch. Let them ask.
- **"Digital opportunity score"** — internal jargon, sounds like a sales funnel label.
- **Positive infrastructure notes** (HTTPS-secured, mobile-friendly, CTAs working) — true and reassuring, but they dilute urgency. Save for the deliverable.
- **"Recommended for Tier 2 services"** — never tell a prospect which tier they've been sorted into. It's dehumanizing.

### Why previews alone fail

A screenshot of unanswered reviews reads as "here's some stuff about your business" without the "so what." The summary is what converts data into urgency. But the full audit summary is too long for a "short informal" first touch — it reads like an audit report, which triggers defensive scanning instead of curiosity. The opener distills the summary into one uncomfortable, specific, provable stat that demands a response.

---

## 3. Data Source — Campaign Audit Data

`GET /api/admin/marketing-ops/{campaign_id}` → `data.audits[].audit_data`

The `business_analysis` audit's `audit_data` is structured JSON. Key fields used for archetype selection and opener generation:

| Field | Path | Used for |
|---|---|---|
| Summary text | `audit_data.summary` | Fallback context for LLM |
| Combined metrics | `audit_data.combined_review_metrics` | A1/A2 selection + stat |
| Negative themes | `audit_data.negative_review_themes[]` | A2 theme extraction |
| Unanswered negative examples | `audit_data.unanswered_negative_review_examples[]` | A2 proof points |
| NAP consistency | `audit_data.nap_consistency` | A3 selection + stat |
| Website | `audit_data.website` | A4 selection + stat |
| Platforms | `audit_data.platforms.{google,yelp,facebook}` | A3 directory naming |
| Business name | `data.business_name` | Salutation |
| Contact info | `data.contact_info` / `data.phone` / `data.email` | Salutation (fallback to business name) |
| Tone | `data.tone` | Opener tone (default: "short informal") |

### Example audit_data shape (One Hour Heating & Air Conditioning, campaign `mcmp-z92khxgj`)

```json
{
  "combined_review_metrics": {
    "observable_unanswered_reviews": 178,
    "observable_unanswered_rate_percent": 28.3,
    "observable_unanswered_negative_reviews": 18
  },
  "negative_review_themes": [
    {
      "theme": "Pricing & Diagnostic Fees",
      "summary": "Customer concerns regarding diagnostic trip fees...",
      "observed_frequency": "medium",
      "supporting_review_count": 7
    },
    {
      "theme": "Scheduling & Wait Times",
      "summary": "Occasional customer feedback regarding arrival time windows...",
      "observed_frequency": "medium",
      "supporting_review_count": 6
    }
  ],
  "nap_consistency": {
    "overall_status": "minor_variations",
    "name_variations": ["One Hour Heating & Air Conditioning", "One Hour Heating & Air Conditioning of Indianapolis"],
    "address_variations": ["4040 Industrial Blvd, Indianapolis, IN 46254", "Serving Plainfield and Greater Indianapolis"]
  },
  "website": {
    "call_to_action_present": "yes",
    "click_to_call_available": "yes",
    "has_booking": false
  }
}
```

For this campaign, deterministic selection returns **A2** (Negative Review Recovery) because `negative_review_themes` has entries with `supporting_review_count >= 3` and `observable_unanswered_negative_reviews > 0`. A2 wins over A1 because the theme cluster is specific and pointed.

---

## 4. Archetype Selection — Deterministic Function

Selection runs as a pure function over `audit_data`. No LLM, no prompt needed.

```typescript
function selectArchetype(auditData: BusinessAnalysisAuditData): {
  archetype: 'A1' | 'A2' | 'A3' | 'A4';
  reason: string;
  theme?: NegativeReviewTheme;
} {
  const metrics = auditData.combined_review_metrics;
  const themes = auditData.negative_review_themes ?? [];
  const nap = auditData.nap_consistency;
  const website = auditData.website;

  // A2: recurring-theme negatives (highest priority — specificity + urgency wins)
  if (themes.length > 0
      && metrics.observable_unanswered_negative_reviews > 0
      && themes.some(t => t.supporting_review_count >= 3)) {
    return {
      archetype: 'A2',
      reason: `recurring-theme negatives: "${themes[0].theme}" (${themes[0].supporting_review_count} reviews)`,
      theme: themes[0],
    };
  }

  // A1: review response gap
  if (metrics.observable_unanswered_rate_percent >= 15
      || metrics.observable_unanswered_reviews > 15) {
    return {
      archetype: 'A1',
      reason: `review response gap: ${metrics.observable_unanswered_reviews} unanswered (${metrics.observable_unanswered_rate_percent}%)`,
    };
  }

  // A3: listing inconsistency
  if (nap && nap.overall_status !== 'consistent'
      && ((nap.name_variations?.length ?? 0) > 0
          || (nap.address_variations?.length ?? 0) > 1
          || (nap.phone_variations?.length ?? 0) > 1)) {
    return {
      archetype: 'A3',
      reason: `listing inconsistency: ${nap.overall_status}`,
    };
  }

  // A4: conversion / CTA gap
  if (website && (website.call_to_action_present === 'no'
                  || website.click_to_call_available === 'no'
                  || website.has_booking === false)) {
    return {
      archetype: 'A4',
      reason: `conversion/CTA gap: missing ${website.has_booking === false ? 'online booking' : 'CTA'}`,
    };
  }

  // Fallback: A1 with raw unanswered count
  return {
    archetype: 'A1',
    reason: `fallback: ${metrics?.observable_unanswered_reviews ?? 0} unanswered reviews`,
  };
}
```

**Selection priority:** `A2 > A1 > A3 > A4`
Specificity + urgency wins. A recurring-theme negative beats a raw volume gap; volume beats listing drift; listing drift beats a soft conversion gap.

---

## 5. Opener Prompts — One Per Archetype

Each prompt receives **structured fields** extracted from `audit_data` by `field-extractors.ts`, not the raw summary. The runner pre-extracts only what each archetype needs, so the LLM gets a focused payload.

### 5.1 Prompt A1 — Review Response Gap

**Runner extracts from audit_data:**
```json
{
  "business_name": "One Hour Heating & Air Conditioning",
  "contact_name": null,
  "tone": "short informal",
  "unanswered_total": 178,
  "unanswered_negatives": 18,
  "unanswered_rate_percent": 28.3,
  "platforms": ["Google", "Yelp", "Facebook"],
  "newest_unanswered_date": "2026-07-20"
}
```

**Prompt:**
```
You are writing a cold first-touch outreach opener to a small business owner.

Inputs (JSON):
{{extracted_fields}}

Task: Write the opener in this exact structure, ~80 words max body:

1. Greeting: "Hi [contact_name] —" if contact_name is present.
   Otherwise: "Hi [business_name] team —"

2. One sentence: name the business + that you pulled a quick
   visibility snapshot. Form: "Pulled together a quick visibility
   snapshot for [business_name]."

3. The hook (ONE stat only):
   - Use unanswered_total + unanswered_negatives.
   - Express rate as "roughly 1 in N reviews going silent" only if
     (100 / unanswered_rate_percent) rounds cleanly to a whole number
     ≤ 10. Otherwise use the raw count.
   - If unanswered_negatives > 0, append: "including [N] negatives."
   - Do NOT name the platforms in the hook — save that for the previews.

4. One line: "Three previews attached showing exactly where the gaps
   are and what fixed responses look like."

5. Close: "Full deliverable's ready within a day if any of it's useful."

6. Signoff: "— [your name]"

Forbidden: pricing, tier labels, "digital opportunity score",
HTTPS/mobile/CTA positives, multiple stats stacked, generic phrasing
("your online presence"), exclamation points, emojis, naming more
than one number in the hook.

Output the opener only — no preamble, no explanation, no JSON.
```

### 5.2 Prompt A2 — Negative Review Recovery

**Runner extracts from audit_data:**
```json
{
  "business_name": "One Hour Heating & Air Conditioning",
  "contact_name": null,
  "tone": "short informal",
  "theme": "Pricing & Diagnostic Fees",
  "theme_summary": "Customer concerns regarding diagnostic trip fees and labor cost breakdowns on emergency repair visits.",
  "theme_review_count": 7,
  "secondary_theme": "Scheduling & Wait Times",
  "secondary_theme_review_count": 6,
  "unanswered_negatives": 18,
  "example_complaint": "Customer expressed dissatisfaction over diagnostic trip fee charges when initial service estimate was higher than anticipated.",
  "example_platform": "Google Business Profile",
  "example_date": "2024-02-10"
}
```

**Prompt:**
```
You are writing a cold first-touch outreach opener to a small business owner.

Inputs (JSON):
{{extracted_fields}}

Task: Write the opener, ~80 words max body:

1. Greeting: "Hi [contact_name] —" if present.
   Otherwise: "Hi [business_name] team —"

2. One sentence: "Pulled together a quick visibility snapshot for
   [business_name]."

3. The hook — LEAD WITH THE THEME, not the volume:
   "A cluster of [theme_review_count] negative reviews all point at
   the same thing — [theme, phrased in plain language a business
   owner would use, NOT the audit's internal label]."
   Then: "and they're sitting unanswered."

   Rewrite the theme in conversational language. "Pricing & Diagnostic
   Fees" becomes "trip fees and pricing surprises." "Scheduling & Wait
   Times" becomes "arrival windows running late." Never use the raw
   audit category name.

   If a secondary_theme exists with supporting_review_count >= 3,
   you may append one clause: " — and a second cluster around
   [secondary theme, also rephrased]."

4. One line: "Three previews attached — the review cluster, drafted
   responses that turn each one around, and the recovery playbook."

5. Close: "Full deliverable's ready within a day if any of it's useful."

6. Signoff: "— [your name]"

Forbidden: leading with the count before the theme, using the raw
audit theme label verbatim, pricing/tier/opportunity-score jargon,
HTTPS/mobile positives, exclamation points, emojis.

Output the opener only.
```

### 5.3 Prompt A3 — Listing Inconsistency

**Runner extracts from audit_data:**
```json
{
  "business_name": "...",
  "contact_name": null,
  "tone": "short informal",
  "canonical_name": "One Hour Heating & Air Conditioning of Indianapolis",
  "name_variations": ["One Hour Heating & Air Conditioning", "One Hour Heating & Air Conditioning of Indianapolis"],
  "address_variations": ["4040 Industrial Blvd, Indianapolis, IN 46254", "Serving Plainfield and Greater Indianapolis"],
  "phone_variations": ["317-795-0373"],
  "platforms_with_listings": ["Google Business Profile", "Yelp", "Facebook"],
  "overall_status": "minor_variations"
}
```

**Prompt:**
```
You are writing a cold first-touch outreach opener to a small business owner.

Inputs (JSON):
{{extracted_fields}}

Task: Write the opener, ~80 words max body:

1. Greeting as above.
2. One sentence: "Pulled together a quick visibility snapshot for
   [business_name]."
3. The hook: "Your business shows up [N] different ways across
   [list 2-3 platforms from platforms_with_listings] — [name the
   specific variation: different addresses / different names /
   different phone numbers]."
   Then the consequence: "customers are being sent to the wrong pin."
   Pick the variation type that has the most entries
   (address_variations vs name_variations vs phone_variations).
4. One line: "Three previews attached — the directory diff, the
   corrected listing, and what synced looks like across every
   platform."
5. Close + signoff as above.

Forbidden: vague "your listings are inconsistent" without naming
the platforms or the specific variation, pricing/tier jargon,
exclamation points, emojis.

Output the opener only.
```

### 5.4 Prompt A4 — Conversion / CTA Gap

**Runner extracts from audit_data:**
```json
{
  "business_name": "...",
  "contact_name": null,
  "tone": "short informal",
  "missing_cta": "online_booking",
  "website_url": "https://...",
  "conversion_opportunities": ["Implement automated SMS text-back widget...", "Add prominent localized..."]
}
```

**Prompt:**
```
You are writing a cold first-touch outreach opener to a small business owner.

Inputs (JSON):
{{extracted_fields}}

Task: Write the opener, ~80 words max body:

1. Greeting as above.
2. One sentence: "Pulled together a quick visibility snapshot for
   [business_name]."
3. The hook: "Your site's getting traffic but there's no
   [online booking / click-to-call / scheduling] button — every
   visitor has to call during business hours to become a customer."
   Use the missing_cta field to pick the exact gap. If
   conversion_opportunities has a relevant entry, you may reference
   it in plain language (not the audit's internal phrasing).
4. One line: "Three previews attached — the CTA audit, proposed
   placements, and what the booking flow looks like."
5. Close + signoff as above.

Forbidden: listing every missing CTA — pick the one highest-impact
gap, pricing/tier jargon, exclamation points, emojis.

Output the opener only.
```

---

## 6. Quality Gate

Automated checker applied to every generated opener (both paths).

```typescript
interface QualityGateResult {
  passed: boolean;
  issues: string[];
}

function runQualityGate(openerText: string): QualityGateResult {
  const issues: string[] = [];
  const body = openerText.replace(/^Hi .+—\s*/m, '').replace(/—\s*\[your name\]\s*$/, '').trim();
  const words = body.split(/\s+/);

  // Word count
  if (words.length > 85) issues.push(`Body exceeds 85 words (${words.length})`);

  // One stat rule — count standalone numbers (not dates/years)
  const numbers = body.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  const stats = numbers.filter(n => !n.match(/^(20\d{2}|19\d{2})$/)); // exclude years
  if (stats.length > 1) issues.push(`More than one stat in hook: ${stats.join(', ')}`);

  // Forbidden terms
  const forbidden = [
    /\$[\d,]+/, /tier\s*\d/i, /digital opportunity score/i,
    /HTTPS/i, /mobile-friendly/i, /SSL/i,
    /recommended (for )?tier/i, /estimated.*fee/i, /monthly service/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(openerText)) issues.push(`Forbidden term: ${pattern.source}`);
  }

  // Required elements
  if (!/^Hi .+/m.test(openerText)) issues.push('Missing salutation');
  if (!/three previews attached/i.test(openerText)) issues.push('Missing preview reference');
  if (!/full deliverable.*within a day/i.test(openerText)) issues.push('Missing close');
  if (/!/.test(openerText)) issues.push('Exclamation point present');
  if (/[\u{1F300}-\u{1F9FF}]/u.test(openerText)) issues.push('Emoji present');

  return { passed: issues.length === 0, issues };
}
```

---

## 7. Dual Execution Path — UX Mirror

Mirrors the Prompt Workspace at `/settings/admin/marketing-ops/prompts/[id]` (<ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\web\src\app\(platform)\settings\admin\marketing-ops\prompts\[id]\PromptWorkspaceClient.tsx" />).

### Path 1 — Execute Opener (blue button, left panel)
1. User selects campaign from dropdown (filtered to `scope='business'` campaigns with a `business_analysis` audit)
2. `archetype-selection.ts` runs deterministically over `audit_data` → archetype + extracted fields
3. `archetype-prompts.ts` fills the archetype prompt with extracted fields
4. `aiProviderFactory.generateChatCompletion()` runs the prompt (same factory as `MarketingExecutionService` at <ref_snippet file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\src\services\MarketingExecutionService.ts" lines="140-147" />)
5. `quality-gate.ts` validates the output
6. Stored as `mkt_outreach_openers_list` record: `source='ai'`, `archetype`, `quality_gate_passed`, `opener_text`, `extracted_fields`, `ai_provider`, `ai_model`, `tokens_used`, `cost_cents`

### Path 2 — Import External Opener (violet button, textarea, right panel)
1. User selects campaign (same dropdown)
2. Workspace shows the **resolved archetype prompt** (deterministic selection still runs — user needs to know which prompt to paste externally) with Copy/Download
3. User runs prompt in ChatGPT/Claude, pastes opener text back
4. `quality-gate.ts` validates the pasted text (same checks)
5. Stored with `source='external'`, `archetype` (from step 2), `quality_gate_passed`, `opener_text`

**Key difference from Prompt Workspace import:** the import path here imports **plain text** (the opener), not JSON. Validation is the quality gate, not a JSON schema. The archetype is already known from deterministic selection — no need for the external agent to declare it.

---

## 8. Page Layout (Two-Column, Mirrors PromptWorkspaceClient)

### Left Column
- **Campaign Selector** — dropdown of `scope='business'` campaigns with a `business_analysis` audit
- **Detected Archetype** — read-only display: archetype code + one-line reason (e.g. "A2 — recurring-theme negatives: 'Pricing & Diagnostic Fees' (7 reviews)")
- **Extracted Fields** — read-only JSON preview of fields passed to the prompt (transparency — user sees what the LLM gets)
- **Execute Opener** button (blue) — runs Path 1

### Right Column
- **Resolved Prompt** — archetype-specific prompt with extracted fields filled in; Copy/Download buttons (feeds Path 2)
- **Opener Result** — collapsible panel: last opener text + quality gate pass/fail + archetype + source (ai/external)
- **Import External Opener** — textarea + violet "Import Opener" button; runs quality gate on paste
- **Next Steps** — link to campaign page + "Mark as sent" action (updates campaign `stage='shown'`, `date_shown`, `last_touch_source`)

---

## 9. Data Model — `mkt_outreach_openers_list`

Mirrors `mkt_prompt_executions_list` shape (<ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\prisma\schema.prisma" />).

| Column | Type | Notes |
|---|---|---|
| `id` | varchar(255) | `mop-` prefix |
| `campaign_id` | varchar(255) | FK to `mkt_campaigns_list` |
| `archetype` | varchar(10) | A1/A2/A3/A4 |
| `opener_text` | text | Generated opener |
| `quality_gate_passed` | boolean | Quality gate result |
| `quality_gate_issues` | json | Array of failed check strings |
| `source` | varchar(20) | `ai` or `external` |
| `ai_provider` | varchar(50) | nullable |
| `ai_model` | varchar(100) | nullable |
| `tokens_used` | integer | nullable |
| `cost_cents` | integer | nullable |
| `extracted_fields` | json | Fields passed to prompt (audit provenance) |
| `executed_by` | varchar(255) | nullable |
| `executed_at` | timestamptz | default now() |

---

## 10. File Structure

```
tools/outreach/
  OpenerWorkspaceClient.tsx     ← UI (mirrors PromptWorkspaceClient.tsx)
  archetype-selection.ts         ← deterministic selection (pure function, no LLM)
  archetype-prompts.ts           ← 4 prompt templates (A1-A4)
  field-extractors.ts            ← per-archetype field extraction from audit_data
  quality-gate.ts                ← forbidden-list + word-count + one-stat checker
  OutreachOpenerService.ts       ← backend service (mirrors MarketingPromptService)
  README.md                      ← how it works
```

---

## 11. API Routes (added to `marketing-ops.ts`)

```
POST   /outreach/execute          — Path 1 (deterministic select + LLM + quality gate)
POST   /outreach/import           — Path 2 (quality gate on pasted text)
GET    /outreach?campaignId=X     — list openers for a campaign
GET    /outreach/:id              — single opener
```

<ref_file file="C:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\apps\api\src\routes\marketing-ops.ts" />

---

## 12. Sprint Phases

| Phase | Task | Output |
|---|---|---|
| 1 | `tools/outreach/` core logic: `archetype-selection.ts`, `archetype-prompts.ts`, `field-extractors.ts`, `quality-gate.ts` | Pure functions, testable in isolation |
| 2 | Prisma model `mkt_outreach_openers_list` + migration | Schema |
| 3 | `OutreachOpenerService.ts` (execute + import + list + quality gate integration) | Backend service |
| 4 | API routes in `marketing-ops.ts` | Endpoints |
| 5 | `OpenerWorkspaceClient.tsx` (mirror PromptWorkspaceClient layout) | UI |
| 6 | Wire page at `/settings/admin/marketing-ops/outreach` | Route |
| 7 | Test on One Hour Heating (`mcmp-z92khxgj`, archetype A2) — both paths | Validation |
| 8 | Find/test A1, A3, A4 campaigns | Coverage |
| 9 | Tune prompts from quality gate failures | Prompt set v2 |
| 10 | "Mark as sent" → campaign stage integration (`stage='shown'`, `date_shown`, `last_touch_source`) | Stage flow |

---

## 13. Dependencies & Reuse

| Component | Reused From | Path |
|---|---|---|
| AI provider factory | `MarketingExecutionService` | `apps/api/src/services/ai-providers` (via `aiProviderFactory.generateChatCompletion()`) |
| Dual execution UX pattern | `PromptWorkspaceClient` | `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx` |
| Campaign fetch + audit access | `MarketingCampaignService.getCampaign()` | `apps/api/src/services/MarketingCampaignService.ts` |
| Page shell + breadcrumbs | `MarketingOpsPageShell` | `apps/web/src/components/marketing-ops/MarketingOpsPageShell.tsx` |
| Web service layer | `MarketingOpsService` | `apps/web/src/services/MarketingOpsService.ts` |
| ID generation | `generateMarketingAuditId` pattern | `apps/api/src/lib/id-generator.ts` (add `generateOutreachOpenerId`) |
| Base service pattern | `BaseService` singleton | `apps/api/src/services/BaseService.ts` |
| Logger | `logger` | `apps/api/src/logger.ts` |

---

## 14. Open Questions

1. **A3/A4 test campaigns** — Need campaign IDs where listing inconsistency or missing CTAs are the primary signal. One Hour Heating is a clean A2. Need to validate all four archetype paths before locking prompts.
2. **Tone field** — `data.tone` is currently null on most campaigns. Should the workspace default to "short informal" universally, or should tone be set per-campaign before opener generation?
3. **Preview pairing** — The opener references "Three previews attached" but the actual preview generation/pairing is a separate system. Should this sprint also wire the archetype → preview-pairing map, or is that a follow-up sprint?
4. **"Mark as sent" stage transition** — Should this be gated on `quality_gate_passed=true`, or allow sending even failed-gate openers (with a warning)?
