# Visible Shelf Pinterest Offer Analysis — Optimized Merge

## PinTraffix × Platform Strategy V2 — Merged Go-to-Market Plan

**Document type:** Strategic marketing & offer architecture analysis  
**Purpose:** Merge the best of the team V0 strategy (`VISIBLE_SHELF_PINTEREST_OFFER_ANALYSIS_V0.md`) and the CTA-readiness revision (`VISIBLE_SHELF_PINTEREST_OFFER_ANALYSIS.md`) into a single, actionable, launch-ready document.  
**Sources:** `docs/PinTraffix/VISIBLE_SHELF_PINTEREST_OFFER_ANALYSIS_V0.md` + `docs/PinTraffix/VISIBLE_SHELF_PINTEREST_OFFER_ANALYSIS.md`  
**Date:** 2026-07-23  
**Status:** Optimized merge — ready for loop validation and launch execution

---

## 0. Merge Notes & Gap Analysis

### 0.1 Sources

- **V0 (team report):** Deep capability inventory, 27 domains, BSaaS pricing, 16 scored sales loops, 10 keyword ladders, 4-angle variations, board architecture, loop priority ranking, validation plan, visual asset list, offer foundations.
- **V1 (CTA-readiness revision):** Platform readiness snapshot, tier-based offer angles, 10 additional sales loops, public surface route audit (`/(platform)/page.tsx`, `/tenant/[id]`, `/products/[id]`, `/directory/[slug]`, etc.), OG/metadata optimization recommendations, UTM tracking framework, risk register, 7-day launch sprint.

### 0.2 What V0 Did Better

- Comprehensive 27-capability inventory tied to Pinterest relevance.
- BSaaS add-on catalog and bundle pricing integrated into loops.
- Rich keyword ladder library with 10 verticals and intent steps.
- Pin angle variations (4 angles per phrase) for A/B testing.
- Loop priority ranking with P0/P1/P2 pacing and weekly research routine.
- Visual asset requirements (~57 assets) and validation plan.
- Shopper-facing discovery loops (`/directory`, gift guides) alongside merchant loops.

### 0.3 What V1 Did Better

- Grounded the destination stage in actual platform routes and code (`generateMetadata`, `openGraph`, `'use client'` gaps).
- Identified which surfaces are Pinnable today vs. which need engineering work.
- Added multi-angle offer inventory (tier, business model, capability, seasonal, objection).
- Expanded risk register and added measurement/UTM structure.
- Included current build status (gallery, maps, QR, coupons, bot, social commerce) and readiness assumptions.

### 0.4 Reconciliation Decisions

| Decision | Rationale |
|---|---|
| **Keep 27 capability domains** from V0 and layer V1 readiness notes | V0's inventory is exhaustive; V1 confirms many are built |
| **Use V1's 8-category scoring** for consistency | Both reports use 1–5 scoring; V1 names the categories explicitly |
| **Merge loop libraries** rather than choosing one | V0 has more add-on/shopper loops; V1 adds storefront, comparison, and lead-magnet angles |
| **Use V1's surface route names** (`/tenant/[id]`, `/products/[id]`, `/directory/[slug]`) | These are the real code paths; V0 used generic `/features` destinations |
| **Add new `/solutions/*` and `/guides/*` route recommendations** from V1 | Message-matched landing pages are not yet built; they are the highest-priority engineering work |
| **Preserve V0's weekly routine and visual asset list** | Operational scaffolding the V1 revision lacked |
| **Retain V1's CTA-readiness action list and risk register** | These are the blocking issues for launch |

### 0.5 What Changed in This Optimized Version

- New Master Sales Loop Register combines 22 unique loops from both sources, de-duplicated and re-scored.
- Destination column now reflects real route patterns and required optimizations.
- Board architecture expanded from 9 to 12 boards to cover add-on and shopper angles.
- Keyword ladders and angle variations are preserved but cross-referenced to the new loop IDs.
- Top P0/P1 loops are detailed with 5-stage cards; the rest are in the compact register.
- A single 7-day sprint + 90-day calendar unify V0's weekly routine and V1's launch plan.

---

## 1. Executive Summary

Visible Shelf is a local retail visibility and commerce platform with **27 capability domains**, **6 subscription tiers** ($29–$499/mo), a **BSaaS add-on catalog** ($9–$299/mo), and **multiple public-facing surfaces** that can serve as Pinterest destinations. Pinterest is a natural channel because it is a visual planning/search engine, and the platform's outputs — storefront pages, product galleries, QR codes, directory listings, Google Shopping placements — are inherently visual.

**Two loop directions drive the strategy:**

1. **Merchant acquisition loops** — target retailers searching for visibility, e-commerce, and local business solutions. These convert to tier trials and BSaaS add-ons.
2. **Shopper discovery loops** — target consumers searching for local products and gifts. These drive traffic to merchant surfaces and the directory, building marketplace liquidity.

**Highest-confidence first tests:**

1. **Clover POS → online storefront** (uncontested niche, highest intent).
2. **Google visibility for local stores** (direct pain point, agency alternative).
3. **Deposit/BOPIS commerce** (differentiated foot-traffic driver).
4. **Omnichannel payment choice** (strong long-term LTV upgrade narrative).

**Critical blocker before spend:** Several destination surfaces (`/`, `/features`, `/directory/[slug]`) are `'use client'` pages with no `generateMetadata` or `openGraph`. They cannot control Pinterest link previews. The first engineering pass must add server-side metadata, OG images, and UTM/ref capture to these surfaces or build dedicated `/solutions/*` landing pages.

---

## 2. Platform Capability Inventory

### 2.1 The 27 Capability Domains with Readiness

