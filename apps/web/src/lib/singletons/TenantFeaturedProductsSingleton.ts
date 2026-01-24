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
  inactivityReason?: string;
  reasonText?: string;
}

export interface Product {
  id: string;
  inventory_item_id: string;
  name: string;
  sku: string;
  price_cents: number;
  image_url: string | null;
  stock: number;
  availability: string;
  has_variants: boolean;
  product_type: string;
  category_path: string[];
  featuredTypes: string[];
  featured_at?: string;
  featured_expires_at?: string;
  featured_priority?: number;
  is_active?: boolean;
  inactivityReason?: string;
  reasonText?: string;
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
  inactiveProducts: FeaturedProduct[];
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
  
  // Setters
  setAvailablePage: (page: number) => void;
  setAvailableProducts: (products: FeaturedProduct[]) => void;
  setInactiveProducts: (products: FeaturedProduct[]) => void;
  setEditingExpiration: (productId: string | null, date?: string) => void;
  setSelectedType: (typeId: string) => void;
  setSearchQuery: (query: string) => void;
}

class TenantFeaturedProductsSingleton {
  private tenantId: string;
  private state: FeaturedProductsState;
  private listeners: Set<() => void> = new Set();
  private initialized = false;
  private tenantTier: string = 'starter';

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

  // Fetch tier limits (using tenant-specific API endpoint)
  async fetchTierLimits() {
    try {
      // Get tenant tier information
      const response = await apiRequest(`/api/tenant-limits/featured-products?tenantId=${this.tenantId}`);
      if (response.ok) {
        const data = await response.json();
        this.tenantTier = data.tier || 'starter';
        
        // Update featured types with tenant-specific limits
        const updatedFeaturedTypes = this.defaultFeaturedTypes.map(type => ({
          ...type,
          maxProducts: data.limits[type.id] || 8
        }));
        
        this.setState({ featuredTypes: updatedFeaturedTypes });
      }
    } catch (error) {
      console.error('Error fetching tier limits:', error);
      // Keep default limits on error
    }
  }

  private getInitialState(): FeaturedProductsState {
    return {
      featuredProducts: {},
      availableProducts: [],
      inactiveProducts: [], // Add this
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
      forceUpdate: 0,
      // Add setter methods
      setAvailablePage: (page: number) => this.setState({ availablePage: page }),
      setAvailableProducts: (products: FeaturedProduct[]) => this.setState({ availableProducts: products }),
      setInactiveProducts: (products: FeaturedProduct[]) => this.setState({ inactiveProducts: products }),
      setEditingExpiration: (productId: string | null, date?: string) => this.setState({ editingExpiration: productId, expirationDate: date || '' }),
      setSelectedType: (typeId: string) => this.setSelectedType(typeId),
      setSearchQuery: (query: string) => this.setSearchQuery(query)
    };
  }

