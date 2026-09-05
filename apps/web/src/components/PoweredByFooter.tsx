'use client';

import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Link from 'next/link';

export function PoweredByFooter({ note, showBusinessOwnersLink = true }: { note?: string; showBusinessOwnersLink?: boolean }) {
  const { settings: platformSettings } = usePlatformSettings();

  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {note && (
          <p className="text-xs text-neutral-500 dark:text-neutral-500 text-center leading-relaxed max-w-2xl mx-auto mb-3">
            {note}
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">⚡Powered by</span>
          {platformSettings?.logoUrl && (
            <Link href="/" title={platformSettings?.platformName || 'Visible Shelf'} style={{ textDecoration: 'none' }} >
            <img
              src={platformSettings.logoUrl}
              alt={platformSettings.platformName || 'Platform Logo'}
              className="h-6 w-auto object-contain"
              loading="lazy"
              decoding="async"
              width="24"
              height="24"
              style={{ aspectRatio: 'auto' }}
            /></Link>
          )}
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              {platformSettings?.platformName || 'Visible Shelf'}
            </span>
          </Link>
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          <Link href="/terms" className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Privacy
          </Link>
          <Link href="/legal" className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Legal
          </Link>
          {showBusinessOwnersLink && (
            <Link href="/place/about" className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              For Business Owners
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
