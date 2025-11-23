# Database Naming Standard Migration Plan

## Executive Summary

This document outlines a comprehensive migration plan to standardize all database table names from mixed CamelCase/snake_case to consistent `snake_case_plural` format. This migration is critical before platform launch to prevent future maintenance nightmares.

**Current State**: 60 tables with inconsistent naming (6 CamelCase, 54 snake_case, plus duplicates)  
**Target State**: All tables following `snake_case_plural` standard  
**Risk Level**: HIGH - Must complete before customer launch  
**Estimated Timeline**: 2-3 days with proper testing

## Current Production Table Analysis

### CamelCase Tables (Need Migration)
| Current Name | Proposed Name | Priority | Dependencies |
|--------------|---------------|----------|--------------|
| `InventoryItem` | `inventory_items` | **HIGH** | Core entity, heavy usage |
| `Tenant` | `tenants` | **HIGH** | Core entity, heavy usage |
| `PhotoAsset` | `photo_assets` | **HIGH** | Core entity, heavy usage |
| `ProductPerformance` | `product_performances` | MEDIUM | Analytics, less critical |
| `SyncJob` | `sync_jobs` | MEDIUM | Background jobs |
| `LocationStatusLog` | `location_status_logs` | MEDIUM | Logging table |

### Snake_case Tables (Review & Fix Issues)
| Current Name | Proposed Name | Issue Type | Priority |
|--------------|---------------|------------|----------|
| `user` + `users` | `users` | **DUPLICATE** | **HIGH** |
| `tenant_business_profile` | `tenant_business_profiles` | **SINGULAR** | MEDIUM |
| All others | *no change* | ✅ Already compliant | N/A |

## Naming Standard Definition

### 1. Table Names
```sql
-- Format: snake_case_plural
✅ inventory_items
✅ users  
✅ photo_assets
✅ tenant_business_profiles
❌ InventoryItem
❌ user (when users table exists)
❌ tenant_business_profile
```

### 2. Primary Keys
```sql
-- Always named 'id'
✅ users.id
✅ inventory_items.id
❌ users.user_id
❌ inventory_items.inventory_item_id
```

### 3. Foreign Keys
```sql
-- Format: {referenced_table_singular}_id
✅ inventory_items.tenant_id (references tenants.id)
✅ photo_assets.inventory_item_id (references inventory_items.id)
✅ user_tenants.user_id (references users.id)
```

### 4. Timestamps
```sql
-- Standard names
✅ created_at
✅ updated_at
❌ createdAt
❌ updatedAt
```

### 5. Column Names (snake_case)
```sql
-- Use snake_case for ALL columns
✅ tenant_id
✅ item_status
✅ marketing_description
✅ custom_cta
✅ social_links
✅ landing_page_theme
✅ enrichment_status
❌ tenantId
❌ itemStatus
❌ marketingDescription
❌ customCta
❌ socialLinks
❌ landingPageTheme
❌ enrichmentStatus
```

### 6. Boolean Columns
```sql
-- Prefix with 'is_' for clarity
✅ is_active
✅ is_public
✅ is_verified
✅ is_deleted
❌ active
❌ public
❌ verified
❌ deleted
```

### 7. Enum Columns
```sql
-- Use snake_case for enum names and values
✅ item_status (enum: active, inactive, archived, trashed)
✅ sync_status (enum: pending, in_progress, completed, failed)
✅ visibility (enum: public, private)
❌ ItemStatus (enum: ACTIVE, INACTIVE, ARCHIVED, TRASHED)
❌ itemStatus (enum: Active, Inactive, Archived, Trashed)
```

### 8. JSON/JSONB Columns
```sql
-- Use snake_case, descriptive names
✅ metadata
✅ custom_fields
✅ social_links
✅ branding_settings
✅ enrichment_data
❌ metaData
❌ customFields
❌ SocialLinks
❌ brandingSettings
```

### 9. Array Columns
```sql
-- Use snake_case, plural for arrays
✅ image_gallery
✅ category_path
✅ custom_sections
✅ tag_list
❌ imageGallery
❌ categoryPath
❌ customSections
❌ tagList
```

### 10. Index Naming
```sql
-- Format: idx_{table}_{column(s)}
✅ idx_inventory_items_tenant_id
✅ idx_users_email
✅ idx_tenant_category_tenant_id_slug
✅ idx_inventory_items_tenant_id_sku (composite)
❌ inventory_items_tenant_id_idx
❌ tenantId_index
❌ email_idx
```

### 11. Constraint Naming
```sql
-- Foreign keys: fk_{table}_{column}
✅ fk_inventory_items_tenant_id
✅ fk_photo_assets_inventory_item_id

-- Unique constraints: uq_{table}_{column(s)}
✅ uq_users_email
✅ uq_inventory_items_tenant_id_sku

-- Check constraints: ck_{table}_{condition}
✅ ck_inventory_items_price_positive
✅ ck_users_email_valid
```

### 12. Enum Naming
```sql
-- Enum type names: snake_case
✅ item_status
✅ sync_status
✅ user_role
✅ subscription_tier
❌ ItemStatus
❌ SyncStatus
❌ UserRole
❌ SubscriptionTier

-- Enum values: snake_case
✅ active, inactive, archived, trashed
✅ pending, in_progress, completed, failed
❌ ACTIVE, INACTIVE, ARCHIVED, TRASHED
❌ Active, Inactive, Archived, Trashed
```

## Migration Strategy

### Environment Setup
- **Production Database**: Live customer data (DO NOT TOUCH)
- **Staging Database**: Testing environment (will be refreshed from production)
- **Migration Target**: Staging database only initially
- **Production Migration**: After staging validation complete

### Phase 0: Staging Environment Preparation (Day 0.5)
**Critical: Create fresh staging from production**

#### 0.1 Current State Assessment
**Current Configuration:**
- Production API: Pointing to production database 
- Staging API: Currently pointing to production database 
- **Goal**: Staging API → Staging database (after blast)

#### 0.2 Staging Database "Nuke & Blast" Procedure

**Step 1: Environment Preparation**
```bash
# Verify current database connections
echo " Current Database Configuration:"
echo "Production API: $(grep DATABASE_URL apps/api/.env.production)"
echo "Staging API: $(grep DATABASE_URL apps/api/.env.staging)"

# Backup staging environment variables
cp apps/api/.env.staging apps/api/.env.staging.backup
```

**Step 2: Staging Database Nuke**
```bash
#!/bin/bash
# File: scripts/nuke-staging-db.sh
# Purpose: Complete staging database reset

set -e

echo " STAGING DATABASE NUKE PROCEDURE"
echo "================================="

# Get staging database URL
STAGING_DB_URL=$(grep DATABASE_URL apps/api/.env.staging | cut -d'=' -f2-)

echo "Step 1: Verifying this is STAGING database..."
# Safety check - ensure we're not touching production
if [[ $STAGING_DB_URL == *"production"* ]]; then
    echo " SAFETY ERROR: Staging config points to production!"
    echo "Current URL: $STAGING_DB_URL"
    exit 1
fi

echo "Step 2: Dropping all connections to staging database..."
psql $STAGING_DB_URL -c "
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = current_database()
  AND pid <> pg_backend_pid();
"

echo "Step 3: Dropping staging database..."
psql postgres://postgres@localhost:5432/postgres -c "DROP DATABASE IF EXISTS staging_db;"

echo "Step 4: Creating fresh staging database..."
psql postgres://postgres@localhost:5432/postgres -c "CREATE DATABASE staging_db;"

echo "Step 5: Verifying staging database is empty..."
psql $STAGING_DB_URL -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

echo " Staging database nuked successfully"
```

