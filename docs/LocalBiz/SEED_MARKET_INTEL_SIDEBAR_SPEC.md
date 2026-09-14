# Seed Market Intel Sidebar — Spec

> PG-powered intelligence sidebar on seed (business) pages.
> Free teaser cards + paid full report (downloadable).
> Main page content stays clean — the sidebar is discoverable, not distracting.

---

## 1. Overview

### 1.1 Problem

The seed audit (`business_analysis` output, stored in `mkt_audits_list.audit_data`) consumes category intelligence + location intelligence + gold standard and produces a market-aware business audit. The raw intelligence — market gaps, category signals, density, competitive landscape, gold standard comparison — has no display surface. Burying it in the "About" section creates a wall of text nobody reads.

**Current page state (verified):** `/place/[slug]` renders no audit content today — `GET /api/directory/consolidated/:slug` returns listing fields plus `seo_enrichment` meta (`meta_title`, `schema_type_hint`) only. The main column is a static claim pitch + Location/Contact/Hours + claim inquiry + related stores. The audit's `public_narrative` field (Tier-C-safe by schema contract) is the intended About-section source but is not yet rendered — Phase 1 renders it when present so the sidebar complements a real narrative surface rather than standing alone.

### 1.2 Solution

A collapsible sidebar on the seed (business) page that surfaces the intelligence as teaser cards. Each card shows a one-line summary + CTA. Anonymous visitors see teasers with "Unlock" CTAs. Paid/owner users see the full content and can download a PDF report.

### 1.3 Design principles

- **Page flow is sacred.** The main content (About, Market Position, Strengths, FAQ) reads top to bottom without interruption. The sidebar is there but not demanding attention.
- **Intelligence is discoverable, not forced.** The interested party (investor, competitor, owner) sees the sidebar and digs in. The casual shopper never notices it.
- **Conversion is contextual.** The paywall appears when someone clicks "Unlock" — they've already signaled intent. Warmer than a banner.
- **The claim path is natural.** "Claim This Business" sits alongside the intel options. An owner who sees "3 growth opportunities identified" and can't unlock has a strong incentive to claim.

---

## 2. Architecture

### 2.0 Surfaces

This spec's primary target is the **seed (business) page**. The same
pattern generalizes to **category** and **location** pages, where the
enrichment `context` JSONB is itself the intelligence (no audit needed)
— see §12.

### 2.1 Surface model

```
SEED PAGE (/place/[slug] — sidebar mounts only when
           listing.listing_origin === 'directory_seed')
├── MAIN CONTENT (page flow — the narrative)
│   ├── About (audit public_narrative when present — see §1.1;
│   │         falls back to the existing static claim pitch)
│   ├── Location / Contact / Hours (existing)
│   ├── Claim inquiry form (existing, when no active claim token)
│   └── Related Stores (existing)
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

SEED PAGE LOAD (server-side in page.tsx — the page is already
force-dynamic, so teaser text lands in the DOM for crawlers at
zero cost; resolves the SEO question):
  1. Fetch business listing (existing — GET /api/directory/consolidated/:slug)
  2. Fetch market intel summary (NEW — sidebar teaser data)
     → resolves the seed audit via the slug→audit chain (§8.4)
     → reads from: audit_data + MarketContextLoader(category, city, state)
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

PAID TENANT (report purchased — purchase requires a tenant account):
  Sees: full content for all cards
  CTA: "Download PDF Report"
  Gets: complete intelligence + downloadable artifact

CLAIMED OWNER (verified ownership of this seed):
  Sees: full content for all cards
  CTA: "Download PDF Report" + management tools (existing claim flow)
  Gets: complete intelligence + downloadable artifact, free — they claimed
```

---

## 3. Sidebar cards

### 3.1 Card: Growth Opportunities

