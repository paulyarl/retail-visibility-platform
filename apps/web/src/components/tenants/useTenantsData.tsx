'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { Check, Trash2 } from 'lucide-react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { useAuth } from '@/contexts/AuthContext';
import {
  canEditTenant,
  canDeleteTenant,
  canRenameTenant,
} from '@/lib/auth/access-control';
import type { TenantCreationData } from './CreateTenantModal';
import type {
  TenantsData,
  TenantItem,
  TenantsViewMode,
  ChainFilterValue,
  StatusFilterValue,
  SortByValue,
  SortDirValue,
} from './types';

interface UseTenantsDataOptions {
  initialTenants?: TenantItem[];
}

export function useTenantsData(
  options: UseTenantsDataOptions = {},
): TenantsData {
  const { initialTenants = [] } = options;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [tenants, setTenants] = useState<TenantItem[]>(initialTenants);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const specificTenantId = searchParams?.get('id') ?? null;
  const isViewingSpecificTenant = !!specificTenantId;

  const onboardingName = searchParams?.get('onboarding_name') ?? null;
  const onboardingPhone = searchParams?.get('onboarding_phone') ?? null;
  const onboardingBusinessType =
    searchParams?.get('onboarding_business_type') ?? null;
  const hasOnboardingData = !!(
    onboardingName ||
    onboardingPhone ||
    onboardingBusinessType
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [chainFilter, setChainFilter] = useState<ChainFilterValue>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(
    'active',
  );

  const [sortBy, setSortBy] = useState<SortByValue>('name');
  const [sortDir, setSortDir] = useState<SortDirValue>('asc');

  const [viewMode, setViewMode] = useState<TenantsViewMode>('grid');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('tenants_view_mode');
      if (saved === 'grid' || saved === 'list') {
        setViewMode(saved as TenantsViewMode);
      }
      const savedPageSize = localStorage.getItem('tenants_page_size');
      if (savedPageSize) {
        const n = parseInt(savedPageSize, 10);
        if ([10, 25, 50, 100].includes(n)) setPageSize(n);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('tenants_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('tenants_page_size', String(pageSize));
    } catch {}
  }, [pageSize]);

  const fetchTenants = useCallback(
    async (includeArchived = false, statusParam?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await platformHomeService.getTenants();
        let filtered: TenantItem[] = result || [];

        if (result) {
          filtered = result.filter((tenant: TenantItem) => {
            const tenantStatus =
              tenant.status || tenant.subscriptionStatus || 'active';
            if (includeArchived && tenantStatus === 'archived') return true;
            if (!includeArchived && tenantStatus === 'archived') return false;
            if (statusParam && tenantStatus !== statusParam) return false;
            return true;
          });
        }

        setTenants(filtered);
      } catch {
        setError('Failed to load tenants');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (statusFilter === 'all') {
      await fetchTenants(true);
    } else if (statusFilter === 'archived') {
      await fetchTenants(true, 'archived');
    } else if (statusFilter === 'trial') {
      await fetchTenants(true);
    } else {
      await fetchTenants(false, statusFilter);
    }
  }, [statusFilter, fetchTenants]);

  useEffect(() => {
    fetchTenants(true);
  }, [fetchTenants]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, chainFilter, sortBy, sortDir]);

  const filteredTenants = useMemo(() => {
    let filtered = tenants;

    if (isViewingSpecificTenant && specificTenantId) {
      filtered = tenants.filter((t) => t.id === specificTenantId);
    }

    const query = searchQuery.trim().toLowerCase();
    filtered = filtered.filter((t) => {
      const matchesSearch =
        !query ||
        t.name.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query);
      const matchesChain =
        chainFilter === 'all' ||
        (chainFilter === 'chain' && t.organization) ||
        (chainFilter === 'standalone' && !t.organization);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'trial' && t.subscriptionStatus === 'trial') ||
        (statusFilter === 'active' &&
          ((t.locationStatus || 'active') === 'active' ||
            t.subscriptionStatus === 'trial')) ||
        ((statusFilter === 'pending' ||
          statusFilter === 'inactive' ||
          statusFilter === 'closed' ||
          statusFilter === 'archived') &&
          (t.locationStatus || 'active') === statusFilter);

      return matchesSearch && matchesChain && matchesStatus;
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          break;
        case 'createdAt':
          cmp =
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime();
          break;
        case 'items':
          cmp = (a._count?.items ?? 0) - (b._count?.items ?? 0);
          break;
        case 'users':
          cmp = (a._count?.users ?? 0) - (b._count?.users ?? 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [
    tenants,
    searchQuery,
    chainFilter,
    statusFilter,
    isViewingSpecificTenant,
    specificTenantId,
    sortBy,
    sortDir,
  ]);

  const paginatedTenants = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTenants.slice(startIndex, endIndex);
  }, [filteredTenants, currentPage, pageSize]);

  const totalCount = tenants.length;
  const filteredCount = filteredTenants.length;
  const chainCount = tenants.filter((t) => t.organization).length;
  const standaloneCount = tenants.filter((t) => !t.organization).length;
  const activeCount = tenants.filter(
    (t) =>
      (t.locationStatus || 'active') === 'active' ||
      t.subscriptionStatus === 'trial',
  ).length;

  const onCreate = useCallback(
    async (data: TenantCreationData) => {
      setLoading(true);
      setError(null);
      try {
        const responseData = await platformHomeService.createTenant({
          name: data.name.trim(),
          slug: data.slug || '',
          city: data.city,
          state: data.state,
          country_code: data.country_code,
        });

        if (!responseData) {
          throw new Error('Failed to create tenant');
        }

        const newTenant = responseData as TenantItem;

        setTenants((prev) => [...prev, newTenant]);

        setSearchQuery('');
        setChainFilter('all');
        setStatusFilter('active');
        setCurrentPage(1);

        refresh().catch(console.error);

        notifications.show({
          title: 'Location Created!',
          message: `${newTenant.name} has been added successfully.`,
          color: 'green',
          icon: <Check size={16} />,
          autoClose: 4000,
        });

        if (hasOnboardingData) {
          router.replace('/settings/profile');
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to create tenant',
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refresh, hasOnboardingData, router],
  );

  const onRename = useCallback(
    async (id: string, newName: string) => {
      if (!newName.trim()) return;
      const oldName = tenants.find((t) => t.id === id)?.name ?? '';
      try {
        const data = await platformHomeService.updateTenant(id, {
          name: newName.trim(),
        });
        if (data) {
          setTenants((prev) => prev.map((t) => (t.id === id ? data : t)));
          notifications.show({
            title: 'Location Renamed',
            message: `"${oldName}" has been renamed to "${newName.trim()}".`,
            color: 'blue',
            icon: <Check size={16} />,
            autoClose: 4000,
          });
        } else {
          setError('Failed to rename tenant');
        }
      } catch {
        setError('Failed to rename tenant');
      }
    },
    [tenants],
  );

  const onDelete = useCallback(
    async (id: string) => {
      const tenantName = tenants.find((t) => t.id === id)?.name ?? '';
      try {
        await platformHomeService.deleteTenant(id);
        setTenants((prev) => prev.filter((t) => t.id !== id));
        notifications.show({
          title: 'Location Deleted',
          message: `"${tenantName}" has been permanently removed.`,
          color: 'red',
          icon: <Trash2 size={16} />,
          autoClose: 4000,
        });
      } catch {
        setError('Failed to delete tenant');
      }
    },
    [tenants],
  );

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setChainFilter('all');
    setStatusFilter('all');
    setSortBy('name');
    setSortDir('asc');
    setCurrentPage(1);
  }, []);

  const clearOnboardingParams = useCallback(() => {
    if (!hasOnboardingData) return;
    if (typeof window === 'undefined') return;
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('onboarding_name');
    newUrl.searchParams.delete('onboarding_phone');
    newUrl.searchParams.delete('onboarding_business_type');
    router.replace(newUrl.pathname + newUrl.search, { scroll: false });
  }, [hasOnboardingData, router]);

  const getPermissions = useCallback(
    (tenantId: string) => ({
      canEdit: user ? canEditTenant(user, tenantId) : false,
      canDelete: user ? canDeleteTenant(user, tenantId) : false,
      canRename: user ? canRenameTenant(user, tenantId) : false,
    }),
    [user],
  );

  return {
    tenants,
    loading,
    error,
    specificTenantId,
    isViewingSpecificTenant,
    hasOnboardingData,
    onboardingName,
    onboardingPhone,
    onboardingBusinessType,
    searchQuery,
    setSearchQuery,
    chainFilter,
    setChainFilter,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    viewMode,
    setViewMode,
    filteredTenants,
    paginatedTenants,
    totalCount,
    filteredCount,
    chainCount,
    standaloneCount,
    activeCount,
    refetch: refresh,
    onCreate,
    onRename,
    onDelete,
    clearAllFilters,
    clearOnboardingParams,
    getPermissions,
  };
}
