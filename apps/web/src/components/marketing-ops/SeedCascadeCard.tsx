'use client';

/**
 * SeedCascadeCard — cascade awareness on the seed detail page itself.
 *
 * The full cascade page and the VAST/Execution boards are useful, but the
 * seed's own surface should show its act position without a navigation hop.
 * This card is the seed-scoped summary: announce state, VAST act chips, the
 * walk-in gate, and the quick announce actions.
 *
 * Spec: docs/LocalBiz/FOUR_ACT_OUTREACH_CASCADE_SPEC.md §7 / §11.6.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import marketingOpsService, { type StageAdvice } from '@/services/MarketingOpsService';
import directoryPresenceAdminService, {
  type CascadeActStatus,
  type SeedCascadeSummary,
} from '@/services/DirectoryPresenceAdminService';
import ProspectTouchLogModal from '@/components/marketing-ops/ProspectTouchLogModal';
import { StageAdviceChip } from '@/components/marketing-ops/StageAdviceBanner';
import {
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
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

export default function SeedCascadeCard({
  seedId,
  businessName,
  onChanged,
}: {
  seedId: string;
  businessName?: string | null;
  onChanged?: () => void | Promise<void>;
}) {
  const [summary, setSummary] = useState<SeedCascadeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [campaignAdvice, setCampaignAdvice] = useState<StageAdvice | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSummary(await directoryPresenceAdminService.getSeedCascade(seedId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the cascade');
    } finally {
      setLoading(false);
    }
  }, [seedId]);

  useEffect(() => {
    load();
  }, [load]);

  const canAnnounce =
    !!summary &&
    (summary.seedStatus === 'published' || summary.seedStatus === 'invited');

  const primaryCampaign = summary
    ? summary.linkedCampaigns.find((c) => c.linkRole === 'primary') ??
      summary.linkedCampaigns[0] ??
      null
    : null;

  // Stage readiness comes from the campaign cascade (the server derivation),
  // not a local stage guess — the gallery is only mintable at preview_built or
  // shown, and that list lives in GalleryEligibilityService.
  const primaryCampaignId = primaryCampaign?.id ?? null;
  const loadAdvice = useCallback(async () => {
    if (!primaryCampaignId) {
      setCampaignAdvice(null);
      return;
    }
    try {
      const result = await marketingOpsService.getCampaignCascade(primaryCampaignId);
      setCampaignAdvice(result?.stageAdvice ?? null);
    } catch {
      setCampaignAdvice(null);
    }
  }, [primaryCampaignId]);

  useEffect(() => {
    loadAdvice();
  }, [loadAdvice]);

  // Below preview_built the gallery cannot be minted yet, so the Show row's
  // link is an advance prompt; from preview_built onward it is a navigation
  // link into the Outreach Kit (which owns screenshots, eligibility, minting).
  const galleryStageOk = campaignAdvice
    ? !['seek', 'seed'].includes(campaignAdvice.currentStage ?? '')
    : true;

  const handleMarkAnnounced = async () => {
    if (!summary) return;
    setBusy(true);
    setError(null);
    try {
      const channel =
        summary.announceChannel === 'call' || summary.announceChannel === 'email'
          ? summary.announceChannel
          : undefined;
      await directoryPresenceAdminService.markAnnounceDelivered(seedId, { channel });
      await load();
      await loadAdvice();
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark the announce delivered');
    } finally {
      setBusy(false);
    }
  };

  const announceLabel = summary?.announceDeliveredAt
    ? 'Announced'
    : summary?.announceScheduledAt
      ? 'Scheduled'
      : 'Not scheduled';

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cascade (VAST)</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Verification → Awareness → Show → Tell, derived from the seed touch ledger, linked
            campaign logs, gallery events, and tagged scans.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${
              summary?.announceDeliveredAt
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : summary?.announceScheduledAt
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300'
            }`}
          >
            <Megaphone className="w-3 h-3" />
            {announceLabel}
          </span>
          <StageAdviceChip advice={campaignAdvice} />
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            disabled={!canAnnounce}
            title={canAnnounce ? 'Log an announce/touch against this seed' : 'Publish the seed first'}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-800 dark:text-gray-200"
          >
            Log announce
          </button>
          <button
            type="button"
            onClick={handleMarkAnnounced}
            disabled={!canAnnounce || !!summary?.announceDeliveredAt || busy}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : summary?.announceDeliveredAt ? 'Announced' : 'Mark announced'}
          </button>
          <Link
            href={`/settings/admin/directory/presence-seeds/${seedId}/cascade`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Full cascade
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-800 dark:text-gray-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading cascade…</div>
      ) : !summary ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">No cascade data for this seed.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summary.acts.map((act) => {
              const style = STATUS_STYLES[act.status];
              const Icon = style.icon;
              return (
                <Link
                  key={act.act}
                  href={`/settings/admin/directory/presence-seeds/${seedId}/cascade#act-${act.act}`}
                  className="rounded-lg border border-gray-200 bg-white p-3 hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">
                      Act {act.act} · {act.name}
                    </p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.chip}`}>
                      <Icon className="w-3 h-3" />
                      {act.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400">{act.detail}</p>
                  <p className="mt-1 text-[10px] text-gray-400">Last event: {formatDate(act.lastEventAt)}</p>
                </Link>
              );
            })}
          </div>

          {summary.acts[2] && summary.acts[2].status !== 'done' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900">
              <span className="text-gray-600 dark:text-gray-400">
                Show is {summary.acts[2].status.replace(/_/g, ' ')}: {summary.acts[2].detail}
              </span>
              {primaryCampaign ? (
                <Link
                  href={`/settings/admin/marketing-ops/campaigns/${primaryCampaign.id}?tab=gallery`}
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {galleryStageOk ? 'Open Outreach Kit' : 'Advance to Preview Built'}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="text-gray-500">Link a campaign to unlock Show</span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900">
            <span className="font-semibold text-gray-900 dark:text-white">Walk-in gate</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${summary.gate.gateCleared ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
              {summary.gate.gateCleared ? 'cleared' : 'not cleared'}
            </span>
            <span className="text-gray-600 dark:text-gray-400">{summary.gate.reason}</span>
          </div>
        </>
      )}

      {logOpen && summary && (
        <ProspectTouchLogModal
          entry={{
            id: seedId,
            business_name: businessName ?? summary.businessName,
            title: null,
            business_snapshot: {
              verified_nap: {
                phone: summary.ownerPhone || summary.listingPhone,
                email: summary.ownerEmail || summary.listingEmail,
              },
            },
          }}
          seedId={seedId}
          onClose={() => setLogOpen(false)}
          onLogged={async () => {
            setLogOpen(false);
            await load();
            await loadAdvice();
            await onChanged?.();
          }}
        />
      )}
    </section>
  );
}
