'use client';

import Link from 'next/link';
import { Lightbulb } from 'lucide-react';

interface SuggestBusinessCtaProps {
  category?: string;
  city?: string;
  state?: string;
  source: string;
  className?: string;
}

export default function SuggestBusinessCta({
  category,
  city,
  state,
  source,
  className = '',
}: SuggestBusinessCtaProps) {
  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (city) qs.set('city', city);
  if (state) qs.set('state', state);
  qs.set('source', source);

  const query = qs.toString();
  const href = `/directory/suggest${query ? `?${query}` : ''}`;

  return (
    <div
      className={[
        'rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-6 text-center',
        className,
      ].join(' ')}
    >
      <div className="flex items-center justify-center gap-2 text-neutral-900 dark:text-white mb-2">
        <Lightbulb className="w-5 h-5 text-yellow-500" />
        <h3 className="font-semibold">Don&apos;t see a business you know?</h3>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
        Help us build a better local directory. Suggest a missing business and our team will review it.
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium text-sm transition-colors"
      >
        <Lightbulb className="w-4 h-4" />
        Suggest a business
      </Link>
    </div>
  );
}
