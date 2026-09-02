'use client';

import {
  Paper,
  Text,
  Group,
  Badge,
  Stack,
  Divider,
  ScrollArea,
  ThemeIcon,
  Box,
} from '@mantine/core';
import {
  IconBook2,
  IconTags,
  IconSitemap,
  IconDatabase,
  IconSearch,
  IconClipboardCheck,
  IconAlertTriangle,
  IconBulb,
  IconTarget,
} from '@tabler/icons-react';
import type { IntelligenceProfile } from '@/services/MarketingOpsService';
import { profileScopeLabel } from '@/lib/intelligence-profile-scope';

// ─── Types (mirror of intelligence-profile.schema.ts §10 structure) ───────

interface SpecializedSource {
  name: string;
  type: string;
  priority?: number | null;
  capabilities: string[];
  limitations: string[];
  [k: string]: any;
}

interface CategoryProfileConfig {
  category_key?: string;
  category_name?: string;
  terminology?: Record<string, string>;
  synonyms?: string[];
  subcategories?: string[];
  specialized_sources?: SpecializedSource[];
  discovery_patterns?: Record<string, any>;
  category_evidence_rules?: Record<string, any>;
  prohibited_inferences?: string[];
  category_signals?: string[];
  [k: string]: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const SOURCE_TYPE_COLORS: Record<string, string> = {
  service_history: 'blue',
  certification: 'teal',
  professional_network: 'violet',
  mainstream_directory: 'gray',
  vertical_directory: 'indigo',
  social_platform: 'cyan',
  other: 'gray',
};

function sourceTypeLabel(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function renderRecordValue(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
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

interface Props {
  profile: IntelligenceProfile;
}

/**
 * Operator-friendly structured view for the §10 Category Intelligence Profile
 * (emerging / competitive establishment output).
 *
 * Renders the establishment scan output — terminology, synonyms, subcategories,
 * specialized sources (capabilities + limitations), discovery patterns,
 * category evidence rules, prohibited inferences, and category signals — in a
 * human-readable layout instead of a raw JSON dump. Mirrors the operator-aware
 * treatment that GoldStandardProfileView provides for gold-standard profiles.
 *
 * Used by:
 *   - IntelligenceEstablishmentPanel (campaign Overview tab, active profile)
 *   - IntelligenceProfilesClient (View modal, non-gold-standard profiles)
 */
export default function CategoryProfileView({ profile }: Props) {
  const config = (profile.configuration_json ?? {}) as CategoryProfileConfig;
  const terminology = config.terminology ?? {};
  const synonyms = config.synonyms ?? [];
  const subcategories = config.subcategories ?? [];
  const sources = config.specialized_sources ?? [];
  const discoveryPatterns = config.discovery_patterns ?? {};
  const evidenceRules = config.category_evidence_rules ?? {};
  const prohibitedInferences = config.prohibited_inferences ?? [];
  const categorySignals = config.category_signals ?? [];

  const terminologyKeys = Object.keys(terminology);
  const discoveryKeys = Object.keys(discoveryPatterns);
  const evidenceKeys = Object.keys(evidenceRules);

  return (
    <Stack gap="md">
      {/* ─── Profile Overview ─── */}
      <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
        <Stack gap="sm">
          <Group gap="xs">
            <IconTarget size={18} />
            <Text size="sm" fw={700}>
              Category Intelligence Profile — {config.category_name || profile.category_name}
            </Text>
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
              <Text size="xs" c="dimmed">Category Key</Text>
              <Text size="sm" fw={500} ff="monospace">{config.category_key || profile.category_key}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Geographic Scope</Text>
              <Text size="sm" fw={500}>{profileScopeLabel(profile).label}</Text>
            </Stack>
            {profile.reference_platform && (
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Platform Scope</Text>
                <Text size="sm" fw={500}>{profile.reference_platform}</Text>
              </Stack>
            )}
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Specialized Sources</Text>
              <Text size="sm" fw={500}>{sources.length}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Category Signals</Text>
              <Text size="sm" fw={500}>{categorySignals.length}</Text>
            </Stack>
          </Group>
        </Stack>
      </Paper>

      <ScrollArea h={600} type="auto" offsetScrollbars>
        <Stack gap="md" pr={8}>
          {/* ─── Terminology ─── */}
          {terminologyKeys.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <SectionHeader icon={<IconBook2 size={16} />} title="Terminology" count={terminologyKeys.length} />
                <Stack gap={4}>
                  {terminologyKeys.map((term) => (
                    <Group key={term} gap="xs" align="flex-start" wrap="nowrap">
                      <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0, marginTop: 2 }}>
                        {term}
                      </Badge>
                      <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>{terminology[term]}</Text>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* ─── Synonyms ─── */}
          {synonyms.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <SectionHeader icon={<IconTags size={16} />} title="Synonyms" count={synonyms.length} />
                <Group gap={4} wrap="wrap">
                  {synonyms.map((s, i) => (
                    <Badge key={i} size="xs" variant="light" color="gray">{s}</Badge>
                  ))}
                </Group>
              </Stack>
            </Paper>
          )}

          {/* ─── Subcategories ─── */}
          {subcategories.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <SectionHeader icon={<IconSitemap size={16} />} title="Subcategories" count={subcategories.length} />
                <Stack gap={2}>
                  {subcategories.map((sub, i) => (
                    <Text key={i} size="xs" c="dimmed" style={{ paddingLeft: 8 }}>• {sub}</Text>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* ─── Specialized Sources ─── */}
          {sources.length > 0 && (
            <Stack gap="sm">
              <SectionHeader icon={<IconDatabase size={16} />} title="Specialized Sources" count={sources.length} />
              <Stack gap="sm">
                {sources
                  .slice()
                  .sort((a, b) => {
                    const pa = typeof a.priority === 'number' ? a.priority : 99;
                    const pb = typeof b.priority === 'number' ? b.priority : 99;
                    return pa - pb;
                  })
                  .map((src, i) => (
                    <Paper key={i} withBorder radius="sm" p="sm">
                      <Stack gap="xs">
                        <Group gap="xs" wrap="wrap">
                          <Text size="sm" fw={600}>{src.name}</Text>
                          <Badge size="xs" variant="light" color={SOURCE_TYPE_COLORS[src.type] ?? 'gray'}>
                            {sourceTypeLabel(src.type)}
                          </Badge>
                          {typeof src.priority === 'number' && (
                            <Badge size="xs" variant="dot" color="gray">Priority {src.priority}</Badge>
                          )}
                        </Group>
                        {src.capabilities && src.capabilities.length > 0 && (
                          <Stack gap={2}>
                            <Text size="xs" fw={600} c="green.7">Capabilities</Text>
                            {src.capabilities.map((cap, j) => (
                              <Group key={j} gap="xs" align="flex-start" wrap="nowrap">
                                <ThemeIcon size={14} color="green" variant="light" radius="xl" style={{ flexShrink: 0, marginTop: 2 }}>
                                  <IconClipboardCheck size={9} />
                                </ThemeIcon>
                                <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>{cap}</Text>
                              </Group>
                            ))}
                          </Stack>
                        )}
                        {src.limitations && src.limitations.length > 0 && (
                          <Stack gap={2}>
                            <Text size="xs" fw={600} c="red.7">Limitations</Text>
                            {src.limitations.map((lim, j) => (
                              <Group key={j} gap="xs" align="flex-start" wrap="nowrap">
                                <ThemeIcon size={14} color="red" variant="light" radius="xl" style={{ flexShrink: 0, marginTop: 2 }}>
                                  <IconAlertTriangle size={9} />
                                </ThemeIcon>
                                <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>{lim}</Text>
                              </Group>
                            ))}
                          </Stack>
                        )}
                      </Stack>
                    </Paper>
                  ))}
              </Stack>
            </Stack>
          )}

          {/* ─── Discovery Patterns ─── */}
          {discoveryKeys.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <SectionHeader icon={<IconSearch size={16} />} title="Discovery Patterns" count={discoveryKeys.length} />
                <Stack gap={4}>
                  {discoveryKeys.map((key) => (
                    <Group key={key} gap="xs" align="flex-start" wrap="nowrap">
                      <Badge size="xs" variant="light" color="indigo" style={{ flexShrink: 0, marginTop: 2 }}>
                        {key}
                      </Badge>
                      <Text size="xs" c="dimmed" style={{ minWidth: 0, whiteSpace: 'pre-wrap' }}>
                        {renderRecordValue(discoveryPatterns[key])}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* ─── Category Evidence Rules ─── */}
          {evidenceKeys.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <SectionHeader icon={<IconClipboardCheck size={16} />} title="Category Evidence Rules" count={evidenceKeys.length} />
                <Stack gap={4}>
                  {evidenceKeys.map((key) => (
                    <Group key={key} gap="xs" align="flex-start" wrap="nowrap">
                      <Badge size="xs" variant="light" color="teal" style={{ flexShrink: 0, marginTop: 2 }}>
                        {key}
                      </Badge>
                      <Text size="xs" c="dimmed" style={{ minWidth: 0, whiteSpace: 'pre-wrap' }}>
                        {renderRecordValue(evidenceRules[key])}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* ─── Prohibited Inferences ─── */}
          {prohibitedInferences.length > 0 && (
            <Paper withBorder radius="md" p="md" style={{ backgroundColor: 'var(--mantine-color-red-0)' }}>
              <Stack gap="sm">
                <SectionHeader icon={<IconAlertTriangle size={16} />} title="Prohibited Inferences" count={prohibitedInferences.length} />
                <Stack gap={4}>
                  {prohibitedInferences.map((inf, i) => (
                    <Group key={i} gap="xs" align="flex-start" wrap="nowrap">
                      <IconAlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--mantine-color-red-6)' }} />
                      <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>{inf}</Text>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* ─── Category Signals ─── */}
          {categorySignals.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <SectionHeader icon={<IconBulb size={16} />} title="Category Signals" count={categorySignals.length} />
                <Group gap={4} wrap="wrap">
                  {categorySignals.map((sig, i) => (
                    <Badge key={i} size="xs" variant="light" color="violet" ff="monospace">{sig}</Badge>
                  ))}
                </Group>
              </Stack>
            </Paper>
          )}

          <Divider />

          <Box>
            <Text size="xs" c="dimmed" ta="center">
              Profile {profile.id} v{profile.version} · {profileScopeLabel(profile).label}
              {profile.reference_platform ? ` · ${profile.reference_platform}` : ''}
            </Text>
          </Box>
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
