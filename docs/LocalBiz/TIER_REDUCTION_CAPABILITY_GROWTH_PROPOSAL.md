# Tier Reduction & Capability-Purchase Growth — Proposal

**Status:** Draft for decision
**Date:** 2026-10-16
**Companion to:** `shared/tier-contract.json`, `docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md`,
`.devin/skills/tier-hierarchy.md` (V3.1), `.devin/skills/three-tier-feature-gating.md`,
`docs/PLATFORM_STRATEGY_V3.md`, `docs/audits/BSAAS_FEATURE_INVENTORY_AUDIT.md`

---

## 1. The pivot, in one line

> Growth moves from **"upgrade to the next tier"** to **"buy the capability you're missing."**
> The tier ladder stops being the growth engine and becomes a packaging decision — price points,
> domain-engagement sets, trial wrappers, and the org baseline.

Everything below is written against that pivot. The tier-count reduction is the *consequence*,
not the goal.

---

## 2. What we're actually working with (verified)

### 2.1 The tier key universe — 33 keys

From `shared/tier-contract.json` (D8, decided 2026-10-16):

| Class | Count | Notes |
|---|---|---|
| `active` | 10 | What a customer can buy today |
| `inactive_legacy` | 6 | `google_only`, `starter`, `chain_*`, `custom` — in order arrays, off GTM paths |
| `pseudo_tiers` | 17 | 15 `trial_*` mirrors + `seed_preview` + `expired_trial` |

The 10 active tiers are **not 10 products**. They are a **3+3+3 matrix plus a gateway**:

| Layer | Tiers | Price |
|---|---|---|
| Gateway | `directory_presence` | $0 |
| Entry Presence (3 modes) | `presence`, `discovery`, `storefront` | $19 / $29 / $59 |
| Commerce (3 money modes) | `commitment`, `ecommerce`, `omnichannel` | $79 / $99 / $149 |
| Scale (3) | `professional`, `organization`, `enterprise` | $199 / $499 / $499 |

### 2.2 Five of the ten active tiers declare no features of their own

In the web copy (`apps/web/src/lib/tiers/tier-features.ts`), `TIER_FEATURES` has bags for only
`directory_presence`, `presence`, `google_only`, `starter`, `professional`, `enterprise`,
`organization`, `chain_*`. **`discovery`, `storefront`, `commitment`, `ecommerce`, `omnichannel`
contribute zero features directly** — they exist to hold a price and a position in the inheritance
graph. (The DB does carry explicit rows for them via migrations 112/118/125/128; the *shape* is
still the tell.)

That is the strongest single piece of evidence for the reduction: several tiers are **SKUs and
inheritance nodes, not bundles.**

### 2.3 The capability architecture already models the modes

The commerce triad is *already* a capability dimension, not just a ladder:

- Feature keys `commerce_deposit_only`, `commerce_full_payment`, `commerce_flexible` exist.
- `resolveCommerce` produces `effectivePaymentType: 'deposit' | 'full' | 'flexible'`.
- `tipEngine.ts` reads exactly that (`hasDepositOnly`, `hasFullPayment`, `hasBothPaymentPaths`).

Omnichannel is literally `commitment + ecommerce`. Three tiers expressing one capability dimension
is the clearest collapse candidate in the model.

### 2.4 The BSaaS store is already a full commerce surface

Verified against schema and routes:

