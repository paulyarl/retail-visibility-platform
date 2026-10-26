# Platform Google Business Profile & Google Ads Acquisition Spec

**Status:** DRAFT v0.1 — for review
**Owner:** Growth & Marketing (with Product sign-off on claims)
**Date:** 2026-10-26
**Scope:** The platform's *own* customer-facing Google Business Profile and the Google Ads program that uses it to acquire merchants. This is distinct from the **merchant-facing GBP Management Suite** (`docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md`) — that spec is the product; this spec is us being our own best customer.

**Referenced docs:**
- `docs/GO_TO_MARKET_STRATEGY.md` — channel priority & Phase-2 Google Ads budgets this spec operationalizes
- `docs/ULTIMATE_VALUE_PROPOSITION.md` — "Broadcast Your Shelf to the World" positioning
- `docs/MARKETPLACE_REBRANDING_ANALYSIS.md` — customer-facing "marketplace" language rules
- `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md` — the GBP product we sell (and must exemplify)
- `docs/LocalBiz/MARKET_LAUNCH_PLAYBOOK_SPEC.md`, `docs/LocalBiz/PIONEER_RECRUITMENT_SPEC.md` — metro-by-metro launch model
- `shared/tier-contract.json` — canonical tier names, order, pricing

---

## 1. Executive Summary

VisibleShelf acquires merchants through a **claim-first funnel**: we pre-list local shops from public data, a merchant finds their own store already on the platform, claims it, and climbs the tier ladder. Google's local surfaces (Business Profile + Ads) are the highest-intent channel for exactly the owner-operator searching *"how do I get my store on Google"* — which is also the literal product we sell (the `discovery`/SWIS tier is a Google surface; the GBP Management Suite automates reviews, posts, and NAP hygiene).

This spec covers two coupled workstreams:

1. **Platform GBP** — a fully-optimized Google Business Profile for VisibleShelf itself, configured to the same "Gold Standard" we benchmark merchants against, wired with UTMs so GBP traffic is attributable, and used as a **location/call asset** inside Google Ads.
2. **Google Ads program** — search-first campaign architecture aligned to the GTM doc's Phase-2 budget ramp ($2K/mo → $13K/mo over 6 months), organized around the platform's real wedge surfaces: Clover/POS sync, Google Shopping/SWIS, storefronts, and GBP management.

**The recursive proof point:** every ad claim ("we manage your Google presence") is demonstrated by our own profile. The platform GBP is both an acquisition surface and a product demo.

---

## 2. Platform Analysis

### 2.1 What the platform is

A **GPS-aware local marketplace + retail visibility SaaS** for independent brick-and-mortar merchants. One store, three addresses: platform path (`/tenant/{id}`), subdomain (`{slug}.visibleshelf.com`), custom domain. Shoppers browse `/directory` and `/place`; merchants claim a seeded listing and upgrade.

### 2.2 Positioning & claims inventory (ad-usable, already shipped in copy)

| Claim | Source surface |
|---|---|
| "Your shelf, made visible." | LandingHero eyebrow |
| "We list local shops from public info — claim yours and it becomes a full online presence" | LandingHero subcopy |
| "Find your store →" / "See a live storefront" | LandingHero CTAs (`/directory`, `/tenant/tid-25we5qgj`) |
| "Broadcast your shelf to the world" | ULTIMATE_VALUE_PROPOSITION |
| "Connect Clover, go live on Google in 5 minutes" | GTM Clover listing |
| Free tier: directory listing, Clover sync, Google Shopping feed, QR codes, SEO | Value-prop moat table |
| "{N} retailers on the platform", "Built by retailers, for retailers" | Hero trust strip |

### 2.3 The ladder we're selling into (`shared/tier-contract.json`)

| Rung | Tier | Price | Angle for ads |
|---|---|---:|---|
| Gateway | `directory_presence` | $0 | "Already listed — claim it free" |
| Entry triad | `discovery` (**SWIS**) | $29 | Google surface — "See What's In Store" on Google |
| | `presence` (**Storefront**) | $39 | Deposit-commerce storefront |
| | `storefront` (**Storefront+**) | $59 | Enhanced storefront |
| Commerce | `commitment` / `ecommerce` / `omnichannel` | $79–149 | Checkout, multi-channel |
| Scale | `professional` / `organization` / `enterprise` | $199–499 | Multi-location, org |

**Ad-strategy implication:** lead with the free claim (`directory_presence`) and the $29 Google-surface tier (`discovery`/SWIS) — the cheapest "yes" and the tier that matches the searcher's intent. Ladder upgrades happen in-product, not in the ad.

### 2.4 Capability attributes that differentiate in ads

- **GBP Authorized Management Suite** — automated AI review responses, scheduled local posts, categorized photo sync, holiday-hours/NAP guardian (the audience searching "google business profile management" is buying our exact product).
- **SWIS / GMC sync** — live POS inventory on Google Shopping & local "near me" surfaces; Google taxonomy alignment.
- **Implemented integrations (verified in `apps/api`):** Clover OAuth + catalog/inventory sync; Square OAuth + catalog/inventory sync (`services/square/`); Google — GBP OAuth + GMC product sync (`lib/google/`, scheduled sync jobs); Meta catalog sync (`jobs/meta-catalog-sync.ts`, `lib/meta/`); Pinterest campaign/pin tooling (`lib/pinterest/`). **Each is an ad target — see §4.2.**
- **Three addresses** — platform + subdomain + custom domain storefronts.
- **Marketplace demand** — `/directory` + `/place` shopper surfaces merchants join, not just tooling.
- **Marketing Ops proof** — automated diagnostic audits of a merchant's *own* GBP (the diagnostic gallery is a ready-made ad landing offer: "see your free audit").

