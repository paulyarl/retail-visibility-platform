# Checkout Flow with Buyer Account Creation

## Overview

The platform supports three checkout scenarios:
1. **Authenticated User** - Existing account, cart persists across devices
2. **Guest Checkout** - No account required, cart in localStorage only
3. **Create Account During Checkout** - New buyer account with cart migration

---

## Current Cart Persistence

### ✅ Already Implemented

**CartContext** (`apps/web/src/contexts/CartContext.tsx`)
- Multi-tenant cart support
- localStorage persistence (guest users)
- Survives page refreshes
- Separate carts per tenant

**For Authenticated Users:**
- Cart data can be synced to database
- Persists across devices
- Survives browser clears
- Order history tracking

---

## Checkout Flow Design

### Scenario 1: Authenticated User Checkout

```
User clicks "Checkout" → Already logged in
    ↓
Checkout Page
    ├─ Shipping Address (pre-filled from profile)
    ├─ Payment Method (PayPal)
    └─ Review Order
    ↓
Place Order → Payment Processing → Order Confirmation
    ↓
Cart cleared, Order saved to user's order history
```

**Benefits:**
- ✅ Pre-filled shipping info
- ✅ Order history
- ✅ Cart synced across devices
- ✅ Saved payment methods (future)

---

### Scenario 2: Guest Checkout

```
User clicks "Checkout" → Not logged in
    ↓
Checkout Page - Guest Option
    ├─ Email (for order confirmation)
    ├─ Shipping Address (manual entry)
    ├─ Payment Method (PayPal)
    └─ Review Order
    ↓
Place Order → Payment Processing → Order Confirmation
    ↓
Cart cleared, Order confirmation sent to email
Optional: "Create account to track this order?"
```

**Benefits:**
- ✅ Fast checkout, no registration required
- ✅ Email confirmation
- ✅ Optional account creation after purchase

**Limitations:**
- ❌ No order history
- ❌ Cart doesn't persist across devices
- ❌ Must re-enter shipping info each time

---

### Scenario 3: Create Account During Checkout ⭐

```
User clicks "Checkout" → Not logged in
    ↓
Checkout Page - Account Creation Option
    ├─ "Sign in" or "Continue as guest" or "Create account"
    ↓
User selects "Create account"
    ↓
Account Creation Form (Inline)
    ├─ Email
    ├─ Password
    ├─ Name
    └─ [Create Account & Continue]
    ↓
Account created → User logged in → Cart migrated to account
    ↓
Checkout Page (now authenticated)
    ├─ Shipping Address (from registration)
    ├─ Payment Method (PayPal)
    └─ Review Order
    ↓
Place Order → Payment Processing → Order Confirmation
    ↓
Cart cleared, Order saved to user's order history
```

**Benefits:**
- ✅ One-time registration during checkout
- ✅ Cart automatically migrated to account
- ✅ Order history from first purchase
- ✅ Future purchases are faster
- ✅ Cart persists across devices going forward

---

## Implementation Plan

### Phase 1: Checkout Page Structure

**File:** `apps/web/src/app/checkout/page.tsx`

**Layout:**
```typescript
<CheckoutPage>
  {!isAuthenticated && (
    <AuthenticationSection>
      <Tabs>
        <Tab>Guest Checkout</Tab>
        <Tab>Sign In</Tab>
        <Tab>Create Account</Tab>
      </Tabs>
    </AuthenticationSection>
  )}
  
  <ShippingSection />
  <PaymentSection />
  <OrderReviewSection />
  <PlaceOrderButton />
</CheckoutPage>
```

---

### Phase 2: Buyer Account Creation Component

**File:** `apps/web/src/components/checkout/BuyerAccountCreation.tsx`

**Features:**
- Email validation
- Password strength indicator
- Name fields
- Optional phone number
- Terms & conditions checkbox
- "Create Account & Continue" button

**API Endpoint:** `POST /api/auth/register/buyer`

**Request:**
```typescript
{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptTerms: boolean;
}
```

**Response:**
```typescript
{
  user: {
    id: string;
    email: string;
    name: string;
    role: 'buyer';
  };
  token: string;
}
```

---

### Phase 3: Cart Migration

**When account is created during checkout:**

1. **Capture localStorage cart data**
   ```typescript
   const localCart = localStorage.getItem('cart');
   ```

2. **Send to backend with registration**
   ```typescript
   POST /api/auth/register/buyer
   {
     ...userInfo,
     migrateCart: localCart
   }
   ```

3. **Backend saves cart to database**
   ```sql
   INSERT INTO buyer_carts (user_id, tenant_id, items, created_at)
   VALUES (?, ?, ?, NOW())
   ```

