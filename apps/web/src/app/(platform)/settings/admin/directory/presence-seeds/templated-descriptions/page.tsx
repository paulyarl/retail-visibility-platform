'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { MarketingOpsNavShell } from '@/components/marketing-ops/MarketingOpsPageShell';
import directoryPresenceAdminService, {
  type SeedBatchSummary,
  type TemplatedDescriptionSeed,
  type TemplatedSeedCampaign,
} from '@/services/DirectoryPresenceAdminService';
import { seedBatchDisplayLabel } from '@/lib/seed-batch-label';
import {
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  FileText,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300',
  published: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  invited: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const SOURCE_LABELS: Record<string, string> = {
  seed_seo_composer: 'composer template',
  market_enrichment: 'market sweep template',
  linked_campaign: 'campaign template',
  intelligence_profile: 'profile template',
};

function sourceLabel(source: string | null): string {
  if (!source) return 'no provenance';
  return SOURCE_LABELS[source] ?? 'template-shaped';
}

/** Triage state for a templated seed — drives the enrichment-state filter. */
function enrichmentState(seed: TemplatedDescriptionSeed): 'needs_campaign' | 'awaiting_audit' | 'has_audit' {
  const primaryBusiness = seed.campaigns.find(
    (c) => (c.scope ?? 'business') === 'business' && c.linkRole === 'primary',
  );
  if (primaryBusiness?.hasRealAudit) return 'has_audit';
  if (primaryBusiness) return 'awaiting_audit';
  return 'needs_campaign';
}

export default function TemplatedDescriptionsPage() {
  return (
    <MarketingOpsNavShell>
      <TemplatedDescriptionsContent />
    </MarketingOpsNavShell>
  );
}

function TemplatedDescriptionsContent() {
  const [seeds, setSeeds] = useState<TemplatedDescriptionSeed[]>([]);
  const [optionSeeds, setOptionSeeds] = useState<TemplatedDescriptionSeed[]>([]);
  const [batchOptions, setBatchOptions] = useState<SeedBatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterPg, setFilterPg] = useState('');
  const [filterEnrich, setFilterEnrich] = useState('');
  const [busySeedId, setBusySeedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [spawned, setSpawned] = useState<Record<string, { id: string; displayId?: string | null }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchSeeds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await directoryPresenceAdminService.listTemplatedDescriptionSeeds({
        city: filterCity || undefined,
        state: filterState || undefined,
        category: filterCategory || undefined,
        status: filterStatus || undefined,
        seedBatch: filterBatch || undefined,
        pgCampaignId: filterPg || undefined,
      });
      setSeeds(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templated seeds');
    } finally {
      setLoading(false);
    }
  }, [filterCity, filterState, filterCategory, filterStatus, filterBatch, filterPg]);

  useEffect(() => {
    fetchSeeds();
  }, [fetchSeeds]);

  // Unfiltered fetch once, purely to populate the filter dropdowns — the same
  // pattern the seeds page uses for batch options so a picked filter can't
  // collapse its own option set.
  useEffect(() => {
    let cancelled = false;
    directoryPresenceAdminService
      .listTemplatedDescriptionSeeds()
      .then((list) => {
        if (!cancelled) setOptionSeeds(list);
      })
      .catch(() => {
        if (!cancelled) setOptionSeeds([]);
      });
    // Market (seed-batch) + proving-ground dropdown options come from the
    // batch rollup — it carries the cohort labels and the PG attribution.
    directoryPresenceAdminService
      .listSeedBatches()
      .then((list) => {
        if (!cancelled) setBatchOptions(list);
      })
      .catch(() => {
        if (!cancelled) setBatchOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cityOptions = useMemo(
    () => Array.from(new Set(optionSeeds.map((s) => s.city).filter(Boolean))).sort(),
    [optionSeeds],
  );
  const stateOptions = useMemo(
    () => Array.from(new Set(optionSeeds.map((s) => s.state).filter(Boolean))).sort(),
    [optionSeeds],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(optionSeeds.map((s) => s.category).filter(Boolean))).sort(),
    [optionSeeds],
  );
  // Unique proving grounds across every batch — label with the PG display id
  // plus the market its batches cover so "MC-1042" reads as "MC-1042 · Indy".
  const pgOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of batchOptions) {
      for (const pg of b.provingGrounds ?? []) {
        if (!map.has(pg.id)) {
          map.set(pg.id, [pg.displayId || pg.id, b.topCity].filter(Boolean).join(' · '));
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [batchOptions]);

  const visibleSeeds = useMemo(() => {
    if (!filterEnrich) return seeds;
    return seeds.filter((s) => enrichmentState(s) === filterEnrich);
  }, [seeds, filterEnrich]);

  // Only seeds with no business-scope campaign are bulk-spawnable — rows
  // that already have one act through their own buttons instead.
  const selectableIds = useMemo(
    () =>
      visibleSeeds
        .filter((s) => !s.campaigns.some((c) => (c.scope ?? 'business') === 'business'))
        .map((s) => s.id),
    [visibleSeeds],
  );

  const spawnOne = async (seed: TemplatedDescriptionSeed) => {
    const result = await directoryPresenceAdminService.spawnCampaignFromSeed(seed.id, {
      notes: `Spawned from the templated-descriptions worklist to run a business_analysis audit and enrich the listing copy.`,
    });
    setSpawned((prev) => ({
      ...prev,
      [seed.id]: { id: result.campaign.id, displayId: result.campaign.display_id },
    }));
    return result;
  };

  const handleSpawn = async (seed: TemplatedDescriptionSeed) => {
    setBusySeedId(seed.id);
    setNotice(null);
    setRowError((prev) => ({ ...prev, [seed.id]: '' }));
    try {
      const result = await spawnOne(seed);
      setNotice(
        `Campaign ${result.campaign.display_id || result.campaign.id} created for "${seed.businessName}" — run the business analysis audit there to enrich the listing.`,
      );
      fetchSeeds();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [seed.id]: err instanceof Error ? err.message : 'Failed to spawn campaign',
      }));
    } finally {
      setBusySeedId(null);
    }
  };

  const handleSpawnSelected = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setNotice(null);
    const succeeded: string[] = [];
    const failed: Array<{ seed: TemplatedDescriptionSeed; message: string }> = [];
    // Sequential — structural-duplicate conflicts and link supersession are
    // per-seed, and a burst of parallel creates would only multiply the
    // campaigns to reconcile when one fails.
    for (const seedId of selected) {
      const seed = seeds.find((s) => s.id === seedId);
      if (!seed) continue;
      try {
        await spawnOne(seed);
        succeeded.push(seedId);
      } catch (err) {
        failed.push({
          seed,
          message: err instanceof Error ? err.message : 'Failed to spawn campaign',
        });
      }
    }
    setRowError((prev) => {
      const next = { ...prev };
      for (const id of succeeded) next[id] = '';
      for (const f of failed) next[f.seed.id] = f.message;
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of succeeded) next.delete(id);
      return next;
    });
    setNotice(
      failed.length === 0
        ? `Spawned ${succeeded.length} campaign${succeeded.length === 1 ? '' : 's'} — run the business analysis audits to enrich the listings.`
        : `Spawned ${succeeded.length}; ${failed.length} failed — see the row errors.`,
    );
    fetchSeeds();
    setBulkBusy(false);
  };

  const handleToggle = (seedId: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(seedId);
      else next.delete(seedId);
      return next;
    });
  };

  const handleMakeAuditTarget = async (seed: TemplatedDescriptionSeed, campaign: TemplatedSeedCampaign) => {
    setBusySeedId(seed.id);
    setNotice(null);
    setRowError((prev) => ({ ...prev, [seed.id]: '' }));
    try {
      // Re-pointing the primary link at the business campaign demotes the
      // scan/PG incumbent to sibling — the post-audit resharpen only reaches
      // seeds primary-linked to the audited campaign.
      await directoryPresenceAdminService.linkCampaign(seed.id, campaign.id, 'primary');
      setNotice(`"${seed.businessName}" now resolves to ${campaign.displayId || campaign.id} — audit it to enrich the listing.`);
      fetchSeeds();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [seed.id]: err instanceof Error ? err.message : 'Failed to re-link campaign',
      }));
    } finally {
      setBusySeedId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templated Descriptions"
        description="Live seeds still showing the composer template as their public description. Spawn a business-scope campaign, run the business analysis audit on it, and the post-audit sharpen writes the enriched description, keywords and same_as onto the listing."
        icon={<FileText className="w-6 h-6" />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/settings/admin/directory/presence-seeds"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-neutral-800 dark:border-neutral-600 dark:text-gray-300"
            >
              <ArrowLeft className="w-4 h-4" />
              All seeds
            </Link>
            <button
              type="button"
              onClick={fetchSeeds}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:bg-neutral-800 dark:border-neutral-600 dark:text-gray-300"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm dark:bg-green-950/30 dark:border-green-900 dark:text-green-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm dark:bg-red-950/30 dark:border-red-900 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterBatch}
          onChange={(e) => setFilterBatch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        >
          <option value="">All markets / batches</option>
          {batchOptions.map((b) => (
            <option key={b.seedBatch} value={b.seedBatch}>
              {seedBatchDisplayLabel(b)}
            </option>
          ))}
        </select>
        <select
          value={filterPg}
          onChange={(e) => setFilterPg(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        >
          <option value="">All proving grounds</option>
          {pgOptions.map((pg) => (
            <option key={pg.id} value={pg.id}>{pg.label}</option>
          ))}
        </select>
        <select
          value={filterEnrich}
          onChange={(e) => setFilterEnrich(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        >
          <option value="">Any enrichment state</option>
          <option value="needs_campaign">needs campaign</option>
          <option value="awaiting_audit">campaign ready — awaiting audit</option>
          <option value="has_audit">audit on file</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        >
          <option value="">All live statuses</option>
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="invited">invited</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        >
          <option value="">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        >
          <option value="">All cities</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        >
          <option value="">All states</option>
          {stateOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {loading
            ? 'Loading…'
            : `${visibleSeeds.length} seed${visibleSeeds.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* Seed list */}
      {!loading && visibleSeeds.length === 0 && !error && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-6 py-10 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <Sparkles className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {seeds.length === 0
              ? 'No templated descriptions — every live seed carries enriched or human-authored copy.'
              : 'No templated seeds match these filters.'}
          </p>
        </div>
      )}

      {/* Bulk spawn — only seeds with no business-scope campaign at all are
          selectable; rows that already have one use their own actions. */}
      {selectableIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900/40">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set(selectableIds) : new Set())
              }
            />
            Select all needing a campaign ({selectableIds.length})
          </label>
          <button
            type="button"
            disabled={bulkBusy || selected.size === 0}
            onClick={handleSpawnSelected}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {bulkBusy ? 'Spawning…' : `Spawn selected (${selected.size})`}
          </button>
          {selected.size > 0 && !bulkBusy && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-500 underline decoration-dotted hover:text-gray-700 dark:text-gray-400"
            >
              Clear selection
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {visibleSeeds.map((seed) => (
          <TemplatedSeedCard
            key={seed.id}
            seed={seed}
            busy={busySeedId === seed.id || bulkBusy}
            rowError={rowError[seed.id]}
            spawned={spawned[seed.id]}
            selected={selected.has(seed.id)}
            onToggle={(on) => handleToggle(seed.id, on)}
            onSpawn={() => handleSpawn(seed)}
            onMakeAuditTarget={(campaign) => handleMakeAuditTarget(seed, campaign)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplatedSeedCard({
  seed,
  busy,
  rowError,
  spawned,
  selected,
  onToggle,
  onSpawn,
  onMakeAuditTarget,
}: {
  seed: TemplatedDescriptionSeed;
  busy: boolean;
  rowError?: string;
  spawned?: { id: string; displayId?: string | null };
  selected?: boolean;
  onToggle?: (on: boolean) => void;
  onSpawn: () => void;
  onMakeAuditTarget: (campaign: TemplatedSeedCampaign) => void;
}) {
  const businessCampaigns = seed.campaigns.filter(
    (c) => (c.scope ?? 'business') === 'business',
  );
  const primaryBusiness = businessCampaigns.find((c) => c.linkRole === 'primary') ?? null;
  const siblingBusiness = businessCampaigns.filter((c) => c.linkRole !== 'primary');
  const needsSpawn = businessCampaigns.length === 0 && !spawned;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex flex-wrap items-center gap-2">
        {needsSpawn && (
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0"
            checked={!!selected}
            disabled={busy}
            onChange={(e) => onToggle?.(e.target.checked)}
            title="Select for bulk spawn"
          />
        )}
        <Link
          href={`/settings/admin/directory/presence-seeds/${seed.id}`}
          className="font-medium text-blue-700 hover:underline dark:text-blue-400"
        >
          {seed.businessName || seed.id}
        </Link>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${STATUS_COLORS[seed.status] ?? STATUS_COLORS.draft}`}
        >
          {seed.status}
        </span>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          {sourceLabel(seed.descriptionSource)}
        </span>
        {seed.slug && (
          <Link
            href={`/place/${seed.slug}`}
            target="_blank"
            className="inline-flex items-center gap-0.5 text-xs text-gray-500 hover:text-blue-600"
          >
            <ExternalLink className="h-3 w-3" /> public
          </Link>
        )}
      </div>

      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {seed.category || '—'} · {seed.city || '—'}, {seed.state || '—'} ·{' '}
        {seedBatchDisplayLabel({
          seedBatch: seed.seedBatch,
          createdAt: seed.createdAt,
          category: seed.category,
          place: [seed.city, seed.state].filter(Boolean).join(', ') || null,
        }) || 'no batch'}
      </div>

      <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs italic text-gray-600 dark:bg-neutral-900/60 dark:text-gray-400">
        “{seed.description && seed.description.length > 220
          ? `${seed.description.slice(0, 220)}…`
          : seed.description}”
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {seed.campaigns.map((c) => (
          <Link
            key={c.id}
            href={`/settings/admin/marketing-ops/campaigns/${c.id}`}
            className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"
            title={`${c.scope ?? 'business'} · ${c.linkRole}${c.stage ? ` · ${c.stage}` : ''}`}
          >
            <ArrowUpRight className="h-3 w-3" />
            {c.displayId || c.id}
            {c.linkRole === 'primary' && <span className="text-indigo-400">·primary</span>}
            {c.hasRealAudit && <span className="text-emerald-600">·audited</span>}
          </Link>
        ))}

        {primaryBusiness && !primaryBusiness.hasRealAudit && (
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            audit campaign ready — run the business analysis on it
          </span>
        )}
        {primaryBusiness?.hasRealAudit && (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            audit on file — re-run for a narrative, or edit fields on the seed
          </span>
        )}

        {!primaryBusiness && siblingBusiness.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={busy}
            onClick={() => onMakeAuditTarget(c)}
            title="Re-point the seed's primary link at this business campaign so its audit enrichments reach the listing (the scan incumbent demotes to sibling)"
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Audit via {c.displayId || c.id}
          </button>
        ))}

        {spawned ? (
          <Link
            href={`/settings/admin/marketing-ops/campaigns/${spawned.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Open {spawned.displayId || 'campaign'} — run the audit
          </Link>
        ) : (
          needsSpawn && (
            <button
              type="button"
              disabled={busy}
              onClick={onSpawn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {busy ? 'Spawning…' : 'Spawn audit campaign'}
            </button>
          )
        )}

        {rowError && <span className="text-xs text-red-600 dark:text-red-400">{rowError}</span>}
      </div>
    </div>
  );
}
