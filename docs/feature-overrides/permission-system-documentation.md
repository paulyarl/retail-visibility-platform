# Permission System Documentation

## Overview

The Permission System provides a comprehensive, context-aware permission architecture integrated with the platform's singleton hierarchy. It supports tier-based, role-based, and public access control patterns with caching, override support, and zero-import convenience methods.

## Architecture

### Layer Structure

```
┌─────────────────────────────────────────────────────────┐
│              LAYER 6: Application Layer                  │
│        PermissionAwareProductService, etc.              │
├─────────────────────────────────────────────────────────┤
│              LAYER 5: Extended Context Layer              │
│           OrganizationPermissionContext                  │
├─────────────────────────────────────────────────────────┤
│              LAYER 4: Context Permission Layer           │
│  TenantPermissionContext │ AdminPermissionContext │     │
│  PublicPermissionContext                                │
├─────────────────────────────────────────────────────────┤
│              LAYER 3: Base Permission Layer               │
│           BasePermissionService                          │
├─────────────────────────────────────────────────────────┤
│              Integration Components                       │
│  Decorators │ BaseService │ Repository │ Controller     │
└─────────────────────────────────────────────────────────┘
```

### Singleton Hierarchy Alignment

```
UniversalSingleton (existing base)
    └── BasePermissionService (Layer 3)
            ├── TenantPermissionContext (Layer 4, singleton)
            ├── AdminPermissionContext (Layer 4, singleton)
            └── PublicPermissionContext (Layer 4, singleton)

Extended Services (Layer 5):
├── TenantFeatureService (singleton)
├── TenantLimitsService (singleton)
├── OrganizationPermissionContext (singleton)
└── PermissionServiceFactory (unified access)
```

---

## Core Components

### 1. TenantPermissionContext

Tier-based permission checking for tenant resources.

```typescript
import { tenantPermissionContext } from './services/permissions';

// Check feature availability
const hasAdvancedAnalytics = await tenantPermissionContext.hasFeature(
  tenantId,
  'advancedAnalytics'
);

// Get tier limit
const productLimit = await tenantPermissionContext.getLimit(tenantId, 'products');

// Check resource access
const canRead = await tenantPermissionContext.canAccess(tenantId, 'analytics', 'read');

// Convenience methods
const canUseAPI = await tenantPermissionContext.canAccessAPI(tenantId);
const canUseAdvanced = await tenantPermissionContext.canUseAdvancedAnalytics(tenantId);
```

**Tier Features:**

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| basicAnalytics | ✓ | ✓ | ✓ |
| advancedAnalytics | ✗ | ✓ | ✓ |
| apiAccess | ✗ | ✓ | ✓ |
| bulkOperations | ✗ | ✓ | ✓ |
| customBranding | ✗ | ✓ | ✓ |
| whiteLabel | ✗ | ✗ | ✓ |
| prioritySupport | ✗ | ✗ | ✓ |

**Tier Limits:**

| Limit | Starter | Professional | Enterprise |
|-------|---------|--------------|------------|
| products | 100 | 1,000 | Unlimited (-1) |
| locations | 1 | 5 | Unlimited (-1) |
| users | 1 | 10 | Unlimited (-1) |
| storage (MB) | 500 | 5,000 | Unlimited (-1) |
| apiCallsPerMonth | 1,000 | 10,000 | Unlimited (-1) |

---

### 2. AdminPermissionContext

Role-based permission checking for admin operations.

```typescript
import { adminPermissionContext } from './services/permissions';

// Check admin feature
const canManageAll = await adminPermissionContext.hasFeature(
  userId,
  'manageAllTenants'
);

// Platform admin check
const isPlatformAdmin = await adminPermissionContext.isPlatformAdmin(userId);

// Convenience methods
const canManageOverrides = await adminPermissionContext.canManageOverrides(userId);
const canViewAudit = await adminPermissionContext.canViewAuditLogs(userId);
const canManageTickets = await adminPermissionContext.canManageTickets(userId);

// Get managed tenants
const managedTenants = await adminPermissionContext.getManagedTenants(userId);

// Log admin action
await adminPermissionContext.logAdminAction(
  userId,
  'TENANT_UPDATE',
  'tenant',
  tenantId,
  { changes: { name: 'New Name' } }
);
```

