# Marketing Ops Customer Portal — Functional Spec

**Status:** Draft · **Owner:** Platform Eng · **Date:** 2026-08-03
**Companion docs:** `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md`,
`docs/LocalBiz/local_marketing_ops_payment_collection_sprint_plan.md`,
`docs/LocalBiz/PROFILE_REPAIR_INTEGRATION_SPEC.md`

---

## 1. Purpose & Summary

The Marketing Ops public pay page (`/marketing/pay`) is a **pay-and-forget**
surface: the prospect resolves a `ptoken`, enters a card in Stripe Elements,
gets a receipt download, and leaves. There is no account, no saved payment
method, no way to check on the work they paid for, and no re-engagement
surface for the retainer pitch that the pipeline is designed to drive
(`paid → delivered → retainer_pitched → retainer_won`).

The platform **already has** a full customer architecture built for storefront
shoppers:

- `customers` table with password/OAuth auth, email verification, lockout
  (`schema.prisma` line 1106)
- Customer JWT auth stack: `CustomerAuthService`, `CustomerTokenService`,
  `/api/customer-auth/*` routes (`apps/api/src/routes/customer-auth.ts`)
- Saved payment methods on file, scoped per tenant
  (`customer_payment_methods`, `CustomerPaymentMethodsService` — front + back)
- Orders, addresses, coupon wallet, notifications services
- A customer portal shell at `/account` with sidebar navigation, gated by
  `CustomerAuthContext`
- The `CustomerApiSingleton` base class that all customer-facing frontend
  services extend (JWT injection, `X-Customer-ID` header, scoped caching)

**The gap is a link, not a rebuild.** Marketing ops payments are not attached
to a customer identity, the pay page never offers account creation, and the
`/account` portal has no marketing ops section.

This spec extends the existing customer architecture to marketing ops
customers so that a business owner who pays for a campaign can:

1. **Create an account** at the moment of highest intent (payment success) —
   or later, via email-awareness claim links, with their historical
   foot-in-the-door payments automatically attached.
2. **Track purchases** — every campaign payment across **all** their
   campaigns (review, recovery, profile repair) with receipts (PDF + HTML
   view).
3. **Save a payment method on file** for future packages and retainers.
4. **Track work** — customer-safe view of campaign progress and deliverables.
5. **Receive receipts by email** and re-download them anytime.
6. **Convert to retainer** with one-click payment using the card on file.

---

## 2. Goals & Non-Goals

### Goals

- G1. Post-payment account creation from the pay page success screen (and
  optional pre-payment account creation/login).
- G2. Retroactive linking: no paid campaign is ever orphaned. Historical
  foot-in-the-door payers convert via email-awareness claim links (Path B);
  later registrants are matched by a claim sweep at email verification
  (Path C); both link **all** eligible campaigns in one action
  (multi-campaign aware, §4.3).
- G3. A `/account/marketing` portal section showing purchases, campaign
  status, deliverables, and receipts.
- G4. Payment method on file for platform-collected marketing ops payments
  (opt-in "save this card").
- G5. Receipt email on payment success (currently no email is sent).
- G6. One-click repeat purchase / retainer checkout for returning customers.
- G7. All new surfaces reuse `CustomerApiSingleton`, the existing JWT stack,
  and existing backend services. No parallel auth system.
- G8. Strict context separation: storefront (tenant) and platform (marketing)
  experiences are independently signal-gated with no bleed; a customer sees
  each side only when they hold relationships on that side (§4.1, §4.2).
- G9. Receipt parity with the tenant experience: full receipt view, PDF
  download, and a styled QR on every receipt that scans to the customer's
  asset URL — carrying their uploaded logo when provided (§7.4).
- G10. Coupon parity with the tenant experience: save platform coupons to
  the existing wallet, purchase with coupon awareness (applicable coupons at
  checkout, savings on receipts, redeemed/expired lifecycle, expiry
  reminders) — all via the `_platform_` scope, no new wallet infrastructure
  (§7.5).
- G11. Support & address parity: marketing customers file support tickets to
  the platform through the existing CRM ticket stack (landing in the
  operator hub that already aggregates platform tickets), and use the
  customer-global address wallet for billing — no new infrastructure for
  either (§7.7, §7.8).
- G12. Alert parity: operators can send targeted alerts to a marketing
  customer and broadcast alerts to all platform customers, with per-customer
  read/dismiss state — reusing `crm_alerts` and its metadata-targeting
  conventions, with platform-context gating (§7.9, §8.3).

### Non-Goals (v1)

- Self-service refunds/disputes in the portal (operator-initiated only).
- Customer editing of campaign data (campaign remains operator-owned).
- Exposing internal operator surfaces (notes, prompts, AI workspace, cost
  tracking, hot-prospect flags) to customers.
- Multi-user business accounts (one login = one customer record; business
  "team" access is future work).
- Migrating storefront shoppers and marketing ops buyers into a unified
  profile view (they already share the `customers` table; unified UI is out
  of scope).
- Stripe Customer Portal hosted page integration (may replace parts of G4
  later; not required for v1).

---

## 3. Current State

### 3.1 Payment flow today (as-is)

```
Operator sets package_price_cents + coupon on campaign
        │
        ▼
Prospect gets pay link (QR / demo storefront / direct) ──► /marketing/pay?ptoken=…
        │                                                   (public, token = trust boundary)
        ▼
GET  /api/public/marketing/pay        resolve token → campaign, price, coupon
POST /api/public/marketing/checkout   validate coupon → Stripe PaymentIntent
        │                             (SubscriptionBillingService.createOneTimePaymentIntent)
        ▼
Stripe Elements confirm
        │
        ▼
POST /api/public/marketing/pay/confirm  verify PI → markCampaignPaid()
        │                                → marketing_revenue row
        │                                → deliverables upgraded (watermark removed)
        ▼
Success screen + GET /api/public/marketing/receipt/:campaignId (jsPDF)
        │
        ▼
   [DEAD END] — no account, no saved card, no email, no return path
```

Key files:
- Frontend page: `apps/web/src/app/marketing/pay/PayPageClient.tsx`
- Frontend service: `apps/web/src/services/MarketingPayPublicService.ts`
  (extends `PublicApiSingleton`)
- Backend routes: `apps/api/src/routes/marketing-ops-public.ts`
- Payment: `apps/api/src/services/subscription/SubscriptionBillingService.ts`
- Receipt: jsPDF inline in `marketing-ops-public.ts` (lines 327–499)

### 3.2 Customer architecture today (reusable assets)

| Asset | Location | Notes |
|-------|----------|-------|
| `customers` model | `apps/api/prisma/schema.prisma:1106` | password + auth0, verification, lockout |
| `customer_payment_methods` model | `schema.prisma:1044` | per-tenant scope, Stripe attach, default flag |
| Customer auth routes | `apps/api/src/routes/customer-auth.ts` | register/login/OAuth/reset/verify/me |
| Backend `CustomerAuthService` | `apps/api/src/services/CustomerAuthService.ts` | incl. **guest-order reconciliation on register** |
| Backend `CustomerPaymentMethodsService` | `apps/api/src/services/CustomerPaymentMethodsService.ts` | Stripe customer per scope, card masking |
| `CustomerApiSingleton` | `apps/web/src/providers/base/CustomerApiSingleton.ts` | JWT + `X-Customer-ID` + caching |
| Portal shell | `apps/web/src/app/account/` | layout + `CustomerSidebar` + orders/coupons/downloads/addresses/payment-methods/notifications/settings |
| Receipt PDF | `marketing-ops-public.ts` | platform-branded jsPDF |
| Tenant receipt view (parity target) | `apps/web/src/components/checkout/OrderReceipt.tsx` | full HTML receipt + **QR to tenant location** via `TenantQRCode` |
| QR styling engine | `apps/web/src/lib/qr-style-config.ts`, `apps/web/src/lib/qr-engine.ts` | `qr-code-styling`: dot/corner themes, **center-logo embedding** (`imageSize 0.35`, `hideBackgroundDots`, `errorCorrectionLevel: 'H'`) |
| Server-side QR generation | `qrcode@^1.5.4` in `apps/api` | PNG/SVG data-URL generation for PDF embedding |
| Operator branding precedent | `mkt_branding_config.operator_logo_url` (`schema.prisma:6098`) | logo already fetched + embedded in generated PDFs |
| Coupon wallet (backend) | `apps/api/src/routes/customer-coupons.ts`, `apps/api/src/services/CustomerCouponWalletService.ts` | save, **save-by-code**, list, stats, expiring, reminders |
| Coupon wallet (frontend) | `apps/web/src/services/CustomerCouponWalletService.ts` | extends `CustomerApiSingleton`; `/account/coupons` page |
| Coupon models | `tenant_coupons`, `customer_saved_coupons`, `customer_coupon_reminders`, `coupon_redemptions` (`schema.prisma:5998–6068`) | wallet rows keyed `(customer_id, coupon_id)`, scoped by `tenant_id` |
| Coupon validation | `apps/api/src/services/CouponService.ts` (`validateCoupon`:336) | min-spend, expiry, redemption caps, targeting; **already called with `_platform_` fallback by the pay page** (`marketing-ops-public.ts:152,232`) |
| Customer support tickets | `apps/api/src/routes/crm/customer/crm-customer.ts`, `apps/web/src/services/crm/CrmCustomerService.ts` | customer→tenant tickets with messages, read states, per-tenant capability gate (`customerTicketsEnabled`); `crm_support_tickets.customer_id` FK + nullable `tenant_id` (`schema.prisma:875`) |
| Platform ticket precedent | `apps/api/src/routes/crm/personal/crm-personal.ts` (`PLATFORM_TENANT_ID = 'platform'`:34) | operator hub **already aggregates user→platform tickets** — customer→platform tickets land in the same admin surface |
| Address wallet | `customer_addresses` (`schema.prisma`:994), `CustomerAddressesService` (front + back), `/account/addresses` | **globally per-customer — no tenant scoping at all**; `is_billing` flag already exists |
| Customer alerts | `crm_alerts` (`schema.prisma`:778), `GET/PUT /api/customer/crm/alerts*` (`crm-customer.ts`:362–530) | tenant-level rows; targeting via `metadata` conventions (`order_id`, `customer_email`); per-type filtering at read time |
| Alert read state | `crm_customer_read_states` (`schema.prisma`:821) | per-customer per-scope read watermark (cursor pattern) — reused for platform alert unread badges |

