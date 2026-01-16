# Self-Aware Product Display Pattern

## Philosophy

**Products should automatically know whether to display purchase functionality based on their tenant's payment gateway configuration.**

This eliminates the need for parent components to manually check payment gateway status and conditionally render purchase buttons, creating a more maintainable and consistent system.

---

## The Problem (Before)

### Scattered Logic
```typescript
// In ProductDisplay.tsx
const [hasActivePaymentGateway, setHasActivePaymentGateway] = useState(false);

useEffect(() => {
  // Check payment gateway
  fetch(`/api/tenants/${tenantId}/payment-gateway`)...
}, [tenantId]);

{hasActivePaymentGateway && <AddToCartButton />}

// In RecommendationCard.tsx
const [hasActivePaymentGateway, setHasActivePaymentGateway] = useState(false);

useEffect(() => {
  // Duplicate check
  fetch(`/api/tenants/${tenantId}/payment-gateway`)...
}, [tenantId]);

{hasActivePaymentGateway && <AddToCartButton />}

// In LastViewedProducts.tsx
const [hasActivePaymentGateway, setHasActivePaymentGateway] = useState(false);

useEffect(() => {
  // Another duplicate check
  fetch(`/api/tenants/${tenantId}/payment-gateway`)...
}, [tenantId]);

{hasActivePaymentGateway && <AddToCartButton />}
```

### Issues
- ❌ **Duplicated logic** across multiple components
- ❌ **Inconsistency risk** - Different implementations might diverge
- ❌ **Maintenance burden** - Changes require updates in multiple places
- ❌ **Missing coverage** - New display locations might forget the check
- ❌ **Performance waste** - Multiple components fetching same data

---

## The Solution (After)

### Self-Aware Component
```typescript
// SmartProductCard.tsx - Handles everything internally
export default function SmartProductCard({ product, variant }) {
  const [canPurchase, setCanPurchase] = useState(false);
  
  useEffect(() => {
    // Component checks its own purchase ability
    checkPurchaseAbility();
  }, [product.tenantId]);
  
  return (
    <div>
      {/* Product display */}
      
      {/* Automatically shows/hides purchase UI */}
      {canPurchase && (
        product.has_variants ? (
          <ProductWithVariants product={product} />
        ) : (
          <AddToCartButton product={product} />
        )
      )}
    </div>
  );
}
```

### Usage Everywhere
```typescript
// ProductDisplay.tsx
<SmartProductCard product={product} variant="grid" />

// RecommendationCard.tsx
<SmartProductCard product={product} variant="compact" />

// LastViewedProducts.tsx
<SmartProductCard product={product} variant="list" />

// DirectoryPage.tsx
<SmartProductCard product={product} variant="grid" />

// SearchResults.tsx
<SmartProductCard product={product} variant="list" />
```

### Benefits
- ✅ **Single source of truth** - Logic in one place
- ✅ **Automatic consistency** - All displays behave identically
- ✅ **Zero maintenance** - Fix once, works everywhere
- ✅ **Guaranteed coverage** - Can't forget the check
- ✅ **Better performance** - Can add caching/memoization in one place

---

## Component Architecture

### SmartProductCard

**Responsibilities:**
1. Check tenant's payment gateway configuration
2. Determine if purchase functionality should be shown
3. Render appropriate purchase UI (variants vs simple add-to-cart)
4. Handle all display variants (grid, list, compact)

**Props:**
```typescript
interface SmartProductCardProps {
  product: ProductData;           // Product to display
  tenantName?: string;             // For cart/checkout
  tenantLogo?: string;             // For cart/checkout
  variant?: 'grid' | 'list' | 'compact';  // Display mode
  showCategory?: boolean;          // Show category badge
  showDescription?: boolean;       // Show description
  className?: string;              // Additional styling
}
```

**Internal State:**
```typescript
const [canPurchase, setCanPurchase] = useState(false);
const [defaultGatewayType, setDefaultGatewayType] = useState<string>();
```