**Admin Roles & Features:**

| Feature | PLATFORM_ADMIN | PLATFORM_SUPPORT | PLATFORM_VIEWER |
|---------|----------------|------------------|-----------------|
| manageAllTenants | ✓ | ✗ | ✗ |
| manageTenantUsers | ✓ | ✗ | ✗ |
| manageBilling | ✓ | ✗ | ✗ |
| viewAnalytics | ✓ | ✓ | ✓ |
| manageOverrides | ✓ | ✗ | ✗ |
| manageTickets | ✓ | ✓ | ✗ |
| auditAccess | ✓ | ✓ | ✗ |
| systemConfig | ✓ | ✗ | ✗ |

---

### 3. PublicPermissionContext

Read-only permissions for public/unauthenticated access.

```typescript
import { publicPermissionContext } from './services/permissions';

// Check public feature
const canBrowse = await publicPermissionContext.hasFeature(
  clientId,
  'browseProducts'
);

// Check public access (read-only)
const canRead = await publicPermissionContext.canAccess(clientId, 'products', 'read');

// Get rate limits
const rateLimit = await publicPermissionContext.getLimit(clientId, 'requestsPerMinute');

// Convenience methods
const canBrowseProducts = await publicPermissionContext.canBrowseProducts(clientId);
const canViewCategories = await publicPermissionContext.canViewCategories(clientId);

// Generate client identifier
const clientId = publicPermissionContext.getClientIdentifier({
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});
```

**Public Features:**

| Feature | Access |
|---------|--------|
| browseProducts | ✓ |
| viewStorefronts | ✓ |
| searchCatalog | ✓ |
| viewCategories | ✓ |
| viewHours | ✓ |
| viewFeatured | ✓ |

**Rate Limits:**

| Limit | Value |
|-------|-------|
| requestsPerMinute | 60 |
| requestsPerHour | 1,000 |
| requestsPerDay | 10,000 |

---

### 4. OrganizationPermissionContext

Multi-tenant organization-level permissions.

```typescript
import { organizationPermissionContext } from './services/permissions';

// Check organization membership
const isMember = await organizationPermissionContext.isMember(userId, organizationId);
const isOwner = await organizationPermissionContext.isOwner(userId, organizationId);
const isAdmin = await organizationPermissionContext.isAdmin(userId, organizationId);

// Get user role
const role = await organizationPermissionContext.getUserRole(userId, organizationId);

// Check organization feature
const canManageTenants = await organizationPermissionContext.hasFeature(
  userId,
  organizationId,
  'manageAllTenants'
);

// Tenant management
const canManage = await organizationPermissionContext.canManageTenant(
  userId,
  organizationId,
  tenantId
);
const canCreate = await organizationPermissionContext.canCreateTenant(userId, organizationId);

// Get managed tenants
const managedTenants = await organizationPermissionContext.getManagedTenants(
  userId,
  organizationId
);

// Get organization permissions bundle
const permissions = await organizationPermissionContext.getOrganizationPermissions(
  userId,
  organizationId
);
```

**Organization Roles:**

| Feature | ORG_OWNER | ORG_ADMIN | ORG_MEMBER | ORG_VIEWER |
|---------|-----------|-----------|------------|------------|
| manageAllTenants | ✓ | ✓ | ✗ | ✗ |
| createTenants | ✓ | ✓ | ✗ | ✗ |
| billingManagement | ✓ | ✓ | ✗ | ✗ |
| userManagement | ✓ | ✓ | ✗ | ✗ |
| analyticsAccess | ✓ | ✓ | ✓ | ✓ |
| apiManagement | ✓ | ✓ | ✗ | ✗ |
| customBranding | ✓ | ✓ | ✗ | ✗ |
| ssoIntegration | ✓ | ✗ | ✗ | ✗ |

---

### 5. PermissionServiceFactory

Unified access point with zero-import convenience methods.

