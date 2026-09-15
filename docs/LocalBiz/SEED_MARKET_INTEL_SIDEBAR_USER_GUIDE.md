# Market Intel Sidebar — User Guide

## Overview

The Market Intel Sidebar is a collapsible intelligence panel that appears on directory pages, showing market analysis for businesses, categories, and cities. It has three audience tiers:

- **Anonymous visitors** — see free teaser summaries (crawlable for SEO)
- **Logged-in shoppers** — see partial content (top 2-3 items per card)
- **Paid tenants / claimed owners / platform admins** — see full content + downloadable PDF reports

---

## 1. Surfaces

The sidebar appears on three page types:

### 1.1 Place (Seed) Pages — `/place/[slug]`

The primary surface. Shows business-specific intelligence derived from the PG business audit.

**Cards:**
| Card | What it shows |
|---|---|
| Growth Opportunities | Market opportunities ranked by impact (HIGH → MEDIUM → LOW) |
| How It Stacks Up | Category signal checklist with met/unmet indicators |
| Full Audit Report | Downloadable PDF with the complete analysis |
| Claim This Business | CTA for business owners to claim and unlock free access |

**Special behavior:**
- Claimed owners get full access free (no payment needed)
- The About section uses the audit's `public_narrative` when available
- Server-rendered teaser for SEO crawlers

### 1.2 Category Pages — `/place/category/[categorySlug]`

Shows category-level intelligence from the enrichment context. Works with city scope (`?city=Kansas City&state=MO`) or national (`__all__`).

**Cards:**
| Card | What it shows |
|---|---|
| Category Signals | Benchmark signals tracked for this category |
| Category Profile | Business model, customer base, competitive landscape |
| Market Density | Qualitative density read for this city |
| Full Category Report | Downloadable Category Market Brief PDF |
| Add Your Business | Lead-gen CTA (no claim flow on market surfaces) |

### 1.3 City Pages — `/place/city/[citySlug]`

Shows city-level intelligence from the location enrichment context.

**Cards:**
| Card | What it shows |
|---|---|
| Market Gaps | Unmet demand signals in this city |
| Metro Dynamics | City profile + metro relationships |
| Market Summary | Analyst brief for this market |
| Full City Report | Downloadable City Market Brief PDF |
| Add Your Business | Lead-gen CTA |

---

## 2. Access Tiers

| Tier | Who | What they see |
|---|---|---|
| 0 — Anonymous | Not logged in | Teaser summaries only |
| 1 — Free | Logged-in shopper | Partial content (top 2-3 items, locked items shown with lock icons) |
| 2 — Paid | Tenant who purchased | Full content + PDF download |
| 3 — Owner | Claimed business owner | Full content + PDF (free via claim) |
| 3 — Admin | Platform admin (linked user role = `PLATFORM_ADMIN`) | Full content + PDF on all surfaces (for testing) |

### How access is resolved

1. **Admin bypass** — if the customer's linked user has role `PLATFORM_ADMIN`, they get Owner-tier access on any surface
2. **Owner** (place only) — slug → listing → seed.tenant_id → `user_tenants(OWNER)` → `customer.linked_user_id`
3. **Paid** — a `market_intel_unlocks` row exists for `(tenant_id, surface_type, surface_key)`
4. **Free** — logged in but no unlock and not an owner

---

## 3. Unlock Flow (Paid Access)

### 3.1 Purchase a report

1. Click **"Unlock →"** on any card
2. If not logged in → redirected to signup/login
3. If logged in but no tenant account → paywall shows "tenant required" (a business account is needed to purchase)
4. If logged in with a tenant → paywall shows the price ($29 demo default) and checkout
5. Stripe PaymentIntent is created → confirm payment
6. On success: unlock row recorded + `marketing_revenue` row written
7. Sidebar refreshes → full content appears

### 3.2 Pricing

- **Single report unlock:** $29 (one-time, permanent, per surface)
- **Owner claim:** FREE (verify ownership → full access)
- **Platform admin:** FREE (bypass for testing)
- **Subscription:** Deferred — no report subscription model yet

The price is operator-overridable via `platform_settings_list` with a `unifiedConfig` fallback.

### 3.3 Surface key formats

| Surface | Key format | Example |
|---|---|---|
| `place` | business slug | `indian-spice-house` |
| `category` | `{categorySlug}:{city}:{state}` | `indian-grocery:Kansas City:MO` |
| `city` | `{city}:{state}` | `Kansas City:MO` |

Unlocks are permanent (no `expires_at` for `single_report` type).

---

## 4. Claim Flow (Owner Access)

Business owners get full access for free by claiming their listing:

