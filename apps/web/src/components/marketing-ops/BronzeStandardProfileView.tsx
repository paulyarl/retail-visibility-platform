'use client';

import { useEffect, useState } from 'react';
import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBulb,
  IconCheck,
  IconDatabase,
  IconExternalLink,
  IconInfoCircle,
  IconListCheck,
  IconMapPin,
  IconPlus,
  IconSparkles,
  IconTarget,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import marketingOpsService, {
  type BronzeReasonInput,
  type IntelligenceProfile,
} from '@/services/MarketingOpsService';
import { profileScopeLabel } from '@/lib/intelligence-profile-scope';
import {
  BRONZE_COVERAGE_STATUS_META,
  BRONZE_DIGITAL_QUALITY_META,
  BRONZE_DISCOVERED_BY_LABELS,
  BRONZE_OPERATIONAL_STATUS_META,
  BRONZE_PLATFORM_LABELS,
  BRONZE_PRESENCE_META,
  BRONZE_SCOPE_MIX_LABELS,
  bronzePlatformLabel,
  bronzeProfileConfig,
  bronzeScopeLabel,
  slugifyReasonKey,
  type BronzeCatalogSnapshotRow,
  type BronzeCoverageStatus,
  type BronzeDiscoveredBy,
  type BronzeDigitalQuality,
  type BronzeOperationalStatus,
  type BronzeSlot,
  type BronzeSuggestedReason,
} from '@/lib/bronze-standard-profile';

// ─── Helpers ─────────────────────────────────────────────────────────────

function coverageMeta(status: BronzeCoverageStatus) {
  return BRONZE_COVERAGE_STATUS_META[status] ?? { label: status, color: 'gray', description: '' };
}

function presenceMeta(state: string) {
  return BRONZE_PRESENCE_META[state] ?? { label: state, color: 'gray' };
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <Group gap="xs">
      {icon}
      <Text size="sm" fw={600}>
        {title}
        {count != null && <Text component="span" size="xs" c="dimmed" ml={6}>({count})</Text>}
      </Text>
    </Group>
  );
}

function EvidenceLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <Stack gap={2}>
      <Text size="xs" fw={600}>{label}</Text>
      <Text size="xs" c="dimmed">{value}</Text>
    </Stack>
  );
}

// ─── Slot ────────────────────────────────────────────────────────────────

