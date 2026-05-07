# Context-Aware Permission Architecture Implementation Plan

## 🎯 Executive Summary

This implementation plan creates a sophisticated permission system that integrates seamlessly with the existing context-aware API request architecture. The system will automatically evaluate feature overrides within permission checks, providing a unified approach to access control across all platform layers.

## 🏗️ Architecture Overview

### **Design Principles**
1. **Context-Aware Integration** - Aligns with existing API request patterns
2. **Override-First Logic** - Overrides take precedence over base permissions
3. **Zero-Import Usage** - Permissions available without explicit imports
4. **Performance Optimized** - Sub-100ms cached permission checks
5. **Type-Safe Implementation** - Full TypeScript support with strict typing

### **Layer Architecture - Perfect Alignment with Existing Platform**

```
┌─────────────────────────────────────────────────────────┐
│              LAYER 6: Application Layer                  │
│        (Controllers, Services, Repositories)            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  TenantService, UserService, ProductService, etc.   │ │
│  │  ← Enhanced with zero-import permission methods    │ │
│  └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│              LAYER 5: Extended Context Layer              │
│           (OrganizationPermissionContext)               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Multi-tenant support, Organization-level perms     │ │
│  │  ← Aligns with existing organization services       │ │
│  └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│              LAYER 4: Context Permission Layer           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │
│  │   Tenant    │ │    Admin    │ │      Public         │ │
│  │ Permission  │ │ Permission  │ │    Permission       │ │
│  │   Context   │ │   Context   │ │     Context         │ │
│  │             │ │             │ │                     │ │
│  │ ← Aligns    │ │ ← Aligns    │ │ ← Aligns with       │ │
│  │ with        │ │ with        │ │ PublicApiSingleton  │ │
│  │ AuthenticatedApiSingleton │                     │ │
│  └─────────────┘ └─────────────┘ └─────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│              LAYER 3: Base Permission Layer               │
│                 (BasePermissionService)                  │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Core permission logic with override integration    │ │
│  │  ← Perfect alignment with existing API request      │ │
│  │     services at layers 3, 4, 5                     │ │
│  └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│              LAYER 2: Context-Aware API Layer             │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  PublicApiSingleton, AuthenticatedApiSingleton     │ │
│  │  ← Enhanced with permission-aware request methods   │ │
│  └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│              LAYER 1: Data & Service Layer               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  PrismaClient, OverrideService, TenantService      │ │
│  │  ← Existing services enhanced with permissions     │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### **Perfect Alignment with Existing Platform Layers**

#### **Layer 3 Alignment: BasePermissionService ↔ Existing API Request Services**
```typescript
// Existing Layer 3 Services
class BaseApiService {
  protected makePublicRequest<T>(config: RequestConfig): Promise<T>
  protected makeAuthenticatedRequest<T>(config: RequestConfig): Promise<T>
}

// Enhanced with Permission Integration
class BaseApiService {
  protected makePublicRequest<T>(config: RequestConfig): Promise<T>
  protected makeAuthenticatedRequest<T>(config: RequestConfig): Promise<T>
  
  // NEW: Permission-aware request methods
  protected async makeAuthenticatedRequestWithPermission<T>(
    config: RequestConfig,
    requiredPermission: string
  ): Promise<T> {
    // Check permission before making request
    const hasPermission = await this.checkPermission(config.context, requiredPermission);
    if (!hasPermission) {
      throw new Error(`Insufficient permissions: ${requiredPermission}`);
    }
    return await this.makeAuthenticatedRequest<T>(config);
  }
  
  // NEW: Zero-import permission checking
  protected async checkPermission(context: RequestContext, permission: string): Promise<boolean> {
    const permissionService = PermissionServiceFactory.getTenantContext();
    return await permissionService.hasFeature(context.tenantId, permission);
  }
}
```

#### **Layer 4 Alignment: Context Services ↔ Context-Aware API Architecture**
```typescript
// Existing Layer 4: Context-Aware API Services
class AuthenticatedApiSingleton extends BaseApiService {
  // Existing context-aware methods
  async makeRequest<T>(config: RequestConfig): Promise<T>
  async getTenantInfo(tenantId: string): Promise<TenantInfo>
  async getCurrentUser(context: RequestContext): Promise<User>
}

// Enhanced with Permission Context Integration
class AuthenticatedApiSingleton extends BaseApiService {
  // Existing methods unchanged (backward compatibility)
  
  // NEW: Permission context integration
  private getPermissionContext(tenantId: string): TenantPermissionContext {
    return PermissionServiceFactory.getTenantContext();
  }
  
