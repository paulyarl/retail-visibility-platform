'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Paper, Text, Group, Badge, Button, Stack, Divider, Alert,
  Loader, Table, Select, TextInput, ActionIcon, Tooltip,
  ThemeIcon, Box, Accordion,
} from '@mantine/core';
import {
  IconRefresh, IconAlertCircle, IconCheck, IconCircleCheck,
  IconCircleDot, IconMapPin, IconPlus, IconArrowRight, IconInfoCircle,
} from '@tabler/icons-react';
import Link from 'next/link';
import marketingOpsService, {
  IntelligenceCoverage, CoverageCategory, CoverageSlot,
  IntelligenceFocus,
} from '@/services/MarketingOpsService';

const PLATFORM_LABELS: Record<string, string> = {
  all: 'All Platforms',
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
  bbb: 'BBB',
  apple_maps: 'Apple Maps',
  bing: 'Bing',
};

const FOCUS_LABELS: Record<IntelligenceFocus, string> = {
  emerging: 'Emerging',
  competitive: 'Competitive',
  gold_standards: 'Gold Standards',
};

const FOCUS_COLORS: Record<IntelligenceFocus, string> = {
  emerging: 'blue',
  competitive: 'violet',
  gold_standards: 'gold',
};

// The canonical platforms the operator should cover per category.
// Gold standard establishment is nationwide + per-platform; these are
// the platforms that matter most. "all" is included as a broad-scan option.
// forcing redeploy - 8/29/2026 

const GOLD_STANDARD_PLATFORMS = ['all', 'google', 'yelp', 'facebook', 'bbb', 'manta'];

