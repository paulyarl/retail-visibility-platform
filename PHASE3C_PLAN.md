# Phase 3C: Payment UI & E-commerce Backend Completion

## Overview
Build the frontend payment experience and complete the e-commerce backend infrastructure to create a fully functional online ordering and payment system.

## Priority 1: Payment UI (Week 1)

### Day 1: Checkout Flow UI
**Goal:** Create the customer-facing checkout experience

#### Components to Build
1. **Checkout Page** (`apps/web/src/app/checkout/page.tsx`)
   - Order summary display
   - Customer information form
   - Shipping address form
   - Payment method selection

2. **Payment Form Component** (`apps/web/src/components/checkout/PaymentForm.tsx`)
   - Stripe Elements integration
   - Card input with validation
   - Payment method icons
   - Error handling UI

3. **Order Summary Component** (`apps/web/src/components/checkout/OrderSummary.tsx`)
   - Line items display
   - Subtotal, fees, total
   - Platform fee transparency
   - Edit cart functionality

4. **Checkout Progress Indicator**
   - Step 1: Cart Review
   - Step 2: Shipping Info
   - Step 3: Payment
   - Step 4: Confirmation

#### API Integration
- Connect to `POST /api/payments/authorize`
- Connect to `POST /api/payments/charge`
- Handle payment success/failure
- Redirect to confirmation page

#### Deliverables
- [ ] Checkout page with 3-step flow
- [ ] Stripe Elements integration
- [ ] Payment processing with loading states
- [ ] Error handling and validation
- [ ] Mobile-responsive design

---

### Day 2: Order Management UI
**Goal:** Allow customers to view and manage their orders

#### Components to Build
1. **Orders List Page** (`apps/web/src/app/orders/page.tsx`)
   - Order history table
   - Status badges
   - Search and filter
   - Pagination

2. **Order Details Page** (`apps/web/src/app/orders/[id]/page.tsx`)
   - Order information
   - Payment details
   - Status timeline
   - Invoice download

3. **Order Status Component**
   - Visual status indicator
   - Status history timeline
   - Tracking information (when available)

4. **Payment Receipt Component**
   - Transaction details
   - Platform fee breakdown
   - Download/print functionality

#### API Integration
- Connect to `GET /api/orders`
- Connect to `GET /api/orders/:id`
- Connect to `GET /api/orders/:id/payments`

#### Deliverables
- [ ] Orders list with filtering
- [ ] Order details page
- [ ] Payment receipt view
- [ ] Status tracking UI

---

### Day 3: Payment Management Dashboard
**Goal:** Admin/merchant payment management interface

#### Components to Build
1. **Payments Dashboard** (`apps/web/src/app/admin/payments/page.tsx`)
   - Payment statistics cards
   - Revenue charts
   - Recent transactions table
   - Quick actions

2. **Payment Details Modal**
   - Full payment information
   - Gateway response details
   - Refund action
   - Customer information

3. **Refund Modal**
   - Refund amount input
   - Reason selection
   - Confirmation dialog
   - Success/error feedback

4. **Revenue Analytics**
   - Daily/weekly/monthly charts
   - Platform fee revenue
   - Payment method breakdown
   - Success rate metrics

#### API Integration
- Connect to `GET /api/payments`
- Connect to `GET /api/payments/:id`
- Connect to `POST /api/payments/:id/refund`
- Analytics queries

#### Deliverables
- [ ] Payment dashboard with analytics
- [ ] Payment details view
- [ ] Refund functionality
- [ ] Revenue charts

---

### Day 4: Payment Settings & Configuration
**Goal:** Allow merchants to configure payment gateways

#### Components to Build
1. **Payment Settings Page** (`apps/web/src/app/settings/payments/page.tsx`)
   - Gateway configuration
   - Test/live mode toggle
   - API key management
   - Webhook status

2. **Gateway Setup Wizard**
   - Step-by-step Stripe setup
   - API key input
   - Verification status
   - Test payment

