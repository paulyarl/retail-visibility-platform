import { Suspense } from 'react';
import type { Metadata } from 'next';
import SuggestionsQueueClient from './SuggestionsQueueClient';

export const metadata: Metadata = {
  title: 'Public Suggestions — Directory Admin',
};

export const dynamic = 'force-dynamic';

export default function SuggestionsQueuePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading suggestions...</div>}>
      <SuggestionsQueueClient />
    </Suspense>
  );
}
