# GBP Authorized Management Suite — Sprint Plan: Phase 2

**Spec:** `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md`
**Scope:** Phase 2 — Review Intelligence & Tier A Reply Engine
**Prerequisite:** Phase 1 complete (OAuth + verification flow, dashboard shell, `GBPVerificationService`)
**Status:** Planning

---

## Sprint Goal

Deliver the **core review management value prop**: ingest Google reviews hourly, surface them in the customer portal, generate three tone-aware AI draft responses per review (Tier A), and enable the merchant to publish replies — all human-in-the-loop.

Phase 2 produces:
1. `gbpReviewIngestion.ts` hourly cron — polls `reviews.list`, upserts into `gbp_reviews`, refreshes cached aggregate rating
2. `GBPReviewReplyService.generateDrafts` — Tier A only (3 angle-variant drafts per review)
3. New GBP prompt builder (`apps/api/src/services/gbp/prompts.ts`)
4. Review inbox UI at `/account/marketing/gbp/reviews`
5. `gbp_new_review` CRM alerts
6. Dispute bridge → `DisputeIntakeService` (`intake_kind = 'review_dispute'`)
7. 4 customer-facing API endpoints (reviews list, reply, AI draft, dispute)

**Tier B autopilot is NOT invoked in Phase 2.** The `runAutopilot` method may be implemented but must not be wired to any job. Phase 2.5 gates Tier B activation.

---

## Pre-Flight Checklist

### Skills to read
| Skill | Why |
|---|---|
| `marketing-ops-category-tone.md` | Category tone preset service — secondary tone source |
| `alerts-and-notifications.md` | `gbp_new_review` CRM alert creation |
| `capability-deployment-flow.md` | `gbp_ai_response` entitlement gate (feature key registered in Phase 4, but gate logic needed now) |
| `bsaas-purchase-flow.md` | Draft-preview mode when unentitled (§8.1 row 7) |

### Phase 1 handoff verification
- [ ] `/account/marketing/gbp/` dashboard renders with verification status
- [ ] `gbp_locations_list.verification_state` is populated for linked tenants
- [ ] `cached_average_rating` + `cached_review_count` columns exist (migration 237)
- [ ] `gbp_reviews` has `location_id`, `reply_status`, `ai_drafts`, `sentiment` columns (migration 238)
- [ ] `star_rating` is `Int` (migration 238 + `GBPAdvancedSync.storeReviews` updated in Phase 0)

---

## Task Breakdown

### Task 1: `gbpReviewIngestion.ts` Cron Job
**File:** `apps/api/src/jobs/gbpReviewIngestion.ts`
**Spec ref:** §4 Subsystem 2 + §9 Phase 2

**Pattern:** model after `gbpHoursSync.ts` (existing hourly GBP job)

**Behavior:**
1. Query all tenants with a linked GBP location (`google_oauth_accounts_list` exists + `gbp_locations_list` exists)
2. For each tenant, call `GBPAdvancedSync.listReviews(tenantId)` — this hits Google's `reviews.list` API and calls `storeReviews()` which upserts into `gbp_reviews`
3. Refresh `gbp_locations_list.cached_average_rating` + `cached_review_count` + `rating_cache_updated` from the `averageRating` / `totalReviewCount` fields Google returns alongside the review list
4. Tag sentiment on new/updated reviews (simple positive/neutral/negative based on star_rating + comment text)
5. Set `reply_status = 'PUBLISHED'` for reviews where `is_replied = true` and `reply_status = 'NONE'`
6. Fire `gbp_new_review` CRM alert for each new review (reviews not previously in `gbp_reviews`)

**Schedule:** hourly cron — wired in `index.ts` startup alongside existing `gbpHoursSync.ts`

**Sentiment tagging:** v1 uses simple rule-based sentiment (star_rating ≤ 2 → negative, 3 → neutral, ≥ 4 → positive; comment text can refine). No external sentiment API in v1.

---

### Task 2: GBP Prompt Builder
**File:** `apps/api/src/services/gbp/prompts.ts`
**Spec ref:** §4 Subsystem 2 Tier A + tone source hierarchy

