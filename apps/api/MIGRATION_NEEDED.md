# Migration Required

The following database migrations need to be run before certain features will work:

## 1. Add Google Sync Fields to Tenant

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

This will:
- Add `slug` field to Tenant
- Add `googleSyncEnabled` field to Tenant  
- Add `googleLastSync` field to Tenant
- Add `googleProductCount` field to Tenant
- Add `directoryVisible` field to Tenant
- Create indexes for these fields

## 2. Create Materialized View

After the Prisma migration, run the SQL migration manually:

```sql
-- See: apps/api/prisma/migrations/create_directory_category_stores_view/migration.sql
```

## 3. Account Deletion Requests Table

The account deletion requests functionality requires the `account_deletion_requests` table:

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

This will create the `account_deletion_requests` table with the following fields:
- `id` (UUID)
- `user_id` (UUID, foreign key to users)
- `reason` (TEXT, nullable)
- `status` (ENUM: pending, cancelled, completed)
- `requested_at` (TIMESTAMP)
- `scheduled_deletion_date` (TIMESTAMP)
- `cancelled_at` (TIMESTAMP, nullable)
- `completed_at` (TIMESTAMP, nullable)
- `ip_address` (TEXT, nullable)
- `admin_notes` (TEXT, nullable)
- `cancelled_by_admin` (BOOLEAN)

## Temporary Workaround

Until migrations run, the category directory service will have TypeScript errors because the Prisma client doesn't have the new fields yet. This is expected and will resolve after deployment.

## Deployment Order

1. Deploy schema changes (Prisma migrate)
2. Regenerate Prisma client (Prisma generate)
3. Deploy application code
4. Run materialized view SQL migration
5. Test category endpoints

## Testing After Migration

```bash
# Test categories endpoint
curl http://localhost:4000/api/directory/categories

# Test category stores endpoint  
curl http://localhost:4000/api/directory/categories/dairy-products/stores
```
