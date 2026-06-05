# Test Order Creation - Phase 3A

## Quick Test Guide

### Prerequisites
1. ✅ Database migration completed
2. ✅ Prisma schema updated and generated
3. ✅ API server running
4. ✅ Valid authentication token

### Test 1: Create a Simple Order

**Endpoint:** `POST /api/orders`

**Request:**
```json
{
  "tenant_id": "tid-m8ijkrnk",
  "customer": {
    "email": "test@example.com",
    "name": "Test Customer",
    "phone": "+1234567890"
  },
  "items": [
    {
      "sku": "TEST-001",
      "name": "Test Product",
      "description": "A test product",
      "quantity": 2,
      "unit_price_cents": 1999
    }
  ],
  "shipping_address": {
    "line1": "123 Test St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "shipping_cents": 500,
  "notes": "Test order",
  "source": "web"
}
```

**Expected Response:**
- Status: 201 Created
- Order number: `ORD-2024-000001` (or next sequential)
- Order status: `draft`
- Payment status: `pending`
- Total: 4498 cents ($44.98)

### Test 2: List Orders

**Endpoint:** `GET /api/orders?tenant_id=tid-m8ijkrnk`

**Expected Response:**
- Status: 200 OK
- Array of orders
- Pagination info

### Test 3: Get Order Details

**Endpoint:** `GET /api/orders/{order_id}`

**Expected Response:**
- Status: 200 OK
- Complete order with items, payments, shipments, history

### Test 4: Update Order Status

**Endpoint:** `PATCH /api/orders/{order_id}`

**Request:**
```json
{
  "order_status": "confirmed",
  "reason": "Customer confirmed order"
}
```

**Expected Response:**
- Status: 200 OK
- Order status updated to `confirmed`
- `confirmed_at` timestamp set
- New entry in `order_status_history`

---

## Testing with Postman/Insomnia

1. **Set Authorization Header:**
   ```
   Authorization: Bearer YOUR_JWT_TOKEN
   ```

2. **Create Order:**
   - Method: POST
   - URL: `http://localhost:3001/api/orders`
   - Body: Use JSON from Test 1 above
   - Replace `tenant_id` with your actual tenant ID

3. **Verify Database:**
   ```sql
   -- Check order was created
   SELECT * FROM orders WHERE tenant_id = 'tid-m8ijkrnk' ORDER BY created_at DESC LIMIT 1;
   
   -- Check order items
   SELECT * FROM order_items WHERE order_id = 'YOUR_ORDER_ID';
   
   -- Check status history
   SELECT * FROM order_status_history WHERE order_id = 'YOUR_ORDER_ID';
   ```

---

## Common Issues & Solutions

### Issue: "tenant_id_required"
**Solution:** Make sure `tenant_id` is included in request body

### Issue: "customer_email_required"
**Solution:** Include `customer.email` in request body

### Issue: "items_required"
**Solution:** Include at least one item in `items` array

### Issue: "tenant_not_found"
**Solution:** Use a valid tenant ID from your database

### Issue: Prisma error about missing table
**Solution:** Make sure you ran the database migration

### Issue: TypeScript errors about order types
**Solution:** Run `npx prisma generate` to regenerate Prisma client

---

## Verification Checklist

After creating an order, verify:

- ✅ Order record created in `orders` table
- ✅ Order items created in `order_items` table
- ✅ Status history entry created in `order_status_history` table
- ✅ Order number is unique and sequential
- ✅ Totals calculated correctly
- ✅ Timestamps set automatically
- ✅ Customer info denormalized correctly
- ✅ Address info stored properly

---

## Next Steps

Once basic order creation works:

1. Test with inventory items (include `inventory_item_id`)
2. Test order listing with filters
3. Test order status updates
4. Test with different order statuses
5. Test pagination
6. Test error cases (missing fields, invalid data)

---

## Sample Test Data

### Tenant ID (from your database)
```
tid-m8ijkrnk
```

### Sample Inventory Item IDs
Query your database:
```sql
SELECT id, sku, name, price_cents 
FROM inventory_items 
WHERE tenant_id = 'tid-m8ijkrnk' 
LIMIT 5;
```

Use these IDs in your test orders to link to actual inventory.

---

## Success Criteria

✅ Can create orders via API
✅ Order numbers generate sequentially
✅ Totals calculate correctly
✅ Status history tracks changes
✅ Can list and filter orders
✅ Can update order status
✅ All timestamps work automatically
✅ Foreign keys maintain referential integrity

---

**Phase 3A Complete when all tests pass!**
