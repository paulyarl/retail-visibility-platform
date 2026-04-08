'use client';

import { useState, useEffect } from 'react';
import { Badge, Modal, ModalFooter, Input, Select, Spinner } from '@/components/ui';
import { Card, RingProgress, Text, Group, useMantineTheme, Button, Badge as MantineBadge } from '@mantine/core';
import TenantCard from './components/TenantCard';
import BillingPagination from './components/BillingPagination';
import BillingFilters from './components/BillingFilters';
import { useBillingData } from './hooks/useBillingData';
import { useBillingFilters } from './hooks/useBillingFilters';
import PageHeader, { Icons } from '@/components/PageHeader';
import { tenantTierService } from '@/services/TenantTierService';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function AdminBillingPage() {
  const [mounted, setMounted] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const theme = useMantineTheme();

  const { tenants, tiers, loading, tiersLoading, error: dataError, refetch } = useBillingData(refetchTrigger);

  const {
    searchQuery,
    setSearchQuery,
    selectedTierFilter,
    setSelectedTierFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    currentPage,
    setCurrentPage,
    paginatedTenants,
    stats,
    itemsPerPage,
    totalPages,
  } = useBillingFilters(tenants, tiers);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedTierFilter('all');
    setSelectedStatusFilter('all');
  };

  const updateTenant = async (tenantId: string, updates: { tier?: string; status?: string }) => {
    try {
      setUpdating(tenantId);
      setError(null);

      // Get current tenant data to preserve unchanged values
      const currentTenant = tenants.find(t => t.id === tenantId);
      if (!currentTenant) throw new Error('Tenant not found');

      const responseData = await tenantTierService.updateTenantTier(tenantId, {
        subscriptionTier: updates.tier || currentTenant.subscriptionTier || 'starter',
        subscriptionStatus: updates.status || currentTenant.subscriptionStatus || 'active',
        reason: 'Updated via billing page',
      });

      if (!responseData) throw new Error('Failed to update tenant');

      // Show success notification
      const tenantName = currentTenant.name;
      const changeType = updates.tier ? 'tier' : 'status';
      console.log(`Successfully updated ${changeType} for ${tenantName}`);

      // Refetch data to show updated values
      setRefetchTrigger(prev => prev + 1);
      
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update tenant';
      setError(errorMessage);
      console.error('Failed to update tenant:', err);
    } finally {
      setUpdating(null);
    }
  };

  return mounted ? (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Billing Dashboard"
        description="View SKU usage, limits, and billing status across all tenants"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="mt-6 space-y-6">
        <BillingFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTierFilter={selectedTierFilter}
          onTierFilterChange={setSelectedTierFilter}
          selectedStatusFilter={selectedStatusFilter}
          onStatusFilterChange={setSelectedStatusFilter}
          tiers={tiers}
          onClearFilters={handleClearFilters}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card withBorder padding="xl" radius="md" className="relative">
            <Card.Section className="p-6">
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600} size="lg">Tenant Capacity</Text>
                  <Text c="dimmed" size="sm">Platform utilization</Text>
                </div>
                <MantineBadge color={stats.totalTenants > 800 ? 'red' : stats.totalTenants > 500 ? 'orange' : 'green'} variant="light">
                  {stats.totalTenants > 800 ? "High" : stats.totalTenants > 500 ? "Medium" : "Healthy"}
                </MantineBadge>
              </Group>
              <Group align="flex-end" mb="md">
                <div>
                  <Text size="xl" fw={700} c="primary">{stats.totalTenants}</Text>
                  <Text c="dimmed" size="sm">of 1,000 capacity</Text>
                </div>
                <RingProgress size={60} thickness={8}
                  sections={[{ value: Math.min((stats.totalTenants / 1000) * 100, 100), color: stats.totalTenants > 800 ? 'red' : stats.totalTenants > 500 ? 'orange' : 'green' }]}
                  label={<Text ta="center" fz="xs" fw={600}>{Math.round((stats.totalTenants / 1000) * 100)}%</Text>}
                />
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">{1000 - stats.totalTenants} slots available</Text>
                <Text size="xs" c="dimmed">{stats.totalTenants} active</Text>
              </Group>
            </Card.Section>
          </Card>

          <Card withBorder padding="xl" radius="md" className="relative">
            <Card.Section className="p-6">
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600} size="lg">Search Results</Text>
                  <Text c="dimmed" size="sm">Filter effectiveness</Text>
                </div>
                <MantineBadge color={searchQuery ? 'blue' : 'gray'} variant="light">{searchQuery ? "Filtered" : "All"}</MantineBadge>
              </Group>
              <Group align="flex-end" mb="md">
                <div>
                  <Text size="xl" fw={700} c="primary">{stats.filteredCount}</Text>
                  <Text c="dimmed" size="sm">of {stats.totalTenants} total</Text>
                </div>
                <RingProgress size={60} thickness={8}
                  sections={[{ value: stats.totalTenants > 0 ? (stats.filteredCount / stats.totalTenants) * 100 : 0, color: 'blue' }]}
                  label={<Text ta="center" fz="xs" fw={600}>{stats.totalTenants > 0 ? Math.round((stats.filteredCount / stats.totalTenants) * 100) : 0}%</Text>}
                />
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">{searchQuery ? 'Active search' : 'No filters'}</Text>
                <Text size="xs" c="dimmed">{stats.totalTenants - stats.filteredCount} hidden</Text>
              </Group>
            </Card.Section>
          </Card>

          <Card withBorder padding="xl" radius="md" className="relative">
            <Card.Section className="p-6">
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600} size="lg">Tier Overview</Text>
                  <Text c="dimmed" size="sm">Subscription tiers</Text>
                </div>
                <MantineBadge color="green" variant="light">All Active</MantineBadge>
              </Group>
              <Group align="flex-end" mb="md">
                <div>
                  <Text size="xl" fw={700} c="primary">{tiers.length}</Text>
                  <Text c="dimmed" size="sm">configured tiers</Text>
                </div>
                <RingProgress size={60} thickness={8} sections={[{ value: 100, color: 'green' }]}
                  label={<Text ta="center" fz="xs" fw={600}>100%</Text>}
                />
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Platform ready</Text>
                <Text size="xs" c="dimmed">{tiers.length} tiers</Text>
              </Group>
            </Card.Section>
          </Card>
        </div>

        <Card withBorder padding="lg" radius="md">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedTierFilter === 'all' ? 'All Tenants' : `${tiers.find((t: { tierKey: string; displayName: string }) => t.tierKey === selectedTierFilter)?.displayName} Tenants`}
                </h3>
                {stats.filteredCount > 0 && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, stats.filteredCount)} of {stats.filteredCount}
                  </p>
                )}
              </div>
            </div>
            {loading || tiersLoading ? (
              <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
            ) : (error || dataError) ? (
              <div className="text-center py-12 text-red-600 dark:text-red-400">{error || dataError}</div>
            ) : paginatedTenants.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">No tenants found matching your filters.</div>
            ) : (
              <div className="space-y-3">
                {paginatedTenants.map((tenant: any) => (
                  <TenantCard 
                    key={`${tenant.id}-${tiers.length}`} 
                    tenant={tenant} 
                    tiers={tiers}
                    onUpdateTenant={updateTenant}
                    isUpdating={updating === tenant.id}
                  />
                ))}
              </div>
            )}
            <BillingPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} filteredCount={stats.filteredCount} itemsPerPage={itemsPerPage} />
          </div>
        </Card>
      </div>
    </div>
  ) : null;
}
