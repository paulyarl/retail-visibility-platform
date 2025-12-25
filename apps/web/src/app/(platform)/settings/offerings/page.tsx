'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { MANAGED_SERVICES, type ServiceLevel } from '@/lib/managed-services';
import { CHAIN_TIERS, type ChainTier } from '@/lib/chain-tiers';
import { SubscriptionStatusGuide } from '@/components/subscription/SubscriptionStatusGuide';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function OfferingsPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Platform Offerings & Benefits"
        description="Explore all our subscription tiers, managed services, and features"
        icon={Icons.Settings}
        backLink={{
          href: '/settings',
          label: 'Back to Settings'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Subscription Status Guide: only visible during maintenance or freeze windows */}
        <SubscriptionStatusGuide />
        
        {/* What You Get Overview */}
        <section>
          <h2 className="text-3xl font-bold text-neutral-900 mb-6 text-center">Complete Online Presence Solution</h2>
          <p className="text-lg text-neutral-600 mb-8 text-center max-w-3xl mx-auto">
            Everything you need to dominate local search and drive customers to your store
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Quick Start - NEW! */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-blue-400 rounded-lg p-6 text-white relative shadow-xl">
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-purple-900 text-xs px-3 py-1 rounded-full font-bold">
                NEW!
              </div>
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-lg font-bold mb-2">Quick Start Wizard</h3>
              <ul className="space-y-1 text-sm">
                <li>• 50 products in 1 second!</li>
                <li>• 360x faster than manual</li>
                <li>• No scanning, no CSV</li>
                <li>• Auto-categorized</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-blue-300">
                <span className="text-xs font-semibold">GAME CHANGER!</span>
              </div>
            </div>

            {/* Multi-Location Management - STARTER+ */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-blue-400 rounded-lg p-6 text-white relative shadow-xl">
              <div className="absolute -top-2 -right-2 bg-green-400 text-blue-900 text-xs px-3 py-1 rounded-full font-bold">
                STARTER+
              </div>
              <div className="text-4xl mb-3">🔗</div>
              <h3 className="text-lg font-bold mb-2">Multi-Location Management</h3>
              <ul className="space-y-1 text-sm">
                <li>• Starter: Products & user roles propagation</li>
                <li>• Professional: + Hours, profile, categories, GBP sync, flags</li>
                <li>• Organization: + Brand assets, selective, scheduling, rollback</li>
                <li>• Update all locations at once</li>
                <li>• Save hours every week</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-blue-300">
                <span className="text-xs font-semibold">Available on Starter tier with 2+ locations!</span>
              </div>
            </div>

            {/* Storefront */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-6">
              <div className="text-4xl mb-3">🏪</div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Complete Storefront</h3>
              <ul className="space-y-1 text-sm text-neutral-700">
                <li>• Product catalog with search</li>
                <li>• Mobile-responsive design</li>
                <li>• Interactive store maps</li>
                <li>• Automatic SEO optimization</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-blue-300">
                <span className="text-xs font-semibold text-blue-800">No website developer needed!</span>
              </div>
            </div>

            {/* Google Integration */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-6">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Google Integration Suite</h3>
              <ul className="space-y-1 text-sm text-neutral-700">
                <li>• Google Shopping feeds</li>
                <li>• Business Profile sync</li>
                <li>• Google Maps integration</li>
                <li>• Local SEO optimization</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-green-300">
                <span className="text-xs font-semibold text-green-800">Dominate local search!</span>
              </div>
            </div>

            {/* QR Marketing */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-lg p-6">
              <div className="text-4xl mb-3">📱</div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">QR Code Marketing</h3>
              <ul className="space-y-1 text-sm text-neutral-700">
                <li>• High-res QR codes</li>
                <li>• Print-ready formats</li>
                <li>• Product-specific codes</li>
                <li>• Trackable campaigns</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-purple-300">
                <span className="text-xs font-semibold text-purple-800">Bridge print to digital!</span>
              </div>
            </div>

            {/* Analytics */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-lg p-6">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Performance Analytics</h3>
              <ul className="space-y-1 text-sm text-neutral-700">
                <li>• Impression tracking</li>
                <li>• Click analytics</li>
                <li>• Product performance</li>
                <li>• ROI measurement</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-amber-300">
                <span className="text-xs font-semibold text-amber-800">Data-driven decisions!</span>
              </div>
            </div>
          </div>

          {/* Second row of features */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {/* SKU Scanning + Analytics - BREAKTHROUGH! */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-green-400 rounded-lg p-6 text-white relative shadow-xl">
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-green-900 text-xs px-3 py-1 rounded-full font-bold">
                BREAKTHROUGH
              </div>
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="text-lg font-bold mb-2">Scanning + Intelligence</h3>
              <ul className="space-y-1 text-sm">
                <li>• Complete product data capture</li>
                <li>• Real-time analytics dashboard</li>
                <li>• Data quality tracking</li>
                <li>• Product preview tool</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-green-300">
                <span className="text-xs font-semibold">Intelligence + insights!</span>
              </div>
            </div>

            {/* Smart Categories + GMB Alignment */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200 rounded-lg p-6 relative">
              <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-3 py-1 rounded-full font-bold">
                M3
              </div>
              <div className="text-4xl mb-3">🏷️</div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Categories + GMB Sync</h3>
              <ul className="space-y-1 text-sm text-neutral-700">
                <li>• Tenant ↔ GMB category sync</li>
                <li>• 5,595 Google categories</li>
                <li>• Auto-categorization</li>
                <li>• Out-of-sync detection</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-indigo-300">
                <span className="text-xs font-semibold text-indigo-800">Perfect alignment!</span>
              </div>
            </div>

            {/* Business Hours */}
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-2 border-cyan-200 rounded-lg p-6">
              <div className="text-4xl mb-3">🕐</div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Business Hours Sync</h3>
              <ul className="space-y-1 text-sm text-neutral-700">
                <li>• Google Profile sync</li>
                <li>• Holiday hours</li>
                <li>• Special events</li>
                <li>• Real-time updates</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-cyan-300">
                <span className="text-xs font-semibold text-cyan-800">Set once, update everywhere!</span>
              </div>
            </div>

            {/* QR Marketing */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-lg p-6">
              <div className="text-4xl mb-3">📱</div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">QR Code Marketing</h3>
              <ul className="space-y-1 text-sm text-neutral-700">
                <li>• High-res QR codes</li>
                <li>• Print-ready formats</li>
                <li>• Product-specific codes</li>
                <li>• Trackable campaigns</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-purple-300">
                <span className="text-xs font-semibold text-purple-800">Bridge print to digital!</span>
              </div>
            </div>
          </div>

          {/* Quick Start + Scanning Integration Callout */}
          <div className="mt-6 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-xl p-8 text-white">
            <div className="text-center mb-6">
              <div className="inline-block bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold text-sm mb-3">
                ⚡ POWER COMBO
              </div>
              <h3 className="text-2xl font-bold mb-2">Quick Start + Scanning Work Together!</h3>
              <p className="text-blue-100 max-w-2xl mx-auto">
                These aren't competing features—they're a <strong className="text-yellow-300">perfectly aligned system</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Step 1 */}
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-center mb-2">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-blue-600">1</span>
                  </div>
                  <h4 className="font-bold text-sm">⚡ Quick Start</h4>
                </div>
                <ul className="space-y-1 text-xs">
                  <li>✓ Generate 100 products (5 min)</li>
                  <li>✓ Basic info created</li>
                  <li>⚠ Missing images & details</li>
                </ul>
              </div>

              {/* Step 2 */}
              <div className="bg-yellow-400 rounded-lg p-4 border-2 border-yellow-300 text-yellow-900">
                <div className="text-center mb-2">
                  <div className="w-8 h-8 bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-yellow-400">2</span>
                  </div>
                  <h4 className="font-bold text-sm">📱 Scan to Enrich</h4>
                </div>
                <ul className="space-y-1 text-xs">
                  <li>✓ Detects matches (50 min)</li>
                  <li>✓ Adds images & descriptions</li>
                  <li>✓ No duplicates!</li>
                </ul>
              </div>

              {/* Step 3 */}
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-center mb-2">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg">🎉</span>
                  </div>
                  <h4 className="font-bold text-sm">Complete!</h4>
                </div>
                <ul className="space-y-1 text-xs">
                  <li>★ 100 enriched products</li>
                  <li>★ Professional quality</li>
                  <li>★ Ready in 55 minutes</li>
                </ul>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20 text-center">
              <p className="text-sm mb-1">
                <strong className="text-yellow-300">Save $394.58 and 15.75 hours</strong> per 100 products
              </p>
              <p className="text-xs text-blue-100">
                vs. 16.7 hours of manual entry • 94% time reduction
              </p>
            </div>
          </div>

          <div className="mt-6 bg-gradient-to-r from-primary-50 to-primary-100 border-2 border-primary-300 rounded-lg p-6 text-center">
            <p className="text-lg font-semibold text-primary-900 mb-2">
              🚀 Zero to Online in Minutes
            </p>
            <p className="text-sm text-primary-800 mb-4">
              Add your business info, upload products, and get a complete online presence instantly. No coding, no designers, no hassle.
            </p>
            <button
              onClick={() => window.open('/tenant/cmhe0edxg0002g8s8bba4j2s0', '_blank')}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors"
            >
              <span>👀</span>
              <span>View Sample Storefront</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">What's Included at Each Level</h2>
          <p className="text-neutral-600 mb-6">Each tier builds on the previous oneStarter gives you core visibility, Professional adds POS and intelligence, Enterprise adds AI automation and chain management, Organization adds full chain control.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Starter Core Tier */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">f680</span>
                <h3 className="font-bold text-blue-900 text-lg">Starter (Core)</h3>
              </div>
              <p className="text-xs text-blue-700 mb-3 italic">Core visibility and storefront for small retailers.</p>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5"></span>
                  <span><strong>Storefront with product catalog & search</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5"></span>
                  <span>Directory listing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5"></span>
                  <span>Google Shopping feeds & Merchant Center sync</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5"></span>
                  <span>Basic barcode scanner + manual entry</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5"></span>
                  <span>Basic product enrichment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5"></span>
                  <span>QR codes & basic analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5"></span>
                  <span><strong>Up to 3 locations  500 SKUs per location</strong></span>
                </li>
              </ul>
              <div className="mt-4 pt-4 border-t border-blue-300">
                <p className="text-xs font-semibold text-blue-900">Your complete online presence, out of the box.</p>
              </div>
            </div>

            {/* Professional Adds */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">b50</span>
                <h3 className="font-bold text-purple-900 text-lg">Professional Adds</h3>
              </div>
              <p className="text-xs text-purple-700 mb-3 italic">Everything in Starter, plus POS, intelligence, and automation.</p>
              <ul className="space-y-2 text-sm text-purple-800">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5"></span>
                  <span><strong>Quick Start Wizard</strong> (500 products in seconds)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5"></span>
                  <span>SKU scanning + inventory intelligence</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5"></span>
                  <span>Full Google Business Profile & Shopping suite</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5"></span>
                  <span>Clover + Square POS integration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5"></span>
                  <span>Advanced analytics & reporting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5"></span>
                  <span>Bulk operations & CSV import/export</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5"></span>
                  <span><strong>Up to 10 locations  5,000 SKUs per location</strong></span>
                </li>
              </ul>
            </div>

            {/* Enterprise Adds */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">f451</span>
                <h3 className="font-bold text-amber-900 text-lg">Enterprise Adds</h3>
              </div>
              <p className="text-xs text-amber-700 mb-3 italic">Everything in Professional, plus full connector + AI automation.</p>
              <ul className="space-y-2 text-sm text-amber-800">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5"></span>
                  <span>API access & custom integrations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5"></span>
                  <span>Advanced chain management with hero-location testing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5"></span>
                  <span>White-label storefront & custom branding</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5"></span>
                  <span>AI-assisted product enrichment & copy</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5"></span>
                  <span>Dedicated account manager & SLA-backed support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5"></span>
                  <span><strong>Up to 25 locations  10,000+ SKUs per location</strong></span>
                </li>
              </ul>
            </div>

            {/* Organization Adds */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">f3e2</span>
                <h3 className="font-bold text-emerald-900 text-lg">Organization Adds</h3>
              </div>
              <p className="text-xs text-emerald-700 mb-3 italic">Everything in Enterprise, plus full chain control for franchises & chains.</p>
              <ul className="space-y-2 text-sm text-emerald-800">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5"></span>
                  <span><strong>Unlimited locations</strong> & SKUs (within technical limits)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5"></span>
                  <span>Multiple propagation types across all stores</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5"></span>
                  <span>Hero location & brand asset distribution</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5"></span>
                  <span>Org-level dashboard & analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5"></span>
                  <span>Org-level billing, custom contracts & pricing</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <div className="mt-6 bg-green-50 border-2 border-green-300 rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-green-900">
              💡 <strong>Chain pricing works the same way!</strong> Chain Starter includes all Starter features, Chain Professional adds Professional features, etc. You just get massive discounts for multiple locations.
            </p>
          </div>

        {/* Individual Location Subscriptions */}
        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Individual Location Subscriptions</h2>
          <p className="text-neutral-600 mb-6">Perfect for individual retailers and small chains</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Starter */}
            <Card className="border-2 border-neutral-200">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle>Starter</CardTitle>
                  <Badge variant="default" className="bg-blue-100 text-blue-800">$29/mo</Badge>
                </div>
                <p className="text-sm text-neutral-600">Core visibility and storefront</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span><strong>Up to 3 locations</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span><strong>Up to 500 SKUs per location</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Public storefront with catalog & search</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Directory listing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Google Shopping feeds & Merchant Center sync</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Basic barcode scanner + manual entry</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Basic product enrichment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>QR codes & basic analytics</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Professional */}
            <Card className="border-2 border-primary-500 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="success" className="bg-green-500 text-white">POPULAR</Badge>
              </div>
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle>Professional</CardTitle>
                  <Badge variant="default" className="bg-purple-100 text-purple-800">$99/mo</Badge>
                </div>
                <p className="text-sm text-neutral-600">Connected & growing retailers (POS + intelligence)</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span><strong>Up to 10 locations</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span><strong>Up to 5,000 SKUs per location</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Quick Start Wizard (500 products in seconds)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>SKU scanning + inventory intelligence</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Full Google Business Profile & Shopping suite</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Clover + Square POS integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Advanced analytics & bulk operations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>CSV import/export & higher enrichment quotas</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="border-2 border-neutral-200">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle>Enterprise</CardTitle>
                  <Badge variant="default" className="bg-amber-100 text-amber-800">$499/mo</Badge>
                </div>
                <p className="text-sm text-neutral-600">Full connector + AI automation</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span><strong>Up to 25 locations</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span><strong>10,000+ SKUs per location</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>API access & custom integrations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Advanced chain management with hero-location testing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>White-label storefront & custom branding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>AI-assisted product enrichment & copy</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Dedicated account manager & SLA-backed support</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Organization */}
            <Card className="border-2 border-emerald-300">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle>Organization</CardTitle>
                  <Badge variant="default" className="bg-emerald-100 text-emerald-800">Custom</Badge>
                </div>
                <p className="text-sm text-neutral-600">For chains & franchises (25+ locations)</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span><strong>Unlimited locations</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Unlimited SKUs (within technical limits)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Full chain management & multi-type propagation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Hero location & brand asset distribution</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Org-level analytics and billing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5"></span>
                    <span>Custom contracts & pricing</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Chain/Multi-Location Subscriptions */}
        <section>
          <div className="text-center mb-8">
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white mb-4">
              🚀 ENTERPRISE CHAIN MANAGEMENT
            </Badge>
            <h2 className="text-3xl font-bold text-neutral-900 mb-3">Multi-Location Chain Pricing</h2>
            <p className="text-lg text-neutral-600 mb-4">Massive savings for chains and franchises</p>
            
            {/* Chain Features Callout */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-6 max-w-4xl mx-auto mb-8">
              <h3 className="text-xl font-bold text-emerald-900 mb-3">✨ Exclusive Chain Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-emerald-900">One-Click Chain Sync</p>
                    <p className="text-sm text-emerald-700">Distribute 100s of products to all locations instantly</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <div>
                    <p className="font-semibold text-emerald-900">Chain-Wide Updates</p>
                    <p className="text-sm text-emerald-700">Update photos, descriptions, pricing everywhere at once</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-emerald-900">Hero Location</p>
                    <p className="text-sm text-emerald-700">Designate HQ as master catalog source</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-emerald-900">Save 400+ Hours</p>
                    <p className="text-sm text-emerald-700">Per product rollout vs manual entry</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-emerald-200">
                <p className="text-sm text-emerald-800 text-center">
                  <strong>ROI Example:</strong> 50-location chain saves $25,000+ in labor costs per product rollout
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.values(CHAIN_TIERS).map((tier) => (
              <Card key={tier.name} className="border-2 border-neutral-200">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle>{tier.name}</CardTitle>
                    <Badge variant="default" className={tier.color}>{tier.price}</Badge>
                  </div>
                  <p className="text-sm text-neutral-600">
                    {tier.maxLocations === Infinity ? 'Unlimited' : tier.maxLocations} locations • 
                    {tier.maxTotalSKUs === Infinity ? ' Unlimited' : ` ${tier.maxTotalSKUs.toLocaleString()}`} SKUs
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-900">
              <strong>Example Savings:</strong> 10-location chain saves 66% ($1,490/mo → $499/mo with Chain Professional)
            </p>
          </div>
        </section>

        {/* Managed Services */}
        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Managed Services</h2>
          <p className="text-neutral-600 mb-6">Let our team manage your inventory for you</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.values(MANAGED_SERVICES).filter(s => s.id !== 'self_service').map((service) => (
              <Card key={service.id} className={`border-2 ${service.popular ? 'border-primary-500 shadow-lg' : 'border-neutral-200'}`}>
                {service.popular && (
                  <div className="bg-primary-500 text-white text-center py-1 text-xs font-semibold">
                    MOST POPULAR
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <p className="text-xs text-neutral-600">{service.tagline}</p>
                  <div className="mt-2">
                    {service.monthlyFee > 0 && (
                      <div className="text-2xl font-bold text-neutral-900">${service.monthlyFee}/mo</div>
                    )}
                    {service.skuSetupCost > 0 && (
                      <div className="text-sm text-neutral-600">${service.skuSetupCost}/SKU setup</div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-xs">
                    {service.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5 text-xs">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Focus on your business.</strong> Our team handles data entry, photos, descriptions, and ongoing updates.
            </p>
          </div>
        </section>

        {/* All Benefits Summary */}
        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Everything You Need to Succeed Online</h2>
          <p className="text-neutral-600 mb-6">All the tools to drive foot traffic and dominate local search</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🏪</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Complete Online Storefront</h3>
                <p className="text-sm text-neutral-600">
                  Professional product catalog with search, mobile-responsive design, and automatic SEO. No website developer needed—just add products and go live!
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🗺️</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Interactive Store Maps</h3>
                <p className="text-sm text-neutral-600">
                  Embedded Google Maps with "Get Directions" button. Privacy mode option to show neighborhood instead of exact location. Drive foot traffic to your store!
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🔍</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Google Business Profile Integration</h3>
                <p className="text-sm text-neutral-600">
                  Connect with your Google Business Profile. Display your business info consistently across Google Search and Maps. (Full sync with hours and posts coming soon!)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🛍️</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Google Shopping Integration</h3>
                <p className="text-sm text-neutral-600">
                  Automatic product feed generation and Google Merchant Center integration. Get your products in front of millions of shoppers searching on Google.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">📱</div>
                <h3 className="font-semibold text-neutral-900 mb-2">QR Code Marketing</h3>
                <p className="text-sm text-neutral-600">
                  Generate high-resolution QR codes for in-store marketing. Print on flyers, business cards, and store windows. Bridge print to digital seamlessly!
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🔎</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Product Search</h3>
                <p className="text-sm text-neutral-600">
                  Powerful search functionality on your storefront. Customers can instantly find products by name, brand, SKU, or description. Fast database-level search!
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🌐</div>
                <h3 className="font-semibold text-neutral-900 mb-2">SEO-Optimized Pages</h3>
                <p className="text-sm text-neutral-600">
                  Professional product pages with NAP consistency, structured data, and mobile-responsive design. Rank higher in local search results automatically.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">📊</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Performance Analytics</h3>
                <p className="text-sm text-neutral-600">
                  Track impressions, clicks, and sales. Understand what products perform best and optimize your inventory accordingly. Data-driven decisions!
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🏢</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Multi-Location Support</h3>
                <p className="text-sm text-neutral-600">
                  Manage multiple locations with centralized billing, shared SKU pools, and consistent branding. Perfect for chains and franchises with massive savings!
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Flexible Plans Section */}
        <section className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-5xl mb-4">🔄</div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-3">Flexible Plans That Grow With You</h2>
            <p className="text-neutral-700 mb-6">
              Your business needs change, and your subscription should too. We make it easy to adjust your plan anytime.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg p-6 border-2 border-green-200">
                <div className="text-3xl mb-2">⬆️</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Upgrade Anytime</h3>
                <p className="text-sm text-neutral-600">
                  Need more SKUs or features? Upgrade instantly to unlock more capabilities. No contracts, no hassle.
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 border-2 border-blue-200">
                <div className="text-3xl mb-2">⬇️</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Downgrade Anytime</h3>
                <p className="text-sm text-neutral-600">
                  Scaling back? Downgrade to a lower tier or even Google-Only to save costs while keeping your presence.
                </p>
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900">
                💡 <strong>Pro Tip:</strong> Start with Google-Only ($29/mo) to test the platform, then upgrade to Starter when you're ready for a full storefront. Change plans from your subscription page anytime!
              </p>
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg mb-6 opacity-90">
            Choose the plan that's right for your business. Change it anytime as your needs evolve.
          </p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => window.location.href = '/settings/subscription'}
              className="bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-neutral-100 transition-colors"
            >
              View Subscription Plans
            </button>
            <button 
              onClick={() => window.location.href = '/settings/contact'}
              className="bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-800 transition-colors border-2 border-white"
            >
              Contact Sales
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
