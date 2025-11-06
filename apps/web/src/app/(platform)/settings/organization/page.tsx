'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { ProtectedCard } from '@/lib/auth/ProtectedCard';
import { api } from '@/lib/api';

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
  
  // Get organizationId from URL if provided
  const [urlOrgId, setUrlOrgId] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const orgId = params.get('organizationId');
      if (orgId) {
        setUrlOrgId(orgId);
      }
    }
  }, []);
  
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
  const [showHeroModal, setShowHeroModal] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const locationsPerPage = 5;

  // Use organization data from access control hook or URL
  useEffect(() => {
    if (orgDataFromHook) {
      // Use organization from hook (tenant-based)
      setOrganizationId(orgDataFromHook.id);
      loadOrganizationData(orgDataFromHook.id);
    } else if (urlOrgId) {
      // Use organization from URL (direct access)
      setOrganizationId(urlOrgId);
      loadOrganizationData(urlOrgId);
    } else if (!accessLoading) {
      setLoading(false);
      setError('No organization found. Please provide an organizationId parameter or select a tenant that belongs to an organization.');
    }
  }, [orgDataFromHook, urlOrgId, accessLoading]);

  const loadOrganizationData = async (orgId: string) => {
    try {
      setLoading(true);
      // Use api utility which includes auth headers
      const res = await api.get(`/api/organization/billing/counters?organizationId=${orgId}`);
      
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
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      // Call Railway API directly with auth
      const res = await api.put(`${API_BASE_URL}/organizations/${organizationId}/hero-location`, {
        tenantId: selectedHeroId,
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
  
  // Find current hero location
  const heroLocation = orgData.locationBreakdown.find(loc => 
    (loc as any).metadata?.isHeroLocation || loc.tenantId === selectedHeroId
  );

  const getGaugeColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-600';
    if (percentage >= 90) return 'bg-yellow-600';
    return 'bg-green-600';
  };

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
        {/* 1. HERO LOCATION BANNER - Prominent Leader Status */}
        <Card className="border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Crown Icon */}
                <div className="p-3 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                
                {/* Hero Info */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="warning" className="text-xs font-bold">
                      👑 HERO LOCATION
                    </Badge>
                    <Badge variant="default" className="text-xs">
                      Master Catalog
                    </Badge>
                  </div>
                  {heroLocation ? (
                    <>
                      <h2 className="text-2xl font-bold text-neutral-900">
                        {heroLocation.tenantName}
                      </h2>
                      <p className="text-sm text-neutral-600">
                        {heroLocation.skuCount.toLocaleString()} products • Source for chain-wide distribution
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold text-neutral-700">
                        No Hero Location Set
                      </h2>
                      <p className="text-sm text-neutral-600">
                        Select your master catalog location to enable bulk sync
                      </p>
                    </>
                  )}
                </div>
              </div>
              
              {/* Change Hero Button */}
              <Button 
                variant="primary"
                size="lg"
                onClick={() => setShowHeroModal(true)}
                className="flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {heroLocation ? 'Change Hero' : 'Set Hero Location'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Hero Selection Modal */}
        {showHeroModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHeroModal(false)}>
            <div className="w-full max-w-lg m-4" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Card>
                <CardHeader>
                  <CardTitle>Select Hero Location</CardTitle>
                  <p className="text-sm text-neutral-600 mt-2">
                    Choose the location with the most complete product catalog to use as your master source.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {orgData.locationBreakdown.map((location) => (
                      <button
                        key={location.tenantId}
                        onClick={() => {
                          setSelectedHeroId(location.tenantId);
                          handleSetHeroLocation();
                          setShowHeroModal(false);
                        }}
                        className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                          location.tenantId === heroLocation?.tenantId
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-neutral-200 hover:border-primary-300 hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-neutral-900">{location.tenantName}</h3>
                              {location.tenantId === heroLocation?.tenantId && (
                                <Badge variant="warning" className="text-xs">Current Hero</Badge>
                              )}
                            </div>
                            <p className="text-sm text-neutral-600 mt-1">
                              {location.skuCount.toLocaleString()} products
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setShowHeroModal(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* 2. METRICS GAUGES - Above the fold, scannable */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Overall Status */}
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="py-4">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                Status
              </div>
              <div className="text-2xl font-bold text-neutral-900">
                {getStatusText(orgData.status.overall)}
              </div>
            </CardContent>
          </Card>
          
          {/* Locations Gauge */}
          <Card>
            <CardContent className="py-4">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                Locations
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-neutral-900">
                  {orgData.current.totalLocations}
                </span>
                <span className="text-sm text-neutral-500">
                  / {orgData.limits.maxLocations}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div className={`h-2 rounded-full ${getGaugeColor(locationPercentage)}`} 
                     style={{ width: `${Math.min(locationPercentage, 100)}%` }} />
              </div>
            </CardContent>
          </Card>
          
          {/* SKUs Gauge */}
          <Card>
            <CardContent className="py-4">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                Total SKUs
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-neutral-900">
                  {orgData.current.totalSKUs.toLocaleString()}
                </span>
                <span className="text-sm text-neutral-500">
                  / {orgData.limits.maxTotalSKUs.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div className={`h-2 rounded-full ${getGaugeColor(skuPercentage)}`} 
                     style={{ width: `${Math.min(skuPercentage, 100)}%` }} />
              </div>
            </CardContent>
          </Card>
          
          {/* Subscription Tier */}
          <Card className="bg-gradient-to-br from-primary-50 to-white">
            <CardContent className="py-4">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                Plan
              </div>
              <div className="text-2xl font-bold text-primary-600">
                {orgData.subscriptionTier}
              </div>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => window.location.href = '/settings/subscription'}>
                Upgrade →
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 3. QUICK ACTIONS - Primary CTAs */}
        <Card>
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
              <Button 
                variant="primary" 
                size="lg"
                className="flex-1 flex items-center justify-center gap-2"
                disabled={!heroLocation || syncing}
                onClick={handleSyncFromHero}
              >
                {syncing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Sync All from Hero
                  </>
                )}
              </Button>
              <Button 
                variant="secondary" 
                size="lg"
                className="flex-1 flex items-center justify-center gap-2"
                onClick={() => window.location.href = `/items`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Propagate Individual Items
              </Button>
            </div>
            {!heroLocation && (
              <p className="text-sm text-amber-600 mt-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Set a hero location first to enable bulk sync
              </p>
            )}
            {syncResult && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">✅ Sync Complete!</h4>
                <div className="text-sm text-green-800 space-y-1">
                  <p>Hero: <span className="font-semibold">{syncResult.heroLocation.tenantName}</span> ({syncResult.heroLocation.itemCount} items)</p>
                  <p>✅ Created: {syncResult.summary.created} items</p>
                  <p>⏭️ Skipped: {syncResult.summary.skipped} (already exist)</p>
                  {syncResult.summary.errors > 0 && <p>❌ Errors: {syncResult.summary.errors}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. PROPAGATION CONTROL PANEL - Admin Only */}
        <ProtectedCard
          tenantId={tenantId}
          accessOptions={AccessPresets.TENANT_ADMIN}
          hideWhenDenied={true}
        >
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Propagation Control Panel
                      <Badge variant="warning" className="text-xs">Admin Only</Badge>
                    </CardTitle>
                    <p className="text-sm text-neutral-600 mt-1">Advanced tools for managing product distribution</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Bulk Operations */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Bulk Operations
                    </h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-lg border border-purple-100">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm text-neutral-900">Sync All from Hero</p>
                            <p className="text-xs text-neutral-600 mt-1">Copy all products from hero to all locations</p>
                          </div>
                          <Badge variant="success" className="text-xs">Primary</Badge>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full mt-2"
                          disabled={!heroLocation || syncing}
                          onClick={handleSyncFromHero}
                        >
                          {syncing ? 'Syncing...' : 'Sync All'}
                        </Button>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-purple-100">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm text-neutral-900">Individual Propagation</p>
                            <p className="text-xs text-neutral-600 mt-1">Propagate specific products manually</p>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => window.location.href = `/items`}
                        >
                          Go to Items
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Hero Management */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Hero Management
                    </h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-lg border border-purple-100">
                        <p className="font-medium text-sm text-neutral-900 mb-2">Current Hero Location</p>
                        {heroLocation ? (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-neutral-900">{heroLocation.tenantName}</p>
                              <p className="text-xs text-neutral-600">{heroLocation.skuCount} products</p>
                            </div>
                            <Badge variant="warning" className="text-xs">Hero</Badge>
                          </div>
                        ) : (
                          <p className="text-sm text-neutral-600">No hero location set</p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-3"
                          onClick={() => setShowHeroModal(true)}
                        >
                          {heroLocation ? 'Change Hero' : 'Set Hero Location'}
                        </Button>
                      </div>

                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-xs text-amber-900">
                            <p className="font-semibold mb-1">Admin Privileges Required</p>
                            <p>Only platform admins, tenant owners, and tenant admins can access these controls.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Display */}
              {syncResult && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Sync Complete!
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-green-800">
                    <div>
                      <p className="font-semibold">Hero Location</p>
                      <p>{syncResult.heroLocation.tenantName}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Source Items</p>
                      <p>{syncResult.heroLocation.itemCount}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Created</p>
                      <p className="text-green-700">✅ {syncResult.summary.created}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Skipped</p>
                      <p className="text-amber-700">⏭️ {syncResult.summary.skipped}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </ProtectedCard>

        {/* 5. LOCATION BREAKDOWN - Detailed view */}
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
              <>
                <div className="space-y-3">
                  {orgData.locationBreakdown
                    .sort((a, b) => b.skuCount - a.skuCount)
                    .slice((currentPage - 1) * locationsPerPage, currentPage * locationsPerPage)
                    .map((location) => {
                    const locationPercentage = (location.skuCount / orgData.limits.maxTotalSKUs) * 100;
                    const isHero = location.tenantId === heroLocation?.tenantId;
                    return (
                      <div
                        key={location.tenantId}
                        className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                          isHero 
                            ? 'bg-amber-50 border-2 border-amber-300' 
                            : 'bg-neutral-50 hover:bg-neutral-100'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-neutral-900">{location.tenantName}</h3>
                            {isHero && (
                              <Badge variant="warning" className="text-xs flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                Hero
                              </Badge>
                            )}
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

                {/* Pagination Controls */}
                {orgData.locationBreakdown.length > locationsPerPage && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-neutral-600">
                      Showing {((currentPage - 1) * locationsPerPage) + 1} to {Math.min(currentPage * locationsPerPage, orgData.locationBreakdown.length)} of {orgData.locationBreakdown.length} locations
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.ceil(orgData.locationBreakdown.length / locationsPerPage) }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              currentPage === page
                                ? 'bg-primary-600 text-white'
                                : 'text-neutral-600 hover:bg-neutral-100'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(orgData.locationBreakdown.length / locationsPerPage), prev + 1))}
                        disabled={currentPage === Math.ceil(orgData.locationBreakdown.length / locationsPerPage)}
                      >
                        Next
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 5. QUICK START GUIDE - Collapsible */}
        <Card className="border-primary-200 bg-gradient-to-br from-primary-50 to-white">
          <CardHeader>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowQuickStart(!showQuickStart)}>
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
              <svg 
                className={`w-5 h-5 text-neutral-500 transition-transform ${
                  showQuickStart ? 'rotate-180' : ''
                }`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </CardHeader>
          {showQuickStart && (
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

            {/* Bottom Tip */}
            <div className="mt-6 pt-6 border-t border-primary-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-neutral-900">💡 Pro Tip</p>
                  <p className="text-xs text-neutral-600">Use the Quick Actions above to sync products across all your locations instantly</p>
                </div>
              </div>
            </div>
          </CardContent>
          )}
        </Card>

        {/* 6. DETAILED SYNC GUIDE - Collapsible */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowQuickStart(!showQuickStart)}>
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <CardTitle>What Gets Synced?</CardTitle>
                  <p className="text-sm text-blue-800 mt-1">Detailed breakdown of bulk propagation</p>
                </div>
              </div>
              <svg 
                className={`w-5 h-5 text-blue-600 transition-transform ${
                  showQuickStart ? 'rotate-180' : ''
                }`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </CardHeader>
          {showQuickStart && (
            <CardContent>
              <div className="flex items-start gap-3 mb-4">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="font-bold text-blue-900 text-base mb-2">📋 What Gets Synced</p>
                  <p className="text-sm text-blue-800 mb-3">
                    "Sync All from Hero" copies the following data from your hero location to all other locations:
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold text-sm text-neutral-900">Product Information</span>
                  </div>
                  <ul className="text-xs text-neutral-700 space-y-1 ml-6">
                    <li>• SKU & Product Name</li>
                    <li>• Description</li>
                    <li>• Category Assignment</li>
                    <li>• Price & Currency</li>
                  </ul>
                </div>
                
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold text-sm text-neutral-900">Media & Attributes</span>
                  </div>
                  <ul className="text-xs text-neutral-700 space-y-1 ml-6">
                    <li>• Product Photos</li>
                    <li>• Custom Attributes</li>
                    <li>• Availability Status</li>
                    <li>• Display Order</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-xs text-amber-900">
                    <p className="font-semibold mb-1">Smart Duplicate Prevention</p>
                    <p>Products with matching SKUs at destination locations will be <strong>skipped</strong> (not overwritten). Only new products are added.</p>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-blue-800 space-y-1">
                <p className="font-semibold">📍 Process:</p>
                <ol className="ml-4 space-y-1">
                  <li>1. Identifies hero location and all other locations in organization</li>
                  <li>2. Fetches all products from hero location</li>
                  <li>3. For each destination location, copies products that don't exist there yet</li>
                  <li>4. Provides detailed summary of created/skipped items</li>
                </ol>
              </div>
            </CardContent>
          )}
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