```typescript
import { permissionServiceFactory } from './services/permissions';

// Get specific context services
const tenantService = permissionServiceFactory.getTenantService();
const adminService = permissionServiceFactory.getAdminService();
const publicService = permissionServiceFactory.getPublicService();
const featureService = permissionServiceFactory.getFeatureService();
const limitsService = permissionServiceFactory.getLimitsService();

// Context-aware service selection
const service = permissionServiceFactory.getServiceForContext('tenant');

// Zero-import convenience methods
const hasFeature = await permissionServiceFactory.hasFeature(tenantId, 'advancedAnalytics');
const limit = await permissionServiceFactory.getLimit(tenantId, 'products');
const canAccess = await permissionServiceFactory.canAccess(tenantId, 'analytics', 'read');
const isPlatformAdmin = await permissionServiceFactory.isPlatformAdmin(userId);

// Limit checking
const wouldExceed = await permissionServiceFactory.wouldExceedLimit(tenantId, 'products', 10);
const status = await permissionServiceFactory.getLimitStatus(tenantId, 'products');
const canAdd = await permissionServiceFactory.canAddProduct(tenantId);

// Permission bundles
const tenantPerms = await permissionServiceFactory.getTenantPermissions(tenantId);
const adminPerms = await permissionServiceFactory.getAdminPermissions(userId);
const publicPerms = await permissionServiceFactory.getPublicPermissions(clientId);

// Cache management
await permissionServiceFactory.invalidateTenantCache(tenantId);

// Metrics
const metrics = permissionServiceFactory.getMetrics();
```

---

## Integration Patterns

### 1. Decorator Pattern

Use decorators for method-level permission enforcement.

```typescript
import { 
  RequireFeature, 
  RequireLimit, 
  RequireAccess,
  RequireRole,
  RequirePermissions 
} from './services/permissions';

class ProductService {
  // Require single feature
  @RequireFeature({ feature: 'apiAccess' })
  async getProduct(tenantId: string, productId: string) {
    // ... implementation
  }

  // Require limit with consumption
  @RequireLimit({ limitType: 'products', required: 1, consume: true })
  async createProduct(tenantId: string, data: CreateProductInput) {
    // ... implementation
  }

  // Require resource access
  @RequireAccess({ resource: 'products', action: 'update' })
  async updateProduct(tenantId: string, productId: string, data: any) {
    // ... implementation
  }

  // Require admin role
  @RequireRole({ role: 'PLATFORM_ADMIN' })
  async deleteProduct(userId: string, productId: string) {
    // ... implementation
  }

  // Combined permissions
  @RequirePermissions({
    feature: 'bulkOperations',
    limit: { type: 'products', required: 100 },
    resource: 'products',
    action: 'create'
  })
  async bulkCreateProducts(tenantId: string, products: any[]) {
    // ... implementation
  }
}
```

### 2. Base Service Inheritance

Extend `PermissionEnhancedBaseService` for inherited permission methods.

```typescript
import { PermissionEnhancedBaseService } from './services/permissions';

class MyService extends PermissionEnhancedBaseService {
  constructor() {
    super('MyService');
  }

  async createItem(tenantId: string, data: any) {
    // Require feature
    await this.requireFeature(tenantId, 'customFeature');
    
    // Require limit
    await this.requireLimit(tenantId, 'items', 1);
    
    // Require access
    await this.requireAccess(tenantId, 'items', 'create');
    
    // ... implementation
    
    // Track usage after success
    await this.trackLimitUsage(tenantId, 'items', 1);
  }

  async checkPermissions(tenantId: string) {
    // Non-throwing checks
    const featureCheck = await this.checkFeature(tenantId, 'myFeature');
    const limitCheck = await this.checkLimit(tenantId, 'items', 5);
    const accessCheck = await this.checkAccess(tenantId, 'items', 'read');
    
    return {
      hasFeature: featureCheck.allowed,
      hasLimit: limitCheck.allowed,
      hasAccess: accessCheck.allowed
    };
  }
}
```

### 3. Repository Protection

Use `PermissionProtectedRepository` for data-layer enforcement.