| # | Capability Domain | Pinterest Relevance | Current Readiness | Best Offer Fit |
|---|---|---|---|---|
| 1 | **Commerce** | High — "sell online" | Built — deposit, full payment, flexible | E-commerce / Omnichannel |
| 2 | **Payment Gateway** | Medium — "accept payments" | Built — Stripe, PayPal, Square, Clover | All tiers |
| 3 | **Storefront Type** | High — "online store" | Built — online, retail, service, social, flexible | Storefront+ |
| 4 | **Fulfillment** | High — BOPIS, local delivery | Built — pickup, delivery, shipping | Commitment / Omnichannel |
| 5 | **Product Types** | High — physical vs. digital | Built | All tiers |
| 6 | **Product Options** | High — "product photography" | Built — variants, gallery, video, layout, QR, SEO, reviews | Storefront+ |
| 7 | **Featured Options** | Medium — "sale" badges | Built | E-commerce+ |
| 8 | **Integrations** | High — Google Shopping, POS | Built — Clover, Square, GBP, Google Shopping, GMC | Discovery+ |
| 9 | **Quickstart** | High — "AI for small business" | Built — AI wizard, image generation, category gen | Add-ons |
| 10 | **Storefront Options** | Medium — "storefront design" | Built — categories, recs, social, contact, SEO | Storefront+ |
| 11 | **Storefront QR** | High — "QR code marketing" | Built — styled QR, analytics | Add-on / all tiers |
| 12 | **Storefront Gallery** | High — "product gallery" | Built — carousel + magazine gallery | Add-on / Storefront+ |
| 13 | **Storefront Hours** | Low — business hours display | Built | Trust signal |
| 14 | **Storefront Layouts** | High — "store layout" | Built — classic, editorial, immersive | Storefront+ |
| 15 | **Storefront Maps** | Medium — "local shopping" | Built | Storefront+ |
| 16 | **Directory Entry** | High — local business marketing | Built — 4 layouts, gallery, QR, social, SEO | Storefront+ |
| 17 | **FAQ** | Medium — FAQ page | Built | Trust signal |
| 18 | **CRM** | Medium — CRM for small business | Built | Add-on |
| 19 | **Chatbot** | High — AI customer service | Built — RAG, skills, widget | Add-on |
| 20 | **Barcode Scan** | Low — niche tool | Built | Not a primary Pinterest topic |
| 21 | **Organization Options** | Medium — multi-location | Built | Enterprise |
| 22 | **Social Commerce** | Very High — Instagram Shopping, TikTok Shop | Built — Meta, TikTok, pixels, social proof | Add-on / E-commerce+ |
| 23 | **Directory Promotion** | Medium — directory listing | Built | Add-on / Omnichannel+ |
| 24 | **Wholesale Matching** | High — wholesale sourcing | Built | Add-on |
| 25 | **Platform Services** | Very High — logo, banner, social kit | Built — one-time purchases | Add-on |
| 26 | **Sales Funnels** | High — sales funnel | Built — order bump, upsell, OTO | Add-on / Omnichannel+ |
| 27 | **Coupon Options** | Very High — coupon design, promo code | Built — QR sharing, spotlight, analytics | Add-on / E-commerce+ |

### 2.2 Tier Structure

| Tier | Business Model | Price | Core Pinterest Promise |
|---|---|---|---|
| **Discovery** | Visibility only | $29/mo | Get found on Google without an agency or website |
| **Storefront** | Platform presence | $59/mo | Own a branded storefront in the marketplace |
| **Commitment** | Physical retail | $79/mo | Deposit commerce — drive guaranteed foot traffic |
| **E-commerce** | Online-only | $99/mo | Full e-commerce checkout and fulfillment |
| **Omnichannel** | Physical + online | $149/mo | Shopper chooses deposit/pickup or full payment/delivery |
| **Enterprise** | Multi-location | $499/mo | One dashboard for every location |

### 2.3 BSaaS Add-On Catalog

**Individual features:**
- CRM Assistant Skill — $19/mo
- External Bot Embed — $9/mo
- Order Tracking Skill — $12/mo
- Cross-Merchant Search Skill — $24/mo
- Styled QR Codes — $9/mo (7-day trial)
- Magazine Gallery — $9/mo (7-day trial)
- Platform Services (logo, banner, store setup, SEO, social kit) — one-time

**Bundles:**
- Growth Bundle — $39/mo (32% off, 14-day trial)
- Operations Bundle — $49/mo (29% off, 14-day trial)
- Commerce Power Pack — $69/mo (29% off, 14-day trial)
- Customer Engagement Suite — $79/mo (14-day trial)
- Everything Pack — $299/mo (all 17 flexible toggles)

---

## 3. Pinterest Audiences and Search Language

### 3.1 Primary Audiences (Merchant Acquisition)

| Audience | Pinterest Search Behavior | Pain Point | Offer Fit |
|---|---|---|---|
| **Aspiring online sellers** | "how to sell online," "start an online store" | Overwhelmed by Shopify/BigCommerce | Discovery / Storefront |
| **Google visibility seekers** | "get my store on Google," "Google my business" | Can't afford agency | Discovery |
| **Clover POS users** | "Clover POS apps," "Clover integration" | Want to extend Clover online | Any tier — Clover differentiator |
| **Physical retailers** | "increase foot traffic," "local marketing ideas" | Losing traffic to Amazon/big-box | Commitment |
| **BOPIS/Curbside seekers** | "buy online pick up in store setup" | Need BOPIS without new hardware | Commitment / Omnichannel |
| **E-commerce merchants** | "ecommerce tips," "online checkout" | Visibility and conversion | E-commerce |
| **Omnichannel retailers** | "click and collect," "BOPIS setup" | Need both online and in-store | Omnichannel |
| **Multi-location businesses** | "multi-location business," "chain management" | Complex multi-store ops | Enterprise |
| **Social commerce sellers** | "Instagram shopping," "TikTok shop" | Want social selling | Social Commerce add-on |
| **Wholesale buyers** | "wholesale sourcing," "find suppliers" | Need product sourcing | Wholesale Matching add-on |
| **AI-curious retailers** | "AI for small business," "chatbot for store" | Want AI without complexity | Quickstart + Chatbot add-ons |

### 3.2 Secondary Audiences (Shopper Discovery)

| Audience | Pinterest Search Behavior | Destination | Goal |
|---|---|---|---|
| **Local product seekers** | "find local gifts," "shop local [city]" | `/directory` or `/directory/[slug]` | Marketplace traffic |
| **Product researchers** | "best [product category]" | `/products/[id]` | Product discovery |
| **Deal hunters** | "coupon codes," "discount shopping" | Merchant storefront with coupon spotlight | Redemption |
| **Visual browsers** | "product photography inspiration" | `/catalog` or `/directory/categories` | Engagement |
| **Seasonal shoppers** | "holiday gift guide 2026" | `/directory/categories` with seasonal badges | Seasonal traffic |

### 3.3 Buyer-Intent Cues

