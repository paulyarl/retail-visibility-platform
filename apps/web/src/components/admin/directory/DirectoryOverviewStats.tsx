'use client';

import { DirectoryStats } from '@/hooks/admin/useAdminDirectoryStats';

interface DirectoryOverviewStatsProps {
  stats: DirectoryStats;
}

export default function DirectoryOverviewStats({ stats }: DirectoryOverviewStatsProps) {
  const publishedPercent = stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Listings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Listings
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {stats.total.toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Published */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Published
            </p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
              {stats.published.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {publishedPercent}% of total
            </p>
          </div>
          <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Featured */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Featured
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
              {stats.featured.toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Draft */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Draft
            </p>
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
              {stats.draft.toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-full">
            <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        </div>
      </div>

      {/* By Tier Breakdown */}
      {Object.keys(stats.byTier).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-2 lg:col-span-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Listings by Tier
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.byTier).map(([tier, count]) => (
              <div key={tier} className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {count}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {tier.replace('_', ' ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
