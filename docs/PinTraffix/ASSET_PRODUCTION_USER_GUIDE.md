# PinTraffix Asset Production User Guide

## Comprehensive Step-by-Step Guide for Each Loop Pipeline

**Sources:** Pinterest Offer Analysis (Optimized), Sprint Plan, Asset Manifest, UTM/CRM Retrofit
**Date:** 2026-07-24

---

## 1. How to Use This Guide

Each loop section contains: loop summary, visual assets required (with filenames/dimensions), Pin copy, UTM destination URL, destination readiness requirements, and a production checklist.

**Priority tiers:** P0 (Week 1, first 4 loops), P1 (Week 2-3, next 9 loops), P2 (Week 4+, remaining 9 loops).

**Guiding principle:** No traffic before the destination is ready. Every Pin's destination URL must pass the Pinterest Rich Pins validator before publish.

---

## 2. Pre-Flight Checklist

### 2.1 Accounts & Tools

- [ ] Pinterest Business account created and domain claimed
- [ ] Pinterest tag deployed on key routes
- [ ] Figma templates for 2:3 (1200x1800), 1:1 (1000x1000), 1.91:1 (1200x628)
- [ ] Access to `apps/web/src/lib/pinterest/pinCampaigns.ts`
- [ ] Access to `apps/web/public/images/pinterest/` for asset delivery

### 2.2 Engineering Readiness Audit

| Route | Requirement | Status |
|---|---|---|
| `/solutions/clover-storefront` | `generateMetadata` + OG + 2:3 hero | [ ] |
| `/solutions/deposit-commerce` | `generateMetadata` + OG + 2:3 hero | [ ] |
| `/solutions/google-visibility` | `generateMetadata` + OG + 2:3 hero | [ ] |
| `/solutions/omnichannel` | `generateMetadata` + OG + 2:3 hero | [ ] |
| `/solutions/ecommerce` | `generateMetadata` + OG + 2:3 hero | [ ] |
| `/guides/google-visibility-checklist` | `generateMetadata` + email capture | [ ] |
| `/compare/clover-vs-shopify` | `generateMetadata` + OG | [ ] |
| `/examples` | `generateMetadata` + 5 example OGs | [ ] |
| `/features` | `generateMetadata` + per-feature anchor OG | [ ] |
| `/features#qr` | Anchor-level non-generic preview | [ ] |
| `/features#coupons` | Anchor-level non-generic preview | [ ] |
| `/features#social-commerce` | Anchor-level non-generic preview | [ ] |
| `/features#chatbot` | Anchor-level non-generic preview | [ ] |
| `/features#funnels` | Anchor-level non-generic preview | [ ] |
| `/features#wholesale` | Anchor-level non-generic preview | [ ] |
| `/features#platform-services` | Anchor-level non-generic preview | [ ] |
| `/features#ai-photos` | Anchor-level non-generic preview | [ ] |
| `/directory/[slug]` | `generateMetadata` + `LocalBusiness` schema | [ ] |
| `/directory/categories` | Category-level `generateMetadata` + OG | [ ] |
| `/products/[id]` | `og:type=product` + Pinterest Save button | [ ] |
| `/tenant/[id]` | 2:3 hero OG + Pinterest Save button | [ ] |

### 2.3 UTM & Tracking Setup

- [ ] `useUTM` and `mergeUTMIntoHref` on every public CTA
- [ ] `UTMTracker` mounted in client root layout
- [ ] UTM columns added to `abandoned_carts` and `customers` tables
- [ ] `getStoredUTMParams()` wired into `cartManager.ts`
- [ ] `first_utm_*` fields populated on `customers.create`
- [ ] `last_utm_json` updated on every returning login/order
- [ ] `CrmAlertService.createAbandonedCartAlert` includes UTM in metadata
- [ ] Recovery email URLs append UTM params

### 2.4 Design System

- [ ] Brand color palette and typography locked
- [ ] 2:3 Pin template (1200x1800) in Figma
- [ ] 1:1 Pin template (1000x1000) in Figma
- [ ] Logo assets exported (transparent PNG, SVG)
- [ ] Screenshot capture environment staged (demo tenant with populated storefront)

---

## 3. Universal Asset Production Workflow

Every loop follows this 8-step cycle:

1. **Confirm loop definition** — search phrase, Pin angle, destination, offer, CTA
2. **Verify destination readiness** — check Section 2.2 audit; if not ready, stop and file engineering ticket
3. **Produce visual assets** — design using Figma 2:3 template, export PNG + WebP to `apps/web/public/images/pinterest/`
4. **Write Pin copy** — title (max 100 chars), description (search phrase + value + CTA + 2-5 hashtags), alt text, board name
5. **Generate UTM URL** — use `buildPinUrl()` from `pinCampaigns.ts`
6. **Validate destination** — paste UTM URL into Pinterest Rich Pins Validator; confirm unique title, description, hero image
7. **Engineering swap** — update `heroImage` const in `page.tsx`, replace `placehold.co`, run `pnpm checkweb`
8. **Schedule & publish** — upload Pin, paste URL, select board, add copy, schedule, record date

---

## 4. P0 Loops — Week 1

### P-01: Clover POS Storefront

**Score:** 38/40 | **Board:** Clover POS Power Tips

| Field | Value |
|---|---|
| Search phrase | Clover POS apps and integrations |
| Pin angle | Turn Your Clover POS Into a Full Online Storefront in 14 Days |
| Destination | `/solutions/clover-storefront` |
| Offer | Storefront tier ($59/mo) — 14-day free trial |
| CTA | Connect your Clover account — start free trial |

**Assets:**

| Asset ID | Filename | Dimensions | Qty |
|---|---|---|---|
| p01-clover-storefront-hero | `p01-clover-storefront-hero` | 1200x1800 | 1 |
| clover-split-screens | `clover-split-1`, `clover-split-2`, `clover-split-3` | 1200x1800 | 3 |

**Creative direction:**
- Hero: Split-screen Clover POS dashboard (left) vs Visible Shelf storefront (right). Headline overlay. Brand logo.
- Split 1: Clover inventory vs synced online catalog
- Split 2: Clover order vs Visible Shelf fulfillment
- Split 3: Clover items vs Google Shopping feed

**Pin copy:**
- Title: Turn Your Clover POS Into a Full Online Storefront in 14 Days
- Description: Clover POS apps and integrations: sync inventory, orders, and Google Shopping automatically. No coding. 14-day free trial. #CloverPOS #OnlineStorefront #RetailTech #SmallBusiness
- Alt text: Split screen showing Clover POS syncing products to an online storefront
- Board: Clover POS Power Tips

**UTM:** `?utm_source=pinterest&utm_medium=social&utm_campaign=pintraffix-p0&utm_content=p-01-clover-storefront-clover-pos-power-tips&utm_term=clover-pos-apps-and-integrations&ref=pinterest`

**Destination readiness:**
- [ ] Route exists with `generateMetadata` + OG pointing to hero image
- [ ] Page includes Clover sync screenshot, how-it-works steps, Storefront CTA
- [ ] Mobile-first CTA above fold, headline matches Pin angle

**Checklist:**
- [ ] Hero + 3 splits designed and exported (PNG + WebP)
- [ ] `heroImage` updated in `page.tsx`, `placehold.co` replaced
- [ ] `pnpm checkweb` passes
- [ ] Rich Pins validator passes
- [ ] Pin copy approved, Pin uploaded, publish date recorded

---

### P-02: Google Visibility Seeker

**Score:** 37/40 | **Board:** Get Found on Google

| Field | Value |
|---|---|
| Search phrase | how to get my store on Google |
| Pin angle | Get Your Local Store on Google Search, Shopping & Maps — Without Hiring an Agency |
| Destination | `/solutions/google-visibility` |
| Offer | Discovery tier ($29/mo) — 14-day free trial |
| CTA | Get found on Google — start free trial |

