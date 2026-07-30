'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, X, AlertCircle, CheckCircle, Wrench, Edit3, Save } from 'lucide-react';
import marketingOpsService, { FilterFlag, FilterFlagStatus } from '@/services/MarketingOpsService';

const STATUS_LABELS: Record<FilterFlagStatus, string> = {
  pending: 'Pending',
  fixed: 'Fixed',
  approved_as_is: 'Approved As-Is',
};

const STATUS_COLORS: Record<FilterFlagStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  fixed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  approved_as_is: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function FilterReviewClient() {
  const [flags, setFlags] = useState<FilterFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterFlagStatus | ''>('pending');
  const [updating, setUpdating] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketingOpsService.listFilterFlags({
        status: statusFilter || undefined,
      });
      setFlags(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load filter flags');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleUpdate = async (id: string, status: FilterFlagStatus, override?: string) => {
    setUpdating(id);
    try {
      await marketingOpsService.updateFilterFlag(id, { status, human_override: override });
      await fetchFlags();
    } catch (err: any) {
      setError(err.message || 'Failed to update flag');
    } finally {
      setUpdating(null);
    }
  };

  const handleBatchAction = async (status: FilterFlagStatus) => {
    const pendingFlags = flags.filter((f) => f.status === 'pending');
    if (pendingFlags.length === 0) return;
    setBatchProcessing(true);
    setError(null);
    try {
      await Promise.all(
        pendingFlags.map((f) =>
          marketingOpsService.updateFilterFlag(f.id, { status })
        )
      );
      await fetchFlags();
    } catch (err: any) {
      setError(err.message || 'Failed to batch update flags');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleStartEdit = (flag: FilterFlag) => {
    setEditingId(flag.id);
    setEditValue(flag.human_override || flag.suggested_fix || '');
  };

  const handleSaveEdit = async (id: string) => {
    setUpdating(id);
    try {
      await marketingOpsService.updateFilterFlag(id, {
        status: 'fixed',
        human_override: editValue,
      });
      setEditingId(null);
      await fetchFlags();
    } catch (err: any) {
      setError(err.message || 'Failed to save override');
    } finally {
      setUpdating(null);
    }
  };

  const pendingCount = flags.filter((f) => f.status === 'pending').length;
  const fixedCount = flags.filter((f) => f.status === 'fixed').length;
  const approvedCount = flags.filter((f) => f.status === 'approved_as_is').length;
  const passRate = flags.length > 0
    ? ((fixedCount + approvedCount) / flags.length) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Filter Review</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {pendingCount} pending review{pendingCount !== 1 ? 's' : ''} · {flags.length} total · {passRate.toFixed(0)}% pass rate
            </p>
          </div>
          <button
            onClick={fetchFlags}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Batch Actions */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <span className="text-sm font-medium text-amber-800 dark:text-amber-400">
              {pendingCount} pending flag{pendingCount !== 1 ? 's' : ''} awaiting review
            </span>
            <div className="flex-1" />
            <button
              onClick={() => handleBatchAction('fixed')}
              disabled={batchProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Wrench className="w-3.5 h-3.5" />
              Fix All
            </button>
            <button
              onClick={() => handleBatchAction('approved_as_is')}
              disabled={batchProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve All
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterFlagStatus | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="fixed">Fixed</option>
            <option value="approved_as_is">Approved As-Is</option>
          </select>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : flags.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-gray-400 dark:text-gray-500">No filter flags to review.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => (
              <div key={flag.id} className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Execution: {flag.execution_id.slice(0, 12)}...
                    </p>
                    {flag.response_number != null && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Response #{flag.response_number}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[flag.status]}`}>
                    {STATUS_LABELS[flag.status]}
                  </span>
                </div>

                {flag.failed_checks && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Failed Checks</p>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-neutral-900/50 rounded p-2">
                      {typeof flag.failed_checks === 'string'
                        ? flag.failed_checks
                        : JSON.stringify(flag.failed_checks, null, 2)}
                    </pre>
                  </div>
                )}

                {flag.suggested_fix && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Suggested Fix</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{flag.suggested_fix}</p>
                  </div>
                )}

                {flag.human_override && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Human Override</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{flag.human_override}</p>
                  </div>
                )}

                {flag.status === 'pending' && (
                  <div className="mt-3">
                    {editingId === flag.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter corrected output..."
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(flag.id)}
                            disabled={updating === flag.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save & Mark Fixed
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdate(flag.id, 'fixed')}
                          disabled={updating === flag.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark Fixed
                        </button>
                        <button
                          onClick={() => handleUpdate(flag.id, 'approved_as_is')}
                          disabled={updating === flag.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve As-Is
                        </button>
                        <button
                          onClick={() => handleStartEdit(flag)}
                          disabled={updating === flag.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit Override
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
