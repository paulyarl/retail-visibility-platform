# Access Level Hierarchy - Official Standard

**Status:** ✅ OFFICIAL STANDARD  
**Date:** November 11, 2025

## Overview

Complete access level hierarchy for the Retail Visibility Platform, defining clear descriptions and capabilities for both platform and tenant roles.

---

## Platform Roles

Platform roles operate **across all tenants** and have platform-wide scope.

### PLATFORM_ADMIN
**Description:** Full platform access

**Capabilities:**
- Manage all tenants and users
- Access platform administration
- Configure platform settings
- View all analytics and reports
- Manage feature flags
- Access admin tools
- Unlimited location creation
- Unlimited SKU access across all tiers

**Scope:** Platform-wide (all tenants)

---

### PLATFORM_SUPPORT
**Description:** Support platform access

**Capabilities:**
- View and manage tenants for support purposes
- Access support tools
- View analytics and reports
- Test features across tenants
- Limited to 3 test locations globally
- Tier-based SKU limits for testing

**Scope:** Platform-wide (all tenants, limited creation)

---

### PLATFORM_VIEWER
**Description:** Basic platform access

**Capabilities:**
- Read-only access across all tenants
- View analytics and reports
- Monitor platform health
- Cannot create or modify data
- 0 location creation (read-only)
- Cannot modify SKUs

**Scope:** Platform-wide (read-only)

---

## Tenant Roles

Tenant roles operate **within assigned tenants** and have tenant-scoped access.

### TENANT_OWNER
**Description:** Full tenant access

**Capabilities:**
- Full control over owned tenant
- Manage tenant settings
- Invite and manage team members
- Configure store branding
- Access all tenant features
- View tenant analytics
- Delete owned tenants
- Subject to tier-based location limits
- Subject to tier-based SKU limits

**Scope:** Owned tenants only

---

### TENANT_ADMIN
**Description:** Support tenant access

**Capabilities:**
- Same operational permissions as Owner
- Manage tenant settings
- Invite and manage team members
- Configure store branding
- Access all tenant features
- View tenant analytics
- **Cannot delete tenants** (key difference from Owner)
- Subject to tier-based location limits
- Subject to tier-based SKU limits

**Scope:** Assigned tenants only

---

### TENANT_MEMBER
**Description:** Basic tenant access

**Capabilities:**
- Access assigned tenants
- Manage products and inventory
- View tenant analytics
- Update business hours
- Edit items and data
- **Cannot manage users or settings**
- **Cannot perform bulk operations**
- Subject to tier-based SKU limits

**Scope:** Assigned tenants only (edit access)

---

### TENANT_VIEWER
**Description:** Limited tenant access

**Capabilities:**
- Read-only access to assigned tenants
- View products and inventory
- View tenant analytics
- View business hours
- **Cannot edit or modify data**
- **Cannot manage users or settings**

**Scope:** Assigned tenants only (read-only)

---

## Access Level Matrix

| Role | Access Level | Scope | Create Locations | Manage SKUs | Delete Tenants | Manage Users |
|------|--------------|-------|------------------|-------------|----------------|--------------|
| **PLATFORM_ADMIN** | Full platform | Platform-wide | ∞ Unlimited | ✅ All tiers | ✅ Any tenant | ✅ All users |
| **PLATFORM_SUPPORT** | Support platform | Platform-wide | ⚠️ 3 global | ✅ Tier-based | ❌ None | ✅ Support ops |
| **PLATFORM_VIEWER** | Basic platform | Platform-wide | ❌ Read-only | ❌ Read-only | ❌ None | ❌ Read-only |
| **TENANT_OWNER** | Full tenant | Owned tenants | ⚠️ Tier-based | ✅ Tier-based | ✅ Owned only | ✅ Tenant users |
| **TENANT_ADMIN** | Support tenant | Assigned tenants | ⚠️ Tier-based | ✅ Tier-based | ❌ None | ✅ Tenant users |
| **TENANT_MEMBER** | Basic tenant | Assigned tenants | ❌ None | ✅ Edit only | ❌ None | ❌ None |
| **TENANT_VIEWER** | Limited tenant | Assigned tenants | ❌ None | ❌ Read-only | ❌ None | ❌ None |

