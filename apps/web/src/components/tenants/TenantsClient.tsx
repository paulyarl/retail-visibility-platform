"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Alert, Modal, Stack, Group, Button, Text, Box } from "@mantine/core";
import { ContextBadges } from "@/components/ContextBadges";
import { SubscriptionStatusGuide } from "@/components/subscription/SubscriptionStatusGuide";
import ChangeLocationStatusModal from '@/components/tenant/ChangeLocationStatusModal';
import CreateTenantModal from './CreateTenantModal';
import { useTenantsData } from './useTenantsData';
import { TenantsHero } from './TenantsHero';
import { TenantsFilterRail, MobileFilterTrigger } from './TenantsFilterRail';
import { TenantsToolbar } from './TenantsToolbar';
import { TenantsResults } from './TenantsResults';
import { TenantsPagination } from './TenantsPagination';
import type { TenantItem, SortByValue, SortDirValue } from './types';

export default function TenantsClient({ initialTenants = [] }: { initialTenants?: TenantItem[] }) {
  const router = useRouter();
  const data = useTenantsData({ initialTenants });

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [statusModalTenant, setStatusModalTenant] = useState<TenantItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenantItem | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Auto-open create modal if onboarding data is present
  useEffect(() => {
    if (data.hasOnboardingData && !createModalOpen) {
      setCreateModalOpen(true);
    }
  }, [data.hasOnboardingData, createModalOpen]);

  const handleCreateModalClose = () => {
    setCreateModalOpen(false);
    data.clearOnboardingParams();
  };

  const openStatusModal = async (tenant: TenantItem) => {
    await data.refetch();
    setStatusModalTenant(tenant);
  };

  const handleStatusChange = () => {
    setStatusModalTenant(null);
    data.refetch();
  };

  const handleSort = useCallback(
    (field: SortByValue) => {
      if (data.sortBy === field) {
        data.setSortDir(data.sortDir === 'asc' ? 'desc' : 'asc');
      } else {
        data.setSortBy(field);
        data.setSortDir('desc' as SortDirValue);
      }
    },
    [data],
  );

  const activeFilterCount =
    (data.chainFilter !== 'all' ? 1 : 0) +
    (data.statusFilter !== 'all' ? 1 : 0) +
    (data.searchQuery ? 1 : 0) +
    (data.sortBy !== 'name' ? 1 : 0);

  const hasActiveFilters =
    activeFilterCount > 0 ||
    data.searchQuery !== '' ||
    data.chainFilter !== 'all' ||
    data.statusFilter !== 'all';

  const onSelect = (tenant: TenantItem) => {
    router.push(`/t/${encodeURIComponent(tenant.id)}/dashboard`);
  };

  const onViewItems = (tenant: TenantItem) => {
    router.push(`/t/${encodeURIComponent(tenant.id)}/items`);
  };

  const onEditProfile = (tenant: TenantItem) => {
    router.push(`/t/${encodeURIComponent(tenant.id)}/onboarding`);
  };

  const onViewStorefront = (tenant: TenantItem) => {
    window.open(`/tenant/${tenant.id}`, '_blank');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await data.onDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <TenantsHero
        totalCount={data.totalCount}
        chainCount={data.chainCount}
        standaloneCount={data.standaloneCount}
        activeCount={data.activeCount}
        loading={data.loading}
        searchQuery={data.searchQuery}
        setSearchQuery={data.setSearchQuery}
        onRefresh={() => data.refetch()}
        onCreateClick={() => setCreateModalOpen(true)}
        setChainFilter={data.setChainFilter}
        setStatusFilter={data.setStatusFilter}
        resetFilters={data.clearAllFilters}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {data.isViewingSpecificTenant && data.specificTenantId && (
          <SubscriptionStatusGuide tenantId={data.specificTenantId} />
        )}

        <ContextBadges showPlatformRole contextLabel="Tenants" />

        {data.error && (
          <Alert color="red" title="Error" className="mb-4">
            {data.error}
          </Alert>
        )}

        <div className="flex items-center gap-4 mb-4">
          <MobileFilterTrigger
            activeCount={activeFilterCount}
            onClick={() => setMobileFilterOpen(true)}
          />
        </div>

        <div className="flex gap-6">
          <TenantsFilterRail
            chainFilter={data.chainFilter}
            setChainFilter={data.setChainFilter}
            statusFilter={data.statusFilter}
            setStatusFilter={data.setStatusFilter}
            sortBy={data.sortBy}
            setSortBy={data.setSortBy}
            activeCount={activeFilterCount}
            clearAll={data.clearAllFilters}
            mobileOpen={mobileFilterOpen}
            setMobileOpen={setMobileFilterOpen}
          />

          <div className="flex-1 min-w-0">
            <TenantsToolbar
              filteredCount={data.filteredCount}
              currentPage={data.currentPage}
              pageSize={data.pageSize}
              viewMode={data.viewMode}
              setViewMode={data.setViewMode}
            />

            <TenantsResults
              tenants={data.paginatedTenants}
              viewMode={data.viewMode}
              loading={data.loading}
              hasActiveFilters={hasActiveFilters}
              hasTenants={data.totalCount > 0}
              sortBy={data.sortBy}
              sortDir={data.sortDir}
              onSort={handleSort}
              onClearFilters={data.clearAllFilters}
              onCreateClick={() => setCreateModalOpen(true)}
              getPermissions={data.getPermissions}
              onSelect={onSelect}
              onViewItems={onViewItems}
              onEditProfile={onEditProfile}
              onViewStorefront={onViewStorefront}
              onStatusChange={openStatusModal}
              onRename={data.onRename}
              onDelete={setDeleteTarget}
            />

            <TenantsPagination
              currentPage={data.currentPage}
              setCurrentPage={data.setCurrentPage}
              pageSize={data.pageSize}
              setPageSize={data.setPageSize}
              filteredCount={data.filteredCount}
            />
          </div>
        </div>
      </div>

      {statusModalTenant && (
        <ChangeLocationStatusModal
          tenantId={statusModalTenant.id}
          tenantName={statusModalTenant.name}
          initialStatus={statusModalTenant.locationStatus || 'active'}
          isOpen={true}
          onClose={() => setStatusModalTenant(null)}
          onStatusChanged={handleStatusChange}
        />
      )}

      <CreateTenantModal
        isOpen={createModalOpen}
        onClose={handleCreateModalClose}
        onCreate={data.onCreate}
        loading={data.loading}
        initialData={data.hasOnboardingData ? {
          name: data.onboardingName || '',
          phone: data.onboardingPhone || '',
          businessType: data.onboardingBusinessType || '',
        } : undefined}
      />

      {deleteTarget && (
        <Modal
          opened={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete Location"
          size="sm"
        >
          <Stack gap="md">
            <Alert color="yellow" title="Warning">
              This action cannot be undone. All data associated with this location will be permanently deleted.
            </Alert>
            <Box bg="gray.1" p="md" style={{ borderRadius: 8 }}>
              <Text size="sm" fw="500">{deleteTarget.name}</Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }} mt="xs">{deleteTarget.id}</Text>
            </Box>
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button color="red" onClick={confirmDelete}>
                Delete Location
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </div>
  );
}
