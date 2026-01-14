# Platform Transaction Fee System Design

## Overview

Enable the platform to charge transaction fees on top of payment gateway fees, with flexible fee structures and incentive programs.

## Business Models Supported

### 1. Percentage-Based Fee
- Platform charges X% of transaction amount
- Example: 1.5% platform fee + 2.9% Stripe fee = 4.4% total

### 2. Fixed Fee Per Transaction
- Platform charges fixed amount per transaction
- Example: $0.50 platform fee + Stripe fees

### 3. Tiered Fee Structure
- Different fees based on subscription tier
- Example:
  - Trial: 3% platform fee
  - Starter: 2% platform fee
  - Professional: 1% platform fee
  - Enterprise: 0.5% platform fee
  - Organization: 0% platform fee (waived)

### 4. Hybrid Model
- Combination of percentage + fixed fee
- Example: 1% + $0.25 per transaction

### 5. Incentive Programs
- Waive fees for specific conditions:
  - High volume merchants (>$10k/month)
  - Annual subscription commitment
  - Referral program participants
  - Beta testers
  - Strategic partners

## Database Schema Updates

### Add to `tenants` table:
```sql
ALTER TABLE tenants ADD COLUMN platform_fee_percentage DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE tenants ADD COLUMN platform_fee_fixed_cents INTEGER DEFAULT 0;
ALTER TABLE tenants ADD COLUMN platform_fee_waived BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN platform_fee_waived_reason TEXT;
ALTER TABLE tenants ADD COLUMN platform_fee_waived_until TIMESTAMP;
```

### Add to `payments` table:
```sql
ALTER TABLE payments ADD COLUMN platform_fee_cents INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN platform_fee_percentage DECIMAL(5,2);
ALTER TABLE payments ADD COLUMN total_fees_cents INTEGER DEFAULT 0; -- gateway + platform
```

