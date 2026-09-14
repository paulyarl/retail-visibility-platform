# Sprint Plan: Seed Market Intel Sidebar

**Spec:** `docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md`
**Status:** Ready for Sprint Planning
**Migration:** `285_market_intel_unlocks.sql` (next free number — verify at write time)

---

## 0. Pre-Flight Checklist

### 0.1 Hard Rule — TypeScript Checks at Phase End

```bash
pnpm checkapi   # tsc --noEmit --project apps/api
pnpm checkweb   # tsc --noEmit --project apps/web
```

Zero new errors on both. Run before every commit.

### 0.2 Seed Discipline (AGENTS.md)

Phase 0 edits `seed-business-audit-v2-templates.ts` — re-run against
**both** `local` and `prd`, then verify each template's body contains
the new fields AND the new marker (marker-without-content has bitten
twice — see AGENTS.md "Two subtler failure modes").

### 0.3 CHECK-Constraint Discipline (AGENTS.md)

`conversion_source = 'market_intel_unlock'` is a new
`ConversionSource` enum value. Before Phase 3 ships: grep
`marketing_revenue` for `chk_` constraints covering `conversion_source`
and ship a numbered migration in the same release if present.

### 0.4 Service / Table Planning

| Service | Side | Base | Status |
|---------|------|------|--------|
| `MarketIntelService` | API | `BaseService` | NEW |
| `MarketIntelAccessService` | API | `BaseService` | NEW |
| `MarketIntelReportPdfService` | API | jsPDF (per `MarketingReceiptPdfService`) | NEW |
| `MarketContextLoader` | API | `BaseService` | Existing — reuse `loadMarketContext` + `has*Intelligence` |
| `IntelligenceProfileService` | API | Existing | Existing — `resolve()` for gold standard |
| `DirectoryClaimService` | API | Existing | Extend — `approveClaimRequest` + `linkCustomerToClaimRequest` write the `owner_claim` unlock (§13) |
| `MarketIntelPublicService` | Web | `PublicApiSingleton` (`ttl: 0`) | NEW |
| `MarketIntelCustomerService` | Web | `CustomerApiSingleton` | NEW |

- [ ] No direct `fetch` in components — all calls via the two new web services
- [ ] Public routes mount at `/api` → `/api/public/...`; customer routes at `/api/customer/...`
- [ ] Double-wrap response contract: `result.data?.data ?? result.data`

### 0.5 ID / Migration Planning

- [ ] `market_intel_unlocks` — `id UUID DEFAULT gen_random_uuid()` (no tenant-scoped ID generator needed; not a tenant-ID-pattern table)
- [ ] Migration `285_market_intel_unlocks.sql` — hand-written SQL, applied manually via `psql $DATABASE_URL` on `local` and `prd`; then `doppler run --config local -- pnpm prisma db pull` + `prisma generate`
- [ ] RLS enabled per table convention (service-role policy)

---

## Phase 0 — Audit output prerequisites (spec §8.4, §8.5)

**Goal:** the audit emits the structured fields the cards read, and a
slug resolves to its audit.

### Tasks

1. **`apps/api/src/validators/business-analysis.schema.ts`**
   - Add `market_opportunities`: `{ title, description, impact: 'HIGH'|'MEDIUM'|'LOW' }[]`
   - Add `signal_checklist`: `{ signal, met, evidence }[]`
   - Both optional — pre-change audits won't have them.
2. **`BUSINESS_ANALYSIS_PROMPT_SUFFIX`** — document both fields; directive
   that `signal_checklist` is populated ONLY when the market-context
   binding ran.
3. **`seed-business-audit-v2-templates.ts`** — add both fields to each
   variant's embedded JSON schema as **separate** `insertAfter` calls
   (never combine — fingerprint is first-80-chars only); insert any
   headingless sections AFTER all `removeSection` calls. Bump
   `SEED_VERSION_MARKER` (`-4`).
4. **Re-run seed on `local` + `prd`; verify** each body contains the new
   schema fields AND marker-4 (not just the marker).
5. **Slug→audit resolver** in `MarketIntelService` (spec §8.4):
   `slug → directory_listings_list → directory_presence_seeds →
   directory_seed_campaign_links (link_role='primary') →
   mkt_campaigns_list → mkt_audits_list (platform='business_analysis',
   latest)`. Returns `null` cleanly at every missing link.

### Tests

- Resolver: full chain resolves; missing listing / missing seed / missing
  campaign / missing audit each return `null` (not throw).
