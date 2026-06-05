#!/bin/bash
# ============================================================================
# Directory Performance Test Script
# Purpose: Test current baseline performance of directory queries
# Usage: ./scripts/test-directory-performance.sh
# ============================================================================

echo "=== Directory Performance Test ==="
echo "Testing category page queries..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  echo "Please set it with: export DATABASE_URL='your_connection_string'"
  exit 1
fi

# Test 1: Current base table performance
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 1] Base table query - Category filter (current implementation)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
time psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM directory_listings_list
  WHERE (LOWER(primary_category) LIKE '%frozen-foods%' 
         OR LOWER(secondary_categories::text) LIKE '%frozen-foods%')
    AND is_published = true
    AND tenant_id IN (SELECT id FROM \"Tenant\" WHERE id IS NOT NULL);
"

echo ""

# Test 2: Category count aggregation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 2] Category stats aggregation (current implementation)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
time psql "$DATABASE_URL" -c "
  SELECT 
    primary_category,
    COUNT(DISTINCT tenant_id) as store_count,
    SUM(product_count) as total_products,
    AVG(rating_avg) as avg_rating
  FROM directory_listings_list
  WHERE is_published = true
  GROUP BY primary_category
  ORDER BY store_count DESC
  LIMIT 10;
"

echo ""

# Test 3: Full category page query
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 3] Full category page query (current implementation)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
time psql "$DATABASE_URL" -c "
  SELECT * FROM directory_listings_list
  WHERE (LOWER(primary_category) LIKE '%frozen-foods%' 
         OR LOWER(secondary_categories::text) LIKE '%frozen-foods%')
    AND is_published = true
    AND (business_hours IS NULL OR business_hours::text != 'null')
    AND tenant_id IN (SELECT id FROM \"Tenant\" WHERE id IS NOT NULL)
  ORDER BY rating_avg DESC NULLS LAST, product_count DESC NULLS LAST
  LIMIT 12;
"

echo ""

# Test 4: EXPLAIN ANALYZE for query plan
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 4] Query execution plan (EXPLAIN ANALYZE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
  EXPLAIN ANALYZE
  SELECT * FROM directory_listings_list
  WHERE (LOWER(primary_category) LIKE '%frozen-foods%' 
         OR LOWER(secondary_categories::text) LIKE '%frozen-foods%')
    AND is_published = true
    AND (business_hours IS NULL OR business_hours::text != 'null')
    AND tenant_id IN (SELECT id FROM \"Tenant\" WHERE id IS NOT NULL)
  ORDER BY rating_avg DESC NULLS LAST, product_count DESC NULLS LAST
  LIMIT 12;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "=== Baseline metrics captured ==="
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
