#!/bin/bash

set -e

echo "🔍 Comprehensive Audit: Triggers, Indexes, Functions"
echo "=================================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Auditing database objects between staging and production..."

echo ""
echo "🔍 1. TRIGGERS AUDIT"
echo "===================="

# Check triggers in staging vs production
echo "📊 Staging triggers:"
psql "$STAGING_DATABASE_URL" -c "
SELECT 
    event_object_table,
    trigger_name,
    action_timing,
    action_condition,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
"

echo ""
echo "📊 Production triggers:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT 
    event_object_table,
    trigger_name,
    action_timing,
    action_condition,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
"

echo ""
echo "📊 Missing triggers in production:"
psql "$STAGING_DATABASE_URL" -c "
SELECT 
    event_object_table,
    trigger_name,
    action_timing,
    action_condition,
    action_statement
FROM information_schema.triggers s
WHERE trigger_schema = 'public'
  AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.triggers p 
    WHERE p.trigger_schema = 'public' 
      AND p.event_object_table = s.event_object_table 
      AND p.trigger_name = s.trigger_name
  )
ORDER BY event_object_table, trigger_name;
"

echo ""
echo "🔍 2. INDEXES AUDIT"
echo "==================="

# Check indexes in staging vs production
echo "📊 Staging indexes count:"
psql "$STAGING_DATABASE_URL" -c "SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public';"

echo "📊 Production indexes count:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public';"

echo ""
echo "📊 Missing indexes in production:"
psql "$STAGING_DATABASE_URL" -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes s
WHERE schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_indexes p 
    WHERE p.schemaname = s.schemaname 
      AND p.tablename = s.tablename 
      AND p.indexname = s.indexname
  )
ORDER BY tablename, indexname;
"

echo ""
echo "🔍 3. FUNCTIONS AUDIT"
echo "===================="

# Check functions in staging vs production
echo "📊 Staging functions count:"
psql "$STAGING_DATABASE_URL" -c "SELECT COUNT(*) as total_functions FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';"

echo "📊 Production functions count:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as total_functions FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';"

echo ""
echo "📊 Missing functions in production:"
psql "$STAGING_DATABASE_URL" -c "
SELECT 
    routine_name,
    routine_type,
    data_type,
    external_language
FROM information_schema.routines s
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
  AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.routines p 
    WHERE p.routine_schema = 'public' 
      AND p.routine_type = s.routine_type 
      AND p.routine_name = s.routine_name
  )
ORDER BY routine_name;
"

echo ""
echo "🔍 4. CRITICAL FUNCTION DEFINITIONS"
echo "=================================="

# Check critical functions that are likely to be missing
echo "📊 Checking critical functions..."

CRITICAL_FUNCTIONS=(
    "update_product_slug"
    "sync_inventory_to_slug_registry_insert"
    "sync_inventory_to_slug_registry_update"
    "sync_inventory_to_slug_registry_delete"
    "refresh_directory_category_products"
    "update_effective_expiration"
    "update_tier_updated_at_column"
    "update_updated_at_column"
    "cleanup_expired_featured_products"
    "perform_security_alerts_maintenance"
    "purge_all_old_alerts"
)

for func in "${CRITICAL_FUNCTIONS[@]}"; do
  echo "🔍 Checking function: $func"
  
  staging_exists=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = '$func';" | tr -d ' ')
  production_exists=$(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = '$func';" | tr -d ' ')
  
  echo "   Staging: $staging_exists | Production: $production_exists"
  
  if [ "$production_exists" -eq 0 ] && [ "$staging_exists" -gt 0 ]; then
    echo "   🚨 MISSING IN PRODUCTION - Need to migrate!"
  fi
done

echo ""
echo "🔍 5. TABLE CONSTRAINTS AUDIT"
echo "=========================="

# Check foreign key constraints that might be missing
echo "📊 Missing foreign key constraints in production:"
psql "$STAGING_DATABASE_URL" -c "
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints ptc
    JOIN information_schema.key_column_usage pkcu
        ON ptc.constraint_name = pkcu.constraint_name
        AND ptc.table_schema = pkcu.table_schema
    JOIN information_schema.constraint_column_usage pccu
        ON pccu.constraint_name = ptc.constraint_name
        AND pccu.table_schema = ptc.table_schema
    WHERE ptc.constraint_type = 'FOREIGN KEY'
      AND ptc.table_schema = 'public'
      AND ptc.table_name = tc.table_name
      AND ptc.constraint_name = tc.constraint_name
      AND pkcu.column_name = kcu.column_name
      AND pccu.table_name = ccu.table_name
      AND pccu.column_name = ccu.column_name
  )
ORDER BY tc.table_name, tc.constraint_name;
"

echo ""
echo "🎯 Audit Summary"
echo "=============="
echo ""
echo "📊 Object Counts Comparison:"
echo "   Triggers: Staging vs Production"
echo "   Indexes: Staging vs Production"  
echo "   Functions: Staging vs Production"
echo "   Constraints: Staging vs Production"
echo ""
echo "🚨 Critical Issues Found:"
echo "   - Any missing triggers could break data integrity"
echo "   - Missing indexes could hurt performance"
echo "   - Missing functions could break application logic"
echo "   - Missing constraints could cause data corruption"
echo ""
echo "🚀 Next Steps:"
echo "   1. Review the audit results above"
echo "   2. Create migration scripts for missing objects"
echo "   3. Test critical functionality"
echo "   4. Verify application stability"
