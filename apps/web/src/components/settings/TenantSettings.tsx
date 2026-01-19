"use client";

import UnifiedSettings, { UnifiedSettingsConfig, transformToUnifiedConfig } from './UnifiedSettings';
import { useTenantComplete } from "@/hooks/dashboard/useTenantComplete";

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function TenantSettings({ tenantId }: { tenantId: string }) {
  // Legacy settings groups - will be transformed to unified format
   // Consolidated data fetching - replaces 3 separate API calls with 1
  const { tenant: tenantData, tier, usage, loading: completeLoading, error: completeError } = useTenantComplete(tenantId);
  const legacySettingsGroups = [
    {
      title: 'Account & Preferences',
      description: 'Personalize your experience',
      cards: [
        {
          title: 'My Account',
          description: 'View your role, privileges, and account information',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/account`,
          color: 'bg-blue-500',
        },
        {
          title: 'Appearance',
          description: 'Customize theme and visual preferences',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          ),
          href: '/settings/appearance',
          color: 'bg-indigo-500',
        },
        {
          title: 'Language & Region',
          description: 'Choose your preferred language',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          ),
          href: '/settings/language',
          color: 'bg-teal-500',
        },
      ],
    },
    {
      title: 'Subscription & Billing',
      description: 'Manage your plan and services',
      cards: [
        {
          title: 'Platform Offerings',
          description: 'View all subscription tiers, managed services, and benefits',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
          href: '/settings/offerings',
          color: 'bg-emerald-500',
          badge: 'Explore',
        },
        {
          title: 'My Subscription',
          description: 'Manage your plan, view features, and request changes',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/subscription`,
          color: 'bg-primary-500',
          badge: 'Manage',
          accessOptions: { roles: ['admin', 'support'] },
        },
      ],
    },
    {
      title: 'Organization Management',
      description: 'Manage your chain organization and multi-location features',
      cards: [
        {
          title: 'Chain Analytics',
          description: 'View chain-wide SKU usage and location breakdown',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/organization`,
          color: 'bg-orange-500',
          badge: 'Chain',
          accessOptions: { orgMember: true },
          fetchOrganization: true,
        },
        {
          title: 'Propagation Control Panel',
          description: 'Manage multi-location propagation for chains',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/propagation`,
          color: 'bg-indigo-500',
          badge: 'Chain',
          accessOptions: { chainPropagation: true },
          fetchOrganization: true,
        },
      ],
    },
    {
      title: 'Store Settings',
      description: 'Configure your store profile and settings',
      cards: [
        {
          title: 'Store Profile',
          description: 'Edit store identity and contact details',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/tenant`,
          color: 'bg-blue-500',
        },
        {
          title: 'Location Status',
          description: 'Manage operational status and temporary closures',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/location-status`,
          color: 'bg-green-500',
          accessOptions: { roles: ['admin', 'support'] },
          badge: 'New',
        },
        {
          title: 'Branding',
          description: 'Customize your store logo and visual identity',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/branding`,
          color: 'bg-purple-500',
        },
        {
          title: 'Custom Subdomain',
          description: 'Set up a custom subdomain for Google Shopping compliance',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/subdomain`,
          color: 'bg-blue-600',
          badge: 'GMC',
          accessOptions: { roles: ['admin', 'support'] },
          secondaryLink: {
            label: 'Verify Live',
            href: `/t/${tenantId}/settings/subdomain/verify`,
            icon: 'eye'
          },
        },
      ],
    },
    {
      title: 'Featured Products',
      description: 'Manage product visibility and display options',
      cards: [
        {
          title: 'Directory Featured Products',
          description: 'Manage featured products for store directory page',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/products/featuring`,
          color: 'bg-amber-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Storefront Featured Products',
          description: 'Manage featured products for storefront page',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/featured-products`,
          color: 'bg-yellow-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Inventory Featured Products',
          description: 'Highlight your best products with prominent display styling',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/products/featuring`,
          color: 'bg-amber-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
      ],
    },
    {
      title: 'Team',
      description: 'Manage your store team members',
      cards: [
        {
          title: 'Team Members',
          description: 'Invite and manage your store team',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/users`,
          color: 'bg-cyan-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
      ],
    },
    {
      title: 'Google Business Profile',
      description: 'Manage your Google Business Profile integration',
      cards: [
        {
          title: 'Store Hours',
          description: 'Manage hours and special days (syncs to Google)',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/hours`,
          color: 'bg-green-500',
          badge: 'Auto-Sync',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Business Category',
          description: 'Set your Google Business Profile category',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/gbp-category`,
          color: 'bg-amber-500',
          badge: 'M3',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Product Categories',
          description: 'Manage product categories for your inventory',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          href: `/t/${tenantId}/categories`,
          color: 'bg-indigo-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Directory Listing',
          description: 'Manage your public directory profile and visibility',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/directory`,
          color: 'bg-rose-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
      ],
    },
    {
      title: 'Order Processing',
      description: 'Configure payment gateways and online order processing',
      cards: [
        {
          title: 'Order Management',
          description: 'View and manage customer orders, fulfillment, and tracking',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          ),
          href: `/t/${tenantId}/orders`,
          color: 'bg-purple-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Payment Gateways',
          description: 'Configure Square, PayPal, and other payment processors for online orders',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/payment-gateways`,
          color: 'bg-emerald-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Fulfillment Options',
          description: 'Configure pickup, delivery, and shipping options for customers',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/fulfillment`,
          color: 'bg-blue-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
      ],
    },
    {
      title: 'POS Integrations',
      description: 'Connect your point-of-sale systems',
      cards: [
        {
          title: 'Clover & Square',
          description: 'Connect Clover, Square, and other POS systems',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations`,
          color: 'bg-green-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
      ],
    },
    {
      title: 'Google Integrations',
      description: 'Connect Google Merchant Center and Business Profile',
      cards: [
        {
          title: 'Google Merchant Center',
          description: 'Sync products to Google Shopping and free listings',
          icon: (
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/google`,
          color: 'bg-red-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Feed Validation',
          description: 'Validate your product feed before pushing to Google',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/feed-validation`,
          color: 'bg-blue-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
      ],
    },
    {
      title: 'Support & Help',
      description: 'Get assistance and contact our team',
      cards: [
        {
          title: 'Contact Us',
          description: 'Get in touch with our team for help or questions',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7a2 2 0 002 2z" />
            </svg>
          ),
          href: '/settings/contact',
          color: 'bg-pink-500',
          badge: 'Help',
        },
      ],
    },
  ];

  const config: UnifiedSettingsConfig = transformToUnifiedConfig(legacySettingsGroups, {
    title: `${tenantData?.name} Store Settings`,
    description: 'Manage your store settings and preferences',
    tenantId,
  });

  return <UnifiedSettings config={config} />;
}
