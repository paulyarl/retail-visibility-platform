# Social Commerce Integration Plan

## Goal
Enable the platform to serve as an ecommerce store for TikTok and Instagram merchants, with full social platform connectivity, legal compliance, and a self-test path for the platform owner to act as a social merchant.

## Existing Architecture to Leverage
- **OAuth pattern**: `google_oauth_accounts_list` + `google_oauth_tokens_list` tables → replicate for Meta/TikTok
- **Product sync pattern**: `GMCProductSync.ts` + `feed-generator.ts` → replicate for Meta/TikTok catalog APIs
- **OAuth routes pattern**: `google-merchant-oauth.ts` → replicate for Meta/TikTok OAuth flows
- **Orders table**: Already has `source` and `source_id` fields for tracking order origin (e.g., `source: 'tiktok_shop'`)
- **Fulfillment settings**: `tenant_fulfillment_settings` table with pickup/delivery/shipping
- **Capabilities system**: `commerce-capabilities.ts` + tier-based gating
- **Payment gateways**: Stripe, Square, PayPal already integrated
- **Customer auth**: `CustomerAuthService` + `customer-auth.ts` routes
- **Webhook infrastructure**: `webhooks.ts`, `stripe-webhook.ts` patterns
- **GDPR**: `gdpr.ts` routes + `gdpr-compliance.ts` service
- **Terms page**: `apps/web/src/app/terms/page.tsx` (platform-level, needs per-tenant)

---

## Phase 1: Legal Compliance Foundation (P0)

### 1A: Sales Tax Engine
**Problem**: No real-time tax calculation. The `tax_cents` field on orders exists but is never calculated — always defaults to 0.

**Approach**: Use Stripe Tax (simplest integration since Stripe is already a gateway). Fall back to manual tax for non-Stripe merchants.

**Backend**:
- `apps/api/src/services/TaxService.ts` (new) — interface:
  - `calculateTax(subtotalCents, shippingAddress, tenantId) → { taxCents, taxRate, jurisdiction, lineItems[] }`
  - Stripe Tax integration via `stripe.tax.calculations.create()` when Stripe is the payment gateway
  - Manual tax rate fallback: per-tenant `tax_rate_cents` override in `tenant_commerce_settings`
- `apps/api/src/routes/tax.ts` (new) — `POST /api/tax/calculate` (called during checkout before payment)
- Modify `apps/api/src/routes/checkout.ts` — call `TaxService.calculateTax()` before creating the order, populate `tax_cents` field
- Modify `apps/web/src/app/checkout/page.tsx` — call tax calculation API after shipping address entry, display tax line item

**Database**:
- Add to `tenant_commerce_settings` table (or create if needed):
  - `tax_enabled Boolean DEFAULT false`
  - `tax_provider VARCHAR(50)` — 'stripe_tax' | 'manual' | null
  - `manual_tax_rate_percent DECIMAL(5,4)` — e.g., 0.0825 for 8.25%
  - `tax_shipping Boolean DEFAULT false` — whether to tax shipping

**Estimated effort**: 2-3 days

---

### 1B: Per-Tenant Storefront Policies
**Problem**: Only platform-level terms exist at `apps/web/src/app/terms/page.tsx`. No per-tenant return policy, shipping policy, or privacy policy.

**Backend**:
- `apps/api/src/services/StorefrontPolicyService.ts` (new) — CRUD for tenant policies
- `apps/api/src/routes/storefront-policies.ts` (new):
  - `GET /api/public/storefront-policies/:tenantId` — public read
  - `GET /api/tenant/storefront-policies/:tenantId` — merchant read
  - `PUT /api/tenant/storefront-policies/:tenantId` — merchant update

**Database**:
- New table `tenant_storefront_policies`:
  - `id String @id`
  - `tenant_id String @unique`
  - `return_policy TEXT`
  - `shipping_policy TEXT`
  - `privacy_policy TEXT`
  - `terms_of_service TEXT`
  - `refund_policy TEXT`
  - `updated_at DateTime`

