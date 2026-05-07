# Phase 3A Prisma Schema Integration Instructions

## Overview
Now that the database tables are created, you need to add the Prisma models to your `schema.prisma` file so you can use them in your API code.

## Steps to Integrate

### 1. Open Your Schema File
Open: `apps/api/prisma/schema.prisma`

### 2. Add the New Content
Copy the content from `PHASE3A_SCHEMA_ADDITIONS.prisma` and add it **at the end** of your existing `schema.prisma` file (after line 1797).

**Important Notes:**
- Add the 5 enums first
- Then add the 5 main models (orders, order_items, payments, shipments, order_status_history)
- Skip the placeholder models (customers, refunds) for now - we'll add those in later phases

### 3. Update Existing Model Relations

You need to add the reverse relations to your existing models:

#### A. Update `tenants` model
Find the `tenants` model and add these relations at the end:

```prisma
model tenants {
  // ... existing fields ...
  
  // Add these new relations:
  orders                orders[]
  payments              payments[]
  shipments             shipments[]
  
  // ... rest of existing relations ...
}
```

#### B. Update `inventory_items` model
Find the `inventory_items` model and add this relation:

```prisma
model inventory_items {
  // ... existing fields ...
  
  // Add this new relation:
  order_items           order_items[]
  
  // ... rest of existing relations ...
}
```

#### C. Update `users` model
Find the `users` model and add this relation:

```prisma
model users {
  // ... existing fields ...
  
  // Add this new relation:
  order_status_history  order_status_history[]
  
  // ... rest of existing relations ...
}
```

### 4. Generate Prisma Client

After updating the schema, regenerate the Prisma client:

```bash
cd apps/api
npx prisma generate
```

**Expected Output:**
```
✔ Generated Prisma Client (v5.x.x) to ./node_modules/@prisma/client in XXXms

Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
```

### 5. Verify the Schema

Run Prisma's validation:

```bash
npx prisma validate
```

**Expected Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

The schema is valid ✓
```

### 6. Format the Schema (Optional)

Clean up formatting:

```bash
npx prisma format
```

## What You Get

After integration, you'll be able to use these in your API:

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Create an order
const order = await prisma.orders.create({
  data: {
    id: 'order_123',
    tenant_id: 'tenant_abc',
    order_number: 'ORD-2024-00001',
    customer_email: 'customer@example.com',
    order_status: 'draft',
    payment_status: 'pending',
    fulfillment_status: 'unfulfilled',
    subtotal_cents: 1000,
    total_cents: 1000,
    currency: 'USD'
  }
});

// Query orders
const orders = await prisma.orders.findMany({
  where: {
    tenant_id: 'tenant_abc',
    order_status: 'paid'
  },
  include: {
    order_items: true,
    payments: true,
    shipments: true
  }
});
```

## Troubleshooting

### Issue: "Unknown type" errors
**Solution:** Make sure you added the enums before the models

### Issue: "Relation field missing"
**Solution:** Make sure you updated the reverse relations in tenants, inventory_items, and users models

### Issue: "Cannot find module '@prisma/client'"
**Solution:** Run `npx prisma generate` to regenerate the client

### Issue: Schema validation fails
**Solution:** Check that all referenced models exist (tenants, inventory_items, users)

## Next Steps

After successful integration:
1. ✅ Schema updated
2. ✅ Prisma client generated
3. ⏭️ Create order API routes
4. ⏭️ Implement order creation logic
5. ⏭️ Test with sample data

## Quick Reference

**New Models:**
- `orders` - Order headers
- `order_items` - Line items
- `payments` - Payment records
- `shipments` - Shipping records
- `order_status_history` - Audit trail

**New Enums:**
- `order_status` - Order lifecycle states
- `payment_status` - Payment states
- `fulfillment_status` - Fulfillment states
- `payment_method` - Payment types
- `shipment_status` - Shipping states

**Relations Added:**
- `tenants` → `orders`, `payments`, `shipments`
- `inventory_items` → `order_items`
- `users` → `order_status_history`

---

**Ready to proceed?** Update your schema.prisma file and run `npx prisma generate`!
