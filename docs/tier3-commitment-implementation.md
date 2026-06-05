# Tier 3 Commitment - Deposit Collection Implementation

## Overview

Tier 3 (Commitment) introduces deposit-based checkout where shoppers pay a 10-15% holding fee to reserve inventory, with the remaining balance due at pickup. This drives foot traffic and reduces no-shows.

## Implementation Summary

### 1. Database Schema Changes

**Orders Table** (`apps/api/prisma/schema.prisma`):
- `checkout_mode` - 'deposit' or 'full_payment'
- `deposit_percentage` - Percentage collected (10-15%)
- `deposit_cents` - Deposit amount collected
- `remaining_balance_cents` - Amount due at pickup
- `deposit_forfeited_at` - When deposit was forfeited
- `pickup_deadline` - 48-hour deadline for pickup

**Payments Table** (`apps/api/prisma/schema.prisma`):
- `is_deposit_payment` - Boolean flag for deposit payments
- `deposit_percentage` - Percentage of total order
- `deposit_forfeited` - Boolean flag for forfeited deposits
- `forfeited_at` - Timestamp of forfeiture
- `platform_forfeit_fee_cents` - Platform's share (20-25%)
- `retailer_forfeit_amount_cents` - Retailer's share (75-80%)

**Migration**: `apps/api/src/migrations/add_deposit_collection_fields.sql`

### 2. Deposit Calculation Logic

**File**: `apps/api/src/utils/deposit-calculator.ts`

Key functions:
- `getCheckoutModeForTier(tierKey)` - Returns 'deposit' for commitment tier
- `calculateDeposit(totalCents, percentage)` - Calculates deposit amounts
- `calculateForfeiture(depositCents)` - Calculates fee distribution
- `getDepositPercentageForTenant(tenantId, prisma)` - Gets tenant-specific percentage

**Constants**:
- Default deposit: 10%
- Min: 10%, Max: 15%
- Pickup deadline: 48 hours
- Platform forfeit fee: 20%
- Retailer compensation: 80%

### 3. Checkout API Integration

**File**: `apps/api/src/routes/checkout.ts`

Changes:
- Fetches tenant tier to determine checkout mode
- Calculates deposit for Tier 3 tenants
- Creates order with deposit fields
- Creates payment with deposit amount (not full total)
- Returns deposit info in response

### 4. Frontend Checkout UI

**OrderSummary Component** (`apps/web/src/components/checkout/OrderSummary.tsx`):
- Displays deposit breakdown for commitment checkout
- Shows total order value, deposit due now, balance due at pickup
- Highlights pickup deadline and forfeiture warning
- Amber-colored info box for commitment details

**Checkout Page** (`apps/web/src/app/checkout/page.tsx`):
- Fetches tenant tier from payment gateways
- Calculates deposit info for Tier 3
- Passes deposit amount to payment forms
- Shows deposit-specific UI elements

### 5. Forfeiture Service

**File**: `apps/api/src/services/DepositForfeitureService.ts`

Features:
- Processes eligible forfeitures (expired pickup deadlines)
- Distributes fees between platform and retailer
- Releases reserved inventory
- Creates audit log entries
- Provides forfeiture statistics

**API Routes** (`apps/api/src/routes/deposit-forfeiture.ts`):
- `POST /api/deposit-forfeiture/process` - Process all eligible (admin)
- `GET /api/deposit-forfeiture/order/:orderId/status` - Deadline status
- `GET /api/deposit-forfeiture/tenant/:tenantId/stats` - Statistics
- `POST /api/deposit-forfeiture/order/:orderId/process` - Manual process (admin)

## Testing Checklist

### 1. Database Migration

Run the migration:
```bash
# Connect to database and run migration
psql $DATABASE_URL -f apps/api/src/migrations/add_deposit_collection_fields.sql
```

Verify fields exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('checkout_mode', 'deposit_percentage', 'deposit_cents', 'remaining_balance_cents', 'pickup_deadline');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' 
AND column_name IN ('is_deposit_payment', 'deposit_percentage', 'deposit_forfeited', 'platform_forfeit_fee_cents');
```

### 2. Tier 3 Tenant Setup

Create or update a tenant to commitment tier:
```sql
UPDATE tenants 
SET subscription_tier = 'commitment' 
WHERE id = 'test-tenant-id';
```

### 3. Checkout Flow Testing

**Test Case 1: Tier 3 Deposit Checkout**
1. Add items to cart for Tier 3 tenant
2. Navigate to checkout
3. Verify OrderSummary shows:
   - "Commitment Checkout" banner
   - Deposit percentage (10%)
   - Deposit amount due now
   - Balance due at pickup
   - Pickup deadline (48 hours)
4. Complete payment
5. Verify order created with:
   - `checkout_mode = 'deposit'`
   - `deposit_cents` = 10% of total
   - `remaining_balance_cents` = 90% of total
   - `pickup_deadline` set to 48 hours from now
6. Verify payment created with:
   - `amount_cents` = deposit amount (not full total)
   - `is_deposit_payment = true`

**Test Case 2: Tier 4 Full Payment**
1. Add items to cart for Tier 4 tenant
2. Navigate to checkout
3. Verify OrderSummary shows:
   - Standard checkout (no deposit banner)
   - Full total due
4. Complete payment
5. Verify order created with:
   - `checkout_mode = 'full_payment'` or null
   - `deposit_cents = 0`

**Test Case 3: Deposit Forfeiture**
1. Create a paid deposit order with past pickup deadline
2. Call forfeiture processing endpoint:
   ```bash
   curl -X POST http://localhost:3001/api/deposit-forfeiture/process \
     -H "Authorization: Bearer <admin-token>"
   ```
3. Verify:
   - Order marked as cancelled
   - Payment marked as forfeited
   - Platform fee calculated (20% of deposit)
   - Retailer compensation calculated (80% of deposit)
   - Inventory released

### 4. API Endpoint Testing

**Get Pickup Deadline Status**:
```bash
curl http://localhost:3001/api/deposit-forfeiture/order/<order-id>/status
```

**Get Forfeiture Statistics**:
```bash
curl http://localhost:3001/api/deposit-forfeiture/tenant/<tenant-id>/stats \
  -H "Authorization: Bearer <token>"
