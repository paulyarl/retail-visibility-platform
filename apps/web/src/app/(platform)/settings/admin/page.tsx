"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, AnimatedCard, Spinner } from '@/components/ui';
import { Button } from '@mantine/core';
import { motion } from 'framer-motion';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';
import { useAdminDashboardData } from '@/hooks/useAdminDashboardData';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import { clearCachesWithConfirmation } from '@/utils/clearAllCaches';
import { TenantContextSwitcher } from '@/components/admin/TenantContextSwitcher';

type AdminSection = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  stats: string;
  badge?: string;
};

type AdminGroup = {
  title: string;
  description: string;
  sections: AdminSection[];
};



export default function AdminDashboardPage() {
  // Use centralized access control - platform admins only
  const {
    hasAccess,
    loading: accessLoading,
    isPlatformAdmin,
  } = useAccessControl(
    null, // No tenant context needed
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  // Use admin dashboard data hook - only fetches tenants and sync stats
  const { tenants, loading: adminDataLoading, error: adminDataError } = useAdminDashboardData();

  // Track admin panel access
  useEffect(() => {
    if (hasAccess && isPlatformAdmin) {
      trackBehaviorClient({
        entityType: 'admin',
        entityId: 'platform_admin_dashboard',
        entityName: 'Platform Admin Dashboard',
        pageType: 'admin_panel',
        context: {
          isAdmin: true,
          isPlatformAdmin
        }
      });
    }
  }, [hasAccess, isPlatformAdmin]);

  const adminGroups: AdminGroup[] = [
    {
      title: 'Platform Configuration',
      description: 'Customize platform appearance and communications',
      sections: [
        {
          title: 'Platform Ticker',
          description: 'Manage platform-wide notifications and announcements with scheduling',
          href: '/settings/admin/ticker',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          color: 'bg-teal-500',
          stats: 'Platform communications',
          badge: 'NEW',
        },
        {
          title: 'Branding',
          description: 'Customize platform logo, name, and appearance',
          href: '/settings/admin/branding',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          color: 'bg-blue-500',
          stats: 'Customize appearance',
        },
        {
          title: 'Subdomain Management',
          description: 'Monitor subdomain usage, adoption rates, and manage rate limiting',
          href: '/settings/admin/subdomain',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
            </svg>
          ),
          color: 'bg-indigo-500',
          stats: 'Custom domains',
          badge: 'NEW',
        },
        {
          title: 'Payment Settings',
          description: 'Configure platform-wide minimum payment amounts for all payment gateways',
          href: '/settings/admin/payment',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'bg-green-500',
          stats: 'Payment configuration',
          badge: 'NEW',
        },
        {
          title: 'Navigation Links',
          description: 'Manage sidebar navigation links for all, tenant, and admin targets',
          href: '/settings/admin/navigation',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          ),
          color: 'bg-slate-500',
          stats: 'Database-driven nav',
          badge: 'NEW',
        },
        {
          title: 'Platform Analytics',
          description: 'View platform-wide analytics, traffic, and engagement metrics',
          href: '/settings/admin/analytics',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          color: 'bg-cyan-500',
          stats: 'Traffic & engagement',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Bot Management',
      description: 'Manage AI chatbot configuration, guardrails, and knowledge across all tenants',
      sections: [
        {
          title: 'Bot Dashboard',
          description: 'Overview of bot activity, conversations, and tenant usage',
          href: '/settings/admin/bot',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          color: 'bg-indigo-500',
          stats: 'Bot overview',
          badge: 'NEW',
        },
        {
          title: 'Bot Guardrails',
          description: 'Manage safety guardrails and content filters for the chatbot',
          href: '/settings/admin/bot/guardrails',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          color: 'bg-red-500',
          stats: 'Safety rules',
          badge: 'NEW',
        },
        {
          title: 'Bot Intents',
          description: 'Configure bot intent recognition and routing rules',
          href: '/settings/admin/bot/intents',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          color: 'bg-amber-500',
          stats: 'Intent routing',
          badge: 'NEW',
        },
        {
          title: 'Bot Knowledge',
          description: 'Manage knowledge embeddings, RAG sources, and refresh status',
          href: '/settings/admin/bot/knowledge',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          ),
          color: 'bg-teal-500',
          stats: 'RAG embeddings',
          badge: 'NEW',
        },
        {
          title: 'Bot Skills',
          description: 'Toggle bot skills and capabilities per tenant',
          href: '/settings/admin/bot/skills',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          color: 'bg-purple-500',
          stats: 'Per-tenant toggles',
          badge: 'NEW',
        },
        {
          title: 'Bot Tenants',
          description: 'View and manage bot configuration for individual tenants',
          href: '/settings/admin/bot/tenants',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          color: 'bg-blue-500',
          stats: 'Tenant configs',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'CRM',
      description: 'Manage support tickets, tasks, and tenant CRM activity',
      sections: [
        {
          title: 'CRM Dashboard',
          description: 'Overview of tickets, tasks, and CRM analytics',
          href: '/settings/admin/crm',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          color: 'bg-indigo-500',
          stats: 'CRM overview',
          badge: 'NEW',
        },
        {
          title: 'Global Tickets',
          description: 'View and manage all support tickets across the platform',
          href: '/settings/admin/crm/tickets',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.009 9.009 0 01-2.347-.615l-2.448.848c-.796.276-1.684.276-2.48 0l-2.448-.848A9.009 9.009 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
          color: 'bg-orange-500',
          stats: 'Support tickets',
          badge: 'NEW',
        },
        {
          title: 'Tasks Kanban',
          description: 'Manage internal tasks with Kanban board view',
          href: '/settings/admin/crm/tasks',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          ),
          color: 'bg-teal-500',
          stats: 'Kanban board',
          badge: 'NEW',
        },
        {
          title: 'Requests Hub',
          description: 'Review and process tenant requests and inquiries',
          href: '/settings/admin/crm/requests',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          color: 'bg-amber-500',
          stats: 'Request processing',
          badge: 'NEW',
        },
        {
          title: 'CRM Tenant List',
          description: 'View tenant CRM activity, contacts, and engagement history',
          href: '/settings/admin/crm/tenants',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          color: 'bg-blue-600',
          stats: 'Tenant CRM',
          badge: 'NEW',
        },
        {
          title: 'Platform Services',
          description: 'Fulfillment overview for platform-offered services (logo design, store setup, SEO, etc.)',
          href: '/settings/admin/crm/services',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.737-.483L21 7.5M14.5 3.5l1.5 1.5M5 21l2.5-2.5M14.5 3.5L5 13l-2.5 8.5L11 19l9.5-9.5-6-6z" />
            </svg>
          ),
          color: 'bg-amber-600',
          stats: 'Service fulfillment',
          badge: 'NEW',
        },
        {
          title: 'Directory Support Tools',
          description: 'Look up tenants, check directory listing quality, and manage support notes',
          href: '/support/directory',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          ),
          color: 'bg-cyan-600',
          stats: 'Tenant lookup & quality',
        },
      ],
    },
    {
      title: 'Feature Flags & Overrides',
      description: 'Control feature rollout and custom tenant access',
      sections: [
       
        {
          title: 'Feature Overrides',
          description: 'Grant or revoke tier features for specific tenants',
          href: '/settings/admin/feature-overrides',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
          color: 'bg-orange-500',
          stats: 'Tenant customization',
        },
        {
          title: 'Capability Management',
          description: 'View and manage capability constraints, resolvers, and feature keys',
          href: '/settings/admin/capabilities',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          color: 'bg-cyan-500',
          stats: 'Constraints & resolvers',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Tier Management',
      description: 'Control feature rollout and custom tenant access',
      sections: [
        {
          title: 'Tier & Feature Matrix',
          description: 'Live view of all tiers and their feature access',
          href: '/settings/admin/tier-system',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          ),
          color: 'bg-cyan-500',
          stats: 'Visual tier reference',
          badge: 'NEW',
        },
        
        {
          title: 'Tier Management',
          description: 'Manage tenant subscription tiers and billing',
          href: '/settings/admin/tiers',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'bg-amber-500',
          stats: `${tenants?.total || 0} tenants`,
        },
        {
          title: 'Tier System',
          description: 'Manage tier definitions and features (CRUD)',
          href: '/settings/admin/tier-system',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          color: 'bg-indigo-500',
          stats: 'Database-driven',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Security & Compliance',
      description: 'Monitor platform security and manage threats',
      sections: [
        {
          title: 'Security Dashboard',
          description: 'Platform-wide security monitoring and threat detection',
          href: '/settings/admin/security',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          color: 'bg-red-500',
          stats: 'Threat monitoring',
          badge: 'NEW',
        },
        {
          title: 'Platform Settings',
          description: 'Rate limiting controls, security configurations, and platform-wide settings',
          href: '/settings/admin/platform',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          color: 'bg-purple-500',
          stats: 'Rate limiting & security',
          badge: 'NEW',
        },
        {
          title: 'Sentry Monitoring',
          description: 'Error tracking, performance monitoring, and release health',
          href: '/settings/admin/sentry',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          color: 'bg-orange-500',
          stats: 'Error tracking',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'User & Access Management',
      description: 'Manage platform users and their permissions',
      sections: [
        {
          title: 'User Management',
          description: 'Manage users, permissions, and access',
          href: '/settings/admin/users',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          color: 'bg-purple-500',
          stats: `2 users`,
        },
      ],
    },
    {
      title: 'Tenant & Organization Management',
      description: 'Manage tenants and chain organizations',
      sections: [
        {
          title: 'Tenant Management',
          description: 'View and manage all tenant locations',
          href: '/settings/admin/tenants',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          color: 'bg-green-500',
          stats: `${tenants?.total || 0} tenants`,
        },
        {
          title: 'Organizations',
          description: 'Manage chain organizations and multi-location accounts',
          href: '/settings/admin/organizations',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          color: 'bg-orange-500',
          stats: 'Chain management',
          badge: 'NEW',
        },
        {
          title: 'Demo Tenants',
          description: 'Manage demo and test tenant environments',
          href: '/settings/admin/demo-tenants',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
          color: 'bg-slate-500',
          stats: 'Test environments',
        },
      ],
    },
    {
      title: 'Requests & Approvals',
      description: 'Review and process tenant requests',
      sections: [
        {
          title: 'Account Deletion Requests',
          description: 'Review and manage user account deletion requests with 30-day grace period',
          href: '/settings/admin/deletion-requests',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          ),
          color: 'bg-red-500',
          stats: 'GDPR compliance',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Content & Data Management',
      description: 'Manage product categories and data organization',
      sections: [
        {
          title: 'Product Categories',
          description: 'Manage product categories and hierarchies',
          href: '/settings/admin/categories',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          color: 'bg-purple-500',
          stats: 'Product organization',
          badge: 'NEW',
        },
        {
          title: 'Platform Categories',
          description: 'Manage directory categories for all stores',
          href: '/settings/admin/platform-categories',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          ),
          color: 'bg-indigo-500',
          stats: '57 categories',
          badge: 'P4',
        },
        {
          title: 'Directory Management',
          description: 'Manage directory listings, featured stores, and appearance',
          href: '/settings/admin/directory',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          color: 'bg-rose-500',
          stats: 'Directory overview',
          badge: 'NEW',
        },
        {
          title: 'Directory Listings',
          description: 'Review and manage all store directory listings',
          href: '/settings/admin/directory/listings',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          ),
          color: 'bg-rose-600',
          stats: 'Store listings',
          badge: 'NEW',
        },
        {
          title: 'Directory Featured',
          description: 'Manage featured stores and promoted placements in the directory',
          href: '/settings/admin/directory/featured',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ),
          color: 'bg-amber-600',
          stats: 'Featured stores',
          badge: 'NEW',
        },
        {
          title: 'Directory Appearance',
          description: 'Configure directory page layout, colors, and display options',
          href: '/settings/admin/directory/appearance',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          ),
          color: 'bg-pink-500',
          stats: 'Layout & styling',
        },
        {
          title: 'Catalog Management',
          description: 'Manage the platform product catalog and catalog rules',
          href: '/settings/admin/catalog',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
          color: 'bg-cyan-600',
          stats: 'Platform catalog',
          badge: 'NEW',
        },
        {
          title: 'Slug Registry',
          description: 'Manage URL slugs and redirects across the platform',
          href: '/settings/admin/slug-registry',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          ),
          color: 'bg-slate-600',
          stats: 'URL management',
        },
      ],
    },
    {
      title: 'Featured Products',
      description: 'Monitor featured products across all tenants',
      sections: [
        {
          title: 'Featured Products Overview',
          description: 'View all featured products, statistics, and tier usage',
          href: '/settings/admin/featured-products',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ),
          color: 'bg-amber-500',
          stats: 'Platform-wide analytics',
          badge: 'NEW',
        },
        {
          title: 'Featured Placement Revenue',
          description: 'View revenue from featured placement purchases across all tenants',
          href: '/settings/admin/featured-placement-revenue',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'bg-purple-600',
          stats: 'Placement revenue',
          badge: 'NEW',
        },
        {
          title: 'Promotion Catalog',
          description: 'Manage directory promotion plans — tiers, durations, and pricing',
          href: '/settings/admin/promotion-catalog',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          ),
          color: 'bg-amber-600',
          stats: 'Plan management',
          badge: 'NEW',
        },
        {
          title: 'Promotion Revenue',
          description: 'Platform revenue, renewal metrics, and tier distribution for directory promotions',
          href: '/settings/admin/promotion-revenue',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          color: 'bg-indigo-600',
          stats: 'Revenue analytics',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'SKU Scanning Analytics',
      description: 'Monitor scanning activity and enrichment performance',
      sections: [
        {
          title: 'Scan Metrics',
          description: 'View scanning activity, success rates, and API performance',
          href: '/settings/admin/scan-metrics',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          color: 'bg-purple-500',
          stats: 'Real-time metrics',
          badge: 'M4',
        },
        {
          title: 'Data Enrichment',
          description: 'Monitor product data enrichment pipeline and quality scores',
          href: '/settings/admin/enrichment',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          color: 'bg-indigo-600',
          stats: 'Enrichment pipeline',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'BSAAS',
      description: 'Manage Buy-Sell-as-a-Service catalog, promotions, and analytics',
      sections: [
        {
          title: 'BSAAS Catalog',
          description: 'Manage the BSAAS product catalog and service offerings',
          href: '/settings/admin/bsaas-catalog',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
          color: 'bg-violet-500',
          stats: 'Service catalog',
          badge: 'NEW',
        },
        {
          title: 'BSAAS Promotions',
          description: 'Manage promotional campaigns and discounts for BSAAS services',
          href: '/settings/admin/bsaas-promotions',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          color: 'bg-pink-600',
          stats: 'Campaigns & discounts',
          badge: 'NEW',
        },
        {
          title: 'BSAAS Analytics',
          description: 'View BSAAS performance, adoption, and revenue analytics',
          href: '/settings/admin/bsaas-analytics',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          color: 'bg-violet-600',
          stats: 'Performance metrics',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Inventory & Suppliers',
      description: 'Monitor platform inventory and manage supplier integrations',
      sections: [
        {
          title: 'Inventory Overview',
          description: 'View platform-wide inventory stats and product counts',
          href: '/settings/admin/inventory',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
          color: 'bg-blue-600',
          stats: 'Platform inventory',
          badge: 'NEW',
        },
        {
          title: 'Inventory Dashboard',
          description: 'Detailed inventory analytics, stock levels, and turnover rates',
          href: '/settings/admin/inventory-dashboard',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          color: 'bg-blue-700',
          stats: 'Stock analytics',
          badge: 'NEW',
        },
        {
          title: 'Supplier Management',
          description: 'Manage supplier accounts and integrations',
          href: '/settings/admin/suppliers',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          ),
          color: 'bg-teal-600',
          stats: 'Supplier accounts',
          badge: 'NEW',
        },
        {
          title: 'Supplier Health',
          description: 'Monitor supplier integration health and sync status',
          href: '/settings/admin/suppliers/health',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          color: 'bg-teal-700',
          stats: 'Integration health',
        },
        {
          title: 'Wholesale Matching',
          description: 'Faire integration status, wholesale suppliers, and affiliate analytics',
          href: '/settings/admin/wholesale',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          ),
          color: 'bg-indigo-600',
          stats: 'Faire & affiliate',
          badge: 'NEW',
        },
        {
          title: 'Brand Partner Claims',
          description: 'Review, approve, and reject brand partner claims across all tenants',
          href: '/settings/admin/brand-partners',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          color: 'bg-indigo-700',
          stats: 'Claim approvals',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Monitoring & Logs',
      description: 'Platform monitoring, notification logs, and review moderation',
      sections: [
        {
          title: 'Notification Logs',
          description: 'View sent notification logs and delivery status across the platform',
          href: '/settings/admin/notification-logs',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          ),
          color: 'bg-amber-600',
          stats: 'Delivery tracking',
          badge: 'NEW',
        },
        {
          title: 'Review Moderation',
          description: 'Moderate customer reviews across all tenant stores',
          href: '/settings/admin/reviews',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.009 9.009 0 01-2.347-.615l-2.448.848c-.796.276-1.684.276-2.48 0l-2.448-.848A9.009 9.009 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
          color: 'bg-purple-600',
          stats: 'Cross-tenant moderation',
          badge: 'NEW',
        },
        {
          title: 'Error Logs',
          description: 'Browse, filter, and resolve persisted application errors across the platform',
          href: '/settings/admin/error-logs',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          color: 'bg-red-600',
          stats: 'Error tracking & resolution',
          badge: 'NEW',
        },
        {
          title: 'Tenant Limits',
          description: 'Manage per-tenant limits for SKUs, locations, and features',
          href: '/settings/admin/limits',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
          color: 'bg-slate-600',
          stats: 'Per-tenant limits',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Quick Start Tools',
      description: 'Testing and development utilities for platform admins',
      sections: [
        
        {
          title: 'Product Quick Start',
          description: 'Generate 50 sample products instantly for testing',
          href: '/settings/admin/quick-start/products',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          color: 'bg-blue-500',
          stats: '360x faster than manual',
          badge: 'NEW',
        },
        {
          title: 'Category Quick Start',
          description: 'Generate product categories instantly for testing',
          href: '/settings/admin/quick-start/categories',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          color: 'bg-purple-500',
          stats: '5-30 categories',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Capacity Management',
      description: 'Monitor SKU usage, location limits, and subscription capacity across all tenants',
      sections: [
        {
          title: 'Platform Capacity Overview',
          description: 'View aggregate capacity usage across all tenants and tiers',
          href: '/settings/admin/capacity/overview',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          color: 'bg-emerald-500',
          stats: 'Real-time usage metrics',
          badge: 'NEW',
        },
        {
          title: 'Tenant Capacity Alerts',
          description: 'Monitor tenants approaching or exceeding their limits',
          href: '/settings/admin/capacity/alerts',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          color: 'bg-amber-500',
          stats: 'Proactive monitoring',
          badge: 'NEW',
        },
        {
          title: 'Location Limits Management',
          description: 'Manage tenant location limits and platform-wide restrictions',
          href: '/settings/admin/capacity/location-limits',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          color: 'bg-cyan-500',
          stats: 'Multi-location control',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Billing & Subscriptions',
      description: 'Manage subscription tiers, billing, and platform offerings',
      sections: [
        {
          title: 'Platform Offerings',
          description: 'View and manage all subscription tiers and services',
          href: '/settings/offerings',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
          color: 'bg-emerald-500',
          stats: 'View all offerings',
          badge: 'INFO',
        },
        {
          title: 'Billing Dashboard',
          description: 'View SKU usage, limits, and billing status',
          href: '/settings/admin/billing',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          ),
          color: 'bg-green-500',
          stats: 'Usage & limits',
          badge: 'NEW',
        },
        {
          title: 'Manual Billing',
          description: 'Manage invoices, payment methods, service charges, and subscription control',
          href: '/settings/admin/billing/manual-billing',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          color: 'bg-emerald-600',
          stats: 'Invoices & charges',
          badge: 'NEW',
        },
        {
          title: 'Platform Revenue',
          description: 'View platform revenue, subscription income, and transaction analytics',
          href: '/settings/admin/platform-revenue',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'bg-emerald-700',
          stats: 'Revenue analytics',
          badge: 'NEW',
        },
      ],
    },
  ];

  // Access control checks
  if (accessLoading || adminDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        pageTitle="Admin Dashboard"
        pageDescription="Platform administration and configuration"
        title="Platform Administrator Access Required"
        message="The Admin Dashboard is only accessible to platform administrators. This area contains sensitive platform-wide configuration and management tools."
        userRole={isPlatformAdmin ? 'Platform Admin' : 'User'}
        backLink={{ href: '/tenants', label: 'Back to Tenants' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Admin Dashboard"
        description="Platform administration and configuration"
        icon={Icons.Settings}
      />
      
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar with Tenant Context */}
          <div className="lg:col-span-1 space-y-6">
            <TenantContextSwitcher 
              onTenantChange={(tenantId) => {
                // Clear any cached data when switching tenants
                clearCachesWithConfirmation();
                // Optionally redirect to tenant's subscription page
                window.location.href = `/t/${tenantId}/settings/subscription`;
              }}
            />
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* System Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedCard delay={0} hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Total Tenants</p>
                  {adminDataLoading ? (
                    <Spinner size="sm" className="mt-2" />
                  ) : (
                    <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{tenants?.total || 0}</p>
                  )}
                </div>
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.1} hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Total Users</p>
                  {adminDataLoading ? (
                    <Spinner size="sm" className="mt-2" />
                  ) : (
                    <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">2</p> // TODO: Add user count to cached admin data
                  )}
                </div>
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.2} hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Platform Capacity</p>
                  <div className="mt-2">
                    <SubscriptionUsageBadge variant="inline" />
                  </div>
                </div>
                <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        </div>

        {/* Admin Groups */}
        <div className="space-y-10">
          {adminGroups.map((group, groupIndex) => (
            <div key={group.title}>
              {/* Group Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {group.title}
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {group.description}
                </p>
              </div>

              {/* Group Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {group.sections.map((section, sectionIndex) => {
                  const cardIndex = groupIndex * 10 + sectionIndex;
                  return (
                    <motion.div
                      key={section.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: cardIndex * 0.05, duration: 0.3 }}
                    >
                      <Link href={section.href}>
                        <div className="group p-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200 cursor-pointer">
                          <div className="flex items-start gap-4">
                            <div className={`${section.color} p-3 rounded-lg text-white shadow-sm flex-shrink-0`}>
                              {section.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                  {section.title}
                                </h3>
                                {section.badge && (
                                  <Badge variant="info" className="text-xs">
                                    {section.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                {section.description}
                              </p>
                              <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
                                {section.stats}
                              </p>
                            </div>
                            <svg className="w-5 h-5 text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Common administrative pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Link href="/settings/admin/users" className="p-4 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors block">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">Invite User</p>
                    <p className="text-xs text-neutral-500">Add new platform user</p>
                  </div>
                </div>
              </Link>

              <Link href="/settings/admin/tenants" className="p-4 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors block">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">View All Tenants</p>
                    <p className="text-xs text-neutral-500">System-wide tenant list</p>
                  </div>
                </div>
              </Link>

              <Link href="/settings/admin/feature-overrides" className="p-4 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors block">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">Manage Features</p>
                    <p className="text-xs text-neutral-500">Toggle feature flags</p>
                  </div>
                </div>
              </Link>

              <Link href="/settings/admin/capacity/overview" className="p-4 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors block">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">Capacity Overview</p>
                    <p className="text-xs text-neutral-500">Monitor platform usage</p>
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Cache Management */}
        <Card>
          <CardHeader>
            <CardTitle>Cache Management</CardTitle>
            <CardDescription>Clear application caches to resolve data issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-amber-600 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-amber-900 dark:text-amber-100">Clear All Caches</h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      This will clear all cached data including directory listings, user preferences, product data, and session data. Use this when experiencing data inconsistencies or after cache system updates.
                    </p>
                    <div className="mt-3">
                      <Button 
                        variant="outline" 
                        color="amber"
                        onClick={clearCachesWithConfirmation}
                        className="text-sm"
                      >
                        Clear All Caches
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                <p><strong>Cache types cleared:</strong></p>
                <ul className="mt-1 space-y-1">
                  <li>• Directory listings and search results</li>
                  <li>• User preferences and session data</li>
                  <li>• Product data and inventory</li>
                  <li>• API responses and computed values</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