  // State management
  private setState(updates: Partial<FeaturedProductsState>) {
    console.log('TenantFeaturedProductsSingleton: setState called with:', updates);
    console.log('TenantFeaturedProductsSingleton: Current state before update:', {
      featuredProductsKeys: Object.keys(this.state.featuredProducts || {}),
      featuredProductsCount: Object.values(this.state.featuredProducts || {}).reduce((sum, arr) => sum + arr.length, 0),
      availableProductsCount: this.state.availableProducts?.length || 0,
      inactiveProductsCount: this.state.inactiveProducts?.length || 0
    });
    
    this.state = { ...this.state, ...updates };
    
    console.log('TenantFeaturedProductsSingleton: State after update:', {
      featuredProductsKeys: Object.keys(this.state.featuredProducts || {}),
      featuredProductsCount: Object.values(this.state.featuredProducts || {}).reduce((sum, arr) => sum + arr.length, 0),
      availableProductsCount: this.state.availableProducts?.length || 0,
      inactiveProductsCount: this.state.inactiveProducts?.length || 0
    });
    
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
      console.log('TenantFeaturedProductsSingleton: syncWithProductProvider called');
      
      // Get all universal products for this tenant from ProductSingleton
      const universalProducts = await this.productSingleton.getProductsByTenant?.(this.tenantId) || {};
      console.log('TenantFeaturedProductsSingleton: Universal products count:', Object.keys(universalProducts).length);
      
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

      // Check if we have valid data before updating
      const hasValidFeaturedProducts = Object.keys(combinedFeaturedProducts).some(key => 
        Array.isArray(combinedFeaturedProducts[key]) && combinedFeaturedProducts[key].length > 0
      );
      
      if (hasValidFeaturedProducts) {
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

        console.log('TenantFeaturedProductsSingleton: syncWithProductProvider updating state with valid data');
        this.setState({
          featuredProducts: combinedFeaturedProducts,
          availableProducts
        });
      } else {
        console.log('TenantFeaturedProductsSingleton: syncWithProductProvider has no valid data, not updating state');
      }
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
        this.fetchFeaturedProducts(),
        this.fetchTierLimits(),
        this.fetchInactiveProducts(),
        this.fetchAvailableProducts() // Add this to load available products
      ]);
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
      } else {
        console.error('TenantFeaturedProductsSingleton: Failed to fetch limits:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('TenantFeaturedProductsSingleton: Error fetching featured limits:', error);
      // Don't throw - continue without limits
    }
  }

  async fetchFeaturedProducts() {
    try {
      console.log('TenantFeaturedProductsSingleton: Fetching featured products...');
      const response = await apiRequest(`/api/featured-products/management?tenantId=${this.tenantId}&_t=${Date.now()}`);
      const data = await response.json();
      
      console.log('TenantFeaturedProductsSingleton: Raw API response:', data);
      
      if (data && typeof data === 'object') {
        // Check if the data has actual products (not empty)
        const hasProducts = Object.keys(data).some(key => Array.isArray(data[key]) && data[key].length > 0);
        
        if (hasProducts) {
          console.log('TenantFeaturedProductsSingleton: Featured products fetched successfully', Object.keys(data).length);
          console.log('TenantFeaturedProductsSingleton: Featured products data structure:', {
            keys: Object.keys(data),
            storeSelectionCount: data.store_selection?.length || 0,
            newArrivalCount: data.new_arrival?.length || 0,
            seasonalCount: data.seasonal?.length || 0,
            saleCount: data.sale?.length || 0,
            staffPickCount: data.staff_pick?.length || 0
          });
          this.setState({ featuredProducts: data });
          
          // CRITICAL: Set isLoading to false after successful fetch
          this.setState({ isLoading: false });
          console.log('TenantFeaturedProductsSingleton: Loading state set to false');
        } else {
          console.log('TenantFeaturedProductsSingleton: Empty featured products data received, not updating state');
          // Don't update state with empty data
        }
      } else {
        console.log('TenantFeaturedProductsSingleton: No featured products data received');
        // Don't update state with empty data
      }
    } catch (error) {
      console.error('TenantFeaturedProductsSingleton: Error fetching featured products:', error);
      // Don't update state on error
    }
  }

  async fetchInactiveProducts() {
    try {
      console.log('TenantFeaturedProductsSingleton: Fetching inactive products...');
      const response = await apiRequest(`/api/tenants/${this.tenantId}/products/featured/inactive`);
      if (response.ok) {
        const data = await response.json();
        console.log('TenantFeaturedProductsSingleton: Raw inactive products response:', data);
        let inactiveProducts = (data.products || []) as FeaturedProduct[];
        
        // Enrich inactive products with missing data from available products
        if (inactiveProducts.length > 0 && this.state.availableProducts.length > 0) {
          console.log('TenantFeaturedProductsSingleton: Enriching inactive products with available products data...');
          
          inactiveProducts = inactiveProducts.map(inactiveProduct => {
            // Find matching product in available products by name or SKU
            const matchingAvailable = this.state.availableProducts.find(available => 
              available.name === inactiveProduct.name || 
              available.sku === inactiveProduct.sku
            );
            
            if (matchingAvailable) {
              console.log('TenantFeaturedProductsSingleton: Found match for inactive product:', {
                inactiveProductName: inactiveProduct.name,
                availableProductName: matchingAvailable.name,
                inventory_item_id: matchingAvailable.inventory_item_id
              });
              
              // Merge the data, prioritizing available products data for missing fields
              return {
                ...inactiveProduct,
                inventory_item_id: inactiveProduct.inventory_item_id || matchingAvailable.inventory_item_id,
                // Also copy other useful fields
                stock: matchingAvailable.stock,
                availability: matchingAvailable.availability,
                price_cents: matchingAvailable.price_cents
              };
            }
            
            return inactiveProduct;
          });
          
          console.log('TenantFeaturedProductsSingleton: Enriched inactive products sample:', inactiveProducts.slice(0, 2));
        }
        
        // Debug the first product to see its structure
        if (inactiveProducts.length > 0) {
          console.log('TenantFeaturedProductsSingleton: Sample inactive product structure:', inactiveProducts[0]);
          console.log('TenantFeaturedProductsSingleton: Product ID fields:', {
            id: inactiveProducts[0].id,
            inventory_item_id: inactiveProducts[0].inventory_item_id
          });
        }
        
        const uniqueInactiveProducts = Array.from(
          new Map(inactiveProducts.map((product: FeaturedProduct) => [product.id, product])).values()
        );
        
        // Add inactive products to state
        this.setState({ inactiveProducts: uniqueInactiveProducts });
        console.log('TenantFeaturedProductsSingleton: Inactive products fetched successfully', uniqueInactiveProducts.length);
      } else {
        console.log('TenantFeaturedProductsSingleton: No inactive products data received');
        this.setState({ inactiveProducts: [] });
      }
    } catch (error) {
      console.error('TenantFeaturedProductsSingleton: Error fetching inactive products:', error);
      this.setState({ inactiveProducts: [] });
    }
  }

  async fetchAvailableProducts() {
    // Fallback to direct API call (like the original page)
    try {
      console.log('TenantFeaturedProductsSingleton: Fetching available products...');
      const response = await apiRequest(`/api/tenants/${this.tenantId}/items?limit=100`);
      if (response.ok) {
        const data = await response.json();
        console.log('TenantFeaturedProductsSingleton: Raw available products response:', data);
        
        // Process available products (same as original page)
        const allProducts = data.items || [];
        const featuredProductIds = this.currentFeatured.map((p: FeaturedProduct) => p.inventory_item_id);
        console.log('TenantFeaturedProductsSingleton: Featured product IDs to filter out:', featuredProductIds);
        
        const available = allProducts.filter((p: any) => 
          !featuredProductIds.includes(p.id) && 
          p.item_status === 'active' && 
          p.visibility === 'public' &&
          p.stock > 0 // Must have stock
        );
        
        console.log('TenantFeaturedProductsSingleton: Available products after filtering:', {
          totalProducts: allProducts.length,
          featuredCount: featuredProductIds.length,
          availableCount: available.length,
          sampleAvailable: available.slice(0, 3)
        });
        
        // Use the state's setAvailableProducts method
        this.state.setAvailableProducts(available);
      }
    } catch (error) {
      console.error('Error fetching available products:', error);
      this.state.setAvailableProducts([]);
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
      // For inactive products, the API expects the 'id' field, not 'inventory_item_id'
      // For active products, we use 'inventory_item_id'
      const apiProductId = productId;
      
      const response = await apiRequest(`/api/tenants/${this.tenantId}/products/${apiProductId}/feature/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: isActive
        })
      });

      if (response.ok) {
        await Promise.all([
          this.fetchFeaturedProducts(),
          this.fetchInactiveProducts()
        ]);
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
      console.log('TenantFeaturedProductsSingleton: Updating product expiration:', {
        productId,
        expirationDate,
        selectedType: this.state.selectedType
      });
      
      const response = await apiRequest(`/api/items/${productId}/featured-types/${this.state.selectedType}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          featured_expires_at: expirationDate ? new Date(expirationDate).toISOString() : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('TenantFeaturedProductsSingleton: Expiration update successful:', result);
        
        // Refresh featured products to get updated data
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
