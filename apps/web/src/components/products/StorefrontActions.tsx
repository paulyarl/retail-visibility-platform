"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, MessageSquare, ShoppingCart } from 'lucide-react';
import { useMultiCart } from '@/hooks/useMultiCart';
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
  const router = useRouter();
  const { totalItems } = useMultiCart(); // Show total items across ALL carts, not just this tenant

  const handleReview = () => {
    const reviewsSection = document.getElementById('storefront-reviews-section');
    if (reviewsSection) {
      reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleViewCart = () => {
    router.push('/carts');
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

        {/* Cart Button */}
        <button
          onClick={handleViewCart}
          className="relative inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          title="View your shopping cart"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Cart</span>
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
              {totalItems > 99 ? '99+' : totalItems}
            </span>
          )}
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
