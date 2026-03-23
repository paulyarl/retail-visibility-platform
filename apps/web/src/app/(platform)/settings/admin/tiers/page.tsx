'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, ToastContainer, Alert } from '@/components/ui';
import { Button } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { tenantTierService, type Tenant as ServiceTenant } from '@/services/TenantTierService';
import { useToast } from '@/components/ui/use-toast';

type Tenant = {
  id: string;
  name: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  createdAt?: string;
  metadata?: { businessName?: string; city?: string; state?: string };
  organizationId?: string;
  organization?: { id: string; name: string } | null;
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
  const [currentPage, setCurrentPage] = useState(1);
  const { toast, toasts, removeToast } = useToast();

  useEffect(() => {
    loadTenants();
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      setTiersLoading(true);
      const data = await tenantTierService.getAdminTiers();
      const transformedTiers = (data || []).map((tier: any) => ({
        id: tier.id,
        tierKey: tier.id,
        displayName: tier.displayName,
        priceMonthly: tier.price,
        maxSkus: tier.maxSkus,
        maxLocations: tier.maxLocations,
        tierType: tier.type,
        isActive: true,
        sortOrder: tier.sortOrder,
      }));
      setDbTiers(transformedTiers);
    } catch (e) {
      console.error('Failed to load tiers:', e);
    } finally {
      setTiersLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await tenantTierService.getAdminTierTenants();
      const tenantsArray = Array.isArray(data) ? data : [];
      const transformedTenants = tenantsArray.map((tenant: any) => ({
        id: tenant.id,
        name: tenant.name,
        subscriptionTier: tenant.subscription_tier,
        subscriptionStatus: tenant.subscription_status,
        trialEndsAt: tenant.trial_ends_at,
        subscriptionEndsAt: tenant.subscription_ends_at,
        createdAt: tenant.created_at,
        metadata: tenant.metadata,
        organization: tenant.organizations_list ? { id: tenant.organizations_list.id, name: tenant.organizations_list.name } : null,
      }));
      setTenants(transformedTenants);
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
      setError(err.message || 'Failed to load tenants');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const updateTier = async (tenantId: string, tier: string, status: string) => {
    try {
      setUpdating(tenantId);
      setError(null);
      const responseData = await tenantTierService.updateTenantTier(tenantId, {
        subscriptionTier: tier,
        subscriptionStatus: status,
        reason: 'Updated via admin tiers page',
      });
      if (!responseData) throw new Error('Failed to update tier');

      type ApiTenantResponse = {
        subscription_tier?: string;
        subscription_status?: string;
        trial_ends_at?: string;
        subscription_ends_at?: string;
        metadata?: Tenant['metadata'];
        organization_id?: string;
        organizations_list?: { name: string };
        name?: string;
      };
      const apiTenant = (responseData as { tenant?: ApiTenantResponse }).tenant || (responseData as ApiTenantResponse);
      setTenants(prev => prev.map(t => t.id === tenantId ? {
        ...t,
        subscriptionTier: apiTenant.subscription_tier,
        subscriptionStatus: apiTenant.subscription_status,
        trialEndsAt: apiTenant.trial_ends_at,
        subscriptionEndsAt: apiTenant.subscription_ends_at,
        metadata: apiTenant.metadata,
        organization: apiTenant.organization_id ? { id: apiTenant.organization_id, name: apiTenant.organizations_list?.name || 'Unknown Organization' } : null,
      } : t));
      const tenantName = apiTenant.name || apiTenant.metadata?.businessName || 'Location';
      toast(`Successfully updated ${tenantName}`, { variant: 'success' });
    } catch (err: any) {
      setError(err.message || 'Failed to update tier');
      toast(err.message || 'Failed to update tier', { variant: 'error' });
    } finally {
      setUpdating(null);
    }
  };

  const getTierOptions = () => dbTiers.map(tier => ({
    value: tier.tierKey,
    label: `${tier.displayName} ($${tier.priceMonthly}/mo)`,
    color: getTierColor(tier.tierType, tier.tierKey),
    tier,
  }));

  const getTierColor = (tierType: string, tierKey: string) => {
    if (tierType === 'organization') return 'bg-gradient-to-r from-purple-500 to-pink-600 text-white';
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
    return { value: tier.tierKey, label: `${tier.displayName} ($${tier.priceMonthly}/mo)`, color: getTierColor(tier.tierType, tier.tierKey), tier };
  };

  const getStatusInfo = (status?: string) => STATUSES.find(s => s.value === status) || STATUSES[0];

  if (loading || tiersLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <PageHeader title="Location Subscription Management" description="Manage location subscription tiers and billing status" icon={Icons.Settings} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader title="Location Subscription Management" description="Manage location subscription tiers and billing status" icon={Icons.Settings} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <Alert variant="error" className="mb-6" onClose={() => setError(null)}>{error}</Alert>}

        <Card className="mb-6">
          <CardHeader><CardTitle>Subscription Tiers & Quick Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Subscription Tiers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {getTierOptions().map(tierOption => (
                    <div key={`${tierOption.value}-${tierOption.tier.id}`} className="p-4 border border-neutral-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">
                          {tierOption.value === 'google_only' && '🔍'}
                          {tierOption.value === 'starter' && '🥉'}
                          {tierOption.value === 'professional' && '🥈'}
                          {tierOption.value === 'enterprise' && '🥇'}
                          {tierOption.tier.tierType === 'organization' && '🏢'}
                        </span>
                        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${tierOption.color}`}>{tierOption.tier.displayName}</div>
                      </div>
                      <div className="text-sm text-neutral-600">
                        {tierOption.tier.maxSkus ? `${tierOption.tier.maxSkus.toLocaleString()} SKUs` : 'Unlimited SKUs'}
                        {tierOption.tier.maxLocations && `, ${tierOption.tier.maxLocations} locations`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Locations ({tenants.length})</CardTitle>
              {tenants.length > ITEMS_PER_PAGE && <div className="text-sm text-neutral-600">Page {currentPage} of {Math.ceil(tenants.length / ITEMS_PER_PAGE)}</div>}
            </div>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <div className="text-center py-12"><p className="text-neutral-500">No locations found</p></div>
            ) : (
              <>
                <div className="space-y-4">
                  {tenants.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(tenant => {
                    const tierInfo = getTierInfo(tenant.subscriptionTier);
                    const statusInfo = getStatusInfo(tenant.subscriptionStatus);
                    const isUpdating = updating === tenant.id;
                    return (
                      <div key={tenant.id} className="p-4 border border-neutral-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer relative group"
                        onClick={(e) => { if ((e.target as HTMLElement).closest('button, select')) return; window.location.href = `/tenants?id=${tenant.id}`; }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <div className="inline-block px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                                <h3 className="text-lg font-bold text-primary-900 dark:text-primary-100">{tenant.metadata?.businessName || tenant.name} <span className="text-primary-600">→</span></h3>
                              </div>
                              {tierInfo && <Badge variant="default" className={tierInfo.color}>{tierInfo.label}</Badge>}
                              <Badge variant="default" className={statusInfo.color}>{statusInfo.label}</Badge>
                              {tenant.organization && <Badge variant="default" className="bg-orange-100 text-orange-800">Chain: {tenant.organization.name}</Badge>}
                            </div>
                            <div className="text-sm text-neutral-600 space-y-1">
                              <p>ID: {tenant.id}</p>
                              {tenant.metadata?.city && tenant.metadata?.state && <p>Location: {tenant.metadata.city}, {tenant.metadata.state}</p>}
                              {tenant.trialEndsAt && <p>Trial Ends: {new Date(tenant.trialEndsAt).toLocaleDateString()}</p>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                            <div className="w-40">
                              <label className="text-xs font-medium text-neutral-700 mb-1 block">Subscription Tier</label>
                              <select value={tenant.subscriptionTier || 'starter'} onChange={(e) => updateTier(tenant.id, e.target.value, tenant.subscriptionStatus || 'active')} disabled={isUpdating}
                                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white disabled:opacity-50">
                                {getTierOptions().map(t => <option key={`${t.value}-${t.tier.id}`} value={t.value}>{t.tier.displayName} (${t.tier.priceMonthly}/mo)</option>)}
                              </select>
                            </div>
                            <div className="w-40">
                              <label className="text-xs font-medium text-neutral-700 mb-1 block">Status</label>
                              <select value={tenant.subscriptionStatus || 'active'} onChange={(e) => updateTier(tenant.id, tenant.subscriptionTier || 'starter', e.target.value)} disabled={isUpdating}
                                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white disabled:opacity-50">
                                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                            </div>
                            {isUpdating && <div className="flex items-center gap-2 text-xs text-primary-600"><svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Updating...</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {tenants.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-neutral-200">
                    <div className="text-sm text-neutral-600">Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, tenants.length)} of {tenants.length} tenants</div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>← Previous</Button>
                      {Array.from({ length: Math.ceil(tenants.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map(page => (
                        <Button key={page} variant={page === currentPage ? 'primary' : 'ghost'} size="sm" onClick={() => setCurrentPage(page)} className="min-w-[2.5rem]">{page}</Button>
                      ))}
                      <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(Math.ceil(tenants.length / ITEMS_PER_PAGE), p + 1))} disabled={currentPage === Math.ceil(tenants.length / ITEMS_PER_PAGE)}>Next →</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
