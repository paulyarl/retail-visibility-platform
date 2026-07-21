'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, XCircle, CheckCircle, CreditCard } from 'lucide-react';
import { clearCart } from '@/lib/cart/cartManager';
import { checkoutService } from '@/services/CheckoutService';
import { customerAuthService } from '@/services/CustomerAuthService';
import { customerPaymentMethodsService } from '@/services/CustomerPaymentMethodsService';
import { Button } from '@/components/ui/Button';
import { clientLogger } from '@/lib/client-logger';

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [order, setOrder] = useState<any | null>(null);
  const [showDigitalConfirmation, setShowDigitalConfirmation] = useState(false);
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestTenantId, setGuestTenantId] = useState<string>('');
  const [guestGatewayType, setGuestGatewayType] = useState<string>('');
  const [guestPaymentToken, setGuestPaymentToken] = useState<string>('');
  const [guestCardLast4, setGuestCardLast4] = useState<string | undefined>();
  const [guestCardBrand, setGuestCardBrand] = useState<string | undefined>();
  const [guestExpiryMonth, setGuestExpiryMonth] = useState<number | undefined>();
  const [guestExpiryYear, setGuestExpiryYear] = useState<number | undefined>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const paymentIntentId = searchParams?.get('payment_intent');
  const redirectStatus = searchParams?.get('redirect_status');
  const clientSecret = searchParams?.get('payment_intent_client_secret');

  useEffect(() => {
    const confirmPaymentAndRedirect = async () => {
      if (!paymentIntentId || redirectStatus !== 'succeeded') {
        setError('Invalid payment redirect. Please contact support.');
        return;
      }

      try {
        // Confirm the payment using service
        const confirmResult = await checkoutService.confirmStripePayment(paymentIntentId, clientSecret || undefined);

        if (!confirmResult?.orderId) {
          throw new Error('Failed to confirm payment');
        }

        // Fetch order details using service
        const order = await checkoutService.getOrder(confirmResult.orderId);
        setOrder(order);

        if (order) {
          if (order.customer_email) {
            localStorage.setItem('buyer_email', order.customer_email);
          }
          if (order.customer_phone) {
            localStorage.setItem('buyer_phone', order.customer_phone);
          }
        }

        // Clear the cart after successful order
        try {
          const tenantId = order?.tenant_id;
          if (tenantId) {
            clearCart(tenantId);
          }
          window.dispatchEvent(new Event('cart-updated'));
        } catch (err) {
          clientLogger.error('[Checkout Success] Failed to clear cart:', { detail: err });
        }

        // Check for post-purchase funnel upsell step
        if (confirmResult.funnelNextStep && confirmResult.funnelNextStep.stepId) {
          const fs = confirmResult.funnelNextStep;
          const params = new URLSearchParams({
            tenantId: order?.tenant_id || '',
            funnelId: fs.funnelId,
          });
          router.replace(`/checkout/funnel/${confirmResult.orderId}/step/${fs.stepId}?${params.toString()}`);
          return;
        }

        // Check if user wanted to save payment method before redirect
        const shouldSavePaymentMethod = sessionStorage.getItem('checkout_savePaymentMethod') === 'true';
        const saveTenantId = sessionStorage.getItem('checkout_tenantId');
        const saveGatewayType = sessionStorage.getItem('checkout_gatewayType');

        if (shouldSavePaymentMethod && saveTenantId && saveGatewayType) {
          sessionStorage.removeItem('checkout_savePaymentMethod');
          sessionStorage.removeItem('checkout_tenantId');
          sessionStorage.removeItem('checkout_gatewayType');

          const isLoggedIn = customerAuthService.isAuthenticated();
          // Use PaymentMethod ID from backend if available, fallback to paymentIntentId
          const paymentMethodToken = confirmResult.paymentMethodId || paymentIntentId;
          if (isLoggedIn) {
            try {
              await customerPaymentMethodsService.addPaymentMethod({
                tenantId: saveTenantId,
                gatewayType: saveGatewayType as 'stripe' | 'square' | 'paypal',
                paymentMethodToken,
                type: 'card',
                cardLast4: confirmResult.cardLast4,
                cardBrand: confirmResult.cardBrand,
                expiryMonth: confirmResult.expiryMonth,
                expiryYear: confirmResult.expiryYear ? String(confirmResult.expiryYear) : undefined,
              });
              console.log('[Checkout Success] Payment method saved successfully');
            } catch (err) {
              clientLogger.error('[Checkout Success] Failed to save payment method:', { detail: err });
            }
            // Redirect to orders
            router.replace('/account/orders');
          } else {
            // Guest user — show account creation prompt on this page
            setGuestEmail(order?.customer_email || '');
            setGuestTenantId(saveTenantId);
            setGuestGatewayType(saveGatewayType);
            setGuestPaymentToken(paymentMethodToken);
            setGuestCardLast4(confirmResult.cardLast4);
            setGuestCardBrand(confirmResult.cardBrand);
            setGuestExpiryMonth(confirmResult.expiryMonth);
            setGuestExpiryYear(confirmResult.expiryYear);
            setShowGuestPrompt(true);
          }
        } else {
          // No save intent — check for digital order before redirect
          const isLoggedIn = customerAuthService.isAuthenticated();
          const hasDigital = order?.order_items?.some(
            (i: any) => i.product_type === 'digital' || i.product?.product_type === 'digital' || i.is_digital
          );
          if (hasDigital) {
            setShowDigitalConfirmation(true);
            return;
          }
          router.replace(isLoggedIn ? '/account/orders' : '/my-orders');
        }
      } catch (err: any) {
        clientLogger.error('[Checkout Success] Error:', { detail: err });
        setError(err.message || 'Failed to process payment confirmation');
      }
    };

    confirmPaymentAndRedirect();
  }, [paymentIntentId, redirectStatus, clientSecret, router]);

  const handleCreateAccount = async () => {
    setCreateError(null);

    if (!guestEmail) {
      setCreateError('Email is required');
      return;
    }

    if (password.length < 8) {
      setCreateError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setCreateError('Passwords do not match');
      return;
    }

    setIsCreating(true);

    try {
      const result = await customerAuthService.register(guestEmail, password);

      if (!result.success) {
        setCreateError(result.error || 'Failed to create account');
        setIsCreating(false);
        return;
      }

      // Account created and logged in — save the payment method
      if (guestPaymentToken) {
        try {
          await customerPaymentMethodsService.addPaymentMethod({
            tenantId: guestTenantId,
            gatewayType: guestGatewayType as 'stripe' | 'square' | 'paypal',
            paymentMethodToken: guestPaymentToken,
            type: 'card',
            cardLast4: guestCardLast4,
            cardBrand: guestCardBrand,
            expiryMonth: guestExpiryMonth,
            expiryYear: guestExpiryYear ? String(guestExpiryYear) : undefined,
          });
        } catch (err) {
          clientLogger.error('[Checkout Success] Failed to save guest payment method:', { detail: err });
        }
      }

      setCreated(true);
      setTimeout(() => router.push('/account/orders'), 1500);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create account');
      setIsCreating(false);
    }
  };

  const handleSkip = () => {
    router.push('/my-orders');
  };

  if (showDigitalConfirmation && order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Your digital order is confirmed</h1>
          <p className="text-gray-600">Order {order.order_number}</p>
          <div className="text-left bg-gray-50 rounded-lg p-4 space-y-2">
            {order.order_items?.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item.quantity} × {item.product_name || item.name}</span>
                <span className="font-medium">
                  ${(((item.total_cents ?? (item.price_cents ?? 0) * item.quantity)) / 100).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>${(order.total_cents / 100).toFixed(2)}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600">Check your email for download and access instructions.</p>
          <button
            onClick={() => router.push('/my-orders')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 w-full"
          >
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  if (showGuestPrompt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Save Your Payment Method?</h3>
          <p className="text-sm text-gray-600">
            Create an account to save this payment method for faster checkout next time.
          </p>

          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {createError}
            </div>
          )}

          {created ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-green-700 font-medium">Account created and payment method saved!</p>
              <p className="text-sm text-gray-500">Redirecting to your orders...</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={guestEmail}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password (min 8 characters)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleSkip} className="flex-1">
                  Skip
                </Button>
                <Button onClick={handleCreateAccount} disabled={isCreating} className="flex-1">
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Create & Save
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => router.push('/carts')} 
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Return to Cart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
        <p className="text-gray-600">Confirming your payment...</p>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    }>
      <SuccessPageContent />
    </Suspense>
  );
}
