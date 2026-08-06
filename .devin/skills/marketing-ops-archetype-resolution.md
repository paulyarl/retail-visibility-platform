---
description: Marketing Ops archetype resolution pattern — shared resolver, A6 product-visibility archetype, and deliverable/pitch branching. Covers resolveCampaignArchetype, selectArchetype, triage-accepted precedence, and the A1–A6 archetype union.
---

# Marketing Ops — Archetype Resolution Pattern

The Marketing Ops module routes campaigns through a 6-archetype system (A1–A6) that determines opener framing, deliverable sections, pitch header/closer content, and follow-up sequences. This skill documents the resolution pattern and the Sprint 2 product-visibility extension.

---

## Archetype Union (A1–A6)

| Code | Name | Business type | Primary signal |
|------|------|---------------|----------------|
| A1 | Review Response Gap | Universal | High unanswered review rate |
| A2 | Negative Review Recovery | Universal | Recurring negative review themes |
| A3 | Listing Inconsistency | Universal | NAP drift across platforms |
| A4 | Conversion / CTA Gap | Universal | Missing website CTAs |
| A5 | Multi-Signal Footprint | Universal | Dual-signal (triage-only, selectArchetype never returns A5) |
| A6 | Product Visibility Gap | Product/Hybrid | Missing product browsing, photos, availability inquiry |

**Key files:**
- `apps/api/src/services/outreach-openers/archetype-selection.ts` — `selectArchetype(auditData)` deterministic selector (A2 > A1 > A6 > A3 > A4 priority)
- `apps/api/src/services/triage/types.ts` — `ArchetypeCodeWithA6` union, `ARCHETYPE_LABELS`, `PLAYBOOK_CODES`
- `apps/api/src/services/OutreachOpenerService.ts` — `resolveCampaignArchetype(campaignId, ctx)` shared resolver

---

## Shared Archetype Resolver (Sprint 2)

**Problem:** The campaign has no persisted archetype column. Every consumer (opener, header, closer, deliverable sections, render service) independently called `selectArchetype(auditData)`, which diverged from the operator-accepted triage result.

**Solution:** `resolveCampaignArchetype(campaignId, ctx)` centralizes the resolution:

```
Precedence:
  1. Operator-accepted triage result's playbook archetype (honors overrides)
  2. selectArchetype(latestAuditData) fallback
```

Returns `{ archetype, source: 'triage' | 'fallback', reason }`.

**Consumers:**
- `DeliverableSectionService.generateAllSections` — branches on A6 (5 product sections) vs A1–A5 (condition-based)
- `DeliverableRenderService.renderDeliverable` — A6 → `product_visibility_preview`; A1–A5 → `review_responses`
- `HeaderService.resolveHeader` — A6 → product-visibility preamble; A1–A5 → review-management preamble
- `CloserService.resolveCloser` — A6 → product-visibility closer; A1–A5 → review-management closer
- `OutreachOpenerService.executeOpener` — uses the same logic inline (needs the theme for A2, which the shared helper doesn't return)

**Mocking pattern for tests:** `CampaignTriageService` exports the singleton instance (`export default CampaignTriageService.getInstance()`), so mock it as:
```typescript
vi.mock('../CampaignTriageService', () => ({
  default: {
    getTriageResult: mockTriageGetResult,
  },
}));
```
Not as `{ default: { getInstance: () => ({...}) } }` — that creates a double-wrapped mock that the real import doesn't match.

---

## A6 Product-Visibility Sections

When `resolveCampaignArchetype` returns A6, `DeliverableSectionService.generateAllSections` generates all 5 product-visibility sections (skipping the review-management sections):

| SectionType | Title | sectionIndex | Prompt builder |
|-------------|-------|--------------|----------------|
| `mobile_catalog_preview` | Mobile Catalog Preview | 400 | `buildMobileCatalogPrompt` |
| `gbp_photo_optimization` | GBP Photo Optimization | 500 | `buildGbpPhotoOptimizationPrompt` |
| `availability_inquiry_flow` | Availability Inquiry Flow | 600 | `buildAvailabilityInquiryFlowPrompt` |
| `fulfillment_pathway` | Fulfillment Pathway | 700 | `buildFulfillmentPathwayPrompt` |
| `hours_sync_plan` | Hours Sync Plan | 800 | `buildHoursSyncPlanPrompt` |

For A3/A5 product/hybrid businesses, `hours_sync_plan` is also generated. For A4 product/hybrid, `availability_inquiry_flow` is generated. Service-business deliverables are byte-identical to pre-Sprint-2 behavior.

---

## Pitch Prompt Branching

`outreach-pitch/prompts.ts` has two persona preambles:
- `PERSONA_PREAMBLE` — review-management framing (A1–A5): "customer reviews are going unanswered"
- `PERSONA_PREAMBLE_A6` — product-visibility framing: "customers cannot see the store or its products before visiting"

Use `buildHeaderPromptForArchetype(archetype, fields)` and `buildCloserPromptForArchetype(archetype, fields, remaining)` — they branch on A6 automatically. Legacy `buildHeaderPrompt` / `buildCloserPrompt` still work (review-management framing only).

**Test gotcha:** The A6 closer template has line breaks in phrases like "Do NOT\nreference reviews or booking" and "product\nvisibility plan". Normalize whitespace in assertions: `prompt.replace(/\n/g, ' ')`.

---

## Business Type Resolution

`MarketingBusinessTypeService.resolveBusinessType(auditData)` classifies as `service`, `product`, `hybrid`, or `null` (unable to verify). Precedence:
1. Agent-emitted `auditData.business_type` field (if valid)
2. Category → business_type mapping from `mkt_business_type_categories` table
3. `null` (graceful degradation — signal extractor is null-safe)

`isProductOrHybrid(type)` returns `true` for `product` or `hybrid`, `false` for `service` or `null`.

---

## Common Pitfalls

1. **A5 is triage-only.** `selectArchetype` never returns A5 — it's the dual-signal archetype that only fires when the triage engine detects multiple signals. Don't add A5 to `selectArchetype`; it comes from the triage result via `resolveCampaignArchetype`.

2. **A6 priority is below A1/A2.** A product business with high unanswered review rate routes to A1, not A6. A6 only fires when the review signals are absent or low. This is intentional — review problems are more urgent than visibility gaps.

3. **Co-occurrence cascade (PB-07 vs PB-02).** PB-02's `none` set was extended to exclude product-visibility codes. A grocery store with low review volume AND a missing product catalog routes to PB-07, not PB-02. See `TriageEngineSprint1CoOccurrence.test.ts`.

4. **Seed templates are idempotent upserts.** Re-running `pnpm seed:mkt-templates` updates existing templates (0 created, N updated). Custom template copies made via the workspace UI are NOT updated — only the seeded IDs.

5. **`BUSINESS_ANALYSIS_PROMPT_SUFFIX` is appended at validation time, not render time.** The suffix documents field formats but doesn't ask the AI to capture them. The actual "please provide these fields" instruction lives in the template body. Custom template copies that weren't re-seeded won't ask for new fields even though the suffix will accept them.
