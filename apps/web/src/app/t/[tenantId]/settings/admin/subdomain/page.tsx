'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isPlatformUser, isTenantOwnerOrAdmin, getTenantRole } from '@/lib/auth/access-control';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'; // TODO: Tabs component has incompatible API
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
  Clock
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

interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  _count?: {
    inventory_items: number;
    user_tenants: number;
  };
}

export default function AdminSubdomainPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;
  const { user } = useAuth();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<SubdomainStats | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingLimits, setUpdatingLimits] = useState(false);
  const [error, setError] = useState<string>('');

  // Check if user has access to this tenant (same pattern as subscription page)
  const hasAccess = user && (
    isPlatformUser(user) || // Platform users have access to all tenants
    isTenantOwnerOrAdmin(user, tenantId) // Tenant owners/admins have access
  );

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Platform admins have access to all tenants - no need to fetch tenant data
      if (isPlatformUser(user)) {
        await fetchSubdomainStats();
        await fetchRateLimits();
        setLoading(false);
        return;
      }

      // Store owners need tenant context and access check
      if (!tenantId) {
        setError('No tenant context found');
        setLoading(false);
        return;
      }

      // Check if user has access to this tenant
      if (!hasAccess) {
        setError('You do not have access to this tenant');
        setLoading(false);
        return;
      }

      try {
        // Fetch tenant data for store owners (same pattern as subscription page)
        const tenantRes = await api.get(`/api/tenants/${tenantId}`);
        if (tenantRes.ok) {
          const tenantData = await tenantRes.json();
          setTenant(tenantData);
        } else {
          setError('Failed to load tenant information');
        }

        await fetchSubdomainStats();
        await fetchRateLimits();
      } catch (err) {
        console.error('Failed to load tenant data:', err);
        setError('Failed to load tenant information');
      }

      setLoading(false);
    };

    loadData();
  }, [user, tenantId, hasAccess]);

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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Globe className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              Subdomain Management
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Monitor subdomain usage, adoption rates, and manage rate limiting settings
            </p>
          </div>
        </div>
      </div>

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
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Additional management features like bulk subdomain operations and tenant-specific controls
                  can be added here in future iterations.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting Configuration</CardTitle>
              <CardDescription>
                Configure rate limits to prevent abuse and ensure system stability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rateLimits && (
                <div className="space-y-4">
                  {/* Subdomain Check Limits */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Subdomain Availability Checks</h3>
                      <p className="text-sm text-neutral-500">
                        How many times users can check subdomain availability per minute
                      </p>
                    </div>
                    <Badge variant="default">
                      {rateLimits.subdomainCheck.maxRequests} per minute
                    </Badge>
                  </div>

                  {/* Subdomain Creation Limits */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Subdomain Creation</h3>
                      <p className="text-sm text-neutral-500">
                        How many subdomains tenants can create per hour
                      </p>
                    </div>
                    <Badge variant="default">
                      {rateLimits.subdomainCreate.maxRequests} per hour
                    </Badge>
                  </div>

                  {/* Subdomain Resolution Limits */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Subdomain Resolution</h3>
                      <p className="text-sm text-neutral-500">
                        How many subdomain lookups the system processes per minute
                      </p>
                    </div>
                    <Badge variant="default">
                      {rateLimits.subdomainResolve.maxRequests} per minute
                    </Badge>
                  </div>
                </div>
              )}

              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Rate limits are currently configured in the backend code. Dynamic configuration
                  can be added in future updates.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
