"use client";

import { useEffect } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface ProductViewTrackerProps {
  productId: string;
  tenantId: string;
  productName?: string;
  categoryId?: string | null;
}

export function ProductViewTracker({ productId, tenantId, productName, categoryId }: ProductViewTrackerProps) {
  useEffect(() => {
    // Track product view for recommendations
    trackBehaviorClient({
      entityType: 'product',
      entityId: productId,
      entityName: productName,
      context: {
        tenant_id: tenantId,
        category_id: categoryId
      },
      pageType: 'product_page'
    });
  }, [productId, tenantId, productName, categoryId]);

  return null; // This component doesn't render anything
}