| Cue | Example | Interpretation |
|---|---|---|
| Format words | printable, template, checklist, guide | Wants a quick, actionable resource |
| Problem words | without, stop, fix, struggling | Actively searching for relief |
| Result words | get found, more customers, sales | Wants a measurable outcome |
| Tool words | software, app, system, platform | Comparing solutions |
| Business-model words | online, local, boutique, retail | Identifies with a vertical |

---

## 4. Public-Facing Surfaces and Destination Readiness

### 4.1 Surface Inventory

| Route | Surface Type | Metadata / OG State | CTA Readiness | Best Pinterest Use |
|---|---|---|---|---|
| `/` (`/(platform)/page.tsx`) | Home / dashboard hybrid | `'use client'`, no `generateMetadata` | **Low** | Not recommended until split |
| `/features` | Feature showcase | `'use client'`, no `generateMetadata` | **Low** | Capability Pins after metadata pass |
| `/tenant/[id]` | Public merchant storefront | `generateMetadata` + `openGraph` + schema.org | **High** | Shop/store-level Pins |
| `/products/[id]` | Public product detail | `generateMetadata` + `openGraph` (product images) | **High** | Product / shoppable Pins |
| `/directory/[slug]` | Directory store listing | `'use client'`, no `generateMetadata` | **Low** | Directory discovery after metadata pass |
| `/directory`, `/directory/stores`, `/directory/categories` | Directory browse | Likely `'use client'`, no OG | **Low** | Category/seasonal boards |
| `/checkout`, `/cart/[tenantId]` | Transactional | n/a | **Not a landing page** | Never use as CTA destination |
| `/auth/signup`, `/auth/signin` | Authentication | Minimal metadata | **Medium** | Only as hard conversion step |

### 4.2 Optimization Required Before Traffic

1. **Platform home (`/`):** Split marketing and authenticated dashboard. Add `generateMetadata`, hero OG image, sticky mobile CTA, UTM params.
2. **Feature showcase (`/features`):** Convert to server component or add `generateMetadata` from layout. Add per-feature anchor links, OG per section, and section-level trial CTAs.
3. **Merchant storefront (`/tenant/[id]`):** Generate 2:3 Pinterest OG hero (banner + logo), add `?ref=pinterest`, Pin It buttons, mobile-visible primary CTA.
4. **Product page (`/products/[id]`):** Ensure first OG image is primary product image; add `og:type=product`, price, availability; add Pinterest Save button.
5. **Directory listing (`/directory/[slug]`):** Add `generateMetadata` with business name, city, description, OG image, `LocalBusiness` schema.
6. **Directory indexes:** Add category-level metadata and OG images.
7. **New landing routes:** Build `/solutions/google-visibility`, `/solutions/deposit-commerce`, `/solutions/omnichannel`, `/guides/google-visibility-checklist`, `/compare/clover-vs-shopify`.

---

## 5. Offer Inventory: Multi-Angle

### 5.1 Tier-Based Offer Ladder

| Pinterest Board | Offer Promise | Lead Destination | CTA |
|---|---|---|---|
| **Get Found on Google** | $29/mo Discovery | `/solutions/google-visibility` | Start 14-day free trial — get on Google |
| **Build Your Platform Storefront** | $59/mo Storefront | `/features#storefront` or `/examples` | Start free trial — own your page |
| **Drive Foot Traffic with Deposits** | $79/mo Commitment | `/solutions/deposit-commerce` | Start free trial — reserve and pickup |
| **Sell Online Fully** | $99/mo E-commerce | `/solutions/ecommerce` | Start free trial — full checkout |
| **One Store, Every Way to Buy** | $149/mo Omnichannel | `/solutions/omnichannel` | Start free trial — unified commerce |
| **Scale Multi-Location Retail** | $499/mo Enterprise | `/enterprise` | Book a demo |

### 5.2 Business-Model Angles

| Merchant Type | Offer Promise | Pinterest Framing |
|---|---|---|
| Physical retailers | "Turn browsers into guaranteed foot traffic" | Deposit commerce / BOPIS / reservation |
| Online-only retailers | "A complete checkout without the enterprise price" | E-commerce / shipping / coupons |
| Hybrid retailers | "Let customers choose pay-in-full or reserve-and-pickup" | Omnichannel / QR / gallery |
| Chains / franchises | "One dashboard for every location" | Enterprise multi-location |

### 5.3 Capability & Add-On Angles

| Capability | Pinterest Hook | Offer |
|---|---|---|
| Clover POS to Google | "If you use Clover, your products can already be on Google" | Discovery+ |
| Branded QR codes | "One QR code for shelf, window, and Instagram" | Styled QR add-on |
| AI chatbot | "AI that knows your real inventory" | Chatbot add-on |
| AI product photos | "Generate professional product photos without a studio" | Quickstart add-on |
| Instagram Shopping sync | "Sync your catalog to Instagram & Facebook automatically" | Social Commerce add-on |
| TikTok Shop sync | "List products on TikTok Shop from your POS" | Social Commerce add-on |
| Coupon spotlight | "Run a sale shoppers can copy from your storefront" | Coupon add-on / E-commerce+ |
| Sales funnels | "Post-purchase upsells without coding" | Funnel add-on / Omnichannel+ |
| Wholesale matching | "Find suppliers across Faire from your dashboard" | Wholesale add-on |
| Platform services | "Professional logo, banner & social kit for your store" | One-time service |

### 5.4 Seasonal Angles

| Season | Angle | Tie-In |
|---|---|---|
| January | "New year, new revenue channels" | Discovery + Storefront |
| Q1 | "Get inventory online before spring rush" | Clover + Google |
| Spring markets | "Turn weekend shoppers into year-round customers" | Commitment / Storefront |
| Back-to-school | "Make your store the local go-to" | Directory promotion + coupons |
| Q4 holiday | "Capture intent before shoppers buy elsewhere" | Commitment + Omnichannel |
| Post-holiday | "Convert seasonal browsers with deposits" | Commitment |

---

## 6. Keyword Ladder Library

### 6.1 Ladder: Sell Online

| Step | Keyword | Intent |
|---|---|---|
| 1 | sell online | Broad inspiration |
| 2 | how to sell online | Research |
| 3 | how to sell online for beginners | Audience-specific |
| 4 | start an online store without coding | Problem-specific |
| 5 | online store with Clover POS integration | Product-specific |
| 6 | Clover POS online storefront setup | Action-oriented |

