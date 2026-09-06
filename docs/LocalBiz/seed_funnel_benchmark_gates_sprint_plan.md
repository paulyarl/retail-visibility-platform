# Seed Funnel Benchmark Gates — Sprint 2 Plan (Hardening & Completion)

Status: **PLANNED**

Parent spec: `docs/LocalBiz/seed_funnel_benchmark_gates_and_analytics_spec.md` (v1.1)
Input: post-sprint-1 verification & gap analysis (2026-09-05) — implementation vs. §7,
spec-internal gaps, and test gaps. Sprint 1 shipped migration 258, contactable
derivation, NAP verification capture (both claim paths), `'directory_claim'`
conversion source, `SeedFunnelAnalyticsService` (G1–G4 grading), the
`/funnel/cohorts` endpoint, and 12 passing tests.

---

## §1 Sprint goal

Make the funnel **decision-grade-capable and operator-visible**: build the two
missing capture mechanisms that unblock G5/G6 (touch log, tier-change history),
finish the metric surface (per-category cuts, time-to-claim, scaling-readiness),
ship the operator UI, and close every spec-internal gap the verification found —
including the §3.1 dedup omission the v1 spec failed to acknowledge.

## §2 Non-goals

- Auto-merge of duplicate seeds (detection only — consolidation is operator work)
- Real CAC cost accounting (v1 uses a documented cost-per-touch constant; G5 stays deferred until real cost data exists)
- Public-facing surfaces (claim UX, `/place` pages) — untouched
- LLM anything in the metrics path
- Prospect-queue changes (the 255 verify-then-outreach flow stays as-is)

## §3 Fact-check results (close spec open questions before building)

| OQ | Finding | Disposition |
|---|---|---|
| §9 OQ4 — token TTL vs. G2 30-day window | `inviteSeed(seedId, expiresInDays = 90)` — default TTL is **90 days** (`DirectoryPresenceSeedService.ts:589`), and re-issue is just minting again | **Closed — no build.** TTL ≥ G2 window. Spec edit only (W7). |
| §9 OQ5 — published-at column | `directory_presence_seeds.published_at` **exists** (selected at `:203`, stamped in `publishSeed` at `:544`) | **Closed — no build.** G2 clock stays at `token.created_at` (first invite); seed-age reporting uses `published_at`. Spec edit only (W7). |
| Tier-change capture (for G4 tighten + G6) | `tenants.subscription_tier` is written from **220+ scattered sites** — but tier change is the **wrong signal** anyway. A claimed seed owner who stays on `directory_presence` and buys a BSaaS add-on (GBP management, chatbot, CRM) or stocks products is converted by any reasonable definition, yet a tier trigger would never fire. 8 queryable signals exist across `tenant_feature_purchases`, `platform_revenue_transactions`, `orders`, `inventory_items`, `users.last_login_at`, `tenant_storefront_options_settings`, `tenants.google_sync_enabled`, and `business_hours_list`. | **Conversion score with threshold** — no trigger, no history table. W2 JOINs the existing tables into a weighted 8-signal score; G4 fires when score ≥ configurable threshold (default 4 of 12). |

---

## §4 Phase 1 — Tier 1 (unblocks G5/G6 + operator visibility)

### W1 — Outreach touch log (spec §7 Gap 4)

The 257 `outreach_state` machine tracks *state*, not *touches*. CAC (G5) needs
a numerator.

