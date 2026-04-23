'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/Button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { checkoutService } from '@/services/CheckoutService';

interface StripePaymentFormProps {
  amount: number;
  customerInfo: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  fulfillmentMethod?: string;
  cartItems: any[];
  onSuccess: (orderId: string) => void;
  onBack: () => void;
  tenantId: string;
}

function StripeCheckoutForm({ 
  amount, 
  customerInfo, 
  shippingAddress, 
  fulfillmentMethod, 
  cartItems, 
  onSuccess, 
  onBack,
  tenantId 
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create order and payment intent using service
      const checkoutResult = await checkoutService.initiateCheckout(
        tenantId,
        amount,
        customerInfo,
        cartItems,
        {
          shippingAddress,
          fulfillmentMethod,
        }
      );

      if (!checkoutResult) {
        throw new Error('Failed to initiate checkout');
      }

      const { orderId } = checkoutResult;

      // Confirm payment with Stripe
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success?orderId=${orderId}`,
        },
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setLoading(false);
        return;
      }

      // Payment succeeded
      onSuccess(orderId);
    } catch (err: any) {
      console.error('[Stripe] Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <PaymentElement />

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button type="submit" disabled={!stripe || loading} className="flex-1">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay $${(amount / 100).toFixed(2)}`
          )}
        </Button>
      </div>
    </form>
  );
}

export default function StripePaymentFormWrapper(props: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // We'll create the payment intent after the user submits the form
    // For now, just set loading to false
    setLoading(false);
  }, [props.amount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  // For Stripe, we need to create the payment intent first
  // This is a simplified version - in production, you'd want to handle this differently
  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-purple-800 text-sm">
          Stripe checkout requires the merchant to have a connected Stripe account.
          Please ensure Stripe Connect is configured before accepting Stripe payments.
        </p>
      </div>
      <StripeCheckoutForm {...props} />
    </div>
  );
}
