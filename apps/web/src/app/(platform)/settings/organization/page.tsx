'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { ProtectedCard } from '@/lib/auth/ProtectedCard';
import { api } from '@/lib/api';
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

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
  const [syncingCategories, setSyncingCategories] = useState(false);
  const [categorySyncResult, setCategorySyncResult] = useState<any>(null);
  const [showHeroModal, setShowHeroModal] = useState(false);
  const [showCategorySyncModal, setShowCategorySyncModal] = useState(false);
  const [categorySyncScope, setCategorySyncScope] = useState<'single' | 'all'>('all');
  const [selectedSyncTenantId, setSelectedSyncTenantId] = useState<string>('');
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

  const handleSyncCategoriesToGBP = async () => {
    if (!organizationId) return;

    // Validate tenant selection for single location sync
    if (categorySyncScope === 'single' && !selectedSyncTenantId) {
      alert('Please select a location for single-location sync');
      return;
    }

    const confirmMessage = categorySyncScope === 'single'
      ? `This will sync product categories to Google Business Profile for the selected location. Continue?`
      : `This will sync product categories to Google Business Profile for ALL locations in this organization. Continue?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setSyncingCategories(true);
    setCategorySyncResult(null);
    setShowCategorySyncModal(false);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const requestBody: any = {
        strategy: 'platform_to_gbp',
        dryRun: false,
      };

      if (categorySyncScope === 'single') {
        requestBody.scope = 'tenant';
        requestBody.tenantId = selectedSyncTenantId;
      } else {
        requestBody.scope = 'organization';
        requestBody.organizationId = organizationId;
      }

      const response = await fetch(`${API_BASE}/api/categories/mirror`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (response.ok) {
        const locationText = categorySyncScope === 'single' ? '1 location' : `all locations`;
        setCategorySyncResult({
          success: true,
          message: `Categories synced to ${locationText} successfully`,
          jobId: data.jobId,
          scope: categorySyncScope,
        });
      } else {
        setCategorySyncResult({
          success: false,
          message: data.error || 'Failed to sync categories',
        });
      }
    } catch (error) {
      console.error('Category sync error:', error);
      setCategorySyncResult({
        success: false,
        message: 'Failed to sync categories to GBP',
      });
    } finally {
      setSyncingCategories(false);
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

        {/* 2. KEY METRICS - Unified Capacity Display */}
        <SubscriptionUsageBadge variant="card" showUpgradeLink={true} />

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
          accessOptions={AccessPresets.CHAIN_PROPAGATION}
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
              {/* Group 1: Product & Catalog Management */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
                  Product & Catalog Management
                </h3>
                <p className="text-xs text-neutral-600 mb-4">
                  Propagate products, categories, and catalog structure
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Categories */}
                  <div className="p-4 bg-white rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-neutral-900">Categories</h4>
                          <Badge variant="success" className="text-xs">ACTIVE</Badge>
                        </div>
                        <p className="text-xs text-neutral-600 mb-1">Propagate product categories and Google taxonomy alignments</p>
                        <p className="text-xs text-neutral-500">Bulk propagation</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => heroLocation && (window.location.href = `/t/${heroLocation.tenantId}/settings/propagation#categories`)}
                      disabled={!heroLocation}
                    >
                      Configure →
                    </Button>
                  </div>

                  {/* 2. Products/SKUs */}
                  <div className="p-4 bg-white rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-neutral-900">Products/SKUs</h4>
                          <Badge variant="success" className="text-xs">ACTIVE</Badge>
                        </div>
                        <p className="text-xs text-neutral-600 mb-1">Propagate individual or bulk products to locations</p>
                        <p className="text-xs text-neutral-500">Single or bulk</p>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      disabled={!heroLocation || syncing}
                      onClick={handleSyncFromHero}
                    >
                      {syncing ? 'Syncing...' : 'Sync All from Hero'}
                    </Button>
                  </div>

                  {/* 8. GBP Category Sync */}
                  <div className="p-4 bg-white rounded-lg border-2 border-indigo-200 hover:border-indigo-400 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-neutral-900">GBP Category Sync</h4>
                          <Badge variant="success" className="text-xs">ACTIVE</Badge>
                        </div>
                        <p className="text-xs text-neutral-600 mb-1">Sync product categories to Google Business Profile</p>
                        <p className="text-xs text-neutral-500">Organization-wide sync</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        disabled={!organizationId || syncingCategories}
                        onClick={() => setShowCategorySyncModal(true)}
                      >
                        {syncingCategories ? 'Syncing...' : 'Sync to GBP'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.location.href = '/admin/categories'}
                      >
                        Manage →
                      </Button>
                    </div>
                    {categorySyncResult && (
                      <div className={`mt-2 p-2 rounded text-xs ${categorySyncResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        {categorySyncResult.success ? '✅' : '❌'} {categorySyncResult.message}
                        {categorySyncResult.jobId && <div className="text-xs mt-1">Job ID: {categorySyncResult.jobId}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Group 2: Business Information */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
                  Business Information
                </h3>
                <p className="text-xs text-neutral-600 mb-4">
                  Propagate business hours, profile, and operational details
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 3. Business Hours */}
                  <div className="p-4 bg-white rounded-lg border-2 border-green-200 hover:border-green-400 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-neutral-900">Business Hours</h4>
                          <Badge variant="default" className="text-xs">NEW</Badge>
                        </div>
                        <p className="text-xs text-neutral-600 mb-1">Propagate regular and special hours to all locations</p>
                        <p className="text-xs text-neutral-500">Hours template</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => heroLocation && (window.location.href = `/t/${heroLocation.tenantId}/settings/propagation#hours`)}
                      disabled={!heroLocation}
                    >
                      Configure →
                    </Button>
                  </div>

                  {/* 4. Business Profile */}
                  <div className="p-4 bg-white rounded-lg border-2 border-cyan-200 hover:border-cyan-400 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-cyan-100 rounded-lg">
                        <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-neutral-900">Business Profile</h4>
                          <Badge variant="default" className="text-xs">NEW</Badge>
                        </div>
                        <p className="text-xs text-neutral-600 mb-1">Propagate business description, attributes, and settings</p>
                        <p className="text-xs text-neutral-500">Profile info</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => heroLocation && (window.location.href = `/t/${heroLocation.tenantId}/settings/propagation#profile`)}
                      disabled={!heroLocation}
                    >
                      Configure →
                    </Button>
                  </div>
                </div>
              </div>

              {/* Group 3: Configuration & Settings */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
                  Configuration & Settings
                </h3>
                <p className="text-xs text-neutral-600 mb-4">
                  Propagate feature flags, permissions, and system settings
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 5. Feature Flags */}
                  <div className="p-4 bg-white rounded-lg border-2 border-indigo-200 hover:border-indigo-400 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-neutral-900">Feature Flags</h4>
                          <Badge variant="default" className="text-xs">NEW</Badge>
                        </div>
                        <p className="text-xs text-neutral-600 mb-1">Enable or disable features across all locations</p>
                        <p className="text-xs text-neutral-500">Centralized control</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => heroLocation && (window.location.href = `/t/${heroLocation.tenantId}/settings/propagation#flags`)}
                      disabled={!heroLocation}
                    >
                      Configure →
                    </Button>
                  </div>

                  {/* 6. User Roles & Permissions */}
                  <div className="p-4 bg-white rounded-lg border-2 border-pink-200 hover:border-pink-400 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-pink-100 rounded-lg">
                        <svg className="w-5 h-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-neutral-900">User Roles & Permissions</h4>
                          <Badge variant="default" className="text-xs">NEW</Badge>
                        </div>
                        <p className="text-xs text-neutral-600 mb-1">Propagate user invitations and role assignments</p>
                        <p className="text-xs text-neutral-500">Team management</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => heroLocation && (window.location.href = `/t/${heroLocation.tenantId}/settings/propagation#roles`)}
                      disabled={!heroLocation}
                    >
                      Configure →
                    </Button>
                  </div>
                </div>
              </div>

              {/* Group 4: Branding & Assets */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
                  Branding & Assets
                </h3>
                <p className="text-xs text-neutral-600 mb-4">
                  Propagate logos, colors, and brand identity
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 7. Brand Assets */}
                  <div className="p-4 bg-white rounded-lg border-2 border-orange-200 hover:border-orange-400 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-neutral-900">Brand Assets</h4>
                          <Badge variant="default" className="text-xs">NEW</Badge>
                        </div>
                        <p className="text-xs text-neutral-600 mb-1">Propagate logos, colors, and branding elements</p>
                        <p className="text-xs text-neutral-500">Brand consistency</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => heroLocation && (window.location.href = `/t/${heroLocation.tenantId}/settings/propagation#brand`)}
                      disabled={!heroLocation}
                    >
                      Configure →
                    </Button>
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
                  <CardTitle>What Can Be Propagated?</CardTitle>
                  <p className="text-sm text-blue-800 mt-1">Complete guide to chain-wide propagation</p>
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
                  <p className="font-bold text-blue-900 text-base mb-2">📋 8 Types of Propagation Available</p>
                  <p className="text-sm text-blue-800 mb-3">
                    The Propagation Control Panel above provides 8 different ways to sync data across your organization:
                  </p>
                </div>
              </div>
              
              {/* 8 Propagation Types */}
              <div className="space-y-3 mb-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-purple-900">1. Categories</span>
                    <Badge variant="success" className="text-xs">ACTIVE</Badge>
                  </div>
                  <p className="text-xs text-purple-800">Propagate product categories and Google taxonomy alignments across all locations</p>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-blue-900">2. Products/SKUs</span>
                    <Badge variant="success" className="text-xs">ACTIVE</Badge>
                  </div>
                  <p className="text-xs text-blue-800 mb-2">Bulk sync all products from hero location or propagate individual items</p>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-green-900">3. Business Hours</span>
                    <Badge variant="default" className="text-xs">NEW</Badge>
                  </div>
                  <p className="text-xs text-green-800">Propagate regular and special hours to maintain consistent schedules</p>
                </div>
                
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-cyan-900">4. Business Profile</span>
                    <Badge variant="default" className="text-xs">NEW</Badge>
                  </div>
                  <p className="text-xs text-cyan-800">Sync business description, attributes, and settings</p>
                </div>
                
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-indigo-900">5. Feature Flags</span>
                    <Badge variant="default" className="text-xs">NEW</Badge>
                  </div>
                  <p className="text-xs text-indigo-800">Enable or disable features across all locations from one place</p>
                </div>
                
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-pink-900">6. User Roles & Permissions</span>
                    <Badge variant="default" className="text-xs">NEW</Badge>
                  </div>
                  <p className="text-xs text-pink-800">Propagate user invitations and role assignments for team management</p>
                </div>
                
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-orange-900">7. Brand Assets</span>
                    <Badge variant="default" className="text-xs">NEW</Badge>
                  </div>
                  <p className="text-xs text-orange-800">Propagate logos, colors, and branding elements for consistency</p>
                </div>
                
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-indigo-900">8. GBP Category Sync</span>
                    <Badge variant="success" className="text-xs">ACTIVE</Badge>
                  </div>
                  <p className="text-xs text-indigo-800 mb-1">Sync product categories to Google Business Profile with strategic testing capability</p>
                  <p className="text-xs text-indigo-700">• Test on 1 location before rollout • Sync to all locations with one click</p>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-900 font-semibold mb-2">📦 Product/SKU Sync Details:</p>
                <p className="text-xs text-blue-800 mb-2">
                  When you use "Sync All from Hero", the following product data is copied:
                </p>
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
                    className="mt-4" style={{ color: '#ffffff' }}
                  >
                    Upgrade Plan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category Sync Modal */}
      {showCategorySyncModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Sync Categories to GBP</h3>
            
            <div className="space-y-4 mb-6">
              {/* Scope Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Sync Scope</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-neutral-50">
                    <input
                      type="radio"
                      name="categorySyncScope"
                      value="all"
                      checked={categorySyncScope === 'all'}
                      onChange={() => setCategorySyncScope('all')}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">All Locations</div>
                      <div className="text-xs text-neutral-600">Sync to all {orgData?.locationBreakdown.length || 0} locations in organization</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-neutral-50">
                    <input
                      type="radio"
                      name="categorySyncScope"
                      value="single"
                      checked={categorySyncScope === 'single'}
                      onChange={() => setCategorySyncScope('single')}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Single Location</div>
                      <div className="text-xs text-neutral-600">Test on one location before rolling out</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Tenant Selector (shown when single is selected) */}
              {categorySyncScope === 'single' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Select Location</label>
                  <select
                    value={selectedSyncTenantId}
                    onChange={(e) => setSelectedSyncTenantId(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Choose a location...</option>
                    {orgData?.locationBreakdown.map((location) => (
                      <option key={location.tenantId} value={location.tenantId}>
                        {location.tenantName} ({location.skuCount} SKUs)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Strategy Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-blue-800">
                    <strong>Use Case:</strong> {categorySyncScope === 'single' 
                      ? 'Test new categories on one location before chain-wide rollout'
                      : 'Update all locations with latest product categories'}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowCategorySyncModal(false);
                  setCategorySyncScope('all');
                  setSelectedSyncTenantId('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleSyncCategoriesToGBP}
                disabled={categorySyncScope === 'single' && !selectedSyncTenantId}
              >
                Sync Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}