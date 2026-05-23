'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CreditCard, ShoppingCart, DollarSign, Package, Save, AlertCircle, Info, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { useCommerceCapability, usePaymentGatewayCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface CommerceSettings {
  // Payment Options
  deposit_enabled: boolean;
  deposit_percentage: number;
  deposit_min_cents: number;
  deposit_max_cents: number;
  full_payment_enabled: boolean;
  
  // Order Management
  auto_confirm_orders: boolean;
  order_confirmation_minutes: number;
  
  // Customer Experience
  show_payment_options: boolean;
  require_payment_upfront: boolean;
  allow_payment_on_pickup: boolean;
  
  // Notifications
  notify_on_payment: boolean;
  notify_on_deposit: boolean;
  notify_on_fulfillment: boolean;
}

interface CommerceSettingsClientProps {
  tenantId: string;
}

export default function CommerceSettingsClient({ tenantId }: CommerceSettingsClientProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<CommerceSettings>({
    deposit_enabled: true,
    deposit_percentage: 15,
    deposit_min_cents: 500,
    deposit_max_cents: 5000,
    full_payment_enabled: true,
    auto_confirm_orders: true,
    order_confirmation_minutes: 15,
    show_payment_options: true,
    require_payment_upfront: false,
    allow_payment_on_pickup: true,
    notify_on_payment: true,
    notify_on_deposit: true,
    notify_on_fulfillment: true,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentTier, setCurrentTier] = useState<string>('');
  const [commerceFeatures, setCommerceFeatures] = useState<any>(null);

  // Capability-aware resolution — supersedes legacy tier-based commerce feature detection
  const commerceCap = useCommerceCapability(tenantId);
  const paymentCap = usePaymentGatewayCapability(tenantId);

  // Preset deposit percentages
  const depositPresets = [
    { label: '10%', value: 10 },
    { label: '15%', value: 15 },
    { label: '20%', value: 20 },
    { label: '25%', value: 25 },
  ];

  useEffect(() => {
    fetchSettings();
  }, [tenantId]);

  // When capability data arrives, use it as the authoritative source for
  // commerce feature state, overriding the legacy tier-based derivation.
  useEffect(() => {
    if (commerceCap.data) {
      const { enabled, paymentType } = commerceCap.data;
      setCommerceFeatures({
        commerce_disabled: !enabled || paymentType === 'none',
        commerce_deposit_only: enabled && (paymentType === 'deposit' || paymentType === 'both'),
        commerce_full_payment: enabled && (paymentType === 'full' || paymentType === 'both'),
      });
    }
  }, [commerceCap.data]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      // Fetch tenant tier info for display (tier badge)
      const tierResponse = await fetch(`/api/tenants/${tenantId}/tier`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (tierResponse.ok) {
        const tierData = await tierResponse.json();
        const tier = tierData.tier || '';
        setCurrentTier(tier);

        // Only fall back to tier-based commerce features if capability data
        // hasn't resolved yet (backward compatibility)
        if (!commerceCap.data) {
          const features = tierData.tenantTier?.features?.reduce((acc: any, feature: any) => {
            acc[feature.feature_key] = feature.is_enabled;
            return acc;
          }, {}) || {};

          setCommerceFeatures({
            commerce_disabled: !features.commerce_enabled,
            commerce_deposit_only: features.commerce_deposit_only || features.commerce_both_options,
            commerce_full_payment: features.commerce_full_payment || features.commerce_both_options,
          });
        }
      }
      
      // Fetch existing commerce settings
      const response = await platformHomeService.getTenantCommerceSettings(tenantId);
      if (response) {
        setSettings(response);
      }
    } catch (error) {
      console.error('Error fetching commerce settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      const response = await platformHomeService.updateTenantCommerceSettings(tenantId, settings);
      
      if (response) {
        setSettings(response);
        setMessage({ type: 'success', text: 'Commerce settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error saving commerce settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const getCommerceMode = () => {
    if (!commerceFeatures) return 'Unknown';
    
    if (commerceFeatures.commerce_disabled) return '❌ Commerce Disabled';
    
    // Check what merchant has enabled in their settings
    const hasDeposit = settings.deposit_enabled;
    const hasFullPayment = settings.full_payment_enabled;
    
    if (hasDeposit && hasFullPayment) return '💳💰 Both Options Available';
    if (hasDeposit && !hasFullPayment) return '� Deposit Only';
    if (!hasDeposit && hasFullPayment) return '� Full Payment Only';
    return '❌ No Payment Options';
  };

  const canControlPaymentOptions = () => {
    // Merchant can control payment options if tier supports commerce
    return commerceFeatures && !commerceFeatures.commerce_disabled;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded mb-6"></div>
          <div className="h-32 bg-neutral-200 rounded mb-6"></div>
          <div className="h-48 bg-neutral-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Commerce Settings</h1>
          <p className="text-neutral-600 mt-1">
            Configure payment options and checkout behavior for your store
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            Tier: {currentTier}
          </Badge>
          <Badge variant="outline" className="text-sm">
            {getCommerceMode()}
          </Badge>
        </div>
      </div>

      {/* Commerce Mode Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Your Commerce Capabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Current Mode:</strong> {getCommerceMode()}
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Your subscription tier determines which payment options you can offer to customers.
              {currentTier && currentTier.toLowerCase() === 'discovery' && ' Upgrade to Storefront or higher to enable commerce features.'}
              {currentTier && currentTier.toLowerCase() === 'storefront' && ' Upgrade to Commitment or higher to enable payment processing.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Commerce Disabled Warning */}
      {commerceFeatures?.commerce_disabled && (
        <Card>
          <CardContent className="pt-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-800">Commerce Not Available</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Your current tier doesn't support commerce features. Upgrade your subscription to enable payment processing and checkout.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => router.push(`/t/${tenantId}/settings/subscription`)}
                  >
                    Upgrade Subscription
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Options */}
      {commerceFeatures && !commerceFeatures.commerce_disabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Deposit Settings */}
            {commerceFeatures.commerce_deposit_only && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Deposit Payments</h3>
                    <p className="text-sm text-neutral-600">
                      Require customers to pay a deposit to reserve items
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.deposit_enabled}
                      onCheckedChange={(checked) => setSettings({ ...settings, deposit_enabled: checked })}
                    />
                    <span className="text-sm">Enable deposits</span>
                  </div>
                </div>

                {settings.deposit_enabled && (
                  <div className="ml-4 space-y-4 p-4 bg-neutral-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium mb-2">Deposit Percentage</label>
                      <div className="flex gap-2">
                        {depositPresets.map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => setSettings({ ...settings, deposit_percentage: preset.value })}
                            className={`px-3 py-1 rounded text-sm ${
                              settings.deposit_percentage === preset.value
                                ? 'bg-blue-500 text-white'
                                : 'bg-white border border-neutral-300'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <input
                          type="number"
                          min="5"
                          max="50"
                          value={settings.deposit_percentage}
                          onChange={(e) => setSettings({ ...settings, deposit_percentage: parseInt(e.target.value) || 15 })}
                          className="px-3 py-1 border border-neutral-300 rounded text-sm w-16"
                        />
                        <span className="text-sm text-neutral-600">%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Minimum Deposit ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={settings.deposit_min_cents / 100}
                          onChange={(e) => setSettings({ ...settings, deposit_min_cents: Math.round(parseFloat(e.target.value) * 100) })}
                          className="w-full px-3 py-2 border border-neutral-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Maximum Deposit ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={settings.deposit_max_cents / 100}
                          onChange={(e) => setSettings({ ...settings, deposit_max_cents: Math.round(parseFloat(e.target.value) * 100) })}
                          className="w-full px-3 py-2 border border-neutral-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Full Payment Settings */}
            {commerceFeatures.commerce_full_payment && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Full Payment</h3>
                    <p className="text-sm text-neutral-600">
                      Allow customers to pay the full amount upfront
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.full_payment_enabled}
                      onCheckedChange={(checked) => setSettings({ ...settings, full_payment_enabled: checked })}
                    />
                    <span className="text-sm">Enable full payment</span>
                  </div>
                </div>
              </div>
            )}

            {/* Both Options Available Info */}
            {commerceFeatures.commerce_deposit_only && commerceFeatures.commerce_full_payment && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <h4 className="font-medium text-blue-900">Both Payment Options Available</h4>
                </div>
                <p className="text-sm text-blue-800">
                  When you enable both deposit and full payment options, customers will be able to choose 
                  which payment method they prefer during checkout. This gives your customers maximum flexibility 
                  while you maintain control over the deposit percentage and limits.
                </p>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* Order Management */}
      {commerceFeatures && !commerceFeatures.commerce_disabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Order Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Auto-Confirm Orders</h3>
                <p className="text-sm text-neutral-600">
                  Automatically confirm orders when payment is received
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.auto_confirm_orders}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_confirm_orders: checked })}
                />
                <span className="text-sm">Auto-confirm</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Order Confirmation Time (minutes)</label>
              <input
                type="number"
                min="5"
                max="1440"
                value={settings.order_confirmation_minutes}
                onChange={(e) => setSettings({ ...settings, order_confirmation_minutes: parseInt(e.target.value) || 15 })}
                className="w-full px-3 py-2 border border-neutral-300 rounded"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Time to wait before confirming an order (5-1440 minutes)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Experience */}
      {commerceFeatures && !commerceFeatures.commerce_disabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Customer Experience
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Show Payment Options</h3>
                <p className="text-sm text-neutral-600">
                  Display available payment options to customers
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.show_payment_options}
                  onCheckedChange={(checked) => setSettings({ ...settings, show_payment_options: checked })}
                />
                <span className="text-sm">Show options</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Require Payment Upfront</h3>
                <p className="text-sm text-neutral-600">
                  Require payment before order confirmation
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.require_payment_upfront}
                  onCheckedChange={(checked) => setSettings({ ...settings, require_payment_upfront: checked })}
                />
                <span className="text-sm">Require upfront</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Allow Payment on Pickup</h3>
                <p className="text-sm text-neutral-600">
                  Allow customers to pay when they pick up their order
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.allow_payment_on_pickup}
                  onCheckedChange={(checked) => setSettings({ ...settings, allow_payment_on_pickup: checked })}
                />
                <span className="text-sm">Allow pickup payment</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      {commerceFeatures && !commerceFeatures.commerce_disabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Payment Notifications</h3>
                <p className="text-sm text-neutral-600">
                  Notify when full payment is received
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.notify_on_payment}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_payment: checked })}
                />
                <span className="text-sm">Enable</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Deposit Notifications</h3>
                <p className="text-sm text-neutral-600">
                  Notify when deposit payment is received
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.notify_on_deposit}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_deposit: checked })}
                />
                <span className="text-sm">Enable</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Fulfillment Notifications</h3>
                <p className="text-sm text-neutral-600">
                  Notify when order is ready for pickup/delivery
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.notify_on_fulfillment}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_fulfillment: checked })}
                />
                <span className="text-sm">Enable</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button 
          variant="outline"
          onClick={() => router.push(`/t/${tenantId}/settings`)}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={saving || commerceFeatures?.commerce_disabled}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
