'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Paper, Text, Group, Badge, Button, Stack, Divider, Alert,
  Loader, Select, TextInput, Tooltip,
  ThemeIcon, Box,
} from '@mantine/core';
import {
  IconRefresh, IconAlertCircle, IconCircleCheck,
  IconCircleDot, IconPlus, IconInfoCircle,
  IconListCheck, IconPlayerPlay, IconLock,
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
  bronze_standards: 'Bronze Standards',
  proving_ground: 'Proving Ground',
};

const FOCUS_COLORS: Record<IntelligenceFocus, string> = {
  emerging: 'blue',
  competitive: 'violet',
  gold_standards: 'gold',
  bronze_standards: 'orange',
  proving_ground: 'teal',
};

// The canonical platforms the operator should cover per category.
// Gold standard establishment is nationwide + per-platform; these are
// the platforms that matter most. "all" is included as a broad-scan option.
// "All Platforms" comes first — its establishment profile is the root of
// the gold-standard tree and acts as the proxy establishment that unlocks
// per-platform discovery when a platform has no establishment of its own.

const GOLD_STANDARD_PLATFORMS = ['all', 'google', 'yelp', 'facebook', 'bbb', 'apple_maps', 'bing'];

// Bronze standards are city-dimensioned like emerging/competitive, with one
// twist: stage-1 establishment is a single NATIONWIDE profile per category
// (city/state null) while the stage-2 city scan is a discovery-kind run that
// produces the city bronze profile as a draft (BRONZE_STANDARD_SPEC §6). The
// section renders a leading "Nationwide" column (establishment chip only —
// there is no national discovery) followed by one column per city carrying
// the city profile on top and the city scan below. The national profile is
// the proxy establishment that unlocks every city scan —
// resolveBronzeStandard cascades city → state → nationwide.
//
// The same leading "Nationwide" column now applies to emerging + competitive:
// a national establishment profile (reference_city NULL — imported from a
// '__all__' campaign) is the vocabulary floor every city resolves against,
// so it unlocks per-city discovery the same way bronze's national profile
// does. Without the column, a national profile renders nowhere and every
// city shows a ghost gap.
const NATIONAL_DIM = '__national__';
const NATIONAL_DIMENSION_LABELS: Record<string, string> = { [NATIONAL_DIM]: 'Nationwide' };

// ─── Slot state model ────────────────────────────────────────────────────
// Every position (gold: platform, emerging/competitive/bronze: city)
// renders two stacked chips — establishment on top, discovery on the
// bottom. Combined the flow has seven states, each with its own color and
// click action:
//
//   1. establishment pending    gray dashed  → create campaign
//   2. establishment in-flight  blue         → open campaign
//   3. establishment draft      yellow       → activate profile
//   4. establishment active     green        → discovery unlocked below
//   5. discovery pending        gray dashed  → create campaign
//   6. discovery in-flight      indigo       → open campaign
//   7. discovery executed       teal         → open audit
//
// The discovery chip stays locked (pale gray, lock icon) until the
// establishment chip is active — except the standards focuses, where a
// proxy establishment unlocks it: gold's "All Platforms" profile unlocks
// per-platform discovery (resolveGoldStandard falls back to the
// cross-platform profile), and bronze's "Nationwide" profile unlocks
// per-city scans (resolveBronzeStandard cascades city → state →
// nationwide).