**Self-Awareness Logic:**
```typescript
useEffect(() => {
  const checkPurchaseAbility = async () => {
    const response = await fetch(`/api/tenants/${product.tenantId}/payment-gateway`);
    if (response.ok) {
      const data = await response.json();
      const hasGateway = !!(data.payment_gateway_type && data.payment_gateway_id);
      setCanPurchase(hasGateway);
      setDefaultGatewayType(data.payment_gateway_type);
    } else {
      setCanPurchase(false);
    }
  };
  
  checkPurchaseAbility();
}, [product.tenantId]);
```

---

## Display Variants

### Grid Variant
**Use Case:** Product grids, catalogs, storefronts
```typescript
<SmartProductCard product={product} variant="grid" />
```
- Square aspect ratio image
- Full product details
- Category badge
- Description (line-clamped)
- Price with savings badge
- Stock indicator
- Full-width purchase button

### List Variant
**Use Case:** Search results, filtered lists, admin views
```typescript
<SmartProductCard product={product} variant="list" />
```
- Horizontal layout
- Rectangular image (w-48 h-48)
- Full product details
- Category badge
- Full description
- Price with savings badge
- Stock indicator
- Inline purchase button

### Compact Variant
**Use Case:** Recommendations, last viewed, related products, sidebars
```typescript
<SmartProductCard product={product} variant="compact" />
```
- Minimal layout
- Small square image (w-16 h-16)
- Product name (truncated)
- Compact price display
- Simple purchase link or button
- No description or category

---

## Platform-Wide Usage

### Storefront Pages
```typescript
// Main product display
<SmartProductCard product={product} variant="grid" />

// Search results
<SmartProductCard product={product} variant="list" />

// Related products
<SmartProductCard product={product} variant="compact" />
```

### Directory Pages
```typescript
// Product directory
<SmartProductCard product={product} variant="grid" showCategory={true} />

// Category pages
<SmartProductCard product={product} variant="grid" showCategory={false} />
```

### Recommendation Systems
```typescript
// "You might also like"
<SmartProductCard product={product} variant="compact" showDescription={false} />

// "Frequently bought together"
<SmartProductCard product={product} variant="compact" />
```

### Last Viewed Products
```typescript
// Recently viewed sidebar
<SmartProductCard product={product} variant="compact" />

// Recently viewed page
<SmartProductCard product={product} variant="list" />
```

### Search Results
```typescript
// Search results list
<SmartProductCard product={product} variant="list" showCategory={true} />
```

### Admin/Dashboard Views
```typescript
// Product preview in admin
<SmartProductCard product={product} variant="list" />
```

---

## Performance Optimization

### Current Implementation
Each SmartProductCard fetches payment gateway status independently.

### Future Optimization: Context Provider
```typescript
// TenantPaymentContext.tsx
export const TenantPaymentProvider = ({ tenantId, children }) => {
  const [canPurchase, setCanPurchase] = useState(false);
  const [defaultGatewayType, setDefaultGatewayType] = useState<string>();
  
  useEffect(() => {
    // Fetch once for entire page
    checkPurchaseAbility();
  }, [tenantId]);
  
  return (
    <TenantPaymentContext.Provider value={{ canPurchase, defaultGatewayType }}>
      {children}
    </TenantPaymentContext.Provider>
  );
};

// SmartProductCard.tsx
const { canPurchase, defaultGatewayType } = useTenantPayment();
// No need to fetch - uses context value
```

### Benefits of Context Approach
- ✅ **Single API call** per page instead of per product
- ✅ **Instant rendering** - No loading state needed
- ✅ **Reduced network traffic** - Especially for pages with many products
- ✅ **Better UX** - No staggered button appearances

---

## Migration Strategy

### Phase 1: Create SmartProductCard ✅
- [x] Build component with self-aware logic
- [x] Support all three display variants
- [x] Handle variants vs simple products
- [x] Test with different tenant configurations