### 3.3 The critical design mismatch

`customer_payment_methods` is scoped by `tenant_id` because **each tenant has
its own Stripe account** — a card saved at tenant A is useless at tenant B.
Marketing ops payments are **platform-collected** (platform Stripe account via
`SubscriptionBillingService`), so the per-tenant model doesn't fit directly.

The codebase already has a convention for this: the coupon validator falls
back to the `_platform_` sentinel when a campaign has no tenant
(`marketing-ops-public.ts:152`, `marketing-ops-public.ts:232`). We adopt the
same sentinel as the payment-method scope for platform-collected payments
(see §5.3).

---

## 4. Proposed Architecture

### 4.1 Identity model — one `customers` record, two strictly separated contexts

Marketing ops buyers become rows in the **existing** `customers` table. No new
identity system, no new auth stack. One human = one login. But the two
audience contexts are **strictly separated, with no bleed**:

- **Storefront context (tenant-scoped):** `customer_tenant_relationships`,
  tenant orders, tenant-scoped payment methods, coupon wallet. This is
  commerce between the customer and a *tenant* (the merchant).
- **Platform context (marketing ops):** new `mkt_campaigns_list.customer_id`
  link + `marketing_revenue.customer_id` link, `_platform_`-scoped payment
  methods, deliverables, receipts. This is commerce between the customer and
  the *platform* (the operator).

The contexts never merge in the data model and never merge in the UI. What a
customer **sees** is determined by which relationships they actually have
(see §4.2 signal model):

| Customer has… | Portal shows… |
|---------------|---------------|
| Storefront relationships only | Existing storefront sections (orders, coupons, downloads, addresses, tenant cards) |
| Platform (marketing) relationships only | **My Services** section only — no storefront sections, no empty storefront dashboards |
| Both | Both sections, clearly grouped (see §7.2) |

Login, password reset, verification, and lockout behave identically for both —
context is a *view and data-scope* concern, not an auth concern.

### 4.2 Context signal model — visibility is relationship-driven, server-computed

Context visibility is **not** a flag an admin sets and **not** a field the
customer edits. It is derived server-side from actual relationships:

```
hasStorefrontContext = EXISTS(customer_tenant_relationships WHERE is_active)
                       OR EXISTS(orders by this customer)
hasPlatformContext   = EXISTS(mkt_campaigns_list.customer_id = customer)
                       OR EXISTS(marketing_revenue.customer_id = customer)
```

- Exposed via the session payload: `GET /api/customer-auth/me` (and
  register/login/claim responses) gains a `contexts: { storefront: boolean,
  platform: boolean }` field, cached in `CustomerAuthContext` and refreshed
  on login, claim, and purchase events (cache invalidation via the existing
  `invalidateServiceCaches` contract).
- **Frontend:** `CustomerSidebar` renders each section group only when its
  context signal is true. Hidden navigation is convenience, not security.
- **Backend (defense in depth):** marketing portal endpoints require
  `hasPlatformContext` and return `403 context_required` otherwise;
  storefront endpoints already scope by tenant relationship and stay
  unchanged. A storefront-only customer calling `/api/customer/marketing/*`
  gets 403, not an empty 200 — the API mirrors the separation, so context
  boundaries are testable without a browser.
- A customer starts with **zero** contexts (bare account from any entry
  point) and accumulates them as relationships form: pay + claim → platform;
  first storefront order → storefront. The portal home for a zero-context
  account shows a neutral profile/settings view only.

### 4.3 Linkage strategy — pay first, claim anytime, never lose the foot-in-the-door payment

The pay page must stay **public and frictionless** (operators send these
links to cold prospects; forced registration would kill conversion). Account
creation is therefore **post-payment and optional**, plus retroactive claim
paths. The invariant: **every paid campaign is claimable forever** — the
one-time foot-in-the-door payment is never orphaned, whether the payer
converts on the success screen, weeks later from a receipt email, or months
later by registering fresh.

**Three claim paths, one claim service:**

```
 [Path A — at payment]                [Path B — email awareness]         [Path C — registration]
 Pay page success screen              Receipt email / "Track my          Customer registers or
 (ptoken in hand)                     purchase" claim link               verifies email later
        │                             (email in hand)                           │
        ▼                                     ▼                               ▼
 POST /pay/claim (§6.1)          POST /claim/request → email          Claim sweep runs at
 register-or-login inline        with single-use claim token          email verification:
                                 (mkt_customer_claim_tokens)          match customers.email
        │                             │                               against unclaimed paid
        │                             ▼                               campaigns by
        │                        /marketing/claim?t=… →               campaign.email
        │                        register-or-login → claim            │
        │                             │                               ▼
        └─────────────┬───────────────┴───────────────────────────────┘
                      ▼
   ONE claim service: link campaign.customer_id + all its
   marketing_revenue.customer_id → portal becomes aware of
   ALL claimed campaigns (multi-campaign by construction)
```

- **Path A (ptoken):** highest-intent moment, already specced in §6.1.
- **Path B (email awareness):** the historical-payer path — anyone who
  previously paid via the public pay page. Receipt emails (§6.6) and a
  public "Track my purchase" page accept an email address; if it matches
  **any paid, unclaimed campaign**, a claim email with a single-use,
  short-TTL token (`mkt_customer_claim_tokens`, §5.4) is sent. Opening the
  link lands on register-or-login; on success the claim service links every
  matching campaign. This is the primary conversion engine for the
  pre-portal payer base and is **core scope**, not v1.1.
- **Path C (sweep):** zero-friction fallback — registration or first email
  verification triggers a sweep matching the verified email against
  unclaimed paid campaigns (`mkt_campaigns_list.email`), linking them
  silently. Mirrors the guest-order reconciliation already in the backend
  `CustomerAuthService`.

**Trust model for claiming:**
- Path A: the `ptoken` is already the trust boundary for payment (unguessable,
  expiring); extending it to a one-time attach is safe.
- Path B: possession of the **email inbox** is the proof — the claim token is
  delivered only to the campaign's email address, is single-use, expires in
  24h, and reveals purchase details only after register/login completes.
  Enumeration resistance: the request endpoint always returns
  "If we find purchases for this email, we'll send a link" regardless of
  matches.
- Path C: email verification gates the sweep — an attacker registering with
  someone else's email cannot complete verification, so no claim executes.

**Multi-campaign awareness is inherent:** all three paths call the same claim
service, which links **all** eligible campaigns for that customer (a business
owner with a review campaign, a recovery campaign, and a profile repair
campaign gets one account showing all three). Claiming is additive and
idempotent — Path B claiming campaign #1 doesn't block Path C later sweeping
campaign #2 paid with the same email.

### 4.4 Service layering

One new frontend service extending `CustomerApiSingleton`, one new backend
route module, one new backend service:

```
apps/web
├─ src/services/MarketingCustomerService.ts      (NEW — extends CustomerApiSingleton)
├─ src/app/marketing/pay/PayPageClient.tsx       (MODIFIED — success-screen account CTA)
├─ src/app/marketing/pay/claim/                  (NEW — claim/link page for returning users)
└─ src/app/account/marketing/                    (NEW — portal section)
   ├─ page.tsx                                   (overview: purchases + campaign status)
   ├─ purchases/page.tsx                         (payment history + receipts)
   ├─ campaigns/[campaignId]/page.tsx            (work tracking + deliverables)
   └─ layout / nav additions in CustomerSidebar

apps/api
├─ src/routes/marketing-customer.ts              (NEW — JWT-gated /api/customer/marketing/*)
├─ src/services/MarketingCustomerService.ts      (NEW — portal queries, claim logic)
├─ src/routes/marketing-ops-public.ts            (MODIFIED — claim link, receipt email hook)
└─ src/services/marketing/MarketingReceiptEmailService.ts (NEW — payment receipt email)
```

---

## 5. Data Model Changes

One migration (`mkt_customer_portal`), all columns nullable/additive. No
existing rows require backfill beyond the claim sweep at runtime.

### 5.1 `mkt_campaigns_list` — add customer link

```prisma
model mkt_campaigns_list {
  // … existing fields …
  customer_id        String?    @db.VarChar(255)
  customers          customers? @relation(fields: [customer_id], references: [id], onDelete: SetNull)

  @@index([customer_id], map: "idx_mkt_campaigns_customer")
}
```

Set when a paying customer claims the campaign. Nullable forever — anonymous
payers remain valid.

### 5.2 `marketing_revenue` — add customer link

```prisma
model marketing_revenue {
  // … existing fields …
  customer_id        String?    @db.VarChar(255)
  receipt_emailed_at DateTime?  @db.Timestamptz(6)
  customers          customers? @relation(fields: [customer_id], references: [id], onDelete: SetNull)

  @@index([customer_id], map: "idx_mkt_revenue_customer")
}
```

`receipt_emailed_at` tracks G5 delivery.

### 5.3 `customer_payment_methods` — no schema change, sentinel scope

Reuse as-is. Platform-collected cards are stored with
`tenant_id = '_platform_'`, matching the coupon-fallback convention. The
backend `CustomerPaymentMethodsService` already creates a Stripe customer per
(customer, tenant) pair; for `_platform_` it must use the **platform Stripe
account** instead of a tenant connection — a small branch in the
gateway-resolution logic (see §6.3).

Rationale over a separate `platform_payment_methods` table: keeps one card
wallet UI, one set of CRUD endpoints, one masking/audit path. The sentinel is
already an accepted pattern in this codebase.

