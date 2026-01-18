'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { AlertTriangle, TrendingUp, Users, Shield } from 'lucide-react';

// Simple chart component using SVG
function SimpleChart({ data, title }: { data: any[], title: string }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  // Get max value for scaling
  const maxValue = Math.max(...data.map(d => d.totalWarnings || 0));

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm">{title}</h4>
      <div className="h-48 flex items-end justify-between space-x-1">
        {data.slice(-14).map((item, index) => {
          const height = maxValue > 0 ? (item.totalWarnings / maxValue) * 100 : 0;
          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-blue-500 rounded-t min-h-[2px] transition-all hover:bg-blue-600"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${item.date}: ${item.totalWarnings} warnings`}
              />
              <span className="text-xs text-muted-foreground mt-1 transform -rotate-45 origin-top">
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TrendData {
  aggregatedData: Array<{
    date: string;
    pathname: string;
    totalWarnings: number;
    blockedWarnings: number;
    uniqueClients: number;
  }>;
  topPaths: Array<{
    pathname: string;
    totalWarnings: number;
    blockedWarnings: number;
    uniqueClients: number;
  }>;
  totalWarnings: number;
  dateRange: {
    start: string;
    end: string;
  };
}

export default function RateLimitTrends() {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState('7');

  const fetchTrends = async (daysParam: string) => {
    try {
      setLoading(true);
      setError(null);
      // Call the API app endpoint instead of local web app route
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/rate-limit-warnings?days=${daysParam}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trend data');
      }
      const trendData = await response.json();
      setData(trendData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends(days);
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Rate Limiting Trends</h3>
            <p className="text-sm text-muted-foreground">
              Monitor rate limiting patterns and identify potential threats
            </p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Rate Limiting Trends</h3>
            <p className="text-sm text-muted-foreground">
              Monitor rate limiting patterns and identify potential threats
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>Failed to load trend data: {error}</p>
              <Button
                onClick={() => fetchTrends(days)}
                className="mt-4"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Aggregate daily totals for chart
  const dailyTotals = data?.aggregatedData?.reduce((acc, item) => {
    const existing = acc.find(d => d.date === item.date);
    if (existing) {
      existing.totalWarnings += item.totalWarnings;
      existing.blockedWarnings += item.blockedWarnings;
      existing.uniqueClients = Math.max(existing.uniqueClients, item.uniqueClients);
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, [] as any[]) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rate Limiting Trends
          </h3>
          <p className="text-sm text-muted-foreground">
            Monitor rate limiting patterns and identify potential threats
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            label="Time Range"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            options={[
              { value: '1', label: 'Last 24h' },
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' }
            ]}
            className="w-32"
          />
          <Button onClick={() => fetchTrends(days)} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{data?.totalWarnings || 0}</p>
                <p className="text-xs text-muted-foreground">Total Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {data?.aggregatedData?.reduce((sum, item) => sum + item.blockedWarnings, 0) || 0}
                </p>
                <p className="text-xs text-muted-foreground">Blocked Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {data?.aggregatedData?.reduce((sum, item) => sum + item.uniqueClients, 0) || 0}
                </p>
                <p className="text-xs text-muted-foreground">Unique Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {data?.topPaths?.length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Monitored Paths</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Daily Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Warning Trends</CardTitle>
            <CardDescription>
              Rate limiting warnings over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleChart
              data={dailyTotals}
              title="Warnings per day"
            />
          </CardContent>
        </Card>

        {/* Top Offending Paths */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Offending Paths</CardTitle>
            <CardDescription>
              Most frequently rate-limited endpoints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.topPaths?.slice(0, 8).map((path, index) => (
                <div key={path.pathname} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="default" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <code className="text-sm font-mono">{path.pathname}</code>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-muted-foreground">
                      {path.totalWarnings} warnings
                    </span>
                    {path.blockedWarnings > 0 && (
                      <Badge variant="error" className="text-xs">
                        {path.blockedWarnings} blocked
                      </Badge>
                    )}
                  </div>
                </div>
              )) || (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Warnings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Warnings</CardTitle>
          <CardDescription>
            Latest rate limiting violations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data?.aggregatedData?.slice(0, 20).map((item, index) => (
              <div key={`${item.date}-${item.pathname}-${index}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center space-x-3">
                  <Badge variant={item.blockedWarnings > 0 ? "error" : "warning"} className="text-xs">
                    {item.blockedWarnings > 0 ? 'BLOCKED' : 'WARNED'}
                  </Badge>
                  <code className="text-sm font-mono">{item.pathname}</code>
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <span>{item.date}</span>
                  <span>{item.totalWarnings} warnings</span>
                  <span>{item.uniqueClients} clients</span>
                </div>
              </div>
            )) || (
              <p className="text-sm text-muted-foreground">No recent warnings</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