| Mechanism | Table / route | What it gives |
|---|---|---|
| À-la-carte feature purchase | `bsaas_catalog` → `tenant_feature_purchases` | Per-feature SKU, `price_cents`, `billing_cycle` (`one_time`/`weekly`/`monthly`/`annual`) |
| **Module (bundle) purchase** | `bsaas_bundles` + `bsaas_bundle_items` | Cross-domain bundles, one price, N feature keys |
| **Trials** | `trial_days`, `trial_eligible` on both tables | `status='trial'`, no charge until expiry |
| **Flexible domain unlock** | `{capability}_flexible` keys | One purchase unlocks *every* sub-feature in a capability type |
| Promo codes / coupons | `bsaas-promotions.ts` + `CouponTargetService` | Stripe coupons, targeted |
| Grant tokens (QR) | `bsaas_grant_tokens` + `bsaas_grant_token_claims` | Complimentary / distribution grants |
| Grace + renewal | `bsaas-renewal.ts` | `active → past_due (7d grace) → suspended` |
| Revenue analytics | `bsaas-analytics.ts` | MRR, per-feature revenue, churn |
| Store UI | `/(platform)/settings/feature-store` | Features / Bundles / Services tabs, recommended grouping |
| Recommendation engine | `apps/web/src/lib/store/storeRecommendations.ts` | Already scores **capability-gap** vs **next-tier-bridge** |

The `BSAAS_FEATURE_INVENTORY_AUDIT.md` (2026-07-04) recorded **7 catalog SKUs** and identified
**17 flexible domain-unlock candidates** (chatbot $49, org $49, crm $39, social commerce $39, …).
Migrations since (244, 329, …) have added more — the current count needs a re-query, but the
inventory of sellable surface is large and already designed.

### 2.5 The one structural blocker

`checkCapabilityEngagement` in `apps/api/src/routes/bsaas-purchases.ts:314` enforces the
**"active capability engagement"** rule:

> A tenant may purchase a feature à la carte **only if their tier already grants ≥1 feature in that
> same capability type.** Otherwise the store returns `upgrade_required` and the card shows
> *"Upgrade Required"* with a link to `/settings/store?tab=plans`.

**Today, BSaaS is a within-domain upsell, not a new-domain on-ramp.** You cannot buy your way into a
capability domain you don't already have — you must upgrade a tier first. That single rule is what
currently keeps the tier ladder as the growth gate, and it is the first thing the pivot must decide.

---

## 3. The central decision (make this before anything else)

For capability purchase to be the growth driver, one of two things must be true:

| Option | What it means | Effect on tier count |
|---|---|---|
| **A. Tiers stay as domain-engagement sets** | Keep the rule. A tier's job becomes "which capability domains are open to you." Broad tiers, fewer of them. | Tiers reduce to a small number of *engagement scopes*; price points can still differ |
| **B. Relax the engagement rule** | Any domain is purchasable à la carte. Tiers become near-pure price points + org baseline + trial wrapper. | Tiers reduce to a handful of pure price/limit SKUs |

Option B is the true "BSaaS is the growth driver" end state — but it needs a store-sale-eligibility
decision that the contract sprint already flagged in a different context (D7: *the store must not
sell a module whose tier carries a `_disabled` veto*). Whatever is chosen, the rule change is a
**store-eligibility change**, and it belongs in `store-purchases-capability-checklist.md`, not in a
drive-by edit.

**Recommendation:** run **A** first (fewer, broader engagement tiers — lowest risk, keeps the
veto/engagement safety rails), and treat **B** as the follow-on once the store has proven the
purchase motion.

---

## 4. Reduction options, ranked

| # | Collapse | What changes | Price impact | Index impact | Cost | Verdict |
|---|---|---|---|---|---|---|
| **1** | **Commerce triad → 1 tier + money-mode capability** | `commitment`/`ecommerce`/`omnichannel` → one commerce tier; mode selected via `commerce_deposit_only` / `commerce_full_payment` / `commerce_flexible` | Loses 2 price points ($79/$99) unless kept as priced capability add-ons | Removes 2 order positions | **Low** — resolver already models it (`resolveCommerce`) | **Do this first.** Architecture already agrees |
| **2** | **`organization` + `enterprise` merge** | Both are $499 with overlapping inheritance | Neutral (same price) | Removes 1 position | **High** — `organizations_list.subscription_tier` + `org_standing_mode` make org a *relationship*, not a tier | Only if org-as-relationship can live elsewhere. Likely a trap |
| **3** | **Presence modes (`presence` $19 / `discovery` $29 / `storefront` $59)** | Collapse to gateway + one paid presence | Loses the $19 default CTA off the gateway | Removes 1–2 positions | **Medium** — these are *surfaces*, and V3's whole thesis is that they're distinct jobs | Risky; mis-selling the castle is the problem V3 solved |
| **4** | **Legacy / pseudo prune** | Nothing customer-facing | None | None (already exempt by class) | **Zero** | Free if the goal is a smaller *code* count |

