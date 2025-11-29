#!/bin/bash
# ============================================================================
# Category Normalization - Phase 1 & 2 Execution Script
# Purpose: Run foundation migrations (non-breaking)
# ============================================================================

set -e  # Exit on error

echo "🚀 Category Normalization - Phase 1 & 2"
echo "========================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "   Run with: doppler run -- ./scripts/run-category-normalization-phase1.sh"
    exit 1
fi

# Safety check - confirm this is not production
echo "⚠️  SAFETY CHECK"
echo "Database URL: ${DATABASE_URL:0:50}..."
echo ""
read -p "Is this the STAGING/LOCAL database? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted by user"
    exit 1
fi

echo ""
echo "📋 Phase 1: Creating Platform Category Tables"
echo "=============================================="

# Clean DATABASE_URL for psql (remove pgbouncer parameter)
CLEAN_DB_URL=$(echo "$DATABASE_URL" | sed 's/[?&]pgbouncer=true//g' | sed 's/[?&]connection_limit=[0-9]*//g' | sed 's/[?&]pool_timeout=[0-9]*//g')

psql "$CLEAN_DB_URL" -f prisma/manual_migrations/04_create_platform_categories.sql

echo ""
echo "📋 Phase 2: Seeding Initial Categories"
echo "======================================="
psql "$CLEAN_DB_URL" -f prisma/manual_migrations/05_seed_platform_categories.sql

echo ""
echo "✅ Phase 1 & 2 Complete!"
echo "======================="
echo ""
echo "📊 Summary:"
echo "  - ✅ platform_categories table created"
echo "  - ✅ directory_listing_categories table created"
echo "  - ✅ 10 indexes created"
echo "  - ✅ 12 initial categories seeded"
echo ""
echo "⏭️  Next Steps:"
echo "  1. Verify tables: SELECT * FROM platform_categories;"
echo "  2. Check indexes: \\d platform_categories"
echo "  3. Proceed to Phase 3 when ready (data migration)"
echo ""