### 5.3a `customer_saved_coupons` / `tenant_coupons` — no schema change, sentinel scope

Coupon-wallet parity works the same way (§7.6). Platform coupons are
`tenant_coupons` rows under `tenant_id = '_platform_'`; marketing customers
save them into the **existing** `customer_saved_coupons` wallet with
`tenant_id = '_platform_'`. Because both tables have hard FKs to `tenants`,
the migration **seeds the platform pseudo-tenant row** (`tenants.id =
'_platform_'`) if absent — this also hardens today's pay-page coupon path,
which already validates against `_platform_` when a campaign has no tenant.

Prerequisites the migration must guarantee for the platform scope:
- `tenants` row `_platform_` exists (FK target for coupons, wallet rows,
  payment methods).
- `resolveEffectiveCapabilities('_platform_')` resolves coupon-enabled
  defaults (`coupon_options.enabled = true`, all discount types allowed,
  targeting allowed) — today the pay page's coupon failure path is
  warn-and-continue, which masks a misconfigured platform scope.
- Wallet DTO mapper resolves `_platform_` → platform name + operator logo
  (`platform_settings_list` / `mkt_branding_config`) instead of a tenant
  profile.
- `CrmOptionsService.resolveCrmOptionsState` resolves
  `{ enabled: true, customerTicketsEnabled: true }` for the platform CRM
  scope (§7.7) — support tickets reuse the same capability gate as tenant
  tickets.