**Assets:**

| Asset ID | Filename | Dimensions | Qty |
|---|---|---|---|
| p02-google-visibility-hero | `p02-google-visibility-hero` | 1200x1800 | 1 |
| google-before-after | `google-before-after-1`, `google-before-after-2`, `google-before-after-3` | 1200x1800 | 3 |

**Creative direction:**
- Hero: Google search results mockup showing local store in Search, Shopping, Maps. Headline overlay. Discovery price badge.
- Before/after 1: No Google presence vs Google Shopping carousel
- Before/after 2: No GBP vs complete GBP with photos/hours/products
- Before/after 3: No Maps listing vs store pin with product listings

**Pin copy:**
- Title: Get Your Local Store on Google Without Hiring an Agency
- Description: How to get my store on Google: Search, Shopping, and Maps — synced automatically from your POS. No agency fees. 14-day free trial. #GoogleVisibility #LocalRetail #SmallBusiness
- Alt text: Google search results showing a local store in Search, Shopping, and Maps
- Board: Get Found on Google

**UTM:** `?utm_source=pinterest&utm_medium=social&utm_campaign=pintraffix-p0&utm_content=p-02-google-visibility-get-found-on-google&utm_term=how-to-get-my-store-on-google&ref=pinterest`

**Destination readiness:**
- [ ] Route exists with `generateMetadata` + OG
- [ ] Page includes before/after mockups, Discovery CTA, GBP + Google Shopping narrative
- [ ] Mobile-first CTA above fold, headline matches Pin angle

**Checklist:**
- [ ] Hero + 3 before/after designed and exported
- [ ] `heroImage` updated, `placehold.co` replaced
- [ ] `pnpm checkweb` passes, Rich Pins validator passes
- [ ] Pin copy approved, Pin uploaded, date recorded

---

### P-03: Deposit / BOPIS Commerce

**Score:** 38/40 | **Board:** Local Retail Growth

| Field | Value |
|---|---|
| Search phrase | take deposits online for local pickup |
| Pin angle | Stop Losing Sales to "I'll Come Back Later" — Take a Deposit Now |
| Destination | `/solutions/deposit-commerce` |
| Offer | Commitment tier ($79/mo) — 14-day free trial |
| CTA | Start free trial — reserve and drive foot traffic |

**Assets:**

| Asset ID | Filename | Dimensions | Qty |
|---|---|---|---|
| p03-deposit-commerce-hero | `p03-deposit-commerce-hero` | 1200x1800 | 1 |
| deposit-reserve-flow | `deposit-reserve-flow-1`, `deposit-reserve-flow-2` | 1200x1800 | 2 |

**Creative direction:**
- Hero: Product page with "Reserve with Deposit" button highlighted, phone showing pickup confirmation. Headline overlay. Commitment price badge.
- Flow 1: 3-step — Browse product, Pay deposit, Pick up in store
- Flow 2: Notification sequence — deposit confirmation, pickup reminder, completed pickup

**Pin copy:**
- Title: Stop Losing Sales to "I'll Come Back Later" — Take a Deposit Now
- Description: Take deposits online for local pickup: let shoppers reserve with a deposit, guarantee foot traffic, reduce no-shows. 14-day free trial. #DepositCommerce #BOPIS #LocalRetail #FootTraffic
- Alt text: Product page showing reserve-with-deposit button and phone pickup confirmation
- Board: Local Retail Growth

**UTM:** `?utm_source=pinterest&utm_medium=social&utm_campaign=pintraffix-p0&utm_content=p-03-deposit-foot-traffic&utm_term=reserve-online-pick-up-in-store&ref=pinterest`

**Destination readiness:**
- [ ] Route exists with `generateMetadata` + OG
- [ ] Page includes reserve flow demo, deposit FAQ, Commitment CTA, foot-traffic proof
- [ ] Mobile-first CTA above fold, headline matches Pin angle

**Checklist:**
- [ ] Hero + 2 flow diagrams designed and exported
- [ ] `heroImage` updated, `placehold.co` replaced
- [ ] `pnpm checkweb` passes, Rich Pins validator passes
- [ ] Pin copy approved, Pin uploaded, date recorded

---

### P-04: Omnichannel Choice

**Score:** 37/40 | **Board:** Omnichannel Retail

| Field | Value |
|---|---|
| Search phrase | omnichannel retail small business |
| Pin angle | Let Your Customers Choose: Pay in Full or Reserve for Pickup |
| Destination | `/solutions/omnichannel` |
| Offer | Omnichannel tier ($149/mo) — 14-day free trial |
| CTA | Start free trial — one inventory, every way to buy |

**Assets:**

| Asset ID | Filename | Dimensions | Qty |
|---|---|---|---|
| p04-omnichannel-hero | `p04-omnichannel-hero` | 1200x1800 | 1 |
| omnichannel-split-path | `omnichannel-split-1`, `omnichannel-split-2` | 1200x1800 | 2 |

**Creative direction:**
- Hero: Single product with two checkout buttons: "Pay in Full + Ship" and "Reserve with Deposit + Pickup." Headline overlay. Omnichannel price badge.
- Split 1: Shopper chooses "Pay in Full" — shipping confirmation — delivery
- Split 2: Shopper chooses "Reserve with Deposit" — pickup confirmation — in-store pickup

**Pin copy:**
- Title: Let Customers Choose: Pay in Full or Reserve for Pickup
- Description: Omnichannel retail for small business: one inventory, two checkout paths. Pay in full for shipping or reserve with deposit for pickup. 14-day free trial. #Omnichannel #RetailTech #BOPIS
- Alt text: Split-path visual showing a product with two checkout options
- Board: Omnichannel Retail

**UTM:** `?utm_source=pinterest&utm_medium=social&utm_campaign=pintraffix-p0&utm_content=p-04-omnichannel-omnichannel-retail&utm_term=omnichannel-retail-small-business&ref=pinterest`

**Destination readiness:**
- [ ] Route exists with `generateMetadata` + OG
- [ ] Page includes split-path visual, Omnichannel CTA, deposit vs full-pay comparison
- [ ] Mobile-first CTA above fold, headline matches Pin angle

**Checklist:**
- [ ] Hero + 2 split-path mockups designed and exported
- [ ] `heroImage` updated, `placehold.co` replaced
- [ ] `pnpm checkweb` passes, Rich Pins validator passes
- [ ] Pin copy approved, Pin uploaded, date recorded

---

## 5. P1 Loops — Week 2-3

### P-05: Instagram Shopping Sync

**Score:** 35/40 | **Board:** Social Commerce for Retail

| Field | Value |
|---|---|
| Search phrase | how to set up Instagram shopping |
| Pin angle | Sync Your Product Catalog to Instagram & Facebook Automatically — No Manual Updates |
| Destination | `/features#social-commerce` |
| Offer | Social Commerce add-on + any commerce tier |
| CTA | Connect your store to Instagram — start free trial |

**Assets:** `p05-instagram-sync-hero` (1x 1200x1800), `instagram-shopping-1/2` (2x 1200x1800)
**Creative:** Hero = Instagram Shopping storefront with sync indicator. Screens = synced product tags, Facebook Shop catalog.
**Pin copy:** Title: Sync Your Product Catalog to Instagram & Facebook Automatically. Description: How to set up Instagram shopping: auto-sync your POS catalog. No manual updates. #InstagramShopping #SocialCommerce #SmallBusiness
**UTM:** `utm_content=p-05-instagram-sync-social-commerce`, `utm_term=how-to-set-up-instagram-shopping`
**Destination:** [ ] `/features#social-commerce` anchor has non-generic OG preview
**Checklist:** [ ] 3 assets designed/exported [ ] Anchor OG verified [ ] Rich Pins passes [ ] Pin uploaded

