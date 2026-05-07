import { itemsSingletonService } from '@/services/ItemsSingletonService';

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  mpn?: string; // Manufacturer Part Number
  condition?: 'new' | 'used' | 'refurbished';
  price: number | null; // Allow null prices to match database schema
  price_cents?: number; // Price in cents for internal calculations
  sale_price?: number | null; // Sale price in dollars for display
  sale_price_cents?: number; // Sale price in cents for internal calculations
  stock: number;
  status: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed';
  itemStatus?: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed'; // Backend field name
  item_status?: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed'; // Snake case version for backend
  visibility: 'public' | 'private';
  categoryPath?: string[];
  tenantCategoryId?: string | null;
  tenantId?: string; // Tenant ID for the item
  tenantCategory?: {
    id: string;
    name: string;
    slug?: string;
    googleCategoryId?: string | null;
  };
  imageUrl?: string; // Primary photo URL from backend
  images?: string[]; // Legacy field, may be deprecated
  photoCount?: number; // Number of photos for this item
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
  // New fields for variants and digital products
  has_variants?: boolean;
  variants?: ProductVariant[]; // Variants array from complete endpoint
  default_variant_id?: string;
  product_type?: 'physical' | 'digital' | 'hybrid';
  digital_delivery_method?: string;
  digital_assets?: any[];
  license_type?: string;
  access_duration_days?: number;
  download_limit?: number;
  payment_gateway_type?: string;
  payment_gateway_id?: string;
}

// Product variant interface (matches API response)
export interface ProductVariant {
  id: string;
  parent_item_id: string;
  tenant_id: string;
  variant_name: string;
  sku: string;
  price_cents: number;
  sale_price_cents?: number | null;
  stock: number;
  image_url?: string | null;
  attributes?: Record<string, string>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemFilters {
  q?: string;
  status?: 'all' | 'active' | 'inactive' | 'syncing';
  visibility?: 'all' | 'public' | 'private';
  category?: string; // Legacy: directory category slug
  categoryId?: string; // Filter by specific tenant category ID
  categoryFilter?: 'all' | 'assigned' | 'unassigned'; // Filter by category assignment status
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface ItemsResponse {
  items: Item[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface CreateItemData {
  sku: string;
  name: string;
  price: number;
  stock: number;
  description?: string;
}

export interface ItemStats {
  total: number;
  active: number;
  inactive: number;
  syncing: number;
  public: number;
  private: number;
  lowStock: number;
}

/**
 * Service for handling items/inventory data operations
 * Centralizes all API calls and data transformations
 */
export class ItemsDataService {
  /**
   * Fetch storewide aggregated stats for a tenant
   * Returns counts regardless of pagination/filters
   */
  async fetchStats(tenantId: string): Promise<ItemStats> {
    try {
      const result = await itemsSingletonService.getItemsComplete({ tenant_id: tenantId, page: 1, limit: 1 });
      
      if (!result) {
        console.error('[fetchStats] API error: No result returned');
        return { total: 0, active: 0, inactive: 0, syncing: 0, public: 0, private: 0, lowStock: 0 };
      }

      return result.stats;
    } catch (error) {
      console.error('[fetchStats] Error:', error);
      return { total: 0, active: 0, inactive: 0, syncing: 0, public: 0, private: 0, lowStock: 0 };
    }
  }

  /**
   * Fetch items with filters and pagination
   * Category filtering is now done server-side via categoryFilter param
   */
  async fetchItems(
    tenantId: string,
    filters: ItemFilters = {},
    pagination: PaginationParams = { page: 1, limit: 25 }
  ): Promise<ItemsResponse> {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.q) params.append('q', filters.q);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.visibility && filters.visibility !== 'all') params.append('visibility', filters.visibility);
      
      // Category filters - now server-side
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.categoryFilter && filters.categoryFilter !== 'all') {
        params.append('categoryFilter', filters.categoryFilter);
      }

      // Add tenant identifier (snake_case as expected by backend)
      params.append('tenant_id', tenantId);
      
      const result = await itemsSingletonService.getItemsComplete({
        tenant_id: tenantId,
        page: pagination.page,
        limit: pagination.limit,
        q: filters.q,
        status: filters.status,
        visibility: filters.visibility,
        categoryId: filters.categoryId,
        categoryFilter: filters.categoryFilter && filters.categoryFilter !== 'all' ? filters.categoryFilter : undefined
      });
      
      if (!result) {
        throw new Error('Failed to fetch items: No result returned');
      }

      const data = result;

      // Normalize itemStatus to status for all items
      const normalizeItem = (item: any): Item => ({
        ...item,
        status: item.itemStatus || item.item_status || item.status || 'active',
        itemStatus: item.itemStatus || item.item_status || item.status || 'active',
        condition: item.condition === 'brand_new' ? 'new' : item.condition,
      });

      // Handle both paginated and non-paginated responses
      let items: Item[];
      let paginationResult: ItemsResponse['pagination'];
      
      if (data.items && data.pagination) {
        items = data.items.map(normalizeItem);
        paginationResult = data.pagination;
      } else if (Array.isArray(data)) {
        items = data.map(normalizeItem);
        paginationResult = {
          page: 1,
          limit: data.length,
          totalItems: data.length,
          totalPages: 1,
          hasMore: false,
        };
      } else {
        items = [];
        paginationResult = {
          page: 1,
          limit: 25,
          totalItems: 0,
          totalPages: 0,
          hasMore: false,
        };
      }
      
      // Category filtering is now done server-side via categoryFilter param
      
      return { items, pagination: paginationResult };
    } catch (error) {
      // Error will be caught and displayed in UI
      throw error;
    }
  }

