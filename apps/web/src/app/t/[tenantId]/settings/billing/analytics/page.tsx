'use client';

import { useState, useEffect } from 'react';
import { Card, Badge, Button, Group, Text, Stack, Alert, Loader, Select, Grid, Progress, Timeline } from '@mantine/core';
import { 
  IconTrendingUp, 
  IconTrendingDown, 
  IconCurrencyDollar, 
  IconChartBar,
  IconCalendar,
  IconRefresh,
  IconDownload,
  IconAlertTriangle
} from '@tabler/icons-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { tenantBillingService } from '@/services/TenantBillingService';
import { clientLogger } from '@/lib/client-logger';

interface BillingAnalytics {
  period: '3m' | '6m' | '12m';
  totalSpent: number;
  averageMonthly: number;
  platformFees: number;
  transactionFees: number;
  subscriptionFees: number;
  monthlyBreakdown: Array<{
    month: string;
    total: number;
    subscription: number;
    platformFees: number;
    transactionFees: number;
  }>;
  paymentMethods: Array<{
    type: string;
    count: number;
    total: number;
  }>;
  projections: {
    nextMonth: number;
    nextQuarter: number;
    yearly: number;
  };
}

interface PlatformFeeSummary {
  currentMonth: number;
  lastMonth: number;
  yearToDate: number;
  transactions: number;
}