function SlotCard({ slot }: { slot: BronzeSlot }) {
  const presence = Object.entries(slot.platform_presence ?? {});
  const quality = slot.digital_quality ? BRONZE_DIGITAL_QUALITY_META[slot.digital_quality as BronzeDigitalQuality] : null;
  const operational = slot.operational_status
    ? BRONZE_OPERATIONAL_STATUS_META[slot.operational_status as BronzeOperationalStatus]
    : null;
  const discoveredBy = slot.discovered_by
    ? BRONZE_DISCOVERED_BY_LABELS[slot.discovered_by as BronzeDiscoveredBy] ?? slot.discovered_by
    : null;

  return (
    <Paper withBorder radius="sm" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
      <Stack gap="xs">
        <Group gap="xs" wrap="wrap">
          <Text size="sm" fw={600}>{slot.business_name}</Text>
          {quality && <Badge size="xs" variant="light" color={quality.color}>{quality.label}</Badge>}
          {operational && <Badge size="xs" variant="light" color={operational.color}>{operational.label}</Badge>}
          {slot.observed_platform && (
            <Badge size="xs" variant="dot" color="indigo">
              observed on {bronzePlatformLabel(slot.observed_platform)}
            </Badge>
          )}
        </Group>

        {slot.address && (
          <Group gap={4}>
            <IconMapPin size={12} />
            <Text size="xs" c="dimmed">{slot.address}</Text>
          </Group>
        )}

        <EvidenceLine label="Category fit (assortment evidence)" value={slot.category_fit_evidence} />
        <EvidenceLine label="Operational evidence" value={slot.operational_evidence} />

        {presence.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={600}>Platform presence</Text>
            <Group gap={4} wrap="wrap">
              {presence.map(([platform, state]) => {
                const meta = presenceMeta(state);
                return (
                  <Badge key={platform} size="xs" variant="light" color={meta.color}>
                    {bronzePlatformLabel(platform)}: {meta.label}
                  </Badge>
                );
              })}
            </Group>
          </Stack>
        )}

        <Group gap="lg" wrap="wrap">
          {discoveredBy && (
            <Group gap={4}>
              <Text size="xs" c="dimmed">Provenance:</Text>
              <Badge size="xs" variant="dot" color="gray">{discoveredBy}</Badge>
            </Group>
          )}
          {slot.discovered_via && (
            <Text size="xs" c="dimmed">via {slot.discovered_via}</Text>
          )}
        </Group>

        {slot.evidence_urls && slot.evidence_urls.length > 0 && (
          <Group gap="md" wrap="wrap">
            {slot.evidence_urls.map((url, i) => (
              <Anchor
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                size="xs"
                c="blue.6"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                title={url}
              >
                <IconExternalLink size={12} />
                {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </Anchor>
            ))}
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

// ─── Main component ──────────────────────────────────────────────────────

interface Props {
  profile: IntelligenceProfile;
}

/**
 * Operator-friendly structured view for bronze-standard intelligence profiles.
 *
 * Renders the bronze-standard scan output (reason coverage + slots, the
 * revision-stamped catalog snapshot, scope mix, vector execution log, empty
 * reasons, prohibited inferences) in a human-readable layout instead of a raw
 * JSON dump. A bronze profile's configuration_json is the
 * `bronze_standard_scan` shape (spec: docs/LocalBiz/BRONZE_STANDARD_SPEC.md
 * §4), which CategoryProfileView cannot render — used by the Intelligence
 * Profiles page's View modal and the establishment panel's active-profile
 * detail.
 */
export default function BronzeStandardProfileView({ profile }: Props) {
  const config = bronzeProfileConfig(profile);
  const coverage = config.reason_coverage ?? [];
  const snapshot = config.catalog_snapshot ?? [];
  const vectors = config.vector_execution_log ?? [];
  const prohibited = config.prohibited_inferences ?? [];
  const notApplicable = config.not_applicable_reasons ?? [];
  const suggested = config.suggested_reasons ?? [];
  const scopeMix = config.scope_mix ?? {};

  const snapshotByKey = new Map<string, BronzeCatalogSnapshotRow>();
  for (const row of snapshot) snapshotByKey.set(row.reason_key, row);

  const filled = coverage.filter((c) => c.status === 'filled');
  const empty = coverage.filter((c) => c.status !== 'filled');
  const slotCount = coverage.reduce((n, c) => n + (c.slots?.length ?? 0), 0);
  const executedVectors = vectors.filter((v) => v.executed).length;
  const scope = profileScopeLabel(profile);

  // Authoring modal state for analyst-suggested reasons
  const [selectedSuggestion, setSelectedSuggestion] = useState<BronzeSuggestedReason | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [catalogKeys, setCatalogKeys] = useState<Set<string> | null>(null);

  // Catalog keys the profile itself already knows — coverage rows, out-of-scope
  // keys, and the embedded snapshot. Synchronous so the first paint reflects
  // scan-time collisions before the live catalog fetch lands.
  const knownCatalogKeys = new Set<string>([
    ...coverage.map((c) => c.reason_key),
    ...notApplicable,
    ...snapshot.map((r) => r.reason_key),
  ]);

  // Live catalog fetch — a suggestion may already have been authored after the
  // scan (from this view, the catalog admin page, or another profile), which is
  // the case the profile-embedded keys cannot see. includeDeprecated because a
  // retired key still conflicts (keys are never reused).
  useEffect(() => {
    if (suggested.length === 0) return;
    let cancelled = false;
    marketingOpsService
      .listBronzeReasons({ includeDeprecated: true })
      .then((res) => {
        if (!cancelled) setCatalogKeys(new Set(res.reasons.map((r) => r.reason_key)));
      })
      .catch(() => {
        // Best-effort — knownCatalogKeys and the POST's 409 are the backstops.
      });
    return () => {
      cancelled = true;
    };
  }, [profile.id, suggested.length]);

  const [authorForm, setAuthorForm] = useState({
    reason_key: '',
    label: '',
    definition: '',
    signals: '',
    expected_vectors: '',
    priority: 3,
    scope_mode: 'category_family' as 'universal' | 'category' | 'category_family' | 'location',
    scope_category_key: '',
    scope_city: '',
    scope_state: '',
    scope_platform: '' as string,
  });

  const handleOpenAddModal = (s: BronzeSuggestedReason) => {
    const defaultKey = s.reason_key || slugifyReasonKey(s.proposed_label);
    const isFamily = Boolean(s.category_family_applicable);
    const initialScopeMode: 'universal' | 'category' | 'category_family' | 'location' = isFamily
      ? 'category_family'
      : s.scope_level === 'universal'
      ? 'universal'
      : s.scope_level === 'location'
      ? 'location'
      : 'category';

    const defaultCategoryKey = isFamily
      ? (s.suggested_category_scope || 'grocery')
      : (s.suggested_category_scope || config.category_key || profile.category_key || '');

    setAuthorForm({
      reason_key: defaultKey,
      label: s.proposed_label,
      definition: s.proposed_definition,
      signals: (s.observed_signals ?? []).join('\n'),
      expected_vectors: (s.expected_vectors ?? []).join('\n'),
      priority: 3,
      scope_mode: initialScopeMode,
      scope_category_key: initialScopeMode === 'universal' ? '' : defaultCategoryKey,
      scope_city: initialScopeMode === 'location' ? (config.reference_city || profile.reference_city || '') : '',
      scope_state: initialScopeMode === 'location' ? (config.reference_state || profile.reference_state || '') : '',
      scope_platform: s.suggested_scope_platform || '',
    });
    setSelectedSuggestion(s);
    setModalError(null);
    setModalOpen(true);
  };

  const handleSaveReason = async () => {
    const key = authorForm.reason_key.trim();
    if (!key) {
      setModalError('Reason key is required');
      return;
    }
    if (!/^[a-z][a-z0-9_]{1,79}$/.test(key)) {
      setModalError('Reason key must be lowercase snake_case (2-80 chars, starting with a letter)');
      return;
    }
    if (!authorForm.label.trim()) {
      setModalError('Label is required');
      return;
    }
    if (!authorForm.definition.trim()) {
      setModalError('Definition is required');
      return;
    }
    if (knownCatalogKeys.has(key) || (catalogKeys?.has(key) ?? false)) {
      setModalError(`reason_key "${key}" already exists in the catalog — keys are immutable and never reused`);
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      const isUniversal = authorForm.scope_mode === 'universal';
      const isLocation = authorForm.scope_mode === 'location';

      const input: BronzeReasonInput = {
        label: authorForm.label.trim(),
        definition: authorForm.definition.trim(),
        signals: authorForm.signals.split('\n').map((l) => l.trim()).filter(Boolean),
        expected_vectors: authorForm.expected_vectors.split('\n').map((l) => l.trim()).filter(Boolean),
        priority: Number(authorForm.priority) || 3,
        scope_category_key: isUniversal ? null : (authorForm.scope_category_key.trim() || null),
        scope_city: isLocation ? (authorForm.scope_city.trim() || null) : null,
        scope_state: isLocation ? (authorForm.scope_state.trim() || null) : null,
        scope_platform: (authorForm.scope_platform.trim() as any) || null,
      };

      const created = await marketingOpsService.createBronzeReason(key, input);
      setAddedKeys((prev) => new Set([...prev, key]));
      setModalOpen(false);

      notifications.show({
        title: 'Added to Bronze Reason Catalog',
        message: `Reason "${created?.label || key}" added to catalog (revision r${created?.introduced_in_revision ?? 'new'}). Future scans will evaluate this discovery mechanic.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      setModalError(err.message || 'Failed to add reason to catalog');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="md">
      {/* ─── Scan Overview ─── */}
      <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--mantine-color-orange-0)' }}>
        <Stack gap="sm">
          <Group gap="xs">
            <IconTarget size={18} />
            <Text size="sm" fw={700}>Bronze Standard Profile — {config.category_name || profile.category_name}</Text>
            <Badge size="sm" variant="dot" color={scope.color}>{scope.label}</Badge>
          </Group>
          <Group gap="lg" wrap="wrap">
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Geographic Scope</Text>
              <Text size="sm" fw={500}>{scope.label}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Platform Scope</Text>
              <Text size="sm" fw={500}>
                {bronzePlatformLabel(profile.reference_platform || config.reference_platform || 'all')}
              </Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Catalog Revision</Text>
              <Text size="sm" fw={500}>
                {typeof config.catalog_revision === 'number' ? `r${config.catalog_revision}` : '—'}
              </Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Reasons Filled</Text>
              <Text size="sm" fw={500}>{filled.length} / {coverage.length}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Exemplar Slots</Text>
              <Text size="sm" fw={500}>{slotCount}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Vectors Executed</Text>
              <Text size="sm" fw={500}>{executedVectors} / {vectors.length}</Text>
            </Stack>
            {suggested.length > 0 && (
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Suggested Blind Spots</Text>
                <Text size="sm" fw={600} c="blue.7">{suggested.length}</Text>
              </Stack>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            A slot is a floor, not a ranking — the lowest digital quality that still qualifies as a real,
            operating physical retail business with walk-in customer shelves. Non-storefront, virtual, or
            delivery-only entities are disqualified. Slots calibrate discovery; they are not prospect verdicts
            or competitive benchmarks.
          </Text>
        </Stack>
      </Paper>

      <ScrollArea h={600} type="auto" offsetScrollbars>
        <Stack gap="md" pr={8}>
          {/* ─── Scope mix ─── */}
          {BRONZE_SCOPE_MIX_LABELS.some(({ key }) => typeof scopeMix[key] === 'number') && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <SectionHeader icon={<IconInfoCircle size={16} />} title="Scope Mix" />
                <Text size="xs" c="dimmed">
                  The profile&apos;s applicable reasons by scope level — makes the portable/locale ratio visible.
                  Universal reasons travel between markets; location-scoped ones do not.
                </Text>
                <Group gap={4} wrap="wrap">
                  {BRONZE_SCOPE_MIX_LABELS.map(({ key, label }) => (
                    <Badge
                      key={key}
                      size="sm"
                      variant={scopeMix[key] ? 'light' : 'dot'}
                      color={scopeMix[key] ? 'blue' : 'gray'}
                    >
                      {label} {scopeMix[key] ?? 0}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Paper>
          )}

          {/* ─── Reason coverage ─── */}
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <SectionHeader icon={<IconListCheck size={16} />} title="Reason Coverage" count={coverage.length} />
              <Text size="xs" c="dimmed">
                One entry per applicable catalog reason. <strong>filled</strong> — a qualifying exemplar was
                found in this market; <strong>empty_unproven</strong> — none here and none ever found at any
                evaluable scope; <strong>empty_proven_elsewhere</strong> — none here, but proven at national
                scope or another market. Reasons that fail the scope predicate are not evaluable here and
                appear under Not Applicable instead.
              </Text>
              {coverage.length === 0 ? (
                <Alert color="gray" icon={<IconInfoCircle size={16} />}>
                  No reason coverage entries in this configuration.
                </Alert>
              ) : (
                <Accordion multiple defaultValue={filled.map((c) => c.reason_key)} variant="separated" chevronPosition="right">
                  {coverage.map((entry) => {
                    const meta = coverageMeta(entry.status);
                    const row = snapshotByKey.get(entry.reason_key);
                    const slots = entry.slots ?? [];
                    return (
                      <Accordion.Item key={entry.reason_key} value={entry.reason_key}>
                        <Accordion.Control>
                          <Group gap="xs" wrap="wrap">
                            <Text size="sm" fw={600} ff="monospace">{entry.reason_key}</Text>
                            <Badge size="xs" variant="light" color={meta.color}>{meta.label}</Badge>
                            {slots.length > 0 && (
                              <Badge size="xs" variant="dot" color="gray">
                                {slots.length} slot{slots.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                            {typeof row?.priority === 'number' && (
                              <Badge size="xs" variant="dot" color="gray">Priority {row.priority}</Badge>
                            )}
                            {row?.label && <Text size="xs" c="dimmed">{row.label}</Text>}
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap="sm">
                            {meta.description && (
                              <Text size="xs" c="dimmed" fs="italic">{meta.description}</Text>
                            )}
                            {row?.definition && (
                              <Text size="xs" c="gray.7">{row.definition}</Text>
                            )}
                            {row?.signals && row.signals.length > 0 && (
                              <Stack gap={4}>
                                <Group gap={4}>
                                  <IconBulb size={14} />
                                  <Text size="xs" fw={600}>Signals</Text>
                                </Group>
                                <Group gap={4} wrap="wrap">
                                  {row.signals.map((s, i) => (
                                    <Badge key={i} size="xs" variant="light" color="violet">{s}</Badge>
                                  ))}
                                </Group>
                              </Stack>
                            )}
                            {row?.expected_vectors && row.expected_vectors.length > 0 && (
                              <Stack gap={4}>
                                <Text size="xs" fw={600}>Expected vectors</Text>
                                <Group gap={4} wrap="wrap">
                                  {row.expected_vectors.map((v, i) => (
                                    <Badge key={i} size="xs" variant="light" color="indigo">{v}</Badge>
                                  ))}
                                </Group>
                              </Stack>
                            )}
                            {slots.length > 0 ? (
                              <Stack gap="sm">
                                {slots.map((slot, i) => <SlotCard key={i} slot={slot} />)}
                              </Stack>
                            ) : (
                              <Alert color={meta.color} icon={<IconInfoCircle size={16} />}>
                                {entry.empty_slot_note || 'No exemplar recorded for this reason.'}
                              </Alert>
                            )}
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              )}
              {empty.length > 0 && (
                <Text size="xs" c="dimmed">
                  An empty slot never means no such business exists — it means the vectors executed did not
                  reach one, or were not executed.
                </Text>
              )}
            </Stack>
          </Paper>

          {/* ─── Suggested Discovery Blind Spots ─── */}
          {suggested.length > 0 && (
            <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--mantine-color-blue-0)', borderColor: 'var(--mantine-color-blue-3)' }}>
              <Stack gap="sm">
                <Group justify="space-between" wrap="wrap">
                  <SectionHeader icon={<IconSparkles size={16} color="var(--mantine-color-blue-6)" />} title="Suggested Discovery Blind Spots" count={suggested.length} />
                  <Badge size="xs" variant="light" color="blue">Analyst Feedback</Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Novel discovery mechanics detected during the scan that do not match existing catalog reasons.
                  Operators can review and author them into the bronze catalog, choosing whether to scope them
                  to this category, generalize to a category family (niche), or promote to universal.
                </Text>
                <Stack gap="xs">
                  {suggested.map((s, idx) => {
                    const key = s.reason_key || slugifyReasonKey(s.proposed_label);
                    const isAdded = addedKeys.has(key);
                    const existsInCatalog = !isAdded && (knownCatalogKeys.has(key) || (catalogKeys?.has(key) ?? false));
                    const isFamily = Boolean(s.category_family_applicable);
                    return (
                      <Paper key={idx} withBorder radius="sm" p="sm" bg="white">
                        <Stack gap="xs">
                          <Group justify="space-between" align="flex-start" wrap="wrap">
                            <Stack gap={2}>
                              <Group gap="xs" wrap="wrap">
                                <Text size="sm" fw={600}>{s.proposed_label}</Text>
                                {s.reason_key && <Text size="xs" c="dimmed" ff="monospace">({s.reason_key})</Text>}
                                {isFamily ? (
                                  <Badge size="xs" variant="light" color="teal">
                                    Category Family: {s.suggested_category_scope || 'niche'}
                                  </Badge>
                                ) : s.scope_level === 'universal' ? (
                                  <Badge size="xs" variant="light" color="blue">Universal Candidate</Badge>
                                ) : (
                                  <Badge size="xs" variant="light" color="violet">
                                    Category: {s.suggested_category_scope || config.category_key || profile.category_key || 'specific'}
                                  </Badge>
                                )}
                                {s.suggested_scope_platform && (
                                  <Badge size="xs" variant="dot" color="indigo">
                                    @{bronzePlatformLabel(s.suggested_scope_platform)}
                                  </Badge>
                                )}
                              </Group>
                            </Stack>
                            <Button
                              size="xs"
                              variant={isAdded ? 'light' : existsInCatalog ? 'outline' : 'filled'}
                              color={isAdded ? 'green' : existsInCatalog ? 'gray' : 'blue'}
                              leftSection={isAdded || existsInCatalog ? <IconCheck size={14} /> : <IconPlus size={14} />}
                              disabled={isAdded || existsInCatalog}
                              onClick={() => handleOpenAddModal(s)}
                            >
                              {isAdded ? 'Added to Catalog' : existsInCatalog ? 'Already in Catalog' : 'Add to Catalog'}
                            </Button>
                          </Group>

                          <Text size="xs" c="gray.7">{s.proposed_definition}</Text>

                          {s.observed_signals && s.observed_signals.length > 0 && (
                            <Stack gap={2}>
                              <Text size="xs" fw={600}>Observed signals</Text>
                              <Group gap={4} wrap="wrap">
                                {s.observed_signals.map((sig, i) => (
                                  <Badge key={i} size="xs" variant="light" color="violet">{sig}</Badge>
                                ))}
                              </Group>
                            </Stack>
                          )}

                          {s.expected_vectors && s.expected_vectors.length > 0 && (
                            <Stack gap={2}>
                              <Text size="xs" fw={600}>Expected vectors</Text>
                              <Group gap={4} wrap="wrap">
                                {s.expected_vectors.map((vec, i) => (
                                  <Badge key={i} size="xs" variant="light" color="indigo">{vec}</Badge>
                                ))}
                              </Group>
                            </Stack>
                          )}

                          {s.exemplar_lead && (
                            <Paper withBorder radius="xs" p="xs" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                              <Stack gap={2}>
                                <Group gap="xs">
                                  <Text size="xs" fw={600}>Exemplar Lead:</Text>
                                  <Text size="xs" fw={600} c="blue.7">{s.exemplar_lead.business_name}</Text>
                                  {s.exemplar_lead.observed_platform && (
                                    <Badge size="xs" variant="outline" color="gray">
                                      {bronzePlatformLabel(s.exemplar_lead.observed_platform)}
                                    </Badge>
                                  )}
                                </Group>
                                {s.exemplar_lead.address && (
                                  <Text size="xs" c="dimmed">Address: {s.exemplar_lead.address}</Text>
                                )}
                                {s.exemplar_lead.discovery_vector && (
                                  <Text size="xs" c="dimmed">Vector: {s.exemplar_lead.discovery_vector}</Text>
                                )}
                                {s.exemplar_lead.notes && (
                                  <Text size="xs" c="dimmed">Notes: {s.exemplar_lead.notes}</Text>
                                )}
                              </Stack>
                            </Paper>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* ─── Not applicable reasons ─── */}
          {notApplicable.length > 0 && (
            <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--mantine-color-yellow-0)' }}>
              <Stack gap="sm">
                <SectionHeader icon={<IconInfoCircle size={16} />} title="Not Applicable Reasons" count={notApplicable.length} />
                <Text size="xs" c="dimmed">
                  Reasons that failed the scope predicate — not evaluable in this market. Listed by key so
                  omission is never mistaken for a gap.
                </Text>
                <Group gap={4} wrap="wrap">
                  {notApplicable.map((key) => (
                    <Badge key={key} size="xs" variant="light" color="gray" ff="monospace">{key}</Badge>
                  ))}
                </Group>
              </Stack>
            </Paper>
          )}

          {/* ─── Vector execution log ─── */}
          {vectors.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <SectionHeader icon={<IconListCheck size={16} />} title="Vector Execution Log" count={vectors.length} />
                <Text size="xs" c="dimmed">
                  Every vector attempt — executed vs returned are recorded separately. An unexecuted vector
                  is an admitted blind spot, never a silent gap.
                </Text>
                <Table striped highlightOnHover style={{ tableLayout: 'fixed', fontSize: 'var(--mantine-font-size-xs)' }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Vector</Table.Th>
                      <Table.Th style={{ width: 120 }}>Executed</Table.Th>
                      <Table.Th style={{ width: 90 }}>Returned</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {vectors.map((v, i) => (
                      <Table.Tr key={i}>
                        <Table.Td><Text size="xs" fw={500}>{v.vector}</Text></Table.Td>
                        <Table.Td>
                          {v.executed ? (
                            <Badge size="xs" variant="light" color="green">executed</Badge>
                          ) : (
                            <Badge size="xs" variant="light" color="red">not executed</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {v.returned != null
                            ? <Text size="xs">{v.returned}</Text>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Paper>
          )}

          {/* ─── Catalog snapshot (stage-1 national profiles embed this) ─── */}
          {snapshot.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <SectionHeader icon={<IconDatabase size={16} />} title="Catalog Snapshot" count={snapshot.length} />
                <Text size="xs" c="dimmed">
                  The scope-applicable catalog rows embedded verbatim at scan time
                  {typeof config.catalog_revision === 'number' ? ` (revision r${config.catalog_revision})` : ''} —
                  keeps the profile interpretable after the catalog moves on.
                </Text>
                <Table striped highlightOnHover style={{ tableLayout: 'fixed', fontSize: 'var(--mantine-font-size-xs)' }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Reason</Table.Th>
                      <Table.Th style={{ width: 70 }}>Priority</Table.Th>
                      <Table.Th style={{ width: 170 }}>Scope</Table.Th>
                      <Table.Th style={{ width: 90 }}>Provenance</Table.Th>
                      <Table.Th style={{ width: 90 }}>Vectors</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {snapshot.map((row) => (
                      <Table.Tr key={row.reason_key}>
                        <Table.Td>
                          <Stack gap={0}>
                            <Text size="xs" fw={600} ff="monospace">{row.reason_key}</Text>
                            {row.label && <Text size="xs">{row.label}</Text>}
                            {row.definition && (
                              <Tooltip label={row.definition} position="top-start" multiline w={420}>
                                <Text size="xs" c="dimmed" lineClamp={2}>{row.definition}</Text>
                              </Tooltip>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light">{row.priority ?? '—'}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" ff="monospace">{bronzeScopeLabel(row)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="dot" color={row.provenance === 'operator_authored' ? 'violet' : 'blue'}>
                            {row.provenance === 'operator_authored' ? 'operator' : 'derived'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {row.expected_vectors && row.expected_vectors.length > 0 ? (
                            <Tooltip
                              label={row.expected_vectors.join(' · ')}
                              position="top-start"
                              multiline
                              w={400}
                            >
                              <Text size="xs">{row.expected_vectors.length}</Text>
                            </Tooltip>
                          ) : (
                            <Text size="xs" c="dimmed">—</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Paper>
          )}

          {/* ─── Prohibited inferences ─── */}
          {prohibited.length > 0 && (
            <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--mantine-color-red-0)' }}>
              <Stack gap="sm">
                <SectionHeader icon={<IconAlertTriangle size={16} />} title="Prohibited Inferences" count={prohibited.length} />
                <Stack gap={4}>
                  {prohibited.map((inf, i) => (
                    <Group key={i} gap="xs" align="flex-start" wrap="nowrap">
                      <IconAlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--mantine-color-red-6)' }} />
                      <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>{inf}</Text>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          <Divider />

          <Box>
            <Text size="xs" c="dimmed" ta="center">
              Profile {profile.id} v{profile.version} · {scope.label}
              {profile.reference_platform ? ` · ${BRONZE_PLATFORM_LABELS[profile.reference_platform] ?? profile.reference_platform}` : ''}
            </Text>
          </Box>
        </Stack>
      </ScrollArea>

      {/* ─── Add Reason to Catalog Modal ─── */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <Group gap="xs">
            <IconPlus size={16} />
            <Text fw={600} size="sm">Add Suggested Reason to Catalog</Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          {modalError && (
            <Alert color="red" icon={<IconAlertTriangle size={16} />}>
              {modalError}
            </Alert>
          )}

          <Text size="xs" c="dimmed">
            Author this analyst-suggested blind spot into the authoritative Bronze Reason Catalog for physical retail businesses.
            Choose the appropriate scope level: generalize to a broader niche/family (e.g. &apos;grocery&apos;),
            keep it category-specific, or promote to universal.
          </Text>

          <TextInput
            label="Reason Key"
            description="Immutable snake_case identifier (lowercase letters, numbers, underscores)"
            placeholder="e.g. ethnic_community_classifieds_only"
            value={authorForm.reason_key}
            onChange={(e) => setAuthorForm((prev) => ({ ...prev, reason_key: e.currentTarget.value }))}
            required
            ff="monospace"
          />

          <TextInput
            label="Label"
            description="Human-readable short name"
            placeholder="e.g. Exclusively visible on community-specific classifieds"
            value={authorForm.label}
            onChange={(e) => setAuthorForm((prev) => ({ ...prev, label: e.currentTarget.value }))}
            required
          />

          <Textarea
            label="Definition"
            description="Why this blind spot hides businesses and how discovery fails"
            placeholder="Explain the discovery mechanics..."
            rows={3}
            value={authorForm.definition}
            onChange={(e) => setAuthorForm((prev) => ({ ...prev, definition: e.currentTarget.value }))}
            required
          />

          <Stack gap={4}>
            <Text size="xs" fw={500}>Scope Level</Text>
            <SegmentedControl
              size="xs"
              value={authorForm.scope_mode}
              onChange={(val) => {
                const mode = val as typeof authorForm.scope_mode;
                let newCat = authorForm.scope_category_key;
                if (mode === 'universal') newCat = '';
                else if (mode === 'category_family') {
                  newCat = selectedSuggestion?.suggested_category_scope || 'grocery';
                } else if (mode === 'category') {
                  newCat = config.category_key || profile.category_key || '';
                }
                setAuthorForm((prev) => ({
                  ...prev,
                  scope_mode: mode,
                  scope_category_key: newCat,
                  scope_city: mode === 'location' ? (config.reference_city || profile.reference_city || '') : '',
                  scope_state: mode === 'location' ? (config.reference_state || profile.reference_state || '') : '',
                }));
              }}
              data={[
                { value: 'category_family', label: 'Category Family / Niche' },
                { value: 'category', label: 'Specific Category' },
                { value: 'universal', label: 'Universal' },
                { value: 'location', label: 'Market Specific' },
              ]}
            />
          </Stack>

          {authorForm.scope_mode !== 'universal' && (
            <TextInput
              label={authorForm.scope_mode === 'category_family' ? 'Category Family / Niche Key' : 'Category Key'}
              description={
                authorForm.scope_mode === 'category_family'
                  ? "Broaden to a category family (e.g. 'grocery', 'specialty retail', 'auto repair') to cover related sweeps."
                  : 'Applies only to this specific category.'
              }
              placeholder="e.g. grocery"
              value={authorForm.scope_category_key}
              onChange={(e) => setAuthorForm((prev) => ({ ...prev, scope_category_key: e.currentTarget.value }))}
            />
          )}

          {authorForm.scope_mode === 'location' && (
            <Group grow>
              <TextInput
                label="City"
                placeholder="e.g. Indianapolis"
                value={authorForm.scope_city}
                onChange={(e) => setAuthorForm((prev) => ({ ...prev, scope_city: e.currentTarget.value }))}
              />
              <TextInput
                label="State"
                placeholder="e.g. IN"
                maxLength={2}
                value={authorForm.scope_state}
                onChange={(e) => setAuthorForm((prev) => ({ ...prev, scope_state: e.currentTarget.value.toUpperCase() }))}
              />
            </Group>
          )}

          <Select
            label="Platform Scope"
            description="Leave cross-platform unless the discovery mechanic is bound to a single platform"
            data={[
              { value: '', label: 'Cross-platform (none)' },
              { value: 'google', label: 'Google' },
              { value: 'yelp', label: 'Yelp' },
              { value: 'facebook', label: 'Facebook' },
              { value: 'bbb', label: 'BBB' },
              { value: 'apple_maps', label: 'Apple Maps' },
              { value: 'bing', label: 'Bing' },
            ]}
            value={authorForm.scope_platform}
            onChange={(val) => setAuthorForm((prev) => ({ ...prev, scope_platform: val || '' }))}
            clearable
          />

          <Textarea
            label="Signals (one per line)"
            description="Searchable signal vocabulary an agent or analyst can pattern-match"
            rows={2}
            value={authorForm.signals}
            onChange={(e) => setAuthorForm((prev) => ({ ...prev, signals: e.currentTarget.value }))}
          />

          <Textarea
            label="Expected Vectors (one per line)"
            description="Discovery vectors / specialized sources that reach this blind spot"
            rows={2}
            value={authorForm.expected_vectors}
            onChange={(e) => setAuthorForm((prev) => ({ ...prev, expected_vectors: e.currentTarget.value }))}
          />

          <NumberInput
            label="Priority"
            description="1 (highest) to 5 (lowest) — orders slot-filling effort"
            min={1}
            max={5}
            value={authorForm.priority}
            onChange={(val) => setAuthorForm((prev) => ({ ...prev, priority: typeof val === 'number' ? val : 3 }))}
          />

          {selectedSuggestion?.exemplar_lead && (
            <Paper withBorder radius="sm" p="xs" bg="gray.0">
              <Text size="xs" fw={600} mb={2}>Observed Exemplar Lead from Scan:</Text>
              <Text size="xs"><strong>{selectedSuggestion.exemplar_lead.business_name}</strong></Text>
              {selectedSuggestion.exemplar_lead.notes && (
                <Text size="xs" c="dimmed">{selectedSuggestion.exemplar_lead.notes}</Text>
              )}
            </Paper>
          )}

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              color="blue"
              onClick={handleSaveReason}
              loading={submitting}
              leftSection={<IconCheck size={16} />}
            >
              Save to Catalog
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
