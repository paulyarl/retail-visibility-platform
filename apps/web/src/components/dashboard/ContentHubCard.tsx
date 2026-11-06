'use client';

/**
 * ContentHubCard — TenantDashboardV2 entry card for the Content hub.
 * Shows surfaces-live count + the top gap nudge, deep-links to /content.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { contentHubService } from '@/services/ContentHubService';
import { topNudge, type ContentSummaryPayload } from '@/lib/content-hub';

export default function ContentHubCard({ tenantId }: { tenantId: string }) {
  const [summary, setSummary] = useState<ContentSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    contentHubService.getSummary(tenantId).then((sum) => {
      if (!cancelled) {
        setSummary(sum);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const nudge = summary ? topNudge(summary.channels) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Content</h3>
        {!loading && summary && (
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            {summary.surfaces.live} of {summary.surfaces.total} live
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-10 bg-gray-50 rounded-xl animate-pulse" />
      ) : (
        <p className="text-sm text-gray-600 mb-3">
          {nudge ?? 'All your publishing surfaces, one place.'}
        </p>
      )}
      <Link
        href={`/t/${tenantId}/content`}
        className="text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        Open Content hub →
      </Link>
    </div>
  );
}
