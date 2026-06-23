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
  platformFeePercentage?: number;
  shipping: number;
  total: number;
  tax?: number;
  fulfillmentMethod?: 'pickup' | 'delivery' | 'shipping';
  // Tier 3 Commitment - Deposit fields
  checkoutMode?: 'deposit' | 'full_payment' | 'disabled';
  depositOption?: 'required' | 'optional' | 'none';
  depositAmount?: number;
  remainingBalance?: number;
  depositPercentage?: number;
  pickupDeadline?: Date;
  onCheckoutModeChange?: (mode: 'deposit' | 'full_payment') => void;
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
  platformFeePercentage = 3.0,
  shipping,
  total,
  tax = 0,
  fulfillmentMethod,
  // Tier 3 Commitment - Deposit fields
  checkoutMode,
  depositOption = 'none',
  depositAmount,
  remainingBalance,
  depositPercentage,
  pickupDeadline,
  onCheckoutModeChange,
}: OrderSummaryProps) {
  const getFulfillmentLabel = () => {
    if (!fulfillmentMethod) return 'Fulfillment';
    if (fulfillmentMethod === 'pickup') return 'Pickup';
    if (fulfillmentMethod === 'delivery') return 'Delivery';
    return 'Shipping';
  };

  const isDepositCheckout = checkoutMode === 'deposit';
  const formatPickupDeadline = () => {
    if (!pickupDeadline) return '';
    const deadline = new Date(pickupDeadline);
    return deadline.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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

          {platformFee > 0 && (
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1">
                <span className="text-gray-600">Platform Fee ({platformFeePercentage}%)</span>
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
          )}

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{getFulfillmentLabel()}</span>
            <span className={shipping === 0 ? 'text-green-600 font-semibold' : ''}>
              {shipping === 0 ? 'FREE' : formatCurrency(shipping)}
            </span>
          </div>

          {tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax</span>
              <span>{formatCurrency(tax)}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Checkout Mode Selection for Professional/Enterprise */}
        {depositOption === 'optional' && onCheckoutModeChange && (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Payment Option</h4>
            <p className="text-xs text-gray-600">Choose how you'd like to pay for this order</p>
            
            <div className="space-y-2">
              {/* Full Payment Option */}
              <button
                onClick={() => onCheckoutModeChange('full_payment')}
                className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                  checkoutMode === 'full_payment'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Pay Full Amount</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Pay {formatCurrency(total)} now
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    checkoutMode === 'full_payment' ? 'border-primary-600 bg-primary-600' : 'border-gray-300'
                  }`}>
                    {checkoutMode === 'full_payment' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
              
              {/* Deposit Option */}
              <button
                onClick={() => onCheckoutModeChange('deposit')}
                className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                  checkoutMode === 'deposit'
                    ? 'border-amber-600 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Reserve with Deposit</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Pay {depositPercentage}% now ({formatCurrency(depositAmount || 0)}), balance at pickup
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    checkoutMode === 'deposit' ? 'border-amber-600 bg-amber-600' : 'border-gray-300'
                  }`}>
                    {checkoutMode === 'deposit' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Tier 3 Commitment - Deposit Breakdown */}
        {isDepositCheckout && depositAmount && remainingBalance && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900">Commitment Checkout</h4>
                  <p className="text-xs text-amber-700 mt-1">
                    Pay a {depositPercentage}% deposit now to reserve your items. 
                    Remaining balance due at pickup.
                  </p>
                </div>
              </div>
              
              <div className="space-y-2 pt-2 border-t border-amber-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Order Value</span>
                  <span className="font-medium">{formatCurrency(total)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">Deposit Due Now ({depositPercentage}%)</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">
                            This deposit reserves your items. It will be credited toward your purchase at pickup.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className="font-semibold text-amber-600">{formatCurrency(depositAmount)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Balance Due at Pickup</span>
                  <span className="font-medium">{formatCurrency(remainingBalance)}</span>
                </div>
              </div>
              
              {pickupDeadline && (
                <div className="pt-2 border-t border-amber-200">
                  <p className="text-xs text-amber-700">
                    <strong>Pickup by:</strong> {formatPickupDeadline()}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Deposit is forfeited if not picked up within 48 hours.
                  </p>
                </div>
              )}
            </div>
            
            <Separator />
          </>
        )}

        {/* Total */}
        <div className="flex justify-between text-lg font-bold">
          <span>{isDepositCheckout ? 'Amount Due Now' : 'Total'}</span>
          <span>{formatCurrency(isDepositCheckout && depositAmount ? depositAmount : total)}</span>
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
            <span>Secure checkout powered by PayPal, Stripe & Square</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
