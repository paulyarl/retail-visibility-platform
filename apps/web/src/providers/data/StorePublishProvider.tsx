/**
 * Store Publish Provider
 * 
 * React context provider for store publishing functionality.
 * Manages state, caching, and real-time updates for published stores.
 */

'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import StorePublishSingleton, { 
  PublishedStore, 
  StorePublishData, 
  StorePublishOptions,
  DirectoryCategory 
} from './StorePublishSingleton';

// State Types
interface StorePublishState {
  stores: PublishedStore[];
  categories: DirectoryCategory[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  lastUpdated: string;
  filters: StorePublishOptions;
}

// Action Types
type StorePublishAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_STORES'; payload: { stores: PublishedStore[]; totalCount: number; lastUpdated: string } }
  | { type: 'SET_CATEGORIES'; payload: DirectoryCategory[] }
  | { type: 'UPDATE_FILTERS'; payload: StorePublishOptions }
  | { type: 'ADD_STORE'; payload: PublishedStore }
  | { type: 'UPDATE_STORE'; payload: PublishedStore }
  | { type: 'REMOVE_STORE'; payload: string }
  | { type: 'INVALIDATE_CACHE' };

// Initial State
const initialState: StorePublishState = {
  stores: [],
  categories: [],
  loading: false,
  error: null,
  totalCount: 0,
  lastUpdated: new Date().toISOString(),
  filters: {
    limit: 50,
    offset: 0,
    state: 'published',
    sortBy: 'publishedAt',
    sortOrder: 'desc'
  }
};

// Reducer
function storePublishReducer(state: StorePublishState, action: StorePublishAction): StorePublishState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_STORES':
      return { 
        ...state, 
        stores: action.payload.stores, 
        totalCount: action.payload.totalCount,
        lastUpdated: action.payload.lastUpdated,
        loading: false,
        error: null
      };
    
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    
    case 'UPDATE_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    
    case 'ADD_STORE':
      return { 
        ...state, 
        stores: [action.payload, ...state.stores],
        totalCount: state.totalCount + 1
      };
    
    case 'UPDATE_STORE':
      return {
        ...state,
        stores: state.stores.map(store => 
          store.id === action.payload.id ? action.payload : store
        )
      };
    
    case 'REMOVE_STORE':
      return {
        ...state,
        stores: state.stores.filter(store => store.id !== action.payload),
        totalCount: state.totalCount - 1
      };
    
    case 'INVALIDATE_CACHE':
      return { ...state, stores: [], totalCount: 0, lastUpdated: new Date().toISOString() };
    
    default:
      return state;
  }
}

// Context
interface StorePublishContextType extends StorePublishState {
  // Actions
  loadStores: (options?: StorePublishOptions) => Promise<void>;
  loadCategories: () => Promise<void>;
  publishStore: (storeId: string, storeData: Partial<PublishedStore>) => Promise<PublishedStore | null>;
  unpublishStore: (storeId: string) => Promise<boolean>;
  updateStore: (storeId: string, updates: Partial<PublishedStore>) => Promise<PublishedStore | null>;
  getStore: (storeId: string) => Promise<PublishedStore | null>;
  refreshStores: () => Promise<void>;
  setFilters: (filters: Partial<StorePublishOptions>) => void;
  
  // Utility methods
  getFeaturedStores: (limit?: number) => Promise<PublishedStore[]>;
  getTrendingStores: (limit?: number) => Promise<PublishedStore[]>;
  getStoresByCategory: (categoryId: string, limit?: number) => Promise<PublishedStore[]>;
  validatePublishingRequirements: (storeData: Partial<PublishedStore>) => { valid: boolean; errors: string[] };
  checkPublishingPermissions: (userId: string, tenantId?: string) => Promise<{ canPublish: boolean; canPublishAny: boolean; reason?: string }>;
}

const StorePublishContext = createContext<StorePublishContextType | undefined>(undefined);

// Provider Props
interface StorePublishProviderProps {
  children: ReactNode;
  tenantId?: string;
  autoLoad?: boolean;
  initialFilters?: StorePublishOptions;
}

