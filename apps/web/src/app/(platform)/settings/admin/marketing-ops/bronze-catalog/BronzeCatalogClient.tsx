'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Paper, Text, Group, Badge, Button, Stack, Alert, Loader, Select,
  TextInput, Textarea, Switch, Modal, NumberInput, Table, Tooltip,
  Divider, Code, ScrollArea, Tabs,
} from '@mantine/core';
import {
  IconRefresh, IconAlertCircle, IconPlus, IconEdit, IconBan,
  IconFlask2, IconCopy, IconCheck, IconSearch,
} from '@tabler/icons-react';
import marketingOpsService, {
  BronzeReason,
  BronzeReasonInput,
  BronzeUncoveredReason,
  BronzeTestScanResult,
} from '@/services/MarketingOpsService';

const PLATFORM_OPTIONS = [
  { value: 'google', label: 'Google' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'bbb', label: 'BBB' },
  { value: 'apple_maps', label: 'Apple Maps' },
  { value: 'bing', label: 'Bing' },
];

const SCOPE_LABEL = (r: BronzeReason): string => {
  const parts: string[] = [];
  if (r.scope_category_key) parts.push(`cat:${r.scope_category_key}`);
  if (r.scope_city || r.scope_state) parts.push(`${r.scope_city ?? ''}${r.scope_city && r.scope_state ? ', ' : ''}${r.scope_state ?? ''}`);
  if (r.scope_platform) parts.push(`@${r.scope_platform}`);
  return parts.length ? parts.join(' · ') : 'universal';
};

interface ReasonFormState {
  reason_key: string;
  label: string;
  definition: string;
  signals: string;
  expected_vectors: string;
  priority: number;
  scope_category_key: string;
  scope_city: string;
  scope_state: string;
  scope_platform: string | null;
}

const EMPTY_FORM: ReasonFormState = {
  reason_key: '',
  label: '',
  definition: '',
  signals: '',
  expected_vectors: '',
  priority: 3,
  scope_category_key: '',
  scope_city: '',
  scope_state: '',
  scope_platform: null,
};

const linesToArray = (s: string): string[] =>
  s.split('\n').map((l) => l.trim()).filter(Boolean);

