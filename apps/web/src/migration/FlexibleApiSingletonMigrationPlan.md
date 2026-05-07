# Migration Plan for FlexibleApiSingleton Services

Comprehensive plan to migrate 50+ services from old architecture to FlexibleApiSingletonV2
Prioritized by service type and complexity

## Migration Strategy

### Migration Priority Order:
1. **PublicApiSingleton services** (easiest, lowest risk)
2. **AuthenticatedApiSingleton services** (medium complexity)
3. **TenantApiSingleton services** (medium complexity)
4. **AdminApiSingleton services** (higher complexity)
5. **Direct FlexibleApiSingleton extensions** (highest complexity)

## Phase 1: Public API Services (Low Risk)

### StorefrontSingletonService
- **File**: `src/services/StorefrontSingletonService.ts`
- **Status**: COMPLETED
- **Complexity**: Low
- **Notes**: Successfully migrated to V2 with delegation pattern

### StorefrontService
- **File**: `src/services/StorefrontService.ts`
- **Status**: PENDING
- **Complexity**: Low
- **Notes**: Legacy service, needs complete rewrite

### TenantPublicService
- **File**: `src/services/TenantPublicService.ts`
- **Status**: PENDING
- **Complexity**: Low
- **Notes**: Already uses PublicApiSingleton, simple migration

### StoreStatusSingletonService
- **File**: `src/services/StoreStatusSingletonService.ts`
- **Status**: PENDING
- **Complexity**: Low
- **Notes**: Simple status checking service

## Phase 2: Authenticated API Services (Medium Risk)

### TenantInfoService
- **File**: `src/services/TenantInfoService.ts`
- **Status**: IN PROGRESS
- **Complexity**: Medium
- **Notes**: Core tenant management, careful testing required

### TenantManagementService
- **File**: `src/services/TenantManagementService.ts`
- **Status**: PENDING
- **Complexity**: Medium
- **Notes**: Tenant CRUD operations

### DirectorySingletonService
- **File**: `src/services/DirectorySingletonService.ts`
- **Status**: PENDING
- **Complexity**: Medium
- **Notes**: Directory and search functionality

## Phase 3: Tenant API Services (Medium Risk)

### RealShopService
- **File**: `src/services/RealShopService.ts`
- **Status**: PENDING
- **Complexity**: Medium
- **Notes**: Shop management operations

### FeaturedShopManager
- **File**: `src/services/FeaturedShopManager.ts`
- **Status**: PENDING
- **Complexity**: Medium
- **Notes**: Featured shop curation

## Phase 4: Admin API Services (High Risk)

### AdminDashboardService
- **File**: `src/services/AdminDashboardService.ts`
- **Status**: PENDING
- **Complexity**: High
- **Notes**: Admin dashboard data aggregation

### PlatformHomeSingletonService
- **File**: `src/services/PlatformHomeSingletonService.ts`
- **Status**: PENDING
- **Complexity**: High
- **Notes**: Platform-level operations

## Migration Templates

### Public API Migration Template

```typescript
// OLD:
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

class ${ServiceName} extends PublicApiSingleton {
  // ... existing code
}

// NEW:
import { FlexibleApiSingletonV2, RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingletonV2';

class ${ServiceName} extends FlexibleApiSingletonV2 {
  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;
  
  // Update makeDefaultRequest calls to use delegation pattern
  // Add requestType and requestTarget parameters
}
```

### Authenticated API Migration Template

```typescript
// OLD:
import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';

class ${ServiceName} extends AuthenticatedApiSingleton {
  // ... existing code
}

// NEW:
import { FlexibleApiSingletonV2, RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingletonV2';

class ${ServiceName} extends FlexibleApiSingletonV2 {
  protected defaultRequestType = RequestType.AUTHENTICATED;
  protected defaultRequestTarget = RequestTarget.API;
  
  // Update makeAuthenticatedRequest calls to use delegation pattern
  // Add authentication logic in onAuthenticatedRequest hook
}
```

## Migration Checklist

