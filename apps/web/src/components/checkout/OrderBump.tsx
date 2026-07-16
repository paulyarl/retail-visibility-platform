'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { funnelCheckoutService, CheckoutFunnel } from '@/services/FunnelCheckoutService';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

interface OrderBumpProps {
  tenantId: string;
  triggerProductId?: string;
  cartValueCents: number;
  sessionId?: string;
  customerId?: string;
  onAcceptedChange?: (accepted: boolean, step: CheckoutFunnel['steps'][number] | null) => void;
}

export function OrderBump({
  tenantId,
  triggerProductId,
  cartValueCents,
  sessionId,
  customerId,
  onAcceptedChange,
}: OrderBumpProps) {
  const [funnel, setFunnel] = useState<CheckoutFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveFunnel = async () => {
      if (!tenantId) return;
      setLoading(true);
      setError(null);
      try {
        const resolved = await funnelCheckoutService.resolveCheckoutFunnel(tenantId, {
          triggerProductId,
          cartValueCents,
          sessionId,
          customerId,
        });
        setFunnel(resolved);
      } catch (err) {
        setError('Failed to load offers');
      } finally {
        setLoading(false);
      }
    };
    resolveFunnel();
  }, [tenantId, triggerProductId, cartValueCents, sessionId, customerId]);

  // Find the order_bump step (if any)
  const orderBumpStep = funnel?.steps.find((s) => s.step_type === 'order_bump') || null;

  const handleToggle = (checked: boolean) => {
    setAccepted(checked);
    onAcceptedChange?.(checked, orderBumpStep);
  };

  if (loading || error || !funnel || !orderBumpStep) {
    return null;
  }

  const price = orderBumpStep.price_cents || 0;
  const discount = orderBumpStep.discount_cents || 0;
  const finalPrice = price - discount;

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={accepted}
            onCheckedChange={handleToggle}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                Special Offer
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {orderBumpStep.display_title || 'Add to your order'}
              </span>
            </div>
            {orderBumpStep.display_description && (
              <p className="text-sm text-gray-600 mb-2">
                {orderBumpStep.display_description}
              </p>
            )}
            <div className="flex items-baseline gap-2">
              {discount > 0 && (
                <span className="text-sm text-gray-400 line-through">
                  {formatCurrency(price)}
                </span>
              )}
              <span className="text-lg font-bold text-blue-700">
                {formatCurrency(finalPrice)}
              </span>
              {discount > 0 && (
                <span className="text-xs text-green-600 font-medium">
                  Save {formatCurrency(discount)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
