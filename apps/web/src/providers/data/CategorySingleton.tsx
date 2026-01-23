/**
 * CategorySingleton Provider
 *
 * Provides category data management with intelligent caching and error handling.
 * Handles hierarchical category relationships and product counts.
 */

import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';

// ====================
// TYPES & INTERFACES
// ====================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  productCount: number;
  children?: Category[];
  parent?: Category;
  parentId?: string;
}

export interface CategoryState {
  categories: Category[];
  loading: boolean;
  error: string | null;
  lastFetch: Record<string, number>; // Cache timestamps
  cache: Map<string, { data: Category[]; timestamp: number }>;
}

export interface CategoryActions {
  fetchCategories: (options?: CategoryFetchOptions) => Promise<{ categories: Category[]; fromCache: boolean }>;
  getCategoryById: (id: string) => Category | undefined;
  getCategoryBySlug: (slug: string) => Category | undefined;
  getCategoriesByParent: (parentId: string | null) => Category[];
  getCategoryTree: () => Category[];
  clearCache: () => void;
}

export interface CategoryFetchOptions {
  includeChildren?: boolean;
  includeProductCount?: boolean;
  cacheTTL?: number;
  forceRefresh?: boolean;
}

type CategoryAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; categories: Category[]; cacheKey: string }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'CLEAR_CACHE' };

// ====================
// CONSTANTS
// ====================

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

// ====================
// REDUCER
// ====================

const initialState: CategoryState = {
  categories: [],
  loading: false,
  error: null,
  lastFetch: {},
  cache: new Map(),
};

function categoryReducer(state: CategoryState, action: CategoryAction): CategoryState {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        loading: true,
        error: null,
      };

    case 'FETCH_SUCCESS':
      const newCache = new Map(state.cache);
      newCache.set(action.cacheKey, {
        data: action.categories,
        timestamp: Date.now(),
      });

      return {
        ...state,
        categories: action.categories,
        loading: false,
        error: null,
        lastFetch: {
          ...state.lastFetch,
          [action.cacheKey]: Date.now(),
        },
        cache: newCache,
      };

    case 'FETCH_ERROR':
      return {
        ...state,
        loading: false,
        error: action.error,
      };

    case 'CLEAR_CACHE':
      return {
        ...state,
        cache: new Map(),
        lastFetch: {},
      };

    default:
      return state;
  }
}

// ====================
// CONTEXT
// ====================

const CategoryContext = createContext<{
  state: CategoryState;
  actions: CategoryActions;
} | null>(null);

// ====================
// HOOK
// ====================

export const useCategorySingleton = (): { state: CategoryState; actions: CategoryActions } => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategorySingleton must be used within CategoryProvider');
  }
  return context;
};

// ====================
// PROVIDER COMPONENT
// ====================

interface CategoryProviderProps {
  children: React.ReactNode;
}

export const CategoryProvider: React.FC<CategoryProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(categoryReducer, initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCategories = useCallback(async (
    options: CategoryFetchOptions = {}
  ): Promise<{ categories: Category[]; fromCache: boolean }> => {
    const {
      includeChildren = true,
      includeProductCount = true,
      cacheTTL = CACHE_TTL,
      forceRefresh = false,
    } = options;

    // Create cache key
    const cacheKey = `categories_${includeChildren}_${includeProductCount}`;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = state.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < cacheTTL) {
        return { categories: cached.data, fromCache: true };
      }
    }

    dispatch({ type: 'FETCH_START' });

    try {
      const params = new URLSearchParams();
      if (includeChildren) params.append('includeChildren', 'true');
      if (includeProductCount) params.append('includeProductCount', 'true');

      const response = await fetch(
        `${API_BASE_URL}/api/directory/categories?${params}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.data || !data.data.categories) {
        throw new Error('Invalid response format');
      }

      dispatch({
        type: 'FETCH_SUCCESS',
        categories: data.data.categories,
        cacheKey,
      });

      return { categories: data.data.categories, fromCache: false };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: 'FETCH_ERROR', error: errorMessage });
      throw error;
    }
  }, [state.cache]);

  const getCategoryById = useCallback((id: string): Category | undefined => {
    return state.categories.find(cat => cat.id === id);
  }, [state.categories]);

  const getCategoryBySlug = useCallback((slug: string): Category | undefined => {
    return state.categories.find(cat => cat.slug === slug);
  }, [state.categories]);

  const getCategoriesByParent = useCallback((parentId: string | null): Category[] => {
    return state.categories.filter(cat => cat.parentId === parentId);
  }, [state.categories]);

  const getCategoryTree = useCallback((): Category[] => {
    const categoryMap = new Map<string, Category>();

    // First pass: create map of all categories
    state.categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build hierarchy
    const rootCategories: Category[] = [];

    state.categories.forEach(cat => {
      const category = categoryMap.get(cat.id)!;

      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  }, [state.categories]);

  const clearCache = useCallback(() => {
    dispatch({ type: 'CLEAR_CACHE' });
  }, []);

  const actions: CategoryActions = {
    fetchCategories,
    getCategoryById,
    getCategoryBySlug,
    getCategoriesByParent,
    getCategoryTree,
    clearCache,
  };

  const value = {
    state,
    actions,
  };

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};

// ====================
// HOOK EXPORTS
// ====================

export default CategoryProvider;
