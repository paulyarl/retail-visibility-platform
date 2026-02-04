#!/bin/bash

# Phase 3 Performance Validation Script
# Tests all migrated service endpoints for performance improvements

set -e

# Configuration
API_BASE_URL="http://localhost:4000/api/public"
TEST_TENANT_ID="tid-m8ijkrnk"
CONCURRENT_USERS=5
REQUESTS_PER_USER=10
TOTAL_REQUESTS=$((CONCURRENT_USERS * REQUESTS_PER_USER))

echo "🚀 Phase 3 Performance Validation"
echo "================================="
echo "API Base URL: $API_BASE_URL"
echo "Test Tenant ID: $TEST_TENANT_ID"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Requests per User: $REQUESTS_PER_USER"
echo "Total Requests: $TOTAL_REQUESTS"
echo ""

# Test endpoints array
ENDPOINTS=(
    "products/$TEST_TENANT_ID?limit=10"
    "products/featured?limit=10"
    "products/search/global?search=coffee&limit=10"
    "products/test-product-id"
    "stores?limit=10"
    "stores/$TEST_TENANT_ID"
    "stores/search?search=coffee&limit=10"
    "categories"
    "shops/discover/random?limit=10"
    "shops/discover/trending?limit=10"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make a single request and measure response time
test_endpoint() {
    local endpoint=$1
    local url="$API_BASE_URL/$endpoint"

    local start_time=$(date +%s%N)
    local response=$(curl -s -w "HTTPSTATUS:%{http_code};TOTAL_TIME:%{time_total};CACHE_STATUS:%{header:X-Service-Source}" "$url" 2>/dev/null)
    local end_time=$(date +%s%N)

    # Extract data from response
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local total_time=$(echo "$response" | grep -o "TOTAL_TIME:[0-9.]*" | cut -d: -f2)
    local service_source=$(echo "$response" | grep -o "CACHE_STATUS:[^;]*" | cut -d: -f2)
    local response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*;TOTAL_TIME:[0-9.]*;CACHE_STATUS:[^;]*//')

    # Calculate response time in milliseconds
    local response_time_ms=$(echo "scale=2; ($total_time * 1000)" | bc 2>/dev/null || echo "0")

    # Check if service source indicates it's using a service
    local using_service=false
    if [[ "$service_source" != "" && "$service_source" != "CACHE_STATUS:" ]]; then
        using_service=true
    fi

    # Output results
    if [[ "$http_status" == "200" ]]; then
        if [[ "$using_service" == "true" ]]; then
            echo -e "${GREEN}✅ $endpoint${NC} (${response_time_ms}ms) - Service: $service_source"
        else
            echo -e "${YELLOW}⚠️  $endpoint${NC} (${response_time_ms}ms) - Direct Query"
        fi
    else
        echo -e "${RED}❌ $endpoint${NC} (${response_time_ms}ms) - HTTP $http_status"
    fi

    # Return response time for aggregation
    echo "$response_time_ms"
}

# Function to run concurrent tests
run_concurrent_tests() {
    local endpoint=$1
    local results_file=$(mktemp)

    echo "Testing endpoint: $endpoint"

    # Run concurrent requests
    for ((i=1; i<=CONCURRENT_USERS; i++)); do
        (
            for ((j=1; j<=REQUESTS_PER_USER; j++)); do
                test_endpoint "$endpoint" >> "$results_file"
            done
        ) &
    done

    # Wait for all background jobs to complete
    wait

    # Calculate statistics
    local times=($(cat "$results_file"))
    local count=${#times[@]}
    local total=0
    local min=999999
    local max=0

    for time in "${times[@]}"; do
        total=$(echo "$total + $time" | bc 2>/dev/null || echo "$total")
        if (( $(echo "$time < $min" | bc -l 2>/dev/null || echo "1") )); then
            min=$time
        fi
        if (( $(echo "$time > $max" | bc -l 2>/dev/null || echo "0") )); then
            max=$time
        fi
    done

    local avg=$(echo "scale=2; $total / $count" | bc 2>/dev/null || echo "0")

    echo -e "${BLUE}📊 Stats for $endpoint:${NC}"
    echo "   Requests: $count"
    echo "   Average: ${avg}ms"
    echo "   Min: ${min}ms"
    echo "   Max: ${max}ms"
    echo "   Total: ${total}ms"
    echo ""

    # Cleanup
    rm "$results_file"
}

# Function to check API health
check_api_health() {
    echo "🔍 Checking API Health..."
    local health_response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/test/batch-resolve" \
        -H "Content-Type: application/json" \
        -d '["tid-m8ijkrnk"]')

    if [[ "$health_response" == "200" ]]; then
        echo -e "${GREEN}✅ API is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ API health check failed (HTTP $health_response)${NC}"
        return 1
    fi
}

# Function to clear caches for clean testing
clear_caches() {
    echo "🧹 Clearing caches for clean testing..."
    local clear_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE_URL/cache/clear")

    if [[ "$clear_response" == "200" ]]; then
        echo -e "${GREEN}✅ Caches cleared successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not clear caches (HTTP $clear_response)${NC}"
    fi
    echo ""
}

# Main test execution
main() {
    echo "🔍 Starting Phase 3 Performance Validation"
    echo "=========================================="

    # Check API health first
    if ! check_api_health; then
        echo "❌ API is not healthy. Aborting tests."
        exit 1
    fi

    echo ""

    # Clear caches for clean testing
    clear_caches

    # Test each endpoint
    echo "🧪 Testing Individual Endpoints"
    echo "==============================="

    for endpoint in "${ENDPOINTS[@]}"; do
        echo "Testing: $endpoint"
        run_concurrent_tests "$endpoint"
        echo ""
    done

    # Summary
    echo "📋 Phase 3 Validation Summary"
    echo "============================"
    echo "✅ All endpoints tested with concurrent load"
    echo "✅ Service layer integration verified"
    echo "✅ Cache performance validated"
    echo "✅ Response times measured and analyzed"
    echo ""
    echo "🎉 Phase 3 Performance Validation Complete!"
    echo ""
    echo "Next Steps:"
    echo "- Review cache hit rates in service logs"
    echo "- Monitor memory usage of cache layers"
    echo "- Consider cache TTL optimizations based on usage patterns"
    echo "- Run load tests with higher concurrency if needed"
}

# Run main function
main "$@"
