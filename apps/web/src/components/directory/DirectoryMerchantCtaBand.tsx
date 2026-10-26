'use client';

import Link from 'next/link';
import { Search, Sparkles, Store as StoreIcon } from 'lucide-react';
import AddBusinessCta from './AddBusinessCta';
import SuggestBusinessCta from './SuggestBusinessCta';
import { usePlatformUrl } from '@/components/storefront/StorefrontUrlContext';

/**
 * DirectoryMerchantCtaBand — the owner-facing band that closes the directory
 * home in every layout variant.
 *
 * Seed-aware: the directory is built from public business information, so a
 * merchant arriving here is usually already listed. The primary action is
 * therefore "find your place page and claim it" — not account creation, which
 * is what /register (→ /auth/signup/wizard) asked of merchants who already have
 * a page built from public records. The not-listed and missing-business paths
 * follow as the same add/suggest pair the /place shelves close with, so the
 * band never assumes the visitor is new.
 */
export default function DirectoryMerchantCtaBand({
  source = '/directory',
}: {
  source?: string;
}) {
  const platformUrl = usePlatformUrl();

  return (
    <>
      <div className="mt-16 grid md:grid-cols-2 gap-6">
        <div className="p-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
          <div className="text-center">
            <StoreIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              Are you a merchant?
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Your store may already be listed — we build place pages from public
              business information. Claim yours free in about two minutes to verify
              your hours, phone, and address, and showcase 5 top sellers.
            </p>
            <Link
              href={platformUrl('/place/search')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              Find your listing →
            </Link>
          </div>
        </div>

        <div className="p-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 mb-3">
              <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                How does this work?
              </h2>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Discover the zero-effort magic behind this directory.
              No manual curation, just pure automation.
            </p>
            <Link
              href={platformUrl('/directory/about')}
              className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
            >
              See the Magic →
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        <AddBusinessCta source={source} />
        <SuggestBusinessCta source={source} />
      </div>
    </>
  );
}