  /**
   * Create a new item
   */
  async createItem(tenantId: string, data: CreateItemData): Promise<Item> {
    try {
      const result = await itemsSingletonService.createItem({
        ...data,
      });

      if (!result) {
        throw new Error('Failed to create item: No result returned');
      }

      return result;
    } catch (error) {
      console.error('[createItem] Error:', error);
      throw error;
    }
  }

  /**
   * Update an existing item
   */
  async updateItem(itemId: string, data: Partial<Item>): Promise<Item> {
    try {
      console.log('[updateItem] Sending data:', { itemId, data });
      const result = await itemsSingletonService.updateItem(itemId, data);
      console.log('[updateItem] Result:', result);
      
      if (!result) {
        throw new Error('Failed to update item: No result returned');
      }
      
      // Normalize status fields from API response
      return {
        ...result,
        status: result.status || 'active',
        condition: result.condition,
      };
    } catch (error) {
      console.error('[updateItem] Error:', error);
      // Error will be caught and displayed in UI
      throw error;
    }
  }

  /**
   * Delete an item
   */
  async deleteItem(itemId: string): Promise<void> {
    try {
      const result = await itemsSingletonService.deleteItem(itemId);
      
      if (!result) {
        throw new Error('Failed to delete item: No result returned');
      }
    } catch (error) {
      // Error will be caught and displayed in UI
      throw error;
    }
  }

  /**
   * Upload photos for an item
   */
  async uploadPhotos(itemId: string, files: File[]): Promise<string[]> {
    try {
      const urls = await itemsSingletonService.uploadPhotos(itemId, files);
      return urls;
    } catch (error) {
      // Error will be caught and displayed in UI
      throw error;
    }
  }

  /**
   * Apply client-side category filter
   * An item "has category" if ANY category field is set:
   * - tenantCategoryId (assigned tenant category)
   * - tenantCategory (category object)
   * - categoryPath (enrichment data)
   * - metadata.googleCategoryId (Google category from enrichment)
   */
  applyCategoryFilter(items: Item[], categoryFilter: string): Item[] {
    if (categoryFilter === 'all') return items;
    
    const hasCategory = (item: Item): boolean => {
      if (item.tenantCategoryId) return true;
      if (item.tenantCategory?.id) return true;
      if (item.categoryPath && item.categoryPath.length > 0) return true;
      if (item.metadata?.googleCategoryId) return true;
      return false;
    };
    
    if (categoryFilter === 'assigned') {
      return items.filter(hasCategory);
    }
    if (categoryFilter === 'unassigned') {
      return items.filter(item => !hasCategory(item));
    }
    return items;
  }

  /**
   * Calculate quick stats from items
   */
  calculateStats(items: Item[]) {
    return {
      total: items.length,
      active: items.filter(i => i.status === 'active').length,
      inactive: items.filter(i => i.status === 'inactive').length,
      syncing: items.filter(i => i.status === 'syncing').length,
      public: items.filter(i => i.visibility === 'public').length,
      private: items.filter(i => i.visibility === 'private').length,
      lowStock: items.filter(i => i.stock < 10).length,
    };
  }
}

// Export singleton instance
export const itemsDataService = new ItemsDataService();