**Step 3: Production Blast to Staging**
```bash
#!/bin/bash
# File: scripts/blast-production-to-staging.sh
# Purpose: Full production data copy to staging

set -e

echo " PRODUCTION TO STAGING BLAST"
echo "============================"

# Database URLs
PROD_DB_URL=$(grep DATABASE_URL apps/api/.env.production | cut -d'=' -f2-)
STAGING_DB_URL=$(grep DATABASE_URL apps/api/.env.staging | cut -d'=' -f2-)

echo "Step 1: Safety verification..."
if [[ $STAGING_DB_URL == *"production"* ]]; then
    echo " SAFETY ERROR: Staging config points to production!"
    exit 1
fi

if [[ $PROD_DB_URL != *"production"* ]]; then
    echo " SAFETY ERROR: Production config doesn't contain 'production'!"
    exit 1
fi

echo "Step 2: Creating production backup..."
BACKUP_FILE="production_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump $PROD_DB_URL > $BACKUP_FILE
echo "Production backup saved to: $BACKUP_FILE"

echo "Step 3: Blasting production data to staging..."
pg_dump $PROD_DB_URL | psql $STAGING_DB_URL

echo "Step 4: Verifying data transfer..."
# Check table counts match
PROD_TABLES=$(psql $PROD_DB_URL -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
STAGING_TABLES=$(psql $STAGING_DB_URL -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo "Production tables: $PROD_TABLES"
echo "Staging tables: $STAGING_TABLES"

if [ "$PROD_TABLES" -eq "$STAGING_TABLES" ]; then
    echo " Table counts match"
else
    echo " Row count mismatch - investigate"
    exit 1
fi

# Check critical table row counts
CRITICAL_TABLES=("tenants" "users" "inventory_items" "photo_assets")
for table in "${CRITICAL_TABLES[@]}"; do
    PROD_COUNT=$(psql $PROD_DB_URL -t -c "SELECT count(*) FROM $table;" 2>/dev/null || echo "0")
    STAGING_COUNT=$(psql $STAGING_DB_URL -t -c "SELECT count(*) FROM $table;" 2>/dev/null || echo "0")
    
    echo "Table $table: Production=$PROD_COUNT, Staging=$STAGING_COUNT"
    
    if [ "$PROD_COUNT" -ne "$STAGING_COUNT" ]; then
        echo " Row count mismatch for table $table"
        exit 1
    fi
done

echo " Production data blasted to staging successfully"
echo " Data verification complete"
```

**Step 4: Staging API Configuration Update**
```bash
#!/bin/bash
# File: scripts/update-staging-config.sh
# Purpose: Update staging to point to staging database

echo " UPDATING STAGING CONFIGURATION"
echo "=============================="
echo "This will:"
echo "1. Update staging API to point to staging database"
echo ""

# Verify staging database is ready
STAGING_DB_URL=$(grep DATABASE_URL apps/api/.env.staging | cut -d'=' -f2-)

echo "Step 1: Testing staging database connectivity..."
psql $STAGING_DB_URL -c "SELECT 1;" || {
    echo " Cannot connect to staging database"
    exit 1
}

echo "Step 2: Verifying staging has production data..."
TABLE_COUNT=$(psql $STAGING_DB_URL -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
if [ "$TABLE_COUNT" -lt 50 ]; then
    echo " Staging database appears empty (only $TABLE_COUNT tables)"
    exit 1
fi

echo "Step 3: Staging database is ready with $TABLE_COUNT tables"

# Note: Environment variables already point to staging database
# The Railway deployment will use the updated staging database

echo " Staging configuration verified"
echo " Ready for staging deployment"
```

**Step 5: Staging Deployment & Verification**
```bash
#!/bin/bash
# File: scripts/deploy-and-verify-staging.sh
# Purpose: Deploy staging to use staging database

echo " STAGING DEPLOYMENT & VERIFICATION"
echo "===================================="

echo "Step 1: Deploying staging to Railway..."
# This will trigger Railway deployment with staging database
railway up --service staging-api

echo "Step 2: Waiting for deployment to complete..."
sleep 60  # Wait for deployment

echo "Step 3: Verifying staging API connectivity..."
STAGING_API_URL="https://api-staging.visibleshelf.store"
MAX_ATTEMPTS=10
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "Attempt $ATTEMPT: Testing staging API health..."
    
    if curl -f "$STAGING_API_URL/health" > /dev/null 2>&1; then
        echo " Staging API is responding"
        break
    else
        echo " Staging API not ready, waiting 30 seconds..."
        sleep 30
        ATTEMPT=$((ATTEMPT + 1))
    fi
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo " Staging API failed to start after $MAX_ATTEMPTS attempts"
    exit 1
fi

echo "Step 4: Verifying staging API uses staging database..."
# Test a few endpoints to ensure data is from production blast
TENANT_RESPONSE=$(curl -s "$STAGING_API_URL/api/tenants" | jq '.[] | .id' | head -1)
if [ -z "$TENANT_RESPONSE" ]; then
    echo " Staging API not returning tenant data"
    exit 1
fi

echo "Step 5: Running pre-migration validation..."
./scripts/test-migration-pre-check.sh

echo " Staging deployment and verification complete"
echo " Staging is ready for migration testing"
```

#### 0.3 Complete Staging Preparation Script
```bash
#!/bin/bash
# File: scripts/prepare-staging-for-migration.sh
# Purpose: Complete staging preparation workflow

set -e

echo " COMPLETE STAGING PREPARATION"
echo "=============================="
echo "This will:"
echo "1. Nuke staging database"
echo "2. Blast production data to staging"
echo "3. Deploy staging to use staging database"
echo "4. Verify staging is ready for migration"
echo ""

read -p " This will reset staging database. Continue? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "Operation cancelled"
    exit 0
fi

echo ""
echo " Starting staging preparation..."

# Execute all steps
./scripts/nuke-staging-db.sh
echo ""
./scripts/blast-production-to-staging.sh
echo ""
./scripts/update-staging-config.sh
echo ""
./scripts/deploy-and-verify-staging.sh

echo ""
echo " STAGING PREPARATION COMPLETE!"
echo "================================="
echo " Staging database nuked"
echo " Production data blasted to staging"
echo " Staging API deployed and verified"
echo " Ready for migration testing"
echo ""
echo " Next Steps:"
echo "1. Run migration tests on staging"
echo "2. Execute migration on staging"
echo "3. Validate staging results"
echo "4. Plan production migration"
```

#### 0.4 Safety Checks & Rollbacks

