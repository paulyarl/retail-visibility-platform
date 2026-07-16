'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  Text, 
  Group, 
  Button, 
  Badge, 
  Tabs, 
  Stack,
  Grid,
  Divider,
  Alert,
  Title,
  Breadcrumbs,
  Anchor
} from '@mantine/core';
import { manualBillingService } from '@/services/ManualBillingService';
import { 
  IconFileInvoice, 
  IconCreditCard, 
  IconReceipt, 
  IconPlus,
  IconAlertTriangle,
  IconCheck,
  IconShield
} from '@tabler/icons-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import ManualInvoicesTab from './components/ManualInvoicesTab';
import PaymentMethodsTab from './components/PaymentMethodsTab';
import ServiceChargesTab from './components/ServiceChargesTab';
import AllInvoicesTab from './components/AllInvoicesTab';
import SubscriptionControlTab from './components/SubscriptionControlTab';
import { clientLogger } from '@/lib/client-logger';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function ManualBillingPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('invoices');
  const [stats, setStats] = useState({
    manualInvoices: 0,
    manualPaymentMethods: 0,
    serviceCharges: 0,
    automatedInvoices: 0,
    pendingInvoices: 0,
    manualControlActive: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchStats();
    }
  }, [mounted]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      
      // Fetch all data in parallel
      const [manualInvoices, allInvoices, paymentMethods, serviceCharges] = await Promise.all([
        manualBillingService.getAllManualInvoices(),
        manualBillingService.getAllInvoices(),
        manualBillingService.getAllManualPaymentMethods(),
        manualBillingService.getAllServiceCharges()
      ]);

      // Calculate statistics
      const automatedInvoices = allInvoices.filter(inv => !inv.isManual).length;
      const pendingInvoices = allInvoices.filter(inv => inv.status === 'pending').length;
      const manualControlActive = allInvoices.filter(inv => 
        inv.tenantName && inv.tenantName.includes('Manual Control')
      ).length; // This is a placeholder - would need proper tenant data

      setStats({
        manualInvoices: manualInvoices.length,
        manualPaymentMethods: paymentMethods.length,
        serviceCharges: serviceCharges.length,
        automatedInvoices: automatedInvoices,
        pendingInvoices: pendingInvoices,
        manualControlActive: manualControlActive
      });
    } catch (error) {
      clientLogger.error('Error fetching stats:', { detail: error });
    } finally {
      setStatsLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Breadcrumbs className="mb-4">
          <Anchor href="/settings/admin">Admin</Anchor>
          <Anchor href="/settings/admin/billing">Billing</Anchor>
          <Text>Manual Billing</Text>
        </Breadcrumbs>
        
        <PageHeader
          title="Manual Billing Management"
          description="Override automated billing, manage manual invoices, and handle service charges"
          icon={Icons.FileInvoice}
          backLink={{ href: '/settings/admin/billing', label: 'Back to Billing' }}
          actions={
            <Group>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  // Will be implemented based on active tab
                  if (activeTab === 'invoices') {
                    // Open create invoice modal
                  } else if (activeTab === 'payment-methods') {
                    // Open add payment method modal
                  } else if (activeTab === 'service-charges') {
                    // Open add service charge modal
                  }
                }}
              >
                Create New
              </Button>
            </Group>
          }
        />
      </div>

      {/* Info Alert */}
      <Alert
        icon={<IconAlertTriangle size={16} />}
        title="Executive Control"
        color="amber"
        variant="light"
      >
        <Text size="sm">
          Manual billing provides executive control over the automated billing system. Use these tools to override automated processes, 
          handle non-standard billing scenarios, and manage payment methods that fall outside the normal subscription flow.
        </Text>
      </Alert>

      {/* Main Content */}
      <Card shadow="sm" padding="lg" withBorder>
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'invoices')} variant="outline">
          <Tabs.List>
            <Tabs.Tab 
              value="invoices" 
              leftSection={<IconFileInvoice size={16} />}
            >
              Manual Invoices
            </Tabs.Tab>
            <Tabs.Tab 
              value="all-invoices" 
              leftSection={<IconReceipt size={16} />}
            >
              All Invoices
            </Tabs.Tab>
            <Tabs.Tab 
              value="subscription-control" 
              leftSection={<IconShield size={16} />}
            >
              Subscription Control
            </Tabs.Tab>
            <Tabs.Tab 
              value="payment-methods" 
              leftSection={<IconCreditCard size={16} />}
            >
              Payment Methods
            </Tabs.Tab>
            <Tabs.Tab 
              value="service-charges" 
              leftSection={<IconReceipt size={16} />}
            >
              Service Charges
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="invoices" pt="md">
            <ManualInvoicesTab />
          </Tabs.Panel>

          <Tabs.Panel value="all-invoices" pt="md">
            <AllInvoicesTab />
          </Tabs.Panel>

          <Tabs.Panel value="subscription-control" pt="md">
            <SubscriptionControlTab />
          </Tabs.Panel>

          <Tabs.Panel value="payment-methods" pt="md">
            <PaymentMethodsTab />
          </Tabs.Panel>

          <Tabs.Panel value="service-charges" pt="md">
            <ServiceChargesTab />
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Quick Stats */}
      <Grid>
        <Grid.Col span={2}>
          <Card shadow="sm" padding="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" color="dimmed">Manual Invoices</Text>
                {statsLoading ? (
                  <div className="animate-pulse h-6 w-8 bg-gray-200 rounded"></div>
                ) : (
                  <Text size="lg" fw={500}>{stats.manualInvoices}</Text>
                )}
              </div>
              <IconFileInvoice size={20} color="blue" />
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={2}>
          <Card shadow="sm" padding="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" color="dimmed">Automated Invoices</Text>
                {statsLoading ? (
                  <div className="animate-pulse h-6 w-8 bg-gray-200 rounded"></div>
                ) : (
                  <Text size="lg" fw={500}>{stats.automatedInvoices}</Text>
                )}
              </div>
              <IconReceipt size={20} color="green" />
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={2}>
          <Card shadow="sm" padding="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" color="dimmed">Pending</Text>
                {statsLoading ? (
                  <div className="animate-pulse h-6 w-8 bg-gray-200 rounded"></div>
                ) : (
                  <Text size="lg" fw={500}>{stats.pendingInvoices}</Text>
                )}
              </div>
              <IconAlertTriangle size={20} color="yellow" />
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={2}>
          <Card shadow="sm" padding="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" color="dimmed">Payment Methods</Text>
                {statsLoading ? (
                  <div className="animate-pulse h-6 w-8 bg-gray-200 rounded"></div>
                ) : (
                  <Text size="lg" fw={500}>{stats.manualPaymentMethods}</Text>
                )}
              </div>
              <IconCreditCard size={20} color="purple" />
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={2}>
          <Card shadow="sm" padding="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" color="dimmed">Service Charges</Text>
                {statsLoading ? (
                  <div className="animate-pulse h-6 w-8 bg-gray-200 rounded"></div>
                ) : (
                  <Text size="lg" fw={500}>{stats.serviceCharges}</Text>
                )}
              </div>
              <IconReceipt size={20} color="orange" />
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={2}>
          <Card shadow="sm" padding="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" color="dimmed">Manual Control</Text>
                {statsLoading ? (
                  <div className="animate-pulse h-6 w-8 bg-gray-200 rounded"></div>
                ) : (
                  <Text size="lg" fw={500}>{stats.manualControlActive}</Text>
                )}
              </div>
              <IconShield size={20} color="red" />
            </Group>
          </Card>
        </Grid.Col>
      </Grid>
    </div>
  );
}