**Frontend**:
- `apps/web/src/app/t/[tenantId]/settings/policies/page.tsx` (new) — merchant editor with markdown support
- `apps/web/src/app/tenant/[id]/policies/page.tsx` (new) — public storefront policy pages
- `apps/web/src/app/tenant/[id]/policies/[type]/page.tsx` (new) — individual policy pages (return, shipping, privacy, terms, refund)
- Add policy links to storefront footer

**Estimated effort**: 1-2 days

---

### 1C: CCPA Compliance
**Problem**: GDPR routes exist but CCPA has different requirements (right to know, right to delete, right to opt-out of sale, no discrimination).

**Backend**:
- Extend `apps/api/src/services/gdpr-compliance.ts` → rename to `PrivacyComplianceService` or create separate `apps/api/src/services/ccpa-compliance.ts`
- `apps/api/src/routes/ccpa.ts` (new):
  - `POST /api/ccpa/opt-out-sale` — record "Do Not Sell My Personal Information" request
  - `GET /api/ccpa/data-categories` — list data categories collected (required disclosure)
  - Reuse existing `GET /api/gdpr/data-export` for right-to-know
  - Reuse existing `DELETE /api/account` for right-to-delete

**Database**:
- New table `ccpa_requests`:
  - `id String @id`
  - `customer_id String?`
  - `email String`
  - `request_type VARCHAR(20)` — 'opt_out_sale' | 'know' | 'delete'
  - `status VARCHAR(20)` — 'pending' | 'completed' | 'denied'
  - `completed_at DateTime?`
  - `created_at DateTime`

**Frontend**:
- "Do Not Sell My Personal Information" link in storefront footer
- `apps/web/src/app/privacy/ccpa/page.tsx` (new) — CCPA request form
- Update `apps/web/src/app/terms/page.tsx` with CCPA disclosures

**Estimated effort**: 1 day

---

## Phase 2: Social Platform Integrations (P1)

### 2A: Meta Commerce Integration (Instagram Shopping + Facebook Shop)
**Goal**: Sync product catalog to Meta Commerce Manager, enable Instagram Shopping tags.

**Backend — OAuth**:
- `apps/api/src/lib/meta/oauth.ts` (new) — Meta OAuth helper functions:
  - `getAuthorizationUrl(tenantId, scopes)`
  - `exchangeCodeForTokens(code)`
  - `refreshAccessToken(refreshToken)`
  - `decryptToken(encrypted) / encryptToken(token)`
- Scopes: `catalog_management`, `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`

**Backend — Catalog Sync**:
- `apps/api/src/services/MetaCatalogSyncService.ts` (new) — follows `GMCProductSync.ts` pattern:
  - `syncProduct(tenantId, item)` — POST to Meta Catalog Batch API
  - `batchSyncProducts(tenantId, items[])` — batch upload
  - `updateInventory(tenantId, items[])` — stock updates
  - `updatePricing(tenantId, items[])` — price updates
  - Meta Catalog API base: `https://graph.facebook.com/v21.0/{catalog_id}/products`
- `apps/api/src/lib/meta/feed-generator.ts` (new) — transforms inventory_items to Meta product format (similar to Google feed generator)

**Backend — Routes**:
- `apps/api/src/routes/meta-oauth.ts` (new) — follows `google-merchant-oauth.ts` pattern:
  - `GET /meta/oauth/status?tenantId=`
  - `GET /meta/oauth/connect?tenantId=`
  - `GET /meta/oauth/callback`
  - `POST /meta/catalog/sync` — trigger manual sync
  - `GET /meta/catalog/sync-status?tenantId=`
- `apps/api/src/jobs/meta-catalog-sync.ts` (new) — scheduled job (follows `gmc-scheduled-sync.ts` pattern)

**Backend — Webhooks**:
- `apps/api/src/routes/meta-webhooks.ts` (new):
  - `GET /meta/webhooks` — verification endpoint
  - `POST /meta/webhooks` — receive order events from Meta Commerce