  // NEW: Permission-aware tenant operations
  async getTenantInfoWithPermissions(tenantId: string): Promise<TenantInfo & { permissions: TenantPermissions }> {
    const [tenantInfo, features, limits] = await Promise.all([
      this.getTenantInfo(tenantId),
      this.getPermissionContext(tenantId).getAllFeatures(tenantId),
      this.getPermissionContext(tenantId).getAllLimits(tenantId)
    ]);
    
    return {
      ...tenantInfo,
      permissions: { features, limits }
    };
  }
}

// PublicApiSingleton alignment
class PublicApiSingleton extends BaseApiService {
  // NEW: Public permission context integration
  private getPublicContext(): PublicPermissionContext {
    return PermissionServiceFactory.getPublicContext();
  }
  
  // NEW: Public permission-aware requests
  async makePublicRequestWithCheck<T>(
    config: RequestConfig,
    resource: string
  ): Promise<T> {
    const canAccess = await this.getPublicContext().canAccess(resource, 'read');
    if (!canAccess) {
      throw new Error(`Public access denied to: ${resource}`);
    }
    return await this.makePublicRequest<T>(config);
  }
}
```

#### **Layer 5 Alignment: Extended Context ↔ Organization Services**
```typescript
// Existing Layer 5: Organization Services
class OrganizationService {
  async getOrganization(orgId: string): Promise<Organization>
  async getOrganizationTenants(orgId: string): Promise<Tenant[]>
  async addTenantToOrganization(orgId: string, tenantId: string): Promise<void>
}

// Enhanced with Organization Permission Context
class OrganizationService {
  // Existing methods unchanged
  
  // NEW: Organization permission context integration
  private getOrgContext(): OrganizationPermissionContext {
    return PermissionServiceFactory.getOrganizationContext();
  }
  
  // NEW: Permission-aware organization operations
  async getOrganizationWithPermissions(orgId: string): Promise<Organization & { permissions: OrganizationPermissions }> {
    const [organization, permissions] = await Promise.all([
      this.getOrganization(orgId),
      this.getOrgContext().getOrganizationPermissions(orgId)
    ]);
    
    return {
      ...organization,
      permissions
    };
  }
  
  // NEW: Permission-controlled tenant management
  async addTenantToOrganizationWithPermission(
    orgId: string, 
    tenantId: string, 
    userId: string
  ): Promise<void> {
    // Check if user has permission to manage organization tenants
    const canManage = await this.getOrgContext().canManageTenants(orgId, userId);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage organization tenants');
    }
    
    await this.addTenantToOrganization(orgId, tenantId);
  }
}
```

## 📋 Detailed Implementation Plan

### **Phase 1: Foundation Layer (Week 1)**

#### **1.1 BasePermissionService.ts**
**Location**: `src/services/permissions/BasePermissionService.ts`

```typescript
abstract class BasePermissionService {
  protected cache: PermissionCache;
  protected overrideService: OverrideService;
  
  // Core permission methods
  abstract hasFeature(tenantId: string, feature: string): Promise<boolean>;
  abstract getLimit(tenantId: string, limitType: string): Promise<number>;
  abstract canAccess(tenantId: string, resource: string, action: string): Promise<boolean>;
  
  // Override integration
  protected async applyOverrides<T>(
    tenantId: string, 
    baseResult: T, 
    overrideType: string
  ): Promise<T>;
  
  // Caching and performance
  protected async getCachedPermission(key: string): Promise<any>;
  protected async setCachedPermission(key: string, value: any): Promise<void>;
  protected async invalidateCache(tenantId: string): Promise<void>;
}
```

**Implementation Tasks**:
- [ ] Create abstract base class with core permission methods
- [ ] Implement override integration logic with priority system
- [ ] Add Redis-based caching with tenant-specific keys
- [ ] Implement cache invalidation on override changes
- [ ] Add comprehensive error handling and logging
- [ ] Add performance monitoring and metrics collection

#### **1.2 PermissionCache.ts**
**Location**: `src/services/permissions/PermissionCache.ts`

```typescript
class PermissionCache {
  private redis: Redis;
  private cacheConfig: CacheConfig;
  
  // Permission-specific caching
  async getPermission(tenantId: string, permission: string): Promise<any>;
  async setPermission(tenantId: string, permission: string, value: any): Promise<void>;
  async invalidateTenant(tenantId: string): Promise<void>;
  async invalidateOverride(overrideId: string): Promise<void>;
  