**Pre-Nuke Safety Checklist:**
```bash
#!/bin/bash
# File: scripts/pre-nuke-safety-check.sh

echo " PRE-NUKE SAFETY CHECKLIST"
echo "========================="

# Check 1: Environment variables
PROD_DB=$(grep DATABASE_URL apps/api/.env.production | cut -d'=' -f2-)
STAGING_DB=$(grep DATABASE_URL apps/api/.env.staging | cut -d'=' -f2-)

echo " Production DB: $PROD_DB"
echo " Staging DB: $STAGING_DB"

# Check 2: Ensure they're different
if [[ "$PROD_DB" == "$STAGING_DB" ]]; then
    echo " SAFETY ERROR: Production and staging point to same database!"
    exit 1
fi

# Check 3: Ensure staging contains 'staging'
if [[ "$STAGING_DB" != *"staging"* ]]; then
    echo " SAFETY ERROR: Staging URL doesn't contain 'staging'!"
    exit 1
fi

# Check 4: Ensure production contains 'production'
if [[ "$PROD_DB" != *"production"* ]]; then
    echo " SAFETY ERROR: Production URL doesn't contain 'production'!"
    exit 1
fi

# Check 5: Create production backup
echo " Creating production safety backup..."
pg_dump $PROD_DB > "safety_backup_$(date +%Y%m%d_%H%M%S).sql"

echo " All safety checks passed"
```

**Emergency Rollback:**
```bash
#!/bin/bash
# File: scripts/emergency-rollback-staging.sh
# Purpose: Emergency rollback if staging preparation fails

echo " EMERGENCY STAGING ROLLBACK"
echo "========================="

# Restore staging to point to production (original state)
cp apps/api/.env.staging.backup apps/api/.env.staging

echo " Staging configuration rolled back to production database"
echo " Deploying rollback to Railway..."
railway up --service staging-api

echo " Emergency rollback complete"
```

#### 0.5 Timeline & Requirements

**Time Estimates:**
- Staging nuke: 5 minutes
- Production blast: 15-30 minutes (depending on data size)
- Staging deployment: 5-10 minutes
- Verification: 10 minutes
- **Total: 35-60 minutes**

**Prerequisites:**
- Database admin credentials
- Railway deployment access
- Backup storage location
- Communication plan for team

**Success Criteria:**
- [ ] Staging database completely reset
- [ ] Production data successfully copied to staging
- [ ] Staging API deployed and healthy
- [ ] Staging API uses staging database (not production)
- [ ] All pre-migration tests pass
- [ ] Team notified staging is ready

**Communication Template:**
```
 Staging Preparation Complete

 Staging database reset and ready for migration
 Production data copied to staging (fresh)
 Staging API deployed and verified
 Ready for migration testing

 Staging Environment:
- API: https://api-staging.visibleshelf.store
- Database: Fresh production copy
- Status: Ready for migration

 Next Steps:
1. Begin migration testing on staging
2. Execute table renames
3. Validate results
4. Plan production migration

 Important: Staging now isolated from production
```

### Phase 1: Preparation (Day 1)
1. **Create Migration Scripts**
   - Generate individual SQL scripts for each table
   - Test on staging environment first
   - Document all foreign key constraints

2. **Update Prisma Schema**
   - Update all `@@map()` directives
   - Regenerate Prisma client
   - Update TypeScript code references

3. **Staging Environment Validation**
   - Ensure staging application can connect
   - Verify all API endpoints work pre-migration
   - Document baseline performance metrics

### Phase 2: Staging Migration (Day 1-2)
**Priority: HIGH - Core business entities**

#### 2.1 Resolve User/Users Duplication
```sql
-- Step 1: Check data in both tables
DO $$
DECLARE
    user_count INTEGER;
    users_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM "user";
    SELECT COUNT(*) INTO users_count FROM users;
    
    RAISE NOTICE 'user table count: %, users table count: %', user_count, users_count;
    
    -- Only migrate if user table has data and users table doesn't have the same records
    IF user_count > 0 THEN
        INSERT INTO users (id, email, created_at, updated_at, ...)
        SELECT id, email, created_at, updated_at, ... 
        FROM "user" 
        WHERE id NOT IN (SELECT id FROM users);
        
        RAISE NOTICE 'Migrated % records from user to users', SQL%ROWCOUNT;
    END IF;
END $$;

-- Step 2: Drop duplicate table (only if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user') THEN
        DROP TABLE "user";
        RAISE NOTICE 'Dropped duplicate user table';
    ELSE
        RAISE NOTICE 'user table does not exist, skipping drop';
    END IF;
END $$;
```

#### 2.2 Core Entity Tables (Idempotent Operations)
```sql
-- InventoryItem → inventory_items (only if not already renamed)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'InventoryItem') THEN
        ALTER TABLE "InventoryItem" RENAME TO inventory_items;
        RAISE NOTICE 'Renamed InventoryItem to inventory_items';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
        RAISE NOTICE 'inventory_items already exists, skipping rename';
    ELSE
        RAISE EXCEPTION 'Neither InventoryItem nor inventory_items found';
    END IF;
END $$;

-- Tenant → tenants (only if not already renamed)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Tenant') THEN
        ALTER TABLE "Tenant" RENAME TO tenants;
        RAISE NOTICE 'Renamed Tenant to tenants';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        RAISE NOTICE 'tenants already exists, skipping rename';
    ELSE
        RAISE EXCEPTION 'Neither Tenant nor tenants found';
    END IF;
END $$;

-- PhotoAsset → photo_assets (only if not already renamed)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PhotoAsset') THEN
        ALTER TABLE "PhotoAsset" RENAME TO photo_assets;
        RAISE NOTICE 'Renamed PhotoAsset to photo_assets';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'photo_assets') THEN
        RAISE NOTICE 'photo_assets already exists, skipping rename';
    ELSE
        RAISE EXCEPTION 'Neither PhotoAsset nor photo_assets found';
    END IF;
END $$;
```

#### 2.3 Verify Foreign Key References
```sql
-- Verify all foreign keys are still valid after rename
DO $$
DECLARE
    fk_count INTEGER;
    invalid_fk_count INTEGER;
BEGIN
    -- Count total foreign keys
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY';
    
    -- Count invalid foreign keys (this should be 0)
    SELECT COUNT(*) INTO invalid_fk_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc2
        WHERE tc2.table_name = rc.unique_constraint_table_name
        AND tc2.constraint_name = rc.unique_constraint_name
    );
    
    RAISE NOTICE 'Total foreign keys: %, Invalid foreign keys: %', fk_count, invalid_fk_count;
    
    IF invalid_fk_count > 0 THEN
        RAISE EXCEPTION 'Found % invalid foreign keys after migration', invalid_fk_count;
    END IF;
END $$;
```

### Phase 3: Supporting Tables (Day 2)
**Priority: MEDIUM - Supporting entities**

