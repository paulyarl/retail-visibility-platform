'use client';

import { useState, useEffect } from 'react';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loader2, CreditCard, AlertCircle } from 'lucide-react';
import customerPaymentMethodsService from '@/services/CustomerPaymentMethodsService';

function getStripePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;
}

function isStripeConfigured(): boolean {
  const key = getStripePublishableKey();
  return !!(key && key.length > 0 && key.startsWith('pk_'));
}

const stripePromise = isStripeConfigured() ? loadStripe(getStripePublishableKey()!) : null;

interface CustomerAddCardFormProps {
  tenantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddCardFormInner({ tenantId, onSuccess, onCancel }: CustomerAddCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe not loaded. Please refresh and try again.');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    try {
      setLoading(true);
      setError(null);

      // Step 1: Create SetupIntent on the server
      const setupResult = await customerPaymentMethodsService.createSetupIntent(tenantId);

      if (!setupResult.success || !setupResult.clientSecret) {
        setError(setupResult.error || 'Failed to initialize card setup');
        return;
      }

      // Step 2: Confirm card setup with Stripe.js
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(
        setupResult.clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (confirmError) {
        setError(confirmError.message || 'Failed to confirm card setup');
        return;
      }

      if (setupIntent?.status === 'succeeded') {
        // Step 3: Get the payment method ID from the setup intent
        const paymentMethodId = setupIntent.payment_method as string;

        // Step 4: Save to our backend
        const saveResult = await customerPaymentMethodsService.addPaymentMethod({
          tenantId,
          gatewayType: 'stripe',
          paymentMethodToken: paymentMethodId,
        });

        if (saveResult.success) {
          onSuccess();
        } else {
          setError(saveResult.error || 'Failed to save payment method');
        }
      } else if (setupIntent?.status === 'requires_action') {
        // 3D Secure or additional action required — for SetupIntents this needs
        // stripe.handleCardAction(setupIntent.client_secret) then re-confirm
        setError('Additional authentication is required. Please try again or use a different card.');
      } else {
        setError(`Setup status: ${setupIntent?.status || 'unknown'}. Please try again.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="p-4 border border-neutral-200 rounded-lg bg-white">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1f2937',
                  '::placeholder': {
                    color: '#9ca3af',
                  },
                },
                invalid: {
                  color: '#ef4444',
                },
              },
              hidePostalCode: true,
            }}
          />
        </div>

        <p className="text-xs text-gray-500">
          Your card information is encrypted and processed securely by Stripe. We never store your full card number.
        </p>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!stripe || loading}
            className="flex-1 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Card...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Save Card
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function CustomerAddCardForm(props: CustomerAddCardFormProps) {
  if (!stripePromise) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          Online payments are not configured for this store. Please contact the store directly to add a payment method.
        </p>
        <Button variant="outline" onClick={props.onCancel} className="mt-3">
          Close
        </Button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <AddCardFormInner {...props} />
    </Elements>
  );
}

// Convenience wrapper that shows the form in a modal
interface CustomerAddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onSuccess: () => void;
}

export function CustomerAddCardModal({ isOpen, onClose, tenantId, onSuccess }: CustomerAddCardModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Payment Method" size="md">
      <CustomerAddCardForm
        tenantId={tenantId}
        onSuccess={() => {
          onSuccess();
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
