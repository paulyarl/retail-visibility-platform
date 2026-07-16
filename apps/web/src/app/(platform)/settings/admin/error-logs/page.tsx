'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Spoiler,
} from '@mantine/core';
import {
  IconSearch,
  IconEye,
  IconRefresh,
  IconFilter,
  IconAlertTriangle,
  IconCheck,
  IconBug,
  IconBuilding,
  IconCalendar,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  adminErrorLogService,
  ErrorLogEntry,
  ErrorLogDetail,
  ErrorLogStats,
  ErrorLogFilters,
} from '@/services/AdminErrorLogService';
import { clientLogger } from '@/lib/client-logger';

export default function AdminErrorLogsPage() {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [stats, setStats] = useState<ErrorLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  const [resolvedFilter, setResolvedFilter] = useState<string | null>(null);
  const [correlationIdFilter, setCorrelationIdFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedError, setSelectedError] = useState<ErrorLogDetail | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const itemsPerPage = 25;

  const fetchErrors = useCallback(async () => {
    try {
      setLoading(true);
      const filters: ErrorLogFilters = {
        page: currentPage,
        limit: itemsPerPage,
        tenant_id: tenantFilter || undefined,
        level: levelFilter || undefined,
        service: serviceFilter || undefined,
        resolved: resolvedFilter === 'true' ? true : resolvedFilter === 'false' ? false : undefined,
        correlation_id: correlationIdFilter || undefined,
      };
      const data = await adminErrorLogService.getErrors(filters);
      setErrors(data.errors);
      setTotalPages(data.pagination.totalPages);
      setTotalItems(data.pagination.total);
    } catch (error) {
      clientLogger.error('Error fetching error logs:', { detail: error });
      notifications.show({ title: 'Error', message: 'Failed to load error logs', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [currentPage, tenantFilter, levelFilter, serviceFilter, resolvedFilter, correlationIdFilter]);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await adminErrorLogService.getStats(7);
      setStats(data);
    } catch (error) {
      clientLogger.error('Error fetching error stats:', { detail: error });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleViewDetail = async (id: string) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setSelectedError(null);
    const detail = await adminErrorLogService.getErrorById(id);
    setSelectedError(detail);
    setDetailLoading(false);
  };

  const handleResolve = async (id: string) => {
    setResolving(true);
    const result = await adminErrorLogService.resolveError(id);
    if (result) {
      notifications.show({ title: 'Resolved', message: 'Error marked as resolved', color: 'green' });
      setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved: true, resolved_at: result.resolved_at, resolved_by: result.resolved_by } : e));
      if (selectedError?.id === id) {
        setSelectedError(prev => prev ? { ...prev, resolved: true, resolved_at: result.resolved_at, resolved_by: result.resolved_by } : prev);
      }
      fetchStats();
    } else {
      notifications.show({ title: 'Error', message: 'Failed to resolve error', color: 'red' });
    }
    setResolving(false);
  };

  const handleFilterReset = () => {
    setTenantFilter('');
    setLevelFilter(null);
    setServiceFilter(null);
    setResolvedFilter(null);
    setCorrelationIdFilter('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const getLevelColor = (level: string): string => {
    const colors: Record<string, string> = { error: 'red', warn: 'yellow', warning: 'yellow', info: 'blue', debug: 'gray' };
    return colors[level] || 'gray';
  };

  const getStatusBadge = (entry: ErrorLogEntry) => {
    if (entry.resolved) {
      return (
        <Badge color="green" size="sm" leftSection={<IconCheck size={10} />}>
          Resolved
        </Badge>
      );
    }
    return <Badge color="red" size="sm" variant="light">Unresolved</Badge>;
  };

  const filteredErrors = searchQuery
    ? errors.filter(e =>
        e.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.error_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (e.request_path?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : errors;

  const hasActiveFilters = tenantFilter || levelFilter || serviceFilter || resolvedFilter || correlationIdFilter;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Application Error Logs</Title>
          <Text c="dimmed" size="sm">
            Browse and manage persisted application errors across the platform
          </Text>
        </div>
        <Button leftSection={<IconRefresh size={16} />} onClick={() => { fetchErrors(); fetchStats(); }} variant="light">
          Refresh
        </Button>
      </Group>

      {stats && !statsLoading && (
        <Grid>
          <Grid.Col span={3}>
            <Paper p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase" fw={500}>Last 7 Days</Text>
                  <Text fw={700} size="xl">{stats.total.toLocaleString()}</Text>
                </div>
                <IconBug size={24} stroke={1.5} opacity={0.5} />
              </Group>
            </Paper>
          </Grid.Col>
          <Grid.Col span={3}>
            <Paper p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase" fw={500}>Unresolved</Text>
                  <Text fw={700} size="xl" c="red">{stats.unresolved.toLocaleString()}</Text>
                </div>
                <IconAlertTriangle size={24} stroke={1.5} opacity={0.5} color="red" />
              </Group>
            </Paper>
          </Grid.Col>
          <Grid.Col span={3}>
            <Paper p="md" withBorder>
              <Text c="dimmed" size="xs" tt="uppercase" fw={500} mb="xs">By Level</Text>
              <Stack gap={2}>
                {stats.byLevel.map((r) => (
                  <Group key={r.level} justify="space-between">
                    <Badge color={getLevelColor(r.level)} variant="light" size="sm">{r.level}</Badge>
                    <Text size="sm" fw={500}>{r.count}</Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          </Grid.Col>
          <Grid.Col span={3}>
            <Paper p="md" withBorder>
              <Text c="dimmed" size="xs" tt="uppercase" fw={500} mb="xs">Top Tenants</Text>
              <Stack gap={2}>
                {stats.byTenant.slice(0, 5).map((r) => (
                  <Group key={r.tenantId || 'null'} justify="space-between">
                    <Text size="xs" style={{ fontFamily: 'monospace' }} truncate>
                      {r.tenantId || '—'}
                    </Text>
                    <Text size="sm" fw={500}>{r.count}</Text>
                  </Group>
                ))}
                {stats.byTenant.length === 0 && <Text size="xs" c="dimmed">No data</Text>}
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      <Card withBorder p="md">
        <Stack gap="sm">
          <Group>
            <Input
              placeholder="Search message, error name, or path..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Level"
              leftSection={<IconFilter size={16} />}
              data={[
                { value: '', label: 'All Levels' },
                { value: 'error', label: 'Error' },
                { value: 'warn', label: 'Warning' },
                { value: 'info', label: 'Info' },
                { value: 'debug', label: 'Debug' },
              ]}
              value={levelFilter}
              onChange={setLevelFilter}
              clearable
              style={{ width: 140 }}
            />
            <Select
              placeholder="Service"
              leftSection={<IconFilter size={16} />}
              data={[
                { value: '', label: 'All Services' },
                { value: 'client', label: 'Client' },
                { value: 'api', label: 'API' },
                { value: 'job', label: 'Job' },
              ]}
              value={serviceFilter}
              onChange={setServiceFilter}
              clearable
              style={{ width: 150 }}
            />
            <Select
              placeholder="Status"
              data={[
                { value: '', label: 'All Status' },
                { value: 'false', label: 'Unresolved' },
                { value: 'true', label: 'Resolved' },
              ]}
              value={resolvedFilter}
              onChange={setResolvedFilter}
              clearable
              style={{ width: 140 }}
            />
          </Group>
          <Group>
            <Input
              placeholder="Tenant ID (e.g. tid-m8ijkrnk)"
              leftSection={<IconBuilding size={16} />}
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.currentTarget.value)}
              style={{ width: 260 }}
            />
            <Input
              placeholder="Correlation ID"
              leftSection={<IconSearch size={16} />}
              value={correlationIdFilter}
              onChange={(e) => setCorrelationIdFilter(e.currentTarget.value)}
              style={{ width: 260 }}
            />
            {hasActiveFilters && (
              <Button variant="subtle" size="xs" onClick={handleFilterReset}>
                Clear Filters
              </Button>
            )}
          </Group>
        </Stack>
      </Card>

      <Card withBorder>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader />
          </div>
        ) : filteredErrors.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Stack align="center">
              <IconBug size={48} stroke={1} opacity={0.3} />
              <Text c="dimmed">No error logs found</Text>
            </Stack>
          </div>
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Level</Table.Th>
                  <Table.Th>Message</Table.Th>
                  <Table.Th>Tenant</Table.Th>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredErrors.map((entry) => (
                  <Table.Tr key={entry.id}>
                    <Table.Td style={{ minWidth: 140 }}>
                      <Text size="xs">{formatDate(entry.occurred_at)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getLevelColor(entry.level)} variant="light" size="sm">
                        {entry.level}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ maxWidth: 400 }}>
                      <Text size="sm" lineClamp={2}>{entry.message}</Text>
                      {entry.status_code && (
                        <Badge color={entry.status_code >= 500 ? 'red' : 'orange'} size="xs" variant="dot" mt={2}>
                          {entry.status_code}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {entry.tenant_id ? (
                        <Text size="xs" style={{ fontFamily: 'monospace' }}>{entry.tenant_id}</Text>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        {entry.service && (
                          <Badge color="gray" size="xs" variant="light">{entry.service}</Badge>
                        )}
                        {entry.request_method && (
                          <Text size="xs" c="dimmed">{entry.request_method}</Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>{getStatusBadge(entry)}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon variant="subtle" onClick={() => handleViewDetail(entry.id)}>
                          <IconEye size={16} />
                        </ActionIcon>
                        {!entry.resolved && (
                          <ActionIcon
                            variant="subtle"
                            color="green"
                            onClick={() => handleResolve(entry.id)}
                            title="Mark resolved"
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="space-between" mt="md">
              <Text size="sm" c="dimmed">
                Showing {filteredErrors.length} of {totalItems} errors
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

      <Modal
        opened={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Error Details"
        size="lg"
      >
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader />
          </div>
        ) : selectedError ? (
          <Stack gap="md">
            <Group>
              <Badge color={getLevelColor(selectedError.level)} size="lg">{selectedError.level}</Badge>
              {getStatusBadge(selectedError)}
              {selectedError.status_code && (
                <Badge color={selectedError.status_code >= 500 ? 'red' : 'orange'} size="lg">
                  HTTP {selectedError.status_code}
                </Badge>
              )}
            </Group>

            <Card withBorder p="sm">
              <Grid>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Occurred At</Text>
                  <Text size="sm">{formatDate(selectedError.occurred_at)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Correlation ID</Text>
                  <Text size="xs" style={{ fontFamily: 'monospace' }}>{selectedError.correlation_id || '—'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Tenant ID</Text>
                  <Text size="sm" style={{ fontFamily: 'monospace' }}>{selectedError.tenant_id || '—'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">User ID</Text>
                  <Text size="sm" style={{ fontFamily: 'monospace' }}>{selectedError.user_id || '—'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Request Method</Text>
                  <Text size="sm">{selectedError.request_method || '—'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Request Path</Text>
                  <Text size="sm" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {selectedError.request_path || '—'}
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Service</Text>
                  <Text size="sm">{selectedError.service || '—'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Error Name</Text>
                  <Text size="sm">{selectedError.error_name || '—'}</Text>
                </Grid.Col>
                {selectedError.resolved && (
                  <>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">Resolved At</Text>
                      <Text size="sm">{selectedError.resolved_at ? formatDate(selectedError.resolved_at) : '—'}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">Resolved By</Text>
                      <Text size="sm" style={{ fontFamily: 'monospace' }}>{selectedError.resolved_by || '—'}</Text>
                    </Grid.Col>
                  </>
                )}
              </Grid>
            </Card>

            <div>
              <Text size="sm" fw={500} mb="xs">Message</Text>
              <Paper p="sm" bg="gray.0">
                <Text size="sm" style={{ wordBreak: 'break-word' }}>{selectedError.message}</Text>
              </Paper>
            </div>

            {selectedError.stack_trace && (
              <div>
                <Text size="sm" fw={500} mb="xs">Stack Trace</Text>
                <Spoiler maxHeight={200} showLabel="Show full trace" hideLabel="Collapse">
                  <Paper p="sm" bg="gray.0" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selectedError.stack_trace}</pre>
                  </Paper>
                </Spoiler>
              </div>
            )}

            {selectedError.context && (
              <div>
                <Text size="sm" fw={500} mb="xs">Context</Text>
                <Spoiler maxHeight={150} showLabel="Show more" hideLabel="Hide">
                  <Paper p="sm" bg="gray.0" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedError.context, null, 2)}
                    </pre>
                  </Paper>
                </Spoiler>
              </div>
            )}

            {!selectedError.resolved && (
              <Button
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={() => handleResolve(selectedError.id)}
                loading={resolving}
              >
                Mark as Resolved
              </Button>
            )}
          </Stack>
        ) : (
          <Text c="dimmed">Error not found</Text>
        )}
      </Modal>
    </Stack>
  );
}
