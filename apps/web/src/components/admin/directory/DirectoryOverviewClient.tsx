'use client';

import DirectoryOverviewStats from '@/components/admin/directory/DirectoryOverviewStats';
import { useAdminDirectoryStats } from '@/hooks/admin/useAdminDirectoryStats';

export default function DirectoryOverviewClient() {
  const { stats, loading, error } = useAdminDirectoryStats();

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">Failed to load statistics</p>
      </div>
    );
  }

  return <DirectoryOverviewStats stats={stats} />;
}
