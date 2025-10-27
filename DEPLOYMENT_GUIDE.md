# Database Deployment Guide

## Overview
This guide explains how to deploy database schema changes from your local environment to dev and production environments.

## Quick Start

### Deploy to Dev Environment
```bash
cd apps/api
pnpm db:push:dev
```

### Deploy to Production Environment
```bash
cd apps/api
pnpm db:push:prod
```

## Available Scripts

### Local Development
```bash
# Push schema changes to local database
pnpm db:push
```

### Dev Environment
```bash
# Push schema changes to dev database (uses Doppler dev config)
pnpm db:push:dev
```

### Production Environment
```bash
# Push schema changes to production database (uses Doppler prod config)
pnpm db:push:prod
```

## Step-by-Step Deployment

### 1. Verify Local Changes
Before deploying, make sure your local database is working correctly:

```bash
cd apps/api

# Check schema is valid
npx prisma validate

# View current schema
npx prisma format
```

### 2. Deploy to Dev
```bash
# Option A: Using npm script (recommended)
pnpm db:push:dev

# Option B: Manual with Doppler
doppler run --config dev -- npx prisma db push

# Option C: Manual with environment variable
DATABASE_URL="your-dev-database-url" npx prisma db push
```

### 3. Verify Dev Deployment
```bash
# Check tables exist
doppler run --config dev -- npx prisma studio

# Or connect directly
psql $DEV_DATABASE_URL -c "\dt"
```

### 4. Deploy to Production (After Testing)
```bash
# Deploy to production
pnpm db:push:prod

# Verify
doppler run --config prod -- npx prisma studio
```

## What Gets Deployed

Based on the current schema changes, the following will be created/updated:

### New Tables
```sql
-- upgrade_requests table
CREATE TABLE "upgrade_requests" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "business_name" TEXT NOT NULL,
  "current_tier" TEXT NOT NULL,
  "requested_tier" TEXT NOT NULL,
  "status" TEXT DEFAULT 'new' NOT NULL,
  "notes" TEXT,
  "admin_notes" TEXT,
  "processed_by" TEXT,
  "processed_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP NOT NULL
);

-- Indexes
CREATE INDEX "upgrade_requests_tenant_id_idx" ON "upgrade_requests"("tenant_id");
CREATE INDEX "upgrade_requests_status_idx" ON "upgrade_requests"("status");
CREATE INDEX "upgrade_requests_created_at_idx" ON "upgrade_requests"("created_at");
```

### Modified Tables
- None (all changes are additive)

## Doppler Configuration

### Setup Doppler (If Not Already Done)
```bash
# Install Doppler CLI
# Windows: scoop install doppler
# Mac: brew install doppler
# Linux: see https://docs.doppler.com/docs/install-cli

# Login
doppler login

# Setup project
cd apps/api
doppler setup

# Select project and config
# Project: retail-visibility-platform
# Config: local (for local dev)
```

### Available Configs
- `local` - Local development
- `dev` - Development environment
- `prod` - Production environment

### Switch Between Configs
```bash
# View current config
doppler configure get

# Switch to dev
doppler configure set config dev

# Switch to prod
doppler configure set config prod

# Switch back to local
doppler configure set config local
```

## Troubleshooting

### Issue: "Cannot connect to database"
**Solution:** Check your Doppler config and DATABASE_URL
```bash
# Verify Doppler config
doppler configure get

# Test connection
doppler run --config dev -- npx prisma db pull
```

### Issue: "Table already exists"
**Solution:** The table already exists in the target database. This is safe to ignore.

### Issue: "Migration conflicts"
**Solution:** We're using `db push` instead of migrations to avoid conflicts. This is fine for development.

### Issue: "Schema out of sync"
**Solution:** Pull the current schema and compare
```bash
# Pull current schema from dev
doppler run --config dev -- npx prisma db pull

# Compare with your local schema
git diff prisma/schema.prisma
```

## Best Practices

### 1. Always Test in Dev First
Never deploy directly to production without testing in dev:
```bash
# 1. Deploy to dev
pnpm db:push:dev

# 2. Test the application in dev
# Visit your dev URL and test features

# 3. If everything works, deploy to prod
pnpm db:push:prod
```

### 2. Backup Before Major Changes
```bash
# Backup production database before major schema changes
pg_dump $PROD_DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Use Transactions for Data Migrations
If you need to migrate data along with schema changes:
```sql
BEGIN;
  -- Schema changes
  ALTER TABLE ...;
  
  -- Data migrations
  UPDATE ...;
COMMIT;
```

### 4. Monitor After Deployment
After deploying to production:
- Check application logs
- Verify new features work
- Monitor database performance
- Check for errors in Sentry/logging service

## Rollback Strategy

### If Something Goes Wrong

#### Option 1: Restore from Backup
```bash
# Restore from backup
psql $PROD_DATABASE_URL < backup_20251026_200000.sql
```

#### Option 2: Revert Schema Changes
```bash
# Checkout previous schema
git checkout HEAD~1 apps/api/prisma/schema.prisma

# Push old schema
pnpm db:push:prod
```

#### Option 3: Manual Rollback
```sql
-- Drop the new table
DROP TABLE "upgrade_requests";
```

## Verification Checklist

After deployment, verify:

- [ ] Tables created successfully
- [ ] Indexes created
- [ ] Application starts without errors
- [ ] New features work correctly
- [ ] Existing features still work
- [ ] No performance degradation
- [ ] Logs show no errors

## Production Deployment Checklist

Before deploying to production:

- [ ] Tested in dev environment
- [ ] Code reviewed and approved
- [ ] Database backup created
- [ ] Rollback plan prepared
- [ ] Team notified of deployment
- [ ] Monitoring tools ready
- [ ] Off-peak hours scheduled (if applicable)

## Automated Deployment (Future)

### CI/CD Pipeline
```yaml
# .github/workflows/deploy-db.yml
name: Deploy Database Changes

on:
  push:
    branches: [main]
    paths:
      - 'apps/api/prisma/schema.prisma'

jobs:
  deploy-dev:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Dev
        run: |
          cd apps/api
          pnpm db:push:dev
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_DEV_TOKEN }}
  
  deploy-prod:
    needs: deploy-dev
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Production
        run: |
          cd apps/api
          pnpm db:push:prod
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_PROD_TOKEN }}
```

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review Prisma logs: `npx prisma db push --help`
3. Check Doppler configuration: `doppler configure get`
4. Verify database connection: `psql $DATABASE_URL -c "SELECT 1"`

## Related Documentation

- [Prisma Documentation](https://www.prisma.io/docs)
- [Doppler Documentation](https://docs.doppler.com)
- [UPGRADE_REQUEST_SYSTEM.md](./UPGRADE_REQUEST_SYSTEM.md)

## Changelog

### 2025-10-26
- Initial deployment guide created
- Added upgrade_requests table deployment
- Added Doppler integration scripts
- Added verification and rollback procedures
