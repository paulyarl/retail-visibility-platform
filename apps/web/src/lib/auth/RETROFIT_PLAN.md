# Access Control Retrofit Plan

## Overview

This document outlines the systematic plan to retrofit all existing pages with the new centralized access control system for platform integrity and consistency.

## 🎯 Core Principle: Fix Once, Apply Everywhere

**The Power of Centralization:**
When we discovered bugs in the access control system (wrong API endpoint, wrong response structure, wrong field checks), we fixed them in ONE place and ALL pages using the system were immediately fixed. This is the key value of centralized middleware.

**Lesson Learned:**
- ✅ Fix bugs once in the utility → All pages benefit
- ✅ Add features once → All pages get them
- ✅ Change logic once → Consistent everywhere
- ❌ Custom logic per page → Fix bugs N times, high risk of inconsistency

## Goals

1. ✅ Replace all custom access control logic
2. ✅ Ensure consistent security across the platform
3. ✅ Improve maintainability
4. ✅ Add proper platform admin support everywhere
5. ✅ Handle organization context correctly
6. ✅ Provide clear access denied messages
7. ✅ **Establish single source of truth for all future implementations**

## 🚨 Mandatory Rules Going Forward

**For ALL New Pages:**
1. ✅ MUST use `useAccessControl` hook
2. ✅ MUST use `AccessPresets` or define custom options
3. ✅ MUST use `<AccessDenied />` component
4. ❌ NEVER implement custom access control logic
5. ❌ NEVER duplicate user fetching
6. ❌ NEVER create custom access denied UI

**For ALL Existing Pages:**
1. Must be retrofitted following this plan
2. Custom logic must be removed
3. Must be tested with all user roles

**Enforcement:**
- Code reviews must check for centralized access control usage
- PRs with custom access control logic will be rejected
- All security-related changes go through the centralized system

## Phase 1: Critical Pages (Priority 1) 🔴

### 1.1 Propagation Control Panel ✅ DONE
- **File**: `apps/web/src/app/t/[tenantId]/settings/propagation/page.tsx`
- **Current**: Custom isPlatformAdmin check
- **Target**: `AccessPresets.CHAIN_PROPAGATION`
- **Status**: Partially migrated, needs full retrofit

### 1.2 Organization Dashboard
- **File**: `apps/web/src/app/(platform)/settings/organization/page.tsx`
- **Current**: No access control
- **Target**: `AccessPresets.ORGANIZATION_MEMBER`
- **Status**: Needs migration

### 1.3 Admin Dashboard
- **File**: `apps/web/src/app/(platform)/settings/admin/page.tsx`
- **Current**: ProtectedRoute only
- **Target**: `AccessPresets.PLATFORM_ADMIN_ONLY`
- **Status**: Needs migration

## Phase 2: Tenant Management (Priority 2) 🟡

### 2.1 Tenant Settings
- **File**: `apps/web/src/app/t/[tenantId]/settings/tenant/page.tsx`
- **Current**: Unknown
- **Target**: `AccessPresets.TENANT_ADMIN`
- **Status**: Needs audit

### 2.2 Team Members
- **File**: `apps/web/src/app/t/[tenantId]/settings/users/page.tsx`
- **Current**: Unknown
- **Target**: `AccessPresets.TENANT_ADMIN`
- **Status**: Needs audit

### 2.3 Feature Flags (Tenant)
- **File**: `apps/web/src/app/t/[tenantId]/settings/admin/flags/page.tsx`
- **Current**: Unknown
- **Target**: `AccessPresets.TENANT_ADMIN`
- **Status**: Needs audit

## Phase 3: Content Management (Priority 3) 🟢

### 3.1 Categories
- **File**: `apps/web/src/app/t/[tenantId]/categories/page.tsx`
- **Current**: Unknown
- **Target**: `AccessPresets.TENANT_ADMIN`
- **Status**: Needs audit

### 3.2 Products/Items
- **File**: `apps/web/src/app/t/[tenantId]/items/page.tsx`
- **Current**: Unknown
- **Target**: `AccessPresets.TENANT_ADMIN` or `TENANT_MEMBER` (read)
- **Status**: Needs audit

### 3.3 Business Hours
- **File**: `apps/web/src/app/t/[tenantId]/settings/hours/page.tsx`
- **Current**: Unknown
- **Target**: `AccessPresets.TENANT_ADMIN`
- **Status**: Needs audit

## Phase 4: Platform Admin (Priority 4) 🔵

### 4.1 User Management
- **File**: `apps/web/src/app/(platform)/settings/admin/users/page.tsx`
- **Current**: Unknown
- **Target**: `AccessPresets.PLATFORM_ADMIN_ONLY`
- **Status**: Needs audit

### 4.2 Platform Settings
- **File**: Various admin pages
- **Current**: Unknown
- **Target**: `AccessPresets.PLATFORM_ADMIN_ONLY`
- **Status**: Needs audit

## Retrofit Template

### Step 1: Identify Current Logic

Look for patterns like:
```typescript
// Custom access checks
const [userRole, setUserRole] = useState();
const [hasAccess, setHasAccess] = useState(false);
useEffect(() => {
  // Custom fetching and checking...
}, []);

// Or ProtectedRoute only
<ProtectedRoute>
  <Content />
</ProtectedRoute>
```

### Step 2: Choose Appropriate Preset

