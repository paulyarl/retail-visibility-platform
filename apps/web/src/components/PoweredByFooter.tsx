'use client';

import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Link from 'next/link';

export function PoweredByFooter() {
  const { settings: platformSettings } = usePlatformSettings();

  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">⚡Powered by</span>
          {platformSettings?.logoUrl && (
            <img
              src={platformSettings.logoUrl}
              alt={platformSettings.platformName || 'Platform Logo'}
              className="h-6 w-auto object-contain"
              loading="lazy"
              decoding="async"
              width="24"
              height="24"
              style={{ aspectRatio: 'auto' }}
            />
          )}
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              {platformSettings?.platformName || 'Visible Shelf'}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
