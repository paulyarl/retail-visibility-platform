# API Routes Migration Plan: Proxy to Singleton Services

## Overview
This document outlines the migration plan for 12 API routes currently using `proxyGet|proxyPost|proxyPut|proxyPatch|proxyDelete` to proper singleton services for better architecture, caching, and error handling.

## Current Issues with Proxy Routes
- ❌ No automatic caching
- ❌ Manual error handling
- ❌ No service-level validation
- ❌ Inconsistent response formats
- ❌ No centralized authentication handling
- ❌ Difficult to test and maintain

## Migration Phases

### **Phase 1: Dashboard Routes** (Low Risk)
**Files:**
- `./src/app/api/dashboard/route.ts`

**Target Service:** `PlatformDashboardSingletonService` ✅ (exists)

**Migration Steps:**
1. Replace `proxyGet` with `platformDashboardService.getDashboardData(tenantId)`
2. Add proper error handling and validation
3. Implement response caching (5-minute TTL)
4. Add tenant validation
5. Test dashboard loading

**Benefits:**
- ✅ Automatic caching
- ✅ Better error handling
- ✅ Type safety

---

### **Phase 2: Items Routes** (Medium Risk)
**Files:**
- `./src/app/api/items/route.ts`
- `./src/app/api/items/[id]/route.ts`

**Target Service:** `ItemsSingletonService` ✅ (exists)

**Migration Steps:**
1. Replace `proxyGet` with `itemsService.getItems(params)`
2. Replace `proxyPost` with `itemsService.createItem(data)`
3. Replace `proxyPut` with `itemsService.updateItem(id, data)`
4. Replace `proxyDelete` with `itemsService.deleteItem(id)`
5. Implement proper pagination support
6. Add inventory validation
7. Test CRUD operations

**Benefits:**
- ✅ Automatic cache invalidation
- ✅ Inventory validation
- ✅ Type-safe item operations

---

### **Phase 3: User Management Routes** (Medium Risk)
**Files:**
- `./src/app/api/users/route.ts`
- `./src/app/api/users/[id]/route.ts`
- `./src/app/api/user/profile/route.ts`

**Target Services:** 
- `AdminUsersService` ✅ (exists)
- `UserManagementService` ✅ (exists)

**Migration Steps:**
1. Replace `proxyGet` with `adminUsersService.getUsers()`
2. Replace `proxyPost` with `adminUsersService.createUser(data)`
3. Replace `proxyPut` with `adminUsersService.updateUser(id, data)`
4. Replace `proxyDelete` with `adminUsersService.deleteUser(id)`
5. Migrate profile endpoint to `userManagementService.updateProfile()`
6. Add user permission validation
7. Test user CRUD operations

**Benefits:**
- ✅ RBAC integration
- ✅ User validation
- ✅ Permission checking

---

### **Phase 4: Tenant-Specific Routes** (Medium Risk)
**Files:**
- `./src/app/api/tenants/[id]/items/route.ts`
- `./src/app/api/tenants/[id]/users/route.ts`
- `./src/app/api/tenants/[id]/users/[userId]/route.ts`

**Target Services:**
- `ItemsSingletonService` ✅ (exists)
- `TenantUserService` ✅ (exists)

**Migration Steps:**
1. Replace tenant items proxy with `itemsService.getTenantItems(tenantId, params)`
2. Replace tenant users proxy with `tenantUserService.getTenantUsers(tenantId)`
3. Replace user management proxy with `tenantUserService.updateTenantUser(tenantId, userId, data)`
4. Add tenant access validation
5. Implement tenant-scoped caching
6. Test tenant-specific operations

**Benefits:**
- ✅ Tenant isolation
- ✅ Scoped permissions
- ✅ Tenant-specific caching

---

### **Phase 5: Permission Management Routes** (High Risk)
**Files:**
- `./src/app/api/permissions/route.ts`
- `./src/app/api/permissions/bulk-update/route.ts`

**Target Service:** `RBACService` ✅ (exists)

**Migration Steps:**
1. Replace `proxyGet` with `rbacService.getPermissions(params)`
2. Replace `proxyPost` with `rbacService.createPermission(data)`
3. Replace `proxyPut` with `rbacService.updatePermission(id, data)`
4. Replace bulk update proxy with `rbacService.bulkUpdatePermissions(updates)`
5. Add permission validation
6. Implement permission caching
7. Test permission management

**Benefits:**
- ✅ Centralized RBAC
- ✅ Permission validation
- ✅ Audit logging

