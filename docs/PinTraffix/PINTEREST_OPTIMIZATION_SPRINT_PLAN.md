# Pinterest Optimization Sprint Plan

## Source

Derived from `docs/PinTraffix/VISIBLE_SHELF_PINTEREST_OFFER_ANALYSIS_OPTIMIZED.md`.

## Goal

Execute the destination-readiness and content-production recommendations from the merged Pinterest analysis in a sequenced, testable way. Publish the first P0 Pins only after the surfaces they land on are message-matched, Pinnable, and trackable.

## Guiding principle

**No traffic before the destination is ready.** The first two sprints are about engineering and design readiness. The last two sprints are about content production, launch, and iteration.

---

## Sprint 0 — Pre-Flight (3 days)

### Objective

Confirm scope, assign ownership, set up tracking, and document existing metadata gaps.

| Day | Task | Owner | Acceptance |
|---|---|---|---|
| 0.1 | Audit every public route for `generateMetadata` / `openGraph` / `'use client'` status | Engineering Lead | Spreadsheet of all public routes with readiness score |
| 0.2 | Document current UTM/ref capture in signup and trial flows | Growth / Product | List of params captured and stored on user/tenant |
| 0.3 | Set up Pinterest Business account, tag, and claim domain | Marketing | Domain claimed, tag deployed on key routes |
| 0.4 | Confirm tier trial CTA and first-run experience for each target tier | Product | Trial maps match P0/P1 Pin promises |
| 0.5 | Lock visual asset list and design templates | Design | Figma templates for 2:3, 1:1, and 1.91:1 OG/Pin images |

### Deliverable

**Sprint 0 Readiness Document** — route audit, tracking plan, and design system.

---

## Sprint 1 — Destination Foundation (Week 1)

### Objective

Make existing surfaces Pinnable and set up analytics. No new routes yet; just fix what already exists.

### Priority 0 backlog

| Rank | Task | Route / Surface | Owner | Acceptance |
|---|---|---|---|---|
| 1 | Add `generateMetadata` + `openGraph` + `twitter:image` to `/features` | `/features` | Engineering | Link preview renders title, description, and 2:3 hero image |
| 2 | Add per-feature anchor metadata fallback or section OG images | `/features#{anchor}` | Engineering | Each anchor link produces a non-generic preview |
| 3 | Convert `/` marketing shell to server-rendered landing with `generateMetadata` | `/` | Engineering | `/` emits unique OG title, description, hero image, CTA |
| 4 | Add `generateMetadata` + `LocalBusiness` schema to `/directory/[slug]` | `/directory/[slug]` | Engineering | Store URL shows name, city, description, and logo/photo preview |
| 5 | Add category/state `generateMetadata` to `/directory`, `/directory/stores`, `/directory/categories` | `/directory/*` | Engineering | Category pages show relevant OG title and image |
| 6 | Implement `?ref=pinterest` + UTM capture on all public CTAs and signups | All public CTAs | Engineering | `ref`, `utm_source`, `utm_campaign`, `utm_content` stored with signup/visit |
| 7 | Add Pinterest Save button to `/products/[id]` | `/products/[id]` | Engineering | Button visible; clicking opens Pinterest save modal with correct image |
| 8 | Add Pinterest Save button to `/tenant/[id]` product grid | `/tenant/[id]` | Engineering | Save button appears on product cards |
| 9 | Standardize first OG image = primary product image on `/products/[id]` | `/products/[id]` | Engineering | First `og:image` is the product's first gallery image |
| 10 | Add `og:type=product` + price / availability tags where supported | `/products/[id]` | Engineering | Rich Pins can pick up price, availability, currency |

### Definition of done for Sprint 1

- Every public surface has a unique, non-empty link preview on Pinterest's own Rich Pins validator.
- `?ref=pinterest` and UTM params are captured at signup and attached to trial attribution.
- `/` and `/features` no longer return generic previews.
- Product and tenant pages include Pinterest Save UI.

---

## Sprint 2 — Message-Matched Landing Routes (Week 2)

### Objective

Build the dedicated `/solutions/*` and `/guides/*` pages that P0/P1 loops promise in their destinations. These are conversion-first landing pages, not generic marketing pages.

### Priority 0 backlog

