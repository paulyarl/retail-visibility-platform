# Migration 003 - Enum Value Fix

## Issue
The migration was using incorrect `payment_status` enum values that don't exist in the schema.

## Root Cause
The migration used `'completed'` and `'captured'` values, but the actual `payment_status` enum only has:
- `pending`
- `authorized`
- `paid`
- `partially_refunded`
- `refunded`
- `failed`
- `cancelled`

## Fixes Applied

### 1. Migration SQL (003_phase3b_platform_transaction_fees.sql)
**Changed:**
- `WHERE payment_status IN ('completed', 'captured')` → `WHERE payment_status = 'paid'`

**Locations:**
- Line 132: `platform_revenue_summary` view
- Line 150: `platform_revenue_by_tier` view

### 2. PlatformFeeCalculator.ts
**Changed:**
- `WHERE payment_status IN ('completed', 'captured')` → `WHERE payment_status = 'paid'`

**Locations:**
- Line 245: `getRevenueSummary()` method
- Line 279: `getRevenueByTier()` method
- Line 303: `getWaivedFeeOpportunityCost()` method

## Migration Ready
The migration should now execute successfully. Run:
```bash
psql -h your-host -U your-user -d your-database -f 003_phase3b_platform_transaction_fees.sql
```

## Verification
After migration, verify with:
```sql
-- Check new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name LIKE 'platform_fee%';

-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('platform_fee_tiers', 'platform_fee_overrides');

-- Check default tiers inserted
SELECT tier_name, fee_percentage FROM platform_fee_tiers ORDER BY fee_percentage DESC;
```