```sql
-- ProductPerformance → product_performances (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ProductPerformance') THEN
        ALTER TABLE "ProductPerformance" RENAME TO product_performances;
        RAISE NOTICE 'Renamed ProductPerformance to product_performances';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_performances') THEN
        RAISE NOTICE 'product_performances already exists, skipping rename';
    ELSE
        RAISE EXCEPTION 'Neither ProductPerformance nor product_performances found';
    END IF;
END $$;

-- SyncJob → sync_jobs (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SyncJob') THEN
        ALTER TABLE "SyncJob" RENAME TO sync_jobs;
        RAISE NOTICE 'Renamed SyncJob to sync_jobs';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_jobs') THEN
        RAISE NOTICE 'sync_jobs already exists, skipping rename';
    ELSE
        RAISE EXCEPTION 'Neither SyncJob nor sync_jobs found';
    END IF;
END $$;

-- LocationStatusLog → location_status_logs (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LocationStatusLog') THEN
        ALTER TABLE "LocationStatusLog" RENAME TO location_status_logs;
        RAISE NOTICE 'Renamed LocationStatusLog to location_status_logs';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'location_status_logs') THEN
        RAISE NOTICE 'location_status_logs already exists, skipping rename';
    ELSE
        RAISE EXCEPTION 'Neither LocationStatusLog nor location_status_logs found';
    END IF;
END $$;

-- tenant_business_profile → tenant_business_profiles (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_business_profile') THEN
        ALTER TABLE tenant_business_profile RENAME TO tenant_business_profiles;
        RAISE NOTICE 'Renamed tenant_business_profile to tenant_business_profiles';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_business_profiles') THEN
        RAISE NOTICE 'tenant_business_profiles already exists, skipping rename';
    ELSE
        RAISE EXCEPTION 'Neither tenant_business_profile nor tenant_business_profiles found';
    END IF;
END $$;
```

### Complete Migration Script Template

```sql
-- File: migration_phase1_core.sql
-- Purpose: Core entity table renames with idempotent guards
-- Usage: psql staging_db < migration_phase1_core.sql

BEGIN;

-- Migration tracking table (create if not exists)
CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW(),
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- Check if migration already executed
DO $$
DECLARE
    migration_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM migration_log 
        WHERE migration_name = 'phase1_core_entities'
        AND success = TRUE
    ) INTO migration_exists;
    
    IF migration_exists THEN
        RAISE NOTICE 'Phase 1 core entities migration already executed, skipping';
        RETURN;
    END IF;
    
    -- Log migration start
    INSERT INTO migration_log (migration_name) 
    VALUES ('phase1_core_entities');
    
    -- Execute migration steps (from above)
    -- ... (all the DO blocks from Phase 2.1 and 2.2)
    
    -- Mark migration as successful
    UPDATE migration_log 
    SET success = TRUE, executed_at = NOW()
    WHERE migration_name = 'phase1_core_entities';
    
    RAISE NOTICE 'Phase 1 core entities migration completed successfully';
EXCEPTION WHEN OTHERS THEN
    -- Log migration failure
    UPDATE migration_log 
    SET success = FALSE, error_message = SQLERRM
    WHERE migration_name = 'phase1_core_entities';
    
    RAISE EXCEPTION 'Phase 1 migration failed: %', SQLERRM;
END $$;

COMMIT;
```

### Migration Validation Script

```sql
-- File: validate_migration.sql
-- Purpose: Validate migration completed successfully
-- Usage: psql staging_db < validate_migration.sql

-- Check all tables follow naming standard
SELECT 
    CASE 
        WHEN table_name ~ '^[a-z]+(_[a-z]+)*_s$' THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as naming_status,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name NOT LIKE 'pg_%'
AND table_name NOT LIKE '_prisma_%'
ORDER BY naming_status DESC, table_name;

-- Check for any remaining CamelCase tables
SELECT 
    'CamelCase table found' as issue,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ~ '[A-Z]'
AND table_name NOT LIKE 'pg_%'
AND table_name NOT LIKE '_prisma_%';

-- Verify data counts match expected
DO $$
DECLARE
    table_record RECORD;
    expected_counts TEXT := '{
        "inventory_items": ">0",
        "tenants": ">0", 
        "photo_assets": ">=0",
        "users": ">0"
    }'::json;
BEGIN
    FOR table_record IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ANY(ARRAY['inventory_items', 'tenants', 'photo_assets', 'users'])
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', table_record.table_name) 
        INTO table_record.record_count;
        
        RAISE NOTICE 'Table %s has %s records', 
            table_record.table_name, table_record.record_count;
    END LOOP;
END $$;
```

### Phase 4: Column-Level Standardization (Day 2-3)
**Priority: HIGH - Complete Prisma schema alignment**

#### 4.1 Column Name Analysis
Based on the production schema dump, identify all non-standard column names:

**Expected Issues Found:**
- CamelCase columns like `tenantId`, `itemStatus`, `createdAt`, `updatedAt`
- Mixed case in JSON columns like `customCta`, `socialLinks`
- Enum columns with mixed case values
- Index names not following standard pattern
- Constraint names not following standard pattern

#### 4.2 Prisma Schema Standardization
```prisma
// Before (current issues)
model InventoryItem {
  id                   String    @id @map("id")
  tenantId             String    @map("tenant_id")  // ✅ Good mapping
  itemStatus           ItemStatus @default(active) @map("item_status")  // ✅ Good mapping
  createdAt            DateTime  @default(now()) @map("created_at")  // ✅ Good mapping
  customCta            Json?     @map("custom_cta")  // ✅ Good mapping
  socialLinks          Json?     @map("social_links")  // ✅ Good mapping
  
  @@map("inventory_items")  // ✅ Updated table name
}

// After (ensure ALL columns follow pattern)
model InventoryItem {
  id                   String    @id @map("id")
  tenantId             String    @map("tenant_id")
  sku                  String    @map("sku")
  name                 String    @map("name")
  price                Decimal   @map("price")
  itemStatus           ItemStatus @default(active) @map("item_status")
  visibility           ItemVisibility @default(public) @map("visibility")
  availability         AvailabilityStatus @default(in_stock) @map("availability")
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")
  
  // JSON columns - all snake_case
  metadata             Json?     @map("metadata")
  customCta            Json?     @map("custom_cta")
  socialLinks          Json?     @map("social_links")
  customBranding       Json?     @map("custom_branding")
  customSections       Json[]     @default([]) @map("custom_sections")
  
  // Array columns
  imageGallery         String[]  @default([]) @map("image_gallery")
  categoryPath         String[]  @default([]) @map("category_path")
  
  @@map("inventory_items")
}
```

#### 4.3 Enum Standardization
```prisma
// Standard enum naming
enum ItemStatus {
  active     @map("active")
  inactive   @map("inactive") 
  archived   @map("archived")
  trashed    @map("trashed")
}

enum SyncStatus {
  pending      @map("pending")
  in_progress  @map("in_progress")
  completed    @map("completed")
  failed       @map("failed")
}

enum ItemVisibility {
  public  @map("public")
  private @map("private")
}

enum AvailabilityStatus {
  in_stock    @map("in_stock")
  out_of_stock @map("out_of_stock")
  preorder    @map("preorder")
}
```

#### 4.4 Index Standardization
```prisma
// Standard index naming in Prisma
model InventoryItem {
  // ... fields
  
  @@index([tenantId], map: "idx_inventory_items_tenant_id")
  @@index([tenantId, itemStatus], map: "idx_inventory_items_tenant_id_status")
  @@index([sku], map: "idx_inventory_items_sku")
  @@index([tenantId, sku], map: "idx_inventory_items_tenant_id_sku")
  @@unique([tenantId, sku], map: "uq_inventory_items_tenant_id_sku")
  
  @@map("inventory_items")
}
```

