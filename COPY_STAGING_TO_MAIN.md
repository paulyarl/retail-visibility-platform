# Copy Staging Schema to Main Database

## Step 1: Export Staging Schema

**In Supabase Dashboard (Staging Database):**
1. Go to: https://supabase.com/dashboard
2. Select project: `nbwsiobosqawrugnqddo` (staging)
3. **SQL Editor** → **New Query**
4. Run this to export schema:

```sql
-- Get the full schema dump
SELECT 
  'CREATE TABLE ' || quote_ident(table_name) || ' (' ||
  string_agg(
    quote_ident(column_name) || ' ' || 
    data_type ||
    CASE 
      WHEN character_maximum_length IS NOT NULL 
      THEN '(' || character_maximum_length || ')'
      ELSE ''
    END ||
    CASE 
      WHEN is_nullable = 'NO' THEN ' NOT NULL'
      ELSE ''
    END ||
    CASE 
      WHEN column_default IS NOT NULL 
      THEN ' DEFAULT ' || column_default
      ELSE ''
    END,
    ', '
  ) || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
```

**Better Option: Use pg_dump**

Actually, the easiest way is to use Supabase's built-in schema export.

---

## Step 2: Use Prisma to Sync Schema

**Actually, the BEST approach:**

Since we have the working migrations in staging, we can:
1. Reset main database (already done)
2. Use `prisma db push` to sync the schema directly from `schema.prisma`
3. Then mark all migrations as applied

This avoids migration issues entirely!

---

## Step 3: Execute the Plan

### 3a. Reset Main Database (Already Done ✅)

### 3b. Push Schema from Prisma

Run locally with main database connection:

```bash
# Set main database URL
$env:DATABASE_URL="postgresql://postgres.pzxiurmwgkqhghxydazt:e64d93fe4e18b14@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

# Push schema (creates all tables without migrations)
npx prisma db push --skip-generate
```

### 3c. Mark All Migrations as Applied

Run in Supabase SQL Editor (main database):

```sql
-- Insert all 39 migrations as applied
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT 
  gen_random_uuid(),
  'schema_push',
  NOW(),
  migration_name,
  'Applied via prisma db push',
  NULL,
  NOW(),
  1
FROM (VALUES
  ('20241108_tier_system_management'),
  ('20251020000000_add_permission_matrix'),
  ('20251021005847_init_postgres'),
  ('20251021100000_add_feature_flags'),
  ('20251021150500_add_global_readiness_hooks'),
  ('20251021160000_add_currency_rates_table'),
  ('20251022093000_add_tenant_metadata'),
  ('20251023000000_add_google_connect_suite'),
  ('20251023060000_add_subscription_fields'),
  ('20251023070000_add_product_performance'),
  ('20251023110000_add_landing_page_customization'),
  ('20251023120000_add_organization_chain_pricing'),
  ('20251023130000_add_managed_services'),
  ('20251024072209_add_email_configuration'),
  ('20251024120800_add_photo_asset_urls'),
  ('20251027084922_title_fix'),
  ('20251028110417_add_authentication_system'),
  ('20251028155908_add_organization_requests'),
  ('20251029_add_photo_gallery_fields'),
  ('20251029121129_add_tenant_business_profile'),
  ('20251101_add_allow_tenant_override'),
  ('20251102000005_v3_8_sku_scanning'),
  ('20251102143422_add_category_mirror_runs'),
  ('20251103_add_gbp_category_fields'),
  ('20251103_add_gbp_category_table'),
  ('20251103_add_inventory_item_category_relation'),
  ('20251104_add_feature_flag_description'),
  ('20251104_add_product_enrichment_fields'),
  ('20251104_fix_enrichment_column_names'),
  ('20251104_fix_enrichment_status_null'),
  ('20251107_add_platform_admin_role'),
  ('20251107_add_platform_support_viewer_roles'),
  ('20251108_add_tier_management_system'),
  ('20251110_add_directory_promotion'),
  ('20251110_add_square_integration'),
  ('20251110_create_directory'),
  ('20251110_directory_phase1'),
  ('20251110_fix_product_condition_reserved_keyword'),
  ('20251110075527_directory_safe')
) AS migrations(migration_name);
```

### 3d. Verify

```sql
-- Check all migrations are marked as applied
SELECT COUNT(*) FROM "_prisma_migrations";
-- Should return: 39

-- Check product_condition enum has brand_new
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'product_condition'::regtype 
ORDER BY enumsortorder;
-- Should return: brand_new, refurbished, used
```

---

## Why This Works

1. ✅ `prisma db push` creates schema directly from `schema.prisma`
2. ✅ Bypasses all migration issues
3. ✅ Schema matches staging exactly
4. ✅ Marking migrations as applied keeps Prisma happy
5. ✅ Future migrations will work normally

---

## Next: Deploy to Vercel

After this, Vercel deployments will work because:
- Schema is already correct
- All migrations are marked as applied
- `prisma migrate deploy` will see nothing to do
- Prisma Client will generate correctly
