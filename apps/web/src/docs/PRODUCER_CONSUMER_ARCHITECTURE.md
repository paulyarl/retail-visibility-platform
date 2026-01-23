# Producer-Consumer Architecture: Featured Products System

## 🔄 **Complete Producer-Consumer Flow**

This architecture creates a seamless data flow from the admin management system (producer) to the storefront display (consumer) using the universal product middleware.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN PRODUCER (Private)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │        EnhancedTenantFeaturedProductsSingleton                           │    │
│  │  • Manages featured assignments                                           │    │
│  │  • Integrates with ProductProvider                                        │    │
│  │  • Triggers storefront revalidation                                       │    │
│  │  • Private admin access only                                              │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                                │
│                                    ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    API Layer (Featured Products)                           │    │
│  │  • POST /api/items/:id/featured-types                                    │    │
│  │  • DELETE /api/items/:id/featured-types/:type                            │    │
│  │  • GET /api/featured-products/management                                 │    │
│  │  • GET /api/featured-products/public                                      │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        UNIVERSAL PRODUCT MIDDLEWARE                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           ProductProvider                                  │    │
│  │  • Standardized UniversalProduct interface                               │    │
│  │  • Caches product data (5min TTL)                                        │    │
│  │  • Handles data transformations                                          │    │
│  │  • Invalidates cache on featured changes                                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                                │
│                                    ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                      UniversalProduct Interface                             │    │
│  │  • id, tenantId, sku, name, description                                  │    │
│  │  • priceCents, stock, availability                                       │    │
│  │  • imageUrl, category, formattedPrice                                     │    │
│  │  • isOnSale, stockStatus                                                  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          STOREFRONT CONSUMER (Public)                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    FeaturedProductsConsumer                              │    │
│  │  • Consumes featured products via API                                  │    │
│  │  • Uses ProductProvider for product data                                │    │
│  │  • Displays UniversalProductCard components                           │    │
│  │  • Public read-only access                                               │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                                │
│                                    ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        UniversalProductCard                               │    │
│  │  • Renders standardized product UI                                       │    │
│  │  • Uses UniversalProduct interface                                      │    │
│  │  • Handles featured badges, pricing, stock status                        │    │
│  │  • Consistent across all storefront locations                           │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🏭 **Producer: Admin Management System**

### **Enhanced Singleton Features**

**1. ProductProvider Integration**
```typescript
// Sync with universal product middleware
setProductProvider(productProvider: any) {
  this.productProvider = productProvider;
  return productProvider.subscribe(() => {
    this.syncWithProductProvider();
  });
}
```

**2. Dual Data Management**
```typescript
interface EnhancedFeaturedProductsState {
  // Featured assignments (what we manage)
  featuredAssignments: Record<string, FeaturedAssignment[]>;
  
  // Universal product data (from ProductProvider)
  universalProducts: Record<string, UniversalProduct>;
  
  // Combined view (assignments + product data)
  featuredProducts: Record<string, (FeaturedAssignment & UniversalProduct)[]>;
}
```

**3. Automatic Storefront Updates**
```typescript
async featureProduct(productId: string) {
  // ... feature the product
  
  // Notify ProductProvider of the change
  if (this.productProvider?.invalidateCache) {
    this.productProvider.invalidateCache(productId);
  }
  
  // Trigger storefront revalidation
  this.triggerStorefrontRevalidation();
}
```

**4. Public Data API**
```typescript
getPublicFeaturedData() {
  return {
    featuredProducts: this.getFeaturedProductsForStorefront(),
    featuredTypes: this.state.featuredTypes.map(type => ({
      id: type.id,
      name: type.name,
      products: this.getFeaturedProductsForStorefront(type.id)
    })),
    lastUpdated: Date.now()
  };
}
```

## 🛍️ **Consumer: Storefront Display**

### **Universal Product Integration**

**1. ProductProvider Consumption**
```typescript
// Use ProductProvider to get complete product data
const { data: products, isLoading } = useProductsData(featuredProductIds);

// Filter active and in-stock products
const displayProducts = useMemo(() => {
  if (!products) return [];
  return products.filter(product => 
    product.stockStatus !== 'out_of_stock' && 
    product.availability !== 'discontinued'
  );
}, [products]);
```

**2. Standardized Product Cards**
```typescript
<UniversalProductCard
  product={product}
  featuredBadge={{
    type: typeId,
    text: config.name,
    icon: config.icon,
    gradient: config.gradient
  }}
  priority="high"
/>
```

**3. Type-Safe Data Flow**
```typescript
interface UniversalProduct {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'discontinued';
  imageUrl?: string;
  formattedPrice?: string;
  isOnSale?: boolean;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
}
```

## 🔄 **Data Synchronization**

### **Real-time Updates**

**1. Cache Invalidation**
```typescript
// Producer invalidates ProductProvider cache
if (this.productProvider?.invalidateCache) {
  this.productProvider.invalidateCache(productId);
}
```

**2. Storefront Revalidation**
```typescript
// Trigger Next.js revalidation
await fetch('/api/revalidate', {
  method: 'POST',
  body: JSON.stringify({
    paths: [
      `/t/${tenantId}`,
      `/directory/t/${tenantId}`,
      `/api/featured-products/public?tenantId=${tenantId}`
    ]
  })
});
```

