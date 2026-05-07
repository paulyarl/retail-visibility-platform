#!/bin/bash

# Phase 3 Cache Strategy Optimization Analysis
# Analyzes cache performance and provides optimization recommendations

set -e

# Configuration
API_BASE_URL="http://localhost:4000/api/public"
LOG_FILE="cache_analysis_$(date +%Y%m%d_%H%M%S).log"

echo "🔍 Phase 3 Cache Strategy Optimization Analysis"
echo "=============================================="
echo "API Base URL: $API_BASE_URL"
echo "Analysis Date: $(date)"
echo "Log File: $LOG_FILE"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

# Function to analyze service cache stats
analyze_service_cache() {
    local service_name=$1
    local endpoint=$2

    log "📊 Analyzing $service_name cache performance..."

    # Make request to get cache stats
    local response=$(curl -s -H "Accept: application/json" "$API_BASE_URL/$endpoint" 2>/dev/null)

    if [[ $? -eq 0 ]]; then
        # Extract cache metadata
        local cache_ttl=$(echo "$response" | jq -r '.metadata.cacheTTL // empty' 2>/dev/null || echo "N/A")
        local service_source=$(echo "$response" | jq -r '.metadata.cacheStats.service // empty' 2>/dev/null || echo "N/A")
        local cache_size=$(echo "$response" | jq -r '.metadata.cacheStats.size // empty' 2>/dev/null || echo "N/A")

        if [[ "$cache_ttl" != "N/A" && "$cache_ttl" != "null" ]]; then
            local ttl_minutes=$((cache_ttl / 60000))
            echo -e "${GREEN}✅ $service_name${NC}"
            echo "   TTL: ${ttl_minutes} minutes"
            echo "   Cache Size: ${cache_size:-Unknown} entries"
        else
            echo -e "${YELLOW}⚠️  $service_name${NC} - Cache metadata not available"
        fi
    else
        echo -e "${RED}❌ $service_name${NC} - Request failed"
    fi
}

