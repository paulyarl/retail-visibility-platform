# Tenant Support Role

**Status:** ✅ IMPLEMENTED - Database migration required

## Overview

The **Tenant Support** role (`SUPPORT`) is a new tenant-level role designed for support staff at large organizations who need operational access but should not be able to delete tenants or items.

## Why This Role?

Large organizations need a role that:
- Can manage day-to-day operations
- Can set item visibility (public/private)
- Can set item status (active/archived)
- **Cannot delete** tenants or items (safety)
- Similar to Platform Support but scoped to one tenant

## Role Hierarchy

### Updated Tenant Role Hierarchy:
```
OWNER (Full control + billing + can delete)
    ↓
ADMIN (Full operations, no billing, can delete)
    ↓
SUPPORT (Full operations, cannot delete) ← NEW
MANAGER (Alias for operational permissions)
    ↓
MEMBER (Edit only, no bulk operations)
    ↓
VIEWER (Read-only)
```

## Permissions Matrix

| Role | canView | canEdit | canManage | canSupport | canAdmin | Can Delete |
|------|---------|---------|-----------|------------|----------|------------|
| **OWNER** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Tenant + Items |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ Items only |
| **SUPPORT** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ None |
| **MANAGER** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ None |
| **MEMBER** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ None |
| **VIEWER** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ None |

## What SUPPORT Can Do

### ✅ Allowed Operations:
- **View** all data (canView)
- **Edit** items (canEdit)
  - Update product details
  - Change prices
  - Modify descriptions
  - Upload/manage images
- **Manage** operations (canManage)
  - Bulk operations
  - Quick start wizards
  - Category assignments
  - Propagation (if Organization tier)
- **Support** actions (canSupport)
  - **Set item visibility** (public/private)
  - **Set item status** (active/archived)
  - Password resets
  - Support operations

### ❌ Restricted Operations:
- **Cannot delete tenant** (only OWNER can)
- **Cannot delete items** (OWNER/ADMIN only)
- **Cannot manage billing** (only OWNER)
- **Cannot manage users** (canAdmin required)

## Key Difference from ADMIN

| Feature | ADMIN | SUPPORT |
|---------|-------|---------|
| Edit items | ✅ | ✅ |
| Set visibility/status | ✅ | ✅ |
| Bulk operations | ✅ | ✅ |
| Quick start | ✅ | ✅ |
| **Delete items** | ✅ | ❌ |
| **Delete tenant** | ❌ | ❌ |
| Manage billing | ❌ | ❌ |

**Summary:** SUPPORT = ADMIN - Delete permissions

## Use Cases

### 1. Large Retail Chain Support Team
**Scenario:** 100-location retail chain with dedicated support staff

**Problem:** Support staff needs to help stores manage inventory but shouldn't be able to accidentally delete items or tenants.

**Solution:** Assign support staff the SUPPORT role:
- Can help stores set items to active/archived
- Can change visibility for seasonal items
- Can assist with bulk operations
- **Cannot** accidentally delete critical data

### 2. Franchise Support Staff
**Scenario:** Franchise organization with regional support managers

**Problem:** Regional managers need operational access to help franchisees but shouldn't have delete permissions.

**Solution:** Regional managers get SUPPORT role:
- Can manage operations across their region
- Can set status and visibility
- Can run quick starts and bulk operations
- **Cannot** delete franchisee data

### 3. Customer Service Team
**Scenario:** Customer service team helping tenants troubleshoot

**Problem:** CS team needs to help customers but shouldn't be able to delete anything.

**Solution:** CS team gets SUPPORT role:
- Can view all customer data
- Can help set visibility/status
- Can assist with operations
- **Cannot** delete customer data

## Database Migration

### Migration File:
`apps/api/prisma/migrations/20251112_add_tenant_support_role/migration.sql`

```sql
-- Add SUPPORT role to UserTenantRole enum
ALTER TYPE "user_tenant_role" ADD VALUE IF NOT EXISTS 'SUPPORT';
```

### Schema Update:
```prisma
enum UserTenantRole {
  OWNER   // Tenant owner (full control + billing + can delete)
  ADMIN   // Tenant admin (full operations, no billing, can delete)
  SUPPORT // Tenant support (can manage operations but cannot delete tenant/items)
  MEMBER  // Regular member (edit only)
  VIEWER  // Read-only access
}
```