---

## 3. Google Business Profile — Setup Spec

### 3.1 Entity strategy & eligibility

**Decision (2026-10-26):** A physical agency location is in flight but not yet operational. Until it opens, the profile runs **fully virtual** — Option A: service-area business, address hidden, service areas = the targeted launch metro(s) per `MARKET_LAUNCH_PLAYBOOK_SPEC.md`.

| Option | Profile type | Pros | Cons |
|---|---|---|---|
| **A (current)** | Service-area business (SAA), address hidden, service areas = launch metros | Policy-clean for online-first businesses; still eligible for local pack in target metros | No map pin photo ops; weaker "visit us" signal |
| **B (on office open)** | Verified office address shown | Map pin, directions, local trust | Requires real staffed office, signage, and re-verification |
| C | One profile per launch metro | Local relevance per market | Virtual offices/PO boxes are a violation risk; high suspension exposure — **avoid unless real offices exist** |

**Migration path A→B (when the agency location opens):**
1. Confirm the office is staffed during listed hours and has permanent signage — Google's video verification checks for this.
2. Update the profile to a storefront-type listing with the real address; expect re-verification (video or postcard).
3. Update the NAP canonical record and re-sweep citations (§3.7) — the address change is the moment inconsistency risk peaks.
4. Keep service areas configured alongside the address so metro targeting doesn't reset.

### 3.2 Core fields

**Current state (verified from live profile 2026-10-26):** profile exists and is verified ("You manage this Business Profile"), public name `VisibleShelf` (rename from `Visible Shelf` approved same-day), primary category `Software company`, phone `(913) 703-6157`, hours set (closes 5 PM), description live, 3 posts scheduled (Update/Offer/Update), ~339 views baseline. **Media done same-day:** cover (POS→Google beam crop from `ASSETS/P01`), square `visible SHELF` logo in the logo slot, ~25 photos from the PinTraffix asset library + generated retail-context images (few images carry unfilled QR placeholder slots — composite real codes or replace). **Remaining action flags:**
- **Name form:** profile says `Visible Shelf`; FB/domain/socials say `VisibleShelf`. Pick one — recommendation: `VisibleShelf` to match domain + socials (legal entity "Visible Shelf LLC" remains the doc name for verification). Edit pending decision.
- **Location:** confirmed 2026-10-26 — `No location; delivers and home services only`, address hidden, service area `United States`. Metro-scoped service areas (per `MARKET_LAUNCH_PLAYBOOK_SPEC`) remain an option for local-pack relevance in launch cities; countrywide is defensible for SaaS.
- **Phone:** `(913) 703-6157` already matches the FB page — treat as the canonical NAP number. If ads call-tracking wants a different number, put it in the *Ads call asset*, not the profile.

| Field | Value |
|---|---|
| Business name | `VisibleShelf` (pending name-form decision above) — no keyword stuffing ("VisibleShelf — Local Store Marketing Platform" risks suspension and violates our own Gold Standard) |
| Primary category | `Software company` ✅ already set |
| Secondary categories | Add: `E-commerce service`, `Advertising service`, `Business to business service` (contingent — categories change) |
| Description (750 chars) | Draft below |
| Phone | `(913) 703-6157` ✅ set — answers to the **Chief Platform Officer** (decision 2026-10-26); keep identical across all citations |
| Website | ✅ set with UTM: `https://visibleshelf.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp` |
| Appointment link | `/contact` or demo-booking URL with `utm_content=gbp_appointment` |
| Hours | ✅ staffed hours set — keep them honest to when the CPO actually answers (not `24 hours`); overstating hours is a Gold-Standard violation we audit merchants for |
| Opening date | Platform founding date |
| Attributes | Online appointments, online estimates/quotes; LGBTQ+/women-owned etc. only if true |

**Draft description (≤750 chars):**

> VisibleShelf is the local visibility platform for independent retailers. We pre-list your store from public info so shoppers can already find you — claim it free and it becomes a full online presence: storefront, product catalog, Google Shopping feeds, QR codes, and automated Google Business Profile management. Connect Clover or Square in minutes. Plans from $29/mo. Your shelf, made visible.

### 3.3 Services & Products sections

Map the public ladder to GBP Services (each service → landing URL with UTM):

| GBP service entry | Maps to | Link |
|---|---|---|
| Claim your free listing | `directory_presence` | `/directory` |
| Google presence management (SWIS) | `discovery` | `/solutions/google-visibility` |
| Storefront & product catalog | `presence`/`storefront` | `/storefront` (§6.4) |
| Review & post automation | GBP Suite | `/features` |
| POS inventory sync (Clover/Square) | integrations | `/solutions/clover-storefront` |
| E-commerce & multi-location | commerce/scale tiers | `/features#pricing` |

