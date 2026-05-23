'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Package, Truck, MapPin, Save, AlertCircle, ShoppingBag, CreditCard } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { useFulfillmentCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import Link from 'next/link';

interface FulfillmentSettings {
  pickup_enabled: boolean;
  pickup_instructions: string | null;
  pickup_ready_time_minutes: number;
  delivery_enabled: boolean;
  delivery_radius_miles: number | null;
  delivery_fee_cents: number;
  delivery_min_free_cents: number | null;
  delivery_time_hours: number;
  delivery_instructions: string | null;
  shipping_enabled: boolean;
  shipping_flat_rate_cents: number | null;
  shipping_zones: any[];
  shipping_handling_days: number;
  shipping_provider: string | null;
}

interface FulfillmentSettingsClientProps {
  tenantId: string;
}

export default function FulfillmentSettingsClient({ tenantId }: FulfillmentSettingsClientProps) {
  // Fulfillment capability-driven content control
  const fulfillmentCap = useFulfillmentCapability(tenantId, { forTenant: true });
  const isFulfillmentEnabled = fulfillmentCap.data?.enabled ?? true;
  const showsPickup = fulfillmentCap.data?.showsPickup ?? true;
  const showsDelivery = fulfillmentCap.data?.showsDelivery ?? true;
  const showsShipping = fulfillmentCap.data?.showsShipping ?? true;
  const showsService = fulfillmentCap.data?.showsService ?? true;

  const [settings, setSettings] = useState<FulfillmentSettings>({
    pickup_enabled: true,
    pickup_instructions: null,
    pickup_ready_time_minutes: 120,
    delivery_enabled: false,
    delivery_radius_miles: null,
    delivery_fee_cents: 0,
    delivery_min_free_cents: null,
    delivery_time_hours: 24,
    delivery_instructions: null,
    shipping_enabled: false,
    shipping_flat_rate_cents: null,
    shipping_zones: [],
    shipping_handling_days: 2,
    shipping_provider: null,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [customPickupTime, setCustomPickupTime] = useState(false);
  const [customPickupInstructions, setCustomPickupInstructions] = useState(false);

  // Preset time options in minutes
  const timePresets = [
    { label: '1 hour', minutes: 60 },
    { label: '2 hours', minutes: 120 },
    { label: '6 hours', minutes: 360 },
    { label: '1 day', minutes: 1440 },
  ];

  // Preset pickup instruction templates
  const instructionPresets = [
    { label: 'Call when ready', value: 'We will call you when your order is ready for pickup.' },
    { label: 'Text when ready', value: 'We will text you when your order is ready for pickup.' },
    { label: 'Customer Service', value: 'Please come to the customer service desk when you arrive.' },
  ];

  useEffect(() => {
    fetchSettings();
  }, [tenantId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await platformHomeService.getTenantFulfillmentSettings(tenantId);
      if (response) {
        setSettings(response);
      }
    } catch (error) {
      console.error('Error fetching fulfillment settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      const response = await platformHomeService.updateTenantFulfillmentSettings(tenantId, settings);
      
      if (response) {
        setSettings(response);
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error saving fulfillment settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number | null) => {
    if (cents === null || cents === 0) return '';
    const dollars = cents / 100;
    // Only show decimals if there are cents
    return dollars % 1 === 0 ? dollars.toString() : dollars.toFixed(2);
  };

  const parseCurrency = (value: string): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white flex items-center gap-3 mb-2">
          <Package className="h-8 w-8 text-primary-600" />
          Fulfillment Settings
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Configure how customers can receive their orders from your store
        </p>
        <div className="flex gap-2 mt-3">
          <Link href={`/t/${tenantId}/orders`}>
            <Button variant="outline" size="sm">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Order Management
            </Button>
          </Link>
          <Link href={`/t/${tenantId}/settings/payment-gateways`}>
            <Button variant="outline" size="sm">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment Gateways
            </Button>
          </Link>
        </div>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle className="h-5 w-5" />
          <span>{message.text}</span>
        </div>
      )}

      {!isFulfillmentEnabled && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <span className="text-amber-800">Fulfillment options are disabled for your current plan. Upgrade to enable fulfillment settings.</span>
        </div>
      )}

      <div className="space-y-6">
        {/* In-Store Pickup */}
        {showsPickup && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary-600" />
              In-Store Pickup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="pickup_enabled"
                checked={settings.pickup_enabled ?? false}
                onCheckedChange={(checked) => setSettings({ ...settings, pickup_enabled: checked })}
              />
              <label htmlFor="pickup_enabled" className="text-sm font-medium text-neutral-900">
                Enable in-store pickup (Free)
              </label>
            </div>

            {settings.pickup_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Ready Time
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {timePresets.map((preset) => (
                      <button
                        key={preset.minutes}
                        type="button"
                        onClick={() => {
                          setSettings({ ...settings, pickup_ready_time_minutes: preset.minutes });
                          setCustomPickupTime(false);
                        }}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          settings.pickup_ready_time_minutes === preset.minutes && !customPickupTime
                            ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-400'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomPickupTime(true)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        customPickupTime
                          ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                          : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-400'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {customPickupTime && (
                    <div className="mt-2">
                      <input
                        type="number"
                        min="0"
                        value={settings.pickup_ready_time_minutes}
                        onChange={(e) => setSettings({ ...settings, pickup_ready_time_minutes: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter minutes"
                      />
                      <p className="text-xs text-neutral-500 mt-1">
                        Enter custom time in minutes
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Pickup Instructions
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {instructionPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setSettings({ ...settings, pickup_instructions: preset.value });
                          setCustomPickupInstructions(false);
                        }}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          settings.pickup_instructions === preset.value && !customPickupInstructions
                            ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-400'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomPickupInstructions(true)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        customPickupInstructions
                          ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                          : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-400'
                      }`}
                    >
                      Custom Instructions
                    </button>
                  </div>
                  {(customPickupInstructions || (!instructionPresets.some(p => p.value === settings.pickup_instructions) && settings.pickup_instructions)) && (
                    <div className="mt-2">
                      <textarea
                        value={settings.pickup_instructions || ''}
                        onChange={(e) => setSettings({ ...settings, pickup_instructions: e.target.value || null })}
                        rows={3}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter custom pickup instructions"
                      />
                    </div>
                  )}
                  {!customPickupInstructions && settings.pickup_instructions && instructionPresets.some(p => p.value === settings.pickup_instructions) && (
                    <p className="text-sm text-neutral-600 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                      {settings.pickup_instructions}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>}

        {/* Local Delivery */}
        {showsDelivery && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary-600" />
              Local Delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="delivery_enabled"
                checked={settings.delivery_enabled ?? false}
                onCheckedChange={(checked) => setSettings({ ...settings, delivery_enabled: checked })}
              />
              <label htmlFor="delivery_enabled" className="text-sm font-medium text-neutral-900">
                Enable local delivery
              </label>
            </div>

            {settings.delivery_enabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Delivery Radius (miles)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={settings.delivery_radius_miles ?? ''}
                      onChange={(e) => setSettings({ ...settings, delivery_radius_miles: parseFloat(e.target.value) || null })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Delivery Fee ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={settings.delivery_fee_cents != null ? settings.delivery_fee_cents / 100 : ''}
                      onChange={(e) => setSettings({ ...settings, delivery_fee_cents: parseCurrency(e.target.value) })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Free Delivery Minimum ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={settings.delivery_min_free_cents != null ? settings.delivery_min_free_cents / 100 : ''}
                      onChange={(e) => setSettings({ ...settings, delivery_min_free_cents: e.target.value ? parseCurrency(e.target.value) : null })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="50"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Orders above this amount get free delivery
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Delivery Time (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.delivery_time_hours ?? 24}
                      onChange={(e) => setSettings({ ...settings, delivery_time_hours: parseInt(e.target.value) || 24 })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="24"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Delivery Instructions
                  </label>
                  <textarea
                    value={settings.delivery_instructions || ''}
                    onChange={(e) => setSettings({ ...settings, delivery_instructions: e.target.value || null })}
                    rows={3}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Delivery available Monday-Friday, 9am-5pm"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>}

        {/* Shipping */}
        {showsShipping && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary-600" />
              Shipping
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="shipping_enabled"
                checked={settings.shipping_enabled ?? false}
                onCheckedChange={(checked) => setSettings({ ...settings, shipping_enabled: checked })}
              />
              <label htmlFor="shipping_enabled" className="text-sm font-medium text-neutral-900">
                Enable shipping
              </label>
            </div>

            {settings.shipping_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Default Shipping Provider
                  </label>
                  <select
                    value={settings.shipping_provider ?? ''}
                    onChange={(e) => setSettings({ ...settings, shipping_provider: e.target.value || null })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select a provider...</option>
                    <option value="USPS">USPS</option>
                    <option value="UPS">UPS</option>
                    <option value="FedEx">FedEx</option>
                    <option value="DHL">DHL</option>
                    <option value="Other">Other</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    This will be pre-selected when fulfilling shipping orders
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Flat Rate Shipping ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={settings.shipping_flat_rate_cents != null ? settings.shipping_flat_rate_cents / 100 : ''}
                      onChange={(e) => setSettings({ ...settings, shipping_flat_rate_cents: e.target.value ? parseCurrency(e.target.value) : null })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="8"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Handling Time (days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.shipping_handling_days ?? 2}
                      onChange={(e) => setSettings({ ...settings, shipping_handling_days: parseInt(e.target.value) || 2 })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="2"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Time to prepare order before shipping
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
