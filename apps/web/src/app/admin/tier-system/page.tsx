'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Alert, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

interface Tier {
  id: string;
  tierKey: string;
  displayName: string;
  priceMonthly: number;
  maxSkus: number | null;
  maxLocations: number | null;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
  features?: string[];
  description?: string;
}

interface TierSystem {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  tiers: Tier[];
}

export default function TierSystemPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/admin/tier-system/tiers');
      const data = await response.json();
      
      if (response.ok) {
        setTiers(data.tiers || []);
      } else {
        setError(data.error || 'Failed to load tiers');
      }
    } catch (err) {
      console.error('Failed to load tiers:', err);
      setError('Failed to load tiers');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTier = async (tierId: string, isActive: boolean) => {
    try {
      setError(null);
      setSuccess(null);
      
      const response = await api.patch(`/api/admin/tier-system/tiers/${tierId}`, {
        isActive
      });
      
      if (response.ok) {
        setSuccess(`Tier ${isActive ? 'activated' : 'deactivated'} successfully`);
        loadTiers(); // Reload to show updated state
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update tier');
      }
    } catch (err) {
      console.error('Failed to toggle tier:', err);
      setError('Failed to update tier');
    }
  };

  const getTierTypeColor = (tierType: string) => {
    switch (tierType) {
      case 'free':
        return 'bg-gray-100 text-gray-800';
      case 'basic':
        return 'bg-blue-100 text-blue-800';
      case 'premium':
        return 'bg-purple-100 text-purple-800';
      case 'enterprise':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tier System Management"
        description="Manage subscription tiers and pricing"
        icon={Icons.Settings}
      />

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          {success}
        </Alert>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Subscription Tiers</CardTitle>
              <Button onClick={loadTiers} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tiers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No tiers configured
              </div>
            ) : (
              <div className="space-y-4">
                {tiers
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((tier) => (
                    <div
                      key={tier.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{tier.displayName}</h3>
                          <Badge className={getTierTypeColor(tier.tierType)}>
                            {tier.tierKey}
                          </Badge>
                          <Badge variant={tier.isActive ? 'success' : 'default'}>
                            {tier.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleToggleTier(tier.id, !tier.isActive)}
                            variant={tier.isActive ? 'destructive' : 'default'}
                            size="sm"
                          >
                            {tier.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </div>

                      {tier.description && (
                        <p className="text-gray-600 text-sm">{tier.description}</p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Price:</span>
                          <span className="ml-2">${tier.priceMonthly}/month</span>
                        </div>
                        <div>
                          <span className="font-medium">Max SKUs:</span>
                          <span className="ml-2">
                            {tier.maxSkus === null ? 'Unlimited' : tier.maxSkus.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Max Locations:</span>
                          <span className="ml-2">
                            {tier.maxLocations === null ? 'Unlimited' : tier.maxLocations.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Sort Order:</span>
                          <span className="ml-2">{tier.sortOrder}</span>
                        </div>
                      </div>

                      {tier.features && tier.features.length > 0 && (
                        <div>
                          <span className="font-medium text-sm">Features:</span>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {tier.features.map((feature, index) => (
                              <Badge key={index} variant="default" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-700">Total Tiers</div>
                <div className="text-2xl font-bold text-gray-900">{tiers.length}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="font-medium text-green-700">Active Tiers</div>
                <div className="text-2xl font-bold text-green-900">
                  {tiers.filter(t => t.isActive).length}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-700">Inactive Tiers</div>
                <div className="text-2xl font-bold text-gray-900">
                  {tiers.filter(t => !t.isActive).length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
