# User Role Assignment Flows

**Status:** ✅ CONFIRMED - Staging Working

## Overview

This document confirms the default roles assigned to users based on how they join the platform.

---

## 1. Self-Signup (Public Registration)

**Endpoint:** `POST /api/auth/register`

**Flow:**
1. User visits public registration page
2. Fills out registration form (email, password, name)
3. Submits registration

**Default Role Assigned:**
```typescript
role: UserRole.USER  // Regular user
```

**Code Reference:**
```typescript
// apps/api/src/auth/auth.service.ts:111
const user = await prisma.user.create({
  data: {
    email: data.email.toLowerCase(),
    passwordHash,
    firstName: data.firstName,
    lastName: data.lastName,
    role: UserRole.USER,  // ← DEFAULT FOR SELF-SIGNUP
  },
});
```

**Characteristics:**
- ✅ Platform Role: `USER`
- ✅ Can login immediately
- ✅ No tenant access by default
- ✅ Must be invited to tenants by tenant admins
- ✅ Tier-based tenant creation limits apply

---

## 2. Admin-Created Users (Test Users)

**Endpoint:** `POST /api/admin/users`

**Flow:**
1. Platform Admin creates user via `/admin/users` page
2. Specifies email, password, name, and role
3. User is created with specified role

**Roles Available:**
```typescript
role: z.enum(['USER', 'ADMIN']).default('USER')
```

**Default Role:** `USER` (if not specified)

**Code Reference:**
```typescript
// apps/api/src/routes/admin-users.ts:65
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  role: z.enum(['USER', 'ADMIN']).default('USER'),  // ← DEFAULT IS USER
});
```

**Characteristics:**
- ✅ Platform Role: `USER` or `ADMIN` (admin chooses)
- ✅ Can login immediately (password provided)
- ✅ No tenant access by default
- ✅ Must be added to tenants separately

---

## 3. Tenant Invitation (Add Existing User to Tenant)

**Endpoint:** `POST /tenants/:tenantId/users`

**Flow:**
1. Tenant Owner/Admin invites user by email
2. User must already exist in the system
3. User is added to tenant with specified tenant role

**Tenant Roles Available:**
```typescript
role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
```

**Code Reference:**
```typescript
// apps/api/src/routes/tenant-users.ts:67-69
const addUserToTenantSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});
```

**Important Notes:**
- ⚠️ User must already exist (have a platform account)
- ⚠️ This only assigns **tenant-level role**, not platform role
- ⚠️ Platform role remains unchanged (USER, ADMIN, etc.)
- ✅ User can have different roles in different tenants

---

## Role Hierarchy Summary

### Platform Roles (Global Access)
| Role | Assigned By | Default For | Tenant Limits |
|------|-------------|-------------|---------------|
| `PLATFORM_ADMIN` | Manual/Script | N/A | Unlimited |
| `PLATFORM_SUPPORT` | Manual/Script | N/A | 3 tenants |
| `PLATFORM_VIEWER` | Manual/Script | N/A | 0 tenants (read-only) |
| `ADMIN` | Admin Creation | Admin-created users (optional) | Unlimited |
| `OWNER` | Manual/Script | N/A | Tier-based |
| `USER` | Self-Signup | **Self-signup users** | Tier-based |

### Tenant Roles (Per-Tenant Access)
| Role | Permissions | Can Delete |
|------|-------------|------------|
| `OWNER` | Full control + billing | ✅ Yes |
| `ADMIN` | Full operations, no billing | ✅ Yes |
| `SUPPORT` | Operations, no delete | ❌ No |
| `MEMBER` | Edit only | ❌ No |
| `VIEWER` | Read-only | ❌ No |

---

## Key Differences

### Self-Signup vs Admin-Created

| Aspect | Self-Signup | Admin-Created |
|--------|-------------|---------------|
| **Endpoint** | `/api/auth/register` | `/api/admin/users` |
| **Who Creates** | User themselves | Platform Admin |
| **Default Role** | `USER` | `USER` (or `ADMIN` if specified) |
| **Email Verification** | Required | Not required |
| **Password** | User chooses | Admin sets |
| **Tenant Access** | None (must be invited) | None (must be added) |