**Ranking logic:** #1 is cheap because the capability layer already expresses the axis. #2 looks
cheap (same price) but is expensive because org is structural. #3 is cheap mechanically but
expensive strategically.

---

## 5. The hidden opportunity: collapse the *copies*, not just the count

The tier model is duplicated across **six order arrays** that do not all agree. Reducing the count
is the natural moment to unify them — and the divergence is already live:

| File | Order array | Divergence |
|---|---|---|
| `apps/web/src/lib/growth-tips/tipEngine.ts:91` | 16-key canonical | `starter` at index 3 |
| `apps/api/src/services/GrowthTipService.ts:144` | 16-key canonical | `starter` at index 3 |
| `apps/api/src/services/QuickLinksService.ts:159` | 16-key canonical | Aligned (was missing `presence`/`ecommerce`/`organization` — fixed, see comment) |
| `apps/api/src/services/NextStepsService.ts:184` | 16-key canonical | Aligned (same fix) |
| `apps/api/src/middleware/tier-access.ts:242` | **11-key, local** | **`omnichannel` MISSING entirely**; `starter` sits at index 4 (after `discovery`) |
| `apps/web/src/lib/tiers/tier-resolver.ts:215/225` | 10-key active-only subset | Deliberate public-comparison subset |

`tier-access.ts:242` is the outlier. With `omnichannel` absent, `tierOrder.indexOf('omnichannel')`
is `-1`, so the `FEATURE_TIER_MAP` fallback (`tierIndex >= requiredIndex`) evaluates **false** for an
omnichannel tenant. It is only the *fallback* path (after `TIER_FEATURES` + hierarchy checks), but
it is exactly the class of silent divergence the contract sprint exists to catch — the doc's own
warning: *"missing either collapses index fallbacks and mis-gates capabilities."*

**So the reduction has a second deliverable:** replace the six copies with one import from
`shared/tier-contract.json` (or a generated `lib/tier-contract.ts`). A smaller tier set makes that
unification tractable in a way it isn't at 33 keys.

---

## 6. Migration surface — the files a reduction touches

Grouped by role. This is the real cost of any collapse.

**Order / index arrays (the six above)**
- `apps/web/src/lib/growth-tips/tipEngine.ts`
- `apps/api/src/services/GrowthTipService.ts`
- `apps/api/src/services/QuickLinksService.ts`
- `apps/api/src/services/NextStepsService.ts`
- `apps/api/src/middleware/tier-access.ts`
- `apps/web/src/lib/tiers/tier-resolver.ts`

**Feature bags / maps / display / pricing (web copy)**
- `apps/web/src/lib/tiers/tier-features.ts` — `TIER_FEATURES`, `TIER_HIERARCHY`, `FEATURE_TIER_MAP`, `TIER_DISPLAY_NAMES`, `TIER_PRICING`, `TIER_FEATURE_LIMITS`
- `apps/web/src/lib/tiers/capability-display.ts` — `COMPARISON_TIERS`
- `apps/web/src/lib/chain-tiers.ts`, `apps/web/src/lib/tiers/chain-pricing.ts`
- `apps/web/src/lib/landing-page-tiers.ts`, `apps/web/src/lib/qr-tiers.ts`

**Trial / limits**
- `apps/api/src/utils/trial-tier-transparency.ts` — `getBaseTierForTrial` map
- `apps/api/src/services/subscription/TrialManagementService.ts`
- `apps/api/src/utils/tier-limits.ts` — `SubscriptionTier` type, `TIER_LIMITS`
- `packages/shared/src/lib/tiers.ts` — `TRIAL_ELIGIBLE_TIERS`

