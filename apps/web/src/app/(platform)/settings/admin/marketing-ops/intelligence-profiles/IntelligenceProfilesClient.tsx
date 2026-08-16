'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from '@tabler/icons-react';
import Link from 'next/link';
import marketingOpsService from '@/services/MarketingOpsService';
import type { IntelligenceProfile, ProfileStatus, IntelligenceFocus } from '@/services/MarketingOpsService';

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
};

const FOCUS_LABELS: Record<IntelligenceFocus, string> = {
  emerging: 'Emerging',
  competitive: 'Competitive',
};

export default function IntelligenceProfilesClient() {
  const [activeProfiles, setActiveProfiles] = useState<IntelligenceProfile[]>([]);
  const [draftProfiles, setDraftProfiles] = useState<IntelligenceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [viewProfile, setViewProfile] = useState<IntelligenceProfile | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [publishConfig, setPublishConfig] = useState('');

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
