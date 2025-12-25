'use client';

import Link from 'next/link';
import PublicFooter from '@/components/PublicFooter';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function LegalPage() {
  const { settings } = usePlatformSettings();
  const platformName = settings?.platformName || 'Visible Shelf';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-neutral-900 hover:text-primary-600 transition-colors">
            {platformName}
          </Link>
          <Link href="/login" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
            Sign In
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold text-neutral-900 mb-4">Legal Center</h1>
            <p className="text-neutral-600 mb-8 text-sm">
              Last updated: November 2025
            </p>

            <p className="text-neutral-700 mb-6">
              {platformName} is built by retailers, for retailers. Part of treating your catalog and
              customer data like a real asset is being clear about how the service works, what you
              can expect from us, and how we handle information. This page brings the key legal
              documents into one simple place.
            </p>

            <div className="grid gap-6 md:grid-cols-2 mt-8">
              <div className="border border-neutral-200 rounded-lg p-5 hover:border-primary-200 hover:shadow-sm transition-colors">
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">Privacy Policy</h2>
                <p className="text-neutral-700 text-sm mb-4">
                  How we collect, use, and protect data about you, your business, and your
                  customers when you use {platformName}. Includes how connected tools like Google
                  and POS systems send data into the platform.
                </p>
                <Link
                  href="/privacy"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 underline"
                >
                  Read Privacy Policy
                </Link>
              </div>

              <div className="border border-neutral-200 rounded-lg p-5 hover:border-primary-200 hover:shadow-sm transition-colors">
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">Terms of Service</h2>
                <p className="text-neutral-700 text-sm mb-4">
                  The rules of the road for using {platformName}: account responsibilities,
                  subscriptions and billing, acceptable use, and what happens if the service or your
                  account changes.
                </p>
                <Link
                  href="/terms"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 underline"
                >
                  Read Terms of Service
                </Link>
              </div>
            </div>

            <p className="text-neutral-500 text-xs mt-8">
              These pages are product-facing summaries written in plain language and are not a
              substitute for formal legal advice. Depending on your location and any separate
              agreement you have with us, additional terms or rights may apply.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
