# Multi-Gateway Multi-Cart Integration Status

**Date:** January 13, 2026  
**Status:** ✅ Phase 1 Complete - Phase 2 In Progress

---

## ✅ Completed

### **1. Database Schema**
- ✅ Added `payment_gateway_type` to `inventory_items`
- ✅ Added `payment_gateway_id` to `inventory_items`
- ✅ Created foreign key constraint with SET NULL
- ✅ Removed unique constraint from `tenant_payment_gateways`
- ✅ Prisma schema synced and client regenerated

### **2. Core Infrastructure**
- ✅ `cartManager.ts` - Cart routing and storage logic
- ✅ `useMultiCart.ts` - React hook for cart management
- ✅ `MultiCartCheckout.tsx` - Multi-cart checkout UI component
- ✅ `PaymentGatewaySelector.tsx` - Gateway selection component

### **3. Product Forms**
- ✅ Integrated `PaymentGatewaySelector` into `EditItemModal.tsx`
- ✅ Added gateway state management
- ✅ Gateway fields included in save operation
- ✅ Gateway selection persists with product data

---

## 🔄 In Progress

### **Checkout Page Integration**

**Current State:**
- Uses old `CartContext` system
- Single cart per tenant
- No gateway-based routing

**Required Changes:**
1. Replace `useCart()` with `useMultiCart()`
2. Add `MultiCartCheckout` component
3. Handle gateway-specific checkout flow
4. Update payment method selection based on cart gateway type

**Files to Modify:**
- `apps/web/src/app/checkout/page.tsx`

---

## 📋 Remaining Tasks

### **1. Add-to-Cart Integration**
**Status:** Pending  
**Files to Update:**
- Product detail pages
- Storefront product cards
- Quick-add buttons

**Changes Needed:**
```typescript
// Old approach
const { addToCart } = useCart();
addToCart(product);

// New approach
const { addToCart } = useMultiCart(tenantId);

// Determine gateway type
const gatewayType = product.payment_gateway_type || 
                    (await getDefaultGatewayType(tenantId));

// Add to appropriate cart
await addToCart(tenantId, tenantName, gatewayType, {
  product_id: product.id,
  product_name: product.name,
  quantity: 1,
  price_cents: product.price_cents,
  gateway_id: product.payment_gateway_id
});
```

### **2. Cart Badge/Dropdown**
**Status:** Pending  
**Files to Update:**
- Header/navigation components
- Cart icon/badge

**Changes Needed:**
```typescript
// Show total items across all carts
const { totalItems, carts } = useMultiCart(tenantId);

// Display dropdown with all carts
{carts.map(({ cart, item_count, total_cents }) => (
  <CartPreview 
    gatewayType={cart.gateway_type}
    items={cart.items}
    total={total_cents}
  />
))}
```

### **3. Backend API Updates**
**Status:** Pending  
**Files to Update:**
- `apps/api/src/routes/items.ts` (product CRUD)
- `apps/api/src/routes/checkout/*.ts` (checkout endpoints)

**Changes Needed:**
- Accept `payment_gateway_type` and `payment_gateway_id` in product create/update
- Validate gateway assignment (type matches gateway's actual type)
- Include gateway fields in product responses

---

## 🧪 Testing Plan

### **Phase 1: Product Configuration** ✅
- [x] Database migration successful
- [x] Gateway selector appears in product form
- [x] Gateway selection saves with product
- [ ] Gateway selection displays when editing product

### **Phase 2: Cart Routing** (Next)
- [ ] Add Square product → Goes to Square cart
- [ ] Add PayPal product → Goes to PayPal cart
- [ ] Add default product → Goes to default gateway cart
- [ ] Multiple products of same type → Same cart
- [ ] Products of different types → Different carts

### **Phase 3: Checkout** (After Phase 2)
- [ ] Checkout page displays all carts
- [ ] Each cart shows correct gateway type
- [ ] Checkout processes correct gateway
- [ ] Cart clears after successful payment
- [ ] Can checkout remaining carts

### **Phase 4: End-to-End** (Final)
- [ ] Create product with Square gateway
- [ ] Add to cart from storefront
- [ ] Verify appears in Square cart
- [ ] Checkout with Square
- [ ] Verify payment processes correctly
- [ ] Repeat for PayPal

---

## 🚧 Known Issues

### **1. CartContext vs Multi-Cart**
**Issue:** Existing code uses `CartContext` which stores single cart per tenant  
**Impact:** Need to migrate all cart operations to new multi-cart system  
**Solution:** Gradual migration, maintain backward compatibility initially

### **2. Payment Method Selection**
**Issue:** Current checkout allows manual payment method selection  
**Impact:** Should be determined by cart's gateway type  
**Solution:** Auto-select payment method based on cart gateway type

### **3. Default Gateway Resolution**
**Issue:** Products without gateway assignment need to resolve to tenant's default  
**Impact:** Add-to-cart needs to fetch default gateway  
**Solution:** Cache default gateway or include in tenant context

---

## 📝 Next Steps

### **Immediate (Today)**
1. ✅ Complete product form integration
2. 🔄 Update checkout page with multi-cart support
3. ⏳ Update add-to-cart functionality
4. ⏳ Update cart badge/dropdown

### **Short-term (This Week)**
1. Backend API updates for gateway fields
2. Storefront integration
3. End-to-end testing
4. Bug fixes and refinements

### **Medium-term (Next Week)**
1. Cart migration utility (old → new format)
2. Admin dashboard for gateway analytics
3. Documentation and training materials
4. Performance optimization

---

## 💡 Implementation Notes

### **Gateway Type Resolution**
```typescript
// Priority order:
1. Product's payment_gateway_type (if set)
2. Tenant's default gateway type
3. Fallback to 'square'

// Example:
const getGatewayType = async (product, tenantId) => {
  if (product.payment_gateway_type) {
    return product.payment_gateway_type;
  }
  
  const tenant = await getTenant(tenantId);
  const defaultGateway = tenant.default_gateway;
  
  return defaultGateway?.gateway_type || 'square';
};
```

### **Cart Key Format**
```typescript
// Format: cart_{tenantId}_{gatewayType}
'cart_tenant123_square'
'cart_tenant123_paypal'
'cart_tenant456_square'
```

### **Backward Compatibility**
```typescript
// Old cart keys: cart_{tenantId}
// New cart keys: cart_{tenantId}_{gatewayType}

// Migration runs on first load:
migrateOldCarts() // Converts old format to new
```

---

## 📊 Progress Tracking

**Overall Progress:** 60% Complete

- ✅ Database & Schema: 100%
- ✅ Core Infrastructure: 100%
- ✅ Product Forms: 100%
- 🔄 Checkout Page: 50%
- ⏳ Add-to-Cart: 0%
- ⏳ Cart Badge: 0%
- ⏳ Backend API: 0%
- ⏳ Testing: 20%

---

## 🎯 Success Criteria

### **Must Have**
- ✅ Products can be assigned to specific gateways
- 🔄 Carts automatically route based on gateway type
- ⏳ Checkout processes correct gateway per cart
- ⏳ No mixed-gateway errors

### **Should Have**
- ⏳ Cart badge shows total across all carts
- ⏳ Cart dropdown shows all carts separately
- ⏳ Smooth migration from old cart system
- ⏳ Clear user feedback on gateway routing

### **Nice to Have**
- ⏳ Gateway analytics dashboard
- ⏳ Bulk gateway assignment
- ⏳ Gateway-based product filtering
- ⏳ Revenue reports per gateway

---

**Last Updated:** January 13, 2026, 4:50 PM EST