**Capability resolution**
- `apps/api/src/services/EffectiveCapabilityResolver.ts` (+ `./resolvers/*`)
- `apps/api/src/services/TierService.ts` — `getBaseTierForTrial` map, `loadTiers`

**Growth / recommendation surfaces (the pivot's front end)**
- `apps/api/src/services/GrowthTipService.ts`, `QuickLinksService.ts`, `NextStepsService.ts`
- `apps/web/src/lib/store/storeRecommendations.ts` — `TIER_BRIDGE_CAPABILITIES` (per-tier bridge sets)
- `apps/web/src/app/(platform)/settings/feature-store/page.tsx`
- `apps/web/src/app/(platform)/settings/subscription/page.tsx`

**Upgrade-path hardcoding**
- `apps/api/src/routes/directory-presence-upgrade.ts:127` — `['presence','discovery','storefront']`
- `apps/api/src/services/DirectoryPresenceUpgradeOptionsService.ts:108` — same triad

**Store / eligibility**
- `apps/api/src/routes/bsaas-purchases.ts` — `checkCapabilityEngagement`, `checkBundleEngagement`, `checkTierFeatureStatus`, `PARENT_GATE_FEATURES`

**DB / migrations**
- `database/migrations/*` that `INSERT INTO subscription_tiers_list` / `tier_features_list`
- The `mv_tenant_effective_capabilities` materialized view (refresh ≤10 min)

**Docs / contract**
- `shared/tier-contract.json` (the canonical fixture)
- `.devin/skills/tier-hierarchy.md` (V3.1)
- `docs/PLATFORM_STRATEGY_V3.md`
- `docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md`

**Tests that pin the model**
- `apps/web/src/lib/tiers/tier-contract-order.test.ts`
- `apps/api/src/services/__tests__/tier-contract-order.test.ts`
- `apps/web/src/lib/tiers/entry-presence-tier.test.ts`
- `apps/api/src/utils/__tests__/tier-limits.test.ts`

---

## 7. Back-compat (left open, per your call)

Not decided here. The two precedents on the table:

- **Dormant keys** — the existing `inactive_legacy` pattern: removed tiers stay in `tier_order` as
  inactive so no tenant's index or trial wrapper moves. This is what D9 chose for `starter`.
- **Hard migration** — rewrite `tenants.subscription_tier` to the successor key, with a data
  migration and trial-map changes.

**Why it matters (the D9 lesson):** moving `starter` from index 3 → 11 was rejected *solely* because
it would change `tierIndex('starter')` for live legacy tenants. Any collapse that changes an
existing key's index position is a live behaviour change on the tip / quick-link / upgrade surfaces.
That is the thing to get right, not the deletion itself.

---

## 8. Sequencing I'd recommend

1. **Decide §3** (engagement rule: A or B). Everything else depends on it.
2. **Fix `tier-access.ts:242`** independently — it's a live divergence and cheap.
3. **Prove the pattern with option #1** (commerce collapse): one tier + money-mode capability,
   asserted against `shared/tier-contract.json`, with the order arrays unified to a single import.
4. **Pivot the growth surfaces** to capability purchase: tips, quick-links, next-steps and the
   store recommendation engine point at `/settings/feature-store`, not `/settings/subscription`.
   (`storeRecommendations.ts` already has the scoring; it needs to lead instead of trail.)
5. **Re-audit the BSaaS catalog** (the July audit is stale) and price the 17 flexible unlocks as the
   primary offer.
6. **Then** consider #2 and #3 with the pattern proven.

---

## 9. Open questions

1. **Engagement rule** — A (tiers open domains) or B (any domain purchasable)? (§3)
2. **Price points** — if commerce collapses to one tier, do $79/$99 survive as *priced capability
   add-ons* or disappear?
3. **The `presence` $19 CTA** — is "own your directory listing" a standalone job, or does it fold
   into the free gateway? (It is currently the *default* paid CTA off the gateway.)
4. **Org as relationship** — can `organization` stop being a tier without breaking
   `organizations_list.subscription_tier` + `org_standing_mode`?
5. **Back-compat** — dormant keys or hard migration? (§7)
