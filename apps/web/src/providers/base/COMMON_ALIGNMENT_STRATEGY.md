# Common Alignment Strategy - Default Request Unless Explicit

## 🎯 Objective
Establish a consistent pattern across all services: use `makeDefaultRequest()` for primary operations, and only use explicit request methods for edge cases.

## 📋 Alignment Pattern

### ✅ **Primary Operations → makeDefaultRequest()**
```typescript
// GOOD: Use default for primary service operations
async getTenantData(tenantId: string) {
  return await this.makeDefaultRequest('/api/tenant/data', options, cacheKey, ttl);
}
```

### ✅ **Edge Cases → Explicit Methods**
```typescript
// GOOD: Use explicit for edge cases
async getPublicConfig() {
  return await this.makePublicRequest('/api/public/config'); // Edge case: tenant service accessing public data
}

async getTenantAnalyticsAsAdmin(tenantId: string) {
  return await this.makeTenantRequest('/api/tenant/analytics', {
    validateTenantAccess: false // Edge case: admin bypass
  });
}
```

### ❌ **Avoid Hardcoded Request Types**
```typescript
// BAD: Don't hardcode request types for primary operations
async getTenantData(tenantId: string) {
  return await this.makeTenantRequest('/api/tenant/data'); // Should use makeDefaultRequest
}
```

## 🔄 Service Alignment Plan

### Phase 1: Foundation Implementation
- [ ] Implement `FlexibleApiSingleton` with `makeDefaultRequest()`
- [ ] Update all base classes to extend `FlexibleApiSingleton`
- [ ] Set default request types for each base class

### Phase 2: Service Alignment (Priority Order)

#### Priority 1: Critical Services
```typescript
// ScanAnalyticsService → makeDefaultRequest for tenant operations
class ScanAnalyticsService extends TenantApiSingleton {
  async getTenantAnalytics(tenantId: string) {
    // BEFORE: makeTenantRequest
    // AFTER: makeDefaultRequest (uses TENANT by default)
    return await this.makeDefaultRequest('/api/scan/tenant/analytics');
  }
  
  async previewProduct(barcode: string) {
    // KEEP: makeApiRequest (edge case: public operation)
    return await this.makeApiRequest('/api/scan/preview');
  }
}
```

#### Priority 2: Tenant Services
```typescript
// TenantInfoSingletonService → makeDefaultRequest for tenant operations
class TenantInfoSingletonService extends TenantApiSingleton {
  async getBusinessHours(tenantId: string) {
    // BEFORE: makeAuthenticatedRequest
    // AFTER: makeDefaultRequest (uses TENANT by default)
    return await this.makeDefaultRequest('/api/tenant/business-hours');
  }
  
  async getPaymentGateways(tenantId: string) {
    // BEFORE: makeAuthenticatedRequest
    // AFTER: makeDefaultRequest (uses TENANT by default)
    return await this.makeDefaultRequest('/api/tenant/payment-gateways');
  }
}
```

#### Priority 3: Admin Services
```typescript
// AdminDeletionRequestsService → makeDefaultRequest for admin operations
class AdminDeletionRequestsService extends AdminApiSingleton {
  async getDeletionRequests(status: string) {
    // BEFORE: makeAdminRequest
    // AFTER: makeDefaultRequest (uses ADMIN by default)
    return await this.makeDefaultRequest('/api/admin/deletion-requests');
  }
}
```

#### Priority 4: Public Services
```typescript
// DirectorySingletonService → makeDefaultRequest for public operations
class DirectorySingletonService extends PublicApiSingleton {
  async getPublicDirectory() {
    // BEFORE: makePublicRequest
    // AFTER: makeDefaultRequest (uses PUBLIC by default)
    return await this.makeDefaultRequest('/api/public/directory');
  }
}
```

## 🎯 Alignment Rules

### ✅ **Use makeDefaultRequest() When:**
- Operation matches the service's primary security level
- Method represents the core functionality of the service
- No special validation or headers required beyond default
- Standard caching behavior is appropriate

