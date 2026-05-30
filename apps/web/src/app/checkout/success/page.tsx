'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, XCircle, CheckCircle, CreditCard } from 'lucide-react';
import { clearCart } from '@/lib/cart/cartManager';
import { checkoutService } from '@/services/CheckoutService';
import { customerAuthService } from '@/services/CustomerAuthService';
import { customerPaymentMethodsService } from '@/services/CustomerPaymentMethodsService';
import { Button } from '@/components/ui/Button';

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestTenantId, setGuestTenantId] = useState<string>('');
  const [guestGatewayType, setGuestGatewayType] = useState<string>('');
  const [guestPaymentToken, setGuestPaymentToken] = useState<string>('');
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
          console.error('[Checkout Success] Failed to clear cart:', err);
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
          if (isLoggedIn) {
            try {
              await customerPaymentMethodsService.addPaymentMethod({
                tenantId: saveTenantId,
                gatewayType: saveGatewayType as 'stripe' | 'square' | 'paypal',
                paymentMethodToken: paymentIntentId,
                type: 'card',
              });
              console.log('[Checkout Success] Payment method saved successfully');
            } catch (err) {
              console.error('[Checkout Success] Failed to save payment method:', err);
            }
            // Redirect to orders
            router.replace('/account/orders');
          } else {
            // Guest user — show account creation prompt on this page
            setGuestEmail(order?.customer_email || '');
            setGuestTenantId(saveTenantId);
            setGuestGatewayType(saveGatewayType);
            setGuestPaymentToken(paymentIntentId);
            setShowGuestPrompt(true);
          }
        } else {
          // No save intent — redirect immediately
          const isLoggedIn = customerAuthService.isAuthenticated();
          router.replace(isLoggedIn ? '/account/orders' : '/my-orders');
        }
      } catch (err: any) {
        console.error('[Checkout Success] Error:', err);
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
          });
        } catch (err) {
          console.error('[Checkout Success] Failed to save guest payment method:', err);
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
