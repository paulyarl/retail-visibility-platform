'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { CartItem } from '@/lib/cart/cartManager';

interface CartItemDisplayProps {
  item: CartItem;
  onRemove?: () => void;
  onUpdateQuantity?: (quantity: number) => void;
  showControls?: boolean;
}

export default function CartItemDisplay({
  item,
  onRemove,
  onUpdateQuantity,
  showControls = true,
}: CartItemDisplayProps) {
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const itemTotal = item.price_cents * item.quantity;

  return (
    <div className="flex gap-4 p-4 bg-white rounded-lg border border-gray-200">
      {/* Product Image */}
      {item.product_image && (
        <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
          <Image
            src={item.product_image}
            alt={item.product_name}
            width={80}
            height={80}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">
              {item.product_name}
            </h3>
            
            {/* Variant Information */}
            {item.variant_name && (
              <p className="text-sm text-gray-600 mt-1">
                {item.variant_name}
              </p>
            )}
            
            {/* Variant Attributes as Badges */}
            {item.variant_attributes && Object.keys(item.variant_attributes).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(item.variant_attributes).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium"
                  >
                    {key}: {value}
                  </span>
                ))}
              </div>
            )}

            {/* SKU */}
            {item.product_sku && (
              <p className="text-xs text-gray-500 mt-1">
                SKU: {item.product_sku}
              </p>
            )}
          </div>

          {/* Remove Button */}
          {showControls && onRemove && (
            <button
              onClick={onRemove}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors"
              aria-label="Remove item"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Price and Quantity */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-4">
            {/* Quantity Controls */}
            {showControls && onUpdateQuantity ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-8 text-center font-medium">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(item.quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            ) : (
              <span className="text-sm text-gray-600">
                Qty: {item.quantity}
              </span>
            )}

            {/* Price */}
            <div className="text-right">
              {item.list_price_cents && item.list_price_cents > item.price_cents && (
                <p className="text-xs text-gray-500 line-through">
                  {formatPrice(item.list_price_cents * item.quantity)}
                </p>
              )}
              <p className="font-semibold text-gray-900">
                {formatPrice(itemTotal)}
              </p>
              {item.discount_cents && item.discount_cents > 0 && (
                <p className="text-xs text-green-600">
                  Save {formatPrice(item.discount_cents)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
