'use client';

import { useRouter } from 'next/navigation';
import { useMultiCart } from '@/hooks/useMultiCart';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Store, ArrowRight, Eye } from 'lucide-react';

export function MultiCartPane() {
  const router = useRouter();
  const { carts } = useMultiCart();

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Don't show if no carts
  if (carts.length === 0) {
    return null;
  }

  // Calculate totals across all carts
  const totalItems = carts.reduce((sum, cart) => sum + cart.item_count, 0);
  const totalAcrossAllCarts = carts.reduce((sum, cart) => sum + cart.total_cents, 0);

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">
              {carts.length === 1 ? 'Your Shopping Cart' : 'Your Shopping Carts'}
            </h3>
          </div>
          {carts.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/carts')}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
            >
              <Eye className="h-4 w-4 mr-1" />
              View All
            </Button>
          )}
        </div>

        {/* Summary */}
        <div className="mb-3 pb-3 border-b border-blue-200">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{formatCurrency(totalAcrossAllCarts)}</span>
            <span className="text-sm text-gray-600">
              {carts.length === 1 
                ? `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`
                : `across ${carts.length} stores • ${totalItems} items`
              }
            </span>
          </div>
        </div>

        {/* Cart List (compact) */}
        <div className="space-y-2">
          {carts.slice(0, 3).map((cartSummary) => (
            <div
              key={cartSummary.key}
              className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/carts/checkout`)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Gateway Icon */}
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  <Store className="h-5 w-5 text-gray-400" />
                </div>

                {/* Cart Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {cartSummary.cart.tenant_name} - {cartSummary.cart.gateway_type}
                  </p>
                  <p className="text-sm text-gray-600">
                    {cartSummary.item_count} {cartSummary.item_count === 1 ? 'item' : 'items'} • {formatCurrency(cartSummary.total_cents)}
                  </p>
                </div>
              </div>

              {/* View Button */}
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/carts/checkout`);
                }}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Show more indicator */}
          {carts.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/carts')}
              className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-100"
            >
              +{carts.length - 3} more {carts.length - 3 === 1 ? 'cart' : 'carts'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
