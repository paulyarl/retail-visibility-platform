import { Suspense } from 'react';
import BatchDetailClient from './BatchDetailClient';

export default function BatchDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading...</div>}>
      <BatchDetailClient />
    </Suspense>
  );
}