export default function BronzeCatalogClient() {
  const [reasons, setReasons] = useState<BronzeReason[]>([]);
  const [catalogRevision, setCatalogRevision] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [fCategory, setFCategory] = useState('');
  const [fCity, setFCity] = useState('');
  const [fState, setFState] = useState('');
  const [fPlatform, setFPlatform] = useState<string | null>(null);
  const [includeDeprecated, setIncludeDeprecated] = useState(false);

  // Create/Edit modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<ReasonFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Deprecate modal
  const [deprecateTarget, setDeprecateTarget] = useState<BronzeReason | null>(null);
  const [deprecateReason, setDeprecateReason] = useState('');
  const [supersededBy, setSupersededBy] = useState('');
  const [deprecating, setDeprecating] = useState(false);

  // Test-scan modal
  const [testTarget, setTestTarget] = useState<BronzeReason | null>(null);
  const [testPrompt, setTestPrompt] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState('');
  const [testResult, setTestResult] = useState<BronzeTestScanResult | null>(null);
  const [testIssues, setTestIssues] = useState<string[] | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Uncovered panel
  const [uCategory, setUCategory] = useState('');
  const [uProfileId, setUProfileId] = useState('');
  const [uRevision, setURevision] = useState<number | ''>('');
  const [uncovered, setUncovered] = useState<BronzeUncoveredReason[] | null>(null);
  const [uncoveredBusy, setUncoveredBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await marketingOpsService.listBronzeReasons({
        categoryKey: fCategory || undefined,
        city: fCity || undefined,
        state: fState || undefined,
        platform: fPlatform || undefined,
        includeDeprecated,
      });
      setReasons(res.reasons);
      setCatalogRevision(res.catalog_revision);
    } catch (e: any) {
      setError(e.message || 'Failed to load bronze reasons');
    } finally {
      setLoading(false);
    }
  }, [fCategory, fCity, fState, fPlatform, includeDeprecated]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditorMode('create');
    setEditorOpen(true);
  };

  const openEdit = (r: BronzeReason) => {
    setForm({
      reason_key: r.reason_key,
      label: r.label,
      definition: r.definition,
      signals: (r.signals ?? []).join('\n'),
      expected_vectors: (r.expected_vectors ?? []).join('\n'),
      priority: r.priority,
      scope_category_key: r.scope_category_key ?? '',
      scope_city: r.scope_city ?? '',
      scope_state: r.scope_state ?? '',
      scope_platform: r.scope_platform,
    });
    setEditorMode('edit');
    setEditorOpen(true);
  };

  const saveReason = async () => {
    setSaving(true);
    setError(null);
    const input: BronzeReasonInput = {
      label: form.label,
      definition: form.definition,
      signals: linesToArray(form.signals),
      expected_vectors: linesToArray(form.expected_vectors),
      priority: form.priority,
      scope_category_key: form.scope_category_key || null,
      scope_city: form.scope_city || null,
      scope_state: form.scope_state || null,
      scope_platform: (form.scope_platform as any) || null,
    };
    try {
      if (editorMode === 'create') {
        await marketingOpsService.createBronzeReason(form.reason_key, input);
      } else {
        await marketingOpsService.updateBronzeReason(form.reason_key, input);
      }
      setEditorOpen(false);
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to save reason');
    } finally {
      setSaving(false);
    }
  };

  const runDeprecate = async () => {
    if (!deprecateTarget) return;
    setDeprecating(true);
    try {
      await marketingOpsService.deprecateBronzeReason(deprecateTarget.reason_key, {
        deprecated_reason: deprecateReason || null,
        superseded_by: supersededBy || null,
      });
      setDeprecateTarget(null);
      setDeprecateReason('');
      setSupersededBy('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to deprecate reason');
    } finally {
      setDeprecating(false);
    }
  };

  const openTestScan = async (r: BronzeReason) => {
    setTestTarget(r);
    setTestPrompt(null);
    setTestOutput('');
    setTestResult(null);
    setTestIssues(null);
    setTestBusy(true);
    try {
      const res = await marketingOpsService.testScanBronzeReason(r.reason_key, { mode: 'render' });
      setTestPrompt(res.prompt ?? null);
    } catch (e: any) {
      setTestIssues([e.message || 'Failed to render test prompt']);
    } finally {
      setTestBusy(false);
    }
  };

  const runValidate = async () => {
    if (!testTarget) return;
    setTestBusy(true);
    setTestResult(null);
    setTestIssues(null);
    try {
      const res = await marketingOpsService.testScanBronzeReason(testTarget.reason_key, {
        mode: 'validate',
        rawOutput: testOutput,
      });
      setTestResult(res);
    } catch (e: any) {
      setTestIssues(Array.isArray(e.issues) ? e.issues : [e.message || 'Validation failed']);
    } finally {
      setTestBusy(false);
    }
  };

  const runUncovered = async () => {
    if (!uCategory.trim()) return;
    setUncoveredBusy(true);
    setUncovered(null);
    try {
      const res = await marketingOpsService.listUncoveredBronzeReasons({
        categoryKey: uCategory.trim(),
        profileId: uProfileId.trim() || undefined,
        catalogRevision: uRevision === '' ? undefined : uRevision,
      });
      setUncovered(res.uncovered);
    } catch (e: any) {
      setError(e.message || 'Uncovered-reason query failed');
    } finally {
      setUncoveredBusy(false);
    }
  };

  const activeCount = useMemo(() => reasons.filter((r) => r.deprecated_in_revision === null).length, [reasons]);

  return (
    <Stack gap="lg">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" wrap="wrap">
          <Group gap="md">
            <Text fw={600}>Catalog</Text>
            <Badge variant="light" color="blue">revision {catalogRevision}</Badge>
            <Badge variant="light" color="gray">{activeCount} live reason{activeCount === 1 ? '' : 's'}</Badge>
          </Group>
          <Group gap="xs">
            <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={load} loading={loading}>
              Refresh
            </Button>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
              New Reason
            </Button>
          </Group>
        </Group>

        <Group gap="sm" mt="md" wrap="wrap" align="flex-end">
          <TextInput label="Category" placeholder="e.g. african grocery store" value={fCategory} onChange={(e) => setFCategory(e.currentTarget.value)} w={200} />
          <TextInput label="City" placeholder="City" value={fCity} onChange={(e) => setFCity(e.currentTarget.value)} w={140} />
          <TextInput label="State" placeholder="IN" value={fState} onChange={(e) => setFState(e.currentTarget.value)} w={80} />
          <Select label="Platform" placeholder="Any" clearable data={PLATFORM_OPTIONS} value={fPlatform} onChange={setFPlatform} w={140} />
          <Switch label="Show deprecated" checked={includeDeprecated} onChange={(e) => setIncludeDeprecated(e.currentTarget.checked)} mt={24} />
        </Group>
      </Paper>

      <Paper withBorder radius="md">
        {loading ? (
          <Group justify="center" py={40}><Loader size="sm" /></Group>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Reason</Table.Th>
                  <Table.Th>Priority</Table.Th>
                  <Table.Th>Scope</Table.Th>
                  <Table.Th>Provenance</Table.Th>
                  <Table.Th>Revisions</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reasons.map((r) => {
                  const deprecated = r.deprecated_in_revision !== null;
                  return (
                    <Table.Tr key={r.reason_key} style={{ opacity: deprecated ? 0.55 : 1 }}>
                      <Table.Td>
                        <Text size="sm" fw={600} ff="monospace">{r.reason_key}</Text>
                        <Text size="sm">{r.label}</Text>
                        <Text size="xs" c="dimmed" lineClamp={2}>{r.definition}</Text>
                      </Table.Td>
                      <Table.Td><Badge size="sm" variant="light">{r.priority}</Badge></Table.Td>
                      <Table.Td><Text size="xs" ff="monospace">{SCOPE_LABEL(r)}</Text></Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="dot" color={r.provenance === 'operator_authored' ? 'violet' : 'blue'}>
                          {r.provenance === 'operator_authored' ? 'operator' : 'derived'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          +r{r.introduced_in_revision}
                          {r.revised_in_revision ? ` · ~r${r.revised_in_revision}` : ''}
                          {deprecated ? ` · −r${r.deprecated_in_revision}` : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {deprecated ? (
                          <Tooltip label={r.superseded_by ? `superseded by ${r.superseded_by}` : (r.deprecated_reason ?? 'deprecated')}>
                            <Badge size="xs" color="red" variant="light">deprecated</Badge>
                          </Tooltip>
                        ) : (
                          <Badge size="xs" color="green" variant="light">live</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Edit">
                            <Button size="compact-xs" variant="subtle" onClick={() => openEdit(r)} disabled={deprecated}>
                              <IconEdit size={14} />
                            </Button>
                          </Tooltip>
                          <Tooltip label="Single-reason test scan">
                            <Button size="compact-xs" variant="subtle" onClick={() => openTestScan(r)}>
                              <IconFlask2 size={14} />
                            </Button>
                          </Tooltip>
                          <Tooltip label="Deprecate">
                            <Button size="compact-xs" variant="subtle" color="red" onClick={() => { setDeprecateTarget(r); setDeprecateReason(''); setSupersededBy(''); }} disabled={deprecated}>
                              <IconBan size={14} />
                            </Button>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {reasons.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text size="sm" c="dimmed" ta="center" py="lg">No reasons match the current filters.</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* Uncovered reasons probe */}
      <Paper withBorder p="md" radius="md">
        <Text fw={600} size="sm">Uncovered-reason probe</Text>
        <Text size="xs" c="dimmed" mb="sm">
          Reasons a profile stamped at an older catalog revision has never covered or covers against a stale definition.
        </Text>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <TextInput label="Category" placeholder="african grocery store" value={uCategory} onChange={(e) => setUCategory(e.currentTarget.value)} w={220} required />
          <TextInput label="Profile ID" placeholder="mip-…" value={uProfileId} onChange={(e) => setUProfileId(e.currentTarget.value)} w={220} />
          <NumberInput label="or Catalog revision" placeholder="e.g. 1" value={uRevision} onChange={(v) => setURevision(typeof v === 'number' ? v : '')} w={160} min={0} />
          <Button size="xs" leftSection={<IconSearch size={14} />} onClick={runUncovered} loading={uncoveredBusy} disabled={!uCategory.trim() || (!uProfileId.trim() && uRevision === '')}>
            Check coverage
          </Button>
        </Group>
        {uncovered && (
          <Stack gap={4} mt="md">
            {uncovered.length === 0 ? (
              <Text size="sm" c="green">No uncovered reasons — the profile is current with the catalog.</Text>
            ) : uncovered.map((u) => (
              <Group key={u.reason_key} gap="xs">
                <Badge size="xs" color={u.gap_kind === 'never_covered' ? 'red' : 'yellow'} variant="light">
                  {u.gap_kind === 'never_covered' ? 'never covered' : 'revised since authored'}
                </Badge>
                <Code>{u.reason_key}</Code>
                <Text size="sm">{u.label}</Text>
              </Group>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Create / Edit modal */}
      <Modal
        opened={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editorMode === 'create' ? 'Author bronze reason' : `Edit ${form.reason_key}`}
        size="lg"
      >
        <Stack gap="sm">
          {editorMode === 'create' ? (
            <TextInput
              label="Reason key"
              description="snake_case, immutable once created — e.g. absent_from_platform"
              value={form.reason_key}
              onChange={(e) => setForm({ ...form, reason_key: e.currentTarget.value })}
              required
            />
          ) : (
            <Text size="sm" c="dimmed">reason_key is immutable: <Code>{form.reason_key}</Code></Text>
          )}
          <TextInput label="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.currentTarget.value })} required />
          <Textarea label="Definition" description="The blind spot this reason names — why a real, operating, category-qualified business is invisible." value={form.definition} onChange={(e) => setForm({ ...form, definition: e.currentTarget.value })} minRows={3} required />
          <Textarea label="Signals (one per line)" description="Observable vocabulary the scan matches — missing fields, generic categories, absent listings…" value={form.signals} onChange={(e) => setForm({ ...form, signals: e.currentTarget.value })} minRows={3} />
          <Textarea label="Expected vectors (one per line)" description="The discovery surfaces that reach this blind spot — community directories, customs records, word-of-mouth…" value={form.expected_vectors} onChange={(e) => setForm({ ...form, expected_vectors: e.currentTarget.value })} minRows={3} />
          <NumberInput label="Priority (1 = highest)" value={form.priority} onChange={(v) => setForm({ ...form, priority: typeof v === 'number' ? v : 3 })} min={1} max={5} />
          <Divider label="Scope (blank = universal)" labelPosition="center" />
          <TextInput label="Category key" placeholder="e.g. african grocery store" value={form.scope_category_key} onChange={(e) => setForm({ ...form, scope_category_key: e.currentTarget.value })} />
          <Group grow>
            <TextInput label="City" value={form.scope_city} onChange={(e) => setForm({ ...form, scope_city: e.currentTarget.value })} />
            <TextInput label="State" value={form.scope_state} onChange={(e) => setForm({ ...form, scope_state: e.currentTarget.value })} />
          </Group>
          <Select label="Platform" placeholder="Cross-platform" clearable data={PLATFORM_OPTIONS} value={form.scope_platform} onChange={(v) => setForm({ ...form, scope_platform: v })} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={saveReason} loading={saving} disabled={!form.label.trim() || !form.definition.trim() || (editorMode === 'create' && !form.reason_key.trim())}>
              {editorMode === 'create' ? 'Author reason' : 'Save changes'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Deprecate modal */}
      <Modal
        opened={!!deprecateTarget}
        onClose={() => setDeprecateTarget(null)}
        title={`Deprecate ${deprecateTarget?.reason_key ?? ''}`}
        size="md"
      >
        <Stack gap="sm">
          <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
            The catalog is additive — deprecating retires the reason from new scans but keeps it in history.
            Existing profiles keep their revision-stamped snapshots.
          </Alert>
          <Textarea label="Deprecation reason" placeholder="Why is this reason being retired?" value={deprecateReason} onChange={(e) => setDeprecateReason(e.currentTarget.value)} minRows={2} />
          <TextInput label="Superseded by (optional)" description="Point at the canonical reason when retiring a duplicate." placeholder="reason_key" value={supersededBy} onChange={(e) => setSupersededBy(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeprecateTarget(null)}>Cancel</Button>
            <Button color="red" onClick={runDeprecate} loading={deprecating}>Deprecate</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Test-scan modal */}
      <Modal
        opened={!!testTarget}
        onClose={() => setTestTarget(null)}
        title={`Test scan — ${testTarget?.reason_key ?? ''}`}
        size="xl"
      >
        <Tabs defaultValue="render">
          <Tabs.List>
            <Tabs.Tab value="render">1 · Render prompt</Tabs.Tab>
            <Tabs.Tab value="validate">2 · Validate output</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="render" pt="md">
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Paste this single-reason prompt into an external agent. Test scans never write profiles.
              </Text>
              {testBusy ? (
                <Group justify="center" py="md"><Loader size="sm" /></Group>
              ) : testPrompt ? (
                <>
                  <Group justify="flex-end">
                    <Button
                      size="xs" variant="light"
                      leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      onClick={() => { navigator.clipboard.writeText(testPrompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    >
                      {copied ? 'Copied' : 'Copy prompt'}
                    </Button>
                  </Group>
                  <ScrollArea h={360}>
                    <Paper withBorder p="sm" radius="sm" bg="gray.0">
                      <Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap' }}>{testPrompt}</Text>
                    </Paper>
                  </ScrollArea>
                </>
              ) : (testIssues ?? []).map((i, idx) => (
                <Alert key={idx} color="red">{i}</Alert>
              ))}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="validate" pt="md">
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Paste the agent&apos;s JSON output. It is validated against <Code>bronze_standard_scan</Code> and the coverage entry for this reason is reported. Nothing is persisted.
              </Text>
              <Textarea value={testOutput} onChange={(e) => setTestOutput(e.currentTarget.value)} minRows={8} autosize={false} styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }} placeholder='{"category_key": "…", "catalog_revision": …, "reason_coverage": […]}' />
              <Group justify="flex-end">
                <Button onClick={runValidate} loading={testBusy} disabled={!testOutput.trim()}>Validate</Button>
              </Group>
              {testIssues && testIssues.map((i, idx) => (
                <Alert key={idx} color="red" icon={<IconAlertCircle size={16} />}>{i}</Alert>
              ))}
              {testResult && (
                <Alert color={testResult.covered ? 'green' : 'yellow'}>
                  {testResult.covered
                    ? `Covered — status: ${(testResult.coverage as any)?.status ?? 'filled'}`
                    : `No coverage entry for ${testResult.reason_key} in this output.`}
                </Alert>
              )}
              {testResult?.coverage && (
                <ScrollArea h={220}>
                  <Paper withBorder p="sm" radius="sm" bg="gray.0">
                    <Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(testResult.coverage, null, 2)}
                    </Text>
                  </Paper>
                </ScrollArea>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </Stack>
  );
}
