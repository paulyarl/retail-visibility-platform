'use client';

import Link from 'next/link';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import {
  ShieldCheck,
  MapPin,
  Tag,
  ShoppingBag,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

// ─── Entry Presence Mode metadata ───────────────────────────────────────
// Duplicated from DirectoryPresenceUpgradeOptionsService.ENTRY_PRESENCE_MODES
// (module-private on the backend). Keep in sync if the backend modes change.
const ENTRY_PRESENCE_MODES_STATIC = [
  {
    mode: 'directory',
    icon: MapPin,
    surface: 'Platform in-house directory',
    tagline: 'Own your directory listing',
    description: 'Correct your NAP, hours, and categories. Your listing becomes a third-party citation that reinforces your local SEO.',
    features: ['Verified NAP and hours', 'Category alignment', 'Public place page with SEO'],
  },
  {
    mode: 'google',
    icon: TrendingUp,
    surface: 'Third-party (Google)',
    tagline: 'Get found on Google',
    description: 'Upgrade to Discovery for Google Search and Maps visibility, review response tools, and GBP optimization.',
    features: ['Google Search visibility', 'Maps presence', 'Review response pipeline'],
  },
  {
    mode: 'platform',
    icon: ShoppingBag,
    surface: 'Platform in-house marketplace',
    tagline: 'Open your platform store',
    description: 'Upgrade to Storefront for a shoppable platform storefront with product browse, checkout, and fulfillment options.',
    features: ['Shoppable storefront', 'Product catalog', 'Checkout and fulfillment'],
  },
];

// ─── Product slot teaser ────────────────────────────────────────────────
const PRODUCT_SLOTS = 5;

export default function PlaceAboutClient() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-6">
            <ShieldCheck className="w-4 h-4" />
            For Business Owners
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Your listing is live. Here&apos;s what comes next.
          </h1>
          <p className="text-lg text-blue-100 leading-relaxed max-w-2xl">
            VisibleShelf gives local businesses a free directory presence with the option to
            upgrade when you&apos;re ready. Claim your listing to verify your details, list
            products, and reach more customers.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/directory"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-semibold"
            >
              Browse the directory <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 transition-colors font-semibold"
            >
              See full platform features
            </Link>
          </div>
        </div>
      </div>

      {/* Entry Presence Modes */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          Three ways to grow your presence
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8">
          Start free with a directory listing. Upgrade when you need more.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ENTRY_PRESENCE_MODES_STATIC.map((mode) => {
            const Icon = mode.icon;
            return (
              <div
                key={mode.mode}
                className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
                  {mode.tagline}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-500 mb-3">
                  {mode.surface}
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
                  {mode.description}
                </p>
                <ul className="space-y-2">
                  {mode.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                      <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Product Slot Teaser */}
      <div className="bg-white dark:bg-neutral-900 border-t border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium mb-4">
                <Tag className="w-3 h-3" />
                Free with your claimed listing
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
                List your first {PRODUCT_SLOTS} products
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Once you claim your listing, you can add up to {PRODUCT_SLOTS} signature products
                to your storefront — free with your Directory Presence tier. It&apos;s enough to
                showcase your best offerings and see how the platform works before upgrading.
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-4">
                Need more? Upgrade to Discovery for 75 products or Storefront for 200.
              </p>
            </div>
            <div className="flex justify-center">
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: PRODUCT_SLOTS }, (_, i) => (
                  <div
                    key={i}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-400 dark:text-neutral-600"
                  >
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">
          Ready to claim your listing?
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-xl mx-auto">
          Claiming is free and takes less than a minute. Verify your details, update your hours,
          and start managing your online presence.
        </p>
        <Link
          href="/directory"
          className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
        >
          Find your listing <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <PoweredByFooter />
    </div>
  );
}
