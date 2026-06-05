# E-Commerce Implementation Plan - Retail Visibility Platform

**Document Owner:** Engineering Team  
**Date:** 2025-11-06  
**Status:** Ready for Implementation  
**Linked Spec:** `specs/v39/ecommerce_technical_specification_rvp_v_1.md`

---

## Overview

This implementation plan breaks down the e-commerce feature development into 4 phases over 6 months, with each phase delivering incremental value and building toward a complete transactional commerce platform.

---

## Spec-to-Phase Quick Reference

| Spec Section | Implementation Phase | Weeks | Priority |
|--------------|---------------------|-------|----------|
| Data Model & Database | Phase 1 | 1-2 | P0 |
| Stripe Connect Integration | Phase 1 | 2-3 | P0 |
| Shopping Cart | Phase 1 | 3-4 | P0 |
| Checkout Flow | Phase 2 | 5-7 | P0 |
| Payment Processing | Phase 2 | 7-8 | P0 |
| Order Management | Phase 2 | 8-9 | P0 |
| BOPIS Fulfillment | Phase 3 | 10-12 | P0 |
| Inventory Sync | Phase 3 | 12-14 | P0 |
| Multi-Location Support | Phase 4 | 15-17 | P1 |
| Advanced Features | Phase 4 | 18-24 | P2 |

---

## Phase 1: Foundation & Stripe Connect (Weeks 1-4)

### 📋 Spec Reference
- **Data Model** (Spec Section 5)
- **Payment Processing** (Spec Section 8)
- **Tier-Based Features** (Spec Section 3)

### 🎯 Goals

- ✅ Create database schema for e-commerce
- ✅ Integrate Stripe Connect for merchant onboarding
- ✅ Build shopping cart functionality
- ✅ Enable tier-based feature access

---

### 📊 Deliverables

#### 1.1 Database Migration

**File:** `apps/api/prisma/migrations/XXX_create_ecommerce_tables.sql`

**Tables to Create:**
```sql
-- Shopping carts
CREATE TABLE shopping_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID REFERENCES customers(id),
  session_id TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal_cents INT DEFAULT 0,
  expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID REFERENCES customers(id),
  organization_id UUID REFERENCES organizations(id),
  order_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  subtotal_cents INT NOT NULL,
  tax_cents INT NOT NULL,
  total_cents INT NOT NULL,
  fulfillment_type TEXT NOT NULL,
  fulfillment_status TEXT,
  fulfillment_location_id UUID REFERENCES tenants(id),
  inventory_reserved BOOLEAN DEFAULT false,
  clover_reservation_id TEXT,
  payment_id TEXT,
  payment_status TEXT,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES inventory_items(id),
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_price_cents INT NOT NULL,
  subtotal_cents INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  total_orders INT DEFAULT 0,
  total_spent_cents INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Platform fees
CREATE TABLE platform_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  order_total_cents INT NOT NULL,
  platform_fee_cents INT NOT NULL,
  platform_fee_percentage DECIMAL(5,2) NOT NULL,
  stripe_payment_intent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add Stripe Connect fields to tenants
ALTER TABLE tenants ADD COLUMN stripe_connect_account_id TEXT;
ALTER TABLE tenants ADD COLUMN stripe_connect_status TEXT;
ALTER TABLE tenants ADD COLUMN stripe_connect_charges_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN ecommerce_enabled BOOLEAN DEFAULT false;
```

---

#### 1.2 Stripe Connect Integration

**File:** `apps/api/src/services/stripe-connect.service.ts`