### 6.2 Ladder: Local Retail Marketing

| Step | Keyword | Intent |
|---|---|---|
| 1 | local retail marketing | Broad |
| 2 | increase foot traffic to retail store | Problem-specific |
| 3 | drive foot traffic with online reservations | Solution-specific |
| 4 | deposit-based commerce for local stores | Product-specific |
| 5 | BOPIS setup with Clover POS | Action-oriented |

### 6.3 Ladder: Google Visibility

| Step | Keyword | Intent |
|---|---|---|
| 1 | Google my business | Broad |
| 2 | get my store on Google | Problem-specific |
| 3 | get products on Google Shopping | Solution-specific |
| 4 | Google Shopping without merchant center setup | Product-specific |
| 5 | automatic Google Shopping sync from POS | Action-oriented |

### 6.4 Ladder: AI for Retail

| Step | Keyword | Intent |
|---|---|---|
| 1 | AI for small business | Broad |
| 2 | AI chatbot for retail store | Audience-specific |
| 3 | AI chatbot with real inventory access | Product-specific |
| 4 | AI product photography for online store | Format-specific |
| 5 | AI product photo generator with HD output | Action-oriented |

### 6.5 Ladder: Social Commerce

| Step | Keyword | Intent |
|---|---|---|
| 1 | social commerce | Broad |
| 2 | Instagram shopping for small business | Platform-specific |
| 3 | auto sync products to Instagram shopping | Solution-specific |
| 4 | TikTok shop catalog sync from POS | Action-oriented |
| 5 | social proof display for online store | Feature-specific |

### 6.6 Ladder: QR Code Marketing

| Step | Keyword | Intent |
|---|---|---|
| 1 | QR code marketing | Broad |
| 2 | branded QR code with logo | Feature-specific |
| 3 | styled QR code with custom colors | Design-specific |
| 4 | QR code analytics for small business | Analytics-specific |
| 5 | QR code coupon for retail store | Use-case-specific |

### 6.7 Ladder: Coupon Strategy

| Step | Keyword | Intent |
|---|---|---|
| 1 | coupon marketing | Broad |
| 2 | digital coupon for small business | Format-specific |
| 3 | QR shareable coupon code | Feature-specific |
| 4 | coupon redemption analytics dashboard | Analytics-specific |
| 5 | BOGO coupon with online redemption | Use-case-specific |

### 6.8 Ladder: Sales Funnel

| Step | Keyword | Intent |
|---|---|---|
| 1 | sales funnel | Broad |
| 2 | sales funnel for ecommerce | Audience-specific |
| 3 | post-purchase upsell funnel | Strategy-specific |
| 4 | order bump checkout examples | Feature-specific |
| 5 | one-time offer countdown timer | Tactic-specific |

### 6.9 Ladder: Wholesale Sourcing

| Step | Keyword | Intent |
|---|---|---|
| 1 | wholesale suppliers | Broad |
| 2 | find wholesale suppliers for retail | Audience-specific |
| 3 | wholesale product matching tool | Solution-specific |
| 4 | Faire marketplace alternative sourcing | Platform-specific |
| 5 | supplier affiliate link builder | Feature-specific |

### 6.10 Ladder: Shop Local

| Step | Keyword | Intent |
|---|---|---|
| 1 | shop local | Broad inspiration |
| 2 | unique gifts from local shops | Format-specific |
| 3 | local retailer marketplace | Platform-specific |
| 4 | shop local gift guide 2026 | Seasonal-specific |
| 5 | find local products online | Action-oriented |

---

## 7. Pin Angle Variations

### 7.1 Phrase: "how to sell online for beginners"

| Angle Type | Pin Headline |
|---|---|
| Educational | The 5 Steps Every Beginner Needs to Start Selling Online |
| Quick-start | Launch Your Online Store in 14 Days — No Coding Required |
| Problem-solving | Stop Paying for Shopify Before You've Read This |
| Comparison | Visible Shelf vs. Shopify: Which Is Right for Your Local Store? |

### 7.2 Phrase: "increase foot traffic to retail store"

| Angle Type | Pin Headline |
|---|---|
| Educational | Why Online Reservations Drive 3x More Foot Traffic Than Social Posts |
| Quick-start | Let Shoppers Reserve Products Online in Under 10 Minutes |
| Problem-solving | Stop Losing Foot Traffic to Amazon — How Local Stores Fight Back |
| Comparison | Deposit Commerce vs. Click & Collect: Which Drives More In-Store Visits? |

### 7.3 Phrase: "AI chatbot for small business"

| Angle Type | Pin Headline |
|---|---|
| Educational | How an AI Assistant That Knows Your Inventory Converts More Shoppers |
| Quick-start | Add an AI Shopping Assistant to Your Store in 5 Minutes |
| Problem-solving | Stop Answering the Same 10 Customer Questions — Let AI Handle It |
| Comparison | AI Chatbot vs. FAQ Page: Which Reduces More Customer Service Tickets? |

### 7.4 Phrase: "QR code marketing ideas for small business"

| Angle Type | Pin Headline |
|---|---|
| Educational | 7 Ways Local Retailers Use Branded QR Codes to Drive Sales |
| Quick-start | Design Your First Branded QR Code in 3 Minutes — Free Trial |
| Problem-solving | Stop Using Generic QR Codes — Here's Why Branded QR Gets 3x More Scans |
| Comparison | Static QR vs. Dynamic QR Analytics: Which Is Right for Your Store? |

### 7.5 Phrase: "coupon marketing strategy for small business"

| Angle Type | Pin Headline |
|---|---|
| Educational | The 5 Coupon Types Every Local Retailer Should Offer Online |
| Quick-start | Create Your First Digital Coupon in 5 Minutes — With QR Sharing Built In |
| Problem-solving | Stop Losing Sales to Expired Coupons — Here's How Digital Redemption Works |
| Comparison | Paper Coupons vs. QR Digital Coupons: Cost, Reach & Redemption Rates |

---

## 8. Master Sales Loop Register

All unique loops from V0 and V1 merged, de-duplicated, and ranked by score.

