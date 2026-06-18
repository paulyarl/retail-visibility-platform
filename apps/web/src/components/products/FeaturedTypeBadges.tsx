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
  clickable?: boolean;
  showAll?: boolean;
}

export function FeaturedTypeBadges({
  featuredTypes,
  maxVisible = 2,
  className = '',
  size = 'xs',
  clickable = false,
  showAll = false,
}: FeaturedTypeBadgesProps) {
  if (!featuredTypes || featuredTypes.length === 0) {
    return null;
  }

  const visibleTypes = showAll ? featuredTypes : featuredTypes.slice(0, maxVisible);
  const hasMore = !showAll && featuredTypes.length > maxVisible;
  const remainingCount = featuredTypes.length - maxVisible;

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-md'
  };

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visibleTypes.map((featuredType, index) => {
        const badge = (
          <Badge
            variant={featuredType.color as any}
            className={`${sizeClasses[size]}`}
          >
            {featuredType.icon} {featuredType.label}
          </Badge>
        );

        if (clickable) {
          return (
            <a
              key={`${featuredType.type}-${index}`}
              href={`#featured-${featuredType.type}`}
              onClick={(e) => {
                e.preventDefault();
                window.location.hash = `featured-${featuredType.type}`;
              }}
              className="cursor-pointer no-underline"
            >
              {badge}
            </a>
          );
        }

        return <span key={`${featuredType.type}-${index}`}>{badge}</span>;
      })}

      {hasMore && (
        <Badge variant="default" className={`${sizeClasses[size]}`}>
          +{remainingCount} more
        </Badge>
      )}
    </div>
  );
}
