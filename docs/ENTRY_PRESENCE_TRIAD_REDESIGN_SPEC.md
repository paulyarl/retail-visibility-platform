# Entry Presence Triad Redesign — Spec

**Status:** Draft — captured for record tracking before implementation
**Date:** 2026-10-21
**Scope:** `directory_presence` gateway upgrade triad (`presence` / `discovery` / `storefront`), SKU limits, commerce module activation, BSaaS catalog

---

## 1. Context

This redesign follows the seed-claim capability funnel shipped in commit `020d9ca` ("Store Emerging Market Audit Upgrades"):

- Claim now writes `seed_claim` promo grants (`tenant_feature_purchases`) — flyer taste (directory + place, 5 items) and QR taste (classic, directory target, 512px), one-year expiry, idempotent, never demotes paid rows.
- `checkCapabilityEngagement` / `evalCapabilityEngagement` in `bsaas-purchases.ts` are now grant-aware — an active grant in a capability module opens that module's à-la-carte catalog (`hasGrantEngagement`), so a claimed `directory_presence` tenant can buy `flyer_flexible` / `storefront_qr_flexible` etc.
- Migration 350 repriced `storefront_qr_flexible` to $25/mo and added individual QR option SKUs ($2–5). Migration 351 backfills claim grants (no-op — zero claimed seeds on either env).
- Unclaimed seeds remain constrained to the `directory_presence` gateway allowlist — grants are claim-triggered, never tier keys.

That work made the gateway upgrade ladder the next seam: a claimed tenant's "what can I upgrade to" answer is the Entry Presence triad — and its first rung is hollow.

## 2. Problem: `presence` is a null product

Sentinel-filtered diff of the DB witness (`shared/tier-contract-db-witness.json`):

- `presence` adds only `barcode_*` positive keys — but carries its own `barcode_disabled` veto → net add: **zero**.
- Everything it "drops" vs `directory_presence` (crm/quickstart/product_types/storefront_opt) is vetoed in `directory_presence` anyway → net drop: **zero**.
- Both veto `directory_entry`, `directory_promotion`, `faq`, `product_options`, `storefront_domains`.
- `presence` limits are **worse**: `maxSkus: 0` vs `directory_presence`'s 5.

Effective capability delta between `directory_presence` ($0) and `presence` ($19): **nothing** — the first paid rung sells a label change and *loses* 5 product slots. Display-name collision (`presence` and retired `starter` both render "Starter") makes it worse.

## 3. Design decisions (recorded)

