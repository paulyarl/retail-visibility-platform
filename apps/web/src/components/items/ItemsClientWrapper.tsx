"use client";

import dynamic from 'next/dynamic';

// Dynamically import ItemsClient with SSR disabled
const ItemsClient = dynamic(() => import('./ItemsClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">Loading inventory...</p>
        </div>
      </div>
    </div>
  ),
});

export default ItemsClient;
