/**
 * Tenant Featured Products Singleton
 * 
 * Manages featured products state and operations for a specific tenant.
 * Integrates with existing ProductSingleton for universal product data.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

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
  outOfStockProducts: FeaturedProduct[]; // Add out-of-stock products
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
  outOfStockPage: number;
  editingExpiration: string | null;
  expirationDate: string;
  togglingActive: boolean;
  forceUpdate: number;
  
  // Setters
  setAvailablePage: (page: number) => void;
  setOutOfStockPage: (page: number) => void;
  setAvailableProducts: (products: FeaturedProduct[]) => void;
  setOutOfStockProducts: (products: FeaturedProduct[]) => void; // Add this
  setInactiveProducts: (products: FeaturedProduct[]) => void;
  setEditingExpiration: (productId: string | null, date?: string) => void;
  setSelectedType: (typeId: string) => void;
  setSearchQuery: (query: string) => void;
  
  // Getters
  getOutOfStockProducts: () => FeaturedProduct[]; // Add this
}

class TenantFeaturedProductsSingleton extends TenantApiSingleton {
  private tenantId: string;
  private state: FeaturedProductsState;
  private listeners: Set<() => void> = new Set();
  private initialized = false;
  private tenantTier: string = 'starter';
  private cacheBypassUntil: number = 0; // Add cache bypass timestamp

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      `tenant-featured-products-${this.tenantId}*`,
      `featured-products-state-${this.tenantId}*`,
      `tenant-featured-config-${this.tenantId}*`
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    const targetTenantId = tenantId || this.tenantId;
    await this.invalidateCachePattern(`tenant-featured-products-${targetTenantId}*`);
    await this.invalidateCachePattern(`featured-products-state-${targetTenantId}*`);
    await this.invalidateCachePattern(`tenant-featured-config-${targetTenantId}*`);
  }

  // ProductSingleton integration
  private productSingleton: any = null;

  // Default featured types (storefront)
  private defaultFeaturedTypes: FeaturedType[] = [
    {
      id: 'new_arrival',
      name: 'New Arrivals',
      description: 'Recently added products',
      icon: null,
      color: 'green',
      maxProducts: 6
    },
    {
      id: 'seasonal',
      name: 'Seasonal',
      description: 'Seasonal product highlights',
      icon: null,
      color: 'orange',
      maxProducts: 6
    },
    {
      id: 'staff_pick',
      name: 'Staff Picks',
      description: 'Hand-picked by our team',
      icon: null,
      color: 'purple',
      maxProducts: 8
    },
    {
      id: 'sale',
      name: 'Sale Items',
      description: 'Products on sale or promotion',
      icon: null,
      color: 'red',
      maxProducts: 10
    },
    // New expansion types
    {
      id: 'bestseller',
      name: 'Bestsellers',
      description: 'Top-selling products',
      icon: null,
      color: 'amber',
      maxProducts: 8
    },
    {
      id: 'clearance',
      name: 'Clearance',
      description: 'Discounted clearance items',
      icon: null,
      color: 'yellow',
      maxProducts: 5
    },
    {
      id: 'trending',
      name: 'Trending Now',
      description: 'Currently trending products',
      icon: null,
      color: 'pink',
      maxProducts: 7
    },
    {
      id: 'featured',
      name: 'Featured',
      description: 'General featured products',
      icon: null,
      color: 'indigo',
      maxProducts: 10
    },
    {
      id: 'recommended',
      name: 'Recommended',
      description: 'AI/customer recommended products',
      icon: null,
      color: 'teal',
      maxProducts: 6
    }
  ];

  // Directory-only types (not available in storefront)
  private directoryOnlyTypes: FeaturedType[] = [
    {
      id: 'store_selection',
      name: 'Directory Featured',
      description: 'Premium placement in directory listings',
      icon: null,
      color: 'blue',
      maxProducts: 8
    }
  ];

  // Get storefront-only types (exclude directory types)
  getStorefrontTypes(): FeaturedType[] {
    return this.defaultFeaturedTypes.map(type => ({
      ...type,
      maxProducts: (this.state.featuredLimits as any)?.[type.id] || type.maxProducts
    }));
  }

  // Get directory-only types (not available in storefront)
  getDirectoryOnlyTypes(): FeaturedType[] {
    return this.directoryOnlyTypes.map(type => ({
      ...type,
      maxProducts: (this.state.featuredLimits as any)?.[type.id] || type.maxProducts
    }));
  }

  // Get all featured types (for admin context)
  getAllTypes(): FeaturedType[] {
    const allTypes = [...this.defaultFeaturedTypes, ...this.directoryOnlyTypes];
    
    // Apply current database limits to all types
    const typesWithLimits = allTypes.map(type => ({
      ...type,
      maxProducts: (this.state.featuredLimits as any)?.[type.id] || type.maxProducts
    }));
    
    console.log('[TenantFeaturedProductsSingleton] getAllTypes returning:', {
      totalTypes: typesWithLimits.length,
      featuredLimits: this.state.featuredLimits,
      typesWithLimits: typesWithLimits.map(t => ({ id: t.id, maxProducts: t.maxProducts }))
    });
    
    return typesWithLimits;
  }

  constructor(tenantId: string) {
    super('tenant-featured-products');
    this.tenantId = tenantId;
    this.setCurrentTenant(tenantId);
    this.state = this.getInitialState();
  }

  // Fetch tier limits (using tenant-specific API endpoint)
  async fetchTierLimits() {
    try {
      // Get tenant tier information
      const result = await this.makeDefaultRequest(`/api/tenant-limits/featured-products?tenantId=${this.tenantId}`, undefined, `tier-limits-${this.tenantId}`);
      if (result.success) {
        const data = result.data as any;
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
      outOfStockProducts: [], // Add this
      inactiveProducts: [], // Add this
      featuredLimits: {},
      featuredTypes: [...this.defaultFeaturedTypes],
      isLoading: true,
      processing: false,
      searchQuery: '',
      selectedType: 'new_arrival', // Default to storefront type
      currentType: null,
      availablePage: 1,
      outOfStockPage: 1,
      editingExpiration: null,
      expirationDate: '',
      togglingActive: false,
      forceUpdate: 0,
      // Add setter methods
      setAvailablePage: (page: number) => this.setState({ availablePage: page }),
      setOutOfStockPage: (page: number) => this.setState({ outOfStockPage: page }),
      setAvailableProducts: (products: FeaturedProduct[]) => this.setState({ availableProducts: products }),
      setOutOfStockProducts: (products: FeaturedProduct[]) => this.setState({ outOfStockProducts: products }), // Add this
      setInactiveProducts: (products: FeaturedProduct[]) => this.setState({ inactiveProducts: products }),
      setEditingExpiration: (productId: string | null, date?: string) => this.setState({ editingExpiration: productId, expirationDate: date || '' }),
      setSelectedType: (typeId: string) => this.setSelectedType(typeId),
      setSearchQuery: (query: string) => this.setSearchQuery(query),
      
      // Add getter methods
      getOutOfStockProducts: () => this.state.outOfStockProducts || [] // Add this
    };
  }

  // State management
  private setState(updates: Partial<FeaturedProductsState>) {
    /* console.log('TenantFeaturedProductsSingleton: setState called with:', updates);
    console.log('TenantFeaturedProductsSingleton: Current state before update:', {
      featuredProductsKeys: Object.keys(this.state.featuredProducts || {}),
      featuredProductsCount: Object.values(this.state.featuredProducts || {}).reduce((sum, arr) => sum + arr.length, 0),
      availableProductsCount: this.state.availableProducts?.length || 0,
      outOfStockProductsCount: this.state.outOfStockProducts?.length || 0,
      inactiveProductsCount: this.state.inactiveProducts?.length || 0
    }); */
    
    this.state = { ...this.state, ...updates };
    
    /* console.log('TenantFeaturedProductsSingleton: State after update:', {
      featuredProductsKeys: Object.keys(this.state.featuredProducts || {}),
      featuredProductsCount: Object.values(this.state.featuredProducts || {}).reduce((sum, arr) => sum + arr.length, 0),
      availableProductsCount: this.state.availableProducts?.length || 0,
      outOfStockProductsCount: this.state.outOfStockProducts?.length || 0,
      inactiveProductsCount: this.state.inactiveProducts?.length || 0
    }); */
    
    this.notifyListeners();
  }

  private notifyListeners() {
    // console.log(`[TenantFeaturedProductsSingleton] Notifying ${this.listeners.size} listeners of state change`);
    this.listeners.forEach(listener => {
      // console.log(`[TenantFeaturedProductsSingleton] Calling listener`);
      listener();
    });
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
      // console.log('TenantFeaturedProductsSingleton: syncWithProductProvider called');
      
      // Get all universal products for this tenant from ProductSingleton
      const universalProducts = await this.productSingleton.getProductsByTenant?.(this.tenantId) || {};
      // console.log('TenantFeaturedProductsSingleton: Universal products count:', Object.keys(universalProducts).length);
      
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

        // console.log('TenantFeaturedProductsSingleton: syncWithProductProvider updating state with valid data');
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
        this.fetchFeaturedLimits(), // Add this to get database limits
        this.fetchInactiveProducts(),
        this.fetchAvailableProducts(), // Load available products for featuring
        this.fetchOutOfStockProducts() // Load out-of-stock products for management
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
    let result;
    try {
      console.log('[TenantFeaturedProductsSingleton] Fetching featured limits for tenant:', this.tenantId);
      result = await this.makeDefaultRequest(`/api/tenant-limits/featured-products?tenantId=${this.tenantId}`, undefined, `featured-limits-${this.tenantId}`);
      if (result.success) {
        const data = result.data as any;
        console.log('Featured limits fetched:', { 
          tier: data.tier, 
          status: data.status,
          limits: data.limits 
        });
        
        this.setState({ featuredLimits: data.limits });
        
        // Update featuredTypes with actual limits - include ALL types
        const allTypes = this.getAllTypes(); // Get all 10 types
        const updatedTypes = allTypes.map(type => ({
          ...type,
          maxProducts: (data.limits as any)[type.id] || type.maxProducts
        }));
        
        // Update state with all types
        this.setState({ featuredTypes: updatedTypes });
        
        // Update currentType if needed
        const newCurrentType = updatedTypes.find(t => t.id === this.state.selectedType) || updatedTypes[0];
        this.setState({ currentType: newCurrentType });
      } else {
        console.error('TenantFeaturedProductsSingleton: Failed to fetch limits:', result.error);
      }
    } catch (error) {
      console.error('TenantFeaturedProductsSingleton: Error fetching featured limits:', error);
      // Don't throw - continue without limits
    }
  }

  async fetchFeaturedProducts() {
    try {
      // Check if we should bypass cache
      const shouldBypassCache = Date.now() < this.cacheBypassUntil;
      const cacheOptions = shouldBypassCache ? 0 : 600000; // 0 TTL = bypass cache
      
      if (shouldBypassCache) {
        console.log(`[TenantFeaturedProductsSingleton] Cache bypass active, forcing fresh fetch`);
      }
      
      const result = await this.makeDefaultRequest(
        `/api/featured-products/management?tenantId=${this.tenantId}&_t=${Date.now()}`,
        undefined,
        `/api/featured-products/management?tenantId=${this.tenantId}`, // Remove timestamp from cache key
        cacheOptions
      );
      if (result.success) {
        const data = result.data as any;
        this.setState({ featuredProducts: data });
        this.setState({ isLoading: false });
      } else {
        console.error('TenantFeaturedProductsSingleton: Failed to fetch featured products:', result.error);
      }
    } catch (error) {
      console.error('TenantFeaturedProductsSingleton: Error fetching featured products:', error);
    }
  }

  async fetchInactiveProducts() {
    try {
      // console.log('TenantFeaturedProductsSingleton: Fetching inactive products...');
      const result = await this.makeDefaultRequest(`/api/tenants/${this.tenantId}/products/featured/inactive`, undefined, `inactive-products-${this.tenantId}`);
      if (result.success) {
        const data = result.data as any;
        // console.log('TenantFeaturedProductsSingleton: Raw inactive products response:', data);
        let inactiveProducts = (data.products || []) as FeaturedProduct[];
        
        // Enrich inactive products with missing data from available products
        if (inactiveProducts.length > 0 && this.state.availableProducts.length > 0) {
          // console.log('TenantFeaturedProductsSingleton: Enriching inactive products with available products data...');
          
          inactiveProducts = inactiveProducts.map(inactiveProduct => {
            // Find matching product in available products by name or SKU
            const matchingAvailable = this.state.availableProducts.find(available => 
              available.name === inactiveProduct.name || 
              available.sku === inactiveProduct.sku
            );
            
            if (matchingAvailable) {
              /* console.log('TenantFeaturedProductsSingleton: Found match for inactive product:', {
                inactiveProductName: inactiveProduct.name,
                availableProductName: matchingAvailable.name,
                inventory_item_id: matchingAvailable.inventory_item_id
              }); */
              
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
        /* if (inactiveProducts.length > 0) {
          console.log('TenantFeaturedProductsSingleton: Sample inactive product structure:', inactiveProducts[0]);
          console.log('TenantFeaturedProductsSingleton: Product ID fields:', {
            id: inactiveProducts[0].id,
            inventory_item_id: inactiveProducts[0].inventory_item_id
          });
        } */
        
        const uniqueInactiveProducts = Array.from(
          new Map(inactiveProducts.map((product: FeaturedProduct) => [product.id, product])).values()
        );
        
        // Add inactive products to state
        this.setState({ inactiveProducts: uniqueInactiveProducts });
        //console.log('TenantFeaturedProductsSingleton: Inactive products fetched successfully', uniqueInactiveProducts.length);
      } else {
        //console.log('TenantFeaturedProductsSingleton: No inactive products data received');
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
      //console.log('TenantFeaturedProductsSingleton: Fetching available products...');
      const result = await this.makeDefaultRequest(`/api/tenants/${this.tenantId}/items?limit=100`, undefined, `available-products-${this.tenantId}`);
      if (result.success) {
        const data = result.data as any;
        //console.log('TenantFeaturedProductsSingleton: Raw available products response:', data);
        
        // Process available products (same as original page)
        const allProducts = data.items || [];
        const featuredProductIds = this.currentFeatured.map((p: FeaturedProduct) => p.inventory_item_id);
        //console.log('TenantFeaturedProductsSingleton: Featured product IDs to filter out:', featuredProductIds);
        
        const available = allProducts.filter((p: any) => 
          !featuredProductIds.includes(p.id) && 
          p.item_status === 'active' && 
          p.visibility === 'public' &&
          p.stock > 0 // Only show in-stock products for featuring
        );
        
        /* console.log('TenantFeaturedProductsSingleton: Available products after filtering:', {
          totalProducts: allProducts.length,
          featuredCount: featuredProductIds.length,
          availableCount: available.length,
          sampleAvailable: available.slice(0, 3)
        }); */
        
        // DEBUG: Log the first product's structure
        /* if (available.length > 0) {
          console.log('=== PRODUCT STRUCTURE FROM API ===');
          console.log('First product:', available[0]);
          console.log('Product keys:', Object.keys(available[0]));
          console.log('ID field:', available[0].id);
          console.log('inventory_item_id field:', available[0].inventory_item_id);
          console.log('=== END PRODUCT STRUCTURE ===');
        } */
        
        // Use the state's setAvailableProducts method
        this.state.setAvailableProducts(available);
      }
    } catch (error) {
      //console.error('Error fetching available products:', error);
      this.state.setAvailableProducts([]);
    }
  }

  async fetchOutOfStockProducts() {
    // Fetch out-of-stock products for management visibility
    try {
      //console.log('TenantFeaturedProductsSingleton: Fetching out-of-stock products...');
      const result = await this.makeDefaultRequest(`/api/tenants/${this.tenantId}/items?limit=100`, undefined, `out-of-stock-products-${this.tenantId}`);
      if (result.success) {
        const data = result.data as any;
        
        // Process out-of-stock products
        const allProducts = data.items || [];
        const featuredProductIds = this.currentFeatured.map((p: FeaturedProduct) => p.inventory_item_id);
        
        const outOfStock = allProducts.filter((p: any) => 
          !featuredProductIds.includes(p.id) && 
          p.item_status === 'active' && 
          p.visibility === 'public' &&
          p.stock === 0 // Only show out-of-stock products
        );
        
        console.log('TenantFeaturedProductsSingleton: Out-of-stock products after filtering:', {
          totalProducts: allProducts.length,
          featuredCount: featuredProductIds.length,
          outOfStockCount: outOfStock.length,
          sampleOutOfStock: outOfStock.slice(0, 3)
        });
        
        // Use the state's setOutOfStockProducts method
        this.state.setOutOfStockProducts(outOfStock);
      }
    } catch (error) {
      console.error('Error fetching out-of-stock products:', error);
      this.state.setOutOfStockProducts([]);
    }
  }

  // Action methods
  async featureProduct(productId: string) {
    //console.log('[TenantFeaturedProductsSingleton] featureProduct called with productId:', productId);
    if (!productId) {
      //console.error('[TenantFeaturedProductsSingleton] productId is undefined in featureProduct');
      throw new Error('Product ID is required for featuring');
    }
    
    this.setState({ processing: true });
    
    try {
      const defaultExpiration = new Date();
      defaultExpiration.setDate(defaultExpiration.getDate() + 30);
      
      const result = await this.makeDefaultRequest(`/api/items/${productId}/featured-types`, {
        method: 'POST',
        body: JSON.stringify({
          tenantId: this.tenantId,
          featured_type: this.state.selectedType,
          featured_priority: 50,
          featured_expires_at: defaultExpiration.toISOString(),
          auto_unfeature: true
        }),
      }, `featured-products-${this.tenantId}`);

      if (result.success) {
        const responseData = result.data as any;
        console.log('[TenantFeaturedProductsSingleton] Feature product successful:', responseData);
        
        // Use the response data to update local state immediately
        const featuredProduct = responseData.featuredProduct;
        if (featuredProduct) {
          // Add the product to featured products list (grouped by type)
          const featuredType = featuredProduct.featured_type || this.state.selectedType;
          const currentTypeProducts = this.state.featuredProducts[featuredType] || [];
          
          this.setState({
            featuredProducts: {
              ...this.state.featuredProducts,
              [featuredType]: [...currentTypeProducts, featuredProduct]
            },
            availableProducts: this.state.availableProducts.filter(
              product => product.inventory_item_id !== featuredProduct.inventory_item_id
            ),
            inactiveProducts: this.state.inactiveProducts.filter(
              product => product.inventory_item_id !== featuredProduct.inventory_item_id
            )
          });
          
          // console.log('[TenantFeaturedProductsSingleton] Local state updated with response data');
        }
        
        // Invalidate ProductSingleton cache for this product
        if (this.productSingleton?.invalidateCache) {
          this.productSingleton.invalidateCache(productId);
        }

        // Note: Backend handles storefront revalidation automatically
      } else {
        const error = result.error;
        throw new Error(getErrorMessage(result.error) || 'Failed to feature product');
      }
    } catch (error) {
      console.error('Error featuring product:', error);
      throw error;
    } finally {
      this.setState({ processing: false });
    }
  }

  // Separate method for directory featuring (uses store_selection type for backend compatibility)
  async featureProductInDirectory(productId: string) {
    if (!productId) {
      throw new Error('Product ID is required for directory featuring');
    }
    
    this.setState({ processing: true });
    
    try {
      const defaultExpiration = new Date();
      defaultExpiration.setDate(defaultExpiration.getDate() + 30);
      
      const result = await this.makeDefaultRequest(`/api/items/${productId}/featured-types`, {
        method: 'POST',
        body: JSON.stringify({
          tenantId: this.tenantId,
          featured_type: 'store_selection', // Use existing backend-recognized type
          featured_priority: 50,
          featured_expires_at: defaultExpiration.toISOString(),
          auto_unfeature: true
        })
      });

      if (result.success || (result as any).featuredProduct) {
        console.log('[TenantFeaturedProductsSingleton] Directory feature successful:', result);
        
        // Update local state with the new featured product
        if ((result as any).featuredProduct) {
          const featuredProduct = {
            ...(result as any).featuredProduct,
            featuredTypes: ['store_selection']
          };
          
          this.setState({
            featuredProducts: {
              ...this.state.featuredProducts,
              store_selection: [...(this.state.featuredProducts?.store_selection || []), featuredProduct]
            },
            availableProducts: this.state.availableProducts.filter(
              product => product.inventory_item_id !== featuredProduct.inventory_item_id
            ),
            inactiveProducts: this.state.inactiveProducts.filter(
              product => product.inventory_item_id !== featuredProduct.inventory_item_id
            )
          });
          
          // console.log('[TenantFeaturedProductsSingleton] Directory state updated');
        }
        
        // Invalidate cache
        // console.log(`[TenantFeaturedProductsSingleton] About to invalidate pattern: /api/featured-products/management?tenantId=${this.tenantId}*`);
        try {
          await this.invalidateCachePattern(`/api/featured-products/management?tenantId=${this.tenantId}*`);
          // console.log(`[TenantFeaturedProductsSingleton] Pattern invalidation completed`);
        } catch (patternError) {
          console.warn(`[TenantFeaturedProductsSingleton] Pattern invalidation failed, using fallback:`, patternError);
          this.invalidateCache(`/api/featured-products/management?tenantId=${this.tenantId}`);
        }
        
        // Set cache bypass for 5 seconds
        this.cacheBypassUntil = Date.now() + 5000;
      } else {
        throw new Error(getErrorMessage(result.error) || 'Failed to feature product in directory');
      }
    } catch (error) {
      console.error('Error featuring product in directory:', error);
      throw error;
    } finally {
      this.setState({ processing: false });
    }
  }

  async unfeatureProduct(productId: string) {
    this.setState({ processing: true });
    
    try {
      const result = await this.makeDefaultRequest(`/api/items/${productId}/featured-types/${this.state.selectedType}`, {
        method: 'DELETE',
      }, `featured-products-${this.tenantId}`);

      if (result.success) {
        // Add delay to ensure database transaction commits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Invalidate cache using pattern matching for the management endpoint
        // console.log(`[TenantFeaturedProductsSingleton] About to invalidate pattern: /api/featured-products/management?tenantId=${this.tenantId}*`);
        try {
          await this.invalidateCachePattern(`/api/featured-products/management?tenantId=${this.tenantId}*`);
          // console.log(`[TenantFeaturedProductsSingleton] Pattern invalidation completed`);
        } catch (patternError) {
          console.warn(`[TenantFeaturedProductsSingleton] Pattern invalidation failed, using fallback:`, patternError);
          // Fallback: try to clear the specific cache key used by fetchFeaturedProducts
          this.invalidateCache(`/api/featured-products/management?tenantId=${this.tenantId}`);
        }
        
        // Set cache bypass for 5 seconds to ensure fresh data
        this.cacheBypassUntil = Date.now() + 5000;
        // console.log(`[TenantFeaturedProductsSingleton] Cache bypass set until: ${new Date(this.cacheBypassUntil).toISOString()}`);
        
        this.invalidateCache(`inactive-products-${this.tenantId}`);
        this.invalidateCache(`available-products-${this.tenantId}`);
        
        await Promise.all([
          this.fetchFeaturedProducts(),
          this.fetchAvailableProducts()
        ]);

        // Invalidate ProductSingleton cache for this product
        if (this.productSingleton?.invalidateCache) {
          this.productSingleton.invalidateCache(productId);
        }

        // Note: Backend handles storefront revalidation automatically
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
      // console.log('[toggleProductActive] Called with:', { productId, isActive, tenantId: this.tenantId });
      
      const url = `/api/tenants/${this.tenantId}/products/${productId}/feature/active`;
      // console.log('[toggleProductActive] API URL:', url);
      
      const result = await this.makeDefaultRequest(url, {
        method: 'PATCH',
        body: JSON.stringify({
          is_active: isActive
        })
      }, `featured-products-${this.tenantId}`);

      // console.log('[toggleProductActive] Response success:', result.success);
      
      if (result.success) {
        const data = result.data as any;
        // console.log('[toggleProductActive] Success:', data);
        // Invalidate cache using pattern matching for the management endpoint
        // console.log(`[TenantFeaturedProductsSingleton] About to invalidate pattern: /api/featured-products/management?tenantId=${this.tenantId}*`);
        try {
          await this.invalidateCachePattern(`/api/featured-products/management?tenantId=${this.tenantId}*`);
          // console.log(`[TenantFeaturedProductsSingleton] Pattern invalidation completed`);
        } catch (patternError) {
          console.warn(`[TenantFeaturedProductsSingleton] Pattern invalidation failed, using fallback:`, patternError);
          // Fallback: try to clear the specific cache key used by fetchFeaturedProducts
          this.invalidateCache(`/api/featured-products/management?tenantId=${this.tenantId}`);
        }
        this.invalidateCache(`inactive-products-${this.tenantId}`);
        this.invalidateCache(`available-products-${this.tenantId}`);
        
        await Promise.all([
          this.fetchFeaturedProducts(),
          this.fetchInactiveProducts()
        ]);
      } else {
        const errorData = result.error;
        console.error('[toggleProductActive] API error:', errorData);
        throw new Error(getErrorMessage(result.error) || 'Failed to update product status');
      }
    } catch (error) {
      console.error('[toggleProductActive] Error:', error);
      throw error;
    } finally {
      this.setState({ togglingActive: false });
    }
  }

  async updateProductExpiration(productId: string, expirationDate: string) {
    this.setState({ processing: true });
    
    try {
      /* console.log('TenantFeaturedProductsSingleton: Updating product expiration:', {
        productId,
        expirationDate,
        selectedType: this.state.selectedType
      }); */
      
      const result = await this.makeDefaultRequest(`/api/items/${productId}/featured-types/${this.state.selectedType}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          featured_expires_at: expirationDate ? new Date(expirationDate).toISOString() : null
        })
      }, `featured-products-${this.tenantId}`);

      if (result.success) {
        const responseData = result.data;
        //console.log('TenantFeaturedProductsSingleton: Expiration update successful:', responseData);
        
        // Invalidate cache using pattern matching for the management endpoint
        await this.invalidateCachePattern(`/api/featured-products/management?tenantId=${this.tenantId}*`);
        this.invalidateCache(`inactive-products-${this.tenantId}`);
        this.invalidateCache(`available-products-${this.tenantId}`);
        
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

  setOutOfStockPage(page: number) {
    this.setState({ outOfStockPage: page });
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