**Source data:**
- `audit.market_opportunities` — structured array added by §8.5 (`{title, description, impact: HIGH|MEDIUM|LOW}`); primary source, ranked by impact
- `locationContext.market_gaps` — categories with unmet demand in this city
- `audit.gap_analysis.gaps` — gold-standard benchmark gaps; fallback when `market_opportunities` is absent (`severity: non_negotiable` → HIGH, `recommended` → MEDIUM)
- Teaser `count` = `market_opportunities.length`

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
- `audit.signal_checklist` — structured array added by §8.5: one `{signal, met, evidence}` entry per `category_signals` item, evaluated by the audit for THIS business. The audit performs the evaluation — the frontend never joins signals to evidence itself.
- `categoryContext.category_signals` — the raw signal vocabulary the checklist evaluates (flat `string[]`, no per-business state on its own)
- `audit.gap_analysis` / `audit.quality_gate_results` — gold-standard benchmark comparison
- `categoryContext.market_density` — density context
- Teaser `signalsMet` / `signalsTotal` = `signal_checklist` entries where `met === true` / total entries

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
│ Owner? Claim and unlock your │
│ free audit + market intel —  │
│ already generated.           │
│                              │
│ [Verify Ownership →]         │
└─────────────────────────────┘
```

This card always shows. The claim flow is the owner's path to full access without paying — and the audit they're unlocking **already exists** (every seed flows through the PG business audit; see §13). It reuses the existing `DirectoryClaimPublicService` and token-based claim flow.

- CTA href = `/place/claim/${listing.activeClaimToken}` when a live token exists — `active_claim_token` is already returned by the consolidated listing endpoint; do not mint or fetch a new one. When absent, fall back to `#claim-inquiry` (same as the hero CTA).
- Canonical claim path is `/place/claim/:token`; `/directory/claim/:token` is a legacy redirect.
- The page already has three claim surfaces (hero CTA, `UnclaimedDirectoryBanner`, claim inquiry form). This card exists for the owner reading intel teasers — it reuses existing state rather than adding a fourth mechanism.

---

## 4. API endpoints

### 4.1 Public teaser endpoint (no auth)

```
GET /api/public/place/:slug/market-intel/summary
```

Returns teaser data for the sidebar. No authentication required. May use `optionalCustomerAuth` to attach unlock state when a session exists.

**Response:** (standard `{ success, data }` envelope — `data` payload shown)
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
      "teaser": "Owner? Get the full picture and unlock all intelligence for free."
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
Auth: `requireCustomerAuth` only — any logged-in customer qualifies. Do NOT apply `requirePlatformContext` (the marketing-customer gate): it 403s storefront-only shoppers.

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

Requires: a `market_intel_unlocks` row for (tenant, business_slug) OR claimed ownership of this seed (§8.2).

**Response:** Full content for all cards (see §3 card definitions), `{ success, data }` envelope.

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

Reuses the existing `MarketingReceiptPdfService` pattern (jsPDF-based — it was extracted from the inline jsPDF generator in `marketing-ops-public.ts`; NOT PDFKit). New service: `MarketIntelReportPdfService`.

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

Tier 2 — Paid tenant:
  Sees: full content + PDF download
  No CTA — already unlocked
  Gate: purchase requires a tenant account (customers.linked_user_id →
  user_tenants row). A shopper-only customer is offered tenant
  registration inside the paywall checkout — the report is a
  business/owner product, not a consumer product.

Tier 3 — Claimed business owner:
  Sees: full content + PDF download (free — they claimed)
  Additional: management tools (existing claim flow)
  Resolution: customer → linked_user_id → user_tenants(role='OWNER')
  → seed's tenant_id (§8.2)
```

### 6.2 Paywall flow

```
User clicks "Unlock →"
  ↓
Check: logged in?
  No  → redirect to signup/login with returnTo
  Yes → check: owner of this seed?
    Yes → render full content (free — claim already verified)
    No  → check: tenant account?
      No  → paywall step 1: register/attach a tenant (business) account
      Yes → paywall step 2: price + checkout (one-time PaymentIntent)
            → on success: recordUnlock + marketing_revenue row
```

### 6.3 Pricing (demo defaults — operator-overridable)

```
Single report unlock:  $29  (one-time, per business, permanent)
Owner claim:           FREE (verify ownership → full access)
Subscription:          DEFERRED — no customer/tenant-level report
                       subscription model exists in the schema today
                       (subscription_* tables are tenant/merchant
                       billing). Revisit post-launch.