```

### 5. Frontend Testing

1. Start development servers:
   ```bash
   cd apps/web && npm run dev
   cd apps/api && npm run dev
   ```

2. Test checkout flow with different tier tenants
3. Verify deposit UI displays correctly
4. Test payment processing with deposit amounts

## Configuration

### Tenant-Specific Deposit Percentage

Deposit percentages can be customized per tenant via `platform_fee_overrides`:

```sql
INSERT INTO platform_fee_overrides (id, tenant_id, fee_percentage, reason, is_active)
VALUES (
  gen_random_uuid()::text,
  'tenant-id',
  12.50, -- 12.5% deposit
  'Custom deposit percentage for high-value items',
  true
);
```

### Scheduled Forfeiture Processing

Set up a cron job to process forfeitures:

```bash
# Run every hour
0 * * * * curl -X POST https://api.visibleshelf.com/api/deposit-forfeiture/process -H "Authorization: Bearer <admin-api-key>"
```

## Monitoring & Analytics

### Key Metrics to Track

1. **Deposit Conversion Rate**
   - % of deposits that convert to full purchases
   - Average time to pickup

2. **Forfeiture Rate**
   - % of deposits forfeited
   - Revenue from forfeited deposits (platform + retailer)

3. **Inventory Impact**
   - Average reservation time
   - Stock release rate from forfeitures

### Dashboard Queries

```sql
-- Deposit conversion rate
SELECT 
  COUNT(CASE WHEN fulfilled_at IS NOT NULL THEN 1 END) as fulfilled,
  COUNT(CASE WHEN deposit_forfeited_at IS NOT NULL THEN 1 END) as forfeited,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(CASE WHEN fulfilled_at IS NOT NULL THEN 1 END) / COUNT(*), 2) as conversion_rate
FROM orders
WHERE checkout_mode = 'deposit' AND payment_status = 'paid';

-- Forfeiture revenue
SELECT 
  SUM(platform_forfeit_fee_cents) / 100.0 as platform_revenue,
  SUM(retailer_forfeit_amount_cents) / 100.0 as retailer_revenue
FROM payments
WHERE deposit_forfeited = true;
```

## Rollback Plan

If issues arise, rollback in this order:

1. Disable forfeiture cron job
2. Revert frontend changes (checkout page)
3. Revert API changes (checkout routes)
4. Run rollback migration:
   ```sql
   ALTER TABLE orders DROP COLUMN IF EXISTS checkout_mode;
   ALTER TABLE orders DROP COLUMN IF EXISTS deposit_percentage;
   ALTER TABLE orders DROP COLUMN IF EXISTS deposit_cents;
   ALTER TABLE orders DROP COLUMN IF EXISTS remaining_balance_cents;
   ALTER TABLE orders DROP COLUMN IF EXISTS deposit_forfeited_at;
   ALTER TABLE orders DROP COLUMN IF EXISTS pickup_deadline;
   
   ALTER TABLE payments DROP COLUMN IF EXISTS is_deposit_payment;
   ALTER TABLE payments DROP COLUMN IF EXISTS deposit_percentage;
   ALTER TABLE payments DROP COLUMN IF EXISTS deposit_forfeited;
   ALTER TABLE payments DROP COLUMN IF EXISTS forfeited_at;
   ALTER TABLE payments DROP COLUMN IF EXISTS platform_forfeit_fee_cents;
   ALTER TABLE payments DROP COLUMN IF EXISTS retailer_forfeit_amount_cents;
   ```

## Future Enhancements

1. **Variable Deposit Percentages** - Allow retailers to set custom percentages per product category
2. **Deposit Extensions** - Allow shoppers to extend pickup deadline (with fee)
3. **Partial Pickup** - Handle scenarios where shopper picks up subset of items
4. **Deposit Insurance** - Optional insurance for forfeited deposits
5. **Multi-location Pickup** - Allow pickup at any retailer location

## Support

For questions or issues:
- Check logs: `apps/api/logs/`
- Review audit trail: `audit_log` table
- Contact: platform-support@visibleshelf.com
