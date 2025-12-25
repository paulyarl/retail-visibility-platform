'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';

interface ScanMetrics {
  sessions: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
    avgDurationMs: number;
  };
  scanning: {
    totalScanned: number;
    totalCommitted: number;
    totalDuplicates: number;
    scanSuccessRate: number;
    commitSuccessRate: number;
  };
  devices: Record<string, number>;
  enrichment: {
    total: number;
    cacheHitRate: number;
    byProvider: Record<string, { total: number; success: number; fail: number; avgLatency: number }>;
  };
}

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function ScanMetricsPage() {
  const [metrics, setMetrics] = useState<ScanMetrics | null>(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [timeRange]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.get(`${apiBaseUrl}/api/admin/scan-metrics?timeRange=${timeRange}`);
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.stats);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Scan Metrics"
        description="Monitor SKU scanning activity and performance"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          {['1h', '24h', '7d', '30d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              {range === '1h' && 'Last Hour'}
              {range === '24h' && 'Last 24 Hours'}
              {range === '7d' && 'Last 7 Days'}
              {range === '30d' && 'Last 30 Days'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : metrics ? (
          <>
            {/* Session Stats */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Session Activity</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Total Sessions</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-white">{metrics.sessions.total}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Active</p>
                  <p className="text-3xl font-bold text-yellow-600">{metrics.sessions.active}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Completed</p>
                  <p className="text-3xl font-bold text-green-600">{metrics.sessions.completed}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Cancelled</p>
                  <p className="text-3xl font-bold text-red-600">{metrics.sessions.cancelled}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Avg Duration</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-white">
                    {formatDuration(metrics.sessions.avgDurationMs)}
                  </p>
                </Card>
              </div>
            </div>

            {/* Scanning Stats */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Scanning Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Items Scanned</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-white">{metrics.scanning.totalScanned}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Items Committed</p>
                  <p className="text-3xl font-bold text-green-600">{metrics.scanning.totalCommitted}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Duplicates</p>
                  <p className="text-3xl font-bold text-yellow-600">{metrics.scanning.totalDuplicates}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Scan Success Rate</p>
                  <p className={`text-3xl font-bold ${metrics.scanning.scanSuccessRate >= 95 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {metrics.scanning.scanSuccessRate}%
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Commit Success Rate</p>
                  <p className={`text-3xl font-bold ${metrics.scanning.commitSuccessRate >= 95 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {metrics.scanning.commitSuccessRate}%
                  </p>
                </Card>
              </div>
            </div>

            {/* Enrichment Stats */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Enrichment Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6">
                  <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-4">Cache Performance</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">Cache Hit Rate</span>
                        <span className={`text-lg font-bold ${metrics.enrichment.cacheHitRate >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {metrics.enrichment.cacheHitRate}%
                        </span>
                      </div>
                      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${metrics.enrichment.cacheHitRate}%` }}
                        ></div>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Target: ≥80% • {metrics.enrichment.total} total lookups
                    </p>
                  </div>
                </Card>

                <Card className="p-6">
                  <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-4">API Providers</h4>
                  <div className="space-y-3">
                    {Object.entries(metrics.enrichment.byProvider).map(([provider, stats]) => (
                      <div key={provider} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-neutral-900 dark:text-white capitalize">
                              {provider.replace(/_/g, ' ')}
                            </span>
                            <Badge variant={stats.success > stats.fail ? 'success' : 'warning'} className="text-xs">
                              {stats.total} calls
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-neutral-600 dark:text-neutral-400">
                            <span>✓ {stats.success}</span>
                            <span>✗ {stats.fail}</span>
                            <span>{Math.round(stats.avgLatency)}ms avg</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            {/* Device Breakdown */}
            {Object.keys(metrics.devices).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Device Types</CardTitle>
                  <CardDescription>Sessions by scanning device</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(metrics.devices).map(([device, count]) => (
                      <div key={device} className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                        <p className="text-2xl font-bold text-neutral-900 dark:text-white">{count}</p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 capitalize mt-1">
                          {device}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-neutral-600 dark:text-neutral-400">No metrics data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