- Fallback derivation (§8.5.4): `gap_analysis.gaps` → opportunities count;
  `signal_checklist` absent → card `available: false`.

### Exit criteria

- [ ] `pnpm checkapi` clean
- [ ] Seed re-run verified on both envs (marker AND content)
- [ ] Resolver unit tests pass

---

## Phase 1 — Teaser sidebar (spec §3, §4.1, §7; no paywall)

**Goal:** anonymous visitors see teaser cards; server-rendered for SEO.

### Tasks

1. **`MarketIntelService.getTeaserSummary(businessSlug)`** — resolves
   audit (Phase 0) + `MarketContextLoader.loadMarketContext`; returns
   the §4.1 card summary payload. `hasAudit` false → all cards
   `available: false`. Sits on the loader's 5-min TTL.
2. **`GET /api/public/place/:slug/market-intel/summary`** —
   `apps/api/src/routes/market-intel-public.ts`, mounted at `/api`.
   `Cache-Control: public, max-age=300`. Optional `optionalCustomerAuth`
   for unlock state when a session exists.
3. **Web:** `MarketIntelPublicService` (`PublicApiSingleton`, `ttl: 0`)
   + `MarketIntelSidebar` / `MarketIntelCard` / toggle components under
   `apps/web/src/components/place/`.
4. **Mount** in `PlacePageClient` gated on
   `listing.listingOrigin === 'directory_seed'` — NOT inside
   `PlaceEntryEditorialLayout` (shared with `retail/[slug]`).
5. **Server-render teasers** in `page.tsx` (already `force-dynamic`) so
   teaser text is crawlable (§11.5).
6. **About section:** render `audit.public_narrative` when present;
   fall back to the existing static claim pitch (§1.1).
7. "Unlock →" CTAs render "Coming soon" (Phase 1 has no paywall).
8. **Claim card** ships here — always visible, links to
   `/place/claim/${listing.activeClaimToken}` or `#claim-inquiry`
   fallback (§3.4). Copy leads with the free-audit motivator (§13).

### Tests

- Teaser summary: audit present → counts derived; audit absent →
  `hasAudit: false`, all cards unavailable; enrichment missing →
  degrade, no error.
- Endpoint: unauthenticated → 200 with teaser payload; non-seed listing
  → cards unavailable or 404 per spec decision.

### Exit criteria

- [ ] Sidebar visible on a seed page with a real audit (local)
- [ ] Non-seed `/place/[slug]` pages unchanged
- [ ] `retail/[slug]` unchanged (layout shared — verify)
- [ ] Teaser text present in server-rendered HTML (view source)

---

## Phase 2 — Partial content (spec §4.2; free accounts)

### Tasks

1. **`MarketIntelService.getPartialContent(businessSlug, customerId)`** —
   top 2-3 items per card + `lockedCount` (§4.2 response shape).
2. **`GET /api/customer/place/:slug/market-intel/partial`** —
   `requireCustomerAuth` ONLY — do NOT apply `requirePlatformContext`
   (it 403s storefront-only shoppers, §4.2).
3. **`MarketIntelCustomerService`** (`CustomerApiSingleton`).
4. Partial card rendering + "Unlock Full Report →" CTAs.

### Tests

- No JWT → 401; valid JWT → partial payload; `lockedCount` correct.
- Storefront-context-only customer → 200 (regression guard for the
  platform-context mistake).

### Exit criteria

- [ ] Logged-in shopper sees partial card content
- [ ] Anonymous visitor still sees teasers only

---

## Phase 3 — Full content + paywall (spec §4.3, §6; paid tenant)

### Tasks

1. **Migration `285_market_intel_unlocks.sql`** (§9.1) — run on `local`
   AND `prd`, then `prisma db pull` + `generate`.
2. **`MarketIntelAccessService`** — `getAccessTier`, `canAccessFull`,
   `recordUnlock` (UPSERT on unique key), `isOwner` (§8.2). `isOwner`
   ships HERE (moved up — the Claim card is live since Phase 1; a
   claimed owner must never hit a paywall).
3. **`MarketIntelService.getFullContent`** — full card content (§3).
4. **`GET /api/customer/place/:slug/market-intel/full`** — tier ≥ 2.
5. **`POST /api/customer/place/:slug/market-intel/unlock`** — checkout:
   tenant required (§6.1: `customers.linked_user_id` → `user_tenants`);
   shopper-only customers get tenant-registration inside the paywall.
   `SubscriptionBillingService.createOneTimePaymentIntent` (accepts
   `customer` + `setup_future_usage`).