GBP Products section: **skipped** — the profile is linked to a Merchant Center account ("VisibleShelf", `visibleshelf.com` verified + claimed, customer-service contact `contact@visibleshelf.com` / +1 913-703-6157 — consistent with NAP). MC state verified 2026-10-26: **0 products**, no store-quality score, two API product sources (`Content API`/US and `VisibleShelf`/Merchant API feed label V12). Offers live in the recurring Offer-post slot (§3.5) instead. **Resolved 2026-10-26:** tenants connect their own GMC/GBP via OAuth (integrations UI: per-tenant linked Merchant Account, per-tenant product sync) — tenant products never enter the platform MC. The platform MC is dedicated; keep the GBP link — a verified/claimed domain strengthens entity trust.

### 3.4 Media spec (the Gold Standard we enforce on merchants — applied to us)

- Logo (square, hi-res), cover image (storefront-shelf branded, not stock).
- ≥6 photos: product screenshots (claim flow, storefront, GBP dashboard), team/office if real, the demo storefront on a phone.
- ≥1 video ≤30s: screen-capture "claim your store in 60 seconds."
- Refresh quarterly — stale-media is exactly what our NAP/attribute guardian flags for customers.
- **No AI-rendered fake premises** — profile is service-area/virtual until the office opens (§3.1); fabricated office/storefront imagery contradicts that. Branded abstract + product-context visuals + real UI screenshots only.

#### 3.4a Existing asset library (`ASSETS/` — PinTraffix loops, 2:3 portrait 1200×1800)

Map to GBP slots — portrait is fine for the photo grid; the cover needs a 16:9 crop or new render:

| GBP slot | Asset | Notes |
|---|---|---|
| Cover (16:9) | `P02/p02-google-visibility-hero.png` (center-crop) — or render §3.4b slot 1 | Google-visibility theme fits best |
| Photo: POS sync | `P01/p01-clover-storefront-hero.png`, `P01/clover-split-1.png`, `clover-split-3.png` | Clover → storefront/feed story |
| Photo: before/after | `P02/google-before-after-1.png`, `-2.png`, `-3.png` | The "visibility decay → fixed" narrative |
| Photo: commerce depth | `P03/p03-deposit-commerce-hero-v2.png`, `P04/p04-omnichannel-hero-v3.png`, `P13/p13-ecommerce-hero.png` | Upper-ladder capability proof |
| Photo: enrichment | `P14/p14-barcode-enrichment-hero.png`, `P14/barcode-scan-split-1.png` | AI/product-enrichment angle |
| Post tile (1:1) | render §3.4b slot 6 | Clean overlay background for offer posts |

#### 3.4b Gap-render prompt script (platform context)

Conventions per `docs/PinTraffix/AI_IMAGE_GENERATOR_PROMPTS_GUIDE.md` — palette blue `#2563EB` / amber `#F59E0B` / emerald `#10B981`, top ~30% uncluttered for Canva text, **never AI-render QR patterns** (drop real `generateStyledQRCode` output in post).

- **Cover (16:9):** `Wide cinematic brand image for a retail visibility platform. A warm boutique retail shelf with neatly arranged products on the left, dissolving into a glowing digital grid of product cards and map pins on the right. Deep navy background, blue #2563EB and amber #F59E0B accent glows, clean minimalist composition, generous empty space top-third for title text, professional SaaS marketing aesthetic, hyper-detailed --ar 16:9 --style raw`
- **Local-discovery map (1:1):** `Top-down stylized city map at dusk with small glowing storefront icons and one bright highlighted pin, thin route-lines connecting neighborhoods, blue-toned palette with amber highlights, flat-illustration-meets-3D-render style, clean and modern --ar 1:1`
- **Dashboard collage (16:9):** `Sleek floating UI collage: layered glass-morphism dashboard panels showing review ratings, scheduled post cards, and inventory sync checklists, subtle depth of field, navy and indigo palette with blue accent light, SaaS marketing hero style, empty space on left for text --ar 16:9`
- **Post tile (1:1):** `Minimal square promo background: soft gradient from deep navy to indigo, a faint outlined shelf silhouette centered, subtle amber glow, completely uncluttered center and edges for Canva text overlay --ar 1:1`

#### 3.4a AI-rendered media — prompt script (added 2026-10-26)

Base visuals may be AI-rendered using the established convention in `docs/PinTraffix/AI_IMAGE_GENERATOR_PROMPTS_GUIDE.md` (AI base + real UI screenshot + Canva overlay; palette blue `#2563EB` / amber `#F59E0B` / emerald `#10B981`; top ~30% kept uncluttered).

**Guardrail:** no AI-rendered fake office/storefront premises — the profile is service-area/virtual until §3.1's office migration, and fabricated real-estate imagery contradicts it. Branded abstract + product-context visuals + real UI screenshots only. Never AI-render QR patterns — placeholder slot + real `generateStyledQRCode` output in Canva.

