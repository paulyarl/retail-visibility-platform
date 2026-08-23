# GBP Authorized Management Suite — Sprint Plan: Phase 2.5

**Spec:** `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md`
**Scope:** Phase 2.5 — Tier B Autopilot Quality Gate
**Prerequisite:** Phase 2 complete AND Tier A drafts approved by real merchants in production for ≥1 review cycle
**Status:** Planning — **GATED on production validation, not just code completion**

---

## Sprint Goal

Activate **Tier B autopilot** for 5-star no-comment reviews — the merchant's AI engine automatically posts genuine thank-you replies within a dynamic response window, with no hardcoded timing.

Phase 2.5 is **not a code-only sprint**. It requires:
1. Tier A production validation (real merchants approving drafts for at least one review cycle)
2. Prompt-design review confirming autopilot replies meet Google's authenticity bar
3. Only then: wire `runAutopilot` to a scheduled job

---

## Pre-Flight Checklist (GATED — cannot start without these)

### Production validation gates
- [ ] Tier A drafts have been used by real merchants in production for ≥1 review cycle
- [ ] Merchant feedback on draft quality collected and reviewed
- [ ] No reports of inauthentic-sounding or Google-policy-violating drafts
- [ ] Prompt-design review completed — autopilot replies meet Google's authenticity bar
- [ ] `gbp_ai_response` capability will be live (Phase 4 registration) OR a temporary entitlement is granted for the pilot

### Phase 2 handoff verification
- [ ] `GBPReviewReplyService.runAutopilot` method exists but is NOT invoked by any job
- [ ] `gbpReviewIngestion.ts` cron is running hourly
- [ ] `gbp_reviews` has `reply_status`, `ai_drafts`, `sentiment` columns populated
- [ ] Tier A draft generation produces 3 quality drafts

---

## Task Breakdown

### Task 1: Dynamic Response Window Configuration
**File:** `apps/api/src/config/unifiedConfig.ts` (modify) or a dedicated config section
**Spec ref:** §4 Subsystem 2 behavioral character + §9 Phase 2.5

**The dynamic window is a tunable parameter, NOT a hardcoded constant.**

**Configuration shape:**
```ts
gbpAutopilot: {
  enabled: boolean;                    // master feature flag — default: false
  responseWindowMinMs: number;         // minimum delay (e.g., 0 = near-immediate)
  responseWindowMaxMs: number;         // maximum delay (e.g., 900000 = 15 min — ILLUSTRATIVE, not a contract)
  sentimentWeighting: boolean;         // adjust window based on review sentiment
  timeOfDayWeighting: boolean;         // adjust window based on time of day
  merchantActivityWeighting: boolean;  // adjust window based on merchant activity patterns
}
```

**IMPORTANT:** the values above are examples of what the configuration *could* be — they are not hardcoded contracts. The window is determined later by operational tuning. The spec explicitly prohibits "respond immediately", "respond after 2 minutes", or "respond within 15 minutes" as fixed promises.

**Window selection logic (in `runAutopilot`):**
```ts
const delay = selectDynamicWindow({
  min: config.gbpAutopilot.responseWindowMinMs,
  max: config.gbpAutopilot.responseWindowMaxMs,
  sentiment: review.sentiment,
  timeOfDay: new Date().getHours(),
  merchantActivity: await getMerchantActivityPattern(tenantId),
});
// Schedule the reply after `delay` ms — not immediately, not at a fixed offset
```

---

### Task 2: Wire `runAutopilot` to Scheduled Job
**File:** `apps/api/src/jobs/gbpReviewAutopilot.ts` (new)
**Spec ref:** §4 Subsystem 2 Tier B + §9 Phase 2.5

**Behavior:**
1. Query all tenants with `gbp_ai_response` entitlement active
2. For each tenant, query `gbp_reviews` for 5-star no-comment reviews where `reply_status = 'NONE'`
3. For each eligible review:
   - Generate a single autopilot reply (not 3 drafts — autopilot uses the best-angle draft directly)
   - Select a dynamic response window delay (Task 1)
   - Schedule the reply publication after the delay
   - Set `reply_status = 'AI_DRAFTED'` immediately (to prevent double-processing)
