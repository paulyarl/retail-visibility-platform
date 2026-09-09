'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { adminAnalyticsService, CategoryEmergenceRow } from '@/services/AdminAnalyticsService';
import { clientLogger } from '@/lib/client-logger';
import { BarChart3, RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function CategoryEmergencePage() {
  const [rows, setRows] = useState<CategoryEmergenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    state: '',
    city: '',
    category: '',
    minCount: '',
    kind: '' as '' | 'primary' | 'secondary',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminAnalyticsService.getCategoryEmergence({
        state: filters.state || undefined,
        city: filters.city || undefined,
        category: filters.category || undefined,
        minCount: filters.minCount ? Number(filters.minCount) : undefined,
        kind: filters.kind || undefined,
      });
      setRows(data || []);
    } catch (err) {
      clientLogger.error('Failed to load category emergence:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to load category emergence');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Category Emergence"
        description="See how many published listings fall into each category, per served location, to spot emerging sub-niches."
        icon={<BarChart3 className="w-6 h-6 text-blue-600" />}
        backLink={{ href: '/settings/admin/directory', label: 'Back to Directory' }}
        actions={
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <input
          type="text"
          placeholder="State"
          value={filters.state}
          onChange={(e) => updateFilter('state', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        />
        <input
          type="text"
          placeholder="City"
          value={filters.city}
          onChange={(e) => updateFilter('city', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        />
        <input
          type="text"
          placeholder="Category"
          value={filters.category}
          onChange={(e) => updateFilter('category', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        />
        <input
          type="number"
          min={1}
          placeholder="Min count"
          value={filters.minCount}
          onChange={(e) => updateFilter('minCount', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        />
        <select
          value={filters.kind}
          onChange={(e) => updateFilter('kind', e.target.value as '' | 'primary' | 'secondary')}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        >
          <option value="">All kinds</option>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
        </select>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12">
          <div className="animate-pulse space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Kind
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No category emergence data matches the current filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`${row.state}-${row.city}-${row.category}-${row.kind}-${index}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {row.city}, {row.state}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {row.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            row.kind === 'primary'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}
                        >
                          {row.kind}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900 dark:text-white">
                        {row.listingCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
