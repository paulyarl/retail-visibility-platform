'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { MapPin, Truck, Package, Clock, DollarSign } from 'lucide-react';

export type FulfillmentMethod = 'pickup' | 'delivery' | 'shipping';

interface FulfillmentMethodFormProps {
  tenantId: string;
  subtotal: number;
  onSubmit: (method: FulfillmentMethod, fee: number) => void;
  initialMethod?: FulfillmentMethod;
}

interface FulfillmentSettings {
  pickup_enabled: boolean;
  pickup_instructions: string | null;
  pickup_ready_time_minutes: number;
  delivery_enabled: boolean;
  delivery_radius_miles: number | null;
  delivery_fee_cents: number;
  delivery_min_free_cents: number | null;
  delivery_time_hours: number;
  shipping_enabled: boolean;
  shipping_flat_rate_cents: number | null;
  shipping_handling_days: number;
}

export default function FulfillmentMethodForm({
  tenantId,
  subtotal,
  onSubmit,
  initialMethod,
}: FulfillmentMethodFormProps) {
  const [selectedMethod, setSelectedMethod] = useState<FulfillmentMethod | null>(initialMethod || null);
  const [settings, setSettings] = useState<FulfillmentSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, [tenantId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/public/tenant/${tenantId}/fulfillment-settings`);
      
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data = await response.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        
        // Auto-select first available method if none selected
        if (!selectedMethod) {
          if (data.settings.pickup_enabled) {
            setSelectedMethod('pickup');
          } else if (data.settings.delivery_enabled) {
            setSelectedMethod('delivery');
          } else if (data.settings.shipping_enabled) {
            setSelectedMethod('shipping');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching fulfillment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDeliveryFee = (): number => {
    if (!settings) return 0;
    
    // Check if order qualifies for free delivery
    if (settings.delivery_min_free_cents && subtotal >= settings.delivery_min_free_cents) {
      return 0;
    }
    
    return settings.delivery_fee_cents;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMethod) return;
    
    let fee = 0;
    if (selectedMethod === 'delivery') {
      fee = getDeliveryFee();
    } else if (selectedMethod === 'shipping' && settings?.shipping_flat_rate_cents) {
      fee = settings.shipping_flat_rate_cents;
    }
    
    onSubmit(selectedMethod, fee);
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hour' : `${hours} hours`;
  };

  if (loading) {
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
  const qualifiesForFreeDelivery = settings.delivery_min_free_cents && subtotal >= settings.delivery_min_free_cents;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-neutral-600 mb-4">
        Select how you'd like to receive your order
      </p>

      {/* Pickup Option */}
      {settings.pickup_enabled && (
        <label
          className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
            selectedMethod === 'pickup'
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
                  <span>Ready in {formatTime(settings.pickup_ready_time_minutes)}</span>
                </div>
                {settings.pickup_instructions && (
                  <p className="mt-2 text-xs">{settings.pickup_instructions}</p>
                )}
              </div>
            </div>
          </div>
        </label>
      )}

      {/* Delivery Option */}
      {settings.delivery_enabled && (
        <label
          className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
            selectedMethod === 'delivery'
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
                  <span>Delivered within {settings.delivery_time_hours} hours</span>
                </div>
                {settings.delivery_radius_miles && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Within {settings.delivery_radius_miles} miles</span>
                  </div>
                )}
                {qualifiesForFreeDelivery && (
                  <p className="text-green-600 text-xs mt-1">
                    🎉 You qualify for free delivery!
                  </p>
                )}
                {!qualifiesForFreeDelivery && settings.delivery_min_free_cents && (
                  <p className="text-xs mt-1">
                    Free delivery on orders over {formatCurrency(settings.delivery_min_free_cents)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </label>
      )}

      {/* Shipping Option */}
      {settings.shipping_enabled && settings.shipping_flat_rate_cents && (
        <label
          className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
            selectedMethod === 'shipping'
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
                  {formatCurrency(settings.shipping_flat_rate_cents)}
                </span>
              </div>
              <div className="text-sm text-neutral-600 space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Estimated 3-5 business days</span>
                </div>
                <p className="text-xs">
                  Ships in {settings.shipping_handling_days} business {settings.shipping_handling_days === 1 ? 'day' : 'days'}
                </p>
              </div>
            </div>
          </div>
        </label>
      )}

      <Button
        type="submit"
        disabled={!selectedMethod}
        className="w-full"
      >
        Continue to {selectedMethod === 'pickup' ? 'Payment' : 'Address'}
      </Button>
    </form>
  );
}
