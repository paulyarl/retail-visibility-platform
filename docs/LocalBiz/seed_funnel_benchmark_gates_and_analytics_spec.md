# Seed Funnel Benchmark Gates & Tracking Analytics Spec

Status: **DRAFT v1**

Scope: the directory-seed go-to-market motion — intelligence-discovery campaigns
produce **seeds** (`/place/{slug}`), owners are invited to **claim** a free
`directory_presence` profile pre-filled with gathered NAP, and claimed owners are
handed off to paid Presence Modes (`presence` / `discovery` / `storefront`).
This spec defines (a) the funnel stages, (b) the exact metric formulas over
existing tables, (c) the benchmark gates that must pass before national scaling,
and (d) the small set of capture gaps that must be built so every metric is a
stored query rather than manual collection.

Companion strategy context: Madison, WI is the proving ground (Middle Eastern
Grocery Store category, profile `mip-hmkg1oop`); Milwaukee is the expansion city;
the gold-standard benchmark profile is `mip-n6x5tx3x` (nationwide, cross-platform).

Related specs:

- `docs/LocalBiz/directory_presence_claim_handoff_spec.md` — post-claim upgrade handoff (tier triad, pricing)
- `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` — tier ladder
- `docs/LocalBiz/PLACE_SEED_SEO_ENRICHMENT_SPEC.md` — seed creation from campaigns (`createFromCampaign` flow)
- `docs/LocalBiz/seed_outreach_courtesy_window_sprint_plan.md` — outreach window mechanics

---

## §1 Context & Goal