---

### P-06: QR Code Marketing

**Score:** 35/40 | **Board:** QR Code Marketing

| Field | Value |
|---|---|
| Search phrase | QR code marketing ideas for small business |
| Pin angle | Create Branded QR Codes With Your Store Logo — Track Every Scan |
| Destination | `/features#qr` |
| Offer | Styled QR add-on ($9/mo, 7-day trial) |
| CTA | Design your branded QR code — start trial |

**Assets:** `p06-qr-code-grid` (1x 1200x1800), `qr-examples-1/2` (2x 1200x1800)
**Creative:** Hero = 3x2 grid of branded QR codes with use case labels (Shelf Tag, Window Display, Instagram Bio, Business Card, Receipt, Coupon). Examples = QR on shelf tag with analytics, QR on window decal with scan count.
**Pin copy:** Title: Create Branded QR Codes With Your Store Logo — Track Every Scan. Description: QR code marketing ideas for small business: branded QR with logo, custom colors, analytics. 7-day free trial. #QRCodeMarketing #SmallBusiness #BrandedQR
**UTM:** `utm_content=p-06-qr-marketing-qr-code-marketing`, `utm_term=qr-code-marketing-ideas-for-small-business`
**Destination:** [ ] `/features#qr` anchor has non-generic OG preview
**Checklist:** [ ] 3 assets designed/exported [ ] Anchor OG verified [ ] Rich Pins passes [ ] Pin uploaded

---

### P-07: Coupon Strategy

**Score:** 35/40 | **Board:** Coupon & Promo Strategy

| Field | Value |
|---|---|
| Search phrase | coupon marketing strategy for small business |
| Pin angle | Create Digital Coupons Your Customers Can Scan, Share & Redeem at Checkout |
| Destination | `/features#coupons` |
| Offer | Coupon Options add-on + any commerce tier |
| CTA | Create your first digital coupon — start trial |

**Assets:** `p07-coupon-strategy-hero` (1x 1200x1800), `coupon-mockup-1/2/3` (3x 1200x1800)
**Creative:** Hero = digital coupon card on phone with QR, discount badge, Share button. Mockups = percentage-off with QR sharing, BOGO with analytics, free shipping with spotlight badge.
**Pin copy:** Title: Create Digital Coupons Your Customers Can Scan, Share & Redeem. Description: Coupon marketing strategy for small business: digital coupons with QR sharing, redemption tracking, storefront spotlight. #CouponMarketing #DigitalCoupons #QRCode
**UTM:** `utm_content=p-07-coupon-strategy-coupon-promo`, `utm_term=coupon-marketing-strategy-for-small-business`
**Destination:** [ ] `/features#coupons` anchor has non-generic OG preview
**Checklist:** [ ] 4 assets designed/exported [ ] Anchor OG verified [ ] Rich Pins passes [ ] Pin uploaded

---

### P-08: Seasonal Shopper

**Score:** 35/40 | **Board:** Shop Local Gift Guides | **Timing:** October

| Field | Value |
|---|---|
| Search phrase | holiday gift guide 2026 |
| Pin angle | Holiday Gift Guide: Unique Finds from Local Retailers You Won't See on Amazon |
| Destination | `/directory/categories` with seasonal filters |
| Offer | Marketplace traffic (no direct sale) |
| CTA | Explore holiday gifts from local stores |

**Assets:** `p08-seasonal-gift-guide` (1x 1200x1800), `holiday-collage-1/2/3` (3x 1200x1800)
**Creative:** Hero = festive collage of local products with "Holiday Gift Guide 2026" headline. Collages = "Gifts Under $25," "Unique Finds," "Last-Minute Gifts."
**Pin copy:** Title: Holiday Gift Guide 2026: Unique Finds from Local Retailers. Description: Discover unique gifts from local retailers. Real-time local availability, pickup today. #HolidayGiftGuide #ShopLocal #GiftIdeas2026
**UTM:** `utm_content=p-08-seasonal-shopper-shop-local-gift-guides`, `utm_term=holiday-gift-guide-2026`
**Destination:** [ ] `/directory/categories` has category-level `generateMetadata` + OG [ ] Seasonal filters work
**Checklist:** [ ] 4 assets designed/exported [ ] Category OG verified [ ] Rich Pins passes [ ] Pin scheduled for October

---

### P-09: BOPIS Setup

**Score:** 34/40 | **Board:** Local Retail Growth

| Field | Value |
|---|---|
| Search phrase | buy online pick up in store setup |
| Pin angle | Set Up BOPIS for Your Local Store Without Changing Your POS System |
| Destination | `/solutions/deposit-commerce` (shared with P-03) |
| Offer | Commitment ($79) or Omnichannel ($149) |
| CTA | See how BOPIS works with your Clover POS |

**Assets:** Reuses P-03 assets. Optional: `p09-bopis-setup` (1x 1200x1800) — 3-step BOPIS flow with Clover badge.
**Pin copy:** Title: Set Up BOPIS for Your Local Store Without Changing Your POS. Description: Buy online pick up in store setup: enable BOPIS with existing Clover POS. No new hardware. 14-day free trial. #BOPIS #ClickAndCollect #CloverPOS
**UTM:** `utm_content=p-09-bopis-setup-local-retail-growth`, `utm_term=buy-online-pick-up-in-store-setup`
**Destination:** [ ] `/solutions/deposit-commerce` built (from P-03)
**Checklist:** [ ] Hero designed or P-03 assets reused [ ] Rich Pins passes [ ] Pin uploaded

---

### P-10: Why Not on Google?

**Score:** 35/40 | **Board:** Get Found on Google

| Field | Value |
|---|---|
| Search phrase | why are my products not showing on Google |
| Pin angle | The 3 Reasons Local Products Never Show Up on Google |
| Destination | `/guides/google-visibility-checklist` (lead magnet) |
| Offer | Discovery tier ($29) — 14-day free trial (gated) |
| CTA | Download the guide + start free trial |

**Assets:** `p10-why-not-google` (1x 1200x1800), `google-checklist-1/2` (2x 1200x1800)
**Creative:** Hero = checklist with 3 unchecked items (No GBP, No product feed, No Merchant Center). Checklist 1 = completed checklist + "Start Free Trial" CTA. Checklist 2 = before/after Google search comparison.
**Pin copy:** Title: The 3 Reasons Local Products Never Show Up on Google. Description: Why are my products not showing on Google? Download the free Google Visibility Checklist. #GoogleVisibility #LocalBusiness #SEO
**UTM:** `utm_content=p-10-why-not-google-get-found-on-google`, `utm_term=why-are-my-products-not-showing-on-google`
**Destination:** [ ] Route exists with `generateMetadata` [ ] Page includes gated PDF, email capture, Discovery CTA [ ] Email capture feeds CRM with `first_utm_*`
**Checklist:** [ ] 3 assets designed/exported [ ] Landing page with email capture built [ ] Rich Pins passes [ ] Pin uploaded

---

### P-11: Wholesale Sourcing

**Score:** 34/40 | **Board:** Wholesale & Sourcing

| Field | Value |
|---|---|
| Search phrase | how to find wholesale suppliers for retail store |
| Pin angle | Find Suppliers Across Faire from Your Dashboard — No Spreadsheet Required |
| Destination | `/features#wholesale` |
| Offer | Wholesale Matching add-on |
| CTA | Start your wholesale search — try free |