  // Batch operations
  async getMultiplePermissions(tenantId: string, permissions: string[]): Promise<Record<string, any>>;
  async setMultiplePermissions(tenantId: string, permissions: Record<string, any>): Promise<void>;
}
```

**Implementation Tasks**:
- [ ] Implement Redis-based permission caching
- [ ] Add cache key generation with tenant isolation
- [ ] Implement TTL management for different permission types
- [ ] Add batch operations for performance optimization
- [ ] Implement cache warming strategies
- [ ] Add cache statistics and monitoring

### **Phase 2: Context Layers (Week 2)**

#### **2.1 TenantPermissionContext.ts**
**Location**: `src/services/permissions/contexts/TenantPermissionContext.ts`

```typescript
class TenantPermissionContext extends BasePermissionService {
  constructor(
    private tenantService: TenantService,
    private tierService: TierService,
    private overrideCache: OverrideCache
  ) {
    super();
  }

  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    // 1. Check cache first
    const cacheKey = `feature:${tenantId}:${feature}`;
    const cached = await this.getCachedPermission(cacheKey);
    if (cached !== null) return cached;

    // 2. Check overrides first (highest priority)
    const override = await this.overrideService.getFeatureOverride(tenantId, feature);
    if (override && override.granted) {
      await this.setCachedPermission(cacheKey, true);
      return true;
    }

    // 3. Check base tier permissions
    const tenant = await this.tenantService.getTenant(tenantId);
    const tierFeatures = await this.tierService.getTierFeatures(tenant.subscription_tier);
    const hasFeature = tierFeatures.includes(feature);
    
    await this.setCachedPermission(cacheKey, hasFeature);
    return hasFeature;
  }

  async getLimit(tenantId: string, limitType: string): Promise<number> {
    // Similar override-first logic for limits
    const cacheKey = `limit:${tenantId}:${limitType}`;
    const cached = await this.getCachedPermission(cacheKey);
    if (cached !== null) return cached;

    // Check overrides first
    const override = await this.overrideService.getLimitOverride(tenantId, limitType);
    if (override) {
      await this.setCachedPermission(cacheKey, override.customLimit);
      return override.customLimit;
    }

    // Check base tier limits
    const tenant = await this.tenantService.getTenant(tenantId);
    const tierLimits = await this.tierService.getTierLimits(tenant.subscription_tier);
    const limit = tierLimits[limitType] || 0;
    
    await this.setCachedPermission(cacheKey, limit);
    return limit;
  }
}
```

**Implementation Tasks**:
- [ ] Implement tenant-specific permission context
- [ ] Add tier-based permission checking logic
- [ ] Integrate with existing tenant and tier services
- [ ] Implement override-first priority system
- [ ] Add fallback logic for missing data
- [ ] Add tenant-specific optimizations

#### **2.2 AdminPermissionContext.ts**
**Location**: `src/services/permissions/contexts/AdminPermissionContext.ts`

```typescript
class AdminPermissionContext extends BasePermissionService {
  constructor(
    private userService: UserService,
    private roleService: RoleService
  ) {
    super();
  }

  async hasFeature(userId: string, feature: string): Promise<boolean> {
    // Admin permissions based on user roles
    const user = await this.userService.getUser(userId);
    const roles = await this.roleService.getUserRoles(userId);
    
    // Check admin-specific features
    const adminFeatures = await this.getAdminFeatures(roles);
    return adminFeatures.includes(feature);
  }

  async canManageOverrides(userId: string, tenantId: string): Promise<boolean> {
    // Platform admin can manage all overrides
    const user = await this.userService.getUser(userId);
    if (user.role === 'PLATFORM_ADMIN') return true;
    
    // Tenant admin can manage own tenant overrides
    const tenant = await this.tenantService.getTenant(tenantId);
    return tenant.admin_user_id === userId;
  }

  private async getAdminFeatures(roles: string[]): Promise<string[]> {
    // Role-based feature mapping
    const featureMap: Record<string, string[]> = {
      'PLATFORM_ADMIN': ['*'], // All features
      'TENANT_ADMIN': ['manage_users', 'manage_billing', 'view_analytics'],
      'SUPPORT_ADMIN': ['view_analytics', 'manage_tickets'],
      'READ_ONLY_ADMIN': ['view_analytics']
    };
    
    return roles.flatMap(role => featureMap[role] || []);
  }
}
```

**Implementation Tasks**:
- [ ] Implement admin-specific permission context
- [ ] Add role-based permission checking
- [ ] Implement admin privilege validation
- [ ] Add security constraints and audit logging
- [ ] Integrate with existing user and role services

#### **2.3 PublicPermissionContext.ts**
**Location**: `src/services/permissions/contexts/PublicPermissionContext.ts`

```typescript
class PublicPermissionContext extends BasePermissionService {
  constructor(
    private rateLimitService: RateLimitService,
    private publicDataService: PublicDataService
  ) {
    super();
  }