| Decision | Outcome |
|---|---|
| `presence` fate | **Repurpose as the commerce surface** — all-purpose visibility surface for store and products with **deposit commerce**; full commerce via flexible upgrade |
| `presence` display name | **"Storefront+"** (kills the "Starter" legacy collision) |
| `presence` price | **$39/mo** (was $19 null product) |
| `presence` gateways | **Stripe only** natively — `payment_gateway_flexible` ($25) for the other three |
| `discovery` fate | **Rename as SWIS mode** — products to Google, no commerce |
| `storefront` fate | **Browsable storefront, no commerce** |
| Commerce beyond deposit | **Flexible purchase** — `commerce_flexible` / `payment_gateway` expansion as BSaaS keys, not a third tier |
| Product host (all modes) | SWIS needs a hosted surface for Google's product links — **all three modes grant `storefront_domains_platform_subdomain` by default**; `storefront_domains_custom_domain` is a **flexible BSaaS purchase, never a tier key** |
| SKU parity | **All three modes `maxSkus: 200`** — only the display surface differs |
| **Mode parity** | **Tiers are starting bundles, not silos.** Any triad mode can acquire another mode's signature surface via `*_flexible` purchase — presence→storefront, storefront→SWIS, discovery→commerce, any combination — without switching tiers. Requires: (a) triad bags must **remove sibling-mode `*_disabled` vetoes**; absent = off-but-open (purchasable), vetoed = upgrade-gated — a deliberate "held for tier up" wall; (b) the engagement gate relaxes to **deny-by-veto** so a silent module accepts its first purchase (cold start), with positive-engagement kept as store-merchandising signal, not the gate |
| **`_disabled` semantics** | A veto is an **intentional gate to an obvious upgrade** — only modules *off-limits to the triad* carry it (reserved as tier-upgrade differentiators). **Commerce and fulfillment must NOT be vetoed on triad tiers** — they're open à-la-carte surfaces, not upgrade walls |
| **Upgrade-gated modules** (veto on triad) | `wholesale_matching_options`, `chatbot_options`, `funnel_options`, `social_commerce_options`, `organization_options`, `coupon_options` — held for the ladder above the triad. **Rationale**: the triad sells *surfaces* (where products live), the upper ladder sells *growth tooling* (how they're pushed — want coupons/funnel/social/wholesale/chatbot/multi-location? upgrade). These vetoes are the tier pull — a purchase can't beat them, so the modules stay ladder-exclusive by design |
| **Explicitly open** (no veto) | `gbp_management`, `integration_options` — plus the mode surfaces (`storefront_types`/`storefront_options`, `storefront_domains`, `commerce_types`, `payment_gateway_options`, `fulfillment_options`) and everything not listed above |
| **Integration options = enabler** | Integrations enable the modes themselves — never vetoed on the triad. **Each mode grants its mode-specific integration keys natively; `integration_flexible` stays purchasable for the rest** — e.g. `discovery` gets `integration_google_*`/`integration_gmc_sync` (SWIS), `storefront` gets POS/catalog sync (`integration_square`/`integration_clover`/`integration_pos_*`), `presence` gets commerce-relevant sync (square/GBP propagation) — exact per-mode key split in open decisions |
| **`directory_presence` scope** | **Stays constrained** — claimed seeds buy only engagement-seeded modules (flyer/QR/GBP via claim grants); surfaces require a triad tier. Rationale: `maxSkus` is the one dimension no flexible key can buy — capacity is tier-exclusive, so gating surfaces preserves the upgrade motion and trains the upgrade habit early. Gate semantics: deny-by-veto applies to triad+ tiers; `directory_presence` keeps the positive-engagement requirement |
| `google_only` | Stays **dormant** (`is_active: false`) — its bag donors to `discovery` via inheritance |

Resulting mode choices presented to a claimed tenant:

1. **SWIS** — catalog pushed to Google surfaces, no hosted storefront
2. **Storefront** — hosted browsable catalog, no SWIS feed, no checkout
3. **Commerce** — all-purpose visibility surface + deposit commerce

## 4. Current-state evidence

| Tier | Price | sort | active | maxSkus | Notes |
|---|---|---|---|---|---|
| `directory_presence` | $0 | 0 | yes | 5 | Gateway; sentinel-matrix bag (~114 positive keys, 12 vetoes) |
| `google_only` | $29 | 1 | **no** | 250 | Dormant SWIS bag: `integration_google_merchant_center`, `integration_google_shopping`, `basic_product_pages`, bulk import, barcode/manual entry |
| `presence` | $19 | 10 | yes | **0** | Null product (see §2); "Starter" display collision |
| `discovery` | $29 | 20 | yes | 75 | Already effectively SWIS via `google_only` inheritance; carries dead-weight positive commerce/payment/social rows under `commerce_disabled` veto |
| `storefront` | $59 | 30 | yes | 200 | Commerce already vetoed; catalog surface |
| `ecommerce` | $99 | 50 | yes | 1000 | First tier where `commerce_*` actually activates today |

Module mechanics (verified):

- `commerce_types`: `commerce_enabled`/`disabled`/`flexible`, `commerce_deposit_only`, `commerce_full_payment`.
- `payment_gateway_options`: `enabled`/`disabled`/`flexible` + `stripe`/`paypal`/`square`/`clover`. `PaymentGatewayResolver.checkout_available` = `enabled` AND ≥1 effective gateway; `flexible` grants all four.
- `storefront_domains`: `platform_subdomain` only actually activates at `commitment`/`ecommerce`/`omnichannel` today — `discovery`/`storefront` carry all five keys **plus the veto** (dead weight); `google_only` has none.
- `_disabled` = absolute resolver veto, beats every other source (key_contract D7). Dead-weight positive rows under an active veto are behavior-inert.

Existing BSaaS catalog SKUs (prd, verified — **21 `*_flexible` SKUs, zero new catalog rows needed**):

| Cross-mode purchase | SKU | Price |
|---|---|---|
| → SWIS | `integration_flexible` (GMC/Shopping/GBP/POS/clover) | $29/mo |
| → Storefront surface | `storefront_flexible` (types) + `storefront_opt_flexible` (options) | $15 + $29/mo |
| → Commerce | `commerce_flexible` + `payment_gateway_flexible` | $15 + $25/mo |
| → Custom domain | `storefront_domains_custom_domain` | $10/mo |
| → Social commerce | `social_commerce_flexible` (Meta/TikTok shops) | $39/mo |
| → Directory entry chrome | `directory_entry_flexible` | $19/mo |
| → Everything else | faq/crm/quickstart/product_types/product_options/featured/fulfillment/flyer/qr/chatbot/barcode/org/wholesale/gbp_management `*_flexible` | $12–49/mo |

Grant-engagement consequence (already shipped): granting `storefront_domains_platform_subdomain` or `commerce_deposit_only` at tier seeds module engagement → the matching `*_flexible`/`custom_domain` SKUs become purchasable automatically.

Inheritance hazard map (fixture `inheritance` closure):

- `presence` is inherited by **nothing** — free to redesign aggressively, zero propagation.
- `discovery` is inherited by **everything above it** (storefront→commitment→ecommerce→omnichannel→professional→enterprise). Dropping its vetoed positive rows is net-neutral for discovery but the **per-tier diff must be verified** so no higher tier was silently leaning on them.
- The gateway triad key list `['presence','discovery','storefront']` in `DirectoryPresenceUpgradeOptionsService` does not change — only meaning/display names move.

## 5. Implementation outline (fixture-first)

Per `AGENTS.md` contract rules: edit `shared/tier-contract.json` first, then DB, then code; contract suites (`tier-*`, `mv-shape-lint`, `tier-doc-generation`) catch drift.

1. **Fixture** — `shared/tier-contract.json`: update `display_names`, `pricing`, `tier_layers`/bag declarations for the three triad tiers; document the new mode semantics.
2. **`presence` → commerce surface**
   - `TIER_LIMITS.presence.maxSkus`: 0 → 200.
   - Bag: drop `commerce_disabled` veto; grant `commerce_enabled` + `commerce_deposit_only` + `payment_gateway_enabled` + gateway key(s); un-veto `directory_entry` (full listing chrome — "all-purpose visibility surface").
   - Keep `commerce_full_payment`/`commerce_flexible` out — that is the flexible upgrade path.
   - **Mode-parity veto cleanup**: remove `*_disabled` rows for sibling-mode signature modules (integration_options, storefront_types/storefront_options, storefront_domains, fulfillment_options) — silent = purchasable. Keep the six upgrade-gated vetoes.
   - **Native integration keys**: commerce-relevant sync (square/GBP propagation) — per the open-decision split.
   - Migration to rewrite `tier_features_list` rows.
3. **`discovery` → SWIS mode**
   - `TIER_LIMITS.discovery.maxSkus`: 75 → 200.
   - Bag: keep SWIS surface (inherited `google_only` bag already flows); delete dead-weight positive `commerce_*`/`payment_gateway_*`/`social_commerce_*` rows; keep vetoes.
   - Un-veto `storefront_domains`: drop `storefront_domains_disabled`, keep `enabled` + `platform_subdomain`; drop `custom_domain`/`flexible` tier rows (flexible purchase path instead).
   - **Mode-parity veto cleanup**: remove `*_disabled` rows for sibling-mode signature modules (storefront_types/storefront_options → storefront surface, commerce_types/payment_gateway → commerce, fulfillment_options, integration_options) — silent = purchasable. Keep the six upgrade-gated vetoes (wholesale/chatbot/funnel/social_commerce/organization/coupon).
   - **Native integration keys**: grant `integration_google_enabled`/`integration_google_on`/`integration_google_merchant_center`/`integration_google_shopping`/`integration_gmc_sync` (+ GBP keys as relevant) — the SWIS signature.
   - Verify per-tier propagation diff for storefront+ before applying.
   - `google_only` remains dormant — bag donor + inheritance parent.
4. **`storefront`** — same un-veto set: drop `commerce_disabled`/`payment_gateway_disabled`/`integration_disabled`/`social_commerce_disabled`/`storefront_domains_disabled`/`fulfillment_disabled` rows so sibling surfaces are silent-not-vetoed (off but purchasable); keep `storefront_domains_enabled` + `platform_subdomain`; **native integration keys**: POS/catalog sync (`integration_square`/`integration_clover`/`integration_pos_*`); maxSkus already 200. Keep the six upgrade-gated vetoes. Display copy refresh.
   - **Engagement-gate relaxation**: `checkCapabilityEngagement`/`evalCapabilityEngagement` move to deny-by-veto — module purchasable unless the tier holds an active `*_disabled` veto for it; positive keys/grants remain engagement signals for merchandising/order, not the sale gate.
5. **BSaaS catalog** — no new rows needed: `storefront_domains_custom_domain` ($10), `commerce_flexible` ($15), `payment_gateway_flexible` ($25) all live and active on prd. "Full commerce" = the upgrade from deposit.
6. **DB migrations** — `tier_features_list` rewrites per tier + `subscription_tiers_list` display/price/active fields; manual-apply via `apps/api/scripts/apply-sql-file.cjs` under doppler.
7. **Witness re-dump + suites** — `doppler run --config prd -- node scripts/dump-tier-contract.cjs` → `shared/tier-contract-db-witness.json`, `node apps/api/scripts/sync-fixture-modules.cjs`, then `pnpm checkapi` + contract tests.

## 6. Open decisions

| Question | Options |
|---|---|
| `discovery` display name | "SWIS" (per the rename decision) vs "Discovery" vs "Google Visibility" |
| `presence` subdomain | Same `platform_subdomain` grant as other modes (products need a host) — assumed yes for consistency |
| Per-mode integration keys | Exact native split beyond discovery's `integration_google_*` — storefront: square/clover/POS? presence: square + GBP propagation? `integration_gbp`/`integration_propagation_gbp` placement |
| Existing tenants | Rebag effects on legacy `presence`/`discovery` tenants — verify net-neutral-or-better during implementation (presence has no live tenants; discovery has 3 claimed listings on prd) |

## 7. Non-goals

- No change to claim-grant machinery or `seed_claim` promo contents (flyer/QR tastes unchanged).
- No change to the `directory_presence` gateway allowlist — claimed/unclaimed gating is untouched.
- `google_only` stays dormant; no public-facing tier reactivation.
- `ecommerce`+ tiers unchanged (verify-only via inheritance diff).
- `starter` stays retired — this spec is the alternative to resurrecting it.

## 8. Motivating archetype

Recorded for product context: prospects like the Dreamcast African market pattern — no website, a *private/personal* Facebook profile acting as a business page, 60+ manually posted price-photos (a real catalog maintained in an ephemeral, unsearchable feed). Sales arc: Messenger-DM touch → FB profile repair (PB-09/A8; Meta's profile→Page convert is dead since 2021 — rescue = new public Page) → free claim → surface-mode upgrade. The SWIS/Storefront/Commerce triad gives the "your catalog deserves a real home" pitch three honest destinations.
