# Staging to Main Migration Plan

**Date:** November 7, 2025  
**Current Branch:** `staging` (active development)  
**Target Branch:** `main` (production)  
**Migration Type:** Safe database migration + environment variables + code merge

---

## 🎯 Overview

This plan covers:
1. **Database Migration** - Safe migration from staging to production database
2. **Environment Variables** - New variables introduced in staging
3. **Code Merge** - Merging `staging` branch to `main`
4. **Deployment** - Railway + Vercel deployment updates
5. **Verification** - Post-migration testing

---

## 📊 Current State Analysis

### Branches
- **`staging`**: Active development branch with latest features (currently active)
- **`main`**: Production branch (target for migration)

### Deployments
- **Railway API**: Currently deploys from `staging`
- **Vercel Web**: Currently deploys from `staging`

### Database Migrations (30 total)
Latest migrations in `staging` branch:
```
20251104_fix_enrichment_status_null
20251104_fix_enrichment_column_names
20251104_add_product_enrichment_fields
20251104_add_feature_flag_description
20251103_add_inventory_item_category_relation
20251103_add_gbp_category_table
20251103_add_gbp_category_fields
20251102143422_add_category_mirror_runs
20251102000005_v3_8_sku_scanning
20251101_add_allow_tenant_override
... (20 more migrations)
```

---

## 🆕 New Environment Variables in Staging

### Railway (API) - New Variables
```bash
# Google Maps API (for storefront)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...

# OAuth Encryption (if not already set)
OAUTH_ENCRYPTION_KEY=64_character_hex_string

# Google My Business (GMB/GBP) OAuth - SEPARATE from Merchant API
GOOGLE_BUSINESS_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_BUSINESS_REDIRECT_URI=https://your-api.railway.app/google-business/callback

# Google Merchant Center OAuth (existing)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=https://your-api.railway.app/google/callback

# Feature Flags (optional, but recommended)
FF_GLOBAL_TENANT_META=false
FF_AUDIT_LOG=false
FF_I18N_SCAFFOLD=false
FF_CURRENCY_RATE_STUB=false

# Storage Buckets (optional, defaults exist)
BUCKET_NAME=photos
TENANT_BUCKET_NAME=tenants
BRAND_BUCKET_NAME=brands
PUBLIC_FLAG=true
TENANT_PUBLIC_FLAG=true
BRAND_PUBLIC_FLAG=true
```

### Vercel (Web) - New Variables
```bash
# Google Maps API (CRITICAL for storefront)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
```

### Existing Variables (Verify These Exist)
**Railway:**
- `DATABASE_URL` ✅
- `SUPABASE_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `GOOGLE_CLIENT_ID` ✅
- `GOOGLE_CLIENT_SECRET` ✅
- `GOOGLE_REDIRECT_URI` ✅
- `WEB_URL` ✅
- `NODE_ENV` ✅ (auto-set)
- `PORT` ✅ (auto-set)

**Vercel:**
- `NEXT_PUBLIC_API_BASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅

---

## 🗄️ Database Migration Strategy

### Option 1: Prisma Migrate Deploy (Recommended)

**Pros:**
- ✅ Safe, incremental migrations
- ✅ Tracks migration history
- ✅ Rollback capability
- ✅ No data loss

**Cons:**
- ⚠️ Requires downtime (5-10 minutes)
- ⚠️ Must run in sequence

**Steps:**
1. Backup production database
2. Run `prisma migrate deploy` on production
3. Verify schema matches
4. Test critical queries

---

### Option 2: Manual SQL Migration (Alternative)

**Pros:**
- ✅ More control
- ✅ Can review each migration

**Cons:**
- ⚠️ More manual work
- ⚠️ Higher risk of errors

**Steps:**
1. Backup production database
2. Generate SQL from each migration
3. Review and test SQL
4. Apply to production

---

### Recommended: Option 1 (Prisma Migrate Deploy)

---

## 📋 Pre-Migration Checklist

### 1. Backup Production Database

**Supabase Backup:**
```bash
# Via Supabase Dashboard
1. Go to Database → Backups
2. Click "Create Backup"
3. Wait for completion
4. Download backup (optional)
```

**Alternative: pg_dump**
```bash
# If you have direct database access
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

### 2. Verify Staging Database State

```bash
# In apps/api directory
cd apps/api

# Check current migration status
npx prisma migrate status

# Expected output:
# Database schema is up to date!
# 30 migrations found in prisma/migrations
```

---

### 3. Document Current Production State

**Check production database:**
```sql
-- Count tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- Count migrations applied
SELECT COUNT(*) FROM _prisma_migrations;

-- Check last migration
SELECT migration_name, finished_at 
FROM _prisma_migrations 
ORDER BY finished_at DESC 
LIMIT 1;
```

---

### 4. Create Migration Rollback Plan

**Rollback Steps:**
1. Restore from Supabase backup
2. Redeploy previous Railway commit
3. Redeploy previous Vercel commit
4. Verify production is stable

---

## 🚀 Migration Execution Plan

### Phase 1: Environment Variables (No Downtime)

**Step 1: Create Production OAuth Credentials**

⚠️ **IMPORTANT:** Create NEW credentials for production (don't reuse dev)

**Google Cloud Console:**
1. Create new project: "RVP Production"
2. Enable APIs: Content API, My Business API
3. Create OAuth credentials for Merchant Center:
   - Redirect URI: `https://rvpapi-production.up.railway.app/google/callback`