### Before Migration
- [ ] Identify all service dependencies
- [ ] Document current API endpoints
- [ ] Create comprehensive test suite
- [ ] Backup current implementation
- [ ] Plan rollback strategy

### During Migration
- [ ] Update import statements
- [ ] Replace base class inheritance
- [ ] Add default request type/target
- [ ] Update method calls to use delegation
- [ ] Add proper error handling
- [ ] Update caching strategy

### After Migration
- [ ] Run full test suite
- [ ] Verify API compatibility
- [ ] Test error scenarios
- [ ] Monitor performance
- [ ] Update documentation
- [ ] Remove old implementation

## Common Migration Patterns

### 1. Simple GET Requests
```typescript
// OLD
const result = await this.makeDefaultRequest(url, options, cacheKey);

// NEW
const result = await this.delegateRequest('GET', url, options, {
  cacheKey,
  requestType: this.defaultRequestType,
  requestTarget: this.defaultRequestTarget
});
```

### 2. POST Requests with Body
```typescript
// OLD
const result = await this.makeDefaultRequest(url, {
  method: 'POST',
  body: JSON.stringify(data)
}, cacheKey);

// NEW
const result = await this.delegateRequest('POST', url, {
  body: JSON.stringify(data)
}, {
  cacheKey,
  requestType: this.defaultRequestType,
  requestTarget: this.defaultRequestTarget
});
```

### 3. Authentication Headers
```typescript
// NEW: Add to onAuthenticatedRequest hook
protected onAuthenticatedRequest = (request: any) => {
  // Add auth headers
  request.headers = {
    ...request.headers,
    'Authorization': `Bearer ${this.getAuthToken()}`
  };
  return request;
};
```

## Testing Strategy

### Unit Tests
- Test each service method individually
- Mock API responses
- Verify error handling
- Test caching behavior

### Integration Tests
- Test service-to-service interactions
- Verify API compatibility
- Test authentication flows
- Test error propagation

### End-to-End Tests
- Test complete user workflows
- Verify performance impact
- Test error recovery
- Test concurrent requests

## Rollback Plan

### Immediate Rollback
- Revert to previous service implementation
- Restore original import statements
- Verify functionality restored

### Partial Rollback
- Keep migrated services that are stable
- Roll back problematic services only
- Document issues for future fixes

## Timeline

### Week 1-2: Phase 1 (Public APIs)
- Complete StorefrontService migration
- Migrate TenantPublicService
- Migrate StoreStatusSingletonService

### Week 3-4: Phase 2 (Authenticated APIs)
- Complete TenantInfoService migration
- Migrate TenantManagementService
- Migrate DirectorySingletonService

### Week 5-6: Phase 3 (Tenant APIs)
- Migrate RealShopService
- Migrate FeaturedShopManager

### Week 7-8: Phase 4 (Admin APIs)
- Migrate AdminDashboardService
- Migrate PlatformHomeSingletonService

### Week 9-10: Testing & Documentation
- Comprehensive testing
- Performance optimization
- Documentation updates
- Final cleanup

## Success Metrics

### Technical Metrics
- [ ] All services migrated without breaking changes
- [ ] Performance maintained or improved
- [ ] Error rates reduced
- [ ] Code complexity reduced

### Business Metrics
- [ ] Zero downtime during migration
- [ ] All existing functionality preserved
- [ ] New features can be added more easily
- [ ] Development velocity improved

## Risks & Mitigations

### Risk: Breaking Changes
- **Mitigation**: Comprehensive testing, gradual rollout
- **Fallback**: Immediate rollback capability

### Risk: Performance Degradation
- **Mitigation**: Performance monitoring, optimization
- **Fallback**: Revert to optimized old implementation

### Risk: Authentication Issues
- **Mitigation**: Thorough auth testing, gradual rollout
- **Fallback**: Keep old auth logic as backup

### Risk: Data Corruption
- **Mitigation**: Read-only testing first, data validation
- **Fallback**: Database backups, data recovery procedures