export default function BillingAnalyticsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);
  const [platformFees, setPlatformFees] = useState<PlatformFeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'3m' | '6m' | '12m'>('6m');

  useEffect(() => {
    const resolveTenantId = async () => {
      const resolvedParams = await params;
      setTenantId(resolvedParams.tenantId);
    };
    resolveTenantId();
  }, [params]);

  useEffect(() => {
    if (tenantId) {
      loadAnalytics();
      loadPlatformFees();
    }
  }, [tenantId, period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tenantBillingService.getBillingAnalytics(tenantId, period);
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadPlatformFees = async () => {
    try {
      const data = await tenantBillingService.getPlatformFeeSummary(tenantId);
      setPlatformFees(data);
    } catch (err: any) {
      clientLogger.error('Failed to load platform fees:', { detail: err });
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatPercent = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <IconTrendingUp className="text-green-500" />;
    if (current < previous) return <IconTrendingDown className="text-red-500" />;
    return <IconChartBar className="text-gray-500" />;
  };

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return 'green';
    if (current < previous) return 'red';
    return 'gray';
  };

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert color="red" icon={<IconAlertTriangle />}>
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Analytics"
        description="Track your spending patterns and billing trends"
        icon={Icons.ChartBar}
        backLink={{
          href: `/t/${tenantId}/settings/billing`,
          label: 'Back to Billing'
        }}
      />

      {/* Period Selector */}
      <Card>
        <Group justify="space-between">
          <div>
            <h3 className="text-lg font-semibold">Analytics Period</h3>
            <p className="text-sm text-gray-600">Select the time period for analytics</p>
          </div>
          
          <Group>
            <Select
              value={period}
              onChange={(value) => setPeriod(value as '3m' | '6m' | '12m')}
              data={[
                { value: '3m', label: 'Last 3 Months' },
                { value: '6m', label: 'Last 6 Months' },
                { value: '12m', label: 'Last 12 Months' }
              ]}
              w={150}
            />
            
            <Button
              variant="outline"
              leftSection={<IconRefresh size="1rem" />}
              onClick={loadAnalytics}
            >
              Refresh
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Summary Cards */}
      {analytics && (
        <Grid>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card>
              <Group>
                <IconCurrencyDollar className="w-8 h-8 text-blue-500" />
                <div>
                  <Text size="xs" c="dimmed">Total Spent</Text>
                  <Text size="lg" fw={500}>{formatCurrency(analytics.totalSpent || 0)}</Text>
                  <Text size="xs" c="dimmed">{period} period</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card>
              <Group>
                <IconTrendingUp className="w-8 h-8 text-green-500" />
                <div>
                  <Text size="xs" c="dimmed">Monthly Average</Text>
                  <Text size="lg" fw={500}>{formatCurrency(analytics.averageMonthly || 0)}</Text>
                  <Text size="xs" c="dimmed">Per month</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card>
              <Group>
                <IconChartBar className="w-8 h-8 text-purple-500" />
                <div>
                  <Text size="xs" c="dimmed">Platform Fees</Text>
                  <Text size="lg" fw={500}>{formatCurrency(analytics.platformFees || 0)}</Text>
                  <Text size="xs" c="dimmed">{formatPercent(analytics.platformFees || 0, analytics.totalSpent || 0)} of total</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card>
              <Group>
                <IconCalendar className="w-8 h-8 text-orange-500" />
                <div>
                  <Text size="xs" c="dimmed">Subscription Fees</Text>
                  <Text size="lg" fw={500}>{formatCurrency(analytics.subscriptionFees || 0)}</Text>
                  <Text size="xs" c="dimmed">{formatPercent(analytics.subscriptionFees || 0, analytics.totalSpent || 0)} of total</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      {/* Platform Fees Summary */}
      {platformFees && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Platform Fees Summary</h3>
          <Grid>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <div className="text-center">
                <Text size="xs" c="dimmed">Current Month</Text>
                <Text size="lg" fw={500} c="blue">
                  {formatCurrency(platformFees.currentMonth || 0)}
                </Text>
                <div className="flex items-center justify-center mt-1">
                  {getTrendIcon(platformFees.currentMonth || 0, platformFees.lastMonth || 0)}
                </div>
              </div>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 3 }}>
              <div className="text-center">
                <Text size="xs" c="dimmed">Last Month</Text>
                <Text size="lg" fw={500}>
                  {formatCurrency(platformFees.lastMonth || 0)}
                </Text>
              </div>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 3 }}>
              <div className="text-center">
                <Text size="xs" c="dimmed">Year to Date</Text>
                <Text size="lg" fw={500} c="green">
                  {formatCurrency(platformFees.yearToDate || 0)}
                </Text>
              </div>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 3 }}>
              <div className="text-center">
                <Text size="xs" c="dimmed">Transactions</Text>
                <Text size="lg" fw={500}>
                  {platformFees.transactions?.toLocaleString() || '0'}
                </Text>
              </div>
            </Grid.Col>
          </Grid>
        </Card>
      )}

      {/* Monthly Breakdown */}
      {analytics && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Monthly Breakdown</h3>
          <div className="space-y-4">
            {(analytics.monthlyBreakdown || []).map((month, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Text fw={500}>{month.month}</Text>
                  <Text>{formatCurrency(month.total)}</Text>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <Text c="dimmed">Subscription</Text>
                    <Text>{formatCurrency(month.subscription)}</Text>
                  </div>
                  <Progress
                    value={(month.subscription / month.total) * 100}
                    color="blue"
                    size="sm"
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <Text c="dimmed">Platform Fees</Text>
                    <Text>{formatCurrency(month.platformFees)}</Text>
                  </div>
                  <Progress
                    value={(month.platformFees / month.total) * 100}
                    color="purple"
                    size="sm"
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <Text c="dimmed">Transaction Fees</Text>
                    <Text>{formatCurrency(month.transactionFees)}</Text>
                  </div>
                  <Progress
                    value={(month.transactionFees / month.total) * 100}
                    color="orange"
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Payment Methods Breakdown */}
      {analytics && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Payment Methods Usage</h3>
          <div className="space-y-3">
            {(analytics.paymentMethods || []).map((method, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <div>
                    <Text fw={500}>{method.type.charAt(0).toUpperCase() + method.type.slice(1)}</Text>
                    <Text size="sm" c="dimmed">{method.count} transactions</Text>
                  </div>
                </div>
                
                <div className="text-right">
                  <Text fw={500}>{formatCurrency(method.total)}</Text>
                  <Progress
                    value={analytics.totalSpent ? (method.total / analytics.totalSpent) * 100 : 0}
                    color="blue"
                    size="sm"
                    w={100}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Projections */}
      {analytics && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Spending Projections</h3>
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <IconCalendar className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <Text size="xs" c="dimmed">Next Month</Text>
                <Text size="lg" fw={500} c="blue">
                  {formatCurrency(analytics.projections?.nextMonth || 0)}
                </Text>
              </div>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 4 }}>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <IconTrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <Text size="xs" c="dimmed">Next Quarter</Text>
                <Text size="lg" fw={500} c="green">
                  {formatCurrency(analytics.projections?.nextQuarter || 0)}
                </Text>
              </div>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 4 }}>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <IconChartBar className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <Text size="xs" c="dimmed">Yearly Projection</Text>
                <Text size="lg" fw={500} c="purple">
                  {formatCurrency(analytics.projections?.yearly || 0)}
                </Text>
              </div>
            </Grid.Col>
          </Grid>
        </Card>
      )}

      {/* Export Options */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Export Data</h3>
        <Group>
          <Button
            variant="outline"
            leftSection={<IconDownload size="1rem" />}
            onClick={() => {
              // Export analytics data as CSV
              const csv = 'Month,Total,Subscription,Platform Fees,Transaction Fees\n' +
                analytics?.monthlyBreakdown.map(m => 
                  `${m.month},${m.total},${m.subscription},${m.platformFees},${m.transactionFees}`
                ).join('\n') || '';
              
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `billing-analytics-${period}.csv`;
              a.click();
              window.URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Button>
          
          <Button
            variant="outline"
            leftSection={<IconDownload size="1rem" />}
            onClick={() => {
              // Export as JSON
              const data = JSON.stringify({ analytics, platformFees }, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `billing-analytics-${period}.json`;
              a.click();
              window.URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </Button>
        </Group>
      </Card>
    </div>
  );
}
