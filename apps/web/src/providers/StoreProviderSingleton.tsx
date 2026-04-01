'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { storefrontService } from '@/services/StorefrontService';

// ====================
// STORE PROVIDER SINGLETON - CLIENT-SIDE IMPLEMENTATION
// ====================

// Client-side singleton options
interface ClientSingletonOptions {
  enableCache?: boolean;
  defaultTTL?: number;
  maxCacheSize?: number;
  enableLogging?: boolean;
}

// Authentication Context (simplified for client-side)
interface AuthContext {
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  roles?: string[];
  permissions?: string[];
  token?: string;
}

// Metrics interface
interface ClientMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  cacheSize: number;
  apiCalls: number;
  errors: number;
  lastUpdated: string;
}

class StoreProviderSingleton {
  private static instance: StoreProviderSingleton;
  private context: React.Context<any>;
  private ProviderComponent: React.ComponentType<{ children: ReactNode; initialData?: Record<string, any>; cacheTTL?: number }>;

  // Client-side caching
  private memoryCache: Map<string, { data: any; expires: number }> = new Map();
  private options: ClientSingletonOptions;
  private metrics: ClientMetrics;

  // Authentication context
  private currentAuthContext: AuthContext | null = null;

  constructor(options: ClientSingletonOptions = {}) {
    this.options = {
      enableCache: true,
      defaultTTL: 300, // 5 minutes
      maxCacheSize: 1000,
      enableLogging: true,
      ...options
    };

    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      cacheSize: 0,
      apiCalls: 0,
      errors: 0,
      lastUpdated: new Date().toISOString()
    };

