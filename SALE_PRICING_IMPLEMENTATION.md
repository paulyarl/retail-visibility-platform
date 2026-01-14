# Sale Pricing Implementation - List Price / Sale Price Model

## Status: ✅ Phase 1 Complete - Ready for Testing

---

## What Was Implemented

### **1. Database Schema** ✅
**File:** `apps/api/prisma/schema.prisma`
- Added `sale_price_cents` field (optional integer)
- Constraint: Sale price must be less than list price when set

**Migration:** `apps/api/prisma/migrations/add_sale_price_cents.sql`
- ✅ Successfully applied to database
- Includes check constraint for data integrity

---

### **2. Pricing Utilities** ✅
**File:** `apps/web/src/lib/pricing.ts`

**Functions:**
- `calculatePricing()` - Calculates effective price, savings amount, and percentage
- `formatPrice()` - Formats cents to currency string
- `formatSavings()` - Formats savings display text

**Returns:**
```typescript
{
  listPrice: number;
  salePrice: number | null;
  effectivePrice: number;  // Sale price if on sale, else list price
  isOnSale: boolean;
  savingsAmount: number;
  savingsPercent: number;
}
```

---

### **3. Reusable Price Display Component** ✅
**File:** `apps/web/src/components/products/PriceDisplay.tsx`

**Features:**
- Shows strikethrough list price when on sale
- Bold red sale price
- Green savings badge with amount and percentage
- 3 size variants: large, default, compact
- Optional savings badge toggle

**Example Output:**
```
~~$99.99~~ $79.99 [Save $20 (20%)]
  gray     red      green badge
 strike   bold
```

---

### **4. Inventory Edit Form** ✅
**File:** `apps/web/src/components/items/EditItemModal.tsx`

**Changes:**
- Added "Sale Price (Optional)" field
- Renamed "Price" to "List Price (Regular Price)"
- Real-time validation: Sale price must be < list price
- Warning message if validation fails
- Saves `salePriceCents` to database

**Form Layout:**
```
List Price (Regular Price)
└─ Regular price in dollars

Sale Price (Optional)
└─ Discounted price (leave empty if not on sale)
└─ ⚠️ Sale price must be less than list price (if invalid)
```

---

## Next Steps (Pending)

### **5. Update Product Display Components**
**Files to Update:**
- `apps/web/src/components/storefront/ProductDisplay.tsx`
- `apps/web/src/components/landing-page/TierBasedLandingPage.tsx`

**Changes Needed:**
- Replace hardcoded price display with `<PriceDisplay>` component
- Pass both `priceCents` and `salePriceCents` props
- Show savings badges on product cards

---

### **6. Update AddToCartButton**
**File:** `apps/web/src/components/products/AddToCartButton.tsx`

**Changes Needed:**
- Accept `salePriceCents` prop
- Use effective price for cart calculations
- Pass effective price to cart context

---

### **7. Update Cart & Checkout**
**Files:**
- `apps/web/src/contexts/CartContext.tsx`
- `apps/web/src/app/checkout/page.tsx`

**Changes Needed:**
- Store effective price in cart items
- Show savings in cart summary
- Ensure order items use actual price paid

---

### **8. Update API Endpoints**
**Files:**
- `apps/api/src/routes/inventory-items.ts`
- `apps/api/src/index.ts` (public product endpoints)

**Changes Needed:**
- Include `sale_price_cents` in product responses
- Calculate and return `effective_price_cents`
- Return savings data for display

---

## Business Benefits

### **Conversion Optimization:**
- Shows value to customers (savings amount/percentage)
- Creates urgency (limited-time sale perception)
- Industry standard pattern (Amazon, Shopify, etc.)
- Proven to increase conversion rates by 15-30%

### **Merchant Flexibility:**
- Easy to set sale prices
- No need to change base price
- Can run temporary promotions
- Clear pricing structure

### **Customer Experience:**
- Transparent pricing
- Clear savings communication
- Trust-building (showing regular price)
- Competitive pricing visibility

---

## Usage Examples

### **Merchant Sets Sale Price:**
```
List Price: $99.99
Sale Price: $79.99
Result: Product shows as on sale with 20% savings
```

### **Customer Sees:**
```
Product Card:
~~$99.99~~ $79.99 [Save $20 (20%)]

Cart:
Item: Widget Pro
Price: $79.99 (was $99.99)
Savings: $20.00
```

---

## Testing Checklist

- [ ] Create product with list price only (no sale)
- [ ] Create product with list price and sale price
- [ ] Verify sale price validation (must be < list price)
- [ ] Check product display shows strikethrough + savings
- [ ] Verify cart uses effective price
- [ ] Test checkout with sale-priced items
- [ ] Verify order items store correct price
- [ ] Test removing sale price (product no longer on sale)

---

## Technical Notes

**Database Constraint:**
```sql
CHECK (sale_price_cents IS NULL OR sale_price_cents < price_cents)
```
This ensures data integrity at the database level.

**Effective Price Logic:**
```typescript
const effectivePrice = (salePriceCents && salePriceCents < priceCents) 
  ? salePriceCents 
  : priceCents;
```

**Savings Calculation:**
```typescript
const savingsAmount = priceCents - salePriceCents;
const savingsPercent = Math.round((savingsAmount / priceCents) * 100);
```

---

## Files Created/Modified

**New Files:**
- `apps/web/src/lib/pricing.ts` (pricing utilities)
- `apps/web/src/components/products/PriceDisplay.tsx` (display component)
- `apps/api/prisma/migrations/add_sale_price_cents.sql` (migration)
- `SALE_PRICING_IMPLEMENTATION.md` (this document)

**Modified Files:**
- `apps/api/prisma/schema.prisma` (added sale_price_cents field)
- `apps/web/src/components/items/EditItemModal.tsx` (added sale price input)

---

## Phase 1 Complete! ✅

The foundation is in place:
- ✅ Database schema with sale price support
- ✅ Pricing calculation utilities
- ✅ Reusable display component
- ✅ Merchant can set sale prices in inventory

**Next:** Integrate the PriceDisplay component throughout the storefront and update cart/checkout to use effective pricing.
