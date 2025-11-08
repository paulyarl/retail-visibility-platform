'use client';

import Link from 'next/link';
import { Button, Badge } from '@/components/ui';
import { motion } from 'framer-motion';
import PublicFooter from '@/components/PublicFooter';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Image from 'next/image';
import FeaturesShowcase from '@/components/FeaturesShowcase';
import ChainPropagationCallout from '@/components/ChainPropagationCallout';

const features = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Quick Start Wizard - The Game Changer',
    description: '🚀 Forget scanning barcodes one-by-one or cleaning CSV files! Generate 50-100 realistic products in 1 SECOND. No manual data entry, no spreadsheets, no scanning equipment needed. Just click and you\'re live.',
    benefits: [
      '360x faster than manual entry',
      'Beats barcode scanning (no equipment!)',
      'Beats CSV import (no data cleanup!)',
      '4 ready-to-go business scenarios',
      'Auto-categorized with real prices',
      'Created as drafts for easy customization'
    ],
    color: 'bg-gradient-to-br from-blue-500 to-purple-600 text-white',
    badge: 'GAME CHANGER',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Organization Propagation Control - Enterprise Command Center',
    description: '🚀 REVOLUTIONARY: Manage your entire chain from one dashboard. 8 propagation types give you complete control over products, categories, business info, and brand assets across all locations. Test on 1 location before chain-wide rollout. This is what enterprise retailers pay $50K+/year for.',
    benefits: [
      '8 propagation types (products, categories, GBP sync, hours, profile, flags, roles, brand)',
      'Test on single location before rollout',
      'One-click chain-wide distribution',
      'Hero location concept',
      'Organization dashboard with analytics',
      'Dry run mode & rollback capability',
      'Save 400+ hours per rollout',
      'Perfect consistency across all locations'
    ],
    color: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
    badge: 'ENTERPRISE',
  },
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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
    title: 'SKU Scanning + Inventory Intelligence',
    description: '🎯 BREAKTHROUGH: Scan barcodes and capture EVERYTHING - nutrition facts, allergens, specifications, environmental data, and images. PLUS get real-time analytics on your inventory with data quality tracking, top products, cost savings, and product preview tool!',
    benefits: [
      'Complete nutrition facts & Nutri-Score',
      'Allergen warnings & dietary info',
      'Real-time inventory analytics dashboard',
      'Data quality tracking & insights',
      'Product preview tool (check before scan)',
      'Cost savings visibility & ROI tracking'
    ],
    color: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white',
    badge: 'NEW!',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    title: 'Smart Product Categories + Organization-Level GBP Sync',
    description: '🎯 Organize products with Google Product Taxonomy (5,595 categories). Bi-directional sync between your categories and Google My Business. PLUS: Organization-level GBP sync with strategic testing - test on 1 location before rolling out to all.',
    benefits: [
      'Google taxonomy (5,595 categories)',
      'Tenant ↔ GMB category sync',
      'Test on single location first (strategic rollout)',
      'Sync to all locations with one click',
      'Auto-categorization',
      'Out-of-sync detection',
      'Platform-level category management'
    ],
    color: 'bg-indigo-100 text-indigo-600',
    badge: 'M3',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Smart Business Hours',
    description: 'Go beyond Google with real-time status that handles complex schedules. Multiple periods per day, split shifts, emergency updates - your storefront shows accurate open/closed status even when Google can\'t. Customers get the complete picture with custom notes and unlimited flexibility.',
    benefits: ['Real-time open/closed status', 'Multiple periods per day', 'Split shift support', 'Emergency schedule updates', 'Custom customer notes', 'Google sync (first 2-3 periods)'],
    color: 'bg-cyan-100 text-cyan-600',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    title: 'Full Google Business Profile Integration',
    description: '🚀 Complete GMB sync: categories, business hours, photos, and products. Bi-directional category sync, automatic feed generation, and SWIS (See What\'s In Store) for maximum local visibility.',
    benefits: [
      'Full GMB category sync',
      'Business hours automation',
      'Product feed auto-generation',
      'SWIS integration',
      'Local inventory ads',
      'Out-of-sync detection'
    ],
    color: 'bg-gradient-to-br from-blue-500 to-green-600 text-white',
    badge: 'COMPLETE',
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
    price: '$499',
    period: '/month',
    description: 'Ideal for established retail businesses',
    features: [
      'Up to 5,000 SKUs (10x Starter)',
      'Enhanced storefront with branding',
      'Google Business Profile integration',
      'Interactive store location maps',
      'Privacy mode for location',
      '1024px QR codes (print-ready)',
      'Business logo display',
      'Product image galleries (5 photos)',
      'Custom marketing copy',
      'Saves $2,400/mo in labor costs',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '$999',
    period: '/month',
    description: 'For large single-location operations',
    features: [
      'Unlimited SKUs',
      'Complete white-label storefront',
      'Custom domain for storefront',
      'Advanced map customization',
      '2048px QR codes (billboard-ready)',
      'Product image galleries (10 photos)',
      'Custom branding & colors',
      'API access for integrations',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
  {
    name: 'Organization',
    price: '$999',
    period: '/month',
    description: 'For franchise chains & multi-location businesses',
    features: [
      '10,000 shared SKUs across all locations',
      'Unlimited locations (80% savings vs per-location)',
      '8 propagation types (chain-wide control)',
      'Organization dashboard with analytics',
      'Hero location management',
      'GBP category sync (test on 1 or sync to all)',
      'Centralized business hours & profile',
      'Feature flags & user roles',
      'Brand asset distribution',
      'Chain-wide reporting',
      'API access',
      'Priority support',
    ],
    cta: 'Contact Sales',
    popular: true,
    badge: 'BEST FOR CHAINS',
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

      {/* The Problem/Solution Story */}
      <section className="py-16 bg-white border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
              The Challenge Every Local Retailer Faces
            </h2>
            <p className="text-lg text-neutral-600 max-w-3xl mx-auto leading-relaxed">
              You're competing against chains with unlimited budgets and entire IT departments. 
              They have developers, marketers, and data scientists. You have... a to-do list a mile long.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <motion.div 
              className="bg-red-50 border-2 border-red-200 rounded-xl p-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h3 className="text-2xl font-bold text-red-900 mb-6 flex items-center gap-2">
                <span>❌</span> The Old Way
              </h3>
              <ul className="space-y-3 text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-1">•</span>
                  <span>Hire a developer ($5,000-$20,000)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-1">•</span>
                  <span>Wait 3-6 months for launch</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-1">•</span>
                  <span>Pay monthly maintenance fees</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-1">•</span>
                  <span>Manually update every product</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-1">•</span>
                  <span>Hope Google finds you (eventually)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-1">•</span>
                  <span>Compete with outdated tools</span>
                </li>
              </ul>
            </motion.div>
            
            <motion.div 
              className="bg-green-50 border-2 border-green-200 rounded-xl p-8"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <h3 className="text-2xl font-bold text-green-900 mb-6 flex items-center gap-2">
                <span>✅</span> Our Way
              </h3>
              <ul className="space-y-3 text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span><strong>Generate 100 products in 1 second</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span><strong>Live on Google in minutes</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span><strong>Beautiful storefront, no coding</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span><strong>Auto-sync across all channels</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span><strong>Compete with major retailers</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span><strong>Save $2,400/month in labor</strong></span>
                </li>
              </ul>
            </motion.div>
          </div>
          
          <motion.div 
            className="text-center bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-8 md:p-12 border-2 border-primary-200"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-4">
              Built by Retailers, for Retailers
            </h3>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed mb-6">
              We're not a tech company trying to understand retail. We're retailers who learned 
              tech because we were tired of expensive, complicated solutions that didn't work 
              for real businesses like ours.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-neutral-700">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg">
                <span className="text-xl">🏪</span>
                <span>Real retail experience</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg">
                <span className="text-xl">💰</span>
                <span>Small business pricing</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg">
                <span className="text-xl">🤝</span>
                <span>Built for your success</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Showcase - WOW Factor */}
      <section className="py-8 bg-white">
        <FeaturesShowcase mode="hybrid" />
      </section>

      {/* Quick Start + Scanning Integration Callout */}
      <section className="py-16 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-block bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold text-sm mb-4">
              ⚡ POWER COMBO
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Quick Start Wizard + Product Scanning
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              These aren't competing features—they're a <strong className="text-yellow-300">perfectly aligned system</strong> that saves you 15+ hours per 100 products
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Step 1: Quick Start */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-xl p-6 shadow-2xl"
            >
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-blue-600">1</span>
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  ⚡ Quick Start Wizard
                </h3>
                <p className="text-sm text-neutral-600 font-semibold">Generate in 5 minutes</p>
              </div>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Generate <strong>100 products instantly</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Basic info (name, category, price)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">⚠</span>
                  <span>Missing: Images, descriptions, specs</span>
                </li>
              </ul>
            </motion.div>

            {/* Step 2: Product Scanning */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white rounded-xl p-6 shadow-2xl border-4 border-yellow-400"
            >
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-purple-600">2</span>
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  📱 Product Scanning
                </h3>
                <p className="text-sm text-neutral-600 font-semibold">Enrich in 50 minutes</p>
              </div>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span><strong>Detects matching products</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Adds professional images (3+)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Adds descriptions & specifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Enriches existing products (no duplicates!)</span>
                </li>
              </ul>
            </motion.div>

            {/* Step 3: Result */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 shadow-2xl"
            >
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🎉</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Complete Products
                </h3>
                <p className="text-sm text-green-100 font-semibold">Ready in 55 minutes</p>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-300 mt-0.5">★</span>
                  <span><strong>100 fully enriched products</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-300 mt-0.5">★</span>
                  <span>Professional images & descriptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-300 mt-0.5">★</span>
                  <span>Complete specifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-300 mt-0.5">★</span>
                  <span>Ready for Google Shopping</span>
                </li>
              </ul>
            </motion.div>
          </div>

          {/* Time Savings Comparison */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-white rounded-xl p-8 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Old Way */}
              <div>
                <h4 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                  <span className="text-2xl">❌</span>
                  The Old Way (Manual Entry)
                </h4>
                <div className="space-y-3 text-neutral-700">
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span>Enter 100 products manually</span>
                    <span className="font-bold text-red-600">16.7 hours</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span>Labor cost (@$25/hour)</span>
                    <span className="font-bold text-red-600">$417.50</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span>Data quality</span>
                    <span className="font-bold text-red-600">Inconsistent</span>
                  </div>
                </div>
              </div>

              {/* New Way */}
              <div>
                <h4 className="text-lg font-bold text-green-600 mb-4 flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  The Smart Way (Quick Start + Scan)
                </h4>
                <div className="space-y-3 text-neutral-700">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span>Quick Start + Scan enrichment</span>
                    <span className="font-bold text-green-600">55 minutes</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span>Labor cost (@$25/hour)</span>
                    <span className="font-bold text-green-600">$22.92</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span>Data quality</span>
                    <span className="font-bold text-green-600">Professional</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Savings Summary */}
            <div className="mt-8 pt-8 border-t-2 border-neutral-200">
              <div className="text-center">
                <p className="text-2xl font-bold text-neutral-900 mb-2">
                  💰 Save <span className="text-green-600">$394.58</span> and <span className="text-blue-600">15.75 hours</span> per 100 products
                </p>
                <p className="text-neutral-600">
                  That's a <strong className="text-purple-600">94% time reduction</strong> with better quality data!
                </p>
              </div>
            </div>
          </motion.div>

          {/* Key Insight */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-8 bg-yellow-400 rounded-xl p-6 text-center"
          >
            <p className="text-xl font-bold text-yellow-900 mb-2">
              🎯 The Key: They Work TOGETHER, Not Against Each Other
            </p>
            <p className="text-neutral-800 max-w-3xl mx-auto">
              Quick Start Wizard creates the foundation instantly. Product Scanning enriches it with professional data. 
              The result? <strong>Complete, accurate products in under an hour</strong> instead of days of manual work.
            </p>
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

      {/* Quick Start Comparison */}
      <section className="py-16 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-neutral-900 mb-4">
              Why Quick Start Beats Everything Else
            </h2>
            <p className="text-xl text-neutral-600">
              The fastest way to get your products online. Period.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Barcode Scanning */}
            <div className="bg-white rounded-xl p-6 border-2 border-red-200">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">📱</div>
                <h3 className="font-bold text-lg text-neutral-900">Barcode Scanning</h3>
                <div className="text-red-600 font-semibold text-sm mt-1">Old Way ❌</div>
              </div>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Scan each product manually</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Need expensive equipment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>3+ hours for 50 products</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Tedious and error-prone</span>
                </li>
              </ul>
            </div>

            {/* CSV Import */}
            <div className="bg-white rounded-xl p-6 border-2 border-orange-200">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">📊</div>
                <h3 className="font-bold text-lg text-neutral-900">CSV Import</h3>
                <div className="text-orange-600 font-semibold text-sm mt-1">Better, But... ⚠️</div>
              </div>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">✗</span>
                  <span>Requires data cleanup</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">✗</span>
                  <span>Need spreadsheet skills</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">✗</span>
                  <span>Format must be perfect</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">✗</span>
                  <span>Still takes 1-2 hours</span>
                </li>
              </ul>
            </div>

            {/* Quick Start */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 border-2 border-blue-400 shadow-xl scale-105">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">⚡</div>
                <h3 className="font-bold text-lg text-white">Quick Start Wizard</h3>
                <div className="text-yellow-300 font-semibold text-sm mt-1">GAME CHANGER! 🚀</div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">✓</span>
                  <span className="font-medium">1 SECOND for 50 products!</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">✓</span>
                  <span className="font-medium">Zero equipment needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">✓</span>
                  <span className="font-medium">No spreadsheets required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">✓</span>
                  <span className="font-medium">360x faster than manual</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-block bg-white rounded-lg px-6 py-4 shadow-lg border-2 border-green-200">
              <p className="text-lg font-bold text-neutral-900 mb-1">
                ⏱️ Time Comparison: 50 Products
              </p>
              <div className="flex items-center justify-center gap-6 text-sm">
                <div>
                  <span className="text-red-600 font-semibold">Scanning:</span> 3 hours
                </div>
                <div>
                  <span className="text-orange-600 font-semibold">CSV:</span> 1-2 hours
                </div>
                <div>
                  <span className="text-green-600 font-bold">Quick Start:</span> 1 second ⚡
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SKU Scanning Comparison - BREAKTHROUGH */}
      <section className="py-16 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block bg-yellow-400 text-green-900 text-sm px-4 py-1 rounded-full font-bold mb-4">
              🎯 BREAKTHROUGH FEATURE
            </div>
            <h2 className="text-4xl font-bold text-neutral-900 mb-4">
              Product Intelligence That Beats Shopify & WooCommerce
            </h2>
            <p className="text-xl text-neutral-600">
              Get the same rich product pages as CVS, Walmart, and Target. Impossible with traditional e-commerce platforms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Shopify/WooCommerce */}
            <div className="bg-white rounded-xl p-6 border-2 border-red-200">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🛒</div>
                <h3 className="font-bold text-lg text-neutral-900">Shopify/WooCommerce</h3>
                <div className="text-red-600 font-semibold text-sm mt-1">Manual Entry Only ❌</div>
              </div>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Type everything manually</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>No nutrition facts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>No allergen warnings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>No environmental data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Basic product pages only</span>
                </li>
              </ul>
            </div>

            {/* Major Retailers */}
            <div className="bg-white rounded-xl p-6 border-2 border-orange-200">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🏬</div>
                <h3 className="font-bold text-lg text-neutral-900">CVS/Walmart/Target</h3>
                <div className="text-orange-600 font-semibold text-sm mt-1">Rich Data, But... ⚠️</div>
              </div>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Complete nutrition facts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Allergen warnings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Environmental data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">✗</span>
                  <span>Only for major chains</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">✗</span>
                  <span>Small retailers left behind</span>
                </li>
              </ul>
            </div>

            {/* Our Platform */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 border-2 border-green-400 shadow-xl scale-105">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">✨</div>
                <h3 className="font-bold text-lg text-white">Our Platform</h3>
                <div className="text-yellow-300 font-semibold text-sm mt-1">LEVEL PLAYING FIELD! 🎯</div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">✓</span>
                  <span className="font-medium">Complete nutrition facts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">✓</span>
                  <span className="font-medium">Allergen warnings & dietary info</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">✓</span>
                  <span className="font-medium">Environmental impact data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">✓</span>
                  <span className="font-medium">Product specifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">✓</span>
                  <span className="font-medium">For EVERY small retailer!</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Rich Storefront Examples */}
          <div className="mt-12 bg-white rounded-xl p-8 border-2 border-green-200 shadow-lg">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              What Your Customers See on Your Storefront
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Without Our Platform */}
              <div>
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-3">
                  <h4 className="font-bold text-red-900 mb-2">❌ Without Our Platform</h4>
                  <div className="space-y-2 text-sm text-neutral-700">
                    <div className="bg-white p-3 rounded border border-red-200">
                      <p className="font-semibold">Coca-Cola 12oz</p>
                      <p className="text-xs text-neutral-500">$1.99</p>
                      <p className="text-xs mt-2 text-neutral-400">That's it. Just name and price.</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 italic">
                  Shopify/WooCommerce: Basic product info only. No nutrition, no allergens, no trust.
                </p>
              </div>

              {/* With Our Platform */}
              <div>
                <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4 mb-3">
                  <h4 className="font-bold text-green-900 mb-2">✅ With Our Platform</h4>
                  <div className="space-y-2 text-sm text-neutral-700">
                    <div className="bg-white p-3 rounded border border-green-400 shadow-sm">
                      <p className="font-semibold">Coca-Cola Classic 12oz</p>
                      <p className="text-xs text-neutral-500 mb-2">$1.99 • By Coca-Cola</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">✓</span>
                          <span>Nutrition Facts</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">✓</span>
                          <span>Allergen Info</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">✓</span>
                          <span>Ingredients</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">✓</span>
                          <span>Eco-Score</span>
                        </div>
                      </div>
                      <p className="text-xs mt-2 text-green-700 font-medium">+ Product images, specs, and more!</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-green-700 font-medium">
                  Professional product pages that build customer trust and drive sales!
                </p>
              </div>
            </div>
          </div>

          {/* Analytics Dashboard Highlight */}
          <div className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-3">PLUS: Real-Time Inventory Intelligence</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-3xl mb-2">📊</div>
                  <p className="font-semibold">Analytics Dashboard</p>
                  <p className="text-xs mt-1 opacity-90">Track your scanning activity</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="font-semibold">Data Quality</p>
                  <p className="text-xs mt-1 opacity-90">See completeness metrics</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-3xl mb-2">🔍</div>
                  <p className="font-semibold">Preview Tool</p>
                  <p className="text-xs mt-1 opacity-90">Check before you scan</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-3xl mb-2">💰</div>
                  <p className="font-semibold">Cost Savings</p>
                  <p className="text-xs mt-1 opacity-90">See your ROI</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-block bg-white rounded-lg px-6 py-4 shadow-lg border-2 border-green-400">
              <p className="text-lg font-bold text-neutral-900 mb-1">
                🎯 The Breakthrough
              </p>
              <p className="text-sm text-neutral-700">
                Small retailers can now compete with major chains on product information quality.
                <br />
                <span className="text-green-600 font-semibold">This was impossible before. Now it's automatic.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Chain Management - 8 Propagation Types */}
      <ChainPropagationCallout />

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
                className="bg-white border border-neutral-200 rounded-xl p-6 hover:shadow-lg transition-shadow relative"
              >
                {feature.badge && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg">
                    {feature.badge}
                  </div>
                )}
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

      {/* 14-Day Trial Section */}
      <section className="py-16 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border-2 border-green-200 rounded-xl p-8 shadow-lg">
            <div className="flex items-start gap-6">
              <div className="text-6xl">🆓</div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-neutral-900 mb-3">14-Day Free Trial</h2>
                <p className="text-lg text-neutral-700 mb-6">
                  Try any tier risk-free with full access to all features. No credit card required.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-3">What's Included:</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Trial any tier (Starter, Professional, or Enterprise)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Full access to all tier features</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Quick Start Wizard (Professional+)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Product Scanning (Professional+)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Google Shopping & GBP integration</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Test before you commit</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-3">Terms & Conditions:</h3>
                    <ul className="space-y-2 text-sm text-neutral-700">
                      <li className="flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        <span>14 days from account creation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        <span>No credit card required to start</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        <span>Choose your tier at signup</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        <span>Add payment before trial ends to continue</span>
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
              <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white mb-4">
                🚀 ENTERPRISE CHAIN MANAGEMENT
              </Badge>
              <h3 className="text-3xl font-bold text-neutral-900 mb-3">
                Multi-Location Chain Pricing
              </h3>
              <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-4">
                Massive savings for chains and franchises. Same great features, better pricing.
              </p>
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-6 max-w-4xl mx-auto">
                <h4 className="text-xl font-bold text-emerald-900 mb-3">✨ Exclusive Chain Features</h4>
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
                    <svg className="w-4 h-4 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="font-semibold text-emerald-900">Chain product sync</span>
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
