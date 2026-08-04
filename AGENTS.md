# AGENTS.md — Project Conventions

## Build & Typecheck Commands

- `pnpm checkapi` — TypeScript check for `apps/api` (`tsc --noEmit --project apps/api`)
- `pnpm checkweb` — TypeScript check for `apps/web` (`tsc --noEmit --project apps/web`)
- `pnpm prisma:generate` — Regenerate Prisma Client (run after schema changes)
- `doppler run --config local -- pnpm prisma db pull` — Pull DB schema into `prisma/schema.prisma` (run from `apps/api`)
- `doppler run --config local -- pnpm prisma generate` — Regenerate client with Doppler secrets

## Architecture

- **Backend:** Node.js + Express + TypeScript in `apps/api`
  - Routes in `apps/api/src/routes/` (registered via `routeRegistry.ts`)
  - Services in `apps/api/src/services/`
  - Prisma ORM; schema at `apps/api/prisma/schema.prisma`
  - Migrations in `database/migrations/` (numbered, e.g. `161_*.sql`)
  - `RequestCtx` type lives in `apps/api/src/context.ts` (NOT `middleware/auth.ts`)
  - Config via `unifiedConfig` from `apps/api/src/config/unifiedConfig.ts` (NOT `config.ts`)
  - `audit()` helper in `apps/api/src/audit.ts` accepts optional `actorType: 'user' | 'system' | 'integration' | 'customer'`
- **Frontend:** Next.js (App Router) + TypeScript in `apps/web`
  - Pages in `apps/web/src/app/`
  - Services in `apps/web/src/services/` (extend `PublicApiSingleton` or `CustomerApiSingleton`)
  - Customer auth context: `apps/web/src/contexts/CustomerAuthContext.tsx`
  - Customer auth service: `apps/web/src/services/CustomerAuthService.ts` (singleton; `applyExternalAuth()` persists tokens from external auth flows)

## Conventions

- Platform sentinel: use `'platform'` (the `tenants.id = 'platform'` row). Do NOT use `'_platform_'`.
- `PLATFORM_SCOPE` constant: `apps/api/src/lib/platform-scope.ts`
- Marketing Ops public routes mount at `/api` (so routes are `/api/public/marketing/*`)
- Marketing Ops admin routes mount at `/api/admin/marketing-ops`
- Customer auth routes mount at `/api/customer-auth`
- Frontend public services extend `PublicApiSingleton` with `ttl: 0` for no caching
- Double-wrap response contract: unwrap with `result.data?.data ?? result.data`
- Mantine UI is used on marketing public pages (`@mantine/core`); customer account pages use Tailwind + `@/components/ui/*`
- Tabler icons: use `IconLogin` (not `IconLogIn`)

## Marketing Ops Customer Portal (Phase 1)

Spec: `docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md`

Key files:
- `apps/api/src/services/MarketingCustomerService.ts` — claim service (`claimAllEligible`, `issueClaimToken`, `getClaimTokenSummary`, `consumeClaimToken`, `registrationClaimSweep`)
- `apps/api/src/services/marketing/MarketingReceiptPdfService.ts` — shared receipt PDF generator
- `apps/api/src/services/marketing/MarketingReceiptEmailService.ts` — receipt + claim invite emails
- `apps/api/src/routes/marketing-ops-public.ts` — public pay + claim endpoints (§6.1)
- `apps/api/src/routes/marketing-ops.ts` — admin pay-link + send-claim-invite endpoints (§8.1, §8.2)
- `apps/web/src/services/MarketingClaimPublicService.ts` — frontend claim service
- `apps/web/src/app/marketing/claim/` — public claim pages (Path B)
- `apps/web/src/app/marketing/pay/PayPageClient.tsx` — pay page with email field + account CTA