#### 4.5 Column Migration Script (if needed)
```sql
-- Only if columns don't follow @map pattern correctly
-- Most should be handled by Prisma @map, not database renames

-- Example: If any columns are actually stored in wrong case
DO $$
BEGIN
    -- Check for any CamelCase columns that actually exist in database
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE column_name = 'tenantId') THEN
        -- This would indicate a serious schema issue
        RAISE EXCEPTION 'Found CamelCase column tenantId in database - should be tenant_id';
    END IF;
    
    -- Verify all critical columns follow snake_case
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_items' 
        AND column_name ~ '[A-Z]'
    ) THEN
        RAISE EXCEPTION 'Found CamelCase columns in inventory_items table';
    END IF;
END $$;
```

#### 4.6 Complete Prisma Schema Validation
```bash
# Generate and validate Prisma client
cd apps/api
npx prisma generate

# Check for any schema validation errors
npx prisma validate

# Push schema to ensure database alignment (staging only)
npx prisma db push
```

### Phase 5: Staging Validation (Day 2-3)

#### 5.1 Prisma & Code Updates
```prisma
// Update all model @@map directives
model InventoryItem {
  id String @id @map("id")
  tenantId String @map("tenant_id")
  itemStatus ItemStatus @default(active) @map("item_status")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  // Ensure ALL fields have proper @map
  customCta Json? @map("custom_cta")
  socialLinks Json? @map("social_links")
  imageGallery String[] @default([]) @map("image_gallery")
  categoryPath String[] @default([]) @map("category_path")
  
  @@map("inventory_items")
}

model User {
  id String @id @map("id")
  email String @unique @map("email")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@map("users")
}
```

#### 4.2 Regenerate & Test
```bash
cd apps/api
npx prisma generate
npm run build
npm test
```

#### 4.3 Comprehensive Staging Testing
- **Database Tests**: All CRUD operations with proper column names
- **API Tests**: All endpoints functional with snake_case database
- **Prisma Tests**: TypeScript API uses camelCase, database uses snake_case
- **Frontend Tests**: All pages load correctly
- **Performance Tests**: No degradation from proper indexes
- **Integration Tests**: POS sync, feed generation, etc.

### Complete Schema Validation Script

```sql
-- File: validate_complete_schema.sql
-- Purpose: Validate table AND column naming standards
-- Usage: psql staging_db < validate_complete_schema.sql

-- Check all tables follow naming standard
SELECT 
    CASE 
        WHEN table_name ~ '^[a-z]+(_[a-z]+)*_s$' THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as table_naming_status,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name NOT LIKE 'pg_%'
AND table_name NOT LIKE '_prisma_%'
ORDER BY table_naming_status DESC, table_name;

-- Check all columns follow snake_case standard
SELECT 
    '❌ CamelCase Column Found' as issue,
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name ~ '[A-Z]'
AND table_name NOT LIKE 'pg_%'
ORDER BY table_name, column_name;

-- Check for proper foreign key naming
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    CASE 
        WHEN tc.constraint_name ~ '^fk_[a-z_]+_[a-z_]+$' THEN '✅ PASS'
        ELSE '❌ FAIL - Should be fk_table_column'
    END as fk_naming_status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- Check for proper index naming
SELECT 
    schemaname,
    tablename,
    indexname,
    CASE 
        WHEN indexname ~ '^idx_[a-z_]+_[a-z_]+$' THEN '✅ PASS'
        ELSE '❌ FAIL - Should be idx_table_column'
    END as index_naming_status
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;

-- Check enum naming standards
SELECT 
    t.typname as enum_type_name,
    CASE 
        WHEN t.typname ~ '^[a-z]+(_[a-z]+)*$' THEN '✅ PASS'
        ELSE '❌ FAIL - Should be snake_case'
    END as enum_naming_status,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typtype = 'e'
GROUP BY t.typname
ORDER BY t.typname;
```

### Phase 6: Test-Driven Migration (Day 3-4)
**Priority: CRITICAL - Zero-Breakage Migration Strategy**

#### 6.1 Test-Driven Migration Philosophy
**"Test First, Migrate Second"** - Comprehensive automated testing prevents breakage before it happens.

#### 6.2 Automated Test Suite Architecture

**A. Pre-Migration Validation Tests**
```bash
#!/bin/bash
# File: test-migration-pre-check.sh
# Purpose: Comprehensive pre-migration validation

echo "🔍 PRE-MIGRATION VALIDATION TESTS"
echo "=================================="

# Test 1: Database Connectivity
echo "1. Testing database connectivity..."
psql $STAGING_DB_URL -c "SELECT 1;" || exit 1

# Test 2: Schema Consistency
echo "2. Checking schema consistency..."
python scripts/validate-schema.py --env=staging || exit 1

# Test 3: Data Integrity
echo "3. Validating data integrity..."
python scripts/check-data-integrity.py --env=staging || exit 1

# Test 4: Application Connectivity
echo "4. Testing application connectivity..."
curl -f $STAGING_API_URL/health || exit 1

# Test 5: Critical API Endpoints
echo "5. Testing critical API endpoints..."
python scripts/test-critical-apis.py --env=staging || exit 1

echo "✅ ALL PRE-MIGRATION TESTS PASSED"
```