- **Migration 259** — `directory_seed_outreach_touches`:
  `id UUID PK`, `seed_id` (FK → seeds, CASCADE), `tenant_id`, `channel TEXT CHECK (channel IN ('call','email','sms','mail','other'))`,
  `outcome TEXT NULL CHECK (outcome IN ('connected','no_response','voicemail','bad_number','claimed','not_interested'))`,
  `notes TEXT`, `operator_id TEXT NULL`, `occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `created_at TIMESTAMPTZ DEFAULT now()`;
  index on `(seed_id, occurred_at)`.
- **Service** — `addOutreachTouch(seedId, {channel, outcome?, notes?, occurredAt?}, ctx)` and
  `listOutreachTouches(seedId)` on `DirectoryPresenceSeedService` (audit action
  `directory_presence_seed.touch_logged`).
- **Routes** — `POST /api/admin/directory/presence-seeds/:id/touches`,
  `GET /api/admin/directory/presence-seeds/:id/touches` (`requirePlatformStaff`).
- **Funnel integration** — cohort metrics gain `touches` (COUNT of touches joined
  through seeds) and `cacEstimate` = `touches × COST_PER_TOUCH / paid`
  (`COST_PER_TOUCH` = exported constant, default **$15**, documented as
  placeholder until real cost data lands). **G5 stays in `deferredGates`** —
  the estimate is informational until a real cost config exists.
- **Acceptance:** touches round-trip through the API; funnel response includes
  `touches` + `cacEstimate` per cohort; G5 still deferred with an updated reason.

Size: **M**.

### W2 — Conversion score with threshold gating (tightens G4, enables G6)

**Problem with the v1 trigger approach:** a `subscription_tier` trigger only
catches tier upgrades (`directory_presence` → `presence`/`discovery`/
`storefront`). But the most common conversion path for a claimed seed owner is
**staying on the free `directory_presence` tier and buying a BSaaS add-on**
(GBP management, chatbot, CRM, featured placement) or simply stocking products
and generating revenue. A tier-only trigger would miss every one of those —
G4 would undercount and G6 would false-negative on the exact tenants the
funnel is meant to credit.

**Problem with "any one signal = converted":** a single weak signal (one
product stocked, one login) can fire green on its own, producing false
positives. A tenant who logged in once and never came back is not converted.

**Revised approach — conversion score with threshold:** derive a
**conversion score** at query time from a weighted set of existing signals.
No trigger, no history table, no backfill — the signals already exist, they
just need to be JOINed and scored. G4 fires green when the score meets a
configurable threshold, not when any single signal clears.

**Signal set (8 signals, two tiers):**

*Strong signals (weight 2 each) — unambiguous commercial intent:*

| # | Signal | Source table | Condition | Timestamp |
|---|---|---|---|---|
| S1 | Paid tier upgrade | `tenants` + `subscription_tiers_list` | `subscription_tier` maps to `price_monthly > 0` | tier change (proxy: `tenants.updated_at`) |
| S2 | BSaaS add-on purchase | `tenant_feature_purchases` | `status = 'active'` | `purchased_at` |
| S3 | Revenue transaction | `platform_revenue_transactions` | `status <> 'failed'` AND `gross_amount_cents > 0` | `created_at` |
| S4 | Customer order | `orders` | `order_status` not `draft` AND `payment_status` in (`paid`, `refunded`) | `created_at` |

*Engagement signals (weight 1 each) — platform adoption, weaker alone:*

| # | Signal | Source table | Condition | Timestamp |
|---|---|---|---|---|
| W1 | Product stocking | `inventory_items` (COUNT per tenant) | `> 0` products created | first `created_at` |
| W2 | Owner platform access | `users.last_login_at` (joined via tenant's users) | `last_login_at` is not null | `last_login_at` |
| W3 | Storefront customization | `inventory_items.custom_branding` non-null OR `landing_page_theme <> 'default'` OR `tenant_storefront_options_settings.storefront_opt_enabled = true` | any storefront config beyond defaults | `tenants.updated_at` (proxy) |
| W4 | GBP sync / business profile enrichment | `tenants.google_sync_enabled = true` OR `tenants.google_last_sync` not null OR `business_hours_list` row exists with non-empty periods | owner connected GBP or set business hours | `google_last_sync` or `business_hours_list.updated_at` |

**Scoring:**

```
conversionScore = (Σ strong signals cleared × 2) + (Σ weak signals cleared × 1)
maxScore = 4×2 + 4×1 = 12
```

**Threshold (configurable, exported constant):**

```
CONVERSION_THRESHOLD = 4   // default — tune after first two cohorts
```

- Score ≥ threshold → **converted** (G4 numerator)
- Score < threshold → not converted, but the raw score is surfaced in the
  funnel response as a `conversionScore` leading indicator (like
  `owner_corrected_nap` — track, don't gate, until validated)

**Why a threshold, not "any one = converted":** a tenant with one product
stocked (W1, score 1) and nothing else is exploring, not converted. A tenant
with a BSaaS purchase (S2, score 2) and owner login (W2, score 1) has score 3
— still below threshold, suggesting tire-kicking. But a tenant with a BSaaS
purchase (S2, score 2) + product stocking (W1, score 1) + storefront
customization (W3, score 1) = score 4 → **converted**: multiple independent
signals of commercial intent. The threshold prevents single-signal false
positives while still crediting the free-tier-add-on path that the v1 trigger
approach missed entirely.

**Strong-signal override:** any single strong signal (S1–S4) with score ≥ 2
is *directional* conversion (surfaced as `conversionScore` with a
`strongSignalOnly` flag) but does NOT fire G4 green alone unless the threshold
is met. This is deliberate — a single BSaaS purchase could be a trial that
churns. The threshold requires corroboration. After the first two cohorts,
if the data shows that any single strong signal reliably predicts retention,
lower the threshold or add a strong-signal-only fast path.

**G4 (conversion, 60-day window):**

```
converted_60d = claimed seeds WHERE conversionScore ≥ CONVERSION_THRESHOLD
                AND earliest signal timestamp ≤ claimed_at + 60 days
