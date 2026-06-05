# Phase 3A Migration Instructions

## Overview
This migration creates the foundation for order management in the Visible Shelf platform. It adds 5 new tables and 5 enums following your existing database naming standards.

## Pre-Migration Checklist
- [ ] Backup your database
- [ ] Verify you have admin access to Supabase SQL Editor
- [ ] Confirm no active transactions on production

## Migration File
**File:** `001_phase3a_order_management_foundation.sql`

## What Gets Created

### Enums (5)
1. `order_status` - draft, confirmed, paid, processing, shipped, delivered, cancelled, refunded
2. `payment_status` - pending, authorized, paid, partially_refunded, refunded, failed, cancelled
3. `fulfillment_status` - unfulfilled, partially_fulfilled, fulfilled, cancelled
4. `payment_method` - credit_card, debit_card, paypal, apple_pay, google_pay, cash, check, bank_transfer, other
5. `shipment_status` - pending, label_created, picked_up, in_transit, out_for_delivery, delivered, failed_delivery, returned, cancelled

### Tables (5)
1. **orders** - Order headers with customer, pricing, addresses, status
2. **order_items** - Line items with product details and fulfillment tracking
3. **payments** - Payment records with gateway integration (optional)
4. **shipments** - Shipping records with carrier integration (optional)
5. **order_status_history** - Audit trail of status changes

### Indexes (21)
- Optimized for common queries (tenant_id, status, dates)
- Foreign key indexes for joins
- Unique constraints where needed

### Triggers (4)
- Auto-update `updated_at` timestamps on all main tables

## How to Run

### Option 1: Supabase SQL Editor (Recommended)
1. Open Supabase Dashboard → SQL Editor
2. Create new query
3. Copy entire contents of `001_phase3a_order_management_foundation.sql`
4. Click "Run" (or Cmd/Ctrl + Enter)
5. Verify success message: "✅ Phase 3A Migration Complete: All 5 tables created successfully"

### Option 2: psql Command Line
```bash
psql $DATABASE_URL -f apps/api/prisma/migrations/001_phase3a_order_management_foundation.sql
```

### Option 3: Direct Connection
```bash
psql -h <host> -U <user> -d <database> -f apps/api/prisma/migrations/001_phase3a_order_management_foundation.sql
```

## Verification

After running the migration, verify tables exist:

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('orders', 'order_items', 'payments', 'shipments', 'order_status_history')
ORDER BY table_name;

-- Should return 5 rows

-- Check enums
SELECT typname 
FROM pg_type 
WHERE typname IN ('order_status', 'payment_status', 'fulfillment_status', 'payment_method', 'shipment_status')
ORDER BY typname;

-- Should return 5 rows

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('orders', 'order_items', 'payments', 'shipments', 'order_status_history')
ORDER BY indexname;

-- Should return 21+ rows (including primary keys)
```

## Expected Results

**Success Output:**
```
NOTICE:  ✅ Phase 3A Migration Complete: All 5 tables created successfully
CREATE TYPE
CREATE TYPE
CREATE TYPE
CREATE TYPE
CREATE TYPE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
... (21 indexes)
CREATE TRIGGER
... (4 triggers)
```

## Foreign Key Dependencies

The migration references these existing tables:
- `tenants` (id) - Must exist
- `inventory_items` (id) - Must exist
- `users` (id) - Must exist

**These are already in your database**, so no issues expected.

## Rollback (If Needed)

If you need to rollback:

```sql
-- Drop tables (cascades will handle foreign keys)
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Drop enums
DROP TYPE IF EXISTS shipment_status;
DROP TYPE IF EXISTS payment_method;
DROP TYPE IF EXISTS fulfillment_status;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS order_status;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();
```

## Post-Migration Steps

After successful migration:

1. **Update Prisma Schema** - Add new models to `schema.prisma`
2. **Regenerate Prisma Client** - Run `npx prisma generate`
3. **Create API Routes** - Implement order endpoints
4. **Test Basic CRUD** - Verify database operations work

## Naming Standards Compliance

✅ **Tables:** snake_case_plural (orders, order_items, payments, shipments)
✅ **Columns:** snake_case (tenant_id, order_status, created_at)
✅ **Enums:** snake_case with snake_case values
✅ **Indexes:** idx_{table}_{columns} pattern
✅ **Foreign Keys:** fk_{table}_{column} pattern
✅ **Timestamps:** created_at, updated_at (auto-managed)

## Database Size Impact

**Estimated Storage:**
- Empty tables: ~100 KB
- With indexes: ~200 KB
- Per 1,000 orders: ~2-5 MB (depending on line items)

**Performance:**
- All critical queries indexed
- Foreign keys for referential integrity
- Triggers for automatic timestamp updates

## Support

If you encounter issues:
1. Check error message carefully
2. Verify foreign key tables exist (Tenant, InventoryItem, users)
3. Ensure you have CREATE privileges
4. Check for naming conflicts with existing tables

## Next Steps After Migration

1. ✅ Run migration in SQL editor
2. ⏭️ Update Prisma schema (I'll provide this next)
3. ⏭️ Create order API routes
4. ⏭️ Implement order creation logic
5. ⏭️ Test with sample data

---

**Ready to proceed?** Run the migration file in your SQL editor and let me know the result!
