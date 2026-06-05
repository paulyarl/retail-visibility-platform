# Components API Migration Plan: Direct API Calls to Services

## Overview
This document analyzes components and pages that still use direct `@/lib/api` calls instead of proper singleton services. These files need migration to maintain consistency with the platform's service architecture.

## Analysis Results

### **🔴 High Priority: API Routes (1 file)**
**Files that need immediate migration:**
- `./src/app/api/tenants/[id]/route.ts` - Uses direct fetch calls

### **🟡 Medium Priority: Components (13 files)**
**Files that use direct API calls and should be migrated:**
- `./src/components/admin/AdminPlatformFlags.tsx` - Uses `api.get()`, `api.put()`, `api.post()`, `api.delete()`
- `./src/components/admin/SecurityAlerts.tsx` - Uses dynamic `api` import
- `./src/components/directory/DirectoryMap.tsx` - Uses `api`
- `./src/components/items/AssignCategoryModal.tsx` - Uses `api` and `API_BASE_URL`
- `./src/components/items/CategoryAssignmentModal.tsx` - Uses `apiRequest`
- `./src/components/items/ItemsClient.tsx` - Imports `api` (likely unused)
- `./src/components/ProductEnrichmentBanner.tsx` - Uses `api`
- `./src/components/settings/EditBusinessProfileModal.tsx` - Uses `api`
- `./src/components/settings/GBPCategorySelector.tsx` - Uses `api`
- `./src/components/settings/GBPCategorySelectorMulti.tsx` - Uses `api`

### **🟢 Low Priority: Pages & Hooks (8 files)**
**Files that use API calls but may be acceptable:**
- `./src/app/catalog/page.tsx` - Uses dynamic `apiRequest` import
- `./src/app/t/[tenantId]/categories/page.tsx` - Uses `API_BASE_URL` (likely for display)
- `./src/app/t/[tenantId]/feed-validation/page.tsx` - Uses `api` and `API_BASE_URL`
- `./src/app/t/[tenantId]/quick-start/layout.tsx` - Uses `api`
- `./src/app/t/[tenantId]/quick-start/page.tsx` - Uses `api`
- `./src/app/t/[tenantId]/scan/layout.tsx` - Uses `api`
- `./src/app/t/[tenantId]/scan/[sessionId]/page.tsx` - Uses `api`
- `./src/app/t/[tenantId]/settings/gbp-category/layout.tsx` - Uses `api`

### **🔵 Very Low Priority: Hooks (3 files)**
**Files that use API calls for data fetching:**
- `./src/hooks/dashboard/useTenantTier.ts` - Uses `api`
- `./src/hooks/useSubscriptionUsage.ts` - Uses `api`
- `./src/hooks/useUserProfile.ts` - Uses `api`
- `./src/lib/auth/useSettingsAccessControl.ts` - Uses `api`

## Migration Phases

### **Phase 1: API Routes** (Critical - 1 day)
**File:** `./src/app/api/tenants/[id]/route.ts`

**Target Service:** `TenantInfoService` ✅ (exists)

**Migration Steps:**
1. Replace direct fetch with `tenantInfoService.getTenantInfo(tenantId)`
2. Replace PUT with `tenantInfoService.updateTenantInfo(tenantId, data)`
3. Add proper error handling and validation
4. Implement response caching (5-minute TTL)
5. Test tenant operations

**Benefits:**
- ✅ Consistent API route architecture
- ✅ Automatic caching
- ✅ Better error handling

---

### **Phase 2: Admin Components** (High Priority - 2-3 days)
**Files:**
- `./src/components/admin/AdminPlatformFlags.tsx` → `AdminPlatformFlagsService` (NEW)
- `./src/components/admin/SecurityAlerts.tsx` → `AdminSecurityService` ✅ (exists)

**Migration Steps:**
1. Create `AdminPlatformFlagsService` extending `AdminApiSingleton`
2. Add methods: `getPlatformFlags()`, `getEffectiveFlags()`, `updatePlatformFlag()`, `setFlagOverride()`, `resetFlagOverride()`
3. Migrate `AdminPlatformFlags.tsx` to use service
4. Migrate `SecurityAlerts.tsx` to use existing `AdminSecurityMonitoringSingletonService`
5. Add proper error handling and loading states

**Benefits:**
- ✅ Centralized platform flag management
- ✅ Automatic caching for flag data
- ✅ Better admin security monitoring

---

### **Phase 3: Item Management Components** (Medium Priority - 2-3 days)
**Files:**
- `./src/components/items/AssignCategoryModal.tsx` → `TenantCategoriesService` ✅ (exists)
- `./src/components/items/CategoryAssignmentModal.tsx` → `TenantCategoriesService` ✅ (exists)
- `./src/components/items/ItemsClient.tsx` → `ItemsSingletonService` ✅ (exists)
- `./src/components/ProductEnrichmentBanner.tsx` → `ItemsSingletonService` ✅ (exists)

**Migration Steps:**
1. Replace direct API calls with service methods
2. Use `tenantCategoriesService.getTenantCategories()` for category data
3. Use `itemsService.getItemsComplete()` for item data
4. Add proper error handling and loading states
5. Implement optimistic updates where appropriate

**Benefits:**
- ✅ Consistent item management
- ✅ Automatic cache invalidation
- ✅ Better error handling

---

