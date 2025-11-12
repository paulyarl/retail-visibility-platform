# Apply Missing `created_by` Migration to Production

## Problem
The `Tenant.created_by` column exists in the Prisma schema but hasn't been applied to the production database, causing login failures.

## Solution

### Option 1: Apply via Vercel Environment (Recommended)

1. **SSH into your Vercel deployment** or use Vercel's deployment logs
2. **Run the migration**:
   ```bash
   npx prisma migrate deploy
   ```

### Option 2: Apply Directly to Database

Connect to your production database and run:

```sql
-- Add createdBy column to Tenant table for auditing
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS "Tenant_created_by_idx" ON "Tenant"("created_by");

-- Add comment for documentation
COMMENT ON COLUMN "Tenant"."created_by" IS 'User ID who created this tenant (for auditing and PLATFORM_SUPPORT limits)';
```

### Option 3: Apply via Doppler + Local Connection

If you have Doppler configured with production credentials:

```bash
cd apps/api
doppler run --config prd -- npx prisma migrate deploy
```

## Verification

After applying the migration, verify it worked:

```sql
-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Tenant' AND column_name = 'created_by';

-- Should return:
-- column_name | data_type
-- created_by  | text
```

## Why This Happened

The migration file exists locally:
- `apps/api/prisma/migrations/20251111_add_created_by_to_tenant/migration.sql`

But it wasn't applied to production because:
1. The migration was created after the last deployment
2. Or `prisma migrate deploy` wasn't run during deployment
3. Or the deployment used `prisma db push` instead of `migrate deploy`

## Prevention

Ensure your Vercel build command includes:
```json
{
  "scripts": {
    "vercel-build": "prisma generate && prisma migrate deploy && tsc -p tsconfig.build.json --skipLibCheck"
  }
}
```

This ensures migrations are applied on every deployment.