| Page Type | Preset |
|-----------|--------|
| Platform Admin Only | `PLATFORM_ADMIN_ONLY` |
| Tenant Settings | `TENANT_ADMIN` |
| Tenant Owner Only | `TENANT_OWNER_ONLY` |
| Organization Dashboard | `ORGANIZATION_MEMBER` |
| Propagation/Chain | `CHAIN_PROPAGATION` |
| Hero Settings | `HERO_LOCATION_ADMIN` |
| Any Authenticated | `AUTHENTICATED` |

### Step 3: Replace with New System

```typescript
// Add imports
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

// In component
export default function MyPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  // Replace custom logic with this
  const { hasAccess, loading, tenantRole, isOrgAdmin } = useAccessControl(
    tenantId,
    AccessPresets.TENANT_ADMIN,  // Choose appropriate preset
    false  // Set to true if you need organization data
  );
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  
  if (!hasAccess) {
    return (
      <AccessDenied
        title="Access Restricted"
        message="This feature requires tenant administrator access."
        userRole={tenantRole}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }
  
  // Your protected content
  return <YourContent />;
}
```

### Step 4: Remove Old Code

Delete:
- ✅ Custom `useState` for access control
- ✅ Custom `useEffect` for user fetching
- ✅ Custom access checking logic
- ✅ Custom access denied UI
- ✅ Duplicate user data fetching

### Step 5: Test

- [ ] Test as platform admin
- [ ] Test as tenant owner
- [ ] Test as tenant admin
- [ ] Test as tenant member
- [ ] Test as non-member
- [ ] Test with organization context (if applicable)
- [ ] Test access denied screen
- [ ] Test loading state

## Automated Migration Script

```typescript
// migration-helper.ts
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

/**
 * Quick migration wrapper for existing pages
 * Use this to quickly add access control to pages
 */
export function withAccessControl(
  Component: React.ComponentType<any>,
  preset: AccessControlOptions,
  fetchOrg: boolean = false
) {
  return function ProtectedComponent(props: any) {
    const params = useParams();
    const tenantId = params.tenantId as string;
    
    const { hasAccess, loading, tenantRole } = useAccessControl(
      tenantId,
      preset,
      fetchOrg
    );
    
    if (loading) return <Spinner />;
    if (!hasAccess) return <AccessDenied userRole={tenantRole} />;
    
    return <Component {...props} />;
  };
}

// Usage:
export default withAccessControl(
  MyPageComponent,
  AccessPresets.TENANT_ADMIN
);
```

## Migration Checklist

### Per Page:
- [ ] Identify current access control logic
- [ ] Choose appropriate preset
- [ ] Add imports
- [ ] Replace custom logic with `useAccessControl`
- [ ] Replace custom UI with `<AccessDenied />`
- [ ] Remove old code
- [ ] Test all user roles
- [ ] Update documentation
- [ ] Commit changes

### Global:
- [ ] Audit all pages for access control
- [ ] Create migration tickets
- [ ] Prioritize by criticality
- [ ] Migrate in phases
- [ ] Test thoroughly
- [ ] Monitor for issues
- [ ] Update team documentation

## Testing Strategy

### Unit Tests
```typescript
describe('Access Control', () => {
  it('grants access to platform admin', () => {
    const user = { isPlatformAdmin: true };
    const result = checkAccess(user, {}, AccessPresets.TENANT_ADMIN);
    expect(result.hasAccess).toBe(true);
  });
  
  it('grants access to tenant admin', () => {
    const user = { 
      tenants: [{ tenantId: 'test', role: 'ADMIN' }] 
    };
    const result = checkAccess(
      user, 
      { tenantId: 'test' }, 
      AccessPresets.TENANT_ADMIN
    );
    expect(result.hasAccess).toBe(true);
  });
  
  it('denies access to tenant member', () => {
    const user = { 
      tenants: [{ tenantId: 'test', role: 'MEMBER' }] 
    };
    const result = checkAccess(
      user, 
      { tenantId: 'test' }, 
      AccessPresets.TENANT_ADMIN
    );
    expect(result.hasAccess).toBe(false);
  });
});
```

### Integration Tests
- Test full page flows
- Test with real API calls
- Test navigation after denial
- Test loading states
- Test error states

### Manual Testing
- Test each role combination
- Test organization scenarios
- Test multi-tenant users
- Test edge cases

## Rollback Plan

If issues arise:
1. Keep old code commented out initially
2. Feature flag the new system
3. Monitor error rates
4. Quick rollback if needed
5. Fix issues and re-deploy

## Success Metrics

- [ ] 100% of critical pages migrated
- [ ] 0 security vulnerabilities
- [ ] Consistent UX across all pages
- [ ] Reduced code duplication
- [ ] Improved maintainability
- [ ] Clear audit trail
- [ ] Better error messages
- [ ] Faster development for new features

## Timeline

- **Week 1**: Phase 1 (Critical pages)
- **Week 2**: Phase 2 (Tenant management)
- **Week 3**: Phase 3 (Content management)
- **Week 4**: Phase 4 (Platform admin)
- **Week 5**: Testing and refinement
- **Week 6**: Documentation and training

## Next Steps

1. ✅ Create retrofit plan (this document)
2. ⏳ Audit all existing pages
3. ⏳ Start with Propagation Control Panel (Phase 1.1)
4. ⏳ Create migration PRs
5. ⏳ Review and test
6. ⏳ Deploy incrementally
7. ⏳ Monitor and iterate

## Questions to Answer

- [ ] Which pages have the most critical security needs?
- [ ] Are there any pages with complex custom logic?
- [ ] Do we need backward compatibility?
- [ ] Should we use feature flags?
- [ ] What's the testing strategy?
- [ ] Who will review the changes?
- [ ] What's the deployment schedule?
