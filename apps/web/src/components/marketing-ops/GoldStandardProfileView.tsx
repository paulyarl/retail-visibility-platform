'use client';

import {
  Paper,
  Text,
  Group,
  Badge,
  Stack,
  Divider,
  ScrollArea,
  Box,
  Table,
  Accordion,
  Tooltip,
  Anchor,
  ThemeIcon,
} from '@mantine/core';
import {
  IconTarget,
  IconCheck,
  IconX,
  IconStar,
  IconMapPin,
  IconExternalLink,
  IconPhoto,
  IconShieldCheck,
  IconListDetails,
  IconInfoCircle,
} from '@tabler/icons-react';
import type { IntelligenceProfile } from '@/services/MarketingOpsService';
import { profileScopeLabel } from '@/lib/intelligence-profile-scope';

// ─── Types (mirror of gold-standard-scan.schema.ts output) ───────────────

interface QualityGate {
  field: string;
  description: string;
  severity?: 'non_negotiable' | 'recommended';
}

interface ExpectedField {
  field: string;
  description: string;
  severity?: 'non_negotiable' | 'recommended';
}

interface BrandingExpectations {
  has_logo?: boolean | null;
  has_cover_photo?: boolean | null;
  has_profile_photo?: boolean | null;
  photo_count?: number | null;
  photo_types?: string[];
  visual_assets?: string[];
}

interface PlatformExpectedFields {
  primary_category?: string | null;
  additional_categories?: string[];
  required_attributes?: string[];
  recommended_attributes?: string[];
  description_requirements?: string | null;
  page_type?: string | null;
  expected_photo_count?: number | null;
  branding_expectations?: BrandingExpectations;
  quality_gates?: QualityGate[];
  fields?: ExpectedField[];
}

interface UniversalExpectedFields {
  canonical_name?: string | null;
  canonical_address?: string | null;
  canonical_phone?: string | null;
  hours_present?: boolean | null;
  website_present?: boolean | null;
  quality_gates?: QualityGate[];
  fields?: ExpectedField[];
}

interface ExpectedFields {
  universal?: UniversalExpectedFields;
  platforms?: Record<string, PlatformExpectedFields>;
}

interface BrandingArtifacts {
  has_logo?: boolean | null;
  has_cover_photo?: boolean | null;
  has_profile_photo?: boolean | null;
  photo_count?: number | null;
  photo_types?: string[];
  visual_assets?: string[];
}

interface PlatformEvaluation {
  platform: string;
  profile_url?: string | null;
  quality_score?: number | null;
  quality_rationale?: string | null;
  is_gold_standard?: boolean | null;
  branding_artifacts?: BrandingArtifacts;
  platform_config?: Record<string, any>;
  quality_gates_passed?: string[];
  quality_gates_failed?: string[];
}

interface Candidate {
  business_name: string;
  city?: string;
  state?: string;
  nap?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
  };
  ownership_type?: 'independent' | 'small_group' | 'franchise' | 'chain' | null;
  location_count_estimate?: number | null;
  independence_rationale?: string | null;
  platform_evaluations?: PlatformEvaluation[];
  category_notes?: string | null;
}

interface ScanMetadata {
  scan_date?: string;
  sources_consulted?: string[];
  selection_criteria?: string | null;
  platforms_evaluated?: string[];
  expected_field_derivation?: string | null;
  platform_focus?: string;
  excluded_candidates?: Array<{ business_name: string; reason: string }>;
}

interface GoldStandardConfig {
  category_key?: string;
  category_name?: string;
  platform_focus?: string;
  expected_fields?: ExpectedFields;
  candidates?: Candidate[];
  scan_metadata?: ScanMetadata;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
  apple_maps: 'Apple Maps',
  bing: 'Bing',
  bbb: 'BBB',
};

