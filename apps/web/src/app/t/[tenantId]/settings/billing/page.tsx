'use client';

import { useState, useEffect } from 'react';
import { Card, Badge, Button, Group, Text, Stack, Alert, Loader, Grid, Timeline } from '@mantine/core';
import { 
  IconTrendingUp, 
  IconAlertTriangle, 
  IconCreditCard, 
  IconFileInvoice,
  IconClock,
  IconExclamationMark,
  IconCheck,
  IconRefresh,
  IconSettings,
  IconChartBar,
  IconFileDescription,
  IconBell,
  IconCurrencyDollar
} from '@tabler/icons-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// Types for the billing dashboard
interface BillingOverview {
  currentBalance: number;
  nextPaymentDue: Date | null;
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing';
  lastPaymentStatus: 'success' | 'failed' | 'pending';
  subscriptionTier: string;
  monthlyAmount: number;
}

interface RiskFactor {
  type: 'payment_failure' | 'expiring_card' | 'high_balance' | 'late_payments' | 'subscription_lapse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  timeframe: string;
}

interface SubscriptionRisk {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  factors: RiskFactor[];
  projectedDefaultDate?: Date;
  recommendedActions: RiskAction[];
}

interface RiskAction {
  type: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionUrl: string;
  actionText: string;
  dueDate?: Date;
}

interface BillingAction {
  id: string;
  type: 'payment_required' | 'payment_method' | 'subscription_upgrade' | 'verify_account';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionUrl: string;
  actionText: string;
  dueDate?: Date;
}

interface RecentActivity {
  id: string;
  type: 'payment' | 'invoice' | 'subscription_change';
  title: string;
  amount?: number;
  status: 'success' | 'failed' | 'pending';
  date: Date;
}

// Risk level colors and icons
const RISK_COLORS = {
  low: 'green',
  medium: 'yellow', 
  high: 'orange',
  critical: 'red'
};

const RISK_ICONS = {
  low: '✅',
  medium: '⚠️',
  high: '🔥',
  critical: '🚨'
};

// Import the real TenantBillingService
import { tenantBillingService } from '@/services/TenantBillingService';

