/**
 * Enhanced FeaturedProductsManager Singleton with Universal Product Middleware Integration
 * 
 * This version integrates with the existing ProductProvider to create a seamless
 * producer-consumer flow between the admin manager and storefront display.
 */

import { useMemo, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

// Import existing ProductSingleton for universal product data
import { PublicProduct } from '@/providers/data/ProductSingleton';

// Import FeaturedType from the existing singleton
import { FeaturedType } from '@/providers/data/FeaturedProductsSingleton';

// Import the existing UniversalProduct interface
interface UniversalProduct {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  priceCents: number;
  salePriceCents?: number;
  stock: number;
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'discontinued';
  imageUrl?: string;
  hasGallery?: boolean;
  category?: { id: string; name: string; slug: string; };
  formattedPrice?: string;
  isOnSale?: boolean;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
}

// Featured product assignment (what the manager produces)
interface FeaturedAssignment {
  id: string;
  inventory_item_id: string;
  featured_type: string;
  featured_priority: number;
  featured_expires_at?: string;
  auto_unfeature?: boolean;
  is_active?: boolean;
  tenantId: string;
}

// Enhanced state that includes universal products
export interface EnhancedFeaturedProductsState {
  // Featured assignments (what we manage)
  featuredAssignments: Record<string, FeaturedAssignment[]>;
  
  // Universal product data (from ProductProvider)
  universalProducts: Record<string, UniversalProduct>;
  
  // Combined view (assignments + product data)
  featuredProducts: Record<string, (FeaturedAssignment & UniversalProduct)[]>;
  
  // Available products (not featured in current type)
  availableProducts: UniversalProduct[];
  
  // Original state
  featuredLimits: Record<string, number>;
  featuredTypes: FeaturedType[];
  
  // UI State
  isLoading: boolean;
  processing: boolean;
  searchQuery: string;
  selectedType: string;
  currentType: FeaturedType | null;
  availablePage: number;
  editingExpiration: string | null;
  expirationDate: string;
  togglingActive: boolean;
  forceUpdate: number;
}

class EnhancedTenantFeaturedProductsSingleton {
  private tenantId: string;
  private state: EnhancedFeaturedProductsState;
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  // ProductProvider integration
  private productProvider: any = null; // Will be injected or imported

  // Default featured types configuration
  private defaultFeaturedTypes: FeaturedType[] = [
    'store_selection',
    'new_arrival', 
    'seasonal',
    'sale',
    'staff_pick'
  ];

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.state = this.getInitialState();
  }

  private getInitialState(): EnhancedFeaturedProductsState {
    return {
      featuredAssignments: {},
      universalProducts: {},
      featuredProducts: {},
      availableProducts: [],
      featuredLimits: {},
      featuredTypes: [...this.defaultFeaturedTypes],
      isLoading: true,
      processing: false,
      searchQuery: '',
      selectedType: 'store_selection',
      currentType: null,
      availablePage: 1,
      editingExpiration: null,
      expirationDate: '',
      togglingActive: false,
      forceUpdate: 0
    };
  }

  // Integration with ProductProvider
  setProductProvider(productProvider: any) {
    this.productProvider = productProvider;
    
    // Subscribe to product updates
    if (productProvider?.subscribe) {
      return productProvider.subscribe(() => {
        this.syncWithProductProvider();
      });
    }
  }

  // Sync featured assignments with universal product data
  private syncWithProductProvider() {
    if (!this.productProvider) return;

    // Get all universal products for this tenant
    const universalProducts = this.productProvider.getProductsByTenant?.(this.tenantId) || {};
    
    // Combine assignments with product data
    const combinedFeaturedProducts: Record<string, (FeaturedAssignment & UniversalProduct)[]> = {};
    
    Object.entries(this.state.featuredAssignments).forEach(([typeId, assignments]) => {
      combinedFeaturedProducts[typeId] = assignments
        .map(assignment => {
          const universalProduct = universalProducts[assignment.inventory_item_id] as UniversalProduct;
          return universalProduct ? { ...assignment, ...universalProduct } : null;
        })
        .filter(Boolean) as (FeaturedAssignment & UniversalProduct)[];
    });

    // Update available products (exclude those already featured)
    const featuredProductIds = new Set(
      Object.values(this.state.featuredAssignments).flat().map(a => a.inventory_item_id)
    );
    
    const availableProducts = Object.values(universalProducts).filter(
      (product: any) => !featuredProductIds.has(product.id) && product.tenantId === this.tenantId
    ) as UniversalProduct[];

    this.setState({
      universalProducts,
      featuredProducts: combinedFeaturedProducts,
      availableProducts
    });
  }

  // Enhanced data fetching that works with ProductProvider
  async fetchFeaturedAssignments() {
    try {
      const response = await apiRequest(`/api/featured-products/management?tenantId=${this.tenantId}&_t=${Date.now()}`);
      const data = await response.json();
      
      if (data && typeof data === 'object') {
        this.setState({ featuredAssignments: data });
        this.syncWithProductProvider(); // Sync after fetching assignments
      }
    } catch (error) {
      console.error('Error fetching featured assignments:', error);
      this.setState({ featuredAssignments: {} });
    }
  }

  // Enhanced featuring that updates both assignment and notifies ProductProvider
  async featureProduct(productId: string) {
    this.setState({ processing: true });
    
    try {
      const defaultExpiration = new Date();
      defaultExpiration.setDate(defaultExpiration.getDate() + 30);
      
      const response = await apiRequest(`/api/items/${productId}/featured-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: this.tenantId,
          featured_type: this.state.selectedType,
          featured_priority: 50,
          featured_expires_at: defaultExpiration.toISOString(),
          auto_unfeature: true
        })
      });

      if (response.ok) {
        await this.fetchFeaturedAssignments();
        
        // Notify ProductProvider of the change
        if (this.productProvider?.invalidateCache) {
          this.productProvider.invalidateCache(productId);
        }
        
        // Trigger storefront revalidation
        this.triggerStorefrontRevalidation();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to feature product');
      }
    } catch (error) {
      console.error('Error featuring product:', error);
      throw error;
    } finally {
      this.setState({ processing: false });
    }
  }

  // Enhanced unfeaturing with ProductProvider integration
  async unfeatureProduct(productId: string) {
    this.setState({ processing: true });
    
    try {
      const response = await apiRequest(`/api/items/${productId}/featured-types/${this.state.selectedType}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await this.fetchFeaturedAssignments();
        
        // Notify ProductProvider of the change
        if (this.productProvider?.invalidateCache) {
          this.productProvider.invalidateCache(productId);
        }
        
        // Trigger storefront revalidation
        this.triggerStorefrontRevalidation();
      } else {
        throw new Error('Failed to unfeature product');
      }
    } catch (error) {
      console.error('Error unfeaturing product:', error);
      throw error;
    } finally {
      this.setState({ processing: false });
    }
  }

  // Trigger storefront revalidation when featured products change
  private async triggerStorefrontRevalidation() {
    try {
      // Revalidate storefront pages that display featured products
      await fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths: [
            `/t/${this.tenantId}`,
            `/directory/t/${this.tenantId}`,
            `/api/featured-products/public?tenantId=${this.tenantId}`
          ]
        })
      });
    } catch (error) {
      console.warn('Failed to trigger storefront revalidation:', error);
    }
  }

  // Get featured products in UniversalProduct format (for storefront consumption)
  getFeaturedProductsForStorefront(typeId?: string): UniversalProduct[] {
    const targetTypes = typeId ? [typeId] : Object.keys(this.state.featuredProducts);
    
    return targetTypes.flatMap(type => 
      this.state.featuredProducts[type] || []
    ).filter(product => 
      product.is_active !== false && 
      !this.isExpired(product)
    );
  }

  // Check if product is expired
  isExpired(product: FeaturedAssignment & UniversalProduct): boolean {
    if (!product.featured_expires_at) return false;
    
    const now = new Date();
    const expirationDate = new Date(product.featured_expires_at);
    return expirationDate < now;
  }

  // Public API for storefront consumption
  getPublicFeaturedData() {
    return {
      featuredProducts: this.getFeaturedProductsForStorefront(),
      featuredTypes: this.state.featuredTypes.map(type => {
        const typeInfo = this.getFeaturedTypeInfo(type);
        return {
          id: typeInfo.id,
          name: typeInfo.name,
          description: typeInfo.description,
          products: this.getFeaturedProductsForStorefront(type)
        };
      }),
      lastUpdated: Date.now()
    };
  }

  // Get featured type information
  getFeaturedTypeInfo(typeId: string) {
    const typeInfo = {
      staff_pick: {
        id: 'staff_pick',
        name: 'Staff Picks',
        description: 'Hand-picked favorites by your team'
      },
      seasonal: {
        id: 'seasonal',
        name: 'Seasonal Favorites',
        description: 'Seasonal product highlights'
      },
      sale: {
        id: 'sale',
        name: 'Sale Items',
        description: 'Products on sale or promotion'
      },
      new_arrival: {
        id: 'new_arrival',
        name: 'New Arrivals',
        description: 'Recently added products'
      },
      store_selection: {
        id: 'store_selection',
        name: 'Directory Featured',
        description: 'Premium placement in directory listings'
      }
    };
    
    return typeInfo[typeId as keyof typeof typeInfo] || typeInfo.store_selection;
  }

  // ... (rest of the singleton methods remain the same but work with enhanced state)
  
  private setState(updates: Partial<EnhancedFeaturedProductsState>) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    
    if (!this.initialized) {
      // Initialize the singleton
      this.initialized = true;
      this.fetchFeaturedAssignments();
    }
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): Readonly<EnhancedFeaturedProductsState> {
    return { ...this.state };
  }

  // ... (other methods like fetchFeaturedLimits, etc. remain the same)
}