```

The earliest signal timestamp is `MIN(S1.timestamp, S2.purchased_at,
S3.created_at, S4.created_at, W1.first_created_at, W2.last_login_at,
W3.updated_at, W4.google_last_sync)` — whichever signals are cleared.

**G6 (retention, 90-day):**

```
retention_90d = converted seeds WHERE tenant currently has
                conversionScore ≥ CONVERSION_THRESHOLD
                (re-evaluated at query time, not at the 90-day mark)
```

"Currently active" is a query-time check — for cohorts older than 90 days this
is stricter than the spec's "active at the 90-day mark" (documented as a
deliberate deviation: a tenant that churned after day 90 fails here, whereas
the spec would pass it). This is the right call for a scaling decision — we
want to know who is still engaged, not who was engaged once.

- **No migration needed.** All eight source tables already exist with the
  columns required. This is a pure analytics-service change.
- **Analytics changes** (`SeedFunnelAnalyticsService`):
  - The `paid` FILTER in `METRIC_SELECT` is replaced by a `converted` FILTER
    using the composite score + threshold.
  - `retention_90d` adds a second FILTER for the engagement check (score
    re-evaluated at query time).
  - Cohort response gains `conversionScoreBreakdown` per cohort:
    `{ s1, s2, s3, s4, w1, w2, w3, w4, total, threshold, converted }` — so
    operators can see *why* a cohort is or isn't passing G4, not just that it
    isn't.
  - G5 remains deferred (cost data), per W1.
- **Acceptance:**
  - A claimed seed tenant with an active BSaaS purchase (S2) + product
    stocking (W1) + storefront customization (W3) = score 4 → `converted` in
    G4 (the free-tier-add-on path the v1 trigger missed).
  - A tenant with only one product stocked (W1, score 1) → NOT converted
    (single weak signal below threshold).
  - A tenant with a paid tier upgrade (S1, score 2) + owner login (W2, score
    1) = score 3 → NOT converted (below threshold — needs corroboration).
  - A tenant with a paid tier upgrade (S1, score 2) + revenue transaction (S3,
    score 2) = score 4 → `converted` (two strong signals).
  - Funnel response includes `conversionScoreBreakdown` and `retention_90d`;
    spec §11 deviation 1 retired.

Size: **M** (analytics rewrite of the paid/retention FILTERs + score
computation — no migration, no trigger, no backfill).

### W3 — Operator funnel UI (spec §7 Gap 6 frontend)

- **Service** — `getCohortFunnel(params)` on the existing web admin service
  (`apps/web/src/services/DirectoryPresenceAdminService.ts`).
- **Page** — cohort funnel view under the directory-presence admin section
  (`/settings/admin/...`, matching the existing seeds page location and styling
  conventions):
  - Filter row: category, city, state, focus, campaignIds (mirrors endpoint params)
  - **Combined summary card** (the decision-grade row): metrics grid, G1–G4 gate
    chips (pass / fail / not-evaluable), grade badge (`decision_grade` vs
    `directional`), `deferredGates` footnote, `cacEstimate` + `retention_90d`
    once W1/W2 land
  - **Per-campaign table**: one row per cohort — seeds → contactable → invited
    → claimed → nap_verified → owner_corrected → paid, with rate columns and
    gate chips
  - `owner_corrected_nap` surfaced as a labeled leading-indicator column, not
    buried in metrics
- **Acceptance:** an operator can answer "are we passing the gates?" without
  touching the API; filters round-trip; empty cohorts render a directional
  no-data state (never a red fail — §2 evidence-safety rule).

Size: **M**.

### W4 — Metric surface completion (spec §4/§6/§10)

- **Per-category cuts (§6)** — third query grouping by `mc.category` across the
  filtered set → `categoryRollups[]` in the response (same gate grading). This
  is the §6 requirement and the input to the §10 rule.
- **`medianDaysToClaim`** — `percentile_cont(0.5)` over
  (`t2.consumed_at − t2.created_at`) across claimed tokens, per cohort + combined.
- **Scaling readiness (§10 surfacing)** — `scalingReadiness` block on the
  combined report: `{ citiesPassing, categoriesPassing, ruleMet }` computed from
  decision-grade passing cohorts grouped by `address_state`/`address_city` and
  `category`, with the ≥2×≥2 rule evaluated and an explanatory note. Human
  judgment stays the decider; the system now *surfaces* the threshold state.
- **Acceptance:** endpoint response shape = `{ cohorts[], combined{…, categoryRollups, medianDaysToClaim, scalingReadiness}, }`;
  per-category rows graded with the same small-n rules.

Size: **M**. Depends on: nothing for rollups/median/readiness; W2 for `retention_90d`.

---

## §5 Phase 2 — Tier 2 (spec correctness & hygiene)

### W5 — Duplicate-seed detection (§3.1 — detection-only v1)

The v1 spec *specified* identity resolution but never listed it as a build item
— that omission is corrected here as a spec revision (W7) plus a minimal build:

- **Detection** — analytics query pairing seeds that share a normalized phone
  (digits-only, last 10) **or** normalized address + city (lowercase,
  punctuation-stripped). Surfaced in the funnel response as
  `potentialDuplicateSeeds: [{ seedIds[], matchKey, names[] }]` and a
  `duplicateSeedCount` caveat per cohort (denominators may be inflated).
- **`name_variants TEXT[]`** column on `directory_presence_seeds`
  (migration 260) — `createFromCampaign` writes the campaign business name;
  duplicate detection appends the counterpart's name to both seeds' variant
  sets.
- **Auto-merge: deferred** — consolidation changes listing/tenant keys and is
  operator work; detection prevents *silent* double-counting, which is the
  actual §3.1 risk.
- **Acceptance:** two seeds sharing a phone appear in `potentialDuplicateSeeds`
  with both names in each variant set; funnel denominators carry the caveat.

Size: **M**.

### W6 — Migration 258 default fix

`contact_status TEXT NOT NULL DEFAULT 'unverified'` is a third state the service
never writes (spec + code use `contact_unverified`). **258 is already applied —
fix forward, never edit an applied migration:**

- **Migration 261** — `ALTER TABLE directory_presence_seeds ALTER COLUMN
  contact_status SET DEFAULT 'contact_unverified';`

  *(Note: W5 uses migration 260 for `name_variants`; W6 uses 261 for the
  default fix. W2 no longer needs a migration — it's a pure analytics-service
  change.)*
- **Acceptance:** `\d directory_presence_seeds` shows the new default; no live
  row holds `'unverified'` (backfill + explicit inserts already guarantee it —
  verify with a COUNT query during rollout).

Size: **S**.

### W7 — Spec revision v1.2 (close what the verification flagged)

Spec-only edits to `seed_funnel_benchmark_gates_and_analytics_spec.md`:

1. **§9 OQ4 closed** — token TTL is 90 days by default (`inviteSeed`), ≥ the
   30-day G2 window; re-issue = mint again. No build.
2. **§9 OQ5 closed** — `published_at` exists (stamped in `publishSeed`); G2
   clock = first invite (`token.created_at`); seed-age reporting uses
   `published_at`. No build.
3. **§3.1 dispositioned** — dedup moved into §7 as built-detection/deferred-merge
   (W5); the §11 "still open" list corrected (the v1.1 notes omitted this gap —
   that omission was itself a spec bug).
4. **§3 stage 2 edge documented** — `contactable` requires `phone AND
   identity_confidence ≠ 'low'`; the low-confidence edge is unreachable through
   current create paths (admin Zod schema enums `high|medium`;
   `createFromCampaign` clamps), and W1-era direct `createSeed` callers pass
   campaign-derived phones. Noted rather than re-plumbed.
5. **§3 stage 8 + §2 "Paid" redefined** — "paid" is no longer just "on a paid
   subscription tier." The v1.2 contract: a claimed seed tenant is *converted*
   when its **conversion score** (weighted sum of 8 signals across 4 strong
   and 4 engagement categories) meets a configurable threshold (default 4 of
   12) within 60 days of claim; *retained* when the score still meets the
   threshold at query time. §11 deviation 1 retired; the scoring definition
   replaces it.
6. **§6 marked implemented** (W4) and **§10 surfacing defined**
   (`scalingReadiness` block, W4).

Size: **S**.

---

## §6 Phase 3 — Tier 3 (test hardening)

### W8 — Analytics SQL-path test

`SeedFunnelAnalyticsService.getCohortFunnel` with mocked `$queryRawUnsafe`
(two calls: per-campaign + combined):

- Row → report mapping (bigint → Number, campaign fields attached only per-cohort)
- Combined aggregate uses the second query and omits campaign fields
- Gate grading wired through (a failing cohort yields `pass: false` gates)
- Empty result set → zeroed combined report with `directional` grade
- Filters propagate into both SQL calls (assert params)
- **Composite conversion signal:** a row where `paid` (now `converted`) is
  driven by a BSaaS purchase flag (not a tier upgrade) counts in G4; a row
  with `converted` driven by product stocking counts in G4; `retention_90d`
  counts a tenant with an active feature purchase but no tier upgrade
- **Threshold gating:** a row with a single weak signal (score 1, below
  threshold 4) does NOT count as converted; a row with two strong signals
  (score 4, meets threshold) does count; `conversionScoreBreakdown` is
  surfaced in the response so operators can see which signals fired

### W9 — Contactable + NAP-stamp tests

- `createFromCampaign` sets `contact_status = 'contactable'` when the campaign
  has a phone and `'contact_unverified'` when it doesn't (mock
  `mkt_campaigns_list.findUnique` / `mkt_audits_list.findFirst` /
  `IntelligenceProfileService` / `SeedSeoComposer` per the existing
  `setOutreachState` test mock pattern).
- `acceptClaim` stamps `nap_verified_at` (token fixture: unconsumed, unexpired,
  unbound → assert the seed UPDATE includes it).
- `approveClaimRequest` stamps `nap_verified_at` (same assertion on the
  operator path).

Size: **M** total.

---

## §6.1 Execution order & dependencies

```
W6 (S) ─┐
W7 (S) ─┼─► W1 (M) ──► W4 (M) ──► W3 (M)
        └─► W2 (M) ────┘    ▲