**Assets:** `p11-wholesale-hero` (1x 1200x1800), `wholesale-screen-1/2` (2x 1200x1800)
**Creative:** Hero = dashboard with supplier matching results, product cards, "Request Quote" buttons. Screens = supplier search with filters, supplier detail with affiliate link builder.
**Pin copy:** Title: Find Wholesale Suppliers for Your Retail Store — No Spreadsheet Required. Description: Search, match, and connect with suppliers from your dashboard. Faire marketplace alternative. #WholesaleSourcing #RetailBusiness
**UTM:** `utm_content=p-11-wholesale-wholesale-sourcing`, `utm_term=how-to-find-wholesale-suppliers-for-retail-store`
**Destination:** [ ] `/features#wholesale` anchor has non-generic OG preview
**Checklist:** [ ] 3 assets designed/exported [ ] Anchor OG verified [ ] Rich Pins passes [ ] Pin uploaded

---

### P-12: Logo / Brand Kit

**Score:** 34/40 | **Board:** Small Business Branding

| Field | Value |
|---|---|
| Search phrase | small business logo design ideas |
| Pin angle | Professional Logo, Banner & Social Kit for Your Store — Done in Days, Not Weeks |
| Destination | `/features#platform-services` |
| Offer | Platform Services (one-time purchase) |
| CTA | Get your brand kit — start now |

**Assets:** `p12-brand-kit-hero` (1x 1200x1800), `branding-collage-1/2/3` (3x 1200x1800)
**Creative:** Hero = collage of logo concepts, banner, social kit, QR with brand colors. Collages = before/after plain vs branded storefront, logo concept sheet (3 variations), social media kit templates.
**Pin copy:** Title: Professional Logo, Banner & Social Kit for Your Store. Description: Small business logo design ideas: complete brand kit — logo, banner, social templates, branded QR. One-time purchase. #SmallBusinessBranding #LogoDesign #BrandKit
**UTM:** `utm_content=p-12-brand-kit-small-business-branding`, `utm_term=small-business-logo-design-ideas`
**Destination:** [ ] `/features#platform-services` anchor has non-generic OG preview
**Checklist:** [ ] 4 assets designed/exported [ ] Anchor OG verified [ ] Rich Pins passes [ ] Pin uploaded

---

### P-13: E-commerce Clean Checkout

**Score:** 34/40 | **Board:** Sell Online Successfully

| Field | Value |
|---|---|
| Search phrase | easy online store for small business |
| Pin angle | A Complete Checkout Without the Enterprise Price — Full E-commerce for $99/mo |
| Destination | `/solutions/ecommerce` |
| Offer | E-commerce tier ($99/mo) — 14-day free trial |
| CTA | Start free trial — full checkout |

**Assets:** `ecommerce-hero` (1x 1200x1800), `ecommerce-checkout-1/2` (2x 1200x1800)
**Creative:** Hero = clean checkout page with product, shipping, payment form. E-commerce price badge. Checkout 1 = 4-step flow (Cart, Shipping, Payment, Confirmation). Checkout 2 = fulfillment options (Shipping, Local Delivery, Store Pickup).
**Pin copy:** Title: A Complete Checkout Without the Enterprise Price — Full E-commerce for $99/mo. Description: Easy online store for small business: full checkout, shipping, delivery, coupons. No transaction fees. 14-day free trial. #Ecommerce #SmallBusiness #OnlineStore
**UTM:** `utm_content=p-13-ecommerce-sell-online`, `utm_term=easy-online-store-for-small-business`
**Destination:** [ ] Route exists with `generateMetadata` + OG [ ] Page includes checkout demo, E-commerce CTA, shipping example [ ] Mobile CTA above fold
**Checklist:** [ ] 3 assets designed/exported [ ] `heroImage` updated, `placehold.co` replaced [ ] `pnpm checkweb` passes [ ] Rich Pins passes [ ] Pin uploaded

---

## 6. P2 Loops — Week 4+

Use the same 8-step workflow from Section 3 for each.

### P-14: Multi-Location Retail
- **Score:** 34/40 | **Board:** Multi-Location Retail
- **Search:** managing multiple retail locations
- **Angle:** One Dashboard for Every Location — Multi-Store Retail Without the Chaos
- **Destination:** `/enterprise` | **Offer:** Enterprise ($499/mo) — Book a demo
- **Assets:** 2x multi-location map visuals (1200x1800)
- **UTM:** `utm_content=p-14-multi-location-multi-location-retail`

### P-15: AI Chatbot
- **Score:** 33/40 | **Board:** AI for Retail
- **Search:** AI chatbot for small business
- **Angle:** AI That Knows Your Real Inventory — Add a Shopping Assistant in 5 Minutes
- **Destination:** `/features#chatbot` | **Offer:** Chatbot add-on ($9/mo)
- **Assets:** 5x chatbot conversation screenshots (1200x1800)
- **UTM:** `utm_content=p-15-ai-chatbot-ai-for-retail`

### P-16: AI Product Photography
- **Score:** 33/40 | **Board:** AI for Retail
- **Search:** AI product photography tools
- **Angle:** Generate Professional Product Photos Without a Studio
- **Destination:** `/features#ai-photos` | **Offer:** Quickstart add-on
- **Assets:** 5x before/after product photos (1200x1800)
- **UTM:** `utm_content=p-16-ai-photos-ai-for-retail`

### P-17: Local Gift Seeker
- **Score:** 33/40 | **Board:** Shop Local Gift Guides
- **Search:** unique gifts from local shops
- **Angle:** Unique Gifts from Local Shops You Won't Find on Amazon
- **Destination:** `/directory` | **Offer:** Marketplace traffic
- **Assets:** 5x directory product grids (1200x1800)
- **UTM:** `utm_content=p-17-local-gift-shop-local-gift-guides`

### P-18: Storefront Examples
- **Score:** 33/40 | **Board:** Sell Online Successfully
- **Search:** small business storefront page examples
- **Angle:** 5 Real Storefronts Built Without Coding — See What's Possible
- **Destination:** `/examples` | **Offer:** Storefront ($59/mo) — 14-day free trial
- **Assets:** 5x storefront screenshots (600x900) — filenames: `example-1` through `example-5`
- **Note:** 600x900 (not 1200x1800) — screenshot thumbnails. Replace `placehold.co` in `/examples/page.tsx`.
- **UTM:** `utm_content=p-18-storefront-examples-sell-online`

### P-19: Sales Funnel Builder
- **Score:** 32/40 | **Board:** Retail Sales Funnels
- **Search:** sales funnel for ecommerce
- **Angle:** Post-Purchase Upsells Without Coding — Order Bumps, Upsells & OTOs
- **Destination:** `/features#funnels` | **Offer:** Funnel add-on + Omnichannel+ tier
- **Assets:** 3x funnel diagrams (1200x1800)
- **UTM:** `utm_content=p-19-sales-funnel-retail-sales-funnels`

### P-20: Aspiring Online Seller
- **Score:** 32/40 | **Board:** Sell Online Successfully
- **Search:** how to sell online for beginners
- **Angle:** The 5 Steps Every Beginner Needs to Start Selling Online
- **Destination:** `/features` | **Offer:** Discovery ($29/mo) — 14-day free trial
- **Assets:** 1x 5-step infographic (1200x1800)
- **UTM:** `utm_content=p-20-aspiring-seller-sell-online`

### P-22: Do I Need Shopify?
- **Score:** 32/40 | **Board:** Sell Online Successfully
- **Search:** do I need Shopify for a small business
- **Angle:** Visible Shelf vs. Shopify: Which Is Right for Your Local Store?
- **Destination:** `/compare/clover-vs-shopify` | **Offer:** E-commerce / Omnichannel
- **Assets:** 1x comparison table graphic (1200x1800)
- **UTM:** `utm_content=p-22-shopify-compare-sell-online`

---

## 7. Engineering Swap Checklist

After design drops assets, update each landing page's `heroImage` const from `placehold.co` to the local path.

### Asset-to-File Mapping

