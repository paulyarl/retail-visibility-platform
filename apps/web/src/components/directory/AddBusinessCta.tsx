'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';

interface AddBusinessCtaProps {
  category?: string;
  city?: string;
  state?: string;
  source: string;
  className?: string;
}

export default function AddBusinessCta({
  category,
  city,
  state,
  source,
  className = '',
}: AddBusinessCtaProps) {
  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (city) qs.set('city', city);
  if (state) qs.set('state', state);
  qs.set('source', source);

  const query = qs.toString();
  const href = `/directory/add-business${query ? `?${query}` : ''}`;

  return (
    <div
      className={[
        'rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 text-center',
        className,
      ].join(' ')}
    >
      <div className="flex items-center justify-center gap-2 text-neutral-900 dark:text-white mb-2">
        <Building2 className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold">Own a business that&apos;s missing?</h3>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
        Add your listing and get a free directory presence once our team verifies your information.
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
      >
        <Building2 className="w-4 h-4" />
        Add your business
      </Link>
    </div>
  );
}
