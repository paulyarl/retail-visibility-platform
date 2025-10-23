"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, AnimatedCard, Spinner } from '@/components/ui';
import { motion } from 'framer-motion';
import PageHeader, { Icons } from '@/components/PageHeader';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Fetch real tenant count
        const tenantsRes = await fetch('/api/tenants');
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

  const adminSections = [
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
      badge: 'NEW',
    },
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
      title: 'Feature Flags',
      description: 'Control feature rollout and pilot programs',
      href: '/settings/admin/features',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      ),
      color: 'bg-blue-500',
      stats: 'Manage features',
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
                  <p className="text-sm font-medium text-neutral-600">Total Tenants</p>
                  {loading ? (
                    <Spinner size="sm" className="mt-2" />
                  ) : (
                    <p className="text-3xl font-bold text-neutral-900 mt-1">{stats.totalTenants}</p>
                  )}
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <p className="text-sm font-medium text-neutral-600">Total Users</p>
                  {loading ? (
                    <Spinner size="sm" className="mt-2" />
                  ) : (
                    <p className="text-3xl font-bold text-neutral-900 mt-1">{stats.totalUsers}</p>
                  )}
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

        </div>

        {/* Admin Sections */}
        <Card>
          <CardHeader>
            <CardTitle>Administration</CardTitle>
            <CardDescription>Manage platform features and users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {adminSections.map((section, index) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <Link href={section.href}>
                    <div className="group p-6 bg-white border border-neutral-200 rounded-lg hover:shadow-md hover:border-primary-300 transition-all duration-200 cursor-pointer">
                      <div className="flex items-start gap-4">
                        <div className={`${section.color} p-3 rounded-lg text-white flex-shrink-0`}>
                          {section.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                              {section.title}
                            </h3>
                            {section.badge && (
                              <Badge variant="info" className="text-xs">
                                {section.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-neutral-600 mt-1">
                            {section.description}
                          </p>
                          <p className="text-xs text-neutral-500 mt-2">
                            {section.stats}
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-neutral-400 group-hover:text-primary-600 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Common administrative pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/settings/admin/users" className="p-4 text-left bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors block">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Invite User</p>
                    <p className="text-xs text-neutral-500">Add new platform user</p>
                  </div>
                </div>
              </Link>

              <Link href="/settings/admin/tenants" className="p-4 text-left bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors block">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">View All Tenants</p>
                    <p className="text-xs text-neutral-500">System-wide tenant list</p>
                  </div>
                </div>
              </Link>

              <Link href="/settings/admin/features" className="p-4 text-left bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors block">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Manage Features</p>
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
