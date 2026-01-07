"use client";

import Link from 'next/link';
import { BookOpen, MessageSquare } from 'lucide-react';
import ProductActions from './ProductActions';

interface StorefrontActionsProps {
  tenantId: string;
  businessName: string;
  tenantSlug?: string;
  directoryPublished?: boolean;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function StorefrontActions({ tenantId, businessName, tenantSlug, directoryPublished }: StorefrontActionsProps) {
  const handleReview = () => {
    const reviewsSection = document.getElementById('storefront-reviews-section');
    if (reviewsSection) {
      reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  return (
    <div className="flex items-center justify-between gap-4">
      {/* View in Directory Button - Left side */}
      <div className="flex items-center gap-2">
        {directoryPublished && tenantSlug && (
          <Link
            href={`/directory/${tenantSlug}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
            title="View this store's full directory listing"
          >
            <BookOpen className="w-4 h-4" />
            <span>View in Directory</span>
          </Link>
        )}

        {/* Review Button */}
        <button
          onClick={handleReview}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
          title="Read and write reviews"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Review</span>
        </button>
      </div>
      
      {/* Product Actions (Print & Share) - Right side */}
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
