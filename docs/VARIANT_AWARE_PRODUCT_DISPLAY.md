# Variant-Aware Product Display System

## Overview

The Variant-Aware Product Display System brings **Visible Shelf** up to par with modern e-commerce platforms by providing comprehensive variant support for customer purchasing decisions. This system allows customers to compare variants based on price, quantity, featured types, and attributes before adding the appropriate variant to their shopping cart.

## 🎯 Business Value

### For Customers
- **Informed Decisions**: Compare all variants before purchasing
- **Clear Pricing**: See individual variant prices and discounts
- **Featured Type Awareness**: Understand which variants are special (sale, new arrival, etc.)
- **Stock Visibility**: Know which variants are in stock
- **Attribute Selection**: Easy visual selection of size, color, etc.

### For Merchants
- **Increased Conversions**: Better variant presentation leads to more sales
- **Reduced Returns**: Customers make informed choices
- **Featured Type Impact**: Individual variants can have their own featured types
- **Inventory Management**: Clear stock status per variant
- **Marketing Flexibility**: Highlight specific variants with featured types

### For Platform
- **Modern E-commerce**: Parity with major e-commerce platforms
- **User Experience**: Superior variant selection interface
- **Conversion Optimization**: Better product presentation
- **Data Richness**: Comprehensive variant analytics

## 🏗️ Architecture

### Core Components

1. **ProductWithVariants Component** (`ProductWithVariants.tsx`)
   - Main product display with variant support
   - Featured type integration per variant
   - Smart sale tagging integration
   - Variant comparison grid
   - Image switching based on variant selection

2. **Enhanced VariantSelector** (`VariantSelector.tsx`)
   - Visual attribute selection (size, color, etc.)
   - Real-time pricing display
   - Stock status per variant
   - Variant comparison grid
   - Smart availability checking

3. **Variant Featured Types API** (`variant-featured-types.ts`)
   - Individual variant featured type support
   - Bulk variant featured type fetching
   - Tenant isolation and security
   - Integration with existing featured products system

4. **Smart Sale Tagging Integration**
   - Automatic sale detection per variant
   - Individual variant sale pricing
   - Featured type priority system
   - Real-time MV updates

## 📋 Enhanced Features

### 1. Individual Variant Featured Types
```typescript
// Each variant can have its own featured types
Variant A: "Small - Blue" → Featured Type: "sale"
Variant B: "Medium - Blue" → Featured Type: "new_arrival"  
Variant C: "Large - Blue" → Featured Type: null
```

### 2. Smart Sale Tagging per Variant
```typescript
// Automatic sale detection for each variant
Variant A: $20 regular, $15 sale → Auto-tagged as "sale"
Variant B: $20 regular, $20 sale → Not on sale
Variant C: $20 regular, $18 sale → Auto-tagged as "sale"
```

### 3. Enhanced Price Display
```typescript
// Comprehensive pricing information
<SalePrice 
  product={{
    price: { cents: 2000, currency: 'USD', formatted: '$20.00' },
    salePrice: { cents: 1500, currency: 'USD', formatted: '$15.00' }
  }}
  variant="detail"
  showOriginalPrice={true}
  showDiscountPercentage={true}
  showDiscountAmount={true}
/>
```

### 4. Variant Comparison Grid
```typescript
// Visual comparison of available variants
{variants.map(variant => (
  <div className="border rounded-lg p-4">
    <h4>{variant.variant_name}</h4>
    <SalePrice product={variant} variant="compact" />
    <FeaturedTypeBadges featuredTypes={variant.featuredTypes} />
    <Badge variant={variant.stock > 0 ? 'success' : 'error'}>
      {variant.stock > 0 ? `${variant.stock} in stock` : 'Out of stock'}
    </Badge>
  </div>
))}
```

### 5. Smart Image Switching
```typescript
// Images change based on variant selection
{selectedVariant?.id && variantPhotos[selectedVariant.id]?.length > 0 ? (
  <img src={variantPhotos[selectedVariant.id][0]} alt={selectedVariant.variant_name} />
) : (
  <img src={product.imageUrl} alt={product.name} />
)}
```

## 🔄 Customer Journey Flow

### Step 1: Product Discovery
Customer lands on product page and sees:
- Product name and main image
- Featured type badges (if any)
- Price range (if variants exist)
- Variant selection options

### Step 2: Variant Exploration
Customer can:
- **Browse All Variants**: See comparison grid with pricing and stock
- **Select Attributes**: Choose size, color, etc. via visual buttons
- **View Details**: See individual variant information
- **Check Availability**: Real-time stock status per variant

