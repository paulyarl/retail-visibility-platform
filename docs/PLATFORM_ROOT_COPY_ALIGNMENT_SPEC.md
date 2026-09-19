# Platform Root Copy — Alignment Upgrade Spec

**Status:** Implemented · **Owner:** Product / Brand · **Date:** 2026-09-18

> Implementation note (2026-09-18): S1–S7 shipped. The features page additionally had its
> risk claims swept (unverifiable savings/ROI numbers, "GAME CHANGER"/"POWER COMBO" badges,
> "the only platform", stale chain prices corrected to `TIER_PRICING` $199/$1,999/$4,999),
> `COMPARISON_TIERS` now includes `directory_presence` and `presence`, the brand is
> `VisibleShelf` (one word) across public surfaces and platform-name fallbacks, and the
> platform-settings API defaults (`apps/api/src/routes/platform-settings.ts`) were updated
> to match. The `VisibleShelf` rename was also swept across the API's user-facing strings —
> email From-name defaults (SES/SendGrid/Mailtrap/`unifiedConfig`), invoice/receipt/billing
> `platformName` fallbacks, public-catalog payloads, and Clover conflict-resolution strings.
> `pnpm checkweb` and `pnpm checkapi` pass.
>
> **Signup wizard** (`apps/web/src/app/auth/signup/wizard/page.tsx`) aligned to the same
> model: a new slide 2 carries the free directory gateway ("You're Probably Already
> Listed — claim free, Starter $19 to own it"), the tier picker offers
> `directory_presence` and `presence` rungs, the Discovery slide's present-tense Google
> over-claim is fixed, the mission slide is no longer Clover-gated, and the trial box /
> submit button no longer contradict a free-tier pick. 8 benefit slides + data step = 9.
**Subject:** The mission / vision / promise copy at the platform root (`/`), plus the public copy surfaces that repeat its framing.
**Foundation:** `docs/PLATFORM_COPY_PLATFORM.md` — the one-page positioning, message architecture, voice rules, and claims ledger the replacement copy derives from. Read it first; this spec is the change list that follows from it.
**Trigger:** The root copy was written before the V3 presence model, the free Directory Presence seeding gateway, the directory discovery surfaces, and the capability architecture shipped. It now describes a smaller, more Google-centric product than the one that exists.

**Truth sources this spec aligns to:**
- `docs/PLATFORM_STRATEGY_V3.md` — canonical mission, layer model (Gateway → Entry Presence → Commerce → Scale), tier ladder.
- `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` — free Directory Presence gateway; seed → claim; Entry Presence triad.
- `apps/web/src/lib/tiers/tier-features.ts` — live tier keys, display names, pricing (`directory_presence` $0, `presence` "Starter" $19, `discovery` $29, `storefront` $59, …).
- `apps/api/src/services/EffectiveCapabilityResolver.ts` + `apps/api/src/services/resolvers/CapabilityConstraintRegistry.ts` — the capability architecture.
- `docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md` — city/category launch motion (seed-first outreach).
- `apps/api/src/services/intelligence/report-directives.ts` — the shared tone directives (analyst Register A, owner-facing Register B).
- `docs/LocalBiz/operator_hook_samples.md` + `docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md` §5.4–5.6 — the outreach copy voice, hook shape, and claim-and-fix motion the front should mirror.

---

## 1. Purpose

Review the platform-root copy for opportunities to upgrade it so it matches current reality, and specify the replacement copy and the files that must change.

The gap is not cosmetic. Four shipped shifts changed what the platform *is*, and the root copy predates all four:

1. **Free seeding / Directory Presence gateway.** A business can now be listed in the directory from public information, for free, and claim that listing — before paying anything. The copy still frames the product as a paid Google-visibility tool with a "Start Free Trial" door.
2. **Directory as a first-class discovery surface.** The directory is now a platform pillar with multiple browse surfaces (category, location, store type) and a claim/enrich funnel. The copy treats it as one bullet under "Platform Presence".
3. **Capability architecture.** Plans unlock *capabilities* (26 capability families — commerce types, storefront options, fulfillment, coupons, funnels, chatbot, CRM, directory promotion, wholesale matching, …), not a flat feature list. The copy still sells a feature checklist.
4. **An upgraded outreach voice.** The analyst/outreach copy now uses a deliberate register — hook → reassure → concrete bridge → claim-and-fix CTA, "never dry, never dull" — defined in `report-directives.ts` and demonstrated in `operator_hook_samples.md`. The front copy is still generic promo, so the platform's first impression doesn't sound like the platform's own outreach.

The front should therefore be a **discoverable executive summary** in that voice — not a restatement of the V3 architecture — with the top-of-funnel claim CTA present.

## 2. Scope

**In scope (copy surfaces):**

| # | Surface | File |
|---|---------|------|
| S1 | Mission / Vision / Promise block | `apps/web/src/app/(platform)/page.tsx` (lines ~434–486) |
| S2 | Landing hero (headline, typing capabilities, subcopy) | `apps/web/src/components/landing/LandingHero.tsx` |
| S3 | Visitor CTAs / "Why Choose Us" / directory pillar card | `apps/web/src/app/(platform)/page.tsx` |
| S4 | Public features + pricing story | `apps/web/src/app/features/page.tsx` |
| S5 | Footer brand description (default) | `apps/web/src/components/PublicFooter.tsx` |
| S6 | Directory "How It Works" copy | `apps/web/src/app/directory/about/AboutDirectoryClient.tsx` |
| S7 | Repo-root platform overview doc | `PLATFORM_OVERVIEW.md` |
| S8 | Storytelling reference doc (messaging canon) | `docs/MISSION_VISION_STORYTELLING.md` |

**Out of scope:** operator-facing marketing-ops copy, internal LocalBiz specs, email/outreach templates, and the actual pricing decisions (this spec flags pricing *display* drift but does not set prices).

**Framing constraints (agreed):**
- **The front is the intro — an executive summary of the essentials, not the V3 architecture.** The full tier ladder, capability registry, and layer model are overkill for `/`. Say what the platform is, in a few sentences.
- **Depth must be discoverable.** Everything the front omits should be one click away (features/capabilities, directory "how it works", pricing, the directory itself).
- **The top-of-funnel CTA belongs on the front.** The free listing / claim step is the entry point and should be present, not buried.
- **Voice must match the enhanced outreach copy.** The analyst/outreach register is warm, hook-then-reassure, concrete, never dry or dull, and closes on the claim-and-fix motion — not a generic promotional tone.

## 3. Current copy inventory (verbatim)

### S1 — Mission / Vision / Promise (`(platform)/page.tsx`)

> **Empowering Local Retailers to Compete Online**
> "We built this platform as the missing connector between your physical shelves and the internet. Think of it as the Amazon of local retail on your terms and the Shopify of offline retail: it plugs into the tools you already use, uses AI and automation to keep everything in sync, and makes your inventory discoverable on Google, your storefront, and our directory—the same way social media connected people to the world."
> 🎯 **Our Mission** — "Make every local shelf visible online and give small retailers big-brand style visibility."
> 💡 **Our Vision** — "A world where local businesses are connected to the world as easily as people are on social media."
> ⚡ **Our Promise** — "Enterprise features with an 'it just works' experience, small business pricing, and setup in minutes—not months."

### S2 — Landing hero (`LandingHero.tsx`)

> Headline: **"Make every product visible —"** + rotating suffix from:
> "sync products to Google Shopping" · "build a storefront that sells" · "list products in our retail directory" · "let an AI chatbot sell your products" · "track product sales with real-time analytics" · "make every product compete with the giants" · "turn your shelves into a digital storefront"
> Subcopy: "The platform that puts your products in front of every shopper — inventory sync, storefronts, AI chatbots, and a retail directory, all working to make your products visible."

### S3 — Visitor CTAs (`(platform)/page.tsx`)

> "Join Thousands of Retailers" · "Get your products on Google Shopping, create a beautiful storefront, and reach more customers - all in one platform." · "Start Free Trial →"
> Directory pillar card: "Platform Pillar" · "Discover Online Presence" · "Browse our curated directory of {n}+ retailers with {n}+ products."

### S4 — Features / pricing (`features/page.tsx`)

> Badge: **"Trusted by 1,500+ Retailers"**
> Hero: "Complete Online Presence **In Minutes, Not Months**"
> Tiers shown: Discovery $29 · Storefront $59 · Commitment $79 · E-commerce $99 · Omnichannel $149 · Professional $199 · Enterprise $499.
> Claims include: "SOC 2 compliant", "Save $2,400/month in labor", "Generate 50-100 realistic products in 1 SECOND".

### S5 — Footer (`PublicFooter.tsx`)

> Default description: **"Manage your retail operations with ease"**

### S6 — Directory about (`AboutDirectoryClient.tsx`)

> Badge: "Zero-Effort Directory" · "No manual curation. No data entry. No maintenance. **Just pure automation.**"
> "One Action, Three Benefits" — Step 1: "Store Owner Adds Product. They scan a barcode or enter product details. That's it."

### S7 — `PLATFORM_OVERVIEW.md`

> "Retail Visibility Platform … an enterprise-grade inventory management system designed for multi-location retailers." · "Last Updated: October 21, 2025" · magic-link auth · 26 phases · no directory, seeding, capability, or strategy content.

## 4. Current reality (what the copy should describe)

| Reality | Source of truth |
|---------|-----------------|
| Free gateway: business listed from public data → claim (billing `none`) | `tier-features.ts` `directory_presence` ($0); `PLATFORM_STRATEGY_V3.md` §GATEWAY |
| Entry Presence = three peer **surfaces**: directory ("Starter" $19), Google (`discovery` $29), platform (`storefront` $59) | `PLATFORM_STRATEGY_V3.md`; `directory_presence_progressive_upgrade_spec.md` |
| Commerce = modes of money: `commitment` $79 / `ecommerce` $99 / `omnichannel` $149 | `tier-features.ts`; V3 |
| Directory has multiple discovery surfaces: **category, location, store type** | `apps/web/src/app/directory/page.tsx` metadata |
| Capability architecture: 26 capability families resolved per tenant, "flexible" = all options in a capability unlocked | `capability-display.ts` `CAPABILITY_META`; `EffectiveCapabilityResolver.ts` |
| City/category "proving ground" launch motion; seed-first outreach; seed intelligence reports | `PROVING_GROUND_CAMPAIGN_SPEC.md`; `AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md` |
| V3 mission: move shoppers from real-time product discovery through to purchase conversion | `PLATFORM_STRATEGY_V3.md` §Platform Mission |
| Outreach voice: warm, hook-then-reassure, never dry/dull, claim-and-fix | `report-directives.ts`; `operator_hook_samples.md`; `marketing_ops_deliverable_source_material_spec.md` §5.4–5.6 |

## 4.5 Voice & tone reference (the register the front must match)

The outreach and analyst copy has been deliberately upgraded. The front copy must adopt the same framing rather than a generic SaaS-promo voice. The system defines two registers in `apps/api/src/services/intelligence/report-directives.ts`:

- **Register A — internal analyst voice.** *"Write for a capable business owner or operator. Be clear, specific, useful, and forward-looking … never dull, dry, bureaucratic, alarmist, or generic."* and *"warm, professional, helpful: write copy the operator can read aloud to the owner with a straight face and a smile. Never dry, never dull."*
- **Register B — owner-facing copy.** *"Warm and professional — a knowledgeable local speaking to a neighbor. Welcoming and plain-spoken, never casual or promotional: no exclamation marks, no superlatives, no hype. Ground every claim in the supplied source material; do not invent details."*

**The public front is owner-facing, so it takes Register B's restraint (no hype) plus Register A's rhythm (never dry, never dull).** Concretely, borrow these proven shapes from `operator_hook_samples.md`:

1. **Diagnostic hook → reassurance → bridge → offer → soft CTA** (the "five-beat" shape). Reassurance is load-bearing: *"Honestly, most local shops are in that range, so nothing to worry about."*
2. **Concrete, quantified observations** over adjectives (*"20–30% of the 'near me' searches"* vs. "more visibility").
3. **Claim-and-fix motion**, never a purchase ask: *"claim your profile and we fix it"*, *"about two minutes, no cost."*
4. **Develop-value-first framing**: the platform *seeds* presence first and invites the owner to *claim* it.
5. **No shaming**: incomplete public information is never framed as poor business quality.

This is the same doctrine the deliverable copy inherited (`marketing_ops_deliverable_source_material_spec.md` §5.6). The front copy is its top-of-funnel instance.

## 5. Gap analysis

Severity: **P0** = factually wrong / legal risk · **P1** = materially misrepresents the product · **P2** = stale / weak positioning.

| # | Gap | Surface | Severity |
|---|-----|---------|----------|
| G1 | **Free Directory Presence gateway is absent.** Copy never says a business can be listed and claim its listing for free, from public data. Every door is "Start Free Trial" (a 14-day paid trial), not "claim your free listing". | S1, S2, S3, S4, S6 | P1 |
| G2 | **Mission omits the conversion half.** V3 mission is discovery *through to purchase*. "Make every local shelf visible online" stops at visibility. | S1 | P1 |
| G3 | **"Enterprise features" promise contradicts the model.** The product is explicitly tiered and capability-gated and starts free; "enterprise features … small business pricing" is the old V2 framing. | S1 | P2 |
| G4 | **Analogies misdescribe the product.** "Amazon of local retail" / "Shopify of offline retail" / "connected like social media" no longer map to a multi-surface visibility + commerce platform. | S1 | P2 |
| G5 | **"A storefront that sells" / "let an AI chatbot sell your products" over-claims.** `storefront` is presence/browse only — commerce rails are separate `commitment`/`ecommerce`/`omnichannel` tiers. | S2 | P0/P1 |
| G6 | **Pricing ladder is stale and hardcoded.** Public page shows Discovery $29 → Enterprise $499 and omits the free `directory_presence` and the $19 `presence` ("Starter") tier. It is a hand-maintained array, not driven by `TIER_DISPLAY_NAMES`/`TIER_PRICING`. | S4 | P0 |
| G7 | **Directory surfaces under-sold.** Directory is a "Platform Pillar" in one card, but its category / location / store-type browse surfaces and the claim→enrich funnel are not named. | S1, S3, S6 | P1 |
| G8 | **Capability architecture un-framed.** `CapabilityComparisonMatrix` is rendered on S4 but with no narrative explaining "capabilities, not just features", and its columns (`COMPARISON_TIERS`) omit the free gateway and Starter tiers. | S1, S4 | P2 |
| G9 | **Directory copy is product-add-centric, contradicting seed-first.** "Store Owner Adds Product" is Step 1, but listings now originate from public data and are claimed — a business can be discoverable before any product is added. | S6 | P1 |
| G10 | **Unverifiable / risky claims.** "Trusted by 1,500+ Retailers", "Join Thousands of Retailers", "Save $2,400/month in labor", "SOC 2 compliant", "99.9% uptime". | S3, S4 | P0 |
| G11 | **Brand naming drift.** "Visible Shelf" (footer/settings) vs "VisibleShelf" (hero/directory metadata) vs "Retail Visibility Platform" (overview doc). | S2, S5, S7 | P2 |
| G12 | **Footer default description is internal.** "Manage your retail operations with ease" is not a positioning statement. | S5 | P2 |
| G13 | **`PLATFORM_OVERVIEW.md` is a pre-V3 artifact.** Describes an inventory/Google-only product, dated Oct 2025, no directory/seeding/capabilities. | S7 | P1 |
| G14 | **No mention of newer capability families** that differentiate the platform: coupons, sales funnels, wholesale matching, GBP management, seed intelligence, CRM/FAQ, chatbot. | S4 | P2 |
| G15 | **Tone is generic promo, not the established register.** "Compete with the giants", "Enterprise features", "Dominate local search" — no hook-then-reassure rhythm, no claim-and-fix motion, no "never dry, never dull" voice. | S1, S2, S4 | P1 |
| G16 | **No discoverability path.** Deeper surfaces are reachable only via a generic "Learn More" and the footer; the intro does not link out to the essentials it omits. | S1, S3 | P2 |
| G17 | **Front is over-scoped, not an intro.** It tries to enumerate stats, mission, features, directory pillar, and CTA at once; there is no concise executive summary a visitor can absorb in one screen. | S1, S3 | P2 |

## 6. Proposed copy upgrade

The rewrite principle: **the front is a discoverable executive summary in the outreach voice.** Lead with the free gateway and the multi-surface story, describe discovery *and* conversion, close on the claim-and-fix CTA, and link out for depth — do not restate the V3 architecture. Keep the "David vs Goliath" empathy that already works, but drop the hype (see §6.9).

### 6.0 Shape of the front

The front becomes **one executive summary + one top-of-funnel CTA + a discoverability row**. It states the essentials in the outreach voice and links out for everything else. Do **not** put the tier ladder, capability matrix, or layer model on the front — those live on S4 and in the directory surfaces.

```
Headline            →  the promise, in one line
Executive summary   →  3–4 sentences: free listing → choose a surface → sell when ready
Top-of-funnel CTA   →  "Is your business already listed? Claim it free →"
Discoverability row →  How it works · Features & capabilities · Browse the directory · Pricing
Three pillars       →  Mission / Vision / Promise (kept, re-toned)
```

### 6.1 S1 — Front intro (replacement)

**Headline**
> **Every local business, findable — and ready to sell.**

**Executive summary (the essentials, five-beat voice)**
> Most neighborhood businesses are missing from the places shoppers actually look — and it's almost never for lack of a good business. We start you free: your business may already be listed in our directory, sourced from public information, and claiming it takes about two minutes at no cost. From there you choose how you show up — a richer directory listing, Google Search and Shopping, or a storefront on our marketplace — and when you're ready to sell, turn on deposits, pickup, delivery, or full online payment. No developer, no enterprise budget, no months of setup.

**Top-of-funnel CTA (front)**
> **Is your business already listed?** Claim your free listing → (`/directory/add-business`)
> *or* See how it works → (`/directory/about`)

**Discoverability row (link out; do not explain here)**
> How it works → `/directory/about` · Features & capabilities → `/features` · Browse the directory → `/directory` · Pricing → `/features#pricing`

**Three pillars (kept, re-toned)**
> 🎯 **Our Mission** — "Put every local business on the map — and give it the same tools to turn discovery into sales that the big chains built for themselves."
> 💡 **Our Vision** — "A world where finding and buying from a neighborhood business is as easy as finding and buying from a national chain."
> ⚡ **Our Promise** — "Start free, stay in control: claim your listing at no cost, unlock only what you need, and pay when you're ready to grow."

### 6.2 S1/S3 — contextual placement of the top-of-funnel CTA

The same claim CTA reappears above the directory pillar card (S3) so the top-of-funnel entry stays visible without scrolling back. Voice-matched:

> **Already listed — free.**
> We seed the directory from public business information, so neighbors can find you before you ever sign up. Claiming it takes about two minutes and costs nothing — then you own the listing and can fix your details. **Claim your free listing →** (`/directory/add-business`)

### 6.3 S2 — Landing hero (replacement)

**Base text:** `Make every local business visible —`
**Rotating capabilities (replace `CAPABILITIES`)** — platform-level capabilities, not free-tier promises:
- `claim your free directory listing`
- `get found on Google Search and Maps`
- `open a branded storefront`
- `sell with deposits, pickup, or full payment`
- `let an AI assistant answer shopper questions`
- `run coupons and sales funnels`
- `sync inventory automatically`

**Subcopy (five-beat: hook → reassurance → bridge → offer → soft CTA):**
> Most local shops are missing from the places shoppers actually look — and it's rarely their fault. We start you free: your business can be listed in our directory from public information, and claiming it takes about two minutes. From there, add Google visibility, a storefront, and — when you're ready — deposits, pickup, or full online payment. Want to see how it works? → `/features`

### 6.4 S4 — Features / pricing (replacement strategy)

1. **Drive tier display from config, not a hardcoded array.** Replace the `tiers` array's price/name literals with `TIER_DISPLAY_NAMES` / `TIER_PRICING` from `apps/web/src/lib/tiers/tier-features.ts`, and add the two missing rungs: **Directory Presence — Free** and **Starter (directory surface) — $19**.
2. **Lead the pricing story with the free gateway**, then Entry Presence surfaces, then Commerce modes — mirroring `PLATFORM_STRATEGY_V3.md`'s layer model rather than a flat 7-tier list.
3. **Frame capabilities, not features.** `CapabilityComparisonMatrix` is already rendered (`features/page.tsx:2925`), but the surrounding copy still sells a flat feature list. Add a lead-in above it: *"Your plan unlocks capabilities — commerce types, fulfillment, storefront options, coupons, funnels, and more — not a flat feature list."* Note the matrix currently omits the `directory_presence` and `presence` columns (`COMPARISON_TIERS` in `capability-display.ts`), so it needs the same rung fix as the pricing table.
4. **Add a "How it works" arc:** Seed (free) → Claim (free) → Choose a visibility surface → Turn on commerce.
5. **Remove or substantiate the risk claims in §7.**

### 6.5 S5 — Footer default

> Replace `'Manage your retail operations with ease'` with `'Free directory listing, Google visibility, and a storefront — one platform to be found and get paid.'`

### 6.6 S6 — Directory "How It Works" (seed-first rewrite)

Reframe the four steps:
1. **We seed the directory from public information** — no action required from the business.
2. **The owner claims their listing** (free) and corrects NAP details.
3. **The platform enriches** — AI fills gaps, assigns categories, prepares discovery surfaces.
4. **Shoppers discover stores** by category, location, or store type.

Keep the "Zero-Effort" and "no manual curation" themes — they remain true — but stop implying a product must be added before a business is discoverable.

### 6.7 S7 — `PLATFORM_OVERVIEW.md`

Either (a) rewrite it against V3 + the capability architecture, or (b) move it to `docs/archive/` and point readers at `PLATFORM_STRATEGY_V3.md`. Recommendation: **(b) archive**, and add a short root `README` pointer, because a second stale "overview" is worse than none.

### 6.8 S8 — `MISSION_VISION_STORYTELLING.md`

Update the "Key Messaging" and "Customization Guide" sections to the §6.1 copy so the messaging canon doesn't contradict the live page.

### 6.9 Tone rules for all front copy (from §4.5)

Apply to S1–S6. These are the same rules the outreach/analyst copy already follows.

1. **Open on the hook, reassure immediately.** Name the observation, then take the blame off the owner: *"it's rarely their fault."*
2. **Never dry, never dull.** Active language, concrete observations, forward-looking. No bureaucratic filler.
3. **Owner-facing restraint.** No exclamation marks, no superlatives, no hype ("dominate", "unleash", "revolutionary"). Warm and plain-spoken.
4. **Quantify when the evidence supports it; qualify when it doesn't.** Don't invent percentages or ROI.
5. **Close on the claim-and-fix motion**, not a purchase ask: *"claim your listing and we fix it — about two minutes, no cost."*
6. **Develop-value-first.** The platform seeds presence first, then invites the claim.
7. **Never shame.** Incomplete public information is not evidence of a poor business.
8. **Discoverable by design.** Any claim the front doesn't substantiate should link to where it is (`/features`, `/directory/about`, `/features#pricing`).

## 7. Claims & compliance register

Every claim below should be verified against a live source or removed before the rewrite ships.

| Claim | Surface | Action |
|-------|---------|--------|
| "Trusted by 1,500+ Retailers" | S4 hero badge | Replace with live `platformStats.activeRetailers` (already fetched on S1) or remove |
| "Join Thousands of Retailers" | S3 CTA | Same — use real count or drop |
| "Save $2,400/month in labor" | S4 | Substantiate with a methodology or remove |
| "SOC 2 compliant" | S4 | Only if certified; otherwise "security controls aligned to SOC 2" or remove |
| "99.9% uptime" | S1 stats | Confirm the figure is measured, not hardcoded default (`platformUptime` defaults to 99.9) |
| "Google Partner" / similar | (if added) | Only with current partner status |
| "Enterprise-grade" | S7 | Stale framing — drop with the doc |

## 8. Terminology standard

| Use | Avoid |
|-----|-------|
| **VisibleShelf** (the brand — one word, everywhere: prose, logo, footer, metadata) | "Visible Shelf" (two words), "Retail Visibility Platform" |
| **Directory Presence** (free gateway) | "free listing" without the claim step |
| **Starter** (display for tier key `presence`) | "Presence tier" in customer copy (internal key only) |
| **capabilities** | "features" when the point is gated flexibility |

> Note: `PublicFooter.tsx` currently defaults `platformName` to `'Visible Shelf'` and the logo wordmark renders it as two words — update both to **VisibleShelf**.

## 9. Implementation plan

Ordered, file-by-file. All copy changes are data/JSX-only; no migrations.

| Step | File | Change |
|------|------|--------|
| 0 | `docs/PLATFORM_COPY_PLATFORM.md` | The foundation: positioning sentence, audience + door, three beats, voice rules, one-screen front, disclosure map, claims ledger, 60-second test. **Approve this before the copy steps below.** |
| 1 | `apps/web/src/app/(platform)/page.tsx` | Rebuild S1/S3 as the executive-summary intro (§6.0–6.1): headline + 3–4 sentence summary + top-of-funnel claim CTA + discoverability row + re-toned pillars; contextual CTA above the directory pillar card (§6.2); fix visitor CTA claims (§7) |
| 2 | `apps/web/src/components/landing/LandingHero.tsx` | Replace `BASE_TEXT`, `CAPABILITIES`, subcopy (§6.3) |
| 3 | `apps/web/src/app/features/page.tsx` | Drive tiers from `tier-features.ts`; add free + Starter rungs; capability lead-in; add "How it works"; remove/substantiate §7 claims |
| 3b | `apps/web/src/lib/tiers/capability-display.ts` | Add `directory_presence` / `presence` to `COMPARISON_TIERS` so the matrix matches the ladder |
| 4 | `apps/web/src/components/PublicFooter.tsx` | New default description (§6.5); fix `platformName` default and the "VS / Visible Shelf" wordmark to **VisibleShelf** (one word) |
| 5 | `apps/web/src/app/directory/about/AboutDirectoryClient.tsx` | Seed-first rewrite (§6.6) |
| 6 | `PLATFORM_OVERVIEW.md` | Archive + root pointer (§6.7) |
| 7 | `docs/MISSION_VISION_STORYTELLING.md` | Sync messaging canon (§6.8) |
| 8 | `AGENTS.md` (optional) | Add a "brand copy lives in tier-features/config" note if pricing display is decoupled |
| 9 | All S1–S6 copy | Apply the §6.9 tone rules (hook → reassure → claim-and-fix; no hype) |

## 10. Acceptance criteria

1. No public copy claims a commerce capability on a presence-only tier (G5).
2. The free Directory Presence gateway and the claim step are visible on S1, S2, S4, and S6 (G1, G9).
3. Public tier names/prices on S4 match `TIER_DISPLAY_NAMES` / `TIER_PRICING` and include `directory_presence` and `presence` (G6).
4. The directory's category / location / store-type surfaces are named on S1 or S3 (G7).
5. Every claim in §7 is either substantiated by a live value or removed (G10).
6. Brand naming is consistent per §8 (G11).
7. The front reads as a concise executive summary — a visitor can state what the platform does after one screen, without the tier ladder or capability matrix (G17).
8. The front carries a top-of-funnel claim CTA and a discoverability row linking to `/features`, `/directory/about`, `/directory`, and `/features#pricing` (G16).
9. Front copy follows the §6.9 tone rules — hook + reassurance present, no hype or superlatives, closes on the claim-and-fix motion (G15).
10. `pnpm checkweb` passes after the changes.

## 11. Open questions

1. **Pricing display:** is the public pricing page meant to expose the full V3 ladder (including $19 Starter), or keep a simplified "Free / Discovery / Storefront / Commerce" story? (Affects §6.4 depth.)
2. **Tone register on the public front:** outreach Register A uses warm exclamations ("Hey!"), while owner-facing Register B bans exclamation marks and hype. This spec assumes the front follows **Register B's restraint with Register A's hook rhythm** (§6.9) — confirm.
3. **"Essentials" cut line:** the §6.1 summary names the free listing, the three visibility surfaces, and commerce. Should any of those move to the discoverability row to keep the front even shorter?
4. **`PLATFORM_OVERVIEW.md`:** archive (recommended) or rewrite?
5. **Claims:** who owns verification of the §7 register (marketing vs. product vs. legal)?

## 12. Non-goals

- No changes to tier definitions, prices, or capability gating logic.
- No changes to operator/marketing-ops copy.
- No redesign of the landing hero visuals — copy only.
