"use client";

import { useEffect } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface ProductCardTrackerProps {
  productId: string;
  tenantId: string;
  productName?: string;
  category?: string | null;
  featuredType?: string | null;
  position?: number;
  source: 'directory' | 'featured' | 'search' | 'category' | 'storefront';
  searchQuery?: string;
}

export function ProductCardTracker({ 
  productId, 
  tenantId, 
  productName, 
  category, 
  featuredType, 
  position, 
  source,
  searchQuery 
}: ProductCardTrackerProps) {
  const handleProductClick = () => {
    trackBehaviorClient({
      entityType: 'product',
      entityId: productId,
      context: {
        tenant_id: tenantId,
        product_name: productName,
        category: category,
        featured_type: featuredType,
        position: position,
        source: source,
        search_query: searchQuery
      },
      pageType: source === 'storefront' ? 'storefront' : 'directory_home'
    });
  };

  return { handleProductClick };
}