1. Owner visits their `/place/[slug]` page
2. Clicks **"Claim This Business"** in the sidebar
3. Follows the claim flow (token-gated or operator-approved)
4. On claim approval:
   - Customer is promoted to a platform user
   - An `owner_claim` unlock row is written automatically (fire-and-forget)
   - Owner's next page load shows full content + PDF download
5. No payment needed — the claim IS the unlock

The unlock write is idempotent (UPSERT on the unique key) and fire-and-forget (a failure logs but doesn't block the claim).

---

## 5. PDF Reports

### 5.1 Place (seed) — Market Intelligence Report

8-section audit-driven report:
1. Executive Summary
2. Market Position (category density, city profile, metro dynamics)
3. Category Signals Checklist (met/unmet with evidence)
4. Gold Standard Comparison (above/below benchmark + alignment rating)
5. Growth Opportunities (ranked by impact)
6. Market Gaps (from location context)
7. Recommendations (derived from unmet signals + top opportunities)
8. Appendix: Market Context (raw category + location JSON)

### 5.2 Category — Category Market Brief

5-section brief:
1. Category Summary
2. Benchmark Signals
3. Category Profile (business model, customer base, landscape, scale)
4. Market Density
5. Prospect Signals

### 5.3 City — City Market Brief

5-section brief:
1. Market Summary
2. City Profile (metro description, industries, growth trajectory)
3. Market Gaps (category + signal + area)
4. Metro Dynamics (nearby cities + relationships)
5. Notable Areas

All PDFs include platform branding (logo, name, colors) from `platform_settings_list`.

---

## 6. API Endpoints

### 6.1 Public (no auth)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/public/place/:slug/market-intel/summary` | Place teaser |
| GET | `/api/public/directory/category/:categorySlug/market-intel/summary?city&state` | Category teaser |
| GET | `/api/public/directory/city/:citySlug/market-intel/summary` | City teaser |

All return 5-minute cache headers (`Cache-Control: public, max-age=300`).

### 6.2 Customer (requires customer JWT)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/customer/place/:slug/market-intel/partial` | Place partial content |
| GET | `/api/customer/place/:slug/market-intel/full` | Place full content |
| GET | `/api/customer/place/:slug/market-intel/report.pdf` | Place PDF download |
| POST | `/api/customer/place/:slug/market-intel/unlock` | Create payment intent |
| POST | `/api/customer/place/:slug/market-intel/unlock/confirm` | Confirm payment + record unlock |
| GET | `/api/customer/directory/category/:categorySlug/market-intel/full?city&state` | Category full content |
| GET | `/api/customer/directory/category/:categorySlug/market-intel/report.pdf?city&state` | Category PDF |
| POST | `/api/customer/directory/category/:categorySlug/market-intel/unlock?city&state` | Category unlock |
| POST | `/api/customer/directory/category/:categorySlug/market-intel/unlock/confirm?city&state` | Category confirm |
| GET | `/api/customer/directory/city/:citySlug/market-intel/full` | City full content |
| GET | `/api/customer/directory/city/:citySlug/market-intel/report.pdf` | City PDF |
| POST | `/api/customer/directory/city/:citySlug/market-intel/unlock` | City unlock |
| POST | `/api/customer/directory/city/:citySlug/market-intel/unlock/confirm` | City confirm |

Auth: customer JWT via `Authorization: Bearer <token>` or `customer_session_id` cookie. No platform context required.

---

## 7. Admin Testing

Platform admins can test the full flow without purchasing:

1. Ensure the admin has a customer account with `linked_user_id` pointing to their `users` row
2. Ensure the `users.role` is `PLATFORM_ADMIN`
3. Visit any surface page — the sidebar shows full content + PDF download
4. The `/unlock` endpoint returns `{ alreadyUnlocked: true }` for admins (no payment intent created)

To verify admin bypass is working:
- Visit `/place/[slug]` → sidebar should show full content with no paywall
- Visit `/place/category/[slug]` → sidebar should show full content
- Visit `/place/city/[slug]` → sidebar should show full content

---

## 8. Frontend Components

| File | Purpose |
|---|---|
| `MarketIntelSidebar.tsx` | Place surface sidebar (teaser + partial + full + paywall) |
| `MarketIntelSurfaceSidebar.tsx` | Category + city surface sidebar (teaser only) |
| `MarketIntelCard.tsx` | Reusable card shell |
| `MarketIntelPaywall.tsx` | Paywall modal with Stripe checkout |
| `MarketIntelPublicService.ts` | Place teaser endpoint client |
| `MarketIntelCustomerService.ts` | Place partial/full/unlock endpoint client |
| `MarketIntelSurfaceService.ts` | Category + city teaser endpoint client |

---

## 9. Backend Services

| File | Purpose |
|---|---|
| `MarketIntelService.ts` | Teaser/partial/full content resolvers for all surfaces |
| `MarketIntelAccessService.ts` | Access tier resolution, unlock recording, owner/admin checks |
| `MarketIntelReportPdfService.ts` | PDF generation (place, category, city variants) |
| `market-intel-public.ts` | Place public route |
| `market-intel-customer.ts` | Place customer routes |
| `market-intel-surface-public.ts` | Category + city public routes |
| `market-intel-surface-customer.ts` | Category + city customer routes |

---

## 10. Database

### `market_intel_unlocks` table

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | VARCHAR(255) | Purchasing tenant |
| `customer_id` | VARCHAR(255) | Auth identity who purchased |
| `surface_type` | TEXT | `place`, `category`, or `city` |
| `surface_key` | TEXT | Slug or composite key (see §3.3) |
| `unlock_type` | TEXT | `single_report`, `subscription`, or `owner_claim` |
| `payment_intent_id` | TEXT | Stripe PI ID (null for owner_claim) |
| `unlocked_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ | Reserved for subscriptions (null for single_report/owner_claim) |

Unique constraint: `(tenant_id, surface_type, surface_key, unlock_type)` — UPSERT-safe for re-purchase/re-claim.

RLS enabled with service-role policy.

---

## 11. Capability Gating (Deferred)

Per the user's decision, the sidebar is currently **ungated** on all surfaces to confirm cohesion before introducing gating. The planned gating model (deferred to back-burner):

- **Scope:** Entire sidebar, but only for tenant-owned seed surfaces (where the seed has a tenant)
- **Type:** Tier-gated toggle — tier determines whether the toggle is available (free tier can't toggle on; paid tier can toggle on/off)
- **Unaffected:** Category pages, location pages, and unclaimed seeds remain ungated

Gating will be revisited after all surfaces are visible and cohesion is confirmed.

---

## 12. Troubleshooting

### Sidebar doesn't appear
- Check that the page is a seed page (`listing.listingOrigin === 'directory_seed'`) for place surfaces
- Check that enrichment has run for the category/city (no enrichment → `hasIntelligence: false` → cards show "pending")
- Check browser console for API errors

### Paywall shows "tenant required"
- The customer is logged in but doesn't have a tenant account (business account)
- They need to register/attach a tenant before purchasing

### Full content doesn't load after unlock
- Check that the unlock row was written (`market_intel_unlocks` table)
- Check that the `surface_key` matches the page's slug
- For place surfaces: check `isOwner` — the seed's `tenant_id` must match a `user_tenants(OWNER)` row for the customer's `linked_user_id`

### PDF download fails
- Check that the customer has access (`canAccessFull` returns true)
- Check that `MarketIntelReportPdfService` can load platform branding
- Check that `jspdf` is installed (`pnpm list jspdf` in `apps/api`)

### Admin bypass not working
- Verify the customer's `linked_user_id` points to a `users` row
- Verify the `users.role` is `PLATFORM_ADMIN` (not `ADMIN` or `USER`)
- The check is in `MarketIntelAccessService.isPlatformAdmin`

---

## 13. Execution Touch Points — What Fuels the Sidebar

The sidebar is not a standalone product — it surfaces intelligence produced by the existing PG (Proving Ground) workflow. No manual curation is needed, but the underlying prompt executions must have run for intel to appear. Here's the complete map of which prompt templates feed each surface.

### 13.1 Place (seed) surface — 5 templates

The place sidebar reads from **two** data sources:

**Source 1: Business audit** (`mkt_audits_list WHERE platform = 'business_analysis'`)

Three templates in the Prompt Workspace produce this output. The resolver picks the **latest** audit regardless of which template produced it:

| Template ID | Name | Notes |
|---|---|---|
| `mpt-j9bbem3l` | Business Digital Audit - Cohesive (Category-Integrated) | V2 — has category intelligence + gold standard + `market_opportunities` + `signal_checklist` |
| `mpt-6oeuiizo` | Business Digital Audit - Alignment Scoring (Signal-Aligned) | V2 — same wiring as above |
| `mpt-je6m7ru6` | Seek: Business Audit V1 | Legacy — no `market_opportunities`/`signal_checklist` (sidebar falls back to `gap_analysis` count) |

The audit provides:
- `market_opportunities` — ranked growth opportunities (Growth Opportunities card)
- `signal_checklist` — met/unmet category signals (How It Stacks Up card)
- `gap_analysis` — gold-standard comparison (Full Report PDF)
- `public_narrative` — About section text

**Source 2: Market context** (via `MarketContextLoader` → `directory_category_enrichment`)

Two enrichment templates produce this context:

| Template ID | Name | Output schema |
|---|---|---|
| `mpt-category-enrichment-default` | Enrichment: Category Market SEO | `category_enrichment` |
| `mpt-location-enrichment-default` | Enrichment: Location Market SEO | `location_enrichment` |

The market context provides:
- `category_profile` — business model, customer base, competitive landscape
- `category_signals` — benchmark signals for the category
- `market_density` — qualitative density read
- `city_profile` — metro description, major industries, growth trajectory
- `market_gaps` — unmet demand signals
- `metro_dynamics` — nearby city relationships

### 13.2 Category surface — 1 template

Reads directly from `directory_category_enrichment` context JSONB — produced by:

| Template ID | Name | Output schema |
|---|---|---|
| `mpt-category-enrichment-default` | Enrichment: Category Market SEO | `category_enrichment` |

No audit chain needed — the enrichment context IS the intelligence.

### 13.3 City surface — 1 template

Reads from `directory_category_enrichment` where `category_key = '__location__'` — produced by:

| Template ID | Name | Output schema |
|---|---|---|
| `mpt-location-enrichment-default` | Enrichment: Location Market SEO | `location_enrichment` |

No audit chain needed.

### 13.4 Summary table

| Surface | Templates | Data source | Cards fueled |
|---|---|---|---|
| Place | 3 audit + 2 enrichment (5 total) | `mkt_audits_list` + `directory_category_enrichment` | All cards (Growth Opps, How It Stacks Up, Full Report, Claim) |
| Category | 1 enrichment | `directory_category_enrichment` | Category Signals, Profile, Density, Full Report |
| City | 1 enrichment | `directory_category_enrichment` (`__location__` row) | Market Gaps, Metro Dynamics, Summary, Full Report |

### 13.5 Dual execution — internal AI or external import

All 5 templates support dual execution (same as every other prompt in the system):

**Path 1 — Internal AI execution:**
- Run via the Prompt Workspace → `executeSingle()` → `aiProviderFactory.generateChatCompletion()`
- Execution + audit row recorded automatically
- This is the PG automated path (stage 5 runs the business audit; enrichment campaigns run the category/location templates)

**Path 2 — External import:**
- Operator copies the rendered prompt (via `renderPrompt()`) into an external AI (ChatGPT, Claude, etc.)
- Pastes the result back via `/prompts/executions/external` → `importExternalResult()`
- Output validated against the template's `output_schema` → execution + audit row recorded

Both paths produce the same end state: a `mkt_audits_list` row (for audits) or a `directory_category_enrichment` row (for enrichment) with validated JSON. The sidebar reads from these rows regardless of which path produced them.

### 13.6 What happens when executions haven't run

The sidebar degrades gracefully — it doesn't error, it shows "pending" states:

| Missing data | Sidebar behavior |
|---|---|
| No audit (place) | `hasAudit: false` — all cards show `available: false` with "pending" teaser copy |
| Audit exists but no `market_opportunities` | Falls back to `gap_analysis.gaps.length` with severity → impact mapping |
| Audit exists but no `signal_checklist` | "How It Stacks Up" card shows `available: false` ("Category signal evaluation pending") |
| No category enrichment | `hasCategoryIntelligence: false` — market context fields render as "not yet available" |
| No location enrichment | `hasLocationIntelligence: false` — city/metro fields render as "not yet available" |
| No enrichment at all (category/city surface) | `hasIntelligence: false` — all cards show "pending" teaser copy |

### 13.7 PG workflow integration

The business audit runs automatically at PG stage 5 for every seed. The enrichment campaigns are operator-triggered (one-time per market) but the intelligence is AI-generated. The full automated loop:

```
PG scrapes public data → creates seed
  ↓
PG stage 5 → runs business audit (mpt-j9bbem3l or mpt-6oeuiizo)
  → mkt_audits_list row with audit_data
  ↓
Intelligence campaigns (operator-triggered, one-time per market)
  → runs category enrichment (mpt-category-enrichment-default)
  → runs location enrichment (mpt-location-enrichment-default)
  → directory_category_enrichment rows
  ↓
Seed page loads → MarketIntelService resolves slug → audit + context
  → sidebar renders teaser/partial/full content
  ↓
Owner claims → unlock row written → full access free
  OR
Tenant purchases → unlock row written → full access + PDF
```

No operator curation anywhere in the loop. The product stocks itself.
