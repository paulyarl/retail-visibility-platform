'use client';

import { Suspense } from 'react';
import { useMultiCart } from '@/hooks/useMultiCart';
import MultiCartCheckout from '@/components/cart/MultiCartCheckout';

function MultiCartCheckoutContent() {
  const { carts, clearCart } = useMultiCart();

  const handleCartProcessed = (tenantId: string, gatewayType: string) => {
    clearCart(tenantId, gatewayType);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <MultiCartCheckout 
          carts={carts}
          onCartProcessed={handleCartProcessed}
        />
      </div>
    </div>
  );
}

export default function MultiCartCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    }>
      <MultiCartCheckoutContent />
    </Suspense>
  );
}
