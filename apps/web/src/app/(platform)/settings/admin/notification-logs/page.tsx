'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Badge,
  Text,
  Group,
  ActionIcon,
  Modal,
  Stack,
  Card,
  Alert,
  Loader,
  Pagination,
  Input,
  Select,
  Paper,
  Title,
  Grid,
  RingProgress,
  Center,
  Spoiler
} from '@mantine/core';
import {
  IconSearch,
  IconEye,
  IconCalendar,
  IconMail,
  IconCheck,
  IconX,
  IconRefresh,
  IconFilter,
  IconChartBar,
  IconBuilding
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { notificationLogsService, NotificationLog, NotificationStats } from '@/services/NotificationLogsService';
import { clientLogger } from '@/lib/client-logger';

// Types imported from NotificationLogsService

export default function NotificationLogsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sentFilter, setSentFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const itemsPerPage = 20;

  // Fetch logs
  useEffect(() => {
    fetchLogs();
  }, [currentPage, typeFilter, sentFilter, tenantFilter]);

  // Fetch stats
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await notificationLogsService.getLogs({
        page: currentPage,
        limit: itemsPerPage,
        type: typeFilter || undefined,
        sent: sentFilter === 'true' ? true : sentFilter === 'false' ? false : undefined,
        tenant_id: tenantFilter || undefined,
      });
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
      setTotalItems(data.pagination.total);
      setAvailableTypes(data.filters.types);
    } catch (error) {
      clientLogger.error('Error fetching notification logs:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to load notification logs',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const data = await notificationLogsService.getStats();
      setStats(data);
    } catch (error) {
      clientLogger.error('Error fetching notification stats:', { detail: error });
    } finally {
      setStatsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      payment_success: 'Payment Success',
      payment_failed: 'Payment Failed',
      grace_period_warning: 'Grace Period Warning',
      grace_period_final: 'Final Warning',
      payment_method_update_reminder: 'Payment Reminder',
      subscription_canceled: 'Subscription Canceled',
      subscription_reactivated: 'Subscription Reactivated',
      tier_changed: 'Plan Changed',
      trial_started: 'Trial Started',
      trial_converted: 'Trial Converted',
      trial_payment_failed: 'Trial Payment Failed',
      trial_expired: 'Trial Expired',
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      payment_success: 'green',
      payment_failed: 'red',
      grace_period_warning: 'yellow',
      grace_period_final: 'red',
      subscription_canceled: 'gray',
      trial_converted: 'green',
      trial_payment_failed: 'red',
    };
    return colors[type] || 'blue';
  };

  const filteredLogs = searchQuery
    ? logs.filter(log =>
        log.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={2}>Email Notification Logs</Title>
          <Text c="dimmed" size="sm">
            View all email notifications sent by the platform
          </Text>
        </div>
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={() => { fetchLogs(); fetchStats(); }}
          variant="light"
        >
          Refresh
        </Button>
      </Group>

      {/* Stats Cards */}
      {stats && !statsLoading && (
        <Grid>
          <Grid.Col span={3}>
            <Paper p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase" fw={500}>
                    Last 30 Days
                  </Text>
                  <Text fw={700} size="xl">
                    {stats.summary.total.toLocaleString()}
                  </Text>
                </div>
                <IconMail size={24} stroke={1.5} opacity={0.5} />
              </Group>
            </Paper>
          </Grid.Col>

          <Grid.Col span={3}>
            <Paper p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase" fw={500}>
                    Success Rate
                  </Text>
                  <Text fw={700} size="xl" c="green">
                    {stats.summary.successRate}%
                  </Text>
                </div>
                <RingProgress
                  size={50}
                  thickness={5}
                  sections={[{ value: stats.summary.successRate, color: 'green' }]}
                  label={
                    <Center>
                      <IconCheck size={16} />
                    </Center>
                  }
                />
              </Group>
            </Paper>
          </Grid.Col>

          <Grid.Col span={3}>
            <Paper p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase" fw={500}>
                    Sent
                  </Text>
                  <Text fw={700} size="xl" c="green">
                    {stats.summary.sent.toLocaleString()}
                  </Text>
                </div>
                <IconCheck size={24} stroke={1.5} opacity={0.5} color="green" />
              </Group>
            </Paper>
          </Grid.Col>

          <Grid.Col span={3}>
            <Paper p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase" fw={500}>
                    Failed
                  </Text>
                  <Text fw={700} size="xl" c="red">
                    {stats.summary.failed.toLocaleString()}
                  </Text>
                </div>
                <IconX size={24} stroke={1.5} opacity={0.5} color="red" />
              </Group>
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      {/* Filters */}
      <Card withBorder p="md">
        <Group>
          <Input
            placeholder="Search by tenant or type..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Filter by type"
            leftSection={<IconFilter size={16} />}
            data={[
              { value: '', label: 'All Types' },
              ...availableTypes.map(t => ({ value: t, label: getTypeLabel(t) })),
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            clearable
            style={{ width: 200 }}
          />
          <Select
            placeholder="Status"
            leftSection={<IconChartBar size={16} />}
            data={[
              { value: '', label: 'All Status' },
              { value: 'true', label: 'Sent' },
              { value: 'false', label: 'Failed' },
            ]}
            value={sentFilter}
            onChange={setSentFilter}
            clearable
            style={{ width: 150 }}
          />
          <Input
            placeholder="Tenant ID"
            leftSection={<IconBuilding size={16} />}
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.currentTarget.value)}
            style={{ width: 200 }}
          />
          {tenantFilter && (
            <Button
              variant="subtle"
              size="xs"
              onClick={() => setTenantFilter('')}
            >
              Clear Tenant
            </Button>
          )}
        </Group>
      </Card>

      {/* Table */}
      <Card withBorder>
        {loading ? (
          <Center p="xl">
            <Loader />
          </Center>
        ) : filteredLogs.length === 0 ? (
          <Center p="xl">
            <Stack align="center">
              <IconMail size={48} stroke={1} opacity={0.3} />
              <Text c="dimmed">No notification logs found</Text>
            </Stack>
          </Center>
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Tenant</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredLogs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>
                      <Text size="sm">{formatDate(log.created_at)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{log.tenant_name}</Text>
                      <Text size="xs" c="dimmed">{log.tenant_id}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getTypeColor(log.type)} variant="light">
                        {getTypeLabel(log.type)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {log.sent ? (
                        <Badge color="green" leftSection={<IconCheck size={12} />}>
                          Sent
                        </Badge>
                      ) : (
                        <Badge color="red" leftSection={<IconX size={12} />}>
                          Failed
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        onClick={() => {
                          setSelectedLog(log);
                          setDetailsModalOpen(true);
                        }}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="space-between" mt="md">
              <Text size="sm" c="dimmed">
                Showing {filteredLogs.length} of {totalItems} notifications
              </Text>
              <Pagination
                value={currentPage}
                onChange={setCurrentPage}
                total={totalPages}
                size="sm"
              />
            </Group>
          </>
        )}
      </Card>

      {/* Details Modal */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Notification Details"
        size="lg"
      >
        {selectedLog && (
          <Stack gap="md">
            <Group>
              <Badge color={getTypeColor(selectedLog.type)} size="lg">
                {getTypeLabel(selectedLog.type)}
              </Badge>
              {selectedLog.sent ? (
                <Badge color="green">Sent Successfully</Badge>
              ) : (
                <Badge color="red">Failed</Badge>
              )}
            </Group>

            <Card withBorder p="sm">
              <Grid>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Tenant</Text>
                  <Text size="sm" fw={500}>{selectedLog.tenant_name}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Tenant ID</Text>
                  <Text size="sm" style={{ fontFamily: 'monospace' }}>{selectedLog.tenant_id}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Sent At</Text>
                  <Text size="sm">{formatDate(selectedLog.created_at)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Notification ID</Text>
                  <Text size="sm" style={{ fontFamily: 'monospace' }}>{selectedLog.id}</Text>
                </Grid.Col>
              </Grid>
            </Card>

            {selectedLog.error_message && (
              <Alert color="red" title="Error Message">
                {selectedLog.error_message}
              </Alert>
            )}

            {selectedLog.metadata && (
              <div>
                <Text size="sm" fw={500} mb="xs">Metadata</Text>
                <Spoiler maxHeight={150} showLabel="Show more" hideLabel="Hide">
                  <Paper p="sm" bg="gray.0" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </Paper>
                </Spoiler>
              </div>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
