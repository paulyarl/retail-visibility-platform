'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Alert, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';

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

const TIERS = [
  { value: 'google_only', label: 'Google-Only ($29/mo)', color: 'bg-green-100 text-green-800' },
  { value: 'starter', label: 'Starter ($49/mo)', color: 'bg-blue-100 text-blue-800' },
  { value: 'professional', label: 'Professional ($499/mo)', color: 'bg-purple-100 text-purple-800' },
  { value: 'enterprise', label: 'Enterprise ($999/mo)', color: 'bg-amber-100 text-amber-800' },
  { value: 'organization', label: 'Organization ($999/mo)', color: 'bg-gradient-to-r from-purple-500 to-pink-600 text-white' },
];

const STATUSES = [
  { value: 'trial', label: 'Trial', color: 'bg-neutral-100 text-neutral-800' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'past_due', label: 'Past Due', color: 'bg-red-100 text-red-800' },
  { value: 'canceled', label: 'Canceled', color: 'bg-neutral-100 text-neutral-800' },
];

const ITEMS_PER_PAGE = 10;

export default function AdminTiersPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/tenants');
      if (!res.ok) throw new Error('Failed to load tenants');
      const data = await res.json();
      setTenants(Array.isArray(data) ? data : []);
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

      const res = await api.patch(`/api/tenants/${tenantId}`, {
        subscriptionTier: tier,
        subscriptionStatus: status,
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

  const getTierInfo = (tier?: string) => {
    return TIERS.find(t => t.value === tier) || TIERS[0];
  };

  const getStatusInfo = (status?: string) => {
    return STATUSES.find(s => s.value === status) || STATUSES[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Subscription Tier Management"
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
        title="Subscription Tier Management"
        description="Manage tenant subscription tiers and billing status"
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
              {/* Tier Information */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Subscription Tiers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {TIERS.map(tier => (
                    <div key={tier.value} className="p-4 border border-neutral-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">
                          {tier.value === 'trial' && '🆓'}
                          {tier.value === 'google_only' && '🔍'}
                          {tier.value === 'starter' && '🥉'}
                          {tier.value === 'professional' && '🥈'}
                          {tier.value === 'enterprise' && '🥇'}
                          {tier.value === 'organization' && '🏢'}
                        </span>
                        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${tier.color}`}>
                          {tier.label}
                        </div>
                      </div>
                      <div className="text-sm text-neutral-600">
                        {tier.value === 'google_only' && '250 SKUs, Google only'}
                        {tier.value === 'starter' && '500 SKUs, basic QR codes'}
                        {tier.value === 'professional' && '5,000 SKUs, branded QR codes'}
                        {tier.value === 'enterprise' && 'Unlimited SKUs, white-label'}
                        {tier.value === 'organization' && '10K shared SKUs, 8 propagation types'}
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
                            <Badge variant="default" className={tierInfo.color}>
                              {tierInfo.label}
                            </Badge>
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

                        {/* Tier Controls */}
                        <div className="flex-shrink-0">
                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-medium text-neutral-700">Change Tier:</label>
                            <div className="flex gap-2">
                              {TIERS.map(tier => (
                                <Button
                                  key={tier.value}
                                  size="sm"
                                  variant={tenant.subscriptionTier === tier.value ? 'primary' : 'ghost'}
                                  onClick={() => updateTier(tenant.id, tier.value, tenant.subscriptionStatus || 'active')}
                                  disabled={isUpdating}
                                  title={tier.label}
                                  className="relative group"
                                >
                                  {tier.value === 'google_only' && '🔍'}
                                  {tier.value === 'starter' && '🥉'}
                                  {tier.value === 'professional' && '🥈'}
                                  {tier.value === 'enterprise' && '🥇'}
                                  {tier.value === 'organization' && '🏢'}
                                </Button>
                              ))}
                            </div>
                            
                            <label className="text-xs font-medium text-neutral-700 mt-2">Change Status:</label>
                            <div className="flex gap-2">
                              {STATUSES.map(status => (
                                <Button
                                  key={status.value}
                                  size="sm"
                                  variant={tenant.subscriptionStatus === status.value ? 'primary' : 'ghost'}
                                  onClick={() => updateTier(tenant.id, tenant.subscriptionTier || 'starter', status.value)}
                                  disabled={isUpdating}
                                >
                                  {status.label}
                                </Button>
                              ))}
                            </div>
                          </div>
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
