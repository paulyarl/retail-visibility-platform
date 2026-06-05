# E-Commerce Technical Specification - Retail Visibility Platform

**Document Version:** v1.0  
**Date:** 2025-11-06  
**Status:** Draft - Ready for Implementation  
**Owner:** Product & Engineering Team  
**Related Docs:** `ECOMMERCE_BOPIS_STRATEGY.md`, `STRIPE_PAYMENT_INTEGRATION.md`

---

## Executive Summary

This specification defines the technical requirements for implementing transactional e-commerce capabilities on the Retail Visibility Platform with BOPIS (Buy Online, Pick Up In Store) as the primary fulfillment method.

**Key Features:**
- Shopping cart and checkout flow
- Stripe Connect payment processing
- Real-time Clover inventory sync
- BOPIS fulfillment (primary)
- Multi-location support for organizations
- Tier-based feature access

**Target Launch:** Q2 2026 (6-month development cycle)

---

## Goals & Success Metrics

| Metric | Target (Year 1) |
|--------|-----------------|
| E-Commerce Adoption | 200 merchants |
| GMV | $120M |
| Conversion Rate | 5-7% |
| AOV Increase | 30% |
| Merchant Retention | 90%+ |

---

## Tier-Based Features

| Feature | Google-Only | Starter | Professional | E-Commerce | Enterprise | Organization |
|---------|-------------|---------|--------------|------------|------------|--------------|
| **Price** | $29/mo | $49/mo | $499/mo | $799/mo | $999/mo | $999/mo |
| **Shopping Cart** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Checkout** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **BOPIS** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Local Delivery** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Shipping** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Transaction Fee** | N/A | N/A | N/A | 1% | 0.5% | 0.5% |
| **Multi-Location** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Discounts/Promos** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Gift Cards** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## Data Model

### Core Tables

**shopping_carts**
- id, tenant_id, customer_id, session_id
- items (JSONB), subtotal_cents
- expires_at (7 days)

**orders**
- id, tenant_id, customer_id, organization_id
- order_number, status, fulfillment_type
- subtotal_cents, tax_cents, total_cents
- payment_id, payment_status
- inventory_reserved, clover_reservation_id
- customer_email, customer_phone, customer_name

**order_items**
- id, order_id, product_id
- product_name, product_sku, product_image_url
- quantity, unit_price_cents, subtotal_cents

**customers**
- id, email, phone, first_name, last_name
- total_orders, total_spent_cents
- marketing_opt_in, sms_opt_in

**platform_fees**
- id, tenant_id, order_id
- order_total_cents, platform_fee_cents
- stripe_payment_intent_id, status

**tenants (add columns)**
- stripe_connect_account_id
- stripe_connect_status
- ecommerce_enabled

---

## API Contracts

### Shopping Cart
- `POST /api/cart/add` - Add item to cart
- `GET /api/cart` - Get current cart
- `PUT /api/cart/update` - Update quantity
- `DELETE /api/cart/remove/:itemId` - Remove item

### Checkout
- `POST /api/checkout/validate` - Validate cart
- `POST /api/checkout/create-payment-intent` - Create Stripe payment
- `POST /api/checkout/complete` - Complete order

### Orders
- `GET /api/orders` - Customer order history
- `GET /api/orders/:orderId` - Order details
- `POST /api/orders/:orderId/cancel` - Cancel order

### Merchant Orders
- `GET /api/merchant/orders` - All orders for merchant
- `PUT /api/merchant/orders/:orderId/status` - Update status
- `POST /api/merchant/orders/:orderId/ready` - Mark ready

### Organization Orders
- `GET /api/organization/orders` - All locations' orders
- `GET /api/organization/orders/analytics` - Performance by location

---

## Frontend Components

### Customer-Facing
1. **ShoppingCart** - Slide-out cart with items
2. **ProductCard** - Add to cart button
3. **CheckoutPage** - 3-step checkout flow
4. **OrderConfirmation** - Success page
5. **OrderTracking** - Status tracking

### Merchant-Facing
1. **OrdersDashboard** - View and manage orders
2. **OrderDetails** - Full order information
3. **PaymentSettings** - Stripe Connect onboarding
4. **EcommerceToggle** - Enable/disable e-commerce

### Organization-Facing
1. **MultiLocationOrders** - All locations' orders
2. **LocationSelector** - Choose fulfillment location
3. **PerformanceAnalytics** - Revenue by location

---

## Payment Processing (Stripe Connect)

### Merchant Onboarding
```typescript
// Create Stripe Connect account
const account = await stripe.accounts.create({
  type: 'express',
  country: 'US',
  email: merchant.email,
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
});
```

### Payment Intent
```typescript
// Route payment to merchant
const paymentIntent = await stripe.paymentIntents.create({
  amount: order.totalCents,
  currency: 'usd',
  transfer_data: {
    destination: merchant.stripeConnectAccountId,
  },
  application_fee_amount: platformFeeCents, // 1%
});
```

