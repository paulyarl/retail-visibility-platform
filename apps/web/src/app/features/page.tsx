'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@mantine/core';
import { Badge } from '@/components/ui';
import FeaturesShowcase from '@/components/FeaturesShowcase';
import PublicFooter from '@/components/PublicFooter';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Image from 'next/image';
import ChainPropagationCallout from '@/components/ChainPropagationCallout';


// Feature categories aligned with Connected Layer Stack
const featureCategories = [
  {
    name: 'Clover & Inventory',
    icon: '🔗',
    description: 'Single source of truth for all your products',
    color: 'from-blue-500 to-purple-600'
  },
  {
    name: 'Google Visibility',
    icon: '🔍',
    description: 'Get discovered on Search, Shopping & Maps',
    color: 'from-green-500 to-emerald-600'
  },
  {
    name: 'Platform Presence',
    icon: '🏪',
    description: 'Your store inside the Visible Shelf marketplace',
    color: 'from-purple-500 to-indigo-600'
  },
  {
    name: 'Commerce & Conversion',
    icon: '🛒',
    description: 'From browsing to buying and fulfillment',
    color: 'from-amber-500 to-red-600'
  },
  {
    name: 'Management & Growth',
    icon: '📈',
    description: 'Analytics, multi-location & advanced features',
    color: 'from-cyan-500 to-blue-600'
  }
];

// Reorganized features by category
const features = [
  // CLOVER & INVENTORY
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Clover POS Integration & Real-Time Sync',
    description: 'Automatic inventory synchronization with Clover POS. Single source of truth across all channels.',
    benefits: [
      'Real-time inventory updates',
      'Automatic product sync',
      'No manual data entry',
      'Single source of truth'
    ],
    color: 'bg-gradient-to-br from-blue-500 to-purple-600 text-white',
    badge: 'CORE',
    category: 'Clover & Inventory'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: 'Real-Time Inventory Management',
    description: 'Centralized inventory tracking with live updates and stock availability indicators.',
    benefits: ['Multi-location support', 'Real-time sync', 'Low stock alerts', 'Stock availability indicators'],
    color: 'bg-blue-100 text-blue-600',
    category: 'Clover & Inventory'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
    title: 'SKU Scanning + Inventory Intelligence',
    description: '🎯 BREAKTHROUGH: Scan barcodes and capture nutrition facts, allergens, specifications, and real-time analytics.',
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
    category: 'Clover & Inventory'
  },

  // GOOGLE VISIBILITY
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    title: 'Full Google Business Profile Integration',
    description: '🚀 Complete GMB sync: categories, business hours, photos, and products with SWIS integration.',
    benefits: [
      'Full GMB category sync',
      'Business hours automation',
      'Product feed auto-generation',
      'SWIS integration',
      'Local inventory ads',
      'Out-of-sync detection'
    ],
    color: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white',
    badge: 'COMPLETE',
    category: 'Google Visibility'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Google Search & Shopping Optimization',
    description: 'SEO-optimized product pages that automatically appear in Google Search and Shopping results.',
    benefits: [
      'SEO-optimised product pages',
      'Google Search indexing',
      'Google Shopping visibility',
      'Mobile-optimised pages',
      'Automatic schema markup'
    ],
    color: 'bg-green-100 text-green-600',
    category: 'Google Visibility'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    title: 'Google Maps & SWIS (See What\'s In Store)',
    description: 'Live inventory shown on Google Maps mobile. Shoppers see product availability in real-time.',
    benefits: [
      'Live inventory on Google Maps',
      'SWIS integration',
      'Mobile-optimized display',
      'Real-time stock status',
      'In-store pickup indicators'
    ],
    color: 'bg-emerald-100 text-emerald-600',
    category: 'Google Visibility'
  },

  // PLATFORM PRESENCE
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: 'Branded Public Storefront',
    description: 'Complete branded store presence hosted on the platform with custom branding and identity.',
    benefits: [
      'Custom branding & logo',
      'Store profile & details',
      'Product catalog display',
      'Mobile-optimised design',
      'SEO-friendly URLs'
    ],
    color: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white',
    badge: 'STOREFRONT',
    category: 'Platform Presence'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    title: 'Smart Product Categories',
    description: '🎯 Organize products with Google Product Taxonomy (5,595 categories) and auto-categorization.',
    benefits: [
      'Google taxonomy (5,595 categories)',
      'Auto-categorization',
      'Platform-level category management',
      'Customer-friendly navigation',
      'Search optimization'
    ],
    color: 'bg-indigo-100 text-indigo-600',
    badge: 'ORGANIZED',
    category: 'Platform Presence'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Smart Business Hours',
    description: 'Complex scheduling with multiple periods, split shifts, and real-time status beyond Google\'s limitations.',
    benefits: [
      'Real-time open/closed status',
      'Multiple periods per day',
      'Split shift support',
      'Emergency schedule updates',
      'Custom customer notes'
    ],
    color: 'bg-cyan-100 text-cyan-600',
    category: 'Platform Presence'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Platform Directory & Discovery',
    description: 'Get discovered by shoppers browsing the Visible Shelf marketplace with enhanced directory listings.',
    benefits: [
      'Platform directory listing',
      'Enhanced store discovery',
      'Category browsing',
      'Location-based search',
      'Shopper inquiry system'
    ],
    color: 'bg-purple-100 text-purple-600',
    category: 'Platform Presence'
  },

  // COMMERCE & CONVERSION
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Add to Cart & Checkout Flow',
    description: 'Complete shopping experience with cart management and streamlined checkout process.',
    benefits: [
      'Add to cart functionality',
      'Shopping cart management',
      'Guest checkout support',
      'Mobile-optimised checkout',
      'Order confirmation'
    ],
    color: 'bg-gradient-to-br from-amber-500 to-red-600 text-white',
    badge: 'COMMERCE',
    category: 'Commerce & Conversion'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Commitment Commerce - Holding Deposits',
    description: '🎯 Capture shopper intent with 10-15% holding deposits. Guarantee foot traffic without full payment.',
    benefits: [
      '10–15% holding fee collected',
      'Inventory reservation guaranteed',
      'Shopper commitment verification',
      'Forfeiture protection for retailers',
      'Reduced no-shows significantly'
    ],
    color: 'bg-red-100 text-red-600',
    badge: 'COMMITMENT',
    category: 'Commerce & Conversion'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Click & Collect / BOPIS',
    description: 'Buy online, pick up in store with real-time inventory availability and pickup scheduling.',
    benefits: [
      'Buy online, pick up in store',
      'Real-time inventory check',
      'Pickup scheduling',
      'Store fulfillment workflow',
      'Customer notifications'
    ],
    color: 'bg-orange-100 text-orange-600',
    category: 'Commerce & Conversion'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Full Online Payment Collection',
    description: 'Complete e-commerce payments with multiple payment methods and automatic order processing.',
    benefits: [
      'Full online payment processing',
      'Multiple payment methods',
      'Automatic order processing',
      'Payment security & compliance',
      'Refund management'
    ],
    color: 'bg-amber-100 text-amber-600',
    category: 'Commerce & Conversion'
  },

  // MANAGEMENT & GROWTH
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Analytics & Conversion Reporting',
    description: 'Track reservations, pickups, abandonment, and revenue with comprehensive analytics dashboard.',
    benefits: [
      'Conversion analytics',
      'Inventory reports',
      'Performance metrics',
      'Abandonment tracking',
      'Export reports'
    ],
    color: 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white',
    badge: 'ANALYTICS',
    category: 'Management & Growth'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Multi-Location Management',
    description: '🚀 POWERFUL: Manage all locations from one dashboard with propagation and testing capabilities.',
    benefits: [
      'Products & user roles propagation',
      'Hours, profile, categories sync',
      'Test on single location first',
      'One-click multi-location distribution',
      'Advanced features for enterprise control'
    ],
    color: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white',
    badge: 'STARTER+',
    category: 'Management & Growth'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    title: 'API Access & Custom Integrations',
    description: 'Advanced API access for custom integrations and enterprise workflow automation.',
    benefits: [
      'RESTful API access',
      'Webhook support',
      'Custom integration tools',
      'Developer documentation',
      'Technical support'
    ],
    color: 'bg-blue-100 text-blue-600',
    category: 'Management & Growth'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Enterprise Security & Compliance',
    description: 'Bank-level security with role-based access control, audit logs, and data encryption.',
    benefits: [
      'Role-based access control',
      'Audit logging',
      'Data encryption',
      'SOC 2 compliant',
      'Dedicated support'
    ],
    color: 'bg-red-100 text-red-600',
    badge: 'ENTERPRISE',
    category: 'Management & Growth'
  },

  // ADDITIONAL FEATURES
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Photo Management & Cloud Storage',
    description: 'Professional product photography tools with cloud storage and automatic optimization.',
    benefits: ['Cloud storage', 'Auto-optimization', 'Bulk upload', 'Image gallery'],
    color: 'bg-purple-100 text-purple-600',
    category: 'Management & Growth'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    title: 'QR Code Marketing & Sharing',
    description: 'QR codes on every page for easy sharing. Storefront and Discovery tiers get basic QR codes, while Commitment+ tiers get branded QR codes with store logo.',
    benefits: [
      'Product page QR codes (share individual products)',
      'Storefront page QR codes (share complete store)',
      'Directory listing QR codes (share directory presence)',
      'Basic QR codes for Discovery & Storefront tiers',
      'Branded QR codes with store logo for Commitment+ tiers',
      'High-resolution print-ready quality',
      'Mobile-optimized sharing experience'
    ],
    color: 'bg-pink-100 text-pink-600',
    badge: 'SHARING',
    category: 'Platform Presence'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Quick Start Wizard',
    description: '🚀 Generate 50-100 realistic products in 1 SECOND. No manual data entry, no spreadsheets.',
    benefits: [
      '360x faster than manual entry',
      'Beats barcode scanning (no equipment!)',
      'Beats CSV import (no data cleanup!)',
      '4 ready-to-go business scenarios',
      'Auto-categorized with real prices'
    ],
    color: 'bg-gradient-to-br from-blue-500 to-purple-600 text-white',
    badge: 'GAME CHANGER',
    category: 'Clover & Inventory'
  }
];

