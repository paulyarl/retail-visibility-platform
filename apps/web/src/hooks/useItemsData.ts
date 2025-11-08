import { useState, useEffect, useCallback, useMemo } from 'react';
import { itemsDataService, Item, ItemFilters, PaginationParams, ItemsResponse } from '@/services/itemsDataService';

interface UseItemsDataOptions {
  tenantId: string;
  initialItems?: Item[];
  autoLoad?: boolean;
}

interface UseItemsDataReturn {
  items: Item[];
  loading: boolean;
  error: string | null;
  pagination: ItemsResponse['pagination'];
  stats: ReturnType<typeof itemsDataService.calculateStats>;
  refresh: () => Promise<void>;
  loadPage: (page: number) => Promise<void>;
  setPageSize: (size: number) => void;
}

/**
 * Hook for managing items data
 * Handles fetching, pagination, and stats calculation
 */
export function useItemsData({
  tenantId,
  initialItems = [],
  autoLoad = true,
}: UseItemsDataOptions): UseItemsDataReturn {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<ItemsResponse['pagination']>({
    page: 1,
    limit: 25,
    totalItems: initialItems.length,
    totalPages: 1,
    hasMore: false,
  });
  const [currentFilters, setCurrentFilters] = useState<ItemFilters>({});
  const [pageSize, setPageSize] = useState(25);

  // Calculate stats from current items (memoized to prevent hydration issues)
  const stats = useMemo(() => itemsDataService.calculateStats(items), [items]);

  const fetchItems = useCallback(async (
    filters: ItemFilters = {},
    paginationParams: PaginationParams = { page: 1, limit: pageSize }
  ) => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await itemsDataService.fetchItems(
        tenantId,
        filters,
        paginationParams
      );

      setItems(response.items);
      setPagination(response.pagination);
      setCurrentFilters(filters);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load items';
      setError(errorMessage);
      console.error('[useItemsData] Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, pageSize]);

  const refresh = useCallback(async () => {
    await fetchItems(currentFilters, {
      page: pagination.page,
      limit: pagination.limit,
    });
  }, [fetchItems, currentFilters, pagination.page, pagination.limit]);

  const loadPage = useCallback(async (page: number) => {
    await fetchItems(currentFilters, {
      page,
      limit: pagination.limit,
    });
  }, [fetchItems, currentFilters, pagination.limit]);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    // Reset to page 1 when changing page size
    fetchItems(currentFilters, { page: 1, limit: size });
  }, [fetchItems, currentFilters]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && tenantId) {
      fetchItems();
    }
  }, [autoLoad, tenantId, fetchItems]);

  return {
    items,
    loading,
    error,
    pagination,
    stats,
    refresh,
    loadPage,
    setPageSize: handleSetPageSize,
  };
}
