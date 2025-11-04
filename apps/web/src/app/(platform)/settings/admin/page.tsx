"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, AnimatedCard, Spinner } from '@/components/ui';
import { motion } from 'framer-motion';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';

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
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
  });
  const [syncStats, setSyncStats] = useState({
    totalRuns: 0,
    successRate: 0,
    outOfSyncCount: 0,
    failedRuns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Fetch real tenant count
        const tenantsRes = await api.get('/api/tenants');
        const tenants = await tenantsRes.json();
        
        setStats({
          totalTenants: Array.isArray(tenants) ? tenants.length : 0,
          totalUsers: 2, // TODO: Fetch from users API when available
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  useEffect(() => {
    const loadSyncStats = async () => {
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const res = await api.get(`${apiBaseUrl}/api/admin/sync-stats`);
        if (res.ok) {
          const data = await res.json();
          setSyncStats(data.stats || {
            totalRuns: 0,
            successRate: 0,
            outOfSyncCount: 0,
            failedRuns: 0,
          });
        }
      } catch (error) {
        console.error('Failed to load sync stats:', error);
      } finally {
        setSyncLoading(false);
      }
    };
    loadSyncStats();
  }, []);

  const adminGroups: AdminGroup[] = [
    {
      title: 'Platform Configuration',
      description: 'Customize platform appearance and communications',
      sections: [
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
          title: 'Email Management',
          description: 'Configure email addresses for different request types',
          href: '/settings/admin/emails',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
          color: 'bg-pink-500',
          stats: '8 categories',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Feature Flags',
      description: 'Control feature rollout and tenant override permissions',
      sections: [
        {
          title: 'Feature Flags (DB)',
          description: 'Database-backed flags with tenant override support',
          href: '/settings/admin/platform-flags',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          ),
          color: 'bg-indigo-500',
          stats: 'Persistent flags',
          badge: 'NEW',
        },
        {
          title: 'Feature Flags (Legacy)',
          description: 'localStorage-based flags for backward compatibility',
          href: '/settings/admin/features',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          ),
          color: 'bg-green-500',
          stats: 'Browser storage',
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
          stats: `${stats.totalUsers} users`,
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
          stats: `${stats.totalTenants} tenants`,
        },
        {
          title: 'Organizations',
          description: 'Manage chain organizations and multi-location accounts',
          href: '/admin/organizations',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          color: 'bg-orange-500',
          stats: 'Chain management',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Requests & Approvals',
      description: 'Review and process tenant requests',
      sections: [
        {
          title: 'Upgrade Requests',
          description: 'Manage subscription upgrade requests from tenants',
          href: '/settings/admin/upgrade-requests',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          ),
          color: 'bg-indigo-500',
          stats: 'Process requests',
          badge: 'NEW',
        },
        {
          title: 'Organization Requests',
          description: 'Review and approve tenant requests to join organizations',
          href: '/settings/admin/organization-requests',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          color: 'bg-teal-500',
          stats: 'Approve requests',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Content & Data Management',
      description: 'Manage product categories and data organization',
      sections: [
        {
          title: 'Categories',
          description: 'Manage product categories and hierarchies',
          href: '/admin/categories',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          color: 'bg-purple-500',
          stats: 'Product organization',
          badge: 'NEW',
        },
      ],
    },
    {
      title: 'Google Business Profile Sync',
      description: 'Monitor and manage GBP category synchronization',
      sections: [
        {
          title: 'GBP Category Sync',
          description: 'Monitor sync status and trigger manual syncs',
          href: '/settings/admin/gbp-sync',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          color: 'bg-cyan-500',
          stats: syncLoading ? 'Loading...' : `${syncStats.successRate}% success rate`,
          badge: 'M3',
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
      ],
    },
    {
      title: 'Developer Tools',
      description: 'Testing and development utilities for platform admins',
      sections: [
        {
          title: 'Admin Control Panel',
          description: 'Create test chains, seed data, and manage development tools',
          href: '/admin/tools',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          color: 'bg-red-500',
          stats: 'Test data & chains',
          badge: 'ADMIN',
        },
        {
          title: 'Product Quick Start',
          description: 'Generate 50 sample products instantly for testing',
          href: '/admin/quick-start/products',
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
          href: '/admin/quick-start/categories',
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
          title: 'Subscription Tiers',
          description: 'Manage tenant subscription tiers and billing',
          href: '/admin/tiers',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'bg-amber-500',
          stats: `${stats.totalTenants} tenants`,
        },
        {
          title: 'Billing Dashboard',
          description: 'View SKU usage, limits, and billing status',
          href: '/admin/billing',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          ),
          color: 'bg-green-500',
          stats: 'Usage & limits',
          badge: 'NEW',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Admin Dashboard"
        description="Platform administration and configuration"
        icon={Icons.Admin}
        backLink={{
          href: '/tenants',
          label: 'Back to Tenants'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* System Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedCard delay={0} hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Total Tenants</p>
                  {loading ? (
                    <Spinner size="sm" className="mt-2" />
                  ) : (
                    <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.totalTenants}</p>
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
                  {loading ? (
                    <Spinner size="sm" className="mt-2" />
                  ) : (
                    <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.totalUsers}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <Link href="/settings/admin/features" className="p-4 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors block">
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
