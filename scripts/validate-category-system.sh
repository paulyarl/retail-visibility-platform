#!/bin/bash
# Unified Categories - Comprehensive Validation Script
# Run this before and after each phase to ensure system integrity

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DATABASE_URL=${DATABASE_URL:-"postgresql://localhost:5432/rvp"}
API_URL=${API_URL:-"http://localhost:3001"}

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Unified Categories - System Validation Suite     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Track results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Function to run a test
run_test() {
  local test_name=$1
  local test_command=$2
  
  TESTS_TOTAL=$((TESTS_TOTAL + 1))
  echo -e "${YELLOW}▶ Running: ${test_name}${NC}"
  
  if eval "$test_command"; then
    echo -e "${GREEN}✓ PASS: ${test_name}${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL: ${test_name}${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 1: Database Structure Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Test 1: Check if category tables exist
run_test "Verify tenant_business_profiles_list exists" \
  "psql $DATABASE_URL -c \"SELECT COUNT(*) FROM tenant_business_profiles_list LIMIT 1\" > /dev/null 2>&1"

run_test "Verify directory_listings exists" \
  "psql $DATABASE_URL -c \"SELECT COUNT(*) FROM directory_listings LIMIT 1\" > /dev/null 2>&1"

# Test 2: Check category columns
run_test "Verify GBP category columns exist" \
  "psql $DATABASE_URL -c \"SELECT gbp_primary_category_id, gbp_primary_category_name FROM tenant_business_profiles_list LIMIT 1\" > /dev/null 2>&1"

run_test "Verify Directory category columns exist" \
  "psql $DATABASE_URL -c \"SELECT primary_category, secondary_categories FROM directory_listings LIMIT 1\" > /dev/null 2>&1"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 2: Data Integrity Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Test 3: Count categories
run_test "Count GBP primary categories" \
  "psql $DATABASE_URL -t -c \"SELECT COUNT(*) FROM tenant_business_profiles_list WHERE gbp_primary_category_id IS NOT NULL\" | grep -q '[0-9]'"

run_test "Count Directory primary categories" \
  "psql $DATABASE_URL -t -c \"SELECT COUNT(*) FROM directory_listings WHERE primary_category IS NOT NULL\" | grep -q '[0-9]'"

# Test 4: Check for orphaned data
run_test "Check for orphaned GBP categories" \
  "psql $DATABASE_URL -t -c \"SELECT COUNT(*) FROM tenant_business_profiles_list WHERE gbp_primary_category_id IS NOT NULL AND tenant_id NOT IN (SELECT id FROM \\\"Tenant\\\")\" | grep -q '^[[:space:]]*0'"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 3: Materialized View Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Test 5: Check materialized views
run_test "Verify mv_directory_stores exists" \
  "psql $DATABASE_URL -c \"SELECT COUNT(*) FROM mv_directory_stores LIMIT 1\" > /dev/null 2>&1"

run_test "Test mv_directory_stores refresh" \
  "psql $DATABASE_URL -c \"REFRESH MATERIALIZED VIEW CONCURRENTLY mv_directory_stores\" > /dev/null 2>&1"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 4: API Endpoint Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Test 6: Check API endpoints (if API is running)
if curl -s "$API_URL/health" > /dev/null 2>&1; then
  run_test "API health check" \
    "curl -s $API_URL/health | grep -q 'ok'"
  
  run_test "GBP categories endpoint accessible" \
    "curl -s -o /dev/null -w '%{http_code}' $API_URL/api/gbp/categories/popular | grep -q '200\|401'"
  
  run_test "Directory categories endpoint accessible" \
    "curl -s -o /dev/null -w '%{http_code}' $API_URL/api/directory/categories | grep -q '200\|401'"
else
  echo -e "${YELLOW}⚠ API not running, skipping API tests${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 5: Performance Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Test 7: Query performance
run_test "GBP category query performance < 100ms" \
  "psql $DATABASE_URL -c \"\\timing on\" -c \"SELECT * FROM tenant_business_profiles_list WHERE gbp_primary_category_id IS NOT NULL LIMIT 100\" 2>&1 | grep -q 'Time: [0-9][0-9]\\.[0-9]\\+ ms'"

run_test "Directory category query performance < 100ms" \
  "psql $DATABASE_URL -c \"\\timing on\" -c \"SELECT * FROM directory_listings WHERE primary_category IS NOT NULL LIMIT 100\" 2>&1 | grep -q 'Time: [0-9][0-9]\\.[0-9]\\+ ms'"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Results Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

echo -e "Total Tests:  ${TESTS_TOTAL}"
echo -e "${GREEN}Passed:       ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed:       ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✓ ALL TESTS PASSED - System is healthy!          ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ✗ SOME TESTS FAILED - Review errors above         ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════╝${NC}"
  exit 1
fi
