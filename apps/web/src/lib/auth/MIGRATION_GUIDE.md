# Access Control Migration Guide

This guide shows how to migrate from custom access control logic to the centralized system.

## Overview

The new access control system provides:
- ✅ Centralized permission logic
- ✅ Consistent security across the platform
- ✅ Reusable React hooks
- ✅ Type-safe access checks
- ✅ Platform admin override support

## Quick Start

### 1. Import the Hook

```typescript
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
```

### 2. Use in Your Component

```typescript
export default function MyProtectedPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  // Check access with preset
  const { hasAccess, loading, accessReason, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.TENANT_ADMIN  // or ORGANIZATION_ADMIN, PLATFORM_ADMIN_ONLY, etc.
  );
  
  if (loading) {
    return <Spinner />;
  }
  
  if (!hasAccess) {
    return (
      <AccessDenied
        message="This feature is only available to organization owners and administrators."
        userRole={tenantRole}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }
  
  // Your protected content here
  return <div>Protected Content</div>;
}
```

## Migration Example: Propagation Control Panel

### Before (Custom Logic)

```typescript
const [userRole, setUserRole] = useState<string | null>(null);
const [hasAccess, setHasAccess] = useState(false);

useEffect(() => {
  async function loadOrganizationInfo() {
    const userRes = await api.get(`${API_BASE_URL}/auth/me`);
    if (userRes.ok) {
      const userData = await userRes.json();
      const tenantRole = userData.tenants?.find((t: any) => t.tenantId === tenantId);
      const role = tenantRole?.role || null;
      setUserRole(role);
      
      const isPlatformAdmin = userData.isPlatformAdmin === true || userData.role === 'ADMIN';
      const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
      setHasAccess(isPlatformAdmin || isOwnerOrAdmin);
    }
  }
  loadOrganizationInfo();
}, []);

if (!hasAccess) {
  return <div>Access Denied</div>;
}
```

### After (Centralized System)

```typescript
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

const { hasAccess, loading, tenantRole } = useAccessControl(
  tenantId,
  AccessPresets.ORGANIZATION_ADMIN
);

if (loading) return <Spinner />;

if (!hasAccess) {
  return (
    <AccessDenied
      message="The Propagation Control Panel is only available to organization owners and administrators."
      userRole={tenantRole}
    />
  );
}
```

## Available Presets

### `AccessPresets.PLATFORM_ADMIN_ONLY`
Platform administrators only (no override)

### `AccessPresets.TENANT_ADMIN`
Tenant owners/admins, or platform admins

### `AccessPresets.TENANT_OWNER_ONLY`
Tenant owners only, or platform admins

### `AccessPresets.ORGANIZATION_ADMIN`
Organization owners/admins (for chain features), or platform admins

### `AccessPresets.AUTHENTICATED`
Any authenticated user

## Custom Access Control

For custom requirements:

```typescript
const { hasAccess } = useAccessControl(tenantId, {
  requireTenantRole: ['OWNER'],
  requireOrganization: true,
  allowPlatformAdminOverride: true,
});
```

## Utility Functions

For non-React code:

```typescript
import { 
  isPlatformAdmin, 
  isTenantOwnerOrAdmin,
  checkAccess 
} from '@/lib/auth/access-control';

// Check if user is platform admin
if (isPlatformAdmin(userData)) {
  // ...
}

// Check tenant role
if (isTenantOwnerOrAdmin(userData, tenantId)) {
  // ...
}

// Full access check
const result = checkAccess(userData, tenantId, {
  requireTenantRole: ['OWNER', 'ADMIN'],
});

if (result.hasAccess) {
  // ...
}
```

## Benefits

1. **Consistency**: Same logic everywhere
2. **Maintainability**: Update in one place
3. **Type Safety**: Full TypeScript support
4. **Testing**: Easy to mock and test
5. **Platform Admin Override**: Built-in support
6. **Reusable UI**: Standard AccessDenied component

## Migration Checklist

- [ ] Replace custom useEffect access checks with `useAccessControl`
- [ ] Replace custom access denied UI with `<AccessDenied />`
- [ ] Remove duplicate user fetching logic
- [ ] Use appropriate `AccessPresets` for your use case
- [ ] Test with different user roles
- [ ] Test platform admin override
- [ ] Remove console.log debugging statements
