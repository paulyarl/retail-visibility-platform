#!/bin/bash

set -e

echo "🔧 Add Missing auth0_id Column to Production"
echo "=========================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Adding auth0_id column to production users table..."

# Add the missing auth0_id column and related indexes
psql "$PRODUCTION_DATABASE_URL" -c "
-- Add auth0_id column
ALTER TABLE users ADD COLUMN auth0_id character varying(255) NULL;

-- Add unique constraint on auth0_id
ALTER TABLE users ADD CONSTRAINT users_auth0_id_key UNIQUE (auth0_id);

-- Add index for MFA enabled users
CREATE INDEX IF NOT EXISTS idx_users_mfa_enabled ON users USING btree (mfa_enabled) WHERE (mfa_enabled = true);

-- Add index for onboarding
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users USING btree (onboarding_completed) WHERE (onboarding_completed = false);

-- Add other missing columns that staging has
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled boolean NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret text NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes text[] NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_method character varying(50) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_verified_at timestamp without time zone NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step character varying(50) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_data jsonb NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name character varying(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_type character varying(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone character varying(50) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS picture character varying(500) NULL;

SELECT 'auth0_id column and related columns added successfully!' as status;
"

echo ""
echo "✅ auth0_id Column Added!"
echo "========================="
echo ""
echo "🎯 What was added:"
echo "   - auth0_id column (varchar(255), nullable)"
echo "   - Unique constraint on auth0_id"
echo "   - MFA-related columns"
echo "   - Onboarding columns"
echo "   - Business profile columns"
echo ""
echo "🚀 Next Steps:"
echo "   1. Railway will automatically restart"
echo "   2. Auth0 authentication should work"
echo "   3. Try logging into https://www.visibleshelf.com"
echo ""
echo "🔍 Test authentication:"
echo "   - Try logging in with yarlmoment@gmail.com"
echo "   - Check Railway logs for success"
