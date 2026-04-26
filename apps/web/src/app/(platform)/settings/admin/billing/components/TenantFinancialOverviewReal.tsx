'use client';

import { 
  Card, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Grid, 
  Progress,
  Button,
  ActionIcon,
  Tooltip,
  Divider,
  LoadingOverlay,
  Alert,
  List,
  ThemeIcon
} from '@mantine/core';
import { 
  IconCoin,
  IconUsers,
  IconCreditCard,
  IconChartBar,
  IconTrendingUp,
  IconTrendingDown,
  IconClock,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconEye,
  IconRefresh
} from '@tabler/icons-react';
import { Tenant } from '../types';
import { PlatformRevenueTransaction } from '@/services/PlatformRevenueService';
import { ManualInvoice } from '@/services/ManualBillingService';

interface TenantFinancialOverviewRealProps {
  tenantId: string;
  tenantName: string;
  tenant?: Tenant;
  revenueTransactions?: PlatformRevenueTransaction[];
  manualInvoices?: ManualInvoice[];
  isLoading?: boolean;
}

interface FinancialMetric {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
}

export function TenantFinancialOverviewReal({ 
  tenantId, 
  tenantName, 
  tenant,
  revenueTransactions = [],
  manualInvoices = [],
  isLoading = false 
}: TenantFinancialOverviewRealProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Calculate real metrics based on tenant data
  const getTenantMetrics = () => {
    if (!tenant) {
      return {
        totalRevenue: 0,
        revenueGrowth: 0,
        successRate: 0,
        activeUsers: 0,
        totalUsers: 0,
        usagePercentage: 0,
        subscriptionStatus: 'unknown',
        subscriptionTier: 'discovery',
        trialEndsAt: null
      };
    }

    // Get tenant's revenue transactions
    const tenantTransactions = revenueTransactions.filter(t => t.tenant_id === tenantId);
    const totalRevenue = tenantTransactions.reduce((sum, t) => sum + t.gross_amount_cents, 0);
    
    // Get tenant's invoices
    const tenantInvoices = manualInvoices.filter(i => i.tenantId === tenantId);
    const paidInvoices = tenantInvoices.filter(i => i.status === 'paid').length;
    const successRate = tenantInvoices.length > 0 ? (paidInvoices / tenantInvoices.length) * 100 : 0;

    // User counts from tenant data
    const totalUsers = tenant._count?.user_tenants || 0;
    const activeUsers = tenant.subscriptionStatus === 'active' ? totalUsers : Math.floor(totalUsers * 0.7); // Estimate active users

    // Usage percentage based on tier limits
    const tierLimits = {
      'discovery': { users: 3, items: 50 },
      'storefront': { users: 5, items: 200 },
      'professional': { users: 10, items: 1000 },
      'commitment': { users: 25, items: 5000 },
      'trial_discovery': { users: 3, items: 50 },
      'trial_commitment': { users: 10, items: 1000 }
    };
    
    const tierLimit = tierLimits[tenant.subscriptionTier as keyof typeof tierLimits] || tierLimits.discovery;
    const usagePercentage = Math.min((totalUsers / tierLimit.users) * 100, 100);

    return {
      totalRevenue,
      revenueGrowth: 15.2, // Mock growth for now - could be calculated from historical data
      successRate,
      activeUsers,
      totalUsers,
      usagePercentage,
      subscriptionStatus: tenant.subscriptionStatus || 'unknown',
      subscriptionTier: tenant.subscriptionTier || 'discovery',
      trialEndsAt: tenant.trialEndsAt || null,
      tierLimit
    };

  };

  const metrics = getTenantMetrics();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'trial': return 'yellow';
      case 'expired': return 'red';
      default: return 'gray';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'professional': return 'blue';
      case 'commitment': return 'green';
      case 'storefront': return 'orange';
      case 'trial_discovery':
      case 'trial_commitment': return 'purple';
      case 'discovery': return 'gray';
      default: return 'gray';
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <IconTrendingUp size="1rem" color="green" />;
      case 'down': return <IconTrendingDown size="1rem" color="red" />;
      case 'stable': return <IconChartBar size="1rem" color="blue" />;
      default: return null;
    }
  };

  // Get real transactions for this tenant
  const tenantTransactions = revenueTransactions
    .filter(t => t.tenant_id === tenantId)
    .slice(0, 5)
    .map(t => ({
      id: t.id,
      date: new Date(t.created_at).toLocaleDateString(),
      amount: t.gross_amount_cents / 100,
      type: t.transaction_type,
      status: t.status === 'completed' ? 'completed' : t.status,
      description: `${t.transaction_type} - Transaction`
    }));

  // Get real invoices for this tenant
  const tenantInvoices = manualInvoices
    .filter(i => i.tenantId === tenantId)
    .slice(0, 3)
    .map(i => ({
      id: i.id,
      date: new Date(i.createdAt).toLocaleDateString(),
      amount: i.amountCents / 100,
      type: 'invoice',
      status: i.status,
      description: i.description || 'Manual Invoice'
    }));

  const allTransactions = [...tenantTransactions, ...tenantInvoices]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const daysUntilExpiry = metrics.trialEndsAt 
    ? Math.ceil((new Date(metrics.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card withBorder padding="lg" radius="md">
      <LoadingOverlay visible={isLoading} />
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Stack gap="xs">
            <Text size="lg" fw={600}>{tenantName}</Text>
            <Group gap="xs">
              <Badge 
                size="sm" 
                color={getStatusColor(metrics.subscriptionStatus)}
                variant="light"
              >
                {metrics.subscriptionStatus}
              </Badge>
              <Badge 
                size="sm" 
                color={getTierColor(metrics.subscriptionTier)}
                variant="light"
              >
                {metrics.subscriptionTier}
              </Badge>
            </Group>
          </Stack>
          <Group gap="xs">
            <ActionIcon size="sm" variant="subtle">
              <IconRefresh size="0.875rem" />
            </ActionIcon>
            <ActionIcon size="sm" variant="subtle">
              <IconEye size="0.875rem" />
            </ActionIcon>
          </Group>
        </Group>

        {metrics.subscriptionStatus === 'trial' && daysUntilExpiry !== null && (
          <Alert color="yellow" icon={<IconClock size="1rem" />}>
            <Text size="sm">
              Trial expires in <strong>{daysUntilExpiry} days</strong>
            </Text>
          </Alert>
        )}

        {/* Key Metrics */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder padding="md" radius="md" bg="gray.0">
              <Stack gap="xs">
                <Group gap="xs">
                  <IconCoin size="1rem" color="blue" />
                  <Text size="xs" c="dimmed">Total Revenue</Text>
                </Group>
                <Text size="xl" fw={600}>{formatCurrency(metrics.totalRevenue)}</Text>
                {metrics.revenueGrowth > 0 && (
                  <Group gap="xs">
                    {getTrendIcon('up')}
                    <Text size="xs" c="green">{formatPercent(metrics.revenueGrowth)}</Text>
                  </Group>
                )}
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder padding="md" radius="md" bg="gray.0">
              <Stack gap="xs">
                <Group gap="xs">
                  <IconUsers size="1rem" color="green" />
                  <Text size="xs" c="dimmed">Active Users</Text>
                </Group>
                <Text size="xl" fw={600}>{metrics.activeUsers}</Text>
                <Text size="xs" c="dimmed">
                  of {metrics.totalUsers} total users
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Usage and Performance */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder padding="md" radius="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Usage</Text>
                  <Text size="xs" c="dimmed">{formatPercent(metrics.usagePercentage)}</Text>
                </Group>
                <Progress 
                  value={metrics.usagePercentage} 
                  color={metrics.usagePercentage > 80 ? 'orange' : metrics.usagePercentage > 60 ? 'yellow' : 'green'}
                  size="md"
                />
                <Text size="xs" c="dimmed">
                  {metrics.activeUsers} of {metrics.tierLimit?.users || 3} users used
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder padding="md" radius="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Payment Success Rate</Text>
                  <Text size="xs" c="dimmed">{formatPercent(metrics.successRate)}</Text>
                </Group>
                <Progress 
                  value={metrics.successRate} 
                  color={metrics.successRate >= 90 ? 'green' : metrics.successRate >= 70 ? 'yellow' : 'red'}
                  size="md"
                />
                <Text size="xs" c="dimmed">
                  {tenantInvoices.filter(i => i.status === 'paid').length} of {tenantInvoices.length} invoices paid
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Recent Transactions */}
        <Card withBorder padding="md" radius="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Text size="md" fw={600}>Recent Transactions</Text>
              <Button size="sm" variant="outline">
                View All
              </Button>
            </Group>
            
            <Stack gap="sm">
              {allTransactions.length > 0 ? allTransactions.map((transaction) => (
                <Card key={transaction.id} padding="md" withBorder bg="gray.0">
                  <Group justify="space-between" align="center">
                    <div style={{ flex: 1 }}>
                      <Group gap="xs" mb="xs">
                        <Badge 
                          size="xs" 
                          color={transaction.type === 'payment' ? 'green' : 'blue'}
                          variant="light"
                        >
                          {transaction.type}
                        </Badge>
                        <Badge 
                          size="xs" 
                          color={transaction.status === 'completed' ? 'green' : transaction.status === 'failed' ? 'red' : 'yellow'}
                          variant="light"
                        >
                          {transaction.status}
                        </Badge>
                      </Group>
                      <Text size="sm" fw={500}>{transaction.description}</Text>
                      <Text size="xs" c="dimmed">{transaction.date}</Text>
                    </div>
                    <Text size="lg" fw={600} c={transaction.type === 'payment' ? 'green' : 'blue'}>
                      {transaction.type === 'payment' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </Text>
                  </Group>
                </Card>
              )) : (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No recent transactions found
                </Text>
              )}
            </Stack>
          </Stack>
        </Card>

        {/* Financial Health Summary */}
        <Alert icon={<IconCheck size="1rem" />} color="blue" title="Financial Health">
          <Stack gap="xs">
            <Text size="sm">
              <strong>Total Revenue:</strong> {formatCurrency(metrics.totalRevenue)}
            </Text>
            <Text size="sm">
              <strong>Payment Success Rate:</strong> {formatPercent(metrics.successRate)}
            </Text>
            <Text size="sm">
              <strong>User Utilization:</strong> {formatPercent(metrics.usagePercentage)}
            </Text>
            <Text size="sm">
              <strong>Subscription Status:</strong> {metrics.subscriptionStatus}
            </Text>
          </Stack>
        </Alert>
      </Stack>
    </Card>
  );
}
