# Featured Products Migration Plan: Live Implementation

## 📊 **Current State vs Target State**

### **Current State (Partially Live)**
```
✅ FeaturedProductsManager (Original) → ❌ Enhanced Singleton (Designed Only)
✅ ProductSingleton (Live)           → ✅ ProductSingleton (Live) 
✅ FeaturedProductsSingleton (Live) → ❌ Universal Consumer (Designed Only)
✅ FeaturedProductsSection (Live)  → ✅ FeaturedProductsSection (Live)
```

### **Target State (Fully Live)**
```
✅ Enhanced FeaturedProductsManager (Live)
✅ ProductSingleton (Live) 
✅ Universal FeaturedProductsConsumer (Live)
✅ FeaturedProductsSection (Updated)
```

## 🚀 **Migration Strategy**

### **Phase 1: Update Admin Side (Producer)**

#### **Step 1.1: Replace FeaturedProductsManager with Singleton Version**

**Current:** `apps/web/src/components/tenant/FeaturedProductsManager.tsx`
**Target:** Replace with singleton-based version

**Action:**
```bash
# Backup original
mv FeaturedProductsManager.tsx FeaturedProductsManager.original.tsx

# Use singleton version
mv FeaturedProductsManagerSingleton.tsx FeaturedProductsManager.tsx
```

#### **Step 1.2: Update Page Import**

**File:** `apps/web/src/app/t/[tenantId]/settings/featured-products/page.tsx`

**Current:**
```typescript
import FeaturedProductsManager from '@/components/tenant/FeaturedProductsManager';
```

**Target:** (No change needed - same import path)

#### **Step 1.3: Add Singleton Hook**

**File:** `apps/web/src/hooks/useTenantFeaturedProducts.ts`

**Action:** Already created, just needs to be used

### **Phase 2: Update Storefront Side (Consumer)**

#### **Step 2.1: Update FeaturedProductsSingleton to Use ProductProvider**

**File:** `apps/web/src/providers/data/FeaturedProductsSingleton.tsx`

**Current:** Direct API calls
**Target:** Use ProductSingleton for product data

**Implementation:**
```typescript
// Import ProductSingleton
import { useProductSingleton } from '../ProductSingleton';

// Update data fetching
const { getProductsByIds } = useProductSingleton();

// Replace API calls with ProductProvider data
const products = await getProductsByIds(productIds);
```

#### **Step 2.2: Update FeaturedProductsSection**

**File:** `apps/web/src/components/storefront/FeaturedProductsSection.tsx`

**Current:** Uses custom FeaturedProduct interface
**Target:** Uses PublicProduct (UniversalProduct) interface

**Implementation:**
```typescript
// Import universal interfaces
import { PublicProduct } from '@/providers/ProductProvider';

// Update component to use universal product data
interface FeaturedProductsSectionProps {
  tenantId: string;
  products?: PublicProduct[];
}
```

#### **Step 2.3: Create UniversalProductCard Integration**

**File:** `apps/web/src/components/products/UniversalProductCard.tsx`

**Action:** Ensure FeaturedProductsSection uses UniversalProductCard

### **Phase 3: Integration Testing**

#### **Step 3.1: Test Producer-Consumer Flow**

**Test Scenarios:**
1. Feature product in admin → Appears on storefront
2. Unfeature product in admin → Disappears from storefront
3. Update product stock → Reflects on storefront
4. Change featured type → Updates storefront display

#### **Step 3.2: Verify Data Consistency**

**Checks:**
- Product IDs match between producer and consumer
- Featured types are consistent
- Stock status updates correctly
- Cache invalidation works

## 🔧 **Implementation Details**

### **1. Admin Side Updates**

**Replace FeaturedProductsManager:**
```typescript
// In page.tsx
import FeaturedProductsManager from '@/components/tenant/FeaturedProductsManager';

function FeaturedProductsPage({ params }: { params: { tenantId: string } }) {
  return (
    <div className="container mx-auto py-8">
      <FeaturedProductsManager tenantId={params.tenantId} />
    </div>
  );
}
```

**Add Singleton Hook Usage:**
```typescript
// In FeaturedProductsManager.tsx (singleton version)
import { useTenantFeaturedProducts } from '@/hooks/useTenantFeaturedProducts';

export default function FeaturedProductsManager({ tenantId }: { tenantId: string }) {
  const featuredProducts = useTenantFeaturedProducts(tenantId);
  
  // Rest of component logic...
}
```

