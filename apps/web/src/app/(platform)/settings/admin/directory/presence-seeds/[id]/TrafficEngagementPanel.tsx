'use client';

/**
 * TrafficEngagementPanel — Layer 3 "Traffic & Engagement" panel for a single
 * directory presence seed.
 *
 * Shows the claim funnel (listing_viewed → claim_clicked → accepted),
 * engagement counts, avg dwell, device split, and a recent-events feed.
 *
 * Data: GET /api/admin/directory-presence/presence-seeds/:id/engagement
 *       GET /api/admin/directory-presence/presence-seeds/:id/funnel
 *
 * Design doc: docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md §8.2
 */

import { useCallback, useEffect, useState } from 'react';
import directoryPresenceAdminService, {
  type DirectoryClaimFunnel,
  type DirectoryEngagementSummary,
  type DirectoryPresenceRecentEvent,
} from '@/services/DirectoryPresenceAdminService';
import { Activity, Eye, MousePointerClick, Phone, Navigation, Loader2, RefreshCw, ExternalLink } from 'lucide-react';

const WINDOW_OPTIONS = [7, 30, 90] as const;

const EVENT_LABELS: Record<string, string> = {
  listing_viewed: 'Listing viewed',
  claim_clicked: 'Claim clicked',
  call_clicked: 'Call clicked',
  directions_clicked: 'Directions clicked',
  qr_scanned: 'QR scanned',
  session_heartbeat: 'Heartbeat',
  session_end: 'Session ended',
};

interface Props {
  seedId: string;
}

export default function TrafficEngagementPanel({ seedId }: Props) {
  const [daysBack, setDaysBack] = useState<(typeof WINDOW_OPTIONS)[number]>(30);
  const [engagement, setEngagement] = useState<
    (DirectoryEngagementSummary & { recentEvents: DirectoryPresenceRecentEvent[] }) | null
  >(null);
  const [funnel, setFunnel] = useState<DirectoryClaimFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eng, fun] = await Promise.all([
        directoryPresenceAdminService.getSeedEngagement(seedId, daysBack),
        directoryPresenceAdminService.getSeedFunnel(seedId, daysBack),
      ]);
      if (!eng) {
        setError('Failed to load engagement.');
        setEngagement(null);
        setFunnel(null);
        return;
      }
      setEngagement(eng);
      setFunnel(fun);
    } catch {
      setError('Failed to load engagement.');
    } finally {
      setLoading(false);
    }
  }, [seedId, daysBack]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Traffic &amp; Engagement
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Engagement events captured on the public listing — claim funnel, clicks, dwell, and recent activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value) as (typeof WINDOW_OPTIONS)[number])}
            className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {WINDOW_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {loading && !engagement ? (
        <div className="py-8 text-center text-sm text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading engagement…
        </div>
      ) : engagement ? (
        <>
          {/* Engagement counts */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard icon={<Eye className="w-4 h-4 text-blue-600" />} label="Views" value={engagement.views} />
            <MetricCard
              icon={<MousePointerClick className="w-4 h-4 text-purple-600" />}
              label="Claim clicks"
              value={engagement.claimClicks}
            />
            <MetricCard
              icon={<ExternalLink className="w-4 h-4 text-indigo-600" />}
              label="Storefront clicks"
              value={engagement.storefrontClicks}
            />
            <MetricCard icon={<Phone className="w-4 h-4 text-green-600" />} label="Call clicks" value={engagement.callClicks} />
            <MetricCard
              icon={<Navigation className="w-4 h-4 text-cyan-600" />}
              label="Directions clicks"
              value={engagement.directionsClicks}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Claim funnel */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Claim funnel</h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
                On-page CTA conversion (view → claim click → accepted). Invite/QR-driven cohort
                conversion lives on the Seed Funnel page.
              </p>
              {!funnel ? (
                <p className="text-xs text-gray-400">No funnel data.</p>
              ) : (
                <div className="space-y-2">
                  <FunnelRow label="Views" value={funnel.views} />
                  <FunnelRow
                    label="Claim clicks"
                    value={funnel.claimClicks}
                    rate={funnel.viewToClickRate}
                    rateLabel="of views"
                  />
                  <FunnelRow
                    label="Claims accepted"
                    value={funnel.claimsAccepted}
                    rate={funnel.clickToAcceptRate}
                    rateLabel="of clicks"
                  />
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                Avg session dwell: {(engagement.avgDwellMs / 1000).toFixed(1)}s · Unique sessions:{' '}
                {engagement.uniqueSessions}
              </div>
            </div>

            {/* Recent events */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recent activity</h3>
              {engagement.recentEvents.length === 0 ? (
                <p className="text-xs text-gray-400">No events recorded yet.</p>
              ) : (
                <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {engagement.recentEvents.slice(0, 12).map((e) => (
                    <li key={e.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 dark:text-gray-200">
                        {EVENT_LABELS[e.eventType] ?? e.eventType}
                      </span>
                      <span className="text-gray-400">
                        {e.deviceType ? `${e.deviceType} · ` : ''}
                        {formatTime(e.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Device split */}
          {engagement.deviceSplit.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
              <span className="font-medium text-gray-500 dark:text-gray-400">Devices:</span>
              {engagement.deviceSplit.map((d) => (
                <span key={d.deviceType} className="capitalize">
                  {d.deviceType} · {d.events}
                </span>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="text-lg font-semibold text-gray-900 dark:text-white">{value.toLocaleString()}</div>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  rate,
  rateLabel,
}: {
  label: string;
  value: number;
  rate?: number | null;
  rateLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-700 dark:text-gray-200">{label}</span>
      <span className="text-gray-900 dark:text-white font-medium">
        {value.toLocaleString()}
        {rate != null && (
          <span className="ml-2 text-xs text-gray-400">
            {Math.round(rate * 100)}% {rateLabel}
          </span>
        )}
      </span>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
