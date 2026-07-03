'use client';

import { Card, Button, Badge, Title, Text } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { MANAGED_SERVICES, type ServiceLevel } from '@/lib/managed-services';
import { CHAIN_TIERS, type ChainTier } from '@/lib/chain-tiers';
import { SubscriptionStatusGuide } from '@/components/subscription/SubscriptionStatusGuide';
import { FeatureMappingDisplay } from '@/components/tiers/FeatureMappingDisplay';
import { TierComparisonTable } from '@/components/tiers/TierComparisonTable';
import { ContentConsistencyValidator } from '@/components/tiers/ContentConsistencyValidator';
import { ChainPricingSection } from '@/components/tiers/ChainPricingSection';


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
          <Title order={2} ta="center" mb="md">Complete Online Presence Solution</Title>
          <Text size="lg" c="dimmed" ta="center" maw={600} mx="auto" mb="xl">
            Everything you need to dominate local search and drive customers to your store
          </Text>
          
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
              onClick={() => window.location.href = '/directory'}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors"
            >
              <span>👀</span>
              <span>Browse Storefronts</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
          <Title order={2} mb="xs">What's Included at Each Level</Title>
          <Text c="dimmed" mb="xl">Each tier builds on the previous one with clear progression: Discovery → Storefront → Commitment → E-commerce → Omnichannel → Enterprise. Tiers are aligned to business models, not just feature accumulation.</Text>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Discovery ($29) */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🔍</span>
                <h3 className="font-bold text-blue-900 text-base">Discovery</h3>
                <Badge className="bg-blue-100 text-blue-800 text-xs">$29/mo</Badge>
              </div>
              <p className="text-xs text-blue-700 mb-2 italic">"I exist online"</p>
              <p className="text-xs text-blue-600 mb-3">People are finding my products on Google</p>
              <ul className="space-y-1 text-xs text-blue-800">
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Clover POS integration</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Google Search indexing</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Google Shopping visibility</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Google Maps / SWIS</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Directory listing</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>QR codes</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>14-day free trial</span>
                </li>
              </ul>
              <div className="mt-3 pt-3 border-t border-blue-300">
                <p className="text-xs font-semibold text-blue-900">Get Found on Google</p>
              </div>
            </div>

            {/* Storefront ($59) */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🏪</span>
                <h3 className="font-bold text-purple-900 text-base">Storefront</h3>
                <Badge className="bg-purple-100 text-purple-800 text-xs">$59/mo</Badge>
              </div>
              <p className="text-xs text-purple-700 mb-2 italic">"I have a store online"</p>
              <p className="text-xs text-purple-600 mb-3">Shoppers are browsing — but can't act on it</p>
              <ul className="space-y-1 text-xs text-purple-800">
                <li className="flex items-start gap-1">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>Everything in Discovery</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-600 mt-0.5">+</span>
                  <span>Platform product visibility</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-600 mt-0.5">+</span>
                  <span>Branded storefront page</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-600 mt-0.5">+</span>
                  <span>Platform search & browse</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-600 mt-0.5">+</span>
                  <span>Shopper inquiry</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>14-day free trial</span>
                </li>
              </ul>
              <div className="mt-3 pt-3 border-t border-purple-300">
                <p className="text-xs font-semibold text-purple-900">Own Your Platform Presence</p>
              </div>
            </div>

            {/* Commitment ($79) */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🛒</span>
                <h3 className="font-bold text-green-900 text-base">Commitment</h3>
                <Badge className="bg-green-100 text-green-800 text-xs">$79/mo</Badge>
              </div>
              <p className="text-xs text-green-700 mb-2 italic">"I drive foot traffic"</p>
              <p className="text-xs text-green-600 mb-3">Deposit-only commerce for physical retailers</p>
              <ul className="space-y-1 text-xs text-green-800">
                <li className="flex items-start gap-1">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Everything in Storefront</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-green-600 mt-0.5">+</span>
                  <span>Add to cart & checkout</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-green-600 mt-0.5">+</span>
                  <span>Holding deposits (10-15%)</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-green-600 mt-0.5">+</span>
                  <span>BOPIS / click & collect</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-green-600 mt-0.5">+</span>
                  <span>Conversion analytics</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-green-600 mt-0.5">+</span>
                  <span>Branded QR codes</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>14-day free trial</span>
                </li>
              </ul>
              <div className="mt-3 pt-3 border-t border-green-300">
                <p className="text-xs font-semibold text-green-900">Capture Intent and Drive Foot Traffic</p>
              </div>
            </div>

            {/* E-commerce ($99) */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">�️</span>
                <h3 className="font-bold text-amber-900 text-base">E-commerce</h3>
                <Badge className="bg-amber-100 text-amber-800 text-xs">$99/mo</Badge>
              </div>
              <p className="text-xs text-amber-700 mb-2 italic">"I sell online"</p>
              <p className="text-xs text-amber-600 mb-3">Full-payment only for online merchants</p>
              <ul className="space-y-1 text-xs text-amber-800">
                <li className="flex items-start gap-1">
                  <span className="text-amber-600 mt-0.5">✓</span>
                  <span>Everything in Storefront</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-amber-600 mt-0.5">+</span>
                  <span>Add to cart & checkout</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-amber-600 mt-0.5">+</span>
                  <span>Full online payments</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-amber-600 mt-0.5">+</span>
                  <span>Delivery & fulfilment</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-amber-600 mt-0.5">+</span>
                  <span>Conversion analytics</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-amber-600 mt-0.5">✓</span>
                  <span>14-day free trial</span>
                </li>
              </ul>
              <div className="mt-3 pt-3 border-t border-amber-300">
                <p className="text-xs font-semibold text-amber-900">Sell Online — Fully & Simply</p>
              </div>
            </div>

            {/* Omnichannel ($149) */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🔄</span>
                <h3 className="font-bold text-indigo-900 text-base">Omnichannel</h3>
                <Badge className="bg-indigo-100 text-indigo-800 text-xs">$149/mo</Badge>
              </div>
              <p className="text-xs text-indigo-700 mb-2 italic">"I sell everywhere"</p>
              <p className="text-xs text-indigo-600 mb-3">Physical + online — shopper chooses path</p>
              <ul className="space-y-1 text-xs text-indigo-800">
                <li className="flex items-start gap-1">
                  <span className="text-indigo-600 mt-0.5">✓</span>
                  <span>Everything in E-commerce</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-indigo-600 mt-0.5">+</span>
                  <span>Payment path choice</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-indigo-600 mt-0.5">+</span>
                  <span>Both deposit & full payment</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-indigo-600 mt-0.5">+</span>
                  <span>BOPIS + delivery options</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-indigo-600 mt-0.5">+</span>
                  <span>Advanced analytics</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-indigo-600 mt-0.5">+</span>
                  <span>API access</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-indigo-600 mt-0.5">✓</span>
                  <span>14-day free trial</span>
                </li>
              </ul>
              <div className="mt-3 pt-3 border-t border-indigo-300">
                <p className="text-xs font-semibold text-indigo-900">Physical + Online — Unified Commerce</p>
              </div>
            </div>

            {/* Enterprise ($499) */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🏢</span>
                <h3 className="font-bold text-red-900 text-base">Enterprise</h3>
                <Badge className="bg-red-100 text-red-800 text-xs">$499/mo</Badge>
              </div>
              <p className="text-xs text-red-700 mb-2 italic">"I run a business empire"</p>
              <p className="text-xs text-red-600 mb-3">Multi-location with enterprise tools</p>
              <ul className="space-y-1 text-xs text-red-800">
                <li className="flex items-start gap-1">
                  <span className="text-red-600 mt-0.5">✓</span>
                  <span>Everything in Omnichannel</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-red-600 mt-0.5">+</span>
                  <span>Multi-location support</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-red-600 mt-0.5">+</span>
                  <span>Dedicated support</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-red-600 mt-0.5">+</span>
                  <span>Enterprise security</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-red-600 mt-0.5">+</span>
                  <span>Custom contracts</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-red-600 mt-0.5">+</span>
                  <span>White-label options</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-red-600 mt-0.5">✓</span>
                  <span>14-day free trial</span>
                </li>
              </ul>
              <div className="mt-3 pt-3 border-t border-red-300">
                <p className="text-xs font-semibold text-red-900">Complete Business Solution</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 bg-green-50 border-2 border-green-300 rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-green-900">
              💡 <strong>Chain pricing works the same way!</strong> Chain tiers follow the same 6-tier structure with massive discounts for multiple locations. Any organization can choose Discovery through Enterprise tiers.
            </p>
          </div>

        {/* Individual Location Subscriptions */}
        <section>
          <Title order={2} mb="xs">Individual Location Subscriptions</Title>
          <Text c="dimmed" mb="xl">Perfect for individual retailers and small chains</Text>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Discovery ($29) */}
            <Card className="border-2 border-blue-200">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-blue-900">Discovery</h3>
                  <Badge variant="default" className="bg-blue-100 text-blue-800">$29/mo</Badge>
                </div>
                <p className="text-xs text-blue-700 italic mb-1">"I exist online"</p>
                <p className="text-sm text-neutral-600">Get Found on Google</p>
              </div>
              <div className="p-4 pt-0">
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>Clover POS integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>Google Search & Shopping</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>Google Maps / SWIS</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>Directory listing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>QR codes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>14-day free trial</span>
                  </li>
                </ul>
              </div>
            </Card>

            {/* Storefront ($59) */}
            <Card className="border-2 border-purple-200">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-purple-900">Storefront</h3>
                  <Badge variant="default" className="bg-purple-100 text-purple-800">$59/mo</Badge>
                </div>
                <p className="text-xs text-purple-700 italic mb-1">"I have a store online"</p>
                <p className="text-sm text-neutral-600">Own Your Platform Presence</p>
              </div>
              <div className="p-4 pt-0">
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>Everything in Discovery</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5 text-xs">+</span>
                    <span>Platform product visibility</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5 text-xs">+</span>
                    <span>Branded storefront</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5 text-xs">+</span>
                    <span>Platform search & browse</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5 text-xs">+</span>
                    <span>Shopper inquiries</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>14-day free trial</span>
                  </li>
                </ul>
              </div>
            </Card>

            {/* Commitment ($79) - POPULAR */}
            <Card className="border-2 border-green-500 shadow-lg relative" withBorder padding="lg" radius="md">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="success" className="bg-green-500 text-white text-xs">POPULAR</Badge>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-green-900">Commitment</h3>
                  <Badge variant="default" className="bg-green-100 text-green-800">$79/mo</Badge>
                </div>
                <p className="text-xs text-green-700 italic mb-1">"I am selling online"</p>
                <p className="text-sm text-neutral-600">Capture Intent and Drive Foot Traffic</p>
              </div>
              <div className="p-4 pt-0">
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>Everything in Storefront</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5 text-xs">+</span>
                    <span>Add to cart & checkout</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5 text-xs">+</span>
                    <span>Holding deposits (10-15%)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5 text-xs">+</span>
                    <span>BOPIS / click & collect</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5 text-xs">+</span>
                    <span>Conversion analytics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5 text-xs">+</span>
                    <span>Branded QR codes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>14-day free trial</span>
                  </li>
                </ul>
              </div>
            </Card>

            {/* E-commerce ($99) */}
            <Card className="border-2 border-amber-200" withBorder padding="lg" radius="md">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-amber-900">E-commerce</h3>
                  <Badge variant="default" className="bg-amber-100 text-amber-800">$99/mo</Badge>
                </div>
                <p className="text-xs text-amber-700 italic mb-1">"I sell online"</p>
                <p className="text-sm text-neutral-600">Full-payment only for online merchants</p>
              </div>
              <div className="p-4 pt-0">
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>Everything in Storefront</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5 text-xs">+</span>
                    <span>Full online payments</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5 text-xs">+</span>
                    <span>Delivery & fulfilment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5 text-xs">+</span>
                    <span>Conversion analytics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>14-day free trial</span>
                  </li>
                </ul>
              </div>
            </Card>

            {/* Omnichannel ($149) */}
            <Card className="border-2 border-indigo-200" withBorder padding="lg" radius="md">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-indigo-900">Omnichannel</h3>
                  <Badge variant="default" className="bg-indigo-100 text-indigo-800">$149/mo</Badge>
                </div>
                <p className="text-xs text-indigo-700 italic mb-1">"I sell everywhere"</p>
                <p className="text-sm text-neutral-600">Physical + online — shopper chooses path</p>
              </div>
              <div className="p-4 pt-0">
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>Everything in E-commerce</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-0.5 text-xs">+</span>
                    <span>Payment path choice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-0.5 text-xs">+</span>
                    <span>Both deposit & full payment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-0.5 text-xs">+</span>
                    <span>BOPIS + delivery options</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-0.5 text-xs">+</span>
                    <span>Advanced analytics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-0.5 text-xs">+</span>
                    <span>API access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>14-day free trial</span>
                  </li>
                </ul>
              </div>
            </Card>

            {/* Enterprise ($499) */}
            <Card className="border-2 border-red-200" withBorder padding="lg" radius="md">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-red-900">Enterprise</h3>
                  <Badge variant="default" className="bg-red-100 text-red-800">$499/mo</Badge>
                </div>
                <p className="text-xs text-red-700 italic mb-1">"I run a complete business"</p>
                <p className="text-sm text-neutral-600">Complete Business Solution</p>
              </div>
              <div className="p-4 pt-0">
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>Everything in Professional</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5 text-xs">+</span>
                    <span>Multi-location support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5 text-xs">+</span>
                    <span>Dedicated support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5 text-xs">+</span>
                    <span>Enterprise security</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5 text-xs">+</span>
                    <span>Custom contracts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5 text-xs">+</span>
                    <span>White-label options</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-xs">✓</span>
                    <span>14-day free trial</span>
                  </li>
                </ul>
              </div>
            </Card>
          </div>
        </section>

        {/* Feature Mapping Display */}
        <section>
          <Title order={2} mb="xs">Marketing Benefits → Technical Features</Title>
          <Text c="dimmed" mb="xl">See how marketing benefits translate to technical implementation</Text>
          
          <div className="space-y-8">
            <FeatureMappingDisplay selectedTier="discovery" compact={false} />
            <FeatureMappingDisplay selectedTier="storefront" compact={false} />
            <FeatureMappingDisplay selectedTier="commitment" compact={false} />
            <FeatureMappingDisplay selectedTier="e-commerce" compact={false} />
            <FeatureMappingDisplay selectedTier="omnichannel" compact={false} />
            <FeatureMappingDisplay selectedTier="enterprise" compact={false} />
          </div>
        </section>

        {/* Tier Comparison Table */}
        <section>
          <Title order={2} mb="xs">Complete Tier Comparison</Title>
          <Text c="dimmed" mb="xl">Compare all tiers side-by-side with detailed feature breakdown</Text>
          
          <TierComparisonTable compact={false} />
        </section>

        {/* Content Consistency Validator */}
        <section>
          <Title order={2} mb="xs">Content Consistency Check</Title>
          <Text c="dimmed" mb="xl">Ensure alignment between marketing (/features) and admin (/settings/offerings) pages</Text>
          
          <ContentConsistencyValidator showOnlyInconsistent={false} />
        </section>

        {/* Chain/Multi-Location Subscriptions */}
        <section>
          <ChainPricingSection compact={false} />
        </section>

        {/* Managed Services */}
        <section>
          <Title order={2} mb="xs">Managed Services</Title>
          <Text c="dimmed" mb="xl">Let our team manage your inventory for you</Text>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.values(MANAGED_SERVICES).filter(s => s.id !== 'self_service').map((service) => (
              <Card key={service.id} className={`border-2 ${service.popular ? 'border-primary-500 shadow-lg' : 'border-neutral-200'}`} withBorder padding="lg" radius="md">
                {service.popular && (
                  <div className="bg-primary-500 text-white text-center py-1 text-xs font-semibold">
                    MOST POPULAR
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{service.name}</h3>
                    <p className="text-xs text-neutral-600">{service.tagline}</p>
                    <div className="mt-2">
                      {service.monthlyFee > 0 && (
                        <div className="text-2xl font-bold text-neutral-900">${service.monthlyFee}/mo</div>
                      )}
                      {service.skuSetupCost > 0 && (
                        <div className="text-sm text-neutral-600">${service.skuSetupCost}/SKU setup</div>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {service.features.map((feature: any, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5 text-xs">✓</span>
                        <span>{typeof feature === 'object' ? feature.featureName || feature.featureKey : feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
          <Title order={2} mb="xs">Everything You Need to Succeed Online</Title>
          <Text c="dimmed" mb="xl">All the tools to drive foot traffic and dominate local search</Text>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card withBorder padding="lg" radius="md">
              <div className="text-3xl mb-3">🏪</div>
              <h3 className="font-semibold text-neutral-900 mb-2">Complete Online Storefront</h3>
              <p className="text-sm text-neutral-600">
                Professional product catalog with search, mobile-responsive design, and automatic SEO. No website developer needed—just add products and go live!
              </p>
            </Card>

            <Card withBorder padding="lg" radius="md">
              <div className="text-3xl mb-3">🗺️</div>
              <h3 className="font-semibold text-neutral-900 mb-2">Interactive Store Maps</h3>
              <p className="text-sm text-neutral-600">
                Embedded Google Maps with "Get Directions" button. Privacy mode option to show neighborhood instead of exact location. Drive foot traffic to your store!
              </p>
            </Card>

            <Card withBorder padding="lg" radius="md">
              <div className="text-3xl mb-3">🔍</div>
              <h3 className="font-semibold text-neutral-900 mb-2">Google Business Profile Integration</h3>
              <p className="text-sm text-neutral-600">
                Connect with your Google Business Profile. Display your business info consistently across Google Search and Maps. (Full sync with hours and posts coming soon!)
              </p>
            </Card>

            <Card withBorder padding="lg" radius="md">
              <div className="text-3xl mb-3">🛍️</div>
              <h3 className="font-semibold text-neutral-900 mb-2">Google Shopping Integration</h3>
              <p className="text-sm text-neutral-600">
                Automatic product feed generation and Google Merchant Center integration. Get your products in front of millions of shoppers searching on Google.
              </p>
            </Card>

            <Card withBorder padding="lg" radius="md">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="font-semibold text-neutral-900 mb-2">QR Code Marketing</h3>
              <p className="text-sm text-neutral-600">
                Generate high-resolution QR codes for in-store marketing. Print on flyers, business cards, and store windows. Bridge print to digital seamlessly!
              </p>
            </Card>

            <Card withBorder padding="lg" radius="md">
              <div className="text-3xl mb-3">🔎</div>
              <h3 className="font-semibold text-neutral-900 mb-2">Product Search</h3>
              <p className="text-sm text-neutral-600">
                Powerful search functionality on your storefront. Customers can instantly find products by name, brand, SKU, or description. Fast database-level search!
              </p>
            </Card>

            <Card withBorder padding="lg" radius="md">
              <div className="text-3xl mb-3">🌐</div>
              <h3 className="font-semibold text-neutral-900 mb-2">SEO-Optimized Pages</h3>
              <p className="text-sm text-neutral-600">
                Professional product pages with NAP consistency, structured data, and mobile-responsive design. Rank higher in local search results automatically.
              </p>
            </Card>

            <Card withBorder padding="lg" radius="md">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-semibold text-neutral-900 mb-2">Performance Analytics</h3>
              <p className="text-sm text-neutral-600">
                Track impressions, clicks, and sales. Understand what products perform best and optimize your inventory accordingly. Data-driven decisions!
              </p>
            </Card>

            <Card withBorder padding="lg" radius="md">
              <div className="text-3xl mb-3">🏢</div>
              <h3 className="font-semibold text-neutral-900 mb-2">Multi-Location Support</h3>
              <p className="text-sm text-neutral-600">
                Manage multiple locations with centralized billing, shared SKU pools, and consistent branding. Perfect for chains and franchises with massive savings!
              </p>
            </Card>
          </div>
        </section>

        {/* Flexible Plans Section */}
        <section className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-5xl mb-4">🔄</div>
            <Title order={2} mb="sm">Flexible Plans That Grow With You</Title>
            <Text c="dimmed" mb="xl">
              Your business needs change, and your subscription should too. We make it easy to adjust your plan anytime.
            </Text>
            
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
          <Title order={2} mb="md">Ready to Get Started?</Title>
          <Text size="lg" mb="xl" opacity={0.9}>
            Choose the plan that's right for your business. Change it anytime as your needs evolve.
          </Text>
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
