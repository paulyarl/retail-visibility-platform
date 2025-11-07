# Migration: Add Platform Support and Viewer Roles

**Date:** November 7, 2025  
**Type:** Schema Enhancement  
**Risk:** Low (additive only, no data changes)

---

## Purpose

Add two new platform-level roles to close a critical access control gap:
- `PLATFORM_SUPPORT` - For support team members who need to view all tenants and perform limited actions
- `PLATFORM_VIEWER` - For analytics, sales, legal, and compliance teams who need read-only access across all tenants

---

## Changes

### Schema Changes
```prisma
enum UserRole {
  PLATFORM_ADMIN   // Full control (existing)
  PLATFORM_SUPPORT // NEW: View all + limited actions
  PLATFORM_VIEWER  // NEW: Read-only all
  ADMIN            // Deprecated
  OWNER
  USER
}
```

### SQL Migration
```sql
ALTER TYPE "user_role" ADD VALUE 'PLATFORM_SUPPORT';
ALTER TYPE "user_role" ADD VALUE 'PLATFORM_VIEWER';
```

---

## Use Cases

### PLATFORM_SUPPORT
**Who:** Customer support team, technical support  
**Can:**
- View all tenants and their data
- View user accounts across all tenants
- Reset user passwords
- Unlock accounts
- View logs and metrics
- Access support tools

**Cannot:**
- Delete tenants
- Modify platform settings
- Change billing
- Delete users
- Modify tenant data

### PLATFORM_VIEWER
**Who:** Analytics team, sales team, legal/compliance, executives  
**Can:**
- View all tenants (read-only)
- View metrics and analytics
- Export reports
- View user data for compliance
- Access dashboards

**Cannot:**
- Modify any data
- Perform any actions
- Access admin tools
- Change settings

---

## Access Control Matrix

| Action | PLATFORM_ADMIN | PLATFORM_SUPPORT | PLATFORM_VIEWER | OWNER | USER |
|--------|----------------|------------------|-----------------|-------|------|
| View all tenants | ✅ | ✅ | ✅ (read-only) | Own only | Assigned only |
| Modify tenants | ✅ | ❌ | ❌ | Own only | ❌ |
| Delete tenants | ✅ | ❌ | ❌ | Own only | ❌ |
| Platform settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reset passwords | ✅ | ✅ | ❌ | Own tenants | ❌ |
| View analytics | ✅ | ✅ | ✅ | Own tenants | Assigned only |
| Billing | ✅ | ❌ | ❌ | Own tenants | ❌ |

---

## Migration Steps

### 1. Apply Schema Migration
```bash
cd apps/api
npx prisma migrate deploy
```

### 2. Regenerate Prisma Client
```bash
npx prisma generate
```

### 3. No Data Migration Needed
This is an additive change - no existing data needs to be updated.

---

## Code Updates Required

### 1. Access Control Utilities
Update `apps/api/src/utils/platform-admin.ts`:
```typescript
export function isPlatformUser(user: UserData): boolean {
  return user.role === 'PLATFORM_ADMIN' || 
         user.role === 'PLATFORM_SUPPORT' ||
         user.role === 'PLATFORM_VIEWER';
}

export function canModifyTenants(user: UserData): boolean {
  return user.role === 'PLATFORM_ADMIN';
}

export function canViewAllTenants(user: UserData): boolean {
  return isPlatformUser(user);
}
```

### 2. Middleware Updates
Update permission checks to differentiate between:
- View access (all platform users)
- Modify access (only PLATFORM_ADMIN)

### 3. Frontend Updates
Update `apps/web/src/lib/auth/access-control.ts` with same logic.

---

## Testing

### Test PLATFORM_SUPPORT
- [ ] Can view all tenants
- [ ] Can view all users
- [ ] Can reset passwords
- [ ] Cannot delete tenants
- [ ] Cannot modify platform settings
- [ ] Cannot change billing

### Test PLATFORM_VIEWER
- [ ] Can view all tenants (read-only)
- [ ] Can view analytics
- [ ] Cannot modify any data
- [ ] Cannot perform any actions
- [ ] Cannot access admin tools

---

## Rollback Plan

If issues arise:
```sql
-- Remove the new enum values (only if no users have these roles)
-- Note: PostgreSQL doesn't support removing enum values easily
-- Better to mark as deprecated and handle in code
```

**Recommendation:** Don't rollback - these are additive changes with no breaking impact.

---

## Impact

- **Breaking Changes:** None
- **Data Loss Risk:** None
- **Downtime Required:** No
- **Backward Compatible:** Yes

---

## Related Files

- `apps/api/prisma/schema.prisma` - Schema definition
- `apps/api/src/utils/platform-admin.ts` - Access control utilities
- `apps/web/src/lib/auth/access-control.ts` - Frontend access control
- `PLATFORM_ADMIN_CODE_AUDIT.md` - Access control documentation

---

**Migration Status:** ✅ Ready to apply
