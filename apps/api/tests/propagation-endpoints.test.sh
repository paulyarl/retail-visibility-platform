#!/bin/bash

# Propagation Endpoints Test Script
# Tests all 7 propagation features in the Propagation Control Panel

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
TENANT_ID="${TENANT_ID:-}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}Testing:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((TESTS_PASSED++))
    ((TESTS_TOTAL++))
}

print_failure() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    echo -e "${RED}  Error:${NC} $2"
    ((TESTS_FAILED++))
    ((TESTS_TOTAL++))
}

print_summary() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}Test Summary${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "Total Tests: ${TESTS_TOTAL}"
    echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
    echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}All tests passed! 🎉${NC}\n"
        exit 0
    else
        echo -e "\n${RED}Some tests failed! ❌${NC}\n"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    if [ -z "$TENANT_ID" ]; then
        echo -e "${RED}Error: TENANT_ID environment variable is required${NC}"
        echo "Usage: TENANT_ID=your-tenant-id AUTH_TOKEN=your-token ./propagation-endpoints.test.sh"
        exit 1
    fi
    
    if [ -z "$AUTH_TOKEN" ]; then
        echo -e "${RED}Error: AUTH_TOKEN environment variable is required${NC}"
        echo "Usage: TENANT_ID=your-tenant-id AUTH_TOKEN=your-token ./propagation-endpoints.test.sh"
        exit 1
    fi
    
    echo -e "${GREEN}✓${NC} API Base URL: $API_BASE_URL"
    echo -e "${GREEN}✓${NC} Tenant ID: $TENANT_ID"
    echo -e "${GREEN}✓${NC} Auth Token: ${AUTH_TOKEN:0:20}..."
}

# Test helper function
test_endpoint() {
    local test_name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    print_test "$test_name"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -d "$data" \
            "$API_BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X GET \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            "$API_BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        print_success "$test_name (HTTP $http_code)"
        echo "  Response: $(echo $body | jq -r '.message // .error // "Success"' 2>/dev/null || echo $body | head -c 100)"
    else
        print_failure "$test_name" "Expected HTTP $expected_status, got $http_code"
        echo "  Response: $body"
    fi
}

# Test 1: Categories Propagation
test_categories_propagation() {
    print_header "Test 1: Categories Propagation"
    
    # Test with create_or_update mode
    test_endpoint \
        "Categories Propagation (create_or_update)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/categories/propagate" \
        '{"mode":"create_or_update"}' \
        "200"
    
    # Test with create_only mode
    test_endpoint \
        "Categories Propagation (create_only)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/categories/propagate" \
        '{"mode":"create_only"}' \
        "200"
    
    # Test with update_only mode
    test_endpoint \
        "Categories Propagation (update_only)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/categories/propagate" \
        '{"mode":"update_only"}' \
        "200"
}

# Test 2: Business Hours Propagation
test_business_hours_propagation() {
    print_header "Test 2: Business Hours Propagation"
    
    # Test with special hours included
    test_endpoint \
        "Business Hours Propagation (with special hours)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/business-hours/propagate" \
        '{"includeSpecialHours":true}' \
        "200"
    
    # Test without special hours
    test_endpoint \
        "Business Hours Propagation (without special hours)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/business-hours/propagate" \
        '{"includeSpecialHours":false}' \
        "200"
}

# Test 3: Feature Flags Propagation
test_feature_flags_propagation() {
    print_header "Test 3: Feature Flags Propagation"
    
    # Test with create_or_update mode
    test_endpoint \
        "Feature Flags Propagation (create_or_update)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/feature-flags/propagate" \
        '{"mode":"create_or_update"}' \
        "200"
    
    # Test with create_only mode
    test_endpoint \
        "Feature Flags Propagation (create_only)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/feature-flags/propagate" \
        '{"mode":"create_only"}' \
        "200"
    
    # Test with update_only mode
    test_endpoint \
        "Feature Flags Propagation (update_only)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/feature-flags/propagate" \
        '{"mode":"update_only"}' \
        "200"
}

# Test 4: User Roles Propagation
test_user_roles_propagation() {
    print_header "Test 4: User Roles Propagation"
    
    # Test with create_or_update mode
    test_endpoint \
        "User Roles Propagation (create_or_update)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/user-roles/propagate" \
        '{"mode":"create_or_update"}' \
        "200"
    
    # Test with create_only mode
    test_endpoint \
        "User Roles Propagation (create_only)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/user-roles/propagate" \
        '{"mode":"create_only"}' \
        "200"
    
    # Test with update_only mode
    test_endpoint \
        "User Roles Propagation (update_only)" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/user-roles/propagate" \
        '{"mode":"update_only"}' \
        "200"
}

# Test 5: Brand Assets Propagation
test_brand_assets_propagation() {
    print_header "Test 5: Brand Assets Propagation"
    
    test_endpoint \
        "Brand Assets Propagation" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/brand-assets/propagate" \
        '{}' \
        "200"
}

# Test 6: Business Profile Propagation
test_business_profile_propagation() {
    print_header "Test 6: Business Profile Propagation"
    
    test_endpoint \
        "Business Profile Propagation" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/business-profile/propagate" \
        '{}' \
        "200"
}

# Test 7: Error Handling
test_error_handling() {
    print_header "Test 7: Error Handling"
    
    # Test with invalid tenant ID
    test_endpoint \
        "Invalid Tenant ID" \
        "POST" \
        "/api/v1/tenants/invalid-tenant-id/categories/propagate" \
        '{"mode":"create_or_update"}' \
        "404"
    
    # Test with invalid mode
    test_endpoint \
        "Invalid Mode Parameter" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/categories/propagate" \
        '{"mode":"invalid_mode"}' \
        "400"
    
    # Test without authentication
    AUTH_TOKEN_BACKUP=$AUTH_TOKEN
    AUTH_TOKEN=""
    test_endpoint \
        "Missing Authentication" \
        "POST" \
        "/api/v1/tenants/$TENANT_ID/categories/propagate" \
        '{"mode":"create_or_update"}' \
        "401"
    AUTH_TOKEN=$AUTH_TOKEN_BACKUP
}

# Test 8: Performance Test
test_performance() {
    print_header "Test 8: Performance Test"
    
    print_test "Categories Propagation Performance"
    start_time=$(date +%s%N)
    
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d '{"mode":"create_or_update"}' \
        "$API_BASE_URL/api/v1/tenants/$TENANT_ID/categories/propagate" > /dev/null
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))
    
    if [ $duration -lt 5000 ]; then
        print_success "Performance test (${duration}ms)"
    else
        print_failure "Performance test" "Took ${duration}ms (expected < 5000ms)"
    fi
}

# Main execution
main() {
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║   Propagation Control Panel - Endpoint Test Suite    ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_prerequisites
    
    # Run all tests
    test_categories_propagation
    test_business_hours_propagation
    test_feature_flags_propagation
    test_user_roles_propagation
    test_brand_assets_propagation
    test_business_profile_propagation
    test_error_handling
    test_performance
    
    # Print summary
    print_summary
}

# Run main function
main