| Asset | Replace In File | New Value |
|---|---|---|
| `p01-clover-storefront-hero` | `apps/web/src/app/solutions/clover-storefront/page.tsx` | `/images/pinterest/p01-clover-storefront-hero.png` |
| `clover-split-1/2/3` | `apps/web/src/app/solutions/clover-storefront/page.tsx` | `/images/pinterest/clover-split-{n}.png` |
| `p02-google-visibility-hero` | `apps/web/src/app/solutions/google-visibility/page.tsx` | `/images/pinterest/p02-google-visibility-hero.png` |
| `google-before-after-1/2/3` | `apps/web/src/app/solutions/google-visibility/page.tsx` + `/guides/google-visibility-checklist/page.tsx` | `/images/pinterest/google-before-after-{n}.png` |
| `p03-deposit-commerce-hero` | `apps/web/src/app/solutions/deposit-commerce/page.tsx` | `/images/pinterest/p03-deposit-commerce-hero.png` |
| `deposit-reserve-flow-1/2` | `apps/web/src/app/solutions/deposit-commerce/page.tsx` | `/images/pinterest/deposit-reserve-flow-{n}.png` |
| `p04-omnichannel-hero` | `apps/web/src/app/solutions/omnichannel/page.tsx` | `/images/pinterest/p04-omnichannel-hero.png` |
| `omnichannel-split-1/2` | `apps/web/src/app/solutions/omnichannel/page.tsx` | `/images/pinterest/omnichannel-split-{n}.png` |
| `ecommerce-hero` | `apps/web/src/app/solutions/ecommerce/page.tsx` | `/images/pinterest/ecommerce-hero.png` |
| `p06-qr-code-grid` | `apps/web/src/lib/pinterest/pinCampaigns.ts` | `/images/pinterest/p06-qr-code-grid.png` |
| `example-1…5` | `apps/web/src/app/examples/page.tsx` | `/images/pinterest/example-{n}.png` |

### Code Change Pattern

```ts
// Before
const heroImage = 'https://placehold.co/1200x1800?text=Clover+Storefront';

// After
const heroImage = '/images/pinterest/p01-clover-storefront-hero.png';
```

`metadataBase` is already configured in each `page.tsx`, so relative paths resolve correctly for `openGraph` and `twitter:image` tags.

### Verification

After all swaps: `pnpm checkweb` must pass with zero TS errors before deploying.

---

## 8. UTM Tagging Reference

### UTM Structure

```
?utm_source=pinterest
&utm_medium=social
&utm_campaign=pintraffix-{phase}
&utm_content={loop_id}-{slug}-{board_name_slug}
&utm_term={search_phrase_slug}
&ref=pinterest
```

### Phase Values

| Phase | `utm_campaign` | Loops |
|---|---|---|
| P0 launch | `pintraffix-p0` | P-01, P-02, P-03, P-04 |
| P1 launch | `pintraffix-p1` | P-05 through P-13 |
| P2 launch | `pintraffix-p2` | P-14 through P-22 |
| Seasonal | `pintraffix-seasonal` | P-08 |

### UTM Content Tags by Loop

| Loop | `utm_content` |
|---|---|
| P-01 | `p-01-clover-storefront-clover-pos-power-tips` |
| P-02 | `p-02-google-visibility-get-found-on-google` |
| P-03 | `p-03-deposit-foot-traffic` |
| P-04 | `p-04-omnichannel-omnichannel-retail` |
| P-05 | `p-05-instagram-sync-social-commerce` |
| P-06 | `p-06-qr-marketing-qr-code-marketing` |
| P-07 | `p-07-coupon-strategy-coupon-promo` |
| P-08 | `p-08-seasonal-shopper-shop-local-gift-guides` |
| P-09 | `p-09-bopis-setup-local-retail-growth` |
| P-10 | `p-10-why-not-google-get-found-on-google` |
| P-11 | `p-11-wholesale-wholesale-sourcing` |
| P-12 | `p-12-brand-kit-small-business-branding` |
| P-13 | `p-13-ecommerce-sell-online` |
| P-14 | `p-14-multi-location-multi-location-retail` |
| P-15 | `p-15-ai-chatbot-ai-for-retail` |
| P-16 | `p-16-ai-photos-ai-for-retail` |
| P-17 | `p-17-local-gift-shop-local-gift-guides` |
| P-18 | `p-18-storefront-examples-sell-online` |
| P-19 | `p-19-sales-funnel-retail-sales-funnels` |
| P-20 | `p-20-aspiring-seller-sell-online` |
| P-22 | `p-22-shopify-compare-sell-online` |

### URL Generation

Marketing should use `buildPinUrl(P0_PINS_BY_LOOP['P-03'])` to generate the exact Pin destination link with unique `utm_content` per loop.

Source of truth: `apps/web/src/lib/pinterest/pinCampaigns.ts`

### UTM Data Flow (End-to-End Attribution)

1. **Pinterest click** — User clicks Pin with UTM-tagged URL
2. **Landing page** — `UTMTracker` captures UTM params from URL query string
3. **Session storage** — `getStoredUTMParams()` stores params in `sessionStorage`
4. **Signup** — `first_utm_*` fields written to `customers` table on first signup
5. **Cart tracking** — `cartManager.ts` -> `trackCartWithServer` -> `CheckoutService.trackCart` includes `utmParams`
6. **Abandoned cart** — UTM stored on `abandoned_carts` row (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `ref`)
7. **Recovery email** — `AbandonedCartService.sendRecoveryEmail` appends UTM to recovery URL via `URLSearchParams`
8. **CRM alert** — `CrmAlertService.createAbandonedCartAlert` includes UTM in `metadata`
9. **Returning visits** — `last_utm_json` updated on every login/order
10. **Reporting** — SQL queries join `abandoned_carts` and `customers` by `utm_source` / `utm_content` for recovery rate and LTV analysis

---

## 9. Pin Copy Template

Use this template for every Pin:

```
Title: [Pin angle headline — max 100 chars, keyword-rich]
Description: [Search phrase]: [value proposition]. [CTA]. [2-5 hashtags]
Alt text: [Visual description incorporating the search phrase]
Board: [Board name from Board Architecture]
Link: [UTM-tagged destination URL]
```

### Angle Variations

For each loop, produce 4 Pin angle variants for A/B testing:

| Angle Type | Pattern |
|---|---|
| **Educational** | "How/Why [topic] [outcome]" |
| **Quick-start** | "[Action] in [timeframe] — [benefit]" |
| **Problem-solving** | "Stop [pain point] — [solution]" |
| **Comparison** | "[Option A] vs. [Option B]: Which [outcome]?" |

### Example (P-03 Deposit Commerce)

| Angle | Headline |
|---|---|
| Educational | Why Online Reservations Drive 3x More Foot Traffic Than Social Posts |
| Quick-start | Let Shoppers Reserve Products Online in Under 10 Minutes |
| Problem-solving | Stop Losing Foot Traffic to Amazon — How Local Stores Fight Back |
| Comparison | Deposit Commerce vs. Click & Collect: Which Drives More In-Store Visits? |

---

## 10. Validation & QA Checklist

Run this checklist for every Pin before publishing.

### Destination Validation

- [ ] UTM-tagged URL pasted into Pinterest Rich Pins Validator
- [ ] Preview shows unique title (not generic "Visible Shelf")
- [ ] Preview shows unique description
- [ ] Preview shows 2:3 hero image (not placeholder, not broken)
- [ ] URL loads on mobile (375px viewport)
- [ ] CTA visible above the fold on mobile
- [ ] Headline on page matches Pin angle exactly
- [ ] `?ref=pinterest` and UTM params captured by `UTMTracker`

### Pin Asset Validation

- [ ] Image dimensions are 1200x1800 (2:3 ratio) or 1000x1000 (1:1)
- [ ] Image file size under 20MB
- [ ] Image exported as PNG and WebP
- [ ] Image filename matches asset manifest exactly
- [ ] Image delivered to `apps/web/public/images/pinterest/`
- [ ] No placeholder text or watermarks in image