export default function CoverageClient() {
  const [coverage, setCoverage] = useState<IntelligenceCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');

  const fetchCoverage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketingOpsService.getIntelligenceCoverage();
      setCoverage(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to load coverage');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  // Build the link to create a campaign for a specific gap.
  const createCampaignLink = (params: {
    focus: IntelligenceFocus;
    kind: 'establishment' | 'discovery';
    category?: string;
    city?: string;
    state?: string;
    platform?: string;
  }) => {
    const sp = new URLSearchParams();
    sp.set('scope', 'intelligence');
    sp.set('focus', params.focus);
    sp.set('kind', params.kind);
    if (params.category) sp.set('category', params.category);
    if (params.city) sp.set('city', params.city);
    if (params.state) sp.set('state', params.state);
    if (params.platform) sp.set('platform', params.platform);
    return `/settings/admin/marketing-ops/campaigns/new?${sp.toString()}`;
  };

  // Find the slot status for a given (category, focus, city, platform).
  const slotStatus = (
    cat: CoverageCategory,
    focus: IntelligenceFocus,
    city?: string | null,
    platform?: string | null,
  ): CoverageSlot | null => {
    return cat.slots.find((s) => {
      if (s.focus !== focus) return false;
      if (city !== undefined) {
        const sCity = s.city ?? null;
        const wantCity = city ?? null;
        if (sCity !== wantCity) return false;
      }
      if (platform !== undefined) {
        const sPlat = s.platform ?? null;
        const wantPlat = platform ?? null;
        // "All Platforms" (dimension value 'all') is the cross-platform slot.
        // The backend stores cross-platform gold-standard profiles with
        // reference_platform = NULL (see IntelligenceProfileService resolver
        // fallback chain + importAsDraft scanPlatform normalization), so a
        // null platform must match the 'all' slot — otherwise active
        // cross-platform profiles never render as green.
        if (wantPlat === 'all') {
          if (sPlat !== null && sPlat !== 'all') return false;
        } else if (sPlat !== wantPlat) {
          return false;
        }
      }
      return true;
    }) ?? null;
  };

  const filteredCategories = useMemo(() => {
    if (!coverage) return [];
    return coverage.categories.filter((c) => {
      if (categoryFilter && !c.category_name.toLowerCase().includes(categoryFilter.toLowerCase())) return false;
      return true;
    });
  }, [coverage, categoryFilter]);

  // All cities from coverage data (for the city dimension in emerging/competitive).
  const allCities = coverage?.cities ?? [];

  if (loading) {
    return (
      <Group justify="center" p="xl">
        <Loader />
        <Text c="dimmed">Loading coverage…</Text>
      </Group>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
        {error}
        <Button variant="subtle" size="xs" ml="sm" onClick={fetchCoverage} leftSection={<IconRefresh size={14} />}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!coverage) return null;

  const hasNoData = coverage.categories.length === 0;

  return (
    <Stack gap="md">
      {/* ─── Header + actions ─── */}
      <Group justify="space-between" align="flex-start">
        <Box style={{ maxWidth: 600 }}>
          <Text size="sm" c="dimmed">
            The coverage map shows which intelligence profiles exist (active or draft) for each category.
            Discovery campaigns require an active profile — fill the gaps in order: gold standards first
            (nationwide), then emerging/competitive establishment per city, then discovery.
          </Text>
        </Box>
        <Button variant="subtle" size="xs" onClick={fetchCoverage} leftSection={<IconRefresh size={14} />}>
          Refresh
        </Button>
      </Group>

      {/* ─── Dependency order guide ─── */}
      <Paper withBorder p="md" radius="md">
        <Group gap="xs" align="flex-start">
          <ThemeIcon variant="light" color="blue" size="sm">
            <IconInfoCircle size={14} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={600}>Recommended order for a new niche + city</Text>
            <Text size="xs" c="dimmed" mt={4}>
              1. Gold Standard Establishment (nationwide, per platform) → activate<br />
              2. Gold Standard Discovery (city-narrowed, optional — for regional exemplars)<br />
              3. Emerging Establishment (city + category) → activate<br />
              4. Emerging Discovery (city + category) → prospect queue<br />
              5. Competitive Establishment (city + category) → activate<br />
              6. Competitive Discovery (city + category) → prospect queue<br />
              <Text size="xs" c="dimmed" fs="italic" mt={4}>
                Thin market? Skip competitive (steps 5-6). Keep gold standard — it&apos;s reusable across cities.
              </Text>
            </Text>
          </Box>
        </Group>
      </Paper>

      {/* ─── Filters ─── */}
      <Group gap="sm">
        <TextInput
          placeholder="Filter by category…"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ width: 250 }}
        />
        <Select
          placeholder="Filter by city"
          value={cityFilter || null}
          onChange={(v) => setCityFilter(v ?? '')}
          data={allCities.map((c) => ({ value: c, label: c }))}
          clearable
          style={{ width: 200 }}
        />
        {(categoryFilter || cityFilter) && (
          <Button variant="subtle" size="xs" onClick={() => { setCategoryFilter(''); setCityFilter(''); }}>
            Clear filters
          </Button>
        )}
      </Group>

      {hasNoData && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue">
          No intelligence profiles exist yet. Create your first establishment campaign to start building coverage.
          <Link href={createCampaignLink({ focus: 'gold_standards', kind: 'establishment', platform: 'all' })}>
            <Button variant="light" size="xs" ml="sm" leftSection={<IconPlus size={14} />}>
              Create Gold Standard Establishment
            </Button>
          </Link>
        </Alert>
      )}

      {/* ─── Coverage matrix ─── */}
      {filteredCategories.map((cat) => {
        const goldSlots = cat.slots.filter((s) => s.focus === 'gold_standards');
        const emergingSlots = cat.slots.filter((s) => s.focus === 'emerging');
        const competitiveSlots = cat.slots.filter((s) => s.focus === 'competitive');

        // Cities that have emerging or competitive profiles for this category.
        const categoryCities = new Set([
          ...emergingSlots.map((s) => s.city).filter(Boolean) as string[],
          ...competitiveSlots.map((s) => s.city).filter(Boolean) as string[],
        ]);

        // If a city filter is active, only show this category if it has
        // profiles for that city OR if it has no city-scoped profiles at all
        // (so the operator can see categories that need the city added).
        const cityMatch = !cityFilter ||
          categoryCities.has(cityFilter) ||
          (categoryCities.size === 0);

        if (!cityMatch) return null;

        return (
          <Paper key={cat.category_key} withBorder p="md" radius="md">
            <Group justify="space-between" align="center" mb="sm">
              <Group gap="sm">
                <Text fw={600}>{cat.category_name}</Text>
                <Badge variant="light" size="xs">{cat.slots.filter(s => s.status === 'active').length} active</Badge>
                <Badge variant="light" color="gray" size="xs">{cat.slots.filter(s => s.status === 'draft').length} draft</Badge>
              </Group>
              <Link href={createCampaignLink({
                focus: 'gold_standards', kind: 'establishment',
                category: cat.category_name, platform: 'all',
              })}>
                <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />}>
                  Add profile
                </Button>
              </Link>
            </Group>

            {/* Gold Standards section — per platform, nationwide */}
            <CoverageSection
              title="Gold Standards (nationwide, per platform)"
              focus="gold_standards"
              slots={goldSlots}
              category={cat}
              cityFilter={cityFilter}
              slotStatus={slotStatus}
              createLink={createCampaignLink}
              dimensionKey="platform"
              dimensionValues={GOLD_STANDARD_PLATFORMS}
              dimensionLabels={PLATFORM_LABELS}
            />

            {/* Emerging section — per city */}
            <CoverageSection
              title="Emerging (per city)"
              focus="emerging"
              slots={emergingSlots}
              category={cat}
              cityFilter={cityFilter}
              slotStatus={slotStatus}
              createLink={createCampaignLink}
              dimensionKey="city"
              dimensionValues={cityFilter ? [cityFilter] : allCities}
              dimensionLabels={undefined}
              showAllCitiesHint={!cityFilter}
            />

            {/* Competitive section — per city */}
            <CoverageSection
              title="Competitive (per city)"
              focus="competitive"
              slots={competitiveSlots}
              category={cat}
              cityFilter={cityFilter}
              slotStatus={slotStatus}
              createLink={createCampaignLink}
              dimensionKey="city"
              dimensionValues={cityFilter ? [cityFilter] : allCities}
              dimensionLabels={undefined}
              showAllCitiesHint={!cityFilter}
            />
          </Paper>
        );
      })}
    </Stack>
  );
}

