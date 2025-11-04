#!/bin/bash
# M3 GBP Category Sync - Automated Test Script
# Tests out-of-sync detection, sync logs API, and admin dashboard integration
# Usage: ./tests/m3-gbp-sync-test.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
TEST_TENANT_ID="${TEST_TENANT_ID:-}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}M3 GBP Category Sync Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print test status
print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check prerequisites
print_info "Checking prerequisites..."

if [ -z "$ADMIN_TOKEN" ]; then
    print_error "ADMIN_TOKEN not set. Please set it in your environment or .env file"
    echo "Example: export ADMIN_TOKEN='your-admin-jwt-token'"
    exit 1
fi

print_success "Admin token found"

# Test 1: Verify API is running
print_test "Test 1: Verify API is running"
if curl -s -f "${API_BASE_URL}/health" > /dev/null 2>&1; then
    print_success "API is running at ${API_BASE_URL}"
else
    print_error "API is not responding at ${API_BASE_URL}"
    exit 1
fi

# Test 2: Get sync stats endpoint
print_test "Test 2: GET /api/admin/sync-stats"
STATS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${API_BASE_URL}/api/admin/sync-stats")

HTTP_CODE=$(echo "$STATS_RESPONSE" | tail -n1)
STATS_BODY=$(echo "$STATS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Sync stats endpoint returned 200"
    echo "$STATS_BODY" | jq '.' 2>/dev/null || echo "$STATS_BODY"
    
    # Extract metrics
    TOTAL_RUNS=$(echo "$STATS_BODY" | jq -r '.stats.totalRuns // 0')
    SUCCESS_RATE=$(echo "$STATS_BODY" | jq -r '.stats.successRate // 0')
    OUT_OF_SYNC=$(echo "$STATS_BODY" | jq -r '.stats.outOfSyncCount // 0')
    
    print_info "Total Runs (24h): $TOTAL_RUNS"
    print_info "Success Rate: ${SUCCESS_RATE}%"
    print_info "Out of Sync Count: $OUT_OF_SYNC"
else
    print_error "Sync stats endpoint returned $HTTP_CODE"
    echo "$STATS_BODY"
fi

# Test 3: Get sync logs endpoint
print_test "Test 3: GET /api/admin/sync-logs"
LOGS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${API_BASE_URL}/api/admin/sync-logs?limit=5")

HTTP_CODE=$(echo "$LOGS_RESPONSE" | tail -n1)
LOGS_BODY=$(echo "$LOGS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Sync logs endpoint returned 200"
    
    LOG_COUNT=$(echo "$LOGS_BODY" | jq -r '.data | length')
    print_info "Retrieved $LOG_COUNT sync logs"
    
    # Show first log if exists
    if [ "$LOG_COUNT" -gt 0 ]; then
        echo "$LOGS_BODY" | jq '.data[0]' 2>/dev/null || echo "$LOGS_BODY"
    fi
else
    print_error "Sync logs endpoint returned $HTTP_CODE"
    echo "$LOGS_BODY"
fi

# Test 4: Get last mirror run
print_test "Test 4: GET /api/admin/mirror/last-run"
LAST_RUN_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${API_BASE_URL}/api/admin/mirror/last-run?strategy=platform_to_gbp")

HTTP_CODE=$(echo "$LAST_RUN_RESPONSE" | tail -n1)
LAST_RUN_BODY=$(echo "$LAST_RUN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Last run endpoint returned 200"
    echo "$LAST_RUN_BODY" | jq '.' 2>/dev/null || echo "$LAST_RUN_BODY"
else
    print_error "Last run endpoint returned $HTTP_CODE"
    echo "$LAST_RUN_BODY"
fi

# Test 5: Trigger dry-run sync
print_test "Test 5: POST /api/categories/mirror (dry-run)"
MIRROR_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"strategy\":\"platform_to_gbp\",\"dryRun\":true}" \
    "${API_BASE_URL}/api/categories/mirror")

HTTP_CODE=$(echo "$MIRROR_RESPONSE" | tail -n1)
MIRROR_BODY=$(echo "$MIRROR_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "202" ]; then
    print_success "Mirror endpoint accepted dry-run job (202)"
    JOB_ID=$(echo "$MIRROR_BODY" | jq -r '.jobId // "unknown"')
    print_info "Job ID: $JOB_ID"
    echo "$MIRROR_BODY" | jq '.' 2>/dev/null || echo "$MIRROR_BODY"
    
    # Wait for job to complete
    print_info "Waiting 3 seconds for job to complete..."
    sleep 3
    
    # Check logs again
    print_test "Verifying job appears in logs"
    LOGS_CHECK=$(curl -s \
        -H "Authorization: Bearer ${ADMIN_TOKEN}" \
        "${API_BASE_URL}/api/admin/sync-logs?limit=1")
    
    LATEST_JOB=$(echo "$LOGS_CHECK" | jq -r '.data[0].jobId // "none"')
    if [ "$LATEST_JOB" = "$JOB_ID" ]; then
        print_success "Job found in sync logs"
    else
        print_error "Job not found in sync logs (expected: $JOB_ID, got: $LATEST_JOB)"
    fi
elif [ "$HTTP_CODE" = "409" ]; then
    print_error "Feature disabled - check FF_CATEGORY_MIRRORING flag"
    echo "$MIRROR_BODY"
else
    print_error "Mirror endpoint returned $HTTP_CODE"
    echo "$MIRROR_BODY"
fi

# Test 6: Verify out-of-sync metric emission (check logs)
print_test "Test 6: Check for out-of-sync detection in logs"
print_info "This requires checking API logs for '[GBP_SYNC] OUT-OF-SYNC detected' messages"
print_info "Manual verification needed - check your API console/logs"

# Test 7: Feature flag verification
print_test "Test 7: Verify feature flags"
print_info "Checking required feature flags..."

# This would need an endpoint to check flags - placeholder for now
print_info "Required flags for M3:"
print_info "  - FF_CATEGORY_MIRRORING (controls mirror endpoint)"
print_info "  - FF_TENANT_PLATFORM_CATEGORY (enables tenant categories)"
print_info "  - FF_TENANT_GBP_CATEGORY_SYNC (worker + dashboard visibility)"

# Test 8: Database verification
print_test "Test 8: Verify categoryMirrorRun table exists"
print_info "This requires database access - manual verification needed"
print_info "Check that table 'categoryMirrorRun' exists with columns:"
print_info "  - id, tenantId, strategy, dryRun"
print_info "  - created, updated, deleted, skipped, reason, error"
print_info "  - jobId, startedAt, completedAt"

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Automated Tests Completed${NC}"
echo ""
echo "Manual Verification Needed:"
echo "  1. Navigate to ${WEB_BASE_URL}/settings/admin"
echo "     - Verify 'GBP Category Sync' tile appears"
echo "     - Check success rate displays correctly"
echo ""
echo "  2. Navigate to ${WEB_BASE_URL}/settings/admin/gbp-sync"
echo "     - Verify 4 stat cards load"
echo "     - Test 'Trigger Manual Sync' button"
echo "     - Check sync logs table populates"
echo ""
echo "  3. Check API logs for telemetry:"
echo "     - Look for '[GBP_SYNC] OUT-OF-SYNC detected' messages"
echo "     - Verify metric emission if METRICS_DEBUG=true"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}M3 Testing Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
