/**
 * Featured Type Badges Component
 * Displays one or multiple featured type badges
 */

'use client';

import { FeaturedTypeInfo } from '@/types/product-display';
import { Badge } from '@/components/ui/Badge';

interface FeaturedTypeBadgesProps {
  featuredTypes: FeaturedTypeInfo[];
  maxVisible?: number;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

export function FeaturedTypeBadges({ 
  featuredTypes, 
  maxVisible = 2, 
  className = '',
  size = 'xs'
}: FeaturedTypeBadgesProps) {
  if (!featuredTypes || featuredTypes.length === 0) {
    return null;
  }

  const visibleTypes = featuredTypes.slice(0, maxVisible);
  const hasMore = featuredTypes.length > maxVisible;
  const remainingCount = featuredTypes.length - maxVisible;

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-md'
  };

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visibleTypes.map((featuredType, index) => (
        <Badge
          key={`${featuredType.type}-${index}`}
          variant={featuredType.color as any}
          className={`${sizeClasses[size]}`}
        >
          {featuredType.icon} {featuredType.label}
        </Badge>
      ))}
      
      {hasMore && (
        <Badge variant="default" className={`${sizeClasses[size]}`}>
          +{remainingCount} more
        </Badge>
      )}
    </div>
  );
}
