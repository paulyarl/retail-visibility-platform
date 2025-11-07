# Migration Quick Start Guide

**⚡ Fast-track guide for staging → main migration**

---

## 🚀 Quick Steps (60 minutes)

### 1. Backup Database (5 min)

```bash
# Supabase Dashboard
1. Database → Backups → Create Backup
2. Wait for completion
3. ✅ Backup created
```

---

### 2. Add Environment Variables (15 min)

**Railway:**
```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to Railway Dashboard → Variables:
OAUTH_ENCRYPTION_KEY=<generated-key>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-google-maps-key>

# Google My Business OAuth (NEW - separate from Merchant)
GOOGLE_BUSINESS_CLIENT_ID=<your-gmb-client-id>
GOOGLE_BUSINESS_CLIENT_SECRET=<your-gmb-client-secret>
GOOGLE_BUSINESS_REDIRECT_URI=https://your-api.railway.app/google-business/callback

# Feature Flags
FF_GLOBAL_TENANT_META=false
FF_AUDIT_LOG=false
```

**Vercel:**
```bash
# Add to Vercel Dashboard → Settings → Environment Variables:
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-google-maps-key>
```

---

### 3. Merge Code (10 min)

```bash
# Local terminal
git checkout main
git pull origin main
git merge staging
git push origin main
```

---

### 4. Run Database Migration (10 min)

```bash
# Railway CLI or Dashboard → Shell
cd apps/api
npx prisma migrate deploy

# Wait for all 30 migrations to apply
# ✅ All migrations applied successfully
```

---

### 5. Verify Deployment (10 min)

```bash
# Check API
curl https://rvpapi-production.up.railway.app/health

# Check Web
curl https://retail-visibility-platform-web.vercel.app/api/health

# Test login
# 1. Go to /login
# 2. Request magic link
# 3. Click link
# 4. ✅ Logged in
```

---

### 6. Test Critical Features (10 min)

- [ ] Create tenant
- [ ] Add item
- [ ] Upload photo
- [ ] View storefront (check Google Maps)
- [ ] Toggle feature flag

---

## 🆘 If Something Goes Wrong

```bash
# Restore database
Supabase Dashboard → Database → Backups → Restore

# Revert code
git revert HEAD
git push origin main --force

# Check logs
railway logs --tail
vercel logs --follow
```

---

## ✅ Success Checklist

- [ ] Database backup created
- [ ] Environment variables added
- [ ] Code merged to main
- [ ] Migrations applied (30/30)
- [ ] API health check passes
- [ ] Web health check passes
- [ ] Login works
- [ ] CRUD operations work
- [ ] Photos upload
- [ ] Storefront displays
- [ ] No errors in logs

---

## 📊 Migration Status

| Step | Status | Time |
|------|--------|------|
| Backup | ⏳ | 5 min |
| Env Vars | ⏳ | 15 min |
| Code Merge | ⏳ | 10 min |
| DB Migration | ⏳ | 10 min |
| Verification | ⏳ | 10 min |
| Testing | ⏳ | 10 min |

**Total:** 60 minutes

---

**For detailed steps, see:** `STAGING_TO_MAIN_MIGRATION_PLAN.md`
