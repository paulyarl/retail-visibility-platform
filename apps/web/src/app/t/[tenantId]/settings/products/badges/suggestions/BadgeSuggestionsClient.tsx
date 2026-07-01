'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, ArrowUpRight, ArrowDownRight, AlertTriangle, RefreshCw,
  ArrowLeft, CheckCircle, XCircle, Tag,
} from 'lucide-react';
import Link from 'next/link';
import badgeSuggestionsService, {
  type BadgeSuggestionsResponse,
  type BadgeSuggestion,
  type BadgeConflict,
} from '@/services/BadgeSuggestionsService';

interface BadgeSuggestionsClientProps {
  tenantId: string;
}

export default function BadgeSuggestionsClient({ tenantId }: BadgeSuggestionsClientProps) {
  const [data, setData] = useState<BadgeSuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await badgeSuggestionsService.getSuggestions(tenantId);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load badge suggestions');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
        <button
          onClick={fetchSuggestions}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const summary = data?.summary;
  const hasData = summary && summary.totalSuggestions > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/t/${tenantId}/settings/products/badges`}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Badges
            </Link>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Auto-Promotion Suggestions
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Products that match badge rules. Review and apply suggestions to keep badges up-to-date.
          </p>
        </div>
        <button
          onClick={fetchSuggestions}
          className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SummaryCard
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
            label="To Assign"
            count={summary.assignCount}
            bgClass="bg-green-50 border-green-200"
          />
          <SummaryCard
            icon={<XCircle className="w-5 h-5 text-orange-600" />}
            label="To Remove"
            count={summary.removeCount}
            bgClass="bg-orange-50 border-orange-200"
          />
          <SummaryCard
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            label="Conflicts"
            count={summary.conflictCount}
            bgClass="bg-red-50 border-red-200"
          />
          <SummaryCard
            icon={<Tag className="w-5 h-5 text-blue-600" />}
            label="Total"
            count={summary.totalSuggestions}
            bgClass="bg-blue-50 border-blue-200"
          />
        </div>
      )}

      {/* No Data State */}
      {!hasData && (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No badge suggestions at this time.</p>
          <p className="text-gray-400 text-sm mt-1">
            All products are up-to-date with their badge rules.
          </p>
        </div>
      )}

      {/* Assign Suggestions */}
      {data && data.toAssign.length > 0 && (
        <SuggestionTable
          title="Suggested Badge Assignments"
          icon={<ArrowUpRight className="w-5 h-5 text-green-600" />}
          suggestions={data.toAssign}
          actionLabel="Assign"
          actionClass="bg-green-600 hover:bg-green-700"
        />
      )}

      {/* Remove Suggestions */}
      {data && data.toRemove.length > 0 && (
        <SuggestionTable
          title="Suggested Badge Removals"
          icon={<ArrowDownRight className="w-5 h-5 text-orange-600" />}
          suggestions={data.toRemove}
          actionLabel="Remove"
          actionClass="bg-orange-600 hover:bg-orange-700"
        />
      )}

      {/* Conflicts */}
      {data && data.conflicts.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
          <div className="p-4 border-b border-red-200 bg-red-50">
            <h2 className="font-semibold flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Badge Conflicts ({data.conflicts.length})
            </h2>
            <p className="text-sm text-red-600 mt-1">
              These badges cannot be auto-assigned because they conflict with existing badges.
            </p>
          </div>
          <div className="divide-y">
            {data.conflicts.map((conflict, i) => (
              <ConflictRow key={`${conflict.inventoryItemId}-${conflict.badgeKey}-${i}`} conflict={conflict} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, count, bgClass,
}: { icon: React.ReactNode; label: string; count: number; bgClass: string }) {
  return (
    <div className={`rounded-lg border p-4 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  );
}

function SuggestionTable({
  title, icon, suggestions, actionLabel, actionClass,
}: {
  title: string;
  icon: React.ReactNode;
  suggestions: BadgeSuggestion[];
  actionLabel: string;
  actionClass: string;
}) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="font-semibold flex items-center gap-2">
          {icon}
          {title} ({suggestions.length})
        </h2>
      </div>
      <div className="divide-y">
        {suggestions.map((s, i) => (
          <div key={`${s.inventoryItemId}-${s.badgeKey}-${i}`} className="p-4 flex items-center justify-between hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Tag className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  <span className="inline-flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-mono">
                      {s.badgeKey}
                    </span>
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Item: {s.inventoryItemId.substring(0, 8)}...
                </p>
              </div>
            </div>
            <button
              className={`px-3 py-1.5 text-xs text-white rounded-lg ${actionClass}`}
              disabled
              title="Manual action required — apply from the product management page"
            >
              {actionLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConflictRow({ conflict }: { conflict: BadgeConflict }) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <div>
          <p className="font-medium text-sm">
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-mono">
              {conflict.badgeKey}
            </span>
            <span className="text-gray-400 mx-2">conflicts with</span>
            {conflict.conflictsWith.map(c => (
              <span key={c} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-mono mr-1">
                {c}
              </span>
            ))}
          </p>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            Item: {conflict.inventoryItemId.substring(0, 8)}...
          </p>
        </div>
      </div>
    </div>
  );
}
