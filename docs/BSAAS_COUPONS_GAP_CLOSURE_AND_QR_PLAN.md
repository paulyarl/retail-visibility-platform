# BSaaS Coupons Gap Closure & Sharable QR Code Plan

**Status**: Draft
**Date**: 2026-07-10
**Prerequisites**: Read `bsaas-coupons-private-features.md` skill document first

---

## Background

The audit in `bsaas-coupons-private-features.md` identified three gaps in the BSaaS coupon/promotion system and an opportunity to add QR code sharing for promo codes and private grants. This document defines a phased plan to close all gaps, deliver the QR feature, and pilot a styled QR rendering library across platform surfaces.

### In-Flight Work: Coupon Targeting

A `CouponTargetService` (`apps/api/src/services/CouponTargetService.ts`) and `coupon_target_rules` table (Prisma model in `schema.prisma`) are already implemented but not yet compiled (Prisma client needs regeneration). The system supports per-coupon targeting constraints:

| Target Field | Purpose |
|--------------|---------|
| `target_features` | Restrict coupon to specific feature keys |
| `target_tiers` | Restrict to specific subscription tiers |
| `target_capability_types` | Restrict to features within a capability type |
| `target_tier_types` | Restrict to individual vs organization tiers |
| `target_demo_status` | Restrict to demo vs non-demo tenants |
| `target_subscription_statuses` | Restrict to active/trialed/etc tenants |

Admin API routes for managing targets already exist in `bsaas-promotions.ts` (`PUT /coupon/:id/targets`, inline targets in `POST /coupon`). The `GET /` endpoint already joins target rules into the response. This plan integrates coupon targeting into the promo validation flow (Phase 1) and uses target metadata to drive QR code icon embedding (Phase 3).

### Gap Summary

| # | Gap | Severity | Current Behavior |
|---|-----|----------|-----------------|
| G1 | Bundle purchases ignore promo codes | **Bug** | Frontend sends `promotionCode`, backend accepts it in schema but charges full price — no validation, no discount |
| G2 | Renewals do not re-apply coupons | **Limitation** | Renewal job charges `price_cents` from metadata. `once`/`repeating`/`forever` coupon durations have no effect after initial purchase |
| G3 | No QR code sharing for promo codes or private grants | **Feature gap** | Admins must manually share promo code strings; no visual/scannable sharing for tenants or sales teams |
| G4 | Platform QR codes are visually uniform | **Opportunity** | All public QR codes (storefront, product, directory) use plain `qrcode` package — black-on-white squares. No styled/branded option for higher tiers |
| G5 | Coupon targeting not enforced at checkout | **In-flight** | `CouponTargetService` exists but `validateCouponTargets()` is not yet called in the purchase flow. Prisma client needs regeneration |

---

## Phase 1: Bundle Promo Code Support (G1 Fix)

**Goal**: Make promo codes work for bundle purchases with the same validation and discount logic as individual features.

### 1.1 Backend — Regenerate Prisma Client (Prerequisite)

The in-flight coupon targeting work added `coupon_target_rules` to `schema.prisma` but the Prisma client was never regenerated, causing 16 TS errors in `checkapi`. Before any other work:

```
cd apps/api && npx prisma generate
```

Verify: `pnpm checkapi` passes with zero errors.

### 1.2 Backend — Extract Shared Promo Validation with Target Checking

**File**: `apps/api/src/routes/bsaas-purchases.ts`

Extract the promo code validation logic (currently inline at lines 959-1000) into a reusable helper function that also calls `CouponTargetService.validateCouponTargets()`:

```typescript
interface PromoValidationResult {
  promotionCodeId: string | null;
  couponId: string | null;
  discountCents: number;
  chargedAmount: number;
  couponDuration: 'once' | 'repeating' | 'forever' | null;
  couponDurationInMonths: number | null;
  couponPercentOff: number | null;
  couponAmountOff: number | null;
  targets: CouponTargets | null;
}

async function validatePromoCode(
  promotionCode: string,
  priceCents: number,
  context: CouponTargetContext
): Promise<PromoValidationResult | { error: string; message: string }>
```

- Same Stripe API calls: `promotionCodes.list`, `coupons.retrieve`
- Same checks: active, max_redemptions, expires_at
- Same discount calc: `percent_off` → `Math.round(priceCents * percent_off / 100)`, `amount_off` → `Math.min(amount_off, priceCents)`
- **New**: Call `CouponTargetService.getInstance().validateCouponTargets(couponId, context)` after retrieving the coupon
- If target validation fails → return `{ error: 'coupon_not_valid_for_feature', message: 'This promo code is not valid for this feature/tier' }` (or the specific reason from the service)
- **New**: Return coupon duration/percent_off/amount_off fields in the result (needed for Phase 2 renewal logic)
- **New**: Return `targets` field (needed for Phase 3 QR icon embedding)
- Returns `{ error, message }` on failure, `PromoValidationResult` on success
- **No behavior change** for the existing individual feature purchase flow — just refactored to call the helper (with added target validation)

### 1.3 Backend — Apply Promo in Bundle Purchase

**File**: `apps/api/src/routes/bsaas-purchases.ts`, `POST /bundle-purchase` handler (line 1154+)

Insert promo validation **before** the `chargePaymentMethod` call (line 1308):

```
After: const { bundleKey, paymentMethodId, promotionCode } = validation.data;
After: trial branch (trial purchases don't charge, so promo codes don't apply)
Before: const chargeResult = await billingService.chargePaymentMethod(...)
```

Steps:
1. Call `validatePromoCode(promotionCode, priceCents)` if `promotionCode` is provided
2. If validation returns error → return same error responses (`invalid_promo_code`, `promo_expired`, `stripe_not_configured`)
3. Use `chargedAmount` (discounted) instead of `priceCents` in `chargePaymentMethod`
4. Store discount metadata in each component's purchase record:
   ```json
   {
     "promotion_code": "SUMMER50",
     "promotion_code_id": "promo_xxx",
     "coupon_id": "coupon_xxx",
     "discount_cents": 950,
     "charged_amount": 5950,
     "price_cents": 6900
   }
   ```
