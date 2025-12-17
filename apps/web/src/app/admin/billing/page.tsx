'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useBillingData } from './hooks/useBillingData';
import { useBillingFilters } from './hooks/useBillingFilters';
import BillingFilters from './components/BillingFilters';
import TenantCard from './components/TenantCard';
import BillingPagination from './components/BillingPagination';

export default function AdminBillingPage() {
  const [mounted, setMounted] = useState(false);

  // Fetch data
  const { tenants, tiers, loading, tiersLoading, error } = useBillingData();

  // Manage filters and pagination
  const {
    searchQuery,
    setSearchQuery,
    selectedTierFilter,
    setSelectedTierFilter,
    currentPage,
    setCurrentPage,
    paginatedTenants,
    stats,
    itemsPerPage,
    totalPages,
  } = useBillingFilters(tenants, tiers);

  useEffect(() => {
    console.log('[Billing Page] Mounting on client');
    setMounted(true);
  }, []);

  // Log render state for debugging hydration
  console.log('[Billing Page] Render:', {
    mounted,
    loading,
    tiersLoading,
    tenantsCount: tenants.length,
    tiersCount: tiers.length,
    filteredCount: stats.filteredCount,
  });

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedTierFilter('all');
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
        {/* Search and Filter Bar */}
        <BillingFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTierFilter={selectedTierFilter}
          onTierFilterChange={setSelectedTierFilter}
          tiers={tiers}
          onClearFilters={handleClearFilters}
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {stats.totalTenants}
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Tenants</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {stats.filteredCount}
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Filtered Results</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {tiers.length}
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Active Tiers</div>
            </CardContent>
          </Card>
        </div>

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedTierFilter === 'all' 
                ? 'All Tenants' 
                : `${tiers.find(t => t.tierKey === selectedTierFilter)?.displayName} Tenants`}
            </CardTitle>
            {stats.filteredCount > 0 && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, stats.filteredCount)} of {stats.filteredCount}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {loading || tiersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-600 dark:text-red-400">
                {error}
              </div>
            ) : paginatedTenants.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
                No tenants found matching your filters.
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedTenants.map((tenant) => (
                  <TenantCard key={`${tenant.id}-${tiers.length}`} tenant={tenant} tiers={tiers} />
                ))}
              </div>
            )}

            {/* Pagination */}
            <BillingPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              filteredCount={stats.filteredCount}
              itemsPerPage={itemsPerPage}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  ) : null;
}
