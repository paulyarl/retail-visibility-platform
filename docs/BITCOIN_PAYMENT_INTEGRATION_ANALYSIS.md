# Bitcoin Payment Integration Analysis

**Date**: 2026-07-07  
**Status**: Analysis Phase — No Implementation Yet  
**Owner**: Platform Architecture  

---

## §1 Executive Summary

This document analyzes the integration of Bitcoin as a payment method for merchants on the VisibleShelf platform. It covers where Bitcoin fits within the existing capability infrastructure, which providers are viable, what architectural changes are required, and a prioritized phased implementation plan.

**Key recommendation**: Bitcoin enters the platform as a **new gateway type within the existing `payment_gateway_options` capability type** — not as a separate capability. This follows the same pattern as Stripe, PayPal, Square, and Clover: a `payment_gateway_bitcoin` feature key gates tier access, a merchant preference toggle controls enablement, and a gateway adapter handles the payment flow.

---

## §2 Current Payment Infrastructure

### §2.1 Capability Architecture

The platform uses a **two-layer gate** for payment gateways:

| Layer | Purpose | Mechanism |
|-------|---------|-----------|
| **Tier (hard gate)** | Plan determines which gateway types are allowed | `tier_features_list` with feature keys like `payment_gateway_stripe` |
| **Merchant (soft toggle)** | Merchant can disable gateways their tier allows | `tenant_payment_gateway_settings` table with per-gateway boolean columns |

**Resolution pipeline**:
```
tier_features_list → PaymentGatewayResolver → EffectivePaymentGateway
  → allowed_gateways (tier-allowed)
  → effective_gateways (tier-allowed AND merchant-enabled)
  → checkout_available (at least 1 effective gateway)
```

### §2.2 Supported Gateways Today

| Gateway | Feature Key | OAuth | Gateway Adapter | Checkout UI |
|---------|-------------|-------|-----------------|-------------|
| Stripe | `payment_gateway_stripe` | Stripe Connect (OAuth) | `StripeGateway.ts` | `StripePaymentForm.tsx` |
| PayPal | `payment_gateway_paypal` | PayPal OAuth | `PayPalGateway.ts.disabled` | `PayPalPaymentForm.tsx` |
| Square | `payment_gateway_square` | Square OAuth | (inline in checkout) | `SquarePaymentForm.tsx` |
| Clover | `payment_gateway_clover` | Clover OAuth | (no checkout UI yet) | (none) |

### §2.3 Key Files

**Backend**:
- `apps/api/src/services/resolvers/PaymentGatewayResolver.ts` — resolver with hardcoded `GatewayType = 'stripe' | 'paypal' | 'square' | 'clover'`
- `apps/api/src/services/resolvers/types.ts` — `EffectivePaymentGateway`, `PaymentGatewayMerchantSettings`, `GatewayType`
- `apps/api/src/routes/payment-gateway-settings.ts` — GET/PUT merchant preferences with tier validation per gateway
- `apps/api/src/services/payments/PaymentGatewayInterface.ts` — abstract gateway with `authorize`, `charge`, `capture`, `refund`, `validateWebhook`
- `apps/api/src/services/payments/gateways/StripeGateway.ts` — only active adapter
- `apps/api/src/routes/checkout.ts` — order creation + payment processing
- `apps/api/src/routes/checkout/stripe.ts` — Stripe-specific checkout flow
- `apps/api/src/routes/checkout/square.ts` — Square-specific checkout flow

**Frontend**:
- `apps/web/src/services/CapabilityResolutionService.ts` — `GatewayType`, `PaymentGatewayState`, `resolvePaymentGatewayState()`
- `apps/web/src/services/UnifiedCapabilityService.ts` — `mapPaymentGateway()`, `BackendEffectivePaymentGateway`
- `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` — `usePaymentGatewayCapability()`
- `apps/web/src/app/t/[tenantId]/settings/payment-gateways/page.tsx` — merchant gateway config UI
- `apps/web/src/app/checkout/page.tsx` — `type PaymentMethod = 'square' | 'paypal' | 'stripe'`

**Database**:
- `tenant_payment_gateway_settings` table — `gateway_enabled`, `stripe_enabled`, `paypal_enabled`, `square_enabled`, `clover_enabled` columns
- `payment_gateways` table — actual gateway credentials per tenant (gateway_type, config JSON, is_active, is_default)

---

## §3 Where Bitcoin Fits

### §3.1 Capability Placement

**Decision**: Bitcoin is a **new gateway type within `payment_gateway_options`**.

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A. New gateway in `payment_gateway_options`** | Follows exact pattern of Stripe/PayPal/Square/Clover; reuses resolver, settings table, merchant toggle, checkout flow; minimal architectural change | Adds `bitcoin` to `GatewayType` union across ~15 files | **✅ Recommended** |
| B. New capability type `bitcoin_options` | Clean separation; independent tier gating | Breaks established pattern; duplicates resolver/settings/checkout logic; fragments payment configuration across two capabilities | ❌ Rejected |
| C. Under `commerce_types` | Commerce already gates deposit/full/flexible | Commerce controls *payment mode*, not *gateway provider*; mixing concerns | ❌ Rejected |

### §3.2 Feature Key

```sql
-- New feature key
'payment_gateway_bitcoin'
```

**Tier assignment** (proposed):
| Tier | Bitcoin Available |
|------|-------------------|
| trial | ❌ |
| starter | ❌ |
| growth | ✅ |
| scale | ✅ |
| enterprise | ✅ |

**Rationale**: Bitcoin appeals to growth+ merchants who want alternative payment options. Lower tiers have sufficient gateways (Stripe/PayPal). Bitcoin is a differentiator for higher tiers.

### §3.3 Merchant Preference

New column on `tenant_payment_gateway_settings`:
```sql
ALTER TABLE tenant_payment_gateway_settings
ADD COLUMN bitcoin_enabled BOOLEAN DEFAULT true;
```

Merchant can toggle Bitcoin on/off regardless of tier (tier is the hard gate, merchant toggle is the soft gate — same as all other gateways).

---

## §4 Bitcoin Provider Options