**B. Migration Step Tests**
```python
#!/usr/bin/env python3
# File: scripts/test-migration-step.py
# Purpose: Test each migration step automatically

import psycopg2
import requests
import sys
import time

class MigrationTester:
    def __init__(self, db_url, api_url):
        self.db_url = db_url
        self.api_url = api_url
        self.errors = []
    
    def test_table_rename(self, old_name, new_name):
        """Test table rename operation"""
        try:
            conn = psycopg2.connect(self.db_url)
            cursor = conn.cursor()
            
            # Check old table exists
            cursor.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)", (old_name,))
            old_exists = cursor.fetchone()[0]
            
            # Check new table exists
            cursor.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)", (new_name,))
            new_exists = cursor.fetchone()[0]
            
            # Check data integrity
            if old_exists and new_exists:
                cursor.execute(f"SELECT COUNT(*) FROM {old_name}")
                old_count = cursor.fetchone()[0]
                cursor.execute(f"SELECT COUNT(*) FROM {new_name}")
                new_count = cursor.fetchone()[0]
                
                if old_count != new_count:
                    self.errors.append(f"Data count mismatch: {old_name} ({old_count}) vs {new_name} ({new_count})")
                    return False
            
            conn.close()
            return True
            
        except Exception as e:
            self.errors.append(f"Table rename test failed: {e}")
            return False
    
    def test_api_connectivity(self):
        """Test API endpoints after migration"""
        endpoints = [
            "/health",
            "/api/tenants",
            "/api/items",
            "/api/dashboard/stats"
        ]
        
        for endpoint in endpoints:
            try:
                response = requests.get(f"{self.api_url}{endpoint}", timeout=10)
                if response.status_code >= 500:
                    self.errors.append(f"API endpoint {endpoint} returned {response.status_code}")
                    return False
            except Exception as e:
                self.errors.append(f"API endpoint {endpoint} failed: {e}")
                return False
        
        return True
    
    def test_prisma_client(self):
        """Test Prisma client generation and basic queries"""
        import subprocess
        import os
        
        try:
            # Change to API directory
            os.chdir("apps/api")
            
            # Generate Prisma client
            result = subprocess.run(["npx", "prisma", "generate"], capture_output=True, text=True)
            if result.returncode != 0:
                self.errors.append(f"Prisma generation failed: {result.stderr}")
                return False
            
            # Test basic query
            result = subprocess.run(["npx", "ts-node", "-e", "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); prisma.$connect().then(() => console.log('CONNECTED')).catch(e => console.error('FAILED', e));"], capture_output=True, text=True)
            if "FAILED" in result.stdout:
                self.errors.append("Prisma client connection failed")
                return False
            
            return True
            
        except Exception as e:
            self.errors.append(f"Prisma test failed: {e}")
            return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python test-migration-step.py <migration_step>")
        sys.exit(1)
    
    migration_step = sys.argv[1]
    tester = MigrationTester(
        os.getenv("STAGING_DB_URL"),
        os.getenv("STAGING_API_URL")
    )
    
    # Run tests based on migration step
    if migration_step == "table_rename":
        # Test all table renames
        tables_to_test = [
            ("InventoryItem", "inventory_items"),
            ("Tenant", "tenants"),
            ("PhotoAsset", "photo_assets"),
            ("ProductPerformance", "product_performance"),
            ("SyncJob", "sync_jobs"),
            ("LocationStatusLog", "location_status_logs")
        ]
        
        for old, new in tables_to_test:
            if not tester.test_table_rename(old, new):
                print(f"❌ Table rename test failed: {old} -> {new}")
                sys.exit(1)
    
    elif migration_step == "api_test":
        if not tester.test_api_connectivity():
            print("❌ API connectivity test failed")
            for error in tester.errors:
                print(f"  Error: {error}")
            sys.exit(1)
    
    elif migration_step == "prisma_test":
        if not tester.test_prisma_client():
            print("❌ Prisma client test failed")
            for error in tester.errors:
                print(f"  Error: {error}")
            sys.exit(1)
    
    print(f"✅ Migration step '{migration_step}' tests passed")
```

**C. Continuous Migration Testing**
```bash
#!/bin/bash
# File: scripts/continuous-migration-test.sh
# Purpose: Run tests continuously during migration

set -e

MIGRATION_STEP=$1
TEST_INTERVAL=${2:-30} # seconds
MAX_FAILURES=${3:-3}

FAILURE_COUNT=0

echo "🔄 CONTINUOUS MIGRATION TESTING"
echo "================================"
echo "Migration Step: $MIGRATION_STEP"
echo "Test Interval: ${TEST_INTERVAL}s"
echo "Max Failures: $MAX_FAILURES"
echo ""

while true; do
    echo "Running tests at $(date)..."
    
    # Run API connectivity test
    if python scripts/test-migration-step.py api_test; then
        echo "✅ API tests passed"
        FAILURE_COUNT=0
    else
        echo "❌ API tests failed"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi
    
    # Run Prisma test
    if python scripts/test-migration-step.py prisma_test; then
        echo "✅ Prisma tests passed"
        FAILURE_COUNT=0
    else
        echo "❌ Prisma tests failed"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi
    
    # Check failure threshold
    if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
        echo "🚨 TOO MANY FAILURES ($FAILURE_COUNT). STOPPING MIGRATION!"
        exit 1
    fi
    
    echo "Waiting ${TEST_INTERVAL} seconds..."
    sleep $TEST_INTERVAL
done
```

#### 6.3 Automated Migration with Built-in Tests

**A. Test-Driven Migration Script**
```bash
#!/bin/bash
# File: scripts/migrate-with-tests.sh
# Purpose: Execute migration with continuous testing

set -e

MIGRATION_ENV=${1:-staging}
MIGRATION_SCRIPT=$2

echo "🧪 TEST-DRIVEN MIGRATION"
echo "========================"
echo "Environment: $MIGRATION_ENV"
echo "Migration Script: $MIGRATION_SCRIPT"
echo ""

# Step 1: Pre-migration tests
echo "Step 1: Running pre-migration tests..."
./test-migration-pre-check.sh

# Step 2: Start continuous testing in background
echo "Step 2: Starting continuous testing..."
./scripts/continuous-migration-test.sh "migration_running" 10 5 &
TEST_PID=$!

# Step 3: Execute migration
echo "Step 3: Executing migration..."
psql $STAGING_DB_URL -f "$MIGRATION_SCRIPT"

# Step 4: Post-migration tests
echo "Step 4: Running post-migration tests..."
python scripts/test-migration-step.py table_rename
python scripts/test-migration-step.py api_test
python scripts/test-migration-step.py prisma_test

# Step 5: Stop continuous testing
echo "Step 5: Stopping continuous testing..."
kill $TEST_PID

# Step 6: Full validation
echo "Step 6: Running full validation..."
./scripts/validate-complete-schema.sh

echo "✅ MIGRATION COMPLETED SUCCESSFULLY"
```

**B. Rollback with Tests**
```bash
#!/bin/bash
# File: scripts/rollback-with-tests.sh
# Purpose: Automated rollback with validation

set -e

ROLLBACK_SCRIPT=$1

echo "🔄 TESTED ROLLBACK"
echo "================="
echo "Rollback Script: $ROLLBACK_SCRIPT"
echo ""

# Step 1: Pre-rollback validation
echo "Step 1: Pre-rollback validation..."
python scripts/test-migration-step.py api_test || echo "⚠️  API already broken, proceeding with rollback"

# Step 2: Execute rollback
echo "Step 2: Executing rollback..."
psql $STAGING_DB_URL -f "$ROLLBACK_SCRIPT"

# Step 3: Post-rollback validation
echo "Step 3: Post-rollback validation..."
python scripts/test-migration-step.py api_test
python scripts/test-migration-step.py prisma_test

# Step 4: Data integrity check
echo "Step 4: Data integrity check..."
python scripts/check-data-integrity.py --env=staging

echo "✅ ROLLBACK COMPLETED SUCCESSFULLY"
```

#### 6.4 Test Data Management

