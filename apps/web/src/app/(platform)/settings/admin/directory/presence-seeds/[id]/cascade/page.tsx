'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { MarketingOpsNavShell } from '@/components/marketing-ops/MarketingOpsPageShell';
import directoryPresenceAdminService, {
  type CascadeActStatus,
  type SeedCascadeSummary,
} from '@/services/DirectoryPresenceAdminService';
import ProspectTouchLogModal from '@/components/marketing-ops/ProspectTouchLogModal';
import { ArrowLeft, CheckCircle2, Circle, Clock, ExternalLink, Megaphone, RefreshCw, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

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

function CascadeContent() {
  const params = useParams<{ id: string }>();
  const seedId = params?.id;
  const [summary, setSummary] = useState<SeedCascadeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!seedId) return;
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
    fetchSummary();
  }, [fetchSummary]);

  const [logOpen, setLogOpen] = useState(false);
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const canAnnounce =
    !!summary &&
    (summary.seedStatus === 'published' || summary.seedStatus === 'invited');

  const handleMarkAnnounced = async () => {
    if (!seedId || !summary) return;
    setAnnounceBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const channel =
        summary.announceChannel === 'call' || summary.announceChannel === 'email'
          ? summary.announceChannel
          : undefined;
      await directoryPresenceAdminService.markAnnounceDelivered(seedId, { channel });
      setActionSuccess('Announce marked delivered.');
      await fetchSummary();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark the announce delivered');
    } finally {
      setAnnounceBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={summary?.businessName ? `${summary.businessName} — Cascade` : 'Prospect cascade'}
        description="Four-act position derived from the seed touch ledger, linked campaign logs, gallery events, and tagged scans."
        icon={<Clock className="w-6 h-6" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLogOpen(true)}
              disabled={!canAnnounce}
              title={canAnnounce ? 'Log an announce/touch against this seed' : 'Publish the seed first'}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Megaphone className="w-4 h-4" />
              Log announce
            </button>
            <button
              type="button"
              onClick={handleMarkAnnounced}
              disabled={!canAnnounce || !!summary?.announceDeliveredAt || announceBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {announceBusy
                ? 'Saving…'
                : summary?.announceDeliveredAt
                  ? 'Announced'
                  : 'Mark announced'}
            </button>
            <Link
              href={seedId ? `/settings/admin/directory/presence-seeds/${seedId}` : '/settings/admin/directory/presence-seeds'}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="w-4 h-4" />
              Open seed
            </Link>
            <Link
              href="/settings/admin/directory/presence-seeds/announce-queue"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Clock className="w-4 h-4" />
              Announce queue
            </Link>
            <button
              type="button"
              onClick={fetchSummary}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href={seedId ? `/settings/admin/directory/presence-seeds/${seedId}` : '/settings/admin/directory/presence-seeds'}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to seed
            </Link>
          </div>
        }
      />

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {actionSuccess}
        </div>
      )}
      {summary && !canAnnounce && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {summary.seedStatus === 'claimed'
            ? 'This seed is claimed — the cascade is complete. Use Open seed for the claimed listing.'
            : summary.seedStatus === 'suppressed'
              ? 'This seed is suppressed — the cascade is paused.'
              : `This seed is ${summary.seedStatus}. Act 1 starts after the listing is published; use Open seed to finish QC and publish.`}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-400">
          Loading the cascade…
        </div>
      ) : !summary ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-400">
          No cascade data for this seed.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summary.acts.map((act) => {
              const style = STATUS_STYLES[act.status];
              const Icon = style.icon;
              return (
                <div
                  key={act.act}
                  id={`act-${act.act}`}
                  className="scroll-mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Act {act.act} · {act.name}
                    </h3>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.chip}`}>
                      <Icon className="w-3 h-3" />
                      {act.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{act.detail}</p>
                  <p className="mt-2 text-[10px] text-gray-400">Last event: {formatDate(act.lastEventAt)}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Walk-in gate</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${summary.gate.gateCleared ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                {summary.gate.gateCleared ? 'cleared' : 'not cleared'}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{summary.gate.reason}</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
              <span>Act 1: {summary.gate.act1Cleared ? 'cleared' : `missing ${summary.gate.missing.join(', ') || 'components'}`}</span>
              <span>Gallery opened: {formatDate(summary.gate.galleryOpenedAt)}</span>
              <span>Gallery-tagged scan: {formatDate(summary.gate.galleryTaggedScanAt)}</span>
              <span>Confirm-page scan: {formatDate(summary.gate.confirmScanAt)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-1 dark:border-neutral-700 dark:bg-neutral-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Linked campaigns</h3>
              {summary.linkedCampaigns.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">No campaign link.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {summary.linkedCampaigns.map((c) => (
                    <li key={c.id} className="text-xs">
                      <Link
                        href={`/settings/admin/marketing-ops/campaigns/${c.id}`}
                        className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {c.displayId || c.businessName || c.id}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <span className="ml-2 text-gray-500">{c.linkRole} · {c.stage || '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2 dark:border-neutral-700 dark:bg-neutral-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Timeline</h3>
              {summary.timeline.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">No touches or events yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-100 dark:divide-neutral-700">
                  {summary.timeline.map((event) => (
                    <li key={event.id} className="flex items-start gap-3 py-2 text-xs">
                      <span className="w-32 shrink-0 text-gray-400">{formatDate(event.at)}</span>
                      <span className="w-20 shrink-0 font-medium text-gray-600 dark:text-gray-300">{event.source.replace(/_/g, ' ')}</span>
                      <span className="min-w-0 flex-1 text-gray-800 dark:text-gray-200">
                        {event.label}
                        {event.notes ? <span className="ml-2 text-gray-400">{event.notes}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {logOpen && seedId && summary && (
        <ProspectTouchLogModal
          entry={{
            id: seedId,
            business_name: summary.businessName,
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
            await fetchSummary();
          }}
        />
      )}
    </div>
  );
}

export default function SeedCascadePage() {
  return (
    <MarketingOpsNavShell>
      <CascadeContent />
    </MarketingOpsNavShell>
  );
}
