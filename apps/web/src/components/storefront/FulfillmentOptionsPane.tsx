'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Package, Truck, MapPin, CreditCard, CheckCircle2 } from 'lucide-react';

interface FulfillmentSettings {
  pickup_enabled: boolean;
  pickup_instructions?: string;
  pickup_ready_time_minutes?: number;
  delivery_enabled: boolean;
  delivery_radius_miles?: number;
  delivery_fee_cents?: number;
  delivery_min_free_cents?: number;
  shipping_enabled: boolean;
  shipping_flat_rate_cents?: number;
  shipping_provider?: string;
}

interface PaymentGateway {
  id: string;
  gateway_type: string;
  is_active: boolean;
  display_name?: string;
}

interface FulfillmentOptionsPaneProps {
  tenantId: string;
  compact?: boolean;
}

export default function FulfillmentOptionsPane({ tenantId, compact = false }: FulfillmentOptionsPaneProps) {
  const [fulfillmentSettings, setFulfillmentSettings] = useState<FulfillmentSettings | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFulfillmentAndPaymentInfo();
  }, [tenantId]);

  const fetchFulfillmentAndPaymentInfo = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

      // Fetch fulfillment settings
      const fulfillmentRes = await fetch(`${apiUrl}/public/tenant/${tenantId}/fulfillment-settings`);
      if (fulfillmentRes.ok) {
        const fulfillmentData = await fulfillmentRes.json();
        if (fulfillmentData.success && fulfillmentData.settings) {
          setFulfillmentSettings(fulfillmentData.settings);
        }
      }

      // Fetch payment gateways
      const paymentRes = await fetch(`${apiUrl}/public/tenant/${tenantId}/payment-gateways`);
      if (paymentRes.ok) {
        const paymentData = await paymentRes.json();
        if (paymentData.success && paymentData.gateways) {
          setPaymentGateways(paymentData.gateways.filter((g: PaymentGateway) => g.is_active));
        }
      }
    } catch (error) {
      console.error('Error fetching fulfillment/payment info:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show if no fulfillment options or payment gateways are configured
  const hasFulfillmentOptions = fulfillmentSettings && (
    fulfillmentSettings.pickup_enabled ||
    fulfillmentSettings.delivery_enabled ||
    fulfillmentSettings.shipping_enabled
  );

  const hasPaymentOptions = paymentGateways.length > 0;

  if (loading || (!hasFulfillmentOptions && !hasPaymentOptions)) {
    return null;
  }

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-center justify-center text-sm">
          {hasFulfillmentOptions && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium text-gray-700">Available:</span>
              <div className="flex gap-2">
                {fulfillmentSettings?.pickup_enabled && (
                  <span className="px-2 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200">
                    <Package className="inline h-3 w-3 mr-1" />
                    Pickup
                  </span>
                )}
                {fulfillmentSettings?.delivery_enabled && (
                  <span className="px-2 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200">
                    <Truck className="inline h-3 w-3 mr-1" />
                    Delivery
                  </span>
                )}
                {fulfillmentSettings?.shipping_enabled && (
                  <span className="px-2 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200">
                    <MapPin className="inline h-3 w-3 mr-1" />
                    Shipping
                  </span>
                )}
              </div>
            </div>
          )}
          {hasPaymentOptions && (
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-gray-600">
                {paymentGateways.map(g => g.display_name || g.gateway_type).join(', ')} accepted
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Order & Payment Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasFulfillmentOptions && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary-600" />
              How You Can Get Your Order
            </h3>
            <div className="space-y-3">
              {fulfillmentSettings?.pickup_enabled && (
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <Package className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">In-Store Pickup</p>
                    <p className="text-sm text-gray-600">
                      {fulfillmentSettings.pickup_ready_time_minutes 
                        ? `Ready in ${Math.floor(fulfillmentSettings.pickup_ready_time_minutes / 60)}h ${fulfillmentSettings.pickup_ready_time_minutes % 60}m`
                        : 'Pick up at store location'}
                    </p>
                    {fulfillmentSettings.pickup_instructions && (
                      <p className="text-xs text-gray-500 mt-1">{fulfillmentSettings.pickup_instructions}</p>
                    )}
                  </div>
                  <span className="text-green-600 font-semibold text-sm">FREE</span>
                </div>
              )}

              {fulfillmentSettings?.delivery_enabled && (
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <Truck className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Local Delivery</p>
                    <p className="text-sm text-gray-600">
                      {fulfillmentSettings.delivery_radius_miles 
                        ? `Within ${fulfillmentSettings.delivery_radius_miles} miles`
                        : 'Available in local area'}
                    </p>
                    {fulfillmentSettings.delivery_min_free_cents && (
                      <p className="text-xs text-gray-500 mt-1">
                        Free delivery on orders over {formatCurrency(fulfillmentSettings.delivery_min_free_cents)}
                      </p>
                    )}
                  </div>
                  <span className="text-blue-600 font-semibold text-sm">
                    {fulfillmentSettings.delivery_fee_cents 
                      ? formatCurrency(fulfillmentSettings.delivery_fee_cents)
                      : 'FREE'}
                  </span>
                </div>
              )}

              {fulfillmentSettings?.shipping_enabled && (
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <MapPin className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Shipping</p>
                    <p className="text-sm text-gray-600">
                      {fulfillmentSettings.shipping_provider 
                        ? `Ships via ${fulfillmentSettings.shipping_provider}`
                        : 'Ships nationwide'}
                    </p>
                  </div>
                  <span className="text-purple-600 font-semibold text-sm">
                    {fulfillmentSettings.shipping_flat_rate_cents 
                      ? formatCurrency(fulfillmentSettings.shipping_flat_rate_cents)
                      : 'Calculated'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {hasPaymentOptions && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary-600" />
              Payment Methods Accepted
            </h3>
            <div className="flex flex-wrap gap-2">
              {paymentGateways.map((gateway) => (
                <div
                  key={gateway.id}
                  className="px-4 py-2 bg-white rounded-lg border border-gray-200 flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {gateway.display_name || gateway.gateway_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