---

## Hierarchy Visualization

```
┌─────────────────────────────────────────────────────────┐
│                   PLATFORM LEVEL                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  PLATFORM_ADMIN                                         │
│  └─ Full platform access                                │
│     └─ Unlimited locations, all SKUs, all tenants      │
│                                                          │
│  PLATFORM_SUPPORT                                       │
│  └─ Support platform access                             │
│     └─ 3 locations globally, tier SKUs, all tenants    │
│                                                          │
│  PLATFORM_VIEWER                                        │
│  └─ Basic platform access                               │
│     └─ Read-only, 0 locations, all tenants             │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    TENANT LEVEL                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  TENANT_OWNER                                           │
│  └─ Full tenant access                                  │
│     └─ Tier locations, tier SKUs, can delete           │
│                                                          │
│  TENANT_ADMIN                                           │
│  └─ Support tenant access                               │
│     └─ Tier locations, tier SKUs, cannot delete        │
│                                                          │
│  TENANT_MEMBER                                          │
│  └─ Basic tenant access                                 │
│     └─ Edit only, no bulk ops, no user management      │
│                                                          │
│  TENANT_VIEWER                                          │
│  └─ Limited tenant access                               │
│     └─ Read-only, view only                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Key Distinctions

### Platform vs Tenant

**Platform Roles:**
- Operate **across** tenants
- Platform-wide scope
- Not subject to individual tenant tier limits (except Support)
- Can access any tenant

**Tenant Roles:**
- Operate **within** tenants
- Tenant-scoped access
- Subject to tier-based limits
- Can only access assigned tenants

### Full vs Support vs Basic vs Limited

**Full Access:**
- Complete control
- Can create, edit, delete
- Can manage users and settings
- Examples: PLATFORM_ADMIN, TENANT_OWNER

**Support Access:**
- Operational control
- Can create, edit (but not delete)
- Can manage users and settings
- Examples: PLATFORM_SUPPORT, TENANT_ADMIN

**Basic Access:**
- Edit capabilities
- Can create and edit data
- Cannot manage users or settings
- Cannot perform bulk operations
- Examples: TENANT_MEMBER

**Limited Access:**
- Read-only
- Can view data
- Cannot edit or modify
- Cannot manage anything
- Examples: PLATFORM_VIEWER, TENANT_VIEWER

---

## Permission Inheritance

### Platform Roles
```
PLATFORM_ADMIN
  ↓ (includes all of)
PLATFORM_SUPPORT
  ↓ (includes all of)
PLATFORM_VIEWER
```

**Note:** Platform roles do NOT inherit tenant role permissions. They bypass tenant checks entirely.

### Tenant Roles
```
TENANT_OWNER
  ↓ (includes all of)
TENANT_ADMIN
  ↓ (includes all of)
TENANT_MEMBER
  ↓ (includes all of)