**Function:**
```ts
export function buildGbpReviewReplyPrompt(input: {
  reviewerName: string;
  starRating: number;  // 1–5 (Int, post-migration 238)
  comment: string | null;
  reviewTime: string | null;
  businessName: string;
  businessCategory: string;
  ownerVoiceProfile: OwnerVoiceProfile | null;  // PRIMARY tone source
  categoryTonePreset: CategoryTonePreset | null; // SECONDARY augmentation
  campaignTone: string | null;                   // FALLBACK
}): string;
```

**Tone source hierarchy (per spec):**
1. **Owner voice profile** (from `OwnerVoiceService.getProfile`) — PRIMARY
2. **Category tone preset** (from `MarketingCategoryToneService.getPresetByCategory`) — SECONDARY, augments voice
3. **Campaign tone** — FALLBACK if voice profile unavailable

**Output spec:** single LLM call producing 3 distinct drafts:
- Draft 1: warm/direct
- Draft 2: professional/concise
- Draft 3: empathetic/detailed

**Sentiment-aware rules (in prompt):**
- 5★ + comment: mention what was praised
- 5★ no comment: genuine thanks with business/category context (NOT generic template)
- 3–4★: acknowledge feedback + improvement
- 1–2★: apologize, don't argue, name a fix where appropriate, redirect offline

**Category guardrails (in prompt):**
- Medical: do not discuss health details publicly
- Legal: do not discuss case details publicly
- Food/restaurant: can reference menu/service experience
- Retail: can reference products and staff assistance

**Why a dedicated builder (not reusing existing prompts):** the existing `outreach-pitch/prompts.ts` and `deliverable/prompts.ts` have different input shapes (campaign context, not live review context) and different output shapes (single deliverable, not 3 angle-variant drafts). The GBP prompt is purpose-built for live review response.

---

### Task 3: `GBPReviewReplyService`
**File:** `apps/api/src/services/GBPReviewReplyService.ts`
**Spec ref:** §4 Subsystem 2 Tier A

**Base class:** `BaseService`

**Methods:**
```ts
class GBPReviewReplyService extends BaseService {
  /**
   * Tier A: Generate 3 contextual tone-aware AI draft responses.
   * Stores drafts in gbp_reviews.ai_drafts (JSONB array of 3 drafts).
   * Sets reply_status = 'AI_DRAFTED'.
   * Gated by gbp_ai_response capability (draft-preview mode when unentitled).
   */
  async generateDrafts(tenantId: string, reviewId: string): Promise<AiDraft[]>;

  /**
   * Tier B: Autopilot — IMPLEMENTED but NOT INVOKED in Phase 2.
   * Wired in Phase 2.5 after quality gate.
   */
  async runAutopilot(tenantId: string): Promise<void>;
}
```

**`generateDrafts` flow:**
1. Load review from `gbp_reviews` (by reviewId + tenantId — cross-customer isolation via bridge)
2. Load owner voice profile from `OwnerVoiceService.getProfile(tenantId)`
3. Load category tone preset from `MarketingCategoryToneService.getPresetByCategory(category)`
4. Load business context from `BusinessContextService`
5. Build prompt via `buildGbpReviewReplyPrompt()`
6. Single LLM call → parse 3 drafts
7. Store drafts in `gbp_reviews.ai_drafts` as JSONB: `[{ angle: 'warm_direct', text: '...' }, { angle: 'professional_concise', text: '...' }, { angle: 'empathetic_detailed', text: '...' }]`
8. Set `gbp_reviews.reply_status = 'AI_DRAFTED'`
9. Return drafts to caller

**Entitlement gate:** check `gbp_ai_response` capability on the tenant. If unentitled, return a single preview draft (draft-preview mode) with an upgrade CTA. Full 3-draft generation requires the entitlement. (The feature key is registered in Phase 4, but the gate logic must work now — it checks `features.gbp_ai_response` which will be false until Phase 4 registration. This is correct: Phase 2 delivers the service, Phase 4 delivers the entitlement.)

---

### Task 4: Wire 4 Customer Endpoints
**File:** `apps/api/src/routes/gbp-customer.ts` (modify — replace Phase 1 stubs)
**Spec ref:** §8.1 rows 5–8