### Pin Metadata Validation

- [ ] Title is max 100 characters
- [ ] Description includes the target search phrase
- [ ] Description includes a clear CTA
- [ ] Description includes 2-5 hashtags
- [ ] Alt text describes the visual and includes the search phrase
- [ ] Board name matches the Board Architecture
- [ ] Destination link includes full UTM string with `ref=pinterest`

---

## 11. Launch & Monitoring

### Publish Schedule (P0 — First 6 Pins)

| Day | Pin | Loop | Board |
|---|---|---|---|
| 1 | Pin 1 | P-03 Deposit Commerce | Local Retail Growth |
| 1 | Pin 2 | P-01 Clover POS Storefront | Clover POS Power Tips |
| 2 | Pin 3 | P-02 Google Visibility | Get Found on Google |
| 2 | Pin 4 | P-04 Omnichannel Choice | Omnichannel Retail |
| 3 | Pin 5 | P-10 Why Not on Google? | Get Found on Google |
| 3 | Pin 6 | P-06 QR Code Marketing | QR Code Marketing |

### Post-Publish QA

| Day | Action | Owner |
|---|---|---|
| 4 | QA live Pin previews on mobile Pinterest app | Engineering + Marketing |
| 5 | Review first 72-hour metrics: impressions, closeups, outbound clicks | Growth |
| 6 | Repair any weak Pin angles or destination mismatches | Marketing + Design |
| 7 | Plan next 6 P1 Pins, schedule 14-day review | Marketing + Product + Growth |

### Metrics to Watch

| Metric | What It Tells You | Tool |
|---|---|---|
| Impressions | Search visibility | Pinterest Analytics |
| Closeup rate | Pin creative relevance | Pinterest Analytics |
| Outbound clicks | Click reason is compelling | Pinterest Analytics + UTM |
| Landing page visits | Message match is working | GA / Plausible |
| Trial starts | Offer matches intent | Visible Shelf signup analytics |
| Trial-to-paid conversion | Tier value is clear | Stripe / subscription analytics |
| Abandoned cart recovery rate | Full-funnel attribution | SQL queries on `abandoned_carts` |
| Customer LTV by first-touch UTM | Long-term source value | SQL queries on `customers` |

### Decision Gates at 7 Days

| If... | Then... |
|---|---|
| Outbound click rate < 1% | Rewrite Pin headline/description or swap visual |
| High clicks but no trial starts | Fix destination headline/CTA match |
| High trials but low paid conversion | Review trial onboarding and first-run value |
| One board outperforms by 2x | Double Pin volume for that board next sprint |

### Reporting SQL

**Abandoned cart conversion by UTM source:**

```sql
SELECT
  utm_source,
  utm_content,
  COUNT(*) AS carts,
  SUM(CASE WHEN converted THEN 1 ELSE 0 END) AS recovered,
  ROUND(100.0 * SUM(CASE WHEN converted THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS recovery_rate
FROM abandoned_carts
WHERE utm_source = 'pinterest'
GROUP BY utm_source, utm_content
ORDER BY recovery_rate DESC;
```

**Customer LTV by first-touch UTM content:**

```sql
SELECT
  first_utm_content,
  COUNT(*) AS customers,
  AVG(lifetime_value_cents) AS avg_ltv_cents
FROM customers
WHERE first_utm_source = 'pinterest'
GROUP BY first_utm_content
ORDER BY avg_ltv_cents DESC;
```

---

## 12. CRM-Driven Production Tracking

The platform's built-in Admin CRM (`/settings/admin/crm`) serves as the operational tracking system for all asset production. No external project management tools are needed — the CRM's Projects feature provides project-scoped Kanban boards, priority, assignment, threaded conversation, and status tracking that map directly to the asset production workflow. Tasks and tickets are created inside a dedicated CRM Project (no tenant required), keeping internal work separate from tenant-facing support.

### 12.1 Why Use the CRM

| CRM Feature | Asset Production Purpose |
|---|---|
| **Tasks (Kanban board)** | One task per asset batch per loop. Columns: `pending` -> `in_progress` -> `completed` -> `cancelled` |
| **Priority field** | `high` = P0 loops, `medium` = P1 loops, `low` = P2 loops |
| **Assigned To** | Single assignee per task — the person responsible for that asset batch |
| **Due Date** | Week 1 for P0, Week 2-3 for P1, Week 4+ for P2 |
| **Threaded conversation** | Design feedback, creative direction notes, revision requests — all on the task detail page |
| **Internal notes** | QA validation results (Rich Pins pass/fail), engineering swap confirmation, publish date recording |
| **Tickets** | Engineering blockers (e.g., "Route needs `generateMetadata`") — separate from design tasks, assigned to Engineering |
| **Status dropdown (inline)** | Change status directly from the Kanban board without opening the task |
| **Reorder (drag-and-drop)** | Prioritize which asset to produce next within a column |
| **Activities log** | Auto-tracks status changes, assignment changes, and conversation additions |

### 12.2 Setup

1. **Create a CRM Project** — Navigate to `/settings/admin/crm/projects`, click "+ Create Project", name it "PinTraffix Asset Production", and set status to "Active". This project will hold all production tasks and tickets without needing a tenant.
2. **Open the project** — Click the project name to open the detail page at `/settings/admin/crm/projects/[projectId]`. This is your project-scoped Kanban board with Tasks, Tickets, and Activities tabs.
3. **Create tasks** using the "+ Add Task" button on the Tasks tab, using the templates in Section 12.3 below
4. **Create tickets** for engineering blockers on the Tickets tab, using the templates in Section 12.4
5. **Filter by status** using the Kanban columns (Pending, In Progress, Completed, Cancelled)

### 12.3 Task Creation Templates — Per Loop

Each task is created via the "+ Create Task" button on the Kanban board. Use these exact templates.

#### P0 Loops (Priority: High, Due: Week 1)

**P-01: Clover POS Storefront — Asset Production**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P-01: Clover hero + 3 split screens |
| Description | Design 4 assets (1200x1800, PNG + WebP): `p01-clover-storefront-hero` (split-screen Clover POS vs Visible Shelf storefront), `clover-split-1` (inventory sync), `clover-split-2` (order fulfillment), `clover-split-3` (Google Shopping feed). Export to `apps/web/public/images/pinterest/`. See ASSET_PRODUCTION_USER_GUIDE.md Section 4 P-01 for creative direction. |
| Priority | High |
| Due Date | [Week 1 date] |
| Assigned To | [Designer] |

**P-01: Clover POS Storefront — Engineering Swap**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P-01: Swap heroImage in clover-storefront page.tsx |
| Description | Replace `placehold.co` placeholders in `apps/web/src/app/solutions/clover-storefront/page.tsx` with `/images/pinterest/p01-clover-storefront-hero.png` and `/images/pinterest/clover-split-{n}.png`. Run `pnpm checkweb`. See ASSET_PRODUCTION_USER_GUIDE.md Section 7. |
| Priority | High |
| Due Date | [Week 1 date + 1 day after design delivery] |
| Assigned To | [Engineer] |

**P-02: Google Visibility Seeker — Asset Production**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P-02: Google hero + 3 before/after mockups |
| Description | Design 4 assets (1200x1800, PNG + WebP): `p02-google-visibility-hero` (Google search results mockup with local store in Search/Shopping/Maps), `google-before-after-1` (no Google vs Shopping carousel), `google-before-after-2` (no GBP vs complete GBP), `google-before-after-3` (no Maps vs store pin). Export to `apps/web/public/images/pinterest/`. See guide Section 4 P-02. |
| Priority | High |
| Due Date | [Week 1 date] |
| Assigned To | [Designer] |