| Rank | New Route | Loop(s) Served | Owner | Must Include |
|---|---|---|---|---|
| 1 | `/solutions/clover-storefront` | P-01 Clover POS Storefront | Engineering + Design | Clover sync screenshot, how-it-works steps, Storefront tier CTA, `?ref=pinterest` |
| 2 | `/solutions/deposit-commerce` | P-03 Deposit / BOPIS, P-09 BOPIS Setup | Engineering + Design | Reserve flow demo, deposit FAQ, Commitment tier CTA, foot-traffic proof |
| 3 | `/solutions/google-visibility` | P-02 Google Visibility Seeker | Engineering + Design | Before/after Google mockups, Discovery tier CTA, GBP + Google Shopping narrative |
| 4 | `/solutions/omnichannel` | P-04 Omnichannel Choice | Engineering + Design | Split-path visual, Omnichannel tier CTA, comparison of deposit vs. full-pay |
| 5 | `/solutions/ecommerce` | P-13 E-commerce Clean Checkout | Engineering + Design | Full checkout demo, E-commerce tier CTA, shipping/delivery example |
| 6 | `/guides/google-visibility-checklist` | P-10 Why Not on Google? | Engineering + Content | Gated PDF guide, email capture, Discovery trial CTA |
| 7 | `/compare/clover-vs-shopify` | P-22 Do I Need Shopify? | Engineering + Content | Comparison table, E-commerce / Omnichannel CTA |
| 8 | `/examples` | P-18 Storefront Examples | Engineering + Design | 3–5 example storefronts, each with shareable OG image, Storefront tier CTA |

### Design requirements for each route

- 2:3 Pinterest OG hero image (1200×1800 or 1000×1500).
- Mobile-first CTA above the fold on 375px.
- Headline matches the P0 Pin angle exactly.
- Single primary CTA, secondary CTA only after scroll.
- UTM/ref capture on all buttons and the main form.

### Definition of done for Sprint 2

- All 8 routes exist, emit `generateMetadata` and `openGraph`, and pass Pinterest Rich Pins validator.
- Each route headline matches its assigned loop's Pin angle.
- Each route has a visible CTA without scroll on mobile.
- Analytics capture `ref=pinterest` and full UTM on signup.

---

## Sprint 3 — Visual Assets + Pin Production (Week 3)

### Objective

Produce the visual assets and write/design the first 6 P0 Pins.

### Visual asset production

| Asset | Quantity | Owner | Used In |
|---|---|---|---|
| Clover + storefront split screens | 3 | Design | P-01, P-09 |
| Google before/after mockups | 3 | Design | P-02, P-10 |
| Deposit/reserve flow diagram | 2 | Design | P-03, P-09 |
| Omnichannel split-path mockup | 2 | Design | P-04 |
| Styled QR code grids | 2 | Design | P-06 |
| Branded Pinterest hero (2:3) per solution | 8 | Design | All 8 landing routes |
| Merchant example storefront screenshots | 5 | Design | P-18, `/examples` |

### First 6 Pins to produce

| # | Loop | Pin Headline | Destination | Board | Owner |
|---|---|---|---|---|---|
| 1 | P-03 | "Stop losing sales to 'I'll come back later' — take a deposit now" | `/solutions/deposit-commerce` | Local Retail Growth | Marketing |
| 2 | P-01 | "Turn your Clover POS into a full online storefront in 14 days" | `/solutions/clover-storefront` | Clover POS Power Tips | Marketing |
| 3 | P-02 | "Get your local store on Google without hiring an agency" | `/solutions/google-visibility` | Get Found on Google | Marketing |
| 4 | P-04 | "Let customers choose: pay in full or reserve for pickup" | `/solutions/omnichannel` | Omnichannel Retail | Marketing |
| 5 | P-10 | "The 3 reasons local products never show up on Google" | `/guides/google-visibility-checklist` | Get Found on Google | Marketing |
| 6 | P-06 | "Create branded QR codes with your store logo — track every scan" | `/features#qr` | QR Code Marketing | Marketing |

### Copy requirements per Pin

- Keyword-rich title (max 100 chars).
- Description with search phrase, value, CTA, and 2–5 hashtags.
- Alt text describing the visual and the search phrase.
- Link with full UTM string.
- Board name and section aligned to the keyword ladder.

### Definition of done for Sprint 3

- 6 Pins are designed, approved, and loaded into Pinterest scheduler/draft queue.
- Each Pin's destination URL passes the Rich Pin validator.
- UTM tags are unique per Pin and tracked in the analytics plan.
- All required visual assets are exported and named by loop ID.

---

## Sprint 4 — Launch, Test, and Iterate (Week 4)

### Objective

Publish the first 6 Pins, begin monitoring, run the first optimization pass, and prepare the handoff to the next priority social platform (Meta/Instagram) using the winning P0 creative.

### Launch checklist