| ID | Loop Name | Search Phrase | Destination | Offer | Score | Priority |
|---|---|---|---|---|---|---|
| **P-01** | Clover POS Storefront | Clover POS apps and integrations | `/solutions/clover-storefront` | Storefront ($59) | 38/40 | **P0** |
| **P-02** | Google Visibility Seeker | how to get my store on Google | `/solutions/google-visibility` | Discovery ($29) | 37/40 | **P0** |
| **P-03** | Deposit / BOPIS Commerce | take deposits online for local pickup | `/solutions/deposit-commerce` | Commitment ($79) | 38/40 | **P0** |
| **P-04** | Omnichannel Choice | omnichannel retail small business | `/solutions/omnichannel` | Omnichannel ($149) | 37/40 | **P0** |
| **P-05** | Instagram Shopping Sync | how to set up Instagram shopping | `/features#social-commerce` | Social Commerce add-on | 35/40 | **P1** |
| **P-06** | QR Code Marketing | QR code marketing ideas for small business | `/features#qr` | Styled QR add-on | 35/40 | **P1** |
| **P-07** | Coupon Strategy | coupon marketing strategy for small business | `/features#coupons` | Coupon add-on | 35/40 | **P1** |
| **P-08** | Seasonal Shopper | holiday gift guide 2026 | `/directory/categories` | Marketplace traffic | 35/40 | **P1 (seasonal)** |
| **P-09** | BOPIS Setup | buy online pick up in store setup | `/solutions/deposit-commerce` | Commitment / Omnichannel | 34/40 | **P1** |
| **P-10** | TikTok Shop Sync | TikTok shop for small business | `/features#social-commerce` | Social Commerce add-on | 34/40 | **P1** |
| **P-11** | Wholesale Sourcing | how to find wholesale suppliers for retail store | `/features#wholesale` | Wholesale add-on | 34/40 | **P1** |
| **P-12** | Logo / Brand Kit | small business logo design ideas | `/features#platform-services` | Platform Services one-time | 34/40 | **P1** |
| **P-13** | E-commerce Clean Checkout | easy online store for small business | `/solutions/ecommerce` | E-commerce ($99) | 34/40 | **P1** |
| **P-14** | Multi-Location Retail | managing multiple retail locations | `/enterprise` | Enterprise ($499) | 34/40 | **P2** |
| **P-15** | AI Chatbot | AI chatbot for small business | `/features#chatbot` | Chatbot add-on | 33/40 | **P2** |
| **P-16** | AI Product Photography | AI product photography tools | `/features#ai-photos` | Quickstart add-on | 33/40 | **P2** |
| **P-17** | Local Gift Seeker | unique gifts from local shops | `/directory` | Marketplace traffic | 33/40 | **P2** |
| **P-18** | Storefront Examples | small business storefront page examples | `/examples` | Storefront ($59) | 33/40 | **P2** |
| **P-19** | Sales Funnel Builder | sales funnel for ecommerce | `/features#funnels` | Funnel add-on | 32/40 | **P2** |
| **P-20** | Aspiring Online Seller | how to sell online for beginners | `/features` | Discovery ($29) | 32/40 | **P2** |
| **P-21** | Why Not on Google? | why are my products not showing on Google | `/guides/google-visibility-checklist` | Discovery ($29) | 35/40 | **P1** |
| **P-22** | Do I Need Shopify? | do I need Shopify for a small business | `/compare/clover-vs-shopify` | E-commerce / Omnichannel | 32/40 | **P2** |

---

## 9. Top Priority Loops — Detailed 5-Stage Cards

### P-01: Clover POS Storefront

| Stage | Detail |
|---|---|
| **Search phrase** | Clover POS apps and integrations |
| **Pin angle** | Turn Your Clover POS Into a Full Online Storefront in 14 Days |
| **Click reason** | See how Clover data powers an online presence without manual sync |
| **Destination** | `/solutions/clover-storefront` — real route or new landing |
| **Offer** | Storefront tier ($59/mo) — 14-day free trial |
| **CTA** | Connect your Clover account — start free trial |

| Score category | Score | Reason |
|---|---|---|
| Keyword relevance | 5 | Exact Clover POS match |
| Buyer intent | 5 | High commercial intent |
| Visual potential | 5 | Split-screen Clover → storefront |
| Destination match | 5 | Dedicated landing with sync demo |
| Offer match | 5 | Storefront tier directly enables |
| CTA clarity | 5 | Single action |
| Seasonal timing | 3 | Evergreen |
| Opportunity | 5 | Uncontested niche |
| **Total** | **38/40** | P0 — immediate test |

### P-02: Google Visibility Seeker

| Stage | Detail |
|---|---|
| **Search phrase** | how to get my store on Google |
| **Pin angle** | Get Your Local Store on Google Search, Shopping & Maps — Without Hiring an Agency |
| **Click reason** | Learn a DIY path to Google visibility |
| **Destination** | `/solutions/google-visibility` |
| **Offer** | Discovery tier ($29/mo) — 14-day free trial |
| **CTA** | Get found on Google — start free trial |

| Score category | Score | Reason |
|---|---|---|
| Keyword relevance | 5 | Direct pain-point match |
| Buyer intent | 4 | Strong research intent |
| Visual potential | 4 | Google search mockups |
| Destination match | 5 | Landing page matches promise |
| Offer match | 5 | Discovery tier is the fit |
| CTA clarity | 5 | Direct |
| Seasonal timing | 4 | Evergreen; pre-season peaks |
| Opportunity | 5 | Agency alternative narrative |
| **Total** | **37/40** | P0 — immediate test |

### P-03: Deposit / BOPIS Commerce

| Stage | Detail |
|---|---|
| **Search phrase** | take deposits online for local pickup |
| **Pin angle** | Stop Losing Sales to "I'll Come Back Later" — Take a Deposit Now |
| **Click reason** | Learn how to hold inventory with a commitment fee |
| **Destination** | `/solutions/deposit-commerce` |
| **Offer** | Commitment tier ($79/mo) — 14-day free trial |
| **CTA** | Start free trial — reserve and drive foot traffic |

| Score category | Score | Reason |
|---|---|---|
| Keyword relevance | 5 | Direct product feature match |
| Buyer intent | 5 | High commercial intent |
| Visual potential | 4 | Flowchart/screenshot |
| Destination match | 5 | Tutorial leads to tier |
| Offer match | 5 | Commitment tier directly enables |
| CTA clarity | 5 | Single action |
| Seasonal timing | 4 | Strong pre-holiday |
| Opportunity | 5 | Very few competitors explain this |
| **Total** | **38/40** | P0 — immediate test |

