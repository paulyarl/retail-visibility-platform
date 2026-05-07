#!/bin/bash

# Multi-Location Availability API Test Script
# Tests all endpoints with a real product slug

# Configuration
BASE_URL="${API_URL:-http://localhost:3001}"
PRODUCT_SLUG="frozen-foods/amy's-kitchen-amy's-cheese-pizza,-single-serve-9f5d53"

# Test coordinates (NYC)
LAT="40.7128"
LNG="-74.0060"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "Multi-Location Availability API Tests"
echo "========================================"
echo "Base URL: $BASE_URL"
echo "Product Slug: $PRODUCT_SLUG"
echo "Test Location: NYC ($LAT, $LNG)"
echo "========================================"
echo ""

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    echo -e "${YELLOW}Testing: $name${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ Status: $http_code${NC}"
        echo "Response:"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Status: $http_code${NC}"
        echo "Response:"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
    echo ""
}

# URL encode the slug
ENCODED_SLUG=$(python3 -c "import urllib.parse; print(urllib.parse.quote(\"$PRODUCT_SLUG\"))" 2>/dev/null || \
    node -e "console.log(encodeURIComponent('$PRODUCT_SLUG'))" 2>/dev/null || \
    echo "$PRODUCT_SLUG" | sed 's/\//%2F/g' | sed "s/'/%27/g" | sed 's/,/%2C/g')

echo "Encoded Slug: $ENCODED_SLUG"
echo ""

# ============================================
# Test 1: Basic availability query
# ============================================
test_endpoint \
    "Basic Availability Query" \
    "GET" \
    "/api/catalog/availability?slug=$ENCODED_SLUG"

# ============================================
# Test 2: Availability with user location
# ============================================
test_endpoint \
    "Availability with User Location" \
    "GET" \
    "/api/catalog/availability?slug=$ENCODED_SLUG&lat=$LAT&lng=$LNG"

# ============================================
# Test 3: Availability with distance limit
# ============================================
test_endpoint \
    "Availability with Distance Limit (25mi)" \
    "GET" \
    "/api/catalog/availability?slug=$ENCODED_SLUG&lat=$LAT&lng=$LNG&maxDistance=25"

# ============================================
# Test 4: Exclude out of stock
# ============================================
test_endpoint \
    "Exclude Out of Stock" \
    "GET" \
    "/api/catalog/availability?slug=$ENCODED_SLUG&includeOutOfStock=false"

# ============================================
# Test 5: Limited results
# ============================================
test_endpoint \
    "Limited Results (3)" \
    "GET" \
    "/api/catalog/availability?slug=$ENCODED_SLUG&lat=$LAT&lng=$LNG&maxResults=3"

# ============================================
# Test 6: Sort by price
# ============================================
test_endpoint \
    "Sort by Price" \
    "GET" \
    "/api/catalog/availability?slug=$ENCODED_SLUG&lat=$LAT&lng=$LNG&sortBy=price"

# ============================================
# Test 7: Sort by stock
# ============================================
test_endpoint \
    "Sort by Stock" \
    "GET" \
    "/api/catalog/availability?slug=$ENCODED_SLUG&lat=$LAT&lng=$LNG&sortBy=stock"

# ============================================
# Test 8: Batch availability (cart)
# ============================================
test_endpoint \
    "Batch Availability (Cart)" \
    "POST" \
    "/api/catalog/availability/batch" \
    "{\"items\":[{\"productSlug\":\"$PRODUCT_SLUG\",\"quantity\":1}],\"lat\":$LAT,\"lng\":$LNG}"

# ============================================
# Test 9: Invalid slug (error handling)
# ============================================
test_endpoint \
    "Invalid Slug (Error Handling)" \
    "GET" \
    "/api/catalog/availability?slug=invalid-product-12345"

# ============================================
# Test 10: Missing slug parameter
# ============================================
test_endpoint \
    "Missing Slug Parameter" \
    "GET" \
    "/api/catalog/availability"

echo "========================================"
echo "All tests completed!"
echo "========================================"
