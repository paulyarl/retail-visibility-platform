"use client";

import { useState, useEffect, useCallback } from "react";
import { itemsDataService, Item, ItemFilters, ItemStats } from "@/services/itemsDataService";

// Keep status and visibility aligned with backend ItemFilters for now
export type ItemStatusFilter = "all" | "active" | "inactive" | "syncing";
export type ItemVisibilityFilter = "all" | "public" | "private";

interface UseTenantItemsOptions {
  tenantId: string;
  initialItems?: Item[];
  initialPage?: number;
  initialPageSize?: number;
  initialStatus?: ItemStatusFilter;
  initialVisibility?: ItemVisibilityFilter;
  initialSearch?: string;
  initialCategory?: string | null;
}

interface UseTenantItemsResult {
  // Data
  items: Item[];
  loading: boolean;
  error: string | null;

  // Storewide stats (not affected by filters/pagination)
  stats: ItemStats;

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

const defaultStats: ItemStats = {
  total: 0,
  active: 0,
  inactive: 0,
  syncing: 0,
  public: 0,
  private: 0,
  lowStock: 0,
};

export function useTenantItems(options: UseTenantItemsOptions): UseTenantItemsResult {
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

  const [items, setItems] = useState<Item[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ItemStats>(defaultStats);

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(initialItems.length);
  const [totalPages, setTotalPages] = useState(1);

  const [status, setStatus] = useState<ItemStatusFilter>(initialStatus);
  const [visibility, setVisibility] = useState<ItemVisibilityFilter>(initialVisibility);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState<string | null>(initialCategory);

  // Fetch storewide stats (independent of filters)
  const fetchStats = useCallback(async () => {
    if (!tenantId) return;
    try {
      const statsData = await itemsDataService.fetchStats(tenantId);
      setStats(statsData);
    } catch (err) {
      console.error("[useTenantItems] fetchStats failed:", err);
    }
  }, [tenantId]);

  const fetchItems = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const filters: ItemFilters = {
        q: search || undefined,
        status: status === "all" ? undefined : (status as ItemFilters["status"]),
        visibility: visibility === "all" ? undefined : (visibility as ItemFilters["visibility"]),
        // Use categoryFilter for assigned/unassigned, or categoryId for specific category
        categoryFilter: (category === 'assigned' || category === 'unassigned') ? category : undefined,
        categoryId: (category && category !== 'assigned' && category !== 'unassigned') ? category : undefined,
      };

      const { items, pagination } = await itemsDataService.fetchItems(tenantId, filters, {
        page,
        limit: pageSize,
      });

      setItems(items);
      setTotalItems(pagination.totalItems);
      setTotalPages(pagination.totalPages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load items";
      setError(msg);
      // eslint-disable-next-line no-console
      console.error("[useTenantItems] fetchItems failed:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, search, status, visibility, category, page, pageSize]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchItems(), fetchStats()]);
  }, [fetchItems, fetchStats]);

  // Fetch items when filters change
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Fetch stats on mount and when tenant changes
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
