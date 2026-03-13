'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Alert, Spinner } from '@/components/ui';
import { Button } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';


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

const STATUSES = [
  { value: 'trial', label: 'Trial', color: 'bg-neutral-100 text-neutral-800' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'past_due', label: 'Past Due', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
];

const ITEMS_PER_PAGE = 10;

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await platformHomeService.getAdminTierTenants();
      
      // Use the admin tenants endpoint which includes tier information
      const tenantsArray = Array.isArray(data) ? data : [];
      const transformedTenants = tenantsArray.map((tenant: any) => ({
        id: tenant.id,
        name: tenant.name,
        subscriptionTier: tenant.subscription_tier, // Note: snake_case from API
        subscriptionStatus: tenant.subscription_status, // Note: snake_case from API
        trialEndsAt: tenant.trial_ends_at,
        subscriptionEndsAt: tenant.subscription_ends_at,
        createdAt: tenant.created_at,
        metadata: tenant.metadata,
        organization: tenant.organizations_list ? {
          id: tenant.organizations_list.id,
          name: tenant.organizations_list.name,
        } : null,
      }));
      
      setTenants(transformedTenants);
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
      setError(err.message || 'Failed to load tenants');
      setTenants([]); // Ensure tenants is always an array
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status?: string) => {
    return STATUSES.find(s => s.value === status) || STATUSES[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Tenant Management"
          description="Manage all platform tenants and their subscriptions"
          icon={Icons.Settings}
        />
        <div className="container mx-auto px-4 py-8">
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
        title="Tenant Management"
        description="Manage all platform tenants and their subscriptions"
        icon={Icons.Settings}
      />

      <div className="container mx-auto px-4 py-8">
        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tenants ({tenants.length})</CardTitle>
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
                <p className="text-neutral-500">No tenants found</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {tenants
                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                    .map(tenant => {
                      const statusInfo = getStatusInfo(tenant.subscriptionStatus);

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
                                {tenant.subscriptionTier && (
                                  <Badge variant="default" className="bg-blue-100 text-blue-800">
                                    {tenant.subscriptionTier}
                                  </Badge>
                                )}
                                <Badge variant="default" className={statusInfo.color}>
                                  {statusInfo.label}
                                </Badge>
                                {tenant.organization && (
                                  <Badge variant="default" className="bg-orange-100 text-orange-800 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.0 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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

                            {/* Quick Actions */}
                            <div className="flex-shrink-0 flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/tenants?id=${tenant.id}`;
                                }}
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Pagination */}
                {tenants.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-neutral-600">
                      Page {currentPage} of {Math.ceil(tenants.length / ITEMS_PER_PAGE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(tenants.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={currentPage === Math.ceil(tenants.length / ITEMS_PER_PAGE)}
                    >
                      Next
                    </Button>
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