### P-04: Omnichannel Choice

| Stage | Detail |
|---|---|
| **Search phrase** | omnichannel retail small business |
| **Pin angle** | Let Your Customers Choose: Pay in Full or Reserve for Pickup |
| **Click reason** | See one inventory supporting two checkout paths |
| **Destination** | `/solutions/omnichannel` |
| **Offer** | Omnichannel tier ($149/mo) — 14-day free trial |
| **CTA** | Start free trial — one inventory, every way to buy |

| Score category | Score | Reason |
|---|---|---|
| Keyword relevance | 5 | Exact capability match |
| Buyer intent | 5 | Actively seeking omnichannel |
| Visual potential | 4 | Split-path UI mockup |
| Destination match | 5 | Page shows both paths |
| Offer match | 5 | Omnichannel tier only match |
| CTA clarity | 5 | Clear value |
| Seasonal timing | 3 | Advanced audience |
| Opportunity | 5 | Underserved segment |
| **Total** | **37/40** | P0 — immediate test |

### P-05: Instagram Shopping Sync

| Stage | Detail |
|---|---|
| **Search phrase** | how to set up Instagram shopping |
| **Pin angle** | Sync Your Product Catalog to Instagram & Facebook Automatically — No Manual Updates |
| **Click reason** | Learn how platform integration keeps social catalogs in sync |
| **Destination** | `/features#social-commerce` |
| **Offer** | Social Commerce add-on + any commerce tier |
| **CTA** | Connect your store to Instagram — start free trial |

| Score category | Score | Reason |
|---|---|---|
| Keyword relevance | 5 | Exact topic |
| Buyer intent | 5 | High commercial intent |
| Visual potential | 5 | Instagram Shopping screenshot |
| Destination match | 4 | Feature page after metadata pass |
| Offer match | 4 | Add-on + tier |
| CTA clarity | 5 | Direct |
| Seasonal timing | 3 | Evergreen |
| Opportunity | 4 | Competitive but differentiated |
| **Total** | **35/40** | P1 — Week 2 |

### P-06: QR Code Marketing

| Stage | Detail |
|---|---|
| **Search phrase** | QR code marketing ideas for small business |
| **Pin angle** | Create Branded QR Codes With Your Store Logo — Track Every Scan |
| **Click reason** | See styled QR examples and use cases |
| **Destination** | `/features#qr` |
| **Offer** | Styled QR add-on ($9/mo, 7-day trial) |
| **CTA** | Design your branded QR code — start trial |

| Score category | Score | Reason |
|---|---|---|
| Keyword relevance | 4 | Strong feature match |
| Buyer intent | 3 | Inspiration phase |
| Visual potential | 5 | QR grids are Pinnable |
| Destination match | 4 | Feature page |
| Offer match | 5 | Add-on fits |
| CTA clarity | 5 | Direct |
| Seasonal timing | 4 | Evergreen |
| Opportunity | 4 | Low competition |
| **Total** | **35/40** | P1 — Week 2 |

### P-07: Coupon Strategy

| Stage | Detail |
|---|---|
| **Search phrase** | coupon marketing strategy for small business |
| **Pin angle** | Create Digital Coupons Your Customers Can Scan, Share & Redeem at Checkout |
| **Click reason** | See QR-shareable coupons in action |
| **Destination** | `/features#coupons` |
| **Offer** | Coupon Options add-on + any commerce tier |
| **CTA** | Create your first digital coupon — start trial |

| Score category | Score | Reason |
|---|---|---|
| Keyword relevance | 4 | Strong match |
| Buyer intent | 4 | Wants coupon tool |
| Visual potential | 5 | Coupon card mockups |
| Destination match | 4 | Feature page |
| Offer match | 5 | Add-on + tier |
| CTA clarity | 5 | Direct |
| Seasonal timing | 5 | Peaks pre-holiday |
| Opportunity | 4 | Less clutter than broad e-commerce |
| **Total** | **35/40** | P1 — Week 2 |

### P-08: Seasonal Shopper

| Stage | Detail |
|---|---|
| **Search phrase** | holiday gift guide 2026 |
| **Pin angle** | Holiday Gift Guide: Unique Finds from Local Retailers You Won't See on Amazon |
| **Click reason** | Discover gift ideas with real-time local availability |
| **Destination** | `/directory/categories` with seasonal filters |
| **Offer** | Marketplace traffic / no direct offer |
| **CTA** | Explore holiday gifts from local stores |

| Score category | Score | Reason |
|---|---|---|
| Keyword relevance | 5 | Seasonal exact match |
| Buyer intent | 4 | Strong seasonal intent |
| Visual potential | 5 | Festive collage |
| Destination match | 5 | Category page |
| Offer match | 3 | No direct sale |
| CTA clarity | 4 | Soft |
| Seasonal timing | 5 | Publish October |
| Opportunity | 4 | Strong shopper traffic |
| **Total** | **35/40** | P1 — Seasonal |

### P-09: BOPIS Setup

| Stage | Detail |
|---|---|
| **Search phrase** | buy online pick up in store setup |
| **Pin angle** | Set Up BOPIS for Your Local Store Without Changing Your POS System |
| **Click reason** | See how Clover integration enables BOPIS |
| **Destination** | `/solutions/deposit-commerce` |
| **Offer** | Commitment ($79) or Omnichannel ($149) |
| **CTA** | See how BOPIS works with your Clover POS |

| Score category | Score | Reason |
|---|---|---|
| Keyword relevance | 5 | Direct BOPIS match |
| Buyer intent | 5 | High intent |
| Visual potential | 4 | 3-step flow |
| Destination match | 4 | Shared with deposit loop |
| Offer match | 5 | Tier fit |
| CTA clarity | 4 | Soft-ish |
| Seasonal timing | 3 | Evergreen |
| Opportunity | 4 | Growing trend |
| **Total** | **34/40** | P1 — Week 2 |

### P-10: Why Not on Google?

| Stage | Detail |
|---|---|
| **Search phrase** | why are my products not showing on Google |
| **Pin angle** | The 3 Reasons Local Products Never Show Up on Google |
| **Click reason** | Diagnose their own problem |
| **Destination** | `/guides/google-visibility-checklist` lead magnet |
| **Offer** | Discovery tier ($29) — 14-day free trial (gated) |
| **CTA** | Download the guide + start free trial |