| Method | Route | Delegates to | Gate |
|---|---|---|---|
| `GET` | `/reviews` | `gbp_reviews` query (paginated, filter by rating/sentiment/reply_status) | Customer JWT + Platform Context |
| `POST` | `/reviews/:id/reply` | `GBPAdvancedSync.replyToReview` + update `reply_status = 'PUBLISHED'` | Customer JWT + Platform Context |
| `POST` | `/reviews/:id/ai-draft` | `GBPReviewReplyService.generateDrafts` | Customer JWT + Platform Context + `gbp_ai_response` (draft-preview when unentitled) |
| `POST` | `/reviews/:id/dispute` | `DisputeIntakeService.submitRegistryIntake` (`intake_kind = 'review_dispute'`) | Customer JWT + Platform Context |

**Reviews list query:** served from `gbp_reviews` (not live Google API call) — the ingestion cron keeps it fresh. Supports pagination + filters (by star_rating, sentiment, reply_status).

---

### Task 5: Frontend Service Methods
**File:** `apps/web/src/services/MarketingCustomerService.ts` (modify)
**New methods:**
```ts
listReviews(params?: { page?, rating?, sentiment?, replyStatus? }): Promise<ReviewsListResponse>;
replyToReview(reviewId: string, comment: string): Promise<{ success: boolean }>;
generateAiDraft(reviewId: string): Promise<AiDraft[]>;
disputeReview(reviewId: string, payload: DisputePayload): Promise<{ success: boolean }>;
```

---

### Task 6: Review Inbox UI
**Files:**
- `apps/web/src/app/account/marketing/gbp/reviews/page.tsx` — review inbox
- `apps/web/src/app/account/marketing/gbp/reviews/ReviewCard.tsx` — single review card
- `apps/web/src/app/account/marketing/gbp/reviews/AiDraftPicker.tsx` — 3-draft picker modal

**Review inbox contents:**
- **Filter bar** — by star rating (1–5), sentiment (positive/neutral/negative), reply status (none/drafted/published/disputed)
- **Review cards** — reviewer name, photo, star rating, comment, date, reply status badge, existing reply (if any)
- **Actions per review:**
  - "Generate AI Drafts" → calls `generateAiDraft` → opens `AiDraftPicker` showing 3 drafts
  - "Reply" → text editor for manual reply (or pick from AI drafts → edit → publish)
  - "Dispute" → opens dispute intake form (reuses `IntakeFormRenderer` with `intake_kind = 'review_dispute'`)
- **Aggregate rating header** — `cached_average_rating` + `cached_review_count` from `/status`

**AI Draft Picker:**
- Shows 3 drafts side-by-side with angle labels (Warm/Direct, Professional/Concise, Empathetic/Detailed)
- Merchant selects one → can edit → publishes via `replyToReview`
- If unentitled (`gbp_ai_response` not active): shows 1 preview draft + upgrade CTA

---

### Task 7: `gbp_new_review` CRM Alerts
**File:** `apps/api/src/jobs/gbpReviewIngestion.ts` (in Task 1)
**Spec ref:** §4 Subsystem 2 + `alerts-and-notifications.md`

**On each new review detected by the ingestion cron:**
- Create a `crm_alerts` row with `tenant_id = PLATFORM_SCOPE`, `type = 'gbp_new_review'`
- Include review metadata in `alert.metadata` (reviewer name, star rating, snippet)
- Customer sees it in `/account/marketing/alerts`

---

### Task 8: Dispute Bridge
**File:** `apps/api/src/services/DisputeIntakeService.ts` (reuse existing — no new infrastructure)
**Spec ref:** §4 Subsystem 2 + `INTAKE_PORTAL_GENERALIZATION_PLAN.md`

**Pattern:** the dispute intake system is already registry-driven (migration 173). Adding `review_dispute` as an `intake_kind` requires:
1. A `mkt_intake_definitions` row for `intake_kind = 'review_dispute'` (SQL seed)
2. The `POST /reviews/:id/dispute` endpoint calls `DisputeIntakeService.submitRegistryIntake` with the review context
3. Frontend renders the dispute form via `IntakeFormRenderer` (existing generic renderer)

---

### Task 9: Unit Tests
**File:** `apps/api/src/services/__tests__/GBPReviewReplyService.test.ts`
**Spec ref:** §10 quality gate #4 (Tier A)

