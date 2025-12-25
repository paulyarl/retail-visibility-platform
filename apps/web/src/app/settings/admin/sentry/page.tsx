"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Spinner } from '@/components/ui';
import { motion } from 'framer-motion';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

type SentryMetric = {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'stable';
  description: string;
};

type SentryProject = {
  id: string;
  name: string;
  slug: string;
  platform: string;
  status: 'active' | 'inactive';
  lastEvent: string;
};

export default function SentryMonitoringPage() {
  // Use centralized access control - platform admins only
  const {
    hasAccess,
    loading: accessLoading,
    isPlatformAdmin,
  } = useAccessControl(
    null, // No tenant context needed
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  const [metrics, setMetrics] = useState<SentryMetric[]>([]);
  const [projects, setProjects] = useState<SentryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [sentryConfigured, setSentryConfigured] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSentryData = async () => {
      try {
        setError(null);
        const response = await api.get('/api/admin/sentry');
        const data = await response.json();

        setSentryConfigured(data.configured || false);

        if (data.configured && data.data) {
          // Use real Sentry data
          setMetrics(data.data.metrics || []);
          setProjects(data.data.projects || []);
        } else {
          // Use mock data if API not configured
          setMetrics(data.mockData?.metrics || []);
          setProjects(data.mockData?.projects || []);
        }
      } catch (error) {
        console.error('Failed to load Sentry data:', error);
        setError('Failed to connect to Sentry monitoring service');
        setSentryConfigured(false);
        // Fallback to basic mock data
        setMetrics([
          {
            title: 'Status',
            value: 'Offline',
            change: 'Service unavailable',
            trend: 'stable',
            description: 'Sentry monitoring is currently unavailable'
          }
        ]);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    loadSentryData();
  }, []);

  // Access control checks
  if (accessLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        pageTitle="Sentry Monitoring"
        pageDescription="Platform error tracking and performance monitoring"
        title="Platform Administrator Access Required"
        message="The Sentry monitoring dashboard is only accessible to platform administrators. This area contains sensitive error tracking and performance data."
        userRole={isPlatformAdmin ? 'Platform Admin' : 'User'}
        backLink={{ href: '/settings', label: 'Back to Settings' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Sentry Monitoring"
        description="Platform error tracking and performance monitoring"
        icon={Icons.Error}
        backLink={{
          href: '/settings/admin',
          label: 'Back to Admin Dashboard'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Project Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Project Selection</CardTitle>
            <CardDescription>Choose which Sentry project to monitor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedProject('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedProject === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                All Projects
              </button>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedProject === project.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {project.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        {(error || !sentryConfigured) && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${
                  error ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <div className="flex-1">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {error ? 'Connection Error' : 'Sentry Not Configured'}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {error || 'Add SENTRY_API_TOKEN and SENTRY_ORG_SLUG to environment variables to enable live monitoring.'}
                  </p>
                </div>
                <Badge variant={error ? 'error' : 'warning'}>
                  {error ? 'Error' : 'Setup Required'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{metric.title}</p>
                      <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{metric.value}</p>
                      <div className="flex items-center mt-2">
                        <span className={`text-sm font-medium ${
                          metric.trend === 'up' ? 'text-red-600' :
                          metric.trend === 'down' ? 'text-green-600' : 'text-neutral-600'
                        }`}>
                          {metric.change}
                        </span>
                        <span className="text-sm text-neutral-500 ml-2">{metric.description}</span>
                      </div>
                    </div>
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                      metric.trend === 'up' ? 'bg-red-100 dark:bg-red-900' :
                      metric.trend === 'down' ? 'bg-green-100 dark:bg-green-900' :
                      'bg-neutral-100 dark:bg-neutral-800'
                    }`}>
                      {metric.trend === 'up' ? (
                        <svg className="w-6 h-6 text-red-600 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      ) : metric.trend === 'down' ? (
                        <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-neutral-600 dark:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                        </svg>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Integration Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sentry Integration Status
            </CardTitle>
            <CardDescription>Current state of Sentry monitoring integration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${sentryConfigured ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <div className="flex-1">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {sentryConfigured ? 'API Configured' : 'API Not Configured'}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {sentryConfigured
                      ? 'Sentry API token and organization slug are configured'
                      : 'Add SENTRY_API_TOKEN and SENTRY_ORG_SLUG to environment variables'
                    }
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {metrics.length}
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Metrics Available</p>
                </div>
                <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {projects.length}
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Projects Tracked</p>
                </div>
                <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {sentryConfigured ? '🚀' : '⏳'}
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {sentryConfigured ? 'Ready for Integration' : 'Setup Required'}
                  </p>
                </div>
              </div>

              {!sentryConfigured && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">Next Steps</p>
                      <ol className="mt-2 text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <li>1. Set up a Sentry account and create an organization</li>
                        <li>2. Generate a personal access token with required permissions</li>
                        <li>3. Add SENTRY_API_TOKEN and SENTRY_ORG_SLUG to environment variables</li>
                        <li>4. Restart the application to enable live monitoring</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common Sentry monitoring tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="https://sentry.io"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors block"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">View Issues</p>
                    <p className="text-xs text-neutral-500">Browse error issues</p>
                  </div>
                </div>
              </Link>

              <Link
                href="https://sentry.io"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors block"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">Performance</p>
                    <p className="text-xs text-neutral-500">View performance data</p>
                  </div>
                </div>
              </Link>

              <Link
                href="https://sentry.io"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors block"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">Releases</p>
                    <p className="text-xs text-neutral-500">Monitor deployments</p>
                  </div>
                </div>
              </Link>

              <Link
                href="https://sentry.io"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors block"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">Settings</p>
                    <p className="text-xs text-neutral-500">Configure monitoring</p>
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
