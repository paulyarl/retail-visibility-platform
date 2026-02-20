# Flexible Request Architecture Migration Plan

## 🎯 Objective
Migrate from rigid base class request methods to flexible architecture where each base class has its own default request type but can use any request method for edge cases.

## 🏗️ Architecture Overview

```
UniversalSingleton (Core Foundation)
├── Caching, metrics, error handling
└── Performance monitoring
        ↓
FlexibleApiSingleton (Abstract Base)
├── All request methods available
├── Default request type per service
├── Context management per request type
└── makeDefaultRequest() routing
        ↓
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ AdminApiSingleton │ TenantApiSingleton │ PublicApiSingleton │ AuthenticatedApiSingleton │
│ default: ADMIN   │ default: TENANT   │ default: PUBLIC   │ default: AUTHENTICATED   │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
        ↓
                    Services (Business Logic)
```

## 📋 Migration Phases

### Phase 1: Foundation (Week 1)
- [ ] **1.1** Create `FlexibleApiSingleton` extending `UniversalSingleton`
- [ ] **1.2** Implement all request methods with context management
- [ ] **1.3** Add `defaultRequestType` abstract property
- [ ] **1.4** Implement `makeDefaultRequest()` routing logic
- [ ] **1.5** Add comprehensive unit tests

### Phase 2: Base Classes (Week 1-2)
- [ ] **2.1** Update `AdminApiSingleton` to extend `FlexibleApiSingleton`
- [ ] **2.2** Update `TenantApiSingleton` to extend `FlexibleApiSingleton`
- [ ] **2.3** Update `PublicApiSingleton` to extend `FlexibleApiSingleton`
- [ ] **2.4** Update `AuthenticatedApiSingleton` to extend `FlexibleApiSingleton`
- [ ] **2.5** Set default request types for each base class
- [ ] **2.6** Test base class inheritance

### Phase 3: Service Migration (Week 2-3)
Priority order based on impact and dependencies:

#### Priority 1: Critical Path Services
- [ ] **3.1** `ScanAnalyticsService` (already partially done)
- [ ] **3.2** `TenantInfoSingletonService` (high usage)
- [ ] **3.3** `AdminDeletionRequestsService` (admin operations)
- [ ] **3.4** `SecurityAlertTrackingService` (security operations)

#### Priority 2: Tenant Services
- [ ] **3.5** `OrganizationService`
- [ ] **3.6** `TenantAnalyticsService`
- [ ] **3.7** `SubdomainService`
- [ ] **3.8** `TenantCategoryService`

#### Priority 3: Admin Services
- [ ] **3.9** `AdminUsersService`
- [ ] **3.10** `AdminAnalyticsService`
- [ ] **3.11** `AdminOperationsService`

#### Priority 4: Public Services
- [ ] **3.12** `DirectorySingletonService`
- [ ] **3.13** `StorefrontService`

### Phase 4: Context Management (Week 3)
- [ ] **4.1** Implement group validation integration
- [ ] **4.2** Add role-based access control
- [ ] **4.3** Implement tenant context management
- [ ] **4.4** Add admin privilege validation
- [ ] **4.5** Test security contexts

### Phase 5: Testing & Validation (Week 4)
- [ ] **5.1** Unit tests for all request methods
- [ ] **5.2** Integration tests for service migrations
- [ ] **5.3** Security validation tests
- [ ] **5.4** Performance tests
- [ ] **5.5] End-to-end tests

## 🔧 Implementation Details

### Request Method Context Management

#### makePublicRequest()
```typescript
Context: Public access
Headers: Content-Type
Validation: None
Use Case: Public endpoints, configuration
```

#### makeAuthenticatedRequest()
```typescript
Context: User-specific access
Headers: Authorization + X-Request-Context: authenticated
Validation: Token validity
Use Case: User profile, preferences
```

#### makeTenantRequest()
```typescript
Context: Tenant-specific access
Headers: Authorization + X-Tenant-ID + X-Request-Context: tenant + X-Tenant-Groups
Validation: Tenant context + group membership (IS_TENANT_ADMIN, IS_TENANT_OWNER)
Use Case: Tenant operations, analytics, management
```

#### makeAdminRequest()
```typescript
Context: Platform admin access
Headers: Authorization + X-Request-Context: admin + X-Admin-Roles
Validation: Admin role verification (PLATFORM_ADMIN, ADMIN)
Use Case: Platform operations, admin analytics
```

### Service Migration Pattern

#### Before:
```typescript
class ScanAnalyticsService extends AuthenticatedApiSingleton {
  async getTenantAnalytics(tenantId: string) {
    return await this.makeAuthenticatedRequest(url, options, cacheKey, ttl);
  }
}
```

#### After:
```typescript
class ScanAnalyticsService extends TenantApiSingleton {
  protected defaultRequestType = RequestType.TENANT; // Set by base class
  
  async getTenantAnalytics(tenantId: string) {
    // Option 1: Use default (tenant context with validation)
    return await this.makeDefaultRequest(url, options, cacheKey, ttl);
    
    // Option 2: Explicit with custom validation
    return await this.makeTenantRequest(url, options, cacheKey, ttl, {
      validateTenantAccess: true,
      requiredGroups: ['IS_TENANT_ADMIN'],
      tenantId
    });
  }
  
  async getPublicConfig() {
    // Edge case: tenant service accessing public data
    return await this.makePublicRequest('/api/public/config');
  }
}
```

## 🎯 Edge Case Handling

### Admin Service Accessing Tenant Data
```typescript
class AdminService extends AdminApiSingleton {
  protected defaultRequestType = RequestType.ADMIN;
  
  async getTenantAnalyticsAsAdmin(tenantId: string) {
    // Admin bypasses tenant validation but maintains tenant context
    return await this.makeTenantRequest('/api/tenant/analytics', {
      validateTenantAccess: false, // Admin bypass
      tenantId
    });
  }
}
```

### Tenant Service Accessing Public Data
```typescript
class TenantService extends TenantApiSingleton {
  protected defaultRequestType = RequestType.TENANT;
  
  async getPublicConfig() {
    return await this.makePublicRequest('/api/public/config');
  }
}
```

## 🚀 Benefits

### Flexibility
- Services can use any request method per operation
- No rigid constraints on base class method usage
- Perfect for hybrid security scenarios

### Security Enforcement
- Each request method enforces its specific security model
- Proper headers and validation automatically applied
- Prevents privilege escalation while allowing legitimate edge cases

### Maintainability
- Clear separation of concerns
- Default request type provides sensible defaults
- Edge cases are explicitly handled and documented

### Architectural Consistency
- All request methods available in base class
- Services choose appropriate method per operation
- Consistent error handling and caching across all methods

## 📊 Success Metrics

- [ ] All services migrated to new architecture
- [ ] No breaking changes to public APIs
- [ ] Improved security context enforcement
- [ ] Reduced code duplication
- [ ] Better test coverage
- [ ] Performance maintained or improved

## 🔄 Rollback Strategy

If issues arise during migration:
1. Keep old base classes as fallback
2. Migrate services incrementally
3. Feature flag for new vs old architecture
4. Comprehensive testing at each phase
5. Monitor performance and security metrics

## 🎉 Timeline

- **Week 1**: Foundation + Base Classes
- **Week 2**: Critical Services Migration
- **Week 3**: Remaining Services + Context Management
- **Week 4**: Testing + Validation + Deployment

Total: **4 weeks** for complete migration with comprehensive testing.
