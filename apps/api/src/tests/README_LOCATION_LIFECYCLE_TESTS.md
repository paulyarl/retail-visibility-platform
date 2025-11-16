# Location Lifecycle E2E Tests

## Overview

Comprehensive end-to-end test suite for the location lifecycle management system. Tests all aspects of the system from status transitions to storefront visibility.

## Test Coverage

### 1. Status Transitions (6 tests)
- ✅ Get current tenant status
- ✅ Change from active to inactive
- ✅ Prevent invalid transitions
- ✅ Reopen from inactive to active
- ✅ Close with reason
- ✅ Require reason for closed status

### 2. Audit Logging (2 tests)
- ✅ Retrieve status change history
- ✅ Verify metadata in audit logs

### 3. Impact Preview (2 tests)
- ✅ Preview impact of status changes
- ✅ Detect invalid transitions

### 4. Query Filtering (3 tests)
- ✅ Exclude archived by default
- ✅ Include archived when requested
- ✅ Filter by status (admin only)

### 5. Storefront Visibility (3 tests)
- ✅ Allow access for active locations
- ✅ Show closed message for inactive
- ✅ Block access for archived

### 6. Business Logic (2 tests)
- ✅ Validate status transitions
- ✅ Calculate billing for statuses

### 7. Complete Lifecycle Flow (1 test)
- ✅ Full lifecycle: active → inactive → active → closed → archived
- ✅ Verify complete audit trail

**Total: 19 comprehensive tests**

## Prerequisites

### 1. Environment Setup

Create a `.env.test` file in `apps/api`:

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Test Credentials
TEST_AUTH_TOKEN=your_test_user_jwt_token
TEST_TENANT_ID=your_test_tenant_id
TEST_USER_ID=your_test_user_id
```

### 2. Test User Requirements

The test user must have:
- Valid authentication token
- Access to at least one tenant
- OWNER or ADMIN role on test tenant
- Ability to change location status

### 3. API Server

Ensure the API server is running:

```bash
cd apps/api
npm run dev
```

## Running Tests

### Run All Tests

```bash
cd apps/api
npm test -- location-lifecycle.test.ts
```

### Run Specific Test Suite

```bash
npm test -- location-lifecycle.test.ts -t "Status Transitions"
```

### Run in Watch Mode

```bash
npm test -- location-lifecycle.test.ts --watch
```

### Run with Coverage

```bash
npm test -- location-lifecycle.test.ts --coverage
```

## Getting Test Credentials

### 1. Get Auth Token

```bash
# Login via API
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Extract access_token from response
```

### 2. Get Tenant ID

```bash
# List tenants
curl -X GET http://localhost:4000/tenants \
  -H "Authorization: Bearer YOUR_TOKEN"

# Use ID from response
```

### 3. Get User ID

```bash
# Get user profile
curl -X GET http://localhost:4000/api/user/profile \
  -H "Authorization: Bearer YOUR_TOKEN"

# Use id from response
```

## Test Flow

The test suite follows this sequence:

```
Setup
  ↓
1. Status Transitions
  ↓
2. Audit Logging
  ↓
3. Impact Preview
  ↓
4. Query Filtering
  ↓
5. Storefront Visibility
  ↓
6. Business Logic
  ↓
7. Complete Lifecycle
  ↓
Cleanup (reset to active)
```

## Expected Output

```
🧪 Location Lifecycle Management - E2E Test Suite

Prerequisites:
  - API server running at http://localhost:4000
  - TEST_AUTH_TOKEN environment variable set
  - TEST_TENANT_ID environment variable set
  - TEST_USER_ID environment variable set

Setting up test environment...

1. Status Transitions
  ✓ Get current tenant status
  ✓ Change from active to inactive
  ✓ Prevent invalid transitions
  ✓ Reopen from inactive to active
  ✓ Close with reason
  ✓ Require reason for closed status

