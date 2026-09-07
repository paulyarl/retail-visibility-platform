'use client';

/**
 * Proving Grounds index — lists campaign_category='proving_ground' campaigns
 * and links each into its cockpit (Migration 262).
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, FlaskConical, MapPin, ExternalLink, Plus } from 'lucide-react';
import marketingOpsService, { type Campaign } from '@/services/MarketingOpsService';

export default function ProvingGroundsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await marketingOpsService.listCampaigns({
          campaignCategory: 'proving_ground',
          limit: 100,
        });
        setCampaigns(items);
      } catch (err: any) {
        setError(err.message || 'Failed to load proving grounds');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading proving grounds…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          One proving ground per city/category — the operator workspace for a market launch.
        </p>
        <Link
          href="/settings/admin/marketing-ops/campaigns/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
        >
          <Plus className="w-3.5 h-3.5" />
          New Campaign
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-2 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-8 text-center">
          <FlaskConical className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No proving grounds yet — create a city-scope campaign with category <span className="font-mono">proving_ground</span>.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/settings/admin/marketing-ops/proving-grounds/${c.id}`}
                className="block bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {c.title || `${c.category ?? 'Proving Ground'} · ${c.city ?? ''}`}
                      </span>
                      <span className="rounded bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300 px-1.5 py-0.5 text-[10px] font-medium">
                        {c.stage}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <MapPin className="w-3 h-3" />
                      {[c.category, c.city, c.state].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
