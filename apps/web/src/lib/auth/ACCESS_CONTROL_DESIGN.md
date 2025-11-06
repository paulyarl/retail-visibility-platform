# Access Control System Design

## Overview

This document describes the comprehensive access control system that manages permissions across the entire platform, handling complex scenarios involving platform admins, organizations, chains, tenants, and user roles.

## Permission Hierarchy

```
1. Platform Admin
   └─ Full access to everything (can override all checks)

2. Organization Owner/Admin (Hero Tenant)
   └─ Full access within their organization
   └─ Can propagate to all locations
   └─ Can manage organization settings

3. Organization Member (Any Tenant)
   └─ Admin access to their specific tenant(s)
   └─ Can view organization info
   └─ Cannot propagate

4. Tenant Owner
   └─ Full access to their specific tenant
   └─ Cannot access other tenants

5. Tenant Admin
   └─ Admin access to their specific tenant
   └─ Cannot access other tenants

6. Tenant Member
   └─ Basic access to their specific tenant
   └─ Read-only for most features

7. Regular User
   └─ No tenant access
   └─ Platform-level features only
```

## Core Concepts

### 1. Platform Admin
- **Definition**: User with `isPlatformAdmin: true` or `role: 'ADMIN'`
- **Access**: Full access to all features, all tenants, all organizations
- **Override**: Can bypass all permission checks (unless explicitly disabled)
- **Use Cases**: Support, training, debugging, platform management

### 2. Organization Context
- **Definition**: A group of tenants (locations) in a chain
- **Hero Location**: One designated tenant as the "source of truth"
- **Organization Admin**: Owner/Admin of the hero location
- **Organization Member**: Owner/Admin of any location in the organization

### 3. Tenant Context
- **Definition**: A single business location
- **Scoped Access**: User's role is specific to each tenant
- **Independent**: Tenants can exist without an organization

## Access Control Options

### Basic Options

```typescript
{
  // Require platform admin (strict - no override)
  requirePlatformAdmin: boolean;
  
  // Require specific role for the scoped tenant
  requireTenantRole: ['OWNER', 'ADMIN', 'MEMBER'];
  
  // Allow platform admin to bypass (default: true)
  allowPlatformAdminOverride: boolean;
}
```

### Organization Options

```typescript
{
  // Require tenant to be in an organization
  requireOrganization: boolean;
  
  // Require user to be owner/admin of hero tenant
  requireOrganizationAdmin: boolean;
  
  // Require user to be owner/admin of ANY tenant in org
  requireOrganizationMember: boolean;
  
  // Require tenant to be the hero location
  requireHeroLocation: boolean;
}
```

### Advanced Options

```typescript
{
  // Custom validation function
  customCheck: (user, context) => boolean;
}
```

## Common Scenarios

### Scenario 1: Platform Admin Dashboard
**Requirement**: Only platform admins
```typescript
AccessPresets.PLATFORM_ADMIN_ONLY
```

### Scenario 2: Tenant Settings
**Requirement**: Tenant owner/admin, or platform admin
```typescript
AccessPresets.TENANT_ADMIN
```

### Scenario 3: Organization Dashboard
**Requirement**: Organization admin (hero owner/admin), or platform admin
```typescript
AccessPresets.ORGANIZATION_ADMIN
```

### Scenario 4: Propagation Control Panel
**Requirement**: Organization admin, or platform admin
```typescript
AccessPresets.CHAIN_PROPAGATION
// Same as ORGANIZATION_ADMIN
```

### Scenario 5: View Organization Info
**Requirement**: Any member of the organization, or platform admin
```typescript
AccessPresets.ORGANIZATION_MEMBER
```

### Scenario 6: Hero Location Settings
**Requirement**: Must be hero + owner/admin, or platform admin
```typescript
AccessPresets.HERO_LOCATION_ADMIN
```

## Complex Scenarios

### Scenario A: Multi-Tenant User
**User**: Admin of Location A, Member of Location B
**Access**:
- ✅ Can admin Location A
- ❌ Cannot admin Location B
- ✅ Can view both in tenant list

```typescript
// For Location A
const { hasAccess } = useAccessControl(locationA, AccessPresets.TENANT_ADMIN);
// hasAccess = true

// For Location B
const { hasAccess } = useAccessControl(locationB, AccessPresets.TENANT_ADMIN);
// hasAccess = false
```

### Scenario B: Organization with Multiple Admins
**Organization**: 6 locations, Hero = Location 1
**User A**: Owner of Location 1 (Hero)
**User B**: Admin of Location 3

**Access for User A**:
- ✅ Can propagate (org admin)
- ✅ Can manage all locations
- ✅ Can set hero location