4. On publication: call `GBPAdvancedSync.replyToReview`, set `reply_status = 'PUBLISHED'`
5. On failure: set `reply_status = 'NONE'` (retry on next cron run), log error

**Eligibility rules (hard gates):**
- Review must be 5-star (`star_rating = 5`)
- Review must have no comment (`comment IS NULL` or `comment = ''`)
- Review must not be replied to (`reply_status = 'NONE'`)
- Tenant must have `gbp_ai_response` entitlement
- `config.gbpAutopilot.enabled` must be `true`

**Reviews ≤ 3 stars are NEVER auto-replied.** They are held for human review (Tier A).

**Schedule:** runs every 5 minutes (checks for eligible reviews + processes scheduled replies whose delay has elapsed). Wired in `index.ts` startup.

---

### Task 3: Feature Flag + Rollback
**File:** `apps/api/src/config/unifiedConfig.ts` (Task 1 config)

**Feature flag:** `config.gbpAutopilot.enabled` — default: `false`

**Rollback plan:**
- Set `enabled = false` → autopilot job stops picking up new reviews
- Already-scheduled replies (in-flight delays) complete normally
- `reply_status = 'AI_DRAFTED'` reviews remain drafted — merchant can review/publish manually via Tier A inbox
- No data loss, no stuck state — drafts-only mode resumes

---

### Task 4: Unit Tests
**File:** `apps/api/src/services/__tests__/GBPReviewReplyService.test.ts` (extend Phase 2 tests)
**Spec ref:** §10 quality gate #4 (Tier B)

**New test cases:**
1. Autopilot publishes only 5-star no-comment reviews
2. ≤3-star reviews are held for human review (NOT auto-replied)
3. Autopilot is inert without `gbp_ai_response` entitlement
4. `runAutopilot` job is disabled by default (`enabled = false`)
5. Response timing uses the dynamic window — assert the window is a tunable parameter from config, NOT a hardcoded constant
6. `reply_status` transitions: NONE → AI_DRAFTED (on schedule) → PUBLISHED (on publication)
7. Failed publication resets `reply_status` to NONE for retry
8. No double-processing: once `AI_DRAFTED`, the job skips the review

---

## Task Dependency Graph

```
Production validation (GATED) ── Task 1 (dynamic window config) ── Task 2 (wire job) ── Task 4 (tests)
                                                                         │
Task 3 (feature flag + rollback) ────────────────────────────────────────┘
```

**Critical path:** Production validation → Task 1 → Task 2 → Task 4

---

## Verification Gates

| Gate | Must pass |
|---|---|
| Tier A production validation | Real merchants approved drafts for ≥1 review cycle |
| Prompt-design review | Autopilot replies meet Google's authenticity bar |
| Dynamic window is configurable | Assert window values come from config, not hardcoded |
| No fixed timing promise | No "immediately", "after 2 minutes", or "within 15 minutes" in code or spec |
| 5-star no-comment only | Autopilot never touches ≤3-star reviews |
| Entitlement gate | Autopilot inert without `gbp_ai_response` |
| Feature flag default OFF | `enabled = false` by default |
| Rollback works | Setting `enabled = false` stops new autopilot; in-flight completes; drafts remain |
| `pnpm checkapi` | Zero new errors |
| Tier B tests | All 8 new tests pass |

---

## Files Created

| File | Task |
|---|---|
| `apps/api/src/jobs/gbpReviewAutopilot.ts` | 2 |

## Files Modified

| File | Change | Task |
|---|---|---|
| `apps/api/src/config/unifiedConfig.ts` | Add `gbpAutopilot` config section | 1, 3 |
| `apps/api/src/services/GBPReviewReplyService.ts` | `runAutopilot` now invoked by job (was stub in Phase 2) | 2 |
| `apps/api/src/index.ts` (or job registration) | Wire `gbpReviewAutopilot.ts` cron | 2 |
| `apps/api/src/services/__tests__/GBPReviewReplyService.test.ts` | Add 8 Tier B tests | 4 |

---

## Out of Scope

- Post scheduler / media upload (Phase 3)
- Capability registration / BSaaS / directory surfacing (Phase 4)
- Per-surface merchant gate toggles (Phase 4)
- Multi-location support (post-v1)