### ✅ **Use Explicit Methods When:**
- Operation requires different security level than default
- Special validation options needed (bypass, custom groups)
- Different headers required
- Edge case scenarios (admin accessing tenant data, tenant accessing public data)
- Cache behavior needs to be different from default

### 📊 **Decision Tree**

```
Service Method Call
        ↓
┌─────────────────────────────────┐
│ Is this the primary operation?   │
└─────────────────────────────────┘
        ↓
   YES ←→ NO
    ↓        ↓
┌─────────┐ ┌─────────────────────┐
│ Use     │ │ Use explicit method │
│ make    │ │ (makeTenantRequest, │
│ Default │ │ makeAdminRequest,  │
│ Request │ │ makePublicRequest) │
└─────────┘ └─────────────────────┘
```

## 🔧 Implementation Examples

### ✅ **Tenant Service Alignment**
```typescript
class TenantService extends TenantApiSingleton {
  // PRIMARY: Use default (TENANT)
  async getTenantData(tenantId: string) {
    return await this.makeDefaultRequest('/api/tenant/data');
  }
  
  async updateTenantSettings(tenantId: string, settings: any) {
    return await this.makeDefaultRequest('/api/tenant/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
  }
  
  // EDGE CASE: Explicit public access
  async getPublicConfig() {
    return await this.makePublicRequest('/api/public/config');
  }
  
  // EDGE CASE: Explicit admin bypass
  async getTenantAnalyticsAsAdmin(tenantId: string) {
    return await this.makeTenantRequest('/api/tenant/analytics', {
      validateTenantAccess: false
    });
  }
}
```

### ✅ **Admin Service Alignment**
```typescript
class AdminService extends AdminApiSingleton {
  // PRIMARY: Use default (ADMIN)
  async getPlatformStats() {
    return await this.makeDefaultRequest('/api/admin/stats');
  }
  
  async deleteUser(userId: string) {
    return await this.makeDefaultRequest('/api/admin/users', {
      method: 'DELETE'
    });
  }
  
  // EDGE CASE: Explicit tenant context
  async getTenantAnalyticsAsAdmin(tenantId: string) {
    return await this.makeTenantRequest('/api/tenant/analytics', {
      validateTenantAccess: false,
      tenantId
    });
  }
  
  // EDGE CASE: Explicit public access
  async getPublicSystemStatus() {
    return await this.makePublicRequest('/api/public/status');
  }
}
```

## 🚀 Benefits of Alignment

### ✅ **Consistency**
- All services follow the same pattern
- Easy to understand and maintain
- Predictable behavior across codebase

### ✅ **Flexibility**
- Edge cases still handled with explicit methods
- No rigid constraints on service behavior
- Clear distinction between primary and edge case operations

### ✅ **Security**
- Default request type enforces primary security level
- Explicit methods still enforce their security models
- Clear security boundaries per operation

### ✅ **Maintainability**
- Easy to identify primary vs edge case operations
- Clear code intent
- Simplified debugging and testing

## 📋 Migration Checklist

For each service:
- [ ] Identify primary operations (should use makeDefaultRequest)
- [ ] Identify edge cases (should use explicit methods)
- [ ] Update primary operations to use makeDefaultRequest
- [ ] Keep explicit methods for edge cases
- [ ] Add comments explaining reasoning
- [ ] Test security contexts work correctly
- [ ] Verify no breaking changes

## 🎯 Success Metrics

- [ ] 90%+ of service operations use makeDefaultRequest
- [ ] Edge cases clearly documented with explicit methods
- [ ] No security regressions
- [ ] Improved code consistency
- [ ] Easier onboarding for new developers

## 🔄 Rollback Strategy

If issues arise:
1. Keep explicit methods as fallback
2. Gradual migration per service
3. Test each service individually
4. Monitor security and performance
5. Revert problematic changes immediately

## 🎉 Timeline

- **Week 1:** Foundation implementation
- **Week 2:** Priority 1 & 2 services
- **Week 3:** Priority 3 & 4 services
- **Week 4:** Testing, validation, and deployment

Total: **4 weeks** for complete alignment with comprehensive testing.
