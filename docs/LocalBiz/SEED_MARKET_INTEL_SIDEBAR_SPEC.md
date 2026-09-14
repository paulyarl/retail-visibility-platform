# Seed Market Intel Sidebar — Spec

> PG-powered intelligence sidebar on seed (business) pages.
> Free teaser cards + paid full report (downloadable).
> Main page content stays clean — the sidebar is discoverable, not distracting.

---

## 1. Overview

### 1.1 Problem

The seed audit consumes category intelligence + location intelligence + gold standard and produces a market-aware business audit. The main page content renders the seed's own sentiments (narrative). The raw intelligence — market gaps, category signals, density, competitive landscape, gold standard comparison — has no display surface. Burying it in the "About" section creates a wall of text nobody reads.

### 1.2 Solution

A collapsible sidebar on the seed (business) page that surfaces the intelligence as teaser cards. Each card shows a one-line summary + CTA. Anonymous visitors see teasers with "Unlock" CTAs. Paid/owner users see the full content and can download a PDF report.

### 1.3 Design principles

- **Page flow is sacred.** The main content (About, Market Position, Strengths, FAQ) reads top to bottom without interruption. The sidebar is there but not demanding attention.
- **Intelligence is discoverable, not forced.** The interested party (investor, competitor, owner) sees the sidebar and digs in. The casual shopper never notices it.
- **Conversion is contextual.** The paywall appears when someone clicks "Unlock" — they've already signaled intent. Warmer than a banner.
- **The claim path is natural.** "Claim This Business" sits alongside the intel options. An owner who sees "3 growth opportunities identified" and can't unlock has a strong incentive to claim.

---

## 2. Architecture

### 2.1 Surface model

```
SEED PAGE
├── MAIN CONTENT (page flow — the narrative)
│   ├── About (seed's own sentiment — who this business is)
│   ├── Market Position (seed's own sentiment — where they fit)
│   ├── Strengths (seed's own sentiment — what they do well)
│   └── FAQ (seed's own sentiment — shopper questions)
│
└── SIDEBAR (collapsible — the intelligence)
    ├── Growth Opportunities (teaser → paid)
    ├── How It Stacks Up (teaser → paid)
    ├── Full Audit Report (teaser → paid + download)
    └── Claim This Business (CTA → claim flow)
```

### 2.2 Data flow

```
PG WORKFLOW (3 stages):
  1. Location enrichment → persists location intelligence (context JSONB)
  2. Category enrichment → persists category intelligence (context JSONB)
  3. Seed/business audit → consumes both + gold standard → produces audit output

SEED PAGE LOAD:
  1. Fetch business listing (existing)
  2. Fetch seed audit output (existing — the main content source)
  3. Fetch market intel summary (NEW — sidebar teaser data)
     → reads from: audit output + category context + location context
     → returns: teaser summaries + unlock state

SIDEBAR EXPAND:
  1. User clicks "Market Intel" tab/chevron
  2. Sidebar slides out / accordion opens
  3. Teaser cards render from the summary data already loaded

UNLOCK CLICK:
  1. User clicks "Unlock →" on a card
  2. Paywall / signup / login gate
  3. On success: full content renders + download button appears
```

### 2.3 Audience tiers

```
ANONYMOUS (no login):
  Sees: teaser cards with one-line summaries
  CTA: "Unlock →" (signup or pay)
  Gets: nothing beyond the teaser line

LOGGED-IN SHOPPER (free account):
  Sees: teaser cards + partial content (top 2-3 items per card)
  CTA: "Unlock Full Report →" (paywall)
  Gets: enough to evaluate, not enough to act

PAID / OWNER (paywall passed or claimed business):
  Sees: full content for all cards
  CTA: "Download PDF Report"
  Gets: complete intelligence + downloadable artifact
```

---

## 3. Sidebar cards

### 3.1 Card: Growth Opportunities

