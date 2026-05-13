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
  orderId?: string; // Optional - passed when payment intent is created on mount
}

function StripeCheckoutForm({ 
  amount, 
  customerInfo, 
  shippingAddress, 
  fulfillmentMethod, 
  cartItems, 
  onSuccess, 
  onBack,
  tenantId,
  orderId 
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentElementLoading, setPaymentElementLoading] = useState(true);

  // console.log('[Stripe] StripeCheckoutForm props:', { amount, customerInfo, shippingAddress, fulfillmentMethod, cartItems, onSuccess, onBack, tenantId, orderId });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Payment intent already created on mount - just confirm the payment
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
        },
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setLoading(false);
        return;
      }

      // Payment succeeded - the redirect will happen automatically
      // onSuccess will be called on the success page
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

      {/* Payment Element with loading state */}
      <div className="relative">
        {paymentElementLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg min-h-[200px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-sm text-gray-600">Loading payment methods...</p>
            </div>
          </div>
        )}
        <PaymentElement 
          onReady={() => {
            console.log('[Stripe] PaymentElement ready');
            setPaymentElementLoading(false);
          }}
        />
      </div>

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
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings: platformSettings } = usePlatformSettings();

  // console.log(`[Stripe] props:`, props);

  // Validate minimum payment amount using platform-wide settings
  const paymentValidation = validateMinimumPaymentAmount(props.amount, platformSettings?.minimumPaymentAmount);
  
  if (!paymentValidation.isValid) {
    // console.log('[Stripe] Amount validation failed:', paymentValidation);
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Payment Amount Too Low</p>
        <p className="text-red-600 text-sm mt-1">{paymentValidation.message}</p>
      </div>
    );
  }

  useEffect(() => {
    // Create order and payment intent on mount
    const initializeCheckout = async () => {
      try {
        setLoading(true);
        console.log('[Stripe] Creating order and payment intent...');
        
        const checkoutResult = await checkoutService.initiateCheckout(
          props.tenantId,
          props.amount,
          props.customerInfo,
          props.cartItems,
          {
            shippingAddress: props.shippingAddress,
            fulfillmentMethod: props.fulfillmentMethod,
          }
        );

        if (!checkoutResult) {
          throw new Error('Failed to create order');
        }

        // console.log('[Stripe] Checkout initialized:', {
        //   orderId: checkoutResult.orderId,
        //   hasClientSecret: !!checkoutResult.clientSecret
        // });

        setOrderId(checkoutResult.orderId);
        setClientSecret(checkoutResult.clientSecret);
      } catch (err: any) {
        console.error('[Stripe] Failed to initialize checkout:', err);
        setError(err.message || 'Failed to initialize payment. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    initializeCheckout();
  }, [props.amount, props.tenantId]);

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

  
  // We need a clientSecret to initialize the PaymentElement
  if (!clientSecret) {
    return (
      <StripeWrapper>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <p className="text-sm text-gray-600">Preparing payment form...</p>
          </div>
        </div>
      </StripeWrapper>
    );
  }

  // Create payment intent options with clientSecret from server
  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  };

  return (
    <StripeWrapper>
      <Elements 
        stripe={loadStripe(publishableKey!)} 
        options={options}
      >
        <StripeCheckoutForm {...props} orderId={orderId!} />
      </Elements>
    </StripeWrapper>
  );
}
