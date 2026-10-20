'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { MarketingOpsNavShell } from '@/components/marketing-ops/MarketingOpsPageShell';
import directoryPresenceAdminService, {
  type DirectoryAnnounceQueueRow,
} from '@/services/DirectoryPresenceAdminService';
import AnnounceQueueTable from './AnnounceQueueTable';
import ProspectTouchLogModal from '@/components/marketing-ops/ProspectTouchLogModal';
import { ArrowLeft, Clock, List, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

function AnnounceQueueContent() {
  const [rows, setRows] = useState<DirectoryAnnounceQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busySeedId, setBusySeedId] = useState<string | null>(null);
  const [logRow, setLogRow] = useState<DirectoryAnnounceQueueRow | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRows(await directoryPresenceAdminService.listAnnounceQueue());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the announce queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleMarkAnnounced = async (row: DirectoryAnnounceQueueRow) => {
    setBusySeedId(row.seedId);
    setError(null);
    setSuccess(null);
    try {
      const channel =
        row.channel === 'call' || row.channel === 'email' ? row.channel : undefined;
      const result = await directoryPresenceAdminService.markAnnounceDelivered(row.seedId, {
        channel,
      });
      if (!result.delivered) {
        setError(
          result.reason === 'already_delivered'
            ? 'This seed was already marked announced.'
            : 'Could not mark the announce delivered.',
        );
      } else {
        setSuccess(`${row.businessName || 'Seed'} marked announced.`);
      }
      await fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark the announce delivered');
    } finally {
      setBusySeedId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announce queue"
        description="Published seeds that have not been announced yet, oldest first. Marking a seed announced records the delivery marker the cascade reads."
        icon={<Clock className="w-6 h-6" />}
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

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <List className="w-4 h-4" />
          {loading ? 'Loading…' : `${rows.length} awaiting announce`}
        </p>
        <button
          type="button"
          onClick={fetchQueue}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-400">
          Loading the announce queue…
        </div>
      ) : (
        <AnnounceQueueTable
          rows={rows}
          busySeedId={busySeedId}
          onMarkAnnounced={handleMarkAnnounced}
          onLogAnnounce={(row) => setLogRow(row)}
        />
      )}

      {logRow && (
        <ProspectTouchLogModal
          entry={{
            id: logRow.seedId,
            business_name: logRow.businessName,
            title: null,
            business_snapshot: {
              verified_nap: {
                phone: logRow.ownerPhone || logRow.listingPhone,
                email: logRow.ownerEmail || logRow.listingEmail,
              },
            },
          }}
          seedId={logRow.seedId}
          onClose={() => setLogRow(null)}
          onLogged={async () => {
            setLogRow(null);
            await fetchQueue();
          }}
        />
      )}
    </div>
  );
}

export default function AnnounceQueuePage() {
  return (
    <MarketingOpsNavShell>
      <AnnounceQueueContent />
    </MarketingOpsNavShell>
  );
}
