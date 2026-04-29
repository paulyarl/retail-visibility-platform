'use client';

import { useState } from 'react';
import { Alert, Button, Stack, Group } from '@mantine/core';
import { subscriptionBillingService } from '@/services/SubscriptionBillingService';

// Direct imports - these packages are installed
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Get Stripe publishable key from either env var name
function getStripePublishableKey(): string | undefined {
  console.log(`[StripeCardForm] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}`);
  console.log(`[StripeCardForm] NEXT_PUBLIC_STRIPE_PUBLIC_KEY: ${process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY}`);
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;
  console.log('[StripeCardForm] Stripe publishable key:', key ? `${key.substring(0, 8)}...` : 'NOT_FOUND');
  return key;
}

// Check if Stripe is properly configured
function isStripeConfigured(): boolean {
  const key = getStripePublishableKey();
  const configured = !!(key && key.length > 0 && key.startsWith('pk_'));
  console.log('Stripe configured:', configured);
  return configured;
}

// Initialize Stripe
const stripePromise = isStripeConfigured() ? loadStripe(getStripePublishableKey()!) : null;
console.log(`[StripeCardForm] stripePromise: ${stripePromise}`);

interface StripeCardFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// Inner component that uses Stripe hooks inside Elements provider
function StripeFormInner({ onSuccess, onCancel }: StripeCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  console.log(`[StripeCardForm] stripe: ${stripe}`);
  console.log(`[StripeCardForm] elements: ${elements}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe not loaded. Please refresh and try again.');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    console.log(`[StripeCardForm] cardElement: ${cardElement}`);
    if (!cardElement) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });
      console.log(`[StripeCardForm] stripeError: ${stripeError}`);
      console.log(`[StripeCardForm] paymentMethod: ${paymentMethod}`);

      if (stripeError) {
        setError(stripeError.message || 'Failed to create payment method');
        return;
      }

      // Save to backend
      await subscriptionBillingService.addPaymentMethod({
        gatewayType: 'stripe',
        paymentMethodToken: paymentMethod.id,
        cardLast4: paymentMethod.card?.last4,
        cardBrand: paymentMethod.card?.brand,
        expiryMonth: paymentMethod.card?.exp_month,
        expiryYear: paymentMethod.card?.exp_year,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <div className="p-4 border rounded-lg">
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
            }}
          />
        </div>

        <Group gap="sm">
          <Button type="submit" loading={loading} flex={1}>
            Add Payment Method
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function StripeCardForm({ onSuccess, onCancel }: StripeCardFormProps) {
  if (!stripePromise) {
    return (
      <Stack gap="md">
        <Alert color="yellow" variant="light">
          Stripe is not configured. Please contact support to add payment methods.
        </Alert>
        <Button onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </Stack>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <StripeFormInner onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}
