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
  Switch,
  Tooltip,
  ScrollArea,
  Code,
  Radio,
  NumberInput,
  TextInput,
  Paper,
  Title,
  Grid,
  Center,
  Tabs,
} from '@mantine/core';
import {
  IconRefresh,
  IconPlayerPlay,
  IconHistory,
  IconAlertTriangle,
  IconEye,
  IconClock,
  IconCalendarTime,
  IconShieldCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  adminJobsService,
  ScheduledJob,
  JobRun,
} from '@/services/AdminJobsService';
import {
  adminErrorLogService,
  ErrorSuppressionsResponse,
} from '@/services/AdminErrorLogService';
import { clientLogger } from '@/lib/client-logger';

dayjs.extend(relativeTime);

const RUNS_PER_PAGE = 15;

function statusColor(status?: string | null): string {
  switch (status) {
    case 'success': return 'green';
    case 'failed': return 'red';
    case 'running': return 'blue';
    case 'skipped': return 'gray';
    default: return 'gray';
  }
}

function jobStatusBadge(job: ScheduledJob) {
  if (job.envDisabled) return <Badge color="dark" variant="light">env disabled</Badge>;
  if (!job.enabled) return <Badge color="gray" variant="light">disabled</Badge>;
  if (job.running || job.lastRun?.status === 'running') return <Badge color="blue" variant="light">running</Badge>;
  if (job.lastRun?.status === 'failed') return <Badge color="red" variant="light">failing</Badge>;
  if (!job.instrumented) return <Badge color="yellow" variant="light">not instrumented</Badge>;
  return <Badge color="green" variant="light">ok</Badge>;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  // History modal state
  const [historyJob, setHistoryJob] = useState<ScheduledJob | null>(null);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsPage, setRunsPage] = useState(1);
  const [runsTotalPages, setRunsTotalPages] = useState(1);

  // Run detail modal state
  const [selectedRun, setSelectedRun] = useState<JobRun | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Dedupe tab state
  const [tab, setTab] = useState<string | null>('jobs');
  const [suppData, setSuppData] = useState<ErrorSuppressionsResponse | null>(null);
  const [suppLoading, setSuppLoading] = useState(false);

  // Reschedule modal state
  const [scheduleJob, setScheduleJob] = useState<ScheduledJob | null>(null);
  const [scheduleKind, setScheduleKind] = useState<'default' | 'interval' | 'cron'>('default');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [cronExpr, setCronExpr] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setJobs(await adminJobsService.getJobs());
    } catch (error) {
      clientLogger.error('[AdminJobsPage] Error fetching jobs:', { detail: error });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRuns = useCallback(async (jobName: string, page: number) => {
    try {
      setRunsLoading(true);
      const data = await adminJobsService.getRuns(jobName, page, RUNS_PER_PAGE);
      setRuns(data.runs);
      setRunsTotalPages(data.pagination.totalPages);
    } catch (error) {
      clientLogger.error('[AdminJobsPage] Error fetching runs:', { detail: error });
    } finally {
      setRunsLoading(false);
    }
  }, []);

  const fetchSuppressions = useCallback(async () => {
    try {
      setSuppLoading(true);
      setSuppData(await adminErrorLogService.getSuppressions());
    } catch (error) {
      clientLogger.error('[AdminJobsPage] Error fetching suppressions:', { detail: error });
    } finally {
      setSuppLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (tab === 'dedupe' && !suppData) fetchSuppressions();
  }, [tab, suppData, fetchSuppressions]);

  const openHistory = (job: ScheduledJob) => {
    setHistoryJob(job);
    setRunsPage(1);
    setRuns([]);
    fetchRuns(job.name, 1);
  };

  const openRunDetail = async (run: JobRun) => {
    setDetailLoading(true);
    setSelectedRun(run); // show summary immediately, fill logs async
    try {
      const full = historyJob ? await adminJobsService.getRun(historyJob.name, run.id) : run;
      if (full) setSelectedRun(full);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTrigger = async (job: ScheduledJob) => {
    setTriggering(job.name);
    try {
      const result = await adminJobsService.triggerJob(job.name);
      if (result.ok) {
        notifications.show({ title: 'Job triggered', message: `${job.name} completed`, color: 'green' });
      } else {
        notifications.show({ title: 'Trigger failed', message: result.error || 'Unknown error', color: 'red' });
      }
      await fetchJobs();
      if (historyJob?.name === job.name) fetchRuns(job.name, runsPage);
    } finally {
      setTriggering(null);
    }
  };

  const openScheduleModal = (job: ScheduledJob) => {
    setScheduleJob(job);
    setScheduleKind(job.scheduleOverride?.kind ?? 'default');
    setIntervalMinutes(
      job.scheduleOverride?.kind === 'interval' ? parseInt(job.scheduleOverride.value, 10) || 60 : 60,
    );
    setCronExpr(job.scheduleOverride?.kind === 'cron' ? job.scheduleOverride.value : '');
  };

  const handleSaveSchedule = async () => {
    if (!scheduleJob) return;
    setSavingSchedule(true);
    try {
      const result = await adminJobsService.setSchedule(scheduleJob.name, scheduleKind, {
        intervalMinutes,
        cron: cronExpr.trim(),
      });
      if (result.ok) {
        notifications.show({
          title: 'Schedule updated',
          message: result.nextRunAt
            ? `${scheduleJob.name} next runs ${dayjs(result.nextRunAt).fromNow()}`
            : `${scheduleJob.name} rescheduled`,
          color: 'green',
        });
        setScheduleJob(null);
        await fetchJobs();
      } else {
        notifications.show({ title: 'Schedule update failed', message: result.error || 'Unknown error', color: 'red' });
      }
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggle = async (job: ScheduledJob, enabled: boolean) => {
    // Optimistic update
    setJobs((prev) => prev.map((j) => (j.name === job.name ? { ...j, enabled } : j)));
    const result = await adminJobsService.setEnabled(job.name, enabled);
    if (!result.ok) {
      setJobs((prev) => prev.map((j) => (j.name === job.name ? { ...j, enabled: !enabled } : j)));
      notifications.show({ title: 'Update failed', message: result.error || 'Could not persist', color: 'red' });
    } else {
      notifications.show({
        title: enabled ? 'Job enabled' : 'Job disabled',
        message: job.name,
        color: enabled ? 'green' : 'orange',
      });
    }
  };

  const runningCount = jobs.filter((j) => j.running || j.lastRun?.status === 'running').length;
  const disabledCount = jobs.filter((j) => !j.enabled || j.envDisabled).length;
  const failingCount = jobs.filter((j) => j.lastRun?.status === 'failed').length;
  const instrumentedCount = jobs.filter((j) => j.instrumented).length;

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Scheduled Jobs</Title>
          <Text c="dimmed" size="sm">
            Background job registry — status, run history, failures, and controls
          </Text>
        </div>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={tab === 'dedupe' ? fetchSuppressions : fetchJobs}
          loading={tab === 'dedupe' ? suppLoading : loading}
        >
          Refresh
        </Button>
      </Group>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="jobs">Scheduled Jobs</Tabs.Tab>
          <Tabs.Tab value="dedupe" leftSection={<IconShieldCheck size={16} />}>
            Log Dedupe
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="dedupe" pt="md">
          <Stack gap="md">
            <Alert icon={<IconShieldCheck size={16} />} color="blue" variant="light">
              Repeated identical errors are deduplicated before they reach the database —
              the table below accounts for what was dropped so volume stays visible.
            </Alert>
            {suppData?.summary && (
              <Grid>
                <Grid.Col span={{ base: 6, sm: 4 }}>
                  <Card withBorder p="md">
                    <Text size="xs" c="dimmed" tt="uppercase">Suppressed (all time)</Text>
                    <Text fw={700} size="xl">{Number(suppData.summary.total_suppressed ?? 0).toLocaleString()}</Text>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 4 }}>
                  <Card withBorder p="md">
                    <Text size="xs" c="dimmed" tt="uppercase">Distinct Messages</Text>
                    <Text fw={700} size="xl">{Number(suppData.summary.distinct_messages ?? 0)}</Text>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 4 }}>
                  <Card withBorder p="md">
                    <Text size="xs" c="dimmed" tt="uppercase">Active (last hour)</Text>
                    <Text fw={700} size="xl" c={Number(suppData.summary.active_last_hour) ? 'orange' : undefined}>
                      {Number(suppData.summary.active_last_hour ?? 0)}
                    </Text>
                  </Card>
                </Grid.Col>
              </Grid>
            )}
            {suppLoading && !suppData ? (
              <Center py="xl"><Loader /></Center>
            ) : !suppData || suppData.suppressions.length === 0 ? (
              <Alert icon={<IconShieldCheck size={16} />} color="green" variant="light">
                No suppressed errors — dedupe is idle.
              </Alert>
            ) : (
              <Paper withBorder>
                <ScrollArea>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Message</Table.Th>
                        <Table.Th>Source</Table.Th>
                        <Table.Th>Suppressed</Table.Th>
                        <Table.Th>First Seen</Table.Th>
                        <Table.Th>Last Seen</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {suppData.suppressions.map((row) => (
                        <Table.Tr key={row.message_md5}>
                          <Table.Td>
                            <Tooltip label={row.message} multiline maw={500}>
                              <Text size="sm" lineClamp={2} maw={420}>{row.message}</Text>
                            </Tooltip>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="sm" variant="light" color={row.source === 'logger' ? 'violet' : 'cyan'}>
                              {row.source}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={600} size="sm">{Number(row.suppressed_count).toLocaleString()}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">{dayjs(row.first_suppressed_at).fromNow()}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">{dayjs(row.last_suppressed_at).fromNow()}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="jobs" pt="md">

      <Grid>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase">Total Jobs</Text>
            <Text fw={700} size="xl">{jobs.length}</Text>
            <Text size="xs" c="dimmed">{instrumentedCount} instrumented</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase">Running Now</Text>
            <Text fw={700} size="xl" c="blue">{runningCount}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase">Failing (last run)</Text>
            <Text fw={700} size="xl" c={failingCount ? 'red' : undefined}>{failingCount}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase">Disabled</Text>
            <Text fw={700} size="xl" c={disabledCount ? 'orange' : undefined}>{disabledCount}</Text>
          </Card>
        </Grid.Col>
      </Grid>

      {loading && jobs.length === 0 ? (
        <Center py="xl"><Loader /></Center>
      ) : jobs.length === 0 ? (
        <Alert icon={<IconAlertTriangle size={16} />} color="yellow">
          No jobs registered. The job catalog is declared when the API server starts.
        </Alert>
      ) : (
        <Paper withBorder>
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Job</Table.Th>
                  <Table.Th>Schedule</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last Run</Table.Th>
                  <Table.Th>30d</Table.Th>
                  <Table.Th>Next Run</Table.Th>
                  <Table.Th>Enabled</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {jobs.map((job) => (
                  <Table.Tr key={job.name}>
                    <Table.Td>
                      <Text fw={500} size="sm">{job.name}</Text>
                      {job.description && (
                        <Text size="xs" c="dimmed" lineClamp={1}>{job.description}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Text size="sm">{job.effectiveSchedule ?? job.scheduleLabel ?? '—'}</Text>
                        {job.scheduleOverride && (
                          <Badge size="xs" color="violet" variant="light">custom</Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{jobStatusBadge(job)}</Table.Td>
                    <Table.Td>
                      {job.lastRun ? (
                        <Stack gap={2}>
                          <Group gap="xs">
                            <Badge size="sm" color={statusColor(job.lastRun.status)} variant="dot">
                              {job.lastRun.status}
                            </Badge>
                            <Text size="xs" c="dimmed">{dayjs(job.lastRun.started_at).fromNow()}</Text>
                          </Group>
                          <Text size="xs" c="dimmed">{formatDuration(job.lastRun.duration_ms)}</Text>
                        </Stack>
                      ) : (
                        <Text size="sm" c="dimmed">never</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {job.stats30d.runs} runs
                        {job.stats30d.failures > 0 && (
                          <Text span c="red" size="sm"> · {job.stats30d.failures} failed</Text>
                        )}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {job.nextRunAt ? (
                        <Text size="sm">{dayjs(job.nextRunAt).fromNow()}</Text>
                      ) : (
                        <Text size="sm" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Tooltip
                        label={
                          job.envDisabled
                            ? 'Disabled by environment variable'
                            : !job.instrumented
                              ? 'Not instrumented — toggle persists but does not gate this job yet'
                              : undefined
                        }
                      >
                        <span>
                          <Switch
                            checked={job.enabled && !job.envDisabled}
                            disabled={job.envDisabled || !job.instrumented}
                            onChange={(e) => handleToggle(job, e.currentTarget.checked)}
                            size="sm"
                          />
                        </span>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Tooltip label={job.instrumented ? 'Run now' : 'Not instrumented — cannot trigger'}>
                          <span>
                            <ActionIcon
                              variant="light"
                              color="blue"
                              disabled={!job.instrumented || !job.enabled || job.envDisabled}
                              loading={triggering === job.name}
                              onClick={() => handleTrigger(job)}
                            >
                              <IconPlayerPlay size={16} />
                            </ActionIcon>
                          </span>
                        </Tooltip>
                        <Tooltip
                          label={
                            job.instrumented
                              ? 'Reschedule'
                              : 'Not instrumented — schedule is managed inside the job'
                          }
                        >
                          <span>
                            <ActionIcon
                              variant="light"
                              color="violet"
                              disabled={!job.instrumented}
                              onClick={() => openScheduleModal(job)}
                            >
                              <IconCalendarTime size={16} />
                            </ActionIcon>
                          </span>
                        </Tooltip>
                        <Tooltip label="Run history">
                          <ActionIcon variant="light" color="gray" onClick={() => openHistory(job)}>
                            <IconHistory size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

        </Tabs.Panel>
      </Tabs>

      {/* Run history modal */}
      <Modal
        opened={!!historyJob}
        onClose={() => setHistoryJob(null)}
        title={
          <Group gap="xs">
            <IconClock size={18} />
            <Text fw={600}>Run History — {historyJob?.name}</Text>
          </Group>
        }
        size="xl"
      >
        {runsLoading && runs.length === 0 ? (
          <Center py="xl"><Loader /></Center>
        ) : runs.length === 0 ? (
          <Alert color="gray" variant="light">No recorded runs yet.</Alert>
        ) : (
          <Stack>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Trigger</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Duration</Table.Th>
                  <Table.Th>Error</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {runs.map((run) => (
                  <Table.Tr key={run.id}>
                    <Table.Td>
                      <Text size="sm">{dayjs(run.started_at).format('MMM D, HH:mm:ss')}</Text>
                      <Text size="xs" c="dimmed">{dayjs(run.started_at).fromNow()}</Text>
                    </Table.Td>
                    <Table.Td><Badge size="sm" variant="outline">{run.trigger_source}</Badge></Table.Td>
                    <Table.Td><Badge size="sm" color={statusColor(run.status)}>{run.status}</Badge></Table.Td>
                    <Table.Td><Text size="sm">{formatDuration(run.duration_ms)}</Text></Table.Td>
                    <Table.Td>
                      <Text size="xs" c="red" lineClamp={1} maw={220}>{run.error ?? ''}</Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon variant="subtle" onClick={() => openRunDetail(run)}>
                        <IconEye size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {runsTotalPages > 1 && (
              <Pagination
                value={runsPage}
                onChange={(p) => { setRunsPage(p); if (historyJob) fetchRuns(historyJob.name, p); }}
                total={runsTotalPages}
              />
            )}
          </Stack>
        )}
      </Modal>

      {/* Reschedule modal */}
      <Modal
        opened={!!scheduleJob}
        onClose={() => setScheduleJob(null)}
        title={
          <Group gap="xs">
            <IconCalendarTime size={18} />
            <Text fw={600}>Reschedule — {scheduleJob?.name}</Text>
          </Group>
        }
        size="md"
      >
        {scheduleJob && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Code-defined schedule: <Text span fw={500}>{scheduleJob.scheduleLabel ?? 'unknown'}</Text>
            </Text>
            <Radio.Group
              value={scheduleKind}
              onChange={(v) => setScheduleKind(v as 'default' | 'interval' | 'cron')}
            >
              <Stack gap="sm">
                <Radio
                  value="default"
                  label={`Default — ${scheduleJob.scheduleLabel ?? 'code-defined schedule'}`}
                />
                <Radio value="interval" label="Every N minutes" />
                {scheduleKind === 'interval' && (
                  <NumberInput
                    ml="xl"
                    label="Minutes between runs"
                    min={1}
                    max={43200}
                    value={intervalMinutes}
                    onChange={(v) => setIntervalMinutes(typeof v === 'number' ? v : 60)}
                    size="sm"
                    w={220}
                  />
                )}
                <Radio value="cron" label="Cron expression (UTC)" />
                {scheduleKind === 'cron' && (
                  <Stack gap={4} ml="xl">
                    <TextInput
                      placeholder="5 0 1 * *"
                      value={cronExpr}
                      onChange={(e) => setCronExpr(e.currentTarget.value)}
                      size="sm"
                      w={280}
                    />
                    <Text size="xs" c="dimmed">
                      5 fields: minute hour day-of-month month day-of-week. Supports lists,
                      ranges, steps, names, and @hourly/@daily/@weekly/@monthly.
                    </Text>
                  </Stack>
                )}
              </Stack>
            </Radio.Group>
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={() => setScheduleJob(null)}>Cancel</Button>
              <Button
                onClick={handleSaveSchedule}
                loading={savingSchedule}
                disabled={
                  scheduleKind === 'interval'
                    ? !intervalMinutes || intervalMinutes < 1
                    : scheduleKind === 'cron'
                      ? !cronExpr.trim()
                      : false
                }
              >
                Save schedule
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Run detail modal */}
      <Modal
        opened={!!selectedRun}
        onClose={() => setSelectedRun(null)}
        title={<Text fw={600}>Run Detail</Text>}
        size="lg"
      >
        {selectedRun && (
          <Stack gap="sm">
            <Group>
              <Badge color={statusColor(selectedRun.status)}>{selectedRun.status}</Badge>
              <Badge variant="outline">{selectedRun.trigger_source}</Badge>
              {selectedRun.hostname && <Text size="xs" c="dimmed">{selectedRun.hostname}</Text>}
            </Group>
            <Text size="sm">
              Started {dayjs(selectedRun.started_at).format('MMM D, YYYY HH:mm:ss')}
              {selectedRun.finished_at && ` · finished ${dayjs(selectedRun.finished_at).format('HH:mm:ss')}`}
              {` · ${formatDuration(selectedRun.duration_ms)}`}
            </Text>
            {selectedRun.error && (
              <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{selectedRun.error}</Text>
              </Alert>
            )}
            {selectedRun.result != null && (
              <div>
                <Text size="sm" fw={600} mb={4}>Result</Text>
                <Code block>{JSON.stringify(selectedRun.result, null, 2)}</Code>
              </div>
            )}
            <div>
              <Text size="sm" fw={600} mb={4}>Logs</Text>
              {detailLoading ? (
                <Loader size="sm" />
              ) : selectedRun.logs ? (
                <ScrollArea h={320}>
                  <Code block style={{ fontSize: 12 }}>{selectedRun.logs}</Code>
                </ScrollArea>
              ) : (
                <Text size="sm" c="dimmed">No captured output.</Text>
              )}
            </div>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