  async canAccess(resource: string, action: string): Promise<boolean> {
    // Public permissions are read-only by default
    if (action !== 'read') return false;
    
    // Check rate limits
    const clientId = this.getClientId();
    const allowed = await this.rateLimitService.checkLimit(clientId, resource);
    
    return allowed;
  }

  async getPublicFeatures(): Promise<string[]> {
    // Return list of publicly available features
    return [
      'browse_products',
      'view_storefronts',
      'search_catalog',
      'view_categories'
    ];
  }

  private getClientId(): string {
    // Extract client identifier from request context
    return this.getRequestContext().clientId || 'anonymous';
  }
}
```

**Implementation Tasks**:
- [ ] Implement public-facing permission context
- [ ] Add read-only permission model
- [ ] Integrate with rate limiting service
- [ ] Add public data access rules
- [ ] Implement security restrictions

### **Phase 3: Concrete Services (Week 3)**

#### **3.1 TenantFeatureService.ts**
**Location**: `src/services/permissions/TenantFeatureService.ts`

```typescript
class TenantFeatureService {
  constructor(
    private tenantContext: TenantPermissionContext,
    private cacheService: CacheService
  ) {}

  // Simple delegation APIs
  async canUseAdvancedAnalytics(tenantId: string): Promise<boolean> {
    return await this.tenantContext.hasFeature(tenantId, 'advanced_analytics');
  }

  async canCreateCustomBranding(tenantId: string): Promise<boolean> {
    return await this.tenantContext.hasFeature(tenantId, 'custom_branding');
  }

  async canAccessAPI(tenantId: string): Promise<boolean> {
    return await this.tenantContext.hasFeature(tenantId, 'api_access');
  }

  // Batch operations
  async getMultipleFeatures(tenantId: string, features: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    // Batch cache lookup
    const cacheKeys = features.map(f => `feature:${tenantId}:${f}`);
    const cached = await this.cacheService.getMultiple(cacheKeys);
    
    const uncachedFeatures = features.filter((f, i) => cached[i] === null);
    
    if (uncachedFeatures.length > 0) {
      // Batch database lookup for uncached features
      const batchResults = await this.batchCheckFeatures(tenantId, uncachedFeatures);
      
      // Update cache and results
      uncachedFeatures.forEach((feature, i) => {
        results[feature] = batchResults[i];
        this.cacheService.set(`feature:${tenantId}:${feature}`, batchResults[i]);
      });
    }
    
    // Add cached results
    features.forEach((feature, i) => {
      if (cached[i] !== null) {
        results[feature] = cached[i];
      }
    });
    
    return results;
  }

  private async batchCheckFeatures(tenantId: string, features: string[]): Promise<boolean[]> {
    // Implement batch feature checking for performance
    const promises = features.map(f => this.tenantContext.hasFeature(tenantId, f));
    return await Promise.all(promises);
  }
}
```

**Implementation Tasks**:
- [ ] Implement concrete tenant feature service
- [ ] Add specific feature APIs with descriptive names
- [ ] Implement batch operations for multiple features
- [ ] Add performance optimizations with batch processing
- [ ] Integrate with caching layer

#### **3.2 TenantLimitsService.ts**
**Location**: `src/services/permissions/TenantLimitsService.ts`

```typescript
class TenantLimitsService {
  constructor(
    private tenantContext: TenantPermissionContext,
    private usageService: UsageService
  ) {}

  // Limit checking APIs
  async canCreateLocation(tenantId: string): Promise<boolean> {
    const limit = await this.tenantContext.getLimit(tenantId, 'locations');
    const current = await this.usageService.getCurrentUsage(tenantId, 'locations');
    return current < limit;
  }

  async canAddProduct(tenantId: string): Promise<boolean> {
    const limit = await this.tenantContext.getLimit(tenantId, 'products');
    const current = await this.usageService.getCurrentUsage(tenantId, 'products');
    return current < limit;
  }

  async canMakeAPICall(tenantId: string): Promise<boolean> {
    const limit = await this.tenantContext.getLimit(tenantId, 'api_calls_per_hour');
    const current = await this.usageService.getCurrentUsage(tenantId, 'api_calls_per_hour');
    return current < limit;
  }

  // Current count tracking
  async getCurrentUsage(tenantId: string, limitType: string): Promise<number> {
    return await this.usageService.getCurrentUsage(tenantId, limitType);
  }

  async getRemainingCapacity(tenantId: string, limitType: string): Promise<number> {
    const limit = await this.tenantContext.getLimit(tenantId, limitType);
    const current = await this.usageService.getCurrentUsage(tenantId, limitType);
    return Math.max(0, limit - current);
  }

