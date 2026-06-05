'use client';

/**
 * Inventory Transfer Analytics
 * 
 * Analytics and reporting component for inventory transfers
 * Provides insights into transfer patterns, performance, and inventory trends
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTenant } from '@/components/tenant/TenantContextProvider';
import {
  Card,
  Title,
  Text,
  Grid,
  Stack,
  Badge,
  Progress,
  Table,
  Group,
  Alert,
  Loader,
  Center,
  Box,
  Button
} from '@mantine/core';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconPackage,
  IconTruck,
  IconClock,
  IconAlertTriangle,
  IconRefresh
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { inventoryAnalyticsService } from '@/services/InventoryAnalyticsService';
import type { TransferAnalytics } from '@/services/InventoryAnalyticsService';

export default function InventoryTransferAnalytics() {
  const params = useParams();
  const tenant = useTenant();
  const [analytics, setAnalytics] = useState<TransferAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Use tenant context as primary source, URL params as fallback
      const tenantId = tenant?.tenantId || params.tenantId as string;
      
      if (!tenantId) {
        console.error('[InventoryTransferAnalytics] No tenant ID found in context or URL params');
        notifications.show({
          title: 'Error',
          message: 'Tenant ID is required',
          color: 'red'
        });
        return;
      }
      
      // Set tenant context for the analytics service
      inventoryAnalyticsService.setCurrentTenant(tenantId);
      
      const result = await inventoryAnalyticsService.getInventoryAnalytics(tenantId);
      console.log(`Analytics result:`, result);
      
      if (!(result as any)?.success || !(result as any)?.data) {
        console.warn('No analytics data available, using fallback');
        setAnalytics({
          totalTransfers: 0,
          activeTransfers: 0,
          completedTransfers: 0,
          averageTransferTime: 0,
          topSKUs: [],
          statusBreakdown: {
            pending: 0,
            approved: 0,
            shipped: 0,
            received: 0,
            cancelled: 0
          },
          monthlyTrends: [],
          lowStockAlerts: []
        });
        return;
      }

      // Handle the actual analytics response structure - data is nested under result.data.data
      const analyticsData = (result && (result as any)?.data) as any;
      console.log(`Analytics data:`, result);
      
      // Map the actual API response to our expected structure
      const mappedAnalytics: TransferAnalytics = {
        totalTransfers: (analyticsData?.pendingTransfers || 0) + (analyticsData?.completedTransfers || 0),
        activeTransfers: analyticsData?.pendingTransfers || 0,
        completedTransfers: analyticsData?.completedTransfers || 0,
        averageTransferTime: 0, // Not provided by current API
        topSKUs: [], // Not provided by current API
        statusBreakdown: {
          pending: analyticsData?.pendingTransfers || 0,
          approved: 0, // Not provided by current API
          shipped: 0, // Not provided by current API
          received: analyticsData?.completedTransfers || 0,
          cancelled: 0 // Not provided by current API
        },
        monthlyTrends: [], // Not provided by current API
        lowStockAlerts: [] // Not provided by current API
      };

      setAnalytics(mappedAnalytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load analytics data',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <Card shadow="sm" p="lg" withBorder>
        <Center>
          <Stack align="center">
            <Loader size="lg" />
            <Text>Loading analytics...</Text>
          </Stack>
        </Center>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card shadow="sm" p="lg" withBorder>
        <Alert color="red">
          Failed to load analytics data
        </Alert>
      </Card>
    );
  }

  const completionRate = analytics.totalTransfers > 0 
    ? (analytics.completedTransfers / analytics.totalTransfers) * 100 
    : 0;

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <Title order={2}>Transfer Analytics</Title>
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={loadAnalytics}
          variant="outline"
        >
          Refresh
        </Button>
      </Group>

      {/* Overview Cards */}
      <Grid>
        <Grid.Col span={3}>
          <Card p="md" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <IconPackage size={24} color="blue" />
                <Badge size="sm" color="blue">{analytics.totalTransfers}</Badge>
              </Group>
              <Text size="xl" fw={700}>{analytics.totalTransfers}</Text>
              <Text size="sm" c="dimmed">Total Transfers</Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={3}>
          <Card p="md" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <IconTruck size={24} color="orange" />
                <Badge size="sm" color="orange">{analytics.activeTransfers}</Badge>
              </Group>
              <Text size="xl" fw={700}>{analytics.activeTransfers}</Text>
              <Text size="sm" c="dimmed">Active Transfers</Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={3}>
          <Card p="md" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <IconTrendingUp size={24} color="green" />
                <Badge size="sm" color="green">{analytics.completedTransfers}</Badge>
              </Group>
              <Text size="xl" fw={700}>{analytics.completedTransfers}</Text>
              <Text size="sm" c="dimmed">Completed</Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={3}>
          <Card p="md" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <IconClock size={24} color="purple" />
                <Badge size="sm" color="purple">
                  {Math.round(analytics.averageTransferTime)}h
                </Badge>
              </Group>
              <Text size="xl" fw={700}>{Math.round(analytics.averageTransferTime)}h</Text>
              <Text size="sm" c="dimmed">Avg. Transfer Time</Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid>
        {/* Status Breakdown */}
        <Grid.Col span={6}>
          <Card p="lg" withBorder>
            <Title order={3} mb="md">Transfer Status Breakdown</Title>
            <Stack gap="md">
              {analytics.statusBreakdown && Object.entries(analytics.statusBreakdown).map(([status, count]) => {
                const percentage = analytics.totalTransfers > 0 
                  ? (count / analytics.totalTransfers) * 100 
                  : 0;
                
                const colors = {
                  pending: 'yellow',
                  approved: 'blue',
                  shipped: 'purple',
                  received: 'green',
                  cancelled: 'red'
                } as const;

                return (
                  <Box key={status}>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={500} tt="capitalize">
                        {status}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {count} ({percentage.toFixed(1)}%)
                      </Text>
                    </Group>
                    <Progress
                      value={percentage}
                      color={colors[status as keyof typeof colors]}
                      size="sm"
                    />
                  </Box>
                );
              })}
              
              <Box mt="md">
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500}>Completion Rate</Text>
                  <Text size="sm" c="dimmed">
                    {completionRate.toFixed(1)}%
                  </Text>
                </Group>
                <Progress
                  value={completionRate}
                  color="green"
                  size="md"
                />
              </Box>
            </Stack>
          </Card>
        </Grid.Col>

        {/* Top SKUs */}
        <Grid.Col span={6}>
          <Card p="lg" withBorder>
            <Title order={3} mb="md">Top Transferred SKUs</Title>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>SKU</Table.Th>
                  <Table.Th>Transfers</Table.Th>
                  <Table.Th>Total Quantity</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {analytics.topSKUs && analytics.topSKUs.map((item, index) => (
                  <Table.Tr key={`${item.sku}-${index}`}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{item.sku}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm">{item.transferCount}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{item.totalQuantity}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Low Stock Alerts */}
      {analytics.lowStockAlerts && analytics.lowStockAlerts.length > 0 && (
        <Card p="lg" withBorder>
          <Title order={3} mb="md">
            <Group gap="xs">
              <IconAlertTriangle size={20} color="red" />
              Low Stock Alerts
            </Group>
          </Title>
          
          <Grid>
            {analytics.lowStockAlerts.map((alert, index) => (
              <Grid.Col span={4} key={`${alert.locationId}-${alert.sku}-${index}`}>
                <Alert color="red">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>{alert.sku}</Text>
                      <Badge size="sm">{alert.locationId.slice(-8)}</Badge>
                    </Group>
                    <Text size="sm">
                      Current: {alert.currentStock} / Threshold: {alert.threshold}
                    </Text>
                    <Text size="xs" c="red">
                      {alert.threshold - alert.currentStock} units below threshold
                    </Text>
                  </Stack>
                </Alert>
              </Grid.Col>
            ))}
          </Grid>
        </Card>
      )}

      {/* Monthly Trends */}
      <Card p="lg" withBorder>
        <Title order={3} mb="md">Monthly Transfer Trends</Title>
        {analytics.monthlyTrends && analytics.monthlyTrends.length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Month</Table.Th>
                <Table.Th>Transfers</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Trend</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {analytics.monthlyTrends.map((trend, index) => {
                const previousTrend = index > 0 ? analytics.monthlyTrends[index - 1] : null;
                const isIncreasing = previousTrend ? trend.transfers > previousTrend.transfers : false;
                
                return (
                  <Table.Tr key={`${trend.month}-${index}`}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{trend.month}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm">{trend.transfers}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{trend.quantity.toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {isIncreasing ? (
                          <IconTrendingUp size={16} color="green" />
                        ) : previousTrend ? (
                          <IconTrendingDown size={16} color="red" />
                        ) : (
                          <Box w={16} />
                        )}
                        <Text size="sm" c={isIncreasing ? 'green' : 'red'}>
                          {previousTrend 
                            ? `${((trend.transfers - previousTrend.transfers) / previousTrend.transfers * 100).toFixed(1)}%`
                            : 'N/A'
                          }
                        </Text>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed">No trend data available</Text>
        )}
      </Card>
    </Stack>
  );
}