**P-02: Google Visibility Seeker — Engineering Swap**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P-02: Swap heroImage in google-visibility + checklist pages |
| Description | Replace `placehold.co` in `apps/web/src/app/solutions/google-visibility/page.tsx` and `/guides/google-visibility-checklist/page.tsx` with local image paths. Run `pnpm checkweb`. See guide Section 7. |
| Priority | High |
| Due Date | [Week 1 date + 1 day after design delivery] |
| Assigned To | [Engineer] |

**P-03: Deposit Commerce — Asset Production**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P-03: Deposit hero + 2 reserve flow diagrams |
| Description | Design 3 assets (1200x1800, PNG + WebP): `p03-deposit-commerce-hero` (product page with Reserve with Deposit button + phone pickup confirmation), `deposit-reserve-flow-1` (3-step: browse, deposit, pickup), `deposit-reserve-flow-2` (notification sequence). Export to `apps/web/public/images/pinterest/`. See guide Section 4 P-03. |
| Priority | High |
| Due Date | [Week 1 date] |
| Assigned To | [Designer] |

**P-03: Deposit Commerce — Engineering Swap**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P-03: Swap heroImage in deposit-commerce page.tsx |
| Description | Replace `placehold.co` in `apps/web/src/app/solutions/deposit-commerce/page.tsx` with `/images/pinterest/p03-deposit-commerce-hero.png` and `/images/pinterest/deposit-reserve-flow-{n}.png`. Run `pnpm checkweb`. See guide Section 7. |
| Priority | High |
| Due Date | [Week 1 date + 1 day after design delivery] |
| Assigned To | [Engineer] |

**P-04: Omnichannel Choice — Asset Production**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P-04: Omnichannel hero + 2 split-path mockups |
| Description | Design 3 assets (1200x1800, PNG + WebP): `p04-omnichannel-hero` (single product with two checkout buttons), `omnichannel-split-1` (pay in full path), `omnichannel-split-2` (reserve with deposit path). Export to `apps/web/public/images/pinterest/`. See guide Section 4 P-04. |
| Priority | High |
| Due Date | [Week 1 date] |
| Assigned To | [Designer] |

**P-04: Omnichannel Choice — Engineering Swap**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P-04: Swap heroImage in omnichannel page.tsx |
| Description | Replace `placehold.co` in `apps/web/src/app/solutions/omnichannel/page.tsx` with local image paths. Run `pnpm checkweb`. See guide Section 7. |
| Priority | High |
| Due Date | [Week 1 date + 1 day after design delivery] |
| Assigned To | [Engineer] |

#### P0 Pin Production & Publish Tasks

**P0: Pin Copy + Publish — Pin 1 (P-03 Deposit Commerce)**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P0 Pin 1: Write copy + publish P-03 Deposit Commerce Pin |
| Description | Write Pin copy (title max 100 chars, description with search phrase + CTA + hashtags, alt text). Generate UTM URL via `buildPinUrl()`. Validate destination with Pinterest Rich Pins Validator. Upload to Pinterest, select board "Local Retail Growth", schedule for Day 1. See guide Sections 4 P-03 and 11. |
| Priority | High |
| Due Date | [Day 1] |
| Assigned To | [Marketing] |

**P0: Pin Copy + Publish — Pin 2 (P-01 Clover Storefront)**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P0 Pin 2: Write copy + publish P-01 Clover Storefront Pin |
| Description | Write Pin copy. Generate UTM URL. Validate with Rich Pins Validator. Upload to Pinterest, select board "Clover POS Power Tips", schedule for Day 1. See guide Sections 4 P-01 and 11. |
| Priority | High |
| Due Date | [Day 1] |
| Assigned To | [Marketing] |

**P0: Pin Copy + Publish — Pin 3 (P-02 Google Visibility)**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P0 Pin 3: Write copy + publish P-02 Google Visibility Pin |
| Description | Write Pin copy. Generate UTM URL. Validate with Rich Pins Validator. Upload to Pinterest, select board "Get Found on Google", schedule for Day 2. See guide Sections 4 P-02 and 11. |
| Priority | High |
| Due Date | [Day 2] |
| Assigned To | [Marketing] |

**P0: Pin Copy + Publish — Pin 4 (P-04 Omnichannel)**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P0 Pin 4: Write copy + publish P-04 Omnichannel Pin |
| Description | Write Pin copy. Generate UTM URL. Validate with Rich Pins Validator. Upload to Pinterest, select board "Omnichannel Retail", schedule for Day 2. See guide Sections 4 P-04 and 11. |
| Priority | High |
| Due Date | [Day 2] |
| Assigned To | [Marketing] |

**P0: Pin Copy + Publish — Pin 5 (P-10 Why Not on Google?)**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P0 Pin 5: Write copy + publish P-10 Why Not on Google Pin |
| Description | Write Pin copy. Generate UTM URL. Validate with Rich Pins Validator. Upload to Pinterest, select board "Get Found on Google", schedule for Day 3. See guide Sections 5 P-10 and 11. |
| Priority | High |
| Due Date | [Day 3] |
| Assigned To | [Marketing] |

**P0: Pin Copy + Publish — Pin 6 (P-06 QR Code Marketing)**

| Field | Value |
|---|---|
| Project | PinTraffix Asset Production |
| Title | P0 Pin 6: Write copy + publish P-06 QR Code Marketing Pin |
| Description | Write Pin copy. Generate UTM URL. Validate with Rich Pins Validator. Upload to Pinterest, select board "QR Code Marketing", schedule for Day 3. See guide Sections 5 P-06 and 11. |
| Priority | High |
| Due Date | [Day 3] |
| Assigned To | [Marketing] |

#### P1 Loops (Priority: Medium, Due: Week 2-3)

Create one design task and one engineering swap task per loop, following the same pattern as P0. Abbreviated templates:

| Task Title | Priority | Due | Assigned To |
|---|---|---|---|
| P-05: Instagram hero + 2 screenshots | Medium | Week 2 | [Designer] |
| P-05: Swap images in features#social-commerce | Medium | Week 2 | [Engineer] |
| P-06: QR grid + 2 examples | Medium | Week 2 | [Designer] |
| P-06: Update pinCampaigns.ts with QR image | Medium | Week 2 | [Engineer] |
| P-07: Coupon hero + 3 mockups | Medium | Week 2 | [Designer] |
| P-08: Seasonal gift guide + 3 collages | Medium | Week 2 (Oct) | [Designer] |
| P-09: BOPIS hero (or reuse P-03 assets) | Medium | Week 3 | [Designer] |
| P-10: Why-not-Google hero + 2 checklist graphics | Medium | Week 2 | [Designer] |
| P-10: Swap images in google-visibility-checklist page | Medium | Week 2 | [Engineer] |
| P-11: Wholesale hero + 2 screens | Medium | Week 3 | [Designer] |
| P-12: Brand kit hero + 3 collages | Medium | Week 3 | [Designer] |
| P-13: E-commerce hero + 2 checkout flow images | Medium | Week 3 | [Designer] |
| P-13: Swap heroImage in ecommerce page.tsx | Medium | Week 3 | [Engineer] |

#### P2 Loops (Priority: Low, Due: Week 4+)

| Task Title | Priority | Due | Assigned To |
|---|---|---|---|
| P-14: 2 multi-location map visuals | Low | Week 4 | [Designer] |
| P-15: 5 chatbot conversation screenshots | Low | Week 4 | [Designer] |
| P-16: 5 AI product photo before/afters | Low | Week 4 | [Designer] |
| P-17: 5 directory product grids | Low | Week 4 | [Designer] |
| P-18: 5 storefront screenshots (600x900) | Low | Week 4 | [Designer] |
| P-18: Swap placehold.co in examples page.tsx | Low | Week 4 | [Engineer] |
| P-19: 3 funnel diagrams | Low | Week 5 | [Designer] |
| P-20: 1 five-step infographic | Low | Week 5 | [Designer] |
| P-22: 1 comparison table graphic | Low | Week 5 | [Designer] |

