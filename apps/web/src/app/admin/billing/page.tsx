'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';

interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  metadata?: { city?: string; state?: string };
}

export default function AdminBillingPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const res = await fetch('/api/tenants');
      const data = await res.json();
      setTenants(data);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'trial': return 'bg-neutral-100 text-neutral-800';
      case 'starter': return 'bg-blue-100 text-blue-800';
      case 'professional': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-amber-100 text-amber-800';
      default: return 'bg-neutral-100 text-neutral-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Billing Dashboard"
          description="Loading..."
          icon={Icons.Settings}
          backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
        />
      </div>
    );
  }

  const summary = {
    total: tenants.length,
    trial: tenants.filter(t => t.subscriptionTier === 'trial').length,
    starter: tenants.filter(t => t.subscriptionTier === 'starter').length,
    professional: tenants.filter(t => t.subscriptionTier === 'professional').length,
    enterprise: tenants.filter(t => t.subscriptionTier === 'enterprise').length,
  };

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Billing Dashboard"
        description="View SKU usage, limits, and billing status across all tenants"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="mt-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-neutral-600">Total Tenants</div>
              <div className="text-3xl font-bold text-neutral-900">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-neutral-600">Trial</div>
              <div className="text-3xl font-bold text-neutral-900">{summary.trial}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-neutral-600">Starter</div>
              <div className="text-3xl font-bold text-blue-600">{summary.starter}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-neutral-600">Professional</div>
              <div className="text-3xl font-bold text-purple-600">{summary.professional}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-neutral-600">Enterprise</div>
              <div className="text-3xl font-bold text-amber-600">{summary.enterprise}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tenant List */}
        <Card>
          <CardHeader>
            <CardTitle>All Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-900">{tenant.name}</div>
                    {tenant.metadata?.city && tenant.metadata?.state && (
                      <div className="text-sm text-neutral-600">
                        {tenant.metadata.city}, {tenant.metadata.state}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className={getTierColor(tenant.subscriptionTier)}>
                      {tenant.subscriptionTier || 'trial'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