const CAMPAIGN_URL = (id: string) => `/settings/admin/marketing-ops/campaigns/${id}`;
const CAMPAIGN_AUDITS_URL = (id: string) => `/settings/admin/marketing-ops/campaigns/${id}?tab=audits`;
const PROFILES_URL = '/settings/admin/marketing-ops/intelligence-profiles';

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

  // Find the slot for a given (category, focus, city, platform).
  const slotStatus = (
    cat: CoverageCategory,
    focus: IntelligenceFocus,
    city?: string | null,
    platform?: string | null,
  ): CoverageSlot | null => {
    const matches = cat.slots.filter((s) => {
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
    });
    // Platform-dimensioned lookups prefer the nationwide slot — a
    // market-scoped gold profile displays only when no nationwide profile
    // exists for that platform.
    if (platform !== undefined) {
      return matches.find((s) => (s.city ?? null) === null) ?? matches[0] ?? null;
    }
    return matches[0] ?? null;
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
            Every position carries two stacked chips — establishment on top, discovery on the bottom.
            Deploy per category: build the national floor first (one pass covers every market), then
            iterate cities — each city adds only its local delta. Discovery stays locked until its
            establishment is active.
          </Text>
        </Box>
        <Group gap="xs">
          <Link href={createCampaignLink({ focus: 'gold_standards', kind: 'establishment', platform: 'all' })}>
            <Button variant="light" size="xs" leftSection={<IconPlus size={14} />}>
              Add profile (new category)
            </Button>
          </Link>
          <Button variant="subtle" size="xs" onClick={fetchCoverage} leftSection={<IconRefresh size={14} />}>
            Refresh
          </Button>
        </Group>
      </Group>

      {/* ─── Dependency order guide ─── */}
      <Paper withBorder p="md" radius="md">
        <Group gap="xs" align="flex-start">
          <ThemeIcon variant="light" color="blue" size="sm">
            <IconInfoCircle size={14} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={600}>Recommended order for a category deployment — national first, then iterate cities</Text>
            <Text size="xs" c="dimmed" mt={4}>
              <Text size="xs" fw={600} c="dimmed" component="div">National floor (one pass covers every market):</Text>
              1. Gold Standard Establishment (All Platforms, nationwide) → activate<br />
              2. Gold Standard Discovery (per platform — the All Platforms profile unlocks it)<br />
              3. Bronze National Establishment (nationwide) → activate<br />
              4. Emerging + Competitive Establishment (Nationwide) → activate — the vocabulary floor that
              unlocks discovery in every city at once<br />
              5. National Enrichment (location + category) → public national narratives on /place and /directory<br />
              6. National Discovery (optional sweep — emerging reasons / competitive weaknesses) →
              city-attributed prospects in the queue<br />
              <Text size="xs" fw={600} c="dimmed" component="div" mt={6}>Then iterate cities — each market adds only its local delta:</Text>
              7. City Establishment (city + category — optional where the national floor suffices) → activate<br />
              8. Bronze City Scan (city + category) → activate the draft city profile<br />
              9. City Discovery (emerging + competitive) → prospect queue<br />
              10. Proving Ground (city + category) → operator workspace aggregating the discovery runs<br />
              11. Business Audit → per prospect<br />
              <Text size="xs" c="dimmed" fs="italic" mt={4}>
                Thin market? Skip competitive — keep gold standard, it&apos;s reusable across cities.
                A national discovery run promotes to a category-scope umbrella PG; per-city deployment
                PGs come from grouping that run&apos;s queue entries by market.
              </Text>
            </Text>
          </Box>
        </Group>
      </Paper>

      {/* ─── Slot state legend ─── */}
      <StateLegend />

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
        const bronzeSlots = cat.slots.filter((s) => s.focus === 'bronze_standards');
        const emergingSlots = cat.slots.filter((s) => s.focus === 'emerging');
        const competitiveSlots = cat.slots.filter((s) => s.focus === 'competitive');
        const provingGroundSlots = cat.slots.filter((s) => s.focus === 'proving_ground');

        const activeCount = cat.slots.filter(s => s.status === 'active').length;
        const draftCount = cat.slots.filter(s => s.status === 'draft').length;
        const inflightCount = cat.slots.filter(s => s.status === 'inflight').length;
        const discoveryInflightCount = cat.slots.filter(s => s.discovery_status === 'inflight').length;
        const executedCount = cat.slots.filter(s => s.discovery_status === 'executed').length;

        // Cities that have emerging, competitive, bronze, or proving-ground
        // profiles for this category.
        const categoryCities = new Set([
          ...emergingSlots.map((s) => s.city).filter(Boolean) as string[],
          ...competitiveSlots.map((s) => s.city).filter(Boolean) as string[],
          ...bronzeSlots.map((s) => s.city).filter(Boolean) as string[],
          ...provingGroundSlots.map((s) => s.city).filter(Boolean) as string[],
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
                <Badge variant="light" color="green" size="xs">{activeCount} active</Badge>
                {draftCount > 0 && (
                  <Badge variant="light" color="yellow" size="xs">{draftCount} draft</Badge>
                )}
                {inflightCount > 0 && (
                  <Badge variant="light" color="blue" size="xs">{inflightCount} in flight</Badge>
                )}
                {discoveryInflightCount > 0 && (
                  <Badge variant="light" color="indigo" size="xs">{discoveryInflightCount} discovery in flight</Badge>
                )}
                {executedCount > 0 && (
                  <Badge variant="light" color="teal" size="xs">{executedCount} executed</Badge>
                )}
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

            {/* Gold Standards section — per platform, nationwide.
                "All Platforms" is the first slot; its establishment profile
                is also the proxy that unlocks per-platform discovery. */}
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

            {/* Bronze Standards — the leading Nationwide column carries the
                stage-1 national profile (establishment only); each city
                column tracks the stage-2 scan below and the city bronze
                profile it produces on top. */}
            <CoverageSection
              title="Bronze Standards (nationwide establishment + per-city scans)"
              focus="bronze_standards"
              slots={bronzeSlots}
              category={cat}
              cityFilter={cityFilter}
              slotStatus={slotStatus}
              createLink={createCampaignLink}
              dimensionKey="city"
              dimensionValues={[NATIONAL_DIM, ...(cityFilter ? [cityFilter] : allCities)]}
              dimensionLabels={NATIONAL_DIMENSION_LABELS}
            />

            {/* Emerging section — national floor + per city */}
            <CoverageSection
              title="Emerging (nationwide floor + per city)"
              focus="emerging"
              slots={emergingSlots}
              category={cat}
              cityFilter={cityFilter}
              slotStatus={slotStatus}
              createLink={createCampaignLink}
              dimensionKey="city"
              dimensionValues={[NATIONAL_DIM, ...(cityFilter ? [cityFilter] : allCities)]}
              dimensionLabels={NATIONAL_DIMENSION_LABELS}
              showAllCitiesHint={!cityFilter}
            />

            {/* Competitive section — national floor + per city */}
            <CoverageSection
              title="Competitive (nationwide floor + per city)"
              focus="competitive"
              slots={competitiveSlots}
              category={cat}
              cityFilter={cityFilter}
              slotStatus={slotStatus}
              createLink={createCampaignLink}
              dimensionKey="city"
              dimensionValues={[NATIONAL_DIM, ...(cityFilter ? [cityFilter] : allCities)]}
              dimensionLabels={NATIONAL_DIMENSION_LABELS}
              showAllCitiesHint={!cityFilter}
            />

            {/* Proving Ground section — per city (operator workspace) */}
            <CoverageSection
              title="Proving Ground (per city — operator workspace)"
              focus="proving_ground"
              slots={provingGroundSlots}
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

// ─── State Legend ────────────────────────────────────────────────────────
// Compact legend for the 7 slot states + the locked discovery chip.

function StateLegend() {
  const items: { n: number; label: string; bg: string; border: string; iconColor: string; icon: React.ReactNode }[] = [
    {
      n: 1, label: 'establishment pending → create campaign',
      bg: 'var(--mantine-color-gray-1)', border: '1px dashed var(--mantine-color-gray-4)',
      iconColor: 'var(--mantine-color-gray-5)', icon: <IconPlus size={12} />,
    },
    {
      n: 2, label: 'establishment in flight → open campaign',
      bg: 'var(--mantine-color-blue-light)', border: '1px solid var(--mantine-color-blue-3)',
      iconColor: 'var(--mantine-color-blue-6)', icon: <IconPlayerPlay size={12} />,
    },
    {
      n: 3, label: 'establishment draft → activate profile',
      bg: 'var(--mantine-color-yellow-light)', border: '1px solid var(--mantine-color-yellow-3)',
      iconColor: 'var(--mantine-color-yellow-6)', icon: <IconCircleDot size={12} />,
    },
    {
      n: 4, label: 'establishment active → discovery unlocked',
      bg: 'var(--mantine-color-green-light)', border: '1px solid var(--mantine-color-green-3)',
      iconColor: 'var(--mantine-color-green-6)', icon: <IconCircleCheck size={12} />,
    },
    {
      n: 5, label: 'discovery pending → create campaign',
      bg: 'var(--mantine-color-gray-1)', border: '1px dashed var(--mantine-color-gray-4)',
      iconColor: 'var(--mantine-color-gray-5)', icon: <IconPlus size={12} />,
    },
    {
      n: 6, label: 'discovery in flight → open campaign',
      bg: 'var(--mantine-color-indigo-light)', border: '1px solid var(--mantine-color-indigo-3)',
      iconColor: 'var(--mantine-color-indigo-6)', icon: <IconPlayerPlay size={12} />,
    },
    {
      n: 7, label: 'discovery executed → open audit',
      bg: 'var(--mantine-color-teal-light)', border: '1px solid var(--mantine-color-teal-3)',
      iconColor: 'var(--mantine-color-teal-6)', icon: <IconListCheck size={12} />,
    },
  ];

  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="xs" align="flex-start">
        <ThemeIcon variant="light" color="grape" size="sm">
          <IconListCheck size={14} />
        </ThemeIcon>
        <Box>
          <Text size="sm" fw={600}>Slot states</Text>
          <Text size="xs" c="dimmed" mt={2}>
            Each position carries two stacked chips — establishment (top) and discovery (bottom).
            Discovery stays locked until establishment is active. Gold standards: the All Platforms
            establishment also unlocks per-platform discovery. Bronze standards: the Nationwide
            profile unlocks every per-city scan. Emerging/competitive: the Nationwide column is the
            national floor — an active national establishment unlocks discovery in every city.
          </Text>
          <Group gap="xs" mt="sm" align="center">
            {items.map((it) => (
              <Tooltip key={it.n} label={it.label} openDelay={0}>
                <Group gap={4} style={{
                  padding: '2px 8px',
                  borderRadius: 5,
                  background: it.bg,
                  border: it.border,
                }}>
                  <span style={{ color: it.iconColor, display: 'flex', alignItems: 'center' }}>{it.icon}</span>
                  <Text size="xs" fw={500}>{it.n}</Text>
                </Group>
              </Tooltip>
            ))}
            <Tooltip label="discovery locked — establishment not active yet" openDelay={0}>
              <Group gap={4} style={{
                padding: '2px 8px',
                borderRadius: 5,
                background: 'var(--mantine-color-gray-0)',
                border: '1px solid var(--mantine-color-gray-3)',
                opacity: 0.65,
              }}>
                <span style={{ color: 'var(--mantine-color-gray-5)', display: 'flex', alignItems: 'center' }}>
                  <IconLock size={12} />
                </span>
                <Text size="xs" c="dimmed">locked</Text>
              </Group>
            </Tooltip>
          </Group>
        </Box>
      </Group>
    </Paper>
  );
}

// ─── Coverage Section ───────────────────────────────────────────────────
// Renders a sub-section for one focus (gold_standards / bronze_standards /
// emerging / competitive / proving_ground). Non-PG focuses render a stacked
// establishment + discovery chip pair per dimension value (platform or
// city); proving ground renders a single workspace chip.

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
  const isPg = focus === 'proving_ground';
  const isBronze = focus === 'bronze_standards';
  const isCityDim = dimensionKey === 'city';

  // Proxy establishment: the national (city-null) establishment profile is a
  // superset of every market — the resolvers cascade city → state →
  // nationwide, so an active national profile unlocks every city's discovery:
  //   - gold: the All Platforms profile unlocks per-platform discovery
  //   - bronze: the Nationwide profile unlocks every per-city scan
  //   - emerging/competitive: the national establishment (from a '__all__'
  //     campaign) unlocks per-city discovery — a city with only the national
  //     floor is NOT a locked gap.
  // A platform-scoped national bronze profile does NOT count — it only backs
  // city scans scoped to that same platform.
  const proxyEstablishmentActive = focus === 'gold_standards'
    // null city required — a market-scoped gold profile does not back a
    // nationwide platform scan (resolveGoldStandard layer 3 is null-city only).
    ? slotStatus(category, 'gold_standards', null, 'all')?.status === 'active'
    : isCityDim
    ? (isBronze
      ? slotStatus(category, 'bronze_standards', null, 'all')?.status === 'active'
      : slotStatus(category, focus, null)?.status === 'active')
    : false;

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
          // The Nationwide sentinel maps to the city=null (national) position
          // rather than to a city named after it — for bronze (stage-1
          // establishment) and for emerging/competitive (national
          // establishment profiles imported from '__all__' campaigns).
          const isNationalColumn = !isPlatform && dimVal === NATIONAL_DIM;
          const city = !isPlatform ? (isNationalColumn ? null : dimVal) : undefined;
          const slot = slotStatus(category, focus, city, platform);
          const label = dimensionLabels?.[dimVal] ?? dimVal;

          if (isPg) {
            return (
              <PgChip
                key={`${focus}-${dimVal}`}
                label={label}
                slot={slot}
                category={category}
                city={city}
              />
            );
          }

          return (
            <SlotPair
              key={`${focus}-${dimVal}`}
              label={label}
              slot={slot}
              focus={focus}
              category={category}
              city={city}
              platform={platform}
              isNational={isNationalColumn}
              proxyEstablishmentActive={proxyEstablishmentActive}
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
    </Box>
  );
}

// ─── Slot Pair (stacked chips) ──────────────────────────────────────────
// A single (category, focus, dimension) position rendered as two stacked
// chips: the establishment chip on top (states 1-4) and the discovery chip
// on the bottom (states 5-7, locked until establishment is active).

interface SlotPairProps {
  label: string;
  slot: CoverageSlot | null;
  focus: IntelligenceFocus;
  category: CoverageCategory;
  city?: string | null;
  platform?: string;
  isNational?: boolean;
  proxyEstablishmentActive: boolean;
  createLink: (params: {
    focus: IntelligenceFocus;
    kind: 'establishment' | 'discovery';
    category?: string;
    city?: string;
    state?: string;
    platform?: string;
  }) => string;
}

function SlotPair({
  label, slot, focus, category, city, platform,
  isNational, proxyEstablishmentActive, createLink,
}: SlotPairProps) {
  // Discovery is unlocked once this position's establishment is active —
  // or once the proxy establishment is active: gold's All Platforms profile,
  // bronze's Nationwide profile, and (for emerging/competitive) the national
  // establishment profile the resolver falls back to for every city.
  const isGold = focus === 'gold_standards';
  const isBronze = focus === 'bronze_standards';
  // A market-scoped gold profile (city set) displays on its platform column
  // but does NOT back a nationwide platform discovery scan — the unlock needs
  // a null-city slot or the All Platforms proxy.
  const slotBacksDiscovery = slot?.status === 'active' &&
    (!isGold || (slot.city ?? null) === null);
  const establishmentActive = slotBacksDiscovery ||
    (isGold && !!platform && platform !== 'all' && proxyEstablishmentActive) ||
    (!isGold && !isNational && proxyEstablishmentActive);

  // The Nationwide column's create links carry the '__all__' sentinel for
  // emerging/competitive — the form's national checkbox reads it back as
  // checked. Bronze's national establishment is geo-free instead (the form
  // hides geo fields for it), so its links stay city-empty — a literal
  // '__all__' would persist as an orphan reference_city.
  const linkCity = isNational && !isBronze ? '__all__' : (city ?? undefined);
  const linkState = isNational && !isBronze ? '__all__' : (slot?.state ?? undefined);

  return (
    <Stack gap={3}>
      <EstablishmentChip
        label={label}
        slot={slot}
        focus={focus}
        category={category}
        city={city}
        linkCity={linkCity}
        linkState={linkState}
        platform={platform}
        proxyEstablishmentActive={proxyEstablishmentActive}
        createLink={createLink}
      />
      {isNational && isBronze ? (
        // Bronze has no national discovery — stage-2 scans are city-scoped.
        <Tooltip label="Bronze discovery runs per city — each city column carries its own scan chip">
          <Group gap={4} style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--mantine-color-gray-0)',
            border: '1px solid var(--mantine-color-gray-3)',
            opacity: 0.65,
          }}>
            <Text size="xs" c="dimmed" fs="italic">per-city scans</Text>
          </Group>
        </Tooltip>
      ) : (
        <DiscoveryChip
          slot={slot}
          focus={focus}
          category={category}
          city={city}
          linkCity={linkCity}
          linkState={linkState}
          platform={platform}
          establishmentActive={establishmentActive}
          isGold={isGold}
          isBronze={isBronze}
          createLink={createLink}
        />
      )}
    </Stack>
  );
}

