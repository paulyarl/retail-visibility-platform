'use client';

/**
 * Proving Grounds index — lists campaign_category='proving_ground' campaigns
 * grouped by city/state → category (spec §4.2: one proving ground per
 * city/category signature), linking each into its cockpit (Migration 262).
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Loader2, FlaskConical, MapPin, ExternalLink, Plus } from 'lucide-react';
import marketingOpsService, { type Campaign } from '@/services/MarketingOpsService';

type ProvingGroundGroup = {
  market: string;
  city: string;
  state: string;
  categories: { category: string; campaigns: Campaign[] }[];
  total: number;
};

export default function ProvingGroundsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { items } = await marketingOpsService.listCampaigns({
          campaignCategory: 'proving_ground',
          limit: 200,
        });
        setCampaigns(items);
      } catch (err: any) {
        setError(err.message || 'Failed to load proving grounds');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) =>
      [c.title, c.category, c.city, c.state].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [campaigns, search]);

  const groups = useMemo<ProvingGroundGroup[]>(() => {
    const byMarket = new Map<string, Campaign[]>();
    for (const c of filtered) {
      const city = c.city?.trim() || 'No market';
      const state = c.state?.trim() || '';
      const key = state ? `${city}, ${state}` : city;
      if (!byMarket.has(key)) byMarket.set(key, []);
      byMarket.get(key)!.push(c);
    }
    return Array.from(byMarket.entries())
      .map(([market, items]) => {
        const [city, state = ''] = market.split(', ');
        const byCategory = new Map<string, Campaign[]>();
        for (const c of items) {
          const cat = c.category?.trim() || 'Uncategorized';
          if (!byCategory.has(cat)) byCategory.set(cat, []);
          byCategory.get(cat)!.push(c);
        }
        return {
          market,
          city,
          state,
          categories: Array.from(byCategory.entries())
            .map(([category, campaigns]) => ({ category, campaigns }))
            .sort((a, b) => a.category.localeCompare(b.category)),
          total: items.length,
        };
      })
      .sort((a, b) => a.market.localeCompare(b.market));
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading proving grounds…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            One proving ground per city/category — the operator workspace for a market launch.
          </p>
          <span className="rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 px-2 py-0.5 text-xs font-medium">
            {filtered.length} campaign{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by title, category, city…"
            className="w-56 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <Link
            href="/settings/admin/marketing-ops/campaigns/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
          >
            <Plus className="w-3.5 h-3.5" />
            New Campaign
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-2 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-8 text-center">
          <FlaskConical className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {campaigns.length === 0
              ? <>No proving grounds yet — create a city-scope campaign with category <span className="font-mono">proving_ground</span>.</>
              : 'No proving grounds match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.market}>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{group.market}</h2>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {group.total} proving ground{group.total === 1 ? '' : 's'}
                </span>
              </div>
              {group.categories.map(({ category, campaigns: cats }) => (
                <div key={category} className="mb-3 ml-6">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
                    {category}
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cats.map((c) => (
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
                                {[c.category, c.city, c.state].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