TENANT_VIEWER
```

**Note:** Higher tenant roles include all permissions of lower roles, plus additional capabilities.

---

## Implementation Locations

### Backend

**Middleware:**
- `apps/api/src/middleware/auth.ts` - Role checks
- `apps/api/src/middleware/permissions.ts` - Permission enforcement
- `apps/api/src/utils/platform-admin.ts` - Platform role utilities

**Routes:**
- All API routes use role-based access control
- Platform routes bypass tenant checks
- Tenant routes enforce tenant membership

### Frontend

**Components:**
- `apps/web/src/app/(platform)/settings/account/page.tsx` - Role display
- `apps/web/src/components/permissions/AccessGate.tsx` - Permission gates
- `apps/web/src/hooks/dashboard/useTenantTier.ts` - Permission checks

**Contexts:**
- `apps/web/src/contexts/AuthContext.tsx` - User role management

---

## Usage Guidelines

### When to Use Platform Roles

**PLATFORM_ADMIN:**
- System administrators
- Platform owners
- Full control needed

**PLATFORM_SUPPORT:**
- Support staff
- Testing purposes
- Cross-tenant troubleshooting

**PLATFORM_VIEWER:**
- Monitoring systems
- Read-only dashboards
- Analytics viewers

### When to Use Tenant Roles

**TENANT_OWNER:**
- Business owners
- Location managers
- Full tenant control needed

**TENANT_ADMIN:**
- Store managers
- Operational staff
- Day-to-day management

**TENANT_MEMBER:**
- Staff members
- Product managers
- Data entry personnel

**TENANT_VIEWER:**
- Contractors
- Auditors
- Read-only access needed

---

## Security Considerations

### Platform Role Security

1. **PLATFORM_ADMIN** - Highest privilege
   - Assign sparingly
   - Audit all actions
   - Require MFA

2. **PLATFORM_SUPPORT** - Limited privilege
   - Time-bound access recommended
   - Monitor creation limits
   - Audit support actions

3. **PLATFORM_VIEWER** - Read-only
   - Safe for monitoring
   - No data modification risk
   - Still audit access patterns

### Tenant Role Security

1. **TENANT_OWNER** - Full tenant control
   - One per tenant recommended
   - Can transfer ownership
   - Subject to tier limits

2. **TENANT_ADMIN** - Operational control
   - Multiple per tenant allowed
   - Cannot delete tenant (safety)
   - Subject to tier limits

3. **TENANT_MEMBER** - Edit access
   - Bulk assignment safe
   - Limited damage potential
   - No user management

4. **TENANT_VIEWER** - Read-only
   - Safest role
   - No modification risk
   - Unlimited assignment

---

## Testing Matrix

### Platform Role Tests

| Test | ADMIN | SUPPORT | VIEWER |
|------|-------|---------|--------|
| Create unlimited locations | ✅ Pass | ❌ Fail (3 max) | ❌ Fail (0) |
| Access any tenant | ✅ Pass | ✅ Pass | ✅ Pass (read-only) |
| Delete any tenant | ✅ Pass | ❌ Fail | ❌ Fail |
| Manage all users | ✅ Pass | ✅ Pass (support) | ❌ Fail |
| Modify platform settings | ✅ Pass | ❌ Fail | ❌ Fail |

### Tenant Role Tests

| Test | OWNER | ADMIN | MEMBER | VIEWER |
|------|-------|-------|--------|--------|
| Create location (within tier) | ✅ Pass | ✅ Pass | ❌ Fail | ❌ Fail |
| Delete owned tenant | ✅ Pass | ❌ Fail | ❌ Fail | ❌ Fail |
| Manage tenant users | ✅ Pass | ✅ Pass | ❌ Fail | ❌ Fail |
| Edit products | ✅ Pass | ✅ Pass | ✅ Pass | ❌ Fail |
| View analytics | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass |

---

## Conclusion

**This is the official access level hierarchy for the platform.**

All features must respect this hierarchy:
- ✅ Platform roles operate across tenants
- ✅ Tenant roles operate within tenants
- ✅ Full > Support > Basic > Limited
- ✅ Clear capability boundaries
- ✅ Security-first design

**Use this document as the single source of truth for access levels!** 🔒

---

## Related Documentation

- `MLRLM_MULTI_LOCATION_RETAIL_LOCATION_MAINTENANCE.md` - Location limits by role
- `TENANT_LIMITS_IMPLEMENTATION_COMPLETE.md` - Limit enforcement
- `PERMISSION_SYSTEM.md` - Multi-level permission system
- `apps/api/src/middleware/permissions.ts` - Backend enforcement
- `apps/web/src/app/(platform)/settings/account/page.tsx` - Frontend display
