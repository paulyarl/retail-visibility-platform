"use client";

import { useState, useEffect } from 'react';
import UnifiedSettings, { UnifiedSettingsConfig, transformToUnifiedConfig } from './UnifiedSettings';
import { useTenantComplete } from "@/hooks/dashboard/useTenantComplete";
import { policyTemplateService } from '@/services/PolicyTemplateService';


export default function TenantSettings({ tenantId }: { tenantId: string }) {
  // Legacy settings groups - will be transformed to unified format
   // Consolidated data fetching - replaces 3 separate API calls with 1
  const { tenant: tenantData, tier, usage, loading: completeLoading, error: completeError } = useTenantComplete(tenantId);

  const [complianceBadge, setComplianceBadge] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!tenantId) return;
    policyTemplateService.getCompleteness(tenantId).then(result => {
      if (!result) return;
      if (result.overallScore >= 80) setComplianceBadge('Compliant');
      else if (result.overallScore >= 50) setComplianceBadge('Review');
      else setComplianceBadge('Action needed');
    }).catch(() => {});
  }, [tenantId]);

  const legacySettingsGroups = [
    {
      title: 'Stores',
      description: 'Purchase features, placements, promotions, and manage your plan',
      cards: [
        {
          title: 'App Store',
          description: 'Browse all purchasable plans, features, placements, and promotions in one place',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/store`,
          color: 'bg-gradient-to-r from-blue-500 to-purple-600',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Feature Store',
          description: 'Purchase à la carte capability features to enhance your plan',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/feature-store`,
          color: 'bg-violet-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Featured Store',
          description: 'Purchase featured placement plans to spotlight your products',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/featured-store`,
          color: 'bg-purple-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'featuredOptions',
        },
        {
          title: 'Wholesale & Suppliers',
          description: 'Find wholesale suppliers, track affiliate earnings, and manage bulk orders',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/wholesale`,
          color: 'bg-indigo-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Directory Promotion',
          description: 'Boost your store visibility on the directory map and search results',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/promotion`,
          color: 'bg-amber-600',
          badge: 'Directory',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'directoryPromotion',
        },
        {
          title: 'My Subscription',
          description: 'Manage your plan tier, upgrade, and view included features',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/subscription`,
          color: 'bg-blue-500',
          badge: 'Manage',
          accessOptions: { roles: ['admin', 'support'] },
        },
      ],
    },
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
          href: `/t/${tenantId}/settings/appearance`,
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
          href: `/t/${tenantId}/settings/language`,
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
          href: `/t/${tenantId}/settings/offerings`,
          color: 'bg-emerald-500',
          badge: 'Explore',
        },
        {
          title: 'My Subscription',
          description: 'Manage your plan and view features',
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
        {
          title: 'Billing Overview',
          description: 'View billing summary, current charges, and payment history',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/billing`,
          color: 'bg-emerald-600',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Payment Methods',
          description: 'Manage saved credit cards and payment methods',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/billing/payment-methods`,
          color: 'bg-emerald-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Invoices',
          description: 'Download and review past billing invoices',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/billing/invoices`,
          color: 'bg-teal-500',
        },
        {
          title: 'Billing Statements',
          description: 'View detailed monthly billing statements',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/billing/statements`,
          color: 'bg-teal-600',
        },
        {
          title: 'Billing Analytics',
          description: 'Analyze spending trends and cost breakdowns',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/billing/analytics`,
          color: 'bg-cyan-600',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Billing Notifications',
          description: 'Configure billing alert preferences and email notifications',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/billing/notifications`,
          color: 'bg-amber-500',
        },
        {
          title: 'Billing Preferences',
          description: 'Manage billing cycle, currency, and auto-renewal settings',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/billing/preferences`,
          color: 'bg-slate-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Tier Features',
          description: 'View available features and limits for your current tier',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A5.001 5.001 0 0119.954 7H15a2 2 0 00-2 2v4.445A5.001 5.001 0 015.046 11H9a2 2 0 002-2V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2m14 0v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/tier-features`,
          color: 'bg-indigo-500',
        },
        {
          title: 'Feature Store',
          description: 'Purchase à la carte capability features to enhance your plan',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/feature-store`,
          color: 'bg-violet-500',
          badge: 'NEW',
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
          title: 'Manage Locations',
          description: 'Add or remove stores from your organization',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/organization/locations`,
          color: 'bg-orange-600',
          badge: 'Chain',
          accessOptions: { orgMember: true },
          fetchOrganization: true,
        },
        {
          title: 'Organization Team',
          description: 'Manage org-wide users and their roles across all locations',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/organization/users`,
          color: 'bg-amber-500',
          badge: 'Chain',
          accessOptions: { roles: ['admin', 'support'] },
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
          title: 'Setup Store',
          description: 'Manage store identity and details',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          href: `/t/${tenantId}/onboarding`,
          color: 'bg-blue-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
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
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Review Management',
          description: 'Moderate and manage customer reviews for your store',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.009 9.009 0 01-2.347-.615l-2.448.848c-.796.276-1.684.276-2.48 0l-2.448-.848A9.009 9.009 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
          href: `/t/${tenantId}/reviews`,
          color: 'bg-purple-500',
          badge: 'Moderate',
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
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Product Options',
          description: 'Enable product types and control creation features like variants and media',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/product-options`,
          color: 'bg-cyan-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'productOptions',
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
        {
          title: 'Storefront Policies',
          description: 'Configure per-tenant storefront policies like returns, shipping, and privacy',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/policies`,
          color: 'bg-indigo-600',
          badge: complianceBadge ?? 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'storefrontOptions',
        },
        {
          title: 'Product Conditions',
          description: 'Manage product condition types (new, used, refurbished, etc.)',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/product-conditions`,
          color: 'bg-cyan-600',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Store Policies',
          description: 'View and manage store-specific operational policies',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/policies`,
          color: 'bg-indigo-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Store SEO',
          description: 'Configure SEO metadata for your storefront pages',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/seo`,
          color: 'bg-green-600',
        },
        {
          title: 'Shipping Rates',
          description: 'Configure real-time shipping rates via EasyPost',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/shipping-rates`,
          color: 'bg-blue-600',
          badge: 'NEW',
        },
        {
          title: 'Returns Portal',
          description: 'Configure customer return request settings and policies',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          ),
          href: `/t/${tenantId}/returns`,
          color: 'bg-orange-500',
          badge: 'NEW',
        },
        {
          title: 'Abandoned Cart Recovery',
          description: 'Configure automated recovery emails for abandoned carts',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          ),
          href: `/t/${tenantId}/abandoned-carts`,
          color: 'bg-amber-600',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'socialCommerceOptions',
        },
        {
          title: 'Social Proof',
          description: 'Moderate and display user-generated content and social proof',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/social-proof`,
          color: 'bg-pink-600',
          badge: 'NEW',
          capabilityKey: 'socialCommerceOptions',
        },
        {
          title: 'Social Commerce',
          description: 'Configure Meta, TikTok, social proof, share buttons, and abandoned cart',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/social-commerce`,
          color: 'bg-pink-500',
          capabilityKey: 'socialCommerceOptions',
        },
      ],
    },
    {
      title: 'Featured Products',
      description: 'Manage product visibility and display options',
      cards: [
        {
          title: 'Featured Options',
          description: 'Configure which featured types are active on your storefront and directory',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/featured-options`,
          color: 'bg-amber-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'featuredOptions',
        },
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
          capabilityKey: 'featuredOptions',
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
          capabilityKey: 'featuredOptions',
        },
        {
          title: 'Featured Store',
          description: 'Purchase featured placement plans to spotlight your products',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/featured-store`,
          color: 'bg-purple-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'featuredOptions',
        },
        {
          title: 'Wholesale & Suppliers',
          description: 'Find wholesale suppliers, track affiliate earnings, and manage bulk orders',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/wholesale`,
          color: 'bg-indigo-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Directory Promotion',
          description: 'Boost your store visibility on the directory map and search results',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/promotion`,
          color: 'bg-amber-600',
          badge: 'Directory',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'directoryPromotion',
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
        {
          title: 'Roles & Permissions',
          description: 'View and manage role definitions and permission levels',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/users`,
          color: 'bg-cyan-600',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Pending Invitations',
          description: 'View and manage pending team member invitations',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7a2 2 0 002 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/users`,
          color: 'bg-cyan-400',
        },
      ],
    },
    {
      title: 'Bot & Chatbot',
      description: 'Configure AI chatbot and knowledge base',
      cards: [
        {
          title: 'Chatbot Settings',
          description: 'Configure your AI chatbot behavior and appearance',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" />
            </svg>
          ),
          href: `/t/${tenantId}/bot`,
          color: 'bg-violet-500',
          badge: 'AI',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'chatbotOptions',
        },
        {
          title: 'Bot Knowledge Base',
          description: 'Manage embeddings, product catalogs, and knowledge sources',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          ),
          href: `/t/${tenantId}/bot/knowledge`,
          color: 'bg-violet-600',
          badge: 'AI',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'chatbotOptions',
        },
        {
          title: 'Bot Personality',
          description: 'Customize chatbot personality, tone, and greeting messages',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          ),
          href: `/t/${tenantId}/bot/config`,
          color: 'bg-violet-400',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'chatbotOptions',
        },
      ],
    },
    {
      title: 'Notifications',
      description: 'Manage notification preferences',
      cards: [
        {
          title: 'Notification Preferences',
          description: 'Configure email, SMS, and in-app notification preferences',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/notifications`,
          color: 'bg-amber-500',
        },
        {
          title: 'Notification History',
          description: 'View past notifications and alert delivery logs',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/notification-history`,
          color: 'bg-amber-600',
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
        {
          title: 'GBP Connection',
          description: 'Connect and manage your Google Business Profile account',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/google`,
          color: 'bg-red-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'GBP Sync Status',
          description: 'Monitor Google Business Profile sync status and history',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/google/sync-status`,
          color: 'bg-red-600',
        },
        {
          title: 'GBP Photos',
          description: 'Manage photos synced to your Google Business Profile',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/gbp-photos`,
          color: 'bg-rose-500',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'GBP Posts',
          description: 'Create and manage Google Business Profile posts',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/gbp-posts`,
          color: 'bg-rose-600',
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
          capabilityKey: 'commerce',
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
          capabilityKey: 'paymentGateway',
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
          capabilityKey: 'fulfillment',
        },
        {
          title: 'Commerce Settings',
          description: 'Configure deposit payments, checkout flow, and order notifications',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/commerce`,
          color: 'bg-violet-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'commerce',
        },
      ],
    },
    {
      title: 'POS Integrations',
      description: 'Connect your point-of-sale systems',
      cards: [
        {
          title: 'Integrations Overview',
          description: 'View all connected integrations and manage settings',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations`,
          color: 'bg-green-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'integrationOptions',
        },
        {
          title: 'Clover POS',
          description: 'Connect Clover POS for inventory and order sync',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/clover`,
          color: 'bg-green-600',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'integrationOptions',
        },
        {
          title: 'Square POS',
          description: 'Connect Square POS for payment and inventory sync',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/square`,
          color: 'bg-green-700',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'integrationOptions',
        },
        {
          title: 'Integration Options',
          description: 'Configure which integrations are enabled for your store',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integration-options`,
          color: 'bg-slate-600',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'integrationOptions',
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
        {
          title: 'Google Sync Status',
          description: 'Monitor real-time sync status between your store and Google',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/google/sync-status`,
          color: 'bg-blue-600',
        },
        {
          title: 'Google Advanced Settings',
          description: 'Configure advanced Google Merchant Center sync options',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/google/advanced`,
          color: 'bg-red-600',
          accessOptions: { roles: ['admin', 'support'] },
        },
        {
          title: 'Google Integration Guide',
          description: 'Step-by-step guide for setting up Google integrations',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/google/guide`,
          color: 'bg-blue-400',
        },
      ],
    },
    {
      title: 'Social Commerce',
      description: 'Connect social platforms and manage social selling',
      cards: [
        {
          title: 'Social Commerce Settings',
          description: 'Configure social selling features and storefront policies',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/social-commerce`,
          color: 'bg-pink-500',
          badge: 'NEW',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'socialCommerceOptions',
        },
        {
          title: 'Meta Commerce',
          description: 'Sync products to Instagram Shopping and Facebook Shop',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/meta`,
          color: 'bg-blue-500',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'socialCommerceOptions',
        },
        {
          title: 'TikTok Shop',
          description: 'Sync products to TikTok Shop and manage orders',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/tiktok`,
          color: 'bg-slate-800',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'socialCommerceOptions',
        },
        {
          title: 'Social Pixels',
          description: 'Configure Meta and TikTok conversion tracking pixels',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/integrations/pixels`,
          color: 'bg-amber-500',
          accessOptions: { roles: ['admin', 'support'] },
          capabilityKey: 'socialCommerceOptions',
        },
      ],
    },
    {
      title: 'Store Management',
      description: 'Quick access to key store management pages',
      cards: [
        {
          title: 'Dashboard',
          description: 'View store overview, metrics, and recent activity',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          ),
          href: `/t/${tenantId}`,
          color: 'bg-blue-500',
        },
        {
          title: 'Inventory',
          description: 'Manage your product inventory and stock levels',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
          href: `/t/${tenantId}/items`,
          color: 'bg-indigo-500',
        },
        {
          title: 'Products',
          description: 'View and manage your product catalog',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
          href: `/t/${tenantId}/catalog`,
          color: 'bg-indigo-600',
          capabilityKey: 'productOptions',
        },
        {
          title: 'Storefront',
          description: 'Preview your public storefront as customers see it',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          href: `/t/${tenantId}/storefront`,
          color: 'bg-green-500',
          capabilityKey: 'storefront',
        },
        {
          title: 'Orders',
          description: 'View and manage customer orders',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          ),
          href: `/t/${tenantId}/orders`,
          color: 'bg-purple-500',
        },
        {
          title: 'Reviews',
          description: 'View and respond to customer reviews',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.009 9.009 0 01-2.347-.615l-2.448.848c-.796.276-1.684.276-2.48 0l-2.448-.848A9.009 9.009 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
          href: `/t/${tenantId}/reviews`,
          color: 'bg-purple-600',
        },
        {
          title: 'Categories',
          description: 'Manage product categories for your inventory',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          href: `/t/${tenantId}/categories`,
          color: 'bg-indigo-400',
        },
        {
          title: 'Scanner',
          description: 'Scan barcodes and manage SKU scanning tasks',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h4M4 8h4M4 12h4M4 16h4M16 4h4M16 8h4M16 12h4M16 16h4M4 20h16" />
            </svg>
          ),
          href: `/t/${tenantId}/scan`,
          color: 'bg-cyan-600',
          capabilityKey: 'barcodeScan',
        },
        {
          title: 'Customer Lists',
          description: 'View and manage customer lists and segments',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/support/contacts`,
          color: 'bg-teal-500',
          capabilityKey: 'crmOptions',
        },
        {
          title: 'Organization Dashboard',
          description: 'View chain-wide analytics and organization overview',
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
          href: `/t/${tenantId}/settings/contact`,
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
