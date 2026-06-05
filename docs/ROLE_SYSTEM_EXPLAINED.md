# Role System Explained

## Two Separate Role Hierarchies

The platform uses **two independent role systems** that work together:

### 1. Platform Roles (User.role)
**Scope:** Global access across the entire platform  
**Managed:** `/settings/admin/users` (Platform Admin only)  
**Database:** `User.role` enum

| Role | Description | Tenant Limit |
|------|-------------|--------------|
| `PLATFORM_ADMIN` | Full system access, can manage all tenants and users | Unlimited |
| `PLATFORM_SUPPORT` | View all tenants + limited actions (password resets, support) | 3 globally |
| `PLATFORM_VIEWER` | Read-only access to all tenants (analytics/sales/legal) | 0 (view only) |
| `OWNER` | Can create and own multiple tenants | 10 max |
| `USER` | Basic access, can be assigned to tenants | 3 max |
| `ADMIN` | **Deprecated** - Use `PLATFORM_ADMIN` instead | - |

### 2. Tenant Roles (UserTenant.role)
**Scope:** Per-location access within a specific tenant  
**Managed:** Within each tenant's settings (`/t/{tenantId}/settings/team`)  
**Database:** `UserTenant.role` enum

| Role | Description | Permissions |
|------|-------------|-------------|
| `OWNER` | Tenant owner | Full control + billing |
| `ADMIN` | Tenant admin (same as MANAGER) | Full operations, no billing |
| `MEMBER` | Regular member | Edit only, no bulk/manage |
| `VIEWER` | Read-only access | View only |

**Note:** `ADMIN` at tenant level is equivalent to `MANAGER` in the permission system.

---

## How They Work Together

A user has:
1. **One platform role** (e.g., `USER`)
2. **Multiple tenant roles** (e.g., `OWNER` at Store A, `MEMBER` at Store B)

### Example User:
```
Platform Role: USER
Tenant Roles:
  - Store A (tenant_123): OWNER
  - Store B (tenant_456): MEMBER
  - Store C (tenant_789): VIEWER
```

This user:
- Can create up to 3 tenants (platform limit for `USER` role)
- Has full control at Store A (tenant `OWNER`)
- Can edit items at Store B (tenant `MEMBER`)
- Can only view at Store C (tenant `VIEWER`)

---

## Platform Role Bypass Rules

### PLATFORM_ADMIN
- **Bypasses all checks** (tier + role)
- Can access any tenant with full permissions
- No tenant limits

### PLATFORM_SUPPORT
- **Bypasses tier checks** but respects tenant roles
- Can view all tenants
- Limited to 3 owned tenants globally
- Can perform support actions (password resets, etc.)

### PLATFORM_VIEWER
- **Bypasses tier checks** for read-only access
- Can view all tenants (read-only)
- Cannot create tenants
- Cannot perform write operations

---

## Where to Manage Each Role Type

### Platform Roles
**Location:** `/settings/admin/users`  
**Who can manage:** `PLATFORM_ADMIN` only  
**Changes:** Global access level

**Use cases:**
- Promote user to Platform Admin
- Grant support team access (Platform Support)
- Give analytics team read access (Platform Viewer)
- Allow user to create tenants (Owner vs User)

### Tenant Roles
**Location:** `/t/{tenantId}/settings/team`  
**Who can manage:** Tenant `OWNER` or `ADMIN`  
**Changes:** Per-location access

**Use cases:**
- Add employee to a store (Member)
- Give manager full access (Admin)
- Grant accountant read-only access (Viewer)
- Transfer ownership (Owner)

---

## Common Scenarios

### Scenario 1: New Employee at Single Store
1. Create user with platform role: `USER`
2. Add to tenant with role: `MEMBER`
3. Result: Can edit items at that store only

### Scenario 2: Multi-Store Manager
1. Create user with platform role: `OWNER`
2. Add to Store A with role: `OWNER`
3. Add to Store B with role: `ADMIN`
4. Add to Store C with role: `ADMIN`
5. Result: Can manage 3 stores, owns Store A

### Scenario 3: Support Team Member
1. Create user with platform role: `PLATFORM_SUPPORT`
2. No tenant assignments needed
3. Result: Can view all tenants, perform support actions

### Scenario 4: Analytics Team Member
1. Create user with platform role: `PLATFORM_VIEWER`
2. No tenant assignments needed
3. Result: Can view all tenant data (read-only)

---

## Migration Notes

### Deprecated Roles
- `ADMIN` (platform level) → Use `PLATFORM_ADMIN`
- System still supports `ADMIN` for backward compatibility

### Role Alignment
- Tenant `ADMIN` = Tenant `MANAGER` in permission system
- Both have same operational permissions
- Only difference: `OWNER` can manage billing

---

## Technical Implementation

### Database Schema
```prisma
model User {
  role UserRole @default(USER)
  tenants UserTenant[]
}

enum UserRole {
  PLATFORM_ADMIN
  PLATFORM_SUPPORT
  PLATFORM_VIEWER
  ADMIN // Deprecated
  OWNER
  USER
}

model UserTenant {
  userId String
  tenantId String
  role UserTenantRole @default(MEMBER)
}

enum UserTenantRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}
```

### Permission Checks
```typescript
// Platform-level check
if (user.role === 'PLATFORM_ADMIN') {
  // Full access
}

// Tenant-level check
const userTenant = await prisma.userTenant.findUnique({
  where: { userId_tenantId: { userId, tenantId } }
});

if (userTenant.role === 'OWNER' || userTenant.role === 'ADMIN') {
  // Can manage tenant
}
```

---

## Best Practices

1. **Use platform roles sparingly**
   - Most users should be `USER` or `OWNER`
   - Reserve `PLATFORM_ADMIN` for actual admins
   - Use `PLATFORM_SUPPORT` for support team only

2. **Manage access at tenant level**
   - Use tenant roles for day-to-day access control
   - More granular and flexible
   - Easier to audit per location

3. **Document role changes**
   - Platform role changes affect global access
   - Tenant role changes are per-location
   - Both are tracked in audit logs

4. **Test with different roles**
   - Always test features with `VIEWER` (most restrictive)
   - Verify `MEMBER` can edit but not manage
   - Confirm `ADMIN`/`MANAGER` has full access

---

## Summary

**Platform Roles** = Who you are globally  
**Tenant Roles** = What you can do at each location

Both work together to provide flexible, secure access control across the entire platform.
