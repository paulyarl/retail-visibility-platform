#!/bin/bash
# ============================================================================
# Trigger Testing Script
# Purpose: Test that triggers fire correctly and refresh materialized views
# Usage: ./scripts/test-triggers.sh
# ============================================================================

echo "=== Testing Directory Materialized View Triggers ==="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  echo "Please set it with: export DATABASE_URL='your_connection_string'"
  exit 1
fi

# Check if triggers exist
echo "Checking if triggers exist..."
TRIGGER_COUNT=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM information_schema.triggers
  WHERE trigger_name LIKE '%directory%';
")

if [ "$TRIGGER_COUNT" -lt 1 ]; then
  echo "❌ ERROR: Triggers not found!"
  echo "Please run migration 02_create_directory_triggers.sql first"
  exit 1
fi

echo "✅ Found $TRIGGER_COUNT directory triggers"
echo ""

# Get initial refresh count
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Setup] Getting initial refresh count..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
INITIAL_COUNT=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM directory_mv_refresh_log;
")
echo "Initial refresh log entries: $INITIAL_COUNT"
echo ""

# Test 1: Update directory_listings_list
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 1] Updating directory_listings_list..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
  UPDATE directory_listings_list
  SET updated_at = NOW()
  WHERE id = (SELECT id FROM directory_listings_list LIMIT 1)
  RETURNING id, business_name, updated_at;
"

echo ""
echo "Waiting 35 seconds for debounced refresh..."
echo "(Debounce interval is 30 seconds)"
for i in {35..1}; do
  echo -ne "  $i seconds remaining...\r"
  sleep 1
done
echo ""

# Check refresh log
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 1 Results] Checking refresh log..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
  SELECT 
    view_name,
    refresh_started_at,
    refresh_completed_at,
    refresh_duration_ms,
    rows_affected,
    triggered_by,
    status
  FROM directory_mv_refresh_log
  ORDER BY refresh_started_at DESC
  LIMIT 5;
"

echo ""

# Test 2: Update Tenant
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 2] Updating Tenant (should trigger refresh)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
  UPDATE \"Tenant\"
  SET directory_visible = directory_visible
  WHERE id = (SELECT id FROM \"Tenant\" LIMIT 1)
  RETURNING id, name, directory_visible;
"

echo ""
echo "Waiting 35 seconds for debounced refresh..."
for i in {35..1}; do
  echo -ne "  $i seconds remaining...\r"
  sleep 1
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 2 Results] Checking refresh log..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
  SELECT 
    view_name,
    refresh_started_at,
    refresh_completed_at,
    refresh_duration_ms,
    rows_affected,
    triggered_by,
    status
  FROM directory_mv_refresh_log
  ORDER BY refresh_started_at DESC
  LIMIT 5;
"

echo ""

# Test 3: Check debouncing works
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 3] Testing debouncing (rapid updates)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Making 3 rapid updates (should only trigger 1 refresh)..."

for i in {1..3}; do
  psql "$DATABASE_URL" -c "
    UPDATE directory_listings_list
    SET updated_at = NOW()
    WHERE id = (SELECT id FROM directory_listings_list LIMIT 1);
  " > /dev/null
  echo "  Update $i completed"
  sleep 2
done

echo ""
echo "Waiting 35 seconds to see if only 1 refresh occurred..."
for i in {35..1}; do
  echo -ne "  $i seconds remaining...\r"
  sleep 1
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Test 3 Results] Checking if debouncing worked..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
FINAL_COUNT=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM directory_mv_refresh_log;
")

NEW_REFRESHES=$((FINAL_COUNT - INITIAL_COUNT))
echo "New refresh log entries: $NEW_REFRESHES"
echo "Expected: 2-4 entries (2 views × 1-2 refresh cycles)"
echo ""

if [ "$NEW_REFRESHES" -le 8 ]; then
  echo "✅ Debouncing appears to be working correctly"
else
  echo "⚠️  Warning: More refreshes than expected. Debouncing may not be working."
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[Summary] Recent refresh activity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
  SELECT 
    view_name,
    COUNT(*) as refresh_count,
    AVG(refresh_duration_ms)::INTEGER as avg_duration_ms,
    MAX(refresh_duration_ms) as max_duration_ms,
    MIN(refresh_started_at) as first_refresh,
    MAX(refresh_completed_at) as last_refresh
  FROM directory_mv_refresh_log
  WHERE refresh_started_at > NOW() - INTERVAL '5 minutes'
  GROUP BY view_name
  ORDER BY view_name;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "=== Trigger Testing Complete ==="
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All tests completed"
echo ""
echo "Verification checklist:"
echo "  [ ] Triggers fired on data changes"
echo "  [ ] Refresh log captured all refreshes"
echo "  [ ] Debouncing prevented excessive refreshes"
echo "  [ ] Refresh duration is reasonable (<5 seconds)"
echo "  [ ] No errors in refresh log"
