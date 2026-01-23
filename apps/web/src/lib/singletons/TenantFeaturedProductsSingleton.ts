/**
 * Tenant Featured Products Singleton
 * 
 * Manages featured products state and operations for a specific tenant.
 * Integrates with existing ProductSingleton for universal product data.
 */

import { apiRequest } from '@/lib/api';

// Import existing ProductSingleton for universal product integration
import { PublicProduct } from '@/providers/data/ProductSingleton';

// Types
export interface FeaturedProduct {
  id?: string;
  inventory_item_id: string;
  name: string;
  sku: string;
  price_cents?: number;
  image_url?: string;
  featured_type?: string;
  featured_priority?: number;
  featured_expires_at?: string;
  auto_unfeature?: boolean;
  is_active?: boolean;
  stock?: number;
  availability?: string;
  has_variants?: boolean;
  product_type?: string;
  category_path?: string[];
  featuredTypes?: string[];
}

export interface FeaturedType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  maxProducts: number;
}

export interface FeaturedProductsState {
  // Data
  featuredProducts: Record<string, FeaturedProduct[]>;
  availableProducts: FeaturedProduct[];
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

class TenantFeaturedProductsSingleton {
  private tenantId: string;
  private state: FeaturedProductsState;
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  // ProductSingleton integration
  private productSingleton: any = null;

  // Default featured types configuration
  private defaultFeaturedTypes: FeaturedType[] = [
    {
      id: 'store_selection',
      name: 'Directory Featured',
      description: 'Premium placement in directory listings',
      icon: null, // Will be set in component
      color: 'blue',
      maxProducts: 8
    },
    {
      id: 'new_arrival',
      name: 'New Arrivals',
      description: 'Recently added products',
      icon: null,
      color: 'green',
      maxProducts: 12
    },
    {
      id: 'seasonal',
      name: 'Seasonal Favorites',
      description: 'Seasonal product highlights',
      icon: null,
      color: 'orange',
      maxProducts: 6
    },
    {
      id: 'sale',
      name: 'Sale Items',
      description: 'Products on sale or promotion',
      icon: null,
      color: 'red',
      maxProducts: 10
    },
    {
      id: 'staff_pick',
      name: 'Staff Picks',
      description: 'Hand-picked favorites by your team',
      icon: null,
      color: 'purple',
      maxProducts: 6
    }
  ];

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.state = this.getInitialState();
  }