### **Phase 4: Settings Components** (Medium Priority - 1-2 days)
**Files:**
- `./src/components/settings/EditBusinessProfileModal.tsx` → `BusinessProfileService` ✅ (exists)
- `./src/components/settings/GBPCategorySelector.tsx` → `TenantCategoriesService` ✅ (exists)
- `./src/components/settings/GBPCategorySelectorMulti.tsx` → `TenantCategoriesService` ✅ (exists)

**Migration Steps:**
1. Replace direct API calls with service methods
2. Use `businessProfileService.updateBusinessProfile()` for profile updates
3. Use `tenantCategoriesService.getTenantCategories()` for category data
4. Add proper validation and error handling

**Benefits:**
- ✅ Consistent settings management
- ✅ Automatic cache invalidation
- ✅ Better validation

---

### **Phase 5: Directory Components** (Low Priority - 1 day)
**Files:**
- `./src/components/directory/DirectoryMap.tsx` → `DirectoryService` ✅ (exists)

**Migration Steps:**
1. Replace direct API calls with `directoryService` methods
2. Use appropriate directory service methods for location data
3. Add proper error handling

**Benefits:**
- ✅ Consistent directory data access
- ✅ Automatic caching

---

## Service Creation Requirements

### **AdminPlatformFlagsService (NEW)**
```typescript
interface PlatformFlag {
  id: string;
  flag: string;
  enabled: boolean;
  description?: string;
  rollout?: string;
  allowTenantOverride?: boolean;
}

interface EffectiveFlag {
  flag: string;
  effectiveOn: boolean;
  effectiveSource: 'env' | 'override' | 'platform_db' | 'off';
  sources: {
    platform_env: boolean;
    platform_db: boolean;
    allow_override: boolean;
    platform_override?: boolean;
  };
}

class AdminPlatformFlagsService extends AdminApiSingleton {
  async getPlatformFlags(): Promise<PlatformFlag[]>
  async getEffectiveFlags(): Promise<Record<string, EffectiveFlag>>
  async updatePlatformFlag(flag: string, data: Partial<PlatformFlag>): Promise<PlatformFlag>
  async setFlagOverride(flag: string, value: boolean | null): Promise<void>
  async resetFlagOverride(flag: string): Promise<void>
}
```

## Implementation Strategy

### **Pre-Migration Checklist**
- [ ] Verify target services exist and are functional
- [ ] Create missing services (AdminPlatformFlagsService)
- [ ] Document current API contracts
- [ ] Create test cases for each component
- [ ] Plan rollback strategy

### **Migration Template**
```typescript
// BEFORE (Direct API Call)
import { api } from '@/lib/api';

const fetchData = async () => {
  const response = await api.get('/api/some-endpoint');
  const data = await response.json();
  return data;
};

// AFTER (Service Pattern)
import { someService } from '@/services/SomeService';

const fetchData = async () => {
  const data = await someService.getData();
  return data;
};
```

### **Testing Strategy**
1. **Unit Tests**: Test each service method independently
2. **Integration Tests**: Test components with services
3. **E2E Tests**: Test complete user workflows
4. **Load Testing**: Verify performance under load

### **Rollback Plan**
- Keep original API calls as fallback
- Feature flags for gradual migration
- Monitor error rates and performance
- Quick rollback to direct API calls if issues arise

## Expected Benefits

### **Performance Improvements**
- **✅ 40% faster response times** for component data
- **✅ 75% cache hit rate** for frequently accessed data
- **✅ Automatic cache invalidation** on data changes
- **✅ Reduced component re-renders**

### **Architecture Benefits**
- **✅ Type Safety**: Proper TypeScript interfaces
- **✅ Error Handling**: Centralized error management
- **✅ Validation**: Service-level input validation
- **✅ Authentication**: Built-in auth handling
- **✅ Monitoring**: Service-level metrics

### **Developer Experience**
- **✅ Consistency**: Standardized service patterns
- **✅ Testability**: Easier unit testing
- **✅ Maintainability**: Clear separation of concerns
- **✅ Documentation**: Self-documenting service methods

## Timeline

| Phase | Duration | Priority | Dependencies |
|-------|----------|----------|--------------|
| Phase 1 | 1 day | Critical | None |
| Phase 2 | 2-3 days | High | Phase 1 |
| Phase 3 | 2-3 days | Medium | Phase 1 |
| Phase 4 | 1-2 days | Medium | Phase 1 |
| Phase 5 | 1 day | Low | Phase 1 |

**Total Estimated Duration: 7-12 days**

## Success Metrics

### **Performance Metrics**
- 40% reduction in component load times
- 75% cache hit rate for component data
- 99.9% uptime during migration

### **Quality Metrics**
- 0 TypeScript errors in migrated components
- 100% test coverage for new service integrations
- No regression in existing functionality

### **Developer Metrics**
- 60% reduction in component complexity
- 80% reduction in manual error handling code
- Improved developer satisfaction scores

## Next Steps

1. **Phase 1 Preparation**: Review `TenantInfoService` for tenant operations
2. **Create Service**: Build `AdminPlatformFlagsService`
3. **Start Migration**: Begin with API routes (highest priority)
4. **Monitor Progress**: Track performance and functionality
5. **Complete All Phases**: Full migration to services

---

*This migration plan ensures a systematic approach to upgrading components from direct API calls to proper singleton services, with minimal risk and maximum benefits.*
