'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { CreditCard, ShoppingCart, Settings, Info, ArrowLeft } from 'lucide-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useRouter } from 'next/navigation';
import { organizationsService } from '@/services/OrganizationsSingletonService';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';

interface OrganizationCommerceSettings {
  // Overall commerce availability
  commerce_enabled: boolean;
  
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

interface TenantScopedOrgCommerceSettingsProps {
  params: Promise<{ tenantId: string }>;
}

export default function TenantScopedOrgCommerceSettings({ params }: TenantScopedOrgCommerceSettingsProps) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [settings, setSettings] = useState<OrganizationCommerceSettings>({
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
    commerce_enabled: true,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [organizationTier, setOrganizationTier] = useState<string>('');

  useEffect(() => {
    const initializeData = async () => {
      const { tenantId: resolvedTenantId } = await params;
      setTenantId(resolvedTenantId);

      try {
        // Get tenant info to find organization
        const tenantResponse = await platformHomeService.getTenant(resolvedTenantId);
        if (tenantResponse?.organization?.id) {
          setOrganizationId(tenantResponse.organization.id);
          
          // Set organization tier from tenant response
          const tier = tenantResponse.subscriptionTier || '';
          setOrganizationTier(tier);

          // Fetch organization commerce settings
          const commerceSettings = await organizationsService.getOrganizationCommerceSettings(tenantResponse.organization.id);
          if (commerceSettings) {
            setSettings(commerceSettings);
          }
        }
      } catch (error) {
        console.error('Failed to initialize organization commerce settings:', error);
        setMessage({ type: 'error', text: 'Failed to load commerce settings' });
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [params]);

  const handleSave = async () => {
    if (!organizationId) return;
    
    try {
      setSaving(true);
      await organizationsService.updateOrganizationCommerceSettings(organizationId, settings);
      setMessage({ type: 'success', text: 'Commerce settings saved successfully' });
    } catch (error) {
      console.error('Failed to save commerce settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded mb-6"></div>
          <div className="h-32 bg-neutral-200 rounded mb-6"></div>
          <div className="h-48 bg-neutral-200 rounded"></div>
        </div>
      </div>
    );
  }

  const getCommerceMode = () => {
    const hasDeposit = settings.deposit_enabled;
    const hasFullPayment = settings.full_payment_enabled;
    
    if (hasDeposit && hasFullPayment) return '💳💰 Both Options Available';
    if (hasDeposit && !hasFullPayment) return '💳 Deposit Only';
    if (!hasDeposit && hasFullPayment) return '💰 Full Payment Only';
    return '❌ No Payment Options';
  };

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Organization Commerce Settings"
        description="Configure organization-wide payment and order settings"
        icon={Icons.Settings}
        backLink={{
          href: `/t/${tenantId}/settings/organization`,
          label: 'Back to Organization'
        }}
      />

      {/* Current Status */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Current Commerce Mode</h2>
                <p className="text-sm text-neutral-600">
                  These settings apply to all locations in your organization unless overridden at the tenant level
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-sm">
                  Tier: {organizationTier}
                </Badge>
                <Badge variant="outline" className="text-sm">
                  {getCommerceMode()}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Commerce Disabled Warning */}
      {!settings.commerce_enabled && (
        <Card>
          <CardContent className="pt-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-800">Commerce Not Available</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Your organization tier doesn't support commerce features. Upgrade your subscription to enable payment processing and checkout for all locations.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Options */}
      {settings.commerce_enabled && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Deposit Settings */}
          {settings.deposit_enabled && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Deposit Payments</h3>
                <p className="text-sm text-neutral-600">
                  Require customers to pay a deposit to reserve items
                </p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.deposit_enabled}
                  onChange={(e) => setSettings({ ...settings, deposit_enabled: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Enable deposits</span>
              </label>
            </div>

            {settings.deposit_enabled && (
              <div className="ml-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Deposit Percentage (%)</label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={settings.deposit_percentage}
                    onChange={(e) => setSettings({ ...settings, deposit_percentage: parseInt(e.target.value) || 15 })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Percentage of total order amount required as deposit (5-50%)</p>
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
          {settings.full_payment_enabled && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Full Payment</h3>
                <p className="text-sm text-neutral-600">
                  Allow customers to pay the full amount upfront
                </p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.full_payment_enabled}
                  onChange={(e) => setSettings({ ...settings, full_payment_enabled: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Enable full payment</span>
              </label>
            </div>
          </div>
          )}

          {/* Both Options Available Info */}
          {settings.deposit_enabled && settings.full_payment_enabled && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-blue-900">Both Payment Options Available</h4>
              </div>
              <p className="text-sm text-blue-800">
                When you enable both deposit and full payment options, customers will be able to choose 
                which payment method they prefer during checkout. Individual locations can override these 
                organization settings if needed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Order Management */}
      {settings.commerce_enabled && (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Order Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Auto-Confirm Orders</h3>
                <p className="text-sm text-neutral-600">
                  Automatically confirm orders when payment is received
                </p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_confirm_orders}
                  onChange={(e) => setSettings({ ...settings, auto_confirm_orders: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Enable auto-confirmation</span>
              </label>
            </div>

            {settings.auto_confirm_orders && (
              <div className="ml-6">
                <label className="block text-sm font-medium mb-2">Confirmation Delay (minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={settings.order_confirmation_minutes}
                  onChange={(e) => setSettings({ ...settings, order_confirmation_minutes: parseInt(e.target.value) || 15 })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded"
                />
                <p className="text-xs text-neutral-500 mt-1">Minutes to wait before automatically confirming orders (5-1440)</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Save Button */}
      <div className="mt-8 flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => router.push(`/t/${tenantId}/settings/organization`)}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !settings.commerce_enabled}
          className="flex items-center gap-2"
        >
          {saving ? (
            <>
              <Spinner size="sm" />
              Saving...
            </>
          ) : (
            <>
              <Settings className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Messages */}
      {message && (
        <div className="mt-4">
          <Alert variant={message.type === 'error' ? 'destructive' : 'success'}>
            {message.text}
          </Alert>
        </div>
      )}
    </div>
  );
}
