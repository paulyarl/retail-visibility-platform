import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

// Consolidated response from /api/items/complete
interface ItemsCompleteResponse {
  items: Array<{
    id: string;
    sku: string;
    name: string;
    description?: string;
    brand?: string;
    manufacturer?: string;
    condition?: 'new' | 'used' | 'refurbished';
    price: number | null;
    stock: number;
    status: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed';
    visibility: 'public' | 'private';
    categoryPath?: string[];
    tenantCategoryId?: string | null;
    tenantCategory?: {
      id: string;
      name: string;
      slug?: string;
      googleCategoryId?: string | null;
    };
    imageUrl?: string;
    images?: string[];
    metadata?: any;
    createdAt?: string;
    updatedAt?: string;
  }>;
  stats: {
    total: number;
    active: number;
    inactive: number;
    syncing: number;
    public: number;
    private: number;
    lowStock: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
  _timestamp: string;
}

// Keep status and visibility aligned with backend ItemFilters for now
export type ItemStatusFilter = "all" | "active" | "inactive" | "syncing";
export type ItemVisibilityFilter = "all" | "public" | "private";

interface UseItemsCompleteOptions {
  tenantId: string;
  initialItems?: ItemsCompleteResponse['items'];
  initialPage?: number;
  initialPageSize?: number;
  initialStatus?: ItemStatusFilter;
  initialVisibility?: ItemVisibilityFilter;
  initialSearch?: string;
  initialCategory?: string | null;
}

interface UseItemsCompleteResult {
  // Data
  items: ItemsCompleteResponse['items'];
  loading: boolean;
  error: string | null;

  // Storewide stats (not affected by filters/pagination)
  stats: ItemsCompleteResponse['stats'];

  // Pagination
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;

  // Filters
  status: ItemStatusFilter;
  visibility: ItemVisibilityFilter;
  search: string;
  category: string | null;

  // Setters
  setStatus: (status: ItemStatusFilter) => void;
  setVisibility: (visibility: ItemVisibilityFilter) => void;
  setSearch: (query: string) => void;
  setCategory: (category: string | null) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Actions
  refresh: () => Promise<void>;
}

/**
 * Advanced hook that fetches complete items data in a single consolidated API call
 * Replaces useTenantItems (2 separate calls) with 1 consolidated call
 * Pattern: API Consolidation for Frontend Optimization
 */
export function useItemsComplete(options: UseItemsCompleteOptions): UseItemsCompleteResult {
  const {
    tenantId,
    initialItems = [],
    initialPage = 1,
    initialPageSize = 25,
    initialStatus = "all",
    initialVisibility = "all",
    initialSearch = "",
    initialCategory = null,
  } = options;

  const [items, setItems] = useState<ItemsCompleteResponse['items']>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ItemsCompleteResponse['stats']>({
    total: 0,
    active: 0,
    inactive: 0,
    syncing: 0,
    public: 0,
    private: 0,
    lowStock: 0
  });

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(initialItems.length);
  const [totalPages, setTotalPages] = useState(1);

  const [status, setStatus] = useState<ItemStatusFilter>(initialStatus);
  const [visibility, setVisibility] = useState<ItemVisibilityFilter>(initialVisibility);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState<string | null>(initialCategory);

  const fetchItems = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        tenant_id: tenantId,
        page: page.toString(),
        limit: pageSize.toString(),
      });

      // Add filters
      if (search.trim()) params.append('q', search.trim());
      if (status !== "all") params.append('status', status);
      if (visibility !== "all") params.append('visibility', visibility);

      // Category filters - now server-side
      if (category) {
        if (category === 'assigned' || category === 'unassigned') {
          params.append('categoryFilter', category);
        } else {
          params.append('categoryId', category);
        }
      }

      console.log('[useItemsComplete] Fetching consolidated items data with params:', Object.fromEntries(params));

      const response = await api.get(`/api/items/complete?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[useItemsComplete] API error:', response.status, errorData);
        throw new Error(`Failed to fetch items: ${response.status} ${response.statusText}`);
      }

      const data: ItemsCompleteResponse = await response.json();

      console.log('[useItemsComplete] Received consolidated data:', {
        itemsCount: data.items.length,
        totalItems: data.pagination.totalItems,
        stats: data.stats
      });

      setItems(data.items);
      setStats(data.stats);
      setTotalItems(data.pagination.totalItems);
      setTotalPages(data.pagination.totalPages);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load items";
      setError(msg);
      console.error("[useItemsComplete] fetchItems failed:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, search, status, visibility, category, page, pageSize]);

  const refresh = useCallback(async () => {
    await fetchItems();
  }, [fetchItems]);

  // Fetch items when filters change
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSetPageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    items,
    loading,
    error,
    stats,
    page,
    pageSize,
    totalItems,
    totalPages,
    status,
    visibility,
    search,
    category,
    setStatus,
    setVisibility,
    setSearch,
    setCategory,
    setPage,
    setPageSize: handleSetPageSize,
    refresh,
  };
}