```typescript
import { PermissionProtectedRepository } from './services/permissions';

class ProductRepository extends PermissionProtectedRepository {
  constructor(prisma: PrismaClient) {
    super('products', prisma);
  }

  async create(tenantId: string, data: any) {
    // Enforce create permission (access + limit)
    await this.enforceCreate(tenantId, 'products', 1);
    
    const product = await this.prisma.products.create({
      data: { ...data, tenant_id: tenantId }
    });
    
    // Track usage
    await this.trackUsage(tenantId, 'products', 1);
    
    return product;
  }

  async findMany(tenantId: string) {
    // Enforce read permission
    await this.enforceRead(tenantId);
    
    return this.prisma.products.findMany({
      where: this.createTenantQuery(tenantId)
    });
  }

  async update(tenantId: string, productId: string, data: any) {
    // Enforce update permission
    await this.enforceUpdate(tenantId);
    
    return this.prisma.products.update({
      where: { id: productId },
      data
    });
  }

  async delete(tenantId: string, productId: string) {
    // Enforce delete permission
    await this.enforceDelete(tenantId, 'products');
    
    const result = await this.prisma.products.delete({
      where: { id: productId }
    });
    
    // Release usage
    await this.releaseUsage(tenantId, 'products', 1);
    
    return result;
  }
}
```

### 4. Controller Authorization

Use `ControllerAuthorization` for HTTP-level checks.

```typescript
import { ControllerAuthorization, authorize } from './services/permissions';
import { Request, Response } from 'express';

class ProductController {
  // Using class instance
  async create(req: Request, res: Response) {
    const auth = new ControllerAuthorization(req, res);
    
    // Require feature (sends 403 if denied)
    if (!await auth.requireFeature('apiAccess')) return;
    
    // Require limit
    if (!await auth.requireLimit('products', 1)) return;
    
    // ... controller logic
    
    res.json({ success: true, product: createdProduct });
  }

  // Using helper functions
  async update(req: Request, res: Response) {
    if (!await authorize(req, res).requireFeature('apiAccess')) return;
    if (!await authorize(req, res).requireAccess('products', 'update')) return;
    
    // ... controller logic
  }

  // Combined permissions
  async bulkCreate(req: Request, res: Response) {
    const auth = new ControllerAuthorization(req, res);
    
    const authorized = await auth.requirePermissions({
      feature: 'bulkOperations',
      limit: { type: 'products', required: req.body.products.length },
      access: { resource: 'products', action: 'create' }
    });
    
    if (!authorized) return;
    
    // ... controller logic
  }

  // Admin operations
  async adminDelete(req: Request, res: Response) {
    const auth = new ControllerAuthorization(req, res);
    
    if (!await auth.requirePlatformAdmin()) return;
    
    // ... controller logic
  }
}
```

### 5. Middleware Integration

Use existing middleware for route-level protection.

```typescript
import { 
  requireFeature, 
  requireLimit, 
  requireAdmin,
  requirePlatformAdmin 
} from './services/permissions';

// Express routes
app.post(
  '/api/products',
  requireFeature('apiAccess'),
  requireLimit('products'),
  productController.create
);

app.get(
  '/api/analytics/advanced',
  requireFeature('advancedAnalytics'),
  analyticsController.getAdvanced
);

app.delete(
  '/api/admin/tenants/:tenantId',
  requirePlatformAdmin(),
  adminController.deleteTenant
);
```

---

## Caching

### Cache Keys

Permission results are cached with tenant-isolated keys:

```
perm:{tenantId}:feature:{featureName}
perm:{tenantId}:limit:{limitType}
perm:{tenantId}:access:{resource}:{action}
org_role:{userId}:{organizationId}
org_feature:{userId}:{organizationId}:{feature}
```

### Cache TTLs

| Permission Type | TTL |
|-----------------|-----|
| Tenant Features | 5 minutes |
| Tenant Limits | 5 minutes |
| Admin Features | 5 minutes |
| Public Permissions | 1 minute |
| Organization Roles | 5 minutes |

### Cache Invalidation

