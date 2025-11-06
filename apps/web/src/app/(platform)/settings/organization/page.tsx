'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

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
  // Get tenantId from localStorage for access control
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
  
  // Use centralized access control - organization members can view
  const {
    hasAccess,
    loading: accessLoading,
    tenantRole,
    organizationData: orgDataFromHook,
  } = useAccessControl(
    tenantId,
    AccessPresets.ORGANIZATION_MEMBER,
    true // Fetch organization data
  );

  const [orgData, setOrgData] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [selectedHeroId, setSelectedHeroId] = useState<string>('');
  const [settingHero, setSettingHero] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Use organization data from access control hook
  useEffect(() => {
    if (orgDataFromHook) {
      setOrganizationId(orgDataFromHook.id);
      loadOrganizationData(orgDataFromHook.id);
    } else if (!accessLoading) {
      setLoading(false);
      setError('No organization found. This tenant may not be part of an organization.');
    }
  }, [orgDataFromHook, accessLoading]);

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

  const handleSetHeroLocation = async () => {
    if (!selectedHeroId || !organizationId) return;

    setSettingHero(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/hero-location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedHeroId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to set hero location');
      }

      const data = await res.json();
      alert(`✅ ${data.heroTenantName} is now set as the hero location!`);
      
      // Reload organization data
      await loadOrganizationData(organizationId);
    } catch (err: any) {
      console.error('Failed to set hero location:', err);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setSettingHero(false);
    }
  };

  const handleSyncFromHero = async () => {
    if (!organizationId) return;

    if (!confirm('This will copy all products from your hero location to all other locations. Continue?')) {
      return;
    }

    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/sync-from-hero`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to sync from hero');
      }

      const data = await res.json();
      setSyncResult(data);
      
      // Reload organization data
      await loadOrganizationData(organizationId);
    } catch (err: any) {
      console.error('Failed to sync from hero:', err);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Access control checks
  if (accessLoading || loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        pageTitle="Organization Dashboard"
        pageDescription="Manage your chain organization"
        title="Access Restricted"
        message="The Organization Dashboard is only available to organization members (must be owner/admin of at least one location)."
        userRole={tenantRole}
        backLink={{ href: '/settings', label: 'Back to Settings' }}
      />
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
        {/* Quick Start Guide */}
        <Card className="border-primary-200 bg-gradient-to-br from-primary-50 to-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-600 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <CardTitle>Chain Management Quick Start</CardTitle>
                <p className="text-sm text-neutral-600 mt-1">Get your chain up and running in minutes</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Quick Start */}
              <div>
                <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-primary-600 text-white rounded-full text-xs font-bold">1</span>
                  Quick Start Steps
                </h3>
                <ol className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                    <div>
                      <p className="font-medium text-neutral-900">Set Your Hero Location</p>
                      <p className="text-neutral-600 text-xs mt-0.5">Choose your main location with the most complete product catalog</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                    <div>
                      <p className="font-medium text-neutral-900">Add Products to Hero</p>
                      <p className="text-neutral-600 text-xs mt-0.5">Build your master catalog at the hero location first</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                    <div>
                      <p className="font-medium text-neutral-900">Sync to All Locations</p>
                      <p className="text-neutral-600 text-xs mt-0.5">Use "Sync All from Hero" to distribute products chain-wide</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">4</span>
                    <div>
                      <p className="font-medium text-neutral-900">Customize Per Location</p>
                      <p className="text-neutral-600 text-xs mt-0.5">Adjust pricing, stock, and visibility for each location as needed</p>
                    </div>
                  </li>
                </ol>
              </div>

              {/* Right Column - Pro Tips */}
              <div>
                <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Pro Tips
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-neutral-700"><span className="font-semibold">Use Bulk Sync</span> for new locations to get them up and running instantly</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-neutral-700"><span className="font-semibold">Individual Propagation</span> works great for new products or seasonal items</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-neutral-700"><span className="font-semibold">No Duplicates</span> - existing SKUs are automatically skipped</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-neutral-700"><span className="font-semibold">Photos Included</span> - all product images are copied automatically</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-neutral-700"><span className="font-semibold">SKU Limit</span> - propagated items count toward your shared pool</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="mt-6 pt-6 border-t border-primary-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">Need help?</p>
                    <p className="text-xs text-neutral-600">Check out our detailed testing guide</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open('/docs/CHAIN_PROPAGATION_TESTING.md', '_blank')}
                >
                  View Guide →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Hero Location & Bulk Propagation */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Chain Management</CardTitle>
                <p className="text-sm text-neutral-500 mt-1">Designate a hero location and manage bulk propagation</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Hero Location Selection */}
              <div className="border-b pb-6">
                <h3 className="font-semibold text-neutral-900 mb-3">Hero Location</h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Designate one location as your "hero" or headquarters. This location will be the source for chain-wide product distribution.
                </p>
                <div className="flex items-center gap-4">
                  <select 
                    className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    value={selectedHeroId}
                    onChange={(e) => setSelectedHeroId(e.target.value)}
                  >
                    <option value="">Select Hero Location...</option>
                    {orgData.locationBreakdown.map((location) => (
                      <option key={location.tenantId} value={location.tenantId}>
                        {location.tenantName} ({location.skuCount} SKUs)
                      </option>
                    ))}
                  </select>
                  <Button 
                    variant="primary"
                    onClick={handleSetHeroLocation}
                    disabled={!selectedHeroId || settingHero}
                  >
                    {settingHero ? 'Setting...' : 'Set as Hero'}
                  </Button>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  💡 Tip: Choose the location with the most complete product catalog
                </p>
              </div>

              {/* Bulk Propagation */}
              <div>
                <h3 className="font-semibold text-neutral-900 mb-3">Bulk Propagation</h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Distribute products from your hero location to all other locations in one click.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-1">How it works:</p>
                      <ul className="space-y-1 text-blue-800">
                        <li>• Select your hero location above</li>
                        <li>• Click "Sync All from Hero"</li>
                        <li>• All products from hero will be copied to other locations</li>
                        <li>• Existing SKUs at other locations will be skipped (no duplicates)</li>
                      </ul>
                    </div>
                  </div>
                </div>
                {syncResult && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-2">✅ Sync Complete!</h4>
                    <div className="text-sm text-green-800 space-y-1">
                      <p>Hero: <span className="font-semibold">{syncResult.heroLocation.tenantName}</span> ({syncResult.heroLocation.itemCount} items)</p>
                      <p>✅ Created: {syncResult.summary.created} items</p>
                      <p>⏭️ Skipped: {syncResult.summary.skipped} (already exist)</p>
                      {syncResult.summary.errors > 0 && <p>❌ Errors: {syncResult.summary.errors}</p>}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Button 
                    variant="primary" 
                    size="lg"
                    className="flex-1"
                    disabled={!selectedHeroId || syncing}
                    onClick={handleSyncFromHero}
                  >
                    {syncing ? (
                      <>
                        <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Syncing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Sync All from Hero
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => window.location.href = `/items`}
                  >
                    Or propagate individual items →
                  </Button>
                </div>
                <p className="text-xs text-neutral-500 mt-3">
                  {selectedHeroId ? '✅ Ready to sync' : '⚠️ Set a hero location first to enable bulk sync'}
                </p>
              </div>
            </div>
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
