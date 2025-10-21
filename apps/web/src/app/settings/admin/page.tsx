"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, AnimatedCard, Spinner } from '@/components/ui';
import { motion } from 'framer-motion';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
    activeSessions: 0,
    systemHealth: 'healthy' as 'healthy' | 'warning' | 'error',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch real stats from API
    // Simulated data for now
    setTimeout(() => {
      setStats({
        totalTenants: 12,
        totalUsers: 45,
        activeSessions: 8,
        systemHealth: 'healthy',
      });
      setLoading(false);
    }, 500);
  }, []);

  const adminSections = [
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
      stats: '4 active flags',
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
      description: 'View and manage all tenant accounts',
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
      title: 'System Configuration',
      description: 'Configure system settings and integrations',
      href: '/settings/admin/system',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'bg-orange-500',
      stats: 'API & Integrations',
    },
    {
      title: 'Analytics',
      description: 'Platform usage and performance metrics',
      href: '/settings/admin/analytics',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'bg-pink-500',
      stats: 'Real-time data',
    },
    {
      title: 'Activity Logs',
      description: 'View system activity and audit trails',
      href: '/settings/admin/logs',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-indigo-500',
      stats: 'Audit trail',
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Admin Dashboard</h1>
              <p className="text-neutral-600 mt-1">Platform administration and configuration</p>
            </div>
            <Link 
              href="/tenants"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Tenants
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

          <AnimatedCard delay={0.2} hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600">Active Sessions</p>
                  {loading ? (
                    <Spinner size="sm" className="mt-2" />
                  ) : (
                    <p className="text-3xl font-bold text-neutral-900 mt-1">{stats.activeSessions}</p>
                  )}
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.3} hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600">System Health</p>
                  {loading ? (
                    <Spinner size="sm" className="mt-2" />
                  ) : (
                    <div className="mt-1">
                      <Badge variant={stats.systemHealth === 'healthy' ? 'success' : 'error'}>
                        {stats.systemHealth === 'healthy' ? 'Healthy' : 'Issues'}
                      </Badge>
                    </div>
                  )}
                </div>
                <div className={`h-12 w-12 ${stats.systemHealth === 'healthy' ? 'bg-green-100' : 'bg-red-100'} rounded-lg flex items-center justify-center`}>
                  <svg className={`w-6 h-6 ${stats.systemHealth === 'healthy' ? 'text-green-600' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            <CardDescription>Manage platform features and configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                          <h3 className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                            {section.title}
                          </h3>
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="p-4 text-left bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Create User</p>
                    <p className="text-xs text-neutral-500">Add new platform user</p>
                  </div>
                </div>
              </button>

              <button className="p-4 text-left bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Clear Cache</p>
                    <p className="text-xs text-neutral-500">Refresh system cache</p>
                  </div>
                </div>
              </button>

              <button className="p-4 text-left bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Export Data</p>
                    <p className="text-xs text-neutral-500">Download platform data</p>
                  </div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
