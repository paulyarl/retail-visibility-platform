# Tenant Service Migration Plan

## 🎯 **Objective**

Eliminate direct database access in routes and create a unified service layer for tenant operations with universal identifier support.

## 😬 **Current Problems**

### **Anti-Patterns Found**
```typescript
// ❌ Direct Prisma in routes
router.get('/tenants/:id', async (req, res) => {
  const tenant = await prisma.tenants.findUnique({ where: { id } });
});

// ❌ Business logic in routes
router.get('/tenants/:id/complete', async (req, res) => {
  const [tenant, itemCount, activeItemCount, stats] = await Promise.all([
    prisma.tenants.findUnique({ where: { id } }),
    prisma.inventory_items.count({ where: { tenant_id: id } }),
    // ... more direct DB calls
  ]);
});

// ❌ Inconsistent identifier handling
router.get('/tenants/:tenantId/users', async (req, res) => {
  const { tenantId } = req.params; // Different param name!
});
```

## 🚀 **Target Architecture**

### **Service Layer Structure**
```typescript
// services/TenantService.ts
class TenantService {
  async getTenantByIdentifier(identifier: string): Promise<Tenant | null>
  async getTenantComplete(tenantId: string): Promise<CompleteTenantData | null>
  async getTenantUsers(tenantId: string): Promise<UserList>
  async getTenantOrders(tenantId: string): Promise<OrderList>
  async updateTenantProfile(tenantId: string, data: any): Promise<Tenant>
  // ... all tenant operations
}

// middleware/tenantResolver.ts
export async function resolveTenantIdentifier(req, res, next) {
  const { identifier } = req.params;
  const tenantService = TenantService.getInstance();
  const tenant = await tenantService.getTenantByIdentifier(identifier);
  
  if (!tenant) {
    return res.status(404).json({
      success: false,
      error: 'Tenant not found',
      message: `No tenant found for identifier: ${identifier}`
    });
  }
  
  req.resolvedTenant = tenant;
  req.identifierType = getIdentifierType(identifier, tenant);
  next();
}
```

### **Clean Route Structure**
```typescript
// ✅ PROPER: Clean, service-based routes
router.get('/tenants/:identifier', 
  authenticateToken, 
  resolveTenantIdentifier, 
  async (req, res) => {
    const tenantService = TenantService.getInstance();
    const result = await tenantService.getTenantProfile(req.resolvedTenant.id);
    res.json({ success: true, data: result });
  }
);
```

## 📊 **Migration Phases**

### **Phase 1: Foundation (Week 1)**
**Goal: Create service layer and middleware**

#### **1.1 Create TenantService**
```typescript
// services/TenantService.ts
export class TenantService {
  private static instance: TenantService;
  
  // Core resolution methods
  async getTenantByIdentifier(identifier: string): Promise<Tenant | null>
  async getTenantById(tenantId: string): Promise<Tenant | null>
  async getTenantBySlug(slug: string): Promise<Tenant | null>
  async getTenantByAutoId(autoId: string): Promise<Tenant | null>
  
  // Business logic methods
  async getTenantProfile(tenantId: string): Promise<TenantProfile>
  async getTenantComplete(tenantId: string): Promise<CompleteTenantData>
  async getTenantUsers(tenantId: string): Promise<UserList>
  async getTenantOrders(tenantId: string): Promise<OrderList>
  async getTenantStats(tenantId: string): Promise<TenantStats>
  
  // Update methods
  async updateTenantProfile(tenantId: string, data: any): Promise<Tenant>
  async updateTenantSubdomain(tenantId: string, subdomain: string): Promise<Tenant>
  async uploadTenantLogo(tenantId: string, logoUrl: string): Promise<Tenant>
}
```

#### **1.2 Create Universal Resolver Middleware**
```typescript
// middleware/universalTenantResolver.ts
export async function resolveUniversalTenantIdentifier(req, res, next) {
  const { identifier } = req.params;
  
  try {
    const tenantService = TenantService.getInstance();
    const tenant = await tenantService.getTenantByIdentifier(identifier);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }
    
    req.resolvedTenant = tenant;
    req.identifierType = determineIdentifierType(identifier, tenant);
    next();
  } catch (error) {
    console.error('[Tenant Resolver] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Resolution failed',
      message: 'Failed to resolve tenant identifier'
    });
  }
}
```

#### **1.3 Create Route Helper**
```typescript
// middleware/createTenantRoute.ts
export function createTenantRoute(options: {
  path: string;
  handler: (req: any, res: any) => Promise<void>;
  methods?: ('get' | 'post' | 'put' | 'delete')[];
  middleware?: any[];
}) {
  // Apply universal resolver + custom middleware + handler
}
```

### **Phase 2: Core Routes (Week 2)**
**Goal: Migrate high-traffic tenant routes**

#### **2.1 Tenant Profile Routes**
```typescript
// Before
router.get('/:id', authenticateToken, checkTenantAccess, async (req, res) => {
  const { id } = req.params;
  const tenant = await prisma.tenants.findUnique({ where: { id } });
  // ... business logic
});

// After
router.get('/:identifier', authenticateToken, resolveUniversalTenantIdentifier, async (req, res) => {
  const tenantService = TenantService.getInstance();
  const profile = await tenantService.getTenantProfile(req.resolvedTenant.id);
  res.json({ success: true, data: profile });
});
```

