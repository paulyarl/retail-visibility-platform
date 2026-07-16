'use client';

import { useState, useEffect, useCallback } from 'react';
import { itemsService, ItemsCompleteResponse, ItemsStats, Item } from '@/services/ItemsSingletonService';
import { clientLogger } from '@/lib/client-logger';

function normalizeItem(raw: any): Item {
  return {
    ...raw,
    imageUrl: raw.imageUrl ?? raw.image_url ?? undefined,
    image_url: raw.image_url ?? raw.imageUrl ?? undefined,
    status: raw.status ?? raw.item_status ?? raw.itemStatus ?? 'active',
    itemStatus: raw.itemStatus ?? raw.item_status ?? raw.status ?? 'active',
    item_status: raw.item_status ?? raw.status ?? raw.itemStatus ?? 'active',
    tenantCategoryId: raw.tenantCategoryId ?? raw.directory_category_id ?? raw.tenant_category_id ?? null,
    directory_category_id: raw.directory_category_id ?? raw.tenantCategoryId ?? raw.tenant_category_id ?? null,
    categoryPath: raw.categoryPath ?? raw.category_path ?? undefined,
    category_path: raw.category_path ?? raw.categoryPath ?? undefined,
    price: raw.price ?? (raw.price_cents != null ? raw.price_cents / 100 : (raw.priceCents != null ? raw.priceCents / 100 : null)),
    price_cents: raw.price_cents ?? raw.priceCents ?? (raw.price != null ? Math.round(raw.price * 100) : undefined),
    tenantId: raw.tenantId ?? raw.tenant_id ?? undefined,
    tenant_id: raw.tenant_id ?? raw.tenantId ?? undefined,
  };
}

// Keep status and visibility aligned with backend ItemFilters for now
export type ItemStatusFilter = "all" | "active" | "inactive" | "syncing" | "draft" | "archived" | "trashed";
export type ItemVisibilityFilter = "all" | "public" | "private";

interface UseItemsCompleteOptions {
  tenantId: string;
  initialItems?: Item[];
  initialPage?: number;
  initialPageSize?: number;
  initialStatus?: ItemStatusFilter;
  initialVisibility?: ItemVisibilityFilter;
  initialSearch?: string;
  initialCategory?: string | null;
}

interface UseItemsCompleteResult {
  // Data
  items: Item[];
  loading: boolean;
  error: string | null;

  // Storewide stats (not affected by filters/pagination)
  stats: ItemsStats;

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
  updateItem: (itemId: string, updatedItem: Item) => void; // Update local state instantly
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
      // Build parameters for singleton service
      const params = {
        tenant_id: tenantId,
        page: page,
        limit: pageSize,
        ...(search.trim() && { q: search.trim() }),
        ...(status !== "all" && { status }),
        ...(visibility !== "all" && { visibility }),
        ...(category && (
          category === 'assigned' || category === 'unassigned' 
            ? { categoryFilter: category as 'assigned' | 'unassigned' }
            : { categoryId: category }
        )),
      };

      // Use singleton service instead of direct API call
      const data = await itemsService.getItemsComplete(params);

     /*  console.log('[useItemsComplete] fetchItems - service returned:', {
        tenantId,
        params,
        hasData: !!data,
        itemsCount: data?.items?.length || 0,
        totalItems: data?.stats?.total || 0,
        error: data ? null : 'Service returned null'
      }); */

      if (data) {
        setItems((data.items ?? []).map(normalizeItem));
        setStats(data.stats ?? {
          total: 0, active: 0, inactive: 0, syncing: 0, public: 0, private: 0, lowStock: 0
        });
        setTotalItems(data.pagination?.totalItems ?? data.stats?.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 1);

        /* console.log('[useItemsComplete] fetchItems - state updated:', {
          itemsCount: data.items.length,
          totalItems: data.stats.total,
          currentPage: page,
          totalPages: data.pagination.totalPages
        }); */
      } else {
        // Fallback to empty state if service fails
        setItems([]);
        setStats({
          total: 0,
          active: 0,
          inactive: 0,
          syncing: 0,
          public: 0,
          private: 0,
          lowStock: 0
        });
        setTotalItems(0);
        setTotalPages(1);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load items";
      setError(msg);
      clientLogger.error("[useItemsComplete] fetchItems failed:", { detail: err });
      
      // Set fallback state on error
      setItems([]);
      setStats({
        total: 0,
        active: 0,
        inactive: 0,
        syncing: 0,
        public: 0,
        private: 0,
        lowStock: 0
      });
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [tenantId, search, status, visibility, category, page, pageSize]);

  const refresh = useCallback(async () => {
    await fetchItems();
  }, [fetchItems]);

  // Update item in local state instantly
  const updateItem = useCallback((itemId: string, updatedItem: Item) => {
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId ? updatedItem : item
      )
    );
  }, []);

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
    updateItem,
  };
}