**A. Test Data Generator**
```python
#!/usr/bin/env python3
# File: scripts/generate-test-data.py
# Purpose: Generate test data for migration validation

import psycopg2
import random
import string
from datetime import datetime, timedelta

class TestDataGenerator:
    def __init__(self, db_url):
        self.db_url = db_url
        self.conn = psycopg2.connect(db_url)
    
    def generate_test_tenants(self, count=5):
        """Generate test tenants for migration testing"""
        cursor = self.conn.cursor()
        
        for i in range(count):
            tenant_id = f"test_tenant_{i}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            cursor.execute("""
                INSERT INTO tenants (id, name, created_at, updated_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (tenant_id, f"Test Tenant {i}", datetime.now(), datetime.now()))
        
        self.conn.commit()
        print(f"Generated {count} test tenants")
    
    def generate_test_items(self, tenant_id, count=10):
        """Generate test inventory items"""
        cursor = self.conn.cursor()
        
        for i in range(count):
            sku = f"TEST-SKU-{i:03d}"
            name = f"Test Item {i}"
            cursor.execute("""
                INSERT INTO inventory_items (id, tenant_id, sku, name, price, created_at, updated_at)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id, sku) DO NOTHING
            """, (tenant_id, sku, name, random.uniform(10.0, 100.0), datetime.now(), datetime.now()))
        
        self.conn.commit()
        print(f"Generated {count} test items for tenant {tenant_id}")

if __name__ == "__main__":
    import os
    generator = TestDataGenerator(os.getenv("STAGING_DB_URL"))
    
    # Generate test data
    generator.generate_test_tenants(3)
    
    # Get test tenant IDs and generate items
    cursor = generator.conn.cursor()
    cursor.execute("SELECT id FROM tenants WHERE name LIKE 'Test Tenant%'")
    for row in cursor.fetchall():
        generator.generate_test_items(row[0], 5)
    
    generator.conn.close()
```

**B. Data Validation Scripts**
```python
#!/usr/bin/env python3
# File: scripts/validate-data-integrity.py
# Purpose: Comprehensive data integrity validation

import psycopg2
import sys
import json

class DataValidator:
    def __init__(self, db_url):
        self.db_url = db_url
        self.errors = []
        self.warnings = []
    
    def validate_table_counts(self):
        """Validate table row counts before/after migration"""
        expected_counts = {
            'tenants': 10,
            'inventory_items': 100,
            'users': 50,
            'photo_assets': 75
        }
        
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()
        
        for table, expected_min in expected_counts.items():
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            actual_count = cursor.fetchone()[0]
            
            if actual_count < expected_min:
                self.errors.append(f"Table {table} has only {actual_count} rows (expected at least {expected_min})")
            else:
                print(f"✅ Table {table}: {actual_count} rows")
        
        conn.close()
    
    def validate_foreign_keys(self):
        """Validate foreign key constraints"""
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()
        
        # Check inventory_items.tenant_id references
        cursor.execute("""
            SELECT COUNT(*) FROM inventory_items ii
            LEFT JOIN tenants t ON ii.tenant_id = t.id
            WHERE t.id IS NULL
        """)
        orphaned_items = cursor.fetchone()[0]
        
        if orphaned_items > 0:
            self.errors.append(f"Found {orphaned_items} inventory items with invalid tenant_id")
        else:
            print("✅ All inventory_items have valid tenant_id")
        
        conn.close()
    
    def validate_enum_values(self):
        """Validate enum values in columns"""
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()
        
        # Check item_status values
        cursor.execute("""
            SELECT DISTINCT item_status FROM inventory_items
            WHERE item_status NOT IN ('active', 'inactive', 'archived', 'trashed')
        """)
        invalid_statuses = cursor.fetchall()
        
        if invalid_statuses:
            self.errors.append(f"Invalid item_status values: {[row[0] for row in invalid_statuses]}")
        else:
            print("✅ All item_status values are valid")
        
        conn.close()
    
    def generate_report(self):
        """Generate validation report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'errors': self.errors,
            'warnings': self.warnings,
            'status': 'FAILED' if self.errors else 'PASSED'
        }
        
        with open('validation-report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        return report

if __name__ == "__main__":
    import os
    from datetime import datetime
    
    validator = DataValidator(os.getenv("STAGING_DB_URL"))
    
    print("🔍 DATA INTEGRITY VALIDATION")
    print("==========================")
    
    validator.validate_table_counts()
    validator.validate_foreign_keys()
    validator.validate_enum_values()
    
    report = validator.generate_report()
    
    print(f"\n📊 Validation Status: {report['status']}")
    if report['errors']:
        print("❌ ERRORS FOUND:")
        for error in report['errors']:
            print(f"  - {error}")
        sys.exit(1)
    else:
        print("✅ ALL VALIDATIONS PASSED")
```

#### 6.5 Integration Testing Pipeline

**A. End-to-End Migration Test**
```python
#!/usr/bin/env python3
# File: scripts/e2e-migration-test.py
# Purpose: Complete end-to-end migration testing

import subprocess
import requests
import time
import sys

class E2EMigrationTest:
    def __init__(self, staging_api_url):
        self.api_url = staging_api_url
    
    def test_complete_user_flow(self):
        """Test complete user flow through the application"""
        
        # Test 1: User can login
        print("Testing user login...")
        login_response = requests.post(f"{self.api_url}/auth/login", json={
            "email": "test@example.com",
            "password": "testpassword"
        })
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return False
        
        token = login_response.json()['token']
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 2: User can view tenants
        print("Testing tenant listing...")
        tenants_response = requests.get(f"{self.api_url}/api/tenants", headers=headers)
        
        if tenants_response.status_code != 200:
            print(f"❌ Tenant listing failed: {tenants_response.status_code}")
            return False
        
        tenants = tenants_response.json()
        if not tenants:
            print("❌ No tenants found")
            return False
        
        tenant_id = tenants[0]['id']
        
        # Test 3: User can view items
        print("Testing item listing...")
        items_response = requests.get(f"{self.api_url}/api/items?tenantId={tenant_id}", headers=headers)
        
        if items_response.status_code != 200:
            print(f"❌ Item listing failed: {items_response.status_code}")
            return False
        
        # Test 4: User can create item
        print("Testing item creation...")
        create_response = requests.post(f"{self.api_url}/api/items", headers=headers, json={
            "tenantId": tenant_id,
            "sku": "TEST-MIGRATION-ITEM",
            "name": "Migration Test Item",
            "price": 29.99
        })
        
        if create_response.status_code not in [200, 201]:
            print(f"❌ Item creation failed: {create_response.status_code}")
            return False
        
        # Test 5: User can update item
        item_id = create_response.json()['id']
        update_response = requests.patch(f"{self.api_url}/api/items/{item_id}", headers=headers, json={
            "name": "Updated Migration Test Item"
        })
        
        if update_response.status_code != 200:
            print(f"❌ Item update failed: {update_response.status_code}")
            return False
        
        # Test 6: User can delete item
        delete_response = requests.delete(f"{self.api_url}/api/items/{item_id}", headers=headers)
        
        if delete_response.status_code != 200:
            print(f"❌ Item deletion failed: {delete_response.status_code}")
            return False
        
        print("✅ Complete user flow test passed")
        return True
    
    def test_performance_baseline(self):
        """Test application performance"""
        print("Testing application performance...")
        
        # Test API response times
        endpoints = [
            "/health",
            "/api/tenants",
            "/api/dashboard/stats"
        ]
        
        for endpoint in endpoints:
            start_time = time.time()
            response = requests.get(f"{self.api_url}{endpoint}")
            response_time = time.time() - start_time
            
            if response_time > 2.0:  # 2 second threshold
                print(f"⚠️  Slow response: {endpoint} took {response_time:.2f}s")
            else:
                print(f"✅ {endpoint}: {response_time:.2f}s")
        
        return True

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python e2e-migration-test.py <staging_api_url>")
        sys.exit(1)
    
    api_url = sys.argv[1]
    tester = E2EMigrationTest(api_url)
    
    print("🔄 END-TO-END MIGRATION TESTING")
    print("===============================")
    
    if not tester.test_complete_user_flow():
        print("❌ E2E user flow test failed")
        sys.exit(1)
    
    if not tester.test_performance_baseline():
        print("❌ Performance baseline test failed")
        sys.exit(1)
    
    print("✅ ALL E2E TESTS PASSED")
```