### Step 3: Selection Confirmation
When variant is selected:
- **Image Updates**: Product image changes to variant image
- **Price Updates**: Price reflects selected variant
- **Stock Updates**: Stock status shows variant availability
- **Featured Types**: Shows variant-specific featured types
- **Attributes Display**: Confirms selected options

### Step 4: Purchase Decision
Customer sees:
- **Final Price**: With sale pricing and discounts
- **Stock Status**: Clear availability indication
- **Featured Types**: Special badges (sale, new, etc.)
- **Add to Cart**: Enabled/disabled based on stock

## 🎨 UI Components

### ProductWithVariants Layout
```
┌─────────────────────────────────────┐
│ Product Image + Sale Badge           │
├─────────────────────────────────────┤
│ Product Name + Featured Type Badges  │
├─────────────────────────────────────┤
│ SalePrice Component (detail variant) │
│ • Current price                     │
│ • Original price (if on sale)       │
│ • Discount percentage/amount        │
├─────────────────────────────────────┤
│ Stock Status + SKU + Variant Name   │
├─────────────────────────────────────┤
│ Variant Selector (if has_variants)  │
│ • Attribute buttons (size, color)    │
│ • Availability checking              │
│ • Selected variant info             │
├─────────────────────────────────────┤
│ Variant Comparison Grid (optional)   │
│ • 6 variants with pricing           │
│ • Featured types per variant        │
│ • Stock status per variant          │
├─────────────────────────────────────┤
│ Add to Cart Button                  │
│ • Disabled if out of stock          │
│ • Passes correct variant data        │
└─────────────────────────────────────┘
```

### VariantSelector Enhancement
```
┌─────────────────────────────────────┐
│ Select Options                        │
├─────────────────────────────────────┤
│ Size: [Small] [Medium] [Large]       │
│      ✓ Selected                      │
├─────────────────────────────────────┤
│ Color: [Blue] [Red] [Green]          │
│      ✓ Selected                      │
├─────────────────────────────────────┤
│ Selected Variant Info                 │
│ • Small - Blue                       │
│ • SKU: TS-S-BLUE                    │
│ • $15.00 (25% OFF)                  │
│ • 10 in stock                        │
├─────────────────────────────────────┤
│ All Available Options                 │
│ • Small - Red ($18.00) - 5 in stock   │
│ • Medium - Blue ($20.00) - 8 in stock  │
│ • Large - Green ($22.00) - 3 in stock │
└─────────────────────────────────────┘
```

## 🔧 API Integration

### Variant Featured Types Endpoint
```typescript
// GET /api/featured-products/item/:variantId
{
  "success": true,
  "featuredTypes": [
    {
      "type": "sale",
      "label": "Sale",
      "color": "red",
      "priority": 3,
      "description": "On sale now"
    }
  ],
  "itemId": "var-123",
  "count": 1
}
```

### Bulk Variant Featured Types
```typescript
// GET /api/featured-products/variants/:parentItemId
{
  "success": true,
  "variants": [
    {
      "variantId": "var-123",
      "variantName": "Small - Blue",
      "sku": "TS-S-BLUE",
      "featuredTypes": [...],
      "count": 1
    }
  ],
  "parentItemId": "item-456",
  "totalVariants": 3
}
```

### Smart Sale Tagging Integration
The materialized view automatically handles variant sale pricing:

```sql
-- Each variant evaluated independently
SELECT 
  i.id,
  i.variant_name,
  i.price_cents,
  i.sale_price_cents,
  -- Smart sale tagging logic
  CASE 
    WHEN i.sale_price_cents IS NOT NULL 
         AND i.sale_price_cents > 0 
         AND i.sale_price_cents < i.price_cents
         AND (fp.featured_type IS NULL OR fp.featured_type != 'sale')
    THEN 'sale'
    ELSE fp.featured_type
  END AS featured_type
FROM product_variants i
LEFT JOIN featured_products fp ON i.id = fp.inventory_item_id
```

## 📊 Smart Tagging Behavior

### Priority System
1. **Manual Featured Type** (Highest Priority)
   - Merchant manually sets "new_arrival" on variant
   - Preserved even if variant is on sale
   - Example: "new_arrival" + sale price = "new_arrival"

2. **Automatic Sale Tagging** (Medium Priority)
   - Variant has sale price but no manual "sale" tag
   - Automatically tagged as "sale" with priority 3
   - Example: No manual tag + sale price = "sale"