Three claim paths, one claim service:
- **Path A** (at payment): pay page success screen → register/login → `claimViaPayRegister` / `claimViaPayLogin`
- **Path B** (email awareness): `/marketing/claim` → email → claim link → `/marketing/claim/[token]` → register/login
- **Path C** (registration sweep): `CustomerAuthService.verifyEmail` / `oauthLogin` → `registrationClaimSweep` (fire-and-forget)

## Marketing Ops Customer Portal (Phase 2 — Authenticated Portal)

Context signals (§4.2):
- `CustomerAuthService.computeContexts(customerId)` returns `{ storefront, platform }` booleans
- `contexts` field on `/me` and all auth responses (login, register, oauth, claim)
- Frontend `CustomerAuthContext` exposes `contexts` and refreshes after claim/purchase events

Portal backend (§6.2, §6.4, §6.5, §7.3, §7.4, §7.7, §7.9):
- `apps/api/src/routes/marketing-customer.ts` — authenticated portal routes at `/api/customer/marketing/*`
  - All routes require customer JWT + `requirePlatformContext` gate (403 `context_required`)
  - Endpoints: overview, campaigns, purchases, receipts (view + PDF), branding, support tickets, alerts
- `apps/api/src/services/MarketingCustomerProjection.ts` — customer-safe projection:
  - `projectCampaign` / `projectCampaigns` — whitelists fields, hides internal stages
  - `mapCustomerStatus` — maps internal stages to customer-legible statuses (§7.3)
  - `buildPortalOverview` — aggregates total spent, active engagements, deliverables ready
  - `buildReceiptViewModel` — receipt DTO with QR destination + branding resolution (§7.4)

Portal frontend (§7.2, §7.4, §7.7, §7.9):
- `apps/web/src/services/MarketingCustomerService.ts` — extends `CustomerApiSingleton`, wraps all portal endpoints
- `apps/web/src/app/account/marketing/` — portal pages:
  - `page.tsx` — overview (summary cards + campaigns + recent purchases)
  - `purchases/page.tsx` — full payment history table
  - `campaigns/[id]/page.tsx` — campaign detail with progress timeline + deliverables + receipts
  - `receipts/[revenueId]/page.tsx` — HTML receipt view with QR
  - `settings/page.tsx` — branding settings with live QR preview
  - `support/page.tsx` + `support/[ticketId]/page.tsx` — support tickets
  - `alerts/page.tsx` — platform alerts with mark-read/dismiss
- `apps/web/src/components/customer/CustomerSidebar.tsx` — signal-gated nav groups:
  - "Shopping" group (storefront context)
  - "My Services" group (platform context)
  - "Account" group (context-agnostic, §7.8)
  - Unread alert badge on Notifications (refreshes every 60s when platform context active)

Migrations:
- `162_mkt_customer_branding.sql` — per-customer branding (logo, asset URL, brand color)
- `163_crm_tickets_campaign_id.sql` — additive `campaign_id` on `crm_support_tickets`
- `164_crm_customer_alert_states.sql` — per-customer alert read/dismiss state

## Marketing Ops Customer Portal (Phase 3 — Card on File + Repeat Purchase)

Saved-card plumbing (§6.3):
- `CustomerPaymentMethodsService.savePaymentMethodFromIntent(customerId, pi)` — attaches a PI's payment_method to the customer's platform-scoped Stripe customer
- `CustomerPaymentMethodsService.getOrCreateStripeCustomer` is now public (was private)
- `SubscriptionBillingService.createOneTimePaymentIntent` accepts `setupFutureUsage` + `customer` params
- `SubscriptionBillingService.stripeInstance` getter (public accessor for the private Stripe instance)
- `ConversionSource` type extended with `'portal_checkout'`
- Pay page (`/marketing/pay`) passes `saveCard` → `setup_future_usage: 'off_session'` on the PI; post-confirmation, if authenticated + opted in, calls `savePaymentMethodFromIntent`

