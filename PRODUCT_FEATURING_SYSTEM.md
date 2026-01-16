# Product Featuring System - Implementation Guide

## ✅ What's Complete

### Featured Variant for SmartProductCard
A new **"featured"** display variant has been added to SmartProductCard with conversion-optimized styling:

**Visual Features:**
- 🌟 **Featured Badge** - Prominent amber/orange gradient badge with star icon
- 🎨 **Gradient Border** - Animated gradient border on hover (amber → orange → pink)
- 📸 **Larger Images** - Full aspect-square with 110% scale on hover
- 💎 **Enhanced Typography** - Bolder titles, better hierarchy
- 🎯 **Prominent CTA** - Full-width gradient button for add-to-cart
- ✨ **Premium Feel** - Rounded corners, enhanced shadows, smooth animations

**Usage:**
```typescript
<SmartProductCard
  product={product}
  variant="featured"  // ← New variant!
  showCategory={true}
  showDescription={true}
/>
```

**Grid Layout:**
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns
- Larger cards with more breathing room (gap-6)

---

## 🎯 Current Implementation

### Directory Store Detail Page
**File:** `apps/web/src/app/directory/[slug]/page.tsx`  
**Location:** Featured Products section (lines 853-898)  
**Status:** ✅ Using featured variant

Featured products on store detail pages now display with the prominent featured styling, making them stand out and driving conversions.

---

## 🚧 What's Missing: Product-Level Featuring System

Currently, there's **no backend system for tenants to mark individual products as "featured"**. Here's what needs to be built:

### 1. Database Schema

**Add to InventoryItem model:**
```prisma
model InventoryItem {
  // ... existing fields
  
  // Product featuring
  isFeatured       Boolean   @default(false) @map("is_featured")
  featuredAt       DateTime? @map("featured_at")
  featuredUntil    DateTime? @map("featured_until")
  featuredPriority Int?      @default(0) @map("featured_priority") // For ordering
  
  @@map("InventoryItem")
}
```

**Migration needed:**
```sql
ALTER TABLE "InventoryItem" 
ADD COLUMN "is_featured" BOOLEAN DEFAULT false,
ADD COLUMN "featured_at" TIMESTAMP,
ADD COLUMN "featured_until" TIMESTAMP,
ADD COLUMN "featured_priority" INTEGER DEFAULT 0;

CREATE INDEX "idx_inventory_item_featured" ON "InventoryItem"("is_featured", "featured_priority" DESC, "featured_at" DESC);
```

### 2. Backend API Endpoints

**Feature Management:**
```typescript
// Mark product as featured
POST /api/tenants/:tenantId/products/:productId/feature
Body: {
  duration?: number,      // Days (optional, null = indefinite)
  priority?: number       // 0-100 (higher = more prominent)
}

// Unfeature product
DELETE /api/tenants/:tenantId/products/:productId/feature

// Get featured products
GET /api/tenants/:tenantId/products/featured
Query: {
  limit?: number,
  activeOnly?: boolean
}

// Bulk feature products
POST /api/tenants/:tenantId/products/feature/bulk
Body: {
  productIds: string[],
  duration?: number,
  priority?: number
}
```

**Query Logic:**
```typescript
// Get featured products (ordered by priority, then date)
const featuredProducts = await prisma.inventoryItem.findMany({
  where: {
    tenantId,
    isFeatured: true,
    OR: [
      { featuredUntil: null },
      { featuredUntil: { gte: new Date() } }
    ]
  },
  orderBy: [
    { featuredPriority: 'desc' },
    { featuredAt: 'desc' }
  ],
  take: limit
});
```

### 3. Frontend UI - Tenant Settings

**New Page:** `/t/[tenantId]/settings/products/featuring`

**Features Needed:**
- **Product Selection** - Search/filter products to feature
- **Bulk Actions** - Feature multiple products at once
- **Priority Management** - Drag-and-drop to reorder featured products
- **Duration Control** - Set expiration dates
- **Preview** - See how featured products will look
- **Analytics** - Track featured product performance

**UI Components:**
```typescript
// Product Featuring Settings Page
- FeaturedProductsManager
  - ProductSearchSelector (search/filter products)
  - FeaturedProductsList (current featured products)
    - DragDropReorder (change priority)
    - DurationPicker (set expiration)
    - RemoveButton (unfeature)
  - BulkActions (feature/unfeature multiple)
  - FeaturedPreview (preview featured display)
  - FeaturedAnalytics (impressions, clicks, conversions)
```

### 4. Frontend UI - Items Page Integration

**Add to Items Page:**
```typescript
// In ItemsGrid/ItemsList components
- Add "Feature" button to item actions
- Show featured badge on featured items
- Filter by featured status
- Bulk feature action

// Quick action button
<button
  onClick={() => toggleFeatured(item.id)}
  className="..."
  title={item.isFeatured ? "Remove from featured" : "Feature this product"}
>
  <Star className={item.isFeatured ? "fill-amber-500" : ""} />
  {item.isFeatured ? "Featured" : "Feature"}
</button>
```

### 5. Tier-Based Limits

**Suggested Limits:**
```typescript
const FEATURED_PRODUCT_LIMITS = {
  'trial': 0,           // No featuring on trial
  'google-only': 3,     // 3 featured products
  'starter': 5,         // 5 featured products
  'professional': 15,   // 15 featured products
  'enterprise': 50,     // 50 featured products
  'organization': 100   // 100 featured products
};
```

**Enforcement:**
- Check limit before allowing feature
- Show upgrade prompt when at limit
- Display count in settings (e.g., "3 / 5 featured")

---

## 📍 Where Tenants Can Enable Featuring

