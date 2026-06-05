'use client';

import { 
  Card, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Grid, 
  Progress,
  Title,
  Divider,
  Table,
  LoadingOverlay,
  Alert,
  Button,
  Timeline,
  Tooltip,
  ActionIcon
} from '@mantine/core';
import { 
  IconAlertTriangle,
  IconClock,
  IconCheck,
  IconX,
  IconShield,
  IconTrendingUp,
  IconTrendingDown,
  IconBuildingStore,
  IconUsers,
  IconPackage,
  IconCalendar,
  IconExclamationMark,
  IconInfoCircle,
  IconChartBar,
  IconEye
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { Tenant } from '../types';

interface TenantRiskAssessmentProps {
  tenants?: Tenant[];
  isLoading?: boolean;
}

export function TenantRiskAssessment({ 
  tenants, 
  isLoading = false 
}: TenantRiskAssessmentProps) {
  const router = useRouter();
  
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const getRiskLevel = (tenant: Tenant) => {
    const risks = [];
    
    // Subscription status risks
    if (tenant.subscriptionStatus === 'expired') {
      risks.push({ type: 'critical', label: 'Expired Subscription', icon: <IconX size="1rem" color="red" /> });
    } else if (tenant.subscriptionStatus === 'trial') {
      if (tenant.trialEndsAt) {
        const daysUntilExpiry = Math.ceil((new Date(tenant.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 7) {
          risks.push({ type: 'high', label: `Trial expires in ${daysUntilExpiry} days`, icon: <IconClock size="1rem" color="orange" /> });
        } else {
          risks.push({ type: 'medium', label: `Trial active (${daysUntilExpiry} days left)`, icon: <IconClock size="1rem" color="yellow" /> });
        }
      }
    }

    // Manual subscription control risks
    if (tenant.manualSubscriptionControl) {
      risks.push({ type: 'high', label: 'Manual subscription control', icon: <IconAlertTriangle size="1rem" color="orange" /> });
    }

    // Legacy migration risks
    if (tenant.manualSubscriptionReason?.includes('Legacy migration')) {
      risks.push({ type: 'medium', label: 'Legacy migration', icon: <IconInfoCircle size="1rem" color="yellow" /> });
    }

    // Activity risks (based on user and product counts)
    if (tenant._count) {
      if (tenant._count.user_tenants === 0) {
        risks.push({ type: 'high', label: 'No active users', icon: <IconUsers size="1rem" color="orange" /> });
      }
      if (tenant._count.inventory_items === 0) {
        risks.push({ type: 'medium', label: 'No inventory items', icon: <IconPackage size="1rem" color="yellow" /> });
      }
    }

    return risks;
  };

  const getRiskColor = (riskType: string) => {
    switch (riskType) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'trial': return 'yellow';
      case 'expired': return 'red';
      default: return 'gray';
    }
  };

  // Calculate risk statistics
  const riskStats = tenants?.reduce((acc, tenant) => {
    const risks = getRiskLevel(tenant);
    if (risks.some(r => r.type === 'critical')) acc.critical++;
    else if (risks.some(r => r.type === 'high')) acc.high++;
    else if (risks.some(r => r.type === 'medium')) acc.medium++;
    else acc.low++;
    return acc;
  }, { critical: 0, high: 0, medium: 0, low: 0 });

  const totalTenants = tenants?.length || 0;
  const activeTenants = tenants?.filter(t => t.subscriptionStatus === 'active').length || 0;
  const trialTenants = tenants?.filter(t => t.subscriptionStatus === 'trial').length || 0;
  const expiredTenants = tenants?.filter(t => t.subscriptionStatus === 'expired').length || 0;
  const manualControlTenants = tenants?.filter(t => t.manualSubscriptionControl).length || 0;

  // Get high-risk tenants for detailed view
  const highRiskTenants = tenants?.filter(tenant => {
    const risks = getRiskLevel(tenant);
    return risks.some(r => r.type === 'critical' || r.type === 'high');
  }).slice(0, 10);

  const getDaysUntilExpiry = (dateString?: string) => {
    if (!dateString) return null;
    return Math.ceil((new Date(dateString).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <Stack gap="md">
      {/* Risk Summary Cards */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconShield size="1.2rem" color="red" />
                <Text size="xs" c="dimmed">Critical Risk</Text>
              </Group>
              <Text size="xl" fw={600} c="red">
                {riskStats?.critical || 0}
              </Text>
              <Text size="xs" c="dimmed">
                {totalTenants > 0 ? Math.round(((riskStats?.critical || 0) / totalTenants) * 100) : 0}% of tenants
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconAlertTriangle size="1.2rem" color="orange" />
                <Text size="xs" c="dimmed">High Risk</Text>
              </Group>
              <Text size="xl" fw={600} c="orange">
                {riskStats?.high || 0}
              </Text>
              <Text size="xs" c="dimmed">
                {totalTenants > 0 ? Math.round(((riskStats?.high || 0) / totalTenants) * 100) : 0}% of tenants
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconClock size="1.2rem" color="yellow" />
                <Text size="xs" c="dimmed">Trial Expiring</Text>
              </Group>
              <Text size="xl" fw={600} c="yellow">
                {trialTenants}
              </Text>
              <Text size="xs" c="dimmed">
                {totalTenants > 0 ? Math.round((trialTenants / totalTenants) * 100) : 0}% in trial
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Group gap="xs">
                <IconExclamationMark size="1.2rem" color="purple" />
                <Text size="xs" c="dimmed">Manual Control</Text>
              </Group>
              <Text size="xl" fw={600} c="purple">
                {manualControlTenants}
              </Text>
              <Text size="xs" c="dimmed">
                {totalTenants > 0 ? Math.round((manualControlTenants / totalTenants) * 100) : 0}% manual
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Risk Distribution */}
      <Card withBorder padding="lg" radius="md">
        <Title order={3} mb="md">Risk Distribution</Title>
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm">Critical Risk</Text>
            <Text size="sm" fw={600}>
              {riskStats?.critical || 0} ({totalTenants > 0 ? Math.round(((riskStats?.critical || 0) / totalTenants) * 100) : 0}%)
            </Text>
          </Group>
          <Progress 
            value={totalTenants > 0 ? ((riskStats?.critical || 0) / totalTenants) * 100 : 0} 
            color="red" 
          />

          <Group justify="space-between">
            <Text size="sm">High Risk</Text>
            <Text size="sm" fw={600}>
              {riskStats?.high || 0} ({totalTenants > 0 ? Math.round(((riskStats?.high || 0) / totalTenants) * 100) : 0}%)
            </Text>
          </Group>
          <Progress 
            value={totalTenants > 0 ? ((riskStats?.high || 0) / totalTenants) * 100 : 0} 
            color="orange" 
          />

          <Group justify="space-between">
            <Text size="sm">Medium Risk</Text>
            <Text size="sm" fw={600}>
              {riskStats?.medium || 0} ({totalTenants > 0 ? Math.round(((riskStats?.medium || 0) / totalTenants) * 100) : 0}%)
            </Text>
          </Group>
          <Progress 
            value={totalTenants > 0 ? ((riskStats?.medium || 0) / totalTenants) * 100 : 0} 
            color="yellow" 
          />

          <Group justify="space-between">
            <Text size="sm">Low Risk</Text>
            <Text size="sm" fw={600}>
              {riskStats?.low || 0} ({totalTenants > 0 ? Math.round(((riskStats?.low || 0) / totalTenants) * 100) : 0}%)
            </Text>
          </Group>
          <Progress 
            value={totalTenants > 0 ? ((riskStats?.low || 0) / totalTenants) * 100 : 0} 
            color="green" 
          />
        </Stack>
      </Card>

      {/* High Risk Tenants */}
      <Card withBorder padding="lg" radius="md">
        <LoadingOverlay visible={isLoading} />
        <Title order={3} mb="md">High Risk Tenants</Title>
        
        {highRiskTenants && highRiskTenants.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Tier</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Users</Table.Th>
                <Table.Th>Products</Table.Th>
                <Table.Th>Risk Factors</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {highRiskTenants.map((tenant) => {
                const risks = getRiskLevel(tenant);
                const daysUntilExpiry = tenant.trialEndsAt ? getDaysUntilExpiry(tenant.trialEndsAt) : null;
                
                return (
                  <Table.Tr key={tenant.id}>
                    <Table.Td>
                      <Stack gap="xs">
                        <Text size="sm" fw={500}>{tenant.name}</Text>
                        {tenant.organization && (
                          <Text size="xs" c="dimmed">{tenant.organization.name}</Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Badge 
                        size="sm" 
                        color={getTierColor(tenant.subscriptionTier || '')}
                        variant="light"
                      >
                        {tenant.subscriptionTier || 'discovery'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge 
                          size="sm" 
                          color={getStatusColor(tenant.subscriptionStatus || '')}
                          variant="light"
                        >
                          {tenant.subscriptionStatus || 'unknown'}
                        </Badge>
                        {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
                          <Tooltip label={`Expires in ${daysUntilExpiry} days`}>
                            <IconClock size="1rem" color="orange" />
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{tenant._count?.user_tenants || 0}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{tenant._count?.inventory_items || 0}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap="xs">
                        {risks.slice(0, 2).map((risk, index) => (
                          <Group key={index} gap="xs">
                            {risk.icon}
                            <Text size="xs" c={getRiskColor(risk.type)}>
                              {risk.label}
                            </Text>
                          </Group>
                        ))}
                        {risks.length > 2 && (
                          <Text size="xs" c="dimmed">
                            +{risks.length - 2} more
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Tooltip label="View Billing Dashboard">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() => router.push(`/t/${tenant.id}/settings/billing`)}
                          >
                            <IconEye size="0.875rem" />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No high-risk tenants found
          </Text>
        )}
      </Card>

      {/* Risk Alerts */}
      {(riskStats?.critical || 0) > 0 && (
        <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
          <Text size="sm" fw={500}>
            {riskStats?.critical || 0} critical risk tenants require immediate attention
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            Review expired subscriptions and manual control tenants
          </Text>
        </Alert>
      )}

      {(riskStats?.high || 0) > 0 && (
        <Alert color="orange" icon={<IconClock size="1rem" />}>
          <Text size="sm" fw={500}>
            {riskStats?.high || 0} high-risk tenants need monitoring
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            Trial expirations and manual subscription controls
          </Text>
        </Alert>
      )}

      {/* Subscription Status Overview */}
      <Card withBorder padding="lg" radius="md">
        <Title order={3} mb="md">Subscription Status Overview</Title>
        <Grid>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Stack gap="xs">
              <Group gap="xs">
                <IconCheck size="1rem" color="green" />
                <Text size="sm">Active</Text>
              </Group>
              <Text size="lg" fw={600} c="green">{activeTenants}</Text>
              <Progress value={totalTenants > 0 ? (activeTenants / totalTenants) * 100 : 0} color="green" />
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Stack gap="xs">
              <Group gap="xs">
                <IconClock size="1rem" color="yellow" />
                <Text size="sm">Trial</Text>
              </Group>
              <Text size="lg" fw={600} c="yellow">{trialTenants}</Text>
              <Progress value={totalTenants > 0 ? (trialTenants / totalTenants) * 100 : 0} color="yellow" />
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Stack gap="xs">
              <Group gap="xs">
                <IconX size="1rem" color="red" />
                <Text size="sm">Expired</Text>
              </Group>
              <Text size="lg" fw={600} c="red">{expiredTenants}</Text>
              <Progress value={totalTenants > 0 ? (expiredTenants / totalTenants) * 100 : 0} color="red" />
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Stack gap="xs">
              <Group gap="xs">
                <IconShield size="1rem" color="purple" />
                <Text size="sm">Manual Control</Text>
              </Group>
              <Text size="lg" fw={600} c="purple">{manualControlTenants}</Text>
              <Progress value={totalTenants > 0 ? (manualControlTenants / totalTenants) * 100 : 0} color="purple" />
            </Stack>
          </Grid.Col>
        </Grid>
      </Card>
    </Stack>
  );
}
