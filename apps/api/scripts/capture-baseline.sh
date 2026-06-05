#!/bin/bash
# ============================================================================
# Capture Baseline Metrics Script
# Purpose: Capture comprehensive baseline metrics before migration
# Usage: ./scripts/capture-baseline.sh
# ============================================================================

OUTPUT_FILE="baseline-metrics-$(date +%Y%m%d-%H%M%S).txt"

echo "Capturing baseline metrics to $OUTPUT_FILE..."
echo ""

{
  echo "============================================================================"
  echo "DIRECTORY MATERIALIZED VIEWS - BASELINE METRICS"
  echo "============================================================================"
  echo "Date: $(date)"
  echo "Database: ${DATABASE_URL%%@*}@***" # Hide credentials
  echo ""
  
  # Run performance tests
  echo "============================================================================"
  echo "PERFORMANCE TESTS"
  echo "============================================================================"
  ./scripts/test-directory-performance.sh
  
  echo ""
  echo "============================================================================"
  echo "TABLE SIZES"
  echo "============================================================================"
  psql "$DATABASE_URL" -c "
    SELECT 
      tablename,
      pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size,
      pg_size_pretty(pg_relation_size('public.'||tablename)) AS table_size,
      pg_size_pretty(pg_total_relation_size('public.'||tablename) - pg_relation_size('public.'||tablename)) AS indexes_size
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('directory_listings_list', 'Tenant', 'inventory_items', 'tenant_business_profiles_list', 'tenant_categories_list')
    ORDER BY pg_total_relation_size('public.'||tablename) DESC;
  "
  
  echo ""
  echo "============================================================================"
  echo "ROW COUNTS"
  echo "============================================================================"
  psql "$DATABASE_URL" -c "
    SELECT 
      'directory_listings_list' as table_name,
      COUNT(*) as total_rows,
      COUNT(*) FILTER (WHERE is_published = true) as published_rows
    FROM directory_listings_list
    UNION ALL
    SELECT 
      'Tenant' as table_name,
      COUNT(*) as total_rows,
      COUNT(*) FILTER (WHERE location_status = 'active') as active_rows
    FROM \"Tenant\"
    UNION ALL
    SELECT 
      'inventory_items' as table_name,
      COUNT(*) as total_rows,
      COUNT(*) FILTER (WHERE item_status = 'active') as active_rows
    FROM inventory_items;
  "
  
  echo ""
  echo "============================================================================"
  echo "CATEGORY DISTRIBUTION"
  echo "============================================================================"
  psql "$DATABASE_URL" -c "
    SELECT 
      primary_category,
      COUNT(*) as listing_count,
      SUM(product_count) as total_products
    FROM directory_listings_list
    WHERE is_published = true
    GROUP BY primary_category
    ORDER BY listing_count DESC
    LIMIT 20;
  "
  
  echo ""
  echo "============================================================================"
  echo "INDEX INFORMATION"
  echo "============================================================================"
  psql "$DATABASE_URL" -c "
    SELECT 
      tablename,
      indexname,
      pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('directory_listings_list', 'Tenant')
    ORDER BY tablename, indexname;
  "
  
  echo ""
  echo "============================================================================"
  echo "DATABASE STATISTICS"
  echo "============================================================================"
  psql "$DATABASE_URL" -c "
    SELECT 
      schemaname,
      tablename,
      n_live_tup as live_rows,
      n_dead_tup as dead_rows,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze
    FROM pg_stat_user_tables
    WHERE tablename IN ('directory_listings_list', 'Tenant', 'inventory_items')
    ORDER BY tablename;
  "
  
  echo ""
  echo "============================================================================"
  echo "BASELINE CAPTURE COMPLETE"
  echo "============================================================================"
  echo "Saved to: $OUTPUT_FILE"
  echo ""
  
} | tee "$OUTPUT_FILE"

echo ""
echo "✅ Baseline metrics captured successfully!"
echo "📄 File: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "1. Review the baseline metrics"
echo "2. Commit this file to git: git add $OUTPUT_FILE"
echo "3. Proceed with Phase 2: Create materialized views"
