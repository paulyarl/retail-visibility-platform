import { useState, useCallback } from 'react';
import { Item } from '@/services/itemsDataService';
import { itemsDataService } from '@/services/itemsDataService';

export type StatusFilter = 'all' | 'active' | 'inactive' | 'syncing';
export type VisibilityFilter = 'all' | 'public' | 'private';
export type CategoryFilter = 'all' | 'assigned' | 'unassigned' | string;

interface UseItemsFiltersReturn {
  // Filter states
  searchQuery: string;
  statusFilter: StatusFilter;
  visibilityFilter: VisibilityFilter;
  categoryFilter: CategoryFilter;
  
  // Setters
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setVisibilityFilter: (filter: VisibilityFilter) => void;
  setCategoryFilter: (filter: CategoryFilter) => void;
  
  // Utilities
  clearFilters: () => void;
  applyClientFilters: (items: Item[]) => Item[];
  hasActiveFilters: boolean;
}

/**
 * Hook for managing items filters
 * Handles search, status, visibility, and category filtering
 */
export function useItemsFilters(): UseItemsFiltersReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setVisibilityFilter('all');
    setCategoryFilter('all');
  }, []);

  const applyClientFilters = useCallback((items: Item[]): Item[] => {
    let filtered = items;

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Apply visibility filter
    if (visibilityFilter !== 'all') {
      filtered = filtered.filter(item => item.visibility === visibilityFilter);
    }

    // Apply category filter
    filtered = itemsDataService.applyCategoryFilter(filtered, categoryFilter);

    return filtered;
  }, [searchQuery, statusFilter, visibilityFilter, categoryFilter]);

  const hasActiveFilters = 
    searchQuery !== '' ||
    statusFilter !== 'all' ||
    visibilityFilter !== 'all' ||
    categoryFilter !== 'all';

  return {
    searchQuery,
    statusFilter,
    visibilityFilter,
    categoryFilter,
    setSearchQuery,
    setStatusFilter,
    setVisibilityFilter,
    setCategoryFilter,
    clearFilters,
    applyClientFilters,
    hasActiveFilters,
  };
}
