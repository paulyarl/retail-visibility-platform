#!/bin/bash
# M4 SKU Scanning Test Script (Bash)
# Tests all M4 endpoints with Doppler configuration

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_BASE_URL:-http://localhost:4000}"
AUTH_TOKEN="${TEST_AUTH_TOKEN}"
TENANT_ID="${TEST_TENANT_ID}"

# Test counters
PASS_COUNT=0
FAIL_COUNT=0
SESSION_ID=""

echo -e "${CYAN}\n=== M4 SKU Scanning Test Suite ===${NC}"
echo -e "${CYAN}API URL: $API_URL${NC}"
echo -e "${CYAN}Tenant ID: $TENANT_ID${NC}\n"

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    echo -e "${YELLOW}Testing: $name${NC}"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Authorization: Bearer $AUTH_TOKEN")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "  ${GREEN}✓ PASS - Status: $status_code${NC}"
        ((PASS_COUNT++))
        echo "$body"
    else
        echo -e "  ${RED}✗ FAIL - Expected: $expected_status, Got: $status_code${NC}"
        ((FAIL_COUNT++))
        echo ""
    fi
}

# Check prerequisites
if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}ERROR: AUTH_TOKEN not provided. Set TEST_AUTH_TOKEN environment variable.${NC}"
    exit 1
fi

if [ -z "$TENANT_ID" ]; then
    echo -e "${RED}ERROR: TENANT_ID not provided. Set TEST_TENANT_ID environment variable.${NC}"
    exit 1
fi

# Test 1: Start Scan Session
echo -e "${CYAN}\n--- Test 1: Start Scan Session ---${NC}"
session_response=$(test_endpoint \
    "POST /api/scan/start" \
    "POST" \
    "$API_URL/api/scan/start" \
    "{\"tenantId\":\"$TENANT_ID\",\"deviceType\":\"usb\",\"metadata\":{\"test\":\"automated\",\"script\":\"bash\"}}" \
    201)

SESSION_ID=$(echo "$session_response" | jq -r '.session.id // empty')

if [ -z "$SESSION_ID" ]; then
    echo -e "${RED}\nERROR: Failed to create session. Aborting tests.${NC}"
    exit 1
fi

echo -e "  ${GREEN}Session ID: $SESSION_ID${NC}"

# Test 2: Get Session Details
echo -e "${CYAN}\n--- Test 2: Get Session Details ---${NC}"
test_endpoint \
    "GET /api/scan/$SESSION_ID" \
    "GET" \
    "$API_URL/api/scan/$SESSION_ID" \
    "" \
    200 > /dev/null

# Test 3: Scan Barcodes
echo -e "${CYAN}\n--- Test 3: Scan Barcodes ---${NC}"
barcodes=("012345678905" "098765432109" "111222333444")

for barcode in "${barcodes[@]}"; do
    test_endpoint \
        "POST /api/scan/$SESSION_ID/lookup-barcode ($barcode)" \
        "POST" \
        "$API_URL/api/scan/$SESSION_ID/lookup-barcode" \
        "{\"barcode\":\"$barcode\"}" \
        201 > /dev/null
    sleep 0.5
done

# Test 4: Scan Duplicate Barcode
echo -e "${CYAN}\n--- Test 4: Scan Duplicate Barcode ---${NC}"
test_endpoint \
    "POST /api/scan/$SESSION_ID/lookup-barcode (duplicate)" \
    "POST" \
    "$API_URL/api/scan/$SESSION_ID/lookup-barcode" \
    "{\"barcode\":\"012345678905\"}" \
    409 > /dev/null

# Test 5: Get Scan Results
echo -e "${CYAN}\n--- Test 5: Get Scan Results ---${NC}"
results_response=$(test_endpoint \
    "GET /api/scan/$SESSION_ID/results" \
    "GET" \
    "$API_URL/api/scan/$SESSION_ID/results" \
    "" \
    200)

result_count=$(echo "$results_response" | jq -r '.count // 0')
echo -e "  ${GREEN}Found $result_count scan results${NC}"