    this.context = createContext<any>(undefined);
    this.ProviderComponent = this.createProviderComponent();
  }

  static getInstance(): StoreProviderSingleton {
    if (!(globalThis as any).__storeProviderSingletonInstance) {
      (globalThis as any).__storeProviderSingletonInstance = new StoreProviderSingleton();
    }
    return (globalThis as any).__storeProviderSingletonInstance;
  }

  // Client-side logging
  private logInfo(message: string, metadata?: any): void {
    if (this.options.enableLogging) {
      console.log(`[StoreProvider] INFO: ${message}`, metadata || '');
    }
  }

  private logError(message: string, error?: any): void {
    if (this.options.enableLogging) {
      console.error(`[StoreProvider] ERROR: ${message}`, error || '');
    }
  }

  // Authentication methods
  setAuthContext(authContext: AuthContext): void {
    this.currentAuthContext = authContext;
    this.logInfo('Authentication context set', { userId: authContext.userId, tenantId: authContext.tenantId });
  }

  getAuthContext(): AuthContext | null {
    return this.currentAuthContext;
  }

  // Client-side API request method
  private async makeAPIRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    // Add authentication headers if available
    const headers = new Headers(options.headers || {});

    if (this.currentAuthContext?.token) {
      headers.set('Authorization', `Bearer ${this.currentAuthContext.token}`);
    }

    if (this.currentAuthContext?.tenantId) {
      headers.set('X-Tenant-ID', this.currentAuthContext.tenantId);
    }

    const requestOptions: RequestInit = {
      ...options,
      headers
    };

    this.metrics.apiCalls++;

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      this.metrics.errors++;
      this.logError('API request error:', error);
      throw error;
    }
  }

  // Cache management
  private getFromCache<T>(key: string): T | null {
    if (!this.options.enableCache) return null;

    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      this.metrics.cacheHits++;
      return cached.data as T;
    }

    this.metrics.cacheMisses++;
    if (cached) this.memoryCache.delete(key); // Remove expired
    return null;
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    if (!this.options.enableCache) return;

    const expires = Date.now() + ((ttl || this.options.defaultTTL!) * 1000);
    this.memoryCache.set(key, { data, expires });
    this.metrics.cacheSize = this.memoryCache.size;
    this.updateMetrics();
  }

  private clearCache(key?: string): void {
    if (key) {
      this.memoryCache.delete(key);
    } else {
      this.memoryCache.clear();
    }
    this.metrics.cacheSize = this.memoryCache.size;
    this.updateMetrics();
  }

  private updateMetrics(): void {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? this.metrics.cacheHits / total : 0;
    this.metrics.lastUpdated = new Date().toISOString();
  }

  getMetrics(): ClientMetrics {
    return { ...this.metrics };
  }

  private createProviderComponent() {
    const contextRef = this.context; // Capture context reference
    const singletonRef = this; // Capture singleton reference

    return function StoreProviderWrapper({ children, initialData = {}, cacheTTL = 5 * 60 * 1000 }: { children: ReactNode; initialData?: Record<string, any>; cacheTTL?: number }) {
      const [state, dispatch] = useReducer(storeReducer, {
        stores: initialData,
        loading: {},
        errors: {},
        lastFetch: {}
      });

      // Make instance globally available
      useEffect(() => {
        (window as any).__storeProviderInstance = { state, dispatch };
        return () => {
          delete (window as any).__storeProviderInstance;
        };
      }, []);

      // Enhanced store fetching using client-side API methods
      const fetchStores = async (storeIds: string[]) => {
        // Filter out already cached stores
        const uncachedIds = storeIds.filter(id => {
          const store = state.stores[id];
          const lastFetch = state.lastFetch[id];
          const now = Date.now();
          
          // Return true if not cached or cache expired
          return !store || !lastFetch || (now - lastFetch) > cacheTTL;
        });

        if (uncachedIds.length === 0) {
          singletonRef.logInfo('All stores cached, skipping fetch');
          return;
        }

        singletonRef.logInfo(`Fetching ${uncachedIds.length} stores, ${storeIds.length - uncachedIds.length} cached`);
        
        dispatch({ type: 'FETCH_START', storeIds: uncachedIds });

        try {
          // Use StorefrontService for batch operations
          const stores = await storefrontService.getBatchStores(uncachedIds);
          
          // Transform API response to UniversalStore format
          const universalStores = stores.map((store: any) => ({
            id: store.id,
            tenantId: store.tenantId,
            name: store.name,
            slug: store.slug,
            description: store.description,
            address: store.address,
            city: store.city,
            state: store.state,
            zipCode: store.zipCode,
            country: store.country,
            latitude: store.latitude,
            longitude: store.longitude,
            logoUrl: store.logoUrl,
            bannerUrl: store.bannerUrl,
            website: store.website,
            phone: store.phone,
            email: store.email,
            businessHours: store.businessHours,
            primaryCategory: store.primaryCategory,
            categories: store.categories || [],
            ratingAvg: store.ratingAvg,
            ratingCount: store.ratingCount,
            rating1Count: store.rating1Count,
            rating2Count: store.rating2Count,
            rating3Count: store.rating3Count,
            rating4Count: store.rating4Count,
            rating5Count: store.rating5Count,
            verifiedPurchaseCount: store.verifiedPurchaseCount,
            lastReviewAt: store.lastReviewAt,
            totalProducts: store.totalProducts,
            totalInStock: store.totalInStock,
            uniqueCategories: store.uniqueCategories,
            isFeatured: store.isFeatured || false,
            featuredType: store.featuredType,
            featuredPriority: store.featuredPriority,
            subscriptionTier: store.subscriptionTier,
            subscriptionStatus: store.subscriptionStatus,
            directoryPublished: store.directoryPublished,
            organizationId: store.organizationId,
            organizationName: store.organizationName,
            metadata: store.metadata || {},
            createdAt: store.createdAt,
            updatedAt: store.updatedAt,
            // Computed fields
            formattedAddress: formatAddress(store.address, store.city, store.state, store.zipCode),
            ratingDisplay: formatRating(store.ratingAvg, store.ratingCount),
            hasRatings: !!store.ratingAvg && store.ratingCount > 0,
            hasCategories: !!(store.categories && store.categories.length > 0),
          }));

          dispatch({ type: 'FETCH_SUCCESS', stores: universalStores });
        } catch (error) {
          singletonRef.logError('Fetch error:', error);
          uncachedIds.forEach(id => {
            dispatch({ 
              type: 'FETCH_ERROR', 
              storeId: id, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          });
        }
      };

      // Enhanced stats fetching using client-side API methods
      const fetchStoreStats = async (storeIds: string[]) => {
        // Skip fetching if disabled
        if (process.env.NODE_ENV === 'development' && window.location.hostname === 'localhost') {
          singletonRef.logInfo(`[DEV] Skipping stats fetch for ${storeIds.length} stores`);
          return;
        }
        
        singletonRef.logInfo(`Fetching enhanced stats for ${storeIds.length} stores`);
        
        // Set loading state
        storeIds.forEach(id => {
          dispatch({ type: 'SET_LOADING', storeId: id, loading: true });
        });

        try {
          // Use StorefrontService for batch categories stats
          const results = await storefrontService.getBatchCategoriesStats('default', storeIds);
          
          // Update stores with enhanced stats
          results.forEach((result) => {
            if (result.success && state.stores[result.storeId]) {
              const stats = result.data;
              dispatch({
                type: 'UPDATE_STORE',
                storeId: result.storeId,
                updates: {
                  categories: stats.categories || [],
                  ratingAvg: stats.ratingAvg || 0,
                  ratingCount: stats.ratingCount || 0,
                  rating1Count: stats.rating1Count || 0,
                  rating2Count: stats.rating2Count || 0,
                  rating3Count: stats.rating3Count || 0,
                  rating4Count: stats.rating4Count || 0,
                  rating5Count: stats.rating5Count || 0,
                  verifiedPurchaseCount: stats.verifiedPurchaseCount || 0,
                  lastReviewAt: stats.lastReviewAt,
                  totalProducts: stats.totalProducts || 0,
                  totalInStock: stats.totalInStock || 0,
                  uniqueCategories: stats.uniqueCategories || 0,
                  hasRatings: !!stats.ratingAvg && stats.ratingCount > 0,
                  hasCategories: !!(stats.categories && stats.categories.length > 0),
                  ratingDisplay: formatRating(stats.ratingAvg, stats.ratingCount),
                }
              });
            }
          });
        } catch (error) {
          singletonRef.logError('Stats fetch error:', error);
          storeIds.forEach(id => {
            dispatch({ 
              type: 'FETCH_ERROR', 
              storeId: id, 
              error: error instanceof Error ? error.message : 'Stats fetch failed' 
            });
          });
        } finally {
          // Clear loading state
          storeIds.forEach(id => {
            dispatch({ type: 'SET_LOADING', storeId: id, loading: false });
          });
        }
      };

      // Helper functions
      const updateStore = (storeId: string, updates: any) => {
        dispatch({ type: 'UPDATE_STORE', storeId, updates });
      };

      const clearCache = (storeIds?: string[]) => {
        dispatch({ type: 'CLEAR_CACHE', storeIds });
      };

      const getStore = (storeId: string) => {
        return state.stores[storeId];
      };

      const getStores = (storeIds: string[]) => {
        return storeIds.map(id => state.stores[id]).filter(Boolean);
      };

      const isLoading = (storeId: string) => {
        return state.loading[storeId] || false;
      };

      const getError = (storeId: string) => {
        return state.errors[storeId];
      };

      // Authentication context methods
      const setAuthContext = (authContext: AuthContext) => {
        singletonRef.setAuthContext(authContext);
      };

      const getAuthContext = () => {
        return singletonRef.getAuthContext();
      };

      const value = {
        state,
        actions: {
          fetchStores,
          fetchStoreStats,
          updateStore,
          clearCache,
          getStore,
          getStores,
          isLoading,
          getError,
          setAuthContext,
          getAuthContext,
          // Expose client-side methods
          getMetrics: () => singletonRef.getMetrics(),
          clearAllCache: () => singletonRef.clearCache(),
        }
      };

      return (
        <contextRef.Provider value={value}>
          {children}
        </contextRef.Provider>
      );
    };
  }

  getContext() {
    return this.context;
  }

  getProvider() {
    return this.ProviderComponent;
  }

  // Global access method
  static getInstanceGlobal() {
    return (window as any).__storeProviderInstance;
  }
}

// ====================
// UNIVERSAL STORE INTERFACE
// ====================
export interface UniversalStore {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  bannerUrl?: string;
  website?: string;
  phone?: string;
  email?: string;
  businessHours?: any;
  hoursStatus?: {
    status: 'open' | 'closed' | 'opening_soon' | 'closing_soon';
    label: string;
    nextOpenTime?: string;
    nextCloseTime?: string;
  };
  primaryCategory?: string;
  categories?: Array<{
    id: string;
    name: string;
    slug: string;
    count: number;
    inStockProducts: number;
  }>;
  ratingAvg?: number;
  ratingCount?: number;
  rating1Count?: number;
  rating2Count?: number;
  rating3Count?: number;
  rating4Count?: number;
  rating5Count?: number;
  verifiedPurchaseCount?: number;
  lastReviewAt?: string | null;
  totalProducts?: number;
  totalInStock?: number;
  uniqueCategories?: number;
  isFeatured?: boolean;
  featuredType?: 'editorial' | 'popular' | 'new' | 'premium';
  featuredPriority?: number;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  directoryPublished?: boolean;
  organizationId?: string;
  organizationName?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  formattedAddress?: string;
  ratingDisplay?: string;
  hasRatings?: boolean;
  hasCategories?: boolean;
}

// ====================
// STATE MANAGEMENT
// ====================
interface StoreState {
  stores: Record<string, UniversalStore>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  lastFetch: Record<string, number>;
}

type StoreAction =
  | { type: 'FETCH_START'; storeIds: string[] }
  | { type: 'FETCH_SUCCESS'; stores: UniversalStore[] }
  | { type: 'FETCH_ERROR'; storeId: string; error: string }
  | { type: 'UPDATE_STORE'; storeId: string; updates: Partial<UniversalStore> }
  | { type: 'CLEAR_CACHE'; storeIds?: string[] }
  | { type: 'SET_LOADING'; storeId: string; loading: boolean };

function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'FETCH_START':
      const newLoading = { ...state.loading };
      action.storeIds.forEach(id => {
        newLoading[id] = true;
      });
      return { ...state, loading: newLoading };

    case 'FETCH_SUCCESS':
      const newStores = { ...state.stores };
      const updatedLoading = { ...state.loading };
      const newErrors = { ...state.errors };
      const newLastFetch = { ...state.lastFetch };
      
      action.stores.forEach(store => {
        newStores[store.id] = store;
        updatedLoading[store.id] = false;
        newErrors[store.id] = '';
        newLastFetch[store.id] = Date.now();
      });
      
      return { ...state, stores: newStores, loading: updatedLoading, errors: newErrors, lastFetch: newLastFetch };

    case 'FETCH_ERROR':
      return {
        ...state,
        loading: { ...state.loading, [action.storeId]: false },
        errors: { ...state.errors, [action.storeId]: action.error }
      };

    case 'UPDATE_STORE':
      return {
        ...state,
        stores: {
          ...state.stores,
          [action.storeId]: {
            ...state.stores[action.storeId],
            ...action.updates
          }
        }
      };

    case 'CLEAR_CACHE':
      if (action.storeIds) {
        const newStores = { ...state.stores };
        const newLastFetch = { ...state.lastFetch };
        action.storeIds.forEach(id => {
          delete newStores[id];
          delete newLastFetch[id];
        });
        return { ...state, stores: newStores, lastFetch: newLastFetch };
      }
      return { stores: {}, loading: {}, errors: {}, lastFetch: {} };

    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.storeId]: action.loading }
      };

    default:
      return state;
  }
}

