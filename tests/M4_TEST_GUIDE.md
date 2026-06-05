# M4 SKU Scanning Test Guide

Comprehensive testing guide for M4 "SKU Scanning core (elevated)" milestone.

---

## Prerequisites

### 1. Environment Setup

**Required Environment Variables:**
```bash
# API Configuration
API_BASE_URL=http://localhost:4000

# Authentication
TEST_AUTH_TOKEN=your_jwt_token_here

# Tenant Configuration
TEST_TENANT_ID=your_tenant_id_here

# Feature Flags (optional - for testing with flags disabled)
FF_SKU_SCANNING=true
FF_SCAN_USB=true
FF_SCAN_CAMERA=false
FF_SCAN_ENRICHMENT=true
```

### 2. External API Keys (Optional)

For full enrichment testing:
```bash
UPC_DATABASE_API_KEY=your_upc_api_key_here
```

### 3. Tools Required

- **PowerShell 5.1+** (Windows) or **Bash** (Linux/Mac)
- **curl** (for Bash script)
- **jq** (for Bash script JSON parsing)
- **Doppler CLI** (recommended for secret management)

---

## Running Tests

### Option 1: With Doppler (Recommended)

```powershell
# PowerShell
doppler run -- pwsh ./tests/m4-scan-test.ps1
```

```bash
# Bash
doppler run -- bash ./tests/m4-scan-test.sh
```

### Option 2: With Environment Variables

```powershell
# PowerShell
$env:API_BASE_URL="http://localhost:4000"
$env:TEST_AUTH_TOKEN="your_token"
$env:TEST_TENANT_ID="your_tenant_id"
pwsh ./tests/m4-scan-test.ps1
```

```bash
# Bash
export API_BASE_URL="http://localhost:4000"
export TEST_AUTH_TOKEN="your_token"
export TEST_TENANT_ID="your_tenant_id"
bash ./tests/m4-scan-test.sh
```

### Option 3: With Parameters (PowerShell only)

```powershell
pwsh ./tests/m4-scan-test.ps1 `
    -ApiUrl "http://localhost:4000" `
    -AuthToken "your_token" `
    -TenantId "your_tenant_id"
```

---

## Test Coverage

### 1. Session Management (Tests 1-2, 8-9)

**Test 1: Start Scan Session**
- Endpoint: `POST /api/scan/start`
- Validates: Session creation with device type and metadata
- Expected: 201 Created

**Test 2: Get Session Details**
- Endpoint: `GET /api/scan/:sessionId`
- Validates: Session retrieval with results
- Expected: 200 OK

**Test 8-9: Cancel Session**
- Endpoint: `DELETE /api/scan/:sessionId`
- Validates: Session cancellation workflow
- Expected: 200 OK

### 2. Barcode Scanning (Tests 3-4)

**Test 3: Scan Multiple Barcodes**
- Endpoint: `POST /api/scan/:sessionId/lookup-barcode`
- Validates: Barcode lookup and enrichment
- Barcodes tested: 012345678905, 098765432109, 111222333444
- Expected: 201 Created for each

**Test 4: Duplicate Detection**
- Endpoint: `POST /api/scan/:sessionId/lookup-barcode`
- Validates: Duplicate barcode rejection
- Expected: 409 Conflict

### 3. Result Management (Tests 5-6)

**Test 5: Get Scan Results**
- Endpoint: `GET /api/scan/:sessionId/results`
- Validates: Result retrieval and count
- Expected: 200 OK with results array

**Test 6: Remove Scan Result**
- Endpoint: `DELETE /api/scan/:sessionId/results/:resultId`
- Validates: Individual result removal
- Expected: 200 OK

### 4. Commit Workflow (Test 7)

**Test 7: Commit Session**
- Endpoint: `POST /api/scan/:sessionId/commit`
- Validates: Batch commit to inventory
- Expected: 200 OK with committed count

### 5. Admin Endpoints (Tests 10-13)

**Test 10: Enrichment Cache Stats**
- Endpoint: `GET /api/admin/enrichment/cache-stats`
- Validates: Cache statistics retrieval
- Expected: 200 OK

**Test 11: Enrichment Rate Limits**
- Endpoint: `GET /api/admin/enrichment/rate-limits`
- Validates: Rate limit status per provider
- Expected: 200 OK

**Test 12: Scan Metrics**
- Endpoint: `GET /api/admin/scan-metrics`
- Validates: Aggregate metrics with time range
- Expected: 200 OK

**Test 13: Scan Metrics Timeseries**
- Endpoint: `GET /api/admin/scan-metrics/timeseries`
- Validates: Time-series data for charts
- Expected: 200 OK

---

## Expected Results

### Success Criteria

✅ **All 13 tests pass** (100% success rate)

### Typical Output

```
=== M4 SKU Scanning Test Suite ===
API URL: http://localhost:4000
Tenant ID: tenant-123

--- Test 1: Start Scan Session ---
Testing: POST /api/scan/start
  ✓ PASS - Status: 201
  Session ID: scan-session-abc123

--- Test 2: Get Session Details ---
Testing: GET /api/scan/scan-session-abc123
  ✓ PASS - Status: 200

--- Test 3: Scan Barcodes ---
Testing: POST /api/scan/scan-session-abc123/lookup-barcode (012345678905)
  ✓ PASS - Status: 201
Testing: POST /api/scan/scan-session-abc123/lookup-barcode (098765432109)
  ✓ PASS - Status: 201
Testing: POST /api/scan/scan-session-abc123/lookup-barcode (111222333444)
  ✓ PASS - Status: 201

