'use client';

import { useState, useEffect } from 'react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { BarChart3, TrendingUp, Clock, CheckCircle, AlertCircle, Activity } from 'lucide-react';

export default function ScanMetricsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now - replace with actual API call
    const mockMetrics = {
      totalScans: 15420,
      successRate: 94.5,
      averageProcessingTime: 1.2,
      dailyScans: [
        { date: '2024-01-15', scans: 2100, success: 1987 },
        { date: '2024-01-16', scans: 2350, success: 2221 },
        { date: '2024-01-17', scans: 1890, success: 1789 },
        { date: '2024-01-18', scans: 2670, success: 2523 },
        { date: '2024-01-19', scans: 3120, success: 2951 },
        { date: '2024-01-20', scans: 2890, success: 2734 },
        { date: '2024-01-21', scans: 2400, success: 2275 },
      ],
      errorTypes: [
        { type: 'Network Timeout', count: 45, percentage: 2.9 },
        { type: 'Invalid SKU', count: 28, percentage: 1.8 },
        { type: 'Rate Limited', count: 12, percentage: 0.8 },
        { type: 'Service Unavailable', count: 8, percentage: 0.5 },
      ],
      topTenants: [
        { name: 'Store A', scans: 3420, success: 3289 },
        { name: 'Store B', scans: 2890, success: 2745 },
        { name: 'Store C', scans: 2156, success: 2048 },
        { name: 'Store D', scans: 1876, success: 1782 },
        { name: 'Store E', scans: 1234, success: 1172 },
      ]
    };

    setTimeout(() => {
      setMetrics(mockMetrics);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Scan Metrics"
          description="View scanning activity, success rates, and API performance"
          icon={Icons.Admin}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan Metrics"
        description="View scanning activity, success rates, and API performance"
        icon={Icons.Admin}
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Scans</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalScans.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Processing Time</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.averageProcessingTime}s</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Daily Average</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(metrics.totalScans / 7).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Error Breakdown
            </CardTitle>
            <CardDescription>Common error types and frequencies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.errorTypes.map((error: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{error.type}</span>
                      <span className="text-sm text-gray-500">{error.count} ({error.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full"
                        style={{ width: `${error.percentage * 10}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top Tenants
            </CardTitle>
            <CardDescription>Highest scanning activity by tenant</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topTenants.map((tenant: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{tenant.name}</span>
                      <span className="text-sm text-gray-500">
                        {tenant.scans} ({Math.round((tenant.success / tenant.scans) * 100)}% success)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${(tenant.scans / metrics.topTenants[0].scans) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