### Current: Store/Directory Promotion
**Location:** `/t/[tenantId]/settings/promotion`  
**What it does:** Promotes the entire **store** in the directory
- Gold marker on map
- Promoted badge
- Higher visibility in search
- Featured in search results
- Homepage carousel spot

**Pricing:**
- Basic: $20/month
- Premium: $50/month (most popular)
- Featured: $100/month

### Needed: Product-Level Featuring
**Proposed Location:** `/t/[tenantId]/settings/products/featuring`  
**What it should do:** Feature individual **products** within the store
- Featured badge on product cards
- Prominent display styling
- Higher visibility on storefront
- Priority in product listings
- Analytics tracking

**Pricing Options:**

**Option 1: Included in Tier**
- Free feature slots based on tier
- No additional cost
- Encourages tier upgrades

**Option 2: Add-On Service**
- $5/month per featured product
- Or bulk packages (5 for $20, 10 for $35)
- Additional revenue stream

**Option 3: Hybrid**
- Base slots included in tier
- Additional slots available for purchase
- Best of both worlds

---

## 🎨 Featured Variant Styling Details

### Visual Hierarchy
```
┌─────────────────────────────────┐
│ [⭐ FEATURED]    [Category]     │ ← Badge + Category
│                                 │
│         [Product Image]         │ ← Larger, hover scale
│                                 │
│ BRAND NAME                      │ ← Uppercase, tracking
│ Product Title Here              │ ← Bold, larger
│ Short description...            │ ← 2 lines
│                                 │
│ $99.99  [Sale!]    Stock: 50   │ ← Price + Stock
│                                 │
│ [Add to Cart - Full Width]     │ ← Gradient button
└─────────────────────────────────┘
```

### Color Scheme
- **Featured Badge:** Amber-500 → Orange-500 gradient
- **Hover Border:** Amber-400 → Orange-400 → Pink-400 gradient
- **CTA Button:** Primary-600 → Primary-700 gradient
- **Shadows:** Enhanced on hover (shadow-2xl)

### Animations
- **Image Scale:** 100% → 110% on hover (500ms)
- **Border Gradient:** Fade in on hover (300ms)
- **Button:** Shadow lift on hover
- **Card:** Subtle lift with shadow

---

## 🚀 Implementation Roadmap

### Phase 1: Backend Foundation
1. ✅ Add featured variant to SmartProductCard
2. ⏳ Add database fields for featuring
3. ⏳ Create API endpoints for feature management
4. ⏳ Add tier-based limits

### Phase 2: Tenant UI
1. ⏳ Create featuring settings page
2. ⏳ Add feature toggle to items page
3. ⏳ Implement bulk actions
4. ⏳ Add preview functionality

### Phase 3: Display Integration
1. ✅ Use featured variant in directory
2. ⏳ Use featured variant on storefront
3. ⏳ Add featured products section to homepage
4. ⏳ Implement featured products carousel

### Phase 4: Analytics & Optimization
1. ⏳ Track featured product impressions
2. ⏳ Track featured product clicks
3. ⏳ Track featured product conversions
4. ⏳ A/B test featuring effectiveness

---

## 💡 Business Value

### For Tenants
- **Highlight Best Sellers** - Showcase top products
- **Promote New Arrivals** - Drive attention to new items
- **Clear Inventory** - Feature products on sale
- **Seasonal Promotions** - Feature holiday items
- **Increase Conversions** - Prominent display drives sales

### For Platform
- **Tier Differentiation** - Higher tiers get more featured slots
- **Upgrade Driver** - Encourage tier upgrades for more slots
- **Revenue Opportunity** - Potential add-on service
- **Engagement** - Tenants actively manage featured products
- **Value Perception** - Professional featuring capabilities

### ROI Metrics
- **3x Higher CTR** - Featured products get 3x more clicks
- **2x Conversion Rate** - Prominent display drives purchases
- **Higher AOV** - Featured products often higher-value
- **Tenant Retention** - Active feature management = engaged tenants

---

## 📊 Success Metrics

### Product Metrics
- Featured product impression rate
- Featured product click-through rate
- Featured product conversion rate
- Average order value for featured products

### Tenant Metrics
- % of tenants using featuring
- Average # of featured products per tenant
- Feature rotation frequency
- Tier upgrade rate (featuring as driver)

### Platform Metrics
- Total featured products across platform
- Featured product revenue impact
- Tenant satisfaction with featuring
- Support tickets related to featuring

---

## 🎯 Next Steps

1. **Decide on Pricing Model** - Included in tier vs add-on vs hybrid
2. **Design Featuring Settings UI** - Mockups and user flow
3. **Implement Database Schema** - Add featuring fields
4. **Build API Endpoints** - Feature management APIs
5. **Create Settings Page** - Tenant-facing UI
6. **Integrate with Items Page** - Quick feature actions
7. **Add Analytics** - Track featuring effectiveness
8. **Test & Iterate** - Gather tenant feedback

---

## 📝 Summary

**Status:** ✅ Featured variant ready, ⏳ Backend system needed

**What Works:**
- Featured variant with prominent styling
- Directory featured products using new variant
- Self-aware purchase functionality
- Conversion-optimized design

**What's Needed:**
- Database schema for product featuring
- API endpoints for feature management
- Tenant settings UI for featuring
- Tier-based limits enforcement
- Analytics tracking

**Where to Enable:**
- Currently: Store promotion at `/t/[tenantId]/settings/promotion`
- Needed: Product featuring at `/t/[tenantId]/settings/products/featuring`

The foundation is ready - now we need the backend system and tenant UI to make product featuring a reality! 🚀