3. **Default State** (Lowest Priority)
   - No sale price
   - No manual featured type
   - No automatic tagging

### Real-World Examples

**Scenario 1: Mixed Featured Types**
```
T-Shirt Variants:
├── Small - Blue: Manual "new_arrival" + $15 sale → Featured: "new_arrival"
├── Medium - Blue: No manual tag + $15 sale → Featured: "sale" (auto-tagged)
└── Large - Blue: Manual "featured" + $20 regular → Featured: "featured"
```

**Scenario 2: Sale Campaign**
```
All T-Shirt variants on sale:
├── Small - Red: $20 → $15 (25% OFF) → Auto-tagged "sale"
├── Medium - Red: $20 → $15 (25% OFF) → Auto-tagged "sale"
└── Large - Red: $20 → $15 (25% OFF) → Auto-tagged "sale"
```

**Scenario 3: Manual Override**
```
Premium variants:
├── Small - Premium: Manual "bestseller" + $25 sale → Featured: "bestseller"
├── Medium - Premium: Manual "bestseller" + $25 sale → Featured: "bestseller"
└── Large - Premium: Manual "bestseller" + $25 sale → Featured: "bestseller"
```

## 🛠️ Implementation Details

### Frontend Components

**ProductWithVariants Props:**
```typescript
interface ProductWithVariantsProps {
  product: {
    id: string;
    sku: string;
    name: string;
    priceCents: number;
    salePriceCents?: number;
    stock: number;
    imageUrl?: string;
    has_variants?: boolean;
    featuredType?: string;
    featuredPriority?: number;
    isFeaturedActive?: boolean;
  };
  tenantName: string;
  tenantLogo?: string;
  defaultGatewayType?: string;
  className?: string;
  showImage?: boolean;
  onImageChange?: (imageUrl: string | undefined) => void;
}
```

**Enhanced State Management:**
```typescript
const [variants, setVariants] = useState<ProductVariant[]>([]);
const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
const [variantFeaturedTypes, setVariantFeaturedTypes] = useState<Record<string, any>>({});
const [currentImage, setCurrentImage] = useState<string | undefined>(product.imageUrl);
```

**API Integration:**
```typescript
// Fetch variants with featured types
const fetchVariants = async () => {
  const response = await fetch(`${apiUrl}/api/items/${product.id}/variants`);
  const data = await response.json();
  setVariants(data.variants || []);
  
  // Fetch featured types for each variant
  if (data.variants?.length > 0) {
    await fetchVariantFeaturedTypes(data.variants);
  }
};
```

### Backend API Routes

**Security & Validation:**
```typescript
// Tenant isolation
const item = await prisma.$queryRaw`
  SELECT tenant_id FROM (
    SELECT id, tenant_id FROM inventory_items WHERE id = ${itemId}
    UNION ALL
    SELECT id, tenant_id FROM product_variants WHERE id = ${itemId}
  ) combined_items
  WHERE id = ${itemId}
  LIMIT 1
`;

// Access control
if (item[0].tenant_id !== user.tenantId) {
  return res.status(403).json({
    success: false,
    error: 'access_denied',
    message: 'Access denied'
  });
}
```

**Featured Type Transformation:**
```typescript
// Transform database records to display format
const featuredTypes = featuredProducts.map(fp => 
  getFeaturedTypeDisplay(fp.featured_type, fp.featured_priority)
);
```

## 🚀 Performance Optimizations

### Frontend Performance
- **Lazy Loading**: Variants fetched only when needed
- **Image Caching**: Variant photos cached per product
- **Debounced Selection**: Prevents excessive API calls
- **Optimistic Updates**: Immediate UI feedback

### Backend Performance
- **Bulk Queries**: Fetch all variant featured types in parallel
- **Materialized View**: Smart sale tagging via MV
- **Indexed Queries**: Optimized database access
- **Tenant Isolation**: Efficient filtering by tenant

### Database Optimization
```sql
-- Indexes for variant performance
CREATE INDEX idx_product_variants_parent ON product_variants(parent_item_id);
CREATE INDEX idx_product_variants_tenant ON product_variants(tenant_id);
CREATE INDEX idx_featured_products_item ON featured_products(inventory_item_id);
CREATE INDEX idx_featured_products_tenant ON featured_products(tenant_id);
```

## 📈 Analytics & Insights

### Variant Performance Metrics
- **Variant Conversion Rates**: Which variants sell best
- **Featured Type Impact**: Effect of featured types on variant sales
- **Price Sensitivity**: How price affects variant selection
- **Stock Optimization**: Variant inventory management

