# VISIBLE SHELF
## Platform Architecture, Tier Framework & Organisational Model — V3
*Confidential Working Document*

> **Supersedes:** `PLATFORM_STRATEGY_V2.md`  
> **Product companion:** `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` (v3 Entry Presence ladder)  
> **Light-tier on-ramp:** `docs/DIRECTORY_PRESENCE_LIGHT_TIER_SPRINT_PLAN.md`  
> **Code hierarchy skill:** `.devin/skills/tier-hierarchy.md` (must stay in sync with this document)

---

# V3 Change Summary

**V2** restructured tiers around **commerce business-model alignment** (deposit vs full pay vs both) so purchase rails match how merchants operate.

**V3** keeps that commerce insight and applies the **same design pattern one layer earlier** — to **presence**:

| Context | Modes (same layer, different rail) |
|---------|-------------------------------------|
| **Entry Presence** | **Starter** (directory) · **Discovery** (Google) · **Storefront** (platform) |
| **Commerce** | **Commitment** (deposit) · **Ecommerce** (full) · **Omnichannel** (both) |

V3 also introduces the free **Directory Presence** gateway — the foot-in-the-door below all paid presence modes.

| What changed | V2 | V3 |
|--------------|----|----|
| First paid story | Discovery (Google) as Tier 1 entry | Peer Entry Presence triad after free gateway |
| Starter | Legacy / mapped toward storefront | **Active:** paid **directory** surface mode |
| Directory Presence | Not in strategy | Free on-ramp (seed → claim) |
| Discovery | “Visibility only” / entry tier | **Google third-party surface** integration |
| Storefront | Platform presence after Google path | **Platform in-house surface** (still often inherits Google) |
| Forced spine | Google → platform → commerce | **Choose presence mode** → then commerce mode |
| One-time website ladder | — | Not strategic peers; optional packs under Starter only |

**What V3 does not abandon**

- Commerce triad (Commitment / Ecommerce / Omnichannel)
- Holding-fee economics
- Org inheritance model (updated for new baseline tiers)
- Mission: product visibility that drives conversion without an IT team

---

# Platform Mission

> *Local retailers need a way to move shoppers from real-time product discovery through to purchase conversion because big-box retailers built end-to-end inventory visibility and commerce infrastructure internally — leaving small retailers without an accessible, connected, or affordable path to compete in mobile shopping.*

---

# The V3 Strategic Insight

## Two problems, one design language

### Problem 1 (solved in V2) — Commerce mismatch
Tier-based feature stacking gave merchants checkout options that didn’t match physical vs online reality (deposit vs full pay).

**V2 fix:** Commerce tiers = **modes of money**, not a feature pile.

### Problem 2 (solved in V3) — Presence mismatch
Treating “get visible” as a single ladder with Google as the default first paid step hid two other truths:

1. Many local merchants need a **trusted public listing** before they need Google Shopping.
2. **Platform marketplace presence** is a different product job than **Google integration**.

Forcing Directory → Google → Platform (or free listing → $29 Google cliff) mis-sells the castle.

**V3 fix:** Presence tiers = **modes of visibility surface**, parallel to commerce modes of payment.

```
Directory Presence     FREE gateway — courtyard of the castle
        │
        ▼
Entry Presence         PAID — choose a surface
  ├── Starter      → in-house DIRECTORY surface
  ├── Discovery    → third-party GOOGLE surface
  └── Storefront   → in-house PLATFORM / marketplace surface
        │
        ▼
Commerce               PAID — choose a money rail
  ├── Commitment   → deposit only
  ├── Ecommerce    → full payment only
  └── Omnichannel  → both
        │
        ▼
Scale                  Professional / Organisation / Enterprise
```

**North-star line**

> *Directory Presence is the foot-in-the-door. Starter, Discovery, and Storefront are which hall they rent. Commerce is whether they open a till.*

---

# Layer Model

| Layer | Question answered | Billing |
|-------|-------------------|---------|
| **Gateway** | Can shoppers and ops find a truthful NAP listing? | Free / invite (`directory_presence`) |
| **Entry Presence** | *Where* is the business visibly present? | Subscription |
| **Commerce** | *How* can a shopper commit money? | Subscription |
| **Scale** | Multi-location, advanced ops, org control | Subscription / custom |

---

# Tier Structure Overview