**Test cases:**
1. Owner voice profile is the primary tone source (assert prompt includes `ownerVoiceProfile` content)
2. Category tone preset augments (assert prompt includes `categoryTonePreset` content)
3. Tier A produces exactly 3 drafts
4. Drafts have distinct angles (warm_direct, professional_concise, empathetic_detailed)
5. Drafts are review-grounded (assert prompt includes reviewer name + comment text when available)
6. Sentiment-aware: 5★ no-comment → genuine thanks + business name (not generic)
7. Sentiment-aware: 1-2★ → offline redirect present in prompt
8. Category guardrails: medical → no health details publicly in prompt
9. `gbp_ai_response` entitlement gates draft generation (unentitled → preview mode)
10. Drafts stored in `gbp_reviews.ai_drafts` as JSONB
11. `reply_status` set to `AI_DRAFTED` after generation
12. `runAutopilot` exists but is NOT invoked by any Phase 2 job

**File:** `apps/api/src/tests/gbp-customer-routes.test.ts` (extend)
**New test cases:**
13. `GET /reviews` — returns 200 with paginated reviews
14. `POST /reviews/:id/reply` — returns 200, updates `reply_status`
15. `POST /reviews/:id/ai-draft` — returns 200 with 3 drafts (entitled) / 1 preview (unentitled)
16. `POST /reviews/:id/dispute` — returns 200, creates intake record

---

## Task Dependency Graph

```
Task 1 (ingestion cron) ──── Task 7 (alerts, integrated into Task 1)
Task 2 (prompt builder) ──┐
                          ├── Task 3 (GBPReviewReplyService) ── Task 4 (endpoints) ── Task 9 (tests)
Task 8 (dispute seed) ────┘                                         │
Task 5 (frontend methods) ─────────────────────────────────────────┤
Task 6 (review inbox UI) ──────────────────────────────────────────┘
```

**Critical path:** Task 2 → Task 3 → Task 4 → Task 9

---

## Verification Gates

| Gate | Must pass |
|---|---|
| Ingestion cron runs hourly | `gbpReviewIngestion.ts` executes without error, upserts reviews |
| Cached aggregate refreshed | `cached_average_rating` + `cached_review_count` updated after ingestion |
| Tier A draft generation | 3 drafts with distinct angles, review-grounded, sentiment-aware |
| Owner voice primary | Prompt includes owner voice profile content before category tone |
| Category guardrails | Medical/legal category guardrails present in prompt |
| Entitlement gate | Unentitled → preview mode; entitled → 3 drafts |
| `reply_status` transitions | NONE → AI_DRAFTED (on draft) → PUBLISHED (on reply) |
| `gbp_new_review` alerts | New reviews trigger CRM alerts visible in portal |
| Dispute bridge | `review_dispute` intake kind works via `IntakeFormRenderer` |
| Tier B NOT invoked | `runAutopilot` exists but no job calls it |
| `pnpm checkapi` + `pnpm checkweb` | Zero new errors |
| Reply engine tests | All 12 service tests pass |
| Route tests | All 4 new tests pass (15 total with Phase 0+1) |
| Review inbox UI | `/account/marketing/gbp/reviews` renders with filters + cards + draft picker |

---

## Files Created

| File | Task |
|---|---|
| `apps/api/src/jobs/gbpReviewIngestion.ts` | 1 |
| `apps/api/src/services/gbp/prompts.ts` | 2 |
| `apps/api/src/services/GBPReviewReplyService.ts` | 3 |
| `apps/web/src/app/account/marketing/gbp/reviews/page.tsx` | 6 |
| `apps/web/src/app/account/marketing/gbp/reviews/ReviewCard.tsx` | 6 |
| `apps/web/src/app/account/marketing/gbp/reviews/AiDraftPicker.tsx` | 6 |
| `apps/api/src/services/__tests__/GBPReviewReplyService.test.ts` | 9 |
| `database/migrations/NNN_review_dispute_intake.sql` (seed `mkt_intake_definitions`) | 8 |

## Files Modified

| File | Change | Task |
|---|---|---|
| `apps/api/src/routes/gbp-customer.ts` | Replace 4 stubs with real endpoints | 4 |
| `apps/web/src/services/MarketingCustomerService.ts` | Add 4 review methods | 5 |
| `apps/api/src/index.ts` (or job registration file) | Wire `gbpReviewIngestion.ts` hourly cron | 1 |

---

## Out of Scope

- Tier B autopilot activation (Phase 2.5)
- Post scheduler / media upload (Phase 3)
- Capability registration / BSaaS / directory surfacing (Phase 4)
- `batchGetReviews` (out of v1 scope — single-location)
- Google Cloud Pub/Sub ingestion (later optimization — v1 uses polling)