### New table: `platform_fee_tiers`
```sql
CREATE TABLE platform_fee_tiers (
  id TEXT PRIMARY KEY,
  tier_name TEXT NOT NULL,
  fee_percentage DECIMAL(5,2) DEFAULT 0.00,
  fee_fixed_cents INTEGER DEFAULT 0,
  min_transaction_cents INTEGER,
  max_transaction_cents INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New table: `platform_fee_overrides`
```sql
CREATE TABLE platform_fee_overrides (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fee_percentage DECIMAL(5,2),
  fee_fixed_cents INTEGER,
  reason TEXT,
  approved_by TEXT,
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Fee Calculation Logic

### Priority Order:
1. **Active Override** - Tenant-specific override (highest priority)
2. **Fee Waiver** - Tenant has fees waived
3. **Subscription Tier** - Default tier-based fees
4. **Platform Default** - Fallback platform fee

### Calculation Example:
```typescript
// Transaction: $100.00 (10,000 cents)
// Gateway fee: 2.9% + $0.30 = $3.20 (320 cents)
// Platform fee: 1.5% = $1.50 (150 cents)
// Total fees: $4.70 (470 cents)
// Net to merchant: $95.30 (9,530 cents)

const transactionAmount = 10000; // cents
const gatewayFeeCents = Math.round(transactionAmount * 0.029 + 30); // 320
const platformFeeCents = Math.round(transactionAmount * 0.015); // 150
const totalFeesCents = gatewayFeeCents + platformFeeCents; // 470
const netToMerchant = transactionAmount - totalFeesCents; // 9,530
```

## Implementation

### Enhanced Payment Result Interface:
```typescript
export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  authorizationId?: string;
  amount: number;
  currency: string;
  status: 'authorized' | 'captured' | 'failed' | 'pending';
  
  // Fee breakdown
  gatewayFeeCents: number;
  platformFeeCents: number;
  totalFeesCents: number;
  netAmountCents: number;
  
  // Fee details
  platformFeePercentage?: number;
  platformFeeFixedCents?: number;
  feeWaived: boolean;
  feeWaivedReason?: string;
  
  gatewayResponse: Record<string, any>;
  error?: string;
}
```

### Fee Calculator Service:
```typescript
export class PlatformFeeCalculator {
  static async calculateFees(
    tenantId: string,
    transactionAmountCents: number,
    gatewayFeeCents: number
  ): Promise<{
    platformFeeCents: number;
    platformFeePercentage: number;
    platformFeeFixedCents: number;
    totalFeesCents: number;
    netAmountCents: number;
    feeWaived: boolean;
    feeWaivedReason?: string;
  }> {
    // 1. Check for active override
    const override = await this.getActiveOverride(tenantId);
    if (override) {
      return this.applyFeeStructure(
        transactionAmountCents,
        gatewayFeeCents,
        override.fee_percentage,
        override.fee_fixed_cents,
        false,
        `Override: ${override.reason}`
      );
    }
    
    // 2. Check if fees are waived
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        platform_fee_waived: true,
        platform_fee_waived_reason: true,
        platform_fee_waived_until: true,
        subscription_tier: true,
      },
    });
    
    if (tenant?.platform_fee_waived) {
      const waivedUntil = tenant.platform_fee_waived_until;
      if (!waivedUntil || new Date() < waivedUntil) {
        return this.applyFeeStructure(
          transactionAmountCents,
          gatewayFeeCents,
          0,
          0,
          true,
          tenant.platform_fee_waived_reason
        );
      }
    }
    
    // 3. Get tier-based fees
    const tierFees = this.getTierFees(tenant?.subscription_tier);
    return this.applyFeeStructure(
      transactionAmountCents,
      gatewayFeeCents,
      tierFees.percentage,
      tierFees.fixedCents,
      false
    );
  }
  
  private static getTierFees(tier?: string): {
    percentage: number;
    fixedCents: number;
  } {
    const tierFees: Record<string, { percentage: number; fixedCents: number }> = {
      'trial': { percentage: 3.0, fixedCents: 0 },
      'google-only': { percentage: 2.5, fixedCents: 0 },
      'starter': { percentage: 2.0, fixedCents: 0 },
      'professional': { percentage: 1.5, fixedCents: 0 },
      'enterprise': { percentage: 1.0, fixedCents: 0 },
      'organization': { percentage: 0.0, fixedCents: 0 }, // Waived
    };
    
    return tierFees[tier || 'trial'] || { percentage: 2.0, fixedCents: 0 };
  }
}
```

## Incentive Programs

### 1. Volume-Based Waivers
```typescript
// Waive fees for merchants processing >$10k/month
if (monthlyVolume > 1000000) { // cents
  await prisma.tenants.update({
    where: { id: tenantId },
    data: {
      platform_fee_waived: true,
      platform_fee_waived_reason: 'High volume merchant (>$10k/month)',
    },
  });
}
```

### 2. Annual Commitment Discount
```typescript
// 50% fee reduction for annual subscription
if (subscriptionType === 'annual') {
  const tierFees = getTierFees(tier);
  const discountedFees = {
    percentage: tierFees.percentage * 0.5,
    fixedCents: tierFees.fixedCents * 0.5,
  };
}
```

### 3. Referral Program
```typescript
// Waive fees for 3 months for successful referrals
await prisma.tenants.update({
  where: { id: tenantId },
  data: {
    platform_fee_waived: true,
    platform_fee_waived_reason: 'Referral program - 3 months free',
    platform_fee_waived_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  },
});
```

### 4. Beta Tester Program
```typescript
// Permanent fee waiver for early adopters
await prisma.tenants.update({
  where: { id: tenantId },
  data: {
    platform_fee_waived: true,
    platform_fee_waived_reason: 'Beta tester - lifetime waiver',
    platform_fee_waived_until: null, // No expiration
  },
});
```

## Revenue Tracking

### Platform Revenue Dashboard:
```sql
-- Total platform revenue
SELECT 
  SUM(platform_fee_cents) / 100.0 as total_platform_revenue,
  COUNT(*) as total_transactions,
  AVG(platform_fee_cents) / 100.0 as avg_platform_fee
FROM payments
WHERE payment_status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days';

-- Revenue by tier
SELECT 
  t.subscription_tier,
  SUM(p.platform_fee_cents) / 100.0 as revenue,
  COUNT(*) as transactions,
  AVG(p.platform_fee_cents) / 100.0 as avg_fee
FROM payments p
JOIN orders o ON p.order_id = o.id
JOIN tenants t ON o.tenant_id = t.id
WHERE p.payment_status = 'completed'
  AND p.created_at >= NOW() - INTERVAL '30 days'
GROUP BY t.subscription_tier;

-- Waived fees (opportunity cost)
SELECT 
  COUNT(*) as waived_transactions,
  SUM(amount_cents * 0.015) / 100.0 as potential_revenue
FROM payments
WHERE payment_status = 'completed'
  AND platform_fee_cents = 0
  AND created_at >= NOW() - INTERVAL '30 days';
```

## API Endpoints

### Admin Endpoints:
```
POST   /api/admin/platform-fees/tiers
GET    /api/admin/platform-fees/tiers
PUT    /api/admin/platform-fees/tiers/:id

POST   /api/admin/tenants/:id/fee-override
GET    /api/admin/tenants/:id/fee-override
DELETE /api/admin/tenants/:id/fee-override

POST   /api/admin/tenants/:id/waive-fees
DELETE /api/admin/tenants/:id/waive-fees

GET    /api/admin/revenue/dashboard
GET    /api/admin/revenue/by-tier
GET    /api/admin/revenue/waived-fees
```

### Tenant Endpoints:
```
GET    /api/tenants/:id/fee-structure
GET    /api/tenants/:id/fee-history
```

## Transparency & Compliance

### Fee Disclosure:
- Show fee breakdown on checkout
- Display in payment receipts
- Include in monthly statements
- Provide fee calculator tool

### Example Receipt:
```
Subtotal:           $100.00
Platform Fee (1.5%): $1.50
Payment Processing:  $3.20
─────────────────────────
Total:              $104.70
Net to Merchant:     $95.30
```

## Migration Strategy

### Phase 1: Add Schema
1. Run migration to add fee columns
2. Set default fees based on tiers
3. Backfill existing payments (set platform_fee_cents = 0)

### Phase 2: Update Payment Flow
1. Calculate platform fees on all new transactions
2. Store fee breakdown in payments table
3. Update payment result objects

### Phase 3: Enable Incentives
1. Implement waiver logic
2. Create override system
3. Add admin controls

### Phase 4: Revenue Tracking
1. Build revenue dashboard
2. Add reporting endpoints
3. Create analytics views

## Competitive Analysis

### Stripe Connect: 0.25% + $0.25 per transaction
### Square: 2.6% + $0.10 per transaction
### PayPal: 2.9% + $0.30 per transaction
### Shopify: 2.0% for basic plan (waived with Shopify Payments)

### Our Positioning:
- **Transparent:** Clear fee breakdown
- **Flexible:** Tier-based with incentives
- **Competitive:** 0-3% based on tier
- **Fair:** Waivers for high-volume and loyal customers

## Benefits

### For Platform:
- ✅ Predictable revenue stream
- ✅ Scales with transaction volume
- ✅ Incentivizes upgrades to higher tiers
- ✅ Flexibility to reward loyalty

### For Merchants:
- ✅ Clear, transparent pricing
- ✅ Lower fees with higher tiers
- ✅ Opportunity to earn waivers
- ✅ Competitive with other platforms

---

**Status:** Design Complete - Ready for Implementation  
**Next:** Database migration + Fee calculator service