// ====================
// PROVIDER COMPONENT
// ====================
interface StoreProviderProps {
  children: ReactNode;
  initialData?: Record<string, UniversalStore>;
  cacheTTL?: number;
  authContext?: AuthContext;
}

export function StoreProvider({ children, initialData = {}, cacheTTL = 5 * 60 * 1000, authContext }: StoreProviderProps) {
  const singleton = StoreProviderSingleton.getInstance();
  
  // Set authentication context if provided
  if (authContext) {
    singleton.setAuthContext(authContext);
  }
  
  const ProviderComponent = singleton.getProvider();
  return <ProviderComponent children={children} initialData={initialData} cacheTTL={cacheTTL} />;
}

// ====================
// HOOKS
// ====================
export function useStore() {
  const singleton = StoreProviderSingleton.getInstance();
  const context = useContext(singleton.getContext());
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}

export function useStoreData(storeId: string) {
  const context = useStore();
  const { getStore, isLoading, getError, fetchStores, fetchStoreStats } = context.actions;
  
  const store = getStore(storeId);
  const loading = isLoading(storeId);
  const error = getError(storeId);

  // Disable auto-fetching for now to prevent 404 errors
  // TODO: Implement proper store API endpoint
  // useEffect(() => {
  //   if (storeId && !store && !loading && !error) {
  //     fetchStores([storeId]);
  //   }
  // }, [storeId, store, loading, error]);

  return { store, loading: false, error: null };
}

