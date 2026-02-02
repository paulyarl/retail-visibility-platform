'use client';

import { Badge } from '@/components/ui/Badge';
import { Package } from 'lucide-react';

interface VariantBadgeProps {
  variantCount: number;
  size?: 'sm' | 'default' | 'lg';
  showIcon?: boolean;
  className?: string;
}

/**
 * VariantBadge - Displays variant count on product cards
 * 
 * Usage:
 * <VariantBadge variantCount={6} />
 * <VariantBadge variantCount={3} size="sm" showIcon={false} />
 */
export function VariantBadge({ 
  variantCount, 
  size = 'default',
  showIcon = true,
  className = ''
}: VariantBadgeProps) {
  if (variantCount === 0) return null;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    default: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 12,
    default: 14,
    lg: 16
  };

  return (
    <Badge 
      variant="info" 
      className={`${sizeClasses[size]} font-medium ${className}`}
    >
      {showIcon && (
        <Package 
          className="mr-1 inline-block" 
          size={iconSizes[size]} 
        />
      )}
      <span>{variantCount} {variantCount === 1 ? 'variant' : 'variants'}</span>
    </Badge>
  );
}
