'use client';

import { ProductWithVariants } from '@/types/variants';
import { VariantBadge } from './VariantBadge';
import { PriceRangeDisplay } from './PriceRangeDisplay';
import { Card, CardContent } from '@/components/ui/Card';
import { Package, DollarSign, Tag } from 'lucide-react';

interface VariantInfoCardProps {
  product: ProductWithVariants;
  showPriceRange?: boolean;
  showAttributes?: boolean;
  className?: string;
}

/**
 * VariantInfoCard - Displays comprehensive variant information for a product
 * 
 * Shows variant count, price range, and available attributes in a card format.
 * 
 * Usage:
 * <VariantInfoCard product={product} />
 * <VariantInfoCard product={product} showAttributes={true} />
 */
export function VariantInfoCard({ 
  product,
  showPriceRange = true,
  showAttributes = true,
  className = ''
}: VariantInfoCardProps) {
  if (!product.has_variants || !product.variant_count) {
    return null;
  }

  return (
    <Card className={className}>
      <CardContent className="pt-6 space-y-4">
        {/* Variant Count */}
        <div className="flex items-center gap-2">
          <Package className="text-muted-foreground" size={20} />
          <div>
            <p className="text-sm font-medium">Available Variants</p>
            <p className="text-2xl font-bold">{product.variant_count}</p>
          </div>
        </div>

        {/* Price Range */}
        {showPriceRange && product.price_range && (
          <div className="flex items-center gap-2">
            <DollarSign className="text-muted-foreground" size={20} />
            <div>
              <p className="text-sm font-medium">Price Range</p>
              <PriceRangeDisplay 
                priceRange={product.price_range} 
                size="lg"
              />
            </div>
          </div>
        )}

        {/* Available Attributes */}
        {showAttributes && product.available_attributes && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="text-muted-foreground" size={20} />
              <p className="text-sm font-medium">Available Options</p>
            </div>
            <div className="space-y-2 pl-7">
              {Object.entries(product.available_attributes).map(([attr, values]) => (
                <div key={attr} className="text-sm">
                  <span className="font-medium capitalize">
                    {attr.replace('_', ' ')}:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {values.map(value => (
                      <span 
                        key={value}
                        className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-md text-xs"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