**Source data:**
- `locationContext.market_gaps` — categories with unmet demand in this city
- `categoryContext.category_signals` — signals this business is NOT meeting
- `goldStandard` — benchmark gaps (what the best businesses do that this one doesn't)
- `auditOutput.opportunities` — if the audit produces structured opportunities

**Teaser (anonymous):**
```
┌─────────────────────────────┐
│ 📈 Growth Opportunities       │
│                              │
│ 3 actionable gaps identified │
│                              │
│ [Unlock →]                   │
└─────────────────────────────┘
```

**Partial (free account):**
```
┌─────────────────────────────┐
│ 📈 Growth Opportunities       │
│                              │
│ ✓ No website — missing       │
│   online discovery            │
│ ✓ Limited hours coverage     │
│ ✗ 1 more opportunity          │
│                              │
│ [Unlock Full Report →]       │
└─────────────────────────────┘
```

**Full (paid/owner):**
```
┌─────────────────────────────┐
│ 📈 Growth Opportunities       │
│                              │
│ 1. No website — missing       │
│    online discovery for       │
│    online-first shoppers.    │
│    Impact: HIGH               │
│                                │
│ 2. Limited hours coverage —  │
│    closes before 7pm,        │
│    category benchmark shows   │
│    8pm+ common.               │
│    Impact: MEDIUM             │
│                                │
│ 3. South side demand unmet —  │
│    market gap identified,     │
│    no dedicated stores in     │
│    this corridor.             │
│    Impact: HIGH               │
│                              │
│ [Download PDF Report]        │
└─────────────────────────────┘
```

### 3.2 Card: How It Stacks Up

**Source data:**
- `categoryContext.category_signals` — checklist (met vs unmet)
- `goldStandard` — benchmark comparison
- `categoryContext.market_density` — density context
- `auditOutput.strengths` / `auditOutput.weaknesses` — if structured

**Teaser (anonymous):**
```
┌─────────────────────────────┐
│ ⚖️ How It Stacks Up           │
│                              │
│ Meets 4 of 6 category        │
│ signals                       │
│                              │
│ [Unlock →]                   │
└─────────────────────────────┘
```

**Partial (free account):**
```
┌─────────────────────────────┐
│ ⚖️ How It Stacks Up           │
│                              │
│ ✓ Published hours             │
│ ✓ Clear category positioning │
│ ✓ Community presence          │
│ ✓ NAP consistency             │
│ ✗ No website                  │
│ ✗ Below review volume        │
│                              │
│ [Unlock Full Report →]       │
└─────────────────────────────┘
```

**Full (paid/owner):**
```
┌─────────────────────────────┐
│ ⚖️ How It Stacks Up           │
│                              │
│ Category signals: 4 of 6 met │
│ (see checklist above)         │
│                              │
│ Gold standard alignment:     │
│ Above benchmark: community   │
│   engagement, category       │
│   positioning                 │
│ Below benchmark: online      │
│   presence, review volume     │
│                              │
│ Market density: sparse —     │
│ one of 3 dedicated stores in │
│ the city. Low competition,   │
│ high opportunity.            │
│                              │
│ [Download PDF Report]        │
└─────────────────────────────┘
```

### 3.3 Card: Full Audit Report

**Source data:** All of the above + the complete audit output.

**Teaser (anonymous):**
```
┌─────────────────────────────┐
│ 📋 Full Audit Report          │
│                              │
│ Complete market analysis     │
│ with recommendations         │
│                              │
│ [Unlock →]                   │
└─────────────────────────────┘
```

**Full (paid/owner):**
```
┌─────────────────────────────┐
│ 📋 Full Audit Report          │
│                              │
│ Includes:                     │
│ • Market position analysis   │
│ • Category signal checklist │
│ • Gold standard comparison  │
│ • Growth opportunities       │
│ • Market gap mapping        │
│ • Metro dynamics             │
│ • Recommendations            │
│                              │
│ [Download PDF Report]        │
└─────────────────────────────┘
```

### 3.4 Card: Claim This Business

**Source data:** Existing claim flow.

**All audiences:**
```
┌─────────────────────────────┐
│ 🔑 Claim This Business       │
│                              │
│ Owner? Get the full picture  │
│ and unlock all intelligence  │
│ for free.                     │
│                              │
│ [Verify Ownership →]         │
└─────────────────────────────┘
```

This card always shows. The claim flow is the owner's path to full access without paying. It reuses the existing `DirectoryClaimPublicService` and token-based claim flow.

---

## 4. API endpoints

### 4.1 Public teaser endpoint (no auth)

```
GET /api/public/place/:slug/market-intel/summary
```

Returns teaser data for the sidebar. No authentication required.

**Response:**
```json
{
  "businessSlug": "african-grocery-indianapolis",
  "businessName": "African Grocery Store",
  "hasAudit": true,
  "cards": {
    "growthOpportunities": {
      "available": true,
      "teaser": "3 actionable gaps identified",
      "count": 3
    },
    "howItStacksUp": {
      "available": true,
      "teaser": "Meets 4 of 6 category signals",
      "signalsMet": 4,
      "signalsTotal": 6
    },
    "fullReport": {
      "available": true,
      "teaser": "Complete market analysis with recommendations"
    },
    "claimBusiness": {
      "available": true,
      "teaser": "Owner? Get the full picture and unlock all intelligence for free.",
      "claimTokenUrl": "/directory/claim/:token"
    }
  }
}
```

### 4.2 Partial content endpoint (free account)

```
GET /api/customer/place/:slug/market-intel/partial
Authorization: Bearer <customer JWT>
```

Returns partial content for logged-in shoppers. Top 2-3 items per card.

**Response:**
```json
{
  "growthOpportunities": {
    "items": [
      { "title": "No website — missing online discovery", "impact": "HIGH", "locked": false },
      { "title": "Limited hours coverage", "impact": "MEDIUM", "locked": false }
    ],
    "lockedCount": 1
  },
  "howItStacksUp": {
    "signals": [
      { "signal": "Published hours", "met": true },
      { "signal": "Clear category positioning", "met": true },
      { "signal": "Community presence", "met": true },
      { "signal": "NAP consistency", "met": true },
      { "signal": "No website", "met": false },
      { "signal": "Below review volume", "met": false }
    ]
  }
}
```

### 4.3 Full content endpoint (paid/owner)

```
GET /api/customer/place/:slug/market-intel/full
Authorization: Bearer <customer JWT>
```

Requires: paid subscription OR claimed business ownership.

**Response:** Full content for all cards (see §3 card definitions).

### 4.4 PDF download endpoint (paid/owner)

```
GET /api/customer/place/:slug/market-intel/report.pdf
Authorization: Bearer <customer JWT>
```

Returns: PDF report (see §5). Content-Type: `application/pdf`.

---

## 5. PDF report structure

### 5.1 Report sections

```
VisibleShelf Market Intelligence Report
{Business Name} — {City}, {State}
Generated: {date}

1. Executive Summary
   - One-paragraph overview of the business's market position

2. Market Position
   - Category: {category name} in {city}, {state}
   - Market density: {qualitative density from category context}
   - City profile: {metro_description, major_industries, growth_trajectory}
   - Metro dynamics: {nearby cities + character}

3. Category Signals Checklist
   - Met signals (with checkmarks)
   - Unmet signals (with impact assessment)

4. Gold Standard Comparison
   - Above benchmark: {list}
   - Below benchmark: {list}
   - Overall alignment: {qualitative}

5. Growth Opportunities
   - Each opportunity: title, description, impact level
   - Ranked by impact (HIGH → MEDIUM → LOW)

6. Market Gaps
   - Unmet demand in this city (from location context)
   - Relevance to this business

7. Recommendations
   - Prioritized action items
   - Expected impact per action

8. Appendix: Market Context
   - Category summary (analyst-facing)
   - City market summary (analyst-facing)
   - Metro dynamics table
```

### 5.2 PDF generation

Reuses the existing `MarketingReceiptPdfService` pattern (PDFKit-based). New service: `MarketIntelReportPdfService`.

```
apps/api/src/services/marketing/MarketIntelReportPdfService.ts
```

Input: business slug + full market intel data.
Output: PDF buffer.

---

## 6. Paywall + access control

### 6.1 Access tiers

```
Tier 0 — Anonymous:
  Sees: teaser summaries only
  CTA: signup or pay

Tier 1 — Free account (logged-in shopper):
  Sees: partial content (top 2-3 items per card)
  CTA: unlock full report

Tier 2 — Paid subscriber:
  Sees: full content + PDF download
  No CTA — already unlocked

Tier 3 — Claimed business owner:
  Sees: full content + PDF download (free — they claimed)
  Additional: management tools (existing claim flow)
```

### 6.2 Paywall flow

```
User clicks "Unlock →"
  ↓
Check: logged in?
  No  → redirect to signup/login with returnTo
  Yes → check: paid or owner?
    No  → show paywall (price + checkout)
    Yes → render full content
```

### 6.3 Pricing (placeholder — product decision)

```
Single report unlock:  $X  (one-time, per business)
Subscription:          $Y/mo (unlimited reports)
Owner claim:           FREE (verify ownership → full access)
```

### 6.4 Integration with existing systems

- **Checkout:** Reuses `SubscriptionBillingService.createOneTimePaymentIntent` (existing)
- **Claim flow:** Reuses `DirectoryClaimPublicService` (existing)
- **Customer portal:** Report purchases appear in the existing portal purchase history
- **Branding:** Reuses per-customer branding (migration 162) for PDF reports

---

## 7. Frontend components

### 7.1 Component tree

```
PlaceEntryPage (existing)
├── PlaceEntryEditorialLayout (existing — main content)
│   ├── About
│   ├── Market Position
│   ├── Strengths
│   └── FAQ
│
└── MarketIntelSidebar (NEW)
    ├── SidebarToggle (chevron / "Market Intel" tab)
    ├── SidebarPanel (collapsible)
    │   ├── GrowthOpportunitiesCard
    │   ├── HowItStacksUpCard
    │   ├── FullReportCard
    │   └── ClaimBusinessCard
    └── PaywallModal (on unlock click)
```

### 7.2 File locations

```
apps/web/src/components/place/MarketIntelSidebar.tsx        — sidebar container
apps/web/src/components/place/MarketIntelCard.tsx           — reusable card shell
apps/web/src/components/place/MarketIntelPaywall.tsx       — paywall modal
apps/web/src/services/MarketIntelPublicService.ts           — teaser endpoint client
apps/web/src/services/MarketIntelCustomerService.ts         — partial/full endpoint client
```

### 7.3 Responsive behavior

```
Desktop:
  Sidebar fixed right, collapsible via chevron
  Main content width adjusts when sidebar opens

Tablet:
  Sidebar slides in from right, overlays content
  Tap outside to close

Mobile:
  Sidebar becomes bottom sheet
  "Market Intel" button fixed bottom-right
  Tap to expand, swipe down to dismiss
```

---

## 8. Backend services

### 8.1 MarketIntelService (new)

```
apps/api/src/services/MarketIntelService.ts
```

Responsibilities:
- `getTeaserSummary(businessSlug)` — returns teaser data (public, no auth)
- `getPartialContent(businessSlug, customerId)` — returns partial content (free account)
- `getFullContent(businessSlug, customerId)` — returns full content (paid/owner)
- `generatePdfReport(businessSlug, customerId)` — returns PDF buffer

Data sources:
- Business listing (existing `PlacesService`)
- Seed audit output (existing — from the audit campaign execution)
- Category context (existing — `directory_category_enrichment` context JSONB)
- Location context (existing — `directory_category_enrichment` context JSONB for `__location__`)
- Gold standard (existing — `GoldStandardProfileService`)
- Access state (new — tracks per-customer unlock state)

### 8.2 Access control

```
apps/api/src/services/MarketIntelAccessService.ts
```

Responsibilities:
- `getAccessTier(customerId, businessSlug)` — returns tier (0/1/2/3)
- `canAccessFull(customerId, businessSlug)` — boolean
- `recordUnlock(customerId, businessSlug, paymentIntentId)` — records purchase
- `isOwner(customerId, businessSlug)` — checks claimed ownership

### 8.3 Routes

```
apps/api/src/routes/market-intel-public.ts
  GET /api/public/place/:slug/market-intel/summary

apps/api/src/routes/market-intel-customer.ts
  GET  /api/customer/place/:slug/market-intel/partial
  GET  /api/customer/place/:slug/market-intel/full
  GET  /api/customer/place/:slug/market-intel/report.pdf
  POST /api/customer/place/:slug/market-intel/unlock  (checkout)
```

---

## 9. Database

### 9.1 New table: market_intel_unlocks

```sql
CREATE TABLE market_intel_unlocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  business_slug   TEXT NOT NULL,
  unlock_type     TEXT NOT NULL CHECK (unlock_type IN ('single_report', 'subscription', 'owner_claim')),
  payment_intent_id TEXT,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,  -- NULL for subscription/owner, set for single_report
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, business_slug, unlock_type)
);
```

### 9.2 Migration

```
database/migrations/285_market_intel_unlocks.sql
```

---

## 10. Implementation phases

### Phase 1 — Teaser sidebar (no paywall)
- `MarketIntelService.getTeaserSummary`
- Public endpoint
- `MarketIntelSidebar` component (teaser cards only)
- "Unlock →" CTAs show "Coming soon"

### Phase 2 — Partial content (free accounts)
- `MarketIntelService.getPartialContent`
- Customer endpoint with JWT auth
- Partial card rendering
- "Unlock Full Report →" CTAs

### Phase 3 — Full content + paywall (paid)
- `MarketIntelService.getFullContent`
- `MarketIntelAccessService`
- `market_intel_unlocks` table + migration
- Checkout integration (`SubscriptionBillingService`)
- Full card rendering + download button

### Phase 4 — PDF report
- `MarketIntelReportPdfService`
- PDF download endpoint
- Per-customer branding on PDF

### Phase 5 — Claim integration
- Owner claim → automatic full access
- "Claim This Business" card wired to existing claim flow
- Claimed owner sees full content without payment

---

## 11. Open questions

1. **Pricing** — single report price? subscription price? free for owners?
2. **Audit output structure** — does the current audit produce structured opportunities/signals, or do we need to parse the audit text? (Need to inspect audit output format)
3. **Teaser count logic** — "3 actionable gaps identified" — where does the count come from? Need structured opportunity count from the audit.
4. **Cache strategy** — teaser data is the same for all anonymous visitors per business. Cache at the CDN or service layer?
5. **SEO** — should teaser content be in the DOM (crawlable) or loaded via JS (not indexed)? Teasers in the DOM could help SEO; full content behind auth is fine.
6. **Competitor view** — should a competitor in the same category be able to buy the report? Or restrict to non-competitors? (Product decision — probably allow, it's revenue)