6. **Revenue row** — `marketing_revenue` with
   `conversion_source='market_intel_unlock'`; CHECK-constraint sync
   migration if needed (§0.3).
7. **Price** from `platform_settings_list` with `unifiedConfig` fallback
   ($29 demo default, §6.3).
8. **`MarketIntelPaywall`** modal + full card rendering + download
   button (disabled until Phase 4).

### Tests

- Tier resolution: anonymous → 0, shopper → 1, paid → 2, claimed owner → 3.
- `isOwner` → `canAccessFull` without an unlock row.
- `recordUnlock` UPSERT — repeat purchase updates, doesn't violate.
- Checkout: non-tenant → tenant-registration path; tenant → PI created.
- SCA failure → 402 `authentication_required` + clientSecret (existing
  portal-checkout pattern).

### Exit criteria

- [ ] Full purchase loop works end-to-end on local (Stripe test)
- [ ] Purchase appears in portal purchase history with receipt
- [ ] CHECK constraint verified/synced before prd migration

---

## Phase 4 — PDF report (spec §5)

### Tasks

1. **`MarketIntelReportPdfService`** — jsPDF, mirrors
   `MarketingReceiptPdfService`; §5.1 section structure.
2. **`GET .../market-intel/report.pdf`** — tier ≥ 2; `Content-Type:
   application/pdf`.
3. Per-customer branding (migration 162 pattern).
4. Download button wired on the Full Report card.

### Exit criteria

- [ ] PDF generates for an unlocked/owner account
- [ ] 403 for partial/tier-1 accounts

---

## Phase 5 — Claim-triggered unlock (spec §13)

**Goal:** claim approval automatically unlocks everything — the audit
already exists; this phase is a single write plus tests.

### Tasks

1. **`DirectoryClaimService.approveClaimRequest`** — after
   `status='approved'` + owner linkage succeeds, fire-and-forget
   `MarketIntelAccessService.recordUnlock(..., 'owner_claim')`.
   Wrap in try/catch + log — must never fail the claim.
2. **`linkCustomerToClaimRequest`** — same unlock write for the
   retroactive-link path (claims approved before a customer_id existed).
3. **Card verification** — claimed owner loads the seed page → Tier 3 →
   full content + PDF without payment.

### Tests

- Approval → `owner_claim` unlock row written (idempotent on re-claim).
- Unlock-write failure → claim still succeeds (error swallowed + logged).
- Retroactive link path → unlock written.

### Exit criteria

- [ ] End-to-end: claim → approve → owner sees full sidebar + PDF
- [ ] No operator step beyond the existing claim approval

---

## Phase 6 — Category & location surfaces (spec §12)

### Tasks

1. **§12.2 context split (PREREQUISITE, breaking change)** — split
   `context` into `public` / `gated` on
   `GET /api/public/directory/{category,location}-enrichment`. Audit all
   consumers first (`CategoryViewClient`, location page,
   `PlaceCityClient`, metadata generators render only public fields).
2. **Surface resolvers** — `getTeaserSummary(surfaceType, surfaceKey)`;
   category/city resolvers read the enrichment row directly (no audit
   chain). `MarketContextLoader` handles `__all__` national rows.
3. **Generalized endpoints** (§12.4) + `surface_key` formats (§9.1).
4. **Sidebar mount** on `/directory/categories/[categorySlug]` +
   `/directory/location/[location]` + `/place/category|city/[slug]`;
   `/place/city/[citySlug]` must start fetching enrichment (§12.1).
5. **Cards** per §12.3 — "Add Your Business" lead-gen card replaces the
   claim card (no owner on a market).
6. **Surface-aware PDFs** (§12.5) — Category / City Market Briefs.

### Exit criteria

- [ ] Gated intel no longer ships in public enrichment responses
- [ ] Category + location sidebars render teasers; unlock flow shared
- [ ] Old consumers verified against the split response shape

---

## Cross-Phase Notes

- **Honest framing:** `market_gaps`/`prospect_signals` are AI-inferred
  signals, not measured demand — card/PDF copy says "signals identified
  by analysis," not "research data." (Product/copy decision, flag for review.)
- **`mpt-je6m7ru6` absent in prd** — V1 audit template doesn't exist in
  production; Phase 0 seed verification covers only the two V2 variants
  there unless V1 is intentionally prod-excluded.
- **Stale-body guard:** after every seed re-run, verify marker AND
  content presence — the marker alone has proven it can lie.
