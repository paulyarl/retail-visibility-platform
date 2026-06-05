#!/bin/bash

set -e

echo "🔧 Replace Production Users with Staging Users"
echo "============================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Replacing production users table with staging data..."

# Drop and recreate users table from staging
psql "$PRODUCTION_DATABASE_URL" -c "
-- Drop the existing production users table
DROP TABLE IF EXISTS users CASCADE;

-- Disable constraints and triggers for import
SET session_replication_role = replica;
"

echo "✅ Production users table dropped"

# Export and import the complete users table from staging
echo "📦 Exporting users table from staging..."
pg_dump "$STAGING_DATABASE_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --table=users \
  --file=users_schema.sql

echo "✅ Users schema exported"

# Import schema to production
echo "📦 Importing users schema to production..."
psql "$PRODUCTION_DATABASE_URL" -f users_schema.sql

echo "✅ Users schema imported"

# Export data from staging
echo "📦 Exporting users data from staging..."
psql "$STAGING_DATABASE_URL" -c "COPY (SELECT * FROM users) TO STDOUT WITH CSV HEADER" | \
psql "$PRODUCTION_DATABASE_URL" -c "COPY users FROM STDIN WITH CSV HEADER"

echo "✅ Users data imported"

# Reset sequences
echo "📦 Resetting user sequences..."
psql "$PRODUCTION_DATABASE_URL" -c "
-- Reset sequences if any exist
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id)::integer, 1), MAX(id) IS NOT NULL) FROM users WHERE pg_get_serial_sequence('users', 'id') IS NOT NULL;

-- Re-enable constraints and triggers
SET session_replication_role = DEFAULT;

SELECT 'Users table replaced successfully!' as status;
"

# Clean up
rm -f users_schema.sql

echo ""
echo "✅ Users Table Replacement Complete!"
echo "=================================="
echo ""
echo "🎯 What was done:"
echo "   - Dropped production users table"
echo "   - Imported complete users schema from staging"
echo "   - Imported all users data from staging"
echo "   - Includes auth0_id, MFA, onboarding, business columns"
echo ""
echo "👥 Users imported:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT email, role, auth0_id IS NOT NULL as has_auth0 FROM users ORDER BY created_at;"

echo ""
echo "🚀 Next Steps:"
echo "   1. Railway will automatically restart"
echo "   2. Auth0 authentication should work"
echo "   3. Try logging into https://www.visibleshelf.com"
echo ""
echo "🔍 Test authentication:"
echo "   - Try logging in with yarlmoment@gmail.com"
echo "   - Try logging in with niftytek@gmail.com"
echo "   - Check Railway logs for success"