```

The demo price is read from `platform_settings_list` (operator-overridable
at runtime, no deploy) with a `unifiedConfig` fallback default.

### 6.4 Integration with existing systems

- **Checkout:** Reuses `SubscriptionBillingService.createOneTimePaymentIntent` (existing — accepts `customer` + `setup_future_usage` params from portal checkout Phase 3)
- **Purchase history:** a successful unlock writes a `marketing_revenue` row with `conversion_source = 'market_intel_unlock'` (new `ConversionSource` enum value) so the purchase appears in the existing portal purchase history and gets a receipt. AGENTS.md CHECK-constraint discipline applies — grep `marketing_revenue` for `chk_` constraints covering `conversion_source` and ship a sync migration if present.
- **Claim flow:** Reuses `DirectoryClaimPublicService` + `/place/claim/:token` (canonical; `/directory/claim/:token` is a legacy redirect)
- **Branding:** Reuses per-customer branding (migration 162) for PDF reports

---

## 7. Frontend components

### 7.1 Component tree

```
PlacePageClient (existing — seed pages only)
├── PlaceEntryEditorialLayout (existing — main content)
│   ├── About (audit public_narrative when present — §1.1)
│   ├── Location / Contact / Hours
│   └── Claim inquiry / Related Stores
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

IMPORTANT: `PlaceEntryEditorialLayout` is shared — `retail/[slug]`
renders it too. The sidebar mounts in `PlacePageClient` (not inside
the layout) and is gated on `listing.listingOrigin === 'directory_seed'`.

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
- `getTeaserSummary(surfaceType, surfaceKey)` — returns teaser data (public, no auth). Surface key formats: `place` → business slug; `category` → `{category_key}:{city}:{state}`; `city` → `{city}:{state}` (§12).
- `getPartialContent(surfaceType, surfaceKey, customerId)` — partial content (free account)
- `getFullContent(surfaceType, surfaceKey, customerId)` — full content (paid tenant/owner)
- `generatePdfReport(surfaceType, surfaceKey, customerId)` — surface-aware PDF buffer (§12.5)

Data sources:
- Business listing — `GET /api/directory/consolidated/:slug` (raw-SQL route; there is no `PlacesService`)
- Seed audit output — `mkt_audits_list.audit_data` where `platform='business_analysis'`, resolved via §8.4
- Category + location context — `MarketContextLoader.loadMarketContext(category, city, state)` (existing). It already loads the `directory_category_enrichment` category row + `__location__` row, returns empty objects when enrichment hasn't run, and carries a 5-min in-memory TTL cache — the teaser endpoint sits on that cache (resolves the cache question; no CDN layer at launch). Category key = `dps.category` / `listing.primary_category`; `secondary_categories` do not drive intel.
- Gold standard — `IntelligenceProfileService.resolve()` (existing; there is no `GoldStandardProfileService`)
- Access state — `market_intel_unlocks` (new, §9.1)

### 8.2 Access control

```
apps/api/src/services/MarketIntelAccessService.ts
```

Responsibilities:
- `getAccessTier(customerId, surfaceType, surfaceKey)` — returns tier (0/1/2/3; tier 3 only exists on `place` surfaces)
- `canAccessFull(customerId, surfaceType, surfaceKey)` — boolean
- `recordUnlock(tenantId, customerId, surfaceType, surfaceKey, unlockType, paymentIntentId)` — records purchase (UPSERT on the unique key — re-purchase after refund or manual revocation must not 23505)
- `isOwner(customerId, businessSlug)` — `place` surfaces only. Resolves slug → `directory_presence_seeds.tenant_id` → `user_tenants (role='OWNER')` → `customers.linked_user_id`. NOTE: `CustomerAuthService.resolveOwnedTenantId()` returns the FIRST owned tenant only — write a tenant-scoped variant keyed on the seed's tenant_id; do not reuse it directly (multi-claim owners would get false negatives).
- `resolveTenantForPurchase(customerId)` — returns the customer's tenant (via `linked_user_id` → `user_tenants`) or null; null → paywall step 1 (tenant registration)

### 8.3 Routes

```
apps/api/src/routes/market-intel-public.ts      → mount /api/public/place
  GET /:slug/market-intel/summary

apps/api/src/routes/market-intel-customer.ts    → mount /api/customer/place
  GET  /:slug/market-intel/partial
  GET  /:slug/market-intel/full
  GET  /:slug/market-intel/report.pdf
  POST /:slug/market-intel/unlock  (checkout — tenant required)
```

Both registered in `routeRegistry.ts` (`/api/public/place` → domain `directory`, `/api/customer/place` → domain `customer`, `authLevel: 'public'` — auth handled inside). Customer routes use `requireCustomerAuth` ONLY — do not copy `requirePlatformContext` from `marketing-customer.ts` (it 403s storefront-only shoppers; `/partial` must work for any logged-in customer).

### 8.4 Seed → audit resolution