| Day | Action | Owner |
|---|---|---|
| 1 | Publish 2 Pins (P-03, P-01) | Marketing |
| 2 | Publish 2 Pins (P-02, P-04) | Marketing |
| 3 | Publish 2 Pins (P-10, P-06) | Marketing |
| 4 | QA live Pin previews on mobile Pinterest app | Engineering + Marketing |
| 5 | Review first 72-hour metrics: impressions, closeups, outbound clicks | Growth |
| 6 | Repair any weak Pin angles or destination mismatches | Marketing + Design |
| 7 | Plan next 6 P1 Pins, schedule 14-day review, and kick off Meta/Instagram enablement | Marketing + Product + Growth |

### Metrics to watch

- Impressions per Pin
- Closeup rate (creative relevance)
- Outbound clicks per Pin
- Landing page visits by UTM content
- Trial starts by loop ID
- Trial-to-paid conversion by source

### Decision gates at 7 days

| If... | Then... |
|---|---|
| Outbound click rate < 1% | Rewrite Pin headline/description or swap visual |
| High clicks but no trial starts | Fix destination headline/CTA match |
| High trials but low paid conversion | Review trial onboarding and first-run value |
| One board outperforms by 2x | Double Pin volume for that board next sprint |

### Next-platform transition enablement (Meta/Instagram)

If Pinterest P0 validates the creative, the next priority social platform is **Meta (Instagram/Facebook)**. It combines Pinterest-style visual discovery with a larger SMB owner audience and stronger direct-response ad tools, making it the right place to scale before testing LinkedIn or Google.

| Task | Owner | Deliverable |
|---|---|---|
| Select the top 2 Pinterest Pin angles to adapt for Reels / carousels | Marketing | Creative brief |
| Create `utm_source=instagram` and `utm_source=facebook` landing-page URL variants | Growth | URL matrix |
| Confirm Meta pixel / Conversions API event coverage on trial CTAs | Engineering | Pixel QA checklist |
| Export top 6 Pin visuals in 1:1 and 4:5 formats for Meta feed | Design | Asset folder |
| Draft 3 organic captions and 2 paid copy variations per winning angle | Marketing | Copy doc |

### Definition of done for Sprint 4

- 6 Pins are live on Pinterest.
- Analytics dashboard shows UTM-attributed visits and signups.
- 7-day review notes and 14-day review meeting are scheduled.
- P1 backlog for Week 5/6 is prioritized.
- Meta/Instagram transition pack is ready for Week 5: top 2 Pin angles selected, `utm_source=instagram` and `utm_source=facebook` URL variants prepared, Meta pixel/CTA events confirmed, visuals exported in 1:1 and 4:5, and draft copy exists.

---

## Prioritized Optimization Backlog (Beyond Sprint 4)

### Engineering

| # | Task | Priority | Serves |
|---|---|---|---|
| 1 | `/solutions/*` route build (7 pages) | P0 | P0 loops |
| 2 | `/features` metadata + anchor OG | P0 | P-06, P-07, P-15, P-16, P-19 |
| 3 | `/` split into public landing + authenticated dashboard | P0 | All traffic |
| 4 | `/directory/[slug]` metadata + `LocalBusiness` schema | P0 | P-17, P-08 |
| 5 | `/products/[id]` Rich Pin / `og:type=product` tags | P0 | Shoppable Pins |
| 6 | `/tenant/[id]` 2:3 hero OG generation | P0 | Store-level Pins |
| 7 | UTM/ref capture and attribution | P0 | All loops |
| 8 | Pinterest Save buttons on product/tenant | P1 | Organic sharing |
| 9 | Category-level OG for `/directory/categories` | P1 | P-08, P-17 |
| 10 | Mobile-first CTA pass on all landing pages | P1 | Conversion |

### Marketing

| # | Task | Priority | Serves |
|---|---|---|---|
| 1 | Publish P0 6-Pin test | P0 | Validate loops |
| 2 | Build 10 keyword ladders | P0 | Research routine |
| 3 | Create 12 Pinterest boards | P0 | Content organization |
| 4 | Write and schedule P1 Pins (P-05, P-07, P-09, P-10) | P1 | Week 5/6 |
| 5 | Seasonal P-08 board and Pin production | P1 | October launch |
| 6 | Weekly research routine | P2 | Long-term engine |

### Design

| # | Task | Priority | Serves |
|---|---|---|---|
| 1 | 2:3 OG hero templates for 8 solution pages | P0 | Link previews |
| 2 | 57 visual assets from asset list | P1 | 8-week content pipeline |
| 3 | Pin templates in brand system | P1 | Consistent production |
| 4 | Mobile CTA and preview mockups | P1 | Design QA |