3. **Platform Fee Display**
   - Current tier display
   - Fee breakdown
   - Upgrade options
   - Fee history

#### API Integration
- Connect to payment gateway endpoints
- Gateway verification
- Fee tier management

#### Deliverables
- [ ] Payment settings page
- [ ] Gateway setup wizard
- [ ] Fee tier display
- [ ] Test payment functionality

---

### Day 5: Testing & Polish
**Goal:** Ensure payment UI is production-ready

#### Tasks
1. **End-to-End Testing**
   - Complete checkout flow
   - Payment success scenarios
   - Payment failure scenarios
   - Refund flow

2. **UI/UX Polish**
   - Loading states
   - Error messages
   - Success confirmations
   - Accessibility

3. **Mobile Optimization**
   - Responsive design
   - Touch-friendly inputs
   - Mobile payment methods

4. **Security Review**
   - No sensitive data in client
   - Proper error handling
   - HTTPS enforcement

#### Deliverables
- [ ] All payment flows tested
- [ ] Mobile-responsive
- [ ] Accessibility compliant
- [ ] Security verified

---

## Priority 2: E-commerce Backend Completion (Week 2)

### Day 1: Shipping Management
**Goal:** Add shipping rate calculation and carrier integration

#### Database Schema
```sql
-- Shipping zones
CREATE TABLE shipping_zones (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  countries TEXT[] NOT NULL,
  states TEXT[],
  postal_codes TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipping rates
CREATE TABLE shipping_rates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rate_type TEXT NOT NULL, -- flat, weight_based, price_based
  base_rate_cents INTEGER NOT NULL,
  min_order_cents INTEGER,
  max_order_cents INTEGER,
  min_weight_grams INTEGER,
  max_weight_grams INTEGER,
  estimated_days_min INTEGER,
  estimated_days_max INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipments
CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### API Endpoints
- `GET /api/shipping/zones` - List shipping zones
- `POST /api/shipping/zones` - Create shipping zone
- `GET /api/shipping/rates` - Calculate shipping rates
- `POST /api/orders/:id/ship` - Mark order as shipped
- `GET /api/orders/:id/tracking` - Get tracking info

#### Deliverables
- [ ] Shipping zones management
- [ ] Shipping rate calculation
- [ ] Shipment tracking
- [ ] Carrier integration (basic)

---

### Day 2: Inventory Management
**Goal:** Track product inventory and stock levels

#### Database Schema
```sql
-- Inventory locations
CREATE TABLE inventory_locations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address JSONB,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory items
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity_available INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,
  quantity_incoming INTEGER DEFAULT 0,
  reorder_point INTEGER,
  reorder_quantity INTEGER,
  last_counted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory transactions