The go-to-market motion is: **discover → seed → invite → claim → verify → paid**.
Intelligence-scope discovery audits (emerging + competitive focus) already return
structured per-business JSON through the prompt-execution pipeline. Seeds are
published from that intelligence with pre-filled NAP ("already filed with
intelligence-gathered data"), and each owner is invited to claim their free
profile while the listing is fresh ("the Google propagation window").

Manual metric collection does not scale across the planned matrix
(cities × categories). Every funnel stage below already has a system home —
the build is small: derive one flag at ingest, capture one diff at claim,
attribute one conversion source, and add a task queue for hold-state
verification work. After that, every benchmark gate is a stored query per
cohort, and the Madison/Milwaukee decision report is a view.

**Guiding rule (evidence safety, carried over from the category-intelligence
profiles):** absence of evidence is never converted into a negative state.
A seed with no phone on file is `contact_unverified`, not `unreachable`; a
stale directory listing is not a closed business. The funnel tracks what the
system observed, never what it infers.

---

## §2 Definitions

| Term | Definition |
|---|---|
| **Seed** | A row in `directory_presence_seeds` (+ its `directory_listings_list` listing). The unit of tracking. Public URL: `/place/{slug}` while unclaimed; `/directory/{slug}` after claim (`listing_origin`: `directory_seed` → `claimed`). |
| **Cohort** | The campaign a seed is bonded to via `directory_seed_campaign_links`. Campaigns already carry `category`, `city`, `state`, and `intelligence_focus`, so **the campaign is the cohort**. A *combined cohort* is a named set of campaigns (e.g., "Madison + Milwaukee, Middle Eastern Grocery"). |
| **Contactable** | The seed has a usable outreach route: `(dps.owner_phone OR campaign.phone) IS NOT NULL` **AND** the linked campaign audit's `identity_confidence` is not `low`. Absence of a phone is recorded as `contact_unverified` — it does NOT mean the business is unreachable (a DATCP license lookup or field call may still produce one). |
| **Invite** | A `directory_claim_tokens` row created for the seed. Invites are only dispatched through the token path so the event is queryable. |
| **Claim** | `directory_claim_tokens.consumed_at` is set (token consumed) and `listing_origin` flips to `claimed`. |
| **NAP verified** | At claim accept, the owner-confirmed NAP is compared to the seed NAP. Any outcome (confirmed as-is, or corrected) produces a verification event with the field-level diff. |
| **Paid** | The claimed tenant acquires its first paid subscription tier (`presence`, `discovery`, or `storefront`) — launch pricing $19 / $29 / $59 per month, DB-adjustable via `subscription_tiers_list`. |
| **Hold** | A seed with an unresolved conflict (identity conflict, category-fit insufficient, or open/closed status conflict). Holds are tracked as verification **tasks**, not prose notes, and are excluded from invite dispatch until resolved. |

---

## §3 Funnel stages & event spine

| # | Stage | Event | Source (existing unless noted) | Captured today? |
|---|---|---|---|---|
| 1 | Seed published | `seed_published` | `directory_presence_seeds.status = 'published'` (+ creation timestamp) | Yes (verify published-at column; else use `created_at`) |
| 2 | Contactable determined | `contactability_resolved` | Derived at ingest from campaign phone + audit `identity_confidence` | **Gap** — derive & store flag at `createFromCampaign` |
| 3 | Invite issued | `invite_issued` | `directory_claim_tokens.created_at` | Yes |
| 4 | Invite consumed (claim) | `claim_accepted` | `directory_claim_tokens.consumed_at` + `listing_origin` flip | Yes |
| 5 | NAP verified / corrected | `nap_verified` (+ `owner_corrected_nap` flag) | **Gap** — capture field-level diff at claim accept | No — build |
| 6 | Outreach touch | `outreach_touch` (call / email / mail) | **Gap** — lightweight task/touch log per seed | No |
| 7 | Hold / verification task | `verification_task_opened` / `…_resolved` | **Gap** — hold-state as tracked status (e.g., "verify phone via DATCP", "resolve open/closed conflict") | No |
| 8 | Paid conversion | `subscription_started` (paid tier) | Tenant subscription record (see `subscription_tiers_list` for tier pricing; verify table name) — attributed to the claim when first paid tier starts ≤ 60 days after `consumed_at` | Partial — needs claim-origin attribution |
| 9 | Retention | `active_at_90d` | Derived from subscription status at `consumed_at + 90 days` | Derived |

**Event spine:** `seed_published → contactability_determined → invite_issued →
claim_token_consumed → nap_verified → first_paid → active_at_90d`, plus
side-channel events (`outreach_touch`, `verification_task_*`). All timestamps
are system timestamps; time-to-claim and time-to-paid are derived by subtraction
— no manual timers.

**Attribution rule (paid):** the first paid subscription on the claimed tenant
that starts within 60 days of `consumed_at` is attributed to the claim cohort.
Seeds create fresh tenants, so pre-existing subscriptions are not expected;
if one is found, attribute to `organic` and exclude from the funnel numerator
(log, don't drop).

---

## §3.1 Identity resolution at ingest (dedup)

Seeds are keyed by **address + phone** (the same dedup rule the discovery
audits use), never by name alone — the same business legitimately appears under
multiple names (`Istanbul Super Market` / `Istanbul Market` /
`Istanbul Supermarket and Cafe`) and across focus runs (the Madison emerging and
competitive campaigns discovered the same ten businesses). At ingest:

1. Resolve the candidate against existing seeds by normalized address + phone.
2. Match → link the new campaign to the **existing** seed (new row in
   `directory_seed_campaign_links` with the new campaign id); do not create a
   duplicate seed.
3. Store the name-variant set on the seed (e.g., `Istanbul Super Market` /
   `Istanbul Market` / `Istanbul Supermarket and Cafe`) so funnel reports never
   split one operator into several.

Without this, funnel denominators double-count across the emerging and
competitive runs.

---

## §4 Metric definitions (formulas over existing tables)

Per cohort (campaign or combined cohort), computed over seeds bonded via
`directory_seed_campaign_links`:

```
seeds               = COUNT(seeds in cohort)
contactable         = seeds WHERE (owner_phone OR campaign.phone) IS NOT NULL
                      AND identity_confidence <> 'low'
contactable_rate    = contactable / seeds

invited             = seeds WITH ≥1 directory_claim_tokens row
invite_rate         = invited / contactable

claimed             = seeds WHERE EXISTS token WITH consumed_at NOT NULL
claim_rate_30d      = claims WHERE (consumed_at - token.created_at) ≤ 30 days / invited
claim_rate_overall  = claimed / invited
time_to_claim       = median(consumed_at − MIN(token.created_at)) per seed

nap_verified        = claims WITH a nap_verified event
nap_verified_rate   = nap_verified / claimed
owner_corrected     = claims WHERE nap diff non-empty   ← leading indicator

paid_60d            = claimed tenants WITH first paid subscription
                      started ≤ 60 days after consumed_at
paid_rate           = paid_60d / claimed

retention_90d       = paid tenants still active at consumed_at + 90 days / paid
cac_payback_months  = allocated outreach cost per paid / paid tier monthly price
```

**Contactable caveat:** `identity_confidence = 'low'` blocks outreach per the
discovery routing rules (low confidence forces `hold`), so those seeds are
excluded from the denominator until a verification task resolves them.

**Worked example (Madison, Middle Eastern Grocery):** 10 seeds discovered →
~5 contactable (50%) → invites dispatched to ready-tier seeds → expected 1–2
claims at the 20–25% gate. Note the n-size: a single small-market cohort cannot
clear the gates statistically (see §6).

---

## §5 Benchmark gates

Gates are evaluated on the **combined cohort** (all campaigns in the wave, e.g.,
Madison + Milwaukee for one category). Thresholds are launch defaults — tune
after the first two cohorts, then freeze per category.

| # | Gate | Formula | Threshold | Reads as |
|---|---|---|---|---|
| G1 | Contactable rate | contactable / seeds | ≥ 40% | Market-density gate: below this, the city/category is too thin to farm efficiently |
| G2 | Claim rate | consumed tokens / invited, within 30 days of first invite | ≥ 20% | Wedge test: "your listing is already live, come verify it" must beat cold-outreach norms (5–15%) |
| G3 | NAP verified | verification events / claims | ≥ 80% | Should be near-automatic (claiming IS verification). Failure points at pre-fill quality, not owner willingness |
| G4 | Paid conversion | first paid tier ≤ 60 days after claim / claims | ≥ 10% | **The gate that matters.** Claims are free for the merchant; paying is the vote |
| G5 | Payback | CAC per paid / paid-tier monthly price | < 3 months | At $19/mo `presence`, CAC must be < ~$57 per paid customer |
| G6 | Retention | paid tenants active at claim + 90 days / paid | ≥ 70% | One renewal cycle survived |

**Leading indicator (track, don't gate):** `owner_corrected_nap` — claimed
owners who *correct* the pre-filled NAP convert to paid at a higher rate than
click-through claimers. Use it to prioritize paid-tier follow-up, and validate
the correlation on the first two cohorts before acting on it.

**What each failure means:**

- G1 fails in a new city → market-density problem; re-scope the city, not the product.
- G2 fails → the invite/claim wedge isn't landing; fix copy, sender, or timing before scaling.
- G3 fails → pre-filled NAP quality problem; tighten ingest, don't blame owners.
- G4 fails while G2 passes → monetization problem; the free claim is attractive but the paid ladder isn't. Fix the handoff (see `directory_presence_claim_handoff_spec.md`) before opening new markets.
- G5/G6 fail → unit-economics problem; the motion works but doesn't pay for itself at current outreach cost.

---

## §6 Cohort reporting & minimum sizes

**Cohort report (per campaign and per combined cohort):**

```
cohort: {category, city, state, focus, campaign_ids[]}
seeds, contactable, invited, claimed, nap_verified, owner_corrected,
paid_60d, retention_90d, cac, payback_months
+ per-gate: value, threshold, pass/fail, grade
```

**Grade rules (small-n honesty):**

- **Directional** — denominator < 20 contactable seeds (or < 5 claims for G4–G6). Report, never gate on it.
- **Decision-grade** — ≥ 20 contactable seeds AND ≥ 5 claims AND ≥ 2 paid conversions. Only decision-grade gate results feed the national-scaling decision.

Rationale: with ~5 contactable seeds (Madison-sized), one claim reads as 20%
and two as 50% — n is too small to gate on. Madison proves the *playbook*;
the Madison + Milwaukee combined cohort is the minimum viable cohort that
proves the *numbers*. Do not make the national decision on Madison alone.

**Per-category cuts:** every gate is also evaluated per `category` (Middle
Eastern vs. African vs. Caribbean vs. Mexican vs. Asian grocery). The halal
wedge (mosque-anchored trust, thin-footprint merchants) may claim differently
than denser, more digitally established categories. A category that fails G4
on two consecutive decision-grade cohorts is deprioritized in the expansion
matrix — the playbook is not category-portable until proven otherwise.

---

## §7 Capture gaps to build

| # | Gap | Build | Home |
|---|---|---|---|
| 1 | **Contactable flag** | Derive at seed creation from campaign phone + audit `identity_confidence`; store on the seed; absence recorded as `contact_unverified` (never `unreachable`) | `DirectoryPresenceSeedService.createFromCampaign` |
| 2 | **NAP verification diff** | At claim accept, diff owner-confirmed NAP vs. seed NAP per field; persist the diff + `owner_corrected_nap` boolean | `DirectoryClaimService.acceptClaim` (+ `directory-presence-public.ts` route) |
| 3 | **Claim-origin conversion source** | Add `'directory_claim'` to `ConversionSource` so first-paid attribution to the claim cohort is a query, not archaeology | `SubscriptionBillingService` (enum already carries `'portal_checkout'`) |
| 4 | **Outreach touch log** | Record manual contacts (call/email/mail) per seed with timestamp + outcome; feeds CAC and follow-up timing | New lightweight table (or reuse CRM tickets with a kind) — see §9 Open Questions |
| 5 | **Hold-state tasks** | Hold-status seeds (identity conflict, `contact_unverified`) get verification tasks (e.g., "verify phone via DATCP MyDATCP lookup") with owner + resolution; holds are workflow state, not prose footnotes | New `directory_seed_tasks` (or CRM-ticket kind) |
| 6 | **Cohort funnel view** | SQL view / endpoint computing §4 metrics grouped by campaign and combined cohort, with per-gate grading | New admin analytics route + page under `/settings/admin/marketing-ops` |

---

## §8 Implementation mapping

| Layer | File / service | Change |
|---|---|---|
| Seed ingest | `apps/api/src/services/DirectoryPresenceSeedService.ts` (`createFromCampaign`) | Derive + persist contactable flag (Gap 1) |
| Campaign bond | `apps/api/src/services/DirectorySeedCampaignLinkService.ts` | Expose cohort membership for rollups (campaign → category/city/state/focus) |
| Claim accept | `apps/api/src/services/DirectoryClaimService.ts` (`acceptClaim`), `apps/api/src/routes/directory-presence-public.ts` | NAP diff capture + verification event (Gap 2) |
| Billing attribution | `SubscriptionBillingService` (`ConversionSource`) | Add `'directory_claim'` source (Gap 3) |
| Outreach/tasks | new service + table (Gap 4, 5) | Touch log + hold-state verification tasks |
| Reporting | new admin route + page (Gap 6) | Cohort funnel report with per-gate grading |

Non-goals for v1: no LLM in the metrics path; no changes to public claim UX
(the claim handoff spec owns that surface); no new public-facing claims —
all analytics derive from first-party events.

---

## §9 Open Questions

1. **Task storage:** new `directory_seed_tasks` table vs. reusing `crm_support_tickets` with a task kind. Reuse avoids a table but couples GTM workflow to CRM semantics — decide at implementation.
2. **CAC allocation:** simplest defensible v1 is `total outreach labor cost in cohort / paid count` (labor hours × loaded rate + per-invite costs). If outreach is operator-time only, track touches and apply a standard cost-per-touch until real cost data exists.
3. **Multi-tenant edge:** if a claimed tenant later subscribes through a non-claim channel first, the 60-day attribution window may miss it. Decide whether the window extends on first *engagement* (dashboard login) rather than strictly `consumed_at + 60d`.
4. **Token expiry vs. window:** confirm claim-token TTL ≥ the 30-day G2 window (or that re-issue is automatic), so expired tokens don't artificially depress claim rates.
5. **Published-at column:** verify `directory_presence_seeds` exposes a publish timestamp distinct from `created_at` (seeds may be created unpublished); the G2 30-day clock should start at first invite, but seed-age reporting wants the publish timestamp.

---

## §10 National-scaling decision rule

Open the next wave (next city and/or next category) only when, on the combined
decision-grade cohort:

1. G1–G4 all pass at decision grade, **and**
2. G5 (payback) and G6 (retention) pass, **and**
3. the passing result has been reproduced in ≥ 2 distinct cities and ≥ 2 distinct categories (proves city-portability and category-portability separately — Madison alone proves neither).

Until then, every new city/category wave is a *measurement* cohort: seed it,
invite it, measure it — and let the gates, not enthusiasm, promote it.

---

## §11 Implementation notes (v1.1 — plumbing built)

The measurement layer is implemented. What exists, and where it deviates from
the v1 spec text:

**Built:**

| Piece | Home |
|---|---|
| Migration 258 — `contact_status` + `contact_status_derived_at` + `nap_verified_at` + `nap_owner_corrected` on `directory_presence_seeds`; `directory_seed_nap_verifications` table; contactable backfill | `database/migrations/258_seed_funnel_analytics.sql` |
| Contactable derivation at seed creation (phone or owner phone present → `contactable`, else `contact_unverified`) | `DirectoryPresenceSeedService.createSeed` |
| NAP verification stamp at claim (both self-claim and operator-approved paths) | `DirectoryClaimService.acceptClaim` / `approveClaimRequest` |
| Owner-correction capture: field-level diff on claimed-seed NAP updates → verification row + `nap_owner_corrected` flag | `DirectoryPresenceSeedService.updateFields` |
| `'directory_claim'` added to `ConversionSource` | `MarketingCampaignService` |
| Cohort funnel metrics + G1–G4 gate grading (directional vs. decision-grade per §6) | `SeedFunnelAnalyticsService` |
| Admin endpoint | `GET /api/admin/directory/presence-seeds/funnel/cohorts` (query: `campaignIds`, `category`, `city`, `state`, `focus`) |

**Deviations from v1 spec text (accepted):**

1. **G4 proxy.** Tenants carry no tier-change history table, so "paid within
   60 days of claim" is approximated by "claimed seed's tenant is on a paid
   tier now" (`subscription_tiers_list.price_monthly > 0`). For young cohorts
   these coincide; revisit when subscription history exists.
2. **G3 semantics.** `nap_verified_at` is stamped at claim accept — the claim
   itself is the owner's confirmation of the seed-filed NAP (OTP-verified when
   bound; operator-reviewed for approved requests). Later corrections are
   tracked separately (`nap_owner_corrected` + diff rows) and feed the
   `owner_corrected_nap` leading indicator.
3. **G2 window.** Computed in SQL as `consumed_at <= created_at + 30 days` on
   the claim token — no separate event needed.
4. **G5/G6 deferred.** Returned as `deferredGates` with reasons; not graded
   until outreach-cost allocation and renewal history exist.
5. **Contactable nuance.** `createFromCampaign` clamps `identity_confidence`
   to high/medium at seed level, so the phone-presence test is the effective
   discriminator; absence of a phone is `contact_unverified`, never
   `unreachable` (§2 evidence-safety rule preserved).
6. **ConversionSource home.** The `ConversionSource` union lives in
   `MarketingCampaignService` (not `SubscriptionBillingService` as §8
   assumed); the new value was added there.

**Still open (from §7):** outreach touch log (partially covered by the 257
`outreach_state` machine), hold-state verification tasks (partially covered by
the 255 prospect-queue `verify_then_outreach` flow), operator-facing funnel UI
(endpoint exists; no page yet), and CAC cost allocation.

**Tests:** `apps/api/src/services/__tests__/SeedFunnelAnalyticsService.gradeGates.test.ts`
(gate grading, thresholds, small-n rules) and
`apps/api/src/services/__tests__/DirectoryPresenceSeedService.napVerification.test.ts`
(owner-correction diff capture, claimed-only gating, no-op exclusion).
