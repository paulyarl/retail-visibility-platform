'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Paper,
  Text,
  Group,
  Badge,
  Button,
  Stack,
  Divider,
  Code,
  ScrollArea,
  Alert,
  Loader,
  Modal,
  Textarea,
  Table,
  Select,
  TextInput,
  ActionIcon,
  Menu,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconRefresh,
  IconCheck,
  IconAlertCircle,
  IconBrain,
  IconCircleCheck,
  IconArrowRight,
  IconTarget,
  IconMessage,
  IconListCheck,
  IconTrash,
  IconEdit,
  IconSearch,
  IconExternalLink,
} from '@tabler/icons-react';
import Link from 'next/link';
import marketingOpsService from '@/services/MarketingOpsService';
import type { IntelligenceProfile, ProfileStatus, IntelligenceFocus, Campaign, CampaignScope } from '@/services/MarketingOpsService';
import { STAGE_LABELS } from '@/components/marketing-ops/StageBadge';

const STATUS_COLORS: Record<ProfileStatus, string> = {
  draft: 'orange',
  active: 'green',
  retired: 'gray',
};

const STATUS_LABELS: Record<ProfileStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  retired: 'Retired',
};

const FOCUS_COLORS: Record<IntelligenceFocus, string> = {
  emerging: 'blue',
  competitive: 'violet',
  gold_standards: 'amber',
};

const FOCUS_LABELS: Record<IntelligenceFocus, string> = {
  emerging: 'Emerging',
  competitive: 'Competitive',
  gold_standards: 'Gold Standards',
};

