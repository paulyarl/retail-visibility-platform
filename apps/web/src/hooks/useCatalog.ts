'use client';

// ====================
// CATALOG HOOK - Platform-Aligned Service Integration
// ====================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { storefrontService, type CatalogProduct, type Category, type ProductResponse } from '@/services/StorefrontService';

// Re-export types for use by components
export type { CatalogProduct, Category, ProductResponse };

interface UseCatalogOptions {
  tenantId: string;
  initialPage?: number;
  initialLimit?: number;
  initialCategory?: string;
  initialSearch?: string;
  initialSort?: 'featured' | 'newest' | 'price-low' | 'price-high' | 'rating';
}

interface UseCatalogReturn {
  // Data
  products: CatalogProduct[];
  categories: Category[];

  // Loading states
  loading: boolean;
  loadingCategories: boolean;

  // Pagination
  currentPage: number;
  totalPages: number;
  totalItems: number;

  // Filters
  selectedCategory: string;
  searchQuery: string;
  sortBy: 'featured' | 'newest' | 'price-low' | 'price-high' | 'rating';

  // Actions
  setPage: (page: number) => void;
  setCategory: (category: string) => void;
  setSearch: (query: string) => void;
  setSort: (sort: 'featured' | 'newest' | 'price-low' | 'price-high' | 'rating') => void;
  refreshData: () => void;

  // Error handling
  error: string | null;
  clearError: () => void;
}

export function useCatalog(options: UseCatalogOptions): UseCatalogReturn {
  const {
    tenantId,
    initialPage = 1,
    initialLimit = 24,
    initialCategory = '',
    initialSearch = '',
    initialSort = 'featured'
  } = options;

  const searchParams = useSearchParams();

  // State
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'price-low' | 'price-high' | 'rating'>(initialSort);

  // Initialize from URL params
  useEffect(() => {
    const page = searchParams.get('page');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort');

    if (page) setCurrentPage(parseInt(page));
    if (category) setSelectedCategory(category);
    if (search) setSearchQuery(search || '');
    if (sort) setSortBy(sort as any);
  }, [searchParams]);

  // Fetch products using StorefrontService
  const fetchProducts = useCallback(async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError(null);

      const filters = {
        page: currentPage,
        limit: initialLimit,
        ...(selectedCategory && { category: selectedCategory }),
        ...(searchQuery && { search: searchQuery }),
        ...(sortBy && { sort: sortBy }),
      };

      const response: ProductResponse = await storefrontService.getProducts(tenantId, filters);

      setProducts(response.items);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.totalItems);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(errorMessage);
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, currentPage, initialLimit, selectedCategory, searchQuery, sortBy]);

  // Fetch categories using StorefrontService
  const fetchCategories = useCallback(async () => {
    if (!tenantId) return;

    try {
      setLoadingCategories(true);
      const categoriesData: Category[] = await storefrontService.getCategories(tenantId);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Error fetching categories:', err);
      // Don't set error state for categories failure, just log it
    } finally {
      setLoadingCategories(false);
    }
  }, [tenantId]);

  // Fetch data when dependencies change
  useEffect(() => {
    if (tenantId) {
      fetchProducts();
      fetchCategories();
    }
  }, [tenantId, fetchProducts, fetchCategories]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (selectedCategory) params.set('category', selectedCategory);
    if (searchQuery) params.set('search', searchQuery);
    if (sortBy !== 'featured') params.set('sort', sortBy);

    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [currentPage, selectedCategory, searchQuery, sortBy]);

  // Actions
  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const setCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page when category changes
  }, []);

  const setSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when search changes
  }, []);

  const setSort = useCallback((sort: 'featured' | 'newest' | 'price-low' | 'price-high' | 'rating') => {
    setSortBy(sort);
    setCurrentPage(1); // Reset to first page when sort changes
  }, []);

  const refreshData = useCallback(() => {
    if (tenantId) {
      fetchProducts();
      fetchCategories();
    }
  }, [tenantId, fetchProducts, fetchCategories]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Memoized return value
  return useMemo(() => ({
    // Data
    products,
    categories,

    // Loading states
    loading,
    loadingCategories,

    // Pagination
    currentPage,
    totalPages,
    totalItems,

    // Filters
    selectedCategory,
    searchQuery,
    sortBy,

    // Actions
    setPage,
    setCategory,
    setSearch,
    setSort,
    refreshData,

    // Error handling
    error,
    clearError,
  }), [
    products,
    categories,
    loading,
    loadingCategories,
    currentPage,
    totalPages,
    totalItems,
    selectedCategory,
    searchQuery,
    sortBy,
    setPage,
    setCategory,
    setSearch,
    setSort,
    refreshData,
    error,
    clearError,
  ]);
}
