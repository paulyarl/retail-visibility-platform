# v3.5 Implementation - Next Steps

## Current Status

✅ **Database Layer (100%)**
- All migrations applied to production
- Audit log table with enhanced tracking
- Policy versioning with temporal support
- Real-time counters with NOTIFY/LISTEN
- Observability views for monitoring

✅ **Prisma Schema (100%)**
- Updated with v3.5 models (AuditLog, SkuBillingPolicy, SkuBillingPolicyHistory)
- Added 3 new enums (ActorType, EntityType, AuditAction)
- Ready for client generation

⚠️ **API Layer (50%)**
- Route files created (Hono format)
- Need to convert to Express format
- Need to generate Prisma client
- Need to wire up in main app

## Immediate Actions Required

### 1. Generate Prisma Client

```bash
cd apps/api
npx prisma generate
```

This will:
- Generate types for new models (AuditLog, SkuBillingPolicy, etc.)
- Fix TypeScript errors in existing code
- Enable querying new tables

### 2. Convert Routes to Express

The route files in `src/routes/` are currently in Hono format. Need to convert to Express:

**Files to convert:**
- `src/routes/audit.ts` → `src/routes/audit-express.ts`
- `src/routes/policy.ts` → `src/routes/policy-express.ts`
- `src/routes/billing.ts` → `src/routes/billing-express.ts`
- `src/middleware/audit.ts` → `src/middleware/audit-express.ts`

**Conversion pattern:**
```typescript
// Hono format
import { Hono } from 'hono';
const app = new Hono();
app.get('/path', async (c) => {
  return c.json(data);
});

// Express format
import { Router } from 'express';
const router = Router();
router.get('/path', async (req, res) => {
  res.json(data);
});
export default router;
```

### 3. Uncomment Route Imports

In `src/index.ts`, uncomment lines 42-45 and 883-890 after creating Express route files.

### 4. Test Endpoints

```bash
# Start dev server
pnpm dev

# Test audit endpoint
curl http://localhost:4000/admin/audit

# Test billing counters
curl http://localhost:4000/tenant/billing/counters
```

### 5. Deploy

```bash
git add .
git commit -m "feat(api): complete v3.5 API integration"
git push origin spec-sync
```

## Alternative: Quick Start (Skip Route Conversion)

If you want to deploy immediately without the new APIs:

1. **Comment out v3.5 route imports** in `src/index.ts` (lines 42-45, 883-890)
2. **Generate Prisma client**: `npx prisma generate`
3. **Deploy**: The database features are ready, APIs can be added later

## Files Created

### Database
- ✅ `apps/api/prisma/migrations/v3.5/001_audit_log_enhancements_fixed.sql`
- ✅ `apps/api/prisma/migrations/v3.5/002_policy_versioning.sql`
- ✅ `apps/api/prisma/migrations/v3.5/003_effective_policy_view_v2.sql`
- ✅ `apps/api/prisma/migrations/v3.5/004_tier_automation_enhancements.sql`
- ✅ `apps/api/prisma/migrations/v3.5/005_observability_helpers.sql`

### Schema
- ✅ `apps/api/prisma/schema.prisma` (updated with v3.5 models)

### API (Hono format - needs conversion)
- ⚠️ `apps/api/src/routes/audit.ts`
- ⚠️ `apps/api/src/routes/policy.ts`
- ⚠️ `apps/api/src/routes/billing.ts`
- ⚠️ `apps/api/src/middleware/audit.ts`

### Documentation
- ✅ `apps/api/V3.5_API_IMPLEMENTATION.md`
- ✅ `apps/api/prisma/migrations/v3.5/README.md`

## What Works Right Now

Even without the API routes, you can:

1. **Query audit logs directly**:
   ```sql
   SELECT * FROM audit_log ORDER BY occurred_at DESC LIMIT 10;
   ```

2. **Check SKU counters**:
   ```sql
   SELECT * FROM tenant_sku_counters;
   ```

3. **View policy history**:
   ```sql
   SELECT * FROM sku_billing_policy_history;
   ```

4. **Monitor tier status**:
   ```sql
   SELECT * FROM tenant_tier_status;
   ```

5. **Check feed quality**:
   ```sql
   SELECT * FROM swis_feed_quality_report;
   ```

## Recommended Path Forward

**Option A: Full Implementation (2-3 hours)**
1. Convert routes to Express
2. Add auth middleware
3. Test all endpoints
4. Deploy with full v3.5 API

**Option B: Quick Deploy (30 minutes)**
1. Comment out route imports
2. Generate Prisma client
3. Deploy database features only
4. Add APIs in next sprint

**Option C: Hybrid (1 hour)**
1. Generate Prisma client
2. Create one Express route (billing counters)
3. Deploy with partial API
4. Add remaining routes incrementally

## Success Criteria

- [ ] Prisma client generated successfully
- [ ] No TypeScript errors
- [ ] API server starts without errors
- [ ] At least one v3.5 endpoint working
- [ ] Deployed to Railway

## Support

If you encounter issues:
1. Check `apps/api/V3.5_API_IMPLEMENTATION.md` for API details
2. Check `apps/api/prisma/migrations/v3.5/README.md` for database details
3. Run `SELECT * FROM audit_log` to verify database is working
