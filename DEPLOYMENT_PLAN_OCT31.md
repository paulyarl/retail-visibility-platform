# Production Deployment Plan - October 31, 2025

## 🎯 Deployment Overview

**Branch**: `staging` → `main`  
**Type**: Major UI/UX improvements + Tier structure updates  
**Risk Level**: Medium (Breaking changes to tier structure)  
**Estimated Downtime**: None (zero-downtime deployment)

## 📋 Pre-Deployment Steps

### 1. Verify Staging Branch
```bash
git checkout staging
git pull origin staging
git log --oneline -15
```

**Expected commits** (11 total):
- adb26b3 - docs: add comprehensive changelog
- a534282 - feat: add flexible upgrade/downgrade messaging
- e55c33a - feat: add google_only tier to subscription
- 9ad5d08 - feat: align all tier pricing and limits
- c0aeb03 - refactor: replace 'tenant' with 'location'
- 42fd380 - refactor: improve dashboard gauge labels
- 2278c52 - refactor: replace 'tenants' with 'locations'
- fc4beb1 - refactor: improve inventory page language
- (+ 3 more commits from earlier work)

### 2. Database Migration Check

**All migrations are already applied to production** ✅

No new database migrations in this deployment. Changes are:
- Frontend UI/UX improvements
- Tier definition updates (code-only)
- Language/terminology refinements

### 3. Environment Variables Check

**Required on Vercel (Production)**:
```bash
NEXT_PUBLIC_API_BASE_URL=https://rvpapi-production.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=[your-supabase-url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
```

**Required on Railway (Production)**:
```bash
DATABASE_URL=[your-postgresql-url]
NODE_ENV=production
SUPABASE_URL=[your-supabase-url]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
JWT_SECRET=[your-jwt-secret]
```

### 4. Lockfile Status
```bash
# Already verified - lockfile is up to date
pnpm install --no-frozen-lockfile
# Output: "Lockfile is up to date, resolution step is skipped"
```

## 🚀 Deployment Steps

### Step 1: Merge to Main
```bash
# Ensure you're on staging with latest changes
git checkout staging
git pull origin staging

# Switch to main and merge
git checkout main
git pull origin main
git merge staging --no-ff -m "chore: merge staging to main - Oct 31 UI/UX improvements

Major changes:
- UI/UX language improvements (tenant→location, items→products)
- Tier structure alignment with offerings page
- New Google-Only tier ($29/mo) for individuals and chains
- Enterprise pricing: $499→$299, SKU limit: unlimited→10,000
- Professional SKU limit: 5,000→2,000
- Flexible upgrade/downgrade messaging
- Conditional UI for authenticated vs visitor states
- Dashboard gauge improvements
- AppShell platform branding from settings

Breaking Changes:
- Tier limits updated (see CHANGELOG_2025-10-31.md)
- New tier types added to TypeScript definitions

See CHANGELOG_2025-10-31.md for complete details."

# Push to main
git push origin main
```

### Step 2: Verify Vercel Deployment

1. **Monitor Build**:
   - Go to Vercel Dashboard
   - Watch deployment progress
   - Expected build time: 2-3 minutes

2. **Check Build Logs**:
   - Verify no TypeScript errors
   - Verify all pages compile successfully
   - Check for any warnings

3. **Verify Deployment URL**:
   ```
   https://retail-visibility-platform-web.vercel.app
   ```

### Step 3: Verify Railway Deployment

1. **Monitor Build**:
   - Go to Railway Dashboard
   - Watch deployment progress
   - Expected build time: 3-4 minutes

2. **Check Health Endpoint**:
   ```bash
   curl https://rvpapi-production.up.railway.app/health
   # Expected: {"status":"ok"}
   ```

3. **Check Logs**:
   - Verify no startup errors
   - Check Prisma connection successful

## ✅ Post-Deployment Verification

### Critical Path Testing (5 minutes)

#### 1. Authentication Flow
- [ ] Visit production URL
- [ ] Verify logged-out state shows visitor UI
- [ ] Sign in with existing account
- [ ] Verify AppShell navigation appears
- [ ] Verify tenant/location switcher works

#### 2. Dashboard
- [ ] Check gauge labels: "Catalog Size", "Live Products", "Sync Health"
- [ ] Verify metrics display correctly
- [ ] Check "Manage Locations" button (not "Manage Tenants")
- [ ] Verify "Add your first location" in Getting Started

#### 3. Locations Page
- [ ] Navigate to `/tenants`
- [ ] Verify page title is "Locations"
- [ ] Check "Add Location" button (not "Create Tenant")
- [ ] Verify location cards display correctly

