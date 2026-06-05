# Universal Identifier Pattern

## 🎯 **Concept**

Create a middleware pattern that allows any route to handle multiple identifier types:
- **tenant-id**: `tid-m8ijkrnk`
- **slug**: `baraka-international-market-inc`  
- **auto-id**: `ULCW`

## 📊 **Pattern Implementation**

### 1. Middleware: `identifierResolver.ts`

```typescript
export async function resolveIdentifier(req, res, next) {
  const { identifier } = req.params;
  
  // Try tenant_id first
  let tenant = await prisma.tenants.findFirst({
    where: { id: identifier }
  });
  
  if (tenant) {
    req.resolvedIdentifier = {
      identifier,
      type: 'tenant_id',
      tenant
    };
    return next();
  }
  
  // Try slug
  tenant = await prisma.tenants.findFirst({
    where: { slug: identifier }
  });
  
  if (tenant) {
    req.resolvedIdentifier = {
      identifier,
      type: 'slug', 
      tenant
    };
    return next();
  }
  
  // Try auto_id from metadata
  tenant = await prisma.tenants.findFirst({
    where: {
      metadata: {
        path: ['autoId'],
        equals: identifier
      }
    }
  });
  
  if (tenant) {
    req.resolvedIdentifier = {
      identifier,
      type: 'auto_id',
      tenant
    };
    return next();
  }
  
  // Not found
  return res.status(404).json({
    success: false,
    error: 'Not found',
    message: `No tenant found for identifier: ${identifier}`
  });
}
```

### 2. Route Helper: `createIdentifierRoute.ts`

```typescript
export function createIdentifierRoute(options) {
  const { path, handler, methods = ['get'] } = options;
  const router = Router();
  
  // Apply middleware
  router.use(resolveIdentifier);
  
  // Create routes
  methods.forEach(method => {
    router[method]('/:identifier', async (req, res) => {
      await handler(req, res);
    });
  });
  
  return router;
}
```

### 3. Usage Examples

#### **Shops Route**
```typescript
const shopsRoute = createIdentifierRoute({
  path: '/shops',
  methods: ['get'],
  handler: async (req, res) => {
    const { resolvedIdentifier } = req;
    const { tenant, type } = resolvedIdentifier;
    
    // Use ShopService based on identifier type
    const shopService = ShopService.getInstance();
    let shop;
    
    switch (type) {
      case 'slug':
        shop = await shopService.getShopBySlug(resolvedIdentifier.identifier);
        break;
      case 'tenant_id':
        shop = await shopService.getShopByTenantId(resolvedIdentifier.identifier);
        break;
      case 'auto_id':
        shop = await shopService.getShopByTenantId(tenant.id);
        break;
    }
    
    res.json({ success: true, shop, identifierType: type });
  }
});
```

#### **Tenant Route**
```typescript
const tenantRoute = createIdentifierRoute({
  path: '/tenant',
  methods: ['get'],
  handler: async (req, res) => {
    const { resolvedIdentifier } = req;
    const { tenant, type } = resolvedIdentifier;
    
    res.json({
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        identifierType: type
      }
    });
  }
});
```

#### **Stores Route**
```typescript
const storesRoute = createIdentifierRoute({
  path: '/stores',
  methods: ['get'],
  handler: async (req, res) => {
    const { resolvedIdentifier } = req;
    const { tenant, type } = resolvedIdentifier;
    
    // Return store-specific data
    res.json({
      success: true,
      store: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        identifierType: type
      }
    });
  }
});
```

#### **Storefront Route**
```typescript
const storefrontRoute = createIdentifierRoute({
  path: '/storefront',
  methods: ['get'],
  handler: async (req, res) => {
    const { resolvedIdentifier } = req;
    const { tenant, type } = resolvedIdentifier;
    
    // Return storefront-specific data
    res.json({
      success: true,
      storefront: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        identifierType: type
      }
    });
  }
});
```

## 🚀 **Mounting Routes**

```typescript
// In public-api.ts
router.use('/shops', shopsRoute);
router.use('/tenant', tenantRoute);
router.use('/stores', storesRoute);
router.use('/storefront', storefrontRoute);
```

## 📋 **Supported URL Patterns**

All these URLs now work:

### **Tenant ID Examples**
- `GET /api/public/shops/tid-m8ijkrnk`
- `GET /api/public/tenant/tid-m8ijkrnk`
- `GET /api/public/stores/tid-m8ijkrnk`
- `GET /api/public/storefront/tid-m8ijkrnk`

### **Slug Examples**
- `GET /api/public/shops/baraka-international-market-inc`
- `GET /api/public/tenant/baraka-international-market-inc`
- `GET /api/public/stores/baraka-international-market-inc`
- `GET /api/public/storefront/baraka-international-market-inc`

### **Auto ID Examples**
- `GET /api/public/shops/ULCW`
- `GET /api/public/tenant/ULCW`
- `GET /api/public/stores/ULCW`
- `GET /api/public/storefront/ULCW`

## 🎯 **Benefits**

✅ **Universal Pattern** - Same resolution logic across all routes  
✅ **Type Safety** - TypeScript interfaces for resolved data  
✅ **Flexible** - Easy to add new identifier types  
✅ **Consistent** - Same response format across all routes  
✅ **Maintainable** - Logic in one place, reused everywhere  
✅ **Extensible** - Easy to add new routes with same pattern  

## 🔧 **Implementation Steps**

1. **Create middleware** (`identifierResolver.ts`)
2. **Create helper** (`createIdentifierRoute.ts`)
3. **Create route factories** for each route type
4. **Mount routes** in public API
5. **Test all identifier types** work consistently

This pattern provides a clean, reusable way to handle identifier resolution across the entire platform! 🚀
