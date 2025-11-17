# Refresh Staging from Main - Execution Plan

**Date:** November 16, 2025  
**Direction:** `main` → `staging` (reverse of typical flow)  
**Purpose:** Refresh staging environment with production-ready code from main

---

## 🎯 Overview

This plan covers:
1. **Database Backup** - Create safety backup of staging database
2. **Code Refresh** - Merge main branch into staging
3. **Database Migration** - Apply any new migrations from main to staging
4. **Verification** - Ensure staging environment is working correctly

---

## 📊 Current State

- **Current Branch:** `main` (clean working tree)
- **Target Branch:** `staging` (will be refreshed)
- **Database:** Supabase PostgreSQL
- **API Deployment:** Vercel (https://aps.visibleshelf.store)
- **Web Deployment:** Vercel (https://www.visibleshelf.store)

---

## 🚀 Execution Steps

### Step 1: Backup Staging Database

**Via Supabase Dashboard:**
```bash
1. Go to Supabase Dashboard → Your Staging Project
2. Navigate to Database → Backups
3. Click "Create Backup" or "Back Up Now"
4. Wait for completion (usually 1-2 minutes)
5. Note the backup timestamp for rollback reference
```

**Alternative: Manual pg_dump (if you have direct access):**
```bash
# Set your staging database URL
$STAGING_DB_URL = "postgresql://..."

# Create backup
pg_dump $STAGING_DB_URL > "staging_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
```

✅ **Checkpoint:** Backup created and verified

---

### Step 2: Switch to Staging Branch

```powershell
# Fetch latest from remote
git fetch origin

# Switch to staging branch
git checkout staging

# Pull latest staging changes
git pull origin staging
```

✅ **Checkpoint:** On staging branch with latest code

---

### Step 3: Merge Main into Staging

```powershell
# Merge main into staging (this refreshes staging with main's code)
git merge origin/main -m "Refresh staging from main"

# If there are conflicts:
# 1. Review conflicts carefully
# 2. Resolve in favor of main (since we're refreshing from main)
# 3. Stage resolved files: git add <file>
# 4. Complete merge: git commit
```

**Review Changes:**
```powershell
# See what changed
git log --oneline staging..origin/main

# See file changes
git diff staging origin/main --stat
```

✅ **Checkpoint:** Main merged into staging successfully

---

### Step 4: Push Updated Staging Branch

```powershell
# Push staging branch to trigger deployments
git push origin staging
```

**This will automatically trigger:**
- ✅ Vercel API deployment (aps.visibleshelf.store)
- ✅ Vercel Web deployment (www.visibleshelf.store)

✅ **Checkpoint:** Staging branch pushed to remote

---

### Step 5: Run Database Migrations on Staging

**Option A: Via Vercel CLI (Recommended)**

```powershell
# Install Vercel CLI if not already installed
# npm install -g vercel

# Login to Vercel
vercel login

# Link to your staging project (API)
vercel link

# Run migrations on staging database
vercel env pull .env.staging
cd apps/api
npx prisma migrate deploy
```

**Option B: Via Vercel Dashboard**

```bash
1. Go to Vercel Dashboard → Your API Project (aps.visibleshelf.store)
2. Click "Settings" → "Environment Variables"
3. Copy DATABASE_URL value for staging
4. Run locally with staging DATABASE_URL:
   $env:DATABASE_URL = "copied-staging-database-url"
   cd apps/api
   npx prisma migrate deploy
```

**Option C: Manually via Supabase + Local Prisma**

```powershell
# Get staging database URL from Vercel or Supabase
$env:DATABASE_URL = "your-staging-database-url"

# Navigate to API directory
cd apps/api

# Check migration status
npx prisma migrate status

# Deploy migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

✅ **Checkpoint:** Migrations applied to staging database

---

### Step 6: Verify Staging Environment

**Check Deployments:**

```powershell
# Check Vercel deployments
vercel ls

# Or visit Vercel Dashboard
# https://vercel.com/dashboard
```

**Test Staging API:**

```powershell
# Health check
curl https://aps.visibleshelf.store/health

# Expected: {"status":"ok"}
```

**Test Staging Web:**

```powershell
# Visit staging URL
# https://www.visibleshelf.store

# Test key flows:
# 1. Login
# 2. View tenants
# 3. View items
# 4. Create/edit item
```

**Verify Database:**

```sql
-- Check migration status
SELECT migration_name, finished_at 
FROM _prisma_migrations 
ORDER BY finished_at DESC 
LIMIT 5;

-- Check table counts
SELECT 
  schemaname,
  tablename,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as table_count
FROM pg_tables 
WHERE schemaname = 'public'
LIMIT 1;
```

✅ **Checkpoint:** Staging environment verified and working

---

## 🔄 Rollback Procedure (If Needed)

**If something goes wrong:**

### Rollback Database:

```bash
# Via Supabase Dashboard
1. Go to Database → Backups
2. Select the backup from Step 1
3. Click "Restore"
4. Wait for completion (5-10 min)
```

### Rollback Code:

```powershell
# Reset staging branch to previous state
git checkout staging
git reset --hard origin/staging@{1}  # Go back one commit
git push origin staging --force

# Or revert the merge
git revert -m 1 HEAD
git push origin staging
```

---

## 📋 Pre-Execution Checklist

Before starting, confirm:

- [ ] You have access to Supabase Dashboard (staging project)
- [ ] You have access to Vercel Dashboard (both API and web projects)
- [ ] You understand the current staging state
- [ ] You have time to complete the process (30-45 minutes)
- [ ] You've notified team members (if applicable)

---

## ⏱️ Estimated Timeline

| Step | Duration | Risk |
|------|----------|------|
| **Step 1: Backup Database** | 2-5 min | Low |
| **Step 2: Switch Branch** | 1 min | Low |
| **Step 3: Merge Main** | 5-10 min | Medium |
| **Step 4: Push Staging** | 1 min | Low |
| **Step 5: Run Migrations** | 5-10 min | Medium |
| **Step 6: Verify** | 10-15 min | Low |
| **Total** | **24-42 min** | **Medium** |

---

## 🎯 Success Criteria

✅ Staging database backup created  
✅ Main branch merged into staging  
✅ No merge conflicts (or resolved correctly)  
✅ Staging branch pushed successfully  
✅ Vercel API deployment completed (aps.visibleshelf.store)  
✅ Vercel Web deployment completed (www.visibleshelf.store)  
✅ Database migrations applied  
✅ API health check passes  
✅ Web app loads correctly  
✅ Key user flows work  
✅ No errors in logs  

---

## 📝 Post-Refresh Tasks

### Immediate (Within 1 Hour)

- [ ] Monitor Vercel API logs for errors
- [ ] Monitor Vercel Web logs for errors
- [ ] Test authentication flow
- [ ] Test CRUD operations
- [ ] Verify Supabase storage access

### Optional

- [ ] Update staging test data if needed
- [ ] Notify team that staging is refreshed
- [ ] Document any issues encountered

---

## 🚨 Important Notes

1. **Direction:** This refreshes staging FROM main (opposite of typical promotion flow)
2. **Data:** Staging database will have main's schema but keep existing staging data
3. **Deployments:** Both API and Web on Vercel will auto-deploy from staging branch
4. **Migrations:** Only new migrations from main will be applied to staging
5. **Conflicts:** If conflicts occur, prefer main's code (we're refreshing from main)

---

## 📞 Troubleshooting

**Issue: Merge conflicts**
- Resolution: Review conflicts, prefer main's code, resolve and commit

**Issue: Migration fails**
- Resolution: Check migration logs, restore from backup, investigate issue

**Issue: Deployment fails**
- Resolution: Check Vercel deployment logs, rollback if needed

**Issue: API not responding**
- Resolution: Check Vercel API logs, verify environment variables, redeploy if needed

---

**Ready to proceed?** Start with Step 1: Backup Staging Database

---

**Document Version:** 1.0  
**Created:** November 16, 2025  
**Purpose:** Refresh staging environment from main branch