| Tier | Layer | Mode / surface | Purchase capability | Indicative price |
|------|-------|----------------|---------------------|------------------|
| **Directory Presence** | Gateway | Free directory shell (seed/claim) | None | $0 |
| **Starter** | Entry Presence | **Directory** (platform in-house) | None | TBD ($9–$19/mo band) |
| **Discovery** | Entry Presence | **Google** (third-party integration) | None | $29/mo |
| **Storefront** | Entry Presence | **Platform** (in-house marketplace) | None | $59/mo |
| **Commitment** | Commerce | Physical / deposit | Deposit only | $79/mo |
| **E-commerce** | Commerce | Online-only / full pay | Full payment only | $99/mo |
| **Omnichannel** | Commerce | Physical + online | Both | $149/mo |
| **Professional** | Scale | Advanced single-location | Both | $199/mo |
| **Organisation / Enterprise** | Scale | Multi-location | All options | $499/mo+ |

> Starter price locks before billing launch. Discovery / Storefront / Commerce prices retain V2 defaults unless deliberately revised.

---

# GATEWAY — DIRECTORY PRESENCE — $0
### *"You're on the map"*

**Layer:** Gateway (not Entry Presence).  
**Purchase capability:** None.  
**Billing:** Free / invite-only. Never a paid acquisition SKU for seed cohorts.

**Who this is for**

- Unclaimed and newly claimed local businesses listed from public information  
- Seed markets (e.g. Indianapolis African grocery) building directory density  
- Operators publishing NAP + sourced SNAP/EBT badges without inventing commerce

**What it is**

- Foot-in-the-door / courtyard of the castle  
- Classic directory listing: name, address, phone, hours/map/contact/QR when sourced  
- SNAP/EBT **visibility badge only** when provenance exists  
- Claim funnel: seed → invite → owner owns the listing  
- Light `storefront_retail` shell **without catalog**

**What it is not**

- Not a paid “Starter discount”  
- Not Google visibility  
- Not platform product browse  
- Not checkout  
- Not a fourth peer of Starter / Discovery / Storefront

**Claim conversion**

Conversion at this layer = **claim**, not checkout.  
Paid presence begins when the owner chooses an Entry Presence mode.

**Upgrade trigger:** *“I claimed my listing — now I want a real presence surface.”*  
Default recommended mode: **Starter** (directory). Alternates: Discovery, Storefront.

---

# ENTRY PRESENCE TRIAD

Same commercial layer. Three surfaces. Choose a mode — do not smear jobs.

## Starter — Directory surface — $TBD/mo
### *"Own your directory listing"*

**Surface owner:** Platform **in-house directory**.  
**Purchase capability:** None — presence only.

**Who this is for**

- Claimed directory owners who want the listing to be *theirs*: logo, story, photos, richer layouts  
- Merchants not ready for Google integration or marketplace catalog browse  
- The natural **paid path from free unclaimed / gateway** Directory Presence

**Included (conceptually)**

| Capability | |
|---|---|
| Everything durable from Directory Presence gateway | ✅ |
| Owner-controlled enriched directory (logo, about, gallery, editorial/immersive layouts, social) | ✅ |
| Platform directory listing as **primary surface** | ✅ |
| Google Search / Shopping / Maps SWIS | ❌ |
| Branded platform marketplace storefront + product browse | ❌ |
| Any purchase / checkout | ❌ |

**Legacy note:** Historical `starter` in code mixed storefront/Clover/SEO. **V3 Presence (display: "Starter") is directory-mode only.** Implementation uses a **new `presence` tier key** to avoid reviving the old `starter` feature bag. The old `starter` tier stays inactive — no purge required. See implementation companion.

**Upgrade triggers**

- *“I want to get found on Google.”* → Discovery  
- *“I want a store on Visible Shelf.”* → Storefront  

---

## Discovery — Google surface — $29/mo
### *"Get found on Google"*

**Surface owner:** **Third party (Google)**.  
Platform sells **visibility integration** onto Google’s wave (Search, Shopping, Maps/SWIS), with supporting POS/product rails as required.

**Purchase capability:** None — visibility integration only.

**Who this is for**

- Retailers whose primary job is Google visibility  
- Merchants with product data / Clover who want SWIS and Shopping without marketplace-first positioning  

**Included (conceptually)**