No existing code path maps a place slug to its audit. Resolution chain:

```
slug → directory_listings_list (slug)
     → directory_presence_seeds (listing_id)
     → directory_seed_campaign_links (seed_id — prefer link_role='primary')
     → mkt_campaigns_list
     → mkt_audits_list WHERE platform = 'business_analysis'
       ORDER BY created_at DESC LIMIT 1
```

`hasAudit` in the teaser response = resolution produced a row with non-null `audit_data`. Cards render `available: false` when audit or enrichment inputs are missing (`MarketContextLoader` returns empty objects — degrade, don't error).

### 8.5 Audit output additions (prerequisite — "the array task")

The `business_analysis` schema has no opportunities array and no per-signal evaluation today. Both sidebar cards need new structured fields:

1. **`business-analysis.schema.ts`** — add to `businessAnalysisSchema`:
   - `market_opportunities`: `array of { title, description, impact: 'HIGH'|'MEDIUM'|'LOW' }` — business-specific, ranked by impact. The audit synthesizes it from `gap_analysis`, relevant `market_gaps`, and `website.conversion_opportunities`.
   - `signal_checklist`: `array of { signal, met, evidence }` — one entry per `category_signals` item when category intelligence was injected; `met` is the audit's verdict against observed evidence.
2. **`BUSINESS_ANALYSIS_PROMPT_SUFFIX`** — document both fields.
3. **`seed-business-audit-v2-templates.ts`** — add both fields to the embedded JSON schema in each variant + a directive that they are populated ONLY when the category/market context bindings ran. Bump `SEED_VERSION_MARKER` and re-run the seed on `local` AND `prd` (AGENTS.md seed discipline — a stale row silently serves the old body).
4. **Fallback until re-audits land:** opportunities count = `gap_analysis.gaps.length` with `severity` mapped to impact; the signal checklist renders `available: false` (teaser copy: "Category signal evaluation pending").

---

## 9. Database

### 9.1 New table: market_intel_unlocks

```sql
CREATE TABLE market_intel_unlocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(255) NOT NULL REFERENCES tenants(id),
  customer_id     VARCHAR(255) NOT NULL REFERENCES customers(id),
  surface_type    TEXT NOT NULL CHECK (surface_type IN ('place', 'category', 'city')),
  surface_key     TEXT NOT NULL,
  unlock_type     TEXT NOT NULL CHECK (unlock_type IN ('single_report', 'subscription', 'owner_claim')),
  payment_intent_id TEXT,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,  -- reserved for future subscription; NULL for single_report/owner_claim
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, surface_type, surface_key, unlock_type)
);
```

- `surface_key` formats: `place` → business slug; `category` → `{category_key}:{city}:{state}` (city `__all__` for national); `city` → `{city}:{state}`. `owner_claim` is only valid on `place` surfaces.
- `tenant_id` is the purchasing entity (§6.1 — must be a tenant to buy); `customer_id` is the auth identity who performed the purchase. Owner-claim unlocks record the seed's tenant_id (claimed owners are tenant owners).
- `recordUnlock` UPSERTs on the unique key — a second purchase or re-claim updates `unlocked_at`/`payment_intent_id` rather than violating the constraint.
- Enable RLS per existing table convention (most tables in this DB are RLS-flagged) with a service-role policy.
- CHECK discipline (AGENTS.md): if `unlock_type` ever gains values, ship a numbered migration dropping + re-adding the CHECK.

### 9.2 Migration

```
database/migrations/285_market_intel_unlocks.sql
```

---

## 10. Implementation phases

### Phase 0 — Audit output prerequisites
- §8.5: `business_analysis` schema + prompt suffix + seed template changes; bump `SEED_VERSION_MARKER`; re-run `seed-business-audit-v2-templates.ts` on `local` and `prd`
- §8.4: slug→audit resolver

### Phase 1 — Teaser sidebar (no paywall)
- `MarketIntelService.getTeaserSummary` (with §8.5.4 fallback derivation until re-audits exist)
- Public endpoint
- `MarketIntelSidebar` component (teaser cards only)
- Render `audit.public_narrative` as the About section when present (§1.1)
- "Unlock →" CTAs show "Coming soon"

### Phase 2 — Partial content (free accounts)
- `MarketIntelService.getPartialContent`
- Customer endpoint with JWT auth
- Partial card rendering
- "Unlock Full Report →" CTAs

### Phase 3 — Full content + paywall (paid tenant)
- `MarketIntelService.getFullContent`
- `MarketIntelAccessService` — INCLUDING `isOwner` (moved up from Phase 5: the Claim card ships in Phase 1, so a claimed owner must never hit a paywall between phases)
- `market_intel_unlocks` table + migration
- Checkout integration (`SubscriptionBillingService` — tenant required, §6.1)
- `marketing_revenue` row + `market_intel_unlock` conversion source
- Full card rendering + download button

### Phase 4 — PDF report
- `MarketIntelReportPdfService`
- PDF download endpoint
- Per-customer branding on PDF

### Phase 5 — Claim integration polish
- Claim completion writes an `owner_claim` unlock row automatically
- "Claim This Business" card already live since Phase 1 — verify claimed owners see full content (`isOwner` landed in Phase 3)

### Phase 6 — Category & location surfaces (§12)
- §12.2 context split on the two enrichment endpoints (breaking response change — verify consumers)
- Category + city intel resolvers (no audit chain — the enrichment context IS the intel)
- Surface-generalized endpoints + `MarketIntelSidebar` mount on category/city pages
- Surface-aware PDF variants (§12.5)
- "Add Your Business" card wired to the existing lead-gen endpoint

---

## 11. Resolved decisions (formerly open questions)

1. **Pricing** — demo default: $29 single-report, permanent, per business; operator-overridable via `platform_settings_list` (unifiedConfig fallback). Owner claim free. Subscription deferred — no customer/tenant report-subscription model exists.
2. **Audit output structure** — `business_analysis` has no `opportunities`/`signal_checklist` arrays today; §8.5 adds both to the schema, prompt suffix, and seed template.
3. **Teaser count logic** — `market_opportunities.length`; fallback `gap_analysis.gaps.length` until re-audits land (§8.5.4).
4. **Cache strategy** — sit on `MarketContextLoader`'s existing 5-min TTL; no CDN layer at launch. Teaser endpoint may add `Cache-Control: public, max-age=300`.
5. **SEO** — teasers are server-rendered in `page.tsx` (the page is already `force-dynamic`), so they're crawlable DOM content. Full content stays behind auth.
6. **Competitor view** — allowed (revenue). The tenant requirement means competitors purchase under a business identity, keeping the purchase history/audit trail meaningful.

---

## 12. Surface generalization — category & location pages

The seed page is the primary surface, but the same context-aware sidebar
pattern applies to category and location pages — where the enrichment
`context` JSONB **is** the intelligence. No audit, no claim flow, no new
schema fields needed. These surfaces are cheaper than the seed surface
and can ship in parallel with Phase 2+.

### 12.1 Surface matrix

| Surface | Page | Intel source | Audit needed? | Owner tier? |
|---|---|---|---|---|
| `place` (seed) | `/place/[slug]` | `audit_data` + category + location context (`MarketContextLoader`) | Yes — §8.4, §8.5 | Yes — claim card |
| `category` | `/place/category/[categorySlug]?city&state`, `/directory/categories/[categorySlug]` (national) | The page's own category enrichment `context` | No | No |
| `city` | `/place/city/[citySlug]`, `/directory/location/[location]` | The page's own `__location__` enrichment `context` | No | No |

Fetch status today:
- Category page already fetches its packet via `getCategoryEnrichment`
  (city-scoped when `?city&state` present, else the `__all__` national
  packet) — the intel is already in the client.
- `/directory/location/[location]` already fetches `getLocationEnrichment`.
- `/place/city/[citySlug]` does NOT fetch enrichment — it must start
  (or let the intel endpoint serve it).

### 12.2 ⚠ Context is already public — gate before monetizing

`GET /api/public/directory/category-enrichment` and
`GET /api/public/directory/location-enrichment` return `context`
verbatim (`rowToMarketState` passes `row.context ?? null` straight
through). That payload contains ALL the analyst-facing intel —
`category_signals`, `market_density`, `prospect_signals`,
`category_profile`, `market_summary`, `city_profile`, `market_gaps`,
`metro_dynamics` — unauthenticated, today.

**A paid card monetizing content the public API already ships is a
teaser with no substance behind it.** Prerequisite for paid cards on
these surfaces: split `context` in the public responses:

```
public  — shopper-facing fields the pages already render:
          category_overview, super_categories, sub_categories,
          adjacent_categories, metro_context

gated   — analyst-facing fields, served only by the market-intel
          endpoints under tier rules:
          category_summary, category_profile, category_signals,
          market_density, prospect_signals, category_notes,
          market_summary, city_profile, market_gaps, metro_dynamics,
          notable_areas, market_notes
```

Removing gated fields is a breaking response change — verify consumers
first (current consumers render only the public list above).

### 12.3 Cards per surface

**Category sidebar** (claim card replaced — no owner exists here):
- **Category Signals** — "what strong looks like in {category}".
  Teaser: "{N} benchmark signals tracked". Full: `category_signals`.
- **Category Profile** — `category_profile`: business model, customer
  base, competitive landscape, typical scale.
- **Market Density** — `market_density` qualitative read for this city.
- **Add Your Business** — conversion card → existing `AddBusinessCta` /
  `POST /api/public/directory/lead-gen`. No claim flow on this surface.

**Location sidebar:**
- **Market Gaps** — unmet demand in {city} (`market_gaps`: category +
  signal + area). Strongest prospecting hook — pairs directly with the
  Add Your Business CTA.
- **Metro Dynamics** — `metro_dynamics` + `city_profile`
  (`metro_description`, `major_industries`, `growth_trajectory`).
- **Market Summary** — `market_summary` analyst brief.
- **Add Your Business** — same lead-gen card.

Both surfaces keep the **Full Report** card (surface-specific PDF, §12.5).
Tiers 0–2 only — there is no owner claim on a market.

### 12.4 Endpoints (surface-generalized)

```
GET /api/public/place/:slug/market-intel/summary                    (seed — §4.1)
GET /api/public/directory/category/:categorySlug/market-intel/summary?city&state
GET /api/public/directory/city/:citySlug/market-intel/summary

GET  /api/customer/place/:slug/market-intel/{partial,full,report.pdf}
GET  /api/customer/directory/category/:categorySlug/market-intel/{partial,full,report.pdf}?city&state
GET  /api/customer/directory/city/:citySlug/market-intel/{partial,full,report.pdf}
POST /api/customer/.../market-intel/unlock                          (tenant required, §6.1)
```

`MarketIntelService` gets a per-surface resolver behind
`getTeaserSummary(surfaceType, surfaceKey)` — the place resolver runs
the §8.4 chain; category/city resolvers read the enrichment row
directly.

### 12.5 PDF variants

`MarketIntelReportPdfService` becomes surface-aware (same jsPDF pattern
+ per-customer branding):

- `place` → §5.1 structure (audit-driven)
- `category` → **Category Market Brief**: category profile, benchmark
  signals, market density, observed landscape, recommendations
- `city` → **City Market Brief**: market summary, market gaps table,
  metro dynamics, city profile, recommended entry categories

### 12.6 Why these surfaces are cheaper

No audit resolution (§8.4), no audit schema changes (§8.5), no claim
integration, no owner tier — just the context split (§12.2), the
sidebar, generalized unlock keying (§9.1), and the lead-gen CTA. The
intelligence is already persisted and already fetched.

---

## 13. Claim-triggered unlock — self-serve by construction

Every seed flows through the PG business audit (stage 5) — **the audit
already exists before the owner ever sees the page.** Claim therefore
requires NO post-claim audit run and NO operator work:

```
claim verified (claim-completion path — existing claim flow)
  → write market_intel_unlocks row
    (unlock_type='owner_claim', tenant_id = seed's tenant,
     surface_key = place slug)
  → owner's next page load resolves Tier 3
    → full sidebar content + PDF download, instantly
```

The claim card is the conversion motivator: "claim and get your free
audit + market intelligence." The product stocks itself — PG produces
the seed, the seed advertises locked intelligence, the owner claims to
unlock it. No operator intervention anywhere in the loop.

Implementation notes:

- **Hook point is claim confirmation, not claim-link click.** A token
  holder is not yet a verified owner — firing on click would hand a
  free audit to anyone holding the link.
- **Idempotent** via the §9.1 `UNIQUE (tenant_id, surface_type,
  surface_key, unlock_type)` + `recordUnlock` UPSERT — a re-claim or
  repeat claim event updates `unlocked_at` rather than violating the
  constraint.
- **Applies to `place` surfaces only** — `owner_claim` is the one
  unlock type with no category/city analogue (§9.1).
- The unlock write is fire-and-forget relative to claim completion:
  a failed write logs and retries on next claim event — it must never
  block or fail the claim itself.
