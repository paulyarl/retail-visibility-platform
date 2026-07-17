'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Package,
  RotateCcw,
  DollarSign,
  TrendingDown,
} from 'lucide-react';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { ReturnsService, type ReturnRequest, type ReturnSummary } from '@/services/ReturnsService';
import { clientLogger } from '@/lib/client-logger';

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
};

const REASON_LABELS: Record<string, string> = {
  damaged: 'Damaged/Defective',
  wrong_item: 'Wrong Item Received',
  not_as_described: 'Not As Described',
  changed_mind: 'Changed Mind',
  shipping_issue: 'Shipping Issue',
  other: 'Other',
};

export default function ReturnsPortalPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const { hasAccess, loading: accessLoading } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [summary, setSummary] = useState<ReturnSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ReturnsService.listReturns(tenantId, filterStatus || undefined);
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch returns');
    } finally {
      setLoading(false);
    }
  }, [tenantId, filterStatus]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await ReturnsService.getSummary(tenantId);
      setSummary(data);
    } catch (err) {
      clientLogger.error('Failed to fetch summary:', { detail: err });
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && hasAccess) {
      fetchRequests();
      fetchSummary();
    }
  }, [tenantId, hasAccess, fetchRequests, fetchSummary]);

  async function handleAction(id: string, action: 'approve' | 'reject' | 'complete') {
    try {
      setActionLoading(`${id}-${action}`);
      await ReturnsService.actionReturn(tenantId, id, action);
      await fetchRequests();
      await fetchSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} return`);
    } finally {
      setActionLoading(null);
    }
  }

  if (accessLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-4"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-neutral-500">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <RotateCcw className="w-8 h-8 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold">Returns Portal</h1>
          <p className="text-sm text-neutral-500">Manage customer return requests</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Pending</span>
            </div>
            <div className="text-2xl font-bold">{summary.requested}</div>
          </div>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-500 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Approved</span>
            </div>
            <div className="text-2xl font-bold">{summary.approved}</div>
          </div>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Rejected</span>
            </div>
            <div className="text-2xl font-bold">{summary.rejected}</div>
          </div>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-500 mb-1">
              <Package className="w-4 h-4" />
              <span className="text-xs font-medium">Completed</span>
            </div>
            <div className="text-2xl font-bold">{summary.completed}</div>
          </div>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-neutral-500 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Total Refunds</span>
            </div>
            <div className="text-2xl font-bold">
              ${(summary.totalRefundCents / 100).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'requested', 'approved', 'rejected', 'completed'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === s
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Returns List */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No return requests found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div
              key={req.id}
              className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[req.status] || ''}`}>
                      {req.status}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm font-medium">
                    Order: {req.order_id.slice(0, 12)}...
                  </div>
                  <div className="text-sm text-neutral-500">
                    {req.customer_name || req.customer_email}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm font-bold">
                    <DollarSign className="w-3 h-3" />
                    {(req.refund_amount_cents / 100).toFixed(2)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {REASON_LABELS[req.reason] || req.reason}
                  </div>
                </div>
              </div>

              <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                {req.items.length} item(s): {req.items.map(i => `${i.product_name} (x${i.quantity})`).join(', ')}
              </div>

              {req.reason_detail && (
                <div className="text-sm text-neutral-500 mb-3 italic">"{req.reason_detail}"</div>
              )}

              {/* Actions */}
              {req.status === 'requested' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(req.id, 'approve')}
                    disabled={actionLoading === `${req.id}-approve`}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(req.id, 'reject')}
                    disabled={actionLoading === `${req.id}-reject`}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
              {req.status === 'approved' && (
                <button
                  onClick={() => handleAction(req.id, 'complete')}
                  disabled={actionLoading === `${req.id}-complete`}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Mark Completed (Refund Processed)
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