| Capability | |
|---|---|
| Clover POS integration & real-time sync (as required for Google path) | ✅ |
| SEO-optimised product pages | ✅ |
| Google Search indexing | ✅ |
| Google Shopping visibility | ✅ |
| Google Maps / SWIS | ✅ |
| Thin directory chrome (listing may still exist) | ✅ |
| Full directory enrichment as the *sold job* | ❌ (Starter’s job) |
| Platform product visibility / branded marketplace storefront | ❌ |
| Any purchase / checkout | ❌ |

**Why paid:** Ongoing Google-centric integration and maintenance — not “a free website.”

**Upgrade trigger:** *“People find me on Google — now I want them inside Visible Shelf.”* → Storefront  

**Peer entry:** Owners may choose Discovery **directly from gateway** without buying Starter first.

---

## Storefront — Platform surface — $59/mo
### *"Own your platform store"*

**Surface owner:** Platform **in-house marketplace**.  
**Purchase capability:** None — browsing & discovery only (no till yet).

**Who this is for**

- Retailers who want a branded presence and product browse **on Visible Shelf**  
- Brands for whom the marketplace is the destination, not only Google  

**Included (conceptually)**

| Capability | |
|---|---|
| Branded public storefront page | ✅ |
| Platform product visibility | ✅ |
| Platform search & browse | ✅ |
| Product categories & filtering | ✅ |
| Store profile, hours & details | ✅ |
| Shopper inquiry / contact seller | ✅ |
| Google visibility stack | ✅ inherit (V3 default: Storefront includes Discovery-class Google) |
| Directory listing | ✅ |
| Any purchase / checkout | ❌ |

**Default inheritance:** Storefront **combines up** Google (like Omnichannel combines deposit + full pay). A future pure-platform SKU without Google is optional and out of V3 core.

**Upgrade trigger:** *“Shoppers browse but can’t commit money.”* → Commerce triad  

**Peer entry:** Owners may choose Storefront **directly from gateway**.

---

# COMMERCE TRIAD
*(Unchanged spirit from V2 — renumbered under V3 layers)*

## Commitment — $79/mo
### *"Capture intent & drive foot traffic"*

**Purchase capability:** Deposit only — no full checkout option.  
**Commerce type:** Commitment commerce — deposit of intent; transaction closes in store (e.g. Clover).

**Who this is for:** Physical retailers driving foot traffic with guaranteed intent.

| Capability | |
|---|---|
| Entry Presence baseline (platform + Google as applicable via Storefront inheritance path) | ✅ |
| Add to cart / deposit checkout | ✅ |
| Holding / commitment fee (10–15%) | ✅ |
| Reserve / hold / BOPIS | ✅ |
| Shopper notifications / inventory indicators / conversion analytics | ✅ |
| Full online payment / delivery-first ecommerce | ❌ |

**Upgrade triggers:** Full pay online → Ecommerce; both paths → Omnichannel.

### Holding fee model

| Element | Detail |
|---|---|
| Fee amount | 10–15% of order total at checkout |
| On fulfilment | Credited toward in-store purchase at pickup |
| On abandonment | Forfeited if not collected within policy window |
| Retailer protection | Inventory not held without financial commitment |

### Abandoned fee distribution

| Scenario | Holding fee | Platform | Retailer |
|---|---|---|---|
| Order fulfilled | Credited to purchase | Small processing fee | Full sale revenue |
| Order abandoned | Forfeited | 20–25% of holding fee | 75–80% of holding fee |

---

## E-commerce — $99/mo
### *"Sell online — fully & simply"*

**Purchase capability:** Full purchase only — no deposit option.  
**Commerce type:** Pure e-commerce.

**Who this is for:** Online-only retailers, digital goods, no physical fulfilment dependency.

| Capability | |
|---|---|
| Entry Presence baseline | ✅ |
| Full online payment / delivery fulfilment | ✅ |
| Cart, notifications, inventory indicators, conversion analytics | ✅ |
| Deposit / BOPIS / hold-for-pickup | ❌ |

**Key distinction vs Commitment:** Same commercial *layer*, different **money mode** — not “more features,” different business model.

---

## Omnichannel — $149/mo
### *"Physical + online — unified commerce"*

**Purchase capability:** Full purchase + deposit — shopper chooses.  
**Commerce type:** Unified commerce.

**Who this is for:** Merchants who can fulfil both pickup and ship/delivery paths.