  // Warning thresholds
  async getUsageWarnings(tenantId: string): Promise<Array<{type: string, current: number, limit: number, percentage: number}>> {
    const limitTypes = ['locations', 'products', 'api_calls_per_hour', 'storage_mb'];
    const warnings = [];
    
    for (const type of limitTypes) {
      const limit = await this.tenantContext.getLimit(tenantId, type);
      const current = await this.usageService.getCurrentUsage(tenantId, type);
      const percentage = (current / limit) * 100;
      
      if (percentage >= 80) {
        warnings.push({ type, current, limit, percentage });
      }
    }
    
    return warnings;
  }
}
```

**Implementation Tasks**:
- [ ] Implement concrete tenant limits service
- [ ] Add specific limit checking APIs
- [ ] Implement current count tracking
- [ ] Add batch limit operations
- [ ] Implement warning thresholds and notifications

### **Service Layer Integration - Perfect Alignment with Existing Architecture**

#### **Layer 3 Service Integration Patterns**
```typescript
// Existing Pattern: BaseApiService with context-aware requests
abstract class BaseApiService {
  protected abstract makePublicRequest<T>(config: RequestConfig): Promise<T>;
  protected abstract makeAuthenticatedRequest<T>(config: RequestConfig): Promise<T>;
}

// Enhanced Pattern: Permission-aware base service
abstract class BaseApiService {
  protected abstract makePublicRequest<T>(config: RequestConfig): Promise<T>;
  protected abstract makeAuthenticatedRequest<T>(config: RequestConfig): Promise<T>;
  
  // NEW: Permission integration without breaking existing patterns
  protected async makeAuthenticatedRequestWithPermission<T>(
    config: RequestConfig,
    permission: string
  ): Promise<T> {
    // Seamlessly integrates with existing context-aware architecture
    const context = config.context; // Existing RequestContext pattern
    const hasPermission = await this.checkPermission(context, permission);
    
    if (!hasPermission) {
      throw new PermissionError(`Insufficient permissions: ${permission}`);
    }
    
    // Uses existing authenticated request pattern
    return await this.makeAuthenticatedRequest<T>(config);
  }
  
  // NEW: Zero-import permission checking
  protected async checkPermission(context: RequestContext, permission: string): Promise<boolean> {
    // Leverages existing PermissionServiceFactory pattern
    const permissionService = PermissionServiceFactory.getTenantContext();
    return await permissionService.hasFeature(context.tenantId, permission);
  }
}
```

#### **Layer 4 Context Service Integration**
```typescript
// Existing Pattern: AuthenticatedApiSingleton
class AuthenticatedApiSingleton extends BaseApiService {
  // Existing context-aware methods (unchanged for backward compatibility)
  async makeRequest<T>(config: RequestConfig): Promise<T> { /* existing */ }
  async getTenantInfo(tenantId: string): Promise<TenantInfo> { /* existing */ }
  
  // NEW: Permission context integration - leverages existing patterns
  private getPermissionContext(tenantId: string): TenantPermissionContext {
    // Follows existing factory pattern
    return PermissionServiceFactory.getTenantContext();
  }
  
  // NEW: Enhanced tenant operations with permissions
  async getTenantInfoWithPermissions(tenantId: string): Promise<TenantInfo & { permissions: TenantPermissions }> {
    // Leverages existing parallel request pattern
    const [tenantInfo, features, limits] = await Promise.all([
      this.getTenantInfo(tenantId), // Existing method
      this.getPermissionContext(tenantId).getAllFeatures(tenantId), // New permission method
      this.getPermissionContext(tenantId).getAllLimits(tenantId) // New permission method
    ]);
    
    // Extends existing tenant info pattern
    return {
      ...tenantInfo,
      permissions: { features, limits }
    };
  }
}

// Existing Pattern: PublicApiSingleton
class PublicApiSingleton extends BaseApiService {
  // Existing public request methods (unchanged)
  async makePublicRequest<T>(config: RequestConfig): Promise<T> { /* existing */ }
  
  // NEW: Public permission context integration
  private getPublicContext(): PublicPermissionContext {
    // Follows existing singleton pattern
    return PermissionServiceFactory.getPublicContext();
  }
  
  // NEW: Permission-aware public requests
  async makePublicRequestWithCheck<T>(
    config: RequestConfig,
    resource: string
  ): Promise<T> {
    // Leverages existing public context pattern
    const canAccess = await this.getPublicContext().canAccess(resource, 'read');
    if (!canAccess) {
      throw new PublicAccessError(`Public access denied to: ${resource}`);
    }
    
    // Uses existing public request pattern
    return await this.makePublicRequest<T>(config);
  }
}
```

#### **Layer 5 Extended Context Integration**
```typescript
// Existing Pattern: OrganizationService
class OrganizationService extends BaseApiService {
  // Existing organization methods (unchanged)
  async getOrganization(orgId: string): Promise<Organization> { /* existing */ }
  async getOrganizationTenants(orgId: string): Promise<Tenant[]> { /* existing */ }
  