#### **2.2 Complete Tenant Data Route**
```typescript
// Before: 15+ lines of direct DB calls
router.get('/:id/complete', authenticateToken, checkTenantAccess, async (req, res) => {
  const [tenant, itemCount, activeItemCount, stats] = await Promise.all([
    prisma.tenants.findUnique({ where: { id } }),
    prisma.inventory_items.count({ where: { tenant_id: id } }),
    // ... 13 more direct DB calls
  ]);
});

// After: Single service call
router.get('/:identifier/complete', authenticateToken, resolveUniversalTenantIdentifier, async (req, res) => {
  const tenantService = TenantService.getInstance();
  const complete = await tenantService.getTenantComplete(req.resolvedTenant.id);
  res.json({ success: true, data: complete });
});
```

#### **2.3 Tenant Management Routes**
- `/tenants/:identifier/subdomain`
- `/tenants/:identifier/logo`
- `/tenants/:identifier/users`

### **Phase 3: Extended Routes (Week 3)**
**Goal: Migrate tenant-specific routes**

#### **3.1 Tenant Users Routes**
```typescript
// Before
router.get('/:tenantId/users', checkTenantAccess, async (req, res) => {
  const { tenantId } = req.params;
  const userTenants = await prisma.user_tenants.findMany({
    where: { tenant_id: tenantId },
    // ... more direct DB calls
  });
});

// After
router.get('/:identifier/users', resolveUniversalTenantIdentifier, async (req, res) => {
  const tenantService = TenantService.getInstance();
  const users = await tenantService.getTenantUsers(req.resolvedTenant.id);
  res.json({ success: true, data: users });
});
```

#### **3.2 Tenant Orders Routes**
- `/tenants/:identifier/orders`
- `/tenants/:identifier/orders/:orderId`

#### **3.3 Tenant Content Routes**
- `/tenants/:identifier/featured`
- `/tenants/:identifier/categories`
- `/tenants/:identifier/stats`

### **Phase 4: Public Routes (Week 4)**
**Goal: Align public routes with universal pattern**

#### **4.1 Public Shop Routes**
```typescript
// Before: Fallback logic in route
router.get('/shops/:identifier', async (req, res) => {
  let shop = await shopService.getShopBySlug(identifier);
  if (!shop) shop = await shopService.getShopByTenantId(identifier);
});

// After: Clean middleware approach
router.get('/shops/:identifier', resolveUniversalTenantIdentifier, async (req, res) => {
  const shopService = ShopService.getInstance();
  const shop = await shopService.getShopByTenantId(req.resolvedTenant.id);
  res.json({ success: true, shop });
});
```

#### **4.2 Public Store Routes**
- `/public/stores/:identifier` (merge slug and id routes)

### **Phase 5: Cleanup & Testing (Week 5)**
**Goal: Remove old routes and ensure consistency**

#### **5.1 Remove Deprecated Routes**
- Remove all `:id` and `:tenantId` routes
- Remove redundant `/public/stores/id/:tenantId`
- Update documentation

#### **5.2 Comprehensive Testing**
- Unit tests for TenantService
- Integration tests for middleware
- E2E tests for all routes
- Performance testing

## 🔧 **Migration Safety**

### **Zero Downtime Strategy**
1. **Parallel Implementation** - New routes alongside old ones
2. **Feature Flags** - Toggle between old/new implementations
3. **Gradual Rollout** - Test with subset of traffic
4. **Monitoring** - Track errors and performance
5. **Rollback Plan** - Quick revert if issues arise

### **Testing Strategy**
```typescript
// tests/migration.test.ts
describe('Tenant Service Migration', () => {
  test('Old route returns same data as new route', async () => {
    const oldResponse = await request(app).get('/api/tenants/tid-m8ijkrnk');
    const newResponse = await request(app).get('/api/tenants/tid-m8ijkrnk');
    
    expect(oldResponse.body).toEqual(newResponse.body);
  });
  
  test('Universal identifier support', async () => {
    const byId = await request(app).get('/api/tenants/tid-m8ijkrnk');
    const bySlug = await request(app).get('/api/tenants/baraka-international-market-inc');
    const byAutoId = await request(app).get('/api/tenants/ULCW');
    
    expect(byId.body.data.id).toBe(bySlug.body.data.id);
    expect(byId.body.data.id).toBe(byAutoId.body.data.id);
  });
});
```

## 📊 **Success Metrics**

✅ **Zero direct DB calls** in routes  
✅ **Universal identifier support** across all routes  
✅ **Consistent error handling**  
✅ **Service layer abstraction**  
✅ **Improved testability**  
✅ **Better performance** (optimized queries)  
✅ **Easier maintenance**  

## 🎯 **Peace of Mind Deliverables**

1. **Clean Architecture** - No more cringe-worthy direct DB calls
2. **Universal Pattern** - Same identifier resolution everywhere
3. **Service Abstraction** - Business logic properly separated
4. **Comprehensive Testing** - Confidence in the migration
5. **Documentation** - Clear patterns for future development

This migration will eliminate the architectural debt and create a maintainable, scalable system! 🚀
