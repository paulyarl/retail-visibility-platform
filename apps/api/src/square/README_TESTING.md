# Square Integration Testing Guide

## Quick Start

Run the comprehensive test suite:

```bash
cd apps/api
doppler run -- tsx src/square/test-square-integration.ts
```

---

## Test Suite Overview

The test script validates all Phase 2 functionality:

### ✅ Test 1: Environment Variables
- Checks all required Square environment variables are set
- Validates configuration completeness

### ✅ Test 2: OAuth Service
- Creates OAuth service instance
- Generates authorization URL
- Tests state parameter parsing
- Validates CSRF protection

### ✅ Test 3: Square Client
- Creates Square API client
- Tests connection to Square API
- Lists merchant locations
- Validates API access

### ✅ Test 4: Database Operations
- Creates test integration record
- Retrieves integration by tenant ID
- Updates integration data
- Creates product mapping
- Creates sync log
- Retrieves sync logs
- Cleans up test data

### ✅ Test 5: Integration Service
- Tests integration status check
- Tests connection validation
- Validates service orchestration

### ✅ Test 6: OAuth Flow (Optional)
- Tests complete OAuth token exchange
- Requires manual authorization code
- Tests disconnect functionality

---

## Running Tests

### Basic Test Run

```bash
cd apps/api
doppler run -- tsx src/square/test-square-integration.ts
```

### With Custom Tenant ID

```bash
cd apps/api
TEST_TENANT_ID=your-tenant-id doppler run -- tsx src/square/test-square-integration.ts
```

### With OAuth Flow Test

1. Run the test script first to get the authorization URL:
```bash
doppler run -- tsx src/square/test-square-integration.ts
```

2. Copy the authorization URL from Test 2 output

3. Visit the URL in your browser and authorize

4. Copy the `code` parameter from the redirect URL

5. Run again with the code:
```bash
TEST_AUTH_CODE=your-auth-code doppler run -- tsx src/square/test-square-integration.ts
```

---

## Expected Output

```
============================================================
  SQUARE INTEGRATION TEST SUITE
============================================================

============================================================
  Test 1: Environment Variables
============================================================
✅ SQUARE_APPLICATION_ID is set
✅ SQUARE_ACCESS_TOKEN is set
✅ SQUARE_CLIENT_SECRET is set
✅ SQUARE_ENVIRONMENT is set
✅ SQUARE_OAUTH_REDIRECT_URI is set

============================================================
  Test 2: OAuth Service
============================================================
✅ OAuth service created successfully
✅ Authorization URL generated correctly
ℹ️  URL: https://connect.squareupsandbox.com/oauth2/authorize?client_id=...
✅ State parsing works correctly

============================================================
  Test 3: Square Client
============================================================
✅ Square client created successfully
✅ Square API connection successful
✅ Found 1 location(s)
ℹ️  First location: Default Test Account (L123ABC)

============================================================
  Test 4: Database Operations
============================================================
ℹ️  Creating test integration...
✅ Integration created successfully
ℹ️  Retrieving integration...
✅ Integration retrieved successfully
ℹ️  Updating integration...
✅ Integration updated successfully
ℹ️  Creating product mapping...
✅ Product mapping created successfully
ℹ️  Creating sync log...
✅ Sync log created successfully
ℹ️  Retrieving sync logs...
✅ Retrieved 1 sync log(s)
ℹ️  Cleaning up test data...
✅ Test data cleaned up

============================================================
  Test 5: Integration Service
============================================================
ℹ️  Testing integration status...
✅ Integration status check works (no integration found as expected)

============================================================
  Test 6: OAuth Flow (Optional)
============================================================
ℹ️  Skipping OAuth flow test (no TEST_AUTH_CODE provided)
ℹ️  To test OAuth flow:
ℹ️  1. Visit the authorization URL from Test 2
ℹ️  2. Authorize in Square sandbox
ℹ️  3. Copy the "code" parameter from the redirect URL
ℹ️  4. Set TEST_AUTH_CODE environment variable
ℹ️  5. Run this script again

============================================================
  Test Summary
============================================================
ℹ️  Total Tests: 6
✅ Passed: 6
❌ Failed: 0
ℹ️  Success Rate: 100.0%

🎉 All tests passed! Square integration is ready!
```

---

## Troubleshooting

### Test 1 Fails: Missing Environment Variables

**Problem:** One or more Square environment variables are not set

**Solution:**
1. Check your Doppler configuration:
```bash
doppler secrets | grep SQUARE
```

2. Ensure all required variables are set:
   - `SQUARE_APPLICATION_ID`
   - `SQUARE_ACCESS_TOKEN`
   - `SQUARE_CLIENT_SECRET`
   - `SQUARE_ENVIRONMENT`
   - `SQUARE_OAUTH_REDIRECT_URI`

### Test 3 Fails: Square API Connection

**Problem:** Cannot connect to Square API

**Solution:**
1. Verify your `SQUARE_ACCESS_TOKEN` is valid
2. Check if you're using the correct environment (sandbox vs production)
3. Ensure your Square application has the required permissions

### Test 4 Fails: Database Operations

**Problem:** Database operations fail

**Solution:**
1. Ensure the database migration has been run:
```bash
cd apps/api
doppler run -- npx prisma migrate deploy
```

2. Check database connection:
```bash
doppler secrets | grep DATABASE_URL
```

### Test 6: OAuth Flow

**Problem:** OAuth flow test is skipped

**Solution:** This is expected if you haven't provided `TEST_AUTH_CODE`. Follow the instructions in the test output to complete the OAuth flow manually.

---

## Manual Testing

### Test OAuth Flow End-to-End

1. Start your servers:
```bash
pnpm dev:local
```

2. Navigate to:
```
http://localhost:3000/t/{tenantId}/settings/integrations
```

3. Click "Connect Square"

4. Authorize in Square sandbox

5. Verify redirect back to platform

6. Check database for saved tokens:
```bash
doppler run -- npx prisma studio
```

### Test API Endpoints

```bash
# Get integration status
curl http://localhost:4000/square/integrations/{tenantId}

# Get sync logs
curl http://localhost:4000/square/integrations/{tenantId}/logs

# Disconnect integration
curl -X POST http://localhost:4000/square/integrations/{tenantId}/disconnect
```

---

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Test Square Integration
  run: |
    cd apps/api
    doppler run -- tsx src/square/test-square-integration.ts
  env:
    TEST_TENANT_ID: ci-test-tenant
```

---

## Test Coverage

**Phase 2 Coverage: 100%**

- ✅ Environment configuration
- ✅ OAuth service
- ✅ Square API client
- ✅ Database operations
- ✅ Integration service
- ✅ OAuth flow (manual)

**Not Yet Covered (Phase 3):**
- ⏸️ Product sync
- ⏸️ Inventory sync
- ⏸️ Webhook handlers
- ⏸️ Batch operations

---

## Next Steps

After all tests pass:

1. ✅ Test OAuth flow manually in browser
2. ✅ Verify tokens are saved to database
3. ✅ Test disconnect functionality
4. ✅ Proceed to Phase 3 (Sync Service)

---

**Questions or Issues?**

Check the main documentation:
- `SQUARE_PHASE1_COMPLETE.md`
- `SQUARE_PHASE2_COMPLETE.md`