4. Create OAuth credentials for GMB:
   - Redirect URI: `https://rvpapi-production.up.railway.app/google-business/callback`
5. Configure OAuth consent screen (Production mode)

**See:** `OAUTH_CREDENTIALS_STRATEGY.md` for detailed setup

---

**Step 2: Add New Variables to Railway**

```bash
# Via Railway Dashboard → Variables
1. Go to Railway project
2. Click "Variables" tab
3. Add new variables:

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...

# NEW Production OAuth Credentials
GOOGLE_CLIENT_ID=prod-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-prod-xxxxx
GOOGLE_REDIRECT_URI=https://rvpapi-production.up.railway.app/google/callback

GOOGLE_BUSINESS_CLIENT_ID=prod-yyyyy.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=GOCSPX-prod-yyyyy
GOOGLE_BUSINESS_REDIRECT_URI=https://rvpapi-production.up.railway.app/google-business/callback

# NEW Production Encryption Key
OAUTH_ENCRYPTION_KEY=<generate new for production>

# Feature Flags
FF_GLOBAL_TENANT_META=false
FF_AUDIT_LOG=false
```

**Generate NEW Production Encryption Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

⚠️ **Do NOT reuse dev encryption key in production!**

**Step 2: Add New Variables to Vercel**

```bash
# Via Vercel Dashboard → Settings → Environment Variables
1. Go to Vercel project
2. Click "Settings" → "Environment Variables"
3. Add:

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...

4. Select environments: Production, Preview, Development
5. Save
```

**Step 3: Verify Variables**

```bash
# Check Railway
railway variables

# Check Vercel
vercel env ls
```

---

### Phase 2: Code Merge (No Downtime)

**Step 1: Prepare Main Branch**

```bash
# Switch to main
git checkout main

# Pull latest
git pull origin main

# Check status
git status
```

**Step 2: Merge Staging to Main**

```bash
# Merge staging into main
git merge staging

# If conflicts, resolve them
# Review changes carefully

# Push to main
git push origin main
```

**Step 3: Update CI/CD**

The CI/CD pipeline will automatically:
- Run tests on main branch
- Build Railway API
- Build Vercel Web

---

### Phase 3: Database Migration (5-10 Min Downtime)

**⚠️ CRITICAL: This step requires downtime**

**Step 1: Enable Maintenance Mode (Optional)**

```bash
# Create maintenance page on Vercel
# Or display banner: "System maintenance in progress"
```

**Step 2: Run Database Migration**

```bash
# SSH into Railway or use Railway CLI
railway run bash

# Navigate to API directory
cd apps/api

# Check migration status
npx prisma migrate status

# Deploy migrations
npx prisma migrate deploy

# Expected output:
# Applying migration `20251020000000_add_permission_matrix`
# Applying migration `20251021005847_init_postgres`
# ... (30 migrations)
# The following migration(s) have been applied:
# ✔ All migrations applied successfully
```

**Step 3: Verify Schema**

```bash
# Check schema matches
npx prisma db pull

# Compare with schema.prisma
# Should show: "No changes detected"
```

**Step 4: Test Critical Queries**

```sql
-- Test tenant query
SELECT COUNT(*) FROM "Tenant";

-- Test inventory query
SELECT COUNT(*) FROM "InventoryItem";

-- Test user query
SELECT COUNT(*) FROM "users";

-- Test feature flags
SELECT * FROM "platform_feature_flags" LIMIT 5;

-- Test new tables
SELECT COUNT(*) FROM "GBPCategory";
SELECT COUNT(*) FROM "ScanTemplate";
SELECT COUNT(*) FROM "BarcodeLookupLog";
```

---

### Phase 4: Deployment (Auto)

**Railway will automatically:**
1. Detect push to main
2. Build new Docker image
3. Deploy to production
4. Run health checks

**Vercel will automatically:**
1. Detect push to main
2. Build Next.js app
3. Deploy to production
4. Run edge functions

**Monitor Deployments:**
```bash
# Railway
railway logs --tail

# Vercel
vercel logs --follow
```

---

### Phase 5: Verification

**Step 1: Health Checks**

```bash
# API Health
curl https://rvpapi-production.up.railway.app/health

# Expected: {"status":"ok"}

# Web Health
curl https://retail-visibility-platform-web.vercel.app/api/health

# Expected: {"status":"ok"}
```

**Step 2: Authentication Test**

1. Go to `/login`
2. Request magic link
3. Click link in email
4. Verify redirect to `/tenants`
5. Check user is authenticated

**Step 3: Database Operations Test**

1. Create a new tenant
2. Add an item to tenant
3. Upload a photo
4. Verify photo displays
5. Delete item
6. Verify deletion

**Step 4: Feature Flags Test**

