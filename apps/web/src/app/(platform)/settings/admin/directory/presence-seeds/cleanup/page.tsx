'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { MarketingOpsNavShell } from '@/components/marketing-ops/MarketingOpsPageShell';
import directoryPresenceAdminService, {
  type CleanupDuplicateGroup,
  type CleanupSeedRef,
  type SeedCleanupReport,
} from '@/services/DirectoryPresenceAdminService';
import {
  ArrowLeft,
  ArrowUpRight,
  BrushCleaning,
  Copy,
  ExternalLink,
  GitMerge,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const MISSING_LABELS: Record<string, string> = {
  'provenance:name': 'name prov',
  'provenance:address': 'address prov',
  'provenance:phone': 'phone prov',
  'provenance:website': 'website prov',
  'provenance:primary_category': 'category prov',
  'provenance:secondary_categories': 'sec-cat prov',
  'provenance:hours': 'hours prov',
  description: 'description',
  keywords: 'keywords',
  seo_enrichment: 'seo json',
  same_as: 'same_as',
  attributes: 'attributes',
  hours: 'hours',
  secondary_categories: 'sec categories',
};

function PgBadge() {
  return (
    <span className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
      PG
    </span>
  );
}

function SeedMiniRow({ seed, keeper, onPick, disabled }: {
  seed: CleanupSeedRef;
  keeper: boolean;
  onPick: () => void;
  disabled: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
        keeper
          ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40'
          : 'border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800'
      } ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-blue-300'}`}
    >
      <input
        type="radio"
        className="mt-1"
        checked={keeper}
        disabled={disabled}
        onChange={onPick}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <Link
            href={`/settings/admin/directory/presence-seeds/${seed.seedId}`}
            className="font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            {seed.businessName || seed.seedId}
          </Link>
          {seed.isPgBatch && <PgBadge />}
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600 dark:bg-neutral-700 dark:text-gray-300">
            {seed.status}
          </span>
          {seed.hasActiveClaimToken && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              live token
            </span>
          )}
          {seed.slug && (
            <Link
              href={`/place/${seed.slug}`}
              target="_blank"
              className="inline-flex items-center gap-0.5 text-xs text-gray-500 hover:text-blue-600"
            >
              <ExternalLink className="h-3 w-3" /> public
            </Link>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
          {seed.address || '—'} · {seed.city || '—'}, {seed.state || '—'} · {seed.phone || 'no phone'} ·{' '}
          {seed.category || '—'}
        </span>
        <span className="block text-[11px] text-gray-400">{seed.seedBatch || 'no batch'}</span>
      </span>
    </label>
  );
}

function DuplicateGroupCard({
  group,
  busy,
  onResolve,
  onMarkDistinct,
}: {
  group: CleanupDuplicateGroup;
  busy: boolean;
  onResolve: (group: CleanupDuplicateGroup, keepSeedId: string) => void;
  onMarkDistinct: (group: CleanupDuplicateGroup) => void;
}) {
  const claimedIds = group.seeds.filter((s) => s.status === 'claimed').map((s) => s.seedId);
  const [keepId, setKeepId] = useState<string | null>(claimedIds[0] ?? null);
  const resolved = !!group.verdict;

  return (
    <div
      className={`rounded-xl border p-4 ${
        resolved
          ? 'border-gray-200 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900/40'
          : 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <GitMerge className="h-4 w-4 text-amber-600" />
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
          {group.matchKey === 'phone' ? 'same phone' : 'same address'}
        </span>
        {group.matchKey === 'phone' && (
          <span className="text-xs text-gray-500">phone matches can be chains — verify before merging</span>
        )}
        {group.verdict && (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
            {group.verdict.verdict === 'same_entity'
              ? `resolved → kept ${group.verdict.mergeInto}`
              : 'marked distinct'}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {group.seeds.map((s) => (
          <SeedMiniRow
            key={s.seedId}
            seed={s}
            keeper={keepId === s.seedId}
            disabled={resolved || busy || s.status === 'suppressed'}
            onPick={() => setKeepId(s.seedId)}
          />
        ))}
      </div>

      {!resolved && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !keepId}
            onClick={() => keepId && onResolve(group, keepId)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Keep selected — suppress {group.seeds.filter((s) => s.seedId !== keepId).length} other
            {group.seeds.length > 2 ? 's' : ''}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onMarkDistinct(group)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-gray-300"
          >
            Not duplicates — mark distinct
          </button>
          {claimedIds.length > 0 && (
            <span className="text-xs text-red-600">
              claimed seeds can be kept but never suppressed
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CleanupContent() {
  const [report, setReport] = useState<SeedCleanupReport | null>(null);
  const [seedBatch, setSeedBatch] = useState<string>('');
  const [batchTouched, setBatchTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchReport = useCallback(async (batch: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await directoryPresenceAdminService.getCleanupReport(batch || undefined);
      setReport(data);
      // Default the selector to the newest batch on first load.
      if (!batchTouched && data?.batches?.length) {
        setSeedBatch(data.batches[0].seedBatch);
        setBatchTouched(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the cleanup report');
    } finally {
      setLoading(false);
    }
  }, [batchTouched]);

  useEffect(() => {
    fetchReport(seedBatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedBatch]);

  const openGroups = useMemo(
    () => report?.duplicateGroups.filter((g) => !g.verdict) ?? [],
    [report],
  );
  const resolvedGroups = useMemo(
    () => report?.duplicateGroups.filter((g) => g.verdict) ?? [],
    [report],
  );
  const thinSeeds = report?.completeness.thinSeeds ?? [];

  const runAction = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      setSuccess(await fn());
      await fetchReport(seedBatch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = (group: CleanupDuplicateGroup, keepSeedId: string) =>
    runAction(async () => {
      const suppressIds = group.seeds
        .map((s) => s.seedId)
        .filter((id) => id !== keepSeedId);
      const r = await directoryPresenceAdminService.resolveDuplicateGroup({
        keepSeedId,
        suppressSeedIds: suppressIds,
        matchKey: group.matchKey,
      });
      return `Kept ${keepSeedId} — suppressed ${r.suppressed.length}, revoked ${r.tokensRevoked} token(s).`;
    });

  const handleMarkDistinct = (group: CleanupDuplicateGroup) =>
    runAction(async () => {
      await directoryPresenceAdminService.recordDedupVerdict({
        seedIds: group.seedIds,
        matchKey: group.matchKey,
        verdict: 'distinct',
      });
      return 'Group marked distinct — cleared from duplicate review.';
    });

  const handleBackfillAll = () =>
    runAction(async () => {
      const ids = thinSeeds
        .filter((s) => s.status !== 'claimed' && s.status !== 'suppressed')
        .map((s) => s.seedId);
      if (ids.length === 0) return 'No live thin seeds to backfill.';
      const r = await directoryPresenceAdminService.backfillSeedEnrichment(ids);
      const sharpened = r.results.filter((x) => x.seoSharpened).length;
      const prov = r.results.reduce((n, x) => n + (x.provenanceWritten ?? 0), 0);
      const attrs = r.results.reduce((n, x) => n + (x.attributesWritten ?? 0), 0);
      return `Backfilled ${ids.length} seeds — ${prov} provenance rows, ${sharpened} SEO packets, ${attrs} attribute chips.`;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seed cleanup"
        description="Post-batch-publish verification — duplicate groups, thin-seed completeness, and enrichment backfill."
        icon={<BrushCleaning className="w-6 h-6" />}
        actions={
          <Link
            href="/settings/admin/directory/presence-seeds"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to seeds
          </Link>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Scope + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Batch</label>
          <select
            value={seedBatch}
            onChange={(e) => {
              setBatchTouched(true);
              setSeedBatch(e.target.value);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-gray-200"
          >
            <option value="">All seeds</option>
            {report?.batches.map((b) => (
              <option key={b.seedBatch} value={b.seedBatch}>
                {b.seedBatch}
                {b.isPgBatch ? ' (PG)' : ''} — {b.seedCount}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => fetchReport(seedBatch)}
          disabled={loading || busy}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-gray-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Duplicate groups */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Copy className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Duplicate groups
          </h2>
          <span className="text-xs text-gray-500">
            {loading ? '…' : `${openGroups.length} open${resolvedGroups.length > 0 ? ` · ${resolvedGroups.length} resolved` : ''}`}
          </span>
        </div>
        {!loading && openGroups.length === 0 && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
            No open duplicate groups — the funnel identity gate is clean.
          </div>
        )}
        {openGroups.map((g) => (
          <DuplicateGroupCard
            key={`${g.matchKey}:${g.seedIds.join(',')}`}
            group={g}
            busy={busy}
            onResolve={handleResolve}
            onMarkDistinct={handleMarkDistinct}
          />
        ))}
        {resolvedGroups.length > 0 && (
          <details className="rounded-lg border border-gray-200 dark:border-neutral-700">
            <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-gray-500">
              {resolvedGroups.length} resolved group{resolvedGroups.length !== 1 ? 's' : ''}
            </summary>
            <div className="space-y-3 p-4">
              {resolvedGroups.map((g) => (
                <DuplicateGroupCard
                  key={`${g.matchKey}:${g.seedIds.join(',')}`}
                  group={g}
                  busy={busy}
                  onResolve={handleResolve}
                  onMarkDistinct={handleMarkDistinct}
                />
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Completeness */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Completeness
            </h2>
            <span className="text-xs text-gray-500">
              {loading
                ? '…'
                : `${thinSeeds.length} of ${report?.completeness.totalSeeds ?? 0} seeds missing fields`}
            </span>
          </div>
          {thinSeeds.length > 0 && (
            <button
              type="button"
              onClick={handleBackfillAll}
              disabled={busy || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Backfill all thin seeds
            </button>
          )}
        </div>

        {!loading && thinSeeds.length === 0 && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
            Every live seed carries its full contract fields.
          </div>
        )}

        {thinSeeds.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-neutral-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-neutral-800 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2">Seed</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Missing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {thinSeeds.map((s) => (
                  <tr key={s.seedId} className="bg-white dark:bg-neutral-900">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/settings/admin/directory/presence-seeds/${s.seedId}`}
                          className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                        >
                          {s.businessName || s.seedId}
                        </Link>
                        {s.isPgBatch && <PgBadge />}
                      </div>
                      <div className="text-[11px] text-gray-400">{s.seedBatch || 'no batch'}</div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">{s.status}</td>
                    <td className="px-4 py-2">
                      <div className="flex max-w-md flex-wrap gap-1">
                        {s.missing.map((m) => (
                          <span
                            key={m}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-neutral-700 dark:text-gray-300"
                          >
                            {MISSING_LABELS[m] ?? m}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function SeedCleanupPage() {
  return (
    <MarketingOpsNavShell>
      <CleanupContent />
    </MarketingOpsNavShell>
  );
}