// Provider Component
export function StorePublishProvider({ 
  children, 
  tenantId, 
  autoLoad = true,
  initialFilters = {}
}: StorePublishProviderProps) {
  const [state, dispatch] = useReducer(storePublishReducer, {
    ...initialState,
    filters: { ...initialState.filters, ...initialFilters }
  });

  const storePublishSingleton = StorePublishSingleton.getInstance();

  // Load stores
  const loadStores = async (options?: StorePublishOptions) => {
    if (!tenantId) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const mergedOptions = { ...state.filters, ...options };
      const data = await storePublishSingleton.getPublishedStores(mergedOptions);
      
      dispatch({ 
        type: 'SET_STORES', 
        payload: {
          stores: data.stores,
          totalCount: data.totalCount,
          lastUpdated: data.lastUpdated
        }
      });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to load stores' 
      });
    }
  };

  // Load categories
  const loadCategories = async () => {
    try {
      const categories = await storePublishSingleton.getDirectoryCategories();
      dispatch({ type: 'SET_CATEGORIES', payload: categories });
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  // Publish store
  const publishStore = async (storeId: string, storeData: Partial<PublishedStore>) => {
    try {
      const publishedStore = await storePublishSingleton.publishStore(storeId, storeData);
      
      if (publishedStore) {
        dispatch({ type: 'ADD_STORE', payload: publishedStore });
      }
      
      return publishedStore;
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to publish store' 
      });
      return null;
    }
  };

  // Unpublish store
  const unpublishStore = async (storeId: string) => {
    try {
      const success = await storePublishSingleton.unpublishStore(storeId);
      
      if (success) {
        dispatch({ type: 'REMOVE_STORE', payload: storeId });
      }
      
      return success;
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to unpublish store' 
      });
      return false;
    }
  };

  // Update store
  const updateStore = async (storeId: string, updates: Partial<PublishedStore>) => {
    try {
      const updatedStore = await storePublishSingleton.updatePublishedStore(storeId, updates);
      
      if (updatedStore) {
        dispatch({ type: 'UPDATE_STORE', payload: updatedStore });
      }
      
      return updatedStore;
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to update store' 
      });
      return null;
    }
  };

  // Get single store
  const getStore = async (storeId: string): Promise<PublishedStore | null> => {
    try {
      return await storePublishSingleton.getPublishedStore(storeId);
    } catch (error) {
      console.error('Failed to get store:', error);
      return null;
    }
  };

  // Refresh stores
  const refreshStores = async () => {
    dispatch({ type: 'INVALIDATE_CACHE' });
    await loadStores();
  };

  // Set filters
  const setFilters = (filters: Partial<StorePublishOptions>) => {
    dispatch({ type: 'UPDATE_FILTERS', payload: filters });
  };

  // Utility methods
  const getFeaturedStores = async (limit = 10) => {
    return await storePublishSingleton.getFeaturedStores(limit);
  };

  const getTrendingStores = async (limit = 10) => {
    return await storePublishSingleton.getTrendingStores(limit);
  };

  const getStoresByCategory = async (categoryId: string, limit = 20) => {
    return await storePublishSingleton.getStoresByCategory(categoryId, limit);
  };

  const validatePublishingRequirements = (storeData: Partial<PublishedStore>) => {
    return storePublishSingleton.validatePublishingRequirements(storeData);
  };

  const checkPublishingPermissions = async (userId: string, tenantId?: string) => {
    return await storePublishSingleton.checkPublishingPermissions(userId, tenantId);
  };

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && tenantId) {
      loadStores();
      loadCategories();
    }
  }, [tenantId, autoLoad]);

  // Reload when filters change
  useEffect(() => {
    if (autoLoad && tenantId) {
      loadStores();
    }
  }, [state.filters, tenantId, autoLoad]);

  const value: StorePublishContextType = {
    // State
    ...state,
    
    // Actions
    loadStores,
    loadCategories,
    publishStore,
    unpublishStore,
    updateStore,
    getStore,
    refreshStores,
    setFilters,
    
    // Utility methods
    getFeaturedStores,
    getTrendingStores,
    getStoresByCategory,
    validatePublishingRequirements,
    checkPublishingPermissions
  };

  return (
    <StorePublishContext.Provider value={value}>
      {children}
    </StorePublishContext.Provider>
  );
}

// Hook
export function useStorePublish() {
  const context = useContext(StorePublishContext);
  
  if (context === undefined) {
    throw new Error('useStorePublish must be used within a StorePublishProvider');
  }
  
  return context;
}

// Export for convenience
export { StorePublishContext };
export default StorePublishProvider;
