'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { funnelCheckoutService, CheckoutFunnelStep, FunnelStepType } from '@/services/FunnelCheckoutService';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

const STEP_LABELS: Record<FunnelStepType, { label: string; badge: string; color: string }> = {
  order_bump: { label: 'Add to Your Order', badge: 'Special Offer', color: 'bg-blue-600' },
  upsell: { label: 'Upgrade Your Order', badge: 'Upsell', color: 'bg-purple-600' },
  downsell: { label: 'Wait — Special Price!', badge: 'Last Chance', color: 'bg-orange-500' },
  oto: { label: 'One Time Offer', badge: 'Limited Time', color: 'bg-red-600' },
};

const OTO_COUNTDOWN_SECONDS = 300; // 5 minutes

export default function FunnelStepClient({
  orderId,
  stepId,
}: {
  orderId: string;
  stepId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = searchParams?.get('tenantId') || '';
  const funnelId = searchParams?.get('funnelId') || '';
  const sessionId = searchParams?.get('sessionId') || undefined;
  const customerId = searchParams?.get('customerId') || undefined;

  const [step, setStep] = useState<CheckoutFunnelStep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [countdown, setCountdown] = useState(OTO_COUNTDOWN_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStep = useCallback(async () => {
    if (!tenantId || !funnelId) {
      setError('Missing funnel information');
      setLoading(false);
      return;
    }
    try {
      // Resolve the funnel to get step details
      const funnel = await funnelCheckoutService.resolveCheckoutFunnel(tenantId, {
        sessionId,
        customerId,
      });
      if (!funnel) {
        setError('No active funnel found');
        setLoading(false);
        return;
      }
      const foundStep = funnel.steps.find((s) => s.id === stepId);
      if (!foundStep) {
        setError('Funnel step not found');
        setLoading(false);
        return;
      }
      setStep(foundStep);
    } catch {
      setError('Failed to load funnel offer');
    } finally {
      setLoading(false);
    }
  }, [tenantId, funnelId, stepId, sessionId, customerId]);

  useEffect(() => {
    loadStep();
  }, [loadStep]);

  // OTO countdown timer
  useEffect(() => {
    if (!step || step.step_type !== 'oto') return;

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          // Auto-skip on timeout
          handleSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [step]);

  const redirectToNext = (nextStep: CheckoutFunnelStep | null, nextStepId: string | null) => {
    if (nextStep && nextStepId) {
      const params = new URLSearchParams({
        tenantId,
        funnelId,
      });
      if (sessionId) params.set('sessionId', sessionId);
      if (customerId) params.set('customerId', customerId);
      router.replace(`/checkout/funnel/${orderId}/step/${nextStepId}?${params.toString()}`);
    } else {
      // No more steps — go to order confirmation
      const isLoggedIn = customerId !== undefined;
      router.replace(isLoggedIn ? '/account/orders' : '/my-orders');
    }
  };

  const handleAccept = async () => {
    if (!step || !tenantId || !funnelId) return;
    setProcessing(true);
    try {
      const result = await funnelCheckoutService.processStep(tenantId, stepId, {
        funnelId,
        orderId,
        accepted: true,
        sessionId,
        customerId,
      });
      if (result) {
        redirectToNext(result.next_step, result.next_step_id);
      } else {
        setError('Failed to process offer');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = async () => {
    if (!step || !tenantId || !funnelId) return;
    if (processing) return;
    setProcessing(true);
    try {
      const result = await funnelCheckoutService.processStep(tenantId, stepId, {
        funnelId,
        orderId,
        accepted: false,
        sessionId,
        customerId,
      });
      if (result) {
        redirectToNext(result.next_step, result.next_step_id);
      } else {
        setError('Failed to skip offer');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !step) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 mb-4">{error || 'Offer not available'}</p>
            <Button onClick={() => router.replace('/my-orders')}>
              Continue to Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const meta = STEP_LABELS[step.step_type] || STEP_LABELS.upsell;
  const price = step.price_cents || 0;
  const discount = step.discount_cents || 0;
  const finalPrice = price - discount;
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full">
        {/* Badge */}
        <div className="text-center mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-white ${meta.color}`}>
            {meta.badge}
          </span>
        </div>

        {/* Main Offer Card */}
        <Card className="overflow-hidden shadow-xl">
          <CardContent className="p-0">
            {/* Header */}
            <div className={`${meta.color} px-6 py-4 text-center`}>
              <h1 className="text-xl font-bold text-white">{meta.label}</h1>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* OTO Countdown */}
              {step.step_type === 'oto' && countdown > 0 && (
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Offer expires in</p>
                  <div className="text-3xl font-bold text-red-600 tabular-nums">
                    {minutes}:{seconds.toString().padStart(2, '0')}
                  </div>
                </div>
              )}

              {/* Offer Title & Description */}
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  {step.display_title || 'Special Offer'}
                </h2>
                {step.display_description && (
                  <p className="text-sm text-gray-600 mt-2">
                    {step.display_description}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline justify-center gap-3 py-2">
                {discount > 0 && (
                  <span className="text-lg text-gray-400 line-through">
                    {formatCurrency(price)}
                  </span>
                )}
                <span className="text-3xl font-bold text-gray-900">
                  {formatCurrency(finalPrice)}
                </span>
                {discount > 0 && (
                  <span className="text-sm text-green-600 font-medium">
                    Save {formatCurrency(discount)}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 space-y-3">
              <Button
                onClick={handleAccept}
                disabled={processing}
                className="w-full"
                size="lg"
              >
                {processing ? 'Processing...' : `Yes, Add to My Order`}
              </Button>
              <Button
                onClick={handleSkip}
                disabled={processing}
                variant="ghost"
                className="w-full"
              >
                No Thanks, Continue
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Trust Badge */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Your payment is processed securely. This offer is optional.
        </p>
      </div>
    </div>
  );
}