| Capability | |
|---|---|
| Both Commitment and E-commerce money rails | ✅ |
| Shopper payment path choice | ✅ |
| Advanced analytics, API access, priority placement (as today) | ✅ |
| Multi-location | ❌ (Scale tiers) |

**Analogy:** Omnichannel is to commerce what a future multi-surface “Presence Plus” would be to Entry Presence — combine modes when the merchant can honestly operate all rails.

---

# SCALE

## Professional — $199/mo
Advanced single-location: deeper ops, branding, integrations, support (platform packaging as implemented).

## Organisation / Enterprise — $499/mo+
Multi-location, propagation, white-label, custom contracts, dedicated support.

---

# Master Capability Matrix (V3)

| Capability | Gateway DP | Starter | Discovery | Storefront | Commitment | Ecommerce | Omnichannel | Enterprise |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **GATEWAY / DIRECTORY** | | | | | | | | |
| Free seed/claim NAP shell | ✅ | — | — | — | — | — | — | — |
| Directory listing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enriched directory (logo/about/gallery/layouts) | ❌ | ✅ | ◐ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SNAP/EBT badge (sourced) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **GOOGLE (third-party)** | | | | | | | | |
| Google Search / Shopping / Maps SWIS | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clover + SEO product pages (Google path) | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PLATFORM (in-house)** | | | | | | | | |
| Branded marketplace storefront | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform product visibility / browse | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shopper inquiry | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **COMMERCE** | | | | | | | | |
| Add to cart / checkout shell | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Deposit / holding fee | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Full online payment | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Shopper path choice | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| BOPIS / reserve | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Delivery fulfilment | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **SCALE** | | | | | | | | |
| Multi-location | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **PRICING** | | | | | | | | |
| 14-day trial (paid modes) | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Monthly (indicative) | $0 | TBD | $29 | $59 | $79 | $99 | $149 | $499 |

◐ Discovery may retain thin directory chrome; **sold job** is Google, not directory polish (Starter).

---

# Progression Logic

## Entry Presence — peer choice (primary)

```
[Directory Presence — free gateway]
           │
  ┌────────┼────────┐
  ▼        ▼        ▼
Starter  Discovery Storefront
(dir)    (Google)  (platform)
```

Not forced through Google to reach platform. Not forced through Starter to reach Google.

## Typical stories

| Path | Narrative |
|------|-----------|
| Gateway → Starter | Claimed listing → own the directory surface |
| Gateway → Discovery | Jump straight to Google integration |
| Gateway → Storefront | Jump straight to marketplace store |
| Starter → Discovery | Directory solid; add Google |
| Starter → Storefront | Directory solid; open platform store |
| Discovery → Storefront | Google working; add in-house store |
| Any Entry Presence → Commitment / Ecommerce / Omnichannel | Browse works; open a till (mode-matched) |

## Shopper journey (modes combined over time)

```
Gateway   → Shopper sees a truthful local listing
Starter   → Listing feels owned (photo, story, hours)
Discovery → Shopper finds products/store via Google
Storefront→ Shopper browses the store on Visible Shelf
Commitment→ Shopper deposits and picks up
Ecommerce → Shopper pays in full online
Omnichannel→ Shopper chooses path
Scale     → Multi-location / advanced ops
```

---

# Pricing & Revenue Model

## Philosophy

Visible Shelf sits in a hard-to-replicate integration wedge (directory density + POS + Google + commerce). Free acquisition **at the gateway** builds the marketplace courtyard; **paid modes** fund surfaces and rails.

**Trials:** 14-day free trial on paid subscription tiers (Entry Presence + Commerce + Scale).  
**Gateway:** No trial fiction — free by design.  
**Paid from day 15** on subscribed modes (unless product later adds no-card trials).

## Tier pricing

| Tier | Price | Value proposition |
|------|-------|-------------------|
| Directory Presence | $0 | Gateway listing / claim on-ramp |
| Starter | TBD | In-house directory visibility — paid path from free listing |
| Discovery | $29/mo | Google visibility integration (third-party surface) |
| Storefront | $59/mo | In-house platform store + product browse (+ Google inherit) |
| Commitment | $79/mo | Deposit commerce for physical retail |
| E-commerce | $99/mo | Full online checkout |
| Omnichannel | $149/mo | Deposit + full pay — shopper chooses |
| Professional / Org / Enterprise | $199–$499+ | Advanced and multi-location |

## Revenue streams