// Risk Indicator Component
const RiskIndicator = ({ risk, tenantId }: { risk: SubscriptionRisk; tenantId: string }) => {
  if (!risk || !risk.level) {
    return null;
  }

  return (
    <Card className={`border-l-4 border-l-${RISK_COLORS[risk.level]}-500 bg-${RISK_COLORS[risk.level]}-50`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{RISK_ICONS[risk.level]}</span>
          <div>
            <h3 className="font-semibold capitalize">{risk.level} Risk</h3>
            <p className="text-sm text-gray-600">
              Risk Score: {risk.score}/100
              {risk.projectedDefaultDate && (
                <span> • Projected default: {risk.projectedDefaultDate.toLocaleDateString()}</span>
              )}
            </p>
          </div>
        </div>
        
        <Badge color={RISK_COLORS[risk.level]} variant="light">
          {risk.level.toUpperCase()}
        </Badge>
      </div>
      
      {/* Risk Factors */}
      <div className="mb-4 space-y-2">
        {risk.factors.map((factor, index) => (
          <div key={index} className="flex items-start gap-2 text-sm">
            <IconAlertTriangle className="w-4 h-4 mt-0.5 text-amber-500" />
            <div>
              <p className="font-medium">{factor.description}</p>
              <p className="text-gray-600">{factor.impact} • {factor.timeframe}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Recommended Actions */}
      {risk.recommendedActions.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Recommended Actions:</h4>
          <div className="flex gap-2 flex-wrap">
            {risk.recommendedActions.map((action, index) => (
              <Button
                key={index}
                variant={action.priority === 'urgent' ? 'filled' : 'outline'}
                size="sm"
                onClick={() => {
                  // Prepend tenant path if not already present
                  const url = action.actionUrl.startsWith('/t/') 
                    ? action.actionUrl 
                    : `/t/${tenantId}${action.actionUrl}`;
                  window.location.href = url;
                }}
              >
                {action.actionText}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

// Billing Overview Cards
const BillingOverviewCards = ({ overview }: { overview: BillingOverview }) => {
  if (!overview) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'past_due': return 'red';
      case 'canceled': return 'gray';
      case 'trialing': return 'blue';
      default: return 'gray';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 3 }}>
        <Card>
          <Group>
            <IconCurrencyDollar className="w-8 h-8 text-blue-500" />
            <div>
              <Text size="xs" c="dimmed">Current Balance</Text>
              <Text size="lg" fw={500}>{formatCurrency(overview.currentBalance || 0)}</Text>
            </div>
          </Group>
        </Card>
      </Grid.Col>
      
      <Grid.Col span={{ base: 12, md: 3 }}>
        <Card>
          <Group>
            <IconClock className="w-8 h-8 text-orange-500" />
            <div>
              <Text size="xs" c="dimmed">Next Payment</Text>
              <Text size="lg" fw={500}>
                {overview.nextPaymentDue ? new Date(overview.nextPaymentDue).toLocaleDateString() : 'N/A'}
              </Text>
            </div>
          </Group>
        </Card>
      </Grid.Col>
      
      <Grid.Col span={{ base: 12, md: 3 }}>
        <Card>
          <Group>
            <IconFileInvoice className="w-8 h-8 text-green-500" />
            <div>
              <Text size="xs" c="dimmed">Subscription</Text>
              <Badge color={getStatusColor(overview.subscriptionStatus || 'unknown')} variant="light">
                {(overview.subscriptionStatus || 'UNKNOWN').toUpperCase()}
              </Badge>
            </div>
          </Group>
        </Card>
      </Grid.Col>
      
      <Grid.Col span={{ base: 12, md: 3 }}>
        <Card>
          <Group>
            <IconCreditCard className="w-8 h-8 text-purple-500" />
            <div>
              <Text size="xs" c="dimmed">Monthly Plan</Text>
              <Text size="lg" fw={500}>{formatCurrency(overview.monthlyAmount || 0)}</Text>
            </div>
          </Group>
        </Card>
      </Grid.Col>
    </Grid>
  );
};

// Actionable Tasks Component
const BillingActionItems = ({ actions, riskLevel }: { actions: BillingAction[], riskLevel?: string }) => {
  if (!actions || !Array.isArray(actions)) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-4">Actionable Tasks</h3>
        <div className="text-center py-8">
          <Text size="sm" c="dimmed">No actionable tasks at this time.</Text>
        </div>
      </Card>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <IconExclamationMark className="w-5 h-5 text-red-500" />;
      case 'high': return <IconAlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium': return <IconClock className="w-5 h-5 text-yellow-500" />;
      case 'low': return <IconCheck className="w-5 h-5 text-green-500" />;
      default: return <IconSettings className="w-5 h-5 text-gray-500" />;
    }
  };

  if (actions.length === 0) {
    return (
      <Card>
        <Group>
          <IconCheck className="w-5 h-5 text-green-500" />
          <Text c="green">All billing tasks are up to date!</Text>
        </Group>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Actionable Tasks</h3>
      <div className="space-y-3">
        {actions.map((action) => (
          <div key={action.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {getPriorityIcon(action.priority)}
              <div>
                <p className="font-medium">{action.title}</p>
                <p className="text-sm text-gray-600">{action.description}</p>
                {action.dueDate && (
                  <p className="text-xs text-gray-500">Due: {new Date(action.dueDate).toLocaleDateString()}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge color={getPriorityColor(action.priority)} variant="light" size="sm">
                {action.priority.toUpperCase()}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = action.actionUrl}
              >
                {action.actionText}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// Recent Activity Component
const BillingRecentActivity = ({ activities }: { activities: RecentActivity[] }) => {
  if (!activities || !Array.isArray(activities)) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <Text size="sm" c="dimmed">No recent activity to display.</Text>
        </div>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <IconCheck className="w-4 h-4 text-green-500" />;
      case 'failed': return <IconExclamationMark className="w-4 h-4 text-red-500" />;
      case 'pending': return <IconClock className="w-4 h-4 text-yellow-500" />;
      default: return <IconClock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
      <Timeline bulletSize={24}>
        {activities.map((activity) => (
          <Timeline.Item
            key={activity.id}
            bullet={getStatusIcon(activity.status)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{activity.title}</p>
                <p className="text-sm text-gray-600">{new Date(activity.date).toLocaleDateString()}</p>
              </div>
              {activity.amount && (
                <Text fw={500}>{formatCurrency(activity.amount)}</Text>
              )}
            </div>
          </Timeline.Item>
        ))}
      </Timeline>
    </Card>
  );
};

// Main Billing Dashboard Component
export default function TenantBillingDashboard({ params }: { params: Promise<{ tenantId: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [risk, setRisk] = useState<SubscriptionRisk | null>(null);
  const [actions, setActions] = useState<BillingAction[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveTenantId = async () => {
      const resolvedParams = await params;
      setTenantId(resolvedParams.tenantId);
    };
    resolveTenantId();
  }, [params]);

  useEffect(() => {
    if (tenantId) {
      loadBillingData();
    }
  }, [tenantId]);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all billing data in parallel
      const [overviewData, riskData, actionsData, activityData] = await Promise.all([
        tenantBillingService.getBillingOverview(tenantId),
        tenantBillingService.getSubscriptionRisk(tenantId),
        tenantBillingService.getBillingActions(tenantId),
        tenantBillingService.getRecentActivity(tenantId)
      ]);

      setOverview(overviewData);
      setRisk(riskData);
      setActions(actionsData);
      setRecentActivity(activityData);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

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
        <Alert color="red" icon={<IconExclamationMark />}>
          {error}
        </Alert>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-6">
        <Alert color="yellow" icon={<IconAlertTriangle />}>
          Unable to load billing information. Please try again later.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Dashboard"
        description="Monitor your billing status, payments, and account health"
        icon={Icons.FileInvoice}
      />

      {/* Risk Indicator - Only show if there's risk */}
      {risk && risk.level !== 'low' && (
        <RiskIndicator risk={risk} tenantId={tenantId} />
      )}

      {/* Billing Overview Cards */}
      <BillingOverviewCards overview={overview} />

      {/* Actionable Tasks */}
      <BillingActionItems actions={actions} riskLevel={risk?.level} />

      {/* Recent Activity */}
      <BillingRecentActivity activities={recentActivity} />

      {/* Quick Actions */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button
            variant="outline"
            leftSection={<IconFileInvoice size="1rem" />}
            onClick={() => router.push(`/t/${tenantId}/settings/billing/invoices`)}
          >
            View Invoices
          </Button>
          <Button
            variant="outline"
            leftSection={<IconCreditCard size="1rem" />}
            onClick={() => router.push(`/t/${tenantId}/settings/billing/payment-methods`)}
          >
            Payment Methods
          </Button>
          <Button
            variant="outline"
            leftSection={<IconChartBar size="1rem" />}
            onClick={() => router.push(`/t/${tenantId}/settings/billing/analytics`)}
          >
            Analytics
          </Button>
          <Button
            variant="outline"
            leftSection={<IconFileDescription size="1rem" />}
            onClick={() => router.push(`/t/${tenantId}/settings/billing/statements`)}
          >
            Statements
          </Button>
          <Button
            variant="outline"
            leftSection={<IconBell size="1rem" />}
            onClick={() => router.push(`/t/${tenantId}/settings/billing/notifications`)}
          >
            Notifications
          </Button>
          <Button
            variant="outline"
            leftSection={<IconSettings size="1rem" />}
            onClick={() => router.push(`/t/${tenantId}/settings/billing/preferences`)}
          >
            Preferences
          </Button>
        </div>
      </Card>
    </div>
  );
}