// ─── Coverage Section ───────────────────────────────────────────────────
// Renders a sub-section for one focus (gold_standards / emerging / competitive).
// Shows the dimension values (platforms or cities) as a row of status chips,
// with "missing" slots showing a create-campaign action.

interface CoverageSectionProps {
  title: string;
  focus: IntelligenceFocus;
  slots: CoverageSlot[];
  category: CoverageCategory;
  cityFilter: string;
  slotStatus: (
    cat: CoverageCategory,
    focus: IntelligenceFocus,
    city?: string | null,
    platform?: string | null,
  ) => CoverageSlot | null;
  createLink: (params: {
    focus: IntelligenceFocus;
    kind: 'establishment' | 'discovery';
    category?: string;
    city?: string;
    state?: string;
    platform?: string;
  }) => string;
  dimensionKey: 'platform' | 'city';
  dimensionValues: string[];
  dimensionLabels?: Record<string, string>;
  showAllCitiesHint?: boolean;
}

function CoverageSection({
  title, focus, slots, category, cityFilter, slotStatus,
  createLink, dimensionKey, dimensionValues, dimensionLabels, showAllCitiesHint,
}: CoverageSectionProps) {
  const hasAny = slots.length > 0;

  return (
    <Box mb="sm">
      <Divider
        label={
          <Group gap="xs">
            <Badge
              variant="light"
              color={FOCUS_COLORS[focus] === 'gold' ? 'yellow' : FOCUS_COLORS[focus] as any}
              size="xs"
            >
              {FOCUS_LABELS[focus]}
            </Badge>
            <Text size="xs" c="dimmed">{title}</Text>
          </Group>
        }
        labelPosition="left"
        mb="xs"
      />

      {!hasAny && dimensionValues.length === 0 && (
        <Text size="xs" c="dimmed" fs="italic" pl="md">
          No profiles yet. No {dimensionKey === 'city' ? 'cities' : 'platforms'} in scope.
        </Text>
      )}

      <Group gap="xs" pl="md" align="flex-start">
        {dimensionValues.map((dimVal) => {
          const isPlatform = dimensionKey === 'platform';
          const platform = isPlatform ? dimVal : undefined;
          const city = !isPlatform ? dimVal : undefined;
          const slot = slotStatus(category, focus, city, platform);
          const label = dimensionLabels?.[dimVal] ?? dimVal;

          return (
            <SlotChip
              key={`${focus}-${dimVal}`}
              label={label}
              slot={slot}
              focus={focus}
              category={category}
              city={city}
              platform={platform}
              createLink={createLink}
            />
          );
        })}

        {/* If showing all cities and this category has no city-scoped profiles,
            show a hint to add the first city. */}
        {showAllCitiesHint && !hasAny && dimensionKey === 'city' && (
          <Text size="xs" c="dimmed" fs="italic">
            No city profiles yet — create an establishment campaign for a city to start.
          </Text>
        )}
      </Group>

      {/* Show "add platform/city" action for gold standards if not all platforms covered */}
      {isPlatformFn(dimensionKey) && (
        <Box pl="md" mt="xs">
          <Link href={createLink({
            focus, kind: 'establishment',
            category: category.category_name,
            platform: 'all',
          })}>
            <Button variant="subtle" size="compact-xs" leftSection={<IconPlus size={12} />}>
              Add platform
            </Button>
          </Link>
        </Box>
      )}
    </Box>
  );
}