export function useStoresData(storeIds: string[]) {
  const context = useStore();
  const { getStores, isLoading, getError, fetchStores, fetchStoreStats } = context.actions;
  
  const stores = getStores(storeIds);
  const loading = storeIds.some(id => isLoading(id));
  const error = storeIds.find(id => getError(id));

  useEffect(() => {
    const uncachedIds = storeIds.filter(id => !getStores([id]).length);
    if (uncachedIds.length > 0 && !loading) {
      fetchStores(uncachedIds);
    }
  }, [storeIds, loading]);

  // Auto-fetch enhanced stats when basic store data is available
  useEffect(() => {
    const storesNeedingStats = stores.filter((store: { categories: any; }) => store && !store.categories);
    if (storesNeedingStats.length > 0 && !loading) {
      const idsNeedingStats = storesNeedingStats.map((store: { id: any; }) => store.id);
      fetchStoreStats(idsNeedingStats);
    }
  }, [stores, loading]);

  return { stores, loading, error };
}

export function useStoreStats(storeId: string) {
  const context = useStore();
  const { getStore, isLoading, getError, fetchStoreStats } = context.actions;
  
  const store = getStore(storeId);
  const loading = isLoading(storeId);
  const error = getError(storeId);

  useEffect(() => {
    if (store && !store.categories && !loading && !error) {
      fetchStoreStats([storeId]);
    }
  }, [store, loading, error]);

  return { 
    stats: store ? {
      categories: store.categories || [],
      ratingAvg: store.ratingAvg || 0,
      ratingCount: store.ratingCount || 0,
      totalProducts: store.totalProducts || 0,
      totalInStock: store.totalInStock || 0,
      uniqueCategories: store.uniqueCategories || 0,
      hasRatings: store.hasRatings || false,
      hasCategories: store.hasCategories || false,
    } : null,
    loading,
    error
  };
}

