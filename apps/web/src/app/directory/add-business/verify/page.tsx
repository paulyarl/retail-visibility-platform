import { Suspense } from 'react';
import type { Metadata } from 'next';
import VerifyBusinessClient from './VerifyBusinessClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verify Business Submission — VisibleShelf Directory',
  description: 'Confirm your business submission email to complete the process.',
};

export default function VerifyBusinessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyBusinessClient />
    </Suspense>
  );
}