CREATE TABLE inventory_transactions (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- sale, restock, adjustment, return
  quantity_change INTEGER NOT NULL,
  reference_id TEXT, -- order_id, etc
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### API Endpoints
- `GET /api/inventory/items` - List inventory
- `POST /api/inventory/items` - Add inventory
- `PUT /api/inventory/items/:id` - Update inventory
- `POST /api/inventory/adjust` - Adjust stock levels
- `GET /api/inventory/low-stock` - Get low stock alerts

#### Features
- Real-time stock tracking
- Automatic reservation on order
- Low stock alerts
- Inventory history

#### Deliverables
- [ ] Inventory tracking system
- [ ] Stock reservation on orders
- [ ] Low stock alerts
- [ ] Inventory adjustments

---

### Day 3: Advanced Order Fulfillment
**Goal:** Complete order lifecycle management

#### Features to Add
1. **Order Status Workflow**
   - Pending → Processing → Shipped → Delivered
   - Cancellation handling
   - Return/exchange flow

2. **Order Notes & Communication**
   - Internal order notes
   - Customer notifications
   - Status update emails

3. **Bulk Order Operations**
   - Bulk status updates
   - Bulk shipping label generation
   - Export orders to CSV

4. **Order Analytics**
   - Order volume trends
   - Average order value
   - Fulfillment time metrics

#### API Endpoints
- `POST /api/orders/:id/cancel` - Cancel order
- `POST /api/orders/:id/notes` - Add order note
- `POST /api/orders/bulk/ship` - Bulk ship orders
- `GET /api/orders/analytics` - Order analytics

#### Deliverables
- [ ] Complete order workflow
- [ ] Order notifications
- [ ] Bulk operations
- [ ] Order analytics

---

### Day 4: Customer Management
**Goal:** Build customer profiles and history

#### Database Schema
```sql
-- Customer profiles
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT, -- if registered user
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  default_shipping_address JSONB,
  default_billing_address JSONB,
  customer_since TIMESTAMPTZ DEFAULT NOW(),
  total_orders INTEGER DEFAULT 0,
  total_spent_cents INTEGER DEFAULT 0,
  average_order_cents INTEGER DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer addresses
CREATE TABLE customer_addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  address_type TEXT NOT NULL, -- shipping, billing
  is_default BOOLEAN DEFAULT false,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### API Endpoints
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer details
- `GET /api/customers/:id/orders` - Customer order history
- `POST /api/customers/:id/addresses` - Add address
- `GET /api/customers/analytics` - Customer analytics

#### Features
- Customer profiles
- Order history
- Saved addresses
- Customer lifetime value
- Purchase patterns

#### Deliverables
- [ ] Customer management system
- [ ] Customer profiles
- [ ] Address management
- [ ] Customer analytics

---

### Day 5: Discount & Promotion System
**Goal:** Enable promotional campaigns and discount codes

#### Database Schema
```sql
-- Discount codes
CREATE TABLE discount_codes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL, -- percentage, fixed_amount, free_shipping
  discount_value INTEGER NOT NULL, -- percentage or cents
  min_purchase_cents INTEGER,
  max_discount_cents INTEGER,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discount usage
CREATE TABLE discount_usage (
  id TEXT PRIMARY KEY,
  discount_code_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  customer_id TEXT,
  discount_amount_cents INTEGER NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### API Endpoints
- `POST /api/discounts` - Create discount code
- `GET /api/discounts` - List discount codes
- `POST /api/discounts/validate` - Validate discount code
- `GET /api/discounts/:id/usage` - Get usage stats

#### Features
- Percentage discounts
- Fixed amount discounts
- Free shipping codes
- Usage limits
- Expiration dates
- Minimum purchase requirements

#### Deliverables
- [ ] Discount code system
- [ ] Code validation
- [ ] Usage tracking
- [ ] Discount analytics

---

## Success Criteria

### Payment UI
- ✅ Complete checkout flow functional
- ✅ Stripe integration working
- ✅ Mobile-responsive design
- ✅ Error handling comprehensive
- ✅ Admin payment dashboard operational

### E-commerce Backend
- ✅ Shipping rates calculated
- ✅ Inventory tracked in real-time
- ✅ Order fulfillment complete
- ✅ Customer profiles working
- ✅ Discount codes functional

## Timeline Summary

**Week 1: Payment UI** (5 days)
- Day 1: Checkout flow
- Day 2: Order management
- Day 3: Payment dashboard
- Day 4: Payment settings
- Day 5: Testing & polish

**Week 2: E-commerce Backend** (5 days)
- Day 1: Shipping management
- Day 2: Inventory management
- Day 3: Order fulfillment
- Day 4: Customer management
- Day 5: Discounts & promotions

**Total Duration:** 10 working days

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Stripe Elements
- shadcn/ui components
- Recharts (for analytics)

### Backend (Already in place)
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Stripe SDK

---

**Status:** Ready to begin  
**Next Step:** Start with Day 1 - Checkout Flow UI  
**Last Updated:** 2026-01-10