| Slot | AR | Prompt |
|---|---|---|
| Cover photo | 16:9 | `Wide cinematic brand image for a retail visibility platform. A warm boutique retail shelf with neatly arranged products on the left, dissolving into a glowing digital grid of product cards and map pins on the right. Deep navy background, blue #2563EB and amber #F59E0B accent glows, clean minimalist composition, generous empty space top-third for title text, professional SaaS marketing aesthetic, hyper-detailed --ar 16:9 --style raw` |
| "Broadcast your shelf" | 4:3 | `Conceptual product-visual: a small neighborhood shop's wooden shelf glowing softly, its items duplicating upward into floating translucent product cards connected by thin light-lines to a stylized Google search pin and map tile. Emerald #10B981 and blue accent light, dark elegant backdrop, no text, no QR codes --ar 4:3` |
| POS sync concept | 4:3 | `Retail technology scene: a Clover POS terminal on a boutique counter in sharp focus, a visible stream of small product icons flowing from the terminal screen toward a floating smartphone showing a clean e-commerce storefront with an "In Stock — Local Pickup" badge. Warm store lighting, soft bokeh, professional commercial photography style --ar 4:3` |
| Local discovery map | 1:1 | `Top-down stylized city map at dusk with small glowing storefront icons and one bright highlighted pin, thin route-lines connecting neighborhoods, blue-toned palette with amber highlights, flat-illustration-meets-3D-render style, clean and modern --ar 1:1` |
| Dashboard/analytics | 16:9 | `Sleek floating UI collage: layered glass-morphism dashboard panels showing review ratings, scheduled post cards, and inventory sync checklists, subtle depth of field, navy and indigo palette with blue accent light, SaaS marketing hero style, empty space on left for text --ar 16:9` |
| Offer tile template | 1:1 | `Minimal square promo background: soft gradient from deep navy to indigo, a faint outlined shelf silhouette centered, subtle amber glow, completely uncluttered center and edges for Canva text overlay ("Free Visibility Audit") --ar 1:1` |

Composite rule: real UI screenshots layer in via Canva on slots 3/5; the offer tile is a reusable background for the Wed Offer posts.

### 3.5 Posts cadence (eat our own cooking)

Weekly cadence, matching what the Suite automates for merchants:

| Day | Post type | Content source |
|---|---|---|
| Mon | Update | Feature release / changelog highlight |
| Wed | Offer | "Free visibility audit" CTA → diagnostic-gallery landing |
| Fri | Update | Merchant spotlight from `/directory` (with merchant consent) |

Every post links with `utm_campaign=gbp_post&utm_content={date}-{type}`.

### 3.6 Reviews & Q&A program

- **Q&A module not present on this profile** (verified 2026-10-26 — Google phases it out on newer profiles; no "Questions & answers" section renders). The seed Q&As (`claim process`, `Clover/Square`, `pricing`) move to an FAQ-style post or a `/features#faq` block instead.
- Review acquisition: post-activation prompt to happy claimed merchants (in-product, policy-compliant — never gated/incentivized).
- Response SLA: 48h, on-voice templates — we sell a 48h AI responder; we must beat it.
- **Handle negative reviews per our own dispute playbook** — public, professional, evidence-based.

### 3.7 Linked social profiles

GBP supports linking social profiles directly on the listing — every linked profile is a secondary conversion surface and a trust signal on the profile itself. Platform handles (recorded 2026-10-26):

| Platform | Handle | Relevance |
|---|---|---|
| Facebook | `shelfvisible` | Campaign 6 — ad identity for Meta catalog; page lives in the **Visible Shelf LLC** business portfolio, renamed from legacy "DiviPost" → **VisibleShelf** (approved same-day 2026-10-26), `@shelfvisible` claimed, published + worldwide-visible. Page displays phone **+1 913-703-6157** — reconcile with the GBP tracked line (§3.2) so citations don't show two numbers |
| Instagram | `shelfvisible` | Campaign 6 — Meta catalog/IG shops ads point at the same org; linked to the FB page |
| Threads | `shelfvisible` | Meta surface — rides the FB/IG identity; added to FB page social links 2026-10-26 |
| Pinterest | `shelfvisible` | Campaign 7 — Pinterest commerce ads point at the same org |
| TikTok | `shelfvisible` | Merchant-facing short video (claim demos, storefront tours) |
| X | `shelfvisible` | Product/launch updates |

**Consistency flag:** the brand/domain is `VisibleShelf` / `visibleshelf.com` but every handle is `shelfvisible`. Before linking, decide whether to (a) keep handles as-is and treat them as the accepted social name, or (b) migrate to `@visibleshelf` where available — GBP, ads, and citation sweep should present one consistent identity. Logged as open question §7.

**Pre-link checklist per profile:** bio matches platform description, links to `visibleshelf.com`, has ≥3 posts (an empty profile linked from GBP undermines trust), profile image = platform logo.

### 3.8 Governance

- NAP canonical record kept in one internal doc; every directory citation (Yelp, Bing Places, Apple Business Connect, Facebook) must match GBP exactly — citation inconsistency is a failure mode we scan merchants for.
- Quarterly GBP audit run **through our own audit pipeline** (eat-the-product loop; also a marketing artifact: "we score our own profile").

---

## 4. Google Ads — Program Spec

### 4.1 Account & measurement foundation (before any spend)

#### Google Analytics (GA4) setup

**Tag landed 2026-10-26:** `components/GtagScript.tsx` renders gtag.js sitewide from the root layout, gated on `NEXT_PUBLIC_GA_MEASUREMENT_ID` — no tag existed before (Vercel Analytics commented out, no double-tag risk). `lead_form_submitted` fires on the `/contact` intake success path with the UTM campaign attached. Remaining steps are console-side:

