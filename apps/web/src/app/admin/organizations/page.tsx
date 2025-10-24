'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';

interface Organization {
  id: string;
  name: string;
  maxLocations: number;
  maxTotalSKUs: number;
  subscriptionTier: string;
  subscriptionStatus: string;
  tenants: Array<{
    id: string;
    name: string;
    _count: { items: number };
  }>;
  stats: {
    totalLocations: number;
    totalSKUs: number;
    utilizationPercent: number;
  };
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      setOrganizations(data);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Organizations"
          description="Loading..."
          icon={Icons.Settings}
          backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Organizations"
        description="Manage chain organizations and multi-location accounts"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="mt-6 space-y-6">
        {organizations.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-neutral-500">No organizations found</p>
                <p className="text-sm text-neutral-400 mt-2">
                  Use the test script to create demo organizations
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          organizations.map((org) => (
            <Card key={org.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{org.name}</CardTitle>
                    <p className="text-sm text-neutral-600 mt-1">ID: {org.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="default">{org.subscriptionTier}</Badge>
                    <Badge variant={org.subscriptionStatus === 'active' ? 'success' : 'default'}>
                      {org.subscriptionStatus}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <div className="text-sm text-neutral-600">Locations</div>
                    <div className="text-2xl font-bold text-neutral-900">
                      {org.stats.totalLocations} / {org.maxLocations}
                    </div>
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <div className="text-sm text-neutral-600">Total SKUs</div>
                    <div className="text-2xl font-bold text-neutral-900">
                      {org.stats.totalSKUs} / {org.maxTotalSKUs}
                    </div>
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <div className="text-sm text-neutral-600">Utilization</div>
                    <div className="text-2xl font-bold text-neutral-900">
                      {org.stats.utilizationPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-neutral-700">Locations:</h4>
                  {org.tenants.map((tenant) => (
                    <div
                      key={tenant.id}
                      className="flex items-center justify-between p-3 bg-neutral-50 rounded"
                    >
                      <span className="font-medium">{tenant.name}</span>
                      <Badge variant="default">{tenant._count.items} SKUs</Badge>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.location.href = `/settings/organization?organizationId=${org.id}`}
                  >
                    View Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