  // NEW: Organization permission context integration
  private getOrgContext(): OrganizationPermissionContext {
    // Follows existing factory pattern
    return PermissionServiceFactory.getOrganizationContext();
  }
  
  // NEW: Permission-aware organization operations
  async getOrganizationWithPermissions(orgId: string): Promise<Organization & { permissions: OrganizationPermissions }> {
    // Leverages existing parallel request pattern
    const [organization, permissions] = await Promise.all([
      this.getOrganization(orgId), // Existing method
      this.getOrgContext().getOrganizationPermissions(orgId) // New permission method
    ]);
    
    // Extends existing organization pattern
    return {
      ...organization,
      permissions
    };
  }
  
  // NEW: Permission-controlled tenant management
  async addTenantToOrganizationWithPermission(
    orgId: string, 
    tenantId: string, 
    userId: string
  ): Promise<void> {
    // Leverages existing permission checking pattern
    const canManage = await this.getOrgContext().canManageTenants(orgId, userId);
    if (!canManage) {
      throw new PermissionError('Insufficient permissions to manage organization tenants');
    }
    
    // Uses existing tenant addition pattern
    await this.addTenantToOrganization(orgId, tenantId);
  }
}
```

#### **Service Layer Enhancement Patterns**
```typescript
// Existing Pattern: Service enhancement
class TenantService extends BaseApiService {
  // Existing methods
  async getTenant(tenantId: string): Promise<Tenant> { /* existing */ }
  async updateTenant(tenantId: string, data: Partial<Tenant>): Promise<Tenant> { /* existing */ }
}

// Enhanced Pattern: Permission-aware service
class TenantService extends BaseApiService {
  // Existing methods unchanged (backward compatibility)
  async getTenant(tenantId: string): Promise<Tenant> { /* existing */ }
  async updateTenant(tenantId: string, data: Partial<Tenant>): Promise<Tenant> { /* existing */ }
  
  // NEW: Permission-aware tenant operations
  async getTenantWithPermissions(tenantId: string): Promise<Tenant & { permissions: TenantPermissions }> {
    // Leverages existing tenant fetching
    const [tenant, permissions] = await Promise.all([
      this.getTenant(tenantId),
      this.getTenantPermissions(tenantId)
    ]);
    
    return { ...tenant, permissions };
  }
  
  // NEW: Permission-controlled updates
  async updateTenantWithPermission(
    tenantId: string, 
    data: Partial<Tenant>, 
    userId: string
  ): Promise<Tenant> {
    // Check if user can update tenant
    const canUpdate = await this.canUpdateTenant(tenantId, userId);
    if (!canUpdate) {
      throw new PermissionError('Insufficient permissions to update tenant');
    }
    
    // Uses existing update pattern
    return await this.updateTenant(tenantId, data);
  }
  
  // NEW: Permission checking helper
  private async getTenantPermissions(tenantId: string): Promise<TenantPermissions> {
    const permissionService = PermissionServiceFactory.getTenantContext();
    const [features, limits] = await Promise.all([
      permissionService.getAllFeatures(tenantId),
      permissionService.getAllLimits(tenantId)
    ]);
    
    return { features, limits };
  }
  
  private async canUpdateTenant(tenantId: string, userId: string): Promise<boolean> {
    const permissionService = PermissionServiceFactory.getAdminContext();
    return await permissionService.canManageTenant(userId, tenantId);
  }
}
```

### **Phase 4: Service Factory & Integration (Week 4)**

#### **4.1 PermissionServiceFactory.ts**
**Location**: `src/services/permissions/PermissionServiceFactory.ts`

```typescript
class PermissionServiceFactory {
  private static instances: Map<string, any> = new Map();
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize all permission services
    const tenantContext = new TenantPermissionContext(
      getTenantService(),
      getTierService(),
      getOverrideCacheService()
    );

    const adminContext = new AdminPermissionContext(
      getUserService(),
      getRoleService()
    );

    const publicContext = new PublicPermissionContext(
      getRateLimitService(),
      getPublicDataService()
    );

    // Store instances
    this.instances.set('tenant', tenantContext);
    this.instances.set('admin', adminContext);
    this.instances.set('public', publicContext);

    // Initialize concrete services
    this.instances.set('tenantFeatures', new TenantFeatureService(
      tenantContext,
      getCacheService()
    ));

    this.instances.set('tenantLimits', new TenantLimitsService(
      tenantContext,
      getUsageService()
    ));