// ─── Establishment Chip (states 1-4) ──────────────────────────────────────
// pending → create campaign · in flight → open campaign ·
// draft → activate profile · active → discovery unlocked below.

interface EstablishmentChipProps {
  label: string;
  slot: CoverageSlot | null;
  focus: IntelligenceFocus;
  category: CoverageCategory;
  city?: string | null;
  /** Create-link overrides — the Nationwide column passes '__all__'. */
  linkCity?: string;
  linkState?: string;
  platform?: string;
  proxyEstablishmentActive: boolean;
  createLink: (params: {
    focus: IntelligenceFocus;
    kind: 'establishment' | 'discovery';
    category?: string;
    city?: string;
    state?: string;
    platform?: string;
  }) => string;
}

function EstablishmentChip({
  label, slot, focus, category, city, linkCity, linkState, platform, proxyEstablishmentActive, createLink,
}: EstablishmentChipProps) {
  // State 1 — pending: no campaign, no profile. Click creates the
  // establishment campaign for this position.
  if (!slot || slot.status === 'pending') {
    // Bronze city positions have no establishment campaign — the city
    // bronze profile is produced by the stage-2 discovery scan. Locked
    // until the Nationwide profile is active; then the chip opens the
    // city-scan create form (the same target as the discovery chip below).
    if (focus === 'bronze_standards' && city != null) {
      if (!proxyEstablishmentActive) {
        return (
          <Tooltip label="City bronze profile — activate the Nationwide bronze profile first">
            <Group gap={4} style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'var(--mantine-color-gray-0)',
              border: '1px solid var(--mantine-color-gray-3)',
              opacity: 0.65,
              cursor: 'default',
            }}>
              <IconLock size={14} color="var(--mantine-color-gray-5)" />
              <Text size="xs" c="dimmed">{label}</Text>
            </Group>
          </Tooltip>
        );
      }
      return (
        <Link href={createLink({
          focus, kind: 'discovery',
          category: category.category_name,
          city: linkCity ?? city ?? undefined, state: linkState ?? slot?.state ?? undefined, platform,
        })}>
          <Tooltip label="No city bronze profile yet — produced by the city scan. Click to create the scan campaign">
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
    return (
      <Link href={createLink({
        focus, kind: 'establishment',
        category: category.category_name,
        city: linkCity ?? city ?? undefined, state: linkState ?? slot?.state ?? undefined, platform,
      })}>
        <Tooltip label={`1 · Establishment pending — click to create the campaign`}>
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

  // State 2 — in flight: establishment campaign underway, no profile yet.
  // Click opens the campaign instead of creating a duplicate (the
  // structural-duplicate guardrail would 409).
  if (slot.status === 'inflight') {
    return (
      <Link href={CAMPAIGN_URL(slot.profile_id)}>
        <Tooltip label="2 · Establishment campaign in flight — click to open it">
          <Group gap={4} style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--mantine-color-blue-light)',
            border: '1px solid var(--mantine-color-blue-3)',
            cursor: 'pointer',
          }}>
            <IconPlayerPlay size={14} color="var(--mantine-color-blue-6)" />
            <Text size="xs" fw={500}>{label}</Text>
          </Group>
        </Tooltip>
      </Link>
    );
  }

  // State 3 — draft: profile drafted but not activated. Click goes to the
  // profiles workspace to review + activate.
  if (slot.status === 'draft') {
    return (
      <Link href={PROFILES_URL}>
        <Tooltip label={`3 · Draft v${slot.version} — click to review & activate the profile`}>
          <Group gap={4} style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--mantine-color-yellow-light)',
            border: '1px solid var(--mantine-color-yellow-3)',
            cursor: 'pointer',
          }}>
            <IconCircleDot size={14} color="var(--mantine-color-yellow-6)" />
            <Text size="xs" fw={500}>{label}</Text>
            <Text size="xs" c="dimmed">(draft)</Text>
          </Group>
        </Tooltip>
      </Link>
    );
  }

  // State 4 — active: establishment complete; the next step is the
  // discovery chip below (it unlocks with this state).
  return (
    <Link href={PROFILES_URL}>
      <Tooltip label={`4 · Establishment active (v${slot.version}) — discovery unlocked below. Click to view the profile.`}>
        <Group gap={4} style={{
          padding: '4px 10px',
          borderRadius: 6,
          background: 'var(--mantine-color-green-light)',
          border: '1px solid var(--mantine-color-green-3)',
          cursor: 'pointer',
        }}>
          <IconCircleCheck size={14} color="var(--mantine-color-green-6)" />
          <Text size="xs" fw={500}>{label}</Text>
        </Group>
      </Tooltip>
    </Link>
  );
}