**3. Subscription Updates**
```typescript
// ProductProvider notifies consumers of changes
productProvider.subscribe(() => {
  this.syncWithProductProvider();
});
```

## 🎯 **Benefits of Producer-Consumer Architecture**

### **✅ Separation of Concerns**
- **Producer**: Manages business logic, permissions, and data mutations
- **Consumer**: Handles presentation, UI, and read-only display
- **Middleware**: Standardizes data format and caching

### **✅ Data Consistency**
- Single source of truth for product data
- Automatic synchronization between admin and storefront
- Consistent product information across all touchpoints

### **✅ Performance Optimization**
- Shared ProductProvider cache (5-minute TTL)
- Selective cache invalidation
- Optimized API calls with batching

### **✅ Type Safety**
- UniversalProduct interface ensures consistency
- End-to-end TypeScript coverage
- Compile-time error detection

### **✅ Scalability**
- Easy to add new consumer components
- Producer can serve multiple storefronts
- Middleware handles scaling automatically

## 📊 **Data Flow Examples**

### **Featuring a Product**

```
1. Admin clicks "Feature Product" in FeaturedProductsManager
   ↓
2. Enhanced singleton calls API to create featured assignment
   ↓
3. Singleton invalidates ProductProvider cache for that product
   ↓
4. Singleton triggers storefront revalidation
   ↓
5. Storefront components receive updated data via ProductProvider
   ↓
6. UniversalProductCard displays new featured badge
```

### **Unfeaturing a Product**

```
1. Admin clicks "Remove from Featured" 
   ↓
2. Enhanced singleton calls API to delete featured assignment
   ↓
3. ProductProvider cache is invalidated
   ↓
4. Storefront revalidation removes product from featured sections
   ↓
5. UniversalProductCard no longer shows featured badge
```

### **Stock Level Changes**

```
1. Product stock updated via inventory management
   ↓
2. ProductProvider cache automatically updates (5min TTL or manual)
   ↓
3. FeaturedProductsConsumer receives updated stock status
   ↓
4. UniversalProductCard shows correct stock badge
   ↓
5. Out-of-stock products automatically filtered from featured displays
```

## 🔧 **Implementation Guide**

### **Step 1: Set Up Producer**
```typescript
// In admin component
const featuredProducts = useEnhancedTenantFeaturedProducts(tenantId, productProvider);
```

### **Step 2: Configure Consumer**
```typescript
// In storefront component
const { data: products } = useProductsData(featuredProductIds);
```

### **Step 3: Connect Middleware**
```typescript
// ProductProvider automatically handles data synchronization
<ProductProvider tenantId={tenantId}>
  <FeaturedProductsConsumer tenantId={tenantId} />
</ProductProvider>
```

### **Step 4: Handle Updates**
```typescript
// Automatic - no manual intervention needed
// Producer changes → Middleware updates → Consumer reflects
```

## 🚀 **Future Enhancements**

### **1. Real-time WebSocket Updates**
```typescript
// Producer pushes updates to consumers in real-time
singleton.subscribeToRealTimeUpdates((update) => {
  // Instant storefront updates
});
```

### **2. Multi-tenant Synchronization**
```typescript
// Share featured products across organization tenants
const orgFeatured = singleton.getOrganizationFeaturedProducts();
```

### **3. Analytics Integration**
```typescript
// Track featuring performance
singleton.trackFeaturedProductMetrics(productId, {
  views: 1250,
  clicks: 89,
  conversions: 12
});
```

### **4. A/B Testing**
```typescript
// Test different featured product arrangements
singleton.runFeaturedProductsTest({
  variants: ['grid', 'carousel', 'list'],
  metrics: ['engagement', 'conversion', 'revenue']
});
```

## 📋 **Migration Checklist**

### **Producer Migration**
- [ ] Integrate ProductProvider into singleton
- [ ] Add cache invalidation on changes
- [ ] Implement storefront revalidation
- [ ] Create public data API endpoint
- [ ] Add error handling and retry logic

### **Consumer Migration**
- [ ] Update components to use ProductProvider
- [ ] Replace direct API calls with middleware
- [ ] Implement UniversalProductCard usage
- [ ] Add loading and error states
- [ ] Test data synchronization

### **Middleware Setup**
- [ ] Ensure ProductProvider handles featured products
- [ ] Configure cache TTL and invalidation
- [ ] Add subscription system for updates
- [ ] Implement data transformation logic
- [ ] Add monitoring and analytics

## 🎯 **Conclusion**

The producer-consumer architecture with universal product middleware creates:

1. **Perfect Separation**: Admin management (producer) ↔ Storefront display (consumer)
2. **Data Consistency**: Single source of truth with automatic synchronization
3. **Performance**: Optimized caching and selective updates
4. **Scalability**: Easy to extend and maintain
5. **Type Safety**: End-to-end TypeScript coverage

This pattern can be applied to other systems like:
- Inventory management ↔ Product catalog
- User management ↔ Profile display
- Order management ↔ Order history
- Content management ↔ Public pages

The FeaturedProductsManager serves as the perfect reference implementation for this powerful architectural pattern! 🎯
