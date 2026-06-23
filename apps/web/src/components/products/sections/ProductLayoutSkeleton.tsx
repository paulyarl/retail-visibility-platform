'use client';

type LayoutVariant = 'classic' | 'showcase' | 'quick-commerce';

interface ProductLayoutSkeletonProps {
  layoutVariant?: LayoutVariant;
}

export function ProductLayoutSkeleton({ layoutVariant = 'showcase' }: ProductLayoutSkeletonProps) {
  if (layoutVariant === 'quick-commerce') {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 animate-pulse">
        <div className="h-14 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-6">
            <div className="aspect-square bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
            <div className="space-y-3">
              <div className="h-6 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-4 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-10 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-14 w-full bg-neutral-200 dark:bg-neutral-800 rounded-lg mt-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="h-4 w-64 bg-neutral-200 dark:bg-neutral-800 rounded mb-4" />
        <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800 rounded mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-8">
          <div className="aspect-square bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-4 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-10 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-12 w-full bg-neutral-200 dark:bg-neutral-800 rounded-lg mt-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