// Enhanced hook that integrates with ProductProvider
export function useEnhancedTenantFeaturedProducts(
  tenantId: string,
  productProvider?: any
) {
  // Get singleton instance
  const singleton = useMemo(() => {
    const instance = getEnhancedTenantFeaturedProductsSingleton(tenantId);
    if (productProvider) {
      instance.setProductProvider(productProvider);
    }
    return instance;
  }, [tenantId, productProvider]);

  // Subscribe to state changes
  const state = singleton.getState();

  // Enhanced computed values that use UniversalProduct interface
  const currentFeatured = useMemo(() => 
    (state.featuredProducts[state.selectedType] || [])
      .filter(product => product.is_active !== false && !singleton.isExpired(product)),
    [state.featuredProducts, state.selectedType]
  );

  const activeFeatured = useMemo(() => 
    currentFeatured.filter(product => product.is_active !== false),
    [currentFeatured]
  );

  const expiredFeatured = useMemo(() => 
    (state.featuredProducts[state.selectedType] || [])
      .filter(product => singleton.isExpired(product) || product.is_active === false),
    [state.featuredProducts, state.selectedType]
  );

  // Enhanced filtering using UniversalProduct interface
  const filteredAvailable = useMemo(() => 
    state.availableProducts.filter(product =>
      product.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(state.searchQuery.toLowerCase())
    ),
    [state.availableProducts, state.searchQuery]
  );

  // Stock status using UniversalProduct interface
  const isOutOfStock = useCallback((product: UniversalProduct) => {
    return product.stock === 0 || product.availability === 'out_of_stock';
  }, []);

  // ... (rest of the hook implementation)

  return {
    // Enhanced state
    ...state,
    
    // Enhanced computed values
    currentFeatured,
    activeFeatured,
    expiredFeatured,
    filteredAvailable,
    
    // Actions
    featureProduct: (productId: string) => singleton.featureProduct(productId),
    unfeatureProduct: (productId: string) => singleton.unfeatureProduct(productId),
    
    // Enhanced methods
    getPublicFeaturedData: () => singleton.getPublicFeaturedData(),
    isOutOfStock,
    
    // ... (other methods)
  };
}

// Registry for enhanced singletons
const enhancedSingletonRegistry = new Map<string, EnhancedTenantFeaturedProductsSingleton>();

export function getEnhancedTenantFeaturedProductsSingleton(tenantId: string): EnhancedTenantFeaturedProductsSingleton {
  if (!enhancedSingletonRegistry.has(tenantId)) {
    enhancedSingletonRegistry.set(tenantId, new EnhancedTenantFeaturedProductsSingleton(tenantId));
  }
  return enhancedSingletonRegistry.get(tenantId)!;
}
