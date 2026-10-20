'use client';

/**
 * AnnounceQueueTable — the Four-Act cascade's published-but-unannounced
 * worklist. Pure presentational component so the row contract is render-
 * testable without the page's data fetch.
 *
 * The queue reads the `announce_scheduled` / `announce_delivered` markers on
 * the seed touch ledger (migration 348), not `outreach_state`.
 */

import Link from 'next/link';
import type { DirectoryAnnounceQueueRow } from '@/services/DirectoryPresenceAdminService';

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  invited: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

export function ageTone(ageDays: number | null): string {
  if (ageDays == null) return 'text-gray-500';
  if (ageDays >= 21) return 'text-red-600 font-semibold';
  if (ageDays >= 14) return 'text-amber-600 font-semibold';
  return 'text-gray-700';
}

export interface AnnounceQueueTableProps {
  rows: DirectoryAnnounceQueueRow[];
  busySeedId?: string | null;
  onMarkAnnounced: (row: DirectoryAnnounceQueueRow) => void;
  onLogAnnounce: (row: DirectoryAnnounceQueueRow) => void;
}

export default function AnnounceQueueTable({
  rows,
  busySeedId,
  onMarkAnnounced,
  onLogAnnounce,
}: AnnounceQueueTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-400">
        No published seeds are awaiting an announce.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-neutral-900 dark:text-gray-400">
          <tr>
            <th className="px-4 py-3">Business</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Age</th>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Links</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
          {rows.map((row) => (
            <tr key={row.seedId} className="align-top">
              <td className="px-4 py-3">
                <Link
                  href={`/settings/admin/directory/presence-seeds/${row.seedId}`}
                  className="font-medium text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                >
                  {row.businessName || 'Untitled seed'}
                </Link>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {row.category} · {row.city}, {row.state}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {row.status}
                </span>
              </td>
              <td className={`px-4 py-3 text-xs ${ageTone(row.ageDays)}`}>
                {row.ageDays == null ? '—' : `${row.ageDays}d`}
              </td>
              <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                {row.channel || '—'}
              </td>
              <td className="px-4 py-3 text-xs">
                <div className="flex flex-col gap-1">
                  {row.claimUrl ? (
                    <a
                      href={row.claimUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Claim link
                    </a>
                  ) : (
                    <span className="text-gray-400">No claim token</span>
                  )}
                  {row.placeUrl ? (
                    <a
                      href={row.placeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Listing
                    </a>
                  ) : null}
                  <Link
                    href={`/settings/admin/directory/presence-seeds/${row.seedId}/cascade`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Cascade
                  </Link>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onLogAnnounce(row)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700"
                  >
                    Log announce
                  </button>
                  <button
                    type="button"
                    disabled={busySeedId === row.seedId}
                    onClick={() => onMarkAnnounced(row)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busySeedId === row.seedId ? 'Saving…' : 'Mark announced'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
