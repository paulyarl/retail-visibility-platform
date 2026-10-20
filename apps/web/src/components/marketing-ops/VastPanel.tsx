'use client';

/**
 * VastPanel — the PG cockpit's VAST board for PG-scope queued prospects.
 *
 * VAST = Verification → Awareness → Show → Tell. The campaign detail page's
 * Project Plan → Execution tab covers campaign-backed prospects; PG prospects
 * are pre-campaign, so this is their act-position board. It reuses the same
 * `SeedCascadeService` derivation as the seed cascade page, batched for the
 * proving ground.
 *
 * Unseeded prospects are shown as "Promote to listings" rather than as a
 * false negative — VAST starts once the place listing exists.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import marketingOpsService, {
  type ProspectQueueEntry,
} from '@/services/MarketingOpsService';
import directoryPresenceAdminService, {
  type CascadeActStatus,
  type SeedCascadeSummary,
} from '@/services/DirectoryPresenceAdminService';
import ProspectTouchLogModal from './ProspectTouchLogModal';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';

export interface VastRow {
  entryId: string;
  seedId: string | null;
  campaignId: string | null;
  businessName: string | null;
  status: string;
  seedStatus: string | null;
  v: CascadeActStatus | null;
  a: CascadeActStatus | null;
  s: CascadeActStatus | null;
  t: CascadeActStatus | null;
  nextAction: string;
}

export interface VastCounts {
  total: number;
  seeded: number;
  v: number;
  a: number;
  s: number;
  t: number;
}

export function buildVastRow(
  entry: ProspectQueueEntry,
  summary: SeedCascadeSummary | null,
  campaignId: string | null = entry.processed_campaign_id ?? null,
): VastRow {
  const seedId = entry.seed_id ?? null;
  const acts = summary?.acts ?? [];
  const v = seedId ? acts[0]?.status ?? null : null;
  const a = seedId ? acts[1]?.status ?? null : null;
  const s = seedId ? acts[2]?.status ?? null : null;
  const t = seedId ? acts[3]?.status ?? null : null;

  let nextAction = 'Complete';
  if (!seedId) nextAction = 'Promote to listings';
  else if (v !== 'done') nextAction = 'Log announce / verify';
  else if (a !== 'done') nextAction = 'Send act-2 postcard';
  else if (s !== 'done') nextAction = 'Send gallery email';
  else if (t !== 'done') nextAction = 'Schedule walk-in';

  return {
    entryId: entry.id,
    seedId,
    campaignId,
    businessName: entry.business_name ?? entry.title ?? null,
    status: entry.status,
    seedStatus: summary?.seedStatus ?? null,
    v,
    a,
    s,
    t,
    nextAction,
  };
}

export function countVast(rows: VastRow[]): VastCounts {
  return {
    total: rows.length,
    seeded: rows.filter((r) => !!r.seedId).length,
    v: rows.filter((r) => r.v === 'done').length,
    a: rows.filter((r) => r.a === 'done').length,
    s: rows.filter((r) => r.s === 'done').length,
    t: rows.filter((r) => r.t === 'done').length,
  };
}

const CHIP_STYLES: Record<CascadeActStatus, string> = {
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  not_started: 'bg-gray-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function ActChip({ letter, status }: { letter: string; status: CascadeActStatus | null }) {
  if (!status) {
    return (
      <span
        title="Not seeded"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-300 dark:bg-neutral-700 dark:text-gray-500"
      >
        {letter}
      </span>
    );
  }
  return (
    <span
      title={status.replace(/_/g, ' ')}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${CHIP_STYLES[status]}`}
    >
      {letter}
    </span>
  );
}

function VastActions({
  row,
  onLogAnnounce,
  align = 'end',
}: {
  row: VastRow;
  onLogAnnounce: (row: VastRow) => void;
  align?: 'start' | 'end';
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        align === 'end' ? 'justify-end' : 'justify-start'
      }`}
    >
      <button
        type="button"
        onClick={() => onLogAnnounce(row)}
        disabled={!row.seedId}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700"
      >
        Log announce
      </button>
      {row.campaignId && (
        <Link
          href={`/settings/admin/marketing-ops/campaigns/${row.campaignId}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Campaign
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
      {row.seedId && (
        <>
          <Link
            href={`/settings/admin/directory/presence-seeds/${row.seedId}`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Seed
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href={`/settings/admin/directory/presence-seeds/${row.seedId}/cascade`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Cascade
            <ExternalLink className="h-3 w-3" />
          </Link>
        </>
      )}
    </div>
  );
}

export interface VastBoardProps {
  rows: VastRow[];
  onLogAnnounce: (row: VastRow) => void;
}

export function VastBoard({ rows, onLogAnnounce }: VastBoardProps) {
  const counts = countVast(rows);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-400">
        No PG prospects yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {counts.seeded === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          No prospects have been promoted to listings yet. VAST starts after a prospect is
          seeded and published — use <span className="font-semibold">Promote to listings</span> first.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { letter: 'V', label: 'Verification', value: counts.v },
          { letter: 'A', label: 'Awareness', value: counts.a },
          { letter: 'S', label: 'Show', value: counts.s },
          { letter: 'T', label: 'Tell', value: counts.t },
        ].map((card) => (
          <div
            key={card.letter}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">{card.letter}</span> · {card.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {card.value}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {counts.seeded > 0
                ? `of ${counts.seeded} seeded`
                : `of ${counts.total} prospects — none seeded yet`}
            </p>
          </div>
        ))}
      </div>

      {/* Small screens: card layout. The table needs ~8 columns; below md it
          clipped the actions and forced horizontal scrolling. */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={row.entryId}
            className="rounded-lg border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900 dark:text-white">
                  {row.businessName || 'Untitled prospect'}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {row.status} ·{' '}
                  {row.seedId
                    ? row.seedStatus || 'seeded'
                    : row.campaignId
                      ? 'No seed (campaign)'
                      : 'Not seeded'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ActChip letter="V" status={row.v} />
                <ActChip letter="A" status={row.a} />
                <ActChip letter="S" status={row.s} />
                <ActChip letter="T" status={row.t} />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">
              Next: {row.nextAction}
            </p>
            <div className="mt-2">
              <VastActions row={row} onLogAnnounce={onLogAnnounce} align="start" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block dark:border-neutral-700 dark:bg-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-neutral-900 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">Prospect</th>
              <th className="px-3 py-3">Seed</th>
              <th className="px-3 py-3 text-center">V</th>
              <th className="px-3 py-3 text-center">A</th>
              <th className="px-3 py-3 text-center">S</th>
              <th className="px-3 py-3 text-center">T</th>
              <th className="px-4 py-3">Next action</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
            {rows.map((row) => (
              <tr key={row.entryId} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {row.businessName || 'Untitled prospect'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{row.status}</p>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300">
                  {row.seedId
                    ? row.seedStatus || 'seeded'
                    : row.campaignId
                      ? 'No seed (campaign)'
                      : 'Not seeded'}
                </td>
                <td className="px-3 py-3 text-center"><ActChip letter="V" status={row.v} /></td>
                <td className="px-3 py-3 text-center"><ActChip letter="A" status={row.a} /></td>
                <td className="px-3 py-3 text-center"><ActChip letter="S" status={row.s} /></td>
                <td className="px-3 py-3 text-center"><ActChip letter="T" status={row.t} /></td>
                <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">{row.nextAction}</td>
                <td className="px-4 py-3">
                  <VastActions row={row} onLogAnnounce={onLogAnnounce} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function VastPanel({
  entries,
  onChanged,
}: {
  entries: ProspectQueueEntry[];
  onChanged?: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<VastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logEntry, setLogEntry] = useState<ProspectQueueEntry | null>(null);

  const seedKey = useMemo(
    () =>
      entries
        .map((e) => `${e.id}:${e.seed_id ?? ''}:${e.processed_campaign_id ?? ''}`)
        .join('|'),
    [entries],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const seedIds = entries.map((e) => e.seed_id).filter(Boolean) as string[];
      // campaign_created rows may have their seed linked through the campaign
      // (directory_seed_campaign_links) rather than stamped on the queue row.
      const campaignIds = entries
        .filter((e) => !e.seed_id && !!e.processed_campaign_id)
        .map((e) => e.processed_campaign_id as string);
      const [seedSummaries, campaignCascades] = await Promise.all([
        directoryPresenceAdminService.getSeedCascadeBatch(seedIds),
        marketingOpsService.getCampaignCascadeBatch(campaignIds),
      ]);
      setRows(
        entries.map((entry) => {
          const campaign = !entry.seed_id && entry.processed_campaign_id
            ? campaignCascades[entry.processed_campaign_id] ?? null
            : null;
          const resolvedSeedId = entry.seed_id ?? campaign?.seedId ?? null;
          const summary = entry.seed_id
            ? seedSummaries[entry.seed_id] ?? null
            : campaign?.cascade ?? null;
          return buildVastRow(
            { ...entry, seed_id: resolvedSeedId },
            summary,
            entry.processed_campaign_id ?? null,
          );
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the VAST board');
    } finally {
      setLoading(false);
    }
  }, [entries]);

  useEffect(() => {
    load();
  }, [load, seedKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading VAST…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        <button type="button" onClick={load} className="ml-2 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Verification → Awareness → Show → Tell. Unseeded prospects start after they are promoted to listings.
        </p>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-gray-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <VastBoard
        rows={rows}
        onLogAnnounce={(row) => {
          const entry = entries.find((e) => e.id === row.entryId) ?? null;
          setLogEntry(entry ? { ...entry, seed_id: row.seedId } : null);
        }}
      />

      {logEntry && (
        <ProspectTouchLogModal
          entry={logEntry}
          seedId={logEntry.seed_id ?? undefined}
          onClose={() => setLogEntry(null)}
          onLogged={async () => {
            setLogEntry(null);
            await load();
            await onChanged?.();
          }}
        />
      )}
    </div>
  );
}
