# Migration Summary: staging → main

**Current State:** Working on `staging` branch  
**Goal:** Merge to `main` branch for production deployment  
**Date:** November 7, 2025

---

## 🎯 What's Happening

You're migrating from:
- **Source:** `staging` branch (active development)
- **Target:** `main` branch (production)

**Why:** The `staging` branch has new features and database changes that need to go to production.

---

## 📊 What's New in Staging

### Database Changes (30 Migrations)
- Product enrichment tracking
- GBP (Google Business Profile) categories
- Barcode scanning features
- Feature flag improvements
- Category management enhancements

### New Environment Variables
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - For storefront maps
- `OAUTH_ENCRYPTION_KEY` - For secure token storage
- Feature flags (optional)

### Code Changes
- Storefront improvements
- Google OAuth integration
- Enhanced admin features
- Performance optimizations

---

## 🚀 Migration Steps (60 Minutes)

### 1. Backup Database (5 min)
```
Supabase Dashboard → Database → Backups → Create Backup
```

### 2. Add Environment Variables (15 min)
**Railway:**
- Add `OAUTH_ENCRYPTION_KEY`
- Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Add feature flags

**Vercel:**
- Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### 3. Merge Code (10 min)
```bash
git checkout main
git pull origin main
git merge staging
git push origin main
```

### 4. Run Database Migration (10 min)
```bash
cd apps/api
npx prisma migrate deploy
```

### 5. Verify (10 min)
- Test API health
- Test web health
- Test login
- Test CRUD operations

---

## ⚠️ Important Notes

### Downtime
- **Expected:** 5-10 minutes during database migration
- **Recommended Time:** Weekend, 2-4 AM (low traffic)

### Rollback Plan
If something goes wrong:
1. Restore database from Supabase backup
2. Revert code: `git revert HEAD && git push --force`
3. Check logs and troubleshoot

### Risk Level
- **Overall:** Medium (well-mitigated)
- **Database:** Medium (backup available)
- **Code:** Low (tested in staging)
- **Env Vars:** Low (can update anytime)

---

## ✅ Pre-Migration Checklist

- [ ] Database backup created
- [ ] Environment variables documented
- [ ] Team notified of maintenance window
- [ ] Rollback plan reviewed
- [ ] Monitoring tools ready

---

## 📋 Post-Migration Checklist

- [ ] All migrations applied (30/30)
- [ ] API health check passes
- [ ] Web health check passes
- [ ] Login works
- [ ] CRUD operations work
- [ ] Photos upload successfully
- [ ] Storefront displays with maps
- [ ] Feature flags work
- [ ] No errors in logs

---

## 🔗 Detailed Documentation

- **`STAGING_TO_MAIN_MIGRATION_PLAN.md`** - Complete detailed plan
- **`MIGRATION_QUICK_START.md`** - Fast-track 60-minute guide
- **`ENVIRONMENT_VARIABLES.md`** - All environment variables
- **`DEPLOYMENT_CHECKLIST.md`** - Deployment procedures

---

## 🆘 Need Help?

**Check logs:**
```bash
# Railway API logs
railway logs --tail

# Vercel Web logs
vercel logs --follow

# Supabase logs
Dashboard → Logs
```

**Health checks:**
```bash
# API
curl https://rvpapi-production.up.railway.app/health

# Web
curl https://retail-visibility-platform-web.vercel.app/api/health
```

---

**Ready to migrate?** Follow the steps in `MIGRATION_QUICK_START.md`
