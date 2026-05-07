# API Test Suite

## Inventory Lifecycle Tests

### Purpose
Validates the complete lifecycle of inventory items through all CRUD operations and status transitions. Critical for ensuring API functionality after schema migrations and case transformation updates.

### Running the Tests

```bash
# From the API directory
cd apps/api

# Run with Doppler (recommended - includes env vars)
doppler run -- npx tsx src/tests/inventory-lifecycle.test.ts

# Or run directly (requires local .env)
npx tsx src/tests/inventory-lifecycle.test.ts
```

### Configuration

Edit the test configuration at the top of `inventory-lifecycle.test.ts`:

```typescript
const TEST_TENANT_ID = 't-alh0vrz9'; // Your test tenant ID
const API_BASE_URL = 'http://localhost:3001'; // API endpoint
const TEST_USER_EMAIL = 'admin@rvp.com'; // Test user
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'admin123'; // Set in Doppler
```

**Important:** Set `TEST_USER_PASSWORD` in your Doppler config or environment variables. The test suite needs to authenticate to test DELETE, PATCH, and list endpoints.

### Test Coverage

The suite validates:

1. ✅ **Create Item** - POST /api/items with camelCase fields
2. ✅ **Read Item** - GET /api/items/:id
3. ✅ **Update Status (Inactive)** - PUT /api/items/:id with itemStatus
4. ✅ **Update Status (Active)** - PUT /api/items/:id with itemStatus
5. ✅ **Update Stock** - PUT /api/items/:id with stock (auto-syncs availability)
6. ✅ **Update Price** - PUT /api/items/:id with price (auto-syncs price_cents)
7. ✅ **Update Multiple Fields** - PUT /api/items/:id with multiple fields
8. ✅ **Soft Delete (Trash)** - DELETE /api/items/:id
9. ✅ **Restore from Trash** - PATCH /api/items/:id/restore
10. ✅ **Permanent Delete (Purge)** - DELETE /api/items/:id/purge
11. ✅ **List Items** - GET /api/tenants/:id/items
12. ✅ **Database Field Mapping** - Validates snake_case in database

### Critical Validations

**CamelCase → Snake_Case Mapping:**
- `tenantId` → `tenant_id`
- `itemStatus` → `item_status`
- `tenantCategoryId` → `directory_category_id`
- `priceCents` → `price_cents`

**Auto-Sync Behaviors:**
- Stock changes auto-update `availability` (in_stock/out_of_stock)
- Price changes auto-sync `price_cents`
- Updates add `updated_at` timestamp

**Status Transitions:**
- `active` → `inactive` → `active` (normal workflow)
- `active` → `trashed` → `active` (soft delete/restore)
- `trashed` → `[deleted]` (permanent purge)

### Expected Output

```
🧪 Inventory Item Lifecycle Test Suite

Testing against: http://localhost:3001
Test Tenant: t-alh0vrz9

✅ PASS: Create Item (POST /api/items) (245ms)
✅ PASS: Read Item (GET /api/items/:id) (12ms)
✅ PASS: Database Field Mapping (snake_case) (8ms)
✅ PASS: Update Status to Inactive (PUT /api/items/:id) (34ms)
✅ PASS: Update Status to Active (PUT /api/items/:id) (28ms)
✅ PASS: Update Stock (PUT /api/items/:id) (31ms)
✅ PASS: Update Price (PUT /api/items/:id) (29ms)
✅ PASS: Update Multiple Fields (PUT /api/items/:id) (35ms)
✅ PASS: Soft Delete to Trash (DELETE /api/items/:id) (42ms)
✅ PASS: Restore from Trash (PATCH /api/items/:id/restore) (38ms)
✅ PASS: Permanent Delete/Purge (DELETE /api/items/:id/purge) (45ms)
✅ PASS: List Items (GET /api/tenants/:id/items) (156ms)

============================================================
📊 Test Summary
============================================================
Total Tests: 12
✅ Passed: 12
❌ Failed: 0
⏱️  Total Time: 703ms
Success Rate: 100.0%
============================================================
```

### Troubleshooting

**Test Failures After Migration:**
1. Check Prisma schema field mappings (`@map` directives)
2. Verify API endpoints accept both camelCase and snake_case
3. Confirm transform logic in POST/PUT handlers
4. Validate database column names match schema

**Common Issues:**
- `tenant_id is undefined` → Check `tenantId` → `tenant_id` mapping in schema transform
- `Unknown argument` → Field name mismatch between API and Prisma schema
- `Foreign key constraint` → tenant_id not being set correctly
- `Argument is missing` → Undefined value being passed to Prisma (check validation)

### Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Inventory Lifecycle Tests
  run: |
    cd apps/api
    doppler run -- npx tsx src/tests/inventory-lifecycle.test.ts
```

### Related Tests

- `location-lifecycle.test.ts` - Tenant/location lifecycle tests
- `test-chain-propagation.ts` - Multi-location propagation tests
- `test-clover-integration.ts` - Clover POS integration tests
- `test-square-integration.ts` - Square POS integration tests

### Maintenance

Run this test suite:
- ✅ After schema migrations
- ✅ After API endpoint changes
- ✅ After case transformation updates
- ✅ Before production deployments
- ✅ When debugging item creation/update issues

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

Use in scripts:
```bash
if doppler run -- npx tsx src/tests/inventory-lifecycle.test.ts; then
  echo "✅ All tests passed - safe to deploy"
else
  echo "❌ Tests failed - do not deploy"
  exit 1
fi
```
