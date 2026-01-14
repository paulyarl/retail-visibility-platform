'use client';

import { useMultiCart } from '@/hooks/useMultiCart';
import { useCartWidget } from '@/contexts/CartWidgetContext';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Minimize2, Maximize2, Eye, EyeOff } from 'lucide-react';

interface CartControlButtonProps {
  variant?: 'icon' | 'full';
  className?: string;
}

export function CartControlButton({ variant = 'full' }: { variant?: 'icon' | 'full' }) {
  const { carts } = useMultiCart();
  const { widgetState, toggleExpanded, minimize, hide, show } = useCartWidget();

  // Don't show if no carts
  if (carts.length === 0) {
    return null;
  }

  // Calculate totals across all carts
  const totalItems = carts.reduce((sum, cart) => sum + cart.item_count, 0);
  const totalAcrossAllCarts = carts.reduce((sum, cart) => sum + cart.total_cents, 0);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="flex items-center gap-2">
      {/* Cart Summary (when minimized or hidden) */}
      {widgetState !== 'expanded' && (
        <>
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
            <ShoppingCart className="h-4 w-4 text-blue-600" />
            <div className="text-sm">
              <span className="font-semibold text-gray-900">{totalItems}</span>
              <span className="text-gray-600 ml-1">
                {totalItems === 1 ? 'item' : 'items'}
              </span>
              {carts.length > 1 && (
                <span className="text-gray-500 ml-1">
                  • {carts.length} {carts.length === 1 ? 'cart' : 'carts'}
                </span>
              )}
            </div>
          </div>

          {/* Cart Control Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="h-8 px-3"
              title="Expand Cart"
            >
              <Maximize2 className="h-4 w-4 mr-1" />
              <span className="text-sm">Expand</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => widgetState === 'hidden' ? show() : hide()}
              className="text-gray-600 hover:text-gray-900"
            >
              {widgetState === 'hidden' ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show Cart
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
