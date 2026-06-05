'use client';

import { useState } from 'react';
import { 
  Card, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Grid, 
  Progress,
  Button,
  Select,
  ActionIcon,
  Tooltip,
  LoadingOverlay
} from '@mantine/core';
import { 
  IconCreditCard,
  IconTrendingUp,
  IconTrendingDown,
  IconAlertTriangle,
  IconRefresh,
  IconChartBar,
  IconCoin,
  IconClock
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

interface PaymentAnalyticsProps {
  refreshInterval?: number;
}

interface PaymentMetrics {
  totalRevenue: number;
  totalTransactions: number;
  successRate: number;
  averageOrderValue: number;
  failedPayments: number;
  pendingPayments: number;
  refundRate: number;
  chargebackRate: number;
}

interface PaymentTrend {
  date: string;
  revenue: number;
  transactions: number;
  successRate: number;
}

interface PaymentMethod {
  type: string;
  count: number;
  revenue: number;
  successRate: number;
}

export function PaymentAnalyticsFixed({ refreshInterval = 60000 }: PaymentAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('revenue');

  const isLoading = false;

  // Mock data for now - would be fetched from API
  const metrics: PaymentMetrics = {
    totalRevenue: 124567.89,
    totalTransactions: 3421,
    successRate: 94.7,
    averageOrderValue: 36.42,
    failedPayments: 182,
    pendingPayments: 23,
    refundRate: 2.1,
    chargebackRate: 0.3
  };

  const trends: PaymentTrend[] = [
    { date: '2024-04-01', revenue: 4234.56, transactions: 115, successRate: 95.2 },
    { date: '2024-04-02', revenue: 3891.23, transactions: 108, successRate: 93.8 },
    { date: '2024-04-03', revenue: 4567.89, transactions: 125, successRate: 96.1 },
    { date: '2024-04-04', revenue: 4123.45, transactions: 118, successRate: 94.5 },
    { date: '2024-04-05', revenue: 4789.12, transactions: 132, successRate: 95.7 },
  ];

  const paymentMethods: PaymentMethod[] = [
    { type: 'Credit Card', count: 2847, revenue: 103456.78, successRate: 95.2 },
    { type: 'PayPal', count: 456, revenue: 15678.90, successRate: 93.8 },
    { type: 'Bank Transfer', count: 118, revenue: 5432.21, successRate: 91.5 },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'green';
    if (rate >= 90) return 'yellow';
    return 'red';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <IconTrendingUp size="1rem" color="green" />;
      case 'down': return <IconTrendingDown size="1rem" color="red" />;
      default: return <IconChartBar size="1rem" color="gray" />;
    }
  };

  return (
    <Stack gap="md">
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="center">
          <div>
            <Text size="lg" fw={600}>Payment Analytics</Text>
            <Text size="sm" c="dimmed">Monitor payment performance and transaction trends</Text>
          </div>
          <Group gap="sm">
            <Select
              size="sm"
              value={selectedPeriod}
              onChange={(value) => setSelectedPeriod(value || '30d')}
              data={[
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
                { value: '90d', label: 'Last 90 days' },
                { value: '1y', label: 'Last year' },
              ]}
            />
            <ActionIcon 
              variant="light" 
              color="blue"
              loading={isLoading}
            >
              <IconRefresh size="1rem" />
            </ActionIcon>
          </Group>
        </Group>
      </Card>

      <LoadingOverlay visible={isLoading} />

      {/* Key Metrics */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconCoin size="1rem" color="blue" />
                <Text size="xs" c="dimmed">Total Revenue</Text>
              </Group>
              <Text size="xl" fw={600}>{formatCurrency(metrics.totalRevenue)}</Text>
              <Group gap="xs">
                {getTrendIcon('up')}
                <Text size="xs" c="green">+12.3%</Text>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconCreditCard size="1rem" color="green" />
                <Text size="xs" c="dimmed">Transactions</Text>
              </Group>
              <Text size="xl" fw={600}>{metrics.totalTransactions.toLocaleString()}</Text>
              <Group gap="xs">
                {getTrendIcon('up')}
                <Text size="xs" c="green">+8.7%</Text>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconChartBar size="1rem" color="purple" />
                <Text size="xs" c="dimmed">Success Rate</Text>
              </Group>
              <Text size="xl" fw={600} c={getSuccessRateColor(metrics.successRate)}>
                {formatPercentage(metrics.successRate)}
              </Text>
              <Progress 
                value={metrics.successRate} 
                color={getSuccessRateColor(metrics.successRate)}
                size="xs"
              />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconClock size="1rem" color="orange" />
                <Text size="xs" c="dimmed">Avg Order Value</Text>
              </Group>
              <Text size="xl" fw={600}>{formatCurrency(metrics.averageOrderValue)}</Text>
              <Group gap="xs">
                {getTrendIcon('up')}
                <Text size="xs" c="green">+3.2%</Text>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Payment Methods */}
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text size="md" fw={600}>Payment Methods</Text>
          
          <Stack gap="lg">
            {paymentMethods.map((method) => (
              <Card key={method.type} padding="md" withBorder bg="gray.0">
                <Group justify="space-between" align="center">
                  <div style={{ flex: 1 }}>
                    <Text size="md" fw={600}>{method.type}</Text>
                    <Text size="sm" c="dimmed">{method.count} transactions</Text>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <Text size="md" fw={600}>{formatCurrency(method.revenue)}</Text>
                    <Text size="sm" c={getSuccessRateColor(method.successRate)}>
                      {formatPercentage(method.successRate)}
                    </Text>
                  </div>
                  
                  <Progress 
                    value={method.successRate} 
                    color={getSuccessRateColor(method.successRate)}
                    size="sm"
                    style={{ width: 100 }}
                  />
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Card>

      {/* Recent Trends */}
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text size="md" fw={600}>Recent Trends</Text>
          
          <Stack gap="sm">
            {trends.slice(0, 5).map((trend) => (
              <Group key={trend.date} justify="space-between" align="center">
                <div>
                  <Text size="sm" fw={600}>{new Date(trend.date).toLocaleDateString()}</Text>
                  <Text size="xs" c="dimmed">{trend.transactions} transactions</Text>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <Text size="sm" fw={600}>{formatCurrency(trend.revenue)}</Text>
                  <Text size="xs" c={getSuccessRateColor(trend.successRate)}>
                    {formatPercentage(trend.successRate)}
                  </Text>
                </div>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Card>

      {/* Issues and Alerts */}
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text size="md" fw={600}>Payment Issues</Text>
          
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Group gap="sm">
                <IconAlertTriangle size="1rem" color="red" />
                <Text size="sm">Failed Payments</Text>
              </Group>
              <Badge size="sm" color="red">{metrics.failedPayments}</Badge>
            </Group>
            
            <Group justify="space-between" align="center">
              <Group gap="sm">
                <IconClock size="1rem" color="yellow" />
                <Text size="sm">Pending Payments</Text>
              </Group>
              <Badge size="sm" color="yellow">{metrics.pendingPayments}</Badge>
            </Group>
            
            <Group justify="space-between" align="center">
              <Group gap="sm">
                <IconTrendingDown size="1rem" color="orange" />
                <Text size="sm">Refund Rate</Text>
              </Group>
              <Badge size="sm" color="orange">{formatPercentage(metrics.refundRate)}</Badge>
            </Group>
            
            <Group justify="space-between" align="center">
              <Group gap="sm">
                <IconAlertTriangle size="1rem" color="red" />
                <Text size="sm">Chargeback Rate</Text>
              </Group>
              <Badge size="sm" color="red">{formatPercentage(metrics.chargebackRate)}</Badge>
            </Group>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