const tiers = [
  {
    name: 'Discovery',
    price: '$29',
    period: '/month',
    tagline: 'Get Found on Google',
    description: 'Complete Google visibility stack for small retailers',
    trial: '14-day free trial',
    identity: 'I exist online',
    realization: 'People are finding my products on Google',
    upgradeTrigger: 'Now I want them to find my whole store',
    features: [
      'Clover POS integration & real-time inventory sync',
      'SEO-optimised product pages (hosted on platform)',
      'Google Search indexing',
      'Google Shopping visibility', 
      'Google Maps / SWIS (See What\'s In Store)',
      'Platform directory listing',
      'Basic QR codes (product, storefront, directory)',
      '14-day free trial'
    ],
    excluded: [
      'Platform product visibility',
      'Branded storefront page',
      'Store logo on QR codes',
      'Add to cart / checkout',
      'Conversion features',
      'Payment processing'
    ],
    commerceMode: '❌ Commerce Disabled',
    cta: 'Start Free Trial',
    popular: false,
    badge: 'GET ONLINE',
    color: 'from-blue-500 to-purple-600'
  },
  {
    name: 'Storefront',
    price: '$59',
    period: '/month',
    tagline: 'Own Your Platform Presence',
    description: 'Branded storefront inside Visible Shelf marketplace',
    trial: '14-day free trial',
    identity: 'I have a store online',
    realization: 'Shoppers are browsing — but can\'t act on it',
    upgradeTrigger: 'I want shoppers to commit to buying',
    features: [
      'Everything in Discovery',
      'Branded public storefront page',
      'Platform product visibility',
      'Platform search & browse',
      'Product categories & filtering',
      'Store profile, hours & details',
      'Shopper inquiry / contact seller',
      'Enhanced directory listing',
      'Basic QR codes (product, storefront, directory)',
      '14-day free trial'
    ],
    excluded: [
      'Store logo on QR codes',
      'Add to cart / checkout flow',
      'Conversion & reservation features',
      'Payment processing'
    ],
    commerceMode: '❌ Commerce Disabled',
    cta: 'Start Free Trial',
    popular: true,
    badge: 'MOST POPULAR',
    color: 'from-purple-500 to-indigo-600'
  },
  {
    name: 'Commitment',
    price: '$79',
    period: '/month',
    tagline: 'Capture Intent & Drive Foot Traffic',
    description: 'Deposit-based commerce to drive in-store pickup',
    trial: '14-day free trial',
    identity: 'I am selling online',
    realization: 'Shoppers reserve and show up — but some want to pay fully online',
    upgradeTrigger: 'I want to offer flexible payment options',
    features: [
      'Everything in Discovery & Storefront',
      'Add to cart',
      'Checkout flow',
      'Deposit collection (10-15%)',
      'Reserve / hold in store',
      'Click and collect / BOPIS',
      'Shopper notifications',
      'Real-time inventory availability indicators',
      'Conversion analytics & reporting',
      'Branded QR codes with store logo',
      '14-day free trial'
    ],
    excluded: [
      'Full online payment collection',
      'Delivery / fulfilment options'
    ],
    commerceMode: '💳 Deposit Only Required',
    cta: 'Start Free Trial',
    popular: false,
    badge: 'DEPOSIT COMMERCE',
    color: 'from-green-500 to-emerald-600'
  },
  {
    name: 'E-commerce',
    price: '$99',
    period: '/month',
    tagline: 'Full Online Payment Processing',
    description: 'Complete e-commerce with full payment collection and delivery',
    trial: '14-day free trial',
    identity: 'I need full online sales capabilities',
    realization: 'I can process complete transactions online',
    upgradeTrigger: 'I want to offer both deposit and full payment options',
    features: [
      'Everything in Discovery, Storefront & Commitment',
      'Add to cart',
      'Full online payment collection',
      'Delivery / fulfilment options',
      'Shipping integration',
      'Order management',
      'Conversion analytics & reporting',
      'Branded QR codes with store logo',
      '14-day free trial'
    ],
    excluded: [
      'Deposit payment options',
      'Multi-location support'
    ],
    commerceMode: '💰 Full Payment Only',
    cta: 'Start Free Trial',
    popular: false,
    badge: 'FULL ECOMMERCE',
    color: 'from-cyan-500 to-blue-600'
  },
  {
    name: 'Omnichannel',
    price: '$149',
    period: '/month',
    tagline: 'Flexible Commerce - All Channels',
    description: 'Multi-channel retail with pickup, delivery, and shipping',
    trial: '14-day free trial',
    identity: 'I sell across multiple channels',
    realization: 'Customers can choose how they shop and pay',
    upgradeTrigger: 'I need advanced features and higher limits',
    features: [
      'Everything in Discovery, Storefront, Commitment & E-commerce',
      'Flexible payment options (deposit OR full payment)',
      'Delivery / fulfilment options',
      'Shipping integration',
      'Advanced analytics & reporting',
      'Branded QR codes with store logo',
      'API access & custom integrations',
      'Priority directory placement',
      '14-day free trial'
    ],
    excluded: [
      'Multi-location support (beyond 10 locations)',
      'Enterprise features'
    ],
    commerceMode: '🔄 Flexible (Deposit or Full Payment)',
    cta: 'Start Free Trial',
    popular: false,
    badge: 'OMNICHANNEL',
    color: 'from-indigo-500 to-purple-600'
  },
  {
    name: 'Professional',
    price: '$199',
    period: '/month',
    tagline: 'Premium Commerce Platform',
    description: 'Maximum flexibility with all payment options and multi-location support',
    trial: '14-day free trial',
    identity: 'I need the most powerful commerce solution',
    realization: 'I have complete control over customer experience',
    upgradeTrigger: 'Growth, scale, and advanced business needs',
    features: [
      'Everything in all lower tiers',
      'Flexible payment options (deposit OR full payment)',
      'Delivery / fulfilment options',
      'Shipping integration',
      'Advanced analytics & reporting',
      'Branded QR codes with store logo',
      'API access & custom integrations',
      'Priority directory placement',
      'Multi-location support (up to 5 locations)',
      'Higher limits (2000 SKUs)',
      '14-day free trial'
    ],
    excluded: [
      'Multi-location support (beyond 5 locations)',
      'Enterprise security & compliance'
    ],
    commerceMode: '🔄 Flexible (Deposit or Full Payment)',
    cta: 'Start Free Trial',
    popular: false,
    badge: 'PREMIUM',
    color: 'from-amber-500 to-orange-600'
  },
  {
    name: 'Enterprise',
    price: '$499',
    period: '/month',
    tagline: 'Complete Business Solution',
    description: 'Full e-commerce plus enterprise features and multi-location support',
    trial: '14-day free trial',
    identity: 'I am running a complete business operation',
    realization: 'I have enterprise-grade tools and support',
    upgradeTrigger: 'Maximum scale and customization',
    features: [
      'Everything in all lower tiers',
      'Flexible payment options (deposit OR full payment)',
      'Multi-location support (20 locations)',
      'Advanced analytics dashboard',
      'Dedicated onboarding & support',
      'Enterprise security & compliance',
      'Custom contracts & pricing',
      'White-label options',
      'Priority directory & platform placement',
      'Highest limits (10,000 SKUs)',
      '14-day free trial'
    ],
    excluded: [],
    commerceMode: '🔄 Flexible (Deposit or Full Payment)',
    cta: 'Start Free Trial',
    popular: false,
    badge: 'ENTERPRISE',
    color: 'from-red-500 to-pink-600'
  }
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
              <a href="/auth/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </a>
              <a href="/auth/signup">
                <Button size="sm">Get Started</Button>
              </a>
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
              <a href="/auth/signup">
                <Button size="lg">Start Free Trial</Button>
              </a>
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
                        <span>Trial any tier (Discovery, Storefront, Commitment, Professional, or Enterprise)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Full access to all tier features</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Clover POS integration & real-time sync</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Google Search, Shopping & Maps visibility</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>Platform directory & storefront (Storefront+)</span>
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
                      <li className="flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        <span>If you don't upgrade, your account moves into read-only visibility mode: your storefront, directory, and Google listings stay online, but you can't add or update products or sync new changes until you choose a paid plan.</span>
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                  <p className="text-sm text-neutral-800">
                    <strong>💡 Pro Tip:</strong> Use the trial period to connect Clover, see your products indexed on Google, appear on Google Maps, and test the platform. Experience the tier progression from Discovery → Storefront → Commitment → Professional → Enterprise before choosing your path.
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                
                {/* V2 Commerce Mode Display */}
                {tier.commerceMode && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm font-medium text-blue-800 mb-1">Checkout Mode:</div>
                    <div className="text-sm text-blue-700">{tier.commerceMode}</div>
                  </div>
                )}
                
                <a href="/auth/signup" className="block mb-6">
                  <Button className="w-full" variant={tier.popular ? 'primary' : 'secondary'}>
                    {tier.cta}
                  </Button>
                </a>
                <ul className="space-y-3">
                  {tier.features.map((feature: any, idx: number) => (
                    <li key={idx} className="flex items-start text-sm text-neutral-700">
                      <svg className="w-5 h-5 text-primary-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {typeof feature === 'object' ? feature.featureName || feature.featureKey : feature}
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

      {/* Commitment Commerce Model Section */}
      <section className="py-20 bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-neutral-900 mb-4">
              Revolutionizing Retail Commerce
            </h2>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
              Our unique Commitment Commerce model protects retailers while giving shoppers the flexibility they want. No more abandoned carts - just guaranteed foot traffic.
            </p>
          </div>

          {/* Commerce Model Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            {/* Traditional E-commerce */}
            <div className="bg-white border-2 border-red-200 rounded-xl p-6 shadow-lg">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-red-600">Traditional E-commerce</h3>
                <p className="text-sm text-neutral-600 mt-1">High Risk, High Abandonment</p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>70%+ cart abandonment rate</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>No upfront commitment from shoppers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>Inventory held without guarantee</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>Full payment required upfront</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>High customer acquisition cost</span>
                </li>
              </ul>
              <div className="mt-4 p-3 bg-red-50 rounded-lg text-center">
                <p className="text-xs text-red-700 font-semibold">Retailer bears all the risk</p>
              </div>
            </div>

            {/* Commitment Commerce */}
            <div className="bg-white border-2 border-green-500 rounded-xl p-6 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                  VISIBLE SHELF
                </span>
              </div>
              <div className="text-center mb-4 mt-2">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-green-600">Commitment Commerce</h3>
                <p className="text-sm text-neutral-600 mt-1">Smart Risk Management</p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>10-15% holding deposit secures commitment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Shopper financial stake in transaction</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Inventory never held without protection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Remaining balance paid in store</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Guaranteed foot traffic & pickup</span>
                </li>
              </ul>
              <div className="mt-4 p-3 bg-green-50 rounded-lg text-center">
                <p className="text-xs text-green-700 font-semibold">Shared risk, shared success</p>
              </div>
            </div>

            {/* Professional E-commerce */}
            <div className="bg-white border-2 border-amber-200 rounded-xl p-6 shadow-lg">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-amber-600">Professional E-commerce</h3>
                <p className="text-sm text-neutral-600 mt-1">Maximum Flexibility</p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">✓</span>
                  <span>Shopper chooses payment path</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">✓</span>
                  <span>Deposit OR full payment option</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">✓</span>
                  <span>Delivery and fulfillment services</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">✓</span>
                  <span>Complete online transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">✓</span>
                  <span>Advanced analytics & insights</span>
                </li>
              </ul>
              <div className="mt-4 p-3 bg-amber-50 rounded-lg text-center">
                <p className="text-xs text-amber-700 font-semibold">Customer choice, retailer control</p>
              </div>
            </div>
          </div>

          {/* Holding Fee Breakdown */}
          <div className="bg-white border-2 border-green-200 rounded-xl p-8 shadow-lg mb-12">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              How the Holding Fee Model Works
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-green-600 font-bold text-xl">1</span>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">Shopper Commits</h4>
                <p className="text-sm text-neutral-600">
                  Shopper pays 10-15% holding deposit at checkout. This secures their commitment and reserves the inventory.
                </p>
                <div className="mt-3 p-2 bg-green-50 rounded text-xs text-green-700">
                  Example: $100 item → $10-15 deposit
                </div>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-600 font-bold text-xl">2</span>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">Retailer Protected</h4>
                <p className="text-sm text-neutral-600">
                  Inventory is reserved with financial commitment. No more holding products for shoppers who never show up.
                </p>
                <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                  Guaranteed foot traffic
                </div>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-purple-600 font-bold text-xl">3</span>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">Transaction Completes</h4>
                <p className="text-sm text-neutral-600">
                  Shopper picks up and pays remaining balance in store, or forfeits deposit if they don't show up.
                </p>
                <div className="mt-3 p-2 bg-purple-50 rounded text-xs text-purple-700">
                  Win-win outcome
                </div>
              </div>
            </div>
          </div>

          {/* Abandoned Fee Distribution */}
          <div className="bg-white border-2 border-neutral-200 rounded-xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              Fair & Transparent Fee Distribution
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Successful Transaction */}
              <div className="p-6 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Order Fulfilled
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Holding deposit:</span>
                    <span className="font-semibold">Credited to purchase</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform fee:</span>
                    <span className="font-semibold">Small processing fee</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retailer gets:</span>
                    <span className="font-semibold text-green-600">Full sale revenue</span>
                  </div>
                </div>
              </div>

              {/* Abandoned Transaction */}
              <div className="p-6 bg-amber-50 rounded-lg">
                <h4 className="font-semibold text-amber-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Order Abandoned
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Holding deposit:</span>
                    <span className="font-semibold">Forfeited by shopper</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform fee:</span>
                    <span className="font-semibold">20-25% of deposit</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retailer gets:</span>
                    <span className="font-semibold text-amber-600">75-80% of deposit</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-sm text-blue-900 font-semibold">
                💡 The retailer is never the loser. The platform never takes more than it earns. 
                The shopper bears the consequence of their own behavior.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Location & Organization Model Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-neutral-900 mb-4">
              Built for Multi-Location Success
            </h2>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
              Our organization model scales from single locations to enterprise chains. Set your baseline tier and let individual locations upgrade as they grow.
            </p>
          </div>

          {/* Organization vs Individual Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {/* Individual Location */}
            <div className="bg-white border-2 border-blue-200 rounded-xl p-6 shadow-lg">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-blue-600">Individual Location</h3>
                <p className="text-sm text-neutral-600 mt-1">Perfect for independent retailers</p>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Direct tier selection (Discovery → Enterprise)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Full control over features and capabilities</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Independent billing and management</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Simple setup and administration</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Standalone analytics and reporting</span>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-blue-700 font-semibold">Start here, scale later</p>
              </div>
            </div>

            {/* Organization Account */}
            <div className="bg-white border-2 border-purple-500 rounded-xl p-6 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                  ENTERPRISE
                </span>
              </div>
              <div className="text-center mb-4 mt-2">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-purple-600">Organization Account</h3>
                <p className="text-sm text-neutral-600 mt-1">Designed for chains and franchises</p>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>Set baseline tier for all locations</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>Individual locations can upgrade above baseline</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>Unified billing and management</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>Consolidated analytics across all locations</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>Centralized brand control with local flexibility</span>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-purple-50 rounded-lg text-center">
                <p className="text-xs text-purple-700 font-semibold">Scale with confidence</p>
              </div>
            </div>
          </div>

          {/* Inheritance & Upgrade Model */}
          <div className="bg-white border-2 border-purple-200 rounded-xl p-8 shadow-lg mb-12">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              The Inheritance & Upgrade Model
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Downward Inheritance */}
              <div className="p-6 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Downward Inheritance
                </h4>
                <p className="text-sm text-purple-800 mb-4">
                  All locations automatically receive the organization's baseline tier features.
                </p>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span>Org sets baseline:</span>
                      <span className="font-semibold">Storefront</span>
                    </div>
                    <div className="flex justify-between">
                      <span>All locations get:</span>
                      <span className="font-semibold text-green-600">Storefront features</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Individual upgrades:</span>
                      <span className="font-semibold">Allowed above baseline</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upward Flexibility */}
              <div className="p-6 bg-indigo-50 rounded-lg">
                <h4 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  Upward Flexibility
                </h4>
                <p className="text-sm text-indigo-800 mb-4">
                  Individual locations can upgrade above the organizational baseline.
                </p>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span>Org baseline:</span>
                      <span className="font-semibold">Storefront</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Flagship upgrades to:</span>
                      <span className="font-semibold text-amber-600">Professional</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Other locations stay at:</span>
                      <span className="font-semibold">Storefront</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Flow */}
            <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-lg p-6">
              <div className="text-center mb-4">
                <h4 className="font-semibold text-purple-900">Organizational Structure Example</h4>
              </div>
              <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
                <div className="text-center">
                  <div className="w-20 h-20 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold mb-2">
                    ORG
                  </div>
                  <p className="text-xs font-semibold">Storefront Tier</p>
                  <p className="text-xs text-neutral-600">Baseline</p>
                </div>
                <div className="hidden lg:block text-2xl text-purple-600">↓</div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-300 rounded-lg flex items-center justify-center text-white font-bold mb-2">
                      A
                    </div>
                    <p className="text-xs font-semibold">Storefront</p>
                    <p className="text-xs text-neutral-600">Baseline</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-300 rounded-lg flex items-center justify-center text-white font-bold mb-2">
                      B
                    </div>
                    <p className="text-xs font-semibold">Storefront</p>
                    <p className="text-xs text-neutral-600">Baseline</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold mb-2">
                      C
                    </div>
                    <p className="text-xs font-semibold">Professional</p>
                    <p className="text-xs text-amber-600">Upgraded</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-300 rounded-lg flex items-center justify-center text-white font-bold mb-2">
                      D
                    </div>
                    <p className="text-xs font-semibold">Storefront</p>
                    <p className="text-xs text-neutral-600">Baseline</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Location Pricing Tiers */}
          <div className="bg-white border-2 border-neutral-200 rounded-xl p-8 shadow-lg mb-12">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              Multi-Location Pricing Plans
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Small Chains */}
              <div className="border-2 border-blue-200 rounded-lg p-6">
                <div className="text-center mb-4">
                  <h4 className="text-lg font-bold text-blue-600">Small Chains</h4>
                  <p className="text-2xl font-bold text-neutral-900 mb-2">$299<span className="text-sm text-neutral-600">/mo</span></p>
                  <p className="text-sm text-neutral-600">2-5 locations</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>Baseline tier for all locations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>$49 per additional location</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>Unified dashboard</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>Consolidated billing</span>
                  </li>
                </ul>
              </div>

              {/* Regional Chains */}
              <div className="border-2 border-purple-200 rounded-lg p-6">
                <div className="text-center mb-4">
                  <h4 className="text-lg font-bold text-purple-600">Regional Chains</h4>
                  <p className="text-2xl font-bold text-neutral-900 mb-2">Custom<span className="text-sm text-neutral-600">/mo</span></p>
                  <p className="text-sm text-neutral-600">6-19 locations</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">✓</span>
                    <span>Custom pricing based on volume</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">✓</span>
                    <span>Dedicated account management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">✓</span>
                    <span>Advanced analytics suite</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">✓</span>
                    <span>Priority support</span>
                  </li>
                </ul>
              </div>

              {/* National Chains */}
              <div className="border-2 border-red-200 rounded-lg p-6">
                <div className="text-center mb-4">
                  <h4 className="text-lg font-bold text-red-600">National Chains</h4>
                  <p className="text-2xl font-bold text-neutral-900 mb-2">Enterprise<span className="text-sm text-neutral-600">/mo</span></p>
                  <p className="text-sm text-neutral-600">20+ locations</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5">✓</span>
                    <span>Enterprise-grade features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5">✓</span>
                    <span>White-label options</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5">✓</span>
                    <span>Custom integrations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5">✓</span>
                    <span>Dedicated success team</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Multi-Location Shopper Experience */}
          <div className="bg-white border-2 border-neutral-200 rounded-xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              Seamless Multi-Location Shopping Experience
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Discovery */}
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">Product Discovery</h4>
                <p className="text-sm text-neutral-600">
                  Shopper searches for products across all nearby locations
                </p>
              </div>

              {/* Location Selection */}
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">Choose Location</h4>
                <p className="text-sm text-neutral-600">
                  View availability across multiple nearby stores
                </p>
              </div>

              {/* Purchase */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">Complete Purchase</h4>
                <p className="text-sm text-neutral-600">
                  Checkout at chosen location with preferred payment method
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 text-center">
              <p className="text-sm text-neutral-800 font-semibold mb-2">
                🎯 <strong>Platform Advantage:</strong> Even large retailers struggle with multi-location inventory visibility. 
                Visible Shelf delivers it natively through a single Clover integration.
              </p>
              <p className="text-xs text-neutral-600">
                Shoppers see availability across all your locations and choose their preferred store - driving traffic to your entire network.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Competitive Positioning & Market Moat Section */}
      <section className="py-20 bg-gradient-to-br from-red-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-neutral-900 mb-4">
              Unmatched Competitive Advantage
            </h2>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
              We're not just another platform. We're solving a problem that even large retailers struggle with - built specifically for the retailers who need it most.
            </p>
          </div>

          {/* Market Problem Analysis */}
          <div className="bg-white border-2 border-red-200 rounded-xl p-8 shadow-lg mb-12">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              The Four-Part Problem No One Else Solves
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Complexity */}
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h4 className="font-bold text-red-600 mb-2">COMPLEXITY</h4>
                <p className="text-sm text-neutral-600 mb-3">
                  Real-time inventory systems require sophisticated technical architecture
                </p>
                <div className="text-xs text-red-700 bg-red-50 rounded p-2">
                  Small retailers can't build or maintain this infrastructure
                </div>
              </div>

              {/* Connectivity */}
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-bold text-orange-600 mb-2">CONNECTIVITY</h4>
                <p className="text-sm text-neutral-600 mb-3">
                  Linking POS inventory to Google requires deep platform integrations
                </p>
                <div className="text-xs text-orange-700 bg-orange-50 rounded p-2">
                  Multiple platforms, APIs, and technical requirements
                </div>
              </div>

              {/* Availability */}
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-bold text-amber-600 mb-2">AVAILABILITY</h4>
                <p className="text-sm text-neutral-600 mb-3">
                  No existing solution built specifically for small retailers
                </p>
                <div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                  Big-box built internally, small retailers have no path
                </div>
              </div>

              {/* Affordability */}
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h4 className="font-bold text-yellow-600 mb-2">AFFORDABILITY</h4>
                <p className="text-sm text-neutral-600 mb-3">
                  Small retailers can't sustain enterprise-level technology costs
                </p>
                <div className="text-xs text-yellow-700 bg-yellow-50 rounded p-2">
                  No IT teams, no enterprise budgets, no dedicated resources
                </div>
              </div>
            </div>
          </div>

          {/* Barriers to Entry */}
          <div className="bg-white border-2 border-purple-200 rounded-xl p-8 shadow-lg mb-12">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              Why Competitors Can't Easily Replicate This
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Engineering Complexity */}
              <div className="p-6 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Engineering Complexity
                </h4>
                <p className="text-sm text-purple-800 mb-4">
                  The technical barrier is substantial - most underestimate the challenge and walk away.
                </p>
                <ul className="space-y-2 text-sm text-purple-700">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">•</span>
                    <span>Clover integration + SEO infrastructure + Google SWIS</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">•</span>
                    <span>Real-time sync across multiple platforms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">•</span>
                    <span>Commerce layer with commitment model</span>
                  </li>
                </ul>
              </div>

              {/* Time to Market */}
              <div className="p-6 bg-indigo-50 rounded-lg">
                <h4 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Time to Market Advantage
                </h4>
                <p className="text-sm text-indigo-800 mb-4">
                  We're years ahead - starting today means beginning months or years behind.
                </p>
                <ul className="space-y-2 text-sm text-indigo-700">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-0.5">•</span>
                    <span>Head start compounds with every new retailer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-0.5">•</span>
                    <span>Network effects grow stronger over time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-0.5">•</span>
                    <span>Customer acquisition costs increase for followers</span>
                  </li>
                </ul>
              </div>

              {/* Google SWIS Access */}
              <div className="p-6 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Google SWIS Integration
                </h4>
                <p className="text-sm text-blue-800 mb-4">
                  Google SWIS is underutilized - we've built the bridge others haven't.
                </p>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>See What's In Store integration is complex</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Requires deep Google Maps knowledge</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Unglamorous work that doesn't attract venture attention</span>
                  </li>
                </ul>
              </div>

              {/* Clover Ecosystem */}
              <div className="p-6 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Clover Ecosystem Access
                </h4>
                <p className="text-sm text-green-800 mb-4">
                  Clover serves hundreds of thousands of small businesses - instant distribution.
                </p>
                <ul className="space-y-2 text-sm text-green-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>Native integration provides immediate market access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>Ready-made customer base of small retailers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>Trusted POS system with existing relationships</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Network Effects */}
          <div className="bg-white border-2 border-neutral-200 rounded-xl p-8 shadow-lg mb-12">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              The Network Effect Flywheel
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              {/* More Retailers */}
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">More Retailers</h4>
                <p className="text-sm text-neutral-600">
                  Each new retailer expands product variety and geographic coverage
                </p>
              </div>

              {/* More Shoppers */}
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">More Shoppers</h4>
                <p className="text-sm text-neutral-600">
                  Better selection attracts more shoppers to the platform
                </p>
              </div>

              {/* More Data */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">Better Data</h4>
                <p className="text-sm text-neutral-600">
                  More activity improves search, recommendations, and insights
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 text-center">
              <p className="text-sm text-neutral-800 font-semibold">
                🔄 <strong>The Flywheel Effect:</strong> More retailers → More products → More shoppers → More data → 
                Better experience → Even more retailers. The network effect compounds over time.
              </p>
            </div>
          </div>

          {/* Market Positioning */}
          <div className="bg-white border-2 border-neutral-200 rounded-xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              Our Unique Market Position
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Middle Market Neglect */}
              <div className="p-6 bg-red-50 rounded-lg">
                <h4 className="font-semibold text-red-900 mb-4">The Sweet Spot Everyone Missed</h4>
                <p className="text-sm text-red-800 mb-4">
                  Local retail is too small for enterprise vendors, too complex for website builders, too fragmented for large e-commerce platforms.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-red-700">Enterprise vendors ignore small retailers</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-red-700">Website builders lack inventory integration</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-red-700">E-commerce platforms target online-only businesses</span>
                  </div>
                </div>
              </div>

              {/* Our Solution */}
              <div className="p-6 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-4">We Own the Gap</h4>
                <p className="text-sm text-green-800 mb-4">
                  Visible Shelf is built specifically for the retailers everyone else forgot - with the exact features they need.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-700">Designed for local retailers with physical stores</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-700">Native POS integration with real-time inventory</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-700">Commitment commerce model protects retailers</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-gradient-to-r from-purple-50 to-red-50 rounded-lg text-center">
              <p className="text-sm text-neutral-800 font-semibold">
                🎯 <strong>Positioning Statement:</strong> We're the only platform that bridges local retail inventory to 
                online discovery with guaranteed foot traffic - built for the retailers who need it most.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform North Star Section */}
      <section className="py-20 bg-gradient-to-br from-neutral-900 to-neutral-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">
            The Platform North Star
          </h2>
          <div className="text-xl mb-8 space-y-4">
            <p className="text-neutral-200">
              <strong>Visible Shelf meets retailers where they are — and shows them where they could be.</strong>
            </p>
            <p className="text-neutral-300">
              Every tier is powered by the same Clover integration and the same platform infrastructure. 
              Retailers move up as their ambition grows — without ever changing systems.
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8 mb-8">
            <h3 className="text-2xl font-bold mb-4">Every Tier, One Mission</h3>
            <p className="text-lg text-neutral-200 mb-6">
              Product visibility that drives conversion — without the IT team.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">1</span>
                </div>
                <h4 className="font-semibold mb-2">Single Integration</h4>
                <p className="text-neutral-300">
                  One Clover connection powers everything from Google visibility to e-commerce
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">2</span>
                </div>
                <h4 className="font-semibold mb-2">Progressive Growth</h4>
                <p className="text-neutral-300">
                  Start with visibility, grow to full e-commerce at your own pace
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">3</span>
                </div>
                <h4 className="font-semibold mb-2">Guaranteed Results</h4>
                <p className="text-neutral-300">
                  From Google indexing to guaranteed foot traffic, every tier delivers value
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-lg text-neutral-300 mb-6">
              This isn't just software — it's a complete business transformation platform.
            </p>
            <a href="/auth/signup">
              <Button size="lg" className="bg-white text-neutral-900 hover:bg-neutral-100">
                Start Your Transformation
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Comprehensive Capability Matrix */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-neutral-900 mb-4">
              Complete Feature Comparison
            </h2>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
              See exactly what's included in each tier. Every capability builds on the previous tier, creating a clear path for growth.
            </p>
          </div>

          {/* Capability Matrix Table */}
          <div className="bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="text-left p-4 font-semibold text-neutral-900 w-1/4">Capability</th>
                    <th className="text-center p-4 font-semibold text-neutral-900">
                      <div className="flex flex-col items-center">
                        <span className="text-blue-600 font-bold">Discovery</span>
                        <span className="text-sm text-neutral-600 font-normal">$29/mo</span>
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold text-neutral-900">
                      <div className="flex flex-col items-center">
                        <span className="text-purple-600 font-bold">Storefront</span>
                        <span className="text-sm text-neutral-600 font-normal">$59/mo</span>
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold text-neutral-900">
                      <div className="flex flex-col items-center">
                        <span className="text-green-600 font-bold">Commitment</span>
                        <span className="text-sm text-neutral-600 font-normal">$99/mo</span>
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold text-neutral-900">
                      <div className="flex flex-col items-center">
                        <span className="text-amber-600 font-bold">Professional</span>
                        <span className="text-sm text-neutral-600 font-normal">$199/mo</span>
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold text-neutral-900">
                      <div className="flex flex-col items-center">
                        <span className="text-red-600 font-bold">Enterprise</span>
                        <span className="text-sm text-neutral-600 font-normal">$499/mo</span>
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold text-neutral-900">
                      <div className="flex flex-col items-center">
                        <span className="text-cyan-600 font-bold">Ecommerce</span>
                        <span className="text-sm text-neutral-600 font-normal">$99/mo</span>
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold text-neutral-900">
                      <div className="flex flex-col items-center">
                        <span className="text-indigo-600 font-bold">Omnichannel</span>
                        <span className="text-sm text-neutral-600 font-normal">$149/mo</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* CLOVER & INVENTORY */}
                  <tr className="border-b border-neutral-100">
                    <td colSpan={8} className="p-4 bg-blue-50 font-semibold text-blue-900">
                      🔗 Clover & Inventory
                    </td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Clover POS integration & real-time sync</td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Real-time inventory management</td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>

                  {/* GOOGLE VISIBILITY */}
                  <tr className="border-b border-neutral-100">
                    <td colSpan={8} className="p-4 bg-green-50 font-semibold text-green-900">
                      🔍 Google Visibility
                    </td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Google Search indexing</td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Google Shopping</td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Google Maps / SWIS</td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>

                  {/* PLATFORM PRESENCE */}
                  <tr className="border-b border-neutral-100">
                    <td colSpan={8} className="p-4 bg-purple-50 font-semibold text-purple-900">
                      🏪 Platform Presence
                    </td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Directory listing</td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Platform product visibility</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Branded storefront page</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">QR codes (product, storefront, directory)</td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Store logo on QR codes</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>

                  {/* COMMERCE & CONVERSION */}
                  <tr className="border-b border-neutral-100">
                    <td colSpan={8} className="p-4 bg-amber-50 font-semibold text-amber-900">
                      🛒 Commerce & Conversion
                    </td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Add to cart</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Checkout flow</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Holding / commitment fee (10–15%)</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-amber-600">🔄</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Full online payment collection</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Delivery / fulfilment</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>

                  {/* MANAGEMENT & GROWTH */}
                  <tr className="border-b border-neutral-100">
                    <td colSpan={8} className="p-4 bg-cyan-50 font-semibold text-cyan-900">
                      📈 Management & Growth
                    </td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Conversion analytics & reporting</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Advanced analytics dashboard</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">API access & custom integrations</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Multi-location support</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="p-4 text-neutral-900">Dedicated onboarding & support</td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-red-400">❌</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                    <td className="p-4 text-center"><span className="text-green-600">✅</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tier Progression Visual */}
          <div className="mt-16 text-center">
            <h3 className="text-2xl font-bold text-neutral-900 mb-8">Your Growth Journey</h3>
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 max-w-5xl mx-auto">
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                  1
                </div>
                <h4 className="font-semibold text-blue-600 mb-1">Discovery</h4>
                <p className="text-sm text-neutral-600">Get Found on Google</p>
              </div>
              <div className="hidden lg:block text-2xl text-neutral-400">→</div>
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                  2
                </div>
                <h4 className="font-semibold text-purple-600 mb-1">Storefront</h4>
                <p className="text-sm text-neutral-600">Platform Presence</p>
              </div>
              <div className="hidden lg:block text-2xl text-neutral-400">→</div>
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                  3
                </div>
                <h4 className="font-semibold text-green-600 mb-1">Commitment</h4>
                <p className="text-sm text-neutral-600">Capture Intent</p>
              </div>
              <div className="hidden lg:block text-2xl text-neutral-400">→</div>
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                  4
                </div>
                <h4 className="font-semibold text-amber-600 mb-1">Professional</h4>
                <p className="text-sm text-neutral-600">Full E-Commerce</p>
              </div>
              <div className="hidden lg:block text-2xl text-neutral-400">→</div>
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                  5
                </div>
                <h4 className="font-semibold text-red-600 mb-1">Enterprise</h4>
                <p className="text-sm text-neutral-600">Business Solution</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Path Choice Section */}
      <section className="py-20 bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-neutral-900 mb-4">
              Shopper Choice, Retailer Control
            </h2>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
              Professional and Enterprise tiers give shoppers the freedom to choose their payment path while retailers maintain complete control over their business.
            </p>
          </div>

          {/* Payment Path Options */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Commitment Path */}
            <div className="bg-white border-2 border-green-200 rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-600">Commitment Path</h3>
                  <p className="text-sm text-neutral-600">Available in all tiers</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">How it Works</h4>
                  <ul className="space-y-2 text-sm text-green-800">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>Shopper pays 10-15% holding deposit</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>Inventory reserved immediately</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>Remaining balance paid at pickup</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>Guaranteed foot traffic to store</span>
                    </li>
                  </ul>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Best For</h4>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>• Shoppers who want to see/try products</li>
                    <li>• High-value items requiring inspection</li>
                    <li>• Building customer relationships</li>
                    <li>• Driving additional in-store purchases</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Full Payment Path */}
            <div className="bg-white border-2 border-amber-200 rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-600">Full Payment Path</h3>
                  <p className="text-sm text-neutral-600">Professional & Enterprise tiers</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 rounded-lg">
                  <h4 className="font-semibold text-amber-900 mb-2">How it Works</h4>
                  <ul className="space-y-2 text-sm text-amber-800">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Shopper pays full amount online</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Transaction completed immediately</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Choose pickup or delivery</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Convenience-focused experience</span>
                    </li>
                  </ul>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">Best For</h4>
                  <ul className="space-y-1 text-sm text-purple-800">
                    <li>• Repeat customers who know products</li>
                    <li>• Time-sensitive purchases</li>
                    <li>• Delivery and fulfillment services</li>
                    <li>• Maximum convenience shoppers</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Shopper Experience Flow */}
          <div className="bg-white border-2 border-neutral-200 rounded-xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              The Shopper's Decision Journey
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">Discover Product</h4>
                <p className="text-sm text-neutral-600">
                  Found on Google, platform, or directory
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">View Details</h4>
                <p className="text-sm text-neutral-600">
                  Check availability, specs, pricing
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">Choose Path</h4>
                <p className="text-sm text-neutral-600">
                  Select deposit or full payment
                </p>
              </div>

              {/* Step 4 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="font-semibold text-neutral-900 mb-2">Complete Purchase</h4>
                <p className="text-sm text-neutral-600">
                  Pay deposit/full amount & checkout
                </p>
              </div>
            </div>

            <div className="mt-8 p-4 bg-gradient-to-r from-green-50 to-amber-50 rounded-lg text-center">
              <p className="text-sm text-neutral-800 font-semibold">
                🎯 <strong>Result:</strong> Retailer gets guaranteed commitment or full payment. 
                Shopper gets the flexibility they want. Everyone wins.
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
            <a href="/auth/signup">
              <Button size="lg" variant="secondary">
                Start Free Trial
              </Button>
            </a>
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