Bitcoin payments require a **payment processor** (merchants don't typically accept raw BTC to a wallet — they need invoice generation, exchange rate locking, confirmation tracking, and fiat settlement).

### §4.1 Provider Comparison

| Provider | Bitcoin | Lightning | Altcoins | Fiat Settlement | OAuth | Webhooks | API Complexity | Custodial |
|----------|---------|-----------|----------|-----------------|-------|----------|----------------|-----------|
| **BTCPay Server** | ✅ | ✅ | ❌ | ❌ (self-hosted) | N/A | ✅ | Low | Non-custodial |
| **Coinbase Commerce** | ✅ | ❌ | ✅ (ETH, LTC, etc.) | ✅ (to Coinbase) | OAuth2 | ✅ | Medium | Custodial |
| **BitPay** | ✅ | ❌ | ✅ (BCH, DOGE, USDC) | ✅ (bank deposit) | API key | ✅ | Medium | Custodial |
| **OpenNode** | ✅ | ✅ | ❌ | ✅ (bank or BTC) | API key | ✅ | Low | Custodial/Non-custodial |
| **Strike** | ✅ (Lightning) | ✅ | ❌ | ✅ (USD) | OAuth2 | ✅ | Medium | Custodial |

### §4.2 Recommendation

**Primary: BTCPay Server (self-hosted or hosted)**  
- Non-custodial: merchant receives BTC directly to their wallet
- No KYC requirements, no account approval process
- Open-source, self-hostable, or use a hosted BTCPay instance
- Supports Bitcoin + Lightning Network
- Simple API: create invoice → redirect customer → webhook on confirmation
- No per-transaction fees (only on-chain/Lightning network fees)
- Aligns with platform's multi-tenant architecture (each tenant gets a store ID)

**Secondary (future): Coinbase Commerce**  
- Custodial option for merchants who prefer fiat settlement
- Supports multiple cryptocurrencies
- OAuth2 integration pattern (mirrors existing Stripe Connect flow)
- Good for merchants who want "Bitcoin but settled in USD"

**Phase 1 choice**: BTCPay Server — lowest friction, no API key approval process, non-custodial, self-hostable.

---

## §5 Architectural Impact Analysis

### §5.1 GatewayType Union Expansion

The `GatewayType` union must add `'bitcoin'` across these files:

**Backend** (5 files):
- `apps/api/src/services/resolvers/PaymentGatewayResolver.ts` — `GatewayType`, `resolvePaymentGateway()` flexible branch
- `apps/api/src/services/resolvers/types.ts` — `GatewayType`, `EffectivePaymentGateway.merchant_preferences`, `PaymentGatewayMerchantSettings`
- `apps/api/src/routes/payment-gateway-settings.ts` — Zod schema, tier validation, GET/PUT response shape
- `apps/api/src/routes/bsaas-purchases.ts` — `CAPABILITY_ENABLED_FEATURE` map (already uses `payment_gateway_enabled`, no change needed)

**Frontend** (4 files):
- `apps/web/src/services/CapabilityResolutionService.ts` — `GatewayType`, `PaymentGatewayState.merchantPreferences`, `resolvePaymentGatewayState()`
- `apps/web/src/services/UnifiedCapabilityService.ts` — `BackendEffectivePaymentGateway` interface
- `apps/web/src/app/t/[tenantId]/settings/payment-gateways/page.tsx` — gateway settings state, toggle handler
- `apps/web/src/app/checkout/page.tsx` — `PaymentMethod` type, gateway filtering

**Database** (1 migration):
- `tenant_payment_gateway_settings` — add `bitcoin_enabled` column
- `features_list` — insert `payment_gateway_bitcoin` feature
- `capability_features_list` — link to `payment_gateway_options` capability type
- `tier_features_list` — enable for growth/scale/enterprise tiers

### §5.2 New Gateway Adapter

New file: `apps/api/src/services/payments/gateways/BitcoinGateway.ts`

Implements `PaymentGatewayInterface`:
- `authorize()` → creates BTCPay invoice, returns invoice ID as authorization
- `charge()` → creates BTCPay invoice (same as authorize — Bitcoin is push-based)
- `capture()` → no-op (BTC is captured on-chain when customer pays)
- `refund()` → initiates BTC refund from merchant wallet (manual or via BTCPay)
- `getStatus()` → queries BTCPay invoice status (new/paid/confirmed/complete/expired)
- `validateWebhook()` → verifies BTCPay webhook signature
- `getGatewayName()` → returns `'bitcoin'`

### §5.3 New Checkout Route

New file: `apps/api/src/routes/checkout/bitcoin.ts`

Pattern mirrors `checkout/stripe.ts`:
1. Create BTCPay invoice with order amount (converted to BTC at current rate)
2. Return invoice URL/redirect to client
3. BTCPay webhook confirms payment → update order status
4. Handle underpayment/overpayment/expiry

### §5.4 New Checkout UI Component

New file: `apps/web/src/components/checkout/BitcoinPaymentForm.tsx`

- Shows BTC address/QR code (from BTCPay invoice)
- Displays invoice expiry countdown (typically 15 min)
- Shows exchange rate locked at invoice creation
- Redirects to BTCPay-hosted invoice page or embeds invoice iframe

### §5.5 Webhook Handler

New file: `apps/api/src/routes/bitcoin-webhook.ts`

Pattern mirrors `stripe-webhook.ts`:
- Receives BTCPay webhook events (invoice_paid, invoice_confirmed, invoice_expired)
- Validates webhook signature
- Updates order status in database
- Fires notifications (order confirmation to customer, order received to merchant)

### §5.6 Payment Gateways Table

The existing `payment_gateways` table stores gateway credentials per tenant. For Bitcoin:
- `gateway_type = 'bitcoin'`
- `config` JSON stores: `{ btcpay_store_id, btcpay_api_key, btcpay_webhook_secret }`
- No OAuth flow needed (API key generated in BTCPay Server dashboard)

---

## §6 Storefront & Product Type Suitability

### §6.1 Storefront Types

The platform supports five storefront types via `StorefrontTypeValue`:

| Storefront Type | Bitcoin Suitability | Rationale |
|----------------|-------------------|-----------|
| **`online`** | ✅ **Ideal** | Digital-native merchants already operating online; Bitcoin is a natural fit for web checkout; no physical presence needed; BTCPay invoice redirect fits online flow |
| **`retail`** | ✅ **Good** | Brick-and-mortar stores can accept Bitcoin via QR code at point of sale; BTCPay supports in-person invoice display; good for tech-forward retail merchants |
| **`service`** | ✅ **Good** | Service businesses (consulting, freelancing) benefit from Bitcoin's borderless nature; invoice-based payment aligns with service billing; no shipping needed eliminates fulfillment complexity |
| **`social`** | ⚠️ **Conditional** | Social commerce merchants (Instagram/TikTok sellers) can accept Bitcoin, but the checkout flow is less seamless — social platforms don't natively support BTC redirect; works best when social merchants also have an online storefront |
| **`flexible`** | ✅ **Ideal** | Merchants on flexible tier can combine storefront types; Bitcoin works across all their sales channels |

**Recommendation**: Enable Bitcoin for all storefront types. The checkout flow is storefront-agnostic — the customer is redirected to a BTCPay invoice regardless of storefront type. The only UX difference is QR code display for in-person vs. redirect for online.

### §6.2 Product Types

The platform supports four product types via `ProductType`:

| Product Type | Bitcoin Suitability | Rationale |
|-------------|-------------------|-----------|
| **`physical`** | ✅ **Good** | Physical goods work well with Bitcoin; customer pays invoice, merchant ships upon confirmation; 1-block confirmation (~10 min) is acceptable for shipping orders |
| **`digital`** | ✅ **Ideal** | Digital products (downloads, software, NFTs) are the best Bitcoin use case; instant delivery after payment confirmation; no shipping address needed; Bitcoin-native audience overlaps with digital goods buyers |
| **`hybrid`** | ✅ **Good** | Merchants selling both physical and digital can accept Bitcoin for both; checkout flow is identical; fulfillment type determines post-payment handling |
| **`service`** | ✅ **Ideal** | Services (bookings, consultations, freelance work) pair naturally with Bitcoin; invoice-based payment mirrors service billing; no shipping complexity; borderless payments benefit international service providers |

**Recommendation**: Enable Bitcoin for all product types. Digital and service products have the strongest natural fit. Physical products work well with a 1-confirmation policy (10 min wait before shipping).

### §6.3 Fulfillment Method Compatibility

| Fulfillment Method | Bitcoin Compatibility | Notes |
|-------------------|----------------------|-------|
| **Pickup** | ✅ Excellent | Customer pays BTC invoice on mobile, shows payment confirmation at pickup; no cash handling |
| **Delivery** | ✅ Good | Customer pays invoice, merchant delivers after confirmation; local delivery doesn't need shipping address |
| **Shipping** | ✅ Good | Customer pays invoice, merchant ships after 1-confirmation; shipping address collected separately from payment |
| **Service** | ✅ Excellent | Customer pays invoice, service is scheduled/rendered; no physical fulfillment needed |

**Key insight**: Bitcoin is fulfillment-agnostic. The BTCPay invoice is created with the order total, and fulfillment proceeds after payment confirmation regardless of method. The existing `fulfillment_method` field on orders works unchanged.

### §6.4 Commerce Payment Type Compatibility

| Commerce Payment Type | Bitcoin Compatibility | Notes |
|----------------------|----------------------|-------|
| **`full`** | ✅ Full payment via single BTCPay invoice | Standard flow — customer pays full amount in BTC |
| **`deposit`** | ✅ Deposit via BTCPay invoice, balance at pickup | Two-invoice flow: deposit invoice at checkout, balance invoice at fulfillment |
| **`flexible`** | ✅ Customer chooses full or deposit | Both modes supported via separate BTCPay invoices |
| **`none`** | ❌ No payment processing | If commerce is disabled, Bitcoin is also disabled (enforced by CCL constraint) |

**Deposit flow with Bitcoin**: Create a BTCPay invoice for the deposit percentage at checkout. When customer picks up/receives order, create a second invoice for the remaining balance. This mirrors the existing Stripe deposit-then-capture flow but uses two separate invoices instead of authorize-then-capture.

---

## §7 Split & Mixed Payment Support

### §7.1 Current Platform State

#### Database: Already Supports Multiple Payments Per Order

The `payments` table has a **1:many relationship** with `orders` — the schema already supports multiple payment records per order:

```prisma
// schema.prisma — payments model (simplified)
model payments {
  id                String   @id
  order_id          String   // FK to orders — NOT unique
  tenant_id         String
  amount_cents      Int
  gateway_type      String?  // 'stripe', 'square', 'paypal', future 'bitcoin'
  payment_method    payment_method?
  payment_status    payment_status  // pending, paid, failed, etc.
  is_deposit_payment Boolean? @default(false)
  deposit_percentage Decimal?
  // ... fee fields, gateway fields, etc.
  orders  orders  @relation(fields: [order_id], references: [id])
}
```

Key observation: `order_id` is **not unique** — multiple payment rows can reference the same order. This is already used by the deposit flow.

#### Existing Split Payment Precedent: Deposit Flow

The platform already implements a two-payment pattern for deposits:

1. **Deposit payment** at checkout — `is_deposit_payment = true`, `amount_cents = depositAmount`, `payment_status = 'paid'`
2. **Balance payment** at pickup — a second `payments` record for the remaining amount

This is the architectural foundation for split payments. The deposit flow proves the platform can handle multiple payments per order with different amounts and statuses.

#### Checkout UI: Single Gateway Selection

The current checkout page (`apps/web/src/app/checkout/page.tsx`) uses **radio-button selection** — the customer picks exactly one gateway:

```typescript
type PaymentMethod = 'square' | 'paypal' | 'stripe';
const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(...);
```

The UI renders one payment form at a time (SquarePaymentForm, StripePaymentForm, or PayPalPaymentForm) based on the selected gateway. There is no split payment UI.

#### Backend: Single Payment Record Per Checkout

The checkout route (`apps/api/src/routes/checkout.ts`) creates one `payments` record per order at checkout time. The `payment_method` field is a single value from the request body. The deposit flow creates the deposit payment at checkout and the balance payment is handled at fulfillment time (not at checkout).

### §7.2 Split Payment Scenarios

Three scenarios where a customer might want to use multiple payment methods for the same cart:

| Scenario | Description | Example |
|----------|-------------|---------|
| **Split tender** | Pay part of the total with one method, part with another | $50 on credit card, $30 in Bitcoin |
| **Gift card + payment method** | Apply gift card balance, pay remainder with another method | $20 gift card + $60 on Bitcoin |
| **Deposit + balance (different methods)** | Pay deposit with one method, balance with another | Deposit on Stripe, balance in Bitcoin at pickup |

### §7.3 Bitcoin Suitability for Split Payments

Bitcoin is **well-suited** for split tender scenarios:

| Factor | Assessment | Rationale |
|--------|-----------|-----------|
| **Partial invoice** | ✅ Supported | BTCPay Server supports creating invoices for partial amounts — the invoice is for the BTC portion only |
| **Independent confirmation** | ✅ Clean separation | BTC payment confirmation happens on-chain, independent of the fiat payment status |
| **No authorization hold** | ✅ No conflict | Bitcoin is push-only — no hold/capture cycle that could conflict with Stripe authorization |
| **Exchange rate isolation** | ✅ Locked per invoice | Each BTCPay invoice locks its own exchange rate — the BTC split amount is independent of the fiat amount |
| **Refund complexity** | ⚠️ Two refund paths | Refunds must be processed per payment method — BTC refund to wallet address, fiat refund to original card |
| **Checkout UX** | ⚠️ Needs new UI | Customer needs to specify split amounts and complete two payment flows sequentially |

### §7.4 Proposed Split Payment Architecture

#### Database Changes

No schema changes needed — the existing `payments` 1:many relationship with `orders` already supports multiple payments. However, adding a `split_group_id` field would link related split payments:

```sql
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS split_group_id TEXT,
ADD COLUMN IF NOT EXISTS split_sequence INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS split_total_cents INT;

-- Index for querying split payments
CREATE INDEX IF NOT EXISTS idx_payments_split_group ON payments(split_group_id);
```

| Field | Purpose |
|-------|---------|
| `split_group_id` | UUID linking all payments in the same split transaction |
| `split_sequence` | Order of payment within the split (0 = first, 1 = second) |
| `split_total_cents` | Total order amount being split across all payments |

For non-split payments (single payment), these fields remain null — backward compatible.

#### Backend: Split Payment Flow

New endpoint: `POST /api/checkout/split-payment`

```typescript
// Request body
{
  orderId: string;
  payments: Array<{
    gateway_type: 'stripe' | 'square' | 'paypal' | 'bitcoin';
    amount_cents: number;
    // Gateway-specific details (payment method token, BTCPay invoice ID, etc.)
  }>;
}

// Flow:
// 1. Validate sum of amounts = order total
// 2. Create a payment record for each split with split_group_id
// 3. Process each payment through its respective gateway
// 4. Order status = 'paid' only when ALL split payments are confirmed
// 5. If any split payment fails, cancel remaining pending splits and refund completed ones
```

**Order status logic for split payments**:

| State | Condition | Order Status |
|-------|-----------|-------------|
| All splits paid | All `payment_status = 'paid'` | `paid` |
| Some splits paid, others pending | At least one `paid`, at least one `pending` | `partially_paid` |
| Any split failed | Any `payment_status = 'failed'` | `payment_failed` — trigger refund of completed splits |
| All splits pending | All `payment_status = 'pending'` | `pending` |

New `payment_status` enum value: `partially_paid` (for orders with split payments where some but not all are confirmed).

#### Frontend: Split Payment UI

The checkout payment step would gain a "Split Payment" toggle:

**Without split (default)**: Current radio-button gateway selection — one payment method for the full amount.

**With split enabled**:

```
┌─────────────────────────────────────────────────┐
│  Order Total: $80.00                            │
│                                                 │
│  Payment 1: [Stripe ▼]  Amount: $50.00          │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░    │
│                                                 │
│  Payment 2: [Bitcoin ▼]  Amount: $30.00         │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
│                                                 │
│  Remaining: $0.00  ✓ Fully allocated            │
│                                                 │
│  [Pay Now] → Process Payment 1, then Payment 2  │
└─────────────────────────────────────────────────┘
```

**Sequential processing flow**:

1. Customer enables "Split Payment" toggle
2. Adds payment methods with amounts (must sum to order total)
3. Clicks "Pay Now"
4. **Payment 1** (e.g., Stripe): Process credit card charge → confirm success
5. **Payment 2** (e.g., Bitcoin): Generate BTCPay invoice for remaining amount → show QR code → wait for confirmation
6. Both confirmed → order status = `paid` → clear cart → redirect to confirmation

If Payment 1 succeeds but Payment 2 fails or expires:
- Show "Payment 2 failed — your card has been charged $50. Please complete Bitcoin payment within 15 minutes or contact the store for a refund."
- Keep Payment 2 invoice open for the BTCPay window (15 min)
- If Payment 2 expires → mark order as `partially_paid` → merchant notified → manual resolution

### §7.5 Bitcoin-Specific Split Payment Considerations

| Consideration | Impact | Mitigation |
|---------------|--------|------------|
| **Invoice expiry** | BTCPay invoice expires in 15 min; if customer is completing a card payment first, the Bitcoin invoice clock starts after | Start BTC invoice only after Payment 1 confirms — don't create both simultaneously |
| **Exchange rate lock** | BTC amount is locked when BTCPay invoice is created — if Payment 1 takes time, the rate may differ from what customer saw | Show "rate locked when you proceed to Bitcoin payment" messaging; lock rate at invoice creation, not at split selection |
| **Confirmation time** | BTC requires 10+ min for confirmation; order can't be marked `paid` until both confirm | Show "Awaiting Bitcoin confirmation" status; order auto-completes when BTCPay webhook fires |
| **Partial payment refund** | If customer cancels after Payment 1 (card) but before Payment 2 (BTC), need to refund the card payment | Automatic refund of completed splits when any split fails or is cancelled |
| **Fee calculation** | Platform fee should be calculated on the full order total, not per split | Calculate platform fee on order total, allocate proportionally across split payments |

### §7.6 Deposit + Bitcoin Split (Hybrid Scenario)

The existing deposit flow can be extended to support different payment methods for deposit and balance:

| Payment Phase | Method | Flow |
|---------------|--------|------|
| Deposit at checkout | Bitcoin | BTCPay invoice for deposit percentage |
| Balance at pickup | Stripe | Card charge for remaining amount |

This requires:
1. `checkout_mode = 'deposit'` with `payment_method = 'bitcoin'` at checkout
2. BTCPay invoice created for deposit amount only
3. At fulfillment, merchant initiates balance charge via Stripe (or customer pays in-store with card)
4. Two `payments` records linked by `split_group_id` — one `is_deposit_payment = true` (BTC), one `is_deposit_payment = false` (Stripe)

This is the **lowest-effort split payment** to implement because it reuses the existing deposit flow with the only change being different gateway types per phase.

### §7.7 Implementation Priority

| Split Payment Feature | Effort | Priority | Dependencies |
|----------------------|--------|----------|--------------|
| **Deposit + different methods** (§7.6) | Low | P2 | Phase 2 (Bitcoin gateway) + existing deposit flow |
| **Two-way split** (card + BTC) | Medium | P3 | Phase 2 + new split payment UI + backend endpoint |
| **Multi-way split** (3+ methods) | High | P4 (Future) | Two-way split first, then generalize |
| **Gift card + payment** | High | P4 (Future) | Gift card system doesn't exist yet |

**Recommendation**: Implement deposit + Bitcoin (§7.6) as part of Phase 2, since it reuses the existing deposit infrastructure. Defer full split tender UI to a future phase after Bitcoin gateway is operational.

### §7.8 Phased Plan Integration

| Phase | Split Payment Tasks |
|-------|-------------------|
| **Phase 2** (BTCPay Server Integration) | Support Bitcoin as deposit payment method; create BTCPay invoice for deposit amount only |
| **Phase 3** (Checkout UI) | Show Bitcoin as option in deposit flow; display BTC deposit invoice + "balance due at pickup" messaging |
| **Phase 8** (Future: Split Tender) | New split payment UI, `split_group_id` schema, `POST /api/checkout/split-payment` endpoint, `partially_paid` order status, sequential payment processing, refund-on-failure logic |

---

## §8 Bitcoin Policy Templates & Regulatory Compliance

### §8.1 Current Storefront Policy Infrastructure

The platform has a mature per-tenant storefront policy system:

- **`tenant_storefront_policies`** table — stores 5 policy types per tenant: `return_policy`, `shipping_policy`, `privacy_policy`, `terms_of_service`, `refund_policy`
- **`StorefrontPolicyService`** (`apps/api/src/services/StorefrontPolicyService.ts`) — CRUD service for policies, gated by the `storefront_types` capability type
- **`policies_enabled`** flag in `EffectiveStorefront` — tier-gated via `storefront_policies` feature key; controls whether merchant can configure policies
- **Policy routes** (`apps/api/src/routes/storefront-policies.ts`) — public GET (storefront display) + merchant GET/PUT (settings editor)
- **Policy editor UI** (`apps/web/src/app/t/[tenantId]/settings/policies/StorefrontPoliciesClient.tsx`) — tabbed markdown editor with per-policy-type placeholders
- **Public policy pages** (`apps/web/src/app/tenant/[id]/policies/[type]/page.tsx`) — rendered markdown policy pages on the storefront
- **Storefront footer** (`StorefrontFooter.tsx`) — links to each policy page
- **Bot knowledge integration** — `refreshPolicyEmbeddings()` chunks policies into bot knowledge for customer Q&A

### §8.2 Why Bitcoin Requires Dedicated Policies

Bitcoin payments introduce unique legal and regulatory considerations that traditional fiat gateways (Stripe, PayPal, Square, Clover) do not:

| Concern | Traditional Gateway | Bitcoin (BTCPay) |
|---------|--------------------|--------------------|
| **Refund mechanism** | Reversal to original payment method | No chargeback possible; BTC push-only; manual refund to customer wallet address |
| **Price volatility** | Not applicable (fiat-denominated) | Exchange rate locked at invoice creation; customer sees BTC amount that may differ from USD amount at confirmation |
| **Transaction finality** | Authorization can be voided; capture can be reversed | Irreversible after block confirmation; no void/cancel possible |
| **Confirmation time** | Instant (card/PayPal) | 10+ minutes (1 confirmation); customer may need to wait |
| **Tax reporting** | Gateway provides 1099-K | Merchant responsible for crypto tax reporting (Form 8949); platform may need to provide transaction logs |
| **AML/KYC** | Gateway handles (Stripe/PayPal KYC) | Non-custodial BTCPay = no KYC; merchant bears compliance burden |
| **Consumer protection** | Chargeback rights, Regulation E | No chargeback rights; consumer protection varies by jurisdiction |
| **Jurisdictional legality** | universally accepted | Bitcoin payment restricted or banned in some jurisdictions (e.g., China, Bolivia, Egypt) |
| **Record-keeping** | Gateway provides transaction records | Merchant must maintain BTC transaction logs (wallet address, amount, timestamp, exchange rate) |

### §8.3 Proposed Bitcoin Policy Types

Two new policy types specific to Bitcoin payments:

#### Policy 1: `cryptocurrency_payment_policy`

**Purpose**: Discloses the terms and conditions specific to paying with Bitcoin/cryptocurrency. Required before a merchant can activate the Bitcoin gateway.

**Template content**:

```markdown
## Cryptocurrency Payment Policy

### Accepted Cryptocurrencies
We accept Bitcoin (BTC) via BTCPay Server. Lightning Network payments may also be available.

### Payment Process
1. At checkout, select Bitcoin as your payment method
2. You will be redirected to a BTCPay invoice showing the BTC amount and a QR code
3. Send the exact BTC amount from your wallet to the address shown
4. The invoice expires after 15 minutes — if it expires, a new invoice with an updated exchange rate will be generated

### Exchange Rate
- The USD-to-BTC exchange rate is locked at the time of invoice creation
- The BTC amount you pay is calculated at the locked rate
- We use the exchange rate provided by BTCPay Server at invoice creation time

### Transaction Finality
- Bitcoin transactions are **irreversible** once confirmed on the blockchain
- We require 1 block confirmation (approximately 10 minutes) before marking your order as paid
- For orders under $50, we may accept 0-confirmation for faster processing

### Refunds
- Cryptocurrency refunds are issued in BTC to a wallet address you provide
- Refund amounts are calculated in USD at the original purchase exchange rate
- We are not liable for changes in BTC value between purchase and refund
- Refunds are processed within 5-7 business days

### Failed or Underpaid Invoices
- If you send less than the required BTC amount, your invoice will be marked as "underpaid"
- You will need to pay the remaining balance within the invoice window or contact us to arrange a partial order
- If you send more than the required amount, the overpayment will be refunded in BTC

### Tax Implications
- You are responsible for any tax liabilities arising from cryptocurrency transactions
- We recommend consulting a tax professional regarding cryptocurrency gains or losses
- We will provide a transaction record including the BTC amount, USD value, and exchange rate at time of purchase

### Privacy
- Bitcoin transactions are recorded on a public blockchain
- Your wallet address may be visible to the public
- We do not link your wallet address to your personal identity in our records beyond what is necessary for order fulfillment

### Jurisdiction
- Cryptocurrency payments are not available in all jurisdictions
- It is your responsibility to ensure that cryptocurrency payments are legal in your jurisdiction
```

#### Policy 2: `cryptocurrency_risk_disclosure`

**Purpose**: Risk disclosure statement acknowledging the customer understands the risks of Bitcoin payments. Required to be displayed at checkout when Bitcoin is selected.

**Template content**:

```markdown
## Cryptocurrency Risk Disclosure

By choosing to pay with Bitcoin, you acknowledge and accept the following risks:

1. **Price Volatility**: The value of Bitcoin can fluctuate significantly. The exchange rate is locked at invoice creation, but the BTC you spend may be worth more or less at the time of confirmation.

2. **Irreversibility**: Bitcoin transactions cannot be reversed, cancelled, or charged back. If you send payment to the wrong address or send the wrong amount, recovery is not guaranteed.

3. **Network Fees**: You are responsible for Bitcoin network transaction fees (miner fees). These fees are separate from the invoice amount and are not refundable.

4. **Confirmation Delays**: Bitcoin transactions require confirmation on the blockchain, which can take 10 minutes or longer during periods of network congestion.

5. **No Consumer Protection**: Unlike credit card payments, Bitcoin payments do not have chargeback rights or Regulation E protections. Disputes must be resolved directly with the merchant.

6. **Tax Obligations**: Cryptocurrency transactions may have tax implications. You are responsible for reporting and paying any applicable taxes.

7. **Regulatory Changes**: The legal status of cryptocurrencies may change in your jurisdiction. You are responsible for complying with applicable laws.

By proceeding with Bitcoin payment, you confirm that you understand these risks and agree to the terms outlined in our Cryptocurrency Payment Policy.
```

### §8.4 Policy Architecture Changes

#### Database

Add two new columns to `tenant_storefront_policies`:

```sql
ALTER TABLE tenant_storefront_policies
ADD COLUMN IF NOT EXISTS cryptocurrency_payment_policy TEXT,
ADD COLUMN IF NOT EXISTS cryptocurrency_risk_disclosure TEXT;
```

#### Backend

- **`StorefrontPolicyService`** — extend `PolicyType` union with `'cryptocurrency_payment_policy' | 'cryptocurrency_risk_disclosure'`; extend `StorefrontPolicies` interface; extend `upsertPolicies` to handle new fields
- **`storefront-policies.ts`** routes — extend Zod schema with new fields; extend `VALID_POLICY_TYPES` array
- **New: `BitcoinPolicyTemplateService`** — service that provides default templates (§7.3 content) and enforces policy adoption as a gateway activation prerequisite

#### Bitcoin Policy Enforcement

**Platform requirement**: Merchants must adopt (or customize) the `cryptocurrency_payment_policy` before the Bitcoin gateway can be activated. This is enforced at the API level:

```typescript
// In payment-gateway-settings.ts PUT handler
if (data.bitcoin_enabled === true) {
  const policies = await storefrontPolicyService.getPolicies(tenantId);
  if (!policies.cryptocurrency_payment_policy) {
    return res.status(403).json({
      success: false,
      error: 'policy_required',
      message: 'You must configure a Cryptocurrency Payment Policy before enabling Bitcoin payments',
      policy_type: 'cryptocurrency_payment_policy',
      template_available: true,
    });
  }
}
```

**Risk disclosure enforcement**: The `cryptocurrency_risk_disclosure` must be displayed at checkout when Bitcoin is selected as the payment method. The checkout UI checks for this policy and blocks Bitcoin payment selection if it's not configured:

```typescript
// In checkout page — Bitcoin payment option
const hasCryptoRiskDisclosure = policies?.cryptocurrency_risk_disclosure;
if (!hasCryptoRiskDisclosure) {
  // Show disabled state with "Risk disclosure required" message
}
```

#### Frontend

- **`StorefrontPoliciesClient.tsx`** — add two new tabs: "Crypto Payment Policy" and "Crypto Risk Disclosure"; show template adoption button when Bitcoin gateway is being activated
- **`BitcoinPaymentForm.tsx`** — display risk disclosure text above the BTCPay invoice; require customer acknowledgment checkbox before showing the invoice
- **Payment gateways settings page** — when merchant toggles Bitcoin on, show policy adoption prompt: "Before enabling Bitcoin, you need to configure a Cryptocurrency Payment Policy. Use our template?" → auto-fills from template, merchant can customize

### §8.5 Policy Template System

Rather than requiring merchants to write policies from scratch, the platform provides **template adoption**:

#### Template Service

New file: `apps/api/src/services/BitcoinPolicyTemplateService.ts`

```typescript
export class BitcoinPolicyTemplateService {
  // Returns default policy templates
  getPaymentPolicyTemplate(): string { /* §7.3 Policy 1 content */ }
  getRiskDisclosureTemplate(): string { /* §7.3 Policy 2 content */ }

  // One-click template adoption — copies template to tenant's policy record
  async adoptTemplates(tenantId: string, customize: boolean): Promise<void> {
    const templates = {
      cryptocurrency_payment_policy: this.getPaymentPolicyTemplate(),
      cryptocurrency_risk_disclosure: this.getRiskDisclosureTemplate(),
    };
    await storefrontPolicyService.upsertPolicies(tenantId, templates);
    // Refresh bot knowledge embeddings for new policies
    BotKnowledgeEmbeddingService.getInstance().refreshPolicyEmbeddings(tenantId);
  }
}
```

#### Template Customization

Merchants can:
1. **Adopt as-is** — one click, template content is saved to their policy record
2. **Customize then adopt** — template is loaded into the editor, merchant modifies, then saves
3. **Write their own** — skip template, write custom policy (must still have content in the field to activate Bitcoin)

#### Template Variables

Templates support variable substitution for merchant-specific details:

| Variable | Replaced With | Example |
|----------|--------------|---------|
| `{{merchant_name}}` | Tenant business name | "Acme Store" |
| `{{confirmation_time}}` | Configured confirmation threshold | "10 minutes (1 confirmation)" |
| `{{invoice_expiry}}` | BTCPay invoice expiry window | "15 minutes" |
| `{{low_amount_threshold}}` | 0-conf threshold for small orders | "$50" |
| `{{refund_days}}` | Refund processing time | "5-7 business days" |
| `{{contact_email}}` | Tenant contact email | "support@acmestore.com" |

### §8.6 Jurisdictional Compliance

#### Jurisdiction Detection

The platform can detect the merchant's jurisdiction from `tenant_business_profiles_list.country_code` and restrict Bitcoin enablement accordingly:

| Jurisdiction Status | Behavior |
|--------------------|---------|
| **Allowed** (US, EU, UK, Canada, Australia, etc.) | Bitcoin can be enabled with required policies |
| **Restricted** (China, Bolivia, Egypt, etc.) | Bitcoin cannot be enabled; toggle shows "Bitcoin payments are not available in your region" |
| **Ambiguous/Unknown** | Bitcoin can be enabled with required policies + additional risk disclosure |

New file: `apps/api/src/services/BitcoinJurisdictionService.ts`

```typescript
const RESTRICTED_JURISDICTIONS = [
  'CN', // China
  'BO', // Bolivia
  'EG', // Egypt
  'MA', // Morocco
  'NP', // Nepal
  'PK', // Pakistan
  'VN', // Vietnam (restricted)
  'QA', // Qatar
  'SA', // Saudi Arabia (restricted)
];

export function isBitcoinAllowed(countryCode: string | null): boolean {
  if (!countryCode) return true; // Allow if unknown
  return !RESTRICTED_JURISDICTIONS.includes(countryCode.toUpperCase());
}
```

#### US State-Level Restrictions

Some US states have specific crypto regulations (e.g., New York BitLicense). The platform can optionally enforce state-level checks:

| State | Regulation | Platform Behavior |
|-------|-----------|------------------|
| New York | BitLicense required for crypto businesses | Non-custodial BTCPay (merchant receives directly) likely exempt, but show warning |
| Louisiana | Virtual Currency Business Act | Show regulatory warning |
| Other states | Varies | Monitor and update restricted list |

### §8.7 Checkout Flow Integration

The Bitcoin checkout flow must incorporate policy display and acknowledgment:

```
Customer selects Bitcoin at checkout
  ↓
Check: Has cryptocurrency_risk_disclosure been configured?
  ↓ NO → Show "Bitcoin temporarily unavailable" + notify merchant
  ↓ YES
  ↓
Display risk disclosure text with acknowledgment checkbox
  ↓
Customer checks "I understand the risks of paying with Bitcoin"
  ↓
Generate BTCPay invoice → Show QR code/address/amount
  ↓
Customer pays → BTCPay webhook confirms
  ↓
Order marked as paid → Send confirmation with crypto payment policy link
```

### §8.8 Bot Knowledge Integration

When Bitcoin policies are configured, they should be embedded into the bot knowledge base for customer Q&A:

- **`BotKnowledgeEmbeddingService`** — extend `refreshPolicyEmbeddings()` to include `cryptocurrency_payment_policy` and `cryptocurrency_risk_disclosure` as separate chunks with `source_type='policy'`
- **Bot dynamic responses** — when customer asks "Can I pay with Bitcoin?" or "What are the risks of crypto payment?", the bot retrieves the policy embeddings and provides accurate, merchant-specific answers
- **Bot guardrail** — add rule: bot must always link to the full Cryptocurrency Payment Policy page when discussing Bitcoin payments

### §8.9 Compliance Checklist for Merchants

Before Bitcoin gateway goes live, the platform verifies:

| Requirement | Enforcement Point | Status |
|------------|-------------------|--------|
| Cryptocurrency Payment Policy configured | `payment-gateway-settings.ts` PUT handler | **Blocking** — gateway cannot be enabled |
| Cryptocurrency Risk Disclosure configured | Checkout page Bitcoin option | **Blocking** — Bitcoin payment option disabled at checkout |
| Merchant jurisdiction allows Bitcoin | `BitcoinJurisdictionService` | **Blocking** — toggle disabled in settings UI |
| BTCPay Server credentials configured | `payment_gateways` table | **Blocking** — no gateway adapter without credentials |
| Tax disclosure included in policy | Template validation | **Warning** — template includes by default, custom policies checked |
| Refund policy mentions BTC | Template validation | **Warning** — template includes by default |

### §8.10 Implementation in Phased Plan

Bitcoin policy templates are integrated into the phased plan as follows:

| Phase | Policy Tasks |
|-------|-------------|
| **Phase 1** (Capability Infrastructure) | Add `cryptocurrency_payment_policy` and `cryptocurrency_risk_disclosure` columns to `tenant_storefront_policies` |
| **Phase 2** (BTCPay Server Integration) | Create `BitcoinPolicyTemplateService`, `BitcoinJurisdictionService`; enforce policy check in `payment-gateway-settings.ts` |
| **Phase 3** (Checkout UI) | Display risk disclosure at checkout with acknowledgment checkbox; block Bitcoin selection if policy missing |
| **Phase 4** (Merchant Config UI) | Template adoption flow in settings page; policy editor tabs for crypto policies; jurisdiction warning display |
| **Phase 5** (Bot Knowledge) | Extend `refreshPolicyEmbeddings()` with crypto policies; bot guardrail for Bitcoin payment Q&A |

---

## §9 App Store Bundling Strategy

### §9.1 BSaaS Bundle Infrastructure

The platform has a mature BSaaS (Buy Software as a Service) bundle system:

- **`bsaas_bundles`** table — named bundles with pricing, billing cycle, trial days
- **`bsaas_bundle_items`** table — feature keys included in each bundle
- **`tenant_feature_purchases`** table — tracks per-tenant purchases with status (trial/active/canceled)
- **App Store UI** at `/t/[tenantId]/settings/store` with tabs: Plans, Features, Featured Products, Directory Promotion
- **Purchase flow**: Select bundle → choose payment method → Stripe checkout → feature keys activated with trial or active status
- **Renewal**: `bsaas-renewal.ts` job auto-renews expiring purchases

### §9.2 Proposed Bitcoin Bundles

Three bundle tiers for the App Store, each targeting different merchant profiles:

#### Bundle 1: "Crypto Starter" (Solo Merchants)

| Field | Value |
|-------|-------|
| `bundle_key` | `crypto_starter` |
| `marketing_name` | Crypto Starter |
| `description` | Accept Bitcoin payments with BTCPay Server. Perfect for digital goods and online merchants. |
| `price_cents` | 1900 ($19/mo) |
| `billing_cycle` | monthly |
| `trial_days` | 14 |
| **Items** | |
| | `payment_gateway_bitcoin` — Bitcoin payment gateway |
| | `fulfillment_pickup` — Pickup fulfillment (for local BTC sales) |
| | `product_types_digital` — Digital product type support |

**Target**: Online merchants selling digital goods who want to tap into the Bitcoin-native audience. Low price point, digital-only focus, minimal setup.

#### Bundle 2: "Crypto Commerce" (Growing Merchants)

| Field | Value |
|-------|-------|
| `bundle_key` | `crypto_commerce` |
| `marketing_name` | Crypto Commerce |
| `description` | Full Bitcoin payment support with flexible fulfillment and product types. Accept BTC online, in-store, and for services. |
| `price_cents` | 4900 ($49/mo) |
| `billing_cycle` | monthly |
| `trial_days` | 14 |
| **Items** | |
| | `payment_gateway_bitcoin` — Bitcoin payment gateway |
| | `payment_gateway_flexible` — Flexible gateway (add Bitcoin alongside existing Stripe/PayPal) |
| | `fulfillment_flexible` — All fulfillment methods (pickup + delivery + shipping) |
| | `product_types_flexible` — All product types (physical + digital + hybrid + service) |
| | `storefront_type_flexible` — All storefront types |
| | `featured_enabled` — Featured product badges |

**Target**: Growth-tier merchants who want Bitcoin as an additional payment option alongside existing gateways. Includes flexible capabilities across fulfillment, product types, and storefront types.

#### Bundle 3: "Crypto Pro" (High-Volume Merchants)

| Field | Value |
|-------|-------|
| `bundle_key` | `crypto_pro` |
| `marketing_name` | Crypto Pro |
| `description` | Enterprise Bitcoin payments with Lightning Network, social commerce integration, and advanced analytics. |
| `price_cents` | 9900 ($99/mo) |
| `billing_cycle` | monthly |
| `trial_days` | 7 |
| **Items** | |
| | `payment_gateway_bitcoin` — Bitcoin payment gateway |
| | `payment_gateway_flexible` — Flexible gateway selection |
| | `fulfillment_flexible` — All fulfillment methods |
| | `product_types_flexible` — All product types |
| | `storefront_type_flexible` — All storefront types |
| | `social_commerce_share_buttons` — Social share buttons (share BTC payment links) |
| | `social_commerce_social_proof` — Social proof display |
| | `crm_enabled` — CRM for Bitcoin customer management |
| | `chatbot_dynamic_enabled` — Dynamic bot with Bitcoin payment knowledge |
| | `featured_enabled` — Featured product badges |
| | `featured_random_featured` — Random featured rotation |

**Target**: Scale/enterprise merchants running multi-channel commerce who want Bitcoin integrated with their full platform stack — CRM, bot, social proof, and featured placements.

### §9.3 Bundle Feature Key Prerequisites

Some feature keys in the bundles above may not exist yet in `features_list`. Before creating bundles:

| Feature Key | Status | Action Needed |
|-------------|--------|---------------|
| `payment_gateway_bitcoin` | ❌ New | Insert in Phase 1 migration |
| `payment_gateway_flexible` | ✅ Likely exists | Verify in `tier_features_list` |
| `fulfillment_flexible` | ✅ Exists | Already in resolver |
| `product_types_flexible` | ✅ Exists | Already in resolver |
| `storefront_type_flexible` | ✅ Exists | Already in resolver |
| `featured_enabled` | ✅ Exists | Already in resolver |
| `social_commerce_share_buttons` | ✅ Exists | Already in resolver |
| `social_commerce_social_proof` | ✅ Exists | Already in resolver |
| `crm_enabled` | ✅ Exists | Already in resolver |
| `chatbot_dynamic_enabled` | ✅ Exists | Already in resolver |
| `featured_random_featured` | ✅ Exists | Already in resolver |

### §9.4 App Store UI Integration

The App Store at `/t/[tenantId]/settings/store` currently has 4 tabs: Plans, Features, Featured Products, Directory Promotion.

**Proposed addition**: New "Crypto" tab (or integrate into existing "Features" tab as a curated bundle section).

| Approach | Pros | Cons |
|----------|------|------|
| **New "Crypto" tab** | Dedicated Bitcoin discovery surface; clear marketing position; can show BTC price conversion | Adds tab clutter; separates from other feature bundles |
| **Integrate into "Features" tab** | Single feature marketplace; bundles appear alongside other purchases; less UI change | Bitcoin bundles may get lost among other features |
| **Banner/card on "Plans" tab** | Visible to all merchants; cross-sell opportunity; "Add Bitcoin to your plan" prompt | Not a separate purchase surface |

**Recommendation**: Add a **"Crypto" tab** to the App Store. Bitcoin is a differentiator that benefits from dedicated visibility. The tab shows:
1. The three bundles as purchase cards (Starter, Commerce, Pro)
2. A standalone `payment_gateway_bitcoin` feature for à la carte purchase
3. BTCPay Server setup guide link
4. BTC/USD live rate display (from BTCPay API)

### §9.5 Tier vs. Bundle Interaction

Bundles coexist with tier-based feature gating:

| Scenario | Behavior |
|----------|----------|
| Merchant on **growth** tier | Already has `payment_gateway_bitcoin` via tier → bundle shows "Included in your plan" |
| Merchant on **starter** tier | `payment_gateway_bitcoin` not in tier → bundle purchase unlocks it as `tenant_feature_purchase` |
| Merchant on **trial** tier | No payment gateway features → bundle purchase unlocks after trial converts to paid |
| Merchant already purchased `payment_gateway_bitcoin` à la carte | Bundle shows "Already purchased" for that feature key |

The existing `checkBundleEngagement()` function in `bsaas-purchases.ts` already handles this logic — it checks tier status and existing purchases per feature key.

### §9.6 Bundle SQL (Post-Phase 1)

```sql
-- Insert bundles after payment_gateway_bitcoin feature exists

-- Bundle 1: Crypto Starter
INSERT INTO bsaas_bundles (id, bundle_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order, created_at, updated_at)
VALUES (gen_random_uuid()::text, 'crypto_starter', 'Crypto Starter',
  'Accept Bitcoin payments with BTCPay Server. Perfect for digital goods and online merchants.',
  1900, 'monthly', 14, true, 100, NOW(), NOW());

INSERT INTO bsaas_bundle_items (id, bundle_id, feature_key, sort_order)
SELECT gen_random_uuid()::text, b.id, fk.feature_key, fk.sort_order
FROM bsaas_bundles b
CROSS JOIN (VALUES
  ('payment_gateway_bitcoin', 0),
  ('fulfillment_pickup', 1),
  ('product_types_digital', 2)
) AS fk(feature_key, sort_order)
WHERE b.bundle_key = 'crypto_starter';

-- Bundle 2: Crypto Commerce
INSERT INTO bsaas_bundles (id, bundle_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order, created_at, updated_at)
VALUES (gen_random_uuid()::text, 'crypto_commerce', 'Crypto Commerce',
  'Full Bitcoin payment support with flexible fulfillment and product types. Accept BTC online, in-store, and for services.',
  4900, 'monthly', 14, true, 101, NOW(), NOW());

INSERT INTO bsaas_bundle_items (id, bundle_id, feature_key, sort_order)
SELECT gen_random_uuid()::text, b.id, fk.feature_key, fk.sort_order
FROM bsaas_bundles b
CROSS JOIN (VALUES
  ('payment_gateway_bitcoin', 0),
  ('payment_gateway_flexible', 1),
  ('fulfillment_flexible', 2),
  ('product_types_flexible', 3),
  ('storefront_type_flexible', 4),
  ('featured_enabled', 5)
) AS fk(feature_key, sort_order)
WHERE b.bundle_key = 'crypto_commerce';

-- Bundle 3: Crypto Pro
INSERT INTO bsaas_bundles (id, bundle_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order, created_at, updated_at)
VALUES (gen_random_uuid()::text, 'crypto_pro', 'Crypto Pro',
  'Enterprise Bitcoin payments with Lightning Network, social commerce integration, and advanced analytics.',
  9900, 'monthly', 7, true, 102, NOW(), NOW());

INSERT INTO bsaas_bundle_items (id, bundle_id, feature_key, sort_order)
SELECT gen_random_uuid()::text, b.id, fk.feature_key, fk.sort_order
FROM bsaas_bundles b
CROSS JOIN (VALUES
  ('payment_gateway_bitcoin', 0),
  ('payment_gateway_flexible', 1),
  ('fulfillment_flexible', 2),
  ('product_types_flexible', 3),
  ('storefront_type_flexible', 4),
  ('social_commerce_share_buttons', 5),
  ('social_commerce_social_proof', 6),
  ('crm_enabled', 7),
  ('chatbot_dynamic_enabled', 8),
  ('featured_enabled', 9),
  ('featured_random_featured', 10)
) AS fk(feature_key, sort_order)
WHERE b.bundle_key = 'crypto_pro';
```

---

## §10 Phased Implementation Plan

### Phase 1: Capability Infrastructure (P0 Foundation)

**Goal**: Add Bitcoin to the capability system so it appears in tier resolution and merchant settings.

**Tasks**:
1. **Migration**: Add `bitcoin_enabled` column to `tenant_payment_gateway_settings`
2. **Migration**: Insert `payment_gateway_bitcoin` into `features_list`, link to `payment_gateway_options` capability type, enable for growth/scale/enterprise tiers
3. **Backend resolver**: Add `'bitcoin'` to `GatewayType` union in `PaymentGatewayResolver.ts` and `types.ts`
4. **Backend settings route**: Add `bitcoin_enabled` to Zod schema, tier validation, GET/PUT in `payment-gateway-settings.ts`
5. **Frontend types**: Add `'bitcoin'` to `GatewayType` in `CapabilityResolutionService.ts`, update `PaymentGatewayState.merchantPreferences`
6. **Frontend mapper**: Update `UnifiedCapabilityService.ts` `BackendEffectivePaymentGateway` and `mapPaymentGateway()`
7. **Frontend settings UI**: Add Bitcoin toggle card to `payment-gateways/page.tsx` (shows tier-gated state + merchant toggle)
8. **Tests**: Update `resolvers.test.ts` with Bitcoin test cases

**Estimated**: 2-3 days  
**Files touched**: ~12  
**Risk**: Low — additive change to existing pattern

### Phase 2: BTCPay Server Integration (P1 Backend)

**Goal**: Merchant can configure BTCPay Server credentials and receive Bitcoin payments.

**Tasks**:
1. **BitcoinGateway adapter**: Implement `PaymentGatewayInterface` for BTCPay Server
2. **BTCPay client**: HTTP client for BTCPay Server API (create invoice, get status, check rate)
3. **Payment gateways route**: Extend `payment-gateways.ts` to accept `gateway_type='bitcoin'` with BTCPay config
4. **Checkout route**: New `checkout/bitcoin.ts` — create BTCPay invoice, return redirect URL
5. **Webhook handler**: New `bitcoin-webhook.ts` — process invoice_paid/confirmed/expired events
6. **Route mounting**: Wire `bitcoin-webhook.ts` and `checkout/bitcoin.ts` in `index.ts`
7. **Order model**: Ensure `orders` table can store BTC-specific fields (btc_amount, btc_address, btcpay_invoice_id) — likely in metadata or new columns
8. **Platform fee**: Decide how platform fee applies to BTC payments (fiat conversion at time of payment, or BTC-denominated fee)

**Estimated**: 5-7 days  
**Files touched**: ~8 new, ~3 modified  
**Risk**: Medium — new external API integration, webhook reliability

### Phase 3: Checkout UI (P1 Frontend)

**Goal**: Customer can select Bitcoin at checkout and complete payment.

**Tasks**:
1. **BitcoinPaymentForm**: New checkout component showing BTCPay invoice (QR code, address, amount, expiry)
2. **Checkout page**: Add `'bitcoin'` to `PaymentMethod` type, add Bitcoin option to payment method selector
3. **Capability filtering**: Checkout page's `useEffect` already filters gateways via `paymentCap.data.effectiveGateways` — Bitcoin will appear automatically once resolver includes it
4. **Payment redirect**: After selecting Bitcoin, redirect to BTCPay invoice page or show embedded invoice
5. **Order confirmation**: Handle return from BTCPay payment (success/expiry callbacks)
6. **Checkout success page**: Update to handle Bitcoin-specific confirmation (waiting for block confirmation vs. instant)

**Estimated**: 3-4 days  
**Files touched**: ~3 new, ~2 modified  
**Risk**: Low — UI follows existing payment form pattern

### Phase 4: Merchant Configuration UI (P2)

**Goal**: Merchant can connect their BTCPay Server store from the payment gateways settings page.

**Tasks**:
1. **BTCPay config card**: New section in `payment-gateways/page.tsx` for Bitcoin configuration
2. **Config form**: Fields for BTCPay Server URL, store ID, API key, webhook secret
3. **Connection test**: "Test Connection" button that pings BTCPay Server API
4. **Gateway management**: Add/remove Bitcoin gateway in `payment_gateways` table
5. **Settings card**: Add "Bitcoin" card to `TenantSettings.tsx` payment gateways group
6. **Navigation**: No new nav link needed — Bitcoin appears within existing Payment Gateways page

**Estimated**: 2-3 days  
**Files touched**: ~3 modified  
**Risk**: Low

### Phase 5: Bot Knowledge + Notifications (P2)

**Goal**: Platform bot and notification system are Bitcoin-aware.

**Tasks**:
1. **BotKnowledgeEmbeddingService**: Add `refreshBitcoinEmbeddings()` — chunk Bitcoin payment info (accepted, how to pay, confirmation times) into `bot_knowledge_embeddings` with `source_type='bitcoin'`
2. **BotDynamicResponseService**: Add Bitcoin RAG search — inject Bitcoin payment context when customer asks about crypto payments
3. **BillingNotificationService**: Add `bitcoin_payment_received` notification type (email + CRM alert)
4. **Refresh trigger**: Fire `refreshBitcoinEmbeddings` when merchant saves Bitcoin gateway config

**Estimated**: 2-3 days  
**Files touched**: ~4 modified, ~0 new  
**Risk**: Low — follows established bot knowledge pattern

### Phase 6: Admin & Analytics (P3)

**Goal**: Platform admins can monitor Bitcoin payment activity.

**Tasks**:
1. **Admin dashboard**: Bitcoin payment volume in admin billing analytics
2. **Order source tracking**: Orders table already has `source` field — Bitcoin orders tagged `source='bitcoin'`
3. **Gateway health**: Admin view showing BTCPay Server connection status per tenant
4. **Analytics**: Bitcoin-specific metrics (BTC volume, conversion rate, average confirmation time)

**Estimated**: 2-3 days  
**Files touched**: ~3 modified  
**Risk**: Low

### Phase 7: App Store Bundling (P2)

**Goal**: Bitcoin bundles available for self-service purchase in the App Store.

**Tasks**:
1. **Bundle migration**: Insert `crypto_starter`, `crypto_commerce`, `crypto_pro` bundles into `bsaas_bundles` + `bsaas_bundle_items` (SQL from §7.6)
2. **App Store tab**: Add "Crypto" tab to `AppStoreClient.tsx` with bundle cards, à la carte feature, BTCPay setup guide link
3. **Bundle purchase flow**: Existing `bsaas-purchases.ts` handles bundle checkout — no new backend needed
4. **Tier interaction**: Existing `checkBundleEngagement()` handles tier vs. bundle logic — verify it works with `payment_gateway_bitcoin`
5. **Marketing copy**: Bundle descriptions, feature lists, BTC/USD rate display
6. **Trial flow**: 14-day trial for Starter/Commerce, 7-day for Pro — existing trial infrastructure handles this

**Estimated**: 2-3 days
**Files touched**: ~2 new (Crypto tab component), ~1 modified (AppStoreClient.tsx)
**Risk**: Low — uses existing BSaaS bundle infrastructure

### Phase 8: Advanced Features (Future)

**Deferred items**:
- **Lightning Network**: BTCPay Server supports Lightning — expose as separate option or sub-toggle
- **Coinbase Commerce**: Add as second Bitcoin gateway option (OAuth pattern)
- **Multi-currency**: Support altcoins (ETH, USDC, LTC) via Coinbase Commerce or BTCPay plugins
- **Automatic fiat conversion**: Integrate with exchange API to auto-convert BTC to USD at time of payment
- **Bitcoin Lightning invoices**: Sub-second payment via Lightning Network

---

## §11 Cross-Capability Constraint Considerations

### §11.1 Existing Constraints

Bitcoin as a gateway type must be considered in the Cross-Capability Constraint Layer (CCL):

| Constraint | Type | Severity | Rationale |
|------------|------|----------|-----------|
| `payment_gateway_bitcoin` requires `commerce_enabled` | requires | block | Can't accept Bitcoin if commerce is disabled |
| `payment_gateway_bitcoin` recommends `fulfillment_enabled` | recommends | warn | Bitcoin payments work best with defined fulfillment (pickup/shipping) |

### §11.2 No New Constraint Type Needed

Bitcoin doesn't introduce cross-capability dependencies outside the payment gateway domain. It's another gateway option within the existing `payment_gateway_options` capability type, so existing constraints that reference `payment_gateway_*` features automatically apply.

---

## §12 Database Migration Summary

```sql
-- Migration: 0XX_bitcoin_payment_gateway.sql

-- 1. Add bitcoin_enabled to merchant settings
ALTER TABLE tenant_payment_gateway_settings
ADD COLUMN IF NOT EXISTS bitcoin_enabled BOOLEAN DEFAULT true;

-- 2. Insert feature
INSERT INTO features_list (key, name, description, is_active, sort_order, created_at, updated_at)
VALUES ('payment_gateway_bitcoin', 'Bitcoin Payments', 'Accept Bitcoin via BTCPay Server', true, 5, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

-- 3. Link to capability type
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
VALUES (
  (SELECT id FROM capability_type_list WHERE key = 'payment_gateway_options'),
  (SELECT id FROM features_list WHERE key = 'payment_gateway_bitcoin'),
  true, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM capability_features_list WHERE capability_type_id = (SELECT id FROM capability_type_list WHERE key = 'payment_gateway_options'))
);

-- 4. Enable for tiers
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, capability_type_id, is_enabled)
SELECT gen_random_uuid()::text, stl.id, 'payment_gateway_bitcoin', 'Bitcoin Payments',
  (SELECT id FROM capability_type_list WHERE key = 'payment_gateway_options'), true
FROM subscription_tiers_list stl
WHERE stl.tier_key IN ('growth', 'scale', 'enterprise');

-- 5. Add Bitcoin policy columns to storefront policies
ALTER TABLE tenant_storefront_policies
ADD COLUMN IF NOT EXISTS cryptocurrency_payment_policy TEXT,
ADD COLUMN IF NOT EXISTS cryptocurrency_risk_disclosure TEXT;

-- 6. Add split payment tracking columns (for future split tender support)
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS split_group_id TEXT,
ADD COLUMN IF NOT EXISTS split_sequence INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS split_total_cents INT;

CREATE INDEX IF NOT EXISTS idx_payments_split_group ON payments(split_group_id);
```

---

## §13 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| BTC price volatility during invoice window | Medium | Low | BTCPay locks exchange rate at invoice creation (15-min window) |
| BTCPay Server downtime | Low | Medium | Merchant can disable Bitcoin toggle; fallback to other gateways |
| Webhook delivery failures | Medium | Medium | BTCPay retries webhooks; add manual status polling fallback |
| Block confirmation delays | High | Low | BTCPay configurable confirmations; 0-conf for small amounts, 1-conf for large |
| Regulatory uncertainty | Low | High | Non-custodial BTCPay = merchant receives BTC directly; platform never holds funds |
| Tax reporting complexity | Medium | Medium | Phase 6 analytics includes BTC transaction log; integrate with tax service later |
| Merchant onboarding friction | Medium | Low | BTCPay setup guide; no OAuth approval process unlike Stripe/Square |
| Regulatory non-compliance | Medium | High | §7 policy templates + jurisdictional checks; platform enforces policy adoption before gateway activation |
| Customer disputes over irreversible BTC | Medium | Medium | Risk disclosure at checkout with acknowledgment checkbox; Cryptocurrency Payment Policy clearly states no chargebacks |
| Missing/insufficient crypto policies | Low | High | Platform blocks Bitcoin gateway activation until policies are configured; template adoption flow minimizes friction |
| Split payment failure (one method fails) | Medium | Medium | Automatic refund of completed splits; order marked `partially_paid`; merchant notified for manual resolution |
| Split payment UX confusion | Medium | Low | Clear amount allocation UI; show remaining balance; sequential processing with status indicators |

---

## §14 API Keys & Infrastructure

### §14.1 BTCPay Server

| Item | Value |
|------|-------|
| Hosting | Self-hosted Docker or hosted BTCPay instance |
| API Auth | API key generated per store in BTCPay dashboard |
| Webhook | Configured per store with webhook secret |
| Cost | Free (self-hosted) or hosted provider fees (~$20-60/mo) |
| KYC | None (non-custodial) |

### §14.2 Per-Tenant Configuration

Each merchant configures their own BTCPay Server store:
- BTCPay Server URL (self-hosted or hosted)
- Store ID
- API Key
- Webhook Secret

Stored in `payment_gateways.config` JSON column, encrypted via existing `TokenEncryptionService`.

---

## §15 Estimated Timeline

| Phase | Duration | Priority | Dependencies |
|-------|----------|----------|--------------|
| Phase 1: Capability Infrastructure | 2-3 days | P0 | None |
| Phase 2: BTCPay Server Integration | 5-7 days | P1 | Phase 1 |
| Phase 3: Checkout UI | 3-4 days | P1 | Phase 2 |
| Phase 4: Merchant Config UI | 2-3 days | P2 | Phase 1 |
| Phase 5: Bot Knowledge + Notifications | 2-3 days | P2 | Phase 2 |
| Phase 6: Admin & Analytics | 2-3 days | P3 | Phase 2 |
| Phase 7: App Store Bundling | 2-3 days | P2 | Phase 1 |
| **Total (Phase 1-4)** | **12-17 days** | | |
| **Total (Phase 1-7)** | **18-26 days** | | |

---

## §16 Skill Compliance Checklist

This plan follows the **Capability Deployment Flow** (`.devin/skills/capability-deployment-flow.md`):

- [ ] **Phase 1 (Define)**: Add `payment_gateway_bitcoin` to feature definitions + tier hierarchies
- [ ] **Phase 2 (Seed DB)**: Migration to insert feature, link to capability type, enable for tiers
- [ ] **Phase 3 (Store Prefs)**: Add `bitcoin_enabled` column to `tenant_payment_gateway_settings`
- [ ] **Phase 4 (Resolve)**: Update `PaymentGatewayResolver.ts` + `types.ts` + `EffectiveCapabilityResolver.ts`
- [ ] **Phase 4.5 (Constraints)**: Add CCL constraint for `payment_gateway_bitcoin` requires `commerce_enabled`
- [ ] **Phase 5 (Route)**: Update `payment-gateway-settings.ts` with Bitcoin tier validation
- [ ] **Phase 6 (Map)**: Update `UnifiedCapabilityService.ts` + `CapabilityResolutionService.ts`
- [ ] **Phase 7 (Display)**: Update `payment-gateways/page.tsx` + `checkout/page.tsx` + `CapabilityShowcase.tsx`
- [ ] **Phase 8 (Verify)**: `pnpm checkapi` + `pnpm checkweb` + resolver tests

---

## §17 Decision Points Requiring User Input

1. **Provider choice**: BTCPay Server (recommended) vs. Coinbase Commerce vs. BitPay vs. OpenNode
2. **Tier availability**: Which tiers get Bitcoin? (Proposed: growth/scale/enterprise)
3. **Platform fee model**: How does the 3% platform fee apply to BTC payments? (Options: fiat-denominated fee deducted from BTC amount, or separate invoice)
4. **Custodial vs. non-custodial**: BTCPay (non-custodial, merchant holds BTC) vs. Coinbase Commerce (custodial, auto-converts to fiat)
5. **Lightning Network**: Include in Phase 2 or defer to Phase 8?
6. **Self-hosted vs. hosted BTCPay**: Platform hosts a BTCPay Server instance for all merchants, or each merchant self-hosts?
7. **Bundle pricing**: Are the proposed bundle prices ($19/$49/$99) appropriate, or should Bitcoin be included free in higher tiers as a differentiator?
8. **App Store tab**: New "Crypto" tab (recommended) vs. integrate into existing "Features" tab?
9. **Storefront type restrictions**: Enable Bitcoin for all storefront types including `social`, or restrict to `online`/`retail`/`service` initially?
10. **Policy enforcement level**: Should the Cryptocurrency Payment Policy be blocking (gateway cannot be enabled without it) or warning (enabled with reminder)? (Recommended: blocking)
11. **Risk disclosure at checkout**: Require explicit customer checkbox acknowledgment before showing BTCPay invoice, or display as informational text only? (Recommended: checkbox)
12. **Jurisdictional restrictions**: Enforce country-level Bitcoin bans via `tenant_business_profiles_list.country_code`, or leave compliance to the merchant? (Recommended: enforce)
13. **Policy template customization**: Allow merchants to fully customize the template, or lock certain sections (e.g., irreversibility disclosure) as non-editable? (Recommended: fully customizable with warnings on missing sections)
14. **Split payment support**: Should the platform support split tender (e.g., $50 card + $30 BTC) at checkout, or only single-gateway payments? (Recommended: implement deposit + Bitcoin first in Phase 2, defer full split tender to Phase 8)
15. **Split payment failure handling**: If one split payment fails, automatically refund completed splits, or leave them for manual merchant resolution? (Recommended: automatic refund with merchant notification)
