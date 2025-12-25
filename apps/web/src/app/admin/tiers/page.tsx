'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Alert, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

type Tenant = {
  id: string;
  name: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  createdAt?: string;
  metadata?: {
    businessName?: string;
    city?: string;
    state?: string;
  };
  organization?: {
    id: string;
    name: string;
  } | null;
};

interface DbTier {
  id: string;
  tierKey: string;
  displayName: string;
  priceMonthly: number;
  maxSkus: number | null;
  maxLocations: number | null;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
}

const STATUSES = [
  { value: 'trial', label: 'Trial', color: 'bg-neutral-100 text-neutral-800' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'past_due', label: 'Past Due', color: 'bg-red-100 text-red-800' },
  { value: 'canceled', label: 'Canceled', color: 'bg-neutral-100 text-neutral-800' },
];

const ITEMS_PER_PAGE = 10;

export default function AdminTiersPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [dbTiers, setDbTiers] = useState<DbTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadTenants();
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      setTiersLoading(true);
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await api.get(`${apiBaseUrl}/api/admin/tier-system/tiers`);
      if (res.ok) {
        const data = await res.json();
        setDbTiers(data.tiers || []);
      }
    } catch (e) {
      console.error('Failed to load tiers:', e);
    } finally {
      setTiersLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/tenants');
      if (!res.ok) throw new Error('Failed to load tenants');
      const data = await res.json();
      
      // Transform snake_case fields to camelCase for frontend compatibility
      const tenantsArray = Array.isArray(data) ? data : [];
      const transformedTenants = tenantsArray.map((tenant: any) => ({
        id: tenant.id,
        name: tenant.name,
        subscriptionTier: tenant.subscriptionTier,
        subscriptionStatus: tenant.subscriptionStatus,
        trialEndsAt: tenant.trialEndsAt,
        subscriptionEndsAt: tenant.subscriptionEndsAt,
        createdAt: tenant.createdAt,
        metadata: tenant.metadata,
        organization: tenant.organization ? {
          id: tenant.organization.id,
          name: tenant.organization.name,
        } : null,
      }));
      
      setTenants(transformedTenants);
    } catch (err: any) {
      setError(err.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const updateTier = async (tenantId: string, tier: string, status: string) => {
    try {
      setUpdating(tenantId);
      setError(null);
      setSuccess(null);

      // Call the correct admin tier management endpoint
      const res = await api.patch(`/api/admin/tiers/tenants/${tenantId}`, {
        subscriptionTier: tier,
        subscriptionStatus: status,
        reason: 'Updated via admin tiers page',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error(`This tenant only exists locally and cannot be updated on the production server. Create the tenant on production first.`);
        }
        throw new Error(data.message || data.error || 'Failed to update tier');
      }

      setSuccess(`Successfully updated tier for location`);
      await loadTenants();
    } catch (err: any) {
      console.error('Update tier error:', err);
      setError(err.message || 'Failed to update tier');
    } finally {
      setUpdating(null);
    }
  };

  // Generate tier options from database
  const getTierOptions = () => {
    return dbTiers.map(tier => ({
      value: tier.tierKey,
      label: `${tier.displayName} ($${(tier.priceMonthly / 100).toFixed(0)}/mo)`,
      color: getTierColor(tier.tierType, tier.tierKey),
      tier: tier,
    }));
  };

  const getTierColor = (tierType: string, tierKey: string) => {
    if (tierType === 'organization') {
      return 'bg-gradient-to-r from-purple-500 to-pink-600 text-white';
    }
    const colors: Record<string, string> = {
      google_only: 'bg-green-100 text-green-800',
      starter: 'bg-blue-100 text-blue-800',
      professional: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-amber-100 text-amber-800',
    };
    return colors[tierKey] || 'bg-neutral-100 text-neutral-800';
  };

  const getTierInfo = (tierKey?: string) => {
    const tier = dbTiers.find(t => t.tierKey === tierKey);
    if (!tier) return null;
    return {
      value: tier.tierKey,
      label: `${tier.displayName} ($${(tier.priceMonthly / 100).toFixed(0)}/mo)`,
      color: getTierColor(tier.tierType, tier.tierKey),
      tier: tier,
    };
  };

  const getStatusInfo = (status?: string) => {
    return STATUSES.find(s => s.value === status) || STATUSES[0];
  };

  if (loading || tiersLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Location Subscription Management"
          description="Manage location subscription tiers and billing status"
          icon={Icons.Settings}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Location Subscription Management"
        description="Manage location subscription tiers and billing status"
        icon={Icons.Settings}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert variant="error" className="mb-6" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-6" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Tier Legend */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Subscription Tiers & Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Tier Information - Database Driven */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Subscription Tiers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {getTierOptions().map(tierOption => (
                    <div key={tierOption.value} className="p-4 border border-neutral-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">
                          {tierOption.value === 'google_only' && '🔍'}
                          {tierOption.value === 'starter' && '🥉'}
                          {tierOption.value === 'professional' && '🥈'}
                          {tierOption.value === 'enterprise' && '🥇'}
                          {tierOption.tier.tierType === 'organization' && '🏢'}
                        </span>
                        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${tierOption.color}`}>
                          {tierOption.tier.displayName}
                        </div>
                      </div>
                      <div className="text-sm text-neutral-600">
                        {tierOption.tier.maxSkus ? `${tierOption.tier.maxSkus.toLocaleString()} SKUs` : 'Unlimited SKUs'}
                        {tierOption.tier.maxLocations && `, ${tierOption.tier.maxLocations} locations`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Quick Actions Guide */}
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Quick Actions Guide</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex gap-1 mt-1">
                      <span className="text-xl">🔍</span>
                      <span className="text-xl">🥉</span>
                      <span className="text-xl">🥈</span>
                      <span className="text-xl">🥇</span>
                      <span className="text-xl">🏢</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Tier Buttons</p>
                      <p className="text-xs text-neutral-600">Click to change location's subscription tier. Trial status is separate below.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex gap-1 mt-1">
                      <Badge variant="default" className="text-xs bg-neutral-100 text-neutral-800">Trial</Badge>
                      <Badge variant="default" className="text-xs bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Status Buttons</p>
                      <p className="text-xs text-neutral-600">Click to change billing status (Trial, Active, Past Due, Canceled).</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Locations ({tenants.length})</CardTitle>
              {tenants.length > ITEMS_PER_PAGE && (
                <div className="text-sm text-neutral-600">
                  Page {currentPage} of {Math.ceil(tenants.length / ITEMS_PER_PAGE)}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-500">No locations found</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {tenants
                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                    .map(tenant => {
                  const tierInfo = getTierInfo(tenant.subscriptionTier);
                  const statusInfo = getStatusInfo(tenant.subscriptionStatus);
                  const isUpdating = updating === tenant.id;

                  return (
                    <div
                      key={tenant.id}
                      className="p-4 border border-neutral-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer relative group"
                      onClick={(e) => {
                        // Only navigate if clicking on the card itself, not buttons
                        if ((e.target as HTMLElement).closest('button')) return;
                        window.location.href = `/tenants?id=${tenant.id}`;
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Tenant Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="inline-block px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg group-hover:bg-primary-200 dark:group-hover:bg-primary-800/40 transition-colors">
                              <h3 className="text-lg font-bold text-primary-900 dark:text-primary-100 flex items-center gap-2">
                                {tenant.metadata?.businessName || tenant.name}
                                <span className="text-primary-600 dark:text-primary-400">→</span>
                              </h3>
                            </div>
                            {tierInfo && (
                              <Badge variant="default" className={tierInfo.color}>
                                {tierInfo.label}
                              </Badge>
                            )}
                            <Badge variant="default" className={statusInfo.color}>
                              {statusInfo.label}
                            </Badge>
                            {tenant.organization && (
                              <Badge variant="default" className="bg-orange-100 text-orange-800 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Chain: {tenant.organization.name}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-neutral-600 space-y-1">
                            <p>ID: {tenant.id}</p>
                            {tenant.metadata?.city && tenant.metadata?.state && (
                              <p>Location: {tenant.metadata.city}, {tenant.metadata.state}</p>
                            )}
                            {tenant.trialEndsAt && (
                              <p>Trial Ends: {new Date(tenant.trialEndsAt).toLocaleDateString()}</p>
                            )}
                            {tenant.subscriptionEndsAt && (
                              <p>Subscription Ends: {new Date(tenant.subscriptionEndsAt).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>

                        {/* Quick Actions - Cleaner Dropdown Approach */}
                        <div className="flex-shrink-0 flex flex-col gap-2">
                          {/* Tier Dropdown */}
                          <div className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                              Subscription Tier
                            </label>
                            <select
                              value={tenant.subscriptionTier || 'starter'}
                              onChange={(e) => updateTier(tenant.id, e.target.value, tenant.subscriptionStatus || 'active')}
                              disabled={isUpdating}
                              className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                            >
                              {getTierOptions().map(tierOption => (
                                <option key={tierOption.value} value={tierOption.value}>
                                  {tierOption.tier.displayName} (${(tierOption.tier.priceMonthly / 100).toFixed(0)}/mo)
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Status Dropdown */}
                          <div className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                              Status
                            </label>
                            <select
                              value={tenant.subscriptionStatus || 'active'}
                              onChange={(e) => updateTier(tenant.id, tenant.subscriptionTier || 'starter', e.target.value)}
                              disabled={isUpdating}
                              className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                            >
                              {STATUSES.map(status => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Loading Indicator */}
                          {isUpdating && (
                            <div className="flex items-center gap-2 text-xs text-primary-600 dark:text-primary-400">
                              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Updating...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>

                {/* Pagination Controls */}
                {tenants.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-neutral-200">
                    <div className="text-sm text-neutral-600">
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, tenants.length)} of {tenants.length} tenants
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        ← Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.ceil(tenants.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map(page => (
                          <Button
                            key={page}
                            variant={page === currentPage ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="min-w-[2.5rem]"
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(tenants.length / ITEMS_PER_PAGE), p + 1))}
                        disabled={currentPage === Math.ceil(tenants.length / ITEMS_PER_PAGE)}
                      >
                        Next →
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