Portal checkout (§7.6, §7.5):
- `POST /api/customer/marketing/checkout` — repeat-purchase checkout:
  - Off-session charge with `useSavedMethodId` (customer + payment_method + off_session: true)
  - SCA failure → 402 `authentication_required` with clientSecret for frontend fallback
  - Interactive checkout → PI with `setup_future_usage: 'off_session'` + platform Stripe customer
  - Coupon redemption: `savedCouponId` (wallet) or `couponCode` (ad-hoc) → validates + applies discount → flips wallet row to `redeemed`
- `POST /api/customer/marketing/checkout/confirm` — confirms interactive checkout, marks campaign paid, flips coupon, sends receipt email
- `GET /api/customer/marketing/coupons/applicable?campaignId=` — wallet coupons valid for the campaign's price (§7.5)
- `POST /api/customer/marketing/payment-methods/save-from-payment` — attaches PI's PM to platform scope

Frontend checkout:
- `apps/web/src/app/account/marketing/campaigns/[id]/checkout/page.tsx` — portal checkout page:
  - Saved card selection (platform-scope payment methods)
  - Applicable coupon list (one-click apply) + ad-hoc coupon code entry
  - Off-session charge for saved cards; Stripe Elements fallback for new cards
  - Order summary with discount + total
- Campaign detail page gains "Purchase again / Upgrade" button (§7.6)
- `MarketingCustomerService` (frontend) gains `savePaymentMethodFromIntent`, `getApplicableCoupons`, `createCheckout`, `confirmCheckout`
- `MarketingPayPublicService.createCheckout` accepts `saveCard` param
- Pay page shows "Save this card" checkbox when customer is authenticated

## Marketing Ops Customer Portal — Tests (§11)

- `apps/api/src/services/__tests__/MarketingCustomerProjection.test.ts` (24 tests):
  - Status mapper: every internal stage maps to a customer status or is hidden
  - Hidden stages (seek, preview_built, shown, lost, dead) return null
  - Active subscription overrides stage
  - `projectCampaign` whitelists fields (no notes, pain_score, estimated_*, assigned_to)
  - `projectCampaigns` filters out hidden-stage campaigns
- `apps/api/src/tests/marketing-customer-routes.test.ts` (7 tests):
  - JWT required: no auth → 401, invalid token → 401
  - Context gating: storefront-only → 403 context_required, zero-context → 403, platform → 200
  - Cross-customer isolation: customer A gets 404 on customer B's campaign + receipt

## Marketing Ops Customer Portal — Alert Composer (§8.3)

Operator composer for sending alerts to marketing customers (platform-context only).

Backend endpoints (in `marketing-ops.ts`):
- `GET  /api/admin/marketing-ops/alerts/customers` — list marketing customers for recipient picker
- `GET  /api/admin/marketing-ops/alerts/recipient-count` — pre-send recipient estimate
- `POST /api/admin/marketing-ops/alerts` — create targeted / broadcast / campaign-scoped alert
- `GET  /api/admin/marketing-ops/alerts` — sent alerts history with read/dismissed counts

Frontend:
- `/settings/admin/crm/broadcast/marketing` — dedicated marketing broadcast page (mirrors tenant broadcast)
- Campaign detail "Customer Account" section — "Send Alert" link + "Send Claim Invite" button
- `MarketingOpsService` gains `listMarketingAlertCustomers`, `getAlertRecipientCount`, `createMarketingAlert`, `listMarketingAlerts`, `sendClaimInvite`

Alert targeting (stored in `crm_alerts.metadata`):
- `mkt_broadcast` — no metadata, visible to all platform-context customers
- `mkt_direct` — `metadata.customer_id`, visible to one customer
- `mkt_campaign` — `metadata.campaign_id`, visible to customers who claimed that campaign

All alerts use `tenant_id = PLATFORM_SCOPE`. Customer-side reader is in `marketing-customer.ts` (`GET /alerts`, `POST /alerts/:id/read`, etc.).