--- Test 4: Scan Duplicate Barcode ---
Testing: POST /api/scan/scan-session-abc123/lookup-barcode (duplicate)
  ✓ PASS - Status: 409

--- Test 5: Get Scan Results ---
Testing: GET /api/scan/scan-session-abc123/results
  ✓ PASS - Status: 200
  Found 3 scan results

--- Test 6: Remove Scan Result ---
Testing: DELETE /api/scan/scan-session-abc123/results/result-123
  ✓ PASS - Status: 200

--- Test 7: Commit Session ---
Testing: POST /api/scan/scan-session-abc123/commit
  ✓ PASS - Status: 200

--- Test 8: Start Another Session for Cancellation ---
Testing: POST /api/scan/start (for cancel)
  ✓ PASS - Status: 201

--- Test 9: Cancel Session ---
Testing: DELETE /api/scan/scan-session-xyz789
  ✓ PASS - Status: 200

--- Test 10: Admin - Enrichment Cache Stats ---
Testing: GET /api/admin/enrichment/cache-stats
  ✓ PASS - Status: 200

--- Test 11: Admin - Enrichment Rate Limits ---
Testing: GET /api/admin/enrichment/rate-limits
  ✓ PASS - Status: 200

--- Test 12: Admin - Scan Metrics ---
Testing: GET /api/admin/scan-metrics?timeRange=24h
  ✓ PASS - Status: 200

--- Test 13: Admin - Scan Metrics Timeseries ---
Testing: GET /api/admin/scan-metrics/timeseries?timeRange=24h
  ✓ PASS - Status: 200

=== Test Summary ===
Passed: 13
Failed: 0
Success Rate: 100.0%

✓ All tests passed!
```

---

## Troubleshooting

### Issue: Authentication Failed (401)

**Cause**: Invalid or expired JWT token

**Solution**:
1. Generate a new token from the auth endpoint
2. Update `TEST_AUTH_TOKEN` environment variable
3. Ensure token has admin role for admin endpoints

### Issue: Tenant Not Found (403)

**Cause**: Invalid tenant ID or user doesn't have access

**Solution**:
1. Verify `TEST_TENANT_ID` is correct
2. Ensure authenticated user has access to the tenant
3. Check tenant exists in database

### Issue: Feature Disabled (409)

**Cause**: Feature flag `FF_SKU_SCANNING` is disabled

**Solution**:
1. Enable feature flag in environment: `FF_SKU_SCANNING=true`
2. Restart API server
3. Re-run tests

### Issue: Enrichment API Errors

**Cause**: External API keys not configured or rate limits exceeded

**Solution**:
1. Check `UPC_DATABASE_API_KEY` is set (optional)
2. Verify rate limits haven't been exceeded
3. Tests will use fallback data if APIs fail

### Issue: Database Connection Error

**Cause**: Database not accessible

**Solution**:
1. Verify `DATABASE_URL` is correct
2. Ensure database is running
3. Check network connectivity

---

## Manual Testing

### 1. Frontend Testing

**Start Session:**
1. Navigate to `/scan`
2. Select device type (USB/Camera/Manual)
3. Click "Start Scanning"

**Scan Barcodes:**
1. Use USB scanner or enter manually
2. Verify enrichment data appears
3. Check duplicate detection works

**Review & Commit:**
1. Review scanned items in batch
2. Remove any unwanted items
3. Click "Commit" to add to inventory

**View Metrics:**
1. Navigate to `/settings/admin/scan-metrics`
2. Select time range
3. Verify metrics display correctly

### 2. API Testing with curl

```bash
# Start session
curl -X POST http://localhost:4000/api/scan/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-123","deviceType":"usb"}'

# Scan barcode
curl -X POST http://localhost:4000/api/scan/SESSION_ID/lookup-barcode \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"barcode":"012345678905"}'

# Get results
curl http://localhost:4000/api/scan/SESSION_ID/results \
  -H "Authorization: Bearer $TOKEN"

# Commit
curl -X POST http://localhost:4000/api/scan/SESSION_ID/commit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"skipValidation":false}'
```

---

## Performance Benchmarks

### Expected Latencies

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Start Session | <100ms | <500ms |
| Barcode Lookup (cache hit) | <5ms | <50ms |
| Barcode Lookup (API call) | <500ms | <2000ms |
| Get Results | <100ms | <500ms |
| Commit Session | <2000ms | <5000ms |
| Metrics Query | <500ms | <2000ms |

### Cache Performance

- **Target Cache Hit Rate**: ≥80%
- **Acceptable**: ≥60%
- **Poor**: <60%

### Success Rates

- **Target Scan Success Rate**: ≥95%
- **Target Commit Success Rate**: ≥95%

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: M4 Tests

on: [push, pull_request]

jobs:
  test-m4:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Doppler
        uses: dopplerhq/cli-action@v2
      
      - name: Run M4 Tests
        run: doppler run -- bash ./tests/m4-scan-test.sh
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN }}
```

---

## Test Data Cleanup

After testing, you may want to clean up test data:

```sql
-- Delete test sessions
DELETE FROM scan_sessions 
WHERE metadata->>'test' = 'automated';

-- Delete test scan results
DELETE FROM scan_results 
WHERE tenant_id = 'test-tenant-id' 
AND created_at > NOW() - INTERVAL '1 hour';

-- Delete test inventory items
DELETE FROM inventory_items 
WHERE metadata->>'scannedFrom' LIKE 'scan-session-%';
```

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review API logs for detailed error messages
3. Verify all prerequisites are met
4. Contact the development team

---

**Last Updated**: November 4, 2025  
**Test Version**: 1.0.0  
**M4 Status**: 100% Complete