# Test 6: Remove Scan Result
if [ "$result_count" -gt 0 ]; then
    first_result_id=$(echo "$results_response" | jq -r '.results[0].id // empty')
    
    if [ -n "$first_result_id" ]; then
        echo -e "${CYAN}\n--- Test 6: Remove Scan Result ---${NC}"
        test_endpoint \
            "DELETE /api/scan/$SESSION_ID/results/$first_result_id" \
            "DELETE" \
            "$API_URL/api/scan/$SESSION_ID/results/$first_result_id" \
            "" \
            200 > /dev/null
    fi
fi

# Test 7: Commit Session
echo -e "${CYAN}\n--- Test 7: Commit Session ---${NC}"
test_endpoint \
    "POST /api/scan/$SESSION_ID/commit" \
    "POST" \
    "$API_URL/api/scan/$SESSION_ID/commit" \
    "{\"skipValidation\":false}" \
    200 > /dev/null

# Test 8: Start Another Session for Cancellation
echo -e "${CYAN}\n--- Test 8: Start Another Session for Cancellation ---${NC}"
cancel_session_response=$(test_endpoint \
    "POST /api/scan/start (for cancel)" \
    "POST" \
    "$API_URL/api/scan/start" \
    "{\"tenantId\":\"$TENANT_ID\",\"deviceType\":\"manual\"}" \
    201)

CANCEL_SESSION_ID=$(echo "$cancel_session_response" | jq -r '.session.id // empty')

# Test 9: Cancel Session
if [ -n "$CANCEL_SESSION_ID" ]; then
    echo -e "${CYAN}\n--- Test 9: Cancel Session ---${NC}"
    test_endpoint \
        "DELETE /api/scan/$CANCEL_SESSION_ID" \
        "DELETE" \
        "$API_URL/api/scan/$CANCEL_SESSION_ID" \
        "" \
        200 > /dev/null
fi

# Test 10: Admin - Enrichment Cache Stats
echo -e "${CYAN}\n--- Test 10: Admin - Enrichment Cache Stats ---${NC}"
test_endpoint \
    "GET /api/admin/enrichment/cache-stats" \
    "GET" \
    "$API_URL/api/admin/enrichment/cache-stats" \
    "" \
    200 > /dev/null

# Test 11: Admin - Enrichment Rate Limits
echo -e "${CYAN}\n--- Test 11: Admin - Enrichment Rate Limits ---${NC}"
test_endpoint \
    "GET /api/admin/enrichment/rate-limits" \
    "GET" \
    "$API_URL/api/admin/enrichment/rate-limits" \
    "" \
    200 > /dev/null

# Test 12: Admin - Scan Metrics
echo -e "${CYAN}\n--- Test 12: Admin - Scan Metrics ---${NC}"
test_endpoint \
    "GET /api/admin/scan-metrics?timeRange=24h" \
    "GET" \
    "$API_URL/api/admin/scan-metrics?timeRange=24h" \
    "" \
    200 > /dev/null

# Test 13: Admin - Scan Metrics Timeseries
echo -e "${CYAN}\n--- Test 13: Admin - Scan Metrics Timeseries ---${NC}"
test_endpoint \
    "GET /api/admin/scan-metrics/timeseries?timeRange=24h" \
    "GET" \
    "$API_URL/api/admin/scan-metrics/timeseries?timeRange=24h" \
    "" \
    200 > /dev/null

# Summary
echo -e "${CYAN}\n=== Test Summary ===${NC}"
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"

TOTAL=$((PASS_COUNT + FAIL_COUNT))
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASS_COUNT / $TOTAL) * 100}")
else
    SUCCESS_RATE=0
fi

if (( $(echo "$SUCCESS_RATE >= 90" | bc -l) )); then
    echo -e "${GREEN}Success Rate: $SUCCESS_RATE%${NC}"
else
    echo -e "${RED}Success Rate: $SUCCESS_RATE%${NC}"
fi

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}\n✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}\n✗ Some tests failed.${NC}"
    exit 1
fi