```typescript
// Invalidate all tenant permissions
await permissionServiceFactory.invalidateTenantCache(tenantId);

// Invalidate user organization cache
await organizationPermissionContext.invalidateUserOrgCache(userId, organizationId);

// Invalidate organization cache
await organizationPermissionContext.invalidateOrganizationCache(organizationId);
```

---

## Error Handling

### PermissionError

All permission failures throw `PermissionError`:

```typescript
import { PermissionError } from './services/permissions';

try {
  await somePermissionProtectedOperation();
} catch (error) {
  if (error instanceof PermissionError) {
    console.log('Code:', error.code);
    console.log('Message:', error.message);
    console.log('Details:', error.details);
    
    // Error codes:
    // - FEATURE_DENIED
    // - LIMIT_EXCEEDED
    // - ACCESS_DENIED
    // - ROLE_DENIED
    // - MISSING_CONTEXT
    // - PLATFORM_ADMIN_REQUIRED
  }
}
```

### HTTP Response Codes

The `ControllerAuthorization` class sends appropriate HTTP responses:

| Code | Scenario |
|------|----------|
| 401 | Missing authentication |
| 403 | Permission denied |
| 404 | Resource not found |
| 422 | Unprocessable entity |
| 429 | Rate limited |

---

## Testing

Run the test suite:

```bash
npx ts-node src/services/permissions/__tests__/quick-test.ts
```

Expected output: **74 tests passing** in ~20ms

---

## Best Practices

1. **Use the Factory**: Prefer `permissionServiceFactory` for zero-import convenience
2. **Cache Wisely**: Invalidation should happen on tier changes, overrides, and user role changes
3. **Layer Appropriately**: 
   - Middleware for route protection
   - Controller for request-level checks
   - Service for business logic
   - Repository for data access
4. **Handle Errors Gracefully**: Catch `PermissionError` and provide user-friendly messages
5. **Track Usage**: Always track limit usage after successful operations

---

## Feature Overrides

### Override-First Logic

The permission system implements an "override-first" approach where permissions are evaluated in priority order:

1. **Override** (highest priority) - Temporary permissions from `tenant_feature_overrides_list`
2. **Tier** (base permissions) - Standard tier-based permissions from subscription
3. **Default** (fallback) - System defaults when no tier is set

This allows administrators to grant temporary access to features or increase limits without changing a tenant's subscription tier.

### Override Database Schema

```prisma
model tenant_feature_overrides_list {
  id         String    @id
  tenant_id  String
  feature    String    // Feature name or limit type
  granted    Boolean   @default(true)
  reason     String?   // Why the override was granted
  expires_at DateTime? // When the override expires (null = permanent)
  granted_by String    // Admin user who granted the override
  created_at DateTime  @default(now())
  updated_at DateTime

  @@unique([tenant_id, feature])
}
```

### Creating Overrides

```typescript
import { overrideService } from './services/permissions';

// Grant temporary feature access
await overrideService.grantOverride({
  tenantId: 'tenant-123',
  feature: 'advancedAnalytics',
  reason: 'Trial extension for enterprise evaluation',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  grantedBy: 'admin-456'
});

// Increase limit temporarily
await overrideService.grantOverride({
  tenantId: 'tenant-123',
  feature: 'products',
  value: 5000, // Override limit to 5000
  reason: 'Bulk upload permission for migration',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
  grantedBy: 'admin-456'
});

// Grant permanent override (no expiration)
await overrideService.grantOverride({
  tenantId: 'tenant-456',
  feature: 'whiteLabel',
  reason: 'Enterprise partner agreement',
  grantedBy: 'admin-789'
  // No expiresAt = permanent
});
```

### Managing Overrides

```typescript
// Get all overrides for a tenant
const overrides = await overrideService.getTenantOverrides('tenant-123');

// Get active overrides only
const activeOverrides = await overrideService.getActiveOverrides('tenant-123');

// Check if specific override exists
const hasOverride = await overrideService.hasActiveOverride('tenant-123', 'advancedAnalytics');

// Revoke an override
await overrideService.revokeOverride('tenant-123', 'advancedAnalytics', 'admin-456');

// Extend an override
await overrideService.extendOverride('tenant-123', 'advancedAnalytics', 
  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 more days
);

// Get override history
const history = await overrideService.getOverrideHistory('tenant-123');
```

