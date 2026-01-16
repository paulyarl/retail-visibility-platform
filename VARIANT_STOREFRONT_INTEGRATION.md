# Product Variants - Storefront Integration Plan

## Overview
The product variants system is currently implemented for admin/inventory management but needs integration into customer-facing flows (storefront, cart, orders, receipts).

## Current State
✅ **Admin Side (Complete)**
- Database: `product_variants` table with all fields
- API: 6 CRUD endpoints for variant management
- UI: ProductVariants component in EditItemModal
- SKU Generation: Auto-generate variant SKUs

❌ **Customer Side (Missing)**
- Storefront: No variant selector on product pages
- Cart: No variant tracking in cart items
- Orders: No variant information in order line items
- Receipts: No variant details displayed

## Required Updates

### 1. Cart System Updates

**File:** `apps/web/src/lib/cart/cartManager.ts`

**Current CartItem:**
```typescript
interface CartItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  price_cents: number;
  quantity: number;
  gateway_type?: string;
  gateway_id?: string;
}
```

**Updated CartItem:**
```typescript
interface CartItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  variant_id?: string;              // NEW: Variant identifier
  variant_name?: string;            // NEW: "Large - Blue"
  variant_attributes?: Record<string, string>; // NEW: {size: "Large", color: "Blue"}
  price_cents: number;
  quantity: number;
  gateway_type?: string;
  gateway_id?: string;
}
```

**Update cart matching logic:**
```typescript
// OLD: Match by product_id only
const existingIndex = cart.items.findIndex(
  i => i.product_id === item.product_id
);

// NEW: Match by product_id AND variant_id
const existingIndex = cart.items.findIndex(
  i => i.product_id === item.product_id && 
       i.variant_id === item.variant_id
);
```

### 2. Variant Selector Component

**File:** `apps/web/src/components/products/VariantSelector.tsx` (NEW)

**Features:**
- Dropdown/button group for each attribute (size, color, etc.)
- Show available combinations
- Disable out-of-stock variants
- Update price display when variant selected
- Update stock availability display

**Props:**
```typescript
interface VariantSelectorProps {
  productId: string;
  variants: ProductVariant[];
  onVariantSelect: (variant: ProductVariant | null) => void;
  selectedVariantId?: string;
}
```

**UI Pattern:**
```
Size: [Small] [Medium] [Large]
Color: [Red] [Blue] [Green]

Selected: Large - Blue
Price: $24.99
Stock: 5 available
```

### 3. Product Page Integration

**Files to Update:**
- `apps/web/src/components/storefront/ProductDisplay.tsx`
- `apps/web/src/components/directory/LastViewed.tsx`
- `apps/web/src/app/tenant/[id]/StorefrontClient.tsx`

**Changes:**
1. Fetch variants when product has `has_variants: true`
2. Show VariantSelector component
3. Update AddToCartButton to pass selected variant
4. Show variant-specific price and stock

**Example:**
```typescript
// Fetch variants
const [variants, setVariants] = useState<ProductVariant[]>([]);
const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

useEffect(() => {
  if (product.has_variants) {
    fetch(`/api/items/${product.id}/variants`)
      .then(res => res.json())
      .then(data => setVariants(data.variants));
  }
}, [product.id, product.has_variants]);

// Render
{product.has_variants && variants.length > 0 && (
  <VariantSelector
    productId={product.id}
    variants={variants}
    onVariantSelect={setSelectedVariant}
  />
)}

<AddToCartButton
  product={product}
  variant={selectedVariant}
  // ...
/>
```

### 4. AddToCartButton Updates

**File:** `apps/web/src/components/products/AddToCartButton.tsx`

**Add variant prop:**
```typescript
interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
    // ...
  };
  variant?: ProductVariant | null; // NEW
  // ...
}
```

**Update addToCart call:**
```typescript
const handleAddToCart = async () => {
  await addToCart(tenantId, tenantName, gatewayType, {
    product_id: product.id,
    product_name: product.name,
    product_sku: variant?.sku || product.sku,
    variant_id: variant?.id,              // NEW
    variant_name: variant?.variant_name,  // NEW
    variant_attributes: variant?.attributes, // NEW
    price_cents: variant?.price_cents || product.price_cents,
    quantity,
    // ...
  });
};
```

**Validation:**
```typescript
// Don't allow add to cart if product has variants but none selected
if (product.has_variants && !variant) {
  alert('Please select a variant');
  return;
}
```

### 5. Cart Display Updates

**Files to Update:**
- `apps/web/src/components/cart/CartItem.tsx` (if exists)
- `apps/web/src/app/checkout/page.tsx`

**Display variant info:**
```typescript
<div className="cart-item">
  <h3>{item.product_name}</h3>
  {item.variant_name && (
    <p className="text-sm text-gray-600">
      {item.variant_name}
    </p>
  )}
  {item.variant_attributes && (
    <div className="flex gap-2 text-xs">
      {Object.entries(item.variant_attributes).map(([key, value]) => (
        <span key={key} className="badge">
          {key}: {value}
        </span>
      ))}
    </div>
  )}
  <p className="price">${(item.price_cents / 100).toFixed(2)}</p>
</div>
```