| Stream | Model |
|--------|--------|
| Monthly subscription | All paid tiers |
| Holding fee processing | Commitment / Omnichannel |
| Abandoned fee share | 20–25% of forfeited deposit |
| Online payment processing | Ecommerce / Omnichannel+ |
| Multi-location premium | Org / Enterprise |

---

# Organisational Model — Multi-Location

Inheritance rules from V2 remain; baseline tiers expand:

```
Organisation sets baseline (any paid tier — Entry Presence or Commerce+)
↓
Locations inherit baseline features
↓
Locations may upgrade above baseline — never below
↓
Unified org dashboard + consolidated billing
```

| Org baseline | Scenario |
|--------------|----------|
| Starter | Multi-loc brand standardises directory surface |
| Discovery | Google-first chain |
| Storefront | Brand-presence organisation on marketplace |
| Commitment / Ecommerce / Omnichannel | Commerce-standardised chains |

Gateway `directory_presence` is **not** an org commerce baseline; seeds remain acquisition tools.

---

# Competitive Positioning & Market Moat

| Barrier | Why it protects Visible Shelf |
|---------|-------------------------------|
| Engineering complexity | Directory provenance + claim + POS + Google SWIS + commerce |
| Time to build | Compounding head start |
| Google SWIS underuse | Few platforms bridge local POS → SWIS at scale |
| Clover ecosystem | Distribution into SMB POS footprint |
| **Directory network effect** | Gateway density makes Starter and marketplace more valuable |
| Middle-market neglect | Too small for enterprise suites, too hard for website builders |

V3 strengthens the moat story: **own the courtyard (directory)** before renting halls (Google / platform / commerce).

---

# Implementation Implications (strategy → build)

These are **strategic requirements** for engineering alignment — detail lives in the Entry Presence ladder spec:

1. **Do not ship** one-time `website` / `listing_plus` as peer presence modes.  
2. **New `presence` tier key** (display: "Starter") as directory-mode capabilities only. Old `starter` tier stays inactive — no legacy purge required.  
3. **Hierarchy:** Starter must not inherit Google-only; Storefront inherits Discovery-class Google by default.  
4. **Gateway upgrade UX:** mode picker (Starter primary; Discovery & Storefront alternates).  
5. **Kill “Upgrade to Sell Online”** as the gateway CTA.  
6. **Update** tier-hierarchy skill, growth tips, FEATURE_TIER_MAP. Old `'starter'` fallbacks are dormant code (inactive tier) — no purge needed.  
7. **Align** light-tier invite copy: claim = NAP ownership; public logo/story = Starter+.

---

# The Platform North Star

> *Visible Shelf meets retailers where they are — and shows them where they could be.*

> *Directory Presence opens the gate. Entry Presence chooses the surface. Commerce opens the till.*

Every paid mode rides shared infrastructure (identity, listings, integrations, analytics). Retailers change **mode**, not systems, as ambition grows.

**Mission constant:** product visibility that drives conversion — without the IT team.

---

# Success Metrics

## Gateway
- Seed → publish → claim rate  
- Time-to-claim  
- Directory density by city/category  

## Entry Presence
- Gateway → Starter / Discovery / Storefront attach rates (by mode)  
- Mode mix (directory vs Google vs platform)  
- Starter retention as directory product quality signal  

## Commerce
- Entry Presence → Commerce conversion  
- Mode match quality (deposit vs full vs both)  
- Holding fee and online GMV  

## Revenue
- ARPU by layer (Presence vs Commerce vs Scale)  
- Trial → paid by mode  
- LTV by entry mode (Starter-first vs Discovery-first vs Storefront-first)

## Engagement
- Directory usage (gateway + Starter)  
- Google visibility performance (Discovery+)  
- Platform browse / inquiry (Storefront+)  
- Reservations, pay-in-full, abandonment (Commerce)

---

# Document control

| Version | Date | Summary |
|---------|------|---------|
| V2 | 2025–2026 | Commerce business-model alignment (deposit / full / both) |
| **V3** | 2026-08-18 | Entry Presence triad + Directory Presence gateway; Starter = directory mode; Discovery = Google third-party; Storefront = platform in-house; peer presence choice before commerce |

*This document is the strategic foundation for platform decisions, product development, and go-to-market. All future development should align with the **layer model** (Gateway → Entry Presence → Commerce → Scale) and the dual mode triads (presence surfaces · money rails).*

---

**End of PLATFORM_STRATEGY_V3**