---

## Risk & Blockers

| Risk | Mitigation | Sprint |
|---|---|---|
| `/` cannot be split in one week | Use interim `metadata` export from a parallel layout or build `/landing` and redirect 10% traffic | 1 |
| `/features` is a client component | Refactor `metadata` into a server layout or route segments first, then design | 1 |
| No Pinterest Rich Pins validator pass | Test each URL before publish day; keep a staging checklist | 3 |
| Trial conversion low from Pinterest | Ensure first-run CTA matches Pin promise by tier | 0 |
| Visual asset bottleneck | Produce only the 6 P0 assets first; defer full 57 until P1 | 3 |

---

## Success metrics by the end of Sprint 4

- **0** public P0 landing pages with missing or generic previews.
- **6** Pins live, each with unique UTM content.
- **≥500** Pinterest-driven landing page visits (combined) by day 14.
- **≥10** trial starts attributed to `utm_source=pinterest` by day 14.
- **1** 14-day review meeting completed with a ranked list of loops to scale.

---

## Step-by-step getting started guide

Use this checklist to launch the first Pinterest optimization sprint from a clean baseline.

1. **Confirm goals and roles**
   - Define the primary KPI (trial starts, paid conversions, or directory traffic).
   - Assign owners for Engineering, Marketing, Design, and Growth.
2. **Run the Sprint 0 audit**
   - Audit `/solutions/*`, `/features`, `/products/[id]`, `/tenant/[id]`, and `/directory/[slug]` for OG/Twitter metadata, 2:3 hero images, and UTM capture.
   - Record gaps in a shared sheet.
3. **Set up UTM and tracking**
   - Verify `useUTM` and `mergeUTMIntoHref` are on every public CTA.
   - Add `NEXT_PUBLIC_META_PIXEL_ID` if Meta/Instagram is in the roadmap.
   - Confirm `UTMTracker` is mounted in the client root layout.
4. **Produce and validate P0 assets**
   - Design creates the six 2:3 hero images listed in `SPRINT_3_ASSET_MANIFEST.md`.
   - Engineering swaps placeholder images and runs `pnpm checkweb`.
5. **Publish the first 6 Pins**
   - Marketing uses `buildCampaignUrl()` or `buildPinUrl()` to generate the exact destination URL for each Pin.
   - QA validates live previews on mobile Pinterest app before scheduling.
6. **Monitor and iterate**
   - Review the Sprint 4 metrics at 72 hours and 7 days.
   - Use the decision gates to rewrite headlines, swap visuals, or fix CTA mismatch.

## Email marketing funnel alignment

Email is not a Pinterest-only channel, but it is critical to the conversion pipeline after the click.

- **Capture:** Each `/solutions/*` and `/guides/*` landing page should offer an email lead magnet (e.g. Google Visibility Checklist PDF) that feeds the CRM. This extends the Pinterest click into an owned audience.
- **Nurture:** A 5-email onboarding sequence should reference the original Pin promise and loop ID so the message matches the creative that brought the user in. Pass `utm_content` into the CRM on signup.
- **Conversion:** Abandoned-cart and trial-expiry emails should preserve UTM attribution where possible so Growth can measure full-funnel LTV by source.
- **Activation:** The first-run value emails should mirror the destination CTA from the winning Pin (e.g. "Connect your Clover store" or "Claim your directory listing").

### Recommended email campaigns to align

| Campaign | Trigger | UTM source to use | Goal |
|---|---|---|---|
| Pinterest welcome sequence | Email captured from P0 landing pages | `utm_source=pinterest` | Trial start |
| Pinterest win-back | 7-day non-converter from Pinterest traffic | `utm_source=pinterest&utm_medium=email` | Re-activate |
| Abandoned cart | Cart abandoned by Pinterest-referred shopper | `utm_source=pinterest&utm_medium=email` | Complete purchase |
| Trial-to-paid | Trial user from Pinterest traffic | `utm_source=pinterest&utm_medium=email` | Convert to paid |

### Does the platform need to set this up now?

Not in Sprint 0–4, but it should be **readied in parallel**. The platform already supports abandoned-cart recovery flows and UTM/referral capture, so the engineering work is mostly wiring captured emails into the existing CRM with `utm_source`, `utm_medium`, and `utm_content` preserved. If the current CRM cannot store UTM fields, add them before the first P0 Pin goes live so the 7-day review can attribute trial starts correctly.

---

*End of sprint plan. First executable slice: complete Sprint 0 audit, then begin Sprint 1 engineering.*