### 6. Order System Updates

**Database:** Already prepared in migration
```sql
-- order_line_items modifications (future)
ALTER TABLE order_line_items
ADD COLUMN variant_id TEXT REFERENCES product_variants(id),
ADD COLUMN variant_name TEXT,
ADD COLUMN variant_attributes JSONB;
```

**API Updates:**
- `apps/api/src/routes/orders.ts`
- `apps/api/src/routes/checkout.ts`

**Store variant info when creating order:**
```typescript
await prisma.order_items.create({
  data: {
    order_id: orderId,
    inventory_item_id: item.product_id,
    variant_id: item.variant_id,        // NEW
    variant_name: item.variant_name,    // NEW
    variant_attributes: item.variant_attributes, // NEW
    sku: item.product_sku,
    quantity: item.quantity,
    price_cents: item.price_cents,
    // ...
  }
});
```

**Stock deduction:**
```typescript
// If variant purchase, deduct from variant stock
if (item.variant_id) {
  await prisma.product_variants.update({
    where: { id: item.variant_id },
    data: { stock: { decrement: item.quantity } }
  });
} else {
  // Regular product stock deduction
  await prisma.inventory_items.update({
    where: { id: item.product_id },
    data: { stock: { decrement: item.quantity } }
  });
}
```

### 7. Order Receipt Updates

**Files to Update:**
- `apps/web/src/components/orders/OrderReceipt.tsx`
- `apps/api/src/services/email/order-confirmation.ts`

**Display variant details:**
```typescript
<div className="order-item">
  <div className="item-name">
    {item.product_name}
    {item.variant_name && (
      <span className="variant-badge">{item.variant_name}</span>
    )}
  </div>
  <div className="item-details">
    <span>SKU: {item.sku}</span>
    {item.variant_attributes && (
      <div className="attributes">
        {Object.entries(item.variant_attributes).map(([key, value]) => (
          <span key={key}>{key}: {value}</span>
        ))}
      </div>
    )}
  </div>
  <div className="item-price">
    ${(item.price_cents / 100).toFixed(2)} × {item.quantity}
  </div>
</div>
```

**Email template:**
```html
<tr>
  <td>
    <strong>{{product_name}}</strong>
    {{#if variant_name}}
      <br><small>{{variant_name}}</small>
    {{/if}}
    {{#if variant_attributes}}
      <br>
      {{#each variant_attributes}}
        <span class="badge">{{@key}}: {{this}}</span>
      {{/each}}
    {{/if}}
  </td>
  <td>{{quantity}}</td>
  <td>${{price}}</td>
</tr>
```

## Implementation Priority

### Phase 1: Cart & Display (Critical)
1. ✅ Update CartItem interface
2. ✅ Create VariantSelector component
3. ✅ Update AddToCartButton
4. ✅ Update cart display

### Phase 2: Orders (High Priority)
5. ✅ Add variant fields to order line items
6. ✅ Update order creation to store variant info
7. ✅ Update stock deduction logic

### Phase 3: Receipts (Medium Priority)
8. ✅ Update order receipt display
9. ✅ Update email templates

## Testing Checklist

### Cart Flow
- [ ] Add product with variants to cart
- [ ] Verify variant details show in cart
- [ ] Verify different variants of same product are separate cart items
- [ ] Verify price updates based on selected variant
- [ ] Verify stock validation for variants

### Order Flow
- [ ] Complete checkout with variant products
- [ ] Verify order confirmation shows variant details
- [ ] Verify order history displays variants correctly
- [ ] Verify stock deducted from correct variant
- [ ] Verify email receipt includes variant info

### Edge Cases
- [ ] Product without variants still works
- [ ] Mix of variant and non-variant products in cart
- [ ] Out of stock variant prevents add to cart
- [ ] Variant price different from parent price
- [ ] Multiple attributes (size + color + material)

## Benefits

**Customer Experience:**
- Clear variant selection (size, color, etc.)
- Accurate pricing per variant
- Stock availability per variant
- Detailed order confirmations

**Merchant Benefits:**
- Accurate inventory tracking per variant
- Proper fulfillment information
- Better analytics (which variants sell best)
- Reduced fulfillment errors

**Technical Benefits:**
- Consistent data model across system
- Proper stock management
- Audit trail for variant sales
- Scalable for complex products

## Notes

- Variants are optional - products without variants continue to work as before
- Cart matching must consider variant_id to allow multiple variants of same product
- Stock validation must check variant stock, not parent stock
- Order fulfillment needs variant details for picking/packing
- Analytics should track variant performance separately

## Migration Path

For existing carts in localStorage:
- Old cart items (no variant_id) continue to work
- New cart items include variant information
- No breaking changes for existing functionality