function platformLabel(key: string): string {
  return PLATFORM_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function severityColor(severity?: string): string {
  return severity === 'non_negotiable' ? 'red' : severity === 'recommended' ? 'blue' : 'gray';
}

function severityLabel(severity?: string): string {
  return severity === 'non_negotiable' ? 'Required' : severity === 'recommended' ? 'Recommended' : 'Info';
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function YesNo({ value }: { value: boolean | null | undefined }) {
  if (value == null) return <Text size="xs" c="dimmed">—</Text>;
  return value ? (
    <Group gap={4}>
      <ThemeIcon size={16} color="green" variant="light" radius="xl"><IconCheck size={10} /></ThemeIcon>
      <Text size="xs" c="green.7">Yes</Text>
    </Group>
  ) : (
    <Group gap={4}>
      <ThemeIcon size={16} color="red" variant="light" radius="xl"><IconX size={10} /></ThemeIcon>
      <Text size="xs" c="red.7">No</Text>
    </Group>
  );
}

// ─── Sub-sections ────────────────────────────────────────────────────────

function QualityGateList({ gates }: { gates: QualityGate[] | undefined }) {
  if (!gates || gates.length === 0) return <Text size="xs" c="dimmed">No quality gates defined.</Text>;
  const sorted = [...gates].sort((a, b) => {
    if (a.severity === 'non_negotiable' && b.severity !== 'non_negotiable') return -1;
    if (b.severity === 'non_negotiable' && a.severity !== 'non_negotiable') return 1;
    return 0;
  });
  return (
    <Stack gap={6}>
      {sorted.map((g, i) => (
        <Group key={i} gap="xs" align="flex-start" wrap="nowrap">
          <Badge size="xs" variant="light" color={severityColor(g.severity)} style={{ flexShrink: 0, marginTop: 2 }}>
            {severityLabel(g.severity)}
          </Badge>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text size="xs" fw={500}>{g.field}</Text>
            <Text size="xs" c="dimmed">{g.description}</Text>
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}

function FieldList({ fields }: { fields: ExpectedField[] | undefined }) {
  if (!fields || fields.length === 0) return null;
  return (
    <Stack gap={4}>
      {fields.map((f, i) => (
        <Group key={i} gap="xs" align="flex-start" wrap="nowrap">
          {f.severity && (
            <Badge size="xs" variant="light" color={severityColor(f.severity)} style={{ flexShrink: 0, marginTop: 2 }}>
              {severityLabel(f.severity)}
            </Badge>
          )}
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text size="xs" fw={500}>{f.field}</Text>
            <Text size="xs" c="dimmed">{f.description}</Text>
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}

function BrandingExpectationsView({ be }: { be: BrandingExpectations | undefined }) {
  if (!be) return null;
  return (
    <Stack gap={4}>
      <Group gap="xs">
        <IconPhoto size={14} />
        <Text size="xs" fw={600}>Branding Expectations</Text>
      </Group>
      <Group gap="lg" wrap="wrap">
        <Group gap={4}><Text size="xs" c="dimmed">Logo:</Text><YesNo value={be.has_logo} /></Group>
        <Group gap={4}><Text size="xs" c="dimmed">Cover:</Text><YesNo value={be.has_cover_photo} /></Group>
        <Group gap={4}><Text size="xs" c="dimmed">Profile:</Text><YesNo value={be.has_profile_photo} /></Group>
        {be.photo_count != null && (
          <Group gap={4}><Text size="xs" c="dimmed">Photos:</Text><Text size="xs" fw={500}>{be.photo_count}</Text></Group>
        )}
      </Group>
      {be.photo_types && be.photo_types.length > 0 && (
        <Group gap={4}>
          <Text size="xs" c="dimmed">Photo types:</Text>
          {be.photo_types.map((t, i) => (
            <Badge key={i} size="xs" variant="light" color="gray">{t}</Badge>
          ))}
        </Group>
      )}
      {be.visual_assets && be.visual_assets.length > 0 && (
        <Stack gap={2}>
          <Text size="xs" c="dimmed">Visual assets:</Text>
          {be.visual_assets.map((v, i) => (
            <Text key={i} size="xs" c="dimmed" style={{ paddingLeft: 8 }}>• {v}</Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function PlatformExpectedFieldsView({ platformKey, pf }: { platformKey: string; pf: PlatformExpectedFields }) {
  return (
    <Stack gap="sm">
      {/* Categories */}
      <Group gap="xs" wrap="wrap">
        {pf.primary_category && (
          <Group gap={4}>
            <Text size="xs" c="dimmed">Primary:</Text>
            <Badge size="xs" variant="filled" color="indigo">{pf.primary_category}</Badge>
          </Group>
        )}
        {pf.additional_categories && pf.additional_categories.length > 0 && (
          <Group gap={4}>
            <Text size="xs" c="dimmed">Additional:</Text>
            {pf.additional_categories.map((c, i) => (
              <Badge key={i} size="xs" variant="light" color="indigo">{c}</Badge>
            ))}
          </Group>
        )}
        {pf.page_type && (
          <Badge size="xs" variant="dot" color="gray">{pf.page_type}</Badge>
        )}
      </Group>

      {/* Attributes */}
      {pf.required_attributes && pf.required_attributes.length > 0 && (
        <Stack gap={4}>
          <Text size="xs" fw={600} c="red.7">Required Attributes</Text>
          <Group gap={4} wrap="wrap">
            {pf.required_attributes.map((a, i) => (
              <Badge key={i} size="xs" variant="light" color="red">{a}</Badge>
            ))}
          </Group>
        </Stack>
      )}
      {pf.recommended_attributes && pf.recommended_attributes.length > 0 && (
        <Stack gap={4}>
          <Text size="xs" fw={600} c="blue.7">Recommended Attributes</Text>
          <Group gap={4} wrap="wrap">
            {pf.recommended_attributes.map((a, i) => (
              <Badge key={i} size="xs" variant="light" color="blue">{a}</Badge>
            ))}
          </Group>
        </Stack>
      )}

      {/* Description requirements + photo count */}
      <Group gap="lg" wrap="wrap">
        {pf.description_requirements && (
          <Stack gap={2} style={{ maxWidth: 400 }}>
            <Text size="xs" c="dimmed">Description requirements:</Text>
            <Text size="xs" c="gray.7">{pf.description_requirements}</Text>
          </Stack>
        )}
        {pf.expected_photo_count != null && (
          <Group gap={4}>
            <IconPhoto size={14} />
            <Text size="xs" c="dimmed">Expected photos:</Text>
            <Text size="xs" fw={500}>{pf.expected_photo_count}</Text>
          </Group>
        )}
      </Group>

      {/* Branding expectations */}
      <BrandingExpectationsView be={pf.branding_expectations} />

      {/* Quality gates */}
      {pf.quality_gates && pf.quality_gates.length > 0 && (
        <Stack gap={4}>
          <Group gap="xs">
            <IconShieldCheck size={14} />
            <Text size="xs" fw={600}>Quality Gates ({pf.quality_gates.length})</Text>
          </Group>
          <Box pl={20}>
            <QualityGateList gates={pf.quality_gates} />
          </Box>
        </Stack>
      )}

      {/* Platform-specific fields */}
      {pf.fields && pf.fields.length > 0 && (
        <Stack gap={4}>
          <Group gap="xs">
            <IconListDetails size={14} />
            <Text size="xs" fw={600}>Expected Fields ({pf.fields.length})</Text>
          </Group>
          <Box pl={20}>
            <FieldList fields={pf.fields} />
          </Box>
        </Stack>
      )}
    </Stack>
  );
}

function CandidateCard({ candidate, idx }: { candidate: Candidate; idx: number }) {
  const evaluations = candidate.platform_evaluations ?? [];
  const goldPlatforms = evaluations.filter((e) => e.is_gold_standard === true);
  const isExcluded = candidate.ownership_type === 'franchise' || candidate.ownership_type === 'chain';

  return (
    <Paper withBorder radius="sm" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Text size="sm" fw={600}>{candidate.business_name}</Text>
              {goldPlatforms.length > 0 && (
                <Badge size="xs" variant="filled" color="amber" leftSection={<IconStar size={10} />}>
                  Gold Standard ({goldPlatforms.length})
                </Badge>
              )}
              {candidate.ownership_type && (
                <Badge
                  size="xs"
                  variant="light"
                  color={isExcluded ? 'red' : 'green'}
                >
                  {candidate.ownership_type === 'independent' ? 'Independent' :
                   candidate.ownership_type === 'small_group' ? `Small group${candidate.location_count_estimate ? ` (${candidate.location_count_estimate} locs)` : ''}` :
                   candidate.ownership_type === 'franchise' ? 'Franchise' :
                   candidate.ownership_type === 'chain' ? 'Chain' : candidate.ownership_type}
                </Badge>
              )}
            </Group>
            <Group gap="xs" wrap="wrap">
              {(candidate.city || candidate.state) && (
                <Group gap={3}>
                  <IconMapPin size={12} />
                  <Text size="xs" c="dimmed">
                    {candidate.city ? `${candidate.city}${candidate.state ? `, ${candidate.state}` : ''}` : candidate.state}
                  </Text>
                </Group>
              )}
              {candidate.nap?.phone && (
                <Text size="xs" c="dimmed">{candidate.nap.phone}</Text>
              )}
              {candidate.nap?.address && (
                <Text size="xs" c="dimmed">{candidate.nap.address}</Text>
              )}
            </Group>
            {candidate.category_notes && (
              <Text size="xs" c="dimmed" mt={2}>{candidate.category_notes}</Text>
            )}
            {candidate.independence_rationale && (
              <Text size="xs" c="dimmed" fs="italic">{candidate.independence_rationale}</Text>
            )}
          </Stack>
        </Group>

        {/* Per-platform evaluations */}
        {evaluations.length > 0 && (
          <Table striped highlightOnHover style={{ tableLayout: 'fixed', fontSize: 'var(--mantine-font-size-xs)' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 90 }}>Platform</Table.Th>
                <Table.Th style={{ width: 60 }}>Score</Table.Th>
                <Table.Th style={{ width: 80 }}>Status</Table.Th>
                <Table.Th style={{ width: 70 }}>Photos</Table.Th>
                <Table.Th>Rationale</Table.Th>
                <Table.Th style={{ width: 50 }}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {evaluations.map((pe, i) => (
                <Table.Tr key={i}>
                  <Table.Td><Text size="xs" fw={500}>{platformLabel(pe.platform)}</Text></Table.Td>
                  <Table.Td>
                    {pe.quality_score != null ? (
                      <Text size="xs" fw={600} c={pe.quality_score >= 9 ? 'green.7' : pe.quality_score >= 7 ? 'blue.7' : 'orange.7'}>
                        {pe.quality_score}/10
                      </Text>
                    ) : '—'}
                  </Table.Td>
                  <Table.Td>
                    {pe.is_gold_standard === true ? (
                      <Badge size="xs" variant="filled" color="amber" leftSection={<IconStar size={8} />}>Gold</Badge>
                    ) : pe.is_gold_standard === false ? (
                      <Badge size="xs" variant="light" color="gray">Candidate</Badge>
                    ) : '—'}
                  </Table.Td>
                  <Table.Td>
                    {pe.branding_artifacts?.photo_count != null ? (
                      <Text size="xs">{pe.branding_artifacts.photo_count}</Text>
                    ) : '—'}
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={pe.quality_rationale || '—'} position="top-start" multiline w={400} disabled={!pe.quality_rationale}>
                      <Text size="xs" c="dimmed" lineClamp={2}>{pe.quality_rationale || '—'}</Text>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    {pe.profile_url && (
                      <Anchor href={pe.profile_url} target="_blank" rel="noopener noreferrer" size="xs">
                        <IconExternalLink size={14} />
                      </Anchor>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {/* Quality gates passed/failed summary */}
        {evaluations.some((e) => (e.quality_gates_failed?.length ?? 0) > 0) && (
          <Stack gap={4}>
            <Text size="xs" fw={500} c="dimmed">Quality Gate Failures:</Text>
            {evaluations.map((pe, i) => (
              pe.quality_gates_failed && pe.quality_gates_failed.length > 0 ? (
                <Group key={i} gap="xs" wrap="wrap">
                  <Text size="xs" fw={500}>{platformLabel(pe.platform)}:</Text>
                  {pe.quality_gates_failed.map((g, j) => (
                    <Badge key={j} size="xs" variant="light" color="red">{g}</Badge>
                  ))}
                </Group>
              ) : null
            ))}
          </Stack>
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
 * Operator-friendly structured view for gold-standard intelligence profiles.
 *
 * Renders the gold-standard scan output (expected_fields, quality gates,
 * branding expectations, candidate evaluations, scan metadata) in a
 * human-readable layout instead of a raw JSON dump. Used in the
 * Intelligence Profiles page's View modal when the profile's
 * configuration_json matches the gold_standard_scan schema shape.
 */
export default function GoldStandardProfileView({ profile }: Props) {
  const config = (profile.configuration_json ?? {}) as GoldStandardConfig;
  const expectedFields = config.expected_fields;
  const universal = expectedFields?.universal;
  const platforms = expectedFields?.platforms ?? {};
  const candidates = config.candidates ?? [];
  const scanMeta = config.scan_metadata;
  const platformKeys = Object.keys(platforms);
  const goldCandidates = candidates.filter((c) =>
    c.platform_evaluations?.some((e) => e.is_gold_standard === true),
  );

  return (
    <Stack gap="md">
      {/* ─── Scan Overview ─── */}
      <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--mantine-color-amber-0)' }}>
        <Stack gap="sm">
          <Group gap="xs">
            <IconTarget size={18} />
            <Text size="sm" fw={700}>Gold Standard Profile — {config.category_name || profile.category_name}</Text>
            {(() => {
              const scope = profileScopeLabel(profile);
              return (
                <Badge size="sm" variant="dot" color={scope.color}>
                  {scope.label}
                </Badge>
              );
            })()}
          </Group>
          <Group gap="lg" wrap="wrap">
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Platform Focus</Text>
              <Text size="sm" fw={500}>{platformLabel(config.platform_focus || 'all')}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Geographic Scope</Text>
              <Text size="sm" fw={500}>{profileScopeLabel(profile).label}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Scan Date</Text>
              <Text size="sm" fw={500}>{formatDate(scanMeta?.scan_date)}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Candidates</Text>
              <Text size="sm" fw={500}>{candidates.length} ({goldCandidates.length} gold-standard)</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Platforms Evaluated</Text>
              <Text size="sm" fw={500}>{platformKeys.length}</Text>
            </Stack>
          </Group>
          {scanMeta?.selection_criteria && (
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Selection criteria:</Text>
              <Text size="xs" c="gray.7">{scanMeta.selection_criteria}</Text>
            </Stack>
          )}
          {scanMeta?.sources_consulted && scanMeta.sources_consulted.length > 0 && (
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Sources consulted:</Text>
              <Group gap={4} wrap="wrap">
                {scanMeta.sources_consulted.map((s, i) => (
                  <Badge key={i} size="xs" variant="light" color="gray">{s}</Badge>
                ))}
              </Group>
            </Stack>
          )}
        </Stack>
      </Paper>

      <ScrollArea h={600} type="auto" offsetScrollbars>
        <Stack gap="md" pr={8}>
          {/* ─── Universal Expected Fields ─── */}
          {universal && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <Group gap="xs">
                  <IconInfoCircle size={16} />
                  <Text size="sm" fw={600}>Universal Requirements</Text>
                </Group>
                <Group gap="lg" wrap="wrap">
                  {universal.canonical_name && (
                    <Stack gap={0}><Text size="xs" c="dimmed">Canonical Name</Text><Text size="xs" fw={500}>{universal.canonical_name}</Text></Stack>
                  )}
                  {universal.canonical_address && (
                    <Stack gap={0}><Text size="xs" c="dimmed">Canonical Address</Text><Text size="xs" fw={500}>{universal.canonical_address}</Text></Stack>
                  )}
                  {universal.canonical_phone && (
                    <Stack gap={0}><Text size="xs" c="dimmed">Canonical Phone</Text><Text size="xs" fw={500}>{universal.canonical_phone}</Text></Stack>
                  )}
                  <Group gap={4}><Text size="xs" c="dimmed">Hours:</Text><YesNo value={universal.hours_present} /></Group>
                  <Group gap={4}><Text size="xs" c="dimmed">Website:</Text><YesNo value={universal.website_present} /></Group>
                </Group>
                {universal.quality_gates && universal.quality_gates.length > 0 && (
                  <Stack gap={4}>
                    <Text size="xs" fw={600}>Quality Gates ({universal.quality_gates.length})</Text>
                    <QualityGateList gates={universal.quality_gates} />
                  </Stack>
                )}
                {universal.fields && universal.fields.length > 0 && (
                  <Stack gap={4}>
                    <Text size="xs" fw={600}>Fields ({universal.fields.length})</Text>
                    <FieldList fields={universal.fields} />
                  </Stack>
                )}
              </Stack>
            </Paper>
          )}

          {/* ─── Per-Platform Expected Fields ─── */}
          {platformKeys.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <Group gap="xs">
                  <IconListDetails size={16} />
                  <Text size="sm" fw={600}>Per-Platform Standards ({platformKeys.length})</Text>
                </Group>
                <Accordion chevronPosition="right" variant="separated">
                  {platformKeys.map((key) => {
                    const pf = platforms[key];
                    const gateCount = pf.quality_gates?.length ?? 0;
                    return (
                      <Accordion.Item key={key} value={key}>
                        <Accordion.Control>
                          <Group gap="xs" wrap="wrap">
                            <Text size="sm" fw={500}>{platformLabel(key)}</Text>
                            {pf.primary_category && (
                              <Badge size="xs" variant="light" color="indigo">{pf.primary_category}</Badge>
                            )}
                            {gateCount > 0 && (
                              <Badge size="xs" variant="light" color="gray">{gateCount} gates</Badge>
                            )}
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <PlatformExpectedFieldsView platformKey={key} pf={pf} />
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              </Stack>
            </Paper>
          )}

          <Divider />

          {/* ─── Gold-Standard Candidates ─── */}
          {candidates.length > 0 && (
            <Stack gap="sm">
              <Group gap="xs">
                <IconStar size={16} />
                <Text size="sm" fw={600}>Benchmark Candidates ({candidates.length})</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Businesses evaluated as gold-standard exemplars. {goldCandidates.length} of {candidates.length} qualified
                as gold standard on at least one platform.
              </Text>
              <Stack gap="sm">
                {candidates.map((c, i) => (
                  <CandidateCard key={i} candidate={c} idx={i} />
                ))}
              </Stack>
            </Stack>
          )}

          {/* ─── Excluded candidates ─── */}
          {scanMeta?.excluded_candidates && scanMeta.excluded_candidates.length > 0 && (
            <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--mantine-color-red-0)' }}>
              <Stack gap="sm">
                <Text size="sm" fw={600} c="red.7">Excluded Candidates ({scanMeta.excluded_candidates.length})</Text>
                <Stack gap={4}>
                  {scanMeta.excluded_candidates.map((ex, i) => (
                    <Group key={i} gap="xs" align="flex-start" wrap="nowrap">
                      <IconX size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--mantine-color-red-6)' }} />
                      <Stack gap={0}>
                        <Text size="xs" fw={500}>{ex.business_name}</Text>
                        <Text size="xs" c="dimmed">{ex.reason}</Text>
                      </Stack>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* ─── Scan metadata ─── */}
          {scanMeta && (
            <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
              <Stack gap="sm">
                <Text size="sm" fw={600}>Scan Metadata</Text>
                <Group gap="lg" wrap="wrap">
                  {scanMeta.platforms_evaluated && scanMeta.platforms_evaluated.length > 0 && (
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed">Platforms evaluated:</Text>
                      <Group gap={4} wrap="wrap">
                        {scanMeta.platforms_evaluated.map((p, i) => (
                          <Badge key={i} size="xs" variant="light" color="gray">{platformLabel(p)}</Badge>
                        ))}
                      </Group>
                    </Stack>
                  )}
                </Group>
                {scanMeta.expected_field_derivation && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Expected field derivation:</Text>
                    <Text size="xs" c="gray.7">{scanMeta.expected_field_derivation}</Text>
                  </Stack>
                )}
              </Stack>
            </Paper>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

// ─── Detection helper ────────────────────────────────────────────────────

/**
 * Detect whether a profile's configuration_json matches the gold-standard
 * scan output shape (has `expected_fields` with `platforms` or `universal`).
 * Used by the IntelligenceProfilesClient to decide whether to render the
 * structured GoldStandardProfileView or the raw JSON dump.
 */
export function isGoldStandardProfile(profile: IntelligenceProfile): boolean {
  if (profile.intelligence_focus === 'gold_standards') return true;
  const config = profile.configuration_json as any;
  return !!(config?.expected_fields && (config.expected_fields.platforms || config.expected_fields.universal));
}

/**
 * Compute summary stats for a gold-standard profile card.
 * Returns null if the profile is not a gold-standard shape.
 */
export function goldStandardSummary(profile: IntelligenceProfile): {
  candidateCount: number;
  goldCount: number;
  platformCount: number;
  gateCount: number;
} | null {
  const config = (profile.configuration_json ?? {}) as GoldStandardConfig;
  if (!config.expected_fields && !config.candidates) return null;
  const candidates = config.candidates ?? [];
  const goldCount = candidates.filter((c) =>
    c.platform_evaluations?.some((e) => e.is_gold_standard === true),
  ).length;
  const platforms = config.expected_fields?.platforms ?? {};
  let gateCount = config.expected_fields?.universal?.quality_gates?.length ?? 0;
  for (const pf of Object.values(platforms)) {
    gateCount += pf.quality_gates?.length ?? 0;
  }
  return {
    candidateCount: candidates.length,
    goldCount,
    platformCount: Object.keys(platforms).length,
    gateCount,
  };
}
