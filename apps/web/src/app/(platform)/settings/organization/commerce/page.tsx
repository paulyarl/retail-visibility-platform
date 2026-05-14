'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { CreditCard, ShoppingCart, Settings, Info } from 'lucide-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { ProtectedCard } from '@/lib/auth/ProtectedCard';
import { organizationsService } from '@/services/OrganizationsSingletonService';

interface OrganizationCommerceSettings {
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

export default function OrganizationCommerceSettingsPage() {
  // Get tenantId from localStorage for access control
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
  
  // Get organizationId from URL if provided
  const [urlOrgId, setUrlOrgId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  
  // Get user role directly for platform admin detection
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const orgId = params.get('organizationId');
      if (orgId) {
        setUrlOrgId(orgId);
        setOrganizationId(orgId);
      }
    }
  }, []);

  // Fetch user role directly for platform admin detection
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (data.user?.role) {
          setUserRole(data.user.role);
        }
      } catch (error) {
        console.error('Failed to fetch user role:', error);
      }
    };

    fetchUserRole();
  }, []);
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
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Use centralized access control
  const {
    hasAccess,
    loading: accessLoading,
    tenantRole,
    organizationData: orgDataFromHook,
  } = useAccessControl(
    tenantId,
    AccessPresets.ORGANIZATION_MEMBER,
    true // Fetch organization data
  );

  useEffect(() => {
    if (orgDataFromHook) {
      setOrganizationId(orgDataFromHook.id);
    }
  }, [orgDataFromHook]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!organizationId) return;
      
      try {
        setLoading(true);
        const response = await organizationsService.getOrganizationCommerceSettings(organizationId);
        if (response) {
          setSettings(response);
        }
      } catch (error) {
        console.error('Failed to fetch organization commerce settings:', error);
        setMessage({ type: 'error', text: 'Failed to load commerce settings' });
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      fetchSettings();
    }
  }, [organizationId]);

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

  // Access control
  if (accessLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  // Allow access for platform admins and tenant owners
  // Platform admins should have access regardless of tenant context
  const allowedRoles = ['PLATFORM_ADMIN', 'OWNER', 'TENANT_OWNER'];
  const userCanAccess = allowedRoles.includes(tenantRole || '') || hasAccess || userRole === 'PLATFORM_ADMIN';

  // Organization selection when no organization context exists
  if (!orgDataFromHook && !urlOrgId && !organizationId) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Select Organization"
          description="Choose an organization to manage commerce settings"
          icon={Icons.Settings}
          backLink={{
            href: '/settings/organization',
            label: 'Back to Organization'
          }}
        />
        
        <Card withBorder padding="lg" radius="md">
          <div className="space-y-6">
            {(userRole === 'PLATFORM_ADMIN' || tenantRole === 'PLATFORM_ADMIN') ? (
              <>
                <div>
                  <h2 className="text-xl font-semibold mb-4">Available Organizations</h2>
                  <p className="text-neutral-600 mb-6">
                    As a Platform Admin, you can manage commerce settings for any organization in the system.
                  </p>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    Select an Organization
                  </h3>
                  <p className="text-blue-700 mb-4">
                    Please go back to the organization dashboard and select an organization to manage its commerce settings.
                  </p>
                  <Button
                    variant="gradient"
                    style={{color: 'white'}}
                    onClick={() => window.location.href = '/settings/organization'}
                  >
                    Go to Organization Selection
                  </Button>
                </div>
              </>
            ) : ['OWNER', 'TENANT_OWNER', 'TENANT_ADMIN'].includes(tenantRole || '') ? (
              <div className="text-center py-8">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-md mx-auto">
                  <h3 className="text-lg font-semibold text-amber-900 mb-2">
                    Access Your Organization via Tenant Dashboard
                  </h3>
                  <p className="text-amber-700 mb-4">
                    To manage your organization commerce settings, please access through your tenant dashboard.
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-amber-600">
                      Go to: <code className="bg-amber-100 px-2 py-1 rounded">/t/[tenantId]/settings/organization/commerce</code>
                    </p>
                    <p className="text-xs text-amber-500">
                      Replace [tenantId] with your actual tenant ID
                    </p>
                  </div>
                  <Button
                    variant="gradient"
                    style={{color: 'white'}}
                    onClick={() => window.location.href = '/settings'}
                    className="mt-4"
                  >
                    Return to Settings
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">
                    Access Restricted
                  </h3>
                  <p className="text-red-700 mb-4">
                    Organization commerce settings are only available to organization administrators.
                  </p>
                  <Button
                    variant="gradient"
                    style={{color: 'white'}}
                    onClick={() => window.location.href = '/settings'}
                    className="mt-4"
                  >
                    Return to Settings
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (!userCanAccess) {
    return (
      <AccessDenied
        pageTitle="Organization Commerce Settings"
        pageDescription="Manage organization-wide commerce settings"
        title="Access Restricted"
        message="Organization commerce settings are only available to organization administrators."
        userRole={tenantRole}
        backLink={{ href: '/settings/organization', label: 'Back to Organization' }}
      />
    );
  }

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
          href: '/settings/organization',
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
              <Badge variant="outline" className="text-sm">
                {getCommerceMode()}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Payment Options */}
      <ProtectedCard
        tenantId={tenantId}
        accessOptions={AccessPresets.CAN_MANAGE_TENANT_BILLING}
        title="Payment Options"
        description="Configure available payment methods for customers"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Deposit Settings */}
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

            {/* Full Payment Settings */}
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
      </ProtectedCard>

      {/* Order Management */}
      <ProtectedCard
        tenantId={tenantId}
        accessOptions={AccessPresets.CAN_MANAGE_TENANT_SETTINGS}
        title="Order Management"
        description="Configure order processing and confirmation settings"
      >
        <Card>
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
      </ProtectedCard>

      {/* Save Button */}
      <div className="mt-8 flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => window.location.href = '/settings/organization'}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
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
