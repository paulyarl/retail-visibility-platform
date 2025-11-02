'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';

interface OrganizationData {
  organizationId: string;
  organizationName: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  limits: {
    maxLocations: number;
    maxTotalSKUs: number;
  };
  current: {
    totalLocations: number;
    totalSKUs: number;
  };
  status: {
    locations: 'ok' | 'warning' | 'at_limit';
    skus: 'ok' | 'warning' | 'at_limit';
    overall: 'ok' | 'warning' | 'at_limit';
  };
  locationBreakdown: Array<{
    tenantId: string;
    tenantName: string;
    skuCount: number;
  }>;
}

export default function OrganizationPage() {
  const [orgData, setOrgData] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');

  useEffect(() => {
    // Get organizationId from localStorage or URL
    const params = new URLSearchParams(window.location.search);
    const orgId = params.get('organizationId') || localStorage.getItem('organizationId') || '';
    setOrganizationId(orgId);

    if (orgId) {
      loadOrganizationData(orgId);
    } else {
      setLoading(false);
      setError('No organization selected');
    }
  }, []);

  const loadOrganizationData = async (orgId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/organization/billing/counters?organizationId=${orgId}`);
      
      if (!res.ok) {
        throw new Error('Failed to load organization data');
      }

      const data = await res.json();
      setOrgData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'success';
      case 'warning': return 'warning';
      case 'at_limit': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ok': return 'Healthy';
      case 'warning': return 'Approaching Limit';
      case 'at_limit': return 'At Limit';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Organization Dashboard"
          description="Loading organization data..."
          icon={Icons.Settings}
          backLink={{
            href: '/settings',
            label: 'Back to Settings'
          }}
        />
      </div>
    );
  }

  if (error || !orgData) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Organization Dashboard"
          description="Manage your chain organization"
          icon={Icons.Settings}
          backLink={{
            href: '/settings',
            label: 'Back to Settings'
          }}
        />
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-red-600">{error || 'No organization data available'}</p>
              <Button
                variant="primary"
                onClick={() => window.location.href = '/settings'}
                className="mt-4"
              >
                Return to Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const skuPercentage = (orgData.current.totalSKUs / orgData.limits.maxTotalSKUs) * 100;
  const locationPercentage = (orgData.current.totalLocations / orgData.limits.maxLocations) * 100;

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title={orgData.organizationName}
        description="Chain organization dashboard"
        icon={Icons.Settings}
        backLink={{
          href: '/settings',
          label: 'Back to Settings'
        }}
      />

      <div className="mt-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overall Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-neutral-600">Overall Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant={getStatusColor(orgData.status.overall)} className="text-lg px-4 py-2">
                  {getStatusText(orgData.status.overall)}
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Tier: <span className="font-semibold">{orgData.subscriptionTier}</span>
              </p>
            </CardContent>
          </Card>

          {/* Total Locations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-neutral-600">Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-neutral-900">
                {orgData.current.totalLocations} / {orgData.limits.maxLocations}
              </div>
              <div className="mt-2 w-full bg-neutral-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    locationPercentage >= 100 ? 'bg-red-600' :
                    locationPercentage >= 90 ? 'bg-yellow-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(locationPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                {locationPercentage.toFixed(0)}% utilized
              </p>
            </CardContent>
          </Card>

          {/* Total SKUs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-neutral-600">Total SKUs (Shared Pool)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-neutral-900">
                {orgData.current.totalSKUs.toLocaleString()} / {orgData.limits.maxTotalSKUs.toLocaleString()}
              </div>
              <div className="mt-2 w-full bg-neutral-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    skuPercentage >= 100 ? 'bg-red-600' :
                    skuPercentage >= 90 ? 'bg-yellow-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(skuPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                {skuPercentage.toFixed(1)}% utilized
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Location Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Location Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {orgData.locationBreakdown.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-500">No locations in this organization</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orgData.locationBreakdown
                  .sort((a, b) => b.skuCount - a.skuCount)
                  .map((location) => {
                    const locationPercentage = (location.skuCount / orgData.limits.maxTotalSKUs) * 100;
                    return (
                      <div
                        key={location.tenantId}
                        className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-neutral-900">{location.tenantName}</h3>
                            <Badge variant="default" className="text-xs">
                              {location.skuCount.toLocaleString()} SKUs
                            </Badge>
                          </div>
                          <div className="mt-2 w-full bg-neutral-200 rounded-full h-1.5">
                            <div
                              className="bg-primary-600 h-1.5 rounded-full"
                              style={{ width: `${locationPercentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-neutral-500 mt-1">
                            {locationPercentage.toFixed(1)}% of total pool
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.location.href = `/items?tenantId=${location.tenantId}`}
                        >
                          View Items →
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warning Messages */}
        {orgData.status.overall !== 'ok' && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-yellow-900 mb-2">Action Required</h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    {orgData.status.skus === 'at_limit' && (
                      <li>• You've reached your SKU limit. Upgrade your plan or remove items to add more.</li>
                    )}
                    {orgData.status.skus === 'warning' && (
                      <li>• You're approaching your SKU limit ({skuPercentage.toFixed(0)}% used).</li>
                    )}
                    {orgData.status.locations === 'at_limit' && (
                      <li>• You've reached your location limit. Upgrade to add more locations.</li>
                    )}
                    {orgData.status.locations === 'warning' && (
                      <li>• You're approaching your location limit ({locationPercentage.toFixed(0)}% used).</li>
                    )}
                  </ul>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.location.href = '/settings/subscription'}
                    className="mt-4"
                  >
                    Upgrade Plan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
