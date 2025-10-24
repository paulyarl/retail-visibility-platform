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
    name: 'Starter',
    price: '$49',
    period: '/month',
    description: 'Perfect for single-location retailers',
    features: [
      'Up to 500 SKUs',
      'Basic photo management',
      'Google Merchant Center sync',
      'Email support',
      'Basic analytics',
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
      'Up to 2,500 SKUs',
      'Advanced photo tools',
      'Google Business Profile',
      'Priority support',
      'Advanced analytics',
      'Custom landing pages',
      'Multi-location support',
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
      'White-label branding',
      'Dedicated account manager',
      '24/7 phone support',
      'Custom integrations',
      'API access',
      'Advanced security',
      'SLA guarantee',
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
                  {settings?.platformName || 'Retail Visibility Platform'}
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
              Everything You Need to<br />
              <span className="text-primary-600">Grow Your Retail Business</span>
            </h1>
            <p className="text-xl text-neutral-600 mb-8 max-w-3xl mx-auto">
              Streamline inventory management, boost online visibility, and increase sales with our all-in-one retail platform.
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
                <span className="text-sm font-medium text-neutral-900">14-Day Free Trial</span>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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

          {/* Chain Pricing Note */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-start gap-3 bg-white border border-neutral-200 rounded-lg p-6 max-w-2xl">
              <svg className="w-6 h-6 text-primary-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <div className="text-left">
                <p className="font-semibold text-neutral-900 mb-1">Multi-Location Chains</p>
                <p className="text-sm text-neutral-600">
                  Running multiple locations? We offer special pricing for retail chains with centralized management, 
                  shared SKU pools, and organization-wide analytics. <Link href="/settings/contact" className="text-primary-600 hover:text-primary-700 font-medium">Contact sales</Link> for custom pricing.
                </p>
              </div>
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
