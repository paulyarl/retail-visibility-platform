# Real Retailer Onboarding Spec — Recruit & Onboard, Current State

**Status:** draft (v0.1 — readiness framing against the platform **as it exists
today**, not against any MVP-era spec. Written 2026-10-24, the day indexing
went live and the first claimed tenant — Global Grace Grocery — was already
real.)

**Purpose:** The original goal was always *onboard real retailers*. Every
MVP-era spec predates the machinery that now exists (seeds, claim tokens,
proving grounds, sitemap indexing, chain feed). This doc re-frames
recruit-and-onboard against what is actually built, names the two doors a
real retailer can walk through, and lists what must be true before we
deliberately recruit.

## 1. Why now

- **Indexing is proven end-to-end** — sitemap submitted, `Success`, 160
  discovered, first seed indexed same-day (`SEARCH_CONSOLE_OPERATOR_GUIDE.md`
  operator log). A retailer who signs up today can be on Google this week —
  the core promise is demonstrable, not promised.
- **A real retailer is already onboard.** `tid-vqg85k8p` (Global Grace
  Grocery) claimed — `org_standing_mode=independent`, live `/directory/` +
  `/tenant/` surfaces. The claim path has already produced the thing we're
  recruiting for.
- **The funnel is instrumented** — `seed_funnel_benchmark_gates` stages are
  stored queries: discover → seed → invite → claim → verify → paid.
- **The ghost-account problem is solved at the data level** — smoke-test
  tenants retired via `location_status` (2026-10-24); the sitemap and public
  surfaces now show only real inventory. Recruiting into a clean shelf is
  the pitch.

## 2. The two doors

A real retailer arrives by exactly one of two paths. They converge after
account creation — the difference is who did the data entry.

### Door A — Claim-assisted (the seeded motion, primary)

```
discovery scan → queue row → seed published (/place/{slug})
→ operator invite (claim token) → owner clicks → OTP / operator approval
→ claimed → gateway upgrade triad (presence / discovery / storefront)
→ paid tier → deliverable pipeline
```

Every step exists and is load-bearing today: `DirectoryClaimService.acceptClaim`
flips the tenant to `independent`, embeds the upgrade triad in the response,
and the owner lands on Entry Presence mode cards (`directory_presence_claim_
handoff_spec.md`). The retailer's listing is *already live and already
indexed* before they ever create a password — the call opener is "your
listing is already up, let me make sure it's telling the truth"
(`CONSULTATIVE_CALL_SPEC` Beat 1).

**This is the recruiting door.** It converts a stranger into an owner with
near-zero typing: NAP, hours, categories, attributes are pre-filled from
sourced provenance — they correct, they don't author.

### Door B — Self-serve signup (the cold motion, secondary)

```
/signup → /auth/signup/wizard (benefits → info → tier select → Auth0)
→ /(platform)/onboarding (store identity → hours → branding → settings)
→ /t/{tenantId}/onboarding checklist → Quick Start products → live storefront
```

All pieces exist: the wizard collects `preferredTier` (accepts `?tier=` deep
link — outreach copy can deep-link a retailer into a chosen tier), the
OnboardingWizard runs five steps with save-resume (`OnboardingStateService`),
`TrialSetupModal` handles trial-tier selection, and Quick Start generates a
starter catalog in ~1s (`QUICK_START_FEATURE.md` — the drop-off-killer from
the MVP era, still the right answer).

**Caveat — this door has never been walked by a stranger.** It exists, it
renders, but no real retailer has ever completed it cold. Treat it as
unproven until the readiness audit below is run.

## 3. Readiness audit — what must be true before recruiting

| Stage | Claim door | Self-serve door |
|---|---|---|
| Discoverable | ✅ seed page live + indexed | ✅ (same surfaces, once content exists) |
| Account creation | ✅ customer auth on claim accept | ⚠ wizard exists; end-to-end untested |
| Profile/NAP | ✅ pre-filled from provenance | ⚠ wizard steps exist; save path is the MVP-era surface — verify the API contract still holds |
| Products | ◐ 5 free slots = claim incentive; catalog gated until upgrade | ✅ Quick Start + import wizard + barcode wholesale |
| Storefront live | ✅ `/tenant/{id}` + canonical ladder | ✅ same + subdomain assignment |
| Own domain | ✅ `custom_domains` + canonical ladder | ✅ same |
| Tier/billing | ✅ upgrade triad embedded in claim accept | ⚠ trial machinery exists (`trial_selected_tier`, 14-day expiry) — verify the claim-door doesn't collide |
| Verification | ◐ OTP/operator today; physical-anchor spec is draft | same |
| Indexing | ✅ auto via sitemap | ✅ auto via sitemap (canonical-ladder `<loc>`) |
| Support surface | ✅ Requests Hub + CRM tickets | ⚠ a cold signup has no operator context — who answers? |

✅ proven in prod · ◐ partial/draft · ⚠ exists but unverified for a stranger

## 4. The recruiting posture — concierge first, self-serve second

**Phase 1 (now): concierge onboarding.** Every real retailer enters through
the claim door *with an operator on the call*. The consultative-call spec is
the script; the seed is the door-opener. First target: the Indianapolis +
Madison cohorts already in the funnel. Metric: time from claim-link click to
`claimed` — the funnel spec already stores it.

**Phase 2: assisted self-serve.** Outreach copy deep-links `?tier=` into the
wizard; the operator stays on the call while the retailer types. This *is*
the self-serve test harness — every friction point observed on a guided call
is a fix before cold traffic.

**Phase 3: cold self-serve.** Only after a guided retailer has completed the
wizard without operator intervention is the door advertised bare. Until then
`/signup` exists but is not the funnel's front entrance.

## 5. What breaks if we skip the audit

- **The claim door works; the cold door is untested.** Recruiting cold
  traffic before Door B is walked once, guided, produces a first impression
  we can't unmake. The MVP-era wizard's save contract (`POST /api/tenant/
  profile`) is a known-TODO-era surface — verify it end-to-end on staging
  before any cold link goes out.
- **Verification is still OTP-grade.** `CLAIM_VERIFICATION_SIGNALS_SPEC` is
  draft — a ghost can still claim with phone control alone. Acceptable at
  concierge scale (the operator IS the verification); not acceptable at cold
  scale.
- **Retired/dead storefronts still serve 200 self-canonical.** Recruiting
  onto a shelf that includes tombstones is a credibility leak — flag for the
  next hygiene pass (operator guide log, 2026-10-24).

## 6. The one-line readiness test

A market is ready to recruit when a stranger can go from *claim link in
their inbox* to *their products indexed on Google* without an operator
touching a database — and we can already prove each hop works, because the
claim door proved them today.
