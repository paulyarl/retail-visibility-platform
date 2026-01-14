'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn-tooltip';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
}

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  platformFee: number;
  shipping: number;
  total: number;
  fulfillmentMethod?: 'pickup' | 'delivery' | 'shipping';
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function OrderSummary({
  items,
  subtotal,
  platformFee,
  shipping,
  total,
  fulfillmentMethod,
}: OrderSummaryProps) {
  const getFulfillmentLabel = () => {
    if (!fulfillmentMethod) return 'Fulfillment';
    if (fulfillmentMethod === 'pickup') return 'Pickup';
    if (fulfillmentMethod === 'delivery') return 'Delivery';
    return 'Shipping';
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cart Items */}
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4">
              <div className="relative w-16 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-xs">No image</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium truncate">{item.name}</h4>
                <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
              </div>
              <div className="text-sm font-medium">
                {formatCurrency(item.unitPrice * item.quantity)}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Price Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-1">
              <span className="text-gray-600">Platform Fee</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Platform fee helps us maintain and improve our services.
                      This fee goes towards payment processing, security, and platform operations.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span>{formatCurrency(platformFee)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{getFulfillmentLabel()}</span>
            <span className={shipping === 0 ? 'text-green-600 font-semibold' : ''}>
              {shipping === 0 ? 'FREE' : formatCurrency(shipping)}
            </span>
          </div>
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>

        {/* Security Badge */}
        <div className="pt-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Secure checkout powered by Square & PayPal</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
