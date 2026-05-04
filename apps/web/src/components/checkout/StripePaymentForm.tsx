'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/Button';
import { AlertCircle, Currency, Loader2 } from 'lucide-react';
import { checkoutService } from '@/services/CheckoutService';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { validateMinimumPaymentAmount } from '@/utils/paymentValidation';

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
  const { settings: platformSettings } = usePlatformSettings();

  // Validate minimum payment amount using platform-wide settings
  const paymentValidation = validateMinimumPaymentAmount(props.amount, platformSettings?.minimumPaymentAmount);
  
  if (!paymentValidation.isValid) {
    console.log('[Stripe] Amount validation failed:', paymentValidation);
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Payment Amount Too Low</p>
        <p className="text-red-600 text-sm mt-1">{paymentValidation.message}</p>
      </div>
    );
  }

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

  // Check if Stripe publishable key is available
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    console.error('[Stripe] Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable');
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">
          Stripe is not properly configured. Please contact support.
        </p>
      </div>
    );
  }

  // Create a wrapper component to handle Stripe loading errors
  function StripeWrapper({ children }: { children: React.ReactNode }) {
    const [stripeError, setStripeError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const loadStripeAsync = async () => {
        try {
          console.log('[Stripe] Starting to load Stripe...');
          const stripe = await loadStripe(publishableKey!);
          console.log('[Stripe] Stripe loaded successfully:', stripe ? 'OK' : 'FAILED');
          if (!stripe) {
            setStripeError('Failed to load Stripe library');
          }
        } catch (error) {
          console.error('[Stripe] Error loading Stripe:', error);
          setStripeError('Stripe library failed to initialize');
        } finally {
          setIsLoading(false);
        }
      };

      if (publishableKey) {
        loadStripeAsync();
      } else {
        setStripeError('Stripe publishable key not found');
        setIsLoading(false);
      }
    }, [publishableKey]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          <span className="ml-2 text-sm text-gray-600">Loading payment system...</span>
        </div>
      );
    }

    if (stripeError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Payment System Error</p>
          <p className="text-red-600 text-sm mt-1">{stripeError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return <>{children}</>;
  }

  
  // Create payment intent options - use payment mode for simplicity
  const options = {
    mode: 'payment' as const,
    currency: 'usd',
    amount: props.amount,
    // In production, you'd want to create a payment intent on the server
    // and pass the clientSecret here instead
  };

  // For Stripe, we need to create the payment intent first
  // This is a simplified version - in production, you'd want to handle this differently
  return (
    <StripeWrapper>
      <div className="space-y-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-purple-800 text-sm">
            Stripe checkout requires the merchant to have a connected Stripe account.
            Please ensure Stripe Connect is configured before accepting Stripe payments.
          </p>
        </div>

        <Elements 
          stripe={loadStripe(publishableKey!)} 
          options={options}
        >
          <StripeCheckoutForm {...props} />
        </Elements>
      </div>
    </StripeWrapper>
  );
}
