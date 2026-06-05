# Capacity Badge at Creation Points

**Status:** 📋 RECOMMENDED INTEGRATION  
**Date:** November 11, 2025  
**Principle:** Show limits where they matter most

## Overview

Integrate the `SubscriptionUsageBadge` at **creation points** to provide real-time capacity feedback and prevent users from hitting limits unexpectedly.

---

## Why at Creation Points?

### ✅ Immediate Feedback
- Users see current usage **before** attempting to create
- No surprise "limit reached" errors
- Proactive capacity awareness

### ✅ Better UX
- Clear expectations set upfront
- Users can plan accordingly
- Reduces frustration

### ✅ Upgrade Opportunities
- Show upgrade prompt when at/near limit
- Convert limit frustration into upgrade motivation
- Natural upsell moment

### ✅ Self-Service
- Users understand their limits
- No need to contact support
- Clear path forward (upgrade)

---

## Recommended Integration Points

### 1. Location Creation Page

**Page:** Create new tenant/location  
**Likely paths:**
- `/tenants/new`
- `/locations/create`
- Modal: "Create Location"

**Badge placement:**
```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<div className="create-location-page">
  <PageHeader title="Create New Location" />
  
  {/* Capacity Badge - Compact variant */}
  <div className="mb-6">
    <SubscriptionUsageBadge variant="compact" />
  </div>
  
  {/* Creation Form */}
  <form>
    <Input label="Location Name" />
    <Input label="Address" />
    <Button type="submit">Create Location</Button>
  </form>
</div>
```

**What users see:**
```
┌─────────────────────────────────────────┐
│ Create New Location                     │
├─────────────────────────────────────────┤
│ 📦 125/500 🟢  |  🏢 2/3 🟡            │  ← Capacity badge
│                                         │
│ ⚠️ You have 1 location remaining       │  ← Warning if near limit
│                                         │
│ Location Name: [____________]           │
│ Address: [____________]                 │
│ [Create Location]                       │
└─────────────────────────────────────────┘
```

**Benefits:**
- User sees "2 / 3 locations" before clicking create
- Yellow warning at 66% usage
- Can upgrade before hitting limit

---

### 2. Item/Product Creation Page

**Page:** Add new product/item  
**Likely paths:**
- `/t/:id/items/new`
- `/products/create`
- Modal: "Add Product"

**Badge placement:**
```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<div className="create-item-page">
  <PageHeader title="Add New Product" />
  
  {/* Capacity Badge - Compact variant */}
  <div className="mb-6">
    <SubscriptionUsageBadge variant="compact" />
  </div>
  
  {/* Creation Form */}
  <form>
    <Input label="SKU" />
    <Input label="Product Name" />
    <Input label="Price" />
    <Button type="submit">Add Product</Button>
  </form>
</div>
```

**What users see:**
```
┌─────────────────────────────────────────┐
│ Add New Product                         │
├─────────────────────────────────────────┤
│ 📦 450/500 🟡  |  🏢 2/3 🟢            │  ← Capacity badge
│                                         │
│ ⚠️ You have 50 SKUs remaining (90%)    │  ← Warning if near limit
│                                         │
│ SKU: [____________]                     │
│ Product Name: [____________]            │
│ Price: [____________]                   │
│ [Add Product]                           │
└─────────────────────────────────────────┘
```

**Benefits:**
- User sees "450 / 500 SKUs" before adding product
- Yellow warning at 90% usage
- Can upgrade before hitting limit

---

### 3. Bulk Import Pages

**Pages:** Bulk operations  
**Likely paths:**
- `/t/:id/items/import`
- `/products/bulk-upload`
- CSV import modal

**Badge placement:**
```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<div className="bulk-import-page">
  <PageHeader title="Bulk Import Products" />
  
  {/* Capacity Badge - Card variant for more detail */}
  <div className="mb-6">
    <SubscriptionUsageBadge variant="card" showUpgradeLink={true} />
  </div>
  
  {/* Import Interface */}
  <div className="upload-area">
    <p>Upload CSV file (max {remainingCapacity} products)</p>
    <FileUpload />
  </div>
</div>
```

**What users see:**
```
┌─────────────────────────────────────────┐
│ Bulk Import Products                    │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Current Plan: Starter ($49/month)   │ │
│ │                                     │ │
│ │ 📦 SKU: 450/500 (90% used)         │ │
│ │ [████████████████████░░░░]         │ │
│ │                                     │ │
│ │ 🏢 Location: 2/3 (66% used)        │ │
│ │ [████████████████░░░░░░░░]         │ │
│ │                                     │ │
│ │ ⚠️ Only 50 SKUs remaining!         │ │
│ │ → Upgrade to Professional (5,000)  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Upload CSV (max 50 products)            │
│ [Drop file here or click to upload]    │
└─────────────────────────────────────────┘
```