```typescript
export class StripeConnectService {
  // Create Stripe Connect account for merchant
  async createConnectAccount(tenantId: string) {
    const tenant = await db.tenants.findById(tenantId);
    
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: tenant.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: tenant.name,
        url: `https://platform.com/s/${tenant.slug}`,
      },
    });
    
    await db.tenants.update(tenantId, {
      stripeConnectAccountId: account.id,
      stripeConnectStatus: 'pending',
    });
    
    return account;
  }
  
  // Create onboarding link
  async createOnboardingLink(tenantId: string) {
    const tenant = await db.tenants.findById(tenantId);
    
    const accountLink = await stripe.accountLinks.create({
      account: tenant.stripeConnectAccountId,
      refresh_url: `${process.env.WEB_URL}/settings/payments/refresh`,
      return_url: `${process.env.WEB_URL}/settings/payments/complete`,
      type: 'account_onboarding',
    });
    
    return accountLink.url;
  }
  
  // Check account status
  async getAccountStatus(tenantId: string) {
    const tenant = await db.tenants.findById(tenantId);
    
    const account = await stripe.accounts.retrieve(
      tenant.stripeConnectAccountId
    );
    
    await db.tenants.update(tenantId, {
      stripeConnectChargesEnabled: account.charges_enabled,
      stripeConnectPayoutsEnabled: account.payouts_enabled,
      stripeConnectStatus: account.charges_enabled ? 'active' : 'pending',
    });
    
    return account;
  }
}
```

---

#### 1.3 Shopping Cart API

**File:** `apps/api/src/routes/cart.ts`

```typescript
// Add item to cart
router.post('/cart/add', async (req, res) => {
  const { tenantId, productId, quantity, sessionId } = req.body;
  
  // Check inventory
  const inventory = await clover.getInventoryLevel(productId);
  if (inventory.quantity < quantity) {
    return res.status(409).json({
      error: 'Insufficient inventory',
      available: inventory.quantity,
    });
  }
  
  // Get or create cart
  let cart = await db.carts.findOne({
    where: { tenantId, sessionId },
  });
  
  if (!cart) {
    cart = await db.carts.create({
      tenantId,
      sessionId,
      items: [],
    });
  }
  
  // Add item
  const product = await db.inventoryItems.findById(productId);
  cart.items.push({
    productId,
    productName: product.name,
    productSku: product.sku,
    quantity,
    unitPriceCents: product.priceCents,
    subtotalCents: product.priceCents * quantity,
  });
  
  cart.subtotalCents = cart.items.reduce(
    (sum, item) => sum + item.subtotalCents,
    0
  );
  
  await db.carts.update(cart.id, cart);
  
  res.json({ success: true, cart });
});

// Get cart
router.get('/cart', async (req, res) => {
  const { sessionId } = req.query;
  
  const cart = await db.carts.findOne({
    where: { sessionId },
  });
  
  res.json({ cart });
});

