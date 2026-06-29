'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { CreditCard, ShoppingCart, Settings, Info, Package, Download, Wrench, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { ProtectedCard } from '@/lib/auth/ProtectedCard';
import { organizationsService } from '@/services/OrganizationsSingletonService';
import { tenantInfoService } from '@/services/TenantInfoService';

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

  // Product Type-Specific Settings
  physical_shipping_enabled: boolean;
  physical_pickup_enabled: boolean;
  physical_default_shipping_cents: number;
  digital_delivery_method: string;
  digital_access_duration_days: number | null;
  digital_download_limit: number | null;
  service_booking_lead_time_hours: number;
  service_cancellation_policy: string;
  hybrid_fulfillment_split: boolean;
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
        // Use organizationsService which has proper caching and authentication
        const result = await tenantInfoService.getCurrentUser();
        if (result.success && result.data?.user?.role) {
          setUserRole(result.data.user.role);
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
    physical_shipping_enabled: true,
    physical_pickup_enabled: true,
    physical_default_shipping_cents: 0,
    digital_delivery_method: 'download',
    digital_access_duration_days: null,
    digital_download_limit: null,
    service_booking_lead_time_hours: 24,
    service_cancellation_policy: 'flexible',
    hybrid_fulfillment_split: true,
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    physical: false,
    digital: false,
    service: false,
    hybrid: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
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

      {/* Product Type Requirements Info Card */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Type Commerce Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 mb-4">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-neutral-600">
                These settings configure commerce behavior specific to each product type.
                Sections only apply to locations that have the corresponding product type enabled.
                Expand each section to configure type-specific options.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Package className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-300">Physical</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Shipping & pickup</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                <Download className="h-4 w-4 text-violet-600" />
                <div>
                  <p className="text-xs font-medium text-violet-900 dark:text-violet-300">Digital</p>
                  <p className="text-xs text-violet-600 dark:text-violet-400">Delivery & access</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Wrench className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-300">Service</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Booking & cancellation</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                <Layers className="h-4 w-4 text-cyan-600" />
                <div>
                  <p className="text-xs font-medium text-cyan-900 dark:text-cyan-300">Hybrid</p>
                  <p className="text-xs text-cyan-600 dark:text-cyan-400">Fulfillment split</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Type-Specific Settings */}
      <ProtectedCard
        tenantId={tenantId}
        accessOptions={AccessPresets.CAN_MANAGE_TENANT_SETTINGS}
        title="Product Type Commerce Settings"
        description="Configure commerce behavior per product type"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Type-Specific Commerce Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Physical Products Section */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('physical')}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Physical Products</span>
                  <span className="text-xs text-neutral-500">— Shipping & pickup options</span>
                </div>
                {expandedSections.physical ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedSections.physical && (
                <div className="p-4 space-y-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Shipping Enabled</h4>
                      <p className="text-xs text-neutral-500">Allow shipping for physical products</p>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.physical_shipping_enabled}
                        onChange={(e) => setSettings({ ...settings, physical_shipping_enabled: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm">Enable</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Pickup Enabled</h4>
                      <p className="text-xs text-neutral-500">Allow in-store pickup for physical products</p>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.physical_pickup_enabled}
                        onChange={(e) => setSettings({ ...settings, physical_pickup_enabled: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm">Enable</span>
                    </label>
                  </div>
                  {settings.physical_shipping_enabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Default Shipping Rate ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={settings.physical_default_shipping_cents / 100}
                        onChange={(e) => setSettings({ ...settings, physical_default_shipping_cents: Math.round(parseFloat(e.target.value) * 100) })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded"
                      />
                      <p className="text-xs text-neutral-500 mt-1">Default flat shipping rate in dollars (0 = free shipping)</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Digital Products Section */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('digital')}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-violet-600" />
                  <span className="font-medium">Digital Products</span>
                  <span className="text-xs text-neutral-500">— Delivery & access control</span>
                </div>
                {expandedSections.digital ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedSections.digital && (
                <div className="p-4 space-y-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div>
                    <label className="block text-sm font-medium mb-2">Delivery Method</label>
                    <select
                      value={settings.digital_delivery_method}
                      onChange={(e) => setSettings({ ...settings, digital_delivery_method: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded"
                    >
                      <option value="download">Download Link</option>
                      <option value="email">Email Delivery</option>
                      <option value="both">Both (Download + Email)</option>
                    </select>
                    <p className="text-xs text-neutral-500 mt-1">How digital products are delivered to customers</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Access Duration (days)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Unlimited"
                        value={settings.digital_access_duration_days ?? ''}
                        onChange={(e) => setSettings({ ...settings, digital_access_duration_days: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded"
                      />
                      <p className="text-xs text-neutral-500 mt-1">How long customers have access (0 = unlimited)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Download Limit</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Unlimited"
                        value={settings.digital_download_limit ?? ''}
                        onChange={(e) => setSettings({ ...settings, digital_download_limit: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded"
                      />
                      <p className="text-xs text-neutral-500 mt-1">Max downloads per purchase (0 = unlimited)</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Service Products Section */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('service')}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-600" />
                  <span className="font-medium">Service Products</span>
                  <span className="text-xs text-neutral-500">— Booking & cancellation</span>
                </div>
                {expandedSections.service ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedSections.service && (
                <div className="p-4 space-y-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div>
                    <label className="block text-sm font-medium mb-2">Booking Lead Time (hours)</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.service_booking_lead_time_hours}
                      onChange={(e) => setSettings({ ...settings, service_booking_lead_time_hours: parseInt(e.target.value) || 24 })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Minimum hours before a service can be booked</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Cancellation Policy</label>
                    <select
                      value={settings.service_cancellation_policy}
                      onChange={(e) => setSettings({ ...settings, service_cancellation_policy: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded"
                    >
                      <option value="flexible">Flexible — Full refund up to 24h before</option>
                      <option value="moderate">Moderate — Full refund up to 48h before, 50% after</option>
                      <option value="strict">Strict — No refunds within 72h of booking</option>
                    </select>
                    <p className="text-xs text-neutral-500 mt-1">Cancellation policy for service bookings</p>
                  </div>
                </div>
              )}
            </div>

            {/* Hybrid Products Section */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('hybrid')}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-600" />
                  <span className="font-medium">Hybrid Products</span>
                  <span className="text-xs text-neutral-500">— Fulfillment split</span>
                </div>
                {expandedSections.hybrid ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedSections.hybrid && (
                <div className="p-4 space-y-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Fulfillment Split</h4>
                      <p className="text-xs text-neutral-500">Ship physical component and deliver digital component separately</p>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.hybrid_fulfillment_split}
                        onChange={(e) => setSettings({ ...settings, hybrid_fulfillment_split: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm">Enable</span>
                    </label>
                  </div>
                  {settings.hybrid_fulfillment_split && (
                    <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="h-4 w-4 text-cyan-600" />
                        <h4 className="text-sm font-medium text-cyan-900 dark:text-cyan-300">How Fulfillment Split Works</h4>
                      </div>
                      <p className="text-xs text-cyan-800 dark:text-cyan-400">
                        When enabled, hybrid products will have their physical component shipped using physical product settings
                        and the digital component delivered using digital product settings. When disabled, the entire order
                        follows standard fulfillment.
                      </p>
                    </div>
                  )}
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
