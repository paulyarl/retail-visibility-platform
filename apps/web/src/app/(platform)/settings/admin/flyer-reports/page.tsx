'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Badge, Text, Group, Stack, Card, Alert, Loader,
  SegmentedControl, Paper, Title, Image, Tooltip,
} from '@mantine/core';
import {
  IconRefresh, IconAlertTriangle, IconCheck, IconBan, IconExternalLink, IconRestore,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { adminFlyerReportService, FlyerReportEntry } from '@/services/AdminFlyerReportService';

const REASON_LABELS: Record<string, string> = {
  inappropriate: 'Inappropriate',
  misleading: 'Misleading',
  ip_infringement: 'IP infringement',
  prohibited_item: 'Prohibited item',
  other: 'Other',
};

export default function FlyerReportsPage() {
  const [reports, setReports] = useState<FlyerReportEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFlyerReportService.listReports(statusFilter);
      setReports(data.reports);
      setCounts(data.counts);
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Load failed', message: error?.message || 'Failed to load flyer reports' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (report: FlyerReportEntry, action: 'suppress' | 'dismiss') => {
    setActing(report.id);
    try {
      await adminFlyerReportService.resolveReport(report.id, action);
      notifications.show({
        color: 'green',
        title: action === 'suppress' ? 'Flyer suppressed' : 'Report dismissed',
        message: action === 'suppress' ? 'The flyer is off all public surfaces' : 'No action taken on the flyer',
      });
      await load();
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Action failed', message: error?.message || 'Request failed' });
    } finally {
      setActing(null);
    }
  };

  const restore = async (report: FlyerReportEntry) => {
    if (!report.flyer) return;
    setActing(report.id);
    try {
      await adminFlyerReportService.restoreFlyer(report.flyer.id);
      notifications.show({ color: 'green', title: 'Flyer restored', message: 'Returned to draft — the merchant must republish' });
      await load();
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Restore failed', message: error?.message || 'Request failed' });
    } finally {
      setActing(null);
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Flyer Reports</Title>
          <Text size="sm" c="dimmed">Public moderation queue — suppress takes the flyer off every surface</Text>
        </div>
        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={load} loading={loading}>
          Refresh
        </Button>
      </Group>

      <Group>
        <SegmentedControl
          value={statusFilter}
          onChange={setStatusFilter}
          data={[
            { label: `Open (${counts.open ?? 0})`, value: 'open' },
            { label: `Actioned (${counts.actioned ?? 0})`, value: 'actioned' },
            { label: `Dismissed (${counts.dismissed ?? 0})`, value: 'dismissed' },
            { label: 'All', value: 'all' },
          ]}
        />
      </Group>

      {loading ? (
        <Group justify="center" py="xl"><Loader /></Group>
      ) : reports.length === 0 ? (
        <Alert icon={<IconCheck size={18} />} color="green" title="Queue clear">
          No {statusFilter === 'all' ? '' : statusFilter} flyer reports.
        </Alert>
      ) : (
        <Card withBorder padding={0}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Flyer</Table.Th>
                <Table.Th>Merchant</Table.Th>
                <Table.Th>Reason</Table.Th>
                <Table.Th>Detail</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Reported</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {reports.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      {r.flyer?.heroImageUrl && (
                        <Image src={r.flyer.heroImageUrl} alt="" w={44} h={44} radius="sm" fit="cover" />
                      )}
                      <div>
                        <Text size="sm" fw={500} lineClamp={1}>{r.flyer?.title ?? '(flyer deleted)'}</Text>
                        {r.flyer?.shareCode && (
                          <Tooltip label="Open public page">
                            <Text component="a" href={`/flyer/${r.flyer.shareCode}`} target="_blank" size="xs" c="blue">
                              /flyer/{r.flyer.shareCode} <IconExternalLink size={10} style={{ verticalAlign: 'middle' }} />
                            </Text>
                          </Tooltip>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{r.flyer?.tenant?.name ?? '—'}</Text>
                    <Text size="xs" c="dimmed">{r.flyer?.tenant?.slug ?? ''}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={r.reason === 'prohibited_item' || r.reason === 'inappropriate' ? 'red' : 'gray'}>
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" lineClamp={2} maw={260}>{r.detail ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Badge size="sm" color={r.status === 'open' ? 'orange' : r.status === 'actioned' ? 'red' : 'gray'}>{r.status}</Badge>
                      {r.flyer && (
                        <Badge size="sm" variant="outline" color={r.flyer.status === 'suppressed' ? 'red' : r.flyer.status === 'published' ? 'green' : 'gray'}>
                          flyer: {r.flyer.status}
                        </Badge>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">{new Date(r.createdAt).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {r.status === 'open' && (
                        <>
                          <Button size="xs" color="red" variant="light" leftSection={<IconBan size={14} />}
                            loading={acting === r.id} onClick={() => resolve(r, 'suppress')}>
                            Suppress
                          </Button>
                          <Button size="xs" variant="subtle" leftSection={<IconCheck size={14} />}
                            loading={acting === r.id} onClick={() => resolve(r, 'dismiss')}>
                            Dismiss
                          </Button>
                        </>
                      )}
                      {r.flyer?.status === 'suppressed' && (
                        <Button size="xs" variant="light" leftSection={<IconRestore size={14} />}
                          loading={acting === r.id} onClick={() => restore(r)}>
                          Restore to draft
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <Paper withBorder p="sm" radius="md">
        <Group gap="xs">
          <IconAlertTriangle size={14} />
          <Text size="xs" c="dimmed">
            Suppression is operational, not a judgment on the merchant — restore returns the flyer to draft for the merchant to republish.
          </Text>
        </Group>
      </Paper>
    </Stack>
  );
}
