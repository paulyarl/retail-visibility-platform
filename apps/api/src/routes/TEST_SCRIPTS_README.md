# Order API Test Scripts

Three test scripts are provided to test the Phase 3A Order Management endpoints:

## Scripts Available

1. **test-orders.sh** - Bash script (Linux/Mac/Git Bash)
2. **test-orders.bat** - Windows Batch script
3. **test-orders.ps1** - PowerShell script (Recommended for Windows)

## Prerequisites

1. API server running on `http://localhost:3001`
2. Valid JWT authentication token
3. Tenant ID: `tid-m8ijkrnk` (or update in script)

## How to Use

### Option 1: PowerShell (Recommended for Windows)

```powershell
# Set your JWT token
$env:JWT_TOKEN = "your-jwt-token-here"

# Run the script
.\test-orders.ps1
```

### Option 2: Bash (Linux/Mac/Git Bash)

```bash
# Set your JWT token
export JWT_TOKEN="your-jwt-token-here"

# Make script executable
chmod +x test-orders.sh

# Run the script
./test-orders.sh
```

### Option 3: Windows Batch

```cmd
# Set your JWT token
set JWT_TOKEN=your-jwt-token-here

# Run the script
test-orders.bat
```

## What the Scripts Test

### Test 1: Create Simple Order
- Creates an order with 1 item
- Tests basic order creation
- Returns order ID and order number

### Test 2: Get Order Details
- Retrieves complete order information
- Includes items, payments, shipments, history

### Test 3: Update Order Status
- Changes order status from `draft` to `confirmed`
- Creates status history entry

### Test 4: List All Orders
- Retrieves paginated list of orders
- Shows pagination info

### Test 5: List with Filters
- Filters orders by status
- Tests query parameter filtering

### Test 6: Create Multi-Item Order
- Creates order with 3 different items
- Tests totals calculation with multiple items

## Getting Your JWT Token

### Method 1: From Browser DevTools
1. Log into the platform at `http://localhost:3000`
2. Open DevTools (F12)
3. Go to Application → Local Storage
4. Find `next-auth.session-token` or similar
5. Copy the token value

### Method 2: From API Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

## Expected Results

**Successful Test Output:**
```
✓ Order created successfully
  Order ID: ord_1234567890_abc
  Order Number: ORD-2024-000001
✓ Order details retrieved
✓ Order status updated
✓ Orders list retrieved
  Total orders: 2
✓ Filtered orders retrieved
✓ Multi-item order created
  Total items: 3
  Total amount: $89.94
```

## Verify in Database

After running tests, check the database:

```sql
-- View created orders
SELECT id, order_number, order_status, total_cents, customer_email, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 5;

-- View order items
SELECT oi.id, oi.sku, oi.name, oi.quantity, oi.unit_price_cents, oi.total_cents
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
ORDER BY o.created_at DESC;

-- View status history
SELECT oh.*, o.order_number
FROM order_status_history oh
JOIN orders o ON oh.order_id = o.id
ORDER BY oh.created_at DESC;
```

## Troubleshooting

### Error: "JWT_TOKEN environment variable not set"
**Solution:** Set the JWT_TOKEN before running the script

### Error: "Connection refused"
**Solution:** Make sure API server is running on port 3001

### Error: "tenant_not_found"
**Solution:** Update TENANT_ID in the script to match your database

### Error: "Unauthorized"
**Solution:** Your JWT token may be expired, get a new one

## Manual Testing with cURL

If you prefer manual testing, here are individual curl commands:

### Create Order
```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tid-m8ijkrnk",
    "customer": {
      "email": "test@example.com",
      "name": "Test Customer"
    },
    "items": [{
      "sku": "TEST-001",
      "name": "Test Product",
      "quantity": 1,
      "unit_price_cents": 1999
    }]
  }'
```

### List Orders
```bash
curl -X GET "http://localhost:3001/api/orders?tenant_id=tid-m8ijkrnk" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Order Details
```bash
curl -X GET "http://localhost:3001/api/orders/ORDER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Order Status
```bash
curl -X PATCH "http://localhost:3001/api/orders/ORDER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_status": "confirmed",
    "reason": "Customer confirmed"
  }'
```

## Next Steps

After successful testing:
1. Review created orders in database
2. Test with real inventory items (include `inventory_item_id`)
3. Test error cases (missing fields, invalid data)
4. Deploy to staging environment
5. Move to Phase 3B (Payment Integration)

## Support

For issues or questions:
- Check API logs: `pnpm dev:local` output
- Review documentation: `ORDERS_API_DOCUMENTATION.md`
- Check implementation plan: `PAYMENT_ORDER_MANAGEMENT_PLAN.md`
