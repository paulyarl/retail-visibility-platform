'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Alert, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';

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
};

const TIERS = [
  { value: 'trial', label: 'Trial', color: 'bg-neutral-100 text-neutral-800' },
  { value: 'starter', label: 'Starter ($49/mo)', color: 'bg-blue-100 text-blue-800' },
  { value: 'professional', label: 'Professional ($149/mo)', color: 'bg-purple-100 text-purple-800' },
  { value: 'enterprise', label: 'Enterprise ($499/mo)', color: 'bg-amber-100 text-amber-800' },
];

const STATUSES = [
  { value: 'trial', label: 'Trial', color: 'bg-neutral-100 text-neutral-800' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'past_due', label: 'Past Due', color: 'bg-red-100 text-red-800' },
  { value: 'canceled', label: 'Canceled', color: 'bg-neutral-100 text-neutral-800' },
];

export default function AdminTiersPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tenants');
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

      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionTier: tier,
          subscriptionStatus: status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 404) {
          throw new Error(`Tenant not found on production server. This tenant may only exist locally.`);
        }
        throw new Error(data.message || data.error || 'Failed to update tier');
      }

      setSuccess(`Successfully updated tier for tenant`);
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
          description="Manage tenant subscription tiers and billing status"
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
            <CardTitle>Subscription Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {TIERS.map(tier => (
                <div key={tier.value} className="p-4 border border-neutral-200 rounded-lg">
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-2 ${tier.color}`}>
                    {tier.label}
                  </div>
                  <div className="text-sm text-neutral-600">
                    {tier.value === 'trial' && '30-day trial, all features'}
                    {tier.value === 'starter' && '500 SKUs, basic QR codes'}
                    {tier.value === 'professional' && '5,000 SKUs, branded QR codes'}
                    {tier.value === 'enterprise' && 'Unlimited SKUs, white-label'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <CardTitle>Tenants ({tenants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-500">No tenants found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tenants.map(tenant => {
                  const tierInfo = getTierInfo(tenant.subscriptionTier);
                  const statusInfo = getStatusInfo(tenant.subscriptionStatus);
                  const isUpdating = updating === tenant.id;

                  return (
                    <div
                      key={tenant.id}
                      className="p-4 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Tenant Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-neutral-900 truncate">
                              {tenant.metadata?.businessName || tenant.name}
                            </h3>
                            <Badge variant="default" className={tierInfo.color}>
                              {tierInfo.label}
                            </Badge>
                            <Badge variant="default" className={statusInfo.color}>
                              {statusInfo.label}
                            </Badge>
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
                                  onClick={() => updateTier(tenant.id, tier.value, tier.value === 'trial' ? 'trial' : 'active')}
                                  disabled={isUpdating}
                                >
                                  {tier.value === 'trial' && '🆓'}
                                  {tier.value === 'starter' && '🥉'}
                                  {tier.value === 'professional' && '🥈'}
                                  {tier.value === 'enterprise' && '🥇'}
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
                                  onClick={() => updateTier(tenant.id, tenant.subscriptionTier || 'trial', status.value)}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
