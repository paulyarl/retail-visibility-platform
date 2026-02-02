/**
 * Sale Price Component
 * Displays sale pricing with discount information
 */

'use client';

import { getSalePricing } from '@/types/product-display';
import { Badge } from '@/components/ui/Badge';

interface SalePriceProps {
  product: any;
  variant?: 'compact' | 'card' | 'featured' | 'detail';
  showOriginalPrice?: boolean;
  showDiscountPercentage?: boolean;
  showDiscountAmount?: boolean;
  className?: string;
}

export function SalePrice({ 
  product, 
  variant = 'card',
  showOriginalPrice = true,
  showDiscountPercentage = true,
  showDiscountAmount = false,
  className = ''
}: SalePriceProps) {
  const salePricing = getSalePricing(product);

  if (!salePricing.isOnSale) {
    // Not on sale, show regular price
    return (
      <div className={`font-bold text-gray-900 ${className}`}>
        {salePricing.regularPrice.formatted}
      </div>
    );
  }

  const variantStyles = {
    compact: 'text-sm',
    card: 'text-xl',
    featured: 'text-2xl',
    detail: 'text-3xl'
  };

  const sizeClasses = variantStyles[variant] || variantStyles.card;

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Sale Price */}
      <div className="flex items-center gap-2">
        <span className={`font-bold text-red-600 ${sizeClasses}`}>
          {salePricing.salePrice!.formatted}
        </span>
        
        {/* Discount Badge */}
        {(showDiscountPercentage || showDiscountAmount) && (
          <Badge variant="error" className="text-xs">
            {showDiscountPercentage && salePricing.discountPercentage && (
              <span>{salePricing.discountPercentage}% OFF</span>
            )}
            {showDiscountPercentage && showDiscountAmount && salePricing.discountPercentage && (
              <span> • </span>
            )}
            {showDiscountAmount && salePricing.discountAmount && (
              <span>Save {salePricing.discountAmount.formatted}</span>
            )}
          </Badge>
        )}
      </div>

      {/* Original Price */}
      {showOriginalPrice && (
        <div className="flex items-center gap-2">
          <span className={`text-gray-500 line-through ${variant === 'compact' ? 'text-xs' : 'text-sm'}`}>
            {salePricing.regularPrice.formatted}
          </span>
        </div>
      )}
    </div>
  );
}