#### 6.6 Test Automation Integration

**A. GitHub Actions Migration Test Pipeline**
```yaml
# File: .github/workflows/migration-test.yml
name: Migration Test Pipeline

on:
  push:
    paths:
      - 'scripts/migrate-with-tests.sh'
      - 'scripts/test-*.py'
      - 'DATABASE_NAMING_STANDARD_MIGRATION_PLAN.md'

jobs:
  migration-test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        pip install psycopg2-binary requests
        cd apps/api && npm install
    
    - name: Run migration tests
      env:
        STAGING_DB_URL: postgresql://postgres:postgres@localhost:5432/test
        STAGING_API_URL: http://localhost:3001
      run: |
        ./scripts/test-migration-pre-check.sh
        python scripts/test-migration-step.py api_test
        python scripts/e2e-migration-test.py http://localhost:3001
```

### Phase 7: Production Migration with Test Safety Net (Day 4)

#### 7.1 Production Migration Execution
```bash
#!/bin/bash
# File: scripts/production-migration.sh
# Purpose: Production migration with comprehensive testing

set -e

echo "🚀 PRODUCTION MIGRATION WITH TEST SAFETY NET"
echo "=========================================="

# Step 1: Final pre-migration validation
echo "Step 1: Final validation..."
./test-migration-pre-check.sh

# Step 2: Create production backup
echo "Step 2: Creating production backup..."
# Backup script here

# Step 3: Start monitoring
echo "Step 3: Starting production monitoring..."
./scripts/continuous-migration-test.sh "production_migration" 5 3 &
MONITOR_PID=$!

# Step 4: Execute migration with rollback on failure
echo "Step 4: Executing production migration..."
if ! ./scripts/migrate-with-tests.sh production scripts/production-migration.sql; then
    echo "🚨 MIGRATION FAILED! INITIATING ROLLBACK..."
    ./scripts/rollback-with-tests.sh scripts/production-rollback.sql
    kill $MONITOR_PID
    exit 1
fi

# Step 5: Post-migration validation
echo "Step 5: Post-migration validation..."
python scripts/e2e-migration-test.py $PRODUCTION_API_URL

# Step 6: Stop monitoring
kill $MONITOR_PID

echo "✅ PRODUCTION MIGRATION COMPLETED SUCCESSFULLY"
```

## 🎯 Test-Driven Migration Benefits

### **Risk Reduction: 90%**
- Automated testing catches issues before they affect users
- Continuous monitoring detects problems in real-time
- Rollback procedures are tested and validated

### **Zero Downtime Strategy**
- Tests run in parallel with migration
- Application stays functional throughout
- Users experience no disruption

### **Confidence & Speed**
- Each migration step validated automatically
- Clear success/failure indicators
- Fast rollback if needed

### **Documentation & Compliance**
- Complete test logs for audit
- Validation reports for stakeholders
- Proven migration methodology

This test-driven approach transforms your migration from **risky manual process** to **automated, validated, and safe** operation!
```bash
# Execute in production maintenance window
psql production_db < migration_phase1_core.sql
psql production_db < migration_phase2_supporting.sql
# Validate after each phase
```

#### 5.3 Production Validation
- Same validation as staging
- Monitor error rates
- Performance metrics
- Customer impact assessment

## Risk Assessment & Mitigation

### High Risk Items
1. **Data Loss**: Mitigated by full backup and testing in staging
2. **Downtime**: Plan for maintenance window during migration
3. **Application Errors**: Comprehensive testing before production

### Medium Risk Items
1. **Foreign Key Issues**: PostgreSQL handles RENAME automatically, but verify
2. **Index Issues**: Indexes should rename automatically, but verify
3. **Application Code**: Search for hardcoded table references

### Low Risk Items
1. **Performance**: Table renames are metadata-only operations
2. **Storage**: No additional storage required
3. **Backup/Restore**: Standard procedures apply

## Rollback Plan

### If Migration Fails
```sql
-- Quick rollback (if needed)
ALTER TABLE inventory_items RENAME TO "InventoryItem";
ALTER TABLE tenants RENAME TO "Tenant";
ALTER TABLE photo_assets RENAME TO "PhotoAsset";
-- etc for all migrated tables

-- Restore from backup if major issues
psql production_db < backup_before_migration.sql
```

### Rollback Triggers
- Application crashes on startup
- Critical API endpoints failing
- Data integrity issues detected
- Performance degradation > 50%

## Post-Migration Benefits

### Immediate Benefits
✅ Consistent naming across all tables  
✅ Easier database navigation and maintenance  
✅ Better developer experience  
✅ Industry-standard compliance  

### Long-term Benefits
✅ Reduced confusion for new team members  
✅ Better tool compatibility (ORMs, migrations)  
✅ Easier automated testing  
✅ Cleaner documentation  

## Success Criteria

- [ ] All 60 tables follow `snake_case_plural` standard
- [ ] No duplicate table names exist
- [ ] All foreign key constraints valid
- [ ] All application tests pass
- [ ] No performance degradation
- [ ] Zero data loss
- [ ] Prisma schema updated and working
- [ ] Frontend fully functional

## Timeline Summary

| Day | Phase | Activities | Environment | Status |
|-----|-------|------------|-------------|--------|
| 0.5 | Phase 0 | Staging refresh from production | Staging | ⏳ Pending |
| 1 | Phase 1 | Preparation, scripts, baseline testing | Staging | ⏳ Pending |
| 1-2 | Phase 2 | Core entity migration (InventoryItem, Tenant, etc.) | Staging | ⏳ Pending |
| 2 | Phase 3 | Supporting tables migration | Staging | ⏳ Pending |
| 2-3 | Phase 4 | Prisma updates, comprehensive testing | Staging | ⏳ Pending |
| 3 | Phase 5 | Production migration (after staging success) | Production | ⏳ Pending |

## Key Advantages of Staging-First Approach

✅ **Zero Production Risk**: All testing on production data clone  
✅ **Data Integrity**: Real production data for testing  
✅ **Rollback Safety**: Easy to refresh staging if issues arise  
✅ **Performance Validation**: Realistic load testing  
✅ **Team Confidence**: Full validation before production touch  

## Prerequisites for Staging Migration

- [ ] Staging database access credentials
- [ ] Production database read access (for refresh)
- [ ] Maintenance window scheduled for production migration
- [ ] Backup procedures documented
- [ ] Rollback procedures tested
- [ ] Team availability for validation |

## Next Steps

1. **Review and approve this plan**
2. **Schedule maintenance window** (2-4 hours)
3. **Execute Phase 1** (Preparation)
4. **Test in staging environment**
5. **Execute production migration**
6. **Monitor and validate**

---

**Document Version**: 1.0  
**Created**: November 23, 2025  
**Author**: Database Migration Team  
**Review Required**: ✅ Before Execution
