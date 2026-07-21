'use client';

import { useState } from 'react';
import { Button } from '@mantine/core';
import { MapPin, Truck, Package, Clock } from 'lucide-react';
import { type FulfillmentState } from '@/services/CapabilityResolutionService';
import { usePublicFulfillmentCapability } from '@/hooks/tenant-access/usePublicCapabilityAccess';

export type FulfillmentMethod = 'pickup' | 'delivery' | 'shipping';

interface FulfillmentMethodFormProps {
  tenantId: string;
  subtotal: number;
  onSubmit: (method: FulfillmentMethod, fee: number) => void;
  initialMethod?: FulfillmentMethod | 'digital';
}

export default function FulfillmentMethodForm({
  tenantId,
  subtotal,
  onSubmit,
  initialMethod,
}: FulfillmentMethodFormProps) {
  // Fulfillment capability-driven content control (effective = tier allows AND merchant enabled)
  const fulfillmentCap = usePublicFulfillmentCapability(tenantId);
  const settings = fulfillmentCap.data;
  const isFulfillmentEnabled = settings?.enabled ?? true;
  const showsPickup = settings?.effectiveShowsPickup ?? settings?.showsPickup ?? true;
  const showsDelivery = settings?.effectiveShowsDelivery ?? settings?.showsDelivery ?? true;
  const showsShipping = settings?.effectiveShowsShipping ?? settings?.showsShipping ?? true;

  const [selectedMethod, setSelectedMethod] = useState<FulfillmentMethod | 'digital' | null>(initialMethod || null);

  // Auto-select first available method on initial load
  if (!selectedMethod && settings) {
    const mp = settings.merchantPreferences;
    if (mp.pickup_enabled) {
      // Defer to avoid render-phase setState
      setTimeout(() => setSelectedMethod('pickup'), 0);
    } else if (mp.delivery_enabled) {
      setTimeout(() => setSelectedMethod('delivery'), 0);
    } else if (mp.shipping_enabled) {
      setTimeout(() => setSelectedMethod('shipping'), 0);
    }
  }

  // Fee calculations from unified FulfillmentState
  const getDeliveryFee = (): number => {
    if (!settings) return 0;
    if (!settings.merchantPreferences.delivery_enabled) return 0;
    if (settings.deliveryMinFreeCents && subtotal >= settings.deliveryMinFreeCents) {
      return 0;
    }
    return settings.deliveryFeeCents;
  };

  const getShippingFee = (): number => {
    if (!settings) return 0;
    if (!settings.merchantPreferences.shipping_enabled) return 0;
    if (settings.shippingMinFreeCents && subtotal >= settings.shippingMinFreeCents) {
      return 0;
    }
    return settings.shippingFlatRateCents || 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod || selectedMethod === 'digital') return;
    let fee = 0;
    if (selectedMethod === 'delivery') fee = getDeliveryFee();
    else if (selectedMethod === 'shipping') fee = getShippingFee();
    onSubmit(selectedMethod, fee);
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hour' : `${hours} hours`;
  };

  if (fulfillmentCap.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-neutral-600">
        Unable to load fulfillment options. Please try again.
      </div>
    );
  }

  const deliveryFee = getDeliveryFee();
  const shippingFee = getShippingFee();
  const qualifiesForFreeDelivery = settings.deliveryMinFreeCents && subtotal >= settings.deliveryMinFreeCents;
  const qualifiesForFreeShipping = settings.shippingMinFreeCents && subtotal >= settings.shippingMinFreeCents;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-neutral-600 mb-4">
        Select how you'd like to receive your order
      </p>

      {/* Pickup Option */}
      {settings.merchantPreferences.pickup_enabled && showsPickup && (
        <label
          className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedMethod === 'pickup'
            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
            : 'border-neutral-200 hover:border-primary-300'
            }`}
        >
          <div className="flex items-start gap-4">
            <input
              type="radio"
              name="fulfillment"
              value="pickup"
              checked={selectedMethod === 'pickup'}
              onChange={() => setSelectedMethod('pickup')}
              className="mt-1 h-4 w-4 text-primary-600"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary-600" />
                  <span className="font-semibold text-neutral-900">In-Store Pickup</span>
                </div>
                <span className="text-green-600 font-semibold">FREE</span>
              </div>
              <div className="text-sm text-neutral-600 space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Ready in {formatTime(settings.pickupReadyTimeMinutes)}</span>
                </div>
                {settings.pickupInstructions && (
                  <p className="mt-2 text-xs">{settings.pickupInstructions}</p>
                )}
              </div>
            </div>
          </div>
        </label>
      )}

      {/* Delivery Option */}
      {settings.merchantPreferences.delivery_enabled && showsDelivery && (
        <label
          className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedMethod === 'delivery'
            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
            : 'border-neutral-200 hover:border-primary-300'
            }`}
        >
          <div className="flex items-start gap-4">
            <input
              type="radio"
              name="fulfillment"
              value="delivery"
              checked={selectedMethod === 'delivery'}
              onChange={() => setSelectedMethod('delivery')}
              className="mt-1 h-4 w-4 text-primary-600"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary-600" />
                  <span className="font-semibold text-neutral-900">Local Delivery</span>
                </div>
                {qualifiesForFreeDelivery ? (
                  <span className="text-green-600 font-semibold">FREE</span>
                ) : (
                  <span className="font-semibold text-neutral-900">{formatCurrency(deliveryFee)}</span>
                )}
              </div>
              <div className="text-sm text-neutral-600 space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Delivered within {settings.deliveryTimeHours} hours</span>
                </div>
                {settings.deliveryRadiusMiles && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Within {settings.deliveryRadiusMiles} miles</span>
                  </div>
                )}
                {qualifiesForFreeDelivery && (
                  <p className="text-green-600 text-xs mt-1">
                    🎉 Congratulations! Your order is over {formatCurrency(settings.deliveryMinFreeCents!)}! You qualify for free delivery!
                  </p>
                )}
                {!qualifiesForFreeDelivery && settings.deliveryMinFreeCents && (
                  <p className="text-xs mt-1">
                    Free delivery on orders over {formatCurrency(settings.deliveryMinFreeCents)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </label>
      )}

      {/* Shipping Option */}
      {settings.merchantPreferences.shipping_enabled && showsShipping && (
        <label
          className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedMethod === 'shipping'
            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
            : 'border-neutral-200 hover:border-primary-300'
            }`}
        >
          <div className="flex items-start gap-4">
            <input
              type="radio"
              name="fulfillment"
              value="shipping"
              checked={selectedMethod === 'shipping'}
              onChange={() => setSelectedMethod('shipping')}
              className="mt-1 h-4 w-4 text-primary-600"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary-600" />
                  <span className="font-semibold text-neutral-900">Shipping</span>
                </div>
                <span className="font-semibold text-neutral-900">
                  {formatCurrency(getShippingFee())}
                </span>
              </div>
              <div className="text-sm text-neutral-600 space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Estimated 3-5 business days</span>
                </div>
                <p className="text-xs">
                  Ships in {settings.shippingHandlingDays} business {settings.shippingHandlingDays === 1 ? 'day' : 'days'}
                </p>
                {qualifiesForFreeShipping && (
                  <p className="text-green-600 text-xs mt-1">
                    🎉 Congratulations! Your order is over {formatCurrency(settings.shippingMinFreeCents!)}! You qualify for free shipping!
                  </p>
                )}
                {!qualifiesForFreeShipping && settings.shippingMinFreeCents && (
                  <p className="text-xs mt-1">
                    Free shipping on orders over {formatCurrency(settings.shippingMinFreeCents)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </label>
      )}

      <Button
        type="submit"
        disabled={!selectedMethod}
        className="w-full"
        style={{ color: 'white' }}
        variant="gradient"
      >
        Continue to {selectedMethod === 'pickup' ? 'Payment' : 'Address'}
      </Button>
    </form>
  );
}