function isPlatformFn(key: string): boolean {
  return key === 'platform';
}

// ─── Slot Chip ──────────────────────────────────────────────────────────
// A single status chip for one (category, focus, dimension) slot.
// Shows: active (green check), draft (amber dot), missing (gray + action).

interface SlotChipProps {
  label: string;
  slot: CoverageSlot | null;
  focus: IntelligenceFocus;
  category: CoverageCategory;
  city?: string;
  platform?: string;
  createLink: (params: {
    focus: IntelligenceFocus;
    kind: 'establishment' | 'discovery';
    category?: string;
    city?: string;
    state?: string;
    platform?: string;
  }) => string;
}

function SlotChip({ label, slot, focus, category, city, platform, createLink }: SlotChipProps) {
  if (slot && slot.status === 'active') {
    return (
      <Tooltip label={`Active — v${slot.version}`}>
        <Group gap={4} style={{
          padding: '4px 10px',
          borderRadius: 6,
          background: 'var(--mantine-color-green-light)',
          border: '1px solid var(--mantine-color-green-3)',
        }}>
          <IconCircleCheck size={14} color="var(--mantine-color-green-6)" />
          <Text size="xs" fw={500}>{label}</Text>
          {slot.status === 'active' && (
            <Link href={createLink({
              focus, kind: 'discovery',
              category: category.category_name,
              city, platform,
            })}>
              <ActionIcon variant="subtle" size="xs" color="green" ml={2}>
                <IconArrowRight size={12} />
              </ActionIcon>
            </Link>
          )}
        </Group>
      </Tooltip>
    );
  }

  if (slot && slot.status === 'draft') {
    return (
      <Tooltip label={`Draft v${slot.version} — activate to enable discovery`}>
        <Group gap={4} style={{
          padding: '4px 10px',
          borderRadius: 6,
          background: 'var(--mantine-color-yellow-light)',
          border: '1px solid var(--mantine-color-yellow-3)',
        }}>
          <IconCircleDot size={14} color="var(--mantine-color-yellow-6)" />
          <Text size="xs" fw={500}>{label}</Text>
          <Text size="xs" c="dimmed">(draft)</Text>
        </Group>
      </Tooltip>
    );
  }

  // Missing — show a "create establishment" action
  return (
    <Link href={createLink({
      focus, kind: 'establishment',
      category: category.category_name,
      city, platform,
    })}>
      <Tooltip label={`No ${FOCUS_LABELS[focus]} profile — click to create establishment campaign`}>
        <Group gap={4} style={{
          padding: '4px 10px',
          borderRadius: 6,
          background: 'var(--mantine-color-gray-1)',
          border: '1px dashed var(--mantine-color-gray-4)',
          cursor: 'pointer',
        }}>
          <IconPlus size={14} color="var(--mantine-color-gray-5)" />
          <Text size="xs" c="dimmed">{label}</Text>
        </Group>
      </Tooltip>
    </Link>
  );
}