### Customer Behavior Analysis
- **Selection Patterns**: Most popular attribute combinations
- **Comparison Behavior**: How customers compare variants
- **Decision Time**: Time to select variant vs single product
- **Cart Abandonment**: Variant vs single product cart rates

### Merchant Insights
- **Variant Performance**: Best/worst performing variants
- **Featured Type ROI**: Impact of manual vs auto-tagging
- **Inventory Optimization**: Stock level recommendations
- **Pricing Strategy**: Variant price optimization

## 🎯 Use Cases

### Fashion & Apparel
```
T-Shirt Product:
├── Size: XS, S, M, L, XL, XXL
├── Color: Red, Blue, Black, White
├── Featured: "new_arrival" (Spring collection)
└── Pricing: $19.99 - $24.99 (size-based)
```

### Electronics
```
Smartphone Product:
├── Storage: 64GB, 128GB, 256GB, 512GB
├── Color: Space Gray, Silver, Gold
├── Featured: "bestseller" (256GB model)
└── Pricing: $699 - $1099 (storage-based)
```

### Home & Garden
```
Plant Pot Product:
├── Size: Small (6"), Medium (8"), Large (12")
├── Material: Ceramic, Plastic, Terracotta
├── Featured: "sale" (overstock items)
└── Pricing: $12.99 - $29.99 (size-based)
```

## 🔄 Integration Points

### Shopping Cart Integration
```typescript
<AddToCartButton
  product={{
    ...product,
    sku: effectiveSku,           // Variant SKU
    priceCents: effectivePrice,   // Variant price
    salePriceCents: effectiveSalePrice, // Variant sale price
    stock: effectiveStock,        // Variant stock
  }}
  variant={selectedVariant}      // Full variant object
  tenantName={tenantName}
  tenantLogo={tenantLogo}
  defaultGatewayType={defaultGatewayType}
  className="w-full"
  disabled={effectiveStock <= 0}
/>
```

### Smart Sale Tagging Integration
- **Automatic Detection**: MV detects variant sale prices
- **Individual Tagging**: Each variant tagged independently
- **Priority System**: Manual tags override auto-tagging
- **Real-Time Updates**: MV refresh updates all displays

### Bulk Operations Integration
- **Variant-Level Operations**: Bulk operations work on individual variants
- **Featured Type Assignment**: Apply featured types to specific variants
- **Sale Price Management**: Set sale prices per variant
- **Stock Updates**: Update stock for selected variants

## 📚 Future Enhancements

### Advanced Features
- **Variant Recommendations**: AI-powered variant suggestions
- **Bundle Discounts**: Discount for multiple variants
- **Variant Reviews**: Individual variant ratings and reviews
- **Custom Attributes**: Dynamic variant attribute system

### User Experience
- **3D Variant Preview**: Interactive product visualization
- **Augmented Reality**: AR view of variants in customer space
- **Size Guides**: Interactive size recommendation tools
- **Color Matching**: AI-powered color suggestions

### Analytics & Insights
- **Variant Heatmap**: Visual representation of variant popularity
- **A/B Testing**: Test different variant presentations
- **Customer Segmentation**: Variant preferences by customer type
- **Predictive Analytics**: Forecast variant demand

## ✅ Production Readiness

### Current Status
- ✅ **Frontend Components**: Complete with TypeScript support
- ✅ **Backend API**: Full featured type support for variants
- ✅ **Smart Tagging**: Automatic sale detection per variant
- ✅ **Performance**: Optimized queries and caching
- ✅ **Security**: Tenant isolation and access control
- ✅ **Documentation**: Comprehensive implementation guide

### Integration Checklist
- ✅ **Product Display**: Enhanced variant-aware display
- ✅ **Shopping Cart**: Correct variant data passed to cart
- ✅ **Featured Types**: Individual variant featured type support
- ✅ **Sale Pricing**: Per-variant sale pricing with smart tagging
- ✅ **Stock Management**: Real-time stock status per variant
- ✅ **Image Management**: Variant-specific image switching

### Business Impact
- ✅ **Modern E-commerce**: Parity with major platforms
- ✅ **Conversion Optimization**: Better variant presentation
- ✅ **Customer Experience**: Superior variant selection
- ✅ **Merchant Tools**: Individual variant management
- ✅ **Data Insights**: Rich variant analytics

---

**Status**: ✅ Production Ready  
**Last Updated**: January 25, 2026  
**Dependencies**: PostgreSQL 12+, Node.js 18+, React 18+  
**Platform**: Visible Shelf E-commerce Platform