4. **Frontend updates auth state**
   ```typescript
   setUser(newUser);
   setToken(token);
   // Cart automatically syncs from database
   ```

---

### Phase 4: Database Schema

**New Tables:**

#### `buyer_users`
```sql
CREATE TABLE buyer_users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
);
```

#### `buyer_addresses`
```sql
CREATE TABLE buyer_addresses (
  id VARCHAR(255) PRIMARY KEY,
  buyer_id VARCHAR(255) NOT NULL,
  type ENUM('shipping', 'billing') DEFAULT 'shipping',
  is_default BOOLEAN DEFAULT FALSE,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(255),
  state VARCHAR(255),
  postal_code VARCHAR(50),
  country VARCHAR(100) DEFAULT 'US',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_id) REFERENCES buyer_users(id) ON DELETE CASCADE,
  INDEX idx_buyer_id (buyer_id)
);
```

#### `buyer_carts` (Persistent)
```sql
CREATE TABLE buyer_carts (
  id VARCHAR(255) PRIMARY KEY,
  buyer_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  items JSON NOT NULL,
  subtotal INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_id) REFERENCES buyer_users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_buyer_id (buyer_id),
  INDEX idx_tenant_id (tenant_id)
);
```

#### `orders`
```sql
CREATE TABLE orders (
  id VARCHAR(255) PRIMARY KEY,
  buyer_id VARCHAR(255),
  tenant_id VARCHAR(255) NOT NULL,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
  items JSON NOT NULL,
  subtotal INT NOT NULL,
  shipping_cost INT DEFAULT 0,
  tax INT DEFAULT 0,
  total INT NOT NULL,
  shipping_address JSON,
  payment_method VARCHAR(50),
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
  payment_gateway_id VARCHAR(255),
  payment_transaction_id VARCHAR(255),
  guest_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_id) REFERENCES buyer_users(id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_gateway_id) REFERENCES tenant_payment_gateways(id),
  INDEX idx_buyer_id (buyer_id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_order_number (order_number),
  INDEX idx_guest_email (guest_email)
);
```

---

## User Flows

### Flow 1: First-Time Buyer Creates Account

```
1. Browse products → Add to cart (localStorage)
2. Click "Checkout"
3. See options: Guest | Sign In | Create Account
4. Click "Create Account"
5. Fill form: email, password, name
6. Click "Create Account & Continue"
   → Account created
   → User logged in
   → Cart migrated to database
7. Fill shipping address
8. Select PayPal payment
9. Review order
10. Place order → PayPal checkout
11. Order confirmation
    → Order saved to history
    → Cart cleared
```

**Result:**
- ✅ User has account
- ✅ Order in history
- ✅ Future carts persist across devices

---

### Flow 2: Returning Buyer

```
1. Sign in (or already signed in)
2. Browse products → Add to cart (syncs to database)
3. Cart persists across devices
4. Click "Checkout"
5. Shipping address pre-filled
6. Select payment method
7. Review order
8. Place order → PayPal checkout
9. Order confirmation
```

**Result:**
- ✅ Fast checkout (pre-filled info)
- ✅ Order added to history
- ✅ Can track all orders

---

### Flow 3: Guest Checkout (No Account)

```
1. Browse products → Add to cart (localStorage)
2. Click "Checkout"
3. Select "Continue as Guest"
4. Enter email for confirmation
5. Fill shipping address
6. Select PayPal payment
7. Review order
8. Place order → PayPal checkout
9. Order confirmation sent to email
10. Optional: "Create account to track this order?"
    → If yes, create account and link order
```

**Result:**
- ✅ Fast checkout, no registration
- ⚠️ No order history (unless account created after)
- ⚠️ Cart doesn't persist

---

## Checkout Page Components

### 1. AuthenticationSelector
```typescript
<AuthenticationSelector>
  <Tab active={tab === 'guest'}>
    Continue as Guest
  </Tab>
  <Tab active={tab === 'signin'}>
    Sign In
  </Tab>
  <Tab active={tab === 'register'}>
    Create Account
  </Tab>
</AuthenticationSelector>
```

### 2. BuyerRegistrationForm
```typescript
<BuyerRegistrationForm onSuccess={handleAccountCreated}>
  <Input name="email" type="email" required />
  <Input name="password" type="password" required />
  <Input name="firstName" required />
  <Input name="lastName" required />
  <Input name="phone" optional />
  <Checkbox name="acceptTerms" required />
  <Button>Create Account & Continue</Button>
</BuyerRegistrationForm>
```

### 3. ShippingAddressForm
```typescript
<ShippingAddressForm>
  {isAuthenticated && savedAddresses.length > 0 && (
    <SavedAddressSelector addresses={savedAddresses} />
  )}
  <AddressFields />
  {isAuthenticated && (
    <Checkbox>Save this address for future orders</Checkbox>
  )}
</ShippingAddressForm>
```

