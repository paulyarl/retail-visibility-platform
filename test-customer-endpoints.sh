#!/bin/bash
# Customer Endpoints Test Script
# Tests customer authentication and address management endpoints

# Configuration
BASE_URL="http://localhost:4000"
TENANT_ID="tid-jcvzufq2"
COOKIE_FILE="/tmp/customer-test-cookies.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_header() {
  echo ""
  echo -e "${YELLOW}========================================${NC}"
  echo -e "${YELLOW}$1${NC}"
  echo -e "${YELLOW}========================================${NC}"
}

print_test() {
  echo -e "\n${GREEN}TEST:$NC $1"
}

print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
  fi
}

# Delete old cookie file
rm -f "$COOKIE_FILE"

# ========================================
# CUSTOMER AUTHENTICATION TESTS
# ========================================

print_header "CUSTOMER AUTHENTICATION ENDPOINTS"

# Test 1: Check current session (unauthenticated)
print_test "GET /api/customer-auth/me - Check session (unauthenticated)"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt "${BASE_URL}/api/customer-auth/me" \
  -H "Content-Type: application/json" 2>/dev/null)
cat /tmp/response.txt
echo -e "\nHTTP: $HTTP_CODE"
[ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]
print_result $?

# Test 2: Register new customer
print_test "POST /api/customer-auth/register - Register new customer"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test-customer-${TIMESTAMP}@example.com"
echo "Email: $TEST_EMAIL"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt -X POST "${BASE_URL}/api/customer-auth/register" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_FILE" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"TestPassword123\",\"firstName\":\"Test\",\"lastName\":\"Customer\"}" 2>/dev/null)
cat /tmp/response.txt
echo -e "\nHTTP: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]
print_result $?

# Show cookie file for debugging
echo -e "\n${YELLOW}Cookie file:${NC}"
cat "$COOKIE_FILE" 2>/dev/null || echo "No cookie file created"

# Extract customer ID
CUSTOMER_ID=$(cat /tmp/response.txt | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "\nCustomer ID: $CUSTOMER_ID"

# Test 3: Check session after registration (use manual Cookie header)
print_test "GET /api/customer-auth/me - Check session (authenticated)"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt "${BASE_URL}/api/customer-auth/me" \
  -H "Content-Type: application/json" \
  -H "Cookie: customer_session_id=${CUSTOMER_ID}" 2>/dev/null)
cat /tmp/response.txt
echo -e "\nHTTP: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ]
print_result $?

# Test 4: Logout
print_test "POST /api/customer-auth/logout - Logout"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt -X POST "${BASE_URL}/api/customer-auth/logout" \
  -H "Content-Type: application/json" \
  -H "Cookie: customer_session_id=${CUSTOMER_ID}" 2>/dev/null)
cat /tmp/response.txt
echo -e "\nHTTP: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ]
print_result $?

# Test 5: Login
print_test "POST /api/customer-auth/login - Login"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt -X POST "${BASE_URL}/api/customer-auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"TestPassword123\"}" 2>/dev/null)
cat /tmp/response.txt
echo -e "\nHTTP: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ]
print_result $?

# Re-extract customer ID after login
CUSTOMER_ID=$(cat /tmp/response.txt | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "\nCustomer ID: $CUSTOMER_ID"

# ========================================
# CUSTOMER ADDRESSES TESTS
# ========================================

print_header "CUSTOMER ADDRESSES ENDPOINTS"

# Test 6: List addresses
print_test "GET /api/customer-addresses - List addresses"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt "${BASE_URL}/api/customer-addresses" \
  -H "Content-Type: application/json" \
  -H "Cookie: customer_session_id=${CUSTOMER_ID}" 2>/dev/null)
cat /tmp/response.txt
echo -e "\nHTTP: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ]
print_result $?

# Test 7: Create address
print_test "POST /api/customer-addresses - Create new address"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt -X POST "${BASE_URL}/api/customer-addresses" \
  -H "Content-Type: application/json" \
  -H "Cookie: customer_session_id=${CUSTOMER_ID}" \
  -d '{
    "label": "Home",
    "isDefault": true,
    "isBilling": true,
    "addressLine1": "123 Main Street",
    "addressLine2": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US",
    "phone": "555-123-4567",
    "recipientName": "Test Customer"
  }' 2>/dev/null)
cat /tmp/response.txt
echo -e "\nHTTP: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]
print_result $?