## Frontend Integration

### Permission Hook:
```typescript
// apps/web/src/hooks/dashboard/useTenantTier.ts
export type UserTenantRole = 'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'MANAGER' | 'VIEWER';

const rolePermissions: Record<UserTenantRole, PermissionType[]> = {
  'SUPPORT': ['canView', 'canEdit', 'canManage', 'canSupport'],
  // ...
};
```

### Usage Example:
```typescript
const { canAccess } = useTenantTier(tenantId);

// SUPPORT can set visibility
const canSetVisibility = canAccess('item_visibility', 'canSupport'); // ✅ true

// SUPPORT cannot delete
const canDelete = canAccess('item_delete', 'canAdmin'); // ❌ false
```

## Middleware Enforcement

### Delete Protection:
```typescript
// Only OWNER and ADMIN can delete items
export const requireItemDeletePermission = requireTenantRole(
  UserTenantRole.OWNER,
  UserTenantRole.ADMIN
);

// SUPPORT is explicitly excluded from delete operations
```

### Visibility/Status Management:
```typescript
// SUPPORT can manage visibility and status
export const requireItemManagement = requireTenantRole(
  UserTenantRole.OWNER,
  UserTenantRole.ADMIN,
  UserTenantRole.SUPPORT // ✅ Included
);
```

## Display Names

**Database:** `SUPPORT`  
**Display Name:** "Tenant Support"  
**Badge Color:** Blue 🔵 (same as Platform Support)

## Migration Steps

### 1. Apply Database Migration:
```bash
cd apps/api
npx prisma migrate deploy
```

### 2. Verify Migration:
```sql
SELECT enum_range(NULL::user_tenant_role);
-- Should include: OWNER, ADMIN, SUPPORT, MEMBER, VIEWER
```

### 3. Update Existing Users (Optional):
```sql
-- Example: Convert specific ADMIN users to SUPPORT
UPDATE user_tenants
SET role = 'SUPPORT'
WHERE user_id IN ('user_id_1', 'user_id_2')
  AND role = 'ADMIN';
```

## Testing Checklist

- [ ] SUPPORT can view all items
- [ ] SUPPORT can edit item details
- [ ] SUPPORT can set item visibility (public/private)
- [ ] SUPPORT can set item status (active/archived)
- [ ] SUPPORT can perform bulk operations
- [ ] SUPPORT can use quick start wizard
- [ ] SUPPORT **cannot** delete items
- [ ] SUPPORT **cannot** delete tenant
- [ ] SUPPORT **cannot** manage billing
- [ ] SUPPORT **cannot** manage users

## Comparison with Platform Support

| Feature | Platform Support | Tenant Support |
|---------|------------------|----------------|
| **Scope** | All tenants | Single tenant |
| **Tenant Limit** | 3 globally | N/A |
| **View All** | ✅ All tenants | ✅ One tenant |
| **Edit Items** | ✅ | ✅ |
| **Set Visibility** | ✅ | ✅ |
| **Delete Items** | ❌ | ❌ |
| **Delete Tenant** | ❌ | ❌ |

## Benefits

### For Organizations:
- ✅ **Safety:** Support staff cannot accidentally delete data
- ✅ **Flexibility:** Can still perform all operational tasks
- ✅ **Scalability:** Perfect for large teams with dedicated support
- ✅ **Compliance:** Separation of duties (operations vs. deletion)

### For Platform:
- ✅ **Reduced Risk:** Fewer users with delete permissions
- ✅ **Better Support:** Support teams can help without risk
- ✅ **Clear Hierarchy:** Distinct role for support operations
- ✅ **Enterprise Ready:** Meets enterprise security requirements

## Summary

**Tenant Support** is the perfect role for:
- Support staff at large organizations
- Regional managers in franchise systems
- Customer service teams
- Anyone who needs operational access without delete permissions

**Key Principle:** SUPPORT = Full Operations - Delete Permissions

This role fills a critical gap between ADMIN (can delete) and MEMBER (limited operations), providing the perfect balance for support staff at enterprise organizations.