  private getInitialState(): FeaturedProductsState {
    return {
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

  // State management
  private setState(updates: Partial<FeaturedProductsState>) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  // Public API for state subscription
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    
    // Initialize on first subscriber
    if (!this.initialized) {
      this.initialize();
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Get current state (read-only)
  getState(): Readonly<FeaturedProductsState> {
    return { ...this.state };
  }

  // Integration with existing ProductSingleton
  setProductProvider(productSingleton: any) {
    this.productSingleton = productSingleton;
    
    // Subscribe to product updates if available
    if (productSingleton?.subscribe) {
      return productSingleton.subscribe(() => {
        this.syncWithProductProvider();
      });
    }
  }

  // Sync featured assignments with universal product data
  private async syncWithProductProvider() {
    if (!this.productSingleton) return;

    try {
      // Get all universal products for this tenant from ProductSingleton
      const universalProducts = await this.productSingleton.getProductsByTenant?.(this.tenantId) || {};
      
      // Combine featured assignments with product data
      const combinedFeaturedProducts: Record<string, FeaturedProduct[]> = {};
      
      Object.entries(this.state.featuredProducts).forEach(([typeId, assignments]) => {
        combinedFeaturedProducts[typeId] = assignments
          .map(assignment => {
            const universalProduct = universalProducts[assignment.inventory_item_id];
            if (!universalProduct) return null;
            
            // Convert UniversalProduct to FeaturedProduct format
            return {
              ...assignment,
              name: universalProduct.name,
              sku: universalProduct.sku,
              price_cents: universalProduct.priceCents,
              image_url: universalProduct.imageUrl,
              stock: universalProduct.stock,
              availability: universalProduct.availability,
              has_variants: universalProduct.hasVariants,
              product_type: universalProduct.productType || 'physical'
            };
          })
          .filter(Boolean) as FeaturedProduct[];
      });

      // Update available products (exclude those already featured)
      const featuredProductIds = new Set(
        Object.values(this.state.featuredProducts).flat().map(a => a.inventory_item_id)
      );
      
      const availableProducts = Object.values(universalProducts)
        .filter((product: any) => !featuredProductIds.has(product.id))
        .map((universalProduct: any): FeaturedProduct => ({
          inventory_item_id: universalProduct.id,
          name: universalProduct.name,
          sku: universalProduct.sku,
          price_cents: universalProduct.priceCents,
          image_url: universalProduct.imageUrl,
          stock: universalProduct.stock,
          availability: universalProduct.availability,
          has_variants: universalProduct.hasVariants,
          product_type: universalProduct.productType || 'physical',
          featuredTypes: []
        }));

      this.setState({
        featuredProducts: combinedFeaturedProducts,
        availableProducts
      });
    } catch (error) {
      console.error('Error syncing with ProductProvider:', error);
    }
  }

  // Initialization
  private async initialize() {
    if (this.initialized) return;
    
    this.initialized = true;
    this.setState({ isLoading: true });

    try {
      await Promise.all([
        this.fetchFeaturedLimits(),
        this.fetchFeaturedProducts()
      ]);

      // Sync with ProductProvider after initialization
      if (this.productSingleton) {
        await this.syncWithProductProvider();
      }
    } catch (error) {
      console.error('Failed to initialize featured products:', error);
    } finally {
      this.setState({ isLoading: false });
    }
  }

  // Data fetching methods
  async fetchFeaturedLimits() {
    try {
      const response = await apiRequest(`/api/tenant-limits/featured-products?tenantId=${this.tenantId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Featured limits fetched:', { 
          tier: data.tier, 
          status: data.status,
          limits: data.limits 
        });
        
        this.setState({ featuredLimits: data.limits });
        
        // Update featuredTypes with actual limits
        const updatedTypes = this.state.featuredTypes.map(type => ({
          ...type,
          maxProducts: data.limits[type.id as keyof typeof data.limits] || type.maxProducts
        }));
        
        this.setState({ featuredTypes: updatedTypes });
        
        // Update currentType if needed
        const newCurrentType = updatedTypes.find(t => t.id === this.state.selectedType) || updatedTypes[0];
        this.setState({ currentType: newCurrentType });
      }
    } catch (error) {
      console.log('Featured limits not available, using defaults');
    }
  }

  async fetchFeaturedProducts() {
    try {
      const response = await apiRequest(`/api/featured-products/management?tenantId=${this.tenantId}&_t=${Date.now()}`);
      const data = await response.json();
      
      if (data && typeof data === 'object') {
        this.setState({ featuredProducts: data });
      } else {
        this.setState({ featuredProducts: {} });
      }
    } catch (error) {
      console.error('Error fetching featured products:', error);
      this.setState({ featuredProducts: {} });
    }
  }

  async fetchAvailableProducts() {
    // If ProductSingleton is available, use it instead of direct API call
    if (this.productSingleton) {
      await this.syncWithProductProvider();
      return;
    }

    // Fallback to direct API call
    try {
      const response = await apiRequest(`/api/items/complete?tenantId=${this.tenantId}&includeStock=true`);
      if (response.ok) {
        const data = await response.json();
        
        // Filter and process available products
        const availableProducts = data.filter((item: any) => 
          item.isActive && 
          !item.featuredTypes?.includes(this.state.selectedType)
        ).map((item: any): FeaturedProduct => ({
          inventory_item_id: item.id,
          name: item.name,
          sku: item.sku || '',
          price_cents: item.price_cents,
          image_url: item.imageUrl,
          stock: item.stock || 0,
          availability: item.availability || 'in_stock',
          has_variants: item.has_variants || false,
          product_type: item.product_type || 'physical',
          category_path: item.category_path || [],
          featuredTypes: item.featuredTypes || []
        }));

        this.setState({ availableProducts });
      }
    } catch (error) {
      console.error('Error fetching available products:', error);
      this.setState({ availableProducts: [] });
    }
  }

  // Action methods
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
        await Promise.all([
          this.fetchFeaturedProducts(),
          this.fetchAvailableProducts()
        ]);

        // Invalidate ProductSingleton cache for this product
        if (this.productSingleton?.invalidateCache) {
          this.productSingleton.invalidateCache(productId);
        }

        // Trigger storefront revalidation
        await this.triggerStorefrontRevalidation();
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

  async unfeatureProduct(productId: string) {
    this.setState({ processing: true });
    
    try {
      const response = await apiRequest(`/api/items/${productId}/featured-types/${this.state.selectedType}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Add delay to ensure database transaction commits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await Promise.all([
          this.fetchFeaturedProducts(),
          this.fetchAvailableProducts()
        ]);

        // Invalidate ProductSingleton cache for this product
        if (this.productSingleton?.invalidateCache) {
          this.productSingleton.invalidateCache(productId);
        }

        // Trigger storefront revalidation
        await this.triggerStorefrontRevalidation();
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

  async toggleProductActive(productId: string, isActive: boolean) {
    this.setState({ togglingActive: true });
    
    try {
      const response = await apiRequest(`/api/items/${productId}/featured-active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      });

      if (response.ok) {
        await this.fetchFeaturedProducts();
      } else {
        throw new Error('Failed to update product status');
      }
    } catch (error) {
      console.error('Error toggling product active status:', error);
      throw error;
    } finally {
      this.setState({ togglingActive: false });
    }
  }

  async updateProductExpiration(productId: string, expirationDate: string) {
    this.setState({ processing: true });
    
    try {
      const response = await apiRequest(`/api/items/${productId}/featured-expiration`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          featured_expires_at: new Date(expirationDate).toISOString(),
          auto_unfeature: true 
        })
      });

      if (response.ok) {
        await this.fetchFeaturedProducts();
        this.setState({ editingExpiration: null, expirationDate: '' });
      } else {
        throw new Error('Failed to update expiration');
      }
    } catch (error) {
      console.error('Error updating expiration:', error);
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

  // UI State setters
  setSelectedType(typeId: string) {
    this.setState({ 
      selectedType: typeId,
      availablePage: 1,
      currentType: this.state.featuredTypes.find(t => t.id === typeId) || null
    });
    
    // Refresh available products for new type
    this.fetchAvailableProducts();
  }

  setSearchQuery(query: string) {
    this.setState({ searchQuery: query, availablePage: 1 });
    // Debounced fetch would go here
    this.fetchAvailableProducts();
  }

  setAvailablePage(page: number) {
    this.setState({ availablePage: page });
  }

  setEditingExpiration(productId: string | null, date: string = '') {
    this.setState({ 
      editingExpiration: productId,
      expirationDate: date
    });
  }

  // Check if product is expired
  isExpired(product: FeaturedProduct): boolean {
    if (!product.featured_expires_at) return false;
    
    const now = new Date();
    const expirationDate = new Date(product.featured_expires_at);
    return expirationDate < now;
  }

  forceRefresh(): Promise<void> {
    this.setState({ forceUpdate: this.state.forceUpdate + 1 });
    return Promise.all([
      this.fetchFeaturedProducts(),
      this.fetchAvailableProducts()
    ]).then(() => {
      // Return void
    });
  }

  // Computed values
  get currentFeatured() {
    return this.state.featuredProducts[this.state.selectedType] || [];
  }

  get activeFeatured() {
    return this.currentFeatured.filter(product => product.is_active !== false);
  }

  get expiredFeatured() {
    return this.currentFeatured.filter(product => {
      const status = this.getExpirationStatus(product);
      return status.isExpired || product.is_active === false;
    });
  }

  get filteredAvailable() {
    return this.state.availableProducts.filter(p =>
      p.name.toLowerCase().includes(this.state.searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(this.state.searchQuery.toLowerCase())
    );
  }

  // Helper methods
  private getExpirationStatus(product: FeaturedProduct) {
    if (!product.featured_expires_at) {
      return { isExpired: false, daysRemaining: null, status: 'permanent' };
    }

    const now = new Date();
    const expirationDate = new Date(product.featured_expires_at);
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      isExpired: diffDays < 0,
      daysRemaining: diffDays,
      status: diffDays < 0 ? 'expired' : diffDays <= 7 ? 'expiring' : 'active'
    };
  }

  isOutOfStock(product: FeaturedProduct): boolean {
    return product.stock === 0 || product.availability === 'out_of_stock';
  }

  // Get public featured data for storefront consumption
  getPublicFeaturedData() {
    return {
      featuredProducts: this.getFeaturedProductsForStorefront(),
      featuredTypes: this.state.featuredTypes.map(type => ({
        id: type.id,
        name: type.name,
        products: this.getFeaturedProductsForStorefront(type.id)
      })),
      lastUpdated: Date.now()
    };
  }

  // Get featured products in PublicProduct format (for storefront consumption)
  getFeaturedProductsForStorefront(typeId?: string): FeaturedProduct[] {
    const targetTypes = typeId ? [typeId] : Object.keys(this.state.featuredProducts);
    
    return targetTypes.flatMap(type => 
      this.state.featuredProducts[type] || []
    ).filter(product => 
      product.is_active !== false && 
      !this.isExpired(product)
    );
  }

  // Cleanup
  destroy() {
    this.listeners.clear();
    this.initialized = false;
    this.state = this.getInitialState();
  }
}

// Singleton registry
const singletonRegistry = new Map<string, TenantFeaturedProductsSingleton>();

export function getTenantFeaturedProductsSingleton(tenantId: string): TenantFeaturedProductsSingleton {
  if (!singletonRegistry.has(tenantId)) {
    singletonRegistry.set(tenantId, new TenantFeaturedProductsSingleton(tenantId));
  }
  return singletonRegistry.get(tenantId)!;
}

export function destroyTenantFeaturedProductsSingleton(tenantId: string) {
  const singleton = singletonRegistry.get(tenantId);
  if (singleton) {
    singleton.destroy();
    singletonRegistry.delete(tenantId);
  }
}