1. Go to `/settings/admin/features` (as admin)
2. Toggle a feature flag
3. Verify flag updates
4. Check tenant-level override

**Step 5: Storefront Test**

1. Go to `/tenant/[tenant-id]` (public storefront)
2. Verify map displays (Google Maps)
3. Verify products load
4. Check business hours display

**Step 6: Google OAuth Test**

1. Go to Settings → Integrations
2. Click "Connect Google"
3. Complete OAuth flow
4. Verify connection saved

---

## 🔄 Rollback Procedure

**If migration fails:**

### Step 1: Restore Database

```bash
# Via Supabase Dashboard
1. Go to Database → Backups
2. Select pre-migration backup
3. Click "Restore"
4. Wait for completion (5-10 min)
```

### Step 2: Revert Code

```bash
# Revert main branch
git revert HEAD

# Or reset to previous commit
git reset --hard <previous-commit-hash>

# Force push
git push origin main --force
```

### Step 3: Verify Rollback

```bash
# Check Railway deployment
railway logs

# Check Vercel deployment
vercel logs

# Test health endpoints
curl https://rvpapi-production.up.railway.app/health
```

---

## 📊 Migration Timeline

| Phase | Duration | Downtime | Risk |
|-------|----------|----------|------|
| **Phase 1: Env Variables** | 15 min | None | Low |
| **Phase 2: Code Merge** | 10 min | None | Low |
| **Phase 3: Database Migration** | 5-10 min | ⚠️ Yes | Medium |
| **Phase 4: Deployment** | 5-10 min | Partial | Low |
| **Phase 5: Verification** | 15 min | None | Low |
| **Total** | **50-60 min** | **5-10 min** | **Medium** |

---

## 🎯 Success Criteria

✅ All 30 migrations applied successfully  
✅ No database errors in logs  
✅ All environment variables set  
✅ Railway API deployed from main  
✅ Vercel Web deployed from main  
✅ Authentication works  
✅ CRUD operations work  
✅ Photo uploads work  
✅ Storefront displays correctly  
✅ Google Maps loads  
✅ Feature flags work  
✅ No errors in production logs  

---

## 🚨 Risk Assessment

### High Risk Items

1. **Database Migration**
   - Risk: Schema mismatch, data loss
   - Mitigation: Backup, test in staging first
   - Rollback: Restore from backup

2. **Environment Variables**
   - Risk: Missing variables, wrong values
   - Mitigation: Document all variables, verify before deploy
   - Rollback: Update variables, redeploy

3. **Code Conflicts**
   - Risk: Merge conflicts, breaking changes
   - Mitigation: Review all changes, test locally
   - Rollback: Revert commit

### Medium Risk Items

1. **Deployment Timing**
   - Risk: Downtime during business hours
   - Mitigation: Schedule during off-hours
   - Rollback: Quick rollback procedure

2. **Feature Flag State**
   - Risk: Flags in wrong state
   - Mitigation: Document expected state
   - Rollback: Toggle flags back

### Low Risk Items

1. **CI/CD Pipeline**
   - Risk: Build failures
   - Mitigation: Tests run before merge
   - Rollback: Redeploy previous build

---

## 📝 Post-Migration Tasks

### Immediate (Within 1 Hour)

- [ ] Monitor error logs (Railway + Vercel)
- [ ] Check database connection pool
- [ ] Verify all API endpoints respond
- [ ] Test critical user flows
- [ ] Check Supabase storage access

### Short-term (Within 24 Hours)

- [ ] Monitor performance metrics
- [ ] Check for any user-reported issues
- [ ] Verify scheduled jobs run
- [ ] Review audit logs
- [ ] Update documentation

### Long-term (Within 1 Week)

- [ ] Analyze migration performance
- [ ] Document lessons learned
- [ ] Update runbooks
- [ ] Plan next migration
- [ ] Archive staging branch (optional)

---

## 🔗 Related Documentation

- `ENVIRONMENT_VARIABLES.md` - Complete variable reference
- `DEPLOYMENT_CHECKLIST.md` - Deployment procedures
- `SUPABASE_PROJECT_DESIGN.md` - Database architecture
- `SUPABASE_BILLING_FINAL.md` - Cost implications

---

## 📞 Emergency Contacts

**If migration fails:**
1. Check Railway logs: `railway logs --tail`
2. Check Vercel logs: `vercel logs --follow`
3. Check Supabase logs: Dashboard → Logs
4. Restore from backup (see Rollback Procedure)

---

## 🎯 Recommended Migration Window

**Best Time:** Saturday or Sunday, 2:00 AM - 4:00 AM (low traffic)

**Reason:**
- Minimal user impact
- Time to troubleshoot if issues arise
- Can rollback without affecting business hours

---

## ✅ Pre-Migration Approval

**Before proceeding, confirm:**

- [ ] Backup created and verified
- [ ] All environment variables documented
- [ ] Rollback plan tested
- [ ] Team notified of maintenance window
- [ ] Monitoring tools ready
- [ ] Emergency contacts available

---

**Document Version:** 1.0  
**Created:** November 7, 2025  
**Last Updated:** November 7, 2025  
**Next Review:** After migration completion
