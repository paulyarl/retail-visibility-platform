# Production Deployment Checklist

**Date:** November 12, 2025  
**Branch:** `staging` → `main`  
**Features:** User Role Management System + Tenant Support Role

---

## ✅ Pre-Deployment Verification

### Staging Status:
- [x] All commits pushed to `staging` branch
- [x] Code changes deployed to Vercel staging
- [x] Migration file created: `20251112_add_tenant_support_role/migration.sql`
- [ ] Migration tested in staging database
- [ ] All features tested in staging environment

### Key Commits (10 total):
1. `e5ec53b` - Complete test user management (pagination, search, filters, gating)
2. `d7adb2a` - Add Tenant Support role + migration
3. `00b20d6` - Align test user management with role system
4. `a56e0cd` - Fix user API schema for all platform roles
5. `7c626ea` - Standardize role display names
6. `9e30b95` - Fix tenant limit descriptions (tier-based)
7. `83e4fbc` - Add comprehensive role system documentation
8. `305fed8` - Add all platform roles to user management
9. `b6e7f00` - Improve user role management UX
10. `730ef95` - Fix critical permissions state leakage bug

---

## 📋 Deployment Steps

### 1. Database Migration (CRITICAL - Do First!)

**Production Database:**
```bash
# Connect to production database
cd apps/api

# Apply the migration
npx prisma migrate deploy

# Verify the migration
npx prisma db execute --stdin <<EOF
SELECT enum_range(NULL::user_tenant_role);
EOF
```

**Expected Output:**
```
{OWNER,ADMIN,SUPPORT,MEMBER,VIEWER}
```

**⚠️ IMPORTANT:** This migration adds a new enum value and is **non-breaking**. Existing data is not affected.

---

### 2. Merge to Main

```bash
# Switch to main branch
git checkout main

# Pull latest
git pull origin main

# Merge staging
git merge staging

# Push to main
git push origin main
```

---

### 3. Verify Vercel Deployment

**Production URL:** `https://visibleshelf.com`

**Check:**
- [ ] Vercel auto-deploys from `main` branch
- [ ] Build completes successfully
- [ ] No build errors in Vercel dashboard

---

### 4. Post-Deployment Verification

**Test User Management Pages:**

1. **Platform Settings - User Management**
   - URL: `https://visibleshelf.com/settings/admin/users`
   - [ ] All 6 platform roles visible in dropdown
   - [ ] Role badges display correctly
   - [ ] Edit modal shows grouped roles
   - [ ] Save works for all roles

2. **Test User Management**
   - URL: `https://visibleshelf.com/admin/users`
   - [ ] Pagination works (10 per page)
   - [ ] Search works (email, name, role)
   - [ ] Role filter works
   - [ ] Create user gated to Platform Admin/Support
   - [ ] Reset password gated to Platform Admin/Support
   - [ ] Delete gated to Platform Admin only

3. **Role Permissions**
   - [ ] Platform Admin can do everything
   - [ ] Platform Support can create users and reset passwords
   - [ ] Platform Support cannot delete users
   - [ ] Platform Viewer is read-only

---

## 🎯 New Features Deployed

### 1. Complete Role System
**Platform Roles:**
- Platform Admin (unlimited tenants)
- Platform Support (3 tenant limit, support actions)
- Platform Viewer (read-only, cannot create)
- Tenant Owner (tier-based limits)
- Tenant User (tier-based limits)

**Tenant Roles:**
- Tenant Owner (full control + billing + delete)
- Tenant Admin (full operations, no billing, can delete)
- **Tenant Support** ← NEW (operations, cannot delete)
- Tenant Member (edit only)
- Tenant Viewer (read-only)

### 2. User Management Improvements
- ✅ Pagination (10 users per page)
- ✅ Search (email, name, role)
- ✅ Role filter dropdown
- ✅ Proper role-based gating
- ✅ Disabled buttons with tooltips
- ✅ Color-coded role badges

### 3. Critical Bug Fixes
- ✅ Fixed permissions state leakage (cross-user bug)
- ✅ Removed unimplemented permissions button
- ✅ Fixed API schema to accept all platform roles
- ✅ Corrected tenant limit descriptions (tier-based)

---

## 📚 Documentation Deployed

**New Documentation:**
1. `docs/ROLE_SYSTEM_EXPLAINED.md` - Complete role system guide
2. `docs/ROLE_DISPLAY_NAME_MAPPING.md` - Display name mapping + middleware alignment
3. `docs/TENANT_SUPPORT_ROLE.md` - Tenant Support role guide

**Updated Documentation:**
- User management pages now have comprehensive info cards
- Role descriptions in all dropdowns
- Tooltips on all action buttons

---

## 🔍 Testing Checklist

### Critical Paths:
- [ ] Login as Platform Admin
- [ ] Create a new Platform Support user
- [ ] Login as Platform Support
- [ ] Verify can create users
- [ ] Verify can reset passwords
- [ ] Verify cannot delete users
- [ ] Create a Tenant Owner user
- [ ] Verify tier-based tenant limits work
- [ ] Test search and pagination
- [ ] Test role filter

### Edge Cases:
- [ ] Try to delete user as Platform Support (should fail)
- [ ] Try to create user as Platform Viewer (should fail)
- [ ] Verify existing users still work
- [ ] Verify role changes persist
- [ ] Test with 20+ users (pagination)

---

## 🚨 Rollback Plan

**If issues occur:**

1. **Revert Code:**
```bash
git checkout main
git revert HEAD
git push origin main
```

2. **Revert Migration (if needed):**
```sql
-- Remove SUPPORT from enum (only if absolutely necessary)
-- Note: This is complex and should be avoided
-- Better to fix forward than rollback
```

3. **Monitor:**
- Check Vercel logs
- Check database logs
- Check user reports

---

## 📊 Success Metrics

**Immediate (Day 1):**
- [ ] No deployment errors
- [ ] All users can login
- [ ] User management pages load
- [ ] No database errors

**Short-term (Week 1):**
- [ ] Platform Support users created
- [ ] Tenant Support role used
- [ ] No permission-related bugs
- [ ] Positive user feedback

---

## 🎉 What's New for Users

**For Platform Admins:**
- Complete user management with search and filters
- All platform roles available
- Proper role-based access control
- New Tenant Support role for large organizations

**For Platform Support:**
- Can now create test users
- Can reset passwords
- Cannot accidentally delete users

**For Large Organizations:**
- New Tenant Support role
- Support staff can manage operations
- Cannot delete critical data
- Perfect for franchise/chain support teams

---

## 📞 Support Information

**If issues arise:**
1. Check Vercel deployment logs
2. Check database migration status
3. Review error logs in production
4. Contact: [Your support channel]

**Known Limitations:**
- Tenant Support role requires migration to be applied
- Existing ADMIN roles remain as ADMIN (not auto-converted to SUPPORT)
- Organizations must manually assign SUPPORT role to support staff

---

## ✅ Final Checklist

Before marking deployment complete:
- [ ] Database migration applied successfully
- [ ] Code deployed to production (Vercel)
- [ ] All critical paths tested
- [ ] No errors in logs
- [ ] Documentation accessible
- [ ] Team notified of new features
- [ ] Rollback plan ready (just in case)

---

**Deployment Status:** ⏳ READY TO DEPLOY

**Next Steps:**
1. Apply database migration to production
2. Merge `staging` → `main`
3. Verify Vercel deployment
4. Test critical paths
5. Monitor for 24 hours
6. Mark as ✅ COMPLETE