**Access for User B**:
- ❌ Cannot propagate (not org admin)
- ✅ Can admin Location 3 only
- ❌ Cannot set hero location

```typescript
// User A (Hero Admin)
const { hasAccess, isOrgAdmin } = useAccessControl(
  location1,
  AccessPresets.ORGANIZATION_ADMIN,
  true // fetch organization
);
// hasAccess = true, isOrgAdmin = true

// User B (Location Admin)
const { hasAccess, isOrgAdmin } = useAccessControl(
  location3,
  AccessPresets.ORGANIZATION_ADMIN,
  true
);
// hasAccess = false, isOrgAdmin = false
```

### Scenario C: Platform Admin Viewing Any Tenant
**User**: Platform Admin (no explicit tenant roles)
**Access**:
- ✅ Can access any tenant
- ✅ Can access any organization
- ✅ Can propagate for any chain
- ✅ Bypasses all role checks

```typescript
// Platform admin accessing any tenant
const { hasAccess, isPlatformAdmin } = useAccessControl(
  anyTenantId,
  AccessPresets.TENANT_ADMIN
);
// hasAccess = true (via override), isPlatformAdmin = true
```

### Scenario D: Propagation from Non-Hero Location
**Organization**: Hero = Location 1
**User**: Viewing from Location 2 (not hero)
**Requirement**: Must be admin of hero location

```typescript
// User is admin of Location 2, trying to propagate
const { hasAccess, isOrgAdmin } = useAccessControl(
  location2, // Current scope
  AccessPresets.CHAIN_PROPAGATION,
  true
);
// hasAccess depends on if user is admin of Location 1 (hero)
```

## Usage Examples

### Example 1: Simple Tenant Admin Check
```typescript
const { hasAccess, loading, tenantRole } = useAccessControl(
  tenantId,
  AccessPresets.TENANT_ADMIN
);

if (loading) return <Spinner />;
if (!hasAccess) return <AccessDenied userRole={tenantRole} />;
```

### Example 2: Organization-Aware Check
```typescript
const { hasAccess, loading, isOrgAdmin, organizationData } = useAccessControl(
  tenantId,
  AccessPresets.ORGANIZATION_ADMIN,
  true // Fetch organization data
);

if (loading) return <Spinner />;
if (!hasAccess) {
  return <AccessDenied message="Organization admin access required" />;
}

// Access granted - show organization features
return <PropagationControlPanel organization={organizationData} />;
```

### Example 3: Custom Complex Check
```typescript
const { hasAccess, user, tenantData, organizationData } = useAccessControl(
  tenantId,
  {
    requireOrganization: true,
    customCheck: (user, context) => {
      // Custom logic: Must be admin of at least 2 locations
      const adminTenants = user.tenants?.filter(t => 
        t.role === 'OWNER' || t.role === 'ADMIN'
      ) || [];
      return adminTenants.length >= 2;
    },
  },
  true
);
```

### Example 4: Platform Admin Override Control
```typescript
// Strict - platform admin CANNOT override
const { hasAccess } = useAccessControl(
  tenantId,
  {
    requireTenantRole: ['OWNER'],
    allowPlatformAdminOverride: false, // Strict
  }
);

// Flexible - platform admin CAN override (default)
const { hasAccess } = useAccessControl(
  tenantId,
  {
    requireTenantRole: ['OWNER'],
    allowPlatformAdminOverride: true, // Default
  }
);
```

## Migration Path

### Phase 1: Core Pages (Immediate)
- ✅ Propagation Control Panel
- ✅ Organization Dashboard
- ✅ Tenant Settings

### Phase 2: Admin Pages
- Platform Admin Dashboard
- User Management
- Feature Flags

### Phase 3: Feature Pages
- Categories
- Products
- Business Hours
- All other tenant-scoped pages

## Testing Checklist

- [ ] Platform admin can access everything
- [ ] Org admin can propagate
- [ ] Org member cannot propagate
- [ ] Tenant admin can access their tenant
- [ ] Tenant member has limited access
- [ ] Non-hero location admin cannot propagate
- [ ] Hero location admin can propagate
- [ ] Multi-tenant user has correct access per tenant
- [ ] Organization requirement blocks non-org tenants
- [ ] Hero requirement blocks non-hero tenants

## Benefits

1. **Consistency**: Same logic everywhere
2. **Security**: Centralized, auditable permission checks
3. **Flexibility**: Handles simple and complex scenarios
4. **Maintainability**: Update once, applies everywhere
5. **Type Safety**: Full TypeScript support
6. **Testability**: Easy to mock and test
7. **Documentation**: Self-documenting presets
8. **Performance**: Efficient data fetching
9. **Developer Experience**: Simple API, clear errors
10. **Scalability**: Easy to add new permission types
