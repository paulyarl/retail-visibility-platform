# Clover POS Sale Price Sync

## ✅ Status: Implemented - Sale Pricing Syncs from Clover

---

## Overview

The Clover POS integration now syncs sale pricing from Clover to the platform, enabling merchants to manage promotional pricing in their POS system and have it automatically reflect on their storefront and Google Shopping listings.

---

## How It Works

### **Clover Pricing Model**

Clover supports multiple pricing structures:
- **Regular Price** - Standard item price
- **Alternate Prices** - Promotional/sale prices
- **Price Type** - Fixed or variable pricing

### **RVP Mapping**

When syncing from Clover:
- Clover `price` → RVP `price_cents` (list price)
- Clover `alternatePrices[0].price` → RVP `sale_price_cents` (sale price)
- Variable price items skip sale price (null)

---

## Implementation Details

### **Clover API Integration**

**File:** `apps/api/src/routes/integrations/clover.ts`

```typescript
// Fetch items from Clover with pricing
const items = (itemsData.elements || []).map((item: any) => ({
  id: item.id,
  name: item.name,
  sku: item.sku || item.code,
  price: item.price || 0,
  salePrice: item.priceType === 'VARIABLE' 
    ? null 
    : (item.alternatePrices?.[0]?.price || null),
  stockCount: item.stockCount || 0,
  categoryId: item.categories?.elements?.[0]?.id || null
}));
```

### **Sync Operations**

**1. Create New Items:**
```typescript
await prisma.inventory_items.create({
  data: {
    price_cents: cloverItem.price,
    sale_price_cents: cloverItem.salePrice || null,
    // ... other fields
  }
});
```

**2. Update Existing Items:**
```typescript
await prisma.inventory_items.update({
  where: { id: itemMapping.rvp_item_id },
  data: {
    price_cents: cloverItem.price,
    sale_price_cents: cloverItem.salePrice || null,
    stock: cloverItem.stockCount,
    // ... other fields
  }
});
```

---

## Merchant Workflow

### **1. Set Sale Price in Clover**
```
Clover Dashboard → Inventory → Select Item
├─ Regular Price: $99.99
└─ Add Alternate Price: $79.99 (Sale)
```

### **2. Trigger Sync**
```
RVP Platform → Integrations → Clover
└─ Click "Sync Now"
```

### **3. Automatic Updates**
- Item syncs to RVP with both prices
- Storefront shows sale pricing
- Google Shopping receives sale price
- Order history captures pricing

---

## Data Flow

```
Clover POS
├─ Regular Price: $99.99
└─ Alternate Price: $79.99
        ↓
RVP Sync (API)
├─ price_cents: 9999
└─ sale_price_cents: 7999
        ↓
Platform Storefront
└─ Shows: $99.99 $79.99 [Save $20]
        ↓
Google Shopping
└─ Sends: price: $99.99, salePrice: $79.99
        ↓
Customer Purchase
└─ Captures: list_price_cents + unit_price_cents
```

---

## Clover Price Types

### **Fixed Price Items**
- Standard pricing model
- Supports alternate prices
- **Syncs sale pricing** ✅

### **Variable Price Items**
- Price determined at sale time
- No alternate prices supported
- **Skips sale pricing** (null)

### **Price Per Unit Items**
- Sold by weight/measure
- Can have alternate prices
- **Syncs sale pricing** ✅

---

## Benefits

### **For Merchants**
- **Single source of truth:** Manage pricing in Clover
- **Automatic sync:** No manual updates needed
- **Promotion management:** Run sales from POS
- **Consistency:** Same pricing everywhere

### **For Customers**
- **Accurate pricing:** Real-time from POS
- **Clear savings:** See discounts on storefront
- **Trust:** Consistent pricing in-store and online

### **For Platform**
- **POS integration:** Leverage existing workflows
- **Data accuracy:** Direct from source system
- **Historical tracking:** Captures pricing at purchase
- **Google compliance:** Sale prices sync to Shopping

---

## Sync Behavior

### **Initial Import**
- Imports all items with current pricing
- Captures regular and sale prices
- Creates item mappings

### **Ongoing Sync**
- Updates prices on each sync
- Adds new sale prices
- Removes expired sales (null)
- Maintains price history in orders

### **Conflict Resolution**
- Clover is source of truth for pricing
- RVP updates overwrite local changes
- Manual edits preserved between syncs

---

## API Endpoints

### **Trigger Sync**
```typescript
POST /api/integrations/:tenantId/clover/sync
{
  importNew: true,
  updateExisting: true,
  syncCategories: true
}
```

### **Response**
```json
{
  "success": true,
  "itemsCreated": 5,
  "itemsUpdated": 23,
  "itemsFailed": 0,
  "duration": 2341
}
```

---

## Testing Checklist

### **Clover Side**
- [ ] Set regular price on item
- [ ] Add alternate price (sale)
- [ ] Verify price type is FIXED
- [ ] Check alternate price is active

### **RVP Side**
- [ ] Trigger Clover sync
- [ ] Verify item imported/updated
- [ ] Check price_cents matches regular
- [ ] Check sale_price_cents matches alternate
- [ ] Verify storefront shows sale pricing

### **Google Shopping**
- [ ] Verify product syncs to GMC
- [ ] Check price field has regular price
- [ ] Check salePrice field has sale price
- [ ] Verify strikethrough displays

### **Order Flow**
- [ ] Add item to cart
- [ ] Verify cart shows sale price
- [ ] Complete purchase
- [ ] Check order_items has both prices
- [ ] Verify receipt shows savings

---

## Troubleshooting

### **Sale Price Not Syncing**

**Check Clover:**
- Verify alternate price exists
- Ensure price type is FIXED
- Confirm alternate price is active

**Check RVP:**
- Review sync logs for errors
- Verify item mapping exists
- Check database for sale_price_cents

**Check API:**
```sql
SELECT 
  name, 
  price_cents, 
  sale_price_cents,
  price_cents - sale_price_cents as discount
FROM inventory_items
WHERE sale_price_cents IS NOT NULL;
```

### **Price Mismatch**

**Clover uses cents:**
- Clover API returns prices in cents
- $99.99 = 9999 cents
- Verify conversion is correct

**Sync timing:**
- Changes may take time to propagate
- Trigger manual sync for immediate update
- Check last_synced_at timestamp

---

## Related Documentation

- `SALE_PRICING_IMPLEMENTATION_COMPLETE.md` - Platform sale pricing
- `GOOGLE_SHOPPING_SALE_PRICE_SYNC.md` - Google Shopping integration
- `ORDER_PRICING_HISTORY.md` - Order history tracking
- Clover API: [Items Endpoint](https://docs.clover.com/reference/itemgetitems)

---

## Summary

✅ **Clover sale prices sync to RVP**
✅ **Alternate prices map to sale_price_cents**
✅ **Variable price items handled correctly**
✅ **Automatic updates on sync**
✅ **Flows through to storefront and Google**

**Impact:** Merchants can manage promotional pricing in their POS system and have it automatically reflect across all sales channels, maintaining pricing consistency and reducing manual work.
