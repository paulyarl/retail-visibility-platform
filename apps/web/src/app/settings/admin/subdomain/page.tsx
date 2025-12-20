'use client';

import { useEffect, useState } from 'react';
import { api, API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isPlatformAdmin } from '@/lib/auth/access-control';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import PageHeader, { Icons } from '@/components/PageHeader';
import {
  BarChart,
  TrendingUp,
  Users,
  Globe,
  Shield,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';

interface SubdomainStats {
  totalTenants: number;
  tenantsWithSubdomains: number;
  adoptionRate: number;
  recentAdoptions: number;
  subdomainList: Array<{
    subdomain: string;
    tenantId: string;
    createdAt: string;
  }>;
}

interface RateLimitConfig {
  subdomainCheck: { maxRequests: number; windowMs: number };
  subdomainCreate: { maxRequests: number; windowMs: number };
  subdomainResolve: { maxRequests: number; windowMs: number };
}

export default function AdminSubdomainPage() {
  const { user } = useAuth();

  const [stats, setStats] = useState<SubdomainStats | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingLimits, setUpdatingLimits] = useState(false);
  const [error, setError] = useState<string>('');

  // Check platform admin access
  const hasAccess = user && isPlatformAdmin(user);

  useEffect(() => {
    if (hasAccess) {
      fetchSubdomainStats();
      fetchRateLimits();
    }
  }, [hasAccess]);

  const fetchSubdomainStats = async () => {
    try {
      const res = await api.get(`${API_BASE_URL}/api/analytics/subdomain-stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch subdomain stats:', error);
      setError('Failed to load subdomain statistics');
    }
  };

  const fetchRateLimits = async () => {
    try {
      // Note: This would need a backend endpoint to fetch current rate limits
      // For now, showing the configured defaults
      setRateLimits({
        subdomainCheck: { maxRequests: 10, windowMs: 60 * 1000 },
        subdomainCreate: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
        subdomainResolve: { maxRequests: 100, windowMs: 60 * 1000 },
      });
    } catch (error) {
      console.error('Failed to fetch rate limits:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRateLimits = async (newLimits: RateLimitConfig) => {
    setUpdatingLimits(true);
    try {
      // Note: This would need a backend endpoint to update rate limits
      // For now, just simulating the update
      setRateLimits(newLimits);
      setError('');
    } catch (error) {
      console.error('Failed to update rate limits:', error);
      setError('Failed to update rate limits');
    } finally {
      setUpdatingLimits(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3"></div>
          <div className="h-64 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You don't have permission to access admin subdomain settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Subdomain Management"
        description="Monitor subdomain usage, adoption rates, and manage rate limiting settings"
        icon={Icons.Admin}
        backLink={{
          href: '/settings/admin',
          label: 'Back to Admin Dashboard'
        }}
      />

      {/* Error Display */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Analytics Section */}
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTenants || 0}</div>
              <p className="text-xs text-muted-foreground">
                Registered tenants
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subdomain Users</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.tenantsWithSubdomains || 0}</div>
              <p className="text-xs text-muted-foreground">
                With custom subdomains
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Adoption Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.adoptionRate || 0}%</div>
              <p className="text-xs text-muted-foreground">
                Of total tenants
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Adoptions</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.recentAdoptions || 0}</div>
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subdomain List */}
        <Card>
          <CardHeader>
            <CardTitle>Active Subdomains</CardTitle>
            <CardDescription>
              Tenants with configured subdomains
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.subdomainList && stats.subdomainList.length > 0 ? (
              <div className="space-y-2">
                {stats.subdomainList.slice(0, 20).map((item) => (
                  <div key={item.tenantId} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="font-medium">{item.subdomain}.visibleshelf.com</p>
                        <p className="text-sm text-neutral-500">Tenant: {item.tenantId}</p>
                      </div>
                    </div>
                    <Badge variant="default">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
                {stats.subdomainList.length > 20 && (
                  <p className="text-sm text-neutral-500 mt-2">
                    And {stats.subdomainList.length - 20} more subdomains...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-neutral-500">No subdomains configured yet</p>
            )}
          </CardContent>
        </Card>

        {/* Management Section */}
        <Card>
          <CardHeader>
            <CardTitle>Subdomain Management</CardTitle>
            <CardDescription>
              Administrative controls for subdomain system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Refresh Analytics</h3>
                <p className="text-sm text-neutral-500">Update subdomain usage statistics</p>
              </div>
              <Button
                onClick={fetchSubdomainStats}
                variant="secondary"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Rate Limiting Configuration */}
            <div className="space-y-4">
              <h3 className="font-medium">Rate Limiting</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm">Subdomain Checks</h4>
                  <p className="text-sm text-neutral-500 mt-1">
                    {rateLimits?.subdomainCheck.maxRequests} requests per {Math.floor(rateLimits?.subdomainCheck.windowMs! / 1000 / 60)} minutes
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm">Subdomain Creation</h4>
                  <p className="text-sm text-neutral-500 mt-1">
                    {rateLimits?.subdomainCreate.maxRequests} requests per {Math.floor(rateLimits?.subdomainCreate.windowMs! / 1000 / 60 / 60)} hours
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm">Subdomain Resolution</h4>
                  <p className="text-sm text-neutral-500 mt-1">
                    {rateLimits?.subdomainResolve.maxRequests} requests per {Math.floor(rateLimits?.subdomainResolve.windowMs! / 1000 / 60)} minutes
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