### Platform Role vs Tenant Role

| Aspect | Platform Role | Tenant Role |
|--------|---------------|-------------|
| **Scope** | Global (entire platform) | Per-tenant (specific location) |
| **Assigned At** | User creation | Tenant invitation |
| **Can Change** | Rarely (admin only) | Yes (by tenant admin) |
| **Examples** | USER, ADMIN, PLATFORM_ADMIN | OWNER, ADMIN, MEMBER, VIEWER |
| **Affects** | Tenant creation limits, platform access | Permissions within tenant |

---

## Common Scenarios

### Scenario 1: New User Self-Signup
1. User registers at `/register`
2. Gets `USER` platform role
3. Has no tenant access
4. Needs to create own tenant OR be invited to existing tenant

### Scenario 2: Admin Creates Test User
1. Admin creates user at `/admin/users`
2. Assigns `USER` or `ADMIN` platform role
3. User has no tenant access
4. Admin must add user to test tenants separately

### Scenario 3: Invite User to Tenant
1. User must already exist (platform account)
2. Tenant admin invites by email
3. User gets tenant-specific role (OWNER, ADMIN, MEMBER, VIEWER)
4. Platform role unchanged
5. User can now access that tenant

### Scenario 4: User in Multiple Tenants
1. User has one platform role (e.g., `USER`)
2. Can be `OWNER` in Tenant A
3. Can be `MEMBER` in Tenant B
4. Can be `VIEWER` in Tenant C
5. Permissions vary by tenant

---

## Security Implications

### Platform Role Security
- ✅ `USER` is safest default for self-signup
- ✅ Prevents unauthorized platform-wide access
- ✅ Limits tenant creation based on subscription tier
- ✅ Cannot access admin features

### Tenant Role Security
- ✅ Tenant admins control who joins their tenant
- ✅ Can assign appropriate permissions per user
- ✅ Can revoke access at any time
- ✅ Roles are isolated per tenant

---

## Recommendations

### For Self-Signup Users
- ✅ Keep default as `USER` (current behavior)
- ✅ Require email verification
- ✅ Apply tier-based tenant limits
- ✅ Clear onboarding for tenant creation

### For Admin-Created Users
- ✅ Default to `USER` unless specific need for `ADMIN`
- ✅ Use for testing and support scenarios
- ✅ Document which users are test accounts
- ✅ Clean up test users periodically

### For Tenant Invitations
- ✅ Verify user exists before inviting
- ✅ Assign least-privilege role initially
- ✅ Provide clear role descriptions
- ✅ Allow role changes as needed

---

## Current Status

**Staging Environment:** ✅ CONFIRMED WORKING
- Self-signup assigns `USER` role correctly
- Admin creation allows `USER` or `ADMIN` selection
- Tenant invitations work with proper role assignment
- No role conflicts or security issues detected

**Production Readiness:** ✅ READY
- Role assignment logic is correct
- Security boundaries are enforced
- Default roles are appropriate
- No changes needed before production deploy

---

## Files Reference

**Authentication:**
- `apps/api/src/auth/auth.service.ts` - Self-signup logic (line 111)
- `apps/api/src/auth/auth.routes.ts` - Registration endpoint

**Admin User Creation:**
- `apps/api/src/routes/admin-users.ts` - Admin user creation (line 65)

**Tenant User Management:**
- `apps/api/src/routes/tenant-users.ts` - Tenant invitation (line 67)

**Type Definitions:**
- `apps/api/prisma/schema.prisma` - UserRole and UserTenantRole enums
- `apps/web/src/contexts/AuthContext.tsx` - Frontend user types

---

**Last Updated:** November 12, 2025  
**Verified In:** Staging Environment (`visibleshelf.store`)  
**Status:** Production Ready ✅