# Extract address ID
ADDRESS_ID=$(cat /tmp/response.txt | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "\nAddress ID: $ADDRESS_ID"

# Test 8: Get specific address
print_test "GET /api/customer-addresses/{id} - Get specific address"
if [ -n "$ADDRESS_ID" ]; then
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt "${BASE_URL}/api/customer-addresses/${ADDRESS_ID}" \
    -H "Content-Type: application/json" \
    -H "Cookie: customer_session_id=${CUSTOMER_ID}" 2>/dev/null)
  cat /tmp/response.txt
  echo -e "\nHTTP: $HTTP_CODE"
  [ "$HTTP_CODE" = "200" ]
  print_result $?
else
  echo "Skipping - no address ID"
  print_result 1
fi

# Test 9: Create second address
print_test "POST /api/customer-addresses - Create second address"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt -X POST "${BASE_URL}/api/customer-addresses" \
  -H "Content-Type: application/json" \
  -H "Cookie: customer_session_id=${CUSTOMER_ID}" \
  -d '{
    "label": "Work",
    "isDefault": false,
    "isBilling": false,
    "addressLine1": "456 Office Park",
    "city": "New York",
    "state": "NY",
    "postalCode": "10002",
    "country": "US",
    "phone": "555-987-6543",
    "recipientName": "Test Customer"
  }' 2>/dev/null)
cat /tmp/response.txt
echo -e "\nHTTP: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]
print_result $?

ADDRESS_ID_2=$(cat /tmp/response.txt | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Test 10: List all addresses
print_test "GET /api/customer-addresses - List all addresses"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt "${BASE_URL}/api/customer-addresses" \
  -H "Content-Type: application/json" \
  -H "Cookie: customer_session_id=${CUSTOMER_ID}" 2>/dev/null)
cat /tmp/response.txt
echo -e "\nHTTP: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ]
print_result $?

# Test 11: Update address
print_test "PUT /api/customer-addresses/{id} - Update address"
if [ -n "$ADDRESS_ID" ]; then
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt -X PUT "${BASE_URL}/api/customer-addresses/${ADDRESS_ID}" \
    -H "Content-Type: application/json" \
    -H "Cookie: customer_session_id=${CUSTOMER_ID}" \
    -d '{
      "label": "Home Updated",
      "addressLine1": "123 Main Street Updated"
    }' 2>/dev/null)
  cat /tmp/response.txt
  echo -e "\nHTTP: $HTTP_CODE"
  [ "$HTTP_CODE" = "200" ]
  print_result $?
else
  echo "Skipping - no address ID"
  print_result 1
fi

# Test 12: Set default address
print_test "PUT /api/customer-addresses/{id}/default - Set as default"
if [ -n "$ADDRESS_ID_2" ]; then
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt -X PUT "${BASE_URL}/api/customer-addresses/${ADDRESS_ID_2}/default" \
    -H "Content-Type: application/json" \
    -H "Cookie: customer_session_id=${CUSTOMER_ID}" 2>/dev/null)
  cat /tmp/response.txt
  echo -e "\nHTTP: $HTTP_CODE"
  [ "$HTTP_CODE" = "200" ]
  print_result $?
else
  echo "Skipping - no second address ID"
  print_result 1
fi

# Test 13: Delete address
print_test "DELETE /api/customer-addresses/{id} - Delete address"
if [ -n "$ADDRESS_ID" ]; then
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt -X DELETE "${BASE_URL}/api/customer-addresses/${ADDRESS_ID}" \
    -H "Content-Type: application/json" \
    -H "Cookie: customer_session_id=${CUSTOMER_ID}" 2>/dev/null)
  cat /tmp/response.txt
  echo -e "\nHTTP: $HTTP_CODE"
  [ "$HTTP_CODE" = "200" ]
  print_result $?
else
  echo "Skipping - no address ID"
  print_result 1
fi

# ========================================
# CLEANUP
# ========================================

print_header "CLEANUP"

# Final logout
print_test "POST /api/customer-auth/logout - Final logout"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/response.txt -X POST "${BASE_URL}/api/customer-auth/logout" \
  -H "Content-Type: application/json" \
  -H "Cookie: customer_session_id=${CUSTOMER_ID}" 2>/dev/null)
cat /tmp/response.txt
echo -e "\nHTTP: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ]
print_result $?

# Clean up cookies
rm -f "$COOKIE_FILE"
rm -f /tmp/response.txt

# ========================================
# SUMMARY
# ========================================

print_header "TEST SUMMARY"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""
echo "Test Email: $TEST_EMAIL"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed.${NC}"
  exit 1
fi