**Database**:
- New tables (mirror Google OAuth pattern):
  - `meta_oauth_accounts_list` — tenant_id, meta_account_id, business_id, catalog_id, instagram_account_id
  - `meta_oauth_tokens_list` — account_id, access_token_encrypted, expires_at, scopes
- Add to `inventory_items` metadata: `meta_product_id` (Meta's product ID for sync tracking)

**Frontend**:
- `apps/web/src/app/t/[tenantId]/settings/integrations/meta/page.tsx` (new) — Meta connection dashboard:
  - OAuth connect/disconnect
  - Catalog sync status + manual sync trigger
  - Instagram Shopping eligibility check
  - Sync error log

**Estimated effort**: 4-5 days

---

### 2B: TikTok Shop Integration
**Goal**: Sync product catalog to TikTok Shop, ingest orders from TikTok Shop, maintain inventory sync.

**Backend — OAuth**:
- `apps/api/src/lib/tiktok/oauth.ts` (new) — TikTok Shop OAuth:
  - `getAuthorizationUrl(tenantId)`
  - `exchangeCodeForTokens(code)`
  - `refreshAccessToken(refreshToken)`
  - TikTok Shop API base: `https://open-api.tiktokglobalshop.com`

**Backend — Catalog Sync**:
- `apps/api/src/services/TikTokCatalogSyncService.ts` (new):
  - `syncProduct(tenantId, item)` — POST to TikTok Shop Product API
  - `batchSyncProducts(tenantId, items[])`
  - `updateInventory(tenantId, items[])`
  - `updatePricing(tenantId, items[])`
  - `getProductCategories()` — fetch TikTok category tree for mapping
- `apps/api/src/lib/tiktok/feed-generator.ts` (new) — transforms inventory_items to TikTok product format

**Backend — Order Ingestion**:
- `apps/api/src/services/TikTokOrderService.ts` (new):
  - `ingestOrder(tiktokOrder)` — transform TikTok order → platform order format
  - Sets `source: 'tiktok_shop'` and `source_id: tiktokOrderId` on orders table
  - Creates customer record if not exists (match by email/phone)
  - Triggers fulfillment workflow

**Backend — Routes**:
- `apps/api/src/routes/tiktok-oauth.ts` (new):
  - `GET /tiktok/oauth/status?tenantId=`
  - `GET /tiktok/oauth/connect?tenantId=`
  - `GET /tiktok/oauth/callback`
  - `POST /tiktok/catalog/sync`
  - `GET /tiktok/catalog/sync-status?tenantId=`
- `apps/api/src/routes/tiktok-webhooks.ts` (new):
  - `POST /tiktok/webhooks/orders` — order creation/update/cancellation
  - `POST /tiktok/webhooks/products` — product approval status changes
- `apps/api/src/jobs/tiktok-catalog-sync.ts` (new) — scheduled sync job

**Database**:
- New tables:
  - `tiktok_oauth_accounts_list` — tenant_id, tiktok_shop_id, seller_name, region
  - `tiktok_oauth_tokens_list` — account_id, access_token_encrypted, refresh_token_encrypted, expires_at, scopes
  - `tiktok_category_mappings` — tenant_id, tiktok_category_id, platform_category_id (maps platform categories to TikTok categories)
- Add to `inventory_items` metadata: `tiktok_product_id`

**Frontend**:
- `apps/web/src/app/t/[tenantId]/settings/integrations/tiktok/page.tsx` (new) — TikTok Shop dashboard:
  - OAuth connect/disconnect
  - Shop info display (shop name, region, status)
  - Catalog sync status + manual trigger
  - Category mapping UI (map platform categories → TikTok categories)
  - Order sync log (TikTok orders ingested)
  - Sync error log

**Estimated effort**: 5-7 days (TikTok Shop API is more complex than Meta)

---

### 2C: Social Pixels & Conversion Tracking
**Goal**: Enable merchants to track conversions for TikTok Ads and Meta Ads.

**Backend**:
- `apps/api/src/services/SocialPixelService.ts` (new) — manages per-tenant pixel IDs:
  - `getPixelConfig(tenantId) → { metaPixelId, tiktokPixelId }`
- `apps/api/src/routes/social-pixels.ts` (new):
  - `GET /api/tenant/social-pixels/:tenantId`
  - `PUT /api/tenant/social-pixels/:tenantId` — set pixel IDs

**Database**:
- New table `tenant_social_pixels`:
  - `id String @id`
  - `tenant_id String @unique`
  - `meta_pixel_id VARCHAR(50)`
  - `meta_access_token VARCHAR(255)` — for Conversions API (server-side)
  - `tiktok_pixel_id VARCHAR(50)`
  - `tiktok_access_token VARCHAR(255)` — for Events API (server-side)
  - `created_at DateTime`
  - `updated_at DateTime`

**Frontend**:
- `apps/web/src/components/tracking/SocialPixels.tsx` (new) — client component that injects:
  - Meta (Facebook) Pixel base code if `metaPixelId` set
  - TikTok Pixel base code if `tiktokPixelId` set
  - PageView event on route change
  - ViewContent event on product page
  - AddToCart event on add-to-cart
  - InitiateCheckout event on checkout page
  - Purchase event on checkout success
- `apps/web/src/app/t/[tenantId]/settings/integrations/pixels/page.tsx` (new) — pixel config UI
- Server-side conversion API calls in `apps/api/src/routes/checkout.ts` — after successful payment, fire server-side Purchase event to Meta Conversions API and TikTok Events API

**Estimated effort**: 2-3 days

---

### 2D: Abandoned Cart Recovery
**Goal**: Automated email reminders for carts left before checkout completion.

**Backend**:
- `apps/api/src/services/AbandonedCartService.ts` (new):
  - `trackCart(cartId, tenantId, customerEmail, items[])` — called on cart updates
  - `markCartConverted(cartId)` — called on successful checkout
  - `getAbandonedCarts(tenantId, hoursOld)` — for merchant dashboard
  - `sendRecoveryEmail(cartId)` — generates recovery email with cart link
- `apps/api/src/jobs/abandoned-cart-recovery.ts` (new) — scheduled job:
  - Runs every 30 minutes
  - Finds carts abandoned > 1 hour but < 24 hours
  - Sends recovery email (max 1 per cart)
- `apps/api/src/routes/abandoned-carts.ts` (new):
  - `GET /api/tenant/abandoned-carts/:tenantId` — merchant dashboard
  - `POST /api/tenant/abandoned-carts/:cartId/resend` — manual resend

**Database**:
- New table `abandoned_carts`:
  - `id String @id`
  - `tenant_id String`
  - `cart_id String`
  - `customer_email String`
  - `customer_name String?`
  - `items Json`
  - `cart_value_cents Int`
  - `recovery_email_sent Boolean DEFAULT false`
  - `recovery_email_sent_at DateTime?`
  - `converted Boolean DEFAULT false`
  - `converted_at DateTime?`
  - `created_at DateTime`
  - `updated_at DateTime`

**Frontend**:
- `apps/web/src/app/t/[tenantId]/insights/abandoned-carts/page.tsx` (new) — merchant dashboard showing abandoned carts, recovery email status, conversion rate

**Estimated effort**: 2-3 days

---

## Phase 3: Social Merchant Experience (P1)

### 3A: Social Share Buttons
**Goal**: Let shoppers share product links to TikTok, Instagram, Facebook, X.

**Frontend**:
- `apps/web/src/components/products/SocialShareButtons.tsx` (new) — client component:
  - Copy link button
  - Share to Facebook
  - Share to X (Twitter)
  - Share via Instagram DM (URL scheme)
  - Share via TikTok (URL scheme / native share API)
  - Uses Web Share API where available, falls back to intent URLs
- Add to product page layouts: `ProductShowcaseLayout.tsx`, `ProductQuickCommerceLayout.tsx`
- Add to `SmartProductCard.tsx` (optional, on hover)

**Estimated effort**: 0.5 days

---

### 3B: Social Proof & UGC Display
**Goal**: Display Instagram/TikTok mentions and customer photos on product pages.

**Backend**:
- `apps/api/src/services/SocialProofService.ts` (new):
  - `fetchMentions(tenantId, productId?)` — fetch tagged Instagram posts via Graph API
  - `moderateMention(mentionId, action)` — approve/reject UGC
- `apps/api/src/routes/social-proof.ts` (new):
  - `GET /api/public/social-proof/:tenantId?productId=`
  - `GET /api/tenant/social-proof/:tenantId` — pending moderation queue
  - `PUT /api/tenant/social-proof/:mentionId/moderate`

**Database**:
- New table `social_mentions`:
  - `id String @id`
  - `tenant_id String`
  - `product_id String?`
  - `platform VARCHAR(20)` — 'instagram' | 'tiktok' | 'facebook'
  - `post_url String`
  - `thumbnail_url String?`
  - `caption TEXT`
  - `author_handle String`
  - `author_avatar_url String?`
  - `moderation_status VARCHAR(20) DEFAULT 'pending'`
  - `created_at DateTime`

**Frontend**:
- `apps/web/src/components/products/SocialProofGallery.tsx` (new) — displays approved UGC mentions on product page
- `apps/web/src/app/t/[tenantId]/settings/social-proof/page.tsx` (new) — moderation queue UI

**Estimated effort**: 2-3 days (depends on Meta Graph API access)

---

## Phase 4: Operational Gaps (P2)

### 4A: Real-Time Shipping Rates
**Goal**: Replace flat-rate shipping with carrier API rates.

**Backend**:
- `apps/api/src/services/ShippingRateService.ts` (new):
  - Interface: `getRates(originAddress, destinationAddress, packageDetails) → Rate[]`
  - EasyPost integration (aggregates USPS, UPS, FedEx)
  - Fallback to flat-rate if no carrier configured
- `apps/api/src/routes/shipping-rates.ts` (new):
  - `POST /api/shipping/rates` — called during checkout after address entry

**Database**:
- Extend `tenant_fulfillment_settings`:
  - `easypost_api_key_encrypted VARCHAR(255)`
  - `realtime_shipping_enabled Boolean DEFAULT false`
  - `carrier_preferences Json` — e.g., `["usps", "ups"]`

**Frontend**:
- Modify `apps/web/src/app/checkout/page.tsx` — call shipping rates API, display carrier options
- `apps/web/src/app/t/[tenantId]/settings/fulfillment/page.tsx` — add EasyPost API key input

**Estimated effort**: 2 days

---

### 4B: Customer Returns Portal
**Goal**: Let customers initiate return requests from their order history.

**Backend**:
- `apps/api/src/services/ReturnRequestService.ts` (new):
  - `createReturnRequest(orderId, items[], reason)`
  - `approveReturnRequest(requestId)`
  - `rejectReturnRequest(requestId, reason)`
  - `getReturnRequests(tenantId)` — merchant view
- `apps/api/src/routes/returns.ts` (new):
  - `POST /api/returns/request` — customer initiates return
  - `GET /api/returns/:requestId` — status check
  - `GET /api/tenant/returns/:tenantId` — merchant queue
  - `PUT /api/tenant/returns/:requestId/approve`
  - `PUT /api/tenant/returns/:requestId/reject`

**Database**:
- New table `return_requests`:
  - `id String @id`
  - `order_id String`
  - `tenant_id String`
  - `customer_id String?`
  - `customer_email String`
  - `items Json` — array of {itemId, quantity, reason}
  - `status VARCHAR(20) DEFAULT 'pending'` — 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled'
  - `reason TEXT`
  - `refund_amount_cents Int?`
  - `refund_method VARCHAR(20)?` — 'original' | 'store_credit'
  - `merchant_notes TEXT?`
  - `approved_at DateTime?`
  - `completed_at DateTime?`
  - `created_at DateTime`

**Frontend**:
- `apps/web/src/app/my-orders/[orderId]/return/page.tsx` (new) — customer return request form
- `apps/web/src/app/t/[tenantId]/orders/returns/page.tsx` (new) — merchant returns queue
- Add "Request Return" button to `BuyerOrderHistory.tsx` order detail

**Estimated effort**: 2-3 days

---

## Phase 5: Self-Test as Social Merchant (Your Test Path)

### 5A: Merchant Onboarding for Social Commerce
**Goal**: Set up your own tenant as a social merchant to test the full flow.

**Steps**:
1. **Create a test tenant** — Sign up through the platform's existing onboarding flow
2. **Add products** — Use the Item Creation Wizard (`/t/[tenantId]/items/new`) to add 5-10 products with images, variants, pricing
3. **Configure fulfillment** — Set up pickup + shipping at `/t/[tenantId]/settings/fulfillment`
4. **Connect payment gateway** — Stripe Connect at `/t/[tenantId]/settings/payment-gateways`
5. **Set storefront policies** — Write return/shipping/privacy policies at `/t/[tenantId]/settings/policies` (Phase 1B)
6. **Enable sales tax** — Configure Stripe Tax at `/t/[tenantId]/settings/commerce` (Phase 1A)

### 5B: Connect Social Platforms
1. **Connect Meta** — `/t/[tenantId]/settings/integrations/meta` (Phase 2A)
   - Authorize via Meta OAuth
   - Select or create a Meta Commerce catalog
   - Sync product catalog → verify products appear in Meta Commerce Manager
   - Enable Instagram Shopping → verify products are taggable in Instagram
2. **Connect TikTok Shop** — `/t/[tenantId]/settings/integrations/tiktok` (Phase 2B)
   - Authorize via TikTok Shop OAuth
   - Map platform categories → TikTok categories
   - Sync product catalog → verify products appear in TikTok Seller Center
   - Test order ingestion → place a test order on TikTok Shop, verify it appears in platform order management
3. **Configure pixels** — `/t/[tenantId]/settings/integrations/pixels` (Phase 2C)
   - Set Meta Pixel ID + TikTok Pixel ID
   - Verify events fire via Meta Events Manager + TikTok Events Manager

### 5C: End-to-End Test Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| **Instagram Shopping** | Tag a product in an Instagram post → click tag → land on product page | Product page loads with correct product, add-to-cart works |
| **TikTok Shop order** | Place order on TikTok Shop → order ingested → fulfill in platform | Order appears in `/t/[tenantId]/orders` with `source: tiktok_shop`, fulfillment updates sync back to TikTok |
| **Checkout with tax** | Add to cart → enter shipping address → see tax line item → complete payment | Tax calculated correctly, `tax_cents` populated on order |
| **Abandoned cart** | Add to cart → leave checkout → wait 1 hour | Recovery email received, cart link restores cart |
| **Return request** | Place order → request return from order history | Merchant sees return request, approve → refund processed |
| **Social share** | Open product page → click share to Instagram | Instagram share intent opens with product URL |
| **Policy pages** | Visit storefront footer → click "Return Policy" | Per-tenant return policy page displays |
| **CCPA opt-out** | Visit storefront footer → "Do Not Sell My Info" → submit form | Request recorded, confirmation shown |
| **Pixel tracking** | ViewContent on product page, AddToCart, InitiateCheckout, Purchase | Events appear in Meta Events Manager + TikTok Events Manager |

---

## Implementation Order

```
Phase 1A: Sales Tax Engine          ████░░░░░░  (2-3 days)
Phase 1B: Storefront Policies       ██░░░░░░░░  (1-2 days)
Phase 1C: CCPA Compliance           █░░░░░░░░░  (1 day)
Phase 2A: Meta Commerce             ██████░░░░  (4-5 days)
Phase 2B: TikTok Shop               ████████░░  (5-7 days)
Phase 2C: Social Pixels             ███░░░░░░░  (2-3 days)
Phase 2D: Abandoned Cart            ███░░░░░░░  (2-3 days)
Phase 3A: Social Share Buttons      █░░░░░░░░░  (0.5 days)
Phase 3B: Social Proof / UGC        ██░░░░░░░░  (2-3 days)
Phase 4A: Real-Time Shipping        ██░░░░░░░░  (2 days)
Phase 4B: Returns Portal            ███░░░░░░░  (2-3 days)
────────────────────────────────────────────────
Total estimated:                    ~25-35 days
```

**Recommended execution order**:
1. **Phase 1A-1C** (compliance first — legal risk)
2. **Phase 2A** (Meta — simpler API, Instagram Shopping is high-value)
3. **Phase 2C** (pixels — quick win, needed for ad attribution)
4. **Phase 2B** (TikTok Shop — most complex, highest value)
5. **Phase 2D** (abandoned cart — revenue recovery)
6. **Phase 3A** (social share — quick win)
7. **Phase 4A-4B** (operational gaps)
8. **Phase 3B** (UGC — nice-to-have, depends on Meta Graph API approval)
9. **Phase 5** (self-test — run throughout, not just at the end)

---

## API Keys & Accounts Needed

| Integration | What to Get | Where |
|-------------|-------------|-------|
| Stripe Tax | Stripe account with Tax enabled | https://dashboard.stripe.com/tax |
| Meta Commerce | Meta Business Account, Commerce Manager catalog | https://commerce.facebook.com |
| Meta Graph API | App with `catalog_management` permission | https://developers.facebook.com |
| TikTok Shop | TikTok Seller Center account, Developer App | https://seller.tiktokglobalshop.com |
| EasyPost | EasyPost account + API key | https://www.easypost.com |
| Meta Pixel | Pixel ID from Events Manager | https://eventsmanager.facebook.com |
| TikTok Pixel | Pixel ID from TikTok Events Manager | https://ads.tiktok.com |

---

## Database Migration Summary

All new tables in a single migration file: `database/migrations/042_social_commerce_tables.sql`

Tables to create:
1. `tenant_storefront_policies` — per-tenant legal policies
2. `ccpa_requests` — CCPA opt-out / data requests
3. `meta_oauth_accounts_list` — Meta OAuth accounts
4. `meta_oauth_tokens_list` — Meta OAuth tokens
5. `tiktok_oauth_accounts_list` — TikTok OAuth accounts
6. `tiktok_oauth_tokens_list` — TikTok OAuth tokens
7. `tiktok_category_mappings` — platform → TikTok category mapping
8. `tenant_social_pixels` — Meta/TikTok pixel configuration
9. `abandoned_carts` — abandoned cart tracking
10. `social_mentions` — UGC mentions for social proof
11. `return_requests` — customer return requests

Tables to extend:
1. `tenant_commerce_settings` (or `tenant_fulfillment_settings`) — add tax config fields
2. `tenant_fulfillment_settings` — add EasyPost config fields

Prisma schema updates: `apps/api/prisma/schema.prisma` — add all new models

---

## Risk Notes

- **Meta Graph API approval** — `catalog_management` permission requires App Review. Plan for 2-4 week review time. Start the app review process in parallel with development.
- **TikTok Shop API access** — Requires TikTok Shop Seller account and Developer App approval. Region availability varies.
- **Stripe Tax** — Available in 40+ countries but not globally. Merchants outside supported regions need manual tax config.
- **Instagram Shopping eligibility** — Requires Instagram business account, linked Facebook Page, and product policy compliance review by Meta.
- **TikTok Shop category restrictions** — Certain product categories are prohibited (e.g., CBD, weapons, certain electronics). Need validation before sync.