// ─── Discovery Chip (states 5-7 + locked) ────────────────────────────────
// locked → activate establishment first · pending → create campaign ·
// in flight → open campaign · executed → open audit.

interface DiscoveryChipProps {
  slot: CoverageSlot | null;
  focus: IntelligenceFocus;
  category: CoverageCategory;
  city?: string | null;
  /** Create-link overrides — the Nationwide column passes '__all__'. */
  linkCity?: string;
  linkState?: string;
  platform?: string;
  establishmentActive: boolean;
  isGold: boolean;
  isBronze: boolean;
  createLink: (params: {
    focus: IntelligenceFocus;
    kind: 'establishment' | 'discovery';
    category?: string;
    city?: string;
    state?: string;
    platform?: string;
  }) => string;
}

function DiscoveryChip({
  slot, focus, category, city, linkCity, linkState, platform,
  establishmentActive, isGold, isBronze, createLink,
}: DiscoveryChipProps) {
  // Locked — establishment not active for this position. For gold standards
  // the All Platforms establishment is a proxy, so a specific platform also
  // locks when neither its own nor the All Platforms establishment is
  // active; bronze's proxy is the Nationwide profile.
  if (!establishmentActive) {
    const lockHint = isBronze
      ? 'Scan locked — activate the Nationwide bronze profile first'
      : isGold && !!platform && platform !== 'all'
      ? 'Discovery locked — activate this platform\'s establishment or the All Platforms establishment first'
      : 'Discovery locked — activate this city\'s establishment profile or the Nationwide one first';
    return (
      <Tooltip label={lockHint}>
        <Group gap={4} style={{
          padding: '4px 10px',
          borderRadius: 6,
          background: 'var(--mantine-color-gray-0)',
          border: '1px solid var(--mantine-color-gray-3)',
          opacity: 0.65,
          cursor: 'default',
        }}>
          <IconLock size={14} color="var(--mantine-color-gray-5)" />
          <Text size="xs" c="dimmed">Discovery</Text>
        </Group>
      </Tooltip>
    );
  }

  // State 5 — pending: establishment active, no discovery campaign yet.
  // Click creates the discovery campaign for this position.
  if (!slot || slot.discovery_status === 'pending') {
    return (
      <Link href={createLink({
        focus, kind: 'discovery',
        category: category.category_name,
        city: linkCity ?? city ?? undefined, state: linkState ?? slot?.state ?? undefined, platform,
      })}>
        <Tooltip label="5 · Discovery pending — click to create the campaign">
          <Group gap={4} style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--mantine-color-gray-1)',
            border: '1px dashed var(--mantine-color-gray-4)',
            cursor: 'pointer',
          }}>
            <IconPlus size={14} color="var(--mantine-color-gray-5)" />
            <Text size="xs" c="dimmed">Discovery</Text>
          </Group>
        </Tooltip>
      </Link>
    );
  }

  // State 6 — in flight: discovery campaign underway, not yet executed.
  if (slot.discovery_status === 'inflight') {
    return (
      <Link href={CAMPAIGN_URL(slot.discovery_campaign_id!)}>
        <Tooltip label="6 · Discovery campaign in flight — click to open it">
          <Group gap={4} style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--mantine-color-indigo-light)',
            border: '1px solid var(--mantine-color-indigo-3)',
            cursor: 'pointer',
          }}>
            <IconPlayerPlay size={14} color="var(--mantine-color-indigo-6)" />
            <Text size="xs" fw={500}>Discovery</Text>
          </Group>
        </Tooltip>
      </Link>
    );
  }

  // State 7 — executed: discovery has a completed execution and/or an
  // imported audit. Click opens the campaign's Audits tab — except bronze,
  // whose scans produce a draft city profile (no audit row), so it opens
  // the profiles workspace where that draft awaits activation.
  return (
    <Link href={isBronze ? PROFILES_URL : CAMPAIGN_AUDITS_URL(slot.discovery_campaign_id!)}>
      <Tooltip label={isBronze
        ? '7 · City scan executed — draft profile imported; click to review & activate it'
        : '7 · Discovery executed — click to open the audit'}>
        <Group gap={4} style={{
          padding: '4px 10px',
          borderRadius: 6,
          background: 'var(--mantine-color-teal-light)',
          border: '1px solid var(--mantine-color-teal-3)',
          cursor: 'pointer',
        }}>
          <IconListCheck size={14} color="var(--mantine-color-teal-6)" />
          <Text size="xs" fw={500}>Discovery</Text>
        </Group>
      </Tooltip>
    </Link>
  );
}

