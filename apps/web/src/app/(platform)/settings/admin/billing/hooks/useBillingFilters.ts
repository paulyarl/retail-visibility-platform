import { useState, useEffect, useMemo } from 'react';
import { Tenant, DbTier, BillingStats } from '../types';

const ITEMS_PER_PAGE = 25;

interface UseBillingFiltersResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTierFilter: string;
  setSelectedTierFilter: (tier: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  filteredTenants: Tenant[];
  paginatedTenants: Tenant[];
  stats: BillingStats;
  itemsPerPage: number;
  totalPages: number;
}

export function useBillingFilters(tenants: Tenant[], tiers: DbTier[]): UseBillingFiltersResult {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTierFilter]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const matchesSearch =
        !searchQuery ||
        tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.organization?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${tenant.metadata?.city || ''} ${tenant.metadata?.state || ''}`.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTier = selectedTierFilter === 'all' || tenant.subscriptionTier === selectedTierFilter;
      return matchesSearch && matchesTier;
    });
  }, [tenants, searchQuery, selectedTierFilter]);

  const paginatedTenants = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTenants.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTenants, currentPage]);

  const stats = useMemo((): BillingStats => {
    const tierCounts: Record<string, number> = {};
    tenants.forEach((tenant) => {
      const tier = tenant.subscriptionTier || 'none';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });
    return { totalTenants: tenants.length, filteredCount: filteredTenants.length, tierCounts };
  }, [tenants, filteredTenants]);

  return {
    searchQuery,
    setSearchQuery,
    selectedTierFilter,
    setSelectedTierFilter,
    currentPage,
    setCurrentPage,
    filteredTenants,
    paginatedTenants,
    stats,
    itemsPerPage: ITEMS_PER_PAGE,
    totalPages: Math.ceil(filteredTenants.length / ITEMS_PER_PAGE),
  };
}
