'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, AlertTriangle, CalendarCheck, CalendarDays } from 'lucide-react';
import marketingOpsService, { FollowUpsDueResult } from '@/services/MarketingOpsService';

export default function FollowUpsDueWidget() {
  const [data, setData] = useState<FollowUpsDueResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    marketingOpsService.getFollowUpsDue()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load follow-ups'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const buckets = [
    { key: 'overdue' as const, label: 'Overdue', items: data?.overdue ?? [], color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', icon: AlertTriangle, filter: 'overdue' },
    { key: 'dueToday' as const, label: 'Due today', items: data?.dueToday ?? [], color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: CalendarCheck, filter: 'due_today' },
    { key: 'thisWeek' as const, label: 'This week', items: data?.thisWeek ?? [], color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800/50', icon: CalendarDays, filter: 'this_week' },
  ];

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Follow-ups due</h3>
        </div>
        <Link
          href="/settings/admin/marketing-ops/campaigns"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Open list →
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {buckets.map((b) => {
            const Icon = b.icon;
            return (
              <Link
                key={b.key}
                href={`/settings/admin/marketing-ops/campaigns?follow_up=${b.filter}`}
                className={`rounded-lg ${b.bg} p-3 hover:opacity-80 transition-opacity`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3.5 w-3.5 ${b.color}`} />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{b.label}</span>
                </div>
                <p className={`text-2xl font-bold ${b.color}`}>{b.items.length}</p>
                {b.items.length > 0 && (
                  <p className="mt-1 truncate text-[10px] text-gray-500 dark:text-gray-400">
                    {b.items[0].business_name ?? b.items[0].campaign_id}
                    {b.items.length > 1 && ` +${b.items.length - 1} more`}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