    this.initialized = true;
  }

  static getTenantContext(): TenantPermissionContext {
    this.ensureInitialized();
    return this.instances.get('tenant');
  }

  static getAdminContext(): AdminPermissionContext {
    this.ensureInitialized();
    return this.instances.get('admin');
  }

  static getPublicContext(): PublicPermissionContext {
    this.ensureInitialized();
    return this.instances.get('public');
  }

  static getTenantFeatures(): TenantFeatureService {
    this.ensureInitialized();
    return this.instances.get('tenantFeatures');
  }

  static getTenantLimits(): TenantLimitsService {
    this.ensureInitialized();
    return this.instances.get('tenantLimits');
  }

  private static ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('PermissionServiceFactory not initialized. Call initialize() first.');
    }
  }

  static async invalidateCache(tenantId: string): Promise<void> {
    // Invalidate all permission caches for a tenant
    const tenantContext = this.getTenantContext();
    await tenantContext.invalidateCache(tenantId);
  }

  static getCacheStats(): any {
    // Return cache statistics for monitoring
    return {
      totalKeys: 0,
      hitRate: 0,
      memoryUsage: '0MB'
    };
  }
}
```

**Implementation Tasks**:
- [ ] Implement singleton factory pattern
- [ ] Add service lifecycle management
- [ ] Implement cache coordination across services
- [ ] Add performance monitoring and metrics
- [ ] Implement proper error handling for factory initialization

#### **4.2 Platform Layer Integration**
**Location**: `src/services/platform/BasePlatformService.ts`

```typescript
// Enhance existing base platform service
abstract class BasePlatformService {
  // ... existing methods ...

  // Add permission integration
  protected async checkPermission(tenantId: string, permission: string): Promise<boolean> {
    const permissionService = PermissionServiceFactory.getTenantContext();
    return await permissionService.hasFeature(tenantId, permission);
  }

  protected async checkLimit(tenantId: string, limitType: string): Promise<number> {
    const permissionService = PermissionServiceFactory.getTenantContext();
    return await permissionService.getLimit(tenantId, limitType);
  }

  protected async canPerformAction(
    tenantId: string, 
    resource: string, 
    action: string
  ): Promise<boolean> {
    const permissionService = PermissionServiceFactory.getTenantContext();
    return await permissionService.canAccess(tenantId, resource, action);
  }
}
```

**Implementation Tasks**:
- [ ] Enhance existing base platform service with permission methods
- [ ] Implement automatic permission method inheritance
- [ ] Add zero-import permission checking capabilities
- [ ] Ensure backward compatibility with existing services
- [ ] Add comprehensive error handling

### **Phase 5: Context-Aware API Integration (Week 5)**

#### **5.1 API Middleware Integration**
**Location**: `src/middleware/permission-middleware.ts`

```typescript
// Permission middleware for API endpoints
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const permissionService = PermissionServiceFactory.getTenantContext();
      const hasPermission = await permissionService.hasFeature(tenantId, permission);

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

export const requireLimit = (limitType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const permissionService = PermissionServiceFactory.getTenantLimits();
      const canProceed = await permissionService[`can${limitType}`](tenantId);

      if (!canProceed) {
        return res.status(429).json({ error: 'Limit exceeded' });
      }

      next();
    } catch (error) {
      console.error('Limit middleware error:', error);
      res.status(500).json({ error: 'Limit check failed' });
    }
  };
};
```

**Implementation Tasks**:
- [ ] Create permission middleware for API endpoints
- [ ] Implement limit checking middleware
- [ ] Add context-aware permission evaluation
- [ ] Integrate with existing authentication middleware
- [ ] Add comprehensive error handling

#### **5.2 Context-Aware Request Enhancement**
**Location**: `src/services/api/ContextAwareRequestService.ts`

```typescript
// Enhance existing context-aware request service
class ContextAwareRequestService {
  // ... existing methods ...

  // Add permission checking to request context
  async checkPermission(context: RequestContext, permission: string): Promise<boolean> {
    const permissionService = PermissionServiceFactory.getTenantContext();
    return await permissionService.hasFeature(context.tenantId, permission);
  }

  async checkLimit(context: RequestContext, limitType: string): Promise<number> {
    const permissionService = PermissionServiceFactory.getTenantContext();
    return await permissionService.getLimit(context.tenantId, limitType);
  }

