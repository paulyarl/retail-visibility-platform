# Test Suite Setup Guide

## Quick Setup

### 1. Add Test Password to Doppler

```bash
# Add TEST_USER_PASSWORD to your Doppler config
doppler secrets set TEST_USER_PASSWORD="your_admin_password"
```

Or via Doppler Dashboard:
1. Go to https://dashboard.doppler.com
2. Select project: `retail-visibility-platform`
3. Select config: `local` (or your environment)
4. Add secret: `TEST_USER_PASSWORD` = `your_admin_password`

### 2. Verify Configuration

```bash
# Check if the secret is set
doppler secrets get TEST_USER_PASSWORD
```

### 3. Run Tests

```bash
cd apps/api
doppler run -- npx tsx src/tests/inventory-lifecycle.test.ts
```

## Expected Output (All Tests Passing)

```
🧪 Inventory Item Lifecycle Test Suite

Testing against: http://localhost:4000
Test Tenant: t-alh0vrz9

🔐 Authenticating...
✅ Authentication successful

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

## Troubleshooting

### Authentication Fails

**Problem:** `❌ Authentication failed: {"error":"invalid_credentials"}`

**Solutions:**
1. Verify password is correct in Doppler
2. Check TEST_USER_EMAIL matches your admin user
3. Verify user exists in database:
   ```sql
   SELECT email, role FROM users WHERE email = 'admin@rvp.com';
   ```

### Some Tests Still Fail with 401

**Problem:** Tests fail with "No token provided" even after authentication

**Cause:** Authentication succeeded but token wasn't returned in expected format

**Solution:** Check the auth endpoint response format:
- Should return `{ token: "..." }` or `{ accessToken: "..." }`
- Update line 73 in test file if format is different

### Wrong API URL

**Problem:** Tests connect to wrong API endpoint

**Solutions:**
1. Check `API_BASE_URL` in Doppler:
   ```bash
   doppler secrets get API_BASE_URL
   ```
2. Override in test file if needed:
   ```typescript
   const API_BASE_URL = 'http://localhost:4000'; // Your local API
   ```

### Test Tenant Not Found

**Problem:** `tenant_not_found` or foreign key errors

**Solution:** Update TEST_TENANT_ID to a valid tenant:
```typescript
const TEST_TENANT_ID = 't-your-tenant-id';
```

Find valid tenant IDs:
```sql
SELECT id, name FROM tenants LIMIT 5;
```

## Environment-Specific Configs

### Local Development
```bash
doppler setup --project retail-visibility-platform --config local
doppler secrets set TEST_USER_PASSWORD="admin123"
doppler secrets set API_BASE_URL="http://localhost:4000"
```

### Staging
```bash
doppler setup --project retail-visibility-platform --config staging
doppler secrets set TEST_USER_PASSWORD="staging_password"
doppler secrets set API_BASE_URL="https://aps.visibleshelf.store"
```

### Production (Use with Caution!)
```bash
doppler setup --project retail-visibility-platform --config production
doppler secrets set TEST_USER_PASSWORD="production_password"
doppler secrets set API_BASE_URL="https://api.visibleshelf.com"
```

**⚠️ Warning:** Running tests against production will create/delete real items. Use a dedicated test tenant.

## CI/CD Integration

### GitHub Actions

```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install Doppler CLI
        uses: dopplerhq/cli-action@v3
      
      - name: Run Tests
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN }}
        run: |
          cd apps/api
          doppler run -- npx tsx src/tests/inventory-lifecycle.test.ts
```

### Pre-deployment Check

Add to your deployment script:

```bash
#!/bin/bash
set -e

echo "Running inventory lifecycle tests..."
cd apps/api
if doppler run -- npx tsx src/tests/inventory-lifecycle.test.ts; then
  echo "✅ All tests passed - proceeding with deployment"
else
  echo "❌ Tests failed - aborting deployment"
  exit 1
fi

# Continue with deployment...
```

## Security Notes

- Never commit `TEST_USER_PASSWORD` to git
- Use Doppler or environment variables only
- Rotate test passwords regularly
- Use dedicated test accounts (not production admin accounts)
- Consider creating a `PLATFORM_SUPPORT` user for testing