### 4. PaymentMethodSelector
```typescript
<PaymentMethodSelector>
  <PayPalButton />
  {/* Future: Credit Card, Apple Pay, etc */}
</PaymentMethodSelector>
```

### 5. OrderReview
```typescript
<OrderReview>
  <CartSummary items={cart.items} />
  <ShippingSummary address={shippingAddress} />
  <PricingBreakdown
    subtotal={subtotal}
    shipping={shippingCost}
    tax={tax}
    total={total}
  />
  <PlaceOrderButton onClick={handlePlaceOrder} />
</OrderReview>
```

---

## API Endpoints

### Authentication
- `POST /api/auth/register/buyer` - Create buyer account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/session` - Check auth status

### Cart Management
- `GET /api/buyer/carts` - Get authenticated user's carts
- `POST /api/buyer/carts` - Sync cart to database
- `PUT /api/buyer/carts/:tenantId` - Update cart
- `DELETE /api/buyer/carts/:tenantId` - Clear cart

### Checkout
- `POST /api/checkout/validate` - Validate cart and shipping
- `POST /api/checkout/calculate` - Calculate totals with tax/shipping
- `POST /api/orders` - Create order

### Orders
- `GET /api/buyer/orders` - Get order history
- `GET /api/buyer/orders/:id` - Get order details
- `POST /api/orders/:id/cancel` - Cancel order

### Addresses
- `GET /api/buyer/addresses` - Get saved addresses
- `POST /api/buyer/addresses` - Add new address
- `PUT /api/buyer/addresses/:id` - Update address
- `DELETE /api/buyer/addresses/:id` - Delete address

---

## Benefits Summary

### For Buyers
✅ **Flexibility** - Choose guest, sign in, or create account
✅ **Convenience** - Create account during checkout (no separate registration)
✅ **Persistence** - Authenticated carts sync across devices
✅ **History** - Track all orders in one place
✅ **Speed** - Pre-filled info for returning customers

### For Merchants (Tenants)
✅ **Higher Conversion** - Guest checkout reduces friction
✅ **Customer Accounts** - Build buyer database
✅ **Repeat Business** - Easier for buyers to return
✅ **Order Management** - Track all orders per buyer
✅ **Marketing** - Email list for promotions

### For Platform
✅ **User Growth** - More buyer accounts
✅ **Engagement** - Cross-tenant shopping
✅ **Data** - Better analytics on buyer behavior
✅ **Revenue** - More completed transactions

---

## Implementation Priority

### Phase 1: Foundation (Week 1)
- [ ] Create buyer_users table
- [ ] Create buyer_addresses table
- [ ] Create buyer_carts table (persistent)
- [ ] Create orders table
- [ ] Implement buyer registration API
- [ ] Implement buyer login API

### Phase 2: Checkout Page (Week 2)
- [ ] Create checkout page structure
- [ ] Add authentication selector
- [ ] Add buyer registration form
- [ ] Add shipping address form
- [ ] Add payment method selector
- [ ] Add order review section

### Phase 3: Cart Migration (Week 3)
- [ ] Implement cart sync to database
- [ ] Implement cart migration on registration
- [ ] Update CartContext for authenticated users
- [ ] Add cart persistence across devices

### Phase 4: Order Processing (Week 4)
- [ ] Implement order creation API
- [ ] Integrate PayPal payment processing
- [ ] Add order confirmation page
- [ ] Send order confirmation emails
- [ ] Add order history page

### Phase 5: Polish (Week 5)
- [ ] Add saved addresses feature
- [ ] Add "Create account after guest checkout"
- [ ] Add order tracking
- [ ] Add order cancellation
- [ ] Testing and bug fixes

---

## Next Steps

1. **Review and approve** this checkout flow design
2. **Create database migrations** for buyer tables
3. **Implement buyer authentication** endpoints
4. **Build checkout page** with account creation
5. **Test end-to-end** checkout flow
6. **Integrate PayPal** payment processing
7. **Launch** with guest and account options

---

## Technical Notes

### Security Considerations
- Password hashing (bcrypt)
- Email verification (optional)
- HTTPS only for checkout
- PCI compliance (PayPal handles card data)
- CSRF protection on forms
- Rate limiting on registration

### Performance
- Cart sync debounced (not on every change)
- Lazy load order history
- Optimize database queries with indexes
- Cache saved addresses

### UX Best Practices
- Clear progress indicator
- Inline validation
- Auto-save form data
- Mobile-optimized
- Accessibility (WCAG 2.1)
