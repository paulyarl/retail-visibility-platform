'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

// ====================
// STORE INTERFACES
// ====================

export interface Store {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  logoUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
  productCount?: string;
  isFeatured?: boolean;
  distance?: number; // in km
  latitude?: number;
  longitude?: number;
  createdAt: string;
  
  // Rich data from storefront_products_mv joins
  actualProductCount?: number;
  featuredProductCount?: number;
  productsWithImages?: number;
  avgProductPrice?: number;
  productsWithReviews?: number;
  avgReviewRating?: number;
  activityLevel?: 'very_active' | 'active' | 'moderately_active' | 'less_active';
  
  // Featured type counts
  staffPickCount?: number;
  seasonalCount?: number;
  saleCount?: number;
  newArrivalCount?: number;
  storeSelectionCount?: number;
  
  // Additional fields
  phone?: string;
  email?: string;
  website?: string;
  primaryCategory?: string;
  subscriptionTier?: string;
  useCustomWebsite?: boolean;
  businessHours?: any;
  directoryPublished?: boolean;
  updatedAt?: string;
}

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  googleCategoryId?: string;
  level?: number;
}

// ====================
// STORE SINGLETON CLASS
// ====================

class StoreSingleton extends UniversalSingleton {
  private static instance: StoreSingleton;
  
  // Store data
  private stores = new Map<string, Store>();
  private categories = new Map<string, StoreCategory>();
  private featuredStores: Store[] = [];

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  static getInstance(): StoreSingleton {
    if (!StoreSingleton.instance) {
      StoreSingleton.instance = new StoreSingleton('store-singleton');
    }
    return StoreSingleton.instance;
  }
  
  // ====================
  // API METHODS
  // ====================
  
  private async makePublicRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    this.apiCalls++;
    