---

### **Phase 6: Organization Management Routes** (High Risk)
**Files:**
- `./src/app/api/organization-requests/route.ts`
- `./src/app/api/organization-requests/[id]/route.ts`

**Target Service:** `OrganizationService` ✅ (exists)

**Migration Steps:**
1. Replace `proxyGet` with `organizationService.getOrganizationRequests()`
2. Replace `proxyPost` with `organizationService.createOrganizationRequest(data)`
3. Replace `proxyPut` with `organizationService.updateOrganizationRequest(id, data)`
4. Replace `proxyDelete` with `organizationService.deleteOrganizationRequest(id)`
5. Add organization validation
6. Implement approval workflows
7. Test organization management

**Benefits:**
- ✅ Organization validation
- ✅ Workflow support
- ✅ Approval processes

---

## Implementation Strategy

### **Pre-Migration Checklist**
- [ ] Verify target services exist and are functional
- [ ] Document current API contracts
- [ ] Create test cases for each endpoint
- [ ] Set up monitoring and logging
- [ ] Plan rollback strategy

### **Migration Template**
```typescript
// BEFORE (Proxy Pattern)
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export async function GET(req: NextRequest) {
  try {
    const res = await proxyGet(req, '/items');
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

// AFTER (Service Pattern)
import { itemsService } from '@/services/ItemsSingletonService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = Object.fromEntries(searchParams);
    
    const items = await itemsService.getItems(params);
    return NextResponse.json(items);
  } catch (error) {
    console.error('[Items API] Error:', error);
    return NextResponse.json(
      { error: 'failed_to_fetch_items', message: error.message },
      { status: 500 }
    );
  }
}
```

### **Testing Strategy**
1. **Unit Tests**: Test each service method independently
2. **Integration Tests**: Test API routes with services
3. **Load Testing**: Verify performance under load
4. **Regression Tests**: Ensure existing functionality works

### **Rollback Plan**
- Keep proxy routes as fallback
- Feature flags for gradual migration
- Monitor error rates and performance
- Quick rollback to proxy if issues arise

## Expected Benefits

### **Performance Improvements**
- ✅ **Automatic Caching**: 5-15 minute TTL based on data type
- ✅ **Cache Invalidation**: Automatic on updates/deletes
- ✅ **Reduced Latency**: Cached responses for frequent requests
- ✅ **Better Throughput**: Optimized service methods

### **Architecture Benefits**
- ✅ **Type Safety**: Proper TypeScript interfaces
- ✅ **Error Handling**: Centralized error management
- ✅ **Validation**: Service-level input validation
- ✅ **Authentication**: Built-in auth handling
- ✅ **Monitoring**: Service-level metrics

### **Developer Experience**
- ✅ **Consistency**: Standardized service patterns
- ✅ **Testability**: Easier unit testing
- ✅ **Maintainability**: Clear separation of concerns
- ✅ **Documentation**: Self-documenting service methods

## Timeline

| Phase | Duration | Risk Level | Dependencies |
|-------|----------|------------|--------------|
| Phase 1 | 1-2 days | Low | None |
| Phase 2 | 2-3 days | Medium | Phase 1 |
| Phase 3 | 2-3 days | Medium | Phase 1 |
| Phase 4 | 3-4 days | Medium | Phases 2-3 |
| Phase 5 | 4-5 days | High | Phases 1-4 |
| Phase 6 | 4-5 days | High | Phases 1-4 |

**Total Estimated Duration: 16-22 days**

## Success Metrics

### **Performance Metrics**
- 50% reduction in average response time
- 80% cache hit rate for frequently accessed data
- 99.9% uptime during migration

### **Quality Metrics**
- 0 TypeScript errors in migrated routes
- 100% test coverage for new service integrations
- No regression in existing functionality

### **Developer Metrics**
- 50% reduction in code complexity
- 90% reduction in manual error handling code
- Improved developer satisfaction scores

## Next Steps

1. **Phase 1 Preparation**: Review `PlatformDashboardSingletonService`
2. **Create Migration Branch**: Start with dashboard route
3. **Implement Phase 1**: Migrate dashboard API
4. **Monitor & Test**: Verify performance and functionality
5. **Proceed to Phase 2**: Continue with items routes
6. **Complete All Phases**: Full migration to services

---

*This migration plan ensures a systematic approach to upgrading API routes from proxy patterns to proper singleton services, with minimal risk and maximum benefits.*
