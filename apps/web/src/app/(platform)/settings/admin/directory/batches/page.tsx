import { Suspense } from 'react';
import BatchOperationsClient from './BatchOperationsClient';

export default function BatchOperationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading...</div>}>
      <BatchOperationsClient />
    </Suspense>
  );
}