// ─── Proving Ground Chip ─────────────────────────────────────────────────
// PG slots point at campaign rows, not intelligence profiles. Active → the
// PG cockpit; missing → the new-campaign form pre-filled for a city-scope
// proving_ground campaign (spec §4.1).

interface PgChipProps {
  label: string;
  slot: CoverageSlot | null;
  category: CoverageCategory;
  city?: string | null;
}

function PgChip({ label, slot, category, city }: PgChipProps) {
  const pgCockpitLink = slot ? `/settings/admin/marketing-ops/proving-grounds/${slot.profile_id}` : '';
  const pgCreateLink = () => {
    const sp = new URLSearchParams();
    sp.set('scope', 'city');
    sp.set('campaignCategory', 'proving_ground');
    sp.set('category', category.category_name);
    if (city) sp.set('city', city);
    return `/settings/admin/marketing-ops/campaigns/new?${sp.toString()}`;
  };

  if (slot) {
    return (
      <Link href={pgCockpitLink}>
        <Tooltip label="Proving ground active — open cockpit">
          <Group gap={4} style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--mantine-color-green-light)',
            border: '1px solid var(--mantine-color-green-3)',
            cursor: 'pointer',
          }}>
            <IconCircleCheck size={14} color="var(--mantine-color-green-6)" />
            <Text size="xs" fw={500}>{label}</Text>
          </Group>
        </Tooltip>
      </Link>
    );
  }

  return (
    <Link href={pgCreateLink()}>
      <Tooltip label={`No proving ground for ${city ?? 'this city'} — click to create`}>
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
