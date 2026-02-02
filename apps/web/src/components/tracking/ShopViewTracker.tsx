"use client";

import { useEffect } from 'react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface ShopViewTrackerProps {
  tenantId: string;
  shopName?: string;
  category?: string | null;
  pageType: 'shop_directory' | 'shop_detail';
}

export function ShopViewTracker({ tenantId, shopName, category, pageType }: ShopViewTrackerProps) {
  useEffect(() => {
    // Track shop view for recommendations
    trackBehaviorClient({
      entityType: pageType === 'shop_detail' ? 'store' : 'category',
      entityId: tenantId,
      context: {
        tenant_id: tenantId,
        shop_name: shopName,
        category: category
      },
      pageType: pageType
    });
  }, [tenantId, shopName, category, pageType]);

  return null; // This component doesn't render anything
}