W5 (M) ─────────────────────┘ (detection surfaces through the same response)
W8 (M) — lands alongside each work item, not at the end
```

Quick wins first (W6, W7 — both spec/migration hygiene), then the two capture
mechanisms (W1, W2) that W4's metric completion depends on, then the UI (W3),
which can start against the current endpoint shape in parallel. W2 is now
smaller (no migration/trigger/backfill — pure analytics-service change) and
can run in parallel with W1 from the start.

## §7 Verification & rollout

1. `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate`
   after each migration (259, 260, 261)
2. `pnpm checkapi` + `pnpm checkweb` green
3. Full vitest pass including the three new test files
4. **Conversion score check:** a claimed seed tenant with an active
   `tenant_feature_purchases` row (S2, weight 2) + products stocked (W1,
   weight 1) + storefront customization (W3, weight 1) = score 4 →
   `converted` in G4; a tenant with only one product stocked (W1, score 1) →
   NOT converted (below threshold); `conversionScoreBreakdown` visible in
   the response
5. Funnel endpoint smoke: unfiltered + per-category query against local data
6. Spec §11 updated to v1.2 dispositions

## §8 Carried forward (explicitly out of this sprint)

- Auto-merge / seed consolidation tooling (operator workflow, needs UX design)
- Real CAC cost config (platform setting) — constant placeholder in v1
- G5 gate activation (blocked on the above)
- **Conversion threshold tuning** — default threshold (4 of 12) is a launch
  guess; freeze it only after the first two decision-grade cohorts validate
  the correlation between score ≥ threshold and actual retention. If a single
  strong signal (S1–S4) reliably predicts retention on its own, consider a
  strong-signal fast path that bypasses the threshold.
- Prospect-queue ↔ seed-task unification (§9 OQ1 — revisit only if hold-states
  proliferate beyond the current two)
- Per-platform gold-standard cuts in the funnel report (competitive-focus work)