    const publicOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      }
    };
    
    const response = await fetch(url, publicOptions);
    
    if (!response.ok) {
      throw new Error(`Public API request failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  private handlePublicError(error: any): void {
    console.error('Public API error:', error);
  }
  
  // ====================
  // STORE-SPECIFIC METRICS
  // ====================
  
  protected getCustomMetrics(): Record<string, any> {
    return {
      cachedStores: this.stores.size,
      cachedCategories: this.categories.size,
      featuredStoresCount: this.featuredStores.length
    };
  }
  
  // ====================
  // STORE DATA METHODS
  // ====================

  async fetchFeaturedStores(location?: { lat: number; lng: number }, limit: number = 20): Promise<Store[]> {
    const cacheKey = `featured-stores-${location?.lat || 'default'}-${location?.lng || 'default'}-${limit}`;
    
    // Check cache first
    const cached = await this.getFromCache<Store[]>(cacheKey);
    if (cached) {
      this.featuredStores = cached;
      return cached;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      let url = `${apiUrl}/api/directory/featured-stores`;
      
      const params = new URLSearchParams();
      if (location && location.lat != null && location.lng != null) {
        params.append('lat', location.lat.toString());
        params.append('lng', location.lng.toString());
      }
      params.append('limit', limit.toString());
      
      const stores = await this.makePublicRequest<any>(`${url}?${params}`);
      
      // Extract stores from response
      const storesData = stores.data?.stores || stores;
      
      // Store in cache
      await this.setCache(cacheKey, storesData);
      
      // Update internal state
      this.featuredStores = storesData;
      storesData.forEach((store: Store) => {
        this.stores.set(store.id, store);
      });

      return storesData;
    } catch (error) {
      this.handlePublicError(error);
      throw error;
    }
  }

  async fetchStoreById(storeId: string): Promise<Store | null> {
    const cacheKey = `store-${storeId}`;
    
    // Check cache first
    const cached = await this.getFromCache<Store>(cacheKey);
    if (cached) {
      this.stores.set(storeId, cached);
      return cached;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const url = `${apiUrl}/api/directory/stores/${storeId}`;
      
      const response = await this.makePublicRequest<any>(url);

      if (!response.success || !response.data) {
        throw new Error('Store not found');
      }

      const store = response.data;
      
      // Store in cache
      await this.setCache(cacheKey, store);
      
      this.stores.set(storeId, store);
      
      return store;
    } catch (error) {
      this.handlePublicError(error);
      throw error;
    }
  }

  async fetchStoreCategories(): Promise<StoreCategory[]> {
    const cacheKey = 'store-categories';
    
    // Check cache first
    const cached = await this.getFromCache<StoreCategory[]>(cacheKey);
    if (cached) {
      this.categories.clear();
      cached.forEach((cat: StoreCategory) => {
        this.categories.set(cat.id, cat);
      });
      return cached;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const url = `${apiUrl}/api/directory/categories`;
      
      const response = await this.makePublicRequest<any>(url);

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch categories');
      }

      const categories = response.data;
      
      // Store in cache
      await this.setCache(cacheKey, categories);
      
      // Update internal state
      this.categories.clear();
      categories.forEach((cat: StoreCategory) => {
        this.categories.set(cat.id, cat);
      });

      return categories;
    } catch (error) {
      this.handlePublicError(error);
      throw error;
    }
  }

  // ====================
  // GETTERS
  // ====================

  getStore(storeId: string): Store | undefined {
    return this.stores.get(storeId);
  }

  getStores(storeIds: string[]): Store[] {
    return storeIds.map(id => this.stores.get(id)).filter(Boolean) as Store[];
  }

  getStoresByLocation(lat: number, lng: number, radiusKm: number = 50): Store[] {
    return this.featuredStores.filter(store => {
      if (!store.latitude || !store.longitude) return false;
      
      const distance = this.calculateDistance(lat, lng, store.latitude, store.longitude);
      return distance <= radiusKm;
    }).sort((a, b) => {
      const distanceA = this.calculateDistance(lat, lng, a.latitude!, a.longitude!);
      const distanceB = this.calculateDistance(lat, lng, b.latitude!, b.longitude!);
      return distanceA - distanceB;
    });
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  getFeaturedStores(): Store[] {
    return this.featuredStores;
  }

  getCategory(categoryId: string): StoreCategory | undefined {
    return this.categories.get(categoryId);
  }

  getCategories(): StoreCategory[] {
    return Array.from(this.categories.values());
  }

  clearAllCache(): void {
    this.stores.clear();
    this.categories.clear();
    this.featuredStores = [];
    this.clearCache(); // Use local method
  }
}

// ====================
// REACT CONTEXT
// ====================

interface StoreSingletonContextType {
  stores: Map<string, Store>;
  categories: Map<string, StoreCategory>;
  featuredStores: Store[];
  actions: {
    fetchFeaturedStores: (location?: { lat: number; lng: number }, limit?: number) => Promise<Store[]>;
    fetchStoreById: (storeId: string) => Promise<Store | null>;
    fetchStoreCategories: () => Promise<StoreCategory[]>;
    getStore: (storeId: string) => Store | undefined;
    getStores: (storeIds: string[]) => Store[];
    getStoresByLocation: (lat: number, lng: number, radiusKm?: number) => Store[];
    getFeaturedStores: () => Store[];
    getCategory: (categoryId: string) => StoreCategory | undefined;
    getCategories: () => StoreCategory[];
    getMetrics: () => any;
    clearAllCache: () => void;
  };
  isLoading: boolean;
  error: string | null;
}

const StoreSingletonContext = createContext<StoreSingletonContextType | null>(null);

interface StoreSingletonProviderProps {
  children: ReactNode;
}

export function StoreSingletonProvider({ children }: StoreSingletonProviderProps) {
  const [singleton] = useState(() => StoreSingleton.getInstance());
  const [stores, setStores] = useState<Map<string, Store>>(new Map());
  const [categories, setCategories] = useState<Map<string, StoreCategory>>(new Map());
  const [featuredStores, setFeaturedStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Make instance globally available
  useEffect(() => {
    (window as any).__storeSingletonInstance = singleton;
    return () => {
      delete (window as any).__storeSingletonInstance;
    };
  }, [singleton]);

  const actions = {
    fetchFeaturedStores: async (location?: { lat: number; lng: number }, limit?: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const stores = await singleton.fetchFeaturedStores(location, limit);
        setFeaturedStores(stores);
        return stores;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch featured stores');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },

    fetchStoreById: async (storeId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const store = await singleton.fetchStoreById(storeId);
        if (store) {
          setStores(prev => new Map(prev).set(storeId, store));
        }
        return store;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch store');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },

    fetchStoreCategories: async () => {
      setIsLoading(true);
      setError(null);
      try {
        const categories = await singleton.fetchStoreCategories();
        setCategories(new Map(categories.map(cat => [cat.id, cat])));
        return categories;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch categories');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },

    getStore: (storeId: string) => singleton.getStore(storeId),
    getStores: (storeIds: string[]) => singleton.getStores(storeIds),
    getStoresByLocation: (lat: number, lng: number, radiusKm?: number) => singleton.getStoresByLocation(lat, lng, radiusKm),
    getFeaturedStores: () => singleton.getFeaturedStores(),
    getCategory: (categoryId: string) => singleton.getCategory(categoryId),
    getCategories: () => singleton.getCategories(),
    getMetrics: () => singleton.getMetrics(),
    clearAllCache: () => {
      singleton.clearAllCache();
      setStores(new Map());
      setCategories(new Map());
      setFeaturedStores([]);
    }
  };

  const value: StoreSingletonContextType = {
    stores,
    categories,
    featuredStores,
    actions,
    isLoading,
    error
  };

  return (
    <StoreSingletonContext.Provider value={value}>
      {children}
    </StoreSingletonContext.Provider>
  );
}

export function useStoreSingleton(): StoreSingletonContextType {
  const context = useContext(StoreSingletonContext);
  if (!context) {
    throw new Error('useStoreSingleton must be used within StoreSingletonProvider');
  }
  return context;
}

// ====================
// CONVENIENCE HOOKS
// ====================

export function useFeaturedStores(location?: { lat: number; lng: number } | undefined, limit: number = 20) {
  const { actions } = useStoreSingleton();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchFromCache, setLastFetchFromCache] = useState(false);
  
  const loadStores = async () => {
    setLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      // Use the cached fetchFeaturedStores method which handles caching
      const fetchedStores = await actions.fetchFeaturedStores(location, limit);
      
      // Ensure no duplicates by using store ID as unique key
      const uniqueStores = Array.from(
        new Map(fetchedStores.map((store: Store) => [store.id, store])).values()
      ) as Store[];
      
      setStores(uniqueStores);
      
      // Check if this came from cache by looking at the metrics before and after
      const metricsBefore = actions.getMetrics();
      setTimeout(() => {
        const metricsAfter = actions.getMetrics();
        // If cache hits increased, the last fetch was from cache
        setLastFetchFromCache(metricsAfter.cacheHits > metricsBefore.cacheHits);
      }, 100);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch featured stores');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadStores();
  }, [location?.lat, location?.lng, limit]);
  
  // Calculate metrics from singleton
  const singletonMetrics = actions.getMetrics();
  const metrics = {
    cacheHits: singletonMetrics.cacheHits,
    cacheMisses: singletonMetrics.cacheMisses,
    totalRequests: singletonMetrics.cacheHits + singletonMetrics.cacheMisses,
    averageResponseTime: 0, // Could be calculated if needed
  };
  
  const refetch = () => loadStores();
  
  const getStoresByLocation = (lat: number, lng: number) => {
    return actions.getStoresByLocation(lat, lng);
  };
  
  return {
    stores,
    loading,
    error,
    refetch,
    getStoresByLocation,
    metrics,
    fromCache: lastFetchFromCache
  };
}

export function useStoreCategories() {
  const { actions } = useStoreSingleton();
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const fetchedCategories = await actions.fetchStoreCategories();
      setCategories(fetchedCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadCategories();
  }, []);
  
  return { categories, loading, error, refetch: loadCategories };
}

// Export singleton instance
export const storeSingleton = StoreSingleton.getInstance();
