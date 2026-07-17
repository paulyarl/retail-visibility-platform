'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, Alert, Title, Text, Stack, Group, Switch, TextInput, Select, Loader, Box, SimpleGrid } from '@mantine/core';
import { CreditCard, ShoppingCart, Settings, Info, Package, Download, Wrench, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { ProtectedCard } from '@/lib/auth/ProtectedCard';
import { organizationsService } from '@/services/OrganizationsSingletonService';
import { tenantInfoService } from '@/services/TenantInfoService';
import { clientLogger } from '@/lib/client-logger';

export const dynamic = 'force-dynamic';

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
  const [tenantId, setTenantId] = useState<string | null>(null);
  
  // Get organizationId from URL if provided
  const [urlOrgId, setUrlOrgId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  
  // Get user role directly for platform admin detection
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    setTenantId(localStorage.getItem('tenantId'));
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
        clientLogger.error('Failed to fetch user role:', { detail: error });
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
        clientLogger.error('Failed to fetch organization commerce settings:', { detail: error });
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
      clientLogger.error('Failed to save commerce settings:', { detail: error });
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  // Access control
  if (accessLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Loader size="lg" />
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
          <Stack gap="lg">
            {(userRole === 'PLATFORM_ADMIN' || tenantRole === 'PLATFORM_ADMIN') ? (
              <>
                <div>
                  <Title order={2} mb="sm">Available Organizations</Title>
                  <Text c="dimmed" mb="lg">
                    As a Platform Admin, you can manage commerce settings for any organization in the system.
                  </Text>
                </div>
                
                <Box bg="blue.0" p="lg" style={{ border: '1px solid var(--mantine-color-blue-2)', borderRadius: 'var(--mantine-radius-md)' }}>
                  <Title order={3} c="blue.9" mb="xs">
                    Select an Organization
                  </Title>
                  <Text c="blue.7" mb="md">
                    Please go back to the organization dashboard and select an organization to manage its commerce settings.
                  </Text>
                  <Button
                    variant="gradient"
                    onClick={() => window.location.href = '/settings/organization'}
                  >
                    Go to Organization Selection
                  </Button>
                </Box>
              </>
            ) : ['OWNER', 'TENANT_OWNER', 'TENANT_ADMIN'].includes(tenantRole || '') ? (
              <div className="text-center py-8">
                <Box bg="amber.0" p="lg" maw={400} mx="auto" style={{ border: '1px solid var(--mantine-color-amber-2)', borderRadius: 'var(--mantine-radius-md)' }}>
                  <Title order={3} c="amber.9" mb="xs">
                    Access Your Organization via Tenant Dashboard
                  </Title>
                  <Text c="amber.7" mb="md">
                    To manage your organization commerce settings, please access through your tenant dashboard.
                  </Text>
                  <div className="space-y-2">
                    <Text size="sm" c="amber.6">
                      Go to: <code style={{ backgroundColor: 'var(--mantine-color-amber-1)', padding: '2px 6px', borderRadius: 4 }}>/t/[tenantId]/settings/organization/commerce</code>
                    </Text>
                    <Text size="xs" c="amber.5">
                      Replace [tenantId] with your actual tenant ID
                    </Text>
                  </div>
                  <Button
                    variant="gradient"
                    onClick={() => window.location.href = '/settings'}
                    mt="md"
                  >
                    Return to Settings
                  </Button>
                </Box>
              </div>
            ) : (
              <div className="text-center py-8">
                <Box bg="red.0" p="lg" maw={400} mx="auto" style={{ border: '1px solid var(--mantine-color-red-2)', borderRadius: 'var(--mantine-radius-md)' }}>
                  <Title order={3} c="red.9" mb="xs">
                    Access Restricted
                  </Title>
                  <Text c="red.7" mb="md">
                    Organization commerce settings are only available to organization administrators.
                  </Text>
                  <Button
                    variant="gradient"
                    onClick={() => window.location.href = '/settings'}
                    mt="md"
                  >
                    Return to Settings
                  </Button>
                </Box>
              </div>
            )}
          </Stack>
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
        <Card withBorder p="lg">
          <Group justify="space-between">
            <div>
              <Title order={3}>Current Commerce Mode</Title>
              <Text size="sm" c="dimmed">
                These settings apply to all locations in your organization unless overridden at the tenant level
              </Text>
            </div>
            <Badge variant="outline" size="lg">
              {getCommerceMode()}
            </Badge>
          </Group>
        </Card>
      </div>

      {/* Payment Options */}
      <ProtectedCard
        tenantId={tenantId}
        accessOptions={AccessPresets.CAN_MANAGE_TENANT_BILLING}
        title="Payment Options"
        description="Configure available payment methods for customers"
      >
        <Card withBorder p="lg">
          <Stack gap="md">
            <Group gap="sm">
              <CreditCard size={20} />
              <Title order={3}>Payment Options</Title>
            </Group>
            
            {/* Deposit Settings */}
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Text fw={600}>Deposit Payments</Text>
                  <Text size="sm" c="dimmed">
                    Require customers to pay a deposit to reserve items
                  </Text>
                </div>
                <Switch
                  label="Enable deposits"
                  checked={settings.deposit_enabled}
                  onChange={(e) => setSettings({ ...settings, deposit_enabled: e.currentTarget.checked })}
                />
              </Group>

              {settings.deposit_enabled && (
                <Stack gap="md" ml="lg">
                  <div>
                    <Text size="sm" fw={500} mb={4}>Deposit Percentage (%)</Text>
                    <TextInput
                      type="number"
                      min={5}
                      max={50}
                      value={settings.deposit_percentage}
                      onChange={(e) => setSettings({ ...settings, deposit_percentage: parseInt(e.target.value) || 15 })}
                    />
                    <Text size="xs" c="dimmed" mt={4}>Percentage of total order amount required as deposit (5-50%)</Text>
                  </div>

                  <SimpleGrid cols={2} spacing="md">
                    <div>
                      <Text size="sm" fw={500} mb={4}>Minimum Deposit ($)</Text>
                      <TextInput
                        type="number"
                        min={0}
                        step="1"
                        value={settings.deposit_min_cents / 100}
                        onChange={(e) => setSettings({ ...settings, deposit_min_cents: Math.round(parseFloat(e.target.value) * 100) })}
                      />
                    </div>
                    <div>
                      <Text size="sm" fw={500} mb={4}>Maximum Deposit ($)</Text>
                      <TextInput
                        type="number"
                        min={0}
                        step="1"
                        value={settings.deposit_max_cents / 100}
                        onChange={(e) => setSettings({ ...settings, deposit_max_cents: Math.round(parseFloat(e.target.value) * 100) })}
                      />
                    </div>
                  </SimpleGrid>
                </Stack>
              )}
            </Stack>

            {/* Full Payment Settings */}
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Text fw={600}>Full Payment</Text>
                  <Text size="sm" c="dimmed">
                    Allow customers to pay the full amount upfront
                  </Text>
                </div>
                <Switch
                  label="Enable full payment"
                  checked={settings.full_payment_enabled}
                  onChange={(e) => setSettings({ ...settings, full_payment_enabled: e.currentTarget.checked })}
                />
              </Group>
            </Stack>

            {/* Both Options Available Info */}
            {settings.deposit_enabled && settings.full_payment_enabled && (
              <Box bg="blue.0" p="md" style={{ border: '1px solid var(--mantine-color-blue-2)', borderRadius: 'var(--mantine-radius-md)' }}>
                <Group gap="xs" mb="xs">
                  <Info size={16} className="text-blue-600" />
                  <Text fw={500} c="blue.9">Both Payment Options Available</Text>
                </Group>
                <Text size="sm" c="blue.8">
                  When you enable both deposit and full payment options, customers will be able to choose 
                  which payment method they prefer during checkout. Individual locations can override these 
                  organization settings if needed.
                </Text>
              </Box>
            )}
          </Stack>
        </Card>
      </ProtectedCard>

      {/* Order Management */}
      <ProtectedCard
        tenantId={tenantId}
        accessOptions={AccessPresets.CAN_MANAGE_TENANT_SETTINGS}
        title="Order Management"
        description="Configure order processing and confirmation settings"
      >
        <Card withBorder p="lg">
          <Stack gap="md">
            <Group gap="sm">
              <ShoppingCart size={20} />
              <Title order={3}>Order Management</Title>
            </Group>
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Text fw={600}>Auto-Confirm Orders</Text>
                  <Text size="sm" c="dimmed">
                    Automatically confirm orders when payment is received
                  </Text>
                </div>
                <Switch
                  label="Enable auto-confirmation"
                  checked={settings.auto_confirm_orders}
                  onChange={(e) => setSettings({ ...settings, auto_confirm_orders: e.currentTarget.checked })}
                />
              </Group>

              {settings.auto_confirm_orders && (
                <div className="ml-6">
                  <Text size="sm" fw={500} mb={4}>Confirmation Delay (minutes)</Text>
                  <TextInput
                    type="number"
                    min={5}
                    max={1440}
                    value={settings.order_confirmation_minutes}
                    onChange={(e) => setSettings({ ...settings, order_confirmation_minutes: parseInt(e.target.value) || 15 })}
                  />
                  <Text size="xs" c="dimmed" mt={4}>Minutes to wait before automatically confirming orders (5-1440)</Text>
                </div>
              )}
            </Stack>
          </Stack>
        </Card>
      </ProtectedCard>

      {/* Product Type Requirements Info Card */}
      <div className="mb-6">
        <Card withBorder p="lg">
          <Stack gap="md">
            <Group gap="sm">
              <Package size={20} />
              <Title order={3}>Product Type Commerce Settings</Title>
            </Group>
            <Group gap="xs" align="flex-start">
              <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <Text size="sm" c="dimmed">
                These settings configure commerce behavior specific to each product type.
                Sections only apply to locations that have the corresponding product type enabled.
                Expand each section to configure type-specific options.
              </Text>
            </Group>
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
              <Group gap="xs" p="sm" bg="blue.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                <Package size={16} className="text-blue-600" />
                <div>
                  <Text size="xs" fw={500} c="blue.9">Physical</Text>
                  <Text size="xs" c="blue.6">Shipping & pickup</Text>
                </div>
              </Group>
              <Group gap="xs" p="sm" bg="violet.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                <Download size={16} className="text-violet-600" />
                <div>
                  <Text size="xs" fw={500} c="violet.9">Digital</Text>
                  <Text size="xs" c="violet.6">Delivery & access</Text>
                </div>
              </Group>
              <Group gap="xs" p="sm" bg="amber.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                <Wrench size={16} className="text-amber-600" />
                <div>
                  <Text size="xs" fw={500} c="amber.9">Service</Text>
                  <Text size="xs" c="amber.6">Booking & cancellation</Text>
                </div>
              </Group>
              <Group gap="xs" p="sm" bg="cyan.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                <Layers size={16} className="text-cyan-600" />
                <div>
                  <Text size="xs" fw={500} c="cyan.9">Hybrid</Text>
                  <Text size="xs" c="cyan.6">Fulfillment split</Text>
                </div>
              </Group>
            </SimpleGrid>
          </Stack>
        </Card>
      </div>

      {/* Product Type-Specific Settings */}
      <ProtectedCard
        tenantId={tenantId}
        accessOptions={AccessPresets.CAN_MANAGE_TENANT_SETTINGS}
        title="Product Type Commerce Settings"
        description="Configure commerce behavior per product type"
      >
        <Card withBorder p="lg">
          <Stack gap="md">
            <Group gap="sm">
              <Package size={20} />
              <Title order={3}>Type-Specific Commerce Settings</Title>
            </Group>
            
            {/* Physical Products Section */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('physical')}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <Group gap="xs">
                  <Package size={16} className="text-blue-600" />
                  <Text fw={500}>Physical Products</Text>
                  <Text size="xs" c="dimmed">— Shipping & pickup options</Text>
                </Group>
                {expandedSections.physical ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.physical && (
                <Stack gap="md" className="p-4 border-t border-neutral-200 dark:border-neutral-800">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>Shipping Enabled</Text>
                      <Text size="xs" c="dimmed">Allow shipping for physical products</Text>
                    </div>
                    <Switch
                      label="Enable"
                      checked={settings.physical_shipping_enabled}
                      onChange={(e) => setSettings({ ...settings, physical_shipping_enabled: e.currentTarget.checked })}
                    />
                  </Group>
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>Pickup Enabled</Text>
                      <Text size="xs" c="dimmed">Allow in-store pickup for physical products</Text>
                    </div>
                    <Switch
                      label="Enable"
                      checked={settings.physical_pickup_enabled}
                      onChange={(e) => setSettings({ ...settings, physical_pickup_enabled: e.currentTarget.checked })}
                    />
                  </Group>
                  {settings.physical_shipping_enabled && (
                    <div>
                      <Text size="sm" fw={500} mb={4}>Default Shipping Rate ($)</Text>
                      <TextInput
                        type="number"
                        min={0}
                        step="1"
                        value={settings.physical_default_shipping_cents / 100}
                        onChange={(e) => setSettings({ ...settings, physical_default_shipping_cents: Math.round(parseFloat(e.target.value) * 100) })}
                      />
                      <Text size="xs" c="dimmed" mt={4}>Default flat shipping rate in dollars (0 = free shipping)</Text>
                    </div>
                  )}
                </Stack>
              )}
            </div>

            {/* Digital Products Section */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('digital')}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <Group gap="xs">
                  <Download size={16} className="text-violet-600" />
                  <Text fw={500}>Digital Products</Text>
                  <Text size="xs" c="dimmed">— Delivery & access control</Text>
                </Group>
                {expandedSections.digital ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.digital && (
                <Stack gap="md" className="p-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div>
                    <Text size="sm" fw={500} mb={4}>Delivery Method</Text>
                    <Select
                      value={settings.digital_delivery_method}
                      onChange={(value) => setSettings({ ...settings, digital_delivery_method: value || 'download' })}
                      data={[
                        { value: 'download', label: 'Download Link' },
                        { value: 'email', label: 'Email Delivery' },
                        { value: 'both', label: 'Both (Download + Email)' },
                      ]}
                    />
                    <Text size="xs" c="dimmed" mt={4}>How digital products are delivered to customers</Text>
                  </div>
                  <SimpleGrid cols={2} spacing="md">
                    <div>
                      <Text size="sm" fw={500} mb={4}>Access Duration (days)</Text>
                      <TextInput
                        type="number"
                        min={0}
                        placeholder="Unlimited"
                        value={settings.digital_access_duration_days ?? ''}
                        onChange={(e) => setSettings({ ...settings, digital_access_duration_days: e.target.value ? parseInt(e.target.value) : null })}
                      />
                      <Text size="xs" c="dimmed" mt={4}>How long customers have access (0 = unlimited)</Text>
                    </div>
                    <div>
                      <Text size="sm" fw={500} mb={4}>Download Limit</Text>
                      <TextInput
                        type="number"
                        min={0}
                        placeholder="Unlimited"
                        value={settings.digital_download_limit ?? ''}
                        onChange={(e) => setSettings({ ...settings, digital_download_limit: e.target.value ? parseInt(e.target.value) : null })}
                      />
                      <Text size="xs" c="dimmed" mt={4}>Max downloads per purchase (0 = unlimited)</Text>
                    </div>
                  </SimpleGrid>
                </Stack>
              )}
            </div>

            {/* Service Products Section */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('service')}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <Group gap="xs">
                  <Wrench size={16} className="text-amber-600" />
                  <Text fw={500}>Service Products</Text>
                  <Text size="xs" c="dimmed">— Booking & cancellation</Text>
                </Group>
                {expandedSections.service ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.service && (
                <Stack gap="md" className="p-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div>
                    <Text size="sm" fw={500} mb={4}>Booking Lead Time (hours)</Text>
                    <TextInput
                      type="number"
                      min={0}
                      value={settings.service_booking_lead_time_hours}
                      onChange={(e) => setSettings({ ...settings, service_booking_lead_time_hours: parseInt(e.target.value) || 24 })}
                    />
                    <Text size="xs" c="dimmed" mt={4}>Minimum hours before a service can be booked</Text>
                  </div>
                  <div>
                    <Text size="sm" fw={500} mb={4}>Cancellation Policy</Text>
                    <Select
                      value={settings.service_cancellation_policy}
                      onChange={(value) => setSettings({ ...settings, service_cancellation_policy: value || 'flexible' })}
                      data={[
                        { value: 'flexible', label: 'Flexible — Full refund up to 24h before' },
                        { value: 'moderate', label: 'Moderate — Full refund up to 48h before, 50% after' },
                        { value: 'strict', label: 'Strict — No refunds within 72h of booking' },
                      ]}
                    />
                    <Text size="xs" c="dimmed" mt={4}>Cancellation policy for service bookings</Text>
                  </div>
                </Stack>
              )}
            </div>

            {/* Hybrid Products Section */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('hybrid')}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <Group gap="xs">
                  <Layers size={16} className="text-cyan-600" />
                  <Text fw={500}>Hybrid Products</Text>
                  <Text size="xs" c="dimmed">— Fulfillment split</Text>
                </Group>
                {expandedSections.hybrid ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.hybrid && (
                <Stack gap="md" className="p-4 border-t border-neutral-200 dark:border-neutral-800">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>Fulfillment Split</Text>
                      <Text size="xs" c="dimmed">Ship physical component and deliver digital component separately</Text>
                    </div>
                    <Switch
                      label="Enable"
                      checked={settings.hybrid_fulfillment_split}
                      onChange={(e) => setSettings({ ...settings, hybrid_fulfillment_split: e.currentTarget.checked })}
                    />
                  </Group>
                  {settings.hybrid_fulfillment_split && (
                    <Box bg="cyan.0" p="sm" style={{ border: '1px solid var(--mantine-color-cyan-2)', borderRadius: 'var(--mantine-radius-md)' }}>
                      <Group gap="xs" mb={4}>
                        <Info size={16} className="text-cyan-600" />
                        <Text size="sm" fw={500} c="cyan.9">How Fulfillment Split Works</Text>
                      </Group>
                      <Text size="xs" c="cyan.8">
                        When enabled, hybrid products will have their physical component shipped using physical product settings
                        and the digital component delivered using digital product settings. When disabled, the entire order
                        follows standard fulfillment.
                      </Text>
                    </Box>
                  )}
                </Stack>
              )}
            </div>
          </Stack>
        </Card>
      </ProtectedCard>

      {/* Save Button */}
      <Group justify="flex-end" gap="md" mt="xl">
        <Button
          variant="default"
          onClick={() => window.location.href = '/settings/organization'}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          leftSection={saving ? <Loader size={16} /> : <Settings size={16} />}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Group>

      {/* Messages */}
      {message && (
        <Alert
          color={message.type === 'error' ? 'red' : 'green'}
          mt="md"
        >
          {message.text}
        </Alert>
      )}
    </div>
  );
}