### **2. Storefront Side Updates**

**Update FeaturedProductsSingleton:**
```typescript
// In FeaturedProductsSingleton.tsx
import { useProductSingleton } from '../ProductSingleton';

export class FeaturedProductsSingleton extends ApiSingletonBase {
  private productSingleton: any = null;

  setProductSingleton(productSingleton: any) {
    this.productSingleton = productSingleton;
  }

  async getAllFeaturedProducts(tenantId: string, limit: number = 20) {
    // Get featured assignments
    const featuredAssignments = await this.getFeaturedAssignments(tenantId);
    
    // Get product data from ProductSingleton
    const productIds = featuredAssignments.map(f => f.productId);
    const products = await this.productSingleton.getProductsByIds(productIds);
    
    // Combine and return
    return this.combineAssignmentsWithProducts(featuredAssignments, products);
  }
}
```

**Update FeaturedProductsSection:**
```typescript
// In FeaturedProductsSection.tsx
import { PublicProduct } from '@/providers/ProductProvider';
import { UniversalProductCard } from '@/components/products/UniversalProductCard';

export default function FeaturedProductsSection({ tenantId }: FeaturedProductsSectionProps) {
  const { data: featuredData } = useFeaturedProductsData(tenantId);
  
  return (
    <div className="featured-products-section">
      {featuredData?.products.map((product: PublicProduct, index) => (
        <UniversalProductCard
          key={`${product.id}-${product.sku}-${index}`}
          product={product}
          featuredBadge={getFeaturedBadge(product.featuredType)}
        />
      ))}
    </div>
  );
}
```

### **3. Integration Layer**

**Create Provider Bridge:**
```typescript
// In FeaturedProductsManager.tsx
import { useProductSingleton } from '@/providers/ProductProvider';

export default function FeaturedProductsManager({ tenantId }: { tenantId: string }) {
  const productProvider = useProductSingleton();
  const featuredProducts = useTenantFeaturedProducts(tenantId, productProvider);
  
  // Component logic...
}
```

## 📋 **Migration Checklist**

### **Pre-Migration**
- [ ] Backup current working files
- [ ] Test current functionality
- [ ] Document current behavior
- [ ] Prepare rollback plan

### **Migration - Admin Side**
- [ ] Replace FeaturedProductsManager with singleton version
- [ ] Update imports and dependencies
- [ ] Test admin functionality
- [ ] Verify API calls work correctly

### **Migration - Storefront Side**
- [ ] Update FeaturedProductsSingleton to use ProductProvider
- [ ] Update FeaturedProductsSection interface
- [ ] Integrate UniversalProductCard
- [ ] Test storefront display

### **Post-Migration**
- [ ] Test producer-consumer flow
- [ ] Verify data consistency
- [ ] Test cache invalidation
- [ ] Monitor performance
- [ ] Update documentation

## 🚨 **Rollback Plan**

If migration fails:

### **Admin Side Rollback**
```bash
# Restore original
mv FeaturedProductsManager.tsx FeaturedProductsManager.singleton.tsx
mv FeaturedProductsManager.original.tsx FeaturedProductsManager.tsx
```

### **Storefront Side Rollback**
```bash
# Git checkout original files
git checkout HEAD -- apps/web/src/providers/data/FeaturedProductsSingleton.tsx
git checkout HEAD -- apps/web/src/components/storefront/FeaturedProductsSection.tsx
```

## ⏱️ **Estimated Timeline**

- **Phase 1 (Admin):** 2-3 hours
- **Phase 2 (Storefront):** 3-4 hours  
- **Phase 3 (Testing):** 1-2 hours
- **Total:** 6-9 hours

## 🎯 **Success Criteria**

### **Functional**
- [ ] Admin can feature/unfeature products
- [ ] Storefront shows featured products correctly
- [ ] Real-time updates work
- [ ] Stock status reflects accurately

### **Technical**
- [ ] No TypeScript errors
- [ ] No runtime errors
- [ ] Cache invalidation works
- [ ] Performance is maintained or improved

### **User Experience**
- [ ] Admin interface works smoothly
- [ ] Storefront displays correctly
- [ ] No broken functionality
- [ ] Consistent product information

## 🔄 **Current Status**

**Producer Side:** ❌ Not live (designed only)
**Consumer Side:** ❌ Not live (designed only)
**Integration:** ❌ Not implemented

**Next Action:** Start Phase 1 - Replace FeaturedProductsManager with singleton version