// ====================
// GLOBAL ACCESS
// ====================
export function useStoreGlobal() {
  const instance = StoreProviderSingleton.getInstanceGlobal();
  if (!instance) {
    throw new Error('StoreProvider instance not found. Make sure StoreProvider is mounted in the component tree.');
  }
  
  return {
    state: instance.state,
    actions: {
      fetchStores: async (storeIds: string[]) => {
        throw new Error('Global access to fetchStores not available outside React context');
      },
      fetchStoreStats: async (storeIds: string[]) => {
        throw new Error('Global access to fetchStoreStats not available outside React context');
      },
      updateStore: (storeId: string, updates: Partial<UniversalStore>) => {
        instance.dispatch({ type: 'UPDATE_STORE', storeId, updates });
      },
      clearCache: (storeIds?: string[]) => {
        instance.dispatch({ type: 'CLEAR_CACHE', storeIds });
      },
      getStore: (storeId: string) => instance.state.stores[storeId],
      getStores: (storeIds: string[]) => {
        return storeIds.map(id => instance.state.stores[id]).filter(Boolean);
      },
      isLoading: (storeId: string) => instance.state.loading[storeId] || false,
      getError: (storeId: string) => instance.state.errors[storeId],
    }
  };
}

// ====================
// UTILITY FUNCTIONS
// ====================
function formatAddress(address?: string, city?: string, state?: string, zipCode?: string): string {
  const parts = [address, city, state, zipCode].filter(Boolean);
  return parts.join(', ');
}

function formatRating(ratingAvg?: number, ratingCount?: number): string {
  if (!ratingAvg || !ratingCount || ratingCount === 0) {
    return '';
  }
  return `${ratingAvg.toFixed(1)} (${ratingCount})`;
}
