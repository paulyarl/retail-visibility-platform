# Propagation Endpoints Test Suite

Comprehensive test script for all 7 propagation features in the Propagation Control Panel.

## Prerequisites

- `curl` installed
- `jq` installed (for JSON parsing)
- Valid authentication token
- Hero tenant ID from an organization

## Setup

1. **Get your authentication token:**
   ```bash
   # Login to get your token
   # Copy the token from your browser's localStorage or API response
   ```

2. **Get your tenant ID:**
   ```bash
   # Use a hero tenant ID from your organization
   # You can find this in the organization settings
   ```

3. **Make the script executable:**
   ```bash
   chmod +x apps/api/tests/propagation-endpoints.test.sh
   ```

## Usage

### Basic Usage

```bash
TENANT_ID=your-tenant-id AUTH_TOKEN=your-token ./apps/api/tests/propagation-endpoints.test.sh
```

### With Custom API URL

```bash
API_BASE_URL=https://your-api.com TENANT_ID=your-tenant-id AUTH_TOKEN=your-token ./apps/api/tests/propagation-endpoints.test.sh
```

### Example

```bash
TENANT_ID=cmhm7fsm9000cg8l4m72gcfqb \
AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
./apps/api/tests/propagation-endpoints.test.sh
```

## What Gets Tested

### 1. Categories Propagation
- ✅ Create or Update mode
- ✅ Create Only mode
- ✅ Update Only mode

### 2. Business Hours Propagation
- ✅ With special hours
- ✅ Without special hours

### 3. Feature Flags Propagation
- ✅ Create or Update mode
- ✅ Create Only mode
- ✅ Update Only mode

### 4. User Roles Propagation
- ✅ Create or Update mode
- ✅ Create Only mode
- ✅ Update Only mode

### 5. Brand Assets Propagation
- ✅ Basic propagation

### 6. Business Profile Propagation
- ✅ Basic propagation

### 7. Error Handling
- ✅ Invalid tenant ID
- ✅ Invalid mode parameter
- ✅ Missing authentication

### 8. Performance Test
- ✅ Response time < 5 seconds

## Expected Output

```
╔═══════════════════════════════════════════════════════╗
║   Propagation Control Panel - Endpoint Test Suite    ║
╚═══════════════════════════════════════════════════════╝

========================================
Checking Prerequisites
========================================

✓ API Base URL: http://localhost:4000
✓ Tenant ID: cmhm7fsm9000cg8l4m72gcfqb
✓ Auth Token: eyJhbGciOiJIUzI1NiI...

========================================
Test 1: Categories Propagation
========================================

Testing: Categories Propagation (create_or_update)
✓ PASS: Categories Propagation (create_or_update) (HTTP 200)
  Response: Successfully propagated categories

...

========================================
Test Summary
========================================
Total Tests: 18
Passed: 18
Failed: 0

All tests passed! 🎉
```

## Troubleshooting

### Authentication Errors (401)
- Verify your AUTH_TOKEN is valid and not expired
- Check that the token has proper permissions

### Not Found Errors (404)
- Verify the TENANT_ID exists
- Ensure the tenant is part of an organization
- Check that the tenant is set as a hero location

### Permission Errors (403)
- Ensure you're an Owner or Admin of the organization
- Platform admins should have access

### No Data Errors (400)
- Verify the hero tenant has data to propagate
- Check that categories/hours/flags exist on the hero tenant

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Propagation Endpoints

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Run Propagation Tests
        env:
          API_BASE_URL: ${{ secrets.API_BASE_URL }}
          TENANT_ID: ${{ secrets.TEST_TENANT_ID }}
          AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}
        run: |
          chmod +x apps/api/tests/propagation-endpoints.test.sh
          ./apps/api/tests/propagation-endpoints.test.sh
```

### Railway/Vercel Deployment

Add to your deployment pipeline:

```bash
# After deployment
TENANT_ID=$TEST_TENANT_ID \
AUTH_TOKEN=$TEST_AUTH_TOKEN \
API_BASE_URL=$DEPLOYED_API_URL \
./apps/api/tests/propagation-endpoints.test.sh
```

## Development

### Adding New Tests

1. Create a new test function:
```bash
test_new_feature() {
    print_header "Test N: New Feature"
    
    test_endpoint \
        "New Feature Test" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/new-feature/propagate" \
        '{"param":"value"}' \
        "200"
}
```

2. Add to main execution:
```bash
main() {
    # ... existing tests
    test_new_feature
    # ...
}
```

### Customizing Tests

Edit the script to:
- Add more test cases
- Modify expected responses
- Add custom validation logic
- Integrate with other testing tools

## Notes

- Tests are **non-destructive** but will propagate data
- Run against a test environment first
- Some tests may take time depending on organization size
- Performance test threshold is 5 seconds (adjustable)

## Support

For issues or questions:
- Check the API logs for detailed error messages
- Verify all prerequisites are met
- Ensure the hero tenant has data to propagate
- Contact platform support if issues persist