### Override Behavior

| Behavior | Description |
|----------|-------------|
| **Expiration** | Overrides automatically expire when `expires_at` is reached |
| **Cache Invalidation** | Creating/revoking overrides invalidates tenant permission cache |
| **Priority** | Active overrides always take precedence over tier permissions |
| **Audit Trail** | All overrides track `granted_by`, `reason`, and timestamps |
| **Uniqueness** | One override per tenant per feature (updates replace existing) |

### Override vs Tier Comparison

```typescript
// Check what source is providing the permission
const featurePerm = await tenantPermissionContext.getFeaturePermission(tenantId, 'advancedAnalytics');

console.log(featurePerm.source); // 'override' | 'tier' | 'default'
console.log(featurePerm.expiresAt); // Date if override, null otherwise

// Get limit with source information
const limitPerm = await tenantPermissionContext.getLimitPermission(tenantId, 'products');
console.log(limitPerm.source); // 'override' | 'tier' | 'default'
```

### Admin Override Management

```typescript
import { adminPermissionContext } from './services/permissions';

// Admin methods for override management (requires manageOverrides permission)
if (await adminPermissionContext.canManageOverrides(userId)) {
  // Grant override
  await overrideService.grantOverride({
    tenantId: 'tenant-123',
    feature: 'apiAccess',
    reason: 'Partner integration project',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    grantedBy: userId
  });
  
  // Bulk grant overrides
  await overrideService.bulkGrantOverrides({
    tenantIds: ['tenant-1', 'tenant-2', 'tenant-3'],
    feature: 'bulkOperations',
    reason: 'Holiday season preparation',
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    grantedBy: userId
  });
}
```

### Override Expiration Handling

Expired overrides are automatically ignored by the permission system:

```typescript
// The permission system automatically filters expired overrides
// No manual cleanup required, but you can prune for database hygiene:

// Prune expired overrides (admin operation)
await overrideService.pruneExpiredOverrides();

// Get expiring soon overrides (for notifications)
const expiringSoon = await overrideService.getExpiringOverrides({
  withinDays: 7
});
```

---

## Migration Guide

### From Direct Checks

**Before:**
```typescript
const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
if (tenant.subscription_tier !== 'enterprise') {
  throw new Error('Feature not available');
}
```

**After:**
```typescript
await permissionServiceFactory.hasFeature(tenantId, 'myFeature');
// or with decorator
@RequireFeature({ feature: 'myFeature' })
```

### From Manual Limits

**Before:**
```typescript
const count = await prisma.products.count({ where: { tenant_id: tenantId } });
const tier = await getTierLimit(tenantId, 'products');
if (count >= tier.limit) {
  throw new Error('Limit exceeded');
}
```

**After:**
```typescript
await permissionServiceFactory.requireLimit(tenantId, 'products', 1);
// or
@RequireLimit({ limitType: 'products', required: 1, consume: true })
```

---

## File Reference

| File | Purpose |
|------|---------|
| `BasePermissionService.ts` | Base class with core permission logic |
| `TenantPermissionContext.ts` | Tier-based tenant permissions |
| `AdminPermissionContext.ts` | Role-based admin permissions |
| `PublicPermissionContext.ts` | Public access with rate limiting |
| `OrganizationPermissionContext.ts` | Multi-tenant organization permissions |
| `TenantFeatureService.ts` | Feature definitions and checking |
| `TenantLimitsService.ts` | Limit definitions and tracking |
| `PermissionServiceFactory.ts` | Unified access singleton |
| `PermissionMiddleware.ts` | Express middleware functions |
| `PermissionDecorators.ts` | TypeScript method decorators |
| `PermissionEnhancedBaseService.ts` | Base service with permission methods |
| `PermissionProtectedRepository.ts` | Repository base with enforcement |
| `ControllerAuthorization.ts` | HTTP-level authorization helpers |
| `OverrideService.ts` | Feature override management API |
| `index.ts` | Barrel exports |