// Update quantity
router.put('/cart/update', async (req, res) => {
  const { cartId, itemId, quantity } = req.body;
  
  const cart = await db.carts.findById(cartId);
  
  if (quantity === 0) {
    cart.items = cart.items.filter(item => item.id !== itemId);
  } else {
    const item = cart.items.find(item => item.id === itemId);
    item.quantity = quantity;
    item.subtotalCents = item.unitPriceCents * quantity;
  }
  
  cart.subtotalCents = cart.items.reduce(
    (sum, item) => sum + item.subtotalCents,
    0
  );
  
  await db.carts.update(cartId, cart);
  
  res.json({ success: true, cart });
});
```

---

#### 1.4 Shopping Cart Component

**File:** `apps/web/src/components/ecommerce/ShoppingCart.tsx`

```typescript
export function ShoppingCart({ tenantId }: { tenantId: string }) {
  const [cart, setCart] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    loadCart();
  }, []);
  
  const loadCart = async () => {
    const sessionId = getSessionId();
    const response = await fetch(`/api/cart?sessionId=${sessionId}`);
    const data = await response.json();
    setCart(data.cart);
  };
  
  const addToCart = async (productId: string, quantity: number) => {
    const sessionId = getSessionId();
    await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, productId, quantity, sessionId }),
    });
    await loadCart();
    setIsOpen(true);
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <ShoppingCartIcon className="h-5 w-5" />
          {cart?.items?.length > 0 && (
            <Badge className="absolute -top-2 -right-2">
              {cart.items.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
        </SheetHeader>
        
        <div className="mt-8 space-y-4">
          {cart?.items?.map((item) => (
            <CartItem key={item.id} item={item} onUpdate={loadCart} />
          ))}
        </div>
        
        <div className="mt-auto pt-4 border-t">
          <div className="flex justify-between text-lg font-bold">
            <span>Subtotal:</span>
            <span>${(cart?.subtotalCents / 100).toFixed(2)}</span>
          </div>
          
          <Button className="w-full mt-4" asChild>
            <Link href="/checkout">Checkout</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

### ✅ Acceptance Criteria

- [ ] Database migration runs successfully
- [ ] Stripe Connect account creation works
- [ ] Merchant onboarding flow completes
- [ ] Shopping cart adds/updates/removes items
- [ ] Cart persists across sessions
- [ ] Inventory checked before adding
- [ ] Cart UI displays correctly
- [ ] Tier-based access control works

---

## Phase 2: Checkout & Payment (Weeks 5-9)

### 📋 Spec Reference
- **Checkout API** (Spec Section 6)
- **Payment Processing** (Spec Section 8)
- **Order Management** (Spec Section 6)

### 🎯 Goals

- ✅ Build checkout flow (3 steps)
- ✅ Integrate Stripe payment processing
- ✅ Create order management system
- ✅ Send email notifications

---

### 📊 Deliverables

#### 2.1 Checkout API

**File:** `apps/api/src/routes/checkout.ts`

```typescript
// Create payment intent
router.post('/checkout/create-payment-intent', async (req, res) => {
  const { cartId, customerInfo, fulfillmentType } = req.body;
  
  const cart = await db.carts.findById(cartId);
  const tenant = await db.tenants.findById(cart.tenantId);
  
  // Calculate totals
  const subtotalCents = cart.subtotalCents;
  const taxCents = Math.round(subtotalCents * 0.08); // 8% tax
  const totalCents = subtotalCents + taxCents;
  const platformFeeCents = Math.round(totalCents * 0.01); // 1% fee
  
  // Create order
  const order = await db.orders.create({
    tenantId: cart.tenantId,
    orderNumber: generateOrderNumber(),
    status: 'pending_payment',
    subtotalCents,
    taxCents,
    totalCents,
    fulfillmentType,
    customerEmail: customerInfo.email,
    customerPhone: customerInfo.phone,
    customerName: customerInfo.name,
  });
  
  // Create order items
  for (const item of cart.items) {
    await db.orderItems.create({
      orderId: order.id,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      subtotalCents: item.subtotalCents,
    });
  }
  
  // Create Stripe payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'usd',
    transfer_data: {
      destination: tenant.stripeConnectAccountId,
    },
    application_fee_amount: platformFeeCents,
    metadata: {
      orderId: order.id,
      tenantId: cart.tenantId,
    },
  });
  
  await db.orders.update(order.id, {
    paymentId: paymentIntent.id,
  });
  
  res.json({
    clientSecret: paymentIntent.client_secret,
    orderId: order.id,
    orderNumber: order.orderNumber,
  });
});

// Complete checkout
router.post('/checkout/complete', async (req, res) => {
  const { orderId, paymentIntentId } = req.body;
  
  const order = await db.orders.findById(orderId);
  
  // Verify payment
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  
  if (paymentIntent.status === 'succeeded') {
    await db.orders.update(orderId, {
      status: 'pending_pickup',
      paymentStatus: 'succeeded',
      paidAt: new Date(),
    });
    
    // Send confirmation email
    await sendOrderConfirmation(order);
    
    res.json({ success: true, order });
  } else {
    res.status(400).json({ error: 'Payment failed' });
  }
});
```

---

#### 2.2 Checkout Page

**File:** `apps/web/src/app/s/[slug]/checkout/page.tsx`

```typescript
export default function CheckoutPage() {
  const [step, setStep] = useState(1);
  const [customerInfo, setCustomerInfo] = useState({});
  const [fulfillmentType, setFulfillmentType] = useState('bopis');
  
  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        <Step number={1} active={step === 1} completed={step > 1}>
          Contact Info
        </Step>
        <Step number={2} active={step === 2} completed={step > 2}>
          Fulfillment
        </Step>
        <Step number={3} active={step === 3}>
          Payment
        </Step>
      </div>
      
      {/* Step 1: Customer Info */}
      {step === 1 && (
        <CustomerInfoForm
          onComplete={(info) => {
            setCustomerInfo(info);
            setStep(2);
          }}
        />
      )}
      
      {/* Step 2: Fulfillment */}
      {step === 2 && (
        <FulfillmentForm
          onComplete={(type) => {
            setFulfillmentType(type);
            setStep(3);
          }}
        />
      )}
      
      {/* Step 3: Payment */}
      {step === 3 && (
        <PaymentForm
          customerInfo={customerInfo}
          fulfillmentType={fulfillmentType}
        />
      )}
    </div>
  );
}
```

---

### ✅ Acceptance Criteria

- [ ] Checkout flow completes all 3 steps
- [ ] Payment intent created successfully
- [ ] Stripe payment processes
- [ ] Order created in database
- [ ] Confirmation email sent
- [ ] Order appears in merchant dashboard
- [ ] Platform fee collected

---

## Phase 3: BOPIS & Inventory Sync (Weeks 10-14)

### 📋 Spec Reference
- **Inventory Management** (Spec Section 9)
- **Order Fulfillment** (Spec Section 10)

### 🎯 Goals

- ✅ Implement real-time inventory sync
- ✅ Build BOPIS fulfillment flow
- ✅ Create merchant order dashboard
- ✅ Implement inventory reservation

---

### 📊 Deliverables

#### 3.1 Inventory Reservation

**File:** `apps/api/src/services/inventory.service.ts`

```typescript
export class InventoryService {
  // Reserve inventory after payment
  async reserveInventory(orderId: string) {
    const order = await db.orders.findById(orderId);
    const items = await db.orderItems.findMany({ where: { orderId } });
    
    for (const item of items) {
      const reservation = await clover.reserveInventory({
        itemId: item.cloverItemId,
        quantity: item.quantity,
        orderId: order.id,
        expiresAt: addHours(new Date(), 48),
      });
      
      await db.orders.update(orderId, {
        inventoryReserved: true,
        cloverReservationId: reservation.id,
      });
    }
  }
  
  // Release reservation on cancellation
  async releaseReservation(orderId: string) {
    const order = await db.orders.findById(orderId);
    
    await clover.releaseReservation({
      reservationId: order.cloverReservationId,
    });
    
    await db.orders.update(orderId, {
      inventoryReserved: false,
    });
  }
}
```

---

#### 3.2 Merchant Orders Dashboard

**File:** `apps/web/src/app/(platform)/orders/page.tsx`

```typescript
export default function OrdersDashboardPage() {
  const { orders, updateStatus } = useOrders();
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Orders</h1>
      
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending">
          {orders.filter(o => o.status === 'pending_pickup').map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onMarkReady={() => updateStatus(order.id, 'ready')}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### ✅ Acceptance Criteria

- [ ] Inventory reserved after payment
- [ ] Clover webhook updates inventory
- [ ] Merchant dashboard shows orders
- [ ] Status updates work
- [ ] Customer notifications sent
- [ ] Zero overselling achieved

---

## Phase 4: Multi-Location & Advanced (Weeks 15-24)

### 📋 Spec Reference
- **Organization & Chain Support** (Spec Section 11)
- **Tier-Based Features** (Spec Section 3)

### 🎯 Goals

- ✅ Multi-location fulfillment
- ✅ Centralized order management
- ✅ Advanced features (discounts, gift cards)
- ✅ Performance optimization

---

### 📊 Deliverables

#### 4.1 Multi-Location Support

**File:** `apps/web/src/components/ecommerce/LocationSelector.tsx`

```typescript
export function LocationSelector({ organizationId }: { organizationId: string }) {
  const { locations } = useOrganizationLocations(organizationId);
  const [selected, setSelected] = useState(null);
  
  return (
    <Select value={selected} onValueChange={setSelected}>
      <SelectTrigger>
        <SelectValue placeholder="Choose pickup location" />
      </SelectTrigger>
      <SelectContent>
        {locations.map(location => (
          <SelectItem key={location.id} value={location.id}>
            {location.name} - {location.city}, {location.state}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

---

### ✅ Acceptance Criteria

- [ ] Multi-location selection works
- [ ] Orders routed to correct location
- [ ] Organization dashboard shows all orders
- [ ] Advanced features enabled for Enterprise
- [ ] Performance targets met

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Beta Merchants | 10-20 | Pending |
| GMV (Beta) | $500K | Pending |
| Conversion Rate | 5-7% | Pending |
| Zero Overselling | 100% | Pending |

---

## Timeline Summary

- **Weeks 1-4:** Foundation & Stripe Connect
- **Weeks 5-9:** Checkout & Payment
- **Weeks 10-14:** BOPIS & Inventory
- **Weeks 15-24:** Multi-Location & Advanced

**Total:** 6 months to full launch
