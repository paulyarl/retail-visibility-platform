'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, XCircle } from 'lucide-react';
import { clearCart } from '@/lib/cart/cartManager';
import { checkoutService } from '@/services/CheckoutService';

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

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
        console.log('[Checkout Success] Confirming payment:', { paymentIntentId, redirectStatus });

        // Confirm the payment using service
        const confirmResult = await checkoutService.confirmStripePayment(paymentIntentId, clientSecret || undefined);

        if (!confirmResult?.orderId) {
          throw new Error('Failed to confirm payment');
        }

        console.log('[Checkout Success] Payment confirmed, orderId:', confirmResult.orderId);

        // Fetch order details using service
        const order = await checkoutService.getOrder(confirmResult.orderId);

        if (order) {
          // Save customer email/phone to localStorage for order history lookup (like Square flow)
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
            console.log('[Checkout Success] Cart cleared for tenant:', tenantId);
          }
          
          // Trigger cart update event
          window.dispatchEvent(new Event('cart-updated'));
        } catch (err) {
          console.error('[Checkout Success] Failed to clear cart:', err);
        }

        // Redirect to buyer order history (like Square flow)
        router.replace('/my-orders');
      } catch (err: any) {
        console.error('[Checkout Success] Error:', err);
        setError(err.message || 'Failed to process payment confirmation');
      }
    };

    confirmPaymentAndRedirect();
  }, [paymentIntentId, redirectStatus, clientSecret, router]);

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
