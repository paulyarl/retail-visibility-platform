"use client";

export default function OrgDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Skeleton */}
        <div className="mb-6">
          <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        </div>

        {/* Tab Nav Skeleton */}
        <div className="mb-6 flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-28 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Hero Banner Skeleton */}
        <div className="mb-6 h-24 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />

        {/* KPI Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>

        {/* Content Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