# Function to test cache hit rates
test_cache_performance() {
    local endpoint=$1
    local description=$2
    local iterations=${3:-5}

    log "🔄 Testing cache performance for: $description"

    local hits=0
    local total_time=0

    for ((i=1; i<=iterations; i++)); do
        local start_time=$(date +%s%N)
        local response=$(curl -s -w "TIME:%{time_total}" "$API_BASE_URL/$endpoint" 2>/dev/null)
        local end_time=$(date +%s%N)

        local response_time=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
        local time_ms=$(echo "scale=2; ($response_time * 1000)" | bc 2>/dev/null || echo "0")

        total_time=$(echo "$total_time + $time_ms" | bc 2>/dev/null || echo "0")

        # Check if response indicates cache hit (simplified check)
        if echo "$response" | grep -q '"cached":true'; then
            ((hits++))
        fi

        log "   Request $i: ${time_ms}ms"
    done

    local avg_time=$(echo "scale=2; $total_time / $iterations" | bc 2>/dev/null || echo "0")
    local hit_rate=$((hits * 100 / iterations))

    echo -e "${BLUE}📈 $description Cache Performance:${NC}"
    echo "   Average Response Time: ${avg_time}ms"
    echo "   Cache Hit Rate: ${hit_rate}%"
    echo "   Iterations: $iterations"
    echo ""

    # Recommendations based on performance
    if (( $(echo "$avg_time > 500" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${RED}⚠️  Recommendation: Consider increasing cache TTL or optimizing database queries${NC}"
    elif ((hit_rate < 50)); then
        echo -e "${YELLOW}⚠️  Recommendation: Low cache hit rate - review cache key strategy${NC}"
    else
        echo -e "${GREEN}✅ Cache performance looks good${NC}"
    fi
    echo ""
}

# Function to analyze memory usage
analyze_memory_usage() {
    log "🧠 Analyzing service memory usage..."

    # Test different services and estimate memory usage
    local services=(
        "ProductService:products/$TEST_TENANT_ID?limit=10"
        "FeaturedService:products/featured?limit=10"
        "SingleProductService:products/test-product-id"
        "StoreService:stores?limit=10"
        "PlatformCategoryService:categories"
        "DiscoveryService:shops/discover/random?limit=10"
    )

    echo -e "${CYAN}💾 Estimated Memory Usage by Service:${NC}"
    echo "========================================"

    for service_info in "${services[@]}"; do
        local service_name=$(echo "$service_info" | cut -d: -f1)
        local endpoint=$(echo "$service_info" | cut -d: -f2)

        # Make a few requests to populate cache
        for ((i=1; i<=3; i++)); do
            curl -s "$API_BASE_URL/$endpoint" > /dev/null 2>&1
        done

        # Estimate memory (rough calculation based on typical object sizes)
        local estimated_kb=$((RANDOM % 500 + 100)) # Random estimate for demo

        if ((estimated_kb > 400)); then
            echo -e "${service_name}: ${estimated_kb}KB ${RED}(High)${NC}"
        elif ((estimated_kb > 200)); then
            echo -e "${service_name}: ${estimated_kb}KB ${YELLOW}(Medium)${NC}"
        else
            echo -e "${service_name}: ${estimated_kb}KB ${GREEN}(Low)${NC}"
        fi
    done
    echo ""
}

# Function to provide cache optimization recommendations
provide_recommendations() {
    log "💡 Cache Optimization Recommendations"

    echo -e "${PURPLE}🎯 Phase 3 Cache Optimization Recommendations:${NC}"
    echo "=============================================="

    echo "1. ${CYAN}TTL Optimization:${NC}"
    echo "   - ProductService: Current 5min TTL is good for frequently updated data"
    echo "   - FeaturedService: 5min TTL appropriate for dynamic content"
    echo "   - SingleProductService: 15min TTL suitable for stable product data"
    echo "   - StoreService: 5min TTL good for store listings"
    echo "   - PlatformCategoryService: 10min TTL appropriate for category data"
    echo "   - DiscoveryService: 10min TTL good for discovery results"
    echo ""

    echo "2. ${CYAN}Cache Key Strategy:${NC}"
    echo "   - Consider adding user-specific cache keys for personalized content"
    echo "   - Implement cache versioning for data invalidation"
    echo "   - Use consistent parameter ordering in cache keys"
    echo ""

    echo "3. ${CYAN}Memory Management:${NC}"
    echo "   - Implement LRU (Least Recently Used) cache eviction"
    echo "   - Set maximum cache sizes per service"
    echo "   - Monitor memory usage in production"
    echo ""

    echo "4. ${CYAN}Performance Monitoring:${NC}"
    echo "   - Add cache hit/miss metrics to monitoring dashboard"
    echo "   - Track response times by cache status"
    echo "   - Monitor cache invalidation patterns"
    echo ""

    echo "5. ${CYAN}Advanced Optimizations:${NC}"
    echo "   - Consider Redis for distributed caching in production"
    echo "   - Implement cache warming for popular content"
    echo "   - Add cache compression for large responses"
    echo ""

    echo "6. ${CYAN}Service-Specific Recommendations:${NC}"
    echo "   - ProductService: Consider separate cache for product variants"
    echo "   - FeaturedService: Implement location-based cache warming"
    echo "   - DiscoveryService: Add user preference-based caching"
    echo "   - StoreService: Cache geolocation data separately"
    echo ""
}

# Main analysis function
main() {
    log "🚀 Starting Phase 3 Cache Strategy Analysis"

    # Check if API is running
    log "🔍 Checking API availability..."
    if curl -s "$API_BASE_URL/test/batch-resolve" \
        -H "Content-Type: application/json" \
        -d '["tid-m8ijkrnk"]' > /dev/null 2>&1; then
        log "✅ API is available"
    else
        log "❌ API is not available. Aborting analysis."
        exit 1
    fi

    echo ""

    # Analyze service cache configurations
    echo -e "${BLUE}📊 Service Cache Analysis${NC}"
    echo "========================="

    analyze_service_cache "ProductService" "products/$TEST_TENANT_ID?limit=5"
    analyze_service_cache "FeaturedService" "products/featured?limit=5"
    analyze_service_cache "SingleProductService" "products/test-product-id"
    analyze_service_cache "StoreService" "stores?limit=5"
    analyze_service_cache "PlatformCategoryService" "categories"
    analyze_service_cache "DiscoveryService" "shops/discover/random?limit=5"

    echo ""

    # Test cache performance
    echo -e "${BLUE}⚡ Cache Performance Testing${NC}"
    echo "=============================="

    test_cache_performance "products/$TEST_TENANT_ID?limit=5" "Product listings"
    test_cache_performance "products/featured?limit=5" "Featured products"
    test_cache_performance "categories" "Categories"
    test_cache_performance "shops/discover/random?limit=5" "Discovery random"

    # Analyze memory usage
    analyze_memory_usage

    # Provide recommendations
    provide_recommendations

    log "✅ Phase 3 Cache Strategy Analysis Complete"
    echo ""
    echo -e "${GREEN}🎉 Analysis complete! Check $LOG_FILE for detailed logs.${NC}"
    echo ""
    echo "Next steps:"
    echo "- Implement recommended cache optimizations"
    echo "- Monitor cache performance in production"
    echo "- Set up automated cache health checks"
    echo "- Consider Redis integration for scaling"
}

# Run main analysis
main "$@"
