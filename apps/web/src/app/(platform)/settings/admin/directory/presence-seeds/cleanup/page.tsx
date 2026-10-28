'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { MarketingOpsNavShell } from '@/components/marketing-ops/MarketingOpsPageShell';
import directoryPresenceAdminService, {
  type ChainGroupFeedItem,
  type CleanupDuplicateGroup,
  type CleanupSeedRef,
  type SeedCleanupReport,
} from '@/services/DirectoryPresenceAdminService';
import { seedBatchDisplayLabel } from '@/lib/seed-batch-label';
import {
  ArrowLeft,
  ArrowUpRight,
  BrushCleaning,
  Copy,
  ExternalLink,
  GitMerge,
  Link2,
  PhoneCall,
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
          {seed.queueStatus === 'verify_then_outreach' && (
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              verify pending
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
  onLinkChain,
  onRequestVerification,
}: {
  group: CleanupDuplicateGroup;
  busy: boolean;
  onResolve: (group: CleanupDuplicateGroup, keepSeedId: string) => void;
  onMarkDistinct: (group: CleanupDuplicateGroup) => void;
  onLinkChain: (group: CleanupDuplicateGroup) => void;
  onRequestVerification: (group: CleanupDuplicateGroup) => void;
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
        {group.chain && (
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
            group.chain.confidence === 'chain_confirmed'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
          }`}>
            {group.chain.confidence === 'chain_confirmed' ? 'chain — confirmed' : 'chain — probable'}
          </span>
        )}
        {group.chain?.nameTokenOverlap?.length ? (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            shared brand token “{group.chain.nameTokenOverlap.join('”, “')}”
          </span>
        ) : null}
        {group.chain?.existingChainGroupId && (
          <span className="text-xs text-gray-500">already linked → {group.chain.existingChainGroupId}</span>
        )}
        {group.matchKey === 'phone' && !group.chain && (
          <span className="text-xs text-gray-500">phone matches can be chains — verify before merging</span>
        )}
        {group.verdict && (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
            {group.verdict.verdict === 'same_entity'
              ? `resolved → kept ${group.verdict.mergeInto}`
              : group.verdict.verdict === 'distinct_chain'
                ? 'linked as chain'
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
          <button
            type="button"
            disabled={busy}
            onClick={() => onRequestVerification(group)}
            title="Signals can't settle this — route each member's queue entry to verify_then_outreach so a call resolves it"
            className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Needs verification — call to settle
          </button>
          {group.chain && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onLinkChain(group)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5" />
              Same chain — link {group.seeds.length} location{group.seeds.length > 2 ? 's' : ''}
            </button>
          )}
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

function ChainFeedCard({
  chain,
  busy,
  onBuildCampaigns,
}: {
  chain: ChainGroupFeedItem;
  busy: boolean;
  onBuildCampaigns: (chain: ChainGroupFeedItem) => void;
}) {
  const statusTone: Record<string, string> = {
    candidate: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    claimed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    org_linked: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  };
  const memberStatusTone = (s: string) =>
    s === 'claimed'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300';

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {chain.displayName}
        </span>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusTone[chain.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {chain.status.replace(/_/g, ' ')}
        </span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
          chain.confidence === 'chain_confirmed'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
        }`}>
          {chain.confidence === 'chain_confirmed' ? 'confirmed' : 'probable'}
        </span>
        <span className="text-xs text-gray-500">
          {chain.claimProgress.claimed}/{chain.claimProgress.live} claimed
          {chain.claimProgress.invited > 0 ? ` · ${chain.claimProgress.invited} invited` : ''}
        </span>
        {chain.businessProspectId && (
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            prospect {chain.businessProspectId}
          </span>
        )}
        {chain.prospectConflict && (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
            prospect conflict — members in {chain.prospectConflict.length} groups
          </span>
        )}
        {(chain.contact.ownerPhone || chain.contact.ownerEmail || chain.contact.phone) && (
          <span className="ml-auto text-xs text-gray-500">
            pitch → {chain.contact.ownerPhone || chain.contact.ownerEmail || chain.contact.phone}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {chain.members.map((m) => (
          <div
            key={m.seedId}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <Link
              href={`/settings/admin/directory/presence-seeds/${m.seedId}`}
              className="font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              {m.businessName || m.seedId}
            </Link>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${memberStatusTone(m.status)}`}>
              {m.status}
            </span>
            {m.hasActiveClaimToken && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                live token
              </span>
            )}
            {m.campaignId && (
              <Link
                href={`/settings/admin/marketing-ops/campaigns/${m.campaignId}`}
                className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <ArrowUpRight className="h-3 w-3" />
                {m.campaignDisplayId ?? 'campaign'}
              </Link>
            )}
            <span className="text-xs text-gray-500">
              {[m.city, m.state].filter(Boolean).join(', ') || '—'}
            </span>
            {m.slug && (
              <Link
                href={m.listingOrigin === 'directory_seed' ? `/place/${m.slug}` : `/directory/${m.slug}`}
                target="_blank"
                className="ml-auto inline-flex items-center gap-0.5 text-xs text-gray-500 hover:text-blue-600"
              >
                <ExternalLink className="h-3 w-3" /> public
              </Link>
            )}
          </div>
        ))}
      </div>

      {chain.pitchHooks.length > 0 && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-white px-3 py-2 dark:border-emerald-900/40 dark:bg-neutral-900/60">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Pitch hooks
          </div>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-gray-600 dark:text-gray-300">
            {chain.pitchHooks.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* §7.2 — 1-click prospect build: one business_prospect_id for the
          chain, one sibling campaign per member location, seed-linked.
          Shown while any member still lacks a campaign. */}
      {chain.members.some((m) => !m.campaignId) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onBuildCampaigns(chain)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Build sibling campaigns — {chain.members.length} location{chain.members.length !== 1 ? 's' : ''}
          </button>
          <span className="text-xs text-gray-500">
            one prospect group · promotes each member's queue entry · seed-linked
          </span>
        </div>
      )}
    </div>
  );
}

function CleanupContent() {
  const [report, setReport] = useState<SeedCleanupReport | null>(null);
  const [chains, setChains] = useState<ChainGroupFeedItem[]>([]);
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
      const [data, chainGroups] = await Promise.all([
        directoryPresenceAdminService.getCleanupReport(batch || undefined),
        directoryPresenceAdminService.listChainGroups().catch(() => [] as ChainGroupFeedItem[]),
      ]);
      setReport(data);
      setChains(chainGroups);
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

  const handleLinkChain = (group: CleanupDuplicateGroup) =>
    runAction(async () => {
      const r = await directoryPresenceAdminService.recordDedupVerdict({
        seedIds: group.seedIds,
        matchKey: group.matchKey,
        verdict: 'distinct_chain',
      });
      const cg = r?.chainGroup;
      if (r?.chainError) {
        return `Verdict recorded but chain link failed (${r.chainError}) — the group stays resolved; retry by re-linking.`;
      }
      return cg
        ? `Linked as chain ${cg.chainGroupId} (${cg.confidence.replace('chain_', '')}) — ${cg.memberCount} location(s) in the prospecting feed.`
        : 'Group linked as chain — added to the prospecting feed.';
    });

  const handleBuildChainCampaigns = (chain: ChainGroupFeedItem) =>
    runAction(async () => {
      const r = await directoryPresenceAdminService.buildChainCampaigns(chain.chainGroupId);
      const created = r.members.filter((m) => m.status === 'created').length;
      const existing = r.members.filter((m) => m.status === 'existing').length;
      const skipped = r.members.filter((m) => m.status === 'skipped' || m.status === 'failed');
      const base = r.prospectConflict
        ? `Campaigns built but members already sit in different prospects (${r.prospectConflict.join(', ')}) — resolve manually.`
        : `Prospect ${r.businessProspectId} — ${created} campaign${created !== 1 ? 's' : ''} built, ${existing} existing.`;
      return skipped.length
        ? `${base} ${skipped.length} member${skipped.length !== 1 ? 's' : ''} not promoted (${skipped.map((m) => m.reason ?? m.status).join('; ')}).`
        : base;
    });

  const handleRequestVerification = (group: CleanupDuplicateGroup) =>
    runAction(async () => {
      const r = await directoryPresenceAdminService.requestGroupVerification(group.seedIds);
      const requested = r.results.filter((m) => m.status === 'requested').length;
      const pending = r.results.filter((m) => m.status === 'already_pending').length;
      const skipped = r.results.filter((m) => m.status === 'skipped');
      return `Verification requested for ${requested} member${requested !== 1 ? 's' : ''}` +
        (pending ? `, ${pending} already pending` : '') +
        (skipped.length ? ` — skipped: ${skipped.map((s) => s.reason).join(', ')}` : '') +
        '.';
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
      const hours = r.results.filter((x) => x.hoursWritten).length;
      return `Backfilled ${ids.length} seeds — ${prov} provenance rows, ${sharpened} SEO packets, ${attrs} attribute chips` +
        (hours > 0 ? `, ${hours} hours grids` : '') +
        '.';
    });

  /**
   * Batch recompose — overwrite SEO copy for the filtered set. Backfill closes
   * gaps; this replaces stale copy (an old disclosure sentence, or a narrative
   * composed before the directives changed). Destructive by design, so it asks
   * first and reports what was skipped.
   */
  const handleRecomposeAll = () =>
    runAction(async () => {
      const ids = thinSeeds
        .filter((s) => s.status !== 'claimed' && s.status !== 'suppressed')
        .map((s) => s.seedId);
      if (ids.length === 0) return 'No live seeds to recompose.';
      const ok = window.confirm(
        `Recompose SEO copy for ${ids.length} seed${ids.length !== 1 ? 's' : ''}?\n\n` +
          'This overwrites description, keywords and same_as with freshly composed copy, ' +
          'including any hand edits. Claimed and suppressed seeds are skipped.',
      );
      if (!ok) return 'Recompose cancelled.';
      const r = await directoryPresenceAdminService.recomposeSeedEnrichment(ids);
      return (
        `Recomposed ${r.recomposed} seed${r.recomposed !== 1 ? 's' : ''}` +
        (r.skipped.length ? ` — ${r.skipped.length} skipped` : '') +
        '.'
      );
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
              <option key={b.seedBatch} value={b.seedBatch} title={b.seedBatch}>
                {seedBatchDisplayLabel(b, { includePgTag: true })}
              </option>
            ))}
          </select>
          {seedBatch && (
            <span className="font-mono text-[11px] text-gray-400" title="Raw batch label">
              {seedBatch}
            </span>
          )}
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
            onLinkChain={handleLinkChain}
            onRequestVerification={handleRequestVerification}
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
                  onLinkChain={handleLinkChain}
                  onRequestVerification={handleRequestVerification}
                />
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Chain prospecting feed — resolved distinct_chain groups are the
          leads: who owns multiple shelves and hasn't been pitched the org
          story yet. (Migration 359, spec §5.2) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Chain prospecting feed
          </h2>
          <span className="text-xs text-gray-500">
            {loading ? '…' : `${chains.filter((c) => c.status !== 'dismissed').length} chain${chains.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {!loading && chains.filter((c) => c.status !== 'dismissed').length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-gray-400">
            No chains yet — same-phone duplicate groups with chain signals get a "Same chain — link locations" action above.
          </div>
        )}
        {chains.filter((c) => c.status !== 'dismissed').map((c) => (
          <ChainFeedCard
            key={c.chainGroupId}
            chain={c}
            busy={busy}
            onBuildCampaigns={handleBuildChainCampaigns}
          />
        ))}
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
          {thinSeeds.length > 0 && (<>
            <button
              type="button"
              onClick={handleBackfillAll}
              disabled={busy || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Backfill all thin seeds
            </button>
            <button
              type="button"
              onClick={handleRecomposeAll}
              disabled={busy || loading}
              title="Overwrites description, keywords and same_as with freshly composed copy"
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
            >
              Recompose SEO copy
            </button>
          </>)}
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
