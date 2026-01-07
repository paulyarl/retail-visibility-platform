'use client';

import Link from 'next/link';
import { Sparkles, Zap, RefreshCw, Globe, Store, Package, ArrowRight, CheckCircle } from 'lucide-react';
import { PoweredByFooter } from '@/components/PoweredByFooter';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function AboutDirectoryClient() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Hero Section */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4" />
              Zero-Effort Directory
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-white mb-6">
              The Magic Behind This Directory
            </h1>
            
            <p className="text-xl text-neutral-600 dark:text-neutral-400 mb-8">
              No manual curation. No data entry. No maintenance. <br />
              <strong>Just pure automation.</strong>
            </p>

            <Link
              href="/directory"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Browse Directory
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* The Magic Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* One Action, Three Benefits */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4">
                One Action, Three Benefits
              </h2>
              <p className="text-lg text-neutral-600 dark:text-neutral-400">
                When a store owner adds a product, magic happens everywhere
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Storefront */}
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Store className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                  1. Their Storefront
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Product appears instantly on their custom storefront, ready for customers to discover
                </p>
              </div>

              {/* Directory */}
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                  2. This Directory
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Store automatically appears in category listings, making them discoverable to new customers
                </p>
              </div>

              {/* Google */}
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                  3. Google Search
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Product syncs to Google Business Profile, showing up in local searches
                </p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4">
                How It Works
              </h2>
              <p className="text-lg text-neutral-600 dark:text-neutral-400">
                The platform does all the heavy lifting
              </p>
            </div>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4 items-start bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                    Store Owner Adds Product
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    They scan a barcode or enter product details. That's it. That's all they do.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4 items-start bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                    Platform Enriches Everything
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    AI fills in missing details, optimizes descriptions, assigns categories, and prepares the product for discovery.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4 items-start bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                    Directory Updates Automatically
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    This directory rebuilds itself in real-time. New products? New categories? New stores? All automatic.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4 items-start bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                    Customers Discover Stores
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    Shoppers browse by category, find exactly what they need, and discover local merchants they didn't know existed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* What Makes This Special */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4">
                What Makes This Special
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
                    No Manual Curation
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    Platform owners don't add stores or products. It happens automatically.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
                    Always Current
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    Real-time updates mean the directory is never stale or outdated.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
                    Zero Maintenance
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    No one needs to update categories, fix broken links, or clean up data.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
                    Grows Organically
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    More stores = more products = richer directory. Network effects built-in.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
                    Dual Discovery
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    Browse by product category OR store type. Two ways to find what you need.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
                    Apple-Like Experience
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    Same categories across directory, storefront, and dashboard. Seamless.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* The Result */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-8 md:p-12 text-center border border-blue-200 dark:border-blue-800">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 rounded-full text-sm font-semibold mb-6">
              <Zap className="w-4 h-4 text-yellow-500" />
              The Result
            </div>
            
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4">
              A Living, Breathing Directory
            </h2>
            
            <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8 max-w-2xl mx-auto">
              This isn't a static list. It's a dynamic ecosystem that grows, adapts, and improves automatically as merchants run their businesses.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/directory"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Explore the Directory
                <ArrowRight className="w-5 h-5" />
              </Link>
              
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors font-semibold border border-neutral-200 dark:border-neutral-700"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </div>

      
                        {/* Platform Branding Footer */}
                        <PoweredByFooter />
    </div>
  );
}
