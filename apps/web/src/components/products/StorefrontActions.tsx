"use client";

import ProductActions from './ProductActions';
import Link from 'next/link';
import { Button, Tooltip } from '@/components/ui';

interface StorefrontActionsProps {
  tenantId: string;
  businessName: string;
  tenantSlug?: string;
  directoryPublished?: boolean; // Add directory publish status
}

export default function StorefrontActions({ tenantId, businessName, tenantSlug, directoryPublished }: StorefrontActionsProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Directory Link - Dynamic based on publish status */}
      {directoryPublished ? (
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
      ) : (
        <Tooltip content="This store hasn't been published to the public directory yet. Click to discover other stores in the directory.">
          <Link href="/directory" className="flex items-center gap-2 px-3 py-2 border-neutral-300 text-neutral-400 hover:bg-neutral-50 transition-colors rounded-lg text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Directory Not Published →
          </Link>
        </Tooltip>
      )}

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