### 12.4 Ticket Templates — Engineering Blockers

Create tickets from the project detail page (`/settings/admin/crm/projects/[projectId]` → Tickets tab) for route readiness work that blocks asset production.

**Ticket: Route Not Ready — [Route Name]**

| Field | Value |
|---|---|
| Title | [Loop ID]: Route [route] needs generateMetadata + OG |
| Category | technical |
| Priority | urgent (P0) / high (P1) / medium (P2) |
| Assigned To | [Engineer] |
| Description | Route `[route]` does not have `generateMetadata` with `openGraph` images. Required before Pin publish for loop [Loop ID]. See ASSET_PRODUCTION_USER_GUIDE.md Section 2.2. Acceptance: Pinterest Rich Pins Validator shows unique title, description, and 2:3 hero image for the UTM-tagged URL. |

**Specific tickets to create for P0:**

| Ticket Title | Priority | Description |
|---|---|---|
| P-01: Route /solutions/clover-storefront needs generateMetadata + OG | Urgent | Add `generateMetadata` with `openGraph.images` pointing to `/images/pinterest/p01-clover-storefront-hero.png`. Ensure mobile-first CTA above fold. |
| P-02: Route /solutions/google-visibility needs generateMetadata + OG | Urgent | Add `generateMetadata` with `openGraph.images` pointing to `/images/pinterest/p02-google-visibility-hero.png`. |
| P-03: Route /solutions/deposit-commerce needs generateMetadata + OG | Urgent | Add `generateMetadata` with `openGraph.images` pointing to `/images/pinterest/p03-deposit-commerce-hero.png`. |
| P-04: Route /solutions/omnichannel needs generateMetadata + OG | Urgent | Add `generateMetadata` with `openGraph.images` pointing to `/images/pinterest/p04-omnichannel-hero.png`. |
| P-10: Route /guides/google-visibility-checklist needs generateMetadata + email capture | Urgent | Add `generateMetadata` + gated PDF + email capture form. Email capture must feed CRM with `first_utm_*` fields. |
| P-06: /features#qr needs anchor-level non-generic OG preview | High | Currently `/features` has generic OG. Need anchor-specific preview for `#qr`. |
| P-13: Route /solutions/ecommerce needs generateMetadata + OG | High | Add `generateMetadata` with `openGraph.images` pointing to `/images/pinterest/ecommerce-hero.png`. |

### 12.5 Workflow — How Design and Engineering Use the CRM

**Designer workflow:**
1. Open the PinTraffix project at `/settings/admin/crm/projects/[projectId]`, go to Tasks tab
2. Filter by "Assigned To" = me (or scan the Kanban columns)
3. Click task title to open detail page
4. Read description for creative direction
5. Design assets in Figma
6. Export PNG + WebP to `apps/web/public/images/pinterest/`
7. Change task status to `completed` via inline dropdown on the Kanban board
8. Add internal note: "Assets delivered to `apps/web/public/images/pinterest/` on [date]"
9. The corresponding engineering swap task (separate task) is now unblocked

**Engineer workflow:**
1. Open the PinTraffix project at `/settings/admin/crm/projects/[projectId]`, go to Tasks tab
2. Filter by "Assigned To" = me (or scan the Kanban columns)
3. Find the engineering swap task for the loop
4. Check that the designer's task is `completed` (check the internal note)
5. Update `heroImage` const in `page.tsx` from `placehold.co` to local path
6. Run `pnpm checkweb`
7. Change task status to `completed`
8. Add internal note: "Swap complete. `pnpm checkweb` passes. Ready for Rich Pins validation."

**Marketing workflow:**
1. Open the PinTraffix project, go to Tasks tab
2. Find the Pin publish task
3. Verify both design and engineering tasks are `completed`
4. Generate UTM URL via `buildPinUrl()` from `pinCampaigns.ts`
5. Paste UTM URL into Pinterest Rich Pins Validator
6. If validation passes: upload Pin to Pinterest with copy, board, URL
7. Change task status to `completed`
8. Add internal note: "Pin published on [date]. Pin URL: [URL]. Board: [board name]."

**Blocker workflow (tickets):**
1. Open the PinTraffix project, go to Tickets tab
2. Click the ticket to open its detail page
3. Implement `generateMetadata` + `openGraph` on the route
4. Change ticket status to `resolved`
5. Add reply: "Route ready. Rich Pins validator passes for [URL]."
6. The corresponding design + publish tasks are now unblocked

### 12.6 Kanban Board View

The project detail page at `/settings/admin/crm/projects/[projectId]` displays a 4-column Kanban on the Tasks tab:

```
| Pending          | In Progress      | Completed        | Cancelled |
|------------------|------------------|------------------|-----------|
| P-05: Instagram  | P-01: Clover     | P-03: Deposit    | (empty)   |
|  hero + screens  |  hero + splits   |  hero + flows    |           |
|                  |                  | P-03: Swap       |           |
| P-07: Coupon     | P-02: Google     |  complete        |           |
|  hero + mockups  |  hero + B/A      |                  |           |
|                  |                  |                  |           |
| ...              | ...              | ...              |           |
```

- **Filter by status** using the dropdown at the top right
- **Filter by priority** by visually scanning badge colors (high = orange, medium = amber, low = gray)
- **Overdue tasks** show due date in red
- **Click any task title** to open the detail page with conversation thread, internal notes, and metadata

### 12.7 Conversation Thread Usage

Each task detail page (accessible by clicking a task title from the project Kanban) has a threaded conversation with two input modes:

- **Public message** — visible to all task participants. Use for: design review feedback, creative direction questions, asset delivery confirmations
- **Internal note** — admin-only, dashed amber border. Use for: QA validation results, Rich Pins validator pass/fail, engineering swap confirmation, publish date recording

**Example conversation on a design task:**

> **[Designer]** (public): Started on P-01 hero. Using split-screen layout with Clover dashboard left, storefront right. Will export 4 assets today.
>
> **[Marketing]** (public): Make sure the headline overlay matches the Pin angle exactly: "Turn Your Clover POS Into a Full Online Storefront in 14 Days"
>
> **[Designer]** (public): Updated. Exporting now. All 4 assets delivered to `apps/web/public/images/pinterest/`.
>
> **[Designer]** (internal note): Assets delivered 2026-07-24. Files: p01-clover-storefront-hero.png, clover-split-1.png, clover-split-2.png, clover-split-3.png. WebP versions also exported.

**Example conversation on an engineering swap task:**

> **[Engineer]** (public): Starting swap for clover-storefront page.tsx.
>
> **[Engineer]** (internal note): Swap complete. `pnpm checkweb` passes with zero TS errors. Updated heroImage to `/images/pinterest/p01-clover-storefront-hero.png` and 3 split images. Ready for Rich Pins validation.

**Example conversation on a Pin publish task:**

> **[Marketing]** (public): UTM URL generated: `?utm_source=pinterest&utm_medium=social&utm_campaign=pintraffix-p0&utm_content=p-01-clover-storefront-clover-pos-power-tips&utm_term=clover-pos-apps-and-integrations&ref=pinterest`
>
> **[Marketing]** (internal note): Rich Pins validator passes. Title and description show correctly. 2:3 hero image displays. Pin published 2026-07-24 to board "Clover POS Power Tips". Pin URL: [Pinterest URL].

### 12.8 Activity Log

The CRM automatically logs activities on the project's Activities tab (`/settings/admin/crm/projects/[projectId]` → Activities tab):

- Task created
- Task status changed (from X to Y)
- Task assigned to [user]
- Ticket created
- Ticket status changed
- Ticket assigned to [user]
- Message added to task/ticket

This provides a full audit trail of who did what and when — useful for sprint retrospectives and identifying bottlenecks.
