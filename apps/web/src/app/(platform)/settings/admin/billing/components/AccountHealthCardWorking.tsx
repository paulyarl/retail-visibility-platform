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
  ActionIcon,
  Tooltip,
  Divider,
  LoadingOverlay,
  Alert,
  List,
  ThemeIcon
} from '@mantine/core';
import { 
  IconHeart,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconTrendingUp,
  IconTrendingDown,
  IconCurrencyDollar,
  IconUsers,
  IconChartBar,
  IconRefresh,
  IconEye,
  IconAlertCircle
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

interface AccountHealthCardProps {
  tenantId: string;
  tenantName: string;
  accountHealth?: {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    riskLevel: 'low' | 'medium' | 'high';
    factors: {
      paymentHistory: number;
      usageConsistency: number;
      subscriptionAge: number;
      supportTickets: number;
    };
    recommendations: string[];
  };
  isLoading?: boolean;
}

interface HealthMetrics {
  overallScore: number;
  paymentHealth: {
    score: number;
    successRate: number;
    failedPayments: number;
    lastPaymentDate: string;
  };
  subscriptionHealth: {
    score: number;
    status: 'active' | 'expired' | 'cancelled' | 'trial';
    daysUntilExpiry: number;
    tier: string;
  };
  usageHealth: {
    score: number;
    utilizationRate: number;
    apiCalls: number;
    storageUsed: number;
    storageLimit: number;
  };
  engagementHealth: {
    score: number;
    loginFrequency: number;
    featureAdoption: number;
    supportTickets: number;
    lastLogin: string;
  };
  riskFactors: Array<{
    factor: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>;
}

export function AccountHealthCardWorking({ 
  tenantId, 
  tenantName, 
  accountHealth,
  isLoading: externalLoading = false 
}: AccountHealthCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Use real API data if available, otherwise fallback to mock data
  const healthMetrics: HealthMetrics = accountHealth ? {
    overallScore: accountHealth.score,
    paymentHealth: {
      score: accountHealth.factors.paymentHistory,
      successRate: 95.0, // Would calculate from actual payment data
      failedPayments: 0, // Would get from actual payment data
      lastPaymentDate: new Date().toISOString().split('T')[0]
    },
    subscriptionHealth: {
      score: accountHealth.factors.subscriptionAge,
      status: 'active' as const,
      daysUntilExpiry: 30, // Would calculate from subscription data
      tier: 'Growth' // Would get from tenant data
    },
    usageHealth: {
      score: accountHealth.factors.usageConsistency,
      utilizationRate: 68, // Would calculate from actual usage data
      apiCalls: 45678, // Would get from actual usage data
      storageUsed: 2.3, // Would get from actual storage data
      storageLimit: 5 // Would get from tenant plan limits
    },
    engagementHealth: {
      score: 100 - accountHealth.factors.supportTickets, // Inverse of support tickets
      loginFrequency: 12, // Would calculate from login data
      featureAdoption: 45, // Would calculate from feature usage
      supportTickets: accountHealth.factors.supportTickets,
      lastLogin: new Date().toISOString().split('T')[0]
    },
    riskFactors: accountHealth.recommendations.map((rec, index) => ({
      factor: accountHealth.status === 'critical' ? 'Critical Health Issues' : 
               accountHealth.status === 'poor' ? 'Health Concerns' : 
               accountHealth.status === 'fair' ? 'Minor Issues' : 'Optimization Opportunity',
      severity: accountHealth.riskLevel as 'low' | 'medium' | 'high' | 'critical',
      description: rec,
      recommendation: rec
    }))
  } : {
    overallScore: 0,
    paymentHealth: {
      score: 0,
      successRate: 0,
      failedPayments: 0,
      lastPaymentDate: ''
    },
    subscriptionHealth: {
      score: 0,
      status: 'active',
      daysUntilExpiry: 0,
      tier: 'Unknown'
    },
    usageHealth: {
      score: 0,
      utilizationRate: 0,
      apiCalls: 0,
      storageUsed: 0,
      storageLimit: 0
    },
    engagementHealth: {
      score: 0,
      loginFrequency: 0,
      featureAdoption: 0,
      supportTickets: 0,
      lastLogin: ''
    },
    riskFactors: []
  };

  
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return <IconCheck size="1rem" color="green" />;
    if (score >= 60) return <IconAlertTriangle size="1rem" color="yellow" />;
    return <IconX size="1rem" color="red" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'blue';
      case 'medium': return 'yellow';
      case 'high': return 'orange';
      case 'critical': return 'red';
      default: return 'gray';
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatStorage = (gb: number) => {
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <Card withBorder padding="lg" radius="md">
      <LoadingOverlay visible={externalLoading} />
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Text size="md" fw={600}>Account Health</Text>
            <Text size="sm" c="dimmed">{tenantName}</Text>
          </div>
          <Group gap="sm">
            <ActionIcon 
              variant="light" 
              color="blue"
              onClick={() => setShowDetails(!showDetails)}
            >
              <IconEye size="1rem" />
            </ActionIcon>
            <ActionIcon 
              variant="light" 
              color="blue"
              loading={externalLoading}
            >
              <IconRefresh size="1rem" />
            </ActionIcon>
          </Group>
        </Group>

        {/* Overall Health Score */}
        <Group justify="center" align="center">
          <ThemeIcon size="lg" color={getHealthColor(healthMetrics.overallScore)}>
            {getHealthIcon(healthMetrics.overallScore)}
          </ThemeIcon>
          <div>
            <Text size="xl" fw={600} c={getHealthColor(healthMetrics.overallScore)}>
              {healthMetrics.overallScore}
            </Text>
            <Text size="xs" c="dimmed">Health Score</Text>
          </div>
        </Group>

        <Progress 
          value={healthMetrics.overallScore} 
          color={getHealthColor(healthMetrics.overallScore)}
          size="lg"
          mt="md"
        />

        {/* Health Breakdown */}
        <Card withBorder padding="lg" radius="md">
          <Text size="md" fw={600} mb="md">Health Breakdown</Text>
          <Stack gap="md">
            {/* Payment Health */}
            <div>
              <Group justify="space-between" mb="xs">
                <Group gap="sm">
                  <IconCurrencyDollar size="1rem" color="blue" />
                  <Text size="sm" fw={500}>Payment Health</Text>
                </Group>
                <Badge size="sm" color={getHealthColor(healthMetrics.paymentHealth.score)}>
                  {healthMetrics.paymentHealth.score}%
                </Badge>
              </Group>
              <Progress 
                value={healthMetrics.paymentHealth.score} 
                color={getHealthColor(healthMetrics.paymentHealth.score)}
                size="xs"
              />
              <Text size="xs" c="dimmed" mt="xs">
                {healthMetrics.paymentHealth.successRate}% success rate • {healthMetrics.paymentHealth.failedPayments} failed payments
              </Text>
            </div>

            {/* Subscription Health */}
            <div>
              <Group justify="space-between" mb="xs">
                <Group gap="sm">
                  <IconUsers size="1rem" color="green" />
                  <Text size="sm" fw={500}>Subscription Health</Text>
                </Group>
                <Badge size="sm" color={getHealthColor(healthMetrics.subscriptionHealth.score)}>
                  {healthMetrics.subscriptionHealth.score}%
                </Badge>
              </Group>
              <Progress 
                value={healthMetrics.subscriptionHealth.score} 
                color={getHealthColor(healthMetrics.subscriptionHealth.score)}
                size="xs"
              />
              <Text size="xs" c="dimmed" mt="xs">
                {healthMetrics.subscriptionHealth.tier} tier • {healthMetrics.subscriptionHealth.daysUntilExpiry} days until expiry
              </Text>
            </div>

            {/* Usage Health */}
            <div>
              <Group justify="space-between" mb="xs">
                <Group gap="sm">
                  <IconChartBar size="1rem" color="orange" />
                  <Text size="sm" fw={500}>Usage Health</Text>
                </Group>
                <Badge size="sm" color={getHealthColor(healthMetrics.usageHealth.score)}>
                  {healthMetrics.usageHealth.score}%
                </Badge>
              </Group>
              <Progress 
                value={healthMetrics.usageHealth.score} 
                color={getHealthColor(healthMetrics.usageHealth.score)}
                size="xs"
              />
              <Text size="xs" c="dimmed" mt="xs">
                {healthMetrics.usageHealth.utilizationRate}% utilization • {formatStorage(healthMetrics.usageHealth.storageUsed)} of {formatStorage(healthMetrics.usageHealth.storageLimit)} used
              </Text>
            </div>

            {/* Engagement Health */}
            <div>
              <Group justify="space-between" mb="xs">
                <Group gap="sm">
                  <IconHeart size="1rem" color="purple" />
                  <Text size="sm" fw={500}>Engagement Health</Text>
                </Group>
                <Badge size="sm" color={getHealthColor(healthMetrics.engagementHealth.score)}>
                  {healthMetrics.engagementHealth.score}%
                </Badge>
              </Group>
              <Progress 
                value={healthMetrics.engagementHealth.score} 
                color={getHealthColor(healthMetrics.engagementHealth.score)}
                size="xs"
              />
              <Text size="xs" c="dimmed" mt="xs">
                {healthMetrics.engagementHealth.featureAdoption}% feature adoption • {healthMetrics.engagementHealth.supportTickets} support tickets
              </Text>
            </div>
          </Stack>
        </Card>

        {/* Risk Factors */}
        {showDetails && (
          <Card withBorder padding="lg" radius="md">
            <Text size="md" fw={600} mb="md">Risk Factors</Text>
            <Stack gap="sm">
              {healthMetrics.riskFactors.map((factor, index) => (
                <div key={index}>
                  <Group justify="space-between" align="start">
                    <div style={{ flex: 1 }}>
                      <Group gap="sm">
                        <IconAlertCircle size="1rem" color={getSeverityColor(factor.severity)} />
                        <Text size="sm" fw={500}>{factor.factor}</Text>
                        <Badge size="xs" color={getSeverityColor(factor.severity)} variant="light">
                          {factor.severity}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" mt="xs">{factor.description}</Text>
                      <Text size="xs" c="blue" mt="xs">
                        <strong>Recommendation:</strong> {factor.recommendation}
                      </Text>
                    </div>
                  </Group>
                  {index < healthMetrics.riskFactors.length - 1 && <Divider />}
                </div>
              ))}
            </Stack>
          </Card>
        )}

        {/* Quick Actions */}
        {showDetails && (
          <Card withBorder padding="lg" radius="md">
            <Text size="md" fw={600} mb="md">Quick Actions</Text>
            <Group gap="sm">
              <Button size="sm" variant="outline" leftSection={<IconUsers size="0.875rem" />}>
                Contact Customer Success
              </Button>
              <Button size="sm" variant="outline" leftSection={<IconTrendingUp size="0.875rem" />}>
                Upgrade Tier
              </Button>
              <Button size="sm" variant="outline" leftSection={<IconChartBar size="0.875rem" />}>
                Usage Report
              </Button>
            </Group>
          </Card>
        )}
      </Stack>
    </Card>
  );
}
