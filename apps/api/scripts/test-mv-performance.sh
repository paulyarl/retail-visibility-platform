#!/bin/bash
# ============================================================================
# Materialized View Performance Test Script
# Purpose: Test performance after materialized views are created
# Usage: ./scripts/test-mv-performance.sh
# ============================================================================

echo "=== Materialized View Performance Test ==="
echo "Testing optimized queries with materialized views..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  echo "Please set it with: export DATABASE_URL='your_connection_string'"
  exit 1
fi

# Check if materialized views exist
echo "Checking if materialized views exist..."
VIEW_COUNT=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM pg_matviews 
  WHERE matviewname IN ('directory_category_listings', 'directory_category_stats');
")

if [ "$VIEW_COUNT" -lt 2 ]; then
  echo "❌ ERROR: Materialized views not found!"
  echo "Please run migration 01_create_directory_materialized_views.sql first"
  exit 1
fi

echo "✅ Materialized views found"
echo ""

# Test 1: MV query performance
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 1] Materialized view query - Category filter (optimized)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
time psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM directory_category_listings
  WHERE category_slug = 'frozen-foods';
"

echo ""

# Test 2: MV stats query
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 2] Category stats from materialized view (optimized)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
time psql "$DATABASE_URL" -c "
  SELECT * FROM directory_category_stats
  WHERE category_slug = 'frozen-foods';
"

echo ""

# Test 3: Full category page from MV
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 3] Full category page from materialized view (optimized)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
time psql "$DATABASE_URL" -c "
  SELECT * FROM directory_category_listings
  WHERE category_slug = 'frozen-foods'
    AND tenant_exists = true
    AND is_active_location = true
    AND is_directory_visible = true
  ORDER BY rating_avg DESC NULLS LAST, product_count DESC NULLS LAST
  LIMIT 12;
"

echo ""

# Test 4: EXPLAIN ANALYZE for MV query
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 4] Query execution plan for MV (EXPLAIN ANALYZE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
  EXPLAIN ANALYZE
  SELECT * FROM directory_category_listings
  WHERE category_slug = 'frozen-foods'
    AND tenant_exists = true
    AND is_active_location = true
    AND is_directory_visible = true
  ORDER BY rating_avg DESC NULLS LAST, product_count DESC NULLS LAST
  LIMIT 12;
"

echo ""

# Test 5: Index usage
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 5] Index information for materialized views"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
  SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename LIKE 'directory_%mv'
  ORDER BY tablename, indexname;
"

echo ""

# Test 6: View sizes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 6] Materialized view sizes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
  SELECT 
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size('public.'||matviewname)) as total_size,
    pg_size_pretty(pg_relation_size('public.'||matviewname)) as view_size,
    pg_size_pretty(pg_total_relation_size('public.'||matviewname) - pg_relation_size('public.'||matviewname)) as indexes_size
  FROM pg_matviews
  WHERE schemaname = 'public'
    AND matviewname LIKE 'directory_%'
  ORDER BY matviewname;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "=== Performance comparison ==="
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Run the following to compare with baseline:"
echo "  ./scripts/test-directory-performance.sh"
echo ""
echo "Expected improvements:"
echo "  - Category filter: 10-50x faster"
echo "  - Category stats: 100-500x faster"
echo "  - Full page query: 10-25x faster"
