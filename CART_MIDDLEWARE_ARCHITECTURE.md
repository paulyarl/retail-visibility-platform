# Cart Middleware Architecture

## Current Implementation Status

### ✅ Completed: Middleware-Level Cart Widget

**Location:** Root layout (`apps/web/src/app/layout.tsx`)

```typescript
<CartProvider>
  <GlobalAlertProvider>
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
    <FloatingCartWidget /> // ← Middleware-level, globally available
  </GlobalAlertProvider>
</CartProvider>
```

**Features:**
- Fixed position (bottom-right corner)
- Available on **every page** of the platform
- Three states: Expanded, Minimized, Hidden
- Action bar controls (Minimize, Hide)
- Auto-expand on first item
- Shows all carts across all tenants
- Multi-cart support with badges

---

## Architecture Benefits

### 1. **True Middleware Pattern**
- Widget lives at root layout level
- Not tied to any specific page or route
- Persists across navigation
- Single source of truth for cart state

### 2. **Platform-Level Shopping**
- Users can shop from **any page**:
  - ✅ Product pages (already implemented)
  - 🔄 Directory listings (needs Add to Cart buttons)
  - 🔄 Storefront pages (needs Add to Cart buttons)
  - 🔄 Category pages (needs Add to Cart buttons)
  - 🔄 Search results (needs Add to Cart buttons)

### 3. **Consistent Behavior**
- Same cart widget everywhere
- Same "Add to Cart" button component
- Same success feedback
- Same multi-tenant support

---

## What's Needed: Add to Cart on Directory/Storefront

### Current Gap
- **Product pages:** ✅ Have `AddToCartButton`
- **Directory listings:** ❌ No cart functionality
- **Storefront pages:** ❌ No cart functionality
- **Category pages:** ❌ No cart functionality

### Solution: Add Cart Buttons to Listings

#### 1. Directory Listing Cards
**File:** `apps/web/src/components/directory/DirectoryListingCard.tsx` (or similar)

**Add:**
```typescript
import { AddToCartButton } from '@/components/products/AddToCartButton';

// In product card:
{tenant.hasActivePaymentGateway && product.price && (
  <AddToCartButton
    product={{
      id: product.id,
      name: product.name,
      sku: product.sku,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      stock: product.stock,
      tenantId: product.tenantId,
    }}
    tenantName={tenant.name}
    tenantLogo={tenant.logo}
    className="w-full"
  />
)}
```

#### 2. Storefront Product Grids
**Files:** 
- `apps/web/src/app/tenant/[id]/page.tsx`
- Storefront components

**Add:** Same `AddToCartButton` pattern

#### 3. Category Pages
**Files:**
- `apps/web/src/app/directory/categories/[categorySlug]/CategoryViewClient.tsx`

**Add:** Same `AddToCartButton` pattern

---

## Data Requirements

### Backend API Must Return:
For each product/item in listings:
```typescript
{
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  imageUrl?: string;
  stock?: number;
  tenantId: string;
  hasActivePaymentGateway?: boolean; // For conditional rendering
}
```

For tenant info:
```typescript
{
  id: string;
  name: string;
  logo?: string;
  hasActivePaymentGateway: boolean;
}
```

---

## User Flow Example

### Shopping from Directory:

1. **User browses directory** → `/directory`
2. **Sees product cards** with prices and "Add to Cart" buttons
3. **Clicks "Add to Cart"** on Product A from Store 1
   - Success banner appears
   - Floating cart widget badge shows "1"
4. **Continues browsing** → Navigates to category page
5. **Clicks "Add to Cart"** on Product B from Store 2
   - Success banner appears
   - Floating cart widget badge shows "2" items, "2" carts
6. **Clicks floating cart button** → Panel expands
   - Shows both carts (Store 1, Store 2)
   - Click any cart to view/checkout
7. **Continues shopping** → Product page, storefront, etc.
   - Cart widget follows everywhere
   - Can add from any page

---

## Implementation Priority

### Phase 1: Directory Listings (High Priority)
- [ ] Add `hasActivePaymentGateway` to directory API responses
- [ ] Add `AddToCartButton` to directory listing cards
- [ ] Test cart functionality from directory

### Phase 2: Storefront Pages (High Priority)
- [ ] Add `hasActivePaymentGateway` to storefront API responses
- [ ] Add `AddToCartButton` to storefront product grids
- [ ] Test cart functionality from storefront

### Phase 3: Category Pages (Medium Priority)
- [ ] Add `AddToCartButton` to category view products
- [ ] Test cart functionality from categories

### Phase 4: Search Results (Medium Priority)
- [ ] Add `AddToCartButton` to search result cards
- [ ] Test cart functionality from search

---

## Key Components

### 1. FloatingCartWidget (Middleware)
**Location:** `apps/web/src/components/cart/FloatingCartWidget.tsx`
- Fixed position, globally available
- Three states with action bar controls
- Multi-tenant cart support

### 2. AddToCartButton (Reusable)
**Location:** `apps/web/src/components/products/AddToCartButton.tsx`
- Reusable across all pages
- Success feedback with cart summary
- Buy Now quick action

### 3. CartContext (State Management)
**Location:** `apps/web/src/contexts/CartContext.tsx`
- Multi-tenant cart state
- localStorage persistence
- Cart operations (add, remove, update)

---

## Benefits of This Architecture

✅ **Unified Shopping Experience**
- Shop from anywhere on the platform
- Consistent cart behavior everywhere

✅ **Multi-Tenant Native**
- Separate carts per store
- Easy to manage multiple purchases

✅ **Middleware Pattern**
- Cart widget always accessible
- No page-specific implementations

✅ **Scalable**
- Add cart to new pages easily
- Just use `AddToCartButton` component

✅ **User-Friendly**
- Floating widget doesn't block content
- Action bar controls for customization
- Visual feedback on all actions

---

## Next Steps

1. **Identify all product listing pages** (directory, storefront, categories, search)
2. **Add `hasActivePaymentGateway` to API responses** for those pages
3. **Add `AddToCartButton` component** to product cards on those pages
4. **Test end-to-end shopping flow** from each page type
5. **Verify floating cart widget** updates correctly from all pages

---

## Technical Notes

### Why Middleware-Level?
- **Global availability:** Cart accessible from any page
- **State persistence:** Cart state maintained across navigation
- **Consistent UX:** Same widget behavior everywhere
- **Platform thinking:** Shopping is a platform feature, not page-specific

### Why Not Page-Level?
- ❌ Would need to implement cart on every page
- ❌ Inconsistent behavior across pages
- ❌ State management complexity
- ❌ Not scalable

### Current Architecture = Best Practice ✅
- Middleware-level widget (done)
- Reusable cart button component (done)
- Just need to add buttons to listing pages (next step)
