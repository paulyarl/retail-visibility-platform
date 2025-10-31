'use client';

import Link from 'next/link';
import { Button, Badge } from '@/components/ui';
import { motion } from 'framer-motion';
import PublicFooter from '@/components/PublicFooter';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Image from 'next/image';

const features = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
    title: 'QR Code Marketing',
    description: 'High-resolution QR codes (up to 2048px) for in-store marketing. Print on flyers, business cards, and store windows.',
    benefits: ['Multiple sizes', 'Print-ready quality', 'Direct to landing page', 'Track scans'],
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: 'Inventory Management',
    description: 'Centralized inventory tracking across all your retail locations with real-time updates and low-stock alerts.',
    benefits: ['Multi-location support', 'Real-time sync', 'Low stock alerts', 'Bulk import/export'],
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Photo Management',
    description: 'Professional product photography tools with cloud storage, automatic optimization, and unlimited uploads.',
    benefits: ['Cloud storage', 'Auto-optimization', 'Bulk upload', 'Image gallery'],
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    title: 'Google Integration & SWIS',
    description: 'Seamless sync with Google Merchant Center, Business Profile, and See What\'s In Store (SWIS) for maximum online visibility.',
    benefits: ['Merchant Center sync', 'SWIS integration', 'Auto product feed', 'Local inventory ads'],
    color: 'bg-green-100 text-green-600',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Analytics & Insights',
    description: 'Comprehensive analytics dashboard with sales trends, inventory turnover, and customer insights.',
    benefits: ['Sales analytics', 'Inventory reports', 'Performance metrics', 'Export reports'],
    color: 'bg-amber-100 text-amber-600',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Custom Landing Pages',
    description: 'Beautiful, SEO-optimized product landing pages that convert visitors into customers.',
    benefits: ['SEO optimized', 'Mobile responsive', 'Custom branding', 'Social sharing'],
    color: 'bg-pink-100 text-pink-600',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Enterprise Security',
    description: 'Bank-level security with role-based access control, audit logs, and data encryption.',
    benefits: ['Role-based access', 'Audit logging', 'Data encryption', 'SOC 2 compliant'],
    color: 'bg-red-100 text-red-600',
  },
];