**Sentinel drift warning:** the codebase has **two** platform sentinels —
`'_platform_'` (coupon validation fallback, this spec's commerce scope) and
`'platform'` (`PLATFORM_TENANT_ID` in `crm-personal.ts`, used for
user→platform CRM tickets). This spec keeps both in place deliberately (see
§7.7: tickets use `'platform'` because the operator hub already aggregates
it) and resolves open question #3 as: introduce shared constants
`PLATFORM_COMMERCE_SCOPE = '_platform_'` and `PLATFORM_CRM_SCOPE =
'platform'`, with a follow-up task to unify them behind one tenant row +
constant in a later migration. New code must never introduce a third
spelling.

### 5.4 New table: `mkt_customer_claim_tokens` (core — Path B, §4.3)

Single-use, short-TTL claim tokens for the email-awareness path. One token
per **email** (not per campaign): claiming with it links every paid,
unclaimed campaign matching that email — preserving multi-campaign awareness
for historical payers in one click.

```prisma
model mkt_customer_claim_tokens {
  id          String    @id @db.VarChar(255)
  token       String    @unique @db.VarChar(255)
  email       String    @db.VarChar(255)
  campaign_ids Json     @default("[]")   // snapshot of eligible campaign ids at issue time
  claimed_at  DateTime? @db.Timestamptz(6)
  expires_at  DateTime  @db.Timestamptz(6)  // 24h from issue
  created_at  DateTime  @default(now()) @db.Timestamptz(6)

  @@index([email], map: "idx_mkt_claim_email")
}
```

Rules: token single-use (`claimed_at` set on success); expiry sweep
invalidates stale tokens; re-requesting issues a fresh token and voids prior
unclaimed ones for that email; `campaign_ids` is a snapshot for audit, but
the claim service re-derives eligibility at claim time (a campaign paid
*after* the email was sent is still claimed).

### 5.5 No column changes to `customers`

The existing model (auth fields, verification, lockout, consent flags,
metadata) is sufficient. Marketing ops buyers simply have
`platform_orders = 0` and empty tenant relationships until they shop at a
tenant storefront. The only Prisma-level addition is relation back-references
(no columns, no data migration): `mkt_campaigns_list`,
`marketing_revenue`, and `mkt_customer_branding` (§5.6).

### 5.6 New table: `mkt_customer_branding`

Marketing ops customers get receipt/QR branding parity with tenants
(`mkt_branding_config` precedent, §7.4). One row per customer:

```prisma
model mkt_customer_branding {
  id           String    @id @db.VarChar(255)
  customer_id  String    @unique @db.VarChar(255)
  logo_url     String?   @db.VarChar(500)
  asset_url    String?   @db.VarChar(500)  // QR scan destination; falls back to campaign.website_url
  brand_color  String?   @db.VarChar(7)    // QR dot/corner color; falls back to platform primary
  created_at   DateTime  @default(now()) @db.Timestamptz(6)
  updated_at   DateTime  @default(now()) @db.Timestamptz(6)
  customers    customers @relation(fields: [customer_id], references: [id], onDelete: Cascade)

  @@index([customer_id], map: "idx_mkt_customer_branding_customer")
}
```

Logo binary storage reuses the existing platform file-upload pipeline (the
same one backing operator logo uploads for `mkt_branding_config`); this table
stores only the resulting URL. Max 2MB, PNG/JPG/SVG, square-cropped preview
in the portal.

### 5.7 `crm_support_tickets` — optional campaign link (additive)

Support tickets need no structural change (§7.7): `customer_id` FK and
nullable `tenant_id` already exist. One optional additive column so a
customer's ticket can reference the campaign it's about:

```prisma
model crm_support_tickets {
  // … existing fields …
  campaign_id  String? @db.VarChar(255)  // mkt campaign this ticket concerns

  @@index([campaign_id], map: "idx_crm_tickets_campaign")
}
```

No FK to `mkt_campaigns_list` (cross-domain soft reference, matches how CRM
already soft-references orders/inquiries); the value is set only by the
marketing portal endpoints, never accepted from tenant-scoped flows.

### 5.8 `customer_addresses` — no change at all

The address wallet is **globally per-customer** (no `tenant_id` column) with
`is_billing` / `is_default` flags already present. Marketing customers use it
as-is (§7.8); the only work is portal visibility and consumption (billing
address on receipts, checkout prefill).

### 5.9 New table: `crm_customer_alert_states` (per-customer alert state)

`crm_alerts.is_read` / `is_dismissed` live on the alert row — shared state,
correct for a single tenant's stream but wrong for a **broadcast to many
marketing customers** (one customer reading must not mark it read for all).
Platform-scope alerts therefore get a per-customer state join; tenant-scope
alert behavior is untouched (no regression to the existing storefront UX):

```prisma
model crm_customer_alert_states {
  id           String    @id @db.VarChar(255)
  alert_id     String    @db.VarChar(255)
  customer_id  String    @db.VarChar(255)
  read_at      DateTime? @db.Timestamptz(6)
  dismissed_at DateTime? @db.Timestamptz(6)
  created_at   DateTime  @default(now()) @db.Timestamptz(6)
  customers    customers @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  crm_alerts   crm_alerts @relation(fields: [alert_id], references: [id], onDelete: Cascade)

  @@unique([alert_id, customer_id], map: "crm_customer_alert_states_unique")
  @@index([customer_id, dismissed_at], map: "idx_crm_alert_states_customer")
}
```

Only written for alerts with `tenant_id = 'platform'`. Unread badge for the
portal = platform alerts (visible to this customer per §7.9 targeting rules)
with no state row or `read_at IS NULL`, newer than the customer's
`crm_customer_read_states` watermark (`scope = 'platform_alerts'`) — the
watermark powers "mark all read" without writing N join rows.

---

## 6. Backend API Surface

### 6.1 Claim endpoints (extend `marketing-ops-public.ts` — ptoken-gated)

| Method | Route | Body | Behavior |
|--------|-------|------|----------|
| POST | `/api/public/marketing/pay/claim` | `{ ptoken, email, password?, firstName?, lastName?, oauthProvider?, oauthId? }` | **Path A.** Resolve ptoken → campaign. If email matches an existing verified customer → 409 with `requires_login`. Else register customer (reuse `CustomerAuthService.register`), verify email flow starts, run claim service, return JWT tokens + claim summary (all campaigns linked). |
| POST | `/api/public/marketing/pay/claim/login` | `{ ptoken, email, password }` | **Path A, existing account:** login → claim service → return tokens. |
| POST | `/api/public/marketing/claim/request` | `{ email }` | **Path B.** If email matches ≥1 paid, unclaimed campaign → issue `mkt_customer_claim_tokens` row (voiding prior unclaimed tokens for that email) and send claim email. **Always** returns the same generic success message (enumeration resistance). Rate-limited per email + IP. |
| GET | `/api/public/marketing/claim/:token` | — | **Path B.** Validate claim token (exists, unclaimed, unexpired) → return masked summary (business initials / campaign count / total spent range) to render the claim landing page. Never returns full purchase details pre-auth. |
| POST | `/api/public/marketing/claim/:token/complete` | `{ mode: 'register' \| 'login', email?, password?, oauthProvider?, oauthId?, firstName?, lastName? }` | **Path B.** Register or login → claim service links all eligible campaigns → mark token `claimed_at` → return JWT tokens + claim summary. Token email must match account email (register: prefilled + locked to token email; login: must match an existing verified account with that email). |

Rules:
- Path A endpoints require a **paid** token (`paid_at IS NOT NULL`) — claims
  before payment are rejected (prevents harvesting campaign links).
- **One claim service** (`MarketingCustomerService.claimAllEligible(customer,
  email, { via })`) backs all three paths: links every paid, unclaimed
  campaign matching the verified email (sets `campaign.customer_id` + its
  `marketing_revenue.customer_id`), plus — for Path A — the specific campaign
  from the ptoken regardless of email match (the payer may have paid with a
  different email than they register with).
- Claim is idempotent: re-claiming an already-claimed campaign by the same
  customer returns success; by a different customer returns 409.
- Every claim writes an `audit_log` row (`action: customer_claim`,
  `entity_type: mkt_campaign`, diff includes campaign_id + customer_id +
  claim path) and a `mkt_stage_history_list` note so operators see "Customer
  claimed account" in the campaign timeline.
- The claim summary returned to the frontend includes `campaignsLinked`
  (count + names) so the success UI can say "We found 3 purchases for your
  account" — multi-campaign awareness is surfaced at the moment of claim,
  not discovered later.

### 6.2 Customer portal endpoints (new `marketing-customer.ts` — customer JWT required)

Mounted at `/api/customer/marketing/*`. Auth: existing customer JWT middleware
(the same one protecting `/api/customer-payment-methods`). All queries filter
by `customer_id` from the verified token — **never** from request params.
Every route additionally enforces the platform-context signal (§4.2):
customers with no marketing relationship receive `403 context_required`
before any query runs.

Session/context payload change (shared with storefront side):

| Method | Route | Change |
|--------|-------|--------|
| GET | `/api/customer-auth/me` | Response gains `contexts: { storefront: boolean, platform: boolean }` (server-computed per §4.2). Same field added to register/login/OAuth/claim responses so the portal can render the correct sections on first paint. |

| Method | Route | Returns |
|--------|-------|---------|
| GET | `/api/customer/marketing/overview` | counts: purchases, active campaigns, deliverables available, total spent |
| GET | `/api/customer/marketing/purchases?page&limit` | paginated `marketing_revenue` rows joined to campaign (business name, service category label, amount, discount, date, receipt availability) |
| GET | `/api/customer/marketing/purchases/:revenueId/receipt` | receipt **view model** (JSON) for the HTML receipt page: line items, discount, total, payment date, masked transaction ref, platform branding, customer branding (logo, brand color), resolved QR destination URL (§7.4) — 404 unless revenue belongs to customer |
| GET | `/api/customer/marketing/purchases/:revenueId/receipt.pdf` | PDF receipt with QR embedded (§6.5) — 404 unless revenue belongs to customer |
| GET | `/api/customer/marketing/branding` | customer's `mkt_customer_branding` row (or defaults) + effective QR preview config |
| PUT | `/api/customer/marketing/branding` | `{ assetUrl?, brandColor? }` — upsert branding row; URL validated (http/https only, no platform-internal hosts) |
| POST | `/api/customer/marketing/branding/logo` | multipart logo upload (≤2MB, PNG/JPG/SVG) → existing file pipeline → updates `logo_url` |
| DELETE | `/api/customer/marketing/branding/logo` | removes logo; receipts/QRs fall back to platform branding |
| GET | `/api/customer/marketing/campaigns` | claimed campaigns with **customer-safe** projection (see §6.4) |
| GET | `/api/customer/marketing/campaigns/:campaignId` | campaign detail: status timeline, deliverables, receipts |
| GET | `/api/customer/marketing/campaigns/:campaignId/deliverables` | paid deliverables with download URLs (reuses existing deliverable file serving) |
| POST | `/api/customer/marketing/payment-methods/save-from-payment` | `{ paymentIntentId }` — attaches the PI's payment method to the customer's `_platform_` scope (Stripe `setup_future_usage` path, see §6.3) |
| GET | `/api/customer/marketing/coupons/applicable?campaignId=` | wallet coupons (platform scope) currently valid for this campaign's price + service category — powers the one-click-apply list at portal checkout (§7.5) |
| POST | `/api/customer/marketing/checkout` | `{ campaignId, couponCode? \| savedCouponId?, useSavedMethodId?, billingAddressId? }` — repeat-purchase checkout for a claimed campaign's follow-on package or retainer; if `useSavedMethodId`, off-session charge via saved PM; `savedCouponId` redeems a wallet coupon (§7.5); `billingAddressId` snapshots the wallet address onto the receipt (§7.8) |
| GET | `/api/customer/marketing/support/tickets?status=` | customer's platform-scope tickets (`tenant_id = 'platform'`), same DTO as `/api/customer/crm/tickets` (§7.7) |
| POST | `/api/customer/marketing/support/tickets` | `{ title, description?, category?, campaignId? }` — creates a customer→platform ticket; `campaignId` validated against the customer's claimed campaigns before being stamped on the ticket (§5.7) |
| GET | `/api/customer/marketing/support/tickets/:ticketId` | ticket + message thread (`is_internal` messages never returned) — 404 unless ticket belongs to customer |
| POST | `/api/customer/marketing/support/tickets/:ticketId/messages` | `{ content }` — customer reply; reopens `waiting` tickets; read-state tracking reused |
| GET | `/api/customer/marketing/alerts?unread=` | platform alerts visible to this customer per §7.9 targeting (broadcast ∪ targeted), joined with per-customer state (§5.9); `dismissed` excluded |
| PUT | `/api/customer/marketing/alerts/:alertId/read` | upsert state row `read_at` — 404 unless alert is platform-scope AND visible to this customer |
| PUT | `/api/customer/marketing/alerts/:alertId/dismiss` | upsert state row `dismissed_at` (same visibility check) |
| PUT | `/api/customer/marketing/alerts/read-all` | advances the `platform_alerts` watermark in `crm_customer_read_states` (no mass join-row writes) |

### 6.3 Saved-card plumbing (extend backend `CustomerPaymentMethodsService`)

- **Gateway resolution:** when `tenant_id === '_platform_'`, use the platform
  Stripe account (`platform_payment_config` / `STRIPE_SECRET_KEY`) instead of
  `merchant_stripe_connections`. One branch in the existing resolver.
- **Save at payment time:** `SubscriptionBillingService.createOneTimePaymentIntent`
  gains `setupFutureUsage: 'off_session'` when the payer opts in on the pay
  page. On `pay/confirm`, if the payer created/logged into an account and
  opted in, attach `paymentIntent.payment_method` to the platform-scoped
  Stripe customer and insert the `customer_payment_methods` row.
- **Off-session repeat charges:** follow the existing pattern in
  `promotion-renewal.ts` / `featured-placement-renewal.ts` (already charging
  saved cards off-session with `customer` + `payment_method` + `off_session:
  true`), pointed at the platform account.
- **SCA failure handling:** off-session declines requiring authentication
  must email the customer a re-authentication link (Stripe
  `authentication_required` → portal checkout with card entry). This mirrors
  how renewal jobs already treat hard declines.

### 6.4 Customer-safe campaign projection

The portal **never** returns raw `mkt_campaigns_list`. A mapper whitelists:

| Exposed | Derived / hidden |
|---------|------------------|
| `business_name`, `city`, `category`, `service_category` (+ label) | — |
| Customer-facing status enum (see §7.3) | internal `stage` string mapped |
| `date_paid`, `date_delivered` | internal stage timestamps for seek/preview/shown hidden |
| Paid deliverables (title, type, download URL) | preview/watermarked deliverables hidden |
| Receipts (amount, discount, date, download URL) | `gateway_transaction_id` truncated to last 4 of PI id or hidden entirely |
| Campaign `display_id` as "Order reference" | internal `id` not needed in UI (but fine in URLs) |

**Hidden:** `notes`, `pain_score`, `estimated_*`, `pain points`, prompt data,
`assigned_to`, `created_by`, hot-prospect flags, cascade config, audit caches,
contact-enrichment internals, cost/tokens, retainer pitch internals.

### 6.5 Receipt PDF rendering with QR (shared module)

The jsPDF generator (currently inline in `marketing-ops-public.ts`) is
extracted to `apps/api/src/services/marketing/MarketingReceiptPdfService.ts`
and extended for QR parity with tenant receipts:

1. **Resolve QR destination** (per §7.4 priority): customer `asset_url` →
   campaign `website_url` → omit QR block entirely.
2. **Generate QR server-side** with the `qrcode` package (already an API
   dependency): PNG data-URL at `errorCorrectionLevel: 'H'` (mandatory when a
   center logo is overlaid; keep it regardless for scan reliability).
3. **Logo compositing:** when `mkt_customer_branding.logo_url` exists, fetch
   the logo (same fetch-to-base64 pattern the generator already uses for the
   platform logo), composite it centered at ~35% of the QR size with a white
   quiet-zone pad — matching the `qr-code-styling` parameters used on the web
   (`imageSize: 0.35`, `hideBackgroundDots: true`) so PDF and HTML receipts
   render the same QR.
4. **Brand color:** QR rendered in `brand_color` when set (contrast-checked
   luminance ≥ 0.35 against white; falls back to platform primary), else
   platform primary color.
5. **Layout:** QR block sits in the receipt footer next to the totals, with
   caption "Scan to visit {business name}" — analogous to the tenant
   receipt's "Get Directions" block (`OrderReceipt.tsx:522`).
6. Both the authenticated portal PDF route and the existing public
   `ptoken`-gated receipt route use this service. The public route keeps its
   current behavior but gains the QR block (the payer's receipt should look
   identical before and after account creation).

### 6.6 Receipt email (new `MarketingReceiptEmailService`)

Triggered from `pay/confirm` after revenue insert (fire-and-forget with
retry, same pattern as recovery delivery):

- To: `campaign.email` (fallback: email collected on pay page — see §7.1).
- Content: platform-branded receipt (reuse jsPDF output as attachment),
  amount, service, business name, portal CTA ("Create your free account to
  track your order" if unclaimed; "View in your portal" if claimed).
- Idempotency: `marketing_revenue.receipt_emailed_at` set on success; the
  confirm endpoint returns immediately regardless of email outcome.
- Failure: logged to `notification_logs`; operator-visible resend button on
  the campaign detail (same pattern as recovery "Resend Email").

---

## 7. Frontend Surfaces

### 7.1 Pay page modifications (`PayPageClient.tsx`)

1. **Email field (optional, prefilled).** If the campaign has an email, the
   pay page prefills it (token-resolved, not user-typed) and offers an
   editable override. Needed for the receipt email and claim prefill.
2. **"Save this card for future purchases" checkbox** (unchecked default,
   shown only if the payer creates/logs into an account — or deferred to the
   success screen, simpler for v1: show checkbox on success screen after
   account creation, calling `save-from-payment`).
3. **Success screen → Account CTA panel:**
   - If unauthenticated: "Create your free account" — email prefilled,
     password field (or Google OAuth button), copy: *"Track your order,
     download deliverables, and check out faster next time."*
   - If already authenticated as another customer: "Link this purchase to
     your account" via `claim/login`.
   - If skipped: unchanged behavior (receipt download only). The receipt
     email still carries the create-account CTA, giving a second conversion
     touchpoint.
4. Keep the entire pre-payment flow identical. No registration wall. The QR
   → pay conversion funnel is the operator's revenue path and must not gain
   friction.
5. **Returning-payer state (link lifecycle).** The pay endpoint already
   returns `alreadyPaid` — the page must act on it. A payer who revisits
   their foot-in-the-door link after paying sees **not** the payment form
   but a "You're all set" state: payment confirmation, receipt download, and
   the account-creation CTA (Path A) or "Track my purchase" (Path B). The
   same link the operator shared for payment thus becomes the customer's
   account-creation path after the money lands — one URL, two jobs, in
   sequence. Expired tokens keep the existing expired-page behavior with a
   "Request new link" escape hatch.

### 7.1a Public claim pages (Path B, §4.3)

- **`/marketing/claim`** — "Track my purchase" entry: single email field +
  submit. Always shows the generic confirmation ("If we find purchases for
  this email, we've sent you a link") regardless of matches. Linked from the
  pay page footer, receipt emails, and the customer login page.
- **`/marketing/claim/[token]`** — claim landing from the email link. Shows
  the masked summary from `GET /claim/:token` ("We found 2 purchases
  totalling $$$ for {business initials}") and a register-or-login form with
  the email prefilled and locked to the token's email. On success → redirect
  to `/account/marketing` with a "Purchases linked" toast listing the
  campaigns claimed.
- Expired/used token → friendly error page with a **Request a new link**
  button (re-enters `/marketing/claim` flow prefilled).

### 7.2 Portal section (`/account/marketing`)

New sidebar group in `CustomerSidebar`: **"My Services"** (platform context),
rendered **only when `contexts.platform` is true** (§4.2). Storefront sections
(orders, coupons, downloads, addresses) render only when `contexts.storefront`
is true. A both-context customer sees two clearly separated groups — e.g.
"Shopping" (storefront) and "My Services" (platform) — with no merged views.
Follows existing `/account` page conventions — server-fetched via the new
`MarketingCustomerService` (frontend), same loading/empty/error states as
`/account/orders`.

| Page | Content | Context gate |
|------|---------|--------------|
| `/account/marketing` | **Multi-campaign overview** — cards: total spent, active engagements, deliverables ready; all claimed campaigns listed with status (review / recovery / profile repair mix, filterable by category and status); recent purchases table across all campaigns (service, business, amount, date, receipt link). A customer with three campaigns sees one unified home | platform |
| `/account/marketing/purchases` | Full payment history table: date, service category, business, amount, discount, status, **View Receipt** / **Download PDF** | platform |
| `/account/marketing/receipts/[revenueId]` | Full HTML receipt view (§7.4): line items, totals, platform branding, customer logo, styled QR to asset URL, **Download PDF** button | platform |
| `/account/marketing/campaigns/[id]` | Work tracking: status timeline (see §7.3), deliverable downloads (paid only), receipts for this campaign, package summary | platform |
| `/account/marketing/settings` | **Business profile & branding:** logo upload (with live QR-style preview), asset URL field, brand color picker; explains where these appear (receipts, QR codes) | platform |
| `/account/marketing/support` | **Support tickets to the platform** (§7.7): list, create (with optional "which service is this about?" campaign picker), threaded view, reply | platform |
| `/account/addresses` | Existing address wallet — becomes **context-agnostic** (§7.8): visible in either context; billing addresses feed marketing checkout + receipts | shared |
| `/account/payment-methods` | Cards grouped by scope: storefront scopes under their tenant name, `_platform_` cards under "VisibleShelf services". Each group renders only when its context is active; the page itself stays available in either context | per-group |
| `/account/coupons` | Existing wallet page — coupons grouped by scope: tenant groups under tenant names, `_platform_` coupons under "VisibleShelf services" (§7.5). Add-by-code accepts platform codes. Per-group context rendering, same as payment methods | per-group |

Direct URL access without the context: the route group checks the context
signal client-side (redirect to `/account`) **and** the API returns
`403 context_required` (§6.2) — the page renders an "Unavailable" state from
the 403 rather than empty data, so deep links can't leak the section's
existence shape.

Zero-context accounts (registered but never purchased or claimed anywhere):
portal home shows profile/settings only — no storefront sections, no My
Services, no marketing explainer upsell in v1.

### 7.3 Customer-facing status model

Internal stage machines (review, recovery, triage) collapse to a
customer-legible progression:

| Customer status | Label | Maps from (internal stages) |
|-----------------|-------|------------------------------|
| `payment_received` | "Payment received" | `paid`, `intake_submitted` (recovery pre-draft) |
| `in_production` | "We're working on it" | `paid` → before `delivered`; recovery `final_resolution_drafted` |
| `delivered` | "Delivered" | `delivered`, `resolved_and_closed` |
| `active_plan` | "Active service plan" | `retainer_won`, subscription active |
| `completed` | "Completed" | terminal states post-delivery |
| — (no exposure) | — | `seek`, `preview_built`, `shown`, `lost`, `dead`, cascade stages |

Timeline UI: `Payment received → In production → Delivered` with timestamps
from `date_paid` / `date_delivered`. Recovery campaigns surface a customer-
safe note at `intake_submitted`: "We received your information" (the intake
they submitted themselves).

### 7.4 Receipt & QR experience — parity with tenant receipts

Tenant customers today get a full receipt view (`OrderReceipt.tsx`) with PDF
download and a QR code scanning to the tenant's location. Marketing ops
customers get the same luxury, adapted to the platform context:

| Element | Tenant receipt (today) | Marketing receipt (this spec) |
|---------|------------------------|-------------------------------|
| Receipt view | `OrderReceipt.tsx` HTML view | `/account/marketing/receipts/[revenueId]` (new, same layout conventions) |
| PDF download | yes | yes — `MarketingReceiptPdfService` (§6.5), also emailed (§6.6) |
| QR destination | tenant location (directions URL) | **customer's asset URL** (see priority below) |
| QR styling | `TenantQRCode` / `qr-code-styling` themes | same engine; `brand_color` applied to dots/corners |
| QR center logo | tenant logo | **customer's uploaded logo** from `/account/marketing/settings` |
| Receipt header | tenant branding | platform branding (operator) + customer logo co-brand |

**QR destination priority** (first match wins, resolved server-side in the
receipt view model + PDF service):

1. `mkt_customer_branding.asset_url` — customer-set destination (their new
   website, booking page, Google review link, deliverable landing page).
2. `mkt_campaigns_list.website_url` — the business URL captured on the
   campaign.
3. No URL → QR block omitted (never render a QR to a platform-internal page;
   the customer's receipt promotes *their* asset, not ours).

**Logo-on-QR support:** rendered with `qr-code-styling` (web) using the
existing parameters — center image at `imageSize: 0.35`,
`hideBackgroundDots: true`, `errorCorrectionLevel: 'H'` — and composited
equivalently in the PDF (§6.5). The settings page shows a **live QR preview**
that updates as the customer uploads a logo, sets an asset URL, or picks a
brand color, using `buildQROptions`-style options so what they see is what
prints.

**Validation & safety:**
- `asset_url` must be http(s); platform-internal hosts and redirect-shortener
  domains are rejected server-side (the QR represents the customer's business,
  and a malicious destination would reflect on the operator's brand).
- Logo: ≤2MB, PNG/JPG/SVG (SVG sanitized), auto-downscaled for QR compositing.
- Brand color: contrast-checked for scannability (§6.5 step 4).
- Branding is **per customer, not per campaign** — a customer with three
  campaigns gets one logo/asset identity across all their receipts; the
  campaign's `website_url` remains the per-campaign fallback.

### 7.5 Coupon wallet — parity with tenant customers

Tenant customers can **save coupons** to a wallet (`/account/coupons`) and
**purchase with coupon awareness** (applicable coupons surfaced at checkout,
savings shown, status lifecycle saved → redeemed/expired, expiry reminders).
Marketing customers get the same, via the `_platform_` scope (§5.3a) — **no
new wallet tables, no new wallet endpoints**: the existing
`/api/customer-coupons/*` routes and `CustomerCouponWalletService` accept the
platform scope as their `tenantId` parameter.

| Capability | Tenant (today) | Marketing (this spec) |
|------------|----------------|------------------------|
| Save coupon | storefront coupon surfaces + save-by-code | **save-by-code in portal** (`/account/coupons` add-by-code accepts platform codes); codes arrive via operator campaigns, receipt emails, retainer pitches |
| Wallet view | `/account/coupons` grouped by tenant | same page — platform coupons grouped under **"VisibleShelf services"** (platform name + operator logo per §5.3a DTO mapping); group renders only with platform context, tenant groups only with storefront context (§4.2) |
| Purchase awareness | applicable coupons at storefront checkout | `GET /coupons/applicable?campaignId=` list at portal checkout (§7.6) with **one-click apply**, discount preview, and savings shown on the confirmation + receipt (`discount_cents` already on `marketing_revenue`) |
| Status lifecycle | saved → redeemed / expired | identical — wallet row flips to `redeemed` on successful portal checkout |
| Reminders | `customer_coupon_reminders` expiry nudges | identical — expiring platform coupons trigger reminder emails; for marketing these double as **retainer re-engagement** touchpoints |

**Redemption flow (portal checkout with `savedCouponId`):**
1. Server loads the wallet row (must belong to the JWT customer, platform
   scope, status `saved`).
2. Re-validates via `CouponService.validateCoupon('_platform_', code, …)`
   against the campaign's price and **service category** — coupon targeting
   (`target_type = 'categories'`) maps to marketing `service_category`
   values, so operators can issue category-specific offers (e.g., recovery-
   only discounts). Never trust the client-side total (same rule as the
   public pay page).
3. In one transaction: apply discount → create/confirm payment → insert
   `marketing_revenue` (with `discount_cents`) → flip wallet row to
   `redeemed` (`redeemed_at`) → increment `tenant_coupons.redemption_count`
   → insert `coupon_redemptions` row linked to the revenue record.
   Payment-confirm idempotency keys prevent double redemption on retries.
4. Failed payment → wallet row stays `saved`, redemption not recorded.

**Coupon sources for marketing customers** (how codes reach the wallet):
operator-set `campaign.coupon_code` (auto-saved to the customer's wallet at
claim time if one was applied — the payer's first wallet entry arrives
pre-populated), receipt-email offers, retainer-pitch offers, and operator
one-off codes entered via save-by-code.

### 7.6 Repeat purchase / retainer checkout

From a claimed campaign detail, if the operator has set a follow-on
`package_price_cents` or `subscription_tier_id`:

- "Purchase again / Upgrade" button → portal checkout page
- Default payment method on file preselected (off-session charge per §6.3)
- Coupon field (server-validated, same service)
- Falls back to Stripe Elements when no saved card or SCA required

This closes the retainer loop: the `retainer_pitched` stage gains a
customer-facing destination instead of an email-only pitch.

### 7.7 Support tickets — customer → platform, parity with customer → tenant

Tenant customers file CRM support tickets against a tenant
(`/api/customer/crm/tickets`, capability-gated per tenant). Marketing
customers file tickets against the **platform** — and the operator side of
this **already exists**: the personal CRM hub aggregates
`tenant_id = PLATFORM_TENANT_ID` tickets (`crm-personal.ts:34,124`), so
customer→platform tickets land in an admin surface that is already built and
already staffed.

**Scope decision:** tickets use `tenant_id = 'platform'` (the existing
`PLATFORM_TENANT_ID`), **not** `'_platform_'` — because the operator
aggregation queries that value today. This is the one sanctioned exception
to the `_platform_` commerce sentinel; see the sentinel-drift note in §5.3a.

| Element | Tenant ticket (today) | Marketing ticket (this spec) |
|---------|----------------------|------------------------------|
| Create | `POST /api/customer/crm/tickets` with `tenant_id` | `POST /api/customer/marketing/support/tickets` — server stamps `tenant_id = 'platform'`, customer never supplies a scope |
| Capability gate | `customerTicketsEnabled` per tenant | platform-scope CRM options resolve enabled (§5.3a prerequisite) |
| Threading | `crm_ticket_messages`, `is_internal` hidden | identical — same services (`CrmTicketService`, `CrmTicketMessageService`), same internal-note hiding |
| Context link | ticket → tenant | ticket → **campaign** via optional `campaign_id` (§5.7), picked from the customer's claimed campaigns ("Which service is this about?") |
| Portal UI | ticket list grouped by tenant (name + logo enrichment) | `/account/marketing/support` — platform group only, enriched with platform name + operator logo; both-context customers see tenant groups and the platform group in one list, separated like payment methods/coupons |
| Operator UI | tenant CRM ticket board | **existing personal CRM hub** (platform tickets already aggregated); campaign detail gains a "Support tickets" chip when `campaign_id` linked tickets exist |

Rules: new tickets default `category = 'marketing_ops'` unless the customer
picks another; `campaign_id` is validated against the customer's claimed
campaigns server-side; ticket create/reply writes `audit_log` rows; the
customer can only read/reply to their own tickets (`customer_id` from JWT,
404 otherwise); `is_internal` messages are stripped at the service layer, not
the UI layer.

### 7.8 Address wallet — shared by construction

`customer_addresses` has **no tenant scoping** — it is a per-customer wallet
with `is_default` and `is_billing` flags. Marketing customers therefore get
full parity with zero backend changes:

- **Portal availability:** `/account/addresses` becomes context-agnostic
  (like `/account/settings` and `/account/payment-methods`) — visible for
  platform-only, storefront-only, and both-context customers. A platform-only
  customer typically holds one address: their business billing address.
- **Marketing consumption:**
  - Portal checkout (§7.6) offers wallet addresses for the **billing
    address** (`billingAddressId`), prefilled from the default billing
    address; "Add new address" writes back to the same wallet.
  - The receipt view model + PDF (§6.5) render the billing address block
    when one was snapshotted at checkout or set as default billing —
    matching what businesses need for expense records.
  - Claim-time convenience: the claim form optionally captures a billing
    address, creating the customer's first wallet entry (labeled "Business").
- **No bleed, by schema:** because addresses are customer-global, a
  both-context customer maintains **one** address book serving storefront
  delivery and platform billing — this is the intended design (addresses are
  an identity attribute, not a commerce-scope attribute), and the only
  shared wallet across the two contexts.

### 7.9 Alerts — operator → marketing customer, targeted and broadcast

Tenant customers receive CRM alerts from their tenants (order updates,
abandoned-cart nudges, tenant-level info/warning). Marketing customers
receive alerts from the **platform**: targeted (one customer) or broadcast
(all platform-context customers). Same `crm_alerts` table, same customer
alert services — platform scope rides the existing conventions:

**Alert taxonomy (platform scope, `tenant_id = 'platform'`):**

| Type | Audience | Targeting (follows existing metadata conventions) | Per-customer state |
|------|----------|----------------------------------------------------|--------------------|
| `mkt_direct` | one customer | `metadata.customer_id` (stable id, not email) | §5.9 join row |
| `mkt_broadcast` | all platform-context customers | no targeting metadata | §5.9 join row |
| `mkt_campaign` | customers of one campaign | `metadata.campaign_id` → resolved to claimed customers at read time | §5.9 join row |

**Visibility rule (read-time filter, extends the existing pattern in
`crm-customer.ts:394`):** a customer sees a platform alert iff
`hasPlatformContext` (§4.2) **and** (no targeting metadata | `customer_id`
matches | their claimed campaigns include `campaign_id`). Storefront-only
customers never receive platform alerts; tenant alerts never leak into the
marketing surface — the same no-bleed doctrine as every other section.

**Customer surfaces:** unread badge in the `/account` shell; alerts listed
on the `/account/marketing` overview and in `/account/notifications` under a
platform group (same grouping treatment as coupons/cards). Read/dismiss are
per-customer (§5.9) — one customer's read never marks a broadcast read for
another. v1 is in-app only; email mirroring of alerts honors
`customer_notification_preferences` and is a v1.1 toggle.

**Operator surfaces (§8.3):** compose targeted alerts from the campaign
detail or customer chip; compose broadcasts from the Marketing Ops
dashboard; delivery stats (sent / read / dismissed counts from the §5.9
join) on each sent alert.

---

## 8. Operator (Admin) Touchpoints

Minimal admin changes — this spec is customer-facing, but operators need
visibility into both halves of the funnel: the foot-in-the-door link they
share, and the account status of who paid.

### 8.1 Payment Link panel — the foot-in-the-door link, visible on the campaign

**Gap today:** pay links are minted (`MarketingDeliverableService.
generateCampaignToken` → `mkt_deliverable_preview_tokens`, served as
`/marketing/pay?ptoken=…`) but the campaign detail's Pricing & Payment panel
shows only price/coupon fields and revenue records — no link, no QR, no
token status (`CampaignDetailClient.tsx:733`).

The Pricing & Payment panel gains a **Payment Link** block:

- **Active pay URL** (`/marketing/pay?ptoken=…`) with **Copy** and **QR**
  (reuse the existing QR components; QR encodes the same URL for in-person
  closes).
- **Token lifecycle status per token:** created, `viewed_at` (prospect
  opened it), `paid_at`, `expires_at`; multiple tokens listed (deliverable
  QR + demo storefront may coexist) with the active one highlighted.
- **Regenerate** — mints a fresh token (existing service method) and
  supersedes expired ones; per the user guide, operators already expect
  30-day expiry and manual regeneration.
- **Price guard:** if `package_price_cents` is unset, the block shows a
  warning ("Set a package price before sharing") instead of the link.

New admin endpoints (extend `marketing-ops.ts`):

| Method | Route | Returns |
|--------|-------|---------|
| GET | `/api/admin/marketing-ops/campaigns/:id/pay-links` | all preview tokens for the campaign with status fields + resolved pay URLs |
| POST | `/api/admin/marketing-ops/campaigns/:id/pay-links` | mint/regenerate a token (`token_type`, `expires_in_days`); returns the new URL + QR payload |

### 8.2 Customer account & claim visibility — who converted

1. **Campaign detail → Overview tab:** "Customer account" chip showing linked
   customer (name, email, `customer_number`) with a **View customer** link
   into the CRM customer record (`crm_contacts` already links `customers`).
   When unclaimed but paid, the chip shows "Payment received — no account
   yet" with a **Send claim invite** action (triggers the Path B claim email
   to `campaign.email`, §4.3) — the operator can nudge the foot-in-the-door
   payer into the portal manually.
2. **Stage history note** on claim events (§6.1), including which path
   (A/B/C/operator-invite) drove the claim.
3. **Receipt email status** on revenue records: `receipt_emailed_at` +
   resend button (mirrors recovery delivery tracking).
4. **Support tickets land in the existing personal CRM hub** — platform
   tickets (`tenant_id = 'platform'`) are already aggregated there
   (`crm-personal.ts`); customer→platform tickets simply appear in that same
   queue with author_type `customer`. Campaign detail gains a "Support
   tickets" chip listing `campaign_id`-linked tickets (§7.7).
5. No new admin pages in v1. The existing campaign detail and CRM surfaces
   absorb the new data — **plus one composer** (§8.3).

### 8.3 Alert composer — targeted and broadcast (§7.9)

The one genuinely new admin UI in this spec (the customer side reuses
existing stacks; the operator alert *reader* exists but there is no
customer-directed alert composer today):

- **Targeted:** "Send alert" action on the campaign detail (requires a
  claimed customer) and on the customer chip — pre-fills
  `metadata.customer_id` / `campaign_id`, operator writes title + body +
  icon.
- **Broadcast:** composer on the Marketing Ops dashboard — title, body,
  icon, optional `campaign_id` scoping (alert all customers of one
  campaign's cohort) or full broadcast; confirmation dialog shows the
  computed recipient count **before** sending.
- **History + stats:** sent-alerts list with sent/read/dismissed counts
  (counts from the §5.9 join) per alert.

Admin endpoints (extend `marketing-ops.ts`):

| Method | Route | Body / returns |
|--------|-------|----------------|
| POST | `/api/admin/marketing-ops/alerts` | `{ title, body, icon?, type: 'mkt_direct' \| 'mkt_broadcast' \| 'mkt_campaign', customerId?, campaignId? }` — validates target (claimed customer / claimed campaign), creates `tenant_id = 'platform'` alert, audits |
| GET | `/api/admin/marketing-ops/alerts?page=` | sent platform alerts with recipient/read/dismissed counts |
| GET | `/api/admin/marketing-ops/alerts/recipient-count?type=&campaignId=` | pre-send recipient estimate for the confirmation dialog |

Rules: `mkt_direct` requires `customerId` of a platform-context customer;
`mkt_campaign` requires a campaign with ≥1 claimed customer; broadcasts
require a second-confirmation with recipient count; every send writes
`audit_log` (actor = operator, before/after = alert payload); alerts are
**informational only** — no payment demands, no links asking for card
details (phishing-surface guard; see §9).

### 8.4 The two-sided funnel, end to end

```
OPERATOR SIDE                              CUSTOMER SIDE
─────────────                              ─────────────
Payment Link panel:                        Link visit #1 (unpaid):
  copy link / QR  ──────────────────────►  pay form (no account wall)
  share via email/QR/in-person                    │
Link status: viewed ✓                             ▼
                                           Payment success ──► create-account CTA (A)
Link status: paid ✓                      Link visit #2+ (alreadyPaid):
Chip: "no account yet"  ── invite ──────►  claim email (B) or "all set" CTA
Stage note: claimed via B                Register/verify ──► sweep (C)
Chip: customer linked ✓                         │
                                                ▼
                                         /account/marketing portal
                                         (purchases, work, receipts,
                                          coupons, tickets, addresses)
```

---

## 9. Security & Privacy

- **Auth boundaries:** public endpoints stay ptoken-gated only; portal
  endpoints require the customer JWT middleware. No mixing: a `ptoken` never
  unlocks portal data, and a JWT never resolves another customer's campaign.
- **Claim security:** claims require paid token + (new account with email
  verification started | existing account password/OAuth). The registration
  sweep only executes for **verified** emails.
- **PII minimization:** portal responses use the §6.4 whitelist mapper.
  Receipt PDFs never render full card numbers (existing behavior: masked).
- **Payment data:** card details never touch our servers (Stripe Elements /
  PaymentMethod attach, unchanged). `customer_payment_methods` stores gateway
  tokens only.
- **Rate limiting:** claim endpoints and registration sweep get the existing
  rate-limit middleware; failed claim attempts counted against the existing
  `failed_login_attempts`/lockout machinery where password-based.
- **Audit:** claims, saved-card additions, off-session charges, and receipt
  resends write `audit_log` rows (actor = customer id, `actor_type` customer).
- **Consent:** account creation on the success screen sets
  `email_consent = true`; marketing opt-in checkbox separate
  (`marketing_consent`, unchecked default).
- **Alert anti-phishing rule:** platform alerts (§7.9) are informational
  only. The composer rejects bodies containing payment links or card-detail
  requests; customer-facing alert UI renders plain text with no forms. A
  compromised or careless operator account must not turn the alert channel
  into a payment-harvesting vector aimed at customers who trust platform
  notifications.
- **Alert visibility is read-time enforced:** the §7.9 targeting filter runs
  server-side on every read/state mutation; `customer_id`/`campaign_id`
  metadata is never trusted from clients.

---

## 10. Rollout Plan

### Phase 1 — Linkage + Receipts (foundation)
1. Migration: §5.1, §5.2 columns + indexes; §5.4 `mkt_customer_claim_tokens`;
   §5.3a platform pseudo-tenant seed (`_platform_`) + coupon capability
   defaults for the platform scope.
2. Extract receipt PDF generator into shared module (used by public route +
   portal route).
3. `MarketingReceiptEmailService` + `receipt_emailed_at` + admin resend;
   receipt email carries the Path B claim CTA for unclaimed payers.
4. One claim service + Path A claim endpoints + Path B endpoints
   (`claim/request`, `claim/:token`, `claim/:token/complete`) + registration
   claim sweep (§6.1).
5. Pay page: email field + success-screen account CTA (§7.1);
   returning-payer `alreadyPaid` state (§7.1 item 5); public claim pages
   `/marketing/claim` + `/marketing/claim/[token]` (§7.1a).
6. Operator Payment Link panel + pay-link endpoints (§8.1) and "Send claim
   invite" action (§8.2).
7. Audit logging for claims (all paths, with claim path in the diff).

**Exit criteria:** a payer can create an account on the success screen; a
**historical payer** (paid pre-portal via the public pay page) can enter
their email on `/marketing/claim`, receive a claim link, register, and see
their past purchase(s); claim links all eligible campaigns in one action;
the operator sees the pay link, its viewed/paid status, and QR on the
campaign detail, and can send a claim invite to a paid-but-unclaimed payer;
a payer revisiting their link post-payment sees the "all set" state, not a
second pay form; receipt email lands; enumeration resistance and token
single-use/expiry verified in test.

### Phase 2 — Portal + Context Gating + Receipt Parity
7. Context signal computation (§4.2) + `contexts` field on `/me` and
   register/login/claim responses; `CustomerAuthContext` caching and
   invalidation.
8. `MarketingCustomerService` (frontend) + `marketing-customer.ts` routes
   with `403 context_required` enforcement.
9. `/account/marketing` pages + signal-gated sidebar groups + status mapper
   (§7.2, §7.3).
10. Receipt parity: receipt view model endpoint, HTML receipt page
    (`/account/marketing/receipts/[revenueId]`), `MarketingReceiptPdfService`
    with QR embed (§6.5), public receipt route switched to the shared service.
11. Branding: `mkt_customer_branding` migration + endpoints +
    `/account/marketing/settings` page with live QR preview (§7.4).
11a. Support tickets (§7.7): platform CRM capability defaults (§5.3a),
    `crm_support_tickets.campaign_id` migration (§5.7), marketing support
    endpoints, `/account/marketing/support` page, campaign-detail ticket
    chip.
11b. Address wallet (§7.8): `/account/addresses` context-agnostic
    visibility; billing-address snapshot on receipt view model/PDF.
11c. Alerts (§7.9, §8.3): `crm_customer_alert_states` migration (§5.9),
    customer alert endpoints + read-time targeting filter, unread badge +
    portal alert surfaces, operator composer + admin alert endpoints with
    recipient pre-count.

**Exit criteria:** claimed customer sees purchases, timeline, deliverables,
receipts (HTML view + PDF with QR); a customer-uploaded logo and asset URL
appear identically in the HTML receipt QR and the PDF receipt QR; receipts
without any asset URL render no QR block; customer files a platform support
ticket linked to a campaign and the operator sees it in the existing
personal CRM hub + on the campaign detail; addresses page is visible in
either context and a default billing address renders on receipts;
unauthorized access returns 401/404 on every portal route; storefront-only
customer gets 403 on marketing routes and never sees the My Services group;
both-context customer sees both groups with no merged data.

### Phase 3 — Card on File + Repeat Purchase
12. `_platform_` scope in backend `CustomerPaymentMethodsService`.
13. `setup_future_usage` + `save-from-payment` + checkbox UI.
14. Portal repeat/retainer checkout (§7.6) incl. off-session + SCA fallback.
15. Coupon parity (§7.5): platform-scope coupon capability defaults + wallet
    DTO mapping (§5.3a), applicable-coupons endpoint, one-click apply +
    transactional redemption at checkout, campaign coupon auto-save at
    claim, expiry reminders for platform coupons.

**Exit criteria:** returning customer pays for a follow-on package with a
saved card in one click; SCA-required declines route to interactive checkout;
cards manageable in `/account/payment-methods`; customer saves a platform
coupon by code, sees it under "VisibleShelf services" in `/account/coupons`,
applies it at portal checkout in one click, and the wallet row flips to
redeemed with savings shown on the receipt.

### Phase 4 (v1.1, optional)
16. Stripe Customer Portal hosted page evaluation.
17. Agency-style business grouping (multiple distinct businesses under one
    login) — deferred per resolved open question #4.

---

## 11. Testing & Acceptance

**Unit/API tests** (alongside existing route tests):
- Claim endpoints (all paths): paid-token required (A), idempotency,
  cross-customer 409, unverified-email sweep blocked (C), claim token
  single-use + 24h expiry + re-request voids prior tokens (B),
  `claim/request` response identical for matching and non-matching emails
  (enumeration resistance), claim service links **all** eligible campaigns
  for the email in one call (multi-campaign), Path A ptoken claim works even
  when payer email ≠ registration email.
- Portal endpoints: JWT required; customer A cannot read customer B's
  purchases/campaigns/receipts (401/404, not 200-with-filter).
- Context separation: storefront-only customer → `403 context_required` on
  every `/api/customer/marketing/*` route; `/me` returns correct
  `contexts` flags for storefront-only, platform-only, both, and zero-context
  accounts; flags flip correctly after first claim / first storefront order.
- Status mapper: every internal stage maps to a customer status or is hidden.
- `_platform_` payment-method CRUD; Stripe attach/detach mocked.
- Receipt email idempotency (`receipt_emailed_at`).
- Receipt QR: destination priority (asset_url → campaign website_url →
  omitted), `asset_url` validation rejects non-https and platform-internal
  hosts, brand-color contrast fallback, PDF embeds same QR payload as HTML
  view, logo compositing at error-correction H remains scannable (fixture
  decode test with `qrcode`-compatible decoder).
- Branding endpoints: logo size/type rejection, SVG sanitization, one row
  per customer (upsert), delete falls back to platform branding.
- Coupon parity: platform-scope coupon validates via existing
  `CouponService` (capability gate resolves enabled for `_platform_`);
  save-by-code under platform scope; applicable-coupons endpoint honors
  min-spend, expiry, redemption caps, and service-category targeting;
  checkout redemption is transactional (payment failure leaves wallet row
  `saved`, retry with same idempotency key cannot double-redeem or
  double-increment `redemption_count`); wallet DTO maps `_platform_` to
  platform name/logo; campaign coupon auto-saved at claim.
- Support tickets: marketing ticket endpoints stamp `tenant_id = 'platform'`
  server-side (client-supplied scope ignored); `campaignId` rejected when
  not in the customer's claimed campaigns; customer A gets 404 on customer
  B's ticket; `is_internal` messages stripped from every customer response
  (service layer); reply reopens `waiting` tickets; platform capability gate
  disabled → 403 with `crm_customer_tickets_disabled`.
- Address wallet: no tenant filter anywhere in address queries (regression
  guard); billing address snapshot immutable on receipt after payment;
  platform-only customer sees `/account/addresses`.
- Pay-link endpoints: list returns correct per-token status; regenerate
  mints a new token without invalidating paid tokens; pay page renders the
  `alreadyPaid` state (no PaymentIntent created on revisit — assert checkout
  endpoint rejects paid campaigns, existing behavior preserved); "Send
  claim invite" requires a paid, unclaimed campaign with an email.
- Alerts: broadcast visible to all platform-context customers and to **no**
  storefront-only customers; targeted alert visible only to its
  `metadata.customer_id`; campaign alert resolves claimed customers at read
  time (new claim after send → sees the alert); read/dismiss by customer A
  never affects customer B's state; read-all advances the watermark without
  touching other scopes; tenant-scope alert behavior byte-identical
  (regression guard on existing customer alert endpoints).

**E2E (Playwright, extend existing specs near `recovery-ops.spec.ts`):**
- Pay → success → create account → portal shows purchase + receipt view +
  PDF download.
- Pay anonymously → register later with same email → verify → purchase
  appears in portal.
- Historical payer: pay anonymously → later visit `/marketing/claim` →
  email link → register → all past purchases visible, including a second
  campaign paid with the same email (multi-campaign claim).
- Returning payer: pay → revisit the same pay link → "all set" state with
  account CTA (no second pay form); expired link → request-new-link flow.
- Operator funnel: Payment Link panel shows link + QR → status flips to
  viewed after payer visit, paid after payment → "Send claim invite" →
  customer claims → chip shows linked customer + stage note records path.
- Upload logo + set asset URL in settings → receipt view QR carries logo;
  downloaded PDF QR matches; scan-decode the rendered QR to assert payload.
- Saved card repeat purchase happy path + SCA fallback path.
- Coupon journey: save platform coupon by code → appears under "VisibleShelf
  services" in `/account/coupons` → one-click apply at retainer checkout →
  wallet shows redeemed + receipt shows savings; expired coupon blocked at
  checkout with wallet status flip to `expired`.
- Support journey: claimed customer creates a ticket linked to their
  campaign → operator replies from the personal CRM hub → customer sees the
  reply (no internal notes) and responds; campaign detail shows the ticket
  chip.
- Address journey: platform-only customer adds a billing address → receipt
  PDF renders it; both-context customer uses the same wallet for storefront
  delivery and platform billing.
- Alert journey: operator sends targeted alert from campaign detail →
  customer badge increments → read/dismiss; operator broadcasts with
  recipient pre-count → two customers read at different times, each state
  independent; storefront-only customer sees neither badge nor alert.

**Migration dry run** on staging with existing paid campaigns; verify no
backfill writes occur and indexes build online.

**Manual UAT script:** operator creates campaign → pay via QR → claim →
portal walkthrough → retainer checkout with saved card.

---

## 12. Open Questions

1. ~~**Nav visibility:** hide "My Services" for customers with zero marketing
   purchases, or show with explainer?~~ **RESOLVED (2026-08-03):** visibility
   is signal-driven per §4.1/§4.2. Storefront (tenant) and platform
   (marketing) are separate contexts with no bleed; each side's views render
   only when the customer holds relationships on that side; both signals →
   both views. Enforced server-side (`403 context_required`), not just by
   hidden nav.
2. **Retainer billing owner:** should portal-initiated retainers go through
   `SubscriptionBillingService` subscriptions (platform Stripe) or remain
   operator-managed? Affects whether Phase 3 includes subscription creation.
3. ~~**`_platform_` sentinel formalization:**~~ **RESOLVED (2026-08-03):**
   two sentinels exist today — `'_platform_'` (commerce: coupons, payment
   methods) and `'platform'` (CRM tickets, `PLATFORM_TENANT_ID` in
   `crm-personal.ts`). Both are kept deliberately: tickets stay on
   `'platform'` because the operator hub already aggregates it (§7.7).
   Introduce shared constants `PLATFORM_COMMERCE_SCOPE` and
   `PLATFORM_CRM_SCOPE` in Phase 1, and never introduce a third spelling;
   unifying them behind one tenant row is a later migration.
4. ~~**Multiple campaigns per customer:** business/agency grouping?~~
   **RESOLVED (2026-08-03):** per-customer branding confirmed; the account is
   explicitly **multi-campaign aware** — one flat, filterable list across
   review/recovery/profile-repair campaigns with per-campaign
   `business_name`, no business grouping in v1. Historical payers convert
   via Path B (email awareness) and the claim service links **all** eligible
   campaigns in one action (§4.3).
5. **Deliverable download URLs in portal:** reuse the existing token-based
   file serving, or issue short-lived signed URLs per customer session?
   (Recommendation: customer-JWT-gated endpoint streaming the file; avoids
   minting new public tokens for paid deliverables.)

---

## 13. Key Files Reference

| Area | File |
|------|------|
| Pay page (frontend) | `apps/web/src/app/marketing/pay/PayPageClient.tsx` |
| Pay page (service) | `apps/web/src/services/MarketingPayPublicService.ts` |
| Public payment routes | `apps/api/src/routes/marketing-ops-public.ts` |
| Payment intents | `apps/api/src/services/subscription/SubscriptionBillingService.ts` |
| Campaign paid transition | `apps/api/src/services/MarketingCampaignService.ts` (`markCampaignPaid`) |
| Customer auth (backend) | `apps/api/src/routes/customer-auth.ts`, `apps/api/src/services/CustomerAuthService.ts` |
| Customer tokens | `apps/api/src/services/CustomerTokenService.ts` |
| Payment methods (backend) | `apps/api/src/services/CustomerPaymentMethodsService.ts`, `apps/api/src/routes/customer-payment-methods.ts` |
| Frontend base class | `apps/web/src/providers/base/CustomerApiSingleton.ts` |
| Frontend auth service | `apps/web/src/services/CustomerAuthService.ts` |
| Frontend payment methods | `apps/web/src/services/CustomerPaymentMethodsService.ts` |
| Portal shell | `apps/web/src/app/account/layout.tsx`, `apps/web/src/components/customer/CustomerSidebar.tsx` |
| Off-session charge pattern | `apps/api/src/jobs/promotion-renewal.ts`, `apps/api/src/jobs/featured-placement-renewal.ts` |
| Tenant receipt (parity target) | `apps/web/src/components/checkout/OrderReceipt.tsx` (QR block: lines 522–548) |
| QR styling engine | `apps/web/src/lib/qr-style-config.ts`, `apps/web/src/lib/qr-engine.ts`, `apps/web/src/components/public/TenantQRCode.tsx` |
| Server QR generation | `qrcode@^1.5.4` (`apps/api/package.json`) |
| Operator branding precedent | `mkt_branding_config` (`schema.prisma`:6095) |
| Coupon wallet (backend) | `apps/api/src/routes/customer-coupons.ts`, `apps/api/src/services/CustomerCouponWalletService.ts` |
| Coupon validation | `apps/api/src/services/CouponService.ts` (`validateCoupon`:336) |
| Coupon models | `tenant_coupons` (`schema.prisma`:5998), `customer_saved_coupons` (6046), `customer_coupon_reminders` (6027) |
| Customer support tickets | `apps/api/src/routes/crm/customer/crm-customer.ts`, `apps/web/src/services/crm/CrmCustomerService.ts` |
| Platform ticket aggregation (operator) | `apps/api/src/routes/crm/personal/crm-personal.ts` (`PLATFORM_TENANT_ID`:34) |
| Address wallet | `customer_addresses` (`schema.prisma`:994), `apps/web/src/services/CustomerAddressesService.ts`, `/account/addresses` |
| Campaign detail (operator) | `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` (Pricing & Payment: line 733) |
| Pay-link token minting | `apps/api/src/services/MarketingDeliverableService.ts` (`generateCampaignToken`), `apps/api/src/services/MarketingCampaignService.ts` (demo URL composition: lines 1387–1395) |
| Admin marketing ops routes | `apps/api/src/routes/marketing-ops.ts` |
| Customer alert endpoints | `apps/api/src/routes/crm/customer/crm-customer.ts` (alerts: lines 362–530) |
| Alert model / read watermark | `crm_alerts` (`schema.prisma`:778), `crm_customer_read_states` (821) |
| Schema | `apps/api/prisma/schema.prisma` (`customers`:1106, `customer_payment_methods`:1044, `mkt_campaigns_list`:6110, `marketing_revenue`:6545) |
| User guide | `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md` (§24 Public Pay Page) |
