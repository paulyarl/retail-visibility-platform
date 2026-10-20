'use client';

/**
 * CampaignExecutionPanel — the Project Plan tab's `#execution` surface.
 *
 * The campaign detail page is where the operator already holds the audit,
 * archetype, briefing, and siblings; this panel puts the Four-Act cascade
 * execution beside them instead of making the operator jump to the seeds
 * admin page. The seed admin queue remains the cross-prospect worklist.
 *
 * Spec: docs/LocalBiz/marketing_ops_project_phase_sprint_plan.md §7.3
 *       (the `#execution` slot) + FOUR_ACT_OUTREACH_CASCADE_SPEC.md §7.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import marketingOpsService, {
  type CampaignCascadeResponse,
  type GalleryEligibility,
} from '@/services/MarketingOpsService';
import directoryPresenceAdminService, {
  type CascadeActStatus,
} from '@/services/DirectoryPresenceAdminService';
import ProspectTouchLogModal from './ProspectTouchLogModal';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Loader2,
  Megaphone,
  RefreshCw,
  XCircle,
} from 'lucide-react';

const STATUS_STYLES: Record<CascadeActStatus, { chip: string; icon: typeof CheckCircle2 }> = {
  done: {
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  in_progress: {
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    icon: Clock,
  },
  not_started: {
    chip: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300',
    icon: Circle,
  },
  blocked: {
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: XCircle,
  },
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function announceLabel(announce: CampaignCascadeResponse['announce']): string {
  if (announce.deliveredAt) return 'Announced';
  if (announce.scheduledAt) return 'Scheduled';
  return 'Not scheduled';
}

function announceChip(announce: CampaignCascadeResponse['announce']): string {
  if (announce.deliveredAt) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (announce.scheduledAt) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300';
}

export default function CampaignExecutionPanel({
  campaignId,
  businessName,
}: {
  campaignId: string;
  businessName?: string | null;
}) {
  const [data, setData] = useState<CampaignCascadeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [galleryEligibility, setGalleryEligibility] = useState<GalleryEligibility | null>(null);

  // Act 3's gate lives on the campaign's Outreach Kit tab. Fetch the gate
  // reason so the Show card can show the actual unblock action (advance stage,
  // upload screenshots, run the audit, or generate the link).
  useEffect(() => {
    let cancelled = false;
    marketingOpsService
      .getGalleryEligibility(campaignId)
      .then((result) => {
        if (!cancelled) setGalleryEligibility(result);
      })
      .catch(() => {
        if (!cancelled) setGalleryEligibility(null);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await marketingOpsService.getCampaignCascade(campaignId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the cascade');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAnnounced = async () => {
    if (!data?.seedId) return;
    setBusy(true);
    setError(null);
    try {
      const channel =
        data.announce.channel === 'call' || data.announce.channel === 'email'
          ? data.announce.channel
          : undefined;
      await directoryPresenceAdminService.markAnnounceDelivered(data.seedId, { channel });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark the announce delivered');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the cascade…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        <button type="button" onClick={load} className="ml-2 underline">Retry</button>
      </div>
    );
  }

  if (!data || data.reason === 'no_primary_seed' || !data.cascade) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-600 dark:border-neutral-600 dark:text-gray-300">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          No place listing linked
        </div>
        <p className="mt-2">
          The Four-Act cascade runs on the campaign&apos;s published place listing. Add the
          listing from this campaign (the seed is parked in draft for QC), publish it, then
          return here.
        </p>
        <Link
          href={`/settings/admin/directory/presence-seeds?status=draft`}
          className="mt-3 inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
        >
          Open draft seeds
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const cascade = data.cascade;

  const galleryReason = galleryEligibility?.reason ?? null;
  const galleryHref =
    galleryReason === 'no_business_analysis_audit' || galleryReason === 'archetype_unresolved'
      ? `/settings/admin/marketing-ops/campaigns/${campaignId}?tab=prompts`
      : `/settings/admin/marketing-ops/campaigns/${campaignId}?tab=gallery`;
  const galleryActionLabel = !galleryEligibility
    ? 'Open Outreach Kit'
    : galleryReason === 'invalid_stage'
      ? 'Advance to Preview Built'
      : galleryReason === 'no_screenshots'
        ? 'Upload screenshots'
        : galleryReason === 'no_business_analysis_audit'
          ? 'Run business analysis'
          : galleryReason === 'archetype_unresolved'
            ? 'Resolve archetype'
            : galleryEligibility.eligible
              ? 'Generate gallery link'
              : 'Open Outreach Kit';
  const galleryActionTitle = galleryEligibility?.action ?? 'Open the gallery gate';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Four-Act execution</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Seed {data.seedId} · {data.seed?.seedBatch || 'no batch'} · {data.seed?.status || 'unknown'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${announceChip(data.announce)}`}>
            <Megaphone className="h-3 w-3" />
            {announceLabel(data.announce)}
          </span>
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700"
          >
            Log announce
          </button>
          <button
            type="button"
            onClick={handleMarkAnnounced}
            disabled={busy || !!data.announce.deliveredAt}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving…' : data.announce.deliveredAt ? 'Announced' : 'Mark announced'}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-gray-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <Link
            href={`/settings/admin/directory/presence-seeds/${data.seedId}/cascade`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Full cascade
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cascade.acts.map((act) => {
          const style = STATUS_STYLES[act.status];
          const Icon = style.icon;
          return (
            <div
              key={act.act}
              className="rounded-lg border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                  Act {act.act} · {act.name}
                </p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.chip}`}>
                  <Icon className="h-3 w-3" />
                  {act.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400">{act.detail}</p>
              <p className="mt-1 text-[10px] text-gray-400">Last event: {formatDate(act.lastEventAt)}</p>
              {act.act === 3 && act.status !== 'done' && (
                <Link
                  href={galleryHref}
                  title={galleryActionTitle}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {galleryActionLabel}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Walk-in gate</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cascade.gate.gateCleared ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
            {cascade.gate.gateCleared ? 'cleared' : 'not cleared'}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">{cascade.gate.reason}</p>
        {!cascade.gate.gateCleared && (
          <Link
            href={galleryHref}
            title={galleryActionTitle}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Unblock Act 3 — {galleryActionLabel}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
        <p className="text-xs font-semibold text-gray-900 dark:text-white">Recent activity</p>
        {cascade.timeline.length === 0 ? (
          <p className="mt-1 text-[11px] text-gray-500">No touches or events yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-gray-100 dark:divide-neutral-700">
            {cascade.timeline.slice(0, 8).map((event) => (
              <li key={event.id} className="flex items-start gap-2 py-1.5 text-[11px]">
                <span className="w-28 shrink-0 text-gray-400">{formatDate(event.at)}</span>
                <span className="w-20 shrink-0 font-medium text-gray-600 dark:text-gray-300">
                  {event.source.replace(/_/g, ' ')}
                </span>
                <span className="min-w-0 flex-1 text-gray-800 dark:text-gray-200">{event.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {logOpen && data.seedId && (
        <ProspectTouchLogModal
          entry={{
            id: data.seedId,
            business_name: businessName ?? null,
            title: null,
            business_snapshot: {},
          }}
          seedId={data.seedId}
          onClose={() => setLogOpen(false)}
          onLogged={async () => {
            setLogOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
