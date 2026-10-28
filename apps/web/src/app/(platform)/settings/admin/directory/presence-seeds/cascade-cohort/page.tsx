'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { MarketingOpsNavShell } from '@/components/marketing-ops/MarketingOpsPageShell';
import directoryPresenceAdminService, {
  type CascadeCohortSummary,
  type SeedBatchSummary,
} from '@/services/DirectoryPresenceAdminService';
import { seedBatchDisplayLabel } from '@/lib/seed-batch-label';
import { ArrowLeft, BarChart3, CheckCircle2, Circle, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function Flag({ on }: { on: boolean }) {
  return on ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  ) : (
    <Circle className="h-4 w-4 text-gray-300" />
  );
}

function CohortContent() {
  const [seedBatch, setSeedBatch] = useState('');
  const [batches, setBatches] = useState<SeedBatchSummary[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [summary, setSummary] = useState<CascadeCohortSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!seedBatch.trim()) {
      setError('Select a seed batch to load the cohort.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await directoryPresenceAdminService.getCascadeCohort({
        seedBatch: seedBatch.trim(),
      });
      if (!result) {
        setError('Could not load the cohort.');
      } else {
        setSummary(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the cohort.');
    } finally {
      setLoading(false);
    }
  }, [seedBatch]);

  // The cohort is seed-batch scoped. Discover the batches and auto-load the
  // most recent one so the page is useful on first visit; the operator can
  // switch batches without guessing a name.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await directoryPresenceAdminService.listSeedBatches();
        if (cancelled) return;
        setBatches(list);
        if (list.length > 0) {
          setSeedBatch((current) => current || list[0].seedBatch);
        }
      } catch {
        if (!cancelled) setBatches([]);
      } finally {
        if (!cancelled) setBatchesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (seedBatch) load();
  }, [seedBatch, load]);

  const totals = summary?.totals;
  const rates = summary?.rates;

  const cards = totals
    ? [
        { label: 'Seeds', value: totals.seeds, rate: null as number | null },
        { label: 'Act 1 verified', value: totals.act1Verified, rate: rates?.act1Verified ?? 0 },
        { label: 'Act 2 aware', value: totals.act2Aware, rate: rates?.act2Aware ?? 0 },
        { label: 'Act 3 gate-cleared', value: totals.act3Cleared, rate: rates?.act3Cleared ?? 0 },
        { label: 'Act 4 scheduled', value: totals.act4Scheduled, rate: rates?.act4Scheduled ?? 0 },
        { label: 'Walk-ins done', value: totals.act4Done, rate: null },
        { label: 'Claimed', value: totals.claimed, rate: rates?.claimed ?? 0 },
        { label: 'Organic claims', value: totals.organicClaims, rate: null },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cascade cohort"
        description="Cohort funnel measurement — verified, aware, gate-cleared, walk-ins, claims, and organic claims."
        icon={<BarChart3 className="w-6 h-6" />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/settings/admin/directory/presence-seeds/announce-queue"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Announce queue
            </Link>
            <Link
              href="/settings/admin/directory/presence-seeds"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to seeds
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Seed batch</span>
          <select
            value={seedBatch}
            onChange={(e) => setSeedBatch(e.target.value)}
            disabled={batchesLoading}
            className="min-w-[16rem] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          >
            <option value="">
              {batchesLoading ? 'Loading batches…' : 'Select a seed batch…'}
            </option>
            {batches.map((b) => (
              <option key={b.seedBatch} value={b.seedBatch} title={b.seedBatch}>
                {seedBatchDisplayLabel(
                  {
                    seedBatch: b.seedBatch,
                    createdAt: b.createdAt,
                    seedCount: b.totalSeeds,
                    category: b.topCategory,
                    categoryCount: b.categories?.length ?? 0,
                    place: b.topCity,
                    placeCount: b.cities?.length ?? 0,
                  },
                  { includePgTag: true },
                )}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Load cohort
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        The cohort measures <span className="font-semibold">seeds</span> by seed batch. The
        prospect queue is pre-seed — promote prospects to listings first. Campaign seeds carry
        <code className="mx-1">from-campaign-…</code> batches; PG preflight seeds carry
        <code className="mx-1">pg-…</code>.
      </p>

      {!batchesLoading && batches.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No seed batches yet. Publish or promote seeds first; the cohort page only measures
          seeds, not the prospect queue.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-400">
          Loading the cohort…
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{card.value}</p>
                {card.rate != null && (
                  <p className="mt-0.5 text-xs text-gray-400">{pct(card.rate)} of seeds</p>
                )}
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-neutral-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-3 py-3">Act 1</th>
                  <th className="px-3 py-3">Act 2</th>
                  <th className="px-3 py-3">Act 3</th>
                  <th className="px-3 py-3">Act 4</th>
                  <th className="px-3 py-3">Claimed</th>
                  <th className="px-3 py-3">Organic</th>
                  <th className="px-3 py-3">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                {summary.rows.map((row) => (
                  <tr key={row.seedId}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/settings/admin/directory/presence-seeds/${row.seedId}/cascade`}
                        className="font-medium text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                      >
                        {row.businessName || 'Untitled seed'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{row.seedBatch || '—'}</td>
                    <td className="px-4 py-3 text-xs">{row.status}</td>
                    <td className="px-3 py-3"><Flag on={row.act1Verified} /></td>
                    <td className="px-3 py-3"><Flag on={row.act2Aware} /></td>
                    <td className="px-3 py-3"><Flag on={row.act3Cleared} /></td>
                    <td className="px-3 py-3"><Flag on={row.act4Done} /></td>
                    <td className="px-3 py-3"><Flag on={row.claimed} /></td>
                    <td className="px-3 py-3"><Flag on={row.organicClaim} /></td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {row.ageDays == null ? '—' : `${row.ageDays}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-400">
          No cohort loaded.
        </div>
      )}
    </div>
  );
}

export default function CascadeCohortPage() {
  return (
    <MarketingOpsNavShell>
      <CohortContent />
    </MarketingOpsNavShell>
  );
}