5. Update charge description: `BSaaS Bundle: ${bundle.marketing_name}${promotionCode ? ` (promo: ${promotionCode})` : ''}`
6. Update audit log payload to include discount fields
7. Update notification `amount` to use `chargedAmount`

### 1.4 Frontend — Show Discount Preview in Bundle Modal

**File**: `apps/web/src/app/(platform)/settings/feature-store/page.tsx`

- In the bundle confirmation modal (line 645+), add a "Apply" button next to the promo code input
- On click, call a new lightweight endpoint or compute client-side estimate
- Show discounted price line: ~~$69.00~~ → **$59.50** (SUMMER50 applied)
- If invalid code, show inline error without closing modal
- The `handleConfirmBundlePurchase` function already passes `promoCode` — no change needed there

### 1.5 Tests

- Unit test `validatePromoCode` helper with: valid percent_off, valid amount_off, expired code, max redemptions reached, inactive code, no Stripe key
- **New**: Unit test `validatePromoCode` with coupon targeting: target_features match, target_features mismatch, target_tiers match, target_tiers mismatch, no target rules (pass-through)
- Integration test: bundle purchase with valid promo code → verify charged amount is discounted, metadata includes discount fields + coupon duration fields
- Integration test: bundle purchase with invalid promo code → verify 400 error
- Integration test: bundle purchase with promo code that targets a different feature → verify `coupon_not_valid_for_feature` error
- Integration test: bundle trial with promo code → verify promo code is ignored (trials don't charge)

### 1.6 Skill Document Update

Update `bsaas-coupons-private-features.md`:
- Remove the "Known Gap: Bundle Purchases" warning section
- Add bundle promo code flow to the checkout documentation
- Note that promo codes only apply to non-trial bundle purchases

---

## Phase 2: Renewal Coupon Awareness (G2 Fix)

**Goal**: Make the renewal job aware of coupon durations so that `repeating` and `forever` coupons apply discounts on renewal, while `once` coupons do not.

### 2.1 Design Decision: Metadata-Based Approach

**Approach**: Store coupon metadata at purchase time and read it during renewal. No Stripe Subscriptions migration needed.

At purchase time, the metadata already stores `coupon_id`, `discount_cents`, and `charged_amount`. We need to also store:
- `coupon_duration`: `'once' | 'repeating' | 'forever'`
- `coupon_duration_in_months`: number | null
- `coupon_percent_off`: number | null (for re-calculation if price changes)
- `coupon_amount_off`: number | null
- `original_price_cents`: number (the catalog price before discount)
- `renewal_count`: number (incremented each renewal, starts at 0)

### 2.2 Backend — Enrich Purchase Metadata

**File**: `apps/api/src/routes/bsaas-purchases.ts`

In both the individual feature purchase and bundle purchase handlers, after retrieving the coupon from Stripe, add the extra fields to the metadata:

```typescript
// After: const coupon = await stripe.coupons.retrieve(promo.coupon);
// Add to metadata:
coupon_duration: coupon.duration,
coupon_duration_in_months: coupon.duration_in_months,
coupon_percent_off: coupon.percent_off,
coupon_amount_off: coupon.amount_off,
original_price_cents: priceCents,
renewal_count: 0,
```

### 2.3 Backend — Renewal Job Coupon Logic

**File**: `apps/api/src/jobs/bsaas-renewal.ts`

Add a helper function:

```typescript
function calculateRenewalCharge(
  metadata: any,
  renewalCount: number
): { chargedAmount: number; discountCents: number; couponActive: boolean }
```

Logic:
1. If no `coupon_id` in metadata → charge full `price_cents` (current behavior, no change)
2. If `coupon_duration === 'once'` and `renewalCount > 0` → charge full `original_price_cents`
3. If `coupon_duration === 'once'` and `renewalCount === 0` → charge `charged_amount` (already discounted in initial purchase, but this path shouldn't be hit since the first charge happens at purchase time, not renewal)
4. If `coupon_duration === 'repeating'`:
   - If `renewalCount < coupon_duration_in_months` → apply discount: `discountCents = Math.round(original_price_cents * percent_off / 100)` or `Math.min(amount_off, original_price_cents)`
   - If `renewalCount >= coupon_duration_in_months` → charge full `original_price_cents`
5. If `coupon_duration === 'forever'` → always apply discount

**Integration points in renewal job**:

- **Individual purchases** (line 152+): Replace `priceCents` in `chargePaymentMethod` with `calculateRenewalCharge(metadata, metadata.renewal_count || 0).chargedAmount`. Increment `renewal_count` in updated metadata.
- **Bundle purchases** (line 75+): Same logic, using `firstPurchase.metadata`. Increment `renewal_count` for all component purchases.
- **Trial conversions** (line 258+ for bundles, line 328+ for individual): These are first charges, so `renewalCount === 0`. Apply discount if coupon metadata is present (from trial start). If no coupon was used during trial start, charge full price.
- **Past-due retries** (line 409+): Use same `calculateRenewalCharge` logic with current `renewal_count`.

### 2.4 Metadata Migration for Existing Purchases

**File**: `scripts/migrate_bsaas_coupon_metadata.ps1` (new)

For existing purchases that have `coupon_id` in metadata but lack the new fields:
1. Query Stripe `stripe.coupons.retrieve(coupon_id)` for each unique coupon
2. Update metadata with `coupon_duration`, `coupon_duration_in_months`, `coupon_percent_off`, `coupon_amount_off`, `original_price_cents`
3. Set `renewal_count` based on purchase date: `Math.floor((now - purchased_at) / billing_cycle_days)`
4. Run as one-time script, idempotent

### 2.5 Tests

- Unit test `calculateRenewalCharge`:
  - No coupon → full price
  - `once` duration, renewal 0 → discounted
  - `once` duration, renewal 1+ → full price
  - `repeating` 3 months, renewal 0-2 → discounted
  - `repeating` 3 months, renewal 3+ → full price
  - `forever` duration, any renewal → discounted
- Integration test: purchase with `repeating` coupon → verify renewal charges discounted for N months then full price
- Integration test: purchase with `forever` coupon → verify renewal always charges discounted amount
- Integration test: purchase with `once` coupon → verify renewal charges full price

### 2.6 Skill Document Update

Update `bsaas-coupons-private-features.md`:
- Remove the "Renewals do not re-apply coupons" limitation note
- Document the new renewal coupon behavior with duration table
- Note the metadata fields stored for coupon tracking

---

## Phase 3: Sharable QR Codes for Promo Codes (G3 — Part A)

**Goal**: Generate styled QR codes for promotion codes that deep-link to the Feature Store with the promo code pre-filled. Uses `qr-code-styling` library for visually distinct, branded QR codes — differentiating BSaaS promo QRs from plain public-surface QRs. Coupon target metadata drives icon embedding in the QR center.

### 3.1 QR Library: `qr-code-styling`

**Install**: `pnpm --filter web add qr-code-styling`

The existing `qrcode` package (v1.5.4) remains for public surfaces (storefront, product, directory). `qr-code-styling` is used exclusively for BSaaS promo/grant QR codes, providing:

| Feature | `qrcode` (public surfaces) | `qr-code-styling` (BSaaS codes) |
|---------|---------------------------|--------------------------------|
| Dot shapes | Square only | `rounded`, `dots`, `classy`, `classy-rounded`, `extra-rounded` |
| Corner styles | Square only | `dot`, `square`, `extra-rounded`, `rounded` |
| Gradients | No | Linear & radial on dots, corners, background |
| Logo embedding | Manual canvas overlay (~40 lines) | Built-in `image` + `imageOptions` with `hideBackgroundDots` |
| Output | Canvas/PNG/SVG | Canvas or SVG with `download()` method |
| Overall shape | Square | `square` or `circle` |
| License | MIT | MIT |

### 3.2 QR Code URL Scheme

Define a URL scheme for promo code redemption:

```
https://{appDomain}/settings/feature-store?promo={promotionCode}
```

For private grants (Phase 4), a different scheme:
```
https://{appDomain}/settings/feature-store?grant={grantToken}
```

The Feature Store page will read `promo` from the URL query string and pre-fill the promo code input.

### 3.3 Coupon Target-Aware QR Generation

**Concept**: When a coupon has targeting rules (e.g., `target_features: ['chatbot_skill_crm_assistant']`), the QR code embeds the target feature's icon in the center instead of the platform logo. This gives the QR code a visual signal of what the promo code is for — an extra edge for marketing materials and sales decks.

**Icon sources** (in priority order):

1. **Feature-targeted coupon** → `features_list.icon_name` for the target feature (e.g., `IconRobot` for a chatbot feature)
2. **Capability-targeted coupon** (`target_capability_types`) → Icon for the capability type (mapped from a static icon registry)
3. **Tier-targeted coupon** (`target_tiers`) → Tier badge icon (e.g., crown for enterprise)
4. **No targeting** → Platform logo (`/icons/visibleshelf-logo.svg`)

**Backend endpoint** (new route in `bsaas-promotions.ts`):

```
GET /api/admin/bsaas-promotions/promotion/:id/qr
```

Returns:
```json
{
  "success": true,
  "data": {
    "qr_url": "https://app.visibleshelf.com/settings/feature-store?promo=SUMMER50",
    "promotion_code": "SUMMER50",
    "coupon_id": "coupon_xxx",
    "targets": {
      "target_features": ["chatbot_skill_crm_assistant"],
      "target_tiers": null,
      "target_capability_types": null
    },
    "target_icon": {
      "type": "feature",
      "feature_key": "chatbot_skill_crm_assistant",
      "icon_name": "IconRobot",
      "icon_url": "/icons/features/chatbot.svg",
      "marketing_name": "CRM Chatbot Assistant"
    }
  }
}
```

**Target icon resolution logic** (server-side):

1. Fetch `coupon_target_rules` for the coupon
2. If `target_features` has exactly one entry → look up `features_list` by key, return `icon_name` + `marketing_name`
3. If `target_features` has multiple entries → return a generic "bundle" icon
4. If only `target_capability_types` → map capability key to icon (static map: `chatbot` → `IconRobot`, `analytics` → `IconChartBar`, etc.)
5. If only `target_tiers` → map tier to icon (static map: `enterprise` → `IconCrown`, `professional` → `IconStar`, etc.)
6. If no targets → return `null` (frontend uses platform logo)

**Feature icon asset strategy**: The `features_list.icon_name` field stores a string like `IconRobot` (a Lucide icon name). For QR embedding, we need an actual image file. Two options:

- **Option A (recommended)**: Generate SVG icons on-the-fly from Lucide icon names using `lucide-static` (already available via `@tabler/icons-react` / `lucide-react`). Render the icon to an SVG string, convert to data URL, pass as `image` to `qr-code-styling`.
- **Option B**: Maintain a static folder of SVG icons at `apps/web/public/icons/features/` keyed by feature key. More maintenance but simpler.

Option A is preferred because it automatically covers all features without manual asset management.

### 3.4 Frontend — Styled QR Code Component for Promo Codes

**File**: `apps/web/src/admin/components/BsaasPromotionManagement.tsx`

Add a "QR Code" button to each promotion code row in the admin table. On click, open `PromoCodeQRDialog` showing:

1. **Styled QR Code image** — generated client-side using `qr-code-styling`
2. **Promo code text** — large, copyable (e.g., "SUMMER50")
3. **Deep link URL** — copyable text
4. **Target info** — if coupon has targets, show "Valid for: CRM Chatbot Assistant" with the feature icon
5. **Download buttons**: PNG, SVG, Copy link
6. **Share buttons** (optional): Email, SMS

**QR style configuration** (BSaaS promo theme):

```typescript
import QRCodeStyling from 'qr-code-styling';

const qrCode = new QRCodeStyling({
  width: 512,
  height: 512,
  type: 'svg',
  data: promoUrl,
  image: targetIcon?.iconUrl || '/icons/visibleshelf-logo.svg',  // target-aware!
  imageOptions: {
    crossOrigin: 'anonymous',
    margin: 10,
    imageSize: 0.35,
    hideBackgroundDots: true,
  },
  dotsOptions: {
    color: '#1a56db',           // brand blue
    type: 'rounded',            // soft rounded dots — visually distinct from public QRs
  },
  cornersSquareOptions: {
    color: '#1a56db',
    type: 'extra-rounded',
  },
  cornersDotOptions: {
    color: '#ffffff',
    type: 'dot',
  },
  backgroundOptions: {
    color: '#f8fafc',           // light background
  },
  qrOptions: {
    errorCorrectionLevel: 'H',  // high — needed for icon overlay
  },
});
```

**BSaaS QR visual themes** (selectable in admin dialog):

| Theme | Dot Style | Color | Corners | Icon | Use Case |
|-------|-----------|-------|---------|------|----------|
| **Promo (default)** | `rounded` | Blue `#1a56db` | `extra-rounded` | Target feature icon or platform logo | General marketing |
| **Promo (sale)** | `classy-rounded` | Red `#dc2626` | `rounded` | Target feature icon | Flash sales, limited-time |
| **Bundle promo** | `extra-rounded` | Green `#16a34a` | `extra-rounded` | Generic bundle icon | Bundle discount campaigns |
| **Private grant** | `dots` | Purple `#7c3aed` | `dot` | Granted feature icon | Enterprise deals, trade shows |

### 3.5 Frontend — Feature Store Auto-Fill from URL

**File**: `apps/web/src/app/(platform)/settings/feature-store/page.tsx`

- On page load, read `promo` from `useSearchParams()`
- If present, pre-fill the `promoCode` state
- Show a toast/info banner: "Promo code SUMMER50 applied — click a feature to purchase with discount"
- If the user clicks a feature or bundle, the confirmation modal opens with the promo code pre-filled
- Optionally auto-open the first eligible feature's purchase modal (based on coupon targeting if available)

### 3.6 Admin UI — QR Generation Dialog Component

**File**: `apps/web/src/admin/components/PromoCodeQRDialog.tsx` (new)

Reusable dialog component:
- Props: `promotionCode: string`, `qrUrl: string`, `targetIcon: TargetIcon | null`, `theme: string`, `open: boolean`, `onClose: () => void`
- Generates styled QR client-side using `qr-code-styling`
- Shows promo code, URL, target info, download/share buttons
- Theme selector (4 presets above)
- Can be reused for private grant QR codes (Phase 4)

### 3.7 Tests

- Unit test: QR URL construction with various app domains
- Unit test: Target icon resolution — single feature target, multiple feature targets, capability target, tier target, no targets
- E2E test: Admin generates QR → URL contains correct promo code → Feature Store auto-fills code → purchase applies discount
- E2E test: Admin generates QR for feature-targeted coupon → QR center shows target feature icon
- Visual test: QR code renders with styled dots, rounded corners, and embedded icon — scannable by standard QR readers

---

## Phase 4: QR Codes for Private Grants (G3 — Part B)

**Goal**: Generate secure, time-limited QR codes for private feature grants. Enables admins to share grant access via QR code (e.g., at trade shows, in sales meetings, via printed materials).

### 4.1 Grant Token System

Private grants require a token-based approach since there's no promo code string — the admin is granting a specific feature to a specific tenant (or any tenant) at no cost.

**Token format**: JWT or signed token containing:
```json
{
  "feature_key": "chatbot_skill_crm_assistant",
  "tenant_id": "tenant123",        // optional — if null, any tenant can claim
  "duration_days": 30,              // optional
  "granted_by": "admin_user_id",
  "expires_at": "2026-07-15T00:00:00Z",  // QR code expiry (not grant expiry)
  "max_claims": 1,                  // optional — limit redemptions
}
```

- Signed with a server-side secret (reuse existing JWT secret or `GRANT_TOKEN_SECRET` env var)
- Short-lived (e.g., 7 days) — the QR code itself expires, not the grant
- `max_claims` defaults to 1 for targeted grants, can be higher for campaigns

### 4.2 Backend — Grant Token Endpoints

**Files**: `apps/api/src/routes/admin/feature-purchases.ts` (create-grant-token), `apps/api/src/routes/bsaas-purchases.ts` (redeem-grant)

```
POST /api/admin/feature-purchases/create-grant-token
```

Request:
```json
{
  "feature_key": "chatbot_skill_crm_assistant",
  "tenant_id": "tenant123",     // optional
  "duration_days": 30,           // optional
  "max_claims": 1,               // optional, default 1
  "qr_expiry_hours": 168         // optional, default 168 (7 days)
}
```

Response:
```json
{
  "success": true,
  "data": {
    "grant_token": "eyJhbGciOiJIUzI1NiIs...",
    "qr_url": "https://app.visibleshelf.com/settings/feature-store?grant=eyJhbGciOiJIUzI1NiIs...",
    "expires_at": "2026-07-17T00:00:00Z"
  }
}
```

- Validates feature exists in `bsaas_catalog` (must be `is_private: true` or `is_active: true`)
- Creates signed token
- Audit log: `feature_purchase.grant_token_created`

```
POST /api/subscription/redeem-grant
```

Request:
```json
{
  "grant_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

- Authenticated endpoint (authenticateToken, no admin required) — mounted in `bsaas-purchases.ts` at `/api/subscription/redeem-grant`
- Verifies token signature and expiry
- If `tenant_id` in token doesn't match authenticated tenant → 403
- If `max_claims` exceeded → 410 Gone
- Creates `tenant_feature_purchases` with `source='admin_grant'`, `status='active'`, `price_cents=0`
- Stores `grant_token_id`, `granted_by` in metadata
- Increments claim count (stored in Redis or a `grant_token_claims` table)
- Calls `invalidateEffectiveCapabilities(tenantId)`
- Sends `bsaas_purchase_success` notification
- Audit log: `feature_purchase.grant_redeemed`

### 4.3 Backend — Grant Token Claim Tracking

**File**: `database/migrations/101_bsaas_grant_tokens.sql` (new)

```sql
CREATE TABLE bsaas_grant_tokens (
  id VARCHAR(255) PRIMARY KEY,
  feature_key VARCHAR(100) NOT NULL,
  tenant_id VARCHAR(255),           -- null = any tenant
  duration_days INTEGER,
  granted_by VARCHAR(255) NOT NULL,
  max_claims INTEGER DEFAULT 1,
  claims_count INTEGER DEFAULT 0,
  qr_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bsaas_grant_token_claims (
  id VARCHAR(255) PRIMARY KEY,
  grant_token_id VARCHAR(255) REFERENCES bsaas_grant_tokens(id),
  tenant_id VARCHAR(255) NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grant_token_id, tenant_id)  -- prevent double-claim by same tenant
);
```

- Prisma models for both tables
- ID generators: `gtok-{nanoid}` (global, admin-created), `gclm-{tenantKey}-{nanoid}` (tenant-scoped, claimed by tenant)
- Note: `grant-` prefix is already used by `generateAccessGrantId` — use `gtok` to avoid collision

### 4.4 Frontend — Admin Grant QR UI

**File**: `apps/web/src/admin/components/PrivateFeatureGrantDialog.tsx` (new)

Admin UI for creating grant tokens and showing QR codes:

1. Admin navigates to **Settings → Admin → Feature Purchases**
2. New "Create Grant QR" button
3. Dialog shows:
   - Feature selector (filtered to `is_private: true` features from `bsaas_catalog`)
   - Tenant selector (optional — leave blank for "any tenant")
   - Duration days input (optional)
   - Max claims input (default 1)
   - QR expiry input (default 7 days)
4. On "Generate", calls `POST /create-grant-token`
5. Shows QR code (reusing `PromoCodeQRDialog` component from Phase 3, with "Private grant" theme)
6. QR encodes the `grant` URL
7. **Target icon embedding**: The granted feature's `icon_name` is resolved to an SVG and embedded in the QR center — same mechanism as Phase 3 coupon-target-aware icons
8. Download/share buttons

### 4.5 Frontend — Feature Store Grant Redemption

**File**: `apps/web/src/app/(platform)/settings/feature-store/page.tsx`

- On page load, read `grant` from `useSearchParams()`
- If present, show a redemption dialog:
  - "You've been granted access to: [Feature Name]"
  - "Click Redeem to activate this feature on your tenant"
  - Shows feature description and duration
- On "Redeem", calls `POST /api/subscription/redeem-grant` with the token
- On success: shows success message, refreshes capabilities
- On failure (expired, already claimed, wrong tenant): shows appropriate error

### 4.6 Security Considerations

- Grant tokens are signed with server secret — cannot be forged
- QR expiry is short-lived (default 7 days) — limits exposure if QR is leaked
- `max_claims` prevents unlimited redemptions
- `tenant_id` binding prevents token sharing across tenants (if targeted)
- Claim tracking in DB prevents double-redemption
- Rate limiting on `redeem-grant` endpoint (e.g., 5 attempts per minute per IP)
- Audit trail for both token creation and redemption

### 4.7 Tests

- Unit test: grant token creation, signing, verification
- Unit test: token expiry rejection
- Unit test: max_claims enforcement
- Unit test: tenant_id binding enforcement
- Integration test: admin creates grant → tenant redeems via QR URL → feature activated
- Integration test: expired token → rejection
- Integration test: wrong tenant → rejection
- E2E test: full QR flow — admin generates QR → tenant scans URL → redeems grant

---

## Phase 5: Public-Surface QR Style Pilot (G4)

**Goal**: Pilot `qr-code-styling` on one public-facing QR surface (`TenantQRCode.tsx`) with a tier-gated capability flag, giving higher-tier merchants control over QR visual style. This validates the library in production before broader rollout.

### 5.1 Pilot Surface: `TenantQRCode.tsx`

**Why this surface**: It's the most feature-complete QR component — already tier-aware via `StorefrontOptionFlags`, renders on storefront/product/directory/map pages, and has manual logo overlay code (~40 lines) that `qr-code-styling` replaces with built-in `image` + `imageOptions`.

**File**: `apps/web/src/components/public/TenantQRCode.tsx`

### 5.2 Capability Design: Feature-Key-Driven QR Style Options

The platform's capability architecture is feature-key driven — each capability is a feature key assigned to tiers via the database. The QR style options follow the same pattern as existing `storefront_opt_*` keys. No tier names are hardcoded in the resolution logic; tier access is determined entirely by which feature keys are assigned to each tier in the database.

**New feature keys** (registered in the capability/tier system, assigned to tiers via DB):

| Feature Key | Type | Purpose |
|-------------|------|---------|
| `storefront_opt_qr_styled_on` | Group gate (on) | Enables styled QR renderer — grants all dot styles, corner styles, custom colors, and gradients. Assign this single key to a tier to get everything. |
| `storefront_opt_qr_styled_off` | Group gate (off) | Explicitly disables styled QR (overrides `_on` if both present, same as `_disabled` pattern) |
| `storefront_opt_qr_dot_styles_on` | Sub-group gate (on) | Grants all dot styles |
| `storefront_opt_qr_dot_rounded` | Individual | `rounded` dot style |
| `storefront_opt_qr_dot_dots` | Individual | `dots` dot style |
| `storefront_opt_qr_dot_classy` | Individual | `classy` dot style |
| `storefront_opt_qr_dot_classy_rounded` | Individual | `classy-rounded` dot style |
| `storefront_opt_qr_dot_extra_rounded` | Individual | `extra-rounded` dot style |
| `storefront_opt_qr_corner_styles_on` | Sub-group gate (on) | Grants all corner styles |
| `storefront_opt_qr_corner_dot` | Individual | `dot` corner style |
| `storefront_opt_qr_corner_extra_rounded` | Individual | `extra-rounded` corner style |
| `storefront_opt_qr_corner_rounded` | Individual | `rounded` corner style |
| `storefront_opt_qr_custom_colors` | Individual | Custom dot/corner/background colors |
| `storefront_opt_qr_gradients` | Individual | Gradient fills on dots/corners |

**Example tier assignments** (configurable in DB, not hardcoded):

| Feature Key | Commitment | Professional | Enterprise |
|-------------|------------|--------------|------------|
| `storefront_opt_qr_styled_on` | ✓ | ✓ | ✓ |
| `storefront_opt_qr_dot_styles_on` | ✓ | ✓ | ✓ |
| `storefront_opt_qr_corner_styles_on` | ✓ | ✓ | ✓ |
| `storefront_opt_qr_custom_colors` | — | ✓ | ✓ |
| `storefront_opt_qr_gradients` | — | — | ✓ |

A tier with just `storefront_opt_qr_styled_on` gets the styled renderer with all dot and corner styles but no custom colors or gradients. A tier with `storefront_opt_qr_dot_styles_on` gets all dot styles without needing each individual `storefront_opt_qr_dot_*` key. `flexible` mode grants everything.

**New `StorefrontOptionFlags` fields** (in `CapabilityResolutionService.ts`):

```typescript
showQRStyled: boolean;              // qr_styled_on group gate
allowedQRDotStyles: string[];       // from _on sub-group or individual keys
allowedQRCornerStyles: string[];    // from _on sub-group or individual keys
qrCustomColors: boolean;            // storefront_opt_qr_custom_colors
qrGradients: boolean;               // storefront_opt_qr_gradients
```

**Capability resolution** (added to `resolveStorefrontOptions` pipeline, following the existing `_on`/`_off` pattern):

```typescript
// --- QR Style: _on/_off group pattern, same as QR/gallery/layout above ---
const qrStyledOn = flexible
  || !!features.storefront_opt_qr_styled
  || !!features.storefront_opt_qr_styled_on
  || (!!features.storefront_opt_qr_styled_enabled && !features.storefront_opt_qr_styled_disabled);

const allowedQRDotStyles: string[] = [];
if (qrStyledOn && (flexible || features.storefront_opt_qr_dot_styles || features.storefront_opt_qr_dot_styles_on)) {
  allowedQRDotStyles.push('rounded', 'dots', 'classy', 'classy-rounded', 'extra-rounded');
} else {
  if (features.storefront_opt_qr_dot_rounded) allowedQRDotStyles.push('rounded');
  if (features.storefront_opt_qr_dot_dots) allowedQRDotStyles.push('dots');
  if (features.storefront_opt_qr_dot_classy) allowedQRDotStyles.push('classy');
  if (features.storefront_opt_qr_dot_classy_rounded) allowedQRDotStyles.push('classy-rounded');
  if (features.storefront_opt_qr_dot_extra_rounded) allowedQRDotStyles.push('extra-rounded');
}

const allowedQRCornerStyles: string[] = [];
if (qrStyledOn && (flexible || features.storefront_opt_qr_corner_styles || features.storefront_opt_qr_corner_styles_on)) {
  allowedQRCornerStyles.push('dot', 'extra-rounded', 'rounded');
} else {
  if (features.storefront_opt_qr_corner_dot) allowedQRCornerStyles.push('dot');
  if (features.storefront_opt_qr_corner_extra_rounded) allowedQRCornerStyles.push('extra-rounded');
  if (features.storefront_opt_qr_corner_rounded) allowedQRCornerStyles.push('rounded');
}

const qrCustomColors = qrStyledOn && (flexible || !!features.storefront_opt_qr_custom_colors);
const qrGradients = qrStyledOn && (flexible || !!features.storefront_opt_qr_gradients);
```

This mirrors the exact `_on`/`_off` pattern used for `storefront_opt_qr_on`, `storefront_opt_gallery_on`, and `storefront_opt_layout_on` — a group gate key (`_on`) grants all children; individual keys grant specific options; `flexible` grants everything.

### 5.3 Merchant Settings UI

**File**: `apps/web/src/app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx`

New "QR Code Style" section, visible only when `showQRStyled` is true (i.e., the tier has `storefront_opt_qr_styled_on` assigned):
- **Dot style selector** — visual cards for each style in `allowedQRDotStyles` (gated by `storefront_opt_qr_dot_*` keys)
- **Corner style selector** — cards for each style in `allowedQRCornerStyles` (gated by `storefront_opt_qr_corner_*` keys)
- **Color pickers** — dot color, corner color, background color (visible only when `qrCustomColors` is true)
- **Gradient toggle** — enable gradient fills with start/end color + angle (visible only when `qrGradients` is true)
- **Live preview** — QR renders in real-time as settings change
- **Reset to default** button

**Storage**: Style preferences stored in `tenant_business_profile.storefront_options` JSON:
```json
{
  "qr_dot_type": "rounded",
  "qr_dot_color": "#1a56db",
  "qr_corner_type": "extra-rounded",
  "qr_corner_color": "#1a56db",
  "qr_bg_color": "#ffffff",
  "qr_gradient_enabled": false,
  "qr_gradient_start": "#1a56db",
  "qr_gradient_end": "#7c3aed"
}
```

### 5.4 Conditional Rendering in `TenantQRCode.tsx`

```typescript
// In generateQRCode():
if (resolvedFlags?.showQRStyled) {
  // Use qr-code-styling (styled path) — gated by storefront_opt_qr_styled feature key
  const dotType = merchantPrefs.qr_dot_type || resolvedFlags.allowedQRDotStyles[0] || 'rounded';
  const cornerType = merchantPrefs.qr_corner_type || resolvedFlags.allowedQRCornerStyles[0] || 'extra-rounded';

  const qr = new QRCodeStyling({
    width: qrSettings.exportSize,
    height: qrSettings.exportSize,
    type: 'svg',
    data: url,
    image: tenantLogo || undefined,  // built-in logo embedding — replaces manual overlayLogoOnQR()
    imageOptions: { crossOrigin: 'anonymous', margin: 10, imageSize: 0.3, hideBackgroundDots: true },
    dotsOptions: {
      color: resolvedFlags.qrCustomColors ? (merchantPrefs.qr_dot_color || '#1a56db') : '#1a56db',
      type: dotType,
      gradient: resolvedFlags.qrGradients && merchantPrefs.qr_gradient_enabled ? {
        type: 'linear', rotation: 45,
        colorStops: [{ offset: 0, color: merchantPrefs.qr_gradient_start }, { offset: 1, color: merchantPrefs.qr_gradient_end }]
      } : undefined,
    },
    cornersSquareOptions: {
      color: resolvedFlags.qrCustomColors ? (merchantPrefs.qr_corner_color || '#1a56db') : '#1a56db',
      type: cornerType,
    },
    cornersDotOptions: { color: '#ffffff', type: 'dot' },
    backgroundOptions: { color: resolvedFlags.qrCustomColors ? (merchantPrefs.qr_bg_color || '#ffffff') : '#ffffff' },
    qrOptions: { errorCorrectionLevel: qrSettings.errorCorrection },
  });
  await qr.append(containerRef.current);
} else {
  // Existing qrcode path — unchanged for tiers without storefront_opt_qr_styled
  const QRCode = (await import('qrcode')).default;
  await QRCode.toCanvas(exportCanvas, url, { ... });
}
```

**Code reduction**: The `overlayLogoOnQR()` function (lines 127-177, ~50 lines of manual canvas manipulation) is replaced by `qr-code-styling`'s built-in `image` + `imageOptions` for the styled path. The plain path retains the manual overlay for backward compatibility.

### 5.5 Second Surface: `QRCodeGenerator.tsx`

**File**: `apps/web/src/components/items/QRCodeGenerator.tsx`

After pilot validation on `TenantQRCode.tsx`, apply the same conditional pattern to `QRCodeGenerator.tsx`. This component uses the same `qrcode` package and manual logo overlay. The migration is quick — reuses `StyledQRCode` logic from the pilot.

### 5.6 Tests

- Unit test: `showQRStyled` — true when `storefront_opt_qr_styled_on` is assigned, false when not, false when both `_on` and `_off` are present
- Unit test: `allowedQRDotStyles` — `storefront_opt_qr_dot_styles_on` grants all 5 styles; individual keys grant only their specific style; `flexible` grants all
- Unit test: `allowedQRCornerStyles` — `storefront_opt_qr_corner_styles_on` grants all 3 styles; individual keys grant only their specific style
- Unit test: `qrCustomColors` — true only when `qrStyledOn` and `storefront_opt_qr_custom_colors` are both assigned
- Unit test: `qrGradients` — true only when `qrStyledOn` and `storefront_opt_qr_gradients` are both assigned
- Visual test: Styled QR renders with allowed dot/corner styles, logo — scannable
- Regression test: Tier without `storefront_opt_qr_styled_on` still renders plain QR (qrcode path unchanged)
- E2E test: Tier with `storefront_opt_qr_styled_on` + `storefront_opt_qr_dot_styles_on` → merchant sees all dot styles in settings UI; tier with only `storefront_opt_qr_dot_rounded` → merchant sees only rounded

---

## Phase 6: Analytics & Skill Document Update

**Goal**: Track QR code usage and update all documentation.

### 6.1 QR Analytics

Track in `bsaas_grant_token_claims` and existing audit logs:
- QR code generation count per promotion code / grant
- Redemption count per QR code
- Conversion rate: QR generated → QR scanned → purchase/grant completed
- Revenue impact of QR-driven promo code redemptions

Add to the existing BSaaS Analytics dashboard (`/settings/admin/bsaas-analytics`):
- New card: "QR-Driven Redemptions" — count of purchases that used a QR-linked promo code
- New table: "Top Promo Codes by QR Redemption" — promotion code, QR scans, redemptions, revenue

### 6.2 Skill Document Updates

Update `bsaas-coupons-private-features.md`:
- Remove all "Known Gap" and "Anti-Pattern" sections related to bundles and renewals
- Add "QR Code Sharing" section covering both promo code QR and private grant QR
- Add grant token redemption flow documentation
- Update file reference table with new files

Update `bsaas-purchase-flow.md`:
- Add note about promo code support for both individual and bundle purchases
- Add note about renewal coupon awareness
- Add grant token redemption to the purchase flow section

Update `docs/BSAAS_EXPANSION_USER_GUIDE.md`:
- Update E5 section to reflect bundle promo code support
- Add QR code sharing instructions for admins
- Add grant QR section

---

## Implementation Order & Dependencies

```
Phase 1 (Bundle Promo + Targeting)  ─── start immediately (includes Prisma generate)
     │
     ▼
Phase 2 (Renewal Coupons)           ─── depends on Phase 1 (shared metadata format)
     │
Phase 3 (Styled Promo QR Codes)     ─── no dependency on Phase 1/2, can run in parallel
     │  │                               (depends on coupon targeting data for icon embedding)
     │  ▼
     │  Phase 4 (Private Grant QR)     ─── depends on Phase 3 (QR dialog + icon resolution reuse)
     │
     ▼
Phase 5 (Public-Surface QR Pilot)   ─── no dependency on Phase 1-4, can run in parallel
     │                                  (independent capability flag + TenantQRCode.tsx changes)
     ▼
Phase 6 (Analytics + Docs)          ─── depends on all prior phases
```

**Parallelization opportunities**:
- Phases 1+2 and Phase 3 can be developed simultaneously (different developers)
- Phase 5 (public-surface pilot) is fully independent — can start anytime
- Phase 3 needs `PromoCodeQRDialog` + target icon resolution ready for Phase 4 to reuse
- Phase 3's target-aware QR benefits from Phase 1's coupon targeting integration (target data in API response), but can fall back to no-icon if targeting isn't wired yet

---

## File Impact Summary

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `apps/web/src/admin/components/PromoCodeQRDialog.tsx` | 3 | Reusable styled QR dialog for promo codes (uses `qr-code-styling`) |
| `apps/web/src/admin/components/PrivateFeatureGrantDialog.tsx` | 4 | Admin UI for creating grant token QR codes |
| `apps/web/src/lib/qr-style-config.ts` | 3, 5 | Shared QR style theme presets + target icon resolution helper |
| `database/migrations/101_bsaas_grant_tokens.sql` | 4 | Grant token + claim tracking tables |
| `scripts/migrate_bsaas_coupon_metadata.ps1` | 2 | One-time metadata enrichment script |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `apps/api/src/routes/bsaas-purchases.ts` | 1, 2 | Extract `validatePromoCode` helper with target validation, apply to bundle purchase, enrich metadata with coupon duration fields |
| `apps/api/src/jobs/bsaas-renewal.ts` | 2 | Add `calculateRenewalCharge` helper, apply discount logic in all renewal paths |
| `apps/api/src/routes/admin/bsaas-promotions.ts` | 3 | Add `GET /promotion/:id/qr` endpoint with target icon resolution |
| `apps/api/src/routes/admin/feature-purchases.ts` | 4 | Add `POST /create-grant-token` endpoint (admin, mounted at `/api/admin/feature-purchases`) |
| `apps/api/src/routes/bsaas-purchases.ts` | 4 | Add `POST /redeem-grant` endpoint (authenticated user, mounted at `/api/subscription`) |
| `apps/web/src/admin/components/BsaasPromotionManagement.tsx` | 3 | Add QR button + dialog trigger per promo code row |
| `apps/web/src/app/(platform)/settings/feature-store/page.tsx` | 3, 4 | Read `promo` and `grant` from URL, auto-fill/ show redemption dialog |
| `apps/web/src/services/AdminBsaasPromotionsService.ts` | 3 | Add `getQRData()` method |
| `apps/web/src/services/BsaasPurchaseService.ts` | 4 | Add `redeemGrant()` method |
| `apps/api/prisma/schema.prisma` | 4 | Add `bsaas_grant_tokens` + `bsaas_grant_token_claims` models |
| `apps/api/src/lib/id-generator.ts` | 4 | Add `generateGrantTokenId` (prefix `gtok`, global), `generateGrantClaimId` (prefix `gclm`, tenant-scoped) |
| `apps/web/src/components/public/TenantQRCode.tsx` | 5 | Conditional render: styled path (`qr-code-styling`) vs plain path (`qrcode`); remove manual `overlayLogoOnQR` for styled path |
| `apps/web/src/components/items/QRCodeGenerator.tsx` | 5 | Same conditional pattern as TenantQRCode (second surface) |
| `apps/web/src/services/CapabilityResolutionService.ts` | 5 | Add `showQRStyled`, `allowedQRDotStyles`, `allowedQRCornerStyles`, `qrCustomColors`, `qrGradients` to `StorefrontOptionFlags` + feature-key-driven resolution logic (group gate + individual keys pattern) |
| `apps/web/src/app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx` | 5 | Add "QR Code Style" settings section for eligible tiers |
| `.devin/skills/bsaas-coupons-private-features.md` | 1, 2, 6 | Remove gap warnings, add QR + renewal coupon + targeting docs |
| `.devin/skills/bsaas-purchase-flow.md` | 6 | Update with bundle promo + renewal coupon notes |
| `docs/BSAAS_EXPANSION_USER_GUIDE.md` | 6 | Update E5 section, add QR instructions, add styled QR section |

### New Dependencies

| Package | Phase | Purpose |
|---------|-------|---------|
| `qr-code-styling` | 3, 5 | Styled QR code generation (rounded dots, gradients, built-in logo embedding) — MIT licensed |

**Existing packages retained**:
- `qrcode` (v1.5.4) — remains for plain QR path in public surfaces (Discovery/Starter/Storefront tiers)
- `@types/qrcode` (v1.5.6) — retained for plain path

---

## Risk Assessment

| Risk | Phase | Mitigation |
|------|-------|------------|
| Existing purchases missing coupon metadata | 2 | Migration script enriches existing records; fallback charges full price if metadata absent |
| Grant token leakage | 4 | Short-lived tokens (7-day default), `max_claims` limit, tenant binding, rate limiting |
| Stripe API rate limits from coupon retrieval | 2 | Coupon data cached in metadata at purchase time — no Stripe API calls during renewal |
| QR code phishing | 3, 4 | QR URLs use official domain only; grant tokens are signed; promo codes are Stripe-validated |
| Bundle discount calculation edge cases | 1 | `amount_off` capped at `priceCents`; `percent_off` rounded to nearest cent — same as individual feature logic |
| Coupon targeting false rejections | 1 | `CouponTargetService.validateCouponTargets` returns `{ valid: true }` when no rules exist — only restricts when rules are explicitly set |
| Target icon not found for feature | 3, 4 | Fallback chain: feature icon → capability icon → tier icon → platform logo. Never produces a QR without an image |
| `qr-code-styling` scannability with heavy styling | 3, 5 | Use `errorCorrectionLevel: 'H'` when icon is embedded; test with multiple QR readers before rollout; styled path is additive (plain path unchanged for low tiers) |
| Styled QR regression on public surfaces | 5 | Conditional render — tiers without `storefront_opt_qr_styled_on` feature key use existing `qrcode` path. No changes to QR output for tiers without the feature key |
| Feature icon SVG generation from Lucide names | 3 | Use `lucide-static` to export SVG strings; cache rendered SVGs; fallback to platform logo if icon name is missing or invalid |
