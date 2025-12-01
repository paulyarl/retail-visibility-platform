"use client";

import ProductActions from './ProductActions';

interface StorefrontActionsProps {
  tenantId: string;
  businessName: string;
  tenantSlug?: string;
  directoryPublished?: boolean; // Add directory publish status
}

export default function StorefrontActions({ tenantId, businessName, tenantSlug, directoryPublished }: StorefrontActionsProps) {
  return (
    <div className="flex items-center justify-end gap-4">
      {/* Product Actions (Print & Share only - Directory link moved to header badges) */}
      <ProductActions
        product={{
          id: `storefront-${tenantId}`,
          name: businessName,
          title: businessName,
          brand: businessName,
          price: 0,
          currency: 'USD',
          sku: '',
          tenantId,
        }}
        tenant={{
          id: tenantId,
          name: businessName,
          metadata: { businessName }
        }}
        productUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/tenant/${tenantId}`}
        variant="storefront"
      />
    </div>
  );
}
