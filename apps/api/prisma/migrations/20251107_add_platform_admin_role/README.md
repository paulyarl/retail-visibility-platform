# Migration: Add PLATFORM_ADMIN Role

**Date:** November 7, 2025  
**Migration:** `20251107_add_platform_admin_role`  
**Type:** Schema + Data Migration

---

## 🎯 Purpose

Add explicit `PLATFORM_ADMIN` role to remove ambiguity between platform-wide admins and tenant-scoped admins.

### Before
- `User.role = 'ADMIN'` could mean platform admin OR tenant admin (ambiguous)
- Had to check `UserTenant` records to determine scope

### After
- `User.role = 'PLATFORM_ADMIN'` = Platform-wide admin (explicit)
- `User.role = 'ADMIN'` = Deprecated (kept for compatibility)
- `UserTenant.role = 'ADMIN'` = Tenant-scoped admin (clear)

---

## 📋 Migration Steps

### Step 1: Apply Schema Migration

```bash
cd apps/api
npx prisma migrate deploy
```

This adds `PLATFORM_ADMIN` to the `user_role` enum.

---

### Step 2: Run Data Migration

**Option A: Via Supabase SQL Editor**

```sql
-- Copy contents of data_migration.sql and run in Supabase
```

**Option B: Via Prisma Client**

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  // Update ADMIN users with no tenant assignments to PLATFORM_ADMIN
  const result = await prisma.$executeRaw\`
    UPDATE users
    SET role = 'PLATFORM_ADMIN'
    WHERE role = 'ADMIN'
      AND id NOT IN (
        SELECT DISTINCT user_id 
        FROM user_tenants
      )
  \`;
  
  console.log(\`Updated \${result} users to PLATFORM_ADMIN\`);
  
  // Verify
  const platformAdmins = await prisma.user.findMany({
    where: { role: 'PLATFORM_ADMIN' },
    select: { email: true, role: true }
  });
  
  console.log('Platform Admins:', platformAdmins);
}

migrate().finally(() => prisma.$disconnect());
"
```

---

### Step 3: Update Application Code

**Before:**
```typescript
// Ambiguous - had to check tenant assignments
if (user.role === 'ADMIN') {
  const tenants = await getUserTenants(user.id);
  if (tenants.length === 0) {
    // Platform admin
  } else {
    // Tenant admin
  }
}
```

**After:**
```typescript
// Explicit and clear
if (user.role === 'PLATFORM_ADMIN') {
  // Platform-wide admin
  // No need to check tenant assignments
}

if (user.role === 'ADMIN') {
  // Deprecated - should migrate to PLATFORM_ADMIN or use UserTenant.role
}
```

---

### Step 4: Update Access Control

Find and update all access control checks:

```bash
# Search for ADMIN role checks
grep -r "role === 'ADMIN'" apps/
grep -r "role: 'ADMIN'" apps/
grep -r "UserRole.ADMIN" apps/
```

Update to:
```typescript
// Platform admin check
if (user.role === 'PLATFORM_ADMIN') {
  // Grant platform-wide access
}

// Tenant admin check (via UserTenant)
const userTenant = await prisma.userTenant.findFirst({
  where: {
    userId: user.id,
    tenantId: tenantId,
    role: 'ADMIN'
  }
});

if (userTenant) {
  // Grant tenant-scoped admin access
}
```

---

## 🧪 Testing

### Verify Migration

```sql
-- Check role distribution
SELECT role, COUNT(*) 
FROM users 
GROUP BY role;

-- Verify platform admins have no tenant assignments
SELECT u.email, u.role, COUNT(ut.id) as tenant_count
FROM users u
LEFT JOIN user_tenants ut ON u.id = ut.user_id
WHERE u.role = 'PLATFORM_ADMIN'
GROUP BY u.id, u.email, u.role;

-- Should return 0 tenant_count for all PLATFORM_ADMIN users
```

### Test Access Control

1. **Platform Admin:**
   - Login as PLATFORM_ADMIN user
   - Verify access to `/settings/admin`
   - Verify can see all tenants
   - Verify can manage feature flags

2. **Tenant Admin:**
   - Login as user with `UserTenant.role = 'ADMIN'`
   - Verify sees only assigned tenants
   - Verify CANNOT access `/settings/admin`

---

## 🔄 Rollback Plan

If issues arise:

```sql
-- Rollback data migration
UPDATE users
SET role = 'ADMIN'
WHERE role = 'PLATFORM_ADMIN';

-- Then rollback schema migration
npx prisma migrate resolve --rolled-back 20251107_add_platform_admin_role
```

**Note:** Cannot remove enum value once added in PostgreSQL without recreating the enum.

---

## 📊 Impact Analysis

### Affected Tables
- `users` table (role column)

### Affected Code
- Access control middleware
- Admin route guards
- Feature flag management
- User management pages

### Breaking Changes
- None (ADMIN role is kept for compatibility)
- Recommended to update code to use PLATFORM_ADMIN

---

## ✅ Checklist

- [ ] Schema migration applied (`migration.sql`)
- [ ] Data migration executed (`data_migration.sql`)
- [ ] Verified platform admins updated
- [ ] Updated access control code
- [ ] Updated admin route guards
- [ ] Updated feature flag checks
- [ ] Tested platform admin access
- [ ] Tested tenant admin access
- [ ] Updated test users (see `STAGING_TEST_USERS.md`)
- [ ] Updated documentation

---

## 🔗 Related Files

- `apps/api/prisma/schema.prisma` - Schema definition
- `STAGING_TEST_USERS.md` - Test user setup with PLATFORM_ADMIN
- `apps/web/src/lib/access-control.ts` - Access control utilities (if exists)
- `apps/api/src/middleware/auth.ts` - Authentication middleware (if exists)

---

**Migration Created:** November 7, 2025  
**Status:** Ready to apply  
**Environment:** Staging (test first before production)