1. Create the GA4 **account + property** for the platform (`VisibleShelf — Web`), business details set to the platform's real category/size.
2. Create a **web data stream** for `visibleshelf.com` with enhanced measurement on (page views, scrolls, outbound clicks, site search, form interactions).
3. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in deploy env; verify `page_view` and `lead_form_submitted` fire in Realtime before linking anything.
4. Mark the conversion-path events in §4.1 below as **key events** in GA4, then import them into Ads (don't recreate them manually in Ads — one source of truth).
5. **Link GA4 ↔ Google Ads** (Admin → Product links): enables conversion import, audience export for remarketing/RLSA, and cross-channel attribution.
6. Configure **consent mode** and **enhanced conversions** (hashed first-party data from signup/lead forms) before spend begins.

#### Google Ads setup

- Google Ads account + **link GBP as location asset** (enables local formats, directions CTAs), call asset on the tracked number, sitelink/callout/structured-snippet assets, and **lead form assets** where a landing page isn't ready yet (§4.4).
- Conversion actions (imported from GA4 unless noted):
  1. `claim_started` / `claim_completed` (primary)
  2. `signup` → `trial_started` → `paid_activation` (imported from backend events — offline conversion import or enhanced conversions)
  3. `lead_form_submitted` — the lead-intake path (§4.4); includes Google lead-form-asset submissions synced via webhook/CRM
  4. `audit_requested` (diagnostic gallery)
  5. `call_>60s`, `demo_booked`
- UTM convention (matches existing `lib/social/campaignUrls.ts` / UTM-CRM retrofit): `utm_source=google&utm_medium=cpc&utm_campaign={campaign_slug}&utm_term={keyword}&utm_content={ad}`; auto-tagging on (gclid) — UTMs are the fallback, gclid is primary.

### 4.2 Campaign architecture

**Rule: every implemented integration is a target.** If the platform ships a working connector, there is a high-intent audience searching "{integration} + online/Google" — each one gets a dedicated campaign + landing pair, and the ad claim is verified against shipped code (not roadmap). Current implemented set: **Clover, Square, Google (GBP + Merchant Center), Meta catalog, Pinterest.**

Campaigns are ordered to the GTM Phase-2 wedge priority; each maps to one claim + one landing surface.

| # | Campaign | Intent cluster | Match | Landing | Est. CPC |
|---|---|---|---|---|---|
| 0 | **Brand — VisibleShelf** | `visibleshelf`, `visible shelf`, misspellings | exact/phrase | `/` | <$1 |
| 1 | **POS wedge — Clover** (primary, GTM-aligned) | "clover google shopping", "clover inventory sync", "clover online store", "connect clover to website" | phrase + exact | `/solutions/clover-storefront` | $5–15 |
| 2 | **POS wedge — Square** | "square google shopping", "square inventory to google" | phrase + exact | `/square` *(interim: `/features`)* | $5–15 |
| 3 | **Google presence / SWIS** | "get products on google shopping", "google merchant center help", "local inventory ads", "see what's in store" | phrase | `/solutions/google-visibility` | $8–20 |
| 4 | **GBP management service** | "google business profile management", "google review management service", "automate google reviews", "gbp posting service" | phrase | `/solutions/gbp-management` | $6–15 |
| 5 | **Storefront / marketplace** | "online store for retail shop", "storefront builder no code", "sell local products online" | phrase | `/solutions/deposit-commerce` | $10–25 |
| 6 | **Meta catalog / social commerce** | "facebook shop from pos inventory", "sync inventory to instagram", "meta catalog for retail" | phrase | `/solutions/meta-shops` | $4–10 |
| 7 | **Pinterest commerce** | "pinterest for retail store", "pinterest product catalog sync", "sell on pinterest local" | phrase | `/solutions/pinterest` *(or `/features` anchor)* | $2–6 |
| 8 | **Competitor/alternatives** (test, small) | "shopify alternative for retail", "cheaper than [competitor] for local store" | phrase | `/compare/clover-vs-shopify` | $8–20 |
| 9 | **Demand-gen / PMax** (later) | audience signals from converted claims | — | `/` | n/a |

**New-connector rule:** when a new integration ships (e.g., a third POS), it inherits this pattern — dedicated campaign + landing page + GBP service entry — and is added to this table before launch spend begins.

**Campaign 4 is the differentiator vs. the GTM doc**: the GBP Suite didn't exist when that doc was written. "Google business profile management" searchers are the highest product-fit audience we have and the keyword set is less contested than "online store builder".

**Campaign 0 (brand) also covers the name collision**: `thevisibleshelf.com` ("The Visible Shelf", a curated book site — not ours; its owner registered the `the…` variant because `visibleshelf.com` was already taken) ranks on the same-phrase results and was appearing in the profile's web results. We hold the canonical domain, so the collision decays as our entity signals strengthen. Mitigation, landed 2026-10-26: platform-level `Organization`+`WebSite` JSON-LD in the root layout (`components/PlatformStructuredData.tsx`) — `name: VisibleShelf`, `alternateName: "Visible Shelf"` (the legal form; deliberately NOT "The Visible Shelf"), `sameAs` listing all six socials — plus brand-keyword coverage on `visibleshelf` *and* `the visible shelf` variants.

**Negative keywords (shared list):** free wordpress theme, jobs, salary, DIY/how-to-only queries we can't convert ("how to delete google review" — unless routed to an educational landing), ebay, amazon seller, shopify login, competitor brand names we shouldn't bid on (policy), `google my business login` (navigational — wasted spend; test).

### 4.3 Ad copy matrix (draft RSAs)

Campaign 1 — Clover:
- H: `Clover to Google Shopping, Free` / `Live on Google in 5 Minutes` / `No Manual Data Entry` / `Free Clover Sync — Plans from $29`
- D: `Connect Clover once. We sync your inventory to Google Shopping, a storefront, and our marketplace — automatically.` / `Your store may already be listed. Claim it free.`

Campaign 4 — GBP management:
- H: `Your Google Profile, Managed` / `Reviews Answered in 48h, Automatically` / `We Fix & Run Your Google Listing` / `Free Profile Audit`
- D: `Automated review responses, weekly posts, hours & NAP protection — the Gold Standard your Google Business Profile needs. From $29/mo.` / `See your free visibility audit first. No card required.`

Campaign 3 — SWIS:
- H: `Show Local Shoppers Your Real Shelf` / `In-Stock Items on Google, Automatically` / `POS to Google Shopping`

**Ad assets:** sitelinks → Find Your Store / Pricing / Live Demo (`/tenant/tid-25we5qgj`) / How It Works; callouts → "Free listing" "5-min setup" "No developer" "Cancel anytime"; structured snippets → Services: Google Shopping, Storefront, GBP Management, POS Sync; promotion asset → free audit.

### 4.4 Landing surfaces (gap list)

Existing: `/` (hero, claim-first), `/directory`, `/features`, `/features#pricing`, `/tenant/tid-25we5qgj` (demo), `/directory/about`, `/compare`.

**Needed (content work, flagged for web team).** Route names follow the `/solutions/*` convention already spec'd in `docs/PinTraffix/VISIBLE_SHELF_PINTEREST_OFFER_ANALYSIS_OPTIMIZED.md` (which also flags them unbuilt — one landing workstream serves Pinterest + GBP + Ads):

| Route | Purpose | PinTraffix loop |
|---|---|---|
| `/solutions/clover-storefront` | Clover wedge — OAuth screenshot, "5 minutes" claim, sync demo | P-01 (P0) |
| `/solutions/google-visibility` | SWIS tier + Google presence — feed mechanics, "see what's in store" | P-02 (P0) |
| `/solutions/deposit-commerce` | Storefront/deposit-commerce story, three addresses, QR | P-03 (P0) |
| `/solutions/omnichannel` | Unified-commerce rung | P-04 (P0) |
| `/solutions/ecommerce` | Full checkout rung | P-13 (P1) |
| `/solutions/gbp-management` | The Suite — free-audit offer above the fold (new; GBP-only) | — |
| `/solutions/meta-shops` | Meta catalog sync — POS inventory → Facebook/Instagram shops | — |
| `/guides/google-visibility-checklist` | Lead-magnet guide; natural home for the free-audit offer once intake exists | P-guide |
| `/compare/clover-vs-shopify` | Competitor-campaign landing | spec'd |
| `/square`, `/pinterest` | Square parity page (or `/solutions/square-storefront`), Pinterest commerce — lower priority, can start as `/features` anchors | — |

**Metadata blocker (shared with Pinterest):** several public surfaces are `'use client'` pages lacking `generateMetadata`/`openGraph`, so they can't control link previews — the same engineering pass that builds `/solutions/*` must add server-side metadata + OG images + UTM/ref capture. Applies equally to ad landing pages (ad reviewer quality signals).

Each landing page leads with the **claim-your-store CTA** (matches the platform funnel). Message-match: headline repeats the ad's promise verbatim.

#### Conversion paths per landing (three, not one)

Not every merchant is ready to claim or sign up from an ad click. Every landing surface offers all three paths, in this visual priority:

| Path | Mechanism | For whom | Conversion event |
|---|---|---|---|
| **1. Claim** | "Find your store →" → `/directory` claim flow | Ready-to-act merchants (primary) | `claim_completed` |
| **2. Signup** | "Start free trial" → `/auth/signup` | Merchants whose store isn't seeded yet, or who skip claim | `signup` / `trial_started` |
| **3. Lead intake** | Short form (name, business name, phone/email, POS system, "what do you need help with") routed to the CPO — same human who answers the tracked line | High-intent but not self-serve; the owner-operator who wants a person | `lead_form_submitted` |

**Intake is live (landed 2026-10-26):** `/contact` submits to `POST /api/public/directory/lead-gen` → `MarketingProspectQueueService.addToQueue` (`source_kind: directory_lead_gen`, dedup vs active queue + existing campaigns) with business name, contact name, email, phone, **POS system** (clover/square/other/none — the Clover-signal capture for campaign-1 attribution), note (+ UTM source captured in the note). The seed-search miss is covered too: `DirectoryList`'s empty state now renders `AddBusinessCta` (`source=directory_search_empty`) → `/directory/add-business` (existing owner-submission flow, email-verified). **Both intakes file into the CRM Requests Hub** (`/settings/admin/crm/requests`): owner submissions via `DirectoryOwnerSubmissionService.notifyNewSeed` (`directory_owner_submission` ticket + prospect-queue mirror), lead-gen via a `directory_lead_gen` ticket on `crm_support_tickets` linked to the queue entry (added 2026-10-26 — previously queue-only).

**Inbound-lead SOP (decided 2026-10-26):** lead-gen entries differ from outbound prospects — they carry no discovery evidence and hold a promised 1-business-day SLA (the ack email). Processing: Requests-Hub ticket is the clock → look the business up on `/directory` → **seeded**: send the claim link/gallery; **unseeded**: enqueue a seed+report run — the generated seed is the reply ("we found your business; claim it"). Response sets next-steps expectations — the ack email now carries the three-step path: seed/find listing → claim invite by email → **claim activates 5 free product slots** → tenant dashboard onboarding (add products, manage listing, storefront + directory surfaces), plus post-claim address education: **tenant ID** (`visibleshelf.com/t/<tenant-id>` — dashboard/products/settings) vs **listing slug** (`visibleshelf.com/directory/<slug>` — the public address; storefront/subdomain/custom domain unlock on claim). Clover-flagged leads are the campaign-1 demo segment. Consent caveat: the form collects an inquiry, not marketing opt-in — broadcast cadence needs consent before enrolling a lead. On submit the API sends a branded acknowledgement email (`LeadIntakeEmailService.sendLeadAcknowledgement`, fire-and-forget) from `support@visibleshelf.com` (`EMAIL_SUPPORT` env, `unifiedConfig.emailSupport`) — greeting, one-business-day SLA, "find your store" + "create a free account" CTAs. The success state links to `/customerlogin?mode=register` — the customer account flow (`customer-auth` register/dashboard shows claim requests) is the durable response channel. `/g/{shortCode}` remains the per-prospect diagnostic-gallery resolver (Marketing Ops-generated audits), not a request surface.

**The audit offer is fulfillable by the existing seed pipeline — the build is a front door, not a product.** The pipeline already does: public signals → seed construction → per-field provenance → automated seed intelligence report → claim token → `directory_presence` tenant (see `docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md`, `.devin/skills/directory-presence-seed-claim/SKILL.md`; `audits/*.json` are its report artifacts). What's missing is only a **request intake**: a form (business name + location + contact) that enqueues a seed/report run for a business not yet seeded, or returns the existing claim link when it is — the pipeline is operator/campaign-driven today, not request-driven. Delivery surface already exists: the generated report + claim-token link (`/preview/{token}` via `/g/{shortCode}`).

Lead-intake rules:
- The form is the **safety net, not a gate** — it sits below the fold or behind a "talk to us" CTA, never in front of claim/signup.
- Same intake surface reused by the GBP **appointment link** (§3.2) so organic profile leads and paid leads share one routing path to the CPO.
- **Google lead form assets** on campaigns 1/4 cover clicks before the dedicated landing pages ship — submissions sync to the same intake destination.
- SLA: CPO responds within one business day; the response SLA is a product claim (we sell 48h review-response automation) so it must be kept.

### 4.5 Audiences & targeting

- Geo: launch metros first (per `MARKET_LAUNCH_PLAYBOOK_SPEC.md`), expand nationally once claim-rate validates; the seeded-listing coverage map defines where "find your store" works.
- Observation layers: retail-owner in-market segments, website visitors (remarketing list ≥1000 before RLSA-only campaigns), customer-match exclusion of active tenants.
- Schedule: all-hours initially; review dayparting after 4 weeks.

### 4.6 Budget ramp (extends GTM Phase-2 table)

**Phase note (2026-10-26): no spend authorized yet — viability testing only.** The live promo funnel (GBP posts → `/directory` claim-check → `/contact` intake → prospect queue + branded ack) is what is being validated; no Ads budget is committed. The `/solutions/*` landing set and GA4/Ads wiring are required **before spend**, not before the test. Priority upgrade for the test phase: the audit-request intake front door (§4.4 seed-pipeline hook) makes the real "free visibility audit" offer deliverable and is the strongest viability signal.

| Month | Clover | Square | SWIS | GBP Mgmt | Storefront | Meta | Pinterest | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | $2,000 | — | — | — | — | — | — | $2,000 |
| 2 | $3,000 | — | $1,500 | — | — | — | — | $4,500 |
| 3 | $4,000 | $1,000 | $2,000 | $1,500 | $500 | — | — | $9,000 |
| 4–6 | $5,000 | $1,500 | $3,000 | $2,500 | $1,000 | $500 | $500 | $14,000 |

The $1K/mo above the GTM doc's $13K ceiling funds the Meta + Pinterest integration campaigns added in this spec; trim from Storefront first if the ceiling is firm.

Start: manual CPC / maximize-clicks with caps until ~30 conversions, then tCPA on `claim_completed`, then tCPA on `paid_activation` once volume supports it. GTM targets hold: blended CAC ≤$350, LTV/CAC ≥5x, ARPU $150.

### 4.7 Experiment backlog (draft)

1. "Find your store" claim CTA vs "free trial" CTA on campaign 3.
2. Free-audit offer (diagnostic gallery) as landing vs. feature page — the audit is our cheapest value-proof.
3. Location-asset (GBP) on/off for campaigns 3–4 — does a local pack presence lift CTR for a SaaS?
4. Call-only ads for the GBP-management audience (owner-operators call).
5. `/place` public surface as a social-proof sitelink.

---

## 5. Measurement & Attribution

- Weekly report: spend / claims / activations / paid / CAC by campaign; GBP insights (calls, direction requests, website clicks — via UTM not GBP's own metrics, which are unreliable).
- Claims attributed to `utm_campaign=gbp` count as organic-GBP; ads as cpc — keep them separate so the profile's standalone ROI is visible.
- Wire Ads conversions into the marketing-ops funnel views if feasible (the platform already tracks campaign→claim for *outbound*; this is the inbound mirror).

## 6. Compliance & Risks

- **GBP suspension risk** (wrong entity type, keyword-stuffed name, fake address) — highest-impact risk; §3.1 decision gates everything.
- **Trademark bidding** on "google business profile" terms — allowed (generic product name) but write ads carefully; don't imply affiliation with Google.
- Don't run ads promising rankings/results guarantees — policy + our own credibility.
- Ad claims must match shipped product only — verify each §4.3 claim against current capability before launch (owner: Product).
- GBP reviews: no incentives, no gating (FTC + Google policy).

## 7. Open Questions

1. ~~Physical address — do we have a real office for Option B, or commit to service-area?~~ **Resolved 2026-10-26:** virtual/service-area now; migrate to verified address (Option B) when the physical agency location opens — migration path in §3.1.
2. ~~Primary category choice~~ **Resolved 2026-10-26:** `Software company` is set on the live profile. Remaining: which secondary categories to add (draft list in §3.2), and the `Visible Shelf` vs `VisibleShelf` name-form decision (profile currently uses the two-word form).
3. ~~Phone — who answers the tracked line?~~ **Resolved 2026-10-26:** Chief Platform Officer answers directly. Remaining: exact staffed-hours schedule for the profile, and voicemail/missed-call handling when the CPO is unreachable.
4. Legal entity name for verification documents vs brand "VisibleShelf".
5. Launch-metro list — which cities are seeded enough that "find your store" ads won't dead-end?
6. Does `/gbp-management` land the Suite as sold today, or does it need the audit-offer surface built first?
7. Social handles are `shelfvisible` but brand/domain is `VisibleShelf`/`visibleshelf.com` (§3.7) — keep as accepted social name or migrate handles before GBP links and paid campaigns reference them? Facebook is now `VisibleShelf`/`@shelfvisible` (approved 2026-10-26) — the momentum favors keeping `shelfvisible` as the canonical social name and treating `visibleshelf.com` as the domain.

## 8. Rollout Checklist (draft)

- [x] §3.1 entity decision — service-area/virtual now, address profile on office open (2026-10-26)
- [x] Facebook page rebranded — DiviPost → VisibleShelf, `@shelfvisible`, published worldwide (2026-10-26)
- [ ] Social profiles pre-link audit (§3.7): bio/link/logo/≥3 posts each — FB page social links already set (X, Pinterest, Threads, TikTok, Instagram)
- [x] GBP social profile links added — FB, IG, Pinterest, TikTok, X live 2026-10-26 (Threads not in GBP's supported list)
- [x] GBP exists + verified (2026-10-26) — category, phone, hours, logo set; ~339 views baseline
- [x] GBP media — cover, logo, ~25 photos live 2026-10-26 (QR-placeholder images need composited codes)
- [ ] GBP remaining: name-form review, `Consultant` category decision, services review clear, first 3 posts, Q&A seeds
- [ ] Confirm profile address is hidden / service-area-only until office opens (§3.1)
- [ ] Claim the $500 new-advertiser Google Ads credit when the Ads account is created
- [ ] Tracked line provisioned → CPO; hours set to real answer schedule; missed-call handling confirmed
- [ ] Citations NAP sweep (Bing, Apple, Yelp, FB)
- [x] GA4 tag landed (`GtagScript`, env-gated on `NEXT_PUBLIC_GA_MEASUREMENT_ID`); `lead_form_submitted` event wired (2026-10-26)
- [ ] GA4 account/property created, data stream live, env var set, tag verified in Realtime
- [x] Key-driver events wired 2026-10-26: `lead_form_submitted` (`/contact`), `claim_request_submitted` (`/directory/claim-verify`), `claim_completed` (`acceptClaim` success in `DirectoryClaimClient`)
- [ ] Key-driver events remaining: `signup`/`trial_started` (auth), `call_>60s` (tracked line)
- [ ] GA4 ↔ Ads linked; key events marked + imported as conversions; enhanced conversions verified
- [x] Lead-intake surface live 2026-10-26 — `/contact` → `/api/public/directory/lead-gen` → prospect queue + branded ack email (`support@`) + account-create CTA
- [ ] Audit-request intake — thin form feeding business name+location into the existing seed→report→claim pipeline (request-driven entry; delivery via `/g/{shortCode}` claim link)
- [ ] GBP linked as location asset in Ads
- [ ] `/solutions/clover-storefront` + `/solutions/google-visibility` shipped (minimum viable two, shared with PinTraffix P-01/P-02), each with claim + signup + lead-intake paths
- [ ] Campaigns 0+1 live ($2K); conversion data ≥30 → smart bidding
- [ ] Campaigns 3+4 live with landing pages
- [ ] First quarterly self-audit through our own pipeline; publish score internally
- [ ] **On agency office open:** run §3.1 A→B migration (address + re-verification + citation re-sweep)