const tiers = [
  {
    name: 'Google-Only',
    price: '$29',
    period: '/month',
    description: 'Get discovered on Google instantly',
    features: [
      'Up to 250 SKUs',
      'Google Shopping feeds',
      'Google Merchant Center sync',
      'Automatic product updates',
      'QR code generation (512px)',
      'Basic product pages',
      'Performance analytics',
    ],
    cta: 'Start Free Trial',
    popular: false,
    badge: 'Entry Tier',
  },
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    description: 'Perfect for single-location retailers',
    features: [
      'Up to 500 SKUs',
      'Complete storefront with catalog',
      'Product search functionality',
      'Mobile-responsive design',
      'Google Shopping feeds',
      '512px QR codes',
      'Enhanced SEO optimization',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    price: '$149',
    period: '/month',
    description: 'Ideal for growing retail businesses',
    features: [
      'Up to 5,000 SKUs',
      'Enhanced storefront with branding',
      'Google Business Profile integration',
      'Interactive store location maps',
      'Privacy mode for location',
      '1024px QR codes',
      'Business logo display',
      'Product image galleries (5 photos)',
      'Custom marketing copy',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '$499',
    period: '/month',
    description: 'For large retail operations',
    features: [
      'Unlimited SKUs',
      'White-label storefront',
      'Custom domain for storefront',
      'Advanced map customization',
      '2048px QR codes',
      'Product image galleries (10 photos)',
      'Custom branding & colors',
      'Priority support',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function FeaturesPage() {
  const { settings } = usePlatformSettings();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {settings?.logoUrl ? (
              <Link href="/">
                <Image
                  src={settings.logoUrl}
                  alt={settings.platformName || 'Platform Logo'}
                  width={150}
                  height={40}
                  className="h-10 w-auto object-contain cursor-pointer"
                />
              </Link>
            ) : (
              <Link href="/">
                <h1 className="text-2xl font-bold text-neutral-900 cursor-pointer hover:text-primary-600 transition-colors">
                  {settings?.platformName || 'Visible Shelf'}
                </h1>
              </Link>
            )}
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/login">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary-50 via-white to-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4">Trusted by 1,500+ Retailers</Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-neutral-900 mb-6">
              Complete Online Presence<br />
              <span className="text-primary-600">In Minutes, Not Months</span>
            </h1>
            <p className="text-xl text-neutral-600 mb-8 max-w-3xl mx-auto">
              Everything you need to dominate local search and drive customers to your store. No website developer needed.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg">Start Free Trial</Button>
              </Link>
              <Link href="#pricing">
                <Button variant="secondary" size="lg">View Pricing</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What You Get Overview */}
      <section className="py-16 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4 text-center">Complete Online Presence Solution</h2>
          <p className="text-lg text-neutral-600 mb-8 text-center max-w-3xl mx-auto">
            Everything you need to dominate local search and drive customers to your store
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-neutral-900 mb-4">
              Powerful Features for Modern Retailers
            </h2>
            <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
              Everything you need to manage, market, and grow your retail business in one platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white border border-neutral-200 rounded-xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-lg ${feature.color} mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">{feature.title}</h3>
                <p className="text-neutral-600 mb-4">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center text-sm text-neutral-700">
                      <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 30-Day Trial Section */}
      <section className="py-16 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border-2 border-green-200 rounded-xl p-8 shadow-lg">
            <div className="flex items-start gap-6">
              <div className="text-6xl">🆓</div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-neutral-900 mb-3">30-Day Free Trial</h2>
                <p className="text-lg text-neutral-700 mb-6">
                  Try our platform risk-free with full access to all Professional features. No credit card required.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-3">What's Included:</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Full access to all Professional features</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>5,000 SKU limit</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>1024px QR codes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Enhanced landing pages</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Google Shopping integration</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Google Business Profile sync</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-3">Terms & Conditions:</h3>
                    <ul className="space-y-2 text-sm text-neutral-700">
                      <li className="flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        <span>30 days from account creation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        <span>No credit card required to start</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        <span>Automatically converts to Starter plan after trial</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        <span>You can upgrade to any paid plan during trial</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        <span>Cancel anytime with no charges</span>
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                  <p className="text-sm text-neutral-800">
                    <strong>💡 Pro Tip:</strong> Use the trial period to upload your inventory, test QR codes, and see how our platform drives traffic to your business before committing to a paid plan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-neutral-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-neutral-600 max-w-2xl mx-auto mb-6">
              Choose the plan that's right for your business. Individual locations or multi-location chains.
            </p>
            
            {/* Trial Benefits */}
            <div className="inline-flex items-center gap-6 bg-white border border-primary-200 rounded-lg px-6 py-4 shadow-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-neutral-900">30-Day Free Trial</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-neutral-900">No Credit Card Required</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-neutral-900">Cancel Anytime</span>
              </div>
            </div>
          </div>

          {/* Plan Type Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-white border border-neutral-200 rounded-lg p-1">
              <button className="px-6 py-2 rounded-md bg-primary-600 text-white font-medium text-sm">
                Individual Location
              </button>
              <button className="px-6 py-2 rounded-md text-neutral-600 hover:text-neutral-900 font-medium text-sm">
                Multi-Location Chain
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white rounded-xl p-8 ${
                  tier.popular ? 'ring-2 ring-primary-600 shadow-xl scale-105' : 'border border-neutral-200'
                }`}
              >
                {tier.popular && (
                  <Badge className="mb-4">Most Popular</Badge>
                )}
                <h3 className="text-2xl font-bold text-neutral-900 mb-2">{tier.name}</h3>
                <p className="text-neutral-600 mb-4">{tier.description}</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-neutral-900">{tier.price}</span>
                  <span className="text-neutral-600">{tier.period}</span>
                </div>
                <Link href="/login" className="block mb-6">
                  <Button className="w-full" variant={tier.popular ? 'primary' : 'secondary'}>
                    {tier.cta}
                  </Button>
                </Link>
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start text-sm text-neutral-700">
                      <svg className="w-5 h-5 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Chain Pricing Section */}
          <div className="mt-16">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-neutral-900 mb-3">
                Multi-Location Chain Pricing
              </h3>
              <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
                Massive savings for chains and franchises. Same great features, better pricing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Chain Starter */}
              <div className="bg-white border-2 border-neutral-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-bold text-neutral-900">Chain Starter</h4>
                  <Badge className="bg-blue-100 text-blue-800">$149/mo</Badge>
                </div>
                <p className="text-sm text-neutral-600 mb-4">Up to 5 locations • 2,500 total SKUs</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>All Starter features per location</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Centralized management</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Shared SKU pool</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Organization-wide analytics</span>
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <p className="text-xs text-green-700 font-semibold">Save 39% vs individual plans</p>
                </div>
              </div>

              {/* Chain Professional */}
              <div className="bg-white border-2 border-primary-500 rounded-xl p-6 shadow-lg relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-green-500 text-white">BEST VALUE</Badge>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-bold text-neutral-900">Chain Professional</h4>
                  <Badge className="bg-purple-100 text-purple-800">$499/mo</Badge>
                </div>
                <p className="text-sm text-neutral-600 mb-4">Up to 10 locations • 50,000 total SKUs</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>All Professional features per location</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Google Business Profile for all</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Interactive maps for each location</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Consistent branding across all stores</span>
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <p className="text-xs text-green-700 font-semibold">Save 66% vs individual plans ($1,490 → $499)</p>
                </div>
              </div>

              {/* Chain Enterprise */}
              <div className="bg-white border-2 border-neutral-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-bold text-neutral-900">Chain Enterprise</h4>
                  <Badge className="bg-amber-100 text-amber-800">$1,499/mo</Badge>
                </div>
                <p className="text-sm text-neutral-600 mb-4">Unlimited locations • Unlimited SKUs</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>All Enterprise features per location</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>White-label for all locations</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Custom domains for each store</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Dedicated account manager</span>
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <p className="text-xs text-neutral-600 font-semibold">Perfect for large chains</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-sm text-green-900">
                <strong>Example Savings:</strong> 10-location chain saves 66% ($1,490/mo → $499/mo with Chain Professional)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Retail Business?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join 1,500+ retailers who trust our platform to manage and grow their business.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" variant="secondary">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/settings/contact">
              <Button size="lg" variant="ghost" className="bg-transparent text-white border border-white hover:bg-white hover:text-primary-600">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