| Score category | Score | Reason |
|---|---|---|
| Keyword relevance | 5 | Strong pain-point match |
| Buyer intent | 4 | Problem-aware |
| Visual potential | 4 | Checklist graphic |
| Destination match | 5 | Guide matches search |
| Offer match | 4 | Discovery tier answer |
| CTA clarity | 4 | Two CTAs |
| Seasonal timing | 4 | Evergreen |
| Opportunity | 5 | Emotional, high-search |
| **Total** | **35/40** | P1 — immediate test |

---

## 10. Pinterest Board Architecture

| Board Name | Audience | Pins Target | Content Mix | Cadence |
|---|---|---:|---|---|
| **Get Found on Google** | Small retailers | 30+ | Google visibility, SEO, SWIS, GBP | 3 Pins/week |
| **Local Retail Growth** | Physical retailers | 30+ | Foot traffic, BOPIS, deposit commerce | 3 Pins/week |
| **Sell Online Successfully** | Aspiring online sellers | 30+ | E-commerce setup, checkout, Google visibility | 3 Pins/week |
| **Clover POS Power Tips** | Clover users | 15+ | Clover sync, POS-to-online, BOPIS | 2 Pins/week |
| **Omnichannel Retail** | Hybrid retailers | 20+ | Deposit vs. full payment, shopper choice | 2 Pins/week |
| **AI for Retail** | AI-curious retailers | 20+ | Chatbot, AI product photos, automation | 2 Pins/week |
| **Social Commerce for Retail** | Social sellers | 25+ | Instagram Shopping, TikTok Shop, pixels | 2 Pins/week |
| **QR Code Marketing** | Marketing explorers | 15+ | QR design, analytics, coupons | 2 Pins/week |
| **Coupon & Promo Strategy** | Deal-focused merchants | 20+ | Coupon design, BOGO, QR redemption | 2 Pins/week |
| **Retail Sales Funnels** | E-commerce merchants | 15+ | Order bumps, upsells, one-time offers | 2 Pins/week |
| **Wholesale & Sourcing** | Retail buyers | 15+ | Supplier finding, Faire, wholesale matching | 2 Pins/week |
| **Small Business Branding** | New merchants | 20+ | Logo, banner, social kit, store setup | 2 Pins/week |
| **Shop Local Gift Guides** | Shoppers | 20+ (seasonal) | Holiday guides, local product spotlights | Seasonal (Oct–Dec) |
| **Multi-Location Retail** | Chain/franchise owners | 10+ | Multi-location dashboard, franchise | 1 Pin/week |

---

## 11. Loop Priority Ranking & Pacing

| Rank | Loop | Score | Priority | Launch Window |
|---|---|---:|---|---|
| 1 | P-01 Clover POS Storefront | 38/40 | P0 — Immediate | Week 1 |
| 2 | P-03 Deposit / BOPIS Commerce | 38/40 | P0 — Immediate | Week 1 |
| 3 | P-02 Google Visibility Seeker | 37/40 | P0 — Immediate | Week 1 |
| 4 | P-04 Omnichannel Choice | 37/40 | P0 — Immediate | Week 1 |
| 5 | P-05 Instagram Shopping Sync | 35/40 | P1 — Week 2 | Week 2 |
| 6 | P-06 QR Code Marketing | 35/40 | P1 — Week 2 | Week 2 |
| 7 | P-07 Coupon Strategy | 35/40 | P1 — Week 2 | Week 2 |
| 8 | P-08 Seasonal Shopper | 35/40 | P1 — Seasonal | October |
| 9 | P-10 Why Not on Google? | 35/40 | P1 — Week 2 | Week 2 |
| 10 | P-09 BOPIS Setup | 34/40 | P1 — Week 2 | Week 2 |
| 11 | P-13 E-commerce Clean Checkout | 34/40 | P1 — Week 3 | Week 3 |
| 12 | P-11 Wholesale Sourcing | 34/40 | P1 — Week 3 | Week 3 |
| 13 | P-12 Logo / Brand Kit | 34/40 | P1 — Week 3 | Week 3 |
| 14 | P-14 Multi-Location Retail | 34/40 | P2 — Week 4 | Week 4 |
| 15 | P-15 AI Chatbot | 33/40 | P2 — Week 4 | Week 4 |
| 16 | P-16 AI Product Photography | 33/40 | P2 — Week 4 | Week 4 |
| 17 | P-17 Local Gift Seeker | 33/40 | P2 — Ongoing | Ongoing |
| 18 | P-18 Storefront Examples | 33/40 | P2 — Week 4 | Week 4 |
| 19 | P-19 Sales Funnel Builder | 32/40 | P2 — Week 4 | Week 4 |
| 20 | P-20 Aspiring Online Seller | 32/40 | P2 — Week 4 | Week 4 |
| 21 | P-22 Do I Need Shopify? | 32/40 | P2 — Week 4 | Week 4 |

---

## 12. Weekly Research Routine

| Day | Task | Output |
|---|---|---|
| **Monday** | Select one offer + 3 seed keywords | Offer foundation + seed list |
| **Tuesday** | Search Pinterest, build 3 keyword ladders | 3 completed ladders |
| **Wednesday** | Study 6 Pinterest result pages (often/weak/missing) | 6 observation sheets |
| **Thursday** | Create 6+ Pin angles from strongest ladder steps | 6 Pin angle concepts |
| **Friday** | Match each angle to destination, offer, and CTA | 6 complete sales loops |
| **Saturday** | Score all loops, repair weakest categories | Scored loops + repair notes |
| **Sunday** | Select 2 loops for production, schedule review | 2 Pins ready for design |

**Monthly output target:** 8 completed loops, 8 Pins published, 4 boards active.

---

## 13. 7-Day Launch Sprint

| Day | Action | Deliverable |
|---|---|---|
| **Day 1** | Define offer foundations and choose P0 seeds | Lock in P-01, P-02, P-03, P-04 and seed keywords |
| **Day 2** | Search Pinterest and build 3 keyword ladders per P0 loop | 12 keyword ladders |
| **Day 3** | Study 6 Pinterest result pages using observation method | 6 observation grids |
| **Day 4** | Create at least 6 Pin angles per P0 loop | 24 Pin concepts |
| **Day 5** | Match each angle to destination, offer, and CTA | 24 completed sales-loop cards |
| **Day 6** | Score loops and repair weak areas | Re-scored P0 loops |
| **Day 7** | Choose 6 loops for testing and schedule review | Publish first 6 Pins; set 4-week review date |