**Benefits:**
- Shows remaining capacity before upload
- Prevents failed uploads due to limits
- Suggests upgrade for large imports
- Calculates max upload size dynamically

---

### 4. Dashboard "Create" Actions

**Pages:** Main dashboard with create buttons  
**Likely paths:**
- `/` (main dashboard)
- `/t/:id` (tenant dashboard)

**Badge placement:**
```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

<div className="dashboard">
  <div className="header">
    <h1>Dashboard</h1>
    
    {/* Capacity Badge in header */}
    <SubscriptionUsageBadge variant="compact" />
  </div>
  
  <div className="quick-actions">
    <Button onClick={createLocation}>
      + New Location
      {locationAtLimit && <Badge color="red">Limit Reached</Badge>}
    </Button>
    <Button onClick={createProduct}>
      + New Product
      {skuAtLimit && <Badge color="red">Limit Reached</Badge>}
    </Button>
  </div>
</div>
```

**What users see:**
```
┌─────────────────────────────────────────┐
│ Dashboard    📦 450/500 🟡 | 🏢 2/3 🟢 │  ← Always visible
├─────────────────────────────────────────┤
│                                         │
│ Quick Actions:                          │
│ [+ New Location]  [+ New Product ⚠️]   │  ← Warning on product
│                                         │
│ Recent Items...                         │
└─────────────────────────────────────────┘
```

**Benefits:**
- Always-visible capacity indicator
- Disable/warn on create buttons when at limit
- Context-aware action availability

---

## Implementation Examples

### Example 1: Simple Integration

```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

export default function CreateLocationPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create New Location</h1>
      
      {/* Add capacity badge */}
      <div className="mb-6">
        <SubscriptionUsageBadge variant="compact" />
      </div>
      
      {/* Rest of form */}
      <LocationForm />
    </div>
  );
}
```

### Example 2: With Conditional Warning

```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';

export default function CreateProductPage() {
  const { usage, loading } = useSubscriptionUsage();
  
  const isNearLimit = usage && usage.skuPercent >= 80;
  const isAtLimit = usage && usage.skuPercent >= 100;
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add New Product</h1>
      
      {/* Capacity badge */}
      <div className="mb-6">
        <SubscriptionUsageBadge variant="compact" />
      </div>
      
      {/* Conditional warnings */}
      {isAtLimit && (
        <Alert variant="error" className="mb-6">
          <strong>SKU limit reached!</strong> Please upgrade your plan to add more products.
          <Button href="/settings/subscription">Upgrade Now</Button>
        </Alert>
      )}
      
      {isNearLimit && !isAtLimit && (
        <Alert variant="warning" className="mb-6">
          <strong>Approaching SKU limit!</strong> You have {usage.skuLimit - usage.skuUsage} products remaining.
        </Alert>
      )}
      
      {/* Form - disabled if at limit */}
      <ProductForm disabled={isAtLimit} />
    </div>
  );
}
```

### Example 3: Bulk Import with Dynamic Limit

```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';

export default function BulkImportPage() {
  const { usage, loading } = useSubscriptionUsage();
  
  const remainingCapacity = usage 
    ? Math.max(0, usage.skuLimit - usage.skuUsage)
    : 0;
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Bulk Import Products</h1>
      
      {/* Full capacity card */}
      <div className="mb-6">
        <SubscriptionUsageBadge variant="card" showUpgradeLink={true} />
      </div>
      
      {/* Dynamic upload limit */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Available capacity:</strong> {remainingCapacity} products
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Your CSV file can contain up to {remainingCapacity} products.
        </p>
      </div>
      
      {/* Upload interface */}
      <FileUpload 
        maxItems={remainingCapacity}
        disabled={remainingCapacity === 0}
      />
    </div>
  );
}
```

---

## User Experience Flow

### Scenario 1: User Near SKU Limit

**User journey:**
1. User navigates to "Add Product" page
2. Sees capacity badge: "📦 480/500 🟡"
3. Sees warning: "You have 20 products remaining (96%)"
4. User can:
   - Add product (still has capacity)
   - Click upgrade link to increase limit
5. Badge updates in real-time after creation