2. Audit Logging
  ✓ Retrieve status change history
  ✓ Verify metadata in audit logs

3. Impact Preview
  ✓ Preview impact of status changes
  ✓ Detect invalid transitions

4. Query Filtering
  ✓ Exclude archived by default
  ✓ Include archived when requested
  ✓ Filter by status (admin only)

5. Storefront Visibility
  ✓ Allow access for active locations
  ✓ Show closed message for inactive
  ✓ Block access for archived

6. Business Logic
  ✓ Validate status transitions
  ✓ Calculate billing for statuses

7. Complete Lifecycle Flow
  Starting complete lifecycle flow...
    1. ✓ Active
    2. ✓ Inactive (with reopening date)
    3. ✓ Active (reopened)
    4. ✓ Closed (permanent)
    5. ✓ Archived (final state)
    6. ✓ Audit trail: 5 entries
  ✓ Complete lifecycle flow successful!

Cleaning up: Resetting tenant to active status...

Test Suites: 1 passed, 1 total
Tests:       19 passed, 19 total
Time:        12.345s
```

## Troubleshooting

### Tests Skipped

If you see "Skipping tests..." it means environment variables are not set:

```bash
export TEST_AUTH_TOKEN="your_token"
export TEST_TENANT_ID="your_tenant_id"
export TEST_USER_ID="your_user_id"
```

### Authentication Errors (401)

- Token may be expired - get a fresh token
- Token may be invalid - verify it works with curl
- User may not have access - check permissions

### Permission Errors (403)

- User needs OWNER or ADMIN role
- Some tests (like filtering by status) require PLATFORM_ADMIN

### Connection Errors

- Ensure API server is running on correct port
- Check NEXT_PUBLIC_API_BASE_URL is correct
- Verify network connectivity

### Test Failures

1. **Invalid transition blocked** - Expected behavior, test passes
2. **Reason required** - Expected validation, test passes
3. **Admin-only restricted** - Expected for non-admin users

## Cleanup

Tests automatically clean up by resetting the tenant to `active` status after completion. If tests are interrupted:

```bash
# Manual cleanup via API
curl -X PATCH http://localhost:4000/api/tenants/YOUR_TENANT_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"active","reason":"Manual cleanup"}'
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Location Lifecycle Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run test:lifecycle
        env:
          TEST_AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}
          TEST_TENANT_ID: ${{ secrets.TEST_TENANT_ID }}
          TEST_USER_ID: ${{ secrets.TEST_USER_ID }}
```

### Local Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running location lifecycle tests..."
cd apps/api
npm test -- location-lifecycle.test.ts --silent

if [ $? -ne 0 ]; then
  echo "❌ Location lifecycle tests failed"
  exit 1
fi

echo "✅ Location lifecycle tests passed"
```

## Test Data

Tests use a single tenant and perform multiple status changes. The audit log will contain all test transitions. This is normal and demonstrates the audit trail functionality.

## Performance

Expected test execution time:
- **Fast:** ~5 seconds (local, no delays)
- **Normal:** ~10-15 seconds (with API calls)
- **Slow:** ~20+ seconds (network latency)

## Maintenance

### Adding New Tests

1. Add test to appropriate `describe` block
2. Follow existing pattern for API requests
3. Include console.log for visibility
4. Update this README with new test count

### Updating Test Data

If tenant structure changes:
1. Update `Tenant` type definition
2. Update assertions to match new fields
3. Update expected responses

## Related Documentation

- `docs/LOCATION_LIFECYCLE_DEPLOYMENT_COMPLETE.md` - Full system documentation
- `docs/LOCATION_LIFECYCLE_IMPLEMENTATION_PLAN.md` - Original implementation plan
- `apps/api/src/utils/location-status.ts` - Business logic utilities

## Support

For issues or questions:
1. Check test output for specific error messages
2. Verify environment variables are set correctly
3. Ensure API server is running and accessible
4. Review related documentation

**Happy Testing! 🧪**
