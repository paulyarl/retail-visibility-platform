/**
 * Multi-Cart Checkout Component
 * Displays all carts grouped by tenant + gateway type
 * Allows sequential checkout processing
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { CartSummary } from '@/lib/cart/cartManager';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface MultiCartCheckoutProps {
  carts: CartSummary[];
  onCartProcessed: (tenantId: string, gatewayType: string) => void;
}

interface CheckoutStatus {
  [key: string]: 'pending' | 'processing' | 'success' | 'error';
}

export default function MultiCartCheckout({ carts, onCartProcessed }: MultiCartCheckoutProps) {
  const router = useRouter();
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getGatewayIcon = (gatewayType: string) => {
    switch (gatewayType.toLowerCase()) {
      case 'square':
        return (
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        );
      case 'paypal':
        return (
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        );
    }
  };

  const getGatewayLabel = (gatewayType: string) => {
    switch (gatewayType.toLowerCase()) {
      case 'square':
        return 'Square';
      case 'paypal':
        return 'PayPal';
      default:
        return gatewayType.charAt(0).toUpperCase() + gatewayType.slice(1);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleCheckout = async (cartSummary: CartSummary) => {
    const { cart } = cartSummary;
    const statusKey = `${cart.tenant_id}_${cart.gateway_type}`;

    setCheckoutStatus(prev => ({ ...prev, [statusKey]: 'processing' }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[statusKey];
      return newErrors;
    });

    try {
      // Navigate to checkout page with cart context
      const params = new URLSearchParams({
        tenantId: cart.tenant_id,
        gatewayType: cart.gateway_type,
        cartKey: cartSummary.key
      });

      router.push(`/checkout?${params.toString()}`);
    } catch (error: any) {
      console.error('[MultiCartCheckout] Checkout failed:', error);
      setCheckoutStatus(prev => ({ ...prev, [statusKey]: 'error' }));
      setErrors(prev => ({ ...prev, [statusKey]: error.message || 'Checkout failed' }));
    }
  };

  const getStatusIcon = (statusKey: string) => {
    const status = checkoutStatus[statusKey];
    
    switch (status) {
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-600" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  if (carts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Your carts are empty</h3>
        <p className="text-gray-600 mb-6">Add some items to get started</p>
        <Button onClick={() => router.push('/')}>
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Options */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push('/carts')}
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          View All Carts
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push('/directory')}
        >
          Continue Shopping
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1>
        <p className="text-gray-600">
          You have {carts.length} cart{carts.length !== 1 ? 's' : ''} ready for checkout
        </p>
      </div>

      {carts.map((cartSummary) => {
        const { cart, item_count, total_cents } = cartSummary;
        const statusKey = `${cart.tenant_id}_${cart.gateway_type}`;
        const status = checkoutStatus[statusKey];
        const error = errors[statusKey];

        return (
          <Card key={cartSummary.key} className="overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getGatewayIcon(cart.gateway_type)}
                  <div>
                    <CardTitle className="text-lg">
                      {getGatewayLabel(cart.gateway_type)} Cart
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {cart.tenant_name}
                    </p>
                  </div>
                </div>
                {getStatusIcon(statusKey)}
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {/* Cart Items */}
              <div className="space-y-4 mb-6">
                {cart.items.map((item, index) => (
                  <div key={`${item.product_id}_${index}`} className="flex items-start gap-4">
                    {item.product_image && (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.product_name}</h4>
                      {item.gateway_display_name && (
                        <p className="text-sm text-gray-500">
                          via {item.gateway_display_name}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatPrice(item.price_cents * item.quantity)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatPrice(item.price_cents)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items</span>
                  <span className="text-gray-900">{item_count}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{formatPrice(total_cents)}</span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Checkout Button */}
              <div className="mt-6">
                <Button
                  onClick={() => handleCheckout(cartSummary)}
                  disabled={status === 'processing' || status === 'success'}
                  className="w-full"
                  size="lg"
                >
                  {status === 'processing' && (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  )}
                  {status === 'success' && (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Completed
                    </>
                  )}
                  {!status && (
                    <>
                      Checkout with {getGatewayLabel(cart.gateway_type)}
                    </>
                  )}
                  {status === 'error' && (
                    <>
                      Retry Checkout
                    </>
                  )}
                </Button>
              </div>

              {/* Payment Method Info */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💳 This cart will be processed using {getGatewayLabel(cart.gateway_type)}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Summary Footer */}
      <Card className="bg-gray-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Total Across All Carts
              </h3>
              <p className="text-sm text-gray-600">
                {carts.reduce((sum, c) => sum + c.item_count, 0)} items in {carts.length} cart{carts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(carts.reduce((sum, c) => sum + c.total_cents, 0))}
              </p>
              <p className="text-sm text-gray-600">
                {carts.length} separate payment{carts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Multiple Carts:</strong> Each cart will be processed separately with its designated payment method. 
          You can checkout one cart at a time, and return to complete the others when ready.
        </p>
      </div>
    </div>
  );
}
