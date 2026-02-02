# Variant Components

Product variant display and selection components for the Retail Visibility Platform.

## Components

### VariantBadge

Displays variant count on product cards.

```tsx
import { VariantBadge } from '@/components/variants';

<VariantBadge variantCount={6} />
<VariantBadge variantCount={3} size="sm" showIcon={false} />
```

**Props:**
- `variantCount: number` - Number of variants
- `size?: 'sm' | 'default' | 'lg'` - Badge size (default: 'default')
- `showIcon?: boolean` - Show package icon (default: true)
- `className?: string` - Additional CSS classes

### PriceRangeDisplay

Shows price range for products with variants.

```tsx
import { PriceRangeDisplay } from '@/components/variants';

<PriceRangeDisplay 
  priceRange={{ min_cents: 1999, max_cents: 2999 }} 
/>
<PriceRangeDisplay 
  priceRange={product.price_range} 
  size="lg" 
  currency="EUR"
/>
```

**Props:**
- `priceRange: PriceRange` - Price range object with min_cents and max_cents
- `currency?: string` - Currency code (default: 'USD')
- `size?: 'sm' | 'default' | 'lg'` - Text size (default: 'default')
- `showCurrency?: boolean` - Show currency code (default: true)
- `className?: string` - Additional CSS classes

### VariantSelector

Dynamic attribute selector for product variants. Builds dropdown selectors based on available attributes.

```tsx
import { VariantSelector } from '@/components/variants';

<VariantSelector 
  availableAttributes={{ 
    color: ['Red', 'Blue', 'Green'], 
    size: ['S', 'M', 'L', 'XL'] 
  }}
  variants={variants}
  onVariantSelect={(variant) => {
    console.log('Selected variant:', variant);
  }}
/>
```

**Props:**
- `availableAttributes: AvailableAttributes` - Available attribute options
- `variants: MVVariant[]` - Array of variant objects
- `onVariantSelect?: (variant: MVVariant | null) => void` - Callback when variant selected
- `selectedAttributes?: VariantAttributes` - Initial selected attributes
- `className?: string` - Additional CSS classes

**Features:**
- Smart filtering: Only shows available options based on current selection
- Auto-matching: Finds matching variant when all attributes selected
- Stock display: Shows stock status and SKU for selected variant
- Sale badges: Displays discount percentage if on sale

### VariantInfoCard

Comprehensive variant information display in card format.

```tsx
import { VariantInfoCard } from '@/components/variants';

<VariantInfoCard product={product} />
<VariantInfoCard 
  product={product} 
  showAttributes={true}
  showPriceRange={true}
/>
```

**Props:**
- `product: ProductWithVariants` - Product with variant data
- `showPriceRange?: boolean` - Show price range (default: true)
- `showAttributes?: boolean` - Show available attributes (default: true)
- `className?: string` - Additional CSS classes

**Displays:**
- Variant count with icon
- Price range (if available)
- Available attribute options with values

## Usage Examples

### Product Card with Variant Badge

```tsx
import { VariantBadge, PriceRangeDisplay } from '@/components/variants';

function ProductCard({ product }) {
  return (
    <div className="product-card">
      <img src={product.image_url} alt={product.name} />
      <h3>{product.name}</h3>
      
      {product.has_variants ? (
        <>
          <PriceRangeDisplay priceRange={product.price_range} />
          <VariantBadge variantCount={product.variant_count} />
        </>
      ) : (
        <span>${(product.price_cents / 100).toFixed(2)}</span>
      )}
    </div>
  );
}
```

### Product Page with Variant Selector

```tsx
import { VariantSelector, VariantInfoCard } from '@/components/variants';
import { useState } from 'react';

function ProductPage({ product, variants }) {
  const [selectedVariant, setSelectedVariant] = useState(null);

  return (
    <div className="product-page">
      <h1>{product.name}</h1>
      
      {product.has_variants && (
        <div className="grid grid-cols-2 gap-4">
          <VariantSelector
            availableAttributes={product.available_attributes}
            variants={variants}
            onVariantSelect={setSelectedVariant}
          />
          
          <VariantInfoCard product={product} />
        </div>
      )}
      
      <button disabled={!selectedVariant}>
        Add to Cart
      </button>
    </div>
  );
}
```

## Data Flow

```
Backend API
    ↓
Product with computed variant fields:
  - has_variants: boolean
  - variant_count: number
  - price_range: { min_cents, max_cents, currency }
  - available_attributes: { color: [...], size: [...] }
    ↓
Frontend Components
    ↓
VariantBadge, PriceRangeDisplay, VariantSelector, VariantInfoCard
```

## Type Definitions

See `@/types/variants.ts` for complete type definitions:
- `ProductWithVariants`
- `PriceRange`
- `AvailableAttributes`
- `MVVariant`
- `VariantAttributes`

## Styling

All components use Tailwind CSS and shadcn/ui components for consistent styling. They respect the application's theme and color scheme.

## Accessibility

- Proper ARIA labels on form controls
- Keyboard navigation support
- Screen reader friendly
- Color contrast compliance