  // Add permission-aware request methods
  async makeAuthenticatedRequestWithPermission<T>(
    config: RequestConfig,
    permission: string
  ): Promise<T> {
    // Check permission before making request
    const hasPermission = await this.checkPermission(config.context, permission);
    if (!hasPermission) {
      throw new Error(`Insufficient permissions: ${permission}`);
    }

    // Proceed with authenticated request
    return await this.makeAuthenticatedRequest<T>(config);
  }
}
```

**Implementation Tasks**:
- [ ] Enhance existing context-aware request service
- [ ] Add permission checking to request context
- [ ] Implement permission-aware request methods
- [ ] Integrate with existing API request patterns
- [ ] Maintain backward compatibility

## 🧪 Testing Strategy

### **Unit Tests**
```typescript
// Example test structure
describe('TenantPermissionContext', () => {
  describe('hasFeature', () => {
    it('should return true when override grants feature', async () => {
      // Test override-first logic
    });

    it('should return true when tier includes feature', async () => {
      // Test base tier logic
    });

    it('should return false when no override or tier feature', async () => {
      // Test fallback logic
    });

    it('should cache results for performance', async () => {
      // Test caching behavior
    });
  });
});
```

### **Integration Tests**
```typescript
describe('Permission Integration', () => {
  it('should apply overrides immediately to permission checks', async () => {
    // Create override → check permission flow
  });

  it('should invalidate cache on override changes', async () => {
    // Test cache invalidation
  });

  it('should work with context-aware API requests', async () => {
    // Test API integration
  });
});
```

### **Performance Tests**
```typescript
describe('Permission Performance', () => {
  it('should complete permission checks in < 100ms', async () => {
    // Performance benchmarking
  });

  it('should handle 1000+ concurrent permission checks', async () => {
    // Load testing
  });
});
```

## 📊 Success Metrics & KPIs

### **Performance Metrics**
- **Response Time**: < 100ms for cached permission checks
- **Cache Hit Rate**: > 90% for frequently accessed permissions
- **Memory Usage**: < 100MB for permission cache
- **Concurrent Users**: Support 10,000+ concurrent permission checks

### **Functional Metrics**
- **Override Accuracy**: 100% of overrides reflected in permission checks
- **Feature Coverage**: All platform features integrated with permission system
- **Error Rate**: < 0.1% for permission checks
- **Cache Invalidation**: < 5 seconds for override propagation

### **Integration Metrics**
- **Zero Import Success**: 100% of services use permissions without imports
- **Backward Compatibility**: 0% breaking changes to existing services
- **Developer Adoption**: > 80% of new services use permission system
- **Documentation Coverage**: 100% API documentation for permission methods

## 🚅 Deployment Strategy

### **Phase 1: Foundation Deployment**
- Deploy BasePermissionService and caching layer
- Monitor performance and cache effectiveness
- Validate override integration

### **Phase 2: Context Layer Deployment**
- Deploy tenant, admin, and public contexts
- Test context-specific permission logic
- Validate caching and performance

### **Phase 3: Service Integration**
- Deploy concrete permission services
- Integrate with existing platform services
- Test zero-import functionality

### **Phase 4: API Integration**
- Deploy permission middleware
- Integrate with context-aware API layer
- Test end-to-end permission flows

### **Phase 5: Production Rollout**
- Gradual rollout to production environment
- Monitor performance and error rates
- Collect developer feedback

## 🔄 Dependencies & Prerequisites

### **Required Dependencies**
- **Phase 1 Override System**: Must be complete and stable
- **Context-Aware API Layer**: Existing API request architecture
- **Redis Infrastructure**: For permission caching
- **Existing Services**: Tenant, User, Tier, Usage services

### **Optional Dependencies**
- **Monitoring Infrastructure**: For performance tracking
- **Analytics Service**: For permission usage metrics
- **Testing Framework**: For comprehensive test coverage

## 📚 Documentation Requirements

### **Technical Documentation**
- [ ] Permission Architecture Overview
- [ ] API Reference Documentation
- [ ] Integration Guide for Developers
- [ ] Performance Tuning Guide
- [ ] Troubleshooting Guide

### **Developer Documentation**
- [ ] Quick Start Guide
- [ ] Common Usage Patterns
- [ ] Best Practices Guide
- [ ] Migration Guide for Existing Services
- [ ] FAQ and Common Issues

## 🎯 Timeline Summary

| Week | Focus | Key Deliverables |
|------|-------|------------------|
| 1 | Foundation | BasePermissionService, PermissionCache |
| 2 | Context Layers | Tenant, Admin, Public contexts |
| 3 | Concrete Services | TenantFeatureService, TenantLimitsService |
| 4 | Integration | ServiceFactory, Platform integration |
| 5 | API Integration | Middleware, Context-aware requests |
| 6 | Testing & Deployment | Comprehensive tests, Production rollout |

**Total Estimated Timeline**: 6 weeks
**Team Size**: 2-3 developers
**Risk Level**: Medium (depends on existing service stability)

This implementation plan provides a comprehensive roadmap for building a context-aware permission system that seamlessly integrates with the existing platform architecture while providing enterprise-grade performance and functionality.