### First 6 Pins to Test

1. **P-03** — "Stop losing sales to 'I'll come back later' — take a deposit now" (Commitment)
2. **P-01** — "Turn your Clover POS into a full online storefront in 14 days" (Storefront)
3. **P-02** — "Get your local store on Google without hiring an agency" (Discovery)
4. **P-04** — "Let customers choose: pay in full or reserve for pickup" (Omnichannel)
5. **P-10** — "The 3 reasons local products never show up on Google" (Lead magnet)
6. **P-06** — "Create branded QR codes with your store logo — track every scan" (QR add-on)

---

## 14. Measurement & Iteration Framework

Track loop performance at every stage, not just impressions.

| Metric | What It Tells You | Tool |
|---|---|---|
| Impressions | Search visibility | Pinterest Analytics |
| Closeup rate | Pin creative relevance | Pinterest Analytics |
| Outbound clicks | Click reason is compelling | Pinterest Analytics + UTM |
| Landing page visits | Message match is working | GA / Plausible |
| Trial starts | Offer matches intent | Visible Shelf signup analytics |
| Trial-to-paid conversion | Tier value is clear | Stripe / subscription analytics |
| Upgrade rate | Tier progression model holds | Subscription analytics |

### UTM Structure

```
?utm_source=pinterest&utm_medium=social&utm_campaign=pintraffix-{phase}
&utm_content={loop_id}-{pin_angle}-{board_name}
&utm_term={search_phrase}
```

Example:
```
?utm_source=pinterest&utm_medium=social&utm_campaign=pintraffix-p0
&utm_content=p-03-deposit-foot-traffic&utm_term=reserve-online-pick-up-in-store
```

---

## 15. Validation Plan

1. **Pinterest Trends check** — Search each seed keyword to confirm volume and seasonality.
2. **Results page audit** — Study top 20 results for each target phrase; record often/weak/missing.
3. **Small test publish** — Publish 2 Pins per loop, record dates and destinations, review after 14 days.
4. **Analytics review** — Compare outbound clicks, saves, and trial signups across loops.
5. **Double down or revise** — Top-performing loops get 4 additional Pin angles; weak loops get revised or archived.

**First review date:** 14 days after first Pin publication.  
**Monthly review:** First Monday of each month.

---

## 16. Risk Register and Readiness Notes

| Risk | Mitigation | Owner |
|---|---|---|
| Landing pages are not tier-specific and lack metadata | Build dedicated `/solutions/*` routes or metadata pass on `/features` before spend | Marketing + Engineering |
| Pinterest creative assets do not exist | Schedule screenshot/mockup sprint using visual asset list | Design |
| Trial onboarding does not match Pinterest promise | Map each tier's first-run experience to the Pin's promise | Product |
| Tracking UTM + trial attribution is missing | Implement UTM/ref capture at signup and Pin ID storage | Engineering |
| Destination surfaces have no OG/preview control | Add `generateMetadata` and OG images to `/`, `/features`, `/directory/*` | Engineering |
| Competitive keywords (e-commerce) are expensive | Focus first on differentiated angles: Clover sync, deposit commerce, omnichannel | Marketing |
| Pinterest audience size for B2B/SaaS is limited | Layer in LinkedIn/Instagram later; use Pinterest as testbed | Marketing |
| Shopper discovery loops do not directly convert | Treat as marketplace liquidity; track merchant signups from organic sharing | Product |

---

## 17. Visual Asset Requirements

| Asset Type | Quantity | Purpose |
|---|---|---|
| Before/after product photos | 10 | AI photography, product gallery loops |
| Chatbot conversation screenshots | 5 | AI chatbot loops |
| Styled QR code grids | 5 | QR marketing loops |
| Coupon card mockups | 5 | Coupon strategy loops |
| Funnel diagrams | 3 | Sales funnel loops |
| Clover + storefront split screens | 5 | Clover integration loops |
| Google search result mockups | 3 | Google visibility loops |
| Instagram/TikTok Shop screenshots | 5 | Social commerce loops |
| Multi-location map visuals | 2 | Enterprise loops |
| Holiday gift guide collages | 5 | Seasonal shopper loops |
| Platform directory product grids | 5 | Shopper discovery loops |
| Logo/branding kit collages | 3 | Platform Services loops |

**Total: ~57 visual assets needed for initial Pin production.**

---

## 18. Common Mistakes to Avoid

| Mistake | How We Avoid It |
|---|---|
| Choosing phrases only because they're popular | Score offer match and destination match, not just keyword volume |
| Copying visible Pin language | Study result pages for patterns, then create original value and visuals |
| Sending users to generic homepages | Every loop targets a specific `/solutions/*`, `/features` anchor, or `/directory` page |
| Using vague CTAs | Every loop has a specific CTA: "Start free trial," "Connect your Clover," "Design your QR code" |
| Ignoring seasonal timing | P-08 (Seasonal Shopper) is scheduled for October publication |
| Tracking only impressions | Track clicks, destination visits, trial signups, and tier conversions |

---

## 19. Final Recommendation

**Do not lead with the product. Lead with the business outcome that matches the searcher's current reality.**

The V2 tier model already segments by business model, which makes Pinterest the ideal channel. The highest-confidence first tests are:

1. **Clover POS → online storefront (P-01)** — the most uncontested, highest-intent angle.
2. **Deposit / BOPIS commerce (P-03)** — the most differentiated, highest-scoring angle.
3. **Google visibility for local stores (P-02)** — the most accessible, lowest-friction entry point.
4. **Omnichannel payment choice (P-04)** — the strongest long-term LTV upgrade narrative.

Before any paid spend, complete the destination-readiness work: split `/`, add `generateMetadata` to `/features` and `/directory/*`, and build the four `/solutions/*` landing pages. Once those surfaces are message-matched and trackable, run the 7-day P0 sprint, review after 14 days, and scale the winning loops with the weekly research routine.

---

*End of optimized analysis. Next steps: (1) build destination routes and metadata, (2) produce the first 6 Pins, (3) schedule the 4-week review.*
