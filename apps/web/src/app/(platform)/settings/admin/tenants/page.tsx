'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Alert, Spinner } from '@/components/ui';
import { Button, TextInput, Pagination, Group, Stack, Container } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';

type Tenant = {
  id: string;
  name: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  locationStatus?: string;
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
    subscriptionStatus?: string;
    subscriptionTier?: string;
  } | null;
};

const SUBSCRIPTION_STATUSES = [
  { value: 'trial', label: '🧪 Trial', color: 'bg-neutral-100 text-neutral-800' },
  { value: 'active', label: '💳 Active', color: 'bg-green-100 text-green-800' },
  { value: 'past_due', label: '⚠️ Past Due', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: '❌ Cancelled', color: 'bg-gray-100 text-gray-800' },
];

const LOCATION_STATUSES = [
  { value: 'active', label: '✅ Active', color: 'bg-green-100 text-green-800' },
  { value: 'pending', label: '🚧 Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'inactive', label: '⏸️ Inactive', color: 'bg-orange-100 text-orange-800' },
  { value: 'closed', label: '🔒 Closed', color: 'bg-red-100 text-red-800' },
  { value: 'archived', label: '📦 Archived', color: 'bg-gray-100 text-gray-800' },
];

const TIERS = [
  { value: 'discovery', label: '🔍 Discovery', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'commitment', label: '🤝 Commitment', color: 'bg-teal-100 text-teal-800' },
  { value: 'storefront', label: '🏪 Storefront', color: 'bg-lime-100 text-lime-800' },
  { value: 'starter', label: '🌱️ Starter', color: 'bg-blue-100 text-blue-800' },
  { value: 'professional', label: '👔 Professional', color: 'bg-purple-100 text-purple-800' },
  { value: 'enterprise', label: '🏢 Enterprise', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'custom', label: '⚙️ Custom', color: 'bg-amber-100 text-amber-800' },
];

const ITEMS_PER_PAGE = 20;

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Admin filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState<'all' | 'trial' | 'active' | 'past_due' | 'cancelled'>('all');
  const [locationFilter, setLocationFilter] = useState<'all' | 'active' | 'pending' | 'inactive' | 'closed' | 'archived'>('all');
  const [organizationFilter, setOrganizationFilter] = useState<'all' | 'chain' | 'standalone'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'discovery' | 'commitment' | 'storefront' | 'starter' | 'professional' | 'enterprise' | 'custom'>('all');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await platformHomeService.getTenants();
      setTenants(data || []);
    } catch (err) {
      setError("Failed to load tenants");
      console.error('Admin tenants page error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSubscriptionStatusInfo = (status?: string) => {
    return SUBSCRIPTION_STATUSES.find(s => s.value === status) || SUBSCRIPTION_STATUSES[1];
  };

  const getLocationStatusInfo = (status?: string) => {
    return LOCATION_STATUSES.find(s => s.value === (status || 'active')) || LOCATION_STATUSES[0];
  };

  // Subscription hierarchy logic - resolve conflicts between tenant and organization subscriptions
  const getEffectiveSubscriptionStatus = (tenant: Tenant) => {
    const tenantStatus = tenant.subscriptionStatus;
    const orgStatus = tenant.organization?.subscriptionStatus;
    
    // Priority 1: If tenant has active or cancelled subscription, use that (user's explicit choice)
    if (tenantStatus === 'active' || tenantStatus === 'cancelled') {
      return tenantStatus;
    }
    
    // Priority 2: If tenant is past due or trial, check if organization has better status
    if (tenantStatus === 'past_due' || tenantStatus === 'trial') {
      if (orgStatus === 'active') {
        return 'active'; // Inherit organization's active status
      }
    }
    
    // Priority 3: If both are past due, use tenant's status (more specific)
    if (tenantStatus === 'past_due' && orgStatus === 'past_due') {
      return tenantStatus;
    }
    
    // Priority 4: Default to tenant's status
    return tenantStatus || 'active';
  };

  const getSubscriptionTier = (tenant: Tenant) => {
    const tenantTier = tenant.subscriptionTier;
    const orgTier = tenant.organization?.subscriptionTier;
    
    // If tenant has a tier, use it (tenant can have higher tier than organization)
    if (tenantTier) {
      return tenantTier;
    }
    
    // Otherwise inherit organization's tier
    return orgTier || 'discovery';
  };

  // Filter tenants based on admin criteria
  const filteredTenants = useMemo(() => {
    let filtered = tenants;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(tenant => 
        tenant.name.toLowerCase().includes(query) || 
        tenant.id.toLowerCase().includes(query) ||
        tenant.metadata?.city?.toLowerCase().includes(query) ||
        tenant.organization?.name?.toLowerCase().includes(query)
      );
    }

    // Organization filter
    if (organizationFilter === 'chain') {
      filtered = filtered.filter(tenant => tenant.organization);
    } else if (organizationFilter === 'standalone') {
      filtered = filtered.filter(tenant => !tenant.organization);
    }

    // Subscription status filter - use effective status
    if (subscriptionFilter !== 'all') {
      filtered = filtered.filter(tenant => getEffectiveSubscriptionStatus(tenant) === subscriptionFilter);
    }

    // Location status filter
    if (locationFilter !== 'all') {
      filtered = filtered.filter(tenant => (tenant.locationStatus || 'active') === locationFilter);
    }

    // Tier filter - use effective tier
    if (tierFilter !== 'all') {
      filtered = filtered.filter(tenant => getSubscriptionTier(tenant) === tierFilter);
    }

    return filtered;
  }, [tenants, searchQuery, organizationFilter, subscriptionFilter, locationFilter, tierFilter]);

  // Pagination
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );
  const totalPages = Math.ceil(filteredTenants.length / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Platform Tenant Management"
        description="Comprehensive view of all platform tenants with advanced filtering"
        icon={Icons.Settings}
      />

      <div className="container mx-auto px-4 py-8">
        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        {/* Admin Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Admin Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap="md">
              {/* Search */}
              <div>
                <TextInput
                  placeholder="Search tenants by name, ID, city, or organization..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Filter Groups */}
              <Group wrap="wrap" gap="sm">
                {/* Organization Filter */}
                <Stack gap="xs">
                  <div className="text-sm font-medium">Organization Type</div>
                  <Group>
                    <Button
                      variant={organizationFilter === 'all' ? 'filled' : 'light'}
                      size="sm"
                      onClick={() => {
                        setOrganizationFilter('all');
                        setCurrentPage(1);
                      }}
                    >
                      All
                    </Button>
                    <Button
                      variant={organizationFilter === 'chain' ? 'filled' : 'light'}
                      size="sm"
                      onClick={() => {
                        setOrganizationFilter('chain');
                        setCurrentPage(1);
                      }}
                    >
                      🏢 Chain
                    </Button>
                    <Button
                      variant={organizationFilter === 'standalone' ? 'filled' : 'light'}
                      size="sm"
                      onClick={() => {
                        setOrganizationFilter('standalone');
                        setCurrentPage(1);
                      }}
                    >
                      🏪 Standalone
                    </Button>
                  </Group>
                </Stack>

                {/* Subscription Status Filter */}
                <Stack gap="xs">
                  <div className="text-sm font-medium">💳 Subscription Status</div>
                  <Group>
                    {SUBSCRIPTION_STATUSES.map(status => (
                      <Button
                        key={status.value}
                        variant={subscriptionFilter === status.value ? 'filled' : 'light'}
                        size="sm"
                        onClick={() => {
                          setSubscriptionFilter(status.value as any);
                          setCurrentPage(1);
                        }}
                      >
                        {status.label}
                      </Button>
                    ))}
                  </Group>
                </Stack>

                {/* Tier Filter */}
                <Stack gap="xs">
                  <div className="text-sm font-medium">🏆️ Subscription Tier</div>
                  <Group>
                    {TIERS.map(tier => (
                      <Button
                        key={tier.value}
                        variant={tierFilter === tier.value ? 'filled' : 'light'}
                        size="sm"
                        onClick={() => {
                          setTierFilter(tier.value as any);
                          setCurrentPage(1);
                        }}
                      >
                        {tier.label}
                      </Button>
                    ))}
                  </Group>
                </Stack>

                {/* Location Status Filter */}
                <Stack gap="xs">
                  <div className="text-sm font-medium">📍 Location Status</div>
                  <Group>
                    {LOCATION_STATUSES.map(status => (
                      <Button
                        key={status.value}
                        variant={locationFilter === status.value ? 'filled' : 'light'}
                        size="sm"
                        onClick={() => {
                          setLocationFilter(status.value as any);
                          setCurrentPage(1);
                        }}
                      >
                        {status.label}
                      </Button>
                    ))}
                  </Group>
                </Stack>
              </Group>

              {/* Results Summary */}
              <div className="text-sm text-neutral-600 border-t pt-4">
                Showing {paginatedTenants.length} of {filteredTenants.length} tenants 
                {filteredTenants.length !== tenants.length && ` (from ${tenants.length} total)`}
              </div>
            </Stack>
          </CardContent>
        </Card>

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Platform Tenants 
                <span className="ml-2 text-sm font-normal text-neutral-600">
                  ({filteredTenants.length} filtered)
                </span>
              </CardTitle>
              <Button onClick={loadTenants} variant="outline" size="sm">
                🔄 Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <Spinner size="lg" />
                <p className="text-neutral-500 mt-4">Loading tenants...</p>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-500">No tenants found matching the current filters</p>
                <Button onClick={() => {
                  setSearchQuery("");
                  setSubscriptionFilter('all');
                  setLocationFilter('all');
                  setOrganizationFilter('all');
                  setTierFilter('all');
                }} variant="outline" size="sm" className="mt-4">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedTenants.map(tenant => {
                    const effectiveStatus = getEffectiveSubscriptionStatus(tenant);
                    const effectiveStatusInfo = getSubscriptionStatusInfo(effectiveStatus);
                    const locationStatusInfo = getLocationStatusInfo(tenant.locationStatus);
                    const tenantTier = getSubscriptionTier(tenant);
                    const hasInheritedStatus = tenant.subscriptionStatus !== effectiveStatus;

                    return (
                      <div
                        key={tenant.id}
                        className="p-4 border border-neutral-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer relative group"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          window.location.href = `/tenants?id=${tenant.id}`;
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">{tenant.name}</h3>
                              
                              {/* Effective Subscription Status */}
                              <Badge className={effectiveStatusInfo.color}>
                                {effectiveStatusInfo.label}
                              </Badge>
                              
                              {/* Inheritance Indicator */}
                              {hasInheritedStatus && (
                                <Badge variant="outline" className="text-xs px-2 py-1">
                                  via {tenant.organization?.name}
                                </Badge>
                              )}
                              
                              {/* Location Status */}
                              <Badge className={locationStatusInfo.color}>
                                {locationStatusInfo.label}
                              </Badge>
                              
                              {/* Organization Badge */}
                              {tenant.organization && (
                                <Badge variant="outline">
                                  🏢 {tenant.organization.name}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="text-sm text-neutral-600 space-y-1">
                              <div className="flex items-center gap-4">
                                <span>ID: {tenant.id}</span>
                                {tenantTier && (
                                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                    {tenantTier}
                                  </span>
                                )}
                              </div>
                              
                              {tenant.metadata?.city && (
                                <div>📍 {tenant.metadata.city}, {tenant.metadata.state}</div>
                              )}
                              
                              <div className="flex items-center gap-4">
                                <span>📅 Created: {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'Unknown'}</span>
                                {tenant.trialEndsAt && (
                                  <span>🧪 Trial ends: {new Date(tenant.trialEndsAt).toLocaleDateString()}</span>
                                )}
                              </div>
                              
                              {/* Subscription Details - Show conflicts */}
                              {hasInheritedStatus && (
                                <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                  ⚠️ Status inherited from organization
                                  {tenant.subscriptionStatus && (
                                    <span className="ml-1">
                                      (was: {tenant.subscriptionStatus})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Link href={`/t/${tenant.id}`}>
                              <Button variant="outline" size="sm">
                                👁️ View Store
                              </Button>
                            </Link>
                            <Link href={`/settings/admin/tiers?tenant=${tenant.id}/dashboard`}>
                              <Button variant="outline" size="sm">
                                ⚙️ Manage
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center mt-6">
                    <Pagination
                      total={totalPages}
                      value={currentPage}
                      onChange={setCurrentPage}
                      size="sm"
                    />
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