### Phase 2: Update Existing Components
- [ ] Replace ProductDisplay grid view
- [ ] Replace ProductDisplay list view
- [ ] Replace ProductDisplay gallery view
- [ ] Update recommendation components
- [ ] Update last viewed components
- [ ] Update directory pages
- [ ] Update search results

### Phase 3: Add Context Provider
- [ ] Create TenantPaymentContext
- [ ] Wrap storefront pages with provider
- [ ] Update SmartProductCard to use context
- [ ] Remove individual fetch calls
- [ ] Test performance improvements

### Phase 4: Cleanup
- [ ] Remove old payment gateway checks
- [ ] Remove duplicated logic
- [ ] Update documentation
- [ ] Add usage examples

---

## API Endpoint

### GET /api/tenants/:tenantId/payment-gateway

**Response:**
```json
{
  "payment_gateway_type": "stripe",
  "payment_gateway_id": "acct_1234567890"
}
```

**Usage:**
```typescript
const response = await fetch(`/api/tenants/${tenantId}/payment-gateway`);
const data = await response.json();
const hasGateway = !!(data.payment_gateway_type && data.payment_gateway_id);
```

---

## Testing Checklist

### Component Rendering
- [ ] Grid variant displays correctly
- [ ] List variant displays correctly
- [ ] Compact variant displays correctly
- [ ] All variants responsive on mobile

### Payment Gateway Detection
- [ ] Shows purchase UI when gateway configured
- [ ] Hides purchase UI when no gateway
- [ ] Handles API errors gracefully
- [ ] Loading state works correctly

### Product Variants
- [ ] Shows ProductWithVariants for variant products
- [ ] Shows AddToCartButton for simple products
- [ ] Variant selection works in all display modes
- [ ] Photo switching works correctly

### Platform-Wide Consistency
- [ ] Storefront pages use SmartProductCard
- [ ] Directory pages use SmartProductCard
- [ ] Recommendation cards use SmartProductCard
- [ ] Last viewed uses SmartProductCard
- [ ] Search results use SmartProductCard
- [ ] All displays behave identically

---

## Benefits Summary

### For Developers
- **Single source of truth** - One component to maintain
- **Automatic consistency** - Can't implement differently
- **Faster development** - Just use SmartProductCard everywhere
- **Easier testing** - Test once, works everywhere
- **Better debugging** - One place to fix issues

### For Users
- **Consistent experience** - Same behavior everywhere
- **Better performance** - Optimized fetching with context
- **Faster page loads** - Reduced API calls
- **Reliable functionality** - No missing purchase buttons

### For Business
- **Lower maintenance costs** - Less code to maintain
- **Faster feature development** - Reusable component
- **Reduced bugs** - Single implementation
- **Better conversion** - Consistent purchase experience

---

## Future Enhancements

### Smart Caching
```typescript
// Cache payment gateway status per tenant
const gatewayCache = new Map<string, { canPurchase: boolean, expires: number }>();
```

### Prefetching
```typescript
// Prefetch payment gateway status on page load
<link rel="prefetch" href={`/api/tenants/${tenantId}/payment-gateway`} />
```

### Server-Side Rendering
```typescript
// Include payment gateway status in initial page data
export async function getServerSideProps({ params }) {
  const paymentGateway = await fetchPaymentGateway(params.tenantId);
  return { props: { paymentGateway } };
}
```

### Real-Time Updates
```typescript
// Listen for payment gateway configuration changes
useEffect(() => {
  const subscription = subscribeToTenantUpdates(tenantId);
  subscription.on('payment_gateway_updated', () => {
    recheckPurchaseAbility();
  });
}, [tenantId]);
```

---

## Conclusion

The self-aware product pattern eliminates duplicated logic, ensures consistency, and makes the codebase more maintainable. By encapsulating payment gateway checks within the product display component, we create a system that "just works" everywhere products are displayed.

**Key Principle:** Products know whether they can be purchased. Parent components don't need to care.

**Result:** Consistent, maintainable, performant product displays across the entire platform.