### Scenario 2: User at Location Limit

**User journey:**
1. User navigates to "Create Location" page
2. Sees capacity badge: "🏢 3/3 🔴"
3. Sees error: "Location limit reached!"
4. Create button is disabled
5. Prominent upgrade button shown
6. User clicks upgrade → taken to subscription page

### Scenario 3: Bulk Import Too Large

**User journey:**
1. User navigates to "Bulk Import" page
2. Sees capacity card showing 50 SKUs remaining
3. Upload interface shows "max 50 products"
4. User uploads CSV with 100 products
5. System validates: "File contains 100 products, but you only have capacity for 50"
6. Options:
   - Upload first 50 only
   - Upgrade plan
   - Cancel

---

## Benefits Summary

### For Users

✅ **No Surprises** - See limits before attempting creation  
✅ **Clear Expectations** - Know exactly how much capacity remains  
✅ **Proactive Planning** - Can upgrade before hitting limit  
✅ **Better Experience** - No failed creation attempts  

### For Business

✅ **Upgrade Opportunities** - Natural upsell moments  
✅ **Reduced Support** - Users self-serve capacity info  
✅ **Better Conversion** - Frustrated users → paying customers  
✅ **Data-Driven** - Track where users hit limits  

### For Development

✅ **Reusable Component** - Same badge everywhere  
✅ **Real-Time Data** - Always current  
✅ **Easy Integration** - 1 line of code  
✅ **Consistent UX** - Same look and feel  

---

## Implementation Checklist

### Phase 1: High-Impact Pages

- [ ] Location creation page/modal
- [ ] Product/item creation page/modal
- [ ] Dashboard header (always visible)

### Phase 2: Bulk Operations

- [ ] Bulk product import
- [ ] CSV upload pages
- [ ] Batch creation flows

### Phase 3: Secondary Pages

- [ ] Settings pages
- [ ] Tenant switcher
- [ ] Admin tools

---

## Technical Notes

### Real-Time Updates

**Badge updates automatically when:**
- User creates a location (location count increases)
- User creates a product (SKU count increases)
- User deletes a location (location count decreases)
- User deletes a product (SKU count decreases)

**How it works:**
- Hook refetches on mount
- Component re-renders with new data
- No manual refresh needed

### Performance

**Optimizations:**
- Parallel API calls (3 requests)
- Cached in component state
- Only refetches on page navigation
- Minimal overhead

### Error Handling

**Graceful degradation:**
- If API fails → badge hides
- If data unavailable → shows "N/A"
- Never breaks the page
- No console errors

---

## Recommended Variants by Page

| Page Type | Variant | Reason |
|-----------|---------|--------|
| Creation forms | `compact` | Minimal space, always visible |
| Bulk imports | `card` | More detail needed, upgrade CTA |
| Dashboard header | `compact` | Always visible, quick reference |
| Settings pages | `card` | Full details, upgrade options |
| Modals | `compact` | Limited space |
| Lists | `inline` | Fits in table rows |

---

## Example Pages to Update

### High Priority

1. **`/tenants/new`** - Location creation
2. **`/t/:id/items/new`** - Product creation
3. **`/t/:id/items/import`** - Bulk import
4. **`/` (Dashboard)** - Header badge

### Medium Priority

5. **`/t/:id`** - Tenant dashboard header
6. **`/settings`** - Settings overview
7. **Create location modal** - If using modals

### Low Priority

8. **`/admin/tenants`** - Admin view (if applicable)
9. **Tenant switcher** - Show capacity per tenant
10. **User profile** - Show user's total capacity

---

## Conclusion

**✅ Capacity badges at creation points provide:**

1. **Immediate Feedback** - Users see limits before creating
2. **Better UX** - No surprise errors
3. **Upgrade Opportunities** - Natural upsell moments
4. **Self-Service** - Reduced support load
5. **Real-Time Data** - Always current
6. **Easy Integration** - 1 line of code per page

**This is the most impactful place to show capacity information!** 🎯

---

## Quick Integration Guide

**Step 1: Import the component**
```typescript
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';
```

**Step 2: Add to page**
```typescript
<SubscriptionUsageBadge variant="compact" />
```

**Step 3: (Optional) Add conditional logic**
```typescript
const { usage } = useSubscriptionUsage();
const isAtLimit = usage && usage.skuPercent >= 100;

{isAtLimit && <Alert>Limit reached! Upgrade to continue.</Alert>}
```

**That's it! 3 steps to add capacity awareness to any creation page.** 🚀
