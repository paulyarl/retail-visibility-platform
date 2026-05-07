/**
 * Directory Categories Singleton Hook
 * 
 * Provides access to category data through the CategorySingleton
 * with intelligent caching and error handling.
 */

import { useState, useEffect, useCallback } from 'react';
import { useCategorySingleton } from '@/providers/data/CategorySingleton';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  productCount: number;
  children?: Category[];
  parent?: Category;
}

export interface UseDirectoryCategoriesOptions {
  includeChildren?: boolean;
  includeProductCount?: boolean;
  cacheTTL?: number;
}

export interface UseDirectoryCategoriesReturn {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getCategoryBySlug: (slug: string) => Category | undefined;
  getCategoryTree: () => Category[];
  metrics: {
    cacheHits: number;
    cacheMisses: number;
    totalRequests: number;
    averageResponseTime: number;
  };
}

export const useDirectoryCategories = (
  options: UseDirectoryCategoriesOptions = {}
): UseDirectoryCategoriesReturn => {
  const {
    includeChildren = true,
    includeProductCount = true,
    cacheTTL = 15 * 60 * 1000, // 15 minutes
  } = options;

  const { actions } = useCategorySingleton();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localMetrics, setLocalMetrics] = useState({
    cacheHits: 0,
    cacheMisses: 0,
    totalRequests: 0,
    averageResponseTime: 0,
  });

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const startTime = Date.now();
    
    try {
      const result = await actions.fetchCategories({
        includeChildren,
        includeProductCount,
        cacheTTL,
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      setCategories(result.categories);
      
      // Update metrics
      setLocalMetrics(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
        cacheHits: result.fromCache ? prev.cacheHits + 1 : prev.cacheHits,
        cacheMisses: result.fromCache ? prev.cacheMisses : prev.cacheMisses + 1,
        averageResponseTime: (prev.averageResponseTime * prev.totalRequests + responseTime) / (prev.totalRequests + 1),
      }));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
      console.error('[useDirectoryCategories] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [actions, includeChildren, includeProductCount, cacheTTL]);

  const refetch = useCallback(() => {
    return fetchCategories();
  }, [fetchCategories]);

  const getCategoryBySlug = useCallback((slug: string): Category | undefined => {
    return categories.find(cat => cat.slug === slug);
  }, [categories]);

  const getCategoryTree = useCallback((): Category[] => {
    // Build hierarchical tree structure
    const categoryMap = new Map<string, Category>();
    
    // First pass: create map of all categories
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });
    
    // Second pass: build hierarchy
    const rootCategories: Category[] = [];
    
    categories.forEach(cat => {
      const category = categoryMap.get(cat.id)!;
      
      if (cat.parent) {
        const parent = categoryMap.get(cat.parent.id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });
    
    return rootCategories;
  }, [categories]);

  // Initial fetch
  useEffect(() => {
    fetchCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    categories,
    loading,
    error,
    refetch,
    getCategoryBySlug,
    getCategoryTree,
    metrics: localMetrics,
  };
};