export default function IntelligenceProfilesClient() {
  const [activeProfiles, setActiveProfiles] = useState<IntelligenceProfile[]>([]);
  const [draftProfiles, setDraftProfiles] = useState<IntelligenceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [deletingProfileKey, setDeletingProfileKey] = useState<string | null>(null);
  const [viewProfile, setViewProfile] = useState<IntelligenceProfile | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [publishConfig, setPublishConfig] = useState('');

  // Non-business campaigns (category/city/intelligence scope) — managed here
  // instead of the sales-pipeline Kanban, since they don't move through stages.
  const [nonBusinessCampaigns, setNonBusinessCampaigns] = useState<Campaign[]>([]);
  const [nbLoading, setNbLoading] = useState(false);
  const [nbError, setNbError] = useState<string | null>(null);
  const [nbScopeFilter, setNbScopeFilter] = useState<CampaignScope | ''>('');
  const [nbCategoryFilter, setNbCategoryFilter] = useState('');
  const [nbCityFilter, setNbCityFilter] = useState('');
  const [nbSearch, setNbSearch] = useState('');
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [active, drafts] = await Promise.all([
        marketingOpsService.listIntelligenceProfiles(),
        marketingOpsService.listIntelligenceProfileDrafts(),
      ]);
      setActiveProfiles(active);
      setDraftProfiles(drafts);
    } catch (err) {
      setError((err as Error).message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const fetchNonBusinessCampaigns = useCallback(async () => {
    setNbLoading(true);
    setNbError(null);
    try {
      // Fetch campaigns for each non-business scope and merge. The backend
      // listCampaigns endpoint filters by a single scope at a time, so we
      // issue three parallel requests and concat the results.
      const scopes: CampaignScope[] = ['category', 'city', 'intelligence'];
      const results = await Promise.all(
        scopes.map((scope) =>
          marketingOpsService.listCampaigns({ scope, limit: 200 }),
        ),
      );
      setNonBusinessCampaigns(results.flatMap((r) => r.items));
    } catch (err) {
      setNbError((err as Error).message || 'Failed to load non-business campaigns');
    } finally {
      setNbLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNonBusinessCampaigns();
  }, [fetchNonBusinessCampaigns]);

  const handleDeleteCampaign = async (id: string, label: string) => {
    setDeletingCampaignId(id);
    try {
      await marketingOpsService.deleteCampaign(id);
      notifications.show({
        title: 'Campaign Deleted',
        message: `"${label}" has been deleted.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      await fetchNonBusinessCampaigns();
    } catch (err) {
      notifications.show({
        title: 'Delete Failed',
        message: (err as Error).message,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setDeletingCampaignId(null);
    }
  };

  // Filtered + sorted non-business campaigns for the table.
  const filteredNonBusinessCampaigns = useMemo(() => {
    return nonBusinessCampaigns.filter((c) => {
      if (nbScopeFilter && c.scope !== nbScopeFilter) return false;
      if (nbCategoryFilter && c.category !== nbCategoryFilter) return false;
      if (nbCityFilter && c.city !== nbCityFilter) return false;
      if (nbSearch) {
        const q = nbSearch.toLowerCase();
        const haystack = [c.title, c.business_name, c.category, c.city, c.display_id]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [nonBusinessCampaigns, nbScopeFilter, nbCategoryFilter, nbCityFilter, nbSearch]);

  const nbCategoryOptions = useMemo(
    () => [...new Set(nonBusinessCampaigns.map((c) => c.category).filter(Boolean))].sort(),
    [nonBusinessCampaigns],
  );
  const nbCityOptions = useMemo(
    () => [...new Set(nonBusinessCampaigns.map((c) => c.city).filter(Boolean))].sort(),
    [nonBusinessCampaigns],
  );

  const handleActivate = async (id: string, version: number) => {
    setActivating(`${id}:${version}`);
    try {
      await marketingOpsService.activateIntelligenceProfileDraft(id, version);
      notifications.show({
        title: 'Profile Activated',
        message: `${id} v${version} is now active. Business audits in this category will resolve profile-aware prompts.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      await fetchProfiles();
    } catch (err) {
      notifications.show({
        title: 'Activation Failed',
        message: (err as Error).message,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setActivating(null);
    }
  };

  const handleDeleteDraft = async (profile: IntelligenceProfile) => {
    const key = `${profile.id}:${profile.version}`;
    setDeletingProfileKey(key);
    try {
      await marketingOpsService.deleteIntelligenceProfileDraft(profile.id, profile.version);
      notifications.show({
        title: 'Draft Deleted',
        message: `${profile.category_name} v${profile.version} (${profile.id}) has been deleted.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      await fetchProfiles();
    } catch (err) {
      notifications.show({
        title: 'Delete Failed',
        message: (err as Error).message,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setDeletingProfileKey(null);
    }
  };

  const handlePublish = async () => {
    if (!publishId || !publishConfig.trim()) return;
    try {
      let configJson: Record<string, any>;
      try {
        configJson = JSON.parse(publishConfig);
      } catch {
        notifications.show({
          title: 'Invalid JSON',
          message: 'Configuration must be valid JSON',
          color: 'red',
        });
        return;
      }
      await marketingOpsService.publishIntelligenceProfile(publishId, { configurationJson: configJson });
      notifications.show({
        title: 'Version Published',
        message: `New version published for ${publishId}`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      setPublishOpen(false);
      setPublishId(null);
      setPublishConfig('');
      await fetchProfiles();
    } catch (err) {
      notifications.show({
        title: 'Publish Failed',
        message: (err as Error).message,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const renderProfileCard = (profile: IntelligenceProfile, isDraft: boolean) => {
    const config = profile.configuration_json || {};
    const sources = config.specialized_sources as any[] | undefined;
    const signals = config.category_signals as string[] | undefined;
    const prohibited = config.prohibited_inferences as string[] | undefined;
    const key = `${profile.id}:${profile.version}`;

    return (
      <Paper key={key} shadow="xs" radius="md" withBorder p="md" mb="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs">
              <Text size="sm" fw={600}>{profile.category_name}</Text>
              <Badge size="xs" variant="light" color={STATUS_COLORS[profile.status]}>
                {STATUS_LABELS[profile.status]}
              </Badge>
              <Badge size="xs" variant="dot" color={FOCUS_COLORS[profile.intelligence_focus]}>
                {FOCUS_LABELS[profile.intelligence_focus]}
              </Badge>
              {profile.reference_city ? (
                <Badge size="xs" variant="dot" color="cyan">
                  {profile.reference_city}{profile.reference_state ? `, ${profile.reference_state}` : ''}
                </Badge>
              ) : (
                <Badge size="xs" variant="dot" color="gray">city-agnostic</Badge>
              )}
              <Badge size="xs" variant="dot" color="violet">v{profile.version}</Badge>
            </Group>
            <Text size="xs" c="dimmed" ff="monospace">{profile.id}</Text>
            <Text size="xs" c="dimmed">
              category_key: {profile.category_key} · created {new Date(profile.created_at).toLocaleString()}
            </Text>
            {sources && (
              <Text size="xs" c="dimmed">
                {sources.length} specialized source{sources.length !== 1 ? 's' : ''} ·
                {' '}{signals?.length ?? 0} signal{signals?.length !== 1 ? 's' : ''} ·
                {' '}{prohibited?.length ?? 0} prohibited inference{prohibited?.length !== 1 ? 's' : ''}
              </Text>
            )}
          </Stack>
          <Group gap="xs" wrap="nowrap">
            <Button
              size="xs"
              variant="light"
              onClick={() => setViewProfile(profile)}
            >
              View
            </Button>
            {isDraft && (
              <Button
                size="xs"
                color="green"
                leftSection={<IconCircleCheck size={14} />}
                loading={activating === key}
                onClick={() => handleActivate(profile.id, profile.version)}
              >
                Activate
              </Button>
            )}
            {isDraft && (
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    title="Delete draft"
                    loading={deletingProfileKey === key}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Confirm deletion</Menu.Label>
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => handleDeleteDraft(profile)}
                  >
                    Delete &ldquo;{profile.category_name} v{profile.version}&rdquo;
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      </Paper>
    );
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Category Intelligence Profiles amplify business audits with category-specific evidence rules
          and guide intelligence-scope discovery runs.
        </Text>
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconRefresh size={14} />}
          onClick={fetchProfiles}
          loading={loading}
        >
          Refresh
        </Button>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Group justify="center" py={40}>
          <Loader size="sm" />
        </Group>
      ) : (
        <>
          {/* Draft Profiles */}
          <div>
            <Group gap="xs" mb="xs">
              <IconBrain size={18} />
              <Text size="sm" fw={600}>Draft Profiles</Text>
              <Badge size="sm" variant="light" color="orange">{draftProfiles.length}</Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Drafts are inert — they don&apos;t affect any prompts until explicitly activated.
              Activating a draft retires the previously active version for the same category
              <strong> and focus type</strong>.
            </Text>
            {draftProfiles.length === 0 ? (
              <Paper withBorder p="lg" radius="md" style={{ textAlign: 'center' }}>
                <Text size="xs" c="dimmed">No draft profiles awaiting activation.</Text>
              </Paper>
            ) : (
              draftProfiles.map((p) => renderProfileCard(p, true))
            )}
          </div>

          <Divider />

          {/* Active Profiles */}
          <div>
            <Group gap="xs" mb="xs">
              <IconCheck size={18} />
              <Text size="sm" fw={600}>Active Profiles</Text>
              <Badge size="sm" variant="light" color="green">{activeProfiles.length}</Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Active profiles are used by resolvePrompt() for business-scope §1B amplification
              and by PromptComposerService for intelligence-scope discovery runs. Each category
              can have one active Emerging and one active Competitive profile — discovery
              campaigns auto-align to the profile matching their focus.
            </Text>
            {activeProfiles.length === 0 ? (
              <Paper withBorder p="lg" radius="md" style={{ textAlign: 'center' }}>
                <Text size="xs" c="dimmed">No active profiles.</Text>
              </Paper>
            ) : (
              activeProfiles.map((p) => renderProfileCard(p, false))
            )}
          </div>

          <Divider />

          {/* Non-Business Campaigns — aggregate-scope campaigns (category,
              city, intelligence) that don't move through the sales pipeline.
              Managed here with edit/delete since they're excluded from the
              campaigns Kanban (which is business-scope only). */}
          <div>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconListCheck size={18} />
                <Text size="sm" fw={600}>Non-Business Campaigns</Text>
                <Badge size="sm" variant="light" color="gray">{filteredNonBusinessCampaigns.length}</Badge>
              </Group>
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={fetchNonBusinessCampaigns}
                loading={nbLoading}
              >
                Refresh
              </Button>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Aggregate-scope campaigns (category, city, intelligence) don&apos;t move through the
              sales pipeline. Use this table to edit or delete them. Business-scope campaigns
              are tracked on the{' '}
              <Link href="/settings/admin/marketing-ops/campaigns" style={{ color: 'var(--mantine-color-blue-6)' }}>
                Campaigns Kanban
              </Link>.
            </Text>

            {nbError && (
              <Alert color="red" icon={<IconAlertCircle size={16} />} mb="sm">
                {nbError}
              </Alert>
            )}

            {/* Filters */}
            <Group gap="xs" mb="sm" grow>
              <TextInput
                placeholder="Search title, category, city…"
                value={nbSearch}
                onChange={(e) => setNbSearch(e.target.value)}
                leftSection={<IconSearch size={14} />}
                size="xs"
              />
              <Select
                placeholder="All scopes"
                value={nbScopeFilter || ''}
                onChange={(v) => setNbScopeFilter((v as CampaignScope | '') || '')}
                data={[
                  { value: 'category', label: 'Category' },
                  { value: 'city', label: 'City' },
                  { value: 'intelligence', label: 'Intelligence' },
                ]}
                clearable
                size="xs"
              />
              <Select
                placeholder="All categories"
                value={nbCategoryFilter || ''}
                onChange={(v) => setNbCategoryFilter(v || '')}
                data={nbCategoryOptions.map((c) => ({ value: c, label: c }))}
                clearable
                searchable
                size="xs"
              />
              <Select
                placeholder="All cities"
                value={nbCityFilter || ''}
                onChange={(v) => setNbCityFilter(v || '')}
                data={nbCityOptions.map((c) => ({ value: c, label: c }))}
                clearable
                searchable
                size="xs"
              />
            </Group>

            {nbLoading ? (
              <Group justify="center" py={20}>
                <Loader size="sm" />
              </Group>
            ) : filteredNonBusinessCampaigns.length === 0 ? (
              <Paper withBorder p="lg" radius="md" style={{ textAlign: 'center' }}>
                <Text size="xs" c="dimmed">
                  {nonBusinessCampaigns.length === 0
                    ? 'No non-business campaigns found.'
                    : 'No campaigns match the current filters.'}
                </Text>
              </Paper>
            ) : (
              <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                <Table striped highlightOnHover horizontalSpacing="sm" verticalSpacing="xs" style={{ fontSize: 'var(--mantine-font-size-xs)' }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Title</Table.Th>
                      <Table.Th>Scope</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>City</Table.Th>
                      <Table.Th>Stage</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredNonBusinessCampaigns.map((c) => {
                      const label = c.title || c.business_name || c.category || c.city || c.id;
                      return (
                        <Table.Tr key={c.id}>
                          <Table.Td>
                            <Group gap="xs" wrap="nowrap">
                              <Text size="xs" fw={500} lineClamp={1}>{label}</Text>
                              {c.display_id && (
                                <Text size="10px" c="dimmed" ff="monospace">{c.display_id}</Text>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="gray">{c.scope}</Badge>
                          </Table.Td>
                          <Table.Td>{c.category || '—'}</Table.Td>
                          <Table.Td>{c.city || '—'}{c.neighborhood ? ` (${c.neighborhood})` : ''}</Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="blue">
                              {STAGE_LABELS[c.stage] ?? c.stage}
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Group gap="xs" justify="flex-end" wrap="nowrap">
                              <ActionIcon
                                component={Link}
                                href={`/settings/admin/marketing-ops/campaigns/${c.id}`}
                                variant="light"
                                color="blue"
                                size="sm"
                                title="Open campaign"
                              >
                                <IconExternalLink size={14} />
                              </ActionIcon>
                              <ActionIcon
                                component={Link}
                                href={`/settings/admin/marketing-ops/campaigns/${c.id}`}
                                variant="light"
                                color="gray"
                                size="sm"
                                title="Edit campaign"
                              >
                                <IconEdit size={14} />
                              </ActionIcon>
                              <Menu position="bottom-end" withinPortal>
                                <Menu.Target>
                                  <ActionIcon
                                    variant="light"
                                    color="red"
                                    size="sm"
                                    title="Delete campaign"
                                    loading={deletingCampaignId === c.id}
                                  >
                                    <IconTrash size={14} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Label>Confirm deletion</Menu.Label>
                                  <Menu.Item
                                    color="red"
                                    leftSection={<IconTrash size={14} />}
                                    onClick={() => handleDeleteCampaign(c.id, label)}
                                  >
                                    Delete &ldquo;{label}&rdquo;
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}
          </div>

          <Divider />

          {/* Next Steps */}
          <div>
            <Group gap="xs" mb="xs">
              <IconArrowRight size={18} />
              <Text size="sm" fw={600}>Next Steps</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              With {activeProfiles.length} active profile{activeProfiles.length !== 1 ? 's' : ''},
              intelligence-scope discovery runs will use profile mode instead of generic fallback.
              Business-scope Seek audits in these categories will resolve profile-amplified prompts (§1B).
            </Text>
            <Group gap="sm" grow align="flex-start">
              <Paper
                component={Link}
                href="/settings/admin/marketing-ops/campaigns"
                shadow="xs"
                radius="md"
                withBorder
                p="md"
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <Group gap="xs" mb={4}>
                  <IconTarget size={16} />
                  <Text size="sm" fw={600}>Open Campaigns</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  Find an intelligence-scope campaign for an activated category, then open its Prompts tab
                  to run Emerging or Competitive discovery.
                </Text>
              </Paper>
              <Paper
                component={Link}
                href="/settings/admin/marketing-ops/prompts"
                shadow="xs"
                radius="md"
                withBorder
                p="md"
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <Group gap="xs" mb={4}>
                  <IconMessage size={16} />
                  <Text size="sm" fw={600}>Prompts Library</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  Open the Seek: Intelligence Discovery (Emerging or Competitive) workspace, render the
                  composed prompt, and run it in external AI.
                </Text>
              </Paper>
              <Paper
                component={Link}
                href="/settings/admin/marketing-ops/queue"
                shadow="xs"
                radius="md"
                withBorder
                p="md"
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <Group gap="xs" mb={4}>
                  <IconListCheck size={16} />
                  <Text size="sm" fw={600}>Prospect Queue</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  Review qualifying businesses routed from intelligence discovery runs. Triage into
                  Business Seek campaigns for full audits.
                </Text>
              </Paper>
            </Group>
          </div>
        </>
      )}

      {/* View Profile Modal */}
      <Modal
        opened={!!viewProfile}
        onClose={() => setViewProfile(null)}
        title={viewProfile ? `${viewProfile.category_name} v${viewProfile.version} — ${FOCUS_LABELS[viewProfile.intelligence_focus]}` : ''}
        size="xl"
        styles={{ body: { maxHeight: '70vh' } }}
      >
        {viewProfile && (
          <Stack gap="sm">
            <Group gap="xs">
              <Badge size="sm" variant="light" color={STATUS_COLORS[viewProfile.status]}>
                {STATUS_LABELS[viewProfile.status]}
              </Badge>
              <Badge size="sm" variant="dot" color={FOCUS_COLORS[viewProfile.intelligence_focus]}>
                {FOCUS_LABELS[viewProfile.intelligence_focus]}
              </Badge>
              <Text size="xs" c="dimmed" ff="monospace">{viewProfile.id}</Text>
            </Group>
            <ScrollArea h={400} type="auto">
              <Code block style={{ fontSize: 11 }}>
                {JSON.stringify(viewProfile.configuration_json, null, 2)}
              </Code>
            </ScrollArea>
          </Stack>
        )}
      </Modal>

      {/* Publish Modal */}
      <Modal
        opened={publishOpen}
        onClose={() => { setPublishOpen(false); setPublishId(null); setPublishConfig(''); }}
        title="Publish New Profile Version"
        size="lg"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Paste the full profile JSON to publish a new active version. The previous active version
            will be retired automatically.
          </Text>
          <Textarea
            placeholder='{"category_key": "...", "category_name": "...", ...}'
            minRows={10}
            value={publishConfig}
            onChange={(e) => setPublishConfig(e.target.value)}
            ff="monospace"
            styles={{ input: { fontSize: 11 } }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => { setPublishOpen(false); setPublishId(null); setPublishConfig(''); }}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={!publishConfig.trim()}>
              Publish
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
