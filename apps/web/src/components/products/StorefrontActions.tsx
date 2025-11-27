"use client";

import ProductActions from './ProductActions';
import Link from 'next/link';

interface StorefrontActionsProps {
  tenantId: string;
  businessName: string;
  tenantSlug?: string;
}

export default function StorefrontActions({ tenantId, businessName, tenantSlug }: StorefrontActionsProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Directory Link */}
      <Link
        href={`/directory/${tenantSlug || tenantId}`}
        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
        title="View this store in the directory"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        View in Directory
      </Link>

      {/* Product Actions (Print & Share) */}
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
