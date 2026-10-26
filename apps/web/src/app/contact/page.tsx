'use client';

import { Suspense } from 'react';
import ContactPageClient from './ContactPageClient';

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <ContactPageClient />
    </Suspense>
  );
}
