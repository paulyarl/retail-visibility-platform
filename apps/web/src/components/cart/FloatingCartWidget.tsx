'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiCart } from '@/hooks/useMultiCart';
import { useCartWidget } from '@/contexts/CartWidgetContext';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, X, Store, ArrowRight, ChevronDown, ChevronUp, Minimize2, Maximize2 } from 'lucide-react';

export function FloatingCartWidget() {
  const router = useRouter();
  const { carts } = useMultiCart();
  const { widgetState, setWidgetState } = useCartWidget();
  
  // Calculate totals across all carts
  const totalItems = carts.reduce((sum, cart) => sum + cart.item_count, 0);
  const totalAcrossAllCarts = carts.reduce((sum, cart) => sum + cart.total_cents, 0);
  
  // Auto-expand when first item is added
  useEffect(() => {
    if (carts.length > 0 && widgetState === 'minimized') {
      // Only auto-expand once
      const hasAutoExpanded = sessionStorage.getItem('cart-auto-expanded');
      if (!hasAutoExpanded && totalItems === 1) {
        setWidgetState('expanded');
        sessionStorage.setItem('cart-auto-expanded', 'true');
        // Auto-minimize after 3 seconds
        setTimeout(() => {
          setWidgetState('minimized');
        }, 3000);
      }
    }
  }, [carts.length, totalItems, widgetState, setWidgetState]);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Don't show if no carts
  if (carts.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Cart Widget - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Expanded Cart Panel */}
        {widgetState === 'expanded' && (
          <div className="mb-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 animate-in slide-in-from-bottom-4 duration-200">
            {/* Header with Action Bar */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {carts.length === 1 ? 'Shopping Cart' : `${carts.length} Shopping Carts`}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {totalItems} {totalItems === 1 ? 'item' : 'items'} • {formatCurrency(totalAcrossAllCarts)}
                  </p>
                </div>
              </div>
              
              {/* Action Bar */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWidgetState('minimized')}
                  className="h-8 w-8 p-0 hover:bg-blue-100"
                  title="Minimize"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWidgetState('hidden')}
                  className="h-8 w-8 p-0 hover:bg-blue-100"
                  title="Hide"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Cart List */}
            <div className="max-h-96 overflow-y-auto">
              {carts.map((cartSummary) => (
                <div
                  key={cartSummary.key}
                  className="p-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                  onClick={() => {
                    setWidgetState('minimized');
                    router.push(`/carts/checkout`);
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Gateway Icon */}
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      <Store className="h-6 w-6 text-gray-400" />
                    </div>

                    {/* Cart Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {cartSummary.cart.tenant_name} - {cartSummary.cart.gateway_type}
                      </p>
                      <p className="text-sm text-gray-600">
                        {cartSummary.item_count} {cartSummary.item_count === 1 ? 'item' : 'items'}
                      </p>
                    </div>

                    {/* Price & Arrow */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="font-semibold text-gray-900">{formatCurrency(cartSummary.total_cents)}</p>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <Button
                onClick={() => {
                  setWidgetState('minimized');
                  router.push('/carts');
                }}
                className="w-full"
              >
                View All Carts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Floating Cart Button - Shows when minimized or hidden */}
        {widgetState !== 'expanded' && (
          <button
            onClick={() => setWidgetState(widgetState === 'hidden' ? 'minimized' : 'expanded')}
            className={`relative h-16 w-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
              widgetState === 'hidden' ? 'opacity-50 hover:opacity-100' : ''
            }`}
            aria-label="Shopping Cart"
            title={widgetState === 'hidden' ? 'Show Cart' : 'Open Cart'}
          >
            {widgetState === 'hidden' ? (
              <Maximize2 className="h-7 w-7" />
            ) : (
              <ShoppingCart className="h-7 w-7" />
            )}
          
            {/* Badge with item count - only show when not hidden */}
            {totalItems > 0 && widgetState !== 'hidden' && (
              <div className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                {totalItems > 99 ? '99+' : totalItems}
              </div>
            )}

            {/* Multiple carts indicator - only show when not hidden */}
            {carts.length > 1 && widgetState !== 'hidden' && (
              <div className="absolute -bottom-1 -left-1 h-5 px-2 bg-indigo-600 text-white text-xs font-semibold rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                {carts.length}
              </div>
            )}
          </button>
        )}
      </div>
    </>
  );
}