### Fund Distribution
```
Customer pays $100
  ↓
Stripe fee: $3.20 (2.9% + $0.30)
Platform fee: $1.00 (1%)
  ↓
Merchant receives: $95.80
```

---

## Inventory Management

### Real-Time Sync
```typescript
// Before adding to cart
const inventory = await clover.getInventoryLevel(productId);
if (inventory.quantity < requestedQuantity) {
  throw new Error('Insufficient inventory');
}

// After payment
await clover.reserveInventory({
  itemId: productId,
  quantity,
  orderId,
  expiresAt: addHours(new Date(), 48),
});
```

### Multi-Layer Protection
1. **Cart Check** - Verify inventory before adding
2. **Checkout Validation** - Verify before payment
3. **Inventory Reservation** - Reserve after payment
4. **Webhook Sync** - Real-time updates
5. **Periodic Reconciliation** - Safety net (every 15 min)

---

## Organization & Chain Support

### Multi-Location Fulfillment
```typescript
// Customer selects pickup location
<LocationSelector locations={organization.locations} />

// Order routed to selected location
await createOrder({
  ...orderData,
  fulfillmentLocationId: selectedLocation.id,
});

// Location manager receives notification
await notifyLocationManager(selectedLocation.id, order);
```

### Centralized Management
```typescript
// Organization owner views all orders
const orders = await getOrganizationOrders({
  organizationId,
  dateFrom,
  dateTo,
});

// Analytics by location
const analytics = orders.reduce((acc, order) => {
  acc[order.fulfillmentLocationId] = {
    orders: (acc[order.fulfillmentLocationId]?.orders || 0) + 1,
    revenue: (acc[order.fulfillmentLocationId]?.revenue || 0) + order.totalCents,
  };
  return acc;
}, {});
```

### Shared Inventory (Optional)
```typescript
// Organization setting
organization.sharedInventory = true;

// Inventory check across all locations
const totalInventory = await Promise.all(
  organization.locations.map(loc => 
    clover.getInventoryLevel(productId, loc.cloverId)
  )
).then(results => results.reduce((sum, inv) => sum + inv.quantity, 0));
```

---

## Security & Compliance

### PCI DSS
- ✅ Stripe handles all card data
- ✅ No card numbers stored in platform
- ✅ Stripe Elements for secure input

### Data Privacy
- ✅ Customer data encrypted at rest
- ✅ HTTPS for all API calls
- ✅ GDPR-compliant data handling

### Fraud Prevention
- ✅ Stripe Radar for fraud detection
- ✅ 3D Secure for high-risk transactions
- ✅ Rate limiting on checkout

---

## Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Cart Load Time** | < 500ms | Response time |
| **Checkout Load** | < 2s | Page load |
| **Payment Processing** | < 3s | Stripe API |
| **Inventory Check** | < 1s | Clover API |
| **Order Creation** | < 2s | Database write |

---

## Testing Strategy

### Unit Tests
- Cart operations (add, update, remove)
- Order creation and validation
- Payment intent creation
- Inventory reservation

### Integration Tests
- Stripe Connect onboarding
- Clover inventory sync
- Webhook handling
- Email notifications

### E2E Tests
- Complete checkout flow
- BOPIS fulfillment
- Multi-location selection
- Order cancellation

---

## Rollout Plan

### Phase 1: Beta (Months 1-3)
- 10-20 hand-picked merchants
- BOPIS only
- Basic features
- Pricing: 50% off ($399/mo)

### Phase 2: Limited Release (Months 4-6)
- 50-100 merchants
- Invite-only
- Full BOPIS features
- Pricing: Early bird ($599/mo)

### Phase 3: General Availability (Months 7+)
- All merchants
- BOPIS + Delivery + Shipping (Enterprise)
- Full feature set
- Pricing: Standard ($799/mo)

---

## Success Criteria

- ✅ 200 merchants with e-commerce enabled
- ✅ $120M GMV in Year 1
- ✅ 5-7% conversion rate
- ✅ Zero overselling incidents
- ✅ 90%+ merchant retention
- ✅ 4.5+ star customer satisfaction

---

## Dependencies

- Stripe Connect API
- Clover POS API
- SendGrid Email API
- PostgreSQL database
- Redis cache
- Next.js frontend
- Express.js backend

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stripe Connect delays | High | Start onboarding early |
| Clover API issues | High | Fallback to manual sync |
| Low adoption | Medium | Beta program, incentives |
| Payment disputes | Medium | Clear policies, Stripe support |
| Inventory sync failures | High | Multi-layer protection |

---

## Appendix

### Glossary
- **BOPIS:** Buy Online, Pick Up In Store
- **GMV:** Gross Merchandise Value
- **AOV:** Average Order Value
- **SKU:** Stock Keeping Unit

### References
- Stripe Connect Documentation
- Clover API Documentation
- ECOMMERCE_BOPIS_STRATEGY.md
- STRIPE_PAYMENT_INTEGRATION.md