#### 4. Inventory Page
- [ ] Navigate to `/items`
- [ ] Verify page title is "Inventory"
- [ ] Check "Add Product" button (not "Create Item")
- [ ] Verify product cards display correctly

#### 5. Subscription Page
- [ ] Navigate to `/settings/subscription`
- [ ] Verify Google-Only tier appears ($29/mo)
- [ ] Verify Enterprise shows $299/mo (not $499)
- [ ] Check all 5 tiers display: Trial, Google-Only, Starter, Professional, Enterprise
- [ ] Verify chain tiers include Chain Google-Only

#### 6. Offerings Page
- [ ] Navigate to `/settings/offerings`
- [ ] Verify "Flexible Plans That Grow With You" section
- [ ] Check upgrade/downgrade cards display
- [ ] Verify all tier pricing matches new structure

#### 7. Admin Tiers Page (Admin Only)
- [ ] Navigate to `/admin/tiers`
- [ ] Verify Google-Only tier button appears
- [ ] Verify Enterprise shows $299/mo
- [ ] Check tier assignment works

### Performance Check
- [ ] Page load times < 2 seconds
- [ ] API response times < 500ms
- [ ] No console errors in browser
- [ ] No 404s or broken images

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (if available)
- [ ] Mobile responsive (Chrome DevTools)

## 🔄 Rollback Plan

If critical issues are found:

### Quick Rollback (Vercel)
```bash
# In Vercel Dashboard:
# 1. Go to Deployments
# 2. Find previous successful deployment
# 3. Click "..." → "Promote to Production"
```

### Full Rollback (Git)
```bash
# Revert main branch
git checkout main
git revert HEAD --no-edit
git push origin main

# This will trigger new deployments with reverted changes
```

## 📊 Monitoring (First 24 Hours)

### Metrics to Watch

**Vercel Analytics**:
- Page views
- Unique visitors
- Error rate (should be < 1%)
- Function execution time

**Railway Logs**:
- API request volume
- Error logs
- Database query performance
- Memory/CPU usage

**User Feedback**:
- Support tickets
- User confusion about new terminology
- Tier selection patterns

### Alert Thresholds

🚨 **Immediate Action Required**:
- Error rate > 5%
- API response time > 2 seconds
- Database connection failures
- Authentication failures

⚠️ **Monitor Closely**:
- Error rate 1-5%
- API response time 500ms-2s
- Increased support tickets
- User confusion reports

## 📝 Communication Plan

### Internal Team
```
Subject: Production Deployment - UI/UX Improvements

The staging branch has been merged to main with the following updates:

✅ Deployed Changes:
- Improved user-friendly language throughout platform
- New Google-Only tier ($29/mo) for cost-conscious users
- Updated Enterprise pricing ($299/mo, down from $499)
- Flexible upgrade/downgrade messaging
- Better visitor vs authenticated user experience

⚠️ Breaking Changes:
- Tier SKU limits updated (Professional: 2,000, Enterprise: 10,000)
- New tier types in codebase

📋 Action Items:
- Monitor error rates for next 24 hours
- Watch for user feedback on new terminology
- Track Google-Only tier adoption

See CHANGELOG_2025-10-31.md for complete details.
```

### External Users (if applicable)
```
Subject: Platform Updates - New Features & Pricing

We've made some exciting updates to improve your experience:

🎨 Cleaner Interface
- More intuitive language throughout
- Better organized dashboard
- Clearer navigation

💰 New Affordable Option
- Google-Only tier: Just $29/mo for Google Shopping presence
- Perfect for testing the platform or budget-conscious businesses

📊 Updated Pricing
- Enterprise tier now $299/mo (was $499)
- More value at every tier level

🔄 Flexible Plans
- Upgrade or downgrade anytime
- No contracts, no hassle
- Change plans from your subscription page

Questions? Contact support@yourplatform.com
```

## ✅ Success Criteria

Deployment is successful when:

- ✅ All critical path tests pass
- ✅ No increase in error rate
- ✅ Performance metrics within acceptable range
- ✅ All tier pricing displays correctly
- ✅ No user-reported critical bugs
- ✅ Analytics tracking works
- ✅ Both Vercel and Railway deployments healthy

## 📚 References

- **Changelog**: `CHANGELOG_2025-10-31.md`
- **Deployment Checklist**: `DEPLOYMENT_CHECKLIST.md`
- **Environment Variables**: `ENVIRONMENT_VARIABLES.md`

---

**Prepared by**: AI Assistant  
**Date**: October 31, 2025  
**Approved by**: [Your Name]  
**Deployment Window**: [Your preferred time]  

**Estimated Total Time**: 15-20 minutes  
**Risk Assessment**: Medium (tier structure changes)  
**Rollback Time**: < 5 minutes if needed
